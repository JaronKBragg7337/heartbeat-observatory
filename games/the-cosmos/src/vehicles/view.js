// Client rover view: the mesh, the Drive / Ride / Leave prompt, and the camera while seated.
// The server owns the pose. Solo play steps the same drive() locally so the hold rover still exists offline.
//
// Parent yaw matches api.js: mesh.rotation.y = −pose.yaw (Three.js +rotation.y turns a −Z nose to port).
// A tracked rover on the ground uses the same basis as drive(): right, up, −forward.

import * as THREE from 'three';
import { vehicleDef } from './registry.js';
import { createVehicle, board, seat, leave, drive, localToFrame, basis, footprint } from './api.js';
import { makeShipEnv, makePlanetEnv, SHIP_AXES } from './support.js';
import { buildSurveyRover } from './survey/mesh.js';
import { PORT_WORKERS } from '../port/portPeople.js';
import { makeMoon } from '../space/moonField.js';

const SOLO = 'solo';

export class VehicleSystem {
  constructor({ engine, ship, walker, world, space, site, tier }) {
    this.engine = engine;
    this.ship = ship;
    this.walker = walker;
    this.world = world;
    this.space = space;
    this.site = site;
    this.tier = tier;
    this.meshes = new Map();
    this.camYaw = 0;
    this.camPitch = 0;
    this._throttle = 0;
    this._steer = 0;
    this.actorId = SOLO;
    this.soloSeat = null;
    if (!world.remote) {
      const def = vehicleDef('survey');
      if (def.berth.ships.includes(ship.def?.type)) {
        this.solo = [createVehicle('survey', {
          id: 'hold-solo', owner: SOLO, homeShipId: SOLO, parentShipId: SOLO, frameId: 'mars',
          pose: { ...def.berth.pose },
        })];
      } else this.solo = [];
      world.register('buy-vehicle', () => this.buyLocal());
    }
  }

  list() {
    if (this.world.remote) return Object.values(this.world.snapshot?.vehicles || {});
    return this.solo || [];
  }

  _player() {
    if (this.world.remote) return this.world.snapshot?.players?.[this.world.playerId] || null;
    return { id: SOLO, vehicleId: this.soloSeat?.vehicleId || null, vehicleSeat: this.soloSeat?.seat || null, frameId: this.space?.frameId || 'mars' };
  }

  seated() {
    const p = this._player();
    return !!(p && p.vehicleId);
  }

  driving() {
    const p = this._player();
    return !!(p && p.vehicleId && p.vehicleSeat === 'driver');
  }

  controlPacket() {
    if (!this.driving()) return null;
    return { throttle: this._throttle, steer: this._steer };
  }

  /** Call before ship.frame so the hull does not shove a seated driver and the bay stays drawn. */
  prepare() {
    const p = this._player();
    const v = p?.vehicleId ? this.list().find((q) => q.id === p.vehicleId) : null;
    const inside = !!(v && this._showsInside(v));
    this.ship.suppressBoard = !!v;
    this.ship.interiorForce = inside;
    this.ship.vehicleEye = inside ? this._eyeShipLocal(v, p.vehicleSeat) : null;
    this.ship.state.blockers = this.list().filter((q) => this._showsInside(q)).map((q) => footprint(q, SHIP_AXES));
  }

  _showsInside(v) {
    if (!v?.parentShipId) return false;
    if (!this.world.remote) return v.parentShipId === SOLO;
    const p = this.world.snapshot?.players?.[this.world.playerId];
    if (!p) return false;
    const active = p.currentShipId || p.shipId;
    return v.parentShipId === active;
  }

  _eyeShipLocal(v, seatId) {
    const def = vehicleDef(v.type);
    const s = def.seats.find((q) => q.id === seatId) || def.seats[0];
    return localToFrame(v.pose, SHIP_AXES, s.x, s.y + def.eye, s.z);
  }

  contextAction() {
    const p = this._player();
    if (!p) return null;
    if (p.vehicleId) {
      const v = this.list().find((q) => q.id === p.vehicleId);
      if (!v) return null;
      return { label: 'Leave', run: () => this._leave(v.id) };
    }
    if (this.ship.aboard && this.ship.seat) return null;
    const near = this._nearVehicle();
    if (!near) return null;
    const def = vehicleDef(near.type);
    const driverFree = !near.passengers.driver;
    const anyFree = def.seats.some((s) => !near.passengers[s.id]);
    if (!anyFree) return null;
    return {
      label: driverFree ? 'Drive' : 'Ride',
      run: () => this._board(near.id, driverFree ? 'driver' : null),
    };
  }

