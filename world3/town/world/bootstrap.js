/* ============================================================================
   world/bootstrap.js — one composition, two hosts
   ---------------------------------------------------------------------------
   The single place where sim/, world/ and a built town meet. Both hosts run
   the same path:

     tools/slice.js   headless, asserts every link of the chain
     render/main.js   the browser boot, catching up elapsed days on load

   The host supplies:
     storage   anything with getItem/setItem (localStorage, a Map shim)
     adapter   plain-data views of the built town: houseHomes(),
               businessAddress(), freeLots(), houseTypes(), bedsByType();
               OPTIONAL (D14): buildingByKey(key) — the founding building id
               for a town key ("store", "diner", "townHall"). When absent,
               the utilities fall back to the business address, so an older
               host (render/main.js unchanged) still founds a working town.
               OPTIONAL (D15): foundingRecords() — the founding plat as
               records [{ id, key, lot: { block, index } }], captured once so
               every founding building has identity-seeded world records too.
               When absent, the world keeps positional founding identity and
               everything else works exactly as before.
               OPTIONAL (D15): onGrowthCommitted(record, { day, records }) —
               fired once per building committed by a LIVE session day (never
               during load-time catch-up replay, which rebuilds the whole town
               anyway). This is the render layer's hook to spawn meshes
               without a reload; an older host simply never implements it.
     tryBuild  rebuild the town with candidate records and report what the
               town's OWN validators said: { ok, errors, bedsById }

   Growth commits only through tryBuild success — there is no code path that
   places a building without validating it, load-time catch-up and live
   mid-session days alike: both run the SAME stepWorldDay below.
   ========================================================================== */
