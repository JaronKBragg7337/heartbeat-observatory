// Heartbeat Rocket - missions (no drawing, no DOM). Shared by the game and by the headless test.
// - advance(): steps a flight forward (small exact steps near the ground or with the engine on, bigger RK4
//   steps when coasting in empty space, so a trip to the Moon can run fast).
// - predictPath(): where the rocket will go, patched conics (the planet's pull, then the Moon's inside its
//   sphere of influence), worked out step by step with the same gravity as the flight.
// - Kepler orbits for things that stay up between flights (satellites, the space station).
// - The helpers ("autopilot programs") that fly the tricky parts in Helpers-on mode: go to the Moon, land on
//   it, fly home, make an orbit round and let a satellite go, fly to the station and dock.
// Everything here is real physics: helpers only point the rocket and work the engine, like a pilot would.
// Built by Claude (Opus 5.5) for Heartbeat Observatory. CC0.
import {
  R, GM, ATM_TOP, STEP, DEG, MOON_R, MOON_GM, MOON_A, MOON_N, MOON_DIR, MOON_SOI, MOON_SPIN,
  wrapA, stepPhysics, coastStep, coastLimit, gravAt, moonPos, moonVel, moonAngle, inMoonSOI,
  bodyRel, orbitOf, orbitInfo, stage, mass, fuelLeft,
} from './physics.js';

export const RELAY_R = R + 1200000;     // relays sit high, so each one can see past the curve to the next
export const STATION_R = R + 250000;    // where the helper builds the station
export const DOCK_RANGE = 40000, DOCK_SPEED = 40;   // close enough for the docking helper to line you up
export const SATS = {
  weather:   { name: 'Weather satellite', short: 'Weather', why: 'It watches clouds and storms from above, so people know when rain is coming.' },
  relay:     { name: 'Relay satellite', short: 'Relay', why: 'It passes messages around the curve of the planet, so people far apart can talk.' },
  telescope: { name: 'Space telescope', short: 'Telescope', why: 'Space has no air to blur the stars, so a telescope up here sees much sharper.' },
};
export const MODULES = [
  { kind: 'core',  name: 'Core module', why: 'The heart of the station: air, water and a place for the crew to live.' },
  { kind: 'solar', name: 'Solar wings', why: 'Big panels turn sunlight into power for the whole station.' },
  { kind: 'lab',   name: 'Science lab', why: 'Scientists test how plants, water and fire behave with no weight.' },
  { kind: 'hab',   name: 'Living room', why: 'More room to sleep, eat and float around. A bigger crew can stay.' },
  { kind: 'dock',  name: 'Docking hub', why: 'More ports, so more ships can visit at once.' },
  { kind: 'solar', name: 'More solar wings', why: 'A bigger station needs more power.' },
];
export function moduleFor(i) { return MODULES[Math.min(i, MODULES.length - 1)]; }

const hdg = (x, y) => Math.atan2(x, y);              // heading of a vector (0 = +y, clockwise toward +x)
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------------------------------------------------------------- Kepler orbits (planet only)
export function kepFromState(x, y, vx, vy, T) {
  const r = Math.hypot(x, y), v2 = vx * vx + vy * vy, h = x * vy - y * vx, dir = h >= 0 ? 1 : -1;
  const rv = x * vx + y * vy;
  const ex = ((v2 - GM / r) * x - rv * vx) / GM, ey = ((v2 - GM / r) * y - rv * vy) / GM;
  const e = Math.hypot(ex, ey), a = 1 / (2 / r - v2 / GM);
  const w = e > 1e-7 ? Math.atan2(ey, ex) : Math.atan2(y, x);
  const nu = dir * wrapA(Math.atan2(y, x) - w);
  const E = 2 * Math.atan(Math.sqrt((1 - e) / (1 + e)) * Math.tan(nu / 2));
  return { a, e, w, M0: E - e * Math.sin(E), T0: T, dir };
}
export function kepAt(k, T) {
  const n = Math.sqrt(GM / (k.a * k.a * k.a));
  let M = wrapA(k.M0 + n * (T - k.T0)), E = k.e < 0.8 ? M : Math.PI * Math.sign(M || 1);
  for (let i = 0; i < 30; i++) { const d = (E - k.e * Math.sin(E) - M) / (1 - k.e * Math.cos(E)); E -= d; if (Math.abs(d) < 1e-12) break; }
  const nu = 2 * Math.atan2(Math.sqrt(1 + k.e) * Math.sin(E / 2), Math.sqrt(1 - k.e) * Math.cos(E / 2));
  const r = k.a * (1 - k.e * Math.cos(E)), p = k.a * (1 - k.e * k.e);
  const ang = k.w + k.dir * nu, ux = Math.cos(ang), uy = Math.sin(ang);
  const vr = Math.sqrt(GM / p) * k.e * Math.sin(nu), vt = Math.sqrt(GM * p) / r;
  const tx = -k.dir * uy, ty = k.dir * ux;
  return { x: r * ux, y: r * uy, vx: vr * ux + vt * tx, vy: vr * uy + vt * ty };
}
export function kepPeri(k) { return k.a * (1 - k.e) - R; }
export function kepApo(k) { return k.a * (1 + k.e) - R; }

// Relays form a ring when, going around the planet, each one can see the next past the planet and its air.
export function relayRing(points) {
  const ps = points.map(p => ({ ...p, ang: Math.atan2(p.y, p.x) })).sort((a, b) => a.ang - b.ang);
  const links = [];
  const n = ps.length;
  for (let i = 0; i < n; i++) {
    if (n < 2 || (n === 2 && i === 1)) break;
    const a = ps[i], b = ps[(i + 1) % n];
    links.push({ a, b, clear: segClear(a.x, a.y, b.x, b.y, R + ATM_TOP) });
  }
  return { ok: n >= 3 && links.every(l => l.clear), links, n };
}
function segClear(x1, y1, x2, y2, rad) {
  const dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy;
  const t = L2 > 0 ? clamp(-(x1 * dx + y1 * dy) / L2, 0, 1) : 0;
  return Math.hypot(x1 + dx * t, y1 + dy * t) > rad;
}
// the best open spot for the next relay (an angle), so three end up evenly spread
export function relaySlot(points) {
  if (!points.length) return null;
  const angs = points.map(p => Math.atan2(p.y, p.x));
  let best = null, bestD = -1;
  for (const a of angs) for (const s of [1, -1]) {
    const c = a + s * 2 * Math.PI / 3;
    const d = Math.min(...angs.map(b => Math.abs(wrapA(c - b))));
    if (d > bestD) { bestD = d; best = c; }
  }
  return best;
}

