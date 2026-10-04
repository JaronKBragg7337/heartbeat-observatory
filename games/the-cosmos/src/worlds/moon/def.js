// ============================================================================
// worlds/moon/def.js - TRANQUILITY CIVIL HUB, the Moon's front door (bible v3 7.3: the small shared port a new Moon player comes down near, where both
// recruiters wait). Mare Tranquillitatis, a kilometre and a bit from where Apollo 11 stood. Replaces the placeholder: the Moon's orbit is kept (common.js).
// The other two landings are src/worlds/moon-shackleton and src/worlds/moon-daedalus: see common.js for why the Moon is three frames.
// ============================================================================
import { moonDef } from './common.js';
import { solidAtMoon } from './layout.js';

export default moonDef({
  site: 'moon', name: 'Tranquility', regionName: 'Moon', navName: 'Moon: Tranquility Civil Hub',
  blurb: "The Moon's shared civil port on Mare Tranquillitatis, a kilometre from the first footprints. Fortis recruits at one gate and Technos Prime at the other. Far past the drive's range: a lane.",
  sun: { elevDeg: 24, azDeg: 100 },
  pad: { flatM: 150, blendM: 280 },
  settlement: { depthM: 1.5, solid: (x, z, margin) => solidAtMoon('moon', x, z, margin) },
  landmarks: [
    { id: 'COS-LUN-LMK-0001', name: 'Tranquility Base (Apollo 11)', lat: 0.67408, lon: 23.47297, radiusM: 90, depthM: 0, note: 'Where Apollo 11 landed on 20 July 1969: the descent stage, the plaque and the footprints are still there. Real (NASA).' },
    { id: 'COS-LUN-LMK-0002', name: 'Collins', lat: 1.3, lon: 23.4, radiusM: 1200, depthM: 0, note: 'A 2.4 km crater north of the landing site, named for the Apollo 11 command module pilot. Real (IAU).' },
    { id: 'COS-LUN-LMK-0003', name: 'Aldrin', lat: 1.4, lon: 22.1, radiusM: 1700, depthM: 0, note: 'A 3.4 km crater west of the landing site. Real (IAU).' },
    { id: 'COS-LUN-LMK-0004', name: 'Armstrong', lat: 1.4, lon: 25.0, radiusM: 2300, depthM: 0, note: 'A 4.6 km crater east of the landing site. Real (IAU).' },
  ],
  sources: [{ field: 'Apollo 11 site, Collins, Aldrin, Armstrong', url: 'https://en.wikipedia.org/wiki/Tranquility_Base', verified: 'table', note: 'coordinates and sizes typed from the IAU gazetteer values: re-confirm by hand (docs/PROVENANCE.md). The Apollo site is not carved into the ground: the heights already have it.' }],
});
