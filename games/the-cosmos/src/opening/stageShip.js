// ============================================================================
// opening/stageShip.js - a real ship of the fleet (the Ares liner, the Kestrel descent transport) standing in the opening's private scene:
// the same interior and exterior builders the game flies, the same ShipWalker the player walks it with, the same room visibility, lights,
// sliding doors and ramps; none of the flight model, because the opening's flights are scripted (script.js).
//
// TWO SCENES, ONE SHIP. The exterior hull belongs to the world scene (a child of `group`); the interior (own lights, drawn over the world with
// the world's depth, as the game does it) is its own scene, `interiorScene`, which the opening puts in engine.overlayScenes. Both ride the
// floating origin: `entryExt` / `entryInt` are engine-tracked, and `place()` writes the ship's world pose into them every frame.
// ============================================================================
import * as THREE from 'three';
import { shipDef } from '../ships/registry.js';
import { visualsFor } from '../ships/visuals.js';
import { buildInterior, buildSeats } from '../ship/shipInterior.js';
import { ShipWalker, shipIndexFor, defaultState } from '../ship/shipWalker.js';
import { buildPortals, reachRooms } from '../ship/shipVisibility.js';
import { poseRamp } from '../ship/shipSystem.js';
import { rampAngle } from './script.js';

const DEG = Math.PI / 180;

export class ShipStage {
  /** o: { engine, type, name, registry, mats: { int, ext }, signs, posters, tier } */
  constructor(o) {
    this.engine = o.engine; this.tier = o.tier || 'low'; this.low = this.tier === 'low';
    this.def = shipDef(o.type); this.visuals = visualsFor(this.def.type);
    this.layout = { ...this.def.layout, custom: this.visuals.custom || null };
    this.state = defaultState(); this.state.airlock.innerOpen = true; this.state.airlock.outerOpen = false;
    this.sw = new ShipWalker(shipIndexFor(this.def), this.state);
    const t0 = performance.now();
    // --- the interior scene: its own lights, a hemisphere and a pool of point lights moved to the nearest lamp fixtures
    this.interiorScene = new THREE.Scene();
    this.hemi = new THREE.HemisphereLight(0xb4c4d6, 0x6c7480, 1.0); this.interiorScene.add(this.hemi);
    this.interior = buildInterior(this.layout, o.mats.int, { tier: this.tier, signs: o.signs, posters: o.posters });
    this.interior.mats = o.mats.int;
    buildSeats(this.layout, o.mats.int, this.interior);
    this.interiorScene.add(this.interior.root);
    this.lightPool = [];
    // a small fill that rides with the camera: the ceilings of rooms with few lamps (the Kestrel's cabins) are otherwise lit by the dim ground colour only
    this.fill = new THREE.PointLight(0xdfe8f5, 5, 7.5, 2); this.interior.root.add(this.fill);
    for (let i = 0; i < (this.low ? 4 : 6); i++) { const L = new THREE.PointLight(0xffffff, 0, 10, 2); this.interior.root.add(L); this.lightPool.push({ light: L, fixture: -1, target: -1, k: 0 }); }
    // --- the exterior (the hull, legs, ramps, engines), named with the ship's own decal
    const dtex = this.visuals.decalTexture(THREE, this.def, o.name, o.registry);
    this.decal = dtex ? new THREE.MeshBasicMaterial({ map: dtex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }) : null;
    this.exterior = this.visuals.buildExterior(this.layout, o.mats.ext, { tier: this.tier, decal: this.decal, def: this.def });
    this.group = new THREE.Group(); this.group.name = 'opening-ship:' + this.def.type;
    this.hardware = new THREE.Group(); this.effects = new THREE.Group();
    for (const ch of [...this.exterior.root.children]) {
      if (ch.name === 'exhaust' || (ch.isMesh && ch.material && ch.material.blending === THREE.AdditiveBlending)) this.effects.add(ch); else this.hardware.add(ch);
    }
    this.exterior.root.add(this.hardware, this.effects);
    // Keep the walkable ramp in the world pass even while the hull is hidden from an interior camera.
    for (const r of Object.values(this.exterior.ramps)) this.exterior.root.add(r.hinge);
    // The closed loading hatch is a solid panel at the cargo opening, rather than an exposed portal.
    const cargoDoor=this.layout.doors.find(d=>d.noZone&&d.b==='outside'&&d.kind==='portal');
    if(cargoDoor){this.cargoClosure=new THREE.Mesh(new THREE.BoxGeometry(cargoDoor.w,cargoDoor.h,.16),o.mats.ext.hull);
      this.cargoClosure.name='closed cargo hatch';this.cargoClosure.position.set(cargoDoor.c,cargoDoor.y+cargoDoor.h/2,cargoDoor.at);this.hardware.add(this.cargoClosure);}
    this.group.add(this.exterior.root);
    this.visuals.applyNeutralPose(this.exterior);
    // legs at their resting length (a landed ship), ramps raised
    const gear = this.def.gear;
    this.exterior.legs.forEach((leg) => { const len = gear.nominal; leg.foot.position.y = -len; leg.piston.scale.y = len + 0.2; leg.piston.position.y = 0.2; });
    for (const e of this.exterior.engines) e.outer.visible = e.core.visible = false;
    for (const p of this.exterior.liftPods) { p.mesh.visible = p.core.visible = false; }
    // tracked entries (world pose written by place())
    this.worldPos = { x: 0, y: 0, z: 0 }; this.quaternion = new THREE.Quaternion();
    this.entryExt = engine_track(this.engine, { worldPos: this.worldPos, object3d: this.group, quaternion: this.quaternion });
    this.entryInt = engine_track(this.engine, { worldPos: this.worldPos, object3d: this.interior.root, quaternion: this.quaternion });
    this.doorState = new Map(this.interior.doors.map((d) => [d.def.id, d]));
    this._portals = buildPortals(this.layout, new Set(this.interior.rooms.keys()));
    this.windowRooms = new Set((this.layout.windows || []).map((w) => w.room));
    this.roles = this.def.roles;
    this.ramp = { cargo: 0, airlock: 0 };
    this.people = [];
    this.currentRoom = null; this._lastRoom = null; this.visible = new Set();
    this._v = new THREE.Vector3(); this._q = new THREE.Quaternion(); this._look = new THREE.Vector3();
    this.buildMs = Math.round(performance.now() - t0);
    this.setRamps(0, 0, true);
  }

