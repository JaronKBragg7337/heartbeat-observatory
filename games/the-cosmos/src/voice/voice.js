// ============================================================================
// voice.js - people talk. Every line a person says on screen is also spoken, from that person, in their own voice.
//
// HOW: lines are pre-generated as small mp3 clips (tools/gen-cosmos-voices.mjs, Kokoro-82M, free licence) and stored under
// assets/voices/<hash>.mp3, where hash = clipKey(voice, text). This file looks the clip up, decodes it once, and plays it
// through a Web Audio PannerNode that follows the speaker's body, so it comes from where they stand and fades out with
// distance. A line with no clip (numbers that change: "Contact at 412 metres") falls back to the browser's own
// speechSynthesis: still spoken, still in a voice of the right gender, but not placed in space. Subtitles are never touched.
//
// iPhone: audio only starts after a tap, so unlock() runs on the first pointerdown/touchend/keydown. The iOS silent switch
// mutes Web Audio unless the page asks for a "playback" audio session, which we do where Safari supports it.
// ============================================================================
import { VOICES, voiceForName, clipKey, spokenText } from './cast.js';

const KEY = 'cosmos-voice-v1';
export const HEARD_M = 45;          // nobody is heard past this (metres)
const FULL_M = 6;                   // full volume inside this
const MAX_VOICES = 4;
const LEAD = /^(Ada|Zuri|Jorge|Aoi|Sunita|Walter|Isaiah):\s+(.+)$/s;

export function loadVoiceSettings(storage = globalThis.localStorage) {
  const d = { volume: 0.9, chat: true, muteMic: false };
  try { return { ...d, ...JSON.parse(storage.getItem(KEY) || '{}') }; } catch { return d; }
}
export function saveVoiceSettings(s, storage = globalThis.localStorage) { try { storage.setItem(KEY, JSON.stringify(s)); } catch { /* storage may be blocked */ } }

/** Volume for a listener this far from a talker: 1 close, falling to 0 at HEARD_M. */
export function distanceGain(d) {
  if (!(d >= 0)) return 0;
  if (d <= FULL_M) return 1;
  if (d >= HEARD_M) return 0;
  const t = (d - FULL_M) / (HEARD_M - FULL_M);
  return (1 - t) * (1 - t);
}

export class VoiceSystem {
  /** o: { camera, base: URL prefix for assets/voices/, resolveSpeaker(name) -> Object3D|null } */
  constructor(o = {}) {
    this.camera = o.camera || null;
    this.base = o.base || './assets/voices/';
    this.resolveSpeaker = o.resolveSpeaker || (() => null);
    this.settings = loadVoiceSettings();
    this.ctx = null; this.master = null;
    this.manifest = null; this._manifestP = null;
    this.buffers = new Map(); this.loading = new Map();
    this.active = [];
    this.pending = null;             // a line asked for before the first tap
    this.log = [];                   // the last 60 lines asked for, for tests and review
    this.stats = { clips: 0, tts: 0, dropped: 0, decodeFailures: 0 };
    this.unlocked = false;
    this.hasWebAudio = typeof window !== 'undefined' && !!(window.AudioContext || window.webkitAudioContext);
    this._tmp = { x: 0, y: 0, z: 0 };
    this._lastLine = new Map(); this._lastLoad = new Map();
    this.listeners = new Set();
    this._wireUnlock();
  }

  // ---- settings --------------------------------------------------------------------------------------------
  set(key, value) {
    this.settings[key] = value; saveVoiceSettings(this.settings);
    if (key === 'volume' && this.master) this.master.gain.value = this._level();
    for (const fn of this.listeners) fn(key, value);
  }
  _level() { const v = Math.max(0, Math.min(1, Number(this.settings.volume))); return v * v * 1.15; }

