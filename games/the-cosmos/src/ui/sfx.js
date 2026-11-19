// ============================================================================
// sfx.js - the small sounds that answer the player's hands (2026-11-19, part 1: the first hour).
//
// OWNS: short made-on-the-spot sounds (no files to download): a press for every button, a shovel bite, a lift, a latch, a yes, a no,
//   an impact, an arrival. One on/off switch (Settings, "Action sounds"), remembered on the device.
// DOES NOT OWN: voices (voice/voice.js), ship engines (ship/shipAudio.js), the opening's rumble and alarm (opening/opening.js).
// Platform-neutral: plain Web Audio, unlocked by the first touch, click, key or pad button like every browser asks.
// ============================================================================
const KEY = 'cosmos-sfx';
let ctx = null, master = null, on = true, noiseBuf = null, lastTap = 0;
try { on = globalThis.localStorage?.getItem(KEY) !== 'off'; } catch { /* storage may be blocked */ }

function ac() {
  if (ctx) return ctx;
  const C = globalThis.AudioContext || globalThis.webkitAudioContext; if (!C) return null;
  try { ctx = new C(); master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination); } catch { ctx = null; }
  return ctx;
}
function unlock() { const c = ac(); if (c && c.state === 'suspended') c.resume().catch(() => {}); }
function live() { if (!on) return null; const c = ac(); if (!c) return null; if (c.state === 'suspended') { c.resume().catch(() => {}); } return c; }

function tone(f0, dur, { type = 'sine', gain = 0.2, to = null, at = 0, attack = 0.005 } = {}) {
  const c = live(); if (!c) return; const t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.03);
}
function noise(dur, { gain = 0.2, from = 1800, to = 300, at = 0, q = 0.8 } = {}) {
  const c = live(); if (!c) return; const t = c.currentTime + at;
  if (!noiseBuf) { noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = noiseBuf; s.loop = true;
  f.type = 'lowpass'; f.Q.value = q; f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(Math.max(40, to), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.03);
}

export const sfx = {
  /** any button: a soft press */
  tap() { const n = globalThis.performance?.now() ?? 0; if (n - lastTap < 60) return; lastTap = n; tone(520, 0.06, { type: 'triangle', gain: 0.07, to: 390 }); },
  /** a shovel into dust */
  dig() { noise(0.22, { gain: 0.3, from: 2600, to: 240 }); tone(92, 0.14, { type: 'sine', gain: 0.22, to: 55 }); },
  /** taking a weight */
  lift() { noise(0.16, { gain: 0.12, from: 900, to: 300 }); tone(150, 0.28, { type: 'triangle', gain: 0.13, to: 260 }); },
  /** a latch, a door, a board */
  latch() { tone(180, 0.07, { type: 'square', gain: 0.07, to: 110 }); noise(0.09, { gain: 0.14, from: 3200, to: 700 }); tone(120, 0.1, { type: 'sine', gain: 0.12, to: 80, at: 0.07 }); },
  /** yes: it worked */
  confirm() { tone(523, 0.12, { type: 'triangle', gain: 0.12 }); tone(784, 0.22, { type: 'triangle', gain: 0.12, at: 0.1 }); },
  /** no: it did not */
  deny() { tone(196, 0.14, { type: 'sawtooth', gain: 0.07, to: 150 }); tone(147, 0.2, { type: 'sawtooth', gain: 0.07, to: 110, at: 0.12 }); },
  /** the ground arrives */
  impact() { noise(1.6, { gain: 0.6, from: 1400, to: 60, q: 0.4 }); tone(70, 1.1, { type: 'sine', gain: 0.5, to: 28 }); noise(0.25, { gain: 0.35, from: 6000, to: 1200, at: 0.02 }); },
  /** somewhere new, and it is yours */
  arrive() { tone(392, 0.5, { type: 'sine', gain: 0.1 }); tone(587, 0.6, { type: 'sine', gain: 0.1, at: 0.18 }); tone(784, 0.9, { type: 'sine', gain: 0.1, at: 0.36 }); },
};
export function sfxOn() { return on; }
export function setSfx(v) { on = !!v; try { globalThis.localStorage?.setItem(KEY, on ? 'on' : 'off'); } catch { /* storage may be blocked */ } if (on) sfx.confirm(); }

if (typeof window !== 'undefined') {
  const opts = { capture: true, passive: true };
  window.addEventListener('pointerdown', unlock, opts); window.addEventListener('keydown', unlock, opts);
  // every button in the game answers a press (a thumb, a mouse, or a pad's A on the focus ring, which clicks)
  const press = (e) => { const b = e.target?.closest?.('button, [role="button"], summary'); if (b && !b.disabled && !b.dataset.quiet) sfx.tap(); };
  window.addEventListener('pointerup', press, opts); window.addEventListener('click', (e) => { if (e.detail === 0) press(e); }, opts);
}
