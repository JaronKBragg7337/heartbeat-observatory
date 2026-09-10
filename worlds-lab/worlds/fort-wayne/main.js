// WORLDS LAB · Fort Wayne — Phase 1 recognition lab (downtown as an interpreted digital twin).
// Real OpenStreetMap geometry — rivers, roads, bridges, blocks — plus hand-built hero
// anchors (courthouse dome, Embassy marquee, Lincoln Tower, I&M Power Center, the
// cathedral spires, Parkview Field, the Wells St truss, the MLK bridge arches).
// Win condition: someone from Fort Wayne says "wait... this feels like downtown"
// from geometry alone. Nothing here is faked: every street, river and block is the
// real city's shape from OSM data ((c) OpenStreetMap contributors, ODbL — CREDITS.md);
// the heroes are stylized true-to-shape, and signs say what's interpreted.
// Laws: BUILD below matches ?v= in this folder's index.html, same commit.
// Boot calls sit at the very END of the file (TDZ law). Lib v1 is frozen.
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.module.js";
import { createWorld, labChrome } from "../../lib/v1/kit.js";
import { place, streetLamp, signPost, statue, bench, tree } from "../../lib/v1/props.js";
import { textTexture } from "../../lib/v1/textures.js";
import { FW } from "./data.js";

const BUILD = "2026-06-12-fw3"; // bumped with ?v= in index.html on every deploy

// ---- world constants ----
const WATER_Y = -1.7;   // river surface, below street grade (the levee feel)
const BED_Y = -2.6;     // riverbed — walkable: you wade, eyes stay above water
const BOUNDS = 505;
const PAL = ["#9b8d7a", "#8a6f5c", "#a89a86", "#7e8488", "#9aa1a8", "#b3a48e", "#6e6a62", "#8c7464"];

// ---- tiny helpers (module scope, no per-frame allocation) ----
function hashI(i) { let h = (i + 1) * 2654435761; h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15; return (h >>> 0) / 4294967295; }
function pip(x, z, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0], zi = pts[i][1], xj = pts[j][0], zj = pts[j][1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
function polyBBox(pts) {
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  for (const p of pts) { if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0]; if (p[1] < minZ) minZ = p[1]; if (p[1] > maxZ) maxZ = p[1]; }
  return { minX, maxX, minZ, maxZ };
}
function srgb(hex) { return new THREE.Color().setStyle(hex, THREE.SRGBColorSpace); }

// ---- tap-to-identify: tap any building, the chip says what it is ----------------
// Names are real OSM tags (building name + matched POI storefronts) carried in
  // data.js. Unnamed buildings say so plainly — no name is available in the source
