import * as T from "three";
import {
  animateCharacter,
  animateLocomotion,
  createPerson,
  setPersonDetail,
  type CharacterClip,
} from "./characters";
import { distance, docks, places } from "./data";
import { point, seat } from "./geometry";
import { localOffset, offset } from "./navigation";
import { cafeSite, photoSite } from "./immersion-sites";
import type { World } from "./world";
import { activitySites } from "./field-life";
import { FallaLife } from "./falla-life";

export function clearSight(
  world: Pick<World, "blocked">,
  a: { x: number; z: number },
  b: { x: number; z: number },
  sourceRadius = 0,
  clearance = .08,
) {
  const length = distance(a, b),
    steps = Math.ceil(length / 0.7);
  const av = point(a.x, a.z),
    bv = point(b.x, b.z);
  for (let i = 1; i < steps; i++) {
    if (length * (1 - i / steps) <= sourceRadius) continue;
    const v = av
      .clone()
      .lerp(bv, i / steps)
      .normalize();
    const x = Math.atan2(v.x, v.y) * 100,
      z = Math.asin(v.z) * 100;
    if (world.blocked(x, z, clearance)) return false;
  }
  return true;
}
interface Resident {
  person: T.Group;
  home: { x: number; z: number };
  x: number;
  z: number;
  yaw: number;
  restYaw: number;
  role: "walk" | "talk" | "sit" | "watch";
  phase: number;
  cooldown: number;
  lookUntil: number;
  target: { x: number; z: number } | null;
  pauseUntil: number;
  routeStep: number;
  stalled: number;
  speed: number;
}
export class PeopleBehavior {
  readonly residents: Resident[] = [];
  /** Keep the player outside moving bodies without making residents block themselves. */
  blocksPlayer(x: number, z: number, radius: number, origin?: {x: number; z: number}) {
    return this.residents.some(resident => {
      if (!resident.person.visible) return false;
      const next = distance({x, z}, resident), clearance = radius + .35;
      if (next >= clearance) return false;
      // An old save or a scene edit can put the player inside a body. Let an
      // outward step leave it, while still rejecting steps deeper into it.
      const previous = origin ? distance(origin, resident) : Infinity;
      return !(previous < clearance && next > previous + .000001);
    });
  }
  readonly server = createPerson(1);
  readonly photographer = createPerson(2);
  private lastTime = 0;
  private signalUntil = 0;
  private attentionUntil = 0;
  readonly fallaLife: FallaLife;
  private readonly paradePath: T.Vector3[] = [];
  private readonly servingSite = offset(cafeSite.x, cafeSite.z, 0.95, 0);
  constructor(private world: World) {
    const route = world.procession?.route;
    if (route) for (let d = 0; d < route.length; d += 1.2) {
      const p = route.sample(d); this.paradePath.push(point(p.x, p.z));
    }
    this.fallaLife = new FallaLife(world);
    const existing = [...world.people].filter(p => !p.userData.fallaChild);
    for (const [i, person] of existing.entries()) {
      const home = { x: person.userData.x, z: person.userData.z };
      if (!Number.isFinite(home.x) || !Number.isFinite(home.z)) continue;
      const candidates = [home];
      for (const radius of [2, 4, 7])
        for (let k = 0; k < 8; k++)
          candidates.push(offset(home.x, home.z, Math.sin(k * Math.PI / 4) * radius,
            Math.cos(k * Math.PI / 4) * radius));
      const p = candidates.find(p => this.safe(p) && this.room(p, 1.65));
      if (!p) { person.visible = false; continue; }
      const landmark = [...places].sort((a, b) => distance(a, p) - distance(b, p))[0];
      const look = localOffset(landmark.x, landmark.z, p.x, p.z);
      this.register(person, p, "walk", Math.atan2(look.x, look.z));
    }
    // Paired visitors face each other and leave walking space between groups.
    for (const base of [{ x: 6, z: 3 }, { x: 263, z: 27 }]) this.conversation(base);
    for (const p of world.details!.seats.slice(1, 3)) this.add(p, "sit", p.yaw);
    for (const x of [11, 16, 25]) {
      const p = { x, z: 3.5 };
      if (this.safe(p) && this.room(p)) this.add(p, "watch", Math.PI);
    }
    // Small groups belong to places: cafe visitors, arrivals and sightseers.
    for (const cafe of world.details!.cafes) {
      const p = offset(cafe.x, cafe.z, -3.3, 2.4);
      this.conversation(p);
    }
    for (const place of places) {
      if (place.id === "townhall") continue;
      for (const [i, dx] of [-8, 11].entries()) {
        const candidates = [-13, -18, 13].map(z => offset(place.x, place.z, dx, z));
        const p = candidates.find(p => this.safe(p) && this.room(p, 2));
        if (p) this.add(p, i === 0 ? "walk" : "watch", Math.atan2(-dx, 13));
      }
    }
    for (const site of activitySites)
      if (this.safe(site) && this.room(site)) this.add(site, site.role, site.yaw);
    // Triple the existing population, with room to walk around each new home.
    const additional = (world.people.length + 2) * 2;
    const homes = this.residents.filter(r => r.role !== "sit").map(r => r.home);
    for (let attempt = 0, added = 0; added < additional && attempt < additional * 100; attempt++) {
      const home = homes[attempt % homes.length];
      const angle = attempt * 2.399963;
      const radius = 3 + Math.floor(attempt / homes.length) % 12 * 1.4;
      const p = offset(home.x, home.z, Math.sin(angle) * radius, Math.cos(angle) * radius);
      if (!this.safe(p) || !this.room(p, 2)) continue;
      this.add(p, "walk", angle); added++;
    }
    world.group.add(this.server, this.photographer);
    world.people.push(this.server, this.photographer);
    seat(this.server, this.servingSite.x, this.servingSite.z,
      world.heightAt(this.servingSite.x, this.servingSite.z), cafeSite.yaw);
    seat(this.photographer, photoSite.x, photoSite.z,
      world.heightAt(photoSite.x, photoSite.z), photoSite.yaw);
    world.colliders.push({ ...this.servingSite, w: 0.25, d: 0.25 });
    world.colliders.push({ ...photoSite, w: 0.23, d: 0.23 });
  }
  private safe(p: { x: number; z: number }) {
    const position = point(p.x, p.z);
    return this.paradePath.every(q => q.distanceToSquared(position) > 1.75 ** 2) &&
      !this.world.blocked(p.x, p.z, .48) && Math.abs(p.z + 12) > 5 &&
      this.world.waterFactor(p.x, p.z) > .99 &&
      docks.every(d => distance(p, d) > 2.2);
  }
  private room(p: { x: number; z: number }, clearance = 1.35, self?: Resident) {
    const position = point(p.x, p.z, this.world.heightAt(p.x, p.z));
    return (this.world.events?.dancers.every(d => !d.visible || d.position.distanceTo(position) > clearance) ?? true) &&
      this.residents.every(r => r === self || Math.abs(p.z-r.z) >= clearance || distance(p, r) >= clearance) &&
      distance(p, this.servingSite) > 1.35 && distance(p, photoSite) > 1.35 &&
      this.fallaLife.children.every(c => distance(p, c.home) > 1.45);
  }
  private register(person: T.Group, p: { x: number; z: number }, role: Resident["role"], yaw: number) {
    const i = this.residents.length;
    this.residents.push({person, home: {...p}, ...p, yaw, restYaw: yaw, role: role === "watch" ? "walk" : role, phase: i * .8,
      cooldown: 0, lookUntil: 0, target: null,
      pauseUntil: i % 4, routeStep: i, stalled: 0, speed: 0});
    seat(person, p.x, p.z, this.world.heightAt(p.x, p.z), yaw);
  }
  private add(p: { x: number; z: number }, role: Resident["role"], yaw: number) {
    const person = createPerson(this.residents.length);
    this.world.people.push(person); this.world.group.add(person);
    this.register(person, p, role, yaw);
  }
  private conversation(base: { x: number; z: number }) {
    const pair = [-1, 1].map(side => offset(base.x, base.z, side * .76, 0));
    if (pair.every(p => this.safe(p) && this.room(p, 1.7)))
      pair.forEach((p, i) => this.add(p, "talk", i ? -Math.PI / 2 : Math.PI / 2));
  }
  private destination(r: Resident) {
    for (let k = 0; k < 10; k++) {
      const angle = (++r.routeStep * 2.399963), length = 3.2 + (r.routeStep % 4) * .7;
      const p = offset(r.home.x, r.home.z, Math.sin(angle) * length, Math.cos(angle) * length);
      if (distance(r, p) > 2 && this.safe(p) && this.room(p, 1.7, r) &&
        clearSight(this.world, r, p, 0, .5)) return p;
    }
    return null;
  }
  signal(player: { x: number; z: number }, time: number) {
    if (time < this.signalUntil) return false;
    const r = this.residents
      .filter(
        (r) =>
          r.role !== "sit" &&
          r.cooldown <= time &&
          distance(r, player) < 12 &&
          clearSight(this.world, player, r),
      )
      .sort((a, b) => distance(a, player) - distance(b, player))[0];
    if (!r) return false;
    r.cooldown = time + 12;
    r.lookUntil = time + 3;
    this.signalUntil = time + 2.4;
    return true;
  }
  update(
    time: number,
    player: { x: number; z: number },
    globe: boolean,
    serving = false,
    awningTime?: number,
  ) {
    const dt = Math.max(0, Math.min(0.1, time - this.lastTime));
    this.lastTime = time;
    if (dt > 0 && time >= this.attentionUntil) {
      const nearby = this.residents
        .filter(
          (r) =>
            r.role !== "sit" &&
            r.cooldown <= time &&
            distance(r, player) < 3.5 &&
            clearSight(this.world, player, r),
        )
        .sort((a, b) => distance(a, player) - distance(b, player))[0];
      if (nearby) {
        nearby.lookUntil = time + 2.5;
        this.attentionUntil = time + 5;
      }
    }
    for (const [i, r] of this.residents.entries()) {
      const near = distance(r, player),
        detailed = !globe && near < 18;
      setPersonDetail(r.person, detailed);
      r.person.visible = globe || near < 70;
      if (!globe && near >= 70) { r.speed=0; continue; }
      const tick = Math.floor(time * 15 + i * 0.3);
      const poseDue = detailed || r.person.userData.poseTick !== tick;
      r.person.userData.poseTick = tick;
      let clip: CharacterClip =
        r.role === "sit" ? "Sit" : "Talk";
      const oldX = r.x, oldZ = r.z, oldYaw = r.yaw;
      if (r.role === "walk" && dt > 0 && r.lookUntil < time && time >= r.pauseUntil) {
        r.target ??= this.destination(r);
        if (r.target) {
          const local = localOffset(r.target.x, r.target.z, r.x, r.z);
          const remaining = Math.hypot(local.x, local.z);
          const heading = Math.atan2(local.x, local.z);
          const turn = Math.atan2(Math.sin(heading - r.yaw), Math.cos(heading - r.yaw));
          r.yaw += T.MathUtils.clamp(turn, -dt * 2.3, dt * 2.3);
          const speed = (.85 + (i % 4) * .09) * T.MathUtils.smoothstep(remaining, .08, .65);
          const step = Math.min(remaining, speed * dt) * Math.max(0, Math.cos(turn));
          const next = offset(r.x, r.z, Math.sin(r.yaw) * step, Math.cos(r.yaw) * step);
          // A walker waits for a clear gap. Never push bodies or snap to a path.
          if (this.safe(next) && this.room(next, 1.2, r) && distance(next, player) > 1.35 &&
            Math.abs(this.world.heightAt(next.x, next.z) - this.world.heightAt(r.x, r.z)) < .2) {
            r.x = next.x; r.z = next.z; r.stalled = 0;
          } else r.stalled += dt;
          if (remaining < .16 || r.stalled > 1.8) {
            r.target = null; r.stalled = 0; r.pauseUntil = time + 1.8 + (i % 4) * .6;
          }
        } else r.pauseUntil = time + 2.5;
      }
      r.speed = dt > 0 ? distance({x: oldX, z: oldZ}, r) / dt : 0;
      if (r.role !== "sit" && r.lookUntil > time) {
        const local = localOffset(player.x, player.z, r.x, r.z);
        const target = Math.atan2(local.x, local.z);
        r.yaw +=
          Math.atan2(Math.sin(target - r.yaw), Math.cos(target - r.yaw)) *
          (1 - Math.exp(-dt * 6));
        clip = "Watch";
      }
      if (r.role !== "walk" && r.lookUntil <= time) {
        const turn = Math.atan2(Math.sin(r.restYaw - r.yaw), Math.cos(r.restYaw - r.yaw));
        r.yaw += turn * (1 - Math.exp(-dt * 3));
      }
      seat(r.person, r.x, r.z, this.world.heightAt(r.x, r.z), r.yaw);
      if (poseDue && r.role === "walk" && r.lookUntil <= time &&
        (r.speed > .025 || Math.abs(r.yaw-oldYaw) > .003))
        animateLocomotion(r.person, time, r.speed, dt ? (r.yaw - oldYaw) / dt : 0, this.world.ground);
      else if (poseDue) animateCharacter(r.person, time + r.phase, clip, this.world.ground);
      r.person.userData.behavior = {
        role: r.role, x: r.x, z: r.z, speed: r.speed, target: r.target,
        cooldown: r.cooldown,
      };
    }
    this.fallaLife.update(time, player, globe);
    for (const [person, p, clip] of [
      [
        this.server,
        cafeSite,
        serving ? "Serve" : awningTime !== undefined ? "OpenAwning" : "Talk",
      ],
      [this.photographer, photoSite, Math.sin(time * .25) > 0 ? "Watch" : "Talk"],
    ] as const) {
      const detailed = !globe && distance(p, player) < 35;
      setPersonDetail(person, detailed);
      const tick = Math.floor(time * 15);
      if (detailed || person.userData.poseTick !== tick) {
        animateCharacter(
          person,
          person === this.server && !serving && awningTime !== undefined
            ? awningTime
            : time,
          clip,
          this.world.ground,
        );
        person.userData.poseTick = tick;
      }
    }
  }
}
