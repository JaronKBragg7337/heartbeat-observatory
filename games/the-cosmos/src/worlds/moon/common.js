// ============================================================================
// worlds/moon/common.js - what the Moon's three landings share: the Moon itself (size, mass, day, orbit: NASA's fact sheet), the real ground
// (LRO LOLA heights, LROC brightness and Shackleton's year of sunlight: lola.js) and the way each landing is described to the registry.
//
// WHY THREE WORLDS FOR ONE MOON (docs/ADD-A-WORLD.md allows one pad per world and a course lands at that pad). The Moon is 10,900 km round and
//   its two capitals are on opposite sides of it, so each capital gets a frame of its own and the three frames lie on top of each other:
//     `moon`            Tranquility Civil Hub (near side, neutral: where a new pilot lands and where both blocs recruit)
//     `moon-shackleton` Shackleton Base, Fortis (the south pole)
//     `moon-daedalus`   Daedalus Station, Technos Prime (the far side)
//   All three give the same centre, the same orbit and the same turn, so they are one body in the sky; they share one region (`region: 'moon'`,
//   src/space/jump.js): one lane gate from Mars, and a course between two landings is an ordinary hop inside the region. A hole dug at
//   Shackleton is not in the Tranquility frame's copy of the ground: the sites are thousands of kilometres apart, and nobody can see one
//   from the other.
// WHAT IS REAL AND WHAT IS NOT (every number says which; `sources` in each def)
//   Real: the Moon's radius, mass, gravity, orbit and day (NASA Moon Fact Sheet, fetched 2026-10-03); the heights (LOLA) and brightness (LROC);
//   where Shackleton's shadows fall and how long the Sun stays on its rim (worked out from the LOLA heights: tools/bake-lola.mjs).
//   Game fiction: Tranquility Civil Hub, Shackleton Base, Daedalus Station, the blocs, the lunars, the lane, every person.
// ============================================================================
import { heightAt, albedoAt, illumAt, windowAt } from './lola.js';
import { groundMaterials, extraMaterial } from '../_kit/materials.js';

const DEG = Math.PI / 180;
export const MOON = {
  radiusM: 1_737_400,          // volumetric mean radius (NASA fact sheet; also LOLA's reference sphere)
  massKg: 7.346e22,            // 0.07346e24 kg (NASA)
  siderealDayS: 655.72 * 3600, // 27.3217 days: the Moon turns once per orbit, so the same face looks at Earth (NASA: 655.720 h)
  obliquityDeg: 6.68,          // to its orbit (NASA)
  synodicDayS: 29.53 * 86400,  // Sun to Sun at one place: a lunar day-and-night is 29.5 Earth days
  // Meeus, "Astronomical Algorithms", mean elements for the Moon's orbit round the Earth (a 384,399 km, e 0.0549, inclination 5.145 deg to the ecliptic, ...)
  orbit: { parent: 'earth', frame: 'ecliptic', a: 384_399_000, e: 0.0549, i: 5.145, meanLon: 218.3164477, lonPeri: 83.3532465, node: 125.0445479,
    rates: { a: 0, e: 0, i: 0, meanLon: 481267.88123421, lonPeri: 4069.0137287, node: -1934.1362891 } },
};

/** The three landings, in the order the nav lists them. */
export const SITES = {
  moon: { id: 'moon', short: 'Tranquility', place: 'Tranquility Civil Hub', order: 40, pad: { lat: 0.700, lon: 23.500 } },
  'moon-shackleton': { id: 'moon-shackleton', short: 'Shackleton', place: 'Shackleton Base', order: 41, pad: { lat: -89.38607, lon: 155.23042 } },
  'moon-daedalus': { id: 'moon-daedalus', short: 'Daedalus', place: 'Daedalus Station', order: 42, pad: { lat: -6.03123, lon: 178.53787 } },
};

