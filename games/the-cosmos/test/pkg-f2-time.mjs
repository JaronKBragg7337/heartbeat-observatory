// F2 (Oct 3): real time and sky. Mars turns, the moons orbit, the Sun crosses the sky, frames move and turn, courses and free flight chase
// moving worlds, and the shared world agrees on the time. Called by validate.mjs through the pkg-*.mjs hook (no edit to it needed).
//   node test/pkg-f2-time.mjs        (runs alone)
import '../server/runtime.mjs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => import(pathToFileURL(join(ROOT, p)).href);
const DEG = Math.PI / 180;

export async function run({ check, section }) {
  const CLOCK = await src('src/space/clock.js'), FR = await src('src/space/frames.js'), E = await src('src/worlds/_kit/ephemeris.js');
  const reg = await src('src/worlds/registry.js'), spec = await src('src/space/spaceSpec.js'), FM = await src('src/core/frameMath.js');
  const { Transit, estimateTrip } = await src('src/space/transit.js');
  const len = (v) => Math.hypot(v.x, v.y, v.z);
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });

  section('F2a. The clock: game time is real UTC, one clock for everyone');
  {
    check('the epoch is 2026-10-03 00:00 UT, the same instant as the ephemeris START_JD (Julian date 2461316.5)', new Date(CLOCK.EPOCH_MS).toISOString() === '2026-10-03T00:00:00.000Z' && E.START_JD === 2461316.5);
    check('game time runs at the rate of the real clock (the calendar is not compressed): an hour of UTC is 3,600 game seconds', CLOCK.worldTimeAt(CLOCK.EPOCH_MS + 3_600_000) === 3600);
    // two browsers with clocks 7 s fast and 2 min slow, both told the server's time, agree with it
    const server = 1_800_000_000_000;
    const read = (skewMs) => { CLOCK.clock.nowMs = () => server + 5000 + skewMs; CLOCK.setServerTime(server, server + skewMs); const t = CLOCK.worldTimeS(); CLOCK.clock.offsetMs = 0; return t; };
    const a = read(7000), b = read(-120_000);
    CLOCK.clock.nowMs = () => Date.now(); CLOCK.clock.offsetMs = 0;
    check(`time of day is the server's for every player: two browsers whose clocks are 7 s fast and 2 min slow read the same game time after the handshake (${a.toFixed(3)} and ${b.toFixed(3)})`, Math.abs(a - b) < 1e-6);
  }

  section('F2b. Mars turns and the Sun crosses its sky; the moons orbit it');
  {
    const T0 = 12 * 3600;
    const turn = (E.rootSpin(T0 + 88642.66376) - E.rootSpin(T0) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
    check(`Mars's body-fixed axes turn once in 88,642.66 s (the IAU rate 350.89198226 degrees a day): after one sidereal day the angle is back (off by ${(turn / DEG).toExponential(1)} deg)`, Math.abs(turn) < 1e-7);
    const LAT = -14, LON = -59.2;
    const e0 = FR.sunAt(LAT, LON, T0), e1 = FR.sunAt(LAT, LON, T0 + FR.SOL_S);
    check(`a Martian solar day is 24 h 39 m 35 s: the Sun is back at the same height and the same local time after ${FR.SOL_S} s (${e0.elevDeg.toFixed(2)} and ${e1.elevDeg.toFixed(2)} degrees)`, Math.abs(e0.elevDeg - e1.elevDeg) < 0.4 && Math.abs(e0.hours - e1.hours) < 0.01);
    let hi = -90, lo = 90; for (let k = 0; k < 288; k++) { const q = FR.sunAt(LAT, LON, T0 + k * 300).elevDeg; hi = Math.max(hi, q); lo = Math.min(lo, q); }
    check(`over one sol at the port (14 S) the Sun climbs to ${hi.toFixed(0)} degrees and sinks to ${lo.toFixed(0)}: day and night are real (the equinox is near: a noon of about 76 degrees)`, hi > 70 && hi < 82 && lo < -70 && lo > -82);
    // the season: Mars's Ls = 0 fell at the end of September 2026, so the Sun is near the equator now and at +25 degrees a quarter of a Martian year later
    const dec = (T) => Math.asin(FR.sunDirFixed(T).y) / DEG;
    const decNow = dec(3 * 86400), dec90 = dec(3 * 86400 + 170 * 86400);
    check(`the seasons are right (the pole direction, the orbit and the date agree): the Sun is at ${decNow.toFixed(1)} degrees declination just after the equinox of 30 Sep 2026 and at ${dec90.toFixed(1)} a quarter-year on (northern summer, about +25)`, Math.abs(decNow) < 3 && dec90 > 22 && dec90 < 27.5);
    // the QA names land on what they say
    const T1 = 5 * 86400, sh = (n) => FR.sunAt(LAT, LON, T1 + FR.skyShiftFor(n, LAT, LON, T1));
    const dusk = sh('dusk'), dawn = sh('dawn'), noon = sh('noon'), night = sh('night');
    check(`?sky= names: dusk ${dusk.elevDeg.toFixed(1)} deg (${dusk.hours.toFixed(1)} h), dawn ${dawn.elevDeg.toFixed(1)} deg (${dawn.hours.toFixed(1)} h), noon ${noon.elevDeg.toFixed(0)} deg, night ${night.elevDeg.toFixed(0)} deg`, Math.abs(dusk.elevDeg + 1) < 0.6 && dusk.hours > 17 && dusk.hours < 19 && Math.abs(dawn.elevDeg + 1) < 0.6 && dawn.hours > 5 && dawn.hours < 7 && noon.elevDeg > 70 && night.elevDeg < -70);

    // moons: real periods, the right way round the sky
    const P = 0.31891 * 86400, ci0 = reg.worldCentreInertial('phobos', T0), ci1 = reg.worldCentreInertial('phobos', T0 + P), ci2 = reg.worldCentreInertial('phobos', T0 + P / 2);
    check(`Phobos goes round Mars in 7 h 39 min at 9,376 km: back where it was after one period (${len(sub(ci0, ci1)).toFixed(1)} m off), on the far side after half`, len(sub(ci0, ci1)) < 5 && len({ x: ci0.x + ci2.x, y: ci0.y + ci2.y, z: ci0.z + ci2.z }) < 5 && Math.abs(len(ci0) - 9_376_000) < 1);
    const kP = FR.worldKin('phobos', T0), kD = FR.worldKin('deimos', T0);
    check(`Phobos moves ${(len(kP.v) / 1000).toFixed(2)} km/s through the turning frame, east (faster than Mars turns: it rises in the west); Deimos ${(len(kD.v) / 1000).toFixed(2)} km/s, west (slower: it creeps up in the east)`, kP.yawRate > 0 && kD.yawRate < 0 && Math.abs(kP.yawRate - (2 * Math.PI / P - E.OMEGA)) < 1e-9 && Math.abs(kD.yawRate - (2 * Math.PI / (1.26244 * 86400) - E.OMEGA)) < 1e-9);
    const fdv = (id) => { const a = FR.worldKin(id, T0 - 5).c, b = FR.worldKin(id, T0 + 5).c, k = FR.worldKin(id, T0); return len(sub(k.v, { x: (b.x - a.x) / 10, y: (b.y - a.y) / 10, z: (b.z - a.z) / 10 })) / len(k.v); };
    check(`a moon's velocity is the rate of change of its place (checked against its position ten seconds either side): Phobos ${fdv('phobos').toExponential(1)}, Deimos ${fdv('deimos').toExponential(1)} off`, fdv('phobos') < 1e-5 && fdv('deimos') < 1e-5);
    // tidal lock: the moon's +X body axis (toward Mars) keeps pointing at Mars as it goes round
    let worst = 0; for (let k = 0; k < 20; k++) { const t = T0 + k * 1500, kk = FR.worldKin('phobos', t), lon = (-109 + 180) * DEG, ex = FR.rotY({ x: Math.cos(lon), y: 0, z: -Math.sin(lon) }, kk.yaw), toMars = { x: -kk.c.x / len(kk.c), y: 0, z: -kk.c.z / len(kk.c) }; worst = Math.max(worst, Math.abs(ex.x * toMars.x + ex.z * toMars.z - 1)); }
    check(`Phobos keeps one face to Mars: its long axis points at Mars through a whole orbit (worst error ${worst.toExponential(1)})`, worst < 1e-9);
  }

  section('F2c. Frames that move and turn: everything carried across keeps its place and its velocity');
  {
    const T = 40_000, ph = FR.frameAt('phobos', T), mars = FR.frameAt('mars', T);
    const p = { x: 3000, y: 9000, z: -5000 }, v = { x: 1.2, y: -0.4, z: 2.2 };
    const q = FM.framePoint(ph, mars, p, {}), back = FM.framePoint(mars, ph, q, {});
    check('a point carried from Phobos\'s frame to Mars\'s and back is where it was (to a nanometre)', len(sub(p, back)) < 1e-6);
    const w = FM.frameVel(ph, mars, p, v, {}), wb = FM.frameVel(mars, ph, q, w, {});
    check('and so is its velocity (the frames\' own motion is added and taken off)', len(sub(v, wb)) < 1e-9);
    // a point fixed to the ground of Phobos moves through Mars's axes at the rate its position changes
    const at = (t) => FM.framePoint(FR.frameAt('phobos', t), FR.frameAt('mars', t), p, {});
    const fd = { x: (at(T + 0.5).x - at(T - 0.5).x), y: (at(T + 0.5).y - at(T - 0.5).y), z: (at(T + 0.5).z - at(T - 0.5).z) }, vg = FM.frameVel(ph, mars, p, { x: 0, y: 0, z: 0 }, {});
    check(`a rock on Phobos moves through Mars's axes at ${(len(vg) / 1000).toFixed(3)} km/s, as its position says (error ${len(sub(fd, vg)).toExponential(1)} m/s): the ground and a ship that rides it agree`, len(sub(fd, vg)) < 1e-4);
    // carrying a ship: the held attitude turns with the frames
    const THREE = await import('three'), f = { pos: { ...q }, vel: { ...w }, attitude: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, 1.1, 0)) };
    const n0 = new THREE.Vector3(0, 0, -1).applyQuaternion(f.attitude), nExpect = FM.frameDir(mars, ph, { x: n0.x, y: n0.y, z: n0.z }, {});
    FR.carryFlight(f, mars, ph); const n1 = new THREE.Vector3(0, 0, -1).applyQuaternion(f.attitude);
    check('carrying a ship into Phobos\'s frame gives her the place and velocity of the rock she is over and turns her held attitude with the frame', len(sub(f.pos, p)) < 1e-6 && len(sub(f.vel, v)) < 1e-9 && len(sub({ x: n1.x, y: n1.y, z: n1.z }, nExpect)) < 1e-9);
  }

  section('F2d. The drive chases moving worlds: arrival at rest relative to the goal, within metres');
  {
    const T0 = 30 * 3600, aMax = 13, out = [];
    for (const id of ['phobos', 'deimos']) {
      const local = { x: 0, y: 11_500 + 1800, z: 0 }, gf = FR.inertialGoal((T) => FR.worldPointFixed(id, local, T), T0), hover = { x: 0, y: 3_389_500 + 120_000, z: 0 };
      const tr = new Transit({ pos: FR.toInertial(hover, T0), vel: FR.velToInertial(hover, { x: 0, y: 0, z: 0 }, T0), nose: { x: 0, y: 0, z: -1 }, up: { x: 0, y: 1, z: 0 }, goal: gf(0).pos, goalFn: gf, T0, aMax, vMax: 30000, turnRate: 0.12 });
      let n = 0; while (!tr.done && n++ < 200_000) tr.step(0.25);
      const g = gf(tr.t);
      const est = estimateTrip({ pos: FR.toInertial(hover, T0), vel: FR.velToInertial(hover, { x: 0, y: 0, z: 0 }, T0), nose: { x: 0, y: 0, z: -1 }, up: { x: 0, y: 1, z: 0 }, goal: gf(0).pos, goalFn: gf, T0, aMax, vMax: 30000, turnRate: 0.12 });
      out.push({ id, done: tr.done, secs: tr.t, errM: len(sub(tr.pos, g.pos)), relV: len(sub(tr.vel, g.vel)), est: est.seconds, moved: len(sub(g.pos, gf(0).pos)) });
    }
    check(`a course to ${out.map((o) => `${o.id} (${(o.secs / 60).toFixed(0)} min, the goal moved ${(o.moved / 1000).toFixed(0)} km meanwhile)`).join(' and ')} ends within ${Math.max(...out.map((o) => o.errM)).toFixed(2)} m of the moving standoff point at ${Math.max(...out.map((o) => o.relV)).toFixed(3)} m/s relative to it`,
      out.every((o) => o.done && o.errM < 2 && o.relV < 0.2 && o.moved > 1e6), JSON.stringify(out));
    check(`the nav computer's estimate is the flown time (${out.map((o) => `${o.id} ${o.est.toFixed(0)} s against ${o.secs.toFixed(0)} s`).join(', ')}), moving goals included`, out.every((o) => Math.abs(o.est - o.secs) < 1));
    // a goal that stands still behaves exactly as before: the same flight with and without a goalFn of zero velocity
    const hover = { x: 0, y: 3_389_500 + 120_000, z: 0 }, still = { x: 5_000_000, y: 3_000_000, z: 2_000_000 };
    const base = { pos: hover, vel: { x: 0, y: 0, z: 0 }, nose: { x: 0, y: 0, z: -1 }, up: { x: 0, y: 1, z: 0 }, goal: still, aMax, vMax: 30000, turnRate: 0.12 };
    const A = estimateTrip(base), B = estimateTrip({ ...base, goalFn: () => ({ pos: still, vel: { x: 0, y: 0, z: 0 }, acc: { x: 0, y: 0, z: 0 } }), T0: 0 });
    check(`a goal that stands still flies as before: ${A.seconds.toFixed(1)} s with no goal function, ${B.seconds.toFixed(1)} s with one that does not move`, Math.abs(A.seconds - B.seconds) < 0.5);
  }

  section('F2e. The real authority: Mars to Phobos and Deimos, landing on a moon that moves, a server that ticks lightly');
  {
    const { Authority } = await src('server/authority.mjs'), { FileAdapter } = await src('server/storage.mjs'), { makeMoon } = await src('src/space/moonField.js');
    const dir = await mkdtemp(join(tmpdir(), 'cosmos-f2-'));
    let clock = Date.UTC(2026, 9, 3, 14, 0, 0); const now = () => clock;
    const world = await new Authority(new FileAdapter(join(dir, 'world.json')), { now, verify: null }).load();
    const p = world.createPlayer('c'.repeat(48), 'F2 QA', 'isaiah', 0, { ephemeral: true });
    const sim = world.sims.get(p.shipId), ship = world.state.ships[p.shipId];
    const seat = () => { p.aboardShipId = ship.id; p.currentShipId = ship.id; p.pose.aboard = true; p.frameId = sim.frameId; const s = sim.def.seats.find((q) => q.id === 'pilot'); p.pose.seat = 'pilot'; Object.assign(p.pose.sw, { x: s.x, y: s.y, z: s.z, yaw: 0 }); sim.flight.toWorld(p.pose.sw, p.pose.worldPos); };
    const fly = (dest) => {
      seat(); world.reduce(p, { type: 'engage', destination: dest }); world.reduce(p, { type: 'trip-warp', warp: 60 });
      const wt0 = sim.worldTime(), t0 = world.state.clock; let epochSeen = false, maxEpochLead = 0, ms = 0, ticks = 0, lastEpoch = wt0;
      while (sim.trip && sim.trip.active && world.state.clock - t0 < 6000) {
        if (sim.trip.warp !== 60) sim.trip.setWarp(60);
        const a = performance.now(); world.advance(1 / 30); ms += performance.now() - a; ticks++; clock += 33;
        if (sim.flight.epochS != null) { epochSeen = true; lastEpoch = sim.flight.epochS; maxEpochLead = Math.max(maxEpochLead, sim.flight.epochS - sim.worldTime()); }
      }
      for (let i = 0; i < 300 && sim.trip; i++) { world.advance(1 / 30); clock += 33; }
      return { dest, wt0, lastEpoch, epochSeen, maxEpochLead, msPerTick: ms / Math.max(1, ticks) };
    };
    const mpad = (id) => { const r = ship.moonPads?.[id]; return r ? makeMoon(id).playerPad(r.east, r.north) : null; };
    for (const dest of ['phobos', 'deimos', 'phobos']) {
      const c0 = FR.worldKin(dest, sim.worldTime()).c, r = fly(dest), c1 = FR.worldKin(dest, r.lastEpoch).c;
      const pad = mpad(dest), f = sim.flight, off = pad ? len(sub(f.pos, pad.point)) : NaN, rel = len(f.vel);
      check(`Mars to ${dest}: the moon moved ${(len(sub(c1, c0)) / 1000).toFixed(0)} km while she flew, she ends LANDED in its frame on her own pad (${Number.isFinite(off) ? off.toFixed(1) : '?'} m from it, ${rel.toFixed(3)} m/s over the ground), and she is back on the world's clock (the ship's own clock ran ${(r.maxEpochLead / 60).toFixed(0)} min ahead of it under x60)`,
        sim.frameId === dest && f.landed && !sim.trip && f.epochS === null && r.epochSeen && len(sub(c1, c0)) > 1e6 && rel < 1.5 && (!Number.isFinite(off) || off < 40), JSON.stringify({ frame: sim.frameId, landed: f.landed, off, rel }));
      if (dest === 'phobos' && !check.__ticks) check.__ticks = r.msPerTick;
    }
    // lift off the moon, come back to Mars's port
    {
      seat(); world.reduce(p, { type: 'engage', destination: 'port' }); world.reduce(p, { type: 'trip-warp', warp: 60 });
      const t0 = world.state.clock; let ms = 0, ticks = 0;
      while (sim.trip && sim.trip.active && world.state.clock - t0 < 8000) { if (sim.trip.warp !== 60) sim.trip.setWarp(60); const a = performance.now(); world.advance(1 / 30); ms += performance.now() - a; ticks++; clock += 33; }
      for (let i = 0; i < 400 && !sim.flight.landed; i++) { world.advance(1 / 30); clock += 33; }
      const port = sim.portSite.toWorld(0, 0, 0), d = len(sub(sim.flight.pos, port));
      check(`and back from Phobos to the port: she lands at the pad of a planet that turned ${(((E.rootSpin(sim.worldTime()) - E.rootSpin(0)) / DEG) % 360).toFixed(0)} degrees since the start (${d.toFixed(1)} m from it, frame ${sim.frameId}, ${(ms / Math.max(1, ticks)).toFixed(2)} ms a tick at x60)`, sim.frameId === 'mars' && sim.flight.landed && d < 40, `d ${d}`);
      check(`the server tick stays light with the moving frames: ${(check.__ticks ?? 0).toFixed(2)} ms a tick flying a course at x60 (limit 8 ms)`, (check.__ticks ?? 99) < 8 && ms / Math.max(1, ticks) < 8);
    }
    // free flight at x500 in the turning frame costs little
    {
      const ff = sim.ff; seat(); const f = sim.flight;
      const r0 = 3_389_500 + 400_000, vc = Math.sqrt(spec.MARS_MU / r0), pos = { x: r0, y: 0, z: 0 };
      f.landed = false; f.airborne = true; f.pos = { ...pos }; f.vel = { x: 0 - E.OMEGA * 0, y: 0, z: -vc + E.OMEGA * r0 }; f.gearPos = 0; f.epochS = null; ff.enabled = true; ff._install(); ff.warp = 500;
      let ms = 0, n = 0; for (let i = 0; i < 300; i++) { const a = performance.now(); world.advance(1 / 30); ms += performance.now() - a; n++; clock += 33; }
      const el = (await src('src/space/freeflight.js')).orbitElements(f.pos, { x: f.vel.x + E.OMEGA * f.pos.z, y: f.vel.y, z: f.vel.z - E.OMEGA * f.pos.x }, spec.MARS_MU, 3_389_500);
      check(`free flight at x500 in the turning frame: ${(ms / n).toFixed(2)} ms a server tick, a circular orbit stays circular (e ${el.e.toExponential(1)}) and the ship's clock is ${((f.epochS - sim.worldTime()) / 3600).toFixed(1)} h ahead of the world's`, ms / n < 8 && el.e < 1e-3 && f.epochS - sim.worldTime() > 3600);
    }
  }
}

if (process.argv[1] && process.argv[1].endsWith('pkg-f2-time.mjs')) {
  let pass = 0, fail = 0;
  const check = (n, c, d = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + n + (c ? '' : '  ' + d)); c ? pass++ : fail++; };
  await run({ check, section: (s) => console.log('\n== ' + s + ' ==') });
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
}
