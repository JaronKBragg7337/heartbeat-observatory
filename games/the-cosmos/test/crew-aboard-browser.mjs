// Hired crew must be visible to a player who is aboard (real iPhone-profile WebKit, isolated authority, never the live world).
//   node test/crew-aboard-browser.mjs        (COSMOS_QA_CHROMIUM=1 for Chromium)
import '../server/runtime.mjs';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { startServer } from '../server/index.mjs';
import { FileAdapter } from '../server/storage.mjs';
import { CREW_HALL } from '../server/authority.mjs';
import { TestClient } from './multiplayer-checks.mjs';

let pw; try { pw = createRequire(import.meta.url)('playwright'); } catch { pw = createRequire(process.env.COSMOS_PLAYWRIGHT_ROOT || join(homedir(), '.codex/runtime/unfinished-island/node_modules/'))('playwright'); }
const out = fileURLToPath(new URL('../docs/qa/2026-10-02/crew-aboard/', import.meta.url)); await mkdir(out, { recursive: true });
const useChromium = process.env.COSMOS_QA_CHROMIUM === '1';
const dir = await mkdtemp(join(tmpdir(), 'cosmos-crewaboard-'));
const errors = []; let app, browser; const results = {};
try {
  app = await startServer({ adapter: new FileAdapter(join(dir, 'world.json')), port: 0, tick: true });
  const world = app.world, origin = app.url.replace('ws:', 'http:');
  browser = useChromium
    ? await pw.chromium.launch({ headless: true, executablePath: process.env.COSMOS_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
    : await pw.webkit.launch({ headless: true, executablePath: process.env.COSMOS_WEBKIT || join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'webkit-2336', 'Playwright.exe') });
  const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(String(e))); p.setDefaultTimeout(240000);
  await p.goto(`${origin}/?dev=1&opening=off&tier=low&ws=${app.url}`, { waitUntil: 'commit', timeout: 240000 });
  await p.waitForFunction(() => window.cosmos?.multiplayer?.initialized && cosmos.engine.frameCount >= 2, null, { timeout: 300000 }); await p.waitForTimeout(1000);
  const pid = await p.evaluate(() => cosmos.world.playerId);
  const pl = world.state.players[pid], ship = world.state.ships[pl.shipId], sim = world.sims.get(ship.id);
  // hire a pilot and a gunner for real, then seat them (the walk aboard is covered elsewhere)
  for (const role of ['pilot', 'gunner_dorsal']) {
    const c = Object.values(world.state.pool).find((x) => x.role === role && !x.shipId);
    pl.pose.worldPos = world.site.toWorld(CREW_HALL.door.x, 0.02, CREW_HALL.door.z);
    await world.action(pl.id, 'meet-' + role, { type: 'meet', id: c.id }); world.advance(25);
    pl.pose.worldPos = world.site.toWorld(c.position.x, 0.02, c.position.z + 1);
    const r = await world.action(pl.id, 'hire-' + role, { type: 'hire', id: c.id }); assert.ok(r.ok, r.msg);
  }
  // Real boarding: the hired crew walk up the ramp and sit; the player waits aboard, in the cargo bay, and then on the bridge. (Tick is on.)
  pl.aboardShipId = ship.id; pl.currentShipId = ship.id; pl.pose.aboard = true; pl.pose.seat = null; pl.pose.sw = { ...sim.def.dock.boardSw, pitch: 0 }; pl.frameId = sim.frameId;
  world.state.revision++;
  const seen = []; const t0 = Date.now(); let seated = 0;
  while (Date.now() - t0 < 110000) {
    await new Promise((r) => setTimeout(r, 1500));
    const snap = await p.evaluate(() => { const m = cosmos.multiplayer; return [...cosmos.ship.crew.members.values()].filter((x) => x.place === 'ship').map((x) => { const b = m.bodies.get(x.id), o = b.group, v = o.getWorldPosition(new o.position.constructor()), cam = cosmos.engine.camera; let meshes = 0; o.traverse((q) => { if (q.isMesh && q.visible) meshes++; });
      return { n: x.name, mode: x.mode, seated: x.seated, vis: b.group.visible, local: b.local, meshes, dist: v.length(), room: x.sw.zoneRoom || null }; }); });
    seen.push(snap); seated = snap.filter((x) => x.mode === 'sit').length; if (seated >= 2) break;
  }
  console.log('samples', seen.length, 'last', JSON.stringify(seen.at(-1)));
  const everInvisible = seen.flat().filter((x) => !x.vis && x.mode !== 'sit');
  console.log('walking-aboard samples hidden:', everInvisible.length, JSON.stringify(everInvisible.slice(0, 3)));
  results.walk = { samples: seen.length, hiddenWhileWalking: everInvisible.length };
  // The player takes the pilot's chair themselves: the hired pilot is displaced and must stand beside it, in view.
  const ps = sim.def.seats.find((q) => q.id === 'pilot'); pl.pose.sw = { x: ps.x, y: ps.y, z: ps.z, yaw: (ps.yaw || 0) * Math.PI / 180, pitch: 0 }; pl.pose.seat = 'pilot'; world.state.revision++;
  await p.waitForTimeout(3500);
  const info = await p.evaluate(() => { const m = cosmos.multiplayer, s = cosmos.world.snapshot, me = s.players[cosmos.world.playerId];
    return { aboard: me.aboardShipId, seat: me.pose.seat, crewAboard: [...cosmos.ship.crew.members.values()].filter((x) => x.place === 'ship').map((x) => ({ n: x.name, mode: x.mode, seated: x.seated, displaced: x.displaced, vis: m.bodies.get(x.id)?.group.visible, local: m.bodies.get(x.id)?.local, at: m.bodies.get(x.id)?.group.position.toArray().map((v) => +v.toFixed(2)) })),
      interiorVisible: cosmos.ship.interior.root.visible, rooms: [...(cosmos.ship._visibleSet || [])] }; });
  results.info = info; console.log(JSON.stringify(info, null, 1));
  await p.screenshot({ path: join(out, 'aboard.png') });
  // face the pilot and look again: is she really drawn (a person-shaped mesh in view), not just flagged visible?
  const look = await p.evaluate(() => { const m = cosmos.multiplayer, ada = [...cosmos.ship.crew.members.values()].find((x) => x.def?.id === 'pilot'), b = m.bodies.get(ada.id), w = cosmos.ship.sw;
    const sp = ada.sw, px = sp.x + 1.1, pz = sp.z + 1.6; const yaw = Math.atan2(sp.x - px, -(sp.z - pz)) * 180 / Math.PI;
    cosmos.at('bridge', px, pz, yaw, -12, 6);
    let meshes = 0, vis = 0; b.group.traverse((o) => { if (o.isMesh || o.isSkinnedMesh) { meshes++; if (o.visible) vis++; } });
    return { meshes, vis, local: b.local, pos: b.group.position.toArray(), yaw, me: [w.x, w.y, w.z, w.yaw] }; });
  results.look = look; console.log('look', JSON.stringify(look));
  await p.waitForTimeout(600); await p.screenshot({ path: join(out, 'facing-pilot.png') });
  for (const m of info.crewAboard.filter((q) => q.displaced || q.n === 'Ada')) assert.ok(m.vis, `${m.n} (${m.mode}) is invisible aboard: ${JSON.stringify(m)}`);
  console.log('PASS hired crew visible aboard');
} catch (e) { console.error('FAIL', e.message); process.exitCode = 1; }
finally { await browser?.close(); await app?.close(); if (errors.length) console.log('page errors:', errors.slice(0, 5)); }
process.exit(process.exitCode || 0);
