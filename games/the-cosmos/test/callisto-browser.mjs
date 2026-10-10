// Callisto on a phone: real iPhone-profile WebKit at the Valhalla Camp (solo game, the same client code the shared world runs):
// the camp builds with all its people, Jupiter hangs in the sky with its picture, the Archive and the Standing Array stand,
// a person talks by a real tap, the prospectors' camp sits a kilometre north, the sealed site and the dead relay stand on the
// open ground, and the nav computer lists the course to Callisto. Screenshots go to docs/qa/<today>/callisto/.
//   node test/callisto-browser.mjs
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createServer as netServer } from 'node:net';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url)), root = dirname(here);
let pw; try { pw = createRequire(import.meta.url)('playwright'); } catch { pw = createRequire(process.env.COSMOS_PLAYWRIGHT_ROOT || join(homedir(), '.codex/runtime/unfinished-island/node_modules/'))('playwright'); }
const out = join(root, 'docs', 'qa', new Date().toISOString().slice(0, 10), 'callisto'); await mkdir(out, { recursive: true });
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const freePort = () => new Promise((r) => { const s = netServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const port = await freePort();
const server = spawn(process.execPath, [join(root, 'server.js')], { env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/build.json`)).ok) break; } catch {} await sleep(100); }
const results = [], errors = [];
const ok = (name, pass, detail = '') => { results.push({ name, pass, detail }); console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass ? '' : '  ' + detail)); };
let browser;
try {
  browser = await pw.webkit.launch({ headless: true, executablePath: process.env.COSMOS_WEBKIT || join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'webkit-2336', 'Playwright.exe') });
  const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage(); page.setDefaultTimeout(240000);
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) console.log('CONSOLE', m.text().slice(0, 300)); });
  await page.goto(`http://127.0.0.1:${port}/?dev=1&solo=1&opening=off&tier=low&depth=16&body=callisto`, { waitUntil: 'commit', timeout: 240000 });
  await page.waitForFunction(() => window.cosmos && cosmos.engine && cosmos.engine.frameCount >= 2, null, { timeout: 300000 });
  await sleep(2500);
  const tap = async (sel, textRe) => {
    const r = await page.evaluate(([sel, re]) => { const els = [...document.querySelectorAll(sel)].filter((e) => !re || new RegExp(re).test(e.textContent)); const e = els[0]; if (!e) return null; e.scrollIntoView({ block: 'center' }); const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2, disabled: !!e.disabled }; }, [sel, textRe ? textRe.source : null]);
    if (!r || r.disabled) return false;
    await page.touchscreen.tap(r.x, r.y); return true;
  };
  await page.evaluate(() => {
    const o2f = (pi, x, y, z) => ({ x: pi.point.x + pi.east.x * x + pi.up.x * y - pi.north.x * z, y: pi.point.y + pi.east.y * x + pi.up.y * y - pi.north.y * z, z: pi.point.z + pi.east.z * x + pi.up.z * y - pi.north.z * z });
    window.__cam = (ex, ey, ez, tx, ty, tz) => { const pi = cosmos.space.activeMoon.body.padInfo; cosmos.freeCam.set(o2f(pi, ex, ey, ez), o2f(pi, tx, ty, tz)); for (let i = 0; i < 40; i++) cosmos.step(1 / 30); };
    window.__eye = (x, z, bearing, pitch = 0) => { cosmos.freeCam.off(); const w = cosmos.walker, b = cosmos.space.activeMoon.body, pi = b.padInfo, p = o2f(pi, x, 0, z), l = Math.hypot(p.x, p.y, p.z), R = b.surfaceRadius(p.x / l, p.y / l, p.z / l) + 0.05; Object.assign(w.worldPos, { x: p.x / l * R, y: p.y / l * R, z: p.z / l * R }); w.velocity = { x: 0, y: 0, z: 0 }; w.updateFrame(); cosmos.space.activeMoon.force(w.worldPos); for (let i = 0; i < 90; i++) w.tick(1 / 60, {}); w.yaw = bearing * Math.PI / 180; w.pitch = pitch * Math.PI / 180; for (let i = 0; i < 30; i++) cosmos.step(1 / 30); };
  });

  // ---- the camp on the ground: the world is built, the people stand in it
  const want = await page.evaluate(async () => (await import('./src/worlds/callisto/cast.js')).CALISTO_CAST.length);
  await page.waitForFunction((n) => { const w = cosmos.space.worlds.get('callisto'); return w && w.client && w.client.people && w.client.people.members.length === n && w.client.people.members.every((m) => m.person.loaded !== false); }, want, { timeout: 240000 }).catch(() => {});
  const people = await page.evaluate(() => { const w = cosmos.space.worlds.get('callisto'); return w && w.client && w.client.people ? w.client.people.members.length : 0; });
  ok('the Valhalla Camp is built with all its people standing in it', people === want && people === 5, `${people}/${want}`);
  await page.evaluate(() => __eye(30, 44, 20, 3)); await sleep(1800);
  await page.screenshot({ path: join(out, 'phone-camp-pad.png') });
  await page.evaluate(() => __cam(95, 26, 105, -10, 3, -40)); await sleep(1500);
  await page.screenshot({ path: join(out, 'phone-camp.png') });
  await page.evaluate(() => __cam(-120, 18, 95, -55, 5, 25)); await sleep(1200);
  await page.screenshot({ path: join(out, 'phone-array-dishes.png') });

  // ---- Jupiter in the sky, huge and banded: aim the free camera straight at the mesh (bearing read from the ephemeris)
  await page.evaluate(() => {
    const m = cosmos.space.activeMoon.client.jupiter.mesh, pi = cosmos.space.activeMoon.body.padInfo;
    const L = Math.hypot(m.position.x, m.position.y, m.position.z), d = { x: m.position.x / L, y: m.position.y / L, z: m.position.z / L };
    const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
    const el = dot(d, pi.up), e = dot(d, pi.east), n = dot(d, pi.north);
    const o2f = (pi, x, y, z) => ({ x: pi.point.x + pi.east.x * x + pi.up.x * y - pi.north.x * z, y: pi.point.y + pi.east.y * x + pi.up.y * y - pi.north.y * z, z: pi.point.z + pi.east.z * x + pi.up.z * y - pi.north.z * z });
    cosmos.freeCam.set(o2f(pi, -40, 6, -30), o2f(pi, e * 300, el * 300, -n * 300));
    for (let i = 0; i < 50; i++) cosmos.step(1 / 30);
  });
  await sleep(1800);
  const jup = await page.evaluate(() => { const c = cosmos.space.activeMoon.client; if (!c || !c.jupiter) return { missing: true }; const e = c.jupiter.mesh; const pi = cosmos.space.activeMoon.body.padInfo; const l = e.position.length(); const s = e.material.uniforms.uSun.value; const dl = (e.position.x * s.x + e.position.y * s.y + e.position.z * s.z) / l; return { vis: e.visible, tex: !!e.material.uniforms.uMap.value, elev: (e.position.x * pi.up.x + e.position.y * pi.up.y + e.position.z * pi.up.z) / l, sunDot: dl }; });
  ok('Jupiter is in Callisto\'s sky with its picture, well up over the camp (the dev checks\' fixed sun may show it in a slimmer phase; the live sky lights it)', jup.vis && jup.tex && jup.elev > 0.35 && jup.elev < 0.6, JSON.stringify(jup));
  await page.screenshot({ path: join(out, 'phone-jupiter.png') });

  // ---- the Archive door, the array stones and the glyph light
  await page.evaluate(() => __eye(-8, -66, 180, 6)); await sleep(1500);
  await page.screenshot({ path: join(out, 'phone-archive.png') });
  const kit = await page.evaluate(() => { const c = cosmos.space.worlds.get('callisto').client; return !!(c && c.camp && c.camp.root && c.camp.portRoot); });
  ok('the camp and the prospectors\' camp are built (two tracked roots)', kit === true);
  await page.evaluate(() => __eye(-54, 72, 355, 4)); await sleep(1200);
  await page.screenshot({ path: join(out, 'phone-array.png') });

  // ---- a person talks by a real tap
  const stand = (id, dx, dz) => page.evaluate(async ([id, dx, dz]) => {
    const m = cosmos.space.activeMoon.client.people.members.find((q) => q.id === id); __eye(m.x + dx, m.z + dz, (Math.atan2(-dx, dz) * 180 / Math.PI + 360) % 360 + 0, 2);
    for (let i = 0; i < 30; i++) cosmos.step(1 / 30); return { name: m.name };
  }, [id, dx, dz]);
  await stand('c-director', 0, 2.6); await sleep(600);
  const talk = await page.waitForFunction(() => getComputedStyle(document.getElementById('crew-talk')).display !== 'none', null, { timeout: 15000 }).then(() => true, () => false);
  ok('standing near the Director, the Talk button shows her name', talk && (await page.evaluate(() => document.getElementById('crew-talk').textContent)).includes('Sorn'));
  await tap('#crew-talk'); await sleep(500);
  ok('a real tap opens her panel, inside the screen, and she says her line', await page.evaluate(() => { const p = document.getElementById('crew-panel'), r = p.getBoundingClientRect(); return cosmos.crewUI.open && /Sorn/.test(p.textContent) && /measure with/.test(p.textContent) && r.left >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 && r.top >= 0; }));
  await page.screenshot({ path: join(out, 'phone-talk-director.png') });
  await tap('#crew-panel button', /listening to/); await sleep(400);
  ok('her answer shows (and is spoken from her body)', await page.evaluate(() => /Europa/.test(document.getElementById('crew-panel').textContent)));
  await page.screenshot({ path: join(out, 'phone-talk-answer.png') });
  await page.evaluate(() => cosmos.crewUI.close());

  // ---- the prospectors' camp, a kilometre north (the open seat)
  await page.evaluate(() => __cam(14, 7, -1162, 0, 3, -1204)); await sleep(1800);
  await page.screenshot({ path: join(out, 'phone-prospectors.png') });
  const prosp = await page.evaluate(() => { const w = cosmos.space.worlds.get('callisto').client; const m = w.people.members.find((q) => q.id === 'c-prospector'); return m ? { x: m.x, z: m.z, built: w.camp.people.built, port: !!w.camp.portRoot } : null; });
  ok('the prospectors\' camp stands at the port with Bram in it', prosp && prosp.port && Math.abs(prosp.z + 1200) < 40, JSON.stringify(prosp));

  // ---- the sealed site and the dead relay on the open ground
  await page.evaluate(() => __eye(318, 588, 160, 4)); await sleep(2000);
  await page.screenshot({ path: join(out, 'phone-sealed-site.png') });
  await page.evaluate(() => __eye(585, -452, 42, 10)); await sleep(2000);
  await page.screenshot({ path: join(out, 'phone-relay.png') });

  // ---- the nav computer lists the course home and the ground is honest
  const rows = await page.evaluate(() => { cosmos.ship.aboard = true; const d = cosmos.space.destinations(); const get = (id) => d.find((x) => x.id === id); return { port: get('port'), cal: get('callisto') }; });
  ok('the nav computer lists Marineris Port as the way home, and Callisto: Valhalla Camp as a drive world', rows.port && !rows.port.disabled && rows.cal && /Valhalla Camp/.test(rows.cal.name), JSON.stringify({ port: rows.port && rows.port.name, cal: rows.cal && rows.cal.name }));
  await page.evaluate(() => { cosmos.ship.aboard = false; });
  const g = await page.evaluate(() => cosmos.space.activeMoon.body.surfaceGravity);
  ok('the ground game runs on Callisto\'s gravity (1.236 m/s2)', Math.abs(g - 1.236) < 0.01, String(g));
  ok('no page errors', errors.length === 0, errors.join(' | '));
} catch (e) { console.error(e); ok('the scenario ran to the end', false, String(e)); }
finally { try { await browser?.close(); } catch {} try { server.kill(); } catch {} }
const failed = results.filter((r) => !r.pass);
console.log(failed.length ? `FAILED ${failed.length}/${results.length}` : `PASSED ${results.length}/${results.length}`);
setTimeout(() => process.exit(failed.length ? 1 : 0), 500);
