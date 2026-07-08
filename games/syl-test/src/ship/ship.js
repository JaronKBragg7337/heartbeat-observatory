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
import { gravityAt, altitudeAt, upAt, dominantBody, terrainRadiusAt, resolveStructureCollision } from '../world/planet.js';
import { enableShadows } from '../render/props.js';
import { TUNE } from '../dev/tuner.js';

const HULL_CLEARANCE = 1.9;   // meters from ship origin to landing-gear feet
const HULL_RADIUS = 4.8;      // simple analytic footprint for structures
const CRASH_SPEED = 16;       // m/s vertical impact that damages modules
const SAFE_LAND_SPEED = 8;    // m/s comfortable touchdown
// Rotation feel (tunable). YAW was the weak axis: turning felt sluggish and,
// on phone, a look-drag can't HOLD a turn. Raised yaw authority + eased damping,
// and main.js now also feeds A/D plus touch analog steering into yaw.
const PITCH_RATE = 2.4;   // was 2.2
const YAW_RATE   = 2.7;   // was 1.8 — the main 'I can't turn' fix
const ROLL_RATE  = 2.4;
const ROT_DAMP   = 2.2;   // was 3.0 — eased so a turn builds and holds
const ASSIST_YAW_RATE = 3.2; // direct heading steering for assisted piloting
const ASSIST_PITCH_RATE = 2.4; // nose-up/down attitude steering once safely airborne
const ASSIST_FORWARD_ACCEL = 48; // m/s^2 through the ship nose
const ASSIST_STRAFE_ACCEL = 38;  // m/s^2 lateral test: A/D or stick-side slides instead of yawing
const ASSIST_MAX_SPEED = 70;
// --- Space regime (freeAttitude): a vacuum has almost no drag, so cruise is
// much faster and coasts. True space attitude must NOT rebuild itself from the
// currently dominant body's up vector; otherwise crossing between Earth,
// Aethelgard, moons, etc. snaps the craft toward the new planet.
const ASSIST_SPACE_MAX_SPEED = 400;   // interplanetary hop in ~1 min, not 6
const ASSIST_SPACE_ACTIVE_DAMP = 0.05; // thrusting in space (near-frictionless)
const ASSIST_SPACE_IDLE_DAMP = 0.02;   // released throttle => you COAST
const ASSIST_SPACE_ATTITUDE_RATE = 1.15; // slower than low-alt assisted bank
const ASSIST_SPACE_ROLL_RATE = 0.45;     // subtle roll; yaw/pitch do the aiming
const ASSIST_SPACE_ALT_MIN = 160;        // airless-body free attitude threshold
const ASSIST_MAX_PITCH = 1.35;           // low-alt clamp only (~77deg)
const ASSIST_MAX_ROLL  = 0.7;            // low-alt visual bank clamp (~40deg)
const ASSIST_LIFT_SPEED = 30;
const ASSIST_DESCEND_SPEED = 24;
const ASSIST_IDLE_TAN_DAMP = 3.2; // idle: sideways/forward motion eases to a stop in ~1.5 s
const ASSIST_IDLE_VERT_DAMP = 1.25; // idle: vertical stays under REAL gravity (terminal ~8 m/s => safe auto-landing)
const ASSIST_GRIP = 2.6;        // how fast existing velocity swings to follow the nose (flying-game feel)
const ASSIST_ACTIVE_DAMP = 0.55;
const ASSIST_BRAKE_DAMP = 6.5;

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
    this.assistRoll = 0;    // assisted-mode bank angle; upright rebuild would otherwise erase Q/R roll
    this.assistPitch = 0;   // assisted-mode nose attitude for high-flight/free-flight control
    this.doorOpen = false;
    this.interior = {
      floorY: -0.3,
      ceilingY: 2.0,
      portX: -2.0,
      starboardX: 2.0,
      rearZ: -5.5,
      frontZ: 4.0,
    };
    this.windows = [
      { x: -3.82, z: 1.6 },
      { x: 3.82, z: 1.6 },
    ];

    this.stats = this.computeStats();

    // --- Visual: a group rebuilt from modules (piece-by-piece, for real). ---
    this.group = new THREE.Group();
    this.group.name = 'ship';
    engine.scene.add(this.group);
    this._trackEntry = engine.trackWorldObject({ worldPos: this.worldPos, object3d: this.group, quaternion: this.quaternion });
    this.rebuildVisual();
  }

  // ------------------------------------------------------------------ stats
  computeStats() {
    const s = { mass: 80, thrust: 0, fuelCap: 0, powerDraw: 0, powerSupply: 0,
                cargoCap: 0, armor: 0, gearCount: 0, torqueBoost: 0,
                shieldCap: 0, shieldRecharge: 0, scanRange: 0,
                heatDissipation: 0, weaponDamage: 0, weaponCount: 0,
                missing: [], degraded: [] };
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
        if (t.torqueBoost) s.torqueBoost += t.torqueBoost;
        if (t.shieldCap) s.shieldCap += t.shieldCap;
        if (t.shieldRecharge) s.shieldRecharge += t.shieldRecharge;
        if (t.scanRange) s.scanRange = Math.max(s.scanRange, t.scanRange);
        if (t.heatDissipation) s.heatDissipation += t.heatDissipation;
        if (t.weaponDamage) { s.weaponDamage += t.weaponDamage; s.weaponCount++; }
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

    const has = (slotId) => !!this.modules[slotId];
    const hp = (slotId) => {
      const mod = this.modules[slotId];
      if (!mod) return 0;
      return mod.hp / getPartType(mod.typeId).maxHp;
    };
    const visible = new THREE.Group();
    visible.name = 'Fortis_Gunship_CodeBuilt';
    this.group.add(visible);

    const frameHealth = hp('frame_core') || 0.25;
    const hullHealth = Math.max(hp('hull_top'), hp('hull_heavy_top'), frameHealth);
    const armorMat = shipMat(0x62787a, hullHealth);
    const darkMat = shipMat(0x37464a, frameHealth);
    const trimMat = shipMat(0x7b1e1e, hullHealth);
    const interiorMat = shipMat(0x263238, frameHealth);
    const glassMat = new THREE.MeshLambertMaterial({ color: 0x8fd7ff, transparent: true, opacity: has('cockpit_fwd') ? 0.42 : 0.12 });

    // Walkable-gunship silhouette, adapted from SpaceYouLand's
    // _authoring/make_walkable_gunship.py into cheap browser primitives.
    addBox(visible, 'gunship:physics_deck', [0, -0.42, -0.35], [3.65, 0.28, 10.9], darkMat);
    addBox(visible, 'gunship:keel', [0, -0.72, -0.8], [0.55, 0.32, 8.6], darkMat);
    addBox(visible, 'gunship:port_shell', [-2.02, 0.82, -0.55], [0.28, 2.7, 10.7], armorMat);
    addBox(visible, 'gunship:starboard_shell', [2.02, 0.82, -0.55], [0.28, 2.7, 10.7], armorMat);
    addBox(visible, 'gunship:roof', [0, 2.18, -0.8], [3.9, 0.26, 8.7], armorMat);
    addBox(visible, 'gunship:belly_port', [-1.88, -0.48, -0.8], [0.35, 0.42, 9.0], armorMat);
    addBox(visible, 'gunship:belly_starboard', [1.88, -0.48, -0.8], [0.35, 0.42, 9.0], armorMat);
    addBox(visible, 'gunship:nose_cap', [0, 0.1, 5.78], [2.9, 0.66, 0.35], armorMat, { y: -0.14 });
    addBox(visible, 'gunship:cockpit_glass_left', [-0.62, 1.32, 4.92], [1.18, 0.07, 1.9], glassMat, { x: -0.35 });
    addBox(visible, 'gunship:cockpit_glass_right', [0.62, 1.32, 4.92], [1.18, 0.07, 1.9], glassMat, { x: 0.35 });
    addBox(visible, 'gunship:rear_pressure_frame', [0, 1.35, -5.78], [3.9, 0.42, 0.4], armorMat);
    this._rampMesh = addBox(visible, 'gunship:rear_ramp', [0, -0.36, -6.25], [3.35, 0.2, 2.9], shipMat(0x455a64, frameHealth), { x: -0.28 });
    addBox(visible, 'gunship:pressure_door', [0, 0.82, -5.82], [3.28, 2.3, 0.18], shipMat(0x263238, has('cockpit_fwd') ? 1 : 0.35));
    addBox(visible, 'gunship:pilot_seat', [0, 0.35, 3.25], [0.72, 0.32, 0.75], interiorMat);
    addBox(visible, 'gunship:console', [0, 0.65, 4.25], [1.65, 0.38, 0.9], shipMat(0x102027, hp('cockpit_fwd') || 0.3));
    addBox(visible, 'gunship:trim_port', [-2.18, 0.25, -0.55], [0.06, 0.14, 10.25], trimMat);
    addBox(visible, 'gunship:trim_starboard', [2.18, 0.25, -0.55], [0.06, 0.14, 10.25], trimMat);

    // Wings and engines: visible only when the supporting modules exist.
    if (has('hull_top') || has('hull_heavy_top') || has('frame_core')) {
      addBox(visible, 'gunship:port_wing', [-3.45, 0.46, -1.1], [3.0, 0.24, 3.4], armorMat);
      addBox(visible, 'gunship:starboard_wing', [3.45, 0.46, -1.1], [3.0, 0.24, 3.4], armorMat);
    }
    if (has('engine_main') || has('engine_aux') || has('engine_adv')) {
      const engineHealth = Math.max(hp('engine_main'), hp('engine_aux'), hp('engine_adv'));
      const engineMat = shipMat(0x263238, engineHealth || 0.35);
      addCyl(visible, 'gunship:port_engine', [-3.7, 0.9, -2.75], 0.68, 2.9, engineMat, 'Z');
      addCyl(visible, 'gunship:starboard_engine', [3.7, 0.9, -2.75], 0.68, 2.9, engineMat, 'Z');
      addCyl(visible, 'gunship:main_nozzle', [0, 0.35, -5.18], 0.58, 0.55, engineMat, 'Z');
    }
    if (has('tank_left')) addCyl(visible, 'gunship:port_tank', [-1.6, 0.08, -1.0], 0.42, 2.35, shipMat(0x607d8b, hp('tank_left')), 'Z');
    if (has('tank_right')) addCyl(visible, 'gunship:starboard_tank', [1.6, 0.08, -1.0], 0.42, 2.35, shipMat(0x607d8b, hp('tank_right')), 'Z');
    if (has('power_bay')) addBox(visible, 'gunship:power_cell', [0, 0.72, -0.55], [0.9, 0.55, 1.1], shipMat(0xffb300, hp('power_bay')));
    if (has('cargo_belly') || has('cargo_adv_belly')) addBox(visible, 'gunship:cargo_bay', [0, -1.05, 0.3], [1.5, 0.55, 2.4], shipMat(0x455a64, Math.max(hp('cargo_belly'), hp('cargo_adv_belly'))));

    for (const slotId of ['gear_fl', 'gear_fr', 'gear_rl', 'gear_rr']) {
      const slot = SLOTS.find(s => s.slotId === slotId);
      if (!slot || !has(slotId)) continue;
      const gearHealth = hp(slotId);
      const [x, , z] = slot.offset;
      const gearMat = shipMat(0x20282c, gearHealth);
      addCyl(visible, `gunship:${slotId}:strut`, [x, -1.05, z], 0.11, 0.95, gearMat, 'Y');
      addBox(visible, `gunship:${slotId}:foot`, [x, -1.58, z], [1.15, 0.18, 0.42], gearMat);
    }

    // Small optional hardpoint markers keep installed expanded modules visible.
    for (const slot of SLOTS) {
      const mod = this.modules[slot.slotId];
      if (!mod || ['frame', 'cockpit', 'engine', 'fueltank', 'power', 'cargo', 'hull', 'gear'].includes(mod.typeId)) continue;
      const t = getPartType(mod.typeId);
      const mat = shipMat(t.visual.color, mod.hp / t.maxHp);
      const marker = addModuleMarker(visible, `mod:${slot.slotId}`, t, mat);
      marker.position.fromArray(slot.offset);
      if (slot.rotate === 'back') marker.rotateX(Math.PI / 2);
    }

    // Engine glow when thrusting (updated in tick): point light + visible
    // additive flame cones at the nozzles (length scales with burn).
    this._glow = new THREE.PointLight(0xff6d3f, 0, 30);
    this._glow.position.set(0, 0, -4.2);
    this.group.add(this._glow);
    this._flames = [];
    const flameMat = new THREE.MeshBasicMaterial({
      color: 0xff8a50, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    });
    for (const [fx, fy, fz] of [[-3.7, 0.9, -4.3], [3.7, 0.9, -4.3], [0, 0.35, -5.6]]) {
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.42, 2.4, 8, 1, true), flameMat);
      flame.rotation.x = Math.PI / 2; // point backwards (-Z)
      flame.position.set(fx, fy, fz);
      flame.visible = false;
      visible.add(flame);
      this._flames.push(flame);
    }
    // Ship casts and receives shadows (gated globally by the graphics setting
    // in render/lighting.js; flags are free when shadows are off).
    enableShadows(visible, true, true);
    for (const f of this._flames) { f.castShadow = false; f.receiveShadow = false; }
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

  toggleDoor() {
    this.doorOpen = !this.doorOpen;
    if (this._rampMesh) {
      this._rampMesh.rotation.x = this.doorOpen ? -1.0 : -0.28;
    }
  }

  // ------------------------------------------------------------------ flight
  // controls: { pitch, yaw, roll: -1..1; thrustUp: bool; descend: bool; brake: bool; assist?: bool; assistForward?: -1..1; assistStrafe?: -1..1 }
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
    const torqueMul = Math.min(2.6, 1 + (this.stats.torqueBoost || 0)) * (TUNE.turn || 1);

    // ------------------------------------------------------------------
    // 2026-07-04 ROOT-CAUSE FIX: assisted flight used to `return` before
    // gravity and ground collision ever ran — the ship could fly through
    // terrain and never fell. Assisted piloting now only decides ORIENTATION
    // and THRUST; gravity, integration, structure collision, and ground
    // collision below run for EVERY flight mode, always. Never re-split this.
    // ------------------------------------------------------------------
    let burning = 0;
    let freeAttitude = false;
    if (assisted) {
      const freeAlt = body.atmosphere ? body.atmosphere.height * 1.1 : ASSIST_SPACE_ALT_MIN;
      freeAttitude = !this.landed && alt > freeAlt;
      const fwdFlat = _mobileFwd.set(0, 0, 1).applyQuaternion(this.quaternion)
        .addScaledVector(up, -_mobileFwd.dot(up));
      if (fwdFlat.lengthSq() < 1e-6) {
        fwdFlat.set(1, 0, 0).addScaledVector(up, -fwdFlat.dot(up));
      }
      fwdFlat.normalize();

      if (freeAttitude) {
        // True space: keep the current quaternion and rotate around ship-local
        // axes. Do not re-level to whatever body currently dominates gravity.
        const spaceTorqueMul = Math.min(1.45, 1 + (this.stats.torqueBoost || 0) * 0.35);
        _freeRight.set(1, 0, 0).applyQuaternion(this.quaternion).normalize();
        _freeUp.set(0, 1, 0).applyQuaternion(this.quaternion).normalize();
        _freeFwd.set(0, 0, 1).applyQuaternion(this.quaternion).normalize();
        if (controls.pitch) {
          _q.setFromAxisAngle(_freeRight, controls.pitch * ASSIST_SPACE_ATTITUDE_RATE * spaceTorqueMul * dt);
          this.quaternion.premultiply(_q).normalize();
        }
        if (controls.yaw) {
          _q.setFromAxisAngle(_freeUp, -controls.yaw * ASSIST_SPACE_ATTITUDE_RATE * spaceTorqueMul * dt);
          this.quaternion.premultiply(_q).normalize();
        }
        if (controls.roll) {
          _q.setFromAxisAngle(_freeFwd, controls.roll * ASSIST_SPACE_ROLL_RATE * spaceTorqueMul * dt);
          this.quaternion.premultiply(_q).normalize();
        }
        this.assistPitch = 0;
        this.assistRoll *= Math.max(0, 1 - 4 * dt);
      } else {
        if (controls.yaw) {
          _q.setFromAxisAngle(up, -controls.yaw * ASSIST_YAW_RATE * torqueMul * dt);
          fwdFlat.applyQuaternion(_q).addScaledVector(up, -fwdFlat.dot(up)).normalize();
        }
        _mobileRight.crossVectors(up, fwdFlat).normalize();
        _mobileMatrix.makeBasis(_mobileRight, up, fwdFlat);
        this.quaternion.setFromRotationMatrix(_mobileMatrix);

        // Low-alt assisted mode keeps the ship planet-upright for phone-friendly
        // landing, so Q/R roll and nose pitch are stored/clamped visual angles.
        this.assistPitch = (this.assistPitch || 0) + (controls.pitch || 0) * ASSIST_PITCH_RATE * torqueMul * dt;
        this.assistPitch = Math.max(-ASSIST_MAX_PITCH, Math.min(ASSIST_MAX_PITCH, this.assistPitch));
        if (!controls.pitch) this.assistPitch *= Math.max(0, 1 - 2.8 * dt);
        if (Math.abs(this.assistPitch) > 0.001) {
          _q.setFromAxisAngle(_mobileRight, this.assistPitch);
          this.quaternion.premultiply(_q).normalize();
        }

        this.assistRoll = (this.assistRoll || 0) + (controls.roll || 0) * ROLL_RATE * torqueMul * dt;
        this.assistRoll *= Math.max(0, 1 - 1.5 * dt);
        this.assistRoll = Math.max(-ASSIST_MAX_ROLL, Math.min(ASSIST_MAX_ROLL, this.assistRoll));
        if (Math.abs(this.assistRoll) > 0.001) {
          _q.setFromAxisAngle(fwdFlat, this.assistRoll);
          this.quaternion.premultiply(_q).normalize();
        }
      }

      this.angVel.set(0, 0, 0);

      if (this.stats.ready && this.fuel > 0) {
        const forward = Math.max(-1, Math.min(1, controls.assistForward ?? this.throttle));
        const strafe = Math.max(-1, Math.min(1, controls.assistStrafe ?? 0));
        const assistFwd = freeAttitude
          ? _assistFwd3.set(0, 0, 1).applyQuaternion(this.quaternion).normalize()
          : fwdFlat;
        const assistRight = freeAttitude
          ? _assistRight3.set(1, 0, 0).applyQuaternion(this.quaternion).normalize()
          : _mobileRight;
        if (Math.abs(forward) > 0.01) {
          accel.addScaledVector(assistFwd, forward * ASSIST_FORWARD_ACCEL * (TUNE.thrust || 1));
          burning += Math.abs(forward) * 0.45;
        }
        if (Math.abs(strafe) > 0.01) {
          accel.addScaledVector(assistRight, strafe * ASSIST_STRAFE_ACCEL * (TUNE.thrust || 1));
          burning += Math.abs(strafe) * 0.30;
        }
        if (controls.descend) {
          accel.addScaledVector(up, -ASSIST_DESCEND_SPEED);
          burning += 0.28;
        } else if (controls.thrustUp) {
          accel.addScaledVector(up, ASSIST_LIFT_SPEED * (TUNE.thrust || 1));
          burning += 0.35;
        }
        this.fuel = Math.max(0, this.fuel - burning * dt);
      }
    } else if (piloted && this.stats.ready && this.fuel > 0) {
      // Raw 6-DOF thrust (non-assisted): throttle through the nose + RCS up.
      const fwd = _fwd.set(0, 0, 1).applyQuaternion(this.quaternion);
      if (this.throttle > 0) {
        accel.addScaledVector(fwd, (this.stats.thrust * (TUNE.thrust || 1) * this.throttle) / this.stats.mass);
        burning += this.throttle;
      }
      if (controls && controls.thrustUp) {
        const shipUp = _shipUp.set(0, 1, 0).applyQuaternion(this.quaternion);
        accel.addScaledVector(shipUp, (this.stats.thrust * (TUNE.thrust || 1) * 0.75) / this.stats.mass);
        burning += 0.75;
      }
      this.fuel = Math.max(0, this.fuel - burning * dt * 0.55);
    }
    if (this._glow) this._glow.intensity = burning > 0 ? 3.5 : 0;
    if (this._flames) {
      const on = burning > 0;
      const k = Math.min(1, burning);
      for (const f of this._flames) {
        f.visible = on;
        if (on) f.scale.set(0.7 + k * 0.5, 0.6 + k * 1.6 + Math.random() * 0.25, 0.7 + k * 0.5);
      }
    }

    // 2. Gravity from ALL bodies (second-body coexistence is real).
    for (const b of this.bodies) {
      accel.add(gravityAt(b, this.worldPos, _g));
    }

    // 3. Integrate.
    this.velocity.addScaledVector(accel, dt);

    // Assisted flight feel: damping + "grip" (velocity swings to follow the
    // nose, so turning turns your PATH — the standard flying-game behavior).
    if (assisted && this.stats.ready && this.fuel > 0 && freeAttitude) {
      const forward = Math.abs(controls.assistForward ?? 0);
      const strafe = Math.abs(controls.assistStrafe ?? 0);
      const active = forward > 0.01 || strafe > 0.01 || controls.thrustUp || controls.descend;
      // TRUE space (above the atmosphere, or any altitude on an airless body)
      // is near-frictionless: the ship reaches cruise speed and coasts when you
      // let off. Below that (still in air) keep the steadier low-alt damping so
      // near-ground flight hovers instead of sliding. Brake stays strong.
      const spaceRegime = alt > (body.atmosphere ? body.atmosphere.height : 60);
      const maxSpd = spaceRegime ? ASSIST_SPACE_MAX_SPEED : ASSIST_MAX_SPEED;
      const damp = controls.brake ? ASSIST_BRAKE_DAMP
        : (active ? (spaceRegime ? ASSIST_SPACE_ACTIVE_DAMP : ASSIST_ACTIVE_DAMP)
                  : (spaceRegime ? ASSIST_SPACE_IDLE_DAMP : ASSIST_IDLE_TAN_DAMP));
      this.velocity.multiplyScalar(Math.max(0, 1 - damp * dt));
      const speed = this.velocity.length();
      const desired = _desiredTan.set(0, 0, 0);
      _gripFwd.set(0, 0, 1).applyQuaternion(this.quaternion).normalize();
      _gripRight.set(1, 0, 0).applyQuaternion(this.quaternion).normalize();
      desired.copy(_gripFwd).multiplyScalar(controls.assistForward ?? 0)
        .addScaledVector(_gripRight, controls.assistStrafe ?? 0);
      if (speed > 0.5 && desired.lengthSq() > 1e-5) {
        desired.normalize().multiplyScalar(speed);
        this.velocity.lerp(desired, Math.min(1, ASSIST_GRIP * dt));
      }
      const capped = this.velocity.length();
      if (capped > maxSpd) this.velocity.multiplyScalar(maxSpd / capped);
    } else if (assisted && this.stats.ready && this.fuel > 0) {
      const forward = Math.abs(controls.assistForward ?? 0);
      const strafe = Math.abs(controls.assistStrafe ?? 0);
      const active = forward > 0.01 || strafe > 0.01 || controls.thrustUp || controls.descend;
      let vUp = this.velocity.dot(up);
      _vTan.copy(this.velocity).addScaledVector(up, -vUp);
      const tanDamp = controls.brake ? ASSIST_BRAKE_DAMP : (active ? ASSIST_ACTIVE_DAMP : ASSIST_IDLE_TAN_DAMP);
      const vertDamp = controls.brake ? ASSIST_BRAKE_DAMP : (active ? ASSIST_ACTIVE_DAMP : ASSIST_IDLE_VERT_DAMP);
      _vTan.multiplyScalar(Math.max(0, 1 - tanDamp * dt));
      vUp *= Math.max(0, 1 - vertDamp * dt);
      const tanSpeed = _vTan.length();
      _gripFwd.set(0, 0, 1).applyQuaternion(this.quaternion)
        .addScaledVector(up, -_gripFwd.dot(up));
      if (_gripFwd.lengthSq() < 1e-6) _gripFwd.copy(_mobileFwd);
      _gripFwd.normalize();
      _gripRight.crossVectors(up, _gripFwd).normalize();
      const desired = _desiredTan
        .copy(_gripFwd).multiplyScalar(controls.assistForward ?? 0)
        .addScaledVector(_gripRight, controls.assistStrafe ?? 0);
      if (tanSpeed > 0.5 && desired.lengthSq() > 1e-5) {
        desired.normalize().multiplyScalar(tanSpeed);
        _vTan.lerp(desired, Math.min(1, ASSIST_GRIP * dt));
      }
      this.velocity.copy(_vTan).addScaledVector(up, vUp);
      // Keep A/D or stick-side as lateral movement so it does not become camera/yaw motion.
      _vTan.copy(this.velocity).addScaledVector(up, -this.velocity.dot(up));
      const speed = this.velocity.length();
      if (speed > ASSIST_MAX_SPEED) this.velocity.multiplyScalar(ASSIST_MAX_SPEED / speed);
    } else if (piloted && controls && controls.brake) {
      // Raw-mode space brake kills velocity gradually (honest RCS-style).
      this.velocity.multiplyScalar(Math.max(0, 1 - 1.6 * dt));
    }
    // Mild atmospheric drag inside an atmosphere (also aids stable landings).
    if (body.atmosphere && alt < body.atmosphere.height) {
      const density = 1 - Math.max(0, alt) / body.atmosphere.height;
      this.velocity.multiplyScalar(Math.max(0, 1 - 0.12 * density * dt));
    }

    this.worldPos.addScaledVector(this.velocity, dt);
    if (resolveStructureCollision(body, this.worldPos, HULL_RADIUS)) {
      this.velocity.multiplyScalar(0.25);
    }

    // 4. Rotation: rates from controls, damped.
    if (piloted && controls && !assisted) {
      this.angVel.x += controls.pitch * PITCH_RATE * torqueMul * dt;
      this.angVel.y += controls.yaw * YAW_RATE * torqueMul * dt;
      this.angVel.z += controls.roll * ROLL_RATE * torqueMul * dt;
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
const _assistFwd3 = new THREE.Vector3(), _assistRight3 = new THREE.Vector3();
const _freeRight = new THREE.Vector3(), _freeUp = new THREE.Vector3(), _freeFwd = new THREE.Vector3();
const _gripFwd = new THREE.Vector3(), _gripRight = new THREE.Vector3();
const _vTan = new THREE.Vector3(), _desiredTan = new THREE.Vector3();
const _mobileMatrix = new THREE.Matrix4();

function shipMat(color, health = 1) {
  const mat = new THREE.MeshLambertMaterial({ color });
  if (health < READINESS_RULES.degradedBelowFrac) mat.color.multiplyScalar(0.35);
  else if (health < 0.8) mat.color.multiplyScalar(0.7);
  return mat;
}

function addBox(parent, name, center, size, mat, rot = null) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
  mesh.name = name;
  mesh.position.fromArray(center);
  if (rot) {
    if (rot.x) mesh.rotateX(rot.x);
    if (rot.y) mesh.rotateY(rot.y);
    if (rot.z) mesh.rotateZ(rot.z);
  }
  parent.add(mesh);
  return mesh;
}

function addCyl(parent, name, center, radius, depth, mat, axis = 'Y') {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.12, depth, 12), mat);
  mesh.name = name;
  mesh.position.fromArray(center);
  if (axis === 'Z') mesh.rotateX(Math.PI / 2);
  else if (axis === 'X') mesh.rotateZ(Math.PI / 2);
  parent.add(mesh);
  return mesh;
}

function addModuleMarker(parent, name, type, mat) {
  if (type.visual.kind === 'cyl') {
    return addCyl(parent, name, [0, 0, 0], type.visual.size[0], type.visual.size[1], mat, 'Z');
  }
  const scale = 0.55;
  return addBox(parent, name, [0, 0, 0], type.visual.size.map(v => v * scale), mat);
}
