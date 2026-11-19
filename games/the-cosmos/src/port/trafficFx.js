// ============================================================================
// port/trafficFx.js - what Marineris Port's ambient traffic (traffic.js) sounds like, and the dust it raises.
//
// OWNS: a low engine rumble for each traffic ship, a touchdown thump, a faint electric whine for the apron tug, and a dust plume blown
//   out from under a ship's lift engines close to the ground. Decoration only.
// DOES NOT OWN: the ships, their flight or their timetable (traffic.js), the player's ship's sound (ship/shipAudio.js), the small
//   sounds of the hands (ui/sfx.js).
//
// EVERYTHING IS A PURE FUNCTION OF THE SHIP'S POSE (traffic.js `poseAt`) and of where the listener is: nothing is integrated and no
// event is waited for. The thump is the same idea: its loudness is a function of how long ago the pose says the gear took the weight.
// So a player who arrives mid-landing hears what everybody else hears, and a paused or skipped clock cannot leave a sound hanging.
//
// SOUND IN MARS'S AIR (610 Pa of CO2): quiet and dull. Carbon dioxide swallows the high frequencies within tens of metres, so the
// rumble is low-passed harder the farther the ship is, falls off fast, and is gone by 1.5 km. Inside a sealed ship it is fainter still.
// Plain Web Audio, nothing to download. The context is the player's ship's (shipAudio.js makes it on the first tap, as browsers ask);
// without one, this makes its own on the first tap. The ship's "Sound" setting switches this off with it.
//
// COST: a fixed set of nodes made once (two ship voices, one tug voice), their gains at zero when nothing flies. The dust is a few
// sprites per ship, made the first time that ship comes within 32 m of the ground, re-used, and hidden otherwise. No per-frame allocation.
// ============================================================================
import * as THREE from 'three';

const HEAR_M = 1500;                       // beyond this a traffic ship is silent
const TUG_HEAR_M = 40;
const DUST_ALT_M = 32;                     // the plume starts below this
const VOICES = 2;                          // the timetable never flies more than two ships (traffic.js)
const sm = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
function h01(n, salt) {
  let x = (Math.imul(n | 0, 0x9E3779B1) ^ Math.imul(salt + 1, 0x85EBCA6B)) >>> 0;
  x ^= x >>> 16; x = Math.imul(x, 0x7FEB352D); x ^= x >>> 15; x = Math.imul(x, 0x846CA68B); x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/** How loud and how dull a ship is for a listener `d` metres off. Pure. `p` is the pose (lift, main, fade, phase, ground). */
export function shipSound(p, d, cabin, out = {}) {
  const att = d >= HEAR_M ? 0 : sm((HEAR_M - d) / 500) / (1 + (d / 70) * (d / 70)), k = cabin ? 0.3 : 1;
  const power = Math.min(1.2, 0.85 * p.lift + 0.6 * p.main) * (p.fade === undefined ? 1 : p.fade);
  out.gain = 0.5 * power * att * k;
  out.cutoff = 70 + 620 * Math.sqrt(att);                                // Hz: near, a full rumble; far, only the bottom of it
  out.pitch = 0.85 + 0.3 * p.lift + 0.25 * p.main;                       // the engines wind up and down a little
  out.thump = p.phase === 4 && p.ground >= 0 && p.ground < 0.7 ? 0.9 * Math.exp(-p.ground * 8) * Math.min(1, att * 2.2) * k : 0;
  return out;
}
/** The tug: only when it is moving and close. Pure. */
export function tugSound(speed, d, cabin) { return d >= TUG_HEAR_M || speed <= 0.05 ? 0 : 0.05 * Math.min(1, speed / 3.5) * (1 - d / TUG_HEAR_M) * (1 - d / TUG_HEAR_M) * (cabin ? 0.3 : 1); }

let _dustTex = null;
function dustTexture() {
  if (_dustTex) return _dustTex;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  for (let i = 0; i < 9; i++) { const x = 32 + (h01(i, 1) - 0.5) * 22, y = 32 + (h01(i, 2) - 0.5) * 22, r = 12 + h01(i, 3) * 10, gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.34)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.14)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }
  _dustTex = new THREE.CanvasTexture(c); _dustTex.colorSpace = THREE.SRGBColorSpace; return _dustTex;
}

export class TrafficFx {
  /** traffic: the PortTraffic this belongs to (its root, engine, site, port and context are what is used). */
  constructor(traffic) {
    this.traffic = traffic; this.low = traffic.low; this.puffs = this.low ? 5 : 9;
    this.ctx = null; this.master = null; this.voices = []; this.tugGain = null; this.tugOsc = null; this.sources = 0; this.tapped = false; this.ownCtx = false;
    this.want = { v: new Float32Array(VOICES), thump: new Float32Array(VOICES), cut: new Float32Array(VOICES), tug: 0, master: 0, d: new Float32Array(VOICES) };
    this._s = {}; this._l = { x: 0, y: 0, z: 0 }; this.n = 0; this.frame = 0; this.on = true;
    try { this.on = globalThis.localStorage?.getItem('cosmos-ship-sound') !== 'off'; } catch { /* storage may be blocked */ }
    if (typeof window !== 'undefined') { const tap = () => { this.tapped = true; if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); };
      for (const ev of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(ev, tap, { passive: true }); }
  }

