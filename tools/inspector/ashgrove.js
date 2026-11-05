/* ============================================================================
   tools/inspector/ashgrove.js — Ashgrove (world3/town) adapter + checks
   ---------------------------------------------------------------------------
   Boots the real town generator in Node (same stub-GL sandbox as
   world3/town/tools/baseline.js), but first wraps Builder.quad so every
   triangle the town emits is recorded in world space, tagged with the
   building it belongs to and the asset id/type it was emitted under
   (B12-K01 roof, B12-L1-W03 wall, ...). Interiors are built too, so stairs,
   floors and ceilings are in the soup.

   Then it MEASURES, per building:
     roof     sky rays down onto the roof (holes), and horizontal rays into
              the attic band from all four sides (gaps between walls, gables,
              dormers and the roof planes)
     stairs   run, riser, landing in front of the first step, landing past
              the last step, headroom over every tread
     doors    clear floor on both sides of every doorway (what's in the way)
     rooms    flood-walked with the player's own collision (shared with
              tools/walkable.js) + how much of the floor is actually free
     parts    float/bury against each asset's datum (render/debug.js audit),
              furniture clipping into walls or into each other
   ========================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { Soup, AxisCaster, heightfield, cluster } = require("./core");

const REPO = path.join(__dirname, "..", "..");
const TOWN = path.join(REPO, "world3", "town");
const RENDER = path.join(TOWN, "render");
const FILES = ["core.js", "textures.js", "geom.js", "plan.js", "furniture.js",
               "buildings.js", "props.js", "town.js", "player.js", "debug.js"];
const MATERIALS = ["siding", "brick", "shingle", "metalRoof", "paint", "drywall", "ceiling",
                   "wood", "concrete", "asphalt", "grass", "dirt", "glass", "metal", "tile",
                   "fabric", "leaf", "bark", "markings", "shadowBlob", "stucco"];

/* thresholds — IRC residential where one exists */
const RULE = {
  landingMin: 0.914,     // R311.7.6: landing at top and bottom, depth >= stair width (36")
  headroomMin: 2.032,    // R311.7.2: 6'8" measured from the tread nosing line
  doorClearMin: 0.60,    // clear floor a player (0.24 m radius) needs to pass a doorway
  freeFloorMin: 0.35,    // a room with less than 35% walkable floor reads as "blocked"
  gapAreaMin: 0.05,      // m^2; one or two 0.2 x 0.1 m samples = sampling noise on a sloped edge
  clipMin: 0.04,         // m of penetration before two solids count as clipping
};

function stubGL() {
  const noop = () => {};
  return new Proxy({}, {
    get(_, k) {
      if (k === "createBuffer") return () => ({});
      if (k === "getParameter") return () => 4096;
      if (k === "getExtension") return () => null;
      if (k === "getShaderParameter" || k === "getProgramParameter") return () => true;
      if (k === "createShader" || k === "createProgram" || k === "createTexture") return () => ({});
      if (typeof k === "string" && /^[A-Z_0-9]+$/.test(k)) return 1;
      return noop;
    },
  });
}

