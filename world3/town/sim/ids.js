/* ============================================================================
   sim/ids.js — one registry, one namespace
   ---------------------------------------------------------------------------
   DECISION (D6, docs/DECISIONS.md and docs/STATE-AUTHORITY.md): every entity
   category is minted here, from one counter space — the-current's
   prefixed-counter shape (person:000123). Nobody else makes IDs. Spatial
   addresses (B07-L1-R03) stay the town's business; entities carry them, they
   don't become them.
   ========================================================================== */
(function () {
"use strict";
const ASH = (globalThis.ASH = globalThis.ASH || {});

ASH.createIds = function (restored) {
  const counters = restored || {};
  return {
    counters,
    next(prefix) {
      counters[prefix] = (counters[prefix] || 0) + 1;
      return `${prefix}:${String(counters[prefix]).padStart(6, "0")}`;
    },
    peek(prefix) { return counters[prefix] || 0; },
  };
};
})();
