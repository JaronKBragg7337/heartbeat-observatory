// ============================================================================
// validate.mjs — the checks that run so nobody has to go looking.
//
// The debug layer exists for what a human notices. This exists so a human
// should not have to notice in the first place: placement, collision,
// dimension drift, physics correctness, and determinism are all machine
// questions with machine answers.
//
// Run: node test/validate.mjs        (from games/the-cosmos)
// ============================================================================

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync, writeFileSync, existsSync } from 'fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Node cannot resolve the bare 'three' specifier the browser gets from the
// import map, so point it at the vendored copy. Idempotent, and gitignored.
const shim = join(ROOT, 'node_modules', 'three');
if (!existsSync(join(shim, 'package.json'))) {
  mkdirSync(shim, { recursive: true });
  writeFileSync(join(shim, 'package.json'), JSON.stringify({
    name: 'three', version: '0.160.0-vendored', type: 'module', main: './index.js',
  }));
  writeFileSync(join(shim, 'index.js'), `export * from '../../lib/three.module.js';\n`);
}
const THREE = await import('three');

const { BODIES, getBody, impliedSurfaceGravity, gravityAtRadius, G } =
  await import(`file://${join(ROOT, 'src/world/bodies.js')}`);
const GEO = await import(`file://${join(ROOT, 'src/world/geodesy.js')}`);
const FIELD = await import(`file://${join(ROOT, 'src/world/field.js')}`);
const { Walker } = await import(`file://${join(ROOT, 'src/player/walker.js')}`);
const { Registry } = await import(`file://${join(ROOT, 'src/core/registry.js')}`);

let pass = 0, fail = 0;
const failures = [];
function check(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; failures.push(name); console.log(`  FAIL  ${name} ${detail}`); }
}
const section = (s) => console.log(`\n== ${s} ==`);

const mars = getBody('mars');

// ---------------------------------------------------------------------------
section('1. Measured bodies are self-consistent');
// ---------------------------------------------------------------------------
for (const b of BODIES) {
  check(`${b.id}: every physical field is a finite number`,
    [b.radiusMean, b.radiusEquatorial, b.radiusPolar, b.mass, b.surfaceGravity,
     b.siderealRotationPeriod, b.obliquityDeg].every(Number.isFinite));

  check(`${b.id}: polar radius < mean < equatorial (real oblateness)`,
    b.radiusPolar < b.radiusMean && b.radiusMean < b.radiusEquatorial,
    `${b.radiusPolar} / ${b.radiusMean} / ${b.radiusEquatorial}`);

  // The published mass and the published surface gravity must agree. If they
  // do not, one of the two numbers was transcribed wrong.
  const implied = impliedSurfaceGravity(b);
  const err = Math.abs(implied - b.surfaceGravity) / b.surfaceGravity;
  check(`${b.id}: stated gravity agrees with G·M/r² within 1%`,
    err < 0.01, `stated ${b.surfaceGravity.toFixed(4)}, implied ${implied.toFixed(4)} (${(err * 100).toFixed(2)}%)`);

  check(`${b.id}: gravity falls off as inverse square above the surface`,
    Math.abs(gravityAtRadius(b, b.radiusMean * 2) - b.surfaceGravity / 4) < 1e-9);

  check(`${b.id}: gravity goes to zero at the centre, not infinity`,
    gravityAtRadius(b, 0) === 0 && gravityAtRadius(b, b.radiusMean / 2) < b.surfaceGravity);

  check(`${b.id}: every source record names a field and a URL`,
    b.sources.length > 0 && b.sources.every((s) => s.field && s.url && s.verified));
}

// ---------------------------------------------------------------------------
section('2. Addressing: every point has one, and it round-trips');
// ---------------------------------------------------------------------------
{
  let worst = 0, worstAt = null;
  for (let i = 0; i < 4000; i++) {
    const lat = ((i * 7919) % 17999) / 100 - 89.99;
    const lon = ((i * 6271) % 35999) / 100 - 179.99;
    const alt = ((i * 3571) % 40000) - 12000;
    const c = GEO.geodeticToCartesian(mars, lat, lon, alt);
    const b = GEO.cartesianToGeodetic(mars, c.x, c.y, c.z);
    // Convert the latitude error into metres on the ground so the tolerance
    // is physical rather than an abstract decimal count.
    const errM = Math.max(
      Math.abs(b.lat - lat) * (Math.PI / 180) * mars.radiusMean,
      Math.abs(b.alt - alt));
    if (errM > worst) { worst = errM; worstAt = `${lat},${lon},${alt}`; }
  }
  check('geodetic round-trip is accurate to under 1 mm over 4000 samples',
    worst < 0.001, `worst ${(worst * 1000).toFixed(4)} mm at ${worstAt}`);
}

