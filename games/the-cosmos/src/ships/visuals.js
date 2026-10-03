// ============================================================================
// ships/visuals.js - how each ship type is drawn, kept apart from its data so the server (which has no renderer) imports the
// registry and never this. One entry per ship type: the exterior builder, the neutral pose the ship is measured in, the decal, the
// shield envelope, and any dressing of its own for the interior builder.
// ============================================================================

import { buildExterior, applyNeutralPose, decalCanvasTexture } from '../ship/shipExterior.js';
import { buildRaiderExterior, applyRaiderNeutralPose, raiderDecalTexture, applyRaiderInteriorPalette } from './raider/exterior.js';
import { RAIDER_CUSTOM } from './raider/interior.js';
import { buildCourierExterior, courierNeutral } from './courier/exterior.js';
import { buildHaulerExterior, haulerNeutral, haulerDecalTexture } from './hauler/exterior.js';
import { HAULER_CUSTOM } from './hauler/interior.js';

const VISUALS = {
  hauler: {buildExterior:buildHaulerExterior,applyNeutralPose:haulerNeutral,
    decalTexture:(THREE_,def,name,registry)=>haulerDecalTexture(THREE_,def,name,registry),
    custom:HAULER_CUSTOM,shield:{scale:[9.5,6.5,29],pos:[0,2.2,6.5]}},
  courier: {buildExterior:buildCourierExterior,applyNeutralPose:courierNeutral,decalTexture:()=>null,
    custom:{dress:()=>{}},shield:{scale:[5,4,13],pos:[0,1,0]}},
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
    interiorPalette: applyRaiderInteriorPalette,
    shield: { scale: [6.8, 4.6, 18.5], pos: [0, 1.3, -0.5] },
  },
};

export function visualsFor(type) {
  const v = VISUALS[type];
  if (!v) throw new Error(`No visuals for ship type: ${type}`);
  return v;
}
