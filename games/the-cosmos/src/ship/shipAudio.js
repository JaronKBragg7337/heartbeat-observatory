// ============================================================================
// shipAudio.js — the ship's sound, synthesised. No sample files, nothing to license.
//
// OWNS: engine rumble that follows thrust, the hum of the deck, gun and impact
//       one-shots, door and ramp motors. All from oscillators and filtered noise.
// DOES NOT OWN: any game state. It reads the ship's numbers and the events the
//       gun system already emits.
//
// Browsers refuse to start audio before a gesture, so the context is created on
// the first touch, click or key. Until then this class does nothing.
// ============================================================================

export class ShipAudio {
  constructor() {
    this.ctx = null;
    this.on = true;
    this.master = null;
    this.tone = null;
    this.engineGain = null; this.engineBand = null; this.humGain = null; this.motorGain = null;
    this._noise = null;
    this._last = { shot: 0, hit: 0, door: 0 };
    const start = () => this._start();
    for (const ev of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(ev, start, { once: false, passive: true });
    try { this.on = localStorage.getItem('cosmos-ship-sound') !== 'off'; } catch { /* storage may be blocked */ }
  }

  setOn(v) {
    this.on = !!v;
    try { localStorage.setItem('cosmos-ship-sound', v ? 'on' : 'off'); } catch { /* storage may be blocked */ }
    if (this.master) this.master.gain.value = this.on ? 0.55 : 0;
  }

  _start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = this.on ? 0.55 : 0;
    this.tone = ctx.createBiquadFilter(); this.tone.type = 'lowpass'; this.tone.frequency.value = 900;
    this.tone.connect(this.master); this.master.connect(ctx.destination);

    // one second of white noise, looped
    const len = ctx.sampleRate;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this._noise = buf;

    // engine: filtered noise plus two low oscillators
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    this.engineBand = ctx.createBiquadFilter(); this.engineBand.type = 'bandpass'; this.engineBand.frequency.value = 160; this.engineBand.Q.value = 0.7;
    this.engineGain = ctx.createGain(); this.engineGain.gain.value = 0;
    src.connect(this.engineBand); this.engineBand.connect(this.engineGain); this.engineGain.connect(this.tone);
    src.start();
    for (const [f, type, g] of [[46, 'sawtooth', 0.5], [69, 'square', 0.22]]) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = f;
      const og = ctx.createGain(); og.gain.value = g;
      o.connect(og); og.connect(this.engineGain); o.start();
      (this._osc = this._osc || []).push(o);
    }
    // the hum of a ship with the power on
    const hum = ctx.createOscillator(); hum.type = 'sine'; hum.frequency.value = 52;
    this.humGain = ctx.createGain(); this.humGain.gain.value = 0.05;
    hum.connect(this.humGain); this.humGain.connect(this.tone); hum.start();
    // motors
    const mo = ctx.createOscillator(); mo.type = 'sawtooth'; mo.frequency.value = 74;
    const mf = ctx.createBiquadFilter(); mf.type = 'lowpass'; mf.frequency.value = 300;
    this.motorGain = ctx.createGain(); this.motorGain.gain.value = 0;
    mo.connect(mf); mf.connect(this.motorGain); this.motorGain.connect(this.tone); mo.start();
  }

  /** Called every frame. */
  update(dt, s) {
    if (!this.ctx || !this.on) return;
    const t = this.ctx.currentTime;
    const thrust = Math.min(1, (s.thrustUp / Math.max(1, s.maxLift)) * 0.8 + (s.thrustFwd / Math.max(1, s.maxDrive)) * 0.5);
    const running = s.autoHover || thrust > 0.02;
    const level = running ? 0.12 + thrust * 0.55 : 0;
    this.engineGain.gain.setTargetAtTime(level, t, 0.15);
    this.engineBand.frequency.setTargetAtTime(110 + thrust * 420, t, 0.2);
    for (const o of this._osc) o.frequency.setTargetAtTime((o.type === 'sawtooth' ? 46 : 69) * (0.85 + thrust * 0.7), t, 0.25);
    // inside a hull everything is muffled; outside it is not
    this.tone.frequency.setTargetAtTime(s.aboard ? 700 : 3200, t, 0.2);
    this.humGain.gain.setTargetAtTime(s.aboard ? 0.05 : 0.008, t, 0.3);
    this.motorGain.gain.setTargetAtTime(s.motors ? (s.aboard ? 0.05 : 0.08) : 0, t, 0.08);
  }

  _burst(dur, freq, q, gain, sweepTo) {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this._noise;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    f.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.connect(f); f.connect(g); g.connect(this.tone);
    src.start(t, Math.random() * 0.5, dur + 0.05);
  }
  _pew(from, to, dur, gain) {
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'square';
    o.frequency.setValueAtTime(from, t); o.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(this.tone); o.start(t); o.stop(t + dur + 0.02);
  }
  _thump(freq, dur, gain) {
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(freq * 0.4, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(this.tone); o.start(t); o.stop(t + dur + 0.02);
  }

  /** Gun events, hit events. */
  events(list, aboard) {
    if (!this.ctx || !this.on) return;
    const now = this.ctx.currentTime;
    for (const e of list) {
      if (e.type === 'muzzle' && now - this._last.shot > 0.04) {
        this._last.shot = now;
        if (e.gun === 'main') { this._pew(620, 140, 0.14, 0.16); this._burst(0.12, 1800, 1, 0.12, 400); }
        else { this._pew(900, 220, 0.09, 0.1); this._burst(0.08, 2600, 1.2, 0.08, 700); }
      } else if (e.type === 'impact') {
        this._thump(70, 0.35, 0.28); this._burst(0.4, 500, 0.6, 0.12, 120);
      } else if (e.type === 'target_hit') { this._burst(0.06, 3200, 2, 0.14); this._pew(1400, 900, 0.05, 0.05); }
      else if (e.type === 'target_down') { this._thump(90, 0.6, 0.3); this._burst(0.7, 700, 0.5, 0.2, 100); }
    }
  }
  hit(absorbed) {
    if (!this.ctx || !this.on) return;
    const now = this.ctx.currentTime;
    if (now - this._last.hit < 0.1) return;
    this._last.hit = now;
    if (absorbed) { this._pew(1800, 300, 0.25, 0.18); this._burst(0.3, 2400, 1, 0.1, 500); }
    else { this._thump(55, 0.5, 0.4); this._burst(0.35, 300, 0.7, 0.25, 90); }
  }
  door() {
    if (!this.ctx || !this.on) return;
    const now = this.ctx.currentTime;
    if (now - this._last.door < 0.25) return;
    this._last.door = now;
    this._burst(0.28, 900, 0.8, 0.09, 260);
  }
}
