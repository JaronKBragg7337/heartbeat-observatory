import { pitchTime } from '../audio/effects.js';
import { allocate } from '../audio/buffer.js';

export const NOTE_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
export const SCALES = Object.freeze({ chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] });
export const midiName = (midi) => `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;

function fundamental(channel, sampleRate, minHz, maxHz) {
  let sum = 0, peak = 0;
  for (const x of channel) { sum += x * x; peak = Math.max(peak, Math.abs(x)); }
  const rms = Math.sqrt(sum / channel.length);
  if (rms < 0.008 || peak < 0.02) return { hz: null, confidence: 0, rms };
  const minLag = Math.floor(sampleRate / maxHz), maxLag = Math.min(Math.floor(sampleRate / minHz), channel.length >> 1);
  let mean = 0;
  for (const x of channel) mean += x;
  mean /= channel.length;
  const centered = Float64Array.from(channel, (x) => x - mean);
  let bestLag = 0, best = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let correlation = 0, a = 0, b = 0;
    for (let i = 0; i + lag < centered.length; i++) { const x = centered[i], y = centered[i + lag]; correlation += x * y; a += x * x; b += y * y; }
    const score = correlation / Math.max(1e-15, Math.sqrt(a * b));
    if (score > best) { best = score; bestLag = lag; }
  }
  if (!bestLag || best < 0.35) return { hz: null, confidence: Math.max(0, best), rms };
  return { hz: sampleRate / bestLag, confidence: best, rms };
}

export function detectPitch(buffer, { window = 2048, hop = 512, minHz = 70, maxHz = 1000 } = {}) {
  const frames = [], mono = buffer.channels[0];
  for (let start = 0; start + window <= mono.length; start += hop) {
    const f = fundamental(mono.subarray(start, start + window), buffer.sampleRate, minHz, maxHz);
    const midi = f.hz ? 69 + 12 * Math.log2(f.hz / 440) : null;
    frames.push({ tick: start, duration: hop, ...f, midi, note: midi === null ? null : midiName(Math.round(midi)) });
  }
  return frames;
}

export function scaleMidi(midi, key = 'C', scale = 'chromatic') {
  const root = NOTE_NAMES.indexOf(key), allowed = SCALES[scale];
  if (root < 0 || !allowed) throw new RangeError('unknown key or scale');
  let best = Math.round(midi), distance = Infinity;
  for (let n = 0; n <= 127; n++) { const d = Math.abs(n - midi); if (allowed.includes(((n - root) % 12 + 12) % 12) && d < distance) { best = n; distance = d; } }
  return best;
}

export function pitchPlan(frames, { key = 'C', scale = 'chromatic', retune = 1 } = {}) {
  const notes = [];
  for (const frame of frames) {
    if (frame.midi === null || frame.confidence < 0.55) continue;
    const target = scaleMidi(frame.midi, key, scale), cents = (target - frame.midi) * 100 * Math.max(0, Math.min(1, retune));
    const previous = notes.at(-1);
    if (previous && previous.target === target && Math.abs(previous.cents - cents) < 35 && frame.tick <= previous.endTick + previous.duration) { previous.endTick = frame.tick + frame.duration; previous.cents = (previous.cents + cents) / 2; }
    else notes.push({ startTick: frame.tick, endTick: frame.tick + frame.duration, target, note: midiName(target), cents });
  }
  return notes;
}

export function correctVocal(buffer, options = {}) {
  const frames = detectPitch(buffer, options), notes = pitchPlan(frames, options);
  const voiced = notes.filter((n) => Number.isFinite(n.cents));
  const cents = voiced.length ? voiced.reduce((s, n) => s + n.cents * (n.endTick - n.startTick), 0) / voiced.reduce((s, n) => s + n.endTick - n.startTick, 0) : 0;
  const corrected = cents ? pitchTime(buffer, { semitones: cents / 100 }) : allocate(buffer.length, buffer.sampleRate, buffer.numberOfChannels);
  if (!cents) for (let c = 0; c < buffer.numberOfChannels; c++) corrected.channels[c].set(buffer.channels[c]);
  return { buffer: corrected, analysis: { frames, notes, averageCorrectionCents: cents, key: options.key || 'C', scale: options.scale || 'chromatic', retune: options.retune ?? 1, formant: options.formant || 'preserved by time-domain resampling', vibrato: options.vibrato ?? 1 } };
}
