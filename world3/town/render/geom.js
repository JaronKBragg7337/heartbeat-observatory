/* ============================================================================
   geom.js — mesh builder
   Primary → secondary → tertiary forms are all authored through this.
   Everything is emitted in local space through a yaw+translate transform
   stack, so buildings are authored at the origin and stamped onto lots.

   UVs are derived from WORLD POSITION divided by the material's `world`
   size, so texel density is identical on every surface in the town by
   construction — no manual UV work, nothing to drift.
   ========================================================================== */
(function () {
"use strict";
const T = window.TOWN;

const WHITE = [1, 1, 1];

function Builder() {
  this.buckets = new Map();
  this.assets = [];            // { id, type, box:[minx,miny,minz,maxx,maxy,maxz] }
  this._cur = null;
  this._xf = { a: 0, c: 1, s: 0, x: 0, y: 0, z: 0 };
  this._stack = [];
  this.tris = 0;
}
T.Builder = Builder;

/* ------------------------------------------------------------ transform -- */
Builder.prototype.push = function (x, y, z, yaw) {
  yaw = yaw || 0;
  const p = this._xf;
  // child translation expressed in parent space
  const cx = p.c * x + p.s * z + p.x;
  const cz = -p.s * x + p.c * z + p.z;
  this._stack.push(p);
  const a = p.a + yaw;
  this._xf = { a, c: Math.cos(a), s: Math.sin(a), x: cx, y: p.y + y, z: cz };
  return this;
};
Builder.prototype.pop = function () { this._xf = this._stack.pop(); return this; };

Builder.prototype._tp = function (x, y, z, out) {
  const t = this._xf;
  out[0] = t.c * x + t.s * z + t.x;
  out[1] = y + t.y;
  out[2] = -t.s * x + t.c * z + t.z;
  return out;
};
Builder.prototype._tn = function (x, y, z, out) {
  const t = this._xf;
  out[0] = t.c * x + t.s * z; out[1] = y; out[2] = -t.s * x + t.c * z;
  return out;
};
/* world position of a local point — used to place colliders / surfaces */
Builder.prototype.world = function (x, y, z) { return this._tp(x, y, z, [0, 0, 0]); };
Builder.prototype.yaw = function () { return this._xf.a; };

/* ----------------------------------------------------------- asset ids --- */
Builder.prototype.id = function (id, type) {
  this._cur = { id, type: type || "part", box: [1e9, 1e9, 1e9, -1e9, -1e9, -1e9] };
  this.assets.push(this._cur);
  return this;
};
Builder.prototype.endId = function () { this._cur = null; return this; };

/* -------------------------------------------------------------- emit ----- */
Builder.prototype._bucket = function (mat) {
  let b = this.buckets.get(mat.name);
  if (!b) { b = { mat, pos: [], nor: [], uv: [], col: [], idx: [] }; this.buckets.set(mat.name, b); }
  return b;
};

const _p = [0, 0, 0], _n = [0, 0, 0];

/* quad from four LOCAL points, CCW when viewed from the front */
Builder.prototype.quad = function (a, b, c, d, mat, o) {
  o = o || {};
  const bk = this._bucket(mat);
  const base = bk.pos.length / 3;
  // face normal from the local points, then rotate
  let ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  let vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const nl = Math.hypot(nx, ny, nz) || 1;
  /* a collapsed polygon has no area and therefore no normal — count them,
     they're always a typo in the vertex list */
  if (nl < 1e-7) this.degenerate = (this.degenerate || 0) + 1;
  nx /= nl; ny /= nl; nz /= nl;
  this._tn(nx, ny, nz, _n);
  const wn = [_n[0], _n[1], _n[2]];

  const tint = o.tint || WHITE;
  const uvS = 1 / (mat.world * (o.uvScale || 1));
  const uo = o.uvOff ? o.uvOff[0] : 0, vo = o.uvOff ? o.uvOff[1] : 0;
  const ax = Math.abs(wn[0]), ay = Math.abs(wn[1]), az = Math.abs(wn[2]);
  const axis = ay > ax && ay > az ? 1 : ax > az ? 0 : 2;
  const pts = [a, b, c, d];
  const aoBase = o.ao === undefined ? 1 : o.ao;

  for (let i = 0; i < 4; i++) {
    this._tp(pts[i][0], pts[i][1], pts[i][2], _p);
    const wx = _p[0], wy = _p[1], wz = _p[2];
    let u, v;
    if (o.uv) { u = o.uv[i * 2]; v = o.uv[i * 2 + 1]; }
    else if (axis === 1) { u = wx * uvS + uo; v = wz * uvS + vo; }
    else if (axis === 0) { u = wz * uvS + uo; v = wy * uvS + vo; }
    else { u = wx * uvS + uo; v = wy * uvS + vo; }
    let ao = aoBase;
    if (o.grime !== undefined) {   // dirt accumulation: darken toward the base
      const h = wy - (o.grimeY || 0);
      ao *= 1 - o.grime * (1 - T.clamp(h / 0.7, 0, 1));
    }
    if (o.aoCorners) ao *= o.aoCorners[i];
    bk.pos.push(wx, wy, wz);
    bk.nor.push(wn[0], wn[1], wn[2]);
    bk.uv.push(u, v);
    bk.col.push(tint[0], tint[1], tint[2], ao);
    if (this._cur) {
      const bx = this._cur.box;
      if (wx < bx[0]) bx[0] = wx; if (wy < bx[1]) bx[1] = wy; if (wz < bx[2]) bx[2] = wz;
      if (wx > bx[3]) bx[3] = wx; if (wy > bx[4]) bx[4] = wy; if (wz > bx[5]) bx[5] = wz;
    }
  }
  bk.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  this.tris += 2;
  if (o.twoSided) bk.idx.push(base, base + 2, base + 1, base, base + 3, base + 2), this.tris += 2;
  return this;
};

Builder.prototype.tri = function (a, b, c, mat, o) { return this.quad(a, b, c, c, mat, o); };

/* ---------------------------------------------------------------- box ----
   x,y,z = min corner; w,h,d = sizes. opts.skip = "-x+x-y+y-z+z" substrings.
   opts.bevel = chamfer in metres (0 = hard edge).                          */
const FACE_KEYS = ["-x", "+x", "-y", "+y", "-z", "+z"];
Builder.prototype.box = function (x, y, z, w, h, d, mat, o) {
  o = o || {};
  /* bevels are a quality dial: 44 tris vs 12. Phones get the hard edge. */
  if (o.bevel && T.Q.bevel && Math.max(w, h, d) > T.Q.bevelMin) return this.bevelBox(x, y, z, w, h, d, mat, o);
  const x1 = x + w, y1 = y + h, z1 = z + d, skip = o.skip || "";
  if (!skip.includes("-z")) this.quad([x, y, z], [x, y1, z], [x1, y1, z], [x1, y, z], mat, o);
  if (!skip.includes("+z")) this.quad([x1, y, z1], [x1, y1, z1], [x, y1, z1], [x, y, z1], mat, o);
  if (!skip.includes("-x")) this.quad([x, y, z1], [x, y1, z1], [x, y1, z], [x, y, z], mat, o);
  if (!skip.includes("+x")) this.quad([x1, y, z], [x1, y1, z], [x1, y1, z1], [x1, y, z1], mat, o);
  if (!skip.includes("+y")) this.quad([x, y1, z], [x, y1, z1], [x1, y1, z1], [x1, y1, z], mat, o);
  if (!skip.includes("-y")) this.quad([x, y, z1], [x, y, z], [x1, y, z], [x1, y, z1], mat, o);
  return this;
};

/* emit a polygon, flipping the winding if its normal disagrees with `dir`.
   Lets the bevel topology below be written without winding bookkeeping.   */
Builder.prototype._out = function (pts, dir, mat, o) {
  const a = pts[0], b = pts[1], d = pts[pts.length - 1];
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const flip = nx * dir[0] + ny * dir[1] + nz * dir[2] < 0;
  const p = flip ? pts.slice().reverse() : pts;
  return p.length === 3 ? this.tri(p[0], p[1], p[2], mat, o) : this.quad(p[0], p[1], p[2], p[3], mat, o);
};

/* chamfered box — 6 inset faces + 12 edge strips + 8 corner tris.
   Bevels are what make an edge catch the sun; use 3–20 mm.                 */
Builder.prototype.bevelBox = function (x, y, z, w, h, d, mat, o) {
  const c = Math.min(o.bevel, w / 2.5, h / 2.5, d / 2.5);
  const oo = Object.assign({}, o); delete oo.bevel;
  const X = [x, x + c, x + w - c, x + w];
  const Y = [y, y + c, y + h - c, y + h];
  const Z = [z, z + c, z + d - c, z + d];
  const P = (i, j, k) => [X[i], Y[j], Z[k]];

  /* six faces, inset by the chamfer */
  this._out([P(1,1,0), P(1,2,0), P(2,2,0), P(2,1,0)], [0, 0, -1], mat, oo);
  this._out([P(1,1,3), P(1,2,3), P(2,2,3), P(2,1,3)], [0, 0,  1], mat, oo);
  this._out([P(0,1,1), P(0,2,1), P(0,2,2), P(0,1,2)], [-1, 0, 0], mat, oo);
  this._out([P(3,1,1), P(3,2,1), P(3,2,2), P(3,1,2)], [ 1, 0, 0], mat, oo);
  this._out([P(1,3,1), P(1,3,2), P(2,3,2), P(2,3,1)], [0,  1, 0], mat, oo);
  this._out([P(1,0,1), P(1,0,2), P(2,0,2), P(2,0,1)], [0, -1, 0], mat, oo);

  /* twelve edge chamfers: four vertical, four along X, four along Z */
  for (const [sx, sz] of [[0,0],[1,0],[1,1],[0,1]]) {
    const xi = sx ? 3 : 0, xj = sx ? 2 : 1, zi = sz ? 3 : 0, zj = sz ? 2 : 1;
    this._out([[X[xi],Y[1],Z[zj]], [X[xi],Y[2],Z[zj]], [X[xj],Y[2],Z[zi]], [X[xj],Y[1],Z[zi]]],
              [sx ? 1 : -1, 0, sz ? 1 : -1], mat, oo);
  }
  for (const [sy, sz] of [[0,0],[1,0],[1,1],[0,1]]) {
    const yi = sy ? 3 : 0, yj = sy ? 2 : 1, zi = sz ? 3 : 0, zj = sz ? 2 : 1;
    this._out([[X[1],Y[yi],Z[zj]], [X[2],Y[yi],Z[zj]], [X[2],Y[yj],Z[zi]], [X[1],Y[yj],Z[zi]]],
              [0, sy ? 1 : -1, sz ? 1 : -1], mat, oo);
  }
  for (const [sx, sy] of [[0,0],[1,0],[1,1],[0,1]]) {
    const xi = sx ? 3 : 0, xj = sx ? 2 : 1, yi = sy ? 3 : 0, yj = sy ? 2 : 1;
    this._out([[X[xi],Y[yj],Z[1]], [X[xi],Y[yj],Z[2]], [X[xj],Y[yi],Z[2]], [X[xj],Y[yi],Z[1]]],
              [sx ? 1 : -1, sy ? 1 : -1, 0], mat, oo);
  }
  /* eight corner triangles */
  for (let i = 0; i < 8; i++) {
    const sx = i & 1, sy = (i >> 1) & 1, sz = (i >> 2) & 1;
    const dir = [sx ? 1 : -1, sy ? 1 : -1, sz ? 1 : -1];
    this._out([[X[sx?3:0], Y[sy?2:1], Z[sz?2:1]],
               [X[sx?2:1], Y[sy?3:0], Z[sz?2:1]],
               [X[sx?2:1], Y[sy?2:1], Z[sz?3:0]]], dir, mat, oo);
  }
  return this;
};

/* -------------------------------------------------------------- prism ----
   Gable end / wedge. Base rectangle in XZ, apex ridge along X at height h. */
Builder.prototype.gableEnd = function (x, y, z, w, h, mat, o) {
  const cx = x + w / 2;
  this.tri([x, y, z], [cx, y + h, z], [x + w, y, z], mat, o);
  return this;
};

/* -------------------------------------------------------------- cyl ------ */
Builder.prototype.cyl = function (cx, cy, cz, r0, r1, h, seg, mat, o) {
  o = o || {};
  seg = seg || 10;
  const cap = o.caps !== false;
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * 6.283185, a1 = ((i + 1) / seg) * 6.283185;
    const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
    this.quad([cx + c0 * r0, cy, cz + s0 * r0], [cx + c0 * r1, cy + h, cz + s0 * r1],
              [cx + c1 * r1, cy + h, cz + s1 * r1], [cx + c1 * r0, cy, cz + s1 * r0], mat, o);
    if (cap) {
      this.tri([cx, cy + h, cz], [cx + c0 * r1, cy + h, cz + s0 * r1], [cx + c1 * r1, cy + h, cz + s1 * r1], mat, o);
      this.tri([cx, cy, cz], [cx + c1 * r0, cy, cz + s1 * r0], [cx + c0 * r0, cy, cz + s0 * r0], mat, o);
    }
  }
  return this;
};
/* horizontal pipe along X or Z — gutters, downspouts, rails, handles */
Builder.prototype.pipe = function (x0, y0, z0, x1, y1, z1, r, seg, mat, o) {
  seg = seg || 6;
  let dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
  const L = Math.hypot(dx, dy, dz) || 1; dx /= L; dy /= L; dz /= L;
  // any perpendicular basis
  let ux = 0, uy = 1, uz = 0;
  if (Math.abs(dy) > 0.9) { ux = 1; uy = 0; }
  let px = uy * dz - uz * dy, py = uz * dx - ux * dz, pz = ux * dy - uy * dx;
  let l = Math.hypot(px, py, pz) || 1; px /= l; py /= l; pz /= l;
  const qx = dy * pz - dz * py, qy = dz * px - dx * pz, qz = dx * py - dy * px;
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * 6.283185, a1 = ((i + 1) / seg) * 6.283185;
    const o0 = [Math.cos(a0) * r, Math.sin(a0) * r], o1 = [Math.cos(a1) * r, Math.sin(a1) * r];
    const A = [x0 + px * o0[0] + qx * o0[1], y0 + py * o0[0] + qy * o0[1], z0 + pz * o0[0] + qz * o0[1]];
    const B = [x1 + px * o0[0] + qx * o0[1], y1 + py * o0[0] + qy * o0[1], z1 + pz * o0[0] + qz * o0[1]];
    const C = [x1 + px * o1[0] + qx * o1[1], y1 + py * o1[0] + qy * o1[1], z1 + pz * o1[0] + qz * o1[1]];
    const D = [x0 + px * o1[0] + qx * o1[1], y0 + py * o1[0] + qy * o1[1], z0 + pz * o1[0] + qz * o1[1]];
    this.quad(A, B, C, D, mat, o);
    if (o && o.caps) {
      this._out([[x0, y0, z0], A, D], [-dx, -dy, -dz], mat, o);
      this._out([[x1, y1, z1], B, C], [dx, dy, dz], mat, o);
    }
  }
  return this;
};

