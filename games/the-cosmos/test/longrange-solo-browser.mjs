// The long-range drive in SOLO play (no server): the client's own SpaceSystem plots Earth, flies the climb, the drive out and the long drive, with the
// engine stepped by hand (a throttled headless tab cannot be trusted to run frames), and holds off Earth. Also saves and restores mid-cruise.
//   node test/longrange-solo-browser.mjs
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { spawn } from 'node:child_process';
import { createServer as netServer } from 'node:net';
import { fileURLToPath } from 'node:url';

let pw; try { pw = createRequire(import.meta.url)('playwright'); } catch { pw = createRequire(process.env.COSMOS_PLAYWRIGHT_ROOT || join(homedir(), '.codex/runtime/unfinished-island/node_modules/'))('playwright'); }
const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const port = await new Promise((r) => { const s = netServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const srv = spawn(process.execPath, [join(root, 'server.js')], { env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
for (let i = 0; i < 50; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/build.json`)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
let fails = 0; const ok = (n, c, d = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${n} ${c ? '' : d}`); if (!c) fails++; };
const browser = await pw.chromium.launch({ headless: true, executablePath: process.env.COSMOS_CHROMIUM || join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'chromium-1234', 'chrome-win64', 'chrome.exe'), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 700, height: 440 } })).newPage(); page.setDefaultTimeout(240000);
const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
try {
  await page.goto(`http://127.0.0.1:${port}/?dev=1&solo=1&opening=off&tier=low&depth=16`, { waitUntil: 'commit' });
  await page.waitForFunction(() => window.cosmos?.space && cosmos.engine.frameCount >= 2, null, { timeout: 240000 });
  await page.evaluate(() => { if (cosmos.engine.graphics) cosmos.engine.graphics.checked = 1e6; });
  await page.evaluate(() => { window.__st = { seen: [], saved: false, restored: null, engage: null, rows: null, steps: 0 }; const sp = cosmos.space, ship = cosmos.ship; ship.aboard = true; const rr = cosmos.engine.renderer; window.__render = rr.render.bind(rr); rr.render = () => {};      // logic only: a software GPU cannot draw ten thousand frames in a loop
    window.__st.rows = sp.destinations().filter((d) => ['earth', 'moon', 'callisto', 'ceres'].includes(d.id)).map((d) => d.id + ':' + (d.ok ? 'ok' : d.reason));
    window.__st.engage = sp.engage('earth'); sp.setWarp(60); });
  const pump = () => page.evaluate(() => { const sp = cosmos.space, ship = cosmos.ship, st = window.__st; let n = 0;
    while (sp.trip && sp.trip.active && n++ < 300) {
      const t = sp.trip; if (t.phase === 'longdrive' && t.warp !== 14400) sp.setWarp(14400); else if (t.phase !== 'longdrive' && t.warp !== 60) sp.setWarp(60);
      if (!st.seen.includes(t.phase)) st.seen.push(t.phase);
      if (t.phase === 'longdrive' && !st.saved && t.cruise.tau > t.cruise.profile.T * 0.2) {
        const saved = JSON.parse(JSON.stringify(sp.snapshotState())); st.saved = true;
        sp.trip = null; ship.flight.override = null; sp.restoreState(saved); st.restored = !!(sp.trip && sp.trip.cruise && sp.trip.phase === 'longdrive' && typeof ship.flight.override === 'function');
      }
      cosmos.engine.step(1 / 30); st.steps++;
    }
    return !!(sp.trip && sp.trip.active); });
  let more = true, guard = 0; while (more && guard++ < 20000) { more = await pump(); if (guard % 10 === 0) console.log(guard, JSON.stringify(await page.evaluate(() => { const t = cosmos.space.trip; return t && { phase: t.phase, warp: t.warp, eff: t.eff, steps: window.__st.steps, p: t.progress.distM }; }))); }
  await page.evaluate(() => { cosmos.engine.renderer.render = window.__render; cosmos.engine.step(1 / 30); });
  await page.screenshot({ path: join(root, 'docs/qa/2026-10-03/f3/06-solo-holding-off-earth.png') });
  const r = await page.evaluate(() => { const sp = cosmos.space, f = cosmos.ship.flight, st = window.__st;
    return { engage: st.engage, rows: st.rows, seen: st.seen, saved: st.saved, restored: st.restored, done: !sp.trip, frame: sp.frameId, landed: f.landed, finite: [f.pos.x, f.pos.y, f.pos.z].every(Number.isFinite), r: Math.hypot(f.pos.x, f.pos.y, f.pos.z), steps: st.steps }; });
  console.log(JSON.stringify(r));
  ok('solo: the nav computer lists the long-range rows', r.rows.length === 4 && r.rows.every((s) => s.endsWith(':ok')), r.rows.join(' '));
  ok('solo: the course is accepted', r.engage.ok, JSON.stringify(r.engage));
  ok('solo: climb, main drive out, long drive, settle', ['ascent', 'transit', 'longdrive', 'settle'].every((p) => r.seen.includes(p)), r.seen.join(' > '));
  ok('solo: a save in the middle of the cruise restores into the cruise', r.saved && r.restored);
  ok('solo: she dropped out and holds off Earth in Mars\'s frame', r.done && r.frame === 'mars' && !r.landed && r.finite && r.r > 1e10, JSON.stringify(r));
  ok('no page errors', errors.length === 0, errors.join(' | '));
} catch (e) { console.error(e); ok('the scenario ran to the end', false, String(e)); }
await browser.close(); srv.kill();
console.log(fails ? `FAILED ${fails}` : 'PASSED'); process.exit(fails ? 1 : 0);