// ---------------------------------------------------------------- the predicted path (patched conics)
// Returns { pts:[[x,y,t,inMoon]], soiIn, soiOut, hitMoon, air, escape, moonPe (closest distance to the Moon's
// centre while in its pull), moonSigned (+/- by which side you pass; continuous even with no encounter),
// planetPeAfter (low point over the planet after leaving the Moon), end }
export function predictPath(x, y, vx, vy, T, o = {}) {
  const maxT = o.maxT ?? 600000, k = o.k ?? 0.012;
  let inM = inMoonSOI(x, y, T), t = 0;
  const out = { pts: [[x, y, 0, inM]], soiIn: null, soiOut: null, hitMoon: null, air: null, escape: false,
    moonPe: null, moonSigned: null, planetPeAfter: null, end: 'time', closest: null };
  let best = Infinity, bestSigned = null, inBest = Infinity, swept = 0, lastAng = Math.atan2(y, x), startedIn = inM;
  if (inM) { const m = moonPos(T), mv = moonVel(T); const mo = orbitOf(x - m[0], y - m[1], vx - mv[0], vy - mv[1], MOON_GM, 0); out.moonAim = Math.sign(mo.h || 1) * mo.peri; }
  for (let i = 0; i < (o.maxSteps ?? 6000); i++) {
    let bx = 0, by = 0, gm = GM;
    const m0 = moonPos(T + t);
    if (inM) { bx = m0[0]; by = m0[1]; gm = MOON_GM; }
    const rx = x - bx, ry = y - by, rb = Math.hypot(rx, ry);
    let h = k * Math.sqrt(rb * rb * rb / gm);
    if (!inM) { const dm = Math.hypot(x - m0[0], y - m0[1]); h = Math.min(h, Math.max(15, (dm - MOON_SOI) / 2000)); }
    else { const vrel = Math.hypot(vx - moonVel(T + t)[0], vy - moonVel(T + t)[1]); h = Math.min(h, Math.max(2, (rb - MOON_R) / Math.max(1, vrel) * 0.3)); }
    h = clamp(h, 0.5, 900); if (t + h > maxT) h = maxT - t; if (h <= 0) break;
    const acc = (px, py, pt) => gravAt(px, py, pt, inM);
    const a1 = acc(x, y, T + t);
    const a2 = acc(x + vx * h / 2, y + vy * h / 2, T + t + h / 2);
    const v2x = vx + a1[0] * h / 2, v2y = vy + a1[1] * h / 2;
    const a3 = acc(x + v2x * h / 2, y + v2y * h / 2, T + t + h / 2);
    const v3x = vx + a2[0] * h / 2, v3y = vy + a2[1] * h / 2;
    const a4 = acc(x + v3x * h, y + v3y * h, T + t + h);
    const v4x = vx + a3[0] * h, v4y = vy + a3[1] * h;
    x += h / 6 * (vx + 2 * v2x + 2 * v3x + v4x); y += h / 6 * (vy + 2 * v2y + 2 * v3y + v4y);
    vx += h / 6 * (a1[0] + 2 * a2[0] + 2 * a3[0] + a4[0]); vy += h / 6 * (a1[1] + 2 * a2[1] + 2 * a3[1] + a4[1]);
    t += h;
    const m = moonPos(T + t), mv = moonVel(T + t);
    const dx = x - m[0], dy = y - m[1], dm = Math.hypot(dx, dy);
    const hs = dx * (vy - mv[1]) - dy * (vx - mv[0]);
    if (dm < best) { best = dm; bestSigned = Math.sign(hs || 1) * dm; out.closest = { t, d: dm, x, y, mx: m[0], my: m[1] }; }
    const nowIn = dm < MOON_SOI;
    if (nowIn !== inM) {
      if (nowIn && !out.soiIn) {
        out.soiIn = { t, x, y, mx: m[0], my: m[1], i: out.pts.length };
        const mo = orbitOf(dx, dy, vx - mv[0], vy - mv[1], MOON_GM, 0);
        out.moonAim = Math.sign(mo.h || 1) * mo.peri;      // signed low point over the Moon's centre (smooth, even through the Moon)
      }
      else if (!nowIn && (out.soiIn || startedIn) && !out.soiOut) {
        out.soiOut = { t, x, y, mx: m[0], my: m[1], i: out.pts.length };
        const po = orbitOf(x, y, vx, vy, GM, R);
        out.planetPeAfter = po.escape ? (po.peri) : po.peri;
        out.afterOrbit = po;
      }
      inM = nowIn;
    }
    if (inM && dm < inBest) inBest = dm;
    out.pts.push([x, y, t, inM]);
    if (inM && dm <= MOON_R) { out.hitMoon = { t, x, y, mx: m[0], my: m[1] }; out.end = 'moon'; break; }
    const r = Math.hypot(x, y);
    if (!inM && r <= R + ATM_TOP) { out.air = { t, x, y }; out.end = 'air'; break; }
    if (!inM && r > MOON_A * 2.4) { out.end = 'far'; out.escape = orbitOf(x, y, vx, vy, GM, R).escape; break; }
    if (out.soiOut && o.stopAfterExit) { out.end = 'exit'; break; }
    if (!inM) {   // one full turn around the planet with nothing new happening: the path repeats from here
      const ang = Math.atan2(y, x); swept += Math.abs(wrapA(ang - lastAng)); lastAng = ang;
      if (swept > 2 * Math.PI * (o.turns ?? 1.02) && !out.soiIn && !startedIn) { out.end = 'loop'; break; }
      if (swept > 2 * Math.PI * (o.turns ?? 1.02) && out.soiOut) { out.end = 'loop'; break; }
    }
    if (t >= maxT) break;
  }
  if (inBest < Infinity) out.moonPe = inBest;
  out.moonSigned = out.moonAim !== undefined ? out.moonAim : bestSigned;
  if (startedIn && !out.soiOut && out.end !== 'moon') out.captured = true;
  out.tEnd = t;
  return out;
}
export function predictFrom(f, o) { return predictPath(f.x, f.y, f.vx, f.vy, f.T0 + f.t, o); }

