// hb-history/2 queries. Same reader for engine, Studio and vision histories.
//   story(id)            everything the record knows about one entity (or event): who/what, label, events, ancestry, causes, tracks, evidence, caveats
//   eventsBetween(a, b)  events in a window of project time (rational seconds) or of one clock's ticks
//   why(id) / causes     the chain of recorded CAUSES (event IDs) upward; an unexplained event stays unexplained; actors are not causes
//   effects(id)          the same chain downward
//   sources(id)          where the label (seen/rebuilt/patched/made) comes from and what evidence backs it
//   changes(opts)        authoring edits, branches, exports, checkpoints and corrections (records that supersede others)
import { Rat } from '../time/rational.js';

const DEFAULT_BASIS_WORDS = {
  seen: 'seen: the camera/microphone/sensor captured it',
  rebuilt: 'rebuilt: reconstructed from evidence that was captured',
  patched: 'patched: made from pieces that were captured, placed where nothing was captured',
  made: 'made: generated or invented by tools, no captured material',
  unknown: 'unknown: the source does not say how it came to be',
};
const ORIGIN_WORDS = { record: 'label written by the source record', declared: 'label declared when this was imported', inferred: 'label inferred by an import rule', missing: 'the source carries no label, so it stays unknown' };
// numbers in a query mean their decimal (0.5 = 1/2); strings like '2/5' are exact
const qRat = (x) => (typeof x === 'number' && !Number.isInteger(x) ? Rat.ofFloat(x) : Rat.of(x));
const num = (x) => (x === null || x === undefined ? null : x);
const fmt = (s) => (s === null ? '?' : (Math.round(s * 1000) / 1000).toString());
const evSecs = (h, ev) => (h.clocks.mapped(ev.at.clock) ? h.clocks.toProjectNumber(ev.at.clock, ev.at.tick) : null);
const atInfo = (h, at) => (at ? { clock: at.clock, tick: at.tick, seconds: h.clocks.mapped(at.clock) ? h.clocks.toProjectNumber(at.clock, at.tick) : null } : null);
const byTime = (h) => (a, b) => { const x = evSecs(h, a), y = evSecs(h, b); if (x === null || y === null || Math.abs(x - y) <= 1e-9) return h.compareEvents(a, b); return x - y; };
const basisWords = (h, b) => (h.meta.basisDefinitions && h.meta.basisDefinitions[b.value]) || DEFAULT_BASIS_WORDS[b.value] || b.value;

export function words(h, ev) {
  const t = evSecs(h, ev), subj = ev.subject ? h.labelOf(ev.subject) : null;
  const tg = ev.targets && ev.targets.length ? ' -> ' + ev.targets.map((x) => h.labelOf(x)).join(', ') : '';
  const by = ev.actor ? ` (by ${h.labelOf(ev.actor)})` : '';
  const note = ev.data && (ev.data.note || ev.data.why);
  return `${t === null ? `[${ev.at.clock} ${ev.at.tick}]` : fmt(t) + ' s'}: ${subj ? subj + ' ' : ''}${ev.type}${tg}${by}${note ? '. ' + String(note).trim() : ''}`;
}
const brief = (h, ev, role) => ({ eventId: ev.eventId, seq: ev.seq, at: atInfo(h, ev.at), type: ev.type, subject: ev.subject, targets: ev.targets, actor: ev.actor, causes: ev.causes, basis: h.basisOf(ev), ...(role ? { role } : {}) });

export function stats(h) {
  const byType = {}, byBasis = {}, byKind = { entity: h.entities.size, event: h.events.length, track: h.tracks.size, evidence: h.evidence.size, coverage: h.coverage.size, checkpoint: h.checkpoints.size, edit: h.edits.size, branch: h.branches.size, export: h.exports.size };
  let lo = null, hi = null, unmapped = 0, withCauses = 0;
  for (const ev of h.events) {
    byType[ev.type] = (byType[ev.type] || 0) + 1; const b = h.basisOf(ev).value; byBasis[b] = (byBasis[b] || 0) + 1; if (ev.causes && ev.causes.length) withCauses++;
    const s = evSecs(h, ev); if (s === null) { unmapped++; continue; } if (lo === null || s < lo) lo = s; if (hi === null || s > hi) hi = s;
  }
  const entityBasis = {}; for (const e of h.entities.values()) { const b = h.basisOf(e).value; entityBasis[b] = (entityBasis[b] || 0) + 1; }
  const cov = {}; for (const c of h.coverage.values()) cov[c.status] = (cov[c.status] || 0) + 1;
  return { historyId: h.meta.historyId, namespace: h.meta.namespace, counts: byKind, eventTypes: byType, eventBasis: byBasis, entityBasis, eventsWithCauses: withCauses, spanSeconds: lo === null ? null : [lo, hi], eventsOnUnmappedClocks: unmapped,
    clocks: h.clocks.ids(), idSpaces: (h.meta.idSpaces || []).map((x) => x.prefix), coverage: cov };
}

