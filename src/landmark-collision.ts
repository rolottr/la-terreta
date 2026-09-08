import { offset } from "./navigation";

// The station origin is near its front hall. Its train shed extends south,
// so a centred box would block several metres of the visible forecourt.
export function stationCollider(location: { x: number; z: number }) {
  return {
    ...offset(location.x, location.z, 0, 4.67),
    w: 13.05,
    d: 7.5,
  };
}
