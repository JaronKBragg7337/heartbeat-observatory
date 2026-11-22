// flow.js - the one printing flow (World Printer remake, 2026-11-21, Fable 5.2).
//
// Jaron's idea, taken literally: there is ONE repeatable flow and every part is made of it.
// The flow is a bead of material leaving a nozzle. A part is nothing but the path the nozzle
// takes: layer after layer, each layer a few loops or lines. There are no pre-made models in
// this file - only path recipes. The mesh you see IS the bead swept along that path, and the
// printer on screen follows the very same list of points.
//
// So every shape here is designed around what the flow repeats easily:
//   - walls are a loop and a centre line, stacked
//   - openings close with a pointed arch (each layer leans in a little; no beam, no support)
//   - roofs are vaults and domes for the same reason
//   - round things are a circle whose radius changes per layer
//
// No three.js in here on purpose: it is plain numbers, so it can be tested in Node.

export const W = 0.10;   // bead width, metres
export const H = 0.08;   // layer height, metres
export const GRID = 0.6; // building module, metres

// ---------- path helpers (all in the layer plane: [x, z]) ----------

function rrect(cx, cz, lx, lz, r = 0.035) {
  r = Math.min(r, lx / 2, lz / 2);
  const hx = lx / 2 - r, hz = lz / 2 - r, pts = [];
  const corners = [[hx, hz, 0], [-hx, hz, 90], [-hx, -hz, 180], [hx, -hz, 270]];
  for (const [x, z, a0] of corners) for (let k = 0; k <= 2; k++) {
    const a = (a0 + k * 45) * Math.PI / 180;
    pts.push([cx + x + r * Math.cos(a), cz + z + r * Math.sin(a)]);
  }
  return pts;
}
function circle(cx, cz, rFn, n, phase = 0) {
  const pts = [];
  for (let k = 0; k < n; k++) { const a = phase + k / n * Math.PI * 2; const r = typeof rFn === 'function' ? rFn(a) : rFn; pts.push([cx + r * Math.cos(a), cz + r * Math.sin(a)]); }
  return pts;
}
// back-and-forth fill of a shape; extent(z) gives [x0, x1] of the shape at that z (or null)
function raster(z0, z1, extent, alongZ = false, step = W) {
  const pts = []; let flip = false;
  const n = Math.max(1, Math.round((z1 - z0) / step));
  for (let k = 0; k <= n; k++) {
    const z = z0 + (z1 - z0) * k / n, e = extent(z); if (!e) continue;
    const a = flip ? e[1] : e[0], b = flip ? e[0] : e[1];
    pts.push(alongZ ? [z, a] : [a, z], alongZ ? [z, b] : [b, z]); flip = !flip;
  }
  return pts;
}
const loop = (pts, w) => ({ pts, closed: true, w });
const line = (pts, w) => ({ pts, closed: false, w });
const layersOf = (height) => Math.round(height / H);

// one layer of a straight wall piece from x0 to x1 (thickness T): a loop and a centre bead
function wallRun(x0, x1, T, out) {
  const len = x1 - x0; if (len < W * 1.2) return;
  out.push(loop(rrect((x0 + x1) / 2, 0, len - W, T - W)));
  if (len > W * 4) out.push(line([[x0 + W * 1.5, 0], [x1 - W * 1.5, 0]]));
}
// a wall with an opening that closes in a pointed arch (door when sill = 0, window when sill > 0)
function wallWithOpening(L, T, height, sill, halfW, spring, archH) {
  return () => {
    const n = layersOf(height), layers = [];
    for (let i = 0; i < n; i++) {
      const y = (i + 0.5) * H, out = [];
      let g = 0;
      if (y > sill && y < spring) g = halfW;
      else if (y >= spring && y < spring + archH) g = halfW * Math.cos(Math.PI / 2 * (y - spring) / archH);
      if (g > W * 0.6) { wallRun(-L / 2, -g, T, out); wallRun(g, L / 2, T, out); }
      else wallRun(-L / 2, L / 2, T, out);
      layers.push(out);
    }
    return layers;
  };
}

