// ============================================================================
// speedFx.js — FLIGHTFEEL: what makes speed visible.
//
// OWNS: streaks of dust (in the air) and star-dust (in space) that stream past the camera, longer and brighter the faster the ship goes; the
//       field-of-view kick; the chase camera's trailing distance. Drawn in the camera's own frame (the floating origin: the scene origin IS the
//       camera), one LineSegments draw call.
// DOES NOT OWN: the camera itself (shipSystem.js asks this for numbers), the ship's speed (shipFlight.js), the real star sky (space/spaceSky.js:
//       the real stars are at infinity and cannot streak, so the streaks are near particles, which is what a ship at speed actually passes).
//
// The particles stand still in the world. Each frame the camera moves through them: a particle's camera-relative position loses the camera's
// own displacement, and one that falls behind or out of the shell is re-born ahead, in the direction she is going. Length follows speed.
// ============================================================================

import * as THREE from 'three';

const N = 210;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export class SpeedFx {
  constructor(scene, { tier = 'high' } = {}) {
    this.n = tier === 'low' ? 90 : N;
    this.pos = new Float32Array(this.n * 3);          // camera-relative, world axes
    this.seed = new Float32Array(this.n);
    this.verts = new Float32Array(this.n * 6);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.verts, 3).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.LineBasicMaterial({ color: 0xe8d9c8, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    this.lines = new THREE.LineSegments(geo, this.mat);
    this.lines.frustumCulled = false; this.lines.renderOrder = 8; this.lines.visible = false;
    scene.add(this.lines);
    this.last = null; this.rng = 1234567;
    for (let i = 0; i < this.n; i++) this._birth(i, null, true);
    this.speed = 0;
  }
  _r() { this.rng = (this.rng * 16807) % 2147483647; return this.rng / 2147483647; }
  /** Put particle i in the shell round the camera; `ahead` = the unit direction she is going (new ones are born in front, so they pass instead of popping in beside her). */
  _birth(i, ahead, anywhere = false) {
    const r = 14 + this._r() * 110, th = this._r() * Math.PI * 2, ph = Math.acos(2 * this._r() - 1);
    let x = r * Math.sin(ph) * Math.cos(th), y = r * Math.cos(ph), z = r * Math.sin(ph) * Math.sin(th);
    if (ahead && !anywhere) {
      const d = x * ahead.x + y * ahead.y + z * ahead.z;
      if (d < 0) { x -= 2 * d * ahead.x; y -= 2 * d * ahead.y; z -= 2 * d * ahead.z; }
    }
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z; this.seed[i] = this._r();
  }

  /**
   * @param dt        seconds
   * @param camWorld  the camera's world position (f64 metres)
   * @param vel       the ship's world velocity (m/s)
   * @param opts      { vmax: the top speed here (the streaks scale against it), air: 0..1 how much air there is (warm dust) or 0 (cold star-dust), boosting }
   */
  update(dt, camWorld, vel, { vmax = 400, air = 1, boosting = false, on = true } = {}) {
    const sp = Math.hypot(vel.x, vel.y, vel.z);
    this.speed = sp;
    const k = on ? smooth(30, Math.max(120, vmax * 0.5), sp) : 0;
    this.lines.visible = k > 0.01;
    if (!this.lines.visible) { this.last = { x: camWorld.x, y: camWorld.y, z: camWorld.z }; return 0; }
    if (!this.last) this.last = { x: camWorld.x, y: camWorld.y, z: camWorld.z };
    const dx = camWorld.x - this.last.x, dy = camWorld.y - this.last.y, dz = camWorld.z - this.last.z;
    this.last.x = camWorld.x; this.last.y = camWorld.y; this.last.z = camWorld.z;
    const inv = sp > 0.01 ? 1 / sp : 0, ax = vel.x * inv, ay = vel.y * inv, az = vel.z * inv;
    const len = clamp(sp * 0.035, 1.5, 70) * (boosting ? 1.35 : 1);
    const R2 = 130 * 130;
    for (let i = 0; i < this.n; i++) {
      const o = i * 3;
      this.pos[o] -= dx; this.pos[o + 1] -= dy; this.pos[o + 2] -= dz;
      const px = this.pos[o], py = this.pos[o + 1], pz = this.pos[o + 2];
      const d2 = px * px + py * py + pz * pz;
      const behind = px * ax + py * ay + pz * az < -60;
      if (d2 > R2 || behind || d2 < 100) this._birth(i, { x: ax, y: ay, z: az });
      const v = i * 6, q = this.pos;
      this.verts[v] = q[o]; this.verts[v + 1] = q[o + 1]; this.verts[v + 2] = q[o + 2];
      const l = len * (0.5 + this.seed[i]);
      this.verts[v + 3] = q[o] + ax * l; this.verts[v + 4] = q[o + 1] + ay * l; this.verts[v + 5] = q[o + 2] + az * l;
    }
    this.lines.geometry.attributes.position.needsUpdate = true;
    this.mat.opacity = 0.7 * k;
    this.mat.color.setHex(air > 0.2 ? (boosting ? 0xffe3b8 : 0xe8d3bd) : (boosting ? 0xcfe8ff : 0xdce8ff));
    return k;
  }
  dispose() { this.lines.parent && this.lines.parent.remove(this.lines); this.lines.geometry.dispose(); this.mat.dispose(); }
}

/** The field-of-view kick (degrees) for a speed against the top speed here: nothing when crawling, up to ~16 at the top, six more boosting. */
export function fovKickDeg(speed, vmax, boosting = false) {
  const k = smooth(25, Math.max(100, vmax * 0.9), speed);
  return 16 * Math.pow(k, 0.85) + (boosting ? 6 : 0);
}
