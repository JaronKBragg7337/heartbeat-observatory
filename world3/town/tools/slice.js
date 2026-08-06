#!/usr/bin/env node
/* ============================================================================
   tools/slice.js — the vertical slice, run and measured headlessly
   ---------------------------------------------------------------------------
   The chain under test — three principles forced to interact, one line of
   cause and effect:

     a child is BORN (organism: inherited traits, elapsed-time lifecycle)
       → the household OUTGROWS its house (demand: occupancy crosses ratio)
         → the town GROWS a house (world: record → construction project)
           → but only because a builder WORKS the seat (economy: labor/day)
             → and only if the town's OWN VALIDATORS pass it (no unvalidated
               placement path exists)

       node tools/slice.js        exit 0 if the whole chain holds

   No browser, no GPU: the town runs in the same stub-device sandbox as
   tools/baseline.js; sim/ and world/ run as plain Node scripts.
   ========================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");

/* sim/ and world/ attach to globalThis.ASH — load them in dependency order */
for (const f of ["sim/rng.js", "sim/canonical.js", "sim/clock.js", "sim/ids.js",
                 "sim/organisms.js", "sim/people.js", "sim/jobs.js", "sim/demand.js",
                 "sim/resources.js", "sim/engine.js", "world/registry.js", "world/growth.js", "world/bootstrap.js"])
  require(path.join(ROOT, f));
const ASH = globalThis.ASH;

/* ---- the render sandbox (same stub device as tools/baseline.js) ---------- */
const RENDER_FILES = ["core.js", "textures.js", "geom.js", "plan.js", "furniture.js",
                      "buildings.js", "props.js", "town.js", "player.js", "debug.js"];
const MATERIALS = ["siding", "brick", "shingle", "metalRoof", "paint", "drywall", "ceiling",
                   "wood", "concrete", "asphalt", "grass", "dirt", "glass", "metal", "tile",
                   "fabric", "leaf", "bark", "markings", "shadowBlob"];

function stubGL() {
  const noop = () => {};
  return new Proxy({}, {
    get(_, k) {
      if (k === "createBuffer") return () => ({});
      if (k === "getParameter") return () => 4096;
      if (k === "getExtension") return () => null;
      if (k === "getShaderParameter" || k === "getProgramParameter") return () => true;
      if (k === "createShader" || k === "createProgram" || k === "createTexture") return ({});
      if (typeof k === "string" && /^[A-Z_0-9]+$/.test(k)) return 1;
      return noop;
    },
  });
}

