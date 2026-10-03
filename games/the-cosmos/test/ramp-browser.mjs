// Walking up a lowered ramp boards the ship (real iPhone-profile WebKit, held thumb, isolated authority with a busy port).
//   node test/ramp-browser.mjs
import '../server/runtime.mjs';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, copyFile } from 'node:fs/promises';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { startServer } from '../server/index.mjs';
import { FileAdapter } from '../server/storage.mjs';
import { TestClient } from './multiplayer-checks.mjs';

let pw; try { pw = createRequire(import.meta.url)('playwright'); } catch { pw = createRequire(process.env.COSMOS_PLAYWRIGHT_ROOT || join(homedir(), '.codex/runtime/unfinished-island/node_modules/'))('playwright'); }
const out = fileURLToPath(new URL('../docs/qa/2026-10-02/ramp/', import.meta.url)); await mkdir(out, { recursive: true });
const useChromium = process.env.COSMOS_QA_CHROMIUM === '1';
const dir = await mkdtemp(join(tmpdir(), 'cosmos-ramp-'));
const errors = []; let app, browser; const others = [];
try {
  if (process.env.WORLD) await copyFile(process.env.WORLD, join(dir, 'world.json'));   // a copy of the live world, exported by perf-export-live.mjs
  app = await startServer({ adapter: new FileAdapter(join(dir, 'world.json')), port: 0, tick: true });
  const world = app.world, origin = app.url.replace('ws:', 'http:');
  for (let i = 0; i < Number(process.env.OTHERS || 8); i++) { const c = new TestClient(app.url, String.fromCharCode(97 + i).repeat(48), 'Visitor ' + (100 + i)); await c.connect(); others.push(c); }
  browser = useChromium
    ? await pw.chromium.launch({ headless: true, executablePath: process.env.COSMOS_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
    : await pw.webkit.launch({ headless: true, executablePath: process.env.COSMOS_WEBKIT || join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'webkit-2336', 'Playwright.exe') });
  const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(String(e))); p.setDefaultTimeout(240000);
  await p.goto(`${origin}/?dev=1&opening=off&tier=low&ws=${app.url}`, { waitUntil: 'commit', timeout: 240000 });
  await p.waitForFunction(() => window.cosmos?.multiplayer?.initialized && cosmos.engine.frameCount >= 2, null, { timeout: 300000 }); await p.waitForTimeout(1500);
  const pid = await p.evaluate(() => cosmos.world.playerId), me = world.state.players[pid], ship = world.state.ships[me.shipId], sim0 = world.sims.get(ship.id); let tship = ship; if (process.env.TARGET === 'other') { tship = Object.values(world.state.ships).find((x) => !x.npc && x.id !== ship.id && x.state?.ramps?.cargo?.lowered); world.state.ships[tship.id].crewMayBoard = true; world.state.revision++; await new Promise((r) => setTimeout(r, 1500)); } const sim = world.sims.get(tship.id); console.log('target', tship.id.slice(0,6), tship.type, 'my ship', ship.type, 'pad', ship.pad?.number, 'ships', Object.keys(world.state.ships).length);
  const THUMB = { id: 71, x: 80, y: 650 };
  const thumb = (type, dy = 0) => p.evaluate(({ t, type, dy }) => { const c = document.querySelector('canvas'); c.dispatchEvent(new PointerEvent(type, { pointerId: t.id, pointerType: 'touch', isPrimary: false, clientX: t.x, clientY: t.y - dy, bubbles: true, cancelable: true })); }, { t: THUMB, type, dy });
  // lower the ramp for real, through the page's own request
  const rampRes = world.state.ships[tship.id].state.ramps.cargo.target > .5 ? 'already down' : await p.evaluate(() => cosmos.multiplayer.request({ type: 'ramp', key: 'cargo' })); console.log('ramp request', JSON.stringify(rampRes));
  for (let i = 0; i < 80 && !world.state.ships[tship.id].state.ramps.cargo.lowered; i++) await new Promise((r) => setTimeout(r, 250));
  console.log('server ramp', JSON.stringify(world.state.ships[tship.id].state.ramps.cargo), 'ctl', JSON.stringify(sim.ship.rampCtl.cargo));
  await p.waitForFunction(() => cosmos.world.snapshot.ships[cosmos.world.snapshot.players[cosmos.world.playerId].shipId].state.ramps.cargo.lowered, null, { timeout: 30000 });
  const r = sim.def.ramps.cargo, st = world.state.ships[tship.id].state.ramps.cargo, run = r.length * Math.cos(st.angle);
  console.log('ramp', JSON.stringify({ angle: st.angle, run, hinge: r.hinge, dir: r.dir, width: r.width }));
  // stand 7 m out from the tip on the ground, face the ramp, hold the thumb forward
  await p.evaluate(({ r, run, tid }) => { const c = cosmos, s = c.world.snapshot, ship = s.ships[tid], f = c.multiplayer.shipPose(ship);
    const from = { x: r.hinge.x + r.dir.x * (run + 7), y: r.hinge.y - run * Math.tan(ship.state.ramps.cargo.angle) , z: r.hinge.z + r.dir.z * (run + 7) };
    const fl = c.ship.flight, sv = { pos: { ...fl.pos }, q: fl.quaternion.clone() }; fl.pos.x = f.pos.x; fl.pos.y = f.pos.y; fl.pos.z = f.pos.z; fl.quaternion.fromArray(f.quaternion); fl.refreshOrientation?.();
    const w = fl.toWorld(from, {}); Object.assign(fl.pos, sv.pos); fl.quaternion.copy(sv.q); fl.refreshOrientation?.(); window.__w = { x: w.x, y: w.y, z: w.z }; return; c.walker.velocity.x = c.walker.velocity.y = c.walker.velocity.z = 0;
    c.walker.yaw = ship.pose.heading; c.walker.pitch = 0; c.walker.updateFrame(); c.step(.016); }, { r, run, tid: tship.id });
  // the server must agree where the player stands (a 280 m jump is refused as a teleport), exactly like a real walk there
  const wpos = await p.evaluate(() => window.__w); me.pose.worldPos = wpos; me.pose.velocity = { x: 0, y: 0, z: 0 }; me.poseAt = Date.now();
  world.state.revision++; await new Promise((r) => setTimeout(r, 800));
  await p.evaluate(({ tid }) => { const c = cosmos, ship = c.world.snapshot.ships[tid]; Object.assign(c.walker.worldPos, window.__w); c.walker.velocity.x = c.walker.velocity.y = c.walker.velocity.z = 0;
    c.walker.yaw = ship.pose.heading; c.walker.pitch = 0; c.walker.updateFrame(); c.step(.016); }, { tid: tship.id });
  const dbg = await p.evaluate(({ tid }) => { const c = cosmos, mp = c.multiplayer, s = c.world.snapshot.ships[tid]; return { mayBoard: s.crewMayBoard, frame: s.frameId, spaceFrame: mp.space.frameId, landed: s.pose.landed, active: mp.activeId().slice(0, 6), tid: tid.slice(0, 6), dist: Math.hypot(s.pose.pos.x - c.walker.worldPos.x, s.pose.pos.y - c.walker.worldPos.y, s.pose.pos.z - c.walker.worldPos.z), ramps: JSON.stringify(s.state.ramps.cargo), presence: !!mp.shipPresence }; }, { tid: tship.id }); console.log('dbg', JSON.stringify(dbg));
  const dbg2 = await p.evaluate(async ({ tid }) => { const { rampEntry } = await import('/src/ship/rampTransfer.js'), { shipDef } = await import('/src/ships/registry.js'), THREE = await import('three');
    const c = cosmos, mp = c.multiplayer, s = c.world.snapshot.ships[tid], ramps = shipDef(s.type).ramps, f = mp.shipPose(s), q = new THREE.Quaternion().fromArray(f.quaternion).invert();
    const out = []; for (const dz of [0, -1, -2, -3]) { const k = 'cargo', R = ramps[k], run = R.length * Math.cos(s.state.ramps[k].angle);
      const loc0 = { x: 0, y: R.hinge.y - run * Math.tan(s.state.ramps[k].angle) + 0.1, z: R.hinge.z + run + dz * -1 * -1 }; 
      out.push({ loc: loc0, entry: rampEntry(k, s.state.ramps[k], { ...loc0, z: R.hinge.z + run - 0.3 + dz * 0.5 }, { x: 0, z: -1 }, ramps) }); }
    const { ShipWalker, shipIndexFor } = await import('/src/ship/shipWalker.js'); const wk = new ShipWalker(shipIndexFor(shipDef(s.type)), s.state); const cs = out.map((o) => o.entry && wk.canStand(o.entry.x, o.entry.y, o.entry.z)); out.push({ cs });
    const l = new THREE.Vector3().copy(c.walker.worldPos).sub(new THREE.Vector3().copy(f.pos)).applyQuaternion(q);
    return { out, nowLoc: [l.x, l.y, l.z], heading: s.pose.heading, walkerYaw: c.walker.yaw, shipHasAvatar: typeof shipDef(s.type).hull.push }; }, { tid: tship.id }); console.log('dbg2', JSON.stringify(dbg2));
  const trace = [];
  await thumb('pointerdown'); await thumb('pointermove', 60);
  for (let i = 0; i < 40; i++) {
    await p.evaluate(async () => { const c = cosmos, rr = c.engine.renderer, render = rr.render; rr.render = () => {}; try { for (let t = 0; t < .25; t += 1 / 60) c.step(1 / 60); } finally { rr.render = render; } });
    const s = await p.evaluate(({ tid }) => { const c = cosmos, ts = c.world.snapshot.ships[tid], f = c.multiplayer.shipPose(ts), q = new c.walker.worldPos.constructor.prototype.constructor(), l0 = { x: c.walker.worldPos.x - f.pos.x, y: c.walker.worldPos.y - f.pos.y, z: c.walker.worldPos.z - f.pos.z }; const [qx, qy, qz, qw] = f.quaternion; const ix = qw * l0.x - qy * l0.z + qz * l0.y * 0, l = (() => { const v = l0, u = { x: -qx, y: -qy, z: -qz }; const t = { x: 2 * (u.y * v.z - u.z * v.y), y: 2 * (u.z * v.x - u.x * v.z), z: 2 * (u.x * v.y - u.y * v.x) }; return { x: v.x + qw * t.x + (u.y * t.z - u.z * t.y), y: v.y + qw * t.y + (u.z * t.x - u.x * t.z), z: v.z + qw * t.z + (u.x * t.y - u.y * t.x) }; })(); return { aboard: c.ship.aboard, pending: c.multiplayer.boardPending, loc: [+l.x.toFixed(2), +l.y.toFixed(2), +l.z.toFixed(2)], vel: Math.hypot(c.walker.velocity.x, c.walker.velocity.y, c.walker.velocity.z).toFixed(2) }; }, { tid: tship.id });
    trace.push(s); if (s.aboard) break; await p.waitForTimeout(100);
  }
  await thumb('pointerup');
  console.log('trace (first/last)', JSON.stringify(trace.slice(0, 4)), '...', JSON.stringify(trace.slice(-3)));
  await p.screenshot({ path: join(out, 'ramp-walk.png') });
  const aboard = await p.evaluate(() => cosmos.ship.aboard); const srv = world.state.players[pid].aboardShipId;
  assert.ok(aboard && srv === tship.id, `walking up the ramp did not board: client aboard=${aboard}, server aboardShipId=${srv}`);
  console.log('PASS walked up the ramp and boarded');
} catch (e) { console.error('FAIL', e.message); process.exitCode = 1; }
finally { for (const c of others) c.close(); await browser?.close(); await app?.close(); if (errors.length) console.log('page errors:', errors.slice(0, 5)); }
process.exit(process.exitCode || 0);
