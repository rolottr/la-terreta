import { normalizeActivities, type ActivitySave } from "./activity-catalogue";
import { t } from "./i18n";
import { defaultAppearance, normalizeAppearance, type Appearance } from "./appearance";
export const R = 100;
export const C = 2 * Math.PI * R;
// Use the same arrival area for labels, place details and discoveries.
export const PLACE_ARRIVAL_RADIUS = 18.5;
export const wrap = (x: number) => ((((x + C / 2) % C) + C) % C) - C / 2;
export const dx = (a: number, b: number) => wrap(a - b);
export const distance = (
  a: { x: number; z: number },
  b: { x: number; z: number },
) => {
  const latA = a.z / R,
    latB = b.z / R;
  const h =
    Math.sin((latB - latA) / 2) ** 2 +
    Math.cos(latA) * Math.cos(latB) * Math.sin(dx(a.x, b.x) / R / 2) ** 2;
  return (
    2 * R * Math.atan2(Math.sqrt(Math.min(1, h)), Math.sqrt(Math.max(0, 1 - h)))
  );
};
export interface Place {
  id: string;
  name: string;
  short: string;
  x: number;
  z: number;
  color: string;
  kind: string;
  text: string;
  tip: string;
  model?: string;
  size?: number;
}
export const places: Place[] = [
  {
    id: "serranos",
    name: "Torres dels Serrans",
    short: "Serrans",
    x: 0,
    z: 22,
    color: "#bf8250",
    get kind() { return t("place.serranos.kind"); },
    model: "serranos",
    size: 10,
    get text() { return t("place.serranos.text"); },
    get tip() { return t("place.serranos.tip"); },
  },
  {
    id: "oldtown",
    name: "Ciutat Vella",
    short: "Ciutat Vella",
    x: 42,
    z: 58,
    color: "#c57a66",
    get kind() { return t("place.oldtown.kind"); },
    model: "cathedral",
    size: 11,
    get text() { return t("place.oldtown.text"); },
    get tip() { return t("place.oldtown.tip"); },
  },
  {
    id: "townhall",
    name: "Plaça de l’Ajuntament",
    short: "Ajuntament",
    x: 98,
    z: 18,
    color: "#b99856",
    get kind() { return t("place.townhall.kind"); },
    model: "townhall",
    size: 14,
    get text() { return t("place.townhall.text"); },
    get tip() { return t("place.townhall.tip"); },
  },
  {
    id: "station",
    name: "Estació del Nord",
    short: "Estació del Nord",
    x: 156,
    z: 7,
    color: "#bf863e",
    get kind() { return t("place.station.kind"); },
    model: "station",
    size: 15,
    get text() { return t("place.station.text"); },
    get tip() { return t("place.station.tip"); },
  },
  {
    id: "bullring",
    name: "Plaça de Bous",
    short: "Plaça de Bous",
    x: 196,
    z: -67,
    color: "#bc674e",
    get kind() { return t("place.bullring.kind"); },
    model: "bullring",
    size: 11,
    get text() { return t("place.bullring.text"); },
    get tip() { return t("place.bullring.tip"); },
  },
  {
    id: "science",
    name: "Ciutat de les Arts i les Ciències",
    short: "Arts i Ciències",
    x: 246,
    z: 45,
    color: "#408f9e",
    get kind() { return t("place.science.kind"); },
    model: "hemisferic",
    size: 16,
    get text() { return t("place.science.text"); },
    get tip() { return t("place.science.tip"); },
  },
  {
    id: "aqua",
    name: "Aqua Multiespacio",
    short: "Aqua",
    x: 289,
    z: 78,
    color: "#579a9d",
    get kind() { return t("place.aqua.kind"); },
    model: "aqua",
    size: 12,
    get text() { return t("place.aqua.text"); },
    get tip() { return t("place.aqua.tip"); },
  },
  {
    id: "beach",
    name: "El Saler · La Devesa",
    short: "La Devesa",
    x: -242,
    z: -40,
    color: "#d7ad65",
    get kind() { return t("place.beach.kind"); },
    size: 8,
    get text() { return t("place.beach.text"); },
    get tip() { return t("place.beach.tip"); },
  },
  {
    id: "university",
    name: "Universitat de València",
    short: "Universitat",
    x: -198,
    z: 70,
    color: "#8b9484",
    get kind() { return t("place.university.kind"); },
    model: "university",
    size: 12,
    get text() { return t("place.university.text"); },
    get tip() { return t("place.university.tip"); },
  },
  {
    id: "albufera",
    name: "L’Albufera",
    short: "Albufera",
    x: -98,
    z: -19,
    color: "#739976",
    get kind() { return t("place.albufera.kind"); },
    model: "barraca",
    size: 7,
    get text() { return t("place.albufera.text"); },
    get tip() { return t("place.albufera.tip"); },
  },
  {
    id: "turia",
    name: "Jardí del Túria",
    short: "Jardí del Túria",
    x: -65,
    z: 25,
    color: "#729668",
    get kind() { return t("place.turia.kind"); },
    size: 6,
    get text() { return t("place.turia.text"); },
    get tip() { return t("place.turia.tip"); },
  },
];
export const stops = Array.from({ length: 6 }, (_, i) => ({
  x: wrap((i * C) / 6),
  z: -12,
  get name() { return t((["stop.0", "stop.1", "stop.2", "stop.3", "stop.4", "stop.5"] as const)[i]); },
}));
// The station has its own stop between Ajuntament and Arts i Ciències.
stops.splice(2, 0, { x: places[3].x, z: -12, name: "Estació del Nord" });
export const docks = places.map((p) => ({
  x: p.id === "station" ? wrap(places[3].x + 18) : p.id === "albufera" ? -108 : p.id === "beach" ? -235 : wrap(p.x - (p.id === "townhall" ? 9 : 4.2) / Math.cos(p.z / R)),
  z: p.id === "station" ? -3 : p.id === "albufera" ? -19 : p.id === "beach" ? -40 : p.z - 14,
}));
export const spawn = { x: 0, z: 5 };
export const SAVE_KEY = "valencia-little-world-v1";
export const memoryNames = {
  horchata: "Horchata at the café",
  waterside: "A quiet moment by the water",
  procession: "A walk with the band",
  photograph: "A portrait of Serranos",
  courtyard: "The fountain courtyard",
  "orange-clearing": "Among the orange trees",
  "roof-terrace": "Above the old town",
} as const;
export type MemoryId = keyof typeof memoryNames;
export interface SavedBoat {
  id: string;
  x: number;
  z: number;
  heading: number;
  landX: number;
  landZ: number;
}
export interface SavedBike { id: string; x: number; z: number; heading: number; dock?: number }
export interface Save {
  version: 3;
  activities: ActivitySave;
  boats?: SavedBoat[];
  bikes?: SavedBike[];
  character: "male" | "female";
  appearance: Appearance;
  visited: string[];
  bikeTrip: boolean;
  tramTrip: boolean;
  memories: MemoryId[];
  dayElapsed: number;
  x: number;
  z: number;
}
export function readSave(): Save {
  try {
    const a = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
    if (a && Array.isArray(a.visited)) {
      const oldTramSave =
        (!Number.isFinite(a.version) || a.version < 2) && Number.isFinite(a.x) && Math.abs(a.z + 12) < 0.01;
      const safeStop = oldTramSave
        ? stops.reduce((s, t) =>
            Math.abs(dx(a.x, s.x)) < Math.abs(dx(a.x, t.x)) ? s : t,
          )
        : null;
      return {
        version: 3,
        activities: normalizeActivities(a.activities, Array.isArray(a.memories) ? a.memories : []),
        boats: Array.isArray(a.boats) ? a.boats.slice(0, 16).filter((boat: SavedBoat) => boat &&
          typeof boat.id === "string" && [boat.x, boat.z, boat.heading, boat.landX, boat.landZ].every(Number.isFinite)) : [],
        bikes: Array.isArray(a.bikes) ? a.bikes.slice(0, docks.length * 3).filter((bike: SavedBike) => bike &&
          typeof bike.id === "string" && [bike.x, bike.z, bike.heading].every(Number.isFinite) &&
          Math.abs(bike.z) < Math.PI * R / 2).map(({id,x,z,heading,dock}: SavedBike) => ({id,x:wrap(x),z,heading,dock})) : [],
        character: a.character === "female" ? "female" : "male",
        appearance: normalizeAppearance(a.appearance),
        visited: a.visited.filter((x: unknown) =>
          places.some((p) => p.id === x),
        ),
        bikeTrip: a.bikeTrip === true,
        tramTrip: a.tramTrip === true,
        memories: Array.isArray(a.memories) ? [...new Set(a.memories.filter((id: unknown): id is MemoryId =>
          typeof id === "string" && Object.hasOwn(memoryNames, id)))] as MemoryId[] : [],
        dayElapsed: Number.isFinite(a.dayElapsed) ? Math.max(0, Math.min(1200, a.dayElapsed)) : 0,
        x: safeStop ? safeStop.x : Number.isFinite(a.x) ? wrap(a.x) : 0,
        z: safeStop
          ? -8.5
          : Number.isFinite(a.z)
            ? Math.max((-Math.PI * R) / 2, Math.min((Math.PI * R) / 2, a.z))
            : 5,
      };
    }
  } catch {}
  return {
    version: 3,
    activities: normalizeActivities(null),
    character: "male",
    appearance: defaultAppearance(),
    visited: [],
    bikeTrip: false,
    tramTrip: false,
    memories: [],
    dayElapsed: 0,
    ...spawn,
  };
}
