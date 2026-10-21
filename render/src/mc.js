// hb-render: scalar field -> triangle mesh by marching tetrahedra (each cube split into 6 tets).
// No lookup tables needed; normals come from the field gradient so the surface shades smoothly.
// field: Float32Array of size nx*ny*nz, index = x + nx*(y + ny*z). origin/cell in meters.

import { makeMesh } from './mesh.js';

const TETS = [[0, 5, 1, 6], [0, 1, 2, 6], [0, 2, 3, 6], [0, 3, 7, 6], [0, 7, 4, 6], [0, 4, 5, 6]];
const CORNER = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];

export function marchingTetrahedra(field, nx, ny, nz, origin, cell, iso = 0) {
  const pos = [], idx = [];
  const vcache = new Map();
  const F = (x, y, z) => field[x + nx * (y + ny * z)];
  const grad = (x, y, z) => {
    const xm = Math.max(x - 1, 0), xp = Math.min(x + 1, nx - 1);
    const ym = Math.max(y - 1, 0), yp = Math.min(y + 1, ny - 1);
    const zm = Math.max(z - 1, 0), zp = Math.min(z + 1, nz - 1);
    return [F(xp, y, z) - F(xm, y, z), F(x, yp, z) - F(x, ym, z), F(x, y, zp) - F(x, y, zm)];
  };
  const gradAt = []; // per-vertex gradient, filled with position
  const vertexOnEdge = (ax, ay, az, bx, by, bz) => {
    // canonical key: smaller index first
    const ia = ax + nx * (ay + ny * az), ib = bx + nx * (by + ny * bz);
    const key = ia < ib ? ia * 1e9 + ib : ib * 1e9 + ia;
    let v = vcache.get(key);
    if (v !== undefined) return v;
    const fa = F(ax, ay, az) - iso, fb = F(bx, by, bz) - iso;
    let t = fa / (fa - fb); if (!(t >= 0 && t <= 1)) t = 0.5;
    pos.push(origin[0] + (ax + (bx - ax) * t) * cell, origin[1] + (ay + (by - ay) * t) * cell, origin[2] + (az + (bz - az) * t) * cell);
    const ga = grad(ax, ay, az), gb = grad(bx, by, bz);
    gradAt.push(ga[0] + (gb[0] - ga[0]) * t, ga[1] + (gb[1] - ga[1]) * t, ga[2] + (gb[2] - ga[2]) * t);
    v = pos.length / 3 - 1;
    vcache.set(key, v);
    return v;
  };
  const c = new Array(8);
  for (let z = 0; z < nz - 1; z++) for (let y = 0; y < ny - 1; y++) for (let x = 0; x < nx - 1; x++) {
    // quick reject: all corners same side
    let anyIn = false, anyOut = false;
    for (let k = 0; k < 8; k++) {
      const v = F(x + CORNER[k][0], y + CORNER[k][1], z + CORNER[k][2]);
      if (v > iso) anyIn = true; else anyOut = true;
      c[k] = v;
    }
    if (!anyIn || !anyOut) continue;
    for (const tet of TETS) {
      const inside = tet.map((k) => c[k] > iso);
      const n = inside.filter(Boolean).length;
      if (n === 0 || n === 4) continue;
      const P = (k) => [x + CORNER[k][0], y + CORNER[k][1], z + CORNER[k][2]];
      const E = (i, j) => { const a = P(tet[i]), b = P(tet[j]); return vertexOnEdge(a[0], a[1], a[2], b[0], b[1], b[2]); };
      // find the "odd" vertex/vertices
      if (n === 1 || n === 3) {
        const single = n === 1;
        let s = inside.indexOf(single);
        const o = [0, 1, 2, 3].filter((i) => i !== s);
        const a = E(s, o[0]), b = E(s, o[1]), d = E(s, o[2]);
        // orientation: fix via the gradient later (we flip by checking normal vs gradient)
        idx.push(a, b, d);
      } else {
        const ins = [0, 1, 2, 3].filter((i) => inside[i]), outs = [0, 1, 2, 3].filter((i) => !inside[i]);
        const a = E(ins[0], outs[0]), b = E(ins[0], outs[1]), d = E(ins[1], outs[1]), e = E(ins[1], outs[0]);
        idx.push(a, b, d, a, d, e);
      }
    }
  }
  // orient triangles so the geometric normal agrees with -gradient (outward where field decreases)
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], d = idx[t + 2];
    const e1 = [pos[b * 3] - pos[a * 3], pos[b * 3 + 1] - pos[a * 3 + 1], pos[b * 3 + 2] - pos[a * 3 + 2]];
    const e2 = [pos[d * 3] - pos[a * 3], pos[d * 3 + 1] - pos[a * 3 + 1], pos[d * 3 + 2] - pos[a * 3 + 2]];
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const g = [-(gradAt[a * 3] + gradAt[b * 3] + gradAt[d * 3]), -(gradAt[a * 3 + 1] + gradAt[b * 3 + 1] + gradAt[d * 3 + 1]), -(gradAt[a * 3 + 2] + gradAt[b * 3 + 2] + gradAt[d * 3 + 2])];
    if (n[0] * g[0] + n[1] * g[1] + n[2] * g[2] < 0) { idx[t + 1] = d; idx[t + 2] = b; }
  }
  const nrm = new Float32Array(pos.length);
  for (let i = 0; i < pos.length / 3; i++) {
    const gx = -gradAt[i * 3], gy = -gradAt[i * 3 + 1], gz = -gradAt[i * 3 + 2];
    const l = Math.hypot(gx, gy, gz) || 1;
    nrm[i * 3] = gx / l; nrm[i * 3 + 1] = gy / l; nrm[i * 3 + 2] = gz / l;
  }
  const uv = new Float32Array(pos.length / 3 * 2);
  const mesh = makeMesh(pos, nrm, uv, idx);
  mesh.nrm = nrm;
  return mesh;
}
