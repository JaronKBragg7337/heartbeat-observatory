// ============================================================================
// ships/visuals.js - how each ship type is drawn, kept apart from its data so the server (which has no renderer) imports the
// registry and never this. One entry per ship type: the exterior builder, the neutral pose the ship is measured in, the decal, the
// shield envelope, and any dressing of its own for the interior builder.
// ============================================================================

import { buildExterior, applyNeutralPose, decalCanvasTexture } from '../ship/shipExterior.js';
import { buildRaiderExterior, applyRaiderNeutralPose, raiderDecalTexture } from './raider/exterior.js';
import { RAIDER_CUSTOM } from './raider/interior.js';

const VISUALS = {
  meridian: {
    buildExterior, applyNeutralPose,
    decalTexture: (THREE_) => decalCanvasTexture(THREE_),
    custom: null,
    shield: { scale: [15.5, 10.5, 28], pos: [0, 3.2, 0.5] },
  },
  raider: {
    buildExterior: buildRaiderExterior, applyNeutralPose: applyRaiderNeutralPose,
    decalTexture: (THREE_, def, name, registry) => raiderDecalTexture(THREE_, def, name, registry),
    custom: RAIDER_CUSTOM,
    shield: { scale: [6.8, 4.6, 18.5], pos: [0, 1.3, -0.5] },
  },
};

export function visualsFor(type) {
  const v = VISUALS[type];
  if (!v) throw new Error(`No visuals for ship type: ${type}`);
  return v;
}