  /** Lower or raise the ramps (progress 0..1 each). The walker's zones follow the state. */
  setRamps(cargo, airlock, force = false) {
    for (const [key, p0] of [['cargo', cargo], ['airlock', airlock]]) {
      const p = p0 > 0.9999 ? 1 : p0 < 0.0001 ? 0 : p0;      // snap, so a ramp that is 'all the way down' is exactly 1
      if (!force && Math.abs(p - this.ramp[key]) < 1e-4) continue;
      this.ramp[key] = p; const ang = rampAngle(this.def, key);
      if(key==='cargo'&&this.cargoClosure)this.cargoClosure.visible=p<.01;
      const st = this.state.ramps[key]; st.angle = ang; st.progress = p; st.lowered = p >= 0.999;
      poseRamp(this.exterior.ramps[key], this.def.ramps[key], key, p, ang);
    }
    this.state.airlock.outerOpen = airlock > 0.4;
  }

  /** Put a person aboard (a child of the interior; shown only while their room is). Seated people are lowered onto the cushion by `seatHead`. */
  addPerson(person, { x, y = 0, z, yawDeg = 0, room = null, seat = false, headY = 1.22 }) {
    person.group.position.set(x, y, z); person.group.rotation.y = Math.PI - yawDeg * DEG;
    person.play(seat ? 'Sit' : 'Idle', 0);
    this.interior.root.add(person.group);
    const rec = { person, room, seat, headY, y };
    this.people.push(rec);
    if (seat) person.ready.then((p) => this._seatHead(rec, p));
    return rec;
  }
  _seatHead(rec, p) {
    if (!p.loaded) return;
    if (p.safe) { p.group.position.y = rec.y + rec.headY - 1.61; return; }
    let head; p.group.traverse((o) => { if (o.isBone && /(^|[:_])head$/i.test(o.name)) head = o; });
    if (head) { p.group.updateWorldMatrix(true, true); const local = p.group.worldToLocal(head.getWorldPosition(new THREE.Vector3())); p.group.position.y = rec.y + rec.headY - local.y; }
  }

