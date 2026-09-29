// ============================================================================
// guns.js — bolts that leave a barrel, fly, and hit the ground.
//
// OWNS: firing (rate, alternation, aim), projectile flight in f64 world metres,
//       and impact against the same ground surface the ship lands on.
// DOES NOT OWN: whether you MAY fire (shipStations.js decides that), or how a
//       bolt looks (gunFx.js).
//
// A bolt inherits the ship's velocity at the moment it leaves the barrel, so a
// ship moving at 40 m/s does not fire slower bolts backwards. Impact is a march
// along the bolt's path against the ground sampler, not a mesh raycast, so a
// bolt strikes the surface the player can see, and a hill hides what is behind
// it.
// ============================================================================

import { GUNS } from './shipSpec.js';

export const MAX_BOLTS = 160;
export const CONVERGE_M = 320;

export class GunSystem {
  /**
   * @param ship     ShipBody
   * @param stations Stations
   * @param ground   (dx,dy,dz) -> surface radius
   */
  constructor(ship, stations, ground) {
    this.ship = ship;
    this.stations = stations;
    this.ground = ground;
    this.bolts = [];
    this.events = [];
    this.cool = { main: 0, dorsal: 0, ventral: 0 };
    this.alt = { main: 0, dorsal: 0, ventral: 0 };
    this.shots = { main: 0, dorsal: 0, ventral: 0 };
    this.targets = [];
    // where each turret currently points, ship-local (yaw clockwise from the bow)
    this.aim = { main: { yaw: 0, pitch: 0 }, dorsal: { yaw: 0, pitch: 0 }, ventral: { yaw: 0, pitch: 0 } };
  }

  /** Effective rate and damage at the current power split. */
  stats(gunId) {
    const g = GUNS[gunId];
    const f = this.ship.gunFactor;
    return {
      rate: g.rate * (0.35 + 0.65 * Math.min(1.9, f)),
      damage: g.damage * Math.sqrt(Math.max(0.15, Math.min(1.9, f))),
      speed: g.speed,
    };
  }

  /** Clamp a ship-local aim direction to a gun's arc. Returns {yaw,pitch} in radians. */
  clampAim(gunId, dirLocal) {
    let yaw = Math.atan2(dirLocal.x, -dirLocal.z);
    let pitch = Math.asin(Math.max(-1, Math.min(1, dirLocal.y / (Math.hypot(dirLocal.x, dirLocal.y, dirLocal.z) || 1))));
    if (gunId === 'main') {
      const g = GUNS.main, d = Math.PI / 180;
      yaw = Math.max(-g.arcYawDeg * d, Math.min(g.arcYawDeg * d, yaw));
      pitch = Math.max(-g.arcPitchDownDeg * d, Math.min(g.arcPitchUpDeg * d, pitch));
    } else if (gunId === 'dorsal') {
      pitch = Math.max(-8 * Math.PI / 180, Math.min(85 * Math.PI / 180, pitch));
    } else {
      pitch = Math.max(-80 * Math.PI / 180, Math.min(15 * Math.PI / 180, pitch));
    }
    return { yaw, pitch };
  }

  /** Point a gun along a ship-local direction (clamped). */
  point(gunId, dirLocal) {
    const a = this.clampAim(gunId, dirLocal);
    this.aim[gunId] = a;
    return a;
  }

  /** Ship-local unit vector for an aim. */
  static dirFor(a) {
    const cp = Math.cos(a.pitch);
    return { x: Math.sin(a.yaw) * cp, y: Math.sin(a.pitch), z: -Math.cos(a.yaw) * cp };
  }

  /** World position of a gun's muzzle n. */
  muzzleWorld(gunId, n) {
    const G = GUNS[gunId];
    const m = G.muzzles[n % G.muzzles.length];
    if (gunId === 'main') return this.ship.toWorld(m);
    // turret muzzles are in the turret's frame: rotate by the aim, then place at the pivot
    const a = this.aim[gunId];
    const cy = Math.cos(a.yaw), sy = Math.sin(a.yaw), cp = Math.cos(a.pitch), sp = Math.sin(a.pitch);
    // barrel offset (m.x sideways, m.z along forward) turned by yaw, forward tilted by pitch
    const fx = Math.sin(a.yaw) * cp, fy = sp, fz = -Math.cos(a.yaw) * cp;
    const rx = Math.cos(a.yaw), rz = Math.sin(a.yaw);
    const len = -m.z;                       // muzzle sits this far along the barrel
    const lx = G.pivot.x + rx * m.x + fx * len, ly = G.pivot.y + fy * len, lz = G.pivot.z + rz * m.x + fz * len;
    return this.ship.toWorld({ x: lx, y: ly, z: lz });
  }