/* --------------------------------------------------------------- plane --- */
/* horizontal quad, normal up */
Builder.prototype.plane = function (x, z, w, d, y, mat, o) {
  return this.quad([x, y, z], [x, y, z + d], [x + w, y, z + d], [x + w, y, z], mat, o);
};

/* ======================================================================== */
/* TERTIARY DETAIL LIBRARY — the parts that make something read as built    */
/* ======================================================================== */
const D = (T.Detail = {});

/* butt hinge: two leaves + a knuckle barrel + pin */
D.hinge = function (b, x, y, z, dir, mat) {
  const s = 0.008;
  b.box(x - 0.045, y, z - s, 0.045, 0.100, s * 2, mat, { bevel: 0.004, tint: [.8, .8, .82] });
  b.cyl(x, y - 0.006, z, 0.014, 0.014, 0.112, 6, mat, { tint: [.85, .85, .87] });
  b.box(x, y, z - s, 0.045 * dir, 0.100, s * 2, mat, { bevel: 0.004, tint: [.8, .8, .82] });
};
/* hex bolt head + washer */
D.bolt = function (b, x, y, z, r, mat, axis) {
  const o = { tint: [.78, .78, .8] };
  if (axis === "z") { b.push(x, y, z, 0); b.cyl(0, 0, 0, r * 1.5, r * 1.5, 0.004, 6, mat, o); b.pop(); }
  b.cyl(x, y, z, r, r * 0.92, 0.012, 6, mat, o);
};
/* soffit / gable vent: louvred rectangle */
D.vent = function (b, x, y, z, w, h, mat, tint) {
  b.box(x, y, z, w, h, 0.03, mat, { tint, bevel: 0.006 });
  const n = Math.max(3, Math.round(h / 0.05));
  for (let i = 0; i < n; i++)
    b.box(x + 0.02, y + 0.02 + i * (h - 0.04) / n, z + 0.03, w - 0.04, (h - 0.04) / n * 0.55, 0.012,
          mat, { tint: [tint[0] * 0.45, tint[1] * 0.45, tint[2] * 0.45] });
};
/* lever handle + escutcheon */
D.handle = function (b, x, y, z, dir, mat) {
  b.cyl(x, y, z, 0.030, 0.030, 0.012 * dir, 8, mat, { tint: [.85, .78, .5] });
  b.push(x, y, z + 0.012 * dir, 0);
  b.box(-0.012, -0.012, 0, 0.10 * dir, 0.024, 0.024, mat, { bevel: 0.004, tint: [.88, .8, .52] });
  b.pop();
};
/* K-style gutter running along X with a bead, plus hangers */
D.gutter = function (b, x0, x1, y, z, mat, tint) {
  const w = 0.115, h = 0.095;
  b.box(x0, y, z, x1 - x0, h, 0.012, mat, { tint });                         // back
  b.box(x0, y, z + w - 0.012, x1 - x0, h * 0.8, 0.012, mat, { tint });       // front
  b.box(x0, y, z, x1 - x0, 0.012, w, mat, { tint });                         // bottom
  b.pipe(x0, y + h * 0.8, z + w - 0.006, x1, y + h * 0.8, z + w - 0.006, 0.011, 5, mat, { tint }); // bead
  for (let x = x0 + 0.4; x < x1 - 0.2; x += 1.2)                             // hangers + spikes
    b.box(x, y + h * 0.72, z, 0.02, 0.014, w, mat, { tint: [.72, .72, .74] });
};
D.downspout = function (b, x, z, yTop, yBot, mat, tint) {
  b.box(x, yBot, z, 0.075, yTop - yBot, 0.055, mat, { tint, bevel: 0.005 });
  for (let y = yBot + 0.6; y < yTop - 0.3; y += 1.5)                          // straps
    b.box(x - 0.012, y, z - 0.012, 0.099, 0.03, 0.079, mat, { tint: [.7, .7, .72] });
  b.box(x, yBot - 0.02, z + 0.055, 0.075, 0.06, 0.22, mat, { tint });         // elbow to grade
};

