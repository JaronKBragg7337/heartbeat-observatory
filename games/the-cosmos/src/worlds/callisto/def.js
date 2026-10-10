// ============================================================================
// worlds/callisto/def.js - CALLISTO, with the VALHALLA CAMP on it (bible v3 4.4: Mystara, the research institute that went out to
// Jupiter in the 2060s and went quiet in the storms; their base is in the Valhalla basin; the second seat is open, held loosely by an
// NPC prospectors' camp). Replaces the F3 placeholder: the orbit round Jupiter is kept and made honest (the plane is real now).
// WD-CALLISTO, 2026-10-09 (kimi).
//
// WHY CALLISTO: the outermost big moon of Jupiter, the one big Galilean moon outside the worst of the radiation belts: the frontier
// that is already settled. Real body: 2,410 km across, 1.24 m/s2, one turn every 16.69 days (the same time it takes to go once round
// Jupiter, so one face is kept to the planet), a 4-billion-year ice crust so heavily cratered it is the most battered surface known.
// Jupiter hangs enormous in its sky: 71,492 km across at 1,882,700 km away, about 4.4 degrees wide (nine full Moons). Valhalla, the
// basin the camp stands in, is the biggest multi-ring impact structure known: a bright 360 km palimpsest with rings to 1,900 km.
//
// WHAT IS REAL AND WHAT IS NOT (every number says which; `sources`)
//   Real: the radius, mass, gravity, day, the orbit round Jupiter (a, e, period; the plane is Jupiter's own equatorial plane, IAU pole
//   J2000), Valhalla (16 N, 57 W, USGS control network) and Asgard (30 N, 139 W); the colour of the ground (dark dust-stained ice with
//   bright crater floors) at the palette level; the Sun 0.10 degrees across at 5.2 AU.
//   Shaped by the field: every hill and crater between the named features is the density field's own cratered ice (there is no global
//   height map for Callisto; only local stereo patches exist: NASA/USGS have the picture, not the shape: REAL-DATA.md).
//   Game fiction (marked, never claimed): the Valhalla Camp, the prospectors' camp, Mystara and the Unbound seat, the sealed sites,
//   the dead relay, every person. The orbital phase (M0) and the periapsis argument are fitted, not published (JPL Horizons has no
//   CORS: pre-computed tables would be the next step; REAL-DATA.md).
//
// HONEST SIMPLIFICATIONS (stated, not hidden)
//   * Valhalla's rings (graben 20 to 30 km wide, hundreds of metres deep) are not carved: the field's crater machinery makes bowls, not
//     rings, and at the ground tier's 30 km reach the rings are horizon-scale geometry. The bright palimpsest floor and its albedo are
//     drawn (the first landmark's ejecta blanket). Asgard is a broad shallow rim.
//   * A frame turns about Mars's pole axis only (docs/ADD-A-WORLD.md): Callisto's own pole and Jupiter's tilt are data, not a tilted
//     frame. The Sun is fixed for play (a Callisto day is 16.7 Earth days, so it barely moves in a session), as on the Moon and Ceres.
//   * Callisto has no air: the sky is black with stars at every hour.
// Pure data: no three.js, no DOM. The server, the validator and the browser read the same file.
// ============================================================================
import { groundMaterials, extraMaterial } from '../_kit/materials.js';
import { solidAt } from './layout.js';

const DEG = Math.PI / 180;
export const PAD_LL = { lat: 16.0, lon: 303.0 };              // the middle of Valhalla's bright floor (57 W in the west-positive maps)
export const VALHALLA = { lat: 16.0, lon: 303.0 };            // USGS: 16 N, 57 W
export const ASGARD = { lat: 30.0, lon: 221.0 };              // USGS: 30 N, 139 W

/** The Sun in body axes: 22 degrees up at the pad, well off the nearest meridian so shadows fall across the camp's streets, and
 *  about 75 degrees from the Jupiter direction: the planet hangs a lit gibbous in the eastern sky, not a black disc. */
