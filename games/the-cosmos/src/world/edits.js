// ============================================================================
// edits.js — the ground is a solid object you can take pieces out of, and put
//            pieces back on, from any direction.
//
// OWNS: every change anyone makes to the planet's material field, the matter
//       accounting that keeps those changes honest, and the way spoil settles.
// DOES NOT OWN: the undisturbed geology (field.js) or how any of it is drawn
//       (excavation.js). Both read the lattice kept here.
//
// WHAT JARON ASKED FOR, IN HIS WORDS
// ----------------------------------
// "a whole solid planet that you can dig left right up down... anyway you dig it
//  just takes pieces of that dirt out."  And: dropped dirt piled into "a giant
//  pillar... like the tooth in a cave but pointed up".
//
// WHY THIS IS A LATTICE AND NOT A LIST OF SPHERES (what it replaced)
// ------------------------------------------------------------------
// The first version kept every bite as a sphere and asked the whole list at
// every field sample. That cannot draw a hole at a useful resolution (nothing
// but the sphere list knew the hole existed, so the meshes had to be taught
// about it one box at a time), cost grows with every bite ever made, and a
// dropped load could only be one more sphere stacked on the last: a pillar.
//
// Now the changed ground is a sparse lattice of signed distances, 0.1 m apart,
// stored in 3.2 m bricks that exist only where somebody touched the planet:
//
//   phi(p) < 0   solid       phi(p) > 0   open air       (same sign rule as field.js)
//
//   * One truth. density() reads these numbers; the collider, the ray caster
//     and the mesher all read them. A hole is the same hole to every one of them,
//     and its cost no longer depends on how many bites made it.
//   * Matter is exact. A lattice point holds a fraction of solid,
//         content(phi) = clamp(0.5 - phi / 0.1, 0, 1)
//     so the solid volume of the whole planet is a sum, and a dig or a drop is
//     a measured change in that sum. The lot you lift is that change, to the
//     last bit. `fieldDeltaM3()` re-adds the whole lattice and must equal the
//     ledger.
//   * Spoil settles. A dropped load is poured on whatever surface is there (a
//     lawn, the lip of a hole, an earlier pile) and takes the shape a heap of
//     loose regolith takes: a cone whose sides stand at the angle of repose.
//     The next load pours onto THAT heap, so it grows outward and never into a
//     spike. See `deposit()`.
//
// Bulking: the old model made a dumped pile 25% bigger than the hole it came
// from. A lattice cannot hold a pile whose solid fraction differs from the
// ground's without a second field, and a second field is how mass goes missing
// when the pile is dug again. So spoil is modelled at the density it came out
// at, and the ledger can balance to zero in kilograms as well as litres.
// ============================================================================

import { MATERIALS, baseDensityAt, naturalMaterialAt } from './field.js';

export const CELL_M = 0.1;                 // lattice spacing
export const BRICK_N = 32;                 // lattice cells per brick edge -> 3.2 m bricks
export const BRICK_M = CELL_M * BRICK_N;
export const REPOSE_DEG = 33;              // loose Martian regolith / basalt sand, 30-38 in the literature
export const SLOPE_MAX_DEG = 36;           // no free side of a heap stands steeper than this
export const SPOIL_APEX_ROUND_M = 0.14;    // a poured heap's tip is rounded, not a needle
const H = CELL_M, H3 = H * H * H;
const INV = 1 / CELL_M;
const FLOOR_EMBED_M = 0.25;                // a pile sinks this far into what it sits on, so nothing floats

// Exact binary accounting at lot boundaries. Every accepted lot is >1e-9 m3, so its
// double's fraction fits in 96 bits. Summing those integers keeps addition order (single
// drops, mixed materials, one combined pour) from producing phantom residual mass.
const ACCOUNT_SCALE = 2 ** 96;
const account = (v) => BigInt(v * ACCOUNT_SCALE);

const MATERIAL_LIST = Object.values(MATERIALS);
const matIndexOf = (id) => { const i = MATERIAL_LIST.findIndex((m) => m.id === id); return i < 0 ? 0 : i + 1; };
const matFromIndex = (i) => (i > 0 ? MATERIAL_LIST[i - 1] : null);

/** Solid fraction of one lattice cell around a point whose signed distance is phi. */
export const contentOf = (phi) => { const c = 0.5 - phi * INV; return c < 0 ? 0 : c > 1 ? 1 : c; };

const COARSE = 4;                           // base geology is sampled every 0.4 m and interpolated: it is smooth at that scale
const NODE_M = COARSE * CELL_M;

export class EditStore {
  constructor(body, opts = {}) {
    this.body = body;
    this.bricks = new Map();
    this.edits = [];                        // the history: every dig and every drop, in order
    this.piles = [];                        // heaps made by deposit(), newest last
    this.touched = new Map();               // key -> { bx, by, bz }  bricks whose drawn surface may differ from the geology
    this._dirty = new Set();                // keys the mesher still has to redo
    this._nodes = new Map();                // coarse base samples, shared between bricks
    this._seq = 0;
    this._anchor = null;
    this._lastBrick = null;
    this.totalRemovedM3 = 0; this.totalDepositedM3 = 0;
    this.totalRemovedKg = 0; this.totalDepositedKg = 0;
    this._removedV = 0n; this._removedM = 0n; this._depositedV = 0n; this._depositedM = 0n;
    this.lastRefusal = '';
    this.version = 0;
    this._min = { x: Infinity, y: Infinity, z: Infinity };
    this._max = { x: -Infinity, y: -Infinity, z: -Infinity };
    this.repose = (opts.reposeDeg ?? REPOSE_DEG) * Math.PI / 180;
  }

