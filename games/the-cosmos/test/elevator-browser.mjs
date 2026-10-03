// The tower lift and its rider move every frame (not in 10 Hz steps) in a real browser against an isolated authority with a busy port.
//   node test/elevator-browser.mjs [world.json]
import '../server/runtime.mjs';
import { createRequire } from 'node:module';
import { mkdtemp, copyFile } from 'node:fs/promises';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { startServer } from '../server/index.mjs';
import { FileAdapter } from '../server/storage.mjs';
import { TOWER } from '../src/port/portSpec.js';
let pw; try { pw = createRequire(import.meta.url)('playwright'); } catch { pw = createRequire(process.env.COSMOS_PLAYWRIGHT_ROOT || join(homedir(), '.codex/runtime/unfinished-island/node_modules/'))('playwright'); }
const dir = await mkdtemp(join(tmpdir(), 'cosmos-lift-')); if (process.argv[2]) await copyFile(process.argv[2], join(dir, 'world.json'));
const app = await startServer({ adapter: new FileAdapter(join(dir, 'world.json')), port: 0, tick: true });
const browser = await pw.chromium.launch({ headless: true, executablePath: process.env.COSMOS_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let code = 0;
try {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true }); const p = await ctx.newPage(); p.setDefaultTimeout(240000);
  await p.goto(`${app.url.replace('ws:', 'http:')}/?dev=1&opening=off&tier=low&ws=${app.url}`, { waitUntil: 'commit' });
  await p.waitForFunction(() => window.cosmos?.multiplayer?.initialized && cosmos.engine.frameCount >= 10, null, { timeout: 300000 }); await p.waitForTimeout(1500);
  const pid = await p.evaluate(() => cosmos.world.playerId), me = app.world.state.players[pid];
  const w = app.world.site.toWorld(TOWER.x, 0.02, TOWER.z - 1); me.pose.worldPos = w; me.pose.velocity = { x: 0, y: 0, z: 0 }; me.poseAt = Date.now(); app.world.state.revision++; await new Promise((r) => setTimeout(r, 800));
  await p.evaluate((w) => { const c = cosmos; Object.assign(c.walker.worldPos, w); c.walker.velocity.x = c.walker.velocity.y = c.walker.velocity.z = 0; c.walker.updateFrame(); c.step(.016); }, w);
  const r0 = await p.evaluate(() => cosmos.multiplayer.request({ type: 'elevator', destination: 22.5 })); console.log('request', JSON.stringify(r0).slice(0, 120));
  // drive real frames at 60 Hz for 12 s (render stubbed so a software GPU does not set the pace) and record the car and the rider each frame
  const all = await p.evaluate(async () => { const c = cosmos, r = c.engine.renderer, render = r.render; r.render = () => {}; const out = []; c.engine.stop(); let last = performance.now();
    for (let i = 0; i < 720; i++) { const n0 = performance.now(), dt = Math.min(.05, (n0 - last) / 1000); last = n0; c.step(dt); const l = c.port.site.toLocal(c.walker.worldPos); out.push({ car: c.port.elevator.y, me: l.y, ph: c.port.elevator.phase }); await new Promise((q) => setTimeout(q, 16)); } r.render = render; c.engine.start?.(); return out; });
  const samples = all.slice(8); // the first frames after the page was paused to start sampling include its own catch-up
  const steps = samples.slice(1).map((s, i) => Math.abs(s.car - samples[i].car)), mv = samples.filter((s) => s.ph === 'moving').length;
  const maxStep = Math.max(...steps), jumps = steps.filter((d) => d > .1).length, rider = samples.slice(1).map((s, i) => Math.abs((s.me - samples[i].me) - (s.car - samples[i].car)));
  console.log(`car moved ${samples.at(-1).car.toFixed(2)} m, moving frames ${mv}, max car step ${maxStep.toFixed(3)} m/frame, steps > 0.1 m: ${jumps}, rider drift max ${Math.max(...rider).toFixed(3)} m`);
  if (process.env.DUMP) console.log(samples.map((s, i) => i + ':' + s.car.toFixed(2) + (s.ph[0])).filter((_, i) => steps[i - 1] > .05 || i % 40 === 0).join(' '));
  assert.ok(samples.at(-1).car > 20, 'the car reached the top'); const idle = samples.slice(1).filter((x, i) => x.ph === 'moving' && Math.abs(x.car - samples[i].car) < .005).length / Math.max(1, mv);
  console.log('moving frames where the car did not move:', (idle * 100).toFixed(1) + '%');
  assert.ok(idle < .05, 'the car stands still between 10 Hz snapshots: ' + idle); assert.ok(maxStep < .25 && jumps <= 4, 'car jumps; max ' + maxStep);
  assert.ok(Math.max(...rider) < .12, 'rider stays with the car'); console.log('PASS lift and rider move smoothly');
} catch (e) { console.error('FAIL', e.message); code = 1; }
await browser.close(); await app.close(); process.exit(code);
