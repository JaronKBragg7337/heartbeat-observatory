#!/usr/bin/env node
/* ============================================================================
   tools/walkable.js — can a player actually GET there?
   ---------------------------------------------------------------------------
   The town already validates that every room is reachable from the front door.
   That check is a graph walk over DOORS (render/plan.js), and it is per-storey.
   It cannot see a staircase fenced off by its own railing, a wardrobe parked in
   a doorway, or an upper floor with no way onto it — because none of those are
   missing doors. They are solid objects in the way.

   Jaron and Lillith found exactly that by walking a house together: the only
   route to the second floor of B32 was straight through the stair railing, and
   it "worked" solely because railings had no colliders.

   So this walks instead of reading the graph. It floods the building with the
   REAL functions the player uses — Player.floorAt and Player.blockedAt — from
   the front door outward, climbing what can be climbed and refusing what is
   solid, and then asks whether every room got visited.

       node tools/walkable.js            print the report
       node tools/walkable.js --json     machine-readable
       node tools/walkable.js --check    exit 1 if any room is unreachable

   WHAT IT CANNOT SEE: anything that needs a GPU, anything about how a room
   looks, and doors that are shut — every door is treated as openable, because
   a player can open them. It answers reachability, not aesthetics.
   ========================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const RENDER = path.join(ROOT, "render");
const FILES = ["core.js", "textures.js", "geom.js", "plan.js", "furniture.js",
               "buildings.js", "props.js", "town.js", "player.js", "debug.js"];

/* Flood resolution. This has to be finer than it first looks. An interior door
   is 0.813 m wide and the player is a 0.30 m radius cylinder, so the band a
   player can actually thread is only about 0.21 m across. A 0.25 m grid steps
   straight over that band and reports half a house unreachable — 227 rooms,
   on a town whose houses people have walked through. 0.12 m guarantees a
   sample lands inside every legal doorway. */
const STEP_M = 0.12;
const MAX_NODES = 400000;   // per building; a furnished house is ~30k

/* ---- the same stub device baseline.js uses ------------------------------- */
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
const MATERIALS = ["siding", "brick", "shingle", "metalRoof", "paint", "drywall", "ceiling",
                   "wood", "concrete", "asphalt", "grass", "dirt", "glass", "metal", "tile",
                   "fabric", "leaf", "bark", "markings", "shadowBlob"];

function boot() {
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
  for (const f of FILES) {
    const src = fs.readFileSync(path.join(RENDER, f), "utf8");
    try { vm.runInContext(src, ctx, { filename: `render/${f}` }); }
    catch (e) { throw new Error(`loading render/${f}: ${e.message}`); }
  }
  const T = sandbox.TOWN;
  T.GL.gl = stubGL(); T.GL.isGL2 = true;
  T.GL.canvas = { width: 1280, height: 720, clientWidth: 1280, clientHeight: 720 };
  T.Mats = {};
  for (const m of MATERIALS) T.Mats[m] = { name: m, world: 1, rough: 1, metal: 0 };
  T.buildMaterials = () => T.Mats;
  T.Town.build(20260804);
  return T;
}

/* ---- geometry helpers ---------------------------------------------------- */
/* a room's world-space AABB, via the building's own plan->world transform */
function roomBox(b, rm) {
  const xs = [], zs = [];
  for (const [px, pz] of [[rm.x0, rm.z0], [rm.x1, rm.z0], [rm.x1, rm.z1], [rm.x0, rm.z1]]) {
    xs.push(b.tx(px, pz)); zs.push(b.tz(px, pz));
  }
  return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
}

function overlaps(a, b, pad) {
  return !(a.x1 + pad < b.x0 || a.x0 - pad > b.x1 || a.z1 + pad < b.z0 || a.z0 - pad > b.z1);
}

/* ---- the walk ------------------------------------------------------------ */
/* Flood the building from just inside its front door. A node is a position
   plus the height the floor put us at, so a staircase naturally produces two
   layers of nodes over the same footprint. */
