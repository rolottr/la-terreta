import * as T from "three";
import { R, places, distance } from "./data";
import { basis, point } from "./geometry";
import { localOffset, offset } from "./navigation";
import { routes, type Position } from "./layout";
import type { World } from "./world";

const STEP = .5, MIN_X = -8, MIN_Z = -6.5, COLS = 250, ROWS = 160;
const MARGIN = 1.12;

// Use the same great-circle strips that draw the city's streets.
const streets = routes.filter(r => !r.garden && r.width >= 3.2 &&
  Math.min(r.a.x, r.b.x) < 125 && Math.max(r.a.x, r.b.x) > -15 &&
  Math.max(Math.abs(r.a.x), Math.abs(r.b.x)) < 170).map(r => {
    const a = point(r.a.x, r.a.z).normalize(), b = point(r.b.x, r.b.z).normalize();
    return { a, b, axis: a.clone().cross(b).normalize(), angle: a.angleTo(b), width: r.width };
  });
const normal = new T.Vector3(), projected = new T.Vector3(), cross = new T.Vector3();
export function streetDistance(p: Position) {
  normal.copy(point(p.x, p.z)).normalize();
  let clearance = Math.max(1.6 - Math.abs(p.z), 2 - Math.abs(p.z + 6));
  // The new civic square is a broad paved walking surface, with solid landmarks
  // still excluded by the same full-band collision check as every street.
  const civic = localOffset(p.x, p.z, places[2].x, places[2].z);
  if (civic.depth > -15)
    clearance = Math.max(clearance, Math.min(19.5 - Math.abs(civic.x), civic.z + 22.5, 3.5 - civic.z));
  for (const street of streets) {
    const signed = normal.dot(street.axis);
    projected.copy(normal).addScaledVector(street.axis, -signed).normalize();
    const along = Math.atan2(street.axis.dot(cross.copy(street.a).cross(projected)), street.a.dot(projected));
    const d = along >= 0 && along <= street.angle
      ? Math.abs(Math.asin(T.MathUtils.clamp(signed, -1, 1))) * R
      : Math.min(normal.angleTo(street.a), normal.angleTo(street.b)) * R;
    clearance = Math.max(clearance, street.width / 2 - d);
  }
  return clearance;
}

export class ProcessionRoute {
  readonly points: Position[];
  readonly lengths: number[] = [0];
  readonly length: number;
  private normals: T.Vector3[];

