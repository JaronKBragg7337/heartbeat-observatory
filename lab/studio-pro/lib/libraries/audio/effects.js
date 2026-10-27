import { Biquad, DelayLine, clamp, dbToGain, seededRandom } from './dsp.js';
import { AutomationLane, lane } from './automation.js';
import { allocate, asAudioBuffer, resampleLinear } from './buffer.js';

const value = (v, tick) => v instanceof AutomationLane ? v.valueAt(tick) : v;
const blank = (input) => input.map((c) => new Float64Array(c.length));

export class EQ {
  static descriptor = { type: 'eq', latency: 0, tail: 0, parameters: ['bands'] };
  constructor(options = {}, { sampleRate, channels = 2 }) {
    const bands = options.bands || [{ type: 'peaking', frequency: 1000, Q: 0.707, gainDb: 0 }];
    this.filters = Array.from({ length: channels }, () => bands.map((band) => new Biquad(sampleRate, band)));
  }
  process(input, output) { for (let c = 0; c < input.length; c++) for (let i = 0; i < input[c].length; i++) { let x = input[c][i]; for (const f of this.filters[c]) x = f.sample(x); output[c][i] = x; } }
}

export class Gain {
  static descriptor = { type: 'gain', latency: 0, tail: 0, parameters: ['gain'] };
  constructor(options = {}) { this.gain = lane(options.gain ?? 1); }
  process(input, output, tick) { for (let c = 0; c < input.length; c++) for (let i = 0; i < input[c].length; i++) output[c][i] = input[c][i] * this.gain.valueAt(tick + i); }
}

export class Compressor {
  static descriptor = { type: 'compressor', latency: 0, tail: 0, parameters: ['thresholdDb', 'ratio', 'attack', 'release', 'kneeDb', 'makeupDb'] };
  constructor(options = {}, { sampleRate }) {
    this.sampleRate = sampleRate;
    this.thresholdDb = lane(options.thresholdDb ?? -18); this.ratio = lane(options.ratio ?? 3);
    this.attack = lane(options.attack ?? 0.008); this.release = lane(options.release ?? 0.16);
    this.kneeDb = lane(options.kneeDb ?? 6); this.makeupDb = dbToGain(options.makeupDb || 0);
    this.envelope = 0; this.reductionDb = 0;
  }
  process(input, output, tick) {
    for (let i = 0; i < input[0].length; i++) {
      let detector = 0; for (const c of input) detector = Math.max(detector, Math.abs(c[i]));
      const attack = Math.exp(-1 / (this.sampleRate * Math.max(0.00001, this.attack.valueAt(tick + i))));
      const release = Math.exp(-1 / (this.sampleRate * Math.max(0.00001, this.release.valueAt(tick + i))));
      const a = detector > this.envelope ? attack : release;
      this.envelope = a * this.envelope + (1 - a) * detector;
      const level = 20 * Math.log10(Math.max(1e-12, this.envelope)), threshold = this.thresholdDb.valueAt(tick + i), knee = this.kneeDb.valueAt(tick + i), ratio = Math.max(1, this.ratio.valueAt(tick + i));
      const over = level - threshold;
      const compressed = Math.abs(over) <= knee / 2 ? level : over > knee / 2 ? threshold + over / ratio : level - (1 - 1 / ratio) * Math.pow(over + knee / 2, 2) / (2 * knee);
      this.reductionDb = compressed - level;
      const gain = dbToGain(this.reductionDb) * this.makeupDb;
      for (let c = 0; c < input.length; c++) output[c][i] = input[c][i] * gain;
    }
  }
}

export class Limiter {
  static descriptor = { type: 'limiter', latency: 'lookAhead', tail: 'lookAhead', parameters: ['ceilingDb', 'lookAhead', 'release'] };
  constructor(options = {}, { sampleRate, channels = 2 }) {
    this.sampleRate = sampleRate; this.ceilingDb = lane(options.ceilingDb ?? -1); this.lookAhead = lane(options.lookAhead ?? 0.003); this.release = lane(options.release ?? 0.08);
    this.delay = Array.from({ length: channels }, () => new DelayLine(sampleRate * 0.1)); this.gain = 1;
  }
  process(input, output, tick) {
    for (let i = 0; i < input[0].length; i++) {
      let peak = 0; for (const c of input) peak = Math.max(peak, Math.abs(c[i]));
      const ceiling = dbToGain(this.ceilingDb.valueAt(tick + i)), need = Math.min(1, ceiling / Math.max(1e-12, peak));
      const release = Math.exp(-1 / (this.sampleRate * Math.max(0.001, this.release.valueAt(tick + i))));
      this.gain = need < this.gain ? need : release * this.gain + (1 - release) * need;
      const delay = this.sampleRate * this.lookAhead.valueAt(tick + i);
      for (let c = 0; c < input.length; c++) { output[c][i] = this.delay[c].read(delay) * this.gain; this.delay[c].write(input[c][i]); }
    }
  }
}

