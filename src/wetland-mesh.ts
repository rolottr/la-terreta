import * as T from "three";
import { point } from "./geometry";
import { edgeDistance, type WetlandPoint } from "./wetland-layout";

/** Triangulate concave shorelines and islands, then subdivide onto the globe. */
export function wetlandGeometry(
  outline: WetlandPoint[],
  holes: WetlandPoint[][] = [],
  height = 0.12,
) {
  const contours = [outline, ...holes];
  const all = contours.flat();
  const triangles = T.ShapeUtils.triangulateShape(
    outline.map((p) => new T.Vector2(p.x, p.z)),
    holes.map((h) => h.map((p) => new T.Vector2(p.x, p.z))),
  );
  const positions: number[] = [],
    normals: number[] = [],
    uv: number[] = [],
    depths: number[] = [];
  function triangle(a: WetlandPoint, b: WetlandPoint, c: WetlandPoint) {
    const length = (p: WetlandPoint, q: WetlandPoint) =>
      Math.hypot((p.x - q.x) * Math.cos((p.z + q.z) / 200), p.z - q.z);
    const lengths = [length(a, b), length(b, c), length(c, a)];
    const max = Math.max(...lengths);
    if (max > 2) {
      const midpoint = (p: WetlandPoint, q: WetlandPoint) => ({
        x: (p.x + q.x) / 2,
        z: (p.z + q.z) / 2,
      });
      if (lengths[0] === max) {
        const m = midpoint(a, b);
        triangle(a, m, c);
        triangle(m, b, c);
      } else if (lengths[1] === max) {
        const m = midpoint(b, c);
        triangle(a, b, m);
        triangle(a, m, c);
      } else {
        const m = midpoint(c, a);
        triangle(a, b, m);
        triangle(m, b, c);
      }
      return;
    }
    const av = point(a.x, a.z),
      bv = point(b.x, b.z),
      cv = point(c.x, c.z);
    const outward = bv.sub(av).cross(cv.sub(av)).dot(av) > 0;
    for (const p of outward ? [a, b, c] : [a, c, b]) {
      const v = point(p.x, p.z, height);
      positions.push(...v.toArray());
      normals.push(...v.normalize().toArray());
      uv.push(p.x, p.z);
      depths.push(Math.min(...contours.map((poly) => edgeDistance(p, poly))));
    }
  }
  triangles.forEach(([a, b, c]) => triangle(all[a], all[b], all[c]));
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  g.setAttribute("normal", new T.Float32BufferAttribute(normals, 3));
  g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  g.setAttribute("shoreDistance", new T.Float32BufferAttribute(depths, 1));
  return g;
}
export function shoreMesh(
  outline: WetlandPoint[],
  color: string,
  height = 0.035,
  holes: WetlandPoint[][] = [],
) {
  const g = wetlandGeometry(outline, holes, height);
  const material = new T.MeshStandardMaterial({
    color,
    roughness: 1,
    side: T.DoubleSide,
  });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = "varying vec2 vSandUv;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nvSandUv=uv;",
    );
    shader.fragmentShader = "varying vec2 vSandUv;\n" + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
      float grain=fract(sin(dot(floor(vSandUv*90.),vec2(127.1,311.7)))*43758.5453);
      float ripples=sin(vSandUv.x*6.+sin(vSandUv.y*.9)*2.);
      diffuseColor.rgb*=.94+grain*.09+ripples*.025;`,
    );
  };
  const mesh = new T.Mesh(g, material);
  mesh.receiveShadow = true;
  mesh.userData.walkable = true;
  return mesh;
}
