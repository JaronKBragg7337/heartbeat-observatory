/* pet-sim.test.mjs - ten simulated minutes of the pet's life, in plain node.
   Run: node lab/pet/test/pet-sim.test.mjs
   It feeds the pet, pokes it, leads it around with a pretend finger, lets it sleep, and checks the body never explodes,
   never NaNs, grows as it eats, and stays under the size cap. No three.js here: this is pet-core.js alone. */
import { PetSim, PALETTE, DEFAULTS, formatAge, bodyRadiusFor } from "../pet-core.js";

let pass = 0, fail = 0;
const ok = (cond, msg, extra = "") => { if (cond) { pass++; console.log(`  ok   ${msg}`); } else { fail++; console.log(`  FAIL ${msg} ${extra}`); } };
const finite = (v) => Number.isFinite(v);

function bodyStats(pet) {
  let maxV = 0, maxD = 0, minY = Infinity, nan = false;
  for (const c of pet.cells) {
    for (const k of ["x", "y", "z", "vx", "vy", "vz"]) if (!finite(c[k])) nan = true;
    maxV = Math.max(maxV, Math.hypot(c.vx, c.vy, c.vz));
    maxD = Math.max(maxD, Math.hypot(c.x - pet.center.x, c.y - pet.center.y, c.z - pet.center.z));
    minY = Math.min(minY, c.y);
  }
  return { maxV, maxD, minY, nan };
}

console.log("1. hatch");
const pet = new PetSim({ seed: 7, cells: 24, name: "Pip", colour: "mint" });
ok(pet.count === 24, "24 cells at hatch");
ok(pet.springs.length >= 24 * 2, `springs connect the body (${pet.springs.length})`);
ok(pet.R > 0.35 && pet.R < 0.7, `body radius sensible (${pet.R.toFixed(3)})`);
{
  // packed, not stacked: no two rest offsets sit on top of each other
  let minGap = Infinity;
  for (let i = 0; i < pet.count; i++) for (let j = i + 1; j < pet.count; j++) {
    const a = pet.cells[i], b = pet.cells[j];
    minGap = Math.min(minGap, Math.hypot(a.rx - b.rx, a.ry - b.ry, a.rz - b.rz) / (a.r + b.r));
  }
  ok(minGap > 0.45, `cells packed, overlapping a little (closest pair ${minGap.toFixed(2)} of a diameter)`);
}

console.log("2. it settles on the grass");
for (let i = 0; i < 240; i++) pet.step(1 / 60);
let s = bodyStats(pet);
ok(!s.nan, "no NaN after settling");
ok(s.maxV < 2, `calm after landing (max cell speed ${s.maxV.toFixed(2)})`);
ok(pet.center.y > 0.2 && pet.center.y < pet.R * 1.6, `sits on the ground (centre y ${pet.center.y.toFixed(2)}, R ${pet.R.toFixed(2)})`);
ok(s.minY > 0.05, `nothing sinks through the floor (min y ${s.minY.toFixed(3)})`);

console.log("3. it eats and grows");
const bites0 = pet.bites, cells0 = pet.count;
pet.hunger = 0.5;
let eatSteps = 0;
pet.dropFood(pet.center.x + 0.9, pet.center.z + 0.2);
ok(pet.foods.length === 1, "food dropped");
while (pet.foods.length && eatSteps < 60 * 20) { pet.step(1 / 60); eatSteps++; }
ok(pet.bites === bites0 + 1, `ate the berry in ${(eatSteps / 60).toFixed(1)} s`, `(bites ${pet.bites}, foods left ${pet.foods.length})`);
ok(pet.hunger > 0.5, `hunger went up (${pet.hunger.toFixed(2)})`);
for (let b = 0; b < 5; b++) {
  pet.dropFood(pet.center.x + (b % 2 ? 1 : -1) * 0.8, pet.center.z + 0.5);
  let n = 0; while (pet.foods.length && n < 60 * 20) { pet.step(1 / 60); n++; }
}
ok(pet.bites === bites0 + 6, `six bites (${pet.bites})`);
ok(pet.count === cells0 + 2, `grew one cell every ${DEFAULTS.growEvery} bites (${cells0} -> ${pet.count})`);
ok(pet.R > bodyRadiusFor(cells0, DEFAULTS.cellRadius) , "body radius grew");
ok(pet.drainEvents().filter((e) => e === "grow").length === 2, "two grow events reported");
s = bodyStats(pet);
ok(!s.nan && s.maxD < pet.R * 2.2, `body stayed together while growing (furthest cell ${s.maxD.toFixed(2)} vs R ${pet.R.toFixed(2)})`);

console.log("4. poke and follow");
pet.poke();
for (let i = 0; i < 90; i++) pet.step(1 / 60);
s = bodyStats(pet);
ok(!s.nan && s.maxV < 6, `poke wobble stays sane (max speed ${s.maxV.toFixed(2)})`);
const start = { x: pet.center.x, z: pet.center.z };
const goal = { x: start.x + 1.5, z: start.z - 1.0 };
for (let i = 0; i < 60 * 6; i++) { pet.follow(goal); pet.step(1 / 60); }
const dGoal = Math.hypot(goal.x - pet.center.x, goal.z - pet.center.z);
ok(dGoal < 1.0, `followed the finger (ended ${dGoal.toFixed(2)} from it, started ${Math.hypot(goal.x - start.x, goal.z - start.z).toFixed(2)} away)`);
pet.follow(null);
ok(pet.state !== "follow", "stops following when the finger lifts");