/* ---- boot with the triangle recorder ------------------------------------- */
function boot(opts) {
  const sandbox = {
    console, Math, Date, JSON, performance: { now: () => Date.now() },
    navigator: { userAgent: "node", maxTouchPoints: 0 },
    location: { search: "" }, URLSearchParams,
    document: { createElement: () => ({ getContext: () => null, width: 0, height: 0 }) },
    addEventListener: () => {}, requestAnimationFrame: () => 0, setTimeout,
    Float32Array, Uint32Array, Uint16Array, Uint8Array, Proxy, Object, Array, Map, Set,
    Error, String, Number, Boolean, isNaN, parseInt, parseFloat, Infinity, NaN, undefined,
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  const renderDir = (opts && opts.renderDir) || RENDER;
  for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(renderDir, f), "utf8"), ctx, { filename: `render/${f}` });
  const T = sandbox.TOWN;
  T.GL.gl = stubGL(); T.GL.isGL2 = true;
  T.GL.canvas = { width: 1280, height: 720, clientWidth: 1280, clientHeight: 720 };
  T.Mats = {};
  for (const m of MATERIALS) T.Mats[m] = { name: m, world: 1, rough: 1, metal: 0 };
  T.buildMaterials = () => T.Mats;

  /* the recorder */
  const rec = { cur: null, phase: "ext", inRoof: false, soups: new Map() };
  const quad0 = T.Builder.prototype.quad;
  const A = [0, 0, 0], B = [0, 0, 0], Cc = [0, 0, 0], Dd = [0, 0, 0];
  T.Builder.prototype.quad = function (a, b, c, d, mat, o) {
    if (rec.cur) {
      const s = rec.soups.get(rec.cur.id) || (rec.soups.set(rec.cur.id, new Soup()), rec.soups.get(rec.cur.id));
      const id = this._cur ? this._cur.id : "";
      const type = this._cur ? this._cur.type : "part";
      const tag = { phase: rec.phase, roof: rec.inRoof, type, id, mat: mat && mat.name };
      this._tp(a[0], a[1], a[2], A); this._tp(b[0], b[1], b[2], B);
      this._tp(c[0], c[1], c[2], Cc); this._tp(d[0], d[1], d[2], Dd);
      s.add(A.slice(), B.slice(), Cc.slice(), tag);
      s.add(A.slice(), Cc.slice(), Dd.slice(), tag);
    }
    return quad0.call(this, a, b, c, d, mat, o);
  };
  const ext0 = T.Building.prototype.emitExterior;
  T.Building.prototype.emitExterior = function (b, dt) {
    rec.cur = this; rec.phase = "ext";
    try { return ext0.call(this, b, dt); } finally { rec.cur = null; }
  };
  const roof0 = T.Building.prototype.emitRoof;
  T.Building.prototype.emitRoof = function () {
    rec.inRoof = true;
    try { return roof0.apply(this, arguments); } finally { rec.inRoof = false; }
  };

  T.Town.build(20260804);
  for (const b of T.Town.buildings) {
    rec.cur = b; rec.phase = "int";
    try { b.interior = b.buildInterior(); } finally { rec.cur = null; }
  }
  return { T, soups: rec.soups };
}

/* ---- helpers --------------------------------------------------------------- */
const r2 = (v) => Math.round(v * 100) / 100;
function footOf(b) { const f = b.foot; return { x0: f[0], z0: f[2], x1: f[3], z1: f[5] }; }
function topOf(b) { const L = b.plan.levels[b.plan.levels.length - 1]; return L.y + L.ceilH; }
function pointInCollider(T, x, y, z, skip) {
  for (const c of T.World.colliders) {
    if (skip && skip(c)) continue;
    if (x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1 && y > c.y0 && y < c.y1) return c;
  }
  return null;
}

