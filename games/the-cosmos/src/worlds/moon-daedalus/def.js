// ============================================================================
// worlds/moon-daedalus/def.js - DAEDALUS STATION, Technos Prime's capital (bible v3 4.2 and 7.3): the glass city on the floor of Daedalus crater on the far side,
// where the Moon's body hides Earth's radio noise (the whole reason the dishes are here). The central peaks stand 26 km east; the terraced wall rises behind the city.
// See common.js for what is real and what is fiction.
// ============================================================================
import { moonDef } from '../moon/common.js';
import { solidAtMoon } from '../moon/layout.js';

export default moonDef({
  site: 'moon-daedalus', name: 'Daedalus', navName: 'Moon: Daedalus Station (Technos Prime)',
  blurb: "Technos Prime's glass city on the floor of Daedalus crater, far side, where the Moon blocks Earth's noise: the dishes listen to everything. A lane from Mars, a hop from Tranquility.",
  sun: { elevDeg: 21, azDeg: 100 },
  pad: { flatM: 150, blendM: 300 },
  settlement: { depthM: 1.5, solid: (x, z, margin) => solidAtMoon('moon-daedalus', x, z, margin) },
  landmarks: [
    { id: 'COS-LUN-LMK-0021', name: 'Daedalus', lat: -5.9, lon: 179.4, radiusM: 46_500, depthM: 0, note: 'A 93 km far-side crater with terraced walls and a cluster of central peaks. The Moon above it blocks all radio from Earth. Real (IAU).' },
  ],
  sources: [{ field: 'Daedalus', url: 'https://en.wikipedia.org/wiki/Daedalus_(crater)', verified: 'table', note: 'typed from the IAU gazetteer values: re-confirm by hand. The crater is in the heights; the label does not carve it.' }],
});
