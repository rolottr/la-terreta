import { advance } from "./navigation";
import { BIKE_RADIUS, WALK_RADIUS, type MotionPose } from "./locomotion";

/** Find room for the larger bike and a clear departure without crossing a wall. */
export function findBikeMount(
  pose: MotionPose,
  blocked: (x: number, z: number, radius: number) => boolean,
): MotionPose | undefined {
  // Try the current position first, then nearby positions in distance order.
  for (let ring = 0; ring <= 6; ring++) {
    for (let direction = 0; direction < (ring ? 16 : 1); direction++) {
      const bearing = pose.heading + direction * Math.PI / 8;
      const metres = ring * .35;
      const position = advance(pose.x, pose.z, bearing, 0, 1, metres);
      if (blocked(position.x, position.z, BIKE_RADIUS)) continue;
      let reachable = true;
      for (let step = .1; step < metres; step += .1) {
        const p = advance(pose.x, pose.z, bearing, 0, 1, step);
        if (blocked(p.x, p.z, WALK_RADIUS)) { reachable = false; break; }
      }
      if (!reachable) continue;
      const originalHeading = pose.heading + position.yaw - bearing;
      // Prefer the existing heading, then the smallest turn to either side.
      for (let turn = 0; turn < 16; turn++) {
        const heading = originalHeading + Math.ceil(turn / 2) * (turn % 2 ? 1 : -1) * Math.PI / 8;
        let clear = true;
        for (let step = .25; step <= 2; step += .25) {
          const p = advance(position.x, position.z, heading, 0, 1, step);
          if (blocked(p.x, p.z, BIKE_RADIUS)) { clear = false; break; }
        }
        if (clear) return { x: position.x, z: position.z, yaw: heading, heading };
      }
    }
  }
}
