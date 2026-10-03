// ============================================================================
// worlds/ceres/def.js - CERES, with OCCATOR WORKS on it: the Industrial Miners' home (Space You Land bible v2.9 "Home: Ironclad. Edge: superior
// mining, metallurgy, shipyard construction. Constraint: labour strikes, supply shocks, territorial disputes"; bible v3 section 4.3: "Ironclad
// mines Occator crater: the bright salt flats, the brine, the metal under them. Pit heads, smelters, gantries, amber work lights, hard hats").
//
// WHY CERES (Jaron 10/3: the game's star system is our real Solar System at real scale; faction homes sit on real bodies)
//   Ceres is the Belt's capital: the one dwarf planet inside Neptune's orbit, 940 km across, with water ice under a dark crust and, in Occator
//   crater, the brightest ground on the body: sodium-carbonate salt laid down by a deep brine that reached the surface (Dawn, 2015-2018). The
//   miners' trade is metal and fire; the Belt's is water and salt. Gravity is 0.284 m/s2: a standing jump clears a metre and a half and a
//   dropped tool takes three seconds to fall. Ironclad's pair on Ceres is Greenhaven (the farmers and medics, under glass in Kerwan basin):
//   Kerwan and Ahuna Mons are placed on this map from the real coordinates and are theirs to build on (see `ports`).
//
// Pure data: no three.js, no DOM. The server, the validator and the browser read the same file. Everything the world needs is derived from it
// (docs/ADD-A-WORLD.md); the settlement is src/worlds/ceres/client.js (drawn) and layout.js / trade.js (the parts the server checks).
//
// WHAT IS REAL AND WHAT IS NOT (every number says which; `sources`)
//   Real: the shape, mass, gravity and rotation (Dawn / NASA, via Wikipedia, fetched 2026-10-03), the orbit (JPL Small-Body Database elements,
//   epoch JD 2461200.5), Occator (19.86 N, 238.85 E, 92 km across, 3 km deep, the 340 m dome Cerealia Tholus with the bright salt Cerealia
//   Facula on it, Vinalia Faculae east of it), Kerwan (11.47 S, 122.58 E, 284 km, shallow), Ahuna Mons (10.46 S, 315.8 E, 4 km high, 20 km wide).
//   Placed from the real map but SHAPED BY THE FIELD: the relief between those features is the density field's cratered heightfield (every
//   crater a procedure), not the Dawn terrain model (135 m per pixel, public domain: a later package could sample it).
//   Game fiction (marked, never claimed): Occator Works and its pits (The Cut, Seam Hollow), the ore, the Compact, the lane, the lane fee,
//   the salt pans beside the station (the real faculae are 11 to 20 km east of it).
//
// HONEST SIMPLIFICATIONS (stated, not hidden)
//   * Nothing spins or orbits yet (the registry's switch is off: _kit/ephemeris.js): the Sun stands at a fixed mid-morning angle over the
//     station. Ceres's real day is 9.07 hours, so when F2 flips the switch the Sun will cross the sky in four and a half hours; `rotation` is
//     here for it. Ceres is at its real place for the game's start date (a few AU from Mars); the drive cannot fly it, so a lane joins them.
//   * Real Ceres has no air, so the sky is black with stars at every hour; the Sun is 0.19 degrees across (a seventh of its Earth sunlight).
// ============================================================================

import { groundMaterials, extraMaterial } from '../_kit/materials.js';
import { AU } from '../_kit/ephemeris.js';
import { solidAt } from './layout.js';

const DEG = Math.PI / 180;
export const PAD_LL = { lat: 19.86, lon: 237.42 };           // on Occator's floor, 11 km west of the dome

