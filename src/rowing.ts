import * as T from "three";
import { getCharacterRig } from "./characters";
import { refresh, solveLimb, updateFeet } from "./character-rig";

/** The rower sits on the thwart and grips the actual moving oar handles. */
export function poseRower(person: T.Group, boat: T.Object3D, phase: number, power: number) {
  const rig = getCharacterRig(person);
  // Sit faces the stern; its hips stay on the bench while the torso follows the pull.
  rig.bones.get("Spine")!.rotateX(.12 - Math.sin(phase) * .14 * (1+power));
  rig.bones.get("Chest")!.rotateX(-Math.sin(phase) * .06 * (1+power));
  refresh(person, rig);
  for (const paddle of boat.children) {
    if (paddle.name !== "paddle") continue;
    const side = paddle.userData.side as number;
    const hand = side > 0 ? "L" : "R";
    const grip = paddle.localToWorld(new T.Vector3(-side*.65,.31,-.50));
    const pole = new T.Vector3(hand === "L" ? -.6 : .6,-.5,.2).applyQuaternion(person.quaternion);
    solveLimb(rig, `UpperArm_${hand}`, `Forearm_${hand}`, `Hand_${hand}`, grip, pole);
  }
  refresh(person, rig);
  updateFeet(rig);
  person.userData.animation = "Row";
}
