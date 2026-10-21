// hb-render: procedural builders for the "make anything" scene writer. Plain shapes that read as
// the real thing from a distance: rocks, low-poly trees, a boat hull, cylinders/cones, a room shell.
// All return hb-render meshes (pos/nrm/uv/idx) in local space, Y up, origin on the ground.

import { makeMesh, computeNormals, sphere, box, lathe } from './mesh.js';

function hash(x, y, z) { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); }

// a rock: a sphere pushed in and out by layered noise, flattened a little, seeded
export function rock(size = 0.5, seed = 1, roughness = 0.16) {
  const m = sphere(0.5, 40, 28);
  const n = m.pos.length / 3;
  for (let i = 0; i < n; i++) {
    let x = m.pos[i * 3], y = m.pos[i * 3 + 1], z = m.pos[i * 3 + 2];
    const r = Math.hypot(x, y, z) || 1;
    const nx = x / r, ny = y / r, nz = z / r;
    let d = 0;
    for (let o = 1; o <= 2; o++) { const f = o * 1.4 + seed * 0.37; d += (hash(Math.floor(nx * f + seed), Math.floor(ny * f + 7), Math.floor(nz * f + 3)) - 0.5) / o; }
    const s = 0.5 * (1 + roughness * d);
    m.pos[i * 3] = nx * s * size; m.pos[i * 3 + 1] = (ny * s * 0.75 + 0.35) * size; m.pos[i * 3 + 2] = nz * s * size;
  }
  return computeNormals(m);
}

export function cylinder(radius = 0.5, height = 1, seg = 48, closed = true) {
  const prof = closed ? [[0, 0], [radius, 0], [radius, height], [0, height]] : [[radius, 0], [radius, height]];
  return lathe(prof, seg);
}
export function cone(radius = 0.5, height = 1, seg = 48) { return lathe([[0, 0], [radius, 0], [0, height]], seg); }

// a simple tree: trunk + layered canopy (conifer) or a blobby crown (broadleaf)
export function tree(height = 4, kind = 'conifer', seed = 1) {
  const parts = [];
  const trunkH = kind === 'conifer' ? height * 0.3 : height * 0.45;
  parts.push({ mesh: lathe([[0, 0], [height * 0.035, 0], [height * 0.025, trunkH], [height * 0.012, height * 0.9], [0, height * 0.92]], 16), material: 'bark' });
  if (kind === 'conifer') {
    const layers = 4;
    for (let i = 0; i < layers; i++) {
      const y0 = trunkH * 0.8 + (height - trunkH * 0.8) * (i / layers);
      const r = height * 0.22 * (1 - i / (layers + 0.6));
      const m = lathe([[0, y0], [r, y0 + 0.02 * height], [0, y0 + (height - y0) * 0.55]], 10);
      parts.push({ mesh: m, material: 'leaves' });
    }
  } else {
    for (let i = 0; i < 5; i++) {
      const a = i * 2.4 + seed, rr = height * 0.28;
      const m = sphere(rr * (0.8 + 0.3 * hash(i, seed, 2)), 20, 14);
      const ox = (i ? Math.cos(a) * rr * 0.6 : 0), oz = (i ? Math.sin(a) * rr * 0.6 : 0), oy = trunkH + rr * 0.9 + (i ? hash(i, 3, seed) * rr * 0.4 : rr * 0.3);
      for (let k = 0; k < m.pos.length; k += 3) { m.pos[k] += ox; m.pos[k + 1] += oy; m.pos[k + 2] += oz; }
      parts.push({ mesh: m, material: 'leaves' });
    }
  }
  return parts;
}

// a boat hull (canoe): a stretched half-ellipsoid shell with a thin wall, open on top
export function hull(length = 4, width = 0.9, depth = 0.4, wall = 0.03) {
  const pos = [], uv = [], idx = [];
  const nL = 40, nR = 14;
  // outer then inner surfaces, rings from stern to bow
  for (const inner of [0, 1]) {
    for (let i = 0; i <= nL; i++) {
      const t = i / nL, x = (t - 0.5) * length;
      const taper = Math.sqrt(Math.max(0, 1 - Math.pow((t - 0.5) * 2, 2.4))) * 0.92 + 0.08;
      for (let j = 0; j <= nR; j++) {
        const a = -Math.PI / 2 + (j / nR) * Math.PI; // across the hull, keel at the middle
        const w = (width / 2 - inner * wall) * taper, d = (depth - inner * wall) * taper;
        pos.push(x, depth - Math.cos(a) * d + inner * wall * 0.5, Math.sin(a) * w);
        uv.push(t, j / nR);
      }
    }
  }
  const W = nR + 1, base1 = (nL + 1) * W;
  for (let i = 0; i < nL; i++) for (let j = 0; j < nR; j++) {
    const a = i * W + j, b = a + 1, c = a + W, d = c + 1;
    idx.push(a, c, b, b, c, d);                                 // outer
    const A = base1 + a, B = base1 + b, C = base1 + c, D = base1 + d;
    idx.push(A, B, C, B, D, C);                                 // inner (flipped)
  }
  // gunwale strip joining outer and inner rims
  for (let i = 0; i < nL; i++) for (const j of [0, nR]) {
    const a = i * W + j, c = a + W, A = base1 + a, C = base1 + c;
    if (j === 0) idx.push(a, A, c, A, C, c); else idx.push(a, c, A, A, c, C);
  }
  return computeNormals(makeMesh(pos, new Array(pos.length).fill(0), uv, idx));
}

// a room shell: floor, ceiling and four walls as separate boxes (inside faces visible), optional window hole in the -X wall
export function room(w = 4, d = 4, h = 2.7, t = 0.1, windowHole = null) {
  const parts = [];
  parts.push({ mesh: box([w + 2 * t, t, d + 2 * t]), offset: [0, -t / 2, 0], material: 'floor' });
  parts.push({ mesh: box([w + 2 * t, t, d + 2 * t]), offset: [0, h + t / 2, 0], material: 'ceiling' });
  parts.push({ mesh: box([w + 2 * t, h, t]), offset: [0, h / 2, -d / 2 - t / 2], material: 'wall' });
  parts.push({ mesh: box([w + 2 * t, h, t]), offset: [0, h / 2, d / 2 + t / 2], material: 'wall' });
  parts.push({ mesh: box([t, h, d]), offset: [w / 2 + t / 2, h / 2, 0], material: 'wall' });
  if (!windowHole) parts.push({ mesh: box([t, h, d]), offset: [-w / 2 - t / 2, h / 2, 0], material: 'wall' });
  else {
    const { y0 = 0.9, y1 = 2.2, z0 = -0.6, z1 = 0.6 } = windowHole, x = -w / 2 - t / 2;
    parts.push({ mesh: box([t, y0, d]), offset: [x, y0 / 2, 0], material: 'wall' });
    parts.push({ mesh: box([t, h - y1, d]), offset: [x, (h + y1) / 2, 0], material: 'wall' });
    parts.push({ mesh: box([t, y1 - y0, z0 + d / 2]), offset: [x, (y0 + y1) / 2, (z0 - d / 2) / 2], material: 'wall' });
    parts.push({ mesh: box([t, y1 - y0, d / 2 - z1]), offset: [x, (y0 + y1) / 2, (z1 + d / 2) / 2], material: 'wall' });
  }
  return parts;
}
