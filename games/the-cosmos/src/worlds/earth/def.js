// ============================================================================
// worlds/earth/def.js - PLACEHOLDER. Earth is placed where the real Solar System puts it (orbit from _kit/solar.js) and, since F3, LISTED in the nav as a long-range
// destination (the ship holds off it: `kind: 'deep'`); nothing here can be landed on yet. To build it: replace this file with a full def (see
// docs/ADD-A-WORLD.md): keep `orbit: SOLAR.orbit.earth`, add the body (radius, mass, ground or gas) and its pad.
// ============================================================================
import { SOLAR } from '../_kit/solar.js';

export default {
  id: 'earth', name: 'Earth', kind: 'planet', placeholder: true, order: 102,
    blurb: "Home. The long-range drive takes a small ship there in days; the ground is not built yet, so she holds off the planet.",
  radiusMean: 6_371_000,                 // published mean radius: lets the long-range drive pick its drop-out distance (src/space/longRange.js)
  orbit: SOLAR.orbit.earth,
};
