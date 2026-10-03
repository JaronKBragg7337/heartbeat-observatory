// How the Wayfarer courier is drawn (the registry's visuals manifest picks this up; see docs/ADD-A-SHIP.md).
import { buildCourierExterior, courierNeutral } from './exterior.js';

export default {
  buildExterior: buildCourierExterior, applyNeutralPose: courierNeutral, decalTexture: () => null,
  custom: { dress: () => {} }, shield: { scale: [5, 4, 13], pos: [0, 1, 0] },
};
