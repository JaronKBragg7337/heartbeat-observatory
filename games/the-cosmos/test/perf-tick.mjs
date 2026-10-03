// Server tick cost on a copy of the live world. node test/perf-tick.mjs <world.json> [seconds]
import '../server/runtime.mjs';
import { copyFileSync } from 'node:fs';
const { Authority } = await import('../server/authority.mjs');
const { FileAdapter } = await import('../server/storage.mjs');
const src = process.argv[2], secs = Number(process.argv[3] || 20);
const tmp = src + '.run.json'; copyFileSync(src, tmp);
let t0 = performance.now();
const w = await new Authority(new FileAdapter(tmp), { now: Date.now }).load();
console.log('load+catchup ms', (performance.now() - t0).toFixed(0), 'ships', Object.keys(w.state.ships).length, 'npc', Object.values(w.state.ships).filter(s => s.npc).length, 'vehicles', Object.keys(w.state.vehicles || {}).length);
const times = []; const prof = {};
for (let i = 0; i < secs * 30; i++) { const a = performance.now(); w.advance(1 / 30); times.push(performance.now() - a); }
times.sort((a, b) => a - b);
const avg = times.reduce((a, b) => a + b, 0) / times.length;
console.log(`advance(1/30): avg ${avg.toFixed(2)} ms  p50 ${times[times.length >> 1].toFixed(2)}  p95 ${times[Math.floor(times.length * .95)].toFixed(2)}  max ${times.at(-1).toFixed(2)}`);
const c0 = performance.now(); const bs = await w.commit(); console.log('commit ms', (performance.now() - c0).toFixed(1));
const ps = performance.now(); for (let i = 0; i < 20; i++) w.publicState(Object.keys(w.state.players)[0]); console.log('publicState ms each', ((performance.now() - ps) / 20).toFixed(2));
