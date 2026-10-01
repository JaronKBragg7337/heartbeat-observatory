// ============================================================================
// gunnerAI.js — an NPC on a gun. Pure: it reads where the hostile drones are, points the gun through the same
// GunSystem.point() a person's aim goes through (so the gun's arc limits apply to it exactly), and fires the same bolts.
//
// RULES IT KEEPS
//   * It shoots only at hostile drones that exist: none exist inside Mars's neutral airspace (see guns.js), so a crew
//     gun never fires there. It never shoots at the practice targets, the ground, or anything that is not a raider.
//   * It does not see a target the instant it appears: it takes `thinkDelay(skill)` seconds, and it aims a little off
//     (`aimErrorRad(skill)`), re-rolled each time it looks again. NPC crew are 70-85% as good as a person.
//   * It fires in bursts, and only when the gun is within 3 degrees of where it wants to point (inside its arc).
// ============================================================================

import { GUNS } from '../ship/shipSpec.js';
import { thinkDelay, aimErrorRad } from './crewSpec.js';

const RANGE_M = { main: 1100, dorsal: 900, ventral: 900 };
const MIN_RANGE_M = 40;

export class GunnerAI {
  constructor({ guns, flight, gunId, skill, rand }) {
    this.guns = guns; this.f = flight; this.gunId = gunId; this.skill = skill; this.rand = rand;
    this.t = 0; this.look = 0; this.seen = null; this.err = { x: 0, y: 0, z: 0 };
    this.burst = 0; this.rest = 0; this.shots = 0; this.lastDir = null;
  }

  /** @param D DroneSystem (or null) */
  update(dt, D) {
    this.t += dt; this.look -= dt;
    const G = this.guns, f = this.f, gid = this.gunId, spec = GUNS[gid];
    const pivotW = f.toWorld(spec.pivot, {});
    // (re)acquire: the nearest live raider within range, as it was `think` seconds ago
    if (this.look <= 0) {
      this.look = thinkDelay(this.skill);
      let best = null, bd = RANGE_M[gid];
      if (D && !D.neutral) for (const d of D.drones) {
        if (d.state === 'away' || d.state === 'dead' || d.target.hp <= 0 || d.target.inactive) continue;
        const dist = Math.hypot(d.pos.x - pivotW.x, d.pos.y - pivotW.y, d.pos.z - pivotW.z);
        if (dist < bd && dist > MIN_RANGE_M) { bd = dist; best = d; }
      }
      this.seen = best ? { d: best, at: this.t } : null;
      const e = aimErrorRad(this.skill) * (best ? bd : 0);          // metres of miss at that range
      this.err = { x: (this.rand() - 0.5) * 2 * e, y: (this.rand() - 0.5) * 2 * e, z: (this.rand() - 0.5) * 2 * e };
    }
    const s = this.seen;
    if (!s || !D || D.neutral || s.d.target.hp <= 0 || s.d.state === 'away' || s.d.state === 'dead') { this.seen = null; this.burst = 0; return false; }
    // where it will be when the bolt gets there (a lead from range and speed), plus the miss this look rolled
    const d = s.d, spd = G.stats(gid).speed;
    const dist0 = Math.hypot(d.pos.x - pivotW.x, d.pos.y - pivotW.y, d.pos.z - pivotW.z);
    const tof = dist0 / spd;
    const aimP = {
      x: d.pos.x + (d.vel.x - f.vel.x) * tof + this.err.x, y: d.pos.y + (d.vel.y - f.vel.y) * tof + this.err.y, z: d.pos.z + (d.vel.z - f.vel.z) * tof + this.err.z,
    };
    const dirW = unit({ x: aimP.x - pivotW.x, y: aimP.y - pivotW.y, z: aimP.z - pivotW.z });
    const dl = unitL(f.toLocal({ x: pivotW.x + dirW.x, y: pivotW.y + dirW.y, z: pivotW.z + dirW.z }, {}), spec.pivot);
    const raw = rawAngles(dl);
    const a = G.point(gid, dl);                                       // clamps to the arc: the aim the gun really has
    const off = Math.hypot(wrap(raw.yaw - a.yaw) * Math.cos(a.pitch), raw.pitch - a.pitch);
    if (off > 0.052) return false;                                    // the target is outside the gun's arc: it cannot bear
    // bursts: about a second of fire, then a breath
    if (this.rest > 0) { this.rest -= dt; return false; }
    if (this.burst <= 0) this.burst = 0.9 + this.rand() * 0.8;
    this.burst -= dt;
    if (this.burst <= 0) { this.rest = 0.7 + this.rand() * 1.0; return false; }
    const aimDir = f.dirToWorld(dirLocal(a), {});
    const n = G.fire(gid, aimDir, pivotW, true);
    if (n) this.shots++;
    return !!n;
  }
}

function unit(v) { const l = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x / l, y: v.y / l, z: v.z / l }; }
/** The local point relative to the pivot, as a direction. */
function unitL(p, pivot) { return unit({ x: p.x - pivot.x, y: p.y - pivot.y, z: p.z - pivot.z }); }
function dirLocal(a) { const cp = Math.cos(a.pitch); return { x: Math.sin(a.yaw) * cp, y: Math.sin(a.pitch), z: -Math.cos(a.yaw) * cp }; }
function rawAngles(d) { return { yaw: Math.atan2(d.x, -d.z), pitch: Math.asin(Math.max(-1, Math.min(1, d.y))) }; }
function wrap(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }
