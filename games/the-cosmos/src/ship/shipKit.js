// ============================================================================
// shipKit.js — a builder that turns primitives into few, large meshes.
//
// OWNS: accumulating boxes, chamfered boxes, cylinders, domes, lathes and quads
//       into one buffer per material, then emitting one Mesh per material.
// DOES NOT OWN: what the primitives are for (shipInterior.js, shipProps.js,
//       shipExterior.js) or which materials exist (shipTextures.js).
//
// WHY MERGE
// ---------
// A phone can draw a few hundred triangles-per-millisecond but only a hundred
// or so draw calls per frame. A room with 60 fittings as 60 meshes is 60 calls;
// as one mesh per material it is six. Everything here writes into per-material
// buffers, so the cost of adding a rivet is a few floats, not a draw call.
//
// UVs ARE IN METRES. A texture tile is `tile` metres across, and a vertex's UV
// is its position along that face divided by it. So a panel seam is the same
// size on a 30 cm box and a 30 m wall, and nothing needs hand-unwrapping.
//
// A LOCAL TRANSFORM (translate + rotate about Y) can be pushed so a piece of
// furniture is written in its own coordinates and placed anywhere.
// ============================================================================

import * as THREE from 'three';

// ---------------------------------------------------------------------------
// MATERIAL ALIASES. Forty named finishes would be forty draw calls per room.
// Most of them differ only in colour, so they share ONE material and carry
// their colour in the vertex data: 'steel', 'steelDark' and 'gunmetal' are the
// same metal tinted three ways; every glowing thing is one unlit material with
// the light colour baked into its vertices. A room is then ~8 draw calls.
// ---------------------------------------------------------------------------
const M = (key, r, g, b) => ({ key, col: [r, g, b] });
export const ALIAS = {
  steel: M('metal', 0.72, 0.75, 0.78), steelDark: M('metal', 0.42, 0.45, 0.49), gunmetal: M('metal', 0.24, 0.26, 0.29),
  copper: M('metal', 0.72, 0.46, 0.24), engine: M('metal', 0.2, 0.22, 0.24),
  pipeSteel: M('metal', 0.6, 0.63, 0.66), pipeRed: M('metal', 0.66, 0.2, 0.16), pipeBlue: M('metal', 0.17, 0.37, 0.62),
  pipeYellow: M('metal', 0.84, 0.65, 0.15),
  plastic: M('paint', 0.84, 0.86, 0.84), plasticDark: M('paint', 0.17, 0.19, 0.22), white: M('paint', 0.92, 0.93, 0.93),
  rubber: M('paint', 0.1, 0.11, 0.12), hazard: M('paint', 0.92, 0.7, 0.16), red: M('paint', 0.72, 0.22, 0.17),
  counter: M('paint', 0.17, 0.2, 0.22), tile: M('paint', 0.88, 0.91, 0.9), wood: M('paint', 0.55, 0.42, 0.28),
  crateA: M('paint', 0.42, 0.49, 0.41), crateB: M('paint', 0.55, 0.48, 0.32), crateC: M('paint', 0.35, 0.44, 0.53),
  fabricBlue: M('fabric', 0.6, 0.8, 1.15), fabricGrey: M('fabric', 1, 1, 1), leather: M('fabric', 1.1, 0.7, 0.5),
  mattress: M('fabric', 1.6, 1.5, 1.3), blanket: M('fabric', 1.4, 0.55, 0.45),
  glowWhite: M('glow', 1.25, 1.2, 1.1), glowCool: M('glow', 1.1, 1.2, 1.3), glowAmber: M('glow', 1.3, 0.75, 0.3),
  glowCyan: M('glow', 0.35, 1.0, 1.25), glowRed: M('glow', 1.3, 0.28, 0.22), glowGreen: M('glow', 0.3, 1.2, 0.5),
  glowBlue: M('glow', 0.3, 0.66, 1.3),
  glassTint: M('glassTint', 1, 1, 1),
};

export class Kit {
  constructor() {
    this.buckets = new Map();
    this.stack = [];
    this.t = { c: 1, s: 0, x: 0, y: 0, z: 0 };
    this.tiles = {};                       // per material tile size, metres
    this.triangles = 0;
    this.defaultTile = 1;
  }

