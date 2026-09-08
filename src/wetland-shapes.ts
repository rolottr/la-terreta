import clipping, { type Polygon } from "polygon-clipping";
import {
  lagoonOutline,
  seaOutline,
  channelOutline,
  islands,
  type WetlandPoint,
} from "./wetland-layout";
const polygon = (points: WetlandPoint[]): Polygon => [
  points.map((p) => [p.x, p.z]),
];
const joined = clipping.union(
  polygon(lagoonOutline),
  polygon(seaOutline),
  polygon(channelOutline),
);
const asPoints = (polygons: ReturnType<typeof clipping.union>) =>
  polygons.map((rings) =>
    rings.map((ring) => ring.slice(0, -1).map(([x, z]) => ({ x, z }))),
  );
// Boolean shore cuts remove internal seams and submerged sand beneath the gola.
export const waterShapes = asPoints(
  clipping.difference(joined, ...islands.map(polygon)),
);
export function shoreShapes(outline: WetlandPoint[]) {
  return asPoints(clipping.difference(polygon(outline), joined));
}
