// Owned rovers. They live on the world record (state.vehicles), not in the ship table:
// cosmos_ships.owner_id is unique per player, and a rover is not a ship.
// Drive controls arrive on the pose message (a 1 s lease), the same way a helm does.
// The hold rover's id is hold-<ship id>, so a save that already drove it out is not given a second one.

import { randomUUID } from 'node:crypto';
import { vehicleDef } from '../src/vehicles/registry.js';
import { createVehicle, board, seat, leave, drive, localToFrame, footprint } from '../src/vehicles/api.js';
import { makeShipEnv, makePlanetEnv, SHIP_AXES } from '../src/vehicles/support.js';
import { shipIndexFor } from '../src/ship/shipWalker.js';
import { PORT_WORKERS } from '../src/port/portPeople.js';
import { makeMoon } from '../src/space/moonField.js';

const BOUGHT_CAP = 3;
const LEAVE_OFFSETS = [[1.7, 0.2], [-1.7, 0.2], [0, 2.4], [0, -2.2]];

export class VehicleDirector {
  constructor(auth) { this.auth = auth; }

  ensureAll() {
    this.auth.state.vehicles = this.auth.state.vehicles || {};
    for (const ship of Object.values(this.auth.state.ships)) this.ensure(ship);
  }

  /** One hold rover per Meridian, created once. A rover that already drove out keeps its id. */
  ensure(ship) {
    if (!ship || ship.npc) return;
    const def = vehicleDef('survey');
    if (!def.berth.ships.includes(ship.type)) return;
    const id = `hold-${ship.id}`;
    if (this.auth.state.vehicles[id]) return;
    this.auth.state.vehicles[id] = createVehicle('survey', {
      id, owner: ship.owner, homeShipId: ship.id, parentShipId: ship.id,
      frameId: ship.frameId || 'mars', pose: { ...def.berth.pose },
    });
  }

  step(dt, { catchUp = false } = {}) {
    const list = Object.values(this.auth.state.vehicles || {});
    if (!list.length) return;
    if (!catchUp) {
      const h = 1 / 30, n = Math.max(1, Math.ceil(dt / h)), s = dt / n;
      for (let i = 0; i < n; i++) this._integrate(s);
    }
    this._publish();
  }

  _integrate(dt) {
    for (const v of Object.values(this.auth.state.vehicles)) {
      v.transfer = Math.max(0, (v.transfer || 0) - dt);
      this._dropOffline(v);
      const sim = v.parentShipId ? this.auth.sims.get(v.parentShipId) : null;
      if (v.parentShipId && !sim) continue;
      const env = sim ? this._shipEnv(sim) : makePlanetEnv(this._body(v.frameId));
      const input = this._input(v);
      const result = drive(v, input || { throttle: 0, steer: 0 }, dt, env);
      if (result.left && sim) this._detach(v, sim, result.tried);
      else if (!v.parentShipId) this._reattach(v);
    }
  }

  _input(v) {
    const pid = v.passengers.driver;
    if (!pid) return null;
    const p = this.auth.state.players[pid];
    if (!p || p.vehicleId !== v.id || p.vehicleSeat !== 'driver') return null;
    const inp = this.auth.vehicleInputs.get(pid);
    if (!inp || inp.until < this.auth.now()) return null;
    return inp;
  }

  _body(frameId) { return frameId === 'mars' ? this.auth.mars : makeMoon(frameId); }

  _obstacles(sim) {
    if (sim._roverObs) return sim._roverObs;
    const idx = shipIndexFor(sim.def);
    sim._roverObs = (idx.obstacles || []).filter((o) => o.z1 > 9 && o.y0 < 2.4);
    return sim._roverObs;
  }

  _shipEnv(sim) {
    const ramp = sim.def.ramps?.cargo;
    const deck = { x0: -5.8, x1: 5.8, z0: 9.8, z1: ramp ? ramp.hinge.z : 20.9, y: 0 };
    return makeShipEnv({
      ramps: sim.def.ramps, rampState: sim.ship.state.ramps,
      landed: () => sim.flight.landed, deck, obstacles: this._obstacles(sim),
    });
  }

