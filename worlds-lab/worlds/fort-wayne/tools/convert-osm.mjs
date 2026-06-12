#!/usr/bin/env node
// WORLDS LAB · Fort Wayne · convert-osm.mjs — the converter (worlds-become-data, city edition).
// Reads a raw OpenStreetMap Overpass extract (overpass-query.txt is the exact query)
// and emits ../data.js: rivers as polygons, roads as ribbons (bridges flagged),
// rails, building footprints with true-where-tagged heights, parks, hero anchors,
// street/river labels, and the spawn. Pure node, zero dependencies.
//
// Usage:  node convert-osm.mjs /path/to/fw-osm.json
// Source data (c) OpenStreetMap contributors, ODbL — see CREDITS.md.
import fs from "node:fs";

const SRC = process.argv[2] || "fw-osm.json";
const OUT = new URL("../data.js", import.meta.url).pathname;

// ---- projection: equirectangular around the bbox center, 1 unit = 2 m (S=0.5) ----
const BBOX = { s: 41.0690, w: -85.1480, n: 41.0870, e: -85.1260 };
const LAT0 = (BBOX.s + BBOX.n) / 2, LON0 = (BBOX.w + BBOX.e) / 2;
const M_LAT = 111132, M_LON = 111320 * Math.cos(LAT0 * Math.PI / 180);
const S = 0.5; // world units per meter
const r1 = (v) => Math.round(v * 10) / 10;
const PX = (lon) => (lon - LON0) * M_LON * S;
const PZ = (lat) => -(lat - LAT0) * M_LAT * S; // north = -z
const proj = (g) => g.map((p) => [PX(p.lon), PZ(p.lat)]);

// ---- clip rect (the projected bbox): Overpass returns FULL geometry of anything that
// touches the bbox, so rivers/rails run kilometers past it. Everything is clipped here.
const RECT = { minX: PX(BBOX.w), maxX: PX(BBOX.e), minZ: PZ(BBOX.n), maxZ: PZ(BBOX.s) };
function clipPoly(pts) { // Sutherland-Hodgman against RECT
  let ring = closed(pts) ? pts.slice(0, -1) : pts.slice();
  const edges = [
    (p) => p[0] >= RECT.minX, (a, b) => lerpAt(a, b, (RECT.minX - a[0]) / (b[0] - a[0])),
    (p) => p[0] <= RECT.maxX, (a, b) => lerpAt(a, b, (RECT.maxX - a[0]) / (b[0] - a[0])),
    (p) => p[1] >= RECT.minZ, (a, b) => lerpAt(a, b, (RECT.minZ - a[1]) / (b[1] - a[1])),
    (p) => p[1] <= RECT.maxZ, (a, b) => lerpAt(a, b, (RECT.maxZ - a[1]) / (b[1] - a[1])),
  ];
  for (let e = 0; e < 8; e += 2) {
    const inside = edges[e], cross = edges[e + 1], out = [];
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      const ia = inside(a), ib = inside(b);
      if (ia) { out.push(a); if (!ib) out.push(cross(a, b)); }
      else if (ib) out.push(cross(a, b));
    }
    ring = out;
    if (ring.length < 3) return null;
  }
  ring.push(ring[0].slice());
  return ring;
}
function lerpAt(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
function bufferLine(pts, half) { // centerline -> closed ribbon polygon (miter, clamped)
  if (pts.length < 2) return null;
  const L = [], R = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let dx = b[0] - a[0], dz = b[1] - a[1];
    const n = Math.hypot(dx, dz) || 1; dx /= n; dz /= n;
    L.push([pts[i][0] - dz * half, pts[i][1] + dx * half]);
    R.push([pts[i][0] + dz * half, pts[i][1] - dx * half]);
  }
  const ring = L.concat(R.reverse());
  ring.push(ring[0].slice());
  return ring;
}
function clipLine(pts) { // split a polyline into the pieces inside RECT
  const inside = (p) => p[0] >= RECT.minX && p[0] <= RECT.maxX && p[1] >= RECT.minZ && p[1] <= RECT.maxZ;
  const segs = []; let cur = [];
  const border = (a, b) => { // first intersection of a->b with RECT border (Liang-Barsky)
    let t0 = 0, t1 = 1; const dx = b[0] - a[0], dz = b[1] - a[1];
    const cl = [[-dx, a[0] - RECT.minX], [dx, RECT.maxX - a[0]], [-dz, a[1] - RECT.minZ], [dz, RECT.maxZ - a[1]]];
    for (const [p, q] of cl) {
      if (p === 0) { if (q < 0) return null; continue; }
      const r = q / p;
      if (p < 0) { if (r > t1) return null; if (r > t0) t0 = r; }
      else { if (r < t0) return null; if (r < t1) t1 = r; }
    }
    return [t0, t1];
  };
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const ia = inside(a), ib = inside(b);
    if (ia && ib) { if (!cur.length) cur.push(a); cur.push(b); continue; }
    const ts = border(a, b);
    if (!ts) { if (cur.length > 1) segs.push(cur); cur = []; continue; }
    const [t0, t1] = ts;
    const pA = ia ? a : lerpAt(a, b, t0);
    const pB = ib ? b : lerpAt(a, b, t1);
    if (!cur.length) cur.push(pA); else if (!ia) { if (cur.length > 1) segs.push(cur); cur = [pA]; }
    cur.push(pB);
    if (!ib) { if (cur.length > 1) segs.push(cur); cur = []; }
  }
  if (cur.length > 1) segs.push(cur);
  return segs;
}

