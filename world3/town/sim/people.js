/* ============================================================================
   sim/people.js — people and households
   ---------------------------------------------------------------------------
   A person is plain data: identity, age, traits, household, home address,
   job seat. Positions are ADDRESSES (B07), never coordinates — resolving an
   address to a place is world/'s job, drawing it is the renderer's.
   ========================================================================== */
(function () {
"use strict";
const ASH = (globalThis.ASH = globalThis.ASH || {});

const FIRST = ["Alden", "Bria", "Corin", "Della", "Emmet", "Farrah", "Gideon",
               "Hazel", "Ida", "Jonas", "Kestrel", "Liora", "Maren", "Nils",
               "Odessa", "Perrin", "Quilla", "Rowan", "Sable", "Tamsin"];
const LAST = ["Ashford", "Briar", "Calloway", "Dunmore", "Ellery", "Fenwick",
              "Grange", "Holloway", "Ivers", "Kettering"];

ASH.makePerson = function (ids, rng, fields) {
  return {
    id: ids.next("person"),
    name: `${rng.pick(FIRST)} ${rng.pick(LAST)}`,
    ageDays: fields.ageDays,
    traits: fields.traits || ASH.rollTraits(rng),
    householdId: fields.householdId || null,
    homeId: fields.homeId || null,        // building asset id, e.g. "B07"
    seatId: null,                          // job seat held, if any
    employerId: null,
    alive: true,
  };
};

ASH.makeHousehold = function (ids, homeId) {
  return {
    id: ids.next("household"),
    homeId,                                // building asset id
    memberIds: [],
    pendingHomeId: null,                   // set when a move is committed
  };
};
})();
