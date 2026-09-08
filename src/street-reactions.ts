import * as T from "three";
import { beachContact, WATER_LEVEL } from "./beach-water";
import { seat } from "./geometry";
import { createGardenAnimal } from "./garden-assets";
import { distance } from "./data";
import { offset, localOffset } from "./navigation";
import { clearSight } from "./people-behavior";
import { groundSound } from "./local-sound";
import type { World } from "./world";

interface Bird {
  mesh: T.Group;
  home: { x: number; z: number };
  target: { x: number; z: number };
  flight: number;
  cooldown: number;
  yaw: number;
  flightYaw: number;
}
export class StreetReactions {
  readonly birds: Bird[] = [];
  readonly ripples: { mesh: T.Mesh; age: number; x: number; z: number }[] = [];
  private rippleDistance = 0;
  constructor(private world: World) {
    for (const base of [
      { x: 1, z: 13 },
      { x: 102, z: 4 },
      { x: 259, z: 25 },
    ])
      for (let i = 0; i < 4; i++) {
        const home = offset(
          base.x,
          base.z,
          Math.sin(i * 2.4) * 1.4,
          Math.cos(i * 2.4) * 1.4,
        );
        if (world.blocked(home.x, home.z, 0.2)) continue;
        const mesh = createGardenAnimal("pigeon");
        world.group.add(mesh);
        this.birds.push({
          mesh,
          home,
          target: home,
          flight: -1,
          cooldown: 0,
          yaw: this.birds.length * 1.8,
          flightYaw: 0,
        });
      }
    const geometry = new T.RingGeometry(0.22, 0.245, 28);
    geometry.rotateX(-Math.PI / 2);
    for (let i = 0; i < 16; i++) {
      const mesh = new T.Mesh(
        geometry,
        new T.MeshBasicMaterial({
          color: "#d9eee2",
          transparent: true,
          opacity: 0,
          depthWrite: false,
          side: T.DoubleSide,
        }),
      );
      mesh.visible = false;
      mesh.renderOrder = 4;
      world.group.add(mesh);
      this.ripples.push({ mesh, age: 2, x: 0, z: 0 });
    }
  }
  update(
    dt: number,
    time: number,
    player: { x: number; z: number; mode: string },
    travel: number,
    globe: boolean,
  ) {
    for (const [i, b] of this.birds.entries()) {
      if (b.flight >= 0) {
        b.flight += dt;
        if (b.flight > 7) {
          b.flight = -1;
          b.target = b.home;
        }
      }
      const near = distance(player, b.home);
      b.mesh.visible = !globe && near < 45;
      if (!b.mesh.visible) continue;
      if (b.flight < 0 && near < 2.8 && time >= b.cooldown) {
        for (const angle of [i * 1.8, i * 1.8 + 1, i * 1.8 + 2]) {
          const target = offset(
            b.home.x,
            b.home.z,
            Math.sin(angle) * 5,
            Math.cos(angle) * 5,
          );
          if (
            !this.world.blocked(target.x, target.z, 0.35) &&
            clearSight(this.world, b.home, target, 0, .35)
          ) {
            b.target = target;
            const direction = localOffset(
              target.x,
              target.z,
              b.home.x,
              b.home.z,
            );
            b.flightYaw = Math.atan2(direction.x, direction.z);
            b.flight = 0;
            b.cooldown = time + 16;
            break;
          }
        }
      }
      let p = b.home,
        h = this.world.heightAt(p.x, p.z);
      if (b.flight >= 0) {
        const outward = Math.min(1, b.flight / 2),
          back = Math.max(0, Math.min(1, (b.flight - 5) / 2));
        const u = outward - back;
        p = {
          x: T.MathUtils.lerp(b.home.x, b.target.x, u),
          z: T.MathUtils.lerp(b.home.z, b.target.z, u),
        };
        h =
          this.world.heightAt(p.x, p.z) +
          Math.sin(
            Math.PI * (b.flight < 2 ? outward : b.flight > 5 ? 1 - back : 1),
          ) *
            0.95;
        if (b.flight > 7) {
          b.flight = -1;
          b.target = b.home;
        }
      }
      if (b.flight >= 0) {
        const desired =
          b.flightYaw + Math.PI * T.MathUtils.smoothstep(b.flight, 2.2, 4.8);
        b.yaw +=
          Math.atan2(Math.sin(desired - b.yaw), Math.cos(desired - b.yaw)) *
          (1 - Math.exp(-dt * 9));
      }
      seat(b.mesh, p.x, p.z, h, b.yaw);
      const airborne = b.flight >= 0 && (b.flight < 2 || b.flight > 5);
      for (const [side, sign] of [["L", -1], ["R", 1]] as const) {
        const wing = b.mesh.getObjectByName(`Pigeon_Wing_${side}`)!;
        wing.rotation.y = sign * (airborne ? .16 : 1.37);
        wing.rotation.z = sign * (airborne ? Math.sin(time * 24) * .9 : .10);
      }
      b.mesh.userData.animation = airborne ? "Fly" : "Idle";

    }
    this.rippleDistance += travel;
    if (
      player.mode === "walk" &&
      travel > 0.0001 &&
      this.rippleDistance > 0.38 &&
      groundSound(this.world, player, time) === "splash"
    ) {
      const r = this.ripples.find((r) => r.age >= 1.2);
      if (r) {
        r.age = 0;
        r.x = player.x;
        r.z = player.z;
        r.mesh.visible = true;
      }
      this.rippleDistance = 0;
    }
    for (const r of this.ripples) {
      r.age += dt;
      r.mesh.visible = r.age < 1.2 && !globe;
      if (r.mesh.visible) {
        const contact = beachContact(
          r.x,
          r.z,
          time,
          this.world.heightAt(r.x, r.z),
        );
        if (contact && contact.depth < 0.025) {
          r.mesh.visible = false;
          continue;
        }
        seat(r.mesh, r.x, r.z, (contact?.height ?? WATER_LEVEL) + 0.018);
        r.mesh.scale.setScalar(1 + r.age * 2.5);
        (r.mesh.material as T.MeshBasicMaterial).opacity =
          (1 - r.age / 1.2) * 0.5;
      }
    }
  }
}
