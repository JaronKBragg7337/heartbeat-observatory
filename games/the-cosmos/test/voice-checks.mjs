// Voices: the cast, the clip library, the proximity rules and the signalling relay. Run from test/validate.mjs.
// Real audio cannot be heard headless: what is checked here is that every spoken line HAS a clip, that clips decode as mp3 of a
// believable length, that the right voice is chosen, and that the handshake reaches the other player and nobody else.
import { readFileSync, existsSync, statSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { startServer } from '../server/index.mjs';
import { FileAdapter } from '../server/storage.mjs';
import { relayVoice } from '../server/voiceRelay.mjs';
import { TestClient } from './multiplayer-checks.mjs';
import { VOICES, WORKER_CAST, BODY_KIND, CREW_VOICE, clipKey, spokenText, hash53, voiceForName } from '../src/voice/cast.js';
import { allLines } from '../src/voice/lines.js';
import { scanGroup } from '../tools/scan-lines.mjs';
import { distanceGain, HEARD_M } from '../src/voice/voice.js';
import { wantConnection, chatGain, ENTER_M, LEAVE_M } from '../src/voice/proximity.js';
import { speakerOf, LINER_SCRIPT, worldDialogue } from '../src/opening/dialogue.js';
import { CREW_POSTS } from '../src/crew/crewSpec.js';
import { PORT_WORKERS } from '../src/port/portPeople.js';
import { TRADERS } from '../src/economy/catalog.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VDIR = join(ROOT, 'assets', 'voices');

export async function runVoiceChecks({ check, section }) {
  section('32. Voices: every spoken line has a voice, and people hear each other near them');
  const { lines, dynamic } = allLines(scanGroup);
  const manifest = existsSync(join(VDIR, 'manifest.json')) ? JSON.parse(readFileSync(join(VDIR, 'manifest.json'), 'utf8')) : { clips: {} };

  // --- the cast
  check('clip keys are stable and distinct per voice and line',
    clipKey('ada', 'Hello there.') === clipKey('ada', 'Ada: Hello there.') && clipKey('ada', 'Hello there.') !== clipKey('zuri', 'Hello there.') && hash53('x') === hash53('x') && clipKey('ada', 'Hello there.').length === 14);
  check('a "Channel watch:" sentence is not mistaken for a speaker prefix', spokenText('Channel watch: port frequency clear.') === 'Channel watch: port frequency clear.' && spokenText('Nav: A ridge ahead.') === 'A ridge ahead.');
  check('every voice names a Kokoro voice and a gender', Object.values(VOICES).every((v) => /^[abefhijpz][fm]_[a-z]+$/.test(v.kokoro) && ['f', 'm'].includes(v.gender)));
  const kok = join('C:/Users/lilli/.claude/voice/node_modules/kokoro-js/voices');
  if (existsSync(kok)) check('every cast Kokoro voice pack exists', Object.values(VOICES).every((v) => existsSync(join(kok, v.kokoro + '.bin'))));
  check('hired crew voices fit their Loft models (ada, sunita, zuri women; jorge, aoi, walter, isaiah men)',
    ['ada', 'sunita', 'zuri'].every((n) => VOICES[CREW_VOICE[n]].gender === 'f') && ['jorge', 'aoi', 'walter', 'isaiah'].every((n) => VOICES[CREW_VOICE[n]].gender === 'm') && BODY_KIND.walter === 'old');
  check('every hire candidate has a voice, and they are all different', CREW_POSTS.every((p) => voiceForName(p.name)) && new Set(CREW_POSTS.map((p) => VOICES[voiceForName(p.name)].kokoro)).size === CREW_POSTS.length);
  const ids = PORT_WORKERS.map((w) => w.id).sort(), cast = Object.keys(WORKER_CAST).sort();
  check('every port worker (tower, desks, traders) is cast, and nobody is cast who is not there', JSON.stringify(ids) === JSON.stringify(cast), ids.filter((i) => !cast.includes(i)).join(','));
  check('port workers have distinct voices, and a body kind that matches the voice gender',
    new Set(Object.values(WORKER_CAST).map((c) => c.voice)).size === cast.length && Object.values(WORKER_CAST).every((c) => (c.body === 'f') === (VOICES[c.voice].gender === 'f')));
  check('every trader and clerk line comes from the catalog, spoken by their own voice', Object.keys(TRADERS).every((id) => lines.some((l) => l.voice === WORKER_CAST[id].voice && l.text === TRADERS[id].greeting)));

  // --- the opening
  // (OPENING2: the speakers are found by the line itself, src/opening/dialogue.js speakerOf)
  const radioLine = LINER_SCRIPT.find((l) => l.voice === 'radio'), drv = worldDialogue('mars').drivers.none;
  check('opening captions map to speakers: radio, and the driver in their own crew voice, and a hint is nobody',
    !!radioLine && speakerOf(radioLine.text).voice === 'radio' && speakerOf(drv.greeting).source === 'driver' && speakerOf(drv.greeting).voice === drv.voice && speakerOf('Aim the shovel at the dust around the crate.') === null);

  // --- the library
  const missing = lines.filter((l) => !manifest.clips[clipKey(l.voice, l.text)]);
  check(`every static spoken line has a clip (${lines.length} lines, ${dynamic.length} templates with free numbers use the browser voice)`, missing.length === 0, missing.slice(0, 3).map((l) => l.voice + ': ' + l.text).join(' | ') + ` (${missing.length} missing; run node tools/gen-voices.mjs)`);
  const sizes = Object.values(manifest.clips), total = sizes.reduce((a, b) => a + b, 0);
  check(`clips are small compressed audio (${sizes.length} clips, ${(total / 1024).toFixed(0)} KB, largest ${Math.max(0, ...sizes)} B)`, sizes.length > 0 && Math.max(...sizes) < 90000 && total < 16 * 1024 * 1024);   // EARTH start world: 15 -> 16 MB (21 new clips, 0.5 MB); OPENING2: 14 -> 15 MB (about 80 new opening lines); WD-MOON: 12 -> 14 MB (the Moon adds ~135 voiced lines, about 1.3 MB; each clip is still small)
  const sample = Object.keys(manifest.clips).slice(0, 12);
  const mp3 = (k) => { const b = readFileSync(join(VDIR, k + '.mp3')); return (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) || b.slice(0, 3).toString() === 'ID3'; };
  check('clips are real mp3 files (frame sync or ID3), which iPhone Safari and Chrome both decode', sample.length > 0 && sample.every(mp3));
  check('no clip on disk is missing from the manifest, and none is zero length', Object.keys(manifest.clips).every((k) => existsSync(join(VDIR, k + '.mp3')) && statSync(join(VDIR, k + '.mp3')).size > 800));

  // --- proximity rules
  check('distance gain: full close, falling to silence at 45 m', distanceGain(0) === 1 && distanceGain(6) === 1 && distanceGain(20) < 1 && distanceGain(20) > 0.1 && distanceGain(HEARD_M) === 0 && distanceGain(80) === 0 && distanceGain(NaN) === 0 && distanceGain(10) > distanceGain(30));
  check('connect inside 40 m, hold to 50 m, drop beyond (no flapping at the edge)',
    wantConnection({ sameShip: false, dist: 39, connected: false }) && !wantConnection({ sameShip: false, dist: 45, connected: false }) && wantConnection({ sameShip: false, dist: 45, connected: true }) && !wantConnection({ sameShip: false, dist: 51, connected: true }) && ENTER_M < LEAVE_M);
  check('the same ship is one crew channel: connected and at full volume at any distance', wantConnection({ sameShip: true, dist: 500, connected: false }) && chatGain({ sameShip: true, dist: 500 }) === 1 && chatGain({ sameShip: false, dist: 500 }) === 0);

  // --- the relay, unit level
  const sent = [], send = (p, m) => sent.push({ p, m });
  const A = { playerId: 'a' }, B = { playerId: 'b' }, world = { sessions: new Map([['a', A], ['b', B], ['c', { playerId: 'c' }]]), state: { players: { a: {}, b: {}, c: { opening: { complete: false } } } } };
  check('the relay carries an offer from a to b and stamps the true sender', relayVoice(world, A, { to: 'b', data: { kind: 'offer', sdp: 'v=0' } }, send) && sent[0].p === B && sent[0].m.from === 'a');
  check('the relay refuses: unknown kinds, oversize, self, offline, and players still in the private opening',
    !relayVoice(world, A, { to: 'b', data: { kind: 'evil' } }, send) && !relayVoice(world, A, { to: 'b', data: { kind: 'offer', sdp: 'x'.repeat(13000) } }, send) &&
    !relayVoice(world, A, { to: 'a', data: { kind: 'bye' } }, send) && !relayVoice(world, A, { to: 'zz', data: { kind: 'bye' } }, send) && !relayVoice(world, A, { to: 'c', data: { kind: 'bye' } }, send) &&
    !relayVoice(world, { playerId: null }, { to: 'b', data: { kind: 'bye' } }, send));
  let delivered = 0; const t0 = 1e6; for (let i = 0; i < 300; i++) if (relayVoice(world, B, { to: 'a', data: { kind: 'ice', cand: {} } }, send, t0)) delivered++;
  check('a flood of handshake messages is rate limited', delivered <= 81 && delivered > 40, String(delivered));

  // --- the relay, over two real WebSocket clients to a real authority
  const dir = await mkdtemp(join(tmpdir(), 'cosmos-voice-')); let app, a, b, c;
  try {
    app = await startServer({ adapter: new FileAdapter(join(dir, 'world.json')), port: 0, tick: false });
    a = new TestClient(app.url, 'a'.repeat(48), 'Alpha'); b = new TestClient(app.url, 'b'.repeat(48), 'Beta'); c = new TestClient(app.url, 'c'.repeat(48), 'Gamma');
    await a.connect(); await b.connect(); await c.connect();
    const from = b.messages.length;
    a.send({ type: 'voice', to: b.id, data: { kind: 'offer', sdp: 'v=0 offer' } });
    const got = await b.wait((m) => m.type === 'voice', from);
    check('over real sockets: b receives a\'s offer, tagged with a\'s id', got.from === a.id && got.data.kind === 'offer' && got.data.sdp === 'v=0 offer');
    const cFrom = c.messages.length; b.send({ type: 'voice', to: a.id, data: { kind: 'answer', sdp: 'v=0 answer' } });
    await new Promise((r) => setTimeout(r, 150));
    check('over real sockets: the answer goes back to a, and a third player sees none of it', a.messages.some((m) => m.type === 'voice' && m.data.kind === 'answer' && m.from === b.id) && !c.messages.slice(cFrom).some((m) => m.type === 'voice'));
    a.send({ type: 'voice', to: b.id, data: { kind: 'ice', cand: { candidate: 'x' } } }); a.send({ type: 'voice', to: b.id, data: { kind: 'bogus' } });
    await new Promise((r) => setTimeout(r, 150));
    check('over real sockets: malformed handshake messages are dropped without closing the connection', a.socket.readyState === 1 && b.messages.filter((m) => m.type === 'voice' && m.data.kind === 'ice').length === 1 && !b.messages.some((m) => m.type === 'voice' && m.data.kind === 'bogus'));
  } finally { for (const x of [a, b, c]) x?.close(); await app?.close(); await rm(dir, { recursive: true, force: true }); }
}

export async function runVoiceBrowserChecks({ check, section }) {
  section('33. Voices in two real browsers (fake microphone): handshake, audio flowing, distance, mute');
  const resultFile = join(ROOT, 'docs/qa/2026-10-03/voices/browser-results.json');
  let output = '';
  const status = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(ROOT, 'test/voice-browser.mjs')], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    child.stdout.on('data', (d) => { output += d; process.stdout.write(d); }); child.stderr.on('data', (d) => { output += d; process.stderr.write(d); });
    child.on('error', reject); child.on('close', resolve);
  });
  check('voice browser scenario completes', status === 0, `exit ${status}`);
  if (status !== 0) return;
  const { results: r, errors } = JSON.parse(readFileSync(resultFile, 'utf8'));
  check('two players 3 m apart connect over WebRTC through the authority handshake, with no setup', r.connected);
  check('the mic is explained in plain words first, then asked for only after a tap on Allow', r.explained && r.micGranted);
  check('holding Talk on one browser puts real audio packets into the other (fake microphone)', r.audioFlowing, JSON.stringify(r.audioStats));
  check('and the other way round: the second player talks and the first hears (both handshake roles covered)', r.reverseAudio, JSON.stringify(r.reverseStats));
  check('the listener hears them close (full gain) and the speaker shows in the HUD', r.heardClose > 0.9 && r.hudShowsSpeaker);
  check('at 25 m they are quieter, at 60 m the connection drops and is silent', r.heardMid < r.heardClose && r.heardMid > 0 && r.droppedFar);
  check('on a phone-sized touch screen the Talk button is held by a real touch, the mic is explained, and audio reaches the other player', r.phoneTouchHold && /talk/i.test(r.phoneLabel), r.phoneLabel);
  check('mute my microphone stops Talk; chat off drops every connection and lets go of the microphone', r.muteStopsTalk && r.chatOffClosesAll && r.micReleased);
  check('on the same ship they connect at 60 m apart at full volume (the crew channel), and let go again when it ends', r.crewChannel > 0.95);
  check('NPC speech plays from the speaker\'s body: a panned clip decoded, 3D position set, silent past 45 m', r.npcPlaced);
  check('voice browser run had no page errors', errors.length === 0, errors.join(' | '));
}
