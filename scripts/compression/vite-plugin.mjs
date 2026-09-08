import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { brotliSize, hash, packGlb } from './glb.mjs';
import { compressPng, isDataImage } from './images.mjs';

async function filesIn(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesIn(file));
    else if (entry.isFile()) files.push(file);
  }
  return files.sort();
}

/** Build-time work only. Vercel needs Node, with no Blender, Python or external API. */
export function compressedPublicAssets() {
  let config, urls = {}, report = [];
  const imageCache = new Map();
  const emitted = new Set();
  return {
    name: 'compressed-public-assets',
    configResolved(value) { config = value; },
    transform(code, id) {
      if (config.command === 'build' && id === path.resolve(config.root, 'src/public-assets.ts')) {
        return { code: `const urls = ${JSON.stringify(urls)}; export function assetUrl(url) { return urls[url] ?? url; }`, map: null };
      }
    },
    async buildStart() {
      if (config.command !== 'build') return;
      urls = {}; report = []; emitted.clear(); imageCache.clear();
      const emit = (bytes, name, extension) => {
        const fileName = `media/${name}-${hash(bytes).slice(0, 20)}${extension}`;
        if (!emitted.has(fileName)) {
          this.emitFile({ type: 'asset', fileName, source: bytes });
          emitted.add(fileName);
        }
        return `${config.base}${fileName}`;
      };
      const image = async (bytes, lossy) => {
        const key = hash(bytes) + ':' + lossy;
        if (!imageCache.has(key)) {
          imageCache.set(key, compressPng(bytes, { lossy }).then(result => ({
            ...result, uri: emit(result.bytes, 'image', result.extension),
          })));
        }
        return imageCache.get(key);
      };
      const files = await filesIn(config.publicDir);
      // Images are emitted first so models can refer to one shared copy of each atlas.
      for (const file of files.filter(file => !file.endsWith('.glb'))) {
        const relative = path.relative(config.publicDir, file).split(path.sep).join('/');
        const before = await readFile(file);
        let bytes = before, url;
        const stable = !relative.includes('/') || relative.startsWith('licenses/');
        if (file.endsWith('.png')) {
          if (stable) bytes = (await compressPng(before, { webp: false })).bytes;
          else { const result = await image(before, !isDataImage(relative)); bytes = result.bytes; url = result.uri; }
        }
        if (stable) this.emitFile({ type: 'asset', fileName: relative, source: bytes });
        else url ??= emit(bytes, path.basename(relative, path.extname(relative)), path.extname(relative));
        if (url) urls['/' + relative] = url;
        report.push({ path: relative, before: before.length, after: bytes.length, url: url ?? `${config.base}${relative}` });
      }
      for (const file of files.filter(file => file.endsWith('.glb'))) {
        const relative = path.relative(config.publicDir, file).split(path.sep).join('/');
        const before = await readFile(file);
        const imageReplacement = async (bytes, mimeType, definition) => {
          if (mimeType !== 'image/png') return null;
          return image(bytes, !isDataImage(definition.name ?? ''));
        };
        const resolveImage = uri => {
          if (uri.startsWith('data:')) return { uri };
          const source = path.posix.resolve('/', path.posix.dirname(relative), uri);
          if (!urls[source]) throw new Error(`Missing model texture: ${source}`);
          return { uri: urls[source], mimeType: urls[source].endsWith('.webp') ? 'image/webp' : 'image/png' };
        };
        const packed = await packGlb(before, { image: imageReplacement, resolveImage });
        const plain = await packGlb(before, { meshopt: false, image: imageReplacement, resolveImage });
        // Compare complete files too: a smaller GLB must also save HTTP transfer bytes.
        const compressedBr = brotliSize(packed.bytes), plainBr = brotliSize(plain.bytes);
        const chosen = packed.bytes.length < plain.bytes.length && compressedBr < plainBr ? packed : plain;
        // External source image paths must survive the hashed model filename.
        const jsonLength = chosen.bytes.readUInt32LE(12);
        const doc = JSON.parse(chosen.bytes.subarray(20, 20 + jsonLength));
        for (const entry of doc.images ?? []) {
          if (entry.uri && !entry.uri.startsWith('/') && !entry.uri.startsWith('data:')) {
            throw new Error(`Unresolved model image: ${relative}: ${entry.uri}`);
          }
        }
        const url = emit(chosen.bytes, path.basename(relative, '.glb'), '.glb');
        urls['/' + relative] = url;
        report.push({ path: relative, before: before.length, after: chosen.bytes.length,
          brotliBefore: brotliSize(before), brotliAfter: Math.min(compressedBr, plainBr),
          compressedViews: chosen.compressedViews, url });
      }
      this.info(`Public assets: ${(report.reduce((n, r) => n + r.before, 0) / 1e6).toFixed(2)} MB input; compression complete.`);
    },
    async writeBundle() {
      if (config.command !== 'build') return;
      const output = path.resolve(config.root, 'output/compression');
      await mkdir(output, { recursive: true });
      await writeFile(path.join(output, 'build-report.json'), JSON.stringify(report, null, 2) + '\n');
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = new URL(req.url, 'http://localhost').pathname;
        res.setHeader('Cache-Control', /^\/(media|assets)\//.test(pathname)
          ? 'public, max-age=31536000, immutable'
          : 'public, max-age=0, must-revalidate');
        next();
      });
    },
  };
}
