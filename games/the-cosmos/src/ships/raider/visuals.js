// How the Raider is drawn (the registry's visuals manifest picks this up; see docs/ADD-A-SHIP.md).
import { buildRaiderExterior, applyRaiderNeutralPose, raiderDecalTexture, applyRaiderInteriorPalette } from './exterior.js';
import { RAIDER_CUSTOM } from './interior.js';

export default {
  buildExterior: buildRaiderExterior, applyNeutralPose: applyRaiderNeutralPose,
  decalTexture: (THREE_, def, name, registry) => raiderDecalTexture(THREE_, def, name, registry),
  custom: RAIDER_CUSTOM,
  interiorPalette: applyRaiderInteriorPalette,
  shield: { scale: [6.8, 4.6, 18.5], pos: [0, 1.3, -0.5] },
};
