import { MathUtils } from 'three';
import { localOffset, offset } from './navigation';
import { waterAt, onJetty } from './wetland-layout';
export interface BirdPosition {x:number;z:number}
export interface BirdBoat extends BirdPosition {heading:number}
/** Capsule covers the pointed hull, plus the bird's body and a small gap. */
export function hullClearance(p:BirdPosition, boat:BirdBoat) {
  const local=localOffset(p.x,p.z,boat.x,boat.z), c=Math.cos(boat.heading),s=Math.sin(boat.heading);
  const side=local.x*c-local.z*s,along=local.x*s+local.z*c;
  return Math.hypot(side,along-MathUtils.clamp(along,-2,2))-1.45;
}
export function moveBird(position:BirdPosition,target:BirdPosition,boats:BirdBoat[],dt:number,seed:number) {
  const delta=localOffset(target.x,target.z,position.x,position.z);
  for(const boat of boats){
    const away=localOffset(position.x,position.z,boat.x,boat.z),length=Math.hypot(away.x,away.z);
    if(length<6){delta.x+=away.x/Math.max(.1,length)*(6-length)*3;delta.z+=away.z/Math.max(.1,length)*(6-length)*3;}
  }
  const length=Math.hypot(delta.x,delta.z),speed=Math.min(.9,length);
  let next:BirdPosition=offset(position.x,position.z,delta.x/Math.max(.001,length)*speed*dt,delta.z/Math.max(.001,length)*speed*dt);
  const water=(p:BirdPosition)=>waterAt(p.x,p.z)&&!onJetty(p.x,p.z);
  if(!water(next))next={...position};
  for(const boat of boats){
    if(hullClearance(next,boat)>=0)continue;
    const local=localOffset(next.x,next.z,boat.x,boat.z),c=Math.cos(boat.heading),s=Math.sin(boat.heading);
    const side=local.x*c-local.z*s,along=local.x*s+local.z*c;
    const segment=MathUtils.clamp(along,-2,2),end=along-segment,separation=Math.hypot(side,end);
    const nx=separation>.001?side/separation:(seed%2?1:-1),nz=separation>.001?end/separation:0;
    // Slight margin accounts for the spherical projection used by offset().
    const x=nx*1.46,z=segment+nz*1.46;
    next=offset(boat.x,boat.z,x*c+z*s,-x*s+z*c);
  }
  const clear=(p:BirdPosition)=>water(p)&&boats.every(boat=>hullClearance(p,boat)>=0);
  if(clear(next))return next;
  // At a jetty, take the nearest clear water position instead of pushing ashore.
  for(const radius of [.3,.6,1,1.5,2,3,4,6]){
    for(let k=0;k<24;k++){
      const a=k*Math.PI/12+seed;
      const p=offset(next.x,next.z,Math.sin(a)*radius,Math.cos(a)*radius);
      if(clear(p))return p;
    }
  }
  return position;
}
