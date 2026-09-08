import * as T from "three";
import { createCraftedProp } from "./crafted-props";
import { Builder, point, seat, solid } from "./geometry";
import { offset } from "./navigation";
import { createBeachSurf } from "./beach-surf";
import { surface } from "./surface";
import { groundPatch, pathMesh } from "./terrain";
import {
  cafeSite,
  hiddenPlaces,
  waterSeat,
  terraceSite,
} from "./immersion-sites";
import { seaOutline } from "./wetland-layout";
import { windAt } from "./environment";
import { places, distance } from "./data";
import { createBike } from "./bike";
import { craftModel, placeCraft } from "./craft-models";
import type { World } from "./world";

/** Small original street props, built with the same palette and geometry as the city. */
export class StreetDetails {
  readonly group = new T.Group();
  readonly awning = new T.Group();
  readonly fountain = { x: hiddenPlaces[0].x, z: hiddenPlaces[0].z + 1.5 };
  readonly seats: { x: number; z: number; yaw: number }[] = [waterSeat];
  readonly fabrics: T.Group[] = [];
  readonly leaves: T.Object3D[] = [];
  readonly cafes = [cafeSite];
  awningOpen = 1;
  private waters: T.Mesh[] = [];
  private fountainCurves: T.QuadraticBezierCurve3[] = [];
  private fountainDrops?: T.InstancedMesh;
  private dropPose = new T.Object3D();
  constructor(private world: World) {
    this.group.name = "Street details and hidden places";
    world.group.add(this.group);
    this.cafe(cafeSite, true);
    for (const id of ["oldtown", "science", "beach", "albufera"]) {
      const p = places.find((p) => p.id === id)!;
      const candidates =
        id === "albufera"
          ? [{ x: -110, z: -23 }]
          : id === "oldtown"
            ? [{ x: 20, z: 40 }]
            : [
                offset(p.x, p.z, 11, -16),
                offset(p.x, p.z, -12, -16),
                offset(p.x, p.z, 18, -17),
              ];
      const site = candidates.find((p) => !world.blocked(p.x, p.z, 2.5));
      if (!site) continue;
      this.cafe({ ...site, yaw: Math.PI }, false);
      this.cafes.push({ ...site, yaw: Math.PI });
    }
    this.bench(waterSeat);
    this.courtyard();
    this.clearing();
    this.terrace();
    this.shallowShore();
    const surf = createBeachSurf((x, z) => world.heightAt(x, z));
    surf.frustumCulled = false;
    this.group.add(surf);
    world.water.push(surf);
    this.group.updateMatrixWorld(true);
    this.group.traverse((o) => {
      if (o instanceof T.Mesh && o.userData.walkable)
        world.ground.add(o.geometry, o.matrixWorld);
    });
  }
  private finish(b: Builder) {
    b.finish(this.group);
  }
  private collider(p: { x: number; z: number }, w: number, d: number, yaw = 0) {
    this.world.colliders.push({ ...p, w, d, yaw });
  }
  private pot(x: number, z: number) {
    placeCraft(this.group, "terracotta_pot", x, z);
    const crown = craftModel("pot_plant");
    seat(crown, x, z, 0.03);
    crown.userData.surfaceRotation = crown.quaternion.clone();
    this.group.add(crown);
    this.leaves.push(crown);
    this.collider({ x, z }, 0.27, 0.27);
  }
  private cafe(p: { x: number; z: number; yaw: number }, main: boolean) {
    placeCraft(this.group, "cafe_counter", p.x, p.z, 0, p.yaw);
    const b = new Builder(p.x, p.z, p.yaw);
    if (main) {
      b.cylinder(0.1, 1.95, -0.77, 0.013, 1.9, "#bdad82");
      b.box(0.1, 2.9, -0.2, 0.06, 0.06, 1.2, "#d5b17a");
    }
    this.finish(b);
    this.collider(p, 1.27, 0.44, p.yaw);
    const fabric = main ? this.awning : new T.Group();
    const canopy = craftModel("cafe_awning");
    canopy.position.set(0, 2.9, 0.38);
    fabric.add(canopy);
    seat(fabric, p.x, p.z, 0.03, p.yaw);
    this.group.add(fabric);
    this.fabrics.push(fabric);
    const table = offset(p.x, p.z, 2.35, 0);
    if (!this.world.blocked(table.x, table.z, 1)) {
      placeCraft(this.group, "bistro_table", table.x, table.z);
      this.collider(table, 1.13, 0.65);
    }
    const pot = offset(p.x, p.z, main ? 0 : -1.8, main ? -1.8 : 0);
    if (!this.world.blocked(pot.x, pot.z, 0.6)) this.pot(pot.x, pot.z);
    const park = offset(p.x, p.z, 0, -1.5);
    if (!this.world.blocked(park.x, park.z, 1)) {
      const bike = createBike();
      seat(
        bike,
        park.x,
        park.z,
        this.world.heightAt(park.x, park.z) + 0.03,
        Math.PI / 2,
      );
      this.group.add(bike);
      this.collider(park, 1, 0.3);
    }
  }
  private bench(
    p: { x: number; z: number; yaw: number },
    height = this.world.heightAt(p.x, p.z),
  ) {
    const bench = createCraftedProp("park-bench");
    seat(bench, p.x, p.z, height, p.yaw);
    this.group.add(bench);
    this.collider(p, 1, 0.45, p.yaw);
  }
  private courtyard() {
    const p = hiddenPlaces[0],
      b = new Builder(p.x, p.z);
    this.group.add(groundPatch(p.x, p.z, 12, 14, "#dec9a6", 0.14, true));
    // Low stone bases and open iron rails keep the fountain visible from outside.
    const rails = new Builder(p.x, p.z);
    const fence = (x: number, z: number, length: number, alongZ: boolean) => {
      // Subdivide long rails so their bases follow the curved paving.
      const segments = Math.ceil(length / .55);
      const box = new T.BoxGeometry(1, 1, 1, alongZ ? 1 : segments, 1, alongZ ? segments : 1);
      rails.add(box, "#cfaa88", [x, .1, z], [alongZ ? .3 : length, .6, alongZ ? length : .3]);
      rails.add(box, "#477064", [x, 1.3, z], [alongZ ? .07 : length, .07, alongZ ? length : .07]);
      box.dispose();
      for (let u = -length / 2; u <= length / 2 + .01; u += .55)
        rails.box(x + (alongZ ? 0 : u), .85, z + (alongZ ? u : 0), .045, .94, .045, "#477064");
      this.collider(offset(p.x, p.z, x, z), alongZ ? .18 : length / 2,
        alongZ ? length / 2 : .18);
    };
    for (const x of [-6, 6]) fence(x, 0, 14, true);
    fence(0, 7, 12, false);
    // The 4 m entrance has no gate panel or threshold in the walking path.
    for (const x of [-4, 4]) fence(x, -7, 4, false);
    const inverse = rails.matrix.clone().invert();
    const vertex = new T.Vector3();
    for (const geometry of rails.pieces) {
      const positions = geometry.getAttribute("position");
      for (let i = 0; i < positions.count; i++) {
        vertex.fromBufferAttribute(positions, i).applyMatrix4(inverse);
        const location = offset(p.x, p.z, vertex.x, vertex.z);
        // The base extends below both the paving and the ground outside it.
        vertex.copy(point(location.x, location.z, vertex.y + .12));
        positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
      }
      geometry.computeVertexNormals();
    }
    const fenceMesh = rails.finish(this.group)!;
    fenceMesh.name = "Courtyard fence";
    b.cylinder(0, 0.34, 1.5, 1.7, 0.4, "#b38e6d");
    b.cylinder(0, 0.55, 1.5, 0.35, 0.7, "#d8b791");
    b.cylinder(0, 1, 1.5, 0.9, 0.15, "#dec7a2");
    // Open terracotta pots sit beside the fence, clear of the entrance.
    for (const x of [-5.4, 5.4]) {
      const bed = offset(p.x, p.z, x, 3.7);
      this.world.flowers.addPlanters(bed.x, bed.z, 3.4);
    }
    this.finish(b);
    this.collider(this.fountain, 1.55, 1.55);
    const water = new T.Mesh(
      new T.CircleGeometry(1.52, 32),
      new T.MeshStandardMaterial({
        color: "#83b9b1",
        transparent: true,
        opacity: 0.85,
        roughness: 0.2,
      }),
    );
    water.rotation.x = -Math.PI / 2;
    const pool = new T.Group();
    pool.add(water);
    seat(pool, this.fountain.x, this.fountain.z, 0.56);
    this.group.add(pool);
    this.waters.push(water);
    const streams = new T.Group();
    streams.name = "Fountain water streams";
    const waterMaterial = new T.MeshStandardMaterial({
      color: "#acdad1",
      roughness: 0.18,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    });
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      const curve = new T.QuadraticBezierCurve3(
        new T.Vector3(0, 1.08, 0),
        new T.Vector3(Math.sin(angle) * 0.55, 1.85, Math.cos(angle) * 0.55),
        new T.Vector3(Math.sin(angle) * 1.24, 0.57, Math.cos(angle) * 1.24),
      );
      this.fountainCurves.push(curve);
      streams.add(
        new T.Mesh(
          new T.TubeGeometry(curve, 12, 0.018, 5, false),
          waterMaterial,
        ),
      );
    }
    this.fountainDrops = new T.InstancedMesh(
      new T.IcosahedronGeometry(1, 0),
      waterMaterial,
      24,
    );
    this.fountainDrops.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.fountainDrops.frustumCulled = false;
    streams.add(this.fountainDrops);
    seat(streams, this.fountain.x, this.fountain.z);
    this.group.add(streams);
    const bench = { ...offset(p.x, p.z, -3.8, 2), yaw: Math.PI / 2 };
    this.bench(bench, 0.14);
    this.seats.push(bench);
    for (const x of [-4.5, 4.5])
      for (const z of [-4.8, 5]) {
        const v = offset(p.x, p.z, x, z);
        this.pot(v.x, v.z);
      }
    this.group.add(
      pathMesh(p.entrance, { x: p.x, z: p.z - 5 }, 2, "#d5c2a2", 0.15),
    );
  }
  private clearing() {
    const p = hiddenPlaces[1];
    this.group.add(pathMesh(p.entrance, p, 2, "#c5bd8b", 0.12));
    this.group.add(groundPatch(p.x, p.z, 8, 8, "#b7b685", 0.13));
    const bench = { ...offset(p.x, p.z, 2, 0), yaw: -Math.PI / 2 };
    this.bench(bench, 0.13);
    this.seats.push(bench);
  }
  private terrace() {
    const p = terraceSite;
    // One exposed ramp rises into the terrace. There is no walkable underpass.
    const g = new T.BufferGeometry(),
      vertices: number[] = [],
      ix: number[] = [];
    const rows = [
      [-17, 0.14],
      [-16, 0.14],
      [-4, 3.1],
      [-3.8, 3.1],
      [4, 3.1],
    ];
    rows.forEach(([z, h], i) => {
      const width = i < 3 ? 1.5 : 4.3;
      for (const side of [-1, 1]) {
        const v = offset(p.x, p.z, side * width, z);
        vertices.push(...point(v.x, v.z, h).toArray());
      }
      if (i) {
        const k = (i - 1) * 2;
        ix.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
      }
    });
    g.setAttribute("position", new T.Float32BufferAttribute(vertices, 3));
    g.setIndex(ix);
    g.computeVertexNormals();
    const floor = new T.Mesh(g, surface(solid("#d1b18c"), "paving"));
    floor.receiveShadow = true;
    floor.userData.walkable = true;
    floor.name = "Terrace ramp and roof floor";
    this.group.add(floor);
    const b = new Builder(p.x, p.z);
    b.box(0, 1.45, 0, 8.6, 2.8, 8, "#c89e7c");
    // Side walls prevent reaching the roof from the ground along an edge.
    for (const x of [-4.35, 4.35]) {
      b.box(x, 3.55, 0, 0.16, 0.9, 8.2, "#517269");
      this.collider(offset(p.x, p.z, x, 0), 0.13, 4.15);
    }
    b.box(0, 3.55, 4.1, 8.6, 0.9, 0.16, "#517269");
    this.collider(offset(p.x, p.z, 0, 4.1), 4.4, 0.13);
    for (const x of [-3, 3]) {
      b.box(x, 3.55, -4, 2.4, 0.9, 0.16, "#517269");
      this.collider(offset(p.x, p.z, x, -4), 1.2, 0.13);
    }
    for (let i = 0; i < 12; i++) {
      const z = -15.5 + i,
        h = 0.14 + ((z + 16) / 12) * 2.96;
      for (const x of [-1.6, 1.6]) {
        b.box(x, h + 0.4, z, 0.1, 0.8, 1.04, "#517269");
      }
    }
    for (const x of [-1.6, 1.6])
      this.collider(offset(p.x, p.z, x, -10), 0.1, 6);
    this.finish(b);
    // Face the frame towards the cathedral, across the old town.
    const frame = new Builder(p.x, p.z, Math.PI);
    for (const x of [-2, 2]) {
      frame.box(x, 4.2, 2.5, 0.22, 2.7, 0.22, "#ead8b5");
      frame.box(x, 3.0, 2.5, 0.36, 0.2, 0.36, "#bd9167");
      this.collider(offset(p.x,p.z,-x,-2.5),.18,.18);
    }
    frame.box(0, 5.55, 2.5, 4.3, 0.2, 0.25, "#ead8b5");
    for (let i = 0; i < 7; i++)
      frame.box(-1.9 + i * 0.63, 5.69, 2.5, 0.12, 0.12, 1.15, "#bd9167");
    this.finish(frame);
    const decoration = new Builder(p.x, p.z);
    // Terracotta tiles, ceramic wall bands and roof planters retain the city palette.
    for (const x of [-3.8, 3.8]) {
      decoration.box(x, 3.2, 2.7, 0.6, 0.55, 0.7, "#b9825a");
      for (let i = 0; i < 4; i++)
        decoration.ball(
          x + Math.sin(i * 2) * 0.16,
          3.68,
          2.7 + Math.cos(i * 2) * 0.17,
          0.22,
          0.33,
          0.18,
          "#638650",
        );
    }
    this.finish(decoration);
  }
  private shallowShore() {
    const shore = seaOutline.filter(
      (p) => p.x > -270 && p.z < -30 && p.z > -54,
    );
    const vertices: number[] = [],
      indices: number[] = [];
    const profile = [
      [-1.7, -0.18],
      [-0.9, -0.12],
      [-0.35, -0.04],
      [0, 0.045],
      [1.1, 0.045],
    ];
    for (const [i, p] of shore.entries()) {
      for (const [dx, height] of profile) {
        const v = offset(p.x, p.z, dx, 0);
        vertices.push(...point(v.x, v.z, height).toArray());
      }
      if (i)
        for (let j = 0; j < profile.length - 1; j++) {
          const k = (i - 1) * profile.length + j,
            n = k + profile.length;
          indices.push(k, k + 1, n, k + 1, n + 1, n);
        }
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute(
      "position",
      new T.Float32BufferAttribute(vertices, 3),
    );
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const material = solid("#c3b98e");
    material.side = T.DoubleSide;
    const bed = new T.Mesh(geometry, material);
    bed.name = "Shallow sand beside the beach";
    bed.userData.walkable = true;
    this.group.add(bed);
  }
  update(time: number, viewer: { x: number; z: number }, globe: boolean) {
    this.fabrics.forEach((fabric, i) => {
      const canopy = fabric.children[0];
      canopy.rotation.x = windAt(time, i) * 0.012;
      canopy.scale.z =
        fabric === this.awning ? Math.max(0.07, this.awningOpen) : 1;
    });
    this.leaves.forEach((leaf, i) => {
      leaf.quaternion.copy(leaf.userData.surfaceRotation);
      leaf.rotateZ(windAt(time, i) * 0.025);
    });
    if (this.fountainDrops) {
      this.fountainDrops.visible =
        !globe && distance(viewer, this.fountain) < 35;
      if (this.fountainDrops.visible) {
        for (let i = 0; i < 24; i++) {
          this.fountainCurves[Math.floor(i / 3)].getPoint(
            (time * 0.85 + (i % 3) / 3) % 1,
            this.dropPose.position,
          );
          this.dropPose.scale.set(0.03, 0.055, 0.03);
          this.dropPose.updateMatrix();
          this.fountainDrops.setMatrixAt(i, this.dropPose.matrix);
        }
        this.fountainDrops.instanceMatrix.needsUpdate = true;
      }
    }
    this.waters.forEach((w) => {
      (w.material as T.MeshStandardMaterial).opacity =
        0.79 + Math.sin(time * 2) * 0.045;
    });
    this.group.visible = true;
    // Each crafted prop selects its smaller mesh at a distance.
    this.fabrics.forEach(
      (f) =>
        (f.visible =
          globe || f.position.distanceTo(point(viewer.x, viewer.z)) < 95),
    );
  }
}
