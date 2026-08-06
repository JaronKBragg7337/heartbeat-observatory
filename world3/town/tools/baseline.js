#!/usr/bin/env node
/* ============================================================================
   tools/baseline.js — the regression contract, as a command
   ---------------------------------------------------------------------------
   Runs the town generator headlessly in Node with a stub GL device and
   re-measures everything the town is supposed to guarantee. No dependencies,
   no browser, no GPU.

       node tools/baseline.js            print the table
       node tools/baseline.js --json     machine-readable
       node tools/baseline.js --check    exit 1 if anything regressed

   WHAT THIS CAN AND CANNOT MEASURE
   It measures everything that comes out of the generator and the validators:
   building count, validation errors, building-vs-building separation, stair
   walkability, asset/collider/item counts, triangle count, degenerate polygons.

   It CANNOT measure anything that needs a real GPU or a real device: frames
   per second, draw calls, or VRAM. Those stay in EXPECTED below as inherited
   reference values and are reported as UNVERIFIED. Do not claim you re-measured
   them unless you actually ran the thing on comparable hardware.
   ========================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const RENDER = path.join(ROOT, "render");

/* the load order from index.html, minus the files that only exist to talk to
   a browser (camera, edit, main). debug.js is included for its audit(). */
const FILES = ["core.js", "textures.js", "geom.js", "plan.js", "furniture.js",
               "buildings.js", "props.js", "town.js", "player.js", "debug.js"];

/* ---- the numbers the town is contracted to hold -------------------------- */
const EXPECTED = {
  buildings: 49,
  errors: 0,
  warnings: 0,
  overlaps: 0,
  minGapM: 2.00,
  twoStorey: 22,
  twoStoreyWalkable: 22,
  assets: 4284,
  items: 1414,
  /* 3110 -> 3421 on 2026-08-06: staircases became solid. Every stair run now
     carries one collider per step (steps-1 boxes, each topping out at the
     tread below its span) so you can no longer walk through the side of a
     staircase. Deliberate, re-recorded here rather than widened by tolerance.
     twoStoreyWalkable above is the guard that keeps this honest — the first
     attempt at these colliders took it from 22 to 0. */
  colliders: 3421,
  degenerate: 0,
  staticTris: 863160,
  houseTypes: 13,
  civicTypes: 10,
};
/* measured on a real device; this harness cannot check them */
const INHERITED = {
  "fps (iPhone, ?q=low)": "59-60",
  "draw calls (iPhone)": "~290",
  "VRAM (iPhone, ?q=low)": "42.9 MB",
  "VRAM (desktop)": "86.7 MB",
  "texel density": "256 px/m",
};
const TOLERANCE = { staticTris: 0.02, assets: 0.02, items: 0.02, colliders: 0.02 };

/* ---- a stub device ------------------------------------------------------- */
function stubGL() {
  const noop = () => {};
  const gl = new Proxy({}, {
    get(_, k) {
      if (k === "createBuffer") return () => ({});
      if (k === "getParameter") return () => 4096;
      if (k === "getExtension") return () => null;
      if (k === "getShaderParameter" || k === "getProgramParameter") return () => true;
      if (k === "createShader" || k === "createProgram" || k === "createTexture") return () => ({});
      if (typeof k === "string" && /^[A-Z_0-9]+$/.test(k)) return 1;   // GL constants
      return noop;
    },
  });
  return gl;
}

/* material stand-ins: the generator only reads name/world/rough/metal/flags */
const MATERIALS = ["siding", "brick", "shingle", "metalRoof", "paint", "drywall", "ceiling",
                   "wood", "concrete", "asphalt", "grass", "dirt", "glass", "metal", "tile",
                   "fabric", "leaf", "bark", "markings", "shadowBlob"];

function boot() {
  const sandbox = {
    console, Math, Date, JSON, performance: { now: () => Date.now() },
    navigator: { userAgent: "node", maxTouchPoints: 0 },
    location: { search: "" },
    URLSearchParams,
    document: { createElement: () => ({ getContext: () => null, width: 0, height: 0 }) },
    addEventListener: () => {}, requestAnimationFrame: () => 0, setTimeout,
    Float32Array, Uint32Array, Uint16Array, Uint8Array, Proxy, Object, Array, Map, Set,
    Error, String, Number, Boolean, isNaN, parseInt, parseFloat, Infinity, NaN, undefined,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);

  for (const f of FILES) {
    const src = fs.readFileSync(path.join(RENDER, f), "utf8");
    try { vm.runInContext(src, ctx, { filename: `render/${f}` }); }
    catch (e) { throw new Error(`loading render/${f}: ${e.message}`); }
  }

  const T = sandbox.TOWN;
  T.GL.gl = stubGL();
  T.GL.isGL2 = true;
  T.GL.canvas = { width: 1280, height: 720, clientWidth: 1280, clientHeight: 720 };
  /* real textures need a 2D canvas; the generator only needs the descriptors */
  T.Mats = {};
  for (const n of MATERIALS)
    T.Mats[n] = { name: n, world: 2.0, rough: 1, metal: 0, tex: null, px: 256, density: 128,
                  cutout: n === "leaf", decal: n === "shadowBlob", clamp: n === "shadowBlob" };
  T.TEXEL_TARGET = 256;
  return T;
}

