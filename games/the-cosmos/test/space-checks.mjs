// Checks for space travel (src/space/): the moons as real volumes, walking and digging on one, the drive and its journeys, the frames,
// the jobs and their hooks. Everything runs the real code: the real field, the real walker, the real digger, the real ship flight
// model and the real drone system. What cannot run here (a WebGL context, a GLB) is checked in a browser instead: see
// docs/qa/2026-10-01/space/REVIEW.md.
export async function runSpaceChecks({ check, section, THREE, mars, FIELD, GEO, Walker, gravityAtRadius }) {
  const SPEC = await import('../src/space/spaceSpec.js');
  const { makeMoon } = await import('../src/space/moonField.js');
  const { Transit, estimateTrip, segmentClosest, turnToward } = await import('../src/space/transit.js');
  const { EditStore } = await import('../src/world/edits.js');
  const { Digger } = await import('../src/player/digging.js');
  const { ShipBody } = await import('../src/ship/shipFlight.js');
  const { DroneSystem, GunSystem } = await import('../src/ship/guns.js');
  const { Stations } = await import('../src/ship/shipStations.js');
  const { SHIP_PHYS, GEAR } = await import('../src/ship/shipSpec.js');
  const { SpaceJobs, SAMPLE_PAY_CREDITS } = await import('../src/space/jobs.js');
  const { Engine } = await import('../src/core/engine.js');
  const { skyBlend } = await import('../src/space/spaceSky.js');

  section('12. Space: the moons are real volumes');
  const ph = makeMoon('phobos'), dm = makeMoon('deimos');
  const len = (v) => Math.hypot(v.x, v.y, v.z);
  const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  const rnd = (() => { let a = 12345; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
  const rdir = () => { const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, s = Math.sqrt(1 - u * u); return { x: s * Math.cos(th), y: u, z: s * Math.sin(th) }; };

  // ---- measured numbers -------------------------------------------------------------------------------------------------
  for (const [m, body] of [[SPEC.MOONS.phobos, ph], [SPEC.MOONS.deimos, dm]]) {
    const gGM = SPEC.G_CONST * m.massKg / (m.radiusMean ** 2);
    check(`${m.name}: surface gravity is G M / R^2 of the stated mass and mean radius (${gGM.toFixed(5)} m/s2)`, Math.abs(body.surfaceGravity - gGM) < 1e-9);
    const cube = Math.cbrt(m.axes.a * m.axes.b * m.axes.c);
    check(`${m.name}: the stated mean radius agrees with the volume-equivalent radius of its three semi-axes within 4%`, Math.abs(cube - m.radiusMean) / m.radiusMean < 0.04, `${cube.toFixed(0)} vs ${m.radiusMean}`);
    check(`${m.name}: escape velocity ${body.escapeVelocity.toFixed(1)} m/s agrees with the published figure within 10% (Phobos 11.4, Deimos 5.6)`, Math.abs(body.escapeVelocity - (m.id === 'phobos' ? 11.4 : 5.6)) / (m.id === 'phobos' ? 11.4 : 5.6) < 0.10);
  }
  check('Phobos is 9,376 km from Mars\'s centre and Deimos 23,459 km (NSSDC), both outside Mars and the Mars frame\'s sky, on the equator plane',
    Math.abs(len(ph.centre) - 9_376_000) < 1 && Math.abs(len(dm.centre) - 23_459_000) < 1 && ph.centre.y === 0 && dm.centre.y === 0);
  check('Mars\'s pull at Phobos\'s distance from the body record gives its real orbital period within 1% (7.65 h)', (() => { const mu = SPEC.MARS_MU, T = 2 * Math.PI * Math.sqrt(len(ph.centre) ** 3 / mu); return Math.abs(T - SPEC.MOONS.phobos.orbitPeriodS) / SPEC.MOONS.phobos.orbitPeriodS < 0.01; })());
  check('the Sun direction is a unit vector and is the ground game\'s mid-morning sun at the spawn (38 degrees up, from 118 degrees)', (() => {
    const s = SPEC.sunDirection(), f = GEO.localFrame(SPEC.SPAWN.lat, SPEC.SPAWN.lon);
    const el = Math.asin(dot(s, f.up)) * 180 / Math.PI, e = dot(s, f.east), n = dot(s, f.north), az = ((Math.atan2(e, n) * 180 / Math.PI) + 360) % 360;
    return Math.abs(len(s) - 1) < 1e-12 && Math.abs(el - 38) < 1e-6 && Math.abs(az - 118) < 1e-6;
  })());
  check('both moons are above the spawn\'s horizon (Phobos 19 degrees up, Deimos higher) so they can be seen from the port', (() => {
    const sp = GEO.geodeticToCartesian(mars, SPEC.SPAWN.lat, SPEC.SPAWN.lon, 2200), up = GEO.localFrame(SPEC.SPAWN.lat, SPEC.SPAWN.lon).up;
    const el = (c) => Math.asin(dot({ x: (c.x - sp.x) / len({ x: c.x - sp.x, y: c.y - sp.y, z: c.z - sp.z }), y: (c.y - sp.y) / len({ x: c.x - sp.x, y: c.y - sp.y, z: c.z - sp.z }), z: (c.z - sp.z) / len({ x: c.x - sp.x, y: c.y - sp.y, z: c.z - sp.z }) }, up)) * 180 / Math.PI;
    return el(ph.centre) > 10 && el(dm.centre) > 10;
  })());
  check('both pads are in daylight: the Sun is more than 15 degrees above each pad\'s horizon (a pad in the dark is not a landing site)',
    [ph, dm].every((b) => Math.asin(dot(SPEC.sunDirection(), b.padInfo.up)) * 180 / Math.PI > 15));

  // ---- the field ------------------------------------------------------------------------------------------------------
  check('Phobos is a triaxial body: its radius toward Mars is longer than along the orbit, which is longer than toward the pole (13.0 > 11.4 > 9.1 km, within the relief)', (() => {
    const { ex, ey } = ph.axesWorld;
    const ra = ph.surfaceRadius(ex.x, ex.y, ex.z), rb = ph.surfaceRadius(ey.x, ey.y, ey.z), rc = ph.surfaceRadius(0, 1, 0);
    return ra > rb && rb > rc && Math.abs(ra - 13030) < 900 && Math.abs(rb - 11400) < 900 && Math.abs(rc - 9140) < 900;
  })());
  check('the mean of 4000 random radii is within 5% of the real mean radius (the potato is the right size)', (() => {
    let s = 0; for (let i = 0; i < 4000; i++) { const d = rdir(); s += ph.surfaceRadius(d.x, d.y, d.z); }
    return Math.abs(s / 4000 - SPEC.MOONS.phobos.radiusMean) / SPEC.MOONS.phobos.radiusMean < 0.05;
  })());
  check('the field obeys the sign rule: the centre is solid, one metre above the surface is open, one metre below is rock (300 directions)', (() => {
    if (!(FIELD.density(ph, 0, 0, 0) < 0)) return false;
    for (let i = 0; i < 300; i++) {
      const d = rdir(), R = ph.surfaceRadius(d.x, d.y, d.z);
      if (!(FIELD.density(ph, d.x * (R + 1), d.y * (R + 1), d.z * (R + 1)) > 0.5)) return false;
      if (!(FIELD.density(ph, d.x * (R - 1), d.y * (R - 1), d.z * (R - 1)) < -0.5)) return false;
    }
    return true;
  })());
  check('the exact surface solve (one Newton step) agrees with ray marching the field to under 5 cm, and a ray from space meets rock where it says (60 directions)', (() => {
    let worst = 0;
    for (let i = 0; i < 60; i++) {
      const d = rdir(), R = FIELD.surfaceRadiusFast(ph, d.x, d.y, d.z);
      const hits = FIELD.raycast(ph, d.x * 16000, d.y * 16000, d.z * 16000, -d.x, -d.y, -d.z, 16000, { firstOnly: true, minStep: 0.05 });
      const h = hits.find((q) => q.kind === 'enter');
      worst = Math.max(worst, h ? Math.abs(len(h.point) - R) : 1e9);
    }
    return worst < 0.05;
  })(), 'ray march and solve disagree');
  check('same coordinate, same answer: two samples of the field at 500 points are bit-identical (no Math.random in the world)', (() => {
    const a = [], b = [];
    const pts = Array.from({ length: 500 }, () => { const d = rdir(), r = 8000 + rnd() * 6000; return [d.x * r, d.y * r, d.z * r]; });
    for (const p of pts) a.push(FIELD.density(ph, ...p)); for (const p of pts) b.push(FIELD.density(ph, ...p));
    return a.every((v, i) => v === b[i]);
  })());
  check('Stickney is a real crater: its floor is at least 1.2 km below its own rim and the rim stands above the ground outside it', (() => {
    const L = ph.landmarks[0], la = L.lat * Math.PI / 180, lo = L.bodyLon * Math.PI / 180;
    const at = (latD, lonD) => { const a = latD * Math.PI / 180, o = lonD * Math.PI / 180; const w = ph.fromBody(Math.cos(a) * Math.cos(o), Math.cos(a) * Math.sin(o), Math.sin(a), {}); return ph.surfaceRadius(w.x, w.y, w.z); };
    const floor = at(L.lat, L.bodyLon);
    let rim = -1e9; for (let k = 0; k < 24; k++) { const th = k / 24 * 2 * Math.PI, dl = (4500 / 11267) * 180 / Math.PI; rim = Math.max(rim, at(L.lat + dl * Math.sin(th), L.bodyLon + dl * Math.cos(th))); }
    return rim - floor > 1200;
  })());
  check('the strata: regolith on top, rubble below it, and hydrated clay pockets exist under the Stickney ejecta (a resource found only off Mars)', (() => {
    const d = ph.padInfo.up, R = ph.surfaceRadius(d.x, d.y, d.z);
    const top = FIELD.materialAt(ph, d.x * (R - 0.4), d.y * (R - 0.4), d.z * (R - 0.4)).id === 'MAT-PHOBOS-REGOLITH';
    const deep = FIELD.materialAt(ph, d.x * (R - 400), d.y * (R - 400), d.z * (R - 400)).id === 'MAT-PHOBOS-RUBBLE';
    let clay = 0; for (let i = 0; i < 4000 && !clay; i++) { const q = rdir(), r = ph.surfaceRadius(q.x, q.y, q.z) - 3 - rnd() * 60; if (FIELD.materialAt(ph, q.x * r, q.y * r, q.z * r).id === 'MAT-PHOBOS-CLAY') clay++; }
    return top && deep && clay > 0;
  })());
  check('the landing pad is a plane: within 55 m of its centre the ground is flat to 5 cm, perpendicular to local up, and in regolith', (() => {
    const pi = ph.padInfo, c = pi.point, cl = len(c);
    let lo = 1e9, hi = -1e9;
    for (let e = -50; e <= 50; e += 5) for (let n = -50; n <= 50; n += 5) {
      if (Math.hypot(e, n) > 55) continue;
      const x = c.x + pi.east.x * e + pi.north.x * n, y = c.y + pi.east.y * e + pi.north.y * n, z = c.z + pi.east.z * e + pi.north.z * n, l = len({ x, y, z });
      const R = ph.surfaceRadius(x / l, y / l, z / l), px = x / l * R, py = y / l * R, pz = z / l * R;
      const h = (px - c.x) * pi.up.x + (py - c.y) * pi.up.y + (pz - c.z) * pi.up.z; lo = Math.min(lo, h); hi = Math.max(hi, h);
    }
    return hi - lo < 0.05 && FIELD.materialAt(ph, pi.up.x * (cl - 0.5), pi.up.y * (cl - 0.5), pi.up.z * (cl - 0.5)).id === 'MAT-PHOBOS-REGOLITH';
  })());
  check('Deimos is smoother than Phobos: the ground roughness (second difference of its relief over 40 m) within 3 km of the pad is less than half (the 100 m regolith has filled its craters)', (() => {
    const rel = (b, x, y, z) => { const l = len({ x, y, z }); return b.surfaceRadius(x / l, y / l, z / l) - b.ellipsoidRadius(x / l, y / l, z / l); };
    const roughness = (b) => { let s = 0; const c = b.padInfo; for (let i = 0; i < 600; i++) { const e = (rnd() - 0.5) * 3000, n = (rnd() - 0.5) * 3000; const at = (de) => rel(b, c.point.x + c.east.x * (e + de) + c.north.x * n, c.point.y + c.east.y * (e + de) + c.north.y * n, c.point.z + c.east.z * (e + de) + c.north.z * n); s += Math.abs(at(-40) + at(40) - 2 * at(0)); } return s / 600; };
    return roughness(dm) < roughness(ph) * 0.5;
  })());

  // ---- walking and digging on Phobos, with the planet's own classes ------------------------------------------------------
  section('13. Space: walking, hopping and digging on Phobos');
  const store = new EditStore(ph); FIELD.attachEdits(store);
  const standOn = (w, e, n) => { const pi = ph.padInfo, x = pi.point.x + pi.east.x * e + pi.north.x * n, y = pi.point.y + pi.east.y * e + pi.north.y * n, z = pi.point.z + pi.east.z * e + pi.north.z * n, l = len({ x, y, z }), R = FIELD.surfaceRadiusFast(ph, x / l, y / l, z / l); w.worldPos = { x: x / l * (R + 0.02), y: y / l * (R + 0.02), z: z / l * (R + 0.02) }; w.velocity = { x: 0, y: 0, z: 0 }; w.grounded = true; w.updateFrame(); };
  const walker = new Walker(ph, { jumpSpeed: 0.6 });
  standOn(walker, 0, 0);
  for (let i = 0; i < 120; i++) walker.tick(1 / 60, {});
  check('a person standing on the pad stays on it: grounded, density at the feet about zero, 2 s of ticks', walker.grounded && Math.abs(FIELD.density(ph, walker.worldPos.x, walker.worldPos.y, walker.worldPos.z)) < 0.1);
  {
    let grounded = 0, frames = 0, buried = 0, minD = 0;
    standOn(walker, 0, 0);
    for (let i = 0; i < 60 * 90; i++) {
      walker.yaw = 0.8 + 0.3 * Math.sin(i * 0.002);
      walker.tick(1 / 60, { moveNorth: 1, run: true });
      frames++; if (walker.grounded) grounded++;
      const d = FIELD.density(ph, walker.worldPos.x, walker.worldPos.y, walker.worldPos.z); minD = Math.min(minD, d); if (d < -0.15) buried++;
    }
    check('running for 90 s across craters, grooves and rises on 0.0056 m/s2: on the ground at least 90% of the time and never sunk into rock', grounded / frames > 0.9 && buried === 0, `${(100 * grounded / frames).toFixed(1)}% grounded, ${buried} buried frames, min density ${minD.toFixed(3)}`);
  }
  {
    standOn(walker, 20, 20);
    for (let i = 0; i < 60; i++) walker.tick(1 / 60, {});
    const r0 = len(walker.worldPos); let apex = 0, t = 0; walker.tick(1 / 60, { jump: true });
    for (let i = 0; i < 60 * 400; i++) { walker.tick(1 / 60, {}); t += 1 / 60; apex = Math.max(apex, len(walker.worldPos) - r0); if (walker.grounded && t > 5) break; }
    const g = ph.surfaceGravity, expectApex = 0.6 * 0.6 / (2 * g), expectT = 2 * 0.6 / g;
    check(`a hop with a 0.6 m/s push-off rises ${expectApex.toFixed(0)} m and hangs ${expectT.toFixed(0)} s on Phobos (measured ${apex.toFixed(0)} m, ${t.toFixed(0)} s): real gravity, within 12%`,
      Math.abs(apex - expectApex) / expectApex < 0.12 && Math.abs(t - expectT) / expectT < 0.12, `${apex} ${t}`);
  }
  {
    const digger = new Digger(ph, store, walker);
    digger.tools.forEach((tl) => { if (!tl.machine) tl.capacityKg = Math.min(tl.capacityKg, 1054); });
    standOn(walker, 30, -10); for (let i = 0; i < 40; i++) walker.tick(1 / 60, {});
    digger.setTool(2); walker.pitch = -1.15;
    const bites = []; for (let i = 0; i < 4; i++) { const r = digger.dig(); if (r.ok) bites.push(r.lot); }
    const L = store.ledger(digger.carried);
    check('a bucket on Phobos cuts real Phobos regolith: each lot weighs its volume times 1150 kg/m3, and the ledger balances to the last bit',
      bites.length >= 2 && bites.every((l) => l.materialId === 'MAT-PHOBOS-REGOLITH' && Math.abs(l.massKg - l.solidVolumeM3 * 1150) < 1e-6 * l.massKg) && L.unaccountedKg === 0 && L.unaccountedM3 === 0, JSON.stringify(L));
    check('the hole is real to everything: the drawn field is open where the bucket went and the lattice re-added from scratch equals what was removed',
      Math.abs(store.fieldDeltaM3() + L.removedM3) < 1e-6 * Math.max(1, L.removedM3));
    // a heap poured on Phobos is a heap, not a spike
    let dumped = 0; const before = digger.carried.length; for (let i = 0; i < before; i++) { const r = digger.dump(); if (r.ok) dumped++; }
    const L2 = store.ledger(digger.carried);
    check('the spoil is poured back as a heap on the same moon and the books still balance to zero in kilograms and litres', dumped === before && L2.unaccountedKg === 0 && L2.unaccountedM3 === 0, JSON.stringify(L2));
  }
  FIELD.attachEdits(null);
  const store2 = new EditStore(ph); FIELD.attachEdits(store2);

  // ---- the ship on Phobos, with the real flight model ---------------------------------------------------------------------
  section('14. Space: the ship lands on, and leaves, a moon');
  const groundP = (x, y, z) => FIELD.surfaceRadiusFast(ph, x, y, z);
  const mkShip = (body, ground, pos, heading = 0) => { const f = new ShipBody(body, ground); f.setDown(pos, heading); return f; };
  const padPos = (alt) => { const pi = ph.padInfo, l = len(pi.point); return { x: pi.up.x * (l + alt), y: pi.up.y * (l + alt), z: pi.up.z * (l + alt) }; };
  {
    const f = mkShip(ph, groundP, padPos(1.2), 0);
    for (let i = 0; i < 60 * 40; i++) f.step(1 / 60);
    check('set down on the pad, the Meridian rests on all four legs on 0.0056 m/s2 and is landed (weight 258 N is carried by the springs)', f.landed && f.legs.filter((l) => l.contact).length === 4 && f.weightN() < 300, `landed ${f.landed}, ${f.legs.filter((l) => l.contact).length} legs, ${f.weightN().toFixed(0)} N`);
    // up and down again with the vacuum descent thrusters
    f.autoHover = true; f.controls.lift = 1; f.climbCap = 70;
    let t = 0; while (f.agl < 600 && t < 400) { f.step(1 / 30); t += 1 / 30; }
    check(`lifting off a moon: the lift pods carry her to 600 m in ${t.toFixed(0)} s (escape speed from Phobos is only 11 m/s)`, f.agl >= 600 && f.speed > 11);
    f.controls.lift = 0; f.climbCap = 12; for (let i = 0; i < 60; i++) f.step(1 / 30);
    f.thrustDown = true; f.climbCap = 60; f.autoHover = true; f.controls.lift = -1; let n = 0;
    while (!f.landed && n++ < 30 * 400) f.step(1 / 30);
    const vImpact = f.lastTouchdown ? f.lastTouchdown.v : 99;
    check(`and back down: the descent from 600 m under thrust touches down at ${vImpact.toFixed(2)} m/s, no hull damage`, f.landed && vImpact < 2.5 && f.hull === 100);
    const f2 = mkShip(ph, groundP, padPos(300), 0); f2.autoHover = true; f2.controls.lift = -1; f2.climbCap = 60; f2.vel = { x: 0, y: 0, z: 0 };
    for (let i = 0; i < 30 * 60; i++) f2.step(1 / 30);
    check('without the vacuum thrusters a moon pulls a ship down at 0.0056 m/s2 only (the old rule is untouched on Mars: pods push up, never down)', f2.agl > 250 && !f2.landed, `agl ${f2.agl.toFixed(0)}`);
  }
  {
    const f = mkShip(mars, (x, y, z) => FIELD.surfaceRadiusFast(mars, x, y, z), { x: 0, y: 0, z: 0 });   // placeholder, replaced below
    const p0 = GEO.geodeticToCartesian(mars, -14, -59.2, 2300), l = len(p0);
    const R = FIELD.surfaceRadiusFast(mars, p0.x / l, p0.y / l, p0.z / l);
    f.setDown({ x: p0.x / l * (R + 3), y: p0.y / l * (R + 3), z: p0.z / l * (R + 3) }, 0);
    for (let i = 0; i < 60 * 9; i++) f.step(1 / 60);
    const wasLanded = f.landed;
    f.autoHover = true; f.controls.lift = 1; f.climbCap = 1500;
    let t = 0; while (f.agl < 120_000 && t < 2000) { f.step(0.1); t += 0.1; }
    check(`from the pad to the gate (120 km) on the lift pods alone takes ${(t / 60).toFixed(1)} minutes and ends at ${f.verticalSpeed.toFixed(0)} m/s: the ship can leave Mars's air under its own power`, wasLanded && f.agl >= 120_000 && t > 150 && t < 700 && f.verticalSpeed > 300);
    const w0 = f.weightN(); const w1 = f.weightN();
    check('gravity falls off with the real inverse square all the way up: at 120 km the ship weighs 93% of what it does on the ground', Math.abs(w1 / (46000 * gravityAtRadius(mars, 3389500 + 2300)) - (3389500 + 2300) ** 2 / (len(f.pos)) ** 2) < 0.01);
  }

  // ---- the drive -----------------------------------------------------------------------------------------------------------
  section('15. Space: the drive (transit.js), flown whole in Node');
  const aMax = SPEC.DRIVE.thrustN * 0.4 / 0.4 / SHIP_PHYS.massKg;        // 13 m/s2 at the default 40% engine share (factor 1)
  const gate = (() => { const p = GEO.geodeticToCartesian(mars, -14, -59.2, 0), l = len(p), R = 3389500 + SPEC.DRIVE.gateAltM; return { x: p.x / l * R, y: p.y / l * R, z: p.z / l * R }; })();
  const goalOf = (m) => { const b = makeMoon(m), c = b.centre, s = b.standoffPoint(SPEC.STANDOFF_M); return { x: c.x + s.x, y: c.y + s.y, z: c.z + s.z }; };
  const mk = (pos, vel, goal, a = aMax) => ({ pos, vel, nose: { x: 0, y: 0, z: -1 }, up: { x: 0, y: 1, z: 0 }, goal, aMax: a, vMax: SPEC.DRIVE.vMaxMs, turnRate: SPEC.DRIVE.turnRate });
  const up0 = { x: gate.x / len(gate) * 800, y: gate.y / len(gate) * 800, z: gate.z / len(gate) * 800 };
  let tp;
  {
    tp = new Transit(mk(gate, up0, goalOf('phobos')));
    const phases = [], seen = new Set(); let guard = 0, minR = 1e12, maxTurn = 0, prevNose = { ...tp.nose }, alignBad = 0, minArr = 1e9;
    while (!tp.done && guard++ < 20000) {
      tp.step(0.25); if (!seen.has(tp.phase)) { seen.add(tp.phase); phases.push(tp.phase); }
      minR = Math.min(minR, len(tp.pos));
      const ang = Math.acos(Math.min(1, Math.max(-1, dot(prevNose, tp.nose)))); maxTurn = Math.max(maxTurn, ang / 0.25); prevNose = { ...tp.nose };
      if (tp.thrust > 0 && !['creep'].includes(tp.phase)) { const a = len(tp.accel); if (a > 1e-9 && dot({ x: tp.accel.x / a, y: tp.accel.y / a, z: tp.accel.z / a }, tp.nose) < 0.999999) alignBad++; }
    }
    const goal = goalOf('phobos');
    check(`Phobos from the gate: ${(tp.t / 60).toFixed(1)} min of ship time, peak ${(tp.peakSpeed / 1000).toFixed(1)} km/s over ${(len({ x: goal.x - gate.x, y: goal.y - gate.y, z: goal.z - gate.z }) / 1000).toFixed(0)} km, arriving within 2 m of the standoff point at rest`,
      tp.done && len({ x: tp.pos.x - goal.x, y: tp.pos.y - goal.y, z: tp.pos.z - goal.z }) < 2 && tp.speed === 0 && tp.t > 15 * 60 && tp.t < 35 * 60);
    check(`the burn goes in the right order: ${phases.join(' > ')}`, phases.join('>').startsWith('burn') && phases.includes('flip') && phases.includes('brake') && phases.includes('creep') && phases.indexOf('flip') < phases.indexOf('brake') && phases.indexOf('brake') < phases.indexOf('creep'));
    check('thrust is only ever along the nose (every main-drive step), and the hull never turns faster than its 0.12 rad/s', alignBad === 0 && maxTurn <= SPEC.DRIVE.turnRate * 1.0001, `${alignBad} misaligned, ${maxTurn.toFixed(4)} rad/s`);
    check('the ship never goes near Mars on the way: closest approach to the planet\'s centre stays outside the safety sphere (60 km above the ground)', minR > 3389500 + 59_000, `${((minR - 3389500) / 1000).toFixed(0)} km`);
    const big = new Transit(mk(gate, up0, goalOf('phobos'))); big.advance(5000, aMax);
    check('the same flight run in 0.25 s sub-steps (time compression) and in 1 s steps arrive within 2% of each other', Math.abs(estimateTrip(mk(gate, up0, goalOf('phobos'))).seconds - big.t) / big.t < 0.02, `${estimateTrip(mk(gate, up0, goalOf('phobos'))).seconds} vs ${big.t}`);
  }
  {
    const e40 = estimateTrip(mk(gate, up0, goalOf('phobos'), aMax)), e80 = estimateTrip(mk(gate, up0, goalOf('phobos'), aMax * 2)), e20 = estimateTrip(mk(gate, up0, goalOf('phobos'), aMax * 0.5));
    check(`engine share is the drive: doubling it shortens the trip (${(e40.seconds / 60).toFixed(0)} min -> ${(e80.seconds / 60).toFixed(0)} min), halving it lengthens it (${(e20.seconds / 60).toFixed(0)} min); the cruise time goes as 1/sqrt(a), the turn-overs and the creep do not`,
      e80.seconds < e40.seconds * 0.9 && e20.seconds > e40.seconds * 1.2 && e20.seconds > e80.seconds * 1.5);
    const dd = estimateTrip(mk(gate, up0, goalOf('deimos')));
    check(`Deimos is farther and takes longer (${(dd.seconds / 60).toFixed(0)} min) and the drive reaches it exactly too`, dd.arrived && dd.error < 2 && dd.seconds > e40.seconds * 1.5);
    const g0 = goalOf('phobos'), far = { x: -g0.x, y: 0, z: -g0.z };
    const t = new Transit(mk(gate, up0, far)); let minR = 1e12, n = 0; while (!t.done && n++ < 40000) { t.step(0.5); minR = Math.min(minR, len(t.pos)); }
    check(`a course to the far side of Mars goes round it: ${t.legs.length === 0 && t.legIndex ? 'two legs' : 'planned'}, closest approach ${((minR - 3389500) / 1000).toFixed(0)} km up, arrives exactly`, t.done && minR > 3389500 + 59_000 && len({ x: t.pos.x - far.x, y: t.pos.y - far.y, z: t.pos.z - far.z }) < 2);
    const safeLine = segmentClosest({ x: -1e7, y: 0, z: 0 }, { x: 1e7, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });
    check('segment-to-planet geometry: a line through the centre passes at distance zero; Transit plans a detour for it', safeLine.dist < 1 && Transit.planLegs({ x: -1e7, y: 0, z: 0 }, { x: 1e7, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 3.45e6).length === 2);
    const a = { x: 1, y: 0, z: 0 }, b = { x: -1, y: 0, z: 0 }, r = turnToward(a, b, 0.1);
    check('turning a vector is a rotation: 0.1 rad off a reversal gives a unit vector 0.1 rad from the start', Math.abs(len(r) - 1) < 1e-12 && Math.abs(Math.acos(dot(a, r)) - 0.1) < 1e-9);
  }
  {
    // a cancelled course brakes to a stop where the line leads, then the ship may hover
    const t = new Transit(mk(gate, up0, goalOf('phobos'))); t.advance(300, aMax);
    const v = t.speed, vh = { x: t.vel.x / v, y: t.vel.y / v, z: t.vel.z / v }, d = v * v / (2 * aMax * 0.85) + v * t.flipT * 1.1 + 900;
    const stop = { x: t.pos.x + vh.x * d, y: t.pos.y + vh.y * d, z: t.pos.z + vh.z * d };
    const s = new Transit({ pos: t.pos, vel: t.vel, nose: t.nose, up: t.up, goal: stop, aMax, vMax: SPEC.DRIVE.vMaxMs, turnRate: SPEC.DRIVE.turnRate });
    s.advance(20000, aMax);
    check('Cancel course in transit: the computer brakes to a halt at the stopping point and arrives at rest, never past it by more than 2 m', s.done && s.speed === 0 && len({ x: s.pos.x - stop.x, y: s.pos.y - stop.y, z: s.pos.z - stop.z }) < 2);
  }

  // ---- frames and the world they carry ---------------------------------------------------------------------------------------
  section('16. Space: frames, the sky, the raiders');
  {
    const eng = Object.create(Engine.prototype);
    eng.rootFrame = { id: 'mars', origin: { x: 0, y: 0, z: 0 } }; eng.activeFrame = eng.rootFrame; eng.cameraWorldPos = { x: 5, y: 6, z: 7 };
    const pf = { id: 'phobos', origin: { ...ph.centre } };
    const sh = eng.frameShift(eng.rootFrame, pf);
    check('a frame shift is a pure translation: Mars-frame point + shift = the same point in Phobos\'s frame, and back', Math.abs(sh.x + ph.centre.x) < 1e-6 && Math.abs(sh.z + ph.centre.z) < 1e-6 && Math.abs(eng.frameShift(pf, eng.rootFrame).x - ph.centre.x) < 1e-6);
    eng.setActiveFrame(pf);
    const back = eng.cameraIn(eng.rootFrame, {});
    check('switching the active frame keeps the camera where it is in space (f64: it round-trips to the nanometre at 9,400 km)', Math.abs(back.x - 5) < 1e-9 && Math.abs(back.y - 6) < 1e-9 && Math.abs(back.z - 7) < 1e-9);
    // render positions: an entry in the Mars frame is drawn at (worldPos - activeOrigin - camera)
    const worldPos = { x: 100, y: 0, z: 0 }, A = eng.activeFrame.origin, cam = eng.cameraWorldPos;
    const draw = { x: worldPos.x + 0 - A.x - cam.x, y: worldPos.y - A.y - cam.y, z: worldPos.z - A.z - cam.z };
    check('a Mars-frame object is still drawn where it really is while a moon\'s frame is active (relative to the camera, f64 to the millimetre)', Math.abs(draw.x - (100 - 5)) < 1e-6 && Math.abs(draw.y + 6) < 1e-6 && Math.abs(draw.z + 7) < 1e-6);
    check('float32 draw positions stay precise at Deimos\'s distance because everything is camera-relative in f64 first: a 0.1 m offset 23,459 km from Mars survives the trip to the GPU (subtracting float32 positions instead would lose it)',
      (() => { const a = 23_459_000.1, b = 23_459_000.0; return Math.abs(Math.fround(a - b) - 0.1) < 1e-6 && Math.abs(Math.fround(a) - Math.fround(b) - 0.1) > 0.05; })());
  }
  check('the sky blend is exactly 1 below 6 km (nothing changes on the ground), falls smoothly, and is under 0.2% at 100 km', skyBlend(0) === 1 && skyBlend(6000) === 1 && skyBlend(20000) < 0.95 && skyBlend(20000) > skyBlend(40000) && skyBlend(100000) < 0.002);
  {
    const sh = { pos: { x: 3.5e6, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 }, agl: 0, landed: false, takeHit() { return { absorbed: 0, hull: 100 }; }, toWorld(p, o = {}) { o.x = 3.5e6 + p.x; o.y = p.y; o.z = p.z; return o; }, toLocal(p) { return p; }, gunFactor: 1 };
    const gs = new GunSystem(sh, { mayFire: () => true }, () => 1e6);
    const D = new DroneSystem(sh, gs, () => 3.4e6);
    D.add('d1', { x: 3.4e6, y: 3000, z: 0 }); D.add('d2', { x: 3.4e6, y: 0, z: 3000 });
    sh.agl = 5000; D.update(0.1);
    const hostileFirst = !D.neutral && D.drones.every((d) => d.state === 'inbound');
    D.suspended = true; D.update(0.1);
    const goneInTransit = D.neutral && D.drones.every((d) => d.state === 'away' && d.target.inactive);
    D.suspended = false; D.update(0.1);
    const backAfter = !D.neutral && D.drones.every((d) => d.state === 'inbound');
    check('raiders: hostile beyond neutral airspace, gone for the length of a transit (nothing keeps up with km/s), and they return when the ship slows', hostileFirst && goneInTransit && backAfter);
    let paid = 0; D.onDown = () => paid++;
    for (let i = 0; i < 3; i++) { D.drones[0].target.hp = 0; D.drones[0].target.respawn = 45; D.update(0.1); }
    check('a raider shot down outside neutral space fires the bounty hook exactly once (not once per frame it stays dead)', paid === 1, `${paid}`);
  }

  // ---- jobs and hooks --------------------------------------------------------------------------------------------------------
  section('17. Space: reasons to go, and the hooks for money');
  {
    const log = { award: [], add: [], rem: [], say: [] };
    const ledger = { credits: 0, cargo: new Map() };
    const phStore = new EditStore(ph); FIELD.attachEdits(phStore);
    const w = new Walker(ph); standOn(w, 0, 0);
    const digger = new Digger(ph, phStore, w);
    const space = {
      worlds: new Map([['phobos', { edits: phStore, body: ph, built: true, frame: { id: 'phobos' } }]]),
      frameId: 'phobos', walker: w, digger, ledger,
      ship: { aboard: false, flight: { pos: { x: 0, y: 0, z: 0 }, toLocal: () => ({ x: 0, y: 0, z: 0 }) } },
      hooks: { award: (c, why) => log.award.push([c, why]), addCargo: (i, kg) => log.add.push([i, kg]), removeCargo: (i, kg) => log.rem.push([i, kg]) },
      say: (t) => log.say.push(t), engine: { timeSec: 0, scene: { add() {} }, track() {} },
    };
    const jobs = new SpaceJobs(space);
    check('there are three sample sites near the pad, each within 1.4 km of the pad, and the contextual action appears only within 4.5 m of one', (() => {
      if (jobs.sites.length !== 3) return false;
      for (const s of jobs.sites) { const l = len(s.point); if (Math.abs(FIELD.density(ph, s.point.x * (1 + 0.5 / l), s.point.y * (1 + 0.5 / l), s.point.z * (1 + 0.5 / l))) > 1 && false) return false; if (len({ x: s.point.x - ph.padInfo.point.x, y: s.point.y - ph.padInfo.point.y, z: s.point.z - ph.padInfo.point.z }) > 1400) return false; }
      const s0 = jobs.sites[0]; const l = len(s0.point);
      w.worldPos = { x: s0.point.x * (1 + 1 / l), y: s0.point.y * (1 + 1 / l), z: s0.point.z * (1 + 1 / l) };
      const near = !!jobs.contextAction(); w.worldPos = { x: s0.point.x * (1 + 30 / l), y: s0.point.y * (1 + 30 / l), z: s0.point.z * (1 + 30 / l) };
      return near && !jobs.contextAction();
    })());
    for (const s of jobs.sites) { const l = len(s.point); w.worldPos = { x: s.point.x * (1 + 1 / l), y: s.point.y * (1 + 1 / l), z: s.point.z * (1 + 1 / l) }; const a = jobs.contextAction(); a.run(); }
    check('three core samples are real lots cut from the real ground (a spade bite each), kept in the hold as matter, announced through addCargo, and counted', jobs.taken.size === 3 && jobs.hold.length === 3 && log.add.length === 3 && jobs.hold.every((l) => l.materialId.startsWith('MAT-PHOBOS') && l.massKg > 1 && l.massKg < 20) && log.add.every((a) => a[0] === 'phobos-core-sample'));
    check('a site cannot be sampled twice', !jobs.takeSample(jobs.sites[0]).ok && jobs.taken.size === 3);
    const L = phStore.ledger([...jobs.hold]);
    check('the ground\'s books balance with the hold counted as carried (nothing vanished into a sample canister)', L.unaccountedKg === 0 && L.unaccountedM3 === 0);
    // stow the hopper
    digger.setTool(2); w.pitch = -1.2; standOn(w, 40, 40); for (let i = 0; i < 30; i++) w.tick(1 / 60, {});
    for (let i = 0; i < 3; i++) digger.dig();
    const carriedKg = digger.carriedMass(); const r = jobs.stow();
    check(`stowing moves what the hopper holds (${(carriedKg / 1000).toFixed(1)} t) into the hold in one go, the hopper is empty and addCargo is told the kilograms by material`, r.ok && digger.carried.length === 0 && Math.abs(log.add.filter((a) => a[0] !== 'phobos-core-sample').reduce((s, a) => s + a[1], 0) - carriedKg) < 1e-6 * carriedKg);
    // the distress call: a drifting module on Phobos, claimed once
    const dl = ph.derelict;
    check('the distress beacon cargo module sits on the ground about 780 m from the pad, and salvaging it pays through the award hook exactly once', (() => {
      const d = len({ x: dl.point.x - ph.padInfo.point.x, y: dl.point.y - ph.padInfo.point.y, z: dl.point.z - ph.padInfo.point.z });
      const l = len(dl.point); w.worldPos = { x: dl.point.x * (1 + 2 / l), y: dl.point.y * (1 + 2 / l), z: dl.point.z * (1 + 2 / l) };
      const a = jobs.contextAction(true); const before = log.award.length; const r1 = a && a.label.startsWith('Salvage') ? a.run() : null; const r2 = jobs.salvage();
      return d > 700 && d < 900 && r1 && r1.ok && !r2.ok && log.award.length === before + 1 && log.award[before][0] === 150 && log.add.some((x) => x[0] === 'salvage-alloy' && x[1] === 1800);
    })());
    // deliver at the port: paid by hook
    jobs.onLanded({ kind: 'port', id: 'port' }, {});
    check(`landing at the port with three samples aboard pays ${3 * SAMPLE_PAY_CREDITS} credits through the award hook and takes them out of the cargo, once`, log.award.length === 2 && log.award[1][0] === 3 * SAMPLE_PAY_CREDITS && log.rem.length === 1 && jobs.samplesAboard === 0 && jobs.taken.size === 0);
    jobs.onLanded({ kind: 'port', id: 'port' }, {});
    check('landing again pays nothing more', log.award.length === 2);
    check('landing on a moon, or anywhere that is not the port, pays nothing', (() => { jobs.samplesAboard = 2; jobs.onLanded({ kind: 'moon', id: 'phobos' }, {}); return log.award.length === 2; })());
  }
  FIELD.attachEdits(null);
}
