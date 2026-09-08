import * as T from "three";

function visible(object: T.Object3D) {
  for (let parent: T.Object3D | null = object; parent; parent = parent.parent)
    if (!parent.visible) return false;
  return true;
}

/** Check the actual subject, including obstructions close to it or around the camera. */
export function photoSubjectVisible(
  camera: T.PerspectiveCamera,
  world: T.Object3D,
  subject: T.Object3D | undefined,
  targets: T.Vector3[],
) {
  if (!subject || !visible(subject)) return false;
  camera.updateMatrixWorld(true);
  world.updateMatrixWorld(true);
  const origin = camera.getWorldPosition(new T.Vector3());
  const direction = camera.getWorldDirection(new T.Vector3());
  const ray = new T.Raycaster();
  const blocks = (object: T.Object3D) => {
    if (
      !(object instanceof T.Mesh) ||
      !visible(object) ||
      object.userData.walkable ||
      object.name === "foot-contact-shadows"
    )
      return false;
    for (let parent: T.Object3D | null = object; parent; parent = parent.parent)
      if (parent === subject) return false;
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    return materials.some(
      (material) => !material.transparent || material.opacity > 0.95,
    );
  };
  return targets.every((target) => {
    const projected = target.clone().project(camera);
    if (
      Math.abs(projected.x) > 0.92 ||
      Math.abs(projected.y) > 0.9 ||
      projected.z < 0 ||
      projected.z >= 1 ||
      target.clone().sub(origin).dot(direction) <= 0
    )
      return false;
    const length = origin.distanceTo(target);
    // A reverse ray also detects a camera inside an opaque actor. Only the
    // named landmark is excluded; nearby people and walls still count.
    for (const [from, to] of [
      [origin, target],
      [target, origin],
    ]) {
      ray.set(from, to.clone().sub(from).normalize());
      ray.near = 0.02;
      ray.far = Math.max(0.02, length - 0.02);
      if (ray.intersectObject(world, true).some((hit) => blocks(hit.object)))
        return false;
    }
    return true;
  });
}
