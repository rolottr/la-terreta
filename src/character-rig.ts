import * as T from "three";
import { R } from "./data";
import type { Ground } from "./ground";
import { BIKE_CRANK_FORWARD, BIKE_CRANK_HEIGHT, BIKE_CRANK_RADIUS } from "./bike";

export interface SolePoint { mesh: T.SkinnedMesh; index: number }
export interface CharacterRig {
  model: T.Object3D;
  detail: T.Object3D;
  distant: T.Object3D;
  skins: T.SkinnedMesh[];
  bones: Map<string, T.Bone>;
  restPose: { bone: T.Bone; position: T.Vector3; quaternion: T.Quaternion; scale: T.Vector3 }[];
  animatedPose: { bone: T.Bone; position: T.Vector3; quaternion: T.Quaternion; scale: T.Vector3 }[];
  soles: [SolePoint[], SolePoint[]];
  feet: [T.Vector3, T.Vector3];
  restFeet: [T.Quaternion, T.Quaternion];
  mixer: T.AnimationMixer;
  actions: Map<string, T.AnimationAction>;
  action?: T.AnimationAction;
  clip: string;
  lastTime?: number;
  gait?: { phase: number; move: number; run: number };
  seed: number;
}

const a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3();
const axis = new T.Vector3(), bend = new T.Vector3(), elbow = new T.Vector3();
const q = new T.Quaternion(), parentQ = new T.Quaternion();
const worldUp = new T.Vector3(), sample = new T.Vector3();

export function refresh(person: T.Group, rig: CharacterRig) {
  person.updateMatrixWorld(true);
  for (const skin of rig.skins) skin.skeleton.update();
}

function aim(bone: T.Bone, child: T.Bone, target: T.Vector3) {
  bone.getWorldPosition(a); child.getWorldPosition(b);
  q.setFromUnitVectors(b.sub(a).normalize(), c.copy(target).sub(a).normalize());
  bone.getWorldQuaternion(parentQ); q.multiply(parentQ);
  bone.parent!.getWorldQuaternion(parentQ).invert();
  bone.quaternion.copy(parentQ.multiply(q));
  bone.updateWorldMatrix(false, true);
}

// Two-bone IK keeps knees and elbows bent in a stable plane on the sphere.
export function solveLimb(rig: CharacterRig, upper: string, lower: string, end: string,
  target: T.Vector3, pole: T.Vector3) {
  const first = rig.bones.get(upper)!, second = rig.bones.get(lower)!, tip = rig.bones.get(end)!;
  first.getWorldPosition(a); second.getWorldPosition(b); tip.getWorldPosition(c);
  const length1 = a.distanceTo(b), length2 = b.distanceTo(c), origin = a.clone();
  axis.copy(target).sub(origin);
  const distance = T.MathUtils.clamp(axis.length(), 0.001, length1 + length2 - 0.00001);
  axis.normalize();
  bend.copy(pole).addScaledVector(axis, -pole.dot(axis)).normalize();
  const along = (length1 * length1 - length2 * length2 + distance * distance) / (2 * distance);
  elbow.copy(origin).addScaledVector(axis, along)
    .addScaledVector(bend, Math.sqrt(Math.max(0, length1 * length1 - along * along)));
  const destination = origin.addScaledVector(axis, distance);
  aim(first, second, elbow); aim(second, tip, destination);
}

function gaps(rig: CharacterRig, ground: Ground, floor: ReturnType<Ground["nearby"]>) {
  return rig.soles.map((points) => {
    let gap = Infinity;
    for (const point of points) {
      point.mesh.getVertexPosition(point.index, sample).applyMatrix4(point.mesh.matrixWorld);
      gap = Math.min(gap, sample.length() - R - ground.heightAlong(sample, floor));
    }
    return gap;
  });
}

export function groundRig(person: T.Group, rig: CharacterRig, ground: Ground, idle: boolean, run: boolean, support?: boolean[]) {
  const floor = ground.nearby(person.position, 1.3);
  const scaleY = person.getWorldScale(sample).y;
  worldUp.set(0, 1, 0).applyQuaternion(person.quaternion);
  refresh(person, rig);
  let errors = gaps(rig, ground, floor);
  const contactErrors = support ? errors.filter((_, i) => support[i]) : errors;
  const anchor = idle ? Math.max(...errors) : contactErrors.length ? Math.min(...contactErrors) : Math.min(0, ...errors);
  rig.model.position.y -= (!support && run && anchor > 0 ? Math.max(0, anchor - 0.045) : anchor) / scaleY;
  refresh(person, rig);
  errors = gaps(rig, ground, floor);
  const pole = new T.Vector3(0, 0, 1).applyQuaternion(person.quaternion);
  for (const [i, side] of ["L", "R"].entries()) {
    if (!idle && errors[i] >= -0.00001) continue;
    const foot = rig.bones.get(`Foot_${side}`)!;
    const orientation = foot.getWorldQuaternion(new T.Quaternion());
    const target = foot.getWorldPosition(new T.Vector3()).addScaledVector(worldUp, -errors[i]);
    solveLimb(rig, `Thigh_${side}`, `Shin_${side}`, `Foot_${side}`, target, pole);
    foot.parent!.getWorldQuaternion(parentQ).invert();
    foot.quaternion.copy(parentQ.multiply(orientation));
    refresh(person, rig);
  }
  // A numerical residue at a triangle edge must not push the sole into the floor.
  const penetration = Math.min(...gaps(rig, ground, floor));
  if (penetration < -0.00001) { rig.model.position.y -= penetration / scaleY; refresh(person, rig); }
  updateFeet(rig);
}

