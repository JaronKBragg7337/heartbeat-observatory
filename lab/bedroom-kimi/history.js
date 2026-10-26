export class EventHistory {
  constructor(seed) {
    this.data = structuredClone(seed);
    this.events = this.data.events;
    this.objects = new Map(this.data.objects.map((object) => [object.id, object]));
    this.traces = new Map(this.data.traces.map((trace) => [trace.id, trace.samples]));
    this.listeners = new Set();
    this.serial = { event: this.events.length, footstep: 0, sound: 0 };
  }

  next(prefix) {
    const key = prefix === 'F' ? 'footstep' : prefix === 'A' ? 'sound' : 'event';
    this.serial[key] += 1;
    return `${prefix}-${String(this.serial[key]).padStart(4, '0')}`;
  }

  add(event) {
    const complete = {
      id: event.id || this.next('E'),
      t: Number(event.t.toFixed(3)),
      source: event.source || 'made',
      ...event,
    };
    complete.t = Number(event.t.toFixed(3));
    this.events.push(complete);
    this.listeners.forEach((listener) => listener(complete));
    return complete;
  }

  sample(id, t, position, velocity) {
    if (!this.traces.has(id)) this.traces.set(id, []);
    const samples = this.traces.get(id);
    samples.push({ t: Number(t.toFixed(3)), position: position.map((n) => Number(n.toFixed(4))), velocity: velocity.map((n) => Number(n.toFixed(4))) });
    if (samples.length > 1200) samples.shift();
  }

  for(id) {
    return this.events.filter((event) => event.id === id || event.object === id || event.target === id || event.parent === id).sort((a, b) => a.t - b.t);
  }

  between(start, end) {
    return this.events.filter((event) => event.t >= start && event.t <= end).sort((a, b) => a.t - b.t);
  }

  story(id) {
    const object = this.objects.get(id);
    const events = this.for(id);
    const samples = this.traces.get(id) || [];
    const last = samples.at(-1);
    return { object, events, samples, summary: { events: events.length, samples: samples.length, lastPosition: last?.position || null, lastSpeed: last ? Math.hypot(...last.velocity) : 0 } };
  }

  toJSON() {
    return {
      ...this.data,
      exportedAt: new Date().toISOString(),
      objects: [...this.objects.values()],
      events: this.events,
      traces: [...this.traces.entries()].map(([id, samples]) => ({ id, rate: '4 Hz maximum; retained rolling session', samples })),
    };
  }

  download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(this.toJSON(), null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'bedroom-kimi-live-history.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
