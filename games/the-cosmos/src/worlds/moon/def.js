// ============================================================================
// worlds/moon/def.js - PLACEHOLDER. The Moon, going round the Earth on its real orbit (mean elements from Meeus, "Astronomical
// Algorithms": a 384,399 km, e 0.0549, inclination 5.145 deg to the ecliptic, mean longitude 218.3165 deg at J2000 advancing 481,267.88
// deg per century; node and perigee regress at -1,934.14 and +4,069.01 deg per century). Typed from the published values: re-confirm by
// hand (docs/PROVENANCE.md). Listed in the nav since F3 (the long-range drive holds off it); to build it, replace this file with a full def and keep the `orbit`.
// ============================================================================

export default {
  id: 'moon', name: 'Moon', kind: 'moon', placeholder: true, order: 103,
  navName: 'The Moon',
  blurb: 'Fortis and Technos Prime. The long-range drive reaches it in days; the ground is not built yet, so she holds off.',
  radiusMean: 1_737_400,                 // published mean radius: lets the long-range drive pick its drop-out distance
  orbit: { parent: 'earth', frame: 'ecliptic', a: 384_399_000, e: 0.0549, i: 5.145, meanLon: 218.3164477, lonPeri: 83.3532465, node: 125.0445479,
    rates: { a: 0, e: 0, i: 0, meanLon: 481267.88123421, lonPeri: 4069.0137287, node: -1934.1362891 } },
};
