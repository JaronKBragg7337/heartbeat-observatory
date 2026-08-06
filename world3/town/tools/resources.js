#!/usr/bin/env node
/* ============================================================================
   tools/resources.js — town resources (D14), verified headlessly
   ---------------------------------------------------------------------------
   The layer under test: sim/resources.js and its integration into the engine
   — founding stocks, the three utility businesses, day-pipeline step 8
   (production → consumption → shortfall), the conception gate, and
   snapshot/restore of the new state. Measured against the REAL town built in
   the same stub-device sandbox as tools/ambient.js.

       node tools/resources.js     exit 0 if every check holds

   The founding town, fully staffed, is engineered to be surplus on all three
   resources (food +1, water +4, energy 0 net/day) — that is what keeps the
   vertical slice's growth chain firing under the conception gate (D14).
   ========================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");

/* sim/ and world/ attach to globalThis.ASH — load them in dependency order */
for (const f of ["sim/rng.js", "sim/canonical.js", "sim/clock.js", "sim/ids.js",
                 "sim/organisms.js", "sim/people.js", "sim/jobs.js", "sim/demand.js",
                 "sim/resources.js", "sim/pets.js", "sim/ambient.js", "sim/engine.js",
                 "world/registry.js", "world/growth.js", "world/bootstrap.js",
                 "world/streets.js"])
  require(path.join(ROOT, f));
const ASH = globalThis.ASH;

/* ---- the sandbox (same stub device as tools/ambient.js) ------------------- */
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
const CHILD_AGE = 5 * 365, ADULT_AGE = 25 * 365;