// ---------------------------------------------------------------- burn timing helpers
// Burn timing for a trip to something on a round orbit (the Moon, an open relay spot, the station):
// a half-way-around trip from here to radius rT takes Tt; the target must be at the far side when we arrive.
// ghost = where the target should be NOW for a burn now. err = how far the real one is from the ghost.
export function transferWindow(f, rT, angNow, rateT) {
  const r = Math.hypot(f.x, f.y), hm = f.x * f.vy - f.y * f.vx, dir = hm >= 0 ? 1 : -1;
  const o = orbitInfo(f);
  const r1 = o.escape ? r : o.a;
  const Tt = Math.PI * Math.sqrt(Math.pow((r1 + rT) / 2, 3) / GM);
  const wr = hm / (r * r);
  const ghost = Math.atan2(f.y, f.x) + dir * Math.PI - rateT * Tt;
  const err = wrapA(angNow - ghost);
  const rate = rateT - wr;
  let tw = -err / rate; if (tw < 0) tw += 2 * Math.PI / Math.abs(rate);
  return { ghost, err, tw, dir, Tt, rT };
}
export function moonWindow(f) {
  const w = transferWindow(f, MOON_A, moonAngle(f.T0 + f.t), MOON_DIR * MOON_N);
  w.prograde = w.dir === MOON_DIR;
  return w;
}
export function stationWindow(f, kep) {
  const s = kepAt(kep, f.T0 + f.t), rs = Math.hypot(s.x, s.y);
  return transferWindow(f, rs, Math.atan2(s.y, s.x), (s.x * s.vy - s.y * s.vx) / (rs * rs));
}
export function relayWindow(f, relays) {
  const T = f.T0 + f.t, pts = relays.map(k => kepAt(k, T));
  const slot = relaySlot(pts);
  if (slot === null) return null;
  const dir = (f.x * f.vy - f.y * f.vx) >= 0 ? 1 : -1;
  return { ...transferWindow(f, RELAY_R, slot, dir * Math.sqrt(GM / Math.pow(RELAY_R, 3))), slot };
}
// the slider position (-1..1) that points the rocket at heading h (0 = straight up from the body you're near)
export function leanFor(f, h) { const B = bodyRel(f); return clamp(wrapA(h - Math.atan2(B.rx, B.ry)) / (Math.PI / 2), -1, 1); }
export function progradeH(f) { return prog(f); }
function timeToApo(f) {
  const r = Math.hypot(f.x, f.y), o = orbitInfo(f);
  if (o.escape) return Infinity;
  const vr = (f.x * f.vx + f.y * f.vy) / r;
  if (o.e < 1e-4) return 0;
  const cosE = clamp((1 - r / o.a) / o.e, -1, 1);
  let E = Math.acos(cosE); if (vr < 0) E = 2 * Math.PI - E;
  const M = E - o.e * Math.sin(E), n = Math.sqrt(GM / (o.a * o.a * o.a));
  return M <= Math.PI ? (Math.PI - M) / n : (3 * Math.PI - M) / n;   // past the top: the next one
}
function accMax(f) { const s = stage(f); return s ? s.mdot * s.eng.ispVac * 9.81 / mass(f) : 0; }
function burnTime(f, dv) { const a = accMax(f); return a > 0 ? dv / a : 0; }
function prog(f) { const B = bodyRel(f); return hdg(B.vx, B.vy); }
function burn(f, steer, thr = 1, tol = 6 * DEG) {
  f.steer = steer; f.engineOn = true;
  f.throttle = Math.abs(wrapA(steer - f.heading)) < tol ? thr : 0;
}
function idle(f, steer) { if (steer !== undefined) f.steer = steer; f.engineOn = false; f.throttle = 1; }

// ---------------------------------------------------------------- helper programs
export function apStart(f, kind, opt = {}) {
  f.ap = { kind, phase: 'start', t: 0, pt: 0, warp: null, fixes: 0, say: '', ...opt };
  f.events.push('ap:' + kind);
}
export function apStop(f, why) {
  if (!f.ap) return;
  const k = f.ap.kind; f.ap = null; f.steer = null; f.throttle = 1; f.engineOn = false;
  f.events.push('apDone:' + k + (why ? ':' + why : ''));
}

// a small correction burn: nudge some predicted number (metric) to a target. Tries a tiny push forward and
// sideways, sees which moves the number more, and burns that way just enough.
function fixPlan(f, A, metric, target, tol) {
  const T = f.T0 + f.t, B = bodyRel(f);
  const base = metric(predictPath(f.x, f.y, f.vx, f.vy, T, A.popt));
  if (base !== null && Math.abs(base - target) < tol) return false;
  const pro = hdg(B.vx, B.vy);
  let best = null;
  for (const off of [0, Math.PI / 2]) {
    const a = pro + off, dv = 2;
    const m1 = metric(predictPath(f.x, f.y, f.vx + Math.sin(a) * dv, f.vy + Math.cos(a) * dv, T, A.popt));
    if (m1 === null || base === null) continue;
    const slope = (m1 - base) / dv;
    if (Math.abs(slope) < 1e-6) continue;
    const need = (target - base) / slope;
    if (!best || Math.abs(need) < Math.abs(best.need)) best = { need, a };
  }
  if (!best) return false;
  const dv = Math.min(Math.abs(best.need), A.fixMax ?? 250);
  A.fix = { dir: best.a + (best.need < 0 ? Math.PI : 0), left: dv };
  return true;
}
function fixRun(f, A, dt) {
  const fx = A.fix; if (!fx) return true;
  const a = accMax(f);
  if (a <= 0) { A.fix = null; return true; }
  if (f.thr > 0) fx.left -= f.thr / mass(f) * dt;
  if (fx.left <= 0.02) { idle(f); A.fix = null; return true; }
  burn(f, fx.dir, clamp(fx.left / (a * 1.5), 0.03, 1), 4 * DEG);
  return false;
}

const MOON_PE_LO = MOON_R + 15000, MOON_PE_HI = MOON_R + 400000;
const moonMetric = (aim) => (p) => p.moonSigned === null ? null : p.moonSigned;
function moonTarget(p, alt) { const s = Math.sign(p.moonSigned || 1); return s * (MOON_R + alt); }

export function apTick(f, dt, hooks = {}) {
  const A = f.ap; if (!A) return;
  A.t += dt;
  if (f.outcome) { f.ap = null; return; }
  if (f.needDrop && hooks.drop) hooks.drop(f);
  const P = PROGRAMS[A.kind]; if (P) P(f, A, dt, hooks);
}

