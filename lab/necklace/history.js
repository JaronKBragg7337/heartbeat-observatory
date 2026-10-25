// hb-render: event history ("Necklace view"). Every simulated object gets a stable id and a recorded life:
// samples (time, position, velocity) plus events (emitted, collided, soaked, merged, ...). Pure JS (no GPU, no DOM)
// so the clip tool, the phone page and the MCP server all read and write the same format. See README "Event history".
//
// File: <clip>.history.jsonl, one JSON object per line, "k" says what it is:
//   {"k":"meta", format, units, ids, clip, scene, fps, frames, width, height, dt, simStart, simEnd, cameras:[[px,py,pz,tx,ty,tz,fovDeg],...]}
//   {"k":"ev", t, id, e, target, p:[x,y,z], v:[vx,vy,vz], children?, parent?}
//   {"k":"s",  id, rate, s:[[t,x,y,z,vx,vy,vz],...]}                         (one line per traced particle)
//   {"k":"drop", id, t, p:[x,y,z], n, members:[ids...]}                       (a drop = a cluster of lone free particles)
//   {"k":"mem", id, t, drop}                                                 (traced particle belongs to a drop at t)

export const FORMAT = 'hb-history/1';
export const wid = (index) => 'W-' + String(index + 1).padStart(4, '0');     // water particle id  (GPU index + 1)
export const widIndex = (id) => (/^W-\d{4,}$/.test(id) ? parseInt(id.slice(2), 10) - 1 : -1);
export const did = (n) => 'D-' + String(n).padStart(4, '0');                  // drop id
const r2 = (v) => Math.round(v * 1e2) / 1e2, r4 = (v) => Math.round(v * 1e4) / 1e4, r3 = (v) => Math.round(v * 1e3) / 1e3;

export class History {
  constructor(meta = {}) { this.meta = Object.assign({ format: FORMAT }, meta); this.events = []; this.traces = new Map(); this.drops = []; this.members = []; this.tracked = []; }

  addSample(id, rate, t, p, v) {
    let tr = this.traces.get(id);
    if (!tr) { tr = { id, rate, s: [] }; this.traces.set(id, tr); if (rate === 'full') this.tracked.push(tr); }
    tr.s.push([r4(t), r4(p[0]), r4(p[1]), r4(p[2]), r3(v[0]), r3(v[1]), r3(v[2])]);
    return tr;
  }
  addEvent(ev) { this.events.push(ev); }

