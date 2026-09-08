import * as T from "three";
// A single depth-aware ink pass keeps edges clear without a second scene render.
export class ArtRenderer {
  target: T.WebGLRenderTarget;
  scene = new T.Scene();
  camera = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  material: T.ShaderMaterial;
  constructor(
    public renderer: T.WebGLRenderer,
    public world: T.Scene,
    public view: T.PerspectiveCamera,
  ) {
    renderer.info.autoReset = false;
    this.target = new T.WebGLRenderTarget(1, 1, {
      type: T.HalfFloatType,
      depthBuffer: true,
    });
    this.target.depthTexture = new T.DepthTexture(1, 1, T.UnsignedIntType);
    this.target.samples = 4;
    this.material = new T.ShaderMaterial({
      uniforms: {
        tColor: { value: this.target.texture },
        tDepth: { value: this.target.depthTexture },
        resolution: { value: new T.Vector2(1, 1) },
        near: { value: view.near },
        far: { value: view.far },
        ink: { value: new T.Color("#29474d") },
        strength: { value: 0.15 },
      },
      vertexShader:
        "varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}",
      fragmentShader: `
   #include <packing>
   uniform sampler2D tColor; uniform sampler2D tDepth; uniform vec2 resolution; uniform float near; uniform float far; uniform float strength; uniform vec3 ink; varying vec2 vUv;
   float depthAt(vec2 uv){return -perspectiveDepthToViewZ(texture2D(tDepth,uv).x,near,far);}
   void main(){vec4 base=texture2D(tColor,vUv);vec2 px=1.0/resolution;float z=depthAt(vUv);
    float l=depthAt(vUv-vec2(px.x,0.0)),r=depthAt(vUv+vec2(px.x,0.0));float u=depthAt(vUv-vec2(0.0,px.y)),d=depthAt(vUv+vec2(0.0,px.y));
    float curve=max(abs(l+r-2.0*z),abs(u+d-2.0*z));float edge=smoothstep(max(.16,z*.018),max(.40,z*.045),curve);
    float fade=1.0-smoothstep(80.0,210.0,z);vec3 color=mix(base.rgb,ink,edge*strength*fade*base.a);
    gl_FragColor=vec4(color,base.a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`,
      depthTest: false,
      depthWrite: false,
    });
    this.scene.add(new T.Mesh(new T.PlaneGeometry(2, 2), this.material));
  }
  render(quality: string) {
    this.renderer.info.reset();
    if (quality === "low") {
      this.renderer.setRenderTarget(null);
      this.renderer.render(this.world, this.view);
      return;
    }
    const size = this.renderer.getDrawingBufferSize(new T.Vector2());
    if (size.x !== this.target.width || size.y !== this.target.height) {
      this.target.setSize(size.x, size.y);
      this.material.uniforms.resolution.value.copy(size);
    }
    this.material.uniforms.strength.value = quality === "low" ? 0 : 0.16;
    this.material.uniforms.near.value = this.view.near;
    this.material.uniforms.far.value = this.view.far;
    this.renderer.setRenderTarget(this.target);
    this.renderer.render(this.world, this.view);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.scene, this.camera);
  }
}
