// Earth on a phone: iPhone-profile WebKit at the Skyward Launch Complex (?dev=1&body=earth), screenshots from the pad, from the sea wall looking out, and on the way in
// from orbit; plus the checks that need a real renderer (the sea is drawn, the sky is blue, the walker stands). Screenshots go to $EARTH_SHOTS or docs/qa/<date>/earth.
//   node test/earth-browser.mjs [shotName ...]        (no names = all)
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createServer as netServer } from 'node:net';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url)), root = dirname(here);
let pw; try { pw = createRequire(import.meta.url)('playwright'); } catch { pw = createRequire(process.env.COSMOS_PLAYWRIGHT_ROOT || join(homedir(), '.codex/runtime/unfinished-island/node_modules/'))('playwright'); }
const out = process.env.EARTH_SHOTS || join(root, 'docs', 'qa', new Date().toISOString().slice(0, 10), 'earth'); await mkdir(out, { recursive: true });
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const freePort = () => new Promise((r) => { const s = netServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const live = process.env.COSMOS_LIVE_URL || '';
let server, base = live;
if (!live) {
  const port = await freePort();
  server = spawn(process.execPath, [join(root, 'server.js')], { env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/build.json`)).ok) break; } catch {} await sleep(100); }
  base = `http://127.0.0.1:${port}/`;
}
const want = process.argv.slice(2);
const errors = [];
let browser, bad = 0;
const ok = (name, pass, detail = '') => { if (!pass) bad++; console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass ? '' : '  ' + detail)); };
try {
  browser = await pw.webkit.launch({ headless: true, executablePath: process.env.COSMOS_WEBKIT || join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'webkit-2336', 'Playwright.exe') });
  const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage(); page.setDefaultTimeout(240000);
  page.on('pageerror', (e) => { errors.push(String(e)); console.log('PAGEERROR', String(e).slice(0, 300)); });
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) console.log('CONSOLE', m.text().slice(0, 300)); });
  const utcH = Number(process.env.EARTH_UTC_HOUR || 16), nowH = new Date().getUTCHours() + new Date().getUTCMinutes() / 60, shift = Math.round(((utcH - nowH + 24) % 24) * 3600);
  await page.goto(`${base}?dev=1&solo=1&opening=off&tier=low&body=earth&sky=live&skyshift=${shift}`, { waitUntil: 'commit', timeout: 240000 });
  await page.waitForFunction(() => window.cosmos && cosmos.engine && cosmos.engine.frameCount >= 2, null, { timeout: 300000 });
  await sleep(3000);
  await page.evaluate(() => {
    const o2f = (pi, x, y, z) => ({ x: pi.point.x + pi.east.x * x + pi.up.x * y - pi.north.x * z, y: pi.point.y + pi.east.y * x + pi.up.y * y - pi.north.y * z, z: pi.point.z + pi.east.z * x + pi.up.z * y - pi.north.z * z });
    const body = () => cosmos.space.activeMoon.body;
    window.__cam = (ex, ey, ez, tx, ty, tz, steps = 40) => { const pi = body().padInfo; cosmos.freeCam.set(o2f(pi, ex, ey, ez), o2f(pi, tx, ty, tz)); for (let i = 0; i < steps; i++) cosmos.step(1 / 30); };
    window.__eye = (x, z, bearing, pitch = 0) => { cosmos.freeCam.off(); const w = cosmos.walker, b = body(), pi = b.padInfo, p = o2f(pi, x, 0, z), l = Math.hypot(p.x, p.y, p.z), R = b.surfaceRadius(p.x / l, p.y / l, p.z / l) + 0.05; Object.assign(w.worldPos, { x: p.x / l * R, y: p.y / l * R, z: p.z / l * R }); w.velocity = { x: 0, y: 0, z: 0 }; w.updateFrame(); cosmos.space.activeMoon.force(w.worldPos); for (let i = 0; i < 90; i++) w.tick(1 / 60, {}); w.yaw = bearing * Math.PI / 180; w.pitch = pitch * Math.PI / 180; for (let i = 0; i < 30; i++) cosmos.step(1 / 30); };
    // a camera `up` metres over the pad's plumb line then `back` metres toward bearing (0 north, 90 east), looking at the horizon or a point
    window.__cam2 = (eastM, northM, upM, tx, ty, tz, steps = 40) => { const pi = body().padInfo; cosmos.freeCam.set(o2f(pi, eastM, upM, -northM), o2f(pi, tx, ty, -tz)); for (let i = 0; i < steps; i++) cosmos.step(1 / 30); };
  });
  const standOk = await page.evaluate(() => { const c = cosmos; c.space.debugStand('earth'); c.ship.aboard = false; for (let i = 0; i < 40; i++) c.step(1 / 30); return { id: c.space.frameId, grounded: !!c.walker.grounded }; });
  ok('?body=earth stands the walker on Earth', standOk.id === 'earth' && standOk.grounded, JSON.stringify(standOk));
  console.log('sun', JSON.stringify(await page.evaluate(() => { const c = cosmos, pi = c.space.activeMoon.body.padInfo, s = c.space.sunLocal; return { elevDeg: +(Math.asin(s.x * pi.up.x + s.y * pi.up.y + s.z * pi.up.z) * 180 / Math.PI).toFixed(1), skyState: c.space.sky.state }; })));
  await sleep(2500);
  const shots = {
    // from the pad: east to the sea, north to the hall and the tower, west to the assembly hall
    'ground-east-sea': () => page.evaluate(() => __eye(60, 46, 80, 3)),
    'ground-north-complex': () => page.evaluate(() => __eye(-10, 58, 8, 7)),
    'ground-west-vab': () => page.evaluate(() => __eye(-60, 40, 285, 9)),
    'ground-toward-tower': () => page.evaluate(() => __eye(60, -88, 55, 10)),
    'ground-pad-view': () => page.evaluate(() => __eye(-40, 52, 40, 4)),
    // the ground itself: grass and scrub south of the complex, wide and up close, and the beach sand
    'ground-grass-wide': () => page.evaluate(() => __eye(-150, 235, 200, 2)),
    'ground-grass-close': () => page.evaluate(() => __eye(-150, 235, 200, -38)),
    'ground-sand-close': () => page.evaluate(() => __eye(655, -10, 95, -34)),
    // looking out to sea from the shore, a kilometre east of the pad
    'shore-looking-out': () => page.evaluate(() => __eye(690, -10, 95, 1)),
    'shore-along-coast': () => page.evaluate(() => __eye(660, 0, 350, 3)),
    // the whole complex from the air
    'air-complex': () => page.evaluate(() => __cam2(-120, -420, 140, 20, 14, -170)),
    'air-pad-from-sea': () => page.evaluate(() => __cam2(1000, -30, 70, 0, 20, 0)),
    'air-coast': () => page.evaluate(() => __cam2(2500, -9000, 3500, 400, 0, 3000)),
    // approach: 6 km, 60 km, 400 km, and from far out
    'approach-6km': () => page.evaluate(() => __cam2(-3000, -9000, 6000, 300, 0, 300, 90)),
    'approach-60km': () => page.evaluate(() => __cam2(-70000, -90000, 60000, 0, 0, 0, 120)),
    'approach-400km': () => page.evaluate(() => __cam2(-300000, 80000, 400000, 0, 0, 0, 120)),
    'orbit-3000km': () => page.evaluate(() => __cam2(-1.0e6, 0, 9.0e6, 0, 0, 0, 120)),
    'orbit-far': () => page.evaluate(() => __cam2(-2.0e7, 0, 3.0e7, 0, 0, 0, 120)),
  };
  if (process.env.EARTH_DEBUG) console.log('debug', JSON.stringify(await page.evaluate((js) => { try { return (0, eval)(js); } catch (e) { return String(e); } }, process.env.EARTH_DEBUG)));
  for (const [name, setup] of Object.entries(shots)) {
    if (want.length && !want.includes(name)) continue;
    await setup(); await sleep(1800);
    await page.screenshot({ path: join(out, name + '.png') });
    console.log('shot', name);
  }
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
} finally { if (browser) await browser.close(); if (server) server.kill(); }
process.exit(bad ? 1 : 0);
