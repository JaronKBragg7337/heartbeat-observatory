/* ============================================================================
   field.js - The Arena's rules of space, shared by browsers and AI players
   ---------------------------------------------------------------------------
   No three.js, no DOM, no network. arena.js (the page) and
   agent/arena-agent.mjs (Node) both import this file, so a person and an AI
   agree on where cover is, who can see whom, and where a paintball flies.

   A paintball is fully decided by its fire event: start point p, velocity v,
   gravity. Position at age t = p + v t + 1/2 g t^2. Every client flies the
   same arc from the same event (like the gym's basketball), and the first
   thing it touches (cover, ground, the net) is found by stepping 1/240 s, so
   every client finds the same splat. Paintballs break on contact: no bounce.

   Coordinates: metres. x east (+x = toward B), z north, y up. Bearing 0 deg =
   north (+z), 90 deg = east (+x), like a compass. yaw (radians) uses the same
   rule: facing = (sin yaw, cos yaw).
   ========================================================================== */

export const DEFAULT_RULES = {
  ballSpeed: 24, gravity: 9.81, ballRadius: 0.07, respawnS: 3, fireCooldownS: 0.25,
  playerRadius: 0.32, playerHeight: 1.8, runSpeed: 4.2, stepUp: 0.45,
  friendlyFire: false,   // team mode: a teammate's ball passes through you (no tag, no point)
};
const STEP = 1 / 240;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/** zones.json -> the field: { halfX, halfZ, netHeight, rules, cover[] (normalised), zones } */
export function fieldFrom(data) {
  const f = (data && data.field) || {};
  const rules = Object.assign({}, DEFAULT_RULES, (data && data.rules) || {});
  const cover = ((data && data.cover) || []).map(normCover).filter(Boolean);
  return { halfX: f.halfX || 20, halfZ: f.halfZ || 12, netHeight: f.netHeight || 5, rules, cover, zones: (data && data.zones) || [], teams: (data && data.teams) || {} };
}

function normCover(c) {
  if (!c || !c.kind) return null;
  const o = Object.assign({}, c);
  o.x = +o.x || 0; o.z = +o.z || 0; o.h = +o.h || 1;
  if (o.kind === "can") { o.r = +o.r || 0.6; o.w = o.d = o.r * 2; }
  else { o.w = +o.w || 1; o.d = +o.d || 1; }
  o.minX = o.x - o.w / 2; o.maxX = o.x + o.w / 2; o.minZ = o.z - o.d / 2; o.maxZ = o.z + o.d / 2;
  o.name = { block: "bunker", can: "can bunker", wall: "low wall", ramp: "ramp" }[o.kind] || o.kind;
  return o;
}

/** a ramp's surface height at (x, z); 0 outside its footprint */
export function rampHeight(r, x, z) {
  if (x < r.minX || x > r.maxX || z < r.minZ || z > r.maxZ) return 0;
  let t;
  switch (r.rise) {
    case "-x": t = (r.maxX - x) / r.w; break;
    case "+z": t = (z - r.minZ) / r.d; break;
    case "-z": t = (r.maxZ - z) / r.d; break;
    default:   t = (x - r.minX) / r.w;
  }
  return r.h * clamp(t, 0, 1);
}

/** the floor height under (x, z): the turf (0) or a ramp */
export function groundAt(F, x, z) {
  let g = 0;
  for (const c of F.cover) if (c.kind === "ramp") { const h = rampHeight(c, x, z); if (h > g) g = h; }
  return g;
}

/** is the point (x, y, z) inside something solid? -> null | { what, id, n:[nx,ny,nz] } */
export function solidAt(F, x, y, z) {
  if (y <= 0) return { what: "ground", id: "turf", n: [0, 1, 0] };
  if (x <= -F.halfX || x >= F.halfX || z <= -F.halfZ || z >= F.halfZ) {
    const n = x <= -F.halfX ? [1, 0, 0] : x >= F.halfX ? [-1, 0, 0] : z <= -F.halfZ ? [0, 0, 1] : [0, 0, -1];
    return { what: "net", id: "net", n };
  }
  for (const c of F.cover) {
    if (c.kind === "can") {
      const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz);
      if (d < c.r && y < c.h) {
        // top or side, whichever is nearer
        if (c.h - y < c.r - d) return { what: c.name, id: c.id, n: [0, 1, 0] };
        return { what: c.name, id: c.id, n: d > 1e-6 ? [dx / d, 0, dz / d] : [1, 0, 0] };
      }
    } else if (c.kind === "ramp") {
      const h = rampHeight(c, x, z);
      if (h > 0 && y < h) {
        const s = c.h / (c.rise === "+z" || c.rise === "-z" ? c.d : c.w), k = 1 / Math.hypot(1, s);
        const n = c.rise === "-x" ? [s * k, k, 0] : c.rise === "+z" ? [0, k, -s * k] : c.rise === "-z" ? [0, k, s * k] : [-s * k, k, 0];
        return { what: c.name, id: c.id, n };
      }
    } else if (x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ && y < c.h) {
      // the face it went in through: the smallest overlap
      const o = [[x - c.minX, [-1, 0, 0]], [c.maxX - x, [1, 0, 0]], [z - c.minZ, [0, 0, -1]], [c.maxZ - z, [0, 0, 1]], [c.h - y, [0, 1, 0]]];
      o.sort((a, b) => a[0] - b[0]);
      return { what: c.name, id: c.id, n: o[0][1] };
    }
  }
  return null;
}