  constructor(world: World) {
    const nodes = new Map<number, Position>();
    for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) {
      const p = { x: MIN_X + col * STEP, z: MIN_Z + row * STEP };
      if (streetDistance(p) >= MARGIN && !world.blocked(p.x, p.z, MARGIN) && world.waterFactor(p.x, p.z) === 1)
        nodes.set(row * COLS + col, p);
    }
    const nearest = (p: Position) => {
      let best = -1, d = Infinity;
      for (const [id, candidate] of nodes) {
        const dist = distance(candidate, p);
        if (dist < d) { best = id; d = dist; }
      }
      if (d > 8) throw new Error(`No procession street near ${p.x}, ${p.z}`);
      return best;
    };
    const civicAt = (east: number, south: number) => offset(places[2].x, places[2].z, east, south);
    const goals = [{ x: 0, z: -6 }, { x: 0, z: 0 }, { x: 20, z: 0 },
      civicAt(-12, -15), civicAt(-12, -4), civicAt(12, -4), civicAt(12, -15), civicAt(-12, -15),
      { x: 75, z: -6 }, { x: 35, z: -6 }].map(nearest);
    const path: Position[] = [];
    for (let section = 0; section < goals.length; section++) {
      const start = goals[section], end = goals[(section + 1) % goals.length];
      const open = new Set([start]), cost = new Map([[start, 0]]), score = new Map([[start, distance(nodes.get(start)!, nodes.get(end)!)]]);
      const previous = new Map<number, number>();
      while (open.size) {
        let current = -1, best = Infinity;
        for (const id of open) if (score.get(id)! < best) { current = id; best = score.get(id)!; }
        if (current === end) break;
        open.delete(current);
        const row = Math.floor(current / COLS), col = current % COLS;
        for (const dr of [-1, 0, 1]) for (const dc of [-1, 0, 1]) {
          if (!dr && !dc) continue;
          if (row + dr < 0 || row + dr >= ROWS || col + dc < 0 || col + dc >= COLS) continue;
          const next = current + dr * COLS + dc;
          if (!nodes.has(next) || (dr && dc && (!nodes.has(current + dr * COLS) || !nodes.has(current + dc)))) continue;
          const nextCost = cost.get(current)! + distance(nodes.get(current)!, nodes.get(next)!);
          if (nextCost >= (cost.get(next) ?? Infinity)) continue;
          previous.set(next, current); cost.set(next, nextCost);
          score.set(next, nextCost + distance(nodes.get(next)!, nodes.get(end)!)); open.add(next);
        }
      }
      if (!previous.has(end)) throw new Error(`No clear street route for procession section ${section}`);
      const sectionPath = [end];
      while (sectionPath[sectionPath.length - 1] !== start) sectionPath.push(previous.get(sectionPath[sectionPath.length - 1])!);
      path.push(...sectionPath.reverse().slice(0, -1).map(id => nodes.get(id)!));
    }
    const clear = (a: Position, b: Position) => {
      const samples = Math.ceil(distance(a, b) / .3);
      for (let i = 0; i <= samples; i++) {
        const p = this.interpolate(a, b, i / samples);
        if (streetDistance(p) < MARGIN || world.blocked(p.x, p.z, MARGIN)) return false;
      }
      return true;
    };
    const simplified: Position[] = [];
    for (let i = 0; i < path.length;) {
      simplified.push(path[i]);
      let end = Math.min(path.length - 1, i + 18);
      while (end > i + 1 && !clear(path[i], path[end])) end--;
      i = Math.max(i + 1, end);
    }
    // Two corner-rounding passes, accepted only if they keep the full band clear.
    let rounded = simplified;
    for (let pass = 0; pass < 2; pass++) {
      const next: Position[] = [];
      rounded.forEach((p, i) => {
        const q = rounded[(i + 1) % rounded.length];
        next.push(this.interpolate(p, q, .12), this.interpolate(p, q, .88));
      });
      if (next.every((p, i) => clear(p, next[(i + 1) % next.length]))) rounded = next;
    }
    this.points = rounded;
    this.normals = rounded.map(p => point(p.x, p.z).normalize());
    for (let i = 0; i < rounded.length; i++) this.lengths.push(this.lengths[i] + distance(rounded[i], rounded[(i + 1) % rounded.length]));
    this.length = this.lengths[this.lengths.length - 1];
  }

  private interpolate(a: Position, b: Position, t: number): Position {
    const n = point(a.x, a.z).lerp(point(b.x, b.z), t).normalize();
    return { x: Math.atan2(n.x, n.y) * R, z: Math.asin(n.z) * R };
  }
  private along(metres: number) {
    const d = ((metres % this.length) + this.length) % this.length;
    let low = 0, high = this.points.length;
    while (low + 1 < high) { const middle = (low + high) >> 1; if (this.lengths[middle] <= d) low = middle; else high = middle; }
    const t = (d - this.lengths[low]) / (this.lengths[low + 1] - this.lengths[low]);
    return this.normals[low].clone().lerp(this.normals[(low + 1) % this.points.length], t).normalize();
  }
  sample(metres: number, lane = 0) {
    const n = this.along(metres), tangent = this.along(metres + .5).sub(this.along(metres - .5)).normalize();
    const right = n.clone().cross(tangent).normalize();
    n.multiplyScalar(R).addScaledVector(right, lane).normalize();
    const x = Math.atan2(n.x, n.y) * R, z = Math.asin(n.z) * R, frame = basis(x, z);
    return { x, z, yaw: Math.atan2(tangent.dot(frame.east), tangent.dot(frame.south)) };
  }
}
