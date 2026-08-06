/* ============================================================================
   sim/resources.js — town resources: food, water, energy (D14)
   ---------------------------------------------------------------------------
   The town eats, drinks and burns power every day, watched or not. Stocks are
   plain state; production comes from occupied utility seats; consumption comes
   from counting heads, households and businesses. A resource that cannot meet
   the day's consumption clamps at zero and counts consecutive shortfall days
   in state.hardship — and a hungry town does not grow (the conception gate in
   engine step 2b reads hardship, D14).

   Same discipline as every other sim module: plain data in, events out, no
   randomness at all — the rates below ARE the system, and they are constants
   so a replay computes the identical stocks.
   ========================================================================== */
(function () {
"use strict";
const ASH = (globalThis.ASH = globalThis.ASH || {});

/* D14 rates — the whole economy of sustenance, stated once:

     consumption   food    1 per person per day
                   water   1 per person per day
                   energy  1 per household per day + 1 per business per day

     production    per OCCUPIED seat per day (NPC or a player who showed up):
                   grocer +5 food · cook +3 food
                   waterkeeper +8 water · lineman +10 energy

     A fully staffed founding town (12 people, 6 households, 4 businesses)
     nets food +1, water +4, energy 0 per day — surplus on all three, by
     design: the vertical slice's growth chain must keep firing (D14). */
ASH.RESOURCE = {
  FOOD_PER_PERSON: 1,
  WATER_PER_PERSON: 1,
  ENERGY_PER_HOUSEHOLD: 1,
  ENERGY_PER_BUSINESS: 1,
  PRODUCE: { grocer: 5, cook: 3, waterkeeper: 8, lineman: 10 },
  ROLE_RESOURCE: { grocer: "food", cook: "food", waterkeeper: "water", lineman: "energy" },
  START: { food: 30, water: 30, energy: 20 },     // founding stocks
};

/* The three founding utilities, in founding order. Engine creates them AFTER
   Ashgrove Builders so builder seat ids don't shift (the slice's hiring order
   is a recorded behavior). addressKey names which utilityAddresses entry the
   caller measured for it. */
ASH.UTILITY_FOUNDING = [
  { name: "Ashgrove General Store", addressKey: "store",
    roles: ["grocer", "grocer"] },
  { name: "The Ashgrove Diner", addressKey: "diner",
    roles: ["cook"] },
  { name: "Ashgrove Water & Light", addressKey: "townHall",
    roles: ["waterkeeper", "waterkeeper", "lineman"] },
];

const SHORTAGE_MSG = {
  food: "The town is short of food — the pantry is bare.",
  water: "The town is short of water — the well is running dry.",
  energy: "The town is short of energy — the lights are going out.",
};

/* The day's consumption, counted from live state. */
ASH.consumptionFor = function (state) {
  const R = ASH.RESOURCE;
  const people = Object.values(state.people).filter((p) => p.alive).length;
  return {
    food: people * R.FOOD_PER_PERSON,
    water: people * R.WATER_PER_PERSON,
    energy: Object.keys(state.households).length * R.ENERGY_PER_HOUSEHOLD +
            Object.keys(state.businesses).length * R.ENERGY_PER_BUSINESS,
  };
};

/* Day-pipeline step 8 — sustenance. Appended after step 7; never reordered.
   emit is the engine's own event sink, passed in so this module never reaches
   outside sim/. */
ASH.stepSustenance = function (state, emit) {
  const R = ASH.RESOURCE;
  const produced = { food: 0, water: 0, energy: 0 };

  /* 8.1 — production: occupied utility seats held by NPCs (occupant in
     state.people). A player-held seat is not this branch — see 8.2. */
  for (const biz of Object.values(state.businesses))
    for (const seat of biz.seats) {
      const res = R.ROLE_RESOURCE[seat.role];
      if (!res || !seat.occupantId || !state.people[seat.occupantId]) continue;
      produced[res] += R.PRODUCE[seat.role];
    }

  /* 8.2 — player production: the seat is theirs, the output is not automatic.
     Same show-up gate as step 6's player labor: worked today or yesterday. */
  if (state.player && state.player.seatId && state.day - state.player.lastWorkDay <= 1) {
    const biz = state.businesses[state.player.employerId];
    const seat = biz && biz.seats.find((s) => s.id === state.player.seatId);
    const res = seat && R.ROLE_RESOURCE[seat.role];
    if (res) produced[res] += R.PRODUCE[seat.role];
  }

  /* 8.3 — consumption: heads, households, businesses. */
  const consumed = ASH.consumptionFor(state);

  /* 8.4 — settle each resource: shortfall clamps at zero, counts consecutive
     hungry days, and says so; a fully met day resets the count. */
  for (const r of ["food", "water", "energy"]) {
    state.counters[r + "Produced"] += produced[r];   // honest net/day numbers
    state.counters[r + "Consumed"] += consumed[r];   // for the UI (D14.5)
    const net = state.stocks[r] + produced[r] - consumed[r];
    if (net < 0) {
      state.stocks[r] = 0;
      state.hardship[r] += 1;
      emit(state, "shortage", SHORTAGE_MSG[r], { resource: r, days: state.hardship[r] });
    } else {
      state.stocks[r] = net;
      state.hardship[r] = 0;
    }
  }
};
})();