  /**
   * Try to fire. Refused unless the person is seated at the gun's own seat.
   * @param aimWorldDir  world-space unit vector the shooter is looking along
   * @param eyeWorld     world position of the shooter's eye (for convergence)
   */
  fire(gunId, aimWorldDir, eyeWorld) {
    if (!this.stations.mayFire(gunId)) return 0;
    if (this.cool[gunId] > 0) return 0;
    const st = this.stats(gunId);
    this.cool[gunId] = 1 / st.rate;
    const G = GUNS[gunId];
    const n = this.alt[gunId]++ % G.muzzles.length;
    const mz = this.muzzleWorld(gunId, n);
    // converge on a point far along the line of sight
    const T = { x: eyeWorld.x + aimWorldDir.x * CONVERGE_M, y: eyeWorld.y + aimWorldDir.y * CONVERGE_M, z: eyeWorld.z + aimWorldDir.z * CONVERGE_M };
    let dx = T.x - mz.x, dy = T.y - mz.y, dz = T.z - mz.z;
    const dl = Math.hypot(dx, dy, dz) || 1; dx /= dl; dy /= dl; dz /= dl;
    const v = this.ship.vel;
    if (this.bolts.length >= MAX_BOLTS) this.bolts.shift();
    this.bolts.push({
      gun: gunId, x: mz.x, y: mz.y, z: mz.z,
      vx: dx * st.speed + v.x, vy: dy * st.speed + v.y, vz: dz * st.speed + v.z,
      life: G.range / st.speed, damage: st.damage, px: mz.x, py: mz.y, pz: mz.z, power: this.ship.gunFactor,
    });
    this.shots[gunId]++;
    this.events.push({ type: 'muzzle', gun: gunId, x: mz.x, y: mz.y, z: mz.z, dx, dy, dz, n });
    return 1;
  }

  addTarget(t) { this.targets.push({ hp: 100, maxHp: 100, radius: 1.6, respawn: 0, ...t }); return t; }

  update(dt) {
    for (const k of Object.keys(this.cool)) this.cool[k] = Math.max(0, this.cool[k] - dt);
    const B = this.bolts;
    for (let i = B.length - 1; i >= 0; i--) {
      const b = B[i];
      b.px = b.x; b.py = b.y; b.pz = b.z;
      b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
      b.life -= dt;
      let dead = b.life <= 0;

      // targets first: segment vs sphere
      for (const t of this.targets) {
        if (t.hp <= 0) continue;
        if (segSphere(b.px, b.py, b.pz, b.x, b.y, b.z, t.pos, t.radius)) {
          t.hp -= b.damage;
          this.events.push({ type: 'target_hit', id: t.id, x: b.x, y: b.y, z: b.z, hp: t.hp, gun: b.gun });
          if (t.hp <= 0) { t.respawn = 8; this.events.push({ type: 'target_down', id: t.id, x: t.pos.x, y: t.pos.y, z: t.pos.z }); }
          dead = true; break;
        }
      }

      if (!dead) {
        // ground: sample along the step so a fast bolt cannot skip a ridge
        const steps = Math.max(1, Math.ceil(Math.hypot(b.x - b.px, b.y - b.py, b.z - b.pz) / 6));
        for (let s = 1; s <= steps; s++) {
          const f = s / steps;
          const x = b.px + (b.x - b.px) * f, y = b.py + (b.y - b.py) * f, z = b.pz + (b.z - b.pz) * f;
          const r = Math.hypot(x, y, z);
          const g = this.ground(x / r, y / r, z / r);
          if (g !== null && g !== undefined && r <= g) {
            // refine the crossing on the last sub-step
            let lo = (s - 1) / steps, hi = f;
            for (let it = 0; it < 8; it++) {
              const mid = (lo + hi) / 2;
              const mx = b.px + (b.x - b.px) * mid, my = b.py + (b.y - b.py) * mid, mz = b.pz + (b.z - b.pz) * mid;
              const mr = Math.hypot(mx, my, mz);
              const mg = this.ground(mx / mr, my / mr, mz / mr);
              if (mr <= mg) hi = mid; else lo = mid;
            }
            const ix = b.px + (b.x - b.px) * hi, iy = b.py + (b.y - b.py) * hi, iz = b.pz + (b.z - b.pz) * hi;
            const ir = Math.hypot(ix, iy, iz);
            this.events.push({ type: 'impact', gun: b.gun, x: ix, y: iy, z: iz, ux: ix / ir, uy: iy / ir, uz: iz / ir, power: b.power });
            dead = true; break;
          }
        }
      }
      if (dead) B.splice(i, 1);
    }
    for (const t of this.targets) {
      if (t.hp <= 0) { t.respawn -= dt; if (t.respawn <= 0) { t.hp = t.maxHp; this.events.push({ type: 'target_up', id: t.id }); } }
    }
  }

  /** Take and clear the events for the effects layer. */
  drain() { const e = this.events; this.events = []; return e; }
}

function segSphere(ax, ay, az, bx, by, bz, c, r) {
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
}