// ---------- the parts: each is only a recipe of paths ----------
// size = [x, y, z] in metres (for the card); mat = the material it starts with

export const PARTS = [
  { id: 'wall', label: 'Wall', size: [2.4, 2.4, 0.3], why: 'A loop and a centre line, 30 times.',
    build() { const L = []; for (let i = 0; i < layersOf(2.4); i++) { const o = []; wallRun(-1.2, 1.2, 0.3, o); L.push(o); } return L; } },

  { id: 'door', label: 'Door arch', size: [2.4, 2.4, 0.3], why: 'Two piers lean in each layer until they meet. No beam needed.',
    build: wallWithOpening(2.4, 0.3, 2.4, 0, 0.5, 1.2, 0.88) },

  { id: 'window', label: 'Window wall', size: [2.4, 2.4, 0.3], why: 'Same arch, started above a sill.',
    build: wallWithOpening(2.4, 0.3, 2.4, 0.88, 0.36, 1.44, 0.56) },

  { id: 'curve', label: 'Curved wall', size: [2.5, 2.4, 2.5], why: 'The wall loop bent along a quarter circle.',
    build() {
      const R = 2.4, L = [];
      const arc = (r, a0, a1, n) => { const p = []; for (let k = 0; k <= n; k++) { const a = (a0 + (a1 - a0) * k / n) * Math.PI / 180; p.push([r * Math.cos(a), r * Math.sin(a)]); } return p; };
      for (let i = 0; i < layersOf(2.4); i++) L.push([loop([...arc(R + 0.1, 0, 90, 10), ...arc(R - 0.1, 90, 0, 10)]), line(arc(R, 3, 87, 10))]);
      return L;
    } },

  { id: 'gable', label: 'Gable', size: [2.4, 1.2, 0.3], why: 'The wall loop, a little shorter every layer.',
    build() { const n = layersOf(1.2), L = []; for (let i = 0; i < n; i++) { const half = Math.max(0.12, 1.2 * (1 - i / n)); const o = []; wallRun(-half, half, 0.3, o); if (!o.length) o.push(loop(rrect(0, 0, 0.14, 0.2))); L.push(o); } return L; } },

  { id: 'pillar', label: 'Pillar', size: [0.6, 2.4, 0.6], why: 'One circle, stacked, a touch wider at foot and head.',
    build() {
      const n = layersOf(2.4), L = [];
      for (let i = 0; i < n; i++) {
        const u = i / (n - 1); let r = 0.2 - 0.03 * u;
        if (i < 2) r = 0.25; if (i > n - 3) r = 0.22 + 0.03 * (i - (n - 3));
        const o = [loop(circle(0, 0, r, 14, i * 0.05))];
        if (i === n - 1) o.push(line(raster(-r + W, r - W, z => { const x = Math.sqrt(Math.max(0, (r - W * 0.6) ** 2 - z * z)); return [-x, x]; })));
        L.push(o);
      }
      return L;
    } },

  { id: 'slab', label: 'Slab', size: [2.4, 0.16, 2.4], why: 'A border, then back-and-forth lines. Floor, road or roof deck.',
    build() { const L = []; for (let i = 0; i < 2; i++) L.push([loop(rrect(0, 0, 2.4 - W, 2.4 - W)), line(raster(-1.2 + W * 1.5, 1.2 - W * 1.5, () => [-1.2 + W * 1.5, 1.2 - W * 1.5], i % 2 === 0))]); return L; } },

  { id: 'path', label: 'Path strip', size: [1.2, 0.08, 2.4], why: 'One layer of lines. Lay them end to end.', mat: 'basalt',
    build() { return [[loop(rrect(0, 0, 1.2 - W, 2.4 - W)), line(raster(-0.6 + W * 1.5, 0.6 - W * 1.5, () => [-1.2 + W * 1.5, 1.2 - W * 1.5], true))]]; } },

  { id: 'block', label: 'Block', size: [0.6, 0.64, 0.6], why: 'A square loop with a lid of lines.',
    build() { const n = layersOf(0.64), L = []; for (let i = 0; i < n; i++) { const o = [loop(rrect(0, 0, 0.6 - W, 0.6 - W))]; if (i === n - 1) o.push(line(raster(-0.3 + W * 1.5, 0.3 - W * 1.5, () => [-0.3 + W * 1.5, 0.3 - W * 1.5]))); L.push(o); } return L; } },

  { id: 'stairs', label: 'Stairs', size: [1.2, 2.4, 3.0], why: 'A loop that gives up one tread every three layers.',
    build() {
      const n = layersOf(2.4), L = [];
      for (let i = 0; i < n; i++) {
        const s = Math.floor(i / 3), z0 = -1.5 + s * 0.3, o = [loop(rrect(0, (z0 + 1.5) / 2, 1.2 - W, 1.5 - z0 - W))];
        if (i % 3 === 2) { const z1 = Math.min(1.5 - W * 1.5, z0 + 0.3 + W * 1.5); if (z1 > z0 + W * 2) o.push(line(raster(z0 + W * 1.5, z1, () => [-0.6 + W * 1.5, 0.6 - W * 1.5]))); }
        L.push(o);
      }
      return L;
    } },

  { id: 'vault', label: 'Vault roof', size: [2.7, 1.44, 2.4], why: 'Two long loops lean toward each other and close. Sits on two walls.',
    build() {
      const n = layersOf(1.44), L = [];
      for (let i = 0; i < n; i++) {
        const g = 1.2 * Math.cos(Math.PI / 2 * (i / n));
        if (g > 0.13) L.push([loop(rrect(-g, 0, 0.26 - W, 2.4 - W)), loop(rrect(g, 0, 0.26 - W, 2.4 - W))]);
        else L.push([loop(rrect(0, 0, 2 * g + 0.26 - W, 2.4 - W))]);
      }
      return L;
    } },

  { id: 'dome', label: 'Dome', size: [2.6, 1.76, 2.6], why: 'A circle that shrinks every layer until it shuts.',
    build() {
      const n = layersOf(1.76), L = [];
      for (let i = 0; i < n; i++) { const r = 1.2 * Math.cos(Math.PI / 2 * (i / n)); if (r < 0.07) break; L.push([loop(circle(0, 0, r, Math.max(6, Math.min(30, Math.round(2 * Math.PI * r / 0.25))), i * 0.11), 0.16)]); }
      return L;
    } },

  { id: 'ring', label: 'Round wall', size: [2.6, 1.2, 2.6], why: 'Two circles, stacked. Stack rings for a tower, cap with the dome.',
    build() { const L = []; for (let i = 0; i < layersOf(1.2); i++) L.push([loop(circle(0, 0, 1.25, 28)), loop(circle(0, 0, 1.15, 28))]); return L; } },

  { id: 'fence', label: 'Ribbon fence', size: [2.4, 0.96, 0.3], why: 'One wavy line, there and back, there and back.', mat: 'clay',
    build() {
      const L = [];
      for (let i = 0; i < layersOf(0.96); i++) { const p = []; for (let k = 0; k <= 32; k++) { const x = -1.2 + 2.4 * k / 32; p.push([x, 0.1 * Math.sin(x / 0.6 * Math.PI * 2)]); } if (i % 2) p.reverse(); L.push([line(p)]); }
      return L;
    } },

  { id: 'planter', label: 'Planter', size: [1.0, 0.72, 1.0], why: 'A circle that swells, ripples and turns as it climbs.', mat: 'clay',
    build() {
      const n = layersOf(0.72), L = [];
      for (let i = 0; i < n; i++) {
        const u = i / (n - 1), base = 0.3 + 0.13 * Math.sin(u * 2.6 + 0.3);
        const o = [loop(circle(0, 0, a => base * (1 + 0.07 * Math.cos(6 * a + u * 2.2)), 24))];
        if (i === 0) o.push(line(raster(-base + W, base - W, z => { const x = Math.sqrt(Math.max(0, (base - W * 0.9) ** 2 - z * z)); return [-x, x]; })));
        L.push(o);
      }
      return L;
    } },
];

