import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const temporary = await mkdtemp(join(tmpdir(), 'valencia-movement-'));
try {
  const output = join(temporary, 'movement.mjs');
  await build({ entryPoints: ['src/locomotion.ts'], bundle: true, platform: 'node', format: 'esm', outfile: output });
  const { Locomotion, RUN_SPEED, BIKE_SPEED, angleDelta } = await import(pathToFileURL(output));
  const cameraOutput = join(temporary, 'camera-height.mjs');
  await build({ entryPoints: ['src/camera-height.ts'], bundle: true, platform: 'node', format: 'esm', outfile: cameraOutput });
  const { CameraHeight } = await import(pathToFileURL(cameraOutput));
  const mountOutput = join(temporary, 'bike-mount.mjs');
  await build({ entryPoints: ['src/bike-mount.ts'], bundle: true, platform: 'node', format: 'esm', outfile: mountOutput });
  const { findBikeMount } = await import(pathToFileURL(mountOutput));
  const stationOutput = join(temporary, 'station-collision.mjs');
  await build({ entryPoints: ['src/landmark-collision.ts'], bundle: true, platform: 'node', format: 'esm', outfile: stationOutput });
  const { stationCollider } = await import(pathToFileURL(stationOutput));
  const navigationOutput = join(temporary, 'navigation.mjs');
  await build({ entryPoints: ['src/navigation.ts'], bundle: true, platform: 'node', format: 'esm', outfile: navigationOutput });
  const { localOffset } = await import(pathToFileURL(navigationOutput));
  const buildingOutput = join(temporary, 'building-collision.mjs');
  await build({ stdin: { contents: 'export {BuildingCollision} from "./src/building-collision"; export {seat} from "./src/geometry";', resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', outfile: buildingOutput });
  const { BuildingCollision, seat } = await import(pathToFileURL(buildingOutput));
  // A real mesh arch must keep its entrance clear, including after placement and scale.
  for (const location of [{ x: 246, z: 45, scale: .8, yaw: Math.PI }, { x: 310, z: 120, scale: 1, yaw: .7 }]) {
    const parts = [
      new T.BoxGeometry(.25, 3, 4).translate(-3, 1.5, 0),
      new T.BoxGeometry(.25, 3, 4).translate(3, 1.5, 0),
      new T.BoxGeometry(6, .2, 4).translate(0, 3.1, 0),
      new T.BoxGeometry(7, .2, 5).translate(0, .1, 0),
    ];
    const mesh = new T.Mesh(mergeGeometries(parts));
    mesh.scale.setScalar(location.scale);seat(mesh, location.x, location.z, .14, location.yaw);
    const collision = new BuildingCollision(mesh);
    const at = (x, z) => {
      const p = mesh.localToWorld(new T.Vector3(x, 0, z));
      return { x: Math.atan2(p.x, p.y) * 100, z: Math.atan2(p.z, Math.hypot(p.x, p.y)) * 100 };
    };
    for (const radius of [.4, .7]) {
      for (let z = -3; z <= 3; z += .25) {
        const p = at(0, z);assert.equal(collision.blocked(p.x, p.z, radius), false, 'Walk and bike through the opening below the roof');
      }
      const support = at(3, 0);assert.equal(collision.blocked(support.x, support.z, radius), true, 'Visible arch supports stay solid');
      const corner = at(4.2, 3.2);assert.equal(collision.blocked(corner.x, corner.z, radius), false, 'An empty bounding-box corner is passable');
    }
    assert.equal(collision.blocked(location.x - Math.PI * 100, -location.z, .7), false, 'Buildings do not block the opposite hemisphere');
    mesh.geometry.dispose();parts.forEach(p => p.dispose());
  }
  const origin = { x: 0, z: 0, yaw: 0, heading: 0 };
  const idle = { right: 0, forward: 0, bike: false, terrain: 1 };
  const clear = () => false;
  function simulate(controller, pose, input, seconds, fps = 60, blocked = clear) {
    let result = { ...pose }, distance = 0;
    for (let i = 0; i < seconds * fps; i++) {
      result = controller.step(result, { ...idle, ...input }, 1 / fps, blocked);
      distance += result.distance;
      assert.ok(Object.values(result).every(Number.isFinite), 'Movement must remain finite');
    }
    return { ...result, travelled: distance };
  }

  const straight = simulate(new Locomotion(), origin, { forward: 1 }, 2);
  const diagonal = simulate(new Locomotion(), origin, { forward: 1, right: 1 }, 2);
  assert.ok(Math.abs(straight.travelled - diagonal.travelled) < .001, 'Diagonals must not be faster');
  assert.ok(Math.abs(straight.speed - RUN_SPEED) < .01);
  const angled = simulate(new Locomotion(), { ...origin, yaw: .37, heading: .37 }, { forward: 1 }, 1);
  assert.ok(Math.abs(Math.atan2(angled.x, angled.z) - .37) < .002, 'The camera must support headings between keyboard diagonals');
  const acrossWrap = new Locomotion().step({ ...origin, yaw: -Math.PI + .02, heading: Math.PI - .02 },
    { ...idle, forward: 1 }, 1 / 60, clear);
  assert.ok(Math.abs(angleDelta(acrossWrap.heading, Math.PI - .02)) < .05, 'Turning across pi must use the short direction');

  const walker = new Locomotion();
  const walking = simulate(walker, origin, { forward: 1 }, 1);
  const corner = walker.step(walking, { ...idle, right: 1 }, 1 / 60, clear);
  assert.ok(corner.z > walking.z && corner.x < walking.x, 'A turn must blend both directions');
  assert.ok(Math.abs(angleDelta(corner.heading, walking.heading)) < .18, 'Body must not snap 90 degrees');
  const sideways = simulate(walker, corner, { right: 1 }, 1);
  assert.ok(Math.abs(angleDelta(sideways.heading, sideways.yaw - Math.PI / 2)) < .03);
  const stopped = simulate(walker, sideways, {}, 1);
  assert.ok(stopped.travelled > .02 && stopped.speed < .02, 'Release must decelerate to a stop');

  const parked = simulate(new Locomotion(), origin, { bike: true, right: 1 }, 1);
  assert.equal(parked.travelled, 0, 'Steering alone must not move a parked bike');
  const bike = new Locomotion();
  const riding = simulate(bike, origin, { bike: true, forward: 1 }, 1);
  const turning = bike.step(riding, { ...idle, bike: true, forward: 1, right: 1 }, 1 / 60, clear);
  assert.ok(Math.abs(angleDelta(turning.heading, riding.heading)) < .04, 'Steering must build gradually');
  const arc = simulate(bike, turning, { bike: true, forward: 1, right: 1 }, 1);
  assert.ok(angleDelta(arc.heading, riding.heading) < -.3 && arc.x < riding.x, 'Right steering must make a right arc');
  const brakingController = new Locomotion(), coastController = new Locomotion();
  const brakeStart = simulate(brakingController, origin, { bike: true, forward: 1 }, 2);
  const coastStart = simulate(coastController, origin, { bike: true, forward: 1 }, 2);
  const braked = simulate(brakingController, brakeStart, { bike: true, forward: -1 }, .5);
  const coasted = simulate(coastController, coastStart, { bike: true }, .5);
  assert.ok(braked.travelled < coasted.travelled / 2 && braked.signedSpeed > 0 && braked.speed < BIKE_SPEED * .035,
    'S must brake before reversing, faster than coasting');
  const reversing = simulate(brakingController, braked, { bike: true, forward: -1 }, 1);
  assert.ok(reversing.signedSpeed < -1 && reversing.z < braked.z, 'Holding S must reverse after braking');
  const forwardAgain = simulate(brakingController, reversing, { bike: true, forward: 1 }, 2);
  assert.ok(forwardAgain.signedSpeed > 5, 'W must brake reverse travel and then pedal forwards');

  for (const fps of [30, 60, 120]) {
    const reverseController = new Locomotion();
    const reverse = simulate(reverseController, origin, { bike: true, forward: -1 }, 1, fps);
    assert.ok(reverse.z < -2.5 && reverse.signedDistance < 0 && reverse.speed <= 4.5,
      'Reverse must clear at least 2.5 m in one second and keep signed wheel travel');
    assert.ok(Math.abs(reverse.heading) < .001 && Math.abs(reverse.yaw) < .001,
      'Reversing must not turn the bike or camera around');
    const reverseTurn = simulate(new Locomotion(), origin, { bike: true, forward: -1, right: 1 }, 1, fps);
    assert.ok(reverseTurn.heading > .1 && reverseTurn.z < -1, 'Reverse steering must turn in the opposite direction');
    const reverseStop = simulate(reverseController, reverse, { bike: true }, 4, fps);
    assert.equal(reverseStop.speed, 0, 'Releasing reverse must stop the bike');
    const reverseWall = (_x, z) => z < -1;
    const hit = simulate(new Locomotion(), origin, { bike: true, forward: -1 }, 2, fps, reverseWall);
    assert.ok(hit.z >= -1 && hit.speed > .5 && hit.signedDistance < 0, 'Reverse must slide without crossing collisions');
    const stuckController = new Locomotion();
    const wallAhead = (_x, z) => z > 1;
    const stuck = simulate(stuckController, origin, { bike: true, forward: 1 }, 2, fps, wallAhead);
    const escaped = simulate(stuckController, stuck, { bike: true, forward: -1 }, 1, fps, wallAhead);
    assert.ok(escaped.signedSpeed < -.5, 'S must brake and reverse a bike after contact');
  }

  const wall = (_x, z) => z > 1;
  const dock = (x, z, r) => Math.abs(x) < 2 + r && Math.abs(z) < .6 + r;
  const dockEdge = { ...origin, z: 1.05 };
  assert.equal(dock(dockEdge.x, dockEdge.z, .4), false);
  assert.equal(dock(dockEdge.x, dockEdge.z, .7), true);
  assert.equal(simulate(new Locomotion(), dockEdge, { bike: true, forward: 1 }, .5, 60, dock).travelled, 0,
    'The old pickup position reproduces the stuck bike');
  for (const start of [dockEdge, { ...origin, z: 2, heading: Math.PI, yaw: Math.PI }]) {
    const mount = findBikeMount(start, dock);
    assert.ok(mount && !dock(mount.x, mount.z, .7), 'Pickup must leave room for the bike');
    for (const fps of [30, 60, 120]) {
      assert.ok(simulate(new Locomotion(), mount, { bike: true, forward: 1 }, .5, fps, dock).travelled > 1.5,
        'The bike must ride away from the dock, including when the player faced it');
    }
  }
  assert.deepEqual(findBikeMount(origin, clear), origin, 'Clear pickup must preserve the position and heading');
  assert.equal(findBikeMount(origin, () => true), undefined, 'Pickup must fail safely when there is no room');
  const enclosure = (x, z, r) => Math.abs(x) < 1.2 + r && Math.abs(z) < 1.2 + r &&
    (Math.abs(x) > 1.2 - r || Math.abs(z) > 1.2 - r);
  assert.equal(findBikeMount(origin, enclosure), undefined, 'Pickup must not cross a wall to find a departure path');
  const station = { x: 156, z: 7 };
  const stationBox = stationCollider(station);
  const stationBlocked = (x, z, radius) => {
    const local = localOffset(x, z, stationBox.x, stationBox.z);
    return Math.abs(local.x) < stationBox.w + radius && Math.abs(local.z) < stationBox.d + radius;
  };
  assert.equal(stationBlocked(station.x, station.z - 6, .7), false,
    'The visible forecourt at Estació del Nord must stay open for a bicycle');
  assert.equal(stationBlocked(station.x, station.z - 3, .4), true,
    'The station façade must still stop a walking player');
  const againstWall = simulate(new Locomotion(), origin, { forward: 1 }, 3, 60, wall);
  assert.ok(againstWall.z <= 1 && againstWall.speed < .02, 'A blocked walker must stop its gait');
  const slide = simulate(new Locomotion(), origin, { forward: 1, right: 1 }, 3, 60, wall);
  assert.ok(slide.z <= 1 && slide.x < -2, 'Walking must slide along a wall');
  const metrics = [];
  for (const fps of [30, 60, 120]) {
    const walk = simulate(new Locomotion(), origin, { forward: 1 }, 3, fps);
    const slow = simulate(new Locomotion(), origin, { forward: .5 }, 3, fps);
    const ride = simulate(new Locomotion(), origin, { forward: 1, bike: true }, 3, fps);
    assert.ok(Math.abs(walk.speed - RUN_SPEED) < .01 && Math.abs(slow.speed - RUN_SPEED / 2) < .01);
    assert.ok(Math.abs(ride.speed - BIKE_SPEED) < .1, 'The bicycle must reach its faster travel speed');
    const contact = simulate(new Locomotion(), origin, { forward: 1, bike: true }, 3, fps, wall);
    assert.ok(contact.z <= 1 && contact.speed > 3 && contact.travelled > 12,
      'Head-on contact must turn the bicycle along the wall and keep it moving');
    const post = (x, z, radius) => Math.hypot(x, z - 5) < 1 + radius;
    let postPose = origin, postDistance = 0, minimumContactSpeed = Infinity;
    const postController = new Locomotion();
    for (let frame = 0; frame < 3 * fps; frame++) {
      postPose = postController.step(postPose, { ...idle, forward: 1, bike: true }, 1 / fps, post);
      assert.equal(post(postPose.x, postPose.z, .7), false, 'A bicycle must stay outside a post at every frame');
      postDistance += postPose.distance;
      if (frame > fps / 2) minimumContactSpeed = Math.min(minimumContactSpeed, postPose.speed);
    }
    assert.ok(postPose.z > 8 && postDistance > 20 && minimumContactSpeed > 3,
      'A bicycle must deflect around a post without stopping');
    const height = new CameraHeight();
    height.step(.2, 0, true);
    let maximumBump = 0;
    for (let frame = 0; frame < fps * 2; frame++) {
      const value = height.step(.2 + .12 * Math.sin(frame / fps * 30), 1 / fps);
      maximumBump = Math.max(maximumBump, Math.abs(value - .2));
    }
    assert.equal(maximumBump, 0, 'Small paving changes must not move the camera height');
    let deckHeight;
    for (let frame = 0; frame < fps; frame++) deckHeight = height.step(1.2, 1 / fps);
    assert.ok(deckHeight > 1 && deckHeight < 1.05, 'The camera must ease onto higher decks');
    assert.equal(height.step(3, 1 / fps, true), 3, 'A teleport must reset camera ground height');
    metrics.push({ fps, walk: walk.travelled.toFixed(3), slow: slow.travelled.toFixed(3),
      bike: ride.travelled.toFixed(3), wall: contact.travelled.toFixed(3), post: postDistance.toFixed(3),
      contactMinSpeed: minimumContactSpeed.toFixed(3), cameraBump: maximumBump, cameraDeck: deckHeight.toFixed(6) });
  }
  console.table(metrics);
  for (const cycling of [false, true]) {
    const results = [30, 60, 120].map(fps => simulate(new Locomotion(), origin,
      { forward: 1, right: 1, bike: cycling }, 3, fps));
    for (const result of results.slice(1)) {
      assert.ok(Math.hypot(result.x - results[0].x, result.z - results[0].z) < .025, 'Frame rates must give the same route');
      assert.ok(Math.abs(angleDelta(result.heading, results[0].heading)) < .01);
    }
  }
  // The world radius is read from the same source, without browser state.
  const { readFile } = await import('node:fs/promises');
  const data = await readFile('src/data.ts', 'utf8');
  const radius = Number(data.match(/export const R = (\d+)/)[1]);
  const pole = simulate(new Locomotion(), { ...origin, z: radius * Math.PI / 2 - .3 }, { forward: 1 }, 2);
  assert.ok(pole.travelled > 3, 'Movement must continue over a pole');
  bike.reset();
  assert.equal(simulate(bike, origin, { bike: true }, 1).travelled, 0, 'Recovery must clear momentum');
  const selfieOutput=join(temporary,'selfie.mjs');
  await build({stdin:{contents:'export * from "./src/selfie"; export {normalizeAppearance} from "./src/appearance";',resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile:selfieOutput});
  const {selfieFrame,normalizeAppearance}=await import(pathToFileURL(selfieOutput));
  for(const aspect of [.45,.8,1,2]) for(const pitch of [-.45,.28,1.15]) for(const zoom of [.75,1,2.5]) for(const lift of [-.6,0,.7]) {
    const frame=selfieFrame(196,-67,.14,1.4,aspect,pitch,zoom,lift);
    assert.ok(frame.position.length()>=radius+.14+.45-1e-8,'Selfie lens stays above curved ground at every control limit');
    assert.ok(frame.position.distanceTo(frame.target)>.5,'Selfie view direction stays valid');
  }
  const legacy=normalizeAppearance({skin:'#abcdef',glasses:true});
  assert.equal(legacy.eyes,'#644b31'); assert.equal(legacy.hat,true);
  const appearance={...legacy,eyes:'#52724c',hairstyle:'full',hat:false,freckles:true};
  assert.deepEqual(normalizeAppearance(JSON.parse(JSON.stringify(appearance))),appearance,'New appearance choices survive a save round trip');
  console.log('PASS: smooth turns, equal diagonal speed, release, steering, braking, collisions, bike pickup clearance and departure, station forecourt, wall sliding, 30/60/120 FPS, poles, reset, selfie lens bounds and appearance save compatibility.');
} finally {
  await rm(temporary, { recursive: true, force: true });
}
