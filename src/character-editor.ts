import * as T from "three";
import { createHero, animateCharacter, releaseCharacter, type PlayerGender } from "./characters";
import { applyAppearance, normalizeAppearance, type Appearance } from "./appearance";
import { t, type MessageKey } from "./i18n";

const palettes: { key: "skin" | "hair" | "shirt" | "vest" | "trousers" | "scarf" | "eyes"; label: MessageKey; colors: string[] }[] = [
  { key: "skin", label: "Skin tone", colors: ["#f1c7a5", "#d9ab83", "#c68e64", "#ac7554", "#855338", "#573b30"] },
  { key: "hair", label: "Hair color", colors: ["#241f1c", "#39281e", "#68412c", "#9c683a", "#c6a66d", "#a8a69b"] },
  { key: "eyes", label: "Eye color", colors: ["#644b31", "#3b6a78", "#52724c", "#34291e", "#87918b", "#886843"] },
  { key: "vest", label: "Waistcoat", colors: ["#286488", "#427567", "#a85e48", "#925466", "#b28b44", "#3e454b"] },
  { key: "shirt", label: "Shirt", colors: ["#e9dfc8", "#f5eddf", "#adc9c3", "#b9c8da", "#d7b0a0", "#c3b2cb"] },
  { key: "trousers", label: "Trousers", colors: ["#425f60", "#344b59", "#746347", "#4d4449", "#b5a48b", "#333b37"] },
  { key: "scarf", label: "Scarf", colors: ["#b65f43", "#c99b3f", "#477b93", "#925466", "#4a765d", "#ddd0b2"] },
];

