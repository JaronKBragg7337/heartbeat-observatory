// The shared world across the Ore Lane, in a real browser: a client joins the real authority (real WebSocket, real ticking server), the player takes
// the pilot's seat, plots Ceres, and the server flies the whole route (climb, drive, spool, jump, drive, descent) while the browser mirrors it:
// the frame changes to Ceres's at the jump, the screen flashes, the ship lands on the player's own pad, and the lane fee is taken by the server.
// Takes about five minutes (the trip runs on the server's real clock at x60).     node test/world2-shared-browser.mjs
import '../server/runtime.mjs';
import { createRequire } from 'node:module';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../server/index.mjs';
import { FileAdapter } from '../server/storage.mjs';

let pw; try { pw = createRequire(import.meta.url)('playwright'); } catch { pw = createRequire(process.env.COSMOS_PLAYWRIGHT_ROOT || join(homedir(), '.codex/runtime/unfinished-island/node_modules/'))('playwright'); }
const out = fileURLToPath(new URL('../docs/qa/2026-10-03/world2/', import.meta.url)); await mkdir(out, { recursive: true });
const dir = await mkdtemp(join(tmpdir(), 'cosmos-w2shared-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [], errors = [];
const ok = (name, pass, detail = '') => { results.push({ name, pass }); console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass ? '' : '  ' + detail)); };
let app, browser;
try {
  app = await startServer({ adapter: new FileAdapter(join(dir, 'world.json')), port: 0, tick: true });
  const world = app.world, origin = app.url.replace('ws:', 'http:');
  const me = await world.join('j'.repeat(48), 'Jumper');
  const ship = world.state.ships[me.shipId];
  browser = await pw.chromium.launch({ headless: true, executablePath: process.env.COSMOS_CHROMIUM || join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'chromium-1234', 'chrome-win64', 'chrome.exe'), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 700, height: 440 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { localStorage.setItem('cosmos-device-v2', JSON.stringify({ key: 'j'.repeat(48), name: 'Jumper' })); localStorage.setItem('hb-look', 'isaiah'); });
  const page = await ctx.newPage(); page.setDefaultTimeout(240000);
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
  await page.goto(`${origin}/?dev=1&opening=off&tier=low&depth=16&ws=${app.url}`, { waitUntil: 'commit', timeout: 240000 });
  await page.waitForFunction(() => window.cosmos?.multiplayer?.initialized && cosmos.engine.frameCount >= 2, null, { timeout: 300000 });
  await page.evaluate(() => { if (cosmos.engine.graphics) cosmos.engine.graphics.checked = 1e6; });
  // put the player in the pilot's seat on the server
  await world.enqueue(() => { const p = world.state.players[me.id], sim = world.sims.get(ship.id), seat = sim.def.seats.find((s) => s.id === 'pilot'); p.aboardShipId = ship.id; p.currentShipId = ship.id; p.pose.aboard = true; p.frameId = sim.frameId; p.pose.seat = 'pilot'; Object.assign(p.pose.sw, { x: seat.x, y: seat.y, z: seat.z }); });
  await sleep(2500);
  const marks0 = ship.economy.marks;
  const row = await page.evaluate(() => cosmos.space.destinations().find((d) => d.id === 'ceres'));
  ok('in the shared world the nav computer offers Ceres with the lane fee', !!row && row.ok && row.laneFee === 120, JSON.stringify(row));
  await page.evaluate(() => { cosmos.space.engage('ceres'); });
  await sleep(1500);
  await page.evaluate(() => { cosmos.space.setWarp(60); });
  const t0 = Date.now(); const seen = new Set(); let flashed = false, last = '';
  while (Date.now() - t0 < 9 * 60 * 1000) {
    await sleep(4000);
    const s = await page.evaluate(() => { const sp = cosmos.space, t = sp.trip, f = document.getElementById('jump-flash'); return { frame: sp.frameId, phase: t && t.phase, leg: t && t.leg, flash: f ? +f.style.opacity : 0, landed: cosmos.ship.flight.landed }; });
    if (s.flash > 0.4) flashed = true;
    const key = `${s.frame}|${s.phase}|${s.leg}`; if (key !== last) { console.log(Math.round((Date.now() - t0) / 1000) + ' s', JSON.stringify(s)); last = key; }
    seen.add(key);
    if (s.frame === 'ceres' && !s.phase && s.landed) break;
  }
  const end = await page.evaluate(() => { const sp = cosmos.space; return { frame: sp.frameId, landed: cosmos.ship.flight.landed, trip: !!sp.trip, hasOutpost: !!(sp.worlds.get('ceres') && sp.worlds.get('ceres').client), padsDrawn: [...(cosmos.multiplayer.moonPadIds || [])] }; });
  await page.screenshot({ path: join(out, 'shared-landed-ceres.png') });
  ok('the browser followed the server across the jump: the frame is Ceres\'s and the ship is landed', end.frame === 'ceres' && end.landed && !end.trip, JSON.stringify(end));
  ok('the trip showed the spool, and a Ceres-side drive leg, and the screen flashed at the jump', [...seen].some((k) => k.includes('|spool|')) && [...seen].some((k) => k.startsWith('ceres|transit|1')) && flashed, [...seen].join(' ; '));
  ok('the server took the lane fee once (120 credits) and Occator Works was built behind the spool', Math.round((marks0 - ship.economy.marks) / 4) === 120 && end.hasOutpost, `fee ${(marks0 - ship.economy.marks) / 4}`);
  ok('the player\'s own pad on Ceres is drawn (one pad per ship)', end.padsDrawn.some((id) => String(id).startsWith('moon-ceres')), JSON.stringify(end.padsDrawn));
  ok('no page errors', errors.length === 0, errors.join(' | '));
} catch (e) { console.error(e); ok('the scenario ran to the end', false, String(e)); }
finally { try { await browser?.close(); } catch {} try { await app?.close?.(); } catch {} await rm(dir, { recursive: true, force: true }).catch(() => {}); }
const failed = results.filter((r) => !r.pass);
console.log(failed.length ? `FAILED ${failed.length}/${results.length}` : `PASSED ${results.length}/${results.length}`);
setTimeout(() => process.exit(failed.length ? 1 : 0), 500);
