// Headless test for Rocket v3: flies scripted missions through every new goal, in Helpers-on mode (the game's
// own helpers fly the tricky parts; the "kid" only taps the button the game shows) and in Do-it-yourself mode
// (the scripted kid only moves the lean slider and taps Burn / Stop engine, following the guide's hints, plus
// the buttons the game shows in that mode: Drop tank, Open parachute, Release, Plant flag, Dock).
// Run: node games/rocket/test/missions.test.mjs
import * as H from './harness.mjs';
import { GOALS, DEFAULT_SAVE, migrate, currentGoal, ringNow, staysUp, noseChoices } from '../save.js';
const { P, M } = H;
const { R, ATM_TOP, MOON_R, orbitInfo, inOrbit, dropStage, separateCapsule, fuelLeft, bodyRel } = P;

let fails = 0, passes = 0;
const results = [];
function check(name, ok, info = '') {
  results.push({ name, ok, info });
  if (ok) passes++; else fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  - ' + info : ''}`);
}
const km = (m) => (m / 1000).toFixed(1) + ' km';

// ------------------------------------------------------------ world state carried between flights (like the save)
const world = { T: 0, sats: [], station: null, flags: [] };
function newFlight(cfg) { const f = H.makeFlight({ T0: world.T, ...cfg }); return f; }
function endFlight(f) { world.T = f.T0 + f.t; }
function hooks(f, extra) { return H.hooksFor(f, extra); }

// ------------------------------------------------------------ kid helpers
const kidOn = (f) => { if (!f.engineOn && fuelLeft(f) > 0 && !f.needDrop) { f.engineOn = true; f.ign = 0; } };
const kidOff = (f) => { f.engineOn = false; };
function diyFollow(f, hint) {   // the scripted Do-it-yourself kid: slider + Burn/Stop only
  if (!hint) return null;
  if (hint.burn === true) kidOn(f); else if (hint.burn === false) kidOff(f);
  return hint.lean;
}
function diyStageTap(f) { if (f.needDrop) dropStage(f, 10); }        // the kid taps Drop stage
function diyDropTank(f) {                                            // the "Drop tank" button the game shows
  const o = orbitInfo(f);
  if (f.wasOrbitAny && !f.capsuleOnly && !f.engineOn && !f.inMoon && f.alt > 20000 && f.alt < 400000 && !inOrbit(f) && o.peri < ATM_TOP) separateCapsule(f, 5);
}
function diyChute(f) {
  const vr = (f.x * f.vx + f.y * f.vy) / Math.hypot(f.x, f.y);
  if (!f.chuteOn && f.lifted && !f.inMoon && vr < -5 && f.alt < 3500 && f.plasma < 0.05 && Math.hypot(f.vx, f.vy) < 500) { f.engineOn = false; f.chuteOn = true; }
}
// coast in orbit with the warp button on its fastest
function coastUntil(f, until, tMax = 2e5) { return H.run(f, { until, tMax, warp: 200 }); }