/** The Sun in body axes: 24 degrees up at the pad, and well off the nearest meridian so shadows fall across the station's streets. */
function sunBodyDir() {
  const la = PAD_LL.lat * DEG, lo = PAD_LL.lon * DEG;
  const p = [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
  const sinE = Math.sin(24 * DEG), sx = -0.5;
  const rhs = sinE - p[0] * sx, r2 = 1 - sx * sx, a = p[1], b = p[2], l = Math.hypot(a, b);
  const c = rhs / l, ph = Math.atan2(b, a);
  const dphi = Math.acos(Math.max(-1, Math.min(1, c / Math.sqrt(r2))));
  const ang = ph - dphi, rr = Math.sqrt(r2);
  return [sx, rr * Math.cos(ang), rr * Math.sin(ang)];
}

export default {
  id: 'ceres', name: 'Ceres', designation: '1 Ceres', kind: 'dwarf', order: 30, worldIndex: 3,
  navName: 'Ceres: Occator Works',
  blurb: "The miners' home on the Belt's dwarf planet, on the bright salt flats of Occator crater. Pits, smelters, ore to haul, and a lane to jump: Ceres is far past the drive's range.",
  jump: true,                                    // reached by the Ore Lane (src/space/jump.js)

  // ---- shape and mass: Dawn (Wikipedia, NASA): 966.2 x 962.0 x 891.8 km, mean radius 469.7 km, 9.38392e20 kg
  axes: { a: 483_100, b: 481_000, c: 445_900 },
  radiusMean: 469_700,
  massKg: 9.38392e20,

  // ---- where it is: JPL Small-Body Database, epoch JD 2461200.5: e 0.0797, i 10.6, node 80.2, peri 73.3, M 274 deg, period 1680 d (4.60 yr).
  // a is worked from the period (2.7672 AU; the database prints 2.77). M0 is the mean anomaly at the game's start (JD 2461316.5, 116 days on).
  orbit: { parent: 'sun', frame: 'ecliptic', a: 2.7672 * AU, e: 0.0797, i: 10.6, node: 80.2, peri: 73.3, M0: 298.86, periodS: 1680.15 * 86400 },
  rotation: { periodS: 9.074170 * 3600, axialTiltDeg: 4.0 },

  // ---- ground: a cratered, icy dark crust under a loose dust; Occator's floor is smooth plain
  seed: 401,
  terrain: { profile: 'rocky' },
  regolithDepthM: 12,
  craterDensity: 0.55, craterScale: 1.0, cellScale: 1.0, roughScale: 1.0,
  grooves: false,
  cells: [90000, 38000, 16000, 6800, 2900, 1250, 540, 240, 110, 50, 22],
  depthRatio: (D) => (D < 400 ? 0.17 : D < 10000 ? 0.17 - 0.08 * Math.min(1, (D - 400) / 9600) : D < 100000 ? 0.09 - 0.04 * Math.min(1, (D - 10000) / 90000) : 0.05),
  // broad relief (Dawn: about 15 km from the lowest basin floor to the highest rim): lumps at hundreds of kilometres
  lump: 0.011, lumpFreq: 1 / 160_000, lump2: 0.0035, lump2Freq: 1 / 34_000,
  landmarks: [
    // Occator: 92 km, 3 km deep, a flat floor (the first landmark gets the bright ejecta blanket: `look.ejecta`)
    { id: 'COS-CER-LMK-0001', name: 'Occator', lat: 19.86, lon: 238.85, radiusM: 46_000, depthM: 3000, flat: true, rim: 0.2, ejecta: 0.05,
      note: 'The 92 km crater the miners work: 3 km deep, a smooth floor, and the brightest ground on Ceres. Real (Dawn).' },
    // Cerealia Tholus: the 340 m dome in Occator's middle, 3 km across (negative depth: a rise); the Cerealia Facula is the bright salt on it
    { id: 'COS-CER-LMK-0002', name: 'Cerealia Tholus', lat: 19.86, lon: 238.85, radiusM: 1500, depthM: -340, rim: 0, ejecta: 0,
      note: 'A 340 m dome in the middle of Occator, white with salt (Cerealia Facula). Real (Dawn).' },
    { id: 'COS-CER-LMK-0003', name: 'Kerwan', lat: -11.47, lon: 122.58, radiusM: 141_940, depthM: 4500, flat: true, rim: 0.05, ejecta: 0,
      note: 'The biggest basin, 284 km across and shallow for its size: the Greenhaven farms stand in it. Real (Dawn).' },
    { id: 'COS-CER-LMK-0004', name: 'Ahuna Mons', lat: -10.46, lon: 315.8, radiusM: 10_000, depthM: -4200, rim: 0, ejecta: 0,
      note: 'The lone ice volcano: about 4 km high and 20 km across at the base. Real (Dawn).' },
    // The Compact's workings (game fiction): The Cut, a terraced open-pit mine; Seam Hollow, a prospecting cut where they stopped.
    { id: 'COS-CER-LMK-0005', name: 'The Cut', eastM: -3300, northM: 3000, radiusM: 2600, depthM: 640, terraces: 8, ramp: 0.66, rim: 0.035, ejecta: 0, bare: true,
      note: "GAME FICTION: the Compact's terraced open-pit mine, 5 km across and 640 m deep: eight benches joined by haul ramps." },
    { id: 'COS-CER-LMK-0006', name: 'Seam Hollow', eastM: 2600, northM: -2200, radiusM: 700, depthM: 120, terraces: 3, ramp: 0.6, rim: 0.03, ejecta: 0, bare: true,
      note: 'GAME FICTION: a small prospecting cut where the Compact stopped: three benches, ore still in the walls.' },
  ],
  pad: { lat: PAD_LL.lat, lon: PAD_LL.lon, flatM: 150, blendM: 280, name: 'Occator Works' },
  derelict: null,
  rocks: [
    { s: 64, dens: 0.4, rLo: 5, rHi: 12, hLo: 1.6, hHi: 3.8 },
    { s: 14, dens: 0.44, rLo: 2, rHi: 4, hLo: 0.5, hHi: 1.5 },
    { s: 6, dens: 0.3, rLo: 0.8, rHi: 1.6, hLo: 0.12, hHi: 0.5 },
  ],
  rockKeep: { stones: [150, 200], rocks: [170, 235] },       // loose rock stays this far from the station (metres from the pad centre)
  heroes: [],

  // ---- the ground's own dressing
  materials: {
    ...groundMaterials({ key: 'ceres', name: 'Ceres', regolithColor: 0x5b564f, rubbleColor: 0x3d3a37, regolithKgM3: 1500, rubbleKgM3: 2300,
      note: 'Dark, fine, porous dust over an icy crust (Ceres reflects about 9% of its light). A blanket a dozen metres deep here, deeper round the Compact\'s workings.' }),
    // GAME FICTION: Occator ore (the metal under the salt flats) and the salt itself (real: sodium carbonate, Dawn)
    ore: extraMaterial('MAT-CERES-ORE', 'Occator ore', 4300, 0.62, 0x6e5040, "GAME FICTION: the Compact's ore, the metal under Occator's salt flats. Rust-red, heavy, in veins and outcrops. Sold by the tonne at Occator Works and (better) at the Marineris depot."),
    salt: extraMaterial('MAT-CERES-SALT', 'Occator salt', 2540, 0.18, 0xe9e6dc, 'Bright sodium-carbonate crust, left by the brine that reached Occator\'s floor (Dawn: the bright spots are mostly Na2CO3). Soft, white, and the brightest ground on the dwarf planet.'),
  },
  look: { k: [0.95, 0.1, 0.06], red: [0.2, 0.2, 0.15], ejecta: { k: 0.35, red: -0.5, centre: 1.5, width: 1.6 } },
  render: { farColor: 1.9, tierColor: 1.9, regolith: { moon: true, bump: 0.5, pebble: 0.2 } },
  /** exposed ore outcrops near the station (game fiction): east / north metres from the pad centre, and how wide the exposed ore lies */
  seams: [
    { id: 'A', eastM: 420, northM: 120, radiusM: 46 },
    { id: 'B', eastM: -520, northM: -380, radiusM: 52 },
    { id: 'C', eastM: 120, northM: -900, radiusM: 60 },
  ],
  /** bright salt: Cerealia Facula on the dome and Vinalia Faculae beyond it (real positions from the pad: the dome is 11 km east), and the Compact's salt pans beside the station (fiction) */
  faculae: [
    { eastM: 11_000, northM: 0, radiusM: 2200 }, { eastM: 15_500, northM: 1500, radiusM: 1100 }, { eastM: 17_500, northM: -1800, radiusM: 900 }, { eastM: 14_000, northM: -2600, radiusM: 700 },
    { eastM: 700, northM: -520, radiusM: 190 }, { eastM: -900, northM: 420, radiusM: 260 }, { eastM: 300, northM: 1400, radiusM: 230 },
  ],
  /** under the buildings and the pad: a metre and a half of engineered fill (concrete: not diggable); the footprint test is layout.js's */
  settlement: { depthM: 1.5, solid: (x, z, margin) => solidAt(x, z, margin) },
  /** the sun and the sky (spaceSky.setSystem): Ceres has no air; the Sun is 0.19 degrees across at 2.77 AU (0.533 / 2.77) and a seventh as strong as at Earth */
  sun: { body: sunBodyDir() },
  sky: { star: { color: [1.0, 0.97, 0.9], glow: [1.0, 0.92, 0.78], diskDeg: 0.19, intensity: 1.9 }, fill: { sky: [0.42, 0.40, 0.38], ground: [0.62, 0.57, 0.52], intensity: 0.8 } },
  /** how far up a ship climbs before the main drive takes her (above all the ground), and how high the whole-world ground tiers are kept */
  ascentM: 9000, tierAltM: 250_000,
  sources: [
    { field: 'radius, axes, mass, gravity, rotation, tilt, albedo', url: 'https://en.wikipedia.org/wiki/Ceres_(dwarf_planet)', verified: 'live', note: 'fetched 2026-10-03: 966.2 x 962.0 x 891.8 km, mean radius 469.7 km, 9.38392e20 kg, 0.284 m/s2, 9.074170 h, tilt about 4 deg, albedo 0.090 (cites Dawn / NASA / JPL)' },
    { field: 'orbit', url: 'https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=1', verified: 'live', note: 'fetched 2026-10-03: epoch JD 2461200.5, e 0.0797, i 10.6, node 80.2, peri 73.3, M 274 deg, period 1680 d; a worked from the period (the database prints 2.77 AU)' },
    { field: 'Occator, Cerealia Tholus, faculae', url: 'https://en.wikipedia.org/wiki/Occator_(crater)', verified: 'live', note: 'fetched 2026-10-03: 19.86 N 238.85 E, 92 km, 3 km deep, dome 3 km across and 340 m high, sodium carbonate' },
    { field: 'Kerwan, Ahuna Mons', url: 'https://en.wikipedia.org/wiki/Kerwan_(crater)', verified: 'live', note: 'fetched 2026-10-03: Kerwan 11.47 S 122.58 E, 283.88 km, about 5 km deep; Ahuna Mons 10.46 S 315.8 E, about 4 km high, 20 km wide' },
    { field: 'Occator Works, the Compact, the lane, the ore, the fee, the salt pans beside the station', url: '', verified: 'invented', note: 'GAME FICTION (bible v2.9 / v3 section 4.3)' },
  ],
};
