// ============================================================================
// civilTransport.js — automated passenger transport between planetary bases.
//
// OWNS: a scripted-but-continuous public transport ship, route stop data, its
//       visual, boarding/disembarking rules, and passenger camera pose.
// DOES NOT OWN: player ship physics, traversal phases, save payloads, or body
//               registries. Stops reference normal landing-zone data.
//
// SYL law: this is not a teleport. The carrier has one authoritative f64
// worldPos, a visible tracked mesh, and moves continuously from base to base.
// Players who do not want to fly can board it like a train/bus and physically
// ride across the solar-system scale to the next stop.
// ============================================================================

import * as THREE from 'three';
import { zoneWorldPos, upAt, dominantBody } from './planet.js';

export const CIVIL_TRANSPORT_STOPS = [
  { bodyId: 'earth', zoneId: 'fortis_civil_terminal', label: 'Earth / Fortis Civil Terminal' },
  { bodyId: 'moon', zoneId: 'tranquility_transit_hub', label: 'Moon / Tranquility Civil Hub' },
  { bodyId: 'aethelgard', zoneId: 'halcyon_civil_quay', label: 'Aethelgard / Halcyon Civil Quay' },
  { bodyId: 'pyrrhus', zoneId: 'fortis_bastion_terminal', label: 'Pyrrhus / Bastion Terminal' },
  { bodyId: 'veldora', zoneId: 'kindred_public_mooring', label: 'Veldora / Kindred Public Mooring' },
  { bodyId: 'dunewind', zoneId: 'freeport_dune_terminal', label: 'Dunewind / Freeport Transit Berth' },
  { bodyId: 'rustholm', zoneId: 'freeport_transit_dock', label: 'Rustholm / Freeport Transit Dock' },
];

const BOARD_RANGE = 16;
const DEFAULT_LEG_SECONDS = 70;
const DEFAULT_DWELL_SECONDS = 20;

export class CivilTransport {
  constructor(engine, bodies, options = {}) {
    this.engine = engine;
    this.bodies = bodies;
    this.legSeconds = options.legSeconds || DEFAULT_LEG_SECONDS;
    this.dwellSeconds = options.dwellSeconds || DEFAULT_DWELL_SECONDS;
    this.routeIndex = options.startStopIndex || 0;
    this.phaseOffset = options.phaseOffset || 0;
    this.legT = 0;
    this.state = 'docked';
    this.dwellT = this.dwellSeconds + this.phaseOffset;
    if (this.phaseOffset < 0) {
      this.state = 'travel';
      this.legT = Math.min(1, -this.phaseOffset / this.legSeconds);
      this.dwellT = this.dwellSeconds;
    }
    this.passenger = false;
    this.worldPos = new THREE.Vector3();
    this.quaternion = new THREE.Quaternion();
    this.group = buildTransportVisual();
    engine.scene.add(this.group);
    this._trackEntry = engine.trackWorldObject({
      worldPos: this.worldPos,
      object3d: this.group,
      quaternion: this.quaternion,
    });
    this.placeAtStop(this.routeIndex);

    // Door + interior
    this.doorOpen = false;
    this.doorAngle = 0;
    this.interior = {
      floorY: -0.3,
      ceilingY: 2.0,
      portX: -2.0,
      starboardX: 2.0,
      rearZ: -5.5,
      frontZ: 4.0,
    };
  }

  currentStop() { return this._resolveStop(this.routeIndex); }
  nextStop() { return this._resolveStop((this.routeIndex + 1) % CIVIL_TRANSPORT_STOPS.length); }
  isDocked() { return this.state === 'docked'; }
  destinationLabel() { return this.nextStop().label; }

  routeSummary() {
    return CIVIL_TRANSPORT_STOPS.map((stop, i) => ({
      ...stop,
      active: i === this.routeIndex && this.isDocked(),
      next: i === ((this.routeIndex + 1) % CIVIL_TRANSPORT_STOPS.length),
    }));
  }

  canBoard(player) {
    return this.isDocked() && !this.passenger && player.worldPos.distanceTo(this.worldPos) <= BOARD_RANGE;
  }

  board(player) {
    if (!this.canBoard(player)) return false;
    this.passenger = true;
    player.setVisible(false);
    this._carryPassenger(player);
    return true;
  }

  canDisembark() { return this.passenger && this.isDocked(); }

  disembark(player) {
    if (!this.canDisembark()) return false;
    const stop = this.currentStop();
    const body = stop.body;
    const up = upAt(body, this.worldPos, _up);
    const side = _right.set(1, 0, 0).applyQuaternion(this.quaternion)
      .addScaledVector(up, -_right.dot(up));
    if (side.lengthSq() < 1e-6) side.crossVectors(up, new THREE.Vector3(0, 0, 1));
    side.normalize();
    player.placeAt(zoneWorldPos(body, stop.zone, 0.4).addScaledVector(side, 12));
    player.setVisible(true);
    this.passenger = false;
    return true;
  }

