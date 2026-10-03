// Real iPhone-profile WebKit (touch taps, not clicks) against an isolated authority: never touches the live world.
//   node test/identity-browser.mjs            (WebKit iPhone; set COSMOS_QA_CHROMIUM=1 to run Chromium instead)
// Proves: the Settings account section (guest, sign in form, Start fresh with a confirmation), a signed-in account getting the same player on a
// second device and in a private-tab-like fresh context, an admin's saved characters, and the pad field with 20 other ships drawn from a player's own spawn.
import '../server/runtime.mjs';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { startServer } from '../server/index.mjs';
import { FileAdapter } from '../server/storage.mjs';
import { TestClient } from './multiplayer-checks.mjs';

let pw; try { pw = createRequire(import.meta.url)('playwright'); } catch { pw = createRequire(process.env.COSMOS_PLAYWRIGHT_ROOT || join(homedir(), '.codex/runtime/unfinished-island/node_modules/'))('playwright'); }
const out = fileURLToPath(new URL('../docs/qa/2026-10-02/identity/', import.meta.url)); await mkdir(out, { recursive: true });
const useChromium = process.env.COSMOS_QA_CHROMIUM === '1';
const JARON = { userId: '11111111-1111-4111-8111-111111111111', email: 'jaron@example.test', admin: true };
const TOKEN = 'token-jaron-admin-aaaaaaaaaaaaaa';
const verify = async (t) => (t === TOKEN ? JARON : null);
const results = {}, errors = [];
const dir = await mkdtemp(join(tmpdir(), 'cosmos-idbrowser-'));
let app, browser; const seeded = [];
try {
  app = await startServer({ adapter: new FileAdapter(join(dir, 'world.json')), port: 0, tick: false, verify });
  const origin = app.url.replace('ws:', 'http:');
  const url = (q = '') => `${origin}/?dev=1&opening=off&tier=low&ws=${app.url}${q}`;
  const launch = useChromium
    ? () => pw.chromium.launch({ headless: true, executablePath: process.env.COSMOS_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
    : () => pw.webkit.launch({ headless: true, executablePath: process.env.COSMOS_WEBKIT || join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'webkit-2336', 'Playwright.exe') });
  browser = await launch();
  const phone = { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
  const newPage = async (init) => { const ctx = await browser.newContext(phone); if (init) await ctx.addInitScript(init); const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(String(e))); p.setDefaultTimeout(240000); return { ctx, p }; };
  const ready = async (p, q = '') => { await p.goto(url(q), { waitUntil: 'commit', timeout: 240000 });
    await p.waitForFunction(() => window.cosmos?.multiplayer?.initialized && cosmos.engine.frameCount >= 2, null, { timeout: 300000 }); await p.waitForTimeout(1500); };
  const tap = async (p, target) => { const l = typeof target === 'string' ? p.locator(target).first() : target; await l.scrollIntoViewIfNeeded(); const b = await l.boundingBox(); assert.ok(b, 'no box for ' + target); await p.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await p.waitForTimeout(400); };
  const byText = (p, t) => p.locator('#account-section button, #account-section a', { hasText: t }).first();
  const shot = (p, name) => p.screenshot({ path: join(out, name + '.png') });
  const settings = async (p) => { if (!(await p.locator('#settings-panel.open').count())) await tap(p, '#btn-settings'); await p.locator('#account-section').scrollIntoViewIfNeeded(); };

  // ---- 1. Many ships: 20 other players, one real phone client; the pad field is drawn from its own spawn -------------------------------------------------------
  for (let i = 0; i < 20; i++) { const c = new TestClient(app.url, String.fromCharCode(97 + i).repeat(48), 'Visitor ' + (100 + i)); await c.connect(); seeded.push(c); }
  for (const c of seeded) c.close(); seeded.length = 0;
  let A = await newPage(); await ready(A.p);
  const drawn = await A.p.evaluate(() => { const fv = cosmos.multiplayer.fleetView, s = cosmos.world.snapshot; return { ships: Object.keys(s.ships).length, views: fv.views.size, visible: [...fv.views.values()].filter((v) => v.root.visible).length, pads: cosmos.multiplayer.pads.size }; });
  results.padField = drawn; assert.ok(drawn.visible >= 20, 'ships drawn: ' + JSON.stringify(drawn));
  await shot(A.p, '01-own-spawn');
  await A.p.evaluate(() => { const c = cosmos, m = c.multiplayer, me = c.world.snapshot.players[c.world.playerId], pad = c.world.snapshot.ships[me.shipId].pad;
    void pad; c.freeCam.set(c.port.site.toWorld(150, 110, -300), c.port.site.toWorld(250, 0, 60)); c.step(.016); c.step(.016); });
  await A.p.waitForTimeout(900); await shot(A.p, '02-pad-field-aerial');

  // ---- 2. Guest: Settings shows guest + sign in; Start fresh asks twice, then really starts over --------------------------------------------------------------
  await A.p.evaluate(() => cosmos.freeCam.exit?.()); await A.p.reload({ waitUntil: 'commit' });
  await A.p.waitForFunction(() => window.cosmos?.multiplayer?.initialized && cosmos.engine.frameCount >= 2, null, { timeout: 300000 }); await A.p.waitForTimeout(1500);
  const firstId = await A.p.evaluate(() => cosmos.world.playerId);
  await settings(A.p);
  const guestText = await A.p.locator('#account-section').innerText();
  assert.match(guestText, /Playing as a guest/); assert.match(guestText, /Sign in/);
  await shot(A.p, '03-settings-guest');
  await tap(A.p, byText(A.p, 'Start fresh: new character'));
  assert.match(await A.p.locator('#account-section').innerText(), /deletes your current character/);
  await shot(A.p, '04-start-fresh-confirm');
  await tap(A.p, byText(A.p, 'Keep my character'));
  assert.equal(app.world.state.players[firstId] !== undefined, true); results.keepWorks = true;
  await tap(A.p, byText(A.p, 'Start fresh: new character'));
  const navigated = A.p.waitForNavigation({ waitUntil: 'commit', timeout: 120000 });
  await tap(A.p, byText(A.p, 'Yes, start fresh')); await navigated;
  await A.p.waitForFunction(() => window.cosmos?.multiplayer?.initialized && cosmos.engine.frameCount >= 2, null, { timeout: 300000 });
  const secondId = await A.p.evaluate(() => cosmos.world.playerId);
  assert.notEqual(secondId, firstId); assert.equal(app.world.state.players[firstId], undefined, 'old character gone'); results.startFresh = { old: firstId.slice(0, 8), fresh: secondId.slice(0, 8) };
  await shot(A.p, '05-after-start-fresh');
  await A.ctx.close();

  // ---- 3. Signed in (admin): saved characters; the same player on a "second device" and in a fresh private-like context ---------------------------------------------
  const signed = `localStorage.setItem('cosmos-dev-token','${TOKEN}');`;
  let J = await newPage(signed); await ready(J.p);
  const mainId = await J.p.evaluate(() => cosmos.world.playerId);
  assert.equal(await J.p.evaluate(() => cosmos.world.who.signedIn && cosmos.world.who.admin), true);
  await settings(J.p);
  assert.match(await J.p.locator('#account-section').innerText(), /Signed in as jaron@example.test \(site admin\)/);
  await shot(J.p, '06-settings-signed-in-admin');
  await tap(J.p, byText(J.p, 'Start fresh: a new test character'));
  await J.p.waitForFunction(() => window.cosmos?.multiplayer?.initialized && cosmos.engine.frameCount >= 2, null, { timeout: 300000 }); await J.p.waitForTimeout(1200);
  const testId = await J.p.evaluate(() => cosmos.world.playerId);
  assert.notEqual(testId, mainId); assert.equal(await J.p.evaluate(() => cosmos.world.who.slots.length), 2);
  await settings(J.p); await shot(J.p, '07-two-characters');
  await tap(J.p, byText(J.p, 'Switch to Main character'));
  await J.p.waitForFunction(() => window.cosmos?.multiplayer?.initialized && cosmos.engine.frameCount >= 2, null, { timeout: 300000 });
  assert.equal(await J.p.evaluate(() => cosmos.world.playerId), mainId); results.slots = { main: mainId.slice(0, 8), test: testId.slice(0, 8), switchedBack: true };
  await J.ctx.close();
  const B = await newPage(signed);       // a different browser profile: new device key, as in a private tab or another phone
  await ready(B.p, '&slot=main');
  assert.equal(await B.p.evaluate(() => cosmos.world.playerId), mainId); results.secondDeviceSamePlayer = true;
  await shot(B.p, '08-second-device-same-ship');
  await B.ctx.close();

  // ---- 4. On a local review page a dead server still falls back to solo (production never does: it keeps reconnecting) --------------------------------------------
  const dead = `${origin}/?dev=1&opening=off&tier=low&ws=ws://127.0.0.1:59`;
  const D = await newPage();
  await D.p.goto(dead, { waitUntil: 'commit', timeout: 240000 });
  await D.p.waitForFunction(() => window.cosmos?.world && cosmos.world.remote !== true, null, { timeout: 300000 });
  results.localDeadServerSolo = true; await D.ctx.close();

  assert.deepEqual(errors, [], 'page errors: ' + errors.join(' | '));
  results.engine = useChromium ? 'chromium' : 'webkit-iphone';
  console.log('IDENTITY BROWSER OK', JSON.stringify(results));
  await writeFile(join(out, 'results.json'), JSON.stringify(results, null, 2));
} catch (e) { console.error('IDENTITY BROWSER FAILED', e); process.exitCode = 1; }
finally { for (const c of seeded) c.close(); await browser?.close().catch(() => {}); await app?.close().catch(() => {}); await rm(dir, { recursive: true, force: true }); }
