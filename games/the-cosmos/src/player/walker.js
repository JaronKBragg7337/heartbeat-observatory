// ============================================================================
// walker.js — a body standing on a planet.
//
// OWNS: the player's f64 position and velocity, gravity, ground contact,
//       and the local East/North/Up frame they move in.
// DOES NOT OWN: the camera (cameras.js), input (touch.js), or the ground
//       itself (field.js). Contact is a field query, never a mesh raycast —
//       so the player stands on the world's real surface, not on a picture
//       of it that happens to be loaded right now.
//
// WHY CONTACT GOES THROUGH THE FIELD
// ----------------------------------
// If the player collided against the rendered patch, then walking past the
// patch boundary, or hitting a frame where the patch had not rebuilt yet,
// would drop them through the planet. Querying the field means contact is
// correct everywhere at all times, including inside a cave the renderer has
// not drawn, and including 400 km from the nearest loaded geometry.
//
// GRAVITY IS REAL
// ---------------
// Mars is 3.72 m/s^2, not 9.81. A jump goes higher and hangs longer, and that
// difference is the single most legible piece of physical truth a player feels
// in the first ten seconds. It is not tuned for feel; feel comes from the
// number being right.
// ============================================================================

import { gravityAtRadius } from '../world/bodies.js';
import { density, groundBelow, normalAt, materialAt } from '../world/field.js';
import { cartesianToGeodetic, geodeticToCartesian, localFrame } from '../world/geodesy.js';

export class Walker {
  constructor(body, opts = {}) {
    this.body = body;

    /** Authoritative f64 position: the point between the feet. */
    this.worldPos = { x: 0, y: 0, z: 0 };
    this.velocity = { x: 0, y: 0, z: 0 };

    // Real human dimensions. These are measurements, and the capsule that
    // collides is the same size as the body that renders.
    this.heightM = opts.heightM || 1.78;
    this.eyeHeightM = opts.eyeHeightM || 1.66;
    this.radiusM = opts.radiusM || 0.34;
    this.massKg = opts.massKg || 82;          // suited mass

    // Movement. Speeds are honest walking/running figures, then scaled by the
    // suit and the low gravity rather than invented.
    this.walkSpeed = opts.walkSpeed || 1.9;   // m/s, encumbered EVA pace
    this.runSpeed = opts.runSpeed || 4.4;     // m/s
    this.jumpSpeed = opts.jumpSpeed || 3.1;   // m/s initial vertical

    this.grounded = false;
    this.groundMaterial = null;
    this.groundNormal = { x: 0, y: 1, z: 0 };

    // Look angles, radians. Yaw is a compass bearing in the local frame.
    this.yaw = 0;
    this.pitch = 0;

    this._frame = { east: null, north: null, up: null };
    this._geo = { lat: 0, lon: 0, alt: 0 };

    /**
     * Optional sampler of the DRAWN ground: (dx,dy,dz) -> radius | null.
     * When set (main.js wires the local patch in), the feet stand on exactly
     * the surface being rendered. Without it, contact falls back to the field.
     * See LocalPatch.surfaceRadiusAt for why this is required rather than nice.
     */
    this.groundSampler = null;
  }

  /**
   * Ground under a world position, preferring the drawn surface.
   * Returns the same shape as field.groundBelow so callers do not branch.
   */
  _groundAt(px, py, pz) {
    const r = Math.hypot(px, py, pz) || 1;
    const dx = px / r, dy = py / r, dz = pz / r;

    if (this.groundSampler) {
      const gr = this.groundSampler(dx, dy, dz);
      if (gr !== null && gr !== undefined) {
        return {
          point: { x: dx * gr, y: dy * gr, z: dz * gr },
          distance: r - gr,                 // negative when below the surface
          material: materialAt(this.body, dx * gr, dy * gr, dz * gr),
          fromMesh: true,
        };
      }
    }
    const g = groundBelow(this.body, px, py, pz, 4000);
    if (g) g.fromMesh = false;
    return g;
  }

