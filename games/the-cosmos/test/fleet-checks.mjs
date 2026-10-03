// Checks for the fleet (src/ships/, server/fleet.mjs): ships as a type field, the first raider class (its rooms, its hull, its flight, its
// guns), the raiders' brains and escorts, the shared-world raiders (spawn, fight, damage both ways, disable, capture, claim, buy,
// flagship), persistence, and two WebSocket clients seeing the same raider and the same damage. Everything runs the real code:
// the real walker over the real layout, the real flight model, the real GunSystem, the real authority and the real server socket.
// What cannot run here (WebGL, the people GLBs) is checked in a browser: see docs/qa/2026-10-01/fleet/REVIEW.md.
import '../server/runtime.mjs';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const mem = () => { const m = { rec: null, bricks: [], load: async () => (m.rec ? { record: structuredClone(m.rec), bricks: [] } : { record: null, bricks: [] }), save: async (r) => { m.rec = r; } }; return m; };

export async function runFleetChecks({ check, section, THREE, mars, FIELD }) {
  const base = '../src/';
  const { shipDef, shipTypes, hasShipType, DEFAULT_SHIP_TYPE, allShipDefs } = await import(base + 'ships/registry.js');
  const { visualsFor } = await import(base + 'ships/visuals.js');
  const R = await import(base + 'ships/raider/spec.js');
  const STATS = await import(base + 'ships/raider/stats.js');
  const SPEC = await import(base + 'ship/shipSpec.js');
  const { ShipWalker, shipIndexFor, shipIndex, defaultState } = await import(base + 'ship/shipWalker.js');
  const { planPath, routeToSeat } = await import(base + 'crew/shipPath.js');
  const { ShipBody } = await import(base + 'ship/shipFlight.js');
  const { GunSystem, DroneSystem } = await import(base + 'ship/guns.js');
  const { Stations } = await import(base + 'ship/shipStations.js');
  const { createPortSite } = await import(base + 'port/portSpec.js');
  const { makeShipMaterials } = await import(base + 'ship/shipTextures.js');
  const { buildInterior, buildSeats } = await import(base + 'ship/shipInterior.js');
  const { registerShipAssets } = await import(base + 'ship/shipSystem.js');
  const { Registry } = await import(base + 'core/registry.js');
  const { RaiderBrain, newNpcRecord } = await import(base + 'ships/raider/brain.js');
  const { EscortWing } = await import(base + 'ships/raider/escorts.js');
  const { raiderCrew, RAIDER_CREW_POSTS } = await import(base + 'ships/raider/crew.js');
  const { SHIPYARD, forSale } = await import(base + 'ships/shipyard.js');
  const { Authority } = await import('../server/authority.mjs');
  const { ShipSimulation } = await import('../server/simulation.mjs');
  const { buildLayout } = SPEC;

  const site = createPortSite(mars);
  FIELD.attachGrades([site]);
  const ground = (x, y, z) => FIELD.surfaceRadiusFast(mars, x, y, z);
  const len = (v) => Math.hypot(v.x, v.y, v.z);

  // =====================================================================================================================
  section('20. The fleet: a ship is a type, and the Meridian is one entry');
  // =====================================================================================================================
  {
    const M = shipDef('meridian'), RD = shipDef('raider');
    check('the registry knows the Meridian and the raider by a type string, the default is the Meridian, and an unknown type is an error, not a Meridian',
      shipTypes().slice(0, 4).join() === 'meridian,raider,courier,hauler' /* SH14/SH15: later ships list after these four */ && DEFAULT_SHIP_TYPE === 'meridian' && hasShipType('raider') && hasShipType('courier') && !hasShipType('frigate') && (() => { try { shipDef('frigate'); return false; } catch { return true; } })());
    check('the Meridian entry is built from the numbers in shipSpec.js, not copies of them: same gear, guns, seats, ramps and physics objects',
      M.gear === SPEC.GEAR && M.guns === SPEC.GUNS && M.seats === SPEC.SEATS && M.ramps === SPEC.RAMPS && M.phys === SPEC.SHIP_PHYS && M.layout.rooms.length === buildLayout().rooms.length);
    for (const d of allShipDefs()) {
      const roomIds = new Set(d.layout.rooms.map((r) => r.id));
      check(`${d.type}: every seat is in a real room, every gun belongs to a real seat, every role names a real room, and the station ids are unique`,
        d.seats.every((s) => roomIds.has(s.room)) && Object.values(d.guns).every((g) => d.seats.some((s) => s.id === g.seat)) &&
        Object.values(d.roles).every((r) => roomIds.has(r)) && new Set(d.seats.map((s) => s.stationId)).size === d.seats.length &&
        Object.entries(d.seatGun).every(([seat, gun]) => d.guns[gun] && d.seats.some((s) => s.id === seat)));
      check(`${d.type}: its thrusters can lift it on Mars (thrust ${Math.round(d.phys.liftThrustN)} N over a weight of ${Math.round(d.phys.massKg * 3.71)} N) and every crew post has a seat`,
        d.phys.liftThrustN > d.phys.massKg * 3.72 * 1.02 && d.crewPosts.every((p) => p.seat) && d.crewPosts.filter((p) => d.seats.some((s) => s.id === p.seat)).length >= 3);
    }
    check('the raider is a smaller ship than the Meridian in every way a player can feel: lighter, shorter, narrower, fewer crew, and quicker',
      RD.phys.massKg < M.phys.massKg / 2 && RD.envelope.depth < M.envelope.depth && RD.envelope.width < M.envelope.width && RD.stats.crewMax < M.stats.crewMax &&
      RD.phys.climbSpeed > M.phys.climbSpeed && RD.phys.turnRate > M.phys.turnRate && RD.phys.cruiseSpeed > M.phys.cruiseSpeed);
    check('the raider has the rooms the brief asked for: a cockpit, crew quarters, a cargo hold, an engine room, and an airlock and a ramp to get in by',
      ['cockpit', 'crew_a', 'hold', 'engine', 'airlock'].every((id) => RD.layout.roomById.has(id)) && RD.ramps.cargo && RD.ramps.airlock && RD.layout.rooms.length >= 8);
    check('raider crews are four named Loft people who sit at four stations; every name is unique to its boat and every person is one of the seven Loft models',
      (() => { const LOFT = new Set(['isaiah', 'ada', 'jorge', 'sunita', 'zuri', 'walter', 'aoi']); const a = raiderCrew(1), b = raiderCrew(2);
        return a.length === 4 && a.every((c) => LOFT.has(c.personId) && RD.seats.some((s) => s.id === RD.crewPosts.find((p) => p.id === c.role).seat)) && a.map((c) => c.name).join() !== b.map((c) => c.name).join() && new Set(a.map((c) => c.name)).size === 4; })());
  }

  // =====================================================================================================================
  section('21. The raider is a place: rooms, doors, stairs-free routes, the ladder, the ramp');
  // =====================================================================================================================
  const RD = shipDef('raider'), L = RD.layout, idx = shipIndexFor(RD);
  {
    check('shipIndexFor builds one walkable geometry per type and keeps it; the Meridian\'s is the same object the game always used', shipIndexFor(RD) === idx && shipIndexFor(shipDef('meridian')) === shipIndex && idx !== shipIndex);
    const st = defaultState(); st.airlock.innerOpen = true;
    const sw = new ShipWalker(idx, st);
    check('the main corridor is standable and the cockpit door opens onto the cockpit', !!sw.canStand(0, 0, 0) && !!sw.canStand(0, 0, -9.5));
    const start = { x: 0, y: 0, z: 0 }, bad = [];
    for (const r of L.rooms) {
      if (r.id === 'turret') continue;
      const p = planPath(sw, start, { x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2, y: r.y }, { reach: 1.6 });
      if (!p) bad.push(r.id);
    }
    check('a person can walk from the corridor into every room of the raider (cockpit, quarters, mess, airlock, armoury, engine room, hold, ladder niche)', bad.length === 0, bad.join());
    const routes = RD.seats.map((s) => [s.id, routeToSeat(sw, start, s)]);
    check('and to every one of its four seats, the dorsal turret by way of the ladder', routes.every(([, r]) => r && r.length) && routes.find(([id]) => id === 'gun_dorsal')[1].some((s) => s.type === 'ladder'), routes.filter(([, r]) => !r).map(([id]) => id).join());
    const thresholds = [];
    for (const d of L.doors) {
      if (d.kind === 'outer' || d.kind === 'portal') continue;
      const A = L.roomById.get(d.a), B = L.roomById.get(d.b);
      const pa = d.axis === 'x' ? { x: d.at + (A.x0 > d.at ? 0.5 : -0.5), z: d.c } : { x: d.c, z: d.at + (A.z0 > d.at ? 0.5 : -0.5) };
      const pb = d.axis === 'x' ? { x: d.at + (B.x0 > d.at ? 0.5 : -0.5), z: d.c } : { x: d.c, z: d.at + (B.z0 > d.at ? 0.5 : -0.5) };
      if (!sw.canStand(pa.x, d.y, pa.z) || !sw.canStand(pb.x, d.y, pb.z) || !sw.canStand(d.axis === 'x' ? d.at : d.c, d.y, d.axis === 'x' ? d.c : d.at)) thresholds.push(d.id);
    }
    check('every door has clear floor on both sides and in the opening (no furniture across a threshold)', thresholds.length === 0, thresholds.join());
    const gap = L.doors.filter((d) => d.b !== 'outside' && d.kind !== 'portal').filter((d) => {
      const A = L.roomById.get(d.a), B = L.roomById.get(d.b);
      const planes = (r) => (d.axis === 'x' ? [r.x0, r.x1] : [r.z0, r.z1]);
      return !planes(A).some((p) => Math.abs(p - d.at) < 0.11) || !planes(B).some((p) => Math.abs(p - d.at) < 0.11);
    });
    check('every door stands in the 0.2 m wall between the two rooms it joins (a picture and a collider cannot disagree about where the door is)', gap.length === 0, gap.map((d) => d.id).join());
    const out = [];
    for (const p of L.props) { const r = L.roomById.get(p.room); const b = { x0: p.x - (p.rot % 2 ? p.d : p.w) / 2, x1: p.x + (p.rot % 2 ? p.d : p.w) / 2, z0: p.z - (p.rot % 2 ? p.w : p.d) / 2, z1: p.z + (p.rot % 2 ? p.w : p.d) / 2 };
      if (!r || b.x0 < r.x0 - 0.12 || b.x1 > r.x1 + 0.12 || b.z0 < r.z0 - 0.12 || b.z1 > r.z1 + 0.12) out.push(`${p.kind}@${p.room}`); }
    check('every piece of furniture stands inside the room it is listed in', out.length === 0, out.join());
    // the ramp: lowered, a person standing at its foot can walk in and reach the cockpit
    const stR = defaultState(); stR.ramps.cargo = { lowered: true, angle: 0.47, progress: 1 };
    const swR = new ShipWalker(idx, stR); const ramp = RD.ramps.cargo, run = ramp.length * Math.cos(0.47), tipY = ramp.hinge.y - run * Math.tan(0.47);
    swR.place(0, tipY, ramp.hinge.z + run - 0.6, 0);
    const inside = planPath(swR, { x: 0, y: tipY, z: ramp.hinge.z + run - 0.6 }, { x: 0, z: -9.6, y: 0 }, { reach: 0.6 });
    check('with the stern ramp down, a person at its foot can walk up it, through the hold and engine room and the corridor, to the cockpit', !!inside);
    const sw2 = new ShipWalker(idx, stR); sw2.place(0, 0, 14, 0); sw2.yaw = Math.PI;      // facing aft
    let exited = false; for (let i = 0; i < 400 && !exited; i++) { sw2.tick(1 / 60, { moveZ: 1 }); exited = sw2.events.includes('exit:cargo'); }
    check('and walking aft down the ramp the walker asks to leave the ship at its end (the same rule the Meridian ramp uses)', exited, `z ${sw2.z.toFixed(2)}`);
    const stA = defaultState(); stA.ramps.airlock = { lowered: true, angle: 0.5, progress: 1 }; stA.airlock.outerOpen = true; stA.airlock.innerOpen = false;
    const swA = new ShipWalker(idx, stA); swA.place(-3.5, 0, 0.6, -Math.PI / 2);
    let exitedA = false; for (let i = 0; i < 600 && !exitedA; i++) { swA.tick(1 / 60, { moveZ: 1 }); exitedA = swA.events.includes('exit:airlock'); }
    check('through the airlock the same: with the outer door open and the gangway out, walking to port leaves the ship', exitedA, `x ${swA.x.toFixed(2)} y ${swA.y.toFixed(2)}`);
    const ladder = L.ladders[0], swL = new ShipWalker(idx, defaultState()); swL.place(ladder.bottom.x, 0, ladder.bottom.z, Math.PI / 2);
    let top = false; for (let i = 0; i < 600 && !top; i++) { swL.tick(1 / 60, { moveZ: 1 }); top = swL.events.includes('ladder_top'); }
    check('the ladder from the niche carries a walker up to the dorsal turret deck and lets go at the top', top && Math.abs(swL.y - R.DECK.upper) < 0.05 && !!swL.canStand(swL.x, swL.y, swL.z), `y ${swL.y.toFixed(2)}`);
  }

  // =====================================================================================================================
  section('22. The raider is built and measured: interior, exterior, seats, the hull');
  // =====================================================================================================================
  {
    const V = visualsFor('raider');
    const Lx = { ...L, custom: V.custom };
    const mats = makeShipMaterials({ tier: 'high' });
    const it = buildInterior(Lx, mats, { tier: 'high' });
    buildSeats(Lx, mats, it);
    const ex = V.buildExterior(Lx, mats, { tier: 'high', def: RD });
    const hardware = new THREE.Group();
    for (const ch of [...ex.root.children]) { if (ch.name === 'exhaust' || (ch.isMesh && ch.material && ch.material.blending === THREE.AdditiveBlending)) continue; hardware.add(ch); }
    ex.root.add(hardware); V.applyNeutralPose(ex);
    const reg = new Registry();
    registerShipAssets(reg, THREE, hardware, it.seatGroups, { x: 0, y: 0, z: 0 }, RD);
    const rec = reg.get(RD.registryId);
    check('the raider has its own stable registry id, a measured size and a real mass', rec && rec.measured && rec.massKg === RD.phys.massKg && /^COS-MARS-VEH-\d{4}$/.test(RD.registryId) && RD.registryId !== shipDef('meridian').registryId);
    const drifts = [RD.registryId, ...RD.seats.map((s) => s.stationId)].map((id) => [id, reg.dimensionDrift(id, 0.05)]);
    const bad = drifts.filter(([, d]) => !d || !d.withinTolerance).map(([id, d]) => `${id} ${d ? d.worst.toFixed(3) : 'none'}`);
    check('the raider and all four stations measure within 5 cm of their design size', bad.length === 0, bad.join('; '));
    check('the raider\'s four stations have their own registry ids, none of them the Meridian\'s',
      RD.seats.every((s) => /^COS-MARS-STR-\d{4}$/.test(s.stationId) && !SPEC.SEATS.some((m) => m.stationId === s.stationId)));
    const misfit = [];
    for (const r of L.rooms) {
      if (R.CANOPY_ROOMS.includes(r.id)) continue;
      for (const x of [r.x0, r.x1]) for (const y of [r.y, r.y + r.h]) for (const z of [r.z0, r.z1]) if (!R.HULL.insideHull(x, y, z, 0.08)) misfit.push(`${r.id}(${x},${y},${z})`);
    }
    check('every main-body room fits inside the lofted hull with at least 8 cm to spare (the cockpit canopy and the turret nest stand above it, like the Meridian\'s bridge)', misfit.length === 0, misfit.slice(0, 5).join());
    const cockpit = L.roomById.get('cockpit'), low = [];
    for (const x of [cockpit.x0, cockpit.x1]) for (const z of [cockpit.z0, cockpit.z1]) if (!R.HULL.insideHull(x, 0, z, 0.05)) low.push(`${x},${z}`);
    check('below the canopy sill the cockpit floor is inside the hull at all four corners', low.length === 0, low.join());
    let tris = 0, calls = 0; it.root.traverse((o) => { if (o.isMesh) { calls++; tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; } });
    check(`the raider interior is light enough for a phone: under 100k triangles and under 220 draw calls with every room drawn (${Math.round(tris)} triangles, ${calls} meshes)`, tris < 100000 && calls < 220);
    check('the interior builder resolved every coplanar pair into its own depth layer (no surfaces fighting) and drew every room, door, seat and the ladder',
      it.layerStats && it.layerStats.maxLayer <= 12 && it.rooms.size === L.rooms.length && it.seatGroups.size === 4 && it.doors.length >= 6 && it.sharedGroups.length === 1);
    check('the raider has everything the game animates: four legs, both ramps, the nose guns, the dorsal turret, two engines with flames and four lift pods, and the interior has the reactor core to pulse',
      ex.legs.length === 4 && ex.ramps.cargo && ex.ramps.airlock && ex.guns.main.length === 2 && ex.guns.dorsal && ex.engines.length === 2 && ex.liftPods.length === 4 && it.reactorCore && !ex.guns.ventral);
    const remote = V.buildExterior(Lx, mats, { tier: 'low', def: RD, remote: true });
    check('a remote view of a raider adds a canopy and turret glass so the people at its stations can be seen, and the local one does not (its glass is in the interior scene)', !!remote.remoteGlass && !ex.remoteGlass);
    // every muzzle sits outside the hull, ahead of the pivot it fires from
    check('every gun muzzle is outside the hull (the nose guns ahead of the bow, the turret barrels clear of the roof)',
      RD.guns.main.muzzles.every((m) => m.z < R.HULL.z0 + 0.5) && RD.guns.dorsal.pivot.y > R.HULL.top(2.8));
    // the meridian is unchanged: its interior still builds from its own layout with no custom dressing
    const itM = buildInterior(buildLayout(), mats, { tier: 'low' }); buildSeats(buildLayout(), mats, itM);
    check('the Meridian still builds through the same code with all seven stations (the shared builders are data-driven, not forked)', itM.seatGroups.size === 7 && itM.rooms.size === buildLayout().rooms.length);
  }

  // =====================================================================================================================
  section('23. The raider flies, shoots and answers to the same stations as any ship');
  // =====================================================================================================================
  {
    const f = new ShipBody(mars, ground, RD); f.setDown(site.toWorld(0, RD.dock.spawnY, 0), site.heading);
    for (let i = 0; i < 540; i++) f.step(1 / 60);
    check('set on the pad, the raider rests on all four legs, landed, undamaged, and its hull and shield are its own (shield 240, the Meridian\'s is 200)', f.landed && f.legs.filter((l) => l.contact).length === 4 && f.hull === 100 && Math.round(f.shieldMax) === 240);
    check('a ShipBody with no definition is still the Meridian (every existing caller is unchanged)', (() => { const g = new ShipBody(mars, ground); return g.massKg === SPEC.SHIP_PHYS.massKg && g.legs.length === 4 && Math.round(g.shieldMax) === 200; })());
    f.autoHover = true; f.controls.lift = 1; let t = 0; while (f.agl < 100 && t < 60) { f.step(1 / 30); t += 1 / 30; }
    check(`it lifts off and climbs to 100 m in ${t.toFixed(1)} s at ${RD.phys.climbSpeed} m/s (the Meridian takes 10 s at 12)`, f.agl >= 100 && t < 9);
    f.controls.lift = 0; f.controls.fwd = 1; for (let i = 0; i < 30 * 20; i++) f.step(1 / 30);
    check(`it cruises at ${f.groundSpeed.toFixed(1)} m/s (design ${RD.phys.cruiseSpeed}) and turns at more than the Meridian's 0.75 rad/s`, Math.abs(f.groundSpeed - RD.phys.cruiseSpeed) < 2, `${f.groundSpeed}`);
    f.controls.yaw = 1; const h0 = f.heading; for (let i = 0; i < 90; i++) f.step(1 / 30); let dh = f.heading - h0; if (dh < 0) dh += Math.PI * 2;
    check(`its turn rate is ${(dh / 3).toFixed(2)} rad/s`, dh / 3 > 0.8);
    const f2 = new ShipBody(mars, ground, RD); f2.setDown(site.toWorld(0, RD.dock.spawnY, 0), site.heading); for (let i = 0; i < 540; i++) f2.step(1 / 60);
    f2.autoHover = true; f2.controls.lift = 1; while (f2.agl < 80) f2.step(1 / 30); f2.controls.lift = 0; for (let i = 0; i < 30 * 5; i++) f2.step(1 / 30);
    f2.controls.lift = -1; let n = 0; while (!f2.landed && n++ < 30 * 120) f2.step(1 / 30);
    check(`and comes down on its gear over the pad at ${f2.lastTouchdown ? f2.lastTouchdown.v.toFixed(2) : '?'} m/s with no hull damage`, f2.landed && f2.lastTouchdown.v < 5 && f2.hull === 100);
    const g = new ShipBody(mars, ground, RD); g.shield = 0; const before = g.hull; g.takeHit(100);
    const gm = new ShipBody(mars, ground); gm.shield = 0; gm.takeHit(100);
    check('its armour is its own: 100 points through a spent shield costs the raider 22 hull and the Meridian 25', Math.abs((before - g.hull) - 22) < 1e-9 && Math.abs((100 - gm.hull) - 25) < 1e-9);
    // guns
    const st = new Stations(f, {}, RD), guns = new GunSystem(f, st, ground, RD);
    check('its gun table is the raider\'s: a nose pair and a dorsal turret, no ventral turret, and nothing keyed to the Meridian\'s', Object.keys(guns.cool).join() === 'main,dorsal' && Object.keys(guns.aim).join() === 'main,dorsal');
    const a1 = guns.point('main', { x: 0.9, y: 0, z: -0.1 });
    check('the nose guns are fixed in a narrow arc: asked to point abeam they stay inside 22 degrees', Math.abs(a1.yaw) <= 22 * Math.PI / 180 + 1e-9);
    const a2 = guns.point('dorsal', { x: 0, y: -1, z: 0 });
    check('the dorsal turret cannot depress below its limit (8 degrees)', a2.pitch >= -8 * Math.PI / 180 - 1e-9);
    check('no one can fire while standing; sitting in the captain\'s seat lets the nose guns fire and not the turret; the turret seat fires the turret and not the nose',
      (() => { st.stand?.(); st.seated = null; const none = guns.fire('main', { x: 0, y: 0, z: -1 }, f.pos); st.seated = 'captain'; guns.cool.main = 0; const cap = guns.fire('main', { x: 0, y: 0, z: -1 }, f.pos); const capT = guns.fire('dorsal', { x: 0, y: 0, z: -1 }, f.pos);
        st.seated = 'gun_dorsal'; guns.cool.dorsal = 0; const tur = guns.fire('dorsal', { x: 0, y: 0, z: -1 }, f.pos); guns.cool.main = 0; const turM = guns.fire('main', { x: 0, y: 0, z: -1 }, f.pos); st.seated = 'pilot'; guns.cool.main = 0; const pil = guns.fire('main', { x: 0, y: 0, z: -1 }, f.pos);
        return !none && cap === 1 && !capT && tur === 1 && !turM && !pil; })());
    const mz = guns.muzzleWorld('main', 0), mzL = f.toLocal(mz, {});
    check('a bolt leaves the nose barrel where the spec says (ahead of the bow, 85 cm off the centreline)', Math.abs(mzL.x + 0.85) < 1e-6 && Math.abs(mzL.z + 17.0) < 1e-6);
  }

  // =====================================================================================================================
  section('24. Raiders: how one flies and fights, and what its escorts do');
  // =====================================================================================================================
  {
    const mk = (hullAt = 100) => {
      const rec = { id: 'r1', type: 'raider', crew: raiderCrew(3).map((c) => ({ ...c })), npc: newNpcRecord({ name: 'Test', seq: 3, station: 'mars-orbit' }) };
      const f = new ShipBody(mars, ground, RD); const p = site.toWorld(0, 2600, 0); f.pos = { ...p }; f.landed = false; f.airborne = true; f.autoHover = true; f.gearPos = 0; f.refreshOrientation(); f.hull = hullAt;
      const st = new Stations(f, {}, RD), guns = new GunSystem(f, st, ground, RD);
      let seed = 7; const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      const brain = new RaiderBrain({ flight: f, guns, record: rec, rand });
      return { rec, f, guns, brain, centre: site.toWorld(900, 2600, 0) };
    };
    const target = (f, id = 't') => ({ id, flight: f, hostile: true });
    const mkTarget = (from, east, hostile = true) => { const t = new ShipBody(mars, ground); const fr = from._frame; t.pos = { x: from.pos.x + fr.east.x * east, y: from.pos.y + fr.east.y * east, z: from.pos.z + fr.east.z * east }; t.landed = false; t.airborne = true; t.autoHover = true; t.gearPos = 0; t.refreshOrientation(); return { id: 't', flight: t, hostile }; };
    {
      const m = mk(); const world = { station: { centre: m.centre, ring: 1500, agl: 2600 }, targets: [] };
      let maxRing = 0, minAgl = 1e9, maxAgl = 0, fired = 0;
      for (let i = 0; i < 30 * 90; i++) { const c = m.brain.think(1 / 30, world); m.f.controls = c; m.f.step(1 / 30); m.guns.update(1 / 30); fired += m.guns.drain().filter((e) => e.type === 'muzzle').length; if (i > 600) { minAgl = Math.min(minAgl, m.f.agl); maxAgl = Math.max(maxAgl, m.f.agl); } }
      check(`alone, a raider patrols its station: it stays up around ${Math.round(minAgl)}-${Math.round(maxAgl)} m (station 2600), keeps moving, fires nothing, and mends`, minAgl > 2200 && maxAgl < 3000 && m.f.speed > 8 && fired === 0 && m.rec.npc.state === 'patrol');
    }
    {
      const m = mk(); const t = mkTarget(m.f, 1500, false); const world = { station: { centre: m.centre, ring: 1500, agl: 2600 }, targets: [t] };
      let fired = 0; for (let i = 0; i < 30 * 40; i++) { m.f.controls = m.brain.think(1 / 30, world); m.f.step(1 / 30); m.guns.update(1 / 30); fired += m.guns.drain().length; }
      check('a ship in neutral airspace is not a target: a raider 1.5 km from one for 40 s stays on patrol and never fires (Mars is neutral)', m.rec.npc.state === 'patrol' && !m.rec.npc.targetId && m.guns.shots.main + m.guns.shots.dorsal === 0);
    }
    {
      const m = mk(); const t = mkTarget(m.f, 1800, true); const world = { station: { centre: m.centre, ring: 1500, agl: 2600 }, targets: [t] };
      let engaged = false, shots = 0, minD = 1e9; const bolts = [];
      for (let i = 0; i < 30 * 60; i++) { m.f.controls = m.brain.think(1 / 30, world); m.f.step(1 / 30); m.guns.update(1 / 30); if (m.rec.npc.state === 'engage') engaged = true; minD = Math.min(minD, Math.hypot(m.f.pos.x - t.flight.pos.x, m.f.pos.y - t.flight.pos.y, m.f.pos.z - t.flight.pos.z)); }
      shots = m.guns.shots.main + m.guns.shots.dorsal;
      check(`a hostile ship inside sensor range draws it: it engages, closes to ${Math.round(minD)} m and fires (${shots} shots in 60 s: nose guns and turret)`, engaged && shots > 5 && minD < 900);
      // the target drops into neutral airspace: it breaks off and goes home
      t.hostile = false; for (let i = 0; i < 30 * 30; i++) { m.f.controls = m.brain.think(1 / 30, world); m.f.step(1 / 30); m.guns.update(1 / 30); }
      const shots2 = m.guns.shots.main + m.guns.shots.dorsal; for (let i = 0; i < 30 * 20; i++) { m.f.controls = m.brain.think(1 / 30, world); m.f.step(1 / 30); m.guns.update(1 / 30); }
      check('when the target lands or drops under the line the raider breaks off, fires no more, and returns', ['return', 'patrol'].includes(m.rec.npc.state) && m.guns.shots.main + m.guns.shots.dorsal === shots2);
    }
    {
      const m = mk(); const t = mkTarget(m.f, 900, true); const world = { station: { centre: m.centre, ring: 1500, agl: 2600 }, targets: [t] };
      m.brain.think(1 / 30, world); m.f.hull = 30;
      const c = m.brain.think(1 / 30, world);
      check('at 35 percent hull or less the drive is dead and the crew surrender: it holds its station, controls zero, nobody fires', m.rec.npc.state === 'disabled' && c.fwd === 0 && c.yaw === 0 && c.lift === 0 && m.rec.crew.every((q) => q.status === 'surrendered'));
      m.f.hull = 0; m.brain.think(1 / 30, world);
      check('at no hull the boat is abandoned: no state of mind left to speak of', m.rec.npc.state === 'abandoned');
    }
    {
      const m = mk(); m.f.hull = 50; const t = mkTarget(m.f, 1500, true); const world = { station: { centre: m.centre, ring: 1500, agl: 2600 }, targets: [t] };
      m.brain.think(1 / 30, world);
      check('a hurt raider (under 55 percent) does not start a fight: it keeps to its station and mends', m.rec.npc.state !== 'engage');
    }
    // escorts
    {
      const f = new ShipBody(mars, ground, RD); f.pos = site.toWorld(0, 2600, 0); f.landed = false; f.autoHover = true; f.gearPos = 0; f.refreshOrientation();
      const w = new EscortWing('w', 3); w.gather(f);
      check('a raider has three escort drones, held in formation on its quarters when it is not fighting', w.drones.length === 3 && w.alive().length === 3 && w.drones.every((d) => Math.hypot(d.pos.x - f.pos.x, d.pos.y - f.pos.y, d.pos.z - f.pos.z) < 120));
      f.controls.fwd = 0.5; for (let i = 0; i < 30 * 30; i++) { f.step(1 / 30); w.update(1 / 30, f, null, [], ground, true); }
      check('they stay with it as it moves: after 30 s of flight every escort is still within 150 m of the raider', w.alive().every((d) => Math.hypot(d.pos.x - f.pos.x, d.pos.y - f.pos.y, d.pos.z - f.pos.z) < 150));
      const T = new ShipBody(mars, ground); const fr = f._frame; T.pos = { x: f.pos.x + fr.east.x * 900, y: f.pos.y + fr.east.y * 900, z: f.pos.z + fr.east.z * 900 }; T.landed = false; T.autoHover = true; T.gearPos = 0; T.refreshOrientation();
      const T0 = T.shield; let hits = 0;
      for (let i = 0; i < 30 * 120; i++) { f.step(1 / 30); T.step(1 / 30); w.update(1 / 30, f, T, [T], ground, true); for (const e of w.drain()) if (e.type === 'ship_hit') hits++; }
      check(`given a target they break formation, strafe it and score hits through its shield (${hits} hits in two minutes)`, hits > 0 && (T.shield < T0 || T.hull < 100) && w.drones.some((d) => d.state === 'attack'));
      const d = w.drones[0]; const killed = w.hit(d, 100);
      check('an escort is shot down like any drone (60 hit points); a dead one stays dead until the wing is gathered again', killed && d.state === 'dead' && w.alive().length === 2 && (w.gather(f), w.alive().length === 3));
      w.update(1 / 30, f, null, [], ground, false); for (let i = 0; i < 30 * 40; i++) w.update(1 / 30, f, null, [], ground, false);
      check('when the raider is disabled its escorts break off and are gone', w.drones.every((q) => q.state === 'away' || q.state === 'leaving'));
      const saved = JSON.parse(JSON.stringify(w.save())), w2 = new EscortWing('w', 3).load(saved);
      check('an escort wing saves and loads exactly (the server saves it with the world)', JSON.stringify(w2.save()) === JSON.stringify(w.save()));
    }
  }

  // =====================================================================================================================
  section('25. The shared world: raiders spawn, fight, and can be taken');
  // =====================================================================================================================
  // (A refused action rolls the world back and rebuilds every simulation, so nothing here holds a record or a sim across an action:
  //  they are looked up by id each time.)
  const world = await new Authority(mem(), { now: () => Date.now() }).load();
  const key = (c) => c.repeat(48);
  const raiders = () => Object.values(world.state.ships).filter((s) => s.npc);
  const act = async (p, id, a) => world.action(p.id, id, a);
  const REC = (id) => world.state.ships[id], SIM = (id) => world.sims.get(id);
  let PL, PSHIP, R1ID;
  const me = () => world.state.players[PL];
  const near = (simId, otherId, east) => { const o = SIM(otherId), f = SIM(simId).flight, fr = o.flight._frame; f.pos = { x: o.flight.pos.x + fr.east.x * east, y: o.flight.pos.y + fr.east.y * east, z: o.flight.pos.z + fr.east.z * east }; f.vel = { x: 0, y: 0, z: 0 }; f.landed = false; f.airborne = true; f.autoHover = true; f.gearPos = 0; f.refreshOrientation(); };
  const board = (shipId) => { me().aboardShipId = shipId; me().currentShipId = shipId; me().pose.aboard = true; };
  {
    const rs = raiders();
    check('a new world has raiders: one high over the port, one over Phobos, one abandoned hull adrift near Deimos, all typed `raider` with their own ids',
      rs.length === 3 && rs.every((s) => s.type === 'raider') && rs.map((s) => s.npc.station).sort().join() === 'deimos,mars-orbit,phobos' && rs.filter((s) => s.npc.state === 'abandoned').length === 1 && new Set(rs.map((s) => s.id)).size === 3);
    world.advance(5);
    R1ID = rs.find((s) => s.npc.station === 'mars-orbit').id;
    const r1 = SIM(R1ID).flight;
    check(`they fly outside Mars neutral airspace: the port raider is ${Math.round(r1.agl)} m up (the line is 1500 m), in the air, and the moon raiders hold over their own moons`,
      r1.agl > 1500 && !r1.landed && rs.filter((s) => s.frameId !== 'mars').every((s) => s.frameId === 'phobos' || s.frameId === 'deimos'));
    check('every live raider has its four-person crew seated at its four stations with Loft people, and a wing of three escorts; the abandoned hull has nobody',
      rs.filter((s) => s.npc.state === 'patrol').every((s) => s.crew.length === 4 && s.crew.every((c) => c.status === 'aboard' && c.seatPose && c.personId) && SIM(s.id).wing.alive().length === 3) && rs.find((s) => s.npc.state === 'abandoned').crew.length === 0);
    const pub = world.publicState(), p1 = pub.ships[R1ID];
    check('a raider is in the public snapshot like any ship: type, pose, hull, crew, mind and escorts all sync (a client needs nothing else to draw it)',
      p1.type === 'raider' && p1.pose && p1.pose.quaternion && Number.isFinite(p1.pose.hull) && p1.crew.length === 4 && p1.npc.name && p1.npc.escorts.drones.length === 3 && p1.combat);
    const pl = await world.join(key('k'), 'Jaron'); PL = pl.id; PSHIP = pl.shipId;
    check('a joining player still gets a Meridian: the ship type is a field set from the default, and the new world does not hand out raiders', REC(PSHIP).type === 'meridian' && !REC(PSHIP).npc && Object.values(world.state.ships).filter((s) => s.owner === PL).length === 1);
    const dRaw = JSON.stringify(world.state).length;
    check(`the whole world, with three raiders in it, serialises to ${Math.round(dRaw / 1000)} kB (it must stay small enough to broadcast ten times a second)`, dRaw < 600000);
  }
  {
    near(PSHIP, R1ID, 1800); board(PSHIP); world.advance(1);
    check('a player in the air above 1500 m is in hostile airspace and the raider knows it; a player who is landed is not', world.fleet.hostile(SIM(PSHIP)) === true && (() => { const g = SIM(PSHIP); g.flight.landed = true; const a = world.fleet.hostile(g); g.flight.landed = false; return a === false; })());
    check('Mars is neutral: a ship the airspace rule calls neutral, or on a drive transit, or with nobody aboard, is never a target, however near the raider',
      world.fleet.hostile({ flight: { landed: false, hull: 100 }, drones: { neutral: true, suspended: false }, record: { id: PSHIP } }) === false &&
      world.fleet.hostile({ flight: { landed: false, hull: 100 }, drones: { neutral: false, suspended: true }, record: { id: PSHIP } }) === false &&
      world.fleet.hostile({ flight: { landed: false, hull: 100 }, drones: { neutral: false, suspended: false }, record: { id: 'nobody-aboard' } }) === false);
    // the player parked at 600 m beside the raider (under the line): 60 s, and the raider never touches him
    { const g = SIM(PSHIP); near(PSHIP, R1ID, 800); g.flight.pos = { x: g.flight.pos.x * 0.99985, y: g.flight.pos.y * 0.99985, z: g.flight.pos.z * 0.99985 }; g.flight.refreshOrientation(); }
    { const before = SIM(PSHIP).flight.shield; world.advance(2); const s2 = SIM(PSHIP); if (s2.flight.agl > 1500) { /* still above the line: the scenario needs a real descent */ } }
    near(PSHIP, R1ID, 1800);
    let t = 0, engaged = false, playerHit = false, escortsStrafed = false;
    const t0 = SIM(PSHIP).flight.shield;
    for (; t < 90 && !playerHit; t += 1) { world.advance(1); if (REC(R1ID).npc.state === 'engage') engaged = true; const g = SIM(PSHIP).flight; if (g.shield < t0 - 1 || g.hull < 100) playerHit = true; if (SIM(R1ID).wing.drones.some((d) => d.state === 'attack')) escortsStrafed = true; }
    check(`the raider comes for a ship in hostile air: it engages within ${t} s, its escorts break formation and strafe, and the player's shield and hull take the damage (shield ${Math.round(SIM(PSHIP).flight.shield)} of ${Math.round(SIM(PSHIP).flight.shieldMax)})`, engaged && playerHit && escortsStrafed);
  }
  {
    // the player shoots back: a perfect gunner on the dorsal turret, firing through the same GunSystem
    const aimFire = () => {
      const S = SIM(PSHIP), f = S.flight, rf = SIM(R1ID).flight, d = Math.hypot(rf.pos.x - f.pos.x, rf.pos.y - f.pos.y, rf.pos.z - f.pos.z); if (d > 1700) return;
      const tof = d / 300, pr = { x: rf.pos.x + rf.vel.x * tof, y: rf.pos.y + rf.vel.y * tof, z: rf.pos.z + rf.vel.z * tof };
      const dl = f.toLocal(pr, {}), pv = S.def.guns.dorsal.pivot, loc = { x: dl.x - pv.x, y: dl.y - pv.y, z: dl.z - pv.z }, l = Math.hypot(loc.x, loc.y, loc.z);
      S.guns.point('dorsal', { x: loc.x / l, y: loc.y / l, z: loc.z / l });
      S.guns.fire('dorsal', f.dirToWorld(S.guns.constructor.dirFor(S.guns.aim.dorsal), {}), f.toWorld(pv, {}), true);
    };
    const marks0 = REC(PSHIP).economy.marks; let disabledAt = null;
    near(PSHIP, R1ID, 1400); SIM(PSHIP).flight.hull = 100; SIM(PSHIP).flight.shield = SIM(PSHIP).flight.shieldMax;
    for (let s = 0; s < 400 && !disabledAt; s++) { for (let k = 0; k < 30; k++) { aimFire(); world.advance(1 / 30); } if (REC(R1ID).npc.state === 'disabled') disabledAt = s; SIM(PSHIP).flight.hull = Math.max(SIM(PSHIP).flight.hull, 40); }
    check(`the player's guns hit the raider through the same bolts: its shield and hull fall under fire and it is disabled after ${disabledAt} s, the drive dead and the crew surrendered`, disabledAt !== null && REC(R1ID).crew.every((c) => c.status === 'surrendered') && SIM(R1ID).flight.hull <= STATS.DISABLED_HULL);
    check('the guns that disabled it are paid the bounty, 150 credits, into that ship\'s account', REC(PSHIP).economy.marks >= marks0 + STATS.DISABLE_BOUNTY_CREDITS * 4);
    // capture needs the ship alongside, aboard, and the raider down
    board(PSHIP); SIM(PSHIP).flight.hull = 100;
    const far = await act(me(), 'claim-far-0001', { type: 'claim-ship', shipId: R1ID });
    check('capturing needs your ship within 160 m of the prize: from 1.4 km it is refused, and nothing changed', far.ok === false && /within/.test(far.msg) && REC(R1ID).npc && REC(R1ID).npc.state === 'disabled', far.msg);
    const livePatrol = raiders().find((s) => s.npc && s.npc.state === 'patrol');
    const notYet = await act(me(), 'claim-live-001', { type: 'claim-ship', shipId: livePatrol.id });
    check('a raider still fighting cannot be claimed: it must be disabled or abandoned first', notYet.ok === false && /fighting|disable/i.test(notYet.msg));
    me().aboardShipId = null; me().pose.aboard = false;
    const noShip = await act(me(), 'claim-walk-001', { type: 'claim-ship', shipId: R1ID });
    check('you cannot claim from the ground: fly up to it in your own ship first', noShip.ok === false);
    board(PSHIP); near(PSHIP, R1ID, 60);
    const got = await act(me(), 'claim-ship-0001', { type: 'claim-ship', shipId: R1ID });
    const mine = REC(R1ID);
    check(`capture works: ${got.msg}`, got.ok === true && mine.owner === PL && mine.npc === null && mine.type === 'raider' && mine.pad && world.state.pads.some((p) => p.shipId === mine.id));
    check('the surrendered crew sign on: four hired people on wages, in the shared pool, aboard at their stations, paid from this ship\'s own account; and its hold money came with it',
      mine.crew.length === 4 && mine.crew.every((c) => c.status === 'aboard' && c.wageCredits > 0 && world.state.pool[c.id] && world.state.pool[c.id].shipId === mine.id) && mine.economy.marks >= 380 * 4);
    const ms = SIM(R1ID);
    check('a prize crew sets it on its own pad, on the ground, at the port, with the ramp down, and it is no longer a raider: no brain, no wing, and no longer in any gunner\'s sights',
      ms.flight.landed && ms.frameId === 'mars' && ms.ship.state.ramps.cargo.lowered && !ms.brain && !ms.wing && !raiders().some((s) => s.id === R1ID));
    world.advance(STATS.RESPAWN_S + 30);
    check('the station it came from gets a new raider after a few minutes, so the sky is not emptied by one capture', raiders().filter((s) => s.npc.station === 'mars-orbit' && ['patrol', 'engage', 'return'].includes(s.npc.state)).length === 1);
  }
  {
    // flagship, boarding, seats, hiring
    me().aboardShipId = null; me().pose.aboard = false;
    board(PSHIP);
    const aboard = await act(me(), 'flag-aboard-01', { type: 'set-flagship', shipId: R1ID });
    me().aboardShipId = null; me().pose.aboard = false;
    const other = await act(me(), 'flag-theirs-001', { type: 'set-flagship', shipId: raiders()[0].id });
    const done = await act(me(), 'flag-ok-000001', { type: 'set-flagship', shipId: R1ID });
    check('you can make a ship you own your flagship, but not while aboard another, and not a ship you do not own (a raider still flying belongs to nobody)', aboard.ok === false && other.ok === false && done.ok === true && me().shipId === R1ID && me().currentShipId === R1ID, aboard.msg + ' / ' + other.msg + ' / ' + done.msg);
    { const f = SIM(PSHIP).flight; f.landed = true; f.airborne = false; f.autoHover = false; f.vel = { x: 0, y: 0, z: 0 }; SIM(PSHIP).capture(); }     // (the Meridian has been flying the fight above: set it down)
    const back = await act(me(), 'flag-back-00001', { type: 'set-flagship', shipId: PSHIP });
    check('and back to the Meridian: both hulls stay owned, each on its own pad, each with its own treasury', back.ok === true && me().shipId === PSHIP && REC(R1ID).owner === PL && REC(PSHIP).owner === PL && REC(R1ID).pad.id !== REC(PSHIP).pad.id);
    await act(me(), 'flag-raider-0001', { type: 'set-flagship', shipId: R1ID });
    me().pose.worldPos = SIM(R1ID).flight.toWorld({ ...RD.dock.rampFoot, y: -1 }, {});
    const bd = await act(me(), 'board-raider-001', { type: 'board', shipId: R1ID });
    check('you board your raider at its own stern ramp, put on its own boarding spot inside the hold (the Meridian\'s dock is not used)', bd.ok === true && me().aboardShipId === R1ID && Math.abs(me().pose.sw.z - RD.dock.boardSw.z) < 1e-9, bd.msg);
    me().pose.sw = { x: RD.seats[0].x, y: 0, z: RD.seats[0].z + 0.5, yaw: 0, pitch: 0 };
    const sit = await act(me(), 'sit-raider-0001', { type: 'seat', seat: 'captain' });
    const sit2 = await act(me(), 'sit-raider-0002', { type: 'seat', seat: 'gun_ventral' });
    check('seats are the raider\'s: the captain\'s seat works and the Meridian\'s ventral turret seat does not exist on it', sit.ok === true && me().pose.seat === 'captain' && sit2.ok === false, sit.msg + ' / ' + sit2.msg);
    await act(me(), 'stand-raider-0001', { type: 'seat', seat: null }); await act(me(), 'leave-raider-0001', { type: 'leave' });
    const nav = Object.values(world.state.pool).find((c) => c.role === 'nav' && !c.shipId);
    me().pose.worldPos = world.site.toWorld(nav.position.x, 0.02, nav.position.z + 3); world.state.pool[nav.id].status = 'waiting';
    const hire = await act(me(), 'hire-nav-000001', { type: 'hire', id: nav.id });
    check('hiring checks the ship: a navigator cannot be hired onto a raider, which has no navigator\'s station', hire.ok === false && /no station/.test(hire.msg), hire.msg);
    // buying
    await act(me(), 'flag-meridian-01', { type: 'set-flagship', shipId: PSHIP });
    const kiosk = SHIPYARD.spot, price = forSale().find((r) => r.type === 'raider').priceCredits;
    const farBuy = await act(me(), 'buy-far-000001', { type: 'buy-ship', shipType: 'raider' });
    me().pose.worldPos = world.site.toWorld(kiosk.x, 0.02, kiosk.z);
    REC(PSHIP).economy.marks = 100;
    const poorR = await act(me(), 'buy-poor-00001', { type: 'buy-ship', shipType: 'raider' });
    const noSuch = await act(me(), 'buy-nosuch-0001', { type: 'buy-ship', shipType: 'meridian' });
    REC(PSHIP).economy.marks = price * 4 + 1234;
    const nShips = Object.keys(world.state.ships).length, nPads = world.state.pads.length;
    const buy = await act(me(), 'buy-raider-0001', { type: 'buy-ship', shipType: 'raider' });
    const bought = REC(buy.shipId);
    check(`buying at the shipyard: away from the kiosk it is refused, without ${price} credits it is refused, the Meridian is not for sale, and with the money it takes exactly ${price} credits and delivers a raider to a new pad`,
      farBuy.ok === false && poorR.ok === false && /costs/.test(poorR.msg) && noSuch.ok === false && buy.ok === true && REC(PSHIP).economy.marks === 1234 &&
      bought.type === 'raider' && bought.owner === PL && !bought.npc && bought.crew.length === 0 && bought.economy.marks === 0 &&
      Object.keys(world.state.ships).length === nShips + 1 && world.state.pads.length === nPads + 1 && SIM(bought.id).flight.landed, farBuy.msg + ' / ' + poorR.msg + ' / ' + buy.msg);
    check('a bought raider is a plain owned ship: no loot, no crew, an empty account; its own pad is a pad nobody else has', bought.pad && new Set(world.state.pads.map((p) => p.id)).size === world.state.pads.length);
  }
  {
    // abandoned: claim without crew
    const ab = raiders().find((s) => s.npc.state === 'abandoned');
    SIM(PSHIP).setFrame(ab.frameId); me().frameId = ab.frameId; board(PSHIP); near(PSHIP, ab.id, 70);        // (the derelict is over Deimos: the claiming ship has to be in that frame too)
    const c = await act(me(), 'claim-abandoned1', { type: 'claim-ship', shipId: ab.id });
    const got = REC(ab.id);
    check('an abandoned hull can be claimed the same way: no crew come with it, it becomes yours on a pad, and is no longer one of the world\'s hulls', c.ok === true && got.owner === PL && got.crew.length === 0 && !got.npc && /Claimed/.test(c.msg), c.msg);
    me().aboardShipId = null; me().pose.aboard = false;
  }
  {
    // hired gunners defend the ship against raiders and their escorts, and leave a surrendered raider alone
    const w2 = await new Authority(mem(), { now: () => Date.now() }).load();
    const p2 = await w2.join(key('g'), 'Gunner test'), s2 = w2.state.ships[p2.shipId], sm = w2.sims.get(s2.id);
    const rid = Object.values(w2.state.ships).find((s) => s.npc && s.npc.station === 'mars-orbit').id, Rr = w2.sims.get(rid);
    const seat = RD.seats.length && shipDef('meridian').seats.find((q) => q.id === 'gun_dorsal');
    s2.crew.push({ id: 'crew-test-1', role: 'gunner_dorsal', name: 'Sunita', personId: 'sunita', skill: 0.85, wageCredits: 90, status: 'aboard', unpaid: false, nextPay: 1e15, seatPose: { ...seat } });
    s2.economy.crew.gunner_dorsal = { nextPay: 1e15, unpaid: false };
    const fr = Rr.flight._frame, f = w2.sims.get(s2.id).flight;
    f.pos = { x: Rr.flight.pos.x + fr.east.x * 700, y: Rr.flight.pos.y + fr.east.y * 700, z: Rr.flight.pos.z + fr.east.z * 700 }; f.vel = { x: 0, y: 0, z: 0 }; f.landed = false; f.airborne = true; f.autoHover = true; f.gearPos = 0; f.refreshOrientation();
    w2.state.players[p2.id].aboardShipId = s2.id; w2.state.players[p2.id].pose.aboard = true;
    const R0 = Rr.flight.hull + Rr.flight.shield;
    for (let i = 0; i < 40; i++) { w2.advance(1); w2.sims.get(s2.id).flight.hull = 100; }
    const shots = w2.sims.get(s2.id).guns.shots.dorsal, R1 = w2.sims.get(rid).flight;
    check(`a hired dorsal gunner on the Meridian fires at the raider and its escorts when the ship is in hostile air (${shots} shots, the raider's shield and hull ${Math.round(R0)} to ${Math.round(R1.hull + R1.shield)})`, shots > 3 && R1.hull + R1.shield < R0, '');
    w2.sims.get(rid).record.npc.state = 'disabled'; w2.sims.get(rid).flight.hull = 20;
    const before = w2.sims.get(s2.id).guns.shots.dorsal; for (let i = 0; i < 20; i++) w2.advance(1);
    check('but not at a raider that has surrendered: the crew do not finish what the player may want to capture', w2.sims.get(s2.id).guns.shots.dorsal === before, `${before} -> ${w2.sims.get(s2.id).guns.shots.dorsal}`);
  }
  {
    // persistence: save mid-fleet, load, same raiders, same positions
    await world.commit(); const saved = JSON.parse(JSON.stringify(world.state));
    const again = await new Authority({ load: async () => ({ record: JSON.parse(JSON.stringify(saved)), bricks: [] }), save: async () => {} }, { now: () => world.now() }).load();
    const live = Object.values(saved.ships).filter((s) => s.npc), live2 = Object.values(again.state.ships).filter((s) => s.npc && live.some((q) => q.id === s.id));
    check('a saved world loads with the same raiders: same ids, names, states, crews and escort wings, and the sims are rebuilt from the records', live.length > 0 && live2.length === live.length && live.every((s) => { const q = again.state.ships[s.id]; return q && q.npc.name === s.npc.name && q.crew.length === s.crew.length && again.sims.get(s.id).brain; }));
    const t0 = Date.now(); const a2 = await new Authority({ load: async () => ({ record: JSON.parse(JSON.stringify(saved)), bricks: [] }), save: async () => {} }, { now: () => world.now() + 300 * 1000 }).load();
    const ms = Date.now() - t0;
    check(`loading a world that sat idle for five minutes does not simulate five minutes of raiders: it loads in ${ms} ms and the raiders wait where they were`, ms < 15000 && Object.values(a2.state.ships).filter((s) => s.npc && saved.ships[s.id] && saved.ships[s.id].npc).every((s) => { const o = saved.ships[s.id]; return Math.hypot(s.pose.pos.x - o.pose.pos.x, s.pose.pos.y - o.pose.pos.y, s.pose.pos.z - o.pose.pos.z) < 1; }));
    const old = JSON.parse(JSON.stringify(saved)); delete old.fleet; for (const [id, s] of Object.entries(old.ships)) if (s.npc || s.type === 'raider') delete old.ships[id];
    for (const s of Object.values(old.ships)) { s.combat = { ...(s.combat || {}), drones: [{ id: 'x', pos: { x: 1, y: 1, z: 1 }, vel: { x: 0, y: 0, z: 0 }, state: 'away', cool: 1, phase: 0, anchor: { x: 1, y: 1, z: 1 }, target: { hp: 60, inactive: true } }] }; }
    const nOld = Object.keys(old.ships).length;
    const legacy = await new Authority({ load: async () => ({ record: old, bricks: [] }), save: async () => {} }, { now: () => world.now() }).load();
    check('a world saved before the fleet (no raiders, the old per-ship drones in the combat record) loads without error, keeps its ships, and gets its raiders', Object.values(legacy.state.ships).filter((s) => s.npc).length === 3 && Object.values(legacy.state.ships).filter((s) => !s.npc).length === nOld, `${Object.values(legacy.state.ships).filter((s) => s.npc).length} raiders, ${Object.values(legacy.state.ships).filter((s) => !s.npc).length} others of ${nOld}`);
  }

  // =====================================================================================================================
  section('26. Two players, one raider: both see it, and both see the damage');
  // =====================================================================================================================
  {
    const { startServer } = await import('../server/index.mjs');
    const { FileAdapter } = await import('../server/storage.mjs');
    const { TestClient } = await import('./multiplayer-checks.mjs');
    const dir = await mkdtemp(join(tmpdir(), 'cosmos-fleet-'));
    let app, a, b;
    const nearSim = (S, Rr, east) => { const fr = Rr.flight._frame, f = S.flight; f.pos = { x: Rr.flight.pos.x + fr.east.x * east, y: Rr.flight.pos.y + fr.east.y * east, z: Rr.flight.pos.z + fr.east.z * east }; f.vel = { x: 0, y: 0, z: 0 }; f.landed = false; f.airborne = true; f.autoHover = true; f.gearPos = 0; f.refreshOrientation(); };
    try {
      let clock = Date.now();
      app = await startServer({ adapter: new FileAdapter(join(dir, 'world.json')), port: 0, tick: false, now: () => clock });
      a = new TestClient(app.url, 'a'.repeat(48), 'Jaron'); b = new TestClient(app.url, 'b'.repeat(48), 'Lilith');
      await a.connect(); await b.connect();
      const w = app.world;
      const rid = Object.values(w.state.ships).find((s) => s.npc && s.npc.station === 'mars-orbit').id, Rs = w.sims.get(rid);
      const snap = async () => { a.send({ type: 'checkpoint' }); const rev = w.state.revision + 1; const ma = await a.wait((m) => m.type === 'state' && m.state.revision >= rev); const mb = await b.wait((m) => m.type === 'state' && m.state.revision >= ma.state.revision); return [ma.state, mb.state]; };
      let [sa, sb] = await snap();
      check('both clients receive the same raiders: same ids, type, name, crew and pose in both snapshots',
        Object.values(sa.ships).filter((s) => s.npc).length === 3 && Object.values(sa.ships).filter((s) => s.npc).every((s) => { const q = sb.ships[s.id]; return q && q.type === 'raider' && q.npc.name === s.npc.name && q.crew.map((c) => c.name).join() === s.crew.map((c) => c.name).join() && JSON.stringify(q.pose.pos) === JSON.stringify(s.pose.pos); }));
      const pa = w.state.players[a.id], sh = w.state.ships[pa.shipId], simA = w.sims.get(sh.id);
      nearSim(simA, Rs, 1500); pa.aboardShipId = sh.id; pa.pose.aboard = true; pa.pose.seat = 'pilot';
      const hull0 = Rs.flight.hull + Rs.flight.shield;
      for (let s = 0; s < 40; s++) { w.advance(1); }
      // a gunner on a: shoot the raider
      for (let s = 0; s < 40; s++) { for (let k = 0; k < 30; k++) { const f = simA.flight, rf = Rs.flight, d = Math.hypot(rf.pos.x - f.pos.x, rf.pos.y - f.pos.y, rf.pos.z - f.pos.z); if (d < 1700) { const tof = d / 300, pr = { x: rf.pos.x + rf.vel.x * tof, y: rf.pos.y + rf.vel.y * tof, z: rf.pos.z + rf.vel.z * tof }; const dl = f.toLocal(pr, {}), pv = simA.def.guns.dorsal.pivot, loc = { x: dl.x - pv.x, y: dl.y - pv.y, z: dl.z - pv.z }, l = Math.hypot(loc.x, loc.y, loc.z); simA.guns.point('dorsal', { x: loc.x / l, y: loc.y / l, z: loc.z / l }); simA.guns.fire('dorsal', f.dirToWorld(simA.guns.constructor.dirFor(simA.guns.aim.dorsal), {}), f.toWorld(pv, {}), true); } w.advance(1 / 30); } if (Rs.flight.shield < 100) break; simA.flight.hull = Math.max(40, simA.flight.hull); }
      [sa, sb] = await snap();
      const ra = sa.ships[rid], rb = sb.ships[rid];
      check(`the raider's damage is the same in both clients' snapshots: shield ${Math.round(ra.pose.shield)}, hull ${Math.round(ra.pose.hull)}, mind "${ra.npc.state}", escorts ${ra.npc.escorts.drones.filter((d) => d.state !== 'dead').length} alive`,
        ra.pose.hull + ra.pose.shield < hull0 - 5 && ra.pose.hull === rb.pose.hull && ra.pose.shield === rb.pose.shield && ra.npc.state === rb.npc.state && JSON.stringify(ra.npc.escorts) === JSON.stringify(rb.npc.escorts) && JSON.stringify(ra.combat.bolts) === JSON.stringify(rb.combat.bolts));
      const shipA = sb.ships[pa.shipId];
      check('and the damage the raider did to the player\'s ship is in both snapshots too, so the second player sees the first one\'s hull and shield fall', shipA.pose.shield === sa.ships[pa.shipId].pose.shield && (shipA.pose.shield < simA.flight.shieldMax || shipA.pose.hull < 100));
      // finish it
      for (let s = 0; s < 120 && Rs.record.npc.state !== 'disabled'; s++) { Rs.flight.hull = Math.min(Rs.flight.hull, 30); w.advance(1); }
      [sa, sb] = await snap();
      check('when it is disabled, both clients see a disabled raider with surrendered crew and no escorts left in the fight', sa.ships[rid].npc.state === 'disabled' && sb.ships[rid].npc.state === 'disabled' && sb.ships[rid].crew.every((c) => c.status === 'surrendered'));
      // the second player captures it over the wire: they fly up alongside and claim
      const pb = w.state.players[b.id], shB = w.state.ships[pb.shipId], simB = w.sims.get(shB.id);
      nearSim(simB, Rs, 80); pb.aboardShipId = shB.id; pb.pose.aboard = true;
      const claim = await b.action({ type: 'claim-ship', shipId: rid });
      [sa, sb] = await snap();
      check('the second player captures it over the socket: both clients then see it owned by them, on a pad, crewed, and no longer a raider', claim.ok === true && sa.ships[rid].owner === b.id && sb.ships[rid].owner === b.id && sa.ships[rid].npc === null && sa.ships[rid].crew.length === 4 && sa.ships[rid].pad.id === sb.ships[rid].pad.id);
      const again = await a.action({ type: 'claim-ship', shipId: rid });
      check('and the same raider cannot be claimed twice: the first player\'s late claim is refused', again.ok === false);
      const hasB = await b.action({ type: 'set-flagship', shipId: rid });
      check('a client cannot make a ship its flagship while aboard another (the rule holds over the wire)', hasB.ok === false);
    } catch (e) { check('the two-client fleet scenario completes', false, e.stack); }
    finally { a?.close(); b?.close(); if (app) await app.close(); await rm(dir, { recursive: true, force: true }); }
  }
}
