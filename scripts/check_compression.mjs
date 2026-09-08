/** Compare the production artifacts with the source assets, after decoding. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { hash, readGlb } from './compression/glb.mjs';
import { imageError, isDataImage } from './compression/images.mjs';

await MeshoptDecoder.ready;
const report = JSON.parse(await readFile('output/compression/build-report.json'));
const imageChecks = new Set();
let modelCount = 0, viewCount = 0;
async function sameImage(source, uri, dataImage = false) {
  const key = hash(source) + uri + dataImage;
  if (imageChecks.has(key)) return;
  const output = await readFile('dist' + uri);
  const before = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const after = await sharp(output).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual(after.info, before.info, uri);
  if (dataImage) assert.ok(after.data.equals(before.data), `Exact texture data: ${uri}`);
  else assert.ok(imageError(before.data, after.data) <= 8, `Image colour and alpha: ${uri}`);
  imageChecks.add(key);
}
for (const entry of report) {
  const source = await readFile('public/' + entry.path);
  const output = await readFile('dist' + entry.url);
  assert.equal(output.length, entry.after, entry.path);
  if (entry.url.startsWith('/media/')) assert.ok(entry.url.includes(hash(output).slice(0, 20)), `Content hash: ${entry.path}`);
  if (entry.path.endsWith('.png')) await sameImage(source, entry.url, isDataImage(entry.path));
  else if (!entry.path.endsWith('.glb')) assert.ok(output.equals(source), entry.path);
  else {
    const { doc: before, views } = readGlb(source);
    const jsonLength = output.readUInt32LE(12);
    const after = JSON.parse(output.subarray(20, 20 + jsonLength));
    const bin = output.subarray(28 + jsonLength);
    for (const key of Object.keys(before)) {
      if (!['buffers', 'bufferViews', 'images', 'textures', 'extensionsUsed', 'extensionsRequired'].includes(key)) {
        assert.deepEqual(after[key], before[key], `${entry.path}: ${key}`);
      }
    }
    const imageViews = new Set(before.images?.map(image => image.bufferView));
    assert.equal(after.bufferViews.length, before.bufferViews.length);
    for (const [index, view] of after.bufferViews.entries()) {
      if (imageViews.has(index)) continue;
      const extension = view.extensions?.EXT_meshopt_compression;
      let bytes;
      if (extension) {
        assert.equal(extension.filter ?? 'NONE', 'NONE');
        assert.ok(['ATTRIBUTES', 'INDICES'].includes(extension.mode));
        assert.equal(extension.count * extension.byteStride, view.byteLength);
        assert.ok(view.byteOffset + view.byteLength <= after.buffers[view.buffer].byteLength);
        bytes = Buffer.alloc(view.byteLength);
        MeshoptDecoder.decodeGltfBuffer(bytes, extension.count, extension.byteStride,
          bin.subarray(extension.byteOffset, extension.byteOffset + extension.byteLength), extension.mode);
      } else bytes = bin.subarray(view.byteOffset, view.byteOffset + view.byteLength);
      assert.ok(bytes.equals(views[index]), `${entry.path}: exact bufferView ${index}`);
      viewCount++;
    }
    for (const [index, image] of (before.images ?? []).entries()) {
      assert.ok(after.images[index].uri.startsWith('/media/'), 'Hashed local texture');
      const bytes = image.bufferView !== undefined ? views[image.bufferView]
        : await readFile(new URL(image.uri, new URL('../public/' + entry.path, import.meta.url)));
      await sameImage(bytes, after.images[index].uri, isDataImage(image.name ?? ''));
    }
    for (const [index, texture] of (before.textures ?? []).entries()) {
      const decoded = structuredClone(after.textures[index]);
      if (decoded.extensions?.EXT_texture_webp) {
        decoded.source = decoded.extensions.EXT_texture_webp.source;
        delete decoded.extensions.EXT_texture_webp;
        if (!Object.keys(decoded.extensions).length) delete decoded.extensions;
      }
      assert.deepEqual(decoded, texture, 'Texture and sampler contract');
    }
    modelCount++;
  }
}
const vercel = JSON.parse(await readFile('vercel.json'));
for (const directory of ['media', 'assets']) {
  assert.equal(vercel.headers.find(rule => rule.source === `/${directory}/:path*`)
    ?.headers.find(header => header.key === 'Cache-Control')?.value,
  'public, max-age=31536000, immutable');
}
console.log(JSON.stringify({ models: modelCount, exactBufferViews: viewCount, checkedImages: imageChecks.size, hashedFilesAndCacheRules: 'passed' }));
