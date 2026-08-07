/* ============================================================================
   town.js — the world: grid, roads, sidewalks, lots, placement, park
   The whole town sits on a 4 m grid (CODE.grid). Grid cell G<col>-<row> maps
   to world metres by col*4 .. col*4+4 with the origin at the south-west.
   ========================================================================== */
(function () {
"use strict";
const T = window.TOWN, C = T.CODE, P = T.Props, W = T.World;
const M = () => T.Mats;

/* ---------------------------------------------------------------- layout */
const ROADS_X = [24, 88, 152, 216, 280];
const ROADS_Z = [24, 100, 176];
const ROAD_HALF = 4.0;              // 8 m carriageway, two 4 m lanes
const WALK_OUT  = 5.9;              // kerb at 4.0, 1.9 m footway to 5.9
const LAWN_Y    = 0;                // grade datum: lawn and footway are y = 0
const ROAD_Y    = -C.curbH;         // carriageway sits one kerb below
const CHUNK     = 64;

const Town = (T.Town = {
  W: ROADS_X[ROADS_X.length - 1] + 24,
  D: ROADS_Z[ROADS_Z.length - 1] + 24,
  chunks: new Map(),
  roadsX: ROADS_X, roadsZ: ROADS_Z,
  spawn: [ROADS_X[0] + 12, 1.7, ROADS_Z[0] + 12],
});

/* analytic ground height: carriageway is a step below the footway ---------- */
Town.groundY = function (x, z) {
  for (const rx of ROADS_X) if (Math.abs(x - rx) < ROAD_HALF) return ROAD_Y;
  for (const rz of ROADS_Z) if (Math.abs(z - rz) < ROAD_HALF) return ROAD_Y;
  return LAWN_Y;
};
Town.onRoad = function (x, z) { return Town.groundY(x, z) === ROAD_Y; };

/* grid addressing --------------------------------------------------------- */
Town.gridOf = function (x, z) {
  return { col: Math.floor(x / C.grid), row: Math.floor(z / C.grid) };
};
Town.gridId = function (x, z) {
  const g = Town.gridOf(x, z);
  return `G${String(g.col).padStart(2, "0")}-${String(g.row).padStart(2, "0")}`;
};
Town.gridCenter = function (col, row) {
  return [col * C.grid + C.grid / 2, row * C.grid + C.grid / 2];
};

/* identity-derived numeric seed (FNV-1a): growth buildings draw from WHO they
   are, never from WHERE in the build order they happen to land */
function idSeed(seed, id) {
  const str = `${seed || 1337}|${id}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0) || 88675123;
}

/* ---- plain-data views for world/ (lots and bedrooms, no geometry) -------- */
Town.freeLots = function () {
  const out = [];
  for (const block of Town.blocks || [])
    for (const lot of block.lots)
      if (!lot.building)
        out.push({ block: block.key, index: lot.index, front: lot.front, deep: lot.deep, face: lot.face });
  return out;
};
Town.bedroomsOf = function (b) {
  let n = 0;
  for (const lv of b.plan.levels)
    for (const rm of lv.rooms)
      if (rm.t === "bed" || rm.t === "bedMain") n++;
  return n;
};

/* chunked static geometry ------------------------------------------------- */
function chunkKey(x, z) { return `${Math.floor(x / CHUNK)},${Math.floor(z / CHUNK)}`; }
Town.chunkAt = function (x, z) {
  const k = chunkKey(x, z);
  let c = Town.chunks.get(k);
  if (!c) { c = { key: k, base: new T.Builder(), detail: new T.Builder() }; Town.chunks.set(k, c); }
  return c;
};

/* ========================================================================= */
/* GROUND, ROADS, FOOTWAYS                                                   */
/* ========================================================================= */
function emitGround(rnd) {
  const grass = M().grass, asph = M().asphalt, conc = M().concrete, mark = M().markings;

  /* Lawn is laid in the bands BETWEEN the road corridors — tiling a single
     sheet over everything would bury the carriageway 150 mm below it.      */
  const bands = (roads, end) => {
    const out = [];
    let a = -20;
    for (const r of roads) { if (r - WALK_OUT > a) out.push([a, r - WALK_OUT]); a = r + WALK_OUT; }
    if (end + 20 > a) out.push([a, end + 20]);
    return out;
  };
  const bx = bands(ROADS_X, Town.W), bz = bands(ROADS_Z, Town.D);
  let gi = 0;
  for (const [x0, x1] of bx) for (const [z0, z1] of bz) {
    const nx = Math.max(1, Math.ceil((x1 - x0) / 18)), nz = Math.max(1, Math.ceil((z1 - z0) / 18));
    const sw = (x1 - x0) / nx, sd = (z1 - z0) / nz;
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const px = x0 + i * sw, pz = z0 + j * sd;
      const ch = Town.chunkAt(px + sw / 2, pz + sd / 2);
      ch.base.id(`GND-${gi++}`, "ground");
      ch.base.plane(px, pz, sw, sd, LAWN_Y, grass,
        { uvOff: [rnd() * 3, rnd() * 3], tint: [0.92 + rnd() * 0.16, 0.94 + rnd() * 0.12, 0.90 + rnd() * 0.16] });
      ch.base.endId();
    }
  }

  /* carriageways */
  const road = (x0, z0, x1, z1, id) => {
    const ch = Town.chunkAt((x0 + x1) / 2, (z0 + z1) / 2);
    ch.base.id(id, "road");
    ch.base.plane(x0, z0, x1 - x0, z1 - z0, ROAD_Y, asph, { uvOff: [rnd(), rnd()] });
    ch.base.endId();
  };
  for (const rx of ROADS_X) {
    for (let z = -8; z < Town.D + 8; z += CHUNK) {
      const z1 = Math.min(z + CHUNK, Town.D + 8);
      road(rx - ROAD_HALF, z, rx + ROAD_HALF, z1, `ROAD-X${rx}-${z}`);
    }
  }
  for (const rz of ROADS_Z) {
    for (let x = -8; x < Town.W + 8; x += CHUNK) {
      const x1 = Math.min(x + CHUNK, Town.W + 8);
      road(x, rz - ROAD_HALF, x1, rz + ROAD_HALF, `ROAD-Z${rz}-${x}`);
    }
  }

  /* kerbs + footways, skipping the junctions */
  const isJunctionX = (x) => ROADS_X.some((r) => Math.abs(x - r) < WALK_OUT + 0.5);
  const isJunctionZ = (z) => ROADS_Z.some((r) => Math.abs(z - r) < WALK_OUT + 0.5);

  const kerbWalk = (axis, fixed, a0, a1, side) => {
    const ch = Town.chunkAt(axis === "z" ? fixed : (a0 + a1) / 2, axis === "z" ? (a0 + a1) / 2 : fixed);
    const b = ch.base;
    const inner = fixed + side * ROAD_HALF, outer = fixed + side * WALK_OUT;
    b.id(`WALK-${axis}${fixed}-${side > 0 ? "P" : "N"}-${Math.round(a0)}`, "footway");
    if (axis === "z") {          // road runs along Z, footway is a strip in X
      const x0 = Math.min(inner, outer), x1 = Math.max(inner, outer);
      b.box(x0, ROAD_Y, a0, x1 - x0, -ROAD_Y, a1 - a0, conc, { uvOff: [rnd(), rnd()], grime: .25, grimeY: ROAD_Y });
      b.box(side > 0 ? inner : inner - 0.12, ROAD_Y, a0, 0.12, -ROAD_Y + 0.02, a1 - a0, conc,
            { tint: [.96, .96, .95], bevel: 0.012 });            // kerb upstand
    } else {
      const z0 = Math.min(inner, outer), z1 = Math.max(inner, outer);
      b.box(a0, ROAD_Y, z0, a1 - a0, -ROAD_Y, z1 - z0, conc, { uvOff: [rnd(), rnd()], grime: .25, grimeY: ROAD_Y });
      b.box(a0, ROAD_Y, side > 0 ? inner : inner - 0.12, a1 - a0, -ROAD_Y + 0.02, 0.12, conc,
            { tint: [.96, .96, .95], bevel: 0.012 });
    }
    b.endId();
  };

  /* exact spans between junctions, then split for chunking — stepping in
     fixed increments left 24 m holes wherever a step straddled a crossing */
  const spans = (crossings, a0, a1) => {
    const out = [];
    let a = a0;
    for (const c of crossings) {
      if (c - WALK_OUT > a) out.push([a, c - WALK_OUT]);
      a = Math.max(a, c + WALK_OUT);
    }
    if (a1 > a) out.push([a, a1]);
    const cut = [];
    for (const [s, e] of out) {
      const n = Math.max(1, Math.ceil((e - s) / 28));
      for (let i = 0; i < n; i++) cut.push([s + (e - s) * (i / n), s + (e - s) * ((i + 1) / n)]);
    }
    return cut;
  };
  for (const rx of ROADS_X)
    for (const [a, b2] of spans(ROADS_Z, -6, Town.D + 6)) { kerbWalk("z", rx, a, b2, -1); kerbWalk("z", rx, a, b2, 1); }
  for (const rz of ROADS_Z)
    for (const [a, b2] of spans(ROADS_X, -6, Town.W + 6)) { kerbWalk("x", rz, a, b2, -1); kerbWalk("x", rz, a, b2, 1); }
  void isJunctionX; void isJunctionZ;
  /* junction corners: quarter pads so the footway network is continuous */
  for (const rx of ROADS_X) for (const rz of ROADS_Z) {
    const ch = Town.chunkAt(rx, rz);
    ch.base.id(`XING-${rx}-${rz}`, "footway");
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const x0 = rx + sx * ROAD_HALF, z0 = rz + sz * ROAD_HALF;
      const x1 = rx + sx * WALK_OUT, z1 = rz + sz * WALK_OUT;
      ch.base.box(Math.min(x0, x1), ROAD_Y, Math.min(z0, z1), Math.abs(x1 - x0), -ROAD_Y, Math.abs(z1 - z0),
                  conc, { uvOff: [rnd(), rnd()], grime: .25, grimeY: ROAD_Y });
    }
    ch.base.endId();
    /* zebra bars on all four approaches */
    ch.base.id(`ZEBRA-${rx}-${rz}`, "marking");
    const MY = ROAD_Y + 0.012;
    for (let i = 0; i < 6; i++) {
      const o = -ROAD_HALF + 0.5 + i * 1.25;
      ch.base.plane(rx + o, rz - ROAD_HALF - 2.4, 0.55, 2.0, MY, mark, { tint: [1, 1, 1] });
      ch.base.plane(rx + o, rz + ROAD_HALF + 0.4, 0.55, 2.0, MY, mark, { tint: [1, 1, 1] });
      ch.base.plane(rx - ROAD_HALF - 2.4, rz + o, 2.0, 0.55, MY, mark, { tint: [1, 1, 1] });
      ch.base.plane(rx + ROAD_HALF + 0.4, rz + o, 2.0, 0.55, MY, mark, { tint: [1, 1, 1] });
    }
    ch.base.endId();
  }
  /* centre line dashes */
  for (const rx of ROADS_X)
    for (let z = 4; z < Town.D; z += 6) {
      if (ROADS_Z.some((r) => Math.abs(z - r) < WALK_OUT + 3)) continue;
      const ch = Town.chunkAt(rx, z);
      ch.base.id(`CL-${rx}-${z}`, "marking");
      ch.base.plane(rx - 0.09, z, 0.18, 3.0, ROAD_Y + 0.011, mark, { tint: [.95, .82, .25] });
      ch.base.endId();
    }
  for (const rz of ROADS_Z)
    for (let x = 4; x < Town.W; x += 6) {
      if (ROADS_X.some((r) => Math.abs(x - r) < WALK_OUT + 3)) continue;
      const ch = Town.chunkAt(x, rz);
      ch.base.id(`CL-${x}-${rz}`, "marking");
      ch.base.plane(x, rz - 0.09, 3.0, 0.18, ROAD_Y + 0.011, mark, { tint: [.95, .82, .25] });
      ch.base.endId();
    }
}

/* ========================================================================= */
/* LOTS                                                                      */
/* ========================================================================= */
/* A lot's FRONTAGE runs along the street it faces; its DEPTH runs back from
   it. Civic buildings are much wider and deeper than houses, so the downtown
   block is platted differently rather than trying to squeeze a 20 m
   schoolhouse into 17.4 m of frontage — which is what merged three of them
   into each other.                                                          */
function lotDims(lot) {
  const alongX = lot.face === "-z" || lot.face === "+z";
  return { front: alongX ? lot.x1 - lot.x0 : lot.z1 - lot.z0,
           deep:  alongX ? lot.z1 - lot.z0 : lot.x1 - lot.x0 };
}
const MIN_SETBACK = 2.2, REAR = 0.6, SIDE = 0.4;

function setbackFor(def, lot) {
  const { deep } = lotDims(lot);
  const want = def.porch ? 5.5 : 6.5;
  return T.clamp(deep - def.d - 1.2, MIN_SETBACK, want);
}
function lotFits(lot, def) {
  const { front, deep } = lotDims(lot);
  return def.w + SIDE <= front && MIN_SETBACK + def.d + REAR <= deep;
}

function makeLots(downtownKey, parkKey) {
  const blocks = [];
  for (let i = 0; i < ROADS_X.length - 1; i++)
    for (let j = 0; j < ROADS_Z.length - 1; j++) {
      const x0 = ROADS_X[i] + WALK_OUT, x1 = ROADS_X[i + 1] - WALK_OUT;
      const z0 = ROADS_Z[j] + WALK_OUT, z1 = ROADS_Z[j + 1] - WALK_OUT;
      const key = `${i},${j}`;
      const block = { i, j, key, x0, z0, x1, z1, lots: [],
                      kind: key === downtownKey ? "downtown" : key === parkKey ? "park" : "resi" };
      block.center = [(x0 + x1) / 2, (z0 + z1) / 2];
      blocks.push(block);
      if (block.kind === "park") continue;

      if (block.kind === "downtown") {
        /* deep lots, and only two of them across the north edge so the
           schoolhouse and the town hall each get real frontage */
        const LOTD = 28;
        const nw = 2, sw = 3;
        for (let k = 0; k < nw; k++)
          block.lots.push({ x0: x0 + k * (x1 - x0) / nw, x1: x0 + (k + 1) * (x1 - x0) / nw,
                            z0, z1: z0 + LOTD, face: "-z", block });
        for (let k = 0; k < sw; k++)
          block.lots.push({ x0: x0 + k * (x1 - x0) / sw, x1: x0 + (k + 1) * (x1 - x0) / sw,
                            z0: z1 - LOTD, z1, face: "+z", block });
      } else {
        const LOTD = 22, NW = 3;
        const bw = (x1 - x0) / NW;
        for (let k = 0; k < NW; k++) {
          block.lots.push({ x0: x0 + k * bw, x1: x0 + (k + 1) * bw, z0, z1: z0 + LOTD, face: "-z", block });
          block.lots.push({ x0: x0 + k * bw, x1: x0 + (k + 1) * bw, z0: z1 - LOTD, z1, face: "+z", block });
        }
        block.lots.push({ x0, x1: x0 + LOTD, z0: z0 + LOTD + 1, z1: z1 - LOTD - 1, face: "-x", block });
        block.lots.push({ x0: x1 - LOTD, x1, z0: z0 + LOTD + 1, z1: z1 - LOTD - 1, face: "+x", block });
      }
      for (const l of block.lots) Object.assign(l, lotDims(l));
      /* stable lot identity: growth records refer to a lot as
         { block: block.key, index } and this order never changes */
      block.lots.forEach((l, i) => { l.index = i; });
    }
  return blocks;
}

const FACE_YAW = { "-z": 0, "-x": Math.PI / 2, "+z": Math.PI, "+x": -Math.PI / 2 };

function placeOrigin(def, lot, setback) {
  const w = def.w, d = def.d;
  const cx = (lot.x0 + lot.x1) / 2, cz = (lot.z0 + lot.z1) / 2;
  switch (lot.face) {
    case "-z": return [cx - w / 2, lot.z0 + setback];
    case "+z": return [cx + w / 2, lot.z1 - setback];
    case "-x": return [lot.x0 + setback, cz + w / 2];
    default:   return [lot.x1 - setback, cz - w / 2];
  }
}

/* Assign the biggest footprints first, each into the tightest lot that still
   fits it, so a cottage never squats on the only lot a chapel could use.   */
function allocate(entries, lots, issues) {
  const free = lots.slice();
  const order = entries.slice().sort((a, b) =>
    (b.def.w * b.def.d) - (a.def.w * a.def.d) || b.def.w - a.def.w);
  const out = [];
  for (const e of order) {
    let best = -1, bestScore = 1e9;
    for (let i = 0; i < free.length; i++) {
      const lot = free[i];
      if (!lotFits(lot, e.def)) continue;
      /* prefer a snug fit, and keep civic downtown where it belongs */
      const d = lotDims(lot);
      let s = (d.front - e.def.w) + (d.deep - e.def.d) * 0.5;
      if (e.def.com && lot.block.kind !== "downtown") s += 14;
      if (!e.def.com && lot.block.kind === "downtown") s += 22;
      if (s < bestScore) { bestScore = s; best = i; }
    }
    if (best < 0) {
      issues.push({ sev: "bad", id: e.key,
        msg: `no lot fits ${e.def.label} (${e.def.w}×${e.def.d} m) — not placed` });
      continue;
    }
    out.push({ e, lot: free.splice(best, 1)[0] });
  }
  return out;
}

/* ========================================================================= */
/* BUILD                                                                     */
/* ========================================================================= */
Town.build = function (seed, progress, growth) {
  const rnd = T.rng(seed || 1337);
  W.reset(); P.resetIds(); Town.chunks.clear();
  Town.buildings = [];
  Town.issues = [];

  emitGround(rnd);

  const blocks = makeLots("1,1", "0,1");
  Town.blocks = blocks;             // retained so growth can find free lots
  const downtown = blocks.find((b) => b.kind === "downtown");
  const park = blocks.find((b) => b.kind === "park");

  /* ---- assemble the build order: 3 of each house type, all civic types -- */
  const houseKeys = Object.keys(T.HOUSE_TYPES);
  const civicKeys = Object.keys(T.CIVIC_TYPES);
  const entries = civicKeys.map((k) => ({ key: k, def: T.CIVIC_TYPES[k] }));
  for (let rep = 0; rep < 3; rep++)
    for (const k of houseKeys) entries.push({ key: k, def: T.HOUSE_TYPES[k] });

  const allLots = [];
  for (const bl of blocks) for (const l of bl.lots) allLots.push(l);
  const placements = allocate(entries, allLots, Town.issues);
  /* shuffle the draw order so identical house types don't end up adjacent */
  placements.sort((a, b) => (houseKeys.indexOf(a.e.key) % 3) - (houseKeys.indexOf(b.e.key) % 3) || rnd() - 0.5);

  let n = 0, idx = 1;
  const total = placements.length;
  for (const { e, lot } of placements) {
    const def = e.def;
    const id = `B${String(idx).padStart(2, "0")}`;
    const setback = setbackFor(def, lot);
    const [ox, oz] = placeOrigin(def, lot, setback);
    const B = new T.Building(def, id, ox, oz, FACE_YAW[lot.face], (seed || 1337) + idx * 7919);
    B.register();
    B.lot = lot; B.key = e.key; B.setback = setback;
    const ch = Town.chunkAt(B.center[0], B.center[1]);
    B.emitExterior(ch.base, ch.detail);
    Town.buildings.push(B);
    Town.issues.push(...B.issues);
    lot.building = B;
    yardFor(B, lot, ch, rnd);
    idx++;
    if (progress) progress(++n / total, `${def.label} ${id}`);
  }
  /* ---- growth buildings, appended from world records ---------------------
     These arrive as plain records ({ id, key, lot: { block, index } }) from
     the world change log — decided by world/growth.js, already gated through
     this build's own validators once, and checked again here on every replay.
     Each is seeded from its IDENTITY, not its build-order index (P1 done for
     growth only — founding buildings keep positional seeds, so the founding
     town stays byte-identical and the baseline contract does not move).   */
  for (const rec of growth || []) {
    const def = T.HOUSE_TYPES[rec.key] || T.CIVIC_TYPES[rec.key];
    const block = def && blocks.find((b) => b.key === rec.lot.block);
    const lot = block && block.lots[rec.lot.index];
    if (!def || !lot) {
      Town.issues.push({ sev: "bad", id: rec.id, msg: `growth record ${rec.id} does not resolve to a type and lot` });
      continue;
    }
    if (lot.building) {
      Town.issues.push({ sev: "bad", id: rec.id, msg: `growth lot ${rec.lot.block}:${rec.lot.index} is already occupied — ${rec.id} not placed` });
      continue;
    }
    if (!lotFits(lot, def)) {
      Town.issues.push({ sev: "bad", id: rec.id, msg: `${def.label} no longer fits lot ${rec.lot.block}:${rec.lot.index} — ${rec.id} not placed` });
      continue;
    }
    const setback = setbackFor(def, lot);
    const [ox, oz] = placeOrigin(def, lot, setback);
    const B = new T.Building(def, rec.id, ox, oz, FACE_YAW[lot.face], idSeed(seed, rec.id));
    B.register();
    B.lot = lot; B.key = rec.key; B.setback = setback; B.growth = true;
    const ch = Town.chunkAt(B.center[0], B.center[1]);
    B.emitExterior(ch.base, ch.detail);
    Town.buildings.push(B);
    Town.issues.push(...B.issues);
    lot.building = B;
    yardFor(B, lot, ch, T.rng(idSeed(seed, `${rec.id}|yard`)));
  }
  Town.buildingCount = Town.buildings.length;
  Town.issues.push(...Town.checkSeparation());

  emitPark(park, rnd);
  emitStreetFurniture(rnd);
  emitOutskirts(rnd);

  /* upload every chunk */
  let tris = 0, bytes = 0;
  for (const ch of Town.chunks.values()) {
    ch.mesh = ch.base.build();
    ch.detailMesh = ch.detail.build();
    ch.assets = ch.base.assets.concat(ch.detail.assets);
    ch.bounds = ch.mesh.bounds;
    if (!ch.detailMesh.empty) {
      const db = ch.detailMesh.bounds;
      for (let i = 0; i < 3; i++) ch.bounds[i] = Math.min(ch.bounds[i], db[i]);
      for (let i = 3; i < 6; i++) ch.bounds[i] = Math.max(ch.bounds[i], db[i]);
    }
    tris += ch.base.tris + ch.detail.tris;
    bytes += (ch.mesh.bytes || 0) + (ch.detailMesh.bytes || 0);
    ch.base = ch.detail = null;
  }
  Town.staticTris = tris; Town.staticBytes = bytes;

  /* spawn on the pavement outside the town hall */
  const hall = Town.buildings.find((b) => b.def.key === "townHall") || Town.buildings[0];
  const s = Town.spawnFor(hall);
  Town.spawn = s;
  return Town;
};

/* ===================================================== SEPARATION CHECK ==
   The per-building validator only ever knew about one building at a time,
   which is how a 20 m schoolhouse ended up 2.8 m inside the town hall while
   the panel still read "0 errors". This is the check that was missing.     */
Town.checkSeparation = function () {
  const out = [], B = Town.buildings;
  const gap = (a, b) => {
    const dx = Math.max(a[0] - b[3], b[0] - a[3]);
    const dz = Math.max(a[2] - b[5], b[2] - a[5]);
    if (dx < 0 && dz < 0) return -Math.min(-dx, -dz);       // negative = overlap
    return Math.hypot(Math.max(dx, 0), Math.max(dz, 0));
  };
  for (let i = 0; i < B.length; i++)
    for (let j = i + 1; j < B.length; j++) {
      const a = B[i], b = B[j];
      const g = gap(a.foot, b.foot);
      if (g < 0) {
        out.push({ sev: "bad", id: `${a.id}/${b.id}`,
          msg: `${a.def.label} and ${b.def.label} overlap by ${(-g).toFixed(2)} m` });
      } else if (g < 0.5) {
        out.push({ sev: "bad", id: `${a.id}/${b.id}`,
          msg: `${a.def.label} and ${b.def.label} only ${g.toFixed(2)} m apart` });
      } else if (g < 1.2) {
        out.push({ sev: "warn", id: `${a.id}/${b.id}`,
          msg: `${a.def.label} / ${b.def.label} gap ${g.toFixed(2)} m — tight` });
      }
      /* porches, porticos and chimneys stick out past the footprint */
      if (g >= 0 && gap(a.outer, b.foot) < 0 && g >= 0.5)
        out.push({ sev: "warn", id: `${a.id}/${b.id}`,
          msg: `${a.def.label} porch or stack reaches into ${b.def.label}` });
    }
  /* and nothing may sit in the carriageway */
  for (const b of B) {
    const f = b.foot;
    for (const rx of ROADS_X)
      if (f[0] < rx + ROAD_HALF && f[3] > rx - ROAD_HALF)
        out.push({ sev: "bad", id: b.id, msg: `${b.def.label} overhangs the roadway at x=${rx}` });
    for (const rz of ROADS_Z)
      if (f[2] < rz + ROAD_HALF && f[5] > rz - ROAD_HALF)
        out.push({ sev: "bad", id: b.id, msg: `${b.def.label} overhangs the roadway at z=${rz}` });
  }
  return out;
};

Town.spawnFor = function (b) {
  const fx = b.tx(b.def.w / 2, -8), fz = b.tz(b.def.w / 2, -8);
  return [fx, Town.groundY(fx, fz) + 1.7, fz];
};

/* ---------------------------------------------------------------- yards -- */
function yardFor(B, lot, ch, rnd) {
  const b = ch.base, conc = M().concrete;
  const def = B.def;
  /* path from the footway to the front door */
  const doorL = [def.w / 2, def.porch ? -(def.porch.depth || 2.2) - 0.4 : -1.4];
  const px = B.tx(doorL[0], doorL[1]), pz = B.tz(doorL[0], doorL[1]);
  const face = lot.face;
  let ex = px, ez = pz;
  if (face === "-z") ez = lot.z0 - 0.1; else if (face === "+z") ez = lot.z1 + 0.1;
  else if (face === "-x") ex = lot.x0 - 0.1; else ex = lot.x1 + 0.1;
  b.id(`${B.id}-PATH`, "path");
  const x0 = Math.min(px, ex) - 0.7, x1 = Math.max(px, ex) + 0.7;
  const z0 = Math.min(pz, ez) - 0.7, z1 = Math.max(pz, ez) + 0.7;
  b.plane(x0, z0, x1 - x0, z1 - z0, LAWN_Y + 0.012, conc, { uvOff: [rnd(), rnd()], grime: .3, tint: [.95, .95, .93] });
  b.endId();

  /* Driveway + parked car for houses.
     It used to be a fixed 14 m slab centred 6.5 m in front of the house, which
     took no notice of where the lot actually ended — so on any shallower lot it
     ran straight out over the kerb and lay across the road. Jaron spotted it
     from the street.
     It now runs from beside the house to the kerb and stops, which is what the
     front path two blocks up has always done (lot.z0 - 0.1 and friends). The
     length therefore comes from the lot rather than from a constant, and a deep
     lot gets a long drive while a shallow one gets a short one. */
  if (!def.com && rnd() < 0.75) {
    const side = rnd() < 0.5 ? -1 : 1;
    const horiz = face === "-x" || face === "+x";
    const HALF = 1.6;                       // 3.2 m wide, as before

    /* a point beside the house, level with its front */
    const nearL = [def.w / 2 + side * (def.w / 2 + 1.6), -1.0];
    const nx = B.tx(nearL[0], nearL[1]), nz = B.tz(nearL[0], nearL[1]);

    /* the kerb on whichever edge of the lot this house faces */
    let kx = nx, kz = nz;
    if (face === "-z") kz = lot.z0 - 0.1; else if (face === "+z") kz = lot.z1 + 0.1;
    else if (face === "-x") kx = lot.x0 - 0.1; else kx = lot.x1 + 0.1;

    const x0 = horiz ? Math.min(nx, kx) : nx - HALF;
    const x1 = horiz ? Math.max(nx, kx) : nx + HALF;
    const z0 = horiz ? nz - HALF : Math.min(nz, kz);
    const z1 = horiz ? nz + HALF : Math.max(nz, kz);

    b.id(`${B.id}-DRV`, "driveway");
    b.plane(x0, z0, x1 - x0, z1 - z0, LAWN_Y + 0.010, conc, { uvOff: [rnd(), rnd()], grime: .35, tint: [.9, .9, .88] });
    b.endId();
    /* park the car on the drive, a little in from the kerb rather than on it */
    if (rnd() < 0.6) {
      const t = 0.34;
      P.car(b, ch.detail, nx + (kx - nx) * t, nz + (kz - nz) * t,
            horiz ? Math.PI / 2 : 0, rnd);
    }
  }
  /* planting, fence and mailbox */
  const fx = B.tx(def.w * 0.2, -0.6), fz2 = B.tz(def.w * 0.2, -0.6);
  P.bush(b, fx, fz2, rnd);
  P.bush(b, B.tx(def.w * 0.8, -0.6), B.tz(def.w * 0.8, -0.6), rnd);
  if (!def.com) {
    const mx = B.tx(def.w / 2 + 2.6, -(def.porch ? 5.0 : 5.6)), mz = B.tz(def.w / 2 + 2.6, -(def.porch ? 5.0 : 5.6));
    P.mailbox(b, mx, mz, B.yaw);
    if (rnd() < 0.5) {
      const t1 = B.tx(-1.5, def.d + 3), t2 = B.tz(-1.5, def.d + 3);
      P.tree(b, t1, t2, rnd, 0.9 + rnd() * 0.5);
    }
    if (rnd() < 0.35) P.playSet(b, B.tx(def.w / 2, def.d + 5), B.tz(def.w / 2, def.d + 5));
  }
  if (rnd() < 0.4) P.bin(b, B.tx(def.w - 1.0, -2.2), B.tz(def.w - 1.0, -2.2));
}

/* ----------------------------------------------------------------- park -- */
function emitPark(block, rnd) {
  const cx = block.center[0], cz = block.center[1];
  const ch = Town.chunkAt(cx, cz);
  const b = ch.base, dt = ch.detail;
  /* gravel loop path */
  b.id("PARK-PATH", "path");
  const R = 16;
  for (let i = 0; i < 48; i++) {
    const a0 = (i / 48) * 6.283, a1 = ((i + 1) / 48) * 6.283;
    const p0 = [cx + Math.cos(a0) * R, cz + Math.sin(a0) * R];
    const p1 = [cx + Math.cos(a1) * R, cz + Math.sin(a1) * R];
    b.quad([p0[0] - Math.cos(a0), LAWN_Y + 0.011, p0[1] - Math.sin(a0)],
           [p0[0] + Math.cos(a0), LAWN_Y + 0.011, p0[1] + Math.sin(a0)],
           [p1[0] + Math.cos(a1), LAWN_Y + 0.011, p1[1] + Math.sin(a1)],
           [p1[0] - Math.cos(a1), LAWN_Y + 0.011, p1[1] - Math.sin(a1)],
           M().dirt, { uvOff: [rnd(), rnd()] });
  }
  b.endId();
  /* pond */
  b.id("PARK-POND", "water");
  for (let i = 0; i < 20; i++) {
    const a0 = (i / 20) * 6.283, a1 = ((i + 1) / 20) * 6.283;
    b.tri([cx - 10, LAWN_Y - 0.05, cz + 9],
          [cx - 10 + Math.cos(a1) * 6.5, LAWN_Y - 0.05, cz + 9 + Math.sin(a1) * 4.6],
          [cx - 10 + Math.cos(a0) * 6.5, LAWN_Y - 0.05, cz + 9 + Math.sin(a0) * 4.6],
          M().glass, { tint: [.42, .58, .58], ao: 1 });
  }
  b.endId();
  /* pavilion */
  const px = cx + 8, pz = cz - 6;
  b.id("PAV01", "pavilion");
  b.box(px - 3.6, 0, pz - 3.6, 7.2, LAWN_Y + 0.12, 7.2, M().concrete, { tint: [.88, .88, .86], bevel: 0.02, grime: .3 });
  for (const [ox, oz] of [[-3.2, -3.2], [3.0, -3.2], [-3.2, 3.0], [3.0, 3.0]]) {
    b.box(px + ox, LAWN_Y + 0.12, pz + oz, 0.22, 2.85, 0.22, M().paint, { tint: [.94, .93, .90], bevel: 0.014 });
    b.box(px + ox - 0.05, LAWN_Y + 0.12, pz + oz - 0.05, 0.32, 0.16, 0.32, M().paint, { tint: [.94, .93, .90], bevel: 0.012 });
    W.colliders.push({ x0: px + ox, x1: px + ox + 0.22, z0: pz + oz, z1: pz + oz + 0.22, y0: 0, y1: 3, id: "PAV01", type: "post" });
  }
  b.hipRoof(px - 4.2, LAWN_Y + 3.0, pz - 4.2, 8.4, 8.4, 0.55, 0.3, M().shingle, { tint: [.5, .46, .44] });
  W.surfaces.push({ x0: px - 3.6, x1: px + 3.6, z0: pz - 3.6, z1: pz + 3.6, y: LAWN_Y + 0.12, id: "PAV01" });
  W.assets.push({ id: "PAV01", type: "pavilion", box: [px - 4.2, 0, pz - 4.2, px + 4.2, LAWN_Y + 6, pz + 4.2], expectY: 0 });
  b.endId();
  P.bench(b, px, pz + 2.4, 0); P.bench(b, px, pz - 2.4, Math.PI);
  P.playSet(b, cx + 6, cz + 10);
  /* trees ringing the block */
  for (let i = 0; i < 34; i++) {
    const a = rnd() * 6.283, rr = 19 + rnd() * 9;
    const tx = cx + Math.cos(a) * rr, tz = cz + Math.sin(a) * rr;
    if (tx < block.x0 + 1 || tx > block.x1 - 1 || tz < block.z0 + 1 || tz > block.z1 - 1) continue;
    P.tree(Town.chunkAt(tx, tz).base, tx, tz, rnd, 1.0 + rnd() * 0.6);
  }
  for (let i = 0; i < 10; i++) {
    const a = rnd() * 6.283, rr = 6 + rnd() * 6;
    P.bench(b, cx + Math.cos(a) * (R + 2.2), cz + Math.sin(a) * (R + 2.2), -a);
  }
  P.sign(b, cx, block.z0 + 2, 0, "ASHGROVE PARK");
  dt.id("PARK-DT", "detail"); dt.endId();
}

/* -------------------------------------------------------- street things -- */
function emitStreetFurniture(rnd) {
  const step = 13;
  for (const rx of ROADS_X)
    for (let z = 10; z < Town.D - 6; z += step) {
      if (ROADS_Z.some((r) => Math.abs(z - r) < WALK_OUT + 4)) continue;
      const side = ((z / step) | 0) % 2 ? 1 : -1;
      const ch = Town.chunkAt(rx, z);
      P.lamp(ch.base, ch.detail, rx + side * (WALK_OUT + 0.6), z, side > 0 ? Math.PI / 2 : -Math.PI / 2);
      if (rnd() < 0.55) P.tree(ch.base, rx - side * (WALK_OUT + 1.4), z + 5, rnd, 0.85 + rnd() * 0.4);
      if (rnd() < 0.22) P.hydrant(ch.base, rx + side * (WALK_OUT - 0.7), z + 3);
    }
  for (const rz of ROADS_Z)
    for (let x = 10; x < Town.W - 6; x += step) {
      if (ROADS_X.some((r) => Math.abs(x - r) < WALK_OUT + 4)) continue;
      const side = ((x / step) | 0) % 2 ? 1 : -1;
      const ch = Town.chunkAt(x, rz);
      P.lamp(ch.base, ch.detail, x, rz + side * (WALK_OUT + 0.6), side > 0 ? Math.PI : 0);
      if (rnd() < 0.5) P.tree(ch.base, x + 5, rz - side * (WALK_OUT + 1.4), rnd, 0.85 + rnd() * 0.4);
      if (rnd() < 0.2) P.hydrant(ch.base, x + 3, rz + side * (WALK_OUT - 0.7));
    }
  /* street name signs + parked cars at every junction */
  for (const rx of ROADS_X) for (const rz of ROADS_Z) {
    const ch = Town.chunkAt(rx, rz);
    P.sign(ch.base, rx + WALK_OUT - 0.8, rz + WALK_OUT - 0.8, Math.PI / 4, `${rx}/${rz}`);
  }
  for (const rx of ROADS_X)
    for (let z = 16; z < Town.D - 16; z += 21) {
      if (ROADS_Z.some((r) => Math.abs(z - r) < WALK_OUT + 8)) continue;
      if (rnd() < 0.45) {
        const ch = Town.chunkAt(rx, z);
        P.car(ch.base, ch.detail, rx + (rnd() < 0.5 ? -2.3 : 2.3), z, 0, rnd);
      }
    }
}

/* ------------------------------------------------------------ outskirts -- */
function emitOutskirts(rnd) {
  for (let i = 0; i < 120; i++) {
    const edge = (rnd() * 4) | 0;
    let x, z;
    if (edge === 0) { x = rnd() * Town.W; z = -4 - rnd() * 18; }
    else if (edge === 1) { x = rnd() * Town.W; z = Town.D + 4 + rnd() * 18; }
    else if (edge === 2) { x = -4 - rnd() * 18; z = rnd() * Town.D; }
    else { x = Town.W + 4 + rnd() * 18; z = rnd() * Town.D; }
    P.tree(Town.chunkAt(x, z).base, x, z, rnd, 1.0 + rnd() * 0.8);
  }
  /* boundary fences along the back of the perimeter blocks */
  for (let i = 0; i < ROADS_X.length - 1; i++) {
    const ch = Town.chunkAt((ROADS_X[i] + ROADS_X[i + 1]) / 2, ROADS_Z[0] + 40);
    P.fence(ch.base, ROADS_X[i] + WALK_OUT, ROADS_Z[0] + 40, ROADS_X[i + 1] - WALK_OUT, ROADS_Z[0] + 40, [.92, .91, .88]);
  }
}
})();