export class Delay {
  static descriptor = { type: 'delay', latency: 0, tail: 'feedback dependent', parameters: ['time', 'feedback', 'mix', 'lowpass'] };
  constructor(options = {}, { sampleRate, channels = 2 }) {
    this.sampleRate = sampleRate; this.time = lane(options.time ?? 0.25); this.feedback = lane(options.feedback ?? 0.3); this.mix = lane(options.mix ?? 0.25);
    this.delay = Array.from({ length: channels }, () => new DelayLine(sampleRate * (options.maxTime || 4)));
    this.filters = Array.from({ length: channels }, () => new Biquad(sampleRate, { type: 'lowpass', frequency: options.lowpass || 5000, Q: 0.5 }));
  }
  process(input, output, tick) {
    for (let i = 0; i < input[0].length; i++) {
      const wet = [], d = this.time.valueAt(tick + i) * this.sampleRate;
      for (let c = 0; c < input.length; c++) wet[c] = this.delay[c].read(d);
      for (let c = 0; c < input.length; c++) {
        const feedback = clamp(this.feedback.valueAt(tick + i), 0, 0.98), mix = clamp(this.mix.valueAt(tick + i), 0, 1);
        this.delay[c].write(input[c][i] + this.filters[c].sample(wet[(c + 1) % input.length]) * feedback);
        output[c][i] = input[c][i] * (1 - mix) + wet[c] * mix;
      }
    }
  }
}

export class Distortion {
  static descriptor = { type: 'distortion', latency: 0, tail: 0, parameters: ['drive', 'mix', 'tone'] };
  constructor(options = {}, { sampleRate, channels = 2 }) {
    this.drive = lane(options.drive ?? 2); this.mix = lane(options.mix ?? 1); this.normalization = Math.tanh(Math.max(0.01, options.drive ?? 2));
    this.tone = Array.from({ length: channels }, () => new Biquad(sampleRate, { type: 'lowpass', frequency: options.tone || 12000, Q: 0.5 }));
  }
  process(input, output, tick) { for (let c = 0; c < input.length; c++) for (let i = 0; i < input[c].length; i++) { const mix = clamp(this.mix.valueAt(tick + i), 0, 1), wet = this.tone[c].sample(Math.tanh(input[c][i] * this.drive.valueAt(tick + i)) / this.normalization); output[c][i] = input[c][i] * (1 - mix) + wet * mix; } }
}

export class Chorus {
  static descriptor = { type: 'chorus', latency: 0, tail: 0.05, parameters: ['rateHz', 'depth', 'delay', 'mix'] };
  constructor(options = {}, { sampleRate, channels = 2 }) {
    this.sampleRate = sampleRate; this.rateHz = lane(options.rateHz ?? 0.8); this.depth = lane(options.depth ?? 0.006); this.delay = lane(options.delay ?? 0.018); this.mix = lane(options.mix ?? 0.35);
    this.lines = Array.from({ length: channels }, () => new DelayLine(sampleRate * 0.1)); this.phase = 0;
  }
  process(input, output, tick) {
    for (let i = 0; i < input[0].length; i++) {
      this.phase = (this.phase + this.rateHz.valueAt(tick + i) / this.sampleRate) % 1;
      const mix = clamp(this.mix.valueAt(tick + i), 0, 1);
      for (let c = 0; c < input.length; c++) {
        const phase = this.phase + c / input.length, mod = Math.sin(2 * Math.PI * phase), d = (this.delay.valueAt(tick + i) + this.depth.valueAt(tick + i) * mod) * this.sampleRate;
        const wet = this.lines[c].read(d); this.lines[c].write(input[c][i]); output[c][i] = input[c][i] * (1 - mix) + wet * mix;
      }
    }
  }
}

export class Reverb {
  static descriptor = { type: 'reverb', latency: 0, tail: 'decay', parameters: ['decay', 'preDelay', 'mix', 'damping'] };
  constructor(options = {}, { sampleRate, channels = 2 }) {
    this.sampleRate = sampleRate; this.decay = lane(options.decay ?? 1.8); this.preDelay = lane(options.preDelay ?? 0.02); this.mix = lane(options.mix ?? 0.25);
    const lengths = [0.0297, 0.0371, 0.0411, 0.0437];
    this.combs = Array.from({ length: channels }, (_, c) => lengths.map((n, i) => ({ line: new DelayLine(sampleRate * 0.1), length: Math.floor(sampleRate * (n + c * 0.0013)), feedback: 0.7, damp: 0, last: 0, seed: i })));
    this.pre = Array.from({ length: channels }, () => new DelayLine(sampleRate));
    this.damping = options.damping ?? 0.35;
  }
  process(input, output, tick) {
    for (let i = 0; i < input[0].length; i++) {
      const mix = clamp(this.mix.valueAt(tick + i), 0, 1), decay = Math.max(0.05, this.decay.valueAt(tick + i)), pre = this.preDelay.valueAt(tick + i) * this.sampleRate;
      for (let c = 0; c < input.length; c++) {
        const x = this.pre[c].read(pre); this.pre[c].write(input[c][i]); let wet = 0;
        for (const comb of this.combs[c]) {
          const y = comb.line.read(comb.length); comb.damp = y * (1 - this.damping) + comb.damp * this.damping;
          const feedback = Math.pow(10, -3 * comb.length / this.sampleRate / decay);
          comb.line.write(x + comb.damp * feedback); wet += y * 0.25;
        }
        output[c][i] = input[c][i] * (1 - mix) + wet * mix;
      }
    }
  }
}

