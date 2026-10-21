// hb-render: particle fluid. Position Based Fluids (Macklin & Mueller 2013 style), plain JS.
// Includes: hashed neighbor grid, density constraint solve, tensile correction, XSPH viscosity,
// collisions against a ground heightfield and lathe-shaped shells (via a 2D (r,y) signed distance grid),
// a sand wetness map (water that touches sand soaks in: particle is removed, wetness is deposited and
// spreads), an optional emitter, and surfacing of a particle subset into a triangle mesh.

import { m4 } from './mesh.js';
import { marchingTetrahedra } from './mc.js';

// ---------- 2D signed distance grid for a closed (r,y) polygon (lathe profile) ----------
export function profileSDF(profile, rMax, yMin, yMax, cell) {
  const nr = Math.ceil(rMax / cell) + 1, ny = Math.ceil((yMax - yMin) / cell) + 1;
  const d = new Float32Array(nr * ny);
  const n = profile.length;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nr; i++) {
    const r = i * cell, y = yMin + j * cell;
    let best = Infinity, inside = false;
    for (let k = 0; k < n; k++) {
      const [ax, ay] = profile[k], [bx, by] = profile[(k + 1) % n];
      const ex = bx - ax, ey = by - ay;
      const l2 = ex * ex + ey * ey || 1e-20;
      let t = ((r - ax) * ex + (y - ay) * ey) / l2; t = Math.max(0, Math.min(1, t));
      const dx = r - (ax + ex * t), dy = y - (ay + ey * t);
      const dd = dx * dx + dy * dy;
      if (dd < best) best = dd;
      if ((ay > y) !== (by > y)) { const xi = ax + (y - ay) / (by - ay) * ex; if (r < xi) inside = !inside; }
    }
    d[i + nr * j] = (inside ? -1 : 1) * Math.sqrt(best);
  }
  const sample = (r, y) => {
    let fx = r / cell, fy = (y - yMin) / cell;
    if (fx < 0) fx = 0; if (fx > nr - 1.001) fx = nr - 1.001;
    if (fy < 0) fy = 0; if (fy > ny - 1.001) fy = ny - 1.001;
    const i = Math.floor(fx), j = Math.floor(fy), tx = fx - i, ty = fy - j;
    const d00 = d[i + nr * j], d10 = d[i + 1 + nr * j], d01 = d[i + nr * (j + 1)], d11 = d[i + 1 + nr * (j + 1)];
    const v = (d00 * (1 - tx) + d10 * tx) * (1 - ty) + (d01 * (1 - tx) + d11 * tx) * ty;
    const gr = ((d10 - d00) * (1 - ty) + (d11 - d01) * ty) / cell;
    const gy = ((d01 - d00) * (1 - tx) + (d11 - d10) * tx) / cell;
    return [v, gr, gy];
  };
  return { sample, nr, ny, cell, yMin, yMax, rMax, d };
}

// A solid made by revolving a profile: collide particles against its shell.
export function latheSolid(profile, matrix, opts = {}) {
  const rMax = Math.max(...profile.map((p) => p[0])) + 0.01;
  const ys = profile.map((p) => p[1]);
  const sdf = profileSDF(profile, rMax, Math.min(...ys) - 0.01, Math.max(...ys) + 0.01, opts.cell ?? 0.0004);
  const inv = m4.invertRigid(matrix);
  return {
    matrix, inv, sdf,
    // returns [signedDistance, nx, ny, nz] in world space (distance < 0 means inside the solid shell)
    query(px, py, pz) {
      const l = m4.xformPoint(inv, [px, py, pz]);
      const r = Math.hypot(l[0], l[2]);
      const [v, gr, gy] = sdf.sample(r, l[1]);
      const cr = r > 1e-9 ? l[0] / r : 1, sr = r > 1e-9 ? l[2] / r : 0;
      const g = m4.xformDir(matrix, [gr * cr, gy, gr * sr]);
      const gl = Math.hypot(g[0], g[1], g[2]) || 1;
      return [v, g[0] / gl, g[1] / gl, g[2] / gl];
    },
    localY(px, py, pz) { return m4.xformPoint(inv, [px, py, pz])[1]; },
  };
}

