/* ============================================================================
   world/growth.js — deciding where the town grows
   ---------------------------------------------------------------------------
   The allocator's own principles, reused (seen in render/town.js allocate()):
   the smallest house type that meets the need, in the tightest lot that still
   fits it, with the same setback rules the founding town used. Input is plain
   site data (measured from the town by the host); the output is a building
   RECORD, not a building — the town's generator and validators decide whether
   it ever stands.
   ========================================================================== */
(function () {
"use strict";
const ASH = (globalThis.ASH = globalThis.ASH || {});

/* the town's lot rules, mirrored from render/town.js (lotFits): keep in step
   deliberately — if the town changes its rules, change these too */
const SIDE = 0.4, MIN_SETBACK = 2.2, REAR = 0.6;

function lotFitsData(lot, def) {
  return def.w + SIDE <= lot.front && MIN_SETBACK + def.d + REAR <= lot.deep;
}

/* options: { freeLots, usedLots, houseTypes, bedsByType, needBeds, rng }
   freeLots:  [{ block, index, front, deep, face }]
   usedLots:  ["block:index", …] — lots already taken by committed records
   Returns { key, lot } or null when nothing fits. */
ASH.chooseGrowth = function (options) {
  const used = new Set(options.usedLots || []);
  const free = options.freeLots.filter((l) => !used.has(`${l.block}:${l.index}`));
  if (!free.length) return null;

  /* smallest type that sleeps the need; if none does, smallest overall */
  const keys = Object.keys(options.houseTypes);
  const fitting = keys.filter((k) => (options.bedsByType[k] || 0) >= options.needBeds);
  const byFootprint = (a, b) =>
    options.houseTypes[a].w * options.houseTypes[a].d -
    options.houseTypes[b].w * options.houseTypes[b].d;
  const order = (fitting.length ? fitting : keys).sort(byFootprint);

  for (const key of order) {
    const def = options.houseTypes[key];
    let best = null, bestScore = Infinity;
    for (const lot of free) {
      if (!lotFitsData(lot, def)) continue;
      const score = (lot.front - def.w) + (lot.deep - def.d) * 0.5;   // snug fit
      if (score < bestScore) { bestScore = score; best = lot; }
    }
    if (best) return { key, lot: { block: best.block, index: best.index } };
  }
  return null;
};
})();
