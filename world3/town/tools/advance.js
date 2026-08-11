#!/usr/bin/env node
/* ============================================================================
   tools/advance.js — the town's clock, run headlessly

   Ashgrove's world layer was always storage-agnostic: bootWorld() takes a
   { getItem, setItem } store, founds the world if it is empty, and steps every
   day the town lived unobserved (world/bootstrap.js: "bootWorld owns the
   unobserved days"). The browser passes localStorage; tools/slice.js passes a
   Map. This passes Supabase, so the days pass whether or not anybody visits.

   The sim and the town generator are pure computation — no THREE, no GPU, no
   DOM beyond a stub device — so the whole thing runs in Node or Deno.

       node tools/advance.js --dry-run     compute and print, write nothing
       node tools/advance.js               compute and commit

   Live mode needs SUPABASE_URL and SUPABASE_SERVICE_KEY in the environment.
   Dry mode needs neither: it reads the world's public row shape from the
   constants below and reports exactly what a commit would send.
   ========================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const DRY = process.argv.includes("--dry-run");
const STORAGE_KEY = "ashgrove-world-v1";

/* the live row as it stands when this runs with no database reachable */
const FALLBACK_ROW = {
  id: "main", seed: "ashgrove-001", town_seed: "20260804", day: 0, digest: "",
  founding: [], records: [], log: [], sim_snapshot: null,
  world_day_ms: 86400000, genesis_at: "2026-08-06T00:00:00+00:00",
};

/* ---- sim + world, in dependency order (same list as tools/slice.js) ------ */
for (const f of ["sim/rng.js", "sim/canonical.js", "sim/clock.js", "sim/ids.js",
                 "sim/organisms.js", "sim/people.js", "sim/jobs.js", "sim/demand.js",
                 "sim/resources.js", "sim/engine.js", "world/registry.js",
                 "world/growth.js", "world/bootstrap.js"])
  require(path.join(ROOT, f));
const ASH = globalThis.ASH;

/* ---- the render sandbox: geometry only, stub device (as tools/slice.js) -- */
const RENDER_FILES = ["core.js", "textures.js", "geom.js", "plan.js", "furniture.js",
                      "buildings.js", "props.js", "town.js", "player.js", "debug.js"];
const MATERIALS = ["siding", "brick", "shingle", "metalRoof", "paint", "drywall", "ceiling",
                   "wood", "concrete", "asphalt", "grass", "dirt", "glass", "metal", "tile",
                   "fabric", "leaf", "bark", "markings", "shadowBlob"];

