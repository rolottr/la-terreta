import * as T from "three";
import type { environmentAt } from "./environment";

/** A local sky, with broad painted clouds and a warm horizon. */
export function createSky(scene: T.Scene) {
  const material = new T.ShaderMaterial({
    side: T.BackSide,
    depthWrite: false,
    depthTest: false,
    uniforms: { up: { value: new T.Vector3(0, 1, 0) }, time: { value: 0 }, zenith: { value: new T.Color("#2466a8") }, horizon: { value: new T.Color("#a6ccd1") } },
    vertexShader: `varying vec3 direction;void main(){direction=position;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}`,
    fragmentShader: `varying vec3 direction;uniform vec3 up;uniform float time;uniform vec3 zenith;uniform vec3 horizon;
    float hash(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
    float noise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
    void main(){vec3 d=normalize(direction);float h=dot(d,up);vec3 color=mix(horizon,zenith,smoothstep(-.12,.8,h));
    vec3 q=d*7.+vec3(time*.001,0.,0.);float n=noise(q)*.60+noise(q*2.2)*.28+noise(q*4.6)*.12;float cloud=smoothstep(.52,.70,n)*smoothstep(.05,.25,h);color=mix(color,vec3(.96,.95,.87),cloud*.85);color=mix(color,vec3(.77,.83,.73),smoothstep(-.05,-.55,h));gl_FragColor=vec4(color,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`,
  });
  const sky = new T.Mesh(new T.SphereGeometry(600, 24, 16), material);
  sky.frustumCulled = false;
  sky.renderOrder = -1000;
  scene.add(sky);
  return {
    update(camera: T.Camera, time: number, environment: ReturnType<typeof environmentAt>) {
      sky.position.copy(camera.position);
      material.uniforms.up.value.copy(camera.up);
      material.uniforms.time.value = time;
      material.uniforms.zenith.value.copy(environment.sky);
      material.uniforms.horizon.value.copy(environment.horizon);
    },
  };
}
