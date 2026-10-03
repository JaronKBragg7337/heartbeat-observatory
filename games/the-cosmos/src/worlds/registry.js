// ============================================================================
// worlds/registry.js - every world The Cosmos knows, looked up by id. A world is DATA: a def in src/worlds/<name>/def.js.
//
// OWNS: the table of world definitions, validated at load; the questions "which worlds are there / which can be landed on / what is
//   the root"; the numbering of any new ground materials.
// DOES NOT OWN: the numbers of any world (its own folder), how a ground is shaped (src/space/moonField.js + _kit/terrain.js),
//   how it is drawn (src/space/moonWorld.js), the course to it (src/space/spaceSystem.js builds its nav row from this).
//
// To add a world: write src/worlds/<name>/def.js (default export), run `node tools/gen-registry.mjs`, done. The manifest it writes
// (./_manifest.js) is one import line per folder, merged with git's union driver, so two builders adding worlds do not conflict.
// Full guide: docs/ADD-A-WORLD.md. No browser build step exists, which is why the manifest is a file and not a directory scan.
// ============================================================================

import { WORLD_DEFS } from './_manifest.js';
import { validateWorldDef } from './_kit/schema.js';
import { PROFILES } from './_kit/terrain.js';
import { centreAt, placementOf, rotationAngle } from './_kit/ephemeris.js';
import { MATERIALS, extendMaterials } from '../world/field.js';

const DEFS = new Map();
const matKey = (id) => id.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());

/**
 * Add a world. Throws (with every problem listed) if the def is incomplete. `replace: true` swaps an existing id (used when a
 * placeholder like Fortis becomes a real world, and by tests).
 */
export function registerWorld(def, { replace = false } = {}) {
  const bad = validateWorldDef(def);
  if (bad.length) throw new Error(`world '${def && def.id}' is not valid:\n  - ${bad.join('\n  - ')}`);
  if (DEFS.has(def.id) && !replace) throw new Error(`world '${def.id}' is registered twice (two folders with the same id?)`);
  // the legacy shorthand (orbitRadiusM + lonS [+ latS] + orbitPeriodS: parked in Mars's equatorial plane) becomes an `orbit`, so there is one model
  if (!def.root && !def.placeholder && def.orbit === undefined && def.orbitRadiusM !== undefined) {
    def.orbit = { parent: 'mars', frame: 'equator', a: def.orbitRadiusM, e: 0, i: 0, node: 0, peri: 0, M0: def.lonS, periodS: def.orbitPeriodS, parked: true, ...(def.latS ? { parkedLatDeg: def.latS } : {}) };
  }
  if (def.kind === 'moon' && !def.rotation && def.orbit && def.orbit.periodS) def.rotation = { lockedTo: 'parent', periodS: def.orbit.periodS, axialTiltDeg: 0 };       // a moon keeps one face to its planet
  if (!def.root && !def.placeholder && !def.axes && def.radiusM) def.axes = { a: def.radiusM, b: def.radiusM, c: def.radiusM };        // a sphere is a triaxial body with equal axes
  if (!def.root && !def.placeholder && !def.radiusMean && def.axes) def.radiusMean = (def.axes.a + def.axes.b + def.axes.c) / 3;
  DEFS.set(def.id, def);
  return def;
}

const listeners = new Set();
/** Tell me when a world is registered after load (spaceSpec's tables and free flight's bodies rebuild themselves). Returns an unsubscribe. */
export function onWorldsChanged(fn) { listeners.add(fn); return () => listeners.delete(fn); }

/** Append a world's materials to the global table (once; the table only grows at its end). */
function addMaterials(def) {
  if (!def.materials) return;
  for (const [role, m] of Object.entries(def.materials)) {
    if (typeof m === 'string') { if (!MATERIALS[m]) throw new Error(`world '${def.id}': materials.${role} names '${m}', which is not in MATERIALS`); continue; }
    extendMaterials(`${matKey(def.id)}${role[0].toUpperCase()}${role.slice(1)}`, m);
  }
}

// The manifest's worlds, registered in `order` (then id); materials are numbered in worldIndex order so the numbers never depend on
// folder names. Mars, Phobos and Deimos keep the materials field.js already holds (no `materials` object on them).
for (const d of [...WORLD_DEFS].sort((a, b) => (a.order ?? 100) - (b.order ?? 100) || (a.id < b.id ? -1 : 1))) registerWorld(d);
{
  const seen = new Map();
  for (const d of [...DEFS.values()].filter((q) => q.materials && Object.values(q.materials).some((m) => typeof m === 'object')).sort((a, b) => a.worldIndex - b.worldIndex)) {
    if (seen.has(d.worldIndex)) throw new Error(`worlds '${seen.get(d.worldIndex)}' and '${d.id}' both use worldIndex ${d.worldIndex}: renumber one (take the next free number)`);
    seen.set(d.worldIndex, d.id);
    addMaterials(d);
  }
}
/** A world registered after load (tests, a dev tool): its materials are appended after everything already numbered. */
export function registerWorldLate(def, opts) { const d = registerWorld(def, opts); addMaterials(d); for (const fn of listeners) fn(d); return d; }

/** Remove a world registered late (a test's fixture). Never used on a manifest world. Its materials stay in the table: the table only grows. */
export function unregisterWorld(id) { const had = DEFS.delete(id); if (had) for (const fn of listeners) fn(null); return had; }

/** Where a world's centre is, in the game's axes, relative to Mars's centre, at game time t (t is ignored until DYNAMICS.orbits is switched on: _kit/ephemeris.js). */
export const worldCentre = (id, t = 0) => centreAt(worldDef(id), worldDef, t);
/** The epoch placement as seen from Mars: { centre, distM, lonS, latS }. */
export const worldPlacement = (id, t = 0) => placementOf(worldDef(id), worldDef, t);
export const worldRotation = (id, t = 0) => rotationAngle(worldDef(id), t);

export const worldDef = (id) => { const d = DEFS.get(id); if (!d) throw new Error(`unknown world: ${id}`); return d; };
export const hasWorld = (id) => DEFS.has(id);
export const allWorlds = () => [...DEFS.values()].sort((a, b) => (a.order ?? 100) - (b.order ?? 100) || (a.id < b.id ? -1 : 1));
/** The one world whose frame is the root (Mars). */
export const rootWorld = () => allWorlds().find((d) => d.root);
/** A world with a frame of its own that can be landed on: every moon and planet that is not a placeholder, not Mars, not a gas giant. */
export const isFrameWorld = (d) => !d.root && !d.placeholder && ['planet', 'moon', 'dwarf', 'asteroid'].includes(d.kind) && PROFILES[(d.terrain && d.terrain.profile) || 'rocky'].landable;
export const frameWorlds = () => allWorlds().filter(isFrameWorld);
export const frameWorldIds = () => frameWorlds().map((d) => d.id);
/** Worlds listed in the nav but not yet built ("another system, needs a jump drive"). */
/** Stations: built places (Wanderhome, Corsair's Refuge, orbital yards), each placed by an orbit, with docks and no ground. */
export const stationWorlds = () => allWorlds().filter((d) => d.kind === 'station' && !d.placeholder);
export const placeholderWorlds = () => allWorlds().filter((d) => d.placeholder);