T.Detail = D;

/* ======================================================================== */
/* WALLS WITH OPENINGS                                                      */
/* Emits the wall as jambs + sill + header rather than boolean-subtracting  */
/* a hole, which is exactly how a real wall is framed.                      */
/* openings: [{x, w, y0, y1, kind}] measured along the run from x0.         */
/* ======================================================================== */
Builder.prototype.wallRun = function (x0, z0, len, y0, height, thick, mat, openings, o) {
  o = o || {};
  o = o || {};
  const zAxis = o.axis === "z";
  const ops = (openings || []).slice().sort((a, b) => a.x - b.x);
  const yTop = y0 + height;
  let cursor = 0;
  const put = (a, w, yy, hh) => {
    if (w < 0.001 || hh < 0.001) return;
    if (zAxis) this.box(x0, yy, z0 + a, thick, hh, w, mat, o);
    else this.box(x0 + a, yy, z0, w, hh, thick, mat, o);
  };
  /* opening y values are relative to this wall's base */
  for (const op of ops) {
    const oy0 = y0 + op.y0, oy1 = y0 + op.y1;
    put(cursor, op.x - cursor, y0, height);
    if (oy0 > y0 + 0.001) put(op.x, op.w, y0, oy0 - y0);          // sill / apron
    if (oy1 < yTop - 0.001) put(op.x, op.w, oy1, yTop - oy1);     // header
    cursor = op.x + op.w;
  }
  put(cursor, len - cursor, y0, height);
  return this;
};