  _nearVehicle() {
    const reach = vehicleDef('survey').doorReach;
    for (const v of this.list()) {
      const def = vehicleDef(v.type);
      for (const door of def.doors) {
        const at = this._doorWorld(v, door);
        if (!at) continue;
        if (Math.hypot(this.walker.worldPos.x - at.x, this.walker.worldPos.y - at.y, this.walker.worldPos.z - at.z) <= reach) return v;
        if (v.parentShipId && this.ship.aboard && this._showsInside(v)) {
          const local = localToFrame(v.pose, SHIP_AXES, door.x, 0, door.z);
          if (Math.hypot(this.ship.sw.x - local.x, this.ship.sw.z - local.z) <= reach) return v;
        }
      }
    }
    return null;
  }

  _doorWorld(v, door) {
    if (v.parentShipId && this._showsInside(v)) {
      const local = localToFrame(v.pose, SHIP_AXES, door.x, 0, door.z);
      return this.ship.flight.toWorld(local);
    }
    if (v.world) {
      const axes = this._worldAxes(v);
      return localToFrame({ ...v.world, yaw: v.world.yaw }, axes, door.x, 0, door.z);
    }
    return null;
  }

  _worldAxes(v) {
    const body = this._body(v.frameId || 'mars');
    const p = v.world || v.pose;
    return makePlanetEnv(body).axes(p);
  }

  _body(frameId) {
    if (frameId === 'mars') return this.walker.body;
    return makeMoon(frameId);
  }

  _board(id, seatId) {
    if (this.world.remote) return this._request({ type: 'vehicle-board', vehicleId: id, seat: seatId || undefined });
    const v = this.solo.find((q) => q.id === id);
    if (!v) return { ok: false, msg: 'That rover is not here.' };
    if (this.ship.seat) return { ok: false, msg: 'Stand up first.' };
    const r = board(v, SOLO, seatId || undefined);
    if (!r.ok) return r;
    this.soloSeat = { vehicleId: id, seat: r.seat };
    if (this.ship.aboard) this.ship.aboard = false;   // (the seat is already null: the guard above refuses while seated; ship.seat is a getter and cannot be assigned)
    return { ok: true, msg: r.seat === 'driver' ? 'You have the wheel.' : 'You are in.' };
  }

  _leave(id) {
    if (this.world.remote) return this._request({ type: 'vehicle-leave', vehicleId: id });
    const v = this.solo.find((q) => q.id === id);
    if (!v) return { ok: false, msg: 'You are not in a rover.' };
    const r = leave(v, SOLO);
    if (!r.ok) return r;
    this.soloSeat = null;
    this._soloDismount(v);
    return { ok: true, msg: 'You stepped off.' };
  }

  _request(action) {
    const view = this.multiplayer;
    if (view?.request) return view.request(action);
    return this.world.request(action);
  }

  /** Stick up is throttle, stick right steers right. The same axes as the helm. */
  frame(dt, input) {
    const look = input?.look || { dx: 0, dy: 0 };
    if (this.driving()) {
      this._throttle = input.moveNorth || 0;
      this._steer = input.moveEast || 0;
      this.camYaw += look.dx || 0;
      this.camPitch = Math.max(-1.1, Math.min(1.1, this.camPitch - (look.dy || 0)));
    } else {
      this._throttle = 0;
      this._steer = 0;
    }
    if (!this.world.remote) this._stepSolo(dt);
    this._syncMeshes(dt);
    if (!this.seated()) return false;
    this._placeCamera();
    return true;
  }

  _stepSolo(dt) {
    const h = 1 / 30, n = Math.max(1, Math.ceil(dt / h)), s = dt / n;
    for (let i = 0; i < n; i++) {
      for (const v of this.solo) {
        v.transfer = Math.max(0, (v.transfer || 0) - s);
        const env = v.parentShipId ? this._soloShipEnv() : makePlanetEnv(this._body(v.frameId));
        const driving = this.soloSeat?.vehicleId === v.id && this.soloSeat.seat === 'driver';
        const result = drive(v, driving ? { throttle: this._throttle, steer: this._steer } : { throttle: 0, steer: 0 }, s, env);
        if (result.left && v.parentShipId) this._soloDetach(v, result.tried);
        else if (!v.parentShipId) this._soloReattach(v);
        this._soloWorld(v);
      }
    }
  }

  _soloShipEnv() {
    const ramp = this.ship.def.ramps.cargo;
    return makeShipEnv({
      ramps: this.ship.def.ramps,
      rampState: this.ship.state.ramps,
      landed: () => this.ship.flight.landed,
      deck: { x0: -5.8, x1: 5.8, z0: 9.8, z1: ramp.hinge.z, y: 0 },
      obstacles: (this.ship.sw?.index?.obstacles || []).filter((o) => o.z1 > 9 && o.y0 < 2.4),
    });
  }

