import * as T from "three";
import { GLTFLoader } from "./gltf-loader";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import type { Ground } from "./ground";
import { disposeAppearance } from "./appearance";
import { cycleRig, groundRig, locomotionRig, refresh, updateFeet, type CharacterRig, type SolePoint } from "./character-rig";

export type PlayerGender = "male" | "female";
export type CharacterClip = "Idle" | "Walk" | "Run" | "Cycle" | "March" | "Sit" | "Row" | "Talk" | "Watch" | "Drink" | "Serve" | "Dance" | "OpenAwning";
const residentNames = ["teal", "coral", "blue", "rose", "ochre", "sage", "navy", "ivory", "plum", "olive", "terracotta", "slate"].map(name => `resident_${name}`);
const names = ["hero_male", "hero_female", ...residentNames,
  "fallera_blue", "fallera_rose", "fallero", "band_trumpet", "band_trombone", "band_tuba",
  "band_clarinet", "band_snare", "band_bass", "band_cymbals"];
const templates = new Map<string, { model: T.Object3D; clips: T.AnimationClip[] }>();
const rigs = new WeakMap<T.Group, CharacterRig>();
let loading: Promise<void> | undefined;
let count = 0;

export function loadCharacters() {
  return loading ??= new GLTFLoader().loadAsync("/models/characters.glb").then(({ scene, animations }) => {
    for (const name of names) {
      const model = scene.getObjectByName(name);
      if (!model) throw new Error(`Missing character: ${name}`);
      const clips = animations.filter((clip) => clip.name.startsWith(name + "_"));
      if (clips.length < 6) throw new Error(`Missing animation clips: ${name} (${clips.map(c => c.name)})`);
      if (name.startsWith("resident_") && !(Number.isFinite(model.userData.heightScale) && model.userData.heightScale > .8 && model.userData.heightScale < 1.2))
        throw new Error(`Missing or invalid resident height: ${name}`);
      templates.set(name, { model, clips });
    }
  });
}

export function createCharacter(name: string) {
  const source = templates.get(name);
  if (!source) throw new Error(`Character library is not ready: ${name}`);
  const person = new T.Group(); person.name = name;
  const model = clone(source.model); person.add(model);
  const detail = model.getObjectByName(`${name}_detail`)!, distant = model.getObjectByName(`${name}_distant`)!;
  if (!detail || !distant) throw new Error(`Missing character geometry: ${name}`);
  distant.visible = false;
  const skins: T.SkinnedMesh[] = [], bones = new Map<string, T.Bone>();
  const soles: [SolePoint[], SolePoint[]] = [[], []];
  model.traverse((object) => {
    if (object instanceof T.Bone) bones.set(object.name.slice(name.length + 1), object);
    if (object instanceof T.SkinnedMesh) {
      skins.push(object); object.castShadow = object.receiveShadow = true;
      object.boundingSphere = new T.Sphere(new T.Vector3(0, 1, 0), 1.7);
    }
  });
  detail.traverse((object) => {
    if (!(object instanceof T.SkinnedMesh)) return;
    const positions = object.geometry.getAttribute("position"), seen = new Set<string>();
    for (let i = 0; i < positions.count; i++) {
      // Use the tread and its lower bevel, not the decorative welt above it.
      if (positions.getY(i) > .0041) continue;
      const key = [positions.getX(i), positions.getY(i), positions.getZ(i)].map(n => n.toFixed(5)).join();
      if (seen.has(key)) continue;
      seen.add(key); soles[positions.getX(i) > 0 ? 1 : 0].push({ mesh: object, index: i });
    }
  });
  if (soles.some(points => !points.length)) throw new Error(`Missing character soles: ${name}`);
  for (const points of soles) points.sort((a, b) =>
    a.mesh.geometry.getAttribute("position").getZ(a.index) -
    b.mesh.geometry.getAttribute("position").getZ(b.index));
  const mixer = new T.AnimationMixer(model), actions = new Map<string, T.AnimationAction>();
  for (const clip of source.clips) actions.set(clip.name.slice(name.length + 1), mixer.clipAction(clip));
  const animatedPose = [...bones.values()].map(bone => ({ bone, position: bone.position.clone(), quaternion: bone.quaternion.clone(), scale: bone.scale.clone() }));
  const restPose = animatedPose.map(pose=>({...pose,position:pose.position.clone(),quaternion:pose.quaternion.clone(),scale:pose.scale.clone()}));
  const rig: CharacterRig = { model, detail, distant, skins, bones, animatedPose, restPose, soles, feet: [new T.Vector3(), new T.Vector3()],
    mixer, actions, restFeet: [new T.Quaternion(), new T.Quaternion()], clip: "", seed: ++count * .731 };
  person.updateMatrixWorld(true);
  rig.restFeet = [bones.get("Foot_L")!.getWorldQuaternion(new T.Quaternion()), bones.get("Foot_R")!.getWorldQuaternion(new T.Quaternion())];
  rigs.set(person, rig);
  person.userData.character = name;
  person.userData.animation = "Idle";
  return person;
}

