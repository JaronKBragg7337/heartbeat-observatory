import { allocate, asAudioBuffer, mixInto } from './buffer.js';
import { midiToHz, oscillator, seededRandom, clamp } from './dsp.js';

const envelope = (t, duration, attack = 0.003, release = 0.08) => Math.min(1, t / Math.max(1e-6, attack)) * Math.exp(-Math.max(0, t - attack) / Math.max(1e-6, duration * 0.35)) * Math.min(1, Math.max(0, duration - t) / release);

export class DrumKit {
  constructor({ sampleRate = 48000, seed = 0x5eed1234, kit = 'hard' } = {}) { this.sampleRate = sampleRate; this.seed = seed; this.kit = kit; }
  hit(name, { velocity = 1, pan = 0, seed } = {}) {
    const sr = this.sampleRate, durations = { kick: 0.65, snare: 0.35, clap: 0.4, hat: 0.3, openHat: 0.5, shaker: 0.1, rim: 0.12, perc: 0.25, crash: 1.2 };
    const duration = durations[name] || 0.3, out = allocate(Math.ceil(sr * duration), sr, 2), random = seededRandom(seed ?? this.seed + [...name].reduce((n, c) => n + c.charCodeAt(0), 0));
    const soft = this.kit === 'soft', dusty = this.kit === 'dusty', boom = this.kit === 'boom';
    const tone = (f0, f1, decay, gain, type = 'sine', sweep = 0.05) => {
      let phase = 0;
      for (let i = 0; i < out.length; i++) {
        const t = i / sr, f = f1 + (f0 - f1) * Math.exp(-t / sweep); phase += f / sr;
        const x = oscillator(phase, type) * gain * Math.exp(-t / decay) * Math.min(1, t / 0.002) * velocity;
        out.channels[0][i] += x; out.channels[1][i] += x;
      }
    };
    const noise = (decay, gain, highpass = 0, delay = 0) => {
      let low = 0, previous = 0;
      for (let i = Math.floor(delay * sr); i < out.length; i++) {
        const t = i / sr - delay, white = random() * 2 - 1;
        low += 0.12 * (white - low); const x = (highpass ? white - (highpass > 1 ? low : previous) : low) * gain * Math.exp(-t / decay) * Math.min(1, t / 0.001) * velocity;
        previous = white; out.channels[0][i] += x; out.channels[1][i] += x;
      }
    };
    if (name === 'kick') { tone(soft ? 130 : 185, soft ? 44 : 50, boom ? 0.24 : soft ? 0.14 : 0.1, soft ? 0.65 : 0.85); tone(soft ? 160 : 240, 95, 0.035, 0.2, 'triangle', 0.03); if (!soft) noise(0.006, 0.22, 2); if (dusty) noise(0.025, 0.2); }
    else if (name === 'snare') { noise(dusty ? 0.09 : 0.065, soft ? 0.35 : 0.55); noise(0.025, 0.3, 1); tone(196, 165, 0.045, 0.2, 'triangle', 0.04); }
    else if (name === 'clap') { for (const [i, d] of [0, 0.009, 0.019, 0.03].entries()) noise(i === 3 ? 0.08 : 0.008, i === 3 ? 0.5 : 0.3, 1, d); }
    else if (name === 'hat' || name === 'openHat') { noise(name === 'openHat' ? 0.13 : 0.018, 0.38, 1); noise(name === 'openHat' ? 0.1 : 0.01, 0.18, 2); }
    else if (name === 'shaker') noise(0.018, 0.25);
    else if (name === 'rim') { tone(520, 480, 0.018, 0.35); tone(1700, 1700, 0.01, 0.1, 'triangle'); noise(0.009, 0.16, 1); }
    else if (name === 'crash') { noise(0.35, 0.28); noise(0.18, 0.2, 1); }
    else { tone(420, 260, 0.06, 0.35); noise(0.005, 0.1, 2); }
    const left = Math.cos((clamp(pan, -1, 1) + 1) * Math.PI / 4), right = Math.sin((clamp(pan, -1, 1) + 1) * Math.PI / 4);
    for (let i = 0; i < out.length; i++) { out.channels[0][i] *= left; out.channels[1][i] *= right; }
    return out;
  }
}

