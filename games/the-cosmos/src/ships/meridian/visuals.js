// How the Meridian is drawn (the registry's visuals manifest picks this up; see docs/ADD-A-SHIP.md).
import { buildExterior, applyNeutralPose, decalCanvasTexture } from '../../ship/shipExterior.js';

export default {
  buildExterior, applyNeutralPose,
  decalTexture: (THREE_) => decalCanvasTexture(THREE_),
  custom: null,
  shield: { scale: [15.5, 10.5, 28], pos: [0, 3.2, 0.5] },
};