export class Pitch {
  static descriptor = { type: 'pitch', latency: 0.08, tail: 0.08, parameters: ['semitones'] };
  constructor(options = {}, { sampleRate, channels = 2 }) {
    this.sampleRate = sampleRate; this.semitones = lane(options.semitones ?? 0); this.lines = Array.from({ length: channels }, () => new DelayLine(sampleRate)); this.phase = 0;
  }
  process(input, output, tick) {
    for (let i = 0; i < input[0].length; i++) {
      const ratio = Math.pow(2, this.semitones.valueAt(tick + i) / 12), size = this.sampleRate * 0.06;
      this.phase = (this.phase + (1 - ratio) / size) % 1; if (this.phase < 0) this.phase += 1;
      const a = this.phase * size, b = ((this.phase + 0.5) % 1) * size, f = 0.5 - 0.5 * Math.cos(2 * Math.PI * this.phase);
      for (let c = 0; c < input.length; c++) { output[c][i] = this.lines[c].read(a) * (1 - f) + this.lines[c].read(b) * f; this.lines[c].write(input[c][i]); }
    }
  }
}

const EFFECTS = { eq: EQ, gain: Gain, compressor: Compressor, limiter: Limiter, reverb: Reverb, delay: Delay, distortion: Distortion, chorus: Chorus, pitch: Pitch };
export const effectTypes = Object.freeze(Object.keys(EFFECTS));
export function createEffect(type, options = {}, context) {
  const Effect = EFFECTS[type];
  if (!Effect) throw new RangeError('unknown effect ' + type);
  const instance = new Effect(options, context);
  instance.type = type;
  instance.descriptor = { ...Effect.descriptor, version: 1, stateVersion: 1, ports: { input: 'audio', output: 'audio' }, channelLayouts: ['stereo'], realtime: true, offline: true };
  instance.options = structuredClone(options);
  return instance;
}

export function processEffect(buffer, type, options = {}) {
  const input = asAudioBuffer(buffer), out = allocate(input.length, input.sampleRate, input.numberOfChannels), effect = createEffect(type, options, { sampleRate: input.sampleRate, channels: input.numberOfChannels });
  effect.process(input.channels, out.channels, 0); return out;
}

export function timeStretch(value, factor = 1) {
  const input = asAudioBuffer(value);
  if (factor <= 0) throw new RangeError('stretch factor must be positive');
  const windowSize = Math.max(64, Math.round(input.sampleRate * 0.06)), hop = Math.floor(windowSize / 4), outLength = Math.max(1, Math.round(input.length * factor));
  const out = allocate(outLength, input.sampleRate, input.numberOfChannels), norm = new Float64Array(outLength);
  const count = Math.max(1, Math.ceil((input.length - windowSize) / hop));
  for (let w = 0; w <= count; w++) {
    const sourceAt = Math.min(Math.max(0, input.length - windowSize), w * hop), targetAt = Math.round(sourceAt * factor);
    for (let c = 0; c < input.numberOfChannels; c++) for (let j = 0; j < windowSize; j++) {
      const to = targetAt + j; if (to < 0 || to >= outLength) continue;
      const weight = 0.5 - 0.5 * Math.cos(2 * Math.PI * j / (windowSize - 1));
      out.channels[c][to] += input.channels[c][sourceAt + j] * weight; norm[to] += weight;
    }
  }
  for (let c = 0; c < out.numberOfChannels; c++) for (let i = 0; i < outLength; i++) out.channels[c][i] /= Math.max(1e-9, norm[i]);
  return out;
}

export function pitchTime(value, { semitones = 0, stretch = 1 } = {}) {
  const input = asAudioBuffer(value), shifted = resampleLinear(input, input.sampleRate * Math.pow(2, semitones / 12));
  const pitched = allocate(shifted.length, input.sampleRate, shifted.numberOfChannels);
  for (let c = 0; c < pitched.numberOfChannels; c++) pitched.channels[c].set(shifted.channels[c]);
  return timeStretch(pitched, stretch * input.length / pitched.length);
}

export function makeImpulseResponse(sampleRate, { seconds = 1.8, decay = 3, channels = 2, seed = 0x5eed1234 } = {}) {
  const out = allocate(Math.floor(sampleRate * seconds), sampleRate, channels), random = seededRandom(seed);
  for (const c of out.channels) for (let i = 0; i < c.length; i++) c[i] = (random() * 2 - 1) * Math.pow(1 - i / c.length, decay);
  return out;
}
