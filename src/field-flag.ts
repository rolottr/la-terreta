import * as T from "three";
import { GLTFLoader } from "./gltf-loader";
import { seat } from "./geometry";
import type { World } from "./world";

// Open grass between the southern farm plots, clear of crops and walking routes.
export const fieldFlagSite = { x: 35, z: -65 };

export class FieldFlag {
  private mixer: T.AnimationMixer;
  private duration: number;

  static async load(world: World) {
    const asset = await new GLTFLoader().loadAsync("/models/field-senyera.glb");
    return new FieldFlag(world, asset.scene, asset.animations);
  }

  private constructor(world: World, root: T.Group, clips: T.AnimationClip[]) {
    root.name = "Field Senyera";
    root.traverse(object => {
      if (!(object instanceof T.Mesh)) return;
      object.castShadow = true;
      object.receiveShadow = true;
      if (object.morphTargetInfluences) {
        // The authored cloth is thin and must be visible from both sides.
        // Keep its ground shadow without shadow-map stripes on the thin sheet.
        object.receiveShadow = false;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) material.side = T.DoubleSide;
        object.frustumCulled = false;
      }
    });
    const bottom = new T.Box3().setFromObject(root).min.y;
    seat(root, fieldFlagSite.x, fieldFlagSite.z,
      world.heightAt(fieldFlagSite.x, fieldFlagSite.z) - bottom - .03, -.35);
    world.group.add(root);
    world.colliders.push({ ...fieldFlagSite, w: 1.55, d: 1.55, radius: 1.55 });
    const clip = clips.find(candidate => candidate.tracks.some(track =>
      track.name.includes("morphTargetInfluences")));
    if (!clip) throw new Error("Field Senyera wind animation is missing");
    this.duration = clip.duration;
    this.mixer = new T.AnimationMixer(root);
    this.mixer.clipAction(clip).play();
  }

  update(time: number) {
    this.mixer.setTime(time % this.duration);
  }
}
