// hb-render: geometry. Triangle meshes with positions, normals, uvs. Procedural primitives,
// lathe (surface of revolution), a ridged PET water bottle, and a displaced heightfield.
// Mesh format: { pos: Float32Array(3n), nrm: Float32Array(3n), uv: Float32Array(2n), idx: Uint32Array(3t) }

// ---------- small vector helpers ----------
export const v3 = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  scale: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
};

// 4x4 column-major matrices (like WebGPU/GL)
export const m4 = {
  identity: () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  mul(a, b) {
    const o = new Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    return o;
  },
  translate: (t) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, t[0], t[1], t[2], 1],
  scale: (s) => [s[0], 0, 0, 0, 0, s[1], 0, 0, 0, 0, s[2], 0, 0, 0, 0, 1],
  rotX(a) { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]; },
  rotY(a) { const c = Math.cos(a), s = Math.sin(a); return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]; },
  rotZ(a) { const c = Math.cos(a), s = Math.sin(a); return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; },
  // transform = T * Rz * Ry * Rx * S  (rotation in degrees, applied X then Y then Z)
  fromTRS(t = [0, 0, 0], rDeg = [0, 0, 0], s = [1, 1, 1]) {
    const d = Math.PI / 180;
    let m = m4.scale(s);
    m = m4.mul(m4.rotX(rDeg[0] * d), m);
    m = m4.mul(m4.rotY(rDeg[1] * d), m);
    m = m4.mul(m4.rotZ(rDeg[2] * d), m);
    return m4.mul(m4.translate(t), m);
  },
  xformPoint: (m, p) => [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]],
  xformDir: (m, p) => [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2]],
  invertRigid(m) {
    // inverse of rotation+translation (no scale)
    const r = [m[0], m[4], m[8], 0, m[1], m[5], m[9], 0, m[2], m[6], m[10], 0, 0, 0, 0, 1];
    const t = [-m[12], -m[13], -m[14]];
    const tt = m4.xformDir(r, t);
    r[12] = tt[0]; r[13] = tt[1]; r[14] = tt[2];
    return r;
  },
};

// ---------- mesh builders ----------
export function makeMesh(pos, nrm, uv, idx) {
  return { pos: Float32Array.from(pos), nrm: Float32Array.from(nrm), uv: Float32Array.from(uv), idx: Uint32Array.from(idx) };
}

export function computeNormals(mesh) {
  const n = mesh.pos.length / 3;
  const nrm = new Float32Array(n * 3);
  const p = mesh.pos, idx = mesh.idx;
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    const ax = p[a * 3], ay = p[a * 3 + 1], az = p[a * 3 + 2];
    const e1 = [p[b * 3] - ax, p[b * 3 + 1] - ay, p[b * 3 + 2] - az];
    const e2 = [p[c * 3] - ax, p[c * 3 + 1] - ay, p[c * 3 + 2] - az];
    const fn = v3.cross(e1, e2); // area-weighted
    for (const i of [a, b, c]) { nrm[i * 3] += fn[0]; nrm[i * 3 + 1] += fn[1]; nrm[i * 3 + 2] += fn[2]; }
  }
  for (let i = 0; i < n; i++) {
    const l = Math.hypot(nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]) || 1;
    nrm[i * 3] /= l; nrm[i * 3 + 1] /= l; nrm[i * 3 + 2] /= l;
  }
  mesh.nrm = nrm;
  return mesh;
}

export function transformMesh(mesh, m) {
  const n = mesh.pos.length / 3;
  for (let i = 0; i < n; i++) {
    const p = m4.xformPoint(m, [mesh.pos[i * 3], mesh.pos[i * 3 + 1], mesh.pos[i * 3 + 2]]);
    mesh.pos[i * 3] = p[0]; mesh.pos[i * 3 + 1] = p[1]; mesh.pos[i * 3 + 2] = p[2];
    const d = v3.norm(m4.xformDir(m, [mesh.nrm[i * 3], mesh.nrm[i * 3 + 1], mesh.nrm[i * 3 + 2]]));
    mesh.nrm[i * 3] = d[0]; mesh.nrm[i * 3 + 1] = d[1]; mesh.nrm[i * 3 + 2] = d[2];
  }
  return mesh;
}