function floodBuilding(T, b, opts) {
  const W = T.World, Pl = T.Player;
  const STEP_UP = T.CODE.stepUp;
  const ignoreFurniture = !!(opts && opts.ignoreFurniture);

  const bx = { x0: b.bounds[0], x1: b.bounds[3], z0: b.bounds[2], z1: b.bounds[5] };

  /* Narrow the world to this building before using the real collision
     functions: they scan every collider and surface in town, and doing that
     for a quarter-million probes would take minutes. Same functions, same
     answers, a hundredth of the work. */
  /* A shut door is solid, and every door in a freshly built town is shut — so
     without this the flood stops at the first doorway and reports the whole
     house unreachable. A player can open doors, so a door is not an obstacle;
     it is a room boundary. Drop door colliders for the walk. What remains is
     what a player genuinely cannot get past: walls, furniture, stairs. */
  const allCol = W.colliders, allSurf = W.surfaces;
  W.colliders = allCol.filter((c) =>
    c.type !== "door" &&
    !(ignoreFurniture && c.type === "furniture") &&
    overlaps(c, bx, 1.5));
  W.surfaces = allSurf.filter((s) => overlaps(s, bx, 1.5));

  try {
    const front = W.doors.find((d) => d.b === b.id && d.ext && d.front)
               || W.doors.find((d) => d.b === b.id && d.ext);
    if (!front) return { error: "no exterior door" };

    /* Step INSIDE from the door, along the building's inward normal, and start
       on the GROUND floor.
       floorAt(x, z, 1e5) would take the highest surface under the sky — in a
       two-storey house that is the upper floor, so the flood began upstairs
       and reported the entrance hall unreachable. Cap the probe at the ground
       storey's own step height instead.
       Several distances are tried because a door can open straight onto a
       newel post or a piece of furniture; the first spot a player could
       actually stand in wins. */
    const cx = (bx.x0 + bx.x1) / 2, cz = (bx.z0 + bx.z1) / 2;
    const inLen = Math.hypot(cx - front.cx, cz - front.cz) || 1;
    const nx = (cx - front.cx) / inLen, nz = (cz - front.cz) / inLen;
    const groundCeil = b.plan.levels[0].y + STEP_UP;

    let ix = null, iz = null, startFeet = 0;
    for (const dist of [0.7, 1.0, 1.3, 1.6, 0.45]) {
      const px = front.cx + nx * dist, pz = front.cz + nz * dist;
      const f = Pl.floorAt(px, pz, groundCeil);
      if (Pl.blockedAt(px, pz, f)) continue;
      ix = px; iz = pz; startFeet = f;
      break;
    }
    if (ix === null) return { error: "front door opens onto something solid" };
    const key = (x, z, y) => `${Math.round(x / STEP_M)}|${Math.round(z / STEP_M)}|${Math.round(y * 3)}`;
    const seen = new Set();
    const reached = [];
    const queue = [[ix, iz, startFeet]];
    seen.add(key(ix, iz, startFeet));

    const NB = [[STEP_M, 0], [-STEP_M, 0], [0, STEP_M], [0, -STEP_M]];
    let nodes = 0;
    while (queue.length && nodes < MAX_NODES) {
      const [x, z, feet] = queue.shift();
      nodes++;
      reached.push([x, z, feet]);
      for (const [dx, dz] of NB) {
        const nx = x + dx, nz = z + dz;
        if (nx < bx.x0 - 1 || nx > bx.x1 + 1 || nz < bx.z0 - 1 || nz > bx.z1 + 1) continue;
        /* the floor we would end up on, reachable by an auto-step */
        const nf = Pl.floorAt(nx, nz, feet + STEP_UP);
        if (nf - feet > STEP_UP + 1e-6) continue;      // too high to climb
        if (Pl.blockedAt(nx, nz, nf)) continue;        // something solid there
        const k = key(nx, nz, nf);
        if (seen.has(k)) continue;
        seen.add(k);
        queue.push([nx, nz, nf]);
      }
    }
    return { reached, nodes, truncated: nodes >= MAX_NODES };
  } finally {
    W.colliders = allCol; W.surfaces = allSurf;
  }
}

