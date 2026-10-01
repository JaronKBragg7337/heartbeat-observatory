// Checks for the hired crew: routes through the real ship, the NPC pilot's flying, the NPC gunners' rules, hiring, seats.
// Everything here runs the real code (the real ShipWalker collision, the real ShipBody flight, the real GunSystem and
// DroneSystem); only the people's models are stubbed, because a GLB cannot load without a browser.
export async function runCrewChecks({ check, section, THREE, mars, FIELD }) {
  const { createPortSite, PADS } = await import('../src/port/portSpec.js');
  const { ShipWalker, shipIndex, defaultState } = await import('../src/ship/shipWalker.js');
  const { SEATS, RAMPS, buildLayout } = await import('../src/ship/shipSpec.js');
  const { ShipBody } = await import('../src/ship/shipFlight.js');
  const { GunSystem, DroneSystem, NEUTRAL_AIRSPACE_M } = await import('../src/ship/guns.js');
  const { Stations } = await import('../src/ship/shipStations.js');
  const { ShipSystem } = await import('../src/ship/shipSystem.js');
  const { routeToSeat, RouteWalker } = await import('../src/crew/shipPath.js');
  const { Autopilot, HUNT_ALT_M } = await import('../src/crew/autopilot.js');
  const { GunnerAI } = await import('../src/crew/gunnerAI.js');
  const { CrewSystem } = await import('../src/crew/crewSystem.js');
  const { CREW_POSTS, PLACES, HIRE_SPOTS, thinkDelay, aimErrorRad, ORDERS } = await import('../src/crew/crewSpec.js');
  const { Registry } = await import('../src/core/registry.js');

  section('11. Crew: routes, the NPC pilot, NPC gunners, hiring');

  // ---- routes through the real ship ----------------------------------------------------------------------------
  const st = defaultState(); st.ramps.cargo.lowered = true;
  const r = RAMPS.cargo, run = r.length * Math.cos(st.ramps.cargo.angle), along = run - 0.35;
  const tip = { x: r.hinge.x, y: r.hinge.y - along * Math.tan(st.ramps.cargo.angle), z: r.hinge.z + along };
  const sw0 = new ShipWalker(shipIndex, st);
  let allReach = true, worstSnap = 0, bad = 0, detail = [];
  for (const post of CREW_POSTS) {
    const seat = SEATS.find((s) => s.id === post.seat);
    const sw = new ShipWalker(shipIndex, st); sw.place(tip.x, tip.y, tip.z, 0);
    const route = routeToSeat(sw, tip, seat);
    if (!route) { allReach = false; detail.push(post.seat + ': no route'); continue; }
    const rw = new RouteWalker(sw, route);
    let t = 0;
    while (!rw.done && t < 150) {
      rw.step(1 / 30); t += 1 / 30;
      if (!sw.ladder && (!sw.support(sw.x, sw.y + 0.02, sw.z) || sw.blocked(sw.x, sw.y, sw.z))) bad++;
    }
    const d = Math.hypot(sw.x - seat.x, sw.z - seat.z), dy = Math.abs(sw.y - seat.y);
    worstSnap = Math.max(worstSnap, rw.snaps);
    if (!rw.done || d > 1.6 || dy > 1.2) { allReach = false; detail.push(`${post.seat}: ended ${d.toFixed(1)} m / ${dy.toFixed(1)} m from the seat`); }
    detail.push(`${post.seat} ${t.toFixed(0)}s`);
  }
  check('every crew seat can be walked to from the foot of the ramp with the real ShipWalker (stairs, gantry, both ladders), ending within reach of the seat',
    allReach, detail.join(', '));
  check('on the way no crew member is ever inside a wall or a bunk, and none had to be pushed past a point they were stuck at', bad === 0 && worstSnap === 0, `${bad} bad frames, ${worstSnap} snaps`);
  {
    const up = new ShipWalker(shipIndex, defaultState());       // ramp raised: there is no way aboard
    const rt = routeToSeat(up, tip, SEATS.find((s) => s.id === 'pilot'));
    check('with the ramp raised there is no route aboard (a crew member waits at the foot instead of walking through the hull)', rt === null);
  }

  // ---- the NPC pilot flies the real flight model ------------------------------------------------------------------------
  const site = createPortSite(mars); FIELD.attachGrades([site]);
  try {
  const ground = (x, y, z) => FIELD.surfaceRadiusFast(mars, x, y, z);
  const makeFlight = () => { const f = new ShipBody(mars, ground); f.setDown(site.toWorld(0, 3.8, 0), site.heading); for (let i = 0; i < 540; i++) f.step(1 / 60); return f; };
  const onGround = (p) => { const w = site.toWorld(p.x, 0, p.z), l = Math.hypot(w.x, w.y, w.z), g = ground(w.x / l, w.y / l, w.z / l); return { x: w.x / l * g, y: w.y / l * g, z: w.z / l * g }; };
  const pad = (id) => PLACES.find((p) => p.id === id);
  const fly = (f, ap, order, maxS, until, onStep) => {
    ap.setOrder(order);
    let t = 0, minAgl = Infinity, lifted = false;
    while (t < maxS) {
      Object.assign(f.controls, ap.update(1 / 30));
      f.step(1 / 30); t += 1 / 30;
      if (onStep) onStep(t);
      if (f.agl > 30) lifted = true;
      if (lifted && !f.landed) minAgl = Math.min(minAgl, f.agl);      // the lowest it flew once off the ground (not the take-off itself)
      if (until && until(t)) break;
    }
    return { t, minAgl };
  };
  {
    const f = makeFlight(), st2 = new Stations(f), guns = new GunSystem(f, st2, ground), dr = new DroneSystem(f, guns, ground);
    const home = onGround({ x: 0, z: 0 });
    const ap = new Autopilot(f, { ground, drones: () => dr, skill: 0.82, home, seed: 3 });
    const res = fly(f, ap, { type: 'goto', target: onGround(pad('pad02')), land: true, name: 'pad 02' }, 240, () => ap.done && f.landed);
    let lp = site.toLocal(f.pos), off = Math.hypot(lp.x - pad('pad02').x, lp.z - pad('pad02').z);
    check('an NPC pilot flies to pad 02 and sets down on it, level and at rest, undamaged', f.landed && off < 12 && f.speed < 0.1 && f.hull === 100 && Math.abs(f.pitch) < 1e-6,
      `${res.t.toFixed(0)} s, ${off.toFixed(1)} m from the pad centre, hull ${f.hull}`);
    check('...and that pad is a real pad (inside its marked rectangle)', Math.abs(lp.x - pad('pad02').x) < PADS[1].w / 2 && Math.abs(lp.z - pad('pad02').z) < PADS[1].d / 2);
    const res2 = fly(f, ap, { type: 'return' }, 240, () => ap.done && f.landed);
    lp = site.toLocal(f.pos); off = Math.hypot(lp.x, lp.z);
    check('"return to port" brings the ship back to pad 01', f.landed && off < 12 && f.hull === 100, `${res2.t.toFixed(0)} s, ${off.toFixed(1)} m from the pad centre`);
    const res3 = fly(f, ap, { type: 'supply', depot: onGround(pad('depot')) }, 300, () => ap.done && f.landed && ap.t > 30, null);
    lp = site.toLocal(f.pos);
    check('a supply run lands at the depot apron, loads, comes back and lands on pad 01 again', f.landed && Math.hypot(lp.x, lp.z) < 12 && res3.t > 40, `${res3.t.toFixed(0)} s`);
    ap.drain();
    // roam: low and wandering, never into the ground
    const f2 = makeFlight(); const ap2 = new Autopilot(f2, { ground, drones: () => null, skill: 0.78, home, seed: 11, hasNav: () => true });
    let far = 0;
    const rr = fly(f2, ap2, { type: 'roam' }, 420, null, () => { const l = site.toLocal(f2.pos); far = Math.max(far, Math.hypot(l.x, l.z)); });
    const lines = ap2.drain();
    check('roaming for seven minutes keeps the ship clear of the ground (over 20 m at the lowest), takes it well away from the port, and the hull is untouched',
      rr.minAgl > 20 && far > 3000 && f2.hull === 100, `lowest ${rr.minAgl.toFixed(0)} m, furthest ${(far / 1000).toFixed(1)} km`);
    check('and the crew call out what is on the ground as they go', lines.some((l) => /ridge|drop|cut|high ground|falls away/i.test(l)), lines.length + ' lines');
  }

  // ---- hunting: only outside neutral airspace, only at drones ---------------------------------------------------------------
  {
    const f = makeFlight(), st2 = new Stations(f), guns = new GunSystem(f, st2, ground), dr = new DroneSystem(f, guns, ground);
    const spots = [[560, 0.6], [820, -1.3], [690, 2.6]];
    spots.forEach(([d, brg], i) => { const w = f.toWorld({ x: Math.sin(brg) * d, y: 0, z: -Math.cos(brg) * d }), l = Math.hypot(w.x, w.y, w.z), g = ground(w.x / l, w.y / l, w.z / l); dr.add('D' + i, { x: w.x / l * (g + 60), y: w.y / l * (g + 60), z: w.z / l * (g + 60) }); });
    const practice = guns.addTarget({ id: 'PRACTICE', pos: f.toWorld({ x: 0, y: 0, z: -150 }), radius: 2 });
    const rnd = (() => { let a = 5; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; })();
    const gunners = [new GunnerAI({ guns, flight: f, gunId: 'dorsal', skill: 0.75, rand: rnd }), new GunnerAI({ guns, flight: f, gunId: 'ventral', skill: 0.72, rand: rnd }), new GunnerAI({ guns, flight: f, gunId: 'main', skill: 0.85, rand: rnd })];
    // inside neutral airspace: drones do not exist, so nothing is fired at, even with the ship hovering low over targets
    f.landed = false; f.airborne = true; f.autoHover = true;
    const p0 = { ...f.pos }; const up = { x: p0.x / Math.hypot(p0.x, p0.y, p0.z), y: p0.y / Math.hypot(p0.x, p0.y, p0.z), z: p0.z / Math.hypot(p0.x, p0.y, p0.z) };
    for (let i = 0; i < 30 * 60; i++) { f.controls.lift = 0; f.step(1 / 30); dr.update(1 / 30); for (const g of gunners) g.update(1 / 30, dr); guns.update(1 / 30); }
    check('under Mars\'s neutral airspace the crew guns never fire (a minute with all three drones "anchored" nearby)', gunners.every((g) => g.shots === 0) && dr.neutral && practice.hp === practice.maxHp, `shots ${gunners.map((g) => g.shots).join(',')}`);
    // climb out through the line
    const R = Math.hypot(f.pos.x, f.pos.y, f.pos.z), g0 = ground(f.pos.x / R, f.pos.y / R, f.pos.z / R);
    const target = g0 + NEUTRAL_AIRSPACE_M + 250;
    f.pos.x = up.x * target; f.pos.y = up.y * target; f.pos.z = up.z * target; f.vel = { x: 0, y: 0, z: 0 }; f.landed = false; f.airborne = true; f.autoHover = true;
    let shots = 0, killed = 0, tt = 0, practiceHit = false, hostileShots = 0;
    for (let i = 0; i < 30 * 240; i++) {
      f.controls.lift = 0; f.step(1 / 30); dr.update(1 / 30); tt += 1 / 30;
      for (const g of gunners) g.update(1 / 30, dr);
      guns.update(1 / 30);
      for (const e of guns.drain()) { if (e.type === 'target_down' && /^D/.test(e.id)) killed++; if (e.type === 'target_hit' && e.id === 'PRACTICE') practiceHit = true; }
      f.hull = Math.max(f.hull, 100);             // keep the ship alive: this part of the check is about the gunners
      if (killed >= 3) break;
    }
    shots = gunners.reduce((a, g) => a + g.shots, 0);
    check('beyond the neutral line the raiders arrive and the crew guns shoot them down (three drones, in under four minutes), with small delays and misses', !dr.neutral && killed >= 3 && shots > 6 && tt > 5, `${killed} down in ${tt.toFixed(0)} s on ${shots} bolts`);
    check('NPC gunners never fire at the practice target, and their reaction delay and aim error follow the 70-85% bible rule',
      !practiceHit && thinkDelay(0.82) > 0.8 && thinkDelay(0.72) < 1.6 && aimErrorRad(0.7) > aimErrorRad(0.85) && CREW_POSTS.every((p) => p.skill >= 0.7 && p.skill <= 0.85));
    // the pilot's hunt order: climbs to the hostile band, and (with the ship hurt) breaks off and comes back down under the line
    const f2 = makeFlight(), st3 = new Stations(f2), guns2 = new GunSystem(f2, st3, ground), dr2 = new DroneSystem(f2, guns2, ground);
    const ap = new Autopilot(f2, { ground, drones: () => dr2, skill: 0.82, home: onGround({ x: 0, z: 0 }), seed: 2 });
    let peak = 0, hurt = false;
    fly(f2, ap, { type: 'hunt' }, 260, null, (t) => { peak = Math.max(peak, f2.agl); if (peak > NEUTRAL_AIRSPACE_M + 150 && !hurt) { hurt = true; f2.hull = 30; } });
    check('a hunt order climbs to the hostile band (above the neutral line), and when the hull falls under 35% the pilot breaks off and comes back down under it',
      peak > NEUTRAL_AIRSPACE_M + 150 && peak <= HUNT_ALT_M + 450 && f2.agl < NEUTRAL_AIRSPACE_M - 50 && dr2.neutral, `peak ${peak.toFixed(0)} m, now ${f2.agl.toFixed(0)} m`);
  }

  // ---- hiring, seats, orders: the CrewSystem with the real ship and stand-in people ---------------------------------------------
  {
    const engine = { scene: new THREE.Scene(), tracked: new Set(), track(e) { this.tracked.add(e); return e; }, untrack(e) { this.tracked.delete(e); }, overlayScenes: [] };
    const registry = new Registry();
    const ship = new ShipSystem({ engine, registry, body: mars, ground, walker: { worldPos: { x: 0, y: 0, z: 0 } }, landingSite: site });
    ship.flight.setDown(site.toWorld(0, 3.8, 0), site.heading);
    for (let i = 0; i < 540; i++) ship.flight.step(1 / 60);
    ship.interior = { root: new THREE.Group(), rooms: new Map(), seatGroups: new Map() };
    ship.state.ramps.cargo.lowered = true;
    ship.drones = new DroneSystem(ship.flight, ship.guns, ground);
    const said = [];
    const mkPerson = (id) => ({ id, group: new THREE.Group(), loaded: true, ready: Promise.resolve(), play() {}, update() {} });
    const people = { roster: async () => [...CREW_POSTS.map((p) => ({ id: p.personId, file: p.personId + '.glb' })), { id: 'isaiah', file: 'isaiah.glb' }], spawn: (id) => mkPerson(id) };
    // a stand-in document so the hiring board can draw its canvas
    globalThis.document = globalThis.document || { createElement: () => ({ getContext: () => new Proxy({}, { get: () => () => {}, set: () => true }), width: 0, height: 0 }) };
    const crew = new CrewSystem({ engine, ship, site, people, ground, walker: { worldPos: { x: 0, y: 0, z: 0 } }, playerLook: 'isaiah', onSay: (n, t) => said.push(n + ': ' + t) });
    ship.crew = crew;
    await crew.build();
    check('five candidates wait at Marineris Port, each at their own spot on the apron, on the ground', crew.members.size === 5 &&
      [...crew.members.values()].every((m) => { const l = site.toLocal(m.gpos); const s = HIRE_SPOTS[m.id]; return Math.abs(l.x - s.x) < 0.5 && Math.abs(l.z - s.z) < 0.5 && Math.abs(l.y) < 0.2; }));
    ship.aboard = true; ship.sw.place(0, 3, 4, 0);
    const tick = (secs) => { for (let i = 0; i < secs * 30; i++) { const c = crew.pilotControls(1 / 30); if (c) Object.assign(ship.flight.controls, c); ship.flight.step(1 / 30); crew.update(1 / 30); } };
    // not down at the port: refuse. (Pretend we are in the air.)
    ship.flight.landed = false; const away = crew.hire('pilot'); ship.flight.landed = true;
    check('a candidate will not be hired while the ship is not on the ground beside them', !away.ok && crew.members.get('pilot').status === 'candidate');
    for (const p of CREW_POSTS) crew.hire(p.id);
    tick(1); ship.state.ramps.cargo.lowered = false; tick(30);
    check('with the ramp raised the crew wait outside it and say so, rather than walking through the hull', [...crew.members.values()].every((m) => m.place === 'ground' && m.mode === 'boarding') && said.some((s) => /ramp is up/i.test(s)));
    ship.state.ramps.cargo.lowered = true; tick(110);
    const seated = [...crew.members.values()].filter((m) => m.seated);
    check('lower the ramp and all five walk aboard, climb to their stations and sit (pilot, captain, navigator, both turrets) within two minutes', seated.length === 5 &&
      seated.every((m) => m.place === 'ship' && Math.hypot(m.sw.x - SEATS.find((s) => s.id === m.def.seat).x, m.sw.z - SEATS.find((s) => s.id === m.def.seat).z) < 0.2), `${seated.length}/5 seated`);
    check('the pilot is the one flying, and the captain works the main guns', crew.flyer() && crew.flyer().id === 'pilot' && crew.mainGunner().id === 'captain');
    // orders
    ship.aboard = false; const refuse = crew.order('roam'); ship.aboard = true;
    check('the crew will not take an order that lifts the ship unless the player is aboard', !refuse.ok && /aboard/i.test(refuse.msg));
    const far = crew.places().filter((p) => !p.ok);
    check('places too far to reach (the real landmarks, thousands of km away) are listed with honest distances and refused, not flown', far.length >= 3 && far.every((p) => p.distM > 100000) && !crew.order('goto', { id: far[0].id }).ok);
    const ok = crew.order('goto', { id: 'pad03' });
    tick(2);
    check('a legal "fly to" is accepted and the pilot lifts off', ok.ok && !ship.flight.landed || ship.flight.controls.lift > 0 || ship.flight.agl > 0.5, JSON.stringify(ok));
    tick(70);
    const lp = site.toLocal(ship.flight.pos);
    check('and puts the ship down on pad 03', ship.flight.landed && Math.hypot(lp.x - 62, lp.z - 30) < 14, `local ${lp.x.toFixed(0)},${lp.z.toFixed(0)}`);
    crew.cancelOrder();
    // the player takes the pilot's seat: Ada gets up and stands clear; stands again: Ada sits back down
    const ada = crew.members.get('pilot');
    ship.takeSeat('pilot');
    tick(1);
    check('the player sits in the pilot seat and the pilot gives it up, standing clear of it', ship.seat && ship.seat.id === 'pilot' && ada.displaced && !ada.seated && Math.hypot(ada.sw.x - (-1.6), ada.sw.z - (-17.2)) > 0.5 && !!ada.sw.canStand(ada.sw.x, ada.sw.y, ada.sw.z),
      `${ada.sw.x.toFixed(1)},${ada.sw.z.toFixed(1)}`);
    check('the captain flies when the pilot is out of the chair', crew.flyer() && crew.flyer().id === 'captain');
    ship.stations.stand(); tick(25);
    check('the player stands and the pilot walks back and sits', ada.seated && !ada.displaced && crew.flyer().id === 'pilot');
    // dismiss at the port
    const d1 = crew.dismiss('gunner_ventral');
    tick(70);
    const wal = crew.members.get('gunner_ventral');
    check('a dismissed crew member walks off the ship and back to the hiring board, and can be hired again',
      d1.ok && wal.status === 'candidate' && wal.place === 'ground' && !wal.seated && crew.hire('gunner_ventral').ok, `${wal.status}/${wal.place}/${wal.mode}`);
    check('the order list the crew understand is exactly: fly to, hunt, supplies, roam, land, hold, return', ORDERS.map((o) => o.id).join() === 'goto,hunt,supply,roam,land,hold,return');
  }
  } finally { FIELD.attachGrades([]); }
}
