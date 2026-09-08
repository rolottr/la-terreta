import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { brotliCompressSync, constants } from 'node:zlib';
import { MeshoptEncoder } from 'meshoptimizer';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const EXT = 'EXT_meshopt_compression';
const widths = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };
const components = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
export const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export const brotliSize = bytes => brotliCompressSync(bytes, {
  params: { [constants.BROTLI_PARAM_QUALITY]: 6 },
}).length;

export function readGlb(bytes) {
  assert.equal(bytes.readUInt32LE(0), 0x46546c67, 'GLB header');
  assert.equal(bytes.readUInt32LE(4), 2, 'GLB version');
  assert.equal(bytes.readUInt32LE(8), bytes.length, 'GLB length');
  const length = bytes.readUInt32LE(12);
  assert.equal(bytes.readUInt32LE(16), 0x4e4f534a, 'JSON chunk');
  assert.equal(bytes.readUInt32LE(24 + length), 0x004e4942, 'BIN chunk');
  const doc = JSON.parse(bytes.subarray(20, 20 + length));
  assert.equal(doc.buffers.length, 1, 'Expected one source buffer');
  assert.ok(!doc.buffers[0].uri && !doc.extensionsUsed?.includes(EXT), 'Expected source GLB');
  const bin = bytes.subarray(28 + length);
  const views = doc.bufferViews.map(view => {
    assert.equal(view.buffer, 0);
    const start = view.byteOffset ?? 0;
    assert.ok(start + view.byteLength <= bin.length, 'Buffer bounds');
    return bin.subarray(start, start + view.byteLength);
  });
  return { doc, views };
}

export function writeGlb(doc, bin) {
  const json = Buffer.from(JSON.stringify(doc));
  const jsonLength = (json.length + 3) & ~3;
  const binLength = (bin.length + 3) & ~3;
  const result = Buffer.alloc(28 + jsonLength + binLength);
  result.writeUInt32LE(0x46546c67, 0);
  result.writeUInt32LE(2, 4);
  result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(jsonLength, 12);
  result.writeUInt32LE(0x4e4f534a, 16);
  result.fill(0x20, 20, 20 + jsonLength);
  json.copy(result, 20);
  result.writeUInt32LE(binLength, 20 + jsonLength);
  result.writeUInt32LE(0x004e4942, 24 + jsonLength);
  bin.copy(result, 28 + jsonLength);
  return result;
}