/* ---- assertions ----------------------------------------------------------- */
let failures = 0;
function check(name, cond, detail) {
  console.log(`  ${cond ? "ok  " : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
  if (!cond) failures++;
}

/* ---- the real town, and the sim-founding call the adapters make ----------- */
const T = bootTown();
T.Town.build(TOWN_SEED);

function foundSim() {
  const homes = {};
  for (const b of T.Town.buildings)
    if (!b.def.com) homes[b.id] = { beds: T.Town.bedroomsOf(b) };
  const barn = T.Town.buildings.find((b) => b.key === "barn");
  const businessAddress = (barn || T.Town.buildings.find((b) => b.def.com)).id;
  const byKey = (key) => {
    const b = T.Town.buildings.find((b) => b.key === key && !b.growth);
    return b ? b.id : null;
  };
  return ASH.AshgroveSim.create({
    seed: SIM_SEED, homes, houseIds: Object.keys(homes), businessAddress,
    utilityAddresses: { store: byKey("store"), diner: byKey("diner"), townHall: byKey("townHall") },
  });
}

const bizByName = (st, name) => Object.values(st.businesses).find((b) => b.name === name);
const roleOut = (role) => ASH.RESOURCE.PRODUCE[role];

/* production a town SHOULD have, computed from actual seat occupancy — the
   harness never assumes who sits where, it reads the seats */
function staffedProduction(st) {
  const out = { food: 0, water: 0, energy: 0 };
  for (const biz of Object.values(st.businesses))
    for (const seat of biz.seats) {
      const res = ASH.RESOURCE.ROLE_RESOURCE[seat.role];
      if (res && seat.occupantId && st.people[seat.occupantId]) out[res] += roleOut(seat.role);
    }
  return out;
}

console.log("\nASHGROVE RESOURCES — food, water, energy (D14)\n");

/* ---- 1. founding ------------------------------------------------------------ */
console.log("1. founding:");
{
  const sim = foundSim();
  const st = sim.state;
  check("stocks start at the D14 constants",
        st.stocks.food === 30 && st.stocks.water === 30 && st.stocks.energy === 20,
        JSON.stringify(st.stocks));
  check("hardship starts at zero on all three",
        st.hardship.food === 0 && st.hardship.water === 0 && st.hardship.energy === 0);

  const byKey = (key) => T.Town.buildings.find((b) => b.key === key && !b.growth).id;
  const store = bizByName(st, "Ashgrove General Store");
  const diner = bizByName(st, "The Ashgrove Diner");
  const wl = bizByName(st, "Ashgrove Water & Light");
  check("the three utilities exist",
        !!store && !!diner && !!wl,
        Object.values(st.businesses).map((b) => b.name).join(" | "));
  check("store sits at the store building with two grocer seats",
        store && store.address === byKey("store") &&
        store.seats.map((s) => s.role).join(",") === "grocer,grocer",
        store && `${store.address} [${store.seats.map((s) => s.role)}]`);
  check("diner sits at the diner building with one cook seat",
        diner && diner.address === byKey("diner") &&
        diner.seats.map((s) => s.role).join(",") === "cook",
        diner && `${diner.address} [${diner.seats.map((s) => s.role)}]`);
  check("water & light sits at the town hall with waterkeeper×2 + lineman",
        wl && wl.address === byKey("townHall") &&
        wl.seats.map((s) => s.role).join(",") === "waterkeeper,waterkeeper,lineman",
        wl && `${wl.address} [${wl.seats.map((s) => s.role)}]`);
  check("utilities are founded AFTER the builders (builder seat ids unchanged)",
        bizByName(st, "Ashgrove Builders").seats[0].id === "seat:000001" &&
        store && store.seats[0].id === "seat:000004",
        `builders ${bizByName(st, "Ashgrove Builders").seats.map((s) => s.id)} · store from ${store && store.seats[0].id}`);
  check("a founded-style event was emitted for the utilities",
        st.events.some((e) => e.type === "founded" && e.data.utilityIds &&
                              e.data.utilityIds.length === 3));

  const simB = foundSim();
  check("two independent founds: identical businesses and ids",
        JSON.stringify(simB.state.businesses) === JSON.stringify(st.businesses));
  check("two independent founds: identical snapshot digest",
        simB.snapshot().digest === sim.snapshot().digest, sim.snapshot().digest);
}

/* ---- 2. unfilled seats: exact drain, shortages, hardship -------------------- */
console.log("2. unfilled utility seats drain the town at exactly the consumption rates:");
{
  const sim = foundSim();
  const st = sim.state;
  /* a town that cannot work: everyone is a child, no pregnancy on the way.
     Hiring (step 2c) then never fires, so every seat but the founding
     builder's stays vacant and step 8 is pure consumption. */
  for (const p of Object.values(st.people)) p.ageDays = CHILD_AGE;
  for (const k of Object.keys(st.pregnancies)) delete st.pregnancies[k];

  const want = ASH.consumptionFor(st);           // food 12 · water 12 · energy 10
  check("consumption counted from live state: 12 food, 12 water, 10 energy",
        want.food === 12 && want.water === 12 && want.energy === 10,
        JSON.stringify(want));

  const traj = [], hard = [];
  for (let d = 0; d < 5; d++) {
    sim.advanceDay();
    traj.push(ASH.cloneState(st.stocks));
    hard.push(ASH.cloneState(st.hardship));
  }
  check("day 1: 18/18/10 — drained exactly 12/12/10",
        traj[0].food === 18 && traj[0].water === 18 && traj[0].energy === 10,
        JSON.stringify(traj[0]));
  check("day 2: 6/6/0 — energy at exactly 0 is still MET (no shortage on day ≤ 2)",
        traj[1].food === 6 && traj[1].water === 6 && traj[1].energy === 0 &&
        st.events.filter((e) => e.type === "shortage" && e.day <= 2).length === 0);
  check("day 3: all three clamp at 0 and shortage fires for each",
        traj[2].food === 0 && traj[2].water === 0 && traj[2].energy === 0 &&
        st.events.filter((e) => e.type === "shortage" && e.day === 3).length === 3,
        st.events.filter((e) => e.type === "shortage").map((e) => `${e.data.resource}@d${e.day}`).join(", "));
  check("hardship counts consecutive shortfall days: 1 on day 3, 2 on day 4",
        hard[2].food === 1 && hard[2].water === 1 && hard[2].energy === 1 &&
        hard[3].food === 2 && hard[3].water === 2 && hard[3].energy === 2,
        `day 3 ${JSON.stringify(hard[2])} · day 4 ${JSON.stringify(hard[3])}`);

  /* a town that CAN work again: grown-ups arrive, hiring staffs the seats,
     production meets consumption, hardship resets the same day */
  for (const p of Object.values(st.people)) p.ageDays = ADULT_AGE;
  sim.advanceDay();                                 // day 5
  check("staffed again: hardship resets to 0/0/0 the day consumption is met",
        st.hardship.food === 0 && st.hardship.water === 0 && st.hardship.energy === 0,
        JSON.stringify(st.hardship));
  check("staffed again: stocks recover by production − consumption",
        st.stocks.food === 1 && st.stocks.water === 4 && st.stocks.energy === 0,
        JSON.stringify(st.stocks));
}

/* ---- 3. staffed town: who sits where, exact production, surplus ------------- */
console.log("3. a fully hired town is surplus on all three:");
{
  const sim = foundSim();
  const st = sim.state;
  sim.advanceDay();                                 // day 1: hiring runs
  const seatMap = [];
  for (const biz of Object.values(st.businesses))
    for (const seat of biz.seats) seatMap.push(`${seat.id}:${seat.role}→${seat.occupantId || "vacant"}`);
  /* 12 founding adults, 9 seats. Hiring iterates businesses in founding order
     and people in id order: builders fill first, then grocer, grocer, cook,
     waterkeeper, waterkeeper, lineman. Pin the exact map so a change in
     hiring order fails loudly here, not silently in production numbers. */
  const expect = [
    "seat:000001:builder→person:000003",   // the founding hire
    "seat:000002:builder→person:000001",
    "seat:000003:builder→person:000002",
    "seat:000004:grocer→person:000004",
    "seat:000005:grocer→person:000005",
    "seat:000006:cook→person:000006",
    "seat:000007:waterkeeper→person:000007",
    "seat:000008:waterkeeper→person:000008",
    "seat:000009:lineman→person:000009",
  ];
  check("all 9 seats filled, in deterministic hiring order",
        JSON.stringify(seatMap) === JSON.stringify(expect),
        seatMap.join("  "));
  check("3 adults remain idle (12 people, 9 seats)",
        ["person:000010", "person:000011", "person:000012"]
          .every((id) => !st.people[id].seatId));

  const prod = staffedProduction(st);
  check("staffed production is food 13 · water 16 · energy 10",
        prod.food === 13 && prod.water === 16 && prod.energy === 10,
        JSON.stringify(prod));
  const cons = ASH.consumptionFor(st);
  check("net/day ≥ 0 on all three (food +1, water +4, energy 0)",
        prod.food - cons.food >= 0 && prod.water - cons.water >= 0 && prod.energy - cons.energy >= 0,
        `net +${prod.food - cons.food}/+${prod.water - cons.water}/+${prod.energy - cons.energy}`);

  /* days 1–5: before any birth can land (the founding pregnancy is due
     day 8+), consumption is flat — every day's stock delta must equal
     production − consumption exactly */
  let exact = true;
  for (let d = 0; d < 4; d++) {
    const before = ASH.cloneState(st.stocks);
    sim.advanceDay();
    for (const r of ["food", "water", "energy"])
      if (st.stocks[r] - before[r] !== prod[r] - cons[r]) exact = false;
  }
  check("four straight days: stock delta == staffed production − consumption",
        exact, `day 5 stocks ${JSON.stringify(st.stocks)}`);
  check("counters track honest totals for the UI",
        st.counters.foodProduced === 13 * 5 && st.counters.foodConsumed === 12 * 5 &&
        st.counters.energyProduced === 10 * 5 && st.counters.energyConsumed === 10 * 5,
        `food ${st.counters.foodProduced}/${st.counters.foodConsumed} · energy ${st.counters.energyProduced}/${st.counters.energyConsumed}`);
}

/* ---- 4. the player works a utility seat ------------------------------------- */
console.log("4. player production — show up or the seat produces nothing:");
{
  const sim = foundSim();
  const st = sim.state;
  sim.advanceDay();                                 // day 1: hiring
  const store = bizByName(st, "Ashgrove General Store");
  const displacedId = store.seats[0].occupantId;    // person:000004, grocer
  sim.ensurePlayer();
  sim.playerTakeSeat(store.id);
  sim.playerWorkShift();                            // day 1: the player showed up

  /* the honest A/B: a WORKED day vs a SILENT day inside one sim. (A separate
     unworked-control sim is no control at all: taking the seat sets
     lastWorkDay, so the show-up gate still passes on the very next day.) */
  const s1 = ASH.cloneState(st.stocks);
  sim.advanceDay();                                 // day 2: gate 1 — player produces
  const workedDelta = st.stocks.food - s1.food;
  sim.advanceDay();                                 // day 3: gate 2 — silent, no output
  const silentDelta = st.stocks.food - (s1.food + workedDelta);
  check("the worked day produced exactly one grocer share more than the silent day",
        workedDelta - silentDelta === ASH.RESOURCE.PRODUCE.grocer,
        `worked ${workedDelta >= 0 ? "+" : ""}${workedDelta} · silent ${silentDelta >= 0 ? "+" : ""}${silentDelta} · diff ${workedDelta - silentDelta}`);
  check("the displaced grocer does not produce while the player holds the seat",
        st.people[displacedId].seatId === null && silentDelta === 8 - 12,
        `silent-day food delta ${silentDelta} (8 produced − 12 consumed)`);

  sim.advanceDay();                                 // day 4
  sim.advanceDay();                                 // day 5: four silent days — reclaim
  check("four silent days: the displaced grocer reclaimed the seat",
        st.player.seatId === null && store.seats[0].occupantId === displacedId,
        store.seats[0].occupantId);
  check("and the seat produces again (food back to +1/day)",
        st.events.some((e) => e.type === "seat-reclaimed") &&
        st.stocks.food - (s1.food + workedDelta + silentDelta + silentDelta) === 1,
        `day 5 food ${st.stocks.food}`);
}

/* ---- 5. the conception gate ------------------------------------------------- */
console.log("5. a hungry town does not grow:");
{
  const sim = foundSim();
  const st = sim.state;
  /* four adults (two couples, so conception is genuinely possible) and eight
     children; nobody expecting. Hiring staffs only 4 of 9 seats, food and
     water fall short within days, and stay short — nobody is left to hire. */
  const adultIds = ["person:000003", "person:000004", "person:000005", "person:000006"];
  for (const p of Object.values(st.people))
    p.ageDays = adultIds.includes(p.id) ? ADULT_AGE : CHILD_AGE;
  for (const k of Object.keys(st.pregnancies)) delete st.pregnancies[k];

  const hardshipByDay = {};
  for (let d = 0; d < 40; d++) {
    sim.advanceDay();
    hardshipByDay[st.day] = ASH.cloneState(st.hardship);
  }
  check("hardship arrived and never left (seats stay unfilled)",
        hardshipByDay[40].food > 0 && hardshipByDay[40].water > 0 &&
        hardshipByDay[3].water > 0 && hardshipByDay[5].food > 0,
        `day 3 ${JSON.stringify(hardshipByDay[3])} · day 40 ${JSON.stringify(hardshipByDay[40])}`);
  const gatedOut = st.events.filter((e) => e.type === "conception" &&
    (hardshipByDay[e.day].food > 0 || hardshipByDay[e.day].water > 0));
  check("zero conceptions on any day with food or water hardship",
        gatedOut.length === 0,
        `${st.events.filter((e) => e.type === "conception").length} conception(s) total, all on fed days`);

  /* recovery: the children grow up, hiring fills every seat, hardship ends */
  for (const p of Object.values(st.people)) p.ageDays = Math.max(p.ageDays, ADULT_AGE);
  sim.advanceDay();                                 // day 41
  check("staffed again: hardship cleared on all three",
        st.hardship.food === 0 && st.hardship.water === 0 && st.hardship.energy === 0);
  const recoveredAt = st.day;
  for (let d = 0; d < 400; d++) sim.advanceDay();
  const after = st.events.filter((e) => e.type === "conception" && e.day > recoveredAt);
  check("conceptions resume once the town is fed",
        after.length >= 1, `${after.length} conception(s) in 400 fed days`);
}

/* ---- 6. snapshot/restore ----------------------------------------------------- */
console.log("6. snapshot/restore:");
{
  const sim = foundSim();
  for (let d = 0; d < 5; d++) sim.advanceDay();
  const snap = sim.snapshot();
  const back = ASH.AshgroveSim.restore(snap);
  check("stocks and hardship round-trip with a matching digest",
        back.snapshot().digest === snap.digest &&
        JSON.stringify(back.state.stocks) === JSON.stringify(sim.state.stocks) &&
        JSON.stringify(back.state.hardship) === JSON.stringify(sim.state.hardship),
        `${snap.digest} · stocks ${JSON.stringify(back.state.stocks)}`);
}

console.log(`\n  ${failures ? failures + " RESOURCE CHECK(S) FAILED"
                            : "resources hold: founding, drain, staffing, player, gate, snapshots"}\n`);
process.exit(failures ? 1 : 0);
