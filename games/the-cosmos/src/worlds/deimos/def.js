// ============================================================================
// worlds/deimos/def.js - Deimos, the outer moon of Mars. Moved here unchanged from src/space/spaceSpec.js (its MOONS row) and
// src/space/moonField.js (its rocks, named rocks, albedo units and materials, which used to be the `else` of `id === 'phobos'`).
// Parked over a fixed spot of the sky, as Phobos is (see phobos/def.js).
// ============================================================================

export default {
  id: 'deimos', name: 'Deimos', designation: 'SOL-4-II', kind: 'moon', order: 20, worldIndex: 2,
  blurb: 'The outer moon. A smooth, deep-dust world.',
  axes: { a: 7_800, b: 6_000, c: 5_100 },            // NSSDC 7.8 x 6.0 x 5.1 km (NASA: 15 x 12 x 11 km across)
  radiusMean: 6_200,
  massKg: 1.4762e15,                                 // Jacobson and Lainey 2014; the NSSDC page still lists an older 2.4e15
  orbitRadiusM: 23_459_000,
  orbitPeriodS: 1.26244 * 86400,
  lonS: -89,
  seed: 83,
  regolithDepthM: 100,                               // NASA: regolith about 100 m deep, which is why Deimos looks smooth
  craterScale: 0.55,
  craterDensity: 0.3, cellScale: 0.5,
  roughScale: 0.3,                                   // the deep dust smooths everything below a few hundred metres
  landmarks: [{ id: 'COS-DMS-LMK-0001', name: 'Voltaire', lat: 20, lon: 5, radiusM: 950, depthM: 120, note: 'The largest crater, about 2 km across (NASA: 2.3 km).' }],
  pad: { lat: -20, lon: -49, flatM: 62, blendM: 150, name: 'Deimos survey pad' },

  materials: { regolith: 'deimosRegolith', rubble: 'deimosRubble' },
  // Deimos: a deep dust blanket with a few blocks sticking out of it and small stones on top. Low and soft, never a boulder field.
  rocks: [
    { s: 40, dens: 0.34, rLo: 4, rHi: 8, hLo: 0.7, hHi: 1.6 },
    { s: 9, dens: 0.2, rLo: 1.2, rHi: 2.6, hLo: 0.2, hHi: 0.55 },
    { s: 6, dens: 0.22, rLo: 0.7, rHi: 1.3, hLo: 0.08, hHi: 0.3 },
  ],
  heroes: [
    { e: -50, n: 34, rc: 7, h: 1.1 }, { e: 58, n: -26, rc: 5, h: 0.8 }, { e: 20, n: 62, rc: 2.8, h: 0.5 }, { e: -36, n: -56, rc: 2, h: 0.35 },
  ],
  // a dusty, low-contrast blanket: a little brighter and warmer than Phobos, with soft patches; Voltaire has a bright rim
  look: {
    k: [1.08, 0.08, 0.07], red: [0.35, 0.25, 0.2],
    rim: { k: 0.12, edge: 1.15, width: 0.25 },
    desaturate: 0.3,                                 // a pale dust, less orange than its material
  },
  render: { farColor: 1.18, tierColor: 1.22, roughness: 0.97, farRegolith: { kind: 'moon', bump: 0.55 }, regolith: { moon: true, bump: 0.3, pebble: 0.14 }, flatNear: false, across: false },
  sources: [
    { field: 'axes, radiusMean, orbit', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html', verified: 'live', note: 'fetched 2026-10-01' },
    { field: 'overall size, Stickney, regolith depth', url: 'https://science.nasa.gov/mars/moons/deimos/', verified: 'live', note: 'fetched 2026-10-01: 27x22x18 km (Phobos), 15x12x11 km (Deimos)' },
  ],
};
