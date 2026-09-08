import * as T from 'three';
import { distance, docks, stops } from './data';
import { point } from './geometry';
import { cafeSite, photoSite, photoInteractionRange, waterSeat } from './immersion-sites';
import { boatDocks } from './wetland-layout';
import { t } from './i18n';
import type { Game } from './game';
import type { ActivityKind } from './activities';
import type { TaskId } from './activity-catalogue';
import { bindPress, mobileControls } from './touch-controls';
import { groveEntrance, grovePath } from './activity-scene';
import { getCharacterRig } from './characters';

export interface InteractionTarget {
  id: string; x: number; z: number; height: number; range: number;
  kind: string; label: string; symbol: string; task?: TaskId; activity?: ActivityKind;
  index?: number; subject?: T.Object3D;
}
/** One selection feeds E, the fixed touch action and the anchored buttons. */
export class Interactions {
  selected: InteractionTarget | null = null;
  visible: InteractionTarget[] = [];
  private last = -1;
  private ray = new T.Raycaster();
  private blockers?: T.Mesh[];
  private hits: T.Intersection[] = [];
  private sphere = new T.Sphere();
  private closest = new T.Vector3();
  constructor(private game: Game) {}
  targets(): InteractionTarget[] {
    const g = this.game;
    const basic = (id: string, p: {x:number;z:number}, activity: ActivityKind, symbol: string, range: number, task?: TaskId): InteractionTarget =>
      ({id,...p,height:2.5,range,kind:'activity',activity,symbol,task,label:g.activities.prompt(activity)});
    const result = [basic('cafe',cafeSite,'horchata','🥛',2.5,'horchata'),
      basic('serranos-photo',photoSite,'photograph','📷',photoInteractionRange), basic('waterside',waterSeat,'waterside','≈',2.6)];
    result[1].subject = g.world.behavior?.photographer;
    result[0].height=3.7;
    result[0].subject = g.world.behavior?.server;
    if (g.world.procession) result.push(basic('band',g.world.procession.bandPosition,'procession','♫',5,'band'));
    for (const bike of g.parkedBikes.available) result.push({id:bike.id,x:bike.x,z:bike.z,height:1.7,range:bike.dock === undefined ? 2.8 : 5.5,kind:'bike',label:t('Borrow a Valenbisi'),symbol:'🚲',task:'bike',subject:bike.object});
    boatDocks.forEach((p,index) => result.push({...p,...g.world.wetland.boats[index].landing,id:`boat-${index}`,height:2.7,range:4,kind:'boat',label:t('Take the Albufera boat'),symbol:'🛶',task:'rowing',index}));
    stops.forEach((p,index) => result.push({id:`tram-${index}`,...p,height:3.5,range:8,kind:'tram',label:t('Ride tram · {name}',{name:p.name}),symbol:'▤',index,subject:g.world.tram}));
    if (g.world.cityLife) result.push({...basic('bull',g.world.cityLife.petTarget(),'bull','🐂',2.7,'bull'),subject:g.world.cityLife.bull,height:2.3});
    for (const target of g.activities.localTargets()) result.push(target);
    return result;
  }
  isVisible(target: InteractionTarget) {
    const g = this.game, anchor = point(target.x,target.z,g.world.heightAt(target.x,target.z)+target.height);
    const p = anchor.clone().project(g.camera);
    if (p.z < 0 || p.z >= 1 || Math.abs(p.x)>1 || Math.abs(p.y)>.96) return false;
    if (point(g.x,g.z).normalize().dot(anchor.clone().normalize()) < .1) return false;
    this.ray.set(g.camera.position,anchor.clone().sub(g.camera.position).normalize());
    this.ray.far = g.camera.position.distanceTo(anchor)-.3;
    // Assets are loaded before play. Skip floors, transparent effects, hidden
    // branches and the subject before raycasting, instead of testing their triangles.
    if (!this.blockers) {
      this.blockers=[];
      g.world.group.traverse(o=>{
        if(!(o instanceof T.Mesh)||o.userData.walkable||o.name==='foot-contact-shadows')return;
        // The merged landmarks have spheres but no boxes. Their large spheres
        // otherwise send nearby rays through every triangle of the building.
        if(!(o instanceof T.SkinnedMesh)&&!o.geometry.boundingBox)o.geometry.computeBoundingBox();
        this.blockers!.push(o);
      });
    }
    for (const o of this.blockers) {
      let inWorld=false,excluded=false;
      for (let p:T.Object3D|null=o;p;p=p.parent) {
        if(!p.visible || p===g.player || p===target.subject){excluded=true;break;}
        if(p===g.world.group){inWorld=true;break;}
      }
      if(excluded||!inWorld)continue;
      const mats = Array.isArray(o.material)?o.material:[o.material];
      if(!mats.some(m=>!m.transparent || m.opacity>.95))continue;
      // SkinnedMesh's sphere test uses an infinite ray. Reject actors beyond
      // the target before its expensive per-vertex skinning and triangle tests.
      const bounds=o instanceof T.SkinnedMesh?o.boundingSphere:o.geometry.boundingSphere;
      if(bounds){
        this.sphere.copy(bounds).applyMatrix4(o.matrixWorld);
        const along=T.MathUtils.clamp(this.closest.copy(this.sphere.center).sub(this.ray.ray.origin).dot(this.ray.ray.direction),0,this.ray.far);
        this.closest.copy(this.ray.ray.direction).multiplyScalar(along).add(this.ray.ray.origin);
        if(this.closest.distanceToSquared(this.sphere.center)>this.sphere.radius*this.sphere.radius)continue;
      }
      this.hits.length=0;
      this.ray.intersectObject(o,false,this.hits);
      if(this.hits.length)return false;
    }
    return true;
  }
  update(force = false) {
    const g = this.game;
    if (!force && performance.now()-this.last<120) return;
    this.last=performance.now();
    if (!g.started || g.paused || g.photo || g.globe || g.mode!=='walk' || g.activities.active) {
      this.selected=null;this.visible=[];return;
    }
    const candidates=this.targets().filter(p=>distance(g,p)<12).filter(p=>this.isVisible(p));
    const score=(p:InteractionTarget)=>distance(g,p)+(Math.abs(point(p.x,p.z,p.height).project(g.camera).x)*1.3);
    candidates.sort((a,b)=>score(a)-score(b));
    const eligible=candidates.filter(p=>distance(g,p)<p.range);
    const previous=eligible.find(p=>p.id===this.selected?.id);
    this.selected=previous && (!eligible[0] || score(previous)<score(eligible[0])+1) ? previous : eligible[0]??null;
    this.visible=[...(this.selected?[this.selected]:[]),...candidates.filter(p=>p.id!==this.selected?.id)].slice(0,3);
  }
  validate(id: string) {
    const target=this.targets().find(p=>p.id===id);
    return target && distance(this.game,target)<target.range && this.isVisible(target) ? target : null;
  }
  destination(task: TaskId, approach = false) {
    if(task==='oranges' && this.game.z<groveEntrance.z+2) {
      if(!approach)return {...groveEntrance,label:t('Orange grove')};
      const g=this.game;let best=Infinity,next=grovePath.length-1;
      for(let i=0;i<grovePath.length-1;i++){
        const a=grovePath[i],b=grovePath[i+1],dx=b.x-a.x,dz=b.z-a.z;
        const u=T.MathUtils.clamp(((g.x-a.x)*dx+(g.z-a.z)*dz)/(dx*dx+dz*dz),0,1);
        const d=Math.hypot(g.x-a.x-u*dx,g.z-a.z-u*dz);
        if(d<=best){best=d;next=i+1;}
      }
      while(next<grovePath.length-1&&distance(g,grovePath[next])<1.8)next++;
      return {...(best<12?grovePath[next]:groveEntrance),label:t('Orange grove')};
    }
    return this.targets().filter(p=>p.task===task).sort((a,b)=>distance(this.game,a)-distance(this.game,b))[0];
  }
}

