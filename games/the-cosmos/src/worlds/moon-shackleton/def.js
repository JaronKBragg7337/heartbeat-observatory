// ============================================================================
// worlds/moon-shackleton/def.js - SHACKLETON BASE, Fortis's capital (bible v3 4.2 and 7.3): the walled military city on the rim of Shackleton crater at the
// Moon's south pole. The rim crest sees the Sun for most of the year (the baked LOLA heights say about half the year at the pad, and the crest above it more); the crater floor, four kilometres below,
// has never seen it, and holds the ice. See common.js for what is real and what is fiction.
// ============================================================================
import { moonDef } from '../moon/common.js';
import { solidAtMoon } from '../moon/layout.js';

export default moonDef({
  site: 'moon-shackleton', name: 'Shackleton', navName: 'Moon: Shackleton Base (Fortis)',
  blurb: 'Fortis\'s walled capital on the rim of Shackleton crater at the south pole: sunlight on the rim, ice in the permanent dark below. A lane from Mars, a hop from Tranquility.',
  // where the nearest permanent shadows are, worked out from the LOLA heights (the first is 1.6 km south west and 630 m down a 29 degree slope): the survey beacons mark them
  extra: { seams: [{ id: 'ICE-1', eastM: -750, northM: -1400, radiusM: 120 }, { id: 'ICE-2', eastM: -250, northM: -1650, radiusM: 120 }, { id: 'ICE-3', eastM: -1250, northM: -1200, radiusM: 120 }] },
  sun: { elevDeg: 6.0, azDeg: 150 },       // the Sun never clears 1.5 degrees here for real; 6 keeps the base readable on a phone (the shadows are still ten times as long as what casts them)
  pad: { flatM: 150, blendM: 330 },
  settlement: { depthM: 1.5, solid: (x, z, margin) => solidAtMoon('moon-shackleton', x, z, margin) },
  rocks: [
    { s: 50, dens: 0.4, rLo: 3, rHi: 8, hLo: 0.8, hHi: 2.4 },
    { s: 14, dens: 0.44, rLo: 1.4, rHi: 3, hLo: 0.3, hHi: 1.0 },
    { s: 6, dens: 0.32, rLo: 0.7, rHi: 1.4, hLo: 0.1, hHi: 0.4 },
  ],
  landmarks: [
    { id: 'COS-LUN-LMK-0011', name: 'Shackleton', lat: -89.66, lon: 129.78, radiusM: 10_500, depthM: 0, note: '21 km across and 4.2 km deep, on the south pole: the rim sees the Sun nearly all year, the floor never has. Real (LRO).' },
    { id: 'COS-LUN-LMK-0012', name: 'de Gerlache', lat: -88.5, lon: -87.1, radiusM: 16_000, depthM: 0, note: 'A 32 km crater beside Shackleton; the ridge between them is among the sunniest ground on the Moon. Real (IAU).' },
    { id: 'COS-LUN-LMK-0013', name: 'Haworth', lat: -87.5, lon: 5.0, radiusM: 17_500, depthM: 0, note: 'A 35 km crater whose floor is in permanent shadow. Real (IAU).' },
    { id: 'COS-LUN-LMK-0014', name: 'Shoemaker', lat: -88.1, lon: 44.9, radiusM: 25_500, depthM: 0, note: 'A 51 km crater, largely in permanent shadow. Real (IAU).' },
    { id: 'COS-LUN-LMK-0015', name: 'Faustini', lat: -87.3, lon: 77.0, radiusM: 19_500, depthM: 0, note: 'A 39 km crater with a permanently shadowed floor. Real (IAU).' },
  ],
  sources: [{ field: 'Shackleton, de Gerlache, Haworth, Shoemaker, Faustini', url: 'https://en.wikipedia.org/wiki/Shackleton_(crater)', verified: 'table', note: 'typed from the IAU gazetteer values: re-confirm by hand. The crater is in the heights; the label does not carve it.' }],
});
