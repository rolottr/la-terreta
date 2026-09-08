import { boatDocks, lagoonVisit } from "./wetland-layout";
import { stepBoat, findBoatLanding } from "./boat-navigation";
import { t } from "./i18n";
import * as T from "three";
import {
  R,
  PLACE_ARRIVAL_RADIUS,
  SAVE_KEY,
  Save,
  distance,
  dx,
  docks,
  places,
  readSave,
  spawn,
  stops,
  wrap,
} from "./data";
import { basis, point, seat } from "./geometry";
import { offset, localOffset } from "./navigation";
import { World } from "./world";
import { setPersonDetail, createHero, releaseCharacter, animateCharacter, animateLocomotion, type PlayerGender } from "./characters";
import { blocksHeightStep } from "./ground";
import { Activities } from "./activities";
import { EnvironmentClock } from "./environment";
import { LocalSound } from "./local-sound";
import { updateTram } from "./actors";
import { GameMusic } from "./game-music";
import { Locomotion, WALK_RADIUS } from "./locomotion";
import { findBikeMount } from "./bike-mount";
import { rollBike, getBikeCrankPhase, groundBike } from "./bike";
import { CameraHeight } from "./camera-height";
import { applyAppearance, normalizeAppearance, type Appearance } from "./appearance";
import { cafeSite } from "./immersion-sites";
import { poseRower } from "./rowing";
import { poseSelfie, selfieFrame } from "./selfie";
import type { TaskId } from "./activity-catalogue";
import { Interactions } from "./interactions";
import { ParkedBikes } from "./parked-bikes";
import { FollowWalls } from "./follow-walls";
export type Mode = "walk" | "bike" | "tram" | "boat";
export class Game {
  state: Save = readSave();
  visited = new Set(this.state.visited);
  mode: Mode = "walk";
  started = false;
  paused = false;
  globe = true;
  firstPerson = false;
  private photoActive = false;
  private photoView?: { globe: boolean; firstPerson: boolean; yaw: number; heading: number; pitch: number; zoom: number };
  rowingPower = 0;
  selfiePitch = .28;
  selfieZoom = 1;
  selfieLift = 0;
  adjustSelfie(axis: "yaw" | "pitch" | "zoom" | "lift", amount: number) {
    if (!this.photo || this.paused) return;
    if (axis === "yaw") this.yaw += amount;
    if (axis === "pitch") this.selfiePitch = T.MathUtils.clamp(this.selfiePitch + amount, -.45, 1.15);
    if (axis === "zoom") this.selfieZoom = T.MathUtils.clamp(this.selfieZoom + amount, .75, 2.5);
    if (axis === "lift") this.selfieLift = T.MathUtils.clamp(this.selfieLift + amount, -.6, .7);
  }
  serranosPhoto = false;
  get photo() { return this.photoActive; }
  set photo(value: boolean) {
    if (value === this.photoActive || value && this.activities.locked) return;
    this.resetInput();
    if (value) {
      this.photoView = { globe: this.globe, firstPerson: this.firstPerson, yaw: this.yaw, heading: this.heading, pitch: this.pitch, zoom: this.zoom };
      this.globe = this.firstPerson = false;
      this.yaw = this.heading;
      if (document.pointerLockElement) document.exitPointerLock();
    } else if (this.photoView) {
      Object.assign(this, this.photoView);
      this.photoView = undefined;
    }
    this.serranosPhoto = false;
    this.photoActive = value;
    if (!value && this.activities.active?.kind === "photograph") this.activities.cancel(true);
    this.snapCamera = true;
  }
  sound = true;
  quality = "balanced";
  x = this.state.x;
  z = this.state.z;
  yaw = 0;
  zoom = 7;
  pitch = 0.32;
  lookPitch = 0;
  globeZoom = 1;
  globeDirection = new T.Vector3(0, 1, 0);
  globeUp = new T.Vector3(0, 0, -1);
  private globeAnchor = point(this.x, this.z).normalize();
  heading = 0;
  speed = 0;
  private bikeSpeed = 0;
  turnRate = 0;
  private locomotion = new Locomotion();
  keys = new Set<string>();
  touchInput = { right: 0, forward: 0 };
  introHeight: number | null = null;
  player = createHero(this.state.character);
  bike: T.Group;
  parkedBikes: ParkedBikes;
  time = 0;
  travelTime = 0;
  tramClock = 0;
  processionClock = 0;
  music?: GameMusic;
  localSound?: LocalSound;
  environment = new EnvironmentClock(this.state.dayElapsed);
  activities = new Activities(this);
  interactions = new Interactions(this);
  private bikeLean = 0;
  readonly reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  private bellUntil = 0;
  private chimeUntil = 0;
  tramX = 0;
  tramStop = 0;
  tramNext = 1;
  tramDwell = true;
  exitRequested = false;
  fps = 60;
  frameMs = 16.7;
  frameCount = 0;
  minFps = 120;
  moving = false;
  resolvedTravel = 0;
  waypoint: string | null = null;
  trackedActivity: TaskId | null = null;
  bikeTaskCompletedOnPickup = false;
  get routeTarget() {
    if(this.trackedActivity){const target=this.interactions.destination(this.trackedActivity,true);if(target)return {...target,label:target.label};}
    const p=places.find(p=>p.id===this.waypoint);return p?{...p,label:p.short}:null;
  }
  onEvent: (kind: string, text?: string) => void = () => {};
  onChange: () => void = () => {};
  capture: () => void = () =>
    this.renderer.render(this.world.scene, this.camera);
  private lastSave = 0;
  private saveFailed = false;
  private audio?: AudioContext;
  private frameTimes: number[] = [];
  private previousMode: Mode = "walk";
  private snapCamera = true;
  private cameraHeight = new CameraHeight();
  private followWalls: FollowWalls;
  private welcomeOrbit = false;
  constructor(
    public world: World,
    public camera: T.PerspectiveCamera,
    public renderer: T.WebGLRenderer,
    public sun: T.DirectionalLight,
  ) {
    this.followWalls = new FollowWalls(world.group);
    this.activities.initialize();
    world.wetland.restoreBoats(this.state.boats ?? []);
    this.parkedBikes = new ParkedBikes(world, this.state.bikes);
    this.bike = this.parkedBikes.available[0].object;
    world.group.add(this.player);
    applyAppearance(this.player, this.state.appearance);
    this.input();
  }
  private stopMoving() {
    this.speed = this.bikeSpeed = this.turnRate = this.rowingPower = 0;
    this.moving = false;
    this.locomotion.reset();
  }
  resetInput() {
    this.keys.clear();
    this.touchInput.right = this.touchInput.forward = 0;
    this.stopMoving();
  }
  setCharacter(gender: PlayerGender) {
    if (this.state.character === gender) return;
    const previous = this.player;
    this.player = createHero(gender);
    this.world.group.add(this.player);
    this.world.group.remove(previous);
    releaseCharacter(previous);
    this.state.character = gender;
    applyAppearance(this.player, this.state.appearance);
    this.save();
    this.onChange();
  }
  setAppearance(appearance: Appearance) {
    this.state.appearance = normalizeAppearance(appearance);
    applyAppearance(this.player, this.state.appearance);
    this.save();
    this.onChange();
  }
  watchProcession() {
    this.activities.cancel(true);
    const parade = this.world.procession;
    if (!parade || this.mode === "tram") return;
    const position = parade.route.sample(10 + parade.clock * parade.speed - 9.5, -2.6);
    // Choose a clear place beside the procession; do not place the player in it.
    let entry = position;
    for (const lane of [-2.6, 2.6, -3.5, 3.5, 0]) {
      const candidate = parade.route.sample(10 + parade.clock * parade.speed - 9.5, lane);
      if (!this.world.blocked(candidate.x, candidate.z, .5)) { entry = candidate; break; }
    }
    this.parkedBikes.park({x:this.x,z:this.z,heading:this.heading});
    this.mode = "walk"; this.x = entry.x; this.z = entry.z;
    this.yaw = entry.yaw; this.heading = entry.yaw; this.stopMoving();
    this.keys.clear(); this.setView("follow"); this.zoom = 13; this.pitch = .5;
    this.save(); this.onEvent("toast", t("The Fallas procession. Turn sound on to hear the band."));
  }
  start() {
    if (this.sound) this.startSound();
    this.snapCamera = true;
    this.started = true;
    this.globe = false;
    if(matchMedia("(pointer: coarse)").matches&&!this.state.activities.helped&&distance(this,spawn)<2)
      this.yaw=this.heading=Math.atan2(cafeSite.x-this.x,cafeSite.z-this.z);
    this.onEvent("start");
    this.onChange();
  }
  setView(view: "first" | "follow" | "globe") {
    if (this.photo) return;
    this.resetInput();
    if (view === "globe") {
      const frame = basis(this.x, this.z);
      const forward = frame.east
        .clone()
        .multiplyScalar(Math.sin(this.yaw))
        .addScaledVector(frame.south, Math.cos(this.yaw));
      this.globeDirection
        .copy(frame.up)
        .addScaledVector(forward, -0.2)
        .normalize();
      this.globeUp
        .copy(forward)
        .negate()
        .addScaledVector(this.globeDirection, forward.dot(this.globeDirection))
        .normalize();
      this.globeAnchor.copy(frame.up);
    }
    this.globe = view === "globe";
    this.firstPerson = view === "first";
    this.snapCamera = true;
    if (view !== "first" && document.pointerLockElement)
      document.exitPointerLock();
    this.onChange();
  }
  cycleView() {
    this.setView(this.globe ? "first" : this.firstPerson ? "follow" : "globe");
  }
  input() {
    const canvas = this.renderer.domElement;
    const fingers = new Map<number, { x: number; y: number }>();
    let pinchDistance = 0;
    const fingerDistance = () => {
      const [a, b] = [...fingers.values()];
      return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
    };
    let activePointer: number | null = null,
      lastX = 0,
      lastY = 0;
    const resetPointers = () => { activePointer = null; fingers.clear(); pinchDistance = 0; };
    window.addEventListener("resize", resetPointers);
    window.addEventListener("keydown", (e) => {
      if (
        ["INPUT", "SELECT", "TEXTAREA"].includes(
          (e.target as HTMLElement)?.tagName,
        )
      )
        return;
      if (
        this.started &&
        !this.paused &&
        ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
          e.code,
        )
      )
        e.preventDefault();
      this.keys.add(e.code);
      if (e.repeat) return;
      if (this.photo && e.code !== "KeyP" && e.code !== "Escape") {
        const moves: Record<string,["yaw"|"pitch"|"zoom"|"lift",number]> = {ArrowLeft:["yaw",.12],ArrowRight:["yaw",-.12],ArrowUp:["pitch",.08],ArrowDown:["pitch",-.08],Equal:["zoom",-.12],Minus:["zoom",.12],KeyW:["lift",.08],KeyS:["lift",-.08]};
        if(moves[e.code])this.adjustSelfie(...moves[e.code]);
        return;
      }
      if (e.code === "Escape") {
        if (this.activities.active && !this.paused && !this.photo) {
          this.activities.cancel();
        } else if (this.photo) {
          this.photo = false;
          this.onEvent("photo");
        } else this.onEvent("escape");
      }
      if (!this.started || this.paused) return;
      if (e.code === "KeyE") this.interact();
      if (e.code === "KeyB") this.toggleBike();
      if (e.code === "KeyH") this.ringBell();
      if (e.code === "KeyM") this.onEvent("map");
      if (e.code === "KeyJ") this.onEvent("journal");
      if (e.code === "KeyV") {
        this.cycleView();
      }
      if (e.code === "KeyF") this.setView("first");
      if (e.code === "KeyP") {
        this.photo = !this.photo;
        this.onEvent("photo");
      }
      if (e.code === "KeyR") this.recover();
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("blur", () => {
      this.resetInput();
      resetPointers();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.localSound?.setEnabled(false);
        this.resetInput();
        resetPointers();
        this.save();
      }
    });
    canvas.addEventListener("pointerdown", (e) => {
      if (this.paused || e.button !== 0) return;
      if (e.pointerType === "touch") {
        fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        canvas.setPointerCapture(e.pointerId);
        if (fingers.size > 1) { pinchDistance = fingerDistance(); return; }
      }
      if (activePointer !== null) return;
      activePointer = e.pointerId;
      if (!this.started && !this.welcomeOrbit) {
        this.globeDirection.copy(this.camera.position).normalize();
        this.globeUp.copy(this.camera.up).projectOnPlane(this.globeDirection).normalize();
        this.welcomeOrbit = true;
      }
      lastX = e.clientX;
      lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
      if (
        this.started &&
        !this.paused &&
        this.firstPerson &&
        !this.globe &&
        e.pointerType === "mouse" &&
        !document.pointerLockElement
      ) {
        canvas.requestPointerLock()?.catch(() => {});
      }
    });
    canvas.addEventListener("pointermove", (e) => {
      if (fingers.has(e.pointerId)) {
        fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (fingers.size > 1 && !this.paused) {
          const distance = fingerDistance();
          if (this.photo && pinchDistance > 0) this.adjustSelfie("zoom", this.selfieZoom * (pinchDistance / Math.max(1,distance)-1));
          else if (this.started && this.globe && pinchDistance > 0)
            this.globeZoom = T.MathUtils.clamp(this.globeZoom * pinchDistance / Math.max(1, distance), .16, 1.35);
          else if (this.started && !this.globe && !this.firstPerson && pinchDistance > 0)
            this.zoom = T.MathUtils.clamp(this.zoom * pinchDistance / Math.max(1, distance), 4, 35);
          pinchDistance = distance;
          return;
        }
      }
      const locked = document.pointerLockElement === canvas;
      if ((!locked && activePointer !== e.pointerId) || this.paused) return;
      const mx = locked ? e.movementX : e.clientX - lastX;
      const my = locked ? e.movementY : e.clientY - lastY;
      if (this.globe) {
        const right = this.globeUp
          .clone()
          .cross(this.globeDirection)
          .normalize();
        const horizontal = new T.Quaternion().setFromAxisAngle(
          this.globeUp,
          -mx * 0.004 * (this.started ? this.globeZoom : 1),
        );
        const vertical = new T.Quaternion().setFromAxisAngle(
          right,
          -my * 0.004 * (this.started ? this.globeZoom : 1),
        );
        this.globeDirection
          .applyQuaternion(horizontal)
          .applyQuaternion(vertical)
          .normalize();
        this.globeUp.applyQuaternion(vertical).normalize();
        lastX = e.clientX;
        lastY = e.clientY;
        return;
      }
      this.yaw -= mx * 0.0035;
      if(this.photo) this.adjustSelfie("pitch",my*.004);
      else if (this.firstPerson && !this.globe)
        this.lookPitch = T.MathUtils.clamp(
          this.lookPitch - my * 0.003,
          -1.3,
          1.3,
        );
      else this.pitch = T.MathUtils.clamp(this.pitch + my * 0.004, 0.12, 1.48);
      lastX = e.clientX;
      lastY = e.clientY;
    });
    const endDrag = (e: PointerEvent) => {
      if (activePointer === e.pointerId) activePointer = null;
      fingers.delete(e.pointerId);
      pinchDistance = 0;
      const remaining = [...fingers.entries()][0];
      if (remaining) {
        activePointer = remaining[0];
        lastX = remaining[1].x; lastY = remaining[1].y;
      }
    };
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);
    canvas.addEventListener("lostpointercapture", endDrag);
    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        if (!this.started || this.paused) return;
        if (this.photo) { this.adjustSelfie("zoom",e.deltaY*.002); }
        else if (this.globe) {
          this.globeZoom = T.MathUtils.clamp(this.globeZoom * Math.exp(e.deltaY * .0015), .16, 1.35);
        } else if (!this.firstPerson)
          this.zoom = T.MathUtils.clamp(this.zoom + e.deltaY * 0.02, 4, 35);
      },
      { passive: false },
    );
  }
  nearestPlace() {
    return places.reduce((a, b) =>
      distance(this, a) < distance(this, b) ? a : b,
    );
  }
  currentPlace() {
    if(this.mode === "boat") return places.find(p=>p.id === "albufera")!;
    const place = this.nearestPlace();
    return distance(this, place) < PLACE_ARRIVAL_RADIUS ? place : null;
  }
  nearestBoatDock() {
    return boatDocks.reduce((a,b) => distance(this,this.mode === "boat" ? a.launch : a) < distance(this,this.mode === "boat" ? b.launch : b) ? a : b);
  }
  nearestDock() {
    return docks.reduce((a, b) =>
      distance(this, a) < distance(this, b) ? a : b,
    );
  }
  nearestStop() {
    return stops.reduce((a, b) =>
      distance(this, a) < distance(this, b) ? a : b,
    );
  }
  ringBell() {
    if (!this.started || this.paused || this.photo || this.mode !== "bike" || this.processionClock < this.bellUntil) return;
    this.bellUntil = this.processionClock + .8;
    this.localSound?.oneShot("bell", .25);
    this.world.behavior?.signal(this, this.processionClock);
  }
  interaction() {
    if (this.globe) return null;
    const activity = this.activities.candidate();
    if (this.activities.active && activity) return { kind: "activity", activity, label: this.activities.prompt(activity) };
    if (this.mode === "boat") {
      const landing = findBoatLanding(this, (x, z, radius) => this.world.blocked(x, z, radius));
      return { kind: "boat-exit", landing, label: t(landing ? "Leave the boat" : "Move closer to the shore") };
    }
    if (this.mode === "tram") return {kind:"tram-exit",label:t(this.exitRequested ? "Leaving at the next stop" : this.tramDwell ? "Leave tram" : "Leave at next stop")};
    if (this.mode === "bike") return {kind:"bike",label:t("Park your Valenbisi")};
    this.interactions.update();
    const target = this.interactions.selected;
    if (target) return target;
    const place=this.currentPlace();
    return place ? {kind:"place",id:place.id,label:t("Read about {place}",{place:place.short})} : null;
  }
  prompt() { return this.interaction()?.label || ""; }
  interact(targetId?: string) {
    if (!this.started || this.paused || this.photo || this.globe) return;
    const shown=targetId??(this.mode==='walk'&&!this.activities.active?this.interactions.selected?.id:undefined);
    let action=shown ? this.interactions.validate(shown) : this.interaction();if(!action)return;
    if(action.kind!=="place" && "id" in action && action.id){action=this.interactions.validate(action.id);if(!action)return;}
    if(targetId && (this.mode!=="walk" || this.activities.active))return;
    this.state.activities.helped=true;
    switch(action.kind) {
      case "pet-bull": {
        const city=this.world.cityLife!;
        if(city.petting(this.processionClock))break;
        const stand=city.petStand(this);if(!stand)break;
        this.x=stand.x;this.z=stand.z;this.stopMoving();
        const target=city.petTarget(), direction=localOffset(target.x,target.z,this.x,this.z);
        this.heading=this.yaw=Math.atan2(direction.x,direction.z);
        city.pet(this.processionClock);this.localSound?.oneShot("bull",.4);
        this.onEvent("toast",t("The bull leans into your hand."));break;
      }
      case "activity": this.activities.use(action.activity!,targetId ?? ("id" in action ? action.id : undefined));break;
      case "boat-exit": {
        if (!("landing" in action) || !action.landing) { this.onEvent("toast", t("Move closer to the shore")); break; }
        this.world.wetland.parkBoat(this, action.landing);
        this.mode = "walk";
        this.x = action.landing.x; this.z = action.landing.z;
        this.resetInput(); this.save(); this.onChange();
        this.onEvent("toast", t("Boat parked. You can board here again."));
        break;
      }
      case "boat": {
        this.world.wetland.activeBoat = "index" in action ? action.index! : this.world.wetland.nearbyBoat(this);
        const boat = this.world.wetland.mooring;
        this.mode = "boat"; this.x = boat.x; this.z = boat.z;
        this.yaw = this.heading = boat.heading; this.resetInput();
        this.onEvent("toast", matchMedia("(pointer: coarse)").matches || innerWidth <= 700 || innerHeight <= 600
          ? t("Push up to row. Move sideways to steer. Pull down to reverse. Stop by a shore to get out.")
          : t("W: row. A/D: steer. S: reverse. E: get out by a shore."));
        this.save(); this.onChange(); break;
      }
      case "tram-exit":
        if(this.tramDwell)this.leaveTram();else{this.exitRequested=true;this.onEvent("toast",t("The tram will let you off at the next stop."));}break;
      case "bike":this.toggleBike("id" in action ? action.id : undefined);break;
      case "tram":this.boardTram("index" in action ? action.index! : 0);break;
      case "place":this.onEvent("place",action.id);break;
    }
  }
  toggleBike(id?: string) {
    if(!this.started||this.paused||this.photo||this.activities.locked)return;
    if (this.activities.active) this.activities.cancel(true);
    if (!this.started || this.paused || this.photo || this.globe || this.mode === "tram" || this.mode === "boat") return;
    if (this.mode === "bike") {
      this.parkedBikes.park({x:this.x,z:this.z,heading:this.heading});
      for (const side of [1, -1]) {
        const step = offset(this.x,this.z,Math.cos(this.heading)*.9*side,-Math.sin(this.heading)*.9*side);
        if (this.world.blocked(step.x,step.z,WALK_RADIUS) || this.world.behavior?.blocksPlayer(step.x,step.z,WALK_RADIUS) ||
          blocksHeightStep(this.world.heightAt(this.x,this.z),this.world.heightAt(step.x,step.z))) continue;
        this.x=step.x;this.z=step.z;break;
      }
      this.mode = "walk";
      this.stopMoving();
      this.onEvent("toast", t("Bike parked. You can pick it up here again."));
    } else if (this.parkedBikes.nearest(this, id)) {
      const parked = this.parkedBikes.nearest(this, id)!;
      const mount = findBikeMount(this, (x, z, radius) => this.world.blocked(x, z, radius) ||
        !!this.world.behavior?.blocksPlayer(x, z, radius));
      if (!mount) {
        this.onEvent("toast", t("Move to an open space beside the dock to borrow a bike."));
        return;
      }
      this.bike = this.parkedBikes.borrow(parked);
      Object.assign(this, mount);
      this.stopMoving();
      this.bikeTaskCompletedOnPickup = this.state.activities.completed.includes("bike");
      this.mode = "bike";
      this.state.bikeTrip = true;
      this.onEvent("toast", matchMedia("(pointer: coarse)").matches || innerWidth <= 700 || innerHeight <= 600
        ? t("Your Valenbisi is ready. Push up to pedal, sideways to steer, and hold down to brake and reverse.")
        : t("Your Valenbisi is ready. W: pedal. A/D: steer. Hold S: brake and reverse."));
      this.chime();
    } else this.onEvent("toast", t("Find a Valenbisi dock beside the main road."));
    this.save();
    this.onChange();
  }
  boardTram(index: number) {
    this.parkedBikes.park({x:this.x,z:this.z,heading:this.heading});
    this.activities.cancel(true);
    this.mode = "tram";
    this.stopMoving();
    this.tramClock = index * 26;
    this.tramStop = index;
    this.tramNext = (index + 1) % stops.length;
    this.tramX = stops[index].x;
    this.exitRequested = false;
    this.tramDwell = true;
    this.x = stops[index].x;
    this.z = -12;
    this.globe = false;
    this.yaw = Math.PI / 2;
    this.heading = this.yaw;
    this.lookPitch = 0;
    this.state.tramTrip = true;
    this.onEvent("toast", t("On board at {name}. Enjoy the ride.", { name: stops[index].name }));
    this.save();
    this.chime();
    this.onChange();
  }
  leaveTram() {
    const s = stops[this.tramStop];
    // Xàtiva's south exit overlaps the town hall. Try both sides, leaving
    // room to walk between the tram and the north platform's bench.
    const clearance = WALK_RADIUS + .2;
    const platform = [3.5, -2.5].flatMap(side =>
      [3.84, 0, -3.84].map(along => offset(s.x, -12, along, side)),
    ).find(p => !this.world.blocked(p.x, p.z, clearance) &&
      !this.world.behavior?.blocksPlayer(p.x, p.z, clearance, this) &&
      !this.world.cityLife?.blocksPlayer(p.x, p.z, clearance, this) &&
      !blocksHeightStep(.23, this.world.heightAt(p.x, p.z)));
    if (!platform) {
      if (!this.exitRequested) {
        this.exitRequested = true;
        this.onChange();
        this.onEvent("toast", t("The tram will let you off at the next stop."));
      }
      return;
    }
    this.x = platform.x;
    this.z = platform.z;
    this.mode = "walk";
    this.heading = this.yaw;
    this.exitRequested = false;
    this.stopMoving();
    this.save();
    this.onChange();
    this.onEvent("toast", t("Arrived at {name}.", { name: s.name }));
  }
  goTo(id: string) {
    this.activities.cancel(true);
    this.snapCamera = true;
    const p = places.find((p) => p.id === id);
    if (!p) return;
    this.parkedBikes.park({x:this.x,z:this.z,heading:this.heading});
    this.mode = "walk";
    const entrance = p.id === "albufera" ? lagoonVisit : offset(p.x, p.z, 0, -16);
    this.x = entrance.x;
    this.z = entrance.z;
    this.yaw = p.id === "albufera" ? Math.PI : 0;
    this.heading = this.yaw;
    this.lookPitch = 0.08;
    this.globe = false;
    this.stopMoving();
    this.waypoint = id;
    this.save();
    this.onChange();
    this.onEvent(
      "toast",
      t("You are near {place}. Walk towards the gold marker.", { place: p.short }),
    );
  }
  recover() {
    this.parkedBikes.park({x:this.x,z:this.z,heading:this.heading});
    this.activities.cancel(true);
    this.snapCamera = true;
    this.mode = "walk";
    this.x = spawn.x;
    this.z = spawn.z;
    this.yaw = 0;
    this.heading = 0;
    this.lookPitch = 0;
    this.stopMoving();
    this.globe = false;
    this.keys.clear();
    this.save();
    this.onEvent("toast", t("Back at Serranos. Your journal is safe."));
    this.onChange();
  }
  save() {
    try {
      localStorage.setItem(
        SAVE_KEY,
        JSON.stringify({
          ...this.state,
          visited: [...this.visited],
          boats: this.world.wetland.savedBoats(),
          bikes: this.parkedBikes.saved({x:this.x,z:this.z,heading:this.heading}),
          dayElapsed: this.environment.elapsed,
          x: this.mode === "boat" ? lagoonVisit.x : this.mode === "tram" ? stops[this.tramStop].x : this.activities.savePosition?.x ?? this.x,
          z: this.mode === "boat" ? lagoonVisit.z : this.mode === "tram" ? -8.5 : this.activities.savePosition?.z ?? this.z,
        }),
      );
    } catch {
      if (!this.saveFailed) {
        this.saveFailed = true;
        this.onEvent(
          "toast",
          t("This browser cannot save your journal. You can still play."),
        );
      }
    }
  }
  setQuality(value: string) {
    this.quality = value;
    const ratio = Math.min(
      window.devicePixelRatio,
      value === "high" ? 2 : value === "low" ? 1 : 1.35,
    );
    this.renderer.setPixelRatio(ratio);
    this.sun.shadow.mapSize.setScalar(value === "high" ? 4096 : 2048);
    this.sun.shadow.map?.dispose();
    this.sun.shadow.map = null;
    this.renderer.shadowMap.enabled = value !== "low";
    this.onChange();
  }
  private startSound() {
    this.audio ??= new AudioContext();
    this.music ??= new GameMusic(this.audio);
    this.localSound ??= new LocalSound(this.audio, this.music.output);
    void Promise.all([this.audio.resume(), this.music.load(), this.localSound.load()]).catch(() => {
      this.onEvent("toast", t("Music could not load. Turn sound off and on to try again."));
    });
  }
  toggleSound() {
    this.sound = !this.sound;
    if (this.sound) {
      this.startSound();
    } else {
      this.music?.setEnabled(false);
      this.localSound?.setEnabled(false);
    }
    this.onChange();
  }
  chime() {
    if (!this.sound || !this.audio || !this.music || this.paused || this.globe || document.hidden) return;
    if (this.audio.currentTime < this.chimeUntil) return;
    this.chimeUntil = this.audio.currentTime + .35;
    for (const [i, f] of [523.25, 659.25, 783.99].entries()) {
      const o = this.audio.createOscillator(),
        gain = this.audio.createGain();
      o.type = "sine";
      o.frequency.value = f;
      gain.gain.setValueAtTime(0, this.audio.currentTime);
      gain.gain.linearRampToValueAtTime(
        0.045,
        this.audio.currentTime + i * 0.07 + 0.02,
      );
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        this.audio.currentTime + i * 0.07 + 0.8,
      );
      o.connect(gain).connect(this.music.output);
      o.start(this.audio.currentTime + i * 0.07);
      o.stop(this.audio.currentTime + i * 0.07 + 0.9);
      o.onended = () => { o.disconnect(); gain.disconnect(); };
    }
  }
  photoDownload() {
    if (!this.photo) return;
    this.step(0);
    this.capture();
    const source = this.renderer.domElement,
      photo = document.createElement("canvas");
    photo.width = source.width;
    photo.height = source.height;
    const ctx = photo.getContext("2d")!;
    const sky = ctx.createRadialGradient(
      photo.width * 0.55,
      photo.height * 0.43,
      0,
      photo.width * 0.55,
      photo.height * 0.43,
      Math.max(photo.width, photo.height) * 0.8,
    );
    sky.addColorStop(0, "#e4e6cf");
    sky.addColorStop(0.55, "#b5d4d2");
    sky.addColorStop(1, "#8bbabf");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, photo.width, photo.height);
    ctx.drawImage(source, 0, 0);
    const data = photo.toDataURL("image/png");
    const a = document.createElement("a");
    a.download = `la-terreta-selfie-${this.nearestPlace().id}.png`;
    a.href = data;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
    this.onEvent("photo-ready", data);
    const requestResult = this.activities.photoTaken();
    this.onEvent(
      "toast",
      requestResult === false ? t(distance(this,{x:98,z:9})<30?"Keep yourself and the Falla in view.":"Keep both Serranos towers in the photo. Turn towards the gate and try again.") : t("Your photo is ready. Use the preview to save it again."),
    );
  }

  step(dt: number) {
    this.frameTimes.push(dt * 1000);
    dt = Math.min(dt, 0.05);
    const active = !this.paused && !document.hidden && !this.photo;
    if (active) this.time += dt;
    if (active) this.processionClock += dt;
    this.environment.step(dt, active && this.started);
    let travel = 0;
    this.resolvedTravel=0;
    if (this.frameTimes.length > 120) this.frameTimes.shift();
    if (++this.frameCount % 30 === 0) {
      this.frameMs =
        this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
      this.fps = Math.round(1000 / this.frameMs);
      this.minFps = Math.min(this.minFps, this.fps);
    }
    // Each route stop has a six-second dwell, followed by twenty seconds of travel.
    if (active) this.tramClock = (this.tramClock + dt) % (stops.length * 26);
    const segment = Math.floor(this.tramClock / 26),
      phase = this.tramClock % 26;
    this.tramStop = segment;
    this.tramNext = (segment + 1) % stops.length;
    this.tramDwell = phase < 6;
    const u = Math.max(0, (phase - 6) / 20);
    const eased = u * u * (3 - 2 * u);
    this.tramX = wrap(stops[segment].x + eased * dx(stops[this.tramNext].x, stops[segment].x));
    seat(this.world.tram, this.tramX, -12, 0.23);
    this.world.tram.userData.x = this.tramX;
    if (this.started && active && (!this.globe || this.mode === "tram")) {
      if (this.activities.locked || this.world.cityLife?.petting(this.processionClock)) this.stopMoving();
      else if (this.mode === "tram") {
        this.x = this.tramX;
        this.z = -12;
        if (this.exitRequested && this.tramDwell) this.leaveTram();
      } else if(this.mode === "boat") {
        const forward=this.touchInput.forward || (this.keys.has("KeyW")||this.keys.has("ArrowUp")?1:0)-(this.keys.has("KeyS")||this.keys.has("ArrowDown")?1:0);
        const right=this.touchInput.right || (this.keys.has("KeyD")||this.keys.has("ArrowRight")?1:0)-(this.keys.has("KeyA")||this.keys.has("ArrowLeft")?1:0);
        const boatBefore={x:this.x,z:this.z};
        Object.assign(this,stepBoat(this,forward,right,dt));
        travel=distance(boatBefore,this);
        if(Math.abs(forward)>0)this.activities.credit("rowing",travel);this.moving=Math.abs(this.speed)>.04;
        this.rowingPower = this.moving ? Math.min(1,Math.abs(forward)) : 0;
        if(this.moving)this.travelTime+=dt;
      } else {
        const input = {
          right: (this.keys.has("KeyD") || this.keys.has("ArrowRight") ? 1 : 0) -
            (this.keys.has("KeyA") || this.keys.has("ArrowLeft") ? 1 : 0),
          forward: (this.keys.has("KeyW") || this.keys.has("ArrowUp") ? 1 : 0) -
            (this.keys.has("KeyS") || this.keys.has("ArrowDown") ? 1 : 0),
          bike: this.mode === "bike",
          terrain: this.world.waterFactor(this.x, this.z, this.processionClock),
        };
        if(this.activities.active?.kind==="procession"){input.terrain*=this.world.procession!.speed/6.6;}
        input.right = T.MathUtils.clamp(input.right + this.touchInput.right, -1, 1);
        input.forward = T.MathUtils.clamp(input.forward + this.touchInput.forward, -1, 1);
        if (input.bike && (this.keys.has("KeyS") || this.keys.has("ArrowDown"))) input.forward = -1;
        const floorBefore = this.world.heightAt(this.x,this.z);
        const motion = this.locomotion.step(this, input, dt,
          (x, z, radius) => this.world.blocked(x, z, radius) ||
            !!this.world.behavior?.blocksPlayer(x, z, radius, this) ||
            !!this.world.cityLife?.blocksPlayer(x,z,radius,this) ||
            blocksHeightStep(floorBefore,this.world.heightAt(x,z)));
        travel = motion.distance;
        this.x = motion.x; this.z = motion.z;
        this.yaw = motion.yaw; this.heading = motion.heading;
        this.speed = motion.speed; this.turnRate = motion.turnRate;
        if (input.bike) {
          this.activities.credit("bike",motion.distance);
          this.bikeSpeed = motion.signedSpeed;
          rollBike(this.bike, motion.signedDistance);
        }
        this.moving = this.speed > .04;
        if (this.moving) this.travelTime += dt;
      }
      for (const p of places) {
        if (this.waypoint === p.id && distance(this, p) < PLACE_ARRIVAL_RADIUS)
          this.waypoint = null;
        if (!this.visited.has(p.id) && distance(this, p) < PLACE_ARRIVAL_RADIUS) {
          this.visited.add(p.id);
          this.save();
          this.chime();
          this.onEvent("discovery", p.id);
          if (this.visited.size === places.length) this.onEvent("complete");
        }
      }
      if (this.time - this.lastSave > 4) {
        this.save();
        this.lastSave = this.time;
      }
    }
    this.player.visible =
      this.started && (this.photo || this.mode !== "tram" && (!this.firstPerson || this.globe));
    setPersonDetail(this.player, !this.globe);
    if (this.mode === "bike") this.bike.visible = !this.photo && (!this.firstPerson || this.globe);
    this.world.tram.visible = true;
    updateTram(this.world.tram,this.processionClock,active ? dt : 0,this.tramDwell,
      !this.globe && distance(this,{x:this.tramX,z:-12})<35);
    this.world.wetland.update(this.processionClock,this.mode === "boat" ? this : undefined);
    const ground = this.world.heightAt(this.x, this.z);
    seat(
      this.player,
      this.x,
      this.z,
      this.mode === "boat" ? .28 : this.photo && this.mode === "tram" ? .72 : ground + (this.mode === "bike" && !this.photo ? 0.38 : 0),
      this.photo ? this.yaw : this.heading,
    );
    if (this.mode === "bike") seat(this.bike, this.x, this.z, ground + 0.03, this.heading);
    const leanTarget = this.mode === "bike" && !this.reducedMotion.matches
      ? T.MathUtils.clamp(-this.turnRate * this.speed * .055,-.22,.22) : 0;
    this.bikeLean = T.MathUtils.damp(this.bikeLean,leanTarget,7,active ? dt : 0);
    if (this.mode === "bike" && !this.photo) {
      this.bike.rotateZ(this.bikeLean);
      groundBike(this.bike, this.world.ground);
      this.player.quaternion.copy(this.bike.quaternion);
      this.player.position.copy(this.bike.position).add(new T.Vector3(0,.35,0).applyQuaternion(this.bike.quaternion));
    }
    if (this.photo) {
      animateCharacter(this.player, this.processionClock, "Idle",
        this.mode === "tram" || this.mode === "boat" ? undefined : this.world.ground);
      poseSelfie(this.player);
    } else if (this.activities.clip) {
      animateCharacter(this.player,this.processionClock,this.activities.clip,this.world.ground,this.activities.clip==="March"?this.speed/((.44/.60)/1.2):1);
    } else if(this.mode === "boat") {
      const boat = this.world.wetland.boat;
      this.player.position.copy(boat.localToWorld(new T.Vector3(0,-.04,.55)));
      this.player.quaternion.copy(boat.quaternion).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.PI));
      animateCharacter(this.player,this.processionClock,"Row",undefined,0,this.world.wetland.stroke.phase);
      const stroke = this.world.wetland.stroke;
      poseRower(this.player,boat,stroke.phase,stroke.power);
    } else if (this.mode === "bike") {
      animateCharacter(this.player, this.processionClock, "Cycle", undefined, 0, getBikeCrankPhase(this.bike));
    } else {
      animateLocomotion(this.player, this.processionClock, this.speed, this.turnRate, this.world.ground);
    }
    this.resolvedTravel=travel;
    if (this.started && active) this.activities.update(dt);
    this.activities.pose();
    if(!this.photo)this.world.cityLife?.petPose(this.player,this.processionClock);
    this.world.events?.update(active && this.started ? dt : 0,this.processionClock,this,
      active && this.started && !this.photo && !this.activities.active && this.mode === "walk",this.globe);
    const awning = this.world.events?.schedule.active;
    this.world.behavior?.update(this.processionClock,this,this.globe,this.activities.active?.kind === "horchata",
      awning?.kind === "awning" && awning.elapsed < 8 ? awning.elapsed : undefined);
    this.world.details?.update(this.processionClock,this,this.globe);
    this.world.reactions?.update(active && this.started ? dt : 0,this.processionClock,this,travel,this.globe);
    this.world.setLampLevel(this.environment.values.lamps);
    for(const water of this.world.water) {
      const uniforms=(water.material as T.ShaderMaterial).uniforms;
      if(uniforms.lightDirection)uniforms.lightDirection.value.copy(this.sun.position).sub(this.sun.target.position).normalize();
      if(uniforms.daylight)uniforms.daylight.value=T.MathUtils.clamp(this.environment.values.sunIntensity/3.2,.15,1);
    }
    this.world.setView(this.x, this.z, this.globe || !this.started);
    this.world.update(this.processionClock, this.visited, this.mode === "walk" ? this.player : undefined, this.processionClock);
    const parade = this.world.procession;
    this.updateCamera(dt);
    this.world.cityLife?.update(this.processionClock, point(this.x,this.z), this.globe || !this.started, this.camera.position);
    if (this.music) {
      const band = parade?.bandPosition;
      const pan = band ? point(band.x, band.z).sub(point(this.x, this.z)).normalize()
        .dot(new T.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion)) : 0;
      this.music.update(this.sound && this.started && active && !this.globe && !this.photo,
        this, band ? distance(this, band) : Infinity, pan);
    }
    this.localSound?.setEnabled(this.sound && this.started && active && !this.globe && !this.photo);
    this.localSound?.update(dt,this.world,this,this.camera,travel,this.processionClock);
    if (this.previousMode !== this.mode) {
      this.previousMode = this.mode;
      this.onChange();
    }
  }
  updateCamera(dt: number) {
    const b = basis(this.x, this.z);
    const up = b.up;
    const support = this.mode === "boat" ? .28 : this.photo && this.mode === "tram" ? .72 : this.world.heightAt(this.x, this.z);
    const ground = this.cameraHeight.step(support, dt, this.snapCamera);
    if (this.globe && this.started) {
      const carry = new T.Quaternion().setFromUnitVectors(this.globeAnchor, up);
      this.globeDirection.applyQuaternion(carry).normalize();
      this.globeUp.applyQuaternion(carry).normalize();
    }
    this.globeAnchor.copy(up);
    let desired: T.Vector3, target: T.Vector3;
    if (this.photo) {
      const selfie = selfieFrame(this.x, this.z, ground, this.yaw, this.camera.aspect, this.selfiePitch, this.selfieZoom, this.selfieLift);
      desired = selfie.position;
      target = selfie.target;
      this.camera.up.copy(selfie.up);
    } else if (this.globe || !this.started) {
      const height = !this.started && this.introHeight !== null
        ? this.introHeight : Math.max(235, 90 + 215 / this.camera.aspect) * (this.started ? this.globeZoom : 1);
      desired = this.started || this.welcomeOrbit
        ? this.globeDirection.clone().multiplyScalar(R + height)
        : point(10 + this.time * 0.9, 18, height);
      target = new T.Vector3(0, 0, 0);
      this.camera.up
        .lerp(
          this.started || this.welcomeOrbit ? this.globeUp : new T.Vector3(0, 0, -1),
          1 - Math.exp(-dt * 3),
        )
        .normalize();
    } else if (this.firstPerson) {
      const forward = b.east
        .clone()
        .multiplyScalar(Math.sin(this.yaw))
        .addScaledVector(b.south, Math.cos(this.yaw));
      const eye =
        this.mode === "tram" ? 2.0 : this.mode === "bike" ? 2.1 : this.mode === "boat" ? 1.22 : 1.72;
      desired = point(
        this.x,
        this.z,
        ground + eye,
      );
      target = desired
        .clone()
        .addScaledVector(forward, Math.cos(this.lookPitch) * 10)
        .addScaledVector(up, Math.sin(this.lookPitch) * 10);
      this.camera.up.copy(up);
    } else {
      const forward = b.east
        .clone()
        .multiplyScalar(Math.sin(this.yaw))
        .addScaledVector(b.south, Math.cos(this.yaw));
      const zoom = this.mode === "tram" ? Math.max(20, this.zoom) : this.mode === "boat" ? Math.max(7.2, this.zoom) : this.zoom;
      desired = point(this.x, this.z, ground + (this.mode === "boat" ? 1.4 : 1.85))
        .addScaledVector(up, zoom * Math.sin(this.pitch))
        .addScaledVector(forward, -zoom * Math.cos(this.pitch));
      // At close zoom, frame the person from hat to sole. Ease back to the
      // existing forward-looking travel camera as the player zooms out.
      const lookAhead = T.MathUtils.smoothstep(zoom, 4, 12);
      target = this.mode === "boat"
        ? point(this.x,this.z,ground+.65+.5*lookAhead).addScaledVector(forward,1.1*lookAhead)
        : point(this.x, this.z,ground+1.2+1.8*lookAhead).addScaledVector(forward,5*lookAhead);
      this.camera.up.lerp(up, 1 - Math.exp(-dt * 8)).normalize();
    }
    if (this.started && !this.globe && !this.firstPerson && !this.photo) {
      const focus = point(this.x, this.z, ground + 1.4);
      const clear = this.followWalls.limit(focus, desired, this.mode !== "tram");
      if (clear.distanceToSquared(desired) > .0001) {
        desired = clear;
        target = focus;
      }
    }
    if (this.snapCamera || this.photo || (this.firstPerson && !this.globe)) {
      this.camera.position.copy(desired);
      this.camera.up.copy(this.globe ? this.globeUp : up);
      this.snapCamera = false;
    } else
      this.camera.position.lerp(
        desired,
        1 - Math.exp(-dt * (this.globe ? 2 : 5)),
      );
    if (this.started && !this.globe && !this.firstPerson && !this.photo) {
      const focus = point(this.x, this.z, ground + 1.4);
      const clear = this.followWalls.limit(focus, this.camera.position, this.mode !== "tram");
      if (clear.distanceToSquared(this.camera.position) > .0001) {
        this.camera.position.copy(clear);
        target = focus;
      }
    }
    this.camera.lookAt(target);
    this.world.followOcclusion.update(
      this.camera.position,
      this.player.position.clone().addScaledVector(up, 1.1),
      this.started && !this.globe && !this.firstPerson,
      dt,
    );
    // Keep centimetre-separated ground layers distinct from orbit. Use the
    // actual camera distance so zoom transitions also retain depth precision.
    const near = Math.max(
      0.08,
      Math.min(100, this.camera.position.length() - R - 80),
    );
    // Keep both towers in the narrow phone frame for the Serranos request.
    const photoFov = this.serranosPhoto
      ? Math.min(100, 2 * T.MathUtils.radToDeg(Math.atan(Math.tan(T.MathUtils.degToRad(58) / 2) / Math.min(1, this.camera.aspect))))
      : 58;
    const fov = this.photo ? photoFov : !this.globe && this.firstPerson ? 72 : this.globe ? 45 : 55;
    if (this.camera.fov !== fov || this.camera.near !== near) {
      this.camera.fov = fov;
      this.camera.near = near;
      this.camera.updateProjectionMatrix();
    }
    if (this.globe || !this.started) {
      this.sun.position.lerp(new T.Vector3(-140,220,-180),1-Math.exp(-dt*2));
      this.sun.target.position.lerp(new T.Vector3(),1-Math.exp(-dt*2));
      this.sun.shadow.camera.left = -130;
      this.sun.shadow.camera.right = 130;
      this.sun.shadow.camera.top = 130;
      this.sun.shadow.camera.bottom = -130;
    } else {
      const lightOffset = new T.Vector3(-60, 0, -35);
      lightOffset.addScaledVector(up, -lightOffset.dot(up));
      this.sun.position.lerp(point(this.x,this.z,100).add(lightOffset),1-Math.exp(-dt*2));
      this.sun.target.position.lerp(point(this.x,this.z),1-Math.exp(-dt*2));
      this.sun.shadow.camera.left = -45;
      this.sun.shadow.camera.right = 45;
      this.sun.shadow.camera.top = 45;
      this.sun.shadow.camera.bottom = -45;
    }
    const hemi = this.world.scene.getObjectByName("sky-light");
    if (hemi) hemi.position.lerp((this.globe ? new T.Vector3(0,1,0) : up).multiplyScalar(200),1-Math.exp(-dt*2));
    this.sun.shadow.camera.updateProjectionMatrix();
  }
}
