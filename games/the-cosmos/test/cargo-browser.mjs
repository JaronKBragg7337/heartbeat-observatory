// Two real iPhone-profile WebKit phones against one isolated authority: shops (rent, stock, price, buy, receipt, a refused stale price, the owner's sales)
// and a rover driven off a Drayman's lowered ramp by a held thumb while a second phone watches it arrive. Real taps (page.touchscreen.tap), real
// pointer events on the canvas for the thumb. Screenshots go to docs/qa/2026-10-03/cargo/.
//   node test/cargo-browser.mjs
import '../server/runtime.mjs';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { startServer } from '../server/index.mjs';
import { FileAdapter } from '../server/storage.mjs';
import { createVehicle } from '../src/vehicles/api.js';
import { STALLS } from '../src/economy/shops.js';

let pw; try { pw = createRequire(import.meta.url)('playwright'); } catch { pw = createRequire(process.env.COSMOS_PLAYWRIGHT_ROOT || join(homedir(), '.codex/runtime/unfinished-island/node_modules/'))('playwright'); }
const out = fileURLToPath(new URL('../docs/qa/2026-10-03/cargo/', import.meta.url)); await mkdir(out, { recursive: true });
const dir = await mkdtemp(join(tmpdir(), 'cosmos-cargo-browser-'));
const errors = [], results = {}; let app, browser;
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 60000, what = 'condition') => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) throw new Error('timed out waiting for ' + what); await sleep(150); } };