  get isEmpty() { return this.bricks.size === 0; }

  // ------------------------------------------------------------------ keys
  _pack(a, b, c) {
    if (!this._anchor) this._anchor = { a, b, c };
    const A = this._anchor, x = a - A.a + 32768, y = b - A.b + 32768, z = c - A.c + 32768;
    if (x < 0 || y < 0 || z < 0 || x > 65535 || y > 65535 || z > 65535) return `s${a},${b},${c}`;
    return (x * 65536 + y) * 65536 + z;
  }
  keyOf(bx, by, bz) { return this._pack(bx, by, bz); }
  brickAt(bx, by, bz) {
    const lb = this._lastBrick;
    if (lb && lb.bx === bx && lb.by === by && lb.bz === bz) return lb;
    const b = this.bricks.get(this._pack(bx, by, bz));
    if (b) this._lastBrick = b;
    return b || null;
  }
  /** Brick coordinates of a world point. */
  brickCoord(x, y, z) { return [Math.floor(x / BRICK_M), Math.floor(y / BRICK_M), Math.floor(z / BRICK_M)]; }

  // ------------------------------------------------------- the base geology
  _node(ci, cj, ck) {
    if (!this._nodeAnchor) this._nodeAnchor = { a: ci, b: cj, c: ck };
    const A = this._nodeAnchor, x = ci - A.a + 32768, y = cj - A.b + 32768, z = ck - A.c + 32768;
    const key = (x < 0 || y < 0 || z < 0 || x > 65535 || y > 65535 || z > 65535)
      ? `n${ci},${cj},${ck}` : (x * 65536 + y) * 65536 + z;
    let v = this._nodes.get(key);
    if (v === undefined) {
      v = baseDensityAt(this.body, ci * NODE_M, cj * NODE_M, ck * NODE_M);
      if (this._nodes.size > 400000) this._nodes.clear();
      this._nodes.set(key, v);
    }
    return v;
  }
  /** Geology at one lattice point, interpolated from the shared coarse samples. */
  baseLattice(i, j, k) {
    const ci = Math.floor(i / COARSE), cj = Math.floor(j / COARSE), ck = Math.floor(k / COARSE);
    const fx = (i - ci * COARSE) / COARSE, fy = (j - cj * COARSE) / COARSE, fz = (k - ck * COARSE) / COARSE;
    if (fx === 0 && fy === 0 && fz === 0) return this._node(ci, cj, ck);
    const n000 = this._node(ci, cj, ck), n100 = this._node(ci + 1, cj, ck);
    const n010 = this._node(ci, cj + 1, ck), n110 = this._node(ci + 1, cj + 1, ck);
    const n001 = this._node(ci, cj, ck + 1), n101 = this._node(ci + 1, cj, ck + 1);
    const n011 = this._node(ci, cj + 1, ck + 1), n111 = this._node(ci + 1, cj + 1, ck + 1);
    const x00 = n000 + (n100 - n000) * fx, x10 = n010 + (n110 - n010) * fx;
    const x01 = n001 + (n101 - n001) * fx, x11 = n011 + (n111 - n011) * fx;
    const y0 = x00 + (x10 - x00) * fy, y1 = x01 + (x11 - x01) * fy;
    return y0 + (y1 - y0) * fz;
  }

  _makeBrick(bx, by, bz) {
    const key = this._pack(bx, by, bz);
    const phi = new Float32Array(BRICK_N * BRICK_N * BRICK_N);
    const brick = { bx, by, bz, key, phi, rho: null, mat: null, baseContent: 0, edited: false };
    const i0 = bx * BRICK_N, j0 = by * BRICK_N, k0 = bz * BRICK_N;
    const S = BRICK_N / COARSE;
    // Fill one coarse cell (4x4x4 points) at a time from its eight corner samples.
    for (let ck = 0; ck < S; ck++) for (let cj = 0; cj < S; cj++) for (let ci = 0; ci < S; ci++) {
      const gi = i0 / COARSE + ci, gj = j0 / COARSE + cj, gk = k0 / COARSE + ck;
      const n000 = this._node(gi, gj, gk), n100 = this._node(gi + 1, gj, gk);
      const n010 = this._node(gi, gj + 1, gk), n110 = this._node(gi + 1, gj + 1, gk);
      const n001 = this._node(gi, gj, gk + 1), n101 = this._node(gi + 1, gj, gk + 1);
      const n011 = this._node(gi, gj + 1, gk + 1), n111 = this._node(gi + 1, gj + 1, gk + 1);
      for (let c = 0; c < COARSE; c++) {
        const fz = c / COARSE;
        for (let b = 0; b < COARSE; b++) {
          const fy = b / COARSE;
          const a00 = n000 + (n010 - n000) * fy, a10 = n100 + (n110 - n100) * fy;
          const a01 = n001 + (n011 - n001) * fy, a11 = n101 + (n111 - n101) * fy;
          const l0 = a00 + (a01 - a00) * fz, l1 = a10 + (a11 - a10) * fz;
          const row = ((ck * COARSE + c) * BRICK_N + (cj * COARSE + b)) * BRICK_N + ci * COARSE;
          for (let a = 0; a < COARSE; a++) phi[row + a] = l0 + (l1 - l0) * (a / COARSE);
        }
      }
    }
    let sum = 0;
    for (let n = 0; n < phi.length; n++) sum += contentOf(phi[n]);
    brick.baseContent = sum;
    this.bricks.set(key, brick);
    this._lastBrick = brick;
    const x0 = bx * BRICK_M, y0 = by * BRICK_M, z0 = bz * BRICK_M;
    this._min.x = Math.min(this._min.x, x0); this._min.y = Math.min(this._min.y, y0); this._min.z = Math.min(this._min.z, z0);
    this._max.x = Math.max(this._max.x, x0 + BRICK_M); this._max.y = Math.max(this._max.y, y0 + BRICK_M); this._max.z = Math.max(this._max.z, z0 + BRICK_M);
    return brick;
  }
  _ensureBrick(bx, by, bz) { return this.brickAt(bx, by, bz) || this._makeBrick(bx, by, bz); }