// ------------------------------------------------------------ Moon trips
function helperMoonTrip(label, { legs, land }) {
  const f = newFlight({ legs });
  H.helperAscent(f);
  check(`${label}: reached orbit (helper ascent)`, inOrbit(f), `pe ${km(orbitInfo(f).peri)}, top fuel ${fuelLeft(f).toFixed(0)} kg`);
  f.wasOrbit = true;
  M.apStart(f, 'moon');                                   // the kid taps "To the Moon"
  H.run(f, { until: g => !g.ap, tMax: 2e5 });
  check(`${label}: helper flew into the Moon's pull`, f.inMoon && !f.outcome, `after ${(f.t / 3600).toFixed(1)} h`);
  if (!land) {
    H.run(f, { until: g => g.flyby || g.outcome, tMax: 2e5 });
    const B = bodyRel(f);
    check(`${label}: flew past the Moon (goal "Fly past the Moon")`, f.flyby && !f.outcome, `closest ${km(Math.hypot(B.rx, B.ry) - MOON_R)} above the Moon`);
    H.run(f, { until: g => !g.inMoon || g.outcome, tMax: 3e5 });
    M.apStart(f, 'home');                                 // the kid taps "Come home"
    H.run(f, { tMax: 6e5 });
    check(`${label}: came home after the flyby`, f.outcome === 'landed', `outcome ${f.outcome}`);
    endFlight(f); return f;
  }
  M.apStart(f, 'land');                                   // the kid taps "Land on the Moon"
  H.run(f, { until: g => !g.ap || g.outcome, tMax: 2e5 });
  check(`${label}: landed on the Moon (goal "Land on the Moon")`, !!f.onMoon && !f.outcome, `touchdown ${f.landSpeed?.toFixed(2)} m/s, fuel left ${fuelLeft(f).toFixed(0)} kg`);
  if (!f.onMoon) { endFlight(f); return f; }
  world.flags.push({ a: f.onMoon.a, name: 'Test' });       // the kid taps "Plant flag"
  check(`${label}: flag planted on the Moon`, world.flags.length > 0);
  H.run(f, { tMax: 20 });
  M.apStart(f, 'leave');                                  // the kid taps "Fly home"
  H.run(f, { tMax: 8e5 });
  check(`${label}: came home from the Moon (goal "Come home from the Moon")`, f.outcome === 'landed' && f.moonLanded, `outcome ${f.outcome}, capsule only ${f.capsuleOnly}, heat ${f.heat.toFixed(2)}`);
  endFlight(f); return f;
}

function diyTransferToMoon(f, label) {
  // wait until the real Moon reaches the ghost Moon on the map (the burn takes a minute: start a little early)
  coastUntil(f, g => { const w = M.moonWindow(g); return w.tw < 40; }, 3e5);
  let p = null, stopped = false, t0 = f.t;
  H.run(f, { tMax: 600, until: g => stopped, ctl: g => {
    diyStageTap(g);
    const o = orbitInfo(g);
    const lean = M.leanFor(g, M.progradeH(g));
    if (o.escape || o.apo + R > P.MOON_A - P.MOON_SOI * 1.5) {
      p = M.predictFrom(g, { maxT: 400000 });
      if (p.soiIn) { kidOff(g); stopped = true; return lean; }        // hint: "Your path reaches the Moon's pull. Stop engine!"
    }
    kidOn(g); return lean;                                           // hint: "Lean flat forward and burn"
  } });
  check(`${label}: path reaches the Moon's pull after the burn`, !!(p && p.soiIn), p && p.soiIn ? `predicted closest pass ${km(Math.abs(p.moonSigned) - MOON_R)}` : 'no encounter');
  // half way out: aim the pass low over the Moon (the hint shows which way to lean, and says Stop)
  H.run(f, { until: g => M.diyAimTime(g) || g.outcome, tMax: 2e5 });
  let h = null;
  H.run(f, { tMax: 5000, until: g => { h = M.diyAimHint(g); if (h.key === 'aimOk' || h.key === 'aimStuck') { kidOff(g); return true; } return false; },
    ctl: g => diyFollow(g, h) });
  H.run(f, { until: g => g.inMoon || g.outcome, tMax: 2e5 });
  // a last touch-up inside the Moon's pull, if the hint asks for one
  H.run(f, { tMax: 3000, until: g => { h = M.diyAimHint(g); if (h.key === 'aimOk' || h.key === 'aimStuck') { kidOff(g); return true; } return false; },
    ctl: g => diyFollow(g, h) });
}