/* ------------------------------------------------------------- the ball - */
/** ball = { p:[x,y,z], v:[vx,vy,vz] }. Position at age t (seconds). */
export function ballAt(F, b, t) {
  const g = F.rules.gravity;
  return [b.p[0] + b.v[0] * t, b.p[1] + b.v[1] * t - 0.5 * g * t * t, b.p[2] + b.v[2] * t];
}

/** where and when the ball breaks: { t, p:[x,y,z], what, id, n } (or the end of a 4 s flight) */
export function impactOf(F, b, maxT) {
  const end = maxT || 4;
  for (let t = STEP; t <= end; t += STEP) {
    const p = ballAt(F, b, t);
    const s = solidAt(F, p[0], p[1], p[2]);
    if (s) {
      // back up to the surface (a few halvings) so the splat sits on it
      let lo = t - STEP, hi = t;
      for (let i = 0; i < 6; i++) { const m = (lo + hi) / 2, q = ballAt(F, b, m); if (solidAt(F, q[0], q[1], q[2])) hi = m; else lo = m; }
      const q = ballAt(F, b, lo);
      if (s.what === "ground") q[1] = 0;
      return { t: lo, p: q, what: s.what, id: s.id, n: s.n };
    }
  }
  return { t: end, p: ballAt(F, b, end), what: "air", id: null, n: [0, 1, 0] };
}

/** the moment the ball crosses the seam x = 0 (the page line), or null. x is linear in t, so it crosses at most once. */
export function seamCrossing(b, tEnd, seamX) {
  const sx = seamX || 0, vx = b.v[0];
  if (Math.abs(vx) < 1e-6) return null;
  const t = (sx - b.p[0]) / vx;
  if (t <= 0 || t > tEnd) return null;
  return { t, from: b.p[0] < sx ? "a" : "b", to: b.p[0] < sx ? "b" : "a" };
}

/** does the ball touch a standing player (feet at y0) between ages t0 and t1? -> age of the hit or null */
export function hitTime(F, b, t0, t1, pl) {
  const R = F.rules.playerRadius + F.rules.ballRadius, H = F.rules.playerHeight + 0.05, y0 = pl.y || 0;
  const n = Math.max(1, Math.ceil((t1 - t0) / (1 / 480)));
  for (let i = 0; i <= n; i++) {
    const t = t0 + (t1 - t0) * (i / n), p = ballAt(F, b, t);
    if (Math.hypot(p[0] - pl.x, p[2] - pl.z) < R && p[1] > y0 - 0.02 && p[1] < y0 + H) return t;
  }
  return null;
}

/** closest the ball comes to a player's body centre before it breaks: { d, t } */
export function closestApproach(F, b, tEnd, pl) {
  let best = { d: Infinity, t: 0 };
  const cy = (pl.y || 0) + 1.1;
  for (let t = 0; t <= tEnd; t += 1 / 120) {
    const p = ballAt(F, b, t);
    const dy = p[1] > cy + 0.7 ? p[1] - (cy + 0.7) : p[1] < cy - 1.1 ? p[1] - (cy - 1.1) : 0;
    const d = Math.hypot(p[0] - pl.x, p[2] - pl.z, dy);
    if (d < best.d) best = { d, t };
  }
  return best;
}

/** velocity that sends a ball from `from` through `to` at speed s (the flatter of the two arcs); 45 deg if out of reach */
export function solveLaunch(F, from, to, speed) {
  const s = speed || F.rules.ballSpeed, g = F.rules.gravity;
  const dx = to[0] - from[0], dz = to[2] - from[2], dy = to[1] - from[1];
  const d = Math.hypot(dx, dz);
  if (d < 1e-4) return [0, dy >= 0 ? s : -s, 0];
  const disc = s ** 4 - g * (g * d * d + 2 * dy * s * s);
  const ang = disc >= 0 ? Math.atan((s * s - Math.sqrt(disc)) / (g * d)) : Math.PI / 4;
  const h = s * Math.cos(ang);
  return [(dx / d) * h, s * Math.sin(ang), (dz / d) * h];
}

