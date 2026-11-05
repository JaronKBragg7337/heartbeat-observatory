// WORLD 2 - "the real city" (remake Phase 1, 2026-11-05). See /WORLD2-REMAKE.md.
// A Fort Wayne-style downtown, interpreted (not a map): a street grid with real street names, sidewalks + curbs,
// crosswalks, lamps, signals, parked and moving cars, a river with a promenade and a truss bridge, and buildings
// made from a small KIT of reusable pieces (punched windows with real reveals, storefronts with recessed doors,
// cornices, setbacks, rooftop units). Every piece is merged into a few big meshes per material per chunk, so the
// whole downtown costs about as many draw calls as the old box city did.
//
// Coordinates: x = east, z = south (north is -z; the river is north). Street centre lines are at GRID.xs / GRID.zs.
// The building kit works in a LOCAL frame per lot: x along the frontage, y up, z into the lot (front face at z=0 faces
// the street). quad() checks winding against the intended normal, so faces can be listed in any cyclic order.

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.module.js";

// ---------------------------------------------------------------------------------------------------------------
// layout
// ---------------------------------------------------------------------------------------------------------------
export const GRID = {
  xs: [-156, -104, -52, 0, 52, 104, 156],
  zs: [-104, -52, 0, 52, 104, 156],
  xNames: ["Ewing St", "Webster St", "Harrison St", "Calhoun St", "Clinton St", "Barr St", "Lafayette St"],
  zNames: ["Superior St", "Main St", "Berry St", "Wayne St", "Jefferson Blvd", "Lewis St"],
};
export const ROAD = 5.5;          // half road width (curb line)
export const WALK = 3.5;          // sidewalk width
export const CURB = 0.15;         // sidewalk top
const SET = ROAD + WALK;          // street centre line -> building line
export const CITY_RECT = { x0: -170, x1: 170, z0: -122, z1: 170 };   // flat ground; terrain blends outside
export const WALL_Z = -122;       // river wall (top of the promenade)
export const RIVER = { zN: -176, zS: -122, y: -1.7 };
export const BRIDGE = { x: -52, half: 2.6, z0: -182, z1: -121, y: 0.42 };
const LANE = 1.7;                 // travel lane centre offset from the street centre line
const PARK = 4.3;                 // parking lane centre offset

// ---------------------------------------------------------------------------------------------------------------
// small utils
// ---------------------------------------------------------------------------------------------------------------
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const _c = new THREE.Color();
function lin(hex, mul = 1) { _c.setHex(hex); return [_c.r * mul, _c.g * mul, _c.b * mul]; }
function mulc(c, m) { return [c[0] * m, c[1] * m, c[2] * m]; }
const WHITE = [1, 1, 1];
const pick = (R, arr) => arr[Math.floor(R() * arr.length) % arr.length];

// ---------------------------------------------------------------------------------------------------------------
// merged-geometry batches: one per (material, chunk). Chunks let the camera cull whole districts.
// ---------------------------------------------------------------------------------------------------------------
const CHUNK = 104;
function chunkKey(x, z) { return Math.floor((x + 208) / CHUNK) + "_" + Math.floor((z + 208) / CHUNK); }
let batches = new Map();
// Phase 2 LOD: while DET is on, triangles go to a batch's DETAIL index list (sills, lintels, mullions, rooftop units,
// tanks, door recesses, cornice under-bands). flush() puts them after the main triangles, so a far chunk draws the same
// mesh with a shorter drawRange: same draw calls, fewer triangles. lodUpdate() picks the range by distance.
let DET = false;
const detail = (fn) => { const was = DET; DET = true; try { fn(); } finally { DET = was; } };
function batch(mat, ck) {
  const k = mat + "|" + ck; let b = batches.get(k);
  if (!b) { b = { mat, p: [], n: [], u: [], c: [], i: [], v: 0 }; batches.set(k, b); }
  return b;
}
// current local frame: world = O + lx*a - lz*f (+ oy), a = (-fz, fx). All four facings are proper rotations.
const X = { ox: 0, oy: 0, oz: 0, ax: 1, az: 0, fx: 0, fz: -1, ck: "0_0" };
function setFrame(ox, oy, oz, fx, fz) { X.ox = ox; X.oy = oy; X.oz = oz; X.fx = fx; X.fz = fz; X.ax = -fz; X.az = fx; X.ck = chunkKey(ox, oz); }
function setWorldFrame(ck) { X.ox = 0; X.oy = 0; X.oz = 0; X.fx = 0; X.fz = -1; X.ax = 1; X.az = 0; X.ck = ck; }
function wp(p) { return [X.ox + p[0] * X.ax - p[2] * X.fx, X.oy + p[1], X.oz + p[0] * X.az - p[2] * X.fz]; }
function wn(n) { return [n[0] * X.ax - n[2] * X.fx, n[1], n[0] * X.az - n[2] * X.fz]; }

function quad(mat, p0, p1, p2, p3, n, uv, col) {
  const b = batch(mat, X.ck);
  const a = wp(p0), bb = wp(p1), c = wp(p2), d = wp(p3), nn = wn(n);
  const e1x = bb[0] - a[0], e1y = bb[1] - a[1], e1z = bb[2] - a[2], e2x = c[0] - a[0], e2y = c[1] - a[1], e2z = c[2] - a[2];
  const flip = (e1y * e2z - e1z * e2y) * nn[0] + (e1z * e2x - e1x * e2z) * nn[1] + (e1x * e2y - e1y * e2x) * nn[2] < 0;
  const base = b.v;
  b.p.push(a[0], a[1], a[2], bb[0], bb[1], bb[2], c[0], c[1], c[2], d[0], d[1], d[2]);
  for (let k = 0; k < 4; k++) { b.n.push(nn[0], nn[1], nn[2]); b.c.push(col[0], col[1], col[2]); }
  b.u.push(uv[0], uv[1], uv[2], uv[3], uv[4], uv[5], uv[6], uv[7]);
  const I = DET ? (b.d || (b.d = [])) : b.i;
  if (!flip) I.push(base, base + 1, base + 2, base, base + 2, base + 3);
  else I.push(base, base + 2, base + 1, base, base + 3, base + 2);
  b.v += 4;
}

// axis-aligned box in the current frame. faces: f(-z) b(+z) l(-x) r(+x) t(+y) d(-y)
function box(mat, x0, y0, z0, x1, y1, z1, col, faces = "fblrt") {
  if (x0 > x1) [x0, x1] = [x1, x0]; if (y0 > y1) [y0, y1] = [y1, y0]; if (z0 > z1) [z0, z1] = [z1, z0];
  if (faces.includes("f")) quad(mat, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], [-x1, y0, -x0, y0, -x0, y1, -x1, y1], col);
  if (faces.includes("b")) quad(mat, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], [x0, y0, x1, y0, x1, y1, x0, y1], col);
  if (faces.includes("r")) quad(mat, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], [-z1, y0, -z0, y0, -z0, y1, -z1, y1], col);
  if (faces.includes("l")) quad(mat, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], [z0, y0, z1, y0, z1, y1, z0, y1], col);
  if (faces.includes("t")) quad(mat, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], [x0, z1, x1, z1, x1, z0, x0, z0], col);
  if (faces.includes("d")) quad(mat, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], [x0, z0, x1, z0, x1, z1, x0, z1], col);
}

// append a THREE geometry (cylinders, domes) in WORLD space
const _m3 = new THREE.Matrix3(), _v = new THREE.Vector3();
function addGeo(mat, geo, matrix, col) {
  const e = matrix.elements; const ck = chunkKey(e[12], e[14]);
  const b = batch(mat, ck); const g = geo.index ? geo : geo; const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
  _m3.getNormalMatrix(matrix); const base = b.v;
  for (let k = 0; k < pos.count; k++) {
    _v.fromBufferAttribute(pos, k).applyMatrix4(matrix); b.p.push(_v.x, _v.y, _v.z);
    _v.fromBufferAttribute(nor, k).applyMatrix3(_m3).normalize(); b.n.push(_v.x, _v.y, _v.z);
    b.u.push(uv ? uv.getX(k) * 2 : 0, uv ? uv.getY(k) * 2 : 0); b.c.push(col[0], col[1], col[2]);
  }
  const I = DET ? (b.d || (b.d = [])) : b.i;
  if (g.index) for (let k = 0; k < g.index.count; k++) I.push(base + g.index.getX(k));
  else for (let k = 0; k < pos.count; k++) I.push(base + k);
  b.v += pos.count;
}

