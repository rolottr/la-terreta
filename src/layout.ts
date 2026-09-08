import { inScienceCampus } from "./science-layout";
import { hiddenPlaces } from "./immersion-sites";
import { reserveAt } from "./wetland-layout";
import { C, R, distance, places, stops } from "./data";
import { localOffset, offset } from "./navigation";
import { fieldFallaCenter, isCivicPlaza } from "./civic-plaza";
import { rng } from "./geometry";

export interface Position {
  x: number;
  z: number;
}
export interface Lot extends Position {
  model: string;
  yaw: number;
  scale: number;
}
export interface Route {
  a: Position;
  b: Position;
  width: number;
  garden?: boolean;
}
export const routes: Route[] = [];
export const lots: Lot[] = [];
export const trees: Lot[] = [];
export const fields: (Position & { w: number; d: number; rice: boolean })[] =
  [];
export const polarWalkLongitude = -95;
const random = rng(3602026);

// Leave the station facade and the north tram platform in one open forecourt.
export function inStationForecourt(p: Position) {
  const q = localOffset(p.x, p.z, places[3].x, places[3].z);
  return q.depth > -12 && Math.abs(q.x) < 21 && q.z > -19.5 && q.z < 14;
}

for (const [i, place] of places.entries()) {
  const entry = offset(place.x, place.z, 0, -17);
  const next = places[(i + 1) % places.length];
  routes.push({
    a: entry,
    b: offset(next.x, next.z, 0, -17),
    width: 3.6,
    garden: i > 7,
  });
  const stop = stops.reduce((a, b) =>
    distance(entry, a) < distance(entry, b) ? a : b,
  );
  routes.push({ a: entry, b: { x: stop.x, z: -7 }, width: 4 });
  const natural = ["albufera", "beach", "turia"].includes(place.id);
  // Each district has crossing lanes and deep blocks, with clear entry plazas.
  for (const row of [-40, -18, 5, 30, 51]) {
    const a = offset(place.x, place.z, -43, row);
    const b = offset(place.x, place.z, 43, row);
    routes.push({ a, b, width: natural ? 2 : 3.4, garden: natural });
  }
  for (const column of [-43, -20, 20, 43])
    routes.push({
      a: offset(place.x, place.z, column, -43),
      b: offset(place.x, place.z, column, 54),
      width: natural ? 2.2 : 3.4,
      garden: natural,
    });
  for (const row of [-30, -5, 18, 41]) {
    for (const column of [-32, -10, 10, 32]) {
      if (Math.abs(column) < (place.size || 12) + 3 && row > -10 && row < 20)
        continue;
      const p = offset(place.x, place.z, column, row);
      if (
        places.some((q) => q !== place && distance(p, q) < (q.size || 10) + 14)
      )
        continue;
      if (natural && random() > 0.25) continue;
      lots.push({
        ...p,
        model: natural
          ? "cottage"
          : ["cafe", "townhouse", "apartment", "townhouse"][
              Math.floor(random() * 4)
            ],
        yaw: row % 2 ? 0 : Math.PI,
        scale: natural ? 0.85 : 0.88 + random() * 0.16,
      });
    }
  }
  for (let j = 0; j < 35; j++) {
    const angle = j * 2.399963;
    const radius = 19 + random() * 36;
    const p = offset(
      place.x,
      place.z,
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
    );
    if (
      lots.some((l) => distance(p, l) < 7) ||
      distance(p, place) < (place.size || 10) + 5
    )
      continue;
    trees.push({
      ...p,
      model:
        place.id === "beach" ? "palm" : j % 7 === 0 ? "cypress" : "orange_tree",
      yaw: random() * 6.28,
      scale: 0.7 + random() * 0.55,
    });
  }
}

// Close street fronts frame the walk into Serranos and the old city.
for (const place of [places[0], places[1]]) {
  const street: Lot[] = [];
  for (const row of [-46, -32, -18])
    for (const side of [-1, 1]) {
      const p = offset(place.x, place.z, side * 10.5, row);
      street.push({
        ...p,
        model: row === -18 ? "cafe" : "townhouse",
        yaw: side < 0 ? Math.PI / 2 : -Math.PI / 2,
        scale: 0.9,
      });
    }
  for (let i = lots.length - 1; i >= 0; i--)
    if (street.some((l) => distance(l, lots[i]) < 10)) lots.splice(i, 1);
  lots.push(...street);
  for (let i = trees.length - 1; i >= 0; i--)
    if (street.some((l) => distance(l, trees[i]) < 6)) trees.splice(i, 1);
}

// Great-circle walking routes reach both poles and join each hemisphere.
for (const sign of [-1, 1]) {
  const pole = { x: 0, z: (sign * Math.PI * R) / 2 };
  for (const x of [-230, -80, 70, 220]) {
    const shoulder = { x, z: sign * 103 };
    routes.push({ a: shoulder, b: pole, width: 2.4, garden: true });
    const p = places.reduce((a, b) =>
      distance(shoulder, a) < distance(shoulder, b) ? a : b,
    );
    routes.push({
      a: shoulder,
      b: offset(p.x, p.z, 20, 30),
      width: 2.4,
      garden: true,
    });
  }
}

