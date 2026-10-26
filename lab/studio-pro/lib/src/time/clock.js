// Clocks: every stream counts in its own integer ticks at its own rational rate; each clock has an EXACT mapping to
// project time (rational seconds). Nothing here uses floats except the optional toNumber() helpers.
//
// Clock definitions (plain JSON, stored in hb-history/2 meta and hb-project/1 manifests):
//   linear     { id, kind:'linear', rate:[num,den], toProject?:{offset:"0", scale:"1"} }
//              ticks per clock-second = num/den.  project_s = offset + scale * tick/rate.   (physics steps, audio samples, video frames)
//   piecewise  { id, kind:'piecewise', rate:[num,den], points:[{tick, project}], tail?:{perTick:"p/q"} }
//              straight lines between points (a slow-motion time map). Needs >= 2 points, or 1 point + tail.
//   musical    { id, kind:'musical', ppq:960, offset:"0", tempo:[{beat:"0", bpm:"140"}, {beat:"32", bpm:"150"}], meter?:[{bar:1,num:4,den:4}] }
//              beats/tempo map. 1 beat = 1 quarter note. Tempo changes are steps (no ramps: a ramp is refused, not approximated).
// Optional on any clock: inferred:true, source:"why we believe this rate", unit:"step"|"sample"|"frame"|"tick".
import { Rat, ZERO, ONE } from './rational.js';

const asBig = (t) => (typeof t === 'bigint' ? t : BigInt(typeof t === 'string' ? t : Math.round(t)));
const isRationalLike = (x) => { try { Rat.of(x); return true; } catch { return false; } };

function compile(c) {
  const segs = [];                                   // [{t0:bigint, p0:Rat, slope:Rat}]  slope = project seconds per tick
  if (c.kind === 'linear' && c.unmapped) {
    const [n, d] = c.rate; if (!(n > 0 && d > 0)) throw new RangeError(`clock ${c.id}: rate must be positive`);
    return segs;                                     // counts ticks only: no mapping to project time (e.g. a wall clock)
  } else if (c.kind === 'linear') {
    const [n, d] = c.rate; if (!(n > 0 && d > 0)) throw new RangeError(`clock ${c.id}: rate must be positive`);
    const off = Rat.of((c.toProject && c.toProject.offset) ?? 0), sc = Rat.of((c.toProject && c.toProject.scale) ?? 1);
    segs.push({ t0: 0n, p0: off, slope: sc.mul(new Rat(BigInt(d), BigInt(n))) });
  } else if (c.kind === 'piecewise') {
    const pts = (c.points || []).map((p) => ({ t: asBig(p.tick), p: Rat.of(p.project) }));
    for (let i = 1; i < pts.length; i++) if (pts[i].t <= pts[i - 1].t || pts[i].p.lte(pts[i - 1].p)) throw new RangeError(`clock ${c.id}: points must increase in tick and project time`);
    if (!pts.length) throw new RangeError(`clock ${c.id}: no points`);
    for (let i = 0; i < pts.length - 1; i++) segs.push({ t0: pts[i].t, p0: pts[i].p, slope: pts[i + 1].p.sub(pts[i].p).div(new Rat(pts[i + 1].t - pts[i].t)) });
    const last = pts[pts.length - 1];
    let tail = c.tail && c.tail.perTick !== undefined ? Rat.of(c.tail.perTick) : (segs.length ? segs[segs.length - 1].slope : null);
    if (!tail) throw new RangeError(`clock ${c.id}: a single point needs tail.perTick`);
    segs.push({ t0: last.t, p0: last.p, slope: tail });
  } else if (c.kind === 'musical') {
    const ppq = BigInt(c.ppq || 960), tempo = (c.tempo && c.tempo.length ? c.tempo : null);
    if (!tempo) throw new RangeError(`clock ${c.id}: musical clock needs a tempo list`);
    let p = Rat.of(c.offset ?? 0);
    for (let i = 0; i < tempo.length; i++) {
      const T = tempo[i]; if (T.ramp) throw new RangeError(`clock ${c.id}: tempo ramps are not supported (use steps)`);
      const beat = Rat.of(T.beat), bpm = Rat.of(T.bpm), t0r = beat.mul(new Rat(ppq));
      if (!t0r.isInteger) throw new RangeError(`clock ${c.id}: tempo change at beat ${beat} is not on a tick (ppq ${ppq})`);
      if (i === 0 && !beat.eq(0)) throw new RangeError(`clock ${c.id}: first tempo must be at beat 0`);
      if (bpm.lte(0)) throw new RangeError(`clock ${c.id}: bpm must be positive`);
      const slope = new Rat(60n).div(bpm.mul(new Rat(ppq)));
      if (i > 0) { const prev = segs[i - 1]; if (t0r.n <= prev.t0) throw new RangeError(`clock ${c.id}: tempo changes must be in order`); p = prev.p0.add(prev.slope.mul(new Rat(t0r.n - prev.t0))); }
      segs.push({ t0: t0r.n, p0: p, slope });
    }
  } else throw new RangeError(`clock ${c.id}: unknown kind ${c.kind}`);
  return segs;
}

