// ============================================================================
// spaceTrip.js — one journey, from wherever the ship is to a destination, as a short list of phases:
//
//   lift      leave the ground (the crew rules still apply: ramp folded, the player aboard)
//   ascent    straight up on the lift pods until the air is gone (Mars: 120 km; a moon: 2.5 km)
//   transit   the main drive (transit.js): turn, burn, flip, brake, creep onto the standoff point
//   settle    hull eased back level, frame switched to the destination's, speed zero
//   descent   straight down on the flight assist (its flare is what makes the landing gentle) until landed
//
// OWNS: the phases, the stick values for the stick phases, the override that moves the ship in transit, and the sentences the
//       ship says along the way.
// DOES NOT OWN: the drive's rules (transit.js), the frames (spaceSystem.js), the hull and its physics (shipFlight.js).
// ============================================================================

import * as THREE from 'three';
import { Transit, turnToward } from './transit.js';
import { DRIVE, ATMOSPHERE_TOP_M, STANDOFF_M, RAIDER_SUSPEND_MS } from './spaceSpec.js';

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
    return { ok: true, phase: agl < 2200 ? (f.landed ? 'lift' : 'ascent') : 'transit' };
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
    // on a moon: straight up to 2.5 km, then the main drive
    const w = sp.moonWorld(sp.frameId), r = Math.hypot(f.pos.x, f.pos.y, f.pos.z);
    const agl = r - w.body.surfaceRadius(f.pos.x / r, f.pos.y / r, f.pos.z / r);
    f.climbCap = 70; c.lift = 1;
    this.progress.distM = Math.max(0, 2500 - agl);
    if (agl >= 2500) { f.climbCap = 12; this.phase = 'transit'; this._beginTransit(); return null; }
    return c;
  }

  _beginTransit() {
    const sp = this.space, f = this.f;
    sp.setFrame('mars');                                  // transit is in Mars's frame; the ship is moving or hovering when it switches
    const goal = this.dest.goalS(this);
    this.goalS = goal;
    const nose = new THREE.Vector3(f.fwdH.x, f.fwdH.y, f.fwdH.z);
    this.transit = new Transit({
      pos: f.pos, vel: f.vel, nose: { x: nose.x, y: nose.y, z: nose.z }, up: { x: f.up.x, y: f.up.y, z: f.up.z },
      goal, aMax: this._aMax(), vMax: DRIVE.vMaxMs, turnRate: DRIVE.turnRate,
    });
    f.attitude = new THREE.Quaternion().copy(f.quaternion);
    f.override = (dt) => this._drive(dt);
    f.autoHover = false;
    this.say(this.transit.legs.length ? 'Plotting a course round Mars first.' : 'Main drive lit. Hold on to something.', 'burn');
    this.progress.distM = this.transit.distance;
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
    f.pos.x = tr.pos.x; f.pos.y = tr.pos.y; f.pos.z = tr.pos.z;
    f.vel.x = tr.vel.x; f.vel.y = tr.vel.y; f.vel.z = tr.vel.z;
    // hull: nose along the thrust, up carried over from the level ship
    _a.set(tr.nose.x, tr.nose.y, tr.nose.z); _b.set(tr.up.x, tr.up.y, tr.up.z);
    _c.crossVectors(_a, _b).normalize();                  // right = fwd x up
    _b.crossVectors(_c, _a).normalize();                  // re-orthogonalise up
    const back = _a.clone().negate();
    _m.makeBasis(_c, _b, back);
    f.attitude.setFromRotationMatrix(_m);
    f.refreshOrientation();
    f.thrustFwd = f.maxDriveN * tr.thrust; f.thrustUp = 0; f.autoHover = false;
    f.landed = false; f.airborne = true; f.gearPos = Math.max(0, f.gearPos - dt * 0.5);
    f.agl = this._marsAlt();
    // raiders cannot keep up with a ship doing km/s: they do not follow a transit
    const dr = this.ship.drones; if (dr) dr.suspended = tr.speed > RAIDER_SUSPEND_MS;
    // progress for the readouts
    const D = Math.hypot(tr.finalGoal.x - tr.pos.x, tr.finalGoal.y - tr.pos.y, tr.finalGoal.z - tr.pos.z);
    this.progress.distM = D; this.progress.speed = tr.speed;
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
    f.vel.x = f.vel.y = f.vel.z = 0; f.thrustFwd = 0; f.autoHover = true;
    const dr = this.ship.drones; if (dr) dr.suspended = false;
    this.phase = 'settle'; this.settleT = 0;
    this._attFrom = f.attitude ? f.attitude.clone() : null;
    if (d.kind === 'moon') this.space.setFrame(d.moon);
    if (d.kind === 'port') f.heading = this.space.portHeading();
    this.say(d.kind === 'orbit' ? `On station over Mars.` : `Arrived over ${d.name}. Easing level.`, 'arrive');
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
      if (this.dest.kind === 'orbit' || this.dest.kind === 'hold') {
        // nowhere to come down to: hold here (the flight assist hovers the ship against whatever pull there is)
        this._finishHere(this.dest.kind === 'hold' ? `Stopped. Holding ${fmtKm(this._marsAlt())} above Mars.` : `Holding over Mars at ${fmtKm(this._marsAlt())}.`);
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
      const vh = { x: tr.vel.x / v, y: tr.vel.y / v, z: tr.vel.z / v };
      const goal = { x: tr.pos.x + vh.x * d, y: tr.pos.y + vh.y * d, z: tr.pos.z + vh.z * d };
      this.dest = { id: 'hold', kind: 'hold', name: 'a stop', goalS: () => goal };
      this.transit = new Transit({ pos: tr.pos, vel: tr.vel, nose: tr.nose, up: tr.up, goal, aMax: tr.aMax, vMax: tr.vMax, turnRate: tr.turnRate });
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
    f.override = null; this.transit = null; f.autoHover = true; f.climbCap = 12; f.thrustFwd = 0; f.thrustDown = false;
    const dr = this.ship.drones; if (dr) dr.suspended = false;
    if (f.attitude) { this.phase = 'settle'; this.settleT = 0; this._attFrom = f.attitude.clone(); this.dest = { ...this.dest, kind: 'orbit', name: 'here' }; }
    else this.phase = 'done';
    this.cancelled = true;
    this.say(msg || 'Course cancelled. Holding.', 'cancel2', true);
  }

  get active() { return this.phase !== 'done'; }
}
