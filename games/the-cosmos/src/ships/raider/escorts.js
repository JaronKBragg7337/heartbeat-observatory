// ============================================================================
// ships/raider/escorts.js - the drones that fly with a raider. They used to arrive alone from the horizon, three small drones at a time;
// now they are a raider's wing: they hold formation on it, and when it picks a target they break off and strafe that target while it
// fights. Pure logic in f64 world metres, like guns.js; no three.js, no DOM.
//
// RULES IT KEEPS (the same ones the old drones kept, Jaron 10/1)
//   * Mars is neutral: an escort fires only at a ship that is outside neutral airspace. The caller passes only such ships as targets.
//   * A bolt that reaches a ship is handed to ShipBody.takeHit(), which spends the shield first and the hull second.
//   * An escort is shot down like a drone: 60 hit points, and the bolts of whoever shoots it (the players' guns, through the
//     proxies the server adds to their target lists) take them away.
// ============================================================================

import { FIGHT, ESCORTS_PER_RAIDER } from './stats.js';

const segSphere = (ax, ay, az, bx, by, bz, c, r) => {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const fx = ax - c.x, fy = ay - c.y, fz = az - c.z;
  const a = dx * dx + dy * dy + dz * dz;
  if (a < 1e-12) return false;
  const b = 2 * (fx * dx + fy * dy + fz * dz);
  const cc = fx * fx + fy * fy + fz * fz - r * r;
  let disc = b * b - 4 * a * cc;
  if (disc < 0) return false;
  disc = Math.sqrt(disc);
  const t1 = (-b - disc) / (2 * a), t2 = (-b + disc) / (2 * a);
  return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1) || (t1 < 0 && t2 > 1);
};

/** Where in the leader's own frame each escort holds: out on the quarters, a little above, a little behind. */
export const FORMATION = [
  { x: -26, y: 7, z: 34 }, { x: 26, y: 7, z: 34 }, { x: 0, y: 16, z: 62 },
  { x: -48, y: 3, z: 70 }, { x: 48, y: 3, z: 70 },
];

