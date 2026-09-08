import { assetUrl } from "./public-assets";
import { distance, places } from "./data";

type Track = "city" | "forest" | "band";
const nature = new Set(["turia", "albufera", "beach"]);
const urbanPlaces = places.filter(place => !nature.has(place.id));
const naturalPlaces = places.filter(place => nature.has(place.id));
const smooth = (start: number, end: number, value: number) => {
  const u = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return u * u * (3 - 2 * u);
};

// Use surface distances: longitude wraps and both poles are walkable.
export function musicMix(player: { x: number; z: number }, bandDistance: number) {
  const urban = Math.min(...urbanPlaces.map(place => distance(player, place)));
  const natural = Math.min(...naturalPlaces.map(place => distance(player, place)));
  const forest = Math.max(smooth(35, 65, urban),
    (1 - smooth(25, 55, natural)) * smooth(0, 22, urban - natural));
  const presence = 1 - smooth(7, 55, bandDistance);
  const background = .12 * (1 - .94 * presence);
  return {
    city: background * Math.cos(forest * Math.PI / 2),
    forest: background * Math.sin(forest * Math.PI / 2),
    band: .7 * presence * presence,
    bandCutoff: 850 + 11150 * presence,
  };
}

/** Local, gesture-enabled music. No API calls or credentials in the browser. */
export class GameMusic {
  readonly output: GainNode;
  private gains: Record<Track, GainNode>;
  private bandFilter: BiquadFilterNode;
  private bandPan: StereoPannerNode;
  private sources = new Map<Track, AudioBufferSourceNode>();
  private loading?: Promise<void>;
  private enabled = false;

  constructor(private audio: AudioContext) {
    this.output = audio.createGain();
    this.output.gain.value = 0;
    const limiter = audio.createDynamicsCompressor();
    limiter.threshold.value = -3; limiter.knee.value = 0; limiter.ratio.value = 20;
    limiter.attack.value = .002; limiter.release.value = .18;
    this.output.connect(limiter).connect(audio.destination);
    this.gains = { city: audio.createGain(), forest: audio.createGain(), band: audio.createGain() };
    this.bandFilter = audio.createBiquadFilter();
    this.bandFilter.type = "lowpass";
    this.bandFilter.Q.value = .5;
    this.bandPan = audio.createStereoPanner();
    for (const name of ["city", "forest", "band"] as const) {
      this.gains[name].gain.value = 0;
      if (name === "band") {
        this.gains[name].connect(this.bandFilter).connect(this.bandPan).connect(this.output);
      } else {
        const filter = audio.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = name === "city" ? 1800 : 3200;
        filter.Q.value = .5;
        this.gains[name].connect(filter).connect(this.output);
      }
    }
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.setEnabled(false);
    });
    window.addEventListener("pagehide", () => this.setEnabled(false));
  }

  load() {
    // Repeated clicks share pending work. A later click retries only failed files.
    return this.loading ??= this.loadTracks().finally(() => { this.loading = undefined; });
  }

  private async loadTracks() {
    const results = await Promise.allSettled((["city", "forest", "band"] as const).map(async name => {
      if (this.sources.has(name)) return;
      const response = await fetch(assetUrl(`/audio/${name}.mp3`));
      if (!response.ok) throw new Error(`Music file ${name}: ${response.status}`);
      const decoded = await this.audio.decodeAudioData(await response.arrayBuffer());
      const source = this.audio.createBufferSource();
      source.buffer = this.makeLoop(decoded, name === "band" ? .18 : 2);
      source.loop = true;
      source.connect(this.gains[name]);
      source.start();
      this.sources.set(name, source);
    }));
    if (results.some(result => result.status === "rejected")) throw new Error("Music could not load");
  }

  private makeLoop(buffer: AudioBuffer, seconds: number) {
    // Blend the tail into the head once, then let Web Audio loop without timers.
    const overlap = Math.min(Math.floor(seconds * buffer.sampleRate), Math.floor(buffer.length / 4));
    const length = buffer.length - overlap;
    const loop = this.audio.createBuffer(buffer.numberOfChannels, length, buffer.sampleRate);
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const input = buffer.getChannelData(channel), output = loop.getChannelData(channel);
      output.set(input.subarray(overlap));
      for (let i = 0; i < overlap; i++) {
        const blend = smooth(0, overlap - 1, i);
        output[length - overlap + i] = input[length + i] * (1 - blend) + input[i] * blend;
      }
    }
    return loop;
  }

  setEnabled(enabled: boolean) {
    if (enabled === this.enabled) return;
    this.enabled = enabled;
    this.output.gain.setTargetAtTime(enabled ? 1 : 0, this.audio.currentTime, enabled ? .35 : .04);
  }

  update(enabled: boolean, player: { x: number; z: number }, bandDistance: number, pan: number) {
    this.setEnabled(enabled && !document.hidden);
    if (!enabled) return;
    const mix = musicMix(player, bandDistance), now = this.audio.currentTime;
    for (const name of ["city", "forest", "band"] as const)
      this.gains[name].gain.setTargetAtTime(mix[name], now, name === "band" ? .3 : 1.2);
    this.bandFilter.frequency.setTargetAtTime(mix.bandCutoff, now, .3);
    this.bandPan.pan.setTargetAtTime(Math.max(-.8, Math.min(.8, pan)), now, .15);
  }
}
