#!/usr/bin/env node
/* ============================================================================
   tools/growth.js — stable founding identity (P1) and live growth (P2),
   verified headlessly
   ---------------------------------------------------------------------------
   Two contracts, one harness:

   P1 (D15) — the founding 49 are world RECORDS with identity-derived seeds,
   exactly like growth (D8): ASH.buildingSeed(townSeed, id) is byte-identical
   to render/town.js idSeed, the capture is sorted so it does not depend on
   the host's enumeration order, pre-D15 saves backfill, and an adapter that
   never heard of foundingRecords() still founds the same world.

   P2 (D15) — growth commits mid-session: ASH.worldSession steps one day at
   a time (snapshot/restore between days, like a real session), commits
   buildings through the SAME tryBuild validation gate and the SAME engine
   labor gating as catch-up, fires the optional adapter.onGrowthCommitted
   once per committed record — and reaches the byte-same world as the
   equivalent load-time catch-up run (D7).

       node tools/growth.js        exit 0 if every check holds

   No browser, no GPU: the town runs in the same stub-device sandbox as
   tools/baseline.js / slice.js.
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
const DAYS = 400;

/* the render layer's own identity seed, extracted from its source — P1 is
   only done if world/registry.js buildingSeed matches THIS, not a paraphrase */
const idSeedSrc = fs.readFileSync(path.join(ROOT, "render", "town.js"), "utf8")
  .match(/function idSeed\(seed, id\) \{[\s\S]*?\n\}/);
if (!idSeedSrc) throw new Error("idSeed not found in render/town.js");
const renderIdSeed = eval(`(${idSeedSrc[0]})`);

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

function freshStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), _map: m };
}
const loadDoc = (store) => JSON.parse(store.getItem("ashgrove-world-v1"));

/* A host (adapter + tryBuild) over a freshly booted town. Options:
     foundingOrder  "forward" | "reverse" — enumeration order for the plat
     withFounding   implement foundingRecords() (D15) or stay pre-D15
     onCommitted    collector fn — implementing onGrowthCommitted (D15)   */
function makeHost(T, opts) {
  opts = opts || {};
  T.Town.build(TOWN_SEED);
  const founding = () => {
    const out = [];
    for (const b of T.Town.buildings) {
      if (b.growth) continue;
      const block = T.Town.blocks.find((bl) => bl.lots.includes(b.lot));
      out.push({ id: b.id, key: b.key, lot: { block: block.key, index: b.lot.index } });
    }
    return opts.foundingOrder === "reverse" ? out.reverse() : out;
  };
  const adapter = {
    foundingCount: () => T.Town.buildings.filter((b) => !b.growth).length,
    houseHomes: () => {
      const out = {};
      for (const b of T.Town.buildings)
        if (!b.def.com && !b.growth) out[b.id] = { beds: T.Town.bedroomsOf(b) };
      return out;
    },
    businessAddress: () => {
      const barn = T.Town.buildings.find((b) => b.key === "barn");
      return (barn || T.Town.buildings.find((b) => b.def.com)).id;
    },
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
        if (!b.def.com && !b.growth && out[b.key] === undefined) out[b.key] = T.Town.bedroomsOf(b);
      return out;
    },
  };
  if (opts.withFounding) adapter.foundingRecords = founding;
  if (opts.onCommitted)
    adapter.onGrowthCommitted = (record, info) => opts.onCommitted(record, info);
  const tryBuild = (records) => {
    T.Town.build(TOWN_SEED, null, records);
    const bad = T.Town.issues.filter((i) => i.sev === "bad").map((i) => `${i.id} ${i.msg}`);
    const overlaps = countOverlaps(T.Town.buildings);
    if (overlaps) bad.push(`${overlaps} building overlap(s)`);
    const bedsById = {};
    for (const b of T.Town.buildings) if (b.growth) bedsById[b.id] = T.Town.bedroomsOf(b);
    return { ok: bad.length === 0, errors: bad, bedsById };
  };
  return { adapter, tryBuild };
}

/* the reference run: load-time catch-up, exactly the slice's path (D7) */
function runCatchup(opts) {
  const host = makeHost(bootTown(), opts);
  const store = freshStorage();
  ASH.bootWorld({ storage: store, seed: SIM_SEED, townSeed: TOWN_SEED, nowMs: T0,
                  adapter: host.adapter, tryBuild: host.tryBuild });
  const outcome = ASH.bootWorld({ storage: store, seed: SIM_SEED, townSeed: TOWN_SEED,
                                  nowMs: T0 + DAYS * DAY, adapter: host.adapter, tryBuild: host.tryBuild });
  const final = host.tryBuild(outcome.records);
  return { store, outcome, final, doc: loadDoc(store) };
}

