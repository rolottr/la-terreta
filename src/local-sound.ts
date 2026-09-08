import { assetUrl } from "./public-assets";
import * as T from "three";
import { beachContact, beachRunupArea } from "./beach-water";
import { blendAudioLoop } from "./audio-loop";
import { distance } from "./data";
import { point } from "./geometry";
import { clearSight } from "./people-behavior";
import {
  onJetty,
  onFootbridge,
  waterAt,
  edgeDistance,
  seaOutline,
} from "./wetland-layout";
import { hiddenPlaces } from "./immersion-sites";
import type { World } from "./world";

type Sound =
  | "stone"
  | "wood"
  | "sand"
  | "splash"
  | "fountain"
  | "waves"
  | "tram"
  | "boat"
  | "bell"
  | "tram-bell"
  | "cafe"
  | "masclet"
  | "firecracker-chain"
  | "water"
  | "bull"
  | "birds";
interface Voice {
  source: AudioBufferSourceNode;
  gain: GainNode;
  pan: StereoPannerNode;
  filter: BiquadFilterNode;
}
export function groundSound(
  world: Pick<World, "heightAt">,
  p: { x: number; z: number },
  time = 0,
): "stone" | "wood" | "sand" | "splash" {
  if (onJetty(p.x, p.z) || onFootbridge(p.x, p.z)) return "wood";
  const water = waterAt(p.x, p.z);
  if (water === "sea" || beachRunupArea(p.x, p.z)) {
    const contact = beachContact(
      p.x,
      p.z,
      time,
      world.heightAt(p.x, p.z),
      water,
    );
    if (contact && contact.depth > 0.045) return "splash";
  }
  if (water && world.heightAt(p.x, p.z) < 0.03) return "splash";
  if (p.x < -230 && p.x > -255 && p.z < -24 && p.z > -60) return "sand";
  return "stone";
}
export function shallowWater(x: number, z: number) {
  return (
    waterAt(x, z) === "sea" &&
    z < -30 &&
    z > -54 &&
    edgeDistance({ x, z }, seaOutline) < 1.4
  );
}
/** Bounded local voices share the music master gain, including mute and view policy. */
export class LocalSound {
  private buffers = new Map<Sound, AudioBuffer>();
  private loops = new Map<string, Voice>();
  private shots = new Set<Voice>();
  private loading?: Promise<void>;
  private lastStroke = -1;
  private lastDwell = true;
  private accumulator = 0;
  private lastPop = 0;
  enabled = false;
  constructor(
    private audio: AudioContext,
    private output: GainNode,
  ) {}