check('poles convert without a singularity',
  Number.isFinite(GEO.cartesianToGeodetic(mars, 0, mars.radiusPolar, 0).lat));

check('local frame is orthonormal',
  (() => {
    const f = GEO.localFrame(37.4, -122.1);
    const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
    const len = (a) => Math.hypot(a.x, a.y, a.z);
    return Math.abs(len(f.east) - 1) < 1e-12 && Math.abs(len(f.north) - 1) < 1e-12 &&
           Math.abs(len(f.up) - 1) < 1e-12 && Math.abs(dot(f.east, f.north)) < 1e-12 &&
           Math.abs(dot(f.east, f.up)) < 1e-12 && Math.abs(dot(f.north, f.up)) < 1e-12;
  })());

check('surface distance between the landmarks is physically sane',
  (() => {
    const d = GEO.surfaceDistance(mars, 18.65, -133.8, -14.0, -59.2);
    return d > 3e6 && d < Math.PI * mars.radiusMean;   // Olympus -> Valles
  })());

// ---------------------------------------------------------------------------
section('3. The planet is a volume, not a shell');
// ---------------------------------------------------------------------------
{
  // The load-bearing architectural claim of the whole project: a ray can pass
  // through rock, into open space, and back into rock. A height shell cannot
  // produce this, so if this test fails the world model has silently regressed
  // to something that can never support caves, tunnels, or excavation.
  let multi = 0, scanned = 0, deepestVoid = 0;
  for (let i = 0; i < 900; i++) {
    const u = ((i * 2654435761) % 100000) / 100000 * 2 - 1;
    const th = i * 0.61803398875 * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const d = { x: s * Math.cos(th), y: u, z: s * Math.sin(th) };
    const R = mars.radiusEquatorial + 30000;
    const hits = FIELD.raycast(mars, d.x * R, d.y * R, d.z * R, -d.x, -d.y, -d.z, R * 0.9, { minStep: 2 });
    scanned++;
    if (hits.length > 2) {
      multi++;
      for (let k = 0; k < hits.length - 1; k++) {
        if (hits[k].kind === 'exit' && hits[k + 1].kind === 'enter') {
          deepestVoid = Math.max(deepestVoid, hits[k + 1].t - hits[k].t);
        }
      }
    }
  }
  check('rays find enclosed voids underground (caves are representable)',
    multi > 0, `${multi}/${scanned} rays crossed a void`);
  check('cave voids are lava-tube scale, not cathedral scale',
    deepestVoid > 5 && deepestVoid < 900, `largest span ${deepestVoid.toFixed(1)} m`);
}

check('the deep interior is solid everywhere (no hollow planet)',
  (() => {
    for (let i = 0; i < 200; i++) {
      const u = ((i * 40503) % 2000) / 1000 - 1;
      const th = i * 2.399963;
      const s = Math.sqrt(Math.max(0, 1 - u * u));
      const r = mars.radiusMean * 0.35;
      if (!FIELD.isSolid(mars, s * Math.cos(th) * r, u * r, s * Math.sin(th) * r)) return false;
    }
    return true;
  })());

check('space above the highest terrain is empty everywhere',
  (() => {
    for (let i = 0; i < 200; i++) {
      const u = ((i * 15485863) % 2000) / 1000 - 1;
      const th = i * 1.7;
      const s = Math.sqrt(Math.max(0, 1 - u * u));
      const r = mars.radiusEquatorial + mars.terrain.reliefMax + 3000;
      if (FIELD.isSolid(mars, s * Math.cos(th) * r, u * r, s * Math.sin(th) * r)) return false;
    }
    return true;
  })());

check('field is deterministic: identical inputs give identical output',
  (() => {
    for (let i = 0; i < 60; i++) {
      const p = { x: 1e6 + i * 977, y: -2.2e6 + i * 131, z: 8.4e5 - i * 313 };
      if (FIELD.density(mars, p.x, p.y, p.z) !== FIELD.density(mars, p.x, p.y, p.z)) return false;
    }
    return true;
  })());