  // ---- unlock: iOS and every browser need a tap before sound ------------------------------------------------------
  _wireUnlock() {
    if (typeof window === 'undefined') return;
    const go = () => { this.unlock(); };
    for (const ev of ['pointerdown', 'touchend', 'click', 'keydown']) window.addEventListener(ev, go, { capture: true, passive: true });
  }
  unlock() {
    if (this.unlocked && this.ctx?.state === 'running') return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* older Safari */ }
      if (!this.ctx) {
        this.ctx = new AC({ latencyHint: 'interactive' });
        this.master = this.ctx.createGain(); this.master.gain.value = this._level();
        const comp = this.ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
        this.master.connect(comp); comp.connect(this.ctx.destination);
        // a silent one-sample buffer inside the gesture is what wakes iOS up
        const b = this.ctx.createBuffer(1, 1, 22050), s = this.ctx.createBufferSource(); s.buffer = b; s.connect(this.ctx.destination); s.start(0);
        try { window.speechSynthesis?.getVoices?.(); } catch { /* none */ }
      }
      this.ctx.resume?.().catch(() => {});
      this.unlocked = true;
      this._manifestLoad();
      if (this.pending && performance.now() - this.pending.at < 6000) { const p = this.pending; this.pending = null; this.sayLine(p.text, p.o); }
      this.pending = null;
      return true;
    } catch { return false; }
  }

  // ---- clips ---------------------------------------------------------------------------------------------------
  _manifestLoad() {
    if (!this._manifestP) {
      this._manifestP = fetch(this.base + 'manifest.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : { clips: {} })
        .then(j => { this.manifest = j.clips || {}; return this.manifest; }).catch(() => { this.manifest = {}; return this.manifest; });
    }
    return this._manifestP;
  }
  hasClip(voice, text) { return !!(this.manifest && this.manifest[clipKey(voice, text)]); }
  async _buffer(key) {
    if (this.buffers.has(key)) return this.buffers.get(key);
    if (this.loading.has(key)) return this.loading.get(key);
    const p = (async () => {
      const r = await fetch(this.base + key + '.mp3'); if (!r.ok) throw Error('clip ' + r.status);
      const data = await r.arrayBuffer();
      const buf = await new Promise((ok, no) => { const q = this.ctx.decodeAudioData(data, ok, no); q?.then?.(ok, no); });
      this.buffers.set(key, buf); if (this.buffers.size > 80) this.buffers.delete(this.buffers.keys().next().value);
      return buf;
    })().finally(() => this.loading.delete(key));
    this.loading.set(key, p); return p;
  }
  /** Fetch and decode lines before they are needed (the opening does this while it loads). */
  async preload(lines) {
    if (!this.ctx) return;
    await this._manifestLoad();
    await Promise.all(lines.map(({ voice, text }) => { const k = clipKey(voice, text); return this.manifest[k] ? this._buffer(k).catch(() => {}) : null; }));
  }

  // ---- speaking --------------------------------------------------------------------------------------------------
  /** A person in the ship log: "Ada: Down at Pad 01." Anything else is the ship itself, voiced only if it has a clip. */
  onNote(msg) {
    const m = LEAD.exec(String(msg));
    if (m) { const voice = voiceForName(m[1]); if (voice) return this.sayLine(m[2], { voice, source: this.resolveSpeaker(m[1]), channel: 'room' }); }
    const ship = { voice: 'ship', source: null, channel: 'flat', clipOnly: true };
    if (this.manifest) { if (this.hasClip('ship', msg)) return this.sayLine(msg, ship); }
    else if (this.unlocked) this._manifestLoad().then(() => { if (this.hasClip('ship', msg)) this.sayLine(msg, ship); });
  }
  /** o: { voice, source: Object3D|null, channel: 'room' (placed in space) | 'radio' | 'flat', clipOnly } */
  sayLine(text, o = {}) {
    const line = spokenText(text); if (!line || !VOICES[o.voice]) return false;
    const now = performance.now();
    const dupKey = o.voice + '|' + line;
    if (now - (this._lastLine.get(dupKey) || -1e9) < 2500) return false;
    this._lastLine.set(dupKey, now);
    if (!this.hasWebAudio) {                       // no Web Audio at all (a very old or stripped browser): the browser's own voice, unplaced
      if (o.clipOnly) return false;
      this._note({ voice: o.voice, text: line, mode: 'no-web-audio' });
      this._tts(line, o, this._distanceTo(o)); return true;
    }
    if (!this.unlocked || !this.ctx) { this.pending = { text, o, at: now }; this._note({ voice: o.voice, text: line, mode: 'waiting-for-tap' }); return false; }
    if (this.ctx.state !== 'running') this.ctx.resume?.().catch(() => {});
    const dist = this._distanceTo(o);
    if (o.channel === 'room' && dist > HEARD_M) { this.stats.dropped++; this._note({ voice: o.voice, text: line, mode: 'too-far', dist }); return false; }
    this._manifestLoad().then(() => {
      const key = clipKey(o.voice, line);
      if (this.manifest[key]) {
        const load = this._buffer(key), prior = o.queue ? (this._lastLoad.get(o.voice) || Promise.resolve()) : Promise.resolve();
        this._lastLoad.set(o.voice, load.catch(() => {}));
        Promise.all([load, prior]).then(([buf]) => this._play(buf, line, o, key), () => { this.stats.decodeFailures++; if (!o.clipOnly) this._tts(line, o, dist); });
      } else if (!o.clipOnly) this._tts(line, o, dist);
    });
    return true;
  }
  _note(e) { this.log.push({ t: Math.round(performance.now()), ...e }); if (this.log.length > 60) this.log.shift(); for (const fn of this.listeners) fn('line', e); }
  _distanceTo(o) {
    if (!o.source || !this.camera) return 0;
    const v = this._rel(o.source); return Math.hypot(v.x, v.y, v.z);
  }
  /** Vector from the camera to the speaker, in the camera's own frame (x right, y up, -z ahead). */
  _rel(obj) {
    const p = this._tmp, cam = this.camera, V = obj.position.constructor;
    obj.getWorldPosition(this._v ||= new V());
    cam.getWorldPosition(this._c ||= new V());
    this._v.sub(this._c); this._q ||= new cam.quaternion.constructor();
    cam.getWorldQuaternion(this._q); this._q.invert(); this._v.applyQuaternion(this._q);
    p.x = this._v.x; p.y = this._v.y; p.z = this._v.z; return p;
  }
  _play(buf, line, o, key) {
    // a queued line (a greeting, then the offer) waits for the same voice to finish; otherwise one voice says one line at a time
    const busy = o.queue && this.active.find(a => a.voice === o.voice);
    if (busy) { (busy.after ||= []).push(() => this._play(buf, line, { ...o, queue: false }, key)); return; }
    // the oldest line is cut when too many people talk at once
    for (const a of this.active.filter(a => a.voice === o.voice && a.source === (o.source || null))) this._stop(a);
    while (this.active.length >= MAX_VOICES) this._stop(this.active[0]);
    const ctx = this.ctx, src = ctx.createBufferSource(); src.buffer = buf;
    const gain = ctx.createGain(); gain.gain.value = 1;
    let node = src, panner = null;
    if (o.channel === 'radio') {
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 450;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3000;
      src.connect(hp); hp.connect(lp); node = lp;
      gain.gain.value = 1.15;
    } else if (o.channel === 'room' && o.source && this.camera) {
      panner = ctx.createPanner(); panner.panningModel = 'equalpower'; panner.distanceModel = 'inverse';
      panner.refDistance = 2.5; panner.rolloffFactor = 1.1; panner.maxDistance = HEARD_M;
      src.connect(panner); node = panner;
    }
    node.connect(gain); gain.connect(this.master);
    const rec = { voice: o.voice, source: o.source || null, src, panner, gain, line, startedAt: ctx.currentTime, dur: buf.duration };
    src.onended = () => { this._drop(rec); for (const f of rec.after || []) f(); };
    this.active.push(rec);
    this._place(rec);
    src.start(0);
    this.stats.clips++;
    const d = o.source && this.camera ? Math.hypot(this._tmp.x, this._tmp.y, this._tmp.z) : 0;
    this._note({ voice: o.voice, text: line, mode: 'clip', channel: o.channel || 'flat', dur: +buf.duration.toFixed(2), dist: +d.toFixed(1), x: +this._tmp.x.toFixed(2), key });
  }
  _drop(rec) { const i = this.active.indexOf(rec); if (i >= 0) this.active.splice(i, 1); try { rec.src.disconnect(); rec.gain.disconnect(); rec.panner?.disconnect(); } catch { /* gone */ } }
  _stop(rec) { try { rec.src.onended = null; rec.src.stop(); } catch { /* not started */ } this._drop(rec); }
  _place(rec) {
    if (!rec.panner) return;
    const v = this._rel(rec.source), t = this.ctx.currentTime, p = rec.panner;
    if (p.positionX) { p.positionX.setTargetAtTime(v.x, t, 0.05); p.positionY.setTargetAtTime(v.y, t, 0.05); p.positionZ.setTargetAtTime(v.z, t, 0.05); }
    else p.setPosition(v.x, v.y, v.z);
    const d = Math.hypot(v.x, v.y, v.z);
    rec.gain.gain.setTargetAtTime(d >= HEARD_M ? 0 : Math.min(1, (HEARD_M - d) / 8), t, 0.08);   // a clean fade-out at the edge
  }
  /** Every frame: the listener is the camera, so speakers are placed in camera space and the listener never moves. */
  update() {
    if (!this.ctx || !this.active.length) return;
    const l = this.ctx.listener;
    if (!this._oriented) {
      if (l.forwardX) { l.positionX.value = 0; l.positionY.value = 0; l.positionZ.value = 0; l.forwardX.value = 0; l.forwardY.value = 0; l.forwardZ.value = -1; l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0; }
      else { l.setPosition?.(0, 0, 0); l.setOrientation?.(0, 0, -1, 0, 1, 0); }
      this._oriented = true;
    }
    for (const a of this.active) this._place(a);
  }
  // fallback: the browser's own voice, in a voice of the right gender
  _tts(line, o, dist) {
    const synth = typeof window !== 'undefined' && window.speechSynthesis; if (!synth) { this.stats.dropped++; return; }
    const spec = VOICES[o.voice], u = new SpeechSynthesisUtterance(line);
    u.pitch = spec.pitch; u.rate = spec.rate;
    u.volume = Math.max(0, Math.min(1, Number(this.settings.volume) * (o.channel === 'room' ? distanceGain(dist) : 1)));
    const voices = synth.getVoices?.() || [];
    const en = voices.filter(v => /^en/i.test(v.lang));
    const female = /(female|samantha|victoria|karen|moira|tessa|zira|susan|fiona|allison|ava|serena|kate)/i, male = /(male|daniel|alex|fred|tom|oliver|david|mark|aaron|arthur|gordon|rishi)/i;
    const pick = en.filter(v => (spec.gender === 'f' ? female : male).test(v.name));
    const v = pick[Math.abs(o.voice.length * 7 + line.length) % Math.max(1, pick.length)] || en[0]; if (v) u.voice = v;
    if (u.volume <= 0) { this.stats.dropped++; this._note({ voice: o.voice, text: line, mode: 'too-far' }); return; }
    try { synth.speak(u); this.stats.tts++; this._note({ voice: o.voice, text: line, mode: 'tts' }); } catch { this.stats.dropped++; }
  }
  stopAll() { for (const a of [...this.active]) this._stop(a); try { window.speechSynthesis?.cancel(); } catch { /* none */ } }
}
