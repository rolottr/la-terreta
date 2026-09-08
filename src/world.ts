import { inScienceBuilding, scienceBuildings } from "./science-layout";
import { BuildingCollision } from "./building-collision";
import { CityLife } from "./city-life";
import * as T from "three";
import { GLTFLoader } from "./gltf-loader";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
  Builder,
  basis,
  label,
  updateLabel,
  point,
  patch,
  ribbon,
  rng,
  seat,
  solid,
} from "./geometry";
import { C, R, docks, places, stops, wrap, distance } from "./data";
import { localOffset, offset } from "./navigation";
import {
  lots,
  routes,
  trees,
  distanceToPolarWalk,
  type Lot,
} from "./layout";
import { groundPatch, pathMesh, terrain } from "./terrain";
import { createBike, createPerson, createTram } from "./actors";
import { setPersonDetail, animateCharacter } from "./characters";
import { Procession } from "./procession";
import { Ground } from "./ground";
import { FootShadows } from "./foot-shadows";
import { FollowOcclusion } from "./follow-occlusion";
import { surface } from "./surface";
import { Wetland } from "./wetland";
import { StreetDetails } from "./street-details";
import { PeopleBehavior } from "./people-behavior";
import { StreetEvents } from "./street-events";
import { StreetReactions } from "./street-reactions";
import { beachContact, beachRunupArea, wadingFactor } from "./beach-water";
import { shallowWater } from "./local-sound";
import { waterAt, onJetty, onFootbridge, lagoonOutline, expanded, seaOutline, reserveAt } from "./wetland-layout";
import { placeCraft, batchCraftModels } from "./craft-models";
import { stationCollider } from "./landmark-collision";
import { CivicPlaza } from "./civic-plaza";
import { FieldLife } from "./field-life";
import { GardenFlowers } from "./garden-flowers";
export { createBike, createPerson } from "./actors";
export interface Collider {
  x: number;
  z: number;
  w: number;
  d: number;
  yaw?: number;
  radius?: number;
}

