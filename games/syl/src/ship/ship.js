// ============================================================================
// ship.js — the ship ENTITY: live module state, stats, flight physics, visual.
//
// OWNS: one ship's installed modules, fuel/health, computed stats, its
//       6-DOF flight integration, and its piece-by-piece visual mesh.
// DOES NOT OWN: part definitions (shipParts.js), install/repair rules
//               (shipBuilder.js), pilot state machine (traversal.js),
//               camera (main.js decides views).
//
// PHYSICS (Kurearthis truth — custom double-precision integrator, NO physics
// engine): worldPos/velocity are f64 THREE.Vector3. Each tick:
//   1. thrust (ship-local, rotated to world) if powered+fueled,
//   2. gravity from ALL bodies (inverse-square; second-body coexistence),
//   3. integrate velocity -> position,
//   4. analytic ground collision vs dominant body: if the hull would pass
//      below terrain, clamp to surface; soft touchdown vs crash by speed.
// Rotation: pitch/yaw/roll rates with damping — arcade-stable, honest forces.
//
// Future agents: orbital mechanics = remove linear damping in space + add
// velocity readouts; the integrator already supports it (see ROADMAP).
// ============================================================================

import * as THREE from 'three';
import { PART_TYPES, SLOTS, READINESS_RULES, getPartType } from './shipParts.js';
import { gravityAt, altitudeAt, upAt, dominantBody, terrainRadiusAt } from '../world/planet.js';

const HULL_CLEARANCE = 1.9;   // meters from ship origin to landing-gear feet
const CRASH_SPEED = 16;       // m/s vertical impact that damages modules
const SAFE_LAND_SPEED = 8;    // m/s comfortable touchdown
// Rotation feel (tunable). YAW was the weak axis: turning felt sluggish and,
// on phone, a look-drag can't HOLD a turn. Raised yaw authority + eased damping,
// and main.js now also feeds A/D plus touch analog steering into yaw.
const PITCH_RATE = 2.4;   // was 2.2
const YAW_RATE   = 2.7;   // was 1.8 — the main 'I can't turn' fix
const ROLL_RATE  = 2.4;
const ROT_DAMP   = 2.2;   // was 3.0 — eased so a turn builds and holds
const ASSIST_YAW_RATE = 2.9; // direct heading steering for assisted piloting
const ASSIST_FORWARD_SPEED = 62; // m/s direct dev-fly-like ship flight
const ASSIST_LIFT_SPEED = 30;
const ASSIST_RESPONSE = 5.5;

export class Ship {
  constructor(engine, bodies) {
    this.engine = engine;
    this.bodies = bodies;

    // --- Authoritative f64 state (floating-origin rule: never in mesh). ----
    this.worldPos = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.quaternion = new THREE.Quaternion(); // ship orientation (world)
    this.angVel = new THREE.Vector3();        // pitch(x), yaw(y), roll(z) rad/s

    // --- Modules: slotId -> { typeId, hp } | null ---------------------------
    this.modules = {};
    for (const s of SLOTS) this.modules[s.slotId] = null;

    this.fuel = 0;          // units, capped by stats.fuelCap
    this.landed = true;
    this.gearDown = true;
    this.throttle = 0;      // 0..1 main thrust setting

    this.stats = this.computeStats();

    // --- Visual: a group rebuilt from modules (piece-by-piece, for real). ---
    this.group = new THREE.Group();
    this.group.name = 'ship';
    engine.scene.add(this.group);
    this._trackEntry = engine.trackWorldObject({ worldPos: this.worldPos, object3d: this.group });
    this.rebuildVisual();
  }

