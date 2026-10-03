// ============================================================================
// worlds/venus/def.js - PLACEHOLDER. Venus is placed where the real Solar System puts it (orbit from _kit/solar.js) and kept OUT of the nav
// list (`nav: false`) until it is built; nothing here can be landed on yet. To build it: replace this file with a full def (see
// docs/ADD-A-WORLD.md): keep `orbit: SOLAR.orbit.venus`, add the body (radius, mass, ground or gas) and its pad.
// ============================================================================
import { SOLAR } from '../_kit/solar.js';

export default {
  id: 'venus', name: 'Venus', kind: 'planet', placeholder: true, nav: false, order: 101,
  blurb: 'A world of this Solar System, not built yet. Needs a jump drive the Meridian does not have.',
  orbit: SOLAR.orbit.venus,
};
