/** Ignore small paving changes; ease the view onto sustained slopes and decks. */
export class CameraHeight {
  private height: number | undefined;

  step(ground: number, dt: number, snap = false) {
    if (this.height === undefined || snap) this.height = ground;
    else {
      const difference = ground - this.height;
      // Keep curbs and gaps below 16 cm out of the view. Larger elevation
      // changes move both the camera and its aim point by the same amount.
      const change = Math.sign(difference) * Math.max(0, Math.abs(difference) - .16);
      this.height += change * (1 - Math.exp(-4 * dt));
    }
    return this.height;
  }
}