const PROGRAMS = {
  // ---------------- to the Moon (from a low orbit around the planet)
  moon(f, A, dt) {
    const T = f.T0 + f.t;
    if (A.phase === 'start') { A.phase = 'wait'; A.popt = { maxT: 400000 }; }
    if (A.phase === 'wait') {
      const w = moonWindow(f);
      const lead = burnTime(f, 870) / 2;
      const left = w.tw - lead;
      A.say = 'wait'; A.left = left;
      idle(f, prog(f));
      A.warp = clamp(left / 6, 1, 400);
      if (left <= 0.4 || (left > w.Tt && Math.abs(w.err) < 0.004)) { A.phase = 'burn'; A.pt = 0; }
      return;
    }
    if (A.phase === 'burn') {
      A.say = 'burn'; A.warp = 2;
      const o = orbitInfo(f);
      const near = o.escape || o.apo + R > MOON_A - MOON_SOI * 1.6;
      burn(f, prog(f), near ? Math.min(1, 1.2 / Math.max(0.1, accMax(f))) : 1);   // gentle at the end: the far end is very touchy
      if (!near) return;
      if ((A.pt -= dt) > 0) return; A.pt = 0.1;
      const p = predictPath(f.x, f.y, f.vx, f.vy, T, A.popt);
      const aim = Math.abs(p.moonSigned || 1e9);
      if (p.soiIn && aim > MOON_R + 35000 && aim < MOON_R + 220000) { idle(f); A.phase = 'coast'; A.pt = 0; return; }
      if (o.escape || o.apo + R > MOON_A + MOON_SOI * 0.9) { idle(f); A.phase = 'fix'; A.fix = null; return; }
      return;
    }
    if (A.phase === 'fix') {
      A.say = 'fix'; A.warp = 1;
      if (!A.fix) {
        const p0 = predictPath(f.x, f.y, f.vx, f.vy, T, A.popt);
        const tgt = moonTarget(p0, 70000);
        if (A.fixes >= 4 || !fixPlan(f, A, moonMetric(), tgt, 30000)) { A.phase = 'coast'; A.pt = 0; idle(f); return; }
        A.fixes++;
      }
      if (fixRun(f, A, dt)) { A.fix = null; }
      return;
    }
    if (A.phase === 'coast') {
      A.say = 'coast'; A.warp = null; idle(f, prog(f));
      if (f.inMoon) { apStop(f, 'arrived'); return; }
      if ((A.pt -= dt) > 0) return; A.pt = 3000;
      const p = predictPath(f.x, f.y, f.vx, f.vy, T, A.popt);
      const ok = p.soiIn && p.moonPe > MOON_PE_LO && p.moonPe < MOON_PE_HI + 300000;
      if (!ok && A.fixes < 4) { A.phase = 'fix'; A.fix = null; }
    }
  },

  // ---------------- land on the Moon (in its pull)
  land(f, A, dt) {
    const T = f.T0 + f.t, B = bodyRel(f);
    if (f.onMoon) { apStop(f, 'landed'); return; }
    if (!f.inMoon) { apStop(f, 'left'); return; }
    const rb = Math.hypot(B.rx, B.ry), ux = B.rx / rb, uy = B.ry / rb, alt = rb - MOON_R;
    const o = orbitOf(B.rx, B.ry, B.vx, B.vy, B.gm, B.rad);
    if (A.phase === 'start') { A.phase = (o.peri > 40000 || o.peri < 6000) && alt > 60000 ? 'pe' : 'approach'; A.popt = { maxT: 200000 }; A.fix = null; }
    if (A.phase === 'pe') {
      A.say = 'pe'; A.warp = 1;
      if (!A.fix) {
        const metric = (p) => p.moonSigned;
        const p0 = predictPath(f.x, f.y, f.vx, f.vy, T, A.popt);
        if (A.fixes >= 4 || !fixPlan(f, A, metric, moonTarget(p0, 20000), 6000)) { A.phase = 'approach'; idle(f); return; }
        A.fixes++;
      }
      if (fixRun(f, A, dt)) A.fix = null;
      return;
    }
    // surface-relative velocity
    const svx = B.vx + MOON_SPIN * B.ry, svy = B.vy - MOON_SPIN * B.rx;
    const vz = svx * ux + svy * uy, hx = svx - vz * ux, hy = svy - vz * uy, vh = Math.hypot(hx, hy);
    const g = MOON_GM / (rb * rb), aM = accMax(f);
    if (A.phase === 'approach') {
      A.say = 'approach'; idle(f, hdg(-svx, -svy));
      A.warp = clamp(alt / 4000, 1, 300);
      const peA = Math.max(0, o.peri);
      if (alt < Math.max(9000, peA + 5000) || (vz > -2 && alt < 60000)) { A.phase = 'brake'; }
      return;
    }
    if (A.phase === 'brake') {
      A.say = 'brake'; A.warp = 1;
      burn(f, hdg(-svx, -svy), 1, 8 * DEG);
      // falling too fast for the height: go straight to the landing control
      if (vh < 40 || (vz < 0 && vz * vz / (2 * Math.max(0.5, aM * 0.5 - g)) > alt * 0.85)) A.phase = 'descent';
      return;
    }
    if (A.phase === 'descent') {
      A.say = 'descent'; A.warp = 1;
      const hgt = Math.max(0, alt - 1.0);
      const vzDes = -Math.min(1.6 + 0.12 * hgt, Math.sqrt(2 * 0.45 * Math.max(0.3, aM - g) * hgt) + 1.6);
      let az = g + (vzDes - vz) * 1.4;
      let ahx = -hx * 0.7, ahy = -hy * 0.7;
      if (az < 0) az = 0;
      let axw = az * ux + ahx, ayw = az * uy + ahy;
      let head = hdg(axw, ayw);
      const up = hdg(ux, uy);
      const lim = hgt < 40 ? 12 * DEG : 80 * DEG;
      const dA = wrapA(head - up); if (Math.abs(dA) > lim) head = up + Math.sign(dA) * lim;
      const need = Math.hypot(axw, ayw);
      burn(f, head, aM > 0 ? clamp(need / aM, 0, 1) : 0, 14 * DEG);
    }
  },

  // ---------------- leave the Moon and fall home (from the Moon's surface or near it)
  leave(f, A, dt, hooks) {
    const T = f.T0 + f.t;
    if (A.phase === 'start') {
      A.phase = f.onMoon ? 'rise' : 'push'; A.popt = { maxT: 500000, stopAfterExit: true };
      const mv = moonVel(T), B = bodyRel(f), rb = Math.hypot(B.rx, B.ry);
      const ux = B.rx / rb, uy = B.ry / rb;
      // which way along the ground points backward along the Moon's path? (moving slower than the Moon = fall home)
      A.side = bestLeaveSide(f); void mv; void ux; void uy;
      A.bestPe = Infinity;
    }
    if (!f.inMoon && A.phase !== 'cruise') A.phase = 'cruise';
    const B = bodyRel(f), rb = Math.hypot(B.rx, B.ry), ux = B.rx / rb, uy = B.ry / rb, alt = rb - MOON_R;
    const up = hdg(ux, uy);
    if (A.phase === 'rise') {
      A.say = 'rise'; A.warp = 1; burn(f, up, 1, 10 * DEG);
      if (alt > 350 && !f.onMoon) A.phase = 'push';
      return;
    }
    if (A.phase === 'push') {
      A.say = 'push'; A.warp = 1;
      const vz = (B.vx * ux + B.vy * uy);
      const pitch = vz < 0 && alt < 3000 ? 55 : (alt < 1500 ? 70 : 82);
      burn(f, up + A.side * pitch * DEG, 1, 10 * DEG);
      if ((A.pt -= dt) > 0) return; A.pt = 0.25;
      const mo = orbitOf(B.rx, B.ry, B.vx, B.vy, B.gm, B.rad);
      if (!mo.escape && mo.apo < MOON_SOI - MOON_R) return;      // still not leaving the Moon
      const p = predictPath(f.x, f.y, f.vx, f.vy, T, A.popt);
      const pe = p.soiOut ? p.planetPeAfter : null;
      if (pe !== null && pe < 38000 && pe > -R * 0.2) { idle(f); A.phase = 'cruise'; A.pt = 0; return; }
      if (pe !== null) { if (pe > A.bestPe + 2000 && A.bestPe < 4e6) { idle(f); A.phase = 'cruise'; A.pt = 0; return; } A.bestPe = Math.min(A.bestPe, pe); }
      const vesc = Math.sqrt(2 * MOON_GM / rb);
      if (Math.hypot(B.vx, B.vy) > vesc * 1.9) { idle(f); A.phase = 'cruise'; A.pt = 0; }
      return;
    }
    if (A.phase === 'fix') {
      A.say = 'fix'; A.warp = 1;
      if (!A.fix) {
        const metric = (p) => p.soiOut ? clamp(p.planetPeAfter, -R, 4e6) : null;
        if (A.fixes >= 4 || !fixPlan(f, A, metric, 30000, 9000)) { A.phase = 'cruise'; A.pt = 5000; idle(f); return; }
        A.fixes++;
      }
      if (fixRun(f, A, dt)) A.fix = null;
      return;
    }
    if (A.phase === 'cruise') {
      A.say = 'cruise'; A.warp = null; idle(f, prog(f));
      if (!f.inMoon) { apStop(f, 'out'); apStart(f, 'home'); return; }
      if ((A.pt -= dt) > 0) return; A.pt = 4000;
      const p = predictPath(f.x, f.y, f.vx, f.vy, T, A.popt);
      const pe = p.soiOut ? p.planetPeAfter : null;
      if ((pe === null || pe > 45000 || pe < 15000) && A.fixes < 4 && pe !== null && pe < 2e6) { A.phase = 'fix'; A.fix = null; }
    }
  },

  // ---------------- come home from a high orbit (after the Moon): lower the low point into the air
  home(f, A, dt) {
    const o = orbitInfo(f), r = Math.hypot(f.x, f.y), vr = (f.x * f.vx + f.y * f.vy) / r;
    if (f.inMoon) { apStop(f, 'moon'); return; }
    if (A.phase === 'start') A.phase = 'wait';
    if (A.phase === 'wait') {
      if (o.peri < 42000 && o.peri > 5000) { A.phase = 'coast'; return; }
      A.say = 'wait'; idle(f, hdg(-f.vx, -f.vy));
      if (vr > 0 && !o.escape && o.apo > 800000) { A.warp = clamp(timeToApo(f) / 8, 1, 2000); return; }
      A.phase = 'burn';
    }
    if (A.phase === 'burn') {
      A.say = 'burn'; A.warp = 1;
      if (fuelLeft(f) <= 0 && !f.needDrop) { apStop(f, 'nofuel'); return; }
      burn(f, hdg(-f.vx, -f.vy), o.peri < 120000 ? 0.35 : 1);
      if (!o.escape && o.peri < 32000) { idle(f); A.phase = 'coast'; }
      return;
    }
    if (A.phase === 'coast') {
      A.say = 'coast'; A.warp = null; idle(f, hdg(-f.vx, -f.vy));
      if (f.alt < ATM_TOP + 60000) apStop(f, 'air');
    }
  },

  // ---------------- make the orbit round (at a chosen height) and let the satellite / station part go
  release(f, A, dt, hooks) {
    const o = orbitInfo(f);
    if (A.phase === 'start') {
      A.target = A.targetR ? A.targetR - R : null;
      A.phase = A.target && o.apo < A.target - 5000 ? (A.slot != null ? 'slot' : 'raise') : 'toApo';
    }
    if (A.phase === 'slot') {
      // wait until climbing now puts us into the open spot in the ring
      const T = f.T0 + f.t, r = Math.hypot(f.x, f.y), hm = f.x * f.vy - f.y * f.vx, dir = hm >= 0 ? 1 : -1;
      const Tt = Math.PI * Math.sqrt(Math.pow((o.a + A.targetR) / 2, 3) / GM);
      const wt = dir * Math.sqrt(GM / Math.pow(A.targetR, 3)), wr = hm / (r * r);
      const slotNow = A.slot + wt * (T - A.slotT);
      const err = wrapA(slotNow + wt * Tt - (Math.atan2(f.y, f.x) + dir * Math.PI));
      const rate = wt - wr;
      let tw = -err / rate; if (tw < 0) tw += 2 * Math.PI / Math.abs(rate);
      const left = tw - burnTime(f, 450) / 2;
      A.say = 'slot'; idle(f, prog(f)); A.warp = clamp(left / 6, 1, 300);
      if (left <= 0.4) A.phase = 'raise';
      return;
    }
    if (A.phase === 'raise') {
      A.say = 'raise'; A.warp = 1;
      burn(f, prog(f), o.apo > A.target - 60000 ? 0.25 : 1);
      if (o.escape || o.apo >= A.target) { idle(f); A.phase = 'toApo'; }
      return;
    }
    if (A.phase === 'toApo') {
      A.say = 'toApo'; idle(f, prog(f));
      const vApo = Math.sqrt(GM * (2 / (o.apo + R) - 1 / o.a)), vC = Math.sqrt(GM / (o.apo + R));
      const lead = burnTime(f, Math.max(0, vC - vApo)) / 2;
      const ta = timeToApo(f);
      A.warp = clamp((ta - lead) / 6, 1, 300);
      if (ta - lead <= 0.4) A.phase = 'circ';
      return;
    }
    if (A.phase === 'circ') {
      A.say = 'circ'; A.warp = 1;
      const goal = A.target ? Math.min(A.target, o.apo) - 4000 : o.apo - 3000;
      if (fuelLeft(f) <= 0 && !f.needDrop) { A.phase = 'go'; idle(f); return; }
      burn(f, prog(f), o.peri > goal - 40000 ? 0.2 : 1);
      if (!o.escape && o.peri >= goal) { idle(f); A.phase = 'go'; }
      return;
    }
    if (A.phase === 'go') { idle(f); apStop(f, 'ok'); if (hooks.release) hooks.release(f); }
  },

  // ---------------- fly to the station and dock
  dock(f, A, dt, hooks) {
    const T = f.T0 + f.t;
    const s = kepAt(A.station, T);
    const dx = f.x - s.x, dy = f.y - s.y, d = Math.hypot(dx, dy);
    const o = orbitInfo(f), r = Math.hypot(f.x, f.y), rs = Math.hypot(s.x, s.y);
    if (A.phase === 'start') { A.phase = A.close ? 'approach' : (o.e > 0.012 ? 'toApo' : 'wait'); A.minD = Infinity; }
    if (d < 8000 && A.phase !== 'approach') A.phase = 'approach';
    if (A.phase === 'toApo' || A.phase === 'circ') { // round off our orbit first
      if (A.phase === 'toApo') {
        idle(f, prog(f));
        const vApo = Math.sqrt(GM * (2 / (o.apo + R) - 1 / o.a)), vC = Math.sqrt(GM / (o.apo + R));
        const ta = timeToApo(f), lead = burnTime(f, Math.max(0, vC - vApo)) / 2;
        A.warp = clamp((ta - lead) / 6, 1, 300); A.say = 'circ';
        if (ta - lead <= 0.4) A.phase = 'circ';
      } else {
        A.warp = 1; burn(f, prog(f), o.peri > o.apo - 40000 ? 0.2 : 1);
        if (o.peri >= o.apo - 3000) { idle(f); A.phase = 'wait'; }
      }
      return;
    }
    if (A.phase === 'wait') {
      const hm = f.x * f.vy - f.y * f.vx, dir = hm >= 0 ? 1 : -1;
      const hs = s.x * s.vy - s.y * s.vx;
      if (Math.sign(hs) !== dir) { apStop(f, 'wrongway'); return; }
      if (Math.abs(rs - r) < 25000) {   // same height: climb a bit so we drift relative to the station
        A.target = rs + 90000 - R; A.phase = 'raise'; return;
      }
      const Tt = Math.PI * Math.sqrt(Math.pow((o.a + rs) / 2, 3) / GM);
      const ws = hs / (rs * rs), wr = hm / (r * r);
      const err = wrapA(Math.atan2(s.y, s.x) + ws * Tt - (Math.atan2(f.y, f.x) + dir * Math.PI));
      const rate = ws - wr;
      let tw = -err / rate; if (tw < 0) tw += 2 * Math.PI / Math.abs(rate);
      const dv = Math.abs(Math.sqrt(GM * (2 / r - 2 / (r + rs))) - Math.sqrt(GM / r));
      const left = tw - burnTime(f, dv) / 2;
      A.say = 'wait'; idle(f, rs > r ? prog(f) : prog(f) + Math.PI); A.warp = clamp(left / 6, 1, 500);
      if (left <= 0.4) { A.phase = 'transfer'; A.up = rs > r; A.rs = rs; }
      return;
    }
    if (A.phase === 'raise') {
      A.say = 'raise'; A.warp = 1; burn(f, prog(f), 1);
      if (o.apo >= A.target) { idle(f); A.phase = 'toApo'; }
      return;
    }
    if (A.phase === 'transfer') {
      A.say = 'transfer'; A.warp = 1;
      if (A.up) { burn(f, prog(f), o.apo + R > A.rs - 30000 ? 0.15 : 1); if (o.apo + R >= A.rs) { idle(f); A.phase = 'coast'; } }
      else { burn(f, prog(f) + Math.PI, o.peri + R < A.rs + 30000 ? 0.15 : 1); if (o.peri + R <= A.rs) { idle(f); A.phase = 'coast'; } }
      return;
    }
    if (A.phase === 'coast') {
      A.say = 'coast'; idle(f, prog(f)); A.warp = clamp(d / 400, 1, 300);
      if (d < A.minD) A.minD = d;
      else if (d > A.minD + 2000) { if (A.minD < 90000) A.phase = 'approach'; else { A.phase = 'toApo'; A.minD = Infinity; } }
      return;
    }
    if (A.phase === 'approach') {
      A.say = 'approach';
      const rel = relToStation(f, A.station), rvx = rel.rvx, rvy = rel.rvy, rv = rel.rv;
      if (d < 30 && rv < 1.0) { idle(f); apStop(f, 'docked'); if (hooks.docked) hooks.docked(f); return; }
      if (d > 250000) { apStop(f, 'lost'); return; }
      const aM = Math.max(0.1, accMax(f));
      const vc = Math.min(70, 0.4 + Math.sqrt(2 * 0.6 * Math.max(0, d - 12)));
      const tx = -dx / d * vc, ty = -dy / d * vc;
      const ex = tx - rvx, ey = ty - rvy, e = Math.hypot(ex, ey);
      A.warp = clamp(d / 250, 1, 25);
      if (e < 0.25) { f.throttle = 0; f.engineOn = true; return; }
      burn(f, hdg(ex, ey), clamp(e / (aM * 1.2), 0.01, 1), 7 * DEG);
    }
  },
};

