import * as T from "three";
import { R } from "./data";
import { point } from "./geometry";

// Protect the new high terrace edges. Existing low decks keep their step-on behavior.
export function blocksHeightStep(from: number, to: number) {
  return Math.max(from, to) > 1 && Math.abs(to - from) > .32;
}

interface FloorTriangle {
  shape: T.Triangle;
  bounds: T.Box3;
  maxRadius: number;
  lastQuery: number;
}

// Static floor triangles, indexed in world space. This also works at the poles
// and longitude seam, and samples the rendered surface rather than a fixed shell.
export class Ground {
  private cells = new Map<string, FloorTriangle[]>();
  private readonly cellSize = 2;
  private ray = new T.Ray();
  private hit = new T.Vector3();
  private end = new T.Vector3();
  private maxRadius = R + .5;
  private query = 0;

  add(geometry: T.BufferGeometry, matrix = new T.Matrix4()) {
    const positions = geometry.getAttribute("position"),
      index = geometry.index;
    const count = index ? index.count : positions.count;
    for (let i = 0; i < count; i += 3) {
      const vertices = [0, 1, 2].map((j) =>
        new T.Vector3()
          .fromBufferAttribute(positions, index ? index.getX(i + j) : i + j)
          .applyMatrix4(matrix),
      );
      const bounds = new T.Box3().setFromPoints(vertices);
      const triangle: FloorTriangle = {
        shape: new T.Triangle(...vertices),
        lastQuery: -1,
        bounds,
        maxRadius: Math.max(...vertices.map((v) => v.length())),
      };
      this.maxRadius = Math.max(this.maxRadius, triangle.maxRadius + .05);
      this.eachCell(bounds.min, bounds.max, (key) => {
        let cell = this.cells.get(key);
        if (!cell) this.cells.set(key, (cell = []));
        cell.push(triangle);
      });
    }
  }

  addDeck(matrix: T.Matrix4, width: number, depth: number, height: number) {
    const geometry = new T.PlaneGeometry(width, depth);
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, height, 0);
    this.add(geometry, matrix);
    geometry.dispose();
  }

  heightAt(x: number, z: number) {
    return this.heightAlong(point(x, z));
  }

  nearby(position: T.Vector3, radius = 0.55) {
    const bounds = new T.Box3(position.clone(), position.clone()).expandByScalar(radius);
    const found = new Set<FloorTriangle>();
    this.eachCell(bounds.min, bounds.max, (key) => {
      for (const triangle of this.cells.get(key) || [])
        if (triangle.bounds.intersectsBox(bounds)) found.add(triangle);
    });
    return [...found].sort((a, b) => b.maxRadius - a.maxRadius);
  }

  heightAlong(position: T.Vector3, nearby?: FloorTriangle[]) {
    this.ray.direction.copy(position).normalize().negate();
    this.ray.origin.copy(this.ray.direction).multiplyScalar(-this.maxRadius);
    this.end.copy(this.ray.direction).multiplyScalar(-(R - 1.1));
    let height = -1;
    const query = ++this.query;
    const sample = (triangles: FloorTriangle[]) => {
      for (const triangle of triangles) {
        // A floor triangle can belong to several crossed cells. Test it once.
        if (triangle.lastQuery === query) continue;
        triangle.lastQuery = query;
        if (triangle.maxRadius - R < height - 1e-8) continue;
        const { a, b, c } = triangle.shape;
        if (
          this.ray.intersectTriangle(
            a, b, c, false, this.hit,
          )
        )
          height = Math.max(height, this.hit.length() - R);
      }
    };
    if (nearby) sample(nearby);
    else this.eachCell(this.ray.origin, this.end, (key) => sample(this.cells.get(key) || []));
    return height;
  }

  private eachCell(a: T.Vector3, b: T.Vector3, visit: (key: string) => void) {
    const s = this.cellSize;
    const x0 = Math.floor(Math.min(a.x, b.x) / s),
      x1 = Math.floor(Math.max(a.x, b.x) / s),
      y0 = Math.floor(Math.min(a.y, b.y) / s),
      y1 = Math.floor(Math.max(a.y, b.y) / s),
      z0 = Math.floor(Math.min(a.z, b.z) / s),
      z1 = Math.floor(Math.max(a.z, b.z) / s);
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++)
        for (let z = z0; z <= z1; z++)
          visit(`${x}:${y}:${z}`);
  }
}