export function eventsBetween(h, from, to, opts = {}) {
  const { type, id, subject, actor, clock, limit = 500, offset = 0, includeSuperseded = false } = opts;
  let out;
  if (clock) {
    out = (id ? (h.refs.get(id) || []).map((x) => x[0]) : h.events).filter((ev) => ev.at.clock === clock && ev.at.tick >= from && ev.at.tick <= to);
    out = [...new Set(out)].sort((a, b) => a.at.tick - b.at.tick || a.seq - b.seq);
  } else {
    const A = qRat(from), B = qRat(to), a = A.toNumber(), b = B.toNumber(), eps = 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
    let cand;
    if (id) cand = [...new Set((h.refs.get(id) || []).map((x) => x[0]))].filter((ev) => h.clocks.mapped(ev.at.clock));
    else { const T = h._timeIndex(); let lo = 0, hi = T.length; while (lo < hi) { const m = (lo + hi) >> 1; if (T[m].s < a - eps) lo = m + 1; else hi = m; } cand = []; for (let i = lo; i < T.length && T[i].s <= b + eps; i++) cand.push(T[i].ev); }
    out = cand.filter((ev) => { const p = h.clocks.toProject(ev.at.clock, ev.at.tick); return p.gte(A) && p.lte(B); });
    if (id) out.sort(byTime(h));
  }
  if (!includeSuperseded) out = out.filter((ev) => h.isCurrent(ev));
  if (type) out = out.filter((ev) => ev.type === type);
  if (subject) out = out.filter((ev) => ev.subject === subject);
  if (actor) out = out.filter((ev) => ev.actor === actor);
  const total = out.length;
  return { total, truncated: total > offset + limit, events: out.slice(offset, offset + limit) };
}

// ---- causes ----
function classifyRoot(h, ev) {
  const o = ev.origin;
  if (o === 'viewer-input' || o === 'input') return { kind: 'input', words: 'outside input (a person acted); nothing earlier in the record caused it' };
  if (o === 'script') return { kind: 'script', words: 'a script or plan started this; no earlier recorded event caused it' };
  if (o === 'tool' || (ev.actor && ev.actor.startsWith('tool:'))) return { kind: 'tool', words: 'a tool did this on its own; no earlier recorded event caused it' };
  if (ev.actor) return { kind: 'actor', words: `${h.labelOf(ev.actor)} is the actor, not a cause: no earlier recorded event made this happen` };
  return { kind: 'unexplained', words: 'no cause is recorded for this event (it stays unexplained)' };
}
export function startEvents(h, id, { type } = {}) {
  const ev = h.eventById.get(id); if (ev) return [ev];
  const rs = h.refs.get(id) || [];
  const own = rs.filter((x) => x[1] === 'subject').map((x) => x[0]), made = rs.filter((x) => x[1] === 'produces').map((x) => x[0]);
  let c = [...own, ...made]; if (type) c = c.filter((e) => e.type === type);
  return [...new Set(c)].sort(byTime(h));
}
export function why(h, id, opts = {}) {
  const { maxNodes = 400 } = opts;
  const cands = startEvents(h, id, opts);
  if (!cands.length) return { id, found: false, chain: [], roots: [], words: [`nothing in this history happened to ${id}${opts.type ? ' with type ' + opts.type : ''}`] };
  // the starting event: first with recorded causes, else the first that made it, else the first
  const start = cands.find((e) => e.causes && e.causes.length) || (h.eventById.has(id) ? cands[0] : cands.find((e) => (h.refs.get(id) || []).some((x) => x[0] === e && x[1] === 'produces')) || cands[0]);
  const chain = [], roots = [], seen = new Set(); let frontier = [start], depth = 0;
  while (frontier.length && chain.length < maxNodes) {
    const next = [];
    for (const ev of frontier) {
      if (seen.has(ev.eventId)) continue; seen.add(ev.eventId);
      const causes = (ev.causes || []).filter((c) => h.eventById.has(c)), missing = (ev.causes || []).filter((c) => !h.eventById.has(c));
      chain.push({ depth, ...brief(h, ev), words: words(h, ev), ...(missing.length ? { missingCauses: missing } : {}) });
      if (!causes.length) roots.push({ eventId: ev.eventId, actor: ev.actor || null, origin: ev.origin || null, ...classifyRoot(h, ev) });
      for (const c of causes) next.push(h.eventById.get(c));
    }
    frontier = next; depth++;
  }
  return { id, found: true, start: start.eventId, alternatives: cands.filter((e) => e !== start).slice(0, 20).map((e) => ({ eventId: e.eventId, type: e.type })), chain, roots, words: chain.map((c) => '  '.repeat(c.depth) + c.words) };
}
export function effects(h, id, { maxNodes = 400 } = {}) {
  const startEv = h.eventById.get(id) ? [h.eventById.get(id)] : startEvents(h, id);
  const out = [], seen = new Set(); let frontier = startEv, depth = 0;
  while (frontier.length && out.length < maxNodes) { const next = []; for (const ev of frontier) { if (seen.has(ev.eventId)) continue; seen.add(ev.eventId); if (depth > 0) out.push({ depth, ...brief(h, ev), words: words(h, ev) }); for (const e of h.effectsOf.get(ev.eventId) || []) next.push(e); } frontier = next; depth++; }
  return { id, effects: out };
}

