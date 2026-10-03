// SH14 / SH15 in the real game, on an iPhone-profile WebKit phone against an isolated authority: each new ship is given to a pilot, set on a pad,
// the pilot is put inside it (a view from the walk) and then outside it (a free camera looking at it on the Mars pad), and the page must draw it
// with no page error. Screenshots go to docs/qa/2026-10-03/sh14 and sh15 (jpg: the repo keeps those local, the REVIEW.md beside them is committed).
//   node test/sh-browser.mjs [type ...]
import '../server/runtime.mjs';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { startServer } from '../server/index.mjs';
import { FileAdapter } from '../server/storage.mjs';

let pw; try { pw = createRequire(import.meta.url)('playwright'); } catch { pw = createRequire(process.env.COSMOS_PLAYWRIGHT_ROOT || join(homedir(), '.codex/runtime/unfinished-island/node_modules/'))('playwright'); }
const OUT = { hauler: 'sh14/_control', lifeboat: 'sh14', transport: 'sh15', descender: 'sh15', bulker: 'sh15', escort: 'sh15' };
const dirOf = (t) => fileURLToPath(new URL('../docs/qa/2026-10-03/' + OUT[t] + '/', import.meta.url));
const dir = await mkdtemp(join(tmpdir(), 'cosmos-sh-browser-'));
const errors = []; let app, browser;
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const until = async (fn, ms = 60000, what = 'condition') => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) throw new Error('timed out waiting for ' + what); await new Promise((r) => setTimeout(r, 250)); } };
const START = { hauler: { x: 0, z: 0 }, lifeboat: { x: 0.4, z: 0.2 }, transport: { x: 0, z: 22 }, descender: { x: 0, z: -3.5 }, bulker: { x: 0, z: -100 }, escort: { x: 0, z: 2 } };
const want = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(OUT).filter((t) => t !== 'hauler');

