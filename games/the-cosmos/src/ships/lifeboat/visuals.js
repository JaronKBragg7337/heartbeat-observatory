// How the Skiff lifeboat is drawn (the registry's visuals manifest picks this up; see docs/ADD-A-SHIP.md).
import { buildLifeboatExterior, lifeboatNeutral } from './exterior.js';
import { LIFEBOAT_CUSTOM } from './interior.js';
import { paintNameTexture } from '../_liner/hullShell.js';
import { lineMark } from '../_liner/livery.js';

export default {
  buildExterior: buildLifeboatExterior, applyNeutralPose: lifeboatNeutral,
  decalTexture: (THREE_, def, name = 'SKIFF 7', registry = 'COS-MARS-VEH-0484') => paintNameTexture(THREE_, lineMark(name, registry).name, lineMark(name, registry).registry, { ink: '#2a2f36', size: 170 }),
  custom: LIFEBOAT_CUSTOM, shield: { scale: [3.4, 2.6, 7.2], pos: [0, 0.9, 0] },
};
