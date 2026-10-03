// ============================================================================
// shipFlight.js — the ship as a body that fights real gravity.
//
// OWNS: the ship's f64 position and velocity in body-fixed metres, its attitude,
//       thrust, landing gear, ground contact and the power split that decides
//       how hard the engines can push.
// DOES NOT OWN: what the ground is (a sampler is handed in: the same drawn
//       surface the walker stands on, or the field), the people inside (they
//       live in shipWalker.js's ship-local frame), or any drawing.
//
// GRAVITY IS THE PLANET'S
// -----------------------
// Weight is mass x gravityAtRadius(body, r), pointing at the centre, the same
// function the walker uses. 46 t on Mars is 171 kN. The vertical thrusters at
// the default power split produce 300 kN, so there is 129 kN to spare and the
// ship climbs at ~2.8 m/s^2. Route power away from the engines and that surplus
// disappears: below ~19% engine share the ship cannot leave the ground at all.
// That is not scripted; it is 300 kN x share / 171 kN.
//
// FLIGHT ASSIST
// -------------
// The crew asks for a velocity (forward, climb, turn); the flight computer
// commands the thrusters to get there within what the hardware and the power
// split allow. Let go and it holds a hover. The hull is kept level on the local
// vertical and leans a few degrees into acceleration, which is cosmetic and
// keeps a person standing on the deck from being tipped about by hull attitude.
//
// LANDING GEAR
// ------------
// Four telescopic legs on springs (stroke 0.8 m). After touchdown each leg
// extends or retracts on its own until the load is shared evenly, so the hull
// ends level on ground that is not. Nothing is ever placed inside the field:
// Springs carry the load; a field-based constraint after integration protects
// the keel and underside and accounts for the rubber soles' actual geometry.
// ============================================================================

import * as THREE from 'three';
import { gravityAtRadius } from '../world/bodies.js';
import { cartesianToGeodetic, localFrame } from '../world/geodesy.js';
import { GEAR, SHIP_PHYS } from './shipSpec.js';
import { hullUnderside } from './shipExterior.js';

// The Meridian's hull envelope for the landing constraint (the lofted octagon, its wing tips and the ventral turret).
const MERIDIAN_HULL = {
  z0: -21, z1: 21, underside: hullUnderside,
  extraPoints: [...[-12, 12].flatMap((x) => [-3, 6, 12].map((z) => ({ x, y: 1.25, z }))), { x: 0, y: -2.12, z: -15.3 }],
};

const V = { east: new THREE.Vector3(), north: new THREE.Vector3(), up: new THREE.Vector3() };

export class ShipBody {
  /**
   * @param body    planet record
   * @param ground  (dx,dy,dz) -> surface radius under that direction (f64)
   */
  constructor(body, ground, def = null) {
    this.body = body;
    this.ground = ground;
    // FLEET: the ship's own numbers. `def` is a ship definition (src/ships/registry.js); with none given this is the Meridian.
    this.def = def;
    this.G = (def && def.gear) || GEAR;
    this.P = (def && def.phys) || SHIP_PHYS;
    this.hullDef = (def && def.hull) || null;

    this.pos = { x: 0, y: 0, z: 0 };
    this.vel = { x: 0, y: 0, z: 0 };
    this.heading = 0;                // radians clockwise from north
    this.pitch = 0; this.roll = 0;   // cosmetic lean
    this.yawRate = 0;
    this.quaternion = new THREE.Quaternion();
    this._basis = new THREE.Matrix4();

    this.massKg = this.P.massKg;
    this.power = { ...this.P.defaultPower };
    this.controls = { fwd: 0, lift: 0, yaw: 0 };   // set only by a seated pilot
    this.hull = 100;                                 // integrity, percent
    this.shield = 0;                                 // current shield points
    this.shieldMax = 0;

    this.legs = this.G.legs.map((l) => ({ ...l, ext: this.G.nominal, comp: 0, gap: 0, contact: false, world: null }));
    this.gearPos = 1;                // 1 = down, 0 = up (visual and contact)
    this.landed = false;
    this.autoHover = false;          // set when the ship lifts off: the flight computer holds a hover until it is down
    this.airborne = false;
    this.lastTouchdown = null;       // { v, at }
    this.agl = 0;
    this.thrustUp = 0;               // N, last step (drives exhaust glow)
    this.thrustFwd = 0;
    this.events = [];
    this._frame = null;
    this._geo = { lat: 0, lon: 0, alt: 0 };
    this._fwdAccLP = 0;
    this.time = 0;
    // --- space travel (src/space/). `climbCap` is the fastest the lift pods are asked to climb (the ascent raises it above the
    // --- 12 m/s of flying low). `override(dt)` lets the drive move the ship itself during a transit (returns true if it did: the
    // --- ordinary flight step is then skipped). `attitude`, while set, is the hull's quaternion (a transit points the nose where
    // --- the thrust goes); the legacy level-on-the-horizon attitude is still computed into `levelQ` so it can be eased back.
    this.climbCap = this.P.climbSpeed;
    this.override = null;
    this.thrustDown = false;          // vacuum descent: the pods are ducted both ways, so a ship can push itself down (a moon's pull is a few mm/s2)
    this.attitude = null;
    this.levelQ = new THREE.Quaternion();
    // F2: the ship's own clock, game seconds, while she is in space (a course or free flight): time compression runs it fast. null = she is in a
    // frame (on the ground, a pad, a moon) and keeps the world's time. See space/clock.js.
    this.epochS = null;
    this.updateShields(0, true);
  }