/* which rooms did this flood actually stand in? */
function roomsReached(b, reached) {
  const hit = new Set();
  for (const lv of b.plan.levels) {
    for (const rm of lv.rooms) {
      const box = roomBox(b, rm);
      for (const [x, z, feet] of reached) {
        if (Math.abs(feet - lv.y) > 0.6) continue;              // wrong storey
        if (x < box.x0 || x > box.x1 || z < box.z0 || z > box.z1) continue;
        hit.add(`L${lv.level}-${rm.id}`); break;
      }
    }
  }
  return hit;
}

/* Two walks, because "you cannot get there" has two very different causes.
   STRUCTURAL means the building itself is wrong — a stair fenced by its own
   railing, a room with no way in. FURNISHED-ONLY means the shell is fine and
   somebody parked a wardrobe in the doorway. The first is a generator bug, the
   second is a furniture-placement bug, and they get fixed in different files. */
function checkBuilding(T, b) {
  const out = { id: b.id, key: b.key, label: b.def.label, levels: b.plan.levels.length,
                structural: [], furniture: [], nodes: 0 };

  const withStuff = floodBuilding(T, b);
  if (withStuff.error) { out.structural.push(`(${withStuff.error})`); return out; }
  out.nodes = withStuff.nodes;
  out.truncated = withStuff.truncated;

  const empty = floodBuilding(T, b, { ignoreFurniture: true });
  const hitFull = roomsReached(b, withStuff.reached);
  const hitEmpty = empty.error ? new Set() : roomsReached(b, empty.reached);

  for (const lv of b.plan.levels) {
    for (const rm of lv.rooms) {
      const id = `L${lv.level}-${rm.id}`;
      const label = `${id} ${rm.name || rm.t || ""}`.trim();
      if (hitFull.has(id)) continue;
      if (hitEmpty.has(id)) out.furniture.push(label);   // shell is fine, contents are not
      else out.structural.push(label);                   // the building itself
    }
  }
  return out;
}

/* ---- report -------------------------------------------------------------- */
function main() {
  const asJson = process.argv.includes("--json");
  const check = process.argv.includes("--check");
  let T;
  try { T = boot(); }
  catch (e) { console.error("WALKABLE FAILED TO RUN\n" + e.stack); process.exit(2); }

  const results = T.Town.buildings.map((b) => checkBuilding(T, b));
  const structural = results.filter((r) => r.structural.length);
  const furniture = results.filter((r) => r.furniture.length);
  const nStruct = results.reduce((n, r) => n + r.structural.length, 0);
  const nFurn = results.reduce((n, r) => n + r.furniture.length, 0);

  if (asJson) {
    console.log(JSON.stringify({
      buildings: results.length,
      structuralBuildings: structural.length, structuralRooms: nStruct,
      furnitureBuildings: furniture.length, furnitureRooms: nFurn,
      results,
    }, null, 2));
  } else {
    console.log("\n  PHYSICAL REACHABILITY — flooded from each front door with the player's own collision\n");
    console.log(`    buildings walked                 ${results.length}`);
    console.log(`    rooms unreachable — STRUCTURAL   ${nStruct}  in ${structural.length} building(s)`);
    console.log(`    rooms unreachable — FURNITURE    ${nFurn}  in ${furniture.length} building(s)`);
    const trunc = results.filter((r) => r.truncated);
    if (trunc.length) console.log(`    flood hit the node cap in        ${trunc.length} (result may understate)`);

    if (structural.length) {
      console.log("\n  STRUCTURAL — the building itself has no route in (generator bug):");
      for (const r of structural) console.log(`    ${r.id} ${r.label}\n        ${r.structural.join("\n        ")}`);
    }
    if (furniture.length) {
      console.log("\n  FURNITURE — the shell is fine, something is parked in the way (placement bug):");
      for (const r of furniture) console.log(`    ${r.id} ${r.label}\n        ${r.furniture.join("\n        ")}`);
    }
    console.log(`\n  ${nStruct ? nStruct + " ROOM(S) STRUCTURALLY UNREACHABLE" : "no room is structurally unreachable"}\n`);
  }
  /* --check fails on STRUCTURAL only. Furniture in a doorway is worth knowing
     about and worth fixing, but it is not a broken building, and a contract
     that cries wolf gets ignored. */
  if (check && nStruct) process.exit(1);
}
main();