  // ------------------------------------------------------------------ stats
  computeStats() {
    const s = { mass: 80, thrust: 0, fuelCap: 0, powerDraw: 0, powerSupply: 0,
                cargoCap: 0, armor: 0, gearCount: 0, missing: [], degraded: [] };
    const present = new Set();
    for (const [slotId, mod] of Object.entries(this.modules)) {
      if (!mod) continue;
      const t = getPartType(mod.typeId);
      const healthy = mod.hp / t.maxHp >= READINESS_RULES.degradedBelowFrac;
      s.mass += t.mass;
      if (healthy) {
        present.add(t.id);
        if (t.thrust) s.thrust += t.thrust;
        if (t.fuelCap) s.fuelCap += t.fuelCap;
        if (t.powerDraw) s.powerDraw += t.powerDraw;
        if (t.powerSupply) s.powerSupply += t.powerSupply;
        if (t.cargoCap) s.cargoCap += t.cargoCap;
        if (t.armor) s.armor += t.armor;
        if (t.id === 'gear') s.gearCount++;
      } else {
        s.degraded.push({ slotId, typeId: mod.typeId });
      }
    }
    for (const req of READINESS_RULES.requiredTypes) {
      if (!present.has(req)) s.missing.push(req);
    }
    if (s.gearCount < READINESS_RULES.minGear) s.missing.push(`gear x${READINESS_RULES.minGear - s.gearCount}`);
    if (s.powerSupply < s.powerDraw) s.missing.push('power (supply < draw)');
    s.ready = s.missing.length === 0;
    this.fuel = Math.min(this.fuel, s.fuelCap);
    return s;
  }

  refreshStats() { this.stats = this.computeStats(); return this.stats; }

  // ------------------------------------------------------------------ visual
  // Build the ship mesh from installed modules. Called on every install/
  // remove/repair — the ship LOOKS like what it IS.
  rebuildVisual() {
    this.group.clear();
    for (const slot of SLOTS) {
      const mod = this.modules[slot.slotId];
      if (!mod) continue;
      const t = getPartType(mod.typeId);
      let mesh;
      if (t.visual.kind === 'cyl') {
        mesh = new THREE.Mesh(
          new THREE.CylinderGeometry(t.visual.size[0], t.visual.size[0] * 1.15, t.visual.size[1], 10),
          new THREE.MeshLambertMaterial({ color: t.visual.color })
        );
        if (slot.rotate === 'back') mesh.rotateX(Math.PI / 2);
      } else {
        mesh = new THREE.Mesh(
          new THREE.BoxGeometry(...t.visual.size),
          new THREE.MeshLambertMaterial({ color: t.visual.color })
        );
      }
      // Damaged modules render darker — visible truth, not a hidden stat.
      const frac = mod.hp / t.maxHp;
      if (frac < READINESS_RULES.degradedBelowFrac) mesh.material.color.multiplyScalar(0.35);
      else if (frac < 0.8) mesh.material.color.multiplyScalar(0.7);
      mesh.position.fromArray(slot.offset);
      mesh.name = `mod:${slot.slotId}`;
      this.group.add(mesh);
    }
    // Engine glow when thrusting (updated in tick).
    this._glow = new THREE.PointLight(0xff6d3f, 0, 30);
    this._glow.position.set(0, 0, -4.2);
    this.group.add(this._glow);
  }

