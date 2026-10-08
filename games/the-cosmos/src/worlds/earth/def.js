// ============================================================================
// worlds/earth/def.js - EARTH, with the SKYWARD LAUNCH COMPLEX on it (bible v3 4.5: "Real continents and oceans from free data, no real cities; Skyward runs
// the launch sites"). First pass of WD-EARTH: the whole planet at its real size and mass with its real shape of land and sea, and one place to land: Skyward's
// complex on Merritt Island, Cape Canaveral, Florida, beside the Atlantic.
//
// WHAT IS REAL AND WHAT IS NOT (every number says which; `sources`)
//   Real: the radius, mass, gravity, day, tilt and orbit (NASA Earth Fact Sheet, JPL elements); the heights and the sea floor of the whole globe (AWS Open Data
//   Terrain Tiles = SRTM + GEBCO + ETOPO1, baked to a half-degree grid: terra.js); the Cape's own coast, the Banana and Indian Rivers, Merritt Island and the shelf
//   at 200 m; the colour of the land from orbit (NASA Blue Marble); the place Launch Complex 39 stands.
//   Not real: the ground between the grid's points (the field's own noise adds hills; away from the Cape a coast is within a cell or two of the true one), the
//   weather (clouds are drawn, not simulated), Skyward and everything on the complex. No real city is drawn anywhere.
// HONEST SIMPLIFICATIONS: a frame can only turn about Mars's pole (docs/ADD-A-WORLD.md), so Earth's tilt is data, not yet a tilted frame; the day is Earth's real
//   one and the Sun's height at the pad is the game's Sun, not a calendar. The sea is drawn (client.js) over a ground that falls away under it.
// Pure data: no three.js, no DOM. The server, the validator and the browser read the same file.
// ============================================================================
import { SOLAR } from '../_kit/solar.js';
import { groundMaterials, extraMaterial } from '../_kit/materials.js';
import { fbm } from '../_kit/terrain.js';
import { heightAt, biomeAt, DEG } from './terra.js';
import { solidAtEarth } from './layout.js';

export const EARTH = {
  radiusM: 6_371_000,           // volumetric mean radius (NASA Earth Fact Sheet: 6371.000 km)
  massKg: 5.9722e24,            // 5.9722e24 kg (NASA)
  siderealDayS: 86164.0905,     // 23 h 56 m 4.09 s (IAU)
  obliquityDeg: 23.4393,        // to its orbit (NASA: 23.44)
};
/** The pad: Skyward's arrival pad on Merritt Island, a little east of Launch Complex 39A (28.6082 N, 80.6041 W), so the Atlantic is some 700 m off. */
export const PAD_LL = { lat: 28.6082, lon: -80.6012 };

const latLon = (px, py, pz) => { const r = Math.hypot(px, py, pz) || 1; return [Math.asin(Math.max(-1, Math.min(1, pz / r))) / DEG, Math.atan2(py, px) / DEG]; };
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Metres above the sea-level sphere at a body-frame point: the real heights (terra.js) with hills and ripples riding on them, kept to the shape of the real ground. */
export function groundHeight(px, py, pz) {
  const [la, lo] = latLon(px, py, pz), h0 = heightAt(la, lo);
  let h = h0;
  if (h0 > 0.6) {
    // land: the ground between the grid's points. Flat country (Florida) gets low swells; mountains get ridges in proportion to how high they are.
    const flat = sstep(0.6, 8, h0);                                         // nothing added where the coast is: the measured shoreline stays where it is
    h += flat * (fbm(px / 700, py / 700, pz / 700, 7001, 3) * 1.6 + fbm(px / 60, py / 60, pz / 60, 7011, 2) * 0.35);
    const hills = sstep(60, 400, h0);
    h += hills * h0 * (fbm(px / 9000, py / 9000, pz / 9000, 7021, 4) * 0.2 + fbm(px / 1700, py / 1700, pz / 1700, 7031, 3) * 0.06);
  } else {
    h += fbm(px / 400, py / 400, pz / 400, 7041, 2) * Math.min(1.2, 0.2 + (-h0) * 0.04);       // sand ripples under the water
  }
  return h;
}

