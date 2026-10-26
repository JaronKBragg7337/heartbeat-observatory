// Tiny synth for the bedroom. Every sound is described by an event's `snd` field ({k:'step',...}),
// so the same code plays it live, in replay, and in the offline render that makes the video's audio track.
// Works on an AudioContext or an OfflineAudioContext. Nothing plays until a tap unlocks it (iOS).
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class Sfx {
  constructor(ctx) {
    this.ctx = ctx;
    this.out = ctx.createGain(); this.out.gain.value = 0.9; this.out.connect(ctx.destination);
    // short echo bus (music + made-room tails)
    this.echoIn = ctx.createGain(); this.echoIn.gain.value = 0.0;
    const d = ctx.createDelay(1.0); d.delayTime.value = 0.33; const fb = ctx.createGain(); fb.gain.value = 0.38;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
    this.echoIn.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(this.out);
    const n = ctx.sampleRate * 2, buf = ctx.createBuffer(1, n, ctx.sampleRate), ch = buf.getChannelData(0);
    let a = 0, b = 0, seed = 12345; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
    for (let i = 0; i < n; i++) { const w = rnd(); a = 0.97 * a + 0.03 * w; b = 0.9 * b + 0.1 * w; ch[i] = (w * 0.3 + b * 0.9 + a * 2.2) * 0.5; }
    this.noise = buf;
  }
  static live() { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; return new Sfx(new AC()); }
  get now() { return this.ctx.currentTime; }
  async unlock() { try { await this.ctx.resume(); } catch (e) {} const g = this.ctx.createGain(); g.gain.value = 0; const o = this.ctx.createOscillator(); o.connect(g); g.connect(this.ctx.destination); o.start(); o.stop(this.ctx.currentTime + 0.01); }
  _noise(at, dur, type, f, q, g0, g1, pan = 0, send = 0) {
    const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noise; s.loop = true;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(g0, at); g.gain.exponentialRampToValueAtTime(Math.max(g1, 0.0001), at + dur);
    s.connect(fl); fl.connect(g); this._route(g, pan, send);
    s.start(at, Math.random() * 1.5); s.stop(at + dur + 0.02);
  }
  _route(node, pan, send) {
    const c = this.ctx; let last = node;
    if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); last.connect(p); last = p; }
    last.connect(this.out);
    if (send > 0) { const s = c.createGain(); s.gain.value = send; last.connect(s); s.connect(this.echoIn); this.echoIn.gain.value = 1; }
  }
  _osc(at, dur, type, f0, f1, g0, g1, pan = 0, send = 0, filt) {
    const c = this.ctx, o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, at);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), at + dur);
    const g = c.createGain(); g.gain.setValueAtTime(g0, at); g.gain.exponentialRampToValueAtTime(Math.max(g1, 0.0001), at + dur);
    let n = o; if (filt) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filt; o.connect(f); n = f; }
    n.connect(g); this._route(g, pan, send); o.start(at); o.stop(at + dur + 0.03);
  }
  // one entry point: snd = {k, ...}
  play(snd, at) {
    at = Math.max(at, this.ctx.currentTime);
    const pan = snd.pan || 0, g = snd.g == null ? 1 : snd.g;
    switch (snd.k) {
      case 'step': { // wooden floor: low thump + soft click; "made" floor rings a little
        const made = snd.place === 'made-floor', left = snd.foot === 'L';
        this._osc(at, 0.13, 'sine', left ? 118 : 104, 52, 0.55 * g, 0.001, pan);
        this._noise(at, 0.07, 'lowpass', 520, 0.7, 0.5 * g, 0.001, pan, made ? 0.12 : 0);
        this._noise(at, 0.025, 'bandpass', left ? 2300 : 1900, 1.2, 0.16 * g, 0.001, pan);
        if (made) this._osc(at, 0.5, 'triangle', 392, 392, 0.012 * g, 0.0001, pan, 0.4);
        break; }
      case 'creak': { const d = snd.dur || 1.5;
        this._osc(at, d, 'sawtooth', 70, 150, 0.0001, 0.0001, 0, 0.1, 500);
        const c = this.ctx, o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(82, at); o.frequency.linearRampToValueAtTime(205, at + d * 0.55); o.frequency.linearRampToValueAtTime(96, at + d);
        const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 760; f.Q.value = 7; const gg = c.createGain();
        gg.gain.setValueAtTime(0.0001, at); gg.gain.linearRampToValueAtTime(0.06 * g, at + 0.12); gg.gain.linearRampToValueAtTime(0.04 * g, at + d * 0.7); gg.gain.exponentialRampToValueAtTime(0.0001, at + d);
        const lfo = c.createOscillator(); lfo.frequency.value = 23; const lg = c.createGain(); lg.gain.value = 0.03; lfo.connect(lg); lg.connect(gg.gain);
        o.connect(f); f.connect(gg); this._route(gg, pan, 0.1); o.start(at); o.stop(at + d + 0.05); lfo.start(at); lfo.stop(at + d + 0.05); break; }
      case 'chime': { [0, 7, 12, 19].forEach((n, i) => this._osc(at + i * 0.07, 1.6, 'sine', midi(76 + n), midi(76 + n), 0.11 * g, 0.0001, pan, 0.5)); break; }
      case 'knock': { this._osc(at, 0.09, 'sine', 160, 70, 0.5 * g, 0.001, pan); this._noise(at, 0.05, 'bandpass', 900, 2, 0.3 * g, 0.001, pan); break; }
      case 'locked': { this._osc(at, 0.06, 'square', 220, 180, 0.07 * g, 0.001, pan, 0, 900); this._osc(at + 0.1, 0.08, 'square', 170, 140, 0.06 * g, 0.001, pan, 0, 800); break; }
      case 'tick': { this._osc(at, 0.04, 'sine', 1500, 1200, 0.06 * g, 0.001); break; }
      case 'win': { [0, 4, 7, 12].forEach((n, i) => this._osc(at + i * 0.08, 0.6, 'triangle', midi(72 + n), midi(72 + n), 0.1 * g, 0.0001, 0, 0.3)); break; }
      case 'lose': { this._osc(at, 0.5, 'sawtooth', 220, 110, 0.07 * g, 0.0001, 0, 0.1, 700); break; }
      // music kit (Music mode): all driven by events
      case 'kick': this._osc(at, 0.28, 'sine', 150, 42, 0.9 * g, 0.001); break;
      case 'clap': this._noise(at, 0.16, 'bandpass', 1500, 1.4, 0.34 * g, 0.001, pan, 0.18); this._noise(at + 0.012, 0.1, 'bandpass', 2400, 1.2, 0.22 * g, 0.001, pan); break;
      case 'hat': this._noise(at, 0.05, 'highpass', 7200, 0.7, 0.13 * g, 0.001, pan); break;
      case 'bass': this._osc(at, snd.dur || 0.32, 'sawtooth', midi(snd.n), midi(snd.n), 0.3 * g, 0.001, 0, 0.04, 360); this._osc(at, snd.dur || 0.32, 'sine', midi(snd.n - 12), midi(snd.n - 12), 0.35 * g, 0.001); break;
      case 'pad':
        (snd.ns || []).forEach((n) => { const c = this.ctx, o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = midi(n); const gg = c.createGain(); const dd = snd.dur || 2.2;
          gg.gain.setValueAtTime(0.0001, at); gg.gain.linearRampToValueAtTime(0.06 * g, at + 0.25); gg.gain.exponentialRampToValueAtTime(0.0001, at + dd);
          o.connect(gg); this._route(gg, 0, 0.45); o.start(at); o.stop(at + dd + 0.05); }); break;
      case 'bell': this._osc(at, 1.4, 'sine', midi(snd.n), midi(snd.n), 0.16 * g, 0.0001, pan, 0.55); this._osc(at, 0.9, 'sine', midi(snd.n) * 2.76, midi(snd.n) * 2.76, 0.05 * g, 0.0001, pan, 0.4); break;
      case 'riser': this._noise(at, snd.dur || 1.2, 'bandpass', 600, 2, 0.001, 0.2 * g, 0, 0.3); break;
    }
  }
  // quiet room tone: low air + faint hum, for the whole length (offline) or a long loop (live)
  roomTone(at, dur, level = 1) {
    const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noise; s.loop = true;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260; const g = c.createGain(); g.gain.value = 0.045 * level;
    s.connect(lp); lp.connect(g); g.connect(this.out); s.start(at); s.stop(at + dur);
    const h = c.createOscillator(); h.type = 'sine'; h.frequency.value = 58; const hg = c.createGain(); hg.gain.value = 0.006 * level; h.connect(hg); hg.connect(this.out); h.start(at); h.stop(at + dur);
    this._roomGain = g; this._humGain = hg;
    return { g, hg };
  }
}
export { midi };
