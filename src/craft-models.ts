import * as T from "three";
import { GLTFLoader } from "./gltf-loader";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { seat } from "./geometry";

const families = [
  "tram", "tram_stop", "cycle_dock", "beach_set_0", "beach_set_1",
  "coastal_dune", "park_bench", "city_lantern", "flower_planter", "pot",
  "civic_fountain", "courtyard_fountain", "bistro_table", "cafe_counter",
  "cafe_awning", "jetty_board", "jetty_post_board", "bridge_board",
  "rice_clump", "pigeon", "cat",
];
const templates = new Map<string, T.Group>();

/** Keep the atlas and PBR finish while batching each rigid part into one draw. */
export async function loadCraftModels() {
  const loader = new GLTFLoader();
  const atlas = await new T.TextureLoader().loadAsync("/models/craft/craft-atlas.png").catch((cause) => {
    throw new Error("Cannot load the craft material atlas", { cause });
  });
  atlas.colorSpace = T.SRGBColorSpace;
  atlas.flipY = false;
  const opaque = new T.MeshStandardMaterial({ map: atlas, vertexColors: true, side: T.DoubleSide });
  opaque.shadowSide = T.DoubleSide;
  opaque.onBeforeCompile = (shader) => {
    shader.vertexShader = "attribute vec2 craftFinish; varying vec2 vCraftFinish;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvCraftFinish=craftFinish;");
    shader.fragmentShader = "varying vec2 vCraftFinish;\n" + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor=clamp(vCraftFinish.x,.12,1.);");
    shader.fragmentShader = shader.fragmentShader.replace("#include <metalnessmap_fragment>", "#include <metalnessmap_fragment>\nmetalnessFactor=clamp(vCraftFinish.y,0.,1.);");
  };
  opaque.customProgramCacheKey = () => "valencia-craft-finish-1";
  const glass = new T.MeshStandardMaterial({
    color: "#9fcac1", transparent: true, opacity: .22,
    roughness: .17, metalness: .04, depthWrite: false, side: T.DoubleSide,
  });
  await Promise.all(families.map(async (family) => {
    const { scene } = await loader.loadAsync(`/models/craft/${family}.glb`).catch((cause) => {
      throw new Error(`Cannot load crafted model: ${family}`, { cause });
    });
    scene.updateMatrixWorld(true);
    for (const source of scene.children) {
      const root = new T.Group();
      root.name = source.name;
      root.position.copy(source.position);
      root.quaternion.copy(source.quaternion);
      root.scale.copy(source.scale);
      const inverse = source.matrixWorld.clone().invert();
      const pieces: T.BufferGeometry[][] = [[], []];
      source.traverse((object) => {
        if (!(object instanceof T.Mesh)) return;
        const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
        geometry.applyMatrix4(inverse.clone().multiply(object.matrixWorld));
        const mats = Array.isArray(object.material) ? object.material : [object.material];
        const groups = geometry.groups.length ? geometry.groups : [{ start: 0, count: geometry.getAttribute("position").count, materialIndex: 0 }];
        for (const group of groups) {
          const material = mats[group.materialIndex ?? 0] as T.MeshStandardMaterial;
          const part = new T.BufferGeometry();
          for (const key of ["position", "normal", "uv"]) {
            const attr = geometry.getAttribute(key);
            if (!attr) continue;
            const data = new Float32Array(group.count * attr.itemSize);
            for (let i = 0; i < group.count; i++)
              for (let k = 0; k < attr.itemSize; k++) data[i * attr.itemSize + k] = attr.getComponent(group.start + i, k);
            part.setAttribute(key, new T.BufferAttribute(data, attr.itemSize));
          }
          const colors = new Float32Array(group.count * 3);
          const finish = new Float32Array(group.count * 2);
          for (let i = 0; i < group.count; i++) {
            // The packed atlas contains the base colour for every solid surface.
            colors.set([1, 1, 1], i * 3);
            finish.set([material.roughness, material.metalness], i * 2);
          }
          part.setAttribute("color", new T.BufferAttribute(colors, 3));
          part.setAttribute("craftFinish", new T.BufferAttribute(finish, 2));
          if (!part.getAttribute("uv")) part.setAttribute("uv", new T.BufferAttribute(new Float32Array(group.count * 2), 2));
          pieces[material.transparent || material.opacity < 1 ? 1 : 0].push(part);
        }
        geometry.dispose();
      });
      pieces.forEach((list, index) => {
        if (!list.length) return;
        const geometry = mergeGeometries(list);
        list.forEach((part) => part.dispose());
        const mesh = new T.Mesh(geometry, index ? glass : opaque);
        mesh.castShadow = !index;
        mesh.receiveShadow = true;
        root.add(mesh);
      });
      templates.set(source.name, root);
    }
    // Source textures are embedded for standalone Blender review. The game uses
    // the single external atlas instead of retaining a copy per asset family.
    const textures = new Set<T.Texture>();
    const materials = new Set<T.Material>();
    scene.traverse((object) => {
      if (!(object instanceof T.Mesh)) return;
      object.geometry.dispose();
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        materials.add(material);
        if ((material as T.MeshStandardMaterial).map) textures.add((material as T.MeshStandardMaterial).map!);
      }
    });
    materials.forEach((material) => material.dispose());
    textures.forEach((texture) => texture.dispose());
  }));
}

