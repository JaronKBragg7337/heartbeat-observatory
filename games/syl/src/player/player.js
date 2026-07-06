// ============================================================================
// player.js — the on-foot player: radial-gravity movement + camera control.
//
// OWNS: the player's authoritative position/velocity, spherical-surface
//       walking (Kurearthis RadialGravityPawn logic ported to JS), the
//       first-person look camera while on foot, and the player's visual body.
// DOES NOT OWN: ship flight (ship.js), state switching (traversal.js),
//               inventory contents (inventory.js).
//
// MOVEMENT MODEL (Kurearthis proof 2f, exactly):
//   - local up = radial direction from the dominant body's center (f64),
//   - input moves the capsule in the local TANGENT plane,
//   - gravity integrates downward along -up; a ground query against the
//     ANALYTIC terrain (planet.js) grounds the capsule,
//   - the body/camera re-orients so its up tracks the radial direction as
//     the player walks around the sphere's curvature.
// No CharacterMovementComponent equivalent, no flat +Z assumption anywhere.
//
// Future agents: swimming, sprint stamina, suits/oxygen extend here.
// ============================================================================

import * as THREE from 'three';
import { altitudeAt, upAt, gravityAt, dominantBody, terrainRadiusAt, resolveStructureCollision } from '../world/planet.js';

const EYE_HEIGHT = 1.65;
const WALK_SPEED = 7;
const RUN_SPEED = 13;
const JUMP_SPEED = 6.5;