// ---- story ----
export function story(h, id, opts = {}) {
  const { eventLimit = 200 } = opts;
  const ev0 = h.eventById.get(id);
  if (ev0) { const sup = h.supersededBy.get(id); return { id, found: true, kind: 'event', event: ev0, supersedes: ev0.supersedes || null, supersededBy: sup ? sup.eventId : null, why: why(h, id), effects: effects(h, id), summary: [words(h, ev0), ...(ev0.supersedes ? [`This is a correction: it supersedes ${ev0.supersedes} (the original stays in the record).`] : []), ...(sup ? [`Superseded by ${sup.eventId}: this is no longer the current version.`] : [])] }; }
  const ent = h.entityOf(id), rs = h.refs.get(id) || [];
  const tracks = (h.tracksBySubject.get(id) || []);
  if (!ent && !rs.length && !tracks.length) return { id, found: false, summary: [`${id} is not in this history`] };
  const roleOf = new Map(); for (const [ev, role] of rs) { const a = roleOf.get(ev) || []; a.push(role); roleOf.set(ev, a); }
  const evs = [...roleOf.keys()].sort(byTime(h));
  const counts = {}, roleCounts = {}; for (const ev of evs) { counts[ev.type] = (counts[ev.type] || 0) + 1; for (const r of roleOf.get(ev)) roleCounts[r] = (roleCounts[r] || 0) + 1; }
  const basis = ent ? h.basisOf({ ...ent, k: 'entity' }) : { value: 'unknown', origin: 'missing', via: 'none' };
  const mix = {}; for (const ev of evs) if (roleOf.get(ev).includes('subject')) { const b = h.basisOf(ev); mix[b.value] = (mix[b.value] || 0) + 1; }
  // ancestry: who this came from (events where it is the subject and lists ancestors), who came from it
  const parents = new Set(), kids = new Set(), actors = new Set(), madeBy = new Set(), produced = new Set(), touched = new Set();
  if (ent && ent.parent) parents.add(ent.parent);
  for (const [ev, role] of rs) {
    if (role === 'subject') { (ev.ancestry || []).forEach((x) => parents.add(x)); (ev.produces || []).forEach((x) => produced.add(x)); (ev.targets || []).forEach((x) => touched.add(x)); if (ev.actor) actors.add(ev.actor); }
    if (role === 'ancestry' && ev.subject && ev.subject !== id) kids.add(ev.subject);
    if (role === 'produces') madeBy.add(ev.eventId);
    if (role === 'target' && ev.subject) touched.add(ev.subject);
  }
  const upstream = why(h, id), downstream = effects(h, id);
  const evidenceIds = new Set([...(ent ? ent.evidence || [] : []), ...evs.flatMap((e) => (roleOf.get(e).includes('subject') ? e.evidence || [] : [])), ...tracks.flatMap((t) => [...(t.evidence || []), ...(t.segments || []).flatMap((s) => s.evidence || [])])]);
  const covs = new Set(); for (const t of tracks) if (t.coverage && h.coverage.has(t.coverage)) covs.add(h.coverage.get(t.coverage));
  for (const c of h.coverage.values()) if ((c.scope.kind === 'entity' && c.scope.ref === id) || (c.scope.kind === 'events' && evs.length)) covs.add(c);
  const caveats = [];
  for (const c of covs) caveats.push(`coverage ${c.coverageId}: ${c.status}${c.note ? ' - ' + c.note : ''}${c.dropped ? `, ${c.dropped} dropped` : ''}`);
  for (const f of (ent && ent.flags) || []) caveats.push(`${f.field}: ${f.status}${f.note ? ' - ' + f.note : ''}`);
  for (const t of tracks) for (const f of t.flags || []) caveats.push(`track ${t.trackId} ${f.field}: ${f.status}${f.note ? ' - ' + f.note : ''}`);
  if (ent && ent.implicit && (h.meta.idSpaces || []).find((x) => x.prefix === ent.idSpace && x.generation)) caveats.push(`id space ${ent.idSpace}: generation ${(h.meta.idSpaces.find((x) => x.prefix === ent.idSpace)).generation} (a reused slot could be a different object)`);
  const sum = [];
  sum.push(`${ent && ent.label ? ent.label + ' (' + id + ')' : id} is ${ent ? (ent.kind ? 'a ' + ent.kind : 'a thing') : 'an id with no entity record'}${ent && ent.implicit ? ` named by id space "${ent.idSpace}" (no individual entity record)` : ''}.`);
  sum.push(`Label: ${basisWords(h, basis)}. (${ORIGIN_WORDS[basis.origin] || basis.origin}${basis.inherited ? '; inherited from ' + basis.via : ''}.)`);
  if (Object.keys(mix).length) sum.push('Its own events are labelled: ' + Object.entries(mix).map(([k, v]) => `${k} ${v}`).join(', ') + '.');
  if (ent && ent.source && ent.source.pieces) for (const p of ent.source.pieces) sum.push(`Pixels: ${p.texture} from frame ${p.frame}, rectangle ${JSON.stringify(p.rect)}. ${p.method || ''}`.trim());
  if (ent && ent.note) sum.push((ent.implicit ? 'About this kind of id: ' : '') + String(ent.note));
  if (evs.length) {
    const mapped = evs.filter((e) => evSecs(h, e) !== null), t0 = mapped.length ? evSecs(h, mapped[0]) : null, t1 = mapped.length ? evSecs(h, mapped[mapped.length - 1]) : null;
    sum.push(`${evs.length} recorded event${evs.length === 1 ? '' : 's'} (${Object.entries(roleCounts).map(([k, v]) => k + ' ' + v).join(', ')})${mapped.length ? ` from ${fmt(t0)} s to ${fmt(t1)} s` : ''}${mapped.length < evs.length ? `; ${evs.length - mapped.length} on a clock with no project time mapping (e.g. wall-clock saves)` : ''}: ${Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => v + ' ' + k).join(', ')}.`);
  } else sum.push('No events recorded for it.');
  if (parents.size) sum.push('Came from: ' + [...parents].slice(0, 8).join(', ') + (parents.size > 8 ? '...' : '') + '.');
  if (kids.size) sum.push(`${kids.size} descendant${kids.size === 1 ? '' : 's'}: ${[...kids].slice(0, 8).join(', ')}${kids.size > 8 ? '...' : ''}.`);
  if (upstream.found && upstream.roots.length) sum.push('Why (recorded causes): ' + upstream.roots.map((r) => `${r.eventId}: ${r.words}`).join(' | '));
  if (downstream.effects.length) sum.push(`Led to ${downstream.effects.length} later event${downstream.effects.length === 1 ? '' : 's'}.`);
  if (tracks.length) sum.push(`${tracks.length} track${tracks.length === 1 ? '' : 's'}: ${tracks.slice(0, 5).map((t) => `${t.trackId} (${t.type}, ${t.samples ? t.samples.length + ' samples' : 'media'}${t.label ? ', ' + t.label : ''})`).join('; ')}.`);
  if (evidenceIds.size) sum.push(`${evidenceIds.size} evidence reference${evidenceIds.size === 1 ? '' : 's'}.`);
  return {
    id, found: true, kind: 'entity', entity: ent, basis, eventBasisMix: mix,
    events: evs.slice(0, eventLimit).map((ev) => ({ ...brief(h, ev), roles: roleOf.get(ev), words: words(h, ev) })), eventTotal: evs.length, eventCounts: counts, roleCounts,
    ancestry: { parents: [...parents], descendants: [...kids] }, actors: [...actors], madeByEvents: [...madeBy], produced: [...produced].slice(0, 100), touched: [...touched].slice(0, 100),
    why: upstream, effects: downstream.effects.length, tracks: tracks.map((t) => ({ trackId: t.trackId, type: t.type, clock: t.clock, samples: t.samples ? t.samples.length : null, units: t.columns.map((c) => c.unit), coverage: t.coverage || null })),
    evidence: [...evidenceIds].map((e) => h.evidence.get(e)).filter(Boolean), coverage: [...covs], caveats, summary: sum,
  };
}

