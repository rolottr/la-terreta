import * as T from "three";
import { point } from "./geometry";
import { offset } from "./navigation";
import { seaOutline, inside } from "./wetland-layout";
import { BEACH_WAVES_GLSL, WATER_LEVEL } from "./beach-water";

/** One bounded strip lets broken waves run onto sand and drain back to the sea. */
export function createBeachSurf(heightAt: (x: number, z: number) => number) {
  const coast = seaOutline.filter((p) => p.x > -270 && p.z > -58 && p.z < -26);
  const positions: number[] = [],
    normals: number[] = [],
    uv: number[] = [],
    ground: number[] = [],
    indices: number[] = [];
  const across = [-1.8, -0.9, 0, 0.25, 0.5, 0.75, 1.0];
  for (const [i, p] of coast.entries()) {
    const a = coast[Math.max(0, i - 1)],
      b = coast[Math.min(coast.length - 1, i + 1)],
      scale = Math.cos(p.z / 100);
    let nx = b.z - a.z,
      nz = -(b.x - a.x) * scale;
    const length = Math.hypot(nx, nz) || 1;
    nx /= length;
    nz /= length;
    const probe = offset(p.x, p.z, nx * 0.2, nz * 0.2);
    if (inside(probe, seaOutline)) {
      nx = -nx;
      nz = -nz;
    }
    for (const d of across) {
      const q = offset(p.x, p.z, nx * d, nz * d),
        floor = heightAt(q.x, q.z),
        normal = point(q.x, q.z).normalize();
      positions.push(
        ...normal
          .clone()
          .multiplyScalar(100 + floor + 0.008)
          .toArray(),
      );
      normals.push(...normal.toArray());
      uv.push(d, p.z);
      ground.push(floor);
    }
    if (i)
      for (let j = 0; j < across.length - 1; j++) {
        const k = (i - 1) * across.length + j,
          n = k + across.length;
        indices.push(k, n, k + 1, k + 1, n, n + 1);
      }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new T.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  geometry.setAttribute("bedHeight", new T.Float32BufferAttribute(ground, 1));
  geometry.setIndex(indices);
  const material = new T.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    transparent: true,
    depthWrite: false,
    side: T.DoubleSide,
    vertexShader: `uniform float time;attribute float bedHeight;varying vec2 vUv;varying float vWet;varying float vBed;${BEACH_WAVES_GLSL}
    void main(){vUv=uv;vBed=bedHeight;float front=beachRunup(uv.y,time);vWet=1.-smoothstep(front-.18,front+.05,uv.x);
      float level=${WATER_LEVEL}+beachSwell(max(0.,-uv.x),uv.y,time);float h=mix(bedHeight+.008,level+.006,vWet);
      gl_Position=projectionMatrix*modelViewMatrix*vec4(position+normal*(h-bedHeight-.008),1.);}`,
    fragmentShader: `uniform float time;varying vec2 vUv;varying float vWet;varying float vBed;${BEACH_WAVES_GLSL}
    void main(){float edge=beachRunup(vUv.y,time);float fringe=exp(-pow((vUv.x-edge+.10)/.12,2.));
      float lace=.72+.28*sin(vUv.y*5.+sin(vUv.y*1.7-time)*2.);float foam=fringe*lace;
      float incoming=pow(max(0.,sin(max(0.,-vUv.x)*.72+vUv.y*.025+time*1.0471975512)),6.)*(1.-smoothstep(-1.8,-.4,vUv.x));
      float footprint=max(length(dFdx(vUv)),length(dFdy(vUv)));
      float alpha=(vWet*.15+foam*.65+incoming*.24)*(1.-smoothstep(.4,1.5,footprint))*(1.-smoothstep(.065,.075,vBed));
      vec3 color=mix(vec3(.29,.52,.47),vec3(.86,.91,.81),max(foam,incoming));gl_FragColor=vec4(color,alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
  });
  const mesh = new T.Mesh(geometry, material);
  mesh.name = "Beach swash and foam";
  mesh.renderOrder = 3;
  return mesh;
}
