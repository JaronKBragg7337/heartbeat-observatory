// Real Chromium clients on the fleet. Two players in one shared world see the same raider, the same fight and the same damage; one of
// them captures it, makes it his flagship, and the page comes back up inside it, with its crew seated. Server-only fixture placement
// (putting a ship in the air next to the raider) is kept in this process: the website has no teleport or time-advance protocol.
//   node test/fleet-browser.mjs        (not part of validate.mjs: it needs Chromium and a minute or two per page)
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { startServer } from '../server/index.mjs';
import { FileAdapter } from '../server/storage.mjs';
const require = createRequire(process.env.COSMOS_PLAYWRIGHT_ROOT || 'C:/Users/lilli/.codex/runtime/unfinished-island/node_modules/');
const { chromium } = require('playwright');
const out = fileURLToPath(new URL('../docs/qa/2026-10-01/fleet/', import.meta.url)); await mkdir(out, { recursive: true });
const temp = await mkdtemp(join(tmpdir(), 'cosmos-fleet-browser-'));
const exe = process.env.COSMOS_CHROME || ['C:/Users/lilli/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
let app, browser; const errors = [], results = {}; let clock = Date.now();
try {
  app = await startServer({ adapter: new FileAdapter(join(temp, 'world.json')), port: 0, tick: false, now: () => clock });
  const PORT = new URL(app.url.replace('ws:', 'http:')).port, WS = app.url;       // (8390 belongs to the real local server: this review runs its own authority on a free port)
  browser = await chromium.launch({ headless: true, executablePath: exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
  const mk = async (key, name, look, vp = { width: 1100, height: 650 }, extra = {}) => {
    const ctx = await browser.newContext({ viewport: vp, ...extra });
    await ctx.addInitScript(({ key, name, look }) => { localStorage.setItem('cosmos-device-v2', JSON.stringify({ key, name })); localStorage.setItem('hb-look', look); }, { key, name, look });
    const page = await ctx.newPage(); page.on('pageerror', (e) => errors.push(String(e))); return { ctx, page };
  };
  const A = await mk('A'.repeat(48), 'Jaron', 'isaiah'), B = await mk('B'.repeat(48), 'Lilith', 'ada');
  const a = A.page, b = B.page;
  const ready = async (p) => { await p.goto(`http://localhost:${PORT}/?tier=low&dev=1&ws=${WS}`); await p.waitForFunction(() => window.cosmos && window.cosmos.multiplayer, null, { timeout: 120000 }); await p.evaluate(() => cosmos.engine.stop()); };
  await ready(a); await ready(b);
  const aid = await a.evaluate(() => cosmos.world.playerId), bid = await b.evaluate(() => cosmos.world.playerId);
  const w = app.world, pa = () => w.state.players[aid], pb = () => w.state.players[bid];
  const shipA = pa().shipId, shipB = pb().shipId;
  const rid = Object.values(w.state.ships).find((s) => s.npc && s.npc.station === 'mars-orbit').id;
  const shot = async (page, name) => { await page.screenshot({ path: join(out, name + '.png') }); console.log('shot', name); };
  const sync = async () => {
    await w.enqueue(() => w.commit());
    await a.evaluate(() => cosmos.world.socket.send(JSON.stringify({ type: 'checkpoint' })));
    const rev = w.state.revision;
    for (const p of [a, b]) await p.waitForFunction((r) => cosmos.world.snapshot && cosmos.world.snapshot.revision >= r, rev, { timeout: 30000 });
    for (const p of [a, b]) await p.evaluate(() => { cosmos.multiplayer.forcePlayer = true; cosmos.multiplayer.apply({ bricks: [] }); for (let i = 0; i < 4; i++) cosmos.step(1 / 60); });
  };
  const near = (id, east, north = 0) => { const R = w.sims.get(rid), S = w.sims.get(id), fr = R.flight._frame, f = S.flight;
    f.pos = { x: R.flight.pos.x + fr.east.x * east + fr.north.x * north, y: R.flight.pos.y + fr.east.y * east + fr.north.y * north, z: R.flight.pos.z + fr.east.z * east + fr.north.z * north };
    f.vel = { x: 0, y: 0, z: 0 }; f.landed = false; f.airborne = true; f.autoHover = true; f.gearPos = 0; f.refreshOrientation(); };
  const boardIn = (p, shipId, seat) => { p.aboardShipId = shipId; p.currentShipId = shipId; p.pose.aboard = true; p.pose.seat = seat; p.frameId = 'mars'; };

  // 1. Both clients see the raider that the server flies, built from its definition, with its escorts and its seated crew.
  await w.enqueue(() => { w.advance(3); });
  near(shipA, 1100); near(shipB, 900, 500); boardIn(pa(), shipA, 'pilot'); boardIn(pb(), shipB, 'pilot');
  await w.enqueue(() => { w.advance(1); }); await sync();
  for (const [p, nm] of [[a, 'a'], [b, 'b']]) {
    const v = await p.evaluate((rid) => { const fv = cosmos.multiplayer.fleetView, v = fv.views.get(rid); return { built: !!v, type: v && v.def.type, buildMs: v && Math.round(v.buildMs), visible: v && v.root.visible, escorts: [...fv.escorts.values()].filter((e) => e.mesh.visible).length, label: v && v.label && v.label.userData.text }; }, rid);
    results['raiderBuilt_' + nm] = v; assert.ok(v.built && v.type === 'raider' && v.visible, JSON.stringify(v)); assert.equal(v.escorts, 3);
  }
  // The review camera sits on the line from the raider toward the viewer's own ship, `dist` metres from the raider and a little above it,
  // looking at the raider. (The free camera bypasses the game's own tick, so the fleet view is updated by hand each time.)
  const look = async (p, sid, dist = 300, upK = 0.15) => p.evaluate(([rid, sid, dist, upK]) => { const c = cosmos, snap = c.world.snapshot, R = snap.ships[rid].pose.pos, S = snap.ships[sid].pose.pos, up = c.ship.flight.up;
    const d = { x: S.x - R.x, y: S.y - R.y, z: S.z - R.z }, l = Math.hypot(d.x, d.y, d.z) || 1;
    c.freeCam.set({ x: R.x + d.x / l * dist + up.x * dist * upK, y: R.y + d.y / l * dist + up.y * dist * upK, z: R.z + d.z / l * dist + up.z * dist * upK }, { x: R.x, y: R.y, z: R.z });
    c.multiplayer.updateBodies(1 / 60); for (let i = 0; i < 3; i++) c.step(1 / 60); return Math.hypot(d.x, d.y, d.z); }, [rid, sid, dist, upK]);
  const dA = await look(a, shipA, 450); const dB = await look(b, shipB, 450);
  await shot(a, 'm01_a_player_a_sees_the_raider'); await shot(b, 'm01_b_player_b_sees_the_same_raider');
  results.distances = { a: Math.round(dA), b: Math.round(dB) };
  // 2. A close pass for the picture: the raider and its escorts at 250 m, with its label
  near(shipA, 260, 40); await w.enqueue(() => w.advance(0.2)); await sync();
  await look(a, shipA, 90, 0.1); await shot(a, 'm02_a_raider_and_escorts_close');
  // 3. The fight: the server runs it. A's turret hits it; the damage is the same on both clients.
  await w.enqueue(() => {
    for (let s = 0; s < 14; s++) { for (let k = 0; k < 30; k++) { const S = w.sims.get(shipA), f = S.flight, R = w.sims.get(rid), rf = R.flight, d = Math.hypot(rf.pos.x - f.pos.x, rf.pos.y - f.pos.y, rf.pos.z - f.pos.z);
      if (d < 1700) { const tof = d / 300, pr = { x: rf.pos.x + rf.vel.x * tof, y: rf.pos.y + rf.vel.y * tof, z: rf.pos.z + rf.vel.z * tof }, dl = f.toLocal(pr, {}), pv = S.def.guns.dorsal.pivot, loc = { x: dl.x - pv.x, y: dl.y - pv.y, z: dl.z - pv.z }, l = Math.hypot(loc.x, loc.y, loc.z);
        S.guns.point('dorsal', { x: loc.x / l, y: loc.y / l, z: loc.z / l }); S.guns.fire('dorsal', f.dirToWorld(S.guns.constructor.dirFor(S.guns.aim.dorsal), {}), f.toWorld(pv, {}), true); } w.advance(1 / 30); }
      w.sims.get(shipA).flight.hull = 100; if (w.state.ships[rid].pose && w.sims.get(rid).flight.hull < 60) break; } });
  await sync();
  const dmg = await Promise.all([a, b].map((p) => p.evaluate((rid) => { const s = cosmos.world.snapshot.ships[rid]; return { hull: s.pose.hull, shield: s.pose.shield, state: s.npc.state, esc: s.npc.escorts.drones.map((d) => d.state).join() }; }, rid)));
  results.damage = dmg; assert.deepEqual(dmg[0], dmg[1]); assert.ok(dmg[0].hull < 100 || dmg[0].shield < 240);
  await look(a, shipA, 150, 0.1); await shot(a, 'm03_a_under_fire_player_a'); await look(b, shipB, 150, 0.1); await shot(b, 'm03_b_under_fire_player_b');
  // 4. Finish it, and capture it from B's ship, over the socket.
  await w.enqueue(() => { const R = w.sims.get(rid); w.sims.get(shipA).guns.bolts.length = 0; w.sims.get(shipB).guns.bolts.length = 0; R.flight.hull = 30; w.advance(0.5); });
  near(shipB, 70, 20); await w.enqueue(() => w.advance(0.1)); await sync();
  await look(b, shipB, 100, 0.1);
  const label = await b.evaluate((rid) => cosmos.multiplayer.fleetView.views.get(rid).label.userData.text, rid); results.disabledLabel = label; assert.ok(/DISABLED/.test(label), label);
  await look(b, shipB, 100, 0.1); await shot(b, 'm04_disabled_raider_label');
  await b.evaluate(() => { const m = cosmos.multiplayer; m.panel.hidden = false; m.draw(); });
  const claimBtn = await b.evaluate(() => [...cosmos.multiplayer.panel.querySelectorAll('button')].map((x) => x.textContent).filter((t) => /Capture|Claim/.test(t)));
  results.panelClaimButtons = claimBtn; assert.ok(claimBtn.length === 1, claimBtn.join());
  await shot(b, 'm05_panel_capture_button');
  const claim = await b.evaluate((rid) => cosmos.multiplayer.request({ type: 'claim-ship', shipId: rid }), rid);
  assert.equal(claim.ok, true, claim.msg); results.claim = claim.msg;
  await w.enqueue(() => { const f = w.sims.get(shipB).flight; f.landed = true; f.airborne = false; f.autoHover = false; f.vel = { x: 0, y: 0, z: 0 }; w.sims.get(shipB).capture(); });
  const ownedPad = w.state.ships[rid].pad;
  // B walks to the raider and takes command of it: the flagship changes class, so the page reloads into it
  pb().aboardShipId = null; pb().pose.aboard = false; pb().pose.seat = null; pb().currentShipId = shipB;
  pb().pose.worldPos = w.sims.get(rid).flight.toWorld({ x: -8, y: -1.2, z: 24 }, {});
  await sync();
  const flag = await b.evaluate((rid) => cosmos.multiplayer.request({ type: 'set-flagship', shipId: rid }), rid);
  assert.equal(flag.ok, true, flag.msg);
  await b.waitForFunction(() => window.cosmos && window.cosmos.ship && window.cosmos.ship.def && window.cosmos.ship.def.type === 'raider', null, { timeout: 150000 });
  await b.evaluate(() => cosmos.engine.stop());
  results.reloadedIntoRaider = await b.evaluate(() => ({ type: cosmos.ship.def.type, ready: cosmos.ship.ready, rooms: cosmos.ship.interior.roomList.length, active: cosmos.multiplayer.activeId() }));
  assert.equal(results.reloadedIntoRaider.type, 'raider');
  await sync();
  // B's own raider on its pad: outside, then the crew seated in the cockpit
  await b.evaluate(() => { const c = cosmos, f = c.ship.flight; c.ship.aboard = false; const e = f.toWorld({ x: -14, y: 4, z: -22 }, {}), t = f.toWorld({ x: 0, y: 1.5, z: -4 }, {}); c.freeCam.set(e, t); c.step(1 / 60); });
  await shot(b, 'm06_own_raider_on_its_pad');
  await b.waitForFunction(() => { const m = cosmos.multiplayer; return [...m.bodies.values()].filter((v) => v.person.loaded).length >= 3; }, null, { timeout: 120000 }).catch(() => {});
  await b.evaluate(() => { const c = cosmos, f = c.ship.flight; const e = f.toWorld({ x: 0.2, y: 1.7, z: -8.7 }, {}), t = f.toWorld({ x: 0, y: 1.2, z: -11 }, {}); c.freeCam.set(e, t); for (let i = 0; i < 20; i++) c.step(1 / 30); });
  results.crewBodies = await b.evaluate(() => [...cosmos.multiplayer.bodies.entries()].filter(([, v]) => v.person.loaded && v.group.visible).length);
  await shot(b, 'm07_crew_seated_in_the_cockpit_through_the_door');
  await b.evaluate(() => { const c = cosmos, f = c.ship.flight; const e = f.toWorld({ x: -7.5, y: 1.9, z: -10.2 }, {}), t = f.toWorld({ x: 0.2, y: 1.1, z: -10.6 }, {}); c.freeCam.set(e, t); c.multiplayer.updateBodies(1 / 60); for (let i = 0; i < 20; i++) c.step(1 / 30); });
  await shot(b, 'm07_b_crew_seen_through_the_canopy_from_outside');
  // the second player's view of it: a Meridian looking at a Shrike on a pad
  await a.evaluate((rid) => { const c = cosmos, S = c.world.snapshot.ships[rid]; });
  fixtureWalk(pa(), ownedPad); await sync();
  await a.evaluate((rid) => { const c = cosmos, s = c.world.snapshot.ships[rid], v = c.multiplayer.fleetView.views.get(rid); const p = c.walker.worldPos, f = c.walker.updateFrame(); c.freeCam.set({ x: p.x + f.up.x * 3, y: p.y + f.up.y * 3, z: p.z + f.up.z * 3 }, { x: s.pose.pos.x, y: s.pose.pos.y, z: s.pose.pos.z }); c.step(1 / 60); }, rid);
  await shot(a, 'm08_player_a_sees_player_bs_raider_parked');
  function fixtureWalk(p, pad) { p.pose.worldPos = w.site.toWorld(pad.x - 40, .02, pad.z + 6); p.pose.velocity = { x: 0, y: 0, z: 0 }; p.poseAt = clock; p.aboardShipId = null; p.pose.aboard = false; p.pose.seat = null; p.frameId = 'mars'; }
  // phone tier: the fleet panel and the shipyard at 390 px wide
  const P = await mk('C'.repeat(48), 'Phone', 'ada', { width: 390, height: 844 }, { isMobile: true, hasTouch: true });
  await ready(P.page);
  await P.page.evaluate(() => { const m = cosmos.multiplayer; m.panel.hidden = false; m.draw(); });
  await shot(P.page, 'm09_phone_fleet_panel');
  results.phonePanelText = await P.page.evaluate(() => cosmos.multiplayer.panel.innerText.slice(0, 400));
  await P.page.evaluate(() => { const c = cosmos, k = c.multiplayer.fleetView.kiosk, p = c.port.site; c.multiplayer.panel.hidden = true; const e = p.toWorld(-34, 2.2, 47), t = p.toWorld(-36, 1.6, 40); c.freeCam.set(e, t); c.step(1 / 60); });
  await shot(P.page, 'm10_phone_shipyard_kiosk');
  assert.deepEqual(errors, []); results.pageErrors = errors; console.log('Fleet browser assertions passed.');
} finally {
  await writeFile(join(out, 'fleet-browser-results.json'), JSON.stringify({ results, errors }, null, 2));
  await browser?.close(); if (app) await app.close(); await rm(temp, { recursive: true, force: true });
}
