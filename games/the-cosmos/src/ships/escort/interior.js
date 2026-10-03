// ============================================================================
// ships/escort/interior.js - the cutter's dressing (see ships/_liner/dress.js for the generic dresser) plus the armoury's own: a charge rack
// light, hazard edging, a sign bar. Thin pieces: the walkable geometry is the layout, not these meshes.
// ============================================================================

import { dressGeneric } from '../_liner/dress.js';

export function dressEscortRoom(k, layout, r, rnd, out, low) {
  dressGeneric(k, layout, r, out, { doorW: 2.8, doorH: 2.8 });
  if (r.id === 'armoury') {
    const yF = r.y;
    k.box('glowRed', r.x0 + 0.012, yF + 2.2, -3.5, 0.006, 0.1, 1.2);
    k.box('hazard', r.x1 - 0.012, yF + 0.2, -3.5, 0.006, 0.1, 5.0);
  }
}
export const ESCORT_CUSTOM = { dress: dressEscortRoom };
