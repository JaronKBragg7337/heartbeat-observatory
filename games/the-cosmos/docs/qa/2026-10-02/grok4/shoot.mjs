// Pictures for server-held pilot orders and per-player moon pads.
// Not part of validate.mjs: it needs Chromium. Its own authority, never port 8390.
//   node docs/qa/2026-10-02/grok4/shoot.mjs
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../../../../server/index.mjs';
import { FileAdapter } from '../../../../server/storage.mjs';
import { makeMoon } from '../../../../src/space/moonField.js';

const require = createRequire(process.env.COSMOS_PLAYWRIGHT_ROOT || 'C:/Users/lilli/.codex/runtime/unfinished-island/node_modules/');
const { chromium } = require('playwright');
const out = fileURLToPath(new URL('./', import.meta.url));
await mkdir(out, { recursive: true });
const temp = await mkdtemp(join(tmpdir(), 'cosmos-grok4-shoot-'));
const exe = process.env.COSMOS_CHROME || ['C:/Users/lilli/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
if (!exe) throw new Error('No Chromium executable found');

const DESK = { width: 1280, height: 720 };
const PHONE = { width: 390, height: 844 };
let app, browser;
const errors = [];
const results = {};

const add = (a, b, s = 1) => ({ x: a.x + b.x * s, y: a.y + b.y * s, z: a.z + b.z * s });

/** Put a ship down on its own moon pad and step the descent until the gear is on the plane. */
function landOnPad(w, shipId, bodyId) {
  const sim = w.sims.get(shipId);
  const pad = w.state.ships[shipId].moonPads[bodyId];
  const pp = makeMoon(bodyId).playerPad(pad.east, pad.north);
  const start = pp.standoff(18);
  sim.setFrame(bodyId);
  sim.flight.attitude = null;
  sim.flight.pitch = 0;
  sim.flight.roll = 0;
  sim.flight.pos = { ...start };
  sim.flight.vel = { x: 0, y: 0, z: 0 };
  sim.flight.landed = false;
  sim.flight.airborne = true;
  sim.flight.autoHover = true;
  sim.flight.thrustDown = true;
  sim.flight.gearPos = 1;
  sim.flight.climbCap = 12;
  sim.flight.refreshOrientation();
  for (let i = 0; i < 900; i++) {
    sim.flight.thrustDown = true;
    sim.flight.autoHover = true;
    sim.step(1 / 30, { fwd: 0, lift: -1, yaw: 0 });
    if (sim.flight.landed && i > 15) break;
  }
  const p = w.state.players[w.state.ships[shipId].owner];
  if (p) {
    p.aboardShipId = null;
    p.pose.aboard = false;
    p.pose.seat = null;
    p.frameId = bodyId;
    const stand = add(add(pp.point, pp.east, 16), pp.up, 2);
    p.pose.worldPos = stand;
  }
  sim.capture();
  return { pad, pp, landed: sim.flight.landed, pos: { ...sim.flight.pos } };
}

try {
  app = await startServer({ adapter: new FileAdapter(join(temp, 'world.json')), port: 0, tick: false, now: () => Date.now() });
  const PORT = new URL(app.url.replace('ws:', 'http:')).port, WS = app.url;
  results.port = Number(PORT);
  browser = await chromium.launch({ headless: true, executablePath: exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
  const mk = async (key, name, look, vp, extra = {}) => {
    const ctx = await browser.newContext({ viewport: vp, ...extra });
    await ctx.addInitScript(({ key, name, look }) => {
      localStorage.setItem('cosmos-device-v2', JSON.stringify({ key, name }));
      localStorage.setItem('hb-look', look);
    }, { key, name, look });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    return { ctx, page };
  };
  const ready = async (p) => {
    await p.goto(`http://localhost:${PORT}/?tier=low&dev=1&ws=${WS}`, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => window.cosmos && window.cosmos.multiplayer && window.cosmos.ship && window.cosmos.ship.ready, null, { timeout: 180000 });
    await p.evaluate(() => {
      window.__look = (eye, at, opts) => {
        const c = cosmos;
        if (c.multiplayer.panel) c.multiplayer.panel.hidden = true;
        const hud = document.getElementById('hud');
        const toast = document.getElementById('ship-toast');
        if (hud) hud.style.visibility = opts && opts.hud ? 'visible' : 'hidden';
        if (toast) toast.style.visibility = opts && opts.hud ? 'visible' : 'hidden';
        const sp = c.space;
        if (sp.frameId && sp.frameId !== 'mars') {
          const mw = sp.worlds.get(sp.frameId) || sp.moonWorld(sp.frameId);
          mw.force(eye);
        }
        c.freeCam.set(eye, at);
        if (c.multiplayer.fleetView) c.multiplayer.fleetView.update(0, c.world.snapshot, c.multiplayer.activeId());
        for (let i = 0; i < 6; i++) c.step(1 / 30);
        return sp.frameId;
      };
    });
    await p.evaluate(() => cosmos.engine.stop());
  };
  const sync = async (pages) => {
    await w.enqueue(() => w.commit());
    const rev = w.state.revision;
    for (const p of pages) {
      await p.evaluate(() => { try { cosmos.world.socket.send(JSON.stringify({ type: 'checkpoint' })); } catch (e) {} });
      await p.waitForFunction((r) => cosmos.world.snapshot && cosmos.world.snapshot.revision >= r, rev, { timeout: 30000 });
      await p.evaluate(() => { cosmos.multiplayer.forcePlayer = true; cosmos.multiplayer.apply({ bricks: [] }); for (let i = 0; i < 8; i++) cosmos.step(1 / 30); });
    }
  };
  const shot = async (page, name) => { await page.screenshot({ path: join(out, name + '.jpg'), type: 'jpeg', quality: 82 }); console.log('shot', name); };

  const w = app.world;
  console.log('loading desktop');
  const A = await mk('A'.repeat(48), 'Jaron', 'isaiah', DESK);
  const a = A.page;
  await ready(a);
  const aid = await a.evaluate(() => cosmos.world.playerId);
  const shipA = w.state.players[aid].shipId;

  // The hired pilot lifts off the Mars pad. Snap the pilot into the chair; the player stays out of it.
  await w.enqueue(() => {
    const pilot = Object.values(w.state.pool).find((c) => c.role === 'pilot' && !c.shipId);
    const ship = w.state.ships[shipA];
    const sim = w.sims.get(shipA);
    const seat = sim.def.seats.find((s) => s.id === 'pilot');
    pilot.shipId = ship.id;
    pilot.status = 'hired';
    ship.crew.push({ ...pilot, position: { ...pilot.position }, status: 'aboard', displaced: false, unpaid: false, nextPay: w.state.clock + 80000, seatPose: { x: seat.x, y: seat.y, z: seat.z, yaw: (seat.yaw || 0) * Math.PI / 180 } });
    const p = w.state.players[aid];
    p.aboardShipId = ship.id;
    p.pose.aboard = true;
    p.pose.seat = null;
    p.pose.sw = { x: 0, y: 1, z: 4, yaw: 0, pitch: 0 };
    p.frameId = 'mars';
    sim.ship.aboard = true;
    sim.crewOrder(p, { order: 'hunt' });
    w.advance(16);
  });
  // Step outside so the hull is drawn. The order keeps flying; the chair stays the pilot's.
  await w.enqueue(() => {
    const p = w.state.players[aid];
    const sim = w.sims.get(shipA);
    p.aboardShipId = null;
    p.pose.aboard = false;
    p.pose.seat = null;
    p.frameId = sim.frameId;
    p.pose.worldPos = { ...sim.flight.pos };
  });
  await sync([a]);
  const marsSim = w.sims.get(shipA);
  results.hunt = { landed: marsSim.flight.landed, agl: marsSim.flight.agl, order: w.state.ships[shipA].orderKey };
  console.log('hunt', JSON.stringify(results.hunt));
  const huntFrame = await a.evaluate(() => {
    const f = cosmos.ship.flight;
    return window.__look(f.toWorld({ x: 36, y: 14, z: 16 }), f.toWorld({ x: 0, y: 3, z: -6 }), { hud: true });
  });
  results.hunt.frame = huntFrame;
  await shot(a, 'd_pilot_hunt');

  console.log('loading phone');
  const P = await mk('C'.repeat(48), 'Phone', 'ada', PHONE, { isMobile: true, hasTouch: true });
  const phone = P.page;
  await ready(phone);
  const pid = await phone.evaluate(() => cosmos.world.playerId);
  const shipP = w.state.players[pid].shipId;

  // Both ships onto their own Phobos pads.
  let pads;
  await w.enqueue(() => {
    const mine = landOnPad(w, shipA, 'phobos');
    const theirs = landOnPad(w, shipP, 'phobos');
    pads = { mine, theirs };
  });
  results.phobos = { a: { landed: pads.mine.landed, number: pads.mine.pad.number }, b: { landed: pads.theirs.landed, number: pads.theirs.pad.number } };
  console.log('phobos', JSON.stringify(results.phobos));
  await sync([a, phone]);
  const lookPad = async (page, pp, pos, eyeM, atM) => {
    const eye = add(add(add(pp.point, pp.east, eyeM[0]), pp.north, eyeM[1]), pp.up, eyeM[2]);
    const at = add(add(add(pos, pp.east, atM[0]), pp.north, atM[1]), pp.up, atM[2]);
    await page.evaluate(({ eye, at }) => window.__look(eye, at), { eye, at });
  };
  await lookPad(a, pads.mine.pp, pads.mine.pos, [34, 8, 14], [0, 0, 2]);
  await shot(a, 'd_phobos_pad');
  await lookPad(phone, pads.mine.pp, pads.mine.pos, [28, 6, 12], [0, 0, 2]);
  await shot(phone, 'p_phobos_pad');
  // South end of the pad: the number, a corner light and the stripes, with the hull beyond them.
  await lookPad(a, pads.mine.pp, pads.mine.pp.point, [10, -46, 4], [0, -18, 1.5]);
  await shot(a, 'd_phobos_markings');
  await lookPad(phone, pads.mine.pp, pads.mine.pp.point, [8, -40, 5], [0, -16, 1.6]);
  await shot(phone, 'p_phobos_markings');

  // Between the two pads: both ships, both numbers.
  {
    const Apos = pads.mine.pos, Bpos = pads.theirs.pos, pp = pads.mine.pp;
    const mid = { x: (Apos.x + Bpos.x) / 2, y: (Apos.y + Bpos.y) / 2, z: (Apos.z + Bpos.z) / 2 };
    const at = add(mid, pp.up, 2);
    await a.evaluate(({ eye, at }) => window.__look(eye, at), { eye: add(add(mid, pp.north, 55), pp.up, 130), at });
    await shot(a, 'd_phobos_two_pads');
    await phone.evaluate(({ eye, at }) => window.__look(eye, at), { eye: add(add(mid, pp.north, 24), pp.up, 320), at });
    await shot(phone, 'p_phobos_two_pads');
  }

  let deimos;
  await w.enqueue(() => {
    deimos = landOnPad(w, shipA, 'deimos');
    const p = w.state.players[pid];
    if (p) {
      p.aboardShipId = null;
      p.pose.aboard = false;
      p.pose.seat = null;
      p.frameId = 'deimos';
      p.pose.worldPos = add(add(deimos.pp.point, deimos.pp.east, 16), deimos.pp.up, 2);
    }
  });
  results.deimos = { landed: deimos.landed, number: deimos.pad.number };
  console.log('deimos', JSON.stringify(results.deimos));
  await sync([a, phone]);
  results.deimos.frames = {
    desk: await a.evaluate(() => cosmos.space.frameId),
    phone: await phone.evaluate(() => cosmos.space.frameId),
  };
  console.log('deimos frames', JSON.stringify(results.deimos.frames));
  await lookPad(a, deimos.pp, deimos.pos, [34, 10, 14], [0, 0, 2]);
  await shot(a, 'd_deimos_pad');
  await lookPad(phone, deimos.pp, deimos.pos, [34, 22, 32], [0, 0, 3]);
  await shot(phone, 'p_deimos_pad');

  results.pageErrors = errors;
  await writeFile(join(out, 'shoot-results.json'), JSON.stringify(results, null, 2));
  console.log('errors', errors.length);
} finally {
  if (browser) await browser.close();
  if (app) await app.close();
  await rm(temp, { recursive: true, force: true });
}
