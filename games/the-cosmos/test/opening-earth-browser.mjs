// Earth as a start world on an iPhone-profile WebKit: the arrivals board with Earth open, the pick, the Kestrel to Earth, the wreck on the Florida scrub, the ride, the arrival at the
// Skyward Launch Complex, and the lifeboat chain from the two people there (the cell from Okafor, the coupler from Pruitt, the fitting). Screenshots go to $EARTH_SHOTS (names are stage names).
//   node test/opening-earth-browser.mjs
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { startServer } from '../server/index.mjs';
import { MemoryAdapter } from '../src/world-state/storage.js';
import { outpostToFrame } from '../src/worlds/moon/place.js';
import { makeMoon } from '../src/space/moonField.js';
import * as S from '../src/opening/script.js';
import { shipDef } from '../src/ships/registry.js';
let pw; try { pw = createRequire(import.meta.url)('playwright'); } catch { pw = createRequire(process.env.COSMOS_PLAYWRIGHT_ROOT || 'C:/Users/lilli/.codex/runtime/unfinished-island/node_modules/')('playwright'); }
const out = process.env.EARTH_SHOTS || fileURLToPath(new URL('../docs/qa/opening-earth/', import.meta.url)); await mkdir(out, { recursive: true });
const WEBKIT = process.env.COSMOS_WEBKIT || join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'webkit-2336', 'Playwright.exe');
const IPHONE = { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const errors = []; let app, webkit, clock = Date.now(), bad = 0;
const ok = (name, pass, detail = '') => { if (!pass) bad++; console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass ? '' : '  ' + detail)); };
const K = shipDef('descender');
try {
  app = await startServer({ adapter: new MemoryAdapter(), port: 0, tick: false, now: () => clock });
  webkit = await pw.webkit.launch({ headless: true, executablePath: WEBKIT });
  const url = (q) => app.url.replace('ws:', 'http:') + '/?ws=' + app.url + '&dev=1&' + q;
  const ctx = await webkit.newContext(IPHONE), page = await ctx.newPage(); page.setDefaultTimeout(240000);
  page.on('pageerror', (e) => { errors.push(String(e)); console.log('PAGEERROR', String(e).slice(0, 300)); });
  const ready = async (q = '') => { await page.goto(url('tier=low&' + q)); await page.waitForFunction(() => window.cosmos?.opening && cosmos.engine.frameCount >= 2, null, { timeout: 240000 }); await page.evaluate(async () => { cosmos.engine.stop(); if (cosmos.opening.active) await cosmos.opening.ready; cosmos.step(0); }); };
  const step = async (seconds) => {
    for (let left = seconds; left > 1e-7;) {
      const chunk = Math.min(2, left); left -= chunk; clock += chunk * 1000;
      await page.evaluate(async (sec) => { const k = cosmos, r = k.engine.renderer, render = r.render; r.render = () => {}; try { for (let t = 0; t < sec - 1e-7; t += 1 / 30) k.step(Math.min(1 / 30, sec - t)); await k.opening.pending; } finally { r.render = render; } k.step(0); }, chunk);
    }
  };
  const shot = async (name) => { await page.evaluate(() => cosmos.step(0)); await page.screenshot({ path: join(out, name + '.png') }); console.log('shot', name); };
  const st = () => page.evaluate(() => ({ stage: cosmos.opening.state.stage, clock: cosmos.opening.clock, scene: cosmos.opening.sceneKind, active: cosmos.opening.active, label: cosmos.opening.actionLabel, caption: cosmos.opening.caption?.textContent || '' }));
  const waitStage = async (n, max = 40) => { for (let i = 0; i < max * 2; i++) { if ((await st()).stage === n) return; await step(.5); } assert.equal((await st()).stage, n, 'stage ' + n + ' was not reached'); };
  const waitDone = async (max = 60) => { for (let i = 0; i < max * 2; i++) { if (!(await st()).active) return; await step(.5); } assert.fail('the opening did not finish'); };
  const tpPort = async (pid, x, z, yaw = 0) => { app.world.state.players[pid].opening.pose = { x, y: 0, z, yaw, pitch: 0 }; await page.evaluate(({ x, z, yaw }) => { cosmos.opening.model.place({ x, y: 0, z, yaw, pitch: 0 }); }, { x, z, yaw }); };
  const tpAboard = async (pid, which, x, y, z, yaw = 0) => { app.world.state.players[pid].opening.pose = { x, y, z, yaw, pitch: 0 }; await page.evaluate(({ which, x, y, z, yaw }) => { const o = cosmos.opening; (which === 'kestrel' ? o.kestrel.sw : o.cabinSw).place(x, y, z, yaw); cosmos.step(0); }, { which, x, y, z, yaw }); };
  const tap = async (sel) => {
    const box = await page.locator(sel).boundingBox(); assert.ok(box, sel + ' has no box'); await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await page.evaluate(async () => { const o = cosmos.opening; while (o.active && (o.actionPending || o.busy)) await new Promise((r) => setTimeout(r, 10)); cosmos.step(0); });
  };
  const aim = async (x, z, y = .35) => page.evaluate(({ x, y, z }) => {
    const m = cosmos.opening.model, w = m.walker, e = w.eyeWorldPos({}), p = m.toWorld(x, y, z), f = w.updateFrame();
    const dd = { x: p.x - e.x, y: p.y - e.y, z: p.z - e.z }, l = Math.hypot(dd.x, dd.y, dd.z), dot = (v) => dd.x * v.x + dd.y * v.y + dd.z * v.z; w.yaw = Math.atan2(dot(f.east), dot(f.north)); w.pitch = Math.asin(dot(f.up) / l); cosmos.step(0);
  }, { x, y, z });

  await ready(); const pid = await page.evaluate(() => cosmos.world.playerId);
  // straight to the port hall (the liner is not Earth's business): stage 1, standing at the board
  await page.evaluate(() => { cosmos.engine.stop(); cosmos.world.socket.onclose = null; cosmos.world.socket.close(); }); await new Promise((r) => setTimeout(r, 400));
  const p0 = app.world.state.players[pid]; Object.assign(p0.opening, { stage: 1, pose: S.linerExit(shipDef('transport')), played: true, clock: 0 }); await app.world.commit();
  await ready();
  await tpPort(pid, -98, 44, Math.PI / 2); await step(1); await tpPort(pid, -88, 44.5, 0); await step(1);
  ok('the hall offers the board', (await st()).label === 'Read the board (E)', (await st()).label);
  await tap('#opening-action'); await page.waitForSelector('#opening-board', { timeout: 10000 });
  await page.locator('.ob-tabs button[data-w="earth"]').tap();
  const board = await page.evaluate(() => { const b = document.querySelector('#opening-board'); return { text: b.innerText, go: !!b.querySelector('[data-act="go"]'), goText: b.querySelector('[data-act="go"]')?.textContent || '' }; });
  ok('Earth is open on the board: a fly button, no "coming soon" and no "not built yet"', board.go && /Earth/.test(board.goText) && !/not built yet/i.test(board.text) && !/Earth is not built/i.test(board.text), board.goText);
  ok('the board says where you land and that Homeguard has nothing built', /Skyward Launch Complex/.test(board.text) && /nothing built/i.test(board.text));
  await shot('board-earth-open');
  await page.locator('.ob-side[data-f="skyward"]').tap(); await shot('board-earth-skyward');
  await page.locator('[data-act="go"]').tap(); await page.waitForFunction(() => !document.querySelector('#opening-board'), null, { timeout: 10000 });
  const picked = app.world.state.players[pid].opening; ok('the pick is Earth with Skyward', picked.dest.world === 'earth' && picked.dest.faction === 'skyward' && ['homeguard', 'skyward'].includes(picked.driver), JSON.stringify(picked.dest));
  const g = S.kestrelGate(K); await tpPort(pid, g.x - 2, g.z, 0); await step(1.5); ok('the gate offers the Kestrel to Earth', /Board the Kestrel to Earth/.test((await st()).label), (await st()).label);
  await shot('port-gate-earth'); await tap('#opening-action'); await waitStage(2);
  // the cabin hidden and the head turned to the starboard window: Earth coming up under the ship (the crash overlay is the flight's own, so the last frames are noisy)
  await page.evaluate(() => { const r = cosmos.opening.kestrel.interior.root; Object.defineProperty(r, 'visible', { get: () => false, set() {}, configurable: true }); });
  const look = async (yaw) => page.evaluate((yaw) => { const w = cosmos.opening.kestrel.sw; w.yaw = yaw; w.pitch = 0.1; cosmos.step(0); }, yaw);
  await step(36); await look(1.57); await shot('kestrel-earth-far'); await step(8); await look(1.57); await shot('kestrel-earth-near'); await step(8); await look(1.57); await shot('kestrel-earth-below');
  await step(10); await shot('kestrel-earth-crash'); await step(8); await waitStage(3); await step(2); await shot('wreck-earth-wake');
  await tpAboard(pid, 'cabin', 0, .02, 13, 0); await step(.5); await tap('#opening-action'); await waitStage(4); await step(1); await shot('dig-site-earth');
  await page.evaluate(() => { cosmos.opening.model.place({ x: 4, y: .03, z: 18.5, yaw: 0, pitch: -1 }); }); app.world.state.players[pid].opening.pose = { x: 4, y: .03, z: 18.5, yaw: 0, pitch: -1 };
  for (let i = 0; i < 40 && !await page.evaluate(() => cosmos.opening.model.exposed()); i++) { const [x, z] = [[4, 20], [4.18, 20], [3.82, 20], [4, 20.18], [4, 19.82]][i % 5]; await aim(x, z); await tap('#opening-action'); }
  ok('the crate comes clear on the Earth ground', await page.evaluate(() => cosmos.opening.model.exposed())); await shot('dig-cleared-earth');
  await tap('#opening-action'); await step(9); await shot('driver-earth');
  await page.evaluate(() => { cosmos.opening.model.place({ x: -6, y: .02, z: 23, yaw: Math.PI / 2, pitch: 0 }); }); app.world.state.players[pid].opening.pose = { x: -6, y: .02, z: 23, yaw: 1.57, pitch: 0 }; await step(1);
  await tap('#opening-action'); await step(22); await shot('ride-earth');
  // a refresh mid-ride (the playtester found this: shipPose threw on every frame after the page came back, and the phone went black)
  // live data had hired crew on a parked ship (the owner idle a day): the ship is kept out of what browsers are sent, the crew were not
  { const before = errors.length, parkedCrew = Object.values(app.world.state.pool).find((c) => !c.shipId && !c.retired);
    Object.assign(parkedCrew, { shipId: '00000000-0000-4000-8000-0000000000aa', status: 'hired' }); await app.world.commit(); await ready(); await step(6); await shot('ride-earth-after-refresh');
    ok('the server does not send crew of a ship it does not send', !(await page.evaluate((id) => !!cosmos.world.snapshot.pool[id], parkedCrew.id)));
    globalThis.parkedCrewId = parkedCrew.id;
    const alive = await page.evaluate(() => ({ frames: cosmos.engine.frameCount, stage: cosmos.opening.state.stage, active: cosmos.opening.active }));
    ok('a refresh mid-ride comes back to the ride with no page errors', errors.length === before && alive.frames > 2 && alive.stage >= 5, errors.slice(before, before + 2).join(' | ') + ' ' + JSON.stringify(alive)); }
  await step(50); await waitDone(); await step(1);
  const arr = await page.evaluate(() => ({ frame: cosmos.space.frameId, drained: cosmos.world.snapshot.ships[cosmos.world.snapshot.players[cosmos.world.playerId].shipId].drained }));
  ok('the opening ends standing on Earth beside a drained lifeboat', arr.frame === 'earth' && arr.drained, JSON.stringify(arr));
  // people are only drawn once the opening is over (the playtester's page errors began there): with the parked crew still in the server's data, and then one forced into the browser's copy
  { const before = errors.length; await step(3);
    await page.evaluate((id) => { const s = cosmos.world.snapshot; s.pool[id] = { ...(s.pool[id] || Object.values(s.pool)[0]), id, name: 'Orphan', role: 'pilot', status: 'hired', shipId: '00000000-0000-4000-8000-0000000000aa', position: { x: 0, y: 0, z: 0 } }; }, globalThis.parkedCrewId); await step(3);
    ok('crew of a ship that is not in the world are skipped, not drawn (no page errors)', errors.length === before, errors.slice(before, before + 2).join(' | ')); } await step(3); await shot('earth-arrival-complex');
  // the people and the chain
  const pi = makeMoon('earth').padInfo, label = () => page.evaluate(() => document.getElementById('btn-action').style.display !== 'none' ? document.getElementById('btn-action').textContent : '');
  const setStand = async (at) => {
    const p = app.world.state.players[pid], wp = outpostToFrame(pi, at.x, .02, at.z); p.pose.worldPos = wp; p.frameId = 'earth'; await app.world.commit();
    await page.evaluate((w) => { Object.assign(cosmos.walker.worldPos, w); cosmos.walker.velocity = { x: 0, y: 0, z: 0 }; cosmos.walker.updateFrame(); }, wp); await step(2.5);
  };
  await setStand({ x: -50, z: 33.5 }); const okafor = await label(); ok('standing at Okafor offers the power cell', /power cell/.test(okafor), okafor); await shot('earth-okafor');
  await page.keyboard.press('KeyE'); await step(1.5);
  ok('the cell is bought', app.world.state.ships[app.world.state.players[pid].shipId].repair.have.join() === 'cell');
  await setStand({ x: 48, z: -55.5 }); const pruitt = await label(); ok('standing at Pruitt offers the fuel coupler', /fuel coupler/.test(pruitt), pruitt); await shot('earth-pruitt');
  await page.keyboard.press('KeyE'); await step(1.5);
  const sim = app.world.sims.get(app.world.state.players[pid].shipId); { const wp = { ...sim.flight.pos }; app.world.state.players[pid].pose.worldPos = wp; await app.world.commit(); await page.evaluate((w) => { Object.assign(cosmos.walker.worldPos, w); cosmos.walker.updateFrame(); }, wp); await step(2.5); }
  ok('beside the boat the fitting is offered', /Fit the power cell/.test(await label())); await page.keyboard.press('KeyE'); await step(1.5);
  ok('the lifeboat is fitted', app.world.state.ships[app.world.state.players[pid].shipId].drained === false); await shot('earth-fitted');
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
} catch (e) { bad++; console.error(String(e.stack || e)); }
finally { await webkit?.close(); await app?.close(); }
process.exit(bad ? 1 : 0);