  tick(dt, player = null) {
    if (this.state === 'docked') {
      this.dwellT -= dt;
      if (this.dwellT <= 0) {
        this.state = 'travel';
        this.legT = 0;
      }
    } else {
      this.legT += dt / this.legSeconds;
      if (this.legT >= 1) {
        this.routeIndex = (this.routeIndex + 1) % CIVIL_TRANSPORT_STOPS.length;
        this.placeAtStop(this.routeIndex);
        this.state = 'docked';
        this.dwellT = this.dwellSeconds;
      } else {
        this._placeAlongLeg(this.legT);
      }
    }
    if (this.passenger && player) this._carryPassenger(player);
  }

  passengerCameraPose(outPos, outQuat) {
    const up = upAt(dominantBody(this.bodies, this.worldPos), this.worldPos, _camUp);
    const fwd = _camFwd.set(0, 0, 1).applyQuaternion(this.quaternion).normalize();
    outPos.copy(this.worldPos)
      .addScaledVector(up, 7)
      .addScaledVector(fwd, -22);
    _camTarget.copy(this.worldPos).addScaledVector(fwd, 32).addScaledVector(up, 2.2);
    _look.lookAt(outPos, _camTarget, up);
    outQuat.setFromRotationMatrix(_look);
  }

  placeAtStop(index) {
    const stop = this._resolveStop(index);
    this.worldPos.copy(zoneWorldPos(stop.body, stop.zone, 5.8));
    this._orientToward(this.nextStop().pos);
  }

  _placeAlongLeg(rawT) {
    const a = this.currentStop();
    const b = this.nextStop();
    const t = smooth(rawT);
    const direct = _direct.subVectors(b.pos, a.pos);
    const dist = direct.length();
    const lift = Math.max(2600, Math.min(16000, dist * 0.22));
    const arcUp = _arcUp.addVectors(a.up, b.up);
    if (arcUp.lengthSq() < 1e-6) arcUp.copy(a.up);
    arcUp.normalize();
    this.worldPos.copy(a.pos).lerp(b.pos, t)
      .addScaledVector(arcUp, Math.sin(Math.PI * t) * lift);
    this._orientToward(rawT < 0.98 ? _future.copy(this.worldPos).add(direct) : b.pos);
  }

  _carryPassenger(player) {
    const up = upAt(dominantBody(this.bodies, this.worldPos), this.worldPos, _up);
    player.worldPos.copy(this.worldPos).addScaledVector(up, 2.2);
    player.velocity.set(0, 0, 0);
  }

  // ------------------------------------------------------------------
  // Collision: oriented-box against the transport hull (cabin footprint).
  // Returns a push vector (THREE.Vector3) or null if no overlap.
  // ------------------------------------------------------------------
  collide(playerWorldPos, radius = 0.45) {
    const invQ = _tcQ.copy(this.quaternion).invert();
    const lp = _tcP.subVectors(playerWorldPos, this.worldPos).applyQuaternion(invQ);
    const HX = 3.75 + radius; // half-width 7.5/2
    const HY = 1.6 + radius;  // half-height 3.2/2
    const HZ = 10.0 + radius; // half-length 20/2
    if (Math.abs(lp.x) >= HX || Math.abs(lp.y) >= HY || Math.abs(lp.z) >= HZ) return null;
    const px = HX - Math.abs(lp.x);
    const py = HY - Math.abs(lp.y);
    const pz = HZ - Math.abs(lp.z);
    if (py <= px && py <= pz) {
      lp.y = Math.sign(lp.y || 1) * HY;
    } else if (px <= py && px <= pz) {
      lp.x = Math.sign(lp.x || 1) * HX;
    } else {
      lp.z = Math.sign(lp.z || 1) * HZ;
    }
    const newPos = _tcNew.copy(lp).applyQuaternion(this.quaternion).add(this.worldPos);
    return _tcPush.subVectors(newPos, playerWorldPos);
  }

  nudgeIfOverlappingPlayer(player) {
    if (!player) return;
    const push = this.collide(player.worldPos, 0.45);
    if (push) {
      this.worldPos.sub(push);
      this.group.position.copy(this.worldPos);
    }
  }

  // ------------------------------------------------------------------
  // Interior camera (fixed seat inside the cabin, looking forward).
  // ------------------------------------------------------------------
  interiorCameraPose(outPos, outQuat) {
    const up = upAt(dominantBody(this.bodies, this.worldPos), this.worldPos, _camUp);
    const fwd = _camFwd.set(0, 0, 1).applyQuaternion(this.quaternion).normalize();
    outPos.copy(this.worldPos)
      .addScaledVector(up, 0.5)
      .addScaledVector(fwd, -2);
    _camTarget.copy(this.worldPos).addScaledVector(fwd, 10).addScaledVector(up, 0.5);
    _look.lookAt(outPos, _camTarget, up);
    outQuat.setFromRotationMatrix(_look);
  }

