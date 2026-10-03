// How the Line Marshal escort cutter is drawn (the registry's visuals manifest picks this up; see docs/ADD-A-SHIP.md).
import { buildEscortExterior, escortNeutral } from './exterior.js';
import { ESCORT_CUSTOM } from './interior.js';
import { paintNameTexture } from '../_liner/hullShell.js';
import { lineMark } from '../_liner/livery.js';

export default {
  buildExterior: buildEscortExterior, applyNeutralPose: escortNeutral,
  decalTexture: (THREE_, def, name = 'LINE MARSHAL', registry = 'COS-MARS-VEH-0483') => paintNameTexture(THREE_, lineMark(name, registry).name, lineMark(name, registry).registry, { ink: '#20242a', size: 160, stripe: '#d3ad63' }),
  custom: ESCORT_CUSTOM, shield: { scale: [9, 4.5, 24], pos: [0, 1, 0] },
};