export class Player {
  constructor(engine, input, bodies) {
    this.engine = engine;
    this.input = input;
    this.bodies = bodies;

    this.worldPos = new THREE.Vector3();   // authoritative f64 (feet position)
    this.velocity = new THREE.Vector3();
    this.grounded = false;

    // Orientation state: yaw/pitch relative to the local surface frame.
    this.yaw = 0;
    this.pitch = 0;
    this.mouseSensitivity = 1.0; // scaled by main.js from settings
    this._upSmooth = new THREE.Vector3(0, 1, 0); // smoothed up (avoids snapping)

    // Visual body (visible in ship 3rd-person view / future multiplayer).
    this.bodyMesh = new THREE.Group();
    const suit = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.35, 0.9, 4, 8),
      new THREE.MeshLambertMaterial({ color: 0x78909c })
    );
    suit.position.y = 0.85;
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.15, 0.1),
      new THREE.MeshBasicMaterial({ color: 0xd32f2f })
    );
    visor.position.set(0, 1.45, 0.28);
    this.bodyMesh.add(suit, visor);
    // First-person build: the LOCAL player's body is never rendered (it would
    // float in front of the camera). The mesh exists for third-person view and
    // multiplayer (ROADMAP M1/M5) — flip this then via setVisible.
    this.bodyMesh.visible = false;
    engine.scene.add(this.bodyMesh);
    this._trackEntry = engine.trackWorldObject({ worldPos: this.worldPos, object3d: this.bodyMesh });
  }

  setVisible(_v) { this.bodyMesh.visible = false; /* first-person: see ctor note */ }

  placeAt(worldPos) {
    this.worldPos.copy(worldPos);
    this.velocity.set(0, 0, 0);
    const b = dominantBody(this.bodies, this.worldPos);
    upAt(b, this.worldPos, this._upSmooth);
  }

  // Build the local surface frame: up (radial), forward/right from yaw.
  localFrame(up) {
    // Reference axis least aligned with up to derive a stable tangent.
    const ref = Math.abs(up.y) < 0.95 ? _refY : _refX;
    const east = _east.crossVectors(ref, up).normalize();
    const north = _north.crossVectors(up, east).normalize();
    // Yaw rotates around up; forward = cos(yaw)*north + sin(yaw)*east.
    const fwd = _fwd.copy(north).multiplyScalar(Math.cos(this.yaw))
      .addScaledVector(east, Math.sin(this.yaw)).normalize();
    const right = _right.crossVectors(fwd, up).normalize();
    return { up, fwd, right };
  }

  tick(dt, active) {
    const body = dominantBody(this.bodies, this.worldPos);
    this._domBody = body;
    const up = upAt(body, this.worldPos, _up);
    // Smooth the up vector so walking the curvature never snaps the camera.
    this._upSmooth.lerp(up, Math.min(1, 8 * dt)).normalize();

    if (active) {
      // Mouse look.
      this.yaw += this.input.mouseDX * 0.0023 * this.mouseSensitivity;
      this.pitch += this.input.mouseDY * 0.0023 * this.mouseSensitivity;
      this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
    }

    const { fwd, right } = this.localFrame(this._upSmooth);

    // Tangential input (Kurearthis: non-swept tangential move on open terrain;
    // the vertical/grounding step below is the swept part).
    const move = _move.set(0, 0, 0);
    if (active) {
      if (this.input.down('KeyW')) move.add(fwd);
      if (this.input.down('KeyS')) move.sub(fwd);
      if (this.input.down('KeyD')) move.add(right);
      if (this.input.down('KeyA')) move.sub(right);
    }
    const speed = this.input.down('ShiftLeft') ? RUN_SPEED : WALK_SPEED;
    if (move.lengthSq() > 0) move.normalize().multiplyScalar(speed);

    // Split velocity into vertical (along up) + tangential; input drives tangential.
    const vUp = this.velocity.dot(up);
    this.velocity.copy(move).addScaledVector(up, vUp);

    // Gravity from the dominant body (on foot, one frame matters most; the
    // full N-body sum is the ship's job where it's physically meaningful).
    const g = gravityAt(body, this.worldPos, _g);
    this.velocity.addScaledVector(g, dt);

    // Jump.
    if (active && this.grounded && this.input.down('Space')) {
      this.velocity.addScaledVector(up, JUMP_SPEED);
      this.grounded = false;
    }

    // Integrate (f64) then ground against the ANALYTIC surface — the swept
    // grounding move from Kurearthis proof 2e, done exactly.
    const beforeMove = _before.copy(this.worldPos);
    this.worldPos.addScaledVector(this.velocity, dt);
    const alt = altitudeAt(body, this.worldPos);
    if (alt <= 0) {
      // Clamp feet to the surface.
      const rel = _rel.subVectors(this.worldPos, body._centerV);
      const dist = rel.length();
      const dir = rel.multiplyScalar(1 / dist);
      const groundR = terrainRadiusAt(body, dir);
      this.worldPos.copy(dir).multiplyScalar(groundR).add(body._centerV);
      // Remove into-surface velocity (rest), keep tangential.
      const upNow = upAt(body, this.worldPos, _up2);
      const vIn = this.velocity.dot(upNow);
      if (vIn < 0) this.velocity.addScaledVector(upNow, -vIn);
      this.grounded = true;
    } else if (alt > 0.05) {
      this.grounded = false;
    }

    // Ship hull is SOLID to the player (2026-07-04): oriented-box blocker
    // matching the gunship silhouette. You can also land on and walk on the
    // roof. main.js sets shipRef after both entities exist.
    if (this.shipRef) this._collideWithShip(this.shipRef, up);

    // Civil transport fleet collision (2026-07-05).
    if (this.civilTransportFleet) {
      for (const transport of this.civilTransportFleet) {
        const push = transport.collide(this.worldPos, 0.45);
        if (push) {
          this.worldPos.add(push);
          if (push.lengthSq() > 1e-10) {
            push.normalize();
            const vInto = this.velocity.dot(push);
            if (vInto < 0) this.velocity.addScaledVector(push, -vInto);
          }
        }
      }
    }

    if (resolveStructureCollision(body, this.worldPos, 0.45)) {
      const push = _push.subVectors(this.worldPos, beforeMove);
      if (push.lengthSq() > 1e-8) {
        push.normalize();
        const intoWall = this.velocity.dot(push);
        if (intoWall < 0) this.velocity.addScaledVector(push, -intoWall);
      }
    }

    // Orient the visual body: feet down, facing yaw.
    const frame = this.localFrame(this._upSmooth);
    _m.makeBasis(frame.right, frame.up, _tmpV.copy(frame.fwd).negate());
    this.bodyMesh.quaternion.setFromRotationMatrix(_m);
  }

  // Push the player capsule out of the ship's oriented hull box.
  // Half-extents cover the code-built Fortis gunship silhouette (ship.js
  // rebuildVisual): width ~4.4, roof at +2.3, deck/keel at -0.9, length ~12.5.
  _collideWithShip(ship, up) {
    const R = 0.45;                       // player capsule radius
    const HX = 2.35, HZ = 6.4;            // hull half width / length
    const TOP = 2.3, BOTTOM = -0.95;      // hull vertical span (ship-local)
    _sq.copy(ship.quaternion).invert();
    _lp.subVectors(this.worldPos, ship.worldPos).applyQuaternion(_sq);
    const inX = Math.abs(_lp.x) < HX + R;
    const inZ = Math.abs(_lp.z) < HZ + R;
    const inY = _lp.y > BOTTOM - 1.8 && _lp.y < TOP; // capsule feet..head overlap
    if (!inX || !inZ || !inY) return;
    const px = HX + R - Math.abs(_lp.x);
    const pz = HZ + R - Math.abs(_lp.z);
    const pTop = TOP - _lp.y;
    _before2.copy(this.worldPos);
    if (pTop <= px && pTop <= pz) {
      _lp.y = TOP;                        // stand on the hull
      this.grounded = true;
    } else if (px <= pz) {
      _lp.x = Math.sign(_lp.x || 1) * (HX + R);
    } else {
      _lp.z = Math.sign(_lp.z || 1) * (HZ + R);
    }
    this.worldPos.copy(_lp).applyQuaternion(ship.quaternion).add(ship.worldPos);
    // Kill velocity INTO the hull along the push direction.
    _push2.subVectors(this.worldPos, _before2);
    if (_push2.lengthSq() > 1e-10) {
      _push2.normalize();
      const vInto = this.velocity.dot(_push2);
      if (vInto < 0) this.velocity.addScaledVector(_push2, -vInto);
    }
  }

  // First-person camera pose for the engine (worldPos + quaternion).
  cameraPose(outPos, outQuat) {
    const { up, fwd, right } = this.localFrame(this._upSmooth);
    outPos.copy(this.worldPos).addScaledVector(up, EYE_HEIGHT);
    // Apply pitch around the right axis.
    const lookFwd = _tmpV.copy(fwd).applyAxisAngle(right, this.pitch);
    _m.lookAt(_zero.set(0, 0, 0), _tmpV2.copy(lookFwd), up);
    outQuat.setFromRotationMatrix(_m);
  }

  dominant() { return this._domBody; }

  serialize() {
    return {
      worldPos: this.worldPos.toArray(),
      velocity: this.velocity.toArray(),
      yaw: this.yaw, pitch: this.pitch,
    };
  }
  deserialize(data) {
    if (!data) return;
    this.worldPos.fromArray(data.worldPos);
    this.velocity.fromArray(data.velocity);
    this.yaw = data.yaw || 0; this.pitch = data.pitch || 0;
    const b = dominantBody(this.bodies, this.worldPos);
    upAt(b, this.worldPos, this._upSmooth);
  }
}

// Module-scope temps.
const _up = new THREE.Vector3(), _up2 = new THREE.Vector3(), _g = new THREE.Vector3();
const _move = new THREE.Vector3(), _rel = new THREE.Vector3();
const _before = new THREE.Vector3(), _push = new THREE.Vector3();
const _east = new THREE.Vector3(), _north = new THREE.Vector3();
const _fwd = new THREE.Vector3(), _right = new THREE.Vector3();
const _refY = new THREE.Vector3(0, 1, 0), _refX = new THREE.Vector3(1, 0, 0);
const _m = new THREE.Matrix4(), _tmpV = new THREE.Vector3(), _tmpV2 = new THREE.Vector3();
const _sq = new THREE.Quaternion(), _lp = new THREE.Vector3();
const _before2 = new THREE.Vector3(), _push2 = new THREE.Vector3();
const _zero = new THREE.Vector3();