// state). Raycasts only on a confirmed tap; zero per-frame cost. Declared at module
// scope per the TDZ law; listeners attach in setupTapIdentify() from BOOT.
const tapTargets = [];                 // merged block mesh + footprint-hero meshes
const _ray = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const nameChipEl = document.getElementById("nameChip");
let nameChipTimer = 0;
let tapId = null, tapX = 0, tapY = 0, tapT = 0;
function showNameChip(text) {
  if (!nameChipEl) return;
  nameChipEl.textContent = text;
  nameChipEl.style.display = "inline-block";
  clearTimeout(nameChipTimer);
  nameChipTimer = setTimeout(() => { nameChipEl.style.display = "none"; }, 6000);
}
function identifyAt(nx, ny) {
  _ndc.set(nx, ny);
  _ray.setFromCamera(_ndc, kit.camera);
  const hits = _ray.intersectObjects(tapTargets, false);
  if (!hits.length) { if (nameChipEl) nameChipEl.style.display = "none"; return; }
  // step the hit point slightly along the ray so a wall hit lands INSIDE the footprint
  const px = hits[0].point.x + _ray.ray.direction.x * 0.6;
  const pz = hits[0].point.z + _ray.ray.direction.z * 0.6;
  for (const k in FW.heroes) { // heroes first — they are named by definition
    const h = FW.heroes[k];
    if (!h.p) continue; // bridge heroes carry no footprint
    if (px < h.minX - 0.5 || px > h.maxX + 0.5 || pz < h.minZ - 0.5 || pz > h.maxZ + 0.5) continue;
    if (!pip(px, pz, h.p)) continue;
    showNameChip(h.n + " · ≈" + Math.round(h.h * 2) + " m");
    return;
  }
  for (const b of FW.bldgs) {
    const bb = polyBBox(b.p);
    if (px < bb.minX - 0.5 || px > bb.maxX + 0.5 || pz < bb.minZ - 0.5 || pz > bb.maxZ + 0.5) continue;
    if (!pip(px, pz, b.p)) continue;
    const names = [];
    if (b.n) names.push(b.n);
    if (b.biz) for (const x of b.biz) if (x !== b.n) names.push(x);
    showNameChip((names.length ? names.join(" · ") : "no name in OSM") + " · ≈" + Math.round(b.h * 2) + " m");
    return;
  }
  if (nameChipEl) nameChipEl.style.display = "none";
}
function setupTapIdentify() {
  const canvas = kit.renderer.domElement;
  canvas.addEventListener("pointerdown", (e) => {
    if (tapId === null) { tapId = e.pointerId; tapX = e.clientX; tapY = e.clientY; tapT = performance.now(); }
  });
  canvas.addEventListener("pointerup", (e) => {
    if (e.pointerId !== tapId) return;
    tapId = null;
    if (performance.now() - tapT > 350) return;                        // a hold/drag, not a tap
    if (Math.hypot(e.clientX - tapX, e.clientY - tapY) > 8) return;    // a look-drag, not a tap
    if (document.pointerLockElement === canvas) { identifyAt(0, 0); return; } // desktop lock: crosshair center
    const r = canvas.getBoundingClientRect();
    identifyAt(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
  });
  canvas.addEventListener("pointercancel", (e) => { if (e.pointerId === tapId) tapId = null; });
}

// ---- height grid: flat city grade, rivers carved, bridge decks kept ----
const GX0 = -512, GZ0 = -512, GW = 172, GH = 172, GS = 1024 / 171; // ~6u cells
const heights = new Float32Array(GW * GH);
function buildHeightGrid() {
  const waterBB = FW.water.map((w) => polyBBox(w.p));
  for (let gz = 0; gz < GH; gz++) {
    for (let gx = 0; gx < GW; gx++) {
      const x = GX0 + gx * GS, z = GZ0 + gz * GS;
      let h = 0;
      for (let i = 0; i < FW.water.length; i++) {
        const bb = waterBB[i];
        if (x < bb.minX - 1 || x > bb.maxX + 1 || z < bb.minZ - 1 || z > bb.maxZ + 1) continue;
        if (pip(x, z, FW.water[i].p)) { h = BED_Y; break; }
      }
      heights[gz * GW + gx] = h;
    }
  }
  // two smoothing passes — soft banks instead of cliffs
  for (let pass = 0; pass < 2; pass++) {
    const src = heights.slice();
    for (let gz = 1; gz < GH - 1; gz++)
      for (let gx = 1; gx < GW - 1; gx++) {
        const i = gz * GW + gx;
        heights[i] = (src[i] * 2 + src[i - 1] + src[i + 1] + src[i - GW] + src[i + GW]) / 6;
      }
  }
}
function gridHeight(x, z) { // raw terrain (rivers carved, banks smoothed) — no decks
  const fx = (x - GX0) / GS, fz = (z - GZ0) / GS;
  const gx = Math.max(0, Math.min(GW - 2, Math.floor(fx))), gz = Math.max(0, Math.min(GH - 2, Math.floor(fz)));
  const tx = Math.max(0, Math.min(1, fx - gx)), tz = Math.max(0, Math.min(1, fz - gz));
  const i = gz * GW + gx;
  const a = heights[i] * (1 - tx) + heights[i + 1] * tx;
  const b = heights[i + GW] * (1 - tx) + heights[i + GW + 1] * tx;
  return a * (1 - tz) + b * tz;
}
function groundHeight(x, z) { // what feet stand on: terrain + bridge-deck plateaus
  let g = gridHeight(x, z);
  // bridge decks: exact plateau matching the visual deck, ramped at the piece ends
  for (let s = 0; s < deckSegs.length; s++) {
    const d = deckSegs[s];
    if (x < d.minX || x > d.maxX || z < d.minZ || z > d.maxZ) continue;
    const t = Math.max(0, Math.min(1, ((x - d.ax) * d.dx + (z - d.az) * d.dz) / d.len2));
    const qx = d.ax + t * d.dx - x, qz = d.az + t * d.dz - z;
    if (qx * qx + qz * qz > d.half2) continue;
    if (0.55 > g) g = 0.55; // flat deck — a curb-step up at each end, feet always on the boards
  }
  return g;
}
const deckSegs = [];
function buildDeckSegs() {
  // OSM splits one physical bridge into several way pieces; chain touching pieces so
  // the deck plateau and its end-ramps span the WHOLE crossing (no mid-bridge dips).
  const chains = [];
  const eq = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 1.6;
  for (const r of FW.roads) {
    if (!r.b) continue;
    chains.push({ pts: r.pts.slice(), w: r.w });
  }
  let merged = true;
  while (merged) {
    merged = false;
    outer:
    for (let i = 0; i < chains.length; i++) {
      for (let j = 0; j < chains.length; j++) {
        if (i === j) continue;
        const A = chains[i].pts, B = chains[j].pts;
        let joined = null;
        if (eq(A[A.length - 1], B[0])) joined = A.concat(B.slice(1));
        else if (eq(A[A.length - 1], B[B.length - 1])) joined = A.concat(B.slice(0, -1).reverse());
        else if (eq(A[0], B[B.length - 1])) joined = B.concat(A.slice(1));
        else if (eq(A[0], B[0])) joined = B.slice(1).reverse().concat(A);
        if (joined) {
          chains[i] = { pts: joined, w: Math.max(chains[i].w, chains[j].w) };
          chains.splice(j, 1);
          merged = true;
          break outer;
        }
      }
    }
  }
  for (const ch of chains) {
    let total = 0;
    for (let i = 0; i < ch.pts.length - 1; i++) total += Math.hypot(ch.pts[i + 1][0] - ch.pts[i][0], ch.pts[i + 1][1] - ch.pts[i][1]);
    const half = ch.w / 2 + 0.9;
    let off = 0;
    for (let i = 0; i < ch.pts.length - 1; i++) {
      const ax = ch.pts[i][0], az = ch.pts[i][1], bx = ch.pts[i + 1][0], bz = ch.pts[i + 1][1];
      const dx = bx - ax, dz = bz - az;
      const len = Math.hypot(dx, dz);
      if (len > 0.01) deckSegs.push({
        ax, az, dx, dz, len, len2: len * len, off, total, half2: half * half,
        minX: Math.min(ax, bx) - half, maxX: Math.max(ax, bx) + half,
        minZ: Math.min(az, bz) - half, maxZ: Math.max(az, bz) + half,
      });
      off += len;
    }
  }
}

// ---- merged-geometry collector (one draw call per bucket) ----
function startBucket() { return { pos: [], nor: [], col: [] }; }
function addGeom(bucket, geom, color) {
  const g = geom.index ? geom.toNonIndexed() : geom;
  const p = g.attributes.position.array, n = g.attributes.normal.array;
  for (let i = 0; i < p.length; i++) { bucket.pos.push(p[i]); bucket.nor.push(n[i]); }
  for (let i = 0; i < p.length; i += 3) bucket.col.push(color.r, color.g, color.b);
  g.dispose();
}
function bucketMesh(bucket, opts) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(bucket.pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(bucket.nor, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(bucket.col, 3));
  return new THREE.Mesh(g, new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, roughness: 0.92, metalness: 0.04 }, opts || {})));
}
function ribbonInto(bucket, pts, w, y, color, followGround) { // road/rail ribbon, butt joints
  const half = w / 2;
  const yAt = (x, z) => (followGround ? Math.max(0, groundHeight(x, z)) + y : y);
  for (let i = 0; i < pts.length - 1; i++) {
    const ax = pts[i][0], az = pts[i][1], bx = pts[i + 1][0], bz = pts[i + 1][1];
    let dx = bx - ax, dz = bz - az;
    const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    const px = -dz * half, pz = dx * half;
    const v = [[ax + px, az + pz], [ax - px, az - pz], [bx - px, bz - pz], [bx + px, bz + pz]];
    const ys = v.map((q) => yAt(q[0], q[1]));
    bucket.pos.push(v[0][0], ys[0], v[0][1], v[1][0], ys[1], v[1][1], v[2][0], ys[2], v[2][1], v[0][0], ys[0], v[0][1], v[2][0], ys[2], v[2][1], v[3][0], ys[3], v[3][1]);
    for (let k = 0; k < 6; k++) { bucket.nor.push(0, 1, 0); bucket.col.push(color.r, color.g, color.b); }
  }
}
function shapeFrom(pts) { // (x,z) ring -> THREE.Shape, CCW enforced so faces point up/out
  let area = 0;
  for (let i = 0; i < pts.length - 1; i++) area += pts[i][0] * -pts[i + 1][1] - pts[i + 1][0] * -pts[i][1];
  const ring = area < 0 ? pts.slice().reverse() : pts;
  const shape = new THREE.Shape();
  shape.moveTo(ring[0][0], -ring[0][1]);
  for (let i = 1; i < ring.length; i++) shape.lineTo(ring[i][0], -ring[i][1]);
  return shape;
}
function extrudeFootprint(pts, h) { // footprint (x,z) -> ExtrudeGeometry standing on y=0
  const g = new THREE.ExtrudeGeometry(shapeFrom(pts), { depth: h, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  return g;
}
function boxInto(bucket, cx, cy, cz, w, h, d, ang, color) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (ang) g.rotateY(-ang); // ang measured in (x,z) plane; rotateY is CCW about +y looking down -y
  g.translate(cx, cy, cz);
  addGeom(bucket, g, color);
}

// ---- the kit world ----
buildDeckSegs();
buildHeightGrid();
const kit = createWorld({
  build: BUILD,
  bounds: BOUNDS,
  groundHeight,
  spawn: FW.spawn,
  fogDensity: 0.0062,
  daySeconds: 300,
  palette: {
    skyStops: [[0, "#0b1322"], [0.22, "#e8945e"], [0.34, "#9ec3e8"], [0.66, "#9ec3e8"], [0.79, "#d97f52"], [0.9, "#0b1322"], [1, "#0b1322"]],
    sunWarm: "#ffe9cf",
    night: "#0b1322",
  },
});
const scene = kit.scene;

// ================= GROUND (displaced plane, vertex-colored: blocks/parks/banks) ====
function buildGround() {
  const segs = 160;
  const geo = new THREE.PlaneGeometry(1024, 1024, segs, segs);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const cBlock = srgb("#a7a294"), cPark = srgb("#6f9d5e"), cBank = srgb("#7c6b52"), cBed = srgb("#4c483c");
  const parkBB = FW.parks.map((p) => polyBBox(p.p));
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = gridHeight(x, z);
    pos.setY(i, h);
    let c = cBlock;
    if (h < BED_Y * 0.75) c = cBed;
    else if (h < -0.25) c = cBank;
    else {
      for (let k = 0; k < FW.parks.length; k++) {
        const bb = parkBB[k];
        if (x < bb.minX || x > bb.maxX || z < bb.minZ || z > bb.maxZ) continue;
        if (pip(x, z, FW.parks[k].p)) { c = cPark; break; }
      }
    }
    // gentle deterministic mottle so the flats don't read as one flat paint
    const m = 0.94 + hashI(i) * 0.12;
    col[i * 3] = c.r * m; col[i * 3 + 1] = c.g * m; col[i * 3 + 2] = c.b * m;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1.0, metalness: 0 }));
  scene.add(mesh);
}

