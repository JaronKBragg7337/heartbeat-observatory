// iPhone WebKit shots for looks-r1. Same UA and viewport family as test/phone-check.mjs,
// landscape so a flight deck and a hull flank fill the frame. Pass --phase before|after.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..', '..');
const phase = process.argv.includes('--phase') ? process.argv[process.argv.indexOf('--phase') + 1] : 'before';
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : null;
let pw;
try { pw = createRequire(import.meta.url)('playwright'); }
catch { pw = createRequire(process.env.COSMOS_PLAYWRIGHT_ROOT || 'C:/Users/lilli/.codex/runtime/unfinished-island/node_modules/playwright')('playwright'); }
const lad = process.env.LOCALAPPDATA || '';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const freePort = () => new Promise((r) => { const s = createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });

const port = await freePort();
const srv = spawn(process.execPath, [join(root, 'server.js')], { env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
for (let i = 0; i < 80; i++) { try { if ((await fetch('http://127.0.0.1:' + port + '/build.json')).ok) break; } catch { /* not yet */ } await sleep(100); }
const base = 'http://127.0.0.1:' + port + '/';
mkdirSync(here, { recursive: true });

const browser = await pw.webkit.launch({ headless: true, executablePath: process.env.COSMOS_WEBKIT || join(lad, 'ms-playwright', 'webkit-2336', 'Playwright.exe') });
const errors = [];
async function pageFor(query, { blockPeople = false } = {}) {
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    viewport: { width: 852, height: 393 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
  if (blockPeople) await page.route('**/homes/people/*.glb', (r) => r.abort());
  await page.goto(base + query, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.cosmos?.ship?.ready && cosmos.engine.frameCount >= 2, null, { timeout: 240000 });
  await page.waitForTimeout(600);
  return page;
}
async function shot(page, name, fn, arg) {
  if (only && !only.includes(name)) return;
  await page.bringToFront();
  const info = await page.evaluate(fn, arg);
  // debugAt renders inside engine.step. One more presented frame, then the screenshot, before the live loop walks the camera off.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.screenshot({ path: join(here, `${phase}-${name}.png`) });
  console.log('SHOT', phase, name, JSON.stringify(info));
}

const want = (name) => !only || only.includes(name);
const skiff = (want('1-flight-deck') || want('2-skiff-ramp')) ? await pageFor('?dev=1&solo=1&opening=off&ship=lifeboat', { blockPeople: true }) : null;
await shot(skiff, '1-flight-deck', (after) => {
  const c = cosmos, m = [...c.crew.members.values()].find((x) => x.def.seat === 'pilot') || [...c.crew.members.values()][0];
  if (m) {
    m.place = 'aboard'; c.crew._attachVisual(m);
    // Aft of the front seats, in the aisle, facing the bow. The matched before stands in the navigator chair.
    m.person.group.position.set(after ? 0.05 : -0.35, 0, after ? -3.45 : -3.55);
    m.person.group.rotation.y = Math.PI;
    m.person.play('Idle');
  }
  if (c.multiplayer?.panel) c.multiplayer.panel.hidden = true;
  const where = c.ship.debugAt('cockpit', after ? -1.15 : 0.55, after ? -2.85 : -3.15, after ? 52 : -28, after ? -6 : -6, 20);
  if (m && after) {
    m.person.group.position.set(0.05, 0, -3.45);
    m.person.group.rotation.y = Math.PI;
    m.person.play('Idle');
  }
  return { where, safe: m ? !!m.person.safe : null, ship: c.ship.def.type, after: !!after };
}, phase === 'after');
await shot(skiff, '2-skiff-ramp', () => {
  if (cosmos.multiplayer?.panel) cosmos.multiplayer.panel.hidden = true;
  cosmos.ship.debugViewFrom(0.4, 1.35, 11.2, 0, 1.15, 4.2, 30);
  return { agl: +cosmos.ship.flight.agl.toFixed(1), landed: cosmos.ship.flight.landed };
});
const night = want('5-pad-night') ? await pageFor('?dev=1&solo=1&opening=off&ship=lifeboat&sky=night') : null;
await shot(night, '5-pad-night', () => {
  if (cosmos.multiplayer?.panel) cosmos.multiplayer.panel.hidden = true;
  cosmos.ship.debugViewFrom(5.5, 1.6, 13.5, 0, -0.4, 3.5, 40);
  return { sky: new URLSearchParams(location.search).get('sky'), landed: cosmos.ship.flight.landed };
});

const liner = (want('3-boarding-seats') || want('3b-gate') || want('4-depart-board') || want('4b-gate-board') || want('6-hull-windows')) ? await pageFor('?dev=1&solo=1&opening=off&ship=transport') : null;
await shot(liner, '3-boarding-seats', () => {
  if (cosmos.multiplayer?.panel) cosmos.multiplayer.panel.hidden = true;
  const where = cosmos.ship.debugAt('sal_s1', 5.4, -22.5, 180, -8, 12);
  return { where, ship: cosmos.ship.def.hudName };
});
await shot(liner, '3b-gate', (after) => {
  // After frame aims at the terminal row. The before keeps the original hall view.
  const where = cosmos.ship.debugAt('gate', 7.2, 27.2, after ? 137 : 200, -8, 20);
  return { where };
}, phase === 'after');
await shot(liner, '4-depart-board', () => {
  const where = cosmos.ship.debugAt('promenade', 0.0, 28.2, 180, 12, 12);
  return { where };
});
await shot(liner, '4b-gate-board', () => {
  const where = cosmos.ship.debugAt('gate', 6.4, 27.6, -92, 2, 20);
  return { where };
});
await shot(liner, '6-hull-windows', () => {
  const s = cosmos.ship;
  s.debugViewFrom(28, 6.2, 5.3, 10, 3.6, 5.3, 24);
  const w = s.walker.worldPos;
  return { type: s.def.type, aboard: s.aboard, room: s.currentRoom, pos: [+w.x.toFixed(1), +w.y.toFixed(1), +w.z.toFixed(1)] };
});

console.log('ERRORS', errors.length ? errors.join(' || ') : 'none');
await browser.close();
srv.kill();
console.log('DONE', phase);