  // ---- transform -------------------------------------------------------------
  push(x, y, z, rotY = 0) {
    const o = this.t;
    this.stack.push(o);
    const [tx, ty, tz] = this._tp(x, y, z);
    const ang = Math.atan2(o.s, o.c) + rotY;
    this.t = { c: Math.cos(ang), s: Math.sin(ang), x: tx, y: ty, z: tz };
    return this;
  }
  pop() { this.t = this.stack.pop(); return this; }

  _tp(x, y, z) {
    const t = this.t;
    // rotation about Y: x' = c x + s z ; z' = -s x + c z
    return [t.c * x + t.s * z + t.x, y + t.y, -t.s * x + t.c * z + t.z];
  }

  _bucket(key) {
    if (key === undefined) throw new Error("Kit: undefined material key");
    let b = this.buckets.get(key);
    if (!b) { b = { pos: [], nrm: [], uv: [], col: [], idx: [] }; this.buckets.set(key, b); }
    return b;
  }

  tileOf(key) { return this.tiles[key] ?? this.defaultTile; }

  /** Resolve a finish name to (real material key, vertex colour). */
  _al(key, col) {
    const a = ALIAS[key];
    if (!a) return [key, col];
    const c = col ? [col[0] * a.col[0], col[1] * a.col[1], col[2] * a.col[2]] : a.col;
    return [a.key, c];
  }

  // ---- polygons ----------------------------------------------------------------
  /**
   * A flat convex polygon in the CURRENT local frame. pts = [[x,y,z],...] (3+).
   * Wound counter-clockwise seen from the front. uvs optional; else projected.
   * col: [r,g,b] multiplier.
   */
  poly(key, pts, uvs, col) {
    [key, col] = this._al(key, col);
    const b = this._bucket(key);
    const tileKey = key;
    const P = pts.map((p) => this._tp(p[0], p[1], p[2]));
    // flat normal
    const ax = P[1][0] - P[0][0], ay = P[1][1] - P[0][1], az = P[1][2] - P[0][2];
    const bx = P[2][0] - P[0][0], by = P[2][1] - P[0][1], bz = P[2][2] - P[0][2];
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
    const tile = this.tileOf(tileKey);
    const base = b.pos.length / 3;
    const ax2 = Math.abs(nx), ay2 = Math.abs(ny), az2 = Math.abs(nz);
    for (let i = 0; i < P.length; i++) {
      const p = P[i];
      b.pos.push(p[0], p[1], p[2]);
      b.nrm.push(nx, ny, nz);
      if (uvs) b.uv.push(uvs[i][0], uvs[i][1]);
      else if (ax2 >= ay2 && ax2 >= az2) b.uv.push(p[2] / tile, p[1] / tile);
      else if (ay2 >= az2) b.uv.push(p[0] / tile, p[2] / tile);
      else b.uv.push(p[0] / tile, p[1] / tile);
      if (col) b.col.push(col[0], col[1], col[2]); else b.col.push(1, 1, 1);
    }
    for (let i = 1; i < P.length - 1; i++) b.idx.push(base, base + i, base + i + 1);
    this.triangles += P.length - 2;
  }

  /** Vertical wall piece from (ax,az) to (bx,bz), y0..y1. Faces to the LEFT of a->b. */
  wall(key, ax, az, bx, bz, y0, y1, uv, col) {
    // Left of a->b when looking down -Y: normal = (dz, 0, -dx) ... build pts so cross gives that.
    // pts: (a,y0), (b,y0), (b,y1), (a,y1)
    this.poly(key, [[ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az]], uv, col);
  }

  /** Axis-aligned box centred at (cx,cy,cz). opts: { skip: [faces], col, uv: fn } */
  box(key, cx, cy, cz, w, h, d, o = {}) {
    const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2, z0 = cz - d / 2, z1 = cz + d / 2;
    this.boxMM(key, x0, y0, z0, x1, y1, z1, o);
  }
  boxMM(key, x0, y0, z0, x1, y1, z1, o = {}) {
    const skip = o.skip || '';
    const col = o.col;
    if (!skip.includes('+x')) this.poly(key, [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], null, col);
    if (!skip.includes('-x')) this.poly(key, [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], null, col);
    if (!skip.includes('+y')) this.poly(key, [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], null, col);
    if (!skip.includes('-y')) this.poly(key, [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], null, col);
    if (!skip.includes('+z')) this.poly(key, [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], null, col);
    if (!skip.includes('-z')) this.poly(key, [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], null, col);
  }