  // ------------------------------------------------------------------ placing
  placeAt(worldPos, upDir) {
    this.worldPos.copy(worldPos);
    this.velocity.set(0, 0, 0);
    this.angVel.set(0, 0, 0);
    // Orient: ship +Y along up, keep an arbitrary forward.
    this.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), upDir);
    this.landed = true;
    this.gearDown = true;
    this.throttle = 0;
  }

  // ------------------------------------------------------------------ flight
  // controls: { pitch, yaw, roll: -1..1; thrustUp: bool; brake: bool; assist?: bool; assistForward?: -1..1 }
  tick(dt, piloted, controls) {
    const body = dominantBody(this.bodies, this.worldPos);
    this._domBody = body;

    const up = upAt(body, this.worldPos, _up);
    const alt = altitudeAt(body, this.worldPos) - HULL_CLEARANCE;
    this._altitude = alt;

    if (this.landed && (!piloted || this.throttle <= 0 && !(controls && controls.thrustUp))) {
      // Resting on ground: stay put (terrain is static; no drift).
      this.velocity.set(0, 0, 0);
      if (this._glow) this._glow.intensity = 0;
      return;
    }

    const accel = _accel.set(0, 0, 0);
    const assisted = !!(piloted && controls && (controls.assist || controls.mobileAssist));

    if (assisted) {
      // Assisted piloting uses the dev-fly feel: yaw changes the real travel
      // heading directly and the hull stays upright relative to the nearest
      // body. This avoids the "camera turned but ship stayed on a rail" feel.
      if (controls.yaw) {
        _q.setFromAxisAngle(up, controls.yaw * ASSIST_YAW_RATE * dt);
        this.quaternion.premultiply(_q).normalize();
      }
      const fwdFlat = _mobileFwd.set(0, 0, 1).applyQuaternion(this.quaternion)
        .addScaledVector(up, -_mobileFwd.dot(up));
      if (fwdFlat.lengthSq() < 1e-6) {
        fwdFlat.set(1, 0, 0).addScaledVector(up, -fwdFlat.dot(up));
      }
      fwdFlat.normalize();
      _mobileRight.crossVectors(up, fwdFlat).normalize();
      _mobileMatrix.makeBasis(_mobileRight, up, fwdFlat);
      this.quaternion.setFromRotationMatrix(_mobileMatrix);
      this.angVel.set(0, 0, 0);

      if (this.stats.ready && this.fuel > 0) {
        const forward = Math.max(-1, Math.min(1, controls.assistForward ?? this.throttle));
        const target = _mobileVel.copy(fwdFlat).multiplyScalar(forward * ASSIST_FORWARD_SPEED);
        if (controls.thrustUp) target.addScaledVector(up, ASSIST_LIFT_SPEED);
        if (controls.brake) target.multiplyScalar(0.15);
        this.velocity.lerp(target, Math.min(1, ASSIST_RESPONSE * dt));
        const burn = (Math.abs(forward) * 0.45 + (controls.thrustUp ? 0.35 : 0)) * dt;
        this.fuel = Math.max(0, this.fuel - burn);
        if (this._glow) this._glow.intensity = Math.abs(forward) > 0.01 || controls.thrustUp ? 3.5 : 0;
        this.worldPos.addScaledVector(this.velocity, dt);
        this.landed = false;
        this._altitude = altitudeAt(body, this.worldPos) - HULL_CLEARANCE;
        return;
      }
    }

    // 1. Thrust — only if piloted, ready, powered, fueled.
    let burning = 0;
    if (piloted && this.stats.ready && this.fuel > 0) {
      const fwd = _fwd.set(0, 0, 1).applyQuaternion(this.quaternion);
      if (assisted) {
        fwd.addScaledVector(up, -fwd.dot(up));
        if (fwd.lengthSq() < 1e-6) fwd.set(1, 0, 0).addScaledVector(up, -fwd.dot(up));
        fwd.normalize();
      }
      if (this.throttle > 0) {
        accel.addScaledVector(fwd, (this.stats.thrust * this.throttle) / this.stats.mass);
        burning += this.throttle;
      }
      if (controls && controls.thrustUp) {
        const shipUp = assisted ? up : _shipUp.set(0, 1, 0).applyQuaternion(this.quaternion);
        accel.addScaledVector(shipUp, (this.stats.thrust * 0.75) / this.stats.mass);
        burning += 0.75;
      }
      this.fuel = Math.max(0, this.fuel - burning * dt * 0.55);
    }
    if (this._glow) this._glow.intensity = burning > 0 ? 3.5 : 0;

    // 2. Gravity from ALL bodies (second-body coexistence is real).
    for (const b of this.bodies) {
      accel.add(gravityAt(b, this.worldPos, _g));
    }

    // 3. Integrate.
    this.velocity.addScaledVector(accel, dt);

    // Braking/damping: space brake kills velocity gradually (honest RCS-style).
    if (piloted && controls && controls.brake) {
      this.velocity.multiplyScalar(Math.max(0, 1 - 1.6 * dt));
    }
    // Mild atmospheric drag inside an atmosphere (also aids stable landings).
    if (body.atmosphere && alt < body.atmosphere.height) {
      const density = 1 - Math.max(0, alt) / body.atmosphere.height;
      this.velocity.multiplyScalar(Math.max(0, 1 - 0.12 * density * dt));
    }

    this.worldPos.addScaledVector(this.velocity, dt);

    // 4. Rotation: rates from controls, damped.
    if (piloted && controls && !assisted) {
      this.angVel.x += controls.pitch * PITCH_RATE * dt;
      this.angVel.y += controls.yaw * YAW_RATE * dt;
      this.angVel.z += controls.roll * ROLL_RATE * dt;
    }
    this.angVel.multiplyScalar(Math.max(0, 1 - ROT_DAMP * dt)); // rotational damping
    _dq.setFromEuler(_eul.set(this.angVel.x * dt, this.angVel.y * dt, this.angVel.z * dt, 'XYZ'));
    this.quaternion.multiply(_dq).normalize();

    // 5. Analytic ground collision vs dominant body (never a giant mesh).
    const newAlt = altitudeAt(body, this.worldPos) - HULL_CLEARANCE;
    if (newAlt <= 0) {
      const upNow = upAt(body, this.worldPos, _up2);
      const vDown = this.velocity.dot(upNow); // negative = descending
      // Clamp to the surface.
      const rel = _rel.subVectors(this.worldPos, body._centerV);
      const dist = rel.length();
      const dir = rel.multiplyScalar(1 / dist);
      const groundR = terrainRadiusAt(body, dir) + HULL_CLEARANCE;
      this.worldPos.copy(dir).multiplyScalar(groundR).add(body._centerV);

      if (-vDown > CRASH_SPEED) {
        this.applyCrashDamage(-vDown);
      }
      if (-vDown > SAFE_LAND_SPEED * 2.5) {
        // Hard bounce.
        this.velocity.addScaledVector(upNow, -vDown * 0.35);
      } else {
        // Touchdown: kill velocity, settle upright, mark landed.
        this.velocity.set(0, 0, 0);
        this.angVel.set(0, 0, 0);
        const settle = _q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), upNow);
        this.quaternion.slerp(settle, 0.5);
        this.landed = true;
        this.throttle = 0;
      }
    } else {
      this.landed = false;
    }
  }

  applyCrashDamage(impactSpeed) {
    const dmg = (impactSpeed - CRASH_SPEED) * 2.5;
    // Gear takes it first, then random modules — armor reduces it.
    const armorScale = 1 - Math.min(0.6, this.stats.armor / 120);
    const slots = Object.entries(this.modules).filter(([, m]) => m);
    for (const [slotId, mod] of slots) {
      const t = getPartType(mod.typeId);
      const share = t.id === 'gear' ? 1.5 : 0.6;
      mod.hp = Math.max(0, mod.hp - dmg * share * armorScale * Math.random());
    }
    this.refreshStats();
    this.rebuildVisual();
    if (this._onCrash) this._onCrash(impactSpeed);
  }

  speed() { return this.velocity.length(); }
  altitude() { return this._altitude ?? 0; }
  dominant() { return this._domBody; }

  // ------------------------------------------------------------------ save
  serialize() {
    const mods = {};
    for (const [slotId, m] of Object.entries(this.modules)) {
      mods[slotId] = m ? { typeId: m.typeId, hp: Math.round(m.hp * 10) / 10 } : null;
    }
    return {
      worldPos: this.worldPos.toArray(),
      velocity: this.velocity.toArray(),
      quaternion: this.quaternion.toArray(),
      modules: mods,
      fuel: Math.round(this.fuel * 10) / 10,
      landed: this.landed,
      gearDown: this.gearDown,
    };
  }

  deserialize(data) {
    if (!data) return;
    this.worldPos.fromArray(data.worldPos);
    this.velocity.fromArray(data.velocity);
    this.quaternion.fromArray(data.quaternion);
    for (const s of SLOTS) this.modules[s.slotId] = data.modules?.[s.slotId] || null;
    this.fuel = data.fuel || 0;
    this.landed = !!data.landed;
    this.gearDown = data.gearDown !== false;
    this.refreshStats();
    this.rebuildVisual();
  }
}

// Module-scope temps (no per-frame allocation).
const _up = new THREE.Vector3(), _up2 = new THREE.Vector3(), _shipUp = new THREE.Vector3();
const _fwd = new THREE.Vector3(), _accel = new THREE.Vector3(), _g = new THREE.Vector3();
const _rel = new THREE.Vector3(), _dq = new THREE.Quaternion(), _q = new THREE.Quaternion();
const _eul = new THREE.Euler();
const _mobileFwd = new THREE.Vector3(), _mobileRight = new THREE.Vector3();
const _mobileVel = new THREE.Vector3();
const _mobileMatrix = new THREE.Matrix4();
