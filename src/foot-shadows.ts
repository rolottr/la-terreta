import * as T from "three";
import { R } from "./data";
import type { Ground } from "./ground";
import { footPositions } from "./characters";

export class FootShadows {
  mesh: T.InstancedMesh;
  private transform = new T.Object3D();

  constructor(count: number) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    const fade = ctx.createRadialGradient(32, 32, 5, 32, 32, 32);
    fade.addColorStop(0, "rgba(23, 31, 21, 0.65)");
    fade.addColorStop(0.45, "rgba(23, 31, 21, 0.3)");
    fade.addColorStop(1, "rgba(23, 31, 21, 0)");
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, 64, 64);
    const geometry = new T.PlaneGeometry(1, 1);
    geometry.rotateX(-Math.PI / 2);
    this.mesh = new T.InstancedMesh(geometry, new T.MeshBasicMaterial({
      map: new T.CanvasTexture(canvas),
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    }), count * 2);
    this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.name = "foot-contact-shadows";
  }

  update(actors: T.Group[], ground: Ground) {
    const required = actors.length * 2;
    if (required > this.mesh.instanceMatrix.count) {
      // Residents can be added after the world constructor loads the landmarks.
      // Release the old instance buffer before replacing it with enough room.
      this.mesh.dispose();
      const capacity = T.MathUtils.ceilPowerOfTwo(required);
      this.mesh.instanceMatrix = new T.InstancedBufferAttribute(new Float32Array(capacity * 16), 16);
      this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    }
    let index = 0;
    for (const actor of actors) {
      if (!actor.visible) continue;
      for (const sole of footPositions(actor)) {
        const t = this.transform;
        t.position.copy(sole);
        t.position.normalize().multiplyScalar(R + ground.heightAlong(t.position) + 0.004);
        t.quaternion.copy(actor.quaternion);
        t.scale.set(actor.visible ? 0.23 : 0, 1, 0.36);
        t.updateMatrix();
        this.mesh.setMatrixAt(index++, t.matrix);
      }
    }
    this.mesh.count = index;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