check('render surface and collision surface are the same function',
  (() => {
    // planetMesh samples surfaceRadiusAlong; the walker uses groundBelow. If
    // these ever disagree the player stands on air or sinks into the picture.
    for (let i = 0; i < 40; i++) {
      const th = i * 0.31, ph = 0.7 + i * 0.017;
      const d = { x: Math.sin(ph) * Math.cos(th), y: Math.cos(ph), z: Math.sin(ph) * Math.sin(th) };
      const R = FIELD.surfaceRadiusAlong(mars, d.x, d.y, d.z);
      const above = { x: d.x * (R + 60), y: d.y * (R + 60), z: d.z * (R + 60) };
      const g = FIELD.groundBelow(mars, above.x, above.y, above.z, 500);
      if (!g) return false;
      const gr = Math.hypot(g.point.x, g.point.y, g.point.z);
      if (Math.abs(gr - R) > 0.35) return false;
    }
    return true;
  })(), 'mesh radius vs collision radius must agree within 0.35 m');

check('the solved surface equals the marched surface (renderer optimisation is not a second truth)',
  (() => {
    // planetMesh uses surfaceRadiusFast (Newton) instead of surfaceRadiusAlong
    // (ray march) because it is ~6x cheaper per vertex. That is only legitimate
    // while the two solve the same equation. If this ever fails, the rendered
    // ground has drifted away from the ground the player collides with.
    let worst = 0;
    for (let i = 0; i < 400; i++) {
      const th = i * 0.37, ph = 0.15 + i * 0.0075;
      const d = { x: Math.sin(ph) * Math.cos(th), y: Math.cos(ph), z: Math.sin(ph) * Math.sin(th) };
      const marched = FIELD.surfaceRadiusAlong(mars, d.x, d.y, d.z, { minStep: 0.6 });
      const solved = FIELD.surfaceRadiusFast(mars, d.x, d.y, d.z);
      worst = Math.max(worst, Math.abs(marched - solved));
    }
    return worst < 0.01;
  })(), 'solved vs marched must agree within 1 cm');

// ---------------------------------------------------------------------------
section('4. Materials and strata');
// ---------------------------------------------------------------------------
check('every material declares a real density and a strength',
  Object.values(FIELD.MATERIALS).every((m) =>
    m.id && m.name && m.densityKgM3 > 0 && m.strength >= 0 && m.strength <= 1));

check('material densities are physically ordered (ice < regolith < basalt < ore)',
  FIELD.MATERIALS.waterIce.densityKgM3 < FIELD.MATERIALS.regolith.densityKgM3 &&
  FIELD.MATERIALS.regolith.densityKgM3 < FIELD.MATERIALS.basalt.densityKgM3 &&
  FIELD.MATERIALS.basalt.densityKgM3 < FIELD.MATERIALS.ironOxide.densityKgM3);

check('the surface layer is regolith, not bedrock',
  (() => {
    const d = { x: 0.3, y: 0.8, z: 0.5 };
    const l = Math.hypot(d.x, d.y, d.z);
    const R = FIELD.surfaceRadiusAlong(mars, d.x / l, d.y / l, d.z / l);
    const p = { x: (d.x / l) * (R - 0.3), y: (d.y / l) * (R - 0.3), z: (d.z / l) * (R - 0.3) };
    return FIELD.materialAt(mars, p.x, p.y, p.z).id === 'MAT-REGOLITH';
  })());

check('below the crust nothing can be excavated (mantle boundary is a rule)',
  (() => {
    // Sample straight down from a real surface point and walk the depth, so
    // the test measures actual depth-below-ground rather than assuming the
    // polar radius equals the mean radius (it is 13.3 km smaller).
    const d = { x: 0.3, y: 0.8, z: 0.5 };
    const l = Math.hypot(d.x, d.y, d.z);
    const u = { x: d.x / l, y: d.y / l, z: d.z / l };
    const R = FIELD.surfaceRadiusAlong(mars, u.x, u.y, u.z);

    const shallow = mars.terrain.crustThickness - 10000;
    const deep = mars.terrain.crustThickness + 10000;
    const at = (depth) => {
      const r = R - depth;
      return FIELD.materialAt(mars, u.x * r, u.y * r, u.z * r);
    };
    const deepPt = { x: u.x * (R - deep), y: u.y * (R - deep), z: u.z * (R - deep) };

    return at(shallow).id !== 'MAT-MANTLE' &&
           at(deep).id === 'MAT-MANTLE' &&
           FIELD.isSolid(mars, deepPt.x, deepPt.y, deepPt.z);
  })());

