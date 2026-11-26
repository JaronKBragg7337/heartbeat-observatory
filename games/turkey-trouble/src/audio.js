// Every sound is made here with WebAudio. Nothing is loaded. Modest volume, a mute switch, a listener that pans by
// direction (relative to the camera) and fades by distance.
export function createAudio({ muted = false } = {}) {
  let ctx = null, master, sfx, amb, noise, windGain, waterGain, ambOn = false;
  let isMuted = muted;
  const L = { x: 0, z: 0, yaw: 0 };
  let dripIn = 1, cricketIn = 2;

  function init() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = isMuted ? 0 : 0.55; master.connect(ctx.destination);
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(master);
    sfx = ctx.createGain(); sfx.gain.value = 1; sfx.connect(comp);
    amb = ctx.createGain(); amb.gain.value = 0.5; amb.connect(comp);
    const len = ctx.sampleRate * 2; noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noise.getChannelData(0); let b = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b = 0.97 * b + 0.03 * w; d[i] = w * 0.6 + b * 2.2; }
    return true;
  }
  // call from a user gesture (first tap / key): iPhone only starts audio from one
  function unlock() {
    if (!init()) return;
    if (ctx.state === 'suspended') ctx.resume();
    try { const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, 22050); s.connect(ctx.destination); s.start(0); } catch (e) { /* fine */ }
  }
  const now = () => ctx.currentTime;
  const ready = () => ctx && ctx.state === 'running' && !isMuted;

  function src(dur, loop = false) { const s = ctx.createBufferSource(); s.buffer = noise; s.loop = loop; s.loopStart = 0; s.loopEnd = 2; s._dur = dur; return s; }
  function filt(type, f, Q = 1) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = Q; return b; }
  function env(g, t, a, peak, dcy) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dcy); }
  // where a sound sits: pan by direction relative to the camera, gain by distance
  function place(x, z, range = 40) {
    if (x == null) return { pan: 0, gain: 1 };
    const dx = x - L.x, dz = z - L.z, d = Math.hypot(dx, dz);
    const rx = -Math.cos(L.yaw), rz = Math.sin(L.yaw);            // the camera's right
    const pan = d > 0.3 ? Math.max(-1, Math.min(1, (dx * rx + dz * rz) / d)) * Math.min(1, d / 3) : 0;
    const gain = Math.max(0, 1 / (1 + (d / (range * 0.22)) ** 2));
    return { pan, gain };
  }
  function out(x, z, range, vol = 1) {
    const p = place(x, z, range);
    const g = ctx.createGain(); g.gain.value = vol * p.gain;
    if (ctx.createStereoPanner) { const pn = ctx.createStereoPanner(); pn.pan.value = p.pan * 0.85; g.connect(pn); pn.connect(sfx); }
    else g.connect(sfx);
    return { node: g, gain: p.gain };
  }

  // ---------------------------------------------------------------- the sounds
  function gobble(x, z, loud = 0) {
    if (!ready()) return;
    const o = out(x, z, 70, loud ? 0.75 : 0.55); if (o.gain < 0.01) return;
    const t = now() + 0.01, dur = 0.62 + Math.random() * 0.12, base = 560 + Math.random() * 80;
    const a = ctx.createOscillator(); a.type = 'sawtooth';
    const b = ctx.createOscillator(); b.type = 'square';
    const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 19 + Math.random() * 5;
    const depth = ctx.createGain(); depth.gain.value = 140; lfo.connect(depth); depth.connect(a.frequency); depth.connect(b.frequency);
    a.frequency.setValueAtTime(base * 1.15, t); a.frequency.exponentialRampToValueAtTime(base * 0.62, t + dur);
    b.frequency.setValueAtTime(base * 0.58, t); b.frequency.exponentialRampToValueAtTime(base * 0.33, t + dur);
    const bp = filt('bandpass', 1300, 1.6), lp = filt('lowpass', 3200, 0.7);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
    const pulses = 6 + Math.floor(Math.random() * 3);              // "gobble-obble-obble"
    for (let i = 0; i < pulses; i++) {
      const ti = t + (i / pulses) * dur, amp = 0.55 * (1 - i / (pulses * 1.4));
      g.gain.setTargetAtTime(amp, ti, 0.008); g.gain.setTargetAtTime(amp * 0.12, ti + dur / pulses * 0.55, 0.012);
    }
    g.gain.setTargetAtTime(0.0001, t + dur, 0.03);
    a.connect(bp); b.connect(bp); bp.connect(lp); lp.connect(g); g.connect(o.node);
    for (const s of [a, b, lfo]) { s.start(t); s.stop(t + dur + 0.25); }
  }

  const STEP = { yard_dirt: ['lowpass', 700, 0.9, 0.05], dirt: ['lowpass', 700, 0.9, 0.05], gravel: ['bandpass', 2600, 0.8, 0.09], grass: ['highpass', 1800, 0.5, 0.035], stubble: ['bandpass', 3400, 1.2, 0.06], asphalt: ['bandpass', 1400, 2.5, 0.03], water: ['lowpass', 900, 1.5, 0.12], wood: ['bandpass', 500, 3, 0.05] };
  function step(surface, x, z, vol = 1) {
    if (!ready()) return;
    const k = STEP[surface] || STEP.grass;
    const o = out(x, z, 24, 0.22 * vol);
    const t = now(), s = src(); s.playbackRate.value = 0.8 + Math.random() * 0.5;
    const f = filt(k[0], k[1] * (0.85 + Math.random() * 0.3), k[2]);
    const g = ctx.createGain(); env(g, t, 0.004, 0.9, k[3]);
    s.connect(f); f.connect(g); g.connect(o.node);
    s.start(t, Math.random() * 1.5, k[3] + 0.05);
  }

  function heartbeat(vol = 1) {
    if (!ready()) return;
    const t = now();
    for (const [dt, amp] of [[0, 0.5], [0.17, 0.32]]) {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(70, t + dt); o.frequency.exponentialRampToValueAtTime(38, t + dt + 0.12);
      const g = ctx.createGain(); env(g, t + dt, 0.008, amp * vol, 0.16);
      o.connect(g); g.connect(sfx); o.start(t + dt); o.stop(t + dt + 0.3);
    }
  }

  function pass(x, z, kind, speed) {
    if (!ready()) return;
    const o = out(x, z, 34, kind === 'grain_truck' ? 0.7 : 0.55); if (o.gain < 0.02) return;
    const t = now(), dur = Math.max(0.7, Math.min(1.8, 14 / Math.max(4, speed)));
    const s = src(); const f = filt('bandpass', 500, 0.9);
    f.frequency.setValueAtTime(380, t); f.frequency.exponentialRampToValueAtTime(1500, t + dur * 0.45); f.frequency.exponentialRampToValueAtTime(320, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + dur * 0.45); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(o.node); s.start(t, Math.random()); s.stop(t + dur + 0.05);
    const e = ctx.createOscillator(); e.type = 'sawtooth';
    const base = kind === 'tractor_wagon' ? 42 : kind === 'grain_truck' ? 55 : 85;
    e.frequency.setValueAtTime(base * 1.12, t); e.frequency.setValueAtTime(base * 1.12, t + dur * 0.4); e.frequency.exponentialRampToValueAtTime(base * 0.86, t + dur * 0.6);
    const lp = filt('lowpass', 380, 1); const eg = ctx.createGain(); eg.gain.setValueAtTime(0.0001, t); eg.gain.exponentialRampToValueAtTime(0.32, t + dur * 0.45); eg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    e.connect(lp); lp.connect(eg); eg.connect(o.node); e.start(t); e.stop(t + dur + 0.05);
  }

  function horn(x, z, kind) {
    if (!ready()) return;
    const o = out(x, z, 60, 0.4); const t = now();
    const low = kind === 'grain_truck' || kind === 'tractor_wagon';
    for (const fr of low ? [196, 247] : [392, 494]) {
      const s = ctx.createOscillator(); s.type = 'square'; s.frequency.value = fr;
      const lp = filt('lowpass', 1800, 0.8), g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.02); g.gain.setValueAtTime(0.25, t + 0.32); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
      s.connect(lp); lp.connect(g); g.connect(o.node); s.start(t); s.stop(t + 0.45);
    }
  }

  function splash(x, z) {
    if (!ready()) return;
    const o = out(x, z, 40, 0.7); const t = now();
    const s = src(), f = filt('lowpass', 3500, 0.7); f.frequency.setValueAtTime(3500, t); f.frequency.exponentialRampToValueAtTime(400, t + 0.6);
    const g = ctx.createGain(); env(g, t, 0.01, 0.9, 0.6);
    s.connect(f); f.connect(g); g.connect(o.node); s.start(t, 0.3, 0.8);
    for (let i = 0; i < 5; i++) {
      const bt = t + 0.08 + Math.random() * 0.45, b = ctx.createOscillator(); b.type = 'sine';
      const f0 = 500 + Math.random() * 700; b.frequency.setValueAtTime(f0, bt); b.frequency.exponentialRampToValueAtTime(f0 * 2.2, bt + 0.05);
      const bg = ctx.createGain(); env(bg, bt, 0.003, 0.18, 0.05); b.connect(bg); bg.connect(o.node); b.start(bt); b.stop(bt + 0.1);
    }
  }

  function knock() {
    if (!ready()) return;
    const t = now();
    const s = src(), f = filt('bandpass', 950, 3), g = ctx.createGain(); env(g, t, 0.002, 1.0, 0.07);
    s.connect(f); f.connect(g); g.connect(sfx); s.start(t, 0.5, 0.12);
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(210, t); o.frequency.exponentialRampToValueAtTime(150, t + 0.1);
    const og = ctx.createGain(); env(og, t, 0.002, 0.8, 0.12); o.connect(og); og.connect(sfx); o.start(t); o.stop(t + 0.2);
  }

  function notes(seq, type, vol, lpF) {
    const t = now();
    for (const [dt, fr, len, glide] of seq) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(fr, t + dt);
      if (glide) o.frequency.exponentialRampToValueAtTime(fr * glide, t + dt + len);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t + dt); g.gain.exponentialRampToValueAtTime(vol, t + dt + 0.02); g.gain.setValueAtTime(vol, t + dt + len * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dt + len);
      const lp = filt('lowpass', lpF, 1); o.connect(lp); lp.connect(g); g.connect(sfx); o.start(t + dt); o.stop(t + dt + len + 0.05);
    }
  }
  function win() { if (!ready()) return; notes([[0, 523, 0.14], [0.12, 659, 0.14], [0.24, 784, 0.14], [0.36, 1047, 0.5]], 'triangle', 0.32, 5000); }
  function lose() { if (!ready()) return; notes([[0, 392, 0.3], [0.32, 370, 0.3], [0.64, 349, 0.3], [0.96, 330, 0.9, 0.94]], 'sawtooth', 0.16, 1100); }
  function sting() { if (!ready()) return; notes([[0, 220, 0.12], [0.1, 233, 0.5]], 'sawtooth', 0.14, 900); }

  function flap(x, z, n = 7) {
    if (!ready()) return;
    const o = out(x, z, 30, 0.45); const t = now();
    for (let i = 0; i < n; i++) {
      const s = src(), f = filt('bandpass', 900 + Math.random() * 500, 0.8), g = ctx.createGain(); env(g, t + i * 0.065, 0.006, 0.6, 0.05);
      s.connect(f); f.connect(g); g.connect(o.node); s.start(t + i * 0.065, Math.random() * 1.5, 0.08);
    }
  }
  function whoosh(x, z) {
    if (!ready()) return;
    const o = out(x, z, 20, 0.4); const t = now();
    const s = src(), f = filt('bandpass', 400, 1.2); f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(1800, t + 0.25);
    const g = ctx.createGain(); env(g, t, 0.05, 0.7, 0.25); s.connect(f); f.connect(g); g.connect(o.node); s.start(t, 0.2, 0.4);
  }
  function thud(x, z) {
    if (!ready()) return;
    const o = out(x, z, 20, 0.6); const t = now();
    const s = ctx.createOscillator(); s.type = 'sine'; s.frequency.setValueAtTime(140, t); s.frequency.exponentialRampToValueAtTime(45, t + 0.18);
    const g = ctx.createGain(); env(g, t, 0.004, 0.8, 0.2); s.connect(g); g.connect(o.node); s.start(t); s.stop(t + 0.3);
    const n = src(), f = filt('lowpass', 600), ng = ctx.createGain(); env(ng, t, 0.003, 0.6, 0.15); n.connect(f); f.connect(ng); ng.connect(o.node); n.start(t, 0.7, 0.2);
  }
  function bonk(x, z) {
    if (!ready()) return;
    const o = out(x, z, 30, 0.5); const t = now();
    const s = ctx.createOscillator(); s.type = 'triangle'; s.frequency.setValueAtTime(620, t); s.frequency.exponentialRampToValueAtTime(140, t + 0.22);
    const g = ctx.createGain(); env(g, t, 0.003, 0.7, 0.24); s.connect(g); g.connect(o.node); s.start(t); s.stop(t + 0.3);
  }
  function bark(x, z) {
    if (!ready()) return;
    const o = out(x, z, 50, 0.5); const t = now();
    for (const dt of [0, 0.2]) {
      const s = ctx.createOscillator(); s.type = 'square'; s.frequency.setValueAtTime(430, t + dt); s.frequency.exponentialRampToValueAtTime(190, t + dt + 0.11);
      const f = filt('bandpass', 900, 1.5), g = ctx.createGain(); env(g, t + dt, 0.005, 0.5, 0.11);
      s.connect(f); f.connect(g); g.connect(o.node); s.start(t + dt); s.stop(t + dt + 0.15);
    }
  }
  function thunder() {                // far off, low, long: spooky, not scary
    if (!ready()) return;
    const t = now() + 0.25, s = src(), f = filt('lowpass', 160, 0.7), g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9, t + 0.12); g.gain.exponentialRampToValueAtTime(0.25, t + 0.9); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
    f.frequency.setValueAtTime(260, t); f.frequency.exponentialRampToValueAtTime(90, t + 2.4);
    s.playbackRate.value = 0.5; s.connect(f); f.connect(g); g.connect(sfx); s.start(t, Math.random(), 2.8);
  }
  function hey(x, z) {                // the farmer: "Hey!" as a vowel, no words needed
    if (!ready()) return;
    const o = out(x, z, 50, 0.55); const t = now();
    const s = ctx.createOscillator(); s.type = 'sawtooth'; s.frequency.setValueAtTime(150, t); s.frequency.linearRampToValueAtTime(210, t + 0.12); s.frequency.exponentialRampToValueAtTime(130, t + 0.4);
    const g = ctx.createGain(); env(g, t, 0.03, 0.5, 0.38);
    for (const [fr, q, v] of [[650, 6, 1], [1900, 8, 0.5]]) { const f = filt('bandpass', fr, q), fg = ctx.createGain(); fg.gain.value = v; s.connect(f); f.connect(fg); fg.connect(g); }
    g.connect(o.node); s.start(t); s.stop(t + 0.45);
  }

  // ---------------------------------------------------------------- the night around you
  function startAmbience() {
    if (!ctx || ambOn) return; ambOn = true;
    const w = src(0, true), f = filt('bandpass', 420, 0.6); windGain = ctx.createGain(); windGain.gain.value = 0.18;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07; const lg = ctx.createGain(); lg.gain.value = 0.1; lfo.connect(lg); lg.connect(windGain.gain);
    const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.13; const lg2 = ctx.createGain(); lg2.gain.value = 180; lfo2.connect(lg2); lg2.connect(f.frequency);
    w.connect(f); f.connect(windGain); windGain.connect(amb); w.start(); lfo.start(); lfo2.start();
    const r = src(0, true), rf = filt('lowpass', 520, 0.8); waterGain = ctx.createGain(); waterGain.gain.value = 0;
    r.playbackRate.value = 0.7; r.connect(rf); rf.connect(waterGain); waterGain.connect(amb); r.start(0, 1);
  }
  function drip() {
    const t = now(), o = out(L.x + (Math.random() - 0.5) * 20, L.z + (Math.random() - 0.5) * 20, 30, 0.12);
    const s = ctx.createOscillator(); s.type = 'sine'; const f0 = 1200 + Math.random() * 900;
    s.frequency.setValueAtTime(f0, t); s.frequency.exponentialRampToValueAtTime(f0 * 0.55, t + 0.07);
    const g = ctx.createGain(); env(g, t, 0.002, 0.5, 0.07); s.connect(g); g.connect(o.node); s.start(t); s.stop(t + 0.1);
  }
  function cricket() {
    const t = now(), o = out(L.x + (Math.random() - 0.5) * 30, L.z + (Math.random() - 0.5) * 30, 40, 0.05);
    const s = ctx.createOscillator(); s.type = 'sine'; s.frequency.value = 4300 + Math.random() * 400;
    const g = ctx.createGain(); g.gain.value = 0.0001;
    const n = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) { const ti = t + i * 0.045; g.gain.setTargetAtTime(0.5, ti, 0.003); g.gain.setTargetAtTime(0.0001, ti + 0.02, 0.004); }
    s.connect(g); g.connect(o.node); s.start(t); s.stop(t + n * 0.045 + 0.05);
  }
  // each frame: where the listener is, and how near water is (0..1)
  function update(dt, x, z, yaw, water = 0) {
    L.x = x; L.z = z; L.yaw = yaw;
    if (!ready()) return;
    if (!ambOn) startAmbience();
    if (waterGain) waterGain.gain.setTargetAtTime(water * 0.5, now(), 0.3);
    if ((dripIn -= dt) <= 0) { dripIn = 0.8 + Math.random() * 2.4; drip(); }
    if ((cricketIn -= dt) <= 0) { cricketIn = 0.6 + Math.random() * 2.2; cricket(); }
  }
  function setMuted(m) {
    isMuted = m;
    if (master) master.gain.setTargetAtTime(m ? 0 : 0.55, now(), 0.05);
  }
  function pause(p) { if (!ctx) return; if (p) ctx.suspend(); else ctx.resume(); }

  return {
    unlock, update, setMuted, pause, get muted() { return isMuted; }, get running() { return !!ctx && ctx.state === 'running'; },
    gobble, step, heartbeat, pass, horn, splash, knock, win, lose, sting, flap, whoosh, thud, bonk, bark, hey, thunder,
  };
}
