import * as T from "three";
import { GLTFLoader } from "./gltf-loader";

const templates = new Map<string, T.Group>();
/** Load once; all placed copies share GPU geometry and materials. */
export async function loadCraftedProps() {
  await Promise.all(["park-bench", "firecracker"].map(async name => {
    const { scene } = await new GLTFLoader().loadAsync(`/models/${name}.glb`);
    scene.traverse(object => {
      if (object instanceof T.Mesh) {
        // Tiny paper charges keep the original shadow-free effect cost.
        object.castShadow = object.receiveShadow = name === "park-bench";
      }
    });
    templates.set(name, scene);
  }));
}
export function createCraftedProp(name: "park-bench" | "firecracker") {
  const template = templates.get(name);
  if (!template) throw new Error(`Crafted prop is not loaded: ${name}`);
  const copy = template.clone(true);
  copy.name = name;
  return copy;
}
