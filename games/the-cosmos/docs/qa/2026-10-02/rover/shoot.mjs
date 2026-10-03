// Pictures for the survey rover: the hold, the ramp, the ground, and the phone prompt.
// Not part of validate.mjs. Its own authority, never port 8390.
//   node docs/qa/2026-10-02/rover/shoot.mjs
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../../../../server/index.mjs';
import { FileAdapter } from '../../../../server/storage.mjs';
import { board } from '../../../../src/vehicles/api.js';

const require = createRequire(process.env.COSMOS_PLAYWRIGHT_ROOT || 'C:/Users/lilli/.codex/runtime/unfinished-island/node_modules/');
const { chromium } = require('playwright');
const out = fileURLToPath(new URL('./', import.meta.url));
await mkdir(out, { recursive: true });
const temp = await mkdtemp(join(tmpdir(), 'cosmos-rover-shoot-'));
const exe = process.env.COSMOS_CHROME || ['C:/Users/lilli/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
if (!exe) throw new Error('No Chromium executable found');

const DESK = { width: 1280, height: 720 };
const PHONE = { width: 390, height: 844 };
let app, browser;
const errors = [];
const results = {};

try {
  app = await startServer({ adapter: new FileAdapter(join(temp, 'world.json')), port: 0, tick: false, now: () => Date.now() });
  const PORT = new URL(app.url.replace('ws:', 'http:')).port;
  const WS = app.url;
  const w = app.world;
  results.port = Number(PORT);
  browser = await chromium.launch({ headless: true, executablePath: exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });

  const open = async (key, name, vp, extra = {}) => {
    const ctx = await browser.newContext({ viewport: vp, ...extra });
    await ctx.addInitScript(({ key, name }) => {
      localStorage.setItem('cosmos-device-v2', JSON.stringify({ key, name }));
      localStorage.setItem('hb-look', 'isaiah');
    }, { key, name });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`http://127.0.0.1:${PORT}/?tier=low&dev=1&opening=off&ws=${encodeURIComponent(WS)}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.cosmos && window.cosmos.vehicles && window.cosmos.ship && window.cosmos.ship.ready, null, { timeout: 180000 });
    await page.evaluate(() => {
      window.__look = (eye, at) => {
        const c = cosmos;
        if (c.multiplayer.panel) c.multiplayer.panel.hidden = true;
        const hud = document.getElementById('hud');
        if (hud) hud.style.visibility = 'visible';
        c.freeCam.set(eye, at);
        if (c.vehicles) { c.vehicles.prepare(); c.vehicles.frame(1 / 30, { moveNorth: 0, moveEast: 0, look: { dx: 0, dy: 0 } }); }
        for (let i = 0; i < 24; i++) c.step(1 / 30);
        return document.getElementById('btn-action').textContent;
      };
      window.__play = () => {
        cosmos.freeCam.off();
        if (cosmos.multiplayer.panel) cosmos.multiplayer.panel.hidden = true;
        for (let i = 0; i < 12; i++) cosmos.step(1 / 30);
        const b = document.getElementById('btn-action');
        return { label: b.textContent, display: b.style.display, seated: !!cosmos.vehicles.seated() };
      };
    });
    await page.evaluate(() => cosmos.engine.stop());
    return page;
  };

  const sync = async (page) => {
    await w.enqueue(() => w.commit());
    const rev = w.state.revision;
    await page.evaluate(() => { try { cosmos.world.socket.send(JSON.stringify({ type: 'checkpoint' })); } catch (e) {} });
    await page.waitForFunction((r) => cosmos.world.snapshot && cosmos.world.snapshot.revision >= r, rev, { timeout: 30000 });
    await page.evaluate(() => {
      cosmos.multiplayer.forcePlayer = true;
      cosmos.multiplayer.apply({ bricks: [] });
      if (cosmos.vehicles) cosmos.vehicles.prepare();
      for (let i = 0; i < 8; i++) cosmos.step(1 / 30);
    });
  };
  const shot = async (page, name) => {
    await page.screenshot({ path: join(out, name + '.jpg'), type: 'jpeg', quality: 82 });
    console.log('shot', name);
  };

  console.log('loading phone');
  const phone = await open('P'.repeat(48), 'Phone', PHONE, { isMobile: true, hasTouch: true });
  const pid = await phone.evaluate(() => cosmos.world.playerId);
  const shipId = w.state.players[pid].shipId;
  const holdId = `hold-${shipId}`;
  const sim = w.sims.get(shipId);

  // Beside the left door, looking across at the cab (yaw −π/2 faces −X). The old
  // stand faced the stern door, so the phone frame showed the ramp and missed the rover.
  await w.enqueue(() => {
    const p = w.state.players[pid];
    p.aboardShipId = shipId;
    p.currentShipId = shipId;
    p.pose.aboard = true;
    p.pose.seat = null;
    // 3/4 from the aft starboard corner, still inside the left-door reach (2.6 m).
    // yaw −2.17 faces the cab: forward.x = sin(yaw), forward.z = −cos(yaw).
    p.pose.sw = { x: 3.15, y: 0, z: 14.7, yaw: -2.17, pitch: -0.22 };
    p.frameId = sim.frameId;
    sim.flight.toWorld(p.pose.sw, p.pose.worldPos);
    sim.ship.aboard = true;
  });
  await sync(phone);
  const driveBtn = await phone.evaluate(() => window.__play());
  results.driveButton = driveBtn;
  console.log('drive button', JSON.stringify(driveBtn));
  if (driveBtn.label !== 'Drive') throw new Error('phone Drive prompt missing: ' + JSON.stringify(driveBtn));
  await shot(phone, 'p_drive');

  // Wider three-quarter of the same rover, still inside the bay. The button stays Drive.
  const cab = await phone.evaluate(() => {
    const f = cosmos.ship.flight;
    return window.__look(f.toWorld({ x: 4.6, y: 2.05, z: 11.2 }), f.toWorld({ x: 0, y: 1.05, z: 16.6 }));
  });
  results.cabLook = cab;
  await shot(phone, 'p_cab');

  const sat = await phone.evaluate(async () => {
    const a = cosmos.vehicles.contextAction();
    const r = a ? await a.run() : { ok: false, msg: 'no prompt' };
    return { msg: r && r.msg, ok: !!(r && r.ok), asked: a && a.label };
  });
  await phone.waitForFunction((id) => {
    const p = cosmos.world.snapshot && cosmos.world.snapshot.players[id];
    return !!(p && p.vehicleId);
  }, pid, { timeout: 20000 });
  const seated = await phone.evaluate(() => {
    cosmos.multiplayer.forcePlayer = true;
    cosmos.multiplayer.apply({ bricks: [] });
    if (cosmos.vehicles) cosmos.vehicles.prepare();
    return window.__play();
  });
  results.sat = { ...sat, ...seated };
  console.log('seated', JSON.stringify(results.sat));
  if (seated.label !== 'Leave' || !seated.seated) throw new Error('phone Leave prompt missing: ' + JSON.stringify(results.sat));
  await shot(phone, 'p_leave');

  console.log('loading desktop');
  const desk = await open('D'.repeat(48), 'Jaron', DESK);
  const did = await desk.evaluate(() => cosmos.world.playerId);
  const dShip = w.state.players[did].shipId;
  const dHold = `hold-${dShip}`;
  const dSim = w.sims.get(dShip);

  await sync(desk);
  await desk.evaluate(() => {
    const f = cosmos.ship.flight;
    return window.__look(f.toWorld({ x: 4.2, y: 2.4, z: 13.5 }), f.toWorld({ x: 0, y: 1.1, z: 16.4 }));
  });
  await shot(desk, 'd_hold');

  await w.enqueue(() => {
    const p = w.state.players[did];
    const v = w.state.vehicles[dHold];
    board(v, did, 'driver');
    p.vehicleId = v.id;
    p.vehicleSeat = 'driver';
    p.aboardShipId = null;
    p.pose.aboard = false;
    p.pose.seat = null;
    w.vehicles._publish();
  });

  const nudge = () => {
    w.vehicleInputs.set(did, { until: Date.now() + 120000, throttle: 1, steer: 0 });
    w.advance(0.2);
  };
  // Drive until the centre is on the slope, not merely a wheel past the hinge.
  await w.enqueue(() => {
    const ramp = dSim.def.ramps.cargo;
    const alongOf = (v) => (v.pose.x - ramp.hinge.x) * ramp.dir.x + (v.pose.z - ramp.hinge.z) * ramp.dir.z;
    for (let i = 0; i < 80 && w.state.vehicles[dHold].parentShipId; i++) {
      const a = alongOf(w.state.vehicles[dHold]);
      if (a >= 2.0 && a <= 4.0) break;
      nudge();
    }
  });
  const rampPose = w.state.vehicles[dHold];
  results.onRamp = !!(rampPose.parentShipId && w.vehicles.onRamp(dSim, 'cargo'));
  console.log('on ramp', results.onRamp, JSON.stringify(rampPose.pose));
  await sync(desk);
  const lookNear = async (name, eyeOf) => {
    const pose = w.state.vehicles[dHold];
    const atPoint = pose.parentShipId ? dSim.flight.toWorld(pose.pose) : pose.world;
    const local = dSim.flight.toLocal(atPoint);
    const eye = dSim.flight.toWorld(eyeOf(local, pose));
    const at = dSim.flight.toWorld({ x: local.x, y: local.y + 0.9, z: local.z });
    await desk.evaluate(({ eye, at }) => window.__look(eye, at), { eye, at });
    await shot(desk, name);
  };
  // Pad height, well clear of the belly. The old eye sat at deck height under the hull.
  if (results.onRamp) {
    await lookNear('d_ramp', (local) => ({ x: local.x + 8, y: -1.0, z: local.z + 6 }));
  }

  await w.enqueue(() => {
    for (let i = 0; i < 40 && w.state.vehicles[dHold].parentShipId; i++) nudge();
  });
  const rv = w.state.vehicles[dHold];
  results.outside = { parent: rv.parentShipId, world: rv.world, speed: rv.pose.speed };
  console.log('outside', JSON.stringify(results.outside));
  await sync(desk);
  await lookNear('d_ground', (local) => ({ x: local.x + 5.5, y: local.y + 2.2, z: local.z + 2.4 }));

  // If it is outside, also frame the stern so the ramp and the rover read together.
  if (!rv.parentShipId) {
    const local = dSim.flight.toLocal(rv.world);
    const eye = dSim.flight.toWorld({ x: local.x - 2, y: local.y + 3.5, z: local.z - 8 });
    const at = dSim.flight.toWorld({ x: 0, y: 1, z: 22 });
    await desk.evaluate(({ eye, at }) => window.__look(eye, at), { eye, at });
    await shot(desk, 'd_stern');
  }

  results.errors = errors;
  await writeFile(join(out, 'shoot-results.json'), JSON.stringify(results, null, 2));
  console.log('errors', errors.length);
  if (errors.length) console.log(errors.join('\n'));
} finally {
  if (browser) await browser.close();
  if (app) await app.close();
  await rm(temp, { recursive: true, force: true });
}
