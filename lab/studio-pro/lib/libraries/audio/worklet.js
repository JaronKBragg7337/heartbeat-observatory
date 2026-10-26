import { Mixer } from './mixer.js';
import { resampleLinear } from './buffer.js';

class HBAudioGraphProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super(); const config = options.processorOptions;
    this.mixer = new Mixer(config); this.sources = []; this.tick = 0;
    for (const bus of config.graph.buses || []) if (bus.id !== 'master') this.mixer.addBus(bus);
    for (const track of config.graph.tracks || []) this.mixer.addTrack(track);
    this.mixer.configure('master', config.graph.buses.find((b) => b.id === 'master') || {});
    this.port.onmessage = ({ data }) => {
      if (data.type === 'source') this.sources.push({ ...data, buffer: resampleLinear({ length: data.channels[0].length, sampleRate: data.sampleRate, numberOfChannels: data.channels.length, getChannelData: (c) => data.channels[c] }, sampleRate) });
      else if (data.type === 'configure') this.mixer.configure(data.track, data.patch);
      else if (data.type === 'meter') this.port.postMessage({ type: 'meter', request: data.request, meter: this.mixer.meters.get(data.id) || null });
    };
  }
  process(inputs, outputs) {
    const frames = outputs[0][0].length, sources = {};
    if (inputs[0]?.length) sources.external = Array.from({ length: 2 }, (_, c) => inputs[0][Math.min(c, inputs[0].length - 1)]);
    const active = [];
    for (const source of this.sources) {
      const local = this.tick - source.tick;
      if (local >= source.buffer.length) continue;
      const block = sources[source.track] || Array.from({ length: 2 }, () => new Float64Array(frames));
      for (let i = 0; i < frames; i++) { const at = local + i; if (at >= 0 && at < source.buffer.length) for (let c = 0; c < 2; c++) block[c][i] += source.buffer.channels[Math.min(c, source.buffer.numberOfChannels - 1)][at]; }
      sources[source.track] = block; active.push(source);
    }
    this.sources = active;
    const rendered = this.mixer.process(sources, frames, this.tick).get('master');
    for (let c = 0; c < outputs[0].length; c++) outputs[0][c].set(rendered[Math.min(c, 1)]);
    this.tick += frames; return true;
  }
}
registerProcessor('hb-audio-graph', HBAudioGraphProcessor);
