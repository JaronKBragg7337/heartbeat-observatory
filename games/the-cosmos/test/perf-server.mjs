// Live-world server load: the exported live world (26 ships, 3 raiders, rovers) + 4 connected clients, real 30 Hz tick, real broadcasts.
// usage: node test/perf-server.mjs <live-world.json> [seconds]   (never touches Supabase)
import { copyFileSync } from 'node:fs';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { startServer } from '../server/index.mjs';
import { FileAdapter } from '../server/storage.mjs';
import { TestClient } from './multiplayer-checks.mjs';
const src = process.argv[2], secs = Number(process.argv[3] || 30), tmp = src + '.srv.json'; copyFileSync(src, tmp);
const app = await startServer({ adapter: new FileAdapter(tmp), port: 0 });
const port = new URL(app.url.replace('ws:', 'http:')).port;
const clients = []; for (let i = 0; i < 4; i++) { const c = new TestClient(app.url, String(i).repeat(48), 'Perf' + i); await c.connect(); clients.push(c); }
const h = monitorEventLoopDelay({ resolution: 5 }); h.enable();
const lat = []; let stop = false;
const poser = setInterval(() => { for (const c of clients) { const p = app.world.state.players[c.id]; if (!p) continue; const pose = structuredClone(p.pose); pose.worldPos.x += Math.sin(Date.now() / 700) * .05; c.send({ type: 'pose', pose }); } }, 50);
(async () => { while (!stop) { const t = performance.now(); const r = await fetch(`http://127.0.0.1:${port}/health`); await r.json(); lat.push(performance.now() - t); await new Promise(r => setTimeout(r, 200)); } })();
await new Promise(r => setTimeout(r, secs * 1000)); stop = true; clearInterval(poser); h.disable();
const hh = await (await fetch(`http://127.0.0.1:${port}/health`)).json();
lat.sort((a, b) => a - b);
console.log('ships', Object.keys(app.world.state.ships).length, 'players', Object.keys(app.world.state.players).length, 'clients', clients.length);
console.log('server tick (advance only) avg/max ms:', hh.tick.avgMs, hh.tick.maxMs);
console.log(`event-loop delay ms: mean ${(h.mean / 1e6).toFixed(2)} p99 ${(h.percentile(99) / 1e6).toFixed(2)} max ${(h.max / 1e6).toFixed(2)}`);
console.log(`/health latency ms: p50 ${lat[lat.length >> 1].toFixed(1)} max ${lat.at(-1).toFixed(1)} (n=${lat.length})`);
console.log('cpu%', (process.cpuUsage().user + process.cpuUsage().system) / 1000 / (secs * 1000 + 3000) * 100 | 0);
for (const c of clients) c.close(); await app.close(); process.exit(0);
