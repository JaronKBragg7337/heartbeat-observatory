// Server tick cost of free flight: N ships coasting or burning in free flight against N ships resting on their pads. Prints ms per 30 Hz tick.
//   node test/perf-freeflight.mjs [ships=24]
import '../server/runtime.mjs';
import { mkdtemp, rm } from 'node:fs/promises'; import { tmpdir } from 'node:os'; import { join } from 'node:path';
import { startServer } from '../server/index.mjs'; import { FileAdapter } from '../server/storage.mjs'; import { TestClient } from './multiplayer-checks.mjs';
const N = Number(process.argv[2] || 24), MARS_R = 3_389_500, MU = 6.6743e-11 * 6.417e23;
const dir = await mkdtemp(join(tmpdir(), 'cosmos-ffperf-')); let clock = Date.now(); let app; const clients = [];
try {
  app = await startServer({ adapter: new FileAdapter(join(dir, 'w.json')), port: 0, tick: false, now: () => clock });
  for (let i = 0; i < N; i++) { const c = new TestClient(app.url, String(i).padStart(2, '0').repeat(24), 'P' + i); await c.connect(); clients.push(c); }
  const world = app.world;
  const measure = async (label, ticks = 300) => { await world.enqueue(() => { for (let i = 0; i < 30; i++) { clock += 33; world.advance(1 / 30); } });
    const t0 = performance.now(); await world.enqueue(() => { for (let i = 0; i < ticks; i++) { clock += 33; world.advance(1 / 30); } }); const ms = (performance.now() - t0) / ticks; console.log(label.padEnd(58), ms.toFixed(3), 'ms per tick'); return ms; };
  const raiders = [...world.sims.values()].filter((s) => s.record.npc).length;
  const resting = await measure(`${N} players' ships resting on pads (+${raiders} raiders)`);
  await world.enqueue(() => { clients.forEach((c, i) => { const p = world.state.players[c.id], rec = world.state.ships[p.shipId], sim = world.sims.get(rec.id); const r = MARS_R + 400_000 + i * 1000, th = i * 0.2, vc = Math.sqrt(MU / r);
    sim.flight.landed = false; sim.flight.airborne = true; sim.flight.gearPos = 0; sim.flight.pos = { x: r * Math.cos(th), y: 0, z: -r * Math.sin(th) }; sim.flight.vel = { x: -vc * Math.sin(th), y: 0, z: -vc * Math.cos(th) };
    sim.ff.enabled = true; sim.ff._install(); }); });
  const coast = await measure(`${N} ships in free flight, coasting at x1`);
  await world.enqueue(() => { for (const s of world.sims.values()) if (s.ff.active) s.ff.setWarp(500); });
  const warp = await measure(`${N} ships in free flight, coasting at x500`);
  await world.enqueue(() => { for (const s of world.sims.values()) if (s.ff.active) { s.ff.setWarp(1); s.ff.setAssist('prograde'); } });
  for (const s of world.sims.values()) if (s.ff.active) s.ff.setInput({ thr: 1 });
  // the input comes through the lease in the game; here hold a burn directly by re-asserting it each tick
  const t0 = performance.now(); await world.enqueue(() => { for (let i = 0; i < 300; i++) { clock += 33; for (const s of world.sims.values()) if (s.ff.active) s.ff.input.thr = 1; world.advance(1 / 30); } });
  const burn = (performance.now() - t0) / 300; console.log(`${N} ships burning the drive at x1`.padEnd(58), burn.toFixed(3), 'ms per tick');
  console.log(JSON.stringify({ ships: N, restingMs: +resting.toFixed(3), coastMs: +coast.toFixed(3), warp500Ms: +warp.toFixed(3), burnMs: +burn.toFixed(3), budgetMs: 33.3 }));
} finally { for (const c of clients) c.close(); if (app) await app.close(); await rm(dir, { recursive: true, force: true }); }