// Equal-area scatter avoids bare caps and crowded longitude seams.
for (let i = 0; i < 1450; i++) {
  const z = Math.asin(1 - (2 * (i + 0.5)) / 1450) * R;
  const x = ((i * 2.399963229728653 * R + C / 2) % C) - C / 2;
  const p = { x, z };
  const near = places.reduce((a, b) =>
    distance(p, a) < distance(p, b) ? a : b,
  );
  if (distance(p, near) < 52 || lots.some((l) => distance(p, l) < 9)) continue;
  if (i % 7 === 0 && Math.abs(z) < 123) {
    fields.push({
      ...p,
      w: 12 + random() * 9,
      d: 12 + random() * 9,
      rice: z < 0,
    });
    if (i % 21 === 0)
      lots.push({
        ...offset(x, z, 11, 0),
        model: "cottage",
        yaw: random() * 6.28,
        scale: 0.8,
      });
  } else if (i % 3 !== 0)
    trees.push({
      ...p,
      model: i % 6 === 0 ? "cypress" : "orange_tree",
      yaw: random() * 6.28,
      scale: 0.65 + random() * 0.6,
    });
}

// Two clear walking loops make a full circuit possible without a map jump.
// One follows the equator. The other crosses both poles.
export function distanceToPolarWalk(p: Position) {
  return Math.abs(
    Math.asin(Math.sin((p.x - polarWalkLongitude) / R) * Math.cos(p.z / R)) * R,
  );
}
for (let i = lots.length - 1; i >= 0; i--)
  if (
    Math.abs(lots[i].z) < 8 ||
    Math.abs(lots[i].z + 12) < 8.8 ||
    distanceToPolarWalk(lots[i]) < 8
  )
    lots.splice(i, 1);
for (let i = trees.length - 1; i >= 0; i--)
  if (
    Math.abs(trees[i].z) < 3 ||
    Math.abs(trees[i].z + 12) < 4.8 ||
    distanceToPolarWalk(trees[i]) < 3
  )
    trees.splice(i, 1);

for (const items of [lots, trees, fields])
  for (let i = items.length - 1; i >= 0; i--)
    if (inStationForecourt(items[i]) || isCivicPlaza(items[i].x, items[i].z)) items.splice(i, 1);
for (const x of [polarWalkLongitude, polarWalkLongitude + C / 2])
  for (const side of [-1, 1])
    routes.push({
      a: { x, z: 0 },
      b: { x, z: (side * Math.PI * R) / 2 },
      width: 3,
      garden: true,
    });

// The wetland owns its shore, vegetation, paths, and water. Keep town scatter out.
for(const items of [lots,trees,fields])
  for(let i=items.length-1;i>=0;i--)if(reserveAt(items[i].x,items[i].z,13))items.splice(i,1);

// Reserve only the new optional places and their continuous entrance paths.
for (const items of [lots, trees, fields])
  for (let i=items.length-1;i>=0;i--)
    if (hiddenPlaces.some(p => distance(items[i], p) < (p.id === "roof-terrace" ? 11 : 12) ||
      distance(items[i], p.entrance) < 5)) items.splice(i,1);

// Use the accepted orange-tree art and its existing distant mesh and camera fade.
for(let i=0;i<13;i++) {
  const angle=i/13*Math.PI*2;if(Math.cos(angle)<-.75)continue;
  const p=hiddenPlaces[1];
  trees.push({...offset(p.x,p.z,Math.sin(angle)*5.7,Math.cos(angle)*5.7),model:"orange_tree",yaw:angle,scale:.65});
}

// The northern walking routes pass working chufa plots, with room for an entrance.
fields.unshift(...[-230, -80, 70, 220].map(x => ({
  ...offset(x, 103, 10, 7), w: 14, d: 12, rice: false,
})));
for (const items of [trees, lots])
  for (let i = items.length - 1; i >= 0; i--)
    if (fields.some(f => {
      const p = localOffset(items[i].x, items[i].z, f.x, f.z);
      return p.depth > -12 && Math.abs(p.x) < f.w / 2 + 2 && Math.abs(p.z) < f.d / 2 + 5;
    })) items.splice(i, 1);

// Keep every new landmark and its entry court clear of generated lots and trees.
for (const items of [lots, trees]) for (let i=items.length-1;i>=0;i--) if(inScienceCampus(items[i])) items.splice(i,1);

const arenaPlace = places.find(p=>p.id === "bullring")!;
for (const items of [lots, trees]) for (let i=items.length-1;i>=0;i--) if(distance(items[i],arenaPlace)<12) items.splice(i,1);

// A small festival clearing beside the northern farm path houses the original falla.
for (const items of [lots, trees, fields])
  for (let i = items.length - 1; i >= 0; i--)
    if (distance(items[i], fieldFallaCenter) < ("w" in items[i] ? 19 : 10)) items.splice(i, 1);
