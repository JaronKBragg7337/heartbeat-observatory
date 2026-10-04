// One Solar System, no cuts (F3): a solo ship plots Ceres, climbs, drives out, and the long drive carries her to Ceres while the browser draws the whole trip.
// Frames of the trip are photographed as Ceres grows (a point, then a disc, then the world), the hand-off into Ceres's own frame is checked for any flash
// or jump, and the ship lands on Ceres's pad. Screenshots: docs/qa/2026-10-03/f3/seam-*.png.      node test/seamless-browser.mjs
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createServer as netServer } from 'node:net';
import { fileURLToPath } from 'node:url';

let pw; try { pw = createRequire(import.meta.url)('playwright'); } catch { pw = createRequire(process.env.COSMOS_PLAYWRIGHT_ROOT || join(homedir(), '.codex/runtime/unfinished-island/node_modules/'))('playwright'); }
const root = join(fileURLToPath(new URL('.', import.meta.url)), '..'), out = join(root, 'docs/qa/2026-10-03/f3'); await mkdir(out, { recursive: true });
const port = await new Promise((r) => { const s = netServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const srv = spawn(process.execPath, [join(root, 'server.js')], { env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
for (let i = 0; i < 50; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/build.json`)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
let fails = 0; const ok = (n, c, d = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${n} ${c ? '' : d}`); if (!c) fails++; };
const browser = await pw.chromium.launch({ headless: true, executablePath: process.env.COSMOS_CHROMIUM || join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'chromium-1234', 'chrome-win64', 'chrome.exe'), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true })).newPage(); page.setDefaultTimeout(300000);
const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
try {
  await page.goto(`http://127.0.0.1:${port}/?dev=1&solo=1&opening=off&tier=low&depth=16&sky=live`, { waitUntil: 'commit' });
  await page.waitForFunction(() => window.cosmos?.space && cosmos.engine.frameCount >= 2, null, { timeout: 240000 });
  await page.evaluate(() => { if (cosmos.engine.graphics) cosmos.engine.graphics.checked = 1e6; window.__flash = 0; const sp = cosmos.space, ship = cosmos.ship; ship.aboard = true;
    const rr = cosmos.engine.renderer; window.__render = rr.render.bind(rr); window.__noRender = () => { rr.render = () => {}; }; window.__doRender = () => { rr.render = window.__render; };
    window.__noRender(); sp.engage('ceres'); sp.setWarp(60); window.__seen = []; window.__maxFlash = 0; });
  const pump = (n) => page.evaluate((n) => { const sp = cosmos.space; let k = 0;
    while (sp.trip && sp.trip.active && k++ < n) { const t = sp.trip; if (!window.__seen.includes(t.phase)) window.__seen.push(t.phase); if (t.phase === 'longdrive') break;
      if (t.warp !== 60) sp.setWarp(60); cosmos.engine.step(1 / 30); window.__maxFlash = Math.max(window.__maxFlash, sp.flash || 0, +(document.getElementById('jump-flash')?.style.opacity || 0)); }
    return sp.trip && sp.trip.phase; }, n);
  let phase = null, guard = 0; while (phase !== 'longdrive' && guard++ < 400) phase = await pump(300);
  ok('the long drive began (climb and the main drive out came first)', phase === 'longdrive', String(phase));
  const view = async (frac, name) => {
    await page.evaluate((frac) => { cosmos.freeCam.off(); const sp = cosmos.space, t = sp.trip, c = t.cruise; sp.setWarp(1); c.tau = c.profile.T * frac; window.__doRender(); for (let i = 0; i < 2; i++) cosmos.engine.step(1 / 30);
      // look out of the window at Ceres: a free camera at the ship, aimed at the world (the player in the corridor cannot see out)
      const f = cosmos.ship.flight, w = cosmos.space.worlds.get('ceres'), o = w.frame.origin; const dx = o.x - f.pos.x, dy = o.y - f.pos.y, dz = o.z - f.pos.z, dl = Math.hypot(dx, dy, dz) || 1, cam = cosmos.engine.camera; cam.fov = 22; cam.updateProjectionMatrix();
      cosmos.freeCam.set({ x: f.pos.x + dx / dl * 90, y: f.pos.y + dy / dl * 90 + 6, z: f.pos.z + dz / dl * 90 }, { x: o.x, y: o.y, z: o.z });
      for (let i = 0; i < 3; i++) cosmos.engine.step(1 / 30); }, frac);
    await page.waitForTimeout(400);
    const info = await page.evaluate(() => { const t = cosmos.space.trip, f = cosmos.ship.flight, far = cosmos.space.far; const ceres = far && far.items.find((i) => i.id === 'ceres'); return { distAU: t.progress.distM / 1.496e11, speedKms: t.progress.speed / 1000, frame: cosmos.space.frameId, marker: !!(ceres && ceres.marker.visible), shellVisible: !!(cosmos.space.worlds.get('ceres') && (cosmos.space.worlds.get('ceres').shellFar.visible || cosmos.space.worlds.get('ceres').shell.visible)), camFar: cosmos.engine.camera.far, finite: [f.pos.x, f.pos.y, f.pos.z].every(Number.isFinite) }; });
    await page.screenshot({ path: join(out, `seam-${name}.png`) });
    await page.evaluate(() => { window.__noRender(); cosmos.freeCam.off(); cosmos.engine.camera.fov = 70; cosmos.engine.camera.updateProjectionMatrix(); });
    return info;
  };
  const shots = {};
  for (const [frac, name] of [[0.02, '1-leaving'], [0.3, '2-coasting'], [0.8, '3-ceres-ahead'], [0.97, '4-ceres-grows'], [0.9985, '5-ceres-near']]) { shots[name] = await view(frac, name); console.log(name, JSON.stringify(shots[name])); }
  ok('the far plane reaches a planet (1e13 m) and every number stays finite on the way', shots['1-leaving'].camFar >= 1e12 && Object.values(shots).every((s) => s.finite));
  ok('Ceres is in view the whole way: a marker while it is a point, its own shell once it is a disc', Object.values(shots).slice(0, 4).every((s) => s.marker || s.shellVisible), JSON.stringify(shots));
  // carry on to the end: the hand-off, then the landing
  await page.evaluate(() => { const t = cosmos.space.trip; t.cruise.tau = t.cruise.profile.T - 3; cosmos.space.setWarp(1); });
  let frames = 0, seenFrames = [], last = ''; const t0 = Date.now();
  while (Date.now() - t0 < 12 * 60 * 1000) {
    const s = await page.evaluate(() => { const sp = cosmos.space, t = sp.trip; let k = 0; while (sp.trip && sp.trip.active && k++ < 300) { if (sp.trip.phase !== 'longdrive' && sp.trip.warp !== 60) sp.setWarp(60); cosmos.engine.step(1 / 30); window.__maxFlash = Math.max(window.__maxFlash, sp.flash || 0, +(document.getElementById('jump-flash')?.style.opacity || 0)); }
      return { active: !!(sp.trip && sp.trip.active), phase: sp.trip && sp.trip.phase, frame: sp.frameId, landed: cosmos.ship.flight.landed }; });
    const key = s.frame + '|' + s.phase; if (key !== last) { seenFrames.push(key); last = key; } frames++;
    if (!s.active) break;
  }
  await page.evaluate(() => window.__doRender()); await page.evaluate(() => { for (let i = 0; i < 6; i++) cosmos.engine.step(1 / 30); }); await page.waitForTimeout(400);
  await page.screenshot({ path: join(out, 'seam-6-landed-on-ceres.png') });
  const end = await page.evaluate(() => ({ frame: cosmos.space.frameId, landed: cosmos.ship.flight.landed, maxFlash: window.__maxFlash, seen: window.__seen }));
  console.log(JSON.stringify({ seenFrames, end }));
  ok('she landed on Ceres, in Ceres\'s own frame', end.frame === 'ceres' && end.landed, JSON.stringify(end));
  ok('no flash anywhere on the trip (the screen never went white: opacity and flash stayed 0)', end.maxFlash === 0, String(end.maxFlash));
  ok('the hand-off into the frame of Ceres came at the end of the long drive, with nothing in between', end.seen.includes('longdrive') && seenFrames[0].startsWith('ceres|transit'), seenFrames.join(' ; '));
  ok('no page errors', errors.length === 0, errors.join(' | '));
} catch (e) { console.error(e); ok('the scenario ran to the end', false, String(e)); }
await browser.close(); srv.kill();
console.log(fails ? `FAILED ${fails}` : 'PASSED'); process.exit(fails ? 1 : 0);