function flush(group, mats, noShadow) {
  const meshes = [];
  for (const b of batches.values()) {
    if (!b.v) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(b.p, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(b.n, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(b.u, 2));
    g.setAttribute("color", new THREE.Float32BufferAttribute(b.c, 3));
    const idx = b.d ? b.i.concat(b.d) : b.i;
    g.setIndex(b.v > 65000 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    const m = new THREE.Mesh(g, mats[b.mat]);
    // Phase 2: only walls, glass and big masses cast shadows; small metal/dark trim does not (it was a third of the shadow pass)
    m.castShadow = !(noShadow && noShadow.has(b.mat)) && b.mat !== "metal" && b.mat !== "dark"; m.receiveShadow = true; m.userData.kit = b.mat;
    m.userData.lod = b.d && b.d.length ? { main: b.i.length, all: idx.length, far: false } : null;
    group.add(m); meshes.push(m);
  }
  batches = new Map();
  return meshes;
}

// ---------------------------------------------------------------------------------------------------------------
// facade frames: (s along the face to the viewer's right, y up, p depth INTO the wall). R x up = N (outward).
// ---------------------------------------------------------------------------------------------------------------
function frames(x0, z0, x1, z1) {
  return {
    f: { L: x1 - x0, M: (s, y, p) => [x1 - s, y, z0 + p], R: [-1, 0, 0], N: [0, 0, -1] },
    l: { L: z1 - z0, M: (s, y, p) => [x0 + p, y, z0 + s], R: [0, 0, 1], N: [-1, 0, 0] },
    r: { L: z1 - z0, M: (s, y, p) => [x1 - p, y, z1 - s], R: [0, 0, -1], N: [1, 0, 0] },
    b: { L: x1 - x0, M: (s, y, p) => [x0 + s, y, z1 - p], R: [1, 0, 0], N: [0, 0, 1] },
  };
}
const neg = (v) => [-v[0], -v[1], -v[2]];
function frect(F, s0, s1, y0, y1, p, mat, col, uv) {
  quad(mat, F.M(s0, y0, p), F.M(s1, y0, p), F.M(s1, y1, p), F.M(s0, y1, p), F.N, uv || [s0, y0, s1, y0, s1, y1, s0, y1], col);
}
function fside(F, s, y0, y1, p0, p1, faceRight, mat, col) {
  quad(mat, F.M(s, y0, p0), F.M(s, y0, p1), F.M(s, y1, p1), F.M(s, y1, p0), faceRight ? F.R : neg(F.R), [p0, y0, p1, y0, p1, y1, p0, y1], col);
}
function fhoriz(F, s0, s1, y, p0, p1, up, mat, col) {
  quad(mat, F.M(s0, y, p0), F.M(s1, y, p0), F.M(s1, y, p1), F.M(s0, y, p1), up ? [0, 1, 0] : [0, -1, 0], [s0, p0, s1, p0, s1, p1, s0, p1], col);
}
// box in facade coords; p0 < p1 (negative p = sticking out of the wall). faces: f t d l r
function fbox(F, s0, s1, y0, y1, p0, p1, mat, col, faces = "ftlr") {
  if (faces.includes("f")) frect(F, s0, s1, y0, y1, p0, mat, col);
  if (faces.includes("t")) fhoriz(F, s0, s1, y1, p0, p1, true, mat, mulc(col, 1.06));
  if (faces.includes("d")) fhoriz(F, s0, s1, y0, p0, p1, false, mat, mulc(col, 0.7));
  if (faces.includes("l")) fside(F, s0, y0, y1, p0, p1, false, mat, mulc(col, 0.86));
  if (faces.includes("r")) fside(F, s1, y0, y1, p0, p1, true, mat, mulc(col, 0.86));
}

// ---------------------------------------------------------------------------------------------------------------
// atlases (cells are picked per window / per shop)
// ---------------------------------------------------------------------------------------------------------------
function cellUV(cols, rows, k, inset = 0.004) {
  const c = k % cols, r = Math.floor(k / cols);
  const u0 = c / cols + inset, u1 = (c + 1) / cols - inset, v1 = 1 - r / rows - inset, v0 = 1 - (r + 1) / rows + inset;
  return [u0, v0, u1, v0, u1, v1, u0, v1];
}
const GLASS = { cols: 8, rows: 8, home: [0, 40], office: [40, 56], spandrel: [56, 60], transom: [60, 64] };
const STORE = { cols: 4, rows: 4, shops: [0, 12], lobby: [12, 14], door: 14, closed: 15 };
const SIGN = { cols: 4, rows: 17 };   // 17th row (11/5): the TV, Studio and Sparks doors
const SHOPS = ["CALHOUN COFFEE", "SUMMIT CITY RECORDS", "THREE RIVERS DINER", "BERRY ST BOOKS", "OLD FORT OUTFITTERS", "LANDING PIZZA",
  "HARRISON HARDWARE", "MAIN ST BARBER", "RIVERGREEN FLORIST", "ALLEN DRUG CO.", "WAYNE BAKERY", "JEFFERSON TAILORS", "MAUMEE MARKET",
  "ST. MARYS BREWING", "COLUMBIA CAMERA", "GOLDEN LANTERN NOODLES", "PEARL ST TACOS", "CORNER DELI", "BLUE HERON BAR", "LITTLE RIVER TOYS",
  "SUMMIT SHOES", "HOPE THRIFT", "THE PRINT SHOP", "LAFAYETTE LAUNDRY", "BARR ST GROCER", "WELLS ST BIKES", "NORTHSIDE NAILS", "RADIO REPAIR",
  "CITY LOCKSMITH", "KEY CITY ICE CREAM", "HALF MOON BOOKS", "FIRST BANK"];
const CIVIC_SIGNS = { arcade: "ARCADE", social: "SOCIAL HALL", projects: "PROJECTS", news: "WHB NEWS", library: "PUBLIC LIBRARY", station: "UNION STATION", theater: "GRAND PALACE", parking: "PARKING", court: "COURTHOUSE", onair: "ON AIR", bus: "BUS · LOOP 1",
  tv: "HEARTBEAT TV", studio: "STUDIO", sparks: "SPARKS" };
const SIGN_INDEX = {};

function cv(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return [c, c.getContext("2d")]; }
function texOf(c, repeatMeters, aniso = 8) {
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
  if (repeatMeters) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / repeatMeters, 1 / repeatMeters); }
  return t;
}
function grain(g, w, h, R, n, dark, light) {
  for (let i = 0; i < n; i++) {
    const s = 1 + R() * 2.2; g.fillStyle = R() < 0.5 ? `rgba(0,0,0,${R() * dark})` : `rgba(255,255,255,${R() * light})`;
    g.fillRect(R() * w, R() * h, s, s);
  }
}
function texBrick(base, mortar, seed) {
  const [c, g] = cv(512, 512), R = rng(seed);
  g.fillStyle = mortar; g.fillRect(0, 0, 512, 512);
  const rows = 24, cols = 8, rh = 512 / rows, cw = 512 / cols;
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * cw / 2;
    for (let k = -1; k <= cols; k++) {
      const v = 0.78 + R() * 0.32 - (R() < 0.06 ? 0.22 : 0);
      g.fillStyle = `rgb(${Math.min(255, base[0] * v) | 0},${Math.min(255, base[1] * v) | 0},${Math.min(255, base[2] * v) | 0})`;
      g.fillRect(k * cw + off + 1.6, r * rh + 1.6, cw - 3.2, rh - 3.2);
    }
  }
  grain(g, 512, 512, R, 9000, 0.16, 0.07);
  for (let i = 0; i < 7; i++) { const x = R() * 512, gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, "rgba(0,0,0,0.10)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(x, 0, 6 + R() * 26, 512); }
  return c;
}
function texStone(seed) {
  const [c, g] = cv(512, 512), R = rng(seed);
  g.fillStyle = "#cfc6b3"; g.fillRect(0, 0, 512, 512);
  const rh = 128, cw = 256;
  for (let r = 0; r < 4; r++) for (let k = -1; k < 3; k++) {
    const x = k * cw + (r % 2) * cw / 2, v = 0.92 + R() * 0.12;
    g.fillStyle = `rgb(${207 * v | 0},${198 * v | 0},${179 * v | 0})`; g.fillRect(x + 2, r * rh + 2, cw - 4, rh - 4);
  }
  grain(g, 512, 512, R, 14000, 0.09, 0.08);
  g.strokeStyle = "rgba(90,80,64,0.35)"; g.lineWidth = 2;
  for (let r = 0; r <= 4; r++) { g.beginPath(); g.moveTo(0, r * rh + 1); g.lineTo(512, r * rh + 1); g.stroke(); }
  return c;
}
function texNoise(base, seed, size, dark, light, extra) {
  const [c, g] = cv(size, size), R = rng(seed);
  g.fillStyle = base; g.fillRect(0, 0, size, size);
  grain(g, size, size, R, size * size / 9, dark, light);
  if (extra) extra(g, R, size);
  return c;
}
function texGlass(glow) {
  const [c, g] = cv(512, 512), R = rng(glow ? 77 : 77);
  g.fillStyle = "#000"; g.fillRect(0, 0, 512, 512);
  const curtains = ["#c8b89a", "#9a5a4a", "#6f8a6a", "#d8d0c0", "#5a6a8a", "#b08a5a"];
  for (let k = 0; k < 64; k++) {
    const x = (k % 8) * 64, y = Math.floor(k / 8) * 64, Rk = rng(1000 + k);
    const office = k >= 40 && k < 56, spandrel = k >= 56 && k < 60, transom = k >= 60;
    const lit = transom ? Rk() < 0.5 : office ? Rk() < 0.55 : Rk() < 0.42;
    if (!glow) {
      const gr = g.createLinearGradient(x, y, x + 20, y + 64);
      if (spandrel) { gr.addColorStop(0, "#2a333d"); gr.addColorStop(1, "#1b2229"); }
      else { gr.addColorStop(0, "#5f7182"); gr.addColorStop(0.5, "#2f3a46"); gr.addColorStop(1, "#1a2129"); }
      g.fillStyle = gr; g.fillRect(x, y, 64, 64);
      if (!spandrel) {
        g.fillStyle = "rgba(255,255,255,0.10)"; g.beginPath(); g.moveTo(x + 10 + Rk() * 20, y); g.lineTo(x + 30 + Rk() * 20, y); g.lineTo(x + 12, y + 64); g.lineTo(x - 8, y + 64); g.fill();
        if (lit && !office) { g.fillStyle = "rgba(255,200,140,0.10)"; g.fillRect(x + 4, y + 4, 56, 56); }
      }
    } else if (lit && !spandrel) {
      const gr = g.createRadialGradient(x + 32, y + 26, 4, x + 32, y + 32, 46);
      if (office) { gr.addColorStop(0, "#f4f8ff"); gr.addColorStop(1, "#8fa6c4"); }
      else { const warm = Rk() < 0.8; gr.addColorStop(0, warm ? "#ffe1b0" : "#e6eeff"); gr.addColorStop(1, warm ? "#b8682e" : "#7d8fb0"); }
      g.fillStyle = gr; g.fillRect(x, y, 64, 64);
      if (office) { g.fillStyle = "rgba(255,255,255,0.9)"; g.fillRect(x + 6, y + 6, 52, 4); g.fillStyle = "rgba(0,0,0,0.35)"; g.fillRect(x, y + 44, 64, 20); }
    }
    // shared details drawn on both (so glow lines up with the day picture)
    if (!spandrel && !office && !transom) {
      const kind = Rk();
      if (kind < 0.35) { const cc = curtains[Math.floor(Rk() * curtains.length)]; g.fillStyle = glow ? "rgba(60,30,10,0.55)" : cc; g.globalAlpha = glow ? 1 : 0.55; g.fillRect(x + 3, y + 3, 14, 58); g.fillRect(x + 47, y + 3, 14, 58); g.globalAlpha = 1; }
      else if (kind < 0.6) { g.fillStyle = glow ? "rgba(40,20,5,0.5)" : "rgba(220,215,200,0.45)"; for (let l = 0; l < 7 + Rk() * 10; l++) g.fillRect(x + 3, y + 3 + l * 3, 58, 1.6); }
      else if (kind < 0.7) { g.fillStyle = glow ? "rgba(20,40,10,0.7)" : "rgba(60,100,50,0.7)"; g.beginPath(); g.ellipse(x + 20, y + 54, 12, 9, 0, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = glow ? "#000" : "#2a2b2d"; g.fillRect(x + 30, y, 4, 64); if (kind > 0.45) g.fillRect(x, y + 30, 64, 3);
    }
    if (office && !glow) { g.fillStyle = "rgba(180,200,220,0.08)"; g.fillRect(x, y, 64, 40); }
    g.fillStyle = glow ? "#000" : "#25272a"; g.fillRect(x, y, 64, 2.5); g.fillRect(x, y + 61.5, 64, 2.5); g.fillRect(x, y, 2.5, 64); g.fillRect(x + 61.5, y, 2.5, 64);
  }
  return c;
}
function texStore(glow) {
  const [c, g] = cv(512, 512);
  const goodsPal = ["#d9534f", "#f0ad4e", "#5bc0de", "#5cb85c", "#e8e1d0", "#8e6bbf", "#c97b4a", "#2f6fa8"];
  for (let k = 0; k < 16; k++) {
    const x = (k % 4) * 128, y = Math.floor(k / 4) * 128, R = rng(5000 + k);
    const door = k === 14, lobby = k === 12 || k === 13, closed = k === 15;
    const bright = glow ? (closed ? 0.25 : 1) : 0.55;
    const sh = (hex) => { _c.set(hex).multiplyScalar(bright); return "#" + _c.getHexString(); };
    // room: back wall + ceiling glow + floor
    g.fillStyle = sh(lobby ? "#d8cfc0" : ["#efe4cf", "#d8e4ea", "#f1d9c2", "#dfe8d6"][k % 4]); g.fillRect(x, y, 128, 128);
    g.fillStyle = sh(lobby ? "#b9b2a6" : "#8a7a66"); g.fillRect(x, y + 96, 128, 32);
    if (glow) { const gr = g.createRadialGradient(x + 64, y + 10, 4, x + 64, y + 30, 90); gr.addColorStop(0, "rgba(255,240,210,0.65)"); gr.addColorStop(1, "rgba(255,240,210,0)"); g.fillStyle = gr; g.fillRect(x, y, 128, 128); }
    if (!lobby && !door) {
      for (let s = 0; s < 3; s++) {
        g.fillStyle = sh("#5b4632"); g.fillRect(x + 8, y + 30 + s * 24, 112, 3);
        for (let it = 0; it < 12; it++) { g.fillStyle = sh(goodsPal[Math.floor(R() * goodsPal.length)]); const w = 4 + R() * 6, h = 6 + R() * 12; g.fillRect(x + 10 + it * 9 + R() * 2, y + 30 + s * 24 - h, w, h); }
      }
      g.fillStyle = sh("#3d2e22"); g.fillRect(x + 70 + R() * 20, y + 84, 40, 14); // counter
      for (let l = 0; l < 3; l++) { g.fillStyle = glow ? "#fff2c8" : "#9a8a66"; g.beginPath(); g.arc(x + 24 + l * 40, y + 12, 4, 0, Math.PI * 2); g.fill(); }
    } else if (lobby) {
      g.fillStyle = sh("#5b5348"); g.fillRect(x + 40, y + 78, 48, 18); g.fillStyle = sh("#8a8070"); g.fillRect(x + 10, y + 20, 16, 76); g.fillRect(x + 102, y + 20, 16, 76);
    } else { // door: frame, push bar, glimpse inside
      g.fillStyle = sh("#e8dcc0"); g.fillRect(x, y, 128, 128); g.fillStyle = "#1d1f22"; g.fillRect(x, y, 128, 6); g.fillRect(x, y, 6, 128); g.fillRect(x + 122, y, 6, 128); g.fillRect(x + 61, y, 6, 128);
      g.fillStyle = "#b8b8b8"; g.fillRect(x + 12, y + 66, 44, 4); g.fillRect(x + 72, y + 66, 44, 4);
    }
    if (!glow) { const gr = g.createLinearGradient(x, y, x + 128, y + 128); gr.addColorStop(0, "rgba(200,220,240,0.28)"); gr.addColorStop(0.5, "rgba(200,220,240,0.04)"); gr.addColorStop(1, "rgba(200,220,240,0.16)"); g.fillStyle = gr; g.fillRect(x, y, 128, 128); }
  }
  return c;
}
function fitText(g, text, maxW, size, font) {
  let s = size; g.font = `${font.replace("%", s)}`;
  while (g.measureText(text).width > maxW && s > 10) { s -= 1; g.font = `${font.replace("%", s)}`; }
}
const SIGN_STYLES = [
  { bg: "#1f3b2d", fg: "#f2e3b3", font: "700 %px Georgia, serif" }, { bg: "#5b1f24", fg: "#f6e7c8", font: "700 %px Georgia, serif" },
  { bg: "#1c2a44", fg: "#ffffff", font: "800 %px system-ui, sans-serif" }, { bg: "#111111", fg: "#e9c46a", font: "700 %px Georgia, serif" },
  { bg: "#efe6d2", fg: "#2b2b2b", font: "800 %px system-ui, sans-serif" }, { bg: "#7a3e1d", fg: "#fff1d6", font: "700 %px system-ui, sans-serif" },
];
function texSigns() {
  const [c, g] = cv(1024, SIGN.rows * 64); g.fillStyle = "#000"; g.fillRect(0, 0, 1024, SIGN.rows * 64);
  let k = 0;
  const put = (key, text, style, street) => {
    const x = (k % 4) * 256, y = Math.floor(k / 4) * 64; SIGN_INDEX[key] = k; k++;
    g.fillStyle = style.bg; g.fillRect(x, y, 256, 64);
    if (street) { g.strokeStyle = "#ffffff"; g.lineWidth = 3; g.strokeRect(x + 5, y + 6, 246, 52); }
    else { g.strokeStyle = style.fg; g.globalAlpha = 0.5; g.lineWidth = 2; g.strokeRect(x + 6, y + 7, 244, 50); g.globalAlpha = 1; }
    g.fillStyle = style.fg; g.textAlign = "center"; g.textBaseline = "middle";
    if (style.neon) { g.shadowColor = style.fg; g.shadowBlur = 14; }
    fitText(g, text, 226, street ? 32 : 30, style.font); g.fillText(text, x + 128, y + 34); g.shadowBlur = 0;
  };
  SHOPS.forEach((s, i) => put("shop" + i, s, SIGN_STYLES[i % SIGN_STYLES.length]));
  for (const [id, t] of Object.entries(CIVIC_SIGNS)) {
    const st = id === "arcade" ? { bg: "#0b0614", fg: "#ff5fd2", font: "800 %px system-ui, sans-serif", neon: 1 }
      : id === "onair" ? { bg: "#2a0606", fg: "#ff3b3b", font: "900 %px system-ui, sans-serif", neon: 1 }
      : id === "news" ? { bg: "#0d1b2e", fg: "#ffffff", font: "900 %px system-ui, sans-serif" }
      : id === "tv" ? { bg: "#06121c", fg: "#5fe6ff", font: "900 %px system-ui, sans-serif", neon: 1 }
      : id === "studio" ? { bg: "#141414", fg: "#f2f2f2", font: "800 %px system-ui, sans-serif" }
      : id === "sparks" ? { bg: "#1b2340", fg: "#f3cf6b", font: "700 %px Georgia, serif" }
      : id === "parking" || id === "bus" ? { bg: "#1a4d8f", fg: "#ffffff", font: "900 %px system-ui, sans-serif" }
      : { bg: "#d9cfb8", fg: "#3a3226", font: "700 %px Georgia, serif" };
    put("civic_" + id, t, st);
  }
  [...GRID.xNames, ...GRID.zNames].forEach((n) => put("street_" + n, n.toUpperCase(), { bg: "#1d6b3a", fg: "#ffffff", font: "700 %px system-ui, sans-serif" }, true));
  for (let p = 0; p < 8; p++) put("lot" + p, "LOT " + (p + 1) + " · OPEN", { bg: "#f4f1e8", fg: "#1f6b3a", font: "800 %px system-ui, sans-serif" });
  return c;
}
function signUV(key) { return cellUV(SIGN.cols, SIGN.rows, SIGN_INDEX[key] ?? 0, 0.002); }

// ---------------------------------------------------------------------------------------------------------------
// materials
// ---------------------------------------------------------------------------------------------------------------
let MATS = null, night = { glass: null, store: null, sign: null, door: null };
function makeMaterials(env) {
  const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, roughness: 0.9, metalness: 0 }, o));
  const brickR = texOf(texBrick([150, 72, 52], "#b9ad9c", 11), 2.0);
  const brickB = texOf(texBrick([196, 170, 128], "#d4cbbb", 12), 2.0);
  const stone = texOf(texStone(13), 2.4);
  const trim = texOf(texNoise("#d6d3cc", 14, 256, 0.10, 0.05), 2.0);
  const roof = texOf(texNoise("#5a5a58", 15, 256, 0.35, 0.18), 3.0);
  const walk = texOf(texNoise("#bdb8ad", 16, 512, 0.10, 0.06, (g, R, s) => {
    g.fillStyle = "rgba(60,55,50,0.55)"; g.fillRect(0, 0, s, 3); g.fillRect(0, s / 2, s, 3); g.fillRect(0, 0, 3, s); g.fillRect(s / 2, 0, 3, s);
    for (let i = 0; i < 8; i++) { g.fillStyle = `rgba(70,60,50,${R() * 0.08})`; g.beginPath(); g.ellipse(R() * s, R() * s, 20 + R() * 50, 12 + R() * 30, R() * 3, 0, 7); g.fill(); }
  }), 3.0);
  const asphalt = texOf(texNoise("#3b3c3e", 17, 512, 0.32, 0.12, (g, R, s) => {
    for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(${R() < 0.5 ? "0,0,0" : "90,90,90"},${0.05 + R() * 0.1})`; g.fillRect(R() * s, R() * s, 30 + R() * 140, 20 + R() * 90); }
    g.strokeStyle = "rgba(15,15,15,0.5)"; g.lineWidth = 1.4;
    for (let i = 0; i < 9; i++) { g.beginPath(); let x = R() * s, y = R() * s; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (R() - 0.5) * 50; y += (R() - 0.3) * 40; g.lineTo(x, y); } g.stroke(); }
  }), 8.0);
  const lawn = texOf(texNoise("#58773f", 18, 256, 0.25, 0.10), 2.0);
  const awning = (() => { const [c, g] = cv(128, 128); for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? "#ffffff" : "#bdbdbd"; g.fillRect(i * 16, 0, 16, 128); } return texOf(c, 1.6); })();
  const glassMap = texOf(texGlass(false)), glassGlow = texOf(texGlass(true));
  const storeMap = texOf(texStore(false)), storeGlow = texOf(texStore(true));
  const signTex = texOf(texSigns());
  MATS = {
    brick: std({ map: brickR, bumpMap: brickR, bumpScale: 1.2 }),
    brickB: std({ map: brickB, bumpMap: brickB, bumpScale: 1.2 }),
    stone: std({ map: stone, bumpMap: stone, bumpScale: 0.8, roughness: 0.85 }),
    trim: std({ map: trim, roughness: 0.8 }),
    roof: std({ map: roof, roughness: 1 }),
    metal: std({ roughness: 0.45, metalness: 0.55 }),
    dark: std({ roughness: 0.8 }),
    awning: std({ map: awning, side: THREE.DoubleSide, roughness: 0.95 }),
    sidewalk: std({ map: walk }),
    lawn: std({ map: lawn, roughness: 1 }),
    paint: std({ roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    glass: std({ map: glassMap, emissive: 0xffffff, emissiveMap: glassGlow, emissiveIntensity: 0.0, roughness: 0.12, metalness: 0.65, envMapIntensity: 1.3 }),
    store: std({ map: storeMap, emissive: 0xffffff, emissiveMap: storeGlow, emissiveIntensity: 0.35, roughness: 0.1, metalness: 0.3 }),
    sign: std({ map: signTex, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.1, roughness: 0.6 }),
    blade: std({ map: signTex, roughness: 0.5 }),
    doorMat: new THREE.MeshBasicMaterial({ color: 0x7bd88f, transparent: true, opacity: 0.45, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
  };
  MATS.asphaltTex = asphalt;
  night.glass = MATS.glass; night.store = MATS.store; night.sign = MATS.sign;
  return MATS;
}
export function textureBytes() {   // rough upload size of the city's own textures (rgba8 + mips)
  let b = 0; const seen = new Set();
  for (const m of Object.values(MATS)) if (m && m.isMaterial) for (const k of ["map", "emissiveMap", "bumpMap"]) { const t = m[k]; if (t && t.image && !seen.has(t)) { seen.add(t); b += t.image.width * t.image.height * 4 * 1.33; } }
  return Math.round(b);
}

// ---------------------------------------------------------------------------------------------------------------
// the building kit
// ---------------------------------------------------------------------------------------------------------------
const BRICK_COLS = [[1, 1, 1], [0.92, 0.88, 0.86], [1.06, 0.98, 0.92], [0.8, 0.74, 0.72], [0.98, 0.9, 0.84]];
const BUFF_COLS = [[1, 1, 1], [0.95, 0.93, 0.88], [1.0, 0.96, 0.9], lin(0xd8e0d0), lin(0xe8d8c0), lin(0xc9d3dc)];
const STONE_COLS = [[1, 1, 1], [0.9, 0.9, 0.92], [1.02, 0.97, 0.88], [0.82, 0.8, 0.78]];
const CORNICE_COLS = [lin(0xe8dcc4), lin(0x3f5a4a), lin(0xf2f0ea), lin(0x5a4636), lin(0x262626), lin(0x8a7a5a)];
const AWNING_COLS = [lin(0x7a1f24), lin(0x1f4d3a), lin(0x1d2f55), lin(0x2a2a2a), lin(0x8a5a1a), lin(0x3d6e8f), lin(0x6a2a5a)];
const PANEL_COLS = [lin(0x5f8f8a), lin(0xc7743e), lin(0x3e5f8f), lin(0xd9d4c8), lin(0x8a8f96)];
const METAL = lin(0x2b2e33), DARK = lin(0x1a1b1d);

export const STYLES = {
  brick: { kind: "punched", fh: 3.9, ww: 1.15, wh: 2.2, sill: 0.85, pier: 0.95, end: 0.8, rev: 0.22, sills: 1, lintel: 1, cornice: 0.75 },
  stone: { kind: "punched", fh: 3.8, ww: 1.35, wh: 2.15, sill: 0.9, pier: 0.85, end: 1.0, rev: 0.3, sills: 1, lintel: 0, cornice: 1.0 },
  ribbon: { kind: "ribbon", fh: 3.7, sill: 1.05, bay: 1.6, cornice: 0.3 },
  curtain: { kind: "curtain", fh: 3.9, bay: 1.55, cornice: 0 },
  garage: { kind: "garage", fh: 3.1, cornice: 0.2 },
};

function glassCell(R, set) { const [a, b] = GLASS[set]; return a + Math.floor(R() * (b - a)); }

function punchedFloors(F, y0, floors, st, mat, col, R, opts = {}) {
  const L = F.L; if (L < 1.6) { frect(F, 0, L, y0, y0 + floors * st.fh, 0, mat, col); return; }
  const ww = opts.ww || st.ww, pierMin = st.pier, end = st.end;
  let n = Math.max(1, Math.floor((L - 2 * end + pierMin) / (ww + pierMin)));
  const pier = n > 1 ? (L - 2 * end - n * ww) / (n - 1) : 0, e = n > 1 ? end : (L - ww) / 2;
  const sillC = mulc(opts.trim || lin(0xd8d0bc), 1), set = opts.set || "home";
  for (let f = 0; f < floors; f++) {
    const y = y0 + f * st.fh, a = y + st.sill, b = a + st.wh, top = y + st.fh;
    frect(F, 0, L, y, a, 0, mat, col); frect(F, 0, L, b, top, 0, mat, col);
    let s = 0;
    for (let k = 0; k < n; k++) {
      const s0 = k === 0 ? e : s, s1 = s0 + ww;
      frect(F, k === 0 ? 0 : s, s0, a, b, 0, mat, col);
      const rv = st.rev, jc = mulc(col, 0.78);
      fside(F, s0, a, b, 0, rv, true, mat, jc); fside(F, s1, a, b, 0, rv, false, mat, jc);
      fhoriz(F, s0, s1, b, 0, rv, false, mat, mulc(col, 0.6)); fhoriz(F, s0, s1, a, 0, rv, true, mat, mulc(col, 0.95));
      frect(F, s0, s1, a, b, rv, "glass", opts.tint || WHITE, cellUV(GLASS.cols, GLASS.rows, glassCell(R, set)));
      DET = true;
      if (st.sills) fbox(F, s0 - 0.08, s1 + 0.08, a - 0.13, a, -0.1, 0, "trim", sillC, "ftlr");
      if (st.lintel) fbox(F, s0 - 0.1, s1 + 0.1, b, b + 0.3, -0.06, 0, "trim", sillC, "fd");
      DET = false;
      s = s1;
    }
    frect(F, s, L, a, b, 0, mat, col);
  }
}
function ribbonFloors(F, y0, floors, st, panelCol, R) {
  const L = F.L, n = Math.max(1, Math.round(L / st.bay)), bw = L / n;
  for (let f = 0; f < floors; f++) {
    const y = y0 + f * st.fh, a = y + st.sill, top = y + st.fh;
    fbox(F, 0, L, y, a, -0.08, 0, "trim", panelCol, "f");
    fhoriz(F, 0, L, a, -0.08, 0.12, true, "trim", mulc(panelCol, 0.9)); fhoriz(F, 0, L, y, -0.08, 0.12, false, "trim", mulc(panelCol, 0.6));
    for (let k = 0; k < n; k++) frect(F, k * bw, (k + 1) * bw, a, top, 0.12, "glass", WHITE, cellUV(GLASS.cols, GLASS.rows, glassCell(R, "office")));
    detail(() => { for (let k = 0; k <= n; k++) fbox(F, k * bw - 0.05, k * bw + 0.05, a, top, -0.02, 0.12, "metal", METAL, "flr"); });
  }
}
function curtainFloors(F, y0, floors, st, R, tint) {
  const L = F.L, n = Math.max(1, Math.round(L / st.bay)), bw = L / n, yTop = y0 + floors * st.fh;
  for (let f = 0; f < floors; f++) {
    const y = y0 + f * st.fh;
    for (let k = 0; k < n; k++) {
      frect(F, k * bw, (k + 1) * bw, y, y + 0.9, 0.06, "glass", tint, cellUV(GLASS.cols, GLASS.rows, glassCell(R, "spandrel")));
      frect(F, k * bw, (k + 1) * bw, y + 0.9, y + st.fh, 0.06, "glass", tint, cellUV(GLASS.cols, GLASS.rows, glassCell(R, "office")));
    }
    detail(() => fbox(F, 0, L, y + 0.86, y + 0.94, -0.06, 0.06, "metal", METAL, "ftd"));
  }
  for (let k = 0; k <= n; k++) fbox(F, k * bw - 0.06, k * bw + 0.06, y0, yTop, -0.14, 0.06, "metal", METAL, "flr");
}
function garageFloors(F, y0, floors, st, col) {
  const L = F.L;
  for (let f = 0; f < floors; f++) {
    const y = y0 + f * st.fh;
    fbox(F, 0, L, y, y + 1.15, -0.1, 0, "trim", col, "ft");
    frect(F, 0, L, y + 1.15, y + st.fh, 1.2, "dark", lin(0x2a2c30));
    fhoriz(F, 0, L, y + st.fh, 0, 1.2, false, "trim", mulc(col, 0.55));
    const n = Math.max(1, Math.round(L / 8));
    for (let k = 0; k <= n; k++) fbox(F, k * L / n - 0.25, k * L / n + 0.25, y + 1.15, y + st.fh, -0.05, 1.2, "trim", mulc(col, 0.92), "flr");
  }
}

// ground floor: storefront (shop) or lobby. Returns nothing; door at s = doorS (centre) when given.
function groundFloor(F, gh, mat, col, R, o) {
  const L = F.L; if (L < 3) { frect(F, 0, L, 0, gh, 0, mat, col); return; }
  const pil = Math.min(0.6, L * 0.08), gl = 3.35;   // glazing height
  fbox(F, 0, pil, 0, gh, -0.16, 0.28, mat, col, "flr"); fbox(F, L - pil, L, 0, gh, -0.16, 0.28, mat, col, "flr");
  frect(F, pil, L - pil, gl, gh, 0, mat, col);
  fhoriz(F, pil, L - pil, gl, 0, 0.28, false, "trim", lin(0x6a665e));
  if (o.signKey && L > 3.2) {
    const sh = o.signH || 0.62, sw = Math.min(L - 2 * pil - 0.5, sh * 4.3), mid = L / 2;
    frect(F, pil + 0.15, L - pil - 0.15, gl + 0.2, gl + 0.36 + sh, -0.03, "trim", o.board || lin(0x2a2622));
    frect(F, mid - sw / 2, mid + sw / 2, gl + 0.28, gl + 0.28 + sh, -0.06, "sign", WHITE, signUV(o.signKey));
  }
  fbox(F, 0, L, gh - 0.32, gh, -0.32, 0, "trim", o.cornice || lin(0xe8dcc4), "ftdlr");
  const doorW = o.doorW || 1.9, doorS = o.doorS;
  const segs = [];
  if (doorS != null) { const d0 = Math.max(pil + 0.1, doorS - doorW / 2), d1 = Math.min(L - pil - 0.1, d0 + doorW); segs.push([pil, d0]); segs.push([d1, L - pil]);
    const dp = 1.35;   // recessed entry
    detail(() => { fside(F, d0, 0, gl, 0.28, dp, true, "trim", lin(0x8a8478)); fside(F, d1, 0, gl, 0.28, dp, false, "trim", lin(0x8a8478)); });
    fhoriz(F, d0, d1, gl, 0.28, dp, false, "trim", lin(0x57534c));
    frect(F, d0, d1, 0, gl - 0.45, dp, "store", WHITE, cellUV(STORE.cols, STORE.rows, STORE.door));
    frect(F, d0, d1, gl - 0.45, gl, dp, "glass", WHITE, cellUV(GLASS.cols, GLASS.rows, glassCell(R, "transom")));
    fhoriz(F, d0, d1, 0.012, 0.28, dp, true, "dark", lin(0x3a3632));
  } else segs.push([pil, L - pil]);
  for (const [a, b] of segs) {
    if (b - a < 0.3) continue;
    const bh = o.lobby ? 0.3 : 0.55;
    fbox(F, a, b, 0, bh, 0.12, 0.28, o.lobby ? "stone" : mat, o.lobby ? WHITE : mulc(col, 0.9), "ft");
    const panes = Math.max(1, Math.round((b - a) / 2.3)), pw = (b - a) / panes;
    for (let k = 0; k < panes; k++) {
      const cell = o.lobby ? STORE.lobby[0] + (k % 2) : o.closed ? STORE.closed : o.shopCell;
      frect(F, a + k * pw, a + (k + 1) * pw, bh, gl - 0.5, 0.28, "store", WHITE, cellUV(STORE.cols, STORE.rows, cell));
      frect(F, a + k * pw, a + (k + 1) * pw, gl - 0.5, gl, 0.28, "glass", WHITE, cellUV(GLASS.cols, GLASS.rows, glassCell(R, "transom")));
      if (k > 0) detail(() => fbox(F, a + k * pw - 0.04, a + k * pw + 0.04, bh, gl, 0.2, 0.28, "metal", METAL, "f"));
    }
    detail(() => fbox(F, a, b, gl - 0.54, gl - 0.46, 0.2, 0.28, "metal", METAL, "ft"));
  }
  if (o.awning) {   // canvas awning across the storefront: slope, valance, end pieces, darker underside
    const ac = o.awning, a = pil + 0.05, b = L - pil - 0.05, y1 = gl - 0.05, y2 = gl - 0.75, out = -1.6;
    quad("awning", F.M(a, y1, 0), F.M(b, y1, 0), F.M(b, y2, out), F.M(a, y2, out), [0, 0.8, 0], [a, 0, b, 0, b, 1.7, a, 1.7], ac);
    frect(F, a, b, y2 - 0.28, y2, out, "awning", mulc(ac, 0.9));
    for (const s of [a, b]) quad("awning", F.M(s, y1, 0), F.M(s, y2, out), F.M(s, y2 - 0.28, out), F.M(s, y1 - 0.2, 0), s === a ? neg(F.R) : F.R, [0, 0, 1.6, 0, 1.6, 0.3, 0, 0.3], mulc(ac, 0.8));
  }
}

function cornice(F, H, depth, col, wrapL, wrapR) {
  const a = wrapL ? -depth : 0, b = F.L + (wrapR ? depth : 0);
  fbox(F, a, b, H - 0.95, H - 0.55, -depth, 0, "trim", col, "ftdlr");
  detail(() => fbox(F, a + 0.1, b - 0.1, H - 1.35, H - 0.95, -depth * 0.35, 0, "trim", mulc(col, 0.9), "fd"));
}

function roofAndTop(x0, z0, x1, z1, H, R, o = {}) {
  box("roof", x0 + 0.25, H - 0.62, z0 + 0.25, x1 - 0.25, H - 0.58, z1 - 0.25, lin(0x9a9a96), "t");
  const pc = o.parapet || lin(0xbdb5a5), t = 0.28, wm = o.wallMat || "trim", wc = o.wallCol || pc, yb = H - 0.62;
  box("trim", x0, yb, z0, x1, H, z0 + t, pc, "tb"); box("trim", x0, yb, z1 - t, x1, H, z1, pc, "tf");
  box("trim", x0, yb, z0, x0 + t, H, z1, pc, "tr"); box("trim", x1 - t, yb, z0, x1, H, z1, pc, "tl");
  box(wm, x0, yb, z0, x1, H, z1, wc, "fblr");
  const w = x1 - x0, d = z1 - z0, units = 1 + Math.floor(R() * 3);
  const wasDet = DET; DET = true;   // everything on the roof below is detail (gone beyond the LOD distance)
  for (let u = 0; u < units && w > 5 && d > 5; u++) {
    const uw = 1.2 + R() * 2.2, ud = 1.0 + R() * 1.8, uh = 0.8 + R() * 1.2, ux = x0 + 1 + R() * (w - uw - 2), uz = z0 + 1.5 + R() * (d - ud - 3);
    box("metal", ux, H - 0.5, uz, ux + uw, H - 0.5 + uh, uz + ud, lin(R() < 0.5 ? 0x9aa0a6 : 0x7d8186), "fblrt");
  }
  if (o.tank && w > 6 && d > 6) {   // a wooden water tank on legs - the old downtown roofline
    const tx = x0 + w * (0.3 + R() * 0.4), tz = z0 + d * (0.4 + R() * 0.3), m = new THREE.Matrix4();
    const p = wp([tx, H + 3.6, tz]);
    m.makeTranslation(p[0], p[1], p[2]); addGeo("trim", TANK_GEO, m, lin(0x6e5238));
    m.makeTranslation(p[0], p[1] + 1.75, p[2]); addGeo("roof", TANK_CAP, m, lin(0x4a4a48));
    for (const [lx, lz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) box("metal", tx + lx * 1.1 - 0.08, H - 0.5, tz + lz * 1.1 - 0.08, tx + lx * 1.1 + 0.08, H + 2.6, tz + lz * 1.1 + 0.08, METAL, "fblr");
  }
  DET = wasDet;
  if (o.penthouse && w > 7 && d > 7) box(o.penthouse, x0 + w * 0.55, H - 0.5, z0 + d * 0.45, x0 + w * 0.55 + 3.2, H + 2.8, z0 + d * 0.45 + 3.6, o.pcol || WHITE, "fblrt");
}
const TANK_GEO = new THREE.CylinderGeometry(1.45, 1.45, 3.0, 12, 1, true);
const TANK_CAP = new THREE.ConeGeometry(1.6, 0.9, 12);

// one mass: footprint (x0..x1, z0..z1) in the lot frame, from y0 up `floors`, with chosen faces getting facades
function mass(x0, z0, x1, z1, y0, floors, st, mat, col, R, o) {
  const F = frames(x0, z0, x1, z1); const H = y0 + floors * st.fh;
  for (const side of ["f", "l", "r", "b"]) {
    const Fs = F[side]; const facade = o.faces.includes(side);
    const shifted = { L: Fs.L, M: (s, y, p) => Fs.M(s, y, p), R: Fs.R, N: Fs.N };
    if (!facade) {
      frect(shifted, 0, Fs.L, y0, H, 0, mat, mulc(col, 0.9));
      if (o.ghost && side === o.ghost && floors >= 2 && Fs.L > 8) frect(shifted, Fs.L * 0.15, Fs.L * 0.85, H - 4.2, H - 1.6, -0.05, "sign", [0.75, 0.72, 0.68], signUV("shop" + Math.floor(R() * SHOPS.length)));
      continue;
    }
    if (st.kind === "punched") punchedFloors(shifted, y0, floors, st, mat, col, R, o);
    else if (st.kind === "ribbon") ribbonFloors(shifted, y0, floors, st, o.panel || PANEL_COLS[0], R);
    else if (st.kind === "curtain") curtainFloors(shifted, y0, floors, st, R, o.tint || WHITE);
    else garageFloors(shifted, y0, floors, st, col);
  }
  return H;
}

// a whole building on a lot. lot = { ox, oz, fx, fz, w, d, cornerL, cornerR }, spec from pickSpec / civic table
function building(lot, spec, R) {
  setFrame(lot.ox, CURB, lot.oz, lot.fx, lot.fz);
  const st = STYLES[spec.style], w = lot.w, d = lot.d;
  const mat = spec.mat || (spec.style === "stone" ? "stone" : spec.style === "brick" ? (R() < 0.7 ? "brick" : "brickB") : "trim");
  const col = spec.col || (mat === "brick" ? pick(R, BRICK_COLS) : mat === "brickB" ? pick(R, BUFF_COLS) : mat === "stone" ? pick(R, STONE_COLS) : lin(0xd9d6cf));
  const corniceCol = spec.corniceCol || pick(R, CORNICE_COLS);
  const F = frames(0, 0, w, d);
  const gh = spec.gh || 4.6;
  const faces = "f" + (lot.cornerL ? "l" : "") + (lot.cornerR ? "r" : "") + (spec.allSides ? "lrb" : "");
  // ground floor on every street face
  const shopCell = STORE.shops[0] + Math.floor(R() * (STORE.shops[1] - STORE.shops[0]));
  const signKey = spec.signKey !== undefined ? spec.signKey : (spec.lobby ? null : "shop" + Math.floor(R() * SHOPS.length));
  const go = { signKey, signH: spec.signH, lobby: spec.lobby, shopCell, closed: R() < 0.08, cornice: corniceCol, awning: spec.awning === false ? null : (spec.awning || (!spec.lobby && R() < 0.55 ? pick(R, AWNING_COLS) : null)) };
  groundFloor(F.f, gh, mat, col, R, Object.assign({}, go, { doorS: spec.doorS != null ? spec.doorS : (w > 5 ? (R() < 0.5 ? w * 0.25 : w * 0.72) : null), doorW: spec.doorW }));
  for (const sd of ["l", "r", "b"]) if (faces.includes(sd)) groundFloor(F[sd], gh, mat, col, R, Object.assign({}, go, { doorS: null, signKey: sd === "b" ? null : go.signKey, awning: null }));
  for (const sd of ["l", "r", "b"]) if (!faces.includes(sd)) frect(F[sd], 0, F[sd].L, 0, gh, 0, mat, mulc(col, 0.88));
  // upper floors
  let H = gh;
  const upper = spec.floors - 1;
  const ghost = !lot.cornerL && spec.floors >= 3 && R() < 0.3 ? "l" : (!lot.cornerR && spec.floors >= 3 && R() < 0.3 ? "r" : null);
  if (upper > 0) {
    if (spec.tower) {
      const pod = Math.min(upper, spec.tower.podium || 1);
      H = mass(0, 0, w, d, gh, pod, st, mat, col, R, { faces, panel: spec.panel, tint: spec.tint, trim: corniceCol, set: spec.set, ghost });
      if (st.cornice) cornice(F.f, H, st.cornice, corniceCol, lot.cornerL, lot.cornerR);
      roofAndTop(0, 0, w, d, H + 0.6, R, { wallMat: mat, wallCol: col });
      const tst = STYLES[spec.tower.style || spec.style], tmat = spec.tower.mat || mat;
      let [tx0, tz0, tx1, tz1] = [spec.tower.inset[0], spec.tower.inset[1], w - spec.tower.inset[2], d - spec.tower.inset[3]];
      let y = H, left = upper - pod;
      const steps = spec.tower.steps || [1];
      for (let si = 0; si < steps.length; si++) {
        const fl = si === steps.length - 1 ? left : Math.round((upper - pod) * steps[si]);
        if (fl <= 0) break;
        const Ht = mass(tx0, tz0, tx1, tz1, y, fl, tst, tmat, col, R, { faces: "flrb", panel: spec.panel, tint: spec.tint, trim: corniceCol, set: spec.set });
        if (tst.cornice) { const TF = frames(tx0, tz0, tx1, tz1); for (const sd of ["f", "l", "r", "b"]) cornice(TF[sd], Ht + 0.6, tst.cornice * 0.8, corniceCol, false, false); }
        roofAndTop(tx0, tz0, tx1, tz1, Ht + 0.6, R, { penthouse: si === steps.length - 1 ? (spec.tower.crownMat || tmat) : null, pcol: col, wallMat: tst.kind === "punched" ? tmat : "trim", wallCol: tst.kind === "punched" ? col : lin(0x9aa3ab) });
        left -= fl; y = Ht;
        const shrink = Math.min((tx1 - tx0), (tz1 - tz0)) * 0.12; tx0 += shrink; tx1 -= shrink; tz0 += shrink; tz1 -= shrink;
        H = Ht + 0.6;
      }
      if (spec.tower.spire) { const p = wp([(tx0 + tx1) / 2, H + 2.8, (tz0 + tz1) / 2]); const m = new THREE.Matrix4().makeTranslation(p[0], p[1] + spec.tower.spire / 2, p[2]); addGeo("metal", new THREE.ConeGeometry(0.5, spec.tower.spire, 6), m, lin(0x8a8f96)); H += spec.tower.spire; }
    } else {
      H = mass(0, 0, w, d, gh, upper, st, mat, col, R, { faces, panel: spec.panel, tint: spec.tint, trim: corniceCol, set: spec.set, ghost });
      H += 0.6;
      if (st.cornice) { cornice(F.f, H, st.cornice, corniceCol, lot.cornerL, lot.cornerR); if (lot.cornerL) cornice(F.l, H, st.cornice, corniceCol, false, false); if (lot.cornerR) cornice(F.r, H, st.cornice, corniceCol, false, false); }
      roofAndTop(0, 0, w, d, H, R, { tank: spec.style === "brick" && spec.floors >= 4 && R() < 0.35, penthouse: spec.floors >= 6 ? mat : null, pcol: col, wallMat: st.kind === "punched" ? mat : "trim", wallCol: st.kind === "punched" ? col : (spec.panel || lin(0xd9d6cf)) });
    }
  } else {
    H = gh + 0.9; frect(F.f, 0, w, gh, H, 0, mat, col);
    for (const sd of ["l", "r", "b"]) frect(F[sd], 0, F[sd].L, gh, H, 0, mat, mulc(col, 0.88));
    roofAndTop(0, 0, w, d, H, R, { wallMat: mat, wallCol: col });
  }
  return H;
}

// ---------------------------------------------------------------------------------------------------------------
// blocks, lots, plans
// ---------------------------------------------------------------------------------------------------------------
// civic + special blocks. Row letters: N/S rows run the full block width; local x=0 is the west end (N) / east end (S).
const PLANS = {
  "3,1": { type: "courthouse" },
  "2,1": { tower: { style: "stone", floors: 20, podium: 2, inset: [3, 2.5, 3, 3], steps: [0.55, 0.3, 1], spire: 9, label: "Lincoln Tower" }, fixed: { S: [{ at: 4, w: 12, tag: "arcade" }] } },
  "2,2": { fixed: { N: [{ at: 21, w: 13, tag: "social" }] } },
  "3,2": { fixed: { N: [{ at: 9, w: 15, tag: "projects" }], S: [{ at: 9, w: 17, tag: "tv" }] } },
  "3,0": { fixed: { S: [{ at: 9, w: 16, tag: "news" }] } },
  "2,3": { fixed: { N: [{ at: 11, w: 14, tag: "sparks" }], S: [{ at: 7, w: 20, tag: "theater" }] } },
  "1,2": { fixed: { N: [{ at: 12, w: 12, tag: "studio" }], S: [{ at: 4, w: 26, tag: "library" }] } },   // studio: not at spawn (-35.5, 6.5)
  "3,4": { fixed: { N: [{ at: 2, w: 30, tag: "station" }] } },
  "4,1": { tower: { style: "curtain", floors: 26, podium: 2, inset: [3, 3, 3, 3], steps: [1], label: "Summit Tower" } },
  "2,0": { tower: { style: "ribbon", floors: 14, podium: 1, inset: [2.5, 2.5, 2.5, 2.5], steps: [1] } },
  "4,2": { tower: { style: "stone", floors: 11, podium: 1, inset: [2, 2, 2, 2], steps: [1] } },
  "1,1": { fixed: { S: [{ at: 0, w: 34, tag: "garage" }] } },
  "4,3": { fixed: { N: [{ at: 0, w: 34, tag: "parking" }] } },
  "1,4": { fixed: { N: [{ at: 10, w: 14, tag: "plot6" }] } },
  "4,4": { fixed: { N: [{ at: 10, w: 14, tag: "plot7" }] } },
  "0,1": { fixed: { N: [{ at: 20, w: 14, tag: "plot0" }] } },
  "0,2": { fixed: { N: [{ at: 20, w: 14, tag: "plot1" }] } },
  "0,3": { fixed: { N: [{ at: 20, w: 14, tag: "plot2" }] } },
  "5,1": { fixed: { N: [{ at: 0, w: 14, tag: "plot3" }] } },
  "5,2": { fixed: { N: [{ at: 0, w: 14, tag: "plot4" }] } },
  "5,3": { fixed: { N: [{ at: 0, w: 14, tag: "plot5" }] } },
  "0,4": { fixed: { N: [{ at: 0, w: 34, tag: "parking" }] } },
  "5,4": { fixed: { S: [{ at: 0, w: 34, tag: "parking" }] } },
};

function splitRow(len, fixed, R, minW = 6.5, maxW = 14) {
  const out = []; const fx = (fixed || []).slice().sort((a, b) => a.at - b.at);
  let s = 0;
  const fill = (a, b) => {
    let x = a;
    while (b - x > 0.01) {
      let w = minW + R() * (maxW - minW);
      if (b - x - w < minW) w = b - x;
      out.push({ s: x, w }); x += w;
    }
  };
  for (const f of fx) { if (f.at - s >= minW) fill(s, f.at); else if (f.at > s && out.length) out[out.length - 1].w += f.at - s; out.push({ s: f.at, w: f.w, tag: f.tag }); s = f.at + f.w; }
  if (len - s >= minW) fill(s, len); else if (len > s && out.length) out[out.length - 1].w += len - s;
  return out;
}

// lot origins/facings per row (see the frame notes at the top)
function rowLots(i, j, row, depth, startLen, fixed, R) {
  const x0 = GRID.xs[i] + SET, x1 = GRID.xs[i + 1] - SET, z0 = GRID.zs[j] + SET, z1 = GRID.zs[j + 1] - SET;
  let O, a, f, L;
  if (row === "N") { f = [0, -1]; a = [1, 0]; O = [x0, z0]; L = x1 - x0; }
  else if (row === "S") { f = [0, 1]; a = [-1, 0]; O = [x1, z1]; L = x1 - x0; }
  else if (row === "E") { f = [1, 0]; a = [0, 1]; O = [x1, z0 + startLen[0]]; L = (z1 - z0) - startLen[0] - startLen[1]; }
  else { f = [-1, 0]; a = [0, -1]; O = [x0, z1 - startLen[1]]; L = (z1 - z0) - startLen[0] - startLen[1]; }
  if (L < 5.5) return [];
  const parts = splitRow(L, fixed, R);
  return parts.map((p, k) => ({
    ox: O[0] + a[0] * p.s, oz: O[1] + a[1] * p.s, fx: f[0], fz: f[1], w: p.w, d: depth, tag: p.tag || null,
    cornerL: (row === "N" || row === "S") && k === 0, cornerR: (row === "N" || row === "S") && k === parts.length - 1, row, i, j,
  }));
}
function lotWorldBox(l) {   // world AABB of a lot footprint
  const ax = -l.fz, az = l.fx;
  const xs = [l.ox, l.ox + l.w * ax, l.ox - l.d * l.fx, l.ox + l.w * ax - l.d * l.fx];
  const zs = [l.oz, l.oz + l.w * az, l.oz - l.d * l.fz, l.oz + l.w * az - l.d * l.fz];
  const xa = Math.min(...xs), xb = Math.max(...xs), za = Math.min(...zs), zb = Math.max(...zs);
  return { x: (xa + xb) / 2, z: (za + zb) / 2, width: xb - xa, depth: zb - za };
}
function lotPoint(l, lx, lz) { return [l.ox + lx * -l.fz - lz * l.fx, l.oz + lx * l.fx - lz * l.fz]; }
const isRing = (i, j) => i === 0 || i === 5 || j === 4;
function intensity(x, z) { return Math.max(0, 1 - Math.hypot(x - 15, z + 25) / 150); }

function pickSpec(lot, R) {
  const c = lotWorldBox(lot), I = intensity(c.x, c.z), ring = isRing(lot.i, lot.j), r = R();
  if (ring) {
    if (r < 0.1 && lot.w > 9) return { parking: true };
    if (r < 0.5) return { style: "brick", floors: 1 + Math.floor(R() * 2) };
    return { style: "brick", floors: 2 + Math.floor(R() * 2) };
  }
  if (lot.w >= 11 && I > 0.55 && r < 0.3) return { style: "stone", floors: 5 + Math.floor(R() * 5 * I), lobby: R() < 0.6 };
  if (lot.w >= 11 && r < 0.42) return { style: "ribbon", floors: 3 + Math.floor(R() * 6 * I), lobby: R() < 0.5, panel: pick(R, PANEL_COLS) };
  return { style: "brick", floors: 2 + Math.floor(R() * (2 + 3 * I)) };
}

// ---------------------------------------------------------------------------------------------------------------
// the city build
// ---------------------------------------------------------------------------------------------------------------
export async function buildCity(scene, ctx) {
  const progress = ctx.progress || (() => {}), yieldFrame = ctx.yieldFrame || (() => Promise.resolve());
  const leafGeo = ctx.leafGeo, leafMat = ctx.leafMat;
  makeMaterials();
  const group = new THREE.Group(); group.name = "city"; scene.add(group);
  const colliders = [], doors = [], plots = [], landmarks = [], firefly = [], benches = [], lampSpots = [], treeSpots = [];
  const solid = (b, h) => colliders.push({ x: b.x, z: b.z, width: b.width, depth: b.depth, h: h || 30 });

  // ---- streets: one asphalt sheet, block slabs with curbs, the promenade
  const asphalt = new THREE.Mesh(new THREE.PlaneGeometry(CITY_RECT.x1 - CITY_RECT.x0 + 40, CITY_RECT.z1 - CITY_RECT.z0 + 30), new THREE.MeshStandardMaterial({ map: MATS.asphaltTex, roughness: 0.95, metalness: 0 }));
  asphalt.geometry.rotateX(-Math.PI / 2);
  { const uv = asphalt.geometry.attributes.uv, pos = asphalt.geometry.attributes.position; for (let k = 0; k < uv.count; k++) uv.setXY(k, pos.getX(k), pos.getZ(k)); }
  asphalt.position.set((CITY_RECT.x0 + CITY_RECT.x1) / 2, 0, (CITY_RECT.z0 + CITY_RECT.z1) / 2 + 5); asphalt.receiveShadow = true; group.add(asphalt);

  const xs = GRID.xs, zs = GRID.zs;
  const slab = (x0, z0, x1, z1, lawn) => {
    setWorldFrame(chunkKey((x0 + x1) / 2, (z0 + z1) / 2));
    box(lawn ? "lawn" : "sidewalk", x0, 0, z0, x1, CURB, z1, lawn ? lin(0xffffff) : WHITE, "t");
    box("trim", x0, -0.2, z0, x1, CURB, z1, lin(0xa8a59e), "fblr");
  };
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < zs.length - 1; j++) {
    const x0 = xs[i] + ROAD, x1 = xs[i + 1] - ROAD, z0 = zs[j] + ROAD, z1 = zs[j + 1] - ROAD;
    if (PLANS[i + "," + j] && PLANS[i + "," + j].type === "courthouse") {
      slab(x0, z0, x1, z1, false);
      setWorldFrame(chunkKey((x0 + x1) / 2, (z0 + z1) / 2));
      const lx0 = x0 + WALK + 0.2, lx1 = x1 - WALK - 0.2, lz0 = z0 + WALK + 0.2, lz1 = z1 - WALK - 0.2;
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      // four lawn panels with paths between (the courthouse green)
      for (const [a, b, c, d] of [[lx0, lz0, cx - 1.6, cz - 1.6], [cx + 1.6, lz0, lx1, cz - 1.6], [lx0, cz + 1.6, cx - 1.6, lz1], [cx + 1.6, cz + 1.6, lx1, lz1]])
        box("lawn", a, CURB, b, c, CURB + 0.06, d, WHITE, "tfblr");
    } else slab(x0, z0, x1, z1, false);
  }
  // outer sidewalks along the city edge and the riverfront promenade
  slab(xs[0] - ROAD - WALK - 6, zs[0] - ROAD - 0.01 - 12.5, xs[6] + ROAD + WALK + 6, zs[0] - ROAD, false);  // promenade (z -122 .. -109.5)
  slab(xs[0] - ROAD - 10, zs[0] - ROAD, xs[0] - ROAD, zs[5] + ROAD + 10, false);
  slab(xs[6] + ROAD, zs[0] - ROAD, xs[6] + ROAD + 10, zs[5] + ROAD + 10, false);
  slab(xs[0] - ROAD, zs[5] + ROAD, xs[6] + ROAD, zs[5] + ROAD + 10, false);
  progress(0.32, "Laying the streets");
  await yieldFrame();

  // ---- road paint: crosswalks, stop bars, centre lines, parking lines
  setWorldFrame("paint");
  const Wc = lin(0xeeeeea), Yc = lin(0xe8b830);
  const paintRect = (x0, z0, x1, z1, col) => box("paint", x0, 0.012, z0, x1, 0.012, z1, col, "t");
  const core = (x, z) => x >= -104 && x <= 104 && z >= -104 && z <= 104;
  for (const X0 of xs) for (const Z0 of zs) {
    const signal = core(X0, Z0);
    // crosswalks on 4 approaches (continental bars)
    for (const dir of [-1, 1]) {
      for (let b = -4.6; b <= 4.7; b += 1.15) { paintRect(X0 + b, Z0 + dir * 6.2, X0 + b + 0.55, Z0 + dir * 8.7, Wc); paintRect(X0 + dir * 6.2, Z0 + b, X0 + dir * 8.7, Z0 + b + 0.55, Wc); }
      if (signal) { paintRect(X0 + (dir < 0 ? -ROAD + 0.2 : 0.2), Z0 + dir * 9.3 - 0.2, X0 + (dir < 0 ? -0.2 : ROAD - 0.2), Z0 + dir * 9.3 + 0.2, Wc);
        paintRect(X0 + dir * 9.3 - 0.2, Z0 + (dir < 0 ? 0.2 : -ROAD + 0.2), X0 + dir * 9.3 + 0.2, Z0 + (dir < 0 ? ROAD - 0.2 : -0.2), Wc); }
    }
  }
  for (const X0 of xs) for (let j = 0; j < zs.length - 1; j++) { const a = zs[j] + 9.6, b = zs[j + 1] - 9.6; paintRect(X0 - 0.22, a, X0 - 0.1, b, Yc); paintRect(X0 + 0.1, a, X0 + 0.22, b, Yc); paintRect(X0 - 3.05, a, X0 - 2.95, b, Wc); paintRect(X0 + 2.95, a, X0 + 3.05, b, Wc); }
  for (const Z0 of zs) for (let i = 0; i < xs.length - 1; i++) { const a = xs[i] + 9.6, b = xs[i + 1] - 9.6; paintRect(a, Z0 - 0.22, b, Z0 - 0.1, Yc); paintRect(a, Z0 + 0.1, b, Z0 + 0.22, Yc); paintRect(a, Z0 - 3.05, b, Z0 - 2.95, Wc); paintRect(a, Z0 + 2.95, b, Z0 + 3.05, Wc); }
  progress(0.36, "Painting the crosswalks");
  await yieldFrame();

  // ---- blocks and buildings
  const civicLots = {}; const parkingLots = []; let blockN = 0;
  const blockKeys = []; for (let j = 0; j < zs.length - 1; j++) for (let i = 0; i < xs.length - 1; i++) blockKeys.push([i, j]);
  for (const [i, j] of blockKeys) {
    const plan = PLANS[i + "," + j] || {}; const R = rng(7337 + i * 101 + j * 1009);
    blockN++;
    if (plan.type === "courthouse") { buildCourthouse(i, j, R, colliders, landmarks); continue; }
    const dN = plan.tower ? 18 : 15, dS = 14;
    const lots = [];
    if (plan.tower) {
      const tl = rowLots(i, j, "N", dN, null, [{ at: 0, w: 34, tag: "tower" }], R)[0]; tl.cornerL = tl.cornerR = true; lots.push(tl);
    } else lots.push(...rowLots(i, j, "N", dN, null, plan.fixed && plan.fixed.N, R));
    lots.push(...rowLots(i, j, "S", dS, null, plan.fixed && plan.fixed.S, R));
    lots.push(...rowLots(i, j, "E", 12, [dN, dS], plan.fixed && plan.fixed.E, R));
    lots.push(...rowLots(i, j, "W", 12, [dN, dS], plan.fixed && plan.fixed.W, R));
    for (const lot of lots) {
      const bb = lotWorldBox(lot);
      if (lot.tag === "tower") {
        const t = plan.tower; const st = t.style;
        const spec = { style: st === "curtain" ? "curtain" : st, floors: t.floors, lobby: true, gh: 5.2, signKey: null, awning: false, doorS: lot.w / 2, doorW: 3.2,
          tower: { style: st, podium: t.podium, inset: t.inset, steps: t.steps, spire: t.spire }, tint: st === "curtain" ? lin(0xb8d0e0) : undefined,
          mat: st === "stone" ? "stone" : st === "curtain" ? "stone" : "trim", panel: pick(R, PANEL_COLS), set: st === "stone" ? "home" : "office" };
        const H = building(lot, spec, R); solid(bb, H);
        if (t.label) { const c = lotWorldBox(lot); landmarks.push({ name: t.label, x: c.x, z: c.z, kind: "tower" }); }
        continue;
      }
      if (lot.tag && lot.tag.startsWith("plot")) { plots.push({ plot: +lot.tag.slice(4), lot }); continue; }
      if (lot.tag === "parking") { parkingLots.push(lot); continue; }
      if (lot.tag === "garage") { const H = building(lot, { style: "garage", floors: 5, mat: "trim", col: lin(0xc8c4bb), lobby: true, signKey: "civic_parking", gh: 3.4, awning: false, doorS: lot.w * 0.15, doorW: 5.5 }, R); solid(bb, H); landmarks.push({ name: "Parking garage", x: bb.x, z: bb.z, kind: "parking" }); continue; }
      if (lot.tag) { const H = buildCivic(lot, R, doors, landmarks); civicLots[lot.tag] = lot; solid(bb, H); continue; }
      const spec = pickSpec(lot, R);
      if (spec.parking) { parkingLots.push(lot); continue; }
      const H = building(lot, spec, R); solid(bb, H);
    }
    if (blockN % 3 === 0) { progress(0.36 + 0.4 * blockN / blockKeys.length, "Raising the buildings"); await yieldFrame(); }
  }

  // ---- surface parking lots (painted stalls, a sign) + empty plots (gravel, open-lot board)
  const parked = [];
  for (const lot of parkingLots) {
    setFrame(lot.ox, CURB, lot.oz, lot.fx, lot.fz);
    box("dark", 0, -0.12, 0, lot.w, 0.0, lot.d, lin(0x3f4042), "t");
    for (let s = 1.5; s < lot.w - 2.5; s += 2.7) { box("paint", s, 0.005, lot.d - 5.6, s + 0.12, 0.005, lot.d - 0.6, Wc, "t"); if (lot.d > 13) box("paint", s, 0.005, 0.8, s + 0.12, 0.005, 5.8, Wc, "t"); }
    for (let s = 1.5; s < lot.w - 4; s += 2.7) { if (((s * 7.31 + lot.ox * 0.37 + lot.oz * 0.11) % 1 + 1) % 1 < 0.55) { const p = lotPoint(lot, s + 1.35, lot.d - 3.1); parked.push({ x: p[0], z: p[1], yaw: Math.atan2(-lot.fx, -lot.fz), y: CURB - 0.12 }); } }
    const sp = lotPoint(lot, 1.2, -0.3); landmarks.push({ name: "Parking", x: sp[0], z: sp[1], kind: "parking" });
    setFrame(lot.ox, CURB, lot.oz, lot.fx, lot.fz);
    box("metal", 0.9, 0, -0.35, 1.0, 2.6, -0.25, METAL, "fblr"); box("sign", 0.4, 2.1, -0.32, 1.9, 2.55, -0.28, WHITE, "");
    quad("sign", [1.9, 2.1, -0.33], [0.4, 2.1, -0.33], [0.4, 2.55, -0.33], [1.9, 2.55, -0.33], [0, 0, -1], signUV("civic_parking"), WHITE);
  }
  for (const p of plots) {
    const lot = p.lot; setFrame(lot.ox, CURB, lot.oz, lot.fx, lot.fz);
    box("roof", 0.2, -0.1, 0.2, lot.w - 0.2, 0.02, lot.d - 0.2, lin(0xb09a7c), "t");
    for (let b = 0.8; b < lot.w; b += 2.2) box("metal", b - 0.07, 0, -0.1, b + 0.07, 0.8, 0.04, lin(0x3a3d40), "fblrt");
    // the board: big, readable, facing the street (fixes the tiny cut-off label)
    const bx = lot.w / 2;
    box("metal", bx - 2.75, 0, 1.0, bx - 2.6, 3.2, 1.15, METAL, "fblr"); box("metal", bx + 2.6, 0, 1.0, bx + 2.75, 3.2, 1.15, METAL, "fblr");
    quad("sign", [bx + 2.8, 1.75, 0.98], [bx - 2.8, 1.75, 0.98], [bx - 2.8, 3.15, 0.98], [bx + 2.8, 3.15, 0.98], [0, 0, -1], signUV("lot" + p.plot), WHITE);
    const c = lotPoint(lot, lot.w / 2, lot.d / 2), front = lotPoint(lot, lot.w / 2, -1.6);
    p.x = c[0]; p.z = c[1]; p.fx = front[0]; p.fz = front[1]; p.box = lotWorldBox(lot);
    landmarks.push({ name: "Lot " + (p.plot + 1), x: c[0], z: c[1], kind: "plot" });
    for (let k = 0; k < 6; k++) firefly.push([c[0] + (Math.random() - 0.5) * 10, c[1] + (Math.random() - 0.5) * 10]);
  }
  plots.sort((a, b) => a.plot - b.plot);
  progress(0.8, "Setting out the street furniture");
  await yieldFrame();

  // ---- river: wall, water, railing, bridge
  setWorldFrame(chunkKey(0, -130));
  box("stone", -185, RIVER.y - 1.6, WALL_Z - 0.6, 185, CURB, WALL_Z, lin(0xb8b2a6), "f");
  for (let x = -164; x <= 164; x += 2.4) if (Math.abs(x - BRIDGE.x) > 3.4) box("metal", x - 0.05, CURB, WALL_Z + 0.25, x + 0.05, CURB + 1.05, WALL_Z + 0.35, METAL, "fblr");
  for (const [a, b] of [[-164, BRIDGE.x - 3.4], [BRIDGE.x + 3.4, 164]]) box("metal", a, CURB + 1.0, WALL_Z + 0.2, b, CURB + 1.1, WALL_Z + 0.4, METAL, "fbtd");
  const bz0 = BRIDGE.z0, bz1 = BRIDGE.z1, bx = BRIDGE.x, bh = BRIDGE.half;
  box("trim", bx - bh, BRIDGE.y - 0.5, bz0, bx + bh, BRIDGE.y, bz1, lin(0x8a8680), "fblrtd");
  const truss = lin(0x3e5a4c);
  for (const side of [-1, 1]) {
    const sx = bx + side * (bh + 0.1);
    box("metal", sx - 0.15, BRIDGE.y, bz0, sx + 0.15, BRIDGE.y + 0.3, bz1, truss, "fblrt");
    box("metal", sx - 0.15, BRIDGE.y + 4.6, bz0 + 4, sx + 0.15, BRIDGE.y + 4.9, bz1 - 4, truss, "fblrtd");
    for (let z = bz0 + 4, k = 0; z <= bz1 - 4 + 0.01; z += 5.25, k++) {
      box("metal", sx - 0.12, BRIDGE.y, z - 0.12, sx + 0.12, BRIDGE.y + 4.9, z + 0.12, truss, "fblr");
      if (z + 5.25 <= bz1 - 4 + 0.01) { const m = new THREE.Matrix4(), len = Math.hypot(5.25, 4.6); m.compose(new THREE.Vector3(sx, BRIDGE.y + 2.4, z + 2.62), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), (k % 2 ? 1 : -1) * Math.atan2(5.25, 4.6)), new THREE.Vector3(1, 1, 1)); addGeo("metal", new THREE.BoxGeometry(0.18, len, 0.18), m, truss); }
    }
    for (const z of [bz0, bz1]) box("metal", sx - 0.15, BRIDGE.y, z - 0.15, sx + 0.15, BRIDGE.y + 4.9, z + 0.15, truss, "fblr");
  }
  for (let z = bz0 + 4; z <= bz1 - 4; z += 10.5) box("metal", bx - bh - 0.1, BRIDGE.y + 4.6, z - 0.1, bx + bh + 0.1, BRIDGE.y + 4.8, z + 0.1, truss, "fbtd");
  for (const z of [-140, -158]) box("stone", bx - bh - 0.4, RIVER.y - 3, z - 1.2, bx + bh + 0.4, BRIDGE.y - 0.5, z + 1.2, lin(0x9a948a), "fblr");
  landmarks.push({ name: "Wells St Bridge", x: bx, z: -150, kind: "bridge" });
  landmarks.push({ name: "Riverfront", x: 60, z: -116, kind: "park" });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(700, RIVER.zS - RIVER.zN + 14), new THREE.MeshStandardMaterial({ color: 0x2b4552, roughness: 0.06, metalness: 0.3, envMapIntensity: 1.4, normalMap: ctx.waterNormal || null, normalScale: new THREE.Vector2(0.35, 0.35), transparent: true, opacity: 0.94 }));
  water.geometry.rotateX(-Math.PI / 2); water.position.set(0, RIVER.y, (RIVER.zN + RIVER.zS) / 2 - 3); water.receiveShadow = true;
  if (water.material.normalMap) { water.material.normalMap.wrapS = water.material.normalMap.wrapT = THREE.RepeatWrapping; water.material.normalMap.repeat.set(60, 6); }
  group.add(water);
  for (let x = -150; x <= 150; x += 9) firefly.push([x + Math.random() * 4, -116 + Math.random() * 4]);

  // ---- lamps along every sidewalk + the promenade, street trees, benches, hydrants, cans
  const nearCross = (v, lines, r) => lines.some((L) => Math.abs(v - L) < r);
  for (const X0 of xs) for (const side of [-1, 1]) for (let z = zs[0] - 2; z <= zs[5] + 2; z += 17) {
    if (nearCross(z, zs, 10)) continue; lampSpots.push([X0 + side * (ROAD + 0.55), z]);
  }
  for (const Z0 of zs) for (const side of [-1, 1]) for (let x = xs[0] - 2; x <= xs[6] + 2; x += 17) {
    if (nearCross(x, xs, 10)) continue; if (Z0 === zs[0] && side < 0) { lampSpots.push([x, WALL_Z + 1.4]); continue; } lampSpots.push([x, Z0 + side * (ROAD + 0.55)]);
  }
  const treeStreetsX = new Set([-52, 0, 52]), treeStreetsZ = new Set([-52, 0, 52, -104]);
  for (const X0 of xs) if (treeStreetsX.has(X0)) for (const side of [-1, 1]) for (let z = zs[0] + 6.5; z <= zs[4]; z += 11.3) { if (nearCross(z, zs, 12)) continue; treeSpots.push([X0 + side * (ROAD + 1.3), z]); }
  for (const Z0 of zs) if (treeStreetsZ.has(Z0)) for (const side of [-1, 1]) for (let x = xs[1] + 6.5; x <= xs[5]; x += 11.3) { if (nearCross(x, xs, 12)) continue; if (Z0 === zs[0] && side < 0) { treeSpots.push([x, WALL_Z + 4.5]); continue; } treeSpots.push([x, Z0 + side * (ROAD + 1.3)]); }
  // courthouse green trees + benches + fireflies
  { const cx = 26, cz = -26; for (const [dx, dz] of [[-10, -10], [10, -10], [-10, 10], [10, 10], [-13, 0], [13, 0], [0, -13.5], [0, 13.5]]) { if (Math.abs(dx) < 1 || Math.abs(dz) < 1) continue; treeSpots.push([cx + dx * 1.18, cz + dz * 1.18]); }
    for (let k = 0; k < 26; k++) firefly.push([cx + (Math.random() - 0.5) * 30, cz + (Math.random() - 0.5) * 30]);
    for (const [bx2, bz2, r] of [[cx - 4, cz - 14.6, 0], [cx + 4, cz - 14.6, 0], [cx - 4, cz + 14.6, Math.PI], [cx + 4, cz + 14.6, Math.PI]]) benches.push([bx2, bz2, r]); }
  for (let x = -150; x <= 150; x += 23) benches.push([x + 6, WALL_Z + 1.2, Math.PI]);
  for (const X0 of [-52, 0, 52]) for (const Z0 of [-52, 0, 52]) { benches.push([X0 + ROAD + 2.6, Z0 - 14, -Math.PI / 2]); benches.push([X0 - ROAD - 2.6, Z0 + 14, Math.PI / 2]); }

  const lampGeo = mergeLamp();
  const posts = new THREE.InstancedMesh(lampGeo, new THREE.MeshStandardMaterial({ color: 0x1f2a24, roughness: 0.5, metalness: 0.6 }), lampSpots.length);
  const globeMat = new THREE.MeshStandardMaterial({ color: 0xfff1d6, emissive: 0xffd9a0, emissiveIntensity: 0.15, roughness: 0.35 });
  const globes = new THREE.InstancedMesh(new THREE.SphereGeometry(0.26, 8, 5), globeMat, lampSpots.length);
  const poolTex = (() => { const [c, g] = cv(128, 128); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, "rgba(255,214,150,0.95)"); gr.addColorStop(0.45, "rgba(255,190,120,0.35)"); gr.addColorStop(1, "rgba(255,180,110,0)"); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
  const poolGeo = new THREE.PlaneGeometry(9, 9); poolGeo.rotateX(-Math.PI / 2);
  const pools = new THREE.InstancedMesh(poolGeo, poolMat, lampSpots.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v3 = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1);
  lampSpots.forEach(([x, z], k) => {
    m4.makeTranslation(x, CURB, z); posts.setMatrixAt(k, m4);
    m4.makeTranslation(x, CURB + 4.05, z); globes.setMatrixAt(k, m4);
    m4.makeTranslation(x, CURB + 0.02, z); pools.setMatrixAt(k, m4);
    colliders.push({ x, z, width: 0.4, depth: 0.4, h: 4 });
  });
  posts.castShadow = true; pools.renderOrder = 2; group.add(posts, globes, pools);

  // keep every real door in sight from the street: no street tree right in front of a door (11/5)
  for (let k = treeSpots.length - 1; k >= 0; k--) if (doors.some((d) => Math.hypot(d.front[0] - treeSpots[k][0], d.front[1] - treeSpots[k][1]) < 6)) treeSpots.splice(k, 1);
  if (leafGeo && treeSpots.length) {
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.17, 3.0, 6), new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.95 }), treeSpots.length);
    const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.15, 1), new THREE.MeshStandardMaterial({ color: 0x46622f, roughness: 0.9 }), treeSpots.length);
    const leaves = new THREE.InstancedMesh(leafGeo, leafMat, treeSpots.length);
    const grates = new THREE.InstancedMesh(new THREE.BoxGeometry(1.3, 0.02, 1.3), new THREE.MeshStandardMaterial({ color: 0x1f2022, roughness: 0.6, metalness: 0.5 }), treeSpots.length);
    const R = rng(4242), tc = new THREE.Color();
    treeSpots.forEach(([x, z], k) => {
      const s = 0.85 + R() * 0.35; q.setFromAxisAngle(v3.set(0, 1, 0), R() * 6.28); sc.set(s, s * (0.9 + R() * 0.25), s);
      m4.compose(v3.set(x, CURB + 1.5 * s, z), q, sc); trunks.setMatrixAt(k, m4);
      m4.compose(v3.set(x, CURB + 3.9 * s, z), q, sc); crowns.setMatrixAt(k, m4); leaves.setMatrixAt(k, m4);
      m4.makeTranslation(x, CURB + 0.011, z); grates.setMatrixAt(k, m4);
      tc.setRGB(1.1 + R() * 0.35, 1.25 + R() * 0.3, 0.85 + R() * 0.3); leaves.setColorAt(k, tc);
      colliders.push({ x, z, width: 0.5, depth: 0.5, h: 3 });
    });
    trunks.castShadow = crowns.castShadow = leaves.castShadow = true; leaves.receiveShadow = true;
    group.add(trunks, crowns, leaves, grates);
  }
  // benches, hydrants, trash cans, street-name signs, signals (merged into the kit batches; signals instanced)
  for (const [x, z, r] of benches) {
    const f = [Math.round(Math.sin(r)) + 0, Math.round(-Math.cos(r)) + 0]; setFrame(x, CURB, z, f[0], f[1]);
    box("metal", -0.8, 0, -0.05, -0.72, 0.45, 0.45, METAL, "fblr"); box("metal", 0.72, 0, -0.05, 0.8, 0.45, 0.45, METAL, "fblr");
    box("trim", -0.85, 0.42, -0.02, 0.85, 0.47, 0.45, lin(0x7a5236), "ftbd"); box("trim", -0.85, 0.5, 0.42, 0.85, 0.9, 0.47, lin(0x7a5236), "fbt");
    colliders.push({ x, z, width: 1.4, depth: 1.4, h: 1 });
  }
  const signalCorners = [];
  for (const X0 of xs) for (const Z0 of zs) {
    const sx = X0 + ROAD + 0.8, sz = Z0 - ROAD - 0.8;
    if (Z0 === zs[0] && false) continue;
    setFrame(sx, CURB, sz, 0, -1);
    box("metal", -0.05, 0, -0.05, 0.05, 3.2, 0.05, METAL, "fblr");
    const xn = GRID.xNames[xs.indexOf(X0)], zn = GRID.zNames[zs.indexOf(Z0)];
    quad("blade", [0.05, 2.83, 0.03], [-1.25, 2.83, 0.03], [-1.25, 3.15, 0.03], [0.05, 3.15, 0.03], [0, 0, -1], signUV("street_" + zn), WHITE);
    quad("blade", [-1.25, 2.83, 0.05], [0.05, 2.83, 0.05], [0.05, 3.15, 0.05], [-1.25, 3.15, 0.05], [0, 0, 1], signUV("street_" + zn), WHITE);
    quad("blade", [0.03, 3.2, -0.05], [0.03, 3.2, 1.25], [0.03, 3.52, 1.25], [0.03, 3.52, -0.05], [1, 0, 0], signUV("street_" + xn), WHITE);
    quad("blade", [-0.03, 3.2, 1.25], [-0.03, 3.2, -0.05], [-0.03, 3.52, -0.05], [-0.03, 3.52, 1.25], [-1, 0, 0], signUV("street_" + xn), WHITE);
    // hydrant + can at alternate corners
    if ((xs.indexOf(X0) + zs.indexOf(Z0)) % 2 === 0) { setFrame(X0 - ROAD - 0.9, CURB, Z0 + ROAD + 0.9, 0, -1); box("metal", -0.16, 0, -0.16, 0.16, 0.62, 0.16, lin(0xc8a020), "fblrt"); box("metal", -0.22, 0.42, -0.07, 0.22, 0.52, 0.07, lin(0xc8a020), "fblrt"); }
    else { setFrame(X0 - ROAD - 0.9, CURB, Z0 + ROAD + 0.9, 0, -1); box("metal", -0.3, 0, -0.3, 0.3, 0.95, 0.3, lin(0x2a3b30), "fblrt"); }
    if (core(X0, Z0)) signalCorners.push([X0, Z0]);
  }
  const signals = buildSignals(group, signalCorners);
  progress(0.88, "Parking the cars");
  await yieldFrame();

  // ---- cars: parked along the curbs + a few moving loops that stop for you and for red lights
  const R = rng(99);
  for (let xi = 0; xi < xs.length; xi++) for (let j = 0; j < zs.length - 1; j++) for (const side of [-1, 1]) {
    for (let z = zs[j] + 13; z < zs[j + 1] - 13; z += 6.6) if (R() < (isRing(Math.min(xi, 5), j) ? 0.3 : 0.5)) parked.push({ x: xs[xi] + side * PARK, z: z + R() * 0.6, yaw: side > 0 ? Math.PI : 0, y: 0 });
  }
  for (let zi = 0; zi < zs.length; zi++) for (let i = 0; i < xs.length - 1; i++) for (const side of [-1, 1]) {
    if (zi === 0 && side < 0) continue;
    for (let x = xs[i] + 13; x < xs[i + 1] - 13; x += 6.6) if (R() < 0.45) parked.push({ x: x + R() * 0.6, z: zs[zi] + side * PARK, yaw: side > 0 ? Math.PI / 2 : -Math.PI / 2, y: 0 });
  }
  // ---- Phase 2: the Downtown Loop bus. Its loop runs past Union Station's door; parked cars clear out of the stop.
  const tA = doors.find((d) => d.id === "town"), tB = doors.find((d) => d.id === "ashgrove");   // Union Station's two doors
  const bus = tA && tB ? busRouteFor({ front: [(tA.front[0] + tB.front[0]) / 2, (tA.front[1] + tB.front[1]) / 2] }) : null;
  if (bus) for (let k = parked.length - 1; k >= 0; k--) { const p = parked[k]; if (Math.hypot(p.x - bus.stopX, p.z - bus.stopZ) < 11 && !p.y) parked.splice(k, 1); }
  if (bus) { buildBusStop(bus); landmarks.push({ name: "Bus stop · Union Station", x: bus.shelterX, z: bus.shelterZ, kind: "bus" }); colliders.push({ x: bus.shelterX + bus.out[0] * 0.1, z: bus.shelterZ + bus.out[1] * 0.1, width: bus.alongX ? 4.2 : 1.1, depth: bus.alongX ? 1.1 : 4.2, h: 2.6 }); }
  const traffic = buildTraffic(group, parked, signals, bus);
  const crossers = [];   // pedestrians on a crosswalk right now (life.js fills it); cars yield to them like they do to you
  for (const p of parked) colliders.push({ x: p.x, z: p.z, width: Math.abs(Math.sin(p.yaw)) > 0.5 ? 4.6 : 1.9, depth: Math.abs(Math.sin(p.yaw)) > 0.5 ? 1.9 : 4.6, h: 1.5 });

  // ---- flush the kit
  const meshes = flush(group, MATS, new Set(["paint", "sidewalk", "lawn", "roof", "sign", "blade"]));
  progress(0.94, "Turning the lights on");

  // animated landmarks (separate small meshes)
  const anim = buildAnimatedSigns(group, civicLots);

  const exits = { theater: civicLots.theater, arcade: civicLots.arcade, library: civicLots.library };
  let nightNow = 0;   // last value from setNight(); update() animates with it
  return {
    group, meshes, colliders, doors, plots, landmarks, firefly, exits,
    update(dt, t, player) {
      signals.update(t); traffic.update(dt, player, signals, crossers);
      anim.update(dt, t, nightNow);
      water.material.normalMap && (water.material.normalMap.offset.x = t * 0.012, water.material.normalMap.offset.y = t * 0.004);
    },
    setNight(nightF, dayF) {
      nightNow = nightF;
      MATS.glass.emissiveIntensity = 0.04 + Math.pow(nightF, 1.2) * 1.35;
      MATS.store.emissiveIntensity = 0.32 + nightF * 0.95;
      MATS.sign.emissiveIntensity = 0.08 + nightF * 0.85;
      MATS.doorMat.opacity = 0.32 + nightF * 0.35;
      globeMat.emissiveIntensity = 0.15 + nightF * 3.2;
      poolMat.opacity = nightF * 0.75; pools.visible = nightF > 0.02;
      traffic.setNight(nightF); signals.setNight(nightF);
    },
    claimPlot(plotIndex, row) { return claimPlotBuilding(group, plots.find((p) => p.plot === plotIndex), row); },
    signals, traffic, crossers, bus,
    // Phase 2 LOD: chunks beyond LOD_DIST draw only their main triangles (no sills, mullions, rooftop units...)
    lodUpdate(cam) {
      let main = 0, all = 0;
      for (const m of meshes) { const L = m.userData.lod; if (!L) continue;
        const far = m.geometry.boundingBox.distanceToPoint(cam.position) > LOD_DIST;
        if (far !== L.far) { L.far = far; m.geometry.setDrawRange(0, far ? L.main : L.all); }
        all++; if (far) main++; }
      return { lodMeshes: all, lodFar: main };
    },
    stats() { return { kitMeshes: meshes.length, colliders: colliders.length, parked: parked.length, lamps: lampSpots.length, trees: treeSpots.length, textureBytes: textureBytes() }; },
  };
}

function mergeLamp() {   // acorn lamp post: base, fluted pole, collar, cap (one geometry, instanced)
  // ~60 triangles: lamps are instanced across the whole city and all drawn at once, so every triangle counts 284 times
  const parts = [[new THREE.CylinderGeometry(0.2, 0.26, 0.7, 6, 1, true), 0.35], [new THREE.CylinderGeometry(0.075, 0.09, 3.2, 6, 1, true), 2.3], [new THREE.CylinderGeometry(0.16, 0.12, 0.2, 6), 3.8], [new THREE.ConeGeometry(0.2, 0.35, 6, 1, true), 4.42]];
  const pos = [], nor = [], idx = []; let base = 0;
  for (const [g, y] of parts) { g.translate(0, y, 0); const p = g.attributes.position, n = g.attributes.normal; for (let k = 0; k < p.count; k++) { pos.push(p.getX(k), p.getY(k), p.getZ(k)); nor.push(n.getX(k), n.getY(k), n.getZ(k)); } for (let k = 0; k < g.index.count; k++) idx.push(base + g.index.getX(k)); base += p.count; }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(idx); return g;
}

// ---------------------------------------------------------------------------------------------------------------
// civic buildings (each has a real door) - tags from PLANS
// ---------------------------------------------------------------------------------------------------------------
function doorAt(lot, s, label, id) {   // s along the frontage from the viewer's left (= local x = w - s)
  const p = lotPoint(lot, lot.w - s, -2.0), q = lotPoint(lot, lot.w - s, -0.4);
  const d = { id, label, x: p[0], z: p[1], hw: 1.9, hd: 1.9, face: [lot.fx, lot.fz], front: q };
  // a glowing welcome mat marks every real door the same way
  setFrame(lot.ox, CURB, lot.oz, lot.fx, lot.fz);
  quad("doorMat", [lot.w - s + 1.1, 0.01, -2.4], [lot.w - s - 1.1, 0.01, -2.4], [lot.w - s - 1.1, 0.01, -0.3], [lot.w - s + 1.1, 0.01, -0.3], [0, 1, 0], [0, 0, 1, 0, 1, 1, 0, 1], WHITE);
  return d;
}
function buildCivic(lot, R, doors, landmarks) {
  const tag = lot.tag, w = lot.w; let H = 10;
  const c = lotWorldBox(lot);
  const L = (name, kind) => landmarks.push({ name, x: c.x, z: c.z, kind: kind || "civic", id: tag });
  if (tag === "arcade") { H = building(lot, { style: "brick", floors: 2, mat: "brick", col: lin(0x8a8a9a), signKey: "civic_arcade", signH: 0.8, doorS: w / 2, awning: false, corniceCol: lin(0x262626) }, R); doors.push(doorAt(lot, w / 2, "Arcade", "arcade")); L("Arcade"); }
  else if (tag === "social") { H = building(lot, { style: "brick", floors: 3, mat: "brick", signKey: "civic_social", doorS: w / 2, awning: lin(0x7a1f24), corniceCol: lin(0xe8dcc4) }, R); doors.push(doorAt(lot, w / 2, "Social Hall", "social")); L("Social Hall"); }
  else if (tag === "projects") { H = building(lot, { style: "curtain", floors: 7, mat: "stone", lobby: true, signKey: "civic_projects", doorS: w / 2, doorW: 3, gh: 5.4, awning: false, tint: lin(0xc8e0e8), set: "office" }, R); doors.push(doorAt(lot, w / 2, "Projects", "projects")); L("Projects"); }
  else if (tag === "news") { H = building(lot, { style: "ribbon", floors: 5, mat: "trim", col: lin(0xe2ded6), lobby: true, signKey: "civic_news", doorS: w * 0.3, doorW: 2.6, gh: 5.0, awning: false, panel: lin(0x1d2f55) }, R); doors.push(doorAt(lot, w * 0.3, "WHB News · Vex & Joe", "news")); L("WHB News", "civic"); }
  // 11/5: Heartbeat TV (a broadcast house: a big screen on the front, a mast on the roof), the Studio (a recording studio
  // with a red RECORDING light) and Sparks (a small stone hall in gold). Each door opens its page.
  else if (tag === "tv") {
    H = building(lot, { style: "ribbon", floors: 4, mat: "trim", col: lin(0x2a3140), lobby: true, signKey: "civic_tv", doorS: w * 0.25, doorW: 2.8, gh: 5.0, awning: false, panel: lin(0x141a24) }, R);
    setFrame(lot.ox, CURB, lot.oz, lot.fx, lot.fz);   // broadcast mast on the roof (merged into the city meshes)
    const mp = wp([w * 0.7, H, lot.d * 0.5]); const m = new THREE.Matrix4();
    m.makeTranslation(mp[0], mp[1] + 7, mp[2]); addGeo("metal", new THREE.CylinderGeometry(0.18, 0.4, 14, 6), m, lin(0xb8bcc4));
    for (const [yy, rr] of [[4, 1.6], [8, 1.1], [11.5, 0.7]]) { m.makeTranslation(mp[0], mp[1] + yy, mp[2]); addGeo("metal", new THREE.CylinderGeometry(rr, rr, 0.12, 8), m, lin(0xc8ccd4)); }
    m.makeTranslation(mp[0], mp[1] + 14.4, mp[2]); addGeo("metal", new THREE.SphereGeometry(0.35, 6, 4), m, lin(0xff4040));
    H += 14;
    doors.push(doorAt(lot, w * 0.25, "Heartbeat TV", "tv")); L("Heartbeat TV");
  }
  else if (tag === "studio") { H = building(lot, { style: "brick", floors: 2, mat: "brickB", col: lin(0x5a5a5e), lobby: true, signKey: "civic_studio", doorS: w / 2, doorW: 2.4, gh: 4.6, awning: lin(0x1a1a1a), corniceCol: lin(0x2a2a2a) }, R); doors.push(doorAt(lot, w / 2, "Studio · make music and videos", "studio")); L("Studio"); }
  else if (tag === "sparks") { H = building(lot, { style: "stone", floors: 2, mat: "stone", col: lin(0xe6dcc6), lobby: true, signKey: "civic_sparks", doorS: w / 2, doorW: 3.0, gh: 5.2, awning: false, corniceCol: lin(0xd8b45a) }, R); doors.push(doorAt(lot, w / 2, "Sparks · people who light the way", "sparks")); L("Sparks"); }
  else if (tag === "theater") { H = building(lot, { style: "brick", floors: 4, mat: "brickB", col: lin(0xe9dcc6), signKey: null, lobby: true, doorS: w / 2, doorW: 4.4, gh: 6.2, awning: false, corniceCol: lin(0xc9b48a) }, R); doors.push(doorAt(lot, w / 2, "Grand Palace Theater", "theater")); L("Grand Palace Theater"); }
  else if (tag === "library") {
    H = building(lot, { style: "stone", floors: 3, mat: "stone", col: lin(0xe8e2d4), lobby: true, signKey: "civic_library", doorS: w / 2, doorW: 3.4, gh: 5.4, awning: false, corniceCol: lin(0xf2f0ea) }, R);
    setFrame(lot.ox, CURB, lot.oz, lot.fx, lot.fz);   // glass atrium pavilion in front of the entry
    const F = frames(w / 2 - 4, -2.2, w / 2 + 4, 0.2); curtainFloors(F.f, 5.4, 2, STYLES.curtain, R, lin(0xd0e4ec)); curtainFloors(F.l, 5.4, 2, STYLES.curtain, R, lin(0xd0e4ec)); curtainFloors(F.r, 5.4, 2, STYLES.curtain, R, lin(0xd0e4ec));
    box("trim", w / 2 - 4.2, 5.4 + 7.8, -2.4, w / 2 + 4.2, 5.4 + 8.2, 0.2, lin(0xf2f0ea), "fbtdlr");
    box("trim", w / 2 - 4.2, 5.2, -2.4, w / 2 + 4.2, 5.4, 0.2, lin(0xf2f0ea), "fbdlr");
    for (const cx of [w / 2 - 3.85, w / 2 + 3.85]) box("metal", cx - 0.15, 0, -2.15, cx + 0.15, 5.2, -1.85, lin(0xd8d8d8), "fblr");
    doors.push(doorAt(lot, w / 2, "Public Library", "library")); L("Public Library");
  }
  else if (tag === "station") {
    H = building(lot, { style: "brick", floors: 2, mat: "brick", col: lin(0xb07060), lobby: true, signKey: "civic_station", doorS: w / 2, doorW: 3.2, gh: 6.0, awning: false, corniceCol: lin(0xe8dcc4) }, R);
    setFrame(lot.ox, CURB, lot.oz, lot.fx, lot.fz);   // clock tower at the west end
    const tx0 = w - 6, tz0 = 3; const TF = frames(tx0, tz0, tx0 + 5, tz0 + 5);
    for (const sd of ["f", "l", "r", "b"]) frect(TF[sd], 0, 5, 0, 24, 0, "brick", lin(0xb07060));
    for (const sd of ["f", "l", "r", "b"]) { cornice(TF[sd], 24.6, 0.5, lin(0xe8dcc4), true, true); }
    roofAndTop(tx0, tz0, tx0 + 5, tz0 + 5, 24.6, R, {});
    const m = new THREE.Matrix4(); const p = wp([tx0 + 2.5, 26.4, tz0 + 2.5]); m.makeTranslation(p[0], p[1], p[2]); addGeo("roof", new THREE.ConeGeometry(3.4, 3.6, 4).rotateY(Math.PI / 4), m, lin(0x4f6b5e));
    H = 28;
    doors.push(doorAt(lot, w * 0.3, "Train to Town Square · World 1", "town"));
    doors.push(doorAt(lot, w * 0.7, "Train to Ashgrove · World 3", "ashgrove"));
    L("Union Station");
  }
  return H;
}

function buildCourthouse(i, j, R, colliders, landmarks) {
  const cx = (GRID.xs[i] + GRID.xs[i + 1]) / 2, cz = (GRID.zs[j] + GRID.zs[j + 1]) / 2;
  const W = 24, D = 18, H = 15, y0 = CURB + 0.06;
  // the building faces Main St (north): local frame origin at the NW corner, facing -z
  const lot = { ox: cx - W / 2, oz: cz - D / 2, fx: 0, fz: -1, w: W, d: D };
  setFrame(lot.ox, y0, lot.oz, 0, -1);
  const F = frames(0, 0, W, D), st = STYLES.stone, col = lin(0xece6d8);
  box("stone", -0.4, 0, -0.4, W + 0.4, 1.4, D + 0.4, lin(0xd8d0c0), "fblrt");   // rusticated plinth
  for (const sd of ["f", "l", "r", "b"]) { punchedFloors(F[sd], 1.4, 3, Object.assign({}, st, { fh: 4.2, wh: 2.6 }), "stone", col, R, { trim: lin(0xf2efe6) }); cornice(F[sd], H, 0.9, lin(0xf2efe6), true, true); }
  roofAndTop(0, 0, W, D, H, R, {});
  // porticos (north + south): stairs, six columns, pediment
  for (const [s, zf, dir] of [[1, 0, -1], [-1, D, 1]]) {
    const pz = zf + dir * 0.2;
    for (let k = 0; k < 4; k++) box("stone", W / 2 - 6 - k * 0.4, 0, pz + dir * (2.6 + k * 0.45), W / 2 + 6 + k * 0.4, 1.4 - k * 0.35, pz, lin(0xdcd5c6), "fblrt");
    for (let k = 0; k < 6; k++) { const x = W / 2 - 5 + k * 2; const p = wp([x, 1.4 + 4.8, pz + dir * 1.6]); const m = new THREE.Matrix4().makeTranslation(p[0], p[1], p[2]); addGeo("stone", COLUMN, m, lin(0xf2efe6)); }
    box("stone", W / 2 - 6, 11.0, pz + dir * 2.4, W / 2 + 6, 12.2, pz, lin(0xf2efe6), "fblrtd");
    const pg = new THREE.BufferGeometry(); const tri = [-6.2, 0, 0, 6.2, 0, 0, 0, 2.6, 0];
    pg.setAttribute("position", new THREE.Float32BufferAttribute([...tri, ...tri.map((v, k) => k % 3 === 2 ? -2.4 : v)], 3));
    pg.setIndex([0, 1, 2, 3, 5, 4, 0, 3, 4, 0, 4, 1, 1, 4, 5, 1, 5, 2, 2, 5, 3, 2, 3, 0]); const pg2 = pg.toNonIndexed(); pg2.computeVertexNormals(); pg2.setAttribute("uv", new THREE.Float32BufferAttribute(new Array(pg2.attributes.position.count * 2).fill(0), 2));
    const p = wp([W / 2, 12.2, pz]); const m = new THREE.Matrix4().compose(new THREE.Vector3(p[0], p[1], p[2]), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), dir > 0 ? Math.PI : 0), new THREE.Vector3(1, 1, 1));
    addGeo("stone", pg2, m, lin(0xf2efe6));
  }
  // drum, copper dome, lantern, statue
  const c = wp([W / 2, H, D / 2]); const m = new THREE.Matrix4();
  m.makeTranslation(c[0], c[1] + 2.6, c[2]); addGeo("stone", new THREE.CylinderGeometry(5.0, 5.3, 5.2, 24), m, lin(0xece6d8));
  for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; m.makeTranslation(c[0] + Math.cos(a) * 5.35, c[1] + 2.6, c[2] + Math.sin(a) * 5.35); addGeo("stone", new THREE.CylinderGeometry(0.22, 0.22, 4.6, 6), m, lin(0xf6f3ea)); }
  m.makeTranslation(c[0], c[1] + 5.2, c[2]); addGeo("trim", new THREE.CylinderGeometry(5.6, 5.6, 0.5, 24), m, lin(0xf2efe6));
  m.makeTranslation(c[0], c[1] + 5.4, c[2]); addGeo("trim", new THREE.SphereGeometry(5.1, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), m, lin(0x5d9c86));
  m.makeTranslation(c[0], c[1] + 11.2, c[2]); addGeo("trim", new THREE.CylinderGeometry(0.9, 1.1, 2.0, 12), m, lin(0xece6d8));
  m.makeTranslation(c[0], c[1] + 12.6, c[2]); addGeo("trim", new THREE.SphereGeometry(1.05, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), m, lin(0x5d9c86));
  m.makeTranslation(c[0], c[1] + 14.1, c[2]); addGeo("metal", new THREE.CylinderGeometry(0.18, 0.25, 1.8, 6), m, lin(0x4f7d6a));
  colliders.push({ x: cx, z: cz, width: W + 1, depth: D + 7, h: 30 });
  landmarks.push({ name: "Courthouse", x: cx, z: cz, kind: "landmark" });
}
const COLUMN = new THREE.CylinderGeometry(0.42, 0.48, 9.6, 12);

// ---------------------------------------------------------------------------------------------------------------
// traffic signals (instanced lenses; NS and EW alternate) and cars
// ---------------------------------------------------------------------------------------------------------------
function buildSignals(group, corners) {
  const housingGeo = new THREE.BoxGeometry(0.42, 1.1, 0.42);
  const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.11, 0.13, 6.2, 8), new THREE.MeshStandardMaterial({ color: 0x2a2d31, metalness: 0.6, roughness: 0.5 }), corners.length * 2);
  const arm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.14, 0.14), pole.material, corners.length * 2);
  const housing = new THREE.InstancedMesh(housingGeo, new THREE.MeshStandardMaterial({ color: 0x2b2a22, roughness: 0.6 }), corners.length * 2);
  const lensGeo = new THREE.BoxGeometry(0.46, 0.24, 0.46);
  const mk = (hex) => new THREE.MeshStandardMaterial({ color: 0x111111, emissive: hex, emissiveIntensity: 0.05, roughness: 0.3 });
  const L = { nsR: mk(0xff2a1a), nsY: mk(0xffb020), nsG: mk(0x30ff70), ewR: mk(0xff2a1a), ewY: mk(0xffb020), ewG: mk(0x30ff70) };
  const lens = {}; for (const k in L) lens[k] = new THREE.InstancedMesh(lensGeo, L[k], corners.length);
  const m4 = new THREE.Matrix4(); let n = 0;
  corners.forEach(([X0, Z0], k) => {
    // NE pole: arm reaches west over the north approach (heads for NS traffic). SW pole: arm reaches north over the west approach (EW).
    const ne = [X0 + ROAD + 0.7, Z0 - ROAD - 0.7], sw = [X0 - ROAD - 0.7, Z0 + ROAD + 0.7];
    m4.makeTranslation(ne[0], CURB + 3.1, ne[1]); pole.setMatrixAt(n, m4);
    m4.makeTranslation(sw[0], CURB + 3.1, sw[1]); pole.setMatrixAt(n + 1, m4);
    m4.compose(new THREE.Vector3(ne[0] - 3.2, CURB + 5.9, ne[1]), new THREE.Quaternion(), new THREE.Vector3(6.4, 1, 1)); arm.setMatrixAt(n, m4);
    m4.compose(new THREE.Vector3(sw[0], CURB + 5.9, sw[1] - 3.2), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2), new THREE.Vector3(6.4, 1, 1)); arm.setMatrixAt(n + 1, m4);
    const hn = [X0 - 1.6, CURB + 5.25, ne[1]], hw = [sw[0], CURB + 5.25, Z0 + 1.6];
    m4.makeTranslation(hn[0], hn[1], hn[2]); housing.setMatrixAt(n, m4);
    m4.makeTranslation(hw[0], hw[1], hw[2]); housing.setMatrixAt(n + 1, m4);
    for (const [key, dy] of [["R", 0.33], ["Y", 0], ["G", -0.33]]) {
      m4.makeTranslation(hn[0], hn[1] + dy, hn[2]); lens["ns" + key].setMatrixAt(k, m4);
      m4.makeTranslation(hw[0], hw[1] + dy, hw[2]); lens["ew" + key].setMatrixAt(k, m4);
    }
    n += 2;
  });
  pole.castShadow = arm.castShadow = housing.castShadow = true;
  group.add(pole, arm, housing, ...Object.values(lens));
  let state = { ns: "g", ew: "r" }, nightBoost = 0;
  const CYC = 26;
  return {
    state,
    isSignal: (x, z) => x >= -104 && x <= 104 && z >= -104 && z <= 104,
    update(t) {
      const p = t % CYC; state.ns = p < 11 ? "g" : p < 13 ? "y" : "r"; state.ew = p < 13 ? "r" : p < 24 ? "g" : p < 26 ? "y" : "r";
      const on = 1.6 + nightBoost * 1.6, off = 0.04;
      L.nsR.emissiveIntensity = state.ns === "r" ? on : off; L.nsY.emissiveIntensity = state.ns === "y" ? on : off; L.nsG.emissiveIntensity = state.ns === "g" ? on : off;
      L.ewR.emissiveIntensity = state.ew === "r" ? on : off; L.ewY.emissiveIntensity = state.ew === "y" ? on : off; L.ewG.emissiveIntensity = state.ew === "g" ? on : off;
    },
    setNight(n) { nightBoost = n; },
  };
}

function carGeometries(kind) {
  // built in a local frame: forward = +z, ground y = 0. Paint shell, dark (glass, tyres, trim), lights.
  const P = { p: [], n: [], i: [], v: 0 }, D = { p: [], n: [], i: [], v: 0 }, Lt = { p: [], n: [], c: [], i: [], v: 0 };
  const quadTo = (B, a, b, c, d, col) => {
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]; const l = Math.hypot(...n) || 1;
    const base = B.v; B.p.push(...a, ...b, ...c, ...d); for (let k = 0; k < 4; k++) { B.n.push(n[0] / l, n[1] / l, n[2] / l); if (B.c) B.c.push(...col); }
    B.i.push(base, base + 1, base + 2, base, base + 2, base + 3); B.v += 4;
  };
  // hexahedron from 8 corners: bottom (x-,z-),(x+,z-),(x+,z+),(x-,z+) then top same order
  const hexa = (B, bx0, bx1, bz0, bz1, by, tx0, tx1, tz0, tz1, ty, col, skip = "") => {
    const b0 = [bx0, by, bz0], b1 = [bx1, by, bz0], b2 = [bx1, by, bz1], b3 = [bx0, by, bz1], t0 = [tx0, ty, tz0], t1 = [tx1, ty, tz0], t2 = [tx1, ty, tz1], t3 = [tx0, ty, tz1];
    if (!skip.includes("t")) quadTo(B, t0, t3, t2, t1, col);
    quadTo(B, b0, b1, t1, t0, col); quadTo(B, b2, b3, t3, t2, col); quadTo(B, b1, b2, t2, t1, col); quadTo(B, b3, b0, t0, t3, col);
  };
  const suv = kind === "suv";
  const L = suv ? 2.4 : 2.32, Wd = suv ? 0.96 : 0.9, y0 = suv ? 0.34 : 0.26, ys = suv ? 1.02 : 0.76, yb = suv ? 1.1 : 0.9, yr = suv ? 1.82 : 1.42;
  // lower body (paint): straight sides, slightly tucked at the sill
  hexa(P, -Wd + 0.06, Wd - 0.06, -L + 0.08, L - 0.05, y0, -Wd, Wd, -L, L, ys);
  // shoulder: hood slopes down to the nose, trunk deck to the tail
  const hz = suv ? L - 0.5 : L - 0.35, tz = suv ? -L + 0.25 : -L + 0.4;
  hexa(P, -Wd, Wd, -L, L, ys, -Wd + 0.04, Wd - 0.04, tz, hz, yb);
  // glasshouse (dark glass) with a raked windscreen and rear window; roof cap in paint
  const cf = suv ? 1.25 : 0.95, cb = suv ? -2.05 : -1.3, rf = suv ? 0.85 : 0.15, rb = suv ? -1.95 : -0.95;
  hexa(D, -Wd + 0.07, Wd - 0.07, cb, cf, yb, -Wd + 0.2, Wd - 0.2, rb, rf, yr - 0.04, [0, 0, 0], "t");
  hexa(P, -Wd + 0.19, Wd - 0.19, rb - 0.02, rf + 0.02, yr - 0.05, -Wd + 0.24, Wd - 0.24, rb + 0.05, rf - 0.05, yr);
  // bumpers + grille + side sills (dark trim)
  hexa(D, -Wd + 0.02, Wd - 0.02, L - 0.02, L + 0.07, y0 + 0.02, -Wd + 0.02, Wd - 0.02, L - 0.02, L + 0.07, y0 + 0.2);
  hexa(D, -Wd + 0.02, Wd - 0.02, -L - 0.07, -L + 0.02, y0 + 0.02, -Wd + 0.02, Wd - 0.02, -L - 0.07, -L + 0.02, y0 + 0.2);
  hexa(D, -Wd + 0.3, Wd - 0.3, L - 0.06, L + 0.02, ys - 0.2, -Wd + 0.3, Wd - 0.3, L - 0.06, L + 0.02, ys - 0.04);
  // wheels: real cylinders, half tucked under the body
  const r = suv ? 0.38 : 0.32, wheel = new THREE.CylinderGeometry(r, r, 0.24, 12); wheel.rotateZ(Math.PI / 2);
  const wp_ = wheel.attributes.position, wn_ = wheel.attributes.normal, wi_ = wheel.index;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const cx = sx * (Wd - 0.1), cz = sz * (L - (suv ? 0.78 : 0.72)), base = D.v;
    for (let k = 0; k < wp_.count; k++) { D.p.push(wp_.getX(k) + cx, wp_.getY(k) + r, wp_.getZ(k) + cz); D.n.push(wn_.getX(k), wn_.getY(k), wn_.getZ(k)); }
    for (let k = 0; k < wi_.count; k++) D.i.push(base + wi_.getX(k)); D.v += wp_.count;
  }
  for (const sx of [-1, 1]) { const x = sx * (Wd - 0.28); hexa(Lt, x - 0.2, x + 0.2, L - 0.02, L + 0.03, ys - 0.17, x - 0.2, x + 0.2, L - 0.02, L + 0.03, ys - 0.03, [1, 0.95, 0.85]); hexa(Lt, x - 0.22, x + 0.22, -L - 0.03, -L + 0.02, ys - 0.15, x - 0.22, x + 0.22, -L - 0.03, -L + 0.02, ys - 0.01, [1, 0.08, 0.05]); }
  const toGeo = (B) => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(B.p, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(B.n, 3)); if (B.c) g.setAttribute("color", new THREE.Float32BufferAttribute(B.c, 3)); g.setIndex(B.i); g.computeBoundingSphere(); return g; };
  return { paint: toGeo(P), dark: toGeo(D), lights: toGeo(Lt) };
}

const LOD_DIST = 95;   // metres from the camera to a chunk's box before its detail triangles drop

// The bus loop: a two-block rectangle whose edge runs along the station's street on the station's side (right-hand
// traffic, same lane rules as the car loops: the loops run clockwise, so the curb is always on the bus's right).
function busRouteFor(door) {
  if (!door) return null;
  const xs = GRID.xs, zs = GRID.zs, dx = door.front[0], dz = door.front[1];
  const nx = nearestLine(dx, xs), nz = nearestLine(dz, zs), alongX = Math.abs(dz - nz) < Math.abs(dx - nx);   // alongX: the street is E-W
  const clampI = (i, n) => Math.max(0, Math.min(n - 3, i));
  let a, b, c, d;
  if (alongX) { const zi = zs.indexOf(nz); const xi = clampI(xs.findIndex((x) => x > dx) - 2, xs.length); a = xi; b = xi + 2;
    if (dz > nz) { c = zi; d = Math.min(zs.length - 1, zi + 2); } else { c = Math.max(0, zi - 2); d = zi; } }
  else { const xi = xs.indexOf(nx); const zi = clampI(zs.findIndex((z) => z > dz) - 2, zs.length); c = zi; d = zi + 2;
    if (dx > nx) { a = xi; b = Math.min(xs.length - 1, xi + 2); } else { a = Math.max(0, xi - 2); b = xi; } }
  const xa = xs[a] + LANE, xb = xs[b] - LANE, za = zs[c] + LANE, zb = zs[d] - LANE;
  const pts = [[xa, za], [xb, za], [xb, zb], [xa, zb]], len = 2 * (xb - xa) + 2 * (zb - za);
  // arc length of the stop (the point on the loop nearest the door)
  let best = 0, bd = Infinity, acc = 0;
  for (let e = 0; e < 4; e++) { const A = pts[e], B = pts[(e + 1) % 4], l = Math.abs(B[0] - A[0]) + Math.abs(B[1] - A[1]);
    for (let u = 0; u <= l; u += 0.5) { const x = A[0] + (B[0] - A[0]) * u / l, z = A[1] + (B[1] - A[1]) * u / l, q = Math.hypot(x - dx, z - dz); if (q < bd) { bd = q; best = acc + u; } }
    acc += l; }
  const out = alongX ? [0, Math.sign(dz - nz)] : [Math.sign(dx - nx), 0];   // from the street toward the station (curb side)
  const sx = alongX ? dx : nx + out[0] * LANE, sz = alongX ? nz + out[1] * LANE : dz;
  return { pts, len, stopS: best, out, alongX, stopX: alongX ? dx : nx + out[0] * PARK, stopZ: alongX ? nz + out[1] * PARK : dz,
    shelterX: alongX ? dx - 7 : nx + out[0] * (ROAD + 2.8), shelterZ: alongX ? nz + out[1] * (ROAD + 2.8) : dz - 7, laneX: sx, laneZ: sz };
}
function buildBusStop(bus) {   // a glass shelter with a bench and a BUS blade, on the station's sidewalk
  const fx = bus.out[0], fz = bus.out[1];   // shelter faces the street: its local front (-z) points back at the road
  setFrame(bus.shelterX, CURB, bus.shelterZ, -fx, -fz);
  box("metal", -2, 0, 0.55, 2, 2.4, 0.62, METAL, "fb"); box("metal", -2.05, 2.4, -0.45, 2.05, 2.52, 0.65, lin(0x1d2f55), "fbtdlr");
  for (const x of [-2, 2]) box("metal", x - 0.06, 0, -0.4, x + 0.06, 2.4, 0.62, METAL, "fblr");
  box("glass", -1.98, 0.3, 0.5, 1.98, 2.3, 0.53, lin(0x9fb8c8), "fb");
  box("trim", -1.5, 0.42, 0.05, 1.5, 0.48, 0.45, lin(0x7a5236), "ftbd");
  box("metal", 2.6, 0, -0.24, 2.68, 2.9, -0.16, METAL, "fblr");
  quad("sign", [3.15, 2.35, -0.26], [2.15, 2.35, -0.26], [2.15, 2.85, -0.26], [3.15, 2.85, -0.26], [0, 0, -1], signUV("civic_bus"), WHITE);
  quad("sign", [2.15, 2.35, -0.14], [3.15, 2.35, -0.14], [3.15, 2.85, -0.14], [2.15, 2.85, -0.14], [0, 0, 1], signUV("civic_bus"), WHITE);
}
function busGeometries() {   // forward = +z, 12 m long, 2.55 m wide: paint body, dark glass band + wheels, lights + destination sign
  const merge = (list) => {
    const P = [], N = [], C = [], I = []; let v = 0;
    for (const [g, col] of list) { const p = g.attributes.position, n = g.attributes.normal;
      for (let k = 0; k < p.count; k++) { P.push(p.getX(k), p.getY(k), p.getZ(k)); N.push(n.getX(k), n.getY(k), n.getZ(k)); C.push(...(col || WHITE)); }
      for (let k = 0; k < g.index.count; k++) I.push(v + g.index.getX(k)); v += p.count; }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I); g.computeBoundingSphere(); return g;
  };
  const B = (w, h, l, x, y, z) => new THREE.BoxGeometry(w, h, l).translate(x, y, z);
  const wheel = (x, z) => new THREE.CylinderGeometry(0.5, 0.5, 0.3, 12).rotateZ(Math.PI / 2).translate(x, 0.5, z);
  const paint = merge([[B(2.55, 0.95, 12, 0, 0.85, 0)], [B(2.55, 0.35, 12, 0, 2.95, 0)], [B(2.3, 0.18, 9.5, 0, 3.18, -0.6)], [B(0.12, 1.65, 0.3, 1.22, 2.05, 2.5)], [B(0.12, 1.65, 0.3, -1.22, 2.05, 0)], [B(0.12, 1.65, 0.3, -1.22, 2.05, -3)], [B(0.12, 1.65, 0.3, 1.22, 2.05, -1.5)]]);
  const dark = merge([[B(2.5, 1.65, 11.8, 0, 2.05, 0)], [B(2.4, 0.3, 0.1, 0, 0.45, 6.02)], [B(2.4, 0.3, 0.1, 0, 0.45, -6.02)], [wheel(-1.12, 3.9)], [wheel(1.12, 3.9)], [wheel(-1.12, -3.6)], [wheel(1.12, -3.6)]]);
  const lights = merge([[B(0.4, 0.18, 0.06, -0.9, 0.75, 6.02), [1, 0.95, 0.85]], [B(0.4, 0.18, 0.06, 0.9, 0.75, 6.02), [1, 0.95, 0.85]], [B(0.3, 0.3, 0.06, -1.0, 0.9, -6.02), [1, 0.08, 0.05]], [B(0.3, 0.3, 0.06, 1.0, 0.9, -6.02), [1, 0.08, 0.05]], [B(1.9, 0.32, 0.06, 0, 2.95, 6.03), [1.0, 0.62, 0.12]]]);
  return { paint, dark, lights };
}

const LOOPS = [[2, 4, 1, 3], [1, 3, 0, 2], [3, 5, 2, 4], [1, 3, 2, 4], [3, 5, 0, 2], [0, 6, 1, 4], [2, 3, 0, 4], [4, 5, 1, 5]];
function buildTraffic(group, parked, signals, bus) {
  const R = rng(31337);
  const movers = [];
  for (const [a, b, c, d] of LOOPS) {
    const xa = GRID.xs[a] + LANE, xb = GRID.xs[b] - LANE, za = GRID.zs[c] + LANE, zb = GRID.zs[d] - LANE;
    const pts = [[xa, za], [xb, za], [xb, zb], [xa, zb]]; const len = 2 * (xb - xa) + 2 * (zb - za);
    for (let k = 0; k < 2; k++) movers.push({ pts, len, s: (k * 0.5 + R() * 0.2) * len, v: 0, vmax: 8 + R() * 3, x: 0, z: 0, yaw: 0, dir: [1, 0], half: 2.4 });
  }
  const buses = [];
  if (bus) for (let k = 0; k < 2; k++) { const b = { pts: bus.pts, len: bus.len, s: (bus.stopS + 20 + k * bus.len / 2) % bus.len, v: 0, vmax: 7.5, x: 0, z: 0, yaw: 0, dir: [1, 0], half: 6.1, bus: true, dwell: 0, served: false, slot: k }; buses.push(b); movers.push(b); }
  const kinds = ["sedan", "suv"]; const geos = { sedan: carGeometries("sedan"), suv: carGeometries("suv") };
  const paintMat = new THREE.MeshStandardMaterial({ roughness: 0.32, metalness: 0.55, envMapIntensity: 1.1 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.18, metalness: 0.6 });
  const lightMat = new THREE.MeshBasicMaterial({ vertexColors: true, color: 0x777777 });
  const all = parked.map((p) => ({ parked: true, ...p })).concat(movers.filter((m) => !m.bus));
  const byKind = { sedan: [], suv: [] }; all.forEach((c, k) => { c.kind = kinds[(k * 7 + 3) % 5 < 3 ? 0 : 1]; c.slot = byKind[c.kind].length; byKind[c.kind].push(c); });
  const meshes = {};
  const palette = [0xeeeeee, 0x111214, 0xa0a4a8, 0x8a1c1c, 0x1f3e6e, 0x55595e, 0x274d36, 0xc8b89a, 0x6e1f3a, 0xd9d9d9];
  const col = new THREE.Color(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  for (const k of kinds) {
    const n = Math.max(1, byKind[k].length);
    meshes[k] = { paint: new THREE.InstancedMesh(geos[k].paint, paintMat, n), dark: new THREE.InstancedMesh(geos[k].dark, darkMat, n), lights: new THREE.InstancedMesh(geos[k].lights, lightMat, n) };
    byKind[k].forEach((c, i) => { col.setHex(palette[Math.floor(R() * palette.length)]); meshes[k].paint.setColorAt(i, col); });
    for (const mm of Object.values(meshes[k])) { mm.castShadow = mm !== meshes[k].lights; mm.receiveShadow = true; mm.count = byKind[k].length; group.add(mm); }
  }
  let busMesh = null;
  if (buses.length) {
    const g = busGeometries();
    const busPaint = new THREE.MeshStandardMaterial({ vertexColors: true, color: 0xf2f2ee, roughness: 0.35, metalness: 0.3 });
    const busLights = new THREE.MeshBasicMaterial({ vertexColors: true, color: 0x777777 });
    busMesh = { paint: new THREE.InstancedMesh(g.paint, busPaint, buses.length), dark: new THREE.InstancedMesh(g.dark, darkMat, buses.length), lights: new THREE.InstancedMesh(g.lights, busLights, buses.length) };
    // a stripe colour per bus (the Downtown Loop livery: white with a band)
    busMesh.paint.setColorAt(0, col.setHex(0xffffff)); if (buses.length > 1) busMesh.paint.setColorAt(1, col.setHex(0xf4f0e6));
    for (const mm of Object.values(busMesh)) { mm.castShadow = mm !== busMesh.lights; mm.receiveShadow = true; group.add(mm); }
    busMesh.lightMat = busLights;
  }
  const placeBus = (c) => { q.setFromAxisAngle(up, c.yaw); m4.compose(v.set(c.x, 0, c.z), q, one); busMesh.paint.setMatrixAt(c.slot, m4); busMesh.dark.setMatrixAt(c.slot, m4); busMesh.lights.setMatrixAt(c.slot, m4); };
  const place = (c) => { if (c.bus) return placeBus(c); q.setFromAxisAngle(up, c.yaw); m4.compose(v.set(c.x, c.y || 0, c.z), q, one); const M = meshes[c.kind]; M.paint.setMatrixAt(c.slot, m4); M.dark.setMatrixAt(c.slot, m4); M.lights.setMatrixAt(c.slot, m4); };
  const posAt = (c) => {
    let s = ((c.s % c.len) + c.len) % c.len;
    for (let e = 0; e < 4; e++) { const a = c.pts[e], b = c.pts[(e + 1) % 4], l = Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]); if (s <= l) { const t = s / l; c.x = a[0] + (b[0] - a[0]) * t; c.z = a[1] + (b[1] - a[1]) * t; c.dir = [Math.sign(b[0] - a[0]), Math.sign(b[1] - a[1])]; return; } s -= l; }
  };
  for (const c of all) { if (!c.parked) { posAt(c); c.yaw = Math.atan2(c.dir[0], c.dir[1]); } place(c); }
  return {
    update(dt, player, sig, crossers) {
      for (const c of movers) {
        let target = c.vmax;
        const along = (x, z) => (x - c.x) * c.dir[0] + (z - c.z) * c.dir[1], lat = (x, z) => Math.abs((x - c.x) * c.dir[1] - (z - c.z) * c.dir[0]);
        const nose = c.half - 2.4;   // a bus's nose is further ahead than a car's
        if (player) { const a = along(player.x, player.z) - nose; if (a > 0 && a < 11 && lat(player.x, player.z) < 2.4) target = Math.min(target, Math.max(0, (a - 4.5) * 1.6)); }
        if (crossers) for (let k = 0; k < crossers.length; k++) { const p = crossers[k], a = along(p.x, p.z) - nose; if (a > -1 && a < 12 && lat(p.x, p.z) < 3.2) target = Math.min(target, Math.max(0, (a - 4.5) * 1.6)); }
        for (const o of movers) { if (o === c) continue; const gap = c.half + o.half + 1.7, a = along(o.x, o.z); if (a > 0 && a < gap + 5.5 && lat(o.x, o.z) < 1.5) target = Math.min(target, Math.max(0, (a - gap) * 1.5)); }
        if (c.bus) {   // pull up at Union Station, wait, go
          const toStop = ((bus.stopS - c.s) % c.len + c.len) % c.len;
          if (c.dwell > 0) { c.dwell -= dt; target = 0; if (c.dwell <= 0) c.served = true; }
          else if (!c.served && toStop < 30) { target = Math.min(target, Math.max(0, toStop * 0.9)); if (toStop < 0.6 && c.v < 0.8) c.dwell = 9; }
          if (c.served && toStop > 40 && toStop < c.len - 40) c.served = false;
        }
        // signals: the next crossing street along our heading
        const lines = c.dir[0] !== 0 ? GRID.xs : GRID.zs, pos = (c.dir[0] !== 0 ? c.x : c.z) + (c.dir[0] !== 0 ? c.dir[0] : c.dir[1]) * (c.half - 2.4), sgn = c.dir[0] !== 0 ? c.dir[0] : c.dir[1];
        for (const Lc of lines) { const dist = (Lc - pos) * sgn; if (dist > 8.5 && dist < 30) { const ix = c.dir[0] !== 0 ? Lc : c.x, iz = c.dir[0] !== 0 ? c.z : Lc; if (sig.isSignal(ix, iz)) { const light = c.dir[0] !== 0 ? sig.state.ew : sig.state.ns; if (light !== "g") target = Math.min(target, Math.max(0, (dist - 10.2) * 1.4)); } break; } }
        c.v += Math.max(-9 * dt, Math.min(3.2 * dt, target - c.v));
        c.s += c.v * dt; posAt(c);
        const want = Math.atan2(c.dir[0], c.dir[1]); let dy = want - c.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI; c.yaw += dy * Math.min(1, dt * 6);
        place(c);
      }
      for (const k of kinds) for (const mm of Object.values(meshes[k])) mm.instanceMatrix.needsUpdate = true;
      if (busMesh) { busMesh.paint.instanceMatrix.needsUpdate = busMesh.dark.instanceMatrix.needsUpdate = busMesh.lights.instanceMatrix.needsUpdate = true; }
    },
    setNight(n) { lightMat.color.setScalar(0.35 + n * 0.65); if (busMesh) busMesh.lightMat.color.setScalar(0.45 + n * 0.55); },
    buses,
    movers,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// animated signs: theater marquee + blade, WHB news ticker, station clock
// ---------------------------------------------------------------------------------------------------------------
function buildAnimatedSigns(group, lots) {
  const items = []; const glowMats = [];
  const plane = (w, h, mat, lot, lx, ly, lz, rotY) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    const p = lotPoint(lot, lx, lz); m.position.set(p[0], CURB + ly, p[1]);
    m.rotation.y = Math.atan2(lot.fx, lot.fz) + (rotY || 0); group.add(m); return m;
  };
  const th = lots.theater;
  if (th) {
    const [c, g] = cv(1024, 256);
    const draw = (phase) => {
      g.fillStyle = "#120c06"; g.fillRect(0, 0, 1024, 256);
      for (let k = 0; k < 64; k++) { const on = (k + phase) % 3 !== 0; g.fillStyle = on ? "#ffd27a" : "#5a4020"; g.beginPath(); g.arc(8 + k * 16, 10, 5, 0, 7); g.arc(8 + k * 16, 246, 5, 0, 7); g.fill(); }
      g.fillStyle = "#f6efe0"; g.fillRect(28, 32, 968, 192);
      g.fillStyle = "#8a1c1c"; g.textAlign = "center"; g.textBaseline = "middle"; g.font = "900 78px Georgia, serif"; g.fillText("GRAND PALACE", 512, 92);
      g.fillStyle = "#1a1a1a"; g.font = "700 40px system-ui, sans-serif"; g.fillText("NOW SHOWING · CLASSICS ON THE BIG SCREEN", 512, 176);
    };
    draw(0);
    const tex = texOf(c); const mat = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.4, roughness: 0.6, side: THREE.DoubleSide });
    glowMats.push([mat, 0.35, 1.2]);
    const w = th.w; const mid = w / 2;
    // marquee box: three lit faces + soffit
    const box3 = new THREE.Mesh(new THREE.BoxGeometry(12, 1.6, 2.6), new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.6 }));
    const p = lotPoint(th, mid, -1.4); box3.position.set(p[0], CURB + 5.0, p[1]); box3.rotation.y = Math.atan2(th.fx, th.fz); group.add(box3);
    plane(12, 1.6, mat, th, mid, 5.0, -2.72);
    for (const sd of [-1, 1]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.6), mat); const q = lotPoint(th, mid + sd * 6.02, -1.4); m.position.set(q[0], CURB + 5.0, q[1]); m.rotation.y = Math.atan2(th.fx, th.fz) - sd * Math.PI / 2; group.add(m); }
    const soffit = new THREE.Mesh(new THREE.PlaneGeometry(12, 2.6), new THREE.MeshBasicMaterial({ color: 0xffe2a0 })); const sp = lotPoint(th, mid, -1.4); soffit.position.set(sp[0], CURB + 4.19, sp[1]); soffit.rotation.set(Math.PI / 2, 0, 0); soffit.rotation.order = "YXZ"; soffit.rotation.y = Math.atan2(th.fx, th.fz); group.add(soffit);
    items.push({ soffit });
    // vertical blade sign "PALACE"
    const [bc, bg] = cv(128, 512); bg.fillStyle = "#7a1414"; bg.fillRect(0, 0, 128, 512); bg.strokeStyle = "#ffd27a"; bg.lineWidth = 6; bg.strokeRect(8, 8, 112, 496);
    bg.fillStyle = "#fff2d0"; bg.font = "900 64px Georgia, serif"; bg.textAlign = "center"; "PALACE".split("").forEach((ch, k) => bg.fillText(ch, 64, 70 + k * 78));
    const btex = texOf(bc); const bmat = new THREE.MeshStandardMaterial({ map: btex, emissive: 0xffffff, emissiveMap: btex, emissiveIntensity: 0.3, roughness: 0.5, side: THREE.DoubleSide }); glowMats.push([bmat, 0.3, 1.4]);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.4, 9, 1.8), [bmat, bmat, new THREE.MeshStandardMaterial({ color: 0x5a1010 }), new THREE.MeshStandardMaterial({ color: 0x5a1010 }), new THREE.MeshStandardMaterial({ color: 0x7a1414 }), new THREE.MeshStandardMaterial({ color: 0x7a1414 })]);
    const bp = lotPoint(th, 2.2, -1.0); blade.position.set(bp[0], CURB + 11.5, bp[1]); blade.rotation.y = Math.atan2(th.fx, th.fz); group.add(blade);
    items.push({ redraw: draw, tex, every: 0.45, t: 0, phase: 0 });
  }
  const nw = lots.news;
  if (nw) {
    const [c, g] = cv(2048, 128); g.fillStyle = "#03060c"; g.fillRect(0, 0, 2048, 128);
    g.font = "800 64px system-ui, sans-serif"; g.textBaseline = "middle"; let x = 20;
    const parts = [["WHB NEWS", "#ff4040"], [" · LIVE WITH VEX & JOE · ", "#ffffff"], ["THE DAILY SHOW EVERY MORNING", "#7bd88f"], [" · HEARTBEATOBSERVATORY.COM · ", "#9fd0ff"]];
    for (const [t, cl] of parts) { g.fillStyle = cl; g.fillText(t, x, 66); x += g.measureText(t).width; }
    const tex = texOf(c); tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(0.5, 1);
    const mat = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1.0, roughness: 0.4 });
    plane(nw.w - 1.6, 1.35, mat, nw, nw.w / 2, 6.6, -0.22); items.push({ scroll: tex });
    const [oc, og] = cv(256, 96); og.fillStyle = "#200404"; og.fillRect(0, 0, 256, 96); og.shadowColor = "#ff3030"; og.shadowBlur = 16; og.fillStyle = "#ff4646"; og.font = "900 56px system-ui, sans-serif"; og.textAlign = "center"; og.textBaseline = "middle"; og.fillText("ON AIR", 128, 50);
    const otex = texOf(oc); const omat = new THREE.MeshStandardMaterial({ map: otex, emissive: 0xffffff, emissiveMap: otex, emissiveIntensity: 1.2 }); plane(2.4, 0.9, omat, nw, nw.w * 0.8, 2.3, -0.35);
    items.push({ blink: omat });
  }
  const tvl = lots.tv;
  if (tvl) {   // the big screen on the TV house: flips through the channels like a remote (redrawn every 2.5 s)
    const [c, g] = cv(512, 256); const tex = texOf(c);
    const CH = [["CH 1", "NEWS", "#ff4646"], ["CH 2", "SHOWS", "#5fe6ff"], ["CH 3", "MOVIES", "#ffd27a"], ["CH 4", "MUSIC", "#ff7bd8"], ["CH 5", "SCIENCE", "#7bd88f"], ["CH 6", "SPACE", "#9fb8ff"]];
    const draw = (k) => {
      const [n, name, col] = CH[k % CH.length];
      g.fillStyle = "#04070c"; g.fillRect(0, 0, 512, 256); g.fillStyle = col; g.globalAlpha = 0.18; g.fillRect(0, 0, 512, 256); g.globalAlpha = 1;
      g.fillStyle = "#ffffff"; g.font = "800 34px system-ui, sans-serif"; g.textAlign = "left"; g.textBaseline = "middle"; g.fillText("HEARTBEAT TV", 26, 40);
      g.fillStyle = col; g.font = "900 30px system-ui, sans-serif"; g.textAlign = "right"; g.fillText(n, 486, 40);
      g.fillStyle = col; g.font = "900 96px system-ui, sans-serif"; g.textAlign = "center"; g.fillText(name, 256, 140);
      g.fillStyle = "#cfd8e3"; g.font = "600 26px system-ui, sans-serif"; g.fillText("WALK IN TO WATCH", 256, 218);
    };
    draw(0);
    const mat = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.9, roughness: 0.35 });
    plane(8, 4, mat, tvl, tvl.w * 0.64, 8.6, -0.25);
    items.push({ redraw: draw, tex, every: 2.5, t: 0, phase: 0 });
  }
  const sto = lots.studio;
  if (sto) {   // the red RECORDING light over the studio door
    const [rc, rg] = cv(256, 64); rg.fillStyle = "#1a0303"; rg.fillRect(0, 0, 256, 64); rg.shadowColor = "#ff3030"; rg.shadowBlur = 12; rg.fillStyle = "#ff4a4a"; rg.font = "900 38px system-ui, sans-serif"; rg.textAlign = "center"; rg.textBaseline = "middle"; rg.fillText("RECORDING", 128, 34);
    const rtex = texOf(rc); const rmat = new THREE.MeshStandardMaterial({ map: rtex, emissive: 0xffffff, emissiveMap: rtex, emissiveIntensity: 1.1 });
    plane(2.2, 0.55, rmat, sto, sto.w / 2, 3.55, -0.3); items.push({ blink: rmat });
  }
  const spk = lots.sparks;
  if (spk) {   // a gold blade sign, the way old halls of fame hang theirs
    const [bc, bg] = cv(128, 512); bg.fillStyle = "#1b2340"; bg.fillRect(0, 0, 128, 512); bg.strokeStyle = "#f3cf6b"; bg.lineWidth = 6; bg.strokeRect(8, 8, 112, 496);
    bg.fillStyle = "#f6dc8a"; bg.font = "700 62px Georgia, serif"; bg.textAlign = "center"; bg.textBaseline = "middle"; "SPARKS".split("").forEach((ch, k) => bg.fillText(ch, 64, 58 + k * 79));
    const btex = texOf(bc); const bmat = new THREE.MeshStandardMaterial({ map: btex, emissive: 0xffffff, emissiveMap: btex, emissiveIntensity: 0.3, roughness: 0.5, side: THREE.DoubleSide }); glowMats.push([bmat, 0.3, 1.3]);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.35, 6.4, 1.5), [bmat, bmat, new THREE.MeshStandardMaterial({ color: 0x141a30 }), new THREE.MeshStandardMaterial({ color: 0x141a30 }), new THREE.MeshStandardMaterial({ color: 0x1b2340 }), new THREE.MeshStandardMaterial({ color: 0x1b2340 })]);
    const bp = lotPoint(spk, 1.6, -0.9); blade.position.set(bp[0], CURB + 7.6, bp[1]); blade.rotation.y = Math.atan2(spk.fx, spk.fz); group.add(blade);
  }
  const stn = lots.station;
  if (stn) {
    const [c, g] = cv(256, 256); const tex = texOf(c);
    const drawClock = () => {
      const d = new Date(); g.clearRect(0, 0, 256, 256); g.fillStyle = "#f6f1e2"; g.beginPath(); g.arc(128, 128, 120, 0, 7); g.fill(); g.lineWidth = 8; g.strokeStyle = "#2a2a2a"; g.stroke();
      for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; g.fillStyle = "#222"; g.fillRect(128 + Math.sin(a) * 100 - 3, 128 - Math.cos(a) * 100 - 3, 6, 6); }
      const hand = (a, l, w) => { g.strokeStyle = "#111"; g.lineWidth = w; g.lineCap = "round"; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + Math.sin(a) * l, 128 - Math.cos(a) * l); g.stroke(); };
      hand(((d.getHours() % 12) + d.getMinutes() / 60) / 12 * Math.PI * 2, 58, 9); hand(d.getMinutes() / 60 * Math.PI * 2, 88, 6); tex.needsUpdate = true;
    };
    drawClock();
    const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.2, roughness: 0.5 }); glowMats.push([mat, 0.15, 0.9]);
    for (const [lx, lz, ry] of [[stn.w - 3.5, 2.92, 0], [stn.w - 3.5, 8.08, Math.PI], [stn.w - 0.92, 5.5, -Math.PI / 2], [stn.w - 6.08, 5.5, Math.PI / 2]]) plane(3.4, 3.4, mat, stn, lx, 21.2, lz, ry);
    items.push({ clock: drawClock, t: 0 });
  }
  return {
    update(dt, t, nightF) {
      for (const it of items) {
        if (it.scroll) it.scroll.offset.x = (t * 0.045) % 1;
        if (it.redraw) { it.t += dt; if (it.t > it.every) { it.t = 0; it.phase++; it.redraw(it.phase); it.tex.needsUpdate = true; } }
        if (it.blink) it.blink.emissiveIntensity = 0.9 + 0.35 * Math.sin(t * 3);
        if (it.clock) { it.t += dt; if (it.t > 20) { it.t = 0; it.clock(); } }
        if (it.soffit) it.soffit.material.color.setScalar(0.55 + nightF * 0.45);
      }
      for (const [m, lo, hi] of glowMats) m.emissiveIntensity = lo + (hi - lo) * nightF;
    },
  };
}

// a claimed plot becomes a real building from the kit, with the project's name on its sign band
function claimPlotBuilding(group, p, row) {
  if (!p) return null;
  const lot = p.lot, seed = [...String(row.project_name || p.plot)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const R = rng(seed);
  const styles = [{ style: "brick", floors: 3 + Math.floor(R() * 3) }, { style: "ribbon", floors: 4 + Math.floor(R() * 4), panel: pick(R, PANEL_COLS), lobby: true }, { style: "curtain", floors: 5 + Math.floor(R() * 5), lobby: true, mat: "stone", tint: lin(0xc8e0e8), set: "office" }];
  const spec = Object.assign({ signKey: null, doorS: lot.w / 2, awning: false }, styles[seed % 3]);
  const sub = new THREE.Group(); group.add(sub);
  // hide the open-lot board: it lives in the merged kit, so cover it with the building footprint (the board sits inside the lot)
  const H = building(Object.assign({}, lot, { cornerL: false, cornerR: false }), spec, R);
  flush(sub, MATS, new Set(["sign", "roof"]));
  // the project's own name sign
  const [c, g] = cv(512, 96); g.fillStyle = "#14202c"; g.fillRect(0, 0, 512, 96); g.fillStyle = "#ffffff"; g.textAlign = "center"; g.textBaseline = "middle";
  fitText(g, String(row.project_name || "Project").toUpperCase(), 480, 46, "800 %px system-ui, sans-serif"); g.fillText(String(row.project_name || "Project").toUpperCase(), 256, 50);
  const tex = texOf(c); const mat = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.6 });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(lot.w - 1.5, 9), 1.0), mat); const sp = lotPoint(lot, lot.w / 2, -0.12);
  sign.position.set(sp[0], CURB + 4.0, sp[1]); sign.rotation.y = Math.atan2(lot.fx, lot.fz); sub.add(sign);
  return { group: sub, H, door: { label: (row.project_name || "Project") + " — Project Hall", x: p.fx, z: p.fz, hw: 2.2, hd: 2.2 } };
}

// ---------------------------------------------------------------------------------------------------------------
// floor height for the walker: sidewalks/slabs are 15 cm up; the bridge deck is higher; null = not city ground
// ---------------------------------------------------------------------------------------------------------------
export function cityFloor(x, z) {
  if (Math.abs(x - BRIDGE.x) <= BRIDGE.half + 0.2 && z >= BRIDGE.z0 && z <= BRIDGE.z1 + 0.6) return BRIDGE.y;
  if (x < CITY_RECT.x0 - 6 || x > CITY_RECT.x1 + 6 || z < WALL_Z || z > CITY_RECT.z1 + 6) return null;
  const nx = nearestLine(x, GRID.xs), nz = nearestLine(z, GRID.zs);
  if (Math.abs(x - nx) < ROAD || (Math.abs(z - nz) < ROAD && z > GRID.zs[0] - ROAD)) {
    if (z < GRID.zs[0] - ROAD) return CURB;   // promenade north of Superior
    return 0;
  }
  return CURB;
}
function nearestLine(v, lines) { let b = lines[0], d = Infinity; for (const L of lines) { const e = Math.abs(v - L); if (e < d) { d = e; b = L; } } return b; }

// route along street centre lines (for "walk there" from the map): A -> street -> (corner) -> street -> B
export function routeTo(ax, az, bx, bz) {
  const snap = (x, z) => { const nx = nearestLine(x, GRID.xs), nz = nearestLine(z, GRID.zs); return Math.abs(x - nx) < Math.abs(z - nz) ? { axis: "x", L: nx, p: [nx, Math.max(GRID.zs[0], Math.min(GRID.zs[5], z))] } : { axis: "z", L: nz, p: [Math.max(GRID.xs[0], Math.min(GRID.xs[6], x)), nz] }; };
  const A = snap(ax, az), B = snap(bx, bz), pts = [];
  if (Math.hypot(ax - A.p[0], az - A.p[1]) > 0.5) pts.push(A.p);
  if (A.axis === B.axis && A.L === B.L) { /* same street */ }
  else if (A.axis !== B.axis) pts.push(A.axis === "x" ? [A.L, B.L] : [B.L, A.L]);
  else {
    const cross = A.axis === "x" ? GRID.zs : GRID.xs; let best = null, bl = Infinity;
    for (const C of cross) { const l = A.axis === "x" ? Math.abs(az - C) + Math.abs(bz - C) : Math.abs(ax - C) + Math.abs(bx - C); if (l < bl) { bl = l; best = C; } }
    if (A.axis === "x") { pts.push([A.L, best]); pts.push([B.L, best]); } else { pts.push([best, A.L]); pts.push([best, B.L]); }
  }
  pts.push(B.p); pts.push([bx, bz]);
  return pts;
}
