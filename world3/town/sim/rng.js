/* ============================================================================
   sim/rng.js — deterministic randomness
   ---------------------------------------------------------------------------
   Principle taken from the-current's DeterministicRng (seen in its source):
   one seeded generator for sequential draws, plus *derived streams* — a fresh
   generator hashed from (world seed, domain, day, entity) — so each decision's
   randomness is reproducible without replaying everything before it, and no
   decision's draw can perturb another's.

   Re-implemented here in Ashgrove's own style. The town's generator uses the
   same xorshift32 family (T.rng in the renderer's core), which is why this fits.

   No DOM, no GPU, no frame loop. node tools/layers.js enforces it.
   ========================================================================== */
(function () {
"use strict";
const ASH = (globalThis.ASH = globalThis.ASH || {});

/* FNV-1a 32-bit, never returning zero (zero would stick the generator) */
ASH.hashSeed = function (str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) || 0x9e3779b9;
};

/* xorshift32 with a restorable snapshot, so a saved world resumes its draw
   sequence exactly where it left off */
ASH.Rng = class Rng {
  constructor(state) {
    this.state = (state >>> 0) || 0x9e3779b9;
  }
  static fromSeed(str) { return new Rng(ASH.hashSeed(str)); }
  snapshot() { return this.state >>> 0; }
  nextUint32() {
    let s = this.state;
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    this.state = s;
    return s;
  }
  float() { return this.nextUint32() / 4294967296; }
  int(min, max) {
    if (!Number.isInteger(min) || !Number.isInteger(max) || max < min)
      throw new RangeError(`bad int range ${min}..${max}`);
    return min + (this.nextUint32() % (max - min + 1));
  }
  pick(arr) {
    if (!arr.length) throw new RangeError("pick from empty list");
    return arr[this.int(0, arr.length - 1)];
  }
};

/* A derived stream: deterministic randomness for ONE decision, addressed by
   what the decision is about — not by when it happens to run. */
ASH.stream = function (seed, ...parts) {
  return ASH.Rng.fromSeed([seed, ...parts.map(String)].join("|"));
};
})();
