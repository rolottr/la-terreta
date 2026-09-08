import * as T from "three";
import { BEACH_WAVES_GLSL, coastSample } from "./beach-water";
import { wetlandGeometry } from "./wetland-mesh";
import {
  inside,
  seaOutline,
  edgeDistance,
  lagoonOutline,
} from "./wetland-layout";
import type { WetlandPoint } from "./wetland-layout";

let rippleTexture: T.Texture | undefined;
function waterNormals() {
  if (!rippleTexture) {
    rippleTexture = new T.TextureLoader().load("/textures/water-normal.png");
    rippleTexture.wrapS = rippleTexture.wrapT = T.RepeatWrapping;
    rippleTexture.anisotropy = 4;
  }
  return rippleTexture;
}

export function createWater(
  outline: WetlandPoint[],
  lagoon = false,
  holes: WetlandPoint[][] = [],
) {
  const material = new T.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      waterNormal: {value: waterNormals()},
      lightDirection: {value: new T.Vector3(-.5,.8,-.4).normalize()},
      daylight: {value: 1},
      deep: { value: new T.Color(lagoon ? "#124d43" : "#086784") },
      shallow: { value: new T.Color(lagoon ? "#5c9a7c" : "#6ebcaf") },
    },
    vertexShader: `uniform float time;attribute float shoreDistance;attribute float seaWeight;attribute vec2 seaDirection;attribute float seaShore;
    varying float vSea;varying vec2 vUv;varying vec3 vNormal;varying vec3 vWorld;varying float vShore;varying float vSeaShore;
    ${BEACH_WAVES_GLSL}
    void main(){vUv=uv;vSea=seaWeight;vShore=shoreDistance;vSeaShore=seaShore;
      float wind=(sin(uv.x*1.7+uv.y*.8+time*1.4)+sin(uv.y*2.2-uv.x*.4-time*.9))*.014*smoothstep(0.,2.,shoreDistance);
      float wave=mix(wind,beachSwell(seaShore,uv.y,time),seaWeight);
      vec3 east=normalize(vec3(normal.y,-normal.x,0.)),south=normalize(cross(east,normal));
      float slope=(beachSwell(seaShore+.03,uv.y,time)-beachSwell(max(0.,seaShore-.03),uv.y,time))/(seaShore>.03?.06:.03);
      vNormal=normalize(normal-(east*seaDirection.x+south*seaDirection.y)*slope*seaWeight);
      vec3 p=position+normal*wave;vWorld=p;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    fragmentShader: `varying float vSea;uniform float time;uniform vec3 deep;uniform vec3 shallow;
    uniform sampler2D waterNormal;uniform vec3 lightDirection;uniform float daylight;
    varying vec2 vUv;varying vec3 vNormal;varying vec3 vWorld;varying float vShore;varying float vSeaShore;
    void main(){
      vec2 p=vUv*vec2(cos(vUv.y*.01),1.);
      float range=distance(cameraPosition,vWorld);
      float detail=1.-smoothstep(55.,145.,range);
      vec2 rippleA=texture2D(waterNormal,p*.095+vec2(time*.012,time*.007)).xy*2.-1.;
      vec2 rippleB=texture2D(waterNormal,p.yx*.18+vec2(-time*.009,time*.013)).yx*2.-1.;
      vec2 ripple=(rippleA*.7+rippleB*.3)*detail;
      vec3 normal=normalize(vNormal);
      vec3 east=normalize(vec3(normal.y,-normal.x,0.)),south=normalize(cross(east,normal));
      vec3 n=normalize(normal+east*ripple.x*.38+south*ripple.y*.38);
      vec3 eye=normalize(cameraPosition-vWorld);
      float facing=abs(dot(eye,n));
      float fresnel=.02+.98*pow(1.-facing,5.);
      float depth=smoothstep(.12,5.5,vShore);
      vec3 body=mix(shallow,deep,depth);
      float broad=sin(p.x*.18+p.y*.31+time*.18)*sin(p.y*.25-time*.11);
      body*=.91+broad*.065;
      vec3 reflected=reflect(-eye,n);
      float skyHeight=clamp(dot(reflected,normal),0.,1.);
      float cloud=sin(reflected.x*12.+reflected.z*7.)*sin(reflected.y*17.-reflected.z*9.);
      vec3 sky=mix(vec3(.56,.70,.73),vec3(.25,.52,.66),pow(skyHeight,.6));
      sky=mix(sky,vec3(.77,.83,.80),smoothstep(.38,.85,cloud)*.32);
      vec3 halfway=normalize(eye+normalize(lightDirection));
      float sun=pow(max(0.,dot(n,halfway)),190.)*.85;
      float sparkle=pow(max(0.,dot(n,halfway)),850.)*detail;
      vec3 col=mix(body,sky,clamp(fresnel*.83,0.,.88));
      col+=vec3(1.,.88,.60)*(sun+sparkle*.45)*daylight;
      float shore=(1.-smoothstep(.03,.65,vShore));
      float breaker=pow(max(0.,sin(vSeaShore*.72+vUv.y*.025+time*1.0471975512)),7.)
        *(1.-smoothstep(.8,4.,vSeaShore))*smoothstep(0.,.25,vSeaShore);
      float foam=mix(shore*.15,breaker*.7,vSea)*detail;
      foam*=.6+.4*sin(p.y*8.+p.x*3.+time);
      col=mix(col,vec3(.78,.87,.78),foam);
      col*=mix(.36,1.,daylight);
      // Deep water hides submerged wildlife; the shore stays clear enough to see the bed.
      gl_FragColor=vec4(col,mix(.76,.985,depth));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
    transparent: true,
    depthWrite: false,
    side: T.DoubleSide,
  });
  const geometry = wetlandGeometry(outline, holes, 0.14),
    uv = geometry.getAttribute("uv");
  const seaWeights = new Float32Array(uv.count);
  const directions = new Float32Array(uv.count * 2),
    shore = new Float32Array(uv.count);
  const samples = new Map<string, ReturnType<typeof coastSample>>();
  for (let i = 0; i < uv.count; i++) {
    const p = { x: uv.getX(i), z: uv.getY(i) };
    const key = `${p.x.toFixed(5)}:${p.z.toFixed(5)}`;
    let sample = samples.get(key);
    if (!sample) {
      sample = coastSample(p);
      samples.set(key, sample);
    }
    directions[i * 2] = sample.nx;
    directions[i * 2 + 1] = sample.nz;
    shore[i] = sample.distance;
    seaWeights[i] = inside(p, seaOutline)
      ? Math.min(1, edgeDistance(p, lagoonOutline) / 18)
      : Math.max(0, Math.min(1, (-p.x - 232) / 20));
  }
  geometry.setAttribute("seaWeight", new T.BufferAttribute(seaWeights, 1));
  geometry.setAttribute("seaDirection", new T.BufferAttribute(directions, 2));
  geometry.setAttribute("seaShore", new T.BufferAttribute(shore, 1));
  const mesh = new T.Mesh(geometry, material);
  mesh.renderOrder = 2;
  return mesh;
}
