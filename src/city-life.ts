import * as T from "three";
import { Builder, label, updateLabel, point, seat, solid } from "./geometry";
import { places, docks, stops } from "./data";
import { offset } from "./navigation";
import { boatDocks } from "./wetland-layout";
import { cafeSite, photoSite, waterSeat } from "./immersion-sites";
import { cityAsset } from "./city-assets";
import { refresh, solveLimb } from "./character-rig";
import { getCharacterRig } from "./characters";
import { t, type MessageKey } from "./i18n";
import type { World } from "./world";

/** Close-range signs and small street scenes use the existing world clock. */
export class CityLife {
  readonly bull = cityAsset("bull");
  private legs: T.Object3D[] = [];
  private tail!: T.Object3D;
  private head!: T.Object3D;
  private petUntil = 0;
  private petStarted = 0;
  private cues: { object: T.Group; x: number; z: number; key: MessageKey; sign: ReturnType<typeof label> }[] = [];
  private bullClock = 0;
  private lastTime = 0;
  private bullPose = {x:196,z:-67,yaw:0};
  private arena = places.find(p => p.id === "bullring")!;
  constructor(private world: World) {
    // A curved sand floor covers the street paving and is also the walk surface.
    const vertices:number[]=[];
    const center=point(this.arena.x,this.arena.z,.22);
    for(let i=0;i<96;i++){
      vertices.push(...center.toArray());
      for(const a of [i*Math.PI*2/96,(i+1)*Math.PI*2/96]){
        const p=offset(this.arena.x,this.arena.z,Math.sin(a)*6.12,Math.cos(a)*6.12);
        vertices.push(...point(p.x,p.z,.22).toArray());
      }
    }
    const floorGeometry=new T.BufferGeometry();floorGeometry.setAttribute("position",new T.Float32BufferAttribute(vertices,3));floorGeometry.computeVertexNormals();
    const sand=new T.Mesh(floorGeometry,solid("#d7b77e"));sand.name="Arena sand floor";sand.receiveShadow=true;world.group.add(sand);world.ground.add(floorGeometry);
    this.bull.name = "Valencian bull";
    this.bull.traverse(object=>{
      if(object.name.startsWith("Bull_Leg"))this.legs.push(object);
      if(object.name==="Bull_Head")this.head=object;
      if(object.name==="Bull_Tail")this.tail=object;
    });
    world.group.add(this.bull);
    this.cue(offset(this.arena.x,this.arena.z,0,-10.8),"Walk into the arena");

    for (const dock of boatDocks) {

      const sign=label(dock.name,"#345d59",3.4);sign.material.side=T.FrontSide;seat(sign,dock.x,dock.landZ,1.8,Math.PI);world.group.add(sign);
    }


    // Market carts sit beside the broad civic routes, never in a door or rail lane.
    const streets = [{x:0,z:22},{x:42,z:58},{x:98,z:18},{x:156,z:7},{x:246,z:45},{x:-198,z:70}];
    for (const [i, center] of streets.entries()) for (const side of [-1,1]) {
      const p = offset(center.x,center.z,side*13,-24);
      if (world.blocked(p.x,p.z,2.5)) continue;
      const stall = new Builder(p.x,p.z);
      stall.box(0,.68,0,2.6,1.35,1.4,"#a8754b");
      stall.box(0,1.43,0,2.85,.12,1.6,"#e0c9a0");
      for (const x of [-1.25,1.25])stall.cylinder(x,1.65,.5,.045,2.1,"#62543e");
      for (let j=0;j<8;j++)stall.box(-1.4+j*.4,2.72,0,.4,.12,2,"#"+(j%2 ? "ead6ad" : i%2 ? "6b8b74" : "bf795b"));
      for(let j=0;j<15;j++)stall.ball((j%5-.2)*.43-.87,1.61,Math.floor(j/5)*.32-.3,.15,.14,.15,i%2?"#d3b654":"#db8a37");
      stall.finish(world.group);world.colliders.push({...p,w:1.5,d:1});
      const sign=label(i%2?"FLORS · MERCAT":"TARONGES · L’HORTA","#345d59",2.6);sign.material.side=T.FrontSide;seat(sign,p.x,p.z,2.27,Math.PI);world.group.add(sign);
    }
  }
  private cue(p:{x:number;z:number}, key:MessageKey) {
    const object=new T.Group(),sign=label(t(key),"#345d59",2.8);
    sign.position.y=key === "E · Borrow a bike" ? 3.35 : 2.4;object.add(sign);
    const ring=new T.Mesh(new T.TorusGeometry(.5,.035,5,24),new T.MeshBasicMaterial({color:"#f0cd76"}));ring.rotation.x=Math.PI/2;ring.position.y=.12;object.add(ring);
    seat(object,p.x,p.z,this.world.heightAt(p.x,p.z));this.world.group.add(object);
    this.cues.push({object,...p,key,sign});
  }
  refreshLabels(){for(const cue of this.cues)updateLabel(cue.sign,t(cue.key),"#345d59");}
  blocksPlayer(x:number,z:number,radius:number,origin:{x:number;z:number}) {
    if(!this.bull.visible)return false;
    const centers=[-.4,.55].map(d=>offset(this.bullPose.x,this.bullPose.z,Math.sin(this.bullPose.yaw)*d,Math.cos(this.bullPose.yaw)*d));
    return centers.some(center=>{
      const next=point(x,z).distanceTo(point(center.x,center.z)),previous=point(origin.x,origin.z).distanceTo(point(center.x,center.z));
      return next<radius+.58 && !(previous<radius+.58&&next>previous+.000001);
    });
  }
  canPet(player:{x:number;z:number}) {
    return this.bull.visible && point(player.x,player.z).distanceTo(point(this.bullPose.x,this.bullPose.z)) < 2.7;
  }
  pet(time:number) { this.petStarted=time;this.petUntil=time+3.2; }
  cancelPet(){this.petUntil=0;}
  petting(time:number) { return time<this.petUntil; }
  petPose(person:T.Group,time:number) {
    if(!this.petting(time))return;
    const rig=getCharacterRig(person);
    refresh(person,rig);
    const local=this.head.worldToLocal(person.position.clone());
    const target=this.head.localToWorld(new T.Vector3(Math.sign(local.x)*.24,.22+Math.sin((time-this.petStarted)*7)*.035,.25));
    const hand=person.worldToLocal(target.clone()).x>0 ? "R" : "L";
    const pole=new T.Vector3(hand==="L" ? -.8 : .8,-.5,.2).applyQuaternion(person.quaternion);
    solveLimb(rig,`UpperArm_${hand}`,`Forearm_${hand}`,`Hand_${hand}`,target,pole);
    this.bull.userData.petHand=hand;
    refresh(person,rig);
  }
  petTarget() { return {...this.bullPose}; }
  petStand(player:{x:number;z:number}) {
    const {x,z,yaw}=this.bullPose;
    const candidates=[-1,1].map(side=>offset(x,z,
      Math.sin(yaw)*.92+Math.cos(yaw)*side*.98,
      Math.cos(yaw)*.92-Math.sin(yaw)*side*.98));
    return candidates.filter(p=>!this.world.blocked(p.x,p.z,.4)&&!this.blocksPlayer(p.x,p.z,.4,p))
      .sort((a,b)=>point(a.x,a.z).distanceTo(point(player.x,player.z))-point(b.x,b.z).distanceTo(point(player.x,player.z)))[0];
  }
  update(time:number,viewer:T.Vector3,globe:boolean,camera:T.Vector3) {
    const dt=Math.max(0,Math.min(.1,time-this.lastTime));this.lastTime=time;
    const nextAngle=(this.bullClock+dt)*.47;
    const next=offset(this.arena.x,this.arena.z,Math.sin(nextAngle)*3.8,Math.cos(nextAngle)*3.8);
    // The bull waits for a visitor on its route, then continues when there is room.
    const running=!this.petting(time) && viewer.distanceTo(point(next.x,next.z))>3.1;
    if(running)this.bullClock+=dt;
    const a=this.bullClock*.47,loc=offset(this.arena.x,this.arena.z,Math.sin(a)*3.8,Math.cos(a)*3.8);
    this.bullPose={...loc,yaw:a+Math.PI/2};
    this.bull.visible=!globe&&viewer.distanceTo(point(this.arena.x,this.arena.z))<65;
    if(this.bull.visible){seat(this.bull,loc.x,loc.z,this.world.heightAt(loc.x,loc.z)-.005+(running?Math.abs(Math.sin(this.bullClock*6))*.04:0),this.bullPose.yaw);
      this.legs.forEach((leg,i)=>leg.rotation.x=running?Math.sin(this.bullClock*9+(i===0||i===3?0:Math.PI))*.48:0);this.tail.rotation.z=Math.sin(time*(this.petting(time)?5:2))*.25;
      this.head.rotation.x=this.petting(time) ? -.18+Math.sin((time-this.petStarted)*4)*.045 : Math.sin(time*1.3)*.035;
      this.bull.userData.activity=this.petting(time)?"petted":running?"walking":"waiting";}
    for(const cue of this.cues){
      const distance=viewer.distanceTo(point(cue.x,cue.z));
      cue.object.visible=!globe&&distance<24&&distance>1.8&&camera.distanceTo(cue.sign.getWorldPosition(new T.Vector3()))>4;
      if(cue.object.visible){cue.sign.up.copy(point(cue.x,cue.z).normalize());cue.sign.lookAt(camera);}
    }
  }
}
