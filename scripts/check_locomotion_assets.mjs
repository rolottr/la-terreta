/** Focused checks against the shipped GLBs and the runtime leg/pedal solver. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const root=path.resolve(import.meta.dirname,'..');
const output=path.join(root,'node_modules/.cache/locomotion-check.mjs');
await build({stdin:{contents:'export * from "./src/characters";export * from "./src/bike";export {R} from "./src/data";',resolveDir:root},bundle:true,platform:'node',format:'esm',external:['three','three/*'],outfile:output,logLevel:'silent'});
const C=await import(pathToFileURL(output));
globalThis.ProgressEvent ??= class { constructor(type, values) { Object.assign(this,values); } };
const loader=new GLTFLoader();
// Retain real mesh, bind, animation and transform data. Texture decoding is
// irrelevant to the mechanical checks and requires a browser canvas.
GLTFLoader.prototype.loadAsync=async function(url) {
  const bytes=await fs.readFile(path.join(root,'public',url));
  const len=bytes.readUInt32LE(12),doc=JSON.parse(bytes.toString('utf8',20,20+len));
  doc.buffers[0].uri='data:application/octet-stream;base64,'+bytes.subarray(28+len).toString('base64');
  delete doc.textures;delete doc.images;
  doc.materials=doc.materials.map(()=>({}));
  return loader.parseAsync(JSON.stringify(doc),'');
};
await Promise.all([C.loadCharacters(),C.loadBike()]);
const ground={nearby:()=>[],heightAlong:()=>0};
const report={cycling:[],gaits:[],scaledIdle:[],tires:[],rowingExit:[]};
const riderBike=C.createBike(true),parkedBike=C.createBike();
assert.equal(riderBike.getObjectByName('Valenbisi_Stand').rotation.x,1.35);
assert.equal(parkedBike.getObjectByName('Valenbisi_Stand').rotation.x,0);
for(const lean of [-.22,0,.22]) {
  riderBike.position.set(0,C.R+.03,0);riderBike.rotation.set(0,.72,lean);C.rollBike(riderBike,.19);
  const gaps=()=>['Rear','Front'].map(side=>{
    riderBike.updateMatrixWorld(true);const wheel=riderBike.getObjectByName(`Valenbisi_${side}Wheel`);let min=Infinity;
    wheel.traverse(object=>{
      if(!(object instanceof T.Mesh))return;const positions=object.geometry.getAttribute('position');
      for(let i=0;i<positions.count;i++){const point=new T.Vector3().fromBufferAttribute(positions,i).applyMatrix4(object.matrixWorld);min=Math.min(min,point.length()-C.R);}
    });
    return min;
  });
  const before=gaps();C.groundBike(riderBike,ground);const after=gaps();
  assert.ok(after.every(gap=>gap>-.0001&&gap<.002),`Tire floor contact ${after}`);
  report.tires.push({lean,before,after,standFolded:true});
}
for(const gender of ['male','female']) {
  const person=C.createHero(gender),bike=C.createBike(),rig=C.getCharacterRig(person);
  person.position.y=.35;
  let maxContactError=0,maxGripError=0;
  for(let step=0;step<240;step++) {
    C.rollBike(bike,(step<120?1:-1)*.07);
    const phase=C.getBikeCrankPhase(bike);
    C.animateCharacter(person,step/60,'Cycle',undefined,0,phase);
    if(step<30) continue;
    for(const [i,side] of ['L','R'].entries()) {
      const foot=rig.bones.get(`Foot_${side}`).getWorldPosition(new T.Vector3());
      const pedal=bike.getObjectByName(`Valenbisi_${i?'Right':'Left'}Pedal`).getWorldPosition(new T.Vector3());
      const soleBall=foot.clone().add(new T.Vector3(0,-.139,.065));
      maxContactError=Math.max(maxContactError,soleBall.distanceTo(pedal));
      const hand=rig.bones.get(`Hand_${side}`).getWorldPosition(new T.Vector3());
      maxGripError=Math.max(maxGripError,hand.distanceTo(new T.Vector3(i?.28:-.28,1.38,.282)));
    }
  }
  const stopped=C.getBikeCrankPhase(bike);C.rollBike(bike,0);assert.equal(C.getBikeCrankPhase(bike),stopped);
  assert.ok(maxContactError<.001,`${gender} sole/pedal error ${maxContactError}`);
  assert.ok(maxGripError<.004,`${gender} hand/grip error ${maxGripError}`);
  report.cycling.push({gender,maxContactError,maxGripError,reverseAndStop:true});
  C.releaseCharacter(person);
  const child=C.createHero(gender);child.scale.setScalar(.67);child.position.y=C.R;
  for(let step=0;step<90;step++)C.animateCharacter(child,step/60,'Watch',ground);
  const childRig=C.getCharacterRig(child);let childGap=Infinity;
  for(const points of childRig.soles)for(const point of points){const v=point.mesh.getVertexPosition(point.index,new T.Vector3()).applyMatrix4(point.mesh.matrixWorld);childGap=Math.min(childGap,v.length()-C.R);}
  assert.ok(Math.abs(childGap)<.0001,`${gender} child ground gap ${childGap}`);
  const before=childRig.bones.get('Head').getWorldPosition(new T.Vector3());
  for(let step=0;step<30;step++)C.animateCharacter(child,89/60,'Watch',ground);
  const drift=before.distanceTo(childRig.bones.get('Head').getWorldPosition(new T.Vector3()));
  assert.ok(drift<.000001,`${gender} frozen pose drifts ${drift}`);
  report.scaledIdle.push({gender,scale:.67,childGap,frozenPoseDrift:drift});
  C.releaseCharacter(child);
  const rower=C.createHero(gender);rower.position.y=C.R;
  const rowRig=C.getCharacterRig(rower);
  C.animateLocomotion(rower,0,0,0,ground);
  const standing=rower.worldToLocal(rowRig.bones.get('UpperArm_R').getWorldPosition(new T.Vector3())).y;
  C.animateCharacter(rower,1,'Row',undefined,0,Math.PI);
  for(let i=1;i<=30;i++)C.animateLocomotion(rower,1+i/60,0,0,ground);
  const restored=rower.worldToLocal(rowRig.bones.get('UpperArm_R').getWorldPosition(new T.Vector3())).y;
  assert.ok(Math.abs(restored-standing)<.001,`${gender} keeps the seated pose after leaving the boat: ${restored} vs ${standing}`);
  report.rowingExit.push({gender,standing,restored});C.releaseCharacter(rower);
  for(const speed of [.8,1.6,2.6,6.6]) {
    const walker=C.createHero(gender);walker.position.y=C.R;
    const wrig=C.getCharacterRig(walker);let maxPenetration=0,maxFlight=0,maxSlideSpeed=0;
    let previous;
    for(let step=0;step<240;step++) {
      C.animateLocomotion(walker,step/60,speed,0,ground);
      const {phase,run}=wrig.gait,stance=T.MathUtils.lerp(.60,.23,run);
      let lowest=Infinity;
      for(const points of wrig.soles)for(const point of points){const v=point.mesh.getVertexPosition(point.index,new T.Vector3()).applyMatrix4(point.mesh.matrixWorld);lowest=Math.min(lowest,v.length()-C.R);}
      maxPenetration=Math.max(maxPenetration,-lowest);maxFlight=Math.max(maxFlight,lowest);
      const feet=['L','R'].map(side=>wrig.bones.get(`Foot_${side}`).getWorldPosition(new T.Vector3()));
      if(step>120&&previous)for(let i=0;i<2;i++) {
        const u=(phase+i*.5)%1,old=(previous.phase+i*.5)%1;
        if(u>stance*.25&&u<stance*.60&&old<u)maxSlideSpeed=Math.max(maxSlideSpeed,Math.abs((feet[i].z-previous.feet[i].z)*60+speed));
      }
      previous={phase,feet};
    }
    assert.ok(maxPenetration<.0001,`${gender}/${speed} ground penetration ${maxPenetration}`);
    assert.ok(maxSlideSpeed<.05,`${gender}/${speed} planted foot slides ${maxSlideSpeed} m/s`);
    report.gaits.push({gender,speed,maxPenetration,maxFlight,maxSlideSpeed});
    C.releaseCharacter(walker);
  }
}
// Each new body and height must retain stable sole contact in real skinned poses.
report.residents=[];
const identities=new Set();
for(let index=0;index<12;index++) {
  const resident=C.createPerson(index);resident.position.y=C.R;identities.add(resident.name);
  const rig=C.getCharacterRig(resident);let maxPenetration=0;
  for(const clip of ['Idle','Walk','Run'])for(let step=0;step<24;step++) {
    C.animateCharacter(resident,step/24,clip,ground);
    for(const points of rig.soles)for(const point of points) {
      const v=point.mesh.getVertexPosition(point.index,new T.Vector3()).applyMatrix4(point.mesh.matrixWorld);
      maxPenetration=Math.max(maxPenetration,C.R-v.length());
    }
  }
  assert.ok(maxPenetration<.0001,`${resident.name} sole penetration ${maxPenetration}`);
  report.residents.push({name:resident.name,scale:resident.scale.y,maxPenetration});
  C.releaseCharacter(resident);
}
assert.equal(identities.size,12,'Resident selection must use every identity');
// The serialized Blink must close vertically, without moving face depth or glasses.
report.blink=[];
const characterBytes=await fs.readFile(path.join(root,'public/models/characters.glb'));
const characterDoc=JSON.parse(characterBytes.toString('utf8',20,20+characterBytes.readUInt32LE(12)));
const variants=characterDoc.nodes.filter(node=>node.extras?.character).map(node=>({name:node.extras.character}));
assert.equal(variants.length,24,'The shipped library must contain all character identities');
for(const {name} of variants) {
  const person=C.createCharacter(name),rig=C.getCharacterRig(person);
  let changed=0,maxYDelta=0,minY=Infinity,maxY=-Infinity;
  for(const skin of rig.skins) {
    const key=skin.morphTargetDictionary?.Blink;if(key===undefined)continue;
    const base=skin.geometry.attributes.position,delta=skin.geometry.morphAttributes.position[key];
    for(let i=0;i<base.count;i++) {
      const d=[delta.getX(i),delta.getY(i),delta.getZ(i)];
      if(!skin.geometry.morphTargetsRelative) {d[0]-=base.getX(i);d[1]-=base.getY(i);d[2]-=base.getZ(i);}
      if(Math.max(...d.map(Math.abs))<1e-7)continue;
      assert.ok(Math.abs(d[0])<1e-6&&Math.abs(d[2])<1e-6,`${name} blink changes horizontal position or face depth`);
      assert.ok(base.getY(i)>1.63&&base.getY(i)<1.68&&Math.abs(d[1])<.02,`${name} blink leaves the eye region`);
      changed++;maxYDelta=Math.max(maxYDelta,Math.abs(d[1]));minY=Math.min(minY,base.getY(i));maxY=Math.max(maxY,base.getY(i));
    }
  }
  assert.ok(changed>0,`${name} has no moving Blink vertices`);
  report.blink.push({name,movedVertices:changed,baseYRange:[minY,maxY],maxYDelta,xAndZUnchanged:true});
  C.releaseCharacter(person);
}
console.log(JSON.stringify(report,null,2));