export function updateFeet(rig: CharacterRig) {
  for (let i = 0; i < 2; i++) {
    const points = rig.soles[i], heel = points[0], toe = points[points.length - 1];
    heel.mesh.getVertexPosition(heel.index, rig.feet[i]).applyMatrix4(heel.mesh.matrixWorld);
    toe.mesh.getVertexPosition(toe.index, sample).applyMatrix4(toe.mesh.matrixWorld);
    rig.feet[i].add(sample).multiplyScalar(.5);
  }
}

/** Use one contact interval during a walk/run blend, so the planted foot
 * travels backward by exactly the distance that the character moves forward. */
export function locomotionRig(person: T.Group, rig: CharacterRig, ground: Ground) {
  const gait = rig.gait!;
  if (gait.move < .05) { groundRig(person, rig, ground, true, false); return; }
  refresh(person, rig);
  const stance = T.MathUtils.lerp(.60, .23, gait.run);
  const stroke = T.MathUtils.lerp(.58, .72, gait.run);
  const front = T.MathUtils.lerp(.29, .30, gait.run);
  const release = T.MathUtils.lerp(.28, .38, gait.run);
  const support: boolean[] = [];
  const pole = new T.Vector3(0, 0, 1).applyQuaternion(person.quaternion);
  for (const [i, side] of ["L", "R"].entries()) {
    const u = (gait.phase + i * .5) % 1;
    support.push(u < stance);
    let forward: number, lift: number, roll: number;
    if (u < stance) {
      const t = u / stance;
      forward = front - stroke * t; lift = 0;
      roll = -.10 * Math.max(0, 1 - t / .22) + release * Math.max(0, (t - .65) / .35);
    } else {
      const t = (u - stance) / (1 - stance);
      const ease = t * t * t * (10 + t * (-15 + 6 * t));
      forward = front - stroke + stroke * ease;
      lift = T.MathUtils.lerp(.105, .31, gait.run) * Math.sin(Math.PI * t) ** 1.3;
      roll = release * (1 - t) ** 4 - .18 * Math.sin(Math.PI * t) - .10 * Math.max(0, (t - .82) / .18);
    }
    const ankle = .12 * Math.cos(roll) + (roll > 0 ? .19 : -.055) * Math.sin(roll);
    const foot = rig.bones.get(`Foot_${side}`)!;
    const target = person.localToWorld(new T.Vector3(i ? .092 : -.092, ankle + lift, forward + .015));
    target.lerp(foot.getWorldPosition(new T.Vector3()), 1 - gait.move);
    const orientation = person.getWorldQuaternion(new T.Quaternion())
      .multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), roll)).multiply(rig.restFeet[i]);
    orientation.slerp(foot.getWorldQuaternion(new T.Quaternion()), 1 - gait.move);
    solveLimb(rig, `Thigh_${side}`, `Shin_${side}`, `Foot_${side}`, target, pole);
    foot.parent!.getWorldQuaternion(parentQ).invert();
    foot.quaternion.copy(parentQ.multiply(orientation));
    foot.updateWorldMatrix(false, true);
  }
  groundRig(person, rig, ground, false, gait.run > .5, support);
}

export function cycleRig(person: T.Group, rig: CharacterRig, phase: number) {
  refresh(person, rig);
  const pole = new T.Vector3(0, 0, 1).applyQuaternion(person.quaternion);
  for (const [i, side] of ["L", "R"].entries()) {
    const wave = phase + i * Math.PI;
    // +Z is forward: the forward foot moves down on the power stroke.
    const target = person.localToWorld(new T.Vector3(i ? .22 : -.22,
      BIKE_CRANK_HEIGHT - .35 - Math.sin(wave) * BIKE_CRANK_RADIUS + .139,
      BIKE_CRANK_FORWARD + Math.cos(wave) * BIKE_CRANK_RADIUS - .065));
    solveLimb(rig, `Thigh_${side}`, `Shin_${side}`, `Foot_${side}`, target, pole);
    // The pedal meets the sole under the ball of the foot, not the ankle.
    const foot = rig.bones.get(`Foot_${side}`)!;
    const orientation = person.getWorldQuaternion(new T.Quaternion()).multiply(rig.restFeet[i]);
    foot.parent!.getWorldQuaternion(parentQ).invert();
    foot.quaternion.copy(parentQ.multiply(orientation));
    foot.updateWorldMatrix(false, true);
    // Match the rearward grips, including the bike/player ground offset.
    const handTarget = person.localToWorld(new T.Vector3(i ? .28 : -.28, 1.03, .282));
    const armPole = new T.Vector3(i ? .5 : -.5, -1, 0).applyQuaternion(person.quaternion);
    solveLimb(rig, `UpperArm_${side}`, `Forearm_${side}`, `Hand_${side}`, handTarget, armPole);
  }
  refresh(person, rig); updateFeet(rig);
}