/* ---- ROOF ------------------------------------------------------------------ */
function checkRoof(T, b, soup) {
  const ext = soup.filter((t) => t.phase === "ext");
  const f = footOf(b), topY = topOf(b);
  const yC = new AxisCaster(ext, 1, 0.5), xC = new AxisCaster(ext, 0, 0.5), zC = new AxisCaster(ext, 2, 0.5);
  const STEP = 0.2;
  const hf = heightfield(yC, f.x0 + 0.1, f.z0 + 0.1, f.x1 - 0.1, f.z1 - 0.1, STEP);
  const topAt = (x, z) => {
    const i = Math.min(hf.nx - 1, Math.max(0, Math.floor((x - hf.x0) / STEP)));
    const j = Math.min(hf.nz - 1, Math.max(0, Math.floor((z - hf.z0) / STEP)));
    return hf.h[i * hf.nz + j];
  };
  /* holes from above: the sky ray got below the wall tops */
  const holePts = [];
  let maxTop = topY;
  for (let i = 0; i < hf.nx; i++) for (let j = 0; j < hf.nz; j++) {
    const h = hf.h[i * hf.nz + j];
    if (h > maxTop) maxTop = h;
    if (!(h > topY - 0.05)) holePts.push([hf.x0 + (i + 0.5) * STEP, 0, hf.z0 + (j + 0.5) * STEP]);
  }
  const holes = cluster(holePts, STEP * 1.01).map((g) => ({
    x: r2(g.reduce((s, p) => s + p[0], 0) / g.length), z: r2(g.reduce((s, p) => s + p[2], 0) / g.length),
    areaM2: r2(g.length * STEP * STEP),
  }));

  /* gaps from the side: a horizontal ray that gets 0.3 m inside the footprint
     without touching anything, at a height that is under the roof there, is
     looking straight into the roof cavity from outside */
  const H = 0.1, A = 0.2, IN = 0.3;
  const gapPts = [];
  const sides = [
    { name: "west (-x)", axis: 0, dir: 1, fixed: f.x0, lo: f.z0, hi: f.z1 },
    { name: "east (+x)", axis: 0, dir: -1, fixed: f.x1, lo: f.z0, hi: f.z1 },
    { name: "north (-z)", axis: 2, dir: 1, fixed: f.z0, lo: f.x0, hi: f.x1 },
    { name: "south (+z)", axis: 2, dir: -1, fixed: f.z1, lo: f.x0, hi: f.x1 },
  ];
  for (const sd of sides) {
    // the 0.0137 m offset keeps samples off exact face planes (an edge-on face is never "hit")
    for (let a = sd.lo + 0.1537; a <= sd.hi - 0.15; a += A) {
      for (let y = topY + 0.03; y < maxTop; y += H) {
        const hs = sd.axis === 0 ? xC.hits(y, a) : zC.hits(a, y);
        /* the ray has to get clear past the wall line (0.3 m) AND on to 0.8 m
           inside: a sightline into the cavity, not a probe that happens to
           sit under some overhanging trim */
        const probe = sd.fixed + sd.dir * IN, deep = sd.fixed + sd.dir * 0.8;
        const blocked = hs.some((h) => sd.dir > 0 ? h.at < deep : h.at > deep);
        if (blocked) continue;
        const px = sd.axis === 0 ? probe : a, pz = sd.axis === 0 ? a : probe;
        const above = yC.hits(px, pz, (t) => t.roof || t.type === "roof");   // exact ROOF top over the probe (not a steeple cap)
        const roofTop = above.length ? above[above.length - 1].at : -Infinity;
        if (y < roofTop - 0.12) gapPts.push([sd.axis === 0 ? sd.fixed : a, y, sd.axis === 0 ? a : sd.fixed, sd.name]);
      }
    }
  }
  const gaps = [];
  for (const sd of sides) {
    const pts = gapPts.filter((p) => p[3] === sd.name);
    for (const g of cluster(pts, 0.21)) {
      const area = g.length * H * A;
      if (area < RULE.gapAreaMin) continue;
      const alongs = g.map((p) => (sd.axis === 0 ? p[2] : p[0])), ys = g.map((p) => p[1]);
      gaps.push({ side: sd.name, along: [r2(Math.min(...alongs)), r2(Math.max(...alongs))],
                  y: [r2(Math.min(...ys)), r2(Math.max(...ys) + H)], areaM2: r2(area) });
    }
  }
  return { topY: r2(topY), ridgeY: r2(maxTop), holes, gaps,
           gapAreaM2: r2(gaps.reduce((s, g) => s + g.areaM2, 0)),
           holeAreaM2: r2(holes.reduce((s, g) => s + g.areaM2, 0)) };
}