export class Synth {
  constructor({ sampleRate = 48000, type = 'keys', seed = 1 } = {}) { this.sampleRate = sampleRate; this.type = type; this.seed = seed; }
  note(midi, { duration = 0.5, velocity = 1, glideFrom = null } = {}) {
    const sr = this.sampleRate, length = Math.ceil((duration + 1) * sr), out = allocate(length, sr, 1), f0 = midiToHz(midi), start = glideFrom == null ? f0 : midiToHz(glideFrom), type = this.type;
    const random = seededRandom(this.seed + midi * 97), phases = [random(), random(), random()];
    let modPhase = random();
    for (let i = 0; i < length; i++) {
      const t = i / sr, f = start + (f0 - start) * Math.min(1, t / 0.08), env = envelope(t, duration, type === 'pad' ? 0.2 : 0.003, 0.1);
      let x = 0;
      if (type === '808') { phases[0] += f * (1 + 1.2 * Math.exp(-t / 0.025)) / sr; x = Math.sin(2 * Math.PI * phases[0]) * 0.72 + oscillator(phases[0] * 2, 'triangle') * 0.15; }
      else if (type === 'round') { phases[0] += f / sr; x = Math.sin(2 * Math.PI * phases[0]) * 0.7 + oscillator(phases[0] * 2, 'triangle') * 0.2; }
      else if (type === 'log') { phases[0] += f * (1 + 1.6 * Math.exp(-t / 0.035)) / sr; x = Math.sin(2 * Math.PI * phases[0]) * 0.7 + oscillator(phases[0] * 2, 'triangle') * 0.15; }
      else if (type === 'keys' || type === 'bell') {
        const ratio = type === 'bell' ? 3.5 : 1, index = type === 'bell' ? 2.2 : 1.4;
        phases[0] += f / sr; modPhase += f * ratio / sr;
        x = Math.sin(2 * Math.PI * phases[0] + index * Math.exp(-t / 0.6) * Math.sin(2 * Math.PI * modPhase)) * 0.35;
      } else if (type === 'pluck') { phases[0] += f / sr; x = oscillator(phases[0], 'sawtooth') * 0.25 * (0.4 + 0.6 * Math.exp(-t / 0.15)); }
      else if (type === 'dark' || type === 'pad') {
        for (let p = 0; p < phases.length; p++) phases[p] += f * Math.pow(2, (p - 1) * 7 / 1200) / sr;
        x = phases.reduce((sum, p) => sum + oscillator(p, 'sawtooth'), 0) / phases.length * (type === 'pad' ? 0.16 : 0.22);
      } else { phases[0] += f / sr; x = oscillator(phases[0], type) * 0.3; }
      out.channels[0][i] = x * env * velocity;
    }
    return out;
  }
}

export class Sampler {
  constructor({ sampleRate = 48000, samples = [], zones = [] } = {}) {
    this.sampleRate = sampleRate; this.samples = new Map(samples.map((s) => [s.id, asAudioBuffer(s.buffer || s)])); this.zones = zones;
  }
  addSample(id, buffer) { this.samples.set(id, asAudioBuffer(buffer)); return this; }
  addZone(zone) { this.zones.push({ low: 0, high: 127, root: 60, velocityLow: 0, velocityHigh: 1, ...zone }); return this; }
  note(midi, { velocity = 1, duration = Infinity, loop = false } = {}) {
    const zone = this.zones.find((z) => midi >= z.low && midi <= z.high && velocity >= z.velocityLow && velocity <= z.velocityHigh);
    if (!zone) throw new RangeError('no sampler zone for note ' + midi + ' and velocity ' + velocity);
    const source = this.samples.get(zone.sample);
    if (!source) throw new Error('missing sample ' + zone.sample);
    const rate = Math.pow(2, (midi - zone.root + (zone.tune || 0) / 100) / 12), ratio = source.sampleRate / this.sampleRate * rate;
    const max = Number.isFinite(duration) ? Math.ceil(duration * this.sampleRate) : Math.ceil((source.length - (zone.start || 0)) / ratio);
    const out = allocate(Math.max(1, max), this.sampleRate, 2), start = zone.start || 0, end = zone.end || source.length, loopStart = zone.loopStart ?? start, loopEnd = zone.loopEnd ?? end;
    for (let i = 0; i < out.length; i++) {
      let x = start + i * ratio;
      if (loop && x >= loopEnd) x = loopStart + (x - loopStart) % (loopEnd - loopStart);
      x = Math.min(end - 1, x); const a = Math.floor(x), b = loop && a + 1 >= loopEnd ? loopStart : Math.min(end - 1, a + 1), f = x - a;
      for (let c = 0; c < 2; c++) { const input = source.channels[Math.min(c, source.numberOfChannels - 1)]; out.channels[c][i] = (input[a] * (1 - f) + input[b] * f) * velocity; }
    }
    return out;
  }
}

export function instrument(type, options = {}) { return ['kick', 'snare', 'clap', 'hat', 'openHat', 'shaker', 'rim', 'perc', 'crash'].includes(type) ? new DrumKit(options) : new Synth({ ...options, type }); }