// ================= WATER (the three rivers — the signature) =======================
function buildWater() {
  const mat = new THREE.MeshStandardMaterial({ color: srgb("#3d6a63"), roughness: 0.32, metalness: 0.22, transparent: true, opacity: 0.96 });
  for (const w of FW.water) {
    const g = new THREE.ShapeGeometry(shapeFrom(w.p));
    g.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(g, mat);
    mesh.position.y = WATER_Y;
    scene.add(mesh);
  }
  // slow living shimmer — material-level, one uniform for all rivers
  kit.addUpdate((dt, t) => { mat.roughness = 0.30 + Math.sin(t * 0.7) * 0.05; });
}

// ================= ROADS + BRIDGES + RAILS =========================================
function buildRoads() {
  const roadB = startBucket(), deckB = startBucket();
  const cMajor = srgb("#33373d"), cMinor = srgb("#3c4046"), cPed = srgb("#5d5f57"), cDeck = srgb("#6e7177"), cRail2 = srgb("#8b9097");
  for (const r of FW.roads) {
    const c = r.c === 0 ? cMajor : r.c === 4 ? cPed : cMinor;
    if (r.b) {
      ribbonInto(deckB, r.pts, r.w + 0.6, 0.58, cDeck); // hair above the walk surface (no z-fight)
      // railings + piers
      for (let i = 0; i < r.pts.length - 1; i++) {
        const ax = r.pts[i][0], az = r.pts[i][1], bx = r.pts[i + 1][0], bz = r.pts[i + 1][1];
        const L = Math.hypot(bx - ax, bz - az);
        if (L < 1) continue;
        const ang = Math.atan2(bz - az, bx - ax);
        const mx = (ax + bx) / 2, mz = (az + bz) / 2;
        const px = -(bz - az) / L, pz = (bx - ax) / L;
        boxInto(deckB, mx + px * (r.w / 2 + 0.25), 1.15, mz + pz * (r.w / 2 + 0.25), L, 0.7, 0.18, ang, cRail2);
        boxInto(deckB, mx - px * (r.w / 2 + 0.25), 1.15, mz - pz * (r.w / 2 + 0.25), L, 0.7, 0.18, ang, cRail2);
        for (let s = 9; s < L; s += 18) {
          const t = s / L;
          boxInto(deckB, ax + (bx - ax) * t, (BED_Y + 0.55) / 2, az + (bz - az) * t, 1.4, 0.55 - BED_Y, r.w * 0.8, ang, cDeck);
        }
      }
    } else {
      ribbonInto(roadB, r.pts, r.w, 0.05, c, true);
    }
  }
  const cTie = srgb("#4a4036"), cSteel = srgb("#7d838c");
  for (const r of FW.rails) {
    ribbonInto(roadB, r.pts, 2.4, 0.08, cTie, true);
    ribbonInto(roadB, r.pts, 0.16, 0.14, cSteel, true);
  }
  scene.add(bucketMesh(roadB, { roughness: 0.98 }));
  scene.add(bucketMesh(deckB, { roughness: 0.85 }));
}