// ---------- sand soak: capillary spread of the water content map ----------
// Water in sand does not diffuse like heat: the wetting front stays sharp. Flux between neighbor
// cells scales with how wet the pair already is (relative permeability ~ saturation^2), so a wet
// core pushes outward with a defined edge instead of fading to nothing. Conserves water.
export function capillarySpread(w, dt) {
  const res = w.res, data = w.data, tmp = w.tmp, sat = w.saturation;
  const aTotal = w.diffusion * dt / (w.cell * w.cell);
  const sub = Math.max(1, Math.ceil(aTotal / 0.2));
  const a = aTotal / sub;
  for (let k = 0; k < sub && a > 0; k++) {
    tmp.set(data);
    for (let z = 1; z < res - 1; z++) for (let xx = 1; xx < res - 1; xx++) {
      const i = xx + res * z, c = data[i];
      if (c <= 1e-5) continue;
      // flux to the four neighbors, limited by relative permeability of the pair
      const nb = [i - 1, i + 1, i - res, i + res];
      for (let q = 0; q < 4; q++) {
        const j = nb[q], d = data[j];
        const s = Math.min(1, (c + d) * 0.5 / sat);
        const perm = 0.15 + 0.85 * s * s;
        const f = a * perm * (c - d);
        if (f > 0) { tmp[i] -= f; tmp[j] += f; }
      }
    }
    data.set(tmp);
  }
}

// ---------- the fluid ----------
export class Fluid {
  constructor(o = {}) {
    this.s = o.spacing ?? 0.0025;         // rest particle spacing (m)
    this.h = o.h ?? this.s * 2.0;          // kernel radius
    this.cap = o.capacity ?? 60000;
    this.n = 0;
    this.x = new Float32Array(this.cap * 3);
    this.v = new Float32Array(this.cap * 3);
    this.p = new Float32Array(this.cap * 3);
    this.lambda = new Float32Array(this.cap);
    this.alive = new Uint8Array(this.cap);
    this.age = new Float32Array(this.cap);
    this.ground = o.ground ?? (() => 0);   // (x,z) -> height
    this.solids = o.solids ?? [];
    this.gravity = o.gravity ?? [0, -9.81, 0];
    this.iters = o.iterations ?? 4;
    this.viscosity = o.viscosity ?? 0.02;
    this.friction = o.friction ?? 0.35;
    this.maxSpeed = o.maxSpeed ?? 4.0;      // m/s cap, keeps the solver from exploding
    this.domain = o.domain ?? 2.0;          // particles beyond +-domain (m) are dropped
    this.time = 0;
    // kernels in q = r/h units
    this.W = (q) => q < 1 ? (315 / (64 * Math.PI)) * Math.pow(1 - q * q, 3) : 0;
    this.dWdq = (q) => q < 1 ? -(45 / Math.PI) * (1 - q) * (1 - q) : 0;
    // rest density from a perfect lattice at spacing s
    let rho = 0; const k = Math.ceil(this.h / this.s);
    for (let i = -k; i <= k; i++) for (let j = -k; j <= k; j++) for (let l = -k; l <= k; l++) rho += this.W(Math.hypot(i, j, l) * this.s / this.h);
    this.rho0 = rho;
    this.scorrK = o.tensileK ?? 0.1;
    this.scorrW = this.W(0.2);
    // neighbor hash
    this.tableSize = 1 << 17;
    this.cellStart = new Int32Array(this.tableSize + 1);
    this.sorted = new Int32Array(this.cap);
    this.hashOf = new Int32Array(this.cap);
    // wetness map (xz plane)
    this.wet = null;
    if (o.wetness) {
      const w = o.wetness;
      this.wet = { res: w.res ?? 256, origin: w.origin ?? [-0.2, -0.2], size: w.size ?? 0.4, absorbRate: w.absorbRate ?? 2.5, deposit: w.deposit ?? 4.0, diffusion: w.diffusion ?? 1e-4, saturation: w.saturation ?? 2.0, trail: w.trail ?? 0.5 };
      this.wet.data = new Float32Array(this.wet.res * this.wet.res);
      this.wet.tmp = new Float32Array(this.wet.res * this.wet.res);
      this.wet.cell = this.wet.size / this.wet.res;
    }
    this.emitters = [];
    this.rngState = 12345;
    this.absorbed = 0;
  }
  rand() { // deterministic LCG
    this.rngState = (this.rngState * 1664525 + 1013904223) >>> 0;
    return this.rngState / 4294967296;
  }
  add(x, y, z, vx = 0, vy = 0, vz = 0) {
    if (this.n >= this.cap) return -1;
    const i = this.n++;
    this.x[i * 3] = x; this.x[i * 3 + 1] = y; this.x[i * 3 + 2] = z;
    this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
    this.alive[i] = 1; this.age[i] = 0;
    return i;
  }
  // fill a lattice inside bounds where predicate(x,y,z) is true
  fill(min, max, predicate) {
    const s = this.s; let c = 0;
    for (let y = min[1] + s / 2; y < max[1]; y += s) for (let z = min[2] + s / 2; z < max[2]; z += s) for (let x = min[0] + s / 2; x < max[0]; x += s) {
      const jx = (this.rand() - 0.5) * s * 0.1, jz = (this.rand() - 0.5) * s * 0.1;
      if (predicate(x + jx, y, z + jz)) { if (this.add(x + jx, y, z + jz) >= 0) c++; }
    }
    return c;
  }
  // emitter: disc of radius r at position, particles leave along dir at speed, from t0 to t1
  addEmitter(e) { this.emitters.push({ ...e, acc: 0 }); }

