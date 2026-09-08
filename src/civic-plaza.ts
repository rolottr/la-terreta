import * as T from "three";
import { GLTFLoader } from "./gltf-loader";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { R, places } from "./data";
import { seat } from "./geometry";
import { createCraftedProp } from "./crafted-props";
import { localOffset, offset } from "./navigation";
import { groundPatch, pathMesh } from "./terrain";
import type { World, Collider } from "./world";

const townhall = places[2];
const at = (east: number, south: number) => offset(townhall.x, townhall.z, east, south);
export const civicFallaCenter = at(0, -9);
export const fieldFallaCenter = offset(70, 103, -11, 0);
export const civicChildSpots = [at(7, -8), at(8, -12), at(7, -13)];

/** Reserve the complete civic frontage and the open routes between both buildings. */
export function isCivicPlaza(x: number, z: number, margin = 0) {
  const p = localOffset(x, z, townhall.x, townhall.z);
  return p.depth > -15 && Math.abs(p.x) < 20 + margin && p.z > -28 - margin && p.z < 9 + margin;
}

/** Reference-built civic landmarks, on the same curved ground as the player. */
export class CivicPlaza {
  readonly group = new T.Group();
  readonly colliders: Collider[] = [
    // GLB ground/body bounds: rear -3.79, centre portal +3.78. The +5.575
    // front bound is the balcony above head height; its four columns stay separate.
    { ...at(0, 4), w: 14.2, d: 3.8 },
    ...[-4.1, 4.1].map((east) => ({ ...at(east, 2.98), w: 1.6, d: 3.25 })),
    ...[-9.9, 9.9].map((east) => ({ ...at(east, .2), w: 4.3, d: .2 })),
    { ...at(0, -23), w: 13.2, d: 4.4 },
    ...[-1.75, -.73, .73, 1.75].map((east) => ({ ...at(east, -.9), w: .32, d: .32, radius: .32 })),
    { ...civicFallaCenter, w: 4.7, d: 4.7, radius: 4.7 },
    { ...fieldFallaCenter, w: 4.2, d: 4.2, radius: 4.2 },
  ];
  private loaded = false;

  constructor(private readonly world: World) {
    this.group.name = "Civic plaza";
    world.group.add(this.group);
    world.colliders.push(...this.colliders);
    this.group.add(groundPatch(fieldFallaCenter.x, fieldFallaCenter.z, 13, 13, "#d5c9b1", .17, true));
    this.group.add(pathMesh({ x: 70, z: 103 }, offset(fieldFallaCenter.x, fieldFallaCenter.z, 5.3, 0), 2.6, "#d5c9b1", .18));
    const center = at(0, -9.5);
    this.group.add(groundPatch(center.x, center.z, 39, 26, "#d5c9b1", .17, true));
    this.group.add(groundPatch(center.x, center.z, 35.5, 22, "#e7dcc8", .18, true));
    // Stone bands keep the large pedestrian space readable without blocking it.
    for (const east of [-17, -12, 12, 17]) {
      this.group.add(pathMesh(at(east, -19), at(east, -1), .16, "#bdab91", .192));
    }
    for (const south of [-18.2, -15.5, -2.5]) {
      this.group.add(pathMesh(at(-18, south), at(18, south), .14, "#bdab91", .193));
    }
    // Seats stay on the outer edges, leaving more than six metres beside the Falla.
    for (const east of [-17, 17]) {
      for (const south of [-13.5, -6]) {
        const p = at(east, south);
        const bench = createCraftedProp("park-bench");
        bench.scale.x = 1.1;
        seat(bench, p.x, p.z, .19, east < 0 ? Math.PI / 2 : -Math.PI / 2);
        this.group.add(bench);
        const collider = { ...p, w: .45, d: 1.2 };
        this.colliders.push(collider);
        world.colliders.push(collider);
      }
    }
  }

  async load() {
    if (this.loaded) return;
    const loader = new GLTFLoader();
    const [{ scene }, { scene: craftedFalla }, { scene: astraFalla }] = await Promise.all([
      loader.loadAsync("/models/civic-plaza.glb"),
      loader.loadAsync("/models/falla-crafted.glb"),
      loader.loadAsync("/models/astra-falla.glb"),
    ]);
    craftedFalla.updateMatrixWorld(true);
    scene.updateMatrixWorld(true);
    astraFalla.updateMatrixWorld(true);
    const material = new T.MeshStandardMaterial({ vertexColors: true, roughness: .78 });
    for (const [name, sourceScene, sourceName, p, yaw, preserveMaterials] of [
      ["Ayuntamiento", scene, "Ayuntamiento", at(0, 4), Math.PI, false],
      ["Correos", scene, "Correos", at(0, -23), 0, false],
      ["Falla", astraFalla, "FallaAstra", civicFallaCenter, Math.PI / 2, true],
      ["Falla-fields", craftedFalla, "Falla", fieldFallaCenter, Math.PI / 2, false],
    ] as const) {
      const source = sourceScene.getObjectByName(sourceName);
      if (!source) throw new Error(`Civic landmark is missing: ${name}`);
      const parts: T.BufferGeometry[] = [];
      const materials: T.Material[] = [];
      source.traverse((object) => {
        if (!(object instanceof T.Mesh)) return;
        const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
        geometry.applyMatrix4(object.matrixWorld);
        const positions = geometry.getAttribute("position");
        const color = (object.material as T.MeshStandardMaterial).color;
        if (preserveMaterials) materials.push((object.material as T.Material).clone());
        const colors = preserveMaterials ? null : new Float32Array(positions.count * 3);
        for (let i = 0; i < positions.count; i++) {
          if (colors) color.toArray(colors, i * 3);
          // Only the lowest stone courses follow the sphere. Towers stay vertical.
          const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
          const weight = Math.max(0, 1 - Math.max(0, y) / 2.0);
          positions.setY(i, y - (x * x + z * z) / (2 * R) * weight);
        }
        for (const key of Object.keys(geometry.attributes)) {
          if (key !== "position" && key !== "normal") geometry.deleteAttribute(key);
        }
        if (colors) geometry.setAttribute("color", new T.BufferAttribute(colors, 3));
        parts.push(geometry);
      });
      const geometry = mergeGeometries(parts, preserveMaterials);
      parts.forEach((part) => part.dispose());
      geometry.computeBoundingSphere();
      const mesh = new T.Mesh(geometry, preserveMaterials ? materials : material);
      mesh.name = `landmark-${name.toLowerCase()}`;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      seat(mesh, p.x, p.z, .19, yaw);
      this.group.add(mesh);
    }
    for (const sourceScene of [scene, craftedFalla, astraFalla]) sourceScene.traverse((object) => {
      if (!(object instanceof T.Mesh)) return;
      object.geometry.dispose();
      for (const mat of Array.isArray(object.material) ? object.material : [object.material]) mat.dispose();
    });
    this.loaded = true;
  }
}