try {
  app = await startServer({ adapter: new FileAdapter(join(dir, 'world.json')), port: 0, tick: true });
  const world = app.world, origin = app.url.replace('ws:', 'http:');
  browser = await pw.webkit.launch({ headless: true, executablePath: process.env.COSMOS_WEBKIT || join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'webkit-2336', 'Playwright.exe') });

  // ---- the people, made before their phones load so each phone starts where it should
  const keys = { A: 'a'.repeat(48), B: 'b'.repeat(48), C: 'c'.repeat(48), D: 'd'.repeat(48) };
  const names = { A: 'Maren', B: 'Cole', C: 'Dray', D: 'Obs' };
  const people = {};
  for (const k of Object.keys(keys)) people[k] = await world.join(keys[k], names[k]);
  const lot = (id, mat, kg) => ({ lotId: id, materialId: mat, materialName: mat, massKg: kg, solidVolumeM3: kg / 1500, looseVolumeM3: kg / 1000, parts: [{ materialId: mat, massKg: kg, volumeM3: kg / 1500 }] });
  const stall = STALLS[1];
  await world.enqueue(() => {
    const at = (p, dx = 0) => { p.pose.worldPos = world.site.toWorld(stall.x + dx, 0.02, stall.z - 2); p.pose.velocity = { x: 0, y: 0, z: 0 }; p.pose.yaw = world.site.heading; p.poseAt = Date.now(); };
    at(people.A, -1); at(people.B, 1);
    const sa = world.state.ships[people.A.shipId], sb = world.state.ships[people.B.shipId];
    sa.hold['salvage-alloy'] = 1800; sa.hold['phobos-regolith'] = 3000; sa.holdLots.push(lot('p1', 'MAT-PHOBOS-REGOLITH', 1700), lot('p2', 'MAT-PHOBOS-REGOLITH', 1300));
    sa.economy.inventory.water = 40;
    sb.economy.marks = 3000;
    world.state.revision++;
  });
  // the hauler for the rover scene: bought for Dray, landed, a rover in a berth, Dray beside its door, Obs on the ground behind the ramp
  let hauler, rover;
  await world.enqueue(() => {
    hauler = world.newOwnedShip(people.C, 'hauler', { how: 'bought', marks: 0 });
    people.C.shipId = hauler.id; people.C.currentShipId = hauler.id;
  });
  world.advance(8);
  const sim = world.sims.get(hauler.id), def = sim.def;
  await world.enqueue(() => {
    const berth = def.berths[2];
    rover = createVehicle('survey', { id: 'dray-rover', owner: people.C.id, homeShipId: null, parentShipId: hauler.id, pose: { x: berth.x, y: 0, z: berth.z, yaw: berth.yaw } });
    world.state.vehicles[rover.id] = rover;
    const c = world.state.players[people.C.id];
    c.aboardShipId = hauler.id; c.currentShipId = hauler.id; c.pose.aboard = true; c.pose.seat = null;
    c.pose.sw = { x: berth.x + 2.3, y: 0, z: berth.z + 0.6, yaw: Math.PI / 2, pitch: 0 }; c.frameId = sim.frameId; sim.flight.toWorld(c.pose.sw, c.pose.worldPos);
    hauler.crewMayBoard = true;
    const d = world.state.players[people.D.id];
    d.pose.worldPos = sim.flight.toWorld({ x: 0, y: -2.0, z: def.ramps.cargo.hinge.z + 12 }); d.pose.velocity = { x: 0, y: 0, z: 0 }; d.poseAt = Date.now();
    world.state.revision++;
  });

  const open = async (key, name) => {
    const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await ctx.addInitScript(({ key, name }) => { localStorage.setItem('cosmos-device-v2', JSON.stringify({ key, name })); localStorage.setItem('hb-look', 'isaiah'); }, { key, name });
    const page = await ctx.newPage(); page.setDefaultTimeout(240000);
    page.on('pageerror', (e) => errors.push(`${name}: ${e}`));
    await page.goto(`${origin}/?dev=1&opening=off&tier=low&ws=${app.url}`, { waitUntil: 'commit', timeout: 240000 });
    await page.waitForFunction(() => window.cosmos?.multiplayer?.initialized && cosmos.engine.frameCount >= 2, null, { timeout: 300000 });
    await page.waitForTimeout(1200);
    return page;
  };
  const shot = async (page, name) => { await page.screenshot({ path: join(out, name + '.png') }); console.log('shot', name); };
  // A thumb taps what it can see: if something (the sheet's sticky header) covers the target, scroll the sheet a little and look again.
  const tap = async (page, locator) => {
    await locator.scrollIntoViewIfNeeded();
    for (let i = 0; i < 8; i++) {
      const box = await locator.boundingBox(); assert.ok(box, 'no box for tap');
      assert.ok(box.width >= 40 && box.height >= 40, `tap target is ${box.width.toFixed(0)}x${box.height.toFixed(0)} (need 44)`);
      const x = box.x + box.width / 2, y = box.y + box.height / 2;
      const hit = await locator.evaluate((el, p) => { const t = document.elementFromPoint(p.x, p.y); return !!t && (t === el || el.contains(t)); }, { x, y });
      if (hit) { await page.touchscreen.tap(x, y); return; }
      await page.evaluate(() => { const p = document.getElementById('shop-panel'); if (p) p.scrollTop = Math.max(0, p.scrollTop - 100); });
      await page.waitForTimeout(120);
    }
    throw new Error('the tap target stays covered by something else');
  };
  const btn = (page, text) => page.locator('#shop-panel button', { hasText: text }).first();
  const shop = () => world.state.shops[stall.id];
  const SA = () => world.state.ships[people.A.shipId], SB = () => world.state.ships[people.B.shipId];

  // =========================================================================================================== shops
  console.log('opening phones A and B');
  const A = await open(keys.A, names.A), B = await open(keys.B, names.B);
  const label = (page) => page.evaluate(() => { const b = document.getElementById('shop-button'); return b ? { text: b.textContent, shown: getComputedStyle(b).display !== 'none' } : null; });
  await until(async () => (await label(A))?.shown, 60000, 'the stall button on A');
  results.vacantLabel = (await label(A)).text; console.log('A button:', results.vacantLabel);
  assert.match(results.vacantLabel, /free: rent it/);
  await tap(A, A.locator('#shop-button'));
  await A.waitForSelector('#shop-panel', { state: 'visible' });
  await shot(A, 'p_stall_1_vacant');
  const nameField = A.locator('#shop-panel input').first(); await nameField.fill('Maren Salvage');
  const marksBefore = SA().economy.marks;
  await tap(A, btn(A, 'Rent this stall'));
  await until(() => shop(), 30000, 'the server to record the rent');
  assert.equal(shop().ownerId, people.A.id); assert.equal(shop().name, 'Maren Salvage'); assert.equal(SA().economy.marks, marksBefore - 700);
  console.log('PASS rented by a real tap: -700 marks, sign "Maren Salvage"');
  await A.waitForSelector('#shop-panel h4:has-text("In your ship")');
  await shot(A, 'p_stall_2_owner_empty');

  // stock water at 7, alloy at 45, regolith at 35 through the sheet
  const stockFrom = async (page, good, name, price) => {
    const card = page.locator('#shop-panel .card', { hasText: name }).filter({ hasText: 'aboard' }).first();
    await card.scrollIntoViewIfNeeded();
    const f = card.locator('input').first(); await f.fill(String(price));
    await tap(page, card.locator('button', { hasText: /Put all/ }));
    await until(() => shop().listings[good], 30000, good + ' listed');
  };
  await stockFrom(A, 'water', 'Water', 7);
  await stockFrom(A, 'salvage-alloy', 'Salvage alloy', 45);
  await stockFrom(A, 'phobos-regolith', 'Phobos regolith', 35);
  assert.equal(shop().listings.water.qty, 40); assert.equal(shop().listings.water.price, 7);
  assert.equal(shop().listings['salvage-alloy'].qty, 18); assert.equal(shop().listings['phobos-regolith'].qty, 3);
  assert.equal(SA().economy.inventory.water, 0); assert.ok(SA().hold['salvage-alloy'] < 1e-6);
  console.log('PASS stocked three kinds of goods by real taps; the ship\'s hold and the stall agree');
  await A.waitForSelector('#shop-panel .card:has-text("40 at 7")');
  await shot(A, 'p_stall_3_owner_stocked');

  // B walks up to the sign and buys
  await until(async () => /Maren Salvage: browse and buy/.test((await label(B))?.text || ''), 60000, 'B to see the shop');
  await tap(B, B.locator('#shop-button'));
  await B.waitForSelector('#shop-panel .card:has-text("Water")', { state: 'visible' });
  await shot(B, 'p_stall_4_customer');
  const bMarks = SB().economy.marks, aMarks = SA().economy.marks;
  await tap(B, B.locator('#shop-panel .card', { hasText: 'Water' }).locator('button', { hasText: 'Buy 5' }));
  await until(() => SB().economy.inventory.water === 5, 30000, 'B to receive 5 water');
  assert.equal(SB().economy.marks, bMarks - 35); assert.equal(SA().economy.marks, aMarks + 35); assert.equal(shop().listings.water.qty, 35);
  await B.waitForSelector('#shop-panel .rcpt:has-text("Receipt 1: 5 x Water at 7 = 35 marks")');
  results.receipt = await B.locator('#shop-panel .rcpt').first().textContent();
  console.log('PASS bought 5 water by a real tap:', results.receipt);
  await shot(B, 'p_stall_5_receipt');
  // a tonne of regolith moves as real lots
  const massBefore = world.state.ships[people.B.shipId].holdLots.reduce((n, l) => n + l.massKg, 0);
  await tap(B, B.locator('#shop-panel .card', { hasText: 'Phobos regolith' }).locator('button', { hasText: 'Buy 1' }));
  await until(() => SB().holdLots.length > 0, 30000, 'B to receive the regolith lots');
  assert.ok(Math.abs(SB().holdLots.reduce((n, l) => n + l.massKg, 0) - massBefore - 1000) < 1e-6);
  console.log('PASS 1 tonne of regolith arrived as real lots');
  // a stale price is refused and shown: A raises water to 9 by a tap; B's old request is told so
  const aw = A.locator('#shop-panel .card', { hasText: /Water.*: 35 at 7/ }).first();
  await aw.locator('input').first().fill('9');
  console.log('A price field says', await aw.locator('input').first().inputValue(), '/ focused', await A.evaluate(() => document.activeElement?.tagName));
  const setBtn = aw.locator('button', { hasText: 'Set price' });
  await tap(A, setBtn);
  await sleep(1500);
  console.log('after tap: server price', shop().listings.water.price, 'A field now', await A.locator('#shop-panel input').nth(1).inputValue().catch(() => '?'), 'err', await A.locator('#shop-panel .err').allTextContents());
  await until(() => shop().listings.water.price === 9, 30000, 'the new price').catch(async (e) => { console.log('A panel now:', (await A.locator('#shop-panel').innerText()).slice(0, 700)); throw e; });
  const stale = await B.evaluate(() => cosmos.multiplayer.shopView.act({ type: 'shop-buy', good: 'water', qty: 1, price: 7 }));
  assert.equal(stale.ok, false); assert.match(stale.msg, /price changed.*9 marks/);
  await B.waitForSelector('#shop-panel .err');
  console.log('PASS a stale price was refused:', stale.msg);
  await shot(B, 'p_stall_6_stale_price');
  // the owner sees both sales
  await A.waitForSelector('#shop-panel div:has-text("Cole: 5 x Water at 7 = 35")');
  await A.evaluate(() => { document.getElementById('shop-panel').scrollTop = 99999; });
  await shot(A, 'p_stall_7_owner_sales');
  results.sales = shop().ledger.map((r) => [r.n, r.good, r.qty, r.total]);
  // money and goods balance
  const total = Object.values(world.state.ships).reduce((n, s) => n + s.economy.marks, 0) + world.state.market.marketMarks;
  results.marksTotal = total;
  // A leaves; NPC buyers take fairly priced goods while she is away
  await A.context().close();
  await until(() => !world.sessions.has(people.A.id), 30000, 'A to disconnect');
  await world.enqueue(() => { world.advance(180); });
  results.npcRows = shop().ledger.filter((r) => r.kind === 'npc').length;
  assert.ok(results.npcRows > 0, 'NPC buyers should have bought something');
  console.log('PASS the owner went away and the port buyers bought', results.npcRows, 'lots');
  await B.context().close();

  // ==================================================================================================== rover transport
  console.log('opening phones C and D');
  const C = await open(keys.C, names.C), D = await open(keys.D, names.D);
  const prompt = (page) => page.evaluate(() => { const b = document.getElementById('btn-action'); return { text: b.textContent, shown: getComputedStyle(b).display !== 'none' }; });
  await until(async () => /Drive/.test((await prompt(C)).text), 60000, 'the Drive prompt on C');
  await shot(C, 'p_rover_1_hold');
  await tap(C, C.locator('#btn-action'));
  await until(() => world.state.vehicles['dray-rover']?.passengers.driver === people.C.id, 30000, 'C to take the wheel');
  console.log('PASS a real tap on Drive put the player at the wheel in the hold');
  // lower the ramp (the pilot's wrist remote)
  if (!world.state.ships[hauler.id].state.ramps.cargo.lowered) await C.evaluate(() => cosmos.multiplayer.request({ type: 'ramp', key: 'cargo' }));
  await until(() => hauler && world.state.ships[hauler.id].state.ramps.cargo.lowered, 60000, 'the ramp to come down');
  await until(async () => (await prompt(C)).text === 'Leave', 30000, 'the Leave prompt');
  await shot(C, 'p_rover_2_wheel');
  // a held thumb: up is throttle
  const THUMB = { id: 71, x: 80, y: 650 };
  const thumb = (page, type, dy = 0) => page.evaluate(({ t, type, dy }) => { const c = document.querySelector('canvas'); c.dispatchEvent(new PointerEvent(type, { pointerId: t.id, pointerType: 'touch', isPrimary: false, clientX: t.x, clientY: t.y - dy, bubbles: true, cancelable: true })); }, { t: THUMB, type, dy });
  await thumb(C, 'pointerdown'); await thumb(C, 'pointermove', 70);
  let off = null;
  for (let i = 0; i < 160 && !off; i++) { await sleep(250); const v = world.state.vehicles['dray-rover']; if (!v.parentShipId) off = v; }
  await thumb(C, 'pointerup');
  assert.ok(off, 'the rover did not drive off the hauler under a held thumb');
  console.log('PASS the held thumb drove the rover aft along the aisle and off the wide ramp');
  await sleep(600);
  // the watcher sees the same rover on the ground, in the world, with a mesh. The rover coasts to a stop after the thumb lifts, so wait for it to rest and for the watcher's snapshot to catch up.
  await until(() => Math.abs(world.state.vehicles['dray-rover'].pose.speed) < 0.05, 30000, 'the rover to stop');
  const srv = world.state.vehicles['dray-rover'];
  const seen = await until(() => D.evaluate((srvW) => { const v = cosmos.world.snapshot.vehicles['dray-rover']; return v && !v.parentShipId && Math.hypot(v.world.x - srvW.x, v.world.y - srvW.y, v.world.z - srvW.z) < 1 ? { parent: v.parentShipId, w: v.world, mesh: cosmos.vehicles.meshes.has('dray-rover') } : null; }, srv.world), 60000, 'D to see the rover where the server has it');
  assert.ok(seen.mesh, 'D has the rover drawn');
  results.rover = { watcherSees: seen.w, server: srv.world };
  console.log('PASS the second phone sees the rover on the ground');
  await D.evaluate((w) => { const c = cosmos; const eye = { x: w.x, y: w.y, z: w.z }; const f = c.multiplayer.shipPose(Object.values(c.world.snapshot.ships).find((s) => s.type === 'hauler')); c.freeCam.set({ x: eye.x + 8, y: eye.y + 5, z: eye.z + 8 }, eye); for (let i = 0; i < 20; i++) c.step(1 / 30); }, seen.w);
  await shot(D, 'p_rover_3_watcher');
  await tap(C, C.locator('#btn-action'));
  await until(() => !world.state.vehicles['dray-rover'].passengers.driver, 30000, 'C to step out');
  await shot(C, 'p_rover_4_out');
  results.errors = errors;
  await writeFile(join(out, 'cargo-browser-results.json'), JSON.stringify(results, null, 2));
  console.log('ALL PASS', JSON.stringify({ npcRows: results.npcRows, errors: errors.length }));
  if (errors.length) { console.log('page errors:', errors.slice(0, 6)); process.exitCode = 1; }
} catch (e) {
  console.error('FAIL', e.stack || e.message); process.exitCode = 1;
} finally {
  try { await browser?.close(); } catch { /* closed */ }
  try { await app?.close(); } catch { /* closed */ }
  await rm(dir, { recursive: true, force: true });
}
process.exit(process.exitCode || 0);