  _emit(dt) {
    for (const e of this.emitters) {
      if (this.time < e.start || this.time > e.stop) continue;
      e.acc += dt;
      const period = this.s / e.speed;
      const d = e.direction, a = Math.abs(d[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
      const t1 = [d[1] * a[2] - d[2] * a[1], d[2] * a[0] - d[0] * a[2], d[0] * a[1] - d[1] * a[0]];
      const l1 = Math.hypot(...t1); t1[0] /= l1; t1[1] /= l1; t1[2] /= l1;
      const t2 = [d[1] * t1[2] - d[2] * t1[1], d[2] * t1[0] - d[0] * t1[2], d[0] * t1[1] - d[1] * t1[0]];
      while (e.acc >= period) {
        e.acc -= period;
        for (let u = -e.radius; u <= e.radius; u += this.s) for (let w = -e.radius; w <= e.radius; w += this.s) {
          if (u * u + w * w > e.radius * e.radius) continue;
          this.add(e.position[0] + t1[0] * u + t2[0] * w, e.position[1] + t1[1] * u + t2[1] * w, e.position[2] + t1[2] * u + t2[2] * w,
            d[0] * e.speed, d[1] * e.speed, d[2] * e.speed);
        }
      }
    }
  }

  _hash(ix, iy, iz) { return ((ix * 73856093) ^ (iy * 19349663) ^ (iz * 83492791)) & (this.tableSize - 1); }
  _buildGrid() {
    const n = this.n, h = this.h, p = this.p, cs = this.cellStart, ho = this.hashOf;
    cs.fill(0);
    for (let i = 0; i < n; i++) {
      const k = this._hash(Math.floor(p[i * 3] / h), Math.floor(p[i * 3 + 1] / h), Math.floor(p[i * 3 + 2] / h));
      ho[i] = k; cs[k + 1]++;
    }
    for (let k = 0; k < this.tableSize; k++) cs[k + 1] += cs[k];
    const fillPos = new Int32Array(cs.subarray(0, this.tableSize));
    for (let i = 0; i < n; i++) this.sorted[fillPos[ho[i]]++] = i;
  }
  // visit neighbors j of i (within h) via callback(j, dx, dy, dz, q)
  _neighbors(i, cb) {
    const h = this.h, p = this.p, px = p[i * 3], py = p[i * 3 + 1], pz = p[i * 3 + 2];
    const ix = Math.floor(px / h), iy = Math.floor(py / h), iz = Math.floor(pz / h);
    for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const k = this._hash(ix + dx, iy + dy, iz + dz);
      const a = this.cellStart[k], b = this.cellStart[k + 1];
      for (let s = a; s < b; s++) {
        const j = this.sorted[s];
        if (j === i) continue;
        const ex = px - p[j * 3], ey = py - p[j * 3 + 1], ez = pz - p[j * 3 + 2];
        const d2 = ex * ex + ey * ey + ez * ez;
        if (d2 >= h * h) continue;
        cb(j, ex, ey, ez, Math.sqrt(d2) / h);
      }
    }
  }

  _collide(i, dt) {
    const p = this.p, r = this.s * 0.5;
    let x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2];
    let touchedGround = false;
    for (const s of this.solids) {
      const [d, nx, ny, nz] = s.query(x, y, z);
      if (d < r) { const push = r - d; x += nx * push; y += ny * push; z += nz * push; }
    }
    const g = this.ground(x, z);
    if (y < g + r) { y = g + r; touchedGround = true; }
    p[i * 3] = x; p[i * 3 + 1] = y; p[i * 3 + 2] = z;
    return touchedGround;
  }