function sunBodyDir() {
  const la = PAD_LL.lat * DEG, lo = PAD_LL.lon * DEG;
  const p = [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
  const sinE = Math.sin(22 * DEG), sx = 0.78;
  const rhs = sinE - p[0] * sx, r2 = 1 - sx * sx, a = p[1], b = p[2], l = Math.hypot(a, b);
  const c = rhs / l, ph = Math.atan2(b, a);
  const dphi = Math.acos(Math.max(-1, Math.min(1, c / Math.sqrt(r2))));
  const ang = ph - dphi, rr = Math.sqrt(r2);
  return [sx, rr * Math.cos(ang), rr * Math.sin(ang)];
}

const latLon = (px, py, pz) => { const r = Math.hypot(px, py, pz) || 1; return [Math.asin(Math.max(-1, Math.min(1, pz / r))) / DEG, Math.atan2(py, px) / DEG]; };
const angDist = (la, lo, la0, lo0) => { const s = Math.sin((la - la0) * DEG / 2) ** 2 + Math.cos(la * DEG) * Math.cos(la0 * DEG) * Math.sin((lo - lo0) * DEG / 2) ** 2; return 2 * Math.asin(Math.min(1, Math.sqrt(s))); };
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Brightness for the shell and the tiers (moonField.js `albedoFn`): the dark mottled plain, the bright palimpsest floors of Valhalla
 *  and Asgard, and a patchy dust mottle on top (the fresh craters read white, the plains read brown-grey). */
function albedoFn(q, k0, red0, lo, mid, out) {
  const [la, lon] = latLon(q[0], q[1], q[2]);
  const Rm = 2_410_300;
  const dV = angDist(la, lon, VALHALLA.lat, VALHALLA.lon) * Rm, dA = angDist(la, lon, ASGARD.lat, ASGARD.lon) * Rm;
  const bright = 1 + 0.55 * sstep(210_000, 150_000, dV) + 0.25 * sstep(360_000, 260_000, dA);
  out.k = 0.52 * bright * (0.82 + 0.22 * lo + 0.12 * mid) * (0.94 + 0.12 * k0);
  out.red = 0.06 + 0.08 * (0.5 - lo) - 0.12 * sstep(210_000, 150_000, dV);
}

/** Clean impact-excavated ice: under the thin dust of Valhalla's bright floor (the giant impacts punched through the dark skin to
 *  bright ice). `n` is a -1..1 noise so the edge is ragged. */
function groundAt(q, depth, reg, n) {
  const [la, lon] = latLon(q[0], q[1], q[2]);
  const dV = angDist(la, lon, VALHALLA.lat, VALHALLA.lon) * 2_410_300;
  if (dV < 190_000 && depth < 1.1 + 0.7 * (0.5 + 0.5 * n)) return 'ice';
  return null;
}

export default {
  id: 'callisto', name: 'Callisto', designation: 'JUP-IV', kind: 'moon', order: 60, worldIndex: 81,
  navName: 'Callisto: Valhalla Camp',
  blurb: "Mystara's camp in the Valhalla basin on Jupiter's outer big moon: standing instruments, sealed sites, Jupiter nine Moons wide overhead. The second seat is open. Far past the main drive's range: the long-range drive flies there.",
  jump: true,                                    // legacy flag, no longer used by the course planner (one seamless Solar System)

  // ---- shape and mass: NASA's Callisto Fact Sheet (via Wikipedia): mean radius 2410.3 km, 1.0759e23 kg, 1.236 m/s2, escape 2.44 km/s
  radiusM: 2_410_300,
  massKg: 1.0759e23,

  // ---- where it is: round Jupiter (JPL satellite fact sheet: a 1,882,700 km, e 0.0074, period 16.689018 d). The plane is Jupiter's
  // own equatorial plane (IAU pole RA 268.057, Dec 64.495 at J2000: i 64.495, node 178.06 in ecliptic elements). The phase (M0) and
  // the periapsis argument are fitted to the game's start date, not published: marked in `sources`.
  orbit: { parent: 'jupiter', frame: 'ecliptic', a: 1_882_700_000, e: 0.0074, i: 64.495, node: 178.06, peri: 43.0, M0: 120, periodS: 16.6890184 * 86400 },
  rotation: { lockedTo: 'parent', periodS: 16.6890184 * 86400, axialTiltDeg: 0.0 },

  // ---- ground: a 4-billion-year ice crust, dust-stained dark, cratered to saturation; the basins' floors are bright clean ice
  seed: 5201,
  terrain: { profile: 'ice', crackM: 26 },
  regolithDepthM: 10,
  craterDensity: 0.68, craterScale: 1.05, cellScale: 1.0, roughScale: 0.85,
  grooves: false,
  cells: [150000, 64000, 27000, 11500, 4900, 2100, 900, 380, 160, 68, 28],
  depthRatio: (D) => (D < 400 ? 0.17 : D < 10000 ? 0.17 - 0.06 * Math.min(1, (D - 400) / 9600) : D < 100000 ? 0.11 - 0.05 * Math.min(1, (D - 10000) / 90000) : 0.06),
  // broad relief: Callisto is a low, saturated ice world (about 6 km from lowest basin to highest rim)
  lump: 0.005, lumpFreq: 1 / 200_000, lump2: 0.0016, lump2Freq: 1 / 45_000,
  landmarks: [
    // Valhalla: the 360 km bright palimpsest (the first landmark gets the bright ejecta blanket: `look.ejecta`); the multi-ring
    // troughs to 1,900 km are not carved (the field makes bowls, not rings: see the header)
    { id: 'COS-CAL-LMK-0001', name: 'Valhalla', lat: VALHALLA.lat, lon: VALHALLA.lon, radiusM: 180_000, depthM: 700, flat: true, rim: 0, ejecta: 0.1,
      note: "The largest multi-ring impact basin known: a 360 km bright palimpsest with degraded rings to 1,900 km, centred 16 N 57 W. Real (USGS control network). The camp stands on this floor." },
    { id: 'COS-CAL-LMK-0002', name: 'Asgard', lat: ASGARD.lat, lon: ASGARD.lon, radiusM: 800_000, depthM: 400, flat: true, rim: 0, ejecta: 0,
      note: 'The second multi-ring basin, about 1,600 km across at 30 N 139 W. Real (USGS).' },
    // GAME FICTION: a fresh crater a short walk east of the camp, where a listening post was lost (the jobs thread)
    { id: 'COS-CAL-LMK-0003', name: 'The Listening Scar', eastM: 700, northM: -560, radiusM: 1500, depthM: 90, rim: 0.12, ejecta: 0, bare: true,
      note: 'GAME FICTION: a young, bright crater with a fresh white floor, 900 m east of the camp. The relay that used to stand on its rim is dead (the jobs thread).' },
  ],
  pad: { lat: PAD_LL.lat, lon: PAD_LL.lon, flatM: 130, blendM: 320, name: 'Valhalla Camp' },
  ports: [
    // the prospectors' camp holds the open seat, 1.2 km north of the pad (an NPC camp until a faction's players raise a building)
    { id: 'prospectors', name: "Prospectors' Camp", lat: 16.0285, lon: 303.0, flatM: 46, blendM: 130 },
  ],
  derelict: null,
  rocks: [
    { s: 64, dens: 0.36, rLo: 4, rHi: 10, hLo: 1.0, hHi: 2.6 },
    { s: 14, dens: 0.42, rLo: 1.4, rHi: 3, hLo: 0.3, hHi: 0.9 },
    { s: 6, dens: 0.3, rLo: 0.7, rHi: 1.4, hLo: 0.1, hHi: 0.4 },
  ],
  rockKeep: { stones: [130, 190], rocks: [150, 220] },       // loose rock stays this far from the camp
  heroes: [],

  // ---- the ground's own dressing
  materials: {
    ...groundMaterials({ key: 'callisto', name: 'Callisto', regolithColor: 0x67625a, rubbleColor: 0x4a4640, regolithKgM3: 1400, rubbleKgM3: 2200,
      note: 'Dark, dust-stained ice gravel: Callisto reflects only 22% of its light. A ten-metre blanket of it over clean ice, pocked everywhere with four billion years of craters.' }),
    // real enough: the bright basin floors are impact-excavated clean water ice (Galileo found the palimpsests bright in ice bands)
    ice: extraMaterial('MAT-CALLISTO-ICE', 'Bright basin ice', 1900, 0.3, 0xa9bac8, 'Clean water ice punched up through the dark crust by the giant impacts: pale blue-grey, hard. Valhalla\'s floor is full of it, a metre under the dust.'),
  },
  look: { k: [0.9, 0.1, 0.06], red: [0.1, 0.15, 0.1], ejecta: { k: 0.3, red: -0.5, centre: 1.3, width: 2.2 } },
  albedoFn, groundAt,
  render: { farColor: 1.0, tierColor: 1.0, regolith: { moon: true, bump: 0.5, pebble: 0.12 } },
  /** under the buildings and the pad: a metre and a half of engineered fill (concrete: not diggable); the footprint test is layout.js's */
  settlement: { depthM: 1.5, solid: (x, z, margin) => solidAt(x, z, margin) },
  /** the Sun and the sky (spaceSky.setSystem): no air; the Sun is 0.10 degrees across at 5.2 AU (0.533 / 5.2) and a twenty-seventh as strong as at Earth */
  sun: { body: sunBodyDir() },
  sky: { star: { color: [1.0, 0.97, 0.9], glow: [1.0, 0.92, 0.78], diskDeg: 0.102, intensity: 1.7 }, fill: { sky: [0.16, 0.17, 0.2], ground: [0.4, 0.4, 0.43], intensity: 0.8 } },
  /** how far up a ship climbs before the main drive takes her, and how high the whole-world ground tiers are kept */
  ascentM: 9000, tierAltM: 250_000,
  sources: [
    { field: 'radius, mass, gravity, rotation period, albedo', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/joviansatfact.html', verified: 'table', note: 'NASA/JPL Satellite Fact Sheet (Callisto): mean radius 2410.3 km, mass 1.0759e23 kg, surface gravity 1.236 m/s2, synchronous rotation 16.689018 d, geometric albedo 0.22: re-confirm by hand (docs/PROVENANCE.md)' },
    { field: 'orbit (a, e, period)', url: 'https://ssd.jpl.nasa.gov/sats/elem/', verified: 'table', note: 'JPL satellite mean elements via the Satellite Fact Sheet: a 1,882,700 km, e 0.0074, period 16.689018 d, inclination to the local Laplace plane 0.19 deg' },
    { field: 'orbit (the plane: i and node in ecliptic elements)', url: 'https://iau-commissions.github.io/CRC3/', verified: 'table', note: "Jupiter's pole RA 268.057 Dec 64.495 (IAU 2015 report, Archinal et al. 2018): the orbit is given in Jupiter's equatorial plane; the game's i/node are that plane's ecliptic elements. Callisto's own 0.19 deg tilt to the plane is not drawn" },
    { field: 'orbit (phase: M0 and the periapsis argument)', url: '', verified: 'invented', note: 'FIT, NOT PUBLISHED: fitted so Callisto sits at a plausible place on the game\'s start date. The real phase needs a JPL Horizons pre-compute (no CORS; REAL-DATA.md)' },
    { field: 'Valhalla (16 N, 57 W, 360 km bright centre, rings to 1,900 km), Asgard (30 N, 139 W, about 1,600 km)', url: 'https://en.wikipedia.org/wiki/Valhalla_(crater)', verified: 'table', note: 'coordinates and sizes from the USGS controlled photomosaic of Callisto (cited there) and Greeley et al. 2000; longitudes converted from the west-positive Callisto convention to the game\'s 0..360 east' },
    { field: 'the surface (dark dust-stained ice, bright crater floors, cratered to saturation; no global height map exists)', url: 'https://en.wikipedia.org/wiki/Callisto_(moon)', verified: 'table', note: 'ground between the named features is the field\'s own cratered ice, not measured terrain (only local stereo patches exist: USGS/Galileo, public domain)' },
    { field: 'the Valhalla Camp, the prospectors\' camp, Mystara and the Unbound seat, the sealed sites, the dead relay, the people', url: '', verified: 'invented', note: 'GAME FICTION (bible v3 sections 4.4 and 7.5)' },
  ],
};
