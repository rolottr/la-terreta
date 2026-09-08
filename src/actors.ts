import * as T from "three";
import { cityAsset } from "./city-assets";
import { createPerson, animateCharacter, setPersonDetail } from "./characters";
export { createPerson, posePerson } from "./characters";

export { createBike } from "./bike";

export function createTram() {
  const g = cityAsset("tram");
  g.name = "Blender Metrovalencia tram";
  const doors: T.Object3D[]=[];
  g.traverse(object=>{if(object.name.startsWith("Tram_Door")){object.userData.closedX=object.position.x;doors.push(object);}});
  const passengers=[[-3,-.65],[1,.65],[4,-.65]].map(([x,z],i)=>{
    const person=createPerson(i);person.position.set(x,.49,z);person.rotation.y=z<0?0:Math.PI;g.add(person);return person;
  });
  g.userData.doors=doors;g.userData.passengers=passengers;g.userData.doorOpen=0;
  return g;
}
export function updateTram(tram:T.Group,time:number,dt:number,dwell:boolean,near:boolean) {
  const open=T.MathUtils.damp(tram.userData.doorOpen,dwell?1:0,3,dt);tram.userData.doorOpen=open;
  for(const door of tram.userData.doors as T.Object3D[])door.position.x=door.userData.closedX+open*.88;
  for(const person of tram.userData.passengers as T.Group[]) {person.visible=near;if(near){setPersonDetail(person,true);animateCharacter(person,time,"Sit");}}
}