export class ClockSet {
  constructor(defs = []) { this.defs = new Map(); this._c = new Map(); for (const d of defs) this.add(d); }
  add(def) {
    if (!def || !def.id) throw new TypeError('clock needs an id');
    const segs = compile(def); this.defs.set(def.id, def); this._c.set(def.id, segs);
    if (def.kind === 'musical') def._ppq = def.ppq || 960;
    return this;
  }
  has(id) { return this.defs.has(id); }
  get(id) { const d = this.defs.get(id); if (!d) throw new RangeError('unknown clock ' + id); return d; }
  ids() { return [...this.defs.keys()]; }
  toJSON() { return [...this.defs.values()].map((d) => { const { _ppq, ...rest } = d; return rest; }); }
  mapped(id) { const s = this._c.get(id); return !!s && s.length > 0; }
  _segFor(id, tick) { const s = this._c.get(id) || (this.get(id), this._c.get(id)); let lo = 0, hi = s.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (s[m].t0 <= tick) lo = m; else hi = m - 1; } return s[lo]; }
  // tick (integer) -> exact project seconds
  toProject(id, tick) { if (!this.mapped(id)) { this.get(id); throw new RangeError('clock ' + id + ' has no mapping to project time'); } const t = asBig(tick), g = this._segFor(id, t); return g.p0.add(g.slope.mul(new Rat(t - g.t0))); }
  // float seconds for indexing/sorting/display only (exact answers come from toProject)
  toProjectNumber(id, tick) { const g = this._segFor(id, asBig(tick)); const f = g.f || (g.f = { p0: g.p0.toNumber(), slope: g.slope.toNumber(), t0: Number(g.t0) }); return f.p0 + f.slope * (Number(tick) - f.t0); }
  // project seconds -> tick. round: 'nearest' | 'floor' | 'ceil'. exact=false means the project time fell between ticks.
  fromProject(id, project, { round = 'nearest' } = {}) {
    const P = Rat.of(project); if (!this.mapped(id)) { this.get(id); throw new RangeError('clock ' + id + ' has no mapping to project time'); } const s = this._c.get(id);
    let lo = 0, hi = s.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (s[m].p0.lte(P)) lo = m; else hi = m - 1; }
    const g = s[lo], x = P.sub(g.p0).div(g.slope).add(new Rat(g.t0));         // fractional tick
    const tk = round === 'floor' ? x.floor() : round === 'ceil' ? x.ceil() : x.round();
    const n = Number(tk);
    return { tick: Number.isSafeInteger(n) ? n : tk, exact: x.isInteger, residualTicks: x.sub(new Rat(tk)) };
  }
  convert(from, tick, to, opts) { const project = this.toProject(from, tick), r = this.fromProject(to, project, opts); return { ...r, project }; }
  // beat position of a musical clock tick
  beatOf(id, tick) { const d = this.get(id); if (d.kind !== 'musical') throw new RangeError(id + ' is not musical'); return new Rat(asBig(tick), BigInt(d.ppq || 960)); }
  // bar/beat for a musical clock tick, using its meter list (default 4/4). bar and beat are 1-based. Returns exact Rats.
  position(id, tick) {
    const d = this.get(id), beat = this.beatOf(id, tick), meter = (d.meter && d.meter.length ? d.meter : [{ bar: 1, num: 4, den: 4 }]);
    let bar = 1, start = ZERO, M = meter[0];
    for (let i = 0; i < meter.length; i++) {
      const m = meter[i]; if (i > 0) { const bars = m.bar - meter[i - 1].bar, per = new Rat(meter[i - 1].num * 4, meter[i - 1].den); const bs = start.add(per.mul(new Rat(bars))); if (bs.gt(beat)) break; start = bs; bar = m.bar; M = m; } else { bar = m.bar; M = m; }
    }
    const per = new Rat(M.num * 4, M.den), inMeter = beat.sub(start), whole = inMeter.div(per).floor();
    return { bar: bar + Number(whole), beat: inMeter.sub(per.mul(new Rat(whole))).add(ONE), meter: [M.num, M.den] };
  }
  describe(id) {
    const d = this.get(id), t = (x) => this.toProject(id, x).toString();
    if (d.kind === 'linear') return `${id}: ${d.rate[0]}${d.rate[1] !== 1 ? '/' + d.rate[1] : ''} ticks per second${d.inferred ? ' (inferred' + (d.source ? ': ' + d.source : '') + ')' : ''}; tick 1 = ${t(1)} s project time`;
    if (d.kind === 'musical') return `${id}: ${d.ppq || 960} ticks per beat, ${d.tempo.map((x) => x.bpm + ' bpm from beat ' + x.beat).join('; ')}`;
    return `${id}: piecewise-linear time map with ${d.points.length} points`;
  }
}
export function validateClockDef(c) {
  const errs = [];
  try { compile(c); } catch (e) { errs.push(e.message); }
  if (c.kind !== 'musical' && !(Array.isArray(c.rate) && c.rate.length === 2 && c.rate.every((x) => Number.isInteger(x) && x > 0))) errs.push(`clock ${c.id}: rate must be [num,den] positive integers`);
  if (c.toProject) for (const k of ['offset', 'scale']) if (c.toProject[k] !== undefined && !isRationalLike(c.toProject[k])) errs.push(`clock ${c.id}: toProject.${k} is not rational`);
  return errs;
}
// Make a linear clock from a decimal-seconds precision ("times in this file are decimal seconds with at most 4 digits")
export const decimalClock = (id, digits, extra = {}) => ({ id, kind: 'linear', rate: [10 ** digits, 1], unit: 'tick', ...extra });
