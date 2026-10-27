// hb-history/2 in memory: records in, indexes built as records arrive, JSONL out.
// Read order for an AI:  h.meta -> h.stats() -> h.story(id) / h.why(id) / h.eventsBetween(a,b) / h.sources(id) / h.changes().
import { ClockSet } from '../time/clock.js';
import { Rat } from '../time/rational.js';
import * as Q from './query.js';

export const FORMAT = 'hb-history/2';
const KIND_MAP = { entity: 'entities', track: 'tracks', evidence: 'evidence', coverage: 'coverage', checkpoint: 'checkpoints', edit: 'edits', branch: 'branches', export: 'exports' };
const ID_FIELD = { entity: 'id', event: 'eventId', track: 'trackId', evidence: 'evidenceId', coverage: 'coverageId', checkpoint: 'checkpointId', edit: 'editId', branch: 'branchId', export: 'exportId' };
export const idOfRecord = (r) => r[ID_FIELD[r.k]];

export class History {
  constructor(meta = {}) {
    this.meta = { k: 'meta', format: FORMAT, minor: 0, clocks: [], ...meta };
    this.clocks = new ClockSet(this.meta.clocks);
    this.entities = new Map(); this.tracks = new Map(); this.evidence = new Map(); this.coverage = new Map();
    this.checkpoints = new Map(); this.edits = new Map(); this.branches = new Map(); this.exports = new Map();
    this.events = []; this.eventById = new Map();
    this.refs = new Map();           // id -> [[event, role]]   roles: subject target actor ancestry produces
    this.effectsOf = new Map();      // eventId -> events that list it in causes
    this.tracksBySubject = new Map();
    this.supersededBy = new Map();   // recordId -> record that supersedes it
    this.duplicates = [];            // ids seen twice (the validator reports them)
    this._time = null;
  }
  get historyId() { return this.meta.historyId; }
  get namespace() { return this.meta.namespace; }

  addClock(def) { this.meta.clocks.push(def); this.clocks.add(def); return this; }
  add(r) {
    if (!r || typeof r !== 'object' || !r.k) throw new TypeError('record needs k');
    if (r.k === 'meta') { this.meta = { ...this.meta, ...r }; this.clocks = new ClockSet(this.meta.clocks); this._time = null; return r; }
    const id = idOfRecord(r);
    if (r.k === 'event') {
      if (this.eventById.has(r.eventId)) this.duplicates.push(['event', r.eventId]);
      this.eventById.set(r.eventId, r); this.events.push(r); this._time = null;
      const link = (x, role) => { if (x === undefined || x === null) return; let a = this.refs.get(x); if (!a) this.refs.set(x, a = []); a.push([r, role]); };
      link(r.subject, 'subject'); if (r.targets) for (const t of r.targets) link(t, 'target'); link(r.actor, 'actor');
      if (r.ancestry) for (const t of r.ancestry) link(t, 'ancestry'); if (r.produces) for (const t of r.produces) link(t, 'produces');
      if (r.causes) for (const c of r.causes) { let a = this.effectsOf.get(c); if (!a) this.effectsOf.set(c, a = []); a.push(r); }
    } else {
      const m = this[KIND_MAP[r.k]]; if (!m) throw new TypeError('unknown record kind ' + r.k);
      if (m.has(id)) this.duplicates.push([r.k, id]);
      m.set(id, r);
      if (r.k === 'track' && r.subject) { let a = this.tracksBySubject.get(r.subject); if (!a) this.tracksBySubject.set(r.subject, a = []); a.push(r); }
    }
    if (r.supersedes) this.supersededBy.set(r.supersedes, r);
    return r;
  }
  // remove one EVENT (used for project-held corrections that get undone)
  remove(ev) {
    const i = this.events.lastIndexOf(ev); if (i >= 0) this.events.splice(i, 1); this.eventById.delete(ev.eventId); this._time = null;
    const unlink = (id) => { const a = this.refs.get(id); if (a) { const b = a.filter((x) => x[0] !== ev); if (b.length) this.refs.set(id, b); else this.refs.delete(id); } };
    for (const id of [ev.subject, ...(ev.targets || []), ev.actor, ...(ev.ancestry || []), ...(ev.produces || [])]) if (id !== undefined) unlink(id);
    for (const c of ev.causes || []) { const a = this.effectsOf.get(c); if (a) this.effectsOf.set(c, a.filter((x) => x !== ev)); }
    if (ev.supersedes && this.supersededBy.get(ev.supersedes) === ev) this.supersededBy.delete(ev.supersedes);
  }
  static fromRecords(records) { const h = new History(); for (const r of records) h.add(r); return h; }
  static fromJSONL(text) {
    const h = new History(); let n = 0;
    for (const line of text.split('\n')) { if (!line) continue; n++; let o; try { o = JSON.parse(line); } catch (e) { throw new SyntaxError(`hb-history/2 line ${n}: ${e.message}`); } h.add(o); }
    return h;
  }
  *records() {
    yield this.meta;
    for (const m of [this.entities, this.evidence, this.coverage]) yield* m.values();
    yield* this.events;
    for (const m of [this.tracks, this.checkpoints, this.branches, this.edits, this.exports]) yield* m.values();
  }
  toJSONL() { const L = []; for (const r of this.records()) L.push(JSON.stringify(r)); return L.join('\n') + '\n'; }
  toBytes() { return new TextEncoder().encode(this.toJSONL()); }