  /** Write the ship's world pose (a position and an orientation in the frame the world scene lives in) into the tracked entries. */
  place(worldPos, quaternion) {
    Object.assign(this.worldPos, worldPos); this.quaternion.copy(quaternion);
    this.hemi.position.set(0, 1, 0).applyQuaternion(this.quaternion);       // the ambient light's up is the ship's up, whatever the frame the ship stands in
  }

  // ---- one frame -----------------------------------------------------------------------------------------------------------
  /**
   * dt; `eye` the camera in ship-local metres; `look` the way it looks (ship-local, a THREE.Vector3); `walking` true when the player is on foot in the ship (doors open to
   * them); `inside` true when the camera is inside the hull (the exterior is hidden: the windows are open to the world).
   */
  update(dt, eye, look, { walking = true, inside = true, aspect = 1, fov = 72, first = false } = {}) {
    this._doors(dt, walking ? this.sw : null, first);
    this._rooms(dt, eye, look, inside, aspect, fov, first);
    for (const r of this.people) r.person.group.visible = !r.room || this.visible.has(r.room);
    for (const r of this.people) if (r.person.group.visible) r.person.update(dt);
  }

  _doors(dt, walker, first) {
    for (const d of this.interior.doors) {
      const def = d.def; let target = 0;
      if (def.id === 'd_airlock_in') target = this.state.airlock.innerOpen ? 1 : 0;
      else if (def.kind === 'outer') target = this.state.airlock.outerOpen || this.ramp.airlock > 0.4 ? 1 : 0;
      else if (walker) {
        const cx = def.axis === 'x' ? def.at : def.c, cz = def.axis === 'x' ? def.c : def.at;
        if (Math.abs(walker.y - def.y) < 2.6 && Math.hypot(walker.x - cx, walker.z - cz) < (def.w > 1.6 ? 2.4 : 1.7)) target = 1;
      }
      d.was = target;
      if (first) d.open = target; else d.open += Math.sign(target - d.open) * Math.min(Math.abs(target - d.open), dt * 3.2);
      const n = d.leaves.length, travel = (def.w + 0.14) * (n === 2 ? 0.5 : 1) * d.open;
      d.leaves.forEach((leaf, i) => {
        const dir = n === 2 ? (i === 0 ? -1 : 1) : (def.axis === 'x' ? -1 : 1), off = n === 2 ? (i === 0 ? -1 : 1) * (def.w / 4 + 0.01) : 0;
        if (def.kind === 'outer') leaf.position.set(0, d.open * (def.h + 0.05), 0);
        else if (def.axis === 'x') leaf.position.set(0, 0, off + dir * travel); else leaf.position.set(off + dir * travel, 0, 0);
      });
      d.group.visible = this.visible.size === 0 || this.visible.has(def.a) || this.visible.has(def.b);
    }
  }

  _doorSideRoom(doorId) {
    const d = this.layout.doors.find((q) => q.id === doorId); if (!d) return null;
    const A = this.layout.roomById.get(d.a), B = this.layout.roomById.get(d.b);
    if (!A || !B) return A ? d.a : (B ? d.b : null);
    const p = d.axis === 'x' ? this.sw.x : this.sw.z, ca = d.axis === 'x' ? (A.x0 + A.x1) / 2 : (A.z0 + A.z1) / 2, cb = d.axis === 'x' ? (B.x0 + B.x1) / 2 : (B.z0 + B.z1) / 2;
    if (Math.abs(p - d.at) < 0.02) return this._lastRoom === d.b ? d.b : d.a;
    return Math.sign(ca - d.at) === Math.sign(p - d.at) ? d.a : (Math.sign(cb - d.at) === Math.sign(p - d.at) ? d.b : null);
  }

