import * as T from 'three';
import { distance, type SavedBike } from './data';
import { seat } from './geometry';
import { groundBike } from './bike';
import type { World } from './world';

export interface ParkedBike extends SavedBike { object: T.Group; dock?: number }
/** Keep each bicycle as one object through borrowing, parking and save reloads. */
export class ParkedBikes {
  available: ParkedBike[] = [];
  active?: ParkedBike;
  constructor(private world: World, saved: SavedBike[] = []) {
    for (const original of world.dockBikes) {
      const restored = saved.find(b => b.id === original.id);
      const bike = { ...original, ...restored, dock: restored ? (restored.dock === original.dock ? original.dock : undefined) : original.dock };
      this.place(bike);
      this.available.push(bike);
    }
  }
  private place(bike: ParkedBike) {
    seat(bike.object, bike.x, bike.z, this.world.heightAt(bike.x, bike.z) + .03, bike.heading);
    bike.object.getObjectByName('Valenbisi_Stand')!.rotation.x = 0;
    groundBike(bike.object, this.world.ground);
    bike.object.visible = true;
  }
  nearest(position: {x:number;z:number}, id?: string) {
    return this.available.filter(b => (!id || b.id === id) && distance(position, b) < (b.dock === undefined ? 2.8 : 5.5))
      .sort((a,b) => distance(position,a)-distance(position,b))[0];
  }
  borrow(bike: ParkedBike) {
    this.available.splice(this.available.indexOf(bike), 1);
    this.active = bike;
    bike.object.getObjectByName('Valenbisi_Stand')!.rotation.x = 1.35;
    return bike.object;
  }
  park(position: {x:number;z:number;heading:number}) {
    if (!this.active) return;
    const {x,z,heading} = position;
    Object.assign(this.active, {x,z,heading,dock: undefined});
    this.place(this.active);
    this.available.push(this.active);
    this.active = undefined;
  }
  saved(position: {x:number;z:number;heading:number}): SavedBike[] {
    const all = this.active ? [...this.available, {...this.active,x:position.x,z:position.z,heading:position.heading,dock:undefined}] : this.available;
    return all.map(({id,x,z,heading,dock}) => ({id,x,z,heading,dock}));
  }
}
