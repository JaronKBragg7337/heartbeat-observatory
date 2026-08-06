/* ============================================================================
   sim/organisms.js — lifecycle and inheritance
   ---------------------------------------------------------------------------
   Principle taken from livi-organism (seen in its source, LiviCompanion.tsx):
   traits are first-class heritable state. A child is not a reroll — each axis
   is the parents' blend plus a bounded mutation, drawn from a derived stream
   addressed to that birth. Lifecycle is driven by ELAPSED TIME (age in days),
   never by frames, so a headless world and a watched one age identically.

   Where livi seeds organisms from Math.random(), Ashgrove draws every trait
   from the world's derived streams (D6) — replay must agree.
   ========================================================================== */
(function () {
"use strict";
const ASH = (globalThis.ASH = globalThis.ASH || {});

ASH.TRAIT_AXES = [
  "curiosity", "sociability", "appetite", "resilience",
  "playfulness", "growthBias", "locomotion",
];

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

ASH.rollTraits = function (rng) {
  const t = {};
  for (const axis of ASH.TRAIT_AXES) t[axis] = 0.3 + rng.float() * 0.58;
  return t;
};

/* livi's principle, re-implemented: inheritance is blending, not copying and
   not rerolling. Mutation is bounded so a child is recognisably of its line. */
ASH.inheritTraits = function (parentA, parentB, rng) {
  const t = {};
  for (const axis of ASH.TRAIT_AXES) {
    const blend = (parentA.traits[axis] + parentB.traits[axis]) / 2;
    t[axis] = clamp01(blend + (rng.float() - 0.5) * 0.2);
  }
  return t;
};

ASH.GESTATION_DAYS = { min: 260, max: 294 };     // the-current's range
ASH.LIFE_STAGES = { child: 13 * 365, youngAdult: 18 * 365, adult: 30 * 365 };

ASH.lifeStageFor = function (ageDays) {
  if (ageDays < ASH.LIFE_STAGES.child) return "child";
  if (ageDays < ASH.LIFE_STAGES.youngAdult) return "adolescent";
  if (ageDays < ASH.LIFE_STAGES.adult) return "youngAdult";
  return "adult";
};
})();
