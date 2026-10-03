// How the Long Haul bulk carrier is drawn (the registry's visuals manifest picks this up; see docs/ADD-A-SHIP.md).
import { buildBulkerExterior, bulkerNeutral } from './exterior.js';
import { BULKER_CUSTOM } from './interior.js';
import { paintNameTexture } from '../_liner/hullShell.js';
import { lineMark } from '../_liner/livery.js';

export default {
  buildExterior: buildBulkerExterior, applyNeutralPose: bulkerNeutral,
  decalTexture: (THREE_, def, name = 'LONG HAUL', registry = 'COS-MARS-VEH-0482') => paintNameTexture(THREE_, lineMark(name, registry).name, lineMark(name, registry).registry, { ink: '#20242a', size: 170 }),
  custom: BULKER_CUSTOM, shield: { scale: [18, 11, 126], pos: [0, 3, 0] },
};
