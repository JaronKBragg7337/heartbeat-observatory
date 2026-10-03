// ============================================================================
// freeflight.js — FREEFLIGHT: the ship as a real body in space. Point it, burn, coast, turn over, brake, land anywhere.
//
// OWNS: the free-flight physics (Mars, Phobos and Deimos pull on the ship; the main drive, the jets, the fuel tank; Mars's air),
//       the assist modes (prograde, retrograde, target, brake), time compression while coasting, when free flight takes the ship
//       and when it hands her back to the ordinary flight assist (the lift pods that land her), the read-outs the HUD draws, and the
//       predicted path. Pure: no DOM, no renderer. The browser (solo) and the authority (shared world) run THIS file, so a ship
//       flies the same in both and the server owns the answer.
// DOES NOT OWN: the courses (spaceTrip.js / transit.js: they still exist and take the ship when asked), the ship's gear and landing
//       physics (shipFlight.js: below a moon's handover height and below 10 km over Mars it is the one that flies), drawing.
//
// F2 (Oct 3): THE FRAME TURNS. The ship's coordinates (flight.pos / vel) are in Mars's body-fixed axes, which turn once per 88,642 s, and the
//   moons move in them (space/frames.js). The physics is exact for that: Mars and the moons pull as point masses at THEIR place at the ship's
//   own clock (flight.epochS), and the turning frame adds its centrifugal and Coriolis terms (a kick-drift-kick whose Coriolis half-steps rotate
//   the velocity exactly). A ship that matches a moon's velocity therefore stays with it as it would in the real sky; the old trick that
//   cancelled Mars's pull near a moon is gone. The hull's attitude holds against the stars (the jets keep it inertial), so in these axes it
//   turns backward at Mars's spin. Speeds shown, and what prograde/retro/brake work against, are RELATIVE to the body that matters: a moon's
//   velocity, Mars's surface below 300 km, Mars's inertial velocity (orbital speed) above that.
// HONEST SIMPLIFICATIONS (stated, not hidden)
//   * Mars's pull is a point mass (no flattening), the moons pull as point masses.
//   * The main drive's thrust is the Meridian's own (spaceSpec.js DRIVE) and the tank is a number of metres per second (FREE.dvFullMs),
//     not a mass: the ship does not get lighter as she burns. The drive will not light inside Mars's air (DRIVE rule); the jets will.
//   * Mars's air is a drag model (exponential density, deployable drag brakes of ballistic coefficient FREE.ballisticKgM2): it brings a
//     ship down from orbit speed into a speed the lift pods can finish. It does not model heat; a deceleration over FREE.maxDecel hurts the hull.
//   * Fuel is for free flight. A course (the nav computer) still flies for free, as before.
// ============================================================================

import { isLaneWorld } from './jump.js';
import * as THREE from 'three';
import { MARS_MU, MOONS, STATION_IDS, G_CONST, moonCentre, DRIVE, ATMOSPHERE_TOP_M, FREE, RAIDER_SUSPEND_MS, stickWarpCap } from './spaceSpec.js';
import { worldKin, worldCentreFixed, rotY, OMEGA } from './frames.js';
import { worldTimeS } from './clock.js';
import { makeMoon } from './moonField.js';
import { surfaceRadiusFast } from '../world/field.js';
import { onWorldsChanged, worldDef } from '../worlds/registry.js';

export const MARS_R = 3_389_500;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const len3 = (a) => Math.hypot(a.x, a.y, a.z);
export const ASSISTS = ['off', 'prograde', 'retro', 'target'];
export const TARGETS = [];                                    // every world with a frame, then Mars (rebuilt with BODIES below)
export const ZERO_INPUT = Object.freeze({ thr: 0, brake: false, pitch: 0, yaw: 0, roll: 0, tx: 0, ty: 0, tz: 0 });

// ---------------------------------------------------------------------------
// THE BODIES (they move: ask where one is at a game time)
// ---------------------------------------------------------------------------
export const BODIES = {};
/** Every frame world (a moon or a planet: `moon: true` here means "has a frame of its own"), in registry order. */
export const MOON_LIST = [];
/** Bodies that pull and have ground (Mars and every frame world): what the physics loops walk. Stations are targets only. */
export const PHYS_LIST = [];
/** A body's patch: the distance inside which a ship counts as "at" it (nearest body, handover, time compression). 400 km for the little moons,
 *  8 radii for anything bigger so a planet's whole neighbourhood is inside it. */
export const patchOf = (R) => Math.max(FREE.patchM, 8 * R);
const ZERO3 = Object.freeze({ x: 0, y: 0, z: 0 });
function rebuildBodies() {
  for (const k of Object.keys(BODIES)) delete BODIES[k];
  MOON_LIST.length = 0; TARGETS.length = 0; PHYS_LIST.length = 0;
  BODIES.mars = { id: 'mars', name: 'Mars', mu: MARS_MU, R: MARS_R, moon: false };
  Object.defineProperty(BODIES.mars, 'c', { get: () => ZERO3, enumerable: true });
  for (const m of Object.values(MOONS)) {
    const b = BODIES[m.id] = { id: m.id, name: m.name, mu: G_CONST * m.massKg, R: m.radiusMean, moon: true, patchM: patchOf(m.radiusMean), air: m.atmosphere || null };
    Object.defineProperty(b, 'c', { get: () => worldCentreFixed(m.id, worldTimeS()), enumerable: true });          // NOW (a UI convenience); the physics asks cAt(b, T)
    MOON_LIST.push(b); TARGETS.push(m.id);
  }
  for (const id of STATION_IDS) {                              // a station: something to steer for (target, bearing, distance), never a pull or a ground
    const d = worldDef(id);
    const b = BODIES[id] = { id, name: d.name, mu: 0, R: d.radiusM, moon: false, station: true };
    Object.defineProperty(b, 'c', { get: () => worldCentreFixed(id, worldTimeS()), enumerable: true });
    TARGETS.push(id);
  }
  TARGETS.push('mars');
  PHYS_LIST.push(...Object.values(BODIES).filter((b) => !b.station));
}
rebuildBodies();
onWorldsChanged(rebuildBodies);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/** Where a body's centre is at game time T, in Mars's turning axes. Mars is the origin. */
export const cAt = (b, T) => (b.id === 'mars' ? ZERO3 : worldCentreFixed(b.id, T));
/** The centres of every moon (MOON_LIST order) at game time T: what gravityAt wants. */
export const centresAt = (T) => MOON_LIST.map((b) => worldCentreFixed(b.id, T));

