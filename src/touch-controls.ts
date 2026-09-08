import type { Game } from "./game";

/** Match the mobile control layout, including narrow desktop browser panels. */
export function mobileControls() {
  return matchMedia('(pointer: coarse)').matches || innerWidth <= 700 || innerHeight <= 600;
}

let lastTouchPress: {time:number;x:number;y:number}|null=null;
let clickGuardInstalled=false;
/** Touch browsers can omit click when a second finger is held on the joystick. */
export function bindPress(button: HTMLButtonElement, action: () => void) {
  if(!clickGuardInstalled){
    clickGuardInstalled=true;
    // Opening a panel can retarget the compatibility click to its new backdrop.
    // Consume that same touch globally, while keeping keyboard clicks available.
    document.addEventListener('click',event=>{
      const p=lastTouchPress;
      if(event.detail && p && performance.now()-p.time<650 && Math.hypot(event.clientX-p.x,event.clientY-p.y)<24){
        event.preventDefault();event.stopImmediatePropagation();lastTouchPress=null;
      }
    },true);
  }
  let touch: { id: number; x: number; y: number } | null = null;
  let suppressClickUntil = 0;
  button.addEventListener("pointerdown", event => {
    if (event.pointerType === "touch" && !button.disabled)
      touch = { id: event.pointerId, x: event.clientX, y: event.clientY };
  });
  button.addEventListener("pointermove", event => {
    if (touch?.id === event.pointerId && Math.hypot(event.clientX - touch.x, event.clientY - touch.y) > 12)
      touch = null;
  });
  button.addEventListener("pointercancel", () => { touch = null; });
  button.addEventListener("pointerup", event => {
    if (touch?.id !== event.pointerId) return;
    touch = null;
    suppressClickUntil = performance.now() + 600;
    lastTouchPress={time:performance.now(),x:event.clientX,y:event.clientY};
    if (!button.disabled) action();
  });
  button.addEventListener("click", event => {
    // Keyboard activation has detail 0 and must still work after a touch.
    if (event.detail && performance.now() < suppressClickUntil) return;
    action();
  });
}

/** One captured pointer steers; a second finger remains free to move the camera. */
export class TouchControls {
  private events = new AbortController();
  private pointer: number | null = null;
  private stick: HTMLButtonElement;
  private knob: HTMLElement;
  constructor(private game: Game, root: HTMLElement) {
    this.stick = root.querySelector<HTMLButtonElement>("#joystick")!;
    this.knob = root.querySelector<HTMLElement>(".joystick-knob")!;
    const options = { signal: this.events.signal };
    this.stick.addEventListener("pointerdown", event => {
      if (this.pointer !== null || !game.started || game.paused || game.photo || game.globe || game.mode === "tram") return;
      event.preventDefault();
      this.pointer = event.pointerId;
      this.stick.setPointerCapture(event.pointerId);
      this.move(event);
    }, options);
    this.stick.addEventListener("pointermove", event => this.move(event), options);
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"] as const) {
      this.stick.addEventListener(type, event => {
        if (event.pointerId === this.pointer) this.reset();
      }, options);
    }
    window.addEventListener("blur", () => this.reset(), options);
    window.addEventListener("resize", () => this.reset(), options);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.reset();
    }, options);
    this.stick.addEventListener("contextmenu", event => event.preventDefault(), options);
  }
  private move(event: PointerEvent) {
    if (event.pointerId !== this.pointer) return;
    if (this.game.paused || this.game.photo || this.game.globe) { this.reset(); return; }
    const rect = this.stick.getBoundingClientRect();
    const radius = rect.width * .32;
    const x = event.clientX - rect.left - rect.width / 2;
    const y = event.clientY - rect.top - rect.height / 2;
    const distance = Math.hypot(x, y);
    const scale = distance ? Math.min(1, radius / distance) : 0;
    const magnitude = Math.min(1, distance / radius);
    const strength = Math.max(0, (magnitude - .12) / .88);
    this.game.touchInput.right = distance ? x / distance * strength : 0;
    this.game.touchInput.forward = distance ? -y / distance * strength : 0;
    this.knob.style.transform = `translate(${x * scale}px, ${y * scale}px)`;
    this.stick.classList.toggle("active", strength > 0);
  }
  reset() {
    const pointer = this.pointer;
    this.pointer = null;
    if (pointer !== null && this.stick.hasPointerCapture(pointer)) this.stick.releasePointerCapture(pointer);
    this.game.touchInput.right = this.game.touchInput.forward = 0;
    this.knob.style.transform = "";
    this.stick.classList.remove("active");
  }
  dispose() { this.reset(); this.events.abort(); }
}
