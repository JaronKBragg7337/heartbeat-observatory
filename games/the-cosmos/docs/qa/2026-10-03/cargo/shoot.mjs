// Pictures for the Drayman hauler, its rovers, and the market row. Not part of validate.mjs. Its own authority, never port 8390.
//   node docs/qa/2026-10-03/cargo/shoot.mjs
// Playwright Chromium on SwiftShader (the phone-sized shots use a 390x844 touch context; the iPhone WebKit run with real taps is test/cargo-browser.mjs).
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import '../../../../server/runtime.mjs';
import { startServer } from '../../../../server/index.mjs';
import { FileAdapter } from '../../../../server/storage.mjs';
import { createVehicle } from '../../../../src/vehicles/api.js';
import { STALLS } from '../../../../src/economy/shops.js';

const require = createRequire(process.env.COSMOS_PLAYWRIGHT_ROOT || 'C:/Users/lilli/.codex/runtime/unfinished-island/node_modules/');
const { chromium } = require('playwright');
const out = fileURLToPath(new URL('./', import.meta.url));
await mkdir(out, { recursive: true });
const temp = await mkdtemp(join(tmpdir(), 'cosmos-cargo-shoot-'));
const exe = process.env.COSMOS_CHROME || ['C:/Users/lilli/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
if (!exe) throw new Error('No Chromium executable found');
const DESK = { width: 1280, height: 720 }, PHONE = { width: 390, height: 844 };
let app, browser;
const errors = [], results = {};

try {
  app = await startServer({ adapter: new FileAdapter(join(temp, 'world.json')), port: 0, tick: false, now: () => Date.now() });
  const PORT = new URL(app.url.replace('ws:', 'http:')).port, WS = app.url, w = app.world;
  browser = await chromium.launch({ headless: true, executablePath: exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
  const lot = (id, mat, kg) => ({ lotId: id, materialId: mat, materialName: mat, massKg: kg, solidVolumeM3: kg / 1500, looseVolumeM3: kg / 1000, parts: [{ materialId: mat, massKg: kg, volumeM3: kg / 1500 }] });

  // two people made first: D (desktop, a hauler pilot with three rovers in the hold) and P (phone, another hauler pilot standing in the hold)
  const make = async (key, name) => {
    const p = await w.join(key, name);
    await w.enqueue(() => {
      const hauler = w.newOwnedShip(p, 'hauler', { how: 'bought', marks: 20000 });
      p.shipId = hauler.id; p.currentShipId = hauler.id;
    });
    return p;
  };
  const dKey = 'D'.repeat(48), pKey = 'P'.repeat(48);
  const D = await make(dKey, 'Jaron'), P = await make(pKey, 'Phone');
  w.advance(8);
  for (const [p, n] of [[D, 3], [P, 3]]) {
    await w.enqueue(() => {
      const ship = w.state.ships[p.shipId], def = w.sims.get(ship.id).def;
      for (let i = 0; i < n; i++) { const b = def.berths[[0, 3, 4][i]]; const v = createVehicle('survey', { id: `r-${p.id}-${i}`, owner: p.id, parentShipId: ship.id, pose: { x: b.x, y: 0, z: b.z, yaw: b.yaw } }); w.state.vehicles[v.id] = v; }
      ship.hold['salvage-alloy'] = 900; ship.economy.inventory.water = 40;
      w.state.revision++;
    });
  }

  // one stall is open for business, so the market row shows a live sign beside five that are for rent
  await w.enqueue(() => {
    w.state.shops['port-4'] = { id: 'port-4', ownerId: D.id, ownerName: 'Jaron', name: 'Jaron Salvage & Supply', rentedAt: w.state.clock, paidUntil: w.state.clock + 7 * 88775, listings: { water: { qty: 40, price: 6 }, 'salvage-alloy': { qty: 9, price: 42 }, parts: { qty: 3, price: 70 } }, lots: [], ledger: [], seq: 0, earned: 0, npcSol: 0, npcBought: {}, nextNpcAt: 0 };
    w.state.revision++;
  });
  const open = async (key, name, vp, extra = {}) => {
    const ctx = await browser.newContext({ viewport: vp, ...extra });
    await ctx.addInitScript(({ key, name }) => { localStorage.setItem('cosmos-device-v2', JSON.stringify({ key, name })); localStorage.setItem('hb-look', 'isaiah'); }, { key, name });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`http://127.0.0.1:${PORT}/?tier=low&dev=1&opening=off&ws=${encodeURIComponent(WS)}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.cosmos && window.cosmos.vehicles && window.cosmos.ship && window.cosmos.ship.ready, null, { timeout: 240000 });
    await page.evaluate(() => {
      window.__look = (eye, at) => { const c = cosmos; c.ship.aboard = false; if (c.multiplayer.panel) c.multiplayer.panel.hidden = true; c.freeCam.set(eye, at); c.vehicles.prepare(); c.vehicles.frame(1 / 30, { moveNorth: 0, moveEast: 0, look: { dx: 0, dy: 0 } }); for (let i = 0; i < 28; i++) c.step(1 / 30); };
      window.__ext = (off, look) => { cosmos.ship.scene.visible = false; const f = cosmos.ship.flight; window.__look(f.toWorld({ x: off[0], y: off[1], z: off[2] }), f.toWorld({ x: look[0], y: look[1], z: look[2] })); };
      window.__in = (room, x, z, yaw, pitch) => { cosmos.ship.scene.visible = true; cosmos.freeCam.off(); cosmos.vehicles.prepare(); cosmos.ship.debugAt(room, x, z, yaw, pitch, 40); };
      window.__site = (x, y, z, tx, ty, tz) => { const s = cosmos.port.site; cosmos.ship.scene.visible = false; cosmos.ship.aboard = false; const g = s.toWorld(x, 0.05, z), w = cosmos.walker; w.worldPos.x = g.x; w.worldPos.y = g.y; w.worldPos.z = g.z; w.velocity = { x: 0, y: 0, z: 0 }; w.grounded = true; w.updateFrame?.(); cosmos.rebuildNear(true); for (let i = 0; i < 12; i++) cosmos.step(1 / 30); window.__look(s.toWorld(x, y, z), s.toWorld(tx, ty, tz)); };
    });
    await page.evaluate(() => cosmos.engine.stop());
    return page;
  };
  const sync = async (page) => {
    await w.enqueue(() => w.commit());
    const rev = w.state.revision;
    await page.evaluate(() => { try { cosmos.world.socket.send(JSON.stringify({ type: 'checkpoint' })); } catch (e) {} });
    await page.waitForFunction((r) => cosmos.world.snapshot && cosmos.world.snapshot.revision >= r, rev, { timeout: 30000 });
    await page.evaluate(() => { cosmos.multiplayer.forcePlayer = true; cosmos.multiplayer.apply({ bricks: [] }); cosmos.vehicles.prepare(); for (let i = 0; i < 8; i++) cosmos.step(1 / 30); });
  };
  const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
  const shot = async (page, name) => { if (ONLY && !ONLY.includes(name)) return; await page.screenshot({ path: join(out, name + '.jpg'), type: 'jpeg', quality: 84 }); console.log('shot', name); };

  console.log('loading desktop');
  const desk = await open(dKey, 'Jaron', DESK);
  results.type = await desk.evaluate(() => cosmos.ship.def.type);
  if (results.type !== 'hauler') throw new Error('the flagship did not load as a hauler: ' + results.type);
  await sync(desk);
  // outside: the whole ship, three quarters from the bow, the stern with the ramp down, a flank
  await desk.evaluate(() => { cosmos.multiplayer.panel && (cosmos.multiplayer.panel.hidden = true); });
  await desk.evaluate(() => window.__ext([-34, 6.5, -42], [0, 1.5, 4]));
  await shot(desk, 'd_ext_bow_three_quarter');
  await desk.evaluate(() => window.__ext([30, 9, 50], [-1, 1.5, 6]));
  await shot(desk, 'd_ext_stern_three_quarter');
  await desk.evaluate(() => window.__ext([-26, 2.0, 10], [0, 1.8, 8]));
  await shot(desk, 'd_ext_flank');
  // ramp down (server-side), rovers visible inside
  const dShip = w.state.players[D.id].shipId, dSim = w.sims.get(dShip);
  await w.enqueue(() => { const c = dSim.ship.rampCtl.cargo; dSim.ship._solveRamp('cargo'); c.target = 1; dSim.ship.state.ramps.cargo.target = 1; });
  for (let i = 0; i < 40; i++) w.advance(0.5);
  await sync(desk);
  await desk.evaluate(() => window.__ext([9, 3.2, 52], [0, 1.4, 22]));
  await shot(desk, 'd_ext_ramp_down');
  await desk.evaluate(() => window.__ext([0, 2.4, 46], [0, 1.7, 26]));
  await shot(desk, 'd_ext_ramp_head_on');
  // inside
  await desk.evaluate(() => window.__in('cockpit', 0, -10.8, 0, -9));
  await shot(desk, 'd_in_flight_deck');
  await desk.evaluate(() => window.__in('cockpit', 2.6, -13.4, -90, -12));
  await shot(desk, 'd_in_flight_deck_side');
  await desk.evaluate(() => window.__in('crew_a', -3.0, -4.2, -20, -2));
  await shot(desk, 'd_in_crew_berth');
  await desk.evaluate(() => window.__in('galley', 2.4, -4.2, 20, -2));
  await shot(desk, 'd_in_mess');
  await desk.evaluate(() => window.__in('control', 2.0, -2.4, 70, 0));
  await shot(desk, 'd_in_cargo_control');
  await desk.evaluate(() => window.__in('engine', 0.2, 8.0, 160, -5));
  await shot(desk, 'd_in_engine_room');
  await desk.evaluate(() => window.__in('hold', 0, 14.2, 180, -6));
  await shot(desk, 'd_in_hold_aft');
  await desk.evaluate(() => window.__in('hold', 0, 30.4, 0, -4));
  await shot(desk, 'd_in_hold_fore');
  await desk.evaluate(() => window.__in('hold', 0.4, 27.6, 90, -18));
  await shot(desk, 'd_in_hold_berths');
  // the market row
  await desk.evaluate(() => { cosmos.freeCam.off(); });
  await desk.evaluate(() => window.__site(4, 3.2, 41, -1, 2, 60));
  await shot(desk, 'd_market_row');
  await desk.evaluate(() => window.__site(-3, 2.2, 53, -4, 2.1, 60));
  await shot(desk, 'd_market_stall_close');

  await desk.evaluate(() => window.__site(-32.8, 2.4, 36.2, -36, 1.7, 40.2));
  await shot(desk, 'd_shipyard_kiosk');
  console.log('loading phone');
  await w.enqueue(() => {
    const pp = w.state.players[P.id], ship = w.state.ships[pp.shipId], sim = w.sims.get(ship.id), b = sim.def.berths[0];
    pp.aboardShipId = ship.id; pp.pose.aboard = true; pp.pose.seat = null; pp.frameId = sim.frameId;
    pp.pose.sw = { x: b.x + 2.4, y: 0, z: b.z + 0.8, yaw: -1.25, pitch: -0.12 }; sim.flight.toWorld(pp.pose.sw, pp.pose.worldPos);
    w.state.revision++;
  });
  const phone = await open(pKey, 'Phone', PHONE, { isMobile: true, hasTouch: true });
  await sync(phone);
  await phone.evaluate(() => { cosmos.freeCam.off(); for (let i = 0; i < 20; i++) cosmos.step(1 / 30); });
  results.phoneButton = await phone.evaluate(() => { const b = document.getElementById('btn-action'); return { text: b.textContent, shown: getComputedStyle(b).display !== 'none' }; });
  await shot(phone, 'p_hold_rover_prompt');
  await phone.evaluate(() => window.__in('cockpit', 0, -10.8, 0, -9));
  await shot(phone, 'p_in_flight_deck');
  await phone.evaluate(() => window.__in('hold', 0, 14.6, 180, -8));
  await shot(phone, 'p_in_hold');

  results.errors = errors;
  await writeFile(join(out, 'shoot-results.json'), JSON.stringify(results, null, 2));
  console.log('errors', errors.length); if (errors.length) console.log(errors.join('\n'));
} finally {
  if (browser) await browser.close();
  if (app) await app.close();
  await rm(temp, { recursive: true, force: true });
}
