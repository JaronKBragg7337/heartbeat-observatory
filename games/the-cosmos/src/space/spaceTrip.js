// ============================================================================
// spaceTrip.js — one journey, from wherever the ship is to a destination, as a short list of phases:
//
//   lift      leave the ground (the crew rules still apply: ramp folded, the player aboard)
//   ascent    straight up on the lift pods until the air is gone (Mars: 120 km; a moon: 2.5 km)
//   transit   the main drive (transit.js): turn, burn, flip, brake, creep onto the standoff point
//   spool     (WORLD2, a trip to another system only) hold still at the lane mouth while the jump coils spool; then the jump, and a second
//             transit in the other system's own frame (jump.js says how and why)
//   settle    hull eased back level, frame switched to the destination's, speed zero
//   descent   straight down on the flight assist (its flare is what makes the landing gentle) until landed
//
// OWNS: the phases, the stick values for the stick phases, the override that moves the ship in transit, and the sentences the
//       ship says along the way.
// DOES NOT OWN: the drive's rules (transit.js), the frames (spaceSystem.js), the hull and its physics (shipFlight.js).
// ============================================================================

import * as THREE from 'three';
import { Transit, turnToward, estimateTrip } from './transit.js';
import { DRIVE, ATMOSPHERE_TOP_M, STANDOFF_M, RAIDER_SUSPEND_MS, stickWarpCap } from './spaceSpec.js';
import { JUMP, systemOfFrame, rootFrameOf, regionName, laneName, mouthPoint, transitBody, solMouthDir } from './jump.js';     // WORLD2: the Ore Lane
import { makeMoon } from './moonField.js';
import { toInertial, velToInertial, velToFixed, rotY, rootSpin, inertialGoal } from './frames.js';

/**
 * How long a leg takes, flown for real (transit.js) from a ship hovering at `startFixed` (Mars's turning axes) at game time T, chasing the leg's goal
 * as it moves. `leg` is a destination row (it has `fixedAt(T)`, the goal in Mars's turning axes at game time T) or a drive leg { goal } (a point
 * fixed in those axes). The nav list, the trip plan and the tests share it.
 * @returns { seconds, peakSpeed, arrived, error, closedForm? }
 */
export function estimateCourse({ dest, startFixed, T, nose, aMax }) {
  const pos = toInertial(startFixed, T), vel = velToInertial(startFixed, { x: 0, y: 0, z: 0 }, T);
  const fixedAt = dest.fixedAt || (dest.goal ? () => dest.goal : null);
  const goalFn = fixedAt ? inertialGoal(fixedAt, T) : null;
  const goal = goalFn ? goalFn(0).pos : dest.goalS({ f: { pos: startFixed } });
  return estimateTrip({ pos, vel, nose: rotY(nose, rootSpin(T)), up: { x: 0, y: 1, z: 0 }, goal, goalFn, T0: T, aMax, vMax: DRIVE.vMaxMs, turnRate: DRIVE.turnRate });
}

export const MARS_R = 3_389_500;
const DEG = Math.PI / 180;
const fmtKm = (m) => (m >= 1e6 ? `${(m / 1000).toFixed(0)} km` : m >= 1e4 ? `${(m / 1000).toFixed(0)} km` : m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);
export const fmtDuration = (s) => (s >= 5400 ? `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min` : s >= 120 ? `${Math.round(s / 60)} min` : `${Math.round(s)} s`);