  _soloDetach(v, tried) {
    const flight = this.ship.flight;
    const world = flight.toWorld({ x: tried.x, y: tried.y, z: tried.z });
    const env = makePlanetEnv(this._body(this.space?.frameId || 'mars'));
    const hit = env.sample(world.x, world.y, world.z);
    const p = hit ? hit.point : world;
    v.parentShipId = null;
    v.frameId = this.space?.frameId || 'mars';
    v.pose = { x: p.x, y: p.y, z: p.z, yaw: flight.heading + (tried.yaw ?? v.pose.yaw), pitch: 0, roll: 0, speed: v.pose.speed };
    v.transfer = 0.45;
  }

  _soloReattach(v) {
    if ((v.transfer || 0) > 0 || !this.ship.flight.landed) return;
    if ((this.space?.frameId || 'mars') !== v.frameId) return;
    const ramp = this.ship.def.ramps?.cargo;
    const st = this.ship.state.ramps?.cargo;
    if (!ramp || !st?.lowered) return;
    const local = this.ship.flight.toLocal({ x: v.pose.x, y: v.pose.y, z: v.pose.z });
    const along = (local.x - ramp.hinge.x) * ramp.dir.x + (local.z - ramp.hinge.z) * ramp.dir.z;
    const across = local.x - ramp.hinge.x;
    const run = ramp.length * Math.cos(st.angle);
    if (along < run - 0.8 || along > run + 2.4 || Math.abs(across) > ramp.width / 2) return;
    const localYaw = v.pose.yaw - this.ship.flight.heading;
    if (v.pose.speed * Math.cos(localYaw) <= 0.15 && along > run + 0.2) return;
    const y = ramp.hinge.y - Math.tan(st.angle) * Math.max(0, Math.min(along, run));
    v.parentShipId = SOLO;
    v.pose = { x: local.x, y, z: local.z, yaw: localYaw, pitch: 0, roll: 0, speed: Math.min(0, v.pose.speed) };
    v.transfer = 0.45;
  }

  _soloWorld(v) {
    if (v.parentShipId) {
      const w = this.ship.flight.toWorld(v.pose);
      v.world = { x: w.x, y: w.y, z: w.z, yaw: this.ship.flight.heading + v.pose.yaw, pitch: v.pose.pitch, roll: v.pose.roll };
    } else v.world = { x: v.pose.x, y: v.pose.y, z: v.pose.z, yaw: v.pose.yaw, pitch: v.pose.pitch, roll: v.pose.roll };
  }

  _soloDismount(v) {
    const env = v.parentShipId ? this._soloShipEnv() : makePlanetEnv(this._body(v.frameId));
    const axes = env.axes(v.pose);
    let spot = null;
    for (const [lx, lz] of [[1.7, 0.2], [-1.7, 0.2], [0, 2.4]]) {
      const at = localToFrame(v.pose, axes, lx, 0, lz);
      const g = env.sample(at.x, at.y, at.z);
      if (g && !env.blocked?.(g.point)) { spot = g.point; break; }
    }
    if (v.parentShipId && spot) {
      this.ship.aboard = true;
      this.ship.sw.place(spot.x, spot.y, spot.z, v.pose.yaw);
      const w = this.ship.flight.toWorld(spot);
      this.walker.worldPos.x = w.x; this.walker.worldPos.y = w.y; this.walker.worldPos.z = w.z;
    } else if (spot) {
      this.walker.worldPos.x = spot.x; this.walker.worldPos.y = spot.y; this.walker.worldPos.z = spot.z;
      this.walker.grounded = true;
      this.walker.updateFrame?.();
    }
  }

  buyLocal() {
    if (this.ship.aboard || this.soloSeat) return { ok: false, msg: 'Step outside first.' };
    const clerk = PORT_WORKERS.find((w) => w.id === 'depot-clerk');
    const here = this.site.toLocal(this.walker.worldPos);
    if (Math.hypot(here.x - clerk.x, here.z - clerk.z) > 3) return { ok: false, msg: 'Walk over to the depot clerk.' };
    const def = vehicleDef('survey');
    const e = this.world.state.economy;
    if (!e || e.marks < def.priceMarks) return { ok: false, msg: `A survey rover is ${def.priceMarks} marks.` };
    const bought = this.solo.filter((v) => !v.homeShipId);
    if (bought.length >= 3) return { ok: false, msg: 'The apron holds three of your rovers already.' };
    e.marks -= def.priceMarks;
    const above = this.site.toWorld(-46, 3, 18);
    const env = makePlanetEnv(this.walker.body);
    const hit = env.sample(above.x, above.y, above.z);
    const p = hit ? hit.point : above;
    const id = `rover-solo-${this.solo.length}`;
    this.solo.push(createVehicle('survey', {
      id, owner: SOLO, frameId: 'mars',
      pose: { x: p.x, y: p.y, z: p.z, yaw: -Math.PI / 2, pitch: 0, roll: 0, speed: 0 },
    }));
    return { ok: true, msg: `Bought a survey rover for ${def.priceMarks} marks. It is on the apron east of the depot.` };
  }

