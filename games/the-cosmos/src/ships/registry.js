// ============================================================================
// ships/registry.js - the fleet: every ship type the game knows, looked up by the `type` field a ship carries.
//
// OWNS: the table of ship definitions and the one question "what is this ship's definition?". A ship's type is DATA (a string on its
// record, held by the server, saved with the world); no code outside a definition names a particular ship.
// DOES NOT OWN: the numbers of any ship (src/ships/<type>/), how a ship is drawn (src/ships/visuals.js, kept apart so the server
// never loads a renderer), or who owns which hull (server/authority.mjs).
//
// To add a class: write src/ships/<type>/ (spec + def), add it below, add its visuals in visuals.js. Nothing else changes.
// ============================================================================

import { MERIDIAN } from './meridian/def.js';
import { RAIDER } from './raider/def.js';
import { COURIER } from './courier/def.js';
import { HAULER } from './hauler/def.js';

export const DEFAULT_SHIP_TYPE = 'meridian';

const DEFS = new Map([MERIDIAN, RAIDER, COURIER, HAULER].map((d) => [d.type, d]));

/** The definition for a ship type. An unknown type throws: a record naming a ship the build does not have is a bug, not a Meridian. */
export function shipDef(type) {
  const d = DEFS.get(type || DEFAULT_SHIP_TYPE);
  if (!d) throw new Error(`Unknown ship type: ${type}`);
  return d;
}
export const hasShipType = (type) => DEFS.has(type);
export const shipTypes = () => [...DEFS.keys()];
export const allShipDefs = () => [...DEFS.values()];