// Leaving the Moon: which way along the ground sends you home? Try a quick sideways push each way and see
// where each path ends up over the planet (the obvious "backward along the Moon's path" can be wrong near the
// Moon's edges, because the Moon's pull bends your path on the way out).
export function bestLeaveSide(f) {
  const T = f.T0 + f.t, B = bodyRel(f), rb = Math.hypot(B.rx, B.ry), ux = B.rx / rb, uy = B.ry / rb;
  const vesc = Math.sqrt(2 * MOON_GM / rb);
  let best = null;
  for (const side of [1, -1]) {
    for (const k of [1.12, 1.25, 1.45]) {
      const tx = side * uy, ty = -side * ux, v = vesc * k;
      const p = predictPath(f.x + ux * 2000, f.y + uy * 2000, f.vx + tx * v + ux * 40, f.vy + ty * v + uy * 40, T, { maxT: 500000, stopAfterExit: true });
      if (!p.soiOut) continue;
      const score = Math.abs(p.planetPeAfter - 30000) + (k - 1) * 2e6;
      if (!best || score < best.score) best = { side, score };
    }
  }
  return best ? best.side : 1;
}

// ---------------------------------------------------------------- Do it yourself: what the guide suggests
// Each returns { lean: slider -1..1 or null, burn: true/false/null (null = no advice), key, text }.
// The game shows these as hints; the test's scripted player follows them, so both use the same rules.
function sideOf(f, vx, vy) {          // +1 if (vx,vy) points toward the slider's right side (lean +1)
  const B = bodyRel(f), phi = Math.atan2(B.rx, B.ry);
  return (vx * Math.sin(phi + Math.PI / 2) + vy * Math.cos(phi + Math.PI / 2)) >= 0 ? 1 : -1;
}
// on the way to the Moon, inside its pull: aim the pass low over the Moon (10-40 km up)
export function diyAimHint(f, cache) {
  const T = f.T0 + f.t, B = bodyRel(f);
  const p = cache || predictPath(f.x, f.y, f.vx, f.vy, T, { maxT: 200000 });
  const aim = p.moonSigned;
  if (aim === null) return { lean: null, burn: null, key: 'none' };
  const alt = Math.abs(aim) - MOON_R;
  if (Math.abs(aim) < MOON_R + 8000 || alt > 40000) {
    // which slider side moves the pass toward 25 km up?
    const tgt = Math.sign(aim || 1) * (MOON_R + 25000);
    const phi = Math.atan2(B.rx, B.ry);
    let best = null;
    for (const side of [1, -1]) {
      const h = phi + side * Math.PI / 2, dv = 0.5;
      const q = predictPath(f.x, f.y, f.vx + Math.sin(h) * dv, f.vy + Math.cos(h) * dv, T, { maxT: 200000 });
      if (q.moonSigned === null) continue;
      const gain = Math.abs(aim - tgt) - Math.abs(q.moonSigned - tgt);
      if (!best || gain > best.gain) best = { side, gain };
    }
    if (!best || best.gain <= 0) return { lean: null, burn: false, key: 'aimStuck', alt };
    return { lean: best.side, burn: true, key: alt < 8000 ? 'aimHit' : 'aimLow', alt };
  }
  return { lean: null, burn: false, key: 'aimOk', alt };
}
// is it worth aiming now? (far out on the way, or already in the Moon's pull)
export function diyAimTime(f) { return f.inMoon || (f.alt > 3000000 && (f.x * f.vx + f.y * f.vy) > 0); }
// landing on the Moon by yourself: lean back to stop sliding, then stand up and burn in bursts
export function diyLandHint(f) {
  const B = bodyRel(f); if (!f.inMoon) return null;
  const rb = Math.hypot(B.rx, B.ry), ux = B.rx / rb, uy = B.ry / rb, alt = rb - MOON_R;
  const svx = B.vx + MOON_SPIN * B.ry, svy = B.vy - MOON_SPIN * B.rx;
  const vz = svx * ux + svy * uy, hx = svx - vz * ux, hy = svy - vz * uy, vh = Math.hypot(hx, hy);
  const o = orbitOf(B.rx, B.ry, B.vx, B.vy, B.gm, B.rad);
  const g = MOON_GM / (rb * rb), aM = accMax(f);
  if (alt > Math.max(9000, Math.min(60000, o.peri + 6000)) && vz < 30 && !(vz < 0 && vz * vz / (2 * Math.max(0.5, aM - g)) > alt * 0.5)) return { lean: null, burn: false, key: 'landWait', vh, vz, alt };
  if (vh > 12 && alt > 80) return { lean: -sideOf(f, hx, hy), burn: true, key: 'landBrake', vh, vz, alt };
  const stop = vz < 0 ? vz * vz / (2 * Math.max(0.3, aM - g)) : 0;
  const lean = vh > 2 ? -sideOf(f, hx, hy) * Math.min(alt < 60 ? 0.12 : 0.35, vh / 25) : 0;   // stand up straight for touchdown
  if (f.engineOn) return { lean, burn: vz < -1.5 && !(alt > 50 && stop < alt * 0.55), key: 'landBurst', vh, vz, alt };
  const lag = Math.abs(Math.min(0, vz)) * 0.9;     // the engine takes a moment to light: say "burn" a little early
  return { lean, burn: vz < -2 && stop + lag > alt * 0.8 - 4, key: 'landFall', vh, vz, alt };
}
// leaving the Moon by yourself: up, then lean the way the arrow shows until the path comes home
export function diyLeaveHint(f, cache) {
  if (!f.inMoon) return null;
  const T = f.T0 + f.t, B = bodyRel(f), rb = Math.hypot(B.rx, B.ry), alt = rb - MOON_R;
  const mv = moonVel(T), ux = B.rx / rb, uy = B.ry / rb;
  if (f.onMoon && f.leaveSideAt !== f.onMoon.a) { f.leaveSide = bestLeaveSide(f); f.leaveSideAt = f.onMoon.a; }   // picked on the ground, then kept
  if (f.leaveSide === undefined) f.leaveSide = bestLeaveSide(f);
  void mv;
  const side = f.leaveSide;
  if (f.onMoon) f.leaveBest = Infinity;
  if (f.onMoon || alt < 300) return { lean: 0, burn: true, key: 'leaveUp', side };
  const mo = orbitOf(B.rx, B.ry, B.vx, B.vy, B.gm, B.rad);
  const vz = B.vx * ux + B.vy * uy;
  const lean = side * (vz < 0 && alt < 3000 ? 0.6 : 0.9);
  if (!mo.escape && mo.apo < MOON_SOI - MOON_R) return { lean, burn: true, key: 'leavePush', side };
  const p = cache || predictPath(f.x, f.y, f.vx, f.vy, T, { maxT: 500000, stopAfterExit: true });
  const pe = p.soiOut ? p.planetPeAfter : null;
  if (pe !== null && pe < 45000) return { lean, burn: false, key: 'leaveDone', side, pe };
  // the path stopped getting closer to home, or we are already very fast: stop and fix it later from far out
  const vesc = Math.sqrt(2 * MOON_GM / rb);
  if ((pe !== null && pe > (f.leaveBest ?? Infinity) + 3000) || Math.hypot(B.vx, B.vy) > vesc * 1.6) return { lean, burn: false, key: 'leaveEnough', side, pe };
  if (pe !== null && f.engineOn) f.leaveBest = Math.min(f.leaveBest ?? Infinity, pe);
  return { lean, burn: true, key: 'leavePush', side, pe };
}
// coming home from far out by yourself: wait for the top of the path, point backward, burn until it dips into the air
export function diyHomeHint(f) {
  if (f.inMoon) return null;
  const o = orbitInfo(f), r = Math.hypot(f.x, f.y), vr = (f.x * f.vx + f.y * f.vy) / r;
  const back = leanFor(f, Math.atan2(-f.vx, -f.vy));
  if (!o.escape && o.peri < 45000) return { lean: null, burn: false, key: 'homeOk' };
  if (vr > 0 && !o.escape && timeToApo(f) > 600) return { lean: back, burn: false, key: 'homeWait' };
  return { lean: back, burn: true, key: 'homeBurn' };
}
// a trip around the planet (to the relay height or the station): burn forward until the far side reaches rT,
// coast to the top, burn forward again until the orbit is round
export function diyRaiseHint(f, rT, stage0) {
  const o = orbitInfo(f), fwd = leanFor(f, prog(f));
  if (stage0 === 'raise') return { lean: fwd, burn: !(o.apo + R >= rT), key: 'raise' };
  if (stage0 === 'coast') return { lean: fwd, burn: false, key: timeToApo(f) < 25 ? 'atTop' : 'coastTop', tta: timeToApo(f) };
  if (stage0 === 'circ') return { lean: fwd, burn: o.peri + R < Math.min(rT, o.apo + R) - 5000, key: 'circ' };
  return null;
}
export function timeToTop(f) { return timeToApo(f); }
// where the station is from the rocket, and the speed difference as seen riding along with the station
// (its turning frame: two ships on the same orbit a little apart do not count as moving apart)
export function relToStation(f, kep) {
  const s = kepAt(kep, f.T0 + f.t), dx = s.x - f.x, dy = s.y - f.y, d = Math.hypot(dx, dy);
  const rs2 = s.x * s.x + s.y * s.y, w = (s.x * s.vy - s.y * s.vx) / rs2;
  const rvx = (f.vx - s.vx) - (-w * -dy), rvy = (f.vy - s.vy) - (w * -dx);
  return { s, dx, dy, d, rvx, rvy, rv: Math.hypot(rvx, rvy) };
}
// near the station by yourself: drift toward it, keep the speed difference small; ready to dock when close
export function diyDockHint(f, kep) {
  const { dx, dy, d, rvx, rvy, rv } = relToStation(f, kep);
  if (d < DOCK_RANGE && rv < DOCK_SPEED) return { lean: null, burn: false, key: 'dockReady', d, rv };
  if (d > 300000) return { lean: null, burn: null, key: 'dockFar', d, rv };
  const vc = rv > 30 ? 0 : clamp(d / 120, 4, 25);      // too fast apart? first cancel the drift, then close in
  const ex = dx / d * vc - rvx, ey = dy / d * vc - rvy, e = Math.hypot(ex, ey);
  const lean = leanFor(f, hdg(ex, ey));
  const B = bodyRel(f), ph = Math.atan2(B.rx, B.ry) + lean * Math.PI / 2;
  const reach = (Math.sin(ph) * ex + Math.cos(ph) * ey) / Math.max(1e-6, e);    // how much of the wanted push the slider can point at
  const aligned = Math.abs(wrapA(f.heading - ph)) < 0.12;
  const go = e > (f.engineOn ? 1.5 : 5) && reach > (f.engineOn ? 0.2 : 0.3);
  return { lean, burn: go && aligned, key: d > DOCK_RANGE ? 'dockClose' : 'dockMatch', d, rv };
}