/** Acceleration (m/s2) on a ship at `p` (Mars's turning axes) from Mars and the moons (point masses). `cs` is centresAt(T), or the game time T itself (default: now). */
export function gravityAt(p, out = { x: 0, y: 0, z: 0 }, cs) {
  const r2 = p.x * p.x + p.y * p.y + p.z * p.z, r = Math.sqrt(r2), k = -MARS_MU / (r2 * r);
  let ax = k * p.x, ay = k * p.y, az = k * p.z;
  if (!Array.isArray(cs)) cs = centresAt(cs ?? worldTimeS());
  for (let n = 0; n < MOON_LIST.length; n++) {
    const b = MOON_LIST[n], c = cs[n];
    const dx = p.x - c.x, dy = p.y - c.y, dz = p.z - c.z;
    const d2 = Math.max(dx * dx + dy * dy + dz * dz, b.R * b.R * 0.25), d = Math.sqrt(d2), km = -b.mu / (d2 * d);
    ax += km * dx; ay += km * dy; az += km * dz;
  }
  out.x = ax; out.y = ay; out.z = az;
  return out;
}

/** Drag (per second, the factor on velocity) of a world's own atmosphere on a ship at `pp` (Mars-frame metres) moving at `sp` m/s.
 *  Height is above its mean radius; the air thins with the world's scale height and is gone above `topM`. Mars is handled by dragDecel. `c` is the world's centre now. */
export function worldDrag(b, pp, sp, c = b.c) {
  const alt = Math.hypot(pp.x - c.x, pp.y - c.y, pp.z - c.z) - b.R;
  if (alt > b.air.topM) return 0;
  return b.air.rho0 * Math.exp(-Math.max(0, alt) / b.air.scaleHeightM) * sp / (2 * FREE.ballisticKgM2);
}

/** Mars's air density, kg/m3, at a height above the mean radius. */
export const airDensity = (altM) => (altM > 160_000 ? 0 : FREE.rho0 * Math.exp(-Math.max(0, altM) / FREE.scaleHeightM));
/** Deceleration (m/s2) the drag brakes give at this height and speed. */
export const dragDecel = (altM, v) => airDensity(altM) * v * v / (2 * FREE.ballisticKgM2);

// ---------------------------------------------------------------------------
// ORBITS (pure maths the HUD and the tests share)
// ---------------------------------------------------------------------------
/** Elements of the orbit round a body of gravitational parameter mu and radius R, from a position and velocity relative to it. */
export function orbitElements(rel, vel, mu, R) {
  const r = len3(rel), v2 = vel.x * vel.x + vel.y * vel.y + vel.z * vel.z;
  const hx = rel.y * vel.z - rel.z * vel.y, hy = rel.z * vel.x - rel.x * vel.z, hz = rel.x * vel.y - rel.y * vel.x, h = Math.hypot(hx, hy, hz);
  const energy = v2 / 2 - mu / r, bound = energy < 0;
  const a = bound ? -mu / (2 * energy) : Infinity;
  const e = Math.sqrt(Math.max(0, 1 + 2 * energy * h * h / (mu * mu)));
  const rp = bound ? a * (1 - e) : (h * h / mu) / (1 + e), ra = bound ? a * (1 + e) : Infinity;
  return { r, speed: Math.sqrt(v2), energy, bound, a, e, h, periM: rp - R, apoM: ra - R, rp, ra, periodS: bound ? 2 * Math.PI * Math.sqrt(a * a * a / mu) : Infinity, escapeMs: Math.sqrt(2 * mu / r) };
}
export const circularSpeed = (mu, r) => Math.sqrt(mu / r);

/** Where the ship goes with the engines off: n positions in the Mars frame, spaced evenly in time over `horizonS`, starting at game time `T` (default now) in Mars's turning axes. Stops at a surface. */
export function predictPath(pos, vel, { n = 120, horizonS = 3600, T = worldTimeS() } = {}) {
  const pts = [], p = { ...pos }, v = { ...vel }, a = { x: 0, y: 0, z: 0 }, dtOut = horizonS / n, w2 = OMEGA * OMEGA;
  let hit = null, t = T, cs = centresAt(t);
  const acc = () => { gravityAt(p, a, cs); a.x += w2 * p.x; a.z += w2 * p.z; };
  acc();
  for (let i = 0; i < n && !hit; i++) {
    let left = dtOut;
    while (left > 1e-9 && !hit) {
      const r = len3(p), tau = Math.sqrt(r * r * r / MARS_MU), h = Math.min(left, Math.max(0.5, tau * 0.03), 20);
      v.x += a.x * h / 2; v.y += a.y * h / 2; v.z += a.z * h / 2;
      rotY(v, -OMEGA * h, v);                                   // Coriolis: the velocity turns at twice the frame's spin, half now and half after the drift
      p.x += v.x * h; p.y += v.y * h; p.z += v.z * h;
      rotY(v, -OMEGA * h, v);
      t += h; cs = centresAt(t);
      acc();
      v.x += a.x * h / 2; v.y += a.y * h / 2; v.z += a.z * h / 2;
      left -= h;
      const rr = len3(p);
      if (rr < MARS_R + 500) hit = { body: 'mars', t: (i + 1) * dtOut - left };
      else MOON_LIST.forEach((b, k) => { if (Math.hypot(p.x - cs[k].x, p.y - cs[k].y, p.z - cs[k].z) < b.R * 0.8) hit = { body: b.id, t: (i + 1) * dtOut - left }; });
    }
    pts.push({ x: p.x, y: p.y, z: p.z });
  }
  return { points: pts, hit, horizonS };
}

