import * as T from "three";

export interface WetlandPoint {
  x: number;
  z: number;
}
// The lagoon occupies the open southern face, clear of the tram at z=-12.
// A dune spit separates fresh water from the sea; the gola cuts through it.
function contour(points: number[][]) {
  const curve = new T.CatmullRomCurve3(
    points.map(([x, z]) => new T.Vector3(x, 0, z)),
    true,
    "centripetal",
  );
  return curve
    .getPoints(points.length * 7)
    .slice(0, -1)
    .map((p) => ({ x: p.x, z: p.z }));
}
export const lagoonOutline = contour([
  [-216, -37],
  [-190, -28],
  [-166, -34],
  [-143, -25],
  [-119, -31],
  [-97, -25],
  [-72, -30],
  [-59, -47],
  [-75, -62],
  [-61, -83],
  [-80, -102],
  [-117, -119],
  [-152, -125],
  [-178, -111],
  [-188, -95],
  [-216, -91],
  [-228, -73],
  [-221, -54],
]);
export const seaOutline = contour([
  [-292, -23],
  [-269, -24],
  [-252, -32],
  [-245, -47],
  [-249, -65],
  [-242, -82],
  [-236, -101],
  [-247, -125],
  [-278, -133],
  [-305, -113],
  [-312, -80],
  [-309, -47],
]);
export const channelOutline = contour([
  [-251, -61],
  [-237, -60],
  [-221, -64],
  [-216, -70],
  [-232, -68],
  [-250, -68],
]);
export const islands = [
  contour([
    [-166, -62],
    [-155, -60],
    [-151, -67],
    [-160, -71],
    [-170, -67],
  ]),
  contour([
    [-112, -88],
    [-101, -85],
    [-96, -91],
    [-105, -98],
    [-116, -95],
  ]),
  contour([
    [-198, -47],
    [-189, -45],
    [-184, -50],
    [-194, -54],
  ]),
];
export const boatDocks = [
  { id: "el-palmar", name: "El Palmar", x: -98, z: -27, landZ: -19, endZ: -31, launch: {x:-98,z:-35}, yaw: Math.PI },
  { id: "reed-islands", name: "Illes de canyís", x: -143, z: -26, landZ: -20, endZ: -31, launch: {x:-143,z:-35}, yaw: Math.PI },
  { id: "western-lagoon", name: "Racó de l’Albufera", x: -180, z: -30, landZ: -24, endZ: -37, launch: {x:-180,z:-41}, yaw: Math.PI },
  { id: "southern-marsh", name: "Tancat de la Pipa", x: -126, z: -117, landZ: -126, endZ: -112, launch: {x:-126,z:-106}, yaw: 0 },
  { id: "eastern-bank", name: "Riba de llevant", x: -68, z: -56, landZ: -62, endZ: -53, launch: {x:-68,z:-47}, yaw: 0 },
  { id: "western-bank", name: "Riba de ponent", x: -218, z: -44, landZ: -38, endZ: -47, launch: {x:-218,z:-53}, yaw: Math.PI },
];
export const boatDock = boatDocks[0];
export const boatLaunch = boatDocks[0].launch;
export const lagoonVisit = { x: -98, z: -19 };
export const beachVisit = { x: -242, z: -40 };
export function inside(p: WetlandPoint, polygon: WetlandPoint[]) {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i],
      b = polygon[j];
    if (
      a.z > p.z !== b.z > p.z &&
      p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x
    )
      hit = !hit;
  }
  return hit;
}
export function edgeDistance(p: WetlandPoint, polygon: WetlandPoint[]) {
  const scale = Math.cos(p.z / 100);
  let best = Infinity;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i],
      b = polygon[(i + 1) % polygon.length];
    const vx = (b.x - a.x) * scale,
      vz = b.z - a.z,
      px = (p.x - a.x) * scale,
      pz = p.z - a.z;
    const t = Math.max(
      0,
      Math.min(1, (px * vx + pz * vz) / (vx * vx + vz * vz || 1)),
    );
    best = Math.min(best, Math.hypot(px - t * vx, pz - t * vz));
  }
  return best;
}
export function waterAt(x: number, z: number): "lagoon" | "sea" | null {
  if (z > -20 || z < -138 || x > -50 || x < -317) return null;
  const p = { x, z };
  if (islands.some((poly) => inside(p, poly))) return null;
  if (inside(p, lagoonOutline) || inside(p, channelOutline)) return "lagoon";
  return inside(p, seaOutline) ? "sea" : null;
}
export function reserveAt(x: number, z: number, margin = 5) {
  if (z > -19 || z < -142 || x > -45 || x < -320) return false;
  const p = { x, z };
  return [lagoonOutline, seaOutline, channelOutline].some(
    (poly) => inside(p, poly) || edgeDistance(p, poly) < margin,
  );
}
export function navigable(x: number, z: number, margin = 1.5) {
  const p = { x, z };
  return (
    waterAt(x, z) === "lagoon" &&
    inside(p, lagoonOutline) &&
    edgeDistance(p, lagoonOutline) > margin &&
    islands.every((poly) => !inside(p, poly) && edgeDistance(p, poly) > margin)
  );
}
export function onJetty(x: number, z: number) {
  return boatDocks.some(dock => Math.abs((x-dock.x)*Math.cos(z/100)) < 1.6 &&
    z >= Math.min(dock.landZ,dock.endZ)-.5 && z <= Math.max(dock.landZ,dock.endZ)+.5);
}
export function onFootbridge(x: number, z: number) {
  return Math.abs((x + 236) * Math.cos(z / 100)) < 1.5 && z <= -58 && z >= -72;
}
export function expanded(poly: WetlandPoint[], metres: number) {
  const center = poly.reduce(
    (a, p) => ({ x: a.x + p.x / poly.length, z: a.z + p.z / poly.length }),
    { x: 0, z: 0 },
  );
  return poly.map((p) => {
    const dx = (p.x - center.x) * Math.cos(p.z / 100),
      dz = p.z - center.z,
      len = Math.hypot(dx, dz);
    return {
      x: p.x + ((dx / len) * metres) / Math.cos(p.z / 100),
      z: p.z + (dz / len) * metres,
    };
  });
}
