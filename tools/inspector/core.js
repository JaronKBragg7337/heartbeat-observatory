/* ============================================================================
   tools/inspector/core.js — world-agnostic geometry for the building inspector
   ---------------------------------------------------------------------------
   Everything here works on a plain TRIANGLE SOUP: Float64Array of 9 numbers
   per triangle (world space, metres, y up) plus one tag per triangle. Each
   world gets an adapter (ashgrove.js, threejs.js) that turns its own scene
   into that soup; the measurements below never know which world they're in.

   Rays are axis-aligned on purpose. Every world on the site builds on a
   90-degree grid, so six ray directions cover every wall, roof and floor,
   and axis-aligned rays let us bucket triangles into a 2D grid and test only
   the handful under each ray — 49 buildings x ~40k rays run in seconds.
   ========================================================================== */
"use strict";

const EPS = 1e-9;

/* ---- triangle soup -------------------------------------------------------- */
class Soup {
  constructor() { this.v = []; this.tag = []; }
  add(a, b, c, tag) {
    // skip zero-area triangles (tri() is emitted as a quad with c === d)
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nx * nx + ny * ny + nz * nz < 1e-12) return;
    this.v.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    this.tag.push(tag);
  }
  get count() { return this.tag.length; }
  filter(pred) {
    const s = new Soup();
    for (let i = 0; i < this.tag.length; i++) {
      if (!pred(this.tag[i], i)) continue;
      for (let k = 0; k < 9; k++) s.v.push(this.v[i * 9 + k]);
      s.tag.push(this.tag[i]);
    }
    return s;
  }
  bounds() {
    const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (let i = 0; i < this.v.length; i += 3)
      for (let k = 0; k < 3; k++) { b[k] = Math.min(b[k], this.v[i + k]); b[k + 3] = Math.max(b[k + 3], this.v[i + k]); }
    return b;
  }
}

/* ---- axis-aligned ray caster ---------------------------------------------
   axis = 0 (x), 1 (y), 2 (z). The other two coordinates (u, w) index a 2D
   bucket grid of triangle bounding boxes.                                   */
const PERP = [[1, 2], [0, 2], [0, 1]];
class AxisCaster {
  constructor(soup, axis, cell) {
    this.s = soup; this.axis = axis; this.cell = cell || 0.5;
    const [pu, pw] = PERP[axis];
    this.pu = pu; this.pw = pw;
    this.map = new Map();
    const v = soup.v, c = this.cell;
    for (let t = 0; t < soup.count; t++) {
      const o = t * 9;
      const u0 = Math.min(v[o + pu], v[o + 3 + pu], v[o + 6 + pu]), u1 = Math.max(v[o + pu], v[o + 3 + pu], v[o + 6 + pu]);
      const w0 = Math.min(v[o + pw], v[o + 3 + pw], v[o + 6 + pw]), w1 = Math.max(v[o + pw], v[o + 3 + pw], v[o + 6 + pw]);
      for (let iu = Math.floor(u0 / c); iu <= Math.floor(u1 / c); iu++)
        for (let iw = Math.floor(w0 / c); iw <= Math.floor(w1 / c); iw++) {
          const k = iu * 100003 + iw;
          let a = this.map.get(k); if (!a) this.map.set(k, (a = []));
          a.push(t);
        }
    }
  }
  /* every hit along the infinite axis line through (u, w), sorted by the
     axis coordinate: [{ at, tri, tag }] */
  hits(u, w, accept) {
    const k = Math.floor(u / this.cell) * 100003 + Math.floor(w / this.cell);
    const list = this.map.get(k);
    const out = [];
    if (!list) return out;
    const v = this.s.v, ax = this.axis, pu = this.pu, pw = this.pw;
    for (const t of list) {
      const o = t * 9;
      // 2D point-in-triangle on the (u, w) plane, then interpolate the axis coord
      const au = v[o + pu], aw = v[o + pw], bu = v[o + 3 + pu], bw = v[o + 3 + pw], cu = v[o + 6 + pu], cw = v[o + 6 + pw];
      const d = (bw - cw) * (au - cu) + (cu - bu) * (aw - cw);
      if (Math.abs(d) < EPS) continue;                    // triangle is edge-on to this ray
      const l1 = ((bw - cw) * (u - cu) + (cu - bu) * (w - cw)) / d;
      const l2 = ((cw - aw) * (u - cu) + (au - cu) * (w - cw)) / d;
      const l3 = 1 - l1 - l2;
      if (l1 < -1e-7 || l2 < -1e-7 || l3 < -1e-7) continue;
      const at = l1 * v[o + ax] + l2 * v[o + 3 + ax] + l3 * v[o + 6 + ax];
      const tag = this.s.tag[t];
      if (accept && !accept(tag)) continue;
      out.push({ at, tri: t, tag });
    }
    out.sort((a, b) => a.at - b.at);
    return out;
  }
}

