import { boatDocks, lagoonOutline, seaOutline, channelOutline, islands, reserveAt, expanded } from "./wetland-layout";
import * as T from "three";
import { C, R, places, stops, wrap } from "./data";
import { basis, point } from "./geometry";
import { lots, routes, type Position } from "./layout";
import { offset } from "./navigation";

interface MapState extends Position {
  heading: number;
  tramX: number;
  waypoint: string | null;
  routeTarget?: {x:number;z:number}|null;
  visited: Set<string>;
}
const unit = (p: Position) => point(p.x, p.z).normalize();
const arc = (a: Position, b: Position) => {
  const start = unit(a), end = unit(b), angle = start.angleTo(end);
  const axis = start.clone().cross(end).normalize();
  const steps = Math.max(2, Math.ceil(angle * R / 3));
  return Array.from({ length: steps + 1 }, (_, i) => start.clone().applyAxisAngle(axis, angle * i / steps));
};
const streets = routes.flatMap(route => {
  const segments:T.Vector3[][]=[];let current:T.Vector3[]=[];
  for(const v of arc(route.a,route.b)){
    const x=Math.atan2(v.x,v.y)*R,z=Math.atan2(v.z,Math.hypot(v.x,v.y))*R;
    if(reserveAt(x,z,7)){if(current.length>1)segments.push(current);current=[];}else current.push(v);
  }
  if(current.length>1)segments.push(current);
  return segments.map(points=>({points,width:route.width,garden:route.garden}));
});
const tramLine = Array.from({ length: 241 }, (_, i) => unit({ x: -C / 2 + i * C / 240, z: -12 }));
const buildings = lots.map(unit);
const waters = [
  {points: expanded(seaOutline,10).map(unit),color:"#e5cb93"},
  {points: seaOutline.map(unit),color:"#68b9c3"},
  {points: lagoonOutline.map(unit),color:"#79aaa0"},
  {points: channelOutline.map(unit),color:"#79aaa0"},
  ...islands.map(p=>({points:p.map(unit),color:"#8d9d59"})),
];
const districts = places.filter(p => !["albufera", "beach", "turia"].includes(p.id)).map(p => {
  const points: T.Vector3[] = [];
  for (const [a,b] of [[[-39,-44],[39,-44]],[[39,-44],[39,44]],[[39,44],[-39,44]],[[-39,44],[-39,-44]]]) {
    for (let i = 0; i < 12; i++) points.push(unit(offset(p.x,p.z,a[0]+(b[0]-a[0])*i/12,a[1]+(b[1]-a[1])*i/12)));
  }
  return points;
});
const grid = [
  ...Array.from({ length: 12 }, (_, longitude) => Array.from({ length: 65 }, (_, i) => unit({ x: longitude * C / 12, z: -Math.PI * R / 2 + i * Math.PI * R / 64 }))),
  ...[-60, -30, 0, 30, 60].map(latitude => Array.from({ length: 129 }, (_, i) => unit({ x: i * C / 128, z: latitude * Math.PI * R / 180 }))),
];

/** Orthographic globe, using the same sphere, paths and coordinates as the game. */
export class GlobeMap {
  center: Position = { x: 0, z: 5 };
  private hits: { id: string; x: number; y: number }[] = [];

