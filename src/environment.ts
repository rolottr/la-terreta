import * as T from "three";

export const DAY_LENGTH = 20 * 60;
export function environmentAt(seconds: number) {
  const progress = T.MathUtils.clamp(seconds / DAY_LENGTH, 0, 1);
  const dusk = T.MathUtils.smoothstep(progress, 0.3, 0.8);
  const night = T.MathUtils.smoothstep(progress, 0.65, 1);
  const blend = (a: string, b: string, c: string) =>
    new T.Color(a).lerp(new T.Color(b), dusk).lerp(new T.Color(c), night);
  return {
    progress,
    dusk,
    night,
    phase:
      progress < 0.45
        ? ("Afternoon" as const)
        : progress < 0.85
          ? ("Sunset" as const)
          : ("Evening" as const),
    lamps: T.MathUtils.smoothstep(progress, 0.52, 0.9),
    sun: blend("#fff0d3", "#ffb778", "#b5c8ef"),
    sky: blend("#2466a8", "#856b9b", "#263c69"),
    horizon: blend("#a6ccd1", "#dfb5a0", "#7186a5"),
    fog: blend("#adc6c9", "#bcacb8", "#788aa3"),
    sunIntensity: 3.2 - dusk * 0.6 - night * 1.5,
    skyIntensity: 1.15 - night * 0.17,
  };
}

/** Active play owns this clock. Camera changes never reset its phase. */
export class EnvironmentClock {
  elapsed: number;
  constructor(seconds = 0) {
    this.elapsed = Math.max(
      0,
      Math.min(DAY_LENGTH, Number.isFinite(seconds) ? seconds : 0),
    );
  }
  step(dt: number, active: boolean) {
    if (active)
      this.elapsed = Math.min(DAY_LENGTH, this.elapsed + Math.max(0, dt));
  }
  get values() {
    return environmentAt(this.elapsed);
  }
}

export const windAt = (time: number, seed = 0) =>
  Math.sin(time * 0.7) * 0.65 + Math.sin(time * 1.3 + seed * 0.4) * 0.2;
