// How the Kestrel descent transport is drawn (the registry's visuals manifest picks this up; see docs/ADD-A-SHIP.md).
import { buildDescenderExterior, descenderNeutral } from './exterior.js';
import { DESCENDER_CUSTOM } from './interior.js';
import { paintNameTexture } from '../_liner/hullShell.js';
import { lineMark } from '../_liner/livery.js';

export default {
  buildExterior: buildDescenderExterior, applyNeutralPose: descenderNeutral,
  decalTexture: (THREE_, def, name = 'KESTREL', registry = 'COS-MARS-VEH-0481') => paintNameTexture(THREE_, lineMark(name, registry).name, lineMark(name, registry).registry, { ink: '#20242a' }),
  custom: DESCENDER_CUSTOM, shield: { scale: [13, 8, 36], pos: [0, 1.5, 0] },
};
