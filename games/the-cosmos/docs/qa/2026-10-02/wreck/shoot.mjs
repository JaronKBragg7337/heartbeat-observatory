// Wreck / opening looks harness. usage: node shoot.mjs <prefix>   -> PNGs next to this file.
// Walks every opening scene in headless Chrome and screenshots it from several angles at desktop (1280x720) and phone (390x844, tier=low&depth=16).
// State (stage, elapsed, pose) is forced locally so no game rules, saves or the server are touched.
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../../../../server/index.mjs';
import { MemoryAdapter } from '../../../../src/world-state/storage.js';
const { chromium } = createRequire(join(homedir(), '.codex/runtime/unfinished-island/node_modules/'))('playwright');
const out = fileURLToPath(new URL('./', import.meta.url));
const prefix = process.argv[2] || 'after';
const app = await startServer({ adapter: new MemoryAdapter(), port: 0, tick: false, now: () => Date.now() });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const errors = [], stats = {};
// [stage, name, args]  stage 0: t,yaw,pitch | 1: x,z,yaw,pitch | 2/3: x,z,tx,ty,tz[,y] | 'ride': seconds,yaw,pitch | 'start'
const SHOTS = [
  [0, 'descent-1-approach', [9, 0, 0]], [0, 'descent-2-window', [14, -1.1, 0]], [0, 'descent-3-storm', [20, .5, 0]], [0, 'descent-4-alarm-fwd', [27, 0, 0]], [0, 'descent-5-alarm-window', [27, -1.1, 0]],
  [0, 'descent-6-brace', [36, .3, 0]], [0, 'descent-7-impact', [41.5, 0, 0]],
  [1, 'cabin-1-fwd', [0, 3, 3.14, 0]], [1, 'cabin-2-aft', [0, -3, 0, .02]], [1, 'cabin-3-aft-far', [0, -8, 0, 0]], [1, 'cabin-4-left', [-1, 6, .9, 0]], [1, 'cabin-5-right', [1, 6, -.9, -.1]],
  [1, 'cabin-6-ceiling', [0, -1, 0, .9]], [1, 'cabin-7-door', [0, 9, 3.14, 0]], [1, 'cabin-8-seats', [0, 0, 2.3, -.25]],
  ['start', 'exit-1-first-view', []], [2, 'exit-2-door', [0, 17, 0, 1.4, 10]], [2, 'wreck-1-front34', [14, 28, 0, 1.5, 6]], [2, 'wreck-2-side-high', [22, 2, 0, 1.4, 0]], [2, 'wreck-3-side-low', [-22, 2, 0, 1.4, 0]],
  [2, 'wreck-4-rear', [8, -30, 0, 1.6, -13]], [2, 'wreck-5-rear34-left', [-14, -26, 0, 1.6, -13]], [2, 'wreck-6-stern-close', [5, -21, 0, 1.4, -13]], [2, 'wreck-7-trail', [3, -70, 0, 0, -20]],
  [2, 'wreck-8-aerial', [20, -40, 0, 0, -30, 45]], [2, 'wreck-9-pod', [-4, -40, -17, 1, -52]], [2, 'wreck-10-dusk-wide', [-12, 32, 0, 2, -4]], [2, 'wreck-11-debris-ground', [9, -12, -4, .3, -18]],
  [2, 'crate-1-wide', [4, 15, 4, .2, 20]], [2, 'crate-2-close', [4, 18.2, 4, .2, 20]], [2, 'port-1-horizon', [-40, 36, -2600, 6, -350]],
  [3, 'rover-1', [0, 17, -7, 1.2, 23]], [3, 'rover-2-wreck-behind', [-10, 27, 0, 2, 0]],
  [4, 'ride-1-start', [3, 0, 0]], [4, 'ride-2-lights', [30, 0, .05]], [4, 'ride-3-approach', [58, 0, 0]],
  [3, 'walk-1-wreck-behind', [-60, 30, 0, 2, 0]], [3, 'walk-2-lights', [-1200, -160, -2600, 8, -350]], [3, 'walk-3-port', [-2400, -320, -2600, 8, -350]],
];
async function run(phone) {
  const tag = phone ? 'phone' : 'desk';
  const ctx = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 720 }, isMobile: phone, hasTouch: phone });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(tag + ' ' + String(e).slice(0, 300)));
  page.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) errors.push(tag + ' ' + m.text().slice(0, 200)); });
  await page.goto(app.url.replace('ws:', 'http:') + '/?dev=1&ws=' + app.url + '&' + (phone ? 'tier=low&depth=16&' : 'tier=high&') + 'solo=1');
  await page.waitForFunction(() => window.cosmos?.opening && cosmos.engine.frameCount >= 2, null, { timeout: 120000 });
  await page.evaluate(async () => { cosmos.engine.stop(); await cosmos.opening.ready; cosmos.opening.savePose = () => {}; cosmos.step(0); });
  for (const [stage, name, n] of SHOTS) {
    await page.evaluate(({ stage, n }) => {
      const o = cosmos.opening, m = o.model, w = m.walker, st = stage === 'start' ? 2 : stage === 'ride' ? 4 : stage;
      o.state.stage = st; o.stage = st; o.contactSeconds = 9; o.state.ride = false;
      if (st === 4 && stage === 4 && n.length === 3 && n[0] <= 66 && !('free' in window)) { /* ride shots use rideSeconds */ }
      if (st === 0) { o.elapsed = n[0]; o.sw.yaw = n[1]; o.sw.pitch = n[2]; cosmos.step(0); cosmos.step(0); return; }
      o.elapsed = 60; o.cabin.root.visible = true;
      if (st === 1) { o.sw.place(n[0], 0, n[1], n[2]); o.sw.pitch = n[3]; cosmos.step(0); cosmos.step(0); return; }
      if (stage === 4) { o.state.ride = true; o.rideSeconds = n[0]; o.state.rideSeconds = n[0]; o.rideYaw = n[1]; o.ridePitch = n[2]; cosmos.step(0); cosmos.step(0); return; }
      if (stage === 'start') { m.place(o.state.pose); cosmos.step(0); cosmos.step(0); return; }
      const [x, z, tx, ty, tz, y] = n;
      m.place({ x, y: y ?? m.height(x, z), z, yaw: 0, pitch: 0 }); cosmos.step(0);
      const e = w.eyeWorldPos({}), p = m.toWorld(tx, ty, tz), f = w.updateFrame();
      const d = { x: p.x - e.x, y: p.y - e.y, z: p.z - e.z }, l = Math.hypot(d.x, d.y, d.z), dot = u => d.x * u.x + d.y * u.y + d.z * u.z;
      w.yaw = Math.atan2(dot(f.east), dot(f.north)); w.pitch = Math.asin(dot(f.up) / l); cosmos.step(0); cosmos.step(0);
    }, { stage, n });
    await page.screenshot({ path: join(out, `${prefix}-${tag}-${name}.jpg`), type: 'jpeg', quality: 90 });
    console.log('shot', tag, name);
  }
  stats[tag] = await page.evaluate(() => { const i = cosmos.engine.renderer.info; return { calls: i.render.calls, tris: i.render.triangles, buildMs: cosmos.opening.buildMs }; });
  await ctx.close();
}
try { await run(false); await run(true); } finally { console.log('errors', JSON.stringify(errors.slice(0, 8))); console.log('stats', JSON.stringify(stats)); await browser.close(); await app.close(); }