/* -------------------------------------------------------- line of sight - */
/** is the straight line from a to b ([x,y,z]) clear of cover and the net? (the turf only blocks below 0) */
export function lineClear(F, a, b) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const n = Math.max(1, Math.ceil(L / 0.08));
  for (let i = 1; i < n; i++) {
    const k = i / n, x = a[0] + (b[0] - a[0]) * k, y = a[1] + (b[1] - a[1]) * k, z = a[2] + (b[2] - a[2]) * k;
    const s = solidAt(F, x, y, z);
    if (s) return false;
  }
  return true;
}

/** what one player sees of another: "yes" (body), "head" (only the head shows over cover), "no" */
export function sightOf(F, me, them) {
  const eye = [me.x, (me.y || 0) + 1.6, me.z];
  if (lineClear(F, eye, [them.x, (them.y || 0) + 1.1, them.z])) return "yes";
  if (lineClear(F, eye, [them.x, (them.y || 0) + 1.65, them.z])) return "head";
  return "no";
}

/* ------------------------------------------------------------ walking - */
/** push a walker (radius r) out of cover and back inside the net. Ramps are floor, except a step taller than stepUp. */
export function pushOut(F, x, z, r, fromY) {
  const R = r == null ? F.rules.playerRadius : r;
  x = clamp(x, -F.halfX + R, F.halfX - R); z = clamp(z, -F.halfZ + R, F.halfZ - R);
  for (const c of F.cover) {
    if (c.kind === "ramp") continue;
    if (c.kind === "can") {
      const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz), m = c.r + R;
      if (d < m) { if (d > 1e-5) { x = c.x + (dx / d) * m; z = c.z + (dz / d) * m; } else x = c.x + m; }
      continue;
    }
    const nx = clamp(x, c.minX, c.maxX), nz = clamp(z, c.minZ, c.maxZ);
    const dx = x - nx, dz = z - nz, d = Math.hypot(dx, dz);
    if (d < R) {
      if (d > 1e-5) { x = nx + (dx / d) * R; z = nz + (dz / d) * R; }
      else {
        const o = [[c.minX - R, z], [c.maxX + R, z], [x, c.minZ - R], [x, c.maxZ + R]];
        o.sort((u, v) => Math.hypot(u[0] - x, u[1] - z) - Math.hypot(v[0] - x, v[1] - z));
        x = o[0][0]; z = o[0][1];
      }
    }
  }
  return { x: clamp(x, -F.halfX + R, F.halfX - R), z: clamp(z, -F.halfZ + R, F.halfZ - R) };
}

/** one walking step from (x,z) by (dx,dz): axis by axis, so you slide along cover; a ramp's tall end is a wall */
export function walkStep(F, x, z, dx, dz, y) {
  const up = F.rules.stepUp, cur = y == null ? groundAt(F, x, z) : y;
  let nx = x + dx, nz = z;
  if (groundAt(F, nx, nz) - cur > up) nx = x;
  let p = pushOut(F, nx, nz);
  nx = p.x; nz = p.z + dz;
  if (groundAt(F, nx, nz) - cur > up) nz = p.z;
  p = pushOut(F, nx, nz);
  return { x: p.x, z: p.z, y: groundAt(F, p.x, p.z) };
}

/* -------------------------------------------------------------- helpers - */
export const bearingDeg = (dx, dz) => ((Math.atan2(dx, dz) * 180) / Math.PI + 360) % 360;
export const yawOfBearing = (deg) => { let r = (deg * Math.PI) / 180; r = Math.atan2(Math.sin(r), Math.cos(r)); return r; };
export const compass = (deg) => ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(((deg % 360) + 360) % 360 / 45) % 8];
export function zoneAt(F, x) { return x < 0 ? "a" : "b"; }
/** can this ball tag this player? With friendly fire off (the default), never your own team's ball. */
export const canTag = (F, ballTeam, targetTeam) => !!(F && F.rules && F.rules.friendlyFire) || ballTeam !== targetTeam;
/** team + page + out ride the shell's `place` field: "a|b" = on page A, team B; "b|a|out" = tagged, waiting to respawn */
export const placeOf = (zone, team, out) => `${zone}|${team}${out ? "|out" : ""}`;
export function parsePlace(s) {
  const [zone, team, out] = String(s || "").split("|");
  return { zone: zone || "", team: team || zone || "", out: out === "out" };
}

export default { fieldFrom, groundAt, rampHeight, solidAt, ballAt, impactOf, seamCrossing, hitTime, closestApproach, solveLaunch, lineClear, sightOf, pushOut, walkStep, bearingDeg, yawOfBearing, compass, zoneAt, placeOf, parsePlace, canTag, DEFAULT_RULES };
