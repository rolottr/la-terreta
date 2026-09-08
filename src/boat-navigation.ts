import * as T from "three";
import { advance, offset } from "./navigation";
import { navigable, waterAt, onJetty } from "./wetland-layout";
export interface BoatPose {
  x: number;
  z: number;
  yaw: number;
  heading: number;
  speed: number;
}
/** Substeps keep the complete hull clear of the shore and reed islands. */
export function stepBoat(
  pose: BoatPose,
  forward: number,
  right: number,
  dt: number,
) {
  let p = { ...pose };
  const steps = Math.max(1, Math.ceil(dt * 120)),
    h = dt / steps;
  for (let i = 0; i < steps; i++) {
    const speed = T.MathUtils.damp(
      p.speed,
      forward > 0 ? 5 * forward : forward < 0 ? 2 * forward : 0,
      forward < 0 ? 3.5 : 1.4,
      h,
    );
    const heading = p.heading - right * h * 0.65 * (0.25 + Math.abs(speed) / 5);
    const next = advance(p.x, p.z, heading, 0, 1, speed * h);
    const bow = advance(next.x, next.z, next.heading, 0, 1, 2.9);
    const stern = advance(next.x, next.z, next.heading, 0, -1, 2.9);
    if ([next, bow, stern].every((v) => navigable(v.x, v.z, 0.85)))
      p = {
        x: next.x,
        z: next.z,
        yaw:
          p.yaw +
          Math.atan2(
            Math.sin(next.heading - p.yaw),
            Math.cos(next.heading - p.yaw),
          ) *
            (1 - Math.exp(-h * 2.5)),
        heading: next.heading,
        speed,
      };
    else {
      const turnBow = advance(p.x, p.z, heading, 0, 1, 2.9),
        turnStern = advance(p.x, p.z, heading, 0, -1, 2.9);
      const clear = [turnBow, turnStern].every((v) =>
        navigable(v.x, v.z, 0.85),
      );
      p = { ...p, speed: 0, heading: clear ? heading : p.heading };
    }
  }
  return p;
}

/** A nearby dry, clear landing works on jetties, banks, and the reed islands. */
export function findBoatLanding(
  pose: Pick<BoatPose, "x" | "z">,
  blocked: (x: number, z: number, radius: number) => boolean,
) {
  const dry = (x: number, z: number) => !waterAt(x, z) || onJetty(x, z);
  for (let metres = 1; metres <= 6.5; metres += .5) {
    for (let step = 0; step < 48; step++) {
      const angle = step * Math.PI / 24;
      const p = offset(pose.x, pose.z, Math.cos(angle) * metres, Math.sin(angle) * metres);
      if (!dry(p.x, p.z) || blocked(p.x, p.z, .45)) continue;
      // The entire standing footprint must be supported, not just its centre.
      let clear = true;
      for (let side = 0; side < 8; side++) {
        const a = side * Math.PI / 4;
        const edge = offset(p.x, p.z, Math.cos(a) * .5, Math.sin(a) * .5);
        if (!dry(edge.x, edge.z) || blocked(edge.x, edge.z, .1)) { clear = false; break; }
      }
      if (clear) return { x: p.x, z: p.z };
    }
  }
  return undefined;
}
