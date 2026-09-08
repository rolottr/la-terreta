import { assetUrl } from "./public-assets";
import { placeInfo, placePhoto, wikipediaLink } from './place-info';
import { InteractionBubbles } from "./interactions";
import { TravelBook } from "./travel-book";
import { activityCatalogue } from "./activity-catalogue";
import { TouchControls, bindPress, mobileControls } from "./touch-controls";
import { GlobeMap } from "./globe-map";
import { t, getLanguage, setLanguage, updateDocumentLanguage } from "./i18n";
import { Game } from "./game";
import { CharacterEditor } from "./character-editor";
import { distance, places, stops, memoryNames } from "./data";
const icons: Record<string, string> = {
  bell: '<path d="M5 16h14l-2-3V9a5 5 0 0 0-10 0v4zM10 20h4M12 2v2"/>',
  hand: '<path d="M9 12V4a2 2 0 0 1 4 0v6l5 1a3 3 0 0 1 2 3l-1 5a3 3 0 0 1-3 2h-4a4 4 0 0 1-3-2l-5-6a2 2 0 0 1 3-2l2 2"/>',
  person: '<circle cx="12" cy="7" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/>',
  map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15"/>',
  book: '<path d="M12 5c-3-2-7-2-10 0v15c3-2 7-2 10 0 3-2 7-2 10 0V5c-3-2-7-2-10 0Zm0 0v15"/>',
  sound:
    '<path d="m3 9 4 0 5-4v14l-5-4H3zM16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  mute: '<path d="m3 9 4 0 5-4v14l-5-4H3zM17 9l5 6m0-6-5 6"/>',
  settings:
    '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="16" cy="17" r="3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  globe:
    '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  boat: '<path d="M3 13h18l-3 6H7zM7 13l9-9m-2-1 4 4M2 21q3-2 6 0t6 0t6 0"/>',
  exit: '<path d="M9 4H4v16h5m4-13 5 5-5 5M8 12h13"/>',
  bike: '<circle cx="5" cy="16" r="4"/><circle cx="19" cy="16" r="4"/><path d="m5 16 5-9 5 9H5m5-9h6m-2-4h3l2 13M8 4h4"/>',
  tram: '<rect x="5" y="3" width="14" height="15" rx="3"/><path d="M5 11h14M9 21l2-3m4 3-2-3M9 7h6M9 15h.01M15 15h.01"/>',
  video: '<rect x="2" y="6" width="13" height="12" rx="3"/><path d="m15 10 7-4v12l-7-4z"/>',
  camera:
    '<path d="M8 5 6 8H3v12h18V8h-3l-2-3z"/><circle cx="12" cy="13" r="4"/>',
  walk: '<circle cx="14" cy="4" r="2"/><path d="m7 21 4-7m4 7-1-7-3-4 1-3 4 5 4 1M5 12l4-4 3-1"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  pin: '<path d="M19 10c0 5-7 12-7 12S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
  expand: '<path d="M3 9V3h6m6 0h6v6M3 15v6h6m6 0h6v-6"/>',
  leaf: '<path d="M5 19C0 8 12 3 21 3c0 13-8 21-16 16Zm0 0L16 8"/>',
};
export const icon = (name: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.pin}</svg>`;
const movementKeys = () => `<span class="movement-keys" role="img" aria-label="${t("Move")}: W ↑, A ←, S ↓, D →">${[["W","↑"],["A","←"],["S","↓"],["D","→"]].map(([key,arrow])=>`<kbd>${key}<small aria-hidden="true">${arrow}</small></kbd>`).join("")}</span>`;
export class UI {
  root = document.querySelector<HTMLDivElement>("#ui")!;
  modal: string | null = null;
  toastTimer = 0;
  discoveryTimer = 0;
  selected = places[0].id;
  private arrivalPlace: string | null | undefined;
  private arrivalUntil = 0;
  private atlas = new GlobeMap();
  private touch?: TouchControls;
  private bubbles?: InteractionBubbles;
  private anchorSelection?: string;
  private book: TravelBook;
  private editor?: CharacterEditor;
  private modalOpener?: HTMLElement;

  constructor(public game: Game) {
    this.book = new TravelBook(game, () => this.close());
    this.shell();
    this.bind();
    game.onEvent = (kind, text) => this.event(kind, text);
    game.onChange = () => this.update();
    setInterval(() => this.update(), 150);
  }
  shell() {
    this.touch?.dispose();
    this.editor?.dispose(); this.editor = undefined;
    this.root.innerHTML = `
 <div id="loading"><div class="orange-mark"><i></i></div><p>${t("Growing a little Valencia…")}</p><span>${t("Stone by stone. Tree by tree.")}</span></div>
 <header class="topbar"><div class="explore-actions play-action"><button id="journal" class="journal-button" aria-label="${t("Travel journal")}" title="${t("Travel journal")}">${icon("book")}<span id="stamp-count">0/11</span></button><button class="journal-button camera-button" id="planet" title="${t("Change view (V)")}" aria-label="${t("Change camera view")}" aria-keyshortcuts="V">${icon("video")}<kbd aria-hidden="true">V</kbd></button></div><div class="top-actions"><button class="icon-btn play-action" id="edit-character" title="${t("Edit explorer")}" aria-label="${t("Edit explorer")}">${icon("person")}</button><button class="icon-btn play-action" id="photo" title="${t("Selfie")}" aria-label="${t("Selfie")}">${icon("camera")}</button><button class="icon-btn" id="sound" title="${t("Sound off")}" aria-label="${t("Turn sound on")}">${icon("mute")}</button><button class="icon-btn" id="settings" title="${t("Settings")}" aria-label="${t("Settings")}">${icon("settings")}</button> <details class="language-switch"><summary id="language" aria-label="${t("Language")}" title="${t("Language")}">${icon("globe")}</summary><div class="language-flags">${([['en','English'],['es','Español'],['va','Valencià']] as const).map(([language,name])=>`<button type="button" data-language="${language}" aria-label="${name}" title="${name}" aria-pressed="${getLanguage()===language}"><img src="${assetUrl(`/flags/${language}.svg`)}" alt="" width="32" height="22"/></button>`).join("")}</div></details></div></header>
 <section id="welcome" class="welcome"><a class="brand" href="#" aria-label="${t("La Terreta home")}"><span class="orange-mark small"><i></i></span><span>Valencia<span class="brand-sub"><span class="brand-name">La Terreta</span><span class="brand-tagline">${t("A LITTLE WORLD")}</span></span></span></a>
  <fieldset class="hero-choice" aria-label="${t("Choose and play")}"><div class="hero-options">${(["female", "male"] as const).map(gender => `<button type="button" class="hero-option" data-play-character="${gender}" aria-label="${t(gender === "female" ? "Play as DONA" : "Play as HOME")}"><span class="hero-portrait"><img src="${assetUrl(`/art/hero_${gender}.png`)}" alt="" width="320" height="320" draggable="false"/></span><span class="hero-option-label"><strong>${gender === "female" ? "DONA" : "HOME"}</strong></span></button>`).join("")}</div></fieldset>
  <div class="explorer-intro"><button class="paper-btn" id="edit-welcome">${icon("person")} ${t("Change your look")} <span aria-hidden="true">↗</span></button><div class="welcome-note">${movementKeys()}</div></div></section>
 <div id="intro-footer"><span>39°28′ N &nbsp; 0°22′ W</span></div>
 <div id="activity-bubbles"></div><button type="button" id="activity-help" hidden></button><div id="task-tracker" hidden></div>
 <div id="hud" hidden>


  <div id="discovery" class="discovery" hidden></div>
  <div id="place-label" class="place-label" aria-live="polite"><h2 id="zone-name"></h2></div>
  <div id="route-label" class="route-label" hidden></div>
  <div class="location-messages">
   <div id="interaction" class="interaction" hidden><kbd>E</kbd><span></span></div>

  </div>
  <div id="tram-panel" hidden class="tram-panel"></div>
  <div class="bottom-controls"><div class="control-hint" tabindex="0" aria-label="${t("Movement help")}">${movementKeys()}</div></div>
  <aside class="mini"><button id="mini-map" aria-label="${t("Open map")}"><canvas id="minimap" width="260" height="260"></canvas><span class="mini-north">N</span></button></aside>
  <div id="touch-controls"><div class="joystick-wrap"><button id="joystick" aria-label="${t("Move")}"><span class="joystick-track" aria-hidden="true">＋</span><span class="joystick-knob" aria-hidden="true"></span></button></div><div class="touch-actions"><button id="touch-bell" aria-label="${t("Bicycle bell")}" hidden>${icon("bell")}</button><button id="touch-bike" aria-label="${t("Borrow / park bike")}">${icon("bike")}</button><button id="touch-e" aria-label="${t("Use")}">${icon("hand")}</button></div></div>
 </div>
 <div id="photo-ui" hidden><div class="photo-title">LA TERRETA <span>${t("A LITTLE WORLD")}</span></div><div class="photo-corner tl"></div><div class="photo-corner tr"></div><div class="photo-corner bl"></div><div class="photo-corner br"></div><a id="photo-preview" hidden download="la-terreta-postcard.png" aria-label="${t("Download your photo")}"><img alt="${t("Your captured Valencia photo")}"/><span>${t("Download photo ↗")}</span></a><div class="selfie-controls" aria-label="${t("Camera movement")}"><p>${t("Drag to look up and down. Scroll or pinch to zoom.")}</p><button type="button" id="selfie-pad" aria-label="${t("Camera movement")}"><span class="selfie-pad-ring" aria-hidden="true"></span><span class="selfie-pad-knob" aria-hidden="true">${icon("camera")}</span></button></div><div class="photo-tools"><button id="capture" class="primary">${icon("camera")} ${t("Save selfie")}</button><button id="exit-photo" class="paper-btn">${t("Back to exploring")} <kbd>P</kbd></button></div></div>
 <button type="button" id="toast" aria-live="polite" hidden></button>
 <div id="modal-layer" hidden></div>`;
  }
  ready() {
    document.querySelector("#loading")?.remove();
  }
  changeLanguage(value: string) {
    const modal = this.modal;
    const loading = !!document.querySelector("#loading");
    const preview = document.querySelector<HTMLAnchorElement>("#photo-preview");
    const photo = preview && !preview.hidden ? preview.href : null;
    this.touch?.reset();
    this.game.resetInput();
    clearTimeout(this.toastTimer);
    clearTimeout(this.discoveryTimer);
    setLanguage(value === "va" ? "va" : value === "es" ? "es" : "en");
    updateDocumentLanguage();
    this.game.world.refreshLabels();
    this.shell();
    this.bind();
    if (!loading) this.ready();
    (document.querySelector("#welcome") as HTMLElement).hidden = this.game.started;
    (document.querySelector("#intro-footer") as HTMLElement).hidden = this.game.started;
    (document.querySelector("#hud") as HTMLElement).hidden = !this.game.started || this.game.photo;
    (document.querySelector(".topbar") as HTMLElement).hidden = this.game.photo;
    (document.querySelector("#photo-ui") as HTMLElement).hidden = !this.game.photo;
    if (photo) this.event("photo-ready", photo);
    this.update();
    if (modal) this.open(modal);
    document.querySelector<HTMLElement>(modal === "settings" ? "#settings-language" : "#language")?.focus();
  }
  bind() {
    document.querySelectorAll<HTMLButtonElement>("[data-language]").forEach(button =>
      bindPress(button, () => this.changeLanguage(button.dataset.language!)));
    const languageMenu = document.querySelector<HTMLDetailsElement>(".language-switch")!;
    languageMenu.addEventListener("keydown", event => {
      if (event.key === "Escape") { event.stopPropagation(); languageMenu.open = false; document.querySelector<HTMLElement>("#language")!.focus(); }
    });
    languageMenu.addEventListener("focusout", event => {
      if (!languageMenu.contains(event.relatedTarget as Node)) languageMenu.open = false;
    });
    const on = (id: string, fn: () => void) =>
      bindPress(document.getElementById(id) as HTMLButtonElement, fn);
    document.querySelectorAll<HTMLButtonElement>("[data-play-character]").forEach(button =>
      bindPress(button, () => {
        this.game.setCharacter(button.dataset.playCharacter as "female" | "male");
        this.game.start();
      }));
    this.bubbles = new InteractionBubbles(this.game,document.querySelector("#activity-bubbles")!);
    on("edit-welcome", () => this.open("appearance"));
    on("edit-character", () => this.open("appearance"));
    on("mini-map", () => this.open("map"));
    on("journal", () => this.open("journal"));
    on("settings", () => this.open("settings"));
    on("sound", () => this.game.toggleSound());
    on("planet", () => {
      this.game.cycleView();
      this.update();
    });
    on("photo", () => {
      this.game.photo = true;
      this.event("photo");
    });
    on("exit-photo", () => {
      this.game.photo = false;
      this.event("photo");
    });
    on("capture", () => this.game.photoDownload());
    const pad = document.querySelector<HTMLButtonElement>("#selfie-pad")!;
    const knob = pad.querySelector<HTMLElement>(".selfie-pad-knob")!;
    let pointer: number | undefined, x = 0, y = 0;
    const resetPad = () => { pointer = undefined; knob.style.transform = ""; };
    pad.addEventListener("pointerdown", event => {
      if (pointer !== undefined) return;
      event.preventDefault(); pointer = event.pointerId; x = event.clientX; y = event.clientY;
      pad.setPointerCapture(event.pointerId);
    });
    pad.addEventListener("pointermove", event => {
      if (pointer !== event.pointerId) return;
      this.game.adjustSelfie("yaw", -(event.clientX-x)*.012);
      this.game.adjustSelfie("pitch", (event.clientY-y)*.008);
      x=event.clientX; y=event.clientY;
      const rect=pad.getBoundingClientRect(), dx=x-rect.left-rect.width/2, dy=y-rect.top-rect.height/2;
      const scale=Math.min(1,32/Math.max(1,Math.hypot(dx,dy)));
      knob.style.transform=`translate(${dx*scale}px,${dy*scale}px)`;
    });
    pad.addEventListener("pointerup", resetPad);
    pad.addEventListener("pointercancel", resetPad);
    pad.addEventListener("lostpointercapture", resetPad);
    pad.addEventListener("keydown", event => {
      const adjustment = {ArrowLeft:["yaw",.1],ArrowRight:["yaw",-.1],ArrowUp:["pitch",.08],ArrowDown:["pitch",-.08]}[event.key];
      if (adjustment) { event.preventDefault(); event.stopPropagation(); this.game.adjustSelfie(adjustment[0] as "yaw"|"pitch", Number(adjustment[1])); }
    });
    on("activity-help", () => {
      this.game.state.activities.helped = true;
      this.game.save();
      this.update();
    });
    on("toast", () => {
      clearTimeout(this.toastTimer);
      document.querySelector<HTMLElement>("#toast")!.hidden = true;
    });
    const touchAction=document.querySelector<HTMLButtonElement>("#touch-e")!;
    let pressedTarget: string | undefined;
    touchAction.addEventListener("pointerdown",()=>{pressedTarget=touchAction.dataset.target;});
    touchAction.addEventListener("pointercancel",()=>{pressedTarget=undefined;});
    touchAction.addEventListener("keydown",()=>{pressedTarget=undefined;});
    bindPress(touchAction,()=>{const target=pressedTarget??touchAction.dataset.target;pressedTarget=undefined;this.game.interact(target||undefined);});
    on("touch-bike", () => this.game.toggleBike());
    on("touch-bell", () => this.game.ringBell());
    this.touch = new TouchControls(this.game, document.querySelector("#touch-controls")!);
    document.querySelector(".brand")!.addEventListener("click", (e) => {
      e.preventDefault();
      if (this.game.started) this.open("settings");
    });
    document
      .querySelector("#interaction")!
      .addEventListener("click", () => this.game.interact());
  }
  event(kind: string, text?: string) {
    if (kind === "start") {
      (document.querySelector("#welcome") as HTMLElement).hidden = true;
      (document.querySelector("#intro-footer") as HTMLElement).hidden = true;
      (document.querySelector("#hud") as HTMLElement).hidden = false;
      if(this.game.state.activities.helped)this.toast(matchMedia("(pointer: coarse)").matches || innerWidth <= 700
        ? t("Move with your left thumb. Drag to look. Pinch to zoom.")
        : t("Walk with W A S D. Click to look. Press V to change view."));
    }
    if (kind === "photo-ready") {
      const a = document.querySelector<HTMLAnchorElement>("#photo-preview")!;
      a.href = text!;
      a.querySelector("img")!.src = text!;
      a.hidden = false;
    }
    if (kind === "toast") this.toast(text!);
    if (kind === "map" || kind === "journal")
      this.modal === kind ? this.close() : this.open(kind);
    if (kind === "place") {
      this.selected = text!;
      this.open("place");
    }
    if (kind === "escape") {
      if (this.modal) this.close();
      else this.open("settings");
    }
    if (kind === "photo") {
      this.close();
      const p = this.game.photo;
      clearTimeout(this.toastTimer);
      document.querySelector<HTMLElement>("#toast")!.hidden = true;
      (document.querySelector("#hud") as HTMLElement).hidden = p;
      (document.querySelector(".topbar") as HTMLElement).hidden = p;
      (document.querySelector("#photo-ui") as HTMLElement).hidden = !p;
    }
    if (kind === "discovery" && this.game.state.activities.helped) {
      const p = places.find((p) => p.id === text)!;
      const el = document.querySelector<HTMLElement>("#discovery")!;
      el.innerHTML = `<span class="discovery-seal">${icon("check")}</span><div><small>${t("A LITTLE DISCOVERY")} · ${String(this.game.visited.size).padStart(2, "0")} / 11</small><h3>${p.name}</h3><p>${t("A new page in your Valencia journal.")}</p></div>`;
      el.hidden = false;
      clearTimeout(this.discoveryTimer);
      this.discoveryTimer = window.setTimeout(() => (el.hidden = true), 4500);
    }
    if (kind === "complete")
      window.setTimeout(() => this.open("complete"), 1800);
  }
  toast(text: string) {
    const el = document.querySelector<HTMLElement>("#toast")!;
    el.textContent = text;
    el.hidden = false;
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (el.hidden = true), 4200);
  }
  updateAnchors() {
    this.bubbles?.update();
    const selected=this.game.interactions.selected?.id;
    if(selected!==this.anchorSelection){this.anchorSelection=selected;this.update();}
  }
  update() {
    const g = this.game;

    const help=document.querySelector<HTMLElement>("#activity-help")!;
    help.hidden=!g.started||g.paused||g.photo||g.globe||g.state.activities.helped;
    help.textContent=t(mobileControls()?"Tap a bubble to interact.":"Use things with a bubble. Press E.");
    const tracker=document.querySelector<HTMLElement>("#task-tracker")!;
    const activeTask = g.activities.active?.kind;
    const liveId=activeTask==='procession'?'band':activeTask==='oranges'||activeTask==='horchata'||activeTask==='bull'||activeTask==='firecracker'?activeTask:g.mode==='boat'?'rowing':g.mode==='bike'?'bike':null;
    const hideBikeTask=g.mode==='bike'&&g.bikeTaskCompletedOnPickup;
    const task=activityCatalogue.find(t=>t.id===(liveId??g.trackedActivity)&&!(t.id==='bike'&&hideBikeTask));
    const globeCancel = g.globe && !!g.activities.active;
    tracker.hidden = (!task && !globeCancel) || g.paused || g.photo || !g.started;
    if (!tracker.hidden) document.querySelector<HTMLElement>("#discovery")!.hidden = true;
    if (task || globeCancel) {
      if (!tracker.firstChild) {
        const label = document.createElement("span"), stop = document.createElement("button");
        stop.textContent = "×";
        bindPress(stop, () => { if (g.globe && g.activities.active) g.activities.cancel(); else g.trackedActivity = null; });
        tracker.append(label, stop);
      }
      const label = tracker.querySelector("span")!, stop = tracker.querySelector("button")!;
      if (task) {
        const progress = activeTask === 'horchata' || activeTask === 'bull'
          ? Math.min(task.target, g.activities.active!.elapsed) : g.state.activities.progress[task.id];
        label.textContent = `${t(task.name)} · ${Math.floor(progress)}/${task.target} ${task.unit}`;
      } else label.textContent = g.activities.prompt(g.activities.active!.kind);
      stop.setAttribute("aria-label", t(globeCancel ? "Cancel activity" : "Stop tracking"));
      stop.hidden = !g.trackedActivity && !globeCancel;
    }
    document.body.dataset.started = String(g.started);
    document.body.dataset.mode = g.mode;
    document.body.dataset.view = g.globe
      ? "globe"
      : g.firstPerson
        ? "first"
        : "follow";
    document.querySelector("#stamp-count")!.textContent =
      `${g.visited.size}/11`;
    document.querySelector<HTMLElement>(".control-hint")!.classList.toggle("resting",g.travelTime>=5);
    document.querySelector<HTMLButtonElement>("#touch-bell")!.hidden = g.mode!=="bike";
    const s = document.querySelector<HTMLButtonElement>("#sound")!;
    s.innerHTML = icon(g.sound ? "sound" : "mute");
    s.title = g.sound ? t("Sound on") : t("Sound off");
    s.setAttribute("aria-label", g.sound ? t("Turn sound off") : t("Turn sound on"));
    const current = g.currentPlace();
    if (current?.id !== this.arrivalPlace) { this.arrivalPlace = current?.id ?? null; this.arrivalUntil = current ? g.processionClock+3 : 0; }
    document.querySelector("#zone-name")!.textContent=current?.name || "";
    document.querySelector<HTMLElement>("#place-label")!.classList.toggle("expired", !current || g.processionClock>=this.arrivalUntil || !g.started);
    const route = document.querySelector<HTMLElement>("#route-label")!;
    const target=g.routeTarget;
    route.hidden=!target;
    if(target)route.textContent=t("{place} · {distance} m",{place:target.label,distance:Math.round(distance(g,target))});
    document
      .querySelector("#planet")!
      .setAttribute(
        "aria-label",
        g.globe
          ? t("Switch to first person")
          : g.firstPerson
            ? t("Switch to follow view")
            : t("Switch to planet view"),
      );
    document.querySelector<HTMLButtonElement>("#planet")!.title = document.querySelector("#planet")!.getAttribute("aria-label")!;
    const controls = document.querySelector<HTMLElement>(".control-hint")!;
    if (controls.dataset.mode !== g.mode) {
      controls.dataset.mode = g.mode;
      controls.innerHTML = g.mode === "tram"
        ? `<kbd>E</kbd> ${t("Use / interact")} <i></i><kbd>V</kbd> ${t("View")}`
        : g.mode === "boat"
        ? `<kbd>W</kbd> ${t("Row")} <i></i><kbd>A D</kbd> ${t("Steer")} <i></i><kbd>S</kbd> ${t("Reverse")} <i></i><kbd>E</kbd> ${t("Leave the boat")} `
        : g.mode === "bike"
        ? `<kbd>W</kbd> ${t("Pedal")} <i></i><kbd>A D</kbd> ${t("Steer")} <i></i><kbd>S</kbd> ${t("Brake / reverse")} <i></i> ${t("Click / drag to look")}`
        : `${movementKeys()}`;
    }
    const action = g.interaction();
    const prompt = action?.label || "",
      inter = document.querySelector<HTMLElement>("#interaction")!;
    const compact = mobileControls();
    inter.hidden = !prompt || !g.started || g.globe || !!g.interactions.selected || (compact && g.mode==='bike');
    const shortPrompt = action?.kind === "boat" ? t("Board boat")
      : action?.kind === "boat-exit" && "landing" in action && action.landing ? t("Get out")
      : action?.kind === "bike" ? t(g.mode === "bike" ? "Park bike" : "Borrow bike")
      : action?.kind === "place" ? t("Read") : prompt;
    inter.querySelector("span")!.textContent = compact ? shortPrompt : prompt;
    const use = document.querySelector<HTMLButtonElement>("#touch-e")!;
    const selected = g.interactions.selected;
    use.dataset.target = selected?.id ?? "";
    const hasBubble = selected && Array.from(document.querySelectorAll<HTMLButtonElement>(".activity-bubble"))
      .some(button => button.dataset.target === selected.id && !button.hidden && !button.disabled);
    use.hidden = !action || g.globe || g.mode === "bike" || !!hasBubble;
    use.disabled = !action || action.kind === "boat-exit" && (!("landing" in action) || !action.landing);
    const actionIcon = action?.kind === "boat" ? "boat" : action?.kind.endsWith("-exit") ? "exit"
      : action?.kind === "bike" ? "bike" : action?.kind === "tram" ? "tram"
      : action?.kind === "place" ? "book" : "hand";
    if (use.dataset.icon !== actionIcon) { use.dataset.icon = actionIcon; use.innerHTML = icon(actionIcon); }
    use.setAttribute("aria-label", prompt || t("Use"));
    const bike = document.querySelector<HTMLButtonElement>("#touch-bike")!;
    bike.hidden = g.globe || g.activities.locked || g.mode !== "bike";
    document.querySelector<HTMLButtonElement>("#joystick")!.disabled = g.mode === "tram" || g.activities.locked;
    if (g.globe || g.mode === "tram" || g.activities.locked) this.touch?.reset();
    const tram = document.querySelector<HTMLElement>("#tram-panel")!;
    tram.hidden = g.mode !== "tram";
    if (g.mode === "tram")
      tram.innerHTML = `<span class="tram-icon">${icon("tram")}</span><div><small>${g.tramDwell ? t("AT THE STOP") : t("NEXT STOP")}</small><strong>${stops[g.tramDwell ? g.tramStop : g.tramNext].name}</strong></div><span class="tram-line">4</span>`;
    if (this.modal === "settings") {
      const f = document.querySelector("#performance");
      if (f)
        f.textContent = t("Performance: {fps} FPS · {ms} ms · {calls} draw calls · {triangles}k triangles", { fps: g.fps, ms: g.frameMs.toFixed(1), calls: g.renderer.info.render.calls, triangles: Math.round(g.renderer.info.render.triangles / 1000) });
    }
    if (g.started && !g.photo) this.drawMap(document.querySelector<HTMLCanvasElement>("#minimap")!, false);
  }
  close() {
    this.editor?.dispose(); this.editor = undefined;
    this.modal = null;
    this.game.paused = false;
    this.touch?.reset();
    this.game.resetInput();
    (document.querySelector("#modal-layer") as HTMLElement).hidden = true;
    if (this.modalOpener?.isConnected) this.modalOpener.focus();
    else document.querySelector<HTMLCanvasElement>("#world")?.focus();
  }
  open(type: string) {
    clearTimeout(this.toastTimer);
    document.querySelector<HTMLElement>("#toast")!.hidden=true;
    const previous = this.modal;
    if (!previous) this.modalOpener = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    this.editor?.dispose(); this.editor = undefined;
    this.modal = type;
    if (type === "map" && previous !== "map") this.atlas.focus(this.game);
    this.game.paused = true;
    if (document.pointerLockElement) document.exitPointerLock();
    this.touch?.reset();
    this.game.resetInput();
    const layer = document.querySelector<HTMLElement>("#modal-layer")!;
    layer.hidden = false;
    layer.innerHTML = `<section class="modal ${type}" role="dialog" aria-modal="true" aria-label="${type === "map" ? t("City map") : type === "journal" ? t("Travel journal") : type === "settings" ? t("Settings") : type === "appearance" ? t("Edit explorer") : t("Place details")}"><button id="close-modal" class="close-modal icon-btn" aria-label="${t("Close")}">${icon("close")}</button><div id="modal-content"></div></section>`;
    const content = document.querySelector("#modal-content")!;
    if (type === "appearance") {
      this.editor = new CharacterEditor(content as HTMLElement, this.game.state.character, this.game.state.appearance,
        (gender, appearance) => {
          this.game.setCharacter(gender);
          this.game.setAppearance(appearance);
          this.close();
          if (!this.game.started) this.game.start();
          else this.toast(t("Explorer saved."));
        }, () => this.close(), this.game.started ? "Save explorer" : "Save and play");
    } else if (type === "map") {
      content.innerHTML = `<div class="map-layout"><div class="big-map"><canvas id="big-map" width="900" height="900" tabindex="0" role="img" aria-label="${t("World map with 11 destinations, both poles and seven tram stops")}"></canvas><div class="map-orbit"><button class="icon-btn" id="map-left" aria-label="${t("Rotate left")}">←</button><button class="paper-btn" id="map-center">${t("Center on me")}</button><button class="icon-btn" id="map-right" aria-label="${t("Rotate right")}">→</button></div><span class="map-note">${t("A playful city. Distances are part of the dream.")}</span><div class="map-legend"><span><i class="legend-player"></i>${t("You are here")}</span><span><i></i>${t("Destination")}</span><span><b></b>${t("Tram loop")}</span></div></div><div class="place-list">${places.map((p, i) => `<button class="place-row ${p.id === this.selected ? "selected" : ""}" data-place="${p.id}"><span class="place-index">${String(i + 1).padStart(2, "0")}</span><span><strong>${p.name}</strong><small>${p.kind}</small></span><span class="place-status">${this.game.visited.has(p.id) ? icon("check") : icon("arrow")}</span></button>`).join("")}</div></div><div class="map-selection" id="map-selection"></div>`;
      const canvas = document.querySelector<HTMLCanvasElement>("#big-map")!;
      const draw = () => this.drawMap(canvas, true);
      const select = (id: string) => {
        this.selected = id;
        const place = places.find(p => p.id === id)!;
        this.atlas.focus(place);
        document.querySelectorAll<HTMLElement>(".place-row").forEach(row => {
          row.classList.toggle("selected", row.dataset.place === id);
          row.setAttribute("aria-pressed", String(row.dataset.place === id));
        });
        this.selection();
        draw();
      };
      this.atlas.bind(canvas, draw, select);
      document.querySelector("#map-left")!.addEventListener("click", () => { this.atlas.rotate(-35); draw(); });
      document.querySelector("#map-right")!.addEventListener("click", () => { this.atlas.rotate(35); draw(); });
      document.querySelector("#map-center")!.addEventListener("click", () => { this.atlas.focus(this.game); draw(); });
      document.querySelectorAll<HTMLButtonElement>("[data-place]").forEach(button => {
        button.setAttribute("aria-pressed", String(button.dataset.place === this.selected));
        button.addEventListener("click", () => select(button.dataset.place!));
      });
      draw();
      this.selection();
    } else if (type === "journal" || type === "complete") {
      this.book.open(content as HTMLElement);
    } else if (type === "place") {
      const p = places.find((p) => p.id === this.selected)!;
      content.innerHTML = `<article class="place-detail">${placePhoto(p.id,p.name)}<div class="eyebrow">${p.kind}</div><h2>${p.name}</h2><p>${placeInfo(p.id).text}</p>${wikipediaLink(p.id)}</article>`;
    } else if (type === "settings") {
      content.innerHTML = `<div class="settings-body"><h2 class="screen-title">${t("Settings")}</h2><div class="setting-row"><strong>${t("Language")}</strong><select id="settings-language" aria-label="${t("Language")}">${([['en','English'],['es','Español'],['va','Valencià']] as const).map(([code,label])=>`<option value="${code}" ${getLanguage()===code?'selected':''}>${label}</option>`).join('')}</select></div><div class="setting-row"><strong>${t("Explorer")}</strong><button type="button" id="settings-character" class="paper-btn">${icon("person")} ${t("Edit explorer")}</button></div><div class="setting-row"><div><strong>${t("Picture quality")}</strong><small>${t("Balanced is a good place to start.")}</small></div><select id="quality" aria-label="${t("Picture quality")}"><option value="low">${t("Light")}</option><option value="balanced">${t("Balanced")}</option><option value="high">${t("High")}</option></select></div><div class="setting-row"><div><strong>${t("Sound")}</strong><small>${t("Soft notes as you explore.")}</small></div><button id="toggle-sound" class="paper-btn">${this.game.sound ? t("On") : t("Off")}</button></div><div class="setting-row"><div><strong>${t("Full screen")}</strong><small>${t("A little more room for your world.")}</small></div><button id="fullscreen" class="paper-btn">${icon("expand")} ${t("Open")}</button></div><div class="controls-grid"><span><kbd>W A S D</kbd> ${t("Move")}</span><span><kbd>E</kbd> ${t("Use / interact")}</span><span><kbd>B</kbd> ${t("Borrow / park bike")}</span><span><kbd>M</kbd> ${t("City map")}</span><span><kbd>J</kbd> ${t("Travel journal")}</span><span><kbd>V</kbd> ${t("Change camera view")}</span><span><kbd>F</kbd> ${t("First person")}</span><span><kbd>P</kbd> ${t("Selfie mode")}</span><span><kbd>R</kbd> ${t("Return to Serranos")}</span><span><kbd>H</kbd> ${t("Bicycle bell")}</span><span><kbd>ESC</kbd> ${t("Pause / close")}</span></div><p class="touch-help">${t("Tap a bubble to interact.")} ${t("Move with your left thumb. Drag to look. Pinch to zoom.")} ${t("Pinch to zoom. On a bike, push up to pedal and hold down to brake and reverse.")}</p><p class="drag-help">${t("On a bike: W to pedal, A/D to steer, hold S to brake and reverse.")} ${t("Drag the world to look around. Scroll to change camera distance.")}</p><div class="performance" id="performance"></div><div class="settings-footer"><button id="resume" class="primary">${this.game.started ? t("Back to the city") : t("Close settings")} ${icon("arrow")}</button></div></div>`;
      const languageSelect = document.querySelector<HTMLSelectElement>("#settings-language")!;
      languageSelect.addEventListener("change", () => this.changeLanguage(languageSelect.value));
      bindPress(document.querySelector<HTMLButtonElement>("#settings-character")!, () => this.open("appearance"));
      const select = document.querySelector<HTMLSelectElement>("#quality")!;
      select.value = this.game.quality;
      select.addEventListener("change", () =>
        this.game.setQuality(select.value),
      );
      document.querySelector("#toggle-sound")!.addEventListener("click", () => {
        this.game.toggleSound();
        document.querySelector("#toggle-sound")!.textContent = this.game.sound
          ? t("On")
          : t("Off");
      });
      document.querySelector("#fullscreen")!.addEventListener("click", () => {
        if (document.fullscreenElement) void document.exitFullscreen();
        else if (document.documentElement.requestFullscreen)
          void document.documentElement
            .requestFullscreen()
            .catch(() =>
              this.toast(t("Full screen is not available in this browser.")),
            );
        else this.toast(t("Full screen is not available in this browser."));
      });
      document
        .querySelector("#resume")!
        .addEventListener("click", () => this.close());
    }
    bindPress(document.querySelector<HTMLButtonElement>("#close-modal")!, () => this.close());
    layer.onkeydown = event => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); this.close(); return; }
      if (event.key !== "Tab") return;
      const focusable = Array.from(layer.querySelectorAll<HTMLElement>('button, input, select, a[href], [tabindex="0"]'))
        .filter(element => element.getClientRects().length>0 && !element.closest("[hidden]") && !(element as HTMLButtonElement).disabled);
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    layer.onclick = (e) => {
      if (e.target === layer) this.close();
    };
    document.querySelector<HTMLButtonElement>("#close-modal")!.focus();
  }
  selection() {
    const p = places.find((p) => p.id === this.selected)!;
    document.querySelector("#map-selection")!.innerHTML =
      `<div><small>${t("YOUR NEXT STOP")}</small><strong>${p.name}</strong><span>${t("{distance} m away", { distance: Math.round(distance(this.game, p)) })}</span></div><button class="paper-btn" id="route">${icon("pin")} ${t("Set route")}</button><button class="primary" id="map-travel">${t("Travel here")} ${icon("arrow")}</button>`;
    document.querySelector("#map-travel")!.addEventListener("click", () => {
      this.game.goTo(p.id);
      this.close();
    });
    document.querySelector("#route")!.addEventListener("click", () => {
      this.game.waypoint = p.id;
      this.close();
      this.toast(t("Route set for {place}. Follow the orange map marker.", { place: p.short }));
    });
  }
  drawMap(canvas: HTMLCanvasElement, big: boolean) {
    this.atlas.draw(canvas, this.game, big, this.selected);
  }
}
