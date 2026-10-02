// ============================================================================
// ships/raider/brain.js - how a raider flies and fights. Pure logic on the ship's own ShipBody and GunSystem: it writes the same three
// control numbers a person at the stick would (fwd, lift, yaw) and fires through the same GunSystem.fire() the crew guns use. No
// three.js of its own, no DOM, nothing about a server: the server runs it for every raider in the shared world.
//
// WHAT A RAIDER DOES
//   patrol    flies a slow circle at its station (outside Mars neutral airspace: high over the port, or over Phobos or Deimos),
//             with its escorts on its quarters. It mends a little while it waits.
//   engage    a ship in HOSTILE airspace comes inside its sensor range: it turns on it and makes strafing runs, nose guns on the
//             approach, turret on whatever bears; it breaks away after each pass, comes round and goes again.
//   return    the target drops into neutral airspace (lands, or comes under the line), or gets too far, or the raider is hurt: it
//             breaks off and goes home to its station.
//   disabled  hull at DISABLED_HULL or below: the drive is dead, the guns are silent, the crew have given up. It hangs where it is.
//   abandoned the hull is gone (or it was found that way): nobody aboard. Either is there for the taking (server/authority.mjs).
//
// Mars is neutral (Jaron, 10/1): a raider never fires at a ship that is not in hostile airspace; the caller passes only those as targets.
// ============================================================================

import { GunnerAI } from '../../crew/gunnerAI.js';
import { DISABLED_HULL, FIGHT } from './stats.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const dist3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/** The persistent part of a raider's mind: what it is doing and who it is doing it to. */
export function newNpcRecord(o) {
  return { name: o.name, seq: o.seq, station: o.station, state: o.state || 'patrol', targetId: null, phase: o.phase ?? 0, runT: 0, runSeq: 0, lootCredits: o.lootCredits || 0, spawnedAt: o.spawnedAt || 0, escorts: null };
}