// Surface of revolution around the local Y axis. profile = [[radius, y], ...] from one end to the other.
// If the profile starts/ends at radius 0 the mesh is closed there. uv.u = angle, uv.v = profile parameter.
export function lathe(profile, segments = 64) {
  const pos = [], uv = [], idx = [];
  const rows = profile.length;
  for (let i = 0; i < rows; i++) {
    const [r, y] = profile[i];
    for (let j = 0; j <= segments; j++) {
      const a = (j / segments) * Math.PI * 2;
      pos.push(Math.cos(a) * r, y, Math.sin(a) * r);
      uv.push(j / segments, i / (rows - 1));
    }
  }
  const W = segments + 1;
  for (let i = 0; i < rows - 1; i++) {
    for (let j = 0; j < segments; j++) {
      const a = i * W + j, b = a + 1, c = a + W, d = c + 1;
      const r0 = profile[i][0], r1 = profile[i + 1][0];
      if (r1 > 1e-9) idx.push(a, c, d);
      if (r0 > 1e-9) idx.push(a, d, b);
    }
  }
  const mesh = makeMesh(pos, new Array(pos.length).fill(0), uv, idx);
  return computeNormals(mesh);
}

// Procedural ridged water bottle (PET, 500 ml class). Local axis Y: base at y=0, mouth at y=height.
// Returns { mesh, profileOuter, profileInner, height, radius, mouthRadius }.
export function bottle(p = {}) {
  const R = p.radius ?? 0.0325;           // body radius
  const H = p.height ?? 0.215;            // overall height incl. neck
  const wall = p.wall ?? 0.0004;          // PET wall thickness
  const ridges = p.ridges ?? 5;           // number of ridge rings on the body
  const ridgeDepth = p.ridgeDepth ?? 0.0018;
  const neckR = p.neckRadius ?? 0.0125;
  const mouthInnerR = p.mouthInnerRadius ?? 0.0108;
  const segments = p.segments ?? 128;
  const bodyTop = H * 0.68, shoulderTop = H * 0.86, neckTop = H - 0.003, lipTop = H;

  const outer = [];
  // base: petaloid-ish dome approximated by a shallow dome with inset
  outer.push([0, 0.004]);
  outer.push([R * 0.35, 0.0025]);
  outer.push([R * 0.7, 0.0005]);
  outer.push([R * 0.92, 0]);
  outer.push([R * 0.985, 0.0012]);
  outer.push([R, 0.006]);
  // body with ridges
  const bodyStart = 0.012, bodyEnd = bodyTop - 0.004;
  const nBody = 120;
  for (let i = 0; i <= nBody; i++) {
    const y = bodyStart + (bodyEnd - bodyStart) * i / nBody;
    const u = (y - bodyStart) / (bodyEnd - bodyStart);
    // ridges: smooth bumps (grip rings) spaced along the body
    let r = R;
    const t = u * ridges;
    const frac = t - Math.floor(t);
    const bump = Math.exp(-Math.pow((frac - 0.5) / 0.16, 2));
    r -= ridgeDepth * bump;
    // slight waist in the middle of the body, as real bottles have
    r -= 0.0012 * Math.exp(-Math.pow((u - 0.5) / 0.22, 2));
    outer.push([r, y]);
  }
  // shoulder: smooth curve from R to neckR
  const nSh = 28;
  for (let i = 1; i <= nSh; i++) {
    const s = i / nSh;
    const e = 1 - Math.pow(1 - s, 2.2); // ease
    const y = bodyTop + (shoulderTop - bodyTop) * s;
    const r = R + (neckR - R) * e;
    outer.push([r, y]);
  }
  // neck with two thread rings and the support ring
  outer.push([neckR + 0.0022, shoulderTop + 0.0015]);
  outer.push([neckR + 0.0022, shoulderTop + 0.0030]);
  outer.push([neckR, shoulderTop + 0.0040]);
  const threadStart = shoulderTop + 0.006;
  for (let k = 0; k < 2; k++) {
    const y0 = threadStart + k * 0.0055;
    outer.push([neckR, y0]);
    outer.push([neckR + 0.0012, y0 + 0.0012]);
    outer.push([neckR + 0.0012, y0 + 0.0022]);
    outer.push([neckR, y0 + 0.0034]);
  }
  outer.push([neckR, neckTop]);
  outer.push([neckR + 0.0005, lipTop - 0.0008]);
  outer.push([neckR - 0.0004, lipTop]);
  // mouth rim -> inner wall going back down
  const inner = [];
  inner.push([mouthInnerR, lipTop]);
  inner.push([mouthInnerR, neckTop]);
  // mirror the outer profile inward by the wall thickness (skip the threads/rings on the inside)
  for (let i = outer.length - 1; i >= 0; i--) {
    const [r, y] = outer[i];
    if (y > shoulderTop + 0.001 && y < neckTop) continue; // neck inside is a straight tube
    if (y >= neckTop) continue;
    const ri = Math.max(0, r - wall);
    if (y <= 0.006) { // base inside: lift by wall thickness
      inner.push([ri, y + wall]);
    } else inner.push([ri, y]);
  }
  // ensure the inner ends on the axis
  inner.push([0, 0.004 + wall]);
  const profile = outer.concat(inner);
  const mesh = lathe(profile, segments);
  return { mesh, profileOuter: outer, profileInner: inner, height: H, radius: R, mouthRadius: neckR, mouthInnerRadius: mouthInnerR, neckTop, shoulderTop, bodyTop };
}