// ---------- your own part: the same flow with the numbers left open ----------
// id = "spin~sides~width~layers~lean~twist~waves~lid" (whole numbers). One loop, changed a little
// each layer. A real printer cannot lean a layer out further than about half a bead, so neither can
// this: the radius may change by at most 6 cm per layer, whatever the sliders ask for.
function polyExtent(P, inset) {
  return (z) => {
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length];
      if ((a[1] - z) * (b[1] - z) > 0 || a[1] === b[1]) continue;
      const x = a[0] + (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]); if (x < lo) lo = x; if (x > hi) hi = x;
    }
    return hi - lo > inset * 2 + W * 0.5 ? [lo + inset, hi - inset] : null;
  };
}
const customCache = new Map();
export function customPart(id) {
  const a = String(id).split('~'); if (a[0] !== 'spin') return null;
  const I = (k, lo, hi, d) => { const v = parseInt(a[k], 10); return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; };
  let n = I(1, 0, 8, 0); if (n > 0 && n < 3) n = 3;
  const w = I(2, 4, 24, 10), h = I(3, 3, 40, 15), t = I(4, -5, 5, 0), q = I(5, 0, 9, 0), v = I(6, 0, 4, 0), lid = I(7, 0, 1, 0);
  const key = ['spin', n, w, h, t, q, v, lid].join('~');
  if (customCache.has(key)) return customCache.get(key);
  const sides = n ? n : 20, r0 = w / 20, radii = [];
  let r = r0;
  for (let i = 0; i < h; i++) {
    const target = (r0 + i * t * 0.012) * (1 + 0.14 * Math.sin(2 * Math.PI * v * i / h));
    if (i > 0) r += Math.max(-0.06, Math.min(0.06, target - r));
    r = Math.min(1.4, r); if (r < 0.08) break; radii.push(r);
  }
  const rmax = Math.max(...radii), wide = Math.round(rmax * 20 + 1) / 10;
  const part = {
    id: key, label: 'Own shape', custom: true, size: [wide, +(radii.length * H).toFixed(2), wide],
    why: 'One loop, changed a little each layer. A layer can only lean half a bead, like a real printer.',
    build() {
      return radii.map((rad, i) => {
        const P = circle(0, 0, rad, sides, i * q * 0.012 + (n === 4 ? Math.PI / 4 : 0)), o = [loop(P)];
        if (lid && (i === 0 || i === radii.length - 1)) { const zs = P.map(p => p[1]); const ras = raster(Math.min(...zs) + W, Math.max(...zs) - W, polyExtent(P, W * 0.9)); if (ras.length > 1) o.push(line(ras)); }
        return o;
      });
    },
  };
  if (customCache.size > 400) customCache.clear();
  customCache.set(key, part); return part;
}