  /**
   * A box with its 12 edges chamfered by c. 26 faces instead of 6 - enough to
   * catch a highlight on every corner, which is what makes a box stop reading
   * as a box.
   */
  bevelBox(key, cx, cy, cz, w, h, d, c = 0.03, o = {}) {
    const hx = w / 2, hy = h / 2, hz = d / 2;
    c = Math.min(c, hx * 0.9, hy * 0.9, hz * 0.9);
    const col = o.col;
    const sg = [-1, 1];
    // face insets
    const face = (ax) => {
      // returns for a face on axis ax (0=x,1=y,2=z) and sign s the 4 inset corners
    };
    const P = (x, y, z) => [cx + x, cy + y, cz + z];
    // 6 faces
    for (const s of sg) {
      // X faces
      this._faceQuad(key, [P(s * hx, -(hy - c), -(hz - c)), P(s * hx, (hy - c), -(hz - c)), P(s * hx, (hy - c), (hz - c)), P(s * hx, -(hy - c), (hz - c))], [s, 0, 0], col);
      // Y faces
      this._faceQuad(key, [P(-(hx - c), s * hy, -(hz - c)), P((hx - c), s * hy, -(hz - c)), P((hx - c), s * hy, (hz - c)), P(-(hx - c), s * hy, (hz - c))], [0, s, 0], col);
      // Z faces
      this._faceQuad(key, [P(-(hx - c), -(hy - c), s * hz), P((hx - c), -(hy - c), s * hz), P((hx - c), (hy - c), s * hz), P(-(hx - c), (hy - c), s * hz)], [0, 0, s], col);
    }
    // 12 edge strips
    for (const sx of sg) for (const sy of sg) {          // edges parallel to Z
      this._faceQuad(key, [P(sx * hx, sy * (hy - c), -(hz - c)), P(sx * (hx - c), sy * hy, -(hz - c)), P(sx * (hx - c), sy * hy, (hz - c)), P(sx * hx, sy * (hy - c), (hz - c))], [sx, sy, 0], col);
    }
    for (const sx of sg) for (const sz of sg) {          // parallel to Y
      this._faceQuad(key, [P(sx * hx, -(hy - c), sz * (hz - c)), P(sx * (hx - c), -(hy - c), sz * hz), P(sx * (hx - c), (hy - c), sz * hz), P(sx * hx, (hy - c), sz * (hz - c))], [sx, 0, sz], col);
    }
    for (const sy of sg) for (const sz of sg) {          // parallel to X
      this._faceQuad(key, [P(-(hx - c), sy * hy, sz * (hz - c)), P(-(hx - c), sy * (hy - c), sz * hz), P((hx - c), sy * (hy - c), sz * hz), P((hx - c), sy * hy, sz * (hz - c))], [0, sy, sz], col);
    }
    // 8 corner triangles
    for (const sx of sg) for (const sy of sg) for (const sz of sg) {
      this._faceQuad(key, [P(sx * hx, sy * (hy - c), sz * (hz - c)), P(sx * (hx - c), sy * hy, sz * (hz - c)), P(sx * (hx - c), sy * (hy - c), sz * hz)], [sx, sy, sz], col);
    }
  }

  /** Same, with explicit UVs (they are reversed with the winding). */
  _faceQuadUV(key, pts, outward, uvs) {
    const a = pts[0], b = pts[1], c = pts[2];
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const dot = nx * outward[0] + ny * outward[1] + nz * outward[2];
    if (dot >= 0) this.poly(key, pts, uvs);
    else this.poly(key, pts.slice().reverse(), uvs ? uvs.slice().reverse() : null);
  }

  /** A polygon whose winding is corrected so its normal faces `outward`. */
  _faceQuad(key, pts, outward, col) {
    // compute the normal of the given winding
    const a = pts[0], b = pts[1], c = pts[2];
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const dot = nx * outward[0] + ny * outward[1] + nz * outward[2];
    this.poly(key, dot >= 0 ? pts : pts.slice().reverse(), null, col);
  }