/* ---------------------------------------------------------------- roofs -- */
/* Gable roof over a w × d footprint, ridge running along X.
   Returns useful numbers for hanging gutters and fascia off.               */
Builder.prototype.gableRoof = function (x, y, z, w, d, pitch, over, mat, o) {
  o = o || {};
  const rise = (d / 2) * pitch;
  const X0 = x - over, X1 = x + w + over, Z0 = z - over, Z1 = z + d + over;
  const ridgeY = y + rise + over * pitch, eaveY = y;
  const cz = z + d / 2;
  const th = 0.09;                                              // slab thickness
  // two slopes
  this.quad([X0, eaveY, Z0], [X0, ridgeY, cz], [X1, ridgeY, cz], [X1, eaveY, Z0], mat, o);
  this.quad([X1, eaveY, Z1], [X1, ridgeY, cz], [X0, ridgeY, cz], [X0, eaveY, Z1], mat, o);
  // underside (soffit colour) + rake edges so the silhouette has thickness
  const so = Object.assign({}, o, { tint: o.soffit || [.86, .85, .82], ao: 0.55 });
  this.quad([X1, eaveY - th, Z0], [X1, ridgeY - th, cz], [X0, ridgeY - th, cz], [X0, eaveY - th, Z0], T.Mats.paint, so);
  this.quad([X0, eaveY - th, Z1], [X0, ridgeY - th, cz], [X1, ridgeY - th, cz], [X1, eaveY - th, Z1], T.Mats.paint, so);
  return { ridgeY, eaveY, X0, X1, Z0, Z1, cz, rise, th };
};