function diyMoonTrip(label, { land }) {
  const f = newFlight({ diy: true, legs: true });
  H.diyAscent(f); f.wasOrbitAny = true;
  check(`${label}: reached orbit by myself`, inOrbit(f), `pe ${km(orbitInfo(f).peri)}`);
  diyTransferToMoon(f, label);
  check(`${label}: entered the Moon's pull`, f.inMoon && !f.outcome);
  const aimP = M.predictFrom(f, { maxT: 200000 });
  check(`${label}: aimed the pass low over the Moon`, Math.abs(aimP.moonSigned) - MOON_R > 3000 && Math.abs(aimP.moonSigned) - MOON_R < 60000, `pass ${km(Math.abs(aimP.moonSigned) - MOON_R)} up`);
  if (!land) {
    H.run(f, { until: g => g.flyby || g.outcome, tMax: 2e5 });
    check(`${label}: flew past the Moon by myself`, f.flyby && !f.outcome);
    endFlight(f); return f;
  }
  H.run(f, { until: g => g.onMoon || g.outcome, tMax: 2e5, ctl: g => diyFollow(g, M.diyLandHint(g)) });
  check(`${label}: landed on the Moon by myself`, !!f.onMoon && !f.outcome, `touchdown ${(f.landSpeed ?? f.hit)?.toFixed(2)} m/s${f.outcome ? `, ${f.outcome}, tilt ${((f.tiltAt || 0) * 57.3).toFixed(0)} deg` : ''}, fuel ${fuelLeft(f).toFixed(0)} kg`);
  if (!f.onMoon) { endFlight(f); return f; }
  world.flags.push({ a: f.onMoon.a, name: 'Test DIY' });
  // fly home: up, lean the arrow's way, stop when the path comes home; fix the low point at the top if needed
  let cache = null, ct = 0;
  H.run(f, { tMax: 6e5, until: g => !g.inMoon || g.outcome, ctl: g => {
    if (g.t - ct > 0.25) { cache = null; ct = g.t; }
    const h = M.diyLeaveHint(g, cache);
    return diyFollow(g, h);
  } });
  H.run(f, { tMax: 8e5, ctl: g => {
    diyStageTap(g); diyDropTank(g); diyChute(g);
    if (g.capsuleOnly || g.alt < 400000) { kidOff(g); return 0; }
    return diyFollow(g, M.diyHomeHint(g));
  } });
  check(`${label}: came home from the Moon by myself`, f.outcome === 'landed' && f.moonLanded, `outcome ${f.outcome}, capsule only ${f.capsuleOnly}, chute ${f.chuteOn}, hit ${f.hit && f.hit.toFixed(1)} m/s, heat ${f.heat.toFixed(2)}, fuel ${fuelLeft(f).toFixed(0)}`);
  endFlight(f); return f;
}

// ------------------------------------------------------------ satellites
function releaseSat(f, kind) {
  const k = M.kepFromState(f.released.x, f.released.y, f.released.vx, f.released.vy, f.released.T);
  world.sats.push({ kind, kep: k });
  return k;
}
function helperSat(kind, label) {
  const f = newFlight({ payload: kind, stages: 3 });
  H.helperAscent(f);
  const relays = world.sats.filter(s => s.kind === 'relay').map(s => s.kep);
  const T = f.T0 + f.t;
  const slot = kind === 'relay' ? M.relaySlot(relays.map(k => M.kepAt(k, T))) : null;
  M.apStart(f, 'release', kind === 'relay' ? { targetR: M.RELAY_R, slot, slotT: T } : {});   // the kid taps "Release satellite"
  H.run(f, { until: g => !g.ap || g.outcome, tMax: 1e5 });
  check(`${label}: satellite released`, !!f.released, f.released ? '' : `ap ${f.ap && f.ap.phase} out ${f.outcome}`);
  if (!f.released) { endFlight(f); return null; }
  const k = releaseSat(f, kind);
  check(`${label}: it stays in orbit (low point above the air)`, staysUp(k), `orbit ${km(M.kepPeri(k))} x ${km(M.kepApo(k))}`);
  endFlight(f); return k;
}
function diySat(kind, label, { toRelay } = {}) {
  const f = newFlight({ payload: kind, stages: 3, diy: true });
  H.diyAscent(f);
  if (toRelay) {
    const relays = world.sats.filter(s => s.kind === 'relay').map(s => s.kep);
    if (relays.length) coastUntil(f, g => M.relayWindow(g, relays).tw < 20, 3e5);   // hint: "Burn when the open spot is about here"
    let stg = 'raise';
    H.run(f, { tMax: 2e5, until: g => stg === 'done' || g.outcome, ctl: g => {
      diyStageTap(g);
      const h = M.diyRaiseHint(g, M.RELAY_R, stg);
      if (stg === 'raise' && !h.burn) { kidOff(g); stg = 'coast'; return h.lean; }
      if (stg === 'coast' && h.tta < 25) { stg = 'circ'; }
      if (stg === 'circ' && !h.burn) { kidOff(g); stg = 'done'; return h.lean; }
      return diyFollow(g, h);
    } });
  }
  // the kid taps Release (Do it yourself: lets go right where you are)
  const ok = inOrbit(f);
  f.released = { x: f.x, y: f.y, vx: f.vx, vy: f.vy, T: f.T0 + f.t };
  const k = releaseSat(f, kind);
  check(`${label}: released by myself and it stays up`, ok && staysUp(k), `orbit ${km(M.kepPeri(k))} x ${km(M.kepApo(k))}`);
  endFlight(f); return k;
}

