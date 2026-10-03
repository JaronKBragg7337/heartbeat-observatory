// ============================================================================
// ships/visuals.js - how each ship type is drawn, kept apart from its data so the server (which has no renderer) imports the
// registry and never this. One entry per ship type, from src/ships/<type>/visuals.js (listed in the generated
// ./_visuals-manifest.js): the exterior builder, the neutral pose the ship is measured in, the decal, the shield envelope, and any
// dressing of its own for the interior builder. This file names no ship. Guide: docs/ADD-A-SHIP.md.
// ============================================================================

import { SHIP_VISUALS } from './_visuals-manifest.js';

export function visualsFor(type) {
  const v = SHIP_VISUALS[type];
  if (!v) throw new Error(`No visuals for ship type: ${type}`);
  return v;
}
export const hasVisuals = (type) => !!SHIP_VISUALS[type];
