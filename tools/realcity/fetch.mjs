#!/usr/bin/env node
// Real City data step: OpenStreetMap (Overpass) + optional USGS 3DEP elevation -> compact 250 m tiles.
//
//   node tools/realcity/fetch.mjs --city fort-wayne                 (uses realcity/cities.json)
//   node tools/realcity/fetch.mjs --city chicago --bbox 41.872,-87.640,41.890,-87.620 --origin 41.8819,-87.6278 --name "Chicago Loop"
//   flags: --elev (sample 3DEP), --tile 250, --cell 1000 (metres per Overpass query), --wait 4 (seconds between queries), --refresh
//
// Gentle on Overpass: one query per fetch cell (default 1 km = 16 tiles), a pause between queries, and every raw answer
// cached in tools/realcity/.cache/<city>/ so a re-run downloads nothing. No dependencies, Node 18+.
// Data: (c) OpenStreetMap contributors, ODbL 1.0. Elevation: USGS 3D Elevation Program (public domain).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const UA = "HeartbeatObservatory-realcity/1.0 (+https://heartbeatobservatory.com/realcity/)";
const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];

// ---------------------------------------------------------------- args + city config
const A = {}; for (let i = 2; i < process.argv.length; i++) { const k = process.argv[i]; if (k.startsWith("--")) { const v = process.argv[i + 1]; if (!v || v.startsWith("--")) A[k.slice(2)] = true; else { A[k.slice(2)] = v; i++; } } }
const cities = JSON.parse(fs.readFileSync(path.join(ROOT, "realcity/cities.json"), "utf8"));
const id = A.city || "fort-wayne";
const C = Object.assign({ id, name: id, tile: 250, cell: 1000 }, cities[id] || {});
if (A.bbox) C.bbox = A.bbox.split(",").map(Number);           // s,w,n,e
if (A.origin) C.origin = A.origin.split(",").map(Number);     // lat,lon (y=0, x=0)
if (A.name) C.name = A.name;
if (A.tile) C.tile = +A.tile; if (A.cell) C.cell = +A.cell;
if (!C.bbox) { console.error("no bbox for city " + id + " (add it to realcity/cities.json or pass --bbox s,w,n,e)"); process.exit(1); }
if (!C.origin) C.origin = [(C.bbox[0] + C.bbox[2]) / 2, (C.bbox[1] + C.bbox[3]) / 2];
const WAIT = (+A.wait || 4) * 1000, TILE = C.tile;
const CACHE = path.join(HERE, ".cache", id), OUT = path.join(ROOT, "realcity/data", id);
fs.mkdirSync(CACHE, { recursive: true }); fs.mkdirSync(OUT, { recursive: true });

