import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

async function load(name) {
  const bytes = await readFile(`public/models/${name}.glb`);
  const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
  assert.equal((json.images ?? []).length, 0, `${name}: no new texture memory`);
  const { scene } = await new GLTFLoader().parseAsync(data, '');
  scene.updateMatrixWorld(true);
  return { scene, bytes: bytes.length };
}
function stats(root) {
  let triangles = 0, primitives = 0;
  root.traverse(o => {
    if (!o.isMesh) return;
    const p = o.geometry.attributes.position;
    assert.ok([...p.array].every(Number.isFinite), `${o.name}: finite vertices`);
    triangles += (o.geometry.index?.count ?? p.count) / 3;
    primitives += Array.isArray(o.material) ? o.material.length : 1;
  });
  const box = new T.Box3().setFromObject(root, true);
  return { triangles, primitives, min: box.min.toArray(), max: box.max.toArray() };
}
const original = await load('civic-plaza');
const oldFalla = stats(original.scene.getObjectByName('Falla'));
const report = { oldFalla };
for (const name of ['park-bench', 'firecracker', 'falla-crafted']) {
  const { scene, bytes } = await load(name);
  const result = stats(scene);
  report[name] = { ...result, bytes };
  if (name === 'park-bench') {
    assert.ok(result.triangles <= 5000);
    assert.equal(result.primitives, 2);
    assert.ok(result.min[1] >= -.001 && result.max[0] <= 1.001 && result.min[0] >= -1.001);
    // Feet and seat stay inside the established collision depth.
    const p = new T.Vector3();
    scene.traverse(o => {
      if (!o.isMesh) return;
      const positions = o.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        p.fromBufferAttribute(positions, i).applyMatrix4(o.matrixWorld);
        if (p.y < .5) assert.ok(Math.abs(p.z) <= .45, 'Bench lower footprint fits collider');
      }
    });
  } else if (name === 'firecracker') {
    assert.ok(result.triangles <= 500);
    assert.equal(result.primitives, 1);
    assert.ok(result.min[1] >= -.07 && result.max[1] <= .10);
    scene.traverse(o => { if (o.isMesh) assert.ok(o.geometry.hasAttribute('color') && o.material.vertexColors); });
  } else {
    assert.ok(scene.getObjectByName('Falla'));
    assert.ok(result.triangles <= oldFalla.triangles * 1.4, 'Falla detail has a bounded geometry cost');
    for (const axis of [0, 2]) {
      assert.ok(Math.abs(result.min[axis] - oldFalla.min[axis]) < .05);
      assert.ok(Math.abs(result.max[axis] - oldFalla.max[axis]) < .05);
    }
    assert.ok(Math.abs(result.max[1] - oldFalla.max[1]) < .05, 'Falla keeps its height');
  }
}
console.log(JSON.stringify(report, null, 2));