// ---------- the mesher: sweep the bead along the path ----------
// Returns typed arrays ready for a BufferGeometry, plus the nozzle route (pts + cum distance).
// attribute "dist" = how far along the whole route each vertex was laid: the page reveals the
// part by comparing it with how far the nozzle has travelled, so the bead grows smoothly.

function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }

export function meshPart(part) {
  const layers = part.build();
  const pos = [], nor = [], col = [], dist = [], idx = [];
  const route = [], cum = [];
  let d = 0, last = null, vcount = 0;
  const bb = { min: [1e9, 0, 1e9], max: [-1e9, 0, -1e9] };
  const visit = (x, y, z) => { if (last) d += Math.hypot(x - last[0], y - last[1], z - last[2]); last = [x, y, z]; route.push(x, y, z); cum.push(d); };

  layers.forEach((paths, li) => {
    const yc = (li + 0.5) * H;
    for (const path of paths) {
      const P = path.pts, N = P.length, w = path.w || W; if (N < 2) continue;
      const rings = path.closed ? N + 1 : N;
      const tone = 0.9 + 0.1 * hash(li * 7.3 + N);
      for (let j = 0; j < rings; j++) {
        const c = P[j % N];
        const pv = path.closed ? P[(j - 1 + N) % N] : P[Math.max(0, j - 1)];
        const nx = path.closed ? P[(j + 1) % N] : P[Math.min(N - 1, j + 1)];
        let ax = c[0] - pv[0], az = c[1] - pv[1], bx = nx[0] - c[0], bz = nx[1] - c[1];
        let al = Math.hypot(ax, az), bl = Math.hypot(bx, bz);
        if (al < 1e-6) { ax = bx; az = bz; al = bl; } if (bl < 1e-6) { bx = ax; bz = az; bl = al; }
        ax /= al; az /= al; bx /= bl; bz /= bl;
        // side normals of both segments, then the mitre between them
        let mx = az + bz, mz = -ax - bx; const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml;
        const k = 1 / Math.max(0.5, mx * az + mz * -ax);
        const sx = mx * w / 2 * k, sz = mz * w / 2 * k;
        visit(c[0], yc, c[1]);
        const shade = tone * (0.94 + 0.06 * hash(li * 3.1 + j * 0.37 + c[0] * 5.1));
        // cross-section of a real bead: pressed flat on top and bottom, bulging at the sides
        const fx = sx * 0.6, fz = sz * 0.6, e = 0.35;
        const ring = [[sx, 0, sz, mx, 0, mz], [fx, H / 2, fz, mx * e, 1, mz * e], [-fx, H / 2, -fz, -mx * e, 1, -mz * e], [-sx, 0, -sz, -mx, 0, -mz], [-fx, -H / 2, -fz, -mx * e, -1, -mz * e], [fx, -H / 2, fz, mx * e, -1, mz * e]];
        for (const v of ring) {
          const px = c[0] + v[0], py = yc + v[1], pz = c[1] + v[2];
          pos.push(px, py, pz);
          const nl = Math.hypot(v[3], v[4], v[5]); nor.push(v[3] / nl, v[4] / nl, v[5] / nl);
          col.push(shade, shade, shade); dist.push(d);
          if (px < bb.min[0]) bb.min[0] = px; if (px > bb.max[0]) bb.max[0] = px;
          if (pz < bb.min[2]) bb.min[2] = pz; if (pz > bb.max[2]) bb.max[2] = pz;
          if (py > bb.max[1]) bb.max[1] = py;
        }
        if (j > 0) {
          const a = vcount - 6, b = vcount;
          for (let q = 0; q < 6; q++) { const q1 = (q + 1) % 6; idx.push(a + q, a + q1, b + q, a + q1, b + q1, b + q); }
        }
        vcount += 6;
      }
    }
  });
  return {
    position: new Float32Array(pos), normal: new Float32Array(nor), color: new Float32Array(col), dist: new Float32Array(dist),
    index: vcount > 65535 ? new Uint32Array(idx) : new Uint16Array(idx),
    route: new Float32Array(route), cum: new Float32Array(cum), length: d, layers: layers.length, bbox: bb, tris: idx.length / 3,
  };
}

// where the nozzle is after travelling distance d along a meshed part's route -> [x, y, z]
export function nozzleAt(m, d, out = [0, 0, 0]) {
  const c = m.cum, n = c.length; if (!n) return out;
  if (d <= 0) { out[0] = m.route[0]; out[1] = m.route[1]; out[2] = m.route[2]; return out; }
  if (d >= c[n - 1]) { out[0] = m.route[n * 3 - 3]; out[1] = m.route[n * 3 - 2]; out[2] = m.route[n * 3 - 1]; return out; }
  let lo = 0, hi = n - 1; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (c[mid] <= d) lo = mid; else hi = mid; }
  const t = (d - c[lo]) / Math.max(1e-6, c[hi] - c[lo]);
  for (let k = 0; k < 3; k++) out[k] = m.route[lo * 3 + k] + (m.route[hi * 3 + k] - m.route[lo * 3 + k]) * t;
  return out;
}
