// hb-history/2 validator: shape (JSON Schema) + meaning (references, clocks, causes, coverage).
// validateHistory(h) -> { ok, errors:[{code, id, message}], warnings:[...], summary:{code:count} }
// Errors are real contract breaks; warnings are things a reader should know (unresolved symbolic refs, unmapped clocks).
import { validateSchema } from '../schema/validate.js';
import { history2Schema, BASIS } from '../schema/history2.js';
import { validateClockDef } from '../time/clock.js';
import { idOfRecord } from './model.js';
import { NS_SEP, isNamespace } from '../util/ids.js';

export function validateRecord(rec) { return validateSchema(rec, history2Schema); }

export function validateHistory(h, { schema = true, maxExamples = 12 } = {}) {
  const errors = [], warnings = [], counts = {};
  const note = (list, code, id, message) => { const key = (list === errors ? 'E:' : 'W:') + code; counts[key] = (counts[key] || 0) + 1; if (counts[key] <= maxExamples) list.push({ code, id, message }); };
  const err = (c, i, m) => note(errors, c, i, m), warn = (c, i, m) => note(warnings, c, i, m);
  const M = h.meta;
  if (M.format !== 'hb-history/2') err('format', null, `meta.format is ${M.format}, expected hb-history/2`);
  if (!M.historyId) err('meta', null, 'meta.historyId missing'); if (!isNamespace(M.namespace)) err('meta', null, 'meta.namespace missing or not a slug');
  if (!M.clocks || !M.clocks.length) err('meta', null, 'meta.clocks is empty: every event needs a clock');
  const clockIds = new Set(); for (const c of M.clocks || []) { clockIds.add(c.id); for (const m of validateClockDef(c)) err('clock', c.id, m); }
  if (schema) for (const r of h.records()) for (const e of validateSchema(r, history2Schema).slice(0, 3)) err('schema', idOfRecord(r) || r.k, `${r.k}${e.path}: ${e.message}`);
  for (const [k, id] of h.duplicates) err('duplicate-id', id, `${k} id "${id}" appears more than once`);
  const localId = (id, where) => { if (typeof id === 'string' && id.includes(NS_SEP)) err('local-id', id, `${where}: local ids must not contain "${NS_SEP}"`); };
  for (const m of [h.entities, h.tracks, h.evidence, h.coverage, h.checkpoints, h.edits, h.branches, h.exports]) for (const id of m.keys()) localId(id, 'record id');
  for (const id of h.eventById.keys()) localId(id, 'eventId');

  const symbols = M.symbols || {}, seqs = new Set();
  const resolves = (id) => h.entities.has(id) || h.eventById.has(id) || id in symbols || id.startsWith('tool:') || (M.idSpaces || []).some((sp) => id.startsWith(sp.prefix));
  const checkRefs = (ev, field, list) => { for (const x of list || []) { if (x.includes(NS_SEP)) { counts['W:cross-history-ref'] = (counts['W:cross-history-ref'] || 0) + 1; continue; } if (!resolves(x)) warn('unresolved-ref', ev.eventId, `${field} "${x}" is not an entity, id space, declared symbol or tool`); } };
  for (const ev of h.events) {
    if (!clockIds.has(ev.at.clock)) err('clock-missing', ev.eventId, `at.clock "${ev.at.clock}" is not declared in meta.clocks`);
    if (seqs.has(ev.seq)) err('duplicate-seq', ev.eventId, `seq ${ev.seq} used twice`); seqs.add(ev.seq);
    if (ev.basis && !BASIS.includes(ev.basis)) err('basis', ev.eventId, `bad basis ${ev.basis}`);
    if (ev.basisOrigin === 'missing' && ev.basis && ev.basis !== 'unknown') err('basis-origin', ev.eventId, 'basisOrigin "missing" but a basis is set');
    if (ev.subject) checkRefs(ev, 'subject', [ev.subject]); checkRefs(ev, 'targets', ev.targets); if (ev.actor) checkRefs(ev, 'actor', [ev.actor]); checkRefs(ev, 'ancestry', ev.ancestry); checkRefs(ev, 'produces', ev.produces);
    for (const c of ev.causes || []) {
      if (c === ev.eventId) err('self-cause', ev.eventId, 'event lists itself as a cause');
      else if (c.includes(NS_SEP)) counts['W:cross-history-ref'] = (counts['W:cross-history-ref'] || 0) + 1;
      else if (!h.eventById.has(c)) err('cause-missing', ev.eventId, `cause ${c} is not an event in this history`);
      else { const ce = h.eventById.get(c); if (h.clocks.mapped(ce.at.clock) && h.clocks.mapped(ev.at.clock) && h.clocks.toProject(ce.at.clock, ce.at.tick).gt(h.clocks.toProject(ev.at.clock, ev.at.tick))) err('cause-after-effect', ev.eventId, `cause ${c} happens later than the event it causes`); }
    }
    for (const x of ev.evidence || []) if (!h.evidence.has(x)) err('evidence-missing', ev.eventId, `evidence ${x} not found`);
    if (!h.clocks.mapped(ev.at.clock) && clockIds.has(ev.at.clock)) counts['W:unmapped-clock-events'] = (counts['W:unmapped-clock-events'] || 0) + 1;
  }
  // cause cycles (iterative colouring)
  const color = new Map();
  for (const ev of h.events) {
    if (color.get(ev.eventId)) continue; const stack = [[ev, 0]]; color.set(ev.eventId, 1);
    while (stack.length) {
      const top = stack[stack.length - 1], [e, i] = top, cs = (e.causes || []).filter((c) => h.eventById.has(c));
      if (i >= cs.length) { color.set(e.eventId, 2); stack.pop(); continue; }
      top[1]++; const n = h.eventById.get(cs[i]), st = color.get(n.eventId);
      if (st === 1) { err('cause-cycle', e.eventId, `cause cycle through ${n.eventId}`); } else if (!st) { color.set(n.eventId, 1); stack.push([n, 0]); }
    }
  }
  for (const e of h.entities.values()) {
    if (e.basis && !BASIS.includes(e.basis)) err('basis', e.id, `bad basis ${e.basis}`);
    if (e.basisOrigin === 'missing' && e.basis && e.basis !== 'unknown') err('basis-origin', e.id, 'basisOrigin "missing" but a basis is set');
    for (const x of e.evidence || []) if (!h.evidence.has(x)) err('evidence-missing', e.id, `evidence ${x} not found`);
    if (e.parent && !e.parent.includes(NS_SEP) && !resolves(e.parent)) warn('unresolved-ref', e.id, `parent "${e.parent}" unknown`);
  }
  for (const t of h.tracks.values()) {
    const id = t.trackId; if (!clockIds.has(t.clock)) err('clock-missing', id, `track clock "${t.clock}" not declared`);
    if (t.columns[0].name !== 'tick') err('track-columns', id, 'first column must be "tick" (integer ticks on the track clock)');
    if (!t.samples && !t.media) err('track-empty', id, 'track needs samples or media');
    if (t.samples) { let last = -Infinity; for (let i = 0; i < t.samples.length; i++) { const r = t.samples[i]; if (r.length !== t.columns.length) { err('track-row', id, `row ${i} has ${r.length} values for ${t.columns.length} columns`); break; } if (!Number.isInteger(r[0])) { err('track-tick', id, `row ${i} tick is not an integer`); break; } if (r[0] < last) { err('track-order', id, `row ${i} goes back in time`); break; } last = r[0]; } }
    for (const s of t.segments || []) { if (s.from > s.to) err('segment', id, `segment ${s.from}..${s.to} reversed`); for (const x of s.evidence || []) if (!h.evidence.has(x)) err('evidence-missing', id, `segment evidence ${x} not found`); }
    if (t.coverage && !h.coverage.has(t.coverage)) err('coverage-missing', id, `coverage ${t.coverage} not found`);
    for (const x of t.evidence || []) if (!h.evidence.has(x)) err('evidence-missing', id, `evidence ${x} not found`);
    if (t.subject && !resolves(t.subject)) warn('unresolved-ref', id, `track subject "${t.subject}" unknown`);
  }
  for (const ev of h.evidence.values()) { if (ev.range && !clockIds.has(ev.range.clock)) err('clock-missing', ev.evidenceId, `range clock "${ev.range.clock}" not declared`); if (ev.range && ev.range.from > ev.range.to) err('range', ev.evidenceId, 'range reversed'); if (ev.asset && ev.asset.resolved === false) warn('evidence-unresolved', ev.evidenceId, 'asset not resolved to a hash'); }
  for (const c of h.coverage.values()) {
    const id = c.coverageId;
    if (c.status === 'complete' && ((c.gaps && c.gaps.length) || c.dropped > 0 || c.overflow)) err('coverage-contradiction', id, 'status "complete" but gaps/dropped/overflow are recorded');
    if (c.capacity !== undefined && c.recorded !== undefined && c.recorded > c.capacity) err('coverage-contradiction', id, 'recorded exceeds capacity');
    if (c.scope.kind === 'track' && c.scope.ref && !h.tracks.has(c.scope.ref)) err('coverage-scope', id, `track ${c.scope.ref} not found`);
  }
  for (const c of h.checkpoints.values()) if (!clockIds.has(c.at.clock)) err('clock-missing', c.checkpointId, `clock "${c.at.clock}" not declared`);
  for (const e of h.edits.values()) { if (e.parentEdit && !h.edits.has(e.parentEdit)) err('edit-parent', e.editId, `parentEdit ${e.parentEdit} not found`); if (e.branchId && !h.branches.has(e.branchId)) err('branch-missing', e.editId, `branch ${e.branchId} not found`); for (const c of e.causes || []) if (!h.eventById.has(c) && !h.edits.has(c)) err('cause-missing', e.editId, `cause ${c} not found`); }
  for (const b of h.branches.values()) if (b.from) { if (b.from.branchId && !h.branches.has(b.from.branchId)) err('branch-missing', b.branchId, `from.branchId ${b.from.branchId} not found`); if (b.from.editId && !h.edits.has(b.from.editId)) err('edit-parent', b.branchId, `from.editId ${b.from.editId} not found`); if (b.from.checkpointId && !h.checkpoints.has(b.from.checkpointId)) err('checkpoint-missing', b.branchId, `from.checkpointId ${b.from.checkpointId} not found`); }
  for (const x of h.exports.values()) for (const r of x.sourceRanges || []) if (!clockIds.has(r.clock)) err('clock-missing', x.exportId, `sourceRange clock "${r.clock}" not declared`);
  const all = new Set(); for (const m of [h.entities, h.tracks, h.evidence, h.coverage, h.checkpoints, h.edits, h.branches, h.exports]) for (const id of m.keys()) all.add(id); for (const id of h.eventById.keys()) all.add(id);
  for (const [target] of h.supersededBy) if (!all.has(target)) err('supersedes-missing', target, `a record supersedes "${target}" which does not exist`);
  const summary = {}; for (const [k, v] of Object.entries(counts)) summary[k] = v;
  return { ok: errors.length === 0 && !Object.keys(counts).some((k) => k.startsWith('E:')), errors, warnings, summary };
}