  /** Place the body at a geodetic coordinate, snapped onto the ground. */
  placeAtGeodetic(latDeg, lonDeg, extraAltM = 2) {
    const p = geodeticToCartesian(this.body, latDeg, lonDeg, 0);
    // Start well above and drop onto whatever the field says the ground is.
    const len = Math.hypot(p.x, p.y, p.z);
    const high = this.body.terrain.reliefMax + 2000;
    const sx = (p.x / len) * (len + high);
    const sy = (p.y / len) * (len + high);
    const sz = (p.z / len) * (len + high);
    const g = groundBelow(this.body, sx, sy, sz, high + 25000);
    if (g) {
      const n = Math.hypot(g.point.x, g.point.y, g.point.z);
      this.worldPos.x = g.point.x * (1 + extraAltM / n);
      this.worldPos.y = g.point.y * (1 + extraAltM / n);
      this.worldPos.z = g.point.z * (1 + extraAltM / n);
    } else {
      this.worldPos = { x: sx, y: sy, z: sz };
    }
    this.velocity = { x: 0, y: 0, z: 0 };
    this.updateFrame();
  }

  /** Current geodetic address. Recomputed every frame; this is the readout. */
  get geodetic() { return this._geo; }

  updateFrame() {
    const p = this.worldPos;
    cartesianToGeodetic(this.body, p.x, p.y, p.z, this._geo);
    this._frame = localFrame(this._geo.lat, this._geo.lon, this._frame);
    return this._frame;
  }

  /** Height of the feet above the ground directly below, metres. */
  altitudeAboveGround() {
    const g = groundBelow(this.body, this.worldPos.x, this.worldPos.y, this.worldPos.z, 5000);
    return g ? g.distance : Infinity;
  }

