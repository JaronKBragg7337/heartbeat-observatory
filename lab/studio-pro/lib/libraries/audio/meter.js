import { Biquad } from './dsp.js';

export function measureBlock(channels, sampleRate) {
  let peak = 0, energy = 0, count = 0, clipped = 0;
  for (const channel of channels) for (const sample of channel) { const a = Math.abs(sample); if (a > peak) peak = a; if (a >= 1) clipped++; energy += sample * sample; count++; }
  const rms = Math.sqrt(energy / Math.max(1, count));
  return { peak, peakDb: 20 * Math.log10(Math.max(1e-15, peak)), rms, rmsDb: 20 * Math.log10(Math.max(1e-15, rms)), clipped, samples: count / channels.length };
}

function weighted(buffer) {
  const channels = buffer.channels.map(() => {
    const shelf = new Biquad(buffer.sampleRate, { type: 'highshelf', frequency: 1680, Q: 0.707, gainDb: 4 });
    const high = new Biquad(buffer.sampleRate, { type: 'highpass', frequency: 38, Q: 0.5 });
    return { shelf, high };
  });
  return buffer.channels.map((input, c) => Float64Array.from(input, (x) => {
    const s = channels[c].shelf.sample(x);
    return channels[c].high.sample(s);
  }));
}

function blocks(power, size, hop) {
  const out = [];
  for (let start = 0; start + size <= power[0].length; start += hop) {
    let sum = 0;
    for (const channel of power) for (let i = start; i < start + size; i++) sum += channel[i] * channel[i];
    out.push(sum / size);
  }
  return out;
}
const loudnessOfBlocks = (values) => values.length ? -0.691 + 10 * Math.log10(values.reduce((a, b) => a + b, 0) / values.length) : -Infinity;

export function measureLoudness(buffer) {
  const power = weighted(buffer), sr = buffer.sampleRate;
  const gating = blocks(power, Math.round(sr * 0.4), Math.round(sr * 0.1));
  const absolute = gating.filter((z) => -0.691 + 10 * Math.log10(Math.max(1e-20, z)) >= -70);
  const ungated = loudnessOfBlocks(absolute);
  const relative = ungated === -Infinity ? -70 : ungated - 10;
  const gated = absolute.filter((z) => -0.691 + 10 * Math.log10(Math.max(1e-20, z)) >= relative);
  const integrated = loudnessOfBlocks(gated);
  const shortTerm = blocks(power, Math.round(sr * 3), Math.round(sr)).map((z) => -0.691 + 10 * Math.log10(Math.max(1e-20, z)));
  const momentary = blocks(power, Math.round(sr * 0.4), Math.round(sr * 0.1)).map((z) => -0.691 + 10 * Math.log10(Math.max(1e-20, z)));
  const sorted = shortTerm.slice().sort((a, b) => a - b), percentile = (p) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))] : -Infinity;
  return { integrated, shortTerm: shortTerm.at(-1) ?? -Infinity, momentary: momentary.at(-1) ?? -Infinity, range: sorted.length ? percentile(0.95) - percentile(0.1) : 0, gatedBlocks: gated.length };
}

export function truePeak(buffer, oversample = 4) {
  let peak = 0;
  for (const channel of buffer.channels) for (let i = 0; i < channel.length; i++) {
    peak = Math.max(peak, Math.abs(channel[i]));
    if (!i) continue;
    const a = channel[i - 1], b = channel[i];
    for (let j = 1; j < oversample; j++) {
      const f = j / oversample, before = channel[Math.max(0, i - 2)], after = channel[Math.min(channel.length - 1, i + 1)];
      const p0 = before, p1 = a, p2 = b, p3 = after;
      const value = 0.5 * ((2 * p1) + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (-p0 + 3 * p1 - 3 * p2 + p3) * f * f * f);
      peak = Math.max(peak, Math.abs(value));
    }
  }
  return { peak, dbTP: 20 * Math.log10(Math.max(1e-15, peak)) };
}

export function meter(buffer) { return { ...measureBlock(buffer.channels, buffer.sampleRate), loudness: measureLoudness(buffer), truePeak: truePeak(buffer) }; }
