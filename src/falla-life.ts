import * as T from "three";
import { createCraftedProp } from "./crafted-props";
import { animateCharacter, createPerson, getCharacterRig, setPersonDetail } from "./characters";
import { refresh, solveLimb } from "./character-rig";
import { distance, places } from "./data";
import { point, seat, solid } from "./geometry";
import { localOffset, offset } from "./navigation";
import { civicChildSpots } from "./civic-plaza";
import type { World } from "./world";

interface Child {
  person: T.Group;
  home: { x: number; z: number };
  yaw: number;
  phase: number;
  effects: T.Group;
  cracker: T.Group;
  sparks: T.Mesh[];
  smoke: T.Mesh[];
  release: T.Vector3;
  landing: T.Vector3;
  popCycle?: number;
  target: {x: number; z: number};
  kind: "masclet" | "firecracker-chain";
  chain: T.Group;
}

/** Small festival play: wind up, throw, recoil, then a brief ground pop. */
export class FallaLife {
  readonly children: Child[] = [];
  lastPop: {serial: number; x: number; z: number; kind: "masclet"|"firecracker-chain"} = {serial: 0, x: 0, z: 0, kind: "masclet"};
  constructor(private world: World) {
    const civic = places.find(p => p.id === "townhall")!;
    const clusters = [
      ...civicChildSpots.map((home,i)=>({home,target:offset(civic.x,civic.z,5.4+i*.25,-10.1-i*.4)})),
      ...[{x:0,z:22},{x:42,z:58},{x:196,z:-67}].flatMap(center=>[0,1].map(i=>({home:offset(center.x,center.z,-10-i*1.8,-21),target:offset(center.x,center.z,-7-i*.5,-23)}))),
    ];
    for (const [i, {home,target}] of clusters.entries()) {
      if (world.blocked(home.x, home.z, .4)) continue;
      if (world.blocked(target.x,target.z,.3)) continue;
      const direction = localOffset(target.x, target.z, home.x, home.z);
      const yaw = Math.atan2(direction.x, direction.z);
      // Keep youthful faces in the child group; older identities stay in the adult crowd.
      const person = createPerson([0, 3, 4, 7, 10][i % 5]);
      person.scale.setScalar(.67 + (i % 3) * .025);
      person.name = `Falla child ${i + 1}`;
      person.userData.fallaChild = true;
      seat(person, home.x, home.z, world.heightAt(home.x, home.z), yaw);
      const effects = new T.Group();
      effects.name = `Paper firecracker ${i + 1}`;
      const cracker = createCraftedProp("firecracker");
      effects.add(cracker);
      const kind = i % 3 === 1 ? "firecracker-chain" : "masclet";
      const chain = new T.Group();
      seat(chain, target.x, target.z, world.heightAt(target.x,target.z)+.055, yaw);
      const fuse = new T.Mesh(new T.CylinderGeometry(.012,.012,1.65,5),solid("#d5b174"));
      fuse.rotation.z = Math.PI/2; chain.add(fuse);
      for(let j=0;j<10;j++) {
        const charge = createCraftedProp("firecracker");
        charge.scale.set(.045 / .035, .18 / .12, .045 / .035);
        charge.position.set(-.75+j/9*1.5,.035,0); charge.rotation.x=Math.PI/2;chain.add(charge);
      }
      effects.add(chain);
      const sparks = Array.from({length: 9}, () => {
        const mesh = new T.Mesh(new T.IcosahedronGeometry(.035, 0),
          new T.MeshBasicMaterial({color: "#ffd786", transparent: true, depthWrite: false}));
        effects.add(mesh); return mesh;
      });
      const smoke = Array.from({length: 5}, () => {
        const mesh = new T.Mesh(new T.IcosahedronGeometry(.13, 1),
          new T.MeshBasicMaterial({color: "#e5dbbd", transparent: true, opacity: 0, depthWrite: false}));
        effects.add(mesh); return mesh;
      });
      world.group.add(person, effects); world.people.push(person);
      this.children.push({person, home, target, yaw, kind, chain, phase: i * 3.3, effects, cracker, sparks, smoke,
        release: person.localToWorld(new T.Vector3(.3, 1.05, .45)),
        landing: point(target.x, target.z, world.heightAt(target.x, target.z) + .08)});
      world.colliders.push({...home, w: .25, d: .25});
    }
  }
  update(time: number, player: {x: number; z: number}, globe: boolean) {
    for (const child of this.children) {
      const {person, home, yaw, effects, cracker, sparks, smoke} = child;
      const cycleLength = child.kind === "firecracker-chain" ? 20 : 12;
      const age = (time + child.phase) % cycleLength;
      const detailed = !globe && distance(home, player) < 42;
      setPersonDetail(person, detailed);
      person.visible = globe || distance(home,player) < 65;
      if (!detailed) {
        effects.visible=false; child.popCycle=Math.floor((time+child.phase-2.38)/cycleLength);
        const tick=Math.floor(time*12);
        if(person.visible&&person.userData.poseTick!==tick){
          animateCharacter(person,time+child.phase,"Watch");person.userData.poseTick=tick;
        }
        continue;
      }
      const windup = T.MathUtils.smoothstep(age, .5, 1.2);
      const swing = T.MathUtils.smoothstep(age, 1.2, 1.52);
      const reset = T.MathUtils.smoothstep(age, 1.75, 2.55);
      const recoil = T.MathUtils.smoothstep(age, 1.7, 2.25) * (1 - T.MathUtils.smoothstep(age, 3.8, 4.6));
      seat(person, home.x, home.z, this.world.heightAt(home.x, home.z), yaw);
      animateCharacter(person, time + child.phase, "Watch", this.world.ground);
      const rig = getCharacterRig(person);
      if (detailed) {
        // An arm IK target makes the release visible; the body recoils with it.
        const reach = new T.Vector3(.3, 1.03 + windup * .48 - swing * .36,
          .25 - windup * .58 + swing * .92);
        reach.lerp(new T.Vector3(.3, .94, .22), reset);
        const target = person.localToWorld(reach);
        const pole = new T.Vector3(1, .3, 0).applyQuaternion(person.quaternion);
        solveLimb(rig, "UpperArm_R", "Forearm_R", "Hand_R", target, pole);
        rig.bones.get("Chest")!.rotateX(-.07 * recoil);
        refresh(person, rig);
      }
      const releaseAge = age - 1.52;
      const flying = releaseAge >= 0 && releaseAge < .62;
      const popAge = age - 2.38;
      const popCycle = Math.floor((time + child.phase - 2.38) / cycleLength);
      if (child.popCycle !== undefined && popCycle > child.popCycle)
        this.lastPop = {serial: this.lastPop.serial + 1, ...child.target, kind: child.kind};
      child.popCycle = popCycle;
      const linked = child.kind === "firecracker-chain";
      const duration = linked ? 6 : 1.4;
      effects.visible = detailed && age > .65 && age < 2.38 + duration + 1.75;
      child.chain.visible = linked;
      child.chain.children.forEach((charge,i) => { charge.visible = i===0 || popAge < (i-1)/9*5.8; });
      const burstAge = linked && popAge>=0 && popAge<duration ? popAge % .16 : popAge;
      const burst = child.landing.clone().addScaledVector(new T.Vector3(1,0,0).applyQuaternion(child.chain.quaternion), linked ? -.75+Math.min(1,Math.max(0,popAge)/5.8)*1.5 : 0);
      cracker.visible = age > .65 && age < 2.4;
      if (age < 1.52) {
        cracker.position.copy(rig.bones.get("Hand_R")!.getWorldPosition(new T.Vector3()));
        child.release.copy(cracker.position);
      } else {
        const u = T.MathUtils.clamp(releaseAge / .62, 0, 1);
        cracker.position.copy(child.release).lerp(child.landing, u);
        if (flying) cracker.position.addScaledVector(child.landing.clone().normalize(), Math.sin(u * Math.PI) * .55);
        cracker.rotation.x = releaseAge * 17;
      }
      const normal = child.landing.clone().normalize();
      const east = new T.Vector3(1, 0, 0).applyQuaternion(person.quaternion);
      const forward = new T.Vector3(0, 0, 1).applyQuaternion(person.quaternion);
      for (const [i, spark] of sparks.entries()) {
        spark.visible = popAge >= 0 && popAge < (linked ? duration : .32);
        const angle = i * 2.399963, spread = Math.max(0, burstAge) * (2.1 + i % 3 * .25);
        spark.position.copy(burst).addScaledVector(east, Math.sin(angle) * spread)
          .addScaledVector(forward, Math.cos(angle) * spread)
          .addScaledVector(normal, Math.sin(Math.max(0, burstAge) / .32 * Math.PI) * .27);
        (spark.material as T.MeshBasicMaterial).opacity = Math.max(0, 1 - burstAge / .32);
      }
      for (const [i, puff] of smoke.entries()) {
        puff.visible = popAge >= 0 && popAge < duration + 1.75;
        const t = Math.max(0, linked && popAge < duration ? popAge % 1.75 : popAge - (linked ? duration : 0));
        puff.position.copy(burst).addScaledVector(normal, .08 + t * (.35 + i * .055))
          .addScaledVector(east, Math.sin(i * 2.4) * .1 + t * .17)
          .addScaledVector(forward, Math.cos(i * 2.4) * .1);
        puff.scale.setScalar(.7 + t * 1.8);
        (puff.material as T.MeshBasicMaterial).opacity = Math.max(0, .56 * (1 - t / 1.75));
      }
      person.userData.activity = {kind: "firecracker", age, phase: age < 1.2 ? "prepare" : age < 1.52 ? "throw" : age < 2.38 ? "recoil" : age < 4.2 ? "pop" : "watch"};
    }
  }
}