/* ---- measure ------------------------------------------------------------- */
function measure(T) {
  T.Town.build(20260804);
  const W = T.World, out = {};

  out.buildings = T.Town.buildingCount;
  const issues = T.Town.issues.concat(T.Debug.audit());
  out.errors = issues.filter((i) => i.sev === "bad").length;
  out.warnings = issues.filter((i) => i.sev !== "bad").length;
  out.errorList = issues.filter((i) => i.sev === "bad").map((i) => `${i.id} ${i.msg}`);
  out.warningList = issues.filter((i) => i.sev !== "bad").map((i) => `${i.id} ${i.msg}`);

  /* independent separation scan — not the town's own checker, on purpose */
  let overlaps = 0, minGap = Infinity, minPair = "";
  const B = W.buildings;
  for (let i = 0; i < B.length; i++)
    for (let j = i + 1; j < B.length; j++) {
      const a = B[i].foot, b = B[j].foot;
      const dx = Math.max(a[0] - b[3], b[0] - a[3]);
      const dz = Math.max(a[2] - b[5], b[2] - a[5]);
      if (dx < 0 && dz < 0) { overlaps++; continue; }
      const g = Math.hypot(Math.max(dx, 0), Math.max(dz, 0));
      if (g < minGap) { minGap = g; minPair = `${B[i].id}/${B[j].id}`; }
    }
  out.overlaps = overlaps;
  out.minGapM = +minGap.toFixed(2);
  out.minGapPair = minPair;

  /* walk every staircase and confirm it arrives upstairs */
  const P = T.Player;
  let two = 0, walkable = 0;
  const failed = [];
  for (const b of B) {
    if (b.plan.levels.length < 2) continue;
    two++;
    const L0 = b.plan.levels[0], L1 = b.plan.levels[1], s = L0.stairs;
    if (!s) { failed.push(`${b.id} no stairs`); continue; }
    const lx = s.axis === "x" ? s.x0 + 0.25 : s.x0 + s.w / 2;
    const lz = s.axis === "x" ? s.z0 + s.w / 2 : s.z0 + 0.25;
    P.noclip = false;
    P.teleport(b.tx(lx, lz), b.tz(lx, lz), L0.y + 0.3);
    const ex = s.axis === "x" ? s.x0 + s.len : s.x0 + s.w / 2;
    const ez = s.axis === "x" ? s.z0 + s.w / 2 : s.z0 + s.len;
    P.yaw = Math.atan2(-(b.tx(ex, ez) - P.pos[0]), -(b.tz(ex, ez) - P.pos[2]));
    P.pitch = 0;
    for (let i = 0; i < 500; i++) { P.move = [0, 1]; P.update(1 / 60); }
    P.move = [0, 0];
    if (P.pos[1] > L1.y - 0.3) walkable++; else failed.push(`${b.id} ${b.def.label}`);
  }
  out.twoStorey = two;
  out.twoStoreyWalkable = walkable;
  out.stairFailures = failed;

  out.assets = W.assets.length;
  out.items = W.items.length;
  out.colliders = W.colliders.length;
  out.staticTris = T.Town.staticTris;
  out.degenerate = T.Town.degenerate || 0;
  out.houseTypes = Object.keys(T.HOUSE_TYPES).length;
  out.civicTypes = Object.keys(T.CIVIC_TYPES).length;

  const counts = {};
  for (const b of B) counts[b.key] = (counts[b.key] || 0) + 1;
  out.byType = counts;
  return out;
}

/* ---- report -------------------------------------------------------------- */
function main() {
  const asJson = process.argv.includes("--json");
  const check = process.argv.includes("--check");
  let got;
  try { got = measure(boot()); }
  catch (e) { console.error("BASELINE FAILED TO RUN\n" + e.stack); process.exit(2); }

  if (asJson) { console.log(JSON.stringify(got, null, 2)); }
  else {
    const rows = [];
    let bad = 0;
    for (const k of Object.keys(EXPECTED)) {
      const want = EXPECTED[k], have = got[k];
      const tol = TOLERANCE[k] || 0;
      const ok = typeof want === "number"
        ? Math.abs(have - want) <= Math.abs(want * tol) + (tol ? 0 : 1e-9)
        : have === want;
      if (!ok) bad++;
      rows.push(`  ${ok ? "ok  " : "FAIL"}  ${k.padEnd(20)} ${String(have).padStart(10)}   expected ${want}`);
    }
    console.log("\nASHGROVE BASELINE — generator and validators, measured headlessly\n");
    console.log(rows.join("\n"));
    console.log(`\n  closest pair: ${got.minGapPair} at ${got.minGapM} m`);
    if (got.errorList.length) console.log("\n  ERRORS:\n" + got.errorList.map((s) => "    " + s).join("\n"));
    if (got.warningList.length) console.log("\n  WARNINGS:\n" + got.warningList.map((s) => "    " + s).join("\n"));
    if (got.stairFailures.length) console.log("\n  STAIRS NOT WALKABLE:\n" + got.stairFailures.map((s) => "    " + s).join("\n"));

    console.log("\n  UNVERIFIED IN THIS ENVIRONMENT (needs a real GPU / device):");
    for (const k in INHERITED) console.log(`    ${k.padEnd(26)} ${INHERITED[k]}   (inherited reference)`);
    console.log(`\n  ${bad ? bad + " CONTRACT LINE(S) REGRESSED" : "all contract lines hold"}\n`);
    if (check && bad) process.exit(1);
  }
}
main();
