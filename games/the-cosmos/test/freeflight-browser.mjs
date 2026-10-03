// FREEFLIGHT in real browsers against an isolated authority (never the live world):
//   * client A: an iPhone-profile WebKit page flying her with real taps (the bar) and a held thumb (the stick, THRUST, BRAKE);
//   * client B: a second page (Chromium) in the same world that must SEE her fly: her state, her pose moving, her drawn hull.
//   node test/freeflight-browser.mjs
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
const out = fileURLToPath(new URL('../docs/qa/2026-10-03/freeflight/', import.meta.url)); await mkdir(out, { recursive: true });
const resultFile = join(out, 'browser-results.json');
const dir = await mkdtemp(join(tmpdir(), 'cosmos-freeflight-browser-'));
const errors = []; const results = {}; let app, browserA, browserB;
const MARS_R = 3_389_500, MU = 6.6743e-11 * 6.417e23;
const len = (v) => Math.hypot(v.x, v.y, v.z);
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
  assert.notEqual(aId, bId);
  const pa = world.state.players[aId], pb = world.state.players[bId], recA = world.state.ships[pa.shipId], recB = world.state.ships[pb.shipId];
  const S = (rec) => world.sims.get(rec.id);
  const R0 = MARS_R + 400_000, vc = Math.sqrt(MU / R0);
  // The harness, not a client, puts the two ships in orbit with the pilot seated (a client cannot teleport; this is test setup).
  await world.enqueue(() => {
    for (const [p, rec, lon, off] of [[pa, recA, 0.0, 0], [pb, recB, 0.0, 0.8 * Math.PI * R0]]) {
      const sim = S(rec), seat = sim.def.seats.find((q) => q.id === 'pilot');
      p.aboardShipId = rec.id; p.currentShipId = rec.id; p.pose.aboard = true; p.pose.seat = 'pilot'; p.pose.sw = { x: seat.x, y: seat.y, z: seat.z, yaw: 0, pitch: 0 }; p.frameId = 'mars';
      const r = R0, th = off / r;                                // B is most of the way round the same orbit from A
      sim.flight.landed = false; sim.flight.airborne = true; sim.flight.gearPos = 0;
      sim.flight.pos = { x: r * Math.cos(th), y: 0, z: -r * Math.sin(th) }; sim.flight.vel = { x: -vc * Math.sin(th), y: 0, z: -vc * Math.cos(th) };
      if (rec === recA) { sim.ff.enabled = true; sim.ff._install(); }
    }
    world.state.revision++;
  });
  await A.waitForFunction(() => cosmos.space.ff.active && cosmos.ship.seat?.id === 'pilot', null, { timeout: 60000 });
  await B.waitForFunction(() => cosmos.world.snapshot && Object.values(cosmos.world.snapshot.ships).some((s) => s.ff?.active), null, { timeout: 60000 });
  await A.waitForTimeout(1500);
  const shot = (p, name) => p.screenshot({ path: join(out, name) });
  await shot(A, 'phone-1-orbit-hud.png');

  // ---- the HUD on a phone: what is on screen, and that nothing overlaps ------------------------------------------------------------
  const overlaps = () => A.evaluate(() => {
    const shown = (el) => { for (let n = el; n && n !== document.documentElement; n = n.parentElement) { const c = getComputedStyle(n); if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity === 0 || n.hidden) return false; } const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const name = (e) => (e.id ? '#' + e.id : (e.textContent || '').trim().slice(0, 18));
    const list = [...document.querySelectorAll('button,a.btn,[role=button]')].filter(shown).filter((e) => !e.closest('#settings-panel,#multiplayer-panel,#account-panel,#crew-panel,#space-sheet,#ship-panel,#key-pad,#voice-mic-dialog'));
    const bad = [], W = innerWidth, H = innerHeight;
    for (const e of list) { const r = e.getBoundingClientRect(); if (r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > H + 1) bad.push(name(e) + ' off-screen'); if (r.height < 40 && !e.closest('#hud')) bad.push(name(e) + ' under 40 px tall (' + Math.round(r.height) + ')'); }
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) { const a = list[i], b = list[j]; if (a.contains(b) || b.contains(a)) continue;
      const p = a.getBoundingClientRect(), q = b.getBoundingClientRect(), w = Math.min(p.right, q.right) - Math.max(p.left, q.left), h = Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top); if (w > 1 && h > 1) bad.push(name(a) + ' x ' + name(b)); }
    const hud = document.getElementById('hud').getBoundingClientRect(), bar = document.getElementById('ff-bar').getBoundingClientRect();
    return { count: list.length, bad, hudBottom: Math.round(hud.bottom), barTop: Math.round(bar.top), height: H, labels: ['btn-lift', 'btn-sink'].map((i) => document.getElementById(i).textContent) };
  });
  const ov = await overlaps();
  results.phoneLayout = ov; console.log('phone layout', JSON.stringify(ov));
  assert.deepEqual(ov.bad, [], 'buttons overlap or fall off the 393 px screen: ' + ov.bad.join('; '));
  assert.ok(ov.count >= 9, 'free-flight bar buttons are not all on screen');
  assert.deepEqual(ov.labels, ['THRUST ▲', 'BRAKE ▼'], 'LIFT / SINK should read THRUST / BRAKE in free flight');
  assert.ok(ov.hudBottom < ov.barTop, `the HUD text (${ov.hudBottom}) runs into the bar (${ov.barTop})`);

  // ---- real taps on the bar -----------------------------------------------------------------------------------------------------
  const tap = async (selector) => { const box = await A.locator(selector).boundingBox(); assert.ok(box, selector + ' has no box'); await A.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2); };
  const waitFor = (fn, ms = 8000) => (async () => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = fn(); if (v) return v; await sleep(60); } throw Error('timed out: ' + fn); })();
  const simA = () => S(recA), ffA = () => S(recA).ff;
  await tap('#ff-bar [data-a=assist]'); await waitFor(() => ffA().assist === 'prograde');
  await tap('#ff-bar [data-a=target]'); await waitFor(() => ffA().target === 'deimos');
  await tap('#ff-bar [data-a=thr]'); await waitFor(() => ffA().throttle === 0.25);
  await tap('#ff-bar [data-a=thr]'); await tap('#ff-bar [data-a=thr]'); await waitFor(() => ffA().throttle === 1);
  await A.waitForFunction(() => document.querySelector('#ff-bar [data-a=assist]').textContent.includes('PROGRADE') && document.querySelector('#ff-bar [data-a=target]').textContent.includes('DEIMOS'), null, { timeout: 8000 });
  results.taps = { assist: ffA().assist, target: ffA().target, throttle: ffA().throttle };
  console.log('real taps changed the authority:', JSON.stringify(results.taps));
  await sleep(6000);                                                  // let her swing round to prograde (the assist is rate limited)

  // ---- THRUST: a held finger burns the drive; letting go stops it -------------------------------------------------------------------
  const press = (selector, type, id = 91) => A.evaluate(({ selector, type, id }) => { const el = document.querySelector(selector); el.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: false, bubbles: true, cancelable: true })); }, { selector, type, id });
  const v0 = len(simA().flight.vel), fuel0 = ffA().fuel;
  await press('#btn-lift', 'pointerdown'); await sleep(3000);
  const vHeld = len(simA().flight.vel), burning = simA().flight.thrustFwd > 0;
  await press('#btn-lift', 'pointerup'); await sleep(400);
  const vLet = len(simA().flight.vel); await sleep(1500); const vAfter = len(simA().flight.vel);
  results.thrust = { v0, vHeld, vLet, vAfter, fuelUsedPct: +(100 * (fuel0 - ffA().fuel)).toFixed(3), burning };
  console.log('thrust', JSON.stringify(results.thrust));
  assert.ok(vHeld - v0 > 15 && burning, `holding THRUST should burn the drive (${v0} -> ${vHeld})`);
  assert.ok(Math.abs(vAfter - vLet) < 2.5, 'letting go of THRUST must stop the burn (speed kept changing: ' + (vAfter - vLet) + ')');
  assert.ok(fuel0 - ffA().fuel > 0.0003, 'the burn must cost fuel');
  await shot(A, 'phone-2-thrust.png');

  // ---- the stick turns her: a held thumb on the left half --------------------------------------------------------------------------
  await tap('#ff-bar [data-a=assist]'); await waitFor(() => ffA().assist === 'retro');
  await tap('#ff-bar [data-a=assist]'); await waitFor(() => ffA().assist === 'target');
  await tap('#ff-bar [data-a=assist]'); await waitFor(() => ffA().assist === 'off');       // assist off: the stick turns her
  await sleep(800);
  const nose = () => { const q = simA().flight.attitude || simA().flight.quaternion; const x = q.x, y = q.y, z = q.z, w = q.w; return { x: -2 * (x * z + w * y), y: -2 * (y * z - w * x), z: -(1 - 2 * (x * x + y * y)) }; };
  const n0 = nose();
  const THUMB = { id: 71, x: 80, y: Math.round(852 * 0.76) };
  const thumb = (type, dy = 0, dx = 0) => A.evaluate(({ t, type, dy, dx }) => { const c = document.querySelector('canvas'); c.dispatchEvent(new PointerEvent(type, { pointerId: t.id, pointerType: 'touch', isPrimary: false, clientX: t.x + dx, clientY: t.y - dy, bubbles: true, cancelable: true })); }, { t: THUMB, type, dy, dx });
  await thumb('pointerdown'); await thumb('pointermove', 60); await sleep(1500); const during = { ...nose() }; await thumb('pointerup'); await sleep(2500);
  const n1 = nose(), turned = Math.acos(Math.max(-1, Math.min(1, n0.x * n1.x + n0.y * n1.y + n0.z * n1.z)));
  const restA = nose(); await sleep(1500); const restB = nose(), drift = Math.acos(Math.max(-1, Math.min(1, restA.x * restB.x + restA.y * restB.y + restA.z * restB.z)));
  results.stick = { turnedDeg: +(turned * 57.3).toFixed(1), driftAfterReleaseDeg: +(drift * 57.3).toFixed(2) };
  console.log('stick', JSON.stringify(results.stick));
  assert.ok(turned > 0.15, 'the held thumb should turn the ship (turned ' + turned + ' rad)');
  assert.ok(drift < 0.02, 'she should stop turning when the thumb is lifted');
  await shot(A, 'phone-3-stick.png');

  // ---- time compression: tap x60, the authority runs her sixty times faster, and drops it by itself near another ship -----------------------------------
  await tap('#ff-bar [data-a=warp][data-w="60"]'); await waitFor(() => ffA().warp === 60 && ffA().eff === 60, 10000);
  const t0 = Date.now(), a0 = Math.atan2(simA().flight.pos.z, simA().flight.pos.x); await sleep(1500);
  const dAng = Math.abs(((Math.atan2(simA().flight.pos.z, simA().flight.pos.x) - a0 + Math.PI * 3) % (Math.PI * 2)) - Math.PI), dt = (Date.now() - t0) / 1000;
  const expect = (len(simA().flight.vel) / len(simA().flight.pos)) * 60 * dt;
  results.warp = { requested: 60, eff: ffA().eff, orbitDeg: +(dAng * 57.3).toFixed(1), expectDeg: +(expect * 57.3).toFixed(1) };
  console.log('warp', JSON.stringify(results.warp));
  assert.ok(dAng > expect * 0.5 && dAng < expect * 1.6, 'x60 should fly the orbit sixty times faster than the clock');
  await A.waitForFunction(() => document.querySelector('#ff-bar [data-w="60"]').getAttribute('aria-pressed') === 'true', null, { timeout: 5000 });
  await shot(A, 'phone-4-warp60.png');
  const ovl = await A.evaluate(() => { const st = cosmos.space.ffUI.stat; return { frames: st.n, meanMs: +(st.ms / st.n).toFixed(3), maxMs: +st.max.toFixed(2) }; }); results.overlayCost = ovl; console.log('overlay cost per frame (software WebKit, headless)', JSON.stringify(ovl));
  await tap('#ff-bar [data-a=warp][data-w="1"]'); await waitFor(() => ffA().warp === 1);

  // ---- BRAKE: turns her retrograde on its own and burns the speed away (relative to Mars here) ------------------------------------------------
  const sp0 = len(simA().flight.vel);
  await press('#btn-sink', 'pointerdown', 92); await sleep(13000);
  const sp1 = len(simA().flight.vel), retro = simA().ff.input.brake; await press('#btn-sink', 'pointerup', 92); await sleep(400);
  results.brake = { before: sp0, during: sp1, brakeInput: retro };
  console.log('brake', JSON.stringify(results.brake));
  assert.ok(sp1 < sp0 - 30, `BRAKE should turn her over and burn speed away (${sp0} -> ${sp1})`);

  // ---- the other client sees her -------------------------------------------------------------------------------------------------
  const seenB = await B.evaluate((id) => { const s = cosmos.world.snapshot.ships[id]; return { ff: s.ff, v: Math.hypot(s.pose.vel.x, s.pose.vel.y, s.pose.vel.z), q: s.pose.quaternion, p: s.pose.pos }; }, recA.id);
  await sleep(1200);
  const seenB2 = await B.evaluate((id) => { const s = cosmos.world.snapshot.ships[id]; return { p: s.pose.pos, ff: s.ff }; }, recA.id);
  const moved = Math.hypot(seenB2.p.x - seenB.p.x, seenB2.p.y - seenB.p.y, seenB2.p.z - seenB.p.z);
  results.clientB = { ffActive: seenB.ff.active, assist: seenB.ff.assist, fuel: seenB.ff.fuel, speedKms: +(seenB.v / 1000).toFixed(2), movedM: Math.round(moved) };
  console.log('client B sees', JSON.stringify(results.clientB));
  assert.ok(seenB.ff.active && seenB.v > 3000 && moved > 1000, 'client B must see A free-flying: ' + JSON.stringify(results.clientB));
  // and DRAWS her: B's camera is put 90 m from where A's hull is drawn, and the hull must be there, visible, and move with her
  const draw = await B.evaluate(async (id) => {
    const m = cosmos.multiplayer, v = m.fleetView.views.get(id); if (!v) return { view: false };
    const e = v.entry, p = { ...e.worldPos };
    // a camera that rides 70 m off her shoulder (she is doing 3 km/s: a fixed camera would watch her leave). It runs after the game's own updaters, so it
    // reads the position this very frame is about to draw her at.
    const off = { x: 55, y: 30, z: 35 }, V = cosmos.engine.camera.position.constructor;
    const follow = () => { const p = v.entry.worldPos; cosmos.freeCam.set({ x: p.x + off.x, y: p.y + off.y, z: p.z + off.z }, p);
      Object.assign(cosmos.engine.cameraWorldPos, { x: p.x + off.x, y: p.y + off.y, z: p.z + off.z });
      const l = Math.hypot(p.x, p.y, p.z) || 1; cosmos.engine.camera.up.set(p.x / l, p.y / l, p.z / l); cosmos.engine.camera.lookAt(new V(-off.x, -off.y, -off.z)); };
    cosmos.engine.addUpdater(follow); for (let i = 0; i < 30; i++) cosmos.step(1 / 60);
    let meshes = 0, visible = 0; v.root.traverse((o) => { if (o.isMesh) { meshes++; if (o.visible) visible++; } });
    const cam = cosmos.engine.camera, wp = new cam.position.constructor(); v.root.getWorldPosition(wp); const ndc = wp.clone().project(cam);
    return { view: true, camWorld: { ...cosmos.engine.cameraWorldPos }, freeActive: cosmos.freeCam.active, rootWorld: wp.toArray(), ndc: ndc.toArray(), entry: { ...v.entry.worldPos }, rootVisible: v.root.visible, meshes, visibleMeshes: visible, atPose: p, frame: v.entry.frame?.id };
  }, recA.id);
  results.clientBDraw = draw; console.log('client B draws', JSON.stringify(draw));
  assert.ok(draw.view && draw.rootVisible && draw.visibleMeshes > 20, 'client B must draw A\'s hull');
  await shot(B, 'client-B-sees-A-flying.png');
  await B.evaluate(() => cosmos.freeCam.off());

  // ---- a moon: SINK lands her anywhere, LIFT takes her up and free flight takes the ship again (real held buttons) -----------------------------------------------
  // The harness parks her 700 m over a spot of Phobos that is not the pad, free flight off (the node checks fly the whole approach and the landing at four places).
  const { makeMoon } = await import('../src/space/moonField.js');
  await world.enqueue(() => {
    const sim = simA(); sim.ff.suspend('harness'); sim.flight.override = null; sim.flight.attitude = null;
    sim.setFrame('phobos');
    const mb = makeMoon('phobos'), l = Math.hypot(0.1, -0.95, 0.3), d = { x: 0.1 / l, y: -0.95 / l, z: 0.3 / l }, R = mb.surfaceRadius(d.x, d.y, d.z) + 700;
    sim.flight.pos = { x: d.x * R, y: d.y * R, z: d.z * R }; sim.flight.vel = { x: 0, y: 0, z: 0 }; sim.flight.autoHover = true; sim.flight.thrustDown = true; sim.flight.gearPos = 0; sim.flight.landed = false;
    sim.flight.refreshOrientation(); world.state.revision++;
  });
  await A.waitForFunction(() => cosmos.space.frameId === 'phobos' && !cosmos.space.ff.active, null, { timeout: 60000 });
  await sleep(1500);
  const labels = await A.evaluate(() => ['btn-lift', 'btn-sink'].map((i) => document.getElementById(i).textContent));
  assert.deepEqual(labels, ['LIFT ▲', 'SINK ▼'], 'the buttons read LIFT and SINK again once the ship is flown by the flight assist');
  await shot(A, 'phone-5-over-phobos.png');
  await tap('#ff-bar [data-a=toggle]'); await waitFor(() => ffA().enabled && !ffA().active, 8000);     // armed: she will take the ship again above 3 km
  await A.waitForFunction(() => getComputedStyle(document.querySelector('#ff-bar [data-a=warp]')).display !== 'none' && document.querySelector('#ff-bar [data-a=toggle]').textContent.includes('ARMED'), null, { timeout: 8000 });
  await press('#btn-sink', 'pointerdown', 93);
  const tDown = Date.now(); await waitFor(() => simA().flight.landed, 170000);
  await press('#btn-sink', 'pointerup', 93);
  const down = { seconds: Math.round((Date.now() - tDown) / 1000), hull: simA().flight.hull, agl: simA().flight.agl, frame: simA().frameId, speed: simA().flight.speed };
  results.moonLanding = down; console.log('moon landing', JSON.stringify(down));
  assert.ok(down.hull > 99 && down.frame === 'phobos', 'she must land intact on Phobos');
  await sleep(1500); await shot(A, 'phone-6-landed-on-phobos.png');
  await press('#btn-lift', 'pointerdown', 94);
  const tUp = Date.now(); await waitFor(() => ffA().active && simA().frameId === 'mars', 170000);
  await press('#btn-lift', 'pointerup', 94);
  results.moonTakeoff = { seconds: Math.round((Date.now() - tUp) / 1000), frame: simA().frameId, ff: ffA().active };
  console.log('moon takeoff', JSON.stringify(results.moonTakeoff));
  await A.waitForFunction(() => cosmos.space.ff.active && cosmos.space.frameId === 'mars' && document.getElementById('btn-lift').textContent.includes('THRUST'), null, { timeout: 20000 });
  await sleep(800); await shot(A, 'phone-7-free-again.png');
  const seenAgain = await B.evaluate((id) => cosmos.world.snapshot.ships[id].ff.active, recA.id);
  assert.ok(seenAgain, 'client B must see her in free flight again');
  await writeFile(resultFile, JSON.stringify({ results, errors }, null, 1));
  console.log('FREEFLIGHT BROWSER OK');
} catch (e) {
  errors.push(String(e.stack || e)); console.error(e);
} finally {
  await writeFile(resultFile, JSON.stringify({ results, errors }, null, 1)).catch(() => {});
  await browserA?.close(); await browserB?.close(); if (app) await app.close(); await rm(dir, { recursive: true, force: true });
  process.exit(errors.length ? 1 : 0);
}
