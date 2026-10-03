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
  check("F2: both moons are seen from the port: over a week each spends hours more than 10 degrees above the spawn's horizon (Phobos rises in the west and crosses twice a day; Deimos creeps round the sky in 5.5 days and hangs above the horizon for days)", (() => {
    const sp = GEO.geodeticToCartesian(mars, SPEC.SPAWN.lat, SPEC.SPAWN.lon, 2200), up = GEO.localFrame(SPEC.SPAWN.lat, SPEC.SPAWN.lon).up;
    const el = (id, t) => { const c = SPEC.moonCentre({ id }, t), d = { x: c.x - sp.x, y: c.y - sp.y, z: c.z - sp.z }, l = len(d); return Math.asin(dot({ x: d.x / l, y: d.y / l, z: d.z / l }, up)) * 180 / Math.PI; };
    const hours = (id) => { let n = 0; for (let k = 0; k < 7 * 24 * 4; k++) if (el(id, 1e6 + k * 900) > 10) n++; return n / 4; };
    return hours('phobos') > 3 && hours('deimos') > 3;
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
  // ROUND7: no crater rim, ejecta blanket or named-crater blanket ends in a cliff. Walk great circles round each moon in ~1 m steps and look at the biggest height jump.
  {
    for (const [name, body, Rm, cap] of [['Phobos', ph, 11000, 6], ['Deimos', dm, 6200, 3]]) {
      let worst = 0; const N = 40000;
      for (let tilt = 0; tilt < 3.1; tilt += 0.26) { let prev = null; for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2, x = Math.cos(a), y = Math.sin(a) * Math.cos(tilt), z = Math.sin(a) * Math.sin(tilt); const R = body.surfaceRadius(x, y, z); if (prev !== null) worst = Math.max(worst, Math.abs(R - prev)); prev = R; } }
      check(`${name}: walking round the moon in ${(Rm * 2 * Math.PI / N).toFixed(1)} m steps the ground never jumps more than ${cap} m (no cliff where a crater cell or a blanket was cut off): worst ${worst.toFixed(2)} m`, worst < cap);
    }
  }
  section('13. Space: walking, hopping and digging on Phobos');
  const store = new EditStore(ph); FIELD.attachEdits(store);
  const standOn = (w, e, n) => { const pi = ph.padInfo, x = pi.point.x + pi.east.x * e + pi.north.x * n, y = pi.point.y + pi.east.y * e + pi.north.y * n, z = pi.point.z + pi.east.z * e + pi.north.z * n, l = len({ x, y, z }), R = FIELD.surfaceRadiusFast(ph, x / l, y / l, z / l); w.worldPos = { x: x / l * (R + 0.02), y: y / l * (R + 0.02), z: z / l * (R + 0.02) }; w.velocity = { x: 0, y: 0, z: 0 }; w.grounded = true; w.updateFrame(); };
  const walker = new Walker(ph, { jumpSpeed: 0.6, suitHoldAccel: 0 });   // moons-fix: 0 = real gravity (the physics check below); the game's default has the boot-grip jets
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
    // moons-fix: Jaron stepped off the ramp on Phobos and floated away. The game's walker (default options) must stay down on every moon.
    const sink = (body, standFn) => {
      const out = {};
      const w = new Walker(body); standFn(w, 0, 0); for (let i = 0; i < 120; i++) w.tick(1 / 60, {});
      const r0 = len(w.worldPos); out.settled = w.grounded;
      let apex = 0, t = 0; w.tick(1 / 60, { jump: true }); for (let i = 0; i < 60 * 60; i++) { w.tick(1 / 60, {}); t += 1 / 60; apex = Math.max(apex, len(w.worldPos) - r0); if (w.grounded && t > 0.5) break; }
      out.hopApex = apex; out.hopT = t; out.hopGrounded = w.grounded;
      // stepped off a 3 m ledge with the ramp's push: 2 m/s up and 2 m/s along
      standFn(w, 5, 5); for (let i = 0; i < 60; i++) w.tick(1 / 60, {}); const up = { x: w.worldPos.x / len(w.worldPos), y: w.worldPos.y / len(w.worldPos), z: w.worldPos.z / len(w.worldPos) };
      w.worldPos.x += up.x * 3; w.worldPos.y += up.y * 3; w.worldPos.z += up.z * 3; w.velocity = { x: up.x * 6 + 2, y: up.y * 6, z: up.z * 6 }; w.grounded = false;
      const r1 = len(w.worldPos) - 3; let t2 = 0, apex2 = 0; for (let i = 0; i < 60 * 120; i++) { w.tick(1 / 60, {}); t2 += 1 / 60; apex2 = Math.max(apex2, len(w.worldPos) - r1); if (w.grounded) break; }
      out.fallT = t2; out.fallApex = apex2; out.fallGrounded = w.grounded;
      // walking 60 s, never airborne for long
      standFn(w, 0, 0); for (let i = 0; i < 60; i++) w.tick(1 / 60, {}); let air = 0, maxAir = 0, cur = 0; for (let i = 0; i < 60 * 60; i++) { w.yaw = 0.5; w.tick(1 / 60, { moveNorth: 1 }); if (!w.grounded) { air++; cur++; maxAir = Math.max(maxAir, cur); } else cur = 0; }
      out.walkAirFrac = air / 3600; out.walkMaxAirS = maxAir / 60;
      return out;
    };
    const standDm = (w, e, n) => { const pi = dm.padInfo, x = pi.point.x + pi.east.x * e + pi.north.x * n, y = pi.point.y + pi.east.y * e + pi.north.y * n, z = pi.point.z + pi.east.z * e + pi.north.z * n, l = len({ x, y, z }), R = FIELD.surfaceRadiusFast(dm, x / l, y / l, z / l); w.worldPos = { x: x / l * (R + 0.02), y: y / l * (R + 0.02), z: z / l * (R + 0.02) }; w.velocity = { x: 0, y: 0, z: 0 }; w.grounded = false; };
    // the phone run: the drawn ground sits a few cm above the field and the legs carry an upward speed up a slope. Only a deliberate hop may count as "rising".
    {
      const w = new Walker(ph); w.jumpSpeed = 0.6; standOn(w, 30, 10); for (let i = 0; i < 90; i++) w.tick(1 / 60, {});
      w.groundSampler = (dx, dy, dz) => FIELD.surfaceRadiusFast(ph, dx, dy, dz) + 0.05 - 0.04 * Math.sin(dx * 4000);
      const r = len(w.worldPos), up = { x: w.worldPos.x / r, y: w.worldPos.y / r, z: w.worldPos.z / r };
      w.grounded = false; w.velocity = { x: up.x * 0.7, y: up.y * 0.7, z: up.z * 0.7 };         // sliding up a slope, not hopping
      let tLand = null, air = 0, n = 0; for (let i = 0; i < 60 * 20; i++) { w.yaw = 0.6; w.tick(1 / 60, { moveNorth: 1, run: true }); if (w.grounded && tLand === null) tLand = i / 60; if (tLand !== null) { n++; if (!w.grounded) air++; } }
      check(`Phobos: walking up a slope with the drawn ground a hand above the feet takes the ground back at once (landed after ${tLand === null ? 'never' : tLand.toFixed(2) + ' s'}, airborne ${(100 * air / Math.max(1, n)).toFixed(1)}% of the walk), not "airborne (hop)" for ever`, tLand !== null && tLand < 0.5 && air / Math.max(1, n) < 0.05, `${tLand} ${air}/${n}`);
      w.groundSampler = null; for (let i = 0; i < 90 && !w.grounded; i++) w.tick(1 / 60, {}); w.velocity = { x: 0, y: 0, z: 0 }; for (let i = 0; i < 30; i++) w.tick(1 / 60, {});
      w.tick(1 / 60, { jump: true }); let hopAir = 0; for (let i = 0; i < 60 * 3; i++) { w.tick(1 / 60, {}); if (!w.grounded) hopAir++; }
      check('and a deliberate hop still leaves the ground for a while (a quarter of a second at least) before it comes back', hopAir / 60 > 0.25 && hopAir / 60 < 2.9, `${(hopAir / 60).toFixed(2)} s`);
    }
    for (const [name, body, fn] of [['Phobos', ph, standOn], ['Deimos', dm, standDm]]) {
      const o = sink(body, fn);
      check(`${name}: the game's own walker settles, a deliberate hop stays under 2.5 m and is back on the ground in under 8 s (apex ${o.hopApex.toFixed(2)} m, ${o.hopT.toFixed(1)} s)`, o.settled && o.hopGrounded && o.hopApex < 2.5 && o.hopApex > 0.3 && o.hopT < 8, JSON.stringify(o));
      check(`${name}: stepping off a ledge with a 6 m/s shove still comes down inside 20 s and never rises past 12 m (${o.fallT.toFixed(1)} s, ${o.fallApex.toFixed(1)} m)`, o.fallGrounded && o.fallT < 20 && o.fallApex < 12, JSON.stringify(o));
      check(`${name}: a minute of walking keeps the boots down: airborne under 15% of the time and never for more than 3 s at once (${(o.walkAirFrac * 100).toFixed(1)}%, longest ${o.walkMaxAirS.toFixed(1)} s)`, o.walkAirFrac < 0.15 && o.walkMaxAirS < 3, JSON.stringify(o));
    }
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
    const goal = goalOf('phobos');           // F2: the moon moves a metre in a millisecond: ask once
    tp = new Transit(mk(gate, up0, goal));
    const phases = [], seen = new Set(); let guard = 0, minR = 1e12, maxTurn = 0, prevNose = { ...tp.nose }, alignBad = 0, minArr = 1e9;
    while (!tp.done && guard++ < 20000) {
      tp.step(0.25); if (!seen.has(tp.phase)) { seen.add(tp.phase); phases.push(tp.phase); }
      minR = Math.min(minR, len(tp.pos));
      const ang = Math.acos(Math.min(1, Math.max(-1, dot(prevNose, tp.nose)))); maxTurn = Math.max(maxTurn, ang / 0.25); prevNose = { ...tp.nose };
      if (tp.thrust > 0 && !['creep'].includes(tp.phase)) { const a = len(tp.accel); if (a > 1e-9 && dot({ x: tp.accel.x / a, y: tp.accel.y / a, z: tp.accel.z / a }, tp.nose) < 0.999999) alignBad++; }
    }
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
    // ROUND7: the trip estimate must not depend on the exact height of the standoff point. It used to fly in 1 s steps (the controller is only stable at 0.25 s):
    // a standoff point 3 m higher never "arrived" (ETA 400,000 s) and another height gave 1,996 s instead of 1,801 s.
    {
      const goalAt = (m, dh) => { const b = makeMoon(m), c = b.centre, sp = b.standoffPoint(SPEC.STANDOFF_M + dh); return { x: c.x + sp.x, y: c.y + sp.y, z: c.z + sp.z }; };
      for (const m of ['phobos', 'deimos']) {
        const base = estimateTrip(mk(gate, up0, goalAt(m, 0))).seconds; let worst = 0, notArrived = 0;
        for (let dh = -40; dh <= 40; dh += 0.5) { const e = estimateTrip(mk(gate, up0, goalAt(m, dh))); if (!e.arrived || e.error > 2) notArrived++; worst = Math.max(worst, Math.abs(e.seconds - base) / base); }
        check(`${m}: the trip estimate arrives for every standoff height from -40 m to +40 m (161 heights) and stays within 1% of ${(base / 60).toFixed(1)} min`, notArrived === 0 && worst < 0.01, `${notArrived} did not arrive, worst ${(worst * 100).toFixed(2)}%`);
      }
      const bad = estimateTrip(mk(gate, up0, goalAt('phobos', 0), 1e-9));
      check('and when a flight really cannot arrive (no engine) the estimate says so and still gives a plain flip-and-burn figure, never the step cap', !bad.arrived && Number.isFinite(bad.seconds) && bad.seconds > 3600, JSON.stringify(bad));
    }
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
    const eng = Object.create(Engine.prototype), FM = await import('../src/core/frameMath.js');
    eng.rootFrame = FM.makeFrame('mars'); eng.activeFrame = eng.rootFrame; eng.cameraWorldPos = { x: 5, y: 6, z: 7 };
    const pc = { ...ph.centre }, pf = FM.makeFrame('phobos'); FM.setFrameState(pf, { c: pc, v: { x: 0, y: 0, z: 0 }, yaw: 0.7, yawRate: 0 });
    const sh = eng.frameShift(eng.rootFrame, pf), turned = FM.makeFrame('t'); FM.setFrameState(turned, { c: pc, v: { x: 0, y: 0, z: 0 }, yaw: 0, yawRate: 0 });
    check("a frame shift (two frames not turned against each other) is a pure translation: Mars-frame point + shift = the same point in Phobos's frame, and back", Math.abs(eng.frameShift(eng.rootFrame, turned).x + pc.x) < 1e-6 && Math.abs(eng.frameShift(eng.rootFrame, turned).z + pc.z) < 1e-6 && Math.abs(eng.frameShift(turned, eng.rootFrame).x - pc.x) < 1e-6);
    eng.setActiveFrame(pf);
    const back = eng.cameraIn(eng.rootFrame, {});
    check('switching the active frame keeps the camera where it is in space, through a frame that is turned (f64: it round-trips to a tenth of a micrometre at 9,400 km: an f64 step there is two nanometres)', Math.abs(back.x - 5) < 1e-7 && Math.abs(back.y - 6) < 1e-7 && Math.abs(back.z - 7) < 1e-7);
    // render positions: an entry in the Mars frame is drawn at the frame's turn and shift of its position, relative to the camera
    const worldPos = { x: 100, y: 0, z: 0 }, cam = eng.cameraWorldPos, inPf = eng.framePoint(eng.rootFrame, pf, worldPos, {});
    const draw = { x: inPf.x - cam.x, y: inPf.y - cam.y, z: inPf.z - cam.z }, c = Math.cos(0.7), s2 = Math.sin(0.7), rel = { x: 100 - pc.x, y: -pc.y, z: -pc.z };
    const want = { x: rel.x * c - rel.z * s2, y: rel.y, z: rel.x * s2 + rel.z * c };
    check("a Mars-frame object is still drawn where it really is while a moon's turned frame is active (relative to the camera, f64 to the millimetre)", Math.abs(draw.x - (want.x - cam.x)) < 1e-6 && Math.abs(draw.y - (want.y - cam.y)) < 1e-6 && Math.abs(draw.z - (want.z - cam.z)) < 1e-6);
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

  // ---- compression of the climb and the landing (space-fix) --------------------------------------------------------------------
  section('15b. Space: time compression in the climb and the landing');
  {
    const { stickWarpCap, bandCap, STICK_MAX_SIM_S } = SPEC;
    check('compression is x1 for the last 400 m whatever was asked, and at most x4 under 1.5 km, x10 under 6 km', stickWarpCap(60, 399, -10, 1 / 60) === 1 && stickWarpCap(60, 0, 0, 1 / 60) === 1 && stickWarpCap(60, 1000, 0, 1 / 60) <= 4 && stickWarpCap(60, 5000, 0, 1 / 60) <= 10 && bandCap(399) === 1);
    check('never more than asked, x1 stays x1, and it is non-increasing as the ship sinks (500 heights, all speeds)', (() => {
      for (let h = 20000; h > 0; h -= 40) { for (const v of [-900, -300, -60, 0, 300]) { const a = stickWarpCap(60, h, v, 1 / 60), b = stickWarpCap(60, h - 40, v, 1 / 60); if (b > a || a > 60 || stickWarpCap(1, h, v, 1 / 60) !== 1) return false; } }
      return true;
    })());
    check('a sinking ship can never skip from a fast band into the last 400 m inside two frames of the compression it is run at (all speeds to 900 m/s, heights to 30 km)', (() => {
      for (let h = 30000; h >= 400; h -= 25) for (const v of [-900, -500, -100, -20]) {
        const w = stickWarpCap(60, h, v, 1 / 60), sim = Math.min(w / 60, STICK_MAX_SIM_S);
        if (h - Math.abs(v) * sim * 2 < 400 && w > 1 && bandCap(h - Math.abs(v) * sim * 2) < w) return false;
      }
      return true;
    })());
    // a whole descent flown with the cap, the way the ship does it: the flight model is handed dt * warp and sub-steps it at 1/120 s
    const p0 = GEO.geodeticToCartesian(mars, -14, -59.2, 2300), l0 = len(p0), Rg = FIELD.surfaceRadiusFast(mars, p0.x / l0, p0.y / l0, p0.z / l0);
    const at = (a) => ({ x: p0.x / l0 * (Rg + a), y: p0.y / l0 * (Rg + a), z: p0.z / l0 * (Rg + a) });
    const groundM = (x, y, z) => FIELD.surfaceRadiusFast(mars, x, y, z);
    const fly = (warp, from, frameDt = 1 / 60) => {
      const f = new ShipBody(mars, groundM); f.setDown(at(3), 0); for (let i = 0; i < 540; i++) f.step(1 / 60);
      f.autoHover = true; f.controls.lift = 1; f.climbCap = 200; let guard = 0; while (f.agl < from && guard++ < 100000) f.step(1 / 30);
      f.controls.lift = 0; f.climbCap = 12; for (let i = 0; i < 90; i++) f.step(1 / 30);
      // spy on the sub-steps
      let maxH = 0, subs = 0; const orig = f._step.bind(f); f._step = (h) => { maxH = Math.max(maxH, h); subs++; orig(h); };
      f.climbCap = 800; f.autoHover = true; f.controls.lift = -1;
      let frames = 0, minAglCompressed = 1e9, topWarpNearGround = 0;
      while (!f.landed && frames++ < 200000) { const w = stickWarpCap(warp, f.agl, f.verticalSpeed, frameDt); if (f.agl < 400) topWarpNearGround = Math.max(topWarpNearGround, w); f.step(Math.min(frameDt * w, STICK_MAX_SIM_S)); }
      return { f, frames, maxH, subs, v: f.lastTouchdown ? f.lastTouchdown.v : 99, topWarpNearGround };
    };
    const slow = fly(1, 6000), fast = fly(60, 6000);
    check(`a 6 km landing at x60 takes ${fast.frames} frames where x1 takes ${slow.frames} (about ${(slow.frames / fast.frames).toFixed(0)} times fewer), touches down at ${fast.v.toFixed(2)} m/s (x1: ${slow.v.toFixed(2)}), no hull damage, all four legs`, fast.f.landed && fast.frames < slow.frames / 4 && fast.v < 3.0 && Math.abs(fast.v - slow.v) < 1.2 && fast.f.hull === 100);
    check('every flight sub-step is at most 1/120 s however much is compressed, so contact and landing checks are exact: the biggest sub-step run was ' + (1 / fast.maxH).toFixed(0) + ' per second', fast.maxH <= 1 / 120 + 1e-12 && fast.subs > slow.subs / 80);
    check('and nothing runs compressed inside the last 400 m: the highest compression used there was x' + fast.topWarpNearGround, fast.topWarpNearGround === 1);
    // the climb: the same seconds of flight at x60 and x1 reach the same height (the sub-stepping is the same physics)
    const climb = (warp) => { const f = new ShipBody(mars, groundM); f.setDown(at(3), 0); for (let i = 0; i < 540; i++) f.step(1 / 60); f.autoHover = true; f.controls.lift = 1; f.climbCap = 1500; let sim = 0; while (sim < 120) { const w = stickWarpCap(warp, f.agl, f.verticalSpeed, 1 / 60), d = Math.min(w / 60, STICK_MAX_SIM_S); f.step(d); sim += d; } return f.agl; };
    const c1 = climb(1), c60 = climb(60);
    check(`120 s of climb reaches ${c1.toFixed(0)} m at x1 and ${c60.toFixed(0)} m compressed: the same flight (within 3%)`, Math.abs(c1 - c60) / c1 < 0.03);
    // the phase list the panels show
    const { SpaceTrip } = await import('../src/space/spaceTrip.js');
    const fp = new ShipBody(mars, groundM); fp.setDown(at(3), 0); for (let i = 0; i < 540; i++) fp.step(1 / 60);
    const sp = { frameId: 'mars', ship: { flight: fp }, _shipS: () => ({ ...fp.pos }), _gatePoint: (q) => { const l = len(q), R = 3389500 + SPEC.DRIVE.gateAltM; return { x: q.x / l * R, y: q.y / l * R, z: q.z / l * R }; }, say() {}, moonWorld() { return null; }, timeS: () => 1e6, worldTime: () => 1e6 };
    const dest = { id: 'phobos', kind: 'moon', moon: 'phobos', name: 'Phobos', goalS: () => goalOf('phobos'), fixedAt: () => goalOf('phobos') };
    const tp2 = new SpaceTrip(sp, dest); tp2.phase = 'lift'; tp2.planS = tp2._plan0();
    const names = tp2.phases().map((q) => q.name + ':' + q.state);
    check('the trip lists every phase with its state and time left: ' + names.join(', '), tp2.phases().length === 3 && tp2.phases()[0].state === 'now' && tp2.phases()[1].state === 'next' && tp2.phases()[2].state === 'next' && tp2.phases().every((q) => q.leftS > 0));
    const leftAt = (alt, v) => { fp.pos = { ...at(alt) }; fp.vel = { x: 0, y: 0, z: 0 }; tp2.phase = 'ascent'; tp2.f.verticalSpeed; return tp2._climbS(SPEC.DRIVE.gateAltM - alt, v); };
    check('the climb time left falls as the ship rises and as it gains speed', leftAt(1000, 50) > leftAt(50000, 400) && leftAt(50000, 100) > leftAt(50000, 600));
    tp2.phase = 'transit'; tp2.progress.etaS = 900; const ph2 = tp2.phases();
    check('in the drive the first phase is done, the drive shows its own time left (compressed by the chosen x), the descent is still to come', ph2[0].state === 'done' && ph2[1].state === 'now' && ph2[1].leftS === 900 && ph2[2].state === 'next' && (tp2.warp = 20, Math.abs(tp2.wallS(tp2.phases()[1]) - 45) < 1e-9));
    tp2.warp = 60; tp2.phase = 'transit'; const dq = tp2.phases()[2];
    check('the descent estimate keeps its last 30 s at x1 even when x60 is chosen (the cap near the ground), so it is never shown as a couple of seconds', tp2.wallS(dq) >= 30 && tp2.wallS(dq) < dq.leftS);
    tp2.phase = 'descent'; const ph3 = tp2.phases();
    check('in the descent the first two are done and the descent time left is the flare law: more from 1.8 km than from 100 m', ph3[0].state === 'done' && ph3[1].state === 'done' && ph3[2].state === 'now' && tp2._descentS(1800, 60) > tp2._descentS(100, 60) && tp2._descentS(120000, 800) > tp2._descentS(6000, 800));
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