  /**
   * @param dt seconds
   * @param input { moveEast, moveNorth, run, jump }  each -1..1 / boolean
   */
  tick(dt, input = {}) {
    const body = this.body;
    const p = this.worldPos;
    const v = this.velocity;

    const f = this.updateFrame();
    const r = Math.hypot(p.x, p.y, p.z) || 1;
    // Gravity points at the centre of mass, which is the centre of the body.
    const gMag = gravityAtRadius(body, r);
    const gx = -p.x / r, gy = -p.y / r, gz = -p.z / r;

    // --- Desired horizontal motion, expressed in the local tangent plane. ---
    const speed = input.run ? this.runSpeed : this.walkSpeed;
    const mE = clamp(input.moveEast || 0, -1, 1);
    const mN = clamp(input.moveNorth || 0, -1, 1);
    const mag = Math.hypot(mE, mN);
    const nE = mag > 1 ? mE / mag : mE;
    const nN = mag > 1 ? mN / mag : mN;

    // Rotate the stick input by the look yaw so "forward" is where you face.
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    const fwd = nN * cy - nE * sy;
    const rgt = nN * sy + nE * cy;

    const wishX = (f.north.x * fwd + f.east.x * rgt) * speed;
    const wishY = (f.north.y * fwd + f.east.y * rgt) * speed;
    const wishZ = (f.north.z * fwd + f.east.z * rgt) * speed;

    // Split velocity into "along gravity" and "across gravity" so ground
    // friction and gravity never fight each other.
    const vDotG = v.x * gx + v.y * gy + v.z * gz;
    let vTanX = v.x - gx * vDotG, vTanY = v.y - gy * vDotG, vTanZ = v.z - gz * vDotG;

    // Ground gives you authority; air does not. 12/s on the ground is a
    // responsive but not instant stop, which matches a heavy suit.
    const accel = this.grounded ? 12 : 2.2;
    const k = Math.min(1, accel * dt);
    vTanX += (wishX - vTanX) * k;
    vTanY += (wishY - vTanY) * k;
    vTanZ += (wishZ - vTanZ) * k;

    let vRad = vDotG + gMag * dt;              // positive = falling inward

    if (this.grounded && input.jump) {
      vRad = -this.jumpSpeed;
      this.grounded = false;
    }

    v.x = vTanX + gx * vRad;
    v.y = vTanY + gy * vRad;
    v.z = vTanZ + gz * vRad;

    // --- Integrate. ---------------------------------------------------------
    let nx = p.x + v.x * dt, ny = p.y + v.y * dt, nz = p.z + v.z * dt;

    // --- Ground contact, from the surface the player can actually see. ------
    const ground = this._groundAt(nx, ny, nz);

    // GROUND SNAPPING. Without this, walking over any convex bump throws the
    // body into the air for a few frames — measured at 215 of 600 frames
    // airborne while running across real terrain, which reads as skipping
    // rather than walking. Real feet stay on a surface they are walking down;
    // they do not launch off every rise. So if we were grounded and the ground
    // is still within reach below, stay on it.
    //
    // The reach is speed-dependent: fast enough and you genuinely should leave
    // the ground. It is not a blanket magnet.
    const tangentSpeed = Math.hypot(vTanX, vTanY, vTanZ);
    const snapReach = this.grounded ? Math.max(0.35, tangentSpeed * dt * 2.2) : 0.04;

    if (ground && ground.distance <= snapReach) {
      // Land: rest a hair ABOVE the surface, not exactly on it. Sitting on the
      // zero crossing puts density at ~0, where float noise can read negative
      // and trip the solid-push backstop below — which is what made the body
      // bounce forever instead of standing still.
      const gl = Math.hypot(ground.point.x, ground.point.y, ground.point.z) || 1;
      const rest = 1 + 0.02 / gl;
      nx = ground.point.x * rest; ny = ground.point.y * rest; nz = ground.point.z * rest;
      const vd = v.x * (nx / gl) + v.y * (ny / gl) + v.z * (nz / gl);
      if (vd < 0) { v.x -= (nx / gl) * vd; v.y -= (ny / gl) * vd; v.z -= (nz / gl) * vd; }
      this.grounded = true;
      this.groundMaterial = ground.material;
      this.groundFromMesh = !!ground.fromMesh;
      normalAt(body, nx, ny, nz, 0.5, this.groundNormal);
    } else {
      this.groundFromMesh = false;
      this.grounded = false;
      if (ground) this.groundMaterial = ground.material;
    }

    // --- Never end a frame inside rock. -------------------------------------
    // This is the backstop that makes "no invisible walls, no falling through"
    // a property of the world rather than of any particular mesh being loaded.
    // Threshold is -0.08 m, not 0: resting contact sits at density ~0 and must
    // not be treated as a burial. Steps are small so a genuine intersection is
    // resolved smoothly rather than with a visible jolt.
    //
    // Skipped when standing on the drawn mesh. Flat triangles between vertices
    // cut across concave ground, so a body correctly stood on the surface it
    // can SEE is legitimately a few centimetres inside the analytic field.
    // Pushing it out there would re-create the exact floating the mesh-true
    // contact was added to remove — the two rules would fight every frame.
    if (!this.groundFromMesh && density(body, nx, ny, nz) < -0.08) {
      const n = normalAt(body, nx, ny, nz, 0.5);
      let push = 0;
      for (let i = 0; i < 24 && density(body, nx, ny, nz) < -0.02; i++) {
        push += 0.06;
        nx += n.x * 0.06; ny += n.y * 0.06; nz += n.z * 0.06;
      }
      // Cancel the velocity component that drove us in.
      const vd = v.x * n.x + v.y * n.y + v.z * n.z;
      if (vd < 0) { v.x -= n.x * vd; v.y -= n.y * vd; v.z -= n.z * vd; }
      this.lastPushOutM = push;
    }

    p.x = nx; p.y = ny; p.z = nz;
    this.updateFrame();
  }

  /** Eye position in f64 world metres — what the camera is anchored to. */
  eyeWorldPos(out = {}) {
    const p = this.worldPos;
    const r = Math.hypot(p.x, p.y, p.z) || 1;
    const k = this.eyeHeightM / r;
    out.x = p.x * (1 + k); out.y = p.y * (1 + k); out.z = p.z * (1 + k);
    return out;
  }

  /** What is under the boots, for the HUD. */
  groundMaterialName() {
    return this.groundMaterial ? this.groundMaterial.name : '—';
  }
}

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
