// The Moon on a phone: real iPhone-profile WebKit taps at the three settlements (solo game, the same code the shared world runs on the client):
//   open the nav computer from Mars and see the course to the Moon with its lane fee and tap it; stand at the hub and talk to the arrivals guide with a real tap;
//   sell a tonne of ice to the water office; buy water at the mercantile; see that from the hub the way to Shackleton has no lane fee; look at Shackleton Base,
//   Daedalus Station, the Apollo 11 site, an ice beacon and Earth in the sky. Screenshots go to docs/qa/2026-10-03/moon/.
//   node test/moon-browser.mjs
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createServer as netServer } from 'node:net';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url)), root = dirname(here);
let pw; try { pw = createRequire(import.meta.url)('playwright'); } catch { pw = createRequire(process.env.COSMOS_PLAYWRIGHT_ROOT || join(homedir(), '.codex/runtime/unfinished-island/node_modules/'))('playwright'); }
const out = join(root, 'docs', 'qa', '2026-10-03', 'moon'); await mkdir(out, { recursive: true });
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
  const page = await ctx.newPage(); page.setDefaultTimeout(180000);
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) console.log('CONSOLE', m.text().slice(0, 300)); });
  await page.goto(`http://127.0.0.1:${port}/?dev=1&solo=1&opening=off&tier=low&depth=16`, { waitUntil: 'commit', timeout: 240000 });
  await page.waitForFunction(() => window.cosmos && cosmos.engine && cosmos.engine.frameCount >= 2, null, { timeout: 300000 });
  await sleep(2500);
  const tap = async (sel, textRe) => {
    const r = await page.evaluate(([sel, re]) => { const els = [...document.querySelectorAll(sel)].filter((e) => !re || new RegExp(re).test(e.textContent)); const e = els[0]; if (!e) return null; e.scrollIntoView({ block: 'center' }); const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2, disabled: !!e.disabled }; }, [sel, textRe ? textRe.source : null]);
    if (!r || r.disabled) return false;
    await page.touchscreen.tap(r.x, r.y); return true;
  };
  // outpost-local helpers for the shot camera and the walker
  await page.evaluate(() => {
    const o2f = (pi, x, y, z) => ({ x: pi.point.x + pi.east.x * x + pi.up.x * y - pi.north.x * z, y: pi.point.y + pi.east.y * x + pi.up.y * y - pi.north.y * z, z: pi.point.z + pi.east.z * x + pi.up.z * y - pi.north.z * z });
    window.__cam = (ex, ey, ez, tx, ty, tz) => { const pi = cosmos.space.activeMoon.body.padInfo; cosmos.freeCam.set(o2f(pi, ex, ey, ez), o2f(pi, tx, ty, tz)); for (let i = 0; i < 40; i++) cosmos.step(1 / 30); };
    window.__eye = (x, z, bearing, pitch = 0) => { cosmos.freeCam.off(); const w = cosmos.walker, b = cosmos.space.activeMoon.body, pi = b.padInfo, p = o2f(pi, x, 0, z), l = Math.hypot(p.x, p.y, p.z), R = b.surfaceRadius(p.x / l, p.y / l, p.z / l) + 0.05; Object.assign(w.worldPos, { x: p.x / l * R, y: p.y / l * R, z: p.z / l * R }); w.velocity = { x: 0, y: 0, z: 0 }; w.updateFrame(); cosmos.space.activeMoon.force(w.worldPos); for (let i = 0; i < 90; i++) w.tick(1 / 60, {}); w.yaw = bearing * Math.PI / 180; w.pitch = pitch * Math.PI / 180; for (let i = 0; i < 30; i++) cosmos.step(1 / 30); };
  });

  // ---- the nav computer, from Mars: the course to the Moon is offered with its lane fee, and a tap starts it
  await page.evaluate(() => { const c = cosmos; c.ship.aboard = true; c.space.ui._seatOk = () => true; c.space.ui.toggle('course'); c.space.ui.draw(true); });
  await sleep(500);
  const row = await page.evaluate(() => { const b = document.querySelector('#space-sheet [data-d="moon"]'); return b ? { text: b.textContent, disabled: b.disabled } : null; });
  ok('the nav computer lists the Moon\'s Tranquility Civil Hub with its lane fee and it can be tapped', !!row && !row.disabled && /Tranquility Civil Hub/.test(row.text) && /120 credits/.test(row.text), JSON.stringify(row));
  const rows = await page.evaluate(() => ['moon', 'moon-shackleton', 'moon-daedalus'].map((d) => !!document.querySelector(`#space-sheet [data-d="${d}"]`)));
  ok('all three landings are on the list', rows.every(Boolean), JSON.stringify(rows));
  await page.screenshot({ path: join(out, 'phone-nav-moon.png') });
  const tapped = await page.locator('#space-sheet [data-d="moon"]').tap({ timeout: 20000 }).then(() => true, () => false); await sleep(600);
  const trip = await page.evaluate(() => { const t = cosmos.space.trip; return t ? { active: t.active, dest: t.dest.id, jump: t._crossing && t._crossing() } : { none: true }; });
  ok('tapping it starts a course across the lane', tapped && !!trip && trip.active && trip.dest === 'moon' && trip.jump === true, JSON.stringify(trip));
  await page.evaluate(() => { cosmos.space.cancel(); cosmos.space.ui.close(); });

  // ---- the hub, on the ground
  await page.evaluate(() => { const c = cosmos; c.space.trip = null; c.ship.flight.override = null; c.space.debugStand('moon'); c.ship.aboard = false; for (let i = 0; i < 20; i++) c.step(1 / 30); });
  const want = await page.evaluate(async () => (await import('./src/worlds/moon/cast.js')).castOf('moon').length);
  await page.waitForFunction((n) => { const w = cosmos.space.worlds.get('moon'); return w && w.client && w.client.people.members.length === n && w.client.people.members.every((m) => m.person.loaded !== false); }, want, { timeout: 240000 }).catch(() => {});
  const people = await page.evaluate(() => cosmos.space.worlds.get('moon').client.people.members.length);
  ok('the hub has all its people standing in it', people === want && people >= 12, `${people}/${want}`);
  await page.evaluate(() => __eye(-30, 14, 345, 4)); await sleep(1500);
  await page.screenshot({ path: join(out, 'phone-hub-pad.png') });
  await page.evaluate(() => __cam(78, 20, 118, 0, 4, -50)); await sleep(1200);
  await page.screenshot({ path: join(out, 'phone-hub.png') });
  const stand = (id, dx, dz) => page.evaluate(async ([id, dx, dz]) => {
    const w = cosmos.space.activeMoon, m = w.client.people.members.find((q) => q.id === id); __eye(m.x + dx, m.z + dz, (Math.atan2(-dx, dz) * 180 / Math.PI + 360) % 360 + 0, 2);
    for (let i = 0; i < 30; i++) cosmos.step(1 / 30); return { name: m.name };
  }, [id, dx, dz]);
  await stand('h-guide', 0, -2.4); await sleep(500);
  const talk = await page.waitForFunction(() => getComputedStyle(document.getElementById('crew-talk')).display !== 'none', null, { timeout: 15000 }).then(() => true, () => false);
  ok('standing near the arrivals guide, the Talk button shows her name', talk && (await page.evaluate(() => document.getElementById('crew-talk').textContent)).includes('Odalys Moreno'));
  await page.screenshot({ path: join(out, 'phone-talk-button.png') });
  await tap('#crew-talk'); await sleep(500);
  ok('a real tap on Talk opens her panel, inside the screen, and she says her line', await page.evaluate(() => { const p = document.getElementById('crew-panel'), r = p.getBoundingClientRect(); return cosmos.crewUI.open && /Odalys Moreno/.test(p.textContent) && /nobody is shooting at anybody/.test(p.textContent) && r.left >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 && r.top >= 0; }));
  await page.screenshot({ path: join(out, 'phone-talk-panel.png') });
  await tap('#crew-panel button', /Where is everything/); await sleep(400);
  ok('her answer shows (and is spoken from her body)', await page.evaluate(() => /footprints/.test(document.getElementById('crew-panel').textContent)));
  await page.screenshot({ path: join(out, 'phone-talk-answer.png') });
  await page.evaluate(() => cosmos.crewUI.close());
  // the water office: ice from the hold
  await stand('h-water', 1.4, 1.6);
  await page.evaluate(() => { const e = cosmos.world.state.economy; e.hold = e.hold || {}; e.hold['moon-ice'] = 2500; cosmos.space.jobs.hold = [{ lotId: 'z', materialId: 'MAT-MOON-ICE', materialName: 'Lunar polar ice', massKg: 2500, solidVolumeM3: 1.5, looseVolumeM3: 2.3, parts: [{ materialId: 'MAT-MOON-ICE', massKg: 2500, volumeM3: 1.5 }] }]; });
  await sleep(500); await tap('#crew-talk'); await sleep(500);
  await tap('#crew-panel button', /ice to sell/); await sleep(400);
  const i0 = await page.evaluate(() => cosmos.world.state.economy.marks);
  await tap('#crew-panel button', /Sell 1 tonne/); await sleep(500);
  const i1 = await page.evaluate(() => ({ marks: cosmos.world.state.economy.marks, hold: cosmos.world.state.economy.hold['moon-ice'] }));
  ok('selling a tonne of ice to the water office pays 330 marks and leaves 1.5 t', i1.marks - i0 === 330 && Math.abs(i1.hold - 1500) < 1e-6, JSON.stringify({ i0, i1 }));
  await page.screenshot({ path: join(out, 'phone-talk-ice.png') });
  await page.evaluate(() => cosmos.crewUI.close());
  // the mercantile: buy a litre of water
  await stand('h-shop', 1.4, 1.2); await sleep(500); await tap('#crew-talk'); await sleep(500);
  await tap('#crew-panel button', /what you buy and sell/); await sleep(400);
  const m0 = await page.evaluate(() => ({ marks: cosmos.world.state.economy.marks, water: cosmos.world.state.economy.inventory.water }));
  await tap('#crew-panel button', /Buy 1 · 22/); await sleep(500);
  const m1 = await page.evaluate(() => ({ marks: cosmos.world.state.economy.marks, water: cosmos.world.state.economy.inventory.water }));
  ok('buying one water at the mercantile costs 22 marks and puts a litre in the supplies', m0.marks - m1.marks === 22 && m1.water === m0.water + 1, JSON.stringify({ m0, m1 }));
  await page.screenshot({ path: join(out, 'phone-talk-shop.png') });
  await page.evaluate(() => cosmos.crewUI.close());
  // the recruiters face each other
  await stand('h-recruit-fortis', -2.2, 0); await sleep(500); await tap('#crew-talk'); await sleep(500);
  ok('the Fortis recruiter\'s panel offers to sign you up', await page.evaluate(() => /Join Fortis/.test(document.getElementById('crew-panel').textContent)));
  await page.screenshot({ path: join(out, 'phone-recruiter.png') });
  await page.evaluate(() => cosmos.crewUI.close());
  // the first footprints
  await page.evaluate(() => __eye(-790, 772, 250, 2)); await sleep(2500);
  await page.screenshot({ path: join(out, 'phone-apollo.png') });
  // Earth in the sky
  await page.evaluate(() => { __eye(200, 250, 270, 62); }); await sleep(1500);
  const earth = await page.evaluate(() => { const e = cosmos.space.activeMoon.client.earth.mesh; return { vis: e.visible, tex: !!e.material.uniforms.uMap.value }; });
  ok('Earth is in the Moon\'s sky with its picture', earth.vis && earth.tex, JSON.stringify(earth));
  await page.screenshot({ path: join(out, 'phone-earth.png') });

  // ---- from the hub the way to Shackleton has no lane fee and the way to Mars has one
  const dests = await page.evaluate(() => { cosmos.ship.aboard = true; const d = cosmos.space.destinations(); const get = (id) => d.find((x) => x.id === id); return { shack: get('moon-shackleton'), dae: get('moon-daedalus'), port: get('port') }; });
  ok('from the hub the hop to Shackleton is listed with a flight time and no lane fee, and Marineris Port with one', dests.shack && !dests.shack.crossing && dests.shack.etaS > 30 && dests.shack.etaS < 4000 && !dests.shack.laneFee && dests.dae && !dests.dae.crossing && dests.port && dests.port.crossing && dests.port.laneFee === 120, JSON.stringify({ shack: dests.shack && { eta: dests.shack.etaS, crossing: dests.shack.crossing }, port: dests.port && { crossing: dests.port.crossing, fee: dests.port.laneFee } }));
  await page.evaluate(() => { cosmos.ship.aboard = false; });

  // ---- Shackleton Base
  await page.evaluate(() => { const c = cosmos; c.space.debugStand('moon-shackleton'); c.ship.aboard = false; for (let i = 0; i < 20; i++) c.step(1 / 30); });
  const wantS = await page.evaluate(async () => (await import('./src/worlds/moon/cast.js')).castOf('moon-shackleton').length);
  await page.waitForFunction((n) => { const w = cosmos.space.worlds.get('moon-shackleton'); return w && w.client && w.client.people.members.length === n && w.client.people.members.every((m) => m.person.loaded !== false); }, wantS, { timeout: 240000 }).catch(() => {});
  ok('Shackleton Base has all its people', await page.evaluate((n) => cosmos.space.worlds.get('moon-shackleton').client.people.members.length === n, wantS));
  await page.evaluate(() => __cam(190, 52, 175, 20, 6, -10)); await sleep(1500);
  await page.screenshot({ path: join(out, 'phone-shackleton.png') });
  await page.evaluate(() => __eye(96, 28, 90, 3)); await sleep(1500);
  await page.screenshot({ path: join(out, 'phone-shackleton-gate.png') });
  await page.evaluate(() => __eye(-700, 1300, 215, -8)); await sleep(2500);
  await page.screenshot({ path: join(out, 'phone-shackleton-ice.png') });
  await stand('s-ice', 1.4, 1.6);
  await page.evaluate(() => { const e = cosmos.world.state.economy; e.hold['moon-ice'] = 2500; cosmos.space.jobs.hold = [{ lotId: 'y', materialId: 'MAT-MOON-ICE', materialName: 'Lunar polar ice', massKg: 2500, solidVolumeM3: 1.5, looseVolumeM3: 2.3, parts: [{ materialId: 'MAT-MOON-ICE', massKg: 2500, volumeM3: 1.5 }] }]; });
  await sleep(500); await tap('#crew-talk'); await sleep(500); await tap('#crew-panel button', /ice to sell/); await sleep(400);
  const d0 = await page.evaluate(() => cosmos.world.state.economy.marks);
  await tap('#crew-panel button', /Sell 1 tonne/); await sleep(500);
  const d1 = await page.evaluate(() => cosmos.world.state.economy.marks);
  ok('the Fortis dock master pays 250 marks for a tonne (the hub pays 330)', d1 - d0 === 250, `${d0} -> ${d1}`);
  await page.screenshot({ path: join(out, 'phone-talk-dock.png') });
  await page.evaluate(() => cosmos.crewUI.close());

  // ---- Daedalus Station
  await page.evaluate(() => { const c = cosmos; c.space.debugStand('moon-daedalus'); c.ship.aboard = false; for (let i = 0; i < 20; i++) c.step(1 / 30); });
  const wantD = await page.evaluate(async () => (await import('./src/worlds/moon/cast.js')).castOf('moon-daedalus').length);
  await page.waitForFunction((n) => { const w = cosmos.space.worlds.get('moon-daedalus'); return w && w.client && w.client.people.members.length === n && w.client.people.members.every((m) => m.person.loaded !== false); }, wantD, { timeout: 240000 }).catch(() => {});
  ok('Daedalus Station has all its people', await page.evaluate((n) => cosmos.space.worlds.get('moon-daedalus').client.people.members.length === n, wantD));
  await page.evaluate(() => __cam(160, 58, 200, 0, 10, -40)); await sleep(1500);
  await page.screenshot({ path: join(out, 'phone-daedalus.png') });
  await page.evaluate(() => __eye(-6, -62, 0, 8)); await sleep(1500);
  await page.screenshot({ path: join(out, 'phone-daedalus-hall.png') });
  await stand('d-fab', 0, 1.6); await sleep(500); await tap('#crew-talk'); await sleep(500);
  await page.screenshot({ path: join(out, 'phone-talk-fab.png') });
  ok('no Earth over Daedalus: the far side never sees it (it is below the horizon)', await page.evaluate(() => { const e = cosmos.space.activeMoon.client.earth.mesh.position, pi = cosmos.space.activeMoon.body.padInfo, l = e.length(); return (e.x * pi.up.x + e.y * pi.up.y + e.z * pi.up.z) / l < -0.5; }));
  await page.evaluate(() => cosmos.crewUI.close());
  ok('no page errors', errors.length === 0, errors.join(' | '));
} catch (e) { console.error(e); ok('the scenario ran to the end', false, String(e)); }
finally { try { await browser?.close(); } catch {} try { server.kill(); } catch {} }
const failed = results.filter((r) => !r.pass);
console.log(failed.length ? `FAILED ${failed.length}/${results.length}` : `PASSED ${results.length}/${results.length}`);
setTimeout(() => process.exit(failed.length ? 1 : 0), 500);