/** The ground radius under a direction from a body's centre. A direction in Mars's axes is turned into the moon's own axes first (its frame is turned by `k.yaw`). */
const groundOf = (mars, id, dx, dy, dz, b, k) => {
  if (id === 'mars') return surfaceRadiusFast(mars, dx, dy, dz);
  const q = rotY({ x: dx, y: dy, z: dz }, -(k ? k.yaw : 0));
  return surfaceRadiusFast(makeMoon(id), q.x, q.y, q.z);
};

// ---------------------------------------------------------------------------
// THE FREE-FLIGHT SYSTEM
// ---------------------------------------------------------------------------
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new THREE.Vector3(), _w = new THREE.Vector3(), _n = new THREE.Vector3();
const _g = { x: 0, y: 0, z: 0 }, _g2 = { x: 0, y: 0, z: 0 }, _qy = new THREE.Quaternion(), _Yax = new THREE.Vector3(0, 1, 0);

export class FreeFlight {
  /**
   * @param host { flight: ShipBody, mars: body record, frameId(): string, setFrame(id), say(msg, warn),
   *               hostileNear?(): bool, shipNear?(): bool, atPad?(): bool, drones?: { suspended } }
   */
  constructor(host) {
    this.host = host; this.f = host.flight; this.mars = host.mars;
    this.enabled = false; this.active = false;
    this.assist = 'off'; this.target = 'phobos';
    this.warp = 1; this.eff = 1;
    this.fuel = 1; this.throttle = 1;
    this.rot = { x: 0, y: 0, z: 0 };               // body-axis angular rates, rad/s (x: nose up, y: nose left, z: roll)
    this.input = { ...ZERO_INPUT };
    this.settleFrom = null; this.settleT = 0;
    this._said = new Map(); this._lastHit = 0;
    this.events = [];
    this.lastAlt = 0;
  }

  say(text, warn = false, key = null, every = 6) {
    if (key) { const last = this._said.get(key); if (last !== undefined && this._wall - last < every) return; this._said.set(key, this._wall); }
    this.host.say(text, warn);
  }
  get _wall() { return this._t || 0; }

  // ---- state for the save, the snapshot and the other browsers ------------------------------------------------------
  save() {
    return { enabled: this.enabled, active: this.active, assist: this.assist, target: this.target, warp: this.warp, eff: this.eff, fuel: this.fuel, throttle: this.throttle,
      rot: [this.rot.x, this.rot.y, this.rot.z], settle: !!this.settleFrom };
  }
  load(r) {
    if (!r) return;
    this.enabled = !!r.enabled; this.assist = ASSISTS.includes(r.assist) ? r.assist : 'off'; this.target = TARGETS.includes(r.target) ? r.target : 'phobos';
    this.warp = FREE.warps.includes(r.warp) ? r.warp : 1; this.fuel = clamp(Number(r.fuel ?? 1), 0, 1); this.throttle = clamp(Number(r.throttle ?? 1), 0.1, 1);
    if (Array.isArray(r.rot)) { this.rot.x = +r.rot[0] || 0; this.rot.y = +r.rot[1] || 0; this.rot.z = +r.rot[2] || 0; }
    this.active = false;
    if (r.active) this._install();
  }
  /** A browser that does not step the ship (the shared world) just mirrors what the authority says. */
  applyRemote(r) {
    if (!r) return;
    this.enabled = !!r.enabled; this.active = !!r.active; this.assist = r.assist; this.target = r.target; this.warp = r.warp; this.eff = r.eff || 1;
    this.fuel = r.fuel; this.throttle = r.throttle;
  }

  _install() {
    const f = this.f;
    this.active = true; this._owns = true;
    if (f.epochS == null) f.epochS = this.host.worldTime();           // her own clock starts at the world's and runs with the drive
    if (!f.attitude) f.attitude = f.quaternion.clone();
    f.override = (dt) => this.advance(dt);
    f.autoHover = false; f.thrustDown = false; f.landed = false; f.airborne = true;
    this.settleFrom = null;
  }

  // ---- the player's levers --------------------------------------------------------------------------------------------
  /** Turn free flight on or off. Returns { ok, msg }. Switching off is allowed only slowly enough for the flight assist to hold the ship. */
  setEnabled(on) {
    const f = this.f;
    if (on) {
      if (this.enabled) return { ok: true, msg: 'Free flight is already on.' };
      if (f.hull <= 0) return { ok: false, msg: 'The ship cannot fly: no hull left.' };
      this.enabled = true;
      return { ok: true, msg: this.active ? 'Free flight on.' : 'Free flight armed. Climb above the air (100 km over Mars, or 3 km over a moon) and she is yours.' };
    }
    if (this.active) {
      const n = this.nearest();
      if (n.vRel > FREE.releaseMs) return { ok: false, msg: `Too fast to hold: ${Math.round(n.vRel)} m/s. Brake first, then switch free flight off.` };
      this.enabled = false;
      this.handover(n.id === 'mars' || !n.inPatch ? 'mars' : n.id, 'Free flight off. The flight assist holds her.');
      return { ok: true, msg: 'Free flight off.' };
    }
    this.enabled = false; this.f.climbCap = this.f.P.climbSpeed;
    return { ok: true, msg: 'Free flight off.' };
  }
  /** A course or a crew order takes the ship: free flight lets go and stays off. */
  suspend(why = 'The autopilot has the ship.') {
    if (!this.enabled && !this.active) return;
    const was = this.active;
    this.enabled = false; this.active = false; this.settleFrom = null;
    if (this.f.override && this._owns) this.f.override = null;
    this.f.epochS = null;
    this.f.climbCap = this.f.P.climbSpeed;
    this._owns = false;
    if (this.host.drones) this.host.drones.suspended = false;
    if (was) this.host.say(why, false);
  }
  setAssist(mode) { if (!ASSISTS.includes(mode)) return { ok: false, msg: 'Unknown assist.' }; this.assist = mode; return { ok: true, msg: mode === 'off' ? 'Assist off: the jets hold your attitude.' : `Assist: ${mode}.` }; }
  setTarget(id) { if (!TARGETS.includes(id)) return { ok: false, msg: 'Unknown target.' }; this.target = id; return { ok: true, msg: `Target: ${BODIES[id].name}.` }; }
  setWarp(w) { if (!FREE.warps.includes(w)) return { ok: false, msg: 'Invalid time compression.' }; this.warp = w; return { ok: true, msg: `Time compression ×${w}.` }; }
  setThrottle(t) { if (!Number.isFinite(t)) return { ok: false, msg: 'Invalid throttle.' }; this.throttle = clamp(t, 0.1, 1); return { ok: true, msg: `Throttle ${Math.round(this.throttle * 100)}%.` }; }
  setInput(i) {
    const c = (v) => { v = Number(v); return Number.isFinite(v) ? clamp(v, -1, 1) : 0; }, s = this.input;
    if (!i) { Object.assign(s, ZERO_INPUT); return; }
    s.thr = clamp(Number(i.thr) || 0, 0, 1); s.brake = !!i.brake;
    s.pitch = c(i.pitch); s.yaw = c(i.yaw); s.roll = c(i.roll); s.tx = c(i.tx); s.ty = c(i.ty); s.tz = c(i.tz);
  }

