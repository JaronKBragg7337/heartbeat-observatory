import { allocate, applyGain, asAudioBuffer } from './buffer.js';
import { createEffect } from './effects.js';
import { measureLoudness, truePeak } from './meter.js';
import { clamp, dbToGain } from './dsp.js';

export function processChain(value, chain = [], { startTick = 0, blockSize = 128 } = {}) {
  const input = asAudioBuffer(value), out = allocate(input.length, input.sampleRate, input.numberOfChannels);
  const effects = chain.filter((e) => !e.bypass).map((e) => createEffect(e.type, e, { sampleRate: input.sampleRate, channels: input.numberOfChannels }));
  for (let at = 0; at < input.length; at += blockSize) {
    const frames = Math.min(blockSize, input.length - at);
    let block = input.channels.map((c) => c.slice(at, at + frames));
    for (const effect of effects) { const next = block.map(() => new Float64Array(frames)); effect.process(block, next, startTick + at); block = next; }
    for (let c = 0; c < out.numberOfChannels; c++) out.channels[c].set(block[c], at);
  }
  return out;
}

export function limitPeak(value, { ceilingDb = -1, lookAhead = 0.0015, release = 0.06, truePeakDetection = true } = {}) {
  const input = asAudioBuffer(value), out = input.clone(), total = input.length, sr = input.sampleRate, ceiling = dbToGain(ceilingDb);
  const W = Math.max(1, Math.floor(sr * lookAhead)), rel = Math.exp(-1 / (sr * release)), need = new Float64Array(total);
  let minimum = 1;
  const middle = (a, i) => truePeakDetection && i > 0 && i + 2 < total ? Math.abs((-a[i - 1] + 9 * a[i] + 9 * a[i + 1] - a[i + 2]) / 16) : 0;
  for (let i = 0; i < total; i++) {
    let peak = 0;
    for (const channel of input.channels) peak = Math.max(peak, Math.abs(channel[i]), middle(channel, i));
    const required = Math.min(1, ceiling / Math.max(1e-12, peak));
    minimum = required < minimum ? required : 1 - (1 - minimum) * rel; need[i] = minimum;
  }
  const minima = new Float64Array(total), queue = new Int32Array(total);
  let head = 0, tail = 0;
  for (let i = 0; i < total; i++) {
    while (tail > head && need[queue[tail - 1]] >= need[i]) tail--;
    queue[tail++] = i; if (queue[head] < i - W) head++;
    if (i >= W) minima[i - W] = need[queue[head]];
  }
  for (let i = Math.max(0, total - W); i < total; i++) minima[i] = need[queue[head]];
  let accumulator = W;
  for (let i = 0; i < total; i++) {
    accumulator += minima[i] - (i >= W ? minima[i - W] : 1);
    const gain = accumulator / W;
    for (const channel of out.channels) channel[i] *= gain;
  }
  return out;
}

export function masterAudio(value, options = {}) {
  const target = options.targetLUFS ?? -14, ceilingDb = options.ceilingDb ?? -1;
  let out = processChain(value, options.chain || [
    { type: 'eq', bands: [{ type: 'highpass', frequency: 25, Q: 0.5 }, { type: 'peaking', frequency: 3200, Q: 0.7, gainDb: 1.5 }] },
    { type: 'compressor', thresholdDb: -16, ratio: 2.5, attack: 0.008, release: 0.2, kneeDb: 6 },
    { type: 'distortion', drive: 1.15, mix: 0.2 },
  ]);
  const initial = measureLoudness(out).integrated;
  if (Number.isFinite(initial)) applyGain(out, dbToGain(target - initial));
  out = limitPeak(out, options);
  for (let i = 0; i < 8; i++) {
    const measured = measureLoudness(out).integrated;
    if (!Number.isFinite(measured) || Math.abs(measured - target) <= 0.01) break;
    applyGain(out, dbToGain(target - measured));
    out = limitPeak(out, options);
  }
  const loudness = measureLoudness(out), peak = truePeak(out);
  return { buffer: out, loudness, truePeak: peak, targetLUFS: target, ceilingDb, withinTolerance: Math.abs(loudness.integrated - target) <= (options.tolerance ?? 0.1) };
}
