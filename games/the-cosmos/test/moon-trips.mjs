// The Moon's trips in the real authority (no browser): Mars -> the Moon's hub (across the lane, one fee) -> Shackleton -> Daedalus (hops inside the Moon's own region,
// no lane fee) -> Mars port. Each must END landed in the right frame. Then the trade: ice sold from the hold at the hub's water office, supplies bought and sold at a
// vendor, and a seat's person refusing nobody. WD-MOON.
//   node test/moon-trips.mjs
import './../server/runtime.mjs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Authority } from '../server/authority.mjs';
import { FileAdapter } from '../server/storage.mjs';

export async function runMoonTrips({ check, log = () => {} } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'cosmos-moon-'));
  let clock = Date.now(); const now = () => clock;
  const world = await new Authority(new FileAdapter(join(dir, 'world.json')), { now, verify: null }).load();
  const p = world.createPlayer('f'.repeat(48), 'Moon QA', 'isaiah', 0, { ephemeral: true });
  const sim = world.sims.get(p.shipId), ship = world.state.ships[p.shipId];
  const seatPlayer = () => { p.aboardShipId = ship.id; p.currentShipId = ship.id; p.pose.aboard = true; p.frameId = sim.frameId; const seat = sim.def.seats.find((s) => s.id === 'pilot'); p.pose.seat = 'pilot'; Object.assign(p.pose.sw, { x: seat.x, y: seat.y, z: seat.z }); };
  const results = {};
  const fly = (dest, maxSimS = 12000) => {
    seatPlayer();
    const marks0 = ship.economy.marks;
    let err = null; try { world.reduce(p, { type: 'engage', destination: dest }); world.reduce(p, { type: 'trip-warp', warp: 60 }); } catch (e) { err = e.message; }
    if (err) return { dest, err };
    const t0 = world.state.clock; const phases = []; let spoolFrames = 0; const frames = new Set();
    while (sim.trip && sim.trip.active && world.state.clock - t0 < maxSimS) {
      const ph = sim.trip.phase + (sim.trip.phase === 'transit' ? sim.trip.leg : ''); if (phases[phases.length - 1] !== ph) phases.push(ph);
      if (sim.trip.phase === 'spool') spoolFrames++;
      frames.add(sim.frameId);
      if (sim.trip.phase !== 'spool' && sim.trip.warp !== 60) sim.trip.setWarp(60);
      world.advance(1 / 30); clock += 33;
    }
    for (let i = 0; i < 300 && !sim.flight.landed && !sim.trip; i++) { world.advance(1 / 30); clock += 33; }
    return { dest, phases, frames: [...frames], frame: sim.frameId, landed: sim.flight.landed, tripLeft: !!sim.trip, simS: Math.round(world.state.clock - t0), spoolS: +(spoolFrames / 30).toFixed(1), fee: (marks0 - ship.economy.marks) / 4 };
  };
  results.out = fly('moon'); log(JSON.stringify(results.out));
  results.toShack = fly('moon-shackleton'); log(JSON.stringify(results.toShack));
  // the ice: sold at the hub's water office, by someone standing at the clerk, from a hold with lots in it. First the dock at Shackleton (the lower price), then a hop to the hub.
  const { makeMoon } = await import('../src/space/moonField.js');
  const { frameToOutpost, outpostToFrame } = await import('../src/worlds/moon/place.js');
  const { castOf } = await import('../src/worlds/moon/cast.js');
  const ICE = { lotId: 'ice1', materialId: 'MAT-MOON-ICE', materialName: 'Lunar polar ice', massKg: 2000, solidVolumeM3: 1.2, looseVolumeM3: 1.9, parts: [{ materialId: 'MAT-MOON-ICE', massKg: 2000, volumeM3: 1.2 }] };
  const stand = (frame, who, dx = 1, dz = 1.5) => { const w = castOf(frame).find((q) => q.id === who); p.aboardShipId = null; p.pose.aboard = false; p.pose.seat = null; p.frameId = frame; p.pose.worldPos = outpostToFrame(makeMoon(frame).padInfo, w.x + dx, 0.02, w.z + dz); };
  {
    ship.hold['moon-ice'] = 2000; ship.holdLots = [structuredClone(ICE)];
    const marks0 = ship.economy.marks; let far = null, ok = null, err = null;
    p.pose.worldPos = outpostToFrame(makeMoon('moon-shackleton').padInfo, 30, 0.02, 60); p.frameId = 'moon-shackleton'; p.aboardShipId = null; p.pose.aboard = false; p.pose.seat = null;
    try { world.reduce(p, { type: 'moon-trade', op: 'sell-ice', where: 'ice-dock', worker: 's-ice', tonnes: 1 }); } catch (e) { far = e.message; }
    stand('moon-shackleton', 's-ice', 1, 1.5);
    try { ok = world.reduce(p, { type: 'moon-trade', op: 'sell-ice', worker: 's-ice', tonnes: 1 }); } catch (e) { err = e.message; }
    results.dock = { far, ok, err, paid: ship.economy.marks - marks0, hold: ship.hold['moon-ice'], lots: (ship.holdLots || []).reduce((n, l) => n + l.massKg, 0) };
    log(JSON.stringify(results.dock));
  }
  results.toHub = fly('moon'); log(JSON.stringify(results.toHub));
  {
    const marks0 = ship.economy.marks; let wrong = null, ok = null, err = null;
    stand('moon', 'h-water', 1, 1.5);
    try { ok = world.reduce(p, { type: 'moon-trade', op: 'sell-ice', worker: 'h-water', tonnes: 1 }); } catch (e) { err = e.message; }
    results.hub = { ok, err, paid: ship.economy.marks - marks0, hold: ship.hold['moon-ice'] };
    log(JSON.stringify(results.hub));
    // a shop: buy a kit of water, sell it back for half
    stand('moon', 'h-shop', 1, 1.5);
    const m1 = ship.economy.marks; let buy = null, sell = null, serr = null;
    try { buy = world.reduce(p, { type: 'moon-trade', op: 'buy', worker: 'h-shop', good: 'water', n: 5 }); sell = world.reduce(p, { type: 'moon-trade', op: 'sell', worker: 'h-shop', good: 'water', n: 5 }); } catch (e) { serr = e.message; }
    results.shop = { buy, sell, serr, net: ship.economy.marks - m1, water: ship.economy.inventory.water };
    log(JSON.stringify(results.shop));
  }
  seatPlayer();
  results.toDae = fly('moon-daedalus'); log(JSON.stringify(results.toDae));
  results.home = fly('port'); log(JSON.stringify(results.home));
  if (check) {
    const ok = (r, frame) => r && !r.err && r.frame === frame && r.landed && !r.tripLeft;
    check('a ship flown from the port to the Moon crosses the lane and ends the trip landed in the hub frame', ok(results.out, 'moon'), JSON.stringify(results.out));
    check('the way out cost one spool of the full 20 cabin seconds and one lane fee of 120 credits', results.out && Math.abs(results.out.spoolS - 20) < 1.2 && results.out.fee === 120, JSON.stringify(results.out));
    check('from the hub a course to Shackleton Base is a hop in the Moon\'s own region: landed in the Shackleton frame, no spool and no lane fee', ok(results.toShack, 'moon-shackleton') && results.toShack.spoolS === 0 && results.toShack.fee === 0, JSON.stringify(results.toShack));
    check('the dock master buys a tonne of lunar ice from the hold (about 250 marks: F4 and the tax move it) when you stand at her, and refuses from afar', results.dock && !!results.dock.far && results.dock.ok && results.dock.paid > 150 && results.dock.paid < 320 && results.dock.hold === 1000 && results.dock.lots === 1000, JSON.stringify(results.dock));
    check('a hop back to the hub is free of the lane fee', ok(results.toHub, 'moon') && results.toHub.fee === 0, JSON.stringify(results.toHub));
    check('the hub\'s water office pays more for a tonne than the Fortis dock did', results.hub && results.hub.ok && results.hub.paid > results.dock.paid, JSON.stringify(results.hub));
    check('the mercantile sells five water at its shelf and buys them back for less (no free money), through the real authority', results.shop && !results.shop.serr && results.shop.net < 0 && results.shop.water === 0, JSON.stringify(results.shop));
    check('from the hub a course to Daedalus Station ends landed in its frame, still no lane fee', ok(results.toDae, 'moon-daedalus') && results.toDae.fee === 0, JSON.stringify(results.toDae));
    check('from Daedalus a course to Marineris Port crosses back and ends landed at Mars for one more fee', ok(results.home, 'mars') && results.home.fee === 120, JSON.stringify(results.home));
  }
  return results;
}
if (process.argv[1] && process.argv[1].endsWith('moon-trips.mjs')) {
  let fails = 0; const check = (n, c, d = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : '  ' + d)); if (!c) fails++; };
  await runMoonTrips({ check, log: console.log }); process.exit(fails ? 1 : 0);
}
