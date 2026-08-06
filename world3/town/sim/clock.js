/* ============================================================================
   sim/clock.js — the one clock, and the one place O3 is answered
   ---------------------------------------------------------------------------
   DECISION (O3, recorded in docs/DECISIONS.md): the world advances one world
   day per real day, measured from its genesis, WHETHER OR NOT ANYONE IS
   WATCHING — the-current's model. Like livi-organism, nothing ticks while
   unobserved; the elapsed days are applied as a catch-up on the next load.

   Everything time-related in sim/ goes through this module, so swapping the
   answer later (per-player instances, a faster day, a server clock) touches
   one file, not the systems.
   ========================================================================== */
(function () {
"use strict";
const ASH = (globalThis.ASH = globalThis.ASH || {});

ASH.WORLD_DAY_MS = 86_400_000;              // one world day per real day

/* The world day a genesis timestamp has reached by nowMs. Day 0 is genesis. */
ASH.worldDayAt = function (genesisMs, nowMs) {
  if (!Number.isFinite(genesisMs) || !Number.isFinite(nowMs)) return 0;
  return Math.max(0, Math.floor((nowMs - genesisMs) / ASH.WORLD_DAY_MS));
};

/* How many days of catch-up a restored world owes, capped so a year-abandoned
   world replays in bounded time (livi-organism caps its catch-up the same way
   for the same reason). */
ASH.MAX_CATCHUP_DAYS = 400;
ASH.catchupDays = function (genesisMs, currentDay, nowMs) {
  const owed = ASH.worldDayAt(genesisMs, nowMs) - currentDay;
  return Math.max(0, Math.min(owed, ASH.MAX_CATCHUP_DAYS));
};
})();
