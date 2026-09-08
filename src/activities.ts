import { ActivityScene } from "./activity-scene";
import { activityCatalogue, addProgress, type TaskId } from "./activity-catalogue";
import { civicFallaCenter } from "./civic-plaza";
import * as T from "three";
import { photoSubjectVisible } from "./photo-request";
import { distance, memoryNames, type MemoryId } from "./data";
import { t } from "./i18n";
import {
  cafeSite,
  photoSite,
  photoInteractionRange,
  waterSeat,
  hiddenPlaces,
} from "./immersion-sites";
import { point, solid } from "./geometry";
import { getCharacterRig, type CharacterClip } from "./characters";
import type { Game } from "./game";

export type ActivityKind = "horchata" | "waterside" | "procession" | "photograph" | "oranges" | "firecracker" | "bull" | "falla";
interface Activity {
  kind: ActivityKind;
  elapsed: number;
  origin: { x: number; z: number; heading: number };
  leaving: number;
  completed: boolean;
  lane?: number;
  target?: string;
}
export class Activities {
  active: Activity | null = null;
  scene!: ActivityScene;
  private repeatAfter=0;
  initialize(){this.scene=new ActivityScene(this.game);}
  credit(id:TaskId,amount:number){const g=this.game;if(addProgress(g.state.activities,id,amount)){g.save();g.chime();g.onEvent("activity-completed",id);g.onEvent("toast",t("Activity complete: {activity}",{activity:t(activityCatalogue.find(task=>task.id===id)!.name)}));g.onChange();}}
  private cup = new T.Mesh(
    new T.CylinderGeometry(0.065, 0.045, 0.18, 12),
    solid("#eee1bc"),
  );
  constructor(private game: Game) {
    this.cup.name = "Horchata glass";
    this.cup.visible = false;
  }
  localTargets(): import("./interactions").InteractionTarget[] { return (this.scene?.targets()??[]).filter(t=>t.activity!=="firecracker"||this.game.processionClock>=this.repeatAfter); }
  candidate(): ActivityKind | null {
    const g = this.game;
    if (this.active) return this.active.kind;
    if (g.mode !== "walk") return null;
    const candidates: [ActivityKind, number][] = [];
    if (distance(g, cafeSite) < 2.5)
      candidates.push(["horchata", distance(g, cafeSite)]);
    if (distance(g, photoSite) < photoInteractionRange)
      candidates.push(["photograph", distance(g, photoSite)]);
    if (distance(g, waterSeat) < 2.6)
      candidates.push(["waterside", distance(g, waterSeat)]);
    const parade = g.world.procession;
    if (parade && distance(g, parade.bandPosition) < 5)
      candidates.push(["procession", distance(g, parade.bandPosition)]);
    return candidates.sort((a, b) => a[1] - b[1])[0]?.[0] ?? null;
  }
  prompt(kind: ActivityKind) {
    if(this.active && ["oranges","firecracker","bull"].includes(this.active.kind))return t("Cancel activity");
    if (this.active)
      return t(
        this.active.kind === "waterside"
          ? "Stand up"
          : this.active.kind === "procession"
            ? "Leave the procession"
            : this.active.kind === "photograph"
              ? "Cancel the photo request"
              : "Cancel the drink",
      );
    return t(
      (
        {
          horchata: "Order an horchata",
          waterside: "Sit by the water",
          procession: "Join the procession",
          photograph: "Photograph Serranos",
          oranges: "Pick oranges", firecracker: "Throw a firecracker", bull: "Pet the bull", falla: "Selfie with the Falla",
        } as const
      )[kind],
    );
  }
  use(kind: ActivityKind, targetId?:string) {
    if (this.active) {
      this.cancel();
      return;
    }
    const g = this.game;
    if(kind==='oranges' && g.state.activities.picked.length===3){g.state.activities.picked=[];g.state.activities.progress.oranges=0;this.scene.restoreFruit();g.save();g.onChange();return;}
    const fruit=kind==='oranges'?this.scene.preparePick(targetId):undefined;
    if(kind==='oranges'&&!fruit)return;
    if(kind==='firecracker'&&(g.processionClock<this.repeatAfter||!this.scene.prepareThrow()))return;
    if(kind==='falla'){
      g.photo=true;
      g.onEvent("activity-started", kind);
      g.yaw=Math.atan2(g.x-civicFallaCenter.x,g.z-civicFallaCenter.z);
      g.selfiePitch=-.34;g.selfieZoom=2.3;g.selfieLift=.15;g.onEvent('photo');return;
    }
    if(kind==='bull') {
      const city=g.world.cityLife;if(!city?.canPet(g))return;
      const stand=city.petStand(g);if(!stand)return;
      g.x=stand.x;g.z=stand.z;const target=city.petTarget();g.heading=Math.atan2(target.x-g.x,target.z-g.z);
      city.pet(g.processionClock);g.localSound?.oneShot('bull',.3);
    }
    this.active = {
      kind,
      elapsed: 0,
      origin: { x: g.x, z: g.z, heading: g.heading },
      leaving: 0,
      completed: false,
      target: fruit??undefined,
    };
    g.onEvent("activity-started", kind);
    if(kind!=="procession")g.resetInput();
    if (kind === "waterside") {
      g.x = waterSeat.x;
      g.z = waterSeat.z;
      g.heading = waterSeat.yaw;
    }
    if (kind === "horchata")
      g.heading = Math.atan2(cafeSite.x - g.x, cafeSite.z - g.z);
    if (kind === "photograph") {
      g.photo = true;
      g.serranosPhoto = true;
      g.yaw = Math.atan2(g.x, g.z - 22);
      g.selfiePitch = -.25;
      g.selfieZoom = 2.5;
      g.selfieLift = .2;
      g.onEvent("photo");
    }
    if (kind === "procession")
      g.onEvent("toast", t("Walk beside the band. Use again to leave."));
    g.onChange();
  }
  cancel(immediate = false) {
    const a = this.active;
    if (!a) return;
    if(a.kind==="firecracker"&&this.scene.released&&!immediate)return;
    if (a.kind === "waterside" && !immediate && !a.leaving) {
      a.leaving = 0.001;
      return;
    }
    const g = this.game;
    if (a.kind === "waterside") {
      g.x = a.origin.x;
      g.z = a.origin.z;
      g.heading = a.origin.heading;
    }
    this.cup.visible = false;
    if(a.kind==="bull")g.world.cityLife?.cancelPet();
    if(a.kind==="oranges")this.scene.restoreFruit();
    if(a.kind==="firecracker"){this.scene.clearThrow();this.repeatAfter=g.processionClock+1;}
    this.active = null;
    g.resetInput();
    g.save();
    g.onChange();
  }
  remember(id: MemoryId, quiet = false) {
    const g = this.game;
    if (g.state.memories.includes(id)) return;
    g.state.memories.push(id);
    g.save();
    g.onEvent("memory-saved", id);
    if(quiet)return;
    g.chime();
    g.onEvent(
      "toast",
      t("Memory saved: {memory}", { memory: t(memoryNames[id]) }),
    );
  }
  get locked() {
    return (
      !!this.active && ["waterside", "horchata", "oranges", "firecracker", "bull"].includes(this.active.kind)
    );
  }
  get clip(): CharacterClip | null {
    const a = this.active;
    if (!a) return null;
    if (a.kind === "waterside") return a.leaving ? "Idle" : "Sit";
    if (a.kind === "horchata") return a.elapsed < 2 ? "Watch" : "Drink";
    if(a.kind==="procession"&&this.game.moving)return "March";
    if(["oranges","firecracker","bull"].includes(a.kind))return "Watch";
    return null;
  }
  update(dt: number) {
    const g = this.game,
      a = this.active;
    if (g.mode === "walk")
      for (const p of hiddenPlaces)
        if (
          distance(g, p) < p.radius &&
          (p.id !== "roof-terrace" || g.world.heightAt(g.x, g.z) > 2.8)
        )
          this.remember(p.id);
    if (!a) return;
    a.elapsed += dt;
    if (a.leaving) {
      a.leaving += dt;
      if (a.leaving > 0.6) this.cancel(true);
      return;
    }
    if (a.kind === "waterside" && a.elapsed >= 5 && !a.completed) {
      this.remember("waterside");
      a.completed = true;
    }
    if (a.kind === "horchata" && a.elapsed >= 8) {
      this.credit("horchata",8);
      this.remember("horchata",true);
      this.cancel(true);
    }
    if(a.kind==='bull'&&a.elapsed>=3){this.credit('bull',3);this.cancel(true);}
    if(a.kind==='oranges'&&a.elapsed>=2){
      if(a.target&&!g.state.activities.picked.includes(a.target)){g.state.activities.picked.push(a.target);this.credit('oranges',1);g.save();if(g.state.activities.picked.length<3)g.onEvent("toast",`${t("Pick oranges")} · ${g.state.activities.picked.length}/3`);}
      this.cancel(true);
    }
    if(a.kind==='firecracker'&&a.elapsed>=3.5)this.cancel(true);
    if (a.kind === "procession") {
      const parade = g.world.procession!;
      // Keep normal player input and camera. Only reward time spent walking beside it.
      if (distance(g, parade.bandPosition) > 12) {
        this.cancel(true);
        return;
      }
      if (!g.moving) a.elapsed = Math.max(0, a.elapsed - dt);
      if(g.resolvedTravel>1e-5 && distance(g,parade.bandPosition)<5)this.credit("band",dt);
      if (g.state.activities.progress.band >= 10 && !a.completed) {
        this.remember("procession",true);
        g.world.behavior?.signal(g,g.processionClock);
        a.completed = true;
      }
    }
  }
  pose() {
    const a = this.active;
    this.scene.update(this.game.processionClock);
    if(a?.kind==='oranges'&&a.target)this.scene.posePick(a.target,a.elapsed);
    if(a?.kind==='firecracker'&&this.scene.poseThrow(a.elapsed))this.credit('firecracker',1);
    this.cup.visible = a?.kind === "horchata";
    if (!this.cup.visible || !a) return;
    if (this.cup.parent !== this.game.world.group)
      this.game.world.group.add(this.cup);
    const server = this.game.world.behavior!.server;
    const from = getCharacterRig(server)
      .bones.get("Hand_R")!
      .getWorldPosition(new T.Vector3());
    const to = getCharacterRig(this.game.player)
      .bones.get("Hand_R")!
      .getWorldPosition(new T.Vector3());
    this.cup.position
      .copy(from)
      .lerp(to, T.MathUtils.smoothstep(a.elapsed, 1.65, 2.05));
    this.cup.position.addScaledVector(
      this.cup.position.clone().normalize(),
      0.06,
    );
    this.cup.quaternion.copy(this.game.player.quaternion);
  }
  photoTaken() {
    const g = this.game;
    if(g.photo && distance(g,civicFallaCenter)<30){
      const subject=g.world.group.getObjectByName('landmark-falla');
      if(subject){
        // Sample the central figures and crown in the actual monument mesh.
        // A selfie can cover the plinth; at least two separated upper details must be clear.
        const mesh=subject as T.Mesh;mesh.geometry.computeBoundingBox();
        const bounds=mesh.geometry.boundingBox!;
        const frame=[.38,.60,.82].map(height=>subject.localToWorld(new T.Vector3(
          (bounds.min.x+bounds.max.x)/2,T.MathUtils.lerp(bounds.min.y,bounds.max.y,height),(bounds.min.z+bounds.max.z)/2)));
        const visible=frame.filter(p=>photoSubjectVisible(g.camera,g.world.group,subject,[p]));
        const hero=getCharacterRig(g.player).bones.get('Head')?.getWorldPosition(new T.Vector3())??g.player.position;
        const projected=visible.map(p=>p.clone().project(g.camera));
        const coverage=projected.length>1?Math.max(...projected.map(p=>p.y))-Math.min(...projected.map(p=>p.y)):0;
        const accepted=visible.length>=2&&coverage>.12&&photoSubjectVisible(g.camera,g.world.group,g.player,[hero]);
        if(accepted)this.credit('falla',1);else g.onEvent('toast',t('Keep yourself and the Falla in view.'));
        return accepted;
      }
    }
    if (this.active?.kind !== "photograph") return null;
    const subject = g.world.group.getObjectByName("landmark-serranos");
    // Check visible patches on each tower. A person or lamp in front of one
    // sample must not reject an otherwise clear view of both towers.
    const towers = [-1, 1].map(side =>
      [point(side * 4, 22, 7), point(side * 6, 22, 7), point(side * 5, 22, 10)]
        .filter(p => photoSubjectVisible(g.camera, g.world.group, subject, [p])));
    const framed = towers.flat().map(p => p.clone().project(g.camera).x);
    const accepted =
      !g.globe &&
      distance(g, { x: 0, z: 22 }) < 35 &&
      towers.every(points => points.length > 0) &&
      Math.max(...framed) - Math.min(...framed) > .25;
    if (accepted) {
      this.remember("photograph");
      this.cancel(true);
    }
    return accepted;
  }
  get savePosition() {
    const a = this.active;
    return a?.kind === "waterside" ? a.origin : null;
  }
}
