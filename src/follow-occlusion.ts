import * as T from "three";

interface TreeInstance {
  batch: T.InstancedMesh;
  index: number;
  matrix: T.Matrix4;
  inverse: T.Matrix4;
  bounds: T.Box3;
  sphere: T.Sphere;
  opacity: number;
  ghost?: T.Mesh<T.BufferGeometry, T.MeshStandardMaterial>;
}

// Fade only the trees between the camera and avatar. Their opaque shadow and
// collision remain in place, and the camera never moves to avoid foliage.
export class FollowOcclusion {
  private trees: TreeInstance[] = [];
  private pool: T.Mesh<T.BufferGeometry, T.MeshStandardMaterial>[] = [];
  private shadow = new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking });
  private hidden = new T.Matrix4().makeScale(0, 0, 0);
  private ray = new T.Ray();
  private localRay = new T.Ray();
  private bounds = new T.Box3();
  private closest = new T.Vector3();
  private hit = new T.Vector3();

  constructor(private parent: T.Group) {}

  add(batch: T.InstancedMesh, index: number, matrix: T.Matrix4) {
    if (!batch.geometry.boundingBox) batch.geometry.computeBoundingBox();
    const bounds = batch.geometry.boundingBox!;
    this.trees.push({
      batch,
      index,
      matrix: matrix.clone(),
      inverse: matrix.clone().invert(),
      bounds,
      sphere: bounds.getBoundingSphere(new T.Sphere()).applyMatrix4(matrix),
      opacity: 1,
    });
  }

  update(camera: T.Vector3, focus: T.Vector3, enabled: boolean, dt: number) {
    const length = camera.distanceTo(focus);
    this.ray.set(camera, this.closest.copy(focus).sub(camera).normalize());
    for (const tree of this.trees) {
      if (!enabled || !tree.batch.visible) {
        this.restore(tree);
        continue;
      }
      const blocked = this.blocks(tree, length);
      if (blocked && !tree.ghost) this.fade(tree);
      if (!tree.ghost) continue;
      tree.opacity = T.MathUtils.damp(
        tree.opacity, blocked ? 0.06 : 1, blocked ? 18 : 8, dt,
      );
      tree.ghost.material.opacity = tree.opacity;
      if (!blocked && tree.opacity > 0.985) this.restore(tree);
    }
  }

  private blocks(tree: TreeInstance, length: number) {
    const along = this.closest
      .copy(tree.sphere.center)
      .sub(this.ray.origin)
      .dot(this.ray.direction);
    this.ray.at(T.MathUtils.clamp(along, 0, length), this.closest);
    if (
      this.closest.distanceToSquared(tree.sphere.center) >
      (tree.sphere.radius + 0.5) ** 2
    )
      return false;
    this.localRay.copy(this.ray).applyMatrix4(tree.inverse);
    // Slight hysteresis prevents a tree from flashing at the edge of the view.
    this.bounds.copy(tree.bounds).expandByScalar(tree.ghost ? 0.35 : 0.15);
    if (this.bounds.containsPoint(this.localRay.origin)) return true;
    if (!this.localRay.intersectBox(this.bounds, this.hit)) return false;
    this.hit.applyMatrix4(tree.matrix);
    return this.hit.distanceTo(this.ray.origin) < length;
  }

  private fade(tree: TreeInstance) {
    let ghost = this.pool.pop();
    if (!ghost) {
      const source = tree.batch.material as T.MeshStandardMaterial;
      const material = source.clone();
      material.onBeforeCompile = source.onBeforeCompile;
      material.customProgramCacheKey = source.customProgramCacheKey;
      material.transparent = true;
      material.depthWrite = false;
      ghost = new T.Mesh(tree.batch.geometry, material);
      ghost.matrixAutoUpdate = false;
      ghost.castShadow = true;
      ghost.receiveShadow = true;
      ghost.customDepthMaterial = this.shadow;
      this.parent.add(ghost);
    }
    ghost.name = `follow-fade-${tree.batch.name}-${tree.index}`;
    ghost.geometry = tree.batch.geometry;
    ghost.matrix.copy(tree.matrix);
    ghost.matrixWorldNeedsUpdate = true;
    ghost.visible = true;
    tree.ghost = ghost;
    tree.batch.setMatrixAt(tree.index, this.hidden);
    tree.batch.instanceMatrix.needsUpdate = true;
  }

  private restore(tree: TreeInstance) {
    if (!tree.ghost) return;
    tree.batch.setMatrixAt(tree.index, tree.matrix);
    tree.batch.instanceMatrix.needsUpdate = true;
    tree.ghost.visible = false;
    tree.ghost.material.opacity = 1;
    this.pool.push(tree.ghost);
    tree.ghost = undefined;
    tree.opacity = 1;
  }
}
