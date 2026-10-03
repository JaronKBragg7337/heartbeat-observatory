// The long-range drive in a real browser against the real server (F3): the pilot plots Earth from the nav computer, the server climbs, drives out and
// starts the long drive; the browser mirrors it (the phases, the compression ladder, the speed and distance), is taken to the half-way point and the
// end, and shows the ship holding off Earth. Screenshots go to docs/qa/2026-10-03/f3/.     node test/longrange-browser.mjs
import '../server/runtime.mjs';
import { createRequire } from 'node:module';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../server/index.mjs';
import { FileAdapter } from '../server/storage.mjs';

let pw; try { pw = createRequire(import.meta.url)('playwright'); } catch { pw = createRequire(process.env.COSMOS_PLAYWRIGHT_ROOT || join(homedir(), '.codex/runtime/unfinished-island/node_modules/'))('playwright'); }
const out = fileURLToPath(new URL('../docs/qa/2026-10-03/f3/', import.meta.url)); await mkdir(out, { recursive: true });
const dir = await mkdtemp(join(tmpdir(), 'cosmos-long-br-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [], errors = [];
const ok = (name, pass, detail = '') => { results.push({ name, pass }); console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass ? '' : '  ' + detail)); };
let app, browser;
try {
  app = await startServer({ adapter: new FileAdapter(join(dir, 'world.json')), port: 0, tick: true });
  const world = app.world, origin = app.url.replace('ws:', 'http:');
  const me = await world.join('l'.repeat(48), 'Longhaul');
  const ship = world.state.ships[me.shipId];
  browser = await pw.chromium.launch({ headless: true, executablePath: process.env.COSMOS_CHROMIUM || join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'chromium-1234', 'chrome-win64', 'chrome.exe'), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => { localStorage.setItem('cosmos-device-v2', JSON.stringify({ key: 'l'.repeat(48), name: 'Longhaul' })); localStorage.setItem('hb-look', 'isaiah'); });
  const page = await ctx.newPage(); page.setDefaultTimeout(240000);
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
  await page.goto(`${origin}/?dev=1&opening=off&tier=low&depth=16&ws=${app.url}`, { waitUntil: 'commit', timeout: 240000 });
  await page.waitForFunction(() => window.cosmos?.multiplayer?.initialized && cosmos.engine.frameCount >= 2, null, { timeout: 300000 });
  await page.evaluate(() => { if (cosmos.engine.graphics) cosmos.engine.graphics.checked = 1e6; });
  await world.enqueue(() => { const p = world.state.players[me.id], sim = world.sims.get(ship.id), seat = sim.def.seats.find((s) => s.id === 'pilot'); p.aboardShipId = ship.id; p.currentShipId = ship.id; p.pose.aboard = true; p.frameId = sim.frameId; p.pose.seat = 'pilot'; Object.assign(p.pose.sw, { x: seat.x, y: seat.y, z: seat.z }); });
  await sleep(2500);
  const rows = await page.evaluate(() => cosmos.space.destinations().filter((d) => ['earth', 'moon', 'callisto', 'ceres', 'ceres~drive'].includes(d.id)).map((d) => ({ id: d.id, ok: d.ok, route: d.route, distAU: d.distM / 1.496e11, etaDays: d.etaS / 86400, realMin: d.realTopS / 60, reason: d.reason })));
  console.log(JSON.stringify(rows));
  ok('the nav computer lists Earth, the Moon, Callisto and Ceres (lane and drive)', ['earth', 'moon', 'callisto', 'ceres', 'ceres~drive'].every((id) => rows.some((r) => r.id === id && r.ok)), JSON.stringify(rows));
  const earth = rows.find((r) => r.id === 'earth');
  ok('Earth is 1.65 AU, about two weeks of flight, minutes at the top compression', earth && earth.distAU > 1.5 && earth.distAU < 1.8 && earth.etaDays > 10 && earth.etaDays < 25 && earth.realMin > 3 && earth.realMin < 20, JSON.stringify(earth));
  // the nav sheet at phone width, with the new rows
  await page.evaluate(() => { cosmos.shipUI && cosmos.space.ui && cosmos.space.ui.toggle('course'); });
  await sleep(600);
  await page.evaluate(() => { const el = document.getElementById('space-sheet'); if (el) { el.style.display = 'block'; el.scrollTop = 140; } });
  await page.screenshot({ path: join(out, '01-nav-sheet.png') });
  await page.evaluate(() => cosmos.space.ui && cosmos.space.ui.close());
  await page.evaluate(() => { cosmos.space.engage('earth'); });
  await sleep(1500);
  await page.evaluate(() => { cosmos.space.setWarp(60); });
  const t0 = Date.now(); const seen = []; let last = '', sawLadder = false;
  while (Date.now() - t0 < 6 * 60 * 1000) {
    await sleep(3000);
    const s = await page.evaluate(() => { const t = cosmos.space.trip; return { phase: t && t.phase, leg: t && t.leg, warp: t && t.warp, hasCruise: !!(t && t.cruise), frame: cosmos.space.frameId }; });
    if (s.phase !== last) { console.log(Math.round((Date.now() - t0) / 1000) + ' s', JSON.stringify(s)); last = s.phase; seen.push(s.phase); }
    if (s.phase === 'longdrive') break;
  }
  ok('the browser mirrors the trip into the long drive (phase longdrive, the cruise state present)', last === 'longdrive' && seen.includes('transit'), seen.join(' > '));
  await page.evaluate(() => { cosmos.space.setWarp(5400); });
  await sleep(2500);
  const mid = await page.evaluate(() => { const t = cosmos.space.trip, ph = t.phases(); return { warp: t.warp, eff: t.eff, speed: t.progress.speed, distAU: t.progress.distM / 1.496e11, phases: ph.map((q) => q.id + ':' + q.state), hud: cosmos.space.hudLines(), bar: [...document.querySelectorAll('#flight-speed button')].filter((b) => !b.hidden).map((b) => b.dataset.w) }; });
  console.log(JSON.stringify(mid));
  ok('the compression is the long drive\'s ladder (x1 x10 x60 x600 x1800 x5400) and the HUD names the long drive', JSON.stringify(mid.bar) === JSON.stringify(['1', '10', '60', '600', '1800', '5400']) && /LONG DRIVE/.test(mid.hud) && mid.warp === 5400, JSON.stringify(mid));
  await page.evaluate(() => { cosmos.space.ui && cosmos.space.ui.toggle('course'); });
  await sleep(500);
  await page.screenshot({ path: join(out, '02-longdrive-accelerating.png') });
  // take it to the half-way point and the last hours on the server, then look
  const sim = world.sims.get(ship.id);
  await world.enqueue(() => { const c = sim.trip.cruise; c.tau = c.profile.T * 0.5 + 40000; });
  await sleep(2500);
  const half = await page.evaluate(() => { const t = cosmos.space.trip, f = cosmos.ship.flight; return { stage: t.progress.stage, distAU: t.progress.distM / 1.496e11, speedKms: t.progress.speed / 1000, pos: { ...f.pos }, finite: [f.pos.x, f.pos.y, f.pos.z].every(Number.isFinite), cam: { ...cosmos.engine.cameraWorldPos } }; });
  console.log(JSON.stringify(half));
  ok('half way: past the half-way point (braking), over half the distance covered, the ship 1e10 to 1e12 m from Mars with finite numbers (the camera is ~1e8 m behind the ship at 1.8e9 m per real second: the client smooths over a tick)', half.finite && half.distAU < 1.0 && half.stage === 'decelerate' && Math.hypot(half.pos.x, half.pos.y, half.pos.z) > 1e10 && Math.hypot(half.pos.x, half.pos.y, half.pos.z) < 1e12, JSON.stringify(half));
  await page.evaluate(() => { cosmos.space.ui && cosmos.space.ui.toggle('course'); });
  await sleep(500);
  await page.screenshot({ path: join(out, '03-longdrive-half-way.png') });
  await world.enqueue(() => { const c = sim.trip.cruise; c.tau = c.profile.T - 3000; });
  const t1 = Date.now(); let held = null;
  while (Date.now() - t1 < 4 * 60 * 1000) {
    await sleep(3000);
    held = await page.evaluate(() => { const t = cosmos.space.trip; return { phase: t && t.phase, warp: t && t.warp, eff: t && t.eff, trip: !!t, frame: cosmos.space.frameId, speed: t && t.progress.speed }; });
    if (held.phase === 'longdrive') { await page.screenshot({ path: join(out, '04-slowing-for-the-drop-out.png') }); }
    if (!held.trip) break;
    if (held.phase === 'longdrive' && held.warp > 60) { await page.evaluate(() => { cosmos.space.setWarp(5400); }); }
    if (held.phase === 'transit' && held.warp !== 60) await page.evaluate(() => { cosmos.space.setWarp(60); });
  }
  const end = await page.evaluate(() => { const f = cosmos.ship.flight; return { trip: !!cosmos.space.trip, frame: cosmos.space.frameId, landed: f.landed, distEarthKm: null, msgs: (cosmos.space.log || []).slice(-4).map((l) => l.text) }; });
  console.log(JSON.stringify(end));
  await page.screenshot({ path: join(out, '05-holding-off-earth.png') });
  const serverEnd = { trip: !!sim.trip, pos: { ...sim.flight.pos } };
  ok('the drive dropped her out and she holds off Earth (the trip is over, in Mars\'s frame, not landed)', !end.trip && end.frame === 'mars' && !end.landed && !serverEnd.trip, JSON.stringify([end, serverEnd.trip]));
  ok('the ship said it: "Holding off the world" reached the ship log on the server', (ship.messages || []).some((m) => /Holding off the world/.test(m.msg)), JSON.stringify((ship.messages || []).slice(-3)));
  ok('no page errors', errors.length === 0, errors.join(' | '));
} catch (e) { console.error(e); ok('the scenario ran to the end', false, String(e)); }
finally { try { await browser?.close(); } catch {} try { await app?.close?.(); } catch {} await rm(dir, { recursive: true, force: true }).catch(() => {}); }
const failed = results.filter((r) => !r.pass);
console.log(failed.length ? `FAILED ${failed.length}/${results.length}` : `PASSED ${results.length}/${results.length}`);
setTimeout(() => process.exit(failed.length ? 1 : 0), 500);