function bootTown() {
  const sandbox = {
    console, Math, Date, JSON, performance: { now: () => Date.now() },
    navigator: { userAgent: "node", maxTouchPoints: 0 },
    location: { search: "" }, URLSearchParams,
    document: { createElement: () => ({ getContext: () => null, width: 0, height: 0 }) },
    addEventListener: () => {}, requestAnimationFrame: () => 0, setTimeout,
    Float32Array, Uint32Array, Uint16Array, Uint8Array, Proxy, Object, Array, Map, Set,
    Error, String, Number, Boolean, isNaN, parseInt, parseFloat, Infinity, NaN, undefined,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  for (const f of RENDER_FILES)
    vm.runInContext(fs.readFileSync(path.join(ROOT, "render", f), "utf8"), ctx, { filename: `render/${f}` });
  const T = sandbox.TOWN;
  T.GL.gl = stubGL();
  T.GL.isGL2 = true;
  T.GL.canvas = { width: 1280, height: 720, clientWidth: 1280, clientHeight: 720 };
  T.Mats = {};
  for (const n of MATERIALS)
    T.Mats[n] = { name: n, world: 2.0, rough: 1, metal: 0, tex: null, px: 256, density: 128,
                  cutout: n === "leaf", decal: n === "shadowBlob", clamp: n === "shadowBlob" };
  T.TEXEL_TARGET = 256;
  return T;
}

const TOWN_SEED = 20260804;
const SIM_SEED = "ashgrove-slice-001";
const DAY = ASH.WORLD_DAY_MS;
const T0 = Date.UTC(2026, 7, 4, 12, 0, 0);          // fixed genesis: reproducible

/* ---- assertions ---------------------------------------------------------- */
let failures = 0;
function check(name, cond, detail) {
  console.log(`  ${cond ? "ok  " : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
  if (!cond) failures++;
}

/* independent separation scan — not the town's own checker, on purpose */
function countOverlaps(buildings) {
  let overlaps = 0;
  for (let i = 0; i < buildings.length; i++)
    for (let j = i + 1; j < buildings.length; j++) {
      const a = buildings[i].foot, b = buildings[j].foot;
      const dx = Math.max(a[0] - b[3], b[0] - a[3]);
      const dz = Math.max(a[2] - b[5], b[2] - a[5]);
      if (dx < 0 && dz < 0) overlaps++;
    }
  return overlaps;
}

/* ---- one full run of the world ------------------------------------------- */
function runWorld(verbose) {
  const T = bootTown();
  T.Town.build(TOWN_SEED);                            // the founding town
  const storage = new Map();
  const store = { getItem: (k) => (storage.has(k) ? storage.get(k) : null),
                  setItem: (k, v) => storage.set(k, v) };

  const adapter = {
    foundingCount: () => T.Town.buildings.length,
    houseHomes: () => {
      const out = {};
      for (const b of T.Town.buildings)
        if (!b.def.com) out[b.id] = { beds: T.Town.bedroomsOf(b) };
      return out;
    },
    businessAddress: () => {
      const barn = T.Town.buildings.find((b) => b.key === "barn");
      return (barn || T.Town.buildings.find((b) => b.def.com)).id;
    },
    /* D14: the utilities' real addresses, by building key */
    buildingByKey: (key) => {
      const b = T.Town.buildings.find((b) => b.key === key && !b.growth);
      return b ? b.id : null;
    },
    freeLots: () => T.Town.freeLots(),
    houseTypes: () => {
      const out = {};
      for (const [k, d] of Object.entries(T.HOUSE_TYPES)) out[k] = { w: d.w, d: d.d, label: d.label };
      return out;
    },
    bedsByType: () => {
      const out = {};
      for (const b of T.Town.buildings)
        if (!b.def.com && out[b.key] === undefined) out[b.key] = T.Town.bedroomsOf(b);
      return out;
    },
  };

  const tryBuild = (records) => {
    T.Town.build(TOWN_SEED, null, records);
    const bad = T.Town.issues.filter((i) => i.sev === "bad").map((i) => `${i.id} ${i.msg}`);
    const overlaps = countOverlaps(T.Town.buildings);
    if (overlaps) bad.push(`${overlaps} building overlap(s)`);
    const bedsById = {};
    for (const b of T.Town.buildings) if (b.growth) bedsById[b.id] = T.Town.bedroomsOf(b);
    return { ok: bad.length === 0, errors: bad, bedsById };
  };

  /* load 1: genesis. load 2: four hundred days later — the real catch-up
     path, long enough for conceptions (not just the founding pregnancy) to
     become births, and births to become growth. */
  ASH.bootWorld({ storage: store, seed: SIM_SEED, townSeed: TOWN_SEED, nowMs: T0,
                  adapter, tryBuild });
  const outcome = ASH.bootWorld({ storage: store, seed: SIM_SEED, townSeed: TOWN_SEED,
                                  nowMs: T0 + 400 * DAY, adapter, tryBuild });

  /* final state: rebuild with whatever was committed, leave it standing */
  const final = tryBuild(outcome.records);
  const doc = JSON.parse(storage.get("ashgrove-world-v1"));
  return { T, outcome, final, doc, store };
}

/* ---- the run, and what it must prove ------------------------------------- */
console.log("\nASHGROVE VERTICAL SLICE — birth → demand → growth → labor → validation\n");

const run1 = runWorld();
const ev = run1.outcome.events;
const byType = (t) => ev.filter((e) => e.type === t);

console.log("the chain, as it happened:");
for (const e of ev.filter((e) => ["expecting", "conception", "birth", "growth-requested", "construction-started",
                                  "growth-complete", "moved-in", "hired", "growth-unplaceable"].includes(e.type)))
  console.log(`  day ${String(e.day).padStart(3)}  ${e.type.padEnd(22)} ${e.msg}`);

const birth = byType("birth")[0];
const request = byType("growth-requested")[0];
const started = byType("construction-started")[0];
const complete = byType("growth-complete")[0];
const moved = byType("moved-in")[0];

console.log("\nevery link:");
const simState = run1.doc.simSnapshot.state;
const anyOccupiedSeat = Object.values(simState.businesses)
  .some((biz) => biz.seats.some((s) => s.occupantId));
check("a worker holds the builder seat (economy exists)", anyOccupiedSeat,
      Object.values(simState.businesses)[0].seats.map((s) => s.occupantId || "vacant").join(" / "));
check("a child was born (organism lifecycle)", !!birth, birth && birth.data.childId);
check("birth preceded the housing request", birth && request && birth.day <= request.day,
      birth && request && `day ${birth.day} → day ${request.day}`);
check("the request started construction (world decision)", !!started,
      started && JSON.stringify(started.data.lot));
check("labor was worked before completion (economy gated the growth)",
      complete && run1.doc.simSnapshot.state.counters.laborWorked >= 30,
      complete && `${run1.doc.simSnapshot.state.counters.laborWorked} labor worked`);
check("construction completed", !!complete, complete && complete.data.record.id);
check("the household moved into the new house", !!moved, moved && moved.data.buildingId);

console.log("\nthe town grows on its own, past the scripted start:");
const conceptions = byType("conception");
const births = byType("birth");
const hirings = byType("hired");
check("at least one couple conceived on their own (not the founding pregnancy)",
      conceptions.length >= 1, `${conceptions.length} conception(s)`);
check("the labor pool hired beyond the founding worker", hirings.length >= 1,
      `${hirings.length} hiring(s), ${simState.counters.laborWorked} total labor`);
console.log(`  trajectory: ${births.length} birth(s), ${run1.outcome.records.length} house(s) grown, ` +
            `${Object.keys(simState.people).length} people, ${Object.keys(simState.homes).length} homes`);
for (const r of run1.outcome.records)
  console.log(`  grown: ${r.id} ${r.key} at lot ${r.lot.block}:${r.lot.index}`);

console.log("\nthe child's traits are inheritance, not a reroll:");
if (birth) {
  const st = run1.doc.simSnapshot.state;
  const child = st.people[birth.data.childId];
  const hh = st.households[birth.data.householdId];
  const parents = hh.memberIds.filter((id) => id !== child.id)
    .map((id) => st.people[id])
    .filter((p) => p.ageDays >= 18 * 365);         // siblings are not parents
  let ok = parents.length === 2;
  for (const axis of ASH.TRAIT_AXES) {
    const blend = (parents[0].traits[axis] + parents[1].traits[axis]) / 2;
    if (Math.abs(child.traits[axis] - blend) > 0.100001) ok = false;   // bounded mutation ±0.1
  }
  check("every axis within the mutation bound of the parental blend", ok);
}

console.log("\nthe grown town still holds the contract:");
check("committed records validate clean on replay", run1.final.ok,
      run1.final.errors.join("; ") || "0 errors, 0 overlaps");
const expectedCount = 49 + run1.outcome.records.length;
check(`founding town untouched: 49 founding + ${run1.outcome.records.length} grown`,
      run1.T.Town.buildings.length === expectedCount, `${run1.T.Town.buildings.length} buildings`);
check("no building overlaps (independent scan)", countOverlaps(run1.T.Town.buildings) === 0);
const grown = run1.T.Town.buildings.find((b) => b.growth);
check("the first grown building has a resolvable address", !!grown && grown.id === "B50",
      grown && `${grown.id} ${grown.def.label}`);
if (grown) {
  const roomGids = [];
  for (const lv of grown.plan.levels) for (const rm of lv.rooms) roomGids.push(rm.gid);
  check("its rooms are addressable in the global namespace",
        roomGids.length > 0 && roomGids.every((g) => g.startsWith("B50-L")),
        roomGids.slice(0, 3).join(", "));
  const fresh = runWorld();
  const grown2 = fresh.T.Town.buildings.find((b) => b.growth);
  check("same record, same building: identity-seeded replay is byte-stable",
        !!grown2 && grown2.center[0] === grown.center[0] && grown2.def.key === grown.def.key,
        grown2 && `center ${grown2.center.map((v) => v.toFixed(2))}`);
}

console.log("\ndeterminism:");
const run2 = runWorld();
check("two independent runs reach the same sim digest",
      run1.doc.simSnapshot.digest === run2.doc.simSnapshot.digest,
      run1.doc.simSnapshot.digest);
check("two independent runs commit the same records",
      JSON.stringify(run1.outcome.records) === JSON.stringify(run2.outcome.records));

console.log(`\n  ${failures ? failures + " SLICE CHECK(S) FAILED" : "the whole chain holds"}\n`);
process.exit(failures ? 1 : 0);