// ================= BUILDINGS (real footprints, humble boxes) =======================
function buildBlocks() {
  const bucket = startBucket();
  const palette = PAL.map(srgb);
  for (let i = 0; i < FW.bldgs.length; i++) {
    const b = FW.bldgs[i];
    const col = palette[Math.floor(hashI(i) * palette.length)];
    addGeom(bucket, extrudeFootprint(b.p, b.h), col);
    const bb = polyBBox(b.p);
    const w = bb.maxX - bb.minX, d = bb.maxZ - bb.minZ;
    if (w * d >= 10) kit.addCollider({ x: (bb.minX + bb.maxX) / 2, z: (bb.minZ + bb.maxZ) / 2, w: w * 0.92, d: d * 0.92 });
  }
  const blocksMesh = bucketMesh(bucket, { roughness: 0.95 }); scene.add(blocksMesh); tapTargets.push(blocksMesh);

  // night windows: instanced lit panes on every building tall enough to read as a tower
  const inst = [];
  const paneSrcs = FW.bldgs.concat(
    [FW.heroes.imtower, FW.heroes.lincoln, FW.heroes.embassy].filter(Boolean).map((hh) => ({ p: hh.p, h: hh.h }))
  );
  for (let i = 0; i < paneSrcs.length; i++) {
    const b = paneSrcs[i];
    if (b.h < 7) continue;
    const bb = polyBBox(b.p);
    const w = bb.maxX - bb.minX, d = bb.maxZ - bb.minZ;
    // panes hang on bbox faces — only safe when the footprint actually FILLS its bbox
    // (L-shaped/diagonal footprints otherwise grow floating panes in mid-air)
    let fpArea = 0;
    for (let k = 0; k < b.p.length - 1; k++) fpArea += b.p[k][0] * b.p[k + 1][1] - b.p[k + 1][0] * b.p[k][1];
    if (Math.abs(fpArea / 2) < w * d * 0.72) continue;
    const rows = Math.min(26, Math.floor(b.h / 1.8));
    const faces = [
      { axis: "x", fixed: bb.maxZ + 0.06, len: w, ox: bb.minX, dir: [1, 0] },
      { axis: "x", fixed: bb.minZ - 0.06, len: w, ox: bb.minX, dir: [1, 0] },
      { axis: "z", fixed: bb.maxX + 0.06, len: d, ox: bb.minZ, dir: [0, 1] },
      { axis: "z", fixed: bb.minX - 0.06, len: d, ox: bb.minZ, dir: [0, 1] },
    ];
    for (const f of faces) {
      const cols = Math.min(12, Math.floor(f.len / 2.4));
      for (let r = 0; r < rows; r++) for (let cI = 0; cI < cols; cI++) {
        if (hashI(i * 7919 + r * 131 + cI * 17 + (f.axis === "z" ? 5 : 0)) > 0.42) continue; // most panes stay dark
        const along = f.ox + (cI + 0.75) * (f.len / (cols + 0.5));
        const y = 1.6 + (r + 0.5) * ((b.h - 1.6) / rows);
        if (f.axis === "x") inst.push([along, y, f.fixed, 0]);
        else inst.push([f.fixed, y, along, Math.PI / 2]);
        if (inst.length >= 2300) break;
      }
    }
    if (inst.length >= 2300) break;
  }
  const paneGeo = new THREE.PlaneGeometry(0.95, 1.15);
  const paneMat = new THREE.MeshStandardMaterial({ color: 0x0c0c10, emissive: srgb("#ffd9a0"), emissiveIntensity: 0.02, side: THREE.DoubleSide });
  kit.bindEmissive(paneMat, 1.45, 0.02);
  const panes = new THREE.InstancedMesh(paneGeo, paneMat, inst.length);
  const m4 = new THREE.Matrix4(), e = new THREE.Euler();
  for (let i = 0; i < inst.length; i++) {
    e.set(0, inst[i][3], 0);
    m4.makeRotationFromEuler(e);
    m4.setPosition(inst[i][0], inst[i][1], inst[i][2]);
    panes.setMatrixAt(i, m4);
  }
  scene.add(panes);
}