  get aMax() { const f = this.f; return DRIVE.thrustN * Math.min(1.8, f.engineFactor) * f.damageFactor / f.massKg; }
  get dvLeft() { return this.fuel * FREE.dvFullMs; }

  // ---- where is everything ------------------------------------------------------------------------------------------------
  /** The ship's own clock, game seconds: her `epochS` while she is in space (time compression runs it fast), else the world's. */
  timeS() { const e = this.f.epochS; return e == null ? this.host.worldTime() : e; }
  /** Every moon's centre and velocity (Mars's turning axes) at the ship's clock, worked out once per instant. */
  _kin(b) {
    const T = this.timeS(), c = this._kc || (this._kc = new Map());
    let e = c.get(b.id);
    if (!e || e.T !== T) { e = { T, k: b.id === 'mars' ? { c: ZERO3, v: ZERO3 } : worldKin(b.id, T) }; c.set(b.id, e); }
    return e.k;
  }
  /** The Mars-frame position of the ship (free flight only runs there; in a moon's frame it is carried out of that frame). */
  shipS() {
    const f = this.f, id = this.host.frameId();
    if (id === 'mars') return f.pos;
    const k = this._kin(BODIES[id]), r = rotY(f.pos, k.yaw);
    return { x: r.x + k.c.x, y: r.y + k.c.y, z: r.z + k.c.z };
  }
  /**
   * Height above the ground of each body, and what the ship is doing relative to it. `relVel` is her velocity relative to the body (Mars's
   * turning axes): a moon's velocity is taken off; Mars's own is her velocity over the ground below 300 km and her inertial velocity above.
   */
  bodyState(b, p = this.shipS(), v = this.f.vel) {
    const k = this._kin(b), c = k.c;
    const dx = p.x - c.x, dy = p.y - c.y, dz = p.z - c.z, d = Math.hypot(dx, dy, dz) || 1;
    let rv;
    if (b.id === 'mars') rv = d - MARS_R < 300_000 ? v : { x: v.x + OMEGA * p.z, y: v.y, z: v.z - OMEGA * p.x };
    else rv = { x: v.x - k.v.x, y: v.y - k.v.y, z: v.z - k.v.z };
    const closing = -(dx * rv.x + dy * rv.y + dz * rv.z) / d;
    if (b.station) return { id: b.id, name: b.name, d, alt: d - b.R, closing, ground: b.R, dir: { x: dx / d, y: dy / d, z: dz / d }, relVel: rv };
    // the true ground only when she is near enough for it to matter (a crater rim is a few km; the mean radius does for the rest)
    const near = b.moon ? d < b.R * 3 : d - MARS_R < 40_000;
    const R = near ? groundOf(this.mars, b.id, dx / d, dy / d, dz / d, b, k) : b.R;
    return { id: b.id, name: b.name, d, alt: d - R, closing, ground: R, dir: { x: dx / d, y: dy / d, z: dz / d }, relVel: rv };
  }
  /** The body that matters now: the lowest ship above its ground (a moon only counts inside its patch). */
  nearest() {
    const p = this.shipS(), v = this.f.vel;
    let best = null;
    for (const b of PHYS_LIST) {
      const s = this.bodyState(b, p, v);
      s.inPatch = !b.moon || s.d < b.patchM;
      if (!s.inPatch) continue;
      const score = s.alt / (b.moon ? b.R : 1e5);                // a moon's 5 km is as near as Mars's 100 km
      if (!best || score < best.score) best = { ...s, score };
    }
    best.vRel = Math.hypot(best.relVel.x, best.relVel.y, best.relVel.z);     // her speed relative to it
    return best;
  }
  /**
   * Where to point to meet the target: the place it will be when she gets there. She is closing on it at her present speed relative to it
   * (or, if she is not yet closing, at the speed her drive would make over that distance), and the target keeps moving round Mars meanwhile.
   */
  leadPoint(b, p, v, c0, kv) {
    const d0 = Math.hypot(c0.x - p.x, c0.y - p.y, c0.z - p.z), vrel = Math.hypot(v.x - kv.x, v.y - kv.y, v.z - kv.z);
    const vEff = Math.max(vrel, 0.5 * Math.sqrt(2 * Math.max(1, this.aMax) * d0), 50);
    let t = Math.min(d0 / vEff, 6 * 3600), c = c0;
    for (let k = 0; k < 3; k++) { c = b.id === 'mars' ? c0 : worldCentreFixed(b.id, this.timeS() + t); t = Math.min(Math.hypot(c.x - p.x, c.y - p.y, c.z - p.z) / vEff, 6 * 3600); }
    return c;
  }
  targetState() {
    const b = BODIES[this.target], p = this.shipS(), v = this.f.vel, s = this.bodyState(b, p, v), k = this._kin(b);
    const dist = s.d, lead = this.leadPoint(b, p, v, k.c, k.v), ld = Math.hypot(lead.x - p.x, lead.y - p.y, lead.z - p.z) || 1;
    const toward = { x: (lead.x - p.x) / ld, y: (lead.y - p.y) / ld, z: (lead.z - p.z) / ld };       // toward where it WILL be: an intercept, not the point it is at
    const now = { x: (k.c.x - p.x) / dist, y: (k.c.y - p.y) / dist, z: (k.c.z - p.z) / dist };
    const closing = -(s.relVel.x * (p.x - k.c.x) + s.relVel.y * (p.y - k.c.y) + s.relVel.z * (p.z - k.c.z)) / dist;
    return { ...s, body: b, toward, now, distM: dist, surfaceM: Math.max(0, s.alt), closing, etaS: closing > 0.5 ? Math.max(0, s.alt) / closing : Infinity };
  }

