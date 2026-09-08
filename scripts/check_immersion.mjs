import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
const dir = await mkdtemp(join(tmpdir(), "valencia-immersion-"));
try {
  const path = join(dir, "logic.mjs");
  await build({
    stdin: {
      contents:
        'export * from "./src/activity-catalogue";export * from "./src/environment";export * from "./src/data";export * from "./src/street-events";export * from "./src/ground";export * from "./src/geometry";export * from "./src/audio-loop";export * from "./src/photo-request";export {groundSound} from "./src/local-sound";export {onFootbridge} from "./src/wetland-layout";export * as THREE from "three";',
      resolveDir: process.cwd(),
    },
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: path,
  });
  const m = await import(pathToFileURL(path));
  const clock = new m.EnvironmentClock();
  clock.step(400, false);
  assert.equal(clock.elapsed, 0);
  clock.step(540, true);
  assert.equal(clock.values.phase, "Sunset");
  clock.step(1000, true);
  assert.equal(clock.elapsed, 1200);
  assert.equal(clock.values.phase, "Evening");
  clock.step(100, true);
  assert.equal(clock.elapsed, 1200);
  const before = m.environmentAt(1019.99),
    after = m.environmentAt(1020.01);
  assert.ok(Math.abs(before.sunIntensity - after.sunIntensity) < 0.001);
  assert.ok(Math.abs(before.lamps - after.lamps) < 0.001);
  const schedule = new m.EventSchedule();
  schedule.step(1, 19, ["cat"], false);
  assert.equal(schedule.active, null);
  schedule.step(0, 19, ["cat"], true);
  assert.equal(schedule.active.kind, "cat");
  schedule.step(2, 21, ["dance"], false);
  assert.equal(schedule.active.elapsed, 0);
  schedule.step(2, 21, ["dance"], true);
  assert.equal(schedule.active.kind, "cat");
  assert.equal(schedule.active.elapsed, 2);
  schedule.finish(30);
  assert.ok(schedule.next >= 75 && schedule.next <= 120);
  schedule.next = 32;
  schedule.step(1, 33, ["cat"], true);
  assert.equal(schedule.active, null);
  schedule.step(1, 34, ["dance"], true);
  assert.equal(schedule.active.kind, "dance");
  let stored = {
    visited: ["serranos", "oldtown", "invalid"],
    bikeTrip: true,
    tramTrip: true,
    x: 104.7,
    z: -12,
    character: "female",
  };
  globalThis.localStorage = { getItem: () => JSON.stringify(stored) };
  const migrated = m.readSave();
  assert.deepEqual(migrated.visited, ["serranos", "oldtown"]);
  assert.equal(migrated.character, "female");
  assert.equal(migrated.bikeTrip, true);
  assert.equal(migrated.tramTrip, true);
  assert.equal(migrated.z, -8.5);
  assert.deepEqual(migrated.memories, []);
  assert.deepEqual(migrated.boats, [], "Older saves start with boats at the jetties");
  assert.equal(migrated.dayElapsed, 0);
  stored = {
    ...migrated,
    memories: ["horchata", "horchata", "unknown", "roof-terrace"],
    dayElapsed: Infinity,
    x: 21,
    z: 81,
  };
  const tasks = m.normalizeActivities({progress:{bike:Infinity,rowing:-3,band:4,oranges:99},picked:['grove-0','grove-0','unknown']},['horchata','procession','orange-clearing','photograph']);
  assert.equal(tasks.progress.horchata,8);assert.equal(tasks.progress.band,10);
  assert.equal(tasks.progress.oranges,1);assert.equal(tasks.progress.bike,0);assert.equal(tasks.progress.falla,0);assert.equal(tasks.progress.rowing,0);
  const oldBike=m.normalizeActivities({progress:{bike:100},completed:['bike']});
  assert.equal(oldBike.progress.bike,100,'Keep the distance earned under the old target');
  assert.equal(oldBike.completed.includes('bike'),false,'100 metres is not a kilometre');
  assert.equal(m.addProgress(oldBike,'bike',899),false);
  assert.equal(m.addProgress(oldBike,'bike',1),true);
  stored={...migrated,bikes:[{id:'valenbisi-0-0',x:12,z:3,heading:1},{id:'bad',x:Infinity,z:0,heading:0}]};
  const savedBikes=m.readSave().bikes;
  assert.equal(savedBikes.length,1);assert.ok(Math.abs(savedBikes[0].x-12)<1e-10);
  assert.equal(savedBikes[0].id,'valenbisi-0-0');assert.equal(savedBikes[0].z,3);assert.equal(savedBikes[0].heading,1);
  const partial=m.normalizeActivities({progress:{bike:12.34,rowing:6.78,band:4.56},picked:['grove-1']});
  assert.equal(partial.progress.bike,12.34);assert.equal(partial.progress.rowing,6.78);assert.equal(partial.progress.band,4.56);
  assert.equal(m.addProgress(partial,'bike',0),false);assert.equal(m.addProgress(partial,'bike',NaN),false);
  assert.equal(m.addProgress(partial,'bike',987.66),true);assert.equal(m.addProgress(partial,'bike',1),false);
  assert.equal(partial.completed.filter(id=>id==='bike').length,1);
  stored={...migrated,version:3,x:104.7,z:-12,activities:partial};assert.equal(m.readSave().z,-12,'Version 3 is not a pre-version-2 tram save');
  stored={...migrated,memories:['horchata','horchata','unknown','roof-terrace'],dayElapsed:Infinity,x:21,z:81};
  const loaded = m.readSave();
  assert.deepEqual(loaded.memories, ["horchata", "roof-terrace"]);
  assert.equal(loaded.dayElapsed, 0);
  assert.equal(loaded.z, 81);
  const savedBoat = { id: "el-palmar", x: -98, z: -82.7, heading: Math.PI, landX: -102.3, landZ: -85.5 };
  stored.boats = [savedBoat, { ...savedBoat, x: null }, { ...savedBoat, landZ: "shore" }, null];
  assert.deepEqual(m.readSave().boats, [savedBoat], "Keep parked boats and reject invalid coordinates");
  assert.equal(m.blocksHeightStep(0.012, 0.37), false);
  assert.equal(m.blocksHeightStep(0.05, 0.39), false);
  assert.equal(m.blocksHeightStep(0.14, 3.1), true);
  assert.equal(m.blocksHeightStep(1.2, 1.4), false);
  // The elevated terrace and the underwater sand shelf must both be sampled.
  const ground = new m.Ground(),
    frame = new m.THREE.Object3D();
  m.seat(frame, 21, 81);
  frame.updateMatrix();
  ground.addDeck(frame.matrix, 8, 8, 3.1);
  assert.ok(ground.heightAt(21, 81) > 3.09);
  const low = new m.Ground();
  m.seat(frame, -247, -40);
  frame.updateMatrix();
  low.addDeck(frame.matrix, 4, 4, -0.1);
  assert.ok(Math.abs(low.heightAt(-247, -40) + 0.1) < 0.001);
  assert.equal(m.onFootbridge(-236, -65), true);
  assert.equal(
    m.groundSound({ heightAt: () => 0.39 }, { x: -236, z: -65 }),
    "wood",
  );
  const ramp = Float32Array.from({ length: 1000 }, (_, i) => i / 1000);
  const blended = m.blendLoopSamples(ramp, 100);
  assert.equal(blended.length, 900);
  assert.ok(
    Math.abs(blended.at(-1) - blended[0]) < 0.002,
    "Loop boundary must be adjacent head samples",
  );
  assert.deepEqual(
    m.blendLoopSamples(new Float32Array([0.1, 0.2]), 50),
    new Float32Array([0.1, 0.2]),
  );
  const scene = new m.THREE.Group(),
    camera = new m.THREE.PerspectiveCamera(60, 1, 0.08, 100);
  camera.position.set(0, 0, 5);
  camera.lookAt(0, 0, 0);
  const subject = new m.THREE.Mesh(
    new m.THREE.BoxGeometry(2, 2, 2),
    new m.THREE.MeshBasicMaterial(),
  );
  scene.add(subject);
  const targets = [
    new m.THREE.Vector3(0, 0, 0.95),
    new m.THREE.Vector3(-0.6, 0.4, 0.95),
    new m.THREE.Vector3(0.6, 0.4, 0.95),
  ];
  assert.equal(m.photoSubjectVisible(camera, scene, subject, targets), true);
  const blocker = new m.THREE.Mesh(
    new m.THREE.BoxGeometry(1, 1, 1),
    new m.THREE.MeshBasicMaterial(),
  );
  blocker.position.z = 3;
  scene.add(blocker);
  assert.equal(
    m.photoSubjectVisible(camera, scene, subject, targets),
    false,
    "A blocker near the subject must count",
  );
  blocker.position.z = 5;
  assert.equal(
    m.photoSubjectVisible(camera, scene, subject, targets),
    false,
    "A camera inside a blocker must be detected",
  );
  const hiddenParent = new m.THREE.Group();
  hiddenParent.add(blocker);
  scene.add(hiddenParent);
  hiddenParent.visible = false;
  assert.equal(
    m.photoSubjectVisible(camera, scene, subject, targets),
    true,
    "Hidden ancestors must not obstruct",
  );
  camera.lookAt(0, 0, 10);
  assert.equal(
    m.photoSubjectVisible(camera, scene, subject, targets),
    false,
    "An unrelated view must fail",
  );
  subject.geometry.dispose();
  subject.material.dispose();
  blocker.geometry.dispose();
  blocker.material.dispose();
  console.log(
    "PASS: active day clock, phase continuity and evening hold; event exclusion, pause and cooldown; old saves, parked boats, unique memories and invalid fields; elevated floors and underwater floor queries; bridge wood; audio loop seam; subject, near-obstruction, inside-camera, hidden-parent and unrelated photo views.",
  );
} finally {
  await rm(dir, { recursive: true, force: true });
}