export function createHero(gender: PlayerGender) { return createCharacter(`hero_${gender}`); }
export function createPerson(i = 0) {
  const person = createCharacter(residentNames[((i % residentNames.length) + residentNames.length) % residentNames.length]);
  const model = person.children[0];
  person.scale.setScalar(model.userData.heightScale);
  return person;
}
export function getCharacterRig(person: T.Group) { return rigs.get(person)!; }
export function releaseCharacter(person: T.Group) {
  const rig = rigs.get(person); if (!rig) return;
  rig.mixer.stopAllAction(); rig.mixer.uncacheRoot(rig.model);
  disposeAppearance(person);
  rigs.delete(person);
}
export function setPersonDetail(person: T.Group, detailed: boolean) {
  const rig = rigs.get(person)!; rig.detail.visible = detailed; rig.distant.visible = !detailed;
}
export function footPositions(person: T.Group) { return rigs.get(person)!.feet; }

function restoreRestPose(rig: CharacterRig) {
  for(const [i,rest] of rig.restPose.entries()) {
    rest.bone.position.copy(rest.position);rest.bone.quaternion.copy(rest.quaternion);rest.bone.scale.copy(rest.scale);
    const cached=rig.animatedPose[i];cached.position.copy(rest.position);cached.quaternion.copy(rest.quaternion);cached.scale.copy(rest.scale);
  }
}

export function animateCharacter(person: T.Group, time: number, clip: CharacterClip, ground?: Ground, speed = 1, cyclePhase?: number) {
  const rig = rigs.get(person)!;
  const dt = rig.lastTime === undefined ? 0 : T.MathUtils.clamp(time - rig.lastTime, 0, .15);
  rig.lastTime = time; rig.model.position.y = 0;
  if (rig.clip !== clip) {
    const rowing = rig.clip === "Row" || clip === "Row";
    if (rig.clip === "Locomotion" || rowing) rig.mixer.stopAllAction();
    if (rowing) { restoreRestPose(rig); rig.action=undefined; }
    const next = rig.actions.get(clip);
    if (!next) throw new Error(`Missing character pose: ${person.name}/${clip}`);
    const fade = clip === "Sit" || rig.clip === "Sit" ? .5 : .25;
    rig.action?.fadeOut(fade); next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1);
    if (!rowing) next.fadeIn(fade);
    next.play();
    rig.action = next; rig.clip = clip;
  }
  // Restore the last sampled pose before IK. AnimationMixer may skip writing
  // a constant track; last frame's ground correction must not become its input.
  for (const pose of rig.animatedPose) {
    pose.bone.position.copy(pose.position); pose.bone.quaternion.copy(pose.quaternion); pose.bone.scale.copy(pose.scale);
  }
  rig.action!.timeScale = cyclePhase === undefined ? speed : 0;
  if (cyclePhase !== undefined) rig.action!.time = ((cyclePhase / (Math.PI * 2)) % 1 + 1) % 1 * rig.action!.getClip().duration;
  rig.mixer.update(dt);
  rig.model.rotation.z = T.MathUtils.damp(rig.model.rotation.z, 0, 10, dt);
  for (const pose of rig.animatedPose) {
    pose.position.copy(pose.bone.position); pose.quaternion.copy(pose.bone.quaternion); pose.scale.copy(pose.bone.scale);
  }
  person.userData.animation = clip;
  for (const skin of rig.skins) {
    const smile = skin.morphTargetDictionary?.Smile;
    if (smile !== undefined && skin.morphTargetInfluences) skin.morphTargetInfluences[smile] = 0;
    const curl = skin.morphTargetDictionary?.RelaxedHands;
    if (curl !== undefined && skin.morphTargetInfluences)
      skin.morphTargetInfluences[curl] = clip === "Run" || clip === "Cycle" ? .9 : .55;
  }
  for (const skin of rig.skins) {
    const blink = skin.morphTargetDictionary?.Blink;
    if (blink === undefined || !skin.morphTargetInfluences) continue;
    const t = (time + rig.seed) % 4.3;
    skin.morphTargetInfluences[blink] = t < .14 ? Math.sin(t / .14 * Math.PI) : 0;
  }
  if (clip === "Cycle") cycleRig(person, rig, cyclePhase ?? rig.action!.time / rig.action!.getClip().duration * Math.PI * 2);
  else if (ground && rig.detail.visible) groundRig(person, rig, ground, clip === "Idle", clip === "Run");
  else { refresh(person, rig); updateFeet(rig); }
}