  // ---- power ----------------------------------------------------------------
  get engineFactor() { return this.power.engines / this.P.defaultPower.engines; }
  get gunFactor() { return this.power.guns / this.P.defaultPower.guns; }
  get shieldFactor() { return this.power.shields / this.P.defaultPower.shields; }

  /**
   * Route reactor power. The total is fixed at reactorUnits; raising one share
   * takes from the others in proportion to what they had.
   */
  routePower(key, value) {
    const total = this.P.reactorUnits;
    const v = Math.max(0, Math.min(total, Math.round(value)));
    const others = Object.keys(this.power).filter((k) => k !== key);
    const rest = total - v;
    const had = others.reduce((a, k) => a + this.power[k], 0);
    this.power[key] = v;
    let assigned = 0;
    others.forEach((k, i) => {
      const share = had > 0 ? this.power[k] / had : 1 / others.length;
      const n = i === others.length - 1 ? rest - assigned : Math.round(rest * share);
      this.power[k] = n; assigned += n;
    });
    this.updateShields();
    return { ...this.power };
  }

  /** Set all three shares at once. They are normalised so the total is exactly the reactor output. */
  setPowerSplit(e, g, sh) {
    const total = this.P.reactorUnits;
    const sum = Math.max(1, e + g + sh);
    const ne = Math.round((e / sum) * total), ng = Math.round((g / sum) * total);
    this.power.engines = ne; this.power.guns = ng; this.power.shields = total - ne - ng;
    this.updateShields();
    return { ...this.power };
  }

  updateShields(dt = 0, reset = false) {
    this.shieldMax = (this.P.shieldBase ?? 200) * this.shieldFactor;      // FLEET: each class has its own shield and armour (the Meridian's are 200 and 0.25)
    if (reset) this.shield = this.shieldMax;
    else {
      this.shield = Math.min(this.shieldMax, this.shield + 8 * this.shieldFactor * dt);
      if (this.shield > this.shieldMax) this.shield = this.shieldMax;
    }
  }

  /** Damage from something hitting the ship. Shields take it first. */
  takeHit(points) {
    const absorbed = Math.min(this.shield, points);
    this.shield -= absorbed;
    this.hull = Math.max(0, this.hull - (points - absorbed) * (this.P.hullFactor ?? 0.25));
    return { absorbed, hull: this.hull };
  }

  // A battered hull loses thrust, but never enough to fall out of the sky: at zero integrity the
  // lift thrusters still make 78% of full power (234 kN against 171 kN of weight at the default split).
  get damageFactor() { return this.hull >= 50 ? 1 : 0.78 + 0.22 * (this.hull / 50); }
  get maxLiftN() { return this.P.liftThrustN * Math.min(1.8, this.engineFactor) * this.damageFactor; }
  get maxDriveN() { return this.P.driveThrustN * Math.min(1.8, this.engineFactor); }
  get cruiseSpeed() { return this.P.cruiseSpeed * Math.sqrt(Math.min(1.8, this.engineFactor)); }
  weightN() {
    const r = Math.hypot(this.pos.x, this.pos.y, this.pos.z);
    return this.massKg * gravityAtRadius(this.body, r);
  }
  /** True if the thrusters can lift the ship at all at the current power split. */
  canLiftOff() { return this.maxLiftN > this.weightN() * 1.02; }