  /** One lattice point: stored if somebody changed this brick, geology otherwise. */
  getPoint(i, j, k) {
    const b = this.brickAt(i >> 5, j >> 5, k >> 5);
    if (b) return b.phi[(((k & 31) * BRICK_N) + (j & 31)) * BRICK_N + (i & 31)];
    return this.baseLattice(i, j, k);
  }

  // -------------------------------------------------------------- queries
  inBounds(x, y, z, margin = 0) {
    return x >= this._min.x - margin && x <= this._max.x + margin &&
           y >= this._min.y - margin && y <= this._max.y + margin &&
           z >= this._min.z - margin && z <= this._max.z + margin;
  }

  /**
   * The edited field at a point, trilinear in the lattice, or null where the
   * ground there has never been touched (the caller then asks the geology).
   */
  sample(x, y, z) {
    if (!this.inBounds(x, y, z)) return null;
    const fx = x * INV, fy = y * INV, fz = z * INV;
    const i0 = Math.floor(fx), j0 = Math.floor(fy), k0 = Math.floor(fz);
    const b = this.brickAt(i0 >> 5, j0 >> 5, k0 >> 5);
    if (!b) return null;
    const tx = fx - i0, ty = fy - j0, tz = fz - k0;
    const li = i0 & 31, lj = j0 & 31, lk = k0 & 31;
    let c000, c100, c010, c110, c001, c101, c011, c111;
    if (li < 31 && lj < 31 && lk < 31) {
      const p = b.phi, o = ((lk * BRICK_N) + lj) * BRICK_N + li, sy = BRICK_N, sz = BRICK_N * BRICK_N;
      c000 = p[o]; c100 = p[o + 1]; c010 = p[o + sy]; c110 = p[o + sy + 1];
      c001 = p[o + sz]; c101 = p[o + sz + 1]; c011 = p[o + sz + sy]; c111 = p[o + sz + sy + 1];
    } else {
      c000 = this.getPoint(i0, j0, k0); c100 = this.getPoint(i0 + 1, j0, k0);
      c010 = this.getPoint(i0, j0 + 1, k0); c110 = this.getPoint(i0 + 1, j0 + 1, k0);
      c001 = this.getPoint(i0, j0, k0 + 1); c101 = this.getPoint(i0 + 1, j0, k0 + 1);
      c011 = this.getPoint(i0, j0 + 1, k0 + 1); c111 = this.getPoint(i0 + 1, j0 + 1, k0 + 1);
    }
    const x00 = c000 + (c100 - c000) * tx, x10 = c010 + (c110 - c010) * tx;
    const x01 = c001 + (c101 - c001) * tx, x11 = c011 + (c111 - c011) * tx;
    const y0 = x00 + (x10 - x00) * ty, y1 = x01 + (x11 - x01) * ty;
    return y0 + (y1 - y0) * tz;
  }

  /** Field value at any point (stored where edited, geology elsewhere). */
  phiAt(x, y, z) {
    const v = this.sample(x, y, z);
    return v !== null ? v : baseDensityAt(this.body, x, y, z);
  }

  /** Does an edited brick stand within `margin` of this point? */
  affects(x, y, z, margin = 0) {
    if (!this.inBounds(x, y, z, margin)) return false;
    const [bx, by, bz] = this.brickCoord(x, y, z);
    if (this.touched.has(this._pack(bx, by, bz))) return true;
    if (margin <= 0) return false;
    const x0 = Math.floor((x - margin) / BRICK_M), x1 = Math.floor((x + margin) / BRICK_M);
    const y0 = Math.floor((y - margin) / BRICK_M), y1 = Math.floor((y + margin) / BRICK_M);
    const z0 = Math.floor((z - margin) / BRICK_M), z1 = Math.floor((z + margin) / BRICK_M);
    for (let a = x0; a <= x1; a++) for (let b = y0; b <= y1; b++) for (let c = z0; c <= z1; c++)
      if (this.touched.has(this._pack(a, b, c))) return true;
    return false;
  }

  /**
   * The material spoil dumped at this spot is made of, or null for natural ground.
   * Decided over the eight lattice points around the spot, weighted by how much solid each holds, so
   * a heap reads as ONE material from its crest to its foot (asking only the nearest point made a
   * chessboard of two colours wherever the surface wandered across a 0.1 m cell).
   */
  materialOverride(x, y, z) {
    if (!this.inBounds(x, y, z)) return null;
    const fx = x * INV, fy = y * INV, fz = z * INV;
    const i0 = Math.floor(fx), j0 = Math.floor(fy), k0 = Math.floor(fz);
    const tx = fx - i0, ty = fy - j0, tz = fz - k0;
    let tot = 0, ov = 0, best = 0, bestW = 0;
    const votes = this._votes || (this._votes = new Float64Array(MATERIAL_LIST.length + 1));
    votes.fill(0);
    for (let dk = 0; dk < 2; dk++) for (let dj = 0; dj < 2; dj++) for (let di = 0; di < 2; di++) {
      const i = i0 + di, j = j0 + dj, k = k0 + dk;
      const w = (di ? tx : 1 - tx) * (dj ? ty : 1 - ty) * (dk ? tz : 1 - tz);
      const b = this.brickAt(i >> 5, j >> 5, k >> 5);
      const idx = (((k & 31) * BRICK_N) + (j & 31)) * BRICK_N + (i & 31);
      const c = contentOf(b ? b.phi[idx] : this.baseLattice(i, j, k));
      if (c <= 0) continue;
      tot += w * c;
      if (b && b.mat && b.mat[idx]) { ov += w * c; votes[b.mat[idx]] += w * c; }
    }
    if (tot < 1e-9 || ov / tot <= 0.5) return null;
    for (let m = 1; m < votes.length; m++) if (votes[m] > bestW) { bestW = votes[m]; best = m; }
    return matFromIndex(best);
  }

