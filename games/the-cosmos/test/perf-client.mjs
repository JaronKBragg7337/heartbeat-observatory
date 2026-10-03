// Client frame cost at the port with ~25 ships: JS profile + draw calls, on a copy of the live world (isolated authority, never Supabase).
//   node test/perf-client.mjs <live-world.json> [seconds]      (Chromium CPU profile; SwiftShader, so only JS/CPU numbers mean anything)
import '../server/runtime.mjs';
import { createRequire } from 'node:module';
import { mkdtemp, copyFile, writeFile } from 'node:fs/promises';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../server/index.mjs';
import { FileAdapter } from '../server/storage.mjs';
let pw; try { pw = createRequire(import.meta.url)('playwright'); } catch { pw = createRequire(process.env.COSMOS_PLAYWRIGHT_ROOT || join(homedir(), '.codex/runtime/unfinished-island/node_modules/'))('playwright'); }
const world = process.argv[2], secs = Number(process.argv[3] || 8);
const dir = await mkdtemp(join(tmpdir(), 'cosmos-perfclient-')); await copyFile(world, join(dir, 'world.json'));
const app = await startServer({ adapter: new FileAdapter(join(dir, 'world.json')), port: 0, tick: true });
const browser = await pw.chromium.launch({ headless: true, executablePath: process.env.COSMOS_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const p = await ctx.newPage(); p.setDefaultTimeout(240000);
await p.goto(`${app.url.replace('ws:', 'http:')}/?dev=1&opening=off&tier=low&ws=${app.url}${process.env.QS || ''}`, { waitUntil: 'commit' });
await p.waitForFunction(() => window.cosmos?.multiplayer?.initialized && cosmos.engine.frameCount >= 30, null, { timeout: 300000 }); await p.waitForTimeout(3000);
// JS-only frame cost: render stubbed, 4x CPU throttle (phone-ish), many steps
const cdp0 = await ctx.newCDPSession(p); await cdp0.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.THROTTLE || 4) });
const js = await p.evaluate(() => { const c = cosmos, r = c.engine.renderer, render = r.render; r.render = () => {}; const t = []; for (let i = 0; i < 240; i++) { const a = performance.now(); c.step(1 / 60); t.push(performance.now() - a); } r.render = render; t.sort((a, b) => a - b); return { avg: t.reduce((a, b) => a + b, 0) / t.length, p50: t[120], p95: t[228], max: t[239] }; });
console.log('JS-only step (render stubbed, throttle x' + (process.env.THROTTLE || 4) + ') ms', JSON.stringify(js, (k, v) => typeof v === 'number' ? +v.toFixed(2) : v));
const cdp = cdp0; await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
const f0 = 0; await cdp.send('Profiler.start');
const nsteps = await p.evaluate(() => { const c = cosmos, r = c.engine.renderer, render = r.render; r.render = () => {}; for (let i = 0; i < 600; i++) c.step(1 / 60); r.render = render; return 600; });
const { profile } = await cdp.send('Profiler.stop'); const f1 = nsteps; const secs2 = nsteps / 60;
const info = await p.evaluate(() => { const i = cosmos.engine.renderer.info; return { calls: i.render.calls, tris: i.render.triangles, geoms: i.memory.geometries, tex: i.memory.textures, ships: Object.keys(cosmos.world.snapshot.ships).length, views: cosmos.multiplayer.fleetView?.views?.size, drawnViews: [...(cosmos.multiplayer.fleetView?.views?.values() || [])].filter((v) => v.root.visible).length, bodies: cosmos.multiplayer.bodies.size }; });
const self = new Map(), nodes = new Map(profile.nodes.map((n) => [n.id, n])); const dt = profile.timeDeltas;
profile.samples.forEach((id, i) => self.set(id, (self.get(id) || 0) + dt[i]));
const agg = {}; let total = 0; for (const [id, t] of self) { const n = nodes.get(id), k = (n.callFrame.functionName || '(anon)') + ' ' + n.callFrame.url.split('/').slice(-2).join('/') + ':' + n.callFrame.lineNumber; agg[k] = (agg[k] || 0) + t; total += t; }
console.log('steps', f1 - f0, 'info', JSON.stringify(info)); const idle = agg['(idle) :-1'] || 0; console.log('busy ms per step', ((total - idle) / 1000 / nsteps).toFixed(2));
for (const [k, v] of Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 28)) console.log((v / 1000 / nsteps).toFixed(2).padStart(7) + ' ms/step', k);
await browser.close(); await app.close(); process.exit(0);