const dirOf = (la, lo) => [Math.cos(la * DEG) * Math.cos(lo * DEG), Math.cos(la * DEG) * Math.sin(lo * DEG), Math.sin(la * DEG)];
/** The Sun, as a unit vector in the Moon's body axes, for someone standing at (lat, lon) who sees it `elevDeg` over the horizon at compass bearing `azDeg` (0 north, 90 east). */
export function sunBody(lat, lon, elevDeg, azDeg) {
  const la = lat * DEG, lo = lon * DEG, up = dirOf(lat, lon);
  const east = [-Math.sin(lo), Math.cos(lo), 0], north = [-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la)];
  const e = elevDeg * DEG, a = azDeg * DEG, h = Math.cos(e);
  return [0, 1, 2].map((i) => Math.sin(e) * up[i] + h * (Math.cos(a) * north[i] + Math.sin(a) * east[i]));
}
/** Which way Earth is, in body axes: the Moon keeps one face to it, so it is the mean direction of longitude 0, latitude 0. (Libration, up to 7 degrees either way, is not drawn.) */
export const EARTH_BODY = [1, 0, 0];

// ---- the ground ---------------------------------------------------------------------------------------------------------
const latLon = (px, py, pz) => { const r = Math.hypot(px, py, pz) || 1; return [Math.asin(Math.max(-1, Math.min(1, pz / r))) / DEG, Math.atan2(py, px) / DEG]; };
/** Metres above the sphere at a point on the body (the `sampled` terrain profile). */
export const groundHeight = (px, py, pz) => { const [la, lo] = latLon(px, py, pz); return heightAt(la, lo); };

/** Brightness for the shell and the tiers (moonField.js `albedoFn`): the LROC map, with the same patchy dust the other moons have on top. */
function albedoFn(q, k0, red0, lo, mid, out) {
  const [la, lon] = latLon(q[0], q[1], q[2]);
  const a = albedoAt(la, lon);                       // 0.3 in a mare, 0.7 in the highlands, 0.85 on a fresh ray
  out.k = (0.42 + 1.18 * a) * (1 + 0.10 * lo + 0.07 * mid);
  out.red = 0.05 + 0.10 * (0.5 - a);                 // the maria are a touch warmer than the highlands
}

/** Ice: under a dry skin, in the ground the Sun has never touched (Shackleton's window: the horizon never lets it rise). `n` is a -1..1 noise so the edge is ragged. */
function groundAt(q, depth, reg, n) {
  const [la, lon] = latLon(q[0], q[1], q[2]);
  if (la > -88.5 || depth < 0.3 + 0.35 * (0.5 + 0.5 * n)) return null;
  const ill = illumAt(la, lon);
  return ill !== null && ill < 0.0156 + 0.02 * n ? 'ice' : null;
}

export const MATERIALS = {
  ...groundMaterials({ key: 'moon', name: 'Lunar', regolithColor: 0x8e8c87, rubbleColor: 0x6a6965, regolithKgM3: 1500, rubbleKgM3: 2400,
    note: 'Fine, sharp, grey dust, welded by meteorites for four billion years: a few metres of it over broken rock (Apollo measured about 1.5 g/cm3 at the surface).' }),
  // GAME FICTION: ice-rich regolith. The real fact is the ice itself: LCROSS (2009) found water in Cabeus's shadow and LOLA/LEND/Mini-RF maps say where it is likely; how much is an estimate.
  ice: extraMaterial('MAT-MOON-ICE', 'Lunar polar ice', 1700, 0.55, 0xc9d4de, "Water ice frozen into the dust in the permanent shadows at the south pole: pale, hard, and cold enough to crack a glove. The Moon's only water, and the most valuable ground on it (LCROSS found it in 2009; how much there is remains an estimate)."),
};

/**
 * One landing's def. `o`: { site, name, navName, blurb, sun: { elevDeg, azDeg }, pad: { flatM, blendM }, settlement, rocks, landmarks, render, sources, extra }.
 * The first landing (`moon`) owns the materials; the others name them.
 */
