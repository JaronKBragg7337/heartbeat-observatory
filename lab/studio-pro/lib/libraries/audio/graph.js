import { Mixer } from './mixer.js';
import { allocate, asAudioBuffer, mixInto } from './buffer.js';

export class AudioGraph {
  constructor(options = {}) {
    this.mixer = new Mixer(options);
    this.sampleRate = options.sampleRate || 48000;
    this.sources = [];
  }
  addTrack(def) { this.mixer.addTrack(def); return this; }
  addBus(def) { this.mixer.addBus(def); return this; }
  addSource(track, buffer, { tick = 0, gain = 1, eventId = null } = {}) {
    this.sources.push({ track, buffer: asAudioBuffer(buffer), tick, gain, eventId });
    return this;
  }
  render({ length, tail = 0 } = {}) {
    const sources = {};
    for (const track of new Set(this.sources.map((s) => s.track))) {
      const voices = this.sources.filter((s) => s.track === track), end = Math.max(...voices.map((s) => s.tick + s.buffer.length));
      const joined = allocate(end, this.sampleRate, 2);
      for (const source of voices) mixInto(joined, source.buffer, source.tick, source.gain);
      sources[track] = { buffer: joined, offset: 0, gain: 1 };
    }
    const duration = Math.max(0, ...this.sources.map((s) => s.tick + s.buffer.length));
    return this.mixer.render(sources, { length: length ?? duration + Math.ceil(tail * this.sampleRate) });
  }
  describe() {
    return {
      sampleRate: this.sampleRate, channels: 2,
      tracks: [...this.mixer.tracks.values()].map((t) => ({ ...t.definition, id: t.id })),
      buses: [...this.mixer.buses.values()].map((b) => ({ ...b.definition, id: b.id })),
    };
  }
}
