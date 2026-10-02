// ============================================================================
// shipStations.js — who may operate what. The rule is one line long:
//
//     YOU CANNOT USE A STATION UNLESS YOU ARE SITTING IN ITS SEAT.
//
// OWNS: sitting, standing, and the permission check every station command goes
//       through. Nothing in the ship reads the keyboard or a button to decide
//       whether a gun fires or a throttle moves; it asks here.
// DOES NOT OWN: what the stations DO (flight is shipFlight.js, guns are
//       guns.js), or how they look.
//
// This is deliberately a plain object with no DOM and no three.js so the
// validator can prove the rule: it tries every command while standing (all
// refused), then sits in each seat and confirms only that seat's commands work.
// ============================================================================

import { SEATS, AVATAR } from './shipSpec.js';

/** Which commands each role may issue. */
export const ROLE_COMMANDS = {
  captain:     ['fly', 'fire_main', 'ramp', 'look'],
  pilot:       ['fly', 'ramp', 'look'],
  nav:         ['scan_range', 'look'],
  comms:       ['beacon', 'look'],
  engineer:    ['power', 'look'],
  gun_dorsal:  ['fire_turret', 'aim_turret', 'look'],
  gun_ventral: ['fire_turret', 'aim_turret', 'look'],
};

export const SIT_REACH_M = 1.5;

export class Stations {
  /**
   * @param ship  the ShipBody (flight) - controls are written to it only while seated
   * @param host  optional callbacks { onSit(seat), onStand(seat) }
   */
  constructor(ship, host = {}, def = null) {
    this.ship = ship;
    this.host = host;
    // FLEET: seats and which gun belongs to which seat come from the ship definition.
    this.SEATS = (def && def.seats) || SEATS;
    this.gunSeats = (def && def.gunSeats) || { dorsal: 'gun_dorsal', ventral: 'gun_ventral' };
    this.seated = null;               // seat id
    this.log = [];
    this.scanRangeIdx = 1;
    this.beacon = false;
    this.refused = 0;                 // how many commands were turned away, for the validator
  }

  seatDef(id) { return this.SEATS.find((s) => s.id === id) || null; }

  /** Nearest seat within reach of a ship-local position, or null. Standing only. */
  seatNear(local) {
    let best = null, bd = SIT_REACH_M;
    for (const s of this.SEATS) {
      // horizontal distance to the seat, and at about the same level
      const d = Math.hypot(local.x - s.x, local.z - s.z);
      if (d < bd && Math.abs(local.y - s.y) < 1.0) { best = s; bd = d; }
    }
    return best;
  }

  canSit(local) { return this.seated === null && !!this.seatNear(local); }

  /** Sit in the nearest seat. Returns the seat, or null if none is in reach or already seated. */
  sit(local) {
    if (this.seated !== null) return null;
    const s = this.seatNear(local);
    if (!s) return null;
    this.seated = s.id;
    if (this.host.onSit) this.host.onSit(s);
    return s;
  }

  stand() {
    if (this.seated === null) return null;
    const s = this.seatDef(this.seated);
    this.seated = null;
    // Letting go of the stick: the flight computer takes over.
    this.ship.controls.fwd = 0; this.ship.controls.lift = 0; this.ship.controls.yaw = 0;
    if (this.host.onStand) this.host.onStand(s);
    return s;
  }

  /** Is this command permitted right now? */
  allowed(command) {
    if (this.seated === null) return false;
    return ROLE_COMMANDS[this.seated].includes(command);
  }

  _refuse() { this.refused++; return false; }

  // ---- commands --------------------------------------------------------------------
  /** Flight: only the pilot and the captain. Values are -1..1. */
  fly(cmd) {
    if (!this.allowed('fly')) { this.ship.controls.fwd = 0; this.ship.controls.lift = 0; this.ship.controls.yaw = 0; return this._refuse(); }
    const c = this.ship.controls;
    c.fwd = clamp(cmd.fwd || 0); c.lift = clamp(cmd.lift || 0); c.yaw = clamp(cmd.yaw || 0);
    return true;
  }

  /** Engineering: move a power share. */
  power(key, value) {
    if (!this.allowed('power')) return this._refuse();
    this.ship.routePower(key, value);
    this.note(`Power routed: engines ${this.ship.power.engines}, guns ${this.ship.power.guns}, shields ${this.ship.power.shields}`);
    return true;
  }

  /** Engineering: set the whole split at once (a preset). */
  powerSplit(e, g, sh) {
    if (!this.allowed('power')) return this._refuse();
    this.ship.setPowerSplit(e, g, sh);
    this.note(`Power routed: engines ${this.ship.power.engines}, guns ${this.ship.power.guns}, shields ${this.ship.power.shields}`);
    return true;
  }

  scanRange(idx) {
    if (!this.allowed('scan_range')) return this._refuse();
    this.scanRangeIdx = ((idx % 3) + 3) % 3;
    return true;
  }

  transmitBeacon(on) {
    if (!this.allowed('beacon')) return this._refuse();
    this.beacon = !!on;
    this.note(on ? 'Beacon on: transmitting position on all bands. Nobody is listening.' : 'Beacon off.');
    return true;
  }

  /** May this seat fire this weapon? The gun system calls this before it spawns a bolt. */
  mayFire(gunId) {
    if (this.seated === null) return this._refuse();
    if (gunId === 'main') return this.allowed('fire_main') ? true : this._refuse();
    const seat = this.seatDef(this.seated);
    const gunSeat = this.gunSeats[gunId];
    return (seat.id === gunSeat && this.allowed('fire_turret')) ? true : this._refuse();
  }

  mayOperateRamp() { return this.allowed('ramp'); }

  note(msg, warn = false) {
    if (msg == null || msg === '') return;
    this.log.push({ t: this.ship.time, msg: String(msg), warn });
    if (this.log.length > 200) this.log.shift();
  }

  /** Camera limits for the seat you are in. */
  lookLimits() {
    const s = this.seated && this.seatDef(this.seated);
    if (!s) return null;
    return { yaw: s.lookYaw * Math.PI / 180, up: s.lookPitchUp * Math.PI / 180, down: s.lookPitchDown * Math.PI / 180 };
  }
}

const clamp = (v) => (v < -1 ? -1 : v > 1 ? 1 : v);
export { AVATAR };