export function sphere(radius = 1, seg = 48, rings = 32) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings, phi = t * Math.PI;
    for (let j = 0; j <= seg; j++) {
      const s = j / seg, th = s * Math.PI * 2;
      pos.push(radius * Math.sin(phi) * Math.cos(th), radius * Math.cos(phi), radius * Math.sin(phi) * Math.sin(th));
      uv.push(s, t);
    }
  }
  const W = seg + 1;
  for (let i = 0; i < rings; i++) for (let j = 0; j < seg; j++) {
    const a = i * W + j, b = a + 1, c = a + W, d = c + 1;
    if (i > 0) idx.push(a, b, d);
    if (i < rings - 1) idx.push(a, d, c);
  }
  return computeNormals(makeMesh(pos, new Array(pos.length).fill(0), uv, idx));
}

export function box(size = [1, 1, 1]) {
  const [sx, sy, sz] = size.map((v) => v / 2);
  const faces = [
    [[1, 0, 0], [0, 0, -1], [0, 1, 0]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],
    [[0, 1, 0], [1, 0, 0], [0, 0, -1]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
    [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [-1, 0, 0], [0, 1, 0]],
  ];
  const pos = [], nrm = [], uv = [], idx = [];
  for (const [n, t, b] of faces) {
    const base = pos.length / 3;
    for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      pos.push(n[0] * sx + t[0] * u * sx + b[0] * v * sx, n[1] * sy + t[1] * u * sy + b[1] * v * sy, n[2] * sz + t[2] * u * sz + b[2] * v * sz);
      nrm.push(...n); uv.push(u * 0.5 + 0.5, v * 0.5 + 0.5);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return makeMesh(pos, nrm, uv, idx);
}

// Flat or displaced ground in the XZ plane, centered at the origin, facing +Y.
// heightFn(x, z) -> y. uvScale = texture repeats across the whole plate.
export function heightfield(size = [2, 2], segments = [200, 200], heightFn = () => 0, uvRepeat = 1) {
  const [sx, sz] = size, [nx, nz] = segments;
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const x = (i / nx - 0.5) * sx, z = (j / nz - 0.5) * sz;
    pos.push(x, heightFn(x, z), z);
    uv.push((i / nx) * uvRepeat * sx, (j / nz) * uvRepeat * sz);
  }
  const W = nx + 1;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const a = j * W + i, b = a + 1, c = a + W, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  return computeNormals(makeMesh(pos, new Array(pos.length).fill(0), uv, idx));
}

// Merge meshes into flat per-triangle arrays for the GPU (positions, normals, uvs expanded per corner).
export function flattenMeshes(list) {
  let triCount = 0;
  for (const { mesh } of list) triCount += mesh.idx.length / 3;
  const pos = new Float32Array(triCount * 12);   // 3 corners * vec4
  const nrm = new Float32Array(triCount * 12);
  const uv = new Float32Array(triCount * 6);
  let t = 0;
  for (const { mesh, materialId } of list) {
    const { pos: p, nrm: n, uv: u, idx } = mesh;
    for (let k = 0; k < idx.length; k += 3) {
      for (let c = 0; c < 3; c++) {
        const vi = idx[k + c];
        const o = t * 12 + c * 4;
        pos[o] = p[vi * 3]; pos[o + 1] = p[vi * 3 + 1]; pos[o + 2] = p[vi * 3 + 2]; pos[o + 3] = c === 0 ? materialId : 0;
        nrm[o] = n[vi * 3]; nrm[o + 1] = n[vi * 3 + 1]; nrm[o + 2] = n[vi * 3 + 2]; nrm[o + 3] = 0;
        uv[t * 6 + c * 2] = u[vi * 2]; uv[t * 6 + c * 2 + 1] = u[vi * 2 + 1];
      }
      t++;
    }
  }
  return { pos, nrm, uv, triCount };
}