  _detach(v, sim, tried) {
    const flight = sim.flight;
    const world = flight.toWorld({ x: tried.x, y: tried.y, z: tried.z });
    const env = makePlanetEnv(this._body(sim.frameId));
    const hit = env.sample(world.x, world.y, world.z);
    const p = hit ? hit.point : world;
    v.parentShipId = null;
    v.frameId = sim.frameId;
    v.pose = { x: p.x, y: p.y, z: p.z, yaw: flight.heading + (tried.yaw ?? v.pose.yaw), pitch: 0, roll: 0, speed: v.pose.speed };
    v.transfer = 0.45;
  }

  _reattach(v) {
    if (v.transfer > 0) return;
    const home = v.homeShipId && this.auth.sims.get(v.homeShipId);
    const sims = home ? [home, ...this.auth.sims.values()] : [...this.auth.sims.values()];
    const seen = new Set();
    for (const sim of sims) {
      if (!sim || seen.has(sim.record.id)) continue;
      seen.add(sim.record.id);
      if (!sim.flight.landed || sim.frameId !== v.frameId || sim.record.npc) continue;
      const ramp = sim.def.ramps?.cargo;
      const st = sim.ship.state.ramps?.cargo;
      if (!ramp || !st?.lowered) continue;
      const local = sim.flight.toLocal({ x: v.pose.x, y: v.pose.y, z: v.pose.z });
      const along = (local.x - ramp.hinge.x) * ramp.dir.x + (local.z - ramp.hinge.z) * ramp.dir.z;
      const across = ramp.dir.z ? (local.x - ramp.hinge.x) : (local.z - ramp.hinge.z);
      const run = ramp.length * Math.cos(st.angle);
      if (along < run - 0.8 || along > run + 2.4 || Math.abs(across) > ramp.width / 2 - 0.05) continue;
      const localYaw = v.pose.yaw - sim.flight.heading;
      // forward.z = −cos(localYaw). Speed toward the hinge (−Z) when speed * cos(localYaw) > 0.
      const toward = v.pose.speed * Math.cos(localYaw);
      if (toward <= 0.15 && along > run + 0.2) continue;
      const y = ramp.hinge.y - Math.tan(st.angle) * Math.max(0, Math.min(along, run));
      v.parentShipId = sim.record.id;
      v.pose = { x: local.x, y, z: local.z, yaw: localYaw, pitch: 0, roll: 0, speed: Math.min(0, v.pose.speed) };
      v.transfer = 0.45;
      return;
    }
  }

  _publish() {
    const byShip = new Map();
    for (const v of Object.values(this.auth.state.vehicles)) {
      const sim = v.parentShipId ? this.auth.sims.get(v.parentShipId) : null;
      if (sim) {
        const w = sim.flight.toWorld(v.pose);
        v.world = { x: w.x, y: w.y, z: w.z, yaw: sim.flight.heading + v.pose.yaw, pitch: v.pose.pitch, roll: v.pose.roll };
        v.frameId = sim.frameId;
        const box = footprint(v, SHIP_AXES);
        if (!byShip.has(sim)) byShip.set(sim, []);
        byShip.get(sim).push(box);
      } else {
        v.world = { x: v.pose.x, y: v.pose.y, z: v.pose.z, yaw: v.pose.yaw, pitch: v.pose.pitch, roll: v.pose.roll };
      }
      this._placeAll(v);
    }
    for (const sim of this.auth.sims.values()) sim.ship.state.blockers = byShip.get(sim) || [];
  }

