// ============================================================================
// worlds/mercury/def.js - PLACEHOLDER. Mercury is placed where the real Solar System puts it (orbit from _kit/solar.js) and kept OUT of the nav
// list (`nav: false`) until it is built; nothing here can be landed on yet. To build it: replace this file with a full def (see
// docs/ADD-A-WORLD.md): keep `orbit: SOLAR.orbit.mercury`, add the body (radius, mass, ground or gas) and its pad.
// ============================================================================
import { SOLAR } from '../_kit/solar.js';

export default {
  id: 'mercury', name: 'Mercury', kind: 'planet', placeholder: true, nav: false, order: 100,
  blurb: 'A world of this Solar System, not built yet. Needs a jump drive the Meridian does not have.',
  orbit: SOLAR.orbit.mercury,
};
