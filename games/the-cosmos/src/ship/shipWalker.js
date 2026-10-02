// ============================================================================
// shipWalker.js — a body standing on the ship, in the ship's own frame.
//
// OWNS: the player's position while aboard, expressed in SHIP-LOCAL metres, and
//       everything that decides where they may stand: decks, stairs, ramps,
//       ladders, doorways, furniture.
// DOES NOT OWN: the planet walker (walker.js keeps the planet frame and is not
//       touched), the ship's motion (shipFlight.js), or how any of it looks.
//
// THE FRAME, AND WHY THIS IS NOT A HACK
// -------------------------------------
// A person on a moving ship is not standing on the planet. Their position is a
// point in the ship's frame; the world position is DERIVED, every frame, as
//     world = ship.position + rotate(ship.orientation, local)
// so when the ship lifts off, accelerates, banks or lands, the player's local
// coordinates do not change at all. Nothing is applied to them. They are simply
// carried, exactly as they would be on a ship with inertial dampers. Because the
// deck plates carry their own gravity (see DECK_GRAVITY), the floor stays
// "down" for them whatever the hull is doing.
//
// WALKABLE SPACE IS THE UNION OF ZONES
// ------------------------------------
// Rather than testing a capsule against every wall, the walkable area is a list
// of flat rectangles (a room floor, a doorway, a stair) each with a floor height
// function. A point may stand where some zone covers it and the floor there is
// within a step of the feet. A wall is simply the absence of a zone. This makes
// "you can walk through what you can see through" a property of one list.
// ============================================================================

import { buildLayout, AVATAR, STAIRS, RAMPS, stairFloor, propBox, DECK } from './shipSpec.js';

/** Deck plating gravity, m/s^2. One Earth gravity: crew comfort plating. */
export const DECK_GRAVITY = 9.80665;

const R = AVATAR.radiusM - 0.03;           // 0.25 m, a shoulder
const STEP = AVATAR.stepM;
const H = AVATAR.heightM;

export class ShipGeometryIndex {
  /**
   * Everything the walker asks about, built once from the layout.
   */
  constructor(layout = buildLayout()) {
    this.layout = layout;
    this.zones = [];
    this.obstacles = [];
    this._build();
  }

  _build() {
    const L = this.layout;
    const Z = this.zones;

    // Room floors.
    for (const r of L.rooms) {
      const holes = (r.zoneHoles || []).concat(r.floorHoles || []);
      Z.push({ id: r.id, x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1,
        floor: r.y, ceil: r.y + r.h, holes, kind: 'room', room: r.id });
    }
    // FLEET: stairs come from the layout (a raider has none). The Meridian's cargo stair is a solid wedge: nothing walkable
    // under it at floor level (its last three steps are left out of the hole so you can step on and off at the bottom).
    const ST = L.stairs || {};
    const sc = ST.cargo, su = ST.up;
    if (sc) {
      const cargoZone = Z.find((z) => z.id === sc.room);
      cargoZone.holes.push({ x0: sc.x0, x1: sc.x1, z0: sc.zHigh, z1: sc.zLow - 0.6 });
    }

    // Stairs: sloped floors, and a ceiling that follows them up.
    // (The top reaches 0.7 m back into the corridor so the two floors overlap
    //  once each is pulled in by the shoulder radius; the floor there is flat.)
    if (su) Z.push({ id: su.id, x0: su.x0, x1: su.x1, z0: su.zHigh - 0.7, z1: su.zLow + 0.35,
      floor: (x, z) => stairFloor(su, z), ceil: (x, z) => stairFloor(su, z) + DECK.clear,
      holes: [], kind: 'stair', room: su.id });
    if (sc) Z.push({ id: sc.id, x0: sc.x0, x1: sc.x1, z0: sc.zHigh - 0.7, z1: sc.zLow + 0.2,
      floor: (x, z) => stairFloor(sc, z), ceil: (x, z) => Math.min(5.5, stairFloor(sc, z) + DECK.clear),
      holes: [], kind: 'stair', room: sc.room });

    // Doorways: a thin connector across the wall so two rooms join.
    for (const d of L.doors) {
      if (d.kind === 'outer' || d.noZone) continue;           // outer: the airlock; noZone: a stair carries itself
      const ext = 0.9, half = d.w / 2 + 0.1;
      const z = d.axis === 'x'
        ? { x0: d.at - ext, x1: d.at + ext, z0: d.c - half, z1: d.c + half }
        : { x0: d.c - half, x1: d.c + half, z0: d.at - ext, z1: d.at + ext };
      Z.push({ id: d.id, ...z, floor: d.y, ceil: d.y + d.h + 0.2, holes: [], kind: 'door', door: d.id,
        gate: d.gate || (d.id === 'd_airlock_in' ? 'airlock_inner' : null) });
    }
    // Airlock outer doorway, only walkable while the outer door is open.
    const od = L.doors.find((d) => d.kind === 'outer');
    if (od) {
      Z.push({ id: 'door_outer', x0: od.at - 0.9, x1: od.at + 0.6, z0: od.c - od.w / 2 - 0.1, z1: od.c + od.w / 2 + 0.1,
        floor: 0, ceil: 2.4, holes: [], kind: 'door', gate: 'airlock_outer' });
    }
    // Dais, ventral pit
    for (const e of L.extraZones) {
      Z.push({ id: e.id, x0: e.x0, x1: e.x1, z0: e.z0, z1: e.z1, floor: e.floor, ceil: e.ceil, holes: [], kind: e.kind, room: e.room });
    }

    // Furniture.
    for (const p of L.props) {
      if (!p.blocks) continue;
      const b = propBox(p);
      // A round thing blocks a slightly smaller plan, it is easier to slide round.
      this.obstacles.push({ ...b, id: p.kind, room: p.room });
    }
    // The lower rungs' ladder hatches and the two ladders themselves are not obstacles.
  }
}

