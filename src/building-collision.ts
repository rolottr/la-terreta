import * as T from "three";
import { R } from "./data";
import { point } from "./geometry";

type Vertex = { x: number; z: number; height: number };
type Footprint = [T.Vector2, T.Vector2, T.Vector2];

function clip(vertices: Vertex[], height: number, above: boolean) {
  const result: Vertex[] = [];
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i], b = vertices[(i + 1) % vertices.length];
    const insideA = above ? a.height >= height : a.height <= height;
    const insideB = above ? b.height >= height : b.height <= height;
    if (insideA) result.push(a);
    if (insideA !== insideB) {
      const t = (height - a.height) / (b.height - a.height);
      result.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, height });
    }
  }
  return result;
}

function touches(p: T.Vector2, triangle: Footprint, radius: number) {
  const sides: number[] = [];
  for (let i = 0; i < 3; i++) {
    const a = triangle[i], b = triangle[(i + 1) % 3];
    const x = b.x - a.x, y = b.y - a.y;
    const t = T.MathUtils.clamp(((p.x - a.x) * x + (p.y - a.y) * y) / (x * x + y * y || 1), 0, 1);
    if ((p.x - a.x - t * x) ** 2 + (p.y - a.y - t * y) ** 2 <= radius * radius) return true;
    sides.push(x * (p.y - a.y) - y * (p.x - a.x));
  }
  // Vertical walls project to a line. Only nondegenerate triangles have an interior.
  return sides.every(s => s > 1e-10) || sides.every(s => s < -1e-10);
}

/** Collision follows the loaded mesh at body height, including its scale and rotation.
 * Low paving remains passable; roof spans above the player do not become walls.
 */
export class BuildingCollision {
  private readonly cells = new Map<string, Footprint[]>();
  private readonly inverse: T.Matrix4;
  private readonly center: T.Vector3;
  private readonly scale: number;
  private radius = 0;
  private readonly cellSize = 2;

  constructor(mesh: T.Mesh) {
    mesh.updateWorldMatrix(true, false);
    this.inverse = mesh.matrixWorld.clone().invert();
    this.center = mesh.getWorldPosition(new T.Vector3());
    this.scale = mesh.getWorldScale(new T.Vector3()).x;
    const positions = mesh.geometry.getAttribute("position"), index = mesh.geometry.index;
    const local = new T.Vector3(), world = new T.Vector3();
    for (let i = 0; i < (index?.count ?? positions.count); i += 3) {
      const vertices = [0, 1, 2].map(j => {
        local.fromBufferAttribute(positions, index ? index.getX(i + j) : i + j);
        world.copy(local).applyMatrix4(mesh.matrixWorld);
        return { x: local.x, z: local.z, height: world.length() - R };
      });
      // Measure above the curved world, not above the building's tangent plane.
      const polygon = clip(clip(vertices, .65, true), 1.9, false);
      for (let j = 1; j + 1 < polygon.length; j++) {
        const triangle: Footprint = [polygon[0], polygon[j], polygon[j + 1]].map(v => new T.Vector2(v.x, v.z)) as Footprint;
        const bounds = new T.Box2().setFromPoints(triangle);
        for (const v of triangle) this.radius = Math.max(this.radius, v.length() * this.scale);
        this.eachCell(bounds.min.x, bounds.min.y, bounds.max.x, bounds.max.y, key => {
          if (!this.cells.has(key)) this.cells.set(key, []);
          this.cells.get(key)!.push(triangle);
        });
      }
    }
  }

  blocked(x: number, z: number, radius: number) {
    const position = point(x, z);
    if (position.distanceToSquared(this.center) > (this.radius + radius + .5) ** 2) return false;
    position.applyMatrix4(this.inverse);
    const p = new T.Vector2(position.x, position.z), r = radius / this.scale;
    let blocked = false;
    this.eachCell(p.x - r, p.y - r, p.x + r, p.y + r, key => {
      if (!blocked) blocked = (this.cells.get(key) ?? []).some(triangle => touches(p, triangle, r));
    });
    return blocked;
  }

  private eachCell(minX: number, minZ: number, maxX: number, maxZ: number, visit: (key: string) => void) {
    for (let x = Math.floor(minX / this.cellSize); x <= Math.floor(maxX / this.cellSize); x++)
      for (let z = Math.floor(minZ / this.cellSize); z <= Math.floor(maxZ / this.cellSize); z++) visit(`${x}:${z}`);
  }
}