  /**
   * A slab with a bevelled top edge: a polygon in plan (x,z), CCW seen from ABOVE,
   * standing from y0 to y1. The top polygon is pulled in by `inset` and the last
   * `bevel` metres of height slope to meet it, so a wing or a plate catches light
   * on its edge instead of ending in a razor-flat square.
   */
  prism(key, plan, y0, y1, inset = 0.12, bevel = 0.12, col) {
    // orient the plan so its shoelace area is positive (outward normals are then right)
    let area = 0;
    for (let i = 0; i < plan.length; i++) { const a = plan[i], b = plan[(i + 1) % plan.length]; area += a[0] * b[1] - b[0] * a[1]; }
    if (area < 0) plan = plan.slice().reverse();
    const n = plan.length;
    const yb = Math.max(y0, y1 - bevel);
    // centroid, for pulling the top face in
    let cx = 0, cz = 0;
    for (const p of plan) { cx += p[0]; cz += p[1]; }
    cx /= n; cz /= n;
    const top = plan.map((p) => {
      const dx = p[0] - cx, dz = p[1] - cz, l = Math.hypot(dx, dz) || 1;
      const k = Math.max(0, l - inset) / l;
      return [cx + dx * k, cz + dz * k];
    });
    // bottom cap (faces down) and top cap (faces up)
    this._faceQuadUV(key, plan.map((p) => [p[0], y0, p[1]]), [0, -1, 0], null);
    this._faceQuadUV(key, top.map((p) => [p[0], y1, p[1]]), [0, 1, 0], null);
    for (let i = 0; i < n; i++) {
      const a = plan[i], b = plan[(i + 1) % n], ta = top[i], tb = top[(i + 1) % n];
      // outward normal of this edge in plan: for a CCW polygon seen from above it is (dz, -dx)
      const ex = b[0] - a[0], ez = b[1] - a[1];
      const nl = Math.hypot(ex, ez) || 1;
      const nx = ez / nl, nz = -ex / nl;
      if (yb > y0 + 1e-4) this._faceQuadUV(key, [[a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], yb, b[1]], [a[0], yb, a[1]]], [nx, 0, nz], null);
      this._faceQuadUV(key, [[a[0], yb, a[1]], [b[0], yb, b[1]], [tb[0], y1, tb[1]], [ta[0], y1, ta[1]]], [nx, 0.7, nz], null);
    }
  }

  /**
   * A soft cushion: a superellipsoid, i.e. a box whose corners have been rounded
   * smoothly rather than chamfered. n = 2 is an ellipsoid, n = 6 is nearly a box.
   * Used for seat pans, backs, pillows and mattresses.
   */
  pillow(key, cx, cy, cz, w, h, d, n = 3.2, seg = 14, o = {}) {
    let col;
    [key, col] = this._al(key, o.col);
    const b = this._bucket(key);
    const base = b.pos.length / 3;
    const e = 2 / n;
    const sgn = (v) => (v < 0 ? -1 : 1);
    const C = (u, ex) => sgn(Math.cos(u)) * Math.pow(Math.abs(Math.cos(u)), ex);
    const S = (u, ex) => sgn(Math.sin(u)) * Math.pow(Math.abs(Math.sin(u)), ex);
    const a = w / 2, bb = h / 2, c = d / 2;
    const tile = this.tileOf(key);
    const nth = Math.max(6, Math.round(seg * 0.7)), nph = seg * 2;
    for (let j = 0; j <= nth; j++) {
      const th = -Math.PI / 2 + (j / nth) * Math.PI;
      for (let i = 0; i <= nph; i++) {
        const ph = -Math.PI + (i / nph) * Math.PI * 2;
        const x = a * C(th, e) * C(ph, e), y = bb * S(th, e), z = c * C(th, e) * S(ph, e);
        const p = this._tp(cx + x, cy + y, cz + z);
        b.pos.push(p[0], p[1], p[2]);
        let nx = C(th, 2 - e) * C(ph, 2 - e) / a, ny = S(th, 2 - e) / bb, nz = C(th, 2 - e) * S(ph, 2 - e) / c;
        const nl = Math.hypot(nx, ny, nz) || 1;
        const q = this._tn(nx / nl, ny / nl, nz / nl);
        b.nrm.push(q[0], q[1], q[2]);
        b.uv.push((cx + x) / tile, (cz + z + y) / tile);
        if (col) b.col.push(col[0], col[1], col[2]); else b.col.push(1, 1, 1);
      }
    }
    for (let j = 0; j < nth; j++) for (let i = 0; i < nph; i++) {
      const p0 = base + j * (nph + 1) + i, p1 = p0 + 1, p2 = p0 + nph + 1, p3 = p2 + 1;
      // winding: theta runs up, phi runs round (x -> z): (p0, p1, p2) faces outward for this parameterisation
      b.idx.push(p0, p2, p1, p1, p2, p3);
    }
    this.triangles += nth * nph * 2;
  }

  // ---- round things --------------------------------------------------------------
  /**
   * Cylinder or cone frustum along an axis. Smooth normals.
   * o: { axis:'y'|'x'|'z', r2 (top radius), capTop, capBottom, col, uvTile, open }
   */
  cyl(key, cx, cy, cz, r, h, seg = 12, o = {}) {
    const axis = o.axis || 'y';
    const r2 = o.r2 ?? r;
    const origKey = key, userCol = o.col;
    let col;
    [key, col] = this._al(key, o.col);
    const tile = o.uvTile || this.tileOf(key);
    const mapP = (u, v, w) => {                 // u,v across, w along the axis
      if (axis === 'y') return [cx + u, cy + w, cz + v];
      if (axis === 'x') return [cx + w, cy + u, cz + v];
      return [cx + u, cy + v, cz + w];
    };
    const b = this._bucket(key);
    const slope = (r - r2) / h;
    const base = b.pos.length / 3;
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      for (let k = 0; k < 2; k++) {
        const rr = k === 0 ? r : r2;
        const w = k === 0 ? -h / 2 : h / 2;
        const p = this._tp(...mapP(ca * rr, sa * rr, w));
        b.pos.push(p[0], p[1], p[2]);
        // normal: radial with a slope component
        let nx = ca, ny = sa, nz = slope;
        const nl = Math.hypot(nx, ny, nz);
        nx /= nl; ny /= nl; nz /= nl;
        const q = this._tn(...mapN(axis, nx, ny, nz));
        b.nrm.push(q[0], q[1], q[2]);
        b.uv.push((a * r) / tile, (w + h / 2) / tile);
        if (col) b.col.push(col[0], col[1], col[2]); else b.col.push(1, 1, 1);
      }
    }
    for (let i = 0; i < seg; i++) {
      const a0 = base + i * 2, a1 = a0 + 1, b0 = a0 + 2, b1 = a0 + 3;
      // the (u,v,w) frame is left-handed about Y, right-handed about X and Z
      if (axis === 'y') b.idx.push(a0, a1, b0, b0, a1, b1);
      else b.idx.push(a0, b0, a1, b0, b1, a1);
    }
    this.triangles += seg * 2;
    if (o.capBottom !== false && o.open !== true) this._cap(origKey, mapP, axis, r, -h / 2, seg, -1, userCol);
    if (o.capTop !== false && o.open !== true && r2 > 0.0005) this._cap(origKey, mapP, axis, r2, h / 2, seg, 1, userCol);
  }
  _tn(x, y, z) { const t = this.t; return [t.c * x + t.s * z, y, -t.s * x + t.c * z]; }
  _cap(key, mapP, axis, r, w, seg, sign, col) {
    const pts = [];
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2 * (sign > 0 ? 1 : -1);
      pts.push(mapP(Math.cos(a) * r, Math.sin(a) * r, w));
    }
    // orientation: normal must face +/- the axis
    const out = axis === 'y' ? [0, sign, 0] : axis === 'x' ? [sign, 0, 0] : [0, 0, sign];
    // pts are in the untransformed local frame here; poly() applies the transform
    const a0 = pts[0], b0 = pts[1], c0 = pts[2];
    const ux = b0[0] - a0[0], uy = b0[1] - a0[1], uz = b0[2] - a0[2];
    const vx = c0[0] - a0[0], vy = c0[1] - a0[1], vz = c0[2] - a0[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const dot = nx * out[0] + ny * out[1] + nz * out[2];
    this.poly(key, dot >= 0 ? pts : pts.slice().reverse(), null, col);
  }

  /** Cylinder between two points (local frame). */
  pipe(key, a, b, r, seg = 8, o = {}) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-6) return;
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, mz = (a[2] + b[2]) / 2;
    // Fast paths for axis-aligned runs
    const ax = Math.abs(dx) / len, ay = Math.abs(dy) / len, az = Math.abs(dz) / len;
    if (ay > 0.9999) return this.cyl(key, mx, my, mz, r, len, seg, { ...o, axis: 'y' });
    if (ax > 0.9999) return this.cyl(key, mx, my, mz, r, len, seg, { ...o, axis: 'x' });
    if (az > 0.9999) return this.cyl(key, mx, my, mz, r, len, seg, { ...o, axis: 'z' });
    // General: build in a frame with +Z along the segment
    const zAxis = new THREE.Vector3(dx, dy, dz).normalize();
    const ref = Math.abs(zAxis.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const xAxis = new THREE.Vector3().crossVectors(ref, zAxis).normalize();
    const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize();
    let pcol;
    const origKey = key;
    [key, pcol] = this._al(key, o.col);
    const bk = this._bucket(key);
    const base = bk.pos.length / 3;
    const tile = o.uvTile || this.tileOf(key);
    for (let i = 0; i <= seg; i++) {
      const ang = (i / seg) * Math.PI * 2;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const nx = xAxis.x * ca + yAxis.x * sa, ny = xAxis.y * ca + yAxis.y * sa, nz = xAxis.z * ca + yAxis.z * sa;
      for (let k = 0; k < 2; k++) {
        const t = k === 0 ? -0.5 : 0.5;
        const px = mx + zAxis.x * len * t + nx * r, py = my + zAxis.y * len * t + ny * r, pz = mz + zAxis.z * len * t + nz * r;
        const p = this._tp(px, py, pz);
        bk.pos.push(p[0], p[1], p[2]);
        const q = this._tn(nx, ny, nz);
        bk.nrm.push(q[0], q[1], q[2]);
        bk.uv.push((ang * r) / tile, (k * len) / tile);
        if (pcol) bk.col.push(pcol[0], pcol[1], pcol[2]); else bk.col.push(1, 1, 1);
      }
    }
    for (let i = 0; i < seg; i++) {
      const a0 = base + i * 2;
      bk.idx.push(a0, a0 + 2, a0 + 1, a0 + 2, a0 + 3, a0 + 1);
    }
    this.triangles += seg * 2;
  }

  /** Sphere or dome. thetaMax < PI gives a cap (open below). */
  dome(key, cx, cy, cz, r, segW = 16, segH = 8, o = {}) {
    let dcol;
    [key, dcol] = this._al(key, o.col);
    const b = this._bucket(key);
    const tMax = o.thetaMax ?? Math.PI;
    const tMin = o.thetaMin ?? 0;
    const sy = o.scaleY ?? 1;
    const flip = o.inside ? -1 : 1;
    const base = b.pos.length / 3;
    for (let j = 0; j <= segH; j++) {
      const th = tMin + (tMax - tMin) * (j / segH);
      for (let i = 0; i <= segW; i++) {
        const ph = (i / segW) * Math.PI * 2;
        const nx = Math.sin(th) * Math.cos(ph), ny = Math.cos(th), nz = Math.sin(th) * Math.sin(ph);
        const p = this._tp(cx + nx * r, cy + ny * r * sy, cz + nz * r);
        b.pos.push(p[0], p[1], p[2]);
        const q = this._tn(nx * flip, ny * flip / sy, nz * flip);
        const ql = Math.hypot(q[0], q[1], q[2]) || 1;
        b.nrm.push(q[0] / ql, q[1] / ql, q[2] / ql);
        b.uv.push((i / segW) * r * 2 / this.tileOf(key), (j / segH) * r * 2 / this.tileOf(key));
        if (dcol) b.col.push(dcol[0], dcol[1], dcol[2]); else b.col.push(1, 1, 1);
      }
    }
    for (let j = 0; j < segH; j++) for (let i = 0; i < segW; i++) {
      const a = base + j * (segW + 1) + i, bb = a + 1, c = a + segW + 1, d = c + 1;
      if (flip > 0) b.idx.push(a, bb, c, bb, d, c); else b.idx.push(a, c, bb, bb, c, d);
    }
    this.triangles += segW * segH * 2;
  }

  /**
   * Surface of revolution about a local Y axis. profile = [[radius, y], ...]
   * from bottom to top. Normals are smoothed along the profile.
   */
  lathe(key, cx, cy, cz, profile, seg = 16, o = {}) {
    let lcol;
    [key, lcol] = this._al(key, o.col);
    const zAxis = o.axis === 'z';
    const b = this._bucket(key);
    const base = b.pos.length / 3;
    const n = profile.length;
    // profile normals (2D), pointing away from the axis
    const pn = [];
    for (let k = 0; k < n; k++) {
      const p0 = profile[Math.max(0, k - 1)], p1 = profile[Math.min(n - 1, k + 1)];
      const tx = p1[0] - p0[0], ty = p1[1] - p0[1];
      const l = Math.hypot(tx, ty) || 1;
      pn.push([ty / l, -tx / l]);
    }
    const tile = this.tileOf(key);
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      let acc = 0;
      for (let k = 0; k < n; k++) {
        if (k > 0) acc += Math.hypot(profile[k][0] - profile[k - 1][0], profile[k][1] - profile[k - 1][1]);
        // 'y' axis: revolve about Y, profile y is height. 'z' axis: revolve about Z, profile y runs along Z.
        const P = zAxis ? [cx + ca * profile[k][0], cy + sa * profile[k][0], cz + profile[k][1]]
                        : [cx + ca * profile[k][0], cy + profile[k][1], cz + sa * profile[k][0]];
        const p = this._tp(P[0], P[1], P[2]);
        b.pos.push(p[0], p[1], p[2]);
        const N = zAxis ? [ca * pn[k][0], sa * pn[k][0], pn[k][1]] : [ca * pn[k][0], pn[k][1], sa * pn[k][0]];
        const q = this._tn(N[0], N[1], N[2]);
        b.nrm.push(q[0], q[1], q[2]);
        b.uv.push((a * profile[k][0]) / tile, acc / tile);
        if (lcol) b.col.push(lcol[0], lcol[1], lcol[2]); else b.col.push(1, 1, 1);
      }
    }
    // winding: revolving about Y is left-handed relative to the profile, about Z it is right-handed
    const flip = (!!o.inward) !== zAxis;
    for (let i = 0; i < seg; i++) for (let k = 0; k < n - 1; k++) {
      const a = base + i * n + k, bb = a + 1, c = a + n, d = c + 1;
      if (flip) b.idx.push(a, c, bb, bb, c, d); else b.idx.push(a, bb, c, bb, d, c);
    }
    this.triangles += seg * (n - 1) * 2;
  }

  // ---- output --------------------------------------------------------------------
  /**
   * Emit one mesh per material.
   * @param materials  map key -> Material
   * @param opts { cast, receive, name }
   */
  toGroup(materials, opts = {}) {
    const g = new THREE.Group();
    g.name = opts.name || 'kit';
    for (const [key, b] of this.buckets) {
      if (!b.idx.length) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(b.nrm, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
      const big = b.pos.length / 3 > 65535;
      geo.setIndex(big ? new THREE.Uint32BufferAttribute(b.idx, 1) : new THREE.Uint16BufferAttribute(b.idx, 1));
      geo.computeBoundingSphere(); geo.computeBoundingBox();
      const mat = materials[key];
      if (!mat) throw new Error(`Kit: no material for key "${key}"`);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = `${g.name}:${key}`;
      mesh.castShadow = !!opts.cast; mesh.receiveShadow = !!opts.receive;
      g.add(mesh);
    }
    return g;
  }
}

function mapN(axis, nx, ny, nz) {
  if (axis === 'y') return [nx, nz, ny];
  if (axis === 'x') return [nz, nx, ny];
  return [nx, ny, nz];
}