// ---------------------------------------------------------------------------
section('5. A body on the ground behaves');
// ---------------------------------------------------------------------------
{
  const w = new Walker(mars);
  w.placeAtGeodetic(-14.0, -59.2, 2);

  for (let i = 0; i < 600; i++) w.tick(1 / 60, {});
  const speed = Math.hypot(w.velocity.x, w.velocity.y, w.velocity.z);
  check('a standing body comes to rest and stays grounded',
    w.grounded && speed < 0.01, `grounded=${w.grounded} speed=${speed.toFixed(5)}`);

  const a0 = w.geodetic.alt;
  for (let i = 0; i < 900; i++) w.tick(1 / 60, {});
  check('a standing body does not sink or drift over 15 s',
    Math.abs(w.geodetic.alt - a0) < 0.01, `drift ${(w.geodetic.alt - a0).toFixed(5)} m`);

  // Movement must cover the distance the speed promises.
  const lat0 = w.geodetic.lat;
  let airborne = 0;
  for (let i = 0; i < 600; i++) { w.tick(1 / 60, { moveNorth: 1, run: true }); if (!w.grounded) airborne++; }
  const travelled = (w.geodetic.lat - lat0) * (Math.PI / 180) * mars.radiusMean;
  check('running 10 s covers the distance the speed implies',
    Math.abs(travelled - w.runSpeed * 10) < 6, `${travelled.toFixed(1)} m vs ${(w.runSpeed * 10).toFixed(1)} m`);
  check('running over real terrain does not launch the body into the air',
    airborne < 60, `${airborne}/600 frames airborne`);

  // Jump height must match the gravity, because the gravity is the real one.
  for (let i = 0; i < 180; i++) w.tick(1 / 60, {});
  const base = w.geodetic.alt;
  let peak = 0;
  w.tick(1 / 60, { jump: true });
  for (let i = 0; i < 400; i++) { w.tick(1 / 60, {}); peak = Math.max(peak, w.geodetic.alt - base); if (w.grounded && i > 15) break; }
  const theory = (w.jumpSpeed ** 2) / (2 * mars.surfaceGravity);
  check('jump apex matches v²/2g for this planet within 10%',
    Math.abs(peak - theory) / theory < 0.10, `apex ${peak.toFixed(3)} m vs theory ${theory.toFixed(3)} m`);

  check('a body is never left inside solid rock',
    !FIELD.isSolid(mars, w.worldPos.x, w.worldPos.y, w.worldPos.z));
}

// ---------------------------------------------------------------------------
section('6. Walking anywhere on the planet, not just at spawn');
// ---------------------------------------------------------------------------
{
  // Placement across the whole globe, including both poles. A world that only
  // works near its spawn is the classic "small stuff first" failure.
  let bad = [];
  const sites = [
    [0, 0], [45, 90], [-45, -90], [89.5, 0], [-89.5, 180],
    [18.65, -133.8], [-42.4, 70.5], [-14.0, -59.2], [66.6, -20.1], [-77.2, 145.9],
  ];
  for (const [lat, lon] of sites) {
    const w = new Walker(mars);
    w.placeAtGeodetic(lat, lon, 2);
    for (let i = 0; i < 240; i++) w.tick(1 / 60, {});
    const inside = FIELD.isSolid(mars, w.worldPos.x, w.worldPos.y, w.worldPos.z);
    const clearance = w.altitudeAboveGround();
    if (!w.grounded || inside || clearance > 0.5) {
      bad.push(`${lat},${lon} grounded=${w.grounded} inside=${inside} clr=${clearance.toFixed(2)}`);
    }
  }
  check('a body settles correctly at 10 sites worldwide including both poles',
    bad.length === 0, bad.join(' | '));
}