  _placeAll(v) {
    const def = vehicleDef(v.type);
    for (const [seatId, pid] of Object.entries(v.passengers)) {
      const p = this.auth.state.players[pid];
      const s = def.seats.find((q) => q.id === seatId);
      if (!p || !s) continue;
      p.vehicleId = v.id;
      p.vehicleSeat = seatId;
      p.aboardShipId = null;
      p.pose.aboard = false;
      p.pose.seat = null;
      p.pose.grounded = true;
      const sim = v.parentShipId ? this.auth.sims.get(v.parentShipId) : null;
      const local = sim
        ? localToFrame(v.pose, SHIP_AXES, s.x, s.y, s.z)
        : localToFrame(v.pose, makePlanetEnv(this._body(v.frameId)).axes(v.pose), s.x, s.y, s.z);
      if (sim) {
        sim.flight.toWorld(local, p.pose.worldPos);
        p.frameId = sim.frameId;
        p.pose.sw = { x: local.x, y: local.y, z: local.z, yaw: v.pose.yaw, pitch: 0 };
        p.pose.yaw = sim.flight.heading + v.pose.yaw;
      } else {
        p.pose.worldPos = { x: local.x, y: local.y, z: local.z };
        p.frameId = v.frameId;
        p.pose.yaw = v.pose.yaw;
      }
    }
  }

  _dropOffline(v) {
    for (const pid of Object.values(v.passengers)) {
      const p = this.auth.state.players[pid];
      if (!p || this.auth.sessions.has(p.id) || !p.offlineAt) continue;
      if (this.auth.now() - p.offlineAt > 30000) this._dismount(v, p);
    }
  }

  _nearDoor(p, v) {
    const def = vehicleDef(v.type);
    const sim = v.parentShipId ? this.auth.sims.get(v.parentShipId) : null;
    if (p.aboardShipId && (!sim || p.aboardShipId !== sim.record.id)) return false;
    const axes = sim ? SHIP_AXES : makePlanetEnv(this._body(v.frameId)).axes(v.pose);
    for (const door of def.doors) {
      const at = localToFrame(v.pose, axes, door.x, 0, door.z);
      let d;
      if (sim && p.aboardShipId === sim.record.id) d = Math.hypot(p.pose.sw.x - at.x, p.pose.sw.z - at.z);
      else if (sim) {
        const w = sim.flight.toWorld(at);
        d = Math.hypot(p.pose.worldPos.x - w.x, p.pose.worldPos.y - w.y, p.pose.worldPos.z - w.z);
      } else d = Math.hypot(p.pose.worldPos.x - at.x, p.pose.worldPos.y - at.y, p.pose.worldPos.z - at.z);
      if (d <= def.doorReach) return true;
    }
    return false;
  }

  boardPlayer(p, a) {
    if (p.pose?.seat) throw Error('Stand up first.');
    if (p.vehicleId) throw Error('Leave the rover you are in first.');
    const v = this.auth.state.vehicles[a.vehicleId];
    if (!v) throw Error('That rover is not here.');
    if (p.frameId !== (v.parentShipId ? this.auth.sims.get(v.parentShipId)?.frameId : v.frameId) && !p.aboardShipId) throw Error('That rover is on another body.');
    if (!this._nearDoor(p, v)) throw Error('Walk up to a door.');
    const r = board(v, p.id, a.seat || undefined);
    if (!r.ok) throw Error(r.msg);
    p.vehicleId = v.id;
    p.vehicleSeat = r.seat;
    p.aboardShipId = null;
    p.pose.aboard = false;
    p.pose.seat = null;
    this._publish();
    return { ok: true, msg: r.seat === 'driver' ? 'You have the wheel.' : 'You are in.' };
  }

  seatPlayer(p, a) {
    const v = p.vehicleId && this.auth.state.vehicles[p.vehicleId];
    if (!v) throw Error('You are not in a rover.');
    const r = seat(v, p.id, a.seat);
    if (!r.ok) throw Error(r.msg);
    p.vehicleSeat = r.seat;
    this._publish();
    return { ok: true, msg: r.seat === 'driver' ? 'You have the wheel.' : 'You changed seats.' };
  }

  leavePlayer(p) {
    const v = p.vehicleId && this.auth.state.vehicles[p.vehicleId];
    if (!v) throw Error('You are not in a rover.');
    return this._dismount(v, p);
  }