  step(dt) {
    this._emit(dt);
    const n = this.n, x = this.x, v = this.v, p = this.p, g = this.gravity;
    for (let i = 0; i < n; i++) {
      v[i * 3] += g[0] * dt; v[i * 3 + 1] += g[1] * dt; v[i * 3 + 2] += g[2] * dt;
      p[i * 3] = x[i * 3] + v[i * 3] * dt; p[i * 3 + 1] = x[i * 3 + 1] + v[i * 3 + 1] * dt; p[i * 3 + 2] = x[i * 3 + 2] + v[i * 3 + 2] * dt;
      this._collide(i, dt);
    }
    this._buildGrid();
    const lam = this.lambda, rho0 = this.rho0, h = this.h;
    const dp = new Float32Array(n * 3);
    for (let it = 0; it < this.iters; it++) {
      for (let i = 0; i < n; i++) {
        let rho = this.W(0), sumGrad2 = 0, gx = 0, gy = 0, gz = 0;
        this._neighbors(i, (j, ex, ey, ez, q) => {
          rho += this.W(q);
          if (q > 1e-6) {
            const dw = this.dWdq(q) / (q * h); // d/dq * (vec/|vec|) with |vec| = q*h
            const cx = dw * ex / rho0, cy = dw * ey / rho0, cz = dw * ez / rho0;
            gx += cx; gy += cy; gz += cz;
            sumGrad2 += cx * cx + cy * cy + cz * cz;
          }
        });
        sumGrad2 += gx * gx + gy * gy + gz * gz;
        const C = Math.max(rho / rho0 - 1, 0);
        lam[i] = -C / (sumGrad2 + 1.0);
      }
      for (let i = 0; i < n; i++) {
        let ax = 0, ay = 0, az = 0;
        const li = lam[i];
        this._neighbors(i, (j, ex, ey, ez, q) => {
          if (q <= 1e-6) return;
          const sc = -this.scorrK * Math.pow(this.W(q) / this.scorrW, 4);
          const dw = this.dWdq(q) / (q * h);
          const f = (li + lam[j] + sc) * dw / rho0;
          ax += f * ex; ay += f * ey; az += f * ez;
        });
        // gradients were taken in q = r/h units, so the correction is scaled back to meters by h
        dp[i * 3] = ax * h; dp[i * 3 + 1] = ay * h; dp[i * 3 + 2] = az * h;
      }
      for (let i = 0; i < n; i++) {
        p[i * 3] += dp[i * 3]; p[i * 3 + 1] += dp[i * 3 + 1]; p[i * 3 + 2] += dp[i * 3 + 2];
        this._collide(i, dt);
      }
    }
    // velocities, viscosity, ground friction, absorption
    const touching = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      v[i * 3] = (p[i * 3] - x[i * 3]) / dt; v[i * 3 + 1] = (p[i * 3 + 1] - x[i * 3 + 1]) / dt; v[i * 3 + 2] = (p[i * 3 + 2] - x[i * 3 + 2]) / dt;
      const gh = this.ground(p[i * 3], p[i * 3 + 2]);
      if (p[i * 3 + 1] < gh + this.s * 0.9) { touching[i] = 1; v[i * 3] *= (1 - this.friction); v[i * 3 + 2] *= (1 - this.friction); if (v[i * 3 + 1] < 0) v[i * 3 + 1] *= 0.2; }
    }
    if (this.viscosity > 0) {
      const nv = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        let ax = 0, ay = 0, az = 0;
        this._neighbors(i, (j, ex, ey, ez, q) => { const w = this.W(q) / rho0; ax += (v[j * 3] - v[i * 3]) * w; ay += (v[j * 3 + 1] - v[i * 3 + 1]) * w; az += (v[j * 3 + 2] - v[i * 3 + 2]) * w; });
        nv[i * 3] = v[i * 3] + this.viscosity * ax * 4; nv[i * 3 + 1] = v[i * 3 + 1] + this.viscosity * ay * 4; nv[i * 3 + 2] = v[i * 3 + 2] + this.viscosity * az * 4;
      }
      v.set(nv.subarray(0, n * 3));
    }
    // safety: cap speed (PBF can spike when particles start overlapping) and drop runaways
    const vmax = this.maxSpeed, dom = this.domain;
    let maxSp = 0;
    for (let i = 0; i < n; i++) {
      const sp = Math.hypot(v[i * 3], v[i * 3 + 1], v[i * 3 + 2]);
      if (sp > vmax) { const k = vmax / sp; v[i * 3] *= k; v[i * 3 + 1] *= k; v[i * 3 + 2] *= k; }
      if (sp > maxSp) maxSp = sp;
      if (Math.abs(p[i * 3]) > dom || Math.abs(p[i * 3 + 1]) > dom || Math.abs(p[i * 3 + 2]) > dom) { touching[i] = 2; }
    }
    this.maxSpeedSeen = maxSp;
    x.set(p.subarray(0, n * 3));
    for (let i = 0; i < n; i++) this.age[i] += dt;
    if (!this.wet) this._dropRunaways(touching);
    // sand soak: deposit wetness where water touches sand, remove particles at the absorb rate
    if (this.wet) this._soak(touching, dt);
    this.time += dt;
  }

  _soak(touching, dt) {
    const w = this.wet, res = w.res, data = w.data;
    let write = 0;
    const n = this.n, x = this.x, v = this.v, age = this.age;
    for (let i = 0; i < n; i++) {
      let keep = touching[i] !== 2;
      if (touching[i] === 1) {
        const fx = (x[i * 3] - w.origin[0]) / w.cell, fz = (x[i * 3 + 2] - w.origin[1]) / w.cell;
        const cx = Math.floor(fx), cz = Math.floor(fz);
        if (cx >= 1 && cz >= 1 && cx < res - 1 && cz < res - 1) {
          const local = data[cx + res * cz];
          const sat = w.saturation;
          // dry sand drinks fast; as the pores fill absorption slows to a trickle
          const rate = w.absorbRate * Math.max(0.15, 1 - local / sat);
          // a sliding drop leaves a damp trail behind it (thin film wets the grains it passes)
          const sp = Math.hypot(v[i * 3], v[i * 3 + 2]);
          if (sp > 0.02) data[cx + res * cz] += w.trail * dt * sp;
          if (this.rand() < rate * dt) {
            keep = false; this.absorbed++;
            // the particle's water goes into the sand: splat its volume into a 3x3 footprint
            for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
              const wgt = (dx === 0 && dz === 0) ? 0.4 : 0.075;
              data[(cx + dx) + res * (cz + dz)] += w.deposit * wgt;
            }
          }
        }
      }
      if (keep) {
        if (write !== i) {
          x[write * 3] = x[i * 3]; x[write * 3 + 1] = x[i * 3 + 1]; x[write * 3 + 2] = x[i * 3 + 2];
          v[write * 3] = v[i * 3]; v[write * 3 + 1] = v[i * 3 + 1]; v[write * 3 + 2] = v[i * 3 + 2];
          age[write] = age[i];
        }
        write++;
      }
    }
    this.n = write;
    capillarySpread(w, dt);
  }

  _dropRunaways(touching) {
    let write = 0; const n = this.n, x = this.x, v = this.v, age = this.age;
    for (let i = 0; i < n; i++) {
      if (touching[i] === 2) continue;
      if (write !== i) { for (let a = 0; a < 3; a++) { x[write * 3 + a] = x[i * 3 + a]; v[write * 3 + a] = v[i * 3 + a]; } age[write] = age[i]; }
      write++;
    }
    this.n = write;
  }

  // Build a triangle mesh around the particles for which select(i) is true.
  surface(select = () => true, opts = {}) {
    const R = opts.radius ?? this.s * 2.2, cell = opts.cell ?? this.s * 0.5, iso = opts.iso ?? 0.3;
    const x = this.x, idx = [];
    const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < this.n; i++) if (select(i)) {
      idx.push(i);
      for (let a = 0; a < 3; a++) { mn[a] = Math.min(mn[a], x[i * 3 + a]); mx[a] = Math.max(mx[a], x[i * 3 + a]); }
    }
    if (idx.length === 0) return null;
    const origin = [mn[0] - R - cell, mn[1] - R - cell, mn[2] - R - cell];
    const nx = Math.ceil((mx[0] - mn[0] + 2 * R + 2 * cell) / cell) + 1, ny = Math.ceil((mx[1] - mn[1] + 2 * R + 2 * cell) / cell) + 1, nz = Math.ceil((mx[2] - mn[2] + 2 * R + 2 * cell) / cell) + 1;
    if (nx * ny * nz > 40e6) throw new Error('fluid surface grid too large: ' + nx + 'x' + ny + 'x' + nz);
    const field = new Float32Array(nx * ny * nz);
    const k = Math.ceil(R / cell);
    for (const i of idx) {
      const px = x[i * 3], py = x[i * 3 + 1], pz = x[i * 3 + 2];
      const cx = Math.round((px - origin[0]) / cell), cy = Math.round((py - origin[1]) / cell), cz = Math.round((pz - origin[2]) / cell);
      for (let z = Math.max(0, cz - k); z <= Math.min(nz - 1, cz + k); z++) for (let y = Math.max(0, cy - k); y <= Math.min(ny - 1, cy + k); y++) for (let xx = Math.max(0, cx - k); xx <= Math.min(nx - 1, cx + k); xx++) {
        const dx = origin[0] + xx * cell - px, dy = origin[1] + y * cell - py, dz = origin[2] + z * cell - pz;
        const q2 = (dx * dx + dy * dy + dz * dz) / (R * R);
        if (q2 < 1) { const t = 1 - q2; field[xx + nx * (y + ny * z)] += t * t * t; }
      }
    }
    // optional: clip the field below the ground so the water sits on the sand, not inside it
    if (opts.ground) {
      for (let z = 0; z < nz; z++) for (let xx = 0; xx < nx; xx++) {
        const gh = opts.ground(origin[0] + xx * cell, origin[2] + z * cell);
        for (let y = 0; y < ny; y++) { const wy = origin[1] + y * cell; if (wy < gh - cell * 0.5) field[xx + nx * (y + ny * z)] = 0; }
      }
    }
    return marchingTetrahedra(field, nx, ny, nz, origin, cell, iso);
  }
}