// ---- sources ----
export function sources(h, id) {
  const ev = h.eventById.get(id), tr = h.tracks.get(id), en = h.entityOf(id);
  const rec = ev || tr || (en && { ...en, k: 'entity' });
  if (!rec) return { id, found: false };
  const basis = h.basisOf(rec);
  const ids = new Set([...(rec.evidence || []), ...((rec.segments || []).flatMap((s) => s.evidence || []))]);
  if (en && !ev && !tr) for (const [e, role] of h.refs.get(id) || []) if (role === 'subject') for (const x of e.evidence || []) ids.add(x);
  const evidence = [...ids].map((x) => h.evidence.get(x) || { evidenceId: x, missing: true });
  const mix = {}; const add = (r) => { const b = h.basisOf(r); const k = b.value + (b.origin !== 'record' ? ` (${b.origin})` : ''); mix[k] = (mix[k] || 0) + 1; };
  if (en && !ev && !tr) { for (const [e, role] of h.refs.get(id) || []) if (role === 'subject') add(e); for (const t of h.tracksBySubject.get(id) || []) add(t); }
  const segments = (rec.segments || []).map((s) => ({ ...s, clock: rec.clock }));
  return { id, found: true, kind: ev ? 'event' : tr ? 'track' : 'entity', basis, basisWords: basisWords(h, basis), originWords: ORIGIN_WORDS[basis.origin], recordBasisMix: mix, segments, evidence,
    importedFrom: h.meta.source ? { adapter: h.meta.source.adapter, format: h.meta.source.format, files: h.meta.source.files } : null, flags: rec.flags || [],
    pieces: rec.source && rec.source.pieces ? rec.source.pieces : undefined };
}