  // ---- the read-outs ----------------------------------------------------------------------------------------------------
  telemetry() {
    const f = this.f, p = this.shipS(), v = f.vel, n = this.nearest(), t = this.targetState();
    const ref = n.inPatch && n.id !== 'mars' ? BODIES[n.id] : BODIES.mars, kr = this._kin(ref);
    const rel = { x: p.x - kr.c.x, y: p.y - kr.c.y, z: p.z - kr.c.z };
    // orbit elements want the INERTIAL velocity relative to the reference: the velocity over the turning axes plus the frame's own motion at that point
    const rv = ref.id === 'mars' ? { x: v.x + OMEGA * p.z, y: v.y, z: v.z - OMEGA * p.x } : { x: v.x - kr.v.x + OMEGA * rel.z, y: v.y - kr.v.y, z: v.z - kr.v.z - OMEGA * rel.x };
    const el = orbitElements(rel, rv, ref.mu, ref.R);
    const speed = ref.id === n.id ? n.vRel : el.speed;
    const hSpeed = Math.sqrt(Math.max(0, speed * speed - (n.closing * n.closing)));
    return { active: this.active, enabled: this.enabled, speed, closing: n.closing, vertical: -n.closing, horizontal: hSpeed, alt: n.alt, ref: ref.name, refId: ref.id, nearId: n.id, nearName: n.name,
      periM: el.periM, apoM: el.apoM, periodS: el.periodS, bound: el.bound, ecc: el.e, circularMs: circularSpeed(ref.mu, el.r), escapeMs: el.escapeMs,
      target: { id: this.target, name: t.body.name, distM: t.distM, surfaceM: t.surfaceM, closing: t.closing, etaS: t.etaS, dir: t.toward, relSpeed: Math.hypot(t.relVel.x, t.relVel.y, t.relVel.z) },
      fuel: this.fuel, dvLeft: this.dvLeft, throttle: this.throttle, assist: this.assist, warp: this.warp, eff: this.eff, aMax: this.aMax,
      prograde: speed > 0.05 ? { x: n.relVel.x / speed, y: n.relVel.y / speed, z: n.relVel.z / speed } : null, thrusting: f.thrustFwd > 0, inAir: ref.id === 'mars' && n.alt < ATMOSPHERE_TOP_M };
  }

  // ---- compression ------------------------------------------------------------------------------------------------------
  /** The compression in force this tick: what was asked for, held down by burns, jets, bodies close at hand, raiders and other ships. */
  computeWarp(dt, catchUp = false) {
    const want = catchUp ? 500 : this.warp, f = this.f;
    if (want <= 1) return 1;
    let cap = want, why = null;
    const i = this.input;
    // a long burn may be compressed a little (an orbit takes four minutes of thrust); anything you steer by hand runs at x1
    if (i.tx || i.ty || i.tz || i.pitch || i.yaw || i.roll) { cap = 1; why = 'you are flying her'; }
    else if (i.thr > 0 || i.brake) { if (cap > 20) { cap = 20; why = 'the drive is lit'; } }
    const p = this.shipS(), v = f.vel;
    for (const b of PHYS_LIST) {
      const s = this.bodyState(b, p, v);
      if (b.moon && s.d > b.patchM * 2) continue;
      const lim = b.moon ? (s.alt < 8_000 ? 1 : s.alt < 30_000 ? 5 : s.alt < 100_000 ? 60 : 1e9) : (s.alt < 130_000 ? 1 : s.alt < 250_000 ? 20 : 1e9);
      if (lim < cap) { cap = lim; why = `near ${b.name}`; }
      if (s.closing > 1) {
        // Time left to the ground, less what it takes to turn over and burn the closing speed off (and half as long again), must still
        // leave eight real seconds at the compressed rate: so the compression comes down long before there is anything to do in a hurry.
        const t = Math.max(0, s.alt) / s.closing, tBrake = s.closing / (0.85 * this.aMax) + 12, w = (t - 1.5 * tBrake) / 8;
        if (w < cap) { cap = Math.max(1, w); why = `closing on ${b.name}`; }
        if (b.moon && t < 1.7 * tBrake && s.closing > FREE.handoverMs * 0.5) this.say(`Closing on ${b.name} at ${Math.round(s.closing)} m/s: turn over and BRAKE.`, true, 'closing:' + b.id, 8);
      }
    }
    if (this.host.hostileNear && this.host.hostileNear()) { cap = 1; why = 'a raider is near'; }
    if (this.host.shipNear && this.host.shipNear()) { cap = Math.min(cap, 1); why = 'another ship is near'; }
    let w = 1; for (const c of FREE.warps) if (c <= cap && c <= want) w = c;
    if (w < want && why && this._capSaid !== w + why) { this._capSaid = w + why; this.say(`Time compression held at ×${w}: ${why}.`, false); }
    else if (w >= want) this._capSaid = null;
    return w;
  }

