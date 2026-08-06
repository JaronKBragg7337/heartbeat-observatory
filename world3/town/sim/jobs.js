/* ============================================================================
   sim/jobs.js — businesses, seats, and the labor that builds things
   ---------------------------------------------------------------------------
   Principle taken from the-current (seen in engine.ts): a business is seats,
   not vibes. A seat is occupied by exactly one person or is vacant; an
   occupied seat produces a fixed amount of labor per day worked; construction
   consumes labor. If nobody holds the builder seat, the town cannot grow —
   the economy gates the expansion, which is the interaction the slice proves.

   Role-swapping (a player taking a seat from an NPC, an NPC reclaiming it) is
   Step 3. The seat model here is built for it: seats are vacatable and
   re-assignable, and occupancy is data, not a scene attachment.
   ========================================================================== */
(function () {
"use strict";
const ASH = (globalThis.ASH = globalThis.ASH || {});

ASH.LABOR_PER_WORKER_DAY = 5;               // the-current's laborPerWorker

ASH.makeBusiness = function (ids, name, address, roles) {
  const biz = { id: ids.next("biz"), name, address, seats: [] };
  for (const role of roles)
    biz.seats.push({ id: ids.next("seat"), role, occupantId: null });
  return biz;
};

ASH.assignSeat = function (biz, seat, person) {
  if (seat.occupantId) throw new Error(`seat ${seat.id} is occupied`);
  seat.occupantId = person.id;
  person.seatId = seat.id;
  person.employerId = biz.id;
};

ASH.vacateSeat = function (biz, seat, person) {
  if (seat.occupantId !== person.id) throw new Error(`seat ${seat.id} not held by ${person.id}`);
  seat.occupantId = null;
  person.seatId = null;
  person.employerId = null;
};

/* A construction project: a validated growth decision waiting on labor. */
ASH.makeProject = function (ids, record, householdId, laborNeeded) {
  return {
    id: ids.next("project"),
    record,                                // { id, key, lot: { block, index } }
    forHouseholdId: householdId,
    laborNeeded,
    laborDone: 0,
    complete: false,
  };
};
})();
