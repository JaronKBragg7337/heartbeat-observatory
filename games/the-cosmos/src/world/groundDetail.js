// groundDetail.js - what is on the ground within a few metres of your boots (ROUND7, "dark and plain up close").
//
//   * PEBBLES   real little stones (instanced, sunk a third into the ground, shadow-casting) in two rings round the player: 2-22 cm stones out to
//               15 m, 0.7-4 cm gravel out to 5 m. They sit on a fixed lattice of latitude/longitude cells, so a stone is where it was when you come back.
//   * PRINTS    boot prints (instanced decals) every 0.8 m you walk, left and right foot; they stay (120 per world, saved on this device).
//   * BLOBS     soft contact shadows under you (third person) and under the people standing near you: the sun shadow map is coarse close in and a
//               foot with no dark under it floats.
// Three draw calls in all (four counting the shadow pass of the pebbles). The pebbles and prints are positioned from the SAME ground the walker
// stands on (walker.groundSampler), so they never float or sink, and nothing is placed on dug ground, port concrete or a landing pad.
// Positions are f64 world coordinates; the meshes hang off one tracked anchor and are written relative to it (re-anchored every ~30 m).
import * as THREE from 'three';

const RINGS = [
  { cell: 2.2, reach: 12, rMin: 0.02, rMax: 0.22, p: 0.78, skew: 3 },     // stones
  { cell: 0.9, reach: 5.2, rMin: 0.007, rMax: 0.04, p: 0.85, skew: 1.6 },   // gravel
];
const PRINT_MAX = 120, STORE = 'cosmos-prints-v1';

