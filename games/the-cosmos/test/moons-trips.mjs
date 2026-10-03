// Moon trips in the real authority (no browser): Mars -> Phobos -> Deimos -> Mars, each must END landed in the right frame, and
// from each moon the ship must be able to lift off again (the playtester found "trip ended but the ship is not on Deimos").
//   node test/moons-trips.mjs
import './../server/runtime.mjs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Authority } from '../server/authority.mjs';
import { FileAdapter } from '../server/storage.mjs';

export async function runMoonTrips({ check, log = () => {} } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'cosmos-moons-'));
  let clock = Date.now(); const now = () => clock;
  const world = await new Authority(new FileAdapter(join(dir, 'world.json')), { now, verify: null }).load();
  const p = world.createPlayer('d'.repeat(48), 'Moon QA', 'isaiah', 0, { ephemeral: true });
  const sim = world.sims.get(p.shipId), ship = world.state.ships[p.shipId];
  const results = {};
  const seatPlayer = () => { p.aboardShipId = ship.id; p.currentShipId = ship.id; p.pose.aboard = true; p.frameId = sim.frameId; const seat = sim.def.seats.find((s) => s.id === 'pilot'); p.pose.seat = 'pilot'; Object.assign(p.pose.sw, { x: seat.x, y: seat.y, z: seat.z, yaw: 0 }); sim.flight.toWorld(p.pose.sw, p.pose.worldPos); };
  const fly = (dest, maxSimS = 4000) => {
    seatPlayer();
    let err = null; try { world.reduce(p, { type: 'engage', destination: dest }); world.reduce(p, { type: 'trip-warp', warp: 60 }); } catch (e) { err = e.message; }
    if (err) return { dest, err };
    const t0 = world.state.clock; let phases = [];
    while (sim.trip && sim.trip.active && world.state.clock - t0 < maxSimS) {
      const ph = sim.trip.phase; if (phases[phases.length - 1] !== ph) phases.push(ph);
      if (sim.trip.warp !== 60) sim.trip.setWarp(60);
      world.advance(1 / 30); clock += 33;
    }
    for (let i = 0; i < 300 && !sim.flight.landed && !sim.trip; i++) { world.advance(1 / 30); clock += 33; }
    return { dest, phases, frame: sim.frameId, landed: sim.flight.landed, tripLeft: !!sim.trip, simS: Math.round(world.state.clock - t0), arrival: ship.arrival };
  };
  for (const dest of ['phobos', 'deimos', 'phobos', 'orbit']) { const r = fly(dest); results[dest + (results[dest] ? '2' : '')] = r; log(JSON.stringify(r)); }
  const ok = (r, frame) => r && !r.err && r.frame === frame && r.landed && !r.tripLeft;
  if (check) {
    check('a ship flown from the port to Phobos ends the trip landed in Phobos\'s frame', ok(results.phobos, 'phobos'), JSON.stringify(results.phobos));
    check('from Phobos a course to Deimos ends landed in Deimos\'s frame', ok(results.deimos, 'deimos'), JSON.stringify(results.deimos));
    check('from Deimos a course back to Phobos ends landed in Phobos\'s frame', ok(results.phobos2, 'phobos'), JSON.stringify(results.phobos2));
  }
  return results;
}
if (process.argv[1] && process.argv[1].endsWith('moons-trips.mjs')) {
  let fails = 0; const check = (n, c, d = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : '  ' + d)); if (!c) fails++; };
  await runMoonTrips({ check, log: console.log }); process.exit(fails ? 1 : 0);
}
