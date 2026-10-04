// FLIGHTFEEL in the SHARED world, real browsers against an isolated authority (never the live world):
//   * client A: an iPhone-profile WebKit page flying her by hand: a held LIFT, a held thumb on the stick, a held BOOST, a REAL tap on the LAND chip;
//   * client B: a second page (Chromium) in the same world that must SEE her fly (her pose moving fast, the boost flag in her snapshot).
// The authority steps the ship; A only sends levers. Wall-clock time (no stepping the page), so it takes about a minute.
//   node test/flightfeel-browser.mjs
import '../server/runtime.mjs';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { startServer } from '../server/index.mjs';
import { FileAdapter } from '../server/storage.mjs';

let pw; try { pw = createRequire(import.meta.url)('playwright'); } catch { pw = createRequire(process.env.COSMOS_PLAYWRIGHT_ROOT || join(homedir(), '.codex/runtime/unfinished-island/node_modules/'))('playwright'); }
const out = fileURLToPath(new URL('../docs/qa/2026-10-03/flightfeel/', import.meta.url)); await mkdir(out, { recursive: true });
const dir = await mkdtemp(join(tmpdir(), 'cosmos-flightfeel-browser-'));
const errors = []; const results = {}; let app, browserA, browserB;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  app = await startServer({ adapter: new FileAdapter(join(dir, 'world.json')), port: 0, tick: true });
  const world = app.world, origin = app.url.replace('ws:', 'http:');
  const root = process.env.LOCALAPPDATA || '';
  browserA = await pw.webkit.launch({ headless: true, executablePath: process.env.COSMOS_WEBKIT || join(root, 'ms-playwright', 'webkit-2336', 'Playwright.exe') });
  browserB = await pw.chromium.launch({ headless: true, executablePath: process.env.COSMOS_CHROMIUM || join(root, 'ms-playwright', 'chromium-1234', 'chrome-win64', 'chrome.exe'), args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const phone = { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
  const ctxA = await browserA.newContext(phone), ctxB = await browserB.newContext({ viewport: { width: 900, height: 600 } });
  const A = await ctxA.newPage(), B = await ctxB.newPage();
  for (const [n, p] of [['A', A], ['B', B]]) { p.on('pageerror', (e) => errors.push(n + ': ' + String(e))); p.setDefaultTimeout(240000); }
  const ready = async (p, query) => { await p.goto(`${origin}/?dev=1&opening=off&tier=low&ws=${app.url}${query}`, { waitUntil: 'commit', timeout: 240000 });
    await p.waitForFunction(() => window.cosmos?.multiplayer?.initialized && cosmos.engine.frameCount >= 2, null, { timeout: 300000 }); await p.waitForTimeout(800); return p.evaluate(() => cosmos.world.playerId); };
  const aId = await ready(A, ''), bId = await ready(B, '&test=1');
  const pa = world.state.players[aId], recA = world.state.ships[pa.shipId];
  const S = () => world.sims.get(recA.id);
  // test setup, not a client action: the player aboard and seated at the pilot's station on her own pad
  await world.enqueue(() => { const sim = S(), seat = sim.def.seats.find((q) => q.id === 'pilot');
    pa.aboardShipId = recA.id; pa.currentShipId = recA.id; pa.pose.aboard = true; pa.pose.seat = 'pilot'; pa.pose.sw = { x: seat.x, y: seat.y, z: seat.z, yaw: 0, pitch: 0 }; pa.frameId = 'mars'; world.state.revision++; });
  await A.waitForFunction(() => cosmos.ship.seat?.id === 'pilot', null, { timeout: 60000 });
  await A.waitForTimeout(1200);
  const ptr = (sel, type, x, y, id) => A.evaluate(({ sel, type, x, y, id }) => { const t = sel === 'canvas' ? document.querySelector('canvas') : document.querySelector(sel); const r = t.getBoundingClientRect();
    t.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: false, clientX: x ?? r.x + r.width / 2, clientY: y ?? r.y + r.height / 2, bubbles: true, cancelable: true })); }, { sel, type, x, y, id });
  const tap = async (sel) => { const b = await A.locator(sel).boundingBox(); assert.ok(b, sel + ' has no box'); await A.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); };
  const waitFor = (fn, ms = 30000) => (async () => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = fn(); if (v) return v; await sleep(80); } throw Error('timed out: ' + fn); })();
  const f = () => S().flight;
  const shot = (p, name) => p.screenshot({ path: join(out, name) });
  // the controls the page sends are the page's own: prove the new chips are on screen and the hand mode is what it sends
  const ui = await A.evaluate(() => ({ chips: ['#fb-mode', '#fb-view', '#fb-land', '#btn-boost', '#btn-lift', '#btn-sink'].map((s) => !!document.querySelector(s) && getComputedStyle(document.querySelector(s)).display !== 'none'), mode: cosmos.ship.flightMode, chase: cosmos.ship.chaseView }));
  results.ui = ui; console.log('ui', JSON.stringify(ui)); assert.ok(ui.chips.every(Boolean), 'flight chips / buttons not all on screen: ' + JSON.stringify(ui)); assert.equal(ui.mode, 'assist');

  // 1. a held LIFT: the ramp folds, then she lifts (the authority does it)
  await ptr('#btn-lift', 'pointerdown', null, null, 11);
  await waitFor(() => f().agl > 25 && !f().landed, 40000); await ptr('#btn-lift', 'pointerup', null, null, 11);
  results.lift = { agl: Math.round(f().agl), mode: f().controls.mode }; console.log('held LIFT: she is up', JSON.stringify(results.lift));
  assert.equal(f().controls.mode, 'assist', 'the authority did not receive the hand mode');

  // 2. a held thumb: she goes (the old cruise was 40 m/s)
  await ptr('canvas', 'pointerdown', 110, 640, 71); await ptr('canvas', 'pointermove', 110, 580, 71);
  await waitFor(() => f().groundSpeed > 60, 30000);
  results.go = { speed: Math.round(f().speed), agl: Math.round(f().agl) }; console.log('held thumb: she goes', JSON.stringify(results.go));
  await shot(A, 'shared-phone-1-cruise.png');

  // 3. boost
  await ptr('#btn-boost', 'pointerdown', null, null, 13);
  await waitFor(() => f().boosting && f().groundSpeed > 120, 30000);
  results.boost = { speed: Math.round(f().speed), charge: +f().boostCharge.toFixed(2) }; console.log('held BOOST', JSON.stringify(results.boost));
  // client B sees her fly: her pose moving, the boost flag in her snapshot
  const seen = await B.waitForFunction((id) => { const s = cosmos.world.snapshot?.ships?.[id]; return s && s.pose.boosting === true && Math.hypot(s.pose.vel.x, s.pose.vel.y, s.pose.vel.z) > 100 ? { v: Math.hypot(s.pose.vel.x, s.pose.vel.y, s.pose.vel.z), boosting: s.pose.boosting } : false; }, recA.id, { timeout: 60000 }).then((h) => h.jsonValue());
  results.watcher = seen; console.log('client B sees her boosting', JSON.stringify(seen));
  await A.waitForTimeout(600); await shot(A, 'shared-phone-2-boost.png'); await shot(B, 'shared-watcher-sees-boost.png');
  await ptr('#btn-boost', 'pointerup', null, null, 13); await ptr('canvas', 'pointerup', 110, 580, 71);

  // 4. let go: the flight assist holds her still
  await waitFor(() => f().speed < 3, 40000); results.stop = { speed: +f().speed.toFixed(1), agl: Math.round(f().agl) }; console.log('let go: she holds still', JSON.stringify(results.stop));

  // 5. a REAL tap on the LAND chip: she sets herself down softly
  await tap('#fb-land');
  const t0 = Date.now(); await waitFor(() => f().landed, 120000);
  results.land = { seconds: Math.round((Date.now() - t0) / 1000), hull: f().hull, touchdown: f().lastTouchdown && +f().lastTouchdown.v.toFixed(2) }; console.log('LAND chip: down', JSON.stringify(results.land));
  assert.equal(f().hull, 100, 'the landing damaged the hull');
  await A.waitForTimeout(500); await shot(A, 'shared-phone-3-landed.png');
  assert.deepEqual(errors, [], 'page errors: ' + errors.join(' | '));
  await writeFile(join(out, 'shared-results.json'), JSON.stringify(results, null, 1));
  console.log('FLIGHTFEEL SHARED-WORLD BROWSER OK');
} catch (e) { console.error('FAILED', e); process.exitCode = 1; }
finally { await browserA?.close(); await browserB?.close(); if (app) await app.close(); await rm(dir, { recursive: true, force: true }); }
