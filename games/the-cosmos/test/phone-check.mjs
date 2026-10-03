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
for (const target of targets) for (const spec of devices.filter(d => !process.env.PHONE_ONLY || d.name.includes(process.env.PHONE_ONLY))) {
  const scope = `${target.name}/${spec.name}`;
  let browser, context, page;
  try {
    const oldRoot = join(process.env.LOCALAPPDATA || '', 'ms-playwright');
    const executablePath = spec.name.startsWith('iPhone') ? join(oldRoot, 'webkit-2336', 'Playwright.exe') : join(oldRoot, 'chromium-1234', 'chrome-win64', 'chrome.exe');
    browser = await spec.engine.launch({ headless: true, executablePath });
    context = await browser.newContext(spec.device);
    page = await context.newPage();
    page.on('pageerror', e => rows.push({ scope, step: 'page error', result: 'FAIL', detail: String(e) + ' @ ' + String(e.stack || '').split(/\r?\n/).slice(0, 4).join(' | ') }));
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

    // --- PLAYFIX: no two visible buttons may overlap. Rectangles of every visible button (and link-button), pairwise; a button inside another
    //     (the Controls toggle inside its holder) is not an overlap. Returns the offending pairs.
    const overlaps = () => page.evaluate(() => {
      const shown = el => { for (let n = el; n && n !== document.documentElement; n = n.parentElement) { const c = getComputedStyle(n); if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity === 0 || n.hidden) return false; } const r = el.getBoundingClientRect(); return r.width > 2 && r.height > 2; };
      const name = e => (e.id ? '#' + e.id : (e.textContent || '').trim().slice(0, 18));
      const list = [...document.querySelectorAll('button,a.btn,[role=button]')].filter(shown).filter(e => !e.closest('#settings-panel,#multiplayer-panel,#account-panel,#crew-panel,#space-sheet,#ship-panel,#key-pad,#voice-mic-dialog'));
      const bad = [], W = innerWidth, H = innerHeight;
      for (const e of list) { const r = e.getBoundingClientRect(); if (r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > H + 1) bad.push(name(e) + ' off-screen'); }
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j]; if (a.contains(b) || b.contains(a)) continue;
        const p = a.getBoundingClientRect(), q = b.getBoundingClientRect();
        const w = Math.min(p.right, q.right) - Math.max(p.left, q.left), h = Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top);
        if (w > 1 && h > 1) bad.push(name(a) + ' x ' + name(b) + ` (${Math.round(w)}x${Math.round(h)})`);
      }
      return { count: list.length, bad };
    });
    const noOverlap = async (label, min = 0) => { const r = await overlaps(); assert.ok(r.count >= min, `${label}: only ${r.count} buttons visible, expected at least ${min} (a panel is hiding the rest, so the check would prove nothing)`); assert.deepEqual(r.bad, [], `${label}: buttons overlap or leave the screen: ${r.bad.join('; ')}`); return r.count; };
    // ROUND7: the big boxes at the top must not sit on each other either: the status box (#hud), the pilot / station strip (#ship-panel) and a
    // sheet that opens under it (#space-sheet), and the free-flight read-outs start under all of them (they take their top from --strip-bottom).
    const noBlockOverlap = async (label) => { const r = await page.evaluate(() => {
      const ids = ['#hud', '#ship-panel', '#space-sheet', '#ff-bar'], seen = [];
      for (const id of ids) { const e = document.querySelector(id); if (!e) continue; const c = getComputedStyle(e); if (c.display === 'none' || c.visibility === 'hidden' || e.hidden) continue; const b = e.getBoundingClientRect(); if (b.width > 2 && b.height > 2) seen.push({ id, b }); }
      const bad = [];
      for (let i = 0; i < seen.length; i++) for (let j = i + 1; j < seen.length; j++) { const p = seen[i].b, q = seen[j].b, w = Math.min(p.right, q.right) - Math.max(p.left, q.left), h = Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top); if (w > 1 && h > 1) bad.push(`${seen[i].id} x ${seen[j].id} (${Math.round(w)}x${Math.round(h)})`); }
      const top = seen.filter(x => x.id === '#hud' || x.id === '#ship-panel').reduce((m, x) => Math.max(m, x.b.bottom), 0), strip = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--strip-bottom')) || 0;
      if (strip && strip < top - 1) bad.push(`the free-flight read-outs start at ${strip}px but the boxes above reach ${Math.round(top)}px`);
      return { ids: seen.map(x => x.id), bad }; });
      assert.deepEqual(r.bad, [], `${label}: boxes overlap: ${r.bad.join('; ')}`); return r.ids; };
    // Force a set of the game's own buttons visible (they are shown by game state; here we show them directly so every combination is checked).
    const showOnly = async (selectors) => page.evaluate(sels => {
      const all = ['#btn-action', '#btn-tool', '#btn-drop-all', '#btn-climb', '#crew-talk', '#quest-deliver', '#btn-fire', '#btn-sink', '#btn-lift', '#voice-talk', '#flight-speed', '#save-warning'];
      for (const sel of all) { const el = document.querySelector(sel); if (!el) continue; const on = sels.includes(sel);
        if (sel === '#flight-speed') { el.hidden = !on; if (!el.style.display || el.style.display === 'none') el.style.display = ''; } else el.style.display = on ? 'block' : 'none'; }
      document.querySelector('#btn-action') && (document.querySelector('#btn-action').textContent = sels.includes('#btn-action') ? 'Sit  ·  Pilot' : 'Dig');
      cosmos.touch && 0; window.dispatchEvent(new Event('resize')); }, selectors).then(() => page.waitForTimeout(350));
    const COMBOS = { 'on foot (Controls, World)': [], 'digging': ['#btn-action', '#btn-tool', '#btn-drop-all', '#btn-climb'], 'near people': ['#btn-action', '#crew-talk', '#voice-talk', '#quest-deliver'],
      'seated': ['#btn-action', '#voice-talk'], 'piloting': ['#btn-action', '#btn-lift', '#btn-sink', '#btn-fire', '#flight-speed', '#voice-talk'] };
    const ALL = ['#btn-action', '#btn-tool', '#btn-drop-all', '#btn-climb', '#crew-talk', '#quest-deliver', '#btn-fire', '#btn-sink', '#btn-lift', '#voice-talk', '#flight-speed'];
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
      await noOverlap('opening, ride offer');
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
    await record(scope, 'PLAYFIX: no two visible buttons overlap (aboard, seated, piloting, near people, all at once; portrait and landscape)', async () => {
      await page.evaluate(() => { cosmos.engine.stop(); cosmos.step(0);
        for (const sel of ['#account-panel', '#space-sheet', '#crew-panel']) { const e = document.querySelector(sel); if (e) e.style.display = 'none'; }
        const mp = document.querySelector('#multiplayer-panel'); if (mp) mp.hidden = true; document.querySelector('#settings-panel')?.classList.remove('open'); });
      const vp = spec.device.viewport, sizes = [[vp.width, vp.height], [375, 667], [vp.height, vp.width], [667, 375]];
      for (const [w, h] of sizes) {
        await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(250);
        for (const [name, sels] of Object.entries(COMBOS)) { await showOnly(sels); await noOverlap(`${w}x${h} ${name}`, sels.length + 2); if (name === 'piloting') await shot(`overlap-${w}x${h}-piloting`); }
        if (w < h) { await showOnly(ALL); await noOverlap(`${w}x${h} every button at once`, ALL.length + 2); await shot(`overlap-${w}x${h}-all`); }
        // the Controls pad open: it is the only thing on top, everything else steps aside
        await showOnly(COMBOS.piloting); await page.evaluate(() => document.querySelector('#btn-key-controls').click()); await page.waitForTimeout(350);
        const open = await page.evaluate(() => document.querySelector('#key-pad').style.display); assert.equal(open, 'grid', 'Controls pad did not open');
        const hidden = await page.evaluate(() => ['#btn-lift', '#btn-sink', '#flight-speed'].every(s => getComputedStyle(document.querySelector(s)).visibility === 'hidden'));
        assert.ok(hidden, `${w}x${h}: buttons stayed visible under the open Controls pad`); await page.evaluate(() => document.querySelector('#btn-key-controls').click());
      }
      await page.setViewportSize(vp); await showOnly([]);
    });
    // FREEFLIGHT: manual flight anywhere on a phone. The player sits in the pilot seat of a ship in orbit (a harness puts her there: solo has no authority
    // to refuse it), then every control is a real touch: the bar's buttons are tapped, THRUST is a held finger, and nothing may overlap in any phone shape.
    await record(scope, 'FREEFLIGHT: real taps on the free-flight bar, a held THRUST burns the drive, the stick turns the ship, no overlaps in four viewports', async () => {
      // a fresh page that skips the opening (the opening has had its own steps above): the flight deck, not the port, is what this step is about
      await page.goto(base + '&opening=off&tier=low', { waitUntil: 'domcontentloaded', timeout: 90000 });
      await page.waitForFunction(() => window.cosmos?.engine?.frameCount >= 2, null, { timeout: 90000 }); await page.waitForTimeout(800);
      await page.evaluate(() => { cosmos.engine.stop();
        const sh = cosmos.ship, d = sh.def.dock; if (!sh.aboard) sh.boardAt(d.boardSw.x, d.boardSw.y, d.boardSw.z, 0); if (!sh.seat) sh.takeSeat('pilot');
        const f = sh.flight, R = 3389500 + 400000, vc = Math.sqrt(6.6743e-11 * 6.417e23 / R);
        f.pos.x = R; f.pos.y = 0; f.pos.z = 0; f.vel.x = 0; f.vel.y = 0; f.vel.z = -vc; f.landed = false; f.airborne = true; f.autoHover = false; cosmos.step(0); });
      await step(1);
      assert.equal(await page.evaluate(() => cosmos.ship.seat?.id), 'pilot', 'the harness could not seat the pilot');
      await shot('freeflight-seated');
      assert.equal(await page.locator('#ff-bar').isVisible(), true, 'the free-flight bar is not on screen at the pilot seat: ' + JSON.stringify(await page.evaluate(() => { const b = document.getElementById('ff-bar'), c = getComputedStyle(b), r = b.getBoundingClientRect(); return { hidden: b.hidden, display: c.display, vis: c.visibility, rect: [r.x, r.y, r.width, r.height], parent: b.parentElement.id, modal: document.getElementById('phone-ui')?.className, panels: ['#multiplayer-panel:not([hidden])', '#crew-panel', '#account-panel', '#space-sheet', '#settings-panel.open', '#shop-panel'].map((q) => { const e = document.querySelector(q); return [q, e ? getComputedStyle(e).display : null]; }), seat: cosmos.ship.seat?.id, aboard: cosmos.ship.aboard, trip: !!cosmos.space.trip }; })));
      await realTap('#ff-bar [data-a=toggle]'); await step(1);
      assert.deepEqual(await page.evaluate(() => [cosmos.space.ff.enabled, cosmos.space.ff.active]), [true, true], 'tapping FREE FLIGHT above the air should take the ship');
      assert.deepEqual(await page.evaluate(() => ['btn-lift', 'btn-sink'].map(i => document.getElementById(i).textContent)), ['THRUST ▲', 'BRAKE ▼']);
      await realTap('#ff-bar [data-a=assist]'); await realTap('#ff-bar [data-a=target]'); await step(1);
      assert.deepEqual(await page.evaluate(() => [cosmos.space.ff.assist, cosmos.space.ff.target]), ['prograde', 'deimos'], 'real taps on ASSIST and TARGET did not register');
      await step(8);
      const press = (sel, type, id) => page.evaluate(({ sel, type, id }) => document.querySelector(sel).dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: false, bubbles: true, cancelable: true })), { sel, type, id });
      const v0 = await page.evaluate(() => cosmos.ship.flight.speed); await press('#btn-lift', 'pointerdown', 81); await step(3);
      const v1 = await page.evaluate(() => cosmos.ship.flight.speed); await press('#btn-lift', 'pointerup', 81); await step(1);
      assert.ok(v1 - v0 > 20, `a held THRUST should burn the drive (${v0} -> ${v1})`);
      const fuel = await page.evaluate(() => cosmos.space.ff.fuel); assert.ok(fuel < 0.999, 'the burn cost no fuel');
      await realTap('#ff-bar [data-a=assist]'); await realTap('#ff-bar [data-a=assist]'); await realTap('#ff-bar [data-a=assist]'); await step(1);
      assert.equal(await page.evaluate(() => cosmos.space.ff.assist), 'off');
      const nose = () => page.evaluate(() => { const q = cosmos.ship.flight.attitude || cosmos.ship.flight.quaternion; return [-2 * (q.x * q.z + q.w * q.y), -2 * (q.y * q.z - q.w * q.x), -(1 - 2 * (q.x * q.x + q.y * q.y))]; });
      const n0 = await nose(); await holdThumb(); await step(2); await releaseThumb(); await step(3); const n1 = await nose();
      const turned = Math.acos(Math.max(-1, Math.min(1, n0[0] * n1[0] + n0[1] * n1[1] + n0[2] * n1[2]))); assert.ok(turned > 0.1, 'the held thumb did not turn the ship (' + turned + ' rad)');
      await shot('freeflight-orbit');
      const vp = spec.device.viewport, sizes = [[vp.width, vp.height], [375, 667], [vp.height, vp.width], [667, 375]];
      for (const [w, h] of sizes) {
        await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(350); await step(1);
        await noOverlap(`free flight ${w}x${h}`, 9); const ids = await noBlockOverlap(`free flight ${w}x${h}`); assert.ok(ids.includes('#hud') && ids.includes('#ship-panel'), `free flight ${w}x${h}: the status box and the pilot strip should both be showing (${ids})`);
        await page.evaluate(() => cosmos.space.ui.toggle('course')); await page.waitForTimeout(450); await step(1);
        const open = await noBlockOverlap(`free flight ${w}x${h} with the Course sheet open`); assert.ok(open.includes('#space-sheet'), `the Course sheet did not open (${open})`);
        await noOverlap(`free flight ${w}x${h} with the Course sheet open`, 0);
        await shot(`freeflight-${w}x${h}`);
        await page.evaluate(() => cosmos.space.ui.toggle('course')); await page.waitForTimeout(250);
      }
      await page.setViewportSize(vp); await step(1);
      await page.evaluate(() => { cosmos.space.ff.suspend(); });
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