// ------------------------------------------------------------ station
function helperStationCore(label) {
  const f = newFlight({ payload: 'module', stages: 3 });
  H.helperAscent(f);
  M.apStart(f, 'release', { targetR: M.STATION_R });       // the kid taps "Start the station"
  H.run(f, { until: g => !g.ap || g.outcome, tMax: 1e5 });
  check(`${label}: station core released`, !!f.released);
  if (!f.released) { endFlight(f); return; }
  const k = M.kepFromState(f.released.x, f.released.y, f.released.vx, f.released.vy, f.released.T);
  world.station = { kep: k, modules: ['core'] };
  check(`${label}: station stays in orbit (goal "Start a space station")`, staysUp(k), `orbit ${km(M.kepPeri(k))} x ${km(M.kepApo(k))}`);
  endFlight(f);
}
function helperDock(label) {
  const f = newFlight({ payload: 'module', stages: 3 });
  H.helperAscent(f);
  M.apStart(f, 'dock', { station: world.station.kep });     // the kid taps "Go to station"
  H.run(f, { until: g => !g.ap || g.outcome, tMax: 2e5 });
  check(`${label}: docked to the station`, !!f.docked, f.docked ? `after ${(f.t / 60).toFixed(0)} min, fuel left ${fuelLeft(f).toFixed(0)} kg` : `ended ${f.log.filter(l => String(l[0]).startsWith('apDone')).pop()}`);
  if (f.docked) world.station.modules.push(M.moduleFor(world.station.modules.length).kind);
  endFlight(f);
}
function diyDock(label) {
  const f = newFlight({ payload: 'module', stages: 3, diy: true });
  H.diyAscent(f);
  // round off the orbit at the top first (hint), so the timing works
  let stg = 'coast';
  H.run(f, { tMax: 1e5, until: g => stg === 'done', ctl: g => {
    diyStageTap(g); const o = orbitInfo(g);
    if (stg === 'coast') { if (M.timeToTop(g) < 20) stg = 'circ'; kidOff(g); return M.leanFor(g, M.progradeH(g)); }
    if (o.peri > o.apo - 6000) { kidOff(g); stg = 'done'; } else kidOn(g);
    return M.leanFor(g, M.progradeH(g));
  } });
  coastUntil(f, g => M.stationWindow(g, world.station.kep).tw < 15, 3e5);   // hint: "Burn when the station is about here"
  const rs = Math.hypot(M.kepAt(world.station.kep, f.T0 + f.t).x, M.kepAt(world.station.kep, f.T0 + f.t).y);
  stg = 'raise';
  let minD = Infinity;
  H.run(f, { tMax: 2e5, until: g => stg === 'near' || g.outcome, ctl: g => {
    diyStageTap(g);
    const rel = M.relToStation(g, world.station.kep), s = rel.s, d = rel.d, rv = rel.rv;
    if (stg === 'raise') { const h = M.diyRaiseHint(g, rs, 'raise'); if (!h.burn) { kidOff(g); stg = 'coast'; } return diyFollow(g, h); }
    if (stg === 'coast') { if (M.timeToTop(g) < 8) stg = 'match'; kidOff(g); return M.leanFor(g, M.progradeH(g)); }
    if (stg === 'match') {   // hint: "Burn to match the station's speed"
      const want = Math.atan2(-rel.rvx, -rel.rvy);
      if (rv < 15 || rv > (g.minRv ?? Infinity) + 2) { kidOff(g); stg = 'near'; return 0; }
      g.minRv = Math.min(g.minRv ?? Infinity, rv);
      const l = M.leanFor(g, want), B = P.bodyRel(g), tgtH = Math.atan2(B.rx, B.ry) + l * Math.PI / 2;
      if (Math.abs(P.wrapA(g.heading - tgtH)) > 0.15) { kidOff(g); return l; }   // turn first, then burn
      kidOn(g); return M.leanFor(g, want);
    }
    return 0;
  } });
  // close the distance (hint: "Lean toward the station and burn a little") until the Dock button shows
  H.run(f, { tMax: 20000, until: g => { const h = M.diyDockHint(g, world.station.kep); return h.key === 'dockReady' || h.key === 'dockFar' || g.outcome; },
    ctl: g => { diyStageTap(g); return diyFollow(g, M.diyDockHint(g, world.station.kep)); } });
  const { d, rv } = M.relToStation(f, world.station.kep);
  check(`${label}: matched the station's orbit by myself`, d < M.DOCK_RANGE && rv < M.DOCK_SPEED, `${km(d)} away, ${rv.toFixed(1)} m/s apart`);
  if (d < M.DOCK_RANGE && rv < M.DOCK_SPEED) {
    M.apStart(f, 'dock', { station: world.station.kep, close: true });   // the kid taps "Dock": the helper lines up
    H.run(f, { until: g => !g.ap || g.outcome, tMax: 1e5 });
  }
  check(`${label}: docked (Do it yourself)`, !!f.docked);
  if (f.docked) world.station.modules.push(M.moduleFor(world.station.modules.length).kind);
  endFlight(f);
}

// ------------------------------------------------------------ unit checks
function unitChecks() {
  // Kepler round trip: a satellite saved now is back in the same place one orbit later
  const k = M.kepFromState(R + 300000, 0, 0, -Math.sqrt(P.GM / (R + 300000)) * 1.05, 1000);
  const per = 2 * Math.PI * Math.sqrt(k.a ** 3 / P.GM);
  const a = M.kepAt(k, 1000), b = M.kepAt(k, 1000 + per);
  check('orbit maths: a saved satellite comes back to the same spot after one orbit', Math.hypot(a.x - b.x, a.y - b.y) < 1 && Math.abs(a.x - (R + 300000)) < 1, `${Math.hypot(a.x - b.x, a.y - b.y).toFixed(3)} m`);
  // Kepler vs. the flight integrator over one orbit
  const f = P.newFlight({ nose: 'capsule', tank: 'short', engine: 'small', stages: 1 });
  Object.assign(f, { x: R + 300000, y: 0, vx: 0, vy: -Math.sqrt(P.GM / (R + 300000)) * 1.05, lifted: true, alt: 300000, engineOn: false, T0: 1000, t: 0 });
  M.advance(f, per / 2, 0, {});
  const c = M.kepAt(k, 1000 + f.t);
  check('orbit maths: coasting in the game matches the saved-orbit maths', Math.hypot(f.x - c.x, f.y - c.y) < 50, `${Math.hypot(f.x - c.x, f.y - c.y).toFixed(1)} m apart after half an orbit`);
  // relay ring rule
  const ring = (n, rr, spread) => M.relayRing(Array.from({ length: n }, (_, i) => ({ x: rr * Math.cos(i * spread), y: rr * Math.sin(i * spread) })));
  check('relay ring: 3 high relays spread evenly make a ring', ring(3, M.RELAY_R, 2 * Math.PI / 3).ok);
  check('relay ring: 3 low relays cannot see each other past the planet', !ring(3, R + 200000, 2 * Math.PI / 3).ok);
  check('relay ring: 2 relays are not a ring', !ring(2, M.RELAY_R, Math.PI).ok);
  // saves
  const v1 = { reached: { clouds: true, space: true, orbit: false, home: false }, unlocked: { fins: true }, config: { nose: 'pointy', tank: 'medium', engine: 'big', fins: true }, flights: 7, best: 80000 };
  const m1 = migrate(v1);
  check('old save (v1) migrates: progress kept, stages given, new fields added', m1.reached.space && m1.unlocked.stages && m1.config.stages === 2 && Array.isArray(m1.sats) && m1.flights === 7 && m1.v === 3 && currentGoal(m1).id === 'orbit');
  const v2 = { v: 2, reached: { clouds: true, space: true, orbit: true, home: true }, unlocked: { fins: true, tall: true, stages: true, shield: true }, seen: { fins: true, tall: true, stages: true, shield: true }, config: { nose: 'capsule', tank: 'tall', engine: 'big', fins: true, stages: 2, shield: true }, diy: true, heard: { lift: 3 }, flights: 20, warp: 50 };
  const m2 = migrate(v2);
  check('v2 save (came home safe) migrates: third stage unlocked, next goal is the Moon', m2.unlocked.stage3 && m2.config.stages === 3 && m2.seen.stage3 === false && currentGoal(m2).id === 'moonfly' && m2.diy && m2.heard.lift === 3 && m2.warp === 50);
  const m3 = migrate(JSON.parse(JSON.stringify({ ...m2, sats: [{ kind: 'relay', kep: k }], flags: [{ a: 1, name: 'J' }] })));
  check('v3 save round trip keeps satellites and flags (arrays stay arrays)', Array.isArray(m3.sats) && m3.sats.length === 1 && m3.flags[0].name === 'J');
  check('broken save falls back to a fresh one', migrate('nope').v === 3 && migrate(null).reached.clouds === false);
  const locked = migrate({}); locked.config.nose = 'relay';
  check('a payload you have not unlocked is not offered', !noseChoices(migrate({})).includes('relay') && migrate({ config: { nose: 'relay' } }).config.nose === 'capsule');
  check('goal ladder: one goal at a time, the Moon then satellites then the station', GOALS.map(g => g.id).join(',') === 'clouds,space,orbit,home,moonfly,moonland,moonhome,sat,ring,station,dock,station4');
}