const _index = new ShipGeometryIndex();
export const shipIndex = _index;
/** FLEET: the walkable geometry of any ship definition, built once and kept. */
const _byType = new Map([['meridian', _index]]);
export function shipIndexFor(def) {
  if (!def) return _index;
  if (!_byType.has(def.type)) _byType.set(def.type, new ShipGeometryIndex(def.layout));
  return _byType.get(def.type);
}

const floorOf = (z, x, zz) => (typeof z.floor === 'function' ? z.floor(x, zz) : z.floor);
const ceilOf = (z, x, zz) => (typeof z.ceil === 'function' ? z.ceil(x, zz) : z.ceil);

function inRect(z, x, zz, shrink) {
  return x >= z.x0 + shrink && x <= z.x1 - shrink && zz >= z.z0 + shrink && zz <= z.z1 - shrink;
}
function inHole(z, x, zz) {
  for (const h of z.holes) {
    if (x > h.x0 - R && x < h.x1 + R && zz > h.z0 - R && zz < h.z1 + R) return true;
  }
  return false;
}

export class ShipWalker {
  /**
   * @param {object} state  ship state read by dynamic zones:
   *    ramps: { cargo:{lowered,angle,progress}, airlock:{...} }, airlock:{outerOpen}
   */
  constructor(index = _index, state = null) {
    this.index = index;
    this.state = state || defaultState();

    // Position of the feet, ship-local metres.
    this.x = 0; this.y = 3.0; this.z = 0;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.yaw = 0; this.pitch = 0;          // yaw: clockwise from the bow, radians
    this.grounded = true;
    this.zoneId = null;
    this.ladder = null;                    // { def, dir }
    this.walkSpeed = 2.1; this.runSpeed = 4.2; this.jumpSpeed = 3.1;
    this.events = [];
  }

  eyeLocal(out = {}) { out.x = this.x; out.y = this.y + AVATAR.eyeM; out.z = this.z; return out; }

  place(x, y, z, yaw = 0) {
    this.x = x; this.y = y; this.z = z; this.yaw = yaw; this.pitch = 0;
    this.vx = this.vy = this.vz = 0; this.grounded = true; this.ladder = null;
    this.zoneId = null;
  }

  // ---- dynamic zones (ramps, airlock door) ---------------------------------
  _dynamicZones() {
    const out = [];
    const st = this.state;
    for (const key of ['cargo', 'airlock']) {
      const rp = st.ramps[key];
      if (!rp || !rp.lowered) continue;
      const def = this.index.layout.ramps[key];
      const t = Math.tan(rp.angle), c = Math.cos(rp.angle);
      const run = def.length * c;
      const hw = def.width / 2;
      if (def.dir.z) {           // cargo: along +Z
        // The zone reaches back into the bay so it overlaps the bay floor.
        out.push({ id: def.id, x0: def.hinge.x - hw, x1: def.hinge.x + hw,
          z0: def.hinge.z - 0.9, z1: def.hinge.z + run + R + .1,
          floor: (x, z) => def.hinge.y - Math.max(0, Math.min(run, z - def.hinge.z)) * t,
          ceil: (x, z) => def.hinge.y - Math.max(0, z - def.hinge.z) * t + 4,
          holes: [], kind: 'ramp', ramp: key });
      } else {                   // airlock gangway: along -X
        out.push({ id: def.id, x0: def.hinge.x - run - R - .1, x1: def.hinge.x + 0.9,
          z0: def.hinge.z - hw, z1: def.hinge.z + hw,
          floor: (x) => def.hinge.y - Math.max(0, Math.min(run, def.hinge.x - x)) * t,
          ceil: (x) => def.hinge.y - Math.max(0, def.hinge.x - x) * t + 4,
          holes: [], kind: 'ramp', ramp: key });
      }
    }
    return out;
  }