export class EscortWing {
  constructor(prefix, n = ESCORTS_PER_RAIDER) {
    this.prefix = prefix;
    this.t = 0;
    this.shots = [];
    this.events = [];
    this.drones = Array.from({ length: n }, (_, i) => ({
      id: `${prefix}:escort-${i}`, i, pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 },
      hp: 60, maxHp: 60, state: 'form', cool: 2 + i * 0.9, phase: i * 2.1,
    }));
  }

  /** Put every escort in formation on the leader (a new raider, or one that has just rearmed). */
  gather(leader) {
    for (const d of this.drones) {
      const p = leader.toWorld(FORMATION[d.i % FORMATION.length], {});
      Object.assign(d.pos, p); Object.assign(d.vel, leader.vel);
      d.hp = d.maxHp; d.state = 'form';
    }
  }

  alive() { return this.drones.filter((d) => d.state !== 'dead' && d.state !== 'away'); }

  /**
   * @param leader  the raider's ShipBody
   * @param target  the ShipBody it is fighting, or null
   * @param targets every ship a stray bolt could hit (ShipBody with .def)
   * @param ground  (dx,dy,dz) -> surface radius
   * @param active  false once the raider is disabled: the wing breaks off and is gone
   */
  update(dt, leader, target, targets, ground, active = true) {
    this.t += dt;
    const drones = this.drones;
    for (const d of drones) {
      if (d.state === 'dead' || d.state === 'away') continue;
      if (!active) { d.state = 'leaving'; }
      let want, speed = FIGHT.escortSpeed;
      if (d.state === 'leaving') {
        // break off: away from the leader at speed, then gone
        const dx = d.pos.x - leader.pos.x, dy = d.pos.y - leader.pos.y, dz = d.pos.z - leader.pos.z, l = Math.hypot(dx, dy, dz) || 1;
        want = { x: d.pos.x + dx / l * 400, y: d.pos.y + dy / l * 400, z: d.pos.z + dz / l * 400 };
        if (l > 1600) { d.state = 'away'; continue; }
      } else if (target) {
        const dx = target.pos.x - d.pos.x, dy = target.pos.y - d.pos.y, dz = target.pos.z - d.pos.z, dist = Math.hypot(dx, dy, dz) || 1;
        d.state = dist < FIGHT.senseM ? 'attack' : 'form';
        if (d.state === 'attack') {
          // close to a ring round the target at strafing range, drifting round it
          const sw = Math.sin(this.t * 0.45 + d.phase), k = (dist - FIGHT.escortStrafeM) / dist;
          want = { x: d.pos.x + dx * k + dz * sw * 0.25, y: d.pos.y + dy * k, z: d.pos.z + dz * k - dx * sw * 0.25 };
          speed = dist > 700 ? 110 : 42;
        }
      } else d.state = 'form';
      if (d.state === 'form') want = leader.toWorld(FORMATION[d.i % FORMATION.length], {});
      const ex = want.x - d.pos.x, ey = want.y - d.pos.y, ez = want.z - d.pos.z, el = Math.hypot(ex, ey, ez) || 1;
      const sp = Math.min(speed, el * 0.8 + (d.state === 'form' ? Math.hypot(leader.vel.x, leader.vel.y, leader.vel.z) : 0));
      const kk = Math.min(1, dt * 1.4);
      const tvx = ex / el * sp + (d.state === 'form' ? leader.vel.x : 0), tvy = ey / el * sp + (d.state === 'form' ? leader.vel.y : 0), tvz = ez / el * sp + (d.state === 'form' ? leader.vel.z : 0);
      d.vel.x += (tvx - d.vel.x) * kk; d.vel.y += (tvy - d.vel.y) * kk; d.vel.z += (tvz - d.vel.z) * kk;
      d.pos.x += d.vel.x * dt; d.pos.y += d.vel.y * dt; d.pos.z += d.vel.z * dt;
      // never below 12 m over the ground
      const r = Math.hypot(d.pos.x, d.pos.y, d.pos.z) || 1, gr = ground(d.pos.x / r, d.pos.y / r, d.pos.z / r);
      if (gr !== null && gr !== undefined && r < gr + 12) { const q = (gr + 12) / r; d.pos.x *= q; d.pos.y *= q; d.pos.z *= q; }
      // fire
      d.cool -= dt;
      if (d.state === 'attack' && target && d.cool <= 0) {
        const dx = target.pos.x - d.pos.x, dy = target.pos.y - d.pos.y, dz = target.pos.z - d.pos.z, dist = Math.hypot(dx, dy, dz) || 1;
        if (dist < FIGHT.escortStrafeM * 2.6) {
          d.cool = 3.2 + ((d.i * 7 + Math.floor(this.t)) % 5) * 0.35;
          const speedB = 100, tt = dist / speedB;
          let ax = dx + target.vel.x * tt - d.vel.x * 0, ay = dy + target.vel.y * tt, az = dz + target.vel.z * tt;
          const al = Math.hypot(ax, ay, az) || 1;
          // a little inaccuracy, deterministic in the escort and the second so a replay is the same
          const j = (n) => Math.sin(this.t * 7.3 + d.i * 11.1 + n) * 0.012;
          ax = ax / al + j(1); ay = ay / al + j(2); az = az / al + j(3);
          this.shots.push({ x: d.pos.x, y: d.pos.y, z: d.pos.z, vx: ax * speedB, vy: ay * speedB, vz: az * speedB, life: 9, damage: FIGHT.escortShotDamage, px: d.pos.x, py: d.pos.y, pz: d.pos.z });
          this.events.push({ type: 'escort_fire', id: d.id, x: d.pos.x, y: d.pos.y, z: d.pos.z });
        }
      }
    }
    // bolts in flight: a hit on a ship is handed to its takeHit
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const b = this.shots[i];
      b.px = b.x; b.py = b.y; b.pz = b.z;
      b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
      b.life -= dt;
      let dead = b.life <= 0;
      if (!dead) for (const S of targets) {
        const env = (S.def && S.def.hull && S.def.hull.combat) || { centre: { x: 0, y: 3, z: 0 }, radius: 15 };
        const c = S.toWorld(env.centre, {});
        if (segSphere(b.px, b.py, b.pz, b.x, b.y, b.z, c, env.radius)) {
          const res = S.takeHit(b.damage);
          this.events.push({ type: 'ship_hit', by: 'escort', absorbed: res.absorbed, hull: res.hull, target: S, x: b.x, y: b.y, z: b.z });
          dead = true; break;
        }
      }
      if (!dead) {
        const r = Math.hypot(b.x, b.y, b.z) || 1, g = ground(b.x / r, b.y / r, b.z / r);
        if (g !== null && g !== undefined && r <= g) { this.events.push({ type: 'impact', gun: 'enemy', x: b.x, y: b.y, z: b.z, ux: b.x / r, uy: b.y / r, uz: b.z / r, power: 0.6 }); dead = true; }
      }
      if (dead) this.shots.splice(i, 1);
    }
  }

  /** Take damage from whoever shot it. Returns true when this killed it. */
  hit(d, dmg) {
    if (d.state === 'dead' || d.state === 'away') return false;
    d.hp -= dmg;
    if (d.hp <= 0) { d.hp = 0; d.state = 'dead'; this.events.push({ type: 'escort_down', id: d.id }); return true; }
    return false;
  }

  drain() { const e = this.events; this.events = []; return e; }

  save() { return { drones: this.drones.map((d) => ({ ...d, pos: { ...d.pos }, vel: { ...d.vel } })), shots: this.shots.map((s) => ({ ...s })), t: this.t }; }
  load(r) {
    if (!r) return this;
    this.t = r.t || 0;
    r.drones.forEach((q, i) => { const d = this.drones[i]; if (d) { Object.assign(d, q, { pos: { ...q.pos }, vel: { ...q.vel } }); } });
    this.shots = (r.shots || []).map((s) => ({ ...s }));
    return this;
  }
}