// ------------------------------------------------------------ run everything
const t0 = Date.now();
console.log('--- unit checks'); unitChecks();
console.log('--- Helpers on');
helperMoonTrip('Helper Moon flyby (no legs)', { legs: false, land: false });
helperMoonTrip('Helper Moon landing', { legs: true, land: true });
helperSat('weather', 'Helper weather satellite');
const relaysBefore = world.sats.length;
helperSat('relay', 'Helper relay 1'); helperSat('relay', 'Helper relay 2'); helperSat('relay', 'Helper relay 3');
{ const pts = world.sats.filter(s => s.kind === 'relay').map(s => M.kepAt(s.kep, world.T)); const r = M.relayRing(pts);
  check('Helper: ring of 3 relay satellites works (goal "Build a ring of 3 relay satellites")', r.ok, r.links.map(l => l.clear ? 'clear' : 'blocked').join(', '));
  const later = M.relayRing(world.sats.filter(s => s.kind === 'relay').map(s => M.kepAt(s.kep, world.T + 86400 * 3)));
  check('Helper: the ring still works 3 days later (relays stay spread out)', later.ok); }
helperStationCore('Helper station');
helperDock('Helper dock 1'); helperDock('Helper dock 2');
console.log('--- Do it yourself');
diyMoonTrip('DIY Moon flyby', { land: false });
diyMoonTrip('DIY Moon landing', { land: true });
diySat('telescope', 'DIY telescope');
const savedRelays = world.sats.filter(s => s.kind === 'relay'); world.sats = world.sats.filter(s => s.kind !== 'relay');   // a fresh sky for the DIY ring
diySat('relay', 'DIY relay 1', { toRelay: true }); diySat('relay', 'DIY relay 2', { toRelay: true }); diySat('relay', 'DIY relay 3', { toRelay: true });
{ const r = M.relayRing(world.sats.filter(s => s.kind === 'relay').map(s => M.kepAt(s.kep, world.T)));
  check('DIY: ring of 3 relay satellites works', r.ok, r.links.map(l => l.clear ? 'clear' : 'blocked').join(', ')); }
world.sats.push(...savedRelays);
diyDock('DIY dock');
check('Station grew to 4 parts over 4 flights, helper + DIY (goal "Grow your station to 4 parts")', world.station && world.station.modules.length >= 4, world.station && world.station.modules.join(' + '));
console.log(`\n${passes} passed, ${fails} failed  (${((Date.now() - t0) / 1000).toFixed(1)} s, game clock ${(world.T / 86400).toFixed(1)} days)`);
process.exitCode = fails ? 1 : 0;
export { results };
