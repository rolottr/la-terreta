import * as T from "three";

/** Keep the follow camera on the player's side of a landmark wall. */
export class FollowWalls {
  private obstacles?: T.Object3D[];
  private ray = new T.Raycaster();
  private tram?: T.Object3D;
  constructor(private world: T.Group) {}

  limit(focus: T.Vector3, desired: T.Vector3, includeTram = true) {
    this.obstacles ??= this.findLandmarks();
    const direction = desired.clone().sub(focus);
    const length = direction.length();
    if (length < .01) return desired;
    this.ray.set(focus, direction.divideScalar(length));
    this.ray.near = .05;
    this.ray.far = length + .25;
    const obstacles = includeTram && this.tram ? [...this.obstacles, this.tram] : this.obstacles;
    const hit = this.ray.intersectObjects(obstacles, true)[0];
    let fraction = hit ? Math.max(.15, hit.distance - .3) / length : 1;
    if (includeTram && this.tram) {
      // The tram roof can cover the legs while the ray to the torso stays clear.
      // Test the soles too, then shorten the same camera arm.
      const lower = focus.clone().addScaledVector(focus.clone().normalize(), -1.4);
      const lowerDirection = desired.clone().sub(lower);
      const lowerLength = lowerDirection.length();
      this.ray.set(lower, lowerDirection.divideScalar(lowerLength));
      this.ray.far = lowerLength + .25;
      const lowerHit = this.ray.intersectObject(this.tram, true)[0];
      if (lowerHit) fraction = Math.min(fraction, Math.max(.15, lowerHit.distance - .4) / lowerLength);
    }
    if (fraction >= 1) return desired;
    return focus.clone().addScaledVector(direction, length * fraction);
  }

  private findLandmarks() {
    const result: T.Object3D[] = [];
    this.world.traverse(object => {
      if (object.name.startsWith("landmark-")) result.push(object);
      if (object.name === "Valencia tram with passenger interior") this.tram = object;
    });
    return result;
  }
}