// ---------------------------------------------------------------- watching a flight (both modes)
// closest point to the Moon passed (a flyby), and in Helpers-on mode: drop empty stages at once while a
// helper flies, and let go of the tank before the capsule meets the air on the way home from the Moon.
export function watchTick(f, hooks) {
  if (f.inMoon && !f.flyby && !f.onMoon) {
    const B = bodyRel(f), vr = (B.rx * B.vx + B.ry * B.vy);
    if (f.moonVr !== undefined && f.moonVr < 0 && vr >= 0) { f.flyby = true; f.events.push('flyby'); }
    f.moonVr = vr;
  }
  if (f.moonLanded && !f.flyby) { f.flyby = true; f.events.push('flyby'); }
  if (!f.inMoon) f.moonVr = undefined;
  if (f.diy) return;
  if (f.needDrop && (f.ap || f.moonVisited) && hooks.drop) hooks.drop(f);
  if (f.moonVisited && !f.capsuleOnly && !f.noCapsule && !f.payloadKind && !f.inMoon && f.alt < ATM_TOP + 40000 && !(f.engineOn && f.throttle > 0) && hooks.separate) {
    const o = orbitInfo(f), vr = (f.x * f.vx + f.y * f.vy);
    if (vr < 0 && o.peri < ATM_TOP) hooks.separate(f);
  }
}