function hash(i, j, s) { let h = (Math.imul(i | 0, 374761393) + Math.imul(j | 0, 668265263) + Math.imul(s | 0, 2147483647)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }

export class GroundDetail {
  /** @param o { engine, walker, tier, frameId():string, radiusM():number (nominal body radius for the lattice), allow(world):bool (pebbles), allowPrint(world):bool,
   *             people():[{x,y,z}] standing people near you, thirdPerson():bool, up(world):{x,y,z} */
  constructor(o) {
    Object.assign(this, o);
    this.cap = o.tier === 'low' ? 230 : 380;
    this.anchor = null; this.frame = null; this.lastCenter = null; this.slots = new Map(); this.free = []; this.need = []; this.pebbleN = 0;
    this.anchorEntry = { worldPos: { x: 0, y: 0, z: 0 }, object3d: new THREE.Group(), quaternion: new THREE.Quaternion(), followActive: true };   // rides in the active frame (Mars or a moon)
    this.group = this.anchorEntry.object3d; this.group.name = 'ground-detail'; this.group.visible = false;
    o.engine.scene.add(this.group); o.engine.track(this.anchorEntry);
    const dummy = new THREE.Matrix4();
    // pebbles: a low flat-shaded rock, stretched per stone
    const geo = new THREE.IcosahedronGeometry(1, 0);
    this.pebbles = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, flatShading: true }), this.cap);
    this.pebbles.castShadow = o.tier !== 'low'; this.pebbles.receiveShadow = false; this.pebbles.frustumCulled = false; this.pebbles.count = 0;   // (not receiving: shadow acne striped the little stones)
    this.pd = { pos: new Float64Array(this.cap * 3), size: new Float32Array(this.cap), q: new Float32Array(this.cap * 4), sy: new Float32Array(this.cap) };
    this.group.add(this.pebbles);
    for (let i = 0; i < this.cap; i++) { this.pebbles.setMatrixAt(i, dummy.makeScale(0, 0, 0)); this.free.push(this.cap - 1 - i); }
    this.pebbles.setColorAt(0, new THREE.Color(0x6a4a3a));
    // boot prints
    const c = document.createElement('canvas'); c.width = 64; c.height = 128; const g = c.getContext('2d');
    g.fillStyle = 'rgba(0,0,0,0)'; g.clearRect(0, 0, 64, 128);
    // a boot: a sole with a waist and a separate heel, a few shallow tread bars, soft edges
    g.filter = 'blur(1.2px)'; g.fillStyle = 'rgba(0,0,0,.6)';
    g.beginPath(); g.moveTo(32, 6); g.bezierCurveTo(54, 8, 56, 40, 46, 60); g.bezierCurveTo(42, 70, 22, 70, 18, 60); g.bezierCurveTo(8, 40, 10, 8, 32, 6); g.fill();   // sole
    g.beginPath(); g.ellipse(32, 100, 14, 17, 0, 0, Math.PI * 2); g.fill();                                                                                        // heel
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = 'rgba(0,0,0,.22)'; for (let y = 16; y < 62; y += 10) g.fillRect(16, y, 32, 3);                 // tread
    const tex = new THREE.CanvasTexture(c); tex.anisotropy = 4;
    const pg = new THREE.PlaneGeometry(0.15, 0.31); pg.rotateX(-Math.PI / 2);
    const pm = new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 1, color: 0x2a1c14, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.prints = new THREE.InstancedMesh(pg, pm, PRINT_MAX); this.prints.frustumCulled = false; this.prints.count = 0; this.prints.receiveShadow = true; this.group.add(this.prints);
    this.printData = []; this.printHead = 0; this.printSide = 1; this.lastPrint = null; this.dirtyPrints = false; this.saveAt = 0;
    // contact shadows
    const bc = document.createElement('canvas'); bc.width = bc.height = 64; const bg = bc.getContext('2d'); const rg = bg.createRadialGradient(32, 32, 2, 32, 32, 31);
    rg.addColorStop(0, 'rgba(0,0,0,.62)'); rg.addColorStop(.55, 'rgba(0,0,0,.34)'); rg.addColorStop(1, 'rgba(0,0,0,0)'); bg.fillStyle = rg; bg.fillRect(0, 0, 64, 64);
    const bgeo = new THREE.PlaneGeometry(1, 1); bgeo.rotateX(-Math.PI / 2);
    this.blobCap = 24;
    this.blobs = new THREE.InstancedMesh(bgeo, new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(bc), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }), this.blobCap);
    this.blobs.frustumCulled = false; this.blobs.count = 0; this.group.add(this.blobs);
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._v = new THREE.Vector3(); this._s = new THREE.Vector3(); this._col = new THREE.Color();
    this._loadPrints();
  }

  hide() { this.group.visible = false; }

  // ------------------------------------------------------------------------------------------------------------------------------------------
  _anchorAt(w) {
    this.anchor = { x: w.x, y: w.y, z: w.z }; Object.assign(this.anchorEntry.worldPos, this.anchor);
    for (const slot of this.slots.values()) this._writePebble(slot);
    for (let i = 0; i < this.printData.length; i++) this._writePrint(i);
    this.prints.instanceMatrix.needsUpdate = true; this.pebbles.instanceMatrix.needsUpdate = true;
  }
  _clear() {
    this.slots.clear(); this.free.length = 0; const z = this._m.makeScale(0, 0, 0);
    for (let i = this.cap - 1; i >= 0; i--) { this.free.push(i); this.pebbles.setMatrixAt(i, z); }
    this.pebbles.instanceMatrix.needsUpdate = true; this.pebbles.count = 0; this.pebbleN = 0; this.need = [];
    this.printData = []; this.printHead = 0; this.prints.count = 0; this.lastPrint = null; this._loadPrints();
  }

  _dir(lat, lon) { const cl = Math.cos(lat); return { x: cl * Math.cos(lon), y: Math.sin(lat), z: cl * Math.sin(lon) }; }

  /** The stones that should exist round `w`: lattice cells of latitude / longitude, each with a stable hash. */
  _wanted(w) {
    const R = this.radiusM(), r = Math.hypot(w.x, w.y, w.z) || 1, lat0 = Math.asin(Math.max(-1, Math.min(1, w.y / r))), lon0 = Math.atan2(w.z, w.x), out = [];
    RINGS.forEach((ring, ri) => {
      const d = ring.cell / R, K = Math.ceil(ring.reach / ring.cell), i0 = Math.round(lat0 / d), cl = Math.max(0.05, Math.cos(lat0)), dl = d / cl, j0 = Math.round(lon0 / dl);
      for (let a = -K; a <= K; a++) for (let b = -K; b <= K; b++) {
        const i = i0 + a, j = j0 + b, seed = ri * 7919 + 13; if (hash(i, j, seed) > ring.p) continue;
        const lat = (i + 0.1 + 0.8 * hash(i, j, seed + 1)) * d, lon = (j + 0.1 + 0.8 * hash(i, j, seed + 2)) * (d / Math.max(0.05, Math.cos(lat)));
        const dir = this._dir(lat, lon), dx = dir.x * r - w.x, dy = dir.y * r - w.y, dz = dir.z * r - w.z, dist = Math.hypot(dx, dy, dz);
        if (dist > ring.reach) continue;
        out.push({ key: ri + ':' + i + ':' + j, ri, i, j, lat, lon, dist, h1: hash(i, j, seed + 3), h2: hash(i, j, seed + 4), h3: hash(i, j, seed + 5), h4: hash(i, j, seed + 6) });
      }
    });
    return out;
  }

  _place(c) {
    const earth = this.frameId() === 'earth';
    if (earth && c.ri === 0) return false;       // Earth: no loose stones on a Florida coast (they were the Moon's and Mars's black rocks); only shell grit on sand, below
    const ring = RINGS[c.ri], dir = this._dir(c.lat, c.lon), r0 = this.radiusM();
    const gr = this.walker.groundSampler ? this.walker.groundSampler(dir.x, dir.y, dir.z, r0) : null;
    if (typeof gr !== 'number' || !(gr > 0)) return false;
    const size = ring.rMin + (ring.rMax - ring.rMin) * Math.pow(c.h1, ring.skew);
    const wp = { x: dir.x * (gr - size * 0.2), y: dir.y * (gr - size * 0.2), z: dir.z * (gr - size * 0.2) };
    if (this.allow && !this.allow(wp)) return false;
    const slot = this.free.pop(); if (slot === undefined) return false;
    const a = c.h2 * Math.PI * 2, b = (c.h3 - 0.5) * 0.9;
    this._q.setFromEuler(new THREE.Euler(b, a, (c.h4 - 0.5) * 0.9));
    const d = this.pd; d.pos.set([wp.x, wp.y, wp.z], slot * 3); d.size[slot] = size; d.sy[slot] = 0.7 + 0.35 * c.h4; this._q.toArray(d.q, slot * 4);
    // colour: a dark basalt-and-rust mix on Mars, greys on the moons (the frame says which), a few lighter ones
    const moon = this.frameId() !== 'mars', t = c.h3, light = c.h4 > 0.9 ? 1.35 : 1;
    if (earth) this._col.setRGB((0.62 + 0.22 * t) * light, (0.57 + 0.2 * t) * light, (0.45 + 0.17 * t) * light, THREE.SRGBColorSpace);      // shell grit: cream and pale tan
    else if (moon) this._col.setRGB((0.20 + 0.14 * t) * light, (0.19 + 0.13 * t) * light, (0.18 + 0.12 * t) * light, THREE.SRGBColorSpace);
    else this._col.setRGB((0.17 + 0.18 * t) * light, (0.10 + 0.10 * t) * light, (0.07 + 0.07 * t) * light, THREE.SRGBColorSpace);
    this.pebbles.setColorAt(slot, this._col); if (this.pebbles.instanceColor) this.pebbles.instanceColor.needsUpdate = true;
    const s = { slot, key: c.key, ri: c.ri }; this.slots.set(c.key, s); this._writePebble(s); this.pebbleN = Math.max(this.pebbleN, slot + 1); this.pebbles.count = this.pebbleN;
    return true;
  }
  _writePebble(s) {
    const d = this.pd, i = s.slot, A = this.anchor; if (!A) return;
    this._v.set(d.pos[i * 3] - A.x, d.pos[i * 3 + 1] - A.y, d.pos[i * 3 + 2] - A.z); this._q.fromArray(d.q, i * 4);
    const z = d.size[i]; this._s.set(z, z * d.sy[i], z * 0.8); this._m.compose(this._v, this._q, this._s); this.pebbles.setMatrixAt(i, this._m); this.pebbles.instanceMatrix.needsUpdate = true;
  }
  /** The ground a stone was set on can be a coarser tier (the 48 m near patch had not yet followed a jump, or a dig changed it): look at a few stones every frame and settle them. */
  _recheck(n) {
    if (!this.slots.size) return;
    if (!this._ring || this._ringVer !== this.slots.size || this._ringAt >= this._ring.length) { this._ring = [...this.slots.values()]; this._ringVer = this.slots.size; this._ringAt = 0; }
    const w = this.walker, d = this.pd;
    for (let k = 0; k < n && this._ringAt < this._ring.length; k++, this._ringAt++) {
      const s = this._ring[this._ringAt]; if (this.slots.get(s.key) !== s) continue;
      const i = s.slot, x = d.pos[i * 3], y = d.pos[i * 3 + 1], z = d.pos[i * 3 + 2], r = Math.hypot(x, y, z), ux = x / r, uy = y / r, uz = z / r;
      const gr = w.groundSampler ? w.groundSampler(ux, uy, uz, r) : null;
      if (typeof gr !== 'number' || !(gr > 0)) { this._release(s.key); continue; }       // dug up: the stone goes
      const want = gr - d.size[i] * 0.2;
      if (Math.abs(want - r) > 0.02) { d.pos[i * 3] = ux * want; d.pos[i * 3 + 1] = uy * want; d.pos[i * 3 + 2] = uz * want; this._writePebble(s); }
    }
  }
  _release(key) { const s = this.slots.get(key); if (!s) return; this.slots.delete(key); this.pebbles.setMatrixAt(s.slot, this._m.makeScale(0, 0, 0)); this.free.push(s.slot); this.pebbles.instanceMatrix.needsUpdate = true; }

  // ------------------------------------------------------------------------------------------------------------------------------------------
  _printBasis(p) {
    const r = Math.hypot(p.x, p.y, p.z) || 1, up = new THREE.Vector3(p.x / r, p.y / r, p.z / r);
    const e = new THREE.Vector3(-up.z, 0, up.x); if (e.lengthSq() < 1e-6) e.set(1, 0, 0); e.normalize(); const n = new THREE.Vector3().crossVectors(e, up).normalize().negate();   // east, north (any right-handed tangent pair)
    return { up, e, n };
  }
  _writePrint(i) {
    const p = this.printData[i], A = this.anchor; if (!A || !p) return;
    const { up, e, n } = this._printBasis(p), f = new THREE.Vector3().copy(n).multiplyScalar(Math.cos(p.yaw)).addScaledVector(e, Math.sin(p.yaw)).normalize();
    const right = new THREE.Vector3().crossVectors(f, up).normalize();
    this._m.makeBasis(right, up, f.clone().negate()); this._m.setPosition(p.x - A.x, p.y - A.y, p.z - A.z); this.prints.setMatrixAt(i, this._m);
  }
  _addPrint(p) {
    const i = this.printHead % PRINT_MAX; this.printHead++; this.printData[i] = p; this.prints.count = Math.min(PRINT_MAX, this.printHead);
    this._writePrint(i); this.prints.instanceMatrix.needsUpdate = true; this.dirtyPrints = true;
  }
  _loadPrints() {
    try { const all = JSON.parse(localStorage.getItem(STORE) || '{}'), list = all[this.frameId()] || []; for (const q of list.slice(-PRINT_MAX)) { this.printData[this.printHead % PRINT_MAX] = { x: q[0], y: q[1], z: q[2], yaw: q[3] }; this.printHead++; }
      this.prints.count = Math.min(PRINT_MAX, this.printHead); this.dirtyPrints = false; } catch { /* private window: prints last for this visit only */ }
  }
  _savePrints() {
    try { const all = JSON.parse(localStorage.getItem(STORE) || '{}'), n = Math.min(PRINT_MAX, this.printHead), list = [];
      for (let k = 0; k < n; k++) { const p = this.printData[(this.printHead - n + k + PRINT_MAX * 4) % PRINT_MAX]; if (p) list.push([+p.x.toFixed(3), +p.y.toFixed(3), +p.z.toFixed(3), +p.yaw.toFixed(3)]); }
      all[this.frameId()] = list; localStorage.setItem(STORE, JSON.stringify(all)); } catch { /* storage may be blocked */ }
    this.dirtyPrints = false;
  }

  // ------------------------------------------------------------------------------------------------------------------------------------------
  /** Call once a frame while the player is on foot. */
  update(dt, now = performance.now()) {
    const w = this.walker.worldPos, fid = this.frameId();
    if (fid !== this.frame) { if (this.frame !== null) this._savePrints(); this.frame = fid; this._clear(); this.anchor = null; this.lastCenter = null; }
    this.group.visible = true;
    if (!this.anchor || Math.hypot(w.x - this.anchor.x, w.y - this.anchor.y, w.z - this.anchor.z) > 30) this._anchorAt(w);
    // pebbles: re-plan when you have moved a metre, place a few per frame
    if (!this.lastCenter || Math.hypot(w.x - this.lastCenter.x, w.y - this.lastCenter.y, w.z - this.lastCenter.z) > 1) {
      this.lastCenter = { x: w.x, y: w.y, z: w.z };
      const want = this._wanted(w), keep = new Set(want.map(c => c.key));
      for (const key of [...this.slots.keys()]) if (!keep.has(key)) this._release(key);
      this.need = want.filter(c => !this.slots.has(c.key)).sort((a, b) => a.dist - b.dist);
    }
    for (let k = 0; k < 18 && this.need.length; k++) this._place(this.need.shift());
    this._recheck(8);
    // boot prints
    if (this.walker.grounded && !this.walkerHidden) {
      const sp = Math.hypot(this.walker.velocity.x, this.walker.velocity.y, this.walker.velocity.z);
      if (sp > 0.4 && (!this.lastPrint || Math.hypot(w.x - this.lastPrint.x, w.y - this.lastPrint.y, w.z - this.lastPrint.z) > 0.8) && (!this.allowPrint || this.allowPrint(w))) {
        const f = this.walker.updateFrame(), yaw = this.walker.yaw, h = { x: f.north.x * Math.cos(yaw) + f.east.x * Math.sin(yaw), y: f.north.y * Math.cos(yaw) + f.east.y * Math.sin(yaw), z: f.north.z * Math.cos(yaw) + f.east.z * Math.sin(yaw) };
        const rx = h.y * f.up.z - h.z * f.up.y, ry = h.z * f.up.x - h.x * f.up.z, rz = h.x * f.up.y - h.y * f.up.x, side = (this.printSide *= -1) * 0.1;
        this._addPrint({ x: w.x + rx * side + f.up.x * 0.012, y: w.y + ry * side + f.up.y * 0.012, z: w.z + rz * side + f.up.z * 0.012, yaw });
        this.lastPrint = { x: w.x, y: w.y, z: w.z };
      }
    }
    if (this.dirtyPrints && now > this.saveAt) { this.saveAt = now + 4000; this._savePrints(); }
    // contact shadows, rewritten every frame (a handful)
    let nb = 0; const A = this.anchor, up = this.up;
    const put = (p, size, a) => {
      if (nb >= this.blobCap) return; const u = up(p); this._q.setFromUnitVectors(this._v.set(0, 1, 0), this._s.set(u.x, u.y, u.z));
      this._v.set(p.x - A.x + u.x * 0.03, p.y - A.y + u.y * 0.03, p.z - A.z + u.z * 0.03); this._s.set(size, 1, size * a); this._m.compose(this._v, this._q, this._s); this.blobs.setMatrixAt(nb++, this._m);
    };
    if (this.thirdPerson()) put(w, 1.0, 1);
    for (const p of this.people()) put(p, 0.95, 1);
    this.blobs.count = nb; this.blobs.instanceMatrix.needsUpdate = true;
  }
}
