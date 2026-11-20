// The sides at work, on a phone: a solo game on an iPhone-profile WebKit at 375 px, standing at each home that has a yard (worlds/_kit/sideYard.js).
// At each one: the yard builds when the player is near, the ground under it is level, the side's ship flies its timetable (seen on approach, landed
// with her ramp down, and gone), the stock moves with the ship, the hands are out, the board is drawn, and there are no page errors.
// Pictures go to YARD_SHOTS (default: shots/ in the build folder is NOT used; a temp folder is).
//   node test/yards-browser.mjs            (ONLY=moon-shackleton to do one)
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createServer as netServer } from 'node:net';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir, tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url)), root = dirname(here);
let pw; try { pw = createRequire(import.meta.url)('playwright'); } catch { pw = createRequire(process.env.COSMOS_PLAYWRIGHT_ROOT || join(homedir(), '.codex/runtime/unfinished-island/node_modules/'))('playwright'); }
const out = process.env.YARD_SHOTS || join(tmpdir(), 'cosmos-yards'); await mkdir(out, { recursive: true });
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const freePort = () => new Promise((r) => { const s = netServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const port = await freePort();
const server = spawn(process.execPath, [join(root, 'server.js')], { env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/build.json`)).ok) break; } catch {} await sleep(100); }
const results = [], errors = [];
const ok = (name, pass, detail = '') => { results.push({ name, pass, detail }); console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass ? '' : '  ' + detail)); };

/** Each home: where its yard hangs off the world's client, the side, and where to look from (outpost metres: eye, then target). */
const SITES = [
  { id: 'moon-shackleton', yard: 'yard', side: 'fortis', cam: [-2, 16, 34, -28, 2, 72], wide: [10, 60, 20, -26, 0, 72], walk: [-12, 60, 290] },
  { id: 'moon-daedalus', yard: 'yard', side: 'technos', cam: [-20, 14, 18, -42, 2, 50], wide: [-6, 60, 0, -42, 0, 48], walk: [-28, 44, 250] },
].filter((s) => !process.env.ONLY || process.env.ONLY === s.id);

let browser;
try {
  browser = await pw.webkit.launch({ headless: true, executablePath: process.env.COSMOS_WEBKIT || join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'webkit-2336', 'Playwright.exe') });
  const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage(); page.setDefaultTimeout(180000);
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) { console.log('CONSOLE', m.text().slice(0, 300)); if (/yard/i.test(m.text())) errors.push(m.text()); } });
  await page.goto(`http://127.0.0.1:${port}/?dev=1&solo=1&opening=off&tier=low${process.env.SKY ? '&sky=' + process.env.SKY : ''}${process.env.DEPTH ? '&depth=' + process.env.DEPTH : ''}`, { waitUntil: 'commit', timeout: 240000 });
  await page.waitForFunction(() => window.cosmos && cosmos.engine && cosmos.engine.frameCount >= 2, null, { timeout: 300000 });
  await sleep(2500);
  await page.evaluate(() => {
    const o2f = (pi, x, y, z) => ({ x: pi.point.x + pi.east.x * x + pi.up.x * y - pi.north.x * z, y: pi.point.y + pi.east.y * x + pi.up.y * y - pi.north.y * z, z: pi.point.z + pi.east.z * x + pi.up.z * y - pi.north.z * z });
    window.__cam = (ex, ey, ez, tx, ty, tz) => { const pi = cosmos.space.activeMoon.body.padInfo; cosmos.freeCam.set(o2f(pi, ex, ey, ez), o2f(pi, tx, ty, tz)); for (let i = 0; i < 40; i++) cosmos.step(1 / 30); };
    window.__eye = (x, z, bearing, pitch = 0) => { cosmos.freeCam.off(); const w = cosmos.walker, b = cosmos.space.activeMoon.body, pi = b.padInfo, p = o2f(pi, x, 0, z), l = Math.hypot(p.x, p.y, p.z), R = b.surfaceRadius(p.x / l, p.y / l, p.z / l) + 0.05;
      Object.assign(w.worldPos, { x: p.x / l * R, y: p.y / l * R, z: p.z / l * R }); Object.assign(w.velocity, { x: 0, y: 0, z: 0 }); w.updateFrame();
      if (cosmos.look) { cosmos.look.yaw = -bearing * Math.PI / 180; cosmos.look.pitch = pitch * Math.PI / 180; }
      for (let i = 0; i < 40; i++) cosmos.step(1 / 30); };
  });
  for (const S of SITES) {
    await page.evaluate((id) => { const c = cosmos; c.space.trip = null; c.ship.flight.override = null; c.space.debugStand(id); c.ship.aboard = false; for (let i = 0; i < 30; i++) c.step(1 / 30); }, S.id);
    await page.waitForFunction(([id, y]) => { const w = cosmos.space.worlds.get(id); return w && w.client && w.client[y] && w.client[y].built; }, [S.id, S.yard], { timeout: 120000 }).catch(() => {});
    const Y = `cosmos.space.worlds.get('${S.id}').client.${S.yard}`;
    const st0 = await page.evaluate(`(() => { const y = ${Y}; return y ? y.status() : null; })()`);
    ok(`${S.id}: the yard is built when the player stands at the pad`, !!st0 && st0.built && st0.active, JSON.stringify(st0 && { built: st0.built, active: st0.active }));
    if (!st0) continue;
    // the ground under the stand and the stock: level with the pad's plane (within a hand's width), or the yard would float or sink
    const gy = await page.evaluate(`(() => { const y = ${Y}, s = y.cfg.sides[0].spot, o = []; y.body.surfaceRadius; for (const dx of [-8, 0, 8]) for (const dz of [-16, 0, 18, 36]) o.push(+y.groundY(s.x + dx, s.z + dz).toFixed(2)); return o; })()`);
    ok(`${S.id}: the ground under the yard is level (worst ${Math.max(...gy.map(Math.abs))} m)`, gy.every((v) => Math.abs(v) < 0.35), JSON.stringify(gy));
    // the ship: on her way in, then down with the ramp open, then gone
    await page.evaluate(`(() => { ${Y}.jumpTo('${S.side}', 'braking', 0.7); for (let i = 0; i < 20; i++) cosmos.step(1 / 30); })()`);
    const a = await page.evaluate(`${Y}.status()`);
    ok(`${S.id}: the side's ship is seen coming in (${a.ships[0] && a.ships[0].registry})`, a.ships.length === 1 && a.ships[0].phase === 'braking' && a.ships[0].shown && a.ships[0].alt > 20, JSON.stringify(a.ships));
    await page.evaluate((c) => __cam(...c), S.wide); await sleep(600);
    await page.screenshot({ path: join(out, `${S.id}-1-approach.png`) });
    await page.evaluate(`(() => { ${Y}.jumpTo('${S.side}', 'landed', 0.55); for (let i = 0; i < 30; i++) cosmos.step(1 / 30); })()`);
    await page.waitForFunction(`${Y}.hands.length >= 3`, null, { timeout: 60000 }).catch(() => {});
    await page.evaluate(() => { for (let i = 0; i < 30; i++) cosmos.step(1 / 30); });
    const b = await page.evaluate(`${Y}.status()`);
    ok(`${S.id}: she is down on her stand with the ramp open`, b.ships.length === 1 && b.ships[0].phase === 'landed' && b.ships[0].ramp > 0.9 && Math.abs(b.ships[0].alt) < 0.2, JSON.stringify(b.ships));
    ok(`${S.id}: the hands are out (${b.hands.length})`, b.hands.length >= 3 && b.hands.some((h) => h.shown), JSON.stringify(b.hands));
    ok(`${S.id}: the board is drawn`, b.board.draws >= 1, JSON.stringify(b.board));
    await page.evaluate((c) => __cam(...c), S.cam); await sleep(900);
    await page.screenshot({ path: join(out, `${S.id}-2-landed.png`) });
    await page.evaluate((c) => __cam(...c), S.wide); await sleep(600);
    await page.screenshot({ path: join(out, `${S.id}-3-landed-wide.png`) });
    await page.evaluate((c) => __eye(...c), S.walk); await sleep(900);
    await page.screenshot({ path: join(out, `${S.id}-4-on-foot.png`) });
    // the stock moves with the ship: read it at the start and the end of her stay
    const lv = await page.evaluate(`(() => { const y = ${Y}; y.jumpTo('${S.side}', 'landed', 0.12); cosmos.step(1 / 30); const n0 = y.status().stocks[0]; y.jumpTo('${S.side}', 'landed', 0.92); cosmos.step(1 / 30); const n1 = y.status().stocks[0]; return [n0, n1, y.cfg.sides[0].stock.mode]; })()`);
    ok(`${S.id}: the stock moves with the ship (${lv[2]}: ${lv[0]} -> ${lv[1]})`, lv[2] === 'bring' ? lv[1] > lv[0] : lv[1] < lv[0], JSON.stringify(lv));
    await page.evaluate(`(() => { ${Y}.jumpTo('${S.side}', 'departing', 0.99); ${Y}.shift(30); for (let i = 0; i < 10; i++) cosmos.step(1 / 30); })()`);
    const c = await page.evaluate(`${Y}.status()`);
    ok(`${S.id}: between visits the stand is empty`, c.ships.length === 0, JSON.stringify(c.ships));
    const cost = await page.evaluate(`(() => { const y = ${Y}; let meshes = 0; y.root.traverse((m) => { if (m.isMesh && m.visible) meshes++; }); return { meshes, ms: y.buildMs }; })()`);
    console.log(`     ${S.id}: ${cost.meshes} meshes, built in ${Math.round(cost.ms.place)} ms, ship ${Math.round(cost.ms.ships)} ms`);
    const wide = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    ok(`${S.id}: no sideways scroll at 375 px`, wide);
  }
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
} catch (e) { ok('the run finished', false, String(e && e.stack || e)); }
finally { if (browser) await browser.close().catch(() => {}); server.kill(); }
const bad = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - bad}/${results.length} passed. Pictures: ${out}`);
process.exit(bad ? 1 : 0);