/* the live run: a real session's shape — every day is a fresh worldSession,
   so the sim is restored from its digest-verified snapshot between days (P2) */
function runLive(opts) {
  const host = makeHost(bootTown(), opts);
  const store = freshStorage();
  ASH.worldSession({ storage: store, seed: SIM_SEED, townSeed: TOWN_SEED, nowMs: T0,
                     adapter: host.adapter, tryBuild: host.tryBuild });   // founds at day 0
  let committed = 0;
  for (let d = 0; d < DAYS; d++) {
    const r = ASH.worldSession({ storage: store, seed: SIM_SEED, townSeed: TOWN_SEED,
                                 adapter: host.adapter, tryBuild: host.tryBuild }).advanceDay();
    committed += r.committed.length;
  }
  return { store, committed, doc: loadDoc(store), tryBuild: host.tryBuild };
}

console.log("\nASHGROVE GROWTH — founding identity (P1) and live mid-session growth (P2)\n");

/* ============================ 1. founding identity (P1) ================== */
console.log("1. the founding 49 are identity-seeded world records:");
const catchCommits = [];
const A = runCatchup({ withFounding: true, onCommitted: (r) => catchCommits.push(r) });
const fnd = A.doc.founding;
check("49 founding records captured", fnd.length === 49, `${fnd.length} records`);
check("every founding record carries id, key and a real lot",
      fnd.every((r) => /^B\d{2}$/.test(r.id) && typeof r.key === "string" &&
                       r.lot && typeof r.lot.block === "string" && Number.isInteger(r.lot.index)),
      fnd.slice(0, 3).map((r) => `${r.id}:${r.key}@${r.lot.block}:${r.lot.index}`).join(" "));
const idsSorted = fnd.map((r) => r.id);
check("the capture is sorted by id (enumeration order cannot leak in)",
      JSON.stringify(idsSorted) === JSON.stringify(idsSorted.slice().sort()),
      `${idsSorted[0]}..${idsSorted[idsSorted.length - 1]}`);
{
  const all = fnd.concat(A.outcome.records);
  const mism = all.filter((r) => ASH.buildingSeed(TOWN_SEED, r.id) !== renderIdSeed(TOWN_SEED, r.id));
  check("buildingSeed matches render/town.js idSeed for founding AND growth records",
        mism.length === 0, `${all.length} records checked against the render source`);
}
{
  const ids = ASH.worldIdentities(A.doc);
  check("worldIdentities lists 49 founding + grown records, each with its seed",
        ids.length === 49 + A.outcome.records.length &&
        ids.every((e) => Number.isInteger(e.seed) && e.seed > 0),
        `${ids.length} identities, growth flags: ${ids.filter((e) => e.growth).length}`);
}

console.log("\n2. identity is byte-stable regardless of enumeration order:");
{
  const B = runCatchup({ withFounding: true, foundingOrder: "reverse" });
  check("a host enumerating the plat in reverse captures the byte-same founding records",
        JSON.stringify(B.doc.founding) === JSON.stringify(fnd));
  check("…and reaches the same sim digest",
        B.doc.simSnapshot.digest === A.doc.simSnapshot.digest, B.doc.simSnapshot.digest);
}
{
  /* a pre-D15 save (no founding field) backfills on next boot */
  const store = freshStorage();
  store.setItem("ashgrove-world-v1", JSON.stringify(A.doc));
  const doc = loadDoc(store);
  delete doc.founding;
  store.setItem("ashgrove-world-v1", JSON.stringify(doc));
  const host = makeHost(bootTown(), { withFounding: true });
  ASH.worldSession({ storage: store, seed: SIM_SEED, townSeed: TOWN_SEED,
                     adapter: host.adapter, tryBuild: host.tryBuild });
  const back = loadDoc(store);
  check("a pre-D15 save backfills founding records on the next boot",
        JSON.stringify(back.founding) === JSON.stringify(fnd),
        `${back.founding.length} records recaptured`);
}
{
  /* the pre-D15 host (render/main.js today): no foundingRecords, no hooks */
  const host = makeHost(bootTown(), {});
  const store = freshStorage();
  const out = ASH.bootWorld({ storage: store, seed: SIM_SEED, townSeed: TOWN_SEED, nowMs: T0,
                              adapter: host.adapter, tryBuild: host.tryBuild });
  const doc = loadDoc(store);
  check("an adapter without foundingRecords still founds the same world, plat left positional",
        out.errors.length === 0 && doc.founding.length === 0 && doc.simSnapshot.state.day === 0,
        "genesis day 0, no errors, founding capture empty");
}

