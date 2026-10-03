// ============================================================================
// ships/_liner/livery.js - the line's paint, read from F0's faction style sheet (src/factions/registry.js). The Mars Line is neutral, so the
// transports, the bulker and the escort wear the `mars` livery (hull 0xd8d2c4, belly, a rust band with a thin cyan line); the escort wears the
// second hull colour (`hullAlt`). Nothing here types a colour: change the style sheet and the ships follow.
// Slot map (the same one F0's applyLiveryTint uses, so a later faction re-dress needs no change here): mats.hull = the plating, mats.hullDark =
// the belly, mats.hullAccent = style.accent (the thin line), mats.hullStripe = style.stripe.colors[0] (the wide band), engineGlow.
// ============================================================================

import { shipLivery, shipMark } from '../../factions/registry.js';

const rgb = (hex) => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];

/** { hull:[r,g,b], belly:[r,g,b], palette:{ dark, accent, stripe, engine }, livery } for a faction id. alt uses the second hull colour. */
export function linerLivery(id = 'mars', o = {}) {
  const v = shipLivery(id), hull = o.alt ? v.hullAlt : v.hull;
  return { id, hull: rgb(hull), belly: rgb(v.belly), hex: { hull, belly: v.belly }, palette: { dark: v.belly, accent: v.accent, stripe: v.stripe.colors[0], engine: v.engineGlow }, livery: v };
}

/** The mark a hull carries for a ship number: { registry: 'MR-0412', name: 'HELLAS DAWN' }. A COS- registry id is turned into the line's own mark. */
export function lineMark(name, registryId, id = 'mars') {
  const n = /^COS-/.test(registryId || '') ? Number(String(registryId).slice(-4)) : Number(String(registryId || '').replace(/\D/g, '')) || 1;
  return shipMark(id, n, name);
}
