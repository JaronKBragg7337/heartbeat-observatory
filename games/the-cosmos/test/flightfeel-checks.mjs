// Checks for FLIGHTFEEL (src/ship/flightAssist.js, shipFlight.js hand modes, speedFx.js, the stick wiring in shipSystem.js, the authority's lease in server/).
// Everything runs the real code: the real ShipBody on the real Mars ground and the real port pads, the real authority and the real server socket.
// The phone is checked in a browser: docs/qa/2026-10-03/flightfeel/ (REVIEW.md) and test/phone-check.mjs.
import '../server/runtime.mjs';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../server/index.mjs';
import { FileAdapter } from '../server/storage.mjs';
import { TestClient } from './multiplayer-checks.mjs';

export async function runFlightFeelChecks({ check, section, THREE, mars, FIELD }) {
  const { createPortSite } = await import('../src/port/portSpec.js');
  const { ShipBody } = await import('../src/ship/shipFlight.js');
  const FA = await import('../src/ship/flightAssist.js');
  const { SpeedFx, fovKickDeg } = await import('../src/ship/speedFx.js');
  const { ASSIST, vmaxAt, vclimbAt } = FA;

  section('62. Flight feel: assisted and Newtonian hand flight');
  const site = createPortSite(mars); FIELD.attachGrades([site]);
  const ground = (x, y, z) => FIELD.surfaceRadiusFast(mars, x, y, z);
  const make = () => { const f = new ShipBody(mars, ground); f.setDown(site.toWorld(0, 3.8, 0), site.heading); for (let i = 0; i < 540; i++) f.step(1 / 60); return f; };
  const A = (o = {}) => ({ fwd: 0, lift: 0, yaw: 0, pitch: 0, strafe: 0, boost: 0, land: 0, level: 1, mode: 'assist', ...o });
  const run = (f, c, s, hz = 30, cb = null) => { Object.assign(f.controls, c); if (c.mode === undefined) delete f.controls.mode; for (let i = 0; i < s * hz; i++) { f.step(1 / hz); if (cb && cb(f, i / hz)) break; } };
  const at = (f, h) => { const g = f.pos, r = Math.hypot(g.x, g.y, g.z), gr = ground(g.x / r, g.y / r, g.z / r); f.pos = { x: g.x / r * (gr + h), y: g.y / r * (gr + h), z: g.z / r * (gr + h) }; f.vel = { x: 0, y: 0, z: 0 }; f.landed = false; f.airborne = true; f.autoHover = true; f.gearPos = h < 70 ? 1 : 0; f.refreshOrientation(); return f; };

  // ---- the numbers scale with height, and the old low caps are gone ------------------------------------------------------
  check(`speed scales with height: ${vmaxAt(0).toFixed(0)} m/s at the ground, ${vmaxAt(1000).toFixed(0)} at 1 km, ${vmaxAt(50000).toFixed(0)} at 50 km, ${vmaxAt(400000).toFixed(0)} in space (the old cruise was 40)`,
    vmaxAt(0) >= 40 && vmaxAt(1000) > 8 * vmaxAt(0) && vmaxAt(50000) > vmaxAt(1000) && vmaxAt(400000) >= 5000 && vclimbAt(0) >= 20 && vclimbAt(2000) > 10 * 12 / 2);
  { let up = true, prev = 0; for (let h = 0; h < 600000; h += 500) { const v = vmaxAt(h); if (v < prev - 1e-9) up = false; prev = v; } check('the top speed never drops as she climbs (no kink)', up); }

  // ---- take-off: a push on the stick leaves the ground, no "find lift first" ----------------------------------------------
  { const f = make(); let t0 = null;
    run(f, A({ fwd: 1 }), 6, 30, (s, t) => { if (s.agl > 10 && t0 === null) { t0 = t; return true; } });
    const g = make(); let t1 = null; run(g, { fwd: 0, lift: 1, yaw: 0 }, 8, 30, (s, t) => { if (s.agl > 20 && t1 === null) { t1 = t; return true; } });
    check(`a first push forward on the pad takes her off, not a refusal (10 m clear in ${t0 === null ? 'never' : t0.toFixed(1) + ' s'}; the old stick needed LIFT first, and took ${t1 === null ? 'over 8' : t1.toFixed(1)} s to 20 m)`, t0 !== null && t0 < 2.5);
    const h = make(); let t2 = null; run(h, A({ lift: 1 }), 8, 30, (s, t) => { if (s.agl > 20 && t2 === null) { t2 = t; return true; } });
    check(`UP alone: 20 m in ${t2 === null ? 'never' : t2.toFixed(1)} s`, t2 !== null && t2 < 2.5); }

  // ---- climb and descent are not capped at 12 m/s ------------------------------------------------------------------------------
  { const f = make(); run(f, A({ lift: 1 }), 5); const climb = f.verticalSpeed;
    check(`climb is quick: ${climb.toFixed(0)} m/s up after 5 s of UP (the old pods were capped at 12)`, climb > 40);
    run(f, A({ lift: -1 }), 6); const sink = f.verticalSpeed;
    check(`and descent too: ${sink.toFixed(0)} m/s ${sink < -20 ? 'down' : '(slow)'} after 6 s of DOWN from ${(f.agl).toFixed(0)} m`, sink < -20 || f.landed); }

  // ---- point and go, and flight assist kills the drift when the stick is released --------------------------------------------------
  { const f = at(make(), 120); run(f, A({ fwd: 1 }), 8); const v1 = f.groundSpeed;
    check(`point and go: ${v1.toFixed(0)} m/s after 8 s of FORWARD at 120 m (the old cruise was 40; the top at 120 m is ${vmaxAt(120).toFixed(0)}, a little less over a dip)`, v1 > 70);
    const h0 = f.heading; run(f, A({ fwd: 1, yaw: 1 }), 1); const turned = ((f.heading - h0 + Math.PI * 4) % (Math.PI * 2)); 
    check(`the nose follows the stick: ${(turned * 57.3).toFixed(0)} degrees right in 1 s of full turn`, turned > 0.9 && turned < 2.1);
    run(f, A(), 8); check(`let go and the flight assist kills the drift: ${f.speed.toFixed(1)} m/s after 8 s (from ${v1.toFixed(0)}), holding her height (${f.agl.toFixed(0)} m, the ground rose under her)`, f.speed < 1.5 && f.agl > 80 && f.agl < 260); }

  // ---- aim: a nose-up pitch climbs along the aim, and eases back to the horizon (auto-level) --------------------------------------------
  { const f = at(make(), 200); run(f, A({ fwd: 1, pitch: 1 }), 1.2); const p = f.aimPitch, up0 = f.verticalSpeed;
    check(`pitch the nose up and she climbs along it (aim ${(p * 57.3).toFixed(0)} deg, ${up0.toFixed(0)} m/s up)`, p > 0.5 && up0 > 20);
    run(f, A({ fwd: 1, pitch: 0, level: 1 }), 6); check(`released, the nose eases back to the horizon (${(f.aimPitch * 57.3).toFixed(1)} deg)`, Math.abs(f.aimPitch) < 0.12);
    const g = at(make(), 200); run(g, A({ fwd: 1, pitch: 1, level: 0 }), 1); const p0 = g.aimPitch; run(g, A({ fwd: 1, pitch: 0, level: 0 }), 4);
    check('with level off (R held) the nose stays where it was put', Math.abs(g.aimPitch - p0) < 0.02); }
  { const f = at(make(), 6); run(f, A({ fwd: 1, pitch: 1, level: 0 }), 4); check(`near the ground the nose is held near the horizon: pitch ${(f.aimPitch * 57.3).toFixed(0)} deg at ${f.agl.toFixed(0)} m (auto-level)`, f.aimPitch < FA.pitchLimitAt(f.agl) + 0.06); }

  // ---- the landing assist: DOWN or LAND sets her down softly from any height -----------------------------------------------------------------
  for (const [h, how] of [[25, 'down'], [150, 'down'], [800, 'land'], [3000, 'land']]) {
    const f = at(make(), h); let td = null, t = 0;
    run(f, how === 'land' ? A({ land: 1 }) : A({ lift: -1 }), 120, 30, (s, tt) => { for (const e of s.events) if (e.type === 'touchdown') td = e.speed; t = tt; return s.landed; });
    check(`${how === 'land' ? 'LAND' : 'DOWN'} from ${h} m: down in ${t.toFixed(0)} s at ${td === null ? '?' : td.toFixed(1)} m/s, no damage (the old stick took ${h <= 150 ? '5-17' : 'minutes'} s)`, f.landed && td !== null && td < 2.5 && f.hull === 100);
  }
  { // hands off and slow just above the ground: she settles by herself
    const f = at(make(), 3); run(f, A(), 8); check('slow and low with nothing asked: the landing assist sets her on her legs by itself', f.landed); }
  { // a pad close by pulls her in
    const pad = site.toWorld(0, 0, 0), f = make();
    f.landingPads = () => [pad]; const g0 = at(f, 60); const r = Math.hypot(pad.x, pad.y, pad.z); void r;
    const e = site.toWorld(55, 0, 20); const rr = Math.hypot(e.x, e.y, e.z), gg = ground(e.x / rr, e.y / rr, e.z / rr);
    g0.pos = { x: e.x / rr * (gg + 60), y: e.y / rr * (gg + 60), z: e.z / rr * (gg + 60) }; g0.refreshOrientation();
    run(g0, A({ land: 1 }), 60, 30, (s) => s.landed);
    const off = Math.hypot(g0.pos.x - pad.x, g0.pos.y - pad.y, g0.pos.z - pad.z);
    check(`LAND with a pad 60 m off sets her on the pad (${off.toFixed(1)} m from its centre)`, g0.landed && off < 9); }
  { // rough ground away from the port: a hand landing always ends landed (the old stick could hang on her belly for ever)
    let stuck = 0, n = 0;
    for (let i = 0; i < 12; i++) { const gp = site.toWorld(900 + i * 211, 0, ((i * 389) % 1700) - 800), f = make(); const rr = Math.hypot(gp.x, gp.y, gp.z), g = ground(gp.x / rr, gp.y / rr, gp.z / rr);
      f.pos = { x: gp.x / rr * (g + 12), y: gp.y / rr * (g + 12), z: gp.z / rr * (g + 12) }; f.vel = { x: 0, y: 0, z: 0 }; f.landed = false; f.airborne = true; f.autoHover = true; f.heading = i * 0.9; f.refreshOrientation();
      run(f, A({ lift: -1 }), 40, 30, (s) => s.landed); n++; if (!f.landed || f.hull < 100) stuck++; }
    check(`on rough ground (${n} spots, 1 to 3 km out) a hand landing always ends down and undamaged (${stuck} failed)`, stuck === 0); }

  // ---- boost ------------------------------------------------------------------------------------------------------------------------------
  { const f = at(make(), 150), g = at(make(), 150); run(f, A({ fwd: 1 }), 6); run(g, A({ fwd: 1, boost: 1 }), 6);
    check(`boost: ${g.groundSpeed.toFixed(0)} m/s boosting vs ${f.groundSpeed.toFixed(0)} m/s not, and it spends a charge (${(g.boostCharge * 100).toFixed(0)}% left)`, g.groundSpeed > f.groundSpeed * 1.6 && g.boostCharge < 0.5);
    run(g, A({ fwd: 1, boost: 1 }), 8); check('with the charge gone the boost shuts off by itself', !g.boosting && g.boostCharge < 0.1);
    run(g, A({ fwd: 1 }), 12); check(`and it comes back (${(g.boostCharge * 100).toFixed(0)}% after 12 s)`, g.boostCharge > 0.8); }

  // ---- the power split still decides whether she flies; the old law is untouched for autopilots ------------------------------------------------
  { const f = make(); f.routePower('engines', 10); run(f, A({ lift: 1 }), 6); check('with the engines starved (10%) she cannot leave the ground by hand either: the overboost needs a ship that can lift her own weight', f.landed && f.agl < 3); }
  { const f = make(); let vmax = 0, climbMax = 0; run(f, { fwd: 1, lift: 1, yaw: 0 }, 20, 30, (s) => { vmax = Math.max(vmax, s.groundSpeed); climbMax = Math.max(climbMax, s.verticalSpeed); });
    check(`controls with no mode (a course, a crew pilot, an escort) fly the old law unchanged: top ${vmax.toFixed(0)} m/s ground speed, ${climbMax.toFixed(1)} m/s climb (cap 12)`, vmax < 42 && climbMax < 12.6 && !f.boosting && f.boostCharge === 1); }

  // ---- Newtonian: the stick is thrust, nothing brakes her ------------------------------------------------------------------------------------
  { const f = at(make(), 150); run(f, A({ mode: 'newtonian', fwd: 1 }), 4); const a = f.groundSpeed / 4, rated = f.maxDriveN / f.massKg;
    check(`Newtonian: she accelerates at the engines' rated ${rated.toFixed(1)} m/s2 (measured ${a.toFixed(1)}), not the assist's overboost`, Math.abs(a - rated) < rated * 0.15);
    const v = f.groundSpeed; run(f, A({ mode: 'newtonian' }), 12); check(`and when the stick is released she keeps her speed: ${f.groundSpeed.toFixed(1)} of ${v.toFixed(1)} m/s after 12 s (no drag, no brake)`, f.groundSpeed > v * 0.97);
    run(f, A({ mode: 'newtonian', fwd: -1 }), 5); check('real physics braking: reverse thrust slows her at half the forward rate', f.groundSpeed < v * 0.9 && f.groundSpeed > 0);
    check(`the hover trim holds her up without a thumb on UP (the pods carry her own weight: ${f.verticalSpeed.toFixed(2)} m/s vertical after 21 s of flying)`, Math.abs(f.verticalSpeed) < 1.5); }
  { const f = at(make(), 60); run(f, A({ mode: 'newtonian', lift: -1 }), 20, 30, (s) => s.landed || s.agl < 1);
    check('Newtonian has no landing assist: a held DOWN is a real descent (she can be put down hard)', f.landed || f.lastTouchdown !== null); }

  // ---- the speed picture ------------------------------------------------------------------------------------------------------------------------------
  check('the field of view widens with speed (and a boost) and is zero when crawling', fovKickDeg(0, 400) === 0 && fovKickDeg(400, 400) > 12 && fovKickDeg(400, 400, true) > fovKickDeg(400, 400) && fovKickDeg(2000, 400) <= 22.001);
  { const sc = { children: [], add(o) { this.children.push(o); } }; const fx = new SpeedFx(sc, { tier: 'low' }); const cam = { x: 3389500, y: 0, z: 0 };
    let k0 = fx.update(1 / 60, cam, { x: 0, y: 0, z: 0 }), vis0 = fx.lines.visible;
    for (let i = 0; i < 60; i++) { cam.z += 200 / 60; fx.update(1 / 60, cam, { x: 0, y: 0, z: 200 }, { vmax: 400 }); }
    check('streaks past the camera are off when still, on and growing with speed, drawn as one line object', k0 === 0 && !vis0 && fx.lines.visible && fx.mat.opacity > 0.2 && sc.children.length === 1); }

  // ---- the authority: the lease is intent only, hand flight happens on the server --------------------------------------------------------------------------
  const dir = await mkdtemp(join(tmpdir(), 'cosmos-flightfeel-')); let app, a, c; let clock = Date.now();
  try {
    app = await startServer({ adapter: new FileAdapter(join(dir, 'world.json')), port: 0, tick: false, now: () => clock });
    a = new TestClient(app.url, 'f'.repeat(48), 'Pilot'); c = new TestClient(app.url, 'd'.repeat(48), 'Passenger'); await a.connect(); await c.connect();
    const world = app.world, pa = world.state.players[a.id], pc = world.state.players[c.id], rec = world.state.ships[pa.shipId];
    const S = () => world.sims.get(rec.id);
    const sit = (p, id, ship, s) => { const seat = s.def.seats.find((q) => q.id === id); p.aboardShipId = ship.id; p.currentShipId = ship.id; p.pose.aboard = true; p.pose.seat = id; p.pose.sw = { x: seat.x, y: seat.y, z: seat.z, yaw: 0, pitch: 0 }; p.frameId = 'mars'; };
    let sim = S(); sit(pa, 'pilot', rec, sim); sit(pc, 'nav', rec, sim);
    const pose = (id) => ({ ...structuredClone(world.state.players[id].pose), aboard: true });
    const tick = async (n, controls, who = a) => { for (let i = 0; i < n; i++) { clock += 33; who.send({ type: 'pose', pose: pose(who.id), controls }); await new Promise((r) => setTimeout(r, 2)); await world.enqueue(() => { world.advance(1 / 30); }); } };
    const len = (v) => Math.hypot(v.x, v.y, v.z);
    sim = S(); sim.flight.touched = true;
    // (the ramp is down at the start of a game: fold it first, as a pilot's first lift does)
    let foldTicks = 0; const hand = (o = {}) => ({ fwd: 0, lift: 0, yaw: 0, mode: 'assist', pitch: 0, strafe: 0, boost: 0, land: 0, level: 1, ...o });
    for (; foldTicks < 400 && S().ship.rampCtl.cargo.progress > 0.02; foldTicks++) await tick(1, hand({ lift: 1 }));
    check(`the ramp folds away for a lift-off in ${(foldTicks / 30).toFixed(1)} s on the authority (it was 6 s of waiting before the first push did anything)`, foldTicks > 50 && foldTicks < 130);
    await tick(200, { fwd: 0, lift: 1, yaw: 0, mode: 'assist', pitch: 0, strafe: 0, boost: 0, land: 0, level: 1 }); sim = S();
    check(`in the shared world a hand on the stick lifts her: ${sim.flight.agl.toFixed(0)} m up after 8 s (the ramp folds first)`, sim.flight.agl > 15 && !sim.flight.landed);
    let last = { ...sim.flight.pos }, maxStep = 0, vTop = 0;
    for (let i = 0; i < 240; i++) { await tick(1, { fwd: 1, lift: 0, yaw: 0, mode: 'assist', pitch: 0, strafe: 0, boost: i > 100 ? 1 : 0, land: 0, level: 1 }); sim = S(); maxStep = Math.max(maxStep, len({ x: sim.flight.pos.x - last.x, y: sim.flight.pos.y - last.y, z: sim.flight.pos.z - last.z })); last = { ...sim.flight.pos }; vTop = Math.max(vTop, sim.flight.speed); }
    check(`the authority flies her at ${vTop.toFixed(0)} m/s (it is the same law the browser runs; the old clamp was 40)`, vTop > 150);
    check(`no teleports: the largest step in a tick was ${maxStep.toFixed(1)} m at a top speed of ${vTop.toFixed(0)} m/s (a tick is 1/30 s)`, maxStep < (vTop + 5) / 30 * 1.02);
    // the pilot's connection drops while she is fast: the flight assist brings her to a hover instead of a minutes-long coast on the old law
    await tick(90, hand({ fwd: 1, boost: 1 })); sim = S(); const vDrop = sim.flight.speed;
    for (let i = 0; i < 330; i++) { clock += 33; await world.enqueue(() => { world.advance(1 / 30); }); } sim = S();
    check(`a pilot who drops off while she is doing ${vDrop.toFixed(0)} m/s does not leave her coasting: ${sim.flight.speed.toFixed(1)} m/s ten seconds after the lease lapsed`, vDrop > 100 && sim.flight.speed < 25);
    // junk is clamped, never believed
    clock += 33; a.send({ type: 'pose', pose: pose(a.id), controls: { fwd: 9, lift: -9, yaw: NaN, pitch: 'x', strafe: Infinity, boost: 'yes', land: 7, level: null, mode: 'assist' } }); await new Promise((r) => setTimeout(r, 20)); await world.enqueue(() => {});
    let L = world.inputs.get(a.id).controls;
    check('a hand stick is intent only: every lever clamped to -1..1, boost, land and level to 0 or 1, junk and NaN to zero', L.fwd === 1 && L.lift === -1 && L.yaw === 0 && L.pitch === 0 && L.strafe === 0 && L.boost === 1 && L.land === 1 && L.level === 0 && L.mode === 'assist');
    clock += 33; a.send({ type: 'pose', pose: pose(a.id), controls: { fwd: 1, lift: 0, yaw: 0, mode: 'warp-drive', pos: { x: 0, y: 0, z: 0 }, speed: 1e9 } }); await new Promise((r) => setTimeout(r, 20)); await world.enqueue(() => {});
    L = world.inputs.get(a.id).controls;
    check('an unknown mode is the old three levers; a stick cannot name a position or a speed', L.mode === undefined && L.pos === undefined && L.speed === undefined && Object.keys(L).sort().join() === 'fwd,lift,yaw');
    clock += 33; c.send({ type: 'pose', pose: pose(c.id), controls: { fwd: 1, lift: 1, yaw: 0, mode: 'assist', boost: 1 } }); await new Promise((r) => setTimeout(r, 20)); await world.enqueue(() => {});
    check('a passenger in the navigator\'s seat cannot put a hand stick on the ship', !world.inputs.get(c.id));
    // a stick released: the assist brakes her to a hover; and the lease running out leaves the old flight law holding her
    await tick(240, { fwd: 0, lift: 0, yaw: 0, mode: 'assist', pitch: 0, strafe: 0, boost: 0, land: 0, level: 1 }); sim = S();
    check(`released, the authority's flight assist holds her still (${sim.flight.speed.toFixed(1)} m/s, ${sim.flight.agl.toFixed(0)} m up)`, sim.flight.speed < 2);
    for (let i = 0; i < 20 && !S().flight.landed; i++) { await tick(50, { fwd: 0, lift: -1, yaw: 0, mode: 'assist', pitch: 0, strafe: 0, boost: 0, land: 0, level: 1 }); sim = S(); if (process.env.FFDBG) { console.log('hull', sim.flight.hull, 'ev', JSON.stringify(sim.flight.events), 'td', JSON.stringify(sim.flight.lastTouchdown)); const q = sim.flight; console.log(i, q.agl.toFixed(1), q.verticalSpeed.toFixed(1), q.landed, 'contacts', q.contacts, 'belly', q._belly, 'fUp', (q.thrustUp / 1000).toFixed(0), 'legs', q.legs.map((l) => l.gap.toFixed(1)).join(','), 'hand', JSON.stringify(q.handInfo && { fUp: q.handInfo.fUp, fMin: q.handInfo.fMin, fMax: q.handInfo.fMax, mass: q.massKg, eng: q.engineFactor, l: q.handInfo.landing, s: q.handInfo.seeking, nf: q.handInfo.noFlat, sd: q.handInfo.siteDist }), 'ctl', JSON.stringify(q.controls)); } }
    check(`and DOWN lands her on the server: landed ${sim.flight.landed} (${sim.flight.agl.toFixed(1)} m, ${sim.flight.verticalSpeed.toFixed(1)} m/s), hull ${sim.flight.hull.toFixed(0)}%`, sim.flight.landed && sim.flight.hull === 100);
    const snap = world.publicState().ships[rec.id].pose;
    check('the snapshot carries what the other browsers draw the boost with', snap.boostCharge !== undefined && snap.boosting !== undefined && snap.aimPitch !== undefined);
  } catch (e) { check('flight feel on the authority ran without error', false, String(e && e.stack || e)); }
  finally { a?.close(); c?.close(); if (app) await app.close(); await rm(dir, { recursive: true, force: true }); }

  // ---- the first-timer bot: before and after --------------------------------------------------------------------------------------------------------
  const { bench } = await import('./flightfeel-bot.mjs');
  const rows = await bench(['legacy', 'assist', 'assist-pro'], [0], { mars, site });
  const by = Object.fromEntries(rows.map((r) => [r.style, r]));
  const leg = by.legacy, as = by.assist, pro = by['assist-pro'];
  check(`first-timer bot, 2 km out and back to the pad: old stick ${leg.total} s, assist ${as.total} s, assist with a climb and a boost ${pro.total} s`, as.out.ok && as.back.ok && pro.out.ok && pro.back.ok && as.total < leg.total * 0.6 && pro.total < leg.total * 0.4);
  check(`both landings soft: touchdown ${as.out.touchdown} and ${as.back.touchdown} m/s with assist; the pad landing within ${as.back.off} m of the centre`, as.out.touchdown < 5.5 && as.back.touchdown < 5.5 && as.back.off < 20 && as.out.hullLost === 0 && as.back.hullLost === 0);
  console.log('  bot', JSON.stringify({ legacy: leg.total, assist: as.total, pro: pro.total }), JSON.stringify(leg));
}