export class InteractionBubbles {
  private buttons = new Map<string,HTMLButtonElement>();
  constructor(private game: Game, private root: HTMLElement) {}
  update() {
    const g=this.game;g.interactions.update();
    const targets=g.interactions.visible;
    for (const [id,button] of this.buttons) if(!targets.some(t=>t.id===id)){button.remove();this.buttons.delete(id);}
    const currentTargets=targets.length?g.interactions.targets():[];
    const touch=mobileControls();
    const occupied: DOMRect[]=[];
    const head=getCharacterRig(g.player).bones.get('Head')?.getWorldPosition(new T.Vector3()).project(g.camera);
    if(head&&head.z>0&&head.z<1)occupied.push(new DOMRect((head.x*.5+.5)*innerWidth-24,(-head.y*.5+.5)*innerHeight-26,48,52));
    for (const target of targets) {
      // Moving subjects keep their current anchor even between selection checks.
      const current=currentTargets.find(p=>p.id===target.id);
      if(current)Object.assign(target,current);
      let button=this.buttons.get(target.id);
      if(!button){button=document.createElement('button');button.type='button';button.className='activity-bubble';button.dataset.target=target.id;
        bindPress(button,()=>g.interact(target.id));this.root.append(button);this.buttons.set(target.id,button);}
      const selected=g.interactions.selected?.id===target.id;
      button.classList.toggle('expanded',selected);
      button.disabled=!selected;
      const text=selected ? `${target.activity==='photograph'?target.symbol+' ':''}${touch?'':'E · '}${target.label}` : target.symbol;
      if(button.textContent!==text)button.textContent=text;
      button.setAttribute('aria-label',selected?target.label:t('Approach: {action}',{action:target.label}));
      const p=point(target.x,target.z,g.world.heightAt(target.x,target.z)+target.height).project(g.camera);
      const width=innerWidth,height=innerHeight;
      const x=(p.x*.5+.5)*width,y=(-p.y*.5+.5)*height;
      button.style.transform=`translate3d(${x}px,${y}px,0) translate(-50%,-100%)`;button.hidden=false;
      const rect=button.getBoundingClientRect();
      const overlaps=(r:DOMRect)=>rect.left<r.right+8&&rect.right>r.left-8&&rect.top<r.bottom+8&&rect.bottom>r.top-8;
      const controls=Array.from(document.querySelectorAll<HTMLElement>('.topbar,.mini,.joystick-wrap,.touch-actions')).filter(e=>e.getClientRects().length).map(e=>e.getBoundingClientRect());
      if(rect.left<12||rect.right>width-12||rect.top<72||rect.bottom>height-95||[...controls,...occupied].some(overlaps))button.hidden=true;
      else occupied.push(rect);
    }
  }
}
