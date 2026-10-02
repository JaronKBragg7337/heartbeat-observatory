// ============================================================================
// shipPath.js — a way through the Meridian for someone who is not the player.
//
// The ship's walkable space is a union of zones (shipWalker.js): a point is walkable where a zone covers it and the
// floor there is within a step of the feet. Rather than hand-write routes (and have them rot the next time a wall moves),
// this plans over the SAME question the player's own body asks, `canStand`, on a 0.3 m grid with A*, then pulls the
// string tight so the walk is a few straight legs, not a staircase of grid cells.
//
// Ladders are not walkable space. A route that needs one is built from a plan to the foot of the ladder, a climb, and a plan
// from the top (see routeToSeat).
// ============================================================================

import { LADDERS_BY_ID } from './shipLadders.js';   // the Meridian's; any other ship's come from its layout (sw.index.layout)

const CELL = 0.3;
const STEP_MAX = 0.42;      // the most the floor may change between two grid neighbours (stairs rise 0.25 per cell)

/**
 * A* over the ship's zones.
 * @param sw  a ShipWalker (its zones follow the ship's state: ramp lowered, hatches). Not moved by planning.
 * @param from {x,y,z} feet   @param to {x,z} (y optional, to pick a deck)   @param opts {reach: metres from `to` that is good enough}
 * @returns [{x,y,z}] waypoints from `from` to the goal, or null
 */
export function planPath(sw, from, to, opts = {}) {
  const reach = opts.reach ?? 0.45;
  const zones = sw.activeZones();
  const stand = (x, y, z) => sw.canStand(x, y, z, zones);
  const s0 = stand(from.x, from.y, from.z);
  if (!s0) return null;
  const key = (ix, iz, y) => ix + ',' + iz + ',' + Math.round(y * 2);
  const ox = from.x, oz = from.z;
  const open = new Map(), closed = new Set();
  const heap = [];                                  // binary min-heap on f
  const push = (n) => { heap.push(n); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p].f <= heap[i].f) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { let l = 2 * i + 1, r = l + 1, m = i; if (l < heap.length && heap[l].f < heap[m].f) m = l; if (r < heap.length && heap[r].f < heap[m].f) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  const h = (x, z) => Math.hypot(x - to.x, z - to.z);
  const start = { ix: 0, iz: 0, x: from.x, y: s0.floor, z: from.z, g: 0, f: h(from.x, from.z), parent: null };
  push(start); open.set(key(0, 0, start.y), start);
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  let found = null, guard = 0;
  while (heap.length && guard++ < 60000) {
    const cur = pop();
    const ck = key(cur.ix, cur.iz, cur.y);
    if (closed.has(ck)) continue;
    closed.add(ck);
    const yOk = to.y === undefined || Math.abs(cur.y - to.y) < 0.8;
    if (yOk && h(cur.x, cur.z) <= reach) { found = cur; break; }
    for (const [dx, dz] of DIRS) {
      const nx = ox + (cur.ix + dx) * CELL, nz = oz + (cur.iz + dz) * CELL;
      const s = stand(nx, cur.y, nz);
      if (!s || Math.abs(s.floor - cur.y) > STEP_MAX) continue;
      if (dx && dz) { const a = stand(cur.x + dx * CELL, cur.y, cur.z), b = stand(cur.x, cur.y, cur.z + dz * CELL); if (!a || !b) continue; }
      const nk = key(cur.ix + dx, cur.iz + dz, s.floor);
      if (closed.has(nk)) continue;
      const g = cur.g + (dx && dz ? 1.414 : 1) * CELL + Math.abs(s.floor - cur.y) * 0.5;
      const prev = open.get(nk);
      if (prev && prev.g <= g) continue;
      const n = { ix: cur.ix + dx, iz: cur.iz + dz, x: nx, y: s.floor, z: nz, g, f: g + h(nx, nz), parent: cur };
      open.set(nk, n); push(n);
    }
  }
  if (!found) return null;
  const raw = [];
  for (let n = found; n; n = n.parent) raw.push({ x: n.x, y: n.y, z: n.z });
  raw.reverse();
  return pull(sw, zones, raw);
}

/** String pulling: keep only the points a straight, standable line cannot skip. */
function pull(sw, zones, pts) {
  if (pts.length < 3) return pts;
  const lineOk = (a, b) => {
    const len = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(len / 0.15));
    let y = a.y;
    for (let i = 1; i <= n; i++) {
      const t = i / n, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
      // keep clear of walls by a hand's width either side of the line
      for (const o of [[0, 0], [0.12, 0], [-0.12, 0], [0, 0.12], [0, -0.12]]) {
        const s = sw.canStand(x + o[0], y, z + o[1], zones);
        if (!s || Math.abs(s.floor - y) > 0.3) return false;
        if (!o[0] && !o[1]) y = s.floor;
      }
    }
    return Math.abs(y - b.y) <= 0.3;       // the line must arrive on the deck the plan did, not a deck it passes under
  };
  const out = [pts[0]];
  let i = 0;
  while (i < pts.length - 1) {
    let j = pts.length - 1;
    while (j > i + 1 && !lineOk(pts[i], pts[j])) j--;
    out.push(pts[j]); i = j;
  }
  return out;
}

