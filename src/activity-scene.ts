import * as T from 'three';
import { GLTFLoader } from './gltf-loader';
import { getCharacterRig, createPerson, animateCharacter, setPersonDetail } from './characters';
import { refresh, solveLimb } from './character-rig';
import { point, seat } from './geometry';
import { distance } from './data';
import { offset, localOffset } from './navigation';
import { civicFallaCenter } from './civic-plaza';
import { t } from './i18n';
import { pathMesh } from './terrain';
import type { Game } from './game';
import type { InteractionTarget } from './interactions';

const assets=new Map<string,T.Group>();
let throwClips:T.AnimationClip[]=[];
export async function loadActivityAssets() {
  await Promise.all(['picking-tree','basket','festival-box','firecracker','throw-guide'].map(async name=>{
    const gltf=await new GLTFLoader().loadAsync(`/models/activities/${name}.glb`);
    gltf.scene.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;}});
    assets.set(name,gltf.scene);if(name==='throw-guide')throwClips=gltf.animations;
  }));
}
const asset=(name:string)=>assets.get(name)!.clone(true);
export const groveEntrance={x:-48,z:47};
// This approach goes through the gate and around the courtyard fence and trees.
export const grovePath=[{x:0,z:5},{x:0,z:12},{x:0,z:30},{x:-23,z:29},{x:-30.5,z:30},{x:-42,z:42},{x:-42.5,z:42.5},groveEntrance];
export const orchardTrees=[{x:-51,z:58},{x:-51,z:63},{x:-45,z:65}];
export const festivalSites=[{x:-8,z:7},{...offset(civicFallaCenter.x,civicFallaCenter.z,11,-1)}];
export const fallaPhotoSite=offset(civicFallaCenter.x,civicFallaCenter.z,14,1);

