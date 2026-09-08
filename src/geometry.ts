import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { R } from "./data";
import { surface } from "./surface";
export const UP = new T.Vector3(0, 1, 0);
export function point(x: number, z: number, h = 0) {
  const a = x / R,
    b = z / R,
    r = R + h;
  return new T.Vector3(
    Math.sin(a) * Math.cos(b) * r,
    Math.cos(a) * Math.cos(b) * r,
    Math.sin(b) * r,
  );
}
export function basis(x: number, z: number) {
  const a = x / R,
    b = z / R;
  return {
    east: new T.Vector3(Math.cos(a), -Math.sin(a), 0),
    up: point(x, z).normalize(),
    south: new T.Vector3(
      -Math.sin(a) * Math.sin(b),
      -Math.cos(a) * Math.sin(b),
      Math.cos(b),
    ),
  };
}
export function seat(o: T.Object3D, x: number, z: number, h = 0, yaw = 0) {
  const b = basis(x, z);
  o.position.copy(point(x, z, h));
  o.quaternion.setFromRotationMatrix(
    new T.Matrix4().makeBasis(b.east, b.up, b.south),
  );
  o.rotateY(yaw);
}
const ramp = new T.DataTexture(
  new Uint8Array([108, 172, 215, 255]),
  4,
  1,
  T.RedFormat,
);
ramp.minFilter = T.NearestFilter;
ramp.magFilter = T.NearestFilter;
ramp.needsUpdate = true;
export const toon = new T.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.85,
});
export const solid = (color: string) =>
  new T.MeshStandardMaterial({ color, roughness: 0.85 });
