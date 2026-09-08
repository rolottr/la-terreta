import { GLTFLoader as ThreeGLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import type { LoadingManager } from 'three';
import { assetUrl } from './public-assets';

/** One decoder shared by all model loaders. Geometry stays at its source precision. */
export class GLTFLoader extends ThreeGLTFLoader {
  constructor(manager?: LoadingManager) {
    super(manager);
    this.setMeshoptDecoder(MeshoptDecoder);
  }

  override load(...args: Parameters<ThreeGLTFLoader['load']>) {
    const [url, ...callbacks] = args;
    // Three.js resolves root-relative texture URIs correctly against an absolute base.
    const resolved = assetUrl(url);
    return super.load(typeof location === 'undefined' ? resolved : new URL(resolved, location.href).href, ...callbacks);
  }
}
