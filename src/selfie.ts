import * as T from "three";
import { R } from "./data";
import { basis, point } from "./geometry";
import { getCharacterRig } from "./characters";
import { refresh, solveLimb, updateFeet } from "./character-rig";

/** An arm-length camera faces the explorer, with the city behind them. */
export function selfieFrame(x: number, z: number, height: number, yaw: number, aspect: number, pitch = .28, zoom = 1, lift = 0) {
  const frame = basis(x, z);
  const forward = frame.east.clone().multiplyScalar(Math.sin(yaw))
    .addScaledVector(frame.south, Math.cos(yaw));
  const right = frame.east.clone().multiplyScalar(Math.cos(yaw))
    .addScaledVector(frame.south, -Math.sin(yaw));
  const distance = (aspect < .8 ? 1.65 : 1.45) * T.MathUtils.clamp(zoom, .75, 2.5);
  const position = point(x, z, height + 1.46 + lift + Math.sin(pitch) * distance)
    .addScaledVector(forward, Math.cos(pitch) * distance).addScaledVector(right, -.22);
  // Keep the lens above the spherical floor for every pitch/zoom/lift combination.
  if(position.length() < R + height + .45) position.setLength(R + height + .45);
  const target = point(x, z, height + 1.46 + lift).addScaledVector(right, .10);
  return { position, target, up: frame.up, fov: 58 };
}

/** A relaxed portrait: both hands at the waist, bent elbows and a smile. */
export function poseSelfie(person: T.Group) {
  const rig = getCharacterRig(person);
  rig.bones.get("Head")!.rotateZ(-.08);
  refresh(person, rig);
  for (const [side, sign] of [["L", -1], ["R", 1]] as const) {
    const target = person.localToWorld(new T.Vector3(sign * .22, 1.02, .10));
    const pole = new T.Vector3(sign, .05, -.15).applyQuaternion(person.quaternion);
    solveLimb(rig, `UpperArm_${side}`, `Forearm_${side}`, `Hand_${side}`, target, pole);
    refresh(person, rig);
  }
  for (const skin of rig.skins) {
    const smile = skin.morphTargetDictionary?.Smile;
    if (smile !== undefined && skin.morphTargetInfluences) skin.morphTargetInfluences[smile] = 1;
    const blink = skin.morphTargetDictionary?.Blink;
    if (blink !== undefined && skin.morphTargetInfluences) skin.morphTargetInfluences[blink] = 0;
  }
  updateFeet(rig);
}