  _dismount(v, p) {
    const r = leave(v, p.id);
    if (!r.ok) throw Error(r.msg);
    p.vehicleId = null;
    p.vehicleSeat = null;
    this.auth.vehicleInputs.delete(p.id);
    const sim = v.parentShipId ? this.auth.sims.get(v.parentShipId) : null;
    const env = sim ? this._shipEnv(sim) : makePlanetEnv(this._body(v.frameId));
    const axes = env.axes(v.pose);
    let spot = null;
    for (const [lx, lz] of LEAVE_OFFSETS) {
      const at = localToFrame(v.pose, axes, lx, 0, lz);
      const g = env.sample(at.x, at.y, at.z);
      if (g && !env.blocked?.(g.point)) { spot = g.point; break; }
    }
    if (!spot) spot = { x: v.pose.x, y: v.pose.y, z: v.pose.z };
    if (sim) {
      p.aboardShipId = sim.record.id;
      p.pose.aboard = true;
      p.pose.seat = null;
      p.pose.sw = { x: spot.x, y: spot.y, z: spot.z, yaw: v.pose.yaw, pitch: 0 };
      p.frameId = sim.frameId;
      sim.flight.toWorld(p.pose.sw, p.pose.worldPos);
    } else {
      p.aboardShipId = null;
      p.pose.aboard = false;
      p.pose.seat = null;
      p.pose.worldPos = { x: spot.x, y: spot.y, z: spot.z };
      p.pose.grounded = true;
      p.frameId = v.frameId;
    }
    return { ok: true, msg: 'You stepped off.' };
  }

  buy(p) {
    if (p.aboardShipId || p.vehicleId) throw Error('Step outside first.');
    if (p.frameId !== 'mars') throw Error('The depot is at Marineris.');
    const clerk = PORT_WORKERS.find((w) => w.id === 'depot-clerk');
    this.auth.near(p, { ...clerk, y: clerk.y || 0 }, 3);
    const def = vehicleDef('survey');
    const flag = this.auth.state.ships[p.shipId];
    this.auth.owner(p, flag);
    const bought = Object.values(this.auth.state.vehicles).filter((v) => v.owner === p.id && !v.homeShipId);
    if (bought.length >= BOUGHT_CAP) throw Error('The apron holds three of your rovers already.');
    if (flag.economy.marks < def.priceMarks) throw Error(`A survey rover is ${def.priceMarks} marks. The ship account has ${flag.economy.marks}.`);
    flag.economy.marks -= def.priceMarks;
    const id = `rover-${randomUUID()}`;
    const pose = this._apronPose();
    this.auth.state.vehicles[id] = createVehicle('survey', {
      id, owner: p.id, homeShipId: null, parentShipId: null, frameId: 'mars', pose,
    });
    return { ok: true, msg: `Bought a survey rover for ${def.priceMarks} marks. It is on the apron east of the depot.`, vehicleId: id };
  }

  _apronPose() {
    // Depot spans x −74..−50. East apron, clear of the wall, facing west (back at the desk).
    const above = this.auth.site.toWorld(-46, 3, 18);
    const env = makePlanetEnv(this.auth.mars);
    const hit = env.sample(above.x, above.y, above.z);
    const p = hit ? hit.point : above;
    return { x: p.x, y: p.y, z: p.z, yaw: -Math.PI / 2, pitch: 0, roll: 0, speed: 0 };
  }

  /** True when a parented rover is on this ramp, so lift-off cannot fold the ramp under it. */
  onRamp(sim, key) {
    const ramp = sim.def.ramps?.[key];
    if (!ramp) return false;
    const st = sim.ship.rampCtl?.[key] || sim.ship.state.ramps?.[key];
    if (!st) return false;
    const run = ramp.length * Math.cos(st.angle || 0);
    const on = (q) => {
      const along = (q.x - ramp.hinge.x) * ramp.dir.x + (q.z - ramp.hinge.z) * ramp.dir.z;
      const across = ramp.dir.z ? Math.abs(q.x - ramp.hinge.x) : Math.abs(q.z - ramp.hinge.z);
      return along > 0.15 && along < run + 0.8 && across < ramp.width / 2 + 0.2;
    };
    for (const v of Object.values(this.auth.state.vehicles)) {
      if (v.parentShipId !== sim.record.id) continue;
      if (on(v.pose)) return true;
      const def = vehicleDef(v.type);
      for (const w of def.wheels) if (on(localToFrame(v.pose, SHIP_AXES, w.x, 0, w.z))) return true;
    }
    return false;
  }
}