/* ---- STAIRS ---------------------------------------------------------------- */
function checkStairs(T, b, soup) {
  const out = [];
  const all = soup;
  const yC = new AxisCaster(all, 1, 0.5);
  const levels = b.plan.levels;
  for (const lv of levels) {
    const s = lv.stairs; if (!s || !s.world) continue;
    const up = levels[lv.level + 1];
    const w = s.world, lid = `${b.id}-L${lv.level}-ST`;
    const runAxisX = w.wAxis === "x";
    const lo = runAxisX ? w.x0 : w.z0, hi = runAxisX ? w.x1 : w.z1;
    const footEdge = w.asc ? lo : hi, topEdge = w.asc ? hi : lo;
    const outDir = w.asc ? -1 : 1;                       // from the foot, AWAY from the run
    const c0 = runAxisX ? w.z0 : w.x0, c1 = runAxisX ? w.z1 : w.x1;
    const lanes = [c0 + 0.2, (c0 + c1) / 2, c1 - 0.2];
    const pt = (along, cross) => (runAxisX ? [along, cross] : [cross, along]);
    const solid = (c) => c.type === "door" || c.id === lid;
    const clearFrom = (edge, dir, y) => {
      let best = Infinity, by = null;
      for (const cr of lanes) {
        let d = 0;
        for (; d < 3.0; d += 0.03) {
          const [x, z] = pt(edge + dir * (d + 0.02), cr);
          const c = pointInCollider(T, x, y, z, solid);
          if (c) { if (d < best) { best = d; by = c.id; } break; }
        }
        if (d >= 3.0 && best === Infinity) best = 3.0;
      }
      return { m: r2(best), by };
    };
    const foot = clearFrom(footEdge, outDir, w.yLo + 1.0);
    const top = up ? clearFrom(topEdge, -outDir, w.yHi + 1.0) : { m: null, by: null };
    /* headroom over every tread, measured straight up from the tread */
    let minHead = Infinity, minAt = -1;
    for (let i = 0; i < s.steps; i++) {
      const along = w.asc ? lo + (i + 0.5) * s.run : hi - (i + 0.5) * s.run;
      const treadY = w.yLo + (i + 1) * s.rise;
      for (const cr of lanes) {
        const [x, z] = pt(along, cr);
        const hs = yC.hits(x, z, (t) => t.id !== lid);
        const above = hs.find((h) => h.at > treadY + 0.05);
        const head = above ? above.at - treadY : Infinity;
        if (head < minHead) { minHead = head; minAt = i + 1; }
      }
    }
    const problems = [];
    if (foot.m < RULE.landingMin) problems.push(`first step ${foot.m} m from ${foot.by || "a wall"} (needs ${RULE.landingMin} m landing)`);
    if (top.m !== null && top.m < RULE.landingMin) problems.push(`top step ${top.m} m from ${top.by || "a wall"} (needs ${RULE.landingMin} m landing)`);
    if (minHead < RULE.headroomMin) problems.push(`headroom ${r2(minHead)} m over tread ${minAt} (needs ${RULE.headroomMin} m)`);
    out.push({ id: lid, level: lv.level, steps: s.steps, riseMm: Math.round(s.rise * 1000), runMm: Math.round(s.run * 1000),
               lengthM: r2(s.len), footLandingM: foot.m, footBlockedBy: foot.by, topLandingM: top.m, topBlockedBy: top.by,
               minHeadroomM: minHead === Infinity ? null : r2(minHead), problems });
  }
  return out;
}

/* ---- DOORS ----------------------------------------------------------------- */
function checkDoors(T, b) {
  const out = [];
  for (const lv of b.plan.levels) {
    for (const dr of lv.doors) {
      const zAxis = dr.axis === "z";                         // wall runs along z → you pass along x
      const half = dr.w * 0.35;
      const res = { id: `${b.id}-L${lv.level}-${dr.id}`, ext: !!dr.ext, sides: [] };
      for (const sgn of [-1, 1]) {
        if (dr.ext && ((zAxis && ((dr.x < 0.5) === (sgn < 0))) || (!zAxis && ((dr.z < 0.5) === (sgn < 0))))) continue; // outside of an exterior door: porch, not a room
        let clear = 0, by = null;
        for (let d = 0.12; d <= 1.2; d += 0.04) {
          let hit = null;
          for (const t of [-half, 0, half]) {
            const lx = zAxis ? dr.x + sgn * d : dr.x + t, lz = zAxis ? dr.z + t : dr.z + sgn * d;
            const x = b.tx(lx, lz), z = b.tz(lx, lz);
            for (const y of [lv.y + 0.5, lv.y + 1.2]) {
              const c = pointInCollider(T, x, y, z, (c) => c.type === "door");
              if (c) { hit = c; break; }
            }
            if (hit) break;
          }
          if (hit) { by = hit.id; break; }
          clear = d;
        }
        res.sides.push({ clearM: r2(clear), by });
      }
      res.minClearM = Math.min(...res.sides.map((s) => s.clearM), 9);
      res.blocked = res.sides.some((s) => s.clearM < RULE.doorClearMin);
      out.push(res);
    }
  }
  return out;
}