  // ---- lookups ----
  // explicit entity record, or a virtual one from meta.idSpaces (so 40,000 particles do not need 40,000 rows)
  entityOf(id) {
    const e = this.entities.get(id); if (e) return { ...e, implicit: false };
    let best = null; for (const sp of this.meta.idSpaces || []) if (id.startsWith(sp.prefix) && (!best || sp.prefix.length > best.prefix.length)) best = sp;
    return best ? { id, kind: best.kind, basis: best.basis, basisOrigin: best.basisOrigin, implicit: true, idSpace: best.prefix, note: best.note } : null;
  }
  labelOf(id) { const e = this.entities.get(id); return (e && e.label) || id; }
  // the label seen/rebuilt/patched/made/unknown plus where it came from; never filled in silently
  basisOf(rec) {
    const own = (r) => (r && r.basis ? { value: r.basis, origin: r.basisOrigin || 'record' } : null);
    if (rec.k === 'event') { const o = own(rec); if (o) return { ...o, via: 'event' }; const s = rec.subject && this.entityOf(rec.subject); const so = s && own(s); if (so) return { ...so, via: 'subject entity ' + rec.subject, inherited: true }; }
    else if (rec.k === 'track') { const o = own(rec); if (o) return { ...o, via: 'track' }; const s = rec.subject && this.entityOf(rec.subject); const so = s && own(s); if (so) return { ...so, via: 'subject entity ' + rec.subject, inherited: true }; }
    else { const o = own(rec); if (o) return { ...o, via: rec.k }; if (rec.k === 'entity') { const s = this.entityOf(rec.id); const so = s && own(s); if (so) return { ...so, via: 'id space', inherited: true }; } }
    return { value: 'unknown', origin: 'missing', via: 'none' };
  }
  isCurrent(r) { return !this.supersededBy.has(idOfRecord(r)); }

  // ---- time ----
  // project time (Rat seconds) of an {clock,tick}; null when the clock has no project mapping
  projectTime(at) { return this.clocks.mapped(at.clock) ? this.clocks.toProject(at.clock, at.tick) : null; }
  // exact order of two events: project time (rational) first, then seq
  compareEvents(a, b) { if (this.clocks.mapped(a.at.clock) && this.clocks.mapped(b.at.clock)) { const c = this.clocks.toProject(a.at.clock, a.at.tick).cmp(this.clocks.toProject(b.at.clock, b.at.tick)); if (c) return c; } return a.seq - b.seq; }
  _timeIndex() {
    if (this._time) return this._time;
    const a = []; for (const ev of this.events) { if (!this.clocks.mapped(ev.at.clock)) continue; a.push({ s: this.clocks.toProjectNumber(ev.at.clock, ev.at.tick), ev }); }
    const cmp = (x, y) => { const d = x.s - y.s; if (Math.abs(d) > 1e-9) return d; const c = this.compareEvents(x.ev, y.ev); return c; };
    a.sort(cmp); return (this._time = a);
  }

  // ---- queries (see query.js) ----
  stats() { return Q.stats(this); }
  story(id, opts) { return Q.story(this, id, opts); }
  eventsBetween(from, to, opts) { return Q.eventsBetween(this, from, to, opts); }
  why(id, opts) { return Q.why(this, id, opts); }
  causes(id, opts) { return Q.why(this, id, opts); }
  effects(id, opts) { return Q.effects(this, id, opts); }
  sources(id) { return Q.sources(this, id); }
  changes(opts) { return Q.changes(this, opts); }
  words(ev) { return Q.words(this, ev); }
}
export { Rat };
