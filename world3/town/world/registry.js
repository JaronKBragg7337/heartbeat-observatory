/* ============================================================================
   world/registry.js — the world state: seed + records + change log
   ---------------------------------------------------------------------------
   The persistence model from this directory's README, made real:

     seed + founding count            reproduces the founding town exactly
     + growth building records        id, house type, lot — never geometry
     + change log                     append-only: what happened, when
     + sim snapshot                   the living state, digest-verified
     = the world

   Nothing here is a mesh, a vertex, or a chunk. Storage is injected (the
   browser passes localStorage; the headless harness passes a Map) so world/
   never depends on a frame loop or the DOM.
   ========================================================================== */
(function () {
"use strict";
const ASH = (globalThis.ASH = globalThis.ASH || {});

const STORAGE_KEY = "ashgrove-world-v1";

ASH.worldCreate = function ({ seed, townSeed, foundingCount, genesisMs }) {
  return {
    version: 1,
    seed,                        // sim seed — the founding scenario's stream root
    townSeed,                    // town seed — reproduces the founding geometry
    foundingCount,               // founding buildings (B01..B49 today)
    genesisMs,                   // the world's clock starts here (sim/clock.js)
    founding: [],                // D15: founding records { id, key, lot } — captured once
    records: [],                 // committed growth buildings
    log: [],                     // append-only change log
    simSnapshot: null,           // digest-verified sim state
  };
};

ASH.worldLoad = function (storage) {
  try {
    const raw = storage && storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const doc = JSON.parse(raw);
    if (!doc || doc.version !== 1) return null;
    if (!Array.isArray(doc.founding)) doc.founding = [];   // pre-D15 saves backfill on next boot
    return doc;
  } catch (e) { return null; }
};

ASH.worldSave = function (storage, doc) {
  if (!storage) return;
  storage.setItem(STORAGE_KEY, JSON.stringify(doc));
};

/* The next building id in the town's own spatial namespace (B50, B51…).
   Founding buildings keep their positional ids; growth continues the
   sequence, so an id never collides and never re-issues. */
ASH.worldNextBuildingId = function (doc) {
  const n = doc.foundingCount + doc.records.length + 1;
  return `B${String(n).padStart(2, "0")}`;
};

/* Commit ONLY happens after the town's own validators have passed on the
   candidate. There is no other path that adds a record. */
ASH.worldCommit = function (doc, record, day, note) {
  doc.records.push(record);
  doc.log.push({ day, type: "building-committed", record, note: note || "" });
  return record;
};

ASH.worldLog = function (doc, day, type, note) {
  doc.log.push({ day, type, note });
};

/* ------------------------------------------------------------ D15 -------
   Stable identity for EVERY building, founding included.

   buildingSeed(townSeed, id) is the identity-derived numeric seed — FNV-1a
   of "townSeed|id", byte-identical to render/town.js idSeed (same offset,
   same prime, same non-zero fallback) — now defined for the founding 49
   exactly as D8 defined it for growth. A building draws from WHO it is,
   never from where in any iteration order it happened to appear.

   worldFounding captures the founding plat as RECORDS ({ id, key, lot }),
   sorted by id so the capture is byte-identical no matter what order the
   host enumerated the buildings in. First capture is authoritative: a
   re-measured plat that differs is drift (logged by the bootstrap), never
   a silent rewrite. */
ASH.buildingSeed = function (townSeed, id) {
  const str = `${townSeed || 1337}|${id}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0) || 88675123;
};

ASH.normalizeFounding = function (records) {
  const out = (records || []).map((r) => ({
    id: r.id, key: r.key,
    lot: { block: r.lot.block, index: r.lot.index },
  }));
  out.sort((a, b) => a.id.localeCompare(b.id));
  return out;
};

ASH.worldFounding = function (doc, records) {
  if (doc.founding && doc.founding.length) return doc.founding;   // authoritative
  doc.founding = ASH.normalizeFounding(records);
  return doc.founding;
};

/* The town's full identity list, in canonical order: the founding plat by
   id, then growth in commit order. Each entry carries its identity seed, so
   a host can seed every building from identity without knowing the hash. */
ASH.worldIdentities = function (doc) {
  const out = [];
  for (const r of doc.founding || [])
    out.push({ id: r.id, key: r.key, lot: r.lot, growth: false, seed: ASH.buildingSeed(doc.townSeed, r.id) });
  for (const r of doc.records || [])
    out.push({ id: r.id, key: r.key, lot: r.lot, growth: true, seed: ASH.buildingSeed(doc.townSeed, r.id) });
  return out;
};
})();
