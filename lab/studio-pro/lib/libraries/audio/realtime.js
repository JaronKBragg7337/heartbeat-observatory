import { toWebAudioBuffer } from './buffer.js';

export class BrowserAudioEngine {
  constructor(context) { this.context = context; this.node = null; this.ready = null; }
  async start(graph) {
    const context = this.context;
    if (!context.audioWorklet) throw new Error('AudioWorklet is required for the shared DSP graph');
    if (!this.ready) this.ready = context.audioWorklet.addModule(new URL('./worklet.js', import.meta.url));
    await this.ready;
    this.node = new AudioWorkletNode(context, 'hb-audio-graph', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2], channelCount: 2, channelCountMode: 'explicit', processorOptions: { sampleRate: context.sampleRate, blockSize: 128, graph: graph.describe() } });
    this.node.connect(context.destination); return this;
  }
  play(buffer, { track = 'master', tick = 0, eventId = null } = {}) {
    if (!this.node) throw new Error('start the audio engine first');
    const portable = toWebAudioBuffer(buffer, this.context), data = Array.from({ length: portable.numberOfChannels }, (_, c) => portable.getChannelData(c).slice());
    this.node.port.postMessage({ type: 'source', track, tick, eventId, sampleRate: portable.sampleRate, channels: data }, data.map((c) => c.buffer));
  }
  configure(track, patch) { this.node?.port.postMessage({ type: 'configure', track, patch }); }
  meter(id) { return new Promise((resolve) => { const request = Math.random().toString(36).slice(2), listener = ({ data }) => { if (data.type === 'meter' && data.request === request) { this.node.port.removeEventListener('message', listener); resolve(data.meter); } }; this.node.port.addEventListener('message', listener); this.node.port.start(); this.node.port.postMessage({ type: 'meter', id, request }); }); }
  stop() { this.node?.disconnect(); this.node = null; }
}
