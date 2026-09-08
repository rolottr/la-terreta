import * as T from "three";
// Small, repeatable pigment and joint patterns. No texture download is required.
export function surface(
  material: T.MeshToonMaterial | T.MeshStandardMaterial,
  kind: "paving" | "stone" | "paint",
) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = "varying vec3 vSurface;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nvSurface = position;",
    );
    const pattern =
      kind === "paving"
        ? `
    vec2 p = vec2(atan(vSurface.x,vSurface.y),asin(clamp(vSurface.z/length(vSurface),-1.0,1.0))) * 100.0;
    p.x += mod(floor(p.y / .65),2.0) * .55;
    vec2 cell = p / vec2(1.10,.65);
    vec2 edge = min(fract(cell),1.0-fract(cell));
    float joint = 1.0-smoothstep(.012,.027,min(edge.x,edge.y));
    float shade = .90 + hash(floor(cell)) * .12;
    float detail = 1.0-smoothstep(.04,.25,surfaceFootprint);
    diffuseColor.rgb *= mix(.955,shade*(1.0-joint*.18),detail);
  `
        : kind === "stone"
          ? `
    vec2 p = vec2(vSurface.x + vSurface.z*.6,vSurface.y);
    p.x += mod(floor(p.y/.60),2.0)*.7;
    vec2 cell = p / vec2(1.4,.60);
    vec2 edge = min(fract(cell),1.0-fract(cell));
    float joint = 1.0-smoothstep(.008,.020,min(edge.x,edge.y));
    float detail = 1.0-smoothstep(.04,.25,surfaceFootprint);
    diffuseColor.rgb *= mix(.975,(.92+hash(floor(cell))*.12)*(1.0-joint*.17),detail);
  `
          : `float detail=1.0-smoothstep(.025,.15,surfaceFootprint);diffuseColor.rgb *= mix(.975,.94+hash(floor(vSurface.xy*14.0))*.07,detail);`;
    shader.fragmentShader =
      "varying vec3 vSurface;\nfloat hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}\n" +
      shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      "#include <color_fragment>\nfloat surfaceFootprint=max(length(dFdx(vSurface)),length(dFdy(vSurface)));\n" + pattern,
    );
  };
  material.customProgramCacheKey = () => `valencia-${kind}-2`;
  return material;
}