  // ------------------------------------------------------------------
  // Door toggle (simple ramp animation).
  // ------------------------------------------------------------------
  toggleDoor() {
    this.doorOpen = !this.doorOpen;
    this._updateRampVisual();
  }

  _updateRampVisual() {
    const ramp = this.group.getObjectByName('transport:boarding-ramp');
    if (ramp) {
      ramp.rotation.x = this.doorOpen ? -1.0 : -0.25;
    }
  }

  _orientToward(target) {
    const body = dominantBody(this.bodies, this.worldPos);
    const up = upAt(body, this.worldPos, _up);
    const fwd = _fwd.subVectors(target, this.worldPos).addScaledVector(up, -_fwd.dot(up));
    if (fwd.lengthSq() < 1e-6) fwd.subVectors(target, this.worldPos);
    if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, 1);
    fwd.normalize();
    const right = _right.crossVectors(up, fwd).normalize();
    const correctedUp = _correctedUp.crossVectors(fwd, right).normalize();
    _basis.makeBasis(right, correctedUp, fwd);
    this.quaternion.setFromRotationMatrix(_basis);
  }

  _resolveStop(index) {
    const spec = CIVIL_TRANSPORT_STOPS[index % CIVIL_TRANSPORT_STOPS.length];
    const body = this.bodies.find((b) => b.id === spec.bodyId);
    if (!body) throw new Error(`Civil transport stop missing body: ${spec.bodyId}`);
    const zone = body.landingZones.find((z) => z.id === spec.zoneId);
    if (!zone) throw new Error(`Civil transport stop missing zone: ${spec.bodyId}/${spec.zoneId}`);
    const pos = zoneWorldPos(body, zone, 5.8);
    const up = upAt(body, pos, new THREE.Vector3());
    return { ...spec, body, zone, pos, up };
  }
}

function buildTransportVisual() {
  const g = new THREE.Group();
  g.name = 'civil-transport:Fortis-Peregrine-Line';
  const hull = new THREE.MeshLambertMaterial({ color: 0x607d8b });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1f2a30 });
  const glass = new THREE.MeshLambertMaterial({ color: 0xb3e5fc, transparent: true, opacity: 0.46 });
  const red = new THREE.MeshLambertMaterial({ color: 0xb71c1c });
  addBox(g, 'transport:cabin', [0, 0, 0], [7.5, 3.2, 20], hull);
  addBox(g, 'transport:keel', [0, -1.85, -0.8], [2.2, 0.9, 18], dark);
  addBox(g, 'transport:window-left', [-3.82, 0.72, 1.6], [0.18, 1.15, 12], glass);
  addBox(g, 'transport:window-right', [3.82, 0.72, 1.6], [0.18, 1.15, 12], glass);
  addBox(g, 'transport:nose-band', [0, 0.2, 9.7], [6.2, 2.2, 0.45], red);
  addBox(g, 'transport:left-wing', [-5.2, -0.3, -2.0], [4.7, 0.34, 6.4], hull);
  addBox(g, 'transport:right-wing', [5.2, -0.3, -2.0], [4.7, 0.34, 6.4], hull);
  addCyl(g, 'transport:left-engine', [-4.7, -0.7, -6.3], 0.9, 2.8, dark);
  addCyl(g, 'transport:right-engine', [4.7, -0.7, -6.3], 0.9, 2.8, dark);
  addBox(g, 'transport:boarding-ramp', [0, -1.95, 7.2], [4.8, 0.22, 4.0], red, { x: -0.25 });
  const beacon = new THREE.PointLight(0xffcc80, 1.8, 40);
  beacon.position.set(0, 2.7, 8.5);
  g.add(beacon);
  return g;
}

function addBox(parent, name, center, size, mat, rot = null) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
  mesh.name = name;
  mesh.position.fromArray(center);
  if (rot?.x) mesh.rotateX(rot.x);
  if (rot?.y) mesh.rotateY(rot.y);
  if (rot?.z) mesh.rotateZ(rot.z);
  parent.add(mesh);
  return mesh;
}

function addCyl(parent, name, center, radius, depth, mat) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.08, depth, 16), mat);
  mesh.name = name;
  mesh.position.fromArray(center);
  mesh.rotateX(Math.PI / 2);
  parent.add(mesh);
  return mesh;
}

function smooth(t) { return t * t * (3 - 2 * t); }

const _up = new THREE.Vector3(), _fwd = new THREE.Vector3(), _right = new THREE.Vector3();
const _correctedUp = new THREE.Vector3(), _basis = new THREE.Matrix4();
const _direct = new THREE.Vector3(), _arcUp = new THREE.Vector3(), _future = new THREE.Vector3();
const _camUp = new THREE.Vector3(), _camFwd = new THREE.Vector3(), _camTarget = new THREE.Vector3();
const _look = new THREE.Matrix4();
const _tcQ = new THREE.Quaternion(), _tcP = new THREE.Vector3(), _tcNew = new THREE.Vector3(), _tcPush = new THREE.Vector3();