export class ActivityScene {
  readonly group=new T.Group();
  readonly fruits:{id:string;object:T.Object3D;home:T.Vector3;x:number;z:number;tree:T.Group}[]=[];
  private basket=asset('basket');
  private cracker=asset('firecracker');
  private guide=asset('throw-guide');
  private mixer=new T.AnimationMixer(this.guide);
  private throwHand:T.Object3D;
  private gardener=createPerson(8);
  private release=new T.Vector3();
  private landing=new T.Vector3();
  private particles:T.Mesh[]=[];
  private treeFades: {tree:T.Group; materials:T.Material[]; opacity:number}[]=[];
  private throwReleased=false;
  private pop=false;
  constructor(private game:Game) {
    const world=game.world;this.group.name='Local activity props';world.group.add(this.group);
    for(let i=3;i<grovePath.length-1;i++)this.group.add(pathMesh(grovePath[i],grovePath[i+1],1.6,'#c5bd8b',.155));
    for(const [i,p] of orchardTrees.entries()) {
      const tree=asset('picking-tree');tree.name=`Low orange tree ${i}`;seat(tree,p.x,p.z,world.heightAt(p.x,p.z));this.group.add(tree);
      const materials:T.Material[]=[];
      tree.getObjectByName('Low_trunk_and_leaves')!.traverse(o=>{if(o instanceof T.Mesh){o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();materials.push(...(Array.isArray(o.material)?o.material:[o.material]));}});
      this.treeFades.push({tree,materials,opacity:1});
      tree.updateMatrixWorld(true);const fruit=tree.getObjectByName('Removable_orange')!;
      const home=fruit.getWorldPosition(new T.Vector3());
      const location={x:Math.atan2(home.x,home.y)*100,z:Math.asin(home.z/home.length())*100};
      this.fruits.push({id:`grove-${i}`,object:fruit,home,...location,tree});world.colliders.push({...p,w:.16,d:.16});
    }
    seat(this.basket,-48,60,world.heightAt(-48,60));this.group.add(this.basket);
    for(const p of festivalSites){const box=asset('festival-box');seat(box,p.x,p.z,world.heightAt(p.x,p.z));this.group.add(box);world.colliders.push({...p,w:.36,d:.29});}
    seat(this.gardener,-49,65,world.heightAt(-49,65),Math.PI);this.group.add(this.gardener);
    this.cracker.visible=false;this.group.add(this.cracker);this.throwHand=this.guide.getObjectByName('Throw_hand')!;
    for(const clip of throwClips)this.mixer.clipAction(clip).setLoop(T.LoopOnce,1).play();
    this.restoreFruit();
    const geometry=new T.IcosahedronGeometry(.12,1);
    for(let i=0;i<8;i++){const p=new T.Mesh(geometry,new T.MeshBasicMaterial({color:i<3?'#ffd786':'#e5dbbd',transparent:true,depthWrite:false,opacity:0}));p.visible=false;this.particles.push(p);this.group.add(p);}
  }
  restoreFruit() {
    for(const [i,f] of this.fruits.entries()) {
      if(this.game.state.activities.picked.includes(f.id)) {
        this.group.attach(f.object);f.object.position.copy(this.basket.localToWorld(new T.Vector3((i-1)*.16,.23,.02)));
      } else {this.group.attach(f.object);f.object.position.copy(f.home);}
      f.object.visible=true;
    }
  }
  targets():InteractionTarget[] {
    const done=this.game.state.activities.picked.length===3;
    return [
      ...(done?[{id:'harvest-again',x:-48,z:60,height:1.6,range:2,kind:'activity',activity:'oranges' as const,label:t('Pick again'),symbol:'🍊',task:'oranges' as const}]:this.fruits.filter(f=>!this.game.state.activities.picked.includes(f.id)).map(f=>({id:f.id,x:f.x,z:f.z,height:1.95,range:1.65,kind:'activity',activity:'oranges' as const,label:t('Pick oranges'),symbol:'🍊',task:'oranges' as const,subject:f.tree}))),
      ...festivalSites.map((p,i)=>({id:`firecracker-${i}`,...p,height:1.8,range:2.8,kind:'activity',activity:'firecracker' as const,label:t('Throw a firecracker'),symbol:'✦',task:'firecracker' as const})),
      {id:'falla-photo',...fallaPhotoSite,height:2,range:2.5,kind:'activity',activity:'falla' as const,label:t('Selfie with the Falla'),symbol:'📷',task:'falla' as const},
    ];
  }
  pickTarget(id?:string) {return this.fruits.filter(f=>!this.game.state.activities.picked.includes(f.id)&&(!id||id===f.id)).sort((a,b)=>distance(this.game,a)-distance(this.game,b))[0];}
  preparePick(id?:string) {
    const fruit=this.pickTarget(id);if(!fruit||distance(this.game,fruit)>1.65)return null;
    const direction=localOffset(fruit.x,fruit.z,this.game.x,this.game.z);
    this.game.heading=Math.atan2(direction.x,direction.z);
    return fruit.id;
  }
  posePick(id:string,age:number) {
    const f=this.fruits.find(f=>f.id===id)!;const g=this.game,rig=getCharacterRig(g.player);
    refresh(g.player,rig);
    const from=rig.bones.get('Hand_R')!.getWorldPosition(new T.Vector3());
    const target=from.clone().lerp(f.home,T.MathUtils.smoothstep(age,0,.75));
    if(age<1.1){solveLimb(rig,'UpperArm_R','Forearm_R','Hand_R',target,new T.Vector3(1,0,0).applyQuaternion(g.player.quaternion));refresh(g.player,rig);}
    else {this.group.attach(f.object);f.object.position.copy(f.home).lerp(this.basket.localToWorld(new T.Vector3((g.state.activities.picked.length-1)*.14,.25,0)),T.MathUtils.smoothstep(age,1.1,2));}
  }
  private throwClear(target:{x:number;z:number}) {
    const g=this.game;
    for(let i=1;i<=8;i++) {
      const v=point(g.x,g.z).lerp(point(target.x,target.z),i/8).normalize();
      const p={x:Math.atan2(v.x,v.y)*100,z:Math.asin(v.z)*100};
      if(g.world.blocked(p.x,p.z,.22)||g.world.behavior?.blocksPlayer(p.x,p.z,.35,g)||distance(p,{x:g.tramX,z:-12})<3)return false;
    }
    return true;
  }
  prepareThrow() {
    const g=this.game;
    const station=festivalSites.find(p=>distance(g,p)<2.8);if(!station)return false;
    const targets=[g.yaw,g.yaw+Math.PI/2,g.yaw-Math.PI/2,g.yaw+Math.PI].map(yaw=>offset(g.x,g.z,Math.sin(yaw)*2.8,Math.cos(yaw)*2.8));
    const target=targets.find(p=>this.throwClear(p));if(!target)return false;
    const direction=localOffset(target.x,target.z,g.x,g.z);g.yaw=g.heading=Math.atan2(direction.x,direction.z);
    this.landing.copy(point(target.x,target.z,g.world.heightAt(target.x,target.z)+.07));this.throwReleased=false;this.pop=false;return true;
  }
  poseThrow(age:number) {
    const g=this.game,rig=getCharacterRig(g.player);refresh(g.player,rig);
    this.mixer.setTime(Math.min(age,1.5));
    const local=this.throwHand.getWorldPosition(new T.Vector3());
    const target=g.player.localToWorld(local);
    solveLimb(rig,'UpperArm_R','Forearm_R','Hand_R',target,new T.Vector3(1,.3,0).applyQuaternion(g.player.quaternion));refresh(g.player,rig);
    this.cracker.visible=age<1.85;
    if(age<1){this.cracker.position.copy(rig.bones.get('Hand_R')!.getWorldPosition(new T.Vector3()));this.release.copy(this.cracker.position);}
    else {this.throwReleased=true;const u=T.MathUtils.clamp((age-1)/.7,0,1);this.cracker.position.copy(this.release).lerp(this.landing,u).addScaledVector(this.landing.clone().normalize(),Math.sin(u*Math.PI)*.55);this.cracker.rotateX(.2);}
    const elapsed=age-1.85;
    for(const [i,p] of this.particles.entries()){p.visible=elapsed>=0&&elapsed<1.5;if(!p.visible)continue;p.position.copy(this.landing).addScaledVector(this.landing.clone().normalize(),.1+elapsed*(.3+i*.04));p.position.add(new T.Vector3(Math.sin(i*2.4),0,Math.cos(i*2.4)).multiplyScalar(elapsed*.2));p.scale.setScalar(.5+elapsed*1.4);(p.material as T.MeshBasicMaterial).opacity=Math.max(0,.6*(1-elapsed/1.5));}
    if(elapsed>=0&&!this.pop){this.pop=true;g.localSound?.oneShot('masclet',.25);g.world.behavior?.signal(g,g.processionClock);return true;}return false;
  }
  get released(){return this.throwReleased;}
  clearThrow(){this.cracker.visible=false;for(const p of this.particles)p.visible=false;}
  update(time:number) {
    const g=this.game;
    const focus=g.player.position.clone().addScaledVector(g.player.position.clone().normalize(),1.2);
    const ray=new T.Ray(g.camera.position,focus.clone().sub(g.camera.position).normalize());
    for(const item of this.treeFades){
      const bounds=new T.Box3().setFromObject(item.tree);const hit=ray.intersectBox(bounds,new T.Vector3());
      const targetTree=this.fruits.find(f=>f.id===(g.activities.active?.target??g.interactions.selected?.id))?.tree;
      const obscures=item.tree!==targetTree&&!g.globe&&!g.photo&&!!hit&&hit.distanceTo(g.camera.position)<focus.distanceTo(g.camera.position);
      item.opacity=T.MathUtils.lerp(item.opacity,obscures?.07:1,.18);
      for(const m of item.materials){m.transparent=true;m.depthWrite=item.opacity>.98;m.opacity=item.opacity;}
    }
    const near=!g.globe&&distance(g,{x:-48,z:62})<45;
    this.gardener.visible=near;if(near){setPersonDetail(this.gardener,true);animateCharacter(this.gardener,time,'Watch',g.world.ground);}
  }
}