  /** Every zone that is currently open. */
  activeZones() {
    const zs = [];
    for (const z of this.index.zones) {
      if (z.gate === 'airlock_outer' && !this.state.airlock.outerOpen) continue;
      if (z.gate === 'airlock_inner' && !this.state.airlock.innerOpen) continue;
      zs.push(z);
    }
    return zs.concat(this._dynamicZones());
  }

  /**
   * The floor under (x, z) for a body whose feet are at y.
   * Highest floor that is no more than a step above the feet, and whose ceiling
   * is above them. Returns { floor, ceil, zone } or null when there is no floor
   * at all — which is what a wall is.
   */
  support(x, y, z, zones = this.activeZones()) {
    let best = null;
    for (let i = 0; i < zones.length; i++) {
      const zn = zones[i];
      if (!inRect(zn, x, z, R)) continue;
      if (zn.holes.length && inHole(zn, x, z)) continue;
      const f = floorOf(zn, x, z);
      if (f > y + STEP) continue;
      const c = ceilOf(zn, x, z);
      if (y + 0.05 >= c) continue;
      if (!best || f > best.floor) best = { floor: f, ceil: c, zone: zn };
    }
    return best;
  }

  /** Is a furniture box in the way of a body at (x, y, z)? */
  blocked(x, y, z) {
    const obs = this.index.obstacles;
    for (let i = 0; i < obs.length; i++) {
      const o = obs[i];
      if (y + H <= o.y0 + 0.02 || y >= o.y1 - 0.02) continue;      // clear above or below
      // circle vs box
      const cx = Math.max(o.x0, Math.min(x, o.x1));
      const cz = Math.max(o.z0, Math.min(z, o.z1));
      const dx = x - cx, dz = z - cz;
      if (dx * dx + dz * dz < R * R * 0.9) return true;
    }
    return false;
  }

  /** Would this position be legal? Returns the support or null. */
  canStand(x, y, z, zones) {
    const s = this.support(x, y, z, zones);
    if (!s) return null;
    if (this.blocked(x, y, z)) return null;
    return s;
  }

  // ---- ladders --------------------------------------------------------------
  _ladderCheck(move) {
    const L = this.index.layout;
    if (Math.hypot(move.x, move.z) < 0.25) return null;
    for (const d of L.ladders) {
      const atBottom = Math.abs(this.y - d.y0) < 0.45 && Math.hypot(this.x - d.bottom.x, this.z - d.bottom.z) < 0.6;
      const topRef = d.topEnter || d.topExit;
      const atTop = Math.abs(this.y - d.y1) < 0.45 && Math.hypot(this.x - topRef.x, this.z - topRef.z) < 0.65;
      if (atBottom) {
        // must be pushing toward the rungs
        const toX = d.x - this.x, toZ = d.z - this.z;
        if (move.x * toX + move.z * toZ > 0 || Math.hypot(toX, toZ) < 0.25) return { def: d, from: 'bottom', dir: 1 };
      }
      if (atTop) {
        const toX = d.x - this.x, toZ = d.z - this.z;
        if (move.x * toX + move.z * toZ > 0) return { def: d, from: 'top', dir: -1 };
      }
    }
    return null;
  }

