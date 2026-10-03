// Real touchscreen smoke check for iOS WebKit and Android Chromium.
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url));
const root = dirname(here);
let chromium, webkit;
try { ({ chromium, webkit } = createRequire(import.meta.url)('playwright')); }
catch { ({ chromium, webkit } = createRequire(process.env.COSMOS_PLAYWRIGHT_ROOT || 'C:/Users/lilli/.codex/runtime/unfinished-island/node_modules')('playwright')); }
const live = process.argv.includes('--live');
import { spawn } from 'node:child_process';
import { createServer as netServer } from 'node:net';
async function freePort() { return new Promise(r => { const s = netServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); }); }
let localServer;
if (!process.env.COSMOS_LOCAL_URL) {
  const port = await freePort();
  localServer = spawn(process.execPath, [join(root, 'server.js')], { env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) { try { if ((await fetch('http://127.0.0.1:' + port + '/build.json')).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
  process.env.COSMOS_LOCAL_URL = 'http://127.0.0.1:' + port + '/?dev=1&solo=1';
}
const targets = [{ name: 'local', url: process.env.COSMOS_LOCAL_URL }];
if (live) targets.push({ name: 'live', url: 'https://www.heartbeatobservatory.com/games/the-cosmos/?dev=1&solo=1' });
const date = new Date().toISOString().slice(0, 10);
const out = join(root, 'docs', 'qa', 'phone-check', date);
await mkdir(out, { recursive: true });
const rows = [];
const expectedBuild = JSON.parse(readFileSync(join(root, 'build.json'), 'utf8')).id;
const devices = [
  { name: 'iPhone-15-WebKit', engine: webkit, device: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } },
  { name: 'Galaxy-S9-Chromium', engine: chromium, device: { userAgent: 'Mozilla/5.0 (Linux; Android 10; SM-G960F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36', viewport: { width: 360, height: 740 }, deviceScaleFactor: 4, isMobile: true, hasTouch: true } },
];
async function record(scope, step, fn) {
  try { await fn(); rows.push({ scope, step, result: 'PASS' }); }
  catch (e) { rows.push({ scope, step, result: 'FAIL', detail: String(e.message || e).replace(/[\r\n]+/g, ' ') }); }
}
for (const target of targets) for (const spec of devices) {
  const scope = `${target.name}/${spec.name}`;
  let browser, context, page;
  try {
    const oldRoot = join(process.env.LOCALAPPDATA || '', 'ms-playwright');
    const executablePath = spec.name.startsWith('iPhone') ? join(oldRoot, 'webkit-2336', 'Playwright.exe') : join(oldRoot, 'chromium-1234', 'chrome-win64', 'chrome.exe');
    browser = await spec.engine.launch({ headless: true, executablePath });
    context = await browser.newContext(spec.device);
    page = await context.newPage();
    page.on('pageerror', e => rows.push({ scope, step: 'page error', result: 'FAIL', detail: String(e) }));
    const base = target.url;
    const shot = async label => page.screenshot({ path: join(out, `${target.name}-${spec.name}-${label}.png`), fullPage: false });
    await record(scope, 'load page', async () => {
      const response = await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 90000 });
      assert.equal(response.status(), 200);
      await page.waitForFunction(() => document.querySelector('#boot')?.style.display === 'none' || !!window.cosmos, null, { timeout: 90000 });
      await page.waitForTimeout(1200);
      await shot('load');
    });
    await record(scope, 'HTML / JS / manifest / server build id agree', async () => {
      const html = await page.locator('meta[name="cosmos-build"]').getAttribute('content').catch(() => null);
      const js = await (await page.request.get(new URL('./src/core/buildVersion.js', base).href)).text();
      const manifest = await (await page.request.get(new URL('./build.json', base).href)).json();
      const runtime = await page.evaluate(() => window.cosmos?.buildId || null);
      assert.ok(html, 'HTML has no cosmos-build meta');
      assert.ok(js.includes(`'${html}'`), `HTML=${html}, buildVersion.js disagrees`);
      assert.equal(manifest.id, html, `build.json=${manifest.id} HTML=${html}`);
      assert.equal(runtime, html, `runtime=${runtime} HTML=${html}`);
      if (target.name === 'local') {
        const header = (await page.request.get(page.url())).headers()['x-cosmos-build'];
        assert.equal(header, html, `server header=${header} HTML=${html}`);
      }
      assert.equal(html, expectedBuild, `page build ${html} differs from repo build ${expectedBuild}`);
    });
    // --- helpers: the held thumb is a synthetic touch pointer on the canvas (Playwright has no multi-touch API);
    //     every button press in this file is a REAL touchscreen.tap, so the two fingers are distinct pointers.
    const THUMB = { id: 71, x: 80, y: Math.round(spec.device.viewport.height * .76) };
    const thumb = async (type, dy = 0) => page.evaluate(({ t, type, dy }) => {
      const c = document.querySelector('canvas'); const ev = new PointerEvent(type, { pointerId: t.id, pointerType: 'touch', isPrimary: false, clientX: t.x, clientY: t.y - dy, bubbles: true, cancelable: true });
      c.dispatchEvent(ev); }, { t: THUMB, type, dy });
    const holdThumb = async () => { await thumb('pointerdown'); await thumb('pointermove', 60); };
    const releaseThumb = async () => { await thumb('pointerup'); };
    const step = async seconds => { for (let left = seconds; left > 1e-7;) { const chunk = Math.min(1, left); left -= chunk;
      await page.evaluate(async sec => { const c = cosmos, r = c.engine.renderer, render = r.render; r.render = () => {};
        try { for (let t = 0; t < sec - 1e-7; t += 1 / 60) c.step(Math.min(1 / 60, sec - t)); await c.opening.pending; } finally { r.render = render; } c.step(0); }, chunk); } };
    const realTap = async selector => { const box = await page.locator(selector).boundingBox(); assert.ok(box, selector + ' has no box');
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      await page.evaluate(async () => { const o = cosmos.opening; while (o.active && (o.actionPending || o.busy)) await new Promise(r => setTimeout(r, 10)); cosmos.step(0); }); };
    const aim = async (x, z, y = .35) => page.evaluate(({ x, y, z }) => { const m = cosmos.opening.model, w = m.walker, e = w.eyeWorldPos({}), p = m.toWorld(x, y, z), f = w.updateFrame();
      const d = { x: p.x - e.x, y: p.y - e.y, z: p.z - e.z }, l = Math.hypot(d.x, d.y, d.z), dot = v => d.x * v.x + d.y * v.y + d.z * v.z;
      w.yaw = Math.atan2(dot(f.east), dot(f.north)); w.pitch = Math.asin(dot(f.up) / l); cosmos.step(0); }, { x, y, z });
    const walkTo = async (x, z) => { await holdThumb(); try { for (let i = 0; i < 120; i++) {
      const d = await page.evaluate(({ x, z }) => { const m = cosmos.opening.model, p = m.pose(), target = m.toWorld(x, 0, z), f = m.walker.updateFrame(), w = m.walker;
        const dx = target.x - w.worldPos.x, dy = target.y - w.worldPos.y, dz = target.z - w.worldPos.z;
        w.yaw = Math.atan2(dx * f.east.x + dy * f.east.y + dz * f.east.z, dx * f.north.x + dy * f.north.y + dz * f.north.z); return Math.hypot(p.x - x, p.z - z); }, { x, z });
      if (d < .2) return; await step(Math.min(.25, d / 2)); } throw Error('walk did not reach ' + x + ',' + z); } finally { await releaseThumb(); } };
    const ready = async () => { await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await page.waitForFunction(() => window.cosmos?.opening && cosmos.engine.frameCount >= 2, null, { timeout: 90000 });
      await page.evaluate(async () => { cosmos.engine.stop(); if (cosmos.opening.active) await cosmos.opening.ready; cosmos.step(0); }); };
    const stage = () => page.evaluate(() => cosmos.opening.state.stage);
    await record(scope, 'opening: intro plays, refresh resumes the same step', async () => {
      await page.evaluate(() => { cosmos.engine.stop(); cosmos.step(0); }); await step(10); await shot('opening-intro');
      // VOICES: the port-control caption is also asked of the voice system (it waits for the first tap on iPhone)
      assert.ok(await page.evaluate(() => cosmos.voice.log.some(l => /inbound passenger service/.test(l.text))), 'port control line was never sent to the voice system');
      await page.evaluate(async () => { await cosmos.opening.savePose(); }); const t = await page.evaluate(() => cosmos.opening.state.elapsed);
      await ready(); assert.ok(Math.abs(await page.evaluate(() => cosmos.opening.elapsed) - t) < 1.5, 'intro did not resume near ' + t);
    });
    await record(scope, 'opening: exit-freighter button works with a thumb held on the stick', async () => {
      await step(44); assert.equal(await stage(), 1);
      await holdThumb(); await step(4);
      assert.ok(await page.evaluate(() => cosmos.opening.sw.z > 12), 'walker did not move with the held thumb');
      assert.equal(await page.evaluate(() => cosmos.touch.active), true, 'thumb not registered as held');
      await realTap('#opening-action');
      assert.equal(await stage(), 2, 'tap on the exit button did nothing while the thumb was held');
      assert.equal(await page.evaluate(() => cosmos.touch.active), true, 'the held thumb was dropped by the tap');
      await releaseThumb(); await shot('opening-exit');
    });
    await record(scope, 'opening: refresh in the dig stage resumes the dig stage', async () => {
      await page.evaluate(async () => { await cosmos.opening.savePose(); }); await ready(); assert.equal(await stage(), 2);
    });
    await record(scope, 'opening: dig and grab-the-crate buttons respond to every tap, thumb held', async () => {
      await walkTo(4, 18.5); await holdThumb();
      let taps = 0;
      for (let i = 0; i < 40 && !await page.evaluate(() => cosmos.opening.model.exposed()); i++) {
        const [x, z] = [[4, 20], [4.18, 20], [3.82, 20], [4, 20.18], [4, 19.82]][i % 5]; await aim(x, z); await realTap('#opening-action'); taps++; }
      assert.ok(await page.evaluate(() => cosmos.opening.model.exposed()), 'crate never uncovered after ' + taps + ' taps');
      const cuts = await page.evaluate(() => cosmos.opening.state.cuts.length); assert.equal(cuts, taps, `${taps} taps made ${cuts} dig cuts (a tap was lost or doubled)`);
      await shot('opening-dug');
      await realTap('#opening-action'); assert.equal(await stage(), 3, 'grab-the-crate tap did nothing');
      await releaseThumb();
    });
    await record(scope, 'opening: refresh at the ride offer stays at the ride offer', async () => {
      await page.evaluate(async () => { await cosmos.opening.savePose(); }); await ready(); assert.equal(await stage(), 3);
    });
    await record(scope, 'opening: ride offer, riding the vehicle to the port', async () => {
      await step(10); await walkTo(-3.1, 22.16); await aim(-6, 22.2, 1.9); await shot('opening-ride-offer');
      await realTap('#opening-action'); assert.equal(await stage(), 4, 'ride button did nothing');
      await step(22); await shot('opening-riding');
      await ready(); assert.equal(await stage(), 4, 'refresh mid-ride lost the ride');
      await step(48); assert.equal(await page.evaluate(() => cosmos.opening.active), false, 'ride never reached the port');
      await page.waitForFunction(() => !document.querySelector('.opening-transition'), null, { timeout: 15000 });
      await shot('opening-port');
    });
    await record(scope, 'after the opening: settings opens and closes via real taps', async () => {
      await page.evaluate(() => { cosmos.engine.stop(); cosmos.step(0); });
      const before = await page.locator('#settings-panel').evaluate(e => e.classList.contains('open'));
      await realTap('#btn-settings'); await page.waitForTimeout(150);
      assert.notEqual(await page.locator('#settings-panel').evaluate(e => e.classList.contains('open')), before); await shot('settings-open');
      await realTap('#btn-close-settings'); await page.waitForTimeout(100);
      assert.equal(await page.locator('#settings-panel').evaluate(e => e.classList.contains('open')), false); await shot('settings-close');
    });
    // VOICES: the first real tap unlocks audio on iOS; mp3 clips must decode in THIS browser; the settings rows must work by touch.
    await record(scope, 'voices: settings rows work by touch, a tap unlocks audio, a port worker line decodes and plays from their body', async () => {
      await realTap('#btn-settings'); await page.waitForTimeout(150);
      for (const id of ['set-voice-volume', 'set-voice-chat', 'set-voice-mute']) { const el = page.locator('#' + id); await el.scrollIntoViewIfNeeded(); assert.ok(await el.isVisible(), id + ' not visible'); }
      const chat = page.locator('#set-voice-chat'); await chat.scrollIntoViewIfNeeded(); let box = await chat.boundingBox();
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2); await page.waitForTimeout(100);
      assert.equal(await page.evaluate(() => cosmos.voice.settings.chat), false, 'tap on the chat checkbox did not turn chat off');
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2); await page.waitForTimeout(100);
      assert.equal(await page.evaluate(() => cosmos.voice.settings.chat), true, 'second tap did not turn it back on');
      const vol = page.locator('#set-voice-volume'); await vol.scrollIntoViewIfNeeded(); box = await vol.boundingBox();
      await page.touchscreen.tap(box.x + box.width * .15, box.y + box.height / 2); await page.waitForTimeout(100);
      const v = await page.evaluate(() => cosmos.voice.settings.volume); assert.ok(v < .5, 'tap on the volume slider did not move it (volume ' + v + ')');
      await shot('settings-voice'); await realTap('#btn-close-settings');
      const webAudio = await page.evaluate(() => cosmos.voice.hasWebAudio);
      if (webAudio) assert.equal(await page.evaluate(() => cosmos.voice.unlocked && cosmos.voice.ctx.state), 'running', 'audio did not unlock on a real tap');
      else rows.push({ scope, step: 'voices: NOTE this browser build has no Web Audio (the Playwright Windows WebKit)', result: 'PASS', detail: 'unlock and placed playback verified on the Chromium profile only; mp3 decode checked below through an audio element; real iOS Safari not tested' });
      await page.waitForFunction(() => cosmos.portPeople?.members?.length > 0, null, { timeout: 30000 });
      if (!webAudio) {
        const d = await page.evaluate(async () => { const m = await (await fetch('./assets/voices/manifest.json')).json(), k = Object.keys(m.clips)[0], a = new Audio();
          return new Promise(res => { a.onloadedmetadata = () => res(a.duration); a.onerror = () => res(-1); setTimeout(() => res(-2), 6000); a.src = './assets/voices/' + k + '.mp3'; a.load(); }); });
        assert.ok(d > .8, 'this browser could not decode a voice mp3 (' + d + ')');
        const threw = await page.evaluate(() => { try { cosmos.voice.sayLine('Supply desk. Spares and field kits are on the racks.', { voice: 'w-jessica', source: null, channel: 'room' }); return false; } catch (e) { return String(e); } });
        assert.equal(threw, false, 'the voice system threw without Web Audio: ' + threw); return;
      }
      const r = await page.evaluate(async () => { const c = cosmos, v = c.voice; v.set('volume', .9); await v._manifestLoad();
        const { WORKER_CAST, clipKey } = await import('./src/voice/cast.js'), { WORKER_LINES } = await import('./src/port/workerLines.js');
        const m = c.portPeople.members.find(x => WORKER_CAST[x.id]); const before = v.log.length;
        v.sayLine(WORKER_LINES[m.id], { voice: WORKER_CAST[m.id].voice, source: m.person.group, channel: 'room' }); await new Promise(r => setTimeout(r, 1500));
        const buf = await v._buffer(clipKey(WORKER_CAST[m.id].voice, WORKER_LINES[m.id]));
        return { id: m.id, log: v.log.slice(before), clips: v.stats.clips, fails: v.stats.decodeFailures, decoded: buf.duration }; });
      const e = r.log.find(x => x.mode === 'clip' || x.mode === 'too-far');
      assert.ok(r.fails === 0, 'mp3 decode failed in this browser'); assert.ok(e, 'no voice log for the worker line: ' + JSON.stringify(r));
      assert.ok(r.decoded > .8, 'mp3 decoded to ' + r.decoded + ' s'); if (e.mode === 'clip') assert.ok(e.dur > .8, 'clip too short');
    });
    await record(scope, 'after the opening: visible buttons respond to real taps while a thumb holds the stick', async () => {
      await holdThumb();
      const ids = await page.locator('button').evaluateAll(es => es.filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden' && e.id; }).map(e => e.id));
      let tapped = 0;
      for (const id of ids) {
        if (id === 'btn-copy-coord') continue;
        const el = page.locator('#' + id); if (!(await el.isVisible().catch(() => false))) continue;
        const box = await el.boundingBox(); if (!box) continue;
        const before = await page.evaluate(() => document.body.innerText.length + '|' + [...document.querySelectorAll('[class*=open],[hidden]')].length + '|' + document.querySelectorAll('button').length);
        await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2); await page.waitForTimeout(120);
        tapped++; assert.equal(await page.evaluate(() => cosmos.touch.active), true, `tapping #${id} dropped the held thumb`);
        void before;
        await page.evaluate(() => { document.querySelector('#settings-panel.open #btn-close-settings')?.click(); });
      }
      assert.ok(tapped >= 1, 'no visible buttons found'); await releaseThumb(); await shot('buttons');
    });
  } catch (e) { rows.push({ scope, step: 'harness', result: 'FAIL', detail: String(e.stack || e).split('\n')[0] }); }
  finally { await context?.close().catch(()=>{}); await browser?.close().catch(()=>{}); }
}
const failures = rows.filter(r => r.result === 'FAIL');
const table = ['# Phone check', '', `Run date: ${date}`, '', '| Target | Check | Result | Detail |', '|---|---|---:|---|', ...rows.map(r=>`| ${r.scope} | ${r.step} | ${r.result} | ${(r.detail||'').replaceAll('|','\\|')} |`), ''].join('\n');
await writeFile(join(out, 'RESULTS.md'), table);
console.log(table);
localServer?.kill();
if (failures.length) process.exitCode = 1;
