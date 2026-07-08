// ============================================================================
// traversal.js — the surface ⇄ space TRAVERSAL state machine + atmosphere fade.
//
// OWNS: the player-mode state machine (ON_FOOT / PILOTING and the flight
//       phases LANDED / TAKEOFF / ATMOSPHERE / SPACE / APPROACH / DESCENT),
//       enter/exit-ship rules, and the continuous sky→space visual transition.
// DOES NOT OWN: physics (player.js / ship.js), UI text (ui.js reads state).
//
// THE CHAIN THIS FILE GUARANTEES (SYL canon, no loading screens):
//   surface → ascent → space → approach (another body) → descent → landing.
// There are NO teleports, NO scene swaps, NO fake cuts anywhere in it. The
// state is DERIVED each frame from real altitude/velocity/dominant-body — the
// machine never forces position, it only names what is physically happening
// and gates interactions (you can only exit a landed ship, etc.).
//
// PHASE DERIVATION (per frame, ship piloted):
//   LANDED      ship.landed
//   TAKEOFF     ascending, alt < atmosphere top (or < 25% radius if airless)
//   ATMOSPHERE  inside atmosphere band, not landed
//   SPACE       above the band of every body
//   APPROACH    descending toward a body, alt < 60% of its radius
//   DESCENT     descending, alt < atmosphere top / 25% radius
//
// Future agents: orbital phase (ORBIT) slots between SPACE and APPROACH once
// orbital mechanics land (ROADMAP). Add it as a derivation, not a teleport.
// ============================================================================

import * as THREE from 'three';
import { altitudeAt, dominantBody, upAt } from './planet.js';

export const MODE = { ON_FOOT: 'ON_FOOT', PILOTING: 'PILOTING', INSIDE_SHIP: 'INSIDE_SHIP' };
export const PHASE = {
  LANDED: 'LANDED', TAKEOFF: 'TAKEOFF', ATMOSPHERE: 'ATMOSPHERE',
  SPACE: 'SPACE', APPROACH: 'APPROACH', DESCENT: 'DESCENT', INSIDE: 'INSIDE',
};

const ENTER_RANGE = 7; // meters from ship to board

export class Traversal {
  constructor(bodies, worldState) {
    this.bodies = bodies;
    this.worldState = worldState;
    this.mode = MODE.ON_FOOT;
    this.phase = PHASE.LANDED;
    this.listeners = [];
  }

  on(fn) { this.listeners.push(fn); }
  _emit(name, payload) { for (const f of this.listeners) f(name, payload); }

  canEnterShip(player, ship) {
    return this.mode === MODE.ON_FOOT && ship.landed &&
      player.worldPos.distanceTo(ship.worldPos) < ENTER_RANGE;
  }

  enterShip(player, ship) {
    if (!this.canEnterShip(player, ship)) return false;
    this.mode = MODE.PILOTING;
    player.setVisible(false);
    this._emit('enteredShip');
    return true;
  }

  canExitShip(ship) { return this.mode === MODE.PILOTING && ship.landed; }

  exitShip(player, ship) {
    if (!this.canExitShip(ship)) return false;
    // Place the player beside the ship, on the ground, facing it.
    const body = dominantBody(this.bodies, ship.worldPos);
    const up = upAt(body, ship.worldPos, _up);
    const side = _side.set(1, 0, 0).applyQuaternion(ship.quaternion)
      .addScaledVector(up, -_side.dot(up)).normalize(); // tangent-plane side dir
    _pos.copy(ship.worldPos).addScaledVector(side, 5).addScaledVector(up, 1.5);
    player.placeAt(_pos);
    player.setVisible(true);
    this.mode = MODE.ON_FOOT;
    this._emit('exitedShip');
    return true;
  }

  canEnterShipInterior(player, ship) {
    return this.mode === MODE.ON_FOOT && ship.landed &&
      player.worldPos.distanceTo(ship.worldPos) < ENTER_RANGE;
  }

  enterShipInterior(player, ship) {
    if (!this.canEnterShipInterior(player, ship)) return false;
    this.mode = MODE.INSIDE_SHIP;
    player.setVisible(false);
    this._emit('enteredShipInterior');
    return true;
  }

  canExitShipInterior(ship) {
    return this.mode === MODE.INSIDE_SHIP && ship.landed;
  }

  exitShipInterior(player, ship) {
    if (!this.canExitShipInterior(ship)) return false;
    const body = dominantBody(this.bodies, ship.worldPos);
    const up = upAt(body, ship.worldPos, _up);
    const side = _side.set(1, 0, 0).applyQuaternion(ship.quaternion)
      .addScaledVector(up, -_side.dot(up)).normalize();
    _pos.copy(ship.worldPos).addScaledVector(side, 5).addScaledVector(up, 1.5);
    player.placeAt(_pos);
    player.setVisible(true);
    this.mode = MODE.ON_FOOT;
    this._emit('exitedShipInterior');
    return true;
  }

  // Derive the flight phase + drive atmosphere fade + world discovery.
  tick(player, ship, camera) {
    const focusPos = this.mode === MODE.PILOTING ? ship.worldPos : player.worldPos;
    const body = dominantBody(this.bodies, focusPos);
    this.worldState.setCurrentBody(body.id);

    if (this.mode === MODE.PILOTING) {
      const alt = Math.max(0, altitudeAt(body, ship.worldPos));
      const band = body.atmosphere ? body.atmosphere.height : body.radius * 0.25;
      const vUp = ship.velocity.dot(upAt(body, ship.worldPos, _up));
      let phase;
      if (ship.landed) phase = PHASE.LANDED;
      else if (alt >= band * 1.15) phase = alt < body.radius * 0.6 && vUp < -2 ? PHASE.APPROACH : PHASE.SPACE;
      else phase = vUp >= -0.5 ? PHASE.TAKEOFF : PHASE.DESCENT;
      if (phase === PHASE.TAKEOFF && alt > band * 0.3) phase = PHASE.ATMOSPHERE;

      if (phase !== this.phase) {
        this.phase = phase;
        this._emit('phase', phase);
        if (phase === PHASE.SPACE) this.worldState.setFlag('reachedSpace');
      }
    } else if (this.mode === MODE.INSIDE_SHIP) {
      this.phase = PHASE.INSIDE;
    } else {
      this.phase = PHASE.LANDED;
    }

    // --- Continuous sky: fade every atmosphere with camera altitude. -------
    // On the ground you see sky; climbing, the sky thins into starfield —
    // one continuous transition, never a skybox swap.
    for (const b of this.bodies) {
      if (!b._atmoMesh) continue;
      const alt = Math.max(0, altitudeAt(b, camera.worldPos ?? focusPos));
      const t = Math.min(1, alt / (b.atmosphere.height * 1.2));
      b._atmoMesh.material.opacity = 0.45 * (1 - t) * b.atmosphere.density + 0.04;
    }
  }
}

const _up = new THREE.Vector3(), _side = new THREE.Vector3(), _pos = new THREE.Vector3();
