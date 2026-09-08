import posthog from "posthog-js/dist/module.no-external";
import type { Game, Mode } from "./game";
import { getLanguage } from "./i18n";

const IDLE_MS = 60_000;
const REPORT_MS = 60_000;
type Properties = Record<string, string | number | boolean>;
type Capture = (event: string, properties: Properties, immediate?: boolean) => void;

/** Observes play without changing controls, saves, or the simulation clock. */
export class GameAnalytics {
  private sessionId = "";
  private lastTick = performance.now();
  private lastInput = this.lastTick;
  private lastReport = this.lastTick;
  private activeMs = 0;
  private totalMs = 0;
  private wasActive = false;
  private previousMode: Mode;

  constructor(private game: Game, private capture: Capture) {
    this.previousMode = game.mode;
    const onEvent = game.onEvent;
    game.onEvent = (kind, text) => {
      onEvent(kind, text);
      this.event(kind, text);
    };
    const input = () => { this.lastInput = performance.now(); };
    for (const name of ["keydown", "keyup", "pointerdown", "pointerup", "pointermove", "wheel"])
      window.addEventListener(name, input, { passive: true });
    document.addEventListener("visibilitychange", () => {
      this.step();
      if (document.hidden) this.flush("hidden", true);
      else this.lastInput = performance.now();
    });
    window.addEventListener("pagehide", () => {
      this.step();
      this.flush("pagehide", true);
      this.wasActive = false;
    });
    window.addEventListener("pageshow", () => {
      this.lastTick = this.lastInput = performance.now();
    });
  }

  private send(event: string, properties: Properties = {}, immediate = false) {
    if (!this.sessionId) return;
    // Analytics must never stop play if storage or the network is unavailable.
    try {
      this.capture(event, {
        game_session_id: this.sessionId,
        language: getLanguage(),
        ...properties,
      }, immediate);
    } catch { /* Collection is optional. */ }
  }

  private event(kind: string, text?: string) {
    if (kind === "start" && !this.sessionId) {
      this.sessionId = crypto.randomUUID();
      this.lastTick = this.lastInput = this.lastReport = performance.now();
      this.send("game_started", {
        saved_places: this.game.visited.size,
        saved_activities: this.game.state.activities.completed.length,
        input_type: matchMedia("(pointer: coarse)").matches ? "touch" : "keyboard_mouse",
      });
    } else if (kind === "discovery" && text) {
      this.send("place_discovered", { place_id: text });
    } else if (kind === "activity-started" && text) {
      this.send("activity_started", { activity_id: text === "procession" ? "band" : text });
    } else if (kind === "activity-completed" && text) {
      this.send("activity_completed", { activity_id: text });
    } else if (kind === "memory-saved" && text) {
      this.send("memory_discovered", { memory_id: text });
    } else if (kind === "photo-ready") {
      this.send("photo_taken");
    } else if (kind === "complete") {
      this.send("all_places_discovered");
    }
  }

  step() {
    const now = performance.now();
    const elapsed = now - this.lastTick;
    // Ignore a suspended browser or computer. Use wall time, not capped game dt.
    if (this.wasActive && elapsed >= 0 && elapsed <= 5_000) {
      const credited = Math.max(0, Math.min(now, this.lastInput + IDLE_MS) - this.lastTick);
      this.activeMs += credited;
      this.totalMs += credited;
    }
    this.lastTick = now;
    const g = this.game;
    const canPlay = g.started && !g.paused && !document.hidden;
    if (canPlay && (g.keys.size > 0 || Math.abs(g.touchInput.forward) > .05 || Math.abs(g.touchInput.right) > .05))
      this.lastInput = now;
    const active = canPlay && now - this.lastInput < IDLE_MS;
    if (g.mode !== this.previousMode && this.sessionId) {
      this.flush("transport_changed");
      this.send("transport_changed", { from_mode: this.previousMode, to_mode: g.mode });
      if (g.mode === "bike" || g.mode === "boat")
        this.send("activity_started", { activity_id: g.mode === "boat" ? "rowing" : "bike" });
      this.previousMode = g.mode;
    }
    if (this.wasActive && !active)
      this.flush(document.hidden ? "hidden" : g.paused ? "paused" : "idle", document.hidden);
    this.wasActive = active;
    if (now - this.lastReport >= REPORT_MS) this.flush("interval");
  }

  private flush(reason: string, immediate = false) {
    this.lastReport = performance.now();
    if (this.activeMs < 1) return;
    this.send("game_play_time", {
      active_seconds: Math.round(this.activeMs) / 1000,
      session_active_seconds: Math.round(this.totalMs) / 1000,
      transport_mode: this.previousMode,
      reason,
    }, immediate);
    this.activeMs = 0;
  }
}

export function initializeGameAnalytics(game: Game): GameAnalytics | undefined {
  const token = import.meta.env.VITE_POSTHOG_TOKEN;
  const production = import.meta.env.PROD && ["la-terreta.xyz", "www.la-terreta.xyz", "la-terreta-nu.vercel.app"].includes(location.hostname);
  const test = import.meta.env.DEV && import.meta.env.VITE_POSTHOG_TEST_MODE === "true";
  if (!token || (!production && !test)) return;
  try {
    posthog.init(token, {
      api_host: import.meta.env.VITE_POSTHOG_HOST || "https://eu.i.posthog.com",
      defaults: "2026-05-30",
      persistence: "localStorage",
      person_profiles: "never",
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      capture_dead_clicks: false,
      capture_heatmaps: false,
      capture_performance: false,
      capture_exceptions: false,
      disable_session_recording: true,
      disable_surveys: true,
      advanced_disable_flags: true,
      ip: false,
      respect_dnt: true,
      // Do not send URL queries, referrers, or saved appearance data.
      property_denylist: ["$current_url", "$referrer", "$initial_current_url", "$initial_referrer"],
    });
    posthog.register({ app: "la-terreta", environment: production ? "production" : "test" });
    posthog.capture("$pageview", { $current_url: location.origin + location.pathname });
    return new GameAnalytics(game, (event, properties, immediate) => {
      posthog.capture(event, properties, immediate ? { transport: "sendBeacon", send_instantly: true } : undefined);
    });
  } catch {
    return undefined;
  }
}