  // ---- queries (used by the overlay, the page and the MCP tools) ----
  eventsFor(id) { return this.events.filter((e) => e.id === id || e.parent === id || (e.children && e.children.includes(id))); }
  eventsBetween(t0, t1, { kind, id, limit = 200 } = {}) {
    const out = [];
    for (const e of this.events) { if (e.t < t0 || e.t > t1) continue; if (kind && e.e !== kind) continue; if (id && e.id !== id) continue; out.push(e); if (out.length >= limit) break; }
    return out;
  }
  // position and velocity of a traced particle at time t (linear between its samples); null if t is outside its recorded life
  stateAt(id, t) {
    const tr = this.traces.get(id); if (!tr || !tr.s.length) return null;
    const s = tr.s;
    if (t < s[0][0] - 1e-6 || t > s[s.length - 1][0] + 1e-6) return null;
    let lo = 0, hi = s.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (s[m][0] <= t) lo = m; else hi = m; }
    const a = s[lo], b = s[hi], k = b[0] > a[0] ? (t - a[0]) / (b[0] - a[0]) : 0;
    const L = (i) => a[i] + (b[i] - a[i]) * k;
    return { p: [L(1), L(2), L(3)], v: [L(4), L(5), L(6)] };
  }

  // The life story of one id: origin, hits, fate, drops. This is what "tell me your history" returns.
  story(id) {
    const tr = this.traces.get(id), evs = this.eventsFor(id).sort((a, b) => a.t - b.t);
    const out = { id, traced: !!tr, events: evs, summary: {} };
    const em = evs.find((e) => e.e === 'emitted'), hits = evs.filter((e) => e.e === 'collided' && e.target === 'SAND'), soak = evs.find((e) => e.e === 'soaked');
    const spd = (v) => (v ? Math.hypot(v[0], v[1], v[2]) : 0);
    const S = out.summary;
    if (em) { S.leftBottleAt = em.t; S.leftFrom = em.p; S.speedWhenLeaving = r3(spd(em.v)); }
    const sp = evs.find((e) => e.e === 'spawned' && e.id === id);
    if (sp) { S.thrownOffBy = sp.parent; S.thrownAt = sp.t; S.thrownFrom = sp.p; S.thrownSpeed = r3(spd(sp.v)); }
    const kids = this.events.filter((e) => e.e === 'spawned' && e.parent === id);
    if (kids.length) S.splashChildren = kids.map((k) => k.id);
    S.sandHits = hits.length;
    if (hits.length) { S.firstSandHit = { t: hits[0].t, p: hits[0].p, speed: r3(spd(hits[0].v)) }; S.fastestSandHit = r3(Math.max(...hits.map((h) => spd(h.v)))); }
    if (soak) { S.soakedInAt = soak.t; S.soakedAt = soak.p; if (hits.length) S.secondsFromFirstHitToSoak = r3(soak.t - hits[0].t); S.fate = 'soaked into the sand'; }
    else S.fate = tr ? 'still free (not soaked) at the end of the clip' : 'stayed in the bottle (no event) or not traced';
    if (tr) { let mx = 0; for (const r of tr.s) mx = Math.max(mx, spd([r[4], r[5], r[6]])); S.maxSpeed = r3(mx); S.samples = tr.s.length; S.traceRate = tr.rate; S.firstSample = tr.s[0][0]; S.lastSample = tr.s[tr.s.length - 1][0]; }
    const mems = this.members.filter((m) => m.id === id);
    if (mems.length) S.drops = [...new Set(mems.map((m) => m.drop))];
    return out;
  }

  // ---- (de)serialise ----
  toJSONL() {
    const L = [JSON.stringify(this.meta)];
    const evs = this.events.slice().sort((a, b) => a.t - b.t);
    for (const e of evs) L.push(JSON.stringify({ k: 'ev', ...e }));
    for (const tr of this.traces.values()) L.push(JSON.stringify({ k: 's', id: tr.id, rate: tr.rate, s: tr.s }));
    for (const d of this.drops) L.push(JSON.stringify({ k: 'drop', ...d }));
    for (const m of this.members) L.push(JSON.stringify({ k: 'mem', ...m }));
    return L.join('\n') + '\n';
  }
  static fromJSONL(text) {
    const H = new History();
    for (const line of text.split('\n')) {
      if (!line) continue;
      let o; try { o = JSON.parse(line); } catch (e) { continue; }
      if (o.k === 'meta') H.meta = o;
      else if (o.k === 'ev') { const { k, ...e } = o; H.events.push(e); }
      else if (o.k === 's') { const tr = { id: o.id, rate: o.rate, s: o.s }; H.traces.set(o.id, tr); if (o.rate === 'full') H.tracked.push(tr); }
      else if (o.k === 'drop') { const { k, ...d } = o; H.drops.push(d); }
      else if (o.k === 'mem') { const { k, ...m } = o; H.members.push(m); }
    }
    return H;
  }
  // frame index <-> sim time (frames are evenly spaced from simStart to simEnd)
  frameTime(f) { const M = this.meta; return M.frames <= 1 ? M.simStart : M.simStart + (M.simEnd - M.simStart) * f / (M.frames - 1); }
  frameOf(t) { const M = this.meta; return M.frames <= 1 ? 0 : Math.max(0, Math.min(M.frames - 1, Math.round((t - M.simStart) / (M.simEnd - M.simStart) * (M.frames - 1)))); }
}

// ---- recorder: turns raw solver output into history rows ----
// sample(step, pos, vel): called every `stride` solver steps with the full GPU arrays (xyz + alive flag, xyz).
// events(list): decoded GPU events. Traced = id % trackMod == 0 (full rate); every other free particle gets a row every `lowEvery` samples.
export class Recorder {
  constructor(H, { dt, n, isInside, trackMod = 20, lowEvery = 8 }) { Object.assign(this, { H, dt, n, isInside, trackMod, lowEvery }); this.k = 0; this.freeSince = new Float32Array(n).fill(-1); }
  sample(step, pos, vel) {
    const t = step * this.dt, H = this.H; this.k++;
    const low = this.k % this.lowEvery === 0;
    for (let i = 0; i < this.n; i++) {
      if (pos[i * 4 + 3] < 0.5) continue;
      const x = pos[i * 4], y = pos[i * 4 + 1], z = pos[i * 4 + 2];
      if (this.isInside(x, y, z)) continue;
      const tracked = i % this.trackMod === 0;
      if (this.freeSince[i] < 0) this.freeSince[i] = t;
      if (tracked || low || this.freeSince[i] === t) H.addSample(wid(i), tracked ? 'full' : 'low', t, [x, y, z], [vel[i * 4], vel[i * 4 + 1], vel[i * 4 + 2]]);
    }
  }
  events(list) {
    for (const e of list) {
      const id = wid(e.index);
      const ev = { t: r4(e.step * this.dt), id, e: e.kind === 1 ? 'emitted' : e.kind === 4 ? 'soaked' : e.kind === 5 ? 'spawned' : 'collided', p: [r3(e.p[0]), r3(e.p[1]), r3(e.p[2])] };
      if (e.kind !== 4) ev.v = [r2(e.v[0]), r2(e.v[1]), r2(e.v[2])];   // soak events carry no velocity (the drop has stopped)
      if (e.kind === 2) ev.target = 'SAND'; else if (e.kind === 3) ev.target = 'BOTTLE'; else if (e.kind === 4 || e.kind === 5) ev.target = 'SAND';
      if (e.kind === 5 && e.parent >= 0) ev.parent = wid(e.parent);   // a splash droplet thrown off by that drop's impact
      this.H.addEvent(ev);
    }
  }
}

