// Checks for the Drayman hauler, rover transport and player shops (src/ships/hauler/, server/vehicles.mjs, server/shops.mjs).
// Everything runs the real code: the real walker over the real layout, the real flight model, the real authority and the real server socket.
// WebGL and the people GLBs are checked in a browser: test/cargo-browser.mjs and docs/qa/2026-10-03/cargo/REVIEW.md.
import '../server/runtime.mjs';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../server/index.mjs';
import { FileAdapter } from '../server/storage.mjs';
import { Authority } from '../server/authority.mjs';
import { TestClient } from './multiplayer-checks.mjs';

export async function runCargoChecks({ check, section, THREE, mars, FIELD }) {
  const base = '../src/';
  const { shipDef, shipTypes, allShipDefs } = await import(base + 'ships/registry.js');
  const { visualsFor } = await import(base + 'ships/visuals.js');
  const { forSale } = await import(base + 'ships/shipyard.js');
  const { ShipWalker, shipIndexFor, defaultState } = await import(base + 'ship/shipWalker.js');
  const { planPath, routeToSeat } = await import(base + 'crew/shipPath.js');
  const { ShipBody } = await import(base + 'ship/shipFlight.js');
  const { createPortSite } = await import(base + 'port/portSpec.js');
  const { makeShipMaterials } = await import(base + 'ship/shipTextures.js');
  const { buildInterior, buildSeats } = await import(base + 'ship/shipInterior.js');
  const { registerShipAssets } = await import(base + 'ship/shipSystem.js');
  const { Registry } = await import(base + 'core/registry.js');
  const H = await import(base + 'ships/hauler/spec.js');
  const { RAIDER_PRICE_CREDITS } = await import(base + 'ships/raider/stats.js');
  const { MAT_ITEM } = await import(base + 'space/jobs.js');
  const SH = await import(base + 'economy/shops.js');
  const { GOODS, SOL_SECONDS } = await import(base + 'economy/catalog.js');
  const { vehicleDef } = await import(base + 'vehicles/registry.js');
  const { createVehicle, drive, localToFrame } = await import(base + 'vehicles/api.js');
  const { makeShipEnv, deckOf } = await import(base + 'vehicles/support.js');
  const { propBoxOf } = await import(base + 'ships/layoutKit.js');

  const site = createPortSite(mars);
  FIELD.attachGrades([site]);
  const ground = (x, y, z) => FIELD.surfaceRadiusFast(mars, x, y, z);

  // =====================================================================================================================
  section('40. The Drayman hauler: a ship type that is data, with a big hold and a wide ramp');
  // =====================================================================================================================
  const HD = shipDef('hauler'), M = shipDef('meridian'), L = HD.layout, idx = shipIndexFor(HD);
  {
    check('the hauler is a registry entry like the others, and the shipyard sells it for a price between a Shrike and a Meridian',
      shipTypes().includes('hauler') && HD.class === 'Drayman-class hauler' && forSale().some((r) => r.type === 'hauler')
      && HD.stats.priceCredits > RAIDER_PRICE_CREDITS && HD.stats.priceCredits < M.stats.priceCredits);
    check(`its hold carries ${HD.stats.cargoKg / 1000} t (the Meridian's is ${M.stats.cargoKg / 1000} t), it seats ${HD.stats.crewMax} crew, and it is slower and heavier than a Meridian cruise`,
      HD.stats.cargoKg >= 3 * M.stats.cargoKg && HD.phys.cruiseSpeed < M.phys.cruiseSpeed && HD.phys.massKg > M.phys.massKg);
    check('the cargo ramp is as wide as the two berth columns (6.8 m): a rover in either side column drives straight out aft, and two rovers go up abreast',
      HD.ramps.cargo.width >= 2 * Math.max(...HD.berths.map((b) => Math.abs(b.x))) && HD.ramps.cargo.width > 2 * 2 * vehicleDef('survey').half.x);
    check('it has the rooms the brief asked for: a flight deck, crew berth, mess, a cargo hold, an engine room and an airlock, plus cargo control and supplies',
      ['cockpit', 'crew_a', 'galley', 'hold', 'engine', 'airlock', 'control', 'stores'].every((id) => L.roomById.has(id)) && L.rooms.length >= 9);
    const hold = L.roomById.get('hold');
    check(`the hold is ${(hold.z1 - hold.z0).toFixed(0)} m by ${(hold.x1 - hold.x0).toFixed(1)} m and ${hold.h} m high, the Meridian cargo bay is smaller in every direction`,
      hold.z1 - hold.z0 >= 18 && hold.x1 - hold.x0 >= 10 && hold.h >= 4.4);
    const { CREW_POSTS } = await import(base + 'crew/crewSpec.js');
    const hireable = CREW_POSTS.filter((c) => HD.seats.some((q) => q.id === HD.crewPosts.find((r) => r.id === c.id)?.seat)).map((c) => c.id);
    check('the hall can staff a Drayman: a pilot, a captain, a navigator and a comms officer have stations (there are no gun turrets for gunners)', ['pilot', 'captain', 'nav', 'comms'].every((r) => hireable.includes(r)) && !hireable.includes('gunner_dorsal') && !hireable.includes('gunner_ventral'), hireable.join());
    const bad = [];
    for (const d of allShipDefs()) {
      const ids = new Set(d.layout.rooms.map((r) => r.id));
      if (!d.seats.every((s) => ids.has(s.room)) || !Object.values(d.roles).every((r) => ids.has(r))) bad.push(d.type);
    }
    check('every ship definition (the hauler too) names real rooms for its seats and roles', bad.length === 0, bad.join());
  }
  {
    const st = defaultState(); st.airlock.innerOpen = true;
    const sw = new ShipWalker(idx, st);
    const start = { x: 0, y: 0, z: 0 }, miss = [];
    for (const r of L.rooms) {
      const p = planPath(sw, start, { x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2, y: r.y }, { reach: 2.0 });
      if (!p) miss.push(r.id);
    }
    check('a person can walk from the corridor into every room: flight deck, berth, mess, airlock, cargo control, supplies, engine room, hold', miss.length === 0, miss.join());
    const routes = HD.seats.map((s) => [s.id, routeToSeat(sw, start, s)]);
    check('and to every one of its five stations (pilot, captain, navigator, comms, engineer)', routes.every(([, r]) => r && r.length), routes.filter(([, r]) => !r).map(([id]) => id).join());
    const thr = [];
    for (const d of L.doors) {
      if (d.kind === 'outer' || d.kind === 'portal') continue;
      const A = L.roomById.get(d.a), B = L.roomById.get(d.b);
      const pa = d.axis === 'x' ? { x: d.at + (A.x0 > d.at ? 0.5 : -0.5), z: d.c } : { x: d.c, z: d.at + (A.z0 > d.at ? 0.5 : -0.5) };
      const pb = d.axis === 'x' ? { x: d.at + (B.x0 > d.at ? 0.5 : -0.5), z: d.c } : { x: d.c, z: d.at + (B.z0 > d.at ? 0.5 : -0.5) };
      if (!sw.canStand(pa.x, d.y, pa.z) || !sw.canStand(pb.x, d.y, pb.z) || !sw.canStand(d.axis === 'x' ? d.at : d.c, d.y, d.axis === 'x' ? d.c : d.at)) thr.push(d.id);
    }
    check('every door has clear floor on both sides and in the opening', thr.length === 0, thr.join());
    const gap = L.doors.filter((d) => d.b !== 'outside' && d.kind !== 'portal').filter((d) => {
      const A = L.roomById.get(d.a), B = L.roomById.get(d.b);
      const planes = (r) => (d.axis === 'x' ? [r.x0, r.x1] : [r.z0, r.z1]);
      return !planes(A).some((p) => Math.abs(p - d.at) < 0.11) || !planes(B).some((p) => Math.abs(p - d.at) < 0.11);
    });
    check('every door stands in the 0.2 m wall between the two rooms it joins', gap.length === 0, gap.map((d) => d.id).join());
    const out = [];
    for (const p of L.props) {
      const r = L.roomById.get(p.room), b = propBoxOf(p);
      if (!r || b.x0 < r.x0 - 0.12 || b.x1 > r.x1 + 0.12 || b.z0 < r.z0 - 0.12 || b.z1 > r.z1 + 0.12) out.push(`${p.kind}@${p.room}`);
    }
    check('every piece of furniture stands inside the room it is listed in', out.length === 0, out.join());
    const stR = defaultState(); stR.ramps.cargo = { lowered: true, angle: 0.4, progress: 1 };
    const swR = new ShipWalker(idx, stR), ramp = HD.ramps.cargo, run = ramp.length * Math.cos(0.4), tipY = ramp.hinge.y - run * Math.tan(0.4);
    swR.place(0, tipY, ramp.hinge.z + run - 0.6, 0);
    const inside = planPath(swR, { x: 0, y: tipY, z: ramp.hinge.z + run - 0.6 }, { x: 0, z: -12.9, y: 0 }, { reach: 0.6 });
    check('with the vehicle ramp down, a person at its foot walks up it, down the hold aisle and through the engine room and corridor to the flight deck', !!inside);
    const sw2 = new ShipWalker(idx, stR); sw2.place(0, 0, 30, 0); sw2.yaw = Math.PI;
    let exited = false; for (let i = 0; i < 600 && !exited; i++) { sw2.tick(1 / 60, { moveZ: 1 }); exited = sw2.events.includes('exit:cargo'); }
    check('walking aft down the ramp the walker asks to leave the ship at its end', exited, `z ${sw2.z.toFixed(2)}`);
    const stA = defaultState(); stA.ramps.airlock = { lowered: true, angle: 0.5, progress: 1 }; stA.airlock.outerOpen = true; stA.airlock.innerOpen = false;
    const swA = new ShipWalker(idx, stA); swA.place(-3.5, 0, -1.2, -Math.PI / 2);
    let exitedA = false; for (let i = 0; i < 700 && !exitedA; i++) { swA.tick(1 / 60, { moveZ: 1 }); exitedA = swA.events.includes('exit:airlock'); }
    check('and through the airlock: with the outer door open and the gangway out, walking to port leaves the ship', exitedA, `x ${swA.x.toFixed(2)}`);
  }
  {
    const V = visualsFor('hauler'), Lx = { ...L, custom: V.custom };
    const mats = makeShipMaterials({ tier: 'high' });
    const it = buildInterior(Lx, mats, { tier: 'high' });
    buildSeats(Lx, mats, it);
    const ex = V.buildExterior(Lx, mats, { tier: 'high', def: HD });
    const hardware = new THREE.Group();
    for (const ch of [...ex.root.children]) { if (ch.name === 'exhaust' || (ch.isMesh && ch.material && ch.material.blending === THREE.AdditiveBlending)) continue; hardware.add(ch); }
    ex.root.add(hardware); V.applyNeutralPose(ex);
    const reg = new Registry();
    registerShipAssets(reg, THREE, hardware, it.seatGroups, { x: 0, y: 0, z: 0 }, HD);
    const rec = reg.get(HD.registryId);
    check('the hauler has its own registry id, a measured size and a real mass',
      rec && rec.measured && rec.massKg === HD.phys.massKg && /^COS-MARS-VEH-\d{4}$/.test(HD.registryId) && new Set(allShipDefs().map((d) => d.registryId)).size === allShipDefs().length);
    const drifts = [HD.registryId, ...HD.seats.map((s) => s.stationId)].map((id) => [id, reg.dimensionDrift(id, 0.05)]);
    const bad = drifts.filter(([, d]) => !d || !d.withinTolerance).map(([id, d]) => `${id} ${d ? d.worst.toFixed(3) : 'none'}`);
    check('the hauler and all five stations measure within 5 cm of their design size', bad.length === 0, bad.join('; '));
    check('its stations have registry ids of their own, none shared with another ship',
      HD.seats.every((s) => /^COS-MARS-STR-\d{4}$/.test(s.stationId)) && new Set(allShipDefs().flatMap((d) => d.seats.map((s) => s.stationId))).size === allShipDefs().reduce((n, d) => n + d.seats.length, 0));
    const misfit = [];
    for (const r of L.rooms) {
      if (H.CANOPY_ROOMS.includes(r.id)) continue;
      for (const x of [r.x0, r.x1]) for (const y of [r.y, r.y + r.h]) for (const z of [r.z0, r.z1]) if (!H.HULL.insideHull(x, y, z, 0.05)) misfit.push(`${r.id}(${x},${y},${z})`);
    }
    check('every main-body room fits inside the lofted hull (the flight-deck canopy stands above it like the Meridian bridge)', misfit.length === 0, misfit.slice(0, 5).join());
    let tris = 0, calls = 0; it.root.traverse((o) => { if (o.isMesh) { calls++; tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; } });
    check(`the interior is light enough for a phone: under 130k triangles and 260 draw calls with every room drawn (${Math.round(tris)} triangles, ${calls} meshes)`, tris < 130000 && calls < 260);
    check('the interior builder drew every room, door and seat and put every coplanar pair on its own depth layer',
      it.layerStats && it.layerStats.maxLayer <= 12 && it.rooms.size === L.rooms.length && it.seatGroups.size === 5 && it.doors.length >= 8);
    const low = V.buildExterior(Lx, makeShipMaterials({ tier: 'low' }), { tier: 'low', def: HD });
    check(`the exterior builds on the phone tier with four legs, both ramps, a chin gun pair, four exhausts and four lift pods (${low.triangles} triangles low, ${ex.triangles} high)`,
      low.legs.length === 4 && low.ramps.cargo && low.ramps.airlock && low.guns.main.length === 2 && low.engines.length === 4 && low.liftPods.length === 4 && low.triangles < 12000 && low.triangles <= ex.triangles);
    const remote = V.buildExterior(Lx, mats, { tier: 'low', def: HD, remote: true });
    check('a remote view adds canopy glass so the people at the stations can be seen, and the local one does not', !!remote.remoteGlass && !ex.remoteGlass);
    check('the chin gun muzzles are ahead of the bow and the cargo ramp hinge sits at the hold stern wall',
      HD.guns.main.muzzles.every((m) => m.z < H.HULL.z0 + 0.7) && HD.ramps.cargo.hinge.z === L.roomById.get('hold').z1);
    const tipLen = HD.ramps.cargo.length;
    check(`with the gear at nominal height the ${tipLen} m ramp reaches the ground at ${(Math.asin((HD.gear.nominal + HD.gear.soleOffset) / tipLen) * 57.3).toFixed(0)} degrees: a rover can climb it`,
      Math.asin((HD.gear.nominal + HD.gear.soleOffset) / tipLen) < 0.5 && Math.tan(Math.asin((HD.gear.nominal + HD.gear.soleOffset) / tipLen)) < 0.6);
  }
  {
    const f = new ShipBody(mars, ground, HD); f.setDown(site.toWorld(0, HD.dock.spawnY, 0), site.heading);
    for (let i = 0; i < 540; i++) f.step(1 / 60);
    check('set on the pad, the hauler rests on all four legs, landed and undamaged, with its own shield', f.landed && f.legs.filter((l) => l.contact).length === 4 && f.hull === 100 && Math.round(f.shieldMax) === HD.phys.shieldBase);
    f.autoHover = true; f.controls.lift = 1; let t = 0; while (f.agl < 100 && t < 60) { f.step(1 / 30); t += 1 / 30; }
    check(`it lifts off and climbs to 100 m in ${t.toFixed(1)} s at ${HD.phys.climbSpeed} m/s (the Meridian takes 10 s at 12)`, f.agl >= 100 && t > 9 && t < 20);
    f.controls.lift = 0; f.controls.fwd = 1; for (let i = 0; i < 30 * 25; i++) f.step(1 / 30);
    check(`it cruises at ${f.groundSpeed.toFixed(1)} m/s (design ${HD.phys.cruiseSpeed})`, Math.abs(f.groundSpeed - HD.phys.cruiseSpeed) < 2.5, `${f.groundSpeed}`);
    const f2 = new ShipBody(mars, ground, HD); f2.setDown(site.toWorld(0, HD.dock.spawnY, 0), site.heading); for (let i = 0; i < 540; i++) f2.step(1 / 60);
    f2.autoHover = true; f2.controls.lift = 1; while (f2.agl < 80) f2.step(1 / 30); f2.controls.lift = 0; for (let i = 0; i < 30 * 5; i++) f2.step(1 / 30);
    f2.controls.lift = -1; let n = 0; while (!f2.landed && n++ < 30 * 120) f2.step(1 / 30);
    check(`and sets down on its gear at ${f2.lastTouchdown ? f2.lastTouchdown.v.toFixed(2) : '?'} m/s with no hull damage`, f2.landed && f2.lastTouchdown.v < 5 && f2.hull === 100);
  }

  // =====================================================================================================================
  section('41. The vehicle bay: berths, deck and lock-down are data');
  // =====================================================================================================================
  {
    const sv = vehicleDef('survey'), deck = deckOf(HD), md = deckOf(M);
    check('the Meridian bay is unchanged (deckOf gives the old 9.8 to hinge rectangle) and the hauler declares its own deck and six berths',
      md.x0 === -5.8 && md.z0 === 9.8 && md.z1 === M.ramps.cargo.hinge.z && deck === H.CARGO_DECK && HD.berths.length === 6 && HD.stats.roverBerths === 6);
    const env = makeShipEnv({ ramps: HD.ramps, rampState: { cargo: { lowered: true, progress: 1, angle: 0.4 } }, landed: () => true, deck,
      obstacles: (idx.obstacles || []).filter((o) => o.z1 > deck.z0 - 0.8 && o.y0 < 2.4) });
    const clash = [], obst = (idx.obstacles || []).filter((o) => o.z1 > deck.z0 - 0.8 && o.y0 < 2.4);
    for (const b of HD.berths) {
      if (env.blocked({ x: b.x, y: 0, z: b.z }) || !env.sample(b.x, 0, b.z)) clash.push(b.id + ' centre');
      const box = { x0: b.x - sv.half.x, x1: b.x + sv.half.x, z0: b.z - sv.half.z, z1: b.z + sv.half.z };
      if (obst.some((o) => box.x1 > o.x0 && box.x0 < o.x1 && box.z1 > o.z0 && box.z0 < o.z1)) clash.push(b.id + ' freight');
      if (deck.x1 - Math.abs(b.x) - sv.half.x < 0.9) clash.push(b.id + ' wall lane');
      if (box.z0 < deck.z0 + 1 || box.z1 > deck.z1 - 1.5) clash.push(b.id + ' ends');
    }
    let overlap = 0;
    for (const a of HD.berths) for (const b of HD.berths) if (a.id < b.id && Math.abs(a.x - b.x) < 2 * sv.half.x + 0.05 && Math.abs(a.z - b.z) < 2 * sv.half.z + 0.05) overlap++;
    check('no two berths overlap, and the aisle between the two columns is wider than a rover', overlap === 0 && Math.abs(HD.berths[0].x - HD.berths[1].x) - 2 * sv.half.x > 2.3);
    const v = createVehicle('survey', { id: 't', pose: { x: 0, y: 0, z: 31, yaw: 0, speed: 0 } });
    let lastZ = v.pose.z; for (let i = 0; i < 40; i++) drive(v, { throttle: 1, steer: 0 }, 1 / 30, env);
    check('on the lowered ramp and deck a rover driven forward climbs the 24 degree ramp and keeps going up the aisle', v.pose.z < lastZ - 2 || v.pose.speed > 0.5, `z ${v.pose.z}`);
  }

  // =====================================================================================================================
  section('42. Shops: the stall catalogue and the exact-matter helpers');
  // =====================================================================================================================
  {
    check('six stalls stand on the market row, a body-width apart, south of the main pad, clear of the hiring board and the shipyard kiosk',
      SH.STALLS.length === 6 && SH.STALLS.every((s) => s.z === 60) && SH.STALLS.every((s, i) => i === 0 || s.x - SH.STALLS[i - 1].x >= 5)
      && SH.STALLS.every((s) => Math.hypot(s.x + 36, s.z - 40) > 20 && Math.hypot(s.x + 23.6, s.z - 49.4) > 8));
    check('the shop item table matches the game: every supply is a catalog good, the hold items the Phobos jobs make, and the material map equals src/space/jobs.js',
      Object.keys(MAT_ITEM).every((m) => SH.ITEM_OF_MATERIAL[m] === MAT_ITEM[m]) && Object.keys(SH.ITEM_OF_MATERIAL).length === Object.keys(MAT_ITEM).length
      && SH.goodIds().filter((g) => SH.SHOP_GOODS[g].kind === 'supply').every((g) => g in GOODS)
      && SH.SHOP_GOODS['salvage-alloy'].kind === 'hold' && ['phobos-regolith', 'phobos-hydrated-clay', 'deimos-regolith'].every((g) => SH.SHOP_GOODS[g].kind === 'matter'));
    check('a fair price is never below a dealer buys at nor above the shelf price, and every NPC ceiling is a whole number above fair',
      SH.goodIds().filter((g) => SH.SHOP_GOODS[g].kind === 'supply').every((g) => SH.SHOP_GOODS[g].fair >= GOODS[g].sell && SH.SHOP_GOODS[g].fair <= GOODS[g].buy)
      && SH.goodIds().every((g) => Number.isInteger(SH.npcCeiling(g)) && SH.npcCeiling(g) >= SH.SHOP_GOODS[g].fair));
    const lot = (id, mat, kg) => ({ lotId: id, materialId: mat, materialName: mat, massKg: kg, solidVolumeM3: kg / 1500, looseVolumeM3: kg / 1000, parts: [{ materialId: mat, massKg: kg, volumeM3: kg / 1500 }] });
    const mixed = { lotId: 'mix', materialId: 'MAT-PHOBOS-REGOLITH', massKg: 400, solidVolumeM3: .3, looseVolumeM3: .4, parts: [{ materialId: 'MAT-PHOBOS-REGOLITH', massKg: 200, volumeM3: .1 }, { materialId: 'MAT-PHOBOS-CLAY', massKg: 200, volumeM3: .2 }] };
    const lots = [lot('a', 'MAT-PHOBOS-REGOLITH', 1300), mixed, lot('b', 'MAT-PHOBOS-REGOLITH', 900), lot('c', 'MAT-PHOBOS-CLAY', 500)];
    const t = SH.takeMatter(lots, 'phobos-regolith', 2000);
    const sum = (arr, k) => SH.sumLots(arr, k);
    check('takeMatter splits lots exactly: 2 t of pure regolith leave, a mixed lot is never touched, the input is not modified, and the exact books (taken + remaining = before) agree to a billionth of a gram',
      Math.abs(SH.lotKg(t.taken, 'phobos-regolith') - 2000) < 1e-9 && t.remaining.some((l) => l.lotId === 'mix') && !t.taken.some((l) => l.lotId === 'mix')
      && sum(lots, 'massKg') === sum(t.remaining, 'massKg') + t.massExact && Math.abs(Number(sum(t.taken, 'massKg') - t.massExact)) / 2 ** 96 < 1e-9
      && Math.abs(Number(sum(t.taken, 'solidVolumeM3') - t.volumeExact)) / 2 ** 96 < 1e-12 && lots.length === 4 && lots[0].massKg === 1300);
    let refused = false; try { SH.takeMatter(lots, 'phobos-regolith', 5000); } catch { refused = true; }
    check('asking for more pure matter than there is refuses, and the mixed lot does not count towards it', refused && SH.lotKg(lots, 'phobos-regolith') === 2200);
  }

  // =====================================================================================================================
  section('43. Shops on the real authority: rent, stock, price, buy, refusals, receipts, NPC buyers, persistence');
  // =====================================================================================================================
  if (!process.env.CARGO_SKIP43) {
  const dir = await mkdtemp(join(tmpdir(), 'cosmos-cargo-'));
  let app, a, b, c;
  let clock = Date.now();
  try {
    const adapter = new FileAdapter(join(dir, 'world.json'));
    app = await startServer({ adapter, port: 0, tick: false, now: () => clock });
    const world = app.world;
    a = new TestClient(app.url, 'a'.repeat(48), 'Jaron'); b = new TestClient(app.url, 'b'.repeat(48), 'Lilith');
    await a.connect(); await b.connect();
    const pa = world.state.players[a.id], pb = world.state.players[b.id], aShip = pa.shipId, bShip = pb.shipId;
    // a refused action restores the whole state from a copy, so records are always re-read, never held
    const SA = () => world.state.ships[aShip], SB = () => world.state.ships[bShip];
    const settle = async () => { await new Promise((r) => setTimeout(r, 6)); await world.enqueue(() => {}); };
    const move = async (client, worldPoint) => {
      const p = world.state.players[client.id], origin = { ...p.pose.worldPos };
      const dist = Math.hypot(worldPoint.x - origin.x, worldPoint.y - origin.y, worldPoint.z - origin.z), n = Math.max(1, Math.ceil(dist / 8));
      for (let i = 1; i <= n; i++) {
        clock += 1000;
        const pose = structuredClone(p.pose);
        for (const k of ['x', 'y', 'z']) pose.worldPos[k] = origin[k] + (worldPoint[k] - origin[k]) * i / n;
        pose.aboard = false; client.send({ type: 'pose', pose }); await settle();
      }
    };
    const toStall = (client, n, dz = -2) => move(client, world.site.toWorld(SH.STALLS[n - 1].x, 0.02, SH.STALLS[n - 1].z + dz));
    const lot = (id, mat, kg) => ({ lotId: id, materialId: mat, materialName: mat, massKg: kg, solidVolumeM3: kg / 1500, looseVolumeM3: kg / 1000, parts: [{ materialId: mat, massKg: kg, volumeM3: kg / 1500 }] });
    // Stock the sellers' ships the way the game does (a salvage claim, a stow of dug matter, bought supplies): added through the same fields.
    world.addCargo(SA(), 'salvage-alloy', 1800);
    world.addCargo(SA(), 'phobos-regolith', 3000); SA().holdLots.push(lot('p1', 'MAT-PHOBOS-REGOLITH', 1700), lot('p2', 'MAT-PHOBOS-REGOLITH', 1300));
    world.addCargo(SA(), 'phobos-hydrated-clay', 1200); SA().holdLots.push(lot('c1', 'MAT-PHOBOS-CLAY', 1200));
    SA().economy.inventory.water = 40; SA().economy.inventory.parts = 3;
    SB().economy.marks = 3000;
    const totalMarks = () => Object.values(world.state.ships).reduce((n, s) => n + s.economy.marks, 0) + world.state.market.marketMarks;
    const matterBooks = () => {
      const lots = [...Object.values(world.state.players).flatMap((p) => p.carried), ...Object.values(world.state.ships).flatMap((s) => [...(s.holdLots || []), ...(s.jobs?.samples || [])]),
        ...Object.values(world.state.shops).flatMap((s) => s.lots || [])];
      const exp = Object.values(world.state.ships).reduce((n, s) => n + BigInt(s.economy.exportedMassExact || '0'), 0n);
      return SH.sumLots(lots, 'massKg') + exp;
    };
    const m0 = totalMarks(), mass0 = matterBooks();

    // ---- rent
    const far = await a.action({ type: 'shop-rent', stall: 'port-1', name: 'Jaron Salvage' });
    check('renting a stall from across the port is refused: you stand at the stall', far.ok === false && /Walk over/.test(far.msg) && !world.state.shops['port-1'], far.msg);
    await toStall(a, 1);
    const marks0 = SA().economy.marks, dealer0 = world.state.market.marketMarks;
    const rented = await a.action({ type: 'shop-rent', stall: 'port-1', name: '  Jaron   Salvage <b>& Co  ' });
    const shop = () => world.state.shops['port-1'];
    check(`renting stall 1 costs ${SH.RENT_MARKS} marks, paid from the ship account to the port's dealer fund, and names the shop (markup stripped)`,
      rented.ok && shop().ownerId === a.id && SA().economy.marks === marks0 - SH.RENT_MARKS && world.state.market.marketMarks === dealer0 + SH.RENT_MARKS && shop().name === 'Jaron Salvage b& Co'
      && Math.abs(shop().paidUntil - world.state.clock - SH.RENT_SOLS * SOL_SECONDS) < 1, JSON.stringify(rented));
    const again = await a.action({ type: 'shop-rent', stall: 'port-2' });
    const taken = await (async () => { await toStall(b, 1); return b.action({ type: 'shop-rent', stall: 'port-1' }); })();
    check('a player may run one stall, and a rented stall cannot be rented again', again.ok === false && /already run/.test(again.msg) && taken.ok === false && /already rents/.test(taken.msg), `${again.msg} / ${taken.msg}`);
    const poor = await (async () => { SB().economy.marks = 100; await toStall(b, 2); const r = await b.action({ type: 'shop-rent', stall: 'port-2' }); SB().economy.marks = 3000; return r; })();
    check('renting without the marks is refused and nothing moves', poor.ok === false && /costs/.test(poor.msg) && !world.state.shops['port-2'] && SB().economy.marks === 3000);

    // ---- stocking: validations
    await toStall(a, 1);
    const noShip = (() => { const f = world.sims.get(SA().id).flight; const was = f.landed; f.landed = false; return () => { f.landed = was; }; })();
    const inAir = await a.action({ type: 'shop-stock', stall: 'port-1', good: 'water', qty: 5, price: 7 });
    noShip();
    check('stocking while the flagship is not landed at the port is refused, and the supplies stay aboard', inAir.ok === false && /landed/.test(inAir.msg) && SA().economy.inventory.water === 40 && !shop().listings.water, inAir.msg);
    const bads = [];
    for (const [qty, price, good] of [[0, 5, 'water'], [-3, 5, 'water'], [1.5, 5, 'water'], [NaN, 5, 'water'], ['5', 5, 'water'], [5, 0, 'water'], [5, 2.5, 'water'], [5, -1, 'water'], [5, 1e9, 'water'], [5, 5, 'plutonium'], [41, 5, 'water'], [500, 5, 'phobos-regolith'], [1, 5, 'phobos-core-sample']]) {
      const r = await a.action({ type: 'shop-stock', stall: 'port-1', good, qty, price });
      if (r.ok !== false) bads.push(`${qty}/${price}/${good}`);
    }
    check('nonsense stock requests (zero, negative, fractional, NaN, text, bad price, unknown good, more than you carry, samples) are all refused', bads.length === 0 && SA().economy.inventory.water === 40 && Object.keys(shop().listings).length === 0, bads.join());
    const stockNeighbour = await (async () => { await toStall(b, 1); return b.action({ type: 'shop-stock', stall: 'port-1', good: 'water', qty: 1, price: 5 }); })();
    check('another player cannot stock, price or close your stall', stockNeighbour.ok === false && /not your stall/.test(stockNeighbour.msg)
      && (await b.action({ type: 'shop-price', stall: 'port-1', good: 'water', price: 1 })).ok === false && (await b.action({ type: 'shop-close', stall: 'port-1' })).ok === false);

    // ---- stocking for real
    await toStall(a, 1);
    const okWater = await a.action({ type: 'shop-stock', stall: 'port-1', good: 'water', qty: 30, price: 7 });
    const okAlloy = await a.action({ type: 'shop-stock', stall: 'port-1', good: 'salvage-alloy', qty: 10, price: 45 });
    const okReg = await a.action({ type: 'shop-stock', stall: 'port-1', good: 'phobos-regolith', qty: 2, price: 35 });
    const okClay = await a.action({ type: 'shop-stock', stall: 'port-1', good: 'phobos-hydrated-clay', qty: 1 });
    const okParts = await a.action({ type: 'shop-stock', stall: 'port-1', good: 'parts', qty: 3, price: 200 });
    check('stocking moves goods from the ship to the stall: supplies by unit, alloy by 100 kg, regolith and clay by the tonne as the real lots (clay at the fair price by default)',
      [okWater, okAlloy, okReg, okClay, okParts].every((r) => r.ok) && SA().economy.inventory.water === 10 && SA().hold['salvage-alloy'] === 800 && SA().hold['phobos-regolith'] === 1000 && SA().hold['phobos-hydrated-clay'] === 200
      && Math.abs(SH.lotKg(shop().lots, 'phobos-regolith') - 2000) < 1e-9 && Math.abs(SH.lotKg(SA().holdLots, 'phobos-regolith') - 1000) < 1e-9
      && shop().listings['phobos-hydrated-clay'].price === SH.SHOP_GOODS['phobos-hydrated-clay'].fair && shop().listings.water.qty === 30,
      [okWater, okAlloy, okReg, okClay, okParts].map((r) => r.msg).join(' | '));
    check('matter and marks balance after stocking: every kilogram of dug material is somewhere (ship or stall), and no mark was made or lost except the rent (which moved to the dealer)',
      matterBooks() === mass0 && totalMarks() === m0);
    const repriced = await a.action({ type: 'shop-price', stall: 'port-1', good: 'water', price: 6 });
    check('the owner can change a price (whole marks only) and the stall shows it', repriced.ok && shop().listings.water.price === 6 && (await a.action({ type: 'shop-price', stall: 'port-1', good: 'water', price: 6.5 })).ok === false);

    // ---- another player buys
    await toStall(b, 1);
    const pubShops = JSON.stringify(world.publicState(pb.id).shops);
    check('the second client sees the shop, its sign and its prices in the shared snapshot, and no private fields', pubShops.includes('Jaron Salvage') && world.publicState(pb.id).shops['port-1'].listings.water.price === 6 && !pubShops.includes('deviceHash'));
    const bm = SB().economy.marks, am = SA().economy.marks, bw = SB().economy.inventory.water || 0;
    const buyId = '7f1c0000-0000-4000-8000-000000000001';
    const bought = await b.action({ type: 'shop-buy', stall: 'port-1', good: 'water', qty: 4, price: 6 }, buyId);
    check('buying 4 water at 6 marks: buyer -24 marks, owner +24, 4 units from the stall to the buyer\'s supplies, one receipt with the exact figures',
      bought.ok && SB().economy.marks === bm - 24 && SA().economy.marks === am + 24 && SB().economy.inventory.water === bw + 4 && shop().listings.water.qty === 26
      && bought.receipt && bought.receipt.total === 24 && bought.receipt.qty === 4 && bought.receipt.unitPrice === 6 && bought.receipt.good === 'water' && bought.receipt.shop === 'Jaron Salvage b& Co', JSON.stringify(bought));
    const retry = await b.action({ type: 'shop-buy', stall: 'port-1', good: 'water', qty: 4, price: 6 }, buyId);
    check('retrying the same action id returns the first receipt and charges nothing twice', retry.replay === true && retry.receipt?.n === bought.receipt.n && SB().economy.marks === bm - 24 && shop().listings.water.qty === 26 && shop().ledger.length === 1);
    const stale = await b.action({ type: 'shop-buy', stall: 'port-1', good: 'water', qty: 1, price: 5 });
    check('a stale price is refused: you are told the new one, and nothing moves', stale.ok === false && /price changed.*6 marks/.test(stale.msg) && shop().listings.water.qty === 26);
    const over = await b.action({ type: 'shop-buy', stall: 'port-1', good: 'water', qty: 27, price: 6 });
    const none = await b.action({ type: 'shop-buy', stall: 'port-1', good: 'oxygen', qty: 1, price: 18 });
    const frac = await b.action({ type: 'shop-buy', stall: 'port-1', good: 'water', qty: 1.5, price: 6 });
    const negq = await b.action({ type: 'shop-buy', stall: 'port-1', good: 'water', qty: -2, price: 6 });
    check('buying more than the stall has, a good it does not stock, a fraction, or a negative count is refused', [over, none, frac, negq].every((r) => r.ok === false) && /Only 26/.test(over.msg) && /sold out/.test(none.msg), [over, none, frac, negq].map((r) => r.msg).join(' | '));
    const keepB = SB().economy.marks; SB().economy.marks = 10;
    const broke = await b.action({ type: 'shop-buy', stall: 'port-1', good: 'phobos-regolith', qty: 1, price: 35 });
    SB().economy.marks = keepB;
    check('buying without enough marks is refused and the stall keeps its goods', broke.ok === false && /35 marks/.test(broke.msg) && shop().listings['phobos-regolith'].qty === 2 && Math.abs(SH.lotKg(shop().lots, 'phobos-regolith') - 2000) < 1e-9);
    const own = await a.action({ type: 'shop-buy', stall: 'port-1', good: 'water', qty: 1, price: 6 });
    check('you cannot buy from your own stall', own.ok === false && /own stall/.test(own.msg));
    await move(b, world.site.toWorld(-60, 0.02, 0));
    const farBuy = await b.action({ type: 'shop-buy', stall: 'port-1', good: 'water', qty: 1, price: 6 });
    check('buying from across the port is refused: you stand at the stall', farBuy.ok === false && /Walk over/.test(farBuy.msg) && shop().listings.water.qty === 26);
    await toStall(b, 1);

    // matter moves as exact lots, and a full hold refuses
    const matterBefore = matterBooks();
    const bl0 = SB().holdLots.length;
    const regBuy = await b.action({ type: 'shop-buy', stall: 'port-1', good: 'phobos-regolith', qty: 1, price: 35 });
    check('buying a tonne of Phobos regolith moves 1000 kg as real lots to the buyer\'s hold (and the hold total), the stall keeps 1000 kg of lots, and the ledger is unchanged to the bit',
      regBuy.ok && Math.abs(SH.lotKg(SB().holdLots, 'phobos-regolith') - 1000) < 1e-9 && SB().holdLots.length > bl0 && Math.abs(SB().hold['phobos-regolith'] - 1000) < 1e-9
      && Math.abs(SH.lotKg(shop().lots, 'phobos-regolith') - 1000) < 1e-9 && shop().listings['phobos-regolith'].qty === 1 && matterBooks() === matterBefore, regBuy.msg);
    SB().hold['filler'] = 23200;
    const full = await b.action({ type: 'shop-buy', stall: 'port-1', good: 'phobos-hydrated-clay', qty: 1, price: 90 });
    delete SB().hold['filler'];
    check('a hold with no room refuses the sale: no marks, no goods, no lots move', full.ok === false && /no room/.test(full.msg) && shop().listings['phobos-hydrated-clay'].qty === 1 && SH.lotKg(SB().holdLots, 'phobos-hydrated-clay') === 0 && matterBooks() === matterBefore);
    const alloy = await b.action({ type: 'shop-buy', stall: 'port-1', good: 'salvage-alloy', qty: 3, price: 45 });
    check('salvage alloy is sold by the 100 kg: 3 units take 300 kg out of the stall to the hold', alloy.ok && SB().hold['salvage-alloy'] === 300 && shop().listings['salvage-alloy'].qty === 7);
    check('after all of that, marks and matter are conserved: nothing was duplicated and nothing vanished', totalMarks() === m0 && matterBooks() === mass0, `${totalMarks() - m0} marks, ${Number(matterBooks() - mass0) / 2 ** 96} kg`);
    check('the owner sees every sale in the stall ledger with buyer, quantity, unit price and total', shop().ledger.length === 3 && shop().ledger.every((r) => r.total === r.qty * r.unit && r.kind === 'player' && r.buyer === 'Lilith') && shop().earned === 24 + 35 + 135 && shop().ledger.map((r) => r.n).join() === '1,2,3', JSON.stringify(shop().ledger.map((r) => [r.n, r.good, r.total])));

    // ---- unstock and the NPC market
    await toStall(a, 1);
    const back = await a.action({ type: 'shop-unstock', stall: 'port-1', good: 'water', qty: 6 });
    const tooMany = await a.action({ type: 'shop-unstock', stall: 'port-1', good: 'water', qty: 99 });
    check('the owner can take goods back to the hold; asking for more than is there is refused', back.ok && SA().economy.inventory.water === 16 && shop().listings.water.qty === 20 && tooMany.ok === false);
    // Jaron goes away: his socket closes. NPC buyers take what is priced fairly, within the daily demand.
    await a.action({ type: 'shop-price', stall: 'port-1', good: 'water', price: 6 });
    await a.action({ type: 'shop-price', stall: 'port-1', good: 'salvage-alloy', price: SH.npcCeiling('salvage-alloy') + 1 });
    await a.action({ type: 'shop-price', stall: 'port-1', good: 'phobos-regolith', price: SH.npcCeiling('phobos-regolith') });
    const online = world.sessions.has(a.id);
    world.advance(120);
    check('while the owner is online NPC buyers do not touch the stall (customers are players then)', online && shop().ledger.filter((r) => r.kind === 'npc').length === 0);
    a.close(); await new Promise((r) => setTimeout(r, 40)); await world.enqueue(() => {});
    const dealerBefore = world.state.market.marketMarks, ownerBefore = SA().economy.marks, waterBefore = shop().listings.water.qty, massBefore = matterBooks();
    world.advance(30 * 12);
    const npcRows = shop().ledger.filter((r) => r.kind === 'npc');
    const npcWater = npcRows.filter((r) => r.good === 'water').length, npcAlloy = npcRows.filter((r) => r.good === 'salvage-alloy').length, npcReg = npcRows.filter((r) => r.good === 'phobos-regolith').length;
    check(`while the owner is away, NPC buyers pay your price when it is at most ${SH.NPC_PRICE_TOLERANCE}x fair: water sold ${npcWater} units (daily demand ${SH.SHOP_GOODS.water.demand}), regolith ${npcReg}, nothing priced above the ceiling`,
      npcWater > 0 && npcWater <= SH.SHOP_GOODS.water.demand && npcAlloy === 0 && npcReg === 1 && shop().listings.water.qty === waterBefore - npcWater,
      `water ${npcWater} alloy ${npcAlloy} reg ${npcReg}`);
    const gain = npcRows.reduce((n, r) => n + r.total, 0);
    check('NPC sales pay the owner from the dealer fund to the mark, record a receipt line, and the regolith they bought leaves the world as exported mass (the books still balance)',
      SA().economy.marks === ownerBefore + gain && world.state.market.marketMarks === dealerBefore - gain && matterBooks() === massBefore && totalMarks() === m0, `${gain}`);
    const solBefore = shop().npcBought.water || 0;
    world.advance(30 * 12);
    check('NPC demand is capped per sol per stall: the same 6-mark water does not keep selling until it is gone', (shop().npcBought.water || 0) <= SH.SHOP_GOODS.water.demand && (shop().npcBought.water || 0) >= solBefore);
    // ---- rent lapses
    clock += 1000;
    check('the sales are in the shared snapshot for whoever opens the stall', world.publicState(pb.id).shops['port-1'].ledger.length >= 3 + npcRows.length);

    // ---- persistence: restart from the same file
    await world.commit();
    const saved = JSON.parse(JSON.stringify({ record: world.state }, (k, v) => (typeof v === 'bigint' ? String(v) : v)));
    const restored = await new Authority({ load: async () => ({ record: structuredClone(world.state), bricks: [] }), save: async () => {} }, { now: () => clock }).load();
    check('a restart keeps the shop exactly: owner, name, paid-up sol, listings, the lots behind them and the ledger', JSON.stringify(restored.state.shops['port-1']) === JSON.stringify(world.state.shops['port-1']) && saved.record.shops['port-1'].ownerId === a.id);

    // ---- lapse: pay-up time passes
    world.state.clock += SH.RENT_SOLS * SOL_SECONDS;
    await toStall(b, 1);
    const lateBuy = await b.action({ type: 'shop-buy', stall: 'port-1', good: 'water', qty: 1, price: 6 });
    const clockBefore = world.state.clock, rows = shop().ledger.length;
    world.advance(60);
    check('when the rent has run out the stall sells nothing to players or to NPC buyers, and keeps its goods', lateBuy.ok === false && /rent is paid/.test(lateBuy.msg) && shop().ledger.length === rows && world.state.clock > clockBefore);
    c = new TestClient(app.url, 'c'.repeat(48), 'Cole'); await c.connect();
    a = new TestClient(app.url, 'a'.repeat(48), 'Jaron'); await a.connect();
    await toStall(a, 1);
    const stockLate = await a.action({ type: 'shop-stock', stall: 'port-1', good: 'water', qty: 1 });
    const renewed = await a.action({ type: 'shop-renew', stall: 'port-1' });
    check('the owner must pay to stock a lapsed stall; renewing adds seven sols from today and charges the rent once', stockLate.ok === false && /rent/.test(stockLate.msg) && renewed.ok && shop().paidUntil > world.state.clock + (SH.RENT_SOLS - 0.1) * SOL_SECONDS && !SH.isLapsed(shop(), world.state.clock));
    const capped = await (async () => { for (let i = 0; i < 4; i++) { const r = await a.action({ type: 'shop-renew', stall: 'port-1' }); if (!r.ok) return r; } return { ok: true }; })();
    check(`renewing cannot run more than ${SH.MAX_AHEAD_SOLS} sols ahead`, capped.ok === false && /ahead/.test(capped.msg));

    // ---- close: everything comes home
    await a.action({ type: 'shop-stock', stall: 'port-1', good: 'water', qty: 5, price: 6 });
    const before = { water: SA().economy.inventory.water, reg: SH.lotKg(SA().holdLots, 'phobos-regolith'), alloy: SA().hold['salvage-alloy'] || 0 };
    const listed = { water: shop().listings.water?.qty || 0, reg: shop().listings['phobos-regolith']?.qty || 0, alloy: shop().listings['salvage-alloy']?.qty || 0 };
    const closed = await a.action({ type: 'shop-close', stall: 'port-1' });
    check('closing the stall brings every good home to the hold (supplies, alloy and the exact regolith lots), frees the stall, and keeps the books',
      closed.ok && !world.state.shops['port-1'] && SA().economy.inventory.water === before.water + listed.water && (SA().hold['salvage-alloy'] || 0) === before.alloy + listed.alloy * 100
      && totalMarks() - world.state.ships[world.state.players[c.id].shipId].economy.marks === m0 && matterBooks() === massBefore, `${closed.msg} water ${SA().economy.inventory.water} vs ${before.water + listed.water}; alloy ${SA().hold['salvage-alloy']} vs ${before.alloy + listed.alloy * 100}; marks ${totalMarks() - m0 - world.state.ships[world.state.players[c.id].shipId].economy.marks}; matter ${Number(matterBooks() - massBefore) / 2 ** 96}`);
    const rentAgain = await a.action({ type: 'shop-rent', stall: 'port-1', name: 'x' });
    check('a closed stall can be rented again, and a one-letter name falls back to "<name>\'s stall"', rentAgain.ok && world.state.shops['port-1'].name === "Jaron's stall");
    await a.action({ type: 'shop-close', stall: 'port-1' });

    // ---- ownership: leaving the world takes the shop (and its goods) with the character; the books of ships still balance
    await toStall(c, 3);
    await c.action({ type: 'shop-rent', stall: 'port-3', name: 'Cole' });
    const cShop = world.state.shops['port-3'];
    check('a third player can rent a different stall at the same time', !!cShop && cShop.ownerId === c.id && Object.keys(world.state.shops).length === 1);
    c.close(); await new Promise((r) => setTimeout(r, 30)); await world.enqueue(() => {});
    world.removePlayer(c.id);
    check('removing a character takes their stall with it (the stall is free again)', !world.state.shops['port-3']);
    check('an old save with no shops map loads with an empty one', (await new Authority({ load: async () => { const r = structuredClone(world.state); delete r.shops; return { record: r, bricks: [] }; }, save: async () => {} }, { now: () => clock }).load()).state.shops !== undefined);
  } catch (e) {
    check('shop scenario completes', false, e.stack || e.message);
  } finally {
    for (const k of [a, b, c]) try { k?.close(); } catch { /* closed */ }
    if (app) await app.close();
    await rm(dir, { recursive: true, force: true });
  }
  }

  // =====================================================================================================================
  section('44. Rover transport: up the wide ramp, locked into a berth, to Phobos, and off again (real flight rules, real authority)');
  // =====================================================================================================================
  const dir2 = await mkdtemp(join(tmpdir(), 'cosmos-hauler-'));
  let app2, p1, p2;
  let clock2 = Date.now();
  try {
    app2 = await startServer({ adapter: new FileAdapter(join(dir2, 'world.json')), port: 0, tick: false, now: () => clock2 });
    const world = app2.world;
    p1 = new TestClient(app2.url, 'h'.repeat(48), 'Hauler'); p2 = new TestClient(app2.url, 'k'.repeat(48), 'Rival');
    await p1.connect(); await p2.connect();
    const settle = async () => { await new Promise((r) => setTimeout(r, 6)); await world.enqueue(() => {}); };
    const move = async (client, worldPoint) => {
      const p = world.state.players[client.id], origin = { ...p.pose.worldPos };
      const dist = Math.hypot(worldPoint.x - origin.x, worldPoint.y - origin.y, worldPoint.z - origin.z), n = Math.max(1, Math.ceil(dist / 8));
      for (let i = 1; i <= n; i++) {
        clock2 += 1000;
        const pose = structuredClone(p.pose);
        for (const k of ['x', 'y', 'z']) pose.worldPos[k] = origin[k] + (worldPoint[k] - origin[k]) * i / n;
        pose.aboard = false; client.send({ type: 'pose', pose }); await settle();
      }
    };
    const walkIn = async (client, sw) => {
      const p = world.state.players[client.id], origin = { ...p.pose.sw };
      const dist = Math.hypot(sw.x - origin.x, sw.z - origin.z), n = Math.max(1, Math.ceil(dist / 8));
      for (let i = 1; i <= n; i++) {
        clock2 += 1000;
        const pose = structuredClone(p.pose); pose.aboard = true; pose.seat = null;
        pose.sw.x = origin.x + (sw.x - origin.x) * i / n; pose.sw.y = sw.y; pose.sw.z = origin.z + (sw.z - origin.z) * i / n; pose.sw.yaw = sw.yaw || 0; pose.sw.pitch = 0;
        client.send({ type: 'pose', pose }); await settle();
      }
    };
    const gas = async (client, throttle, steer = 0) => {
      clock2 += 200;
      client.send({ type: 'pose', pose: structuredClone(world.state.players[client.id].pose), vehicle: { throttle, steer } }); await settle();
    };
    // a refused action restores the whole state from a copy, so the records are re-read after every action, never held across one
    let P1, P2, S1, hauler, sim, rover, haulerId = null, roverId = null;
    const s1Id = world.state.players[p1.id].shipId;
    const refresh = () => { P1 = world.state.players[p1.id]; P2 = world.state.players[p2.id]; S1 = world.state.ships[s1Id]; hauler = haulerId && world.state.ships[haulerId]; sim = haulerId && world.sims.get(haulerId); rover = roverId && world.state.vehicles[roverId]; };
    const act = async (client, action) => { const r = await client.action(action); refresh(); return r; };
    refresh();
    S1.economy.marks = 200000;
    await move(p1, world.site.toWorld(-36, 0.02, 40 - 3));
    const bought = await act(p1, { type: 'buy-ship', shipType: 'hauler' });
    haulerId = Object.values(world.state.ships).find((q) => q.owner === p1.id && q.type === 'hauler')?.id; refresh();
    check(`the shipyard kiosk sells the Drayman for ${HD.stats.priceCredits} credits from the flagship account and delivers it to a new pad`,
      bought.ok && !!hauler && S1.economy.marks === 200000 - HD.stats.priceCredits * 4 && hauler.pad && hauler.pad.id !== S1.pad.id && hauler.economy.marks === 0, bought.msg);
    const refusedPoor = await act(p2, { type: 'buy-ship', shipType: 'hauler' });
    check('a pilot who is not at the kiosk, or cannot pay, gets no hauler', refusedPoor.ok === false && Object.values(world.state.ships).filter((q) => q.type === 'hauler').length === 1, refusedPoor.msg);
    world.advance(6);
    const def = sim.def;
    const flag = await act(p1, { type: 'set-flagship', shipId: hauler.id });
    hauler.economy.marks = 20000;
    check('the new hauler settles on its pad on all four legs and becomes the flagship', flag.ok && P1.shipId === hauler.id && sim.flight.landed && sim.flight.legs.filter((l) => l.contact).length === 4, flag.msg);
    // lower the vehicle ramp, as a pilot standing by the stern does
    const foot = sim.flight.toWorld(def.dock.rampFoot);
    await move(p1, foot);
    // a new ship stands on its pad with the ramp already down: only ask for it when it is not
    const rampReq = hauler.state.ramps.cargo.lowered ? { ok: true } : await act(p1, { type: 'ramp', key: 'cargo' });
    for (let i = 0; i < 60 && !hauler.state.ramps.cargo.lowered; i++) world.advance(0.5);
    const R = def.ramps.cargo, st = hauler.state.ramps.cargo, run = R.length * Math.cos(st.angle);
    check(`the wide ramp comes down: ${R.width} m wide, ${(st.angle * 57.3).toFixed(0)} degrees, its tip on the ground`, rampReq.ok && st.lowered && st.angle > 0.2 && st.angle < 0.5, rampReq.msg);

    // a rover bought at the depot (the hauler account pays), then placed at the foot of the ramp
    await move(p1, world.site.toWorld(-65, 0.02, 16.9));
    const buyRover = await act(p1, { type: 'buy-vehicle' });
    roverId = Object.values(world.state.vehicles).find((v) => v.owner === p1.id && !v.homeShipId)?.id; refresh();
    const { makePlanetEnv } = await import(base + 'vehicles/support.js');
    const { makeMoon } = await import(base + 'space/moonField.js');
    const planetEnv = makePlanetEnv(world.mars);
    const placeRoverAt = (v, localZ) => {
      // the ground under the foot of the ramp: try from just above the pad outwards (a query that starts too high above the ground is refused)
      let hit = null;
      for (const dy of [-2.0, -1.0, 0, -3.0, 1.0]) { const w = sim.flight.toWorld({ x: 0, y: dy, z: localZ }); hit = planetEnv.sample(w.x, w.y, w.z); if (hit) break; }
      if (!hit && process.env.CARGO_DEBUG) {
        for (let dy = -3; dy <= 2; dy += 0.5) {
          const w = sim.flight.toWorld({ x: 0, y: dy, z: localZ }), l = Math.hypot(w.x, w.y, w.z), g = FIELD.groundBelow(world.mars, w.x * (1 + 2.5 / l), w.y * (1 + 2.5 / l), w.z * (1 + 2.5 / l), 8);
          console.log('  diag dy', dy, 'groundBelow', g ? `${g.distance.toFixed(2)} inside ${g.startedInside}` : 'null', 'surfaceR - r', (FIELD.surfaceRadiusFast(world.mars, w.x / l, w.y / l, w.z / l) - l).toFixed(2));
        }
      }
      assert.ok(hit, `no ground under the foot of the ramp: pad ${JSON.stringify(hauler.pad)} ship ${JSON.stringify(sim.flight.pos)} agl ${sim.flight.agl} landed ${sim.flight.landed}`);
      v.parentShipId = null; v.frameId = 'mars'; v.pose = { x: hit.point.x, y: hit.point.y, z: hit.point.z, yaw: sim.flight.heading, pitch: 0, roll: 0, speed: 0 }; v.transfer = 0;
    };
    placeRoverAt(rover, R.hinge.z + run + 4);
    world.advance(0.3);
    await move(p1, (() => { const door = vehicleDef('survey').doors[0], at = localToFrame(rover.world, planetEnv.axes(rover.world), door.x, 0, door.z); return { x: at.x, y: at.y, z: at.z }; })());
    const took = await act(p1, { type: 'vehicle-board', vehicleId: rover.id, seat: 'driver' });
    let up = false, ticks = 0;
    for (; ticks < 120 && !up; ticks++) { await gas(p1, 1); world.advance(0.25); up = rover.parentShipId === hauler.id; }
    check(`the rover drives up the ramp and is parented to the hauler (${(ticks * 0.25).toFixed(0)} s)`, buyRover.ok && took.ok && up, `${buyRover.msg} ${took.msg} parent ${rover.parentShipId}`);
    for (let i = 0; i < 80; i++) { await gas(p1, 1); world.advance(0.25); if (rover.pose.z < 22) break; }
    for (let i = 0; i < 12; i++) { await gas(p1, 0); world.advance(0.25); }
    const deck = H.CARGO_DECK;
    check('it drives on up the hold aisle to a stop on the deck, inside the walls, clear of the freight', rover.parentShipId === hauler.id && rover.pose.z > deck.z0 + 2.1 && rover.pose.z < 28 && Math.abs(rover.pose.x) < deck.x1 - 1.2, JSON.stringify(rover.pose));
    const left = await act(p1, { type: 'vehicle-leave' });
    check('stepping out puts the driver on the hauler deck beside the rover', left.ok && P1.aboardShipId === hauler.id && P1.vehicleId === null && Math.abs(P1.pose.sw.z - rover.pose.z) < 4, left.msg);

    // others' rovers need the owner's leave
    const rival = createVehicle('survey', { id: 'rival-rover', owner: p2.id, pose: {} });
    world.state.vehicles[rival.id] = rival;
    placeRoverAt(rival, R.hinge.z + run - 0.4); rival.pose.speed = -2; world.vehicles._reattach(rival);
    const refused = rival.parentShipId === null;
    hauler.crewMayBoard = true; world.vehicles._reattach(rival);
    check("a stranger's rover will not roll aboard your hauler unless you allow boarding", refused && rival.parentShipId === hauler.id);
    delete world.state.vehicles[rival.id]; hauler.crewMayBoard = false;
    // capacity: six berths
    const fill = [];
    for (let i = 0; i < 5; i++) { const v = createVehicle('survey', { id: 'fill-' + i, owner: p1.id, parentShipId: hauler.id, pose: { x: -3.3, y: 0, z: 17 + i, yaw: Math.PI } }); world.state.vehicles[v.id] = v; fill.push(v); }
    const seventh = createVehicle('survey', { id: 'seventh', owner: p1.id, pose: {} }); world.state.vehicles[seventh.id] = seventh;
    placeRoverAt(seventh, R.hinge.z + run - 0.4); seventh.pose.speed = -2; world.vehicles._reattach(seventh);
    check('a hauler takes as many rovers as it has berths (six) and the seventh stays outside', Object.values(world.state.vehicles).filter((v) => v.parentShipId === hauler.id).length === 6 && seventh.parentShipId === null);
    for (const v of [...fill, seventh]) delete world.state.vehicles[v.id];

    // fly to Phobos
    await walkIn(p1, { x: 0, y: 0, z: 31, yaw: 0 });
    const rampUp = await act(p1, { type: 'ramp', key: 'cargo' });
    for (let i = 0; i < 60 && hauler.state.ramps.cargo.lowered; i++) world.advance(0.5);
    await walkIn(p1, { x: 0, y: 0, z: -9 }); await walkIn(p1, { x: -1.3, y: 0, z: -12 });
    const seat = await act(p1, { type: 'seat', seat: 'pilot' });
    check('the owner closes the ramp with the rover safely inside, walks to the flight deck and takes the pilot seat', rampUp.ok && !hauler.state.ramps.cargo.lowered && seat.ok && P1.pose.seat === 'pilot', `${rampUp.msg} ${seat.msg}`);
    const course = await act(p1, { type: 'engage', destination: 'phobos' });
    for (let i = 0; i < 40; i++) world.advance(0.5);
    const mid = rover.locked, midPose = structuredClone(rover.pose), berthId = rover.berth;
    const nearestBerth = H.BERTHS.reduce((a2, b2) => (Math.hypot(b2.x - midPose.x, b2.z - midPose.z) < Math.hypot(a2.x - midPose.x, a2.z - midPose.z) ? b2 : a2));
    check('the course starts: the ship leaves the ground and the rover is clamped into a berth (locked, speed zero, on the berth centre, nose to the stern or the bow)',
      course.ok && !sim.flight.landed && mid === true && !!berthId && nearestBerth.id === berthId && Math.abs(midPose.x - nearestBerth.x) < 1e-9 && Math.abs(midPose.z - nearestBerth.z) < 1e-9 && midPose.speed === 0
      && (Math.abs(Math.cos(midPose.yaw)) > 0.999), `${course.msg} locked ${mid} berth ${berthId} ${JSON.stringify(midPose)}`);
    // a passenger sits in the locked rover and floors it: nothing moves
    await act(p1, { type: 'seat', seat: null });
    world.state.vehicles[rover.id].passengers = { driver: p1.id }; P1.vehicleId = rover.id; P1.vehicleSeat = 'driver'; P1.aboardShipId = null; P1.pose.aboard = false; P1.pose.seat = null;
    const before = structuredClone(rover.pose);
    for (let i = 0; i < 12; i++) { await gas(p1, 1); world.advance(0.25); }
    check('flat out in flight, a clamped rover does not move at all', rover.locked && Math.hypot(rover.pose.x - before.x, rover.pose.z - before.z) === 0 && rover.parentShipId === hauler.id, JSON.stringify(rover.pose));
    rover.passengers = {}; P1.vehicleId = null; P1.vehicleSeat = null; P1.aboardShipId = hauler.id; P1.pose.aboard = true;
    let elapsed = 0; while (hauler.trip && elapsed < 15000) { world.advance(30); elapsed += 30; }
    check('the hauler reaches Phobos with the rover still locked in its berth and lands on its own pad there', hauler.frameId === 'phobos' && hauler.pose.landed === true && !hauler.trip, `frame ${hauler.frameId} landed ${hauler.pose?.landed} trip ${!!hauler.trip}`);
    check('the hauler has a pad of its own on each moon (Phobos and Deimos), the same allocation every ship gets, so the same trip works to either', !!hauler.moonPads?.phobos && !!hauler.moonPads?.deimos && hauler.moonPads.phobos.shipId === hauler.id && hauler.moonPads.deimos.id !== hauler.moonPads.phobos.id);
    world.advance(2);
    check('landing releases the clamps (unlocked, berth free) and the rover keeps its place on the deck', rover.locked === false && rover.berth === null && rover.parentShipId === hauler.id && Math.abs(rover.pose.x - nearestBerth.x) < 1e-9);

    // drive off on Phobos
    const rr = hauler.state.ramps.cargo.lowered ? { ok: true } : await act(p1, { type: 'ramp', key: 'cargo' });
    for (let i = 0; i < 60 && !hauler.state.ramps.cargo.lowered; i++) world.advance(0.5);
    await walkIn(p1, { x: rover.pose.x + 1.5, y: 0, z: rover.pose.z + 0.4, yaw: 0 });
    const climb = await act(p1, { type: 'vehicle-board', vehicleId: rover.id, seat: 'driver' });
    let off = false; const bearing = Math.cos(rover.pose.yaw) > 0 ? -1 : 1;   // nose to the bow: reverse out; nose to the stern: drive out. The ramp is as wide as the columns: straight out
    for (let i = 0; i < 300 && !off; i++) {
      await gas(p1, bearing); world.advance(0.25); off = rover.parentShipId === null;
      if (process.env.CARGO_DEBUG && i % 10 === 0) console.log('  .', i, JSON.stringify({ x: +rover.pose.x.toFixed(2), z: +rover.pose.z.toFixed(2), yaw: +rover.pose.yaw.toFixed(2), speed: +rover.pose.speed.toFixed(2) }), 'bearing', bearing);
    }
    const moonEnv = makePlanetEnv(makeMoon('phobos'));
    const hit = moonEnv.sample(rover.pose.x, rover.pose.y, rover.pose.z);
    check('with the ramp down on Phobos the rover drives down the ramp and off the hauler onto the moon ground, in the Phobos frame',
      rr.ok && climb.ok && off && rover.frameId === 'phobos' && !!hit && Math.hypot(rover.pose.x - hit.point.x, rover.pose.y - hit.point.y, rover.pose.z - hit.point.z) < 0.5, `off ${off} frame ${rover.frameId} ${climb.msg}`);
    const gone = await act(p1, { type: 'vehicle-leave' });
    check('the driver steps out onto Phobos', gone.ok && P1.frameId === 'phobos' && P1.vehicleId === null, gone.msg);
    // the books: a restart keeps the rover where it is
    await world.commit();
    const w3 = await new Authority({ load: async () => ({ record: structuredClone(world.state), bricks: [] }), save: async () => {} }, { now: () => clock2 }).load();
    check('a restart keeps the rover on Phobos, unlocked, with its berth cleared', w3.state.vehicles[rover.id].frameId === 'phobos' && w3.state.vehicles[rover.id].parentShipId === null && w3.state.vehicles[rover.id].locked === false);
  } catch (e) {
    check('rover transport scenario completes', false, e.stack || e.message);
  } finally {
    for (const k of [p1, p2]) try { k?.close(); } catch { /* closed */ }
    if (app2) await app2.close();
    await rm(dir2, { recursive: true, force: true });
  }
}