/* ---- ROOMS ----------------------------------------------------------------- */
function checkRooms(T, b, walk) {
  const flood = walk.floodBuilding(T, b);
  const bare = walk.floodBuilding(T, b, { ignoreFurniture: true });
  const reached = flood.error ? new Set() : walk.roomsReached(b, flood.reached);
  const reachedBare = bare.error ? new Set() : walk.roomsReached(b, bare.reached);
  const STEP = walk.STEP_M;
  const out = [];
  for (const lv of b.plan.levels) {
    for (const rm of lv.rooms) {
      const key = `L${lv.level}-${rm.id}`;
      const xs = [b.tx(rm.x0, rm.z0), b.tx(rm.x1, rm.z1)], zs = [b.tz(rm.x0, rm.z0), b.tz(rm.x1, rm.z1)];
      const box = { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
      const area = (box.x1 - box.x0) * (box.z1 - box.z0);
      let n = 0;
      if (!flood.error) for (const [x, z, feet] of flood.reached)
        if (Math.abs(feet - lv.y) < 0.6 && x > box.x0 && x < box.x1 && z > box.z0 && z < box.z1) n++;
      const free = Math.min(1, (n * STEP * STEP) / Math.max(0.01, area));
      const status = reached.has(key) ? (free < RULE.freeFloorMin ? "cramped" : "ok")
                   : reachedBare.has(key) ? "blocked by furniture" : "no way in";
      out.push({ id: `${b.id}-${key}`, name: rm.name || rm.t, areaM2: r2(area), freeFloor: r2(free), status });
    }
  }
  return { error: flood.error || null, rooms: out };
}

/* ---- FLOATING / CLIPPING --------------------------------------------------- */
function checkParts(T, b, audit) {
  const mine = audit.filter((a) => a.id && a.id.startsWith(b.id + "-"))
    .map((a) => ({ id: a.id, msg: a.msg, sev: a.sev }));
  const clips = [];
  const cols = T.World.colliders.filter((c) => c.id && c.id.startsWith(b.id + "-") && c.type !== "door");
  const furn = cols.filter((c) => c.type === "furniture"), walls = cols.filter((c) => c.type === "wall");
  const pen = (a, c) => Math.min(a.x1, c.x1) - Math.max(a.x0, c.x0) > RULE.clipMin &&
                        Math.min(a.z1, c.z1) - Math.max(a.z0, c.z0) > RULE.clipMin &&
                        Math.min(a.y1, c.y1) - Math.max(a.y0, c.y0) > RULE.clipMin;
  for (const f of furn) for (const w of walls) if (pen(f, w)) clips.push({ a: f.id, b: w.id, what: "furniture into wall" });
  for (let i = 0; i < furn.length; i++) for (let j = i + 1; j < furn.length; j++)
    if (pen(furn[i], furn[j])) clips.push({ a: furn[i].id, b: furn[j].id, what: "furniture into furniture" });
  return { floating: mine, clips };
}

/* ---- inventory: built / planned / in files never shown --------------------- */
function inventory(T) {
  const placed = {};
  for (const b of T.Town.buildings) placed[b.key] = (placed[b.key] || 0) + 1;
  const types = [];
  for (const [k, d] of Object.entries(T.HOUSE_TYPES)) types.push({ key: k, label: d.label, kind: "house", placed: placed[k] || 0 });
  for (const [k, d] of Object.entries(T.CIVIC_TYPES)) types.push({ key: k, label: d.label, kind: "civic", placed: placed[k] || 0 });

  /* files under world3/ that no page or script ever loads */
  const files = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p); else files.push(path.relative(REPO, p).replace(/\\/g, "/"));
  } };
  walk(path.join(REPO, "world3"));
  const code = files.filter((f) => /\.(html|js|mjs)$/.test(f)).map((f) => fs.readFileSync(path.join(REPO, f), "utf8")).join("\n");
  const neverLoaded = files.filter((f) => /\.(js|mjs|html|glb|gltf|png|jpg|webp|ktx2|json)$/.test(f))
    .filter((f) => !/\/tools\/|\/docs\//.test(f))
    .filter((f) => !f.endsWith("/index.html") || f === "world3/index.html" ? false : true)
    .filter((f) => !code.includes(path.basename(f)));
  return { types, neverLoaded };
}