export class World {
  group = new T.Group();
  flowers = new GardenFlowers();
  colliders: Collider[] = [];
  private scienceCollisions: BuildingCollision[] = [];
  water: T.Mesh[] = [];
  flags: T.Object3D[] = [];
  markers: T.Group[] = [];
  clouds = new T.Group();
  tram = new T.Group();
  people: T.Group[] = [];
  bike = new T.Group();
  dockBikes: import("./parked-bikes").ParkedBike[] = [];
  ground = new Ground();
  followOcclusion = new FollowOcclusion(this.group);
  procession?: Procession;
  wetland!: Wetland;
  civic!: CivicPlaza;
  cityLife?: CityLife;
  details?: StreetDetails;
  behavior?: PeopleBehavior;
  events?: StreetEvents;
  reactions?: StreetReactions;
  readonly windowLight = { value: 0 };
  private lampMaterial = new T.MeshStandardMaterial({ color: "#e9c58a", emissive: "#ffc779", emissiveIntensity: 0 });
  private footShadows = new FootShadows(180);
  private chunks = new Map<string, Builder>();
  private random = rng(2026);
  private viewer = new T.Vector3();
  private distantView = true;
  private localizedSigns: (() => void)[] = [];
  refreshLabels() { this.localizedSigns.forEach(update => update()); this.cityLife?.refreshLabels(); }
  private modelGroups: {
    object: T.Object3D;
    distant?: T.Object3D;
    center: T.Vector3;
    radius: number;
  }[] = [];
  constructor(public scene: T.Scene) {
    scene.add(this.group);
    this.group.add(terrain());
    this.paths();
    this.civic = new CivicPlaza(this);
    this.districts();
    this.nature();
    this.transport();
    this.life();
    this.group.add(this.footShadows.mesh);
    for (const b of this.chunks.values()) b.finish(this.group);
    this.group.updateMatrixWorld(true);
    this.group.traverse((object) => {
      if (object instanceof T.Mesh && object.userData.walkable)
        this.ground.add(object.geometry, object.matrixWorld);
    });
  }
  add(b: Builder) {
    const key = `${Math.floor((wrap(b.x) + C / 2) / 52)}:${Math.floor((b.z + 158) / 40)}`;
    if (!this.chunks.has(key)) this.chunks.set(key, new Builder());
    this.chunks.get(key)!.pieces.push(...b.pieces);
    b.pieces = [];
  }
  paths() {
    // A slim tram route is one part of a much wider, branched walking network.
    this.group.add(ribbon(-C / 2, C / 2, -12, 4.1, "#b9b393", 0.13));
    for (const z of [-12.72, -11.28])
      this.group.add(ribbon(-C / 2, C / 2, z, 0.09, "#485b57", 0.21));
    for (let x = -C / 2; x < C / 2; x += 1.8) {
      const b = new Builder(x, -12);
      b.box(0, 0.13, 0, 0.22, 0.1, 2.1, "#8a7758");
      this.ground.addDeck(b.matrix, 0.22, 2.1, 0.18);
      this.add(b);
    }
    this.group.add(ribbon(-C / 2, C / 2, -6, 4, "#d8c99a", 0.08));
    this.group.add(ribbon(-C / 2, C / 2, 0, 3.2, "#d3c59e", 0.1));
    for (const route of routes)
      this.group.add(
        pathMesh(
          route.a,
          route.b,
          route.width,
          route.garden ? "#c5bd8b" : "#d8ccb0",
          0.09,
        ),
      );
  }
  districts() {
    for (const p of places) {
      if (!["albufera", "beach", "turia"].includes(p.id))
        this.group.add(groundPatch(p.x, p.z, 78, 88, "#c9b99b", 0.035, true));
      if (!["albufera", "beach"].includes(p.id)) this.group.add(
        groundPatch(
          p.x,
          p.z,
          (p.size || 10) * 2 + 7,
          24,
          "#e7d8b8",
          0.13,
          true,
        ),
      );
      const entry = p.id === "albufera" ? p : offset(p.x, p.z, 0, -15);
      const marker = new T.Group();
      const ring = new T.Mesh(
        new T.TorusGeometry(0.7, 0.045, 5, 28),
        new T.MeshBasicMaterial({ color: "#ffda81" }),
      );
      ring.rotation.x = Math.PI / 2;
      marker.add(ring);
      const gem = new T.Mesh(
        new T.OctahedronGeometry(0.16),
        new T.MeshBasicMaterial({ color: "#ffda81" }),
      );
      gem.position.y = 1.3;
      marker.add(gem);
      seat(marker, entry.x, entry.z, 0.14);
      this.group.add(marker);
      this.markers.push(marker);
      const sign = label(p.short.toUpperCase(), "#345d59", 3.2);
      this.localizedSigns.push(() => updateLabel(sign, p.short.toUpperCase(), "#345d59"));
      const signPos = offset(p.x, p.z, 6, p.id === "albufera" ? 0 : -14);
      seat(sign, signPos.x, signPos.z, 1.9, Math.PI);
      this.group.add(sign);
      if (p.id === "albufera" || p.id === "beach") continue;
      if (p.id === "townhall") continue;
      for (const side of [-1, 1]) {
        const loc = offset(p.x, p.z, side * 8, -16);
        placeCraft(this.group, "park_bench", loc.x, loc.z, .035, Math.PI);
        this.colliders.push({ ...loc, w: 1, d: 0.4 });
      }
      // Lanterns form a readable path into every district.
      for (let k = -1; k < 4; k++)
        for (const side of [-1, 1]) {
          const loc = offset(p.x, p.z, side * 4, -19 - k * 10);
          if (Math.abs(loc.z + 12) < 3) continue;
          if (inScienceBuilding(loc, .3)) continue;
          const b = new Builder(loc.x, loc.z);
          b.cylinder(0, 2.3, 0, 0.06, 4.6, "#34474b");
          b.cylinder(0, 0.2, 0, 0.17, 0.4, "#34474b");
          b.box(0, 4.65, 0, 0.48, 0.14, 0.48, "#34474b");
          this.add(b);
          this.colliders.push({...loc,w:.17,d:.17,radius:.17});
          const lamp = new T.Mesh(new T.BoxGeometry(.3,.55,.3),this.lampMaterial);
          lamp.name = "street-lantern";
          seat(lamp,loc.x,loc.z,4.33);this.group.add(lamp);
        }
      for (const side of [-1, 1])
        for (const row of [-25, -35]) {
          const loc = offset(p.x, p.z, side * 5.4, row);
          if (Math.abs(loc.z + 12) < 3.5) continue;
          this.flowers.addPlanters(loc.x, loc.z, 2.6);
        }
    }
    const sci = places[5];
    this.group.add(groundPatch(sci.x, sci.z, 37, 21, "#58c0ca", 0.145));
    this.group.add(groundPatch(sci.x, sci.z, 28, 12, "#eee7d5", 0.18));
  }
  nature() {
    this.wetland = new Wetland(this);
    new FieldLife(this);
    // Continuous dirt trail around the lagoon and along the coastal dunes.
    for(const poly of [expanded(lagoonOutline,7.5),expanded(seaOutline,11)])
      for(let i=0;i<poly.length;i++){
        const a=poly[i],b=poly[(i+1)%poly.length];
        if(!waterAt(a.x,a.z)&&!waterAt(b.x,b.z))this.group.add(pathMesh(a,b,1.25,"#c9bf93",.085,true));
      }
    const beach = places[7];
    for (let i = 0; i < 12; i++) {
      const loc = offset(
        beach.x,
        beach.z,
        ((i % 4) - 1.5) * 7,
        Math.floor(i / 4) * 7,
      );
      if (Math.abs(loc.z + 12) < 3.5 || waterAt(loc.x,loc.z)) continue;
      const yaw = [0, Math.PI, Math.PI / 2, -Math.PI / 2].find((angle) => {
        const chair = offset(loc.x, loc.z, 2 * Math.cos(angle), -2 * Math.sin(angle));
        return !waterAt(chair.x, chair.z) && docks.every((dock) => distance(dock, chair) > 3.4);
      }) ?? 0;
      placeCraft(this.group, `beach_set_${i % 2}`, loc.x, loc.z, 0, yaw);
    }
  }
  transport() {
    const shelterGlass = new T.MeshStandardMaterial({ color: "#b0c8bd", transparent: true, opacity: .18, roughness: .2, depthWrite: false, side: T.DoubleSide });
    for (const [i, s] of stops.entries()) {
      const stationStop = s.x === places[3].x;
      const shelterZ = stationStop ? -6.4 : -16;
      const backZ = shelterZ + (stationStop ? .9 : -.9);
      this.group.add(patch(s.x, stationStop ? -8 : -15, 14, 4, "#d8d1b6", 0.12));
      const b = new Builder(s.x, shelterZ);
      b.box(0, 3, 0, 8, 0.22, 2.6, "#547d75");
      for (const x of [-3.5, 3.5]) b.box(x, 1.5, 0, 0.12, 3, 0.12, "#40665f");
      const glass = new T.Mesh(new T.BoxGeometry(7, 2.4, .04), shelterGlass);
      seat(glass, s.x, backZ, 1.7); this.group.add(glass);
      b.box(0, 0.8, 0, 4, 0.15, 0.7, "#bfab83");
      this.add(b);
      this.colliders.push({ x: s.x, z: backZ, w: 3.5, d: 0.12 });
      this.colliders.push({ x: s.x, z: shelterZ, w: 2, d: .35 });
      for (const edge of [-3.5, 3.5])
        this.colliders.push({ x: s.x + edge, z: shelterZ, w: 0.12, d: 0.12 });
      const sg = label(`T${i + 1} · ${s.name}`, "#416a60", 5);
      this.localizedSigns.push(() => updateLabel(sg, `T${i + 1} · ${s.name}`, "#416a60"));
      seat(sg, s.x, backZ + (stationStop ? .2 : -.2), 2, stationStop ? Math.PI : 0);
      this.group.add(sg);
    }
    const station = places[3];
    for (const side of [-1, 1]) {
      const entrance = offset(station.x, station.z, side * 5.5, -10);
      this.group.add(pathMesh({ x: entrance.x, z: -8.7 }, entrance, 3.2, "#dfd3b7", .14));
    }
    for (const [dock, d] of docks.entries()) {
      placeCraft(this.group, "cycle_dock", d.x, d.z);
      this.colliders.push({ x: d.x, z: d.z, w: 2, d: 0.6 });
      for (let i = 0; i < 3; i++) {
        const bike = createBike();
        seat(bike, d.x - 1.3 + i * 1.3, d.z, 0.14, 0.3);
        this.group.add(bike);
        this.dockBikes.push({id: `valenbisi-${dock}-${i}`, x: d.x - 1.3 + i * 1.3, z: d.z, heading: .3, dock, object: bike});
      }
      const sg = label("VALENBISI", "#426f65", 2.6);
      seat(sg, d.x, d.z + 0.9, 1.85, Math.PI);
      this.group.add(sg);
    }
    this.tram = createTram();
    seat(this.tram, stops[0].x, -12, 0.23);
    this.tram.userData.x = stops[0].x;
    this.group.add(this.tram);
  }
  life() {
    for (let i = 0; i < 72; i++) {
      const place = places[i % places.length],
        loc = offset(place.x, place.z, (i % 2 ? -1 : 1) * (6 + Math.floor(i / 11) * 2.6), -22 - Math.floor(i / 22) * 7);
      if (reserveAt(loc.x,loc.z,2)) continue;
      const p = createPerson(i);
      p.userData = { ...loc, phase: this.random() * 7 };
      this.group.add(p);
      this.people.push(p);
    }
  }
  async models() {
    const loader = new GLTFLoader();
    const [landmarks, village, distantVillage] = await Promise.all([
      loader.loadAsync("/models/landmarks.glb"),
      loader.loadAsync("/models/village.glb"),
      loader.loadAsync("/models/village-lod.glb"),
    ]);
    const sources = new Map<string, T.Object3D>();
    let paintedAtlas: T.Texture | null = null;
    for (const gltf of [landmarks, village])
      gltf.scene.traverse((o) => {
        if (o.name) sources.set(o.name, o);
      });
    distantVillage.scene.traverse((o) => {
      if (o.name.endsWith("_lod")) sources.set(o.name, o);
    });
    for (const gltf of [landmarks, village])
      gltf.scene.traverse((o) => {
        if (o instanceof T.Mesh)
          for (const m of Array.isArray(o.material) ? o.material : [o.material])
            if ((m as T.MeshStandardMaterial).map)
              paintedAtlas ??= (m as T.MeshStandardMaterial).map;
      });
    const material = surface(
      new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.83 }),
      "paint",
    );
    const paintCompile = material.onBeforeCompile;
    material.onBeforeCompile = (shader, renderer) => {
      paintCompile.call(material, shader, renderer);
      shader.uniforms.paintedAtlas = { value: paintedAtlas };
      shader.uniforms.windowLight = this.windowLight;
      shader.vertexShader =
        "attribute float windowGlow; varying float vWindowGlow; attribute vec2 materialFinish; attribute float paintWeight; varying vec2 vMaterialFinish; varying float vPaintWeight; varying vec2 vPaintUv;\n" +
        shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvWindowGlow=windowGlow;vMaterialFinish=materialFinish;vPaintWeight=paintWeight;vPaintUv=uv;",
      );
      shader.fragmentShader =
        "uniform float windowLight; varying float vWindowGlow; uniform sampler2D paintedAtlas; varying vec2 vMaterialFinish; varying float vPaintWeight; varying vec2 vPaintUv;\n" +
        shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_fragment>",
        "#include <map_fragment>\ndiffuseColor.rgb*=mix(vec3(1.),texture2D(paintedAtlas,vPaintUv).rgb,vPaintWeight);",
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <roughnessmap_fragment>",
        "#include <roughnessmap_fragment>\nroughnessFactor=clamp(vMaterialFinish.x,.08,1.);",
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <metalnessmap_fragment>",
        "#include <metalnessmap_fragment>\nmetalnessFactor=clamp(vMaterialFinish.y,0.,1.);",
      );
      shader.fragmentShader = shader.fragmentShader.replace("#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.,.56,.22)*vWindowGlow*windowLight*.85;");
    };
    material.customProgramCacheKey = () => "valencia-model-finish-5";
    const geometryCache = new Map<string, T.BufferGeometry>();
    const bake = (name: string) => {
      if (geometryCache.has(name)) return geometryCache.get(name)!;
      const source = sources.get(name);
      if (!source) throw Error(`Missing Blender asset ${name}`);
      const pieces: T.BufferGeometry[] = [];
      source.updateWorldMatrix(true, true);
      const rootInverse = source.matrixWorld.clone().invert();
      source.traverse((o) => {
        if (!(o instanceof T.Mesh)) return;
        const g = o.geometry.index
          ? o.geometry.toNonIndexed()
          : o.geometry.clone();
        g.applyMatrix4(rootInverse.clone().multiply(o.matrixWorld));
        const c = new Float32Array(g.getAttribute("position").count * 3);
        const finish = new Float32Array(g.getAttribute("position").count * 2);
        const paint = new Float32Array(g.getAttribute("position").count);
        const glow = new Float32Array(paint.length);
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        const groups = g.groups.length
          ? g.groups
          : [
              {
                start: 0,
                count: g.getAttribute("position").count,
                materialIndex: 0,
              },
            ];
        for (const group of groups) {
          const mat = mats[group.materialIndex || 0] as T.MeshStandardMaterial,
            col = mat.color;
          for (let i = group.start; i < group.start + group.count; i++) {
            c[i * 3] = col.r;
            c[i * 3 + 1] = col.g;
            c[i * 3 + 2] = col.b;
            finish[i * 2] = mat.roughness;
            finish[i * 2 + 1] = mat.metalness;
            paint[i] = mat.map ? 1 : 0;
            glow[i] = /glass|window/i.test(mat.name) ? 1 : 0;
          }
        }
        g.setAttribute("color", new T.BufferAttribute(c, 3));
        g.setAttribute("materialFinish", new T.BufferAttribute(finish, 2));
        g.setAttribute("paintWeight", new T.BufferAttribute(paint, 1));
        g.setAttribute("windowGlow", new T.BufferAttribute(glow, 1));
        if (!g.getAttribute("uv"))
          g.setAttribute(
            "uv",
            new T.BufferAttribute(
              new Float32Array(g.getAttribute("position").count * 2),
              2,
            ),
          );
        g.deleteAttribute("tangent");
        g.clearGroups();
        pieces.push(g);
      });
      const merged = mergeGeometries(pieces);
      pieces.forEach((p) => p.dispose());
      // Seat the lowest parts on the curved ground; keep the upper silhouette.
      const positions = merged.getAttribute("position");
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i),
          y = positions.getY(i),
          z = positions.getZ(i);
        const weight = Math.max(0, 1 - Math.max(0, y) / 1.8);
        positions.setY(i, y - ((x * x + z * z) / (2 * R)) * weight);
      }
      merged.computeBoundingBox();
      merged.computeBoundingSphere();
      geometryCache.set(name, merged);
      return merged;
    };
    const model = (
      name: string,
      x: number,
      z: number,
      yaw = Math.PI,
      scale = 1,
    ) => {
      const mesh = new T.Mesh(bake(name), material);
      mesh.name = `landmark-${name}`;
      mesh.scale.setScalar(scale);
      seat(mesh, x, z, 0.14, yaw);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      this.modelGroups.push({ object: mesh, center: point(x, z), radius: 25 });
      return mesh;
    };
    await this.civic.load();
    for (const p of places)
      if (p.model && p.id !== "townhall") {
        const loc = p.id === "albufera" ? offset(p.x, p.z, 12, 0) : p;
        const landmark = model(p.model, loc.x, loc.z, Math.PI);
        if (p.id === "serranos")
          for (const side of [-1, 1])
            this.colliders.push({
              ...offset(p.x, p.z, side * 5, 0),
              w: 3.3,
              d: 3.1,
            });
        else if (p.id === "university") {
          for (const side of [-1, 1])
            this.colliders.push({
              ...offset(p.x, p.z, side * 8, 0),
              w: 2.1,
              d: 7.5,
            });
          this.colliders.push({ ...offset(p.x, p.z, 0, 5.6), w: 9, d: 2.1 });
          this.colliders.push({ ...offset(p.x, p.z, 0, -.8), w: .8, d: .8 });
          for (const side of [-1, 1]) for (const z of [-6.6,-4.7,-2.8,-.9,1,2.9])
            this.colliders.push({ ...offset(p.x,p.z,side*5.85,z),w:.32,d:.32 });
          for (const x of [-5.85,-3.9,-1.95,0,1.95,3.9,5.85])
            this.colliders.push({ ...offset(p.x,p.z,x,3.35),w:.32,d:.32 });
        } else if (p.id === "oldtown") {
          this.colliders.push({ ...loc, w: 3.5, d: 3.5, radius: 3.5 });
          this.colliders.push({
            ...offset(loc.x, loc.z, -7, 2),
            w: 6.2,
            d: 6.4,
          });
          for (const side of [-1, 1])
            this.colliders.push({
              ...offset(loc.x, loc.z, -(7 + side * 6), 4.5),
              w: 2.3,
              d: 2.3,
            });
        } else if (p.id === "aqua") {
          this.colliders.push({ ...loc, w: 9.25, d: 5.25 });
          for (const side of [-1, 1])
            this.colliders.push({
              ...offset(loc.x, loc.z, side * 2.55, -6.65),
              w: 0.18,
              d: 0.18,
            });
        } else if (p.id === "bullring") {
          // The open entry passes between the two grandstand halves.
          for (let i = 0; i < 72; i++) {
            const a = i * Math.PI * 2 / 72;
            if (Math.abs(Math.sin(a)) * 7.65 < 2.05) continue;
            const wall = offset(loc.x, loc.z, Math.sin(a) * 7.65, Math.cos(a) * 7.65);
            this.colliders.push({ ...wall, w: .49, d: 1.8, yaw: a });
          }
          // Gate posts and the two arcade piers that extend beyond the stands.
          for (const x of [-1.8, 1.8]) for (const z of [-8.8, 8.8])
            this.colliders.push({ ...offset(loc.x, loc.z, x, z), w: .22, d: .48 });
          for (const j of [13, 37]) {
            const a = j * Math.PI * 2 / 48;
            // GLB Z-up conversion plus the landmark's half-turn reverses X.
            this.colliders.push({ ...offset(loc.x, loc.z, -8.85 * Math.cos(a), 8.85 * Math.sin(a)), w: .35, d: .35, radius: .35 });
          }
        } else if (p.id === "station")
          this.colliders.push(stationCollider(loc));
        else if (p.id === "science")
          this.scienceCollisions.push(new BuildingCollision(landmark));
        else
          this.colliders.push({
            ...loc,
            w: p.id === "albufera" ? 3.2 : p.size || 10,
            d: 5.5,
          });
      }
    for (const building of scienceBuildings) {
      const landmark = model(building.model, building.x, building.z, Math.PI, building.scale);
      this.scienceCollisions.push(new BuildingCollision(landmark));
      const sign = label(building.name, "#345d59", 4.5);
      sign.material.side = T.FrontSide;
      const position = offset(building.x, building.z, 0, -building.d - 2.5);
      seat(sign, position.x, position.z, 1.8, Math.PI); this.group.add(sign);
    }
    const batches = new Map<string, Lot[]>();
    for (const lot of [...lots, ...trees]) {
      const key = `${lot.model}:${Math.floor((lot.x + C / 2) / 60)}:${Math.floor((lot.z + 158) / 50)}`;
      if (!batches.has(key)) batches.set(key, []);
      batches.get(key)!.push(lot);
    }
    for (const batch of batches.values()) {
      const mesh = new T.InstancedMesh(
        bake(batch[0].model),
        material,
        batch.length,
      );
      const distant = new T.InstancedMesh(
        bake(batch[0].model + "_lod"),
        material,
        batch.length,
      );
      mesh.name = batch[0].model;
      distant.name = batch[0].model + "_lod";
      const o = new T.Object3D();
      mesh.geometry.computeBoundingBox();
      batch.forEach((lot, i) => {
        const tree = ["orange_tree", "cypress", "palm"].includes(lot.model);
        const height = tree ? this.heightAt(lot.x,lot.z) - mesh.geometry.boundingBox!.min.y*lot.scale - .035 : .12;
        seat(o, lot.x, lot.z, height, lot.yaw);
        o.scale.setScalar(lot.scale);
        o.updateMatrix();
        mesh.setMatrixAt(i, o.matrix);
        distant.setMatrixAt(i, o.matrix);
        if (["orange_tree", "cypress", "palm"].includes(lot.model))
          this.followOcclusion.add(mesh, i, o.matrix);
      });
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      distant.castShadow = true;
      distant.receiveShadow = true;
      distant.computeBoundingSphere();
      distant.visible = false;
      this.group.add(mesh, distant);
      this.modelGroups.push({
        object: mesh,
        distant,
        center: mesh.boundingSphere!.center.clone(),
        radius: mesh.boundingSphere!.radius,
      });
    }
    for (const lot of lots)
      this.colliders.push({
        ...lot,
        w: lot.model === "cottage" ? 3 : 4.7,
        d: lot.model === "cottage" ? 3.8 : 4,
        yaw: lot.yaw,
      });
    for (const tree of trees)
      this.colliders.push({
        ...tree,
        w: 0.2 * tree.scale,
        d: 0.2 * tree.scale,
      });
    this.details = new StreetDetails(this);
    this.flowers.build(this);
    this.procession = new Procession(this);
    this.behavior = new PeopleBehavior(this);
    this.events = new StreetEvents(this);
    this.reactions = new StreetReactions(this);
    this.cityLife = new CityLife(this);
    batchCraftModels(this.group);
  }
  heightAt(x: number, z: number) {
    return this.ground.heightAt(x, z);
  }
  waterFactor(x: number, z: number, time = 0) {
    if(onJetty(x,z) || onFootbridge(x,z))return 1;
    const water=waterAt(x,z);
    if(water==="sea" || beachRunupArea(x,z)) {
      const contact=beachContact(x,z,time,this.heightAt(x,z),water);
      if(contact)return wadingFactor(contact.depth);
    }
    return water ? .48 : 1;
  }
  setView(x: number, z: number, globe: boolean) {
    this.flowers.setView(x, z, globe);
    const p = point(x, z);
    this.viewer.copy(p);
    this.distantView = globe;
    for (const group of this.modelGroups) {
      const visible = globe || p.distanceTo(group.center) < 100 + group.radius;
      group.object.visible = visible && (!globe || !group.distant);
      if (group.distant) group.distant.visible = globe;
    }
  }
  blocked(x: number, z: number, r = 0.45) {
    if (this.scienceCollisions.some(building => building.blocked(x, z, r))) return true;
    const bridge = onFootbridge(x,z);
    if(waterAt(x,z) && !onJetty(x,z) && !bridge && !shallowWater(x,z)) return true;
    const t = this.tram.userData;
    if (typeof t.x === "number") {
      const p = localOffset(x, z, t.x, -12);
      if (p.depth > -5 && Math.abs(p.x) < 6.8 + r && Math.abs(p.z) < 1.13 + r)
        return true;
    }
    for (const c of this.colliders) {
      if (Math.abs(z - c.z) > c.w + c.d + r + 2) continue;
      const p = localOffset(x, z, c.x, c.z);
      if (p.depth < -10) continue;
      if (c.radius) {
        if (Math.hypot(p.x, p.z) < c.radius + r) return true;
        continue;
      }
      const a = c.yaw || 0,
        xx = p.x * Math.cos(a) - p.z * Math.sin(a),
        zz = p.x * Math.sin(a) + p.z * Math.cos(a);
      if (Math.abs(xx) < c.w + r && Math.abs(zz) < c.d + r) return true;
    }
    return false;
  }
  setLampLevel(value: number) { this.windowLight.value = value; this.lampMaterial.emissiveIntensity = value * 1.7; }
  update(t: number, visited: Set<string>, player?: T.Group, processionTime = t) {
    for (const water of this.water)
      (water.material as T.ShaderMaterial).uniforms.time.value = t;
    this.markers.forEach((m, i) => {
      m.visible = !visited.has(places[i].id);
      m.children[1].position.y = 1.3 + Math.sin(t * 2 + i) * 0.15;
      m.children[1].rotation.y = t;
    });
    this.procession?.update(processionTime, this.viewer, this.distantView);
    const actors = [...this.people, ...(this.procession?.members.map(m => m.person) || [])];
    if (player) actors.push(player);
    this.footShadows.update(actors, this.ground);
  }
}