/** Ground material: sand along the coast, on the shelf under the sea and in the deserts; scrub and grass otherwise. `n` is a -1..1 noise so the edges are ragged. */
function groundAt(q, depth, reg, n) {
  if (depth > 1.2) return null;
  const [la, lo] = latLon(q[0], q[1], q[2]), h0 = heightAt(la, lo);
  if (h0 < 2.6 + 1.4 * n && h0 > -60) return 'ice';                              // the `ice` slot of the materials is Earth's sand
  if (h0 > 2.6 && biomeAt(la, lo) === 1) return 'ice';
  return null;
}

/** Brightness for the globe and the tiers (moonField.js `albedoFn`). The colour is the material's (green scrub, sand); this lifts and dims it. */
function albedoFn(q, k0, red0, lo, mid, out) {
  const [la, lon] = latLon(q[0], q[1], q[2]), h0 = heightAt(la, lon);
  const sea = h0 < 0 ? Math.max(0.3, 1 - 0.7 * sstep(-2, -30, h0)) : 1;
  const bio = h0 > 2.6 ? biomeAt(la, lon) : 0;
  const base = bio === 2 ? 2.1 : bio === 1 ? 1.12 : 0.9;
  out.k = base * sea * (0.93 + 0.14 * lo + 0.07 * mid);
  out.red = bio === 1 ? 0.5 : -0.12 * lo;
}

/** The ground is named for what you stand on, not 'regolith' (that is a word for the Moon and Mars): grass and soil on top, packed sand and shell rock under it; the sand slot is 'Sand'. */
function earthNames(m) {
  m.regolith.name = 'Grass and soil'; m.rubble.name = 'Packed sand and shell rock';
  m.rubble.note = 'Cemented shell and sand, the limestone-like rock under the Florida coast.';
  return m;
}