console.log("5. ten minutes of life (wander, nap, feed, poke, lead)");
let worstV = 0, worstD = 0, nanSeen = false, minYAll = Infinity, grows = 0, eats = 0, sleeps = 0, maxCellsSeen = 0, maxCenterR = 0;
const states = new Set();
const dt = 1 / 60, total = 10 * 60 * 60;
for (let i = 0; i < total; i++) {
  const t = i * dt;
  // a busy owner for the first half: a berry every 4 s, a poke every 23 s, a 5 s lead every 50 s
  if (t < 300 && i % (4 * 60) === 0) pet.dropFood((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4);
  if (t < 300 && i % (23 * 60) === 0) pet.poke();
  if (t < 300 && (i % (50 * 60)) < 5 * 60) pet.follow({ x: Math.sin(t) * 2, z: Math.cos(t * 0.7) * 2 }); else if (t < 300 && (i % (50 * 60)) === 5 * 60) pet.follow(null);
  // then a quiet night: nothing happens, it should nap
  pet.nightHint = t > 300 ? 1 : 0;
  pet.step(dt);
  states.add(pet.state);
  for (const e of pet.drainEvents()) { if (e === "grow") grows++; if (e === "eat") eats++; if (e === "sleep") sleeps++; }
  if (i % 10 === 0) {
    const st = bodyStats(pet);
    if (st.nan) nanSeen = true;
    worstV = Math.max(worstV, st.maxV); worstD = Math.max(worstD, st.maxD / pet.R); minYAll = Math.min(minYAll, st.minY);
    maxCellsSeen = Math.max(maxCellsSeen, pet.count);
    maxCenterR = Math.max(maxCenterR, Math.hypot(pet.center.x, pet.center.z));
    if (!finite(pet.hunger) || pet.hunger < 0 || pet.hunger > 1) nanSeen = true;
  }
}
ok(!nanSeen, "no NaN in ten minutes");
ok(worstV < DEFAULTS.maxSpeed + 0.01, `no cell ever exceeded the speed cap (worst ${worstV.toFixed(2)})`);
ok(worstD < 2.0, `no cell ever flew off the body (worst ${worstD.toFixed(2)} radii from centre)`);
ok(minYAll > 0.03, `never fell through the ground (min y ${minYAll.toFixed(3)})`);
ok(eats > 20, `ate a lot (${eats} berries)`);
ok(grows === Math.floor((pet.bites) / DEFAULTS.growEvery) - Math.floor((bites0 + 6 + 0) / DEFAULTS.growEvery) || grows > 5, `grew as it ate (${grows} new cells, ${pet.count} total)`);
ok(pet.count <= DEFAULTS.maxCells && maxCellsSeen <= DEFAULTS.maxCells, `under the size cap (${pet.count} <= ${DEFAULTS.maxCells})`);
ok(maxCenterR < DEFAULTS.worldRadius + 0.6, `stayed on the patch (furthest ${maxCenterR.toFixed(2)})`);
ok(sleeps >= 1 && states.has("sleep"), `napped during the quiet night (${sleeps} naps)`);
ok(states.has("wander") && states.has("idle") && states.has("eat"), `used its states: ${[...states].join(", ")}`);
ok(pet.hunger >= 0 && pet.hunger <= 1, `hunger in range (${pet.hunger.toFixed(2)})`);

console.log("6. the size cap");
const big = new PetSim({ seed: 3, cells: 30 });
for (let i = 0; i < 120; i++) big.step(1 / 60);
for (let k = 0; k < 400 && !big.full; k++) big.grow();
ok(big.count === DEFAULTS.maxCells, `grow() stops at the cap (${big.count})`);
for (let i = 0; i < 60 * 20; i++) { if (i % 120 === 0) big.dropFood((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3); big.step(1 / 60); }
s = bodyStats(big);
ok(!s.nan && s.maxV < DEFAULTS.maxSpeed + 0.01 && s.maxD < big.R * 2.0, `a full-size pet is still stable (R ${big.R.toFixed(2)}, max speed ${s.maxV.toFixed(2)})`);
ok(big.bites > 0 && big.count === DEFAULTS.maxCells, "it still eats at full size, without growing");
{
  const t0 = performance.now();
  for (let i = 0; i < 600; i++) big.step(1 / 60);
  const per = (performance.now() - t0) / 600;
  ok(per < 4, `full-size step is cheap in node (${per.toFixed(2)} ms per frame)`);
}

console.log("7. save and load");
const saved = pet.toJSON();
ok(saved.v === 1 && saved.name === "Pip" && saved.colour === "mint" && saved.cells === pet.count, "save has name, colour, cells, age");
const back = PetSim.fromJSON({ ...saved, savedAt: Date.now() - 5 * 3.6e6 }, { seed: 9 });
ok(back && back.count === pet.count && back.name === "Pip" && back.colour === "mint" && back.bornAt === pet.bornAt, "loads back the same size, name, colour, age");
ok(back.hunger < saved.hunger && back.hunger >= 0.3, `five hours away makes it a bit hungry, not starving (${saved.hunger.toFixed(2)} -> ${back.hunger.toFixed(2)})`);
ok(PetSim.fromJSON(null) === null && PetSim.fromJSON("junk") === null, "junk saves are ignored");
ok(PetSim.fromJSON({ cells: 9999 }).count === DEFAULTS.maxCells, "a tampered save is clamped to the cap");
ok(PALETTE.length === 6 && formatAge(0) === "just hatched" && formatAge(90 * 60000) === "1 h old", "palette and age text");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