/* Hip roof over w × d, ridge along X, hipped at both ends. */
Builder.prototype.hipRoof = function (x, y, z, w, d, pitch, over, mat, o) {
  o = o || {};
  const X0 = x - over, X1 = x + w + over, Z0 = z - over, Z1 = z + d + over;
  const dd = (Z1 - Z0), rise = (dd / 2) * pitch;
  const ridgeY = y + rise, cz = (Z0 + Z1) / 2;
  const inset = Math.min(dd / 2, (X1 - X0) / 2.6);
  const RX0 = X0 + inset, RX1 = X1 - inset;
  this.quad([X0, y, Z0], [RX0, ridgeY, cz], [RX1, ridgeY, cz], [X1, y, Z0], mat, o);
  this.quad([X1, y, Z1], [RX1, ridgeY, cz], [RX0, ridgeY, cz], [X0, y, Z1], mat, o);
  this.tri([X0, y, Z0], [X0, y, Z1], [RX0, ridgeY, cz], mat, o);
  this.tri([X1, y, Z1], [X1, y, Z0], [RX1, ridgeY, cz], mat, o);
  const th = 0.09;
  const so = Object.assign({}, o, { tint: [.86, .85, .82], ao: 0.55 });
  this.quad([X1, y - th, Z0], [RX1, ridgeY - th, cz], [RX0, ridgeY - th, cz], [X0, y - th, Z0], T.Mats.paint, so);
  this.quad([X0, y - th, Z1], [RX0, ridgeY - th, cz], [RX1, ridgeY - th, cz], [X1, y - th, Z1], T.Mats.paint, so);
  return { ridgeY, X0, X1, Z0, Z1, cz, rise };
};

