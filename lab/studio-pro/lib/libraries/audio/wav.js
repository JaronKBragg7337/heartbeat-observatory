import { allocate, asAudioBuffer } from './buffer.js';
import { clamp, seededRandom } from './dsp.js';

const ascii = (view, at, text) => { for (let i = 0; i < text.length; i++) view.setUint8(at + i, text.charCodeAt(i)); };

export function encodeWAV(value, { bitDepth = 16, dither = false, seed = 1 } = {}) {
  const buffer = asAudioBuffer(value);
  if (![16, 24, 32].includes(bitDepth)) throw new RangeError('WAV bitDepth must be 16, 24, or 32-bit float');
  const bytes = bitDepth / 8, channels = buffer.numberOfChannels, dataSize = buffer.length * channels * bytes;
  const out = new DataView(new ArrayBuffer(44 + dataSize)), random = seededRandom(seed);
  ascii(out, 0, 'RIFF'); out.setUint32(4, 36 + dataSize, true); ascii(out, 8, 'WAVEfmt ');
  out.setUint32(16, 16, true); out.setUint16(20, bitDepth === 32 ? 3 : 1, true); out.setUint16(22, channels, true);
  out.setUint32(24, buffer.sampleRate, true); out.setUint32(28, buffer.sampleRate * channels * bytes, true);
  out.setUint16(32, channels * bytes, true); out.setUint16(34, bitDepth, true); ascii(out, 36, 'data'); out.setUint32(40, dataSize, true);
  let at = 44;
  for (let i = 0; i < buffer.length; i++) for (let c = 0; c < channels; c++) {
    let sample = clamp(buffer.channels[c][i], -1, 1);
    if (dither && bitDepth < 32) sample += (random() - random()) / (bitDepth === 16 ? 65536 : 16777216);
    if (bitDepth === 32) out.setFloat32(at, sample, true);
    else if (bitDepth === 24) { const n = Math.round(clamp(sample, -1, 1) * 8388607); out.setUint8(at, n & 255); out.setUint8(at + 1, (n >> 8) & 255); out.setUint8(at + 2, (n >> 16) & 255); }
    else out.setInt16(at, Math.round(sample * 32767), true);
    at += bytes;
  }
  return new Uint8Array(out.buffer);
}

export function decodeWAV(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const tag = (at, n) => String.fromCharCode(...data.subarray(at, at + n));
  if (tag(0, 4) !== 'RIFF' || tag(8, 4) !== 'WAVE') throw new Error('not a RIFF/WAVE file');
  let at = 12, format, bits, channels, sampleRate, samples;
  while (at + 8 <= data.length) {
    const size = view.getUint32(at + 4, true), id = tag(at, 4);
    if (id === 'fmt ') { format = view.getUint16(at + 8, true); channels = view.getUint16(at + 10, true); sampleRate = view.getUint32(at + 12, true); bits = view.getUint16(at + 22, true); }
    if (id === 'data') samples = data.subarray(at + 8, at + 8 + size);
    at += 8 + size + (size & 1);
  }
  if (!samples || !channels || ![1, 3].includes(format) || ![16, 24, 32].includes(bits)) throw new Error('unsupported WAV encoding');
  const bytesPerSample = bits / 8, length = Math.floor(samples.length / bytesPerSample / channels), out = allocate(length, sampleRate, channels), dv = new DataView(samples.buffer, samples.byteOffset, samples.byteLength);
  for (let i = 0; i < length; i++) for (let c = 0; c < channels; c++) {
    const at = (i * channels + c) * bytesPerSample;
    out.channels[c][i] = bits === 32 ? dv.getFloat32(at, true) : bits === 24 ? ((dv.getUint8(at) | dv.getUint8(at + 1) << 8 | dv.getUint8(at + 2) << 16) << 8 >> 8) / 8388608 : dv.getInt16(at, true) / 32768;
  }
  return out;
}