  _syncMeshes(dt = 1 / 60) {
    const seen = new Set();
    for (const v of this.list()) {
      seen.add(v.id);
      let slot = this.meshes.get(v.id);
      if (!slot) {
        const built = buildSurveyRover(this.ship.matsInt, { tier: this.tier });
        slot = { ...built, entry: null, inside: false, worldPos: new THREE.Vector3(), quat: new THREE.Quaternion() };
        this.meshes.set(v.id, slot);
      }
      const inside = this._showsInside(v);
      if (inside && !slot.inside) {
        if (slot.entry) { this.engine.untrack(slot.entry); slot.entry = null; }
        slot.group.removeFromParent();
        this.ship.interior.root.add(slot.group);
        slot.inside = true;
      } else if (!inside && slot.inside) {
        slot.group.removeFromParent();
        slot.group.position.set(0, 0, 0);
        slot.group.rotation.set(0, 0, 0);
        slot.inside = false;
      }
      if (slot.inside) {
        slot.group.position.set(v.pose.x, v.pose.y, v.pose.z);
        slot.group.rotation.order = 'YXZ';
        slot.group.rotation.set(v.pose.pitch || 0, -(v.pose.yaw || 0), v.pose.roll || 0);
      } else if (v.world) {
        slot.worldPos.set(v.world.x, v.world.y, v.world.z);
        this._worldQuat(v, slot.quat);
        const frameId = v.frameId || 'mars';
        const frame = frameId === 'mars' ? this.engine.rootFrame : this.space?.moonWorld?.(frameId)?.frame;
        if (!slot.entry) {
          this.engine.scene.add(slot.group);
          slot.entry = this.engine.track({ worldPos: slot.worldPos, object3d: slot.group, quaternion: slot.quat, frame });
        } else slot.entry.frame = frame;
      }
      const wheels = v.wheels || [];
      slot.wheels.forEach((g, i) => { g.position.y = vehicleDef(v.type).wheelRadius + (wheels[i] || 0); });
      slot.sync?.();
      slot.update?.(dt, { speed: v.pose?.speed || 0, inside: slot.inside });
    }
    for (const [id, slot] of this.meshes) {
      if (seen.has(id)) continue;
      if (slot.entry) this.engine.untrack(slot.entry);
      slot.group.removeFromParent();
      slot.group.userData.dispose?.();
      this.meshes.delete(id);
    }
  }

  _worldQuat(v, out) {
    const axes = this._worldAxes(v);
    const b = basis(v.world.yaw, axes);
    const m = new THREE.Matrix4().makeBasis(
      new THREE.Vector3(b.right.x, b.right.y, b.right.z),
      new THREE.Vector3(b.up.x, b.up.y, b.up.z),
      new THREE.Vector3(-b.forward.x, -b.forward.y, -b.forward.z),
    );
    out.setFromRotationMatrix(m);
    const qp = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), v.world.pitch || 0);
    const qr = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), v.world.roll || 0);
    out.multiply(qp).multiply(qr);
  }

  _placeCamera() {
    const p = this._player();
    const v = this.list().find((q) => q.id === p.vehicleId);
    if (!v) return;
    const def = vehicleDef(v.type);
    const s = def.seats.find((q) => q.id === p.vehicleSeat) || def.seats[0];
    const look = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.camPitch, -this.camYaw, 0, 'YXZ'));
    let eye, quat;
    if (this._showsInside(v)) {
      const local = this._eyeShipLocal(v, s.id);
      eye = this.ship.flight.toWorld(local);
      const qVeh = new THREE.Quaternion().setFromEuler(new THREE.Euler(v.pose.pitch || 0, -(v.pose.yaw || 0), v.pose.roll || 0, 'YXZ'));
      quat = this.ship.flight.quaternion.clone().multiply(qVeh).multiply(look);
    } else if (v.world) {
      const axes = this._worldAxes(v);
      const at = localToFrame({ ...v.world, yaw: v.world.yaw }, axes, s.x, s.y + def.eye, s.z);
      eye = at;
      const q = new THREE.Quaternion();
      this._worldQuat(v, q);
      quat = q.multiply(look);
    } else return;
    const cam = this.engine.cameraWorldPos;
    cam.x = eye.x; cam.y = eye.y; cam.z = eye.z;
    this.engine.camera.quaternion.copy(quat);
    this.engine.camera.up.set(0, 1, 0).applyQuaternion(quat);
    // The terrain and the sun follow the rover, not the old walking pose.
    const ground = v.world || v.pose;
    this.walker.worldPos.x = ground.x; this.walker.worldPos.y = ground.y; this.walker.worldPos.z = ground.z;
    this.walker.yaw = v.world ? v.world.yaw : v.pose.yaw;
    this.walker.updateFrame?.();
  }
}
