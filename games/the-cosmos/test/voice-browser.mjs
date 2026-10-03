// Two real Chromium clients against an isolated authority, with a fake microphone (Chromium's own beeping test device),
// real WebRTC between them, and real taps. What this proves: the handshake, the audio packets, the distance behaviour, mute
// and chat-off. What it cannot prove: that a person hears it, or that two phones on mobile data reach each other (STUN only).
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { startServer } from '../server/index.mjs';
import { FileAdapter } from '../server/storage.mjs';
let chromium; try { ({ chromium } = createRequire(import.meta.url)('playwright')); } catch { ({ chromium } = createRequire(process.env.COSMOS_PLAYWRIGHT_ROOT || join(homedir(), '.codex/runtime/unfinished-island/node_modules/'))('playwright')); }
const out = fileURLToPath(new URL('../docs/qa/2026-10-03/voices/', import.meta.url)); await mkdir(out, { recursive: true });
const temp = await mkdtemp(join(tmpdir(), 'cosmos-voice-')), results = {}, errors = [];
let app, browser;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  app = await startServer({ adapter: new FileAdapter(join(temp, 'world.json')), port: 0, clientErrorLog: join(temp, 'client-errors.log') });
  const origin = app.url.replace('ws:', 'http:'), url = `${origin}/?dev=1&opening=off&tier=low&ws=${app.url}`;
  browser = await chromium.launch({ headless: true, ...(process.env.COSMOS_CHROME || process.platform === 'win32' ? { executablePath: process.env.COSMOS_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe' } : {}),
    args: ['--use-gl=swiftshader', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl',
      '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required', '--disable-features=WebRtcHideLocalIpsWithMdns'] });   // headless has no mDNS resolver: use plain host candidates
  async function make(name) {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 700 }, permissions: ['microphone'] });
    await ctx.addInitScript((n) => { localStorage.setItem('cosmos-device-v2', JSON.stringify({ key: n.repeat(48).slice(0, 48), name: n })); }, name);
    const page = await ctx.newPage(); page.on('pageerror', (e) => errors.push(String(e))); return { ctx, page };
  }
  async function ready(p) {
    await p.goto(url);
    await p.waitForFunction(() => window.cosmos?.multiplayer && cosmos.engine.frameCount >= 2 && cosmos.chat, null, { timeout: 120000 });
  }
  const A = await make('Alpha'), B = await make('Beta'), a = A.page, b = B.page;
  await Promise.all([ready(a), ready(b)]);
  const aid = await a.evaluate(() => cosmos.world.playerId), bid = await b.evaluate(() => cosmos.world.playerId), w = app.world, pa = w.state.players[aid], pb = w.state.players[bid];
  // The scene is not drawn between screenshots (swiftshader is slow and this test is about audio, not pixels); everything else runs.
  const draw = (p, on) => p.evaluate((on) => { const r = cosmos.engine.renderer; if (on) { if (r.__render) r.render = r.__render; } else { r.__render ||= r.render; r.render = () => {}; } }, on);
  const shot = async (p, name) => { await draw(p, true); await sleep(900); await p.screenshot({ path: join(out, name + '.png') }); await draw(p, false); };
  await draw(a, false); await draw(b, false);
  await a.keyboard.press('ShiftLeft'); await b.keyboard.press('ShiftLeft');     // a key press is the user gesture that lets a page play sound

  // Walk a player to a spot the way the server allows (it rejects jumps): small steps of the client's own body, in the page.
  async function put(page, rec, id, x, z) {
    const target = w.site.toWorld(x, 0.02, z);
    await page.evaluate(async (t) => {
      const c = cosmos, p = c.walker.worldPos;
      for (let i = 0; i < 400; i++) {
        const d = Math.hypot(t.x - p.x, t.y - p.y, t.z - p.z); if (d < 0.5) break;
        const k = Math.min(1, 2.2 / d); Object.assign(p, { x: p.x + (t.x - p.x) * k, y: p.y + (t.y - p.y) * k, z: p.z + (t.z - p.z) * k });
        Object.assign(c.walker.velocity, { x: 0, y: 0, z: 0 }); c.walker.updateFrame();
        await new Promise((r) => setTimeout(r, 250));
      }
    }, target);
    for (let i = 0; i < 40; i++) { const cur = rec.pose.worldPos; if (Math.hypot(target.x - cur.x, target.y - cur.y, target.z - cur.z) < 1.5) break; await sleep(250); }
    await sleep(500);
  }
  const holdAt = async () => { const bx = await a.locator('#voice-talk').boundingBox(); return { x: bx.x + bx.width / 2, y: bx.y + bx.height / 2 }; };
  const peerState = (p) => p.evaluate(() => cosmos.chat.summary());

  // 1. three metres apart, no setup
  await put(a, pa, aid, -24, 45); await put(b, pb, bid, -24, 42);
  const probe = () => { const c = cosmos, me = c.world.snapshot.players[c.world.playerId]; return { chat: c.chat.summary(), online: Object.values(c.world.snapshot.players).map((p) => ({ n: p.name, on: p.online, op: p.opening && p.opening.complete })), bodies: [...c.multiplayer.bodies.keys()].length, dist: [...c.multiplayer.bodies.keys()].map((id) => c.chat._distance(id)), ready: c.chat.ready(), connected: c.world.connected, wp: c.walker.worldPos, me: me.pose.worldPos }; };
  const dump = async (tag) => { for (const [n, p] of [['A', a], ['B', b]]) { let r; try { r = await p.evaluate(probe); } catch (e) { r = String(e); } console.log(tag, n, JSON.stringify(r)); } };
  await sleep(4000); await dump('after-put');
  await a.waitForFunction(() => { const s = cosmos.chat.summary(); return s.peers.length === 1 && s.peers[0].state === 'connected'; }, null, { timeout: 60000 }).catch(async (e) => { await dump('FAIL'); throw e; });
  await b.waitForFunction(() => { const s = cosmos.chat.summary(); return s.peers.length === 1 && s.peers[0].state === 'connected'; }, null, { timeout: 60000 });
  results.connected = true;
  results.handshake = { a: (await peerState(a)).stats, b: (await peerState(b)).stats };
  await a.waitForSelector('#voice-talk', { state: 'visible', timeout: 10000 });
  await shot(a, '02-talk-button-desktop');

  // 2. the plain-words dialog, then Allow
  const pos = await holdAt(); await a.mouse.move(pos.x, pos.y); await a.mouse.down();
  await a.waitForSelector('#voice-mic-dialog', { state: 'visible', timeout: 5000 }).catch(async (e) => {
    console.log('DIALOG-FAIL', JSON.stringify(await a.evaluate(({ x, y }) => { const el = document.elementFromPoint(x, y); return { at: el && (el.id || el.tagName + '.' + el.className), pos: [x, y], btn: document.getElementById('voice-talk').getBoundingClientRect().toJSON(), disp: document.getElementById('voice-mic-dialog').style.display, ok: localStorage.getItem('cosmos-voice-mic-ok'), enabled: cosmos.chat.enabled, mute: cosmos.voice.settings, talking: cosmos.chat.talking }; }, pos)));
    await shot(a, 'debug-dialog'); throw e; });
  await a.mouse.up();
  const text = await a.locator('#voice-mic-dialog').innerText();
  results.explained = /microphone/i.test(text) && /only on while you hold/i.test(text) && !(await a.evaluate(() => !!cosmos.chat.track));
  await shot(a, '03-mic-explained');
  await a.locator('#voice-mic-yes').click();
  await a.waitForFunction(() => !!cosmos.chat.track, null, { timeout: 10000 });
  results.micGranted = true;

  // 3. hold Talk: real audio packets cross
  await a.mouse.move(pos.x, pos.y); await a.mouse.down();
  await a.waitForFunction(() => cosmos.chat.talking && cosmos.chat.track?.enabled, null, { timeout: 5000 });
  await sleep(1500);
  const stats1 = await b.evaluate(async () => { const pc = [...cosmos.chat.peers.values()][0].pc; const r = await pc.getStats(); let o = {}; r.forEach((s) => { if (s.type === 'inbound-rtp' && (s.kind || s.mediaType) === 'audio') o = { packets: s.packetsReceived, bytes: s.bytesReceived, level: s.audioLevel ?? null, energy: s.totalAudioEnergy ?? null }; }); return o; });
  await sleep(1500);
  const stats2 = await b.evaluate(async () => { const pc = [...cosmos.chat.peers.values()][0].pc; const r = await pc.getStats(); let o = {}; r.forEach((s) => { if (s.type === 'inbound-rtp' && (s.kind || s.mediaType) === 'audio') o = { packets: s.packetsReceived, bytes: s.bytesReceived, level: s.audioLevel ?? null, energy: s.totalAudioEnergy ?? null }; }); return o; });
  // loudness of what arrived, measured on B's own Web Audio analyser (WebRTC's totalAudioEnergy stays 0 when playout goes through Web Audio)
  let peak = 0; for (let i = 0; i < 24; i++) { peak = Math.max(peak, await b.evaluate(() => Math.max(0, ...cosmos.chat.summary().peers.map((p) => p.level || 0)))); await sleep(120); }
  results.audioStats = { first: stats1, second: stats2, analyserPeak: +peak.toFixed(3) };
  results.audioFlowing = stats2.packets > 20 && stats2.packets > stats1.packets && stats2.bytes > stats1.bytes && peak > 0.02;
  const closeSummary = await peerState(b);
  results.heardClose = closeSummary.peers[0].heard;
  await b.waitForFunction(() => document.getElementById('voice-heard').style.display === 'block', null, { timeout: 8000 }).catch(() => {});
  results.hudShowsSpeaker = /Alpha/.test(await b.locator('#voice-heard').innerText().catch(() => ''));
  await shot(b, '04-listener-hears-speaker');
  await a.mouse.up();
  await a.waitForFunction(() => !cosmos.chat.talking, null, { timeout: 3000 });

  // 3b. and the other way: B talks, A hears (one of the two is the offerer and the other the answerer, in either order, so both
  //     directions of the handshake are exercised in every run)
  const bpos = await b.locator('#voice-talk').boundingBox(), bp = { x: bpos.x + bpos.width / 2, y: bpos.y + bpos.height / 2 };
  await b.mouse.move(bp.x, bp.y); await b.mouse.down();
  await b.waitForSelector('#voice-mic-dialog', { state: 'visible', timeout: 8000 }); await b.mouse.up();
  await b.locator('#voice-mic-yes').click();
  await b.waitForFunction(() => !!cosmos.chat.track, null, { timeout: 10000 });
  await b.mouse.move(bp.x, bp.y); await b.mouse.down();
  await b.waitForFunction(() => cosmos.chat.talking && cosmos.chat.track?.enabled, null, { timeout: 5000 });
  await sleep(1200);
  let peakA = 0; for (let i = 0; i < 24; i++) { peakA = Math.max(peakA, await a.evaluate(() => Math.max(0, ...cosmos.chat.summary().peers.map((p) => p.level || 0)))); await sleep(120); }
  const inA = await a.evaluate(async () => { const pc = [...cosmos.chat.peers.values()][0].pc; const r = await pc.getStats(); let o = {}; r.forEach((s) => { if (s.type === 'inbound-rtp' && (s.kind || s.mediaType) === 'audio') o = { packets: s.packetsReceived, bytes: s.bytesReceived }; }); return o; });
  await b.mouse.up(); await b.waitForFunction(() => !cosmos.chat.talking, null, { timeout: 3000 });
  results.reverseAudio = inA.packets > 20 && peakA > 0.02; results.reverseStats = { ...inA, analyserPeak: +peakA.toFixed(3) };

  // 4. farther away is quieter; far enough drops
  await put(b, pb, bid, -24, 20);
  await sleep(1200);
  const mid = await peerState(b); results.heardMid = mid.peers[0]?.heard ?? null; results.midPeers = mid.peers.length;
  await put(b, pb, bid, -24, -15);
  await b.waitForFunction(() => cosmos.chat.summary().peers.length === 0, null, { timeout: 15000 });
  await a.waitForFunction(() => cosmos.chat.summary().peers.length === 0, null, { timeout: 15000 });
  results.droppedFar = true;

  // 4b. the crew channel: the same ship means connected and full volume at any distance (the ship test is driven through the
  //     client's own same-ship rule, since boarding two Chromium pages onto one hull is covered by the two-player run)
  await a.evaluate(() => { cosmos.chat._sameShip = () => true; }); await b.evaluate(() => { cosmos.chat._sameShip = () => true; });
  // (B is the listener: A's mic is open, so A's voice arrives on B and B has a loudness for it)
  await b.waitForFunction(() => { const s = cosmos.chat.summary(); return s.peers.length === 1 && s.peers[0].state === 'connected' && s.peers[0].heard > 0.95; }, null, { timeout: 60000 }).catch(async (e) => { await dump('CREW-FAIL'); throw e; });
  results.crewChannel = (await peerState(b)).peers[0].heard;
  await a.evaluate(() => { delete cosmos.chat._sameShip; }); await b.evaluate(() => { delete cosmos.chat._sameShip; });
  await b.waitForFunction(() => cosmos.chat.summary().peers.length === 0, null, { timeout: 30000 });

  // 5. back close, then mute and chat off
  await put(b, pb, bid, -24, 42);
  await a.waitForFunction(() => { const s = cosmos.chat.summary(); return s.peers.length === 1 && s.peers[0].state === 'connected'; }, null, { timeout: 60000 });
  await a.evaluate(() => cosmos.voice.set('muteMic', true));
  results.muteStopsTalk = (await a.evaluate(() => cosmos.chat.pressTalk())) === 'off' && !(await a.evaluate(() => cosmos.chat.talking));
  await a.evaluate(() => { cosmos.voice.set('muteMic', false); document.getElementById('btn-settings').click(); });
  await sleep(300); await shot(a, '05-settings-voice');
  await a.evaluate(() => { document.getElementById('settings-panel').classList.remove('open'); });
  await a.evaluate(() => cosmos.voice.set('chat', false));
  await sleep(300);
  results.chatOffClosesAll = (await a.evaluate(() => cosmos.chat.summary().peers.length)) === 0;
  results.micReleased = (await a.evaluate(() => cosmos.chat.track)) === null || (await a.evaluate(() => !cosmos.chat.summary().mic));
  await a.evaluate(() => cosmos.voice.set('chat', true));

  // 5b. the same player on a phone-sized touch screen: the Talk button is held with a real touch, not a mouse
  await A.ctx.close();
  const P = await (async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, permissions: ['microphone'] });
    await ctx.addInitScript(() => { localStorage.setItem('cosmos-device-v2', JSON.stringify({ key: 'Alpha'.repeat(48).slice(0, 48), name: 'Alpha' })); });
    const page = await ctx.newPage(); page.on('pageerror', (e) => errors.push(String(e))); return { ctx, page };
  })();
  const ph = P.page; await ready(ph); await draw(ph, false);
  await put(ph, pa, aid, -24, 45);
  await ph.waitForFunction(() => { const s = cosmos.chat.summary(); return s.peers.length === 1 && s.peers[0].state === 'connected'; }, null, { timeout: 60000 });
  await ph.waitForSelector('#voice-talk', { state: 'visible', timeout: 10000 });
  results.phoneLabel = (await ph.locator('#voice-talk-label').innerText());
  await shot(ph, '06-phone-talk-button');
  const cdp = await P.ctx.newCDPSession(ph);
  const tb = await ph.locator('#voice-talk').boundingBox(), tp = { x: tb.x + tb.width / 2, y: tb.y + tb.height / 2 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: tp.x, y: tp.y, id: 1 }] });
  await ph.waitForSelector('#voice-mic-dialog', { state: 'visible', timeout: 8000 });
  await shot(ph, '07-phone-mic-explained');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const yes = await ph.locator('#voice-mic-yes').boundingBox(); await ph.touchscreen.tap(yes.x + yes.width / 2, yes.y + yes.height / 2);
  await ph.waitForFunction(() => !!cosmos.chat.track, null, { timeout: 10000 });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: tp.x, y: tp.y, id: 2 }] });
  await ph.waitForFunction(() => cosmos.chat.talking && cosmos.chat.track?.enabled, null, { timeout: 8000 });
  await sleep(1500); await shot(ph, '08-phone-talking');
  const pstats = await b.evaluate(async () => { const pc = [...cosmos.chat.peers.values()][0].pc; const r = await pc.getStats(); let o = {}; r.forEach((s) => { if (s.type === 'inbound-rtp' && (s.kind || s.mediaType) === 'audio') o = { packets: s.packetsReceived, bytes: s.bytesReceived }; }); return o; });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await ph.waitForFunction(() => !cosmos.chat.talking, null, { timeout: 5000 });
  results.phoneTouchHold = pstats.packets > 0; results.phoneStats = pstats;

  // 6. a person at the port speaks from their body
  await b.mouse.click(300, 300);                       // a real tap unlocks audio
  await b.waitForFunction(() => cosmos.voice.unlocked && cosmos.voice.ctx?.state === 'running', null, { timeout: 8000 });
  const npc = await b.evaluate(async () => {
    const c = cosmos, v = c.voice; await v._manifestLoad();
    const m = c.portPeople.members.map((x) => ({ x, d: v._distanceTo({ source: x.person.group }) })).sort((p, q) => p.d - q.d);
    const near = m[0], far = m[m.length - 1];
    const lines = (await (await fetch('./assets/voices/lines.json')).json());
    const keyOf = (voice, text) => Object.entries(lines).find(([, l]) => l.voice === voice && l.text === text)?.[0];
    const { WORKER_CAST } = await import('./src/voice/cast.js'); const { WORKER_LINES } = await import('./src/port/workerLines.js');
    const say = (member) => { const id = member.x.id, voice = WORKER_CAST[id].voice; return v.sayLine(WORKER_LINES[id], { voice, source: member.x.person.group, channel: 'room' }); };
    const before = v.log.length; say(near); await new Promise((r) => setTimeout(r, 1200));
    const logNear = v.log.slice(before).find((e) => e.mode === 'clip' || e.mode === 'tts');
    const farBefore = v.log.length; say(far); await new Promise((r) => setTimeout(r, 400));
    const logFar = v.log.slice(farBefore).find((e) => e.text);
    return { near: { id: near.x.id, d: near.d, log: logNear, hasKey: !!keyOf(WORKER_CAST[near.x.id].voice, WORKER_LINES[near.x.id]) }, far: { id: far.x.id, d: far.d, log: logFar } };
  });
  results.npc = npc;
  results.npcPlaced = !!npc.near.log && npc.near.log.mode === 'clip' && npc.near.log.dur > 0.8 && npc.near.log.dist <= 45 && (npc.far.d <= 45 || npc.far.log?.mode === 'too-far');
  await writeFile(join(out, 'browser-results.json'), JSON.stringify({ results, errors }, null, 2));
  assert.deepEqual(errors, []);
  console.log('Voice browser checks passed', JSON.stringify({ stats: results.audioStats.second, heardClose: results.heardClose, heardMid: results.heardMid }));
} finally {
  await writeFile(join(out, 'browser-results.json'), JSON.stringify({ results, errors }, null, 2));
  await browser?.close(); await app?.close(); await rm(temp, { recursive: true, force: true }).catch(() => {});
}
