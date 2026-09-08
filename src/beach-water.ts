import {
  inside,
  seaOutline,
  waterAt,
  type WetlandPoint,
} from "./wetland-layout";

export const WATER_LEVEL = 0.14;
const smooth = (a: number, b: number, x: number) => {
  const u = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

/** Closest coast point and inward surface direction, measured in metres. */
export function coastSample(p: WetlandPoint) {
  const scale = Math.cos(p.z / 100);
  let best = Infinity,
    nx = 1,
    nz = 0;
  for (let i = 0; i < seaOutline.length; i++) {
    const a = seaOutline[i],
      b = seaOutline[(i + 1) % seaOutline.length];
    const vx = (b.x - a.x) * scale,
      vz = b.z - a.z,
      px = (p.x - a.x) * scale,
      pz = p.z - a.z;
    const u = Math.max(
      0,
      Math.min(1, (px * vx + pz * vz) / (vx * vx + vz * vz || 1)),
    );
    const x = px - u * vx,
      z = pz - u * vz,
      d = Math.hypot(x, z);
    if (d < best) {
      best = d;
      const length = Math.hypot(vx, vz) || 1;
      nx = d > 0.0001 ? x / d : vz / length;
      nz = d > 0.0001 ? z / d : -vx / length;
    }
  }
  const wet = inside(p, seaOutline);
  // The normal always points towards deeper water, including outside the edge.
  if (!wet) {
    nx = -nx;
    nz = -nz;
  }
  return { distance: best, nx, nz, wet };
}
export function beachSwell(shore: number, along: number, time: number) {
  const fade = smooth(0, 0.45, shore),
    shoal = 0.065 + 0.025 * Math.exp(-Math.pow((shore - 2.5) / 3, 2));
  const phase = shore * 0.72 + along * 0.025 + time * 1.0471975512;
  return (
    fade *
    shoal *
    (Math.sin(phase) +
      0.22 * Math.sin(shore * 1.35 - along * 0.06 + time * 1.61))
  );
}
export function beachRunup(along: number, time: number) {
  const pulse = (Math.sin(time * 1.0471975512 + along * 0.025) + 1) * 0.5;
  return 0.2 + 0.5 * pulse * pulse;
}
export function beachRunupArea(x: number, z: number) {
  return x > -270 && x < -235 && z > -58 && z < -26;
}
export function beachContact(
  x: number,
  z: number,
  time: number,
  ground: number,
  water = waterAt(x, z),
) {
  if (water !== "sea" && !beachRunupArea(x, z)) return null;
  if (water === "lagoon") return null;
  const coast = coastSample({ x, z });
  if (!coast.wet && coast.distance > 1) return null;
  // Planks and raised paths stay dry. The sand shelf remains a solid floor.
  if (ground >= 0.075) return { height: ground, depth: 0, wet: 0 };
  const wet = coast.wet
    ? 1
    : 1 -
      smooth(
        beachRunup(z, time) - 0.18,
        beachRunup(z, time) + 0.05,
        coast.distance,
      );
  const height = coast.wet
    ? WATER_LEVEL + beachSwell(coast.distance, z, time)
    : ground + (WATER_LEVEL - ground) * wet;
  return { height, depth: Math.max(0, height - ground), wet };
}
export function wadingFactor(depth: number) {
  return Math.max(0.48, Math.min(1, 1 / (1 + Math.max(0, depth) * 3.4)));
}

// Shared field used by the sea and its thin swash layer. The CPU sample above
// drives wading and foot ripples, so the visible water and response use one clock.
export const BEACH_WAVES_GLSL = `
float beachSwell(float shore,float along,float time){
 float fade=smoothstep(0.,.45,shore);
 float shoal=.065+.025*exp(-pow((shore-2.5)/3.,2.));
 float phase=shore*.72+along*.025+time*1.0471975512;
 return fade*shoal*(sin(phase)+.22*sin(shore*1.35-along*.06+time*1.61));
}
float beachRunup(float along,float time){float p=(sin(time*1.0471975512+along*.025)+1.)*.5;return .2+.5*p*p;}
`;