// local metres: x east, z south (north = -z), origin at C.origin
const [lat0, lon0] = C.origin, phi = lat0 * Math.PI / 180;
const MLAT = 111132.92 - 559.82 * Math.cos(2 * phi) + 1.175 * Math.cos(4 * phi);
const MLON = 111412.84 * Math.cos(phi) - 93.5 * Math.cos(3 * phi);
const toXZ = (lat, lon) => [(lon - lon0) * MLON, -(lat - lat0) * MLAT];
const toLL = (x, z) => [lat0 - z / MLAT, lon0 + x / MLON];
const [S, W, N, E] = C.bbox; const [bx0, bz1] = toXZ(S, W), [bx1, bz0] = toXZ(N, E);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function overpass(q, cacheName) {
  const f = path.join(CACHE, cacheName);
  if (!A.refresh && fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, "utf8"));
  for (let attempt = 0; attempt < 6; attempt++) {
    const url = OVERPASS[attempt % OVERPASS.length];
    try {
      const r = await fetch(url, { method: "POST", headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" }, body: "data=" + encodeURIComponent(q) });
      if (r.status === 429 || r.status >= 500) { console.log(`  overpass ${r.status}, waiting...`); await sleep(15000 * (attempt + 1)); continue; }
      if (!r.ok) throw new Error("HTTP " + r.status + " " + (await r.text()).slice(0, 200));
      const j = await r.json(); fs.writeFileSync(f, JSON.stringify(j)); await sleep(WAIT); return j;
    } catch (e) { console.log("  overpass error: " + e.message); await sleep(10000 * (attempt + 1)); }
  }
  throw new Error("Overpass failed for " + cacheName);
}

// ---------------------------------------------------------------- 1. download, one query per cell
const cellsLat = Math.max(1, Math.ceil((N - S) * MLAT / C.cell)), cellsLon = Math.max(1, Math.ceil((E - W) * MLON / C.cell));
const ways = new Map(), nodesTrees = new Map(), rels = new Map();
console.log(`${C.name}: bbox ${C.bbox.join(",")}  ${((E - W) * MLON / 1000).toFixed(2)} x ${((N - S) * MLAT / 1000).toFixed(2)} km, ${cellsLat * cellsLon} Overpass queries`);
for (let a = 0; a < cellsLat; a++) for (let b = 0; b < cellsLon; b++) {
  const s = S + (N - S) * a / cellsLat, n = S + (N - S) * (a + 1) / cellsLat, w = W + (E - W) * b / cellsLon, e = W + (E - W) * (b + 1) / cellsLon;
  const bb = [s, w, n, e].map((v) => v.toFixed(6)).join(",");
  const q = `[out:json][timeout:120];(
    way["building"](${bb}); way["building:part"](${bb});
    way["highway"](${bb}); way["railway"~"^(rail|light_rail|tram|subway|narrow_gauge)$"](${bb});
    way["waterway"~"^(river|stream|canal|riverbank)$"](${bb}); way["natural"="water"](${bb}); way["water"](${bb});
    way["leisure"~"^(park|garden|pitch|playground|golf_course|nature_reserve)$"](${bb});
    way["landuse"~"^(grass|recreation_ground|cemetery|forest|meadow|village_green)$"](${bb}); way["natural"~"^(wood|scrub|grassland)$"](${bb});
    way["amenity"="parking"](${bb}); way["man_made"="bridge"](${bb});
    node["natural"="tree"](${bb});
  ); out geom qt;
  ( relation["building"](${bb}); relation["natural"="water"](${bb}); relation["waterway"="riverbank"](${bb}); relation["leisure"="park"](${bb}); relation["landuse"~"^(grass|cemetery|recreation_ground)$"](${bb}); )->.r;
  .r out tags; way(r.r)(${bb}); out geom qt; rel.r; out body qt;`;
  console.log(`  cell ${a * cellsLon + b + 1}/${cellsLat * cellsLon}`);
  const j = await overpass(q, `cell_${a}_${b}.json`);
  for (const el of j.elements) {
    if (el.type === "way" && el.geometry) ways.set(el.id, el);
    else if (el.type === "node" && el.tags) nodesTrees.set(el.id, el);
    else if (el.type === "relation") { const o = rels.get(el.id) || {}; rels.set(el.id, Object.assign(o, el)); }
  }
}
console.log(`  ${ways.size} ways, ${rels.size} relations, ${nodesTrees.size} trees`);

// ---------------------------------------------------------------- 2. geometry helpers
const P = (g) => g.map((p) => toXZ(p.lat, p.lon));
function area(ring) { let s = 0; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) s += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]); return s / 2; }
function centroid(ring) { let x = 0, z = 0; for (const p of ring) { x += p[0]; z += p[1]; } return [x / ring.length, z / ring.length]; }
function inside(pt, ring) { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, zi] = ring[i], [xj, zj] = ring[j]; if ((zi > pt[1]) !== (zj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - zi) / (zj - zi) + xi) c = !c; } return c; }
function openRing(r) { if (r.length > 1 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1]) return r.slice(0, -1); return r; }
function clipRect(ring, x0, z0, x1, z1) {   // Sutherland-Hodgman against an axis rect (fine for fills)
  const edges = [[(p) => p[0] >= x0, (a, b) => [x0, a[1] + (b[1] - a[1]) * (x0 - a[0]) / (b[0] - a[0])]], [(p) => p[0] <= x1, (a, b) => [x1, a[1] + (b[1] - a[1]) * (x1 - a[0]) / (b[0] - a[0])]],
    [(p) => p[1] >= z0, (a, b) => [a[0] + (b[0] - a[0]) * (z0 - a[1]) / (b[1] - a[1]), z0]], [(p) => p[1] <= z1, (a, b) => [a[0] + (b[0] - a[0]) * (z1 - a[1]) / (b[1] - a[1]), z1]]];
  let out = ring;
  for (const [ins, cut] of edges) { const inp = out; out = []; if (!inp.length) break; for (let i = 0; i < inp.length; i++) { const a = inp[(i + inp.length - 1) % inp.length], b = inp[i]; if (ins(b)) { if (!ins(a)) out.push(cut(a, b)); out.push(b); } else if (ins(a)) out.push(cut(a, b)); } }
  return out;
}
function joinRings(segs) {   // chain open ways into rings (multipolygon members)
  const left = segs.map((s) => s.slice()); const rings = [];
  while (left.length) {
    let cur = left.shift();
    for (let guard = 0; guard < 2000; guard++) {
      const a = cur[0], z = cur[cur.length - 1]; if (a[0] === z[0] && a[1] === z[1] && cur.length > 3) break;
      const k = left.findIndex((s) => { const s0 = s[0], s1 = s[s.length - 1]; return (s0[0] === z[0] && s0[1] === z[1]) || (s1[0] === z[0] && s1[1] === z[1]); });
      if (k < 0) break; const s = left.splice(k, 1)[0]; const s0 = s[0];
      cur = cur.concat((s0[0] === z[0] && s0[1] === z[1] ? s : s.reverse()).slice(1));
    }
    if (cur.length > 3) rings.push(openRing(cur));
  }
  return rings;
}
const num = (v) => { if (v == null) return null; const m = String(v).replace(",", ".").match(/-?\d+(\.\d+)?/); if (!m) return null; let n = parseFloat(m[0]); if (/ft|'/.test(v)) n *= 0.3048; return isFinite(n) ? n : null; };

// ---------------------------------------------------------------- 3. classify
// building heights: tagged height > levels > type default (flag GUESS). Family drives the facade look.
const TYPE_H = { house: 7, detached: 7, semidetached_house: 7, terrace: 9, residential: 9, apartments: 13, garage: 3, garages: 3, shed: 3, carport: 3, roof: 4,
  commercial: 10, retail: 6, office: 16, industrial: 8, warehouse: 8, church: 14, cathedral: 20, chapel: 9, school: 10, university: 12, hospital: 18,
  hotel: 20, parking: 10, civic: 12, public: 12, government: 12, train_station: 10, service: 4, kiosk: 3, hut: 3, yes: 8 };
const HOUSEY = new Set(["house", "detached", "semidetached_house", "residential", "terrace", "garage", "garages", "shed", "bungalow"]);
function family(t, h) {
  const mat = (t["building:material"] || t["building:facade:material"] || "").toLowerCase(), b = t.building || t["building:part"] || "yes";
  if (/glass/.test(mat)) return "glass";
  if (/stone|limestone|marble|granite|sandstone/.test(mat)) return "stone";
  if (/brick/.test(mat)) return "brick";
  if (/concrete/.test(mat)) return h > 30 ? "glass" : "concrete";
  if (/wood|vinyl|siding|plaster/.test(mat)) return "house";
  if (b === "parking" || t.parking === "multi-storey") return "garage";
  if (HOUSEY.has(b) && h <= 11) return "house";
  if (b === "industrial" || b === "warehouse" || b === "service") return "industrial";
  if (h > 45) return "glass";
  if (b === "church" || b === "cathedral" || b === "civic" || b === "public" || b === "government" || b === "courthouse") return "stone";
  return "brick";
}
const FAM = ["brick", "stone", "glass", "concrete", "house", "industrial", "garage"];
const ROADW = { motorway: 14, trunk: 14, primary: 13, secondary: 12, tertiary: 10.5, unclassified: 8, residential: 8, living_street: 6, service: 4.5,
  motorway_link: 6, trunk_link: 6, primary_link: 7, secondary_link: 7, tertiary_link: 6, pedestrian: 6, footway: 2, path: 2, cycleway: 2.5, steps: 2, track: 3 };
const ROADK = ["motorway", "primary", "secondary", "tertiary", "residential", "service", "footway", "pedestrian", "cycleway", "path", "steps", "track"];
function roadKind(h) { const b = h.replace("_link", ""); if (b === "trunk") return 0; if (b === "unclassified" || b === "living_street") return 4; const k = ROADK.indexOf(b); return k < 0 ? -1 : k; }
const AREAK = { water: 0, park: 1, grass: 2, wood: 3, parking: 4, pitch: 5, cemetery: 6 };
function areaKind(t) {
  if (t.natural === "water" || t.water || t.waterway === "riverbank") return AREAK.water;
  if (t.amenity === "parking" && (!t.parking || t.parking === "surface")) return AREAK.parking;
  if (t.leisure === "pitch") return AREAK.pitch;
  if (t.landuse === "cemetery") return AREAK.cemetery;
  if (t.natural === "wood" || t.landuse === "forest" || t.natural === "scrub") return AREAK.wood;
  if (t.leisure || t.landuse === "recreation_ground" || t.landuse === "village_green") return AREAK.park;
  if (t.landuse || t.natural) return AREAK.grass;
  return -1;
}

const names = []; const nameIx = new Map();
const nm = (s) => { if (!s) return -1; if (!nameIx.has(s)) { nameIx.set(s, names.length); names.push(s); } return nameIx.get(s); };

// buildings (ways + relations), parts
const buildings = [];   // { id, outer, holes, h, minH, flags, fam, levels, name, cx, cz }
const parts = [];
const memberOf = new Set();
for (const r of rels.values()) if (r.members) for (const m of r.members) if (m.type === "way") memberOf.add(m.ref);
function mkBuilding(id, t, outer, holes, isPart) {
  if (outer.length < 3) return null;
  if (area(outer) < 0) outer.reverse();   // CCW in x/z (+z south) => consistent
  let h = num(t.height), flags = 0; const lv = num(t["building:levels"]), rl = num(t["roof:levels"]) || 0;
  let minH = num(t.min_height); if (minH == null && t["building:min_level"] != null) minH = num(t["building:min_level"]) * 3.3;
  if (h == null && lv != null) { h = lv * 3.3 + rl * 2.2 + (lv > 0 ? 1.0 : 0); flags |= 2; }   // from levels
  if (h == null) { h = TYPE_H[t.building || t["building:part"]] ?? TYPE_H.yes; flags |= 1; }       // guessed
  if (t["roof:shape"] === "gabled" || t["roof:shape"] === "hipped" || (HOUSEY.has(t.building) && t.building !== "garage" && h <= 10 && !t["roof:shape"])) flags |= 4;   // pitched roof
  if (t.amenity === "courthouse" || t.historic || t.heritage || t.wikidata) flags |= 8;                 // landmark-ish (custom work later)
  if (/^(dome|onion)$/.test(t["roof:shape"] || "")) flags |= 32;                                       // dome roof
  if (/^(retail|commercial)$/.test(t.building) || t.shop || t.amenity === "restaurant" || t.amenity === "cafe" || t.amenity === "bar") flags |= 16;   // shopfront
  const [cx, cz] = centroid(outer);
  const b = { id, outer, holes: holes || [], h: Math.max(2.5, Math.min(h, 500)), minH: minH || 0, flags, fam: FAM.indexOf(family(t, h)), levels: lv, name: t.name || "", cx, cz, colour: t["building:colour"] || t["building:color"] || "", roofColour: t["roof:colour"] || "", roofH: num(t["roof:height"]) || 0, isPart, ownMat: !!(t["building:material"] || t["building:facade:material"] || t["building:colour"]) };
  return b;
}
for (const w of ways.values()) {
  const t = w.tags || {};
  const closed = w.geometry.length > 3 && w.nodes && w.nodes[0] === w.nodes[w.nodes.length - 1];
  if (t["building:part"] && closed) { const b = mkBuilding(w.id, t, openRing(P(w.geometry)), [], true); if (b) parts.push(b); }
  else if (t.building && closed && t.building !== "no") { const b = mkBuilding(w.id, t, openRing(P(w.geometry)), [], false); if (b) buildings.push(b); }
}
for (const r of rels.values()) {
  const t = r.tags || {}; if (!t.building || !r.members) continue;
  const outerSegs = [], innerSegs = [];
  for (const m of r.members) { const w = ways.get(m.ref); if (!w || m.type !== "way") continue; (m.role === "inner" ? innerSegs : outerSegs).push(P(w.geometry)); }
  const outers = joinRings(outerSegs), inners = joinRings(innerSegs);
  outers.forEach((o, k) => { const b = mkBuilding(r.id * 10 + k, t, o, inners.filter((h) => inside(h[0], o)), false); if (b) buildings.push(b); });
}
// OSM 3D convention: a building with parts is drawn by its parts
// ...but when no part touches the ground (only towers/domes are mapped as parts), the outline is still the base mass.
for (const b of buildings) { let any = false, grounded = false; for (const p of parts) if (Math.abs(p.cx - b.cx) < 200 && Math.abs(p.cz - b.cz) < 200 && inside([p.cx, p.cz], b.outer)) { any = true; if (p.minH < 1) grounded = true; if (!p.name) p.name = b.name; if (b.flags & 8) p.flags |= 8; if (!p.ownMat) p.fam = b.fam; if (!p.colour) p.colour = b.colour; } b.hasParts = any && grounded; }
const solids = buildings.filter((b) => !b.hasParts).concat(parts);
// landmarks: position + roof height from the OUTLINE (it may be drawn by its parts), so custom work sits in the right place
for (const L of C.landmarks || []) {
  const b = buildings.find((b) => b.id === L.osm); if (!b) { console.log("  landmark not found: " + L.id); continue; }
  let top = b.h; for (const p of parts) if (inside([p.cx, p.cz], b.outer)) top = Math.max(top, p.h);
  L.x = +b.cx.toFixed(1); L.z = +b.cz.toFixed(1); L.roof = +b.h.toFixed(1); L.partsTop = +top.toFixed(1);
}

// roads
const nodeUse = new Map();
const roadWays = [...ways.values()].filter((w) => w.tags && w.tags.highway && roadKind(w.tags.highway) >= 0 && w.tags.area !== "yes" && w.tags.tunnel !== "yes" && w.tags.tunnel !== "building_passage");
for (const w of roadWays) for (const n of w.nodes || []) nodeUse.set(n, (nodeUse.get(n) || 0) + 1);
// rails, waterway lines
const rails = [...ways.values()].filter((w) => w.tags && w.tags.railway && w.tags.tunnel !== "yes");
const streams = [...ways.values()].filter((w) => w.tags && /^(river|stream|canal)$/.test(w.tags.waterway || ""));
// areas (ways + relations)
const areas = [];
for (const w of ways.values()) {
  const t = w.tags || {}; if (t.building || t.highway || memberOf.has(w.id) && !t.natural && !t.leisure && !t.landuse && !t.amenity) continue;
  const k = areaKind(t); if (k < 0 || !(w.nodes && w.nodes[0] === w.nodes[w.nodes.length - 1])) continue;
  areas.push({ k, outer: openRing(P(w.geometry)), holes: [] });
}
for (const r of rels.values()) {
  const t = r.tags || {}; if (t.building || !r.members) continue; const k = areaKind(t); if (k < 0) continue;
  const os = [], is = [];
  for (const m of r.members) { const w = ways.get(m.ref); if (!w || m.type !== "way") continue; (m.role === "inner" ? is : os).push(P(w.geometry)); }
  const inners = joinRings(is);
  for (const o of joinRings(os)) areas.push({ k, outer: o, holes: inners.filter((h) => inside(h[0], o)), fromRel: true });
}

// ---------------------------------------------------------------- 4. elevation (optional): 3DEP getSamples on a grid
let elev = null, elevStep = 0, elevBase = 0;
if (A.elev) {
  elevStep = +A.elevStep || 25;
  const nx = Math.ceil((bx1 - bx0) / elevStep) + 1, nz = Math.ceil((bz1 - bz0) / elevStep) + 1;
  const ef = path.join(CACHE, `elev_${elevStep}.json`);
  if (!A.refresh && fs.existsSync(ef)) elev = JSON.parse(fs.readFileSync(ef, "utf8"));
  else {
    elev = new Array(nx * nz).fill(null); const pts = [];
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const [la, lo] = toLL(bx0 + i * elevStep, bz0 + j * elevStep); pts.push([lo, la]); }
    console.log(`  3DEP: ${pts.length} samples`);
    for (let k = 0; k < pts.length; k += 500) {
      const chunk = pts.slice(k, k + 500);
      // POST through curl: the USGS server resets Node's built-in fetch (TLS fingerprint), and long GET URLs too.
      const body = new URLSearchParams({ geometry: JSON.stringify({ points: chunk, spatialReference: { wkid: 4326 } }), geometryType: "esriGeometryMultipoint", returnFirstValueOnly: "true", f: "json" }).toString();
      const bf = path.join(CACHE, "_elev_body.txt"); fs.writeFileSync(bf, body);
      for (let att = 0; att < 4; att++) {
        try {
          const out = execFileSync("curl", ["-s", "-m", "120", "-A", UA, "-H", "Content-Type: application/x-www-form-urlencoded", "--data-binary", "@" + bf, "https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/getSamples"], { maxBuffer: 64 << 20 }).toString();
          const j = JSON.parse(out); if (!j.samples) throw new Error(out.slice(0, 120));
          for (const s of j.samples) elev[k + s.locationId] = Math.round(parseFloat(s.value) * 10) / 10; break;
        } catch (e) { console.log("  3DEP retry: " + e.message); await sleep(5000); }
      }
      if (k % 5000 === 0) console.log(`  3DEP ${k}/${pts.length}`);
      await sleep(800);
    }
    fs.writeFileSync(ef, JSON.stringify(elev));
  }
  elev = { nx, nz, v: elev };
}
const [olat, olon] = C.origin;
function ground(x, z) {
  if (!elev) return 0;
  const fi = Math.max(0, Math.min(elev.nx - 1.001, (x - bx0) / elevStep)), fj = Math.max(0, Math.min(elev.nz - 1.001, (z - bz0) / elevStep));
  const i = Math.floor(fi), j = Math.floor(fj), u = fi - i, v = fj - j, g = (a, b) => elev.v[b * elev.nx + a] ?? elevBase;
  return (g(i, j) * (1 - u) + g(i + 1, j) * u) * (1 - v) + (g(i, j + 1) * (1 - u) + g(i + 1, j + 1) * u) * v;
}
if (elev) { const sx = (0 - bx0) / elevStep, sz = (0 - bz0) / elevStep; elevBase = elev.v[Math.round(sz) * elev.nx + Math.round(sx)] ?? 0; }

// ---------------------------------------------------------------- 5. bin into tiles (local decimetre ints relative to the tile corner)
const tiles = new Map(); const tkey = (x, z) => Math.floor(x / TILE) + "_" + Math.floor(z / TILE);
const T = (k) => { let t = tiles.get(k); if (!t) { const [ix, iz] = k.split("_").map(Number); t = { ix, iz, b: [], r: [], a: [], rl: [], w: [], t: [] }; tiles.set(k, t); } return t; };
const inBox = (x, z) => x >= bx0 && x <= bx1 && z >= bz0 && z <= bz1;
const dm = (v) => Math.round(v * 10);
const enc = (ring, ox, oz) => { const o = []; for (const p of ring) o.push(dm(p[0] - ox), dm(p[1] - oz)); return o; };
const gy = (x, z) => Math.round((ground(x, z) - elevBase) * 10);   // ground in dm relative to the origin
const skyline = []; let guessed = 0, fromLevels = 0, tagged = 0;
for (const b of solids) {
  if (!inBox(b.cx, b.cz)) continue;
  const k = tkey(b.cx, b.cz), t = T(k), ox = t.ix * TILE, oz = t.iz * TILE;
  let gmin = Infinity; for (const p of b.outer) gmin = Math.min(gmin, gy(p[0], p[1]));
  if (b.flags & 1) guessed++; else if (b.flags & 2) fromLevels++; else tagged++;
  // [ring, holes, h dm, minH dm, ground dm, flags, family, levels, name idx, colour]
  t.b.push([enc(b.outer, ox, oz), b.holes.map((h) => enc(h, ox, oz)), dm(b.h), dm(b.minH), gmin, b.flags, b.fam, b.levels ?? -1, b.name ? nm(b.name) : -1, b.colour || 0, b.id, dm(b.roofH), b.roofColour || 0]);
  // skyline / far massing: oriented box from the longest edge
  let best = 0, ang = 0; for (let i = 0; i < b.outer.length; i++) { const p = b.outer[i], q = b.outer[(i + 1) % b.outer.length], L = Math.hypot(q[0] - p[0], q[1] - p[1]); if (L > best) { best = L; ang = Math.atan2(q[1] - p[1], q[0] - p[0]); } }
  const ca = Math.cos(-ang), sa = Math.sin(-ang); let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const p of b.outer) { const u = (p[0] - b.cx) * ca - (p[1] - b.cz) * sa, v = (p[0] - b.cx) * sa + (p[1] - b.cz) * ca; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
  const mx = b.cx + ((u0 + u1) / 2) * Math.cos(ang) - ((v0 + v1) / 2) * Math.sin(ang), mz = b.cz + ((u0 + u1) / 2) * Math.sin(ang) + ((v0 + v1) / 2) * Math.cos(ang);
  skyline.push([k, dm(mx), dm(mz), dm(u1 - u0), dm(v1 - v0), Math.round(ang * 1000), dm(b.h), gmin, b.fam]);
}
for (const w of roadWays) {
  const t = w.tags, kind = roadKind(t.highway); const pts = P(w.geometry);
  const lanes = num(t.lanes); let width = num(t.width) || (lanes ? lanes * 3.3 + (kind <= 4 && t.oneway !== "yes" ? 0 : 0) : ROADW[t.highway] || 6);
  width = Math.max(1.5, Math.min(width, 40));
  let flags = 0; if (t.oneway === "yes" || t.oneway === "1") flags |= 1; if (t.bridge && t.bridge !== "no") flags |= 2; if (t.sidewalk && t.sidewalk !== "no" && t.sidewalk !== "none") flags |= 4; if (t.footway === "sidewalk") flags |= 8; if (t.footway === "crossing") flags |= 16;
  const layer = num(t.layer) || 0;
  // split per tile by segment midpoint; junction marks so the client can trim paint and place sign posts
  let cur = null, curK = null;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
    if (!inBox(mx, mz)) { cur = null; curK = null; continue; }
    const k = tkey(mx, mz);
    if (k !== curK || !cur) { const tt = T(k); cur = { t: tt, pts: [a], j: [], g: [] }; cur.j.push(nodeUse.get(w.nodes[i]) > 1 ? 1 : 0); cur.g.push(gy(a[0], a[1])); tt.r.push(cur); curK = k; cur.meta = [kind, dm(width), nm(t.name || t.ref || ""), flags, layer, lanes || 0]; }
    cur.pts.push(b); cur.j.push(nodeUse.get(w.nodes[i + 1]) > 1 ? 1 : 0); cur.g.push(gy(b[0], b[1]));
  }
}
for (const w of rails) {
  const t = w.tags, pts = P(w.geometry), flags = (t.bridge && t.bridge !== "no" ? 2 : 0) | (t.embankment === "yes" ? 4 : 0) | (t.railway === "abandoned" || t.railway === "disused" ? 8 : 0);
  let cur = null, curK = null;
  for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2; if (!inBox(mx, mz)) { cur = null; curK = null; continue; } const k = tkey(mx, mz); if (k !== curK || !cur) { cur = { pts: [a], g: [gy(a[0], a[1])], meta: [flags, num(t.layer) || 0, nm(t.name || "")] }; T(k).rl.push(cur); curK = k; } cur.pts.push(b); cur.g.push(gy(b[0], b[1])); }
}
for (const w of streams) {
  const t = w.tags, pts = P(w.geometry), width = num(t.width) || (t.waterway === "river" ? 30 : t.waterway === "canal" ? 10 : 4);
  let cur = null, curK = null;
  for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2; if (!inBox(mx, mz)) { cur = null; curK = null; continue; } const k = tkey(mx, mz); if (k !== curK || !cur) { cur = { pts: [a], meta: [dm(width), nm(t.name || "")] }; T(k).w.push(cur); curK = k; } cur.pts.push(b); }
}
for (const a of areas) {   // clip every area to every tile it touches
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (const p of a.outer) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
  x0 = Math.max(x0, bx0); x1 = Math.min(x1, bx1); z0 = Math.max(z0, bz0); z1 = Math.min(z1, bz1); if (x0 >= x1 || z0 >= z1) continue;
  for (let ix = Math.floor(x0 / TILE); ix <= Math.floor(x1 / TILE); ix++) for (let iz = Math.floor(z0 / TILE); iz <= Math.floor(z1 / TILE); iz++) {
    const tx0 = ix * TILE, tz0 = iz * TILE, tx1 = tx0 + TILE, tz1 = tz0 + TILE;
    const o = clipRect(a.outer, Math.max(tx0, bx0), Math.max(tz0, bz0), Math.min(tx1, bx1), Math.min(tz1, bz1)); if (o.length < 3 || Math.abs(area(o)) < 4) continue;
    const hs = a.holes.map((h) => clipRect(h, tx0, tz0, tx1, tz1)).filter((h) => h.length >= 3 && Math.abs(area(h)) > 2);
    let lvl = 0; if (a.k === AREAK.water && elev) { lvl = Infinity; for (const p of o) lvl = Math.min(lvl, gy(p[0], p[1])); }
    T(ix + "_" + iz).a.push([a.k, enc(o, tx0, tz0), hs.map((h) => enc(h, tx0, tz0)), lvl]);
  }
}
for (const n of nodesTrees.values()) { const [x, z] = toXZ(n.lat, n.lon); if (!inBox(x, z)) continue; const t = T(tkey(x, z)); t.t.push(dm(x - t.ix * TILE), dm(z - t.iz * TILE)); }

