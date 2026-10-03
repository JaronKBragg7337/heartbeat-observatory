// ============================================================================
// ships/registry.js - the fleet: every ship type the game knows, looked up by the `type` field a ship carries.
//
// OWNS: the table of ship definitions and the one question "what is this ship's definition?". A ship's type is DATA (a string on its
// record, held by the server, saved with the world); no code outside a definition names a particular ship.
// DOES NOT OWN: the numbers of any ship (src/ships/<type>/), how a ship is drawn (src/ships/visuals.js, kept apart so the server
// never loads a renderer), or who owns which hull (server/authority.mjs).
//
// To add a class: write src/ships/<type>/def.js (default export) and src/ships/<type>/visuals.js (default export), then run
// `node tools/gen-registry.mjs`. Nothing else changes: this file does not name any ship. Guide: docs/ADD-A-SHIP.md.
// ============================================================================

import { SHIP_DEFS } from './_manifest.js';
import { validateShipDef, catalogRow } from './_kit/schema.js';

export const DEFAULT_SHIP_TYPE = 'meridian';

for (const d of SHIP_DEFS) { const bad = validateShipDef(d); if (bad.length) throw new Error(`ship '${d && d.type}' is not valid: ${bad.join('; ')}`); }
{ const seen = new Set(); for (const d of SHIP_DEFS) { if (seen.has(d.type)) throw new Error(`ship type '${d.type}' is registered twice`); seen.add(d.type); } }

// `order` (a def's own number; default 1000) fixes the order lists are shown in, so adding a ship never reshuffles the others.
const DEFS = new Map([...SHIP_DEFS].sort((a, b) => (a.order ?? 1000) - (b.order ?? 1000) || (a.type < b.type ? -1 : 1)).map((d) => [d.type, d]));

/** The definition for a ship type. An unknown type throws: a record naming a ship the build does not have is a bug, not a Meridian. */
export function shipDef(type) {
  const d = DEFS.get(type || DEFAULT_SHIP_TYPE);
  if (!d) throw new Error(`Unknown ship type: ${type}`);
  return d;
}
export const hasShipType = (type) => DEFS.has(type);
export const shipTypes = () => [...DEFS.keys()];
export const allShipDefs = () => [...DEFS.values()];
/** What a shipyard card prints for every ship (name, class, role, blurb, description, thumbnail, price, stats, specs). In `order`. */
export const shipCatalog = () => allShipDefs().map(catalogRow);
