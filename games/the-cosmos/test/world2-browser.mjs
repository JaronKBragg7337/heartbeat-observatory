// World 2 on a phone: real iPhone-profile WebKit taps at Occator Works (solo game, the same code the shared world runs on the client):
//   land on Ceres, walk to the supply desk, tap Talk, tap "what you buy", tap Sell and see the purse change; open the nav computer and tap the
//   course to Ceres from Mars and see the trip begin. Screenshots go to docs/qa/2026-10-03/world2/.
//   node test/world2-browser.mjs
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createServer as netServer } from 'node:net';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url)), root = dirname(here);
let pw; try { pw = createRequire(import.meta.url)('playwright'); } catch { pw = createRequire(process.env.COSMOS_PLAYWRIGHT_ROOT || join(homedir(), '.codex/runtime/unfinished-island/node_modules/'))('playwright'); }
const out = join(root, 'docs', 'qa', '2026-10-03', 'world2'); await mkdir(out, { recursive: true });
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const freePort = () => new Promise((r) => { const s = netServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const port = await freePort();
const server = spawn(process.execPath, [join(root, 'server.js')], { env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/build.json`)).ok) break; } catch {} await sleep(100); }
const results = [], errors = [];
const ok = (name, pass, detail = '') => { results.push({ name, pass, detail }); console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass ? '' : '  ' + detail)); };
let browser;
try {
  browser = await pw.webkit.launch({ headless: true, executablePath: process.env.COSMOS_WEBKIT || join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'webkit-2336', 'Playwright.exe') });
  const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage(); page.setDefaultTimeout(180000);
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 300)); });
  await page.goto(`http://127.0.0.1:${port}/?dev=1&solo=1&opening=off&tier=low&depth=16`, { waitUntil: 'commit', timeout: 240000 });
  await page.waitForFunction(() => window.cosmos && cosmos.engine && cosmos.engine.frameCount >= 2, null, { timeout: 300000 });
  await sleep(2500);
  const tap = async (sel, textRe) => {
    const r = await page.evaluate(([sel, re]) => { const els = [...document.querySelectorAll(sel)].filter((e) => !re || new RegExp(re).test(e.textContent)); const e = els[0]; if (!e) return null; e.scrollIntoView({ block: 'center' }); const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width, h: b.height, disabled: !!e.disabled }; }, [sel, textRe ? textRe.source : null]);
    if (!r || r.disabled) return false;
    await page.touchscreen.tap(r.x, r.y); return true;
  };

  // ---- the nav computer, from Mars: the course to Ceres is offered with its fee, and a tap starts it
  await page.evaluate(() => { const c = cosmos; c.ship.aboard = true; c.space.ui._seatOk = () => true; c.space.ui.toggle('course'); c.space.ui.draw(true); });
  await sleep(500);
  const row = await page.evaluate(() => { const b = document.querySelector('#space-sheet [data-d="ceres"]'); return b ? { text: b.textContent, disabled: b.disabled } : null; });
  ok('the nav computer lists Ceres: Occator Works with its lane fee and it can be tapped', !!row && !row.disabled && /Occator Works/.test(row.text) && /120 credits/.test(row.text) && /about/.test(row.text), JSON.stringify(row));
  await page.screenshot({ path: join(out, 'phone-nav-ceres.png') });
  const under = await page.evaluate(() => { const b = document.querySelector('#space-sheet [data-d="ceres"]'); b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(), e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { hit: e && (e.id || e.className || e.tagName), isBtn: !!e && (e === b || b.contains(e)), rect: [r.x, r.y, r.width, r.height].map(Math.round) }; });
  console.log('what is under the tap point:', JSON.stringify(under));
  await page.screenshot({ path: join(out, 'phone-nav-ceres-scrolled.png') });
  const tapped = await tap('#space-sheet [data-d="ceres"]');
  await sleep(600);
  const trip = await page.evaluate(() => { const t = cosmos.space.trip; return t ? { active: t.active, dest: t.dest.id, jump: t._crossing && t._crossing() } : { none: true, log: cosmos.space.log.slice(-2).map((l) => l.text), aboard: cosmos.ship.aboard }; });
  ok('tapping it starts a course across the Ore Lane', tapped && !!trip && trip.active && trip.dest === 'ceres' && trip.jump === true, JSON.stringify(trip));
  await page.evaluate(() => { cosmos.space.cancel(); cosmos.space.ui.close(); });

  // ---- on the ground at Occator Works
  await page.evaluate(() => { const c = cosmos; c.space.trip = null; c.ship.flight.override = null; c.space.debugStand('ceres'); c.ship.aboard = false; for (let i = 0; i < 20; i++) c.step(1 / 30); });
  await page.waitForFunction(() => { const w = cosmos.space.worlds.get('ceres'); return w && w.client && w.client.people.members.length === 7 && w.client.people.members.every((m) => m.person.loaded !== false); }, null, { timeout: 240000 }).catch(async () => { console.log('people wait failed', JSON.stringify(await page.evaluate(() => { for (let i = 0; i < 5; i++) cosmos.step(1 / 30); const w = cosmos.space.worlds.get('ceres'); const cam = cosmos.space._camIn(w, cosmos.space._cam); console.log('x'); const eg = cosmos.space.engine;  return { frame: cosmos.space.frameId, hasW: !!w, client: !!(w && w.client), built: !!(w && w.client && w.client.people.built), n: w && w.client ? w.client.people.members.length : -1, lib: !!cosmos.space.peopleLib, built0: w && w.built, af: eg.activeFrame.id || eg.activeFrame.name, wf: w.frame.id || w.frame.name, cwp: eg.cameraWorldPos, ao: eg.activeFrame.origin, wo: w.frame.origin, camR: Math.hypot(cam.x, cam.y, cam.z), rad: w.body.radiusMean, upd: String(w.client.update).slice(0, 60), active: w && w.active, }; }))); });
  const stand = (id, dx, dz) => page.evaluate(async ([id, dx, dz]) => {
    const c = cosmos, w = c.space.worlds.get('ceres'), m = w.client.people.members.find((q) => q.id === id), pi = w.body.padInfo;
    const x = m.x + dx, z = m.z + dz, p = { x: pi.point.x + pi.east.x * x - pi.north.x * z + pi.up.x * 0.3, y: pi.point.y + pi.east.y * x - pi.north.y * z + pi.up.y * 0.3, z: pi.point.z + pi.east.z * x - pi.north.z * z + pi.up.z * 0.3 };
    const wk = c.walker; wk.worldPos.x = p.x; wk.worldPos.y = p.y; wk.worldPos.z = p.z; wk.velocity = { x: 0, y: 0, z: 0 }; wk.updateFrame(); w.force(p);
    // face the person
    const f = wk.updateFrame(), d = { x: -dx, z: -dz }; wk.yaw = 0;
    for (let i = 0; i < 30; i++) c.step(1 / 30);
    return { name: m.name };
  }, [id, dx, dz]);
  await stand('supply', 2.2, 0);
  await page.evaluate(() => { const e = cosmos.world.state.economy; e.inventory.parts = 5; e.inventory.water = 20; });
  const talk = await page.waitForFunction(() => getComputedStyle(document.getElementById('crew-talk')).display !== 'none', null, { timeout: 15000 }).then(() => true, () => false);
  ok('standing at the supply desk, the Talk button shows the clerk', talk && (await page.evaluate(() => document.getElementById('crew-talk').textContent)).includes('Idris Kell'));
  await page.screenshot({ path: join(out, 'phone-talk-button.png') });
  await tap('#crew-talk'); await sleep(500);
  ok('a real tap on Talk opens the clerk\'s panel, inside the screen', await page.evaluate(() => { const p = document.getElementById('crew-panel'), r = p.getBoundingClientRect(); return cosmos.crewUI.open && /Idris Kell/.test(p.textContent) && r.left >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 && r.top >= 0; }));
  await page.screenshot({ path: join(out, 'phone-talk-panel.png') });
  await tap('#crew-panel button', /what you buy/); await sleep(400);
  const m0 = await page.evaluate(() => cosmos.world.state.economy.marks);
  await tap('#crew-panel button', /Sell 1 · 150 marks/); await sleep(500);
  const m1 = await page.evaluate(() => cosmos.world.state.economy.marks), parts = await page.evaluate(() => cosmos.world.state.economy.inventory.parts);
  ok('tapping Sell 1 on the spare parts pays 150 marks and takes one kit from the supplies', m1 - m0 === 150 && parts === 4, `marks ${m0} -> ${m1}, parts ${parts}`);
  await page.screenshot({ path: join(out, 'phone-talk-trade.png') });
  await page.evaluate(() => cosmos.crewUI.close());
  // the foreman: ore from the hold
  await stand('foreman', 1.2, 2.4);
  await page.evaluate(() => {
    const e = cosmos.world.state.economy; e.hold = e.hold || {}; e.hold['ceres-ore'] = 2500;
    cosmos.space.jobs.hold = [{ lotId: 'z', materialId: 'MAT-CERES-ORE', materialName: 'Ferro-nickel ore', massKg: 2500, solidVolumeM3: 0.58, looseVolumeM3: 0.9, parts: [{ materialId: 'MAT-CERES-ORE', massKg: 2500, volumeM3: 0.58 }] }];
  });
  await sleep(500); await tap('#crew-talk'); await sleep(500);
  await tap('#crew-panel button', /ore or salt to sell/); await sleep(400);
  const o0 = await page.evaluate(() => cosmos.world.state.economy.marks);
  await tap('#crew-panel button', /Sell 1 tonne/); await sleep(500);
  const o1 = await page.evaluate(() => ({ marks: cosmos.world.state.economy.marks, hold: cosmos.world.state.economy.hold['ceres-ore'] }));
  ok('selling a tonne of ore to the foreman pays 130 marks and leaves 1.5 t', o1.marks - o0 === 130 && Math.abs(o1.hold - 1500) < 1e-6, JSON.stringify({ o0, o1 }));
  await page.screenshot({ path: join(out, 'phone-talk-ore.png') });
  await page.evaluate(() => cosmos.crewUI.close());
  // a look at the Works at phone width
  await page.evaluate(() => { const c = cosmos, w = c.space.worlds.get('ceres'), pi = w.body.padInfo; const pt = (e, n, u) => ({ x: pi.point.x + pi.east.x * e + pi.north.x * n + pi.up.x * u, y: pi.point.y + pi.east.y * e + pi.north.y * n + pi.up.y * u, z: pi.point.z + pi.east.z * e + pi.north.z * n + pi.up.z * u }); const eye = pt(30, -55, 3); c.walker.worldPos.x = eye.x; c.walker.worldPos.y = eye.y; c.walker.worldPos.z = eye.z; c.walker.yaw = 0.3; c.walker.pitch = 0.1; w.force(eye); for (let i = 0; i < 30; i++) c.step(1 / 30); });
  await sleep(600); await page.screenshot({ path: join(out, 'phone-works.png') });
  ok('no page errors', errors.length === 0, errors.join(' | '));
} catch (e) { console.error(e); ok('the scenario ran to the end', false, String(e)); }
finally { try { await browser?.close(); } catch {} try { server.kill(); } catch {} }
const failed = results.filter((r) => !r.pass);
console.log(failed.length ? `FAILED ${failed.length}/${results.length}` : `PASSED ${results.length}/${results.length}`);
setTimeout(() => process.exit(failed.length ? 1 : 0), 500);