  // ---- once per tick, before the flight steps --------------------------------------------------------------------------------
  /**
   * The host calls this every tick before it steps the flight. It decides: arm, take the ship, give her back, how fast time runs.
   * Returns the seconds of flight to run per second of the clock.
   */
  preStep(dt, o = {}) {
    this._t = (this._t || 0) + dt;
    const f = this.f, frame = this.host.frameId();
    this.events.length = 0;
    // WORLD2: free flight is charted in Mars's space only (its bodies are Mars and its moons). On a far world the course and the flight assist fly her.
    if (isLaneWorld(frame)) { if (this.enabled || this.active) this.suspend("Free flight is only charted in Mars's space. Here the autopilot and the flight assist fly the ship."); this.eff = 1; return 1; }
    // refuel on a pad
    if (f.landed && this.fuel < 1 && this.host.atPad && this.host.atPad()) {
      const before = this.fuel; this.fuel = Math.min(1, this.fuel + FREE.refuelPerS * dt);
      if (before < 1 && this.fuel >= 1) this.say('Tanks full.', false, 'full', 30);
    }
    if (this.settleFrom) this._settle(dt);
    // flying low by the stick with the legs not yet on anything: say why she will not settle (ground too uneven for the legs to level on)
    if ((this.enabled || this.active || f.autoHover) && !this.active && !f.landed && f.agl < 8 && Math.abs(f.verticalSpeed) < 0.15 && f.controls.lift < 0) {
      this._hoverT = (this._hoverT || 0) + dt;
      if (this._hoverT > 6) { this._hoverT = 0; this.say('The ground is too uneven to settle on here: slide to flatter ground, then SINK.', false); }
    } else this._hoverT = 0;
    if (!this.enabled && !this.active) { this.eff = 1; return 1; }
    if (!this.active) {
      // armed: the stick flies her until she is above the air, then she is hers
      f.climbCap = this._ascentCap();
      if (this.settleFrom) { this.eff = 1; return 1; }
      const trip = this.host.tripActive && this.host.tripActive();
      if (trip) { this.eff = 1; return 1; }
      if (frame === 'mars') {
        const alt = len3(f.pos) - MARS_R;
        if (alt >= ATMOSPHERE_TOP_M && f.hull > 0) { this._takeShip('Above the air. Free flight: the ship is yours.'); }
      } else {
        const agl = Number.isFinite(f.agl) ? f.agl : 0;
        if (agl >= FREE.moonHandoverM + 600 && f.hull > 0 && !f.landed) { this.host.setFrame('mars'); this._takeShip(`Clear of ${BODIES[frame].name}. Free flight: the ship is yours.`); }
      }
      if (!this.active) {
        const w = stickWarpCap(this.warp, Number.isFinite(f.agl) ? f.agl : 0, f.verticalSpeed, dt);
        this.eff = w; return w;
      }
    }
    // free flight is running
    if (f.hull <= 0) { this.suspend('No hull left. Free flight is off.'); this.eff = 1; return 1; }
    this._checkHandover();
    if (!this.active) { this.eff = 1; return 1; }
    this.eff = this.computeWarp(dt, !!o.catchUp);
    if (this.host.drones) this.host.drones.suspended = Math.hypot(f.vel.x, f.vel.y, f.vel.z) > RAIDER_SUSPEND_MS;
    return this.eff;
  }

  _ascentCap() {
    const f = this.f, agl = Number.isFinite(f.agl) ? f.agl : 0, frame = this.host.frameId();
    if (agl < 150) return f.P.climbSpeed;
    return frame === 'mars' ? DRIVE.ascentVMaxMs : 70;
  }
  _takeShip(msg) {
    const f = this.f;
    if (this.host.cancelOrders) this.host.cancelOrders();
    this._install(); this._owns = true;
    this.rot = { x: 0, y: 0, z: 0 };
    f.climbCap = f.P.climbSpeed;
    this.say(msg, false);
  }