/* ============================ 3. live growth (P2) ======================== */
console.log("\n3. a live session grows the town mid-session:");
const liveCommits = [];
const L = runLive({ withFounding: true,
                    onCommitted: (r, info) => liveCommits.push({ record: r, day: info.day, count: info.records.length }) });
check("at least one building completed mid-session (not at load)",
      L.committed >= 1, `${L.committed} commit(s): ${L.doc.records.map((r) => r.id).join(", ")}`);
check("the first mid-session commit is B50, the town's next identity",
      L.doc.records[0] && L.doc.records[0].id === "B50",
      L.doc.records[0] && `${L.doc.records[0].id} ${L.doc.records[0].key}`);
check("onGrowthCommitted fired exactly once per committed record",
      liveCommits.length === L.committed && liveCommits.length === L.doc.records.length,
      `${liveCommits.length} hook call(s) for ${L.doc.records.length} record(s)`);
check("each hook call carried the record, its day, and the growing record list",
      liveCommits.every((c, i) => c.record.id === L.doc.records[i].id &&
                                  Number.isInteger(c.day) && c.count === i + 1),
      liveCommits.map((c) => `${c.record.id}@d${c.day}`).join(" ") || "none");
check("the hook never fires during load-time catch-up replay",
      catchCommits.length === 0 && A.outcome.records.length === L.doc.records.length,
      `${A.outcome.records.length} catch-up commit(s), 0 hook calls`);

console.log("\n4. live and catch-up reach the byte-same world:");
check("same sim digest after 400 days", L.doc.simSnapshot.digest === A.doc.simSnapshot.digest,
      L.doc.simSnapshot.digest);
check("same committed records, same order",
      JSON.stringify(L.doc.records) === JSON.stringify(A.outcome.records));
check("same founding capture", JSON.stringify(L.doc.founding) === JSON.stringify(fnd));
{
  const sa = A.doc.simSnapshot.state, sl = L.doc.simSnapshot.state;
  check("same labor gating: identical labor worked on both paths",
        sl.counters.laborWorked === sa.counters.laborWorked && sl.counters.laborWorked >= 30,
        `${sl.counters.laborWorked} labor (catch-up ${sa.counters.laborWorked})`);
  const final = L.tryBuild(L.doc.records);
  check("the live-grown town passes the town's own validators", final.ok,
        final.errors.join("; ") || "0 errors, 0 overlaps");
}

console.log("\n5. a pre-D15 host (today's render/main.js) grows live without the hook:");
{
  const C = runLive({});      // no foundingRecords, no onGrowthCommitted
  check("live session without any D15 hooks reaches the same digest",
        C.doc.simSnapshot.digest === A.doc.simSnapshot.digest, C.doc.simSnapshot.digest);
  check("…and commits the same records (reload replay still works)",
        JSON.stringify(C.doc.records) === JSON.stringify(A.outcome.records));
}

console.log("\n6. bootWorld hands back a live session that continues the world:");
{
  const mk = () => {
    const host = makeHost(bootTown(), { withFounding: true });
    const store = freshStorage();
    ASH.bootWorld({ storage: store, seed: SIM_SEED, townSeed: TOWN_SEED, nowMs: T0,
                    adapter: host.adapter, tryBuild: host.tryBuild });
    const out = ASH.bootWorld({ storage: store, seed: SIM_SEED, townSeed: TOWN_SEED,
                                nowMs: T0 + DAYS * DAY, adapter: host.adapter, tryBuild: host.tryBuild });
    return { host, store, out };
  };
  const d1 = mk(), d2 = mk();
  const r1 = d1.out.session.advanceDay();                    // continue from the boot
  const r2 = ASH.worldSession({ storage: d2.store, seed: SIM_SEED, townSeed: TOWN_SEED,
                                adapter: d2.host.adapter, tryBuild: d2.host.tryBuild }).advanceDay();
  check("boot's session steps day 401 identically to a freshly opened session",
        r1.day === DAYS + 1 && r2.day === DAYS + 1 &&
        loadDoc(d1.store).simSnapshot.digest === loadDoc(d2.store).simSnapshot.digest,
        `day ${r1.day}`);
}

console.log(`\n  ${failures ? failures + " GROWTH CHECK(S) FAILED"
                              : "identity and live growth hold: P1 seeded, P2 commits mid-session"}\n`);
process.exit(failures ? 1 : 0);
