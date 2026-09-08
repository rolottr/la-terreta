import * as T from "three";

/** Thin fading ripples trail the stern, following the curved water surface. */
export function boatWake() {
  const positions: number[] = [],
    uv: number[] = [],
    indices: number[] = [];
  for (const side of [-1, 1])
    for (let i = 0; i <= 24; i++)
      for (const edge of [0, 1]) {
        const t = i / 24,
          x = side * (0.48 + t * 1.6 + edge * 0.035),
          z = -2.5 - t * 4;
        positions.push(x, -(x * x + z * z) / 200, z);
        uv.push(edge, t);
        if (i < 24 && edge === 0) {
          const k = positions.length / 3 - 1;
          indices.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
        }
      }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  const material = new T.ShaderMaterial({
    uniforms: { strength: { value: 0 } },
    vertexShader:
      "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader:
      "uniform float strength;varying vec2 vUv;void main(){float a=sin(vUv.x*3.14159)*pow(1.-vUv.y,1.4)*strength;gl_FragColor=vec4(.76,.86,.76,a);}",
    transparent: true,
    depthWrite: false,
    side: T.DoubleSide,
  });
  const mesh = new T.Mesh(geometry, material);
  mesh.renderOrder = 3;
  return mesh;
}
