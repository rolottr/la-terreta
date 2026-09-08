import * as T from "three";
import { animateCharacter, createPerson, setPersonDetail } from "./characters";
import { distance } from "./data";
import { seat } from "./geometry";
import { createGardenAnimal, animateCat } from "./garden-assets";
import { offset } from "./navigation";
import { cafeSite } from "./immersion-sites";
import { clearSight } from "./people-behavior";
import type { World } from "./world";

export type StreetEvent = "cat" | "awning" | "dance";
export class EventSchedule {
  next = 18;
  active: { kind: StreetEvent; elapsed: number } | null = null;
  readonly cooldown: Record<StreetEvent, number> = {
    cat: 0,
    awning: 0,
    dance: 0,
  };
  private sequence = 0;
  step(dt: number, time: number, eligible: StreetEvent[], allowed: boolean) {
    if (!allowed) return;
    if (this.active) {
      this.active.elapsed += dt;
      return;
    }
    if (time < this.next) return;
    const kind = eligible.find((k) => time >= this.cooldown[k]);
    if (kind) {
      this.active = { kind, elapsed: 0 };
      this.cooldown[kind] = time + 150;
    }
  }
  finish(time: number) {
    this.active = null;
    this.next = time + 45 + ((++this.sequence * 17) % 46);
  }
}
export class StreetEvents {
  readonly schedule = new EventSchedule();
  readonly cat = createGardenAnimal("cat");
  readonly dancers = [createPerson(0), createPerson(3)];
  private catPath: {
    a: { x: number; z: number };
    b: { x: number; z: number };
  } | null = null;
  private danceSpot: { x: number; z: number; yaw: number } | null = null;
  private previous: StreetEvent | null = null;
  private awningOpened = false;
  readonly history: { kind: StreetEvent; start: number; end?: number }[] = [];
  constructor(private world: World) {
    world.group.add(this.cat, ...this.dancers);
    this.cat.visible = false;
    this.dancers.forEach((p) => (p.visible = false));
    world.details!.awningOpen = 0.08;
  }
  private clearCat(player: { x: number; z: number }) {
    for (const z of [16, 11, 3]) {
      const a = { x: -18, z },
        b = { x: 18, z };
      if (distance(player, { x: 0, z }) > 25 || distance(player, a) < 2)
        continue;
      let clear = true;
      for (let x = -18; x <= 18; x += 0.4)
        if (this.world.blocked(x, z, 0.3)) {
          clear = false;
          break;
        }
      if (clear) return { a, b };
    }
    return null;
  }
  private clearDance(player: { x: number; z: number }) {
    const parade = this.world.procession;
    if (!parade) return null;
    for (const lane of [3.2, -3.2, 4.2, -4.2]) {
      const p = parade.route.sample(
        10 + parade.clock * parade.speed - 11,
        lane,
      );
      if (
        distance(player, p) < 25 &&
        distance(player, p) > 2.5 &&
        !this.world.blocked(p.x, p.z, 1.5) &&
        clearSight(this.world, player, p) &&
        this.world.behavior!.residents.every(r => distance(r, p) > 2.2)
      )
        return p;
    }
    return null;
  }
  update(
    dt: number,
    time: number,
    player: { x: number; z: number },
    allowed: boolean,
    globe: boolean,
  ) {
    const schedule = this.schedule;
    if (!schedule.active && allowed && time >= schedule.next) {
      this.catPath = this.clearCat(player);
      this.danceSpot = this.clearDance(player);
    }
    const eligible: StreetEvent[] = [];
    // Rotate eligible types after the first encounter, so repeats show different events.
    if (this.catPath) eligible.push("cat");
    if (distance(player, cafeSite) < 24) eligible.push("awning");
    if (this.danceSpot) eligible.push("dance");
    const last = this.history.at(-1)?.kind;
    if (last) eligible.sort((a, b) => Number(a === last) - Number(b === last));
    schedule.step(dt, time, eligible, allowed);
    const active = schedule.active;
    if (!active) {
      this.cat.visible = false;
      this.dancers.forEach((p) => (p.visible = false));
      this.previous = null;
      return;
    }
    if (this.previous !== active.kind) {
      this.previous = active.kind;
      this.history.push({ kind: active.kind, start: time });
      if (this.history.length > 24) this.history.shift();
    }
    const age = active.elapsed;
    let finished = false;
    if (active.kind === "cat" && this.catPath) {
      const { a, b } = this.catPath,
        u = T.MathUtils.smoothstep(age, 0, 18),
        p = { x: T.MathUtils.lerp(a.x, b.x, u), z: a.z };
      this.cat.visible = !globe && distance(player, p) < 40;
      seat(this.cat, p.x, p.z, this.world.heightAt(p.x, p.z), Math.PI / 2);
      const travelled = distance(a, b) * u;
      const speed = age < 18 ? distance(a, b) * 6 * (age / 18) * (1 - age / 18) / 18 : 0;
      animateCat(this.cat, time, travelled, speed);
      finished = age > 19 || distance(player, p) > 45;
    } else if (active.kind === "awning") {
      const previousOpen = this.awningOpened;
      const opening =
        previousOpen && age < 2
          ? 1 - T.MathUtils.smoothstep(age, 0, 2)
          : T.MathUtils.smoothstep(
              age,
              previousOpen ? 2 : 0,
              previousOpen ? 8 : 6,
            );
      this.world.details!.awningOpen = Math.max(0.08, opening);
      finished = age > 14 || distance(player, cafeSite) > 45;
    } else if (active.kind === "dance" && this.danceSpot) {
      const p = this.danceSpot;
      for (const [i, person] of this.dancers.entries()) {
        const angle = age * 0.24 + i * Math.PI,
          loc = offset(
            p.x,
            p.z,
            Math.sin(angle) * 0.76,
            Math.cos(angle) * 0.76,
          );
        person.visible = !globe && distance(player, p) < 40;
        setPersonDetail(person, !globe);
        seat(
          person,
          loc.x,
          loc.z,
          this.world.heightAt(loc.x, loc.z),
          angle + Math.PI,
        );
        animateCharacter(person, time, "Dance", this.world.ground);
      }
      finished = age > 18 || distance(player, p) > 45;
    } else finished = true;
    if (finished) {
      this.history.at(-1)!.end = time;
      this.cat.visible = false;
      this.dancers.forEach((p) => (p.visible = false));
      if (active.kind === "awning") {
        this.world.details!.awningOpen = 1;
        this.awningOpened = true;
      }
      schedule.finish(time);
    }
  }
  /** DEV callers can shorten the wait; eligibility and normal lifecycle still apply. */
  request(kind: StreetEvent, time: number) {
    this.schedule.next = time;
    for (const k of ["cat", "awning", "dance"] as const)
      this.schedule.cooldown[k] = k === kind ? 0 : time + 30;
  }
}