(function () {
"use strict";
const ASH = (globalThis.ASH = globalThis.ASH || {});

/* Load or found the world doc, capture the founding plat (D15), restore or
   found the sim. Shared by bootWorld (load + catch-up) and worldSession
   (one live day at a time). nowMs is only needed when founding. */
function openState({ storage, seed, townSeed, nowMs, genesisMs, adapter }, out) {
  let doc = ASH.worldLoad(storage);
  if (!doc) {
    /* genesisMs is optional and defaults to nowMs, which is what a single
       player wants: the world is born the moment they first open it. A SHARED
       world must pass an explicit genesisMs, because a genesis derived from
       first-load gives every player a different world birthday, a different
       day count and therefore a different population. */
    const born = Number.isFinite(genesisMs) ? genesisMs : nowMs;
    if (!Number.isFinite(born))
      throw new Error("founding a new world requires nowMs or genesisMs (genesis timestamp)");
    doc = ASH.worldCreate({
      seed, townSeed,
      foundingCount: adapter.foundingCount(),
      genesisMs: born,
    });
    out.dirty = true;
  }

  /* restore or found the simulation */
  let sim;
  if (doc.simSnapshot) {
    try { sim = ASH.AshgroveSim.restore(doc.simSnapshot); }
    catch (e) {
      out.errors.push(`sim snapshot rejected: ${e.message} — founding afresh`);
      sim = null;
    }
  }
  if (!sim) {
    /* D14: utility addresses are measured by the host. Prefer the optional
       buildingByKey lookup; fall back to the business address so the current
       browser adapter keeps working unmodified. */
    const byKey = (k) => {
      const id = typeof adapter.buildingByKey === "function" ? adapter.buildingByKey(k) : null;
      return id || adapter.businessAddress();
    };
    sim = ASH.AshgroveSim.create({
      seed: doc.seed,
      homes: adapter.houseHomes(),
      houseIds: Object.keys(adapter.houseHomes()),
      businessAddress: adapter.businessAddress(),
      utilityAddresses: { store: byKey("store"), diner: byKey("diner"), townHall: byKey("townHall") },
    });
    out.dirty = true;
  }

  /* D15: the founding 49 become records with identity-derived seeds, exactly
     like growth (D8). Captured once, sorted by id — byte-identical no matter
     what order the host enumerated the buildings in. Pre-D15 saves backfill
     here. A re-measured plat that disagrees with the capture is DRIFT: the
     positional seeding moved the town's identity, and the log says so. */
  if (typeof adapter.foundingRecords === "function") {
    const measured = ASH.normalizeFounding(adapter.foundingRecords());
    if (!doc.founding.length && measured.length) {
      ASH.worldFounding(doc, measured);
      ASH.worldLog(doc, sim.state.day, "founding-captured",
                   `${measured.length} founding buildings recorded with identity seeds`);
      out.dirty = true;
    } else if (measured.length &&
               JSON.stringify(measured) !== JSON.stringify(doc.founding)) {
      ASH.worldLog(doc, sim.state.day, "founding-drift",
                   "re-measured founding plat differs from the captured records — positional identity moved");
      out.dirty = true;
    }
  }

  return { doc, sim };
}

/* ONE world day: advance the sim, drain the event queue (handling an event
   can emit further events), route growth requests to lot choice, and gate
   every commit through the town's own validators. Used by load-time catch-up
   (onCommit null) and by live mid-session days (onCommit fires once per
   committed record) — the labor gating lives in engine step 3, so both paths
   build at the economy's pace identically. */
function stepWorldDay({ doc, sim, adapter, tryBuild, out, onCommit }) {
  const usedLots = () => doc.records.map((r) => `${r.lot.block}:${r.lot.index}`);
  const seq0 = sim.state.eventSeq;
  sim.advanceDay();
  let cursor = seq0;
  for (;;) {
    const fresh = sim.eventsSince(cursor);
    if (!fresh.length) break;
    cursor = fresh[fresh.length - 1].seq;
    for (const ev of fresh) {
    out.events.push(ev);

    if (ev.type === "growth-requested") {
      const choice = ASH.chooseGrowth({
        freeLots: adapter.freeLots(),
        usedLots: usedLots(),
        houseTypes: adapter.houseTypes(),
        bedsByType: adapter.bedsByType(),
        needBeds: ev.data.needBeds,
        rng: ASH.stream(doc.seed, "growth", ev.seq),
      });
      if (!choice) {
        sim.cancelRequest(ev.data.householdId, "no free lot fits any house type");
        ASH.worldLog(doc, sim.state.day, "growth-unplaceable", "no free lot fits");
      } else {
        const record = { id: ASH.worldNextBuildingId(doc), key: choice.key, lot: choice.lot };
        sim.startConstruction(record, ev.data.householdId);
        ASH.worldLog(doc, sim.state.day, "construction-started",
                     `${record.id} ${record.key} at ${record.lot.block}:${record.lot.index}`);
      }
    }

    if (ev.type === "growth-complete") {
      const record = ev.data.record;
      /* the gate: rebuild the town WITH the candidate and believe its
         validators. Commit only what passes. */
      const probe = tryBuild(doc.records.concat([record]));
      if (probe.ok) {
        ASH.worldCommit(doc, record, sim.state.day, "validated by the town's own checks");
        sim.confirmGrowth(record, probe.bedsById[record.id] || 0);
        out.grew = true;
        if (onCommit) onCommit(record, sim.state.day);
      } else {
        sim.rejectGrowth(record, probe.errors.join("; "));
        ASH.worldLog(doc, sim.state.day, "growth-rejected", probe.errors.join("; "));
      }
      out.dirty = true;
    }
    }
  }
}

/* A live world session: the same composition as bootWorld, but the days are
   stepped BY THE HOST, one at a time, while the world is being watched (D15).
   advanceDay() commits growth mid-session with the same validation gate and
   the same labor gating as catch-up, fires the optional
   adapter.onGrowthCommitted once per committed record, and persists the world
   (records + change log + digest-verified sim snapshot) after every day. */
function makeSession({ storage, doc, sim, adapter, tryBuild }) {
  return {
    doc, sim,
    records: () => doc.records.slice(),
    advanceDay() {
      const out = { events: [], grew: false, dirty: false };
      const committed = [];
      stepWorldDay({
        doc, sim, adapter, tryBuild, out,
        onCommit: (record, day) => {
          committed.push(record);
          if (typeof adapter.onGrowthCommitted === "function")
            adapter.onGrowthCommitted(record, { day, records: doc.records.slice() });
        },
      });
      doc.simSnapshot = sim.snapshot();
      ASH.worldSave(storage, doc);
      return { day: sim.state.day, events: out.events, committed, grew: out.grew };
    },
  };
}

/* Open a session on the persisted world: load the doc, restore the sim from
   its digest-verified snapshot (or found both when storage is empty — nowMs
   required then), and hand back the live day-stepper. No catch-up is owed or
   run here; bootWorld owns the unobserved days (O3, D7). */
ASH.worldSession = function ({ storage, seed, townSeed, nowMs, genesisMs, adapter, tryBuild }) {
  const out = { events: [], errors: [], dirty: false, grew: false };
  const { doc, sim } = openState({ storage, seed, townSeed, nowMs, genesisMs, adapter }, out);
  /* persist immediately: a founding (or a D15 founding capture) must survive
     even if the host never steps a day this session */
  doc.simSnapshot = sim.snapshot();
  ASH.worldSave(storage, doc);
  const session = makeSession({ storage, doc, sim, adapter, tryBuild });
  session.errors = out.errors;
  return session;
};

ASH.bootWorld = function ({ storage, seed, townSeed, nowMs, genesisMs, adapter, tryBuild }) {
  const out = { records: [], grew: false, dirty: false, days: 0, events: [], errors: [] };

  const { doc, sim } = openState({ storage, seed, townSeed, nowMs, genesisMs, adapter }, out);

  /* catch up the days the world lived while unwatched (sim/clock.js) */
  const days = ASH.catchupDays(doc.genesisMs, sim.state.day, nowMs);
  out.days = days;

  for (let d = 0; d < days; d++)
    stepWorldDay({ doc, sim, adapter, tryBuild, out, onCommit: null });

  doc.simSnapshot = sim.snapshot();
  ASH.worldSave(storage, doc);
  out.records = doc.records.slice();
  /* the live continuation of this boot: the host can keep stepping days
     mid-session without a reload (D15) */
  out.session = makeSession({ storage, doc, sim, adapter, tryBuild });
  return out;
};
})();
