// Look before you build: pictures of a world's ground from a solo dev game, 800 px square. Take one before placing anything
// (layout.js does not list everything that is drawn, and level on paper is not always level on screen).
//   OUT=<folder> node test/look.mjs <world id> "ex,ey,ez,tx,ty,tz;..."     (outpost metres: eye, then target; y up, z south)
//   GY="x,z;x,z" prints the ground height at those points; EVAL="<js>" prints a page expression; SKY=live for the real Sun.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { createServer as netServer } from 'node:net';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
const here = dirname(fileURLToPath(import.meta.url)), root = dirname(here);
let pw; try { pw = createRequire(import.meta.url)('playwright'); } catch { pw = createRequire(process.env.COSMOS_PLAYWRIGHT_ROOT || join(homedir(), '.codex/runtime/unfinished-island/node_modules/'))('playwright'); }
const out = process.env.OUT, id = process.argv[2], cams = process.argv[3].split(';').map((c) => c.split(',').map(Number));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = await new Promise((r) => { const s = netServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const server = spawn(process.execPath, [join(root, 'server.js')], { env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/build.json`)).ok) break; } catch {} await sleep(100); }
let browser;
try {
  browser = await pw.webkit.launch({ headless: true, executablePath: process.env.COSMOS_WEBKIT || join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'webkit-2336', 'Playwright.exe') });
  const ctx = await browser.newContext({ viewport: { width: 800, height: 800 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage(); page.setDefaultTimeout(180000);
  page.on('pageerror', (e) => console.log('PAGEERROR', String(e).slice(0, 300)));
  await page.goto(`http://127.0.0.1:${port}/?dev=1&solo=1&opening=off&tier=low${process.env.SKY ? '&sky=' + process.env.SKY : ''}`, { waitUntil: 'commit', timeout: 240000 });
  await page.waitForFunction(() => window.cosmos && cosmos.engine && cosmos.engine.frameCount >= 2, null, { timeout: 300000 });
  await sleep(2500);
  await page.evaluate((id) => {
    const o2f = (pi, x, y, z) => ({ x: pi.point.x + pi.east.x * x + pi.up.x * y - pi.north.x * z, y: pi.point.y + pi.east.y * x + pi.up.y * y - pi.north.y * z, z: pi.point.z + pi.east.z * x + pi.up.z * y - pi.north.z * z });
    window.__cam = (ex, ey, ez, tx, ty, tz) => { const pi = cosmos.space.activeMoon.body.padInfo; cosmos.freeCam.set(o2f(pi, ex, ey, ez), o2f(pi, tx, ty, tz)); for (let i = 0; i < 40; i++) cosmos.step(1 / 30); };
    window.__gy = (x, z) => { const b = cosmos.space.activeMoon.body, pi = b.padInfo, p = o2f(pi, x, 0, z), l = Math.hypot(p.x, p.y, p.z), R = b.surfaceRadius(p.x / l, p.y / l, p.z / l); return +((p.x / l * R - pi.point.x) * pi.up.x + (p.y / l * R - pi.point.y) * pi.up.y + (p.z / l * R - pi.point.z) * pi.up.z).toFixed(2); };
    const c = cosmos; c.space.trip = null; c.ship.flight.override = null; c.space.debugStand(id); c.ship.aboard = false; for (let i = 0; i < 30; i++) c.step(1 / 30);
  }, id);
  await sleep(4000);
  if (process.env.GY) { const pts = process.env.GY.split(';').map((c) => c.split(',').map(Number)); console.log('GY', JSON.stringify(await page.evaluate((pts) => pts.map(([x, z]) => [x, z, __gy(x, z)]), pts))); }
  if (process.env.EVAL) console.log('EVAL', JSON.stringify(await page.evaluate(process.env.EVAL)));
  let i = 0;
  for (const c of cams) { await page.evaluate((c) => __cam(...c), c); await sleep(900); await page.screenshot({ path: join(out, `${id}-look-${i++}.png`) }); }
} catch (e) { console.log('ERR', String(e && e.stack || e)); }
finally { if (browser) await browser.close().catch(() => {}); server.kill(); }