const _m = new THREE.Matrix4(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();

export class SpaceTrip {
  /**
   * @param space SpaceSystem
   * @param dest  a DESTINATIONS entry, resolved: { id, kind, name, moon?, goalS }  (goalS: the standoff point in MARS-frame metres)
   * @param o     { by: crew member name or null }
   */
  constructor(space, dest, o = {}) {
    this.space = space; this.ship = space.ship; this.f = space.ship.flight;
    this.dest = dest; this.by = o.by || null;
    this.phase = 'start'; this.t = 0; this.warp = 1;
    this.transit = null; this.settleT = 0; this.cancelled = false;
    this.controls = { fwd: 0, lift: 0, yaw: 0 };
    this._said = new Set();
    this.leaveFrame = null;           // the frame the ship left from
    this.progress = { distM: 0, speed: 0, etaS: 0, phase: 'start' };
    this.eff = 1;                     // the compression actually in force this frame (the requested one, held down near the ground)
    this.planS = null;                // planned ship-time seconds for { climb, drive, descent }, made when the trip starts
    this.legs = null; this.leg = 0;   // WORLD2: the drive legs of the whole route: [{ sys, goal, jump? }] (one leg inside a system, two across the lane)
    this.spoolT = 0;                  // WORLD2: cabin seconds spent spooling the jump coils
  }

  // ---- compression for the climb and the landing (space-fix) ----------------------------------------------------------
  /** Called by the ship each frame before it steps the flight: how many seconds of flight to run per real second. */
  stickWarp(dt) {
    const f = this.f;
    if (this.warp > 1 && (this.phase === 'ascent' || this.phase === 'descent')) this.eff = stickWarpCap(this.warp, Number.isFinite(f.agl) ? f.agl : 0, f.verticalSpeed, dt);
    else this.eff = this.phase === 'transit' ? this.warp : 1;
    return this.phase === 'ascent' || this.phase === 'descent' ? this.eff : 1;
  }

  /** Ship-time seconds for a sink from `agl` metres under the flare law (sink speed = 0.6 + sqrt(2 * spare * h), capped), plus the settle. */
  _descentS(agl, cap) {
    const f = this.f, spare = Math.max(0.3, (f.maxLiftN / f.massKg - 3) * 0.5);
    let t = 0; const n = 40;
    for (let i = 0; i < n; i++) { const h = agl * (1 - (i + 0.5) / n), v = Math.min(cap, 0.6 + Math.sqrt(2 * spare * h)); t += (agl / n) / v; }
    return t + 12 + (cap > 100 ? 18 : 6);                              // the initial pick-up of speed and the last touchdown
  }
  /** Ship-time seconds to climb `distM` more metres on the pods from speed `v`. */
  _climbS(distM, v) {
    const f = this.f, a = Math.max(0.5, (f.maxLiftN / f.massKg - 3.0) * 0.9);
    return Math.max(0, (-Math.max(0, v) + Math.sqrt(Math.max(0, v) ** 2 + 2 * a * Math.max(0, distM))) / a);
  }
  // ---- WORLD2: the route across the Ore Lane --------------------------------------------------------------------------
  _here() { return systemOfFrame(this.space.frameId); }
  _destSys() { const d = this.dest; return d.sys || (d.kind === 'moon' ? systemOfFrame(d.moon) : 'mars'); }
  /** The far world's body for a region (its pad, its radius): the region's own name is the world's id. */
  _regionBody(region) { return region === 'mars' ? null : makeMoon(region); }
  /** The destination's goal in the coordinates of a system's root frame (Mars's frame for Sol, the world's own for a far world). */
  _goalIn(sys) {
    const d = this.dest;
    if (sys !== 'mars' && d.goalLocal) return d.goalLocal(this);
    if (sys === 'mars' && d.kind === 'orbit' && this._here() !== 'mars') { const m = solMouthDir(), R = MARS_R + DRIVE.orbitAltM; return { x: m.x * R, y: m.y * R, z: m.z * R }; }     // "orbit" from another system: over the lane's side of Mars
    return d.goalS(this);
  }
  /** The drive legs from where the ship is (a trip inside a system has one; across the lane, two: to the mouth, then in from the other mouth). */
  _route() {
    const here = this._here(), there = this._destSys();
    if (here === there) return [{ sys: here, goal: this._goalIn(here) }];
    return [{ sys: here, goal: mouthPoint(here, this._regionBody(here)), jump: true }, { sys: there, goal: this._goalIn(there) }];
  }
  /** Height of the ship over the body whose frame it is in. */
  _alt(p = this.f.pos) { return Math.hypot(p.x, p.y, p.z) - (this.space.frameId === 'mars' ? MARS_R : this._body().radiusMean); }
  _body() { return this.space.frameId === 'mars' ? null : this.space.moonWorld(this.space.frameId).body; }
  /** How high a ship climbs on the pods over a moon before the main drive takes her. */
  _ascentM() { const id = this.space.frameId; if (id === 'mars') return DRIVE.gateAltM; try { return makeMoon(id).spec.ascentM || 2500; } catch { return 2500; } }
  _crossing() { return this.legs ? this.legs.length > 1 : this._destSys() !== this._here(); }

  /** The phases of the whole trip, each with the ship-time seconds left (done: 0). Used by every panel. */
  phases() {
    const sp = this.space, f = this.f, out = [], d = this.dest;
    const jump = this._crossing(), there = this._destSys();
    const order = jump ? ['ascent', 'transit', 'spool', 'cruise', 'descent'] : ['ascent', 'transit', 'descent'];
    const cur = this.phase === 'lift' || this.phase === 'start' ? 'ascent' : this.phase === 'settle' ? 'descent' : this.phase === 'transit' && jump && this.leg > 0 ? 'cruise' : this.phase;
    const pl = this.planS || (this.planS = this._plan0());
    const has = { ascent: pl.climb > 0, transit: d.kind !== 'hold', spool: jump, cruise: jump, descent: d.kind === 'moon' || d.kind === 'port' };
    const names = { ascent: 'Climb out', transit: jump ? 'Main drive to the lane' : 'Main drive', spool: 'Jump coils spool', cruise: `Main drive, ${regionName(there)} side`, descent: d.kind === 'port' ? 'Descent to the pad' : 'Descent and landing' };
    for (const k of order) {
      if (!has[k]) continue;
      const i = order.indexOf(k), ci = order.indexOf(cur);
      let left;
      if (i < ci) left = 0;
      else if (k === 'ascent' && i === ci) left = this._climbLeftS();
      else if ((k === 'transit' || k === 'cruise') && i === ci) left = this.progress.etaS || pl[k === 'cruise' ? 'drive2' : 'drive'] || 0;
      else if (k === 'spool' && i === ci) left = Math.max(0, JUMP.spoolS - this.spoolT);
      else if (k === 'descent' && i === ci) left = this.phase === 'settle' ? 6 + this._descentS(this._descentStartAgl(), this._descentCap()) : this._descentS(Math.max(0, Number.isFinite(f.agl) ? f.agl : 0), this._descentCap());
      else left = k === 'spool' ? JUMP.spoolS : pl[k === 'ascent' ? 'climb' : k === 'transit' ? 'drive' : k === 'cruise' ? 'drive2' : 'descent'] || 0;
      out.push({ id: k, name: names[k], state: i < ci ? 'done' : i === ci ? 'now' : 'next', leftS: left, warp: k === 'spool' ? 1 : i === ci ? (k === 'transit' || k === 'cruise' ? this.warp : this.eff) : this.warp });
    }
    return out;
  }
  /** Real seconds a phase has left at the compression it will run at (a phase not yet begun is taken at the chosen compression). */
  wallS(q) {
    if (q.state === 'done') return 0;
    if (q.id === 'spool') return q.leftS;                                                                   // cabin time: compression does not shorten it
    const w = Math.max(1, q.state === 'now' ? (q.warp || 1) : this.warp);
    if (q.id === 'descent' && w > 1) { const tail = Math.min(q.leftS, 30); return tail + (q.leftS - tail) / w; }     // the last 400 m always run at x1
    return q.leftS / w;
  }
  _descentCap() { return this.space.frameId === 'mars' ? 800 : 60; }
  _descentStartAgl() { return this.dest.kind === 'port' ? DRIVE.gateAltM : STANDOFF_M; }
  _climbLeftS() {
    const f = this.f;
    if (this.space.frameId === 'mars') return this._climbS(Math.max(0, DRIVE.gateAltM - this._marsAlt()), f.verticalSpeed) + 8;
    return this._climbS(Math.max(0, this._ascentM() + 100 - (Number.isFinite(f.agl) ? f.agl : 0)), f.verticalSpeed) + 4;
  }
  /** What the plan was when the trip began, from where the ship is. */
  _plan0() {
    const sp = this.space, d = this.dest;
    const climb = this.phase === 'transit' || this.phase === 'spool' || this.phase === 'descent' || this.phase === 'settle' ? 0 : this._climbLeftS();
    let drive = 0, drive2 = 0;
    try {
      const f = this.f, here = this._here(), p = here === 'mars' ? sp._shipS() : { x: f.pos.x, y: f.pos.y, z: f.pos.z };
      let start = p;
      if (here === 'mars' && sp.frameId === 'mars' && this._marsAlt() < DRIVE.gateAltM) start = sp._gatePoint(p);
      else if (here !== 'mars') { const r = Math.hypot(p.x, p.y, p.z), R = this._regionBody(here).radiusMean + this._ascentM(); if (r < R) start = { x: p.x / r * R, y: p.y / r * R, z: p.z / r * R }; }
      const legs = this.legs || (d.kind === 'hold' ? null : this._route());
      const nose = { x: f.fwdH.x, y: f.fwdH.y, z: f.fwdH.z };
      // F2: a leg in Mars's region is flown against a goal that moves (a moon, the port that turns with Mars, the lane mouth that turns with it); a far world's region is its own frame, which does not move for the drive
      const est = (pos, leg) => leg.sys === 'mars'
        ? estimateCourse({ dest: { fixedAt: this._legFixed(leg), goal: leg.goal, goalS: () => leg.goal }, startFixed: pos, T: sp.timeS(), nose, aMax: this._aMax() }).seconds
        : estimateTrip({ pos, vel: { x: 0, y: 0, z: 0 }, nose, up: { x: 0, y: 1, z: 0 }, goal: leg.goal, aMax: this._aMax(), vMax: DRIVE.vMaxMs, turnRate: DRIVE.turnRate, ...transitBody(leg.sys, this._regionBody(leg.sys)) }).seconds;
      if (legs) {
        drive = est(start, legs[0]);
        if (legs.length > 1) drive2 = est(mouthPoint(legs[1].sys, this._regionBody(legs[1].sys)), legs[1]);
      }
    } catch (e) { drive = 0; }
    return { climb, drive, drive2, spool: this._crossing() ? JUMP.spoolS : 0, descent: d.kind === 'moon' || d.kind === 'port' ? this._descentS(this._descentStartAgl(), d.kind === 'port' ? 800 : 60) + 8 : 0 };
  }

  say(text, key, warn = false) {
    if (key) { if (this._said.has(key)) return; this._said.add(key); }
    this.space.say(text, warn, this.by);
  }

  // ---- helpers --------------------------------------------------------------------------------------------------------
  _frameId() { return this.space.frameId; }
  /** Height above Mars's mean radius of a point in the Mars frame (or the ship if omitted). */
  _marsAlt(p = this.f.pos) { return Math.hypot(p.x, p.y, p.z) - MARS_R; }
  _aMax() { const f = this.f; return DRIVE.thrustN * Math.min(1.8, f.engineFactor) * f.damageFactor / f.massKg; }

  /** What phase does this trip begin with? */
  _plan() {
    const sp = this.space, f = this.f;
    if (sp.frameId === 'mars') {
      const alt = this._marsAlt();
      if (alt < DRIVE.gateAltM) {
        if (this.dest.kind === 'port' && alt < ATMOSPHERE_TOP_M) return { ok: false, msg: 'We are in Mars airspace: ask for a pad, not a course. (The pilot can Fly to any pad.)' };
        return { ok: true, phase: f.landed ? 'lift' : 'ascent' };
      }
      return { ok: true, phase: 'transit' };
    }
    // on or near a moon
    const w = sp.moonWorld(sp.frameId), r = Math.hypot(f.pos.x, f.pos.y, f.pos.z);
    const agl = r - w.body.surfaceRadius(f.pos.x / r, f.pos.y / r, f.pos.z / r);
    if (this.dest.kind === 'moon' && this.dest.moon === sp.frameId) return { ok: false, msg: `We are at ${w.body.name} already.` };
    return { ok: true, phase: agl < this._ascentM() * 0.88 ? (f.landed ? 'lift' : 'ascent') : 'transit' };
  }

  // ---- the per-frame brain --------------------------------------------------------------------------------------------
  /** Returns the stick controls to write, or null (transit: the override drives the ship). Called once a frame. */
  tick(dt) {
    const f = this.f, sp = this.space, c = this.controls;
    c.fwd = 0; c.lift = 0; c.yaw = 0;
    this.t += dt;
    if (this.phase === 'start') {
      const pl = this._plan();
      if (!pl.ok) { this.phase = 'done'; this.failed = pl.msg; return null; }
      this.phase = pl.phase;
      this.planS = this._plan0();
      this.say(`Course set for ${this.dest.name}.`, 'course');
      if (this.phase === 'transit') this._beginTransit();
    }
    this.progress.phase = this.phase;
    switch (this.phase) {
      case 'lift': {
        c.lift = 1;
        if (!f.landed && f.agl > 25) { this.phase = 'ascent'; this.say('Clear of the ground. Climbing out.', 'clear'); }
        return c;
      }
      case 'ascent': return this._ascent(c, dt);
      case 'transit': return null;
      case 'spool': return this._spool(c, dt);
      case 'settle': return this._settle(c, dt);
      case 'descent': return this._descent(c, dt);
      default: return null;
    }
  }

  _ascent(c, dt) {
    const f = this.f, sp = this.space;
    f.autoHover = true;
    if (sp.frameId === 'mars') {
      const alt = this._marsAlt(), agl = Number.isFinite(f.agl) ? f.agl : 0;
      f.climbCap = agl < 200 ? 40 : DRIVE.ascentVMaxMs;
      c.lift = 1;
      this.progress.distM = Math.max(0, DRIVE.gateAltM - alt); this.progress.speed = f.verticalSpeed;
      if (alt > 1500 && alt < 1500 + 400) this.say('Leaving Mars neutral airspace. Expect raiders.', 'neutral', true);
      if (alt > 30_000) this.say('The sky is going black. Stars.', 'stars');
      if (alt >= ATMOSPHERE_TOP_M) this.say('Above the air. The main drive will light at the gate.', 'air');
      if (alt >= DRIVE.gateAltM) {
        f.climbCap = 12;
        if (this.dest.kind === 'orbit' && alt >= DRIVE.orbitAltM - 2000) { this._finishHere('Holding over Mars.'); return null; }
        this.phase = 'transit'; this._beginTransit();
        return null;
      }
      return c;
    }
    // on a moon: straight up to 2.5 km (a big world: above its highest ground), then the main drive
    const w = sp.moonWorld(sp.frameId), r = Math.hypot(f.pos.x, f.pos.y, f.pos.z), top = this._ascentM();
    const agl = r - w.body.surfaceRadius(f.pos.x / r, f.pos.y / r, f.pos.z / r);
    f.climbCap = top > 3000 ? 110 : 70; c.lift = 1;
    this.progress.distM = Math.max(0, top - agl);
    if (agl >= top) { f.climbCap = 12; this.phase = 'transit'; this._beginTransit(); return null; }
    return c;
  }

  _beginTransit() {
    const sp = this.space, f = this.f;
    if (!this.legs) { this.legs = this._route(); this.leg = 0; }       // WORLD2: the ship's own frame decides the route, once, at the first burn
    const leg = this.legs[this.leg], tb = transitBody(leg.sys, this._regionBody(leg.sys));
    sp.setFrame(rootFrameOf(leg.sys));              // transit is in the system's root frame (Mars's, or the far world's); the ship is moving or hovering when it switches
    // the first leg leaves a level ship; the second (after the jump) carries on from the hull's own attitude
    const q = this.leg > 0 && f.quaternion ? f.quaternion : null;
    const nose = q ? new THREE.Vector3(0, 0, -1).applyQuaternion(q) : new THREE.Vector3(f.fwdH.x, f.fwdH.y, f.fwdH.z);
    const upv = q ? new THREE.Vector3(0, 1, 0).applyQuaternion(q) : new THREE.Vector3(f.up.x, f.up.y, f.up.z);
    // F2: in Mars's region the drive flies in INERTIAL axes (Mars-centred, not turning) and chases a goal that moves with its world; the ship's own
    // coordinates (flight.pos) stay in Mars's turning axes, written back every tick, and the ship's own clock (flight.epochS) starts here and runs with the
    // drive. A far world's region (WORLD2) is flown in its own frame, as before.
    const inertial = leg.sys === 'mars';
    let T0 = 0, goalFn = null, goal = leg.goal, pos = f.pos, vel = f.vel, nv = { x: nose.x, y: nose.y, z: nose.z }, uv = { x: upv.x, y: upv.y, z: upv.z };
    if (inertial) {
      T0 = f.epochS ?? sp.worldTime(); f.epochS = T0;
      const fx = this._legFixed(leg), phi = rootSpin(T0);
      goalFn = fx ? inertialGoal(fx, T0) : null; goal = goalFn ? goalFn(0).pos : leg.goal;          // a 'hold' (a cancelled course) is a fixed inertial point
      pos = toInertial(f.pos, T0); vel = velToInertial(f.pos, f.vel, T0); nv = rotY(nv, phi); uv = rotY(uv, phi);
    }
    this.goalS = goal;
    this.transit = new Transit({
      pos, vel, nose: nv, up: uv,
      goal, goalFn, T0, inertial, aMax: this._aMax(), vMax: DRIVE.vMaxMs, turnRate: DRIVE.turnRate, centre: tb.centre, safeR: tb.safeR, floorR: tb.floorR,
    });
    f.attitude = new THREE.Quaternion().copy(f.quaternion);
    f.override = (dt) => this._drive(dt);
    f.autoHover = false;
    this.say(this.transit.legs.length ? `Plotting a course round ${leg.sys === 'mars' ? 'Mars' : regionName(leg.sys)} first.` : leg.jump ? 'Main drive lit for the Ore Lane. Hold on to something.' : 'Main drive lit. Hold on to something.', 'burn' + this.leg);
    this.progress.distM = this.transit.distance;
  }
  /** A trip restored from a save or the shared world has lost its goal function: bind it again from the destination. */
  rebindTransit() {
    const t = this.transit, leg = this.legs && this.legs[this.leg], fx = leg ? this._legFixed(leg) : (this.dest && this.dest.fixedAt);
    if (t && t.inertial && fx && !t.goalFn) t.bindGoal(inertialGoal(fx, t.T0));
    return this;
  }
  /** The goal of a drive leg in Mars's turning axes as a function of game time, or null: the lane mouth is a fixed point in them; the destination's own goal may move (a moon). A far region's legs and a hold are not. */
  _legFixed(leg) {
    if (!leg || leg.sys !== 'mars' || this.dest.kind === 'hold') return null;
    if (leg.jump) { const m = mouthPoint('mars'); return () => m; }
    return this.dest.fixedAt || null;
  }

  /** The override: the drive moves the ship. */
  _drive(dt) {
    const f = this.f, tr = this.transit;
    if (!tr) return false;
    const sim = dt * this.warp;
    if (!tr.done) {
      // the lift pods and main engines are the same reactor: engine share is what sets the push, even mid-flight
      tr.advance(sim, this._aMax());
    }
    // the ship's clock runs with the drive; her coordinates are Mars's turning axes at that moment (a far world's region is flown in its own frame as it was)
    let pf = tr.pos, vf = tr.vel, nf = tr.nose, uf = tr.up;
    if (tr.inertial) {
      const T1 = tr.T0 + tr.t, phi = rootSpin(T1);
      f.epochS = T1;
      pf = rotY(tr.pos, -phi); vf = velToFixed(tr.pos, tr.vel, T1); nf = rotY(tr.nose, -phi); uf = rotY(tr.up, -phi);
    }
    f.pos.x = pf.x; f.pos.y = pf.y; f.pos.z = pf.z;
    f.vel.x = vf.x; f.vel.y = vf.y; f.vel.z = vf.z;
    // hull: nose along the thrust, up carried over from the level ship
    _a.set(nf.x, nf.y, nf.z); _b.set(uf.x, uf.y, uf.z);
    _c.crossVectors(_a, _b).normalize();                  // right = fwd x up
    _b.crossVectors(_c, _a).normalize();                  // re-orthogonalise up
    const back = _a.clone().negate();
    _m.makeBasis(_c, _b, back);
    f.attitude.setFromRotationMatrix(_m);
    f.refreshOrientation();
    f.thrustFwd = f.maxDriveN * tr.thrust; f.thrustUp = 0; f.autoHover = false;
    f.landed = false; f.airborne = true; f.gearPos = Math.max(0, f.gearPos - dt * 0.5);
    f.agl = this._alt();
    // raiders cannot keep up with a ship doing km/s: they do not follow a transit
    const dr = this.ship.drones; if (dr) dr.suspended = tr.relSpeed > RAIDER_SUSPEND_MS;
    // progress for the readouts: the distance to the goal and the speed relative to it
    const D = Math.hypot(tr.finalGoal.x - tr.pos.x, tr.finalGoal.y - tr.pos.y, tr.finalGoal.z - tr.pos.z);
    this.progress.distM = D; this.progress.speed = tr.relSpeed;
    this.progress.etaS = this._eta(tr, D);
    this.progress.stage = tr.phase;
    if (tr.phase === 'flip') this.say('Turn-over. Brace for the burn to slow down.', 'flip' + (tr.legIndex || 0));
    if (tr.phase === 'brake') this.say('Braking burn.', 'brake' + (tr.legIndex || 0));
    if (tr.done) this._arrive();
    return true;
  }

  _eta(tr, D) {
    // a quick estimate: accelerate/brake at aMax*0.9 over what remains, never past vMax
    const a = Math.max(0.5, tr.aMax * 0.9), v = tr.speed;
    const tBrake = v / a, dBrake = v * v / (2 * a);
    if (D <= dBrake) return tBrake + 30;
    const rest = D - dBrake, vTop = Math.min(tr.vMax, Math.sqrt(a * rest + v * v / 2));
    return tBrake + 2 * (vTop - v / 2) / a + Math.max(0, rest - (vTop * vTop - v * v / 2) / a) / Math.max(vTop, 1) + tr.flipT + 40;
  }

  _arrive() {
    const f = this.f, d = this.dest;
    f.override = null; this.transit = null;
    f.thrustFwd = 0; f.autoHover = true;                  // her velocity stays what the drive matched: the goal's (a moon's, or the port's turn)
    const dr = this.ship.drones; if (dr) dr.suspended = false;
    const leg = this.legs && this.legs[this.leg];
    if (leg && leg.jump) {                                // WORLD2: at the lane mouth. Hold still; the coils spool.
      f.epochS = null;                                    // (F2) she holds in the frame: back on the world's clock
      this.phase = 'spool'; this.spoolT = 0;
      this._attFrom = f.attitude ? f.attitude.clone() : null;
      if (this.space.prepareWorld) this.space.prepareWorld(rootFrameOf(this._destSys()));      // the far world is built now, behind the spool, not at the jump
      this.say(`At the ${laneName(leg.sys)}. Jump coils spooling: ${JUMP.spoolS} seconds. The Compact's lane fee is ${JUMP.feeCredits} credits.`, 'spool' + this.leg);
      return;
    }
    this.phase = 'settle'; this.settleT = 0;
    if (d.kind === 'moon') this.space.setFrame(d.moon);   // re-expresses her position, velocity and attitude in the moon's turning frame
    f.epochS = null;                                      // she rejoins the world's clock: from here she is carried by the ground's frame
    this._attFrom = f.attitude ? f.attitude.clone() : null;
    if (d.kind === 'port') f.heading = this.space.portHeading();
    this.say(d.kind === 'orbit' ? `On station over Mars.` : d.kind === 'station' ? `Arrived off ${d.name}. Easing level.` : `Arrived over ${d.name}. Easing level.`, 'arrive');
  }

  /** WORLD2: the coils spool. The ship holds; at the end the fee is taken, the frame changes and the second leg begins. */
  _spool(c, dt) {
    const f = this.f;
    this.spoolT += dt; f.autoHover = true;
    f.vel.x = f.vel.y = f.vel.z = 0;
    const left = JUMP.spoolS - this.spoolT;
    if (left < 10 && left > 9) this.say('Coils at half charge. Hold on.', 'spool-half' + this.leg);
    if (this.spoolT >= JUMP.spoolS) return this._jump(c);
    return c;
  }
  _jump(c) {
    const leg = this.legs[this.leg], toSys = this._destSys(), toFrame = rootFrameOf(toSys);
    const paid = this.space.payLaneFee ? this.space.payLaneFee(JUMP.feeCredits) : { ok: true };
    if (!paid.ok) { this.legs = null; this.leg = 0; this._finishHere(paid.msg || `The lane office wants ${JUMP.feeCredits} credits and the account is short. Holding at the lane mouth.`); return null; }
    this.space.jumpTo(toFrame, mouthPoint(toSys, this._regionBody(toSys)));
    this.leg++;
    this.phase = 'transit';
    this.say(`The corridor opens. ${regionName(toSys)} side. Lane fee paid: ${JUMP.feeCredits} credits.`, 'jumped' + this.leg);
    this._beginTransit();
    return null;
  }

  _settle(c, dt) {
    const f = this.f;
    this.settleT += dt; f.autoHover = true;
    f.refreshOrientation();                                 // fills levelQ for the new frame
    const k = Math.min(1, this.settleT / 6);
    if (f.attitude) {
      f.attitude.copy(this._attFrom || f.attitude).slerp(f.levelQ, k * k * (3 - 2 * k));
      if (k >= 1) { f.attitude = null; }
      f.refreshOrientation();
    }
    f.vel.x = f.vel.y = f.vel.z = 0;
    if (k >= 1 && !f.attitude) {
      if (this.dest.kind === 'station') { this._finishHere(`Holding off ${this.dest.name}. Docking is the station's own business: ask its dock.`); return null; }
      if (this.dest.kind === 'orbit' || this.dest.kind === 'hold') {
        // nowhere to come down to: hold here (the flight assist hovers the ship against whatever pull there is)
        this._finishHere(this.dest.kind === 'hold' ? `Stopped. Holding ${fmtKm(this._alt())} above ${this._bodyName()}.` : `Holding over ${this._bodyName()} at ${fmtKm(this._alt())}.`);
        return null;
      }
      this.phase = 'descent';
      this.say(`Taking her down.`, 'down');
    }
    return c;
  }

  _descent(c, dt) {
    const f = this.f; f.autoHover = true;
    if (this.dest.kind !== 'moon' && this.dest.kind !== 'port') { this._finishHere('Holding.'); return null; }
    c.lift = -1;
    f.thrustDown = this.space.frameId !== 'mars';
    f.climbCap = this.space.frameId === 'mars' ? 800 : 60;           // the flight assist's flare keeps the sink inside what the pods can stop
    this.progress.distM = Number.isFinite(f.agl) ? f.agl : 0; this.progress.speed = Math.abs(f.verticalSpeed);
    if (f.landed) {
      f.climbCap = 12; f.thrustDown = false;
      this.phase = 'done';
      this.space.onLanded(this.dest, this);
      this.say(`Down at ${this.dest.name}.`, 'landed');
    }
    return c;
  }

  _bodyName() { const b = this._body(); return b ? b.name : 'Mars'; }
  _finishHere(msg) { this.phase = 'done'; this.say(msg, 'here'); this.space.onHeld(this.dest, this); }

  // ---- the player's levers --------------------------------------------------------------------------------------------
  setWarp(w) { this.warp = w; }

  /** Stop the trip. In transit: brake to a halt where the line leads (the ship then holds). Climbing: refused fast, below the air. */
  cancel(msg) {
    const f = this.f;
    if (this.phase === 'transit' && this.transit && !this.transit.done) {
      const tr = this.transit, v = tr.speed;
      if (v < 5) { this._holdHere(msg); return { ok: true }; }
      // a new goal: where braking would stop us along the present velocity
      const aD = tr.aMax * 0.85, d = v * v / (2 * aD) + v * tr.flipT * 1.1 + 900;
      const vh = { x: tr.vel.x / v, y: tr.vel.y / v, z: tr.vel.z / v };     // (inertial: a hold is a point in inertial space; the speed that matters here is the ship's own)
      const goal = { x: tr.pos.x + vh.x * d, y: tr.pos.y + vh.y * d, z: tr.pos.z + vh.z * d };
      this.dest = { id: 'hold', kind: 'hold', name: 'a stop', goalS: () => goal, sys: this._here() };
      this.legs = [{ sys: this._here(), goal }]; this.leg = 0;       // WORLD2: a stop is one leg in the system the ship is in (it must not go on to the jump)
      this.transit = new Transit({ pos: tr.pos, vel: tr.vel, nose: tr.nose, up: tr.up, goal, T0: tr.T0 + tr.t, inertial: tr.inertial, aMax: tr.aMax, vMax: tr.vMax, turnRate: tr.turnRate, centre: tr.centre, safeR: tr.safeR, floorR: tr.floorR });
      this.say(msg || 'Course cancelled. Braking to a stop.', 'cancel', true);
      return { ok: true };
    }
    if (this.phase === 'ascent' && this.space.frameId === 'mars' && this._marsAlt() < ATMOSPHERE_TOP_M && f.verticalSpeed > 60) {
      return { ok: false, msg: 'Committed to the climb: the lift pods only push up, they cannot stop the ship. The main drive can once we are above the air.' };
    }
    this._holdHere(msg);
    return { ok: true };
  }

  _holdHere(msg) {
    const f = this.f;
    f.override = null; this.transit = null; f.autoHover = true; f.climbCap = 12; f.thrustFwd = 0; f.thrustDown = false; f.epochS = null;
    const dr = this.ship.drones; if (dr) dr.suspended = false;
    if (f.attitude) { this.phase = 'settle'; this.settleT = 0; this._attFrom = f.attitude.clone(); this.dest = { ...this.dest, kind: 'orbit', name: 'here' }; }
    else this.phase = 'done';
    this.cancelled = true;
    this.say(msg || 'Course cancelled. Holding.', 'cancel2', true);
  }

  get active() { return this.phase !== 'done'; }
}
