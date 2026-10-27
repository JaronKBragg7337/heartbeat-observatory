export const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
export const dbToGain = (db) => Math.pow(10, db / 20);
export const gainToDb = (gain) => 20 * Math.log10(Math.max(1e-15, gain));
export const midiToHz = (note) => 440 * Math.pow(2, (note - 69) / 12);

export function seededRandom(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function oscillator(phase, type = 'sine') {
  const x = phase - Math.floor(phase);
  if (type === 'sawtooth') return 2 * x - 1;
  if (type === 'square') return x < 0.5 ? 1 : -1;
  if (type === 'triangle') return 1 - 4 * Math.abs(x - 0.5);
  return Math.sin(2 * Math.PI * x);
}

export class Biquad {
  constructor(sampleRate, options = {}) { this.sampleRate = sampleRate; this.configure(options); this.x1 = this.x2 = this.y1 = this.y2 = 0; }
  configure({ type = 'peaking', frequency = 1000, Q = 0.707, gainDb = 0 }) {
    const w = 2 * Math.PI * clamp(frequency, 1, this.sampleRate * 0.49) / this.sampleRate, cs = Math.cos(w), sn = Math.sin(w), A = Math.pow(10, gainDb / 40), alpha = sn / (2 * Math.max(0.001, Q));
    let b0, b1, b2, a0, a1, a2;
    if (type === 'lowpass') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; a0 = 1 + alpha; a1 = -2 * cs; a2 = 1 - alpha; }
    else if (type === 'highpass') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; a0 = 1 + alpha; a1 = -2 * cs; a2 = 1 - alpha; }
    else if (type === 'bandpass') { b0 = alpha; b1 = 0; b2 = -alpha; a0 = 1 + alpha; a1 = -2 * cs; a2 = 1 - alpha; }
    else if (type === 'highshelf') { const s = 2 * Math.sqrt(A) * alpha; b0 = A * ((A + 1) + (A - 1) * cs + s); b1 = -2 * A * ((A - 1) + (A + 1) * cs); b2 = A * ((A + 1) + (A - 1) * cs - s); a0 = (A + 1) - (A - 1) * cs + s; a1 = 2 * ((A - 1) - (A + 1) * cs); a2 = (A + 1) - (A - 1) * cs - s; }
    else if (type === 'lowshelf') { const s = 2 * Math.sqrt(A) * alpha; b0 = A * ((A + 1) - (A - 1) * cs + s); b1 = 2 * A * ((A - 1) - (A + 1) * cs); b2 = A * ((A + 1) - (A - 1) * cs - s); a0 = (A + 1) + (A - 1) * cs + s; a1 = -2 * ((A - 1) + (A + 1) * cs); a2 = (A + 1) + (A - 1) * cs - s; }
    else if (type === 'peaking') { b0 = 1 + alpha * A; b1 = -2 * cs; b2 = 1 - alpha * A; a0 = 1 + alpha / A; a1 = -2 * cs; a2 = 1 - alpha / A; }
    else throw new RangeError('unknown biquad type ' + type);
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
    this.type = type; this.frequency = frequency; this.Q = Q; this.gainDb = gainDb;
  }
  sample(x) { const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2; this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y; return y; }
}

export class DelayLine {
  constructor(length) { this.data = new Float64Array(Math.max(1, Math.ceil(length) + 2)); this.at = 0; }
  read(delay) {
    const n = this.data.length, d = clamp(delay, 0, n - 2), x = this.at - d, a = Math.floor(x), f = x - a;
    return this.data[(a % n + n) % n] * (1 - f) + this.data[((a + 1) % n + n) % n] * f;
  }
  write(x) { this.data[this.at] = x; this.at = (this.at + 1) % this.data.length; }
}
