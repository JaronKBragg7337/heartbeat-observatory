// Server tick cost with cargo on a copy of the live world: the same world, then six of its players' flagships turned into parked Draymans with
// six rovers each (36 clamped or parked rovers) and six stocked shops (half the owners offline so the NPC pass has work to look at).
//   node test/perf-export-live.mjs perf/live-world.json     (read-only copy of the live world)
//   node test/perf-cargo.mjs perf/live-world.json [seconds]
import '../server/runtime.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { stringify, parse } from '../src/world-state/wire.js';
const { Authority } = await import('../server/authority.mjs');
const { FileAdapter } = await import('../server/storage.mjs');
const { createVehicle } = await import('../src/vehicles/api.js');
const { STALLS, RENT_SOLS } = await import('../src/economy/shops.js');
const { SOL_SECONDS } = await import('../src/economy/catalog.js');
const { shipDef } = await import('../src/ships/registry.js');

const src = process.argv[2], secs = Number(process.argv[3] || 20), tmp = src + '.cargo.json';
const world = parse(readFileSync(src, 'utf8')), rec = world.record;
const owners = Object.values(rec.players).filter((p) => rec.ships[p.shipId] && !rec.ships[p.shipId].npc && rec.ships[p.shipId].type === 'meridian').slice(0, 6);
const def = shipDef('hauler'); let n = 0;
owners.forEach((p, i) => {
  const ship = rec.ships[p.shipId]; ship.type = 'hauler';
  for (let k = 0; k < 6; k++) { const b = def.berths[k]; const v = createVehicle('survey', { id: `perf-${i}-${k}`, owner: p.id, parentShipId: ship.id, pose: { x: b.x, y: 0, z: b.z, yaw: b.yaw } }); rec.vehicles[v.id] = v; n++; }
  rec.shops = rec.shops || {};
  rec.shops[STALLS[i].id] = { id: STALLS[i].id, ownerId: p.id, ownerName: p.name, name: `Perf shop ${i}`, rentedAt: rec.clock, paidUntil: rec.clock + RENT_SOLS * SOL_SECONDS, seq: 0, earned: 0, npcSol: 0, npcBought: {}, nextNpcAt: 0, ledger: [], lots: [],
    listings: { water: { qty: 400, price: 6 }, food: { qty: 300, price: 9 }, 'salvage-alloy': { qty: 30, price: 40 } } };
});
writeFileSync(tmp, stringify(world));
const t0 = performance.now();
const w = await new Authority(new FileAdapter(tmp), { now: Date.now }).load();
console.log(`cargo world: ${owners.length} haulers, ${n} rovers, ${Object.keys(w.state.shops).length} shops; load+catchup ${(performance.now() - t0).toFixed(0)} ms; ships ${Object.keys(w.state.ships).length}`);
const times = [];
for (let i = 0; i < secs * 30; i++) { const a = performance.now(); w.advance(1 / 30); times.push(performance.now() - a); }
times.sort((a, b) => a - b);
const avg = times.reduce((a, b) => a + b, 0) / times.length;
console.log(`advance(1/30): avg ${avg.toFixed(2)} ms  p50 ${times[times.length >> 1].toFixed(2)}  p95 ${times[Math.floor(times.length * 0.95)].toFixed(2)}  max ${times.at(-1).toFixed(2)}`);
const c0 = performance.now(); await w.commit(); console.log('commit ms', (performance.now() - c0).toFixed(1));
const ps = performance.now(); for (let i = 0; i < 20; i++) w.publicState(Object.keys(w.state.players)[0]); console.log('publicState ms each', ((performance.now() - ps) / 20).toFixed(2));
console.log('npc sales so far', Object.values(w.state.shops).reduce((n2, s) => n2 + s.ledger.filter((r) => r.kind === 'npc').length, 0));
process.exit(0);