/** Blend idle, walk and run on one stride phase, driven by actual travel speed. */
export function animateLocomotion(person: T.Group, time: number, speed: number, turnRate: number, ground: Ground) {
  const rig = rigs.get(person)!;
  const dt = rig.lastTime === undefined ? 0 : T.MathUtils.clamp(time - rig.lastTime, 0, .15);
  rig.lastTime = time;
  rig.model.position.y = 0;
  const idle = rig.actions.get("Idle")!, walk = rig.actions.get("Walk")!, run = rig.actions.get("Run")!;
  if (rig.clip !== "Locomotion") {
    rig.mixer.stopAllAction();
    restoreRestPose(rig);
    for (const action of [idle, walk, run]) action.reset().play();
    rig.gait = { phase: rig.seed % 1, move: 0, run: 0 };
    rig.clip = "Locomotion";
  }
  const gait = rig.gait!;
  gait.move = T.MathUtils.damp(gait.move, T.MathUtils.smoothstep(speed, .02, .45), 14, dt);
  gait.run = T.MathUtils.damp(gait.run, T.MathUtils.smoothstep(speed, 1.8, 3.4), 8, dt);
  // These travel distances match the foot contact intervals of the Blender clips.
  const cycleDistance = T.MathUtils.lerp(.58, .72, gait.run) / T.MathUtils.lerp(.60, .23, gait.run) * person.getWorldScale(new T.Vector3()).y;
  gait.phase = (gait.phase + speed * dt / cycleDistance) % 1;
  idle.setEffectiveWeight(1 - gait.move).setEffectiveTimeScale(1);
  walk.setEffectiveWeight(gait.move * (1 - gait.run)).setEffectiveTimeScale(0);
  run.setEffectiveWeight(gait.move * gait.run).setEffectiveTimeScale(0);
  walk.time = gait.phase * walk.getClip().duration;
  run.time = gait.phase * run.getClip().duration;
  for (const pose of rig.animatedPose) {
    pose.bone.position.copy(pose.position);
    pose.bone.quaternion.copy(pose.quaternion);
    pose.bone.scale.copy(pose.scale);
  }
  rig.mixer.update(dt);
  for (const pose of rig.animatedPose) {
    pose.position.copy(pose.bone.position);
    pose.quaternion.copy(pose.bone.quaternion);
    pose.scale.copy(pose.bone.scale);
  }
  const lean = T.MathUtils.clamp(-turnRate * speed * .012, -.10, .10);
  rig.model.rotation.z = T.MathUtils.damp(rig.model.rotation.z, lean, 10, dt);
  rig.action = gait.run > .5 ? run : walk;
  person.userData.animation = speed < .04 ? "Idle" : gait.run > .5 ? "Run" : "Walk";
  person.userData.gait = { ...gait };
  for (const skin of rig.skins) {
    const smile = skin.morphTargetDictionary?.Smile;
    if (smile !== undefined && skin.morphTargetInfluences) skin.morphTargetInfluences[smile] = 0;
    const curl = skin.morphTargetDictionary?.RelaxedHands;
    if (curl !== undefined && skin.morphTargetInfluences)
      skin.morphTargetInfluences[curl] = T.MathUtils.lerp(.55, .9, gait.run);
  }
  for (const skin of rig.skins) {
    const blink = skin.morphTargetDictionary?.Blink;
    if (blink === undefined || !skin.morphTargetInfluences) continue;
    const t = (time + rig.seed) % 4.3;
    skin.morphTargetInfluences[blink] = t < .14 ? Math.sin(t / .14 * Math.PI) : 0;
  }
  if (rig.detail.visible) locomotionRig(person, rig, ground);
  else { refresh(person, rig); updateFeet(rig); }
}

// Keep the existing public pose entry points for the game and local QA tools.
export function posePerson(person: T.Group, phase: number, stride: number, ground: Ground) {
  animateCharacter(person, phase / 9, stride < .015 ? "Idle" : stride > .5 ? "Run" : "Walk", ground,
    stride < .015 ? 1 : stride > .5 ? 1.7 : 1.3);
}
export function poseCyclist(person: T.Group, phase: number) {
  animateCharacter(person, phase / 4, "Cycle");
}
