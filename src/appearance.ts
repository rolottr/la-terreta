import * as T from "three";

export interface Appearance {
  skin: string;
  eyes: string;
  hairstyle: "swept" | "crop" | "full";
  freckles: boolean;
  hat: boolean;
  hair: string;
  shirt: string;
  vest: string;
  trousers: string;
  scarf: string;
  face: "soft" | "oval" | "wide";
  glasses: boolean;
}
export const defaultAppearance = (): Appearance => ({
  eyes: "#644b31", hairstyle: "swept", freckles: false, hat: true,
  skin: "#c68e64", hair: "#39281e", shirt: "#e9dfc8", vest: "#286488",
  trousers: "#425f60", scarf: "#b65f43", face: "soft", glasses: false,
});
export function normalizeAppearance(value: unknown): Appearance {
  const result = defaultAppearance();
  if (!value || typeof value !== "object") return result;
  const input = value as Record<string, unknown>;
  for (const key of ["skin", "hair", "shirt", "vest", "trousers", "scarf", "eyes"] as const) {
    if (typeof input[key] === "string" && /^#[0-9a-f]{6}$/i.test(input[key])) result[key] = input[key].toLowerCase();
  }
  if (input.face === "oval" || input.face === "wide") result.face = input.face;
  if (input.hairstyle === "crop" || input.hairstyle === "full") result.hairstyle = input.hairstyle;
  result.hat = input.hat !== false;
  result.freckles = input.freckles === true;
  result.glasses = input.glasses === true;
  return result;
}

type ColorKey = "skin" | "hair" | "shirt" | "vest" | "trousers" | "scarf" | "eyes";
interface OriginalMesh { position: Float32Array; color: Float32Array; channels: Int8Array; tint: Float32Array; morphs: Float32Array[]; }
const originalMeshes = new WeakMap<T.BufferGeometry, OriginalMesh>();
const colorKeys: ColorKey[] = ["skin", "hair", "shirt", "vest", "trousers", "scarf", "eyes"];

/** Clone only the player's geometry. The shared residents and source library stay intact. */
export function applyAppearance(person: T.Group, input: Appearance) {
  const appearance = normalizeAppearance(input);
  const female = person.userData.character === "hero_female";
  const palette = { ...defaultAppearance(), ...(female ? { skin: "#c7946c", hair: "#68412c" } : {}) };
  const baseColors = colorKeys.map(key => new T.Color(palette[key]));
  const colors = colorKeys.map(key => new T.Color(appearance[key]));
  const faceWidth = appearance.face === "wide" ? 1.14 : appearance.face === "oval" ? .9 : 1;
  const faceHeight = appearance.face === "oval" ? 1.06 : appearance.face === "wide" ? .97 : 1;
  person.traverse(object => {
    if (!(object instanceof T.SkinnedMesh)) return;
    if (!object.geometry.userData.appearanceOwned) {
      object.geometry = object.geometry.clone();
      object.geometry.userData = { ...object.geometry.userData, appearanceOwned: true };
    }
    const geometry = object.geometry;
    const position = geometry.getAttribute("position"), color = geometry.getAttribute("color");
    if (!color) return;
    let original = originalMeshes.get(geometry);
    if (!original) {
      const channels = new Int8Array(position.count).fill(-1), tint = new Float32Array(position.count);
      for (let i = 0; i < position.count; i++) {
        const r = color.getX(i), g = color.getY(i), b = color.getZ(i);
        for (let k = 0; k < baseColors.length; k++) {
          const base = baseColors[k];
          const factor = (r * base.r + g * base.g + b * base.b) / (base.r ** 2 + base.g ** 2 + base.b ** 2);
          // Exported colors are linear, including the hand-authored shade variants.
          if (factor < .38 || factor > 1.45) continue;
          if (Math.max(Math.abs(r - base.r * factor), Math.abs(g - base.g * factor), Math.abs(b - base.b * factor)) > .0005) continue;
          channels[i] = k; tint[i] = factor; break;
        }
      }
      original = { position: Float32Array.from(position.array), color: Float32Array.from(color.array), channels, tint,
        morphs: (geometry.morphAttributes.position ?? []).map((attribute: T.BufferAttribute) => Float32Array.from(attribute.array)) };
      originalMeshes.set(geometry, original);
    }
    for (let i = 0; i < position.count; i++) {
      const k = original.channels[i];
      if (k >= 0) { const c = colors[k], f = original.tint[i]; color.setXYZ(i, c.r * f, c.g * f, c.b * f); }
      const x = original.position[i * 3], y = original.position[i * 3 + 1], z = original.position[i * 3 + 2];
      const blend = T.MathUtils.smoothstep(y, 1.45, 1.54);
      position.setXYZ(i, x * T.MathUtils.lerp(1, faceWidth, blend), y + (y - 1.64) * (faceHeight - 1) * blend, z);
      if (k === 1 && y > 1.58) {
        const volume = appearance.hairstyle === "crop" ? .92 : appearance.hairstyle === "full" ? 1.4 : 1;
        const crownBlend = T.MathUtils.smoothstep(y, 1.58, 1.76);
        position.setY(i, position.getY(i) + Math.max(0, y-1.66)*(volume-1)*crownBlend);
        position.setX(i, position.getX(i) * (1 + (appearance.hairstyle === "full" ? .08 : 0) * crownBlend));
      }
      const braid = female && k === 1 && x < -.06 && y > 1.18 && y < 1.60 && z > .015;
      const braidTie = female && k < 0 && x > -.126 && x < -.084 && y > 1.19 && y < 1.235 && z > .084 && z < .125;
      if (appearance.hairstyle === "crop" && (braid || braidTie)) position.setXYZ(i,0,1.64,0);
      // The male hat has its own colors above the crown. Fold its vertices inside
      // the head when hidden; the shared library and the hair remain intact.
      if(!female && !appearance.hat && k < 0 && y > 1.77) position.setXYZ(i,0,1.70,0);
      // Keep the Blink morph in the same face space.
      for (let m = 0; m < original.morphs.length; m++) {
        const source = original.morphs[m], target = geometry.morphAttributes.position[m];
        if (geometry.morphTargetsRelative) target.setXYZ(i, source[i * 3] * T.MathUtils.lerp(1, faceWidth, blend), source[i * 3 + 1] * T.MathUtils.lerp(1, faceHeight, blend), source[i * 3 + 2]);
        else target.setXYZ(i, source[i * 3] * T.MathUtils.lerp(1, faceWidth, blend), source[i * 3 + 1] + (source[i * 3 + 1] - 1.64) * (faceHeight - 1) * blend, source[i * 3 + 2]);
      }
    }
    position.needsUpdate = color.needsUpdate = true;
    for (const attribute of geometry.morphAttributes.position ?? []) attribute.needsUpdate = true;
    geometry.computeVertexNormals();
  });
  let glasses = person.getObjectByName("explorer-glasses");
  if (!glasses && appearance.glasses) {
    glasses = createGlasses();
    const head = person.getObjectByName(`${person.userData.character}_Head`);
    if (head) {
      // The inverse bind matrix maps the authored face space into this bone.
      let skin: T.SkinnedMesh | undefined;
      person.traverse(object => { if (!skin && object instanceof T.SkinnedMesh) skin = object; });
      const index = skin?.skeleton.bones.indexOf(head as T.Bone) ?? -1;
      if (skin && index >= 0) {
        glasses.applyMatrix4(skin.skeleton.boneInverses[index]);
        head.add(glasses);
      }
    }
  }
  if (glasses) { glasses.visible = appearance.glasses; glasses.scale.x = faceWidth; }
  let freckles = person.getObjectByName("explorer-freckles");
  if (!freckles && appearance.freckles) {
    freckles = new T.Group(); freckles.name = "explorer-freckles";
    const material = new T.MeshStandardMaterial({ color: "#8c583d", roughness: 1 }); material.userData.appearanceOwned = true;
    for (const side of [-1,1]) for (let i=0;i<5;i++) {
      const geometry = new T.SphereGeometry(.0018,5,4); geometry.userData.appearanceOwned = true;
      const dot = new T.Mesh(geometry,material); const x=.035+i*.01;
      dot.position.set(side*x,1.622-(i%2)*.008,.095-i*.0025); freckles.add(dot);
    }
    const head = person.getObjectByName(`${person.userData.character}_Head`);
    let skin: T.SkinnedMesh | undefined; person.traverse(o=>{if(!skin&&o instanceof T.SkinnedMesh)skin=o;});
    const index=skin?.skeleton.bones.indexOf(head as T.Bone)??-1;
    if(head&&skin&&index>=0){freckles.applyMatrix4(skin.skeleton.boneInverses[index]);head.add(freckles);}
  }
  if(freckles){freckles.visible=appearance.freckles;freckles.scale.x=faceWidth;}
  person.userData.appearance = appearance;
}
function createGlasses() {
  const group = new T.Group(); group.name = "explorer-glasses";
  const material = new T.MeshStandardMaterial({ color: "#5a4331", metalness: .35, roughness: .4 });
  material.userData.appearanceOwned = true;
  for (const x of [-.05, .05]) {
    const geometry = new T.TorusGeometry(.033, .0035, 6, 32); geometry.userData.appearanceOwned = true;
    const rim = new T.Mesh(geometry, material); rim.position.set(x, 1.653, .113); rim.scale.y = .8; group.add(rim);
  }
  for (const points of [[[ -.017, 1.658, .114 ], [ .017, 1.658, .114 ]], [[-.084,1.66,.11],[-.125,1.66,-.01]], [[.084,1.66,.11],[.125,1.66,-.01]]]) {
    const curve = new T.LineCurve3(new T.Vector3(...points[0]), new T.Vector3(...points[1]));
    const geometry = new T.TubeGeometry(curve, 1, .003, 5, false); geometry.userData.appearanceOwned = true;
    group.add(new T.Mesh(geometry, material));
  }
  return group;
}

/** Release only resources made by appearance editing, never the shared GLB. */
export function disposeAppearance(person: T.Group) {
  const geometries = new Set<T.BufferGeometry>(), materials = new Set<T.Material>();
  person.traverse(object => {
    if (!(object instanceof T.Mesh)) return;
    if (object.geometry.userData.appearanceOwned) geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (material.userData.appearanceOwned) materials.add(material);
    }
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
}
