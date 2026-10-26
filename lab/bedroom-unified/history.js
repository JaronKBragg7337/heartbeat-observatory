// Event history for the bedroom (format hb-history/1 fields: t, id, e, target, p, v, parent, children).
// Pure JS, no DOM. The page, the AI-README, history.json and the tiny MCP server all use this same shape.
// Written by Claude Sonnet 5.5 for the Heartbeat Observatory engine bake-off, 2026-10-26.
export const FORMAT = 'hb-history/1';
const r2 = (v) => Math.round(v * 100) / 100, r3 = (v) => Math.round(v * 1000) / 1000;
const PLACE = { 'seen-floor': 'the seen floor', 'patched-floor': 'patched floor (not filmed)', 'patched-room': 'the floor of the study (patched)' };
const pad = (n, w = 4) => String(n).padStart(w, '0');

export class History {
  constructor(meta = {}) {
    this.meta = Object.assign({
      format: FORMAT, scene: 'bedroom-sonnet', units: 'm (x toward headboard wall, z toward the unseen +z wall, y up), seconds',
      basis_values: { seen: 'the camera saw it', rebuilt: 'rebuilt from evidence (e.g. the walk cycle tracked from video)', patched: 'PATCHED: made from pieces the camera did see, placed where it did not (each knows its source frame + pixel rectangle)', made: 'made by our tools, invented, no pixels from the footage' },
      author: 'Claude Sonnet 5.5',
    }, meta);
    this.entities = new Map();   // id -> {id, kind, label, basis, created, note}
    this.events = [];            // in time order
    this.samples = [];           // man track: [t,x,z,yaw,walkCycles,walkWeight] (30 Hz)
    this.byId = new Map();       // id -> events touching it (id/parent/target/children)
    this.counters = {};
    this.ev = 0;
  }
  nextId(prefix) { this.counters[prefix] = (this.counters[prefix] || 0) + 1; return prefix + '-' + pad(this.counters[prefix]); }
  entity(id, o) { const e = Object.assign({ id, basis: 'made' }, o); this.entities.set(id, e); return e; }
  _link(id, ev) { if (!id) return; let a = this.byId.get(id); if (!a) { a = []; this.byId.set(id, a); } if (a[a.length - 1] !== ev) a.push(ev); }
  // emit one event. returns it. e: verb ("planted"), id: who/what it is about, target: what it touched, children: ids it caused
  emit(o) {
    const ev = { eid: 'E-' + pad(++this.ev, 5), t: r3(o.t), id: o.id, e: o.e };
    if (o.target) ev.target = o.target;
    if (o.p) ev.p = o.p.map(r3);
    if (o.v) ev.v = o.v.map(r3);
    if (o.parent) ev.parent = o.parent;
    if (o.children && o.children.length) ev.children = o.children.slice();
    if (o.basis) ev.basis = o.basis;
    if (o.place) ev.place = o.place;
    if (o.floor_basis) ev.floor_basis = o.floor_basis;
    if (o.snd) ev.snd = o.snd;
    if (o.note) ev.note = o.note;
    this.events.push(ev);
    this._link(ev.id, ev); this._link(ev.target, ev); this._link(ev.parent, ev);
    if (ev.children) for (const c of ev.children) this._link(c, ev);
    return ev;
  }
  sample(t, x, z, yaw, cyc, ww) { this.samples.push([r3(t), r3(x), r3(z), r3(yaw), r3(cyc), r2(ww)]); }
  eventsFor(id) { return this.byId.get(id) || []; }
  eventsBetween(t0, t1, { e, id, limit = 300 } = {}) {
    const out = [];
    // binary search first event >= t0
    let lo = 0, hi = this.events.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (this.events[m].t < t0) lo = m + 1; else hi = m; }
    for (let i = lo; i < this.events.length && out.length < limit; i++) {
      const ev = this.events[i]; if (ev.t > t1) break;
      if (e && ev.e !== e) continue;
      if (id && !(ev.id === id || ev.target === id || ev.parent === id || (ev.children && ev.children.includes(id)))) continue;
      out.push(ev);
    }
    return out;
  }
  // man position at time t (interpolated); null before first sample
  trackAt(t) {
    const s = this.samples; if (!s.length) return null;
    if (t <= s[0][0]) return s[0].slice();
    if (t >= s[s.length - 1][0]) return s[s.length - 1].slice();
    let lo = 0, hi = s.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (s[m][0] <= t) lo = m; else hi = m; }
    const a = s[lo], b = s[hi], k = (t - a[0]) / (b[0] - a[0] || 1);
    let dy = b[3] - a[3]; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    return [t, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, a[3] + dy * k, a[4] + (b[4] - a[4]) * k, a[5] + (b[5] - a[5]) * k];
  }
  // the chain of causes behind an id (or an event id): follows `parent` upward until a root. This is "Why?".
  why(id) {
    const chain = []; let cur = id; const seen = new Set();
    for (let i = 0; i < 14 && cur && !seen.has(cur); i++) {
      seen.add(cur); let ev = /^E-/.test(cur) ? this.events.find((e) => e.eid === cur) : this.events.find((e) => e.id === cur && e.parent) || this.events.find((e) => e.id === cur);
      if (!ev) break; chain.push({ id: cur, eid: ev.eid, t: ev.t, e: ev.e, parent: ev.parent || null, basis: ev.basis || null, words: this.words(ev) });
      if (!ev.parent || ev.parent.startsWith('tool:')) { if (ev.parent) chain.push({ id: ev.parent, e: 'tool', words: 'built by ' + ev.parent }); break; }
      cur = ev.parent;
    }
    return chain;
  }
  // plain-words line for one event
  words(ev) {
    const E = this.entities, nm = (id) => { const x = E.get(id); return x ? x.label : id; };
    const t = ev.t.toFixed(1) + ' s';
    const where = ev.place ? ' on ' + PLACE[ev.place] : '';
    switch (ev.e) {
      case 'planted': return `${t}: ${ev.note || 'a footstep'}${where}. It made ${ev.children ? ev.children.join(', ') : 'a sound'}.`;
      case 'sounded': return `${t}: sound ${ev.id} (${ev.snd ? ev.snd.k : 'sound'}).`;
      case 'walked_past': return `${t}: he walked past ${nm(ev.target)}.`;
      case 'tried_door': return `${t}: he tried the handle of ${nm(ev.target)}. ${ev.note || ''}`;
      case 'tapped': return `${t}: you tapped ${nm(ev.target)}. ${ev.note || ''}`;
      case 'unlocked': return `${t}: ${nm(ev.id)} unlocked. ${ev.note || ''}`;
      case 'opened': return `${t}: ${nm(ev.id)} swung open${ev.children ? ' and revealed ' + ev.children.join(', ') : ''}.`;
      case 'entered': return `${t}: he stepped into ${nm(ev.target)}. ${ev.note || ''}`;
      case 'left': return `${t}: he came back out of ${nm(ev.target)}.`;
      case 'paused': return `${t}: he stopped. ${ev.note || ''}`;
      case 'patched': return `${t}: ${nm(ev.id)} was patched together from real frame pixels. ${ev.note || ''}`;
      case 'built': return `${t}: ${nm(ev.id)} was built by our tools. ${ev.note || ''}`;
      case 'seen': return `${t}: ${nm(ev.id)} is in the footage. ${ev.note || ''}`;
      case 'answered': return `${t}: ${ev.note || 'a game answer'}`;
      default: return `${t}: ${ev.e} ${ev.note || ''}`;
    }
  }
  // the life story of one id: short plain sentences + numbers (this is the "touch it and see everything it saw" view)
  story(id) {
    const ent = this.entities.get(id) || { id, label: id, kind: 'unknown' };
    const evs = this.eventsFor(id);
    const own = evs.filter((e) => e.id === id), about = evs.filter((e) => e.target === id), kids = evs.filter((e) => e.parent === id);
    const sum = [];
    const created = own.find((e) => e.e === 'built' || e.e === 'planted' || e.e === 'seen');
    sum.push(`${ent.label} (${id}) is ${ent.basis === 'seen' ? 'in the footage (seen)' : ent.basis === 'rebuilt' ? 'rebuilt from evidence' : ent.basis === 'made' ? 'MADE: invented, no pixels from the footage' : ent.basis === 'patched' ? 'PATCHED: made from pieces the camera did see, placed where it did not' : ent.basis}.`);
    if (ent.source) for (const p of ent.source.pieces) sum.push(`Pixels: ${p.texture} from frame ${p.frame}, rectangle (${p.rect[0]},${p.rect[1]})-(${p.rect[2]},${p.rect[3]}). ${p.method}`);
    if (ent.kind === 'person') {
      const steps = kids.filter((e) => e.e === 'planted'), made = steps.filter((e) => /patched/.test(e.place || '')).length;
      const s = this.samples; let dist = 0;
      for (let i = 1; i < s.length; i++) dist += Math.hypot(s[i][1] - s[i - 1][1], s[i][2] - s[i - 1][2]);
      sum.push(`He has walked ${dist.toFixed(1)} m in ${steps.length} steps; ${made} of them on patched floor (never filmed), ${steps.length - made} on floor that was seen.`);
      const pass = own.filter((e) => e.e === 'walked_past').length, tried = own.filter((e) => e.e === 'tried_door').length, ent2 = own.filter((e) => e.e === 'entered').length;
      sum.push(`He walked past doors ${pass} time${pass === 1 ? '' : 's'}, tried a locked handle ${tried} time${tried === 1 ? '' : 's'}, went into the study ${ent2} time${ent2 === 1 ? '' : 's'}.`);
      sum.push('He is AI-generated (not real). His walking is rebuilt from a tracked video walk; where he goes is scripted by us (made).');
    } else if (ent.kind === 'footstep') {
      const p = own.find((e) => e.e === 'planted');
      if (p) sum.push(`${p.note}. Planted at t=${p.t.toFixed(1)} s at (${p.p[0].toFixed(2)}, ${p.p[2].toFixed(2)})${p.place ? ' on ' + PLACE[p.place] : ''}, speed ${p.v ? Math.hypot(p.v[0], p.v[2]).toFixed(2) : '?'} m/s, made by ${p.parent}.`);
      if (p && p.children) sum.push(`It caused: ${p.children.join(', ')}.`);
    } else if (ent.kind === 'door') {
      const pass = about.filter((e) => e.e === 'walked_past').length, tr = about.filter((e) => e.e === 'tried_door').length, tp = about.filter((e) => e.e === 'tapped').length;
      sum.push(`Passed ${pass} times; handle tried ${tr} times; tapped by you ${tp} times.`);
      const un = own.find((e) => e.e === 'unlocked');
      sum.push(un ? `Unlocked at t=${un.t.toFixed(1)} s by ${un.parent}. What it opened onto was never filmed: patched surfaces, made furniture.` : 'Still locked: nobody saw behind it, so it stays faded.');
    } else if (ent.note) sum.push(ent.note);
    const kidIds = new Set(); for (const e of kids) if (e.children) e.children.forEach((c) => kidIds.add(c));
    return { id, label: ent.label, kind: ent.kind, basis: ent.basis, summary: sum, counts: { events: evs.length, own: own.length, about: about.length, caused: kids.length }, caused_ids: [...kidIds].slice(0, 40), events: evs };
  }
  // compact export for history.json (steps' sound children are inlined as events too, so nothing is hidden)
  toJSON() {
    return { meta: Object.assign({}, this.meta, { events: this.events.length, duration_s: this.samples.length ? this.samples[this.samples.length - 1][0] : 0, track_fields: ['t', 'x', 'z', 'yaw', 'walk_cycles', 'walk_weight'], track_hz: 30 }),
      entities: [...this.entities.values()], events: this.events, tracks: { 'P-0001': this.samples.filter((_, i) => i % 3 === 0) } };
  }
  // hb-render style jsonl, so the other tools can read it
  toJSONL() {
    const L = [JSON.stringify({ k: 'meta', format: FORMAT, scene: this.meta.scene, units: this.meta.units, ids: 'P- person, F- footstep, S- sound, D- door, O- seen object, M- made thing, C- viewer', dt: 1 / 30 })];
    for (const e of this.events) L.push(JSON.stringify(Object.assign({ k: 'ev' }, e, { e: e.e })));
    const s = this.samples.filter((_, i) => i % 3 === 0).map((a) => [a[0], a[1], 0, a[2], 0, 0, 0]);
    L.push(JSON.stringify({ k: 's', id: 'P-0001', rate: '10hz', s }));
    return L.join('\n');
  }
}
