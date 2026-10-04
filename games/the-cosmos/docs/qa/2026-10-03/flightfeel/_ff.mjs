// Shared harness for the FLIGHTFEEL browser checks: a local server, an iPhone-profile WebKit page (real touch) or a desktop Chromium page, the pilot's seat.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { createServer as netServer } from 'node:net';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { mkdirSync } from 'node:fs';

export const here = dirname(fileURLToPath(import.meta.url));
export const root = join(here, '..', '..', '..', '..');
let pw; try { pw = createRequire(import.meta.url)('playwright'); } catch { pw = createRequire(process.env.COSMOS_PLAYWRIGHT_ROOT || join(homedir(), '.codex/runtime/unfinished-island/node_modules/'))('playwright'); }
const lad = process.env.LOCALAPPDATA || '';
const freePort = () => new Promise((r) => { const s = netServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function startLocal() {
  const port = await freePort();
  const srv = spawn(process.execPath, [join(root, 'server.js')], { env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
  for (let i = 0; i < 80; i++) { try { if ((await fetch('http://127.0.0.1:' + port + '/build.json')).ok) break; } catch { /* not yet */ } await sleep(100); }
  return { port, srv, base: 'http://127.0.0.1:' + port + '/', stop: () => srv.kill() };
}

/** kind: 'phone' (iPhone WebKit, touch) | 'desktop' (Chromium, keyboard and mouse) */
export async function open(kind, base, { query = '?dev=1&solo=1&opening=off&tier=low', w, h } = {}) {
  let browser, ctx;
  if (kind === 'phone') {
    browser = await pw.webkit.launch({ headless: true, executablePath: process.env.COSMOS_WEBKIT || join(lad, 'ms-playwright', 'webkit-2336', 'Playwright.exe') });
    ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      viewport: { width: w || 393, height: h || 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  } else {
    browser = await pw.chromium.launch({ headless: true, executablePath: process.env.COSMOS_CHROMIUM || join(lad, 'ms-playwright', 'chromium-1234', 'chrome-win64', 'chrome.exe'),
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
    ctx = await browser.newContext({ viewport: { width: w || 1100, height: h || 680 } });
  }
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e) + ' @ ' + String(e.stack || '').split(/\r?\n/).slice(0, 3).join(' | ')));
  page.setDefaultTimeout(120000);
  await page.goto(base + query, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.cosmos?.ship?.ready && cosmos.engine.frameCount >= 2, null, { timeout: 180000 });
  await page.waitForTimeout(800);
  return { browser, ctx, page, errors, close: () => browser.close() };
}

/** Put the player in the pilot's seat (solo), the way the opening ends: aboard, seated, ship on its pad. */
export async function sitPilot(page) {
  return page.evaluate(async () => {
    const c = cosmos, s = c.ship;
    if (c.opening && c.opening.active) { try { await c.opening.skip?.(); } catch { /* ok */ } }
    if (!s.aboard) { const e = s.def.dock.entry || { x: 0, y: 1, z: 20 }; s.boardAt(e.x ?? 0, e.y ?? 1, e.z ?? 20, 0); }
    s.takeSeat('pilot'); c.step(0);
    return { aboard: s.aboard, seat: s.seat && s.seat.id, landed: s.flight.landed, agl: s.flight.agl };
  });
}

/** Run `seconds` of game time without drawing (fast), 60 Hz. */
export const stepSec = (page, seconds) => page.evaluate(async (sec) => {
  const c = cosmos, r = c.engine.renderer, render = r.render; r.render = () => {};
  try { for (let t = 0; t < sec - 1e-7; t += 1 / 60) c.step(Math.min(1 / 60, sec - t)); } finally { r.render = render; } c.step(0);
}, seconds);

export const state = (page) => page.evaluate(() => { const f = cosmos.ship.flight; return { agl: +f.agl.toFixed(1), speed: +f.speed.toFixed(1), vs: +f.verticalSpeed.toFixed(1), gs: +f.groundSpeed.toFixed(1), landed: f.landed, mode: f.controls.mode, boosting: f.boosting, fov: +cosmos.engine.camera.fov.toFixed(1), seat: cosmos.ship.seat && cosmos.ship.seat.id, chase: cosmos.ship.chaseView }; });
export const outDir = (name) => { const d = join(here, name || ''); mkdirSync(d, { recursive: true }); return d; };
