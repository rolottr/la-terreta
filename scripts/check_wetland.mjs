import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
const dir = await mkdtemp(join(tmpdir(), "valencia-wetland-"));
try {
  const path = join(dir, "wetland.mjs");
  await build({
    stdin: {
      contents:
        'export * from "./src/wetland-shapes"; export * from "./src/wetland-layout"; export * from "./src/wetland-mesh"; export * from "./src/boat-navigation"; export * from "./src/beach-water"; export * from "./src/beach-surf"; export {advance,offset} from "./src/navigation"; export * from "./src/bird-navigation";',
      resolveDir: process.cwd(),
    },
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: path,
  });
  const m = await import(pathToFileURL(path));
  let birdFrames=0;
  for (const fps of [30,60,120]) for (const [dockIndex,dock] of m.boatDocks.entries()) {
    const boat={...dock.launch,heading:dock.yaw};
    const parked=m.boatDocks.map(d=>({...d.launch,heading:d.yaw}));
    for (const side of [-1,0,1]) {
      let bird=m.offset(boat.x,boat.z,side*.2,0);
      for(let frame=0;frame<fps*4;frame++) {
        const moving=m.advance(boat.x,boat.z,boat.heading,0,1,frame/fps*.8);
        const boats=[moving,...parked.filter((_,i)=>i!==dockIndex)];
        bird=m.moveBird(bird,boat,boats,1/fps,side+1);
        assert.ok(m.waterAt(bird.x,bird.z)&&!m.onJetty(bird.x,bird.z),"Bird stays in water at a jetty");
        assert.ok(boats.every(b=>m.hullClearance(bird,b)>=-1e-6),"Bird clears moving and parked hulls");
        birdFrames++;
      }
    }
  }
  console.log(`PASS: ${birdFrames} bird frames at 30/60/120 FPS, including birds inside a hull, moving boats and parked boats at every jetty.`);
  assert.equal(
    m.waterShapes.length,
    1,
    "Lagoon, channel and sea must form one continuous water mesh",
  );
  assert.equal(
    m.waterShapes[0].length,
    4,
    "The water mesh must contain exactly three island holes",
  );
  let area = 0;
  for (let x = -240; x < -50; x++)
    for (let z = -132; z < -20; z++)
      if (m.waterAt(x, z) === "lagoon") area += Math.cos(z / 100);
  assert.ok(
    area > Math.PI * 21 * 21 * 5,
    `Lagoon must exceed five times the old area: ${area}`,
  );
  for (let x = -314; x < 314; x++)
    assert.equal(m.waterAt(x, -12), null, "Tram must stay on land");
  for (const island of m.islands) {
    const center = island.reduce(
      (a, p) => ({
        x: a.x + p.x / island.length,
        z: a.z + p.z / island.length,
      }),
      { x: 0, z: 0 },
    );
    assert.equal(m.waterAt(center.x, center.z), null);
    assert.equal(m.navigable(center.x, center.z), false);
  }
  assert.equal(
    m.waterAt(m.lagoonVisit.x, m.lagoonVisit.z),
    null,
    "Map arrival must be dry",
  );
  assert.ok(m.onJetty(m.boatDock.x, m.boatDock.z));
  assert.ok(m.navigable(m.boatLaunch.x, m.boatLaunch.z), "Boat starts afloat");
  for (const dock of m.boatDocks) {
    assert.ok(m.onJetty(dock.x,dock.z), `${dock.name}: usable walking platform`);
    assert.equal(m.waterAt(dock.x,dock.landZ), null, `${dock.name}: deck reaches dry land`);
    let pose={...dock.launch,yaw:dock.yaw,heading:dock.yaw,speed:0};
    for (const forward of [-1,0,1]) {
      const hull=m.advance(pose.x,pose.z,pose.heading,0,forward,2.9);
      assert.ok(m.navigable(hull.x,hull.z,.85), `${dock.name}: full hull clears shore`);
    }
    for(let i=0;i<180;i++)pose=m.stepBoat(pose,1,0,1/60);
    assert.ok(Math.hypot(pose.x-dock.launch.x,pose.z-dock.launch.z)>6,`${dock.name}: boat can leave dock`);
  }

  // The gola must meet both water bodies, with no land barrier at either end.
  assert.ok(m.channelOutline.some((p) => m.inside(p, m.lagoonOutline)));
  assert.ok(m.channelOutline.some((p) => m.inside(p, m.seaOutline)));
  const start = { ...m.boatLaunch, yaw: Math.PI, heading: Math.PI, speed: 0 };
  const run = (fps, right = 0, seconds = 6) => {
    let p = { ...start };
    for (let i = 0; i < fps * seconds; i++) {
      p = m.stepBoat(p, 1, right, 1 / fps);
      assert.ok(m.navigable(p.x, p.z), "Boat cannot leave lagoon");
      assert.ok(Object.values(p).every(Number.isFinite));
    }
    return p;
  };
  const straight = run(60);
  assert.ok(
    Math.hypot(straight.x - start.x, straight.z - start.z) > 15,
    "Boat must leave jetty",
  );
  const turns = [30, 60, 120].map((fps) => run(fps, 0.5));
  for (const p of turns.slice(1))
    assert.ok(
      Math.hypot(p.x - turns[0].x, p.z - turns[0].z) < 0.1,
      "Frame rate independence",
    );
  const shore = run(60, 0, 60);
  assert.ok(m.navigable(shore.x, shore.z), "Long input stops at shore");
  const g = m.wetlandGeometry(m.waterShapes[0][0], m.waterShapes[0].slice(1));
  const positions = g.getAttribute("position");
  for (let i = 0; i < positions.count; i += 3) {
    const a = [positions.getX(i), positions.getY(i), positions.getZ(i)],
      b = [positions.getX(i + 1), positions.getY(i + 1), positions.getZ(i + 1)],
      c = [positions.getX(i + 2), positions.getY(i + 2), positions.getZ(i + 2)];
    const u = b.map((v, j) => v - a[j]),
      v = c.map((v, j) => v - a[j]);
    const n = [
      u[1] * v[2] - u[2] * v[1],
      u[2] * v[0] - u[0] * v[2],
      u[0] * v[1] - u[1] * v[0],
    ];
    assert.ok(
      n.reduce((sum, v, j) => sum + v * a[j], 0) >= -1e-5,
      "Surface triangles must face outward",
    );
  }
  const swell = Array.from({ length: 720 }, (_, i) =>
    m.beachSwell(1.2, -40, i / 60),
  );
  assert.ok(
    Math.max(...swell) - Math.min(...swell) > 0.1,
    "Beach waves must move the surface",
  );
  assert.ok(
    swell.every((h) => Number.isFinite(h) && Math.abs(h) < 0.12),
    "Calm beach wave bounds",
  );
  assert.equal(
    m.beachSwell(0, -40, 3),
    0,
    "No discontinuity at the coast edge",
  );
  for (let i = 0; i < 600; i++)
    assert.ok(
      Math.abs(
        m.beachSwell(2, -40, i / 60 + 0.01) - m.beachSwell(2, -40, i / 60),
      ) < 0.002,
    );
  assert.equal(
    m.beachContact(m.boatLaunch.x, m.boatLaunch.z, 4, -0.8),
    null,
    "Lagoon physics stays unchanged",
  );
  const depth = Array.from({ length: 360 }, (_, i) =>
    m.beachContact(-247.4, -40, i / 60, -0.1),
  );
  assert.ok(depth.every((d) => d && d.depth > 0.1 && d.depth < 0.4));
  assert.ok(
    m.wadingFactor(0.3) < m.wadingFactor(0.1) && m.wadingFactor(0) === 1,
  );
  assert.equal(
    m.beachContact(-247.4, -40, 3, 0.39).depth,
    0,
    "Raised decks stay dry",
  );
  let shorePoint;
  for (let x = -246.8; x < -245.8; x += 0.02) {
    const c = m.coastSample({ x, z: -40 });
    if (!c.wet && c.distance > 0.25 && c.distance < 0.45) {
      shorePoint = { x, z: -40 };
      break;
    }
  }
  assert.ok(shorePoint, "A dry beach point exists in the run-up band");
  const wetting = Array.from(
    { length: 360 },
    (_, i) => m.beachContact(shorePoint.x, shorePoint.z, i / 60, 0.05).wet,
  );
  assert.ok(
    Math.max(...wetting) > 0.9 && Math.min(...wetting) < 0.01,
    "Water must run up and drain from sand",
  );
  const surf = m.createBeachSurf(() => 0.05);
  assert.ok(
    surf.geometry.getAttribute("position").count < 5000,
    "Surf uses a bounded local strip",
  );
  assert.ok(
    [...surf.geometry.getAttribute("position").array].every(Number.isFinite),
  );
  surf.geometry.dispose();
  surf.material.dispose();
  // Any reachable bank or island can be used, but open water cannot.
  const dryBlocked = (x, z) => !!m.waterAt(x, z) && !m.onJetty(x, z);
  assert.equal(m.findBoatLanding({ x: -130, z: -60 }, dryBlocked), undefined, "No exit in open water");
  assert.equal(m.findBoatLanding(m.boatLaunch, () => true), undefined, "No exit through solid obstacles");
  for (const dock of m.boatDocks) {
    const landing = m.findBoatLanding(dock.launch, dryBlocked);
    assert.ok(landing && !dryBlocked(landing.x, landing.z), `${dock.name}: exit onto its deck or bank`);
  }
  let banks = 0, islandBanks = 0;
  for (const [index, outline] of [m.lagoonOutline, ...m.islands].entries()) {
    for (let i = 0; i < outline.length; i += 7) {
      const edge = outline[i];
      let tested = false;
      for (let angle = 0; angle < Math.PI * 2 && !tested; angle += Math.PI / 12) {
        const p = m.advance(edge.x, edge.z, angle, 0, 1, 4.2);
        const clearHull = [-2.9, 0, 2.9].every(d => {
          const h = m.advance(p.x, p.z, p.heading, 0, Math.sign(d), Math.abs(d));
          return m.navigable(h.x, h.z, .85);
        });
        if (!clearHull) continue;
        const landing = m.findBoatLanding(p, dryBlocked);
        assert.ok(landing && !dryBlocked(landing.x, landing.z), `Shore ${index}/${i}: safe landing`);
        let reverse = { ...p, speed: 0 };
        // Bow faces away from the shore; forward leaves the bank. Reverse must also work in open water.
        for (let frame = 0; frame < 120; frame++) reverse = m.stepBoat(reverse, 1, 0, 1 / 60);
        assert.ok(m.navigable(reverse.x, reverse.z), "Departure stays afloat");
        index ? islandBanks++ : banks++;
        tested = true;
      }
    }
  }
  assert.ok(banks >= 12 && islandBanks >= 9, `Outer and island coverage: ${banks}/${islandBanks}`);
  let backwards = { ...start };
  // Test reverse away from an actual bank-facing hull.
  const towardsBank = run(60, 0, 60);
  backwards = { ...towardsBank };
  for (let i = 0; i < 180; i++) backwards = m.stepBoat(backwards, -1, 0, 1 / 60);
  assert.ok(backwards.speed < -1 && Math.hypot(backwards.x - towardsBank.x, backwards.z - towardsBank.z) > 3,
    "A boat can back away from a bank without turning the hull into land");
  console.log(`PASS: shore landing at ${banks} outer banks and ${islandBanks} island banks, all ${m.boatDocks.length} jetties, blocked exits, open water, and reverse departure.`);
  console.log(
    `PASS: lagoon ${Math.round(area)} m² (${(area / (Math.PI * 21 * 21)).toFixed(1)}× previous), dry tram and arrival, islands, linked channel, launch, rowing, turns, shore collision, 30/60/120 FPS, outward geometry, bounded beach waves, smooth shoreline, depth drag, wetting/drainage, dry raised decks and bounded surf geometry.`,
  );
} finally {
  await rm(dir, { recursive: true, force: true });
}