  _rooms(dt, cam, look, inside, aspect, fov, first) {
    let cur = this.sw.zoneRoom || null;
    if (cur && cur.startsWith('d_')) cur = this._doorSideRoom(cur) || this._lastRoom || this.roles.corridor;
    if (cur && !this.interior.rooms.has(cur)) cur = this._lastRoom || null;
    if (cur) this._lastRoom = cur; this.currentRoom = cur;
    let set;
    if (inside) {
      set = reachRooms({ portals: this._portals, starts: [cur || this.roles.cargo].filter((id) => this.interior.rooms.has(id)), cam, fwd: look,
        isOpen: (id) => { const dl = this.doorState.get(id); return !dl || dl.open > 0.001 || !!dl.was; }, fovDeg: fov, aspect, maxRooms: this.low ? 8 : 14 });
      this.interior.root.visible = true;
    } else {
      set = new Set();
      const dist = Math.hypot(cam.x, cam.y, cam.z);
      if (dist < 90) {
        const starts = [];
        if (dist < 60 && this.ramp.cargo > 0.02) starts.push(this.roles.cargo);
        if (dist < 40 && this.ramp.airlock > 0.05) starts.push(this.roles.airlock);
        if (starts.length) set = reachRooms({ portals: this._portals, starts: starts.filter((id) => this.interior.rooms.has(id)), cam, fwd: look,
          isOpen: (id) => { const dl = this.doorState.get(id); return !dl || dl.open > 0.001 || !!dl.was; }, fovDeg: fov, aspect, maxRooms: this.low ? 5 : 9, outside: true });
      }
      this.interior.root.visible = set.size > 0;
    }
    this.visible = set;
    for (const r of this.interior.roomList) r.group.visible = set.has(r.id);
    for (const e of this.interior.sharedGroups) e.g.visible = e.rooms.some((id) => set.has(id));
    // the hull is drawn only when it can be seen: always from outside, and from inside only through a room that looks out
    if (inside) {
      let looksOut = !cur;
      for (const id of set) if (id === this.roles.bridge || id === this.roles.cargo || (this.windowRooms.has(id) && !this.low)) looksOut = true;
      this.hardware.visible = false;
    } else this.hardware.visible = true;
    this.exterior.root.visible = true;
    // the nearest lamp fixtures get the pooled lights
    const fixtures = this.interior.lights, cand = [];
    for (let i = 0; i < fixtures.length; i++) { const L = fixtures[i]; if (!set.has(L.roomId)) continue; cand.push([Math.hypot(L.x - cam.x, (L.y - cam.y) * 0.6, L.z - cam.z), i]); }
    cand.sort((a, b) => a[0] - b[0]);
    const want = new Set(cand.slice(0, this.lightPool.length).map((c) => c[1])), free = [];
    for (const p of this.lightPool) { if (want.has(p.fixture)) { p.target = p.fixture; want.delete(p.fixture); } else free.push(p); }
    for (const idx of want) { const p = free.shift(); if (p) p.target = idx; }
    for (const p of free) p.target = -1;
    for (const p of this.lightPool) {
      const L = p.light;
      if (p.target !== p.fixture) {
        p.k = Math.max(0, p.k - dt * 5);
        if (p.k <= 0.001 || first) { p.fixture = p.target; if (p.fixture >= 0) { const fx = fixtures[p.fixture]; L.position.set(fx.x, fx.y - 0.25, fx.z); L.color.setHex(fx.color); L.distance = fx.range; L.userData.base = fx.intensity; } if (first) p.k = 1; }
      } else if (p.fixture >= 0) p.k = Math.min(1, p.k + dt * 5);
      L.intensity = p.fixture >= 0 ? (L.userData.base || 0) * p.k * (this.lampScale ?? 1) * (this.lampTint ? 1 : 1) : 0;
    }
    this.fill.position.set(cam.x, cam.y + 0.35, cam.z); this.fill.intensity = 5 * (this.lampScale ?? 1);
    const amb = (cur === this.roles.bridge ? 1.35 : 1.0) * (this.low ? 1.2 : 1.0) * (this.ambScale ?? 1);
    this.hemi.intensity += (amb - this.hemi.intensity) * Math.min(1, dt * 3);
  }

  dispose() {
    this.engine.untrack(this.entryExt); this.engine.untrack(this.entryInt);
    this.group.removeFromParent();
    for (const sc of [this.group, this.interiorScene]) sc.traverse((o) => { if (o.isMesh || o.isPoints) { o.geometry?.dispose(); } });
    this.decal?.map?.dispose(); this.decal?.dispose();
    this.interiorScene.clear();
  }
}

function engine_track(engine, entry) { return engine.track(entry); }
