export class AutomationLane {
  constructor(initial = 0, points = []) {
    this.initial = initial;
    this.points = points.map((p) => Array.isArray(p) ? { tick: p[0], value: p[1], curve: p[2] } : p)
      .sort((a, b) => a.tick - b.tick);
    if (this.points.some((p) => !Number.isInteger(p.tick) || !Number.isFinite(p.value))) throw new TypeError('automation points need integer ticks and finite values');
  }
  valueAt(tick) {
    const points = this.points;
    if (!points.length || tick < points[0].tick) return this.initial;
    let next = 0;
    while (next < points.length && points[next].tick <= tick) next++;
    if (!next) return this.initial;
    const a = points[next - 1], b = points[next];
    if (!b) return a.value;
    const f = Math.max(0, Math.min(1, (tick - a.tick) / (b.tick - a.tick))), curve = b.curve || 'linear';
    if (curve === 'step') return a.value;
    if (curve === 'exponential') {
      if (a.value <= 0 || b.value <= 0) throw new RangeError('exponential automation needs positive values');
      return a.value * Math.pow(b.value / a.value, f);
    }
    if (curve === 'smooth') { const s = f * f * (3 - 2 * f); return a.value + (b.value - a.value) * s; }
    if (curve !== 'linear') throw new RangeError('unknown automation curve ' + curve);
    return a.value + (b.value - a.value) * f;
  }
  values(tick, length) { return Float64Array.from({ length }, (_, i) => this.valueAt(tick + i)); }
}

export const lane = (value) => value instanceof AutomationLane ? value : typeof value === 'number' ? new AutomationLane(value) : new AutomationLane(value.initial, value.points);
