// How the Ares transport is drawn (the registry's visuals manifest picks this up; see docs/ADD-A-SHIP.md).
import { buildTransportExterior, transportNeutral } from './exterior.js';
import { TRANSPORT_CUSTOM } from './interior.js';
import { paintNameTexture } from '../_liner/hullShell.js';
import { lineMark } from '../_liner/livery.js';

export default {
  buildExterior: buildTransportExterior, applyNeutralPose: transportNeutral,
  decalTexture: (THREE_, def, name = 'HELLAS DAWN', registry = 'COS-MARS-VEH-0480') => paintNameTexture(THREE_, lineMark(name, registry).name, lineMark(name, registry).registry, { ink: '#20242a', stripe: '#b5694a' }),
  custom: TRANSPORT_CUSTOM, shield: { scale: [16, 12, 66], pos: [0, 1.5, 0] },
};