  /** Give her back to the ordinary flight assist (the lift pods that hold a hover and put her down on her legs). */
  handover(bodyId, msg) {
    const f = this.f;
    if (bodyId !== 'mars' && this.host.frameId() !== bodyId) this.host.setFrame(bodyId);
    else if (bodyId === 'mars' && this.host.frameId() !== 'mars') this.host.setFrame('mars');
    const from = f.attitude ? f.attitude.clone() : f.quaternion.clone();
    // A moon turns under a ship that rode in with it (a few m/s at the surface): the flight assist takes her over holding the ground's speed, so a drift of
    // under 10 m/s across the ground is taken out (the lift pods can do that at once); a faster one is hers to deal with.
    if (bodyId !== 'mars') { const v = f.vel, r = len3(f.pos) || 1, ux = f.pos.x / r, uy = f.pos.y / r, uz = f.pos.z / r, vr = v.x * ux + v.y * uy + v.z * uz;
      if (Math.hypot(v.x - ux * vr, v.y - uy * vr, v.z - uz * vr) < 10) { v.x = ux * vr; v.y = uy * vr; v.z = uz * vr; } }
    // the nose's heading on the local horizon, so the levelled hull points where she was pointing
    f.refreshOrientation();
    const fr = f._frame, nose = _v.set(0, 0, -1).applyQuaternion(from);
    const hn = nose.x * fr.north.x + nose.y * fr.north.y + nose.z * fr.north.z, he = nose.x * fr.east.x + nose.y * fr.east.y + nose.z * fr.east.z;
    if (Math.hypot(hn, he) > 0.1) f.heading = ((Math.atan2(he, hn) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    f.override = null; this._owns = false; this.active = false; f.epochS = null;     // she rejoins the world's clock: from here a frame carries her
    f.attitude = from; this.settleFrom = from.clone(); this.settleT = 0;
    f.autoHover = true; f.thrustDown = bodyId !== 'mars'; f.climbCap = f.P.climbSpeed; f.thrustFwd = 0;
    f.refreshOrientation();
    if (this.host.drones) this.host.drones.suspended = false;
    this.say(msg, false);
  }
  _settle(dt) {
    const f = this.f;
    this.settleT += dt;
    f.refreshOrientation();                                    // fills levelQ for the frame she is in now
    const k = Math.min(1, this.settleT / 2.5);
    if (f.attitude) {
      f.attitude.copy(this.settleFrom).slerp(f.levelQ, k * k * (3 - 2 * k));
      if (k >= 1) f.attitude = null;
      f.refreshOrientation();
    }
    if (k >= 1) this.settleFrom = null;
  }

  _checkHandover() {
    const f = this.f, p = this.shipS(), v = f.vel;
    const m = this.bodyState(BODIES.mars, p, v), speed = Math.hypot(v.x, v.y, v.z);
    if (m.alt < FREE.marsHandoverM && speed <= FREE.handoverMs) { this.handover('mars', 'Low and slow over Mars. The flight assist has her.'); return; }
    for (const b of MOON_LIST) {
      const s = this.bodyState(b, p, v);
      if (s.d > b.patchM) continue;
      const vc = Math.max(0, s.closing), need = clamp(1.3 * vc * vc / 10 + 1000, FREE.moonHandoverM, 12_000);
      if (s.alt < FREE.moonHandoverM || (s.closing > 0 && s.alt < need)) { this.handover(b.id, `Close to ${b.name}. The flight assist has her: land anywhere.`); return; }
    }
  }

  // ---- the physics --------------------------------------------------------------------------------------------------------------
  /** The step the flight model calls as its override: `dt` is seconds of SHIP time. */
  advance(dt) {
    const f = this.f;
    if (!this.active) return false;
    if (this.host.frameId() !== 'mars') { this.active = false; f.override = null; return false; }
    let left = dt, n = 0;
    this._burning = false;
    if (f.epochS == null) f.epochS = this.host.worldTime();
    while (left > 1e-9 && this.active && n++ < 400) {
      const h = Math.min(left, this._maxStep());
      this._substep(h); left -= h;
      if (f.epochS != null) f.epochS += h;
    }
    f.refreshOrientation();
    if (this.active) { f.autoHover = false; f.landed = false; f.airborne = true; f.gearPos = Math.max(0, f.gearPos - dt * 0.5); f.thrustUp = 0; }
    return true;
  }
  _maxStep() {
    const f = this.f, p = f.pos, v = f.vel, speed = Math.hypot(v.x, v.y, v.z);
    let tau = Math.sqrt(Math.pow(Math.max(len3(p), MARS_R), 3) / MARS_MU);
    for (const b of MOON_LIST) { const c = this._kin(b).c, d = Math.max(Math.hypot(p.x - c.x, p.y - c.y, p.z - c.z), b.R); tau = Math.min(tau, Math.sqrt(d * d * d / b.mu)); }
    let h = clamp(0.02 * tau, 0.01, 5);
    const alt = Math.max(5, this.bodyState(BODIES.mars).alt);
    h = Math.min(h, Math.max(0.01, 0.25 * alt / (speed + 1)));
    for (const b of MOON_LIST) { const s = this.bodyState(b); if (s.d < b.patchM) h = Math.min(h, Math.max(0.01, 0.25 * Math.max(5, s.alt) / (speed + 1))); }
    return h;
  }

  _desiredDirection() {
    let mode = this.assist;
    if (this.input.brake) mode = 'retro';
    if (mode === 'prograde' || mode === 'retro') {
      const n = this.nearest(), v = n.relVel, sp = n.vRel;                      // against the body that matters (its velocity taken off)
      if (sp > 0.05) { const k = mode === 'retro' ? -1 / sp : 1 / sp; return { x: v.x * k, y: v.y * k, z: v.z * k }; }
    }
    if (mode === 'target') { const t = this.targetState(); return t.toward; }
    return null;
  }

  /** Turn the hull: the stick, or the assist, through jets that can only change the rate so fast. The mark is re-read every sub-step. */
  _rotate(h) {
    const f = this.f, q = f.attitude, i = this.input, R = FREE.rot, A = FREE.rotAccel, rot = this.rot;
    const manual = !!(i.pitch || i.yaw || i.roll);
    const sub = Math.min(8, Math.max(1, Math.ceil(h / 0.1))), hs = h / sub;
    this._aligned = !i.brake;
    for (let k = 0; k < sub; k++) {
      let wx = i.pitch * R.pitch, wy = i.yaw * R.yaw, wz = i.roll * R.roll, angErr = 0, want = null;
      if (!manual) want = this._desiredDirection();
      if (want) {
        _w.set(want.x, want.y, want.z).applyQuaternion(_q2.copy(q).invert());           // the mark, in the hull's axes
        const ex = _w.y, ey = -_w.x, mag = Math.hypot(ex, ey), ang = Math.atan2(mag, -_w.z);
        angErr = ang; this._aligned = ang < 0.14;
        if (mag > 1e-6) {
          const rate = Math.min(R.pitch, Math.sqrt(2 * A * ang) * 0.75 + ang * 0.2);
          wx = ex / mag * rate; wy = ey / mag * rate;
        } else if (_w.z > 0) { wx = R.pitch; }                                          // dead astern: turn over
      }
      if (hs > 0.5) {                                   // compressed time: no inertia to model, but never swing past the mark
        let kk = 1; if (want) { const w0 = Math.hypot(wx, wy); kk = angErr <= 1e-9 ? 0 : (w0 * hs > angErr ? angErr / (w0 * hs) : 1); }
        rot.x = wx * kk; rot.y = wy * kk; rot.z = wz;
      } else {
        const dx = wx - rot.x, dy = wy - rot.y, dz = wz - rot.z, mx = A * hs;
        rot.x += clamp(dx, -mx, mx); rot.y += clamp(dy, -mx, mx); rot.z += clamp(dz, -mx, mx);
        if (want) { const w1 = Math.hypot(rot.x, rot.y); if (w1 * hs > angErr && angErr > 0) { const s2 = angErr / (w1 * hs); rot.x *= s2; rot.y *= s2; } }   // never past the mark in one sub-step
      }
      const w = Math.hypot(rot.x, rot.y, rot.z);
      if (w > 1e-9) { _n.set(rot.x / w, rot.y / w, rot.z / w); _q.setFromAxisAngle(_n, w * hs); q.multiply(_q).normalize(); }
    }
  }

  _substep(h) {
    const f = this.f, p = f.pos, v = f.vel, i = this.input, q = f.attitude;
    this._rotate(h);
    // the nose, up and right of the hull in the Mars frame
    _v.set(0, 0, -1).applyQuaternion(q);
    const nx = _v.x, ny = _v.y, nz = _v.z;
    _v.set(1, 0, 0).applyQuaternion(q); const rx = _v.x, ry = _v.y, rz = _v.z;
    _v.set(0, 1, 0).applyQuaternion(q); const ux = _v.x, uy = _v.y, uz = _v.z;
    const r0 = len3(p), alt = r0 - MARS_R, aMax = this.aMax;
    // the drive: the throttle setting while the thrust is held; the brake works the drive on its own, once the nose is on the retrograde
    let thr = i.thr * this.throttle;
    if (i.brake) {
      const sp = this.nearest().vRel;
      thr = this._aligned ? clamp(sp / Math.max(1, aMax * 0.8), 0, 1) * (sp > 0.05 ? 1 : 0) : 0;
      thr = Math.min(thr, 0.98 * sp / Math.max(1e-6, aMax * h));            // never more than it takes to stop her in this step (a compressed step is long)
    }
    let cut = false;
    if (alt < ATMOSPHERE_TOP_M && thr > 0) { thr = 0; cut = true; }
    if (this.fuel <= 0) { if (thr > 0 || i.tx || i.ty || i.tz) this.say('Tanks dry. Only the jets that hold your attitude are left.', true, 'dry', 20); thr = 0; }
    let tx = this.fuel > 0 ? i.tx : 0, ty = this.fuel > 0 ? i.ty : 0, tz = this.fuel > 0 ? i.tz : 0;
    if (cut) this.say("The drive will not light in Mars's air. Climb above 100 km.", true, 'cut', 12);
    const ac = thr * aMax, rc = FREE.rcsAccel;
    const ax = nx * (ac + tz * rc) + rx * tx * rc + ux * ty * rc, ay = ny * (ac + tz * rc) + ry * tx * rc + uy * ty * rc, az = nz * (ac + tz * rc) + rz * tx * rc + uz * ty * rc;
    f.thrustFwd = f.maxDriveN * thr;
    if (thr > 0) this._burning = true;
    // fuel: the main drive burns its acceleration, the jets a hundredth as hard
    const dv = (ac + (Math.abs(tx) + Math.abs(ty) + Math.abs(tz)) * rc * 0.01) * h;
    if (dv > 0) this.fuel = Math.max(0, this.fuel - dv / FREE.dvFullMs);
    // gravity, the turning frame's centrifugal pull, and drag: kick-drift-kick, with the Coriolis turn of the velocity (exact) between the kicks
    const T0 = f.epochS, cs0 = centresAt(T0), cs1 = centresAt(T0 + h), w2 = OMEGA * OMEGA;
    gravityAt(p, _g, cs0); _g.x += w2 * p.x; _g.z += w2 * p.z;
    let dragx = 0, dragy = 0, dragz = 0, decel = 0;
    const drag = (pp, vv, cs) => {
      const sp = len3(vv); if (sp < 1e-6) return 0;
      let k = 0;
      const a = len3(pp) - MARS_R; if (a <= 160_000) k += dragDecel(a, sp) / sp;
      for (let n = 0; n < MOON_LIST.length; n++) { const b = MOON_LIST[n]; if (b.air) k += worldDrag(b, pp, sp, cs[n]); }       // a world with an atmosphere brakes a ship in its air
      return k;
    };
    const k0 = drag(p, v, cs0);
    let vhx = v.x + (_g.x + ax - k0 * v.x) * h / 2, vhy = v.y + (_g.y + ay - k0 * v.y) * h / 2, vhz = v.z + (_g.z + az - k0 * v.z) * h / 2;
    { const c = Math.cos(OMEGA * h), s2 = -Math.sin(OMEGA * h), x = vhx; vhx = x * c + vhz * s2; vhz = -x * s2 + vhz * c; }          // Coriolis, first half
    p.x += vhx * h; p.y += vhy * h; p.z += vhz * h;
    { const c = Math.cos(OMEGA * h), s2 = -Math.sin(OMEGA * h), x = vhx; vhx = x * c + vhz * s2; vhz = -x * s2 + vhz * c; }          // Coriolis, second half
    gravityAt(p, _g2, cs1); _g2.x += w2 * p.x; _g2.z += w2 * p.z;
    const k1 = drag(p, { x: vhx, y: vhy, z: vhz }, cs1);
    v.x = vhx + (_g2.x + ax - k1 * vhx) * h / 2; v.y = vhy + (_g2.y + ay - k1 * vhy) * h / 2; v.z = vhz + (_g2.z + az - k1 * vhz) * h / 2;
    // the hull holds its attitude against the stars: in the turning axes that is a slow turn the other way
    q.premultiply(_qy.setFromAxisAngle(_Yax, -OMEGA * h));
    decel = k1 * Math.hypot(vhx, vhy, vhz);
    if (decel > FREE.maxDecel) {
      f.hull = Math.max(0, f.hull - (decel - FREE.maxDecel) * 0.02 * h);
      this.say('Hull stress: the air is slowing her too hard. Pull out.', true, 'stress', 5);
    }
    this.decel = decel;
    f.agl = this.bodyState(BODIES.mars).alt;
    // the ground
    for (const b of PHYS_LIST) {
      const s = this.bodyState(b, p, v);
      if (s.alt < 3 && (!b.moon || s.d < b.patchM)) { this._impact(b, s); break; }
    }
  }

  _impact(b, s) {
    const f = this.f, v = f.vel, sp = Math.hypot(v.x, v.y, v.z), rate = Math.max(0, s.closing);
    this.events.push({ type: 'impact', body: b.id, speed: sp });
    // set her down on the ground she hit and hand her to the flight assist, hurt in proportion to how hard
    const hurt = rate > 8 ? (rate - 8) * 1.2 : 0;
    f.hull = Math.max(0, f.hull - hurt);
    this.say(hurt > 0 ? `Impact at ${Math.round(rate)} m/s. Hull ${Math.round(f.hull)}%.` : 'Touched down.', hurt > 0, 'impact', 3);
    const lift = (s.ground + 4) / s.d;
    const k = this._kin(b), c = k.c;
    f.pos.x = c.x + (f.pos.x - c.x) * lift; f.pos.y = c.y + (f.pos.y - c.y) * lift; f.pos.z = c.z + (f.pos.z - c.z) * lift;
    v.x = k.v.x; v.y = k.v.y; v.z = k.v.z;                    // at rest on the ground she hit: a moon's ground moves with the moon, Mars's is the frame (zero)
    this.handover(b.id, 'Down. The flight assist has her.');
  }
}
