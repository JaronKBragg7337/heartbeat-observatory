import { AudioGraph } from './graph.js';
import { AudioHistory } from './history.js';
import { DrumKit, Sampler, Synth } from './instruments.js';

export class AudioEngine {
  constructor({ sampleRate = 48000, historyId = 'audio', clocks = [], kit, seed = 1 } = {}) {
    this.sampleRate = sampleRate;
    this.graph = new AudioGraph({ sampleRate });
    this.history = new AudioHistory({ sampleRate, historyId, clocks });
    this.drums = new DrumKit({ sampleRate, seed, kit });
  }
  addTrack(def) { this.graph.addTrack(def); return this; }
  addBus(def) { this.graph.addBus(def); return this; }
  addSound(buffer, options) {
    const sound = this.history.makeSound(buffer, options);
    this.graph.addSource(options.track || 'master', sound.buffer, { tick: sound.event.at.tick, eventId: sound.event.eventId });
    return sound;
  }
  note({ track = 'master', instrument = 'keys', note = 60, tick = 0, duration = 0.5, velocity = 1, causeIds = [], seed = 1, glideFrom } = {}) {
    const synth = new Synth({ sampleRate: this.sampleRate, type: instrument, seed });
    return this.addSound(synth.note(note, { duration, velocity, glideFrom }), { at: tick, causeIds, track, data: { instrument, note, duration, velocity } });
  }
  drum({ track = 'master', drum = 'kick', tick = 0, velocity = 1, pan = 0, causeIds = [], seed = 1 } = {}) {
    return this.addSound(this.drums.hit(drum, { velocity, pan, seed }), { at: tick, causeIds, track, data: { instrument: drum, velocity } });
  }
  sample(sampler, { track = 'master', note = 60, tick = 0, velocity = 1, duration, causeIds = [], loop = false } = {}) {
    if (!(sampler instanceof Sampler)) throw new TypeError('sample expects a Sampler');
    return this.addSound(sampler.note(note, { velocity, duration, loop }), { at: tick, causeIds, track, data: { instrument: 'sampler', note, velocity } });
  }
  contact(contact, options = {}) {
    const sound = this.history.contact(contact, options);
    this.graph.addSource(options.track || 'master', sound.buffer, { tick: sound.event.at.tick, eventId: sound.event.eventId });
    return sound;
  }
  tap(tap, options = {}) {
    const sound = this.history.tap(tap, options);
    this.graph.addSource(options.track || 'master', sound.buffer, { tick: sound.event.at.tick, eventId: sound.event.eventId });
    return sound;
  }
  render(options = {}) {
    const rendered = this.graph.render(options);
    this.history.event('render.completed', rendered.master.length, { causes: this.history.history.events.filter((e) => e.type === 'sound.made').map((e) => e.eventId), data: { frames: rendered.master.length, sampleRate: this.sampleRate } });
    return rendered;
  }
}