  /** Material and density of the solid content at one lattice point. */
  _pointMaterial(b, idx, i, j, k) {
    if (b.rho && b.rho[idx] > 0) {
      const m = matFromIndex(b.mat[idx]) || MATERIALS.regolith;
      return { mat: m, rho: b.rho[idx] };
    }
    const m = naturalMaterialAt(this.body, i * H, j * H, k * H);
    return { mat: m, rho: m.densityKgM3 };
  }

  // ----------------------------------------------------------- bookkeeping
  _touch(i0, i1, j0, j1, k0, k1) {
    const bx0 = (i0 - 1) >> 5, bx1 = (i1 + 1) >> 5;
    const by0 = (j0 - 1) >> 5, by1 = (j1 + 1) >> 5;
    const bz0 = (k0 - 1) >> 5, bz1 = (k1 + 1) >> 5;
    for (let a = bx0; a <= bx1; a++) for (let b = by0; b <= by1; b++) for (let c = bz0; c <= bz1; c++) {
      const key = this._pack(a, b, c);
      if (!this.touched.has(key)) this.touched.set(key, { bx: a, by: b, bz: c });
      this._dirty.add(key);
    }
    this.version++;
  }
  /** Keys of bricks whose mesh is out of date. The mesher empties this. */
  consumeDirty() { const d = [...this._dirty]; this._dirty.clear(); return d; }
  hasDirty() { return this._dirty.size > 0; }

  // ============================================================= DIGGING
  /**
   * Take material out of a sphere, or anything with a signed distance.
   * Returns the lot that came out (a real object with a volume, a mass, a
   * composition and an origin) or null if nothing diggable was there.
   *
   * @param shape  { x, y, z, r }  a sphere, or
   *               { box:{x0,x1,y0,y1,z0,z1}, sdf:(x,y,z)=>positive inside, x,y,z }
   */
  carve(shape) {
    this.lastRefusal = '';
    const box = shape.box || { x0: shape.x - shape.r, x1: shape.x + shape.r, y0: shape.y - shape.r, y1: shape.y + shape.r, z0: shape.z - shape.r, z1: shape.z + shape.r };
    const sdf = shape.sdf || ((x, y, z) => shape.r - Math.hypot(x - shape.x, y - shape.y, z - shape.z));
    const i0 = Math.floor(box.x0 * INV) - 1, i1 = Math.ceil(box.x1 * INV) + 1;
    const j0 = Math.floor(box.y0 * INV) - 1, j1 = Math.ceil(box.y1 * INV) + 1;
    const k0 = Math.floor(box.z0 * INV) - 1, k1 = Math.ceil(box.z1 * INV) + 1;

    // Pass 1: decide, without writing, what would change and what it would yield.
    const plan = [];
    let V = 0, M = 0, protectedPoints = 0, mantlePoints = 0, airPoints = 0;
    const parts = new Map();
    for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = i * H, y = j * H, z = k * H;
      const tool = Math.fround(sdf(x, y, z));
      if (tool <= -H) continue;                                  // nowhere near the tool
      const bx = i >> 5, by = j >> 5, bz = k >> 5;
      const b = this.brickAt(bx, by, bz);
      const idx = (((k & 31) * BRICK_N) + (j & 31)) * BRICK_N + (i & 31);
      const old = b ? b.phi[idx] : this.baseLattice(i, j, k);
      if (!(tool > old)) continue;                               // field already at least this open
      const dC = contentOf(old) - contentOf(tool);
      if (dC > 1e-9) {
        const pm = b ? this._pointMaterial(b, idx, i, j, k) : (() => { const m = naturalMaterialAt(this.body, x, y, z); return { mat: m, rho: m.densityKgM3 }; })();
        if (pm.mat.id === 'MAT-MANTLE') { mantlePoints++; continue; }
        if (pm.mat.excavatable === false) { protectedPoints++; continue; }
        const dv = dC * H3;
        V += dv; M += dv * pm.rho;
        parts.set(pm.mat.id, (parts.get(pm.mat.id) || 0) + dv);
      } else if (old > 0) airPoints++;
      plan.push(i, j, k, tool);
    }
    if (V < 1e-9) {
      this.lastRefusal = mantlePoints > protectedPoints ? 'The mantle will not cut.'
        : protectedPoints > 0 ? 'Structural concrete will not cut.' : 'Nothing there to dig.';
      return null;
    }

    // Refuse BEFORE any writes, so a final bite cannot overfill the carrier or lose matter.
    if (M > (shape.maxMassKg ?? Infinity)) {
      this.lastRefusal = 'Carrier full for this bite · Drop all (R) or one load (Q)';
      return null;
    }

    // Pass 2: write. Bricks come into being here, and only here.
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity, c0 = Infinity, c1 = -Infinity;
    for (let n = 0; n < plan.length; n += 4) {
      const i = plan[n], j = plan[n + 1], k = plan[n + 2], tool = plan[n + 3];
      const b = this._ensureBrick(i >> 5, j >> 5, k >> 5);
      b.phi[(((k & 31) * BRICK_N) + (j & 31)) * BRICK_N + (i & 31)] = tool;
      b.edited = true;
      if (i < a0) a0 = i; if (i > a1) a1 = i; if (j < b0) b0 = j; if (j > b1) b1 = j; if (k < c0) c0 = k; if (k > c1) c1 = k;
    }
    this._touch(a0, a1, b0, b1, c0, c1);

