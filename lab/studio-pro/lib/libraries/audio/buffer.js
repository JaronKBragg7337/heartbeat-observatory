export class AudioBufferData {
  constructor({ length, sampleRate, numberOfChannels = 2, channels } = {}) {
    if (!Number.isInteger(length) || length < 0) throw new RangeError('length must be a non-negative integer');
    if (!Number.isFinite(sampleRate) || sampleRate <= 0) throw new RangeError('sampleRate must be positive');
    this.length = length;
    this.sampleRate = sampleRate;
    this.numberOfChannels = numberOfChannels;
    this.channels = channels || Array.from({ length: numberOfChannels }, () => new Float64Array(length));
    if (this.channels.length !== numberOfChannels || this.channels.some((c) => c.length !== length)) throw new RangeError('channel shape mismatch');
  }
  get duration() { return this.length / this.sampleRate; }
  getChannelData(channel) { return this.channels[channel]; }
  clone() { return new AudioBufferData({ length: this.length, sampleRate: this.sampleRate, numberOfChannels: this.numberOfChannels, channels: this.channels.map((c) => new Float64Array(c)) }); }
  slice(start = 0, end = this.length) {
    start = Math.max(0, Math.min(this.length, start)); end = Math.max(start, Math.min(this.length, end));
    return new AudioBufferData({ length: end - start, sampleRate: this.sampleRate, numberOfChannels: this.numberOfChannels, channels: this.channels.map((c) => c.slice(start, end)) });
  }
  toJSON() { return { length: this.length, sampleRate: this.sampleRate, numberOfChannels: this.numberOfChannels }; }
}

export function asAudioBuffer(value) {
  if (value instanceof AudioBufferData) return value;
  if (!value || !Number.isFinite(value.sampleRate) || !Number.isInteger(value.length)) throw new TypeError('expected an AudioBuffer or AudioBufferData');
  return new AudioBufferData({ length: value.length, sampleRate: value.sampleRate, numberOfChannels: value.numberOfChannels || 1, channels: Array.from({ length: value.numberOfChannels || 1 }, (_, c) => Float64Array.from(value.getChannelData(c))) });
}

export function toWebAudioBuffer(value, context) {
  const source = asAudioBuffer(value), out = context.createBuffer(source.numberOfChannels, source.length, source.sampleRate);
  for (let c = 0; c < source.numberOfChannels; c++) out.copyToChannel(Float32Array.from(source.channels[c]), c);
  return out;
}

export function allocate(length, sampleRate, channels = 2) { return new AudioBufferData({ length: Math.ceil(length), sampleRate, numberOfChannels: channels }); }

export function mixInto(destination, source, offset = 0, gain = 1) {
  source = asAudioBuffer(source);
  if (source.sampleRate !== destination.sampleRate) throw new RangeError('sample rates must match; resample explicitly');
  for (let c = 0; c < destination.numberOfChannels; c++) {
    const input = source.channels[Math.min(c, source.numberOfChannels - 1)], output = destination.channels[c];
    for (let i = 0; i < input.length; i++) {
      const at = offset + i;
      if (at >= 0 && at < output.length) output[at] += input[i] * gain;
    }
  }
  return destination;
}

export function applyGain(buffer, gain) {
  for (const channel of buffer.channels) for (let i = 0; i < channel.length; i++) channel[i] *= gain;
  return buffer;
}

export function concatAudio(buffers, sampleRate = buffers[0]?.sampleRate) {
  if (!buffers.length) return allocate(0, sampleRate, 2);
  buffers = buffers.map(asAudioBuffer);
  const channels = Math.max(...buffers.map((b) => b.numberOfChannels));
  const out = allocate(buffers.reduce((n, b) => n + b.length, 0), sampleRate, channels);
  let at = 0;
  for (const buffer of buffers) { mixInto(out, buffer, at); at += buffer.length; }
  return out;
}

export function resampleLinear(value, sampleRate) {
  const source = asAudioBuffer(value);
  if (source.sampleRate === sampleRate) return source.clone();
  const length = Math.max(1, Math.round(source.length * sampleRate / source.sampleRate));
  const out = allocate(length, sampleRate, source.numberOfChannels), ratio = source.sampleRate / sampleRate;
  for (let c = 0; c < out.numberOfChannels; c++) for (let i = 0; i < length; i++) {
    const x = Math.min(source.length - 1, i * ratio), a = Math.floor(x), b = Math.min(a + 1, source.length - 1), f = x - a;
    out.channels[c][i] = source.channels[c][a] * (1 - f) + source.channels[c][b] * f;
  }
  return out;
}