try {
  app = await startServer({ adapter: new FileAdapter(join(dir, 'world.json')), port: 0, tick: true });
  const world = app.world, origin = app.url.replace('ws:', 'http:');
  if (process.env.COSMOS_BROWSER === 'chromium') browser = await pw.chromium.launch({ headless: true, executablePath: process.env.COSMOS_CHROMIUM || join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'chromium-1234', 'chrome-win64', 'chrome.exe'), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  else browser = await pw.webkit.launch({ headless: true, executablePath: process.env.COSMOS_WEBKIT || join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'webkit-2336', 'Playwright.exe') });
  for (const type of want) {
    await mkdir(dirOf(type), { recursive: true });
    const key = type.padEnd(48, 'x').slice(0, 48);
    const person = await world.join(key, 'Pilot-' + type);
    let rec;
    await world.enqueue(() => { rec = world.newOwnedShip(person, type, { how: 'bought', marks: 0 }); person.shipId = rec.id; person.currentShipId = rec.id; world.state.revision++; });
    world.advance(10);
    const sim = world.sims.get(rec.id), def = sim.def;
    await world.enqueue(() => {
      const c = world.state.players[person.id], s = START[type];
      c.aboardShipId = rec.id; c.currentShipId = rec.id; c.pose.aboard = true; c.pose.seat = null;
      c.pose.sw = { x: s.x, y: 0, z: s.z, yaw: 0, pitch: 0 }; c.frameId = sim.frameId; sim.flight.toWorld(c.pose.sw, c.pose.worldPos);
      world.state.revision++;
    });
    const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await ctx.addInitScript(({ key, name }) => { localStorage.setItem('cosmos-device-v2', JSON.stringify({ key, name })); localStorage.setItem('hb-look', 'isaiah'); }, { key, name: 'Pilot-' + type });
    if (process.env.SHDEBUG) await ctx.addInitScript(() => { for (const C of [window.WebGL2RenderingContext, window.WebGLRenderingContext]) { if (!C) continue; const cs = C.prototype.compileShader; C.prototype.compileShader = function (sh) { cs.call(this, sh); if (!this.getShaderParameter(sh, this.COMPILE_STATUS)) { const src = this.getShaderSource(sh) || ''; console.error('COMPILEFAIL: ' + this.getShaderInfoLog(sh) + ' SRC: ' + src.slice(0, 60) + ' ... has aLift:' + /aLift/.test(src) + ' len ' + src.length); } }; const ln = C.prototype.linkProgram; C.prototype.linkProgram = function (p) { ln.call(this, p); if (!this.getProgramParameter(p, this.LINK_STATUS)) { const sh = this.getAttachedShaders(p) || []; console.error('LINKFAIL: ' + this.getProgramInfoLog(p) + ' || ' + sh.map((x) => this.getShaderInfoLog(x)).join(' | ')); } }; } });
    const page = await ctx.newPage(); page.setDefaultTimeout(240000);
    page.on('pageerror', (e) => errors.push(`${type}: ${e}`));
    page.on('console', (m) => { const tx = m.text(); if (process.env.SHDEBUG && (m.type() === 'error' || m.type() === 'warning')) console.log('[' + m.type() + ']', tx.slice(0, 700)); if (m.type() === 'error' && !/favicon|404|net::/.test(tx)) errors.push(`${type} console: ${tx.slice(0, 300)}`); });
    page.on('response', (r) => { if (r.status() >= 400 && process.env.SHDEBUG) console.log('[http ' + r.status() + ']', r.url()); });
    page.on('framenavigated', (f) => { if (process.env.SHDEBUG) console.log('[nav]', f.url().slice(0, 120)); });
    await page.goto(`${origin}/?dev=1&opening=off&tier=low&ws=${app.url}`, { waitUntil: 'commit', timeout: 240000 });
    await page.waitForFunction(() => window.cosmos?.multiplayer?.initialized && cosmos.engine.frameCount >= 2, null, { timeout: 300000 });
    await page.waitForTimeout(1500);
    if (process.env.SHDEBUG) { await page.evaluate(() => { const r = cosmos.engine.renderer; r.debug.checkShaderErrors = true; cosmos.engine.scene.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; }); for (let i = 0; i < 3; i++) cosmos.step(1 / 30); }); await page.waitForTimeout(1500); }
    const info = await page.evaluate(() => ({ type: cosmos.ship && cosmos.ship.def && cosmos.ship.def.type, aboard: !!cosmos.ship?.aboard, frames: cosmos.engine.frameCount }));
    console.log(type, 'in the page:', JSON.stringify(info));
    assert.equal(info.type, type, 'the page is flying the ' + type);
    await page.screenshot({ path: join(dirOf(type), `game-${type}-aboard.jpg`), type: 'jpeg', quality: 82 });
    // outside: the pilot steps off and a free camera looks at the hull on the pad
    const D = def.envelope;
    const eye = sim.flight.toWorld({ x: D.depth * 0.45, y: D.height * 0.9 + 6, z: -D.depth * 0.75 }, {}), tgt = sim.flight.toWorld({ x: 0, y: D.height * 0.25, z: 0 }, {});
    await world.enqueue(() => { const c = world.state.players[person.id]; c.aboardShipId = null; c.pose.aboard = false; c.pose.worldPos = sim.flight.toWorld({ x: 0, y: -def.gear.nominal - 0.5, z: def.dock.rampFoot.z + 3 }, {}); c.pose.velocity = { x: 0, y: 0, z: 0 }; c.poseAt = Date.now(); world.state.revision++; });
    await until(() => page.evaluate(() => !cosmos.ship.aboard), 40000, 'the client to see the pilot step off');
    await page.waitForTimeout(2500);
    await page.evaluate(({ eye, tgt }) => { cosmos.freeCam.set(eye, tgt); for (let i = 0; i < 24; i++) cosmos.step(1 / 30); }, { eye, tgt });
    await page.waitForTimeout(800);
    await page.screenshot({ path: join(dirOf(type), `game-${type}-outside.jpg`), type: 'jpeg', quality: 82 });
    console.log('PASS', type, 'drawn in the real game, inside and outside');
    await ctx.close();
  }
  if (errors.length) { console.log('page errors:', errors.slice(0, 8)); process.exitCode = 1; } else console.log('ALL PASS, no page errors');
} catch (e) {
  console.error('FAIL', e.stack || e.message); process.exitCode = 1;
} finally {
  try { await browser?.close(); } catch { /* closed */ }
  try { await app?.close(); } catch { /* closed */ }
  await rm(dir, { recursive: true, force: true });
}
process.exit(process.exitCode || 0);
