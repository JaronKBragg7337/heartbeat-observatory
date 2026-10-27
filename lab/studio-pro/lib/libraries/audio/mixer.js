import { allocate, asAudioBuffer } from './buffer.js';
import { lane } from './automation.js';
import { createEffect } from './effects.js';
import { clamp } from './dsp.js';
import { measureBlock } from './meter.js';

function normalizeStrip(def, sampleRate, channels) {
  return {
    ...def,
    definition: def.definition || structuredClone(def),
    gain: lane(def.gain ?? 1), pan: lane(def.pan ?? 0), mute: !!def.mute, solo: !!def.solo, polarity: def.polarity === -1 ? -1 : 1,
    sends: (def.sends || []).map((s) => ({ ...s, gain: lane(s.gain ?? 1) })),
    processors: (def.effects || []).map((effect) => createEffect(effect.type, effect, { sampleRate, channels })),
  };
}

export class Mixer {
  constructor({ sampleRate = 48000, channels = 2, blockSize = 128 } = {}) {
    if (channels !== 2) throw new RangeError('this mixer currently uses stereo buses');
    this.sampleRate = sampleRate; this.channels = channels; this.blockSize = blockSize;
    this.tracks = new Map(); this.buses = new Map(); this.meters = new Map(); this.addBus({ id: 'master' });
  }
  addTrack(def) {
    if (!def.id || this.tracks.has(def.id)) throw new Error('track id must be unique');
    const track = normalizeStrip({ bus: 'master', ...def }, this.sampleRate, 2);
    this.tracks.set(track.id, track); return this;
  }
  addBus(def) {
    if (!def.id || this.buses.has(def.id)) throw new Error('bus id must be unique');
    const bus = normalizeStrip({ ...def, sends: def.sends || [] }, this.sampleRate, 2);
    this.buses.set(bus.id, bus); return this;
  }
  configure(id, patch) {
    const strip = this.tracks.get(id) || this.buses.get(id);
    if (!strip) throw new Error('unknown mixer strip ' + id);
    const normalized = normalizeStrip({ ...strip.definition, ...patch, effects: patch.effects || strip.definition.effects || [] }, this.sampleRate, 2);
    Object.assign(strip, normalized); return this;
  }
  order() {
    const order = [], visiting = new Set(), visited = new Set();
    const visit = (id) => {
      if (visited.has(id)) return;
      if (visiting.has(id)) throw new Error('bus routing cycle at ' + id);
      visiting.add(id);
      for (const send of this.buses.get(id).sends) { if (!this.buses.has(send.bus)) throw new Error('unknown send bus ' + send.bus); visit(send.bus); }
      visiting.delete(id); visited.add(id); order.push(id);
    };
    for (const id of this.buses.keys()) visit(id);
    return order.reverse();
  }
  _blocks(frames) { return Array.from({ length: 2 }, () => new Float64Array(frames)); }
  process(sources, frames, tick = 0) {
    const inputs = new Map([...this.buses.keys()].map((id) => [id, this._blocks(frames)])), outputs = new Map();
    const solo = [...this.tracks.values()].some((t) => t.solo);
    for (const track of this.tracks.values()) {
      const input = sources[track.id] || sources.get?.(track.id);
      let block = input || this._blocks(frames);
      if (track.mute || (solo && !track.solo)) block = this._blocks(frames);
      for (const effect of track.processors) { const out = this._blocks(frames); effect.process(block, out, tick); block = out; }
      const direct = track.bus || 'master', routed = [{ bus: direct, gain: new AutomationLaneValue(1) }, ...track.sends];
      for (const send of routed) {
        if (!inputs.has(send.bus)) throw new Error('unknown track destination ' + send.bus);
        for (let i = 0; i < frames; i++) {
          const pan = clamp(track.pan.valueAt(tick + i), -1, 1), left = Math.cos((pan + 1) * Math.PI / 4), right = Math.sin((pan + 1) * Math.PI / 4);
          const gain = track.gain.valueAt(tick + i) * send.gain.valueAt(tick + i) * track.polarity;
          inputs.get(send.bus)[0][i] += block[0][i] * left * gain;
          inputs.get(send.bus)[1][i] += block[1][i] * right * gain;
        }
      }
    }
    for (const id of this.order()) {
      const bus = this.buses.get(id);
      let block = inputs.get(id);
      if (bus.mute) block = this._blocks(frames);
      for (const effect of bus.processors) { const out = this._blocks(frames); effect.process(block, out, tick); block = out; }
      const gain = new Float64Array(frames);
      for (let i = 0; i < frames; i++) gain[i] = bus.gain.valueAt(tick + i) * bus.polarity;
      for (const c of block) for (let i = 0; i < frames; i++) c[i] *= gain[i];
      outputs.set(id, block); this.meters.set(id, measureBlock(block, this.sampleRate));
      for (const send of bus.sends) for (let c = 0; c < 2; c++) for (let i = 0; i < frames; i++) inputs.get(send.bus)[c][i] += block[c][i] * send.gain.valueAt(tick + i);
    }
    return outputs;
  }
  render(sources, { length, startTick = 0, tail = 0 } = {}) {
    const list = Object.entries(sources).map(([track, source]) => ({ track, buffer: asAudioBuffer(source.buffer || source), offset: source.offset || 0, gain: source.gain ?? 1 }));
    const duration = Math.max(0, ...list.map((s) => s.offset + s.buffer.length));
    length = Math.ceil(length ?? duration + tail * this.sampleRate);
    const out = allocate(length, this.sampleRate, 2), stems = new Map([...this.buses.keys()].map((id) => [id, allocate(length, this.sampleRate, 2)]));
    for (let at = 0; at < length; at += this.blockSize) {
      const frames = Math.min(this.blockSize, length - at), blocks = {};
      for (const source of list) {
        const block = this._blocks(frames);
        for (let i = 0; i < frames; i++) {
          const sourceAt = startTick + at + i - source.offset;
          if (sourceAt >= 0 && sourceAt < source.buffer.length) for (let c = 0; c < 2; c++) block[c][i] = source.buffer.channels[Math.min(c, source.buffer.numberOfChannels - 1)][sourceAt] * source.gain;
        }
        blocks[source.track] = block;
      }
      const rendered = this.process(blocks, frames, startTick + at);
      for (const [id, block] of rendered) for (let c = 0; c < 2; c++) stems.get(id).channels[c].set(block[c], at);
    }
    return { master: stems.get('master'), stems, meters: Object.fromEntries(this.meters) };
  }
}

class AutomationLaneValue { constructor(v) { this.v = v; } valueAt() { return this.v; } }
