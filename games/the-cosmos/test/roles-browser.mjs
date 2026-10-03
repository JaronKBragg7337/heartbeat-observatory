// F5/F4 on a real iPhone-profile WebKit phone against one isolated authority: the Roles part of the "World / crew" sheet, with real taps.
// A player on Mars sees the neutral message; on Ceres they join a faction, hear the governor (a voiced line), take a post (the NPC steps aside),
// work a shift (the world moves) and stand down. Screenshots go to docs/qa/2026-10-03/f5/.
//   node test/roles-browser.mjs
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
const out = fileURLToPath(new URL('../docs/qa/2026-10-03/f5/', import.meta.url)); await mkdir(out, { recursive: true });
const dir = await mkdtemp(join(tmpdir(), 'cosmos-roles-browser-'));
const errors = [], results = {}; let app, browser;
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const until = async (fn, ms = 60000, what = 'condition') => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) throw new Error('timed out waiting for ' + what); await new Promise((r) => setTimeout(r, 150)); } };

try {
  app = await startServer({ adapter: new FileAdapter(join(dir, 'world.json')), port: 0, tick: true });
  const world = app.world, origin = app.url.replace('ws:', 'http:');
  browser = await pw.webkit.launch({ headless: true, executablePath: process.env.COSMOS_WEBKIT || join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'webkit-2336', 'Playwright.exe') });
  const key = 'r'.repeat(48);
  const me = await world.join(key, 'Rowan');
  const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(({ key }) => { localStorage.setItem('cosmos-device-v2', JSON.stringify({ key, name: 'Rowan' })); localStorage.setItem('hb-look', 'isaiah'); }, { key });
  const page = await ctx.newPage(); page.setDefaultTimeout(240000);
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${origin}/?dev=1&opening=off&tier=low&ws=${app.url}`, { waitUntil: 'commit', timeout: 240000 });
  await page.waitForFunction(() => window.cosmos?.multiplayer?.initialized && cosmos.engine.frameCount >= 2, null, { timeout: 300000 });
  await page.waitForTimeout(1200);
  const shot = async (name) => { await page.screenshot({ path: join(out, name + '.png') }); console.log('shot', name); };
  // The sheet redraws as snapshots arrive, so a button can be replaced between looking and tapping: look again.
  const tap = async (locator) => { let last; for (let i = 0; i < 8; i++) { try { return await tap1(locator); } catch (e) { last = e; if (!/not attached|covered|no box|detached|Timeout/i.test(String(e.message))) throw e; await page.waitForTimeout(150); } } throw last; };
  const tap1 = async (locator) => {
    await locator.evaluate((el) => el.scrollIntoView({ block: 'center' }), null, { timeout: 3000 });
    const box = await locator.boundingBox(); assert.ok(box, 'no box for tap');
    assert.ok(box.width >= 40 && box.height >= 40, `tap target is ${box.width.toFixed(0)}x${box.height.toFixed(0)} (need 44)`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    const hit = await locator.evaluate((el, p) => { const t = document.elementFromPoint(p.x, p.y); return !!t && (t === el || el.contains(t)); }, { x, y });
    assert.ok(hit, 'the tap target is covered by something else');
    await page.touchscreen.tap(x, y);
  };
  const btn = (text) => page.locator('#multiplayer-panel button', { hasText: text }).first();
  const panelText = () => page.locator('#multiplayer-panel').innerText();
  const open = async () => { if (await page.locator('#multiplayer-panel').isHidden()) await tap(page.locator('#multiplayer-button')); await page.waitForSelector('#multiplayer-panel', { state: 'visible' }); await page.waitForTimeout(300); };

  // ---- on Mars: neutral
  await open(); await page.waitForTimeout(500);
  let t = await panelText(); results.marsText = t.split('\n').filter((l) => /Mars is neutral/.test(l))[0];
  assert.match(t, /Mars is neutral/); await shot('01-mars-neutral');
  assert.equal(await btn('Take the').count(), 0, 'Mars offers no seats to take');

  // ---- fly (teleport) to Ceres on the server; the sheet follows the snapshot
  await world.enqueue(() => { world.state.players[me.id].frameId = 'ceres'; world.state.revision++; });
  await until(async () => /Ceres\./.test(await panelText()), 30000, 'the Ceres roles text'); await page.waitForTimeout(400);
  t = await panelText(); results.ceresText = t.split('\n').slice(0, 12).join(' | ');
  await shot('02-ceres-sheet');
  assert.match(t, /Prices and patrols follow it/); assert.match(t, /ironclad leader/); assert.match(t, /greenhaven leader/);
  await tap(btn('Join ironclad'));
  await until(() => world.state.roles.members[me.id] === 'ironclad', 20000, 'the faction join');
  await page.waitForTimeout(500);
  // hear the governor: a voiced line comes back and is asked of the voice system
  const spoke = page.evaluate(() => { window.__said = []; const v = cosmos.voice, o = v.sayLine.bind(v); v.sayLine = (t, op) => { window.__said.push({ t, v: op && op.voice }); return o(t, op); }; });
  await spoke;
  await tap(btn('Hear the governor'));
  const said = await until(async () => { const s = await page.evaluate(() => window.__said); return s.length ? s : null; }, 20000, 'the governor to be voiced');
  results.governorSaid = said[0]; assert.ok(said[0].v && said[0].t.length > 10);
  await shot('03-governor-heard');
  // take a job: the NPC steps aside
  await open();
  await tap(btn('Take the pilot post'));
  await until(() => world.state.roles.humans['ceres/pilot-1']?.playerId === me.id, 20000, 'the pilot post');
  await page.waitForTimeout(600); await open();
  assert.match(await panelText(), /You are Pilot/); await shot('04-took-the-post');
  const bal0 = world.state.homes.ceres.balance, marks0 = world.state.ships[me.shipId].economy.marks;
  await tap(btn('Work a faction shift'));
  await until(() => world.state.ships[me.shipId].economy.marks > marks0, 20000, 'the shift to pay');
  results.afterShift = { balance: [bal0, world.state.homes.ceres.balance], marks: [marks0, world.state.ships[me.shipId].economy.marks], rep: world.state.roles.rep[me.id] };
  assert.ok(world.state.homes.ceres.balance < bal0);
  await page.waitForTimeout(600); await open(); await shot('05-after-shift');
  await tap(btn('Stand down (Pilot)'));
  await until(() => !world.state.roles.humans['ceres/pilot-1'], 20000, 'standing down');
  await page.waitForTimeout(500); await shot('06-stood-down');
  // no horizontal scroll, sheet fits the phone
  results.overflow = await page.evaluate(() => { const p = document.getElementById('multiplayer-panel'); return { scrollW: p.scrollWidth, clientW: p.clientWidth, docW: document.documentElement.scrollWidth, innerW: innerWidth }; });
  assert.ok(results.overflow.scrollW <= results.overflow.clientW + 1 && results.overflow.docW <= results.overflow.innerW + 1, 'no sideways scroll: ' + JSON.stringify(results.overflow));
  assert.equal(errors.length, 0, 'page errors: ' + errors.join(' | '));
  results.ok = true;
  console.log('ROLES BROWSER OK');
} catch (e) { results.ok = false; results.error = String(e.stack || e); console.error(results.error); process.exitCode = 1; }
finally {
  await writeFile(join(out, 'results.json'), JSON.stringify({ ...results, errors }, null, 2)).catch(() => {});
  await browser?.close().catch(() => {}); await app?.close?.().catch(() => {}); await rm(dir, { recursive: true, force: true }).catch(() => {});
  setTimeout(() => process.exit(process.exitCode || 0), 500);
}
