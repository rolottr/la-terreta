import * as T from "three";
import { advance } from "./navigation";
import { point } from "./geometry";

export interface MotionPose { x: number; z: number; yaw: number; heading: number }
export interface MotionInput {
  right: number;
  forward: number;
  bike: boolean;
  terrain: number;
}
export const RUN_SPEED = 6.6;
export const BIKE_SPEED = 14;
export const BIKE_REVERSE_SPEED = 4.5;
export const WALK_RADIUS = .4;
export const BIKE_RADIUS = .7;
export const angleDelta = (to: number, from: number) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

/** Velocity and steering stay continuous when a digital key changes. */
export class Locomotion {
  private velocity = new T.Vector2(); // East and south in the local surface frame.
  private driveSpeed = 0;
  private steering = 0;
  private bike = false;
  private slideSide = -1;

  reset() { this.velocity.set(0, 0); this.driveSpeed = this.steering = 0; this.slideSide = -1; }

  step(pose: MotionPose, input: MotionInput, dt: number,
    blocked: (x: number, z: number, radius: number) => boolean) {
    if (input.bike !== this.bike) { this.reset(); this.bike = input.bike; }
    let current = { ...pose }, travelled = 0, signedTravelled = 0, turn = 0;
    // Short steps give the same response at different frame rates and prevent
    // fast bikes from skipping narrow collision boundaries.
    const count = Math.max(1, Math.ceil(dt * 120)), h = dt / count;
    for (let i = 0; i < count; i++) {
      const beforeHeading = current.heading;
      if (input.bike) {
        // Opposite input brakes first; holding it then drives in that direction.
        const braking = input.forward * this.driveSpeed < 0;
        const target = braking ? 0 : input.forward > 0 ? BIKE_SPEED * input.terrain :
          input.forward < 0 ? -BIKE_REVERSE_SPEED * input.terrain : 0;
        this.driveSpeed = T.MathUtils.damp(this.driveSpeed, target, braking ? 7 : target ? (target > 0 ? 1.8 : 3) : 1.5, h);
        if (braking && Math.abs(this.driveSpeed) < .05) this.driveSpeed = 0;
        this.steering = T.MathUtils.damp(this.steering, -input.right * .55, 8, h);
        // Bicycle steering: no strafing or rotation in place. Reduce steering
        // at speed so a held key makes a stable arc instead of a sudden corner.
        const yawRate = this.driveSpeed / 1.3 * Math.tan(this.steering) / (1 + Math.abs(this.driveSpeed) * .24);
        current.heading += yawRate * h;
        this.velocity.set(Math.sin(current.heading), Math.cos(current.heading)).multiplyScalar(this.driveSpeed);
      } else {
        const length = Math.hypot(input.right, input.forward);
        const speed = RUN_SPEED * input.terrain;
        const direction = current.yaw - Math.atan2(input.right, input.forward);
        const target = new T.Vector2(Math.sin(direction), Math.cos(direction)).multiplyScalar(length ? speed * Math.min(1, length) : 0);
        this.velocity.lerp(target, 1 - Math.exp(-(length ? 9 : 16) * h));
        if (this.velocity.length() > .04) {
          const desired = Math.atan2(this.velocity.x, this.velocity.y);
          current.heading += T.MathUtils.clamp(angleDelta(desired, current.heading) * (1 - Math.exp(-14 * h)), -10 * h, 10 * h);
        }
      }
      if (this.velocity.length() < .015) { this.velocity.set(0, 0); this.driveSpeed = 0; }
      const metres = this.velocity.length() * h;
      if (!metres) continue;
      const travelHeading = Math.atan2(this.velocity.x, this.velocity.y);
      const right = Math.sin(current.yaw - travelHeading), forward = Math.cos(current.yaw - travelHeading);
      const radius = input.bike ? BIKE_RADIUS : WALK_RADIUS;
      let next = advance(current.x, current.z, current.yaw, right, forward, metres);
      if (blocked(next.x, next.z, radius)) {
        if (input.bike) {
          // A contact redirects travel along the clear edge. Keep momentum and
          // turn the frame towards that direction so a held pedal input rides
          // past the object instead of repeatedly stopping against it.
          const side = Math.abs(this.steering) > .05 ? Math.sign(this.steering * this.driveSpeed) : this.slideSide;
          let clear = false;
          if (!blocked(current.x, current.z, radius)) {
            for (let step = 1; step <= 6 && !clear; step++) {
              for (const sign of [side, -side]) {
                const deflection = sign * step * Math.PI / 12;
                const direction = travelHeading + deflection;
                const retainedSpeed = Math.abs(this.driveSpeed) * Math.max(.65, Math.cos(deflection));
                const candidate = advance(current.x, current.z, current.yaw,
                  Math.sin(current.yaw - direction), Math.cos(current.yaw - direction), retainedSpeed * h);
                if (blocked(candidate.x, candidate.z, radius)) continue;
                next = candidate;
                this.slideSide = sign;
                this.velocity.set(Math.sin(direction), Math.cos(direction)).multiplyScalar(retainedSpeed);
                const facing = direction + (this.driveSpeed < 0 ? Math.PI : 0);
                current.heading += angleDelta(facing, current.heading) * (1 - Math.exp(-10 * h));
                this.driveSpeed *= Math.exp(-1.8 * h);
                clear = true;
                break;
              }
            }
          }
          if (!clear) {
            // There is no valid travel direction in an enclosed corner. The
            // rider can still brake, reverse, or steer on the following step.
            this.driveSpeed *= Math.exp(-12 * h);
            this.velocity.set(0, 0);
            continue;
          }
        } else {
          // Slide only the clear surface component along a wall. Do not keep
          // animating the blocked component as if it travelled through the wall.
          const candidates = [
            { vx: this.velocity.x, vz: 0 }, { vx: 0, vz: this.velocity.y },
          ].sort((a, b) => Math.hypot(b.vx, b.vz) - Math.hypot(a.vx, a.vz));
          let clear = false;
          for (const v of candidates) {
            if (Math.hypot(v.vx, v.vz) < .015) continue;
            const direction = Math.atan2(v.vx, v.vz);
            const candidate = advance(current.x, current.z, current.yaw,
              Math.sin(current.yaw - direction), Math.cos(current.yaw - direction), Math.hypot(v.vx, v.vz) * h);
            if (!blocked(candidate.x, candidate.z, radius)) {
              next = candidate; this.velocity.set(v.vx, v.vz); clear = true; break;
            }
          }
          if (!clear) { this.velocity.set(0, 0); continue; }
        }
      }
      const moved = point(current.x, current.z).distanceTo(point(next.x, next.z));
      travelled += moved;
      signedTravelled += moved * (input.bike ? Math.sign(this.driveSpeed) : 1);
      // Parallel transport carries velocity, body, and camera across the poles.
      const transport = angleDelta(next.yaw, current.yaw);
      const direction = Math.atan2(this.velocity.x, this.velocity.y) + transport;
      this.velocity.set(Math.sin(direction) * this.velocity.length(), Math.cos(direction) * this.velocity.length());
      turn += angleDelta(current.heading, beforeHeading);
      current = { x: next.x, z: next.z, yaw: next.yaw, heading: current.heading + transport };
      if (input.bike) current.yaw += angleDelta(current.heading, current.yaw) * (1 - Math.exp(-3 * h));
    }
    return { ...current, speed: dt ? travelled / dt : 0, distance: travelled,
      signedSpeed: dt ? signedTravelled / dt : 0, signedDistance: signedTravelled,
      turnRate: dt ? turn / dt : 0, steering: this.steering };
  }
}
