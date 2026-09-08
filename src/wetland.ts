import { moveBird } from './bird-navigation';
import { distance, type SavedBoat } from "./data";
import { waterShapes, shoreShapes } from "./wetland-shapes";
import { boatWake } from "./boat-wake";
import * as T from "three";
import { GLTFLoader } from "./gltf-loader";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { Builder, point, rng, seat } from "./geometry";
import { offset, advance, localOffset } from "./navigation";
import { createWater } from "./water";
import { shoreMesh } from "./wetland-mesh";
import {
  boatDocks,
  expanded,
  islands,
  lagoonOutline,
  seaOutline,
  channelOutline,
  waterAt,
  navigable,
  onJetty,
  inside,
  edgeDistance,
} from "./wetland-layout";
import { placeCraft } from "./craft-models";
import type { World } from "./world";

const templates = new Map<string, T.Mesh>();
export async function loadWetland() {
  await Promise.all(
    ["boat", "duck", "duck-female", "fish", "reeds", "coot", "egret", "heron"].map(async (name) => {
      const { scene } = await new GLTFLoader().loadAsync(
        `/models/wetland/${name}.glb`,
      );
      scene.updateMatrixWorld(true);
      const parts: T.BufferGeometry[] = [];
      const oars = new Map<number, T.BufferGeometry[]>();
      scene.traverse((o) => {
        if (!(o instanceof T.Mesh)) return;
        const g = o.geometry.index
          ? o.geometry.toNonIndexed()
          : o.geometry.clone();
        g.applyMatrix4(o.matrixWorld);
        const mat = o.material as T.MeshStandardMaterial;
        const colors = new Float32Array(g.getAttribute("position").count * 3);
        for (let i = 0; i < colors.length; i += 3) mat.color.toArray(colors, i);
        g.setAttribute("color", new T.BufferAttribute(colors, 3));
        for (const key of Object.keys(g.attributes))
          if (!["position", "normal", "color"].includes(key))
            g.deleteAttribute(key);
        const side =
          name === "boat" && /Oar_(shaft|blade)/.test(o.name)
            ? o.name.endsWith("-1")
              ? -1
              : 1
            : 0;
        if (side) {
          if (!oars.has(side)) oars.set(side, []);
          oars.get(side)!.push(g);
        } else parts.push(g);
      });
      const mesh = new T.Mesh(
        mergeGeometries(parts),
        new T.MeshStandardMaterial({
          vertexColors: true,
          roughness: name === "fish" ? 0.35 : 0.72,
          side: T.DoubleSide,
        }),
      );
      parts.forEach((g) => g.dispose());
      for (const [side, pieces] of oars) {
        const geometry = mergeGeometries(pieces);
        geometry.translate(-side * 0.95, -0.69, -0.6);
        const paddle = new T.Mesh(geometry, mesh.material);
        paddle.position.set(side * 0.95, 0.69, 0.6);
        paddle.name = "paddle";
        paddle.userData.side = side;
        paddle.castShadow = true;
        mesh.add(paddle);
        pieces.forEach((g) => g.dispose());
      }
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      templates.set(name, mesh);
    }),
  );
}
function asset(name: string) {
  const template = templates.get(name);
  if (!template) throw Error(`Missing wetland asset: ${name}`);
  return template.clone();
}
export class Wetland {
  readonly boats = boatDocks.map(dock => ({
    object: asset("boat"),
    mooring: { ...dock.launch, heading: dock.yaw, speed: 0 },
    landing: { x: dock.x, z: dock.endZ },
  }));
  activeBoat = 0;
  get boat() { return this.boats[this.activeBoat].object; }
  get mooring() { return this.boats[this.activeBoat].mooring; }
  nearbyBoat(position: { x: number; z: number }) {
    return this.boats.findIndex(boat => distance(position, boat.landing) < 4.5);
  }
  parkBoat(pose: { x: number; z: number; heading: number }, landing: { x: number; z: number }) {
    const boat = this.boats[this.activeBoat];
    boat.mooring = { x: pose.x, z: pose.z, heading: pose.heading, speed: 0 };
    boat.landing = { ...landing };
  }
  savedBoats(): SavedBoat[] {
    return this.boats.map((boat, index) => ({ id: boatDocks[index].id,
      x: boat.mooring.x, z: boat.mooring.z, heading: boat.mooring.heading,
      landX: boat.landing.x, landZ: boat.landing.z }));
  }
  restoreBoats(saved: SavedBoat[]) {
    for (const entry of saved) {
      const index = boatDocks.findIndex(dock => dock.id === entry.id);
      const landing = { x: entry.landX, z: entry.landZ };
      if (index < 0 || distance(entry, landing) > 7 ||
        waterAt(landing.x, landing.z) && !onJetty(landing.x, landing.z) ||
        this.world.blocked(landing.x, landing.z, .45)) continue;
      const clear = [-2.9, 0, 2.9].every(metres => {
        const p = advance(entry.x, entry.z, entry.heading, 0, Math.sign(metres), Math.abs(metres));
        return navigable(p.x, p.z, .85);
      });
      if (!clear) continue;
      this.boats[index].mooring = { x: entry.x, z: entry.z, heading: entry.heading, speed: 0 };
      this.boats[index].landing = landing;
    }
  }
  readonly stroke = {phase: 0, power: 0};
  private lastTime = 0;
  private ducks: { object: T.Mesh; x: number; z: number; phase: number; position: {x:number;z:number}; yaw: number }[] = [];
  private waders: {object:T.Mesh; x:number; z:number; phase:number; position:{x:number;z:number}; yaw:number}[] = [];
  private fish: { object: T.Mesh; x: number; z: number; phase: number }[] = [];
  private ripples: T.Mesh[] = [];
  private reeds: T.InstancedMesh;
  private reedPlacements: {
    x: number;
    z: number;
    yaw: number;
    scale: number;
  }[] = [];
  private lastReedTick = -1;
  private wake = boatWake();
  private random = rng(93071);
  constructor(private world: World) {
    const group = world.group;
    for (const [outline, color, height] of [
      [expanded(lagoonOutline, 5.5), "#87975b", 0.012],
      [expanded(lagoonOutline, 1.8), "#a8ac7c", 0.028],
      [expanded(seaOutline, 10), "#e5cb93", 0.035],
      [expanded(seaOutline, 2.4), "#b4b18a", 0.05],
    ] as const)
      for (const [edge, ...holes] of shoreShapes(outline))
        group.add(shoreMesh(edge, color, height, holes));
    for (const outline of islands)
      group.add(shoreMesh(outline, "#8d9d59", 0.23));
    for (const [outline, ...holes] of waterShapes) {
      const mesh = createWater(outline, true, holes);
      world.water.push(mesh);
      group.add(mesh);
    }
    group.add(this.wake);
    // Planks follow the planet instead of forming a flat slab above it.
    for (const dock of boatDocks) for (let z = Math.min(dock.landZ,dock.endZ); z <= Math.max(dock.landZ,dock.endZ); z += 0.48) {
      const b = new Builder(dock.x, z);
      world.ground.addDeck(b.matrix, 2.8, 0.43, 0.37);
      const posts = Math.round((z - Math.min(dock.landZ, dock.endZ)) / 0.48) % 5 === 0;
      placeCraft(group, posts ? "jetty_post_board" : "jetty_board", dock.x, z);
    }
    // A low footbridge keeps the sandy coastal trail connected across the gola.
    for (let z = -58; z >= -72; z -= 0.5) {
      const b = new Builder(-236, z);
      placeCraft(group, "bridge_board", -236, z);
      world.ground.addDeck(b.matrix, 2.9, 0.46, 0.39);
    }
    this.boats.forEach((boat, index) => {
      seat(boat.object, boat.mooring.x, boat.mooring.z, .14, boat.mooring.heading);
      boat.object.name = `Albufera rowing boat · ${boatDocks[index].name}`;
      group.add(boat.object);
    });
    const reedTemplate = asset("reeds");
    for (const poly of [lagoonOutline, ...islands])
      for (let i = 0; i < poly.length; i += 2) {
        const p = poly[i];
        for (let j = 0; j < 3; j++) {
          const loc = offset(
            p.x,
            p.z,
            (this.random() - 0.5) * 2.2,
            (this.random() - 0.5) * 2.2,
          );
          if (boatDocks.some(dock => Math.abs(loc.x-dock.x) < 3 && loc.z > Math.min(dock.landZ,dock.endZ)-5 && loc.z < Math.max(dock.landZ,dock.endZ)+5)) continue;
          this.reedPlacements.push({
            ...loc,
            yaw: this.random() * 6.28,
            scale: 0.65 + this.random() * 0.65,
          });
        }
      }
    this.reeds = new T.InstancedMesh(
      reedTemplate.geometry,
      reedTemplate.material,
      this.reedPlacements.length,
    );
    this.reeds.castShadow = true;
    this.reeds.receiveShadow = true;
    group.add(this.reeds);
    const centers = [
      { x: -111, z: -38 },
      { x: -143, z: -46 },
      { x: -185, z: -69 },
      { x: -112, z: -70 },
    ];
    for (let i = 0; i < 32; i++) {
      const center = centers[Math.floor(i / 8)],
        loc = offset(center.x, center.z, ((i % 5) - 2) * 1.5, (i % 3) * 1.2);
      const species = i >= 20 ? "coot" : i % 3 === 0 ? "duck-female" : "duck";
      const object = asset(species);
      object.name = species;
      if(species !== "coot") object.scale.setScalar(.62);
      group.add(object);
      this.ducks.push({ object, ...loc, phase: i * 1.77, position: {...loc}, yaw: i });
      const ripple = new T.Mesh(
        new T.RingGeometry(0.23, 0.25, 32),
        new T.MeshBasicMaterial({
          color: "#c1d7ad",
          transparent: true,
          opacity: 0.27,
          side: T.DoubleSide,
          depthWrite: false,
        }),
      );
      ripple.geometry.rotateX(-Math.PI / 2);
      ripple.renderOrder = 3;
      group.add(ripple);
      this.ripples.push(ripple);
    }
    for (const [i,p] of lagoonOutline.entries()) {
      if(i % 4 !== 0)continue;
      const center={x:-150,z:-55};
      const inward=localOffset(center.x,center.z,p.x,p.z);
      const length=Math.hypot(inward.x,inward.z);
      const loc=offset(p.x,p.z,inward.x/length*1.6,inward.z/length*1.6);
      if(!waterAt(loc.x,loc.z)||onJetty(loc.x,loc.z)||this.boats.some(b=>distance(loc,b.mooring)<6))continue;
      const object=asset(i%8===0?"egret":"heron");object.name=i%8===0?"Little egret":"Grey heron";
      group.add(object);this.waders.push({object,...loc,phase:i,position:{...loc},yaw:i});
    }
    for (let i = 0; i < 32; i++) {
      const c = centers[Math.floor(i / 8)],
        loc = offset(c.x, c.z, ((i % 8) - 3) * 0.8, 3 + (i % 3) * 0.7);
      const object = asset("fish");
      object.castShadow = false;
      group.add(object);
      this.fish.push({ object, ...loc, phase: i * 0.94 });
    }
    // Low dunes and native scrub break up the sand without hiding its width.
    for (let i = 0; i < seaOutline.length; i += 4) {
      const p = expanded(seaOutline, 6)[i];
      if (inside(p, lagoonOutline) || waterAt(p.x, p.z)) continue;
      placeCraft(group, "coastal_dune", p.x, p.z);
    }
  }
  update(
    time: number,
    boatPose?: { x: number; z: number; heading: number; speed: number; rowingPower?: number },
  ) {
    const dt = T.MathUtils.clamp(time-this.lastTime,0,.1); this.lastTime = time;
    const pose = boatPose ?? this.mooring;
    for (const [index, boat] of this.boats.entries()) {
      if (index === this.activeBoat) continue;
      seat(boat.object, boat.mooring.x, boat.mooring.z,
        .15 + Math.sin(time * 1.8 + index) * .025, boat.mooring.heading);
    }
    this.stroke.power = T.MathUtils.damp(this.stroke.power, boatPose?.rowingPower ?? 0, 8, dt);
    if (this.stroke.power > .02) this.stroke.phase += dt*2.7*this.stroke.power;

    seat(
      this.boat,
      pose.x,
      pose.z,
      0.15 + Math.sin(time * 1.8) * 0.025,
      pose.heading,
    );
    this.boat.rotateZ(Math.sin(time * 1.2) * 0.009);
    for (const paddle of this.boat.children) {
      const side = paddle.userData.side;
      const stroke = Math.sin(this.stroke.phase) * this.stroke.power;
      paddle.rotation.y = side * stroke * 0.20;
      paddle.rotation.z =
        side * (.06 - Math.cos(this.stroke.phase) * .085 * this.stroke.power);
    }
    seat(this.wake, pose.x, pose.z, 0.2, pose.heading);
    this.wake.material.uniforms.strength.value = Math.min(
      0.3,
      Math.abs(pose.speed) * 0.065,
    );
    this.wake.visible = Math.abs(pose.speed) > 0.1;
    const boatPoses=this.boats.map((boat,index)=>index===this.activeBoat?pose:boat.mooring);
    for (const [i, d] of this.ducks.entries()) {
      const a = time * 0.065 + d.phase;
      const target=offset(d.x,d.z,Math.cos(a)*2,Math.sin(a)*1.4);
      const next=moveBird(d.position,target,boatPoses,dt,i);
      const movement=localOffset(next.x,next.z,d.position.x,d.position.z);
      if(Math.hypot(movement.x,movement.z)>.00001){
        const heading=Math.atan2(movement.x,movement.z);
        d.yaw+=Math.atan2(Math.sin(heading-d.yaw),Math.cos(heading-d.yaw))*(1-Math.exp(-dt*5));
      }
      d.position=next;
      seat(d.object,next.x,next.z,.07+Math.sin(time*2+d.phase)*.008,d.yaw);
      seat(this.ripples[i],next.x,next.z,.195);
      this.ripples[i].scale.set(1+Math.sin(time*1.7+d.phase)*.12,1,1.5);
    }
    for(const bird of this.waders){
      const target=offset(bird.x,bird.z,Math.sin(time*.12+bird.phase)*.45,Math.cos(time*.12+bird.phase)*.3);
      const next=moveBird(bird.position,target,boatPoses,dt,bird.phase);
      const movement=localOffset(next.x,next.z,bird.position.x,bird.position.z);
      if(Math.hypot(movement.x,movement.z)>.002){
        const heading=Math.atan2(movement.x,movement.z);
        bird.yaw+=Math.atan2(Math.sin(heading-bird.yaw),Math.cos(heading-bird.yaw))*(1-Math.exp(-dt*3));
      }
      bird.position=next;
      seat(bird.object,next.x,next.z,.08,bird.yaw);
      // Slow feeding dips, with a small side-to-side weight shift as they wade.
      bird.object.rotateX(Math.max(0,Math.sin(time*.7+bird.phase))*.12);
      bird.object.rotateZ(Math.sin(time*2+bird.phase)*.014);
    }
    for (const f of this.fish) {
      const a = time * 0.22 + f.phase,
        p = offset(f.x, f.z, Math.cos(a) * 2.5, Math.sin(a) * 1.2);
      seat(
        f.object,
        p.x,
        p.z,
        -0.13,
        Math.atan2(-Math.sin(a) * 2.5, Math.cos(a) * 1.2),
      );
      f.object.rotateY(Math.sin(time * 9 + f.phase) * 0.1);
    }
    const tick = Math.floor(time * 12);
    if (tick !== this.lastReedTick) {
      this.lastReedTick = tick;
      const o = new T.Object3D();
      this.reedPlacements.forEach((p, i) => {
        seat(o, p.x, p.z, 0.05, p.yaw);
        o.scale.setScalar(p.scale);
        o.rotateZ(Math.sin(time * 1.2 + p.x * 0.5 + p.z * 0.4) * 0.045);
        o.updateMatrix();
        this.reeds.setMatrixAt(i, o.matrix);
      });
      this.reeds.instanceMatrix.needsUpdate = true;
    }
  }
}