  /**
   * @param dt seconds
   * @param input { moveX (right +), moveZ (forward +), run, jump, up }
   */
  tick(dt, input = {}) {
    this.events.length = 0;
    const fwd = { x: Math.sin(this.yaw), z: -Math.cos(this.yaw) };
    const rgt = { x: Math.cos(this.yaw), z: Math.sin(this.yaw) };
    const mX = clamp(input.moveX || 0, -1, 1), mZ = clamp(input.moveZ || 0, -1, 1);
    const mag = Math.hypot(mX, mZ);
    const nX = mag > 1 ? mX / mag : mX, nZ = mag > 1 ? mZ / mag : mZ;
    const speed = input.run ? this.runSpeed : this.walkSpeed;
    const wishX = (fwd.x * nZ + rgt.x * nX) * speed;
    const wishZ = (fwd.z * nZ + rgt.z * nX) * speed;

    // --- Ladder: its own little world -----------------------------------------
    if (this.ladder) {
      const d = this.ladder.def;
      this.vx = this.vz = 0;
      this.x = d.x; this.z = d.z;
      this.yaw = Math.atan2(d.face.x, -d.face.z);
      // Forward means "continue the way you came on": up if you stepped on at the
      // bottom, down if you stepped on at the top. Back reverses it.
      const climb = nZ * 1.5 * this.ladder.dir;
      this.y += climb * dt;
      if (input.jump) { this.ladder = null; this.grounded = false; this.vy = 0; return; }
      if (this.y >= d.y1) {
        this.x = d.topExit.x; this.z = d.topExit.z; this.y = d.topExit.y;
        this.yaw = Math.atan2(-d.face.x, d.face.z);           // turn round to face the deck
        this.ladder = null; this.grounded = true; this.events.push('ladder_top');
      } else if (this.y <= d.y0) {
        this.x = d.bottomExit.x; this.z = d.bottomExit.z; this.y = d.bottomExit.y;
        this.ladder = null; this.grounded = true; this.events.push('ladder_bottom');
      }
      return;
    }
    const lc = this._ladderCheck({ x: wishX, z: wishZ });
    if (lc && this.grounded) {
      this.ladder = lc;
      const d = lc.def;
      this.x = d.x; this.z = d.z;
      this.y = lc.from === 'top' ? d.y1 - 0.05 : Math.max(d.y0, this.y);
      this.vx = this.vz = this.vy = 0;
      this.events.push('ladder_on');
      return;
    }

    // --- Horizontal velocity. -------------------------------------------------
    const accel = this.grounded ? 14 : 2.0;
    const k = Math.min(1, accel * dt);
    this.vx += (wishX - this.vx) * k;
    this.vz += (wishZ - this.vz) * k;

    const zones = this.activeZones();
    // Try the full move, then each axis alone so a wall slides instead of sticks.
    let nx = this.x + this.vx * dt, nz = this.z + this.vz * dt;
    let s = this.canStand(nx, this.y, nz, zones);
    if (!s) {
      // Pushing against the end of a lowered ramp asks to leave the ship.
      this._exitCheck(wishX, wishZ);
      const sx = this.canStand(this.x + this.vx * dt, this.y, this.z, zones);
      const sz = this.canStand(this.x, this.y, this.z + this.vz * dt, zones);
      if (sx) { nx = this.x + this.vx * dt; nz = this.z; s = sx; this.vz *= 0.2; }
      else if (sz) { nx = this.x; nz = this.z + this.vz * dt; s = sz; this.vx *= 0.2; }
      else {
        nx = this.x; nz = this.z; s = this.support(nx, this.y, nz, zones);
        this.vx *= 0.2; this.vz *= 0.2;
      }
    }

    this.x = nx; this.z = nz;

    // --- Vertical. -------------------------------------------------------------
    if (this.grounded) {
      if (input.jump) {
        this.vy = this.jumpSpeed; this.grounded = false; this.y += 0.01;
      } else if (s) {
        const drop = this.y - s.floor;
        if (drop <= 0.4 + Math.hypot(this.vx, this.vz) * dt * 1.5) { this.y = s.floor; this.vy = 0; }
        else { this.grounded = false; this.vy = 0; }
      } else { this.grounded = false; }
    }
    if (!this.grounded) {
      this.vy -= DECK_GRAVITY * dt;
      this.y += this.vy * dt;
      const sp = this.support(this.x, this.y + 0.02, this.z, zones);
      if (sp && this.y <= sp.floor) { this.y = sp.floor; this.vy = 0; this.grounded = true; this.events.push('land'); }
      else if (!sp && this.y < -6) { this.y = -6; this.vy = 0; }
    }
    // Ceiling.
    const sc = this.support(this.x, this.y, this.z, zones);
    if (sc && this.y + H > sc.ceil) { this.y = sc.ceil - H; if (this.vy > 0) this.vy = 0; }
    this.zoneId = sc ? sc.zone.id : this.zoneId;
    this.zoneRoom = sc ? (sc.zone.room || sc.zone.id) : this.zoneRoom;
  }

  /** Called when a move was blocked; sets `wantsExit` if it is the end of a lowered ramp. */
  _exitCheck(wx, wz) {
    for (const key of ['cargo', 'airlock']) {
      const rp = this.state.ramps[key];
      if (!rp || !rp.lowered) continue;
      const def = this.index.layout.ramps[key];
      const run = def.length * Math.cos(rp.angle);
      let atEnd = false;
      if (def.dir.z) atEnd = this.z > def.hinge.z + run - 0.9 && wz > 0.2 && Math.abs(this.x - def.hinge.x) < def.width / 2;
      else atEnd = this.x < def.hinge.x - run + 0.9 && wx < -0.2 && Math.abs(this.z - def.hinge.z) < def.width / 2;
      if (atEnd) { this.events.push('exit:' + key); return; }
    }
  }
}

export function defaultState() {
  return {
    ramps: {
      cargo: { lowered: false, angle: 0.5, progress: 0 },
      airlock: { lowered: false, angle: 0.5, progress: 0 },
    },
    airlock: { outerOpen: false, innerOpen: true },
  };
}

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
