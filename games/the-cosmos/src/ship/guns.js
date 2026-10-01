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
   * @param byCrew       a hired NPC gunner at that gun's own seat (src/crew): the crew system has checked the seat, so
   *                     the player's seat permission does not apply. Everything after it is the same.
   */
  fire(gunId, aimWorldDir, eyeWorld, byCrew = false) {
    if (!byCrew && !this.stations.mayFire(gunId)) return 0;
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

  /** Returns the target as stored, so a caller that keeps it sees the damage the bolts do to it. (It used to
   *  return the caller's own object while the list held a copy, and nothing the guns did ever reached it.) */
  addTarget(t) { const stored = { hp: 100, maxHp: 100, radius: 1.6, respawn: 0, ...t }; this.targets.push(stored); return stored; }

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
        if (t.hp <= 0 || t.inactive) continue;
        if (segSphere(b.px, b.py, b.pz, b.x, b.y, b.z, t.pos, t.radius)) {
          t.hp -= b.damage;
          this.events.push({ type: 'target_hit', id: t.id, x: b.x, y: b.y, z: b.z, hp: t.hp, gun: b.gun });
          if (t.hp <= 0) { t.respawn = t.respawnTime ?? 8; this.events.push({ type: 'target_down', id: t.id, x: t.pos.x, y: t.pos.y, z: t.pos.z }); }
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
      if (t.inactive) continue;
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

// ============================================================================
// Hostile drones. They give the shields something to do and the guns something
// to shoot at. Pure logic, in f64 world metres, like everything in this file.
//
// MARS IS NEUTRAL (Jaron, 2026-10-01). Inside the planet's airspace there are no
// drones: they do not patrol, they do not wait at anchors, nothing fires at the
// ship however low and however long it flies. They exist only beyond
// NEUTRAL_AIRSPACE_M of height above the ground. Climb through that line and
// raiders arrive from the horizon (the ship is told: "Leaving Mars neutral
// airspace"); come back under it and they break off and are gone ("Entering").
// The line has a margin (NEUTRAL_REENTRY_M) so riding it is not a flicker.
//
// Out there, a drone closes to strafing range and fires slow bolts at where the
// ship WILL be. A bolt that reaches the ship is handed to ShipBody.takeHit(), which
// spends the shield first and the hull second. Land, and the airspace is neutral
// again.
// ============================================================================

/** Height above the ground at which a ship leaves Mars's neutral airspace, metres. The one number. */
export const NEUTRAL_AIRSPACE_M = 1500;
/** To re-enter neutral airspace the ship must come back under this (a margin so the line does not flicker). */
export const NEUTRAL_REENTRY_M = 1400;
/** How far off the raiders appear, and how far they fly before they are gone when they break off. */
export const DRONE_ARRIVAL_M = 1400;

export class DroneSystem {
  /**
   * @param ship    ShipBody (hit target)
   * @param guns    GunSystem (drones are added to its target list, so the player's
   *                bolts can kill them)
   * @param ground  surface sampler, so a drone never dips below the terrain
   */
  constructor(ship, guns, ground) {
    this.ship = ship; this.guns = guns; this.ground = ground;
    this.drones = [];
    this.shots = [];
    this.events = [];
    this.t = 0;
    this.aggroM = 650;
    this.strafeM = 280;
    this.neutral = true;                 // true while the ship is inside Mars's neutral airspace
    this.suspended = false;              // a transit: the raiders cannot keep up with km/s, so they are not there (src/space/)
    this.onDown = null;                  // (drone) => void, once for each raider the player's guns bring down (the bounty hook)
  }

  /** Register a drone. It does not exist (state 'away') until the ship leaves neutral airspace. */
  add(id, anchor) {
    const d = {
      id, anchor: { ...anchor }, pos: { ...anchor }, vel: { x: 0, y: 0, z: 0 },
      state: 'away', cool: 1.5 + this.drones.length * 0.7, phase: this.drones.length * 2.1, target: null, held: false,
    };
    d.target = this.guns.addTarget({ id, pos: d.pos, radius: 3.2, hp: 60, maxHp: 60, respawnTime: 45, inactive: true });
    d.target.respawn = 0;
    this.drones.push(d);
    return d;
  }

  _up(p) { const r = Math.hypot(p.x, p.y, p.z) || 1; return { x: p.x / r, y: p.y / r, z: p.z / r }; }

  /** Height of the ship above the ground, metres (Infinity-safe). */
  shipAltitude() {
    const S = this.ship;
    if (S.landed) return 0;
    return Number.isFinite(S.agl) ? S.agl : 0;
  }

  /** Which airspace the ship is in, with the margin. Pure: no state change. */
  static airspaceFor(altitudeM, wasNeutral) {
    if (wasNeutral) return altitudeM > NEUTRAL_AIRSPACE_M ? 'hostile' : 'neutral';
    return altitudeM < NEUTRAL_REENTRY_M ? 'neutral' : 'hostile';
  }

  /** Put a drone out at the edge of what the ship can see, on a bearing of its own, at about the ship's height. */
  _arrive(d, i) {
    const S = this.ship, up = this._up(S.pos);
    const ref = Math.abs(up.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
    let ex = up.y * ref.z - up.z * ref.y, ey = up.z * ref.x - up.x * ref.z, ez = up.x * ref.y - up.y * ref.x;
    const el = Math.hypot(ex, ey, ez) || 1; ex /= el; ey /= el; ez /= el;
    const nx = up.y * ez - up.z * ey, ny = up.z * ex - up.x * ez, nz = up.x * ey - up.y * ex;
    const brg = d.phase + i * 2.094;                                   // three drones, spread round the compass
    const off = (i - 1) * 45;                                          // and at different heights
    const c = Math.cos(brg) * DRONE_ARRIVAL_M, sn = Math.sin(brg) * DRONE_ARRIVAL_M;
    d.pos.x = S.pos.x + ex * c + nx * sn + up.x * off;
    d.pos.y = S.pos.y + ey * c + ny * sn + up.y * off;
    d.pos.z = S.pos.z + ez * c + nz * sn + up.z * off;
    d.vel.x = d.vel.y = d.vel.z = 0;
    d.cool = 4 + i * 1.3;
    d.target.hp = d.target.maxHp; d.target.respawn = 0;
  }

  update(dt) {
    this.t += dt;
    const S = this.ship;

    // ---- a transit: nobody follows. The raiders are gone and come again (as on leaving neutral airspace) when it ends.
    if (this.suspended) {
      if (!this.neutral) { this.neutral = true; for (const d of this.drones) if (!d.held) { d.state = 'away'; d.target.inactive = true; } this.shots.length = 0; }
      return;
    }

    // ---- which airspace are we in? -----------------------------------------------------
    const alt = this.shipAltitude();
    const now = DroneSystem.airspaceFor(alt, this.neutral);
    if (now === 'hostile' && this.neutral) {
      this.neutral = false;
      this.events.push({ type: 'airspace', neutral: false, altitude: alt });
      this.drones.forEach((d, i) => { if (!d.held) { this._arrive(d, i); d.state = 'inbound'; d.target.inactive = false; } });
    } else if (now === 'neutral' && !this.neutral) {
      this.neutral = true;
      this.events.push({ type: 'airspace', neutral: true, altitude: alt });
      for (const d of this.drones) if (d.state !== 'away' && !d.held) d.state = 'leaving';
    }

    for (const d of this.drones) {
      const tg = d.target;
      if (d.held) continue;                                            // posed by hand (review shots)
      if (d.state === 'away') { tg.inactive = true; continue; }
      if (tg.hp <= 0) {
        // shot down. In neutral airspace it is simply gone; in hostile space it is replaced out at the
        // arrival ring once the guns' respawn timer has run.
        if (d.state !== 'dead' && d.state !== 'away') {
          if (this.onDown && !this.neutral) this.onDown(d);
          this.events.push({ type: 'drone_down', id: d.id });
        }
        d.state = this.neutral ? 'away' : 'dead';
        if (this.neutral) tg.inactive = true;
        continue;
      }
      if (d.state === 'dead') { this._arrive(d, this.drones.indexOf(d)); d.state = 'inbound'; tg.inactive = false; }
      const dx = S.pos.x - d.pos.x, dy = S.pos.y - d.pos.y, dz = S.pos.z - d.pos.z;
      const dist = Math.hypot(dx, dy, dz);
      if (d.state === 'leaving') {
        // break off: away from the ship at speed, then gone
        const k = 90 / (dist || 1);
        d.vel.x += (-dx * k - d.vel.x) * Math.min(1, dt * 1.5);
        d.vel.y += (-dy * k - d.vel.y) * Math.min(1, dt * 1.5);
        d.vel.z += (-dz * k - d.vel.z) * Math.min(1, dt * 1.5);
        d.pos.x += d.vel.x * dt; d.pos.y += d.vel.y * dt; d.pos.z += d.vel.z * dt;
        if (dist > DRONE_ARRIVAL_M * 1.4) { d.state = 'away'; tg.inactive = true; }
        continue;
      }
      d.state = dist < this.aggroM ? 'attack' : 'inbound';
      // close to a ring round the ship at strafing range, drifting round it
      const k = (dist - this.strafeM) / (dist || 1);
      const sw = Math.sin(this.t * 0.4 + d.phase);
      const kk0 = d.state === 'attack' ? 0.5 : 1;
      const tx = d.pos.x + dx * k * kk0 + (dz * sw) * 0.2;
      const ty = d.pos.y + dy * k * kk0;
      const tz = d.pos.z + dz * k * kk0 - (dx * sw) * 0.2;
      const ex = tx - d.pos.x, ey = ty - d.pos.y, ez = tz - d.pos.z;
      const el = Math.hypot(ex, ey, ez) || 1;
      const sp = d.state === 'attack' ? 38 : 75;
      const want = Math.min(sp, el * 0.6);
      d.vel.x += (ex / el * want - d.vel.x) * Math.min(1, dt * 1.2);
      d.vel.y += (ey / el * want - d.vel.y) * Math.min(1, dt * 1.2);
      d.vel.z += (ez / el * want - d.vel.z) * Math.min(1, dt * 1.2);
      d.pos.x += d.vel.x * dt; d.pos.y += d.vel.y * dt; d.pos.z += d.vel.z * dt;
      // never below 12 m over the ground
      const r = Math.hypot(d.pos.x, d.pos.y, d.pos.z);
      const gr = this.ground(d.pos.x / r, d.pos.y / r, d.pos.z / r);
      if (gr !== null && gr !== undefined && r < gr + 12) { const kk = (gr + 12) / r; d.pos.x *= kk; d.pos.y *= kk; d.pos.z *= kk; }
      // fire: only at a ship that is outside neutral airspace
      d.cool -= dt;
      if (d.state === 'attack' && !this.neutral && d.cool <= 0 && dist < this.aggroM * 0.8) {
        d.cool = 3.4 + Math.random() * 1.8;
        const speed = 100;
        const tt = dist / speed;
        const px = S.pos.x + S.vel.x * tt, py = S.pos.y + S.vel.y * tt, pz = S.pos.z + S.vel.z * tt;
        let ax = px - d.pos.x, ay = py - d.pos.y, az = pz - d.pos.z;
        const al = Math.hypot(ax, ay, az) || 1;
        ax /= al; ay /= al; az /= al;
        // a little inaccuracy
        ax += (Math.random() - 0.5) * 0.02; ay += (Math.random() - 0.5) * 0.02; az += (Math.random() - 0.5) * 0.02;
        this.shots.push({ x: d.pos.x, y: d.pos.y, z: d.pos.z, vx: ax * speed, vy: ay * speed, vz: az * speed, life: 9, damage: 12, px: d.pos.x, py: d.pos.y, pz: d.pos.z });
        this.events.push({ type: 'drone_fire', id: d.id, x: d.pos.x, y: d.pos.y, z: d.pos.z });
      }
    }
    // hostile bolts: none can be in flight in neutral airspace
    if (this.neutral && this.shots.length) this.shots.length = 0;
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const b = this.shots[i];
      b.px = b.x; b.py = b.y; b.pz = b.z;
      b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
      b.life -= dt;
      let dead = b.life <= 0;
      // hit the ship: distance from its centre (a 14 m sphere is a fair envelope for a 49 m hull)
      const c = S.toWorld({ x: 0, y: 3, z: 0 }, {});
      if (!dead && segSphere(b.px, b.py, b.pz, b.x, b.y, b.z, c, 15)) {
        const res = S.takeHit(b.damage);
        // where on the hull, in ship-local metres, for the shield ripple
        const loc = S.toLocal({ x: b.x, y: b.y, z: b.z }, {});
        this.events.push({ type: 'ship_hit', absorbed: res.absorbed, hull: res.hull, local: loc, x: b.x, y: b.y, z: b.z });
        dead = true;
      }
      if (!dead) {
        const r = Math.hypot(b.x, b.y, b.z);
        const g = this.ground(b.x / r, b.y / r, b.z / r);
        if (g !== null && g !== undefined && r <= g) { this.events.push({ type: 'impact', gun: 'enemy', x: b.x, y: b.y, z: b.z, ux: b.x / r, uy: b.y / r, uz: b.z / r, power: 0.6 }); dead = true; }
      }
      if (dead) this.shots.splice(i, 1);
    }
  }

  /** Pose a drone by hand for a review shot. It stays where it is put until released. */
  debugPose(i, pos, state = 'attack') {
    const d = this.drones[i];
    d.held = true; d.state = state; d.target.inactive = false; d.target.hp = d.target.maxHp;
    d.pos.x = pos.x; d.pos.y = pos.y; d.pos.z = pos.z; d.vel.x = d.vel.y = d.vel.z = 0;
    return d;
  }
  debugRelease(i) { const d = this.drones[i]; d.held = false; if (this.neutral) { d.state = 'away'; d.target.inactive = true; } }

  drain() { const e = this.events; this.events = []; return e; }
}