// ---- changes ----
export function changes(h, opts = {}) {
  const { target, from, to, branchId, kinds } = opts;
  const rows = [];
  const push = (kind, m, idf) => { for (const r of m.values()) rows.push({ kind, id: r[idf], at: r.at ? atInfo(h, r.at) : null, op: r.op, target: r.target, actor: r.actor, branchId: r.branchId || (r.k === 'branch' ? r.branchId : undefined), from: r.from, name: r.name, outputHash: r.outputHash, projectRevision: r.projectRevision, subsystem: r.subsystem, supersedes: r.supersedes, note: r.note, record: r }); };
  push('edit', h.edits, 'editId'); push('branch', h.branches, 'branchId'); push('export', h.exports, 'exportId'); push('checkpoint', h.checkpoints, 'checkpointId');
  for (const m of [h.entities, h.tracks, h.evidence]) for (const r of m.values()) if (r.supersedes) rows.push({ kind: 'correction', id: r.id || r.trackId || r.evidenceId, supersedes: r.supersedes, note: r.note, at: r.created ? atInfo(h, r.created) : null, record: r });
  for (const ev of h.events) if (ev.supersedes) rows.push({ kind: 'correction', id: ev.eventId, supersedes: ev.supersedes, at: atInfo(h, ev.at), note: ev.data && ev.data.note, record: ev });
  let out = rows;
  if (kinds) out = out.filter((r) => kinds.includes(r.kind));
  if (target) out = out.filter((r) => r.target === target || r.supersedes === target || (r.record && (r.record.subject === target || (r.record.targets || []).includes(target))));
  if (branchId) out = out.filter((r) => r.branchId === branchId);
  if (from !== undefined || to !== undefined) out = out.filter((r) => r.at && r.at.seconds !== null && (from === undefined || r.at.seconds >= qRat(from).toNumber()) && (to === undefined || r.at.seconds <= qRat(to).toNumber()));
  out.sort((a, b) => (num(a.at && a.at.seconds) ?? Infinity) - (num(b.at && b.at.seconds) ?? Infinity));
  return { total: out.length, changes: out.map(({ record, ...r }) => r), lineage: lineage(h) };
}
// export/branch lineage: for each export, which history ranges and project revision it came from
export function lineage(h) {
  return { branches: [...h.branches.values()].map((b) => ({ branchId: b.branchId, name: b.name, from: b.from })), exports: [...h.exports.values()].map((e) => ({ exportId: e.exportId, projectRevision: e.projectRevision, sourceRanges: e.sourceRanges, outputHash: e.outputHash, settings: e.settings })) };
}