export default {
  id: 'earth', name: 'Earth', designation: 'SOL-3', kind: 'planet', order: 50, worldIndex: 71,
  navName: 'Earth: Skyward Launch Complex',
  blurb: "Home. Skyward's launch complex on the Florida coast, the Atlantic to the east. The deepest gravity well in the system: easy to land on, a fortune to leave. The long-range drive flies there.",
  jump: true,                                    // legacy flag, no longer used by the course planner (one seamless Solar System)

  // ---- shape and mass: NASA's Earth Fact Sheet
  radiusM: EARTH.radiusM, massKg: EARTH.massKg,
  orbit: SOLAR.orbit.earth,                      // JPL elements (the Earth-Moon barycentre, as in the table)
  rotation: { periodS: EARTH.siderealDayS, axialTiltDeg: EARTH.obliquityDeg, prime0Deg: -3.76 },

  // ---- ground: the real heights and sea floor, hills and ripples from the field's own noise; no craters, no loose boulders, an ordinary soil
  seed: 7001,
  terrain: { profile: 'sampled', height: groundHeight },
  regolithDepthM: 3,
  craterDensity: 0, craterScale: 1, cellScale: 1, roughScale: 0.22, grooves: false,
  cells: [],
  lump: 0, lump2: 0,
  landmarks: [
    { id: 'COS-EARTH-LMK-0001', name: 'Launch Complex 39A', lat: 28.6082, lon: -80.6041, radiusM: 120, depthM: 0, note: 'Pad A of the Kennedy Space Center: the Apollo moon rockets and the shuttle flew from here. Skyward\'s arrival pad is a few hundred metres east. Real place.' },
    { id: 'COS-EARTH-LMK-0002', name: 'Vehicle Assembly Building', lat: 28.5729, lon: -80.6490, radiusM: 150, depthM: 0, note: 'The great white hall four kilometres inland where the rockets were stacked. Real place; Skyward\'s hall in the game is its own.' },
    { id: 'COS-EARTH-LMK-0003', name: 'Cape Canaveral', lat: 28.4600, lon: -80.5270, radiusM: 600, depthM: 0, note: 'The cape itself: the headland where Florida meets the Atlantic. Real place.' },
  ],
  pad: { lat: PAD_LL.lat, lon: PAD_LL.lon, flatM: 150, blendM: 330, name: 'Skyward Launch Complex' },
  derelict: null,
  rocks: [],
  heroes: [],
  rockKeep: { stones: [30, 50], rocks: [60, 90] },
  settlement: { depthM: 1.5, solid: (x, z, margin) => solidAtEarth(x, z, margin) },

  // ---- air: sea-level pressure and density, an 8.5 km scale height, the sky of a clear day
  atmosphere: { surfacePressure: 101_325, rho0: 1.225, scaleHeightM: 8_500, topM: 100_000, skyColor: 0x4b8fe0, horizonColor: 0xbcd9f2, fogDensity: 0.000034 },
  ascentM: 9000, tierAltM: 60_000,

  materials: {
    ...earthNames(groundMaterials({ key: 'earth', name: 'Earth', regolithColor: 0x607c3a, rubbleColor: 0xa89c7e, regolithKgM3: 1300, rubbleKgM3: 2000,
      note: 'Florida scrub: thin sandy soil under tough grass and palmetto.' })),
    // the `ice` slot is Earth's sand (see groundAt): a beach, a shelf, a desert
    ice: extraMaterial('MAT-EARTH-SAND', 'Sand', 1600, 0.18, 0xdccfa6, 'Pale quartz and shell sand: the beach, the sea floor of the shelf and the deserts.'),
  },
  look: { k: [1, 0.1, 0.06], red: [0, 0.15, 0.1] },
  albedoFn, groundAt,
  render: { farColor: 1.05, tierColor: 1.0, roughness: 0.93, regolith: { moon: true, bump: 0.22, pebble: 0.02, earth: true }, farRegolith: { kind: 'moon', bump: 0.3, earth: true } },
  sources: [
    { field: 'radius, mass, gravity, day, tilt', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html', verified: 'table', note: 'NASA Earth Fact Sheet values typed in (mean radius 6371.0 km, mass 5.9722e24 kg, sidereal rotation 23.9345 h, obliquity 23.44 deg): re-confirm by hand (docs/PROVENANCE.md)' },
    { field: 'orbit', url: 'https://ssd.jpl.nasa.gov/planets/approx_pos.html', verified: 'table', note: 'JPL approximate elements (the Earth-Moon barycentre), _kit/solar.js' },
    { field: 'heights and sea floor of the whole globe, and the coast and shelf round Cape Canaveral', url: 'https://registry.opendata.aws/terrain-tiles/', verified: 'live', note: 'fetched 2026-10-08: AWS Open Data Terrain Tiles (Terrarium encoding; sources SRTM, GEBCO, ETOPO1 and others), zoom 3 averaged to half a degree and zoom 10 over a 0.8 degree window, baked by tools/bake-earth.mjs' },
    { field: 'the land colour from orbit; which land is desert and which is snow', url: 'https://visibleearth.nasa.gov/images/73909', verified: 'live', note: 'NASA Blue Marble Next Generation, the 1024 x 512 picture already in assets/moon/earth.jpg' },
    { field: 'Launch Complex 39A, the Vehicle Assembly Building, Cape Canaveral', url: 'https://en.wikipedia.org/wiki/Kennedy_Space_Center_Launch_Complex_39', verified: 'table', note: 'coordinates typed from the public record: re-confirm by hand' },
    { field: 'Skyward, its buildings, its vehicle, the signs', url: '', verified: 'invented', note: 'GAME FICTION (bible v3 section 4.5)' },
  ],
};