/** A separate portrait scene keeps all unsaved edits out of the game and save file. */
export class CharacterEditor {
  private appearance: Appearance;
  private gender: PlayerGender;
  private renderer: T.WebGLRenderer;
  private scene = new T.Scene();
  private camera = new T.PerspectiveCamera(31, 1, .05, 20);
  private hero: T.Group;
  private frame = 0;
  private observer: ResizeObserver;
  private turn = .12;
  private zoom = "face";
  private disposed = false;
  constructor(private host: HTMLElement, gender: PlayerGender, appearance: Appearance,
    private save: (gender: PlayerGender, appearance: Appearance) => void, private cancel: () => void, saveLabel: MessageKey = "Save explorer") {
    this.gender = gender; this.appearance = normalizeAppearance(appearance);
    host.innerHTML = `<div class="editor-header"><div class="eyebrow">${t("YOUR EXPLORER")}</div><h2>${t("Make it your own.")}</h2><p>${t("Choose a face and clothes for your day in Valencia.")}</p></div>
      <div class="editor-layout"><div class="editor-portrait"><canvas aria-label="${t("Live character preview")}" tabindex="0"></canvas><span class="editor-postmark">VALÈNCIA<br>39°28′ N</span><div class="editor-view"><button type="button" data-turn="-1" aria-label="${t("Rotate left")}">←</button><span>${t("Drag to turn")}</span><button type="button" data-turn="1" aria-label="${t("Rotate right")}">→</button></div></div>
      <div class="editor-options"><fieldset class="editor-gender"><legend>${t("Explorer")}</legend><div class="editor-segment">${(["male", "female"] as const).map(value => `<button type="button" data-gender="${value}" aria-pressed="${value === gender}">${value === "male" ? "HOME" : "DONA"}</button>`).join("")}</div></fieldset>
      <div class="editor-tabs" role="tablist" aria-label="${t("Appearance")}"><button role="tab" id="editor-face-tab" aria-controls="editor-face" aria-selected="true" data-tab="face">${t("Face")}</button><button role="tab" id="editor-clothes-tab" aria-controls="editor-clothes" aria-selected="false" data-tab="clothes">${t("Clothes")}</button></div>
      <div id="editor-face" role="tabpanel" aria-labelledby="editor-face-tab"><fieldset><legend>${t("Face shape")}</legend><div class="editor-segment face-shapes">${(["soft", "oval", "wide"] as const).map(value => `<button type="button" data-face="${value}" aria-pressed="${this.appearance.face === value}"><i class="face-outline ${value}" aria-hidden="true"></i>${t(value === "soft" ? "Soft" : value === "oval" ? "Oval" : "Wide")}</button>`).join("")}</div></fieldset>${palettes.slice(0, 3).map(p => this.swatches(p)).join("")}<label class="editor-check" id="editor-hat-label" ${gender==="female"?"hidden":""}><input type="checkbox" id="editor-hat" ${this.appearance.hat?"checked":""}/><span>${t("Straw hat")}</span></label><fieldset><legend>${t("Hair shape")}</legend><div class="editor-segment">${(["swept","crop","full"] as const).map(value=>`<button type="button" data-hair="${value}" aria-pressed="${this.appearance.hairstyle===value}">${t(value==="swept"?"Swept":value==="crop"?"Short":"Full")}</button>`).join("")}</div></fieldset><label class="editor-check"><input type="checkbox" id="editor-freckles" ${this.appearance.freckles?"checked":""}/><span>${t("Freckles")}</span></label><label class="editor-check"><input type="checkbox" id="editor-glasses" ${this.appearance.glasses ? "checked" : ""}/><span>${t("Round glasses")}</span></label></div>
      <div id="editor-clothes" role="tabpanel" aria-labelledby="editor-clothes-tab" hidden>${palettes.slice(3).map(p => this.swatches(p)).join("")}</div></div></div>
      <div class="editor-footer"><span>${t("You can change this later.")}</span><div><button type="button" id="editor-cancel" class="paper-btn">${t("Cancel")}</button><button type="button" id="editor-save" class="primary">${t(saveLabel)} <span aria-hidden="true">→</span></button></div></div>`;
    const canvas = host.querySelector<HTMLCanvasElement>("canvas")!;
    this.renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.scene.add(new T.HemisphereLight(0xfff2d9, 0x778980, 2.8));
    const light = new T.DirectionalLight(0xffefd8, 3); light.position.set(3, 5, 4); this.scene.add(light);
    const rim = new T.DirectionalLight(0xc4dfeb, 1.5); rim.position.set(-3, 2, -2); this.scene.add(rim);
    this.hero = createHero(gender); applyAppearance(this.hero, this.appearance); this.scene.add(this.hero);
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(canvas);
    this.bind(); this.resize();
    const render = (time: number) => {
      if (this.disposed) return;
      animateCharacter(this.hero, time / 1000, "Idle"); this.hero.rotation.y = this.turn;
      this.renderer.render(this.scene, this.camera); this.frame = requestAnimationFrame(render);
    };
    this.frame = requestAnimationFrame(render);
  }
  private swatches(palette: typeof palettes[number]) {
    return `<fieldset class="editor-palette"><legend>${t(palette.label)}</legend><div>${palette.colors.map((color, i) => `<button type="button" class="color-swatch" style="--swatch:${color}" data-color="${color}" data-part="${palette.key}" aria-label="${t(palette.label)} ${i + 1}" aria-pressed="${this.appearance[palette.key] === color}"><span aria-hidden="true">✓</span></button>`).join("")}<label class="custom-color" title="${t("Custom color")}">+<input type="color" value="${this.appearance[palette.key]}" data-custom="${palette.key}" aria-label="${t("Custom color")}: ${t(palette.label)}"/></label></div></fieldset>`;
  }
  private refresh() {
    applyAppearance(this.hero, this.appearance);
    this.host.querySelector<HTMLElement>("#editor-hat-label")!.hidden=this.gender === "female";
    this.host.querySelector<HTMLInputElement>("#editor-hat")!.checked=this.appearance.hat;
    this.host.querySelectorAll<HTMLElement>("[data-color]").forEach(button => button.setAttribute("aria-pressed", String(this.appearance[button.dataset.part as keyof Appearance] === button.dataset.color)));
    this.host.querySelectorAll<HTMLInputElement>("[data-custom]").forEach(input => input.value = this.appearance[input.dataset.custom as "skin"]);
    this.host.querySelectorAll<HTMLElement>("[data-hair]").forEach(button=>button.setAttribute("aria-pressed",String(button.dataset.hair===this.appearance.hairstyle)));
    this.host.querySelectorAll<HTMLElement>("[data-face]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.face === this.appearance.face)));
  }
  private bind() {
    this.host.querySelector("#editor-save")!.addEventListener("click", () => this.save(this.gender, { ...this.appearance }));
    this.host.querySelector("#editor-cancel")!.addEventListener("click", this.cancel);
    this.host.querySelectorAll<HTMLButtonElement>("[data-gender]").forEach(button => button.addEventListener("click", () => {
      this.gender = button.dataset.gender as PlayerGender;
      this.scene.remove(this.hero); releaseCharacter(this.hero);
      this.hero = createHero(this.gender); this.scene.add(this.hero); this.refresh();
      this.host.querySelectorAll<HTMLElement>("[data-gender]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.gender === this.gender)));
    }));
    this.host.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach(button => button.addEventListener("click", () => {
      this.zoom = button.dataset.tab!; this.resize();
      this.host.querySelectorAll<HTMLElement>("[data-tab]").forEach(b => b.setAttribute("aria-selected", String(b === button)));
      this.host.querySelector<HTMLElement>("#editor-face")!.hidden = this.zoom !== "face";
      this.host.querySelector<HTMLElement>("#editor-clothes")!.hidden = this.zoom !== "clothes";
    }));
    this.host.querySelectorAll<HTMLButtonElement>("[data-color]").forEach(button => button.addEventListener("click", () => {
      this.appearance[button.dataset.part as "skin"] = button.dataset.color!; this.refresh();
    }));
    this.host.querySelectorAll<HTMLInputElement>("[data-custom]").forEach(input => input.addEventListener("input", () => {
      this.appearance[input.dataset.custom as "skin"] = input.value; this.refresh();
    }));
    this.host.querySelectorAll<HTMLButtonElement>("[data-face]").forEach(button => button.addEventListener("click", () => {
      this.appearance.face = button.dataset.face as Appearance["face"]; this.refresh();
    }));
    this.host.querySelectorAll<HTMLButtonElement>("[data-hair]").forEach(button=>button.addEventListener("click",()=>{this.appearance.hairstyle=button.dataset.hair as Appearance["hairstyle"];this.appearance.hat=false;this.refresh();}));
    this.host.querySelector<HTMLInputElement>("#editor-hat")!.addEventListener("change",event=>{this.appearance.hat=(event.target as HTMLInputElement).checked;this.refresh();});
    this.host.querySelector<HTMLInputElement>("#editor-freckles")!.addEventListener("change",event=>{this.appearance.freckles=(event.target as HTMLInputElement).checked;this.refresh();});
    this.host.querySelector<HTMLInputElement>("#editor-glasses")!.addEventListener("change", event => {
      this.appearance.glasses = (event.target as HTMLInputElement).checked; this.refresh();
    });
    this.host.querySelectorAll<HTMLButtonElement>("[data-turn]").forEach(button => button.addEventListener("click", () => this.turn += Number(button.dataset.turn) * .4));
    const canvas = this.host.querySelector("canvas")!;
    let pointer: number | null = null, last = 0;
    canvas.addEventListener("pointerdown", event => { pointer = event.pointerId; last = event.clientX; canvas.setPointerCapture(pointer); });
    canvas.addEventListener("pointermove", event => { if (pointer !== event.pointerId) return; this.turn += (event.clientX - last) * .012; last = event.clientX; });
    canvas.addEventListener("pointerup", () => pointer = null); canvas.addEventListener("pointercancel", () => pointer = null);
    canvas.addEventListener("keydown", event => { if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); this.turn += event.key === "ArrowLeft" ? -.2 : .2; } });
  }
  private resize() {
    const canvas = this.renderer.domElement, width = canvas.clientWidth, height = canvas.clientHeight;
    if (!width || !height) return;
    this.renderer.setSize(width, height, false); this.camera.aspect = width / height;
    const face = this.zoom === "face";
    this.camera.position.set(0, face ? 1.64 : 1.23, face ? Math.max(.85, .45 / this.camera.aspect) : Math.max(4.0, 1.2 / this.camera.aspect));
    this.camera.lookAt(0, face ? 1.64 : 1.0, 0); this.camera.updateProjectionMatrix();
  }
  dispose() {
    this.disposed = true; cancelAnimationFrame(this.frame); this.observer.disconnect();
    releaseCharacter(this.hero); this.renderer.dispose(); this.renderer.forceContextLoss();
  }
}