// ---- drops: clusters of lone free particles, with persistent ids, merge and split events ----
export class DropTracker {
  constructor(H) { this.H = H; this.next = 1; this.owner = new Map(); }   // owner: particle index -> drop id from the previous frame
  update(t, cpu, isInside, cell) {
    const n = cpu.n, H = this.H;
    const idx = [];
    for (let i = 0; i < n; i++) if (cpu.dens[i] < 0.75 && !isInside(cpu.x[i * 3], cpu.x[i * 3 + 1], cpu.x[i * 3 + 2])) idx.push(i);
    // grid + union-find
    const key = (x, y, z) => x + ',' + y + ',' + z, grid = new Map(), par = new Int32Array(idx.length);
    const find = (a) => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; };
    idx.forEach((pi, a) => { par[a] = a; const c = [Math.floor(cpu.x[pi * 3] / cell), Math.floor(cpu.x[pi * 3 + 1] / cell), Math.floor(cpu.x[pi * 3 + 2] / cell)]; const k = key(...c); (grid.get(k) || grid.set(k, []).get(k)).push([a, c]); });
    for (const [, list] of grid) for (const [a, c] of list) for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const o = grid.get(key(c[0] + dx, c[1] + dy, c[2] + dz)); if (!o) continue;
      for (const [b] of o) { if (b <= a) continue; const pa = idx[a], pb = idx[b]; const ex = cpu.x[pa * 3] - cpu.x[pb * 3], ey = cpu.x[pa * 3 + 1] - cpu.x[pb * 3 + 1], ez = cpu.x[pa * 3 + 2] - cpu.x[pb * 3 + 2]; if (ex * ex + ey * ey + ez * ez < cell * cell) { const ra = find(a), rb = find(b); if (ra !== rb) par[ra] = rb; } }
    }
    const clusters = new Map();
    idx.forEach((pi, a) => { const r = find(a); (clusters.get(r) || clusters.set(r, []).get(r)).push(pi); });
    const list = [...clusters.values()].filter((m) => m.length >= 3).sort((a, b) => b.length - a.length);
    const newOwner = new Map(), claimed = new Set();
    for (const members of list) {
      const votes = new Map(); for (const pi of members) { const d = this.owner.get(cpu.id ? cpu.id[pi] : pi); if (d) votes.set(d, (votes.get(d) || 0) + 1); }
      const sorted = [...votes.entries()].sort((a, b) => b[1] - a[1]);
      let id = null; const parents = sorted.map((s) => s[0]);
      for (const d of parents) if (!claimed.has(d)) { id = d; break; }
      let parent = null;
      if (!id) { id = did(this.next++); if (parents.length) { parent = parents[0]; H.addEvent({ t: r4(t), id, e: 'split', target: 'DROP', parent }); } else H.addEvent({ t: r4(t), id, e: 'formed', target: 'DROP', n: members.length }); }
      else if (parents.length > 1) { const kids = parents.filter((d) => d !== id); H.addEvent({ t: r4(t), id, e: 'merged', target: 'DROP', children: kids }); }
      claimed.add(id);
      let cx = 0, cy = 0, cz = 0; for (const pi of members) { cx += cpu.x[pi * 3]; cy += cpu.x[pi * 3 + 1]; cz += cpu.x[pi * 3 + 2]; }
      const m = members.length; const ids = members.slice(0, 16).map((pi) => wid(cpu.id ? cpu.id[pi] : pi));
      H.drops.push({ id, t: r4(t), p: [r4(cx / m), r4(cy / m), r4(cz / m)], n: m, members: ids });
      for (const pi of members) { const pid = cpu.id ? cpu.id[pi] : pi; newOwner.set(pid, id); if (pid % (H.meta.trackMod || 10) === 0) H.members.push({ id: wid(pid), t: r4(t), drop: id }); }
    }
    this.owner = newOwner;
    return list.length;
  }
}
