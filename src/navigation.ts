import * as T from "three";
import { R, wrap } from "./data";
import { basis, point } from "./geometry";

/** Advance along a great circle and carry the view direction across both poles. */
export function advance(
  x: number,
  z: number,
  yaw: number,
  right: number,
  forward: number,
  metres: number,
) {
  const frame = basis(x, z);
  const look = frame.east
    .clone()
    .multiplyScalar(Math.sin(yaw))
    .addScaledVector(frame.south, Math.cos(yaw));
  const side = look.clone().cross(frame.up).normalize();
  const tangent = look
    .clone()
    .multiplyScalar(forward)
    .addScaledVector(side, right)
    .normalize();
  if (!tangent.lengthSq() || !metres) return { x, z, yaw, heading: yaw };
  const axis = frame.up.clone().cross(tangent).normalize();
  const rotation = new T.Quaternion().setFromAxisAngle(axis, metres / R);
  const normal = frame.up.clone().applyQuaternion(rotation).normalize();
  const nx = wrap(Math.atan2(normal.x, normal.y) * R);
  const nz = Math.atan2(normal.z, Math.hypot(normal.x, normal.y)) * R;
  const next = basis(nx, nz);
  look.applyQuaternion(rotation);
  tangent.applyQuaternion(rotation);
  return {
    x: nx,
    z: nz,
    yaw: Math.atan2(look.dot(next.east), look.dot(next.south)),
    heading: Math.atan2(tangent.dot(next.east), tangent.dot(next.south)),
  };
}

/** Surface offsets use metres in the local tangent plane, including near a pole. */
export function offset(x: number, z: number, east: number, south: number) {
  return advance(x, z, 0, -east, south, Math.hypot(east, south));
}

export function localOffset(
  x: number,
  z: number,
  originX: number,
  originZ: number,
) {
  const frame = basis(originX, originZ);
  const delta = point(x, z).sub(point(originX, originZ));
  return {
    x: delta.dot(frame.east),
    z: delta.dot(frame.south),
    depth: delta.dot(frame.up),
  };
}
