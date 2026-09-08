import { places, distance } from "./data";
import { localOffset, offset } from "./navigation";
const center = places.find(p => p.id === "science")!;
export const scienceBuildings = [
  { model: "museum", name: "Museu de les Ciències", east: 0, south: 23, w: 10.4, d: 4.4, scale: .8 },
  { model: "palau_arts", name: "Palau de les Arts", east: -35, south: 2, w: 15, d: 6.5, scale: 1 },
  { model: "umbracle", name: "L’Umbracle", east: 0, south: -31, w: 12, d: 4, scale: 1 },
  { model: "agora", name: "Àgora · CaixaForum", east: 29, south: 2, w: 6.5, d: 4.6, scale: 1 },
  { model: "oceanografic", name: "L’Oceanogràfic", east: -29, south: 29, w: 8, d: 8, scale: 1 },
].map(p => ({ ...p, ...offset(center.x, center.z, p.east, p.south) }));
export function inScienceCampus(p: { x: number; z: number }) {
  return scienceBuildings.some(b => distance(p, b) < Math.hypot(b.w, b.d) + 5);
}

/** Keep street props outside the buildings, while retaining the plaza lamps. */
export function inScienceBuilding(p: { x: number; z: number }, margin = 0) {
  return scienceBuildings.some(b => {
    if (distance(p, b) > Math.hypot(b.w, b.d) + margin * 2) return false;
    const q = localOffset(p.x, p.z, b.x, b.z);
    return Math.abs(q.x) < b.w + margin && Math.abs(q.z) < b.d + margin;
  });
}
