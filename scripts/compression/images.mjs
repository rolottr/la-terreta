import assert from 'node:assert/strict';
import sharp from 'sharp';

export const isDataImage = name => /normal|roughness|metallic|occlusion|height|mask|displacement/i.test(name);

/** Colour images can lose a little detail. Data textures must keep exact samples. */
export async function compressPng(source, { webp = true, lossy = false } = {}) {
  const metadata = await sharp(source).metadata();
  // Keep uncommon colour spaces, high bit depths and animation in their source format.
  if (metadata.depth !== 'uchar' || metadata.pages > 1 || metadata.space !== 'srgb') {
    return { bytes: source, extension: '.png', mimeType: 'image/png' };
  }
  const input = sharp(source).keepMetadata();
  const candidates = [{ bytes: source, extension: '.png', mimeType: 'image/png' }];
  candidates.push({ bytes: await input.clone().png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer(), extension: '.png', mimeType: 'image/png' });
  if (webp) candidates.push({ bytes: await input.clone().webp({ lossless: true, exact: true, effort: 6 }).toBuffer(), extension: '.webp', mimeType: 'image/webp' });
  if (webp && lossy) candidates.push({ bytes: await input.clone().webp({ quality: 82, alphaQuality: 100, effort: 6 }).toBuffer(), extension: '.webp', mimeType: 'image/webp', lossy: true });
  candidates.sort((a, b) => a.bytes.length - b.bytes.length);
  const original = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (const candidate of candidates) {
    const outputMetadata = await sharp(candidate.bytes).metadata();
    if (metadata.icc && !metadata.icc.equals(outputMetadata.icc ?? Buffer.alloc(0))) continue;
    const decoded = await sharp(candidate.bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.deepEqual(decoded.info, original.info, 'Image dimensions and channels');
    if (candidate.lossy) {
      // Keep alpha exact and reject a large colour error. Fall back to lossless.
      if (imageError(original.data, decoded.data) <= 8) return candidate;
    } else if (decoded.data.equals(original.data)) return candidate;
  }
  throw new Error('No image candidate preserves the source pixels');
}

/** Visible RGB root-mean-square error in 8-bit units; alpha changes always fail. */
export function imageError(before, after) {
  assert.equal(after.length, before.length);
  let squared = 0, weight = 0;
  for (let i = 0; i < before.length; i += 4) {
    if (before[i + 3] !== after[i + 3]) return Infinity;
    const alpha = before[i + 3] / 255;
    for (let c = 0; c < 3; c++) squared += ((before[i + c] - after[i + c]) * alpha) ** 2;
    weight += 3 * alpha * alpha;
  }
  return Math.sqrt(squared / Math.max(1, weight));
}