export function moonDef(o) {
  const S = SITES[o.site], first = o.site === 'moon';
  const sun = sunBody(S.pad.lat, S.pad.lon, o.sun.elevDeg, o.sun.azDeg);
  return {
    id: S.id, name: o.name, designation: 'LUNA', kind: 'moon', order: S.order, ...(o.regionName ? { regionName: o.regionName } : {}),
    navName: o.navName, blurb: o.blurb, jump: true, region: 'moon',
    // ---- shape and mass: NASA's Moon Fact Sheet (a sphere of the volumetric mean radius; the real flattening is 0.0012)
    radiusM: MOON.radiusM, massKg: MOON.massKg,
    orbit: MOON.orbit,
    rotation: { lockedTo: 'parent', periodS: MOON.siderealDayS, axialTiltDeg: MOON.obliquityDeg },
    // ---- ground: the real heights, then craters from a kilometre down, then rocks and grit
    seed: 6000 + (first ? 1 : o.site === 'moon-shackleton' ? 2 : 3),
    terrain: { profile: 'sampled', height: groundHeight },
    regolithDepthM: 6,
    craterDensity: 0.55, craterScale: 1.0, cellScale: 1.0, roughScale: 0.8, grooves: false,
    cells: [2100, 1050, 520, 260, 130, 64, 32, 16],
    depthRatio: (D) => (D < 300 ? 0.2 : D < 3000 ? 0.2 - 0.07 * Math.min(1, (D - 300) / 2700) : 0.12),
    lump: 0, lump2: 0,
    landmarks: o.landmarks || [],
    pad: { lat: S.pad.lat, lon: S.pad.lon, flatM: o.pad.flatM, blendM: o.pad.blendM, name: S.place },
    derelict: null,
    rocks: o.rocks || [
      { s: 60, dens: 0.32, rLo: 3, rHi: 7, hLo: 0.7, hHi: 1.8 },
      { s: 14, dens: 0.4, rLo: 1.4, rHi: 3, hLo: 0.3, hHi: 0.9 },
      { s: 6, dens: 0.3, rLo: 0.7, rHi: 1.4, hLo: 0.1, hHi: 0.4 },
    ],
    rockKeep: o.rockKeep || { stones: [150, 200], rocks: [170, 235] },
    heroes: [],
    materials: first ? MATERIALS : { regolith: 'moonRegolith', rubble: 'moonRubble', ice: 'moonIce' },
    ...(first ? { worldIndex: 61 } : {}),
    look: { k: [1, 0.1, 0.06], red: [0.05, 0.15, 0.1] },
    albedoFn, groundAt,
    render: o.render || { farColor: 1.9, tierColor: 1.8, regolith: { moon: true, bump: 0.5, pebble: 0.2 } },
    settlement: o.settlement || null,
    // the Sun is fixed for play (a lunar day is 29.5 Earth days, so it barely moves in a session): where it stands is each landing's own choice
    sun: { body: sun },
    sky: { star: { color: [1.0, 0.985, 0.94], glow: [1.0, 0.94, 0.84], diskDeg: 0.53, intensity: 2.7 }, fill: { sky: [0.17, 0.175, 0.19], ground: [0.38, 0.37, 0.35], intensity: 0.8, ...(o.fill || {}) } },
    ascentM: 9000, tierAltM: 250_000,
    sources: [
      { field: 'radius, mass, gravity, rotation, tilt, orbit', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html', verified: 'live', note: 'fetched 2026-10-03: mass 0.07346e24 kg, volumetric mean radius 1737.4 km, surface gravity 1.62 m/s2, sidereal rotation 655.720 h, obliquity to orbit 6.68 deg, inclination 5.145 deg, eccentricity 0.0549, semimajor axis 0.3844e6 km (the orbit elements are Meeus)' },
      { field: 'heights', url: 'https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/', verified: 'live', note: 'fetched 2026-10-03: LDEM_16, LDEM_64, LDEM_128 and LDEM_80S_80M (NASA LRO LOLA GDR, public domain), pooled and cut into three windows by tools/bake-lola.mjs; labels read for the scale and offset (0.5 m, 1737.4 km)' },
      { field: 'brightness', url: 'https://svs.gsfc.nasa.gov/4720', verified: 'live', note: 'fetched 2026-10-03: the LROC WAC global mosaic (NASA/GSFC/Arizona State University), 1k, as grey at one pixel per degree' },
      { field: "Shackleton's shadows and sunlight", url: '', verified: 'table', note: 'worked out from the LOLA heights by horizon tracing (the Sun swings +-1.54 deg over a year, 0.27 deg radius): the baked result agrees with the published picture (the rim crest lit for most of the year, the floor never)' },
      { field: 'Tranquility Civil Hub, Shackleton Base, Daedalus Station, the blocs, the lunars, the lane, the people', url: '', verified: 'invented', note: 'GAME FICTION (bible v3 sections 4.2 and 7.3)' },
      ...(o.sources || []),
    ],
    ...(o.extra || {}),
  };
}
export { windowAt };
