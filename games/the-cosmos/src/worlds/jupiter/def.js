// ============================================================================
// worlds/jupiter/def.js - PLACEHOLDER. Jupiter is placed where the real Solar System puts it (orbit from _kit/solar.js) and kept OUT of the nav
// list (`nav: false`) until it is built; nothing here can be landed on yet. To build it: replace this file with a full def (see
// docs/ADD-A-WORLD.md): keep `orbit: SOLAR.orbit.jupiter`, add the body (radius, mass, ground or gas) and its pad.
// ============================================================================
import { SOLAR } from '../_kit/solar.js';

export default {
  id: 'jupiter', name: 'Jupiter', kind: 'planet', placeholder: true, nav: false, order: 104,
  blurb: 'A world of this Solar System, not built yet. Needs a jump drive the Meridian does not have.',
  orbit: SOLAR.orbit.jupiter,
};