  // ---- placement -------------------------------------------------------------
  /**
   * Put the ship on the ground at a world position and heading. `pos` is the
   * ship origin (lower deck floor).
   */
  setDown(pos, headingRad) {
    this.pos = { x: pos.x, y: pos.y, z: pos.z };
    this.vel = { x: 0, y: 0, z: 0 };
    this.heading = headingRad;
    this.pitch = this.roll = 0;
    this.gearPos = 1;
    for (const l of this.legs) { l.ext = this.G.nominal; l.comp = 0; }
    this.refreshOrientation();
    this.landed = true;
  }

  // ---- geometry helpers --------------------------------------------------------
  refreshOrientation() {
    const p = this.pos;
    cartesianToGeodetic(this.body, p.x, p.y, p.z, this._geo);
    this._frame = localFrame(this._geo.lat, this._geo.lon, this._frame || {});
    const f = this._frame;
    V.east.set(f.east.x, f.east.y, f.east.z);
    V.north.set(f.north.x, f.north.y, f.north.z);
    V.up.set(f.up.x, f.up.y, f.up.z);

    // forward on the horizontal, from heading
    const ch = Math.cos(this.heading), sh = Math.sin(this.heading);
    const fwd = new THREE.Vector3().addScaledVector(V.north, ch).addScaledVector(V.east, sh);
    const right = new THREE.Vector3().crossVectors(fwd, V.up).normalize();
    const back = fwd.clone().negate();
    this._basis.makeBasis(right, V.up, back);
    const qb = new THREE.Quaternion().setFromRotationMatrix(this._basis);
    const qp = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.pitch);
    const qr = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), this.roll);
    this.quaternion.copy(qb).multiply(qp).multiply(qr);
    this.levelQ.copy(this.quaternion);
    if (this.attitude) {
      // a transit: the hull points where the drive pushes. up / fwdH / rightH follow the hull so everything that reads them agrees.
      this.quaternion.copy(this.attitude);
      const u = new THREE.Vector3(0, 1, 0).applyQuaternion(this.attitude), fw = new THREE.Vector3(0, 0, -1).applyQuaternion(this.attitude), rt = new THREE.Vector3(1, 0, 0).applyQuaternion(this.attitude);
      this.up = { x: u.x, y: u.y, z: u.z };
      this.fwdH = { x: fw.x, y: fw.y, z: fw.z };
      this.rightH = { x: rt.x, y: rt.y, z: rt.z };
      return;
    }
    this.up = { x: f.up.x, y: f.up.y, z: f.up.z };
    this.fwdH = { x: fwd.x, y: fwd.y, z: fwd.z };
    this.rightH = { x: right.x, y: right.y, z: right.z };
  }

  /** Ship-local point to world, f64 position plus a small rotated offset. */
  toWorld(l, out = {}) {
    const v = new THREE.Vector3(l.x, l.y, l.z).applyQuaternion(this.quaternion);
    out.x = this.pos.x + v.x; out.y = this.pos.y + v.y; out.z = this.pos.z + v.z;
    return out;
  }

  /** World point to ship-local. */
  toLocal(w, out = {}) {
    const v = new THREE.Vector3(w.x - this.pos.x, w.y - this.pos.y, w.z - this.pos.z)
      .applyQuaternion(this.quaternion.clone().invert());
    out.x = v.x; out.y = v.y; out.z = v.z;
    return out;
  }

  /** Ship-local direction to a world direction. */
  dirToWorld(l, out = {}) {
    const v = new THREE.Vector3(l.x, l.y, l.z).applyQuaternion(this.quaternion);
    out.x = v.x; out.y = v.y; out.z = v.z;
    return out;
  }

  _groundAtWorld(p) {
    const r = Math.hypot(p.x, p.y, p.z) || 1;
    const g = this.ground(p.x / r, p.y / r, p.z / r);
    return { r, ground: g, gap: g === null || g === undefined ? Infinity : r - g };
  }

  /** Height of the keel above the ground beneath it, metres. */
  radarAltitude() {
    const p = this.pos;
    const s = this._groundAtWorld({ x: p.x + this.up.x * this.G.keelY, y: p.y + this.up.y * this.G.keelY, z: p.z + this.up.z * this.G.keelY });
    return s.gap;
  }

  // ---- the step ---------------------------------------------------------------
  step(dt) {
    // Substep for stiff springs.
    const n = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h = dt / n;
    this.events.length = 0;
    if (this.override && this.override(dt)) { this.updateShields(dt); return; }
    for (let i = 0; i < n; i++) this._step(h);
    this.updateShields(dt);
  }

  _step(dt) {
    this.time += dt;
    const p = this.pos, v = this.vel;
    this.refreshOrientation();
    const up = this.up;

    const r = Math.hypot(p.x, p.y, p.z);
    const g = gravityAtRadius(this.body, r);
    const gDir = { x: -p.x / r, y: -p.y / r, z: -p.z / r };
    const m = this.massKg;

    // Velocity split into vertical and horizontal parts.
    const vUp = v.x * up.x + v.y * up.y + v.z * up.z;
    let hx = v.x - up.x * vUp, hy = v.y - up.y * vUp, hz = v.z - up.z * vUp;

    // --- Gear position (auto): down low and slow, up high. ---------------------
    const aglNow = this.radarAltitude();
    this.agl = aglNow;
    const gearWant = (aglNow < 40 || this.landed) ? 1 : (aglNow > 70 ? 0 : (this.gearPos > 0.5 ? 1 : 0));
    this.gearPos += Math.max(-dt * 0.5, Math.min(dt * 0.5, gearWant - this.gearPos));

    // --- Legs: contact springs. -------------------------------------------------
    let fSpring = 0;                    // along local up, newtons
    let contacts = 0, worstGap = Infinity;
    for (const l of this.legs) {
      // The foot at its UNCOMPRESSED extension. Whatever ground is above that
      // is how far the spring is squeezed (a raycast suspension).
      const nomLen = l.ext * this.gearPos + 0.35 * (1 - this.gearPos);
      const foot = this.toWorld({ x: l.x, y: -nomLen - this.G.soleOffset, z: l.z });
      const sn = this._groundAtWorld(foot);
      const overlap = Math.max(0, -sn.gap);
      l.world = foot;
      l.gap = sn.gap;
      worstGap = Math.min(worstGap, sn.gap);
      l.contact = overlap > 0;
      const c = Math.min(overlap, this.G.stroke * 1.6);
      l.comp = Math.min(c, this.G.stroke);
      if (l.contact) {
        contacts++;
        const k = 130000;                                    // N/m per leg
        const dampC = 60000;                                 // N s/m
        let f = k * c - dampC * Math.min(0, vUp);            // damp only while moving into it
        if (c > this.G.stroke) f += 900000 * (c - this.G.stroke); // bottomed out
        fSpring += Math.max(0, f);
      }
    }
    // Belly points: stiff, never allowed below the ground.
    for (const kp of this.G.keel) {
      const w = this.toWorld({ x: kp.x, y: this.G.keelY, z: kp.z });
      const s = this._groundAtWorld(w);
      if (s.gap < 0) { fSpring += 400000 * (-s.gap) - 60000 * Math.min(0, vUp); contacts++; }
    }
    this.contacts = contacts;

    // --- Commands. ---------------------------------------------------------------
    const c = this.controls;
    const eng = Math.min(1.8, this.engineFactor);
    // Landing flare: the closer to the ground, the slower the ship is allowed to sink.
    let climbTarget = c.lift * this.climbCap;
    // Allowed sink rate comes from stopping distance: v = sqrt(2 * a * height), with the
    // thrusters' real spare deceleration (less a margin), plus 1 m/s at the surface.
    // Height is measured from where the FEET are, not the keel: the legs hang 1.6 m below it.
    const spare = Math.max(0.3, (this.maxLiftN / m - g) * 0.5);
    // With the gear down the first foot to touch is what matters (the ground can rise under one leg).
    const hFoot = this.gearPos > 0.95 && Number.isFinite(worstGap) ? Math.max(0, worstGap - 0.4) : Math.max(0, aglNow - (this.G.nominal + this.G.keelY + 0.5));
    if (Number.isFinite(aglNow)) climbTarget = Math.max(climbTarget, -(0.6 + Math.sqrt(2 * spare * hFoot)));
    // Vertical: gravity compensation plus a proportional term, never pushing down.
    const onGround = contacts > 0 && aglNow < 2.5;
    // Engines run only when somebody asked for them, or once the ship has left the
    // ground and must be held there. A ship set down and left alone stays down.
    const engaged = this.autoHover || c.lift > 0.01 || Math.abs(c.fwd) > 0.01;
    let aCmd;
    if (!engaged) aCmd = 0;
    else if (onGround && c.lift <= 0.01 && vUp <= 0.3) aCmd = 0;              // parked: engines idle
    else aCmd = g + (this.thrustDown ? 4.5 : 2.0) * (climbTarget - vUp);
    let fUp = Math.max(this.thrustDown ? -this.maxLiftN * 0.6 : 0, Math.min(this.maxLiftN, m * aCmd));
    // A ship on its gear with the engines off must not have thrust fight the springs.
    this.thrustUp = Math.max(0, fUp);

    // Horizontal.
    const speedMax = this.cruiseSpeed;
    const aMaxH = this.maxDriveN / m;
    let ax = 0, ay = 0, az = 0;
    let fwdAcc = 0;
    if (!onGround || c.lift > 0.05) {
      const tx = this.fwdH.x * c.fwd * speedMax, ty = this.fwdH.y * c.fwd * speedMax, tz = this.fwdH.z * c.fwd * speedMax;
      let cx = (tx - hx) * 0.8, cy = (ty - hy) * 0.8, cz = (tz - hz) * 0.8;
      const cl = Math.hypot(cx, cy, cz);
      if (cl > aMaxH) { cx *= aMaxH / cl; cy *= aMaxH / cl; cz *= aMaxH / cl; }
      ax = cx; ay = cy; az = cz;
      fwdAcc = cx * this.fwdH.x + cy * this.fwdH.y + cz * this.fwdH.z;
      this.thrustFwd = Math.hypot(cx, cy, cz) * m;
      // The flight computer is not allowed to make thrust from nothing: below
      // the lift needed to fly, the drive is limited as well.
      if (!this.canLiftOff()) { ax *= 0.15; ay *= 0.15; az *= 0.15; }
    } else {
      this.thrustFwd = 0;
      // Parked: friction takes any horizontal speed away.
      const k = Math.min(1, 6 * dt);
      hx -= hx * k; hy -= hy * k; hz -= hz * k;
    }

    // --- Integrate velocity. -------------------------------------------------------
    // vertical: thrust + springs along up, gravity toward the centre
    const aUp = (fUp + fSpring) / m;
    v.x = hx + up.x * vUp + (up.x * aUp + gDir.x * g + ax) * dt;
    v.y = hy + up.y * vUp + (up.y * aUp + gDir.y * g + ay) * dt;
    v.z = hz + up.z * vUp + (up.z * aUp + gDir.z * g + az) * dt;

    // --- Touchdown bookkeeping and the landed state. ---------------------------------
    const wasAir = this.airborne;
    this.airborne = contacts === 0;
    if (wasAir && !this.airborne) {
      const impact = -vUp;
      this.lastTouchdown = { v: impact, at: this.time };
      this.events.push({ type: 'touchdown', speed: impact });
      if (impact > 5.5) { this.hull = Math.max(0, this.hull - (impact - 5.5) * 6); this.events.push({ type: 'hard_landing', speed: impact }); }
    }
    if (!wasAir && this.airborne && engaged) { this.events.push({ type: 'liftoff' }); this.autoHover = true; }
    this.landed = contacts > 0 && Math.abs(vUp) < 0.6 && fUp < this.weightN() * 0.97 + 1;
    if (this.landed && c.lift <= 0.01) this.autoHover = false;

    // --- Landing gear self-levelling once we are down. --------------------------------
    if (this.landed && c.lift <= 0.01) {
      for (const l of this.legs) {
        const target = this.G.stroke * 0.45;
        if (!l.contact && l.gap > 0.02) l.ext = Math.min(this.G.max, l.ext + 0.45 * dt);
        else if (l.comp > target + 0.12) l.ext = Math.max(this.G.min + 0.2, l.ext - 0.45 * dt);
        else if (l.comp < target - 0.12 && l.contact) l.ext = Math.min(this.G.max, l.ext + 0.35 * dt);
      }
    } else if (!this.landed && this.gearPos >= 0.99) {
      // In the air the legs return to nominal.
      for (const l of this.legs) l.ext += Math.max(-0.6 * dt, Math.min(0.6 * dt, this.G.nominal - l.ext));
    }

    // --- Attitude. ----------------------------------------------------------------------
    const flying = !onGround;
    const yawCmd = flying ? c.yaw * this.P.turnRate * Math.min(1.4, 0.7 + eng * 0.3) : 0;
    this.yawRate += (yawCmd - this.yawRate) * Math.min(1, 2.5 * dt);
    this.heading += this.yawRate * dt;
    this.heading = ((this.heading % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    this._fwdAccLP += (fwdAcc - this._fwdAccLP) * Math.min(1, 2.0 * dt);
    const pitchT = flying ? clamp(-this._fwdAccLP * 0.028, -0.22, 0.22) : 0;
    const speedH = Math.hypot(hx, hy, hz);
    const rollT = flying ? clamp(-this.yawRate * (0.25 + speedH * 0.012) * 1.6, -0.32, 0.32) : 0;
    this.pitch += (pitchT - this.pitch) * Math.min(1, 1.6 * dt);
    this.roll += (rollT - this.roll) * Math.min(1, 1.6 * dt);

    // --- Move. ---------------------------------------------------------------------------
    p.x += v.x * dt; p.y += v.y * dt; p.z += v.z * dt;
    // Springs supply the forces; this unilateral constraint supplies the guarantee.
    // Re-evaluate AFTER motion and attitude, rather than trusting last frame's feet.
    this.refreshOrientation();
    if (this.gearPos > .95 && (worstGap < .5 || aglNow < 5)) this.constrainLanding();
  }

  constrainLanding() {
    if(this.landed && this.controls.lift<=.01) { this.pitch=this.roll=0; this.refreshOrientation(); }
    let lift = 0;
    const clearance = (point) => this._groundAtWorld(this.toWorld(point)).gap;
    // A conservative underside grid covers keel, flanks, wings, nose and aft hull.
    // The ventral turret needs its own lower support point.
    // FLEET: the hull's underside comes from the ship definition (the Meridian's is the lofted octagon in shipExterior.js).
    const H = this.hullDef || MERIDIAN_HULL;
    for (let z=H.z0; z<=H.z1; z+=3) {
      const s=H.underside(z);
      for (const x of [-(s.hw-s.cb),0,s.hw-s.cb]) lift=Math.max(lift,.04-clearance({x,y:s.yb,z}));
      for (const x of [-s.hw,s.hw]) lift=Math.max(lift,.04-clearance({x,y:s.yb+s.cb,z}));
    }
    for (const q of H.extraPoints) lift=Math.max(lift,.04-clearance(q));
    for(const l of this.legs) {
      lift=Math.max(lift,-clearance({x:l.x,y:-l.ext+this.G.stroke-this.G.soleOffset,z:l.z}));
    }
    if(lift>0) {
      this.pos.x+=this.up.x*lift; this.pos.y+=this.up.y*lift; this.pos.z+=this.up.z*lift;
      const down=this.verticalSpeed;
      if(down<0) { this.vel.x-=this.up.x*down; this.vel.y-=this.up.y*down; this.vel.z-=this.up.z*down; }
    }
    // Contact may be the keel before a foot on rough ground. Extend the legs
    // within their measured stroke, then share the real weight at equilibrium.
    const gaps=this.legs.map(l=>clearance({x:l.x,y:0,z:l.z}));
    const equilibrium=this.weightN()/(4*130000);
    const canSettle=gaps.every(g=>g-this.G.soleOffset+equilibrium>=this.G.min && g-this.G.soleOffset+equilibrium<=this.G.max);
    if(this.controls.lift<=.01 && canSettle && (this.landed || lift>0) && this.verticalSpeed<.6) {
      this.landed=true; this.airborne=false;
      this.autoHover=false;
      this.pitch=this.roll=0; this.refreshOrientation();
      for(const l of this.legs) {
        const gap=clearance({x:l.x,y:0,z:l.z});
        l.ext=clamp(gap-this.G.soleOffset+equilibrium,this.G.min,this.G.max);
        l.comp=clamp(l.ext+this.G.soleOffset-gap,0,this.G.stroke);
        l.world=this.toWorld({x:l.x,y:-l.ext+l.comp-this.G.soleOffset,z:l.z});
        l.gap=this._groundAtWorld(l.world).gap;
        l.contact=Math.abs(l.gap)<.035;
      }
      this.vel.x=this.vel.y=this.vel.z=0;
    }
  }

  // ---- read-outs -------------------------------------------------------------------------
  get geodetic() { return this._geo; }
  get speed() { return Math.hypot(this.vel.x, this.vel.y, this.vel.z); }
  get verticalSpeed() { const u = this.up || { x: 0, y: 1, z: 0 }; return this.vel.x * u.x + this.vel.y * u.y + this.vel.z * u.z; }
  get groundSpeed() { const vs = this.verticalSpeed; return Math.sqrt(Math.max(0, this.speed * this.speed - vs * vs)); }
}

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