function stubGL() {
  const noop = () => {};
  return new Proxy({}, { get(_, k) {
    if (k === "createBuffer") return () => ({});
    if (k === "getParameter") return () => 4096;
    if (k === "getExtension") return () => null;
    if (k === "getShaderParameter" || k === "getProgramParameter") return () => true;
    if (k === "createShader" || k === "createProgram" || k === "createTexture") return ({});
    if (typeof k === "string" && /^[A-Z_0-9]+$/.test(k)) return 1;
    return noop;
  }});
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

/* ---- Supabase ------------------------------------------------------------ */
const URL_ = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;

async function sbFetch(pathname, init = {}) {
  const res = await fetch(`${URL_}${pathname}`, {
    ...init,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`,
               "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${pathname}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

/* --row <file>: use a world3_world row exported by any other means. Lets the
   day be computed without a service key, and keeps --dry-run honest: dry means
   "write nothing", never "read something else". */
async function loadRow() {
  const at = process.argv.indexOf("--row");
  if (at !== -1 && process.argv[at + 1])
    return JSON.parse(fs.readFileSync(process.argv[at + 1], "utf8"));
  if (URL_ && KEY)
    return (await sbFetch("/rest/v1/world3_world?id=eq.main&select=*"))[0];
  console.warn("  ! no --row and no SUPABASE_URL/KEY: falling back to the row " +
               "recorded in this file, which may be out of date");
  return FALLBACK_ROW;
}

const commit = (fromDigest, doc, day, digest) =>
  sbFetch("/rest/v1/rpc/world3_advance_day", {
    method: "POST",
    body: JSON.stringify({ p_from_digest: fromDigest, p_day: day, p_digest: digest,
                           p_records: doc.records, p_log: doc.log,
                           p_sim_snapshot: doc.simSnapshot, p_founding: doc.founding }),
  });

/* ---- the run ------------------------------------------------------------- */
(async function main() {
  const row = await loadRow();
  const genesisMs = Date.parse(row.genesis_at);
  const townSeed = Number(row.town_seed);
  const nowMs = Date.now();
  const due = Math.floor((nowMs - genesisMs) / Number(row.world_day_ms));

  console.log(`\nAshgrove clock — ${DRY ? "DRY RUN, nothing will be written" : "live"}`);
  console.log(`  stored day ${row.day}   due day ${due}   owed ${Math.max(0, due - row.day)}`);
  if (due <= row.day) { console.log("  nothing owed; the town is current.\n"); return; }

  const T = bootTown();
  T.Town.build(townSeed);
  const foundingCount = T.Town.buildings.length;

  /* the doc the world layer expects, rebuilt from the row */
  const doc = row.sim_snapshot
    ? { version: 1, seed: row.seed, townSeed, foundingCount, genesisMs,
        founding: row.founding || [], records: row.records || [],
        log: row.log || [], simSnapshot: row.sim_snapshot }
    : null;

  const mem = new Map();
  if (doc) mem.set(STORAGE_KEY, JSON.stringify(doc));
  const store = { getItem: (k) => (mem.has(k) ? mem.get(k) : null),
                  setItem: (k, v) => mem.set(k, v) };

  const adapter = {
    foundingCount: () => T.Town.buildings.length,
    houseHomes: () => {
      const out = {};
      for (const b of T.Town.buildings) if (!b.def.com) out[b.id] = { beds: T.Town.bedroomsOf(b) };
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
        if (!b.def.com && out[b.key] === undefined) out[b.key] = T.Town.bedroomsOf(b);
      return out;
    },
  };

  const tryBuild = (records) => {
    T.Town.build(townSeed, null, records);
    const bad = T.Town.issues.filter((i) => i.sev === "bad").map((i) => `${i.id} ${i.msg}`);
    const bedsById = {};
    for (const b of T.Town.buildings) if (b.growth) bedsById[b.id] = T.Town.bedroomsOf(b);
    return { ok: bad.length === 0, errors: bad, bedsById };
  };

  const out = ASH.bootWorld({ storage: store, seed: row.seed, townSeed,
                              nowMs, genesisMs, adapter, tryBuild });
  const after = JSON.parse(store.getItem(STORAGE_KEY));
  const day = after.simSnapshot.state.day;
  const digest = after.simSnapshot.digest;

  const counted = {};
  for (const e of out.events) counted[e.type] = (counted[e.type] || 0) + 1;
  console.log(`  stepped ${out.days} day(s) -> day ${day}`);
  console.log(`  digest  ${digest}`);
  console.log(`  people  ${Object.keys(after.simSnapshot.state.people).length}` +
              `   grown buildings ${after.records.length}   log entries ${after.log.length}`);
  const interesting = Object.entries(counted)
    .filter(([k]) => !["day", "tick"].includes(k))
    .sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (interesting.length) {
    console.log("  events:");
    for (const [k, n] of interesting) console.log(`    ${String(n).padStart(4)}  ${k}`);
  }
  if (out.errors && out.errors.length) console.log("  errors:", out.errors.join("; "));

  /* --emit <file>: write the commit payload instead of sending it. Lets the
     advance be applied through any SQL channel when no service key is present. */
  const emitAt = process.argv.indexOf("--emit");
  if (emitAt !== -1 && process.argv[emitAt + 1]) {
    const payload = { p_from_digest: row.digest, p_day: day, p_digest: digest,
                      p_records: after.records, p_log: after.log,
                      p_sim_snapshot: after.simSnapshot, p_founding: after.founding };
    fs.writeFileSync(process.argv[emitAt + 1], JSON.stringify(payload));
    console.log(`\n  payload written to ${process.argv[emitAt + 1]} ` +
                `(${(JSON.stringify(payload).length / 1024).toFixed(1)} KB)\n`);
    return;
  }

  if (DRY) {
    console.log(`\n  would call world3_advance_day(from_digest=${JSON.stringify(row.digest)}, ` +
                `day=${day}, digest=${digest}, records=${after.records.length}, ` +
                `log=${after.log.length}, founding=${after.founding.length})`);
    console.log("  nothing written.\n");
    return;
  }
  const res = await commit(row.digest, after, day, digest);
  console.log(`\n  commit: ${JSON.stringify(res)}\n`);
  if (res && res.status !== "advanced") process.exitCode = 1;
})().catch((e) => { console.error("advance failed:", e.message); process.exit(1); });