export class RaiderBrain {
  /**
   * @param flight  the raider's ShipBody
   * @param guns    its GunSystem
   * @param record  the ship record (record.npc is the persistent mind; record.crew the people at the stations)
   * @param rand    () => 0..1
   */
  constructor({ flight, guns, record, rand = Math.random }) {
    this.f = flight; this.guns = guns; this.rec = record; this.rand = rand;
    this.events = [];
    this.gunners = new Map();
    this.pseudo = { state: 'attack', pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 }, target: { hp: 1, inactive: false } };
    this.D = { neutral: false, drones: [this.pseudo] };
    this._gun();
  }

  get npc() { return this.rec.npc; }
  get state() { return this.rec.npc.state; }
  get live() { return this.state === 'patrol' || this.state === 'engage' || this.state === 'return'; }

  /** Seat a gunner AI on each gun whose crew member is still aboard. (Called again when the crew changes.) */
  _gun() {
    this.gunners.clear();
    const gunOf = { captain: 'main', gunner_dorsal: 'dorsal' };
    for (const c of this.rec.crew) {
      const gid = gunOf[c.role];
      if (!gid || c.status !== 'aboard') continue;
      this.gunners.set(c.id, new GunnerAI({ guns: this.guns, flight: this.f, gunId: gid, skill: c.skill || 0.8, rand: this.rand }));
    }
  }

  /** The hull has gone below the line, or to nothing: change state, once. */
  _damage() {
    const f = this.f, n = this.npc;
    if (!this.live && n.state !== 'disabled') return;
    if (f.hull <= 0 && n.state !== 'abandoned') {
      n.state = 'abandoned'; n.targetId = null;
      this.events.push({ type: 'abandoned' });
      return;
    }
    if (f.hull <= DISABLED_HULL && this.live) {
      n.state = 'disabled'; n.targetId = null;
      for (const c of this.rec.crew) if (c.status === 'aboard') c.status = 'surrendered';
      this.events.push({ type: 'disabled' });
    }
  }

  /**
   * One tick. Returns the controls to apply to the flight, and fires the guns itself.
   * @param world { station:{centre, ring, agl}, targets:[{id, flight, hostile}] }
   */
  think(dt, world) {
    const f = this.f, n = this.npc;
    this._damage();
    if (n.state === 'disabled' || n.state === 'abandoned') {
      for (const c of this.rec.crew) if (n.state === 'disabled' && c.status === 'aboard') c.status = 'surrendered';
      return { fwd: 0, lift: 0, yaw: 0 };
    }
    const fr = f._frame;
    const bearingTo = (p) => {
      const dx = p.x - f.pos.x, dy = p.y - f.pos.y, dz = p.z - f.pos.z;
      return Math.atan2(dx * fr.east.x + dy * fr.east.y + dz * fr.east.z, dx * fr.north.x + dy * fr.north.y + dz * fr.north.z);
    };
    const hostile = world.targets.filter((t) => t.hostile && t.flight.hull > 0);
    let target = null;
    if (n.targetId) target = hostile.find((t) => t.id === n.targetId) || null;
    if (n.targetId && (!target || dist3(target.flight.pos, f.pos) > FIGHT.breakoffM)) { n.targetId = null; target = null; if (n.state === 'engage') { n.state = 'return'; this.events.push({ type: 'breakoff' }); } }

    // acquire: the nearest hostile ship inside sensor range, unless it is too hurt to try
    if (!target && f.hull >= FIGHT.retreatHull) {
      let best = null, bd = FIGHT.senseM;
      for (const t of hostile) { const d = dist3(t.flight.pos, f.pos); if (d < bd) { bd = d; best = t; } }
      if (best) { target = best; n.targetId = best.id; n.state = 'engage'; n.runT = 0; this.events.push({ type: 'engage', target: best.id }); }
    }
    if (n.state === 'engage' && f.hull < FIGHT.retreatHull) { n.state = 'return'; n.targetId = null; target = null; this.events.push({ type: 'retreat' }); }

    const c = { fwd: 0, lift: 0, yaw: 0 };
    if (n.state === 'engage' && target) {
      const T = target.flight, d = dist3(T.pos, f.pos);
      // strafing runs: about eight seconds in, then a hard break away for six, then round again
      n.runT += dt;
      const cycle = n.runT % 14;
      let brg = bearingTo(T.pos), err = wrap(brg - f.heading);
      let yaw, fwd;
      if (cycle < 8 || d > FIGHT.closeM * 1.8) {
        yaw = clamp(err * 2.2, -1, 1);
        fwd = clamp((d - FIGHT.closeM * 0.4) / 320, -0.2, 1) * (Math.abs(err) < 0.7 ? 1 : 0.35);
        if (d < FIGHT.closeM * 0.5) fwd = 0.9;                          // never stop in front of a ship: keep the speed up and go past
      } else {
        yaw = (n.runSeq % 2 ? -1 : 1) * 0.9; fwd = 1;                   // break away, turn the other way each pass
      }
      if (cycle >= 13.9) n.runSeq++;
      c.yaw = yaw; c.fwd = fwd;
      const wantAgl = clamp((T.agl || 0) + 25, 300, world.station.agl + 2500);
      c.lift = clamp((wantAgl - f.agl) / 70, -1, 1);
      // guns: whoever can see it
      Object.assign(this.pseudo.pos, T.pos); Object.assign(this.pseudo.vel, T.vel);
      this.pseudo.target.hp = T.hull > 0 ? 1 : 0;
      for (const g of this.gunners.values()) g.update(dt, this.D);
    } else {
      // patrol (or return): a slow circle at the station; "return" first makes for it
      const C = world.station.centre, R = world.station.ring;
      const dx = f.pos.x - C.x, dy = f.pos.y - C.y, dz = f.pos.z - C.z;
      const e = dx * fr.east.x + dy * fr.east.y + dz * fr.east.z, nn = dx * fr.north.x + dy * fr.north.y + dz * fr.north.z;
      const r = Math.hypot(e, nn);
      if (n.state === 'return' && r < R * 1.15 && f.agl > world.station.agl * 0.6) { n.state = 'patrol'; this.events.push({ type: 'home' }); }
      let hd;
      if (n.state === 'return' || r > R * 1.6) hd = Math.atan2(-e, -nn);        // straight home
      else {
        const ang = Math.atan2(e, nn) + 0.35;                                     // a point a little further round the circle
        hd = Math.atan2(R * Math.sin(ang) - e, R * Math.cos(ang) - nn);
      }
      c.yaw = clamp(wrap(hd - f.heading) * 2.0, -1, 1);
      c.fwd = (n.state === 'return' ? 0.9 : 0.42) * (Math.abs(wrap(hd - f.heading)) < 0.8 ? 1 : 0.3);
      c.lift = clamp((world.station.agl - f.agl) / 80, -1, 1);
      // mending while it waits
      if (n.state === 'patrol' && f.hull < 100) f.hull = Math.min(100, f.hull + dt * 0.4);
      for (const g of this.gunners.values()) { g.seen = null; g.burst = 0; }
    }
    return c;
  }

  drain() { const e = this.events; this.events = []; return e; }
}