/** Only storage changes. No quantization, filters, vertex reordering or resampling. */
export async function packGlb(source, { meshopt = true, image, resolveImage } = {}) {
  await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
  const { doc, views } = readGlb(source);
  const original = structuredClone(doc);
  const imageViews = new Set();
  for (const entry of doc.images ?? []) {
    if (entry.uri && resolveImage) Object.assign(entry, resolveImage(entry.uri));
    if (entry.bufferView !== undefined) {
      imageViews.add(entry.bufferView);
      if (image) {
        const replacement = await image(views[entry.bufferView], entry.mimeType, entry);
        if (replacement) {
          entry.uri = replacement.uri;
          entry.mimeType = replacement.mimeType;
          delete entry.bufferView;
        }
      }
    }
  }
  // WebP is a glTF extension even though browsers decode it natively.
  for (const texture of doc.textures ?? []) {
    if (doc.images[texture.source]?.mimeType === 'image/webp') {
      texture.extensions = { ...texture.extensions, EXT_texture_webp: { source: texture.source } };
      delete texture.source;
      doc.extensionsUsed = [...new Set([...(doc.extensionsUsed ?? []), 'EXT_texture_webp'])];
      doc.extensionsRequired = [...new Set([...(doc.extensionsRequired ?? []), 'EXT_texture_webp'])];
    }
  }
  const chunks = [], offsets = new Map();
  let length = 0, fallbackLength = 0, compressedViews = 0;
  function append(bytes) {
    const key = hash(bytes);
    if (offsets.has(key)) return offsets.get(key);
    const offset = length;
    chunks.push(bytes);
    const padding = (4 - bytes.length % 4) % 4;
    if (padding) chunks.push(Buffer.alloc(padding));
    length += bytes.length + padding;
    offsets.set(key, offset);
    return offset;
  }
  for (const [index, view] of doc.bufferViews.entries()) {
    const bytes = views[index];
    // Keep view indices stable. An external image leaves an unused four-byte view.
    const externalImage = imageViews.has(index) && !doc.images.some(im => im.bufferView === index);
    const payload = externalImage ? Buffer.alloc(4) : bytes;
    const layouts = [];
    for (const accessor of doc.accessors) {
      const width = widths[accessor.type] * components[accessor.componentType];
      if (accessor.bufferView === index || accessor.sparse?.values.bufferView === index) layouts.push(width);
      if (accessor.sparse?.indices.bufferView === index) layouts.push(components[accessor.sparse.indices.componentType]);
    }
    const strides = new Set(layouts);
    const stride = view.byteStride ?? (strides.size === 1 ? [...strides][0] : 4);
    // INDICES preserves the exact index order; TRIANGLES can rotate triangle corners.
    const sparseIndex = doc.accessors.some(a => a.sparse?.indices.bufferView === index);
    const mode = (view.target === 34963 || sparseIndex) && [2, 4].includes(stride) ? 'INDICES' : 'ATTRIBUTES';
    const eligible = meshopt && !imageViews.has(index) && layouts.length && stride > 0 &&
      stride <= 256 && bytes.length % stride === 0 && (mode === 'INDICES' || stride % 4 === 0);
    let encoded;
    if (eligible) {
      const candidate = Buffer.from(MeshoptEncoder.encodeGltfBuffer(bytes, bytes.length / stride, stride, mode));
      // Small views and some data compress better with HTTP Brotli alone.
      if (candidate.length + 160 < bytes.length && brotliSize(candidate) + 40 < brotliSize(bytes)) encoded = candidate;
    }
    if (encoded) {
      const decoded = Buffer.alloc(bytes.length);
      MeshoptDecoder.decodeGltfBuffer(decoded, bytes.length / stride, stride, encoded, mode);
      assert.ok(decoded.equals(bytes), `Exact model bytes: bufferView ${index}`);
      view.buffer = 1;
      view.byteOffset = fallbackLength;
      fallbackLength += (bytes.length + 3) & ~3;
      view.extensions = { ...view.extensions, [EXT]: {
        buffer: 0, byteOffset: append(encoded), byteLength: encoded.length,
        byteStride: stride, count: bytes.length / stride, mode,
      } };
      compressedViews++;
    } else {
      view.buffer = 0;
      view.byteOffset = append(payload);
      view.byteLength = payload.length;
    }
  }
  doc.buffers = [{ byteLength: length }];
  if (compressedViews) {
    doc.buffers.push({ byteLength: fallbackLength, extensions: { [EXT]: { fallback: true } } });
    doc.extensionsUsed = [...new Set([...(doc.extensionsUsed ?? []), EXT])];
    doc.extensionsRequired = [...new Set([...(doc.extensionsRequired ?? []), EXT])];
  }
  // The full scene and accessor contracts must stay identical, including custom extras.
  for (const key of Object.keys(original)) {
    if (!['buffers', 'bufferViews', 'images', 'textures', 'extensionsUsed', 'extensionsRequired'].includes(key)) {
      assert.deepEqual(doc[key], original[key], `Preserve ${key}`);
    }
  }
  const binary = Buffer.concat(chunks);
  for (const [index, view] of doc.bufferViews.entries()) {
    if (imageViews.has(index) || view.extensions?.[EXT]) continue;
    assert.ok(binary.subarray(view.byteOffset, view.byteOffset + view.byteLength).equals(views[index]), `Preserve view ${index}`);
  }
  return { bytes: writeGlb(doc, binary), compressedViews };
}
