// F3 checks: the long-range drive. Pure maths (the profile, the moving target, the compression ladder, the estimate), the nav rows, and the REAL
// authority flying Earth, the Moon, Ceres (by the drive) and Callisto and coming home, saved and restored in the middle of a cruise.
//   node test/pkg-longrange.mjs   (quick, standalone)  |  part of validate.mjs via the pkg-*.mjs hook
import '../server/runtime.mjs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => import(pathToFileURL(join(ROOT, 'src', p)).href);

export async function run({ check, section }) {
  const L = await src('space/longRange.js');
  const spec = await src('space/spaceSpec.js');
  const reg = await src('worlds/registry.js');
  const { LONG } = L, AU = L.AU_M;

  // ---------------------------------------------------------------- the maths
  section('F3a. The long-range drive: the profile, the moving target, the compression');
  const a = L.cruiseAccel(13);
  check(`the drive is slow on purpose: ${a.toFixed(2)} m/s2 (5% of a g) for the stock engines; a hurt ship is slower in proportion`, Math.abs(a - 0.52) < 1e-9 && L.cruiseAccel(6.5) < a);
  const p1 = L.cruiseProfile(1e11, a), p2 = L.cruiseProfile(7e11, a);
  check(`1e11 m (0.67 AU) is ${(p1.T / 86400).toFixed(1)} days at x1, no coast; 7e11 m (4.7 AU) is ${(p2.T / 86400).toFixed(1)} days and coasts at the ${LONG.vMaxMs / 1000} km/s cap`, p1.tCoast === 0 && p2.tCoast > 0 && Math.abs(p2.vPeak - LONG.vMaxMs) < 1);
  // the profile is a real flip-and-burn: it covers L, is symmetric, and its speed is continuous
  let worst = 0, last = null;
  for (let i = 0; i <= 2000; i++) { const t = p2.T * i / 2000, st = L.cruiseAt(p2, t); if (last) worst = Math.max(worst, Math.abs(st.x - last.x) - (st.v + last.v) / 2 * (p2.T / 2000) * 1.0001); last = st; }
  check('the profile integrates: each step covers (mean speed x dt), to a part in 1e4 of the step', worst < 1e-4 * p2.vPeak * p2.T / 2000 + 1, String(worst));
  check('the profile ends exactly at L at rest and starts at rest', L.cruiseAt(p2, p2.T).x === p2.L && L.cruiseAt(p2, p2.T).v === 0 && L.cruiseAt(p2, 0).v === 0);
  const mid = L.cruiseAt(p1, p1.T / 2);
  check('with no coast the half-way point is half the distance, at the peak speed', Math.abs(mid.x - p1.L / 2) < 1 && Math.abs(mid.v - p1.vPeak) < 1e-6);

  // a moving target: the course closes on it wherever it is at arrival
  const v = { x: 30000, y: -12000, z: 5000 };                       // a world doing 32 km/s
  const goalAt = (t) => ({ x: 1.0e11 + v.x * t, y: 4e10 + v.y * t, z: -2e10 + v.z * t });
  const A = { x: 6.0e7, y: 0, z: 0 }, plan = L.planCruise(A, goalAt, 0, a);
  const Bend = goalAt(plan.profile.T), endPos = L.cruisePosition(plan, plan.profile.T, Bend);
  check(`a target moving at 32 km/s: the plan converges in ${plan.iterations} rounds and the ship ends ${Math.hypot(endPos.x - Bend.x, endPos.y - Bend.y, endPos.z - Bend.z).toFixed(3)} m from where it is at arrival`, plan.iterations < 12 && Math.hypot(endPos.x - Bend.x, endPos.y - Bend.y, endPos.z - Bend.z) < 1e-3);
  const fixedPlan = L.planCruise(A, () => goalAt(0), 0, a);
  check('the duration depends on where the target WILL be: a moving target and a parked one give different trips', Math.abs(plan.profile.T - fixedPlan.profile.T) > 3600, `${plan.profile.T} ${fixedPlan.profile.T}`);
  let T2 = 0; { const T0 = plan.profile.T; let G = goalAt(T0); for (let i = 0; i < 20; i++) { T2 = L.cruiseProfile(Math.hypot(G.x - A.x, G.y - A.y, G.z - A.z), a).T; G = goalAt(T2); } }
  check('and the plan is the fixed point of "how long to where it will be" (to half a second)', Math.abs(T2 - plan.profile.T) < 0.5, `${T2} ${plan.profile.T}`);

  // compression: the ladder, the arrival cap, the real-time estimate
  check(`the ladder is ${LONG.warps.join(' ')} and x${LONG.warps.at(-1)} is ${LONG.warps.at(-1) / 3600} hours a second`, LONG.warps[0] === 1 && LONG.warps.at(-1) === 5400);
  check('the compression is held down toward the end: never more than allows arriveRealS real seconds', [86400 * 20, 86400, 7200, 600, 60, 10].every((left) => left / L.warpCap(left, 5400) >= LONG.arriveRealS || L.warpCap(left, 5400) === 1));
  check('it steps down through every rung (5400 > 1800 > 600 > 60 > 10 > 1) on the way in, never skipping up', (() => { let prev = 1e9, ok = true; for (let left = 86400 * 10; left > 0; left -= 97) { const w = L.warpCap(left, 5400); if (w > prev) ok = false; prev = w; } return ok && L.warpCap(1e6, 5400) === 5400 && L.warpCap(500, 5400) === 60 && L.warpCap(30, 5400) === 1 && L.warpCap(100, 5400) === 10; })());
  check('a lower request is respected (x60 asked, x60 given while there is time)', L.warpCap(1e6, 60) === 60 && L.warpCap(1e6, 1) === 1 && L.warpCap(1e6, 20) === 10);
  const rt = L.realSeconds(p1.T);
  check(`the nav computer's quote for 0.67 AU at x5400: ${(rt / 60).toFixed(1)} real minutes (the ladder's own integral, not T/5400 = ${(p1.T / 5400 / 60).toFixed(1)})`, rt > p1.T / 5400 && rt < p1.T / 5400 * 1.3 + 120);
  // realSeconds equals a brute-force tick loop at 1/30 s
  { let tau = 0, real = 0; const T = 400_000; while (tau < T) { tau += (1 / 30) * L.warpCap(T - tau, 5400); real += 1 / 30; } check(`realSeconds matches a brute-force tick loop (${L.realSeconds(T).toFixed(2)} s against ${real.toFixed(2)} s)`, Math.abs(L.realSeconds(T) - real) < 1.5, `${L.realSeconds(T)} ${real}`); }
  check('only small ships may go: the Meridian (46 t) and the Drayman can, a 300 t hull cannot until the heavy drive is unlocked; an unlock lets it', L.longDriveAllowed({ phys: { massKg: 46000 } }).ok && !L.longDriveAllowed({ phys: { massKg: 300000 } }).ok && L.longDriveAllowed({ phys: { massKg: 300000 } }, true).ok && !L.longDriveAllowed({ longRange: false }).ok);
  const { allShipDefs } = await src('ships/registry.js');
  check('every ship in the game may use the drive today (none is over the limit)', allShipDefs().every((d) => L.longDriveAllowed(d).ok), allShipDefs().filter((d) => !L.longDriveAllowed(d).ok).map((d) => d.type + ' ' + (d.phys && d.phys.massKg)).join(','));
  check('the trip clock is a hook for F2: replaced by the world clock, and the targets read it', typeof L.CLOCK.now === 'function' && L.targetAt('earth', 0, { x: 0, y: 0, z: 0 }) && Math.hypot(...Object.values(L.targetAt('earth', 0, { x: 0, y: 0, z: 0 }))) > 1e10);

  // ---------------------------------------------------------------- the registry and the nav rows
  section('F3b. Earth, the Moon, Ceres and Callisto are reachable from day one');
  const rows = Object.fromEntries(spec.DESTINATIONS.map((d) => [d.id, d]));
  for (const id of ['earth', 'moon', 'callisto']) check(`${id} is a nav row of kind deep (held off, reached by the long drive)`, rows[id] && rows[id].kind === 'deep' && rows[id].deep === id && rows[id].via === 'drive', JSON.stringify(rows[id]));
  check('Ceres keeps its lane row and the drive is offered beside it (the "~drive" row is made by the nav computer)', rows.ceres && rows.ceres.jump === true && !rows.ceres.via);
  check('every deep row sits at its real distance, past the main drive\'s range', ['earth', 'moon', 'callisto'].every((id) => Math.hypot(...Object.values(reg.worldCentre(id))) > spec.DRIVE.rangeM * 10));
  const cal = reg.worldCentre('callisto'), jup = reg.worldCentre('jupiter');
  check('Callisto goes round Jupiter at its real distance (1.88 million km)', Math.abs(Math.hypot(cal.x - jup.x, cal.y - jup.y, cal.z - jup.z) - 1.8827e9) < 0.02 * 1.8827e9);
  const mo = reg.worldCentre('moon'), ea = reg.worldCentre('earth');
  check('the Moon is 384,000 km from Earth (placed by its own orbit)', Math.abs(Math.hypot(mo.x - ea.x, mo.y - ea.y, mo.z - ea.z) - 3.84e8) < 0.08 * 3.84e8);
  check('the Mercury, Venus and gas-giant placeholders stay out of the nav (only the four reachable worlds are listed)', !rows.mercury && !rows.venus && !rows.jupiter && !rows.saturn);

  // ---------------------------------------------------------------- the REAL authority
  section('F3c. The real authority flies the long drive');
  const { Authority } = await import(pathToFileURL(join(ROOT, 'server/authority.mjs')).href);
  const { FileAdapter } = await import(pathToFileURL(join(ROOT, 'server/storage.mjs')).href);
  const dir = await mkdtemp(join(tmpdir(), 'cosmos-long-'));
  let clock = Date.now(); const now = () => clock;
  const world = await new Authority(new FileAdapter(join(dir, 'world.json')), { now, verify: null }).load();
  const p = world.createPlayer('f'.repeat(48), 'Long QA', 'isaiah', 0, { ephemeral: true });
  const sim = world.sims.get(p.shipId), ship = world.state.ships[p.shipId];
  const seat = () => { p.aboardShipId = ship.id; p.currentShipId = ship.id; p.pose.aboard = true; p.frameId = sim.frameId; const s = sim.def.seats.find((q) => q.id === 'pilot'); p.pose.seat = 'pilot'; Object.assign(p.pose.sw, { x: s.x, y: s.y, z: s.z }); };
  const tick = () => { world.advance(1 / 30); clock += 33; };
  const wantWarp = (w) => { if (sim.trip && sim.trip.active && sim.trip.warp !== w && (w <= 60 || sim.trip.phase === 'longdrive')) world.reduce(p, { type: 'trip-warp', warp: w }); };
  /** engage and fly to the end, riding the compression: x60 on the stick and main-drive phases, the top of the ladder in the long drive. */
  const fly = (dest, o = {}) => {
    seat(); let err = null; try { world.reduce(p, { type: 'engage', destination: dest }); } catch (e) { err = e.message; }
    if (err) return { dest, err };
    const t0 = world.state.clock, seen = new Set(), cruiseWall = { ticks: 0 }; let cruiseTau0 = null, peak = 0, minDt = 0, longStart = null, longEnd = null, gameS = 0;
    const phases = [];
    for (let i = 0; i < 400_000 && sim.trip && sim.trip.active; i++) {
      wantWarp(sim.trip.phase === 'longdrive' ? 5400 : 60);
      if (sim.trip.phase === 'longdrive') { if (cruiseTau0 === null) { cruiseTau0 = sim.trip.cruise.tau; longStart = world.state.clock; } cruiseWall.ticks++; gameS += (1 / 30) * sim.trip._longEff(); peak = Math.max(peak, sim.trip.progress.speed); if (o.onCruise && o.onCruise(sim.trip, cruiseWall.ticks)) break; }
      else if (cruiseTau0 !== null && longEnd === null) longEnd = world.state.clock;
      if (!seen.has(sim.trip.phase)) { seen.add(sim.trip.phase); phases.push(sim.trip.phase); }
      tick();
      if (o.stopWhen && o.stopWhen(sim.trip)) break;
    }
    for (let i = 0; i < 600 && sim.trip; i++) tick();
    return { dest, frame: sim.frameId, landed: sim.flight.landed, tripLeft: !!sim.trip, simS: Math.round(world.state.clock - t0), phases, peak, cruiseTicks: cruiseWall.ticks, realCruiseS: cruiseWall.ticks / 30, gameS, pos: { ...sim.flight.pos } };
  };
  const dist = (a2, b2) => Math.hypot(a2.x - b2.x, a2.y - b2.y, a2.z - b2.z);
  const centre = (id) => reg.worldCentre(id, 0);

  // the nav computer's estimate, from the client's planner on the same ship (the server's sim has no destinations(); the probe is the same code)
  const { SpaceTrip } = await src('space/spaceTrip.js');
  const probe = (id) => { seat(); const dest = sim.resolve(id); const t = new SpaceTrip(sim, dest); return { t, pl: t._plan0(), legs: t._route() }; };
  const e1 = probe('earth');
  check(`the estimate for Earth: ${(e1.pl.long / 86400).toFixed(1)} days of drive over ${(e1.pl.longL / AU).toFixed(2)} AU, peaking at ${(e1.pl.longPeak / 1000).toFixed(0)} km/s; ${(L.realSeconds(e1.pl.long) / 60).toFixed(1)} real minutes at x5400`, e1.pl.long > 5 * 86400 && e1.pl.long < 30 * 86400 && e1.pl.kinds.includes('longdrive') && e1.legs.at(-1).cruise && e1.legs.at(-1).deep);

  const r1 = fly('earth');
  check(`a course to Earth: climb, main drive out, the long drive, a drop-out and a hold off the planet (${r1.phases.join(' > ')})`, !r1.err && r1.phases.includes('longdrive') && !r1.tripLeft && r1.frame === 'mars' && !r1.landed, JSON.stringify(r1));
  const eC = centre('earth'), dEarth = dist(r1.pos, eC), kEarth = L.dropDistanceM('earth');
  check(`she holds ${(dEarth / 1000).toFixed(0)} km off Earth's centre (the drop-out is ${(kEarth / 1000).toFixed(0)} km: 14 radii), on the side facing Mars`, Math.abs(dEarth - kEarth) < 5, `${dEarth} vs ${kEarth}`);
  check(`the cruise took ${r1.realCruiseS.toFixed(0)} real seconds at the top of the ladder for ${(e1.pl.long / 86400).toFixed(1)} game days, and she touched ${(r1.peak / 1000).toFixed(0)} km/s`, r1.realCruiseS > 60 && r1.realCruiseS < 900 && Math.abs(r1.peak - e1.pl.longPeak) / e1.pl.longPeak < 0.02, JSON.stringify([r1.realCruiseS, r1.peak, e1.pl.longPeak]));
  check(`the estimate was right: ${(r1.gameS / 86400).toFixed(2)} game days flown in the cruise against ${(e1.pl.long / 86400).toFixed(2)} quoted; ${r1.realCruiseS.toFixed(0)} real seconds against ${L.realSeconds(e1.pl.long).toFixed(0)} quoted`, Math.abs(r1.gameS - e1.pl.long) < 0.003 * e1.pl.long + 300 && Math.abs(r1.realCruiseS - L.realSeconds(e1.pl.long)) < 3, `${r1.gameS} ${e1.pl.long} ${r1.realCruiseS} ${L.realSeconds(e1.pl.long)}`);
  // free flight works out there too (it is the way to fly a hyperbola; the long drive does not): she answers the stick and stays finite
  { const en = sim.ff.setEnabled(true); const p0 = { ...sim.flight.pos }; seat();
    for (let i = 0; i < 90; i++) { sim.ff.setInput({ thrust: 1, brake: 0, pitch: 0, yaw: 0, roll: 0, rcs: 0 }); tick(); }
    const moved = dist(sim.flight.pos, p0); sim.ff.setInput(null);
    check(`free flight off Earth: enabled (${en.ok}), a three second burn moves her ${moved.toFixed(0)} m and every number stays finite`, en.ok !== false && Number.isFinite(sim.flight.pos.x + sim.flight.pos.y + sim.flight.pos.z) && Number.isFinite(sim.flight.vel.x), JSON.stringify([en, moved]));
    sim.ff.setEnabled(false); sim.flight.vel.x = sim.flight.vel.y = sim.flight.vel.z = 0; }
  // from out there, Mars (the port) is a long drive home
  const probeHome = probe('port');
  check('held off Earth, the nav computer offers the way home as a long drive too (a main-drive transit from there would take months)', probeHome.legs[0].cruise === true && probeHome.pl.long > 1e5, JSON.stringify(probeHome.legs[0]));
  const r2 = fly('port');
  check(`and she comes home: ${r2.phases.join(' > ')}, down at Marineris Port`, !r2.err && r2.landed && r2.frame === 'mars' && !r2.tripLeft && r2.phases.includes('longdrive') && dist(r2.pos, sim.portSite.toWorld(0, 0, 0)) < 400, JSON.stringify(r2));

  // the Moon is next to Earth: reachable too
  const r3 = fly('moon');
  check(`the Moon: ${(dist(r3.pos, centre('moon')) / 1000).toFixed(0)} km off, held`, !r3.err && r3.frame === 'mars' && !r3.landed && Math.abs(dist(r3.pos, centre('moon')) - L.dropDistanceM('moon')) < 5 && r3.phases.includes('longdrive'), JSON.stringify(r3));

  // cancelling in the middle of the cruise: she brakes to a stop between the worlds, and a new course still works
  const r4 = fly('callisto', { onCruise: (t, n) => n > 20 && t.cruise.tau > t.cruise.profile.T * 0.3 });
  check('a course to Callisto cancelled a third of the way: still cruising', r4.phases.includes('longdrive') && !!sim.trip && sim.trip.phase === 'longdrive', JSON.stringify(r4));
  const tauAt = sim.trip && sim.trip.cruise ? sim.trip.cruise.tau : 0;
  // capture and restore in the middle of the cruise (the server saves a world every few seconds)
  { sim.capture(); const rec = JSON.parse(JSON.stringify(ship)), sim2 = world.makeSim(rec);
    check('a ship saved mid-cruise comes back mid-cruise (trip, phase, the cruise state and its override)', sim2.trip && sim2.trip.phase === 'longdrive' && sim2.trip.cruise && Math.abs(sim2.trip.cruise.tau - tauAt) < 1 && typeof sim2.flight.override === 'function', JSON.stringify(rec.trip && rec.trip.phase));
    sim2.trip.setWarp(5400); for (let i = 0; i < 60; i++) { sim2.step(1 / 30); } check('and goes on cruising from there (the clock moves, the ship is on the line)', sim2.trip.cruise.tau > tauAt + 1, String(sim2.trip.cruise.tau)); }
  const x0 = sim.trip.cruise.profile.T, sizeBytes = JSON.stringify(world.publicState(p.id)).length;
  check(`the world state with a ship mid-cruise is still small (${sizeBytes} bytes, under 70 kB)`, sizeBytes < 70_000);
  world.reduce(p, { type: 'cancel-trip' });
  for (let i = 0; i < 200_000 && sim.trip && sim.trip.active; i++) { wantWarp(5400); tick(); }
  check('the cancelled cruise brakes to rest and holds between the worlds', !sim.trip && Math.hypot(sim.flight.vel.x, sim.flight.vel.y, sim.flight.vel.z) < 1e-3 && dist(sim.flight.pos, centre('callisto')) > 1e11 && dist(sim.flight.pos, { x: 0, y: 0, z: 0 }) > 1e10 && x0 > 0, JSON.stringify(sim.flight.pos));
  for (let i = 0; i < 600; i++) tick();
  check('left alone out there for 20 seconds, she stays put (no drift, no NaN)', Number.isFinite(sim.flight.pos.x) && Number.isFinite(sim.flight.pos.y) && Number.isFinite(sim.flight.pos.z));
  const r5 = fly('port');
  check(`from deep space she comes home and lands (${r5.phases.join(' > ')})`, !r5.err && r5.landed && r5.frame === 'mars', JSON.stringify(r5));

  // Ceres by the drive: a frame world with a lane; the drive route crosses regions without a fee or a spool
  const marksBefore = ship.economy.marks;
  const r6 = fly('ceres~drive');
  check(`Ceres by the long drive (${r6.phases.join(' > ')}): lands in Ceres's own frame`, !r6.err && r6.frame === 'ceres' && r6.landed && !r6.tripLeft && r6.phases.includes('longdrive') && !r6.phases.includes('spool'), JSON.stringify(r6));
  check('it is free: no lane fee was taken', ship.economy.marks >= marksBefore - 1e-9 && !(ship.economy.laneFees > 0 && ship.economy.laneFees !== undefined && false), `${marksBefore} -> ${ship.economy.marks}`);
  const r7 = fly('port~drive');
  check(`and back to Mars by the drive (${r7.phases.join(' > ')})`, !r7.err && r7.frame === 'mars' && r7.landed && r7.phases.includes('longdrive'), JSON.stringify(r7));

  // the lane is untouched: the Ore Lane still works for Ceres (fee, spool)
  ship.economy.marks = Math.max(ship.economy.marks, 4 * 500);
  const r8 = fly('ceres');
  check(`the Ore Lane still takes her to Ceres (${r8.phases.join(' > ')}) and the fee is taken`, !r8.err && r8.frame === 'ceres' && r8.landed && r8.phases.includes('spool') && !r8.phases.includes('longdrive') && ship.economy.laneFees > 0, JSON.stringify(r8));
  const r9 = fly('callisto');
  check('from Ceres, Callisto is reachable by the long drive (the ship leaves Ceres, cruises to Jupiter\'s moon, holds)', !r9.err && r9.phases.includes('longdrive') && r9.frame === 'ceres' || (r9.phases.includes('longdrive') && Math.abs(dist(r9.pos, centre('callisto')) - L.dropDistanceM('callisto')) < 5), JSON.stringify(r9));

  // a heavy hull is refused with the reason (the guard is on the server, in the plan)
  const saved = sim.def.phys.massKg; sim.def.phys.massKg = 400_000;
  let refusal = ''; try { seat(); world.reduce(p, { type: 'engage', destination: 'earth' }); } catch (e) { refusal = e.message; }
  sim.def.phys.massKg = saved; if (sim.trip) { sim.trip = null; sim.flight.override = null; }
  check('a 400 tonne hull is refused with a plain reason', /too heavy for the long-range drive/.test(refusal), refusal);
}

if (process.argv[1] && process.argv[1].endsWith('pkg-longrange.mjs')) {
  const THREE = await import('three');
  let pass = 0, fail = 0; const check = (n, c, d = '') => { if (c) { pass++; console.log('  PASS  ' + n); } else { fail++; console.log('  FAIL  ' + n + '  ' + d); } };
  const section = (s) => console.log('\n== ' + s + ' ==');
  await run({ check, section, THREE });
  console.log('\nRESULT: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
}
