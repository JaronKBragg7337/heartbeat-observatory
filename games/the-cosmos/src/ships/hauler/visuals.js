// How the Drayman hauler is drawn (the registry's visuals manifest picks this up; see docs/ADD-A-SHIP.md).
import { buildHaulerExterior, haulerNeutral, haulerDecalTexture } from './exterior.js';
import { HAULER_CUSTOM } from './interior.js';

export default {
  buildExterior: buildHaulerExterior, applyNeutralPose: haulerNeutral,
  decalTexture: (THREE_, def, name, registry) => haulerDecalTexture(THREE_, def, name, registry),
  custom: HAULER_CUSTOM, shield: { scale: [9.5, 6.5, 29], pos: [0, 2.2, 6.5] },
};