  focus(position: Position) { this.center = { x: position.x, z: position.z }; }
  rotate(dx: number, dy = 0) {
    this.center.x = wrap(this.center.x + dx);
    this.center.z = Math.max(-Math.PI * R / 2, Math.min(Math.PI * R / 2, this.center.z + dy));
  }
  bind(canvas: HTMLCanvasElement, draw: () => void, select: (id: string) => void) {
    let drag: { id: number; x: number; y: number; distance: number } | null = null;
    canvas.addEventListener("pointerdown", event => {
      if (event.button !== 0 || drag) return;
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, distance: 0 };
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener("pointermove", event => {
      if (!drag || drag.id !== event.pointerId) return;
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
      drag.distance += Math.hypot(dx, dy);
      const scale = C / canvas.getBoundingClientRect().width;
      this.rotate(-dx * scale, -dy * scale);
      drag.x = event.clientX; drag.y = event.clientY;
      draw();
    });
    canvas.addEventListener("pointerup", event => {
      if (!drag || drag.id !== event.pointerId) return;
      if (drag.distance < 5) {
        const rect = canvas.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width * canvas.width;
        const y = (event.clientY - rect.top) / rect.height * canvas.height;
        const hit = this.hits.find(p => Math.hypot(p.x - x, p.y - y) < canvas.width * .04);
        if (hit) select(hit.id);
      }
      drag = null;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    });
    for (const type of ["pointercancel", "lostpointercapture"]) canvas.addEventListener(type, () => { drag = null; });
    canvas.addEventListener("keydown", event => {
      const moves: Record<string, [number, number]> = { ArrowLeft: [-25, 0], ArrowRight: [25, 0], ArrowUp: [0, -25], ArrowDown: [0, 25] };
      if (!moves[event.key]) return;
      event.preventDefault(); event.stopPropagation();
      this.rotate(...moves[event.key]); draw();
    });
  }

  draw(canvas: HTMLCanvasElement, state: MapState, large: boolean, selected: string) {
    const ctx = canvas.getContext("2d")!, n = canvas.width, c = n / 2, radius = n * .44;
    const frame = basis(large ? this.center.x : state.x, large ? this.center.z : state.z);
    const project = (v: T.Vector3) => ({ x: c + radius * v.dot(frame.east), y: c + radius * v.dot(frame.south), depth: v.dot(frame.up) });
    // Clip at the visible hemisphere in world space, including seam and pole crossings.
    const horizon = (a: T.Vector3, b: T.Vector3) => {
      const da = a.dot(frame.up), db = b.dot(frame.up);
      return a.clone().lerp(b, da / (da - db)).normalize();
    };
    const stroke = (points: T.Vector3[], color: string, width: number) => {
      ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = width;
      for (let i = 1; i < points.length; i++) {
        let a = points[i-1], b = points[i];
        const da = a.dot(frame.up), db = b.dot(frame.up);
        if (da < 0 && db < 0) continue;
        if (da < 0) a = horizon(a, b);
        if (db < 0) b = horizon(a, b);
        const pa = project(a), pb = project(b);
        ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y);
      }
      ctx.stroke();
    };
    const fill = (points: T.Vector3[], color: string) => {
      const clipped: T.Vector3[] = [];
      for (let i = 0; i < points.length; i++) {
        const a = points[(i + points.length - 1) % points.length], b = points[i];
        const da = a.dot(frame.up), db = b.dot(frame.up);
        if ((da < 0) !== (db < 0)) clipped.push(horizon(a,b));
        if (db >= 0) clipped.push(b);
      }
      if (clipped.length < 3) return;
      ctx.beginPath();
      clipped.forEach((v,i) => { const p = project(v); if (i) ctx.lineTo(p.x,p.y); else ctx.moveTo(p.x,p.y); });
      ctx.closePath(); ctx.fillStyle = color; ctx.fill();
    };
    ctx.clearRect(0,0,n,n);
    ctx.save();
    ctx.beginPath(); ctx.arc(c,c,radius,0,Math.PI*2);
    ctx.shadowColor = "#29473e30"; ctx.shadowBlur = n*.035; ctx.shadowOffsetY = n*.014;
    ctx.fillStyle = "#9db785"; ctx.fill();
    ctx.shadowColor = "transparent"; ctx.clip();
    districts.forEach(points => fill(points,"#d9d3b4"));
    waters.forEach(water => fill(water.points,water.color));
    grid.forEach(points => stroke(points,"#54795b20",n*.001));
    streets.forEach(street => stroke(street.points,street.garden?"#c3d09b":"#faf1d8",Math.max(n*.0015,street.width/R*radius*.45)));
    if (large) {
      ctx.fillStyle = "#ad9a7a";
      for (const v of buildings) { const p=project(v); if(p.depth>.03)ctx.fillRect(p.x-2,p.y-2,4,4); }
    }
    ctx.setLineDash([n*.01,n*.006]); stroke(tramLine,"#ad604a",n*.004); ctx.setLineDash([]);
    const shade=ctx.createRadialGradient(c-radius*.3,c-radius*.4,radius*.1,c,c,radius);
    shade.addColorStop(0,"#fff9d91c");shade.addColorStop(.7,"#31534500");shade.addColorStop(1,"#234b465c");
    ctx.fillStyle=shade;ctx.fillRect(0,0,n,n);
    ctx.restore();
    const dot = (position: Position, color: string, size: number, label = "") => {
      const p = project(unit(position));
      if(p.depth<.015) return null;
      ctx.beginPath();ctx.arc(p.x,p.y,size,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();
      ctx.strokeStyle="#fff8e8";ctx.lineWidth=n*.003;ctx.stroke();
      if(label){ctx.fillStyle="#fffaf0";ctx.font=`600 ${n*.022}px "DM Sans", sans-serif`;ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(label,p.x,p.y+n*.001);}
      return p;
    };
    boatDocks.forEach(dock=>dot(dock,"#317f91",n*(large?.011:.012),large?"≈":""));
    if (large) stops.forEach(stop=>dot(stop,"#ad604a",n*.006));
    if (large) this.hits=[];
    places.forEach((place,index)=>{
      const active = large ? place.id===selected : place.id===state.waypoint;
      const p=dot(place,active?"#ce713e":state.visited.has(place.id)?"#426f56":"#74895d",n*(large?.022:active?.023:.016),large?String(index+1):"");
      if(large&&p)this.hits.push({id:place.id,x:p.x,y:p.y});
    });
    dot({x:state.tramX,z:-12},"#ad604a",n*.009);
    const player=dot(state,"#226d96",n*(large?.013:.025));
    if(player){
      const ahead=offset(state.x,state.z,Math.sin(state.heading)*4,Math.cos(state.heading)*4);
      const direction=project(unit(ahead)),angle=Math.atan2(direction.y-player.y,direction.x-player.x);
      ctx.save();ctx.translate(player.x,player.y);ctx.rotate(angle);
      ctx.beginPath();ctx.moveTo(n*.047,0);ctx.lineTo(n*.029,-n*.013);ctx.lineTo(n*.029,n*.013);ctx.closePath();ctx.fillStyle="#226d96";ctx.fill();ctx.restore();
    }
    // Keep a destination on the far side discoverable without plotting it on the near side.
    const waypoint=state.routeTarget??places.find(p=>p.id===state.waypoint);
    if(!large&&waypoint){
      const p=project(unit(waypoint));
      if(p.depth<.015){const angle=Math.atan2(p.y-c,p.x-c);ctx.save();ctx.translate(c+Math.cos(angle)*radius*.94,c+Math.sin(angle)*radius*.94);ctx.rotate(angle);ctx.beginPath();ctx.moveTo(n*.027,0);ctx.lineTo(-n*.014,-n*.02);ctx.lineTo(-n*.014,n*.02);ctx.closePath();ctx.fillStyle="#ce713e";ctx.fill();ctx.restore();}
    }
  }
}
