// ============================================================================
// worlds/_kit/solar.js - the real Solar System's heliocentric orbits, ready to paste into a world def: `orbit: SOLAR.orbit.earth`.
//
// SOURCE: JPL "Keplerian Elements for Approximate Positions of the Major Planets", Table 1 (valid 1800 AD - 2050 AD), by E. M.
// Standish: elements and their rates per Julian century, mean ecliptic and equinox of J2000. The numbers below were TYPED FROM THAT
// TABLE, not fetched live (the project's convention for such values: `verified: 'table'`, re-confirm by hand before treating them as
// measured evidence; docs/PROVENANCE.md). test/worlds-checks.mjs checks them against facts that are easy to know (periods, Mars's
// perihelion and aphelion, Earth-Mars distance at the October 2020 opposition) so a mistyped digit shows up.
//
// Earth's row is the Earth-Moon BARYCENTRE, as in the table. The Moon's own orbit about the Earth is a separate entry.
// ============================================================================
import { AU } from './ephemeris.js';

/** [a AU, e, I deg, L deg, lonPeri deg, node deg] at J2000 and per century. */
const ROWS = {
  mercury: { el: [0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593], rt: [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081] },
  venus:   { el: [0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255], rt: [0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418] },
  earth:   { el: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0], rt: [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0] },
  mars:    { el: [1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891], rt: [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343] },
  jupiter: { el: [5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909], rt: [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106] },
  saturn:  { el: [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448], rt: [-0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794] },
  uranus:  { el: [19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.95427630, 74.01692503], rt: [-0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589] },
  neptune: { el: [30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574], rt: [0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664] },
};

const orbitOf = ({ el, rt }) => ({
  parent: 'sun', frame: 'ecliptic',
  a: el[0] * AU, e: el[1], i: el[2], meanLon: el[3], lonPeri: el[4], node: el[5],
  rates: { a: rt[0] * AU, e: rt[1], i: rt[2], meanLon: rt[3], lonPeri: rt[4], node: rt[5] },
});

export const SOLAR = {
  orbit: Object.fromEntries(Object.entries(ROWS).map(([k, v]) => [k, orbitOf(v)])),
  /** The Sun: mass, volumetric mean radius (IAU nominal solar radius 6.957e8 m; mass from GM 1.32712440018e20 / G). */
  sun: { massKg: 1.98841e30, radiusM: 6.957e8 },
  source: { field: 'heliocentric orbital elements and rates', url: 'https://ssd.jpl.nasa.gov/planets/approx_pos.html', verified: 'table', note: 'Standish, Keplerian Elements for Approximate Positions of the Major Planets, Table 1 (1800-2050); typed from the table, re-confirm by hand' },
};