/* point on axis line helpers */
function casters(soup, cell) {
  return [new AxisCaster(soup, 0, cell), new AxisCaster(soup, 1, cell), new AxisCaster(soup, 2, cell)];
}

/* ---- heightfield + pits (roof holes from above) ---------------------------
   Drop a ray from the sky on a grid; the first thing it meets is the top
   surface. A HOLE in a roof shows up as a cell much lower than the ring of
   cells around it (the ray fell through into the room or onto the ground). */
function heightfield(yCaster, x0, z0, x1, z1, step, accept) {
  const nx = Math.max(1, Math.round((x1 - x0) / step)), nz = Math.max(1, Math.round((z1 - z0) / step));
  const h = new Float64Array(nx * nz).fill(-Infinity);
  const tagAt = new Array(nx * nz).fill(null);
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < nz; j++) {
      const x = x0 + (i + 0.5) * step, z = z0 + (j + 0.5) * step;
      const hs = yCaster.hits(x, z, accept);
      if (hs.length) { h[i * nz + j] = hs[hs.length - 1].at; tagAt[i * nz + j] = hs[hs.length - 1].tag; }
    }
  return { nx, nz, h, tagAt, x0, z0, step };
}

function findPits(hf, opts) {
  const { minDrop = 1.2, ring = 3, minRoof = 2.5, maxPitCells = 64 } = opts || {};
  const { nx, nz, h } = hf;
  const pit = new Uint8Array(nx * nz);
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < nz; j++) {
      const c = h[i * nz + j];
      // the 4 compass neighbours `ring` cells away must all be high roof
      let lowest = Infinity, ok = true;
      for (const [di, dj] of [[ring, 0], [-ring, 0], [0, ring], [0, -ring]]) {
        const a = i + di, b = j + dj;
        if (a < 0 || b < 0 || a >= nx || b >= nz) { ok = false; break; }
        lowest = Math.min(lowest, h[a * nz + b]);
      }
      if (!ok || lowest < minRoof) continue;
      if (lowest - c >= minDrop) pit[i * nz + j] = 1;
    }
  // cluster
  const seen = new Uint8Array(nx * nz), clusters = [];
  for (let s = 0; s < pit.length; s++) {
    if (!pit[s] || seen[s]) continue;
    const q = [s]; seen[s] = 1; const cells = [];
    while (q.length) {
      const k = q.pop(); cells.push(k);
      const i = (k / nz) | 0, j = k % nz;
      for (const [a, b] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) {
        if (a < 0 || b < 0 || a >= nx || b >= nz) continue;
        const kk = a * nz + b;
        if (pit[kk] && !seen[kk]) { seen[kk] = 1; q.push(kk); }
      }
    }
    if (cells.length > maxPitCells) continue;     // that big is a courtyard or a street, not a hole
    let sx = 0, sz = 0, hy = Infinity;
    for (const k of cells) { sx += hf.x0 + (((k / nz) | 0) + 0.5) * hf.step; sz += hf.z0 + ((k % nz) + 0.5) * hf.step; hy = Math.min(hy, h[k]); }
    clusters.push({ x: +(sx / cells.length).toFixed(2), z: +(sz / cells.length).toFixed(2), areaM2: +(cells.length * hf.step * hf.step).toFixed(2), floorY: +hy.toFixed(2) });
  }
  return clusters;
}

/* ---- simple 2D clustering of flagged sample points ------------------------ */
function cluster(points, link) {
  const out = [], used = new Array(points.length).fill(false);
  for (let i = 0; i < points.length; i++) {
    if (used[i]) continue;
    const grp = [points[i]]; used[i] = true;
    for (let g = 0; g < grp.length; g++)
      for (let j = 0; j < points.length; j++) {
        if (used[j]) continue;
        const a = grp[g], b = points[j];
        if (Math.abs(a[0] - b[0]) <= link && Math.abs(a[1] - b[1]) <= link && Math.abs(a[2] - b[2]) <= link) { used[j] = true; grp.push(b); }
      }
    out.push(grp);
  }
  return out;
}

function boxOverlap(a, b, pad) {
  pad = pad || 0;
  return a.x0 < b.x1 - pad && a.x1 > b.x0 + pad && a.z0 < b.z1 - pad && a.z1 > b.z0 + pad &&
         (a.y0 === undefined || b.y0 === undefined || (a.y0 < b.y1 - pad && a.y1 > b.y0 + pad));
}

module.exports = { Soup, AxisCaster, casters, heightfield, findPits, cluster, boxOverlap };
