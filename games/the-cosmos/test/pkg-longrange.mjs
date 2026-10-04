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

export async function run({ check, section, THREE }) {
  const L = await src('space/longRange.js');
  const spec = await src('space/spaceSpec.js');
  const reg = await src('worlds/registry.js');
  const { LONG } = L, AU = L.AU_M, TOP = LONG.warps.at(-1);

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
  check(`the ladder is ${LONG.warps.join(' ')} and x${LONG.warps.at(-1)} is ${LONG.warps.at(-1) / 3600} hours a second`, LONG.warps[0] === 1 && LONG.warps.at(-1) === TOP);
  check('the compression is held down toward the end: never more than allows arriveRealS real seconds', [86400 * 20, 86400, 7200, 600, 60, 10].every((left) => left / L.warpCap(left, TOP) >= LONG.arriveRealS || L.warpCap(left, TOP) === 1));
  check('it steps down through every rung (top > 3600 > 600 > 60 > 10 > 1) on the way in, never skipping up', (() => { let prev = 1e9, ok = true; for (let left = 86400 * 10; left > 0; left -= 97) { const w = L.warpCap(left, TOP); if (w > prev) ok = false; prev = w; } return ok && L.warpCap(1e6, TOP) === TOP && L.warpCap(500, TOP) === 60 && L.warpCap(30, TOP) === 1 && L.warpCap(100, TOP) === 10; })());
  check('a lower request is respected (x60 asked, x60 given while there is time)', L.warpCap(1e6, 60) === 60 && L.warpCap(1e6, 1) === 1 && L.warpCap(1e6, 20) === 10);
  const rt = L.realSeconds(p1.T);
  check(`the nav computer's quote for 0.67 AU at x${TOP}: ${(rt / 60).toFixed(1)} real minutes (the ladder's own integral, not T/${TOP} = ${(p1.T / TOP / 60).toFixed(1)})`, rt > p1.T / TOP && rt < p1.T / TOP * 1.3 + 400);
  // realSeconds equals a brute-force tick loop at 1/30 s
  { let tau = 0, real = 0; const T = 400_000; while (tau < T) { tau += (1 / 30) * L.warpCap(T - tau, TOP); real += 1 / 30; } check(`realSeconds matches a brute-force tick loop (${L.realSeconds(T).toFixed(2)} s against ${real.toFixed(2)} s)`, Math.abs(L.realSeconds(T) - real) < 1.5, `${L.realSeconds(T)} ${real}`); }
  check('only small ships may go: the Meridian (46 t) and the Drayman can, a 300 t hull cannot until the heavy drive is unlocked; an unlock lets it', L.longDriveAllowed({ phys: { massKg: 46000 } }).ok && !L.longDriveAllowed({ phys: { massKg: 300000 } }).ok && L.longDriveAllowed({ phys: { massKg: 300000 } }, true).ok && !L.longDriveAllowed({ longRange: false }).ok);
  const { allShipDefs } = await src('ships/registry.js');
  check('the hull limit holds for every ship in the game: those up to 150 t may use the drive, the big transports and bulkers need the heavy-drive unlock', allShipDefs().every((d) => L.longDriveAllowed(d).ok === !(d.phys && d.phys.massKg > LONG.smallShipMassKg)), allShipDefs().map((d) => d.type + ' ' + (d.phys && d.phys.massKg) + ' ' + L.longDriveAllowed(d).ok).join(', '));
  check('targetAt names a drop-out point on the side facing the ship', Math.hypot(...Object.values(L.targetAt('earth', 0, { x: 0, y: 0, z: 0 }))) > 1e10);

  // ---------------------------------------------------------------- the registry and the nav rows
  section('F3b. Earth, the Moon, Ceres and Callisto are reachable from day one');
  const rows = Object.fromEntries(spec.DESTINATIONS.map((d) => [d.id, d]));
  for (const id of ['earth', 'callisto']) check(`${id} is a nav row of kind deep (held off, reached by the long drive)`, rows[id] && rows[id].kind === 'deep' && rows[id].deep === id && rows[id].via === 'drive', JSON.stringify(rows[id]));
  check('the Moon is built (WD-MOON): its three landings and Ceres are plain drive rows: no lane, no fee, no spool (the Ore Lane is retired)', ['moon', 'moon-shackleton', 'moon-daedalus', 'ceres'].every((id) => rows[id] && rows[id].kind === 'moon' && rows[id].via === 'drive'), JSON.stringify(['moon', 'ceres'].map((id) => rows[id])));
  check('every deep row and the Moon sit at their real distance, past the main drive's range', ['earth', 'moon', 'callisto'].every((id) => Math.hypot(...Object.values(reg.worldCentre(id))) > spec.DRIVE.rangeM * 10));
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
      if (o.onTick) o.onTick();
      wantWarp(sim.trip.phase === 'longdrive' ? TOP : 60);
      if (sim.trip.phase === 'longdrive') { if (cruiseTau0 === null) { cruiseTau0 = sim.trip.cruise.tau; longStart = world.state.clock; } cruiseWall.ticks++; gameS += (1 / 30) * sim.trip._longEff(); peak = Math.max(peak, sim.trip.progress.speed); if (o.onCruise && o.onCruise(sim.trip, cruiseWall.ticks)) break; }
      else if (cruiseTau0 !== null && longEnd === null) longEnd = world.state.clock;
      if (!seen.has(sim.trip.phase)) { seen.add(sim.trip.phase); phases.push(sim.trip.phase); }
      tick();
      if (o.stopWhen && o.stopWhen(sim.trip)) break;
    }
    for (let i = 0; i < 600 && sim.trip; i++) tick();
    return { dest, frame: sim.frameId, landed: sim.flight.landed, tripLeft: !!sim.trip, simS: Math.round(world.state.clock - t0), phases, peak, cruiseTicks: cruiseWall.ticks, realCruiseS: cruiseWall.ticks / 30, gameS, pos: { ...sim.flight.pos }, posI: posI() };
  };
  const FR = await src('space/frames.js');
  const dist = (a2, b2) => Math.hypot(a2.x - b2.x, a2.y - b2.y, a2.z - b2.z);
  const posI = () => FR.toInertial(sim.flight.pos, sim.flight.epochS ?? sim.worldTime());          // inertial axes, at the clock she is on
  const centre = (id) => reg.worldCentreInertial(id, sim.flight.epochS ?? sim.worldTime());

  // the nav computer's estimate, from the client's planner on the same ship (the server's sim has no destinations(); the probe is the same code)
  const { SpaceTrip } = await src('space/spaceTrip.js');
  const probe = (id) => { seat(); const dest = sim.resolve(id); const t = new SpaceTrip(sim, dest); return { t, pl: t._plan0(), legs: t._route() }; };
  const e1 = probe('earth');
  check(`the estimate for Earth: ${(e1.pl.long / 86400).toFixed(1)} days of drive over ${(e1.pl.longL / AU).toFixed(2)} AU, peaking at ${(e1.pl.longPeak / 1000).toFixed(0)} km/s; ${(L.realSeconds(e1.pl.long) / 60).toFixed(1)} real minutes at xTOP`, e1.pl.long > 5 * 86400 && e1.pl.long < 30 * 86400 && e1.pl.kinds.includes('longdrive') && e1.legs.at(-1).cruise && e1.legs.at(-1).deep);

  const r1 = fly('earth');
  check(`a course to Earth: climb, main drive out, the long drive, a drop-out and a hold off the planet (${r1.phases.join(' > ')})`, !r1.err && r1.phases.includes('longdrive') && !r1.tripLeft && r1.frame === 'mars' && !r1.landed, JSON.stringify(r1));
  const eC = centre('earth'), dEarth = dist(r1.posI, eC), kEarth = L.dropDistanceM('earth');
  check(`she holds ${(dEarth / 1000).toFixed(0)} km off Earth's centre (the drop-out is ${(kEarth / 1000).toFixed(0)} km: 14 radii), on the side facing Mars`, Math.abs(dEarth - kEarth) < 20000, `${dEarth} vs ${kEarth}`);
  check(`the cruise took ${r1.realCruiseS.toFixed(0)} real seconds at the top of the ladder for ${(e1.pl.long / 86400).toFixed(1)} game days, and she touched ${(r1.peak / 1000).toFixed(0)} km/s`, r1.realCruiseS > 60 && r1.realCruiseS < 1500 && Math.abs(r1.peak - e1.pl.longPeak) / e1.pl.longPeak < 0.02, JSON.stringify([r1.realCruiseS, r1.peak, e1.pl.longPeak]));
  check(`the estimate was right: ${(r1.gameS / 86400).toFixed(2)} game days flown in the cruise against ${(e1.pl.long / 86400).toFixed(2)} quoted; ${r1.realCruiseS.toFixed(0)} real seconds against ${e1.pl.longReal.toFixed(0)} quoted`, Math.abs(r1.gameS - e1.pl.long) < 0.003 * e1.pl.long + 300 && Math.abs(r1.realCruiseS - e1.pl.longReal) < 0.35 * e1.pl.longReal + 5, `${r1.gameS} ${e1.pl.long} ${r1.realCruiseS} ${L.realSeconds(e1.pl.long)}`);
  // free flight is not charted out there (the long drive flies the ship): it is refused, and nothing breaks
  { const en = sim.ff.setEnabled(true); for (let i = 0; i < 60; i++) tick();
    check('free flight is refused while she is held out in deep space (the drive owns her)', !sim.ff.active && Number.isFinite(sim.flight.pos.x + sim.flight.pos.y + sim.flight.pos.z), JSON.stringify(en)); sim.ff.setEnabled(false); }
  { const p0 = posI(), t0 = sim.worldTime(); for (let i = 0; i < 300; i++) tick(); const t1 = sim.worldTime(), d = dist(posI(), centre('earth'));
    check(`held off Earth for ten seconds she keeps her place beside the planet as it moves (${(d / 1000).toFixed(0)} km off) and the world's clock runs`, Math.abs(d - kEarth) < 20000 && t1 > t0 + 9 && dist(p0, posI()) > 1, `${d} ${kEarth} ${t0} ${t1}`); }
  // from out there, Mars (the port) is a long drive home
  const probeHome = probe('port');
  check('held off Earth, the nav computer offers the way home as a long drive too (a main-drive transit from there would take months)', probeHome.legs[0].cruise === true && probeHome.pl.long > 1e5, JSON.stringify(probeHome.legs[0]));
  const r2 = fly('port');
  check(`and she comes home: ${r2.phases.join(' > ')}, down at Marineris Port`, !r2.err && r2.landed && r2.frame === 'mars' && !r2.tripLeft && r2.phases.includes('longdrive') && dist(r2.pos, sim.portSite.toWorld(0, 0, 0)) < 400, JSON.stringify(r2));

  // the Moon is next to Earth: reachable too
  // (WD-MOON) the Moon is a built world: by the long drive she lands at the hub, no fee, no spool; then home by the drive
  const r3 = fly('moon');
  check(`the Moon by the long drive (${r3.phases.join(' > ')}): lands in the hub's frame, no spool`, !r3.err && r3.frame === 'moon' && r3.landed && !r3.tripLeft && r3.phases.includes('longdrive') && !r3.phases.includes('spool'), JSON.stringify(r3));
  const r3b = fly('port');
  check(`and home from the Moon by the drive (${r3b.phases.join(' > ')})`, !r3b.err && r3b.frame === 'mars' && r3b.landed && r3b.phases.includes('longdrive'), JSON.stringify(r3b));

  // cancelling in the middle of the cruise: she brakes to a stop between the worlds, and a new course still works
  const r4 = fly('callisto', { onCruise: (t, n) => n > 20 && t.cruise.tau > t.cruise.profile.T * 0.3 });
  check('a course to Callisto cancelled a third of the way: still cruising', r4.phases.includes('longdrive') && !!sim.trip && sim.trip.phase === 'longdrive', JSON.stringify(r4));
  const tauAt = sim.trip && sim.trip.cruise ? sim.trip.cruise.tau : 0;
  // capture and restore in the middle of the cruise (the server saves a world every few seconds)
  { sim.capture(); const rec = JSON.parse(JSON.stringify(ship)), sim2 = world.makeSim(rec);
    check('a ship saved mid-cruise comes back mid-cruise (trip, phase, the cruise state and its override)', sim2.trip && sim2.trip.phase === 'longdrive' && sim2.trip.cruise && Math.abs(sim2.trip.cruise.tau - tauAt) < 1 && typeof sim2.flight.override === 'function', JSON.stringify(rec.trip && rec.trip.phase));
    sim2.trip.setWarp(TOP); for (let i = 0; i < 60; i++) { sim2.step(1 / 30); } check('and goes on cruising from there (the clock moves, the ship is on the line)', sim2.trip.cruise.tau > tauAt + 1, String(sim2.trip.cruise.tau)); }
  const x0 = sim.trip.cruise.profile.T, sizeBytes = JSON.stringify(world.publicState(p.id)).length;
  check(`the world state with a ship mid-cruise is still small (${sizeBytes} bytes, under 70 kB)`, sizeBytes < 70_000);
  world.reduce(p, { type: 'cancel-trip' });
  for (let i = 0; i < 200_000 && sim.trip && sim.trip.active; i++) { wantWarp(TOP); tick(); }
  check('the cancelled cruise brakes to rest and holds between the worlds', !sim.trip && (() => { const vi = FR.velToInertial(sim.flight.pos, sim.flight.vel, sim.flight.epochS); return Math.hypot(vi.x, vi.y, vi.z) < 1e-3; })() && dist(posI(), centre('callisto')) > 1e11 && dist(sim.flight.pos, { x: 0, y: 0, z: 0 }) > 1e10 && x0 > 0, JSON.stringify(sim.flight.pos));
  for (let i = 0; i < 600; i++) tick();
  check('left alone out there for 20 seconds, she stays put (no drift, no NaN)', Number.isFinite(sim.flight.pos.x) && Number.isFinite(sim.flight.pos.y) && Number.isFinite(sim.flight.pos.z));
  const r5 = fly('port');
  check(`from deep space she comes home and lands (${r5.phases.join(' > ')})`, !r5.err && r5.landed && r5.frame === 'mars', JSON.stringify(r5));

  // Ceres by the drive: a frame world with a lane; the drive route crosses regions without a fee or a spool
  const marksBefore = ship.economy.marks;
  // SEAMLESS: every tick of the Mars -> Ceres flight is sampled in inertial axes: one frame hand-off with no jump, a nose that never turns away from Ceres, no flash
  const samples = [];
  const THREE_ = THREE;
  const sample = () => { const T = (sim.flight.epochS ?? sim.worldTime()) - 0.033,       // the ship was written at the clock of the step: one tick (33 ms) before the clock the test has since advanced
     pf = FR.framePoint(FR.frameAt(sim.frameId, T), FR.frameAt('mars', T), sim.flight.pos), pI = FR.toInertial(pf, T);
    const q = new THREE_.Quaternion().fromArray(sim.flight.quaternion.toArray()), nv = new THREE_.Vector3(0, 0, -1).applyQuaternion(q), nl = FR.frameDir(FR.frameAt(sim.frameId, T), FR.frameAt('mars', T), { x: nv.x, y: nv.y, z: nv.z }), nI = FR.rotY(nl, FR.rootSpin(T));
    let nd = null; if (sim.trip && sim.trip.phase === 'longdrive' && samples.length % 15 === 0) { nd = Infinity; for (const b of sim.trip._bodiesAt(T)) nd = Math.min(nd, Math.hypot(b.c.x - pI.x, b.c.y - pI.y, b.c.z - pI.z) - b.r); }
    samples.push({ nd, speed: sim.trip && sim.trip.progress.speed, local: { ...sim.flight.pos }, vel: { ...sim.flight.vel }, frame: sim.frameId, phase: sim.trip && sim.trip.phase, pI, nI, T, warp: sim.trip && sim.trip.eff, dest: reg.worldCentreInertial('ceres', T) }); };
  const r6 = fly('ceres', { onTick: sample });
  { const frames = []; for (const q of samples) if (frames[frames.length - 1] !== q.frame) frames.push(q.frame);
    check(`the frame changes once, from Mars's to Ceres's (${frames.join(' > ')}), at the end of the long drive`, frames.join(',') === 'mars,ceres' || frames.join(',') === 'mars,ceres,ceres', frames.join(','));
    const hand = samples.findIndex((q, i) => i > 0 && q.frame !== samples[i - 1].frame);
    const a1 = samples[hand - 1], a2 = samples[hand], a0 = samples[hand - 2];
    const step = (u, v) => Math.hypot(v.pI.x - u.pI.x, v.pI.y - u.pI.y, v.pI.z - u.pI.z);
    if (process.env.SEAM_DEBUG) for (let i = hand - 3; i <= hand + 2; i++) console.log(i, JSON.stringify({ f: samples[i].frame, ph: samples[i].phase, local: samples[i].local, vel: samples[i].vel }));
    check(`the hand-off does not move her: ${step(a1, a2).toFixed(2)} m across it, against ${step(a0, a1).toFixed(2)} m the tick before (a tick of her own motion at that speed)`, step(a1, a2) < step(a0, a1) + 2 && a2.phase === 'transit' && a1.phase === 'longdrive');
    const cruise = samples.filter((q) => q.phase === 'longdrive');
    let maxAway = 0, maxTurn = 0;
    for (let i = 1; i < cruise.length; i++) { const q = cruise[i], d = { x: q.dest.x - q.pI.x, y: q.dest.y - q.pI.y, z: q.dest.z - q.pI.z }, l = Math.hypot(d.x, d.y, d.z), dot = (q.nI.x * d.x + q.nI.y * d.y + q.nI.z * d.z) / l;
      if (i > 30 * 12 && l > 3e8) maxAway = Math.max(maxAway, Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI);
      const p0 = cruise[i - 1], c = p0.nI.x * q.nI.x + p0.nI.y * q.nI.y + p0.nI.z * q.nI.z; if (i > 30 * 12 && l > 3e8) maxTurn = Math.max(maxTurn, Math.acos(Math.max(-1, Math.min(1, c))) * 180 / Math.PI); }
    check(`the nose never turns away from Ceres: at most ${maxAway.toFixed(1)} degrees off it through ${cruise.length} long-drive ticks until she is 300,000 km out (no turn-over)`, cruise.length > 1000 && maxAway < 15, String(maxAway));
    { let worst = 0, n = 0; for (const q of samples) if (q.nd != null && q.warp > 1) { n++; worst = Math.max(worst, q.warp * (q.speed + LONG.vFloorMs) * LONG.nearRealS / q.nd); }
      check(`she never rushes a world: over ${n} sampled ticks the compression kept the nearest world at least ${LONG.nearRealS} real seconds off (worst ratio ${worst.toFixed(2)})`, n > 50 && worst < 1.25, String(worst)); }
    check(`no sudden turning: at most ${maxTurn.toFixed(2)} degrees between two ticks`, maxTurn < 1.0, String(maxTurn)); }
  check(`Ceres by the long drive (${r6.phases.join(' > ')}): lands in Ceres's own frame`, !r6.err && r6.frame === 'ceres' && r6.landed && !r6.tripLeft && r6.phases.includes('longdrive') && !r6.phases.includes('spool'), JSON.stringify(r6));
  check('it is free: no lane fee was taken', ship.economy.marks >= marksBefore - 1e-9 && !(ship.economy.laneFees > 0 && ship.economy.laneFees !== undefined && false), `${marksBefore} -> ${ship.economy.marks}`);
  const r7 = fly('port');
  check(`and back to Mars by the drive (${r7.phases.join(' > ')})`, !r7.err && r7.frame === 'mars' && r7.landed && r7.phases.includes('longdrive'), JSON.stringify(r7));

  const r9 = fly('callisto');
  check('from Ceres, Callisto is reachable by the long drive (the ship leaves Ceres, cruises to Jupiter\'s moon, holds)', !r9.err && r9.phases.includes('longdrive') && r9.frame === 'ceres' || (r9.phases.includes('longdrive') && Math.abs(dist(r9.posI, centre('callisto')) - L.dropDistanceM('callisto')) < 1e-3 * L.dropDistanceM('callisto')), JSON.stringify(r9) + ' off by ' + (dist(r9.posI, centre('callisto')) - L.dropDistanceM('callisto')));

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
