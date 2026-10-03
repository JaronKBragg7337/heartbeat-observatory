// ============================================================================
// worlds/phobos/def.js - Phobos, the inner moon of Mars. Moved here unchanged from src/space/spaceSpec.js (its MOONS row) and
// src/space/moonField.js (its rocks, named rocks, albedo units and materials, which used to be `if (id === 'phobos')`).
//
// HONEST SIMPLIFICATIONS (stated, not hidden)
//   * Mars does not spin in this build (everything is in Mars's body-fixed frame), so the moons do not orbit: each is parked
//     over a fixed spot of the sky at its real distance from Mars's centre. Phobos is tidally locked, so its real face
//     toward Mars is the face you see here; what is missing is its 2.1 km/s of orbital motion.
// ============================================================================

export default {
  id: 'phobos', name: 'Phobos', designation: 'SOL-4-I', kind: 'moon', order: 10, worldIndex: 1,
  showFromStart: true,                               // built a moment after the game opens: it hangs in the port's sky from the start
  blurb: 'Land at the Stickney East survey pad. Low gravity, you can dig.',
  // Semi-axes, metres: NSSDC Mars satellite table 13.0 x 11.4 x 9.1 km (live fetch 2026-10-01); NASA states 27 x 22 x 18 km across.
  axes: { a: 13_030, b: 11_400, c: 9_140 },          // a points at Mars, b along the orbit, c along the spin axis
  radiusMean: 11_266.7,                              // NSSDC mean radius
  massKg: 1.0659e16,                                 // NSSDC table value
  orbitRadiusM: 9_376_000,                           // semi-major axis, centre of Mars to centre of Phobos
  orbitPeriodS: 0.31891 * 86400,
  lonS: -109,                                        // where it is parked: low over the spawn's sky (19 degrees up), and on the sunlit side so the pad is in daylight
  seed: 61,
  regolithDepthM: 70,
  craterScale: 1.0,
  roughScale: 1.0,
  craterDensity: 0.62,                               // share of crater cells that hold a crater
  cellScale: 1.0,                                    // crater cell sizes (the biggest crater is a quarter of its cell)
  landmarks: [
    // Stickney: the big crater, about 9 km across (NASA: ~9 km), near 1 N 49 W on the Mars-facing hemisphere's trailing side.
    { id: 'COS-PHB-LMK-0001', name: 'Stickney', lat: 1, lon: -49, radiusM: 4500, depthM: 1700, note: 'The largest crater, about 9 km across.' },
    { id: 'COS-PHB-LMK-0002', name: 'Limtoc', lat: 11, lon: -54, radiusM: 1000, depthM: 220, note: 'A 2 km crater on the rim of Stickney.' },
  ],
  // The landing zone and its three sample sites, in body latitude / longitude. The pad is graded flat (a plane under the ship).
  pad: { lat: -25, lon: -8, flatM: 62, blendM: 150, name: 'Stickney East survey pad' },
  // a drifting cargo module that came down on the moon: the distress beacon (jobs.js). Distance and bearing from the pad.
  derelict: { distM: 780, bearingDeg: 215 },

  // ---- the ground's own dressing (was in moonField.js under `S.id === 'phobos'`) ----
  materials: { regolith: 'phobosRegolith', rubble: 'phobosRubble', clay: 'phobosClay' },
  // Loose rock, in the density field. Phobos is rocky: boulders, rocks at knee height and stones underfoot.
  rocks: [
    { s: 48, dens: 0.6, rLo: 5, rHi: 11, hLo: 1.5, hHi: 3.4 },        // boulders: two to three metres tall and a dozen across, angular
    { s: 12, dens: 0.48, rLo: 1.8, rHi: 3.4, hLo: 0.45, hHi: 1.3 },   // rocks at knee and waist height
    { s: 6, dens: 0.3, rLo: 0.8, rHi: 1.5, hLo: 0.1, hHi: 0.42 },    // stones underfoot
  ],
  // Named rocks around the survey pad (east, north metres from the pad centre; rc footprint radius, h height).
  heroes: [
    { e: -47, n: 40, rc: 5.5, h: 2.7 }, { e: 54, n: 30, rc: 4.5, h: 2.2 }, { e: 24, n: -60, rc: 6.5, h: 3.2 }, { e: -62, n: -22, rc: 3.5, h: 1.6 },
    { e: 40, n: 54, rc: 2.6, h: 1.2 }, { e: -30, n: -50, rc: 2.2, h: 1.0 }, { e: 66, n: -34, rc: 1.8, h: 0.8 }, { e: -8, n: 66, rc: 2.8, h: 1.3 },
    { e: 34, n: 46, rc: 1.4, h: 0.6 }, { e: -52, n: 18, rc: 1.6, h: 0.7 },
  ],
  // Albedo units: k = k0 + kLo*lo + kMid*mid (brightness), red = r0 + rLo*lo + rMid*mid. Phobos has a redder, darker unit and a
  // bluer, brighter one (the ejecta around Stickney is the blue one), so from orbit it is not one grey.
  look: {
    k: [1, 0.2, 0.11], red: [0, 0.75, 0.35],
    ejecta: { k: 0.14, red: 0.95, centre: 1.4, width: 1.5 },           // the blue, bright ejecta blanket round the first landmark
    tint: { r: 0.92, g: 0.96 },
  },
  // How the ground is drawn (moonWorld.js): the colour lift, the regolith shader and its settings, per tier.
  render: { farColor: 1.3, tierColor: 1.38, roughness: 0.985, farRegolith: { kind: 'phobos', bump: 0.55 }, regolith: { kind: 'phobos', moon: true, bump: 0.95, pebble: 0.22 }, flatNear: true, across: true },
  sources: [
    { field: 'axes, radiusMean, orbit', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html', verified: 'live', note: 'fetched 2026-10-01' },
    { field: 'overall size, Stickney, regolith depth', url: 'https://science.nasa.gov/mars/moons/phobos/', verified: 'live', note: 'fetched 2026-10-01: 27x22x18 km (Phobos), 15x12x11 km (Deimos)' },
  ],
};