/** Where a person may stand to reach a seat (closest first), as {x,y,z}: tried against the walker. */
export function standPointsFor(sw, seat) {
  const yaw = seat.yaw * Math.PI / 180;
  const fwd = { x: Math.sin(yaw), z: -Math.cos(yaw) }, rgt = { x: Math.cos(yaw), z: Math.sin(yaw) };
  const offsets = [[0, 0.9], [0.9, 0], [-0.9, 0], [0, -0.9], [0.6, 0.6], [-0.6, 0.6], [1.2, 0], [0, 1.3], [-1.2, 0]];
  const zones = sw.activeZones();
  const out = [];
  for (const [a, b] of offsets) {
    const x = seat.x - fwd.x * b + rgt.x * a, z = seat.z - fwd.z * b + rgt.z * a;
    const s = sw.canStand(x, seat.y, z, zones);
    if (s) out.push({ x, y: s.floor, z });
  }
  return out;
}

/**
 * The route from a place aboard to a seat: a list of steps
 *   { type:'walk', pts:[{x,y,z}...] }  { type:'ladder', id, dir:'up'|'down' }  then the caller sits.
 * `via` names ladders for the two turret seats.
 */
export function routeToSeat(sw, from, seat) {
  const steps = [];
  let pos = { ...from };
  const walkTo = (to, reach) => {
    const p = planPath(sw, pos, to, { reach });
    if (!p) return false;
    steps.push({ type: 'walk', pts: p.slice(1).length ? p.slice(1) : [p[0]] });
    pos = p[p.length - 1];
    return true;
  };
  const ladderSeat = { gun_dorsal: 'ladder_dorsal', gun_ventral: 'ladder_ventral' }[seat.id];
  if (ladderSeat) {
    // FLEET: the ladders of whichever ship this walker is on
    const L = (sw.index && sw.index.layout && sw.index.layout.ladders ? sw.index.layout.ladders.find((q) => q.id === ladderSeat) : null) || LADDERS_BY_ID[ladderSeat];
    if (ladderSeat === 'ladder_dorsal') {
      if (!walkTo({ x: L.bottomExit.x, z: L.bottomExit.z, y: L.y0 }, 0.32)) return null;
      steps[steps.length - 1].pts.push({ x: L.bottomExit.x, y: L.bottomExit.y, z: L.bottomExit.z });
      steps.push({ type: 'ladder', id: ladderSeat, dir: 'up', face: L.face });
      pos = { ...L.topExit };
    } else {
      if (!walkTo({ x: L.topExit.x, z: L.topExit.z, y: L.y1 }, 0.32)) return null;
      steps[steps.length - 1].pts.push({ x: L.topExit.x, y: L.topExit.y, z: L.topExit.z });
      steps.push({ type: 'ladder', id: ladderSeat, dir: 'down', face: { x: -L.face.x, z: -L.face.z } });
      pos = { ...L.bottomExit };
    }
  }
  // the last leg: to the nearest place beside the seat that stands
  let ok = false;
  for (const sp of standPointsFor(sw, seat)) {
    const p = planPath(sw, pos, { x: sp.x, z: sp.z, y: sp.y }, { reach: 0.25 });
    if (p) { if (p.length > 1) steps.push({ type: 'walk', pts: p.slice(1) }); pos = p[p.length - 1]; ok = true; break; }
  }
  if (!ok && !ladderSeat) return null;
  return steps;
}

const wrapPI = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/**
 * Follows a route with a ShipWalker, using the real collision. Turns toward the next point, walks, climbs a ladder when
 * the route says so, and gives up on a point (steps to it) if it has made no progress for three seconds, so a door that has
 * not opened yet or a corner can never hold a person for ever.
 */
export class RouteWalker {
  constructor(sw, route, walkSpeed = 1.55) {
    this.sw = sw; this.route = route || []; this.ri = 0; this.pi = 0; this.walkSpeed = walkSpeed;
    this.stuckT = 0; this.lastKey = null; this.ladderT = 0; this.snaps = 0; this.speed = 0; this.climbing = false;
  }
  get done() { return this.ri >= this.route.length; }

  /** Advance one frame. */
  step(dt) {
    const sw = this.sw, step = this.route[this.ri];
    this.climbing = false; this.speed = 0;
    if (!step) return;
    sw.walkSpeed = this.walkSpeed;
    if (step.type === 'walk') {
      const tgt = step.pts[this.pi];
      const dx = tgt.x - sw.x, dz = tgt.z - sw.z, d = Math.hypot(dx, dz);
      if (d < 0.2 && Math.abs(tgt.y - sw.y) < 0.6) { if (++this.pi >= step.pts.length) { this.ri++; this.pi = 0; } return; }
      const e = wrapPI(Math.atan2(dx, -dz) - sw.yaw);
      sw.yaw += clamp(e, -5 * dt, 5 * dt);
      sw.tick(dt, { moveZ: Math.abs(e) < 0.8 ? 1 : 0 });
      this.speed = Math.hypot(sw.vx, sw.vz);
      const key = Math.round(sw.x * 10) + ',' + Math.round(sw.z * 10);
      if (this.lastKey === key) this.stuckT += dt; else { this.stuckT = 0; this.lastKey = key; }
      if (this.stuckT > 3) { sw.x = tgt.x; sw.y = tgt.y; sw.z = tgt.z; this.stuckT = 0; this.snaps++; }
    } else if (step.type === 'ladder') {
      sw.yaw = Math.atan2(step.face.x, -step.face.z);
      sw.tick(dt, { moveZ: 1 });
      this.speed = 1.2; this.climbing = true;
      this.ladderT += dt;
      if (sw.events.includes('ladder_top') || sw.events.includes('ladder_bottom')) { this.ri++; this.pi = 0; this.ladderT = 0; }
      else if (this.ladderT > 12) { this.ladderT = 0; this.ri++; this.snaps++; }
    }
  }
}