// ---- geometry helpers ----
function closed(pts) { const a = pts[0], b = pts[pts.length - 1]; return Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6; }
function areaM2(pts) { // shoelace, in square meters (pts are in units; 1u = 1/S m)
  let s = 0;
  for (let i = 0; i < pts.length - 1; i++) s += pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1];
  return Math.abs(s / 2) / (S * S);
}
function centroid(pts) {
  let x = 0, z = 0, n = closed(pts) ? pts.length - 1 : pts.length;
  for (let i = 0; i < n; i++) { x += pts[i][0]; z += pts[i][1]; }
  return [x / n, z / n];
}
function simplify(pts, eps) { // Douglas-Peucker
  if (pts.length <= 4) return pts;
  const keep = new Array(pts.length).fill(false);
  keep[0] = keep[pts.length - 1] = true;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let dmax = 0, idx = -1;
    const ax = pts[a][0], az = pts[a][1], bx = pts[b][0], bz = pts[b][1];
    const dx = bx - ax, dz = bz - az, len2 = dx * dx + dz * dz || 1e-9;
    for (let i = a + 1; i < b; i++) {
      const t = Math.max(0, Math.min(1, ((pts[i][0] - ax) * dx + (pts[i][1] - az) * dz) / len2));
      const qx = ax + t * dx - pts[i][0], qz = az + t * dz - pts[i][1];
      const d = qx * qx + qz * qz;
      if (d > dmax) { dmax = d; idx = i; }
    }
    if (Math.sqrt(dmax) > eps && idx > 0) { keep[idx] = true; stack.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
function rnd(pts) { return pts.map((p) => [r1(p[0]), r1(p[1])]); }
function polyLen(pts) { let l = 0; for (let i = 0; i < pts.length - 1; i++) l += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); return l; }
function midpoint(pts) {
  const half = polyLen(pts) / 2; let acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const seg = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    if (acc + seg >= half) {
      const t = (half - acc) / (seg || 1e-9);
      return { x: pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, z: pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t, ang: Math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0]) };
    }
    acc += seg;
  }
  const c = centroid(pts); return { x: c[0], z: c[1], ang: 0 };
}
function pointInPoly(x, z, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0], zi = pts[i][1], xj = pts[j][0], zj = pts[j][1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
// stitch relation member ways (role outer) into closed rings
function stitchOuters(rel) {
  const segs = (rel.members || []).filter((m) => m.type === "way" && (m.role === "outer" || m.role === "") && m.geometry).map((m) => proj(m.geometry));
  const rings = [];
  while (segs.length) {
    let ring = segs.shift();
    let grew = true;
    while (!closed(ring) && grew) {
      grew = false;
      for (let i = 0; i < segs.length; i++) {
        const s = segs[i];
        const rh = ring[0], re = ring[ring.length - 1], ss = s[0], se = s[s.length - 1];
        const eq = (a, b) => Math.abs(a[0] - b[0]) < 0.01 && Math.abs(a[1] - b[1]) < 0.01;
        if (eq(re, ss)) { ring = ring.concat(s.slice(1)); segs.splice(i, 1); grew = true; break; }
        if (eq(re, se)) { ring = ring.concat(s.slice(0, -1).reverse()); segs.splice(i, 1); grew = true; break; }
        if (eq(rh, se)) { ring = s.slice(0, -1).concat(ring); segs.splice(i, 1); grew = true; break; }
        if (eq(rh, ss)) { ring = s.slice(1).reverse().concat(ring); segs.splice(i, 1); grew = true; break; }
      }
    }
    if (closed(ring) && ring.length > 3) rings.push(ring);
  }
  return rings;
}
function parseHeightMeters(t) {
  if (!t) return null;
  const raw = String(t).trim();
  const ft = raw.match(/^([\d.]+)\s*(?:'|ft)/i);
  if (ft) return parseFloat(ft[1]) * 0.3048;
  const m = raw.match(/^([\d.]+)/);
  return m ? parseFloat(m[1]) : null;
}
function maxLevels(t) {
  if (!t) return 0;
  const ns = String(t).split(/[;,]/).map(parseFloat).filter((n) => !isNaN(n));
  return ns.length ? Math.max(...ns) : 0;
}
function hash(id) { let h = id >>> 0; h = (h ^ 61) ^ (h >>> 16); h = (h + (h << 3)) | 0; h = h ^ (h >>> 4); h = Math.imul(h, 0x27d4eb2d); h = h ^ (h >>> 15); return (h >>> 0) / 4294967295; }

// ---- read ----
const raw = JSON.parse(fs.readFileSync(SRC, "utf8"));
const els = raw.elements;

const ROAD_W = { motorway: 14, trunk: 13, primary: 12, secondary: 10.5, tertiary: 9.5, residential: 8, unclassified: 8, living_street: 7, pedestrian: 5.5 };
const HERO_BY_NAME = {
  "Allen County Courthouse": "courthouse",
  "Embassy Theatre": "embassy",
  "Indiana Michigan Power Center": "imtower",
  "Cathedral of the Immaculate Conception": "cathedral",
  "Parkview Field": "parkview",
};
// Lincoln Bank Tower (1930, 22 floors / 312 ft ~ 95 m) carries no name in this OSM
// extract (its way is tagged only building:levels=15 + a restaurant POI). Anchor it by a
// point inside its real footprint: mid-block, south side of E Berry between Calhoun and
// Clinton (verified against the extract's footprint at centroid 41.07993,-85.13791).
const LINCOLN_PT = [PX(-85.13791), PZ(41.07993)];
const LINCOLN_H = 95;

const roads = [], rails = [], bldgs = [], water = [], parks = [], heroes = {}, riverLabels = [];
const pois = []; // named POI nodes (amenity/shop/tourism/office/leisure) — matched into footprints below
const riverEnds = []; // named centerline endpoints — the shared one is THE CONFLUENCE
const roadByName = new Map();
const bridgeWays = [];

for (const e of els) {
  const t = e.tags || {};
  if (e.type === "node") { // named POIs — the query now requests these (tap-to-identify data)
    if (t.name && e.lat != null) {
      const x = PX(e.lon), z = PZ(e.lat);
      if (x >= RECT.minX && x <= RECT.maxX && z >= RECT.minZ && z <= RECT.maxZ) pois.push({ n: t.name, x, z });
    }
    continue;
  }
  if (e.type === "way" && t.highway && ROAD_W[t.highway]) {
    let rec = null;
    for (const piece of clipLine(proj(e.geometry))) {
      const pts = rnd(simplify(piece, 0.6));
      if (pts.length < 2) continue;
      rec = { w: r1(ROAD_W[t.highway] * S), c: (t.highway === "primary" || t.highway === "trunk" || t.highway === "motorway") ? 0 : (t.highway === "secondary" ? 1 : (t.highway === "tertiary" ? 2 : (t.highway === "pedestrian" ? 4 : 3))), pts };
      if (t.bridge && t.bridge !== "no") { rec.b = 1; bridgeWays.push({ name: t.name || "", pts, layer: t.layer }); }
      rec.inferName = t.name || "";
      roads.push(rec);
    }
    if (!rec) continue;
    const pts = rec.pts;
    if (t.name && rec.c <= 3) {
      const k = t.name;
      if (!roadByName.has(k)) roadByName.set(k, { len: 0, best: null, bestLen: 0, cls: rec.c });
      const g = roadByName.get(k);
      const L = polyLen(pts);
      g.len += L; g.cls = Math.min(g.cls, rec.c);
      if (L > g.bestLen) { g.bestLen = L; g.best = pts; }
    }
    continue;
  }
  if (e.type === "way" && t.railway === "rail") {
    for (const piece of clipLine(proj(e.geometry))) {
      const pts = rnd(simplify(piece, 0.8));
      if (pts.length >= 2) rails.push({ pts, b: t.bridge && t.bridge !== "no" ? 1 : 0 });
    }
    continue;
  }
  if (t.building && t.building !== "no") {
    let rings = [];
    if (e.type === "way" && e.geometry) { const p = proj(e.geometry); if (closed(p)) rings = [p]; }
    else if (e.type === "relation") rings = stitchOuters(e);
    for (let ring of rings) {
      ring = clipPoly(ring);
      if (!ring) continue;
      const a = areaM2(ring);
      if (a < 25) continue;
      const pts = rnd(simplify(ring, 0.5));
      if (pts.length < 4) continue;
      const heroKey = HERO_BY_NAME[t.name] || (pointInPoly(LINCOLN_PT[0], LINCOLN_PT[1], ring) ? "lincoln" : null);
      let h = parseHeightMeters(t.height);
      const lv = maxLevels(t["building:levels"]);
      if (h == null && lv) h = lv * 3.4 + 2;
      if (h == null) h = a >= 700 ? 10 : a >= 200 ? 7.5 : 5.2;
      if (heroKey === "lincoln") h = LINCOLN_H;
      if (!heroKey) h = Math.min(60, h * (0.92 + hash(e.id) * 0.2));
      const rec = { p: pts, h: r1(h * S) };
      if (t.name) rec.n = t.name; // real OSM name — tap-to-identify shows it
      if (heroKey) {
        const c = centroid(pts);
        let xs = pts.map((q) => q[0]), zs = pts.map((q) => q[1]);
        heroes[heroKey] = { p: pts, h: rec.h, cx: r1(c[0]), cz: r1(c[1]), minX: r1(Math.min(...xs)), maxX: r1(Math.max(...xs)), minZ: r1(Math.min(...zs)), maxZ: r1(Math.max(...zs)), n: t.name || "Lincoln Bank Tower" };
      } else {
        bldgs.push(rec);
      }
    }
    continue;
  }
  const isWater = t.natural === "water" || t.waterway === "riverbank" || (t.waterway === "canal" && e.type === "way");
  if (isWater) {
    let rings = [];
    if (e.type === "way" && e.geometry) { const p = proj(e.geometry); if (closed(p)) rings = [p]; }
    else if (e.type === "relation") rings = stitchOuters(e);
    for (let ring of rings) {
      ring = clipPoly(ring);
      if (!ring || areaM2(ring) < 150) continue;
      water.push({ p: rnd(simplify(ring, 1.0)), n: t.name || 0 });
    }
    if (t.name && /river/i.test(t.name)) { const c = e.type === "way" && !closed(proj(e.geometry)) ? midpoint(proj(e.geometry)) : null; if (c) riverLabels.push({ t: t.name, x: r1(c.x), z: r1(c.z) }); }
    continue;
  }
  if (t.waterway === "river" && e.type === "way" && e.geometry) {
    // Centerline. Parts of the St. Marys exist ONLY as a centerline in OSM (no riverbank
    // polygon at the Clinton St / MLK Memorial Bridge stretch). The river is real there,
    // so buffer the centerline into a water body; where riverbank polys also exist the
    // overlap is harmless (same material). Width by river (true-to-life, approximate).
    const half = (/maumee/i.test(t.name || "") ? 26 : /joseph/i.test(t.name || "") ? 20 : 17) * S;
    for (const piece of clipLine(proj(e.geometry))) {
      if (polyLen(piece) < 10) continue;
      const ring = bufferLine(simplify(piece, 1.0), half);
      const clipped = ring && clipPoly(ring);
      if (clipped && areaM2(clipped) >= 150) water.push({ p: rnd(clipped), n: 0 });
    }
    if (t.name) {
      const inb = clipLine(proj(e.geometry));
      if (inb.length) { const c = midpoint(inb.sort((p, q) => polyLen(q) - polyLen(p))[0]); riverLabels.push({ t: t.name, x: r1(c.x), z: r1(c.z) }); }
      const g = proj(e.geometry);
      riverEnds.push({ n: t.name, p: g[0] }, { n: t.name, p: g[g.length - 1] });
    }
    continue;
  }
  if (t.leisure === "park" || t.leisure === "garden" || t.leisure === "pitch") {
    let rings = [];
    if (e.type === "way" && e.geometry) { const p = proj(e.geometry); if (closed(p)) rings = [p]; }
    else if (e.type === "relation") rings = stitchOuters(e);
    for (let ring of rings) {
      ring = clipPoly(ring);
      if (!ring || areaM2(ring) < 400) continue;
      parks.push({ p: rnd(simplify(ring, 1.2)), n: (t.leisure === "park" && t.name) ? t.name : 0 });
    }
    continue;
  }
  if (t.leisure === "stadium" && t.name === "Parkview Field" && e.type === "way" && e.geometry) {
    const ring = proj(e.geometry);
    if (closed(ring)) {
      const pts = rnd(simplify(ring, 1.2));
      const c = centroid(pts);
      let xs = pts.map((q) => q[0]), zs = pts.map((q) => q[1]);
      heroes.parkview = { p: pts, h: r1(9 * S), cx: r1(c[0]), cz: r1(c[1]), minX: r1(Math.min(...xs)), maxX: r1(Math.max(...xs)), minZ: r1(Math.min(...zs)), maxZ: r1(Math.max(...zs)), n: "Parkview Field" };
    }
    continue;
  }
}

// ---- bridge inference: OSM gap repair (e.g. Clinton St / US 27 over the St. Marys —
// the MLK Memorial Bridge — carries no bridge tag in this extract). Any road whose
// midpoints fall inside a water polygon IS a bridge in reality; reality wins.
for (const r of roads) {
  if (r.b) continue;
  let inWater = false;
  for (let i = 0; i < r.pts.length - 1 && !inWater; i++) {
    const ax = r.pts[i][0], az = r.pts[i][1], bx = r.pts[i + 1][0], bz = r.pts[i + 1][1];
    const L = Math.hypot(bx - ax, bz - az), steps = Math.max(1, Math.ceil(L / 3));
    for (let s = 0; s <= steps && !inWater; s++) {
      const t = s / steps, mx = ax + (bx - ax) * t, mz = az + (bz - az) * t;
      for (const w of water) { if (pointInPoly(mx, mz, w.p)) { inWater = true; break; } }
    }
  }
  if (inWater) { r.b = 1; bridgeWays.push({ name: r.inferName || "", pts: r.pts }); }
}

// ---- named POIs -> the footprint that contains them (storefronts inside larger
// buildings: a block building can house several named businesses). POIs landing in a
// hero footprint are skipped — the hero name is the identity. POIs in no footprint
// are dropped (kiosks, vending) — nothing is invented. ----
const _bbb = bldgs.map((b) => {
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  for (const q of b.p) { if (q[0] < minX) minX = q[0]; if (q[0] > maxX) maxX = q[0]; if (q[1] < minZ) minZ = q[1]; if (q[1] > maxZ) maxZ = q[1]; }
  return { minX, maxX, minZ, maxZ };
});
let poiMatched = 0;
for (const poi of pois) {
  for (let i = 0; i < bldgs.length; i++) {
    const r = _bbb[i];
    if (poi.x < r.minX || poi.x > r.maxX || poi.z < r.minZ || poi.z > r.maxZ) continue;
    if (!pointInPoly(poi.x, poi.z, bldgs[i].p)) continue;
    const b = bldgs[i];
    if (b.n !== poi.n) { if (!b.biz) b.biz = []; if (!b.biz.includes(poi.n)) b.biz.push(poi.n); }
    poiMatched++;
    break;
  }
}

// ---- water label dedup (one per river name, prefer the in-bounds-most) ----
const riverSeen = new Map();
for (const L of riverLabels) if (!riverSeen.has(L.t)) riverSeen.set(L.t, L);

// ---- bridge hero anchors ----
function bridgeAnchor(nameRe, nearZ) {
  const hits = bridgeWays.filter((b) => nameRe.test(b.name));
  if (!hits.length) return null;
  // prefer the crossing nearest nearZ (Clinton St bridges BOTH the St. Marys downtown —
  // the MLK Memorial Bridge — and the St. Joseph at the bbox's north edge); else longest.
  if (typeof nearZ === "number") hits.sort((a, b) => Math.abs(midpoint(a.pts).z - nearZ) - Math.abs(midpoint(b.pts).z - nearZ));
  else hits.sort((a, b) => polyLen(b.pts) - polyLen(a.pts));
  const m = midpoint(hits[0].pts);
  return { x: r1(m.x), z: r1(m.z), ang: r1(m.ang), len: r1(polyLen(hits[0].pts)) };
}
const wells = bridgeAnchor(/Wells/i);
const mlk = bridgeAnchor(/Clinton/i, -488); // Clinton crosses the St. Marys at the
// north edge of the bbox (the river loops up around Headwaters Park) — the data proved
// my first guess of z=-289 wrong; the MLK Memorial Bridge deck sits at z~-490.
if (wells) heroes.wellsBridge = wells;
if (mlk) heroes.mlkBridge = mlk;

// ---- street labels: top names by total length ----
const ABBR = [[/\bStreet\b/i, "ST"], [/\bAvenue\b/i, "AVE"], [/\bBoulevard\b/i, "BLVD"], [/\bDrive\b/i, "DR"], [/\bRoad\b/i, "RD"], [/\bCourt\b/i, "CT"], [/\bLane\b/i, "LN"], [/\bWay\b/i, "WAY"], [/\bNorth\b/i, "N"], [/\bSouth\b/i, "S"], [/\bEast\b/i, "E"], [/\bWest\b/i, "W"]];
const labels = [];
const byLen = [...roadByName.entries()].sort((a, b) => (a[1].cls - b[1].cls) || (b[1].len - a[1].len)).slice(0, 26);
for (const [name, g] of byLen) {
  let short = name; for (const [re, sub] of ABBR) short = short.replace(re, sub);
  const m = midpoint(g.best);
  labels.push({ t: short.toUpperCase(), x: r1(m.x), z: r1(m.z) });
}
for (const [, L] of riverSeen) labels.push({ t: L.t.toUpperCase(), x: L.x, z: L.z, river: 1 });
for (const p of parks) if (p.n && /Headwaters|Promenade|Freimann|Old Fort/.test(p.n)) { const c = centroid(p.p); labels.push({ t: p.n.toUpperCase(), x: r1(c[0]), z: r1(c[1]), park: 1 }); }

// ---- the confluence: the point where two named rivers share an endpoint ----
let confluence = null;
for (let i = 0; i < riverEnds.length && !confluence; i++)
  for (let j = i + 1; j < riverEnds.length; j++) {
    const a = riverEnds[i], b = riverEnds[j];
    if (a.n !== b.n && Math.hypot(a.p[0] - b.p[0], a.p[1] - b.p[1]) < 2) { confluence = { x: r1(a.p[0]), z: r1(a.p[1]) }; break; }
  }

// ---- spawn: on the Courthouse Green, facing the courthouse dome ----
let spawn = { x: 0, z: 6, yaw: 0 };
if (heroes.courthouse) {
  const cx = heroes.courthouse.cx, cz = heroes.courthouse.cz;
  const sx = heroes.courthouse.maxX + 26, sz = cz; // east of the courthouse, on the green
  const dx = cx - sx, dz = cz - sz;
  const n = Math.hypot(dx, dz) || 1;
  spawn = { x: r1(sx), z: r1(sz), yaw: r1(Math.atan2(-(dx / n), -(dz / n)) * 1000) / 1000 };
}

// ---- extents ----
let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
const eat = (pts) => { for (const q of pts) { if (q[0] < minX) minX = q[0]; if (q[0] > maxX) maxX = q[0]; if (q[1] < minZ) minZ = q[1]; if (q[1] > maxZ) maxZ = q[1]; } };
roads.forEach((r) => eat(r.pts)); bldgs.forEach((b) => eat(b.p)); water.forEach((w) => eat(w.p));

for (const r of roads) delete r.inferName;

const FW = {
  meta: {
    source: "OpenStreetMap (c) OpenStreetMap contributors, ODbL 1.0",
    query: "tools/overpass-query.txt",
    osmTimestamp: raw.osm3s.timestamp_osm_base,
    generated: new Date().toISOString().slice(0, 10),
    bbox: [BBOX.s, BBOX.w, BBOX.n, BBOX.e],
    unitsPerMeter: S,
  },
  ext: { minX: r1(minX), maxX: r1(maxX), minZ: r1(minZ), maxZ: r1(maxZ) },
  spawn, confluence, water, roads, rails, bldgs, parks, heroes, labels,
};

const js = "// Fort Wayne — Phase 1 world data. GENERATED by tools/convert-osm.mjs — do not hand-edit.\n" +
  "// Map data (c) OpenStreetMap contributors, ODbL 1.0 (openstreetmap.org/copyright). See CREDITS.md.\n" +
  "export const FW = " + JSON.stringify(FW) + ";\n";
fs.writeFileSync(OUT, js);
console.log("data.js written:", (js.length / 1024).toFixed(1) + "KB",
  "| roads", roads.length, "| bldgs", bldgs.length,
  "| named", bldgs.filter((b) => b.n || b.biz).length, "(" + bldgs.filter((b) => b.n).length, "own-name,", poiMatched, "POIs matched of", pois.length + ")",
  "| water", water.length, "| parks", parks.length,
  "| heroes", Object.keys(heroes).join(","), "| labels", labels.length,
  "| ext", JSON.stringify(FW.ext), "| spawn", JSON.stringify(spawn));