// ---------------------------------------------------------------------------
section('7. Asset identity and placement');
// ---------------------------------------------------------------------------
{
  const reg = new Registry();
  const a = reg.register({ bodyId: 'mars', type: 'STR', name: 'A', authored: { width: 1, height: 2, depth: 1 } });
  const b = reg.register({ bodyId: 'mars', type: 'STR', name: 'B' });
  check('ids follow the COS-<BODY>-<TYPE>-<SEQ> format',
    /^COS-MARS-STR-\d{4}$/.test(a.id), a.id);
  check('ids are unique and sequential', a.id !== b.id && b.id.endsWith('0002'));
  check('an unknown asset type is rejected',
    (() => { try { reg.nextId('mars', 'ZZZ'); return false; } catch { return true; } })());
  check('a duplicate explicit id is rejected',
    (() => {
      try { reg.register({ id: a.id, type: 'STR' }); return false; } catch { return true; }
    })());

  // A part's measured size must be a property of the part, not of where it
  // happens to be pointing. Measuring the world AABB of a plumb-oriented mast
  // reported 2.22 m for a 2.40 m object and made correct placement look broken.
  {
    const r2 = new Registry();
    const g = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2.4, 0.6));
    g.add(box);
    const rec = r2.register({
      bodyId: 'mars', type: 'STR', name: 'tilt test', object3d: g,
      authored: { width: 0.6, height: 2.4, depth: 0.6 },
    });

    r2.measure(rec.id, THREE);
    const upright = { ...rec.measured };

    // Now stand it on a sphere: rotate it hard and move it far from the origin.
    g.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0.3, 0.2).normalize(), 0.9);
    g.position.set(1.2e6, -3.1e6, 8.7e5);
    r2.measure(rec.id, THREE);

    check('measured size is unaffected by rotation and position',
      Math.abs(rec.measured.height - upright.height) < 1e-9 &&
      Math.abs(rec.measured.width - upright.width) < 1e-9,
      `upright ${upright.height.toFixed(3)} vs rotated ${rec.measured.height.toFixed(3)}`);

    const drift = r2.dimensionDrift(rec.id, 0.05);
    check('a correctly built asset reports no dimension drift',
      drift.withinTolerance, `worst ${drift.worst.toFixed(4)} m`);
  }

  // Placement rules: registered surface assets must sit ON the ground — not
  // buried, not hovering. This is the automated version of "it looks wrong".
  const placementProblems = [];
  for (const lm of mars.landmarks) {
    const p = GEO.geodeticToCartesian(mars, lm.lat, lm.lon, 0);
    const l = Math.hypot(p.x, p.y, p.z);
    const R = FIELD.surfaceRadiusAlong(mars, p.x / l, p.y / l, p.z / l, { minStep: 8 });
    const surf = { x: (p.x / l) * R, y: (p.y / l) * R, z: (p.z / l) * R };

    if (FIELD.isSolid(mars, surf.x * 1.0000012, surf.y * 1.0000012, surf.z * 1.0000012)) {
      placementProblems.push(`${lm.id} buried`);
    }
    const g = FIELD.groundBelow(mars, surf.x * 1.00001, surf.y * 1.00001, surf.z * 1.00001, 200);
    if (!g || g.distance > 40) placementProblems.push(`${lm.id} floating (${g ? g.distance.toFixed(1) : 'no ground'})`);
  }
  check('every landmark sits on the ground: not buried, not floating',
    placementProblems.length === 0, placementProblems.join(', '));
}

// ---------------------------------------------------------------------------
section('8. Determinism across runs');
// ---------------------------------------------------------------------------
{
  // Two independently created walkers, same coordinate, same input, must end
  // in exactly the same place. Without this, a coordinate is not an address.
  const a = new Walker(mars), b = new Walker(mars);
  a.placeAtGeodetic(12.34, -56.78, 2);
  b.placeAtGeodetic(12.34, -56.78, 2);
  for (let i = 0; i < 400; i++) {
    const inp = { moveNorth: Math.sin(i * 0.05), moveEast: Math.cos(i * 0.03), run: i % 7 === 0 };
    a.tick(1 / 60, inp); b.tick(1 / 60, inp);
  }
  const d = Math.hypot(a.worldPos.x - b.worldPos.x, a.worldPos.y - b.worldPos.y, a.worldPos.z - b.worldPos.z);
  check('identical inputs from an identical start end in an identical place',
    d === 0, `diverged by ${d} m`);
}

// ---------------------------------------------------------------------------
console.log('\n========================================');
console.log(`RESULT: ${pass} passed, ${fail} failed`);
if (fail) console.log('FAILED:\n  - ' + failures.join('\n  - '));
process.exit(fail === 0 ? 0 : 1);
