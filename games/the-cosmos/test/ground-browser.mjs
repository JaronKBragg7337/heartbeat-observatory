// ROUND7 ground detail in a real iPhone-profile WebKit page (solo world, phone tier): pebbles are placed on the ground and kept off the port, boot prints
// appear when you walk and stay, contact blobs sit under people, and the whole thing costs at most 3 draw calls and a fraction of a millisecond.
//   node test/ground-browser.mjs
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createServer as netServer } from 'node:net';
import assert from 'node:assert/strict';
let pw; try { pw = createRequire(import.meta.url)('playwright'); } catch { pw = createRequire(process.env.COSMOS_PLAYWRIGHT_ROOT || join(homedir(), '.codex/runtime/unfinished-island/node_modules/'))('playwright'); }
const root = dirname(dirname(fileURLToPath(import.meta.url))), out = join(root, 'docs', 'qa', '2026-10-03', 'round7'); await mkdir(out, { recursive: true });
const port = await new Promise(r => { const s = netServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const srv = spawn(process.execPath, [join(root, 'server.js')], { env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
for (let i = 0; i < 50; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/build.json`)).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const results = {}; let browser;
try {
  browser = await pw.webkit.launch({ headless: true, executablePath: process.env.COSMOS_WEBKIT || join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'webkit-2336', 'Playwright.exe') });
  const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage(), errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${port}/?dev=1&solo=1&opening=off&tier=low`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.cosmos?.groundDetail && cosmos.engine.frameCount > 10, null, { timeout: 180000 });
  await page.evaluate(() => { cosmos.engine.stop(); });
  const step = (n) => page.evaluate((n) => { for (let i = 0; i < n; i++) cosmos.step(1 / 30); }, n);
  const stand = (x, z) => page.evaluate(([x, z]) => { const c = cosmos, w = c.walker, p = c.port.site.toWorld(x, 0.3, z); c.ship.aboard = false; w.worldPos.x = p.x; w.worldPos.y = p.y; w.worldPos.z = p.z; w.velocity = { x: 0, y: 0, z: 0 }; w.yaw = 0.6; w.pitch = -0.3; }, [x, z]);

  // 1. out on open ground (west of the port's graded apron): stones appear, on the ground, and keep appearing as you walk
  await stand(200, 250); await step(90);
  const a = await page.evaluate(() => { const g = cosmos.groundDetail; return { n: g.slots.size, frame: g.frame, vis: g.group.visible, need: g.need.length }; });
  results.openGround = a; assert.ok(a.n > 60 && a.vis && a.frame === 'mars', 'stones on open ground: ' + JSON.stringify(a));
  // every stone sits on the ground the walker would stand on (within 6 cm of its own sunk depth)
  const off = await page.evaluate(() => { const g = cosmos.groundDetail, w = cosmos.walker; let worst = 0; for (const s of g.slots.values()) { const i = s.slot, x = g.pd.pos[i * 3], y = g.pd.pos[i * 3 + 1], z = g.pd.pos[i * 3 + 2], r = Math.hypot(x, y, z), gr = w.groundSampler(x / r, y / r, z / r, r); worst = Math.max(worst, Math.abs((gr - r) - g.pd.size[i] * 0.2)); } return worst; });
  results.worstStoneOffsetM = off; assert.ok(off < 0.06, `a stone floats or sinks by ${off} m`);
  // 2. the same stones are there when you come back (a fixed lattice, not random each time)
  const keys1 = await page.evaluate(() => [...cosmos.groundDetail.slots.keys()].sort().join('|'));
  await stand(200, 320); await step(90); await stand(200, 250); await step(90);
  const keys2 = await page.evaluate(() => [...cosmos.groundDetail.slots.keys()].sort().join('|'));
  assert.equal(keys1, keys2, 'the stones changed after walking away and back'); results.stonesStable = true;
  // 3. none on the port (concrete, apron, the pads)
  await stand(30, 30); await step(90);
  const onPort = await page.evaluate(() => { const g = cosmos.groundDetail, s = cosmos.port.site; let bad = 0; for (const v of g.slots.values()) { const i = v.slot, l = s.toLocal({ x: g.pd.pos[i * 3], y: g.pd.pos[i * 3 + 1], z: g.pd.pos[i * 3 + 2] }); if (Math.abs(l.x) < 103 && Math.abs(l.z) < 100) bad++; } return { bad, n: g.slots.size }; });
  results.onPort = onPort; assert.equal(onPort.bad, 0, 'stones on the port concrete');
  // 4. walking leaves prints, and they stay
  await stand(200, 250); await step(60);
  const p0 = await page.evaluate(() => cosmos.groundDetail.printHead);
  await page.keyboard.down('KeyW'); await step(150); await page.keyboard.up('KeyW');
  const p1 = await page.evaluate(() => cosmos.groundDetail.printHead);
  results.prints = [p0, p1]; assert.ok(p1 - p0 >= 4, `walking 150 frames left ${p1 - p0} prints`);
  await step(300); assert.equal(await page.evaluate(() => cosmos.groundDetail.printHead), p1, 'prints appeared or vanished while standing still');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('cosmos-prints-v1') || '{}').mars?.length || 0);
  results.printsSaved = saved; assert.ok(saved >= p1 - p0, 'prints are not saved on this device');
  // 5. cost: draw calls and CPU
  const calls = await page.evaluate(() => { const r = cosmos.engine.renderer, g = cosmos.groundDetail; g.group.visible = true; r.render(cosmos.engine.scene, cosmos.engine.camera); const on = r.info.render.calls; g.group.visible = false; r.render(cosmos.engine.scene, cosmos.engine.camera); const off = r.info.render.calls; g.group.visible = true; return { on, off }; });
  results.drawCalls = calls; assert.ok(calls.on - calls.off <= 3, 'ground detail costs ' + (calls.on - calls.off) + ' draw calls');
  const ms = await page.evaluate(() => { const g = cosmos.groundDetail, t = performance.now(); for (let i = 0; i < 200; i++) g.update(1 / 30, 0); return (performance.now() - t) / 200; });
  results.updateMs = ms; assert.ok(ms < 1.5, `update costs ${ms.toFixed(2)} ms a frame`);
  const tris = await page.evaluate(() => cosmos.groundDetail.pebbles.geometry.index ? cosmos.groundDetail.pebbles.geometry.index.count / 3 * cosmos.groundDetail.cap : cosmos.groundDetail.pebbles.geometry.attributes.position.count / 3 * cosmos.groundDetail.cap);
  results.pebbleTriangles = tris; assert.ok(tris < 6000, 'too many pebble triangles ' + tris);
  // 6. a contact blob under the port workers near you, and under you in third person
  await stand(-60, 52); await page.evaluate(() => { cosmos.view.mode = 'third'; }); await step(30);
  const blobs = await page.evaluate(() => cosmos.groundDetail.blobs.count); results.blobsNearPeople = blobs; assert.ok(blobs >= 2, 'no contact shadows near people: ' + blobs);
  await page.screenshot({ path: join(out, 'ground-browser-iphone.png') });
  // 5b. the same on Phobos (a different frame: the group must ride the active frame, or nothing is drawn there)
  await page.evaluate(() => { const c = cosmos; c.space.debugLand('phobos'); for (let i = 0; i < 20; i++) c.step(1 / 30); const mw = c.space.worlds.get('phobos'), b = mw.body, pi = b.padInfo, w = c.walker; c.ship.aboard = false; if (c.ship.seat) c.ship.stations.stand(); c.freeCam.off();
    const x = pi.point.x + pi.east.x * 60 + pi.north.x * -40, y = pi.point.y + pi.east.y * 60 + pi.north.y * -40, z = pi.point.z + pi.east.z * 60 + pi.north.z * -40, l = Math.hypot(x, y, z), R = b.surfaceRadius(x / l, y / l, z / l);
    w.worldPos.x = x / l * (R + 0.03); w.worldPos.y = y / l * (R + 0.03); w.worldPos.z = z / l * (R + 0.03); w.velocity = { x: 0, y: 0, z: 0 }; w.grounded = true; mw.force(w.worldPos); });
  await step(90); await page.keyboard.down('KeyW'); await step(120); await page.keyboard.up('KeyW');
  const moon = await page.evaluate(() => { const g = cosmos.groundDetail; return { frame: g.frame, stones: g.slots.size, prints: g.printHead, followActive: g.anchorEntry.followActive }; });
  results.phobos = moon; assert.ok(moon.frame === 'phobos' && moon.stones > 40 && moon.prints >= 3 && moon.followActive, 'ground detail on Phobos: ' + JSON.stringify(moon));
  await page.screenshot({ path: join(out, 'ground-browser-phobos-iphone.png') });
  assert.deepEqual(errors, [], 'page errors');
  await writeFile(join(out, 'ground-browser-results.json'), JSON.stringify(results, null, 1)); console.log('PASS ground detail', JSON.stringify(results));
} catch (e) { console.error('FAIL', e.message, JSON.stringify(results)); process.exitCode = 1; }
finally { try { await browser?.close(); } catch {} srv.kill(); setTimeout(() => process.exit(process.exitCode || 0), 300); }