    let dominant = null, best = -1;
    const partList = [];
    for (const [id, vol] of parts) {
      const m = MATERIAL_LIST.find((q) => q.id === id);
      partList.push({ materialId: id, volumeM3: vol, massKg: vol * m.densityKgM3 });
      if (vol > best) { best = vol; dominant = m; }
    }
    // Per-point densities can differ from the material's (a pile mixed from a lot),
    // so the lot's mass is the sum, and the part masses are scaled to agree with it.
    const sumParts = partList.reduce((a, p) => a + p.massKg, 0);
    if (sumParts > 0) for (const p of partList) p.massKg *= M / sumParts;

    const id = `COS-EDIT-${String(++this._seq).padStart(5, '0')}`;
    this.edits.push({
      id, type: 'dig', x: shape.x ?? (box.x0 + box.x1) / 2, y: shape.y ?? (box.y0 + box.y1) / 2,
      z: shape.z ?? (box.z0 + box.z1) / 2, radius: shape.r ?? Math.hypot(box.x1-box.x0,box.y1-box.y0,box.z1-box.z0)/2, volumeM3: V, massKg: M,
      materialId: dominant.id, at: Date.now(),
    });
    this._removedV += account(V); this._removedM += account(M);
    this.totalRemovedM3 = Number(this._removedV) / ACCOUNT_SCALE;
    this.totalRemovedKg = Number(this._removedM) / ACCOUNT_SCALE;
    return {
      lotId: `COS-LOT-${String(this._seq).padStart(5, '0')}`,
      materialId: dominant.id, materialName: dominant.name,
      solidVolumeM3: V,
      looseVolumeM3: V * 1.25,      // what it would fill in a truck. Spoil on the ground keeps its solid volume.
      massKg: M, parts: partList,
      fromEditId: id,
      origin: { x: shape.x ?? 0, y: shape.y ?? 0, z: shape.z ?? 0 },
    };
  }

  /** The hand tool: a sphere. Kept for callers that only want a bite. */
  dig(cx, cy, cz, radius) { return this.carve({ x: cx, y: cy, z: cz, r: radius }); }

  // ============================================================ DEPOSITING
  /**
   * Pour a lot onto the ground at (ax,ay,az) and let it settle.
   *
   * THE SHAPE. A heap of loose material poured from a point is a cone whose
   * sides stand at the angle of repose, with a rounded tip. So the load is
   * given a cone T(rho) = A - tan(repose) * (sqrt(rho^2 + e^2) - e) about the
   * drop point, and the apex height A is the single unknown. The material goes
   * wherever the cone stands above the surface that is already there:
   * grass-roots level on flat ground, the floor of a hollow, the flank of an
   * earlier heap (so a second load makes the SAME heap bigger, with the same
   * side slope, rather than a second spike on top of the first).
   *
   * THE AMOUNT. The volume of that fill is measured on the lattice, the same
   * way a dig is measured, and A is found by bisection until it equals the lot
   * to the last bit. Nothing is made up and nothing is lost.
   *
   * Returns { pile, volumeM3 } or null when the load cannot be placed (there is
   * no ground within reach below the drop point).
   */
  deposit(lot, ax, ay, az, opts = {}) {
    const V = lot.solidVolumeM3;
    const al = Math.hypot(ax, ay, az) || 1;
    const up = opts.up || { x: ax / al, y: ay / al, z: az / al };
    // Frame on the ground: e1, e2 across, up along. Deterministic.
    const ref = Math.abs(up.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
    let e1 = { x: up.y * ref.z - up.z * ref.y, y: up.z * ref.x - up.x * ref.z, z: up.x * ref.y - up.y * ref.x };
    const e1l = Math.hypot(e1.x, e1.y, e1.z); e1 = { x: e1.x / e1l, y: e1.y / e1l, z: e1.z / e1l };
    const e2 = { x: up.y * e1.z - up.z * e1.y, y: up.z * e1.x - up.x * e1.z, z: up.x * e1.y - up.y * e1.x };

    const tanT = Math.tan(this.repose);
    const rFlat = Math.cbrt((3 * V) / (Math.PI * tanT));
    // A load poured onto an existing heap is poured about the same axis, and from above the heap's top.
    const onto = opts.pile || null;
    if (onto) { ax = onto.x; ay = onto.y; az = onto.z; }
    // A real heap is not a perfect cone: its sides run a few degrees steeper and shallower round the
    // compass, and a bigger heap has a rounder crown. The wobble is fixed per heap (so a second load
    // grows the same shape) and never lets a side stand steeper than SLOPE_MAX_DEG.
    const phase = onto ? onto.phase : (Math.abs(Math.sin(ax * 12.9898 + ay * 78.233 + az * 37.719)) * 6.2831853);
    const eps = onto ? onto.eps : Math.max(SPOIL_APEX_ROUND_M, 0.16 * rFlat);
    const WOB = 0.05;
    const slopeAt = (a, b) => {
      const th = Math.atan2(b, a);
      return tanT * (1 + WOB * (0.6 * Math.sin(3 * th + phase) + 0.4 * Math.sin(5 * th + 2.1 * phase)));
    };
    const headroom = onto ? onto.apexM + 0.8 : 0;

    // The grid has to hold the finished heap. Sized from what a heap of this volume is (a bigger one only when the
    // solution says it was cut off, below): a roomier grid costs more than the arithmetic does.
    const grownR = onto ? onto.radiusM * Math.cbrt(1 + V / Math.max(onto.volumeM3, 1e-4)) + 0.5 : 0;
    let R = Math.min(9, Math.max(0.6, rFlat * 1.7 + 0.6, grownR));
    for (let attempt = 0; attempt < 4; attempt++) {
      const g = Math.max(H, R / 24);                          // column size: 0.1 m for ordinary heaps
      const half = Math.ceil(R / g), n = 2 * half + 1;
      const sTop = Math.min(9, Math.max(rFlat * tanT * 2 + 1.4, headroom)), sBot = -(Math.min(6, rFlat * 2 + 1.5));
      // Ground height under every column: the first solid found looking down from sTop.
      const lo = new Float32Array(n * n);
      const ceilings = opts.local ? new Float32Array(n * n).fill(Infinity) : null;
      let loMin = Infinity, loCentre = NaN;
      for (let cb = 0; cb < n; cb++) for (let ca = 0; ca < n; ca++) {
        const a = (ca - half) * g, b = (cb - half) * g;
        const px = ax + e1.x * a + e2.x * b, py = ay + e1.y * a + e2.y * b, pz = az + e1.z * a + e2.z * b;
        const start = opts.local ? (onto ? onto.apexM + .15 : .15) : sTop;
        let s = start, prevS = start, prevPhi = this.phiAt(px + up.x * s, py + up.y * s, pz + up.z * s), found = NaN;
        if (prevPhi >= 0) {
          while (s > sBot) {
            s -= Math.max(0.03, Math.min(0.25, prevPhi * 0.8));
            const phi = this.phiAt(px + up.x * s, py + up.y * s, pz + up.z * s);
            if (phi < 0) {
              let lo_ = s, hi_ = prevS;
              for (let it = 0; it < 7; it++) {
                const mid = (lo_ + hi_) / 2;
                if (this.phiAt(px + up.x * mid, py + up.y * mid, pz + up.z * mid) < 0) lo_ = mid; else hi_ = mid;
              }
              found = (lo_ + hi_) / 2; break;
            }
            prevS = s; prevPhi = phi;
          }
        }
        lo[cb * n + ca] = found;
        if(ceilings && found===found) {
          // The first roof above THIS floor bounds the connected air column.
          // Include no lattice point at the roof, through it, or above it.
          for(let t=found+.12;t<=sTop+.2;t+=.08) {
            if(this.phiAt(px+up.x*t,py+up.y*t,pz+up.z*t)<.04) {
              ceilings[cb*n+ca]=t-.12;break;
            }
          }
        }
        if (found === found) { if (found < loMin) loMin = found; }
        if (ca === half && cb === half) loCentre = found;
      }
      if (!(loMin < Infinity)) return null;                    // nothing to pour onto
      // The pile is poured at the drop point; if that spot has no ground (over a shaft) pour at the nearest.
      const centreS = loCentre === loCentre ? loCentre : loMin;

      const phiFill = (A, s, a, b, ground) => {
        const r2 = a * a + b * b;
        const root = Math.sqrt(r2 + eps * eps);
        const tn = slopeAt(a, b);
        const T = A - tn * (root - eps);
        const cs = 1 / Math.sqrt(1 + tn * tn * r2 / (r2 + eps * eps));
        const top = (s - T) * cs;
        const bot = (ground - FLOOR_EMBED_M) - s;
        return top > bot ? top : bot;
      };
      const extent = (A) => Math.min(R, Math.max(0, (A - loMin) / (tanT * (1 - 1.1 * WOB)) + eps));
      // The lattice points a heap of apex height `Amax` can touch, gathered once: every trial apex height
      // then only has to run the arithmetic over this list.
      const collect = (Amax) => {
        const rs = extent(Amax) + 0.15;
        const sMax = Amax + 0.2, sMin = loMin - FLOOR_EMBED_M - 0.05;
        const sAbs = Math.max(Math.abs(sMax), Math.abs(sMin));
        const hx = rs * (Math.abs(e1.x) + Math.abs(e2.x)) + Math.abs(up.x) * sAbs;
        const hy = rs * (Math.abs(e1.y) + Math.abs(e2.y)) + Math.abs(up.y) * sAbs;
        const hz = rs * (Math.abs(e1.z) + Math.abs(e2.z)) + Math.abs(up.z) * sAbs;
        const i0 = Math.floor((ax - hx) * INV), i1 = Math.ceil((ax + hx) * INV);
        const j0 = Math.floor((ay - hy) * INV), j1 = Math.ceil((ay + hy) * INV);
        const k0 = Math.floor((az - hz) * INV), k1 = Math.ceil((az + hz) * INV);
        // growable typed arrays: a big heap can touch a million lattice points
        let cap = 16384, count = 0;
        let I = new Int32Array(cap), J = new Int32Array(cap), K = new Int32Array(cap);
        let S = new Float32Array(cap), Aa = new Float32Array(cap), Bb = new Float32Array(cap), G = new Float32Array(cap), O = new Float32Array(cap);
        const grow = () => {
          cap *= 2;
          const gi = (arr) => { const n2 = new Int32Array(cap); n2.set(arr); return n2; };
          const gf = (arr) => { const n2 = new Float32Array(cap); n2.set(arr); return n2; };
          I = gi(I); J = gi(J); K = gi(K); S = gf(S); Aa = gf(Aa); Bb = gf(Bb); G = gf(G); O = gf(O);
        };
        for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
          const dx = i * H - ax, dy = j * H - ay, dz = k * H - az;
          const s = dx * up.x + dy * up.y + dz * up.z;
          if (s > sMax || s < sMin) continue;
          const a = dx * e1.x + dy * e1.y + dz * e1.z, b = dx * e2.x + dy * e2.y + dz * e2.z;
          if (a * a + b * b > rs * rs) continue;
          const ca = Math.round(a / g + half), cb = Math.round(b / g + half);
          if (ca < 0 || cb < 0 || ca >= n || cb >= n) continue;
          const ground = lo[cb * n + ca];
          if (ground !== ground) continue;                    // no ground under this column
          if(ceilings && s>ceilings[cb*n+ca])continue;
          const bk = this.brickAt(i >> 5, j >> 5, k >> 5);
          const old = bk ? bk.phi[(((k & 31) * BRICK_N) + (j & 31)) * BRICK_N + (i & 31)] : Math.fround(this.baseLattice(i, j, k));
          if (old < -0.5) continue;                           // solid all through: it can gain nothing (the inside of an earlier heap, the ground)
          if (count === cap) grow();
          I[count] = i; J[count] = j; K[count] = k; S[count] = s; Aa[count] = a; Bb[count] = b; G[count] = ground; O[count] = old;
          count++;
        }
        return { I, J, K, S, Aa, Bb, G, O, count };
      };
      const volumeAt = (c, A) => {
        let vol = 0;
        for (let q = 0; q < c.count; q++) {
          const old = c.O[q], nf = phiFill(A, c.S[q], c.Aa[q], c.Bb[q], c.G[q]);
          if (!(nf < old)) continue;
          const dC = contentOf(Math.fround(nf)) - contentOf(old);
          if (dC > 0) vol += dC * H3;
        }
        return vol;
      };
      const emitAt = (c, A) => {
        const out = []; let vol = 0;
        for (let q = 0; q < c.count; q++) {
          const old = c.O[q], nf = phiFill(A, c.S[q], c.Aa[q], c.Bb[q], c.G[q]);
          if (!(nf < old)) continue;
          const nv = Math.fround(nf);
          const dC = contentOf(nv) - contentOf(old);
          // A point that gains no solid still takes the new distance when it is near the surface:
          // leaving the air just above a heap at "distance to the old ground" would drag the
          // interpolated surface off by up to a cell and print a staircase on every slope.
          if (dC <= 0 && old < -0.35) continue;
          if (dC > 0) vol += dC * H3;
          out.push(c.I[q], c.J[q], c.K[q], nv, Math.max(dC, 0), old);
        }
        return { vol, out };
      };

      // Bracket and bisect the apex height.
      let aLo = loMin - 0.2;
      let aHi = (onto ? Math.max(onto.apexM, centreS) + V / (Math.PI * Math.max(onto.radiusM, 0.3) ** 2) * 1.5 + 0.2
                      : Math.max(loMin, centreS) + Math.max(0.25, rFlat * tanT * 1.7));
      let cand = collect(aHi);
      for (let guard = 0; volumeAt(cand, aHi) < V && guard < 30; guard++) {
        aHi = aLo + (aHi - aLo) * 1.5 + 0.1;
        if(aHi>sTop)break;
        cand = collect(aHi);
      }
      if(volumeAt(cand,aHi)<V)return null;
      for (let it = 0; it < 48; it++) {
        const mid = (aLo + aHi) / 2;
        if (volumeAt(cand, mid) < V) aLo = mid; else aHi = mid;
        if (aHi - aLo < 1e-12) break;
      }
      const A = (aLo + aHi) / 2;
      if (extent(A) >= R - 0.2 && attempt < 3) { R = Math.min(12, R * 1.5); continue; }       // the finished heap would be cut off by the grid: widen and redo
      const { vol, out } = emitAt(cand, A);
      if(Math.abs(vol-V)>1e-7)return null;
      // Atomic refusal: never clip a heap against a ship or structure and quietly lose mass.
      if(opts.canPlace)for(let q=0;q<out.length;q+=6) {
        if(!opts.canPlace(out[q]*H,out[q+1]*H,out[q+2]*H))return null;
      }

      // Write the new lattice values and the material they are made of.
      const rhoLot = lot.massKg / V;
      const matIdx = matIndexOf(lot.materialId);
      let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity, c0 = Infinity, c1 = -Infinity;
      let footprint = 0;
      for (let q = 0; q < out.length; q += 6) {
        const i = out[q], j = out[q + 1], k = out[q + 2], nv = out[q + 3], dC = out[q + 4], old = out[q + 5];
        const bk = this._ensureBrick(i >> 5, j >> 5, k >> 5);
        const idx = (((k & 31) * BRICK_N) + (j & 31)) * BRICK_N + (i & 31);
        if (dC <= 0) { bk.phi[idx] = nv; bk.edited = true; if (i < a0) a0 = i; if (i > a1) a1 = i; if (j < b0) b0 = j; if (j > b1) b1 = j; if (k < c0) c0 = k; if (k > c1) c1 = k; continue; }
        if (!bk.rho) { bk.rho = new Float32Array(BRICK_N ** 3); bk.mat = new Uint8Array(BRICK_N ** 3); }
        const cOld = contentOf(old);
        let rhoOld = 0;
        if (cOld > 1e-6) rhoOld = bk.rho[idx] > 0 ? bk.rho[idx] : naturalMaterialAt(this.body, i * H, j * H, k * H).densityKgM3;
        const cNew = cOld + dC;
        bk.rho[idx] = (cOld * rhoOld + dC * rhoLot) / cNew;
        if (dC >= cOld || bk.mat[idx] === 0) bk.mat[idx] = matIdx;
        bk.phi[idx] = nv;
        if (dC > 0.3) {                                   // the heap's real footprint: where it is more than a skin
          const dx = i * H - ax, dy = j * H - ay, dz = k * H - az;
          const al = dx * up.x + dy * up.y + dz * up.z;
          footprint = Math.max(footprint, Math.hypot(dx - up.x * al, dy - up.y * al, dz - up.z * al));
        }
        bk.edited = true;
        if (i < a0) a0 = i; if (i > a1) a1 = i; if (j < b0) b0 = j; if (j > b1) b1 = j; if (k < c0) c0 = k; if (k > c1) c1 = k;
      }
      this._touch(a0, a1, b0, b1, c0, c1);

      const id = `COS-EDIT-${String(++this._seq).padStart(5, '0')}`;
      let pile;
      if (onto) {
        // The same heap, bigger: its apex and footprint grow, its axis does not move.
        pile = onto;
        pile.apexM = A; pile.radiusM = Math.max(pile.radiusM, footprint); pile.volumeM3 += V; pile.loads = (pile.loads || 1) + 1;
        const at = this.piles.indexOf(onto);
        if (at >= 0) { this.piles.splice(at, 1); this.piles.push(onto); }
      } else {
        pile = { id, x: ax, y: ay, z: az, up, e1, e2, apexM: A, centreGroundM: centreS,
                 radiusM: footprint, volumeM3: V, tanRepose: tanT, loads: 1, phase, eps, wob: WOB };
        this.piles.push(pile);
      }
      this.edits.push({ id, type: 'pile', x: ax, y: ay, z: az, radius: pile.radiusM, volumeM3: V, massKg: lot.massKg, materialId: lot.materialId, at: Date.now() });
      for (const source of lot.sourceLots || [lot]) {
        this._depositedV += account(source.solidVolumeM3); this._depositedM += account(source.massKg);
      }
      this.totalDepositedM3 = Number(this._depositedV) / ACCOUNT_SCALE;
      this.totalDepositedKg = Number(this._depositedM) / ACCOUNT_SCALE;
      return { pile, volumeM3: vol, apexHeightM: A - centreS };
    }
    return null;
  }

  /** The newest heap whose footprint (plus `slack` metres) contains this point, or null. */
  pileNear(x, y, z, slack = 0.4) {
    for (let n = this.piles.length - 1; n >= 0; n--) {
      const p = this.piles[n];
      const dx = x - p.x, dy = y - p.y, dz = z - p.z;
      const along = dx * p.up.x + dy * p.up.y + dz * p.up.z;
      if (Math.abs(along) > 3.5) continue;
      const hx = dx - p.up.x * along, hy = dy - p.up.y * along, hz = dz - p.up.z * along;
      if (Math.hypot(hx, hy, hz) <= p.radiusM + slack) return p;
    }
    return null;
  }

  /** The books. Everything dug must be accounted for, in litres and in kilograms. */
  ledger(carriedLots = []) {
    const carried = carriedLots.reduce((a, l) => a + l.solidVolumeM3, 0);
    const carriedKg = carriedLots.reduce((a, l) => a + l.massKg, 0);
    const carriedVExact = carriedLots.reduce((a, l) => a + account(l.solidVolumeM3), 0n);
    const carriedMExact = carriedLots.reduce((a, l) => a + account(l.massKg), 0n);
    return {
      removedM3: this.totalRemovedM3,
      depositedM3: this.totalDepositedM3,
      carriedM3: carried,
      unaccountedM3: Number(this._removedV - this._depositedV - carriedVExact) / ACCOUNT_SCALE,
      removedKg: this.totalRemovedKg, depositedKg: this.totalDepositedKg, carriedKg,
      unaccountedKg: Number(this._removedM - this._depositedM - carriedMExact) / ACCOUNT_SCALE,
      edits: this.edits.length,
    };
  }

  /**
   * The audit that does not trust the ledger: re-add the solid content of every
   * brick and compare with what the bricks held when they were made. It must
   * equal deposited minus removed.
   */
  fieldDeltaM3() {
    let d = 0;
    for (const b of this.bricks.values()) {
      let s = 0;
      for (let n = 0; n < b.phi.length; n++) s += contentOf(b.phi[n]);
      d += s - b.baseContent;
    }
    return d * H3;
  }

  /**
   * The dig site being worked near a point: the holes dug within `within` metres of it that join up
   * with the most recent one (each within a metre of the next), as a bounding sphere. This is what a
   * spoil heap has to stay clear of. Two separate pits are two sites, not one enormous one.
   */
  siteNear(x, y, z, within = 7) {
    const near = [];
    for (let n = this.edits.length - 1; n >= 0; n--) {
      const e = this.edits[n];
      if (e.type === 'dig' && Math.hypot(e.x - x, e.y - y, e.z - z) <= within) near.push(e);
    }
    if (!near.length) return null;
    const hit = [near[0]], rest = near.slice(1);
    for (let k = 0; k < hit.length; k++) {
      for (let m = rest.length - 1; m >= 0; m--) {
        const o = rest[m];
        if (Math.hypot(o.x - hit[k].x, o.y - hit[k].y, o.z - hit[k].z) <= o.radius + hit[k].radius + 1.0) {
          hit.push(o); rest.splice(m, 1);
        }
      }
    }
    let sx = 0, sy = 0, sz = 0;
    for (const e of hit) { sx += e.x; sy += e.y; sz += e.z; }
    const n = hit.length, cx = sx / n, cy = sy / n, cz = sz / n;
    let rad = 0;
    for (const e of hit) rad = Math.max(rad, Math.hypot(e.x - cx, e.y - cy, e.z - cz) + e.radius);
    return { x: cx, y: cy, z: cz, radiusM: rad, bites: n };
  }
}