// Do it yourself, far out in space: the engine runs gently (like real rockets throttling down for fine
// corrections), so small taps can aim a pass over the Moon or fix the way home.
export function diyGentle(f) { return !!f.diy && !f.ap && ((!f.inMoon && f.alt > 2500000) || (f.inMoon && f.balt > 250000)); }
// step a flight forward by dt seconds of game time
export function advance(f, dt, lean, hooks = {}) {
  f.simAcc = (f.simAcc || 0) + dt;
  if (f.diy && !f.ap) f.throttle = diyGentle(f) ? 0.15 : 1;
  let guard = 0;
  while (!f.outcome && guard++ < 40000) {
    const lim = coastLimit(f);
    let used;
    if (lim > STEP * 3 && f.simAcc > STEP * 3) { used = Math.min(lim, f.simAcc); coastStep(f, used); }
    else { if (f.simAcc < STEP) break; stepPhysics(f, STEP, lean); used = STEP; }
    f.simAcc -= used;
    if (used > STEP) {   // turning while coasting in big steps: toward the helper's aim, or the slider in Do it yourself
      let want = null, rate = 45 * DEG;
      if (f.steer !== null && f.steer !== undefined) want = f.steer;
      else if (f.diy && f.lifted) { const B = bodyRel(f); want = Math.atan2(B.rx, B.ry) + lean * Math.PI / 2; rate = 30 * DEG; }
      if (want !== null) { const dA = wrapA(want - f.heading), mx = rate * used; f.heading += clamp(dA, -mx, mx); }
    }
    if (f.ap) apTick(f, used, hooks);
    watchTick(f, hooks);
    if (f.events.length) { if (hooks.event) hooks.event(f); else f.events.length = 0; }
    if (hooks.stop && hooks.stop(f)) break;
  }
  if (f.outcome) f.simAcc = 0;
}

// automatic time speed for long empty stretches (trips to and from the Moon)
export function autoWarp(f) {
  if (coastLimit(f) <= 0) return 0;
  const B = bodyRel(f), rb = Math.hypot(B.rx, B.ry), alt = rb - B.rad, v = Math.max(1, Math.hypot(B.vx, B.vy));
  const far = f.inMoon || f.alt > 1500000;
  if (!far) return 0;
  let sp = clamp(alt / (v * 5), 10, 2500);
  if (!f.inMoon) { const m = moonPos(f.T0 + f.t); const dm = Math.hypot(f.x - m[0], f.y - m[1]) - MOON_SOI; sp = Math.min(sp, Math.max(40, dm / (v * 3))); }
  return sp;
}
export { MOON_R, MOON_A, MOON_SOI, moonPos, moonVel, moonAngle };