/* ---- run everything -------------------------------------------------------- */
function inspect(opts) {
  const walk = require(path.join(TOWN, "tools", "walkable.js"));
  const { T, soups } = boot(opts);
  const audit = T.Debug && T.Debug.audit ? T.Debug.audit() : (T.Dbg && T.Dbg.audit ? T.Dbg.audit() : []);
  const buildings = [];
  for (const b of T.Town.buildings) {
    const soup = soups.get(b.id) || new Soup();
    const r = { id: b.id, key: b.key, label: b.def.label, roofType: b.def.roof, levels: b.plan.levels.length,
                tris: soup.count, issues: b.issues.map((i) => `${i.sev}: ${i.id} ${i.msg}`) };
    r.roof = checkRoof(T, b, soup);
    r.stairs = checkStairs(T, b, soup);
    r.doors = checkDoors(T, b);
    r.rooms = checkRooms(T, b, walk);
    r.parts = checkParts(T, b, audit);
    r.score = score(r);
    buildings.push(r);
  }
  return { world: "ashgrove", generated: new Date().toISOString(), rules: RULE, buildings, inventory: inventory(T) };
}

function score(r) {
  const p = [];
  if (r.roof.holes.length) p.push(`${r.roof.holes.length} roof hole(s), ${r.roof.holeAreaM2} m²`);
  if (r.roof.gaps.length) p.push(`${r.roof.gaps.length} roof gap(s), ${r.roof.gapAreaM2} m²`);
  for (const s of r.stairs) for (const q of s.problems) p.push(`stair ${s.id}: ${q}`);
  const bd = r.doors.filter((d) => d.blocked);
  if (bd.length) p.push(`${bd.length} doorway(s) obstructed`);
  if (r.rooms.error) p.push(`front door: ${r.rooms.error}`);
  const shut = r.rooms.rooms.filter((x) => x.status === "no way in" || x.status === "blocked by furniture");
  if (shut.length) p.push(`${shut.length} room(s) you cannot walk into: ${shut.map((x) => x.id.replace(r.id + "-", "") + " " + x.name).join(", ")}`);
  const tight = r.rooms.rooms.filter((x) => x.status === "cramped");
  if (tight.length) p.push(`${tight.length} room(s) cramped (<${RULE.freeFloorMin * 100}% walkable floor): ${tight.map((x) => x.id.replace(r.id + "-", "") + " " + x.name + " " + Math.round(x.freeFloor * 100) + "%").join(", ")}`);
  if (r.parts.floating.length) p.push(`${r.parts.floating.length} float/bury`);
  if (r.parts.clips.length) p.push(`${r.parts.clips.length} clipping pair(s): ${r.parts.clips.map((c) => c.a.replace(r.id + "-", "") + "↔" + c.b.replace(r.id + "-", "")).join(", ")}`);
  return { problems: p, ok: p.length === 0 };
}

module.exports = { inspect, boot, RULE };
