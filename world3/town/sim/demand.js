/* ============================================================================
   sim/demand.js — the pressure that grows the town
   ---------------------------------------------------------------------------
   Principle taken from the-current (construction.housingTriggerRatio, seen in
   its config): the town grows when demand crosses a ratio, not when a script
   says so. Here the ratio is occupancy: a household whose members outnumber
   its home's sleeping capacity needs a house. The request is data — world/
   decides where and what, the town's own validators decide whether it stands.
   ========================================================================== */
(function () {
"use strict";
const ASH = (globalThis.ASH = globalThis.ASH || {});

ASH.BEDS_SLEEP = 2;                          // people per bedroom

ASH.householdOvercrowded = function (household, people, homes) {
  const home = homes[household.homeId];
  if (!home) return false;
  const capacity = home.beds * ASH.BEDS_SLEEP;
  return household.memberIds.length > capacity;
};
})();