// ================= HERO ANCHORS ====================================================
function heroCollider(hh, shrink) {
  const s = shrink || 0.94;
  kit.addCollider({ x: (hh.minX + hh.maxX) / 2, z: (hh.minZ + hh.maxZ) / 2, w: (hh.maxX - hh.minX) * s, d: (hh.maxZ - hh.minZ) * s });
}
function buildCourthouse() {
  const h = FW.heroes.courthouse;
  if (!h) return;
  const b = startBucket();
  const stone = srgb("#b9b2a3"), stoneDark = srgb("#a39c8c"), copper = srgb("#5f9c86"), gold = srgb("#d8b84a");
  addGeom(b, extrudeFootprint(h.p, h.h), stone);
  boxInto(b, h.cx, h.h + 0.35, h.cz, (h.maxX - h.minX) * 0.99, 0.7, (h.maxZ - h.minZ) * 0.99, 0, stoneDark); // cornice
  const drum = new THREE.CylinderGeometry(5.6, 6.2, 6.5, 14);
  drum.translate(h.cx, h.h + 3.6, h.cz); addGeom(b, drum, stone);
  const dome = new THREE.SphereGeometry(5.9, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  dome.scale(1, 1.18, 1); dome.translate(h.cx, h.h + 6.8, h.cz); addGeom(b, dome, copper);
  const lant = new THREE.CylinderGeometry(1.0, 1.2, 2.2, 8);
  lant.translate(h.cx, h.h + 14.4, h.cz); addGeom(b, lant, stone);
  const fig = new THREE.ConeGeometry(0.5, 1.8, 6);
  fig.translate(h.cx, h.h + 16.4, h.cz); addGeom(b, fig, gold); // the gilded Lady Liberty, abstracted
  const hm = bucketMesh(b, { roughness: 0.8, metalness: 0.12 }); scene.add(hm); tapTargets.push(hm);
  heroCollider(h);
  place(kit, signPost(["ALLEN COUNTY COURTHOUSE", "1902 - the green dome", "hand-built hero anchor"], { accent: "#8fd8b8" }), h.maxX + 4, h.cz + 8, Math.PI / 2);
}
function buildLincoln() {
  const h = FW.heroes.lincoln;
  if (!h) return;
  const b = startBucket();
  const buff = srgb("#c2a578"), buffD = srgb("#ad9065"), gold = srgb("#caa64f");
  const w = h.maxX - h.minX, d = h.maxZ - h.minZ;
  addGeom(b, extrudeFootprint(h.p, h.h * 0.2), buff);                      // base block
  boxInto(b, h.cx, h.h * 0.5, h.cz, w * 0.62, h.h * 0.62, d * 0.62, 0, buff);   // shaft
  boxInto(b, h.cx, h.h * 0.86, h.cz, w * 0.42, h.h * 0.22, d * 0.42, 0, buffD); // upper setback
  const tip = new THREE.ConeGeometry(Math.min(w, d) * 0.18, 3.2, 4);
  tip.translate(h.cx, h.h + 1.4, h.cz); addGeom(b, tip, gold);             // the deco crown
  const hm = bucketMesh(b, { roughness: 0.85 }); scene.add(hm); tapTargets.push(hm);
  heroCollider(h);
  place(kit, signPost(["LINCOLN BANK TOWER", "1930 art deco - 22 floors", "height hand-anchored (untagged in OSM)"], { accent: "#e8c87f" }), h.maxX + 3, h.maxZ + 3, Math.PI * 0.75);
}
function buildIMTower() {
  const h = FW.heroes.imtower;
  if (!h) return;
  const b = startBucket();
  const white = srgb("#d3d6da"), dark = srgb("#9ba0a8");
  addGeom(b, extrudeFootprint(h.p, h.h), white);
  boxInto(b, h.cx, h.h + 1.4, h.cz, (h.maxX - h.minX) * 0.5, 2.8, (h.maxZ - h.minZ) * 0.5, 0, dark); // mech penthouse
  const mast = new THREE.CylinderGeometry(0.22, 0.32, 9, 6);
  mast.translate(h.cx, h.h + 7.2, h.cz); addGeom(b, mast, dark);
  const hm = bucketMesh(b, { roughness: 0.6, metalness: 0.18 }); scene.add(hm); tapTargets.push(hm);
  const beaconMat = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: srgb("#ff3b30"), emissiveIntensity: 0.4 });
  kit.bindEmissive(beaconMat, 2.6, 0.4);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), beaconMat);
  beacon.position.set(h.cx, h.h + 11.9, h.cz);
  scene.add(beacon);
  kit.addUpdate((dt, t) => { beacon.visible = Math.sin(t * 2.4) > -0.25; }); // slow real-feeling blink
  heroCollider(h);
  place(kit, signPost(["INDIANA MICHIGAN POWER CENTER", "the tallest in the city - 135 m", "its beacon blinks at night"], { accent: "#cfe2ff" }), h.maxX + 3, h.cz, Math.PI / 2);
}
function buildEmbassy() {
  const h = FW.heroes.embassy;
  if (!h) return;
  const b = startBucket();
  const brick = srgb("#7d4f3a"), brickD = srgb("#6a4231");
  addGeom(b, extrudeFootprint(h.p, h.h), brick);
  boxInto(b, h.cx, h.h + 0.3, h.cz, (h.maxX - h.minX) * 0.99, 0.6, (h.maxZ - h.minZ) * 0.99, 0, brickD);
  const hm = bucketMesh(b, { roughness: 0.92 }); scene.add(hm); tapTargets.push(hm);
  heroCollider(h);
  // the marquee + vertical blade sign on the Jefferson Blvd face (south = +z)
  const south = h.maxZ, cx = h.cx;
  const marqueeMat = new THREE.MeshStandardMaterial({ map: textTexture(["EMBASSY", "THEATRE"], { w: 512, h: 192, bg: "#27130c", accent: "#ffd27a", border: true }), emissive: srgb("#ffb45e"), emissiveIntensity: 0.25, emissiveMap: textTexture(["EMBASSY", "THEATRE"], { w: 512, h: 192, bg: "#27130c", accent: "#ffd27a", border: true }) });
  kit.bindEmissive(marqueeMat, 1.6, 0.25);
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(9, 2.2, 0.5), marqueeMat);
  canopy.position.set(cx, 4.6, south + 1.6);
  scene.add(canopy);
  const canopyTop = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.35, 3.4), new THREE.MeshStandardMaterial({ color: srgb("#3a2218") }));
  canopyTop.position.set(cx, 5.9, south + 1.7);
  scene.add(canopyTop);
  const bladeMat = new THREE.MeshStandardMaterial({ map: textTexture(["E", "M", "B", "A", "S", "S", "Y"], { w: 128, h: 640, bg: "#27130c", accent: "#ffd27a", pad: 14, font: "bold 64px system-ui, sans-serif", subFont: "bold 64px system-ui, sans-serif", border: true }), emissive: srgb("#ffb45e"), emissiveIntensity: 0.25 });
  kit.bindEmissive(bladeMat, 1.7, 0.25);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(1.4, 9.5, 0.4), bladeMat);
  blade.position.set(cx + 5.2, h.h * 0.62, south + 0.5);
  scene.add(blade);
  place(kit, signPost(["EMBASSY THEATRE", "1928 movie palace", "the marquee lights at dusk"], { accent: "#ffd27a" }), cx - 8, south + 5, Math.PI);
}
function buildCathedral() {
  const h = FW.heroes.cathedral;
  if (!h) return;
  const b = startBucket();
  const brick = srgb("#6e4438"), slate = srgb("#41444c");
  addGeom(b, extrudeFootprint(h.p, Math.max(h.h, 7.5)), brick);
  // twin spires on the west front (Calhoun side = minX)
  for (const zz of [h.minZ + 2.2, h.maxZ - 2.2]) {
    boxInto(b, h.minX + 2.0, Math.max(h.h, 7.5) + 3.4, zz, 3.4, 7.2, 3.4, 0, brick);
    const spire = new THREE.ConeGeometry(2.1, 8.5, 4);
    spire.translate(h.minX + 2.0, Math.max(h.h, 7.5) + 11.2, zz);
    addGeom(b, spire, slate);
  }
  const hm = bucketMesh(b, { roughness: 0.95 }); scene.add(hm); tapTargets.push(hm);
  heroCollider(h);
  place(kit, signPost(["CATHEDRAL OF THE", "IMMACULATE CONCEPTION", "twin spires since 1860"], { accent: "#d8b8c8" }), h.minX - 4, h.cz, -Math.PI / 2);
}
function buildParkview() {
  const h = FW.heroes.parkview;
  if (!h) return;
  const wallB = startBucket();
  const conc = srgb("#8d9095"), green = srgb("#4e7d46"), clay = srgb("#b08552");
  // open bowl: wall segments along the real footprint, with a NE entry gap
  const gapX = h.maxX - 6, gapZ = h.minZ + 6;
  for (let i = 0; i < h.p.length - 1; i++) {
    const ax = h.p[i][0], az = h.p[i][1], bx = h.p[i + 1][0], bz = h.p[i + 1][1];
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    if (Math.hypot(mx - gapX, mz - gapZ) < 11) continue; // the gate
    const L = Math.hypot(bx - ax, bz - az);
    if (L < 0.5) continue;
    const ang = Math.atan2(bz - az, bx - ax);
    boxInto(wallB, mx, 2.4, mz, L + 0.4, 4.8, 1.1, ang, conc);
    kit.addCollider({ x: mx, z: mz, w: Math.max(1.4, Math.abs(bx - ax)), d: Math.max(1.4, Math.abs(bz - az)) });
  }
  const hm = bucketMesh(wallB, { roughness: 0.9 }); scene.add(hm); tapTargets.push(hm);
  // the field
  const fieldGeo = new THREE.ShapeGeometry(shapeFrom(h.p));
  fieldGeo.rotateX(-Math.PI / 2);
  const field = new THREE.Mesh(fieldGeo, new THREE.MeshStandardMaterial({ color: green, roughness: 1 }));
  field.position.y = 0.07;
  scene.add(field);
  const diamond = new THREE.Mesh(new THREE.CircleGeometry(7.5, 4), new THREE.MeshStandardMaterial({ color: clay, roughness: 1 }));
  diamond.rotation.x = -Math.PI / 2; diamond.rotation.z = Math.PI / 4;
  diamond.position.set(h.cx - 4, 0.09, h.cz + 4); // home toward downtown-facing SW, outfield NE
  scene.add(diamond);
  // light standards
  const lightMat = new THREE.MeshStandardMaterial({ color: 0x16181c, emissive: srgb("#fff3d8"), emissiveIntensity: 0.05 });
  kit.bindEmissive(lightMat, 2.0, 0.05);
  for (const [lx, lz] of [[h.minX + 4, h.minZ + 4], [h.maxX - 4, h.minZ + 4], [h.minX + 4, h.maxZ - 4], [h.maxX - 4, h.maxZ - 4]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 11, 6), new THREE.MeshStandardMaterial({ color: 0x2c3036 }));
    pole.position.set(lx, 5.5, lz); scene.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.2, 0.4), lightMat);
    head.position.set(lx, 11.2, lz);
    head.lookAt(h.cx, 2, h.cz);
    scene.add(head);
  }
  place(kit, signPost(["PARKVIEW FIELD", "the downtown ballpark (2009)", "walk in through the NE gate"], { accent: "#9fe2a8" }), gapX + 4, gapZ - 4, Math.PI * 0.25);
}
function buildWellsBridge() {
  const a = FW.heroes.wellsBridge;
  if (!a) return;
  const b = startBucket();
  const iron = srgb("#5e4a40");
  const len = Math.max(24, a.len + 6), half = len / 2;
  const dx = Math.cos(a.ang), dz = Math.sin(a.ang);
  const px = -dz, pz = dx;
  for (const side of [-1, 1]) {
    const ox = a.x + px * 2.6 * side, oz = a.z + pz * 2.6 * side;
    boxInto(b, ox, 1.0, oz, len, 0.5, 0.3, a.ang, iron); // bottom chord
    const SEG = 8;
    let prev = null;
    for (let s = 0; s <= SEG; s++) {
      const t = s / SEG;
      const along = (t - 0.5) * len;
      const y = 1.0 + Math.sin(Math.PI * t) * 5.2; // the through-truss arch
      const cx = ox + dx * along, cz = oz + dz * along;
      if (prev) {
        const mx = (prev.cx + cx) / 2, mz = (prev.cz + cz) / 2, my = (prev.y + y) / 2;
        const L = Math.hypot(cx - prev.cx, cz - prev.cz, y - prev.y);
        const g = new THREE.BoxGeometry(L, 0.34, 0.3);
        g.rotateZ(Math.atan2(y - prev.y, len / SEG));
        g.rotateY(-a.ang);
        g.translate(mx, my, mz);
        addGeom(b, g, iron);
      }
      if (s > 0 && s < SEG) boxInto(b, cx, (y + 1.0) / 2, cz, 0.26, y - 1.0, 0.26, a.ang, iron); // verticals
      prev = { cx, cz, y };
    }
  }
  for (let s = 1; s < 8; s++) { // top portal cross-beams
    const t = s / 8, along = (t - 0.5) * len;
    const y = 1.0 + Math.sin(Math.PI * t) * 5.2;
    boxInto(b, a.x + dx * along, y, a.z + dz * along, 0.26, 0.26, 5.2, a.ang + Math.PI / 2, iron);
  }
  scene.add(bucketMesh(b, { roughness: 0.7, metalness: 0.3 }));
  place(kit, signPost(["WELLS STREET BRIDGE", "1884 iron truss - now a footbridge", "hero anchor on the St. Marys"], { accent: "#e0b890" }), a.x + px * 7, a.z + pz * 7 + 6, 0);
}
function buildMLKBridge() {
  const a = FW.heroes.mlkBridge;
  if (!a) return;
  const archMat = new THREE.MeshStandardMaterial({ color: srgb("#e8eaee"), emissive: srgb("#dfe8ff"), emissiveIntensity: 0.1, roughness: 0.5 });
  kit.bindEmissive(archMat, 1.5, 0.1); // the real bridge is LED-lit at night
  const b = startBucket();
  const white = srgb("#e8eaee");
  const len = 30, half = len / 2;
  const dx = Math.cos(a.ang), dz = Math.sin(a.ang);
  const px = -dz, pz = dx;
  const group = new THREE.Group();
  for (const side of [-1, 1]) {
    const ox = a.x + px * 4.2 * side, oz = a.z + pz * 4.2 * side;
    const SEG = 10;
    let prev = null;
    for (let s = 0; s <= SEG; s++) {
      const t = s / SEG;
      const along = (t - 0.5) * len;
      const y = 0.7 + Math.sin(Math.PI * t) * 7.4; // basket-handle arch
      const cx = ox + dx * along, cz = oz + dz * along;
      if (prev) {
        const mx = (prev.cx + cx) / 2, mz = (prev.cz + cz) / 2, my = (prev.y + y) / 2;
        const L = Math.hypot(cx - prev.cx, cz - prev.cz, y - prev.y);
        const g = new THREE.BoxGeometry(L, 0.5, 0.45);
        g.rotateZ(Math.atan2(y - prev.y, len / SEG));
        g.rotateY(-a.ang);
        g.translate(mx, my, mz);
        addGeom(b, g, white);
      }
      if (s > 0 && s < SEG && s % 2 === 0) boxInto(b, cx, (y + 0.7) / 2, cz, 0.12, y - 0.7, 0.12, a.ang, white); // cable verticals
      prev = { cx, cz, y };
    }
  }
  const archMesh = bucketMesh(b, {});
  archMesh.material = archMat;
  group.add(archMesh);
  scene.add(group);
  place(kit, signPost(["MARTIN LUTHER KING JR.", "MEMORIAL BRIDGE", "lit white over the St. Marys"], { accent: "#dfe8ff" }), a.x + 8, a.z + 6, 0);
}

