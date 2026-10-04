// World 2 (Ceres) trips in the real authority (no browser): Mars -> Ceres (by the long-range drive: F3 retired the Ore Lane) -> Mars port, each must END
// landed in the right frame, with nothing taken from the ship's account (there is no lane fee any more).
//   node test/world2-trips.mjs
import './../server/runtime.mjs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Authority } from '../server/authority.mjs';
import { FileAdapter } from '../server/storage.mjs';

export async function runWorld2Trips({ check, log = () => {} } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'cosmos-world2-'));
  let clock = Date.now(); const now = () => clock;
  const world = await new Authority(new FileAdapter(join(dir, 'world.json')), { now, verify: null }).load();
  const p = world.createPlayer('e'.repeat(48), 'World2 QA', 'isaiah', 0, { ephemeral: true });
  const sim = world.sims.get(p.shipId), ship = world.state.ships[p.shipId];
  const seatPlayer = () => { p.aboardShipId = ship.id; p.currentShipId = ship.id; p.pose.aboard = true; p.frameId = sim.frameId; const seat = sim.def.seats.find((s) => s.id === 'pilot'); p.pose.seat = 'pilot'; Object.assign(p.pose.sw, { x: seat.x, y: seat.y, z: seat.z }); };
  const results = {};
  const fly = (dest, maxSimS = 20000) => {
    seatPlayer();
    const marks0 = ship.economy.marks;
    let err = null; try { world.reduce(p, { type: 'engage', destination: dest }); world.reduce(p, { type: 'trip-warp', warp: 60 }); } catch (e) { err = e.message; }
    if (err) return { dest, err };
    const t0 = world.state.clock; const phases = []; let spoolFrames = 0, frames = new Set();
    while (sim.trip && sim.trip.active && world.state.clock - t0 < maxSimS) {
      const ph = sim.trip.phase + (sim.trip.phase === 'transit' ? sim.trip.leg : ''); if (phases[phases.length - 1] !== ph) phases.push(ph);
      if (sim.trip.phase === 'spool') spoolFrames++;
      frames.add(sim.frameId);
      if (sim.trip.phase === 'longdrive') { if (sim.trip.warp !== 14400) sim.trip.setWarp(14400); } else if (sim.trip.warp !== 60) sim.trip.setWarp(60);
      world.advance(1 / 30); clock += 33;
    }
    for (let i = 0; i < 300 && !sim.flight.landed && !sim.trip; i++) { world.advance(1 / 30); clock += 33; }
    return { dest, phases, frames: [...frames], frame: sim.frameId, landed: sim.flight.landed, tripLeft: !!sim.trip, simS: Math.round(world.state.clock - t0), spoolS: +(spoolFrames / 30).toFixed(1), fee: (marks0 - ship.economy.marks) / 4, arrival: ship.arrival, pos: { ...sim.flight.pos } };
  };
  results.out = fly('ceres'); log(JSON.stringify(results.out));
  // the trade, in the real authority: ore from the hold sold at the foundry by someone standing at the foreman
  {
    const { makeMoon } = await import('../src/space/moonField.js');
    const { WORKERS, outpostToFrame } = await import('../src/worlds/ceres/layout.js');
    const pi = makeMoon('ceres').padInfo, fm = WORKERS.find((w) => w.id === 'foreman');
    p.aboardShipId = null; p.pose.aboard = false; p.pose.seat = null; p.frameId = 'ceres';
    ship.hold['ceres-ore'] = 2000;
    ship.holdLots = [{ lotId: 'q', materialId: 'MAT-CERES-ORE', materialName: 'Ferro-nickel ore', massKg: 2000, solidVolumeM3: 0.46, looseVolumeM3: 0.7, parts: [{ materialId: 'MAT-CERES-ORE', massKg: 2000, volumeM3: 0.46 }] }];
    const marks0 = ship.economy.marks;
    p.pose.worldPos = outpostToFrame(pi, 40, 0, 40);
    let far = null; try { world.reduce(p, { type: 'world2-sale', kind: 'matter', item: 'ceres-ore', where: 'ceres', worker: 'foreman', tonnes: 1 }); } catch (e) { far = e.message; }
    p.pose.worldPos = outpostToFrame(pi, fm.x + 1, 0.02, fm.z + 1.5);
    let ok = null, err = null; try { ok = world.reduce(p, { type: 'world2-sale', kind: 'matter', item: 'ceres-ore', where: 'ceres', worker: 'foreman', tonnes: 1 }); } catch (e) { err = e.message; }
    results.sale = { far, ok, err, paid: ship.economy.marks - marks0, hold: ship.hold['ceres-ore'], lots: (ship.holdLots || []).reduce((n, l) => n + l.massKg, 0) };
    log(JSON.stringify(results.sale));
    p.aboardShipId = null; seatPlayer();
  }
  results.home = fly('port'); log(JSON.stringify(results.home));
  if (check) {
    const ok = (r, frame) => r && !r.err && r.frame === frame && r.landed && !r.tripLeft;
    check('a ship flown from the port to Ceres flies there by the long-range drive and ends the trip landed in the frame of Ceres', ok(results.out, 'ceres') && results.out.phases.includes('longdrive'), JSON.stringify(results.out));
    check('there was no spool and no lane fee: nothing was taken from the account', results.out && results.out.spoolS === 0 && results.out.fee === 0 && !results.out.phases.includes('spool'), JSON.stringify(results.out));
    check('the foreman buys a tonne of ore from the hold for about 130 marks (F4: the world price factor and tax move it, 100 to 135) when you stand at him, and refuses from 50 m away', results.sale && !!results.sale.far && results.sale.ok && results.sale.ok.ok && results.sale.paid >= 100 && results.sale.paid <= 135 && Math.abs(results.sale.hold - 1000) < 1e-6 && Math.abs(results.sale.lots - 1000) < 1e-6, JSON.stringify(results.sale));
    check('from Ceres a course to Marineris Port flies back and ends landed at Mars', ok(results.home, 'mars') && results.home.phases.includes('longdrive'), JSON.stringify(results.home));
    check('the way home is free too', results.home && results.home.fee === 0, JSON.stringify(results.home));
  }
  return results;
}
if (process.argv[1] && process.argv[1].endsWith('world2-trips.mjs')) {
  let fails = 0; const check = (n, c, d = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : '  ' + d)); if (!c) fails++; };
  await runWorld2Trips({ check, log: console.log }); process.exit(fails ? 1 : 0);
}
