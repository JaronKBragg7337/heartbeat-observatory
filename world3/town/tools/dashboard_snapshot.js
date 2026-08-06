#!/usr/bin/env node
/* ============================================================================
   tools/dashboard_snapshot.js — one JSON snapshot of the living town
   ---------------------------------------------------------------------------
   Founds the world EXACTLY the way tools/slice.js does — same stub-device
   sandbox, same adapter/tryBuild composition, same seeds, same bootWorld
   catch-up — advances it to day 400, and prints ONE JSON object to stdout
   for an external dashboard:

     node tools/dashboard_snapshot.js          stdout: a single JSON object
     node tools/dashboard_snapshot.js | jq .   pretty-print it

   stdout carries the JSON and nothing else; anything diagnostic belongs on
   stderr. netPerDay is staffed production minus consumption, computed the
   same way engine step 8 (sim/resources.js 8.1–8.3) computes it: production
   from occupied utility seats held by NPCs, plus a player-held seat inside
   the same show-up gate, minus ASH.consumptionFor(state).
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

/* ---- the render sandbox (same stub device as tools/slice.js) ------------- */
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
const T0 = Date.UTC(2026, 7, 4, 12, 0, 0);
const DAYS = 400;

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

function main() {
  const T = bootTown();
  T.Town.build(TOWN_SEED);
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

  /* the slice's exact boot: genesis, then a 400-day catch-up load */
  ASH.bootWorld({ storage: store, seed: SIM_SEED, townSeed: TOWN_SEED, nowMs: T0,
                  adapter, tryBuild });
  const outcome = ASH.bootWorld({ storage: store, seed: SIM_SEED, townSeed: TOWN_SEED,
                                  nowMs: T0 + DAYS * DAY, adapter, tryBuild });
  tryBuild(outcome.records);                      // leave the grown town standing

  const doc = JSON.parse(storage.get("ashgrove-world-v1"));
  const st = doc.simSnapshot.state;

  /* net/day, engine step 8's way: staffed production − consumption */
  const R = ASH.RESOURCE;
  const prod = { food: 0, water: 0, energy: 0 };
  for (const biz of Object.values(st.businesses))
    for (const seat of biz.seats) {
      const res = R.ROLE_RESOURCE[seat.role];
      if (!res || !seat.occupantId || !st.people[seat.occupantId]) continue;
      prod[res] += R.PRODUCE[seat.role];
    }
  if (st.player && st.player.seatId && st.day - st.player.lastWorkDay <= 1) {
    const biz = st.businesses[st.player.employerId];
    const seat = biz && biz.seats.find((s) => s.id === st.player.seatId);
    const res = seat && R.ROLE_RESOURCE[seat.role];
    if (res) prod[res] += R.PRODUCE[seat.role];
  }
  const cons = ASH.consumptionFor(st);

  const seats = [];
  for (const biz of Object.values(st.businesses))
    for (const seat of biz.seats) {
      const holder = seat.occupantId
        ? (st.people[seat.occupantId] ? st.people[seat.occupantId].name : "you")
        : null;
      seats.push({ business: biz.name, role: seat.role, filled: !!seat.occupantId, holderName: holder });
    }

  const out = {
    schema: 1,
    day: st.day,
    people: Object.values(st.people).filter((p) => p.alive).length,
    households: Object.keys(st.households).length,
    buildings: T.Town.buildings.length,
    grownBuildings: outcome.records.length,
    stocks: { food: st.stocks.food, water: st.stocks.water, energy: st.stocks.energy },
    hardship: { food: st.hardship.food, water: st.hardship.water, energy: st.hardship.energy },
    netPerDay: { food: prod.food - cons.food, water: prod.water - cons.water, energy: prod.energy - cons.energy },
    seats,
    recentEvents: st.events.slice(-12).map((e) => ({ day: e.day, type: e.type, text: e.msg })),
    digest: doc.simSnapshot.digest,
  };
  process.stdout.write(JSON.stringify(out) + "\n");
}

try { main(); }
catch (e) { console.error("dashboard snapshot failed: " + e.stack); process.exit(2); }
