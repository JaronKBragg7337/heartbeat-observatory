#!/usr/bin/env node
/* ============================================================================
   tools/ambient.js — visible life, verified headlessly
   ---------------------------------------------------------------------------
   The layer under test: street graph (world/streets.js), daily itineraries
   and poses (sim/ambient.js), pets (sim/pets.js), and the finished role-swap
   (sim/engine.js) — all plain data, all deterministic, all measured against
   the REAL town built in the same stub-device sandbox as tools/baseline.js.

       node tools/ambient.js       exit 0 if every check holds

   This harness does not replace slice.js or baseline.js; it leaves their
   contracts untouched and proves only the new, additive surface.
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

/* ---- the sandbox (same stub device as tools/baseline.js / slice.js) ------ */
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

/* ---- assertions ---------------------------------------------------------- */
let failures = 0;
function check(name, cond, detail) {
  console.log(`  ${cond ? "ok  " : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
  if (!cond) failures++;
}
const dist = (ax, az, bx, bz) => Math.hypot(bx - ax, bz - az);

/* ---- build the real town, and the plain-data view the adapter would give - */
const T = bootTown();
T.Town.build(TOWN_SEED);

const anchors = {}, kinds = {};
for (const b of T.Town.buildings) {
  anchors[b.id] = ASH.doorAnchor({ def: b.def, lot: b.lot, wx: b.wx, wz: b.wz, yaw: b.yaw });
  kinds[b.id] = { com: !!b.def.com, key: b.key };
}
const parkBlock = T.Town.blocks.find((bl) => bl.kind === "park");
anchors.PARK = { x: parkBlock.center[0], z: parkBlock.center[1], face: "park" };
const worldView = { anchors, kinds, graph: ASH.streetGraph() };

function foundSim() {
  const homes = {};
  for (const b of T.Town.buildings)
    if (!b.def.com) homes[b.id] = { beds: T.Town.bedroomsOf(b) };
  const barn = T.Town.buildings.find((b) => b.key === "barn");
  const businessAddress = (barn || T.Town.buildings.find((b) => b.def.com)).id;
  /* D14: the utilities' real addresses, measured by building key */
  const byKey = (key) => {
    const b = T.Town.buildings.find((b) => b.key === key && !b.growth);
    return b ? b.id : null;
  };
  return ASH.AshgroveSim.create({
    seed: SIM_SEED, homes, houseIds: Object.keys(homes), businessAddress,
    utilityAddresses: { store: byKey("store"), diner: byKey("diner"), townHall: byKey("townHall") },
  });
}

console.log("\nASHGROVE AMBIENT LIFE — streets, itineraries, pets, role-swap\n");

/* ---- 1. street constants match the town builder's source ----------------- */
console.log("1. street constants are the town's own:");
{
  const src = fs.readFileSync(path.join(ROOT, "render", "town.js"), "utf8");
  const constValue = (name) => {
    const m = src.match(new RegExp(`^const ${name}\\s*=\\s*([^;]+);`, "m"));
    if (!m) throw new Error(`const ${name} not found in render/town.js`);
    return eval(`(${m[1]})`);
  };
  for (const name of ["ROADS_X", "ROADS_Z", "ROAD_HALF", "WALK_OUT"])
    check(`${name} matches render/town.js`,
          JSON.stringify(constValue(name)) === JSON.stringify(ASH[name]),
          JSON.stringify(ASH[name]));

  /* and the door math agrees with the real buildings, not just with itself */
  let worst = 0;
  for (const b of T.Town.buildings) {
    const lz = b.def.porch ? -(b.def.porch.depth || 2.2) - 0.4 : -1.4;
    const d = dist(anchors[b.id].x, anchors[b.id].z,
                   b.tx(b.def.w / 2, lz), b.tz(b.def.w / 2, lz));
    if (d > worst) worst = d;
  }
  check("doorAnchor reproduces every building's real door position", worst < 0.01,
        `worst divergence ${worst.toFixed(4)} m over ${T.Town.buildings.length} buildings`);
}

/* ---- 2. graph sanity ----------------------------------------------------- */
console.log("2. street graph sanity:");
{
  const g = worldView.graph;
  const degree = {};
  for (const e of g.edges) { degree[e.a] = (degree[e.a] || 0) + 1; degree[e.b] = (degree[e.b] || 0) + 1; }
  const junctionNodes = g.nodes.filter((n) => !n.id.includes("@T"));
  const badDegree = junctionNodes.filter((n) => (degree[n.id] || 0) !== 4);
  check("every junction node has 4 lane connections", badDegree.length === 0,
        `${junctionNodes.length} junction nodes, ${badDegree.length} bad`);

  const byId = {};
  for (const n of g.nodes) byId[n.id] = n;
  const lo = ASH.ROAD_HALF + 0.5 - 1e-9, hi = ASH.WALK_OUT - 0.4 + 1e-9;
  let offBand = 0;
  for (const lane of g.lanes)
    for (const id of lane.nodes) {
      const n = byId[id];
      const off = lane.axis === "z" ? Math.abs(n.x - lane.road) : Math.abs(n.z - lane.road);
      if (off < lo || off > hi) offBand++;
    }
  check(`lane coordinates within the footway band (${lo.toFixed(1)}..${hi.toFixed(1)} m)`,
        offBand === 0, `${g.lanes.length} lanes, ${offBand} nodes off-band`);
}

/* ---- 3. founding: everyone gets a plan, and plans are anchored ----------- */
console.log("3. founding itineraries:");
const sim = foundSim();
const DAY0 = sim.state.day;
const amb = ASH.planDay(sim.state, worldView, DAY0);
let legTotal = 0;
{
  const people = Object.values(sim.state.people).filter((p) => p.alive);
  check("every founding person gets a plan",
        Object.keys(amb.plans).length === people.length,
        `${Object.keys(amb.plans).length}/${people.length}`);

  let startBad = 0, endBad = 0, chainBad = 0, legless = 0;
  for (const p of people) {
    const plan = amb.plans[p.id];
    if (!plan || !plan.legs.length) { legless++; continue; }
    legTotal += plan.legs.length;
    const home = anchors[p.homeId];
    const first = plan.legs[0].path[0];
    if (dist(first[0], first[1], home.x, home.z) > 0.5) startBad++;
    for (let i = 0; i < plan.legs.length; i++) {
      const leg = plan.legs[i];
      const end = leg.path[leg.path.length - 1];
      const dest = anchors[leg.to];
      const tol = leg.to === "PARK" ? 6 : 0.5;
      if (!dest || dist(end[0], end[1], dest.x, dest.z) > tol) endBad++;
      if (i + 1 < plan.legs.length) {
        const next = plan.legs[i + 1].path[0];
        if (dist(end[0], end[1], next[0], next[1]) > 0.5) chainBad++;
      }
    }
  }
  check("every plan has at least one leg", legless === 0, `${legTotal} legs total`);
  check("every first leg starts at the home door anchor (≤0.5 m)", startBad === 0);
  check("every leg ends at its destination anchor (≤0.5 m, park ≤6 m)", endBad === 0);
  check("legs chain door-to-door (≤0.5 m)", chainBad === 0);
}

/* ---- 4. paths never cross a building ------------------------------------- */
console.log("4. paths stay out of buildings:");
{
  const feet = T.Town.buildings.map((b) => b.foot);
  let violations = 0, worstDesc = "";
  for (const pid of Object.keys(amb.plans))
    for (const leg of amb.plans[pid].legs) {
      const L = ASH.pathLength(leg.path);
      for (let d = 0; d <= L; d += 0.5) {
        if (d < 1.5 || L - d < 1.5) continue;      // the door stubs are yards
        const p = ASH.pathPointAt(leg.path, d);
        for (const f of feet)
          if (p.x > f[0] - 0.1 && p.x < f[3] + 0.1 && p.z > f[2] - 0.1 && p.z < f[5] + 0.1) {
            violations++;
            if (!worstDesc) worstDesc = `${pid} ${leg.kind}→${leg.to} at ${p.x.toFixed(1)},${p.z.toFixed(1)}`;
          }
      }
    }
  check("no sampled path point enters any building footprint (+0.1 m)", violations === 0,
        worstDesc || "0 violations");
}

/* ---- 5. determinism ------------------------------------------------------ */
console.log("5. determinism:");
{
  const d1 = ASH.ambientDigest(ASH.planDay(sim.state, worldView, DAY0));
  const d2 = ASH.ambientDigest(ASH.planDay(sim.state, worldView, DAY0));
  check("planDay twice gives the same ambient digest", d1 === d2, d1);
  const simB = foundSim();
  const d3 = ASH.ambientDigest(ASH.planDay(simB.state, worldView, simB.state.day));
  check("a fresh sim founded the same way plans identically", d1 === d3, d3);
}

/* ---- 6. pets ------------------------------------------------------------- */
console.log("6. pets:");
const petPlans = Object.values(amb.pets);
{
  let det = true;
  for (const hh of Object.values(sim.state.households)) {
    const a = JSON.stringify(ASH.petFor(sim.state.seed, hh.id));
    const b = JSON.stringify(ASH.petFor(sim.state.seed, hh.id));
    if (a !== b) det = false;
  }
  check("petFor is deterministic across calls", det,
        `${petPlans.length} pet(s) across ${Object.keys(sim.state.households).length} households`);

  let yardBad = 0, followBad = 0, samples = 0;
  for (const pet of petPlans) {
    const ownerPlan = pet.follows ? amb.plans[pet.follows] : null;
    for (let t = 0; t < ASH.TOWN_MINUTES_PER_DAY; t += 10) {
      samples++;
      const ownerPose = ownerPlan ? ASH.poseAt(ownerPlan, t) : null;
      const pose = ASH.petPoseAt(pet, ownerPose, t);
      if (pose.mode === "yard") {
        if (dist(pose.x, pose.z, pet.home.x, pet.home.z) > 8) yardBad++;
      } else if (ownerPose) {
        if (dist(pose.x, pose.z, ownerPose.x, ownerPose.z) > 6) followBad++;
      }
    }
  }
  check("yard-wander loops stay within 8 m of the home anchor", yardBad === 0,
        `${samples} samples`);
  check("following pets stay within 6 m of the owner's pose", followBad === 0);

  /* the "pets walk through walls" regression: with no owner pose the pet holds
     its yard loop, and every yard pose must clear every building footprint.
     The old facade-line centre with a 3 m radius failed this outright. */
  const feet = T.Town.buildings.map((b) => b.foot);
  let clipBad = 0, clipSamples = 0;
  for (const pet of petPlans) {
    for (let t = 0; t < ASH.TOWN_MINUTES_PER_DAY; t += 2) {
      const pose = ASH.petPoseAt(pet, null, t);
      if (pose.mode !== "yard") continue;
      clipSamples++;
      for (const f of feet)
        if (pose.x > f[0] - 0.1 && pose.x < f[3] + 0.1 &&
            pose.z > f[2] - 0.1 && pose.z < f[5] + 0.1) { clipBad++; break; }
    }
  }
  check("yard-wander loops never cross a building footprint", clipBad === 0,
        `${clipBad}/${clipSamples} yard poses inside a footprint`);
}

/* ---- 7. role-swap, scripted ---------------------------------------------- */
console.log("7. role-swap:");
{
  const s = foundSim();
  s.advanceDay();                                   // day 1: hiring fills all seats
  const bizId = Object.keys(s.state.businesses)[0];
  const biz = s.state.businesses[bizId];
  check("all builder seats start NPC-held",
        biz.seats.every((st) => st.occupantId && s.state.people[st.occupantId]),
        biz.seats.map((st) => st.occupantId).join(" / "));

  const seq0 = s.state.eventSeq;
  const displacedId = biz.seats[0].occupantId;
  s.ensurePlayer();
  s.playerTakeSeat(bizId);
  check("playerTakeSeat displaces the NPC and records them",
        biz.seats[0].occupantId === "person:player" &&
        biz.seats[0].displacedId === displacedId &&
        s.state.people[displacedId].seatId === null,
        `${s.state.people[displacedId].name} displaced`);
  let threw = false;
  try { s.playerTakeSeat(bizId); } catch (e) { threw = true; }
  check("taking a second seat throws (leave first)", threw);

  s.playerWorkShift();
  const hhId = Object.keys(s.state.households)[0];
  s.startConstruction({ id: "B90", key: "cottage", lot: { block: "0,0", index: 0 } }, hhId, 100000);
  const labor0 = s.state.counters.laborWorked;
  s.advanceDay();                                   // day 2: the player worked
  const npcSeats = biz.seats.filter((st) => st.occupantId && s.state.people[st.occupantId]).length;
  const gained = s.state.counters.laborWorked - labor0;
  check("the player's labor poured like a worker's (one share, once)",
        gained === (npcSeats + 1) * ASH.LABOR_PER_WORKER_DAY,
        `+${gained} labor (${npcSeats} NPC seat(s) + the player)`);

  s.advanceDay();                                   // day 3
  s.advanceDay();                                   // day 4 — still within grace
  check("three silent days: the seat is still the player's",
        s.state.player.seatId === biz.seats[0].id && biz.seats[0].occupantId === "person:player");
  s.advanceDay();                                   // day 5 — over the line
  check("day four silent: the NPC reclaimed the seat, the player is seatless",
        s.state.player.seatId === null && biz.seats[0].occupantId === displacedId,
        biz.seats[0].occupantId);

  const types = s.eventsSince(seq0).map((e) => e.type);
  check("seat-taken and seat-reclaimed were both emitted",
        types.includes("seat-taken") && types.includes("seat-reclaimed"),
        types.filter((t) => t.startsWith("seat-") || t === "shift-worked").join(", "));

  const snap = s.snapshot();
  const back = ASH.AshgroveSim.restore(snap);
  check("snapshot/restore round-trips the player state, digest verified",
        back.snapshot().digest === snap.digest &&
        JSON.stringify(back.state.player) === JSON.stringify(s.state.player),
        snap.digest);
}

/* ---- 8. totals ------------------------------------------------------------ */
const routeCount = legTotal;
console.log("\n8. totals:");
console.log(`  ${Object.keys(amb.plans).length} people planned, ${legTotal} legs, ` +
            `${petPlans.length} pets, ${routeCount} street routes`);
console.log(`\n  ${failures ? failures + " AMBIENT CHECK(S) FAILED"
                              : "visible life holds: streets, plans, pets, role-swap"}\n`);
process.exit(failures ? 1 : 0);
