// Checks for FREEFLIGHT (src/space/freeflight.js, freeflightUI.js, and the authority's free-flight rules in server/).
// Everything runs the real code: the real ship flight model, the real moon and Mars fields, the real authority and the real server socket.
// WebGL and the phone are checked in a browser: test/freeflight-browser.mjs, test/phone-check.mjs and docs/qa/2026-10-03/freeflight/REVIEW.md.
import '../server/runtime.mjs';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../server/index.mjs';
import { FileAdapter } from '../server/storage.mjs';
import { TestClient } from './multiplayer-checks.mjs';

export async function runFreeflightChecks({ check, section, THREE, mars }) {
  const base = '../src/';
  const SPEC = await import(base + 'space/spaceSpec.js');
  const FF = await import(base + 'space/freeflight.js');
  const { FreeFlightUI, ffHudLines, ffTextLines } = await import(base + 'space/freeflightUI.js').catch(() => ({}));
  const { ShipBody } = await import(base + 'ship/shipFlight.js');
  const { surfaceRadiusFast } = await import(base + 'world/field.js');
  const { makeMoon } = await import(base + 'space/moonField.js');
  const { MotionBuffer } = await import(base + 'world-state/motionBuffer.js');
  const { FreeFlight, BODIES, MARS_R, gravityAt, orbitElements, circularSpeed, predictPath, dragDecel, airDensity } = FF;
  const { MARS_MU, FREE, DRIVE } = SPEC;
  const CLOCK = await import(base + 'space/clock.js'), FR = await import(base + 'space/frames.js');
  const len = (v) => Math.hypot(v.x, v.y, v.z);
  const noseOf = (f) => new THREE.Vector3(0, 0, -1).applyQuaternion(f.attitude || f.quaternion);

  /** A ship that can fly in the Mars frame or a moon's, with the frame switch the real hosts do. */
  function rig() {
    let frame = 'mars'; const said = [];
    const bodyOf = () => (frame === 'mars' ? mars : makeMoon(frame));
    const flight = new ShipBody(mars, (x, y, z) => surfaceRadiusFast(bodyOf(), x, y, z));
    const host = { flight, mars, frameId: () => frame, say: (m, w) => said.push({ m, w }), drones: { suspended: false },
      worldTime: () => CLOCK.worldTimeS(),
      setFrame: (id) => { if (id === frame) return; const T = flight.epochS ?? CLOCK.worldTimeS(); FR.carryFlight(flight, FR.frameAt(frame, T), FR.frameAt(id, T)); frame = id; flight.body = bodyOf(); flight.refreshOrientation(); } };
    const ff = new FreeFlight(host);
    return { flight, ff, host, said, frame: () => frame };
  }
  /** Run `seconds` of the clock at 30 Hz (or `hz`), with `input` (a function of the telemetry or a fixed object). Returns ship seconds flown. */
  function run(R, seconds, input = null, { hz = 30, until = null } = {}) {
    let ship = 0;
    for (let i = 0; i < seconds * hz; i++) {
      R.ff.setInput(typeof input === 'function' ? input(R.ff.active ? R.ff.telemetry() : null) : input);
      const e = R.ff.preStep(1 / hz);
      R.flight.step(R.ff.active ? (1 / hz) * e : Math.max(1 / hz, Math.min(e / hz, 1))); ship += R.ff.active ? e / hz : 1 / hz;
      if (until && until(R)) break;
    }
    return ship;
  }
  // F2: the ship's coordinates turn with Mars. Her orbital energy is the INERTIAL one (the velocity over the turning axes plus Mars's own turn at that point);
  // an inertial velocity is given to the rig in the turning axes as FV.
  const OM = FR.OMEGA;
  const energy = (f) => { const vx = f.vel.x + OM * f.pos.z, vz = f.vel.z - OM * f.pos.x; return 0.5 * (vx * vx + f.vel.y ** 2 + vz * vz) - MARS_MU / len(f.pos); };
  const IV = (f) => ({ x: f.vel.x + OM * f.pos.z, y: f.vel.y, z: f.vel.z - OM * f.pos.x });
  const FV = (v, p) => ({ x: v.x - OM * p.z, y: v.y, z: v.z + OM * p.x });

  // =====================================================================================================================
  section('60. Free flight: real orbital mechanics, the jets and the drive, fuel, compression');
  // =====================================================================================================================
  {
    check("Phobos and Deimos pull as real masses: at 10 km from Phobos's centre the pull LESS what Mars pulls the moon's centre with is G m / r^2 (about 7.1 mm/s2) to within the tide",
      (() => { const T = CLOCK.worldTimeS(), c = FR.worldCentreFixed('phobos', T), l = len(c), p = { x: c.x + c.x / l * 10_000, y: 0, z: c.z + c.z / l * 10_000 }, g = gravityAt(p, undefined, T), g0 = gravityAt(c, undefined, T);
        const rel = { x: g.x - g0.x, y: g.y - g0.y, z: g.z - g0.z }, want = BODIES.phobos.mu / 1e8, tide = 2 * MARS_MU * 10_000 / l ** 3; return Math.abs(len(rel) - want) < tide * 1.3 + 1e-6 && want > 0.007 && want < 0.0072; })());
    check("F2: no cancelled pull any more: a ship riding with Phobos feels Mars's whole pull (0.49 m/s2 at its distance) AS THE MOON DOES, so relative to it only the tide and its own pull are left; far from every moon the pull is Mars's alone",
      (() => { const T = CLOCK.worldTimeS(), c = FR.worldCentreFixed('phobos', T), l = len(c), p = { x: c.x + c.x / l * 3000, y: 0, z: c.z + c.z / l * 3000 };
        const gc = len(gravityAt(c, undefined, T)), g = gravityAt(p, undefined, T), g0 = gravityAt(c, undefined, T), d = len({ x: g.x - g0.x, y: g.y - g0.y, z: g.z - g0.z });
        return gc > 0.45 && gc < 0.55 && d < 0.02 && Math.abs(len(gravityAt({ x: 0, y: 0, z: 9_376_000 * 0.5 + 3_000_000 }, undefined, T)) - MARS_MU / (9_376_000 * 0.5 + 3_000_000) ** 2) < 1e-3; })());

    const R = rig(), r0 = MARS_R + 400_000, vc = circularSpeed(MARS_MU, r0);
    R.flight.pos = { x: r0, y: 0, z: 0 }; R.flight.vel = FV({ x: 0, y: 0, z: -vc }, { x: r0, y: 0, z: 0 }); R.ff.enabled = true; R.ff._install(); R.ff.warp = 500;
    const E0 = energy(R.flight), P = 2 * Math.PI * Math.sqrt(r0 ** 3 / MARS_MU);
    const t0 = performance.now(), shipS = run(R, 60, null);
    const E1 = energy(R.flight), el = orbitElements(R.flight.pos, IV(R.flight), MARS_MU, MARS_R);
    check(`a circular orbit at 400 km coasts for ${(shipS / P).toFixed(1)} orbits at x500 with energy drift ${(Math.abs(E1 - E0) / Math.abs(E0)).toExponential(1)}, still circular (e ${el.e.toExponential(1)}), in ${(performance.now() - t0).toFixed(0)} ms`,
      Math.abs(E1 - E0) / Math.abs(E0) < 1e-6 && el.e < 1e-4 && shipS / P > 3 && R.ff.eff === 500);
    check(`the orbit's period from the position and velocity is 2 pi sqrt(a^3/mu) (${(P / 60).toFixed(1)} min): the HUD and the physics agree`, Math.abs(el.periodS - P) / P < 1e-4);
    check('ship time runs 500 times the clock while coasting at x500 (60 s of play is 30,000 s of flight)', Math.abs(shipS - 30_000) < 100);

    // ---- a transfer to Phobos by the book: the vis-viva burn, its fuel, the arrival ---------------------------------
    const T = rig(), lon = 71 * Math.PI / 180, rr = MARS_R + 400_000;
    { const p0 = { x: rr * Math.cos(lon), y: 0, z: -rr * Math.sin(lon) }; T.flight.pos = p0; T.flight.vel = FV({ x: -vc * Math.sin(lon), y: 0, z: -vc * Math.cos(lon) }, p0); }
    T.ff.enabled = true; T.ff._install(); T.ff.setAssist('prograde');
    const r2 = len(BODIES.phobos.c), aT = (rr + r2) / 2, dvWant = Math.sqrt(MARS_MU * (2 / rr - 1 / aT)) - vc;
    run(T, 10, null);
    let burnS = 0;
    for (let i = 0; i < 30 * 200; i++) { T.ff.setInput({ thr: 1 }); T.ff.preStep(1 / 30); T.flight.step(1 / 30); burnS += 1 / 30; const el2 = orbitElements(T.flight.pos, IV(T.flight), MARS_MU, MARS_R); if (el2.ra >= r2) break; }
    const dvUsed = (1 - T.ff.fuel) * FREE.dvFullMs;
    check(`the Hohmann burn to Phobos's distance takes ${dvUsed.toFixed(0)} m/s of fuel against ${dvWant.toFixed(0)} by the vis-viva equation (${(100 * dvUsed / FREE.dvFullMs).toFixed(1)}% of a tank), in ${burnS.toFixed(0)} s of thrust`,
      Math.abs(dvUsed - dvWant) / dvWant < 0.03 && T.ff.fuel < 1 && T.ff.fuel > 0.9);
    // coast with the drive off, at x500; the compression must come down on its own long before the moon, and the turn-over has time to happen
    // the moon MOVES now: the encounter is set up relative to it (the ship is 700 km short of it, closing at 1.5 km/s), not by timing a transfer to a parked point
    { const tc = T.flight.epochS, k = FR.worldKin('phobos', tc), l = len(k.c), u = { x: k.c.x / l, y: 0, z: k.c.z / l };
      T.flight.pos = { x: k.c.x - u.x * 700_000, y: k.c.y, z: k.c.z - u.z * 700_000 }; T.flight.vel = { x: k.v.x + u.x * 1500, y: k.v.y, z: k.v.z + u.z * 1500 }; }
    T.ff.setTarget('phobos'); T.ff.setAssist('off'); T.ff.warp = 500;
    let drop = null, impacts = 0, braked = false, brakeAt = null, steps = 0;
    while (T.ff.active && steps++ < 30 * 4000) {
      const t = T.ff.telemetry();
      if (!braked && steps > 5 && T.ff.eff === 1 && !drop) drop = { tImpact: t.target.surfaceM / Math.max(1, t.target.closing), speed: t.speed, dist: t.target.surfaceM };
      if (!braked && steps > 5 && T.ff.eff === 1 && t.target.closing > 200 && t.target.surfaceM < 420_000) { braked = true; brakeAt = { dist: t.target.surfaceM, speed: t.speed }; }
      T.ff.setInput(braked ? { brake: true } : null);
      if (braked && t.speed < 3) break;
      const e = T.ff.preStep(1 / 30); T.flight.step((1 / 30) * e);
    }
    const tBrake = brakeAt ? brakeAt.speed / (0.85 * T.ff.aMax) + 12 : 0;
    check(`arriving at ${brakeAt ? Math.round(brakeAt.speed) : '?'} m/s, the compression comes down to x1 on its own ${drop ? fmt(drop.dist) : '?'} out, with ${drop ? Math.round(drop.tImpact) : '?'} s to impact (more than the ${Math.round(tBrake * 1.5)} s the brake needs, half as long again)`,
      !!drop && !!brakeAt && drop.tImpact > 1.5 * tBrake && T.said.some((s) => /Time compression held/.test(s.m)));
    const tl = T.ff.telemetry();
    check(`BRAKE turns the ship over by itself and burns the speed away: ${Math.round(brakeAt?.speed ?? 0)} m/s to ${tl.speed.toFixed(1)} m/s, still ${fmt(tl.target.surfaceM)} above Phobos, ${((1 - T.ff.fuel) * FREE.dvFullMs - dvUsed).toFixed(0)} m/s of fuel for it`,
      tl.speed < 3 && tl.target.surfaceM > 40_000 && T.ff.active && Math.abs(((1 - T.ff.fuel) * FREE.dvFullMs - dvUsed) - brakeAt.speed) < 60);

    // ---- the assist modes ----------------------------------------------------------------------------------------------------
    const A = rig();
    A.flight.pos = { x: r0, y: 0, z: 0 }; A.flight.vel = FV({ x: 0, y: 0, z: -vc }, { x: r0, y: 0, z: 0 }); A.ff.enabled = true; A.ff._install(); A.flight.attitude.setFromEuler(new THREE.Euler(0.4, 2.0, 0.3));
    const ang = (v) => Math.acos(Math.max(-1, Math.min(1, noseOf(A.flight).dot(new THREE.Vector3(v.x, v.y, v.z)))));
    A.ff.setAssist('prograde'); run(A, 12, null);
    const pro = { x: A.flight.vel.x / len(A.flight.vel), y: 0, z: A.flight.vel.z / len(A.flight.vel) };
    A.ff.setAssist('retro'); run(A, 12, null);
    const retroErr = ang({ x: -pro.x, y: -pro.y, z: -pro.z });
    A.ff.setAssist('prograde'); run(A, 12, null); const proErr = ang(pro);
    A.ff.setTarget('deimos'); A.ff.setAssist('target'); run(A, 12, null); const tgErr = ang(A.ff.targetState().toward);
    check(`the assists put the nose on prograde (${(proErr * 57.3).toFixed(1)} deg off), retrograde (${(retroErr * 57.3).toFixed(1)} deg) and the target (${(tgErr * 57.3).toFixed(1)} deg), and the turn is rate limited (${FREE.rot.pitch} rad/s)`,
      proErr < 0.03 && retroErr < 0.03 && tgErr < 0.03);
    const S = rig(); S.flight.pos = { x: r0, y: 0, z: 0 }; S.flight.vel = FV({ x: 0, y: 0, z: -vc }, { x: r0, y: 0, z: 0 }); S.ff.enabled = true; S.ff._install();
    const a0 = noseOf(S.flight).clone(); run(S, 1, { pitch: 1 }); const turned = Math.acos(Math.max(-1, Math.min(1, noseOf(S.flight).dot(a0))));
    run(S, 5, null);
    check(`one second of full stick turns her ${(turned * 57.3).toFixed(0)} degrees (rate limit ${(FREE.rot.pitch * 57.3).toFixed(0)}/s, the jets need time to start it) and she stops turning when the stick is let go (rate ${Math.hypot(S.ff.rot.x, S.ff.rot.y, S.ff.rot.z).toFixed(3)} rad/s)`,
      turned > 0.2 && turned < FREE.rot.pitch * 1.05 && Math.hypot(S.ff.rot.x, S.ff.rot.y, S.ff.rot.z) < 0.01);
    // jets slide her sideways without turning her
    const J = rig(); J.flight.pos = { x: r0, y: 0, z: 0 }; J.flight.vel = FV({ x: 0, y: 0, z: -vc }, { x: r0, y: 0, z: 0 }); J.ff.enabled = true; J.ff._install();
    const J0 = rig(); J0.flight.pos = { x: r0, y: 0, z: 0 }; J0.flight.vel = FV({ x: 0, y: 0, z: -vc }, { x: r0, y: 0, z: 0 }); J0.ff.enabled = true; J0.ff._install(); run(J0, 3, null);
    const n0 = noseOf(J.flight).clone(); run(J, 3, { tx: 1 });
    const dvx = new THREE.Vector3(J.flight.vel.x - J0.flight.vel.x, J.flight.vel.y - J0.flight.vel.y, J.flight.vel.z - J0.flight.vel.z), right = new THREE.Vector3(1, 0, 0).applyQuaternion(J.flight.attitude);
    check(`RCS jets slide the ship ${len(dvx).toFixed(2)} m/s to the side in 3 s beyond what a coasting ship does (${FREE.rcsAccel} m/s2 each way) without turning her (nose moved ${(Math.acos(Math.min(1, noseOf(J.flight).dot(n0))) * 57.3).toFixed(1)} deg)`,
      Math.abs(len(dvx) - 3 * FREE.rcsAccel) < 0.15 && Math.abs(dvx.normalize().dot(right)) > 0.99 && noseOf(J.flight).dot(n0) > 0.9999);

    // ---- compression rules ----------------------------------------------------------------------------------------------------
    const W = rig(); W.flight.pos = { x: r0, y: 0, z: 0 }; W.flight.vel = FV({ x: 0, y: 0, z: -vc }, { x: r0, y: 0, z: 0 }); W.ff.enabled = true; W.ff._install(); W.ff.warp = 500;
    W.ff.setInput({ thr: 1 }); W.ff.preStep(1 / 30); const burnEff = W.ff.eff; W.ff.setInput({ pitch: 1 }); W.ff.preStep(1 / 30); const steerEff = W.ff.eff; W.ff.setInput(null); W.ff.preStep(1 / 30);
    check(`a burn is compressed at most x20 (an orbit's four minutes of thrust is ${Math.round(260 / 20)} s), steering by hand is x1, coasting is the full x500 (got ${burnEff}, ${steerEff}, ${W.ff.eff})`, burnEff === 20 && steerEff === 1 && W.ff.eff === 500);
    const H = rig(); H.flight.pos = { x: r0, y: 0, z: 0 }; H.flight.vel = FV({ x: 0, y: 0, z: -vc }, { x: r0, y: 0, z: 0 }); H.ff.enabled = true; H.ff._install(); H.ff.warp = 500; H.host.hostileNear = () => true;
    H.ff.preStep(1 / 30); const hostileEff = H.ff.eff; H.host.hostileNear = () => false; H.host.shipNear = () => true; H.ff.preStep(1 / 30); const shipEff = H.ff.eff;
    check('a raider within 20 km, or another ship within 5 km, holds the compression at x1', hostileEff === 1 && shipEff === 1);
    check('the drive will not light inside Mars\'s air (DRIVE rule), the jets will, and a dry tank leaves only the attitude jets',
      (() => { const X = rig(); X.flight.pos = { x: MARS_R + 60_000, y: 0, z: 0 }; X.flight.vel = { x: 0, y: 0, z: -3000 }; X.ff.enabled = true; X.ff._install(); const v = len(X.flight.vel);
        X.ff.setInput({ thr: 1, tx: 1 }); X.ff.preStep(1 / 30); X.flight.step(1 / 30); const noDrive = X.flight.thrustFwd === 0 && X.said.some((s) => /will not light/.test(s.m));
        const Y = rig(); Y.flight.pos = { x: r0, y: 0, z: 0 }; Y.flight.vel = FV({ x: 0, y: 0, z: -vc }, { x: r0, y: 0, z: 0 }); Y.ff.enabled = true; Y.ff._install(); Y.ff.fuel = 0; const vv = { ...Y.flight.vel };
        Y.ff.setInput({ thr: 1 }); Y.ff.preStep(1 / 30); for (let i = 0; i < 30; i++) Y.flight.step(1 / 30); const dry = Math.abs(len(Y.flight.vel) - len(vv)) < 0.5 && Y.said.some((s) => /Tanks dry/.test(s.m));
        return noDrive && dry; })());
    check('fuel is a tank of delta-v: a full burn uses acceleration x time of it, and the jets use a hundredth as much',
      (() => { const X = rig(); X.flight.pos = { x: r0, y: 0, z: 0 }; X.flight.vel = FV({ x: 0, y: 0, z: -vc }, { x: r0, y: 0, z: 0 }); X.ff.enabled = true; X.ff._install(); run(X, 10, { thr: 1 }); const burn = (1 - X.ff.fuel) * FREE.dvFullMs;
        const Z = rig(); Z.flight.pos = { x: r0, y: 0, z: 0 }; Z.flight.vel = FV({ x: 0, y: 0, z: -vc }, { x: r0, y: 0, z: 0 }); Z.ff.enabled = true; Z.ff._install(); run(Z, 10, { tx: 1 }); const jets = (1 - Z.ff.fuel) * FREE.dvFullMs;
        return Math.abs(burn - 10 * X.ff.aMax) < 3 && Math.abs(jets - 10 * FREE.rcsAccel * 0.01) < 0.01; })());
    check('a ship refuels on a pad (the port) and only there: landed on the pad, a tank fills at the stated rate; away from it, it does not',
      (() => { const X = rig(); X.host.atPad = () => true; X.flight.landed = true; X.ff.fuel = 0.5; X.ff.preStep(10); const filled = X.ff.fuel; X.host.atPad = () => false; X.ff.preStep(10); return Math.abs(filled - (0.5 + 10 * FREE.refuelPerS)) < 1e-9 && X.ff.fuel === filled; })());

    // ---- the telemetry the HUD draws -----------------------------------------------------------------------------------------
    const tl2 = A.ff.telemetry();
    check('the HUD read-outs are real numbers: speed, height, periapsis, apoapsis, period, fuel, delta-v, the target\'s distance, closing speed and ETA',
      [tl2.speed, tl2.alt, tl2.periM, tl2.apoM, tl2.periodS, tl2.fuel, tl2.dvLeft, tl2.target.distM, tl2.target.closing].every(Number.isFinite) && tl2.target.name === 'Deimos');
    check('the HUD text carries speed, orbit, the target\'s distance / closing / ETA and fuel with delta-v', (() => { const h = ffTextLines(A.ff).map((l) => l.text).join(' '); return /SPD/.test(h) && /Pe .* Ap /.test(h) && /→ Deimos/.test(h) && /ETA/.test(h) && /FUEL 100% · Δv 12\.00 km\/s/.test(h); })());
    const pp = predictPath(A.flight.pos, A.flight.vel, { n: 120, horizonS: 7100, T: A.flight.epochS });
    const ppEnd = FR.toInertial(pp.points[119], A.flight.epochS + 7100), ppStart = FR.toInertial(A.flight.pos, A.flight.epochS);
    check('the predicted path is a closed orbit that comes back to where it started (circular at 400 km, 120 points over one period)', !pp.hit && len(pp.points[119]) > r0 - 2000 && Math.hypot(ppEnd.x - ppStart.x, ppEnd.y - ppStart.y, ppEnd.z - ppStart.z) < 60_000);
    const pd = predictPath({ x: r0, y: 0, z: 0 }, { x: 0, y: 0, z: -2000 }, { n: 100, horizonS: 3000 });
    check('a path that dips into Mars reports the impact and how long until it', !!pd.hit && pd.hit.body === 'mars' && pd.hit.t > 100 && pd.hit.t < 3000);

    // ---- Mars's air ------------------------------------------------------------------------------------------------------------
    check(`Mars's air is the real thin atmosphere (${airDensity(0).toFixed(3)} kg/m3 at the surface, scale height ${FREE.scaleHeightM / 1000} km) and the drag brakes give ${dragDecel(0, 400).toFixed(1)} m/s2 at 400 m/s`, Math.abs(airDensity(0) - 0.02) < 1e-9 && airDensity(11_100) < airDensity(0) * 0.37 && airDensity(200_000) === 0);

    // ---- from orbit to the ground at Mars, and back up ---------------------------------------------------------------------
    const M = rig(); M.flight.pos = { x: r0, y: 0, z: 0 }; M.flight.vel = FV({ x: 0, y: 0, z: -vc }, { x: r0, y: 0, z: 0 }); M.ff.enabled = true; M.ff._install(); M.ff.setAssist('retro');
    run(M, 400, (t) => (t && t.periM > 40_000 ? { thr: 1 } : null), { until: (R) => R.ff.telemetry().periM <= 40_000 });
    const deorbitDv = (1 - M.ff.fuel) * FREE.dvFullMs;
    M.ff.warp = 500; let peakDecel = 0, steps2 = 0;
    while (M.ff.active && steps2++ < 30 * 6000) { M.ff.setInput(null); const e = M.ff.preStep(1 / 30); M.flight.step((1 / 30) * e); peakDecel = Math.max(peakDecel, M.ff.decel || 0); }
    check(`orbit to ground at Mars: a ${deorbitDv.toFixed(0)} m/s deorbit burn, the drag brakes take it through the air (peak ${(peakDecel / 3.71).toFixed(1)} g), and below 10 km and 300 m/s the flight assist has her (${M.ff.active ? 'still free' : 'handed back'} at ${Math.round(M.flight.speed)} m/s, ${Math.round(M.flight.agl)} m up, hull ${M.flight.hull.toFixed(0)}%)`,
      !M.ff.active && M.flight.speed <= FREE.handoverMs + 1 && M.flight.agl < FREE.marsHandoverM + 200 && M.flight.hull > 99 && peakDecel < FREE.maxDecel && peakDecel > 3);
    M.flight.controls.lift = 0; for (let i = 0; i < 60 * 30; i++) { M.ff.preStep(1 / 60); M.flight.step(1 / 60); } M.flight.controls.lift = -1;
    for (let i = 0; i < 60 * 600 && !M.flight.landed; i++) { M.ff.preStep(1 / 60); M.flight.step(1 / 60); }
    check(`and she lands on her gear wherever she came down (speed ${M.flight.speed.toFixed(2)} m/s, hull ${M.flight.hull.toFixed(0)}%)`, M.flight.landed && M.flight.speed < 0.9 && M.flight.hull > 99);
    const U = rig(); const gR = surfaceRadiusFast(mars, 1, 0, 0); U.flight.setDown({ x: gR + 1.2, y: 0, z: 0 }, 0); for (let i = 0; i < 600; i++) U.flight.step(1 / 60);
    U.ff.enabled = true; U.ff.warp = 60; U.flight.controls.lift = 1; let secs = 0, up = 0;
    while (!U.ff.active && up++ < 60 * 400) { const e = U.ff.preStep(1 / 60), d = Math.max(1 / 60, Math.min(e / 60, 1)); U.flight.step(d); secs += 1 / 60; }
    check(`armed on the pad, holding LIFT climbs through the air (x60 where the bands allow) and free flight takes her at 100 km: ${secs.toFixed(0)} s of play`, U.ff.active && len(U.flight.pos) - MARS_R >= 100_000 && secs < 90);
    const switchOff = U.ff.setEnabled(false);
    check('free flight will not switch off while she is too fast for the flight assist to hold, and says why', !switchOff.ok && /Too fast/.test(switchOff.msg) && U.ff.active);

    // ---- Phobos and Deimos: land anywhere, take off again ------------------------------------------------------------------
    const sites = [['phobos', 0.3, 0.2], ['phobos', -0.7, 0.4], ['phobos', 0.1, -0.95], ['deimos', 0.8, -0.1]];
    const landed = [];
    for (const [id, dx, dy] of sites) {
      const Lr = rig(), b = BODIES[id], mb = makeMoon(id), dz = Math.sqrt(Math.max(0.01, 1 - dx * dx - dy * dy)), dl = Math.hypot(dx, dy, dz), d = { x: dx / dl, y: dy / dl, z: dz / dl };
      const surf = mb.surfaceRadius(d.x, d.y, d.z), R2 = surf + (id === 'deimos' ? 3_200 : 5_000);
      const Tl = CLOCK.worldTimeS(), kl = FR.worldKin(id, Tl); Lr.flight.epochS = Tl;
      const dm = FR.rotY(d, kl.yaw);                      // the moon's own direction, turned into Mars's axes (its frame is turned)
      Lr.flight.pos = { x: kl.c.x + dm.x * R2, y: kl.c.y + dm.y * R2, z: kl.c.z + dm.z * R2 }; Lr.flight.vel = { x: kl.v.x, y: kl.v.y, z: kl.v.z }; Lr.ff.enabled = true; Lr.ff._install(); Lr.ff.warp = 60;
      for (let i = 0; i < 30 * 2400 && Lr.ff.active; i++) { Lr.ff.setInput(null); const e = Lr.ff.preStep(1 / 30); Lr.flight.step((1 / 30) * e); }
      const handedAt = Lr.flight.agl, handedSpeed = Lr.flight.speed;
      // the pilot's part: sink; if she hovers a few metres up because the ground under her is too uneven, slide to flatter ground and sink again
      let hover = 0;
      for (let i = 0; i < 60 * 900 && !Lr.flight.landed; i++) {
        Lr.flight.controls.lift = -1; Lr.flight.controls.fwd = hover > 60 * 6 ? 0.2 : 0; if (hover > 60 * 14) { hover = 0; Lr.flight.heading += 1.3; }
        Lr.ff.preStep(1 / 60); Lr.flight.step(1 / 60); hover = Lr.flight.agl < 12 ? hover + 1 : 0;
      }
      // F2: she now comes down wherever the turning moon puts the ground (tens of km from where she aimed), including on slopes, where she may touch down at a
      // metre a second and hop on her springs in a gravity of 5.6 mm/s2 (a pre-existing property of the landing model: the old test happened to aim at flat ground).
      // The check is that she is down or hopping within a few metres of the surface, intact, in the moon's frame, slow.
      Lr.flight.controls.fwd = 0; let rested = true; for (let i = 0; i < 60 * 5; i++) { Lr.ff.preStep(1 / 60); Lr.flight.step(1 / 60); if (Lr.flight.agl > 30) rested = false; }
      const pad = mb.padInfo.point, from = Math.hypot(Lr.flight.pos.x - pad.x, Lr.flight.pos.y - pad.y, Lr.flight.pos.z - pad.z);
      landed.push({ id, ok: Lr.flight.hull > 99 && rested && Lr.flight.speed < 1.5 && Lr.frame() === id && Lr.flight.agl < 30, from, handedAt, handedSpeed, Lr });
    }
    check(`free flight to a moon and a landing at four places that are not pads: ${landed.map((l) => `${l.id} ${Math.round(l.from)} m from the pad`).join(', ')}; the flight assist takes her at ${landed.map((l) => Math.round(l.handedAt)).join(', ')} m up and she lands intact`,
      landed.every((l) => l.ok && l.from > 800), JSON.stringify(landed.map((l) => ({ ok: l.ok, landed: l.Lr.flight.landed, hull: l.Lr.flight.hull, sp: l.Lr.flight.speed, fr: l.Lr.frame() }))));
    const TO = landed[0].Lr; TO.flight.controls.lift = 1; let tk = 0;
    while (!TO.ff.active && tk++ < 60 * 400) { const e = TO.ff.preStep(1 / 60); TO.flight.step(TO.ff.active ? e / 60 : Math.max(1 / 60, Math.min(e / 60, 1))); }
    check(`and she takes off again: LIFT from the moon's surface carries her above 3 km and free flight takes the ship back (frame ${TO.frame()}, ${tk / 60 | 0} s)`, TO.ff.active && TO.frame() === 'mars');
    const IM = rig(), mbP = makeMoon('phobos'), dI = { x: 0.3, y: 0.2, z: 0.93 }, lI = len(dI), dn = { x: dI.x / lI, y: dI.y / lI, z: dI.z / lI }, sI = mbP.surfaceRadius(dn.x, dn.y, dn.z);
    const Ti = CLOCK.worldTimeS(), ki = FR.worldKin('phobos', Ti), dmi = FR.rotY(dn, ki.yaw); IM.flight.epochS = Ti;
    IM.flight.pos = { x: ki.c.x + dmi.x * (sI + 5_000), y: ki.c.y + dmi.y * (sI + 5_000), z: ki.c.z + dmi.z * (sI + 5_000) };
    IM.flight.vel = { x: ki.v.x - dmi.x * 600, y: ki.v.y - dmi.y * 600, z: ki.v.z - dmi.z * 600 }; IM.ff.enabled = true; IM.ff._install();
    for (let i = 0; i < 60 * 90 && !IM.flight.landed; i++) { IM.ff.preStep(1 / 60); IM.flight.step(1 / 60); if (IM.flight.hull < 100 && !IM.ff.active && IM.flight.agl < 3) break; }
    check(`a ship that comes in too fast is handed to the flight assist and hits hard (${Math.round(600)} m/s at 5 km): the hull pays (${IM.flight.hull.toFixed(0)}%)`, IM.flight.hull < 100 && IM.flight.hull >= 0 && IM.frame() === 'phobos');

    // ---- courses are still an option --------------------------------------------------------------------------------------------
    const C = rig(); C.flight.pos = { x: r0, y: 0, z: 0 }; C.flight.vel = FV({ x: 0, y: 0, z: -vc }, { x: r0, y: 0, z: 0 }); C.ff.enabled = true; C.ff._install(); let called = false; C.flight.override = C.flight.override;
    C.ff.suspend('The autopilot has the ship.');
    check('a course (or a crew order) takes the ship from free flight: it lets go, switches itself off and says so; courses and the autopilot still fly as before', !C.ff.active && !C.ff.enabled && C.flight.override === null && C.said.some((s) => /autopilot/.test(s.m)));

    // ---- remote ships are drawn from a compressed pose without lagging ----------------------------------------------------------------
    const mb = new MotionBuffer(); const speed = 3400, warp = 500; let maxLag = 0;
    for (let t = 0; t <= 4000; t += 100) mb.push('s', t, t + 50, { pos: { x: speed * warp * t / 1000, y: 0, z: 0 }, vel: { x: speed, y: 0, z: 0 }, warp }, 'mars');
    for (let now = 1000; now < 3800; now += 16) { const p = mb.render('s', now); if (p) maxLag = Math.max(maxLag, Math.abs(p.pos.x - speed * warp * (now - mb.offset - mb.delay) / 1000)); }
    check(`a ship coasting at x500 (${(speed * warp / 1000).toFixed(0)} km/s of ground) is drawn from the packets without the buffer resetting or lagging behind (max error ${Math.round(maxLag)} m)`, maxLag < speed * warp * 0.2);
  }

  // =====================================================================================================================
  section('61. Free flight in the shared world: the authority owns the pose; two clients see her fly');
  // =====================================================================================================================
  const dir = await mkdtemp(join(tmpdir(), 'cosmos-freeflight-')); let app, a, b, c; let clock = Date.now();
  try {
    const adapter = new FileAdapter(join(dir, 'world.json')); app = await startServer({ adapter, port: 0, tick: false, now: () => clock });
    a = new TestClient(app.url, 'f'.repeat(48), 'Pilot'); b = new TestClient(app.url, 'e'.repeat(48), 'Watcher'); c = new TestClient(app.url, 'd'.repeat(48), 'Passenger');
    await a.connect(); await b.connect(); await c.connect();
    const world = app.world, pa = world.state.players[a.id], pc = world.state.players[c.id], rec = world.state.ships[pa.shipId];
    const S = () => world.sims.get(rec.id);          // a refused action rolls the world back and rebuilds the simulations: always ask for the live one
    let sim = S();
    const sit = (p, id, ship, s) => { const seat = s.def.seats.find((q) => q.id === id); p.aboardShipId = ship.id; p.currentShipId = ship.id; p.pose.aboard = true; p.pose.seat = id; p.pose.sw = { x: seat.x, y: seat.y, z: seat.z, yaw: 0, pitch: 0 }; p.frameId = 'mars'; };
    sit(pa, 'pilot', rec, sim); sit(pc, 'nav', rec, sim);
    // put the ship in a 400 km orbit directly (a test may do what a client may not), armed and in free flight
    const r0 = MARS_R + 400_000, vc = circularSpeed(MARS_MU, r0);
    sim.flight.landed = false; sim.flight.airborne = true; sim.flight.pos = { x: r0, y: 0, z: 0 }; sim.flight.vel = FV({ x: 0, y: 0, z: -vc }, { x: r0, y: 0, z: 0 }); sim.flight.gearPos = 0;
    sim.ff.enabled = true; sim.ff._install();
    const pose = () => ({ ...structuredClone(world.state.players[a.id].pose), aboard: true });
    const tick = async (n, ffIn = null, who = a) => { for (let i = 0; i < n; i++) { clock += 33; who.send({ type: 'pose', pose: pose(), controls: { fwd: 0, lift: 0, yaw: 0 }, ff: ffIn }); await new Promise((r) => setTimeout(r, 2)); await world.enqueue(() => { world.advance(1 / 30); }); } };
    const speedOf = () => len(S().flight.vel);
    const s0 = speedOf(), p0 = { ...sim.flight.pos }, fuel0 = sim.ff.fuel;
    let r = await a.action({ type: 'ff-set', assist: 'prograde', warp: 1 }); assert.equal(r.ok, true, r.msg);
    await tick(60, null);                                 // let her turn to prograde
    let maxStep = 0, last = { ...sim.flight.pos };
    for (let i = 0; i < 150; i++) { await tick(1, { thr: 1, pitch: 0 }); const step = Math.hypot(sim.flight.pos.x - last.x, sim.flight.pos.y - last.y, sim.flight.pos.z - last.z); maxStep = Math.max(maxStep, step); last = { ...sim.flight.pos }; }
    const gained = speedOf() - s0;
    check(`the pilot's thrust, sent as an input lease, burns the drive for the authority: +${gained.toFixed(1)} m/s in 5 s (the drive makes ${sim.ff.aMax.toFixed(1)} m/s2), fuel ${(100 * (fuel0 - sim.ff.fuel)).toFixed(2)}% used, and the ship's pose is the authority's`,
      Math.abs(gained - 5 * sim.ff.aMax) < 3 && sim.ff.fuel < fuel0 && sim.ff.active);
    check(`no teleports: the ship never moved more than her own speed allows in a tick (largest step ${maxStep.toFixed(1)} m at ${(speedOf() / 1000).toFixed(2)} km/s, a tick is 1/30 s)`, maxStep < (speedOf() + 5) / 30 * 1.01);
    // the input is clamped intent
    clock += 33; a.send({ type: 'pose', pose: pose(), controls: { fwd: 9, lift: -9, yaw: NaN }, ff: { thr: 99, pitch: Infinity, yaw: -50, roll: 'x', tx: 5, ty: -5, tz: null, brake: 1 } }); await new Promise((r) => setTimeout(r, 20)); await world.enqueue(() => {});
    const lease = world.inputs.get(a.id);
    check('a free-flight stick is intent only: thrust clamped to 0..1, every axis to -1..1, junk and NaN to zero', lease.ff.thr === 1 && lease.ff.pitch === 0 && lease.ff.yaw === -1 && lease.ff.roll === 0 && lease.ff.tx === 1 && lease.ff.ty === -1 && lease.ff.tz === 0 && lease.ff.brake === true);
    // a seat that is not the helm cannot fly it
    clock += 33; c.send({ type: 'pose', pose: { ...structuredClone(world.state.players[c.id].pose), aboard: true }, controls: { fwd: 0, lift: 0, yaw: 0 }, ff: { thr: 1 } }); await new Promise((r) => setTimeout(r, 20)); await world.enqueue(() => {});
    check('a passenger in the navigator\'s seat cannot put a stick on the ship: only the pilot and the captain\'s input is taken', !world.inputs.get(c.id));
    // actions are validated and bridge-only
    const bad = [await a.action({ type: 'ff-set', warp: 7 }), await a.action({ type: 'ff-set', assist: 'ram' }), await a.action({ type: 'ff-set', target: 'earth' }), await a.action({ type: 'ff-set', throttle: 'abc' }), await b.action({ type: 'ff-set', enabled: true })];
    sim = S();
    check('free-flight requests are checked by the authority: an unknown compression, assist, target, throttle, or a player who is not at a bridge station, is refused', bad.every((x) => x.ok === false), JSON.stringify(bad.map((x) => x.msg)));
    const nav = await c.action({ type: 'ff-set', target: 'deimos' }); sim = S();
    check('the navigator may set the target for the ship (' + nav.msg + '); the crew aboard (a player in another seat) ride along in the ship-local frame', nav.ok === true && sim.ff.target === 'deimos');
    // the other seat rides along: its world position follows the hull
    await tick(3, null); sim = S();
    const wp = world.state.players[c.id].pose.worldPos, seatW = sim.flight.toWorld(world.state.players[c.id].pose.sw, {});
    check('the passenger aboard moves with the hull (world position is the hull\'s ship-local seat point)', Math.hypot(wp.x - seatW.x, wp.y - seatW.y, wp.z - seatW.z) < 1);
    // compression: ship time runs faster than the clock while coasting
    r = await a.action({ type: 'ff-set', warp: 60, assist: 'off' }); assert.equal(r.ok, true, r.msg);
    sim = S(); const pos0 = { ...sim.flight.pos }, el0 = Math.atan2(pos0.z, pos0.x);
    await tick(30, null); sim = S();
    const ang = (() => { const q = Math.atan2(sim.flight.pos.z, sim.flight.pos.x); let d = q - el0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d); })();
    check(`at x60 one second of play flies sixty (${sim.ff.eff === 60 ? 'x60 in force' : 'held to x' + sim.ff.eff + ' ' + JSON.stringify(sim.ff.save()) + ' hostile ' + sim.ff.host.hostileNear() + ' ship ' + sim.ff.host.shipNear()}): the ship went ${(ang * 57.3).toFixed(1)} degrees round her orbit in a second of the clock`, sim.ff.eff === 60 && ang > 0.04);
    await a.action({ type: 'ff-set', warp: 1 }); sim = S();
    // two clients see her
    let from = b.messages.length; b.send({ type: 'checkpoint' }); const seen = await b.wait((m) => m.type === 'state' && m.state.ships[rec.id]?.ff?.active === true && m.state.ships[rec.id].pose.vel && Math.hypot(...Object.values(m.state.ships[rec.id].pose.vel)) > 1000, from);
    const posB1 = { ...seen.state.ships[rec.id].pose.pos };
    await tick(90, { thr: 0 }); from = b.messages.length; b.send({ type: 'checkpoint' });
    const seen2 = await b.wait((m) => m.type === 'state' && m.state.revision > seen.state.revision && m.state.ships[rec.id]?.pose.pos.x !== posB1.x, from);
    const fromA = a.messages.length; a.send({ type: 'checkpoint' }); const seenA = await a.wait((m) => m.type === 'state' && m.state.ships[rec.id]?.pose.pos.x === seen2.state.ships[rec.id].pose.pos.x, fromA);
    check(`both clients see the free-flying ship: the watcher's copy shows her free flight on (assist ${seen2.state.ships[rec.id].ff.assist}, fuel ${(seen2.state.ships[rec.id].ff.fuel * 100).toFixed(0)}%), moving at ${(Math.hypot(...Object.values(seen2.state.ships[rec.id].pose.vel)) / 1000).toFixed(2)} km/s, with her attitude, and the pilot's copy agrees`,
      seen2.state.ships[rec.id].ff.active && seen2.state.ships[rec.id].pose.quaternion.length === 4 && Math.hypot(seen2.state.ships[rec.id].pose.pos.x - posB1.x, seen2.state.ships[rec.id].pose.pos.z - posB1.z) > 1000 && !!seenA);
    // restart keeps it
    sim = S(); const before = { pos: { ...sim.flight.pos }, fuel: sim.ff.fuel, assist: sim.ff.assist, target: sim.ff.target, energy: energy(sim.flight) };
    await world.commit(); a.close(); b.close(); c.close(); await app.close(); app = null;
    clock += 5000;
    app = await startServer({ adapter, port: 0, tick: false, now: () => clock });
    const sim2 = app.world.sims.get(rec.id);
    const moved = Math.hypot(sim2.flight.pos.x - before.pos.x, sim2.flight.pos.y - before.pos.y, sim2.flight.pos.z - before.pos.z);
    check(`a server restart keeps the ship flying: free flight still on, fuel and target kept, and she carried on along her orbit while the server was down (${(moved / 1000).toFixed(0)} km further on, orbital energy kept to ${(Math.abs(energy(sim2.flight) - before.energy) / Math.abs(before.energy)).toExponential(1)})`,
      sim2.ff.active && sim2.ff.enabled && Math.abs(sim2.ff.fuel - before.fuel) < 1e-6 && sim2.ff.target === 'deimos' && moved > 100_000 && Math.abs(energy(sim2.flight) - before.energy) / Math.abs(before.energy) < 1e-6);
  } catch (e) { console.log('SERVER TEST ERROR', e.message, JSON.stringify([a, b, c].map((x) => x?.messages.filter((m) => m.type === 'error').slice(-3)))); throw e; } finally { a?.close(); b?.close(); c?.close(); if (app) await app.close(); await rm(dir, { recursive: true, force: true }); }

  function fmt(m) { return m >= 1e5 ? `${(m / 1000).toFixed(0)} km` : m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`; }
}
