import * as T from "three";
import { fields, routes, type Position } from "./layout";
import { Builder, label, rng, seat } from "./geometry";
import { localOffset, offset } from "./navigation";
import { groundPatch, pathMesh } from "./terrain";
import type { World } from "./world";

const farmFields = fields.filter(f => !f.rice).slice(0, 4);
export const activitySites: (Position & { yaw: number; role: "watch" | "talk" })[] =
  farmFields.map(f => ({ ...offset(f.x, f.z, 0, -f.d / 2 - 2.8), yaw: 0, role: "watch" }));

function bladeClump(rice: boolean) {
  const vertices: number[] = [], colors: number[] = [];
  const green = new T.Color(rice ? "#759642" : "#517d37");
  const light = new T.Color(rice ? "#a0ac51" : "#94ab45");
  const triangle = (a: number[], b: number[], c: number[], color: T.Color) => {
    vertices.push(...a, ...b, ...c);
    for (let k = 0; k < 3; k++) colors.push(color.r, color.g, color.b);
  };
  for (let i = 0; i < 8; i++) {
    const angle = i * 2.39996, height = .58 + (i % 3) * .14;
    const spread = rice ? .18 : .35;
    const x = Math.cos(angle), z = Math.sin(angle), w = rice ? .028 : .045;
    const left = [-z * w, .015, x * w], right = [z * w, .015, -x * w];
    const mid = [x * spread * .42, height * .72, z * spread * .42];
    const tip = [x * spread, height, z * spread];
    triangle(left, right, mid, green);
    triangle(left, mid, tip, i % 2 ? light : green);
    triangle(mid, right, tip, light);
  }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(vertices, 3));
  g.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

/** Low crop leaves expose the planted rows without blocking the farm paths. */
export class FieldLife {
  constructor(world: World) {
    const random = rng(912026);
    const material = new T.MeshStandardMaterial({ vertexColors: true, roughness: .94, side: T.DoubleSide });
    const geometry = [bladeClump(false), bladeClump(true)];
    for (const f of fields) {
      const paths = routes.map(route => ({
        a: localOffset(route.a.x, route.a.z, f.x, f.z),
        b: localOffset(route.b.x, route.b.z, f.x, f.z), width: route.width / 2 + .65,
      })).filter(p => p.a.depth > -45 && p.b.depth > -45);
      const clearPath = (x: number, z: number) => paths.some(p => {
        const vx = p.b.x - p.a.x, vz = p.b.z - p.a.z;
        const t = T.MathUtils.clamp(((x - p.a.x) * vx + (z - p.a.z) * vz) / (vx * vx + vz * vz || 1), 0, 1);
        return Math.hypot(x - p.a.x - t * vx, z - p.a.z - t * vz) < p.width;
      });
      world.group.add(groundPatch(f.x, f.z, f.w + 1, f.d + 1, "#b3a37b", .035));
      world.group.add(groundPatch(f.x, f.z, f.w, f.d, f.rice ? "#859b59" : "#9c8158", .055));
      const plants: Position[] = [];
      for (let x = -f.w / 2 + .8; x < f.w / 2 - .35; x += 1.3) {
        world.group.add(pathMesh(offset(f.x, f.z, x, -f.d / 2), offset(f.x, f.z, x, f.d / 2),
          .42, f.rice ? "#567b4d" : "#b49b68", .07));
        for (let z = -f.d / 2 + .7; z < f.d / 2 - .4; z += .64) {
          if (!clearPath(x, z)) plants.push(offset(f.x, f.z, x + (random() - .5) * .16, z));
        }
      }
      if (!plants.length) continue;
      const crops = new T.InstancedMesh(geometry[f.rice ? 1 : 0], material, plants.length);
      crops.name = f.rice ? "rice-crop-rows" : "chufa-crop-rows";
      crops.userData = { crop: f.rice ? "rice" : "chufa", plants: plants.length, x: f.x, z: f.z };
      const object = new T.Object3D();
      plants.forEach((p, i) => {
        seat(object, p.x, p.z, .08, random() * Math.PI * 2);
        object.scale.setScalar(.78 + random() * .38); object.updateMatrix(); crops.setMatrixAt(i, object.matrix);
      });
      crops.receiveShadow = true;
      crops.computeBoundingSphere();
      world.group.add(crops);
    }
    farmFields.forEach((field, i) => this.farm(world, field, i));
  }

  private farm(world: World, field: typeof fields[number], index: number) {
    const site = activitySites[index];
    world.group.add(groundPatch(site.x, site.z, 8, 4.5, "#c1b58b", .085));
    // Join the farm entrance to the nearest existing path endpoint.
    const near = routes.flatMap(route => [route.a, route.b]).reduce((a, b) => {
      const pa = localOffset(a.x, a.z, site.x, site.z), pb = localOffset(b.x, b.z, site.x, site.z);
      return Math.hypot(pa.x, pa.z) < Math.hypot(pb.x, pb.z) ? a : b;
    });
    world.group.add(pathMesh(site, near, 1.5, "#c7ba8c", .08));
    const b = new Builder(site.x, site.z);
    // A harvest table, baskets of tiger nuts, sacks, and a hoe show farm work.
    b.box(2.45, .88, 0, 2.2, .12, .85, "#a17e52");
    for (const x of [1.6, 3.3]) for (const z of [-.3, .3]) b.box(x, .43, z, .1, .86, .1, "#765c3e");
    for (const x of [1.9, 2.8]) {
      b.cylinder(x, 1.05, 0, .31, .25, "#b69a61");
      for (let k = 0; k < 12; k++) {
        const a = k * 2.4, r = .06 + k % 3 * .065;
        b.ball(x + Math.cos(a) * r, 1.2 + k % 2 * .025, Math.sin(a) * r, .045, .04, .06, "#8c6942");
      }
    }
    for (const x of [-2.4, -1.7]) {
      b.ball(x, .42, .2, .32, .46, .3, "#c3ad79");
      b.cylinder(x, .88, .2, .13, .1, "#8e7d56");
    }
    b.beam(new T.Vector3(-3, .15, -.5), new T.Vector3(-2.5, 1.65, -.5), .028, "#987c52");
    b.box(-3, .14, -.5, .38, .1, .2, "#637770");
    // The shallow irrigation channel ends before the pedestrian entrance.
    const channel = offset(field.x, field.z, field.w / 2 + .45, 0);
    world.group.add(groundPatch(channel.x, channel.z, .42, field.d, "#698f86", .08));
    const sign = label("CHUFA · HORTA VALENCIANA", "#557046", 3.4);
    const signPos = offset(site.x, site.z, 2.5, 1.5);
    seat(sign, signPos.x, signPos.z, 1.65, Math.PI); world.group.add(sign);
    b.box(2.5, .8, 1.5, .07, 1.6, .07, "#7d6749");
    world.add(b);
    world.colliders.push({ ...offset(site.x, site.z, 2.45, 0), w: 1.1, d: .45 });
    world.colliders.push({ ...offset(site.x, site.z, -2.05, .2), w: .7, d: .4 });
  }
}
