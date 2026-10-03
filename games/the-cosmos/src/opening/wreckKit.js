// Helpers for building the crashed freighter and its site. Art only: no rules, no input, no saves.
//  - rng/noise: deterministic, so the wreck is the same wreck on every phone and every play.
//  - Kit3: the ship Kit with a full 3D transform stack (the stock Kit only turns about Y).
//  - sheet(): a bent, torn plate. A parametric surface cut by a signed field, so a tear is a real ragged edge with
//    thickness, scorched rim and a bare inner face, not a missing box.
import * as THREE from 'three';
import { Kit } from '../ship/shipKit.js';

export const rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
const hash = (x, y, s = 0) => { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 2147483647); h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967296; };
export const noise = (x, y, s = 0) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
export const fbm = (x, y, s = 0, o = 4) => { let a = .5, f = 1, t = 0, n = 0; for (let i = 0; i < o; i++) { t += a * noise(x * f, y * f, s + i * 17); n += a; a *= .5; f *= 2.03; } return t / n; };
export const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export class Kit3 extends Kit {
  // low: phone tier. Chamfered boxes become plain boxes and round things use fewer sides, so the same wreck costs a third of the triangles.
  constructor(low = false) { super(); this.low = low; this.M = new THREE.Matrix4(); this.MS = []; this._v = new THREE.Vector3(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._o = new THREE.Vector3(1, 1, 1); }
  push(x, y, z, ry = 0, rx = 0, rz = 0) {
    this.MS.push(this.M.clone());
    this._e.set(rx, ry, rz, 'YXZ'); this._q.setFromEuler(this._e);
    this.M.multiply(new THREE.Matrix4().compose(this._v.set(x, y, z), this._q, this._o)); return this;
  }
  pop() { this.M = this.MS.pop(); return this; }
  bevelBox(key, cx, cy, cz, w, h, d, c = .03, o = {}) { return this.low ? this.box(key, cx, cy, cz, w, h, d, o) : super.bevelBox(key, cx, cy, cz, w, h, d, c, o); }
  cyl(key, cx, cy, cz, r, h, seg = 12, o = {}) { return super.cyl(key, cx, cy, cz, r, h, this.low ? Math.min(seg, 7) : seg, o); }
  pillow(key, cx, cy, cz, w, h, d, n = 3.2, seg = 14, o = {}) { return super.pillow(key, cx, cy, cz, w, h, d, n, this.low ? Math.min(seg, 3) : seg, o); }
  pipe(key, a, b, r, seg = 8, o = {}) { return super.pipe(key, a, b, r, this.low ? Math.min(seg, 5) : seg, o); }
  _tp(x, y, z) { const v = this._v.set(x, y, z).applyMatrix4(this.M); return [v.x, v.y, v.z]; }
  _tn(x, y, z) { const v = this._v.set(x, y, z).transformDirection(this.M); return [v.x, v.y, v.z]; }
}

// A tri-mesh writer straight into a Kit bucket (smooth normals, per-vertex colour).
function writer(k, key, baseCol) {
  const [rk, ac] = k._al(key, baseCol);
  const b = k._bucket(rk), mul = ac || [1, 1, 1];
  return {
    b, v(p, n, u, vv, c) { const i = b.pos.length / 3; p = k._tp(p[0], p[1], p[2]); n = k._tn(n[0], n[1], n[2]); b.pos.push(p[0], p[1], p[2]); b.nrm.push(n[0], n[1], n[2]); b.uv.push(u, vv);
      b.col.push(mul[0] * (c ? c[0] : 1), mul[1] * (c ? c[1] : 1), mul[2] * (c ? c[2] : 1)); return i; },
    tri(a, bb, c) { b.idx.push(a, bb, c); k.triangles++; },
  };
}
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * A bent plate. o:
 *   P(a,b) -> [x,y,z]      the surface
 *   a0,a1,b0,b1, cell      parameter box and target cell size (metres in a / b)
 *   field(a,b) -> number   >0 keeps metal; ~metres to the nearest tear; omit for a whole sheet
 *   faceTo(p) -> [x,y,z]   which way the visible face points (decides winding)
 *   col(p,f,a,b) -> [r,g,b]  vertex tint;  uv(a,b) -> [u,v];  thick  plate thickness (lip + back face)
 *   inner / lip: {key,col}  finishes for the back face and the torn rim
 */
export function sheet(k, key, o) {
  const A = Math.max(1, Math.ceil((o.a1 - o.a0) / o.cell)), B = Math.max(1, Math.ceil((o.b1 - o.b0) / (o.cellB || o.cell)));
  const thick = o.thick ?? .04, field = o.field || (() => 9), colf = o.col || (() => null);
  const uvf = o.uv || ((a, b) => [a / 8, b / 8]);
  const N = (A + 1) * (B + 1), pos = new Array(N), f = new Float32Array(N), uv = new Array(N), col = new Array(N), nrm = new Array(N);
  const id = (i, j) => i * (B + 1) + j;
  for (let i = 0; i <= A; i++) for (let j = 0; j <= B; j++) {
    const a = o.a0 + (o.a1 - o.a0) * i / A, b = o.b0 + (o.b1 - o.b0) * j / B, n = id(i, j);
    pos[n] = o.P(a, b); f[n] = field(a, b); uv[n] = uvf(a, b); col[n] = colf(pos[n], f[n], a, b);
  }
  for (let i = 0; i <= A; i++) for (let j = 0; j <= B; j++) {
    const p = pos[id(i, j)], pa = pos[id(Math.min(A, i + 1), j)], pb = pos[id(i, Math.min(B, j + 1))], qa = pos[id(Math.max(0, i - 1), j)], qb = pos[id(i, Math.max(0, j - 1))];
    let n = norm(cross(sub(pa, qa), sub(pb, qb)));
    const want = o.faceTo(p); if (dot(n, want) < 0) n = [-n[0], -n[1], -n[2]];
    nrm[id(i, j)] = n;
  }
  const W = writer(k, key, o.baseCol), Wi = o.inner && writer(k, o.inner.key, o.inner.col), Wl = writer(k, (o.lip || o.inner || { key }).key, (o.lip || {}).col);
  const nearM = o.nearM ?? 1.5;
  const mix = (v0, v1, t) => ({ p: [lerp(v0.p[0], v1.p[0], t), lerp(v0.p[1], v1.p[1], t), lerp(v0.p[2], v1.p[2], t)], n: norm([lerp(v0.n[0], v1.n[0], t), lerp(v0.n[1], v1.n[1], t), lerp(v0.n[2], v1.n[2], t)]),
    uv: [lerp(v0.uv[0], v1.uv[0], t), lerp(v0.uv[1], v1.uv[1], t)], c: [lerp(v0.c[0], v1.c[0], t), lerp(v0.c[1], v1.c[1], t), lerp(v0.c[2], v1.c[2], t)], f: lerp(v0.f, v1.f, t) });
  const V = (i, j) => { const n = id(i, j); return { p: pos[n], n: nrm[n], uv: uv[n], c: col[n] || [1, 1, 1], f: f[n] }; };
  const emitPoly = (poly, near) => {
    const kept = poly.length < 3 ? null : poly; if (!kept) return;
    // winding agrees with the vertex normals
    const gn = cross(sub(kept[1].p, kept[0].p), sub(kept[2].p, kept[0].p)); const flip = dot(gn, kept[0].n) < 0;
    const ids = kept.map((q) => W.v(q.p, q.n, q.uv[0], q.uv[1], q.c));
    for (let i = 1; i < kept.length - 1; i++) flip ? W.tri(ids[0], ids[i + 1], ids[i]) : W.tri(ids[0], ids[i], ids[i + 1]);
    if (near && Wi) {
      const dn = (q) => [q.p[0] - q.n[0] * thick, q.p[1] - q.n[1] * thick, q.p[2] - q.n[2] * thick];
      const ic = o.inner.tint || [1, 1, 1];
      const jd = kept.map((q) => Wi.v(dn(q), [-q.n[0], -q.n[1], -q.n[2]], q.uv[0] * 2, q.uv[1] * 2, [ic[0] * (q.c[0] * .6 + .35), ic[1] * (q.c[1] * .6 + .35), ic[2] * (q.c[2] * .6 + .35)]));
      for (let i = 1; i < kept.length - 1; i++) flip ? Wi.tri(jd[0], jd[i], jd[i + 1]) : Wi.tri(jd[0], jd[i + 1], jd[i]);
    }
  };
  const lipSeg = (c0, c1, centroid) => {
    if (!Wl || thick <= 0) return;
    const mid = [(c0.p[0] + c1.p[0]) / 2, (c0.p[1] + c1.p[1]) / 2, (c0.p[2] + c1.p[2]) / 2];
    const n = norm([c0.n[0] + c1.n[0], c0.n[1] + c1.n[1], c0.n[2] + c1.n[2]]);
    const e = sub(c1.p, c0.p); let out = norm(cross(e, n));
    if (dot(out, sub(mid, centroid)) < 0) out = [-out[0], -out[1], -out[2]];
    const d = (q) => [q.p[0] - n[0] * thick, q.p[1] - n[1] * thick, q.p[2] - n[2] * thick];
    const lc = (o.lip && o.lip.tint) || [1, 1, 1];
    const t = .55 + .45 * hash(Math.round(mid[0] * 7), Math.round(mid[2] * 7), 5);
    const c = [lc[0] * t, lc[1] * t, lc[2] * t];
    const i0 = Wl.v(c0.p, out, 0, 0, c), i1 = Wl.v(c1.p, out, 1, 0, c), i2 = Wl.v(d(c1), out, 1, 1, c), i3 = Wl.v(d(c0), out, 0, 1, c);
    const g = cross(sub(c1.p, c0.p), sub(d(c0), c0.p)); if (dot(g, out) >= 0) { Wl.tri(i0, i1, i2); Wl.tri(i0, i2, i3); } else { Wl.tri(i0, i2, i1); Wl.tri(i0, i3, i2); }
  };
  const tri = (v0, v1, v2) => {
    const vs = [v0, v1, v2], inside = vs.map((q) => q.f >= 0);
    const near = vs.some((q) => q.f < nearM);
    if (inside[0] && inside[1] && inside[2]) return emitPoly(vs, near);
    if (!inside[0] && !inside[1] && !inside[2]) return;
    const poly = [], cuts = [];
    for (let e = 0; e < 3; e++) {
      const a = vs[e], b = vs[(e + 1) % 3];
      if (a.f >= 0) poly.push(a);
      if ((a.f >= 0) !== (b.f >= 0)) { const t = a.f / (a.f - b.f), m = mix(a, b, t); m.f = 0; poly.push(m); cuts.push(m); }
    }
    emitPoly(poly, true);
    if (cuts.length === 2) { const cen = poly.reduce((s, q) => [s[0] + q.p[0] / poly.length, s[1] + q.p[1] / poly.length, s[2] + q.p[2] / poly.length], [0, 0, 0]); lipSeg(cuts[0], cuts[1], cen); }
  };
  for (let i = 0; i < A; i++) for (let j = 0; j < B; j++) {
    const a = V(i, j), b = V(i + 1, j), c = V(i + 1, j + 1), d = V(i, j + 1);
    // alternate the diagonal so tear edges do not all lean one way
    if ((i + j) & 1) { tri(a, b, c); tri(a, c, d); } else { tri(a, b, d); tri(b, c, d); }
  }
}

// An arbitrarily oriented box. rot is [rx,ry,rz] (YXZ), c is the centre.
export function obox(k, key, c, size, rot = [0, 0, 0], col, bevel = 0) {
  k.push(c[0], c[1], c[2], rot[1], rot[0], rot[2]);
  if (bevel > 0) k.bevelBox(key, 0, 0, 0, size[0], size[1], size[2], bevel, { col }); else k.box(key, 0, 0, 0, size[0], size[1], size[2], { col });
  k.pop();
}
// A box from point a to point b (a beam). `up` orients the cross-section (e.g. radial for a rib), so a web stands on edge.
export function beam(k, key, a, b, w, h, col, up) {
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), len = d.length(); if (len < 1e-4) return;
  const z = d.clone().normalize(); const u = up ? new THREE.Vector3(up[0], up[1], up[2]) : (Math.abs(z.y) < .9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0));
  u.addScaledVector(z, -u.dot(z)); if (u.lengthSq() < 1e-6) u.set(1, 0, 0).addScaledVector(z, -z.x); u.normalize();
  const x = new THREE.Vector3().crossVectors(u, z).normalize();
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, u, z));
  const e = new THREE.Euler().setFromQuaternion(q, 'YXZ');
  obox(k, key, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], [w, h, len], [e.x, e.y, e.z], col);
}
// A hanging cable: sags between two points, optionally frayed at the free end (bare copper).
export function cable(k, a, b, r, sag, rnd, o = {}) {
  const n = k.low ? Math.max(3, Math.round((o.n || 7) * .5)) : (o.n || 7), col = o.col || [.05, .05, .06]; let prev = a;
  for (let i = 1; i <= n; i++) {
    const t = i / n, p = [lerp(a[0], b[0], t) + (rnd() - .5) * (o.wob ?? .04), lerp(a[1], b[1], t) - Math.sin(t * Math.PI) * sag, lerp(a[2], b[2], t) + (rnd() - .5) * (o.wob ?? .04)];
    k.pipe('rubber', prev, p, r, 5, { col }); prev = p;
  }
  if (o.frayed) { const t = [b[0] + (rnd() - .5) * .08, b[1] - .07, b[2] + (rnd() - .5) * .08];
    k.pipe('copper', b, t, r * .55, 5); const t2 = [b[0] + (rnd() - .5) * .14, b[1] - .05, b[2] + (rnd() - .5) * .14]; k.pipe('copper', b, t2, r * .4, 4); }
}