export function craftModel(name: string) {
  const source = templates.get(name);
  if (!source) throw new Error(`Missing crafted model: ${name}`);
  const root = new T.Group();
  root.name = name;
  root.position.copy(source.position);
  root.quaternion.copy(source.quaternion);
  root.scale.copy(source.scale);
  const lod = new T.LOD();
  for (const [variant, distance] of [[source, 0], [templates.get(name + "_lod"), 48]] as const) {
    if (!variant) continue;
    const mesh = variant.clone(true);
    mesh.position.set(0, 0, 0);
    mesh.quaternion.identity();
    mesh.scale.setScalar(1);
    lod.addLevel(mesh, distance, .12);
  }
  root.add(lod);
  return root;
}

export function placeCraft(parent: T.Object3D, name: string, x: number, z: number, height = 0, yaw = 0) {
  const model = craftModel(name);
  seat(model, x, z, height, yaw);
  parent.add(model);
  return model;
}

/** Crop clumps share geometry and one draw per field, at either detail level. */
export function placeCraftInstances(parent: T.Object3D, name: string, placements: { x: number; z: number; height: number; yaw: number }[]) {
  if (!placements.length) return;
  const root = new T.LOD();
  root.name = name + "-field";
  seat(root, placements[0].x, placements[0].z);
  root.updateMatrix();
  const inverse = root.matrix.clone().invert();
  const pose = new T.Object3D();
  for (const [key, distance] of [[name, 0], [name + "_lod", 40]] as const) {
    const source = templates.get(key);
    if (!source) throw new Error(`Missing crop model: ${key}`);
    const level = new T.Group();
    for (const part of source.children) {
      if (!(part instanceof T.Mesh)) continue;
      const mesh = new T.InstancedMesh(part.geometry, part.material, placements.length);
      placements.forEach((p, index) => {
        seat(pose, p.x, p.z, p.height, p.yaw);
        pose.updateMatrix();
        mesh.setMatrixAt(index, inverse.clone().multiply(pose.matrix));
      });
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      level.add(mesh);
    }
    root.addLevel(level, distance, .12);
  }
  parent.add(root);
}

/** Instance fixed props within small spatial groups. Animation roots stay separate. */
export function batchCraftModels(world: T.Object3D) {
  const fixed = new Set([
    "park_bench", "city_lantern", "flower_planter", "coastal_dune",
    "beach_set_0", "beach_set_1", "cycle_dock", "terracotta_pot",
    "jetty_board", "jetty_post_board", "bridge_board", "bistro_table",
  ]);
  const groups = new Map<string, T.Object3D[]>();
  world.traverse((object) => {
    if (!fixed.has(object.name) || !object.parent) return;
    // Template descendants have the same name; only placement roots contain LOD.
    if (!(object.children[0] instanceof T.LOD)) return;
    const p = object.position;
    const key = `${object.parent.uuid}:${object.name}:${Math.floor(p.x / 36)}:${Math.floor(p.y / 36)}:${Math.floor(p.z / 36)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(object);
  });
  for (const objects of groups.values()) {
    if (objects.length < 2) continue;
    const parent = objects[0].parent!;
    const name = objects[0].name;
    const center = objects.reduce((v, object) => v.add(object.position), new T.Vector3()).divideScalar(objects.length);
    const radius = Math.max(...objects.map((object) => object.position.distanceTo(center)));
    const inverse = new T.Matrix4().makeTranslation(-center.x, -center.y, -center.z);
    const matrices = objects.map((object) => {
      object.updateMatrix();
      return inverse.clone().multiply(object.matrix);
    });
    const batch = new T.LOD();
    batch.name = `craft-batch-${name}`;
    batch.position.copy(center);
    for (const [key, distance] of [[name, 0], [name + "_lod", 48 + radius]] as const) {
      const source = templates.get(key);
      if (!source) throw new Error(`Missing batch model: ${key}`);
      const level = new T.Group();
      for (const part of source.children) {
        if (!(part instanceof T.Mesh)) continue;
        const mesh = new T.InstancedMesh(part.geometry, part.material, matrices.length);
        matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
        mesh.castShadow = part.castShadow;
        mesh.receiveShadow = part.receiveShadow;
        mesh.computeBoundingSphere();
        level.add(mesh);
      }
      batch.addLevel(level, distance, .12);
    }
    parent.add(batch);
    objects.forEach((object) => parent.remove(object));
  }
}
