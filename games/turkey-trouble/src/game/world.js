// The map as rules: collision, sliding, line of sight, surfaces and a coarse nav grid with A*.
// Plain numbers only ({x, z}); never imports three, so every mode runs headless in Node.

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const FENCE_HALF = 0.06;

export function makeWorld(layout) {
  const boxes = [], circles = [], segs = [];
  for (const c of layout.colliders) {
    if (c.type === 'box') {
      const th = c.rotY || 0;
      boxes.push({ id: c.id, x: c.x, z: c.z, hw: c.w / 2, hd: c.d / 2, c: Math.cos(th), s: Math.sin(th), h: c.h ?? 2 });
    } else {
      circles.push({ id: c.id, x: c.x, z: c.z, r: c.r, h: c.h ?? 2 });
    }
  }
  for (const f of layout.fences || []) {
    const dx = f.x2 - f.x1, dz = f.z2 - f.z1;
    segs.push({ id: f.id, x1: f.x1, z1: f.z1, x2: f.x2, z2: f.z2, dx, dz, len2: dx * dx + dz * dz || 1e-9 });
  }
  const arena = layout.arena;
  const surfaces = layout.surfaces || [];

  // Push a circle (p.x, p.z, radius r) out of every collider; three passes give a clean slide along corners.
  function collide(p, r, useFences = true) {
    let hit = false;
    for (let pass = 0; pass < 3; pass++) {
      let moved = false;
      for (let i = 0; i < circles.length; i++) {
        const c = circles[i];
        const dx = p.x - c.x, dz = p.z - c.z, rr = c.r + r, d2 = dx * dx + dz * dz;
        if (d2 >= rr * rr) continue;
        const d = Math.sqrt(d2);
        if (d > 1e-6) { p.x = c.x + (dx / d) * rr; p.z = c.z + (dz / d) * rr; }
        else { p.x = c.x + rr; }
        moved = hit = true;
      }
      for (let i = 0; i < boxes.length; i++) {
        const b = boxes[i];
        const dx = p.x - b.x, dz = p.z - b.z;
        if (Math.abs(dx) > b.hw + b.hd + r && Math.abs(dz) > b.hw + b.hd + r) continue;
        const lx = dx * b.c - dz * b.s, lz = dx * b.s + dz * b.c;
        const cx = clamp(lx, -b.hw, b.hw), cz = clamp(lz, -b.hd, b.hd);
        let ex = lx - cx, ez = lz - cz;
        const d2 = ex * ex + ez * ez;
        if (d2 >= r * r) continue;
        let px, pz;
        if (d2 > 1e-10) {
          const d = Math.sqrt(d2), k = (r - d) / d; px = ex * k; pz = ez * k;
        } else {                                       // centre inside the box: leave by the nearest face
          const ox = b.hw - Math.abs(lx) + r, oz = b.hd - Math.abs(lz) + r;
          if (ox < oz) { px = lx >= 0 ? ox : -ox; pz = 0; } else { px = 0; pz = lz >= 0 ? oz : -oz; }
        }
        p.x += px * b.c + pz * b.s; p.z += -px * b.s + pz * b.c;
        moved = hit = true;
      }
      if (useFences) {
        for (let i = 0; i < segs.length; i++) {
          const s = segs[i];
          let t = ((p.x - s.x1) * s.dx + (p.z - s.z1) * s.dz) / s.len2; t = clamp(t, 0, 1);
          const qx = s.x1 + s.dx * t, qz = s.z1 + s.dz * t;
          const dx = p.x - qx, dz = p.z - qz, rr = r + FENCE_HALF, d2 = dx * dx + dz * dz;
          if (d2 >= rr * rr) continue;
          const d = Math.sqrt(d2);
          if (d > 1e-6) { p.x = qx + (dx / d) * rr; p.z = qz + (dz / d) * rr; }
          else { const L = Math.sqrt(s.len2); p.x = qx - (s.dz / L) * rr; p.z = qz + (s.dx / L) * rr; }
          moved = hit = true;
        }
      }
      if (!moved) break;
    }
    return hit;
  }

  // Is this circle free of every collider (and fence)?
  function blocked(x, z, r, useFences = true) {
    for (const c of circles) { const dx = x - c.x, dz = z - c.z, rr = c.r + r; if (dx * dx + dz * dz < rr * rr) return c.id; }
    for (const b of boxes) {
      const dx = x - b.x, dz = z - b.z;
      const lx = dx * b.c - dz * b.s, lz = dx * b.s + dz * b.c;
      const ex = lx - clamp(lx, -b.hw, b.hw), ez = lz - clamp(lz, -b.hd, b.hd);
      if (ex * ex + ez * ez < r * r) return b.id;
    }
    if (useFences) for (const s of segs) {
      const t = clamp(((x - s.x1) * s.dx + (z - s.z1) * s.dz) / s.len2, 0, 1);
      const dx = x - (s.x1 + s.dx * t), dz = z - (s.z1 + s.dz * t), rr = r + FENCE_HALF;
      if (dx * dx + dz * dz < rr * rr) return s.id;
    }
    return null;
  }

  // First hit along a segment a->b (0..1), against colliders at least minH tall. 1 = clear. Fences are see-through rails.
  function raycast(ax, az, bx, bz, minH = 0, pad = 0) {
    let best = 1;
    const dx = bx - ax, dz = bz - az;
    for (const c of circles) {
      if (c.h < minH) continue;
      const fx = ax - c.x, fz = az - c.z, rr = c.r + pad;
      const A = dx * dx + dz * dz; if (A < 1e-12) continue;
      const B = 2 * (fx * dx + fz * dz), C = fx * fx + fz * fz - rr * rr;
      if (C <= 0) { best = 0; continue; }
      const disc = B * B - 4 * A * C; if (disc < 0) continue;
      const t = (-B - Math.sqrt(disc)) / (2 * A);
      if (t >= 0 && t < best) best = t;
    }
    for (const b of boxes) {
      if (b.h < minH) continue;
      const ox = ax - b.x, oz = az - b.z;
      const lax = ox * b.c - oz * b.s, laz = ox * b.s + oz * b.c;
      const ldx = dx * b.c - dz * b.s, ldz = dx * b.s + dz * b.c;
      const hw = b.hw + pad, hd = b.hd + pad;
      let t0 = 0, t1 = 1;
      if (Math.abs(ldx) < 1e-12) { if (lax < -hw || lax > hw) continue; }
      else { let u = (-hw - lax) / ldx, v = (hw - lax) / ldx; if (u > v) { const w = u; u = v; v = w; } if (u > t0) t0 = u; if (v < t1) t1 = v; if (t0 > t1) continue; }
      if (Math.abs(ldz) < 1e-12) { if (laz < -hd || laz > hd) continue; }
      else { let u = (-hd - laz) / ldz, v = (hd - laz) / ldz; if (u > v) { const w = u; u = v; v = w; } if (u > t0) t0 = u; if (v < t1) t1 = v; if (t0 > t1) continue; }
      if (t0 < best) best = t0;
    }
    return best;
  }
  const losClear = (ax, az, bx, bz, minH = 1.0) => raycast(ax, az, bx, bz, minH) >= 1;

  function surfaceAt(x, z) {
    let kind = 'grass';
    for (const s of surfaces) if (x >= s.minX && x <= s.maxX && z >= s.minZ && z <= s.maxZ) { kind = s.kind; break; }
    const lanes = layout.escape && layout.escape.lanes;
    if (lanes) for (const l of lanes) {
      if (l.kind === 'yard' || z < l.z0 || z > l.z1) continue;
      if (l.kind === 'road') return l.id === 'gravel' ? 'gravel' : 'asphalt';
      if (l.kind === 'creek') return 'water';
      if (l.kind === 'field') return 'stubble';
      if (l.kind === 'lane') return 'dirt';
    }
    return kind;
  }

  function clampArena(p, r) {
    p.x = clamp(p.x, arena.minX + r, arena.maxX - r);
    p.z = clamp(p.z, arena.minZ + r, arena.maxZ - r);
  }

  // Nearest free spot to (x, z) for radius r: the layout may put a point a little inside something.
  function freeSpot(x, z, r, out = { x, z }) {
    out.x = x; out.z = z;
    if (!blocked(out.x, out.z, r)) return out;
    collide(out, r);
    if (!blocked(out.x, out.z, r)) return out;
    for (let ring = 1; ring <= 12; ring++) {
      const R = ring * 0.25;
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2, px = x + Math.cos(a) * R, pz = z + Math.sin(a) * R;
        if (!blocked(px, pz, r)) { out.x = px; out.z = pz; return out; }
      }
    }
    return out;
  }

  // Roofs: where a camera must not go (inside a building whose door is open in the colliders).
  // layout.roofs = [{ minX, maxX, minZ, maxZ, h }] if the look gives them; otherwise every group of 3 or more box
  // colliders sharing an id prefix ("barn_west", "barn_east", ...) is one building.
  const roofs = (layout.roofs || deriveRoofs(layout.colliders)).map((r) => ({ ...r }));
  function raycastRoofs(ax, az, bx, bz) {
    let best = 1;
    const dx = bx - ax, dz = bz - az;
    for (const r of roofs) {
      if (ax > r.minX && ax < r.maxX && az > r.minZ && az < r.maxZ) continue;   // you are inside: the walls take care of it
      let t0 = 0, t1 = 1, ok = true;
      for (const [o, d, lo, hi] of [[ax, dx, r.minX, r.maxX], [az, dz, r.minZ, r.maxZ]]) {
        if (Math.abs(d) < 1e-12) { if (o < lo || o > hi) { ok = false; break; } continue; }
        let u = (lo - o) / d, v = (hi - o) / d; if (u > v) { const w = u; u = v; v = w; }
        if (u > t0) t0 = u; if (v < t1) t1 = v; if (t0 > t1) { ok = false; break; }
      }
      if (ok && t0 < best) best = t0;
    }
    return best;
  }

  return { layout, boxes, circles, segs, arena, roofs, collide, blocked, raycast, raycastRoofs, losClear, surfaceAt, clampArena, freeSpot };
}