// ================= LABELS / SIGNS / LIFE ===========================================
function buildLabels() {
  for (const L of FW.labels) {
    const sp = kit.makeNameSprite(L.t, L.river ? 2.3 : L.park ? 1.7 : 1.25);
    sp.position.set(L.x, L.river ? WATER_Y + 4.2 : groundHeight(L.x, L.z) + (L.park ? 6 : 7.5), L.z);
    scene.add(sp);
  }
}
function buildSignsAndLife() {
  // honest framing at spawn
  place(kit, signPost(["FORT WAYNE - PHASE 1", "recognition lab - real OSM street grid", "interpreted, not 1:1 - phase one"], { accent: "#9fd0ff" }), FW.spawn.x + 2.5, FW.spawn.z + 4, Math.PI * 0.9);
  // the confluence — the signature
  if (FW.confluence) {
    const c = FW.confluence;
    place(kit, signPost(["THE CONFLUENCE", "St. Joseph + St. Marys -> the Maumee", "the signature almost no city has"], { accent: "#8fd8c8" }), c.x - 2, c.z + 16, Math.PI * 0.1);
  }
  // Anthony Wayne in Freimann Square (the real statue stands there)
  const freimann = FW.parks.find((p) => p.n && /Freimann Square/.test(p.n));
  if (freimann) {
    const bb = polyBBox(freimann.p);
    const cx = (bb.minX + bb.maxX) / 2, cz = (bb.minZ + bb.maxZ) / 2;
    place(kit, statue(kit, { plaque: ["GEN. ANTHONY WAYNE", "the city's namesake"] }), cx, cz, Math.PI);
    place(kit, bench({}), cx - 4, cz + 3, Math.PI / 2);
    place(kit, bench({}), cx + 4, cz + 3, -Math.PI / 2);
  }
  // park trees (deterministic scatter inside real park polygons)
  let planted = 0;
  for (let k = 0; k < FW.parks.length && planted < 14; k++) {
    const p = FW.parks[k];
    const bb = polyBBox(p.p);
    if ((bb.maxX - bb.minX) * (bb.maxZ - bb.minZ) < 900) continue;
    for (let tIdx = 0; tIdx < 3 && planted < 14; tIdx++) {
      const x = bb.minX + (0.2 + 0.6 * hashI(k * 53 + tIdx * 7)) * (bb.maxX - bb.minX);
      const z = bb.minZ + (0.2 + 0.6 * hashI(k * 91 + tIdx * 13)) * (bb.maxZ - bb.minZ);
      if (!pip(x, z, p.p) || groundHeight(x, z) < -0.3) continue;
      place(kit, tree("oak", { seed: k * 100 + tIdx }), x, z);
      planted++;
    }
  }
  // street lamps along the majors — the downtown spine reads at night
  let lamps = 0;
  for (const r of FW.roads) {
    if (r.c !== 0 || r.b || lamps >= 14) continue;
    let acc = 0;
    for (let i = 0; i < r.pts.length - 1 && lamps < 14; i++) {
      const ax = r.pts[i][0], az = r.pts[i][1], bx = r.pts[i + 1][0], bz = r.pts[i + 1][1];
      const L = Math.hypot(bx - ax, bz - az);
      acc += L;
      if (acc > 55) {
        acc = 0;
        const px2 = -(bz - az) / L, pz2 = (bx - ax) / L;
        const side = lamps % 2 ? 1 : -1;
        const x = (ax + bx) / 2 + px2 * (r.w / 2 + 1.2) * side, z = (az + bz) / 2 + pz2 * (r.w / 2 + 1.2) * side;
        if (groundHeight(x, z) > -0.2) { place(kit, streetLamp(kit), x, z, Math.atan2(pz2, px2) + (side > 0 ? Math.PI : 0)); lamps++; }
      }
    }
  }
}

// ================= BOOT (end of file — TDZ law) ====================================
labChrome({
  name: "Fort Wayne",
  accent: "#9fd0ff",
  tagline: "Downtown as an interpreted digital twin — three rivers, real streets, hero landmarks.",
});
buildGround();
buildWater();
buildRoads();
buildBlocks();
buildCourthouse();
buildLincoln();
buildIMTower();
buildEmbassy();
buildCathedral();
buildParkview();
buildWellsBridge();
buildMLKBridge();
buildLabels();
buildSignsAndLife();
setupTapIdentify();
kit.start();
