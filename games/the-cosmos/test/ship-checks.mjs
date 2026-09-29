// ============================================================================
// ship-checks.mjs — the ship's share of the validator (section 9).
//
// Called from validate.mjs with its own check() and section(), so the ship's
// results count in the same total and the same exit code.
//
// EVERY CHECK HERE DRIVES THE REAL CODE. The walker is the walker the game
// uses, the flight model is the one that flies, the bolts are the ones that
// draw. Nothing is re-implemented for the test.
// ============================================================================

import { join } from 'path';

export async function runShipChecks({ ROOT, check, section, THREE, mars, FIELD, GEO, Walker, Registry, gravityAtRadius }) {
  const imp = (p) => import(`file://${join(ROOT, p)}`);
  const SPEC = await imp('src/ship/shipSpec.js');
  const { ShipWalker, shipIndex, defaultState } = await imp('src/ship/shipWalker.js');
  const { ShipBody } = await imp('src/ship/shipFlight.js');
  const { Stations } = await imp('src/ship/shipStations.js');
  const { GunSystem, DroneSystem } = await imp('src/ship/guns.js');
  const { findLandingSite, siteOrigin } = await imp('src/ship/shipSite.js');
  const { makeShipMaterials } = await imp('src/ship/shipTextures.js');
  const { buildInterior, buildSeats } = await imp('src/ship/shipInterior.js');
  const EXT = await imp('src/ship/shipExterior.js');
  const SYS = await imp('src/ship/shipSystem.js');
  const L = SPEC.buildLayout();
  const { DECK, AVATAR } = SPEC;

  section('9. The ship: a real place you walk through, sit in and fly');

  // ---- 9a. Human scale ------------------------------------------------------------------
  section('9a. Real human scale');
  check('decks are 3.0 m apart: 2.7 m clear plus a 0.3 m slab',
    DECK.pitch === 3 && DECK.clear === 2.7 && Math.abs(DECK.pitch - DECK.clear - DECK.slab) < 1e-9 &&
    DECK.main - DECK.lower === 3 && DECK.bridge - DECK.main === 3);
  check('the avatar is 1.78 m tall with a 1.66 m eye, and fits a 2.7 m deck with room to jump',
    AVATAR.heightM === 1.78 && AVATAR.eyeM === 1.66 && AVATAR.heightM + 0.5 < DECK.clear);
  check('every door is at least 2.0 m tall and 0.9 m wide',
    L.doors.every((d) => d.h >= 2.0 && d.w >= 0.9), L.doors.filter((d) => d.h < 2.0 || d.w < 0.9).map((d) => d.id).join());
  check('corridors are 1.3 to 1.7 m wide',
    L.rooms.filter((r) => r.kind === 'corridor').every((r) => (r.x1 - r.x0) >= 1.3 && (r.x1 - r.x0) <= 1.7),
    L.rooms.filter((r) => r.kind === 'corridor').map((r) => (r.x1 - r.x0).toFixed(2)).join());
  check('stairs rise 0.1875 m a step, the same as a building-code riser',
    Math.abs(3.0 / SPEC.STAIRS.up.rise - 0.1875) < 1e-9 && Math.abs(3.0 / SPEC.STAIRS.down.rise - 0.1875) < 1e-9);
  {
    const overlaps = [];
    for (let i = 0; i < L.rooms.length; i++) for (let j = i + 1; j < L.rooms.length; j++) {
      const a = L.rooms[i], b = L.rooms[j];
      const yo = a.y < b.y + b.h - 0.01 && b.y < a.y + a.h - 0.01;
      const xo = a.x0 < b.x1 - 0.01 && b.x0 < a.x1 - 0.01;
      const zo = a.z0 < b.z1 - 0.01 && b.z0 < a.z1 - 0.01;
      if (yo && xo && zo) overlaps.push(`${a.id}/${b.id}`);
    }
    check('no two rooms occupy the same space', overlaps.length === 0, overlaps.join());
  }
  {
    const bad = [];
    for (const p of L.props) {
      const r = L.roomById.get(p.room);
      const b = SPEC.propBox(p);
      if (b.x0 < r.x0 - 0.03 || b.x1 > r.x1 + 0.03 || b.z0 < r.z0 - 0.03 || b.z1 > r.z1 + 0.03) bad.push(`${p.kind}@${p.room}(${p.x},${p.z})`);
    }
    check('every piece of furniture stands inside its own room', bad.length === 0, bad.join());
  }
  {
    const bad = [];
    for (let i = 0; i < L.props.length; i++) for (let j = i + 1; j < L.props.length; j++) {
      const a = L.props[i], b = L.props[j];
      if (a.room !== b.room || !a.blocks || !b.blocks) continue;
      const A = SPEC.propBox(a), B = SPEC.propBox(b);
      const ov = A.x0 < B.x1 - 0.02 && B.x0 < A.x1 - 0.02 && A.z0 < B.z1 - 0.02 && B.z0 < A.z1 - 0.02 && A.y0 < B.y1 - 0.02 && B.y0 < A.y1 - 0.02;
      if (ov) bad.push(`${a.kind}/${b.kind}@${a.room}`);
    }
    check('no two pieces of furniture pass through each other', bad.length === 0, bad.slice(0, 6).join());
  }
  check('every door joins two rooms that exist (or the outside)',
    L.doors.every((d) => (L.roomById.has(d.a) || ['stair_up', 'stair_down'].includes(d.a)) &&
      (L.roomById.has(d.b) || d.b === 'outside' || ['stair_up', 'stair_down'].includes(d.b))));

  // ---- 9b. Everything is walkable, by the real walker -----------------------------------------
  section('9b. Decks are walkable: stairs, ladders, ramps, doors');
  const stW = defaultState(); stW.ramps.cargo.lowered = true; stW.ramps.cargo.angle = 0.5;
  const reach = new ShipWalker(shipIndex, stW);
  const STEPG = 0.2;
  const seen = new Map();
  const key = (x, z, y) => `${Math.round(x / STEPG)},${Math.round(z / STEPG)},${Math.round(y * 4)}`;
  const flood = (sx, sz, sy) => {
    const q = [{ x: sx, z: sz, y: sy }];
    seen.set(key(sx, sz, sy), q[0]);
    while (q.length) {
      const c = q.pop();
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = c.x + dx * STEPG, nz = c.z + dz * STEPG;
        const sup = reach.canStand(nx, c.y, nz);
        if (!sup || Math.abs(sup.floor - c.y) > 0.35) continue;
        const k = key(nx, nz, sup.floor);
        if (seen.has(k)) continue;
        const n = { x: nx, z: nz, y: sup.floor };
        seen.set(k, n); q.push(n);
      }
    }
  };
  flood(0, 21.5, reach.support(0, 0, 21.5).floor);
  // Ladders are the only way to the turrets: climb them with the real walker, then flood from the top.
  const dorsal = SPEC.LADDERS.find((l) => l.id === 'ladder_dorsal');
  const ventral = SPEC.LADDERS.find((l) => l.id === 'ladder_ventral');
  {
    const w = new ShipWalker(shipIndex, stW);
    w.place(dorsal.bottom.x, dorsal.y0, dorsal.bottom.z, -Math.PI / 2);     // facing the rungs, toward -X
    let topped = false, t = 0;
    for (let i = 0; i < 60 * 12 && !topped; i++, t += 1 / 60) {
      w.tick(1 / 60, { moveZ: 1 });
      if (w.events.includes('ladder_top')) topped = true;
    }
    check('the dorsal turret ladder is climbed by walking into it: you arrive on the upper deck',
      topped && Math.abs(w.y - 6.0) < 0.01 && t < 8, `topped ${topped} y ${w.y.toFixed(2)} in ${t.toFixed(1)} s`);
    flood(dorsal.topExit.x, dorsal.topExit.z, 6.0);
  }
  {
    const w = new ShipWalker(shipIndex, stW);
    w.place(ventral.topExit.x, 0, ventral.topExit.z, 0);   // facing the bow, toward the hatch
    let down = false;
    for (let i = 0; i < 60 * 10 && !down; i++) { w.tick(1 / 60, { moveZ: 1 }); if (w.events.includes('ladder_bottom')) down = true; }
    check('the ventral turret hatch: walk to the edge and you climb down into the pit',
      down && Math.abs(w.y - -1.0) < 0.01, `down ${down} y ${w.y.toFixed(2)}`);
    flood(ventral.bottomExit.x, ventral.bottomExit.z, -1.0);
  }
  {
    const cover = {};
    for (const v of seen.values()) for (const r of L.rooms) {
      if (v.x > r.x0 && v.x < r.x1 && v.z > r.z0 && v.z < r.z1 && Math.abs(v.y - r.y) < 0.6) cover[r.id] = (cover[r.id] || 0) + 1;
    }
    const unreached = L.rooms.filter((r) => (cover[r.id] || 0) < 6).map((r) => r.id);
    check('every room on every deck is reachable on foot from the boarding ramp', unreached.length === 0, `not reached: ${unreached.join()}`);
    const miss = [];
    for (const s of SPEC.SEATS) {
      let ok = false;
      for (const v of seen.values()) if (Math.hypot(v.x - s.x, v.z - s.z) < 1.45 && Math.abs(v.y - s.y) < 0.8) { ok = true; break; }
      if (!ok) miss.push(s.id);
    }
    check('every seat can be reached and sat in from a floor you can stand on', miss.length === 0, miss.join());
  }
  {
    const w = new ShipWalker(shipIndex, stW);
    w.place(0, 3.0, -8.4, 0);                          // foot of the bridge stair, facing the bow
    let maxStep = 0, last = w.y;
    for (let i = 0; i < 60 * 14 && w.y < 5.99; i++) { w.tick(1 / 60, { moveZ: 1 }); maxStep = Math.max(maxStep, Math.abs(w.y - last)); last = w.y; }
    check('the bridge stair is climbed to the upper deck: one smooth ramp with no popping',
      w.y >= 5.99 && w.z < -13.3 && maxStep < 0.12, `y ${w.y.toFixed(2)} z ${w.z.toFixed(2)} biggest per-frame change ${maxStep.toFixed(3)} m`);
    const d = new ShipWalker(shipIndex, stW);
    d.place(0, 3.0, 3.7, Math.PI);                     // top of the engineering stair, facing the stern
    let mx = 0, lst = d.y;
    for (let i = 0; i < 60 * 14 && d.y > 0.02; i++) { d.tick(1 / 60, { moveZ: 1 }); mx = Math.max(mx, Math.abs(d.y - lst)); lst = d.y; }
    check('the engineering stair walks down to the lower deck',
      d.y <= 0.02 && d.z > 8.3 && mx < 0.14, `y ${d.y.toFixed(2)} z ${d.z.toFixed(2)} step ${mx.toFixed(3)}`);
  }
  {
    // the boarding ramp, walked up from the ground
    const w = new ShipWalker(shipIndex, stW);
    const R = SPEC.RAMPS.cargo, run = R.length * Math.cos(0.5);
    const startZ = R.hinge.z + run - 0.5;
    w.place(0, -(startZ - R.hinge.z) * Math.tan(0.5), startZ, 0);            // near the foot, facing the bow
    let ok = false;
    for (let i = 0; i < 60 * 12 && !ok; i++) { w.tick(1 / 60, { moveZ: 1 }); if (w.z < R.hinge.z - 1.0 && Math.abs(w.y) < 0.02) ok = true; }
    check('the boarding ramp is walked up into the cargo bay', ok, `z ${w.z.toFixed(2)} y ${w.y.toFixed(2)}`);
    // and the way out: walking off the end of it asks to leave the ship
    const e = new ShipWalker(shipIndex, stW);
    e.place(0, 0, 19.0, Math.PI);
    let exited = false;
    for (let i = 0; i < 60 * 12 && !exited; i++) { e.tick(1 / 60, { moveZ: 1 }); if (e.events.some((v) => v.startsWith('exit:'))) exited = true; }
    check('walking down the ramp to its end steps you off the ship onto the ground', exited, `at z ${e.z.toFixed(2)}`);
  }
  {
    const fails = [];
    for (const d of L.doors) {
      if (d.kind === 'outer' || d.kind === 'portal' || d.b === 'outside') continue;
      const ra = L.roomById.get(d.a), rb = L.roomById.get(d.b);
      const w = new ShipWalker(shipIndex, stW);
      let dir, yaw;
      if (d.axis === 'x') { const ca = ra ? (ra.x0 + ra.x1) / 2 : d.at - 1; const cb = rb ? (rb.x0 + rb.x1) / 2 : d.at + 1; dir = Math.sign(cb - ca); yaw = dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
      else { const ca = ra ? (ra.z0 + ra.z1) / 2 : d.at - 1; const cb = rb ? (rb.z0 + rb.z1) / 2 : d.at + 1; dir = Math.sign(cb - ca); yaw = dir > 0 ? Math.PI : 0; }
      const sx = d.axis === 'x' ? d.at - dir * 0.9 : d.c, sz = d.axis === 'x' ? d.c : d.at - dir * 0.9;
      const sup = w.support(sx, d.y + 0.1, sz);
      w.place(sx, sup ? sup.floor : d.y, sz, yaw);
      let passed = false;
      for (let i = 0; i < 60 * 5 && !passed; i++) {
        w.tick(1 / 60, { moveZ: 1 });
        const along = d.axis === 'x' ? (w.x - d.at) * dir : (w.z - d.at) * dir;
        if (along > 0.7) passed = true;
      }
      if (!passed) fails.push(d.id);
    }
    check('you can walk through every doorway', fails.length === 0, `blocked: ${fails.join()}`);
  }
  {
    let violations = 0, frames = 0;
    const w = new ShipWalker(shipIndex, stW);
    let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    for (const room of ['medbay', 'crew_a', 'galley', 'crew_b', 'cabin', 'workshop', 'engineering', 'cargo', 'bridge', 'evalocker']) {
      const r = L.roomById.get(room);
      w.place((r.x0 + r.x1) / 2, r.y, (r.z0 + r.z1) / 2, rnd() * 6.28);
      for (let k = 0; !w.canStand(w.x, w.y, w.z) && k < 80; k++) w.x += 0.2;
      for (let i = 0; i < 900; i++) {
        if (i % 40 === 0) w.yaw += (rnd() - 0.5) * 3;
        w.tick(1 / 60, { moveZ: 1, moveX: (rnd() - 0.5) * 0.4, run: rnd() < 0.2 });
        frames++;
        if (w.ladder) continue;
        if (!w.support(w.x, w.y + 0.02, w.z) || w.blocked(w.x, w.y, w.z)) violations++;
      }
    }
    check(`walls and furniture stop you: ${frames} frames of random walking, none inside a wall or a bunk`,
      violations === 0, `${violations} bad frames`);
  }

  // ---- 9c. Seats --------------------------------------------------------------------------------
  section('9c. Seats: you cannot use a station unless you are sitting in it');
  const groundF = (dx, dy, dz) => FIELD.surfaceRadiusFast(mars, dx, dy, dz);
  const spawnW = new Walker(mars); spawnW.placeAtGeodetic(-14.0, -59.2, 1.5);
  const found = findLandingSite(mars, groundF, spawnW.worldPos);
  const makeShip = () => {
    const s = new ShipBody(mars, groundF);
    s.setDown(siteOrigin(groundF, found.at, found.site), found.site.hd * Math.PI / 180);
    for (let i = 0; i < 60 * 9; i++) s.step(1 / 60);
    return s;
  };
  const ship = makeShip();
  check('the ship is set down on ground level enough for four legs (spread under 1.4 m) within sight of the spawn',
    found.site.spread < 1.4 && found.site.dist < 95, `spread ${found.site.spread.toFixed(2)} m at ${found.site.dist} m`);
  check('after settling it is landed and at rest', ship.landed && ship.speed < 0.05, `landed ${ship.landed} speed ${ship.speed.toFixed(3)}`);
  {
    const st = new Stations(ship);
    const before = JSON.stringify(ship.power);
    const standing = [
      st.fly({ fwd: 1, lift: 1, yaw: 1 }), st.power('engines', 90), st.scanRange(2), st.transmitBeacon(true),
      st.mayFire('main'), st.mayFire('dorsal'), st.mayFire('ventral'),
    ];
    check('standing in a corridor, every station command is refused',
      standing.every((v) => v === false) && ship.controls.fwd === 0 && ship.controls.lift === 0 && JSON.stringify(ship.power) === before, JSON.stringify(standing));
    check('you cannot sit in a seat you are nowhere near', st.sit({ x: 0, y: 3, z: 0 }) === null && st.seated === null);

    const only = (seatId, allowed) => {
      const s = SPEC.SEATS.find((q) => q.id === seatId);
      const st2 = new Stations(ship);
      ship.controls.fwd = 0; ship.controls.lift = 0; ship.controls.yaw = 0;
      const sat = st2.sit({ x: s.x + 0.4, y: s.y, z: s.z + 0.5 });
      if (!sat || sat.id !== seatId) return `could not sit ${seatId}`;
      const res = {
        fly: st2.fly({ fwd: 1 }), power: st2.power('engines', ship.power.engines), scan: st2.scanRange(1), beacon: st2.transmitBeacon(false),
        main: st2.mayFire('main'), dorsal: st2.mayFire('dorsal'), ventral: st2.mayFire('ventral'),
      };
      const wrong = Object.keys(res).filter((k) => res[k] !== allowed.includes(k));
      st2.stand();
      return wrong.length ? `${seatId}: wrong on ${wrong.join()}` : null;
    };
    const problems = [
      only('captain', ['fly', 'main']), only('pilot', ['fly']), only('nav', ['scan']), only('comms', ['beacon']),
      only('engineer', ['power']), only('gun_dorsal', ['dorsal']), only('gun_ventral', ['ventral']),
    ].filter(Boolean);
    check('each seat unlocks exactly its own station and nothing else', problems.length === 0, problems.join('; '));

    const st3 = new Stations(ship);
    st3.sit({ x: 0, y: 6.2, z: -14.3 });
    st3.fly({ fwd: 1, lift: 0.5 });
    const held = ship.controls.fwd === 1;
    check('you cannot sit in two seats at once', st3.sit({ x: -1.6, y: 6, z: -17.2 }) === null && st3.seated === 'captain');
    st3.stand();
    check('standing up lets go of the stick: the controls return to zero',
      held && ship.controls.fwd === 0 && ship.controls.lift === 0 && st3.seated === null);
  }

  // ---- 9d. Flight in real gravity ----------------------------------------------------------------------
  section('9d. Flight: lift off, thrust, turn, land, in real Martian gravity');
  {
    const s = makeShip();
    const r0 = Math.hypot(s.pos.x, s.pos.y, s.pos.z);
    const k = (r0 + 100) / r0;
    s.pos = { x: s.pos.x * k, y: s.pos.y * k, z: s.pos.z * k };
    s.vel = { x: 0, y: 0, z: 0 };
    s.autoHover = false;
    const g = gravityAtRadius(mars, r0 + 100);
    for (let i = 0; i < 60 * 4; i++) s.step(1 / 60);
    const fell = r0 + 100 - Math.hypot(s.pos.x, s.pos.y, s.pos.z);
    const expect = 0.5 * g * 4 * 4;
    check('with the engines idle the ship falls at the planet\'s gravity (3.72 m/s^2), not Earth\'s',
      Math.abs(fell - expect) / expect < 0.04, `fell ${fell.toFixed(2)} m in 4 s, expected ${expect.toFixed(2)} m`);
  }
  {
    const lowP = makeShip();
    lowP.setPowerSplit(10, 45, 45);
    const a0 = lowP.radarAltitude();
    lowP.controls.lift = 1;
    for (let i = 0; i < 60 * 10; i++) lowP.step(1 / 60);
    const gainLow = lowP.radarAltitude() - a0;
    const ok = makeShip();
    const b0 = ok.radarAltitude();
    ok.controls.lift = 1;
    for (let i = 0; i < 60 * 10; i++) ok.step(1 / 60);
    const gain = ok.radarAltitude() - b0;
    check('the ship lifts off the real planet at the default power split: 300 kN against 171 kN of weight',
      gain > 60 && ok.weightN() / 1000 > 165 && ok.weightN() / 1000 < 178, `gained ${gain.toFixed(1)} m, weight ${(ok.weightN() / 1000).toFixed(0)} kN`);
    check('routed away from the engines the same ship cannot leave the ground (thrust below weight)',
      gainLow < 0.5 && !lowP.canLiftOff() && ok.canLiftOff(), `low-power gain ${gainLow.toFixed(2)} m, can lift ${lowP.canLiftOff()}`);
  }
  {
    // A person on the deck for the whole flight: lift, cruise, turn, brake.
    const s = makeShip();
    const sw = new ShipWalker(shipIndex, defaultState());
    sw.place(0, 3.0, -1.0, 0.3);
    const start = { x: sw.x, y: sw.y, z: sw.z };
    const p0 = s.toWorld({ x: 0, y: -2.4, z: 0 }, {});
    let maxTilt = 0, minH = 9, maxH = -9, standing = true, peak = 0;
    const phases = [[3, { lift: 1, fwd: 0, yaw: 0 }], [6, { lift: 0.3, fwd: 1, yaw: 0 }], [5, { lift: 0, fwd: 1, yaw: 1 }], [5, { lift: 0, fwd: 0.5, yaw: -1 }], [5, { lift: 0, fwd: 0, yaw: 0 }]];
    for (const [secs, c] of phases) {
      Object.assign(s.controls, c);
      for (let i = 0; i < secs * 60; i++) {
        s.step(1 / 60);
        sw.tick(1 / 60, {});
        const wp = s.toWorld({ x: sw.x, y: sw.y, z: sw.z }, {});
        const up = s.dirToWorld({ x: 0, y: 1, z: 0 }, {});
        const h = (wp.x - s.pos.x) * up.x + (wp.y - s.pos.y) * up.y + (wp.z - s.pos.z) * up.z;
        minH = Math.min(minH, h); maxH = Math.max(maxH, h);
        const ru = Math.hypot(s.pos.x, s.pos.y, s.pos.z);
        maxTilt = Math.max(maxTilt, Math.acos(Math.min(1, (up.x * s.pos.x + up.y * s.pos.y + up.z * s.pos.z) / ru)) * 180 / Math.PI);
        if (!sw.grounded || sw.x !== start.x || sw.z !== start.z || sw.y !== start.y) standing = false;
        peak = Math.max(peak, s.radarAltitude());
      }
    }
    const away = Math.hypot(s.pos.x - p0.x, s.pos.y - p0.y, s.pos.z - p0.z);
    check('a person standing on a deck stays standing on it while the ship lifts, accelerates, banks and turns',
      standing && Math.abs(minH - 3.0) < 1e-6 && Math.abs(maxH - 3.0) < 1e-6, `deck distance ${minH}..${maxH}, grounded ${standing}`);
    check('the hull leans no more than 25 degrees off the local vertical, so the deck stays a floor',
      maxTilt < 25, `worst tilt ${maxTilt.toFixed(1)} deg`);
    check('and the ship really went somewhere: it climbed over 25 m and is now over 60 m from where it started',
      peak > 25 && away > 60, `peak ${peak.toFixed(0)} m, ${away.toFixed(0)} m away`);
  }
  {
    const s = makeShip();
    s.controls.lift = 1;
    for (let i = 0; i < 60 * 8; i++) s.step(1 / 60);
    s.controls.lift = 0;
    for (let i = 0; i < 60 * 3; i++) s.step(1 / 60);
    s.controls.lift = -1; s.controls.fwd = 0;
    let touch = null;
    for (let i = 0; i < 60 * 60 && !s.landed; i++) {
      s.step(1 / 60);
      for (const e of s.events) if (e.type === 'touchdown' && touch === null) touch = e.speed;
    }
    for (let i = 0; i < 60 * 6; i++) s.step(1 / 60);
    const legs = s.legs.map((l) => {
      const p = l.world; const r = Math.hypot(p.x, p.y, p.z);
      return { gap: r - groundF(p.x / r, p.y / r, p.z / r), comp: l.comp };
    });
    check('it comes down under control: touchdown under 3 m/s, landed, at rest, no hull damage',
      s.landed && touch !== null && touch < 3.0 && s.speed < 0.05 && s.hull === 100, `touchdown ${touch && touch.toFixed(2)} m/s landed ${s.landed} hull ${s.hull}`);
    check('landed, all four legs carry the ship and none has sunk below the ground it stands on',
      legs.every((l) => l.gap > -0.5 && l.comp > 0.02) && s.legs.every((l) => l.contact), JSON.stringify(legs.map((l) => +l.gap.toFixed(2))));
    let keelOK = true, footOK = true;
    for (const kp of SPEC.GEAR.keel) {
      const w = s.toWorld({ x: kp.x, y: SPEC.GEAR.keelY, z: kp.z }, {});
      if (FIELD.density(mars, w.x, w.y, w.z) < 0) keelOK = false;
    }
    for (const l of s.legs) {
      const p = l.world; const r = Math.hypot(p.x, p.y, p.z);
      const k = (r - 1.0) / r;                               // one metre below the foot
      if (!(FIELD.density(mars, p.x * k, p.y * k, p.z * k) < 0)) footOK = false;
    }
    check('the keel is in open air and every foot stands on solid ground in the 3D field: not sunk, not floating',
      keelOK && footOK, `keel ${keelOK} feet ${footOK}`);
  }
  {
    const a = makeShip();
    const total = (p) => p.engines + p.guns + p.shields;
    a.routePower('engines', 70); const p1 = { ...a.power };
    a.routePower('guns', 5); const p2 = { ...a.power };
    a.setPowerSplit(1, 1, 1); const p3 = { ...a.power };
    check('power routing always adds up to the reactor output, however it is shifted',
      total(p1) === 100 && total(p2) === 100 && total(p3) === 100 && p1.engines === 70, JSON.stringify([p1, p2, p3]));
    const e1 = makeShip(); e1.setPowerSplit(60, 20, 20);
    const e2 = makeShip(); e2.setPowerSplit(20, 40, 40);
    check('engineering changes real performance: engine share sets lift, shield share sets the shield cap',
      e1.maxLiftN > 2.5 * e2.maxLiftN * 0.95 && e2.shieldMax > e1.shieldMax,
      `lift ${(e1.maxLiftN / 1000).toFixed(0)} vs ${(e2.maxLiftN / 1000).toFixed(0)} kN, shield ${e1.shieldMax.toFixed(0)} vs ${e2.shieldMax.toFixed(0)}`);
  }

  // ---- 9e. Guns -----------------------------------------------------------------------------------
  section('9e. Guns fire visible bolts that hit the real ground');
  {
    const s = makeShip();
    const st = new Stations(s);
    const guns = new GunSystem(s, st, groundF);
    const eye = s.toWorld({ x: 0, y: 7.3, z: -15.1 }, {});
    const fwd = s.dirToWorld({ x: 0, y: -0.09, z: -1 }, {});
    const fl = Math.hypot(fwd.x, fwd.y, fwd.z); fwd.x /= fl; fwd.y /= fl; fwd.z /= fl;
    const fired = guns.fire('main', fwd, eye);
    check('standing on the bridge, the main guns will not fire', fired === 0 && guns.bolts.length === 0);
    st.sit({ x: 0, y: 6.2, z: -14.3 });
    guns.point('main', { x: 0, y: -0.09, z: -1 });
    const n = guns.fire('main', fwd, eye);
    check('seated in the captain\'s chair the same command fires a bolt, with its muzzle flash',
      n === 1 && guns.bolts.length === 1 && guns.events.some((e) => e.type === 'muzzle'));
    let hit = null, guard = 0;
    while (!hit && guard++ < 60 * 20) { guns.update(1 / 60); hit = guns.events.find((e) => e.type === 'impact'); }
    if (hit) {
      const r = Math.hypot(hit.x, hit.y, hit.z);
      const gr = groundF(hit.x / r, hit.y / r, hit.z / r);
      const dist = Math.hypot(hit.x - eye.x, hit.y - eye.y, hit.z - eye.z);
      check('the bolt strikes the surface: the impact lies on the ground to within 5 cm, well down range',
        Math.abs(r - gr) < 0.05 && dist > 20, `off surface by ${(r - gr).toFixed(3)} m at ${dist.toFixed(0)} m`);
    } else check('the bolt strikes the surface', false, 'no impact within 20 s');
    const count = (share) => {
      const sh = makeShip(); sh.setPowerSplit(100 - share - 10, share, 10);
      const st2 = new Stations(sh); st2.sit({ x: 0, y: 6.2, z: -14.3 });
      const g2 = new GunSystem(sh, st2, groundF);
      let c = 0;
      for (let i = 0; i < 120; i++) { c += g2.fire('main', fwd, eye); g2.update(1 / 60); }
      return c;
    };
    const lo = count(10), hi = count(60);
    check('routing power to the guns raises their rate of fire', hi > lo * 1.5, `${lo} shots in 2 s at 10%, ${hi} at 60%`);
    const st3 = new Stations(s); const g3 = new GunSystem(s, st3, groundF);
    st3.sit({ x: 0.2, y: 6.0, z: 2.8 });
    // a target on a level line of sight, well clear of the ground
    const lvl = s.dirToWorld({ x: 0, y: 0.03, z: -1 }, {});
    const ll = Math.hypot(lvl.x, lvl.y, lvl.z); lvl.x /= ll; lvl.y /= ll; lvl.z /= ll;
    const tgt = { x: eye.x + lvl.x * 150, y: eye.y + lvl.y * 150, z: eye.z + lvl.z * 150 };
    g3.addTarget({ id: 'T1', pos: tgt, radius: 3 });
    const noMain = g3.fire('main', lvl, eye), dors = g3.fire('dorsal', lvl, eye);
    check('the dorsal seat fires the dorsal turret and not the main guns', noMain === 0 && dors === 1);
    let targetHit = false;
    for (let i = 0; i < 60 * 3 && !targetHit; i++) { g3.update(1 / 60); if (g3.events.some((e) => e.type === 'target_hit')) targetHit = true; }
    check('a bolt aimed at a practice target hits it and damages it', targetHit && g3.targets[0].hp < 100, `hp ${g3.targets[0].hp}`);
  }

  // ---- shields, hull and drones ------------------------------------------------------------------
  section('9e2. Shields take the hit first; drones only fight a ship that is in the air');
  {
    const s = makeShip();
    s.shield = 50;
    const a = s.takeHit(22);
    const afterA = { shield: s.shield, hull: s.hull };
    const b = s.takeHit(60);
    check('a hit spends the shield first, and only what is left of it reaches the hull',
      a.absorbed === 22 && afterA.shield === 28 && afterA.hull === 100 && b.absorbed === 28 && s.shield === 0 && Math.abs(s.hull - (100 - 32 * 0.25)) < 1e-9,
      `after first hit ${JSON.stringify(afterA)}, after second shield ${s.shield} hull ${s.hull}`);
    const strong = makeShip(); strong.setPowerSplit(20, 20, 60);
    const weak = makeShip(); weak.setPowerSplit(60, 30, 10);
    check('routing power to the shields makes them a bigger buffer', strong.shieldMax > 2.5 * weak.shieldMax, `${strong.shieldMax.toFixed(0)} vs ${weak.shieldMax.toFixed(0)}`);
    const dmg = makeShip(); dmg.hull = 20;
    check('a battered hull gives up thrust: at 20% integrity the lift thrusters are weaker',
      dmg.maxLiftN < 0.9 * makeShip().maxLiftN, `${(dmg.maxLiftN / 1000).toFixed(0)} kN`);
  }
  {
    const s = makeShip();
    const st = new Stations(s);
    const guns = new GunSystem(s, st, groundF);
    const drones = new DroneSystem(s, guns, groundF);
    const up = { x: s.pos.x / Math.hypot(s.pos.x, s.pos.y, s.pos.z), y: s.pos.y / Math.hypot(s.pos.x, s.pos.y, s.pos.z), z: s.pos.z / Math.hypot(s.pos.x, s.pos.y, s.pos.z) };
    const fwd = s.dirToWorld({ x: 0, y: 0, z: -1 }, {});
    const anchor = { x: s.pos.x + fwd.x * 300 + up.x * 70, y: s.pos.y + fwd.y * 300 + up.y * 70, z: s.pos.z + fwd.z * 300 + up.z * 70 };
    const d = drones.add('D1', anchor);
    let firedGrounded = 0;
    for (let i = 0; i < 60 * 12; i++) { drones.update(1 / 60); s.step(1 / 60); firedGrounded += drones.drain().filter((e) => e.type === 'drone_fire').length; }
    check('a drone leaves a parked ship alone', firedGrounded === 0 && d.state === 'idle', `${firedGrounded} shots fired at a landed ship`);
    s.controls.lift = 1;
    for (let i = 0; i < 60 * 6; i++) s.step(1 / 60);
    s.controls.lift = 0;
    let fired = 0, hits = 0, shieldSeen = s.shield;
    for (let i = 0; i < 60 * 40; i++) {
      s.step(1 / 60); drones.update(1 / 60);
      for (const e of drones.drain()) { if (e.type === 'drone_fire') fired++; if (e.type === 'ship_hit') hits++; }
      shieldSeen = Math.min(shieldSeen, s.shield);
    }
    check('once the ship is airborne the drone attacks: it fires, its bolts hit, and the shield takes the damage',
      fired >= 3 && hits >= 1 && shieldSeen < s.shieldMax - 15, `${fired} shots, ${hits} hits, shield ${shieldSeen.toFixed(0)}/${s.shieldMax.toFixed(0)}`);
    // and it can be shot down from the captain's chair
    st.sit({ x: 0, y: 6.2, z: -14.3 });
    const eye = s.toWorld({ x: 0, y: 7.3, z: -15.1 }, {});
    let down = false;
    for (let i = 0; i < 60 * 20 && !down; i++) {
      const dx = d.pos.x - eye.x, dy = d.pos.y - eye.y, dz = d.pos.z - eye.z, dl = Math.hypot(dx, dy, dz);
      const dirW = { x: dx / dl, y: dy / dl, z: dz / dl };
      const inv = s.quaternion.clone().invert();
      const local = new THREE.Vector3(dirW.x, dirW.y, dirW.z).applyQuaternion(inv);
      guns.point('main', { x: local.x, y: local.y, z: local.z });
      guns.fire('main', dirW, eye);
      guns.update(1 / 60); drones.update(1 / 60); s.step(1 / 60);
      for (const e of guns.drain()) if (e.type === 'target_down' && e.id === 'D1') down = true;
    }
    check('the main guns can shoot a drone down', down, `drone hp ${d.target.hp}`);
  }

  // ---- 9f. Geometry and identity -----------------------------------------------------------------------
  section('9f. The ship is built, measured and registered');
  {
    const mats = makeShipMaterials({ tier: 'high' });
    const it = buildInterior(L, mats, { tier: 'high' });
    buildSeats(L, mats, it);
    const ex = EXT.buildExterior(L, mats, { tier: 'high' });
    const hardware = new THREE.Group();
    for (const ch of [...ex.root.children]) {
      if (ch.name === 'exhaust' || (ch.isMesh && ch.material && ch.material.blending === THREE.AdditiveBlending)) continue;
      hardware.add(ch);
    }
    ex.root.add(hardware);
    EXT.applyNeutralPose(ex);
    const reg = new Registry();
    SYS.registerShipAssets(reg, THREE, hardware, it.seatGroups, { x: 0, y: 0, z: 0 });
    const rec = reg.get(SPEC.SHIP_ID);
    check('the ship has a stable registry ID, a measured size and a real mass',
      SPEC.SHIP_ID === 'COS-MARS-VEH-0001' && rec && rec.measured && rec.massKg === 46000);
    const drifts = [SPEC.SHIP_ID, ...SPEC.SEATS.map((q) => q.stationId)].map((id) => [id, reg.dimensionDrift(id, 0.05)]);
    const bad = drifts.filter(([, d]) => !d || !d.withinTolerance).map(([id, d]) => `${id} ${d ? d.worst.toFixed(3) : 'none'}`);
    check('the ship and all seven stations measure within 5 cm of their design size', bad.length === 0, bad.join('; '));
    check('every station has its own registry ID and a real mass',
      SPEC.SEATS.every((q) => /^COS-MARS-STR-\d{4}$/.test(q.stationId) && reg.get(q.stationId).massKg > 0) &&
      new Set(SPEC.SEATS.map((q) => q.stationId)).size === SPEC.SEATS.length);
    const misfit = [];
    for (const r of L.rooms) {
      if (['bridge', 'nest', 'ventral'].includes(r.id)) continue;
      for (const x of [r.x0, r.x1]) for (const y of [r.y, r.y + r.h]) for (const z of [r.z0, r.z1]) {
        if (!EXT.insideHull(x, y, z, 0.08)) misfit.push(`${r.id}(${x},${y},${z})`);
      }
    }
    check('every main-body room fits inside the lofted hull with at least 8 cm to spare', misfit.length === 0, misfit.slice(0, 5).join());
    let tris = 0, calls = 0;
    it.root.traverse((o) => { if (o.isMesh) { calls++; tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; } });
    check('the interior is light enough for a phone: under 100k triangles and under 220 draw calls with every room drawn',
      tris < 100000 && calls < 220, `${Math.round(tris)} triangles, ${calls} meshes`);
  }
}
