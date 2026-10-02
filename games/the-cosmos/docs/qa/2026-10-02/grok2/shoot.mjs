// Pictures for boarding a captured Shrike and for raider crew looks.
// Not part of validate.mjs: it needs Chromium. Its own authority, never port 8390.
//   node docs/qa/2026-10-02/grok2/shoot.mjs
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../../../../server/index.mjs';
import { FileAdapter } from '../../../../server/storage.mjs';
import { CREW_POSTS } from '../../../../src/crew/crewSpec.js';
import { shipDef } from '../../../../src/ships/registry.js';

const require = createRequire(process.env.COSMOS_PLAYWRIGHT_ROOT || 'C:/Users/lilli/.codex/runtime/unfinished-island/node_modules/');
const { chromium } = require('playwright');
const out = fileURLToPath(new URL('./', import.meta.url));
await mkdir(out, { recursive: true });
const temp = await mkdtemp(join(tmpdir(), 'cosmos-grok2-shoot-'));
const exe = process.env.COSMOS_CHROME || ['C:/Users/lilli/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
if (!exe) throw new Error('No Chromium executable found');

const DESK = { width: 1280, height: 720 };
const PHONE = { width: 390, height: 844 };
let app, browser;
const errors = [];
const results = {};

const HELPERS = () => {
  window.__rot = (q, v) => {
    const x = v.x, y = v.y, z = v.z, qx = q[0], qy = q[1], qz = q[2], qw = q[3];
    const ix = qw * x + qy * z - qz * y, iy = qw * y + qz * x - qx * z, iz = qw * z + qx * y - qy * x, iw = -qx * x - qy * y - qz * z;
    return {
      x: ix * qw + iw * -qx + iy * -qz - iz * -qy,
      y: iy * qw + iw * -qy + iz * -qx - ix * -qz,
      z: iz * qw + iw * -qz + ix * -qy - iy * -qx,
    };
  };
  window.__world = (ship, local) => {
    const p = ship.pose.pos, r = window.__rot(ship.pose.quaternion, local);
    return { x: p.x + r.x, y: p.y + r.y, z: p.z + r.z };
  };
  window.__lookShip = (rid, eyeL, atL) => {
    const ship = cosmos.world.snapshot.ships[rid];
    cosmos.multiplayer.panel.hidden = true;
    cosmos.freeCam.set(window.__world(ship, eyeL), window.__world(ship, atL));
    for (let i = 0; i < 6; i++) { cosmos.step(1 / 60); cosmos.multiplayer.updateBodies(1 / 60); }
  };
  // Aim at the helmeted people, not at a guessed point on the hull. The two furthest toward the bow are the cockpit pair.
  window.__aimCrew = (rid, bowM, sideM, upM) => {
    const ship = cosmos.world.snapshot.ships[rid], q = ship.pose.quaternion, o = ship.pose.pos;
    const fwd = window.__rot(q, { x: 0, y: 0, z: -1 }), up = window.__rot(q, { x: 0, y: 1, z: 0 }), right = window.__rot(q, { x: 1, y: 0, z: 0 });
    const scored = [...cosmos.multiplayer.bodies.values()].filter((v) => v.group.getObjectByName('raider-helmet') && v.entry && v.entry.worldPos).map((v) => {
      const p = v.entry.worldPos, dx = p.x - o.x, dy = p.y - o.y, dz = p.z - o.z;
      return { name: v.name, p, bow: dx * fwd.x + dy * fwd.y + dz * fwd.z };
    }).sort((a, b) => b.bow - a.bow);
    const pair = scored.slice(0, 2);
    if (!pair.length) return [];
    const mid = pair.reduce((a, s) => ({ x: a.x + s.p.x, y: a.y + s.p.y, z: a.z + s.p.z }), { x: 0, y: 0, z: 0 });
    mid.x /= pair.length; mid.y /= pair.length; mid.z /= pair.length;
    const head = { x: mid.x + up.x * 1.5, y: mid.y + up.y * 1.5, z: mid.z + up.z * 1.5 };
    const eye = {
      x: head.x + fwd.x * bowM + right.x * sideM + up.x * upM,
      y: head.y + fwd.y * bowM + right.y * sideM + up.y * upM,
      z: head.z + fwd.z * bowM + right.z * sideM + up.z * upM,
    };
    cosmos.multiplayer.panel.hidden = true;
    cosmos.freeCam.set(eye, head);
    for (let i = 0; i < 8; i++) { cosmos.step(1 / 60); cosmos.multiplayer.updateBodies(1 / 60); }
    return scored.map((s) => ({ name: s.name, bow: Math.round(s.bow) }));
  };
  window.__helmets = () => [...cosmos.multiplayer.bodies.values()].filter((v) => v.person.loaded && v.group.getObjectByName('raider-helmet')).map((v) => {
    const visor = v.group.getObjectByName('helmet-visor');
    const shell = v.group.getObjectByName('helmet-shell');
    return { name: v.name, visor: visor && visor.material && visor.material.color && visor.material.color.getHexString(), shell: shell && shell.material && shell.material.color && shell.material.color.getHexString() };
  });
};

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
  const A = await mk('A'.repeat(48), 'Jaron', 'isaiah', DESK);
  const P = await mk('C'.repeat(48), 'Phone', 'ada', PHONE, { isMobile: true, hasTouch: true });
  const a = A.page, phone = P.page;
  const ready = async (p) => {
    await p.goto(`http://localhost:${PORT}/?tier=low&dev=1&ws=${WS}`, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => window.cosmos && window.cosmos.multiplayer && window.cosmos.ship && window.cosmos.ship.ready, null, { timeout: 180000 });
    await p.evaluate(HELPERS);
    await p.evaluate(() => cosmos.engine.stop());
  };
  console.log('loading desktop');
  await ready(a);
  const w = app.world;
  const aid = await a.evaluate(() => cosmos.world.playerId);
  const pa = () => w.state.players[aid];
  const shipA = pa().shipId;
  const rid = Object.values(w.state.ships).find((s) => s.npc && s.npc.station === 'mars-orbit').id;
  results.raiderId = rid;
  results.raiderName = w.state.ships[rid].npc.name;
  const shot = async (page, name) => { await page.screenshot({ path: join(out, name + '.jpg'), type: 'jpeg', quality: 82 }); console.log('shot', name); };
  const sync = async (pages) => {
    await w.enqueue(() => w.commit());
    const rev = w.state.revision;
    for (const p of pages) {
      await p.evaluate(() => { try { cosmos.world.socket.send(JSON.stringify({ type: 'checkpoint' })); } catch (e) {} });
      await p.waitForFunction((r) => cosmos.world.snapshot && cosmos.world.snapshot.revision >= r, rev, { timeout: 30000 });
      await p.evaluate(() => { cosmos.multiplayer.forcePlayer = true; cosmos.multiplayer.apply({ bricks: [] }); for (let i = 0; i < 3; i++) cosmos.step(1 / 60); });
    }
  };
  const near = (id, east, north = 0) => {
    const R = w.sims.get(rid), S = w.sims.get(id), fr = R.flight._frame, f = S.flight;
    f.pos = { x: R.flight.pos.x + fr.east.x * east + fr.north.x * north, y: R.flight.pos.y + fr.east.y * east + fr.north.y * north, z: R.flight.pos.z + fr.east.z * east + fr.north.z * north };
    f.vel = { x: 0, y: 0, z: 0 }; f.landed = false; f.airborne = true; f.autoHover = true; f.gearPos = 0; f.refreshOrientation();
  };
  const boardIn = (p, shipId, seat) => { p.aboardShipId = shipId; p.currentShipId = shipId; p.pose.aboard = true; p.pose.seat = seat; p.frameId = 'mars'; };

  // 1. Up beside the live raider, before anyone boards it. The four at the stations wear helmets.
  await w.enqueue(() => { near(shipA, 90, 25); boardIn(pa(), shipA, 'pilot'); w.advance(1.5); });
  await sync([a]);
  await a.evaluate((rid) => window.__lookShip(rid, { x: 18, y: 8, z: -2 }, { x: 0, y: 2, z: -6 }), rid);
  await shot(a, 'd_raider_quarter');
  let helmets = [];
  for (let i = 0; i < 50; i++) {
    await a.evaluate((rid) => window.__lookShip(rid, { x: 9, y: 4, z: -14 }, { x: 0, y: 1.5, z: -10.6 }), rid);
    helmets = await a.evaluate(() => window.__helmets());
    if (helmets.length >= 2) break;
    await new Promise((r) => setTimeout(r, 400));
  }
  results.helmetsBefore = helmets;
  results.bodyCountBefore = await a.evaluate(() => cosmos.multiplayer.bodies.size);
  // Above the open canopy, hull still drawn.
  results.crewAim = await a.evaluate((rid) => window.__aimCrew(rid, 0.3, 0.4, 3.2), rid);
  console.log('helmets', helmets.length, 'bodies', results.bodyCountBefore, 'aim', JSON.stringify(results.crewAim));
  await shot(a, 'd_raider_crew_above');
  // Portrait: the hull hides the faces from outside the glass, so this one frame hides the exterior and the name tags.
  results.helmetScale = await a.evaluate((rid) => {
    window.__aimCrew(rid, 1.35, 0.35, 0.25);
    const view = cosmos.multiplayer.fleetView.views.get(rid);
    if (view) view.root.visible = false;
    for (const b of cosmos.multiplayer.bodies.values()) if (b.tag) b.tag.visible = false;
    cosmos.step(1 / 60);
    const scales = [];
    for (const b of cosmos.multiplayer.bodies.values()) {
      const shell = b.group.getObjectByName('helmet-shell');
      if (!shell) continue;
      shell.updateWorldMatrix(true, false);
      const e = shell.matrixWorld.elements;
      const sx = Math.hypot(e[0], e[1], e[2]), sy = Math.hypot(e[4], e[5], e[6]), sz = Math.hypot(e[8], e[9], e[10]);
      scales.push({ name: b.name, sx: +sx.toFixed(4), sy: +sy.toFixed(4), sz: +sz.toFixed(4), radiusM: +(11.5 * sx).toFixed(3) });
    }
    return scales;
  }, rid);
  console.log('helmetScale', JSON.stringify(results.helmetScale));
  await shot(a, 'd_raider_crew_helmets');
  await a.evaluate((rid) => {
    window.__aimCrew(rid, 1.2, 2.4, 0.9);
    const view = cosmos.multiplayer.fleetView.views.get(rid);
    if (view) view.root.visible = false;
    for (const b of cosmos.multiplayer.bodies.values()) if (b.tag) b.tag.visible = false;
    cosmos.step(1 / 60);
  }, rid);
  await shot(a, 'd_raider_crew_side');
  if (process.env.GROK2_CREW_ONLY) { console.log('GROK2 CREW ONLY'); results.pageErrors = errors; }
  else {

  // 2. Disable it and open World / crew, desktop and phone width.
  console.log('loading phone');
  await ready(phone);
  const pid = await phone.evaluate(() => cosmos.world.playerId);
  const pp = () => w.state.players[pid];
  const shipP = pp().shipId;
  await w.enqueue(() => {
    const R = w.sims.get(rid);
    R.flight.hull = 30;
    w.advance(0.6);
    if (w.state.ships[rid].npc && w.state.ships[rid].npc.state !== 'disabled') {
      w.state.ships[rid].npc.state = 'disabled';
      for (const c of w.state.ships[rid].crew) if (c.status === 'aboard') c.status = 'surrendered';
    }
    near(shipA, 70, 15);
    near(shipP, 95, -20);
    boardIn(pa(), shipA, 'pilot');
    boardIn(pp(), shipP, 'pilot');
    w.advance(0.2);
  });
  await sync([a, phone]);
  results.disabled = w.state.ships[rid].npc && w.state.ships[rid].npc.state;
  const openPanel = async (page) => page.evaluate(() => {
    const m = cosmos.multiplayer;
    m.panel.hidden = false;
    m.draw();
    const buttons = [...m.panel.querySelectorAll('button')].map((x) => x.textContent);
    const hold = [...m.panel.querySelectorAll('button')].find((x) => /my ship holds/.test(x.textContent));
    if (hold) hold.scrollIntoView({ block: 'center' });
    return buttons.filter((t) => /Prize crew|Board |Capture|Claim|holds|follows/.test(t));
  });
  results.desktopButtons = await openPanel(a);
  await a.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await shot(a, 'd_panel_board');
  results.phoneButtons = await openPanel(phone);
  await phone.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await shot(phone, 'p_panel_board');
  console.log('buttons', results.desktopButtons, results.phoneButtons);

  // 3. Hired crew come aboard. The page reloads into the Shrike. The Meridian holds.
  await w.enqueue(() => {
    const M = shipDef('meridian'), rec = w.state.ships[shipA];
    const add = (role, name, personId) => {
      const id = 'hired-' + role, post = CREW_POSTS.find((r) => r.id === role), seat = M.seats.find((s) => s.id === post.seat);
      rec.crew.push({ id, role, name, personId, skill: 0.8, wageCredits: 80, status: 'aboard', unpaid: false, nextPay: 1e15, seatPose: { ...seat } });
      rec.economy.crew[role] = { nextPay: 1e15, unpaid: false };
      w.state.pool[id] = { id, role, name, personId, skill: 0.8, wageCredits: 80, shipId: shipA, status: 'hired', position: { x: 0, y: 0, z: 0 }, refillAt: 1e15 };
    };
    add('pilot', 'Nia Okonkwo', 'ada');
    add('captain', 'Helena Voss', 'zuri');
    add('nav', 'Mateo Ruiz', 'jorge');
  });
  const boarded = await a.evaluate((rid) => cosmos.multiplayer.request({ type: 'board-prize', shipId: rid, ownShip: 'hold' }), rid);
  results.board = boarded;
  console.log('board', boarded && boarded.ok, boarded && boarded.msg);
  if (boarded && boarded.ok) {
    await w.enqueue(() => w.advance(20));
    await a.waitForFunction(() => window.cosmos && window.cosmos.ship && window.cosmos.ship.def && window.cosmos.ship.def.type === 'raider' && window.cosmos.ship.ready, null, { timeout: 180000 });
    await a.evaluate(HELPERS);
    await a.evaluate(() => cosmos.engine.stop());
    await sync([a]);
    results.after = await a.evaluate(() => {
      const s = cosmos.world.snapshot, me = s.players[cosmos.world.playerId];
      const prize = s.ships[me.aboardShipId], flag = s.ships[me.shipId];
      return {
        type: cosmos.ship.def.type, aboard: me.aboardShipId, flagship: me.shipId,
        prizeNpc: prize.npc, escort: flag.escort,
        prizeCrew: (prize.crew || []).map((c) => ({ name: c.name, role: c.role, status: c.status, displaced: !!c.displaced })),
        flagCrew: (flag.crew || []).map((c) => c.name),
      };
    });
    console.log('after', JSON.stringify(results.after));
    await a.evaluate(() => { cosmos.freeCam.off(); cosmos.multiplayer.panel.hidden = true; cosmos.ship.debugAt('hold', 0.4, 14.2, 0, -6, 25); });
    await shot(a, 'd_hold_after_board');
    // Door side of the cockpit, looking forward at the seats. yaw 0 faces the bow.
    await a.evaluate(() => { cosmos.freeCam.off(); cosmos.ship.debugAt('cockpit', 0.15, -8.9, 0, 6, 30); });
    await shot(a, 'd_cockpit_after_board');
    await a.setViewportSize(PHONE);
    await a.evaluate(() => { cosmos.freeCam.off(); cosmos.ship.debugAt('cockpit', 0.2, -9.2, 0, -14, 20); });
    await shot(a, 'p_cockpit_after_board');
    await a.setViewportSize(DESK);
    const apart = await a.evaluate(() => {
      const s = cosmos.world.snapshot, me = s.players[cosmos.world.playerId];
      const A = s.ships[me.aboardShipId].pose.pos, B = s.ships[me.shipId].pose.pos;
      const d = { x: A.x - B.x, y: A.y - B.y, z: A.z - B.z };
      const l = Math.hypot(d.x, d.y, d.z) || 1;
      const ul = Math.hypot(B.x, B.y, B.z) || 1, up = { x: B.x / ul, y: B.y / ul, z: B.z / ul };
      const eye = { x: B.x + d.x / l * 36 + up.x * 14, y: B.y + d.y / l * 36 + up.y * 14, z: B.z + d.z / l * 36 + up.z * 14 };
      const flag = cosmos.multiplayer.fleetView.views.get(me.shipId);
      if (flag) flag.root.visible = true;
      cosmos.ship.aboard = false;
      cosmos.freeCam.set(eye, B);
      cosmos.multiplayer.updateBodies(1 / 60);
      for (let i = 0; i < 6; i++) cosmos.step(1 / 60);
      return Math.round(Math.hypot(d.x, d.y, d.z));
    });
    results.apartM = apart;
    await shot(a, 'd_meridian_holds');
  }
  }
  results.pageErrors = errors;
  console.log('pageErrors', errors.length);
  console.log('GROK2 SHOOT DONE');
} finally {
  await writeFile(join(out, 'browser-results.json'), JSON.stringify({ results, errors }, null, 2));
  await browser?.close();
  if (app) await app.close();
  await rm(temp, { recursive: true, force: true });
}