// ground grid per tile (elevation only): (TILE/25+1)^2 samples in dm
const GSTEP = 25;
for (const t of tiles.values()) if (elev) { const g = []; for (let j = 0; j <= TILE / GSTEP; j++) for (let i = 0; i <= TILE / GSTEP; i++) g.push(gy(t.ix * TILE + i * GSTEP, t.iz * TILE + j * GSTEP)); t.g = g; }

// ---------------------------------------------------------------- 6. write
for (const f of fs.readdirSync(OUT)) if (/^t_.*\.json$/.test(f)) fs.unlinkSync(path.join(OUT, f));
let bytes = 0;
for (const [k, t] of tiles) {
  const out = { v: 1, ix: t.ix, iz: t.iz, b: t.b, r: t.r.map((r) => [...r.meta, enc(r.pts, t.ix * TILE, t.iz * TILE), r.j, r.g]), rl: t.rl.map((r) => [...r.meta, enc(r.pts, t.ix * TILE, t.iz * TILE), r.g]), w: t.w.map((r) => [...r.meta, enc(r.pts, t.ix * TILE, t.iz * TILE)]), a: t.a, t: t.t };
  if (t.g) out.g = t.g;
  const s = JSON.stringify(out); bytes += s.length; fs.writeFileSync(path.join(OUT, `t_${k}.json`), s);
}
skyline.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
const index = {
  v: 1, id: C.id, name: C.name, origin: C.origin, bbox: C.bbox, box: [bx0, bz0, bx1, bz1].map((v) => Math.round(v)), tile: TILE, spawn: C.spawn || null,
  elevation: elev ? { source: "USGS 3DEP (1 m lidar DEM via getSamples)", step: elevStep, baseMetres: elevBase, gridStep: GSTEP } : null,
  landmarks: (C.landmarks || []).map((L) => Object.assign({}, L, L.x != null ? { tile: tkey(L.x, L.z), ground: (ground(L.x, L.z) - elevBase) } : {})), hooks: C.hooks || [],
  tiles: [...tiles.keys()].sort(), names, fam: FAM, roadKinds: ROADK, areaKinds: Object.keys(AREAK),
  skyline: skyline.map((s) => s.slice(1)), skylineTile: (() => { const o = {}; skyline.forEach((s, i) => { if (!(s[0] in o)) o[s[0]] = [i, 0]; o[s[0]][1]++; }); return o; })(),
  // city-wide light street list for the big map: [kind, name idx, x0,z0,x1,z1... in metres], streets only
  roadsLite: roadWays.filter((w) => roadKind(w.tags.highway) <= 5).map((w) => { const o = [roadKind(w.tags.highway), nm(w.tags.name || "")]; let lx = 1e9, lz = 1e9; for (const g of w.geometry) { const [x, z] = toXZ(g.lat, g.lon); if (!inBox(x, z)) continue; if (Math.hypot(x - lx, z - lz) < 6) continue; o.push(Math.round(x), Math.round(z)); lx = x; lz = z; } return o; }).filter((o) => o.length >= 6),
  stats: { buildings: tagged + fromLevels + guessed, heightTagged: tagged, heightFromLevels: fromLevels, heightGuessed: guessed, roads: roadWays.length, areas: areas.length, trees: nodesTrees.size, tiles: tiles.size, fetched: new Date().toISOString() },
  attribution: ["© OpenStreetMap contributors (ODbL)"].concat(elev ? ["Elevation: USGS 3D Elevation Program"] : []),
};
const is = JSON.stringify(index); bytes += is.length; fs.writeFileSync(path.join(OUT, "index.json"), is);
console.log(`wrote ${tiles.size} tiles + index to ${path.relative(ROOT, OUT)}: ${(bytes / 1048576).toFixed(2)} MB`);
console.log(`buildings ${index.stats.buildings}: height tagged ${tagged}, from levels ${fromLevels}, guessed ${guessed}`);
