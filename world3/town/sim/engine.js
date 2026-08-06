/* ============================================================================
   sim/engine.js — the authoritative world state and its day pipeline
   ---------------------------------------------------------------------------
   Principle taken from the-current (seen in engine.ts): ONE plain-data
   state holds everything that is true whether or not anyone is looking;
   a fixed-order pipeline advances it one day at a time; snapshots carry a
   canonical digest and restore refuses a mismatch.

   The pipeline order below is the contract. New systems slot in; they do not
   reorder. Events are the only output — orchestrators (tools/slice.js, the
   browser boot) listen and act; the engine never reaches outside sim/.
   ========================================================================== */
(function () {
"use strict";
const ASH = (globalThis.ASH = globalThis.ASH || {});

/* 2: D14 — stocks/hardship are core state now; pre-D14 snapshots cannot
   advance (no stocks to settle), so they are rejected and refounded. */
const SCHEMA_VERSION = 2;
const MAX_EVENTS = 5000;
const FOUNDING_HOUSEHOLDS = 6;
const HOUSE_LABOR_DAYS = 30;                 // 30 labor = 6 days for one builder
const BUILDER_SEATS = 3;

/* reproduction, on the-current's rules (seen in its config): a small chance
   per couple per day, gated on housing security, with a long cooldown.
   "Housing security" here is the honest analogue available in Ashgrove:
   the household is not overcrowded. */
const CONCEPTION_CHANCE_PER_DAY = 0.004;
const COOLDOWN_DAYS = { min: 365, max: 3 * 365 };
const ADULT_AGE_DAYS = 18 * 365;

function emit(state, type, msg, data) {
  state.eventSeq += 1;
  state.events.push({ seq: state.eventSeq, day: state.day, type, msg, data: data || {} });
  if (state.events.length > MAX_EVENTS) state.events.splice(0, state.events.length - MAX_EVENTS);
}

class AshgroveSim {
  constructor(state) { this.state = state; }

  /* ------------------------------------------------------------ create -- */
  /* options: { seed, homes: {B07:{beds:2},…}, houseIds: […sorted],
               businessAddress, utilityAddresses: { store, diner, townHall } }
     — all plain data measured from the town by the caller (building ids).
     sim never measures the town itself. */
  static create(options) {
    if (!options.utilityAddresses)
      throw new Error("AshgroveSim.create requires utilityAddresses { store, diner, townHall } (D14)");
    const seed = options.seed;
    const ids = ASH.createIds();
    const rng = ASH.Rng.fromSeed(`${seed}|founding`);
    const state = {
      schemaVersion: SCHEMA_VERSION,
      seed,
      day: 0,
      ids: ids.counters,
      people: {},
      households: {},
      homes: ASH.cloneState(options.homes),
      businesses: {},
      projects: {},
      pregnancies: {},
      stocks: ASH.cloneState(ASH.RESOURCE.START),        // D14: the pantry is core state
      hardship: { food: 0, water: 0, energy: 0 },        // D14: consecutive shortfall days
      events: [],
      eventSeq: 0,
      counters: { births: 0, growthCompleted: 0, laborWorked: 0,
                  foodProduced: 0, foodConsumed: 0,
                  waterProduced: 0, waterConsumed: 0,
                  energyProduced: 0, energyConsumed: 0 },
    };
    const sim = new AshgroveSim(state);

    /* households onto houses, smallest first — the expecting couple gets the
       tightest house, which is what makes the slice's chain fire on its own */
    const houseIds = options.houseIds.slice().sort(
      (a, b) => state.homes[a].beds - state.homes[b].beds || a.localeCompare(b));
    for (let h = 0; h < Math.min(FOUNDING_HOUSEHOLDS, houseIds.length); h++) {
      const homeId = houseIds[h];
      const hh = ASH.makeHousehold(ids, homeId);
      state.households[hh.id] = hh;
      const adults = [];
      for (let k = 0; k < 2; k++) {
        const p = ASH.makePerson(ids, rng, {
          ageDays: rng.int(20, 45) * 365,
          householdId: hh.id,
          homeId,
        });
        state.people[p.id] = p;
        hh.memberIds.push(p.id);
        adults.push(p);
      }
      /* the first household is already expecting — the slice's cause.
         Conception beyond this founding pregnancy is Step 3 (see STATUS.md). */
      if (h === 0) {
        const due = ASH.stream(seed, "due", hh.id);
        const preg = {
          id: ids.next("preg"),
          householdId: hh.id,
          parentAId: adults[0].id,
          parentBId: adults[1].id,
          dueDay: due.int(8, 14),
        };
        state.pregnancies[preg.id] = preg;
        emit(state, "expecting", `${adults[0].name} and ${adults[1].name} are expecting (due day ${preg.dueDay}).`,
             { householdId: hh.id, dueDay: preg.dueDay });
      }
    }

    /* one business, three builder seats, one filled — the economy that has to
       show up for work before the town can grow */
    const biz = ASH.makeBusiness(ids, "Ashgrove Builders", options.businessAddress,
                                 Array(BUILDER_SEATS).fill("builder"));
    state.businesses[biz.id] = biz;
    const workerHousehold = state.households[Object.keys(state.households)[1]];
    const workerId = workerHousehold.memberIds[0];
    ASH.assignSeat(biz, biz.seats[0], state.people[workerId]);
    emit(state, "hired", `${state.people[workerId].name} took the builder seat at ${biz.name}.`,
         { personId: workerId, seatId: biz.seats[0].id, bizId: biz.id });

    /* D14: the three utilities, founded AFTER the builders so builder seat
       ids don't shift. Their seats start vacant — daily hiring (step 2c)
       staffs them from the idle adults, which is why a freshly founded town
       feeds itself from day 1. */
    const utilityIds = [];
    for (const u of ASH.UTILITY_FOUNDING) {
      const ub = ASH.makeBusiness(ids, u.name, options.utilityAddresses[u.addressKey], u.roles);
      state.businesses[ub.id] = ub;
      utilityIds.push(ub.id);
    }
    emit(state, "founded",
         `Utilities founded: ${ASH.UTILITY_FOUNDING.map((u) => u.name).join(", ")}.`,
         { utilityIds });

    emit(state, "founded", `Ashgrove founded: ${hh_count(state)} households, one yard, one seat empty.`,
         { households: hh_count(state) });
    return sim;
  }

  /* ------------------------------------------------------ snapshot ------ */
  snapshot() {
    const state = ASH.cloneState(this.state);
    return { schemaVersion: SCHEMA_VERSION, state, digest: ASH.canonicalDigest(state) };
  }

  static restore(snapshot) {
    if (!snapshot || snapshot.schemaVersion !== SCHEMA_VERSION)
      throw new Error(`unsupported sim schema ${snapshot && snapshot.schemaVersion}`);
    const state = ASH.cloneState(snapshot.state);
    if (ASH.canonicalDigest(state) !== snapshot.digest)
      throw new Error("sim snapshot digest does not match its state");
    return new AshgroveSim(state);
  }

  eventsSince(seq) { return this.state.events.filter((e) => e.seq > seq); }

  /* ------------------------------------------- orchestrator-facing ------ */
  startConstruction(record, householdId, laborNeeded) {
    const p = ASH.makeProject(ASH.createIds(this.state.ids), record, householdId,
                              laborNeeded || HOUSE_LABOR_DAYS);
    this.state.projects[p.id] = p;
    const hh = this.state.households[householdId];
    if (hh) hh.requestOpen = false;
    emit(this.state, "construction-started",
         `Ground broken on ${record.id} (${record.key}) for ${hh ? "a crowded household" : "demand"}.`,
         { projectId: p.id, buildingId: record.id, key: record.key, lot: record.lot });
    return p;
  }

  /* The town was rebuilt with the record and the validators passed. The
     building exists; the household moves in. */
  confirmGrowth(record, newBeds) {
    const st = this.state;
    st.homes[record.id] = { beds: newBeds };
    st.counters.growthCompleted += 1;
    const project = Object.values(st.projects).find(
      (p) => p.record.id === record.id && p.complete);
    const hh = project && st.households[project.forHouseholdId];
    if (hh) {
      hh.homeId = record.id;
      hh.requestOpen = false;
      for (const pid of hh.memberIds) st.people[pid].homeId = record.id;
      emit(st, "moved-in",
           `A household of ${hh.memberIds.length} moved into ${record.id}.`,
           { householdId: hh.id, buildingId: record.id });
    }
    return project || null;
  }

  /* The world could not place anything for this request (no lot fits). Clear
     the request so a later day — after other growth frees nothing, or never —
     can ask again honestly. */
  cancelRequest(householdId, why) {
    const hh = this.state.households[householdId];
    if (hh) hh.requestOpen = false;
    emit(this.state, "growth-unplaceable", `No lot can take a new house: ${why}`,
         { householdId, why });
  }

  /* The candidate failed the town's validators — drop it, keep the world
     honest, and let demand re-ask on a later day. */
  rejectGrowth(record, why) {
    const st = this.state;
    const project = Object.values(st.projects).find((p) => p.record.id === record.id);
    if (project) delete st.projects[project.id];
    const hh = project && st.households[project.forHouseholdId];
    if (hh) hh.requestOpen = false;
    emit(st, "growth-rejected", `${record.id} failed validation and was not built: ${why}`,
         { buildingId: record.id, why });
  }

  /* -------------------------------------- role-swap: the player entity ---- */
  /* The player is OPTIONAL state, created lazily and kept OUT of state.people
     so household, hiring and digest logic never see it. Old snapshots carry
     no player; every code path below tolerates that. */
  ensurePlayer() {
    const st = this.state;
    if (!st.player)
      st.player = { id: "person:player", seatId: null, employerId: null,
                    lastWorkDay: -1, homeId: null };
    return st.player;
  }

  /* Take the business's first seat. Vacant: take it. Held by an NPC: vacate
     the NPC, remember them on seat.displacedId, and take it — the seat stays
     honest data the whole time, so leaving hands it straight back. */
  playerTakeSeat(bizId) {
    const st = this.state;
    const biz = st.businesses[bizId];
    if (!biz) throw new Error(`no business ${bizId}`);
    const player = this.ensurePlayer();
    if (player.seatId) throw new Error("player already holds a seat — leave it first");
    const seat = biz.seats[0];
    if (!seat) throw new Error(`${biz.name} has no seats`);
    let displaced = null;
    if (seat.occupantId) {
      displaced = st.people[seat.occupantId];
      if (!displaced) throw new Error(`seat ${seat.id} held by a non-person`);
      ASH.vacateSeat(biz, seat, displaced);
      seat.displacedId = displaced.id;
    }
    ASH.assignSeat(biz, seat, player);
    player.lastWorkDay = st.day;
    emit(st, "seat-taken",
         displaced ? `You took the ${seat.role} seat at ${biz.name} — ${displaced.name} was displaced.`
                   : `You took the vacant ${seat.role} seat at ${biz.name}.`,
         { seatId: seat.id, bizId: biz.id, displacedId: displaced ? displaced.id : null });
    return seat;
  }

  /* Hand the seat back: the displaced NPC reclaims it if they are still
     alive and idle, otherwise it simply stands open. */
  playerLeaveSeat() {
    const st = this.state;
    const player = st.player;
    if (!player || !player.seatId) throw new Error("player holds no seat");
    const { biz, seat } = this._playerSeat();
    ASH.vacateSeat(biz, seat, player);
    this._reclaimSeat(biz, seat);
    return seat;
  }

  /* A day of honest work on the seat: resets the inactivity clock (step 7). */
  playerWorkShift() {
    const st = this.state;
    const player = st.player;
    if (!player || !player.seatId) throw new Error("player holds no seat to work");
    player.lastWorkDay = st.day;
    const { biz, seat } = this._playerSeat();
    emit(st, "shift-worked", `You worked a shift at ${biz.name}.`,
         { seatId: seat.id, bizId: biz.id, day: st.day });
  }

  _playerSeat() {
    const st = this.state;
    const biz = st.businesses[st.player.employerId];
    const seat = biz && biz.seats.find((s) => s.id === st.player.seatId);
    if (!seat) throw new Error("player seat no longer exists");
    return { biz, seat };
  }

  /* Shared by playerLeaveSeat and step 7: give the seat back to the NPC it
     was taken from when possible; say what happened either way. */
  _reclaimSeat(biz, seat, why) {
    const st = this.state;
    const npc = seat.displacedId ? st.people[seat.displacedId] : null;
    if (npc && npc.alive && !npc.seatId) {
      ASH.assignSeat(biz, seat, npc);
      emit(st, "seat-reclaimed",
           why ? `${npc.name} reclaimed the ${seat.role} seat ${why}.`
               : `${npc.name} reclaimed the ${seat.role} seat at ${biz.name}.`,
           { seatId: seat.id, bizId: biz.id, personId: npc.id });
    } else {
      emit(st, "seat-open", `The ${seat.role} seat at ${biz.name} stands open.`,
           { seatId: seat.id, bizId: biz.id });
    }
    seat.displacedId = null;
  }

  /* --------------------------------------------------------- the day ---- */
  advanceDay() {
    const st = this.state;
    const startSeq = st.eventSeq;
    st.day += 1;
    const ids = ASH.createIds(st.ids);

    /* 1 — aging: elapsed time, not frames (livi's principle) */
    for (const p of Object.values(st.people)) p.ageDays += 1;

    /* 2 — births due today */
    for (const preg of Object.values(st.pregnancies)) {
      if (st.day < preg.dueDay) continue;
      const parentA = st.people[preg.parentAId], parentB = st.people[preg.parentBId];
      const hh = st.households[preg.householdId];
      const draw = ASH.stream(st.seed, "birth", st.day, preg.id);
      const child = ASH.makePerson(ids, draw, {
        ageDays: 0,
        traits: ASH.inheritTraits(parentA, parentB, draw),
        householdId: hh.id,
        homeId: hh.homeId,
      });
      st.people[child.id] = child;
      hh.memberIds.push(child.id);
      st.counters.births += 1;
      delete st.pregnancies[preg.id];
      emit(st, "birth",
           `${child.name} was born to ${parentA.name} and ${parentB.name} in ${hh.homeId}.`,
           { childId: child.id, householdId: hh.id, homeId: hh.homeId, traits: child.traits });
    }

    /* 2b — conception: couples with secure housing may conceive. Drawn from a
       derived stream addressed to (day, household), so the roll replays
       exactly and cannot be perturbed by anything before it. */
    for (const hh of Object.values(st.households)) {
      const adults = hh.memberIds.map((id) => st.people[id])
        .filter((p) => p && p.alive && p.ageDays >= ADULT_AGE_DAYS);
      if (adults.length < 2) continue;
      if (Object.values(st.pregnancies).some((g) => g.householdId === hh.id)) continue;
      if ((hh.cooldownUntil || 0) > st.day) continue;
      if (ASH.householdOvercrowded(hh, st.people, st.homes)) continue;   // housing security
      /* D14: a hungry town does not grow — conception waits until food and
         water are both fully meeting consumption again. */
      if (st.hardship.food > 0 || st.hardship.water > 0) continue;
      const roll = ASH.stream(st.seed, "conception", st.day, hh.id);
      if (roll.float() >= CONCEPTION_CHANCE_PER_DAY) continue;
      const preg = {
        id: ids.next("preg"),
        householdId: hh.id,
        parentAId: adults[0].id,
        parentBId: adults[1].id,
        dueDay: st.day + roll.int(ASH.GESTATION_DAYS.min, ASH.GESTATION_DAYS.max),
      };
      st.pregnancies[preg.id] = preg;
      hh.cooldownUntil = st.day + roll.int(COOLDOWN_DAYS.min, COOLDOWN_DAYS.max);
      emit(st, "conception",
           `${adults[0].name} and ${adults[1].name} are expecting (due day ${preg.dueDay}).`,
           { householdId: hh.id, dueDay: preg.dueDay });
    }

    /* 2c — hiring: idle adults take vacant builder seats. The labor pool
       grows with the population; seats stay vacatable for the player
       role-swap, which is Step 3 and honestly stubbed (see STATUS.md). */
    for (const biz of Object.values(st.businesses))
      for (const seat of biz.seats) {
        if (seat.occupantId) continue;
        const idle = Object.values(st.people).find(
          (p) => p.alive && p.ageDays >= ADULT_AGE_DAYS && !p.seatId);
        if (!idle) break;
        ASH.assignSeat(biz, seat, idle);
        emit(st, "hired", `${idle.name} took a ${seat.role} seat at ${biz.name}.`,
             { personId: idle.id, seatId: seat.id, bizId: biz.id });
      }

    /* 3 — work: occupied builder seats pour labor into open projects.
       NPC seats only: a player-held seat (occupant not in people) works
       through step 6 below, gated on the player actually showing up. This
       guard cannot fire in a playerless world, so the slice digest stands. */
    const open = Object.values(st.projects).filter((p) => !p.complete);
    if (open.length) {
      for (const biz of Object.values(st.businesses))
        for (const seat of biz.seats) {
          if (!seat.occupantId || seat.role !== "builder" || !st.people[seat.occupantId]) continue;
          const share = ASH.LABOR_PER_WORKER_DAY;
          const project = open[0];
          project.laborDone += share;
          st.counters.laborWorked += share;
        }
    }

    /* 4 — completion: the economy has done its part; the world may now
       validate and commit the building (the orchestrator's job) */
    for (const p of Object.values(st.projects)) {
      if (p.complete || p.laborDone < p.laborNeeded) continue;
      p.complete = true;
      emit(st, "growth-complete",
           `${p.record.id} is built (${p.laborDone}/${p.laborNeeded} labor). Awaiting validation.`,
           { projectId: p.id, record: p.record, forHouseholdId: p.forHouseholdId });
    }

    /* 5 — demand: overcrowded households ask the world for a house */
    for (const hh of Object.values(st.households)) {
      if (hh.requestOpen) continue;
      const hasProject = Object.values(st.projects).some((p) => p.forHouseholdId === hh.id);
      if (hasProject) continue;
      if (!ASH.householdOvercrowded(hh, st.people, st.homes)) continue;
      hh.requestOpen = true;
      const needBeds = Math.ceil(hh.memberIds.length / ASH.BEDS_SLEEP);
      emit(st, "growth-requested",
           `Household in ${hh.homeId} is overcrowded (${hh.memberIds.length} people) and needs a house.`,
           { householdId: hh.id, needBeds, members: hh.memberIds.length });
    }

    /* 6 — player labor (appended; no-op when no player exists). A held seat
       pours like an NPC builder seat, but only if the player showed up today
       or yesterday — the seat is theirs, the labor is not automatic. */
    if (st.player && st.player.seatId && st.day - st.player.lastWorkDay <= 1) {
      const openNow = Object.values(st.projects).filter((p) => !p.complete);
      if (openNow.length) {
        openNow[0].laborDone += ASH.LABOR_PER_WORKER_DAY;
        st.counters.laborWorked += ASH.LABOR_PER_WORKER_DAY;
      }
    }

    /* 7 — inactivity reclaim (appended; no-op when no player exists). Three
       days silent and the seat goes back to the NPC it was taken from. */
    if (st.player && st.player.seatId && st.day - st.player.lastWorkDay > 3) {
      const { biz, seat } = this._playerSeat();
      ASH.vacateSeat(biz, seat, st.player);
      this._reclaimSeat(biz, seat, "after you stopped showing up");
    }

    /* 8 — sustenance (D14, appended; the pipeline order is the contract).
       Production from staffed utility seats, consumption from heads and
       roofs, shortfall counted in state.hardship. */
    ASH.stepSustenance(st, emit);

    return { day: st.day, events: this.eventsSince(startSeq), digest: this.snapshot().digest };
  }
}

function hh_count(state) { return Object.keys(state.households).length; }

ASH.AshgroveSim = AshgroveSim;
ASH.SIM_SCHEMA_VERSION = SCHEMA_VERSION;
})();