/* Shed / mono-pitch roof sloping from -Z (low) to +Z (high). */
Builder.prototype.shedRoof = function (x, y, z, w, d, pitch, over, mat, o) {
  o = o || {};
  const X0 = x - over, X1 = x + w + over, Z0 = z - over, Z1 = z + d + over;
  const hi = y + (Z1 - Z0) * pitch;
  this.quad([X0, y, Z0], [X0, hi, Z1], [X1, hi, Z1], [X1, y, Z0], mat, o);
  const th = 0.09, so = Object.assign({}, o, { tint: [.86, .85, .82], ao: 0.55 });
  this.quad([X1, y - th, Z0], [X1, hi - th, Z1], [X0, hi - th, Z1], [X0, y - th, Z0], T.Mats.paint, so);
  return { X0, X1, Z0, Z1, hi, lo: y };
};

/* -------------------------------------------------------------- stairs --- */
/* Straight run along +Z. Registers walkable ramp + treads.                  */
Builder.prototype.stairs = function (x, y, z, w, steps, rise, run, mat, o) {
  o = o || {};
  /* closed stringer: each step is solid to the floor, then a nosing on top */
  for (let i = 0; i < steps; i++) {
    const sy = y + i * rise, sz = z + i * run;
    this.box(x, y, sz, w, sy + rise - y, run, mat, { tint: o.tint, ao: 0.86 });
    this.box(x - 0.012, sy + rise - 0.035, sz - 0.028, w + 0.024, 0.035, run + 0.028, mat,
             { tint: o.tint, bevel: 0.005, ao: 0.95 });                                        // nosing
  }
  return this;
};

/* ------------------------------------------------------------- foliage --- */
Builder.prototype.crossCards = function (cx, cy, cz, w, h, n, mat, o) {
  o = Object.assign({ twoSided: true }, o);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI, c = Math.cos(a) * w * 0.5, s = Math.sin(a) * w * 0.5;
    this.quad([cx - c, cy, cz - s], [cx - c, cy + h, cz - s], [cx + c, cy + h, cz + s], [cx + c, cy, cz + s],
      mat, Object.assign({ uv: [0, 0, 0, 1, 1, 1, 1, 0] }, o));
  }
  return this;
};

/* ---------------------------------------------------------- shadow decal - */
Builder.prototype.shadowQuad = function (cx, cz, w, d, y) {
  return this.quad([cx - w / 2, y, cz - d / 2], [cx - w / 2, y, cz + d / 2],
                   [cx + w / 2, y, cz + d / 2], [cx + w / 2, y, cz - d / 2],
                   T.Mats.shadowBlob, { uv: [0, 0, 0, 1, 1, 1, 1, 0], ao: 1 });
};

Builder.prototype.build = function () {
  return new T.Mesh(Array.from(this.buckets.values()));
};
})();