function deriveRoofs(colliders) {
  const groups = new Map();
  for (const c of colliders) {
    if (c.type !== 'box' || !c.id || c.id.indexOf('_') < 0) continue;
    const k = c.id.split('_')[0];
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(c);
  }
  const out = [];
  for (const [id, list] of groups) {
    if (list.length < 3) continue;
    let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9, h = 0;
    for (const c of list) {
      const th = c.rotY || 0, ex = Math.abs(c.w / 2 * Math.cos(th)) + Math.abs(c.d / 2 * Math.sin(th)), ez = Math.abs(c.w / 2 * Math.sin(th)) + Math.abs(c.d / 2 * Math.cos(th));
      minX = Math.min(minX, c.x - ex); maxX = Math.max(maxX, c.x + ex); minZ = Math.min(minZ, c.z - ez); maxZ = Math.max(maxZ, c.z + ez); h = Math.max(h, c.h || 3);
    }
    out.push({ id, minX, maxX, minZ, maxZ, h });
  }
  return out;
}

// ------------------------------------------------------------------------------------------- nav grid + A*
// One coarse grid over a rectangle. All memory is allocated once; findPath allocates nothing.
export function makeNav(world, rect, cell = 0.5, agentR = 0.35) {
  const cols = Math.ceil((rect.maxX - rect.minX) / cell), rows = Math.ceil((rect.maxZ - rect.minZ) / cell);
  const N = cols * rows;
  const solid = new Uint8Array(N);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const x = rect.minX + (i + 0.5) * cell, z = rect.minZ + (j + 0.5) * cell;
    if (world.blocked(x, z, agentR)) solid[j * cols + i] = 1;
  }
  const g = new Float32Array(N), f = new Float32Array(N), parent = new Int32Array(N);
  const seen = new Uint32Array(N), closed = new Uint32Array(N);
  const heap = new Int32Array(N * 2);
  let gen = 0, heapN = 0;
  const raw = new Int32Array(N);

  const cellOf = (x, z) => {
    const i = Math.floor((x - rect.minX) / cell), j = Math.floor((z - rect.minZ) / cell);
    if (i < 0 || j < 0 || i >= cols || j >= rows) return -1;
    return j * cols + i;
  };
  const cx = (k) => rect.minX + ((k % cols) + 0.5) * cell;
  const cz = (k) => rect.minZ + (Math.floor(k / cols) + 0.5) * cell;
  const free = (k) => k >= 0 && !solid[k];

  function nearestFree(x, z) {
    let k = cellOf(clamp(x, rect.minX + 0.01, rect.maxX - 0.01), clamp(z, rect.minZ + 0.01, rect.maxZ - 0.01));
    if (free(k)) return k;
    const i0 = k % cols, j0 = Math.floor(k / cols);
    for (let R = 1; R < 24; R++) {
      let best = -1, bd = 1e9;
      for (let dj = -R; dj <= R; dj++) for (let di = -R; di <= R; di++) {
        if (Math.abs(di) !== R && Math.abs(dj) !== R) continue;
        const i = i0 + di, j = j0 + dj; if (i < 0 || j < 0 || i >= cols || j >= rows) continue;
        const kk = j * cols + i; if (solid[kk]) continue;
        const d = di * di + dj * dj; if (d < bd) { bd = d; best = kk; }
      }
      if (best >= 0) return best;
    }
    return -1;
  }

  function push(k) {
    let i = heapN++; heap[i] = k;
    while (i > 0) { const p = (i - 1) >> 1; if (f[heap[p]] <= f[heap[i]]) break; const t = heap[p]; heap[p] = heap[i]; heap[i] = t; i = p; }
  }
  function pop() {
    const top = heap[0]; heap[0] = heap[--heapN];
    let i = 0;
    for (;;) {
      const l = i * 2 + 1, r = l + 1; let m = i;
      if (l < heapN && f[heap[l]] < f[heap[m]]) m = l;
      if (r < heapN && f[heap[r]] < f[heap[m]]) m = r;
      if (m === i) break; const t = heap[m]; heap[m] = heap[i]; heap[i] = t; i = m;
    }
    return top;
  }

  // Straight line clear on the grid (for path smoothing).
  function lineFree(ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az, d = Math.hypot(dx, dz), n = Math.max(1, Math.ceil(d / (cell * 0.5)));
    for (let s = 0; s <= n; s++) { const k = cellOf(ax + (dx * s) / n, az + (dz * s) / n); if (!free(k)) return false; }
    return true;
  }

  // Fills out.pts[0..out.n) with smoothed waypoints from start to goal (excluding the start). Returns true if a path exists.
  function findPath(sx, sz, gx, gz, out) {
    out.n = 0;
    const s = nearestFree(sx, sz), t = nearestFree(gx, gz);
    if (s < 0 || t < 0) return false;
    if (s === t || lineFree(sx, sz, gx, gz)) { setPt(out, 0, gx, gz); out.n = 1; return true; }
    gen++; heapN = 0;
    const tx = t % cols, tj = Math.floor(t / cols);
    const h = (k) => { const ax = Math.abs((k % cols) - tx), az = Math.abs(Math.floor(k / cols) - tj); return (ax + az + (Math.SQRT2 - 2) * Math.min(ax, az)) * cell; };
    g[s] = 0; f[s] = h(s); parent[s] = -1; seen[s] = gen; push(s);
    let found = false, iter = 0;
    while (heapN > 0 && iter++ < N) {
      const k = pop();
      if (closed[k] === gen) continue;
      closed[k] = gen;
      if (k === t) { found = true; break; }
      const i = k % cols, j = (k - i) / cols;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) continue;
        const nk = nj * cols + ni; if (solid[nk] || closed[nk] === gen) continue;
        if (di && dj && (solid[j * cols + ni] || solid[nj * cols + i])) continue;   // no corner cutting
        const ng = g[k] + (di && dj ? Math.SQRT2 : 1) * cell;
        if (seen[nk] !== gen || ng < g[nk]) { seen[nk] = gen; g[nk] = ng; f[nk] = ng + h(nk); parent[nk] = k; push(nk); }
      }
    }
    if (!found) return false;
    let n = 0; for (let k = t; k !== -1 && n < N; k = parent[k]) raw[n++] = k;
    // raw is goal..start. String-pull: from the start, jump to the farthest cell we can see in a straight line.
    const goalIsCell = cellOf(gx, gz) === t;
    let curX = sx, curZ = sz, idx = n - 1;
    while (idx > 0) {
      let far = idx - 1;
      for (let m = idx - 2; m >= 0; m--) { if (lineFree(curX, curZ, cx(raw[m]), cz(raw[m]))) far = m; else break; }
      if (far === 0 && goalIsCell) { curX = gx; curZ = gz; } else { curX = cx(raw[far]); curZ = cz(raw[far]); }
      setPt(out, out.n++, curX, curZ);
      idx = far;
      if (out.n >= out.pts.length) break;
    }
    if (out.n === 0) { setPt(out, 0, cx(t), cz(t)); out.n = 1; }
    return true;
  }
  function setPt(out, i, x, z) { const p = out.pts[i]; p.x = x; p.z = z; }

  return { cols, rows, cell, rect, solid, cellOf, free, nearestFree, findPath, lineFree };
}

export function makePath(max = 64) {
  const pts = []; for (let i = 0; i < max; i++) pts.push({ x: 0, z: 0 });
  return { pts, n: 0, i: 0 };
}

// Shared nav cache: one grid per layout object (building it costs a few ms).
const navCache = new WeakMap();
export function arenaNav(world) {
  let nav = navCache.get(world);
  if (!nav) {
    const a = world.arena;
    nav = makeNav(world, { minX: a.minX, maxX: a.maxX, minZ: a.minZ, maxZ: a.maxZ }, 0.5, 0.38);
    navCache.set(world, nav);
  }
  return nav;
}

const worldCache = new WeakMap();
export function worldFor(layout) {
  let w = worldCache.get(layout);
  if (!w) { w = makeWorld(layout); worldCache.set(layout, w); }
  return w;
}