  // ---- sound -------------------------------------------------------------------------------------------------------------------------
  /** Make the nodes, once, after the first tap. The player's ship's context if there is one (one context is kinder to a phone). */
  _start() {
    if (this.ctx || !this.tapped) return;
    const ship = this.traffic.ctx.ship, shared = ship && ship.audio && ship.audio.ctx, AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!shared && !AC) { this.tapped = false; return; }
    let ctx; try { ctx = shared || new AC(); } catch { this.tapped = false; return; }
    this.ctx = ctx; this.ownCtx = !shared;
    const master = this.master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const start = (n, at) => { n.start(at); this.sources++; return n; };
    for (let i = 0; i < VOICES; i++) {
      const low = ctx.createBiquadFilter(); low.type = 'lowpass'; low.frequency.value = 80; low.Q.value = 0.5;
      const gain = ctx.createGain(); gain.gain.value = 0; low.connect(gain); gain.connect(master);
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; const ng = ctx.createGain(); ng.gain.value = 0.8; src.connect(ng); ng.connect(low); start(src, 0);
      const oscs = [[34 + i * 3, 'sawtooth', 0.5], [51 + i * 4, 'square', 0.2]].map(([f, type, g]) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; const og = ctx.createGain(); og.gain.value = g; o.connect(og); og.connect(low); start(o); o._f = f; return o; });
      // the thump: a low sine and a burst of dull noise, both at zero until a pose says the gear has just taken the weight
      const thump = ctx.createGain(); thump.gain.value = 0; thump.connect(master);
      const to = ctx.createOscillator(); to.type = 'sine'; to.frequency.value = 44; to.connect(thump); start(to);
      const tn = ctx.createBufferSource(); tn.buffer = buf; tn.loop = true; const tf = ctx.createBiquadFilter(); tf.type = 'lowpass'; tf.frequency.value = 160; const tg = ctx.createGain(); tg.gain.value = 0.7; tn.connect(tf); tf.connect(tg); tg.connect(thump); start(tn, 0);
      this.voices.push({ low, gain, oscs, thump });
    }
    // the tug: an electric drive's whine, two partials through a low-pass
    const tl = ctx.createBiquadFilter(); tl.type = 'lowpass'; tl.frequency.value = 1100; this.tugGain = ctx.createGain(); this.tugGain.gain.value = 0; tl.connect(this.tugGain); this.tugGain.connect(master);
    this.tugOsc = [[290, 'sawtooth', 0.5], [583, 'triangle', 0.35]].map(([f, type, g]) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; const og = ctx.createGain(); og.gain.value = g; o.connect(og); og.connect(tl); start(o); o._f = f; return o; });
  }

  /** Start of a traffic frame: where the listener is (port-local), and is the sound switched on. */
  begin() {
    const T = this.traffic, st = T.site, c = st.center, cam = T.engine.cameraWorldPos, x = cam.x - c.x, y = cam.y - c.y, z = cam.z - c.z, R = st.right, U = st.up, B = st.back, L = this._l;
    L.x = x * R.x + y * R.y + z * R.z; L.y = x * U.x + y * U.y + z * U.z; L.z = x * B.x + y * B.y + z * B.z;
    const ship = T.ctx.ship; this.cabin = !!(ship && ship.aboard); if (ship && ship.audio) this.on = ship.audio.on !== false;
    this.n = 0; this.frame++; this.want.tug = 0;
    if (!this.ctx) this._start();
  }
  /** One ship this frame: its voice and its dust. `s` is traffic's pool entry (its root is already posed), `p` the pose. */
  ship(s, p, now) {
    const L = this._l, d = Math.hypot(p.x - L.x, s.root.position.y - L.y, p.z - L.z), i = this.n++;
    if (i < VOICES) { const o = shipSound(p, d, this.cabin, this._s), W = this.want; W.v[i] = o.gain; W.thump[i] = o.thump; W.cut[i] = o.cutoff; W.d[i] = d;
      const v = this.voices[i]; if (v) { const t = this.ctx.currentTime; v.gain.gain.setTargetAtTime(o.gain, t, 0.12); v.low.frequency.setTargetAtTime(o.cutoff, t, 0.15); v.thump.gain.setTargetAtTime(o.thump, t, o.thump > 0.02 ? 0.012 : 0.09);
        for (const q of v.oscs) q.frequency.setTargetAtTime(q._f * o.pitch, t, 0.3); } }
    this.dust(s, p, now);
  }
  /** The tug this frame (port-local position, m/s). */
  tug(x, z, speed) {
    const L = this._l, d = Math.hypot(x - L.x, L.y - 1, z - L.z); this.want.tug = tugSound(speed, d, this.cabin);
    if (this.tugGain) { const t = this.ctx.currentTime; for (const q of this.tugOsc) q.frequency.setTargetAtTime(q._f * (0.55 + 0.45 * Math.min(1, speed / 3.5)), t, 0.2); }
  }
  /** End of a traffic frame: voices nobody used fall silent, dust nobody used is put away. */
  end() {
    const W = this.want; for (let i = this.n; i < VOICES; i++) { W.v[i] = 0; W.thump[i] = 0; W.d[i] = -1; const v = this.voices[i]; if (v) { const t = this.ctx.currentTime; v.gain.gain.setTargetAtTime(0, t, 0.2); v.thump.gain.setTargetAtTime(0, t, 0.05); } }
    W.master = this.on ? 0.5 : 0; if (this.master) { this.master.gain.setTargetAtTime(W.master, this.ctx.currentTime, 0.05); this.tugGain.gain.setTargetAtTime(W.tug, this.ctx.currentTime, 0.1); }
    for (const s of this.traffic.pool) if (s.dust && s.dustFrame !== this.frame && s.dust.group.visible) s.dust.group.visible = false;
  }
  /** Traffic is not being drawn at all (the camera is far away, on another world, or the opening is playing). */
  quiet() {
    if (this.want.master === 0 && !this._loud) return;
    const W = this.want; W.master = 0; W.tug = 0; W.v.fill(0); W.thump.fill(0); this._loud = false;
    if (this.master) this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
    for (const s of this.traffic.pool) if (s.dust) s.dust.group.visible = false;
  }

  // ---- dust ----------------------------------------------------------------------------------------------------------------------------
  /** Blown out along the ground from under the lift engines, for the last metres down and the first metres up. Pure in pose and clock. */
  dust(s, p, now) {
    const S = p.lift * (p.fade === undefined ? 1 : p.fade) * Math.min(1, Math.max(0, (DUST_ALT_M - p.alt) / 20));
    if (S < 0.03) { if (s.dust && s.dust.group.visible) s.dust.group.visible = false; return; }
    let D = s.dust;
    if (!D) { D = s.dust = { group: new THREE.Group(), sprites: [] }; D.group.name = 'port-traffic:dust'; const env = s.def && s.def.envelope; D.r0 = env ? Math.max(2.5, Math.min(env.width || 8, env.depth || 8) * 0.28) : 3;
      for (let i = 0; i < this.puffs; i++) { const m = new THREE.SpriteMaterial({ map: dustTexture(), color: 0xb08a68, transparent: true, depthWrite: false, opacity: 0 }), sp = new THREE.Sprite(m); sp.renderOrder = 3; D.group.add(sp); D.sprites.push(sp); }
      this.traffic.root.add(D.group); }
    s.dustFrame = this.frame; D.group.visible = true; this._loud = true;
    const night = this.traffic.port.night || 0, lum = 1 - 0.8 * night, N = D.sprites.length, rate = 0.42;
    for (let i = 0; i < N; i++) { const sp = D.sprites[i], q = now * rate + i / N, cyc = Math.floor(q), u = q - cyc, a = (h01(cyc, i) + i / N) * 6.2832, e = 1 - (1 - u) * (1 - u);
      const r = D.r0 + (9 + 15 * S) * e, size = 5 + 15 * e;
      sp.position.set(p.x + Math.cos(a) * r, 0.5 + size * 0.2 + 2.2 * u * u, p.z + Math.sin(a) * r); sp.scale.set(size * 1.5, size, 1);
      sp.material.opacity = 0.62 * S * (1 - u) * Math.min(1, u * 7); sp.material.rotation = a; sp.material.color.setRGB(0.69 * lum, 0.54 * lum, 0.41 * lum); }
  }

  // ---- for tests (window.cosmos.port.traffic.fx) ---------------------------------------------------------------------------------------
  /** What the sound should be doing (`voices`, `thump`, `tug`: gains asked for) and what the nodes report (`real`). */
  status() {
    const W = this.want, r = (a) => Array.from(a, (v) => +v.toFixed(4));
    return { ctx: this.ctx ? this.ctx.state : null, shared: !!this.ctx && !this.ownCtx, tapped: this.tapped, on: this.on, cabin: !!this.cabin, sources: this.sources, master: this.master ? +this.master.gain.value.toFixed(3) : null,
      voices: r(W.v), thump: r(W.thump), cutoff: r(W.cut), dist: r(W.d), tug: +W.tug.toFixed(4),
      real: this.voices.map((v) => +v.gain.gain.value.toFixed(4)), realThump: this.voices.map((v) => +v.thump.gain.value.toFixed(4)), realTug: this.tugGain ? +this.tugGain.gain.value.toFixed(4) : null,
      dust: this.traffic.pool.filter((s) => s.dust).map((s) => ({ type: s.type, shown: s.dust.group.visible, puffs: s.dust.sprites.length, opacity: +Math.max(...s.dust.sprites.map((q) => q.material.opacity)).toFixed(3) })) };
  }
}
