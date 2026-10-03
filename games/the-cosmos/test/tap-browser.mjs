// Tap-loss reproduction: real iPhone-profile WebKit taps (page.touchscreen.tap) on Talk and Dig, with and without a held move stick
// (the stick is a second synthetic pointer on the canvas: Playwright cannot do two real fingers). Counts how many taps do what they say.
//   node test/tap-browser.mjs        (TAPS=30 by default)
import '../server/runtime.mjs';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../server/index.mjs';
import { FileAdapter } from '../server/storage.mjs';

let pw; try { pw = createRequire(import.meta.url)('playwright'); } catch { pw = createRequire(process.env.COSMOS_PLAYWRIGHT_ROOT || join(homedir(), '.codex/runtime/unfinished-island/node_modules/'))('playwright'); }
const out = fileURLToPath(new URL('../docs/qa/2026-10-03/round7/', import.meta.url)); await mkdir(out, { recursive: true });
const dir = await mkdtemp(join(tmpdir(), 'cosmos-tap-'));
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const N = Number(process.env.TAPS || 20), results = {}, errors = [];
let app, browser;
try {
  app = await startServer({ adapter: new FileAdapter(join(dir, 'world.json')), port: 0, tick: true });
  const world = app.world, origin = app.url.replace('ws:', 'http:');
  const me = await world.join('t'.repeat(48), 'Tapper');
  // the server holds the pose too, so a teleport is not pulled back: move both together
  const placeServer = (x, z) => world.enqueue(() => { const p = world.state.players[me.id]; p.pose.worldPos = world.site.toWorld(x, 0.02, z); p.pose.velocity = { x: 0, y: 0, z: 0 }; p.poseAt = Date.now(); world.state.revision++; });
  browser = await pw.webkit.launch({ headless: true, executablePath: process.env.COSMOS_WEBKIT || join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'webkit-2336', 'Playwright.exe') });
  const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => { localStorage.setItem('cosmos-device-v2', JSON.stringify({ key: 't'.repeat(48), name: 'Tapper' })); localStorage.setItem('hb-look', 'isaiah'); });
  const page = await ctx.newPage(); page.setDefaultTimeout(120000);
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${origin}/?dev=1&opening=off&tier=low&ws=${app.url}`, { waitUntil: 'commit', timeout: 240000 });
  await page.waitForFunction(() => window.cosmos?.multiplayer?.initialized && cosmos.engine.frameCount >= 2, null, { timeout: 300000 });
  await page.waitForFunction(() => cosmos.portPeople?.members?.length && cosmos.portPeople.members.every(m => m.person.loaded !== false), null, { timeout: 120000 }).catch(() => {});
  await sleep(1500);

  const stick = async (on) => page.evaluate((on) => { const c = document.querySelector('canvas'); const ev = (t, dy) => c.dispatchEvent(new PointerEvent(t, { pointerId: 71, pointerType: 'touch', isPrimary: false, clientX: 80, clientY: 650 - dy, bubbles: true, cancelable: true }));
    if (on) { ev('pointerdown', 0); ev('pointermove', 30); } else ev('pointerup', 0); }, on);
  const tapEl = async (sel) => { const r = await page.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); const cs = getComputedStyle(e); return cs.display === 'none' ? null : { x: b.x, y: b.y, w: b.width, h: b.height }; }, sel); if (!r) return false; await page.touchscreen.tap(r.x + r.w * (0.3 + Math.random() * 0.4), r.y + r.h * (0.3 + Math.random() * 0.4)); return true; };

  // ---------------- TALK
  const spot = await page.evaluate(() => { const m = cosmos.portPeople.members.find(m => m.id === 'depot-clerk') || cosmos.portPeople.members[0]; return { id: m.id, x: m.x, z: m.z }; });
  const toWorker = async () => { await placeServer(spot.x, spot.z + 1.6); await page.evaluate(({ x, z }) => { const w = cosmos.walker, t = cosmos.port.site.toWorld(x, .3, z + 1.6); w.worldPos.x = t.x; w.worldPos.y = t.y; w.worldPos.z = t.z; w.velocity = { x: 0, y: 0, z: 0 }; }, { x: spot.x, z: spot.z }); };
  await page.evaluate(() => { window.__ev = []; const t0 = performance.now(); const L = (m) => window.__ev.push(Math.round(performance.now() - t0) + ' ' + m); window.__L = L;
    const b = document.getElementById('crew-talk'); for (const n of ['pointerdown', 'pointerup', 'pointercancel', 'click', 'lostpointercapture', 'touchstart', 'touchend', 'touchcancel']) b.addEventListener(n, (e) => L(n + ' det=' + e.detail), true);
    for (const n of ['pointerdown', 'touchstart']) window.addEventListener(n, (e) => { const t = e.touches ? e.touches[0] : e; const el = document.elementFromPoint(t.clientX, t.clientY); L('WIN ' + n + ' at ' + Math.round(t.clientX) + ',' + Math.round(t.clientY) + ' target=' + (e.target.id || e.target.tagName) + ' hit=' + (el && (el.id || el.tagName))); }, true);
    const cu = cosmos.crewUI; for (const n of ['close', 'openFor', 'toggle']) { const o = cu[n].bind(cu); cu[n] = (...a) => { L(n + (n === 'close' ? ' <- ' + new Error().stack.split('\n')[2].trim().slice(0, 80) : '')); return o(...a); }; } });
  const talkTrial = async (held) => {
    let ok = 0, noBtn = 0; const lost = [];
    for (let i = 0; i < N; i++) {
      await page.evaluate(() => cosmos.crewUI.close());
      // stand still beside the worker; only walk back when the held stick has carried us out of reach
      if (i === 0 || !(await page.evaluate(() => cosmos.crewUI.target && getComputedStyle(document.getElementById('crew-talk')).display !== 'none'))) { await toWorker(); await sleep(450); }
      await page.evaluate(() => { window.__ev.length = 0; });
      const vis = await page.waitForFunction(() => getComputedStyle(document.getElementById('crew-talk')).display !== 'none', null, { timeout: 4000 }).then(() => true, () => false);
      if (!vis) { noBtn++; continue; }
      await sleep(250);
      if (held) await stick(true);
      await sleep(60 + Math.random() * 400);
      await page.evaluate(() => window.__L('pre-tap target=' + (cosmos.crewUI.target && cosmos.crewUI.target.id) + ' open=' + cosmos.crewUI.open + ' near=' + (cosmos.portPeople.nearest(cosmos.walker.worldPos)?.id) + ' disp=' + document.getElementById('crew-talk').style.display + ' frame=' + cosmos.engine.frameCount));
      const tapped = await tapEl('#crew-talk'); if (tapped) await page.evaluate(() => window.__L('btnrect ' + JSON.stringify(document.getElementById('crew-talk').getBoundingClientRect())));
      let opened = false; for (let k = 0; k < 14 && !opened; k++) { await sleep(60); opened = await page.evaluate(() => cosmos.crewUI.open); }
      if (held) await stick(false);
      if (tapped && opened) ok++; else lost.push({ i, tapped, opened, ev: await page.evaluate(() => window.__ev.slice()), btn: await page.evaluate(() => { const b = document.getElementById('crew-talk'); const r = b.getBoundingClientRect(); const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { disp: getComputedStyle(b).display, top: e && (e.id || e.tagName), cls: b.className }; }) });
    }
    return { ok, N, noBtn, lost };
  };
  results.talkFree = await talkTrial(false); console.log('Talk, no stick', JSON.stringify(results.talkFree));
  results.talkHeld = await talkTrial(true); console.log('Talk, stick held', JSON.stringify(results.talkHeld));
  await page.evaluate(() => cosmos.crewUI.close());

  // The mechanism behind the lost taps, deterministically: the button was drawn for person A on the last 0.2 s tick; by the time the thumb lands the walker has
  // moved on (still within 4.5 m of A, outside the 3 m reach). The tap must open A (what the button said), not do nothing.
  { await page.evaluate(() => cosmos.crewUI.close()); await toWorker(); await sleep(700);
    const r = await page.evaluate(() => { cosmos.engine.stop(); const cu = cosmos.crewUI, t = cu.target; if (!t) return { err: 'no target' }; cu._accum = 0; const g = t.person.group.position, w = cosmos.walker;
      const p = cosmos.port.site.toWorld(g.x, .3, g.z + 3.8); w.worldPos.x = p.x; w.worldPos.y = p.y; w.worldPos.z = p.z; return { id: t.id, near: !!cosmos.portPeople.nearest(w.worldPos) }; });
    const tapped = r.err ? false : await tapEl('#crew-talk'); await sleep(250);
    const opened = await page.evaluate(() => ({ open: cosmos.crewUI.open, id: cosmos.crewUI.target && cosmos.crewUI.target.id }));
    await page.evaluate(() => { cosmos.engine.start(); cosmos.crewUI.close(); });
    results.staleTarget = { ...r, tapped, ...opened }; console.log('Talk, stale target', JSON.stringify(results.staleTarget));
    if (r.err || !tapped || !opened.open || opened.id !== r.id) { console.log('FAIL: a tap on a visible Talk button did nothing because the target was re-picked at tap time'); process.exitCode = 1; } }

  // ---------------- DIG
  let digShift = 0;
  const toDig = async () => { digShift += 2.5; const at = await page.evaluate((sh) => [window.__dig[0] + sh, window.__dig[1]], digShift); await placeServer(...at); await page.evaluate((at) => { cosmos.walker.velocity = { x: 0, y: 0, z: 0 }; cosmos.walker.pitch = -0.6; const t = cosmos.port.site.toWorld(at[0], .3, at[1]); const w = cosmos.walker; w.worldPos.x = t.x; w.worldPos.y = t.y; w.worldPos.z = t.z; }, at); };
  results.dig = {};
  // find open ground away from the ship, the lift and the people where the button reads Dig
  window_dig: for (const [x, z] of [[-110, 120], [100, 130], [-150, 40], [0, 160], [180, 60], [-60, -120], [60, -150]]) {
    await placeServer(x, z); await page.evaluate(([x, z]) => { window.__dig = [x, z]; const t = cosmos.port.site.toWorld(x, .3, z); const w = cosmos.walker; w.worldPos.x = t.x; w.worldPos.y = t.y; w.worldPos.z = t.z; w.velocity = { x: 0, y: 0, z: 0 }; w.pitch = -0.6; }, [x, z]);
    await sleep(1200);
    const lbl = await page.evaluate(() => { const b = document.getElementById('btn-action'); return getComputedStyle(b).display !== 'none' ? b.textContent : ''; });
    console.log('dig spot', x, z, JSON.stringify(lbl), JSON.stringify(await page.evaluate(() => ({ aboard: cosmos.ship.aboard, loc: cosmos.port.site.toLocal(cosmos.walker.worldPos), ship: cosmos.ship.def && cosmos.ship.def.id, grounded: cosmos.walker.grounded })))); if (/^Dig/.test(lbl)) break window_dig;
  }
  const digTrial = async (held) => {
    await toDig(); await page.evaluate(() => { cosmos.walker.pitch = -0.6; });
    let ok = 0, noBtn = 0; const lost = [];
    for (let i = 0; i < N; i++) {
      await toDig(); await sleep(500); await page.evaluate(() => { cosmos.carried.length = 0; });
      const vis = await page.waitForFunction(() => { const b = document.getElementById('btn-action'); return getComputedStyle(b).display !== 'none' && /Dig/.test(b.textContent); }, null, { timeout: 4000 }).then(() => true, () => false);
      if (!vis) { noBtn++; lost.push({ i, why: 'no Dig button: ' + await page.evaluate(() => document.getElementById('btn-action').textContent + '|' + getComputedStyle(document.getElementById('btn-action')).display + '|' + !!cosmos.digTarget()) }); await toDig(); await sleep(300); continue; }
      const before = await page.evaluate(() => cosmos.carried.length);
      if (held) await stick(true);
      await sleep(60 + Math.random() * 300);
      const tapped = await tapEl('#btn-action');
      let dug = false; for (let k = 0; k < 20 && !dug; k++) { await sleep(60); dug = await page.evaluate((b) => cosmos.carried.length > b, before); }
      if (held) await stick(false);
      if (tapped && dug) ok++; else lost.push({ i, tapped, dug, label: await page.evaluate(() => document.getElementById('btn-action').textContent) });
    }
    return { ok, N, noBtn, lost };
  };
  results.dig.free = await digTrial(false); console.log('Dig, no stick', JSON.stringify(results.dig.free));
  results.dig.held = await digTrial(true); console.log('Dig, stick held', JSON.stringify(results.dig.held));
  results.errors = errors;
  await writeFile(join(out, 'tap-browser-results.json'), JSON.stringify(results, null, 1));
  const bad = [results.talkFree, results.talkHeld, results.dig.free, results.dig.held].filter(r => r.ok + r.noBtn < r.N || r.noBtn > r.N / 4);
  if (bad.length || errors.length) { console.log('TAP LOSS or errors', JSON.stringify(bad), errors); process.exitCode = 1; } else console.log('PASS tap trials');
} catch (e) { console.error(e); process.exitCode = 1; }
finally { try { await browser?.close(); } catch {} try { await app?.close?.(); } catch {} await rm(dir, { recursive: true, force: true }).catch(() => {}); setTimeout(() => process.exit(process.exitCode || 0), 500); }
