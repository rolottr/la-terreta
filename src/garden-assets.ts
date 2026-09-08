import * as T from "three";
import { GLTFLoader } from "./gltf-loader";

export type FlowerKind = "daisy" | "cosmos" | "lavender";
type GardenModel = "cat" | "pigeon" | "planter" | FlowerKind;
const templates = new Map<GardenModel, T.Group>();

/** Blender exports share geometry and materials between all game instances. */
export async function loadGardenAssets() {
  const loader = new GLTFLoader();
  await Promise.all((["cat", "pigeon", "daisy", "cosmos", "lavender", "planter"] as const).map(async name => {
    const { scene } = await loader.loadAsync(`/models/garden/${name}.glb`);
    scene.traverse(object => {
      if (object instanceof T.Mesh) object.castShadow = object.receiveShadow = true;
    });
    templates.set(name, scene);
  }));
}

export function createGardenAnimal(name: "cat" | "pigeon") {
  const source = templates.get(name);
  if (!source) throw new Error(`Garden model is not loaded: ${name}`);
  const animal = source.clone(true);
  animal.name = name === "cat" ? "Courtyard cat" : "City pigeon";
  animal.userData.asset = `/models/garden/${name}.glb`;
  return animal;
}

export function gardenGeometry(kind: FlowerKind | "planter") {
  const source = templates.get(kind);
  if (!source) throw new Error(`Garden model is not loaded: ${kind}`);
  let flower: T.Mesh | undefined;
  source.updateMatrixWorld(true);
  source.traverse(object => { if (object instanceof T.Mesh) flower = object; });
  if (!flower) throw new Error(`Missing flower mesh: ${kind}`);
  // Bake the glTF axis conversion once, then reuse this geometry for instancing.
  const geometry = flower.geometry.clone().applyMatrix4(flower.matrixWorld);
  return { geometry, material: flower.material };
}

/** Walking phase follows metres travelled, so paws stop when the cat stops. */
export function animateCat(cat: T.Group, time: number, travelled: number, speed: number) {
  const phase = travelled / .72 * Math.PI * 2;
  const stride = T.MathUtils.smoothstep(speed, .03, .8);
  for (const [name, shift] of [["Front_L", 0], ["Back_R", 0], ["Front_R", Math.PI], ["Back_L", Math.PI]] as const) {
    const leg = cat.getObjectByName(`Cat_${name}`)!;
    const swing = Math.sin(phase + shift);
    const angle = swing * .43 * stride;
    leg.rotation.x = angle;
    // Match the Blender paw ellipsoid. Rotation must not lift the planted sole.
    const sole = -.310 * Math.cos(angle) - .060 * Math.sin(angle)
      - Math.hypot(.043 * Math.cos(angle), .077 * Math.sin(angle));
    leg.position.y = .002 - sole + Math.max(0, -Math.cos(phase + shift)) * .05 * stride;
  }
  cat.getObjectByName("Cat_Head")!.rotation.y = Math.sin(time * .7) * .09;
  cat.getObjectByName("Cat_Head")!.rotation.x = Math.sin(phase * 2) * .025 * stride;
  cat.getObjectByName("Cat_Tail")!.rotation.z = Math.sin(time * 1.5) * .11;
  cat.getObjectByName("Cat_Tail")!.rotation.x = Math.sin(time * .9) * .055;
  for (const side of ["L", "R"]) {
    const ear = cat.getObjectByName(`Cat_Ear_${side}`)!;
    const twitch = (time + (side === "L" ? 0 : 2.1)) % 6;
    ear.rotation.z = twitch < .28 ? Math.sin(twitch / .28 * Math.PI) * .16 : 0;
  }
  cat.userData.animation = stride > .01 ? "Walk" : "Idle";
  cat.userData.travelled = travelled;
}
