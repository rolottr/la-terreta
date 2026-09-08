import * as T from "three";
import { gardenGeometry, type FlowerKind } from "./garden-assets";
import { point, rng, seat } from "./geometry";
import { offset } from "./navigation";
import type { World } from "./world";

interface Plant { x: number; z: number; scale: number; yaw: number; kind: FlowerKind; }

/** Flowers grow in open pots at path edges. Shared meshes keep the cost low. */
export class GardenFlowers {
  private plants: Plant[] = [];
  private batches: { mesh: T.InstancedMesh; center: T.Vector3; radius: number }[] = [];
  private random = rng(73026);
  addPlanters(x: number, z: number, length: number) {
    const count = Math.floor(length / .9);
    for (let i = 0; i < count; i++) {
      const p = offset(x, z, 0, (i - (count - 1) / 2) * .98);
      this.plants.push({ ...p, scale: .90 + this.random() * .12, yaw: this.random() * Math.PI * 2,
        kind: (["cosmos", "daisy", "lavender"] as const)[this.plants.length % 3] });
    }
  }
  build(world: World) {
    const buckets = new Map<string, Plant[]>();
    for (const plant of this.plants) {
      // Buildings, street furniture and water are checked after the world loads.
      if (world.blocked(plant.x, plant.z, .37 * plant.scale)) continue;
      const key = `${Math.floor(plant.x / 52)}:${Math.floor(plant.z / 40)}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(plant);
      world.colliders.push({ x: plant.x, z: plant.z, w: .36 * plant.scale, d: .36 * plant.scale, radius: .36 * plant.scale });
    }
    const sources = new Map((["daisy", "cosmos", "lavender", "planter"] as const).map(kind => [kind, gardenGeometry(kind)]));
    const object = new T.Object3D();
    for (const plants of buckets.values()) {
      for (const kind of ["planter", "daisy", "cosmos", "lavender"] as const) {
        const batch = kind === "planter" ? plants : plants.filter(p => p.kind === kind);
        if (!batch.length) continue;
        const { geometry, material } = sources.get(kind)!;
        const mesh = new T.InstancedMesh(geometry, material, batch.length);
        mesh.name = `Garden_${kind}`;
        mesh.userData.asset = `/models/garden/${kind}.glb`;
        batch.forEach((plant, i) => {
          const floor = world.heightAt(plant.x, plant.z);
          // The authored foot ring is .014 m above the Blender origin.
          const origin = floor - .014 * plant.scale;
          const height = origin + (kind === "planter" ? 0 : .402 * plant.scale);
          seat(object, plant.x, plant.z, height, plant.yaw);
          object.scale.setScalar(plant.scale * (kind === "planter" ? 1 : .82));
          object.updateMatrix(); mesh.setMatrixAt(i, object.matrix);
        });
        mesh.castShadow = mesh.receiveShadow = true;
        mesh.computeBoundingSphere();
        this.batches.push({ mesh, center: mesh.boundingSphere!.center.clone(), radius: mesh.boundingSphere!.radius });
        world.group.add(mesh);
      }
    }
    this.plants = [];
  }
  setView(x: number, z: number, globe: boolean) {
    const viewer = point(x, z);
    for (const { mesh, center, radius } of this.batches) mesh.visible = !globe && viewer.distanceTo(center) < 48 + radius;
  }
}