const pave = (color: string) => surface(solid(color), "paving");
const boxGeo = new T.BoxGeometry(1, 1, 1);
const sphereGeo = new T.IcosahedronGeometry(1, 1);
const cylinderGeo = new T.CylinderGeometry(1, 1, 1, 8);
const coneGeo = new T.ConeGeometry(1, 1, 8);
export class Builder {
  pieces: T.BufferGeometry[] = [];
  matrix = new T.Matrix4();
  constructor(
    public x = 0,
    public z = 0,
    public yaw = 0,
  ) {
    const o = new T.Object3D();
    seat(o, x, z, 0, yaw);
    o.updateMatrix();
    this.matrix.copy(o.matrix);
  }
  add(
    geometry: T.BufferGeometry,
    color: string,
    xyz: number[],
    scale: number[],
    rot: number[] = [],
  ) {
    const o = new T.Object3D();
    o.position.set(xyz[0], xyz[1], xyz[2]);
    o.scale.set(scale[0], scale[1], scale[2]);
    o.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
    o.updateMatrix();
    let g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    g.applyMatrix4(this.matrix.clone().multiply(o.matrix));
    g.deleteAttribute("uv");
    const co = new T.Color(color);
    const n = g.getAttribute("position").count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      col[i * 3] = co.r;
      col[i * 3 + 1] = co.g;
      col[i * 3 + 2] = co.b;
    }
    g.setAttribute("color", new T.BufferAttribute(col, 3));
    this.pieces.push(g);
  }
  box(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    c: string,
    ry = 0,
  ) {
    this.add(boxGeo, c, [x, y, z], [w, h, d], [0, ry, 0]);
  }
  ball(
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    c: string,
  ) {
    this.add(sphereGeo, c, [x, y, z], [sx, sy, sz]);
  }
  cylinder(
    x: number,
    y: number,
    z: number,
    r: number,
    h: number,
    c: string,
    rx = 0,
  ) {
    this.add(cylinderGeo, c, [x, y, z], [r, h, r], [rx, 0, 0]);
  }
  cone(x: number, y: number, z: number, r: number, h: number, c: string) {
    this.add(coneGeo, c, [x, y, z], [r, h, r]);
  }
  beam(a: T.Vector3, b: T.Vector3, r: number, c: string) {
    const o = new T.Object3D();
    o.position.copy(a).add(b).multiplyScalar(0.5);
    o.quaternion.setFromUnitVectors(UP, b.clone().sub(a).normalize());
    o.scale.set(r, a.distanceTo(b), r);
    o.updateMatrix();
    const g = cylinderGeo.toNonIndexed();
    g.applyMatrix4(this.matrix.clone().multiply(o.matrix));
    g.deleteAttribute("uv");
    const co = new T.Color(c);
    const cols = new Float32Array(g.getAttribute("position").count * 3);
    for (let i = 0; i < cols.length; i += 3) {
      cols[i] = co.r;
      cols[i + 1] = co.g;
      cols[i + 2] = co.b;
    }
    g.setAttribute("color", new T.BufferAttribute(cols, 3));
    this.pieces.push(g);
  }
  finish(parent: T.Object3D, shadow = true) {
    if (!this.pieces.length) return;
    const geom = mergeGeometries(this.pieces);
    const m = new T.Mesh(geom, toon);
    m.castShadow = shadow;
    m.receiveShadow = true;
    parent.add(m);
    this.pieces.forEach((g) => g.dispose());
    this.pieces = [];
    return m;
  }
}
export function ribbon(
  x0: number,
  x1: number,
  z: number,
  width: number,
  color: string,
  h = 0.04,
) {
  const pts: number[] = [],
    normals: number[] = [],
    indices: number[] = [];
  const steps = Math.ceil((x1 - x0) / 1.5),
    across = Math.max(1, Math.ceil(width / 1.5));
  for (let i = 0; i <= steps; i++) {
    const x = x0 + ((x1 - x0) * i) / steps;
    for (let j = 0; j <= across; j++) {
      const p = point(x, z - width / 2 + (width * j) / across, h);
      pts.push(...p.toArray());
      normals.push(...p.clone().normalize().toArray());
      if (i < steps && j < across) {
        const a = i * (across + 1) + j;
        indices.push(
          a,
          a + 1,
          a + across + 1,
          a + 1,
          a + across + 2,
          a + across + 1,
        );
      }
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(pts, 3));
  g.setAttribute("normal", new T.Float32BufferAttribute(normals, 3));
  g.setIndex(indices);
  const m = new T.Mesh(
    g,
    ["#d6c8aa", "#d8c99a"].includes(color) ? pave(color) : solid(color),
  );
  m.receiveShadow = true;
  m.userData.walkable = true;
  return m;
}
export function patch(
  x: number,
  z: number,
  w: number,
  d: number,
  c: string,
  h = 0.05,
) {
  const pts: number[] = [];
  const norm: number[] = [];
  const ix: number[] = [];
  const nx = Math.ceil(w / 2),
    nz = Math.ceil(d / 2);
  for (let j = 0; j <= nz; j++)
    for (let i = 0; i <= nx; i++) {
      const p = point(x - w / 2 + (w * i) / nx, z - d / 2 + (d * j) / nz, h);
      pts.push(...p.toArray());
      norm.push(...p.clone().normalize().toArray());
      if (i < nx && j < nz) {
        const a = j * (nx + 1) + i;
        ix.push(a, a + nx + 1, a + 1, a + 1, a + nx + 1, a + nx + 2);
      }
    }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(pts, 3));
  g.setAttribute("normal", new T.Float32BufferAttribute(norm, 3));
  g.setIndex(ix);
  const m = new T.Mesh(
    g,
    ["#ddceb0", "#e5d6b7", "#d8c9a2"].includes(c) ? pave(c) : solid(c),
  );
  m.receiveShadow = true;
  m.userData.walkable = true;
  return m;
}
export function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function updateLabel(mesh: T.Mesh<T.PlaneGeometry, T.MeshBasicMaterial>, text: string, color = "#325b58") {
  const texture = mesh.material.map as T.CanvasTexture;
  const canvas = texture.image as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff5df";
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = color;
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, 502, 118);
  ctx.fillStyle = color;
  ctx.font = '600 37px "DM Sans", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 256, 68, 465);
  texture.needsUpdate = true;
}
export function label(text: string, color = "#325b58", width = 5) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const tex = new T.CanvasTexture(canvas);
  tex.colorSpace = T.SRGBColorSpace;
  const mesh = new T.Mesh(
    new T.PlaneGeometry(width, width / 4),
    new T.MeshBasicMaterial({ map: tex, side: T.FrontSide }),
  );
  const back = new T.Mesh(mesh.geometry, mesh.material);
  back.name = "Readable sign back";
  back.rotation.y = Math.PI;
  back.position.z = -.012;
  mesh.add(back);
  updateLabel(mesh, text, color);
  return mesh;
}
