import * as T from "three";
import { R } from "./data";
import { point, solid } from "./geometry";
import { offset } from "./navigation";
import { surface } from "./surface";
import { reserveAt, waterAt } from "./wetland-layout";
import type { Position } from "./layout";

export function groundPatch(
  x: number,
  z: number,
  w: number,
  d: number,
  color: string,
  h = 0.055,
  paved = false,
) {
  const positions: number[] = [],
    normals: number[] = [],
    uv: number[] = [],
    indices: number[] = [];
  const nx = Math.max(1, Math.ceil(w / 1.5)),
    nz = Math.max(1, Math.ceil(d / 1.5));
  for (let j = 0; j <= nz; j++)
    for (let i = 0; i <= nx; i++) {
      const p = offset(x, z, (i / nx - 0.5) * w, (j / nz - 0.5) * d);
      const v = point(p.x, p.z, h);
      positions.push(...v.toArray());
      normals.push(...v.clone().normalize().toArray());
      uv.push((i / nx) * w, (j / nz) * d);
      if (i < nx && j < nz) {
        const a = j * (nx + 1) + i;
        indices.push(a, a + nx + 1, a + 1, a + 1, a + nx + 1, a + nx + 2);
      }
    }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new T.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  const mesh = new T.Mesh(
    geometry,
    paved ? surface(solid(color), "paving") : solid(color),
  );
  mesh.receiveShadow = true;
  mesh.userData.walkable = true;
  return mesh;
}

export function pathMesh(
  a: Position,
  b: Position,
  width: number,
  color: string,
  h = 0.1,
  wetlandTrail = false,
) {
  const from = point(a.x, a.z).normalize(),
    to = point(b.x, b.z).normalize();
  const angle = from.angleTo(to),
    axis = from.clone().cross(to).normalize();
  const steps = Math.max(2, Math.ceil((angle * R) / 1.5)),
    positions: number[] = [],
    normals: number[] = [],
    uv: number[] = [],
    ix: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const normal = from.clone().applyAxisAngle(axis, (angle * i) / steps);
    for (const side of [-1, 1]) {
      const p = normal
        .clone()
        .multiplyScalar(R)
        .addScaledVector(axis, (side * width) / 2)
        .normalize();
      normals.push(...p.toArray());
      positions.push(...p.multiplyScalar(R + h).toArray());
      uv.push((i / steps) * angle * R, (side * width) / 2);
    }
    const longitude=Math.atan2(normal.x,normal.y)*R;
    const latitude=Math.atan2(normal.z,Math.hypot(normal.x,normal.y))*R;
    if (i < steps && (wetlandTrail || !reserveAt(longitude,latitude,7))) {
      const k = i * 2;
      ix.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  g.setAttribute("normal", new T.Float32BufferAttribute(normals, 3));
  g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  g.setIndex(ix);
  const mesh = new T.Mesh(g, surface(solid(color), "paving"));
  mesh.receiveShadow = true;
  mesh.userData.walkable = true;
  return mesh;
}

export function terrain() {
  const g = new T.SphereGeometry(R, 192, 128);
  const colors: number[] = [],
    pos = g.getAttribute("position");
  for (let i = 0; i < pos.count; i++) {
    const x = Math.atan2(pos.getX(i), pos.getY(i)) * R,
      z = Math.atan2(pos.getZ(i), Math.hypot(pos.getX(i), pos.getY(i))) * R;
    const n =
      Math.sin(pos.getX(i) * 0.11) * Math.sin(pos.getY(i) * 0.075) +
      Math.sin(pos.getZ(i) * 0.2) * 0.3;
    const c = new T.Color(
      n > 0.5 ? "#a5ad5c" : n < -0.4 ? "#638c45" : "#7e9f4f",
    );
    const water=waterAt(x,z);
    if(water) {
      c.set(water === "lagoon" ? "#7d9874" : "#8abbaf");
      const v=new T.Vector3().fromBufferAttribute(pos,i).normalize().multiplyScalar(R-.8);
      pos.setXYZ(i,v.x,v.y,v.z);
    }
    c.offsetHSL(0, 0, Math.sin(i * 31.1) * 0.015);
    colors.push(...c.toArray());
  }
  g.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  const m = surface(
    new T.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
    "paint",
  );
  const mesh = new T.Mesh(g, m);
  mesh.receiveShadow = true;
  mesh.userData.walkable = true;
  return mesh;
}
