import * as T from "three";
import { createCharacter, animateCharacter, setPersonDetail } from "./characters";
import { point, seat } from "./geometry";
import { ProcessionRoute } from "./procession-route";
import type { World } from "./world";

const BAND = ["trumpet", "clarinet", "trombone", "trumpet", "tuba", "clarinet", "snare", "bass", "cymbals", "snare"];
export class Procession {
  readonly group = new T.Group();
  readonly route: ProcessionRoute;
  readonly members: { person: T.Group; row: number; lane: number }[] = [];
  readonly speed = 1.05;
  readonly rowGap = 2.7;
  clock = 0;
  position = { x: 0, z: 0 };
  bandPosition = { x: 0, z: 0 };
  constructor(private world: World) {
    this.group.name = "Fallas street procession";
    this.route = new ProcessionRoute(world);
    for (const [i, name] of ["fallera_blue", "fallero", "fallera_rose", "fallero", ...BAND.map(role => "band_" + role)].entries()) {
      const person = createCharacter(name);
      person.userData.procession = true;
      this.members.push({ person, row: Math.floor(i / 2), lane: i % 2 ? .57 : -.57 });
      this.group.add(person);
    }
    world.group.add(this.group);
  }
  update(clock: number, viewer: T.Vector3, globe: boolean) {
    this.clock = clock;
    const lead = 10 + clock * this.speed;
    this.position = this.route.sample(lead);
    // The musicians follow the four people at the front of the procession.
    this.bandPosition = this.route.sample(lead - 4 * this.rowGap);
    for (const [i, member] of this.members.entries()) {
      const p = this.route.sample(lead - member.row * this.rowGap, member.lane);
      const detailed = !globe && point(p.x, p.z).distanceToSquared(viewer) < 45 * 45;
      setPersonDetail(member.person, detailed);
      const tick = Math.floor(clock * 15);
      if (detailed || member.person.userData.poseTick !== tick) {
        seat(member.person, p.x, p.z, this.world.heightAt(p.x, p.z), p.yaw);
        // The Blender march covers .44 / .60 metres in its 1.2-second cycle.
        animateCharacter(member.person, clock + (i % 2) * .02, "March", this.world.ground,
          this.speed / ((.44 / .60) / 1.2));
        member.person.userData.poseTick = tick;
      }
    }
  }
}