  load() {
    return (this.loading ??= Promise.all(
      (
        [
          "masclet",
          "firecracker-chain",
          "water",
          "bull",
          "fountain",
          "waves",
          "tram",
          "boat",
          "bell",
          "tram-bell",
          "cafe",
          "birds",
        ] as Sound[]
      ).map(async (name) => {
        if (this.buffers.has(name)) return;
        const response = await fetch(assetUrl(`/audio/foley/${name}.flac`));
        if (!response.ok) throw Error(`Foley ${name}: ${response.status}`);
        const buffer = await this.audio.decodeAudioData(
          await response.arrayBuffer(),
        );
        this.buffers.set(
          name,
          ["fountain", "waves", "tram", "cafe", "birds", "water"].includes(name)
            ? blendAudioLoop(this.audio, buffer)
            : buffer,
        );
      }),
    )
      .then(() => {})
      .finally(() => {
        this.loading = undefined;
      }));
  }
  private voice(name: Sound, loop: boolean) {
    const buffer = this.buffers.get(name);
    if (!buffer) return;
    const source = this.audio.createBufferSource(),
      gain = this.audio.createGain(),
      pan = this.audio.createStereoPanner(),
      filter = this.audio.createBiquadFilter();
    source.buffer = buffer;
    source.loop = loop;
    gain.gain.value = 0;
    filter.type = "lowpass";
    filter.frequency.value = 10000;
    source.connect(filter).connect(gain).connect(pan).connect(this.output);
    source.start();
    return { source, gain, pan, filter };
  }
  private release(v: Voice) {
    v.source.onended = null;
    try {
      v.source.stop();
    } catch {}
    v.source.disconnect();
    v.gain.disconnect();
    v.pan.disconnect();
    v.filter.disconnect();
    this.shots.delete(v);
  }
  oneShot(name: Sound, volume = 0.2, pan = 0) {
    if (!this.enabled || document.hidden || this.shots.size >= 12) return;
    const v = this.voice(name, false);
    if (!v) return;
    this.shots.add(v);
    v.gain.gain.value = volume;
    v.pan.pan.value = pan;
    v.source.onended = () => this.release(v);
  }
  setEnabled(enabled: boolean) {
    this.enabled = enabled && !document.hidden;
    if (!this.enabled) {
      for (const v of this.loops.values()) this.release(v);
      this.loops.clear();
      for (const v of [...this.shots]) this.release(v);
      this.lastStroke = -1;
    }
  }
  update(
    dt: number,
    world: World,
    player: {
      x: number;
      z: number;
      mode: string;
      speed: number;
      tramDwell: boolean;
      player: T.Group;
    },
    camera: T.Camera,
    _travel: number,
    _time = 0,
  ) {
    const pop = world.behavior?.fallaLife.lastPop;
    if (pop && pop.serial !== this.lastPop) {
      this.lastPop = pop.serial;
      const range = distance(player, pop);
      if (range < 65) {
        const direction = point(pop.x, pop.z).sub(point(player.x, player.z)).normalize();
        const pan = direction.dot(new T.Vector3(1, 0, 0).applyQuaternion(camera.quaternion));
        this.oneShot(pop.kind, .9 * (1 - range / 65) ** 1.5, pan);
      }
    }
    if (!this.enabled) return;
    // The water entry sound follows the same phase as the visible oar blades.
    const stroke = world.wetland.stroke;
    if (player.mode === "boat" && stroke.power > .08) {
      const cycle = Math.floor(stroke.phase / (Math.PI * 2));
      if (cycle !== this.lastStroke) this.oneShot("boat", .46);
      this.lastStroke = cycle;
    } else this.lastStroke = -1;
    if (this.lastDwell !== player.tramDwell) {
      if (distance(player, { x: world.tram.userData.x, z: -12 }) < 25)
        this.oneShot("tram-bell", 0.13);
      this.lastDwell = player.tramDwell;
    }
    this.accumulator += dt;
    if (this.accumulator < 0.12) return;
    this.accumulator = 0;
    const local = world.details;
    if (!local) return;
    const sources = [
      ...(player.mode === "boat" ? [{ id: "boat-water", sound: "water" as Sound,
        p: {x: player.x, z: player.z}, range: 8, gain: .19 + Math.min(player.speed/6,1)*.14 }] : []),
      {
        id: "fountain",
        sound: "fountain" as Sound,
        p: local.fountain,
        range: 26,
        gain: 0.25,
        radius: 1.8,
      },
      ...local.cafes.map((p, i) => ({
        id: `cafe-${i}`,
        sound: "cafe" as Sound,
        p,
        range: 18,
        gain: 0.16,
        radius: 1.5,
      })),
      {
        id: "waves",
        sound: "waves" as Sound,
        p: { x: -250, z: Math.max(-54, Math.min(-30, player.z)) },
        range: 38,
        gain: 0.32,
      },
      {
        id: "tram",
        sound: "tram" as Sound,
        p: { x: world.tram.userData.x, z: -12 },
        range: 25,
        gain: player.tramDwell ? 0.025 : 0.24,
      },
      {
        id: "grove",
        sound: "birds" as Sound,
        p: hiddenPlaces[1],
        range: 25,
        gain: 0.22,
      },
    ];
    const audible = sources
      .filter((s) => distance(player, s.p) < s.range)
      .sort((a, b) => distance(player, a.p) - distance(player, b.p))
      .slice(0, 6);
    for (const [id, v] of this.loops)
      if (!audible.some((s) => s.id === id)) {
        this.release(v);
        this.loops.delete(id);
      }
    const right = new T.Vector3(1, 0, 0).applyQuaternion(camera.quaternion),
      now = this.audio.currentTime;
    for (const s of audible) {
      let v = this.loops.get(s.id);
      if (!v) {
        v = this.voice(s.sound, true);
        if (!v) continue;
        this.loops.set(s.id, v);
      }
      const d = distance(player, s.p),
        occluded =
          s.id !== "tram" &&
          d > 3 &&
          !clearSight(world, player, s.p, "radius" in s ? s.radius : 0);
      const band = world.procession
        ? distance(player, world.procession.bandPosition)
        : 100;
      const gain =
        s.gain *
        (1 - d / s.range) ** 2 *
        (occluded ? 0.48 : 1) *
        (band < 14 ? 0.6 : 1);
      v.gain.gain.setTargetAtTime(gain, now, 0.25);
      v.filter.frequency.setTargetAtTime(occluded ? 1300 : 9500, now, 0.3);
      v.pan.pan.setTargetAtTime(
        T.MathUtils.clamp(
          point(s.p.x, s.p.z)
            .sub(point(player.x, player.z))
            .normalize()
            .dot(right),
          -0.85,
          0.85,
        ),
        now,
        0.15,
      );
    }
  }
  get diagnostics() {
    return {
      enabled: this.enabled,
      loops: this.loops.size,
      voices: this.shots.size,
      buffers: this.buffers.size,
      sources: [...this.loops.keys()],
    };
  }
  dispose() {
    this.setEnabled(false);
    this.buffers.clear();
  }
}
