import * as T from "three";
import { GLTFLoader } from "./gltf-loader";
import { R } from "./data";
import type { Ground } from "./ground";

let template: T.Group | undefined;
let loading: Promise<void> | undefined;
interface BikeRig { wheels: T.Object3D[]; crank: T.Object3D; pedals: T.Object3D[]; phase: number; tirePoints: T.Vector3[][] }
const bikeRigs = new WeakMap<T.Group, BikeRig>();
export const BIKE_WHEEL_RADIUS = .44;
export const BIKE_CRANK_RADIUS = .145;
export const BIKE_CRANK_HEIGHT = .48;
export const BIKE_CRANK_FORWARD = -.08;
// One crank revolution drives three wheel revolutions in the cruising gear.
const CRANK_TRAVEL = Math.PI * 2 * BIKE_WHEEL_RADIUS * 3;

export function loadBike() {
  return loading ??= new GLTFLoader().loadAsync("/models/valenbisi.glb").then(({ scene }) => {
    scene.traverse((object) => {
      if (object instanceof T.Mesh) object.castShadow = object.receiveShadow = true;
    });
    template = scene;
  });
}

// The rider and each dock share geometry and materials from the Blender export.
export function createBike(riding = false) {
  if (!template) throw new Error("The Valenbisi model is not loaded.");
  const bike = template.clone(true);
  bike.name = "Valenbisi";
  const wheels = ["Valenbisi_RearWheel", "Valenbisi_FrontWheel"].map(name => {
    const wheel = bike.getObjectByName(name);
    if (!wheel) throw new Error(`Missing Valenbisi wheel: ${name}`);
    return wheel;
  });
  const crank = bike.getObjectByName("Valenbisi_Crank");
  const pedals = ["Left", "Right"].map(side => bike.getObjectByName(`Valenbisi_${side}Pedal`));
  if (!crank || pedals.some(pedal => !pedal)) throw new Error("Missing Valenbisi pedal assembly");
  const stand = bike.getObjectByName("Valenbisi_Stand");
  if (!stand) throw new Error("Missing Valenbisi stand");
  stand.rotation.x = riding ? 1.35 : 0;
  const tirePoints = wheels.map(wheel => {
    const points: T.Vector3[] = [], seen = new Set<string>();
    wheel.updateWorldMatrix(true, true);
    const inverse = wheel.matrixWorld.clone().invert();
    wheel.traverse(object => {
      if (!(object instanceof T.Mesh)) return;
      const positions = object.geometry.getAttribute("position");
      for (let i = 0; i < positions.count; i++) {
        const point = new T.Vector3().fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld).applyMatrix4(inverse);
        if (Math.hypot(point.y, point.z) < .39 || Math.abs(point.x) > .05) continue;
        const key = point.toArray().map(n => n.toFixed(5)).join();
        if (!seen.has(key)) { seen.add(key); points.push(point); }
      }
    });
    return points;
  });
  bikeRigs.set(bike, { wheels, crank, pedals: pedals as T.Object3D[], phase: 0, tirePoints });
  return bike;
}

/** Roll by actual travel, so stopped, blocked and paused bikes stay still. */
export function rollBike(bike: T.Group, distance: number) {
  if (distance === 0) return;
  const rig = bikeRigs.get(bike)!;
  for (const wheel of rig.wheels) {
    wheel.rotation.x = (wheel.rotation.x + distance / BIKE_WHEEL_RADIUS) % (Math.PI * 2);
  }
  rig.phase = (rig.phase + distance / CRANK_TRAVEL * Math.PI * 2) % (Math.PI * 2);
  rig.crank.rotation.x = rig.phase;
  for (let i = 0; i < 2; i++) {
    const phase = rig.phase + i * Math.PI;
    // Pedal bearings keep the tread level while the crank rotates.
    rig.pedals[i].position.y = BIKE_CRANK_HEIGHT - Math.sin(phase) * BIKE_CRANK_RADIUS;
    rig.pedals[i].position.z = BIKE_CRANK_FORWARD + Math.cos(phase) * BIKE_CRANK_RADIUS;
  }
}

export function getBikeCrankPhase(bike: T.Group) { return bikeRigs.get(bike)!.phase; }

/** Seat both rendered tires on the local floor after steering and lean. */
export function groundBike(bike: T.Group, ground: Ground) {
  const rig = bikeRigs.get(bike)!;
  const floor = ground.nearby(bike.position, 1.5);
  const sample = new T.Vector3();
  const gaps = () => {
    bike.updateMatrixWorld(true);
    return rig.wheels.map((wheel, i) => {
      let lowest = Infinity;
      for (const point of rig.tirePoints[i]) {
        sample.copy(point).applyMatrix4(wheel.matrixWorld);
        lowest = Math.min(lowest, sample.length());
      }
      let gap = Infinity;
      for (const point of rig.tirePoints[i]) {
        sample.copy(point).applyMatrix4(wheel.matrixWorld);
        if (sample.length() > lowest + .015) continue;
        gap = Math.min(gap, sample.length() - R - ground.heightAlong(sample, floor));
      }
      return gap;
    });
  };
  const initial = gaps();
  bike.rotateX(T.MathUtils.clamp((initial[1] - initial[0]) / 1.3, -.18, .18));
  const gap = Math.min(...gaps());
  bike.position.addScaledVector(bike.position.clone().normalize(), -gap);
  bike.updateMatrixWorld(true);
}
