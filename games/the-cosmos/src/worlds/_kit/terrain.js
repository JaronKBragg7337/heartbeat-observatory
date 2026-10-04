// ============================================================================
// worlds/_kit/terrain.js - terrain PROFILES: what kind of ground a world has, as data plus one small relief function.
//
// OWNS: the list of profiles (rocky, ice, desert, volcanic, ocean, asteroid, gas) and what each does to the ground.
// DOES NOT OWN: the shape machinery itself (src/space/moonField.js builds the density field from a world def; a profile only
//   adds to the height of the ground above the world's ellipsoid, or changes the defaults the field starts from).
//
// A profile is { landable, defaults, params, relief }. `defaults` fill in numbers a world def left out (craterDensity,
// roughScale, ...). `relief(ctx)` returns EXTRA metres of height at a point; ctx is { px, py, pz, seed, Rm, p } where
// (px,py,pz) is the point on the ellipsoid in the body frame (metres), Rm the mean radius, p the world's own `terrain`
// parameters (merged over the profile's `params`). It must be a pure, deterministic function of those: the server and every
// phone must get the same ground. The `rocky` profile adds nothing, which is how Phobos and Deimos stay exactly as they were.
//
// HONEST STATE: these profiles are first-pass shapes (correct scale, continuous, deterministic, walkable). They have not been
// art-directed; the world's own builder tunes `terrain:{...}` and, if a profile is not enough, adds a profile here.
// ============================================================================

// the same value noise moonField.js uses, repeated here so the kit stays importable on its own (a profile must agree with itself
// between server and client, nothing more)
function hash3(ix, iy, iz, seed) {
  let h = seed | 0;
  h = Math.imul(h ^ (ix | 0), 0x27d4eb2d); h = Math.imul(h ^ (iy | 0), 0x165667b1); h = Math.imul(h ^ (iz | 0), 0x9e3779b1);
  h ^= h >>> 15; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}
const quint = (t) => t * t * t * (t * (t * 6 - 15) + 10);
export function noise3(x, y, z, seed) {                                 // -1..1
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz, u = quint(fx), v = quint(fy), w = quint(fz);
  const c = (a, b, d) => hash3(ix + a, iy + b, iz + d, seed) * 2 - 1;
  const x00 = c(0, 0, 0) + (c(1, 0, 0) - c(0, 0, 0)) * u, x10 = c(0, 1, 0) + (c(1, 1, 0) - c(0, 1, 0)) * u;
  const x01 = c(0, 0, 1) + (c(1, 0, 1) - c(0, 0, 1)) * u, x11 = c(0, 1, 1) + (c(1, 1, 1) - c(0, 1, 1)) * u;
  const y0 = x00 + (x10 - x00) * v, y1 = x01 + (x11 - x01) * v;
  return y0 + (y1 - y0) * w;
}
export function fbm(x, y, z, seed, oct) {
  let s = 0, a = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += noise3(x, y, z, seed + i * 1013) * a; n += a; a *= 0.5; x *= 2.03; y *= 2.03; z *= 2.03; }
  return s / n;
}
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export const PROFILES = {
  /** Cratered rock under a regolith blanket: the moons' own ground. Adds nothing (the crater, groove and roughness code is the profile). */
  rocky: { landable: true, defaults: {}, params: {}, relief: null },

  /** Ice shell: few, soft craters, long fractures (lineae) and low pressure ridges. */
  ice: {
    landable: true,
    defaults: { craterDensity: 0.22, craterScale: 0.7, roughScale: 0.35, regolithDepthM: 12, grooves: false },
    params: { crackM: 38, crackWidth: 0.035, crackScaleM: 90_000, ridgeM: 55, ridgeScaleM: 6_000 },
    relief({ px, py, pz, seed, p }) {
      const k = 1 / p.crackScaleM, n = noise3(px * k, py * k, pz * k, seed + 211);        // a crack runs where the noise crosses zero
      const crack = Math.exp(-((n / p.crackWidth) ** 2));
      const r = 1 / p.ridgeScaleM, ridge = fbm(px * r, py * r, pz * r, seed + 223, 3);
      return -p.crackM * crack + p.ridgeM * 0.5 * ridge;
    },
  },

  /** Dune fields over a cratered plain: long wind-aligned ridges that stay walkable (slope under about 20 degrees). */
  desert: {
    landable: true,
    defaults: { craterDensity: 0.14, craterScale: 0.35, roughScale: 0.6, regolithDepthM: 40, grooves: false },
    params: { duneM: 42, duneWavelengthM: 900, windDeg: 35, dunefieldScaleM: 40_000 },
    relief({ px, py, pz, seed, p }) {
      const a = p.windDeg * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
      const across = (px * ca + pz * sa) / p.duneWavelengthM;                             // distance across the wind, in wavelengths
      const field = sstep(-0.1, 0.35, fbm(px / p.dunefieldScaleM, py / p.dunefieldScaleM, pz / p.dunefieldScaleM, seed + 301, 2));
      const warp = noise3(px / 3000, py / 3000, pz / 3000, seed + 307) * 0.8;
      const ridge = 1 - Math.abs(Math.sin((across + warp) * Math.PI));                    // a sharp crest, a rounded trough
      return p.duneM * field * (ridge * ridge - 0.33);
    },
  },

  /** Volcanic: broad shield cones with calderas, lava ridges and a rough, young surface. */
  volcanic: {
    landable: true,
    defaults: { craterDensity: 0.08, craterScale: 0.5, roughScale: 1.4, regolithDepthM: 6, grooves: false },
    params: { coneM: 2400, coneScaleM: 60_000, calderaFrac: 0.12, flowM: 22, flowScaleM: 700 },
    relief({ px, py, pz, seed, p }) {
      const k = 1 / p.coneScaleM, n = fbm(px * k, py * k, pz * k, seed + 401, 3);
      const cone = Math.pow(Math.max(0, n - 0.05) / 0.95, 1.6);                           // 0 away from a volcano, 1 at its summit
      const crown = sstep(1 - p.calderaFrac * 2, 1 - p.calderaFrac, cone);               // a caldera floor sinks the very top
      const flow = fbm(px / p.flowScaleM, py / p.flowScaleM, pz / p.flowScaleM, seed + 409, 3);
      return p.coneM * cone * (1 - 0.25 * crown) + p.flowM * flow * (0.4 + cone);
    },
  },

  /** Ocean world: a sea level, islands and shelves above it. Below sea level the ground is the sea floor (swimming is a later package). */
  ocean: {
    landable: true,
    defaults: { craterDensity: 0.03, craterScale: 0.4, roughScale: 0.4, regolithDepthM: 30, grooves: false },
    params: { seaLevelM: 0, islandM: 180, floorM: -900, islandScaleM: 18_000, shelf: 0.55 },
    relief({ px, py, pz, seed, p }) {
      const k = 1 / p.islandScaleM, n = fbm(px * k, py * k, pz * k, seed + 501, 4);
      const land = n - p.shelf * 0.5;                                                     // most of the world is under water
      const h = land > 0 ? p.islandM * Math.sqrt(land / (1 - p.shelf * 0.5)) : p.floorM * Math.min(1, -land * 3);
      return p.seaLevelM + h;
    },
  },

  /** Small, lumpy, heavily cratered body. */
  asteroid: {
    landable: true,
    defaults: { craterDensity: 0.7, craterScale: 1.1, roughScale: 1.2, regolithDepthM: 8 },
    params: {},
    relief: null,
  },

  /** WD-MOON: ground read from measured data. The def supplies `terrain.height(px, py, pz)` (a pure function of a point on the ellipsoid, in the body frame, metres)
   *  and its metres are added to the sphere; the world's craters, rocks and roughness still ride on top. Used by the Moon (LRO LOLA, worlds/moon/lola.js). */
  sampled: {
    landable: true,
    defaults: { craterDensity: 0.5, craterScale: 1, roughScale: 0.8, regolithDepthM: 6, grooves: false },
    params: { height: null },
    relief({ px, py, pz, p }) { return p.height ? p.height(px, py, pz) : 0; },
  },

  /** A gas or ice giant: no ground. Listed in the nav, orbit and skim only (no frame is ever built for it). */
  gas: { landable: false, defaults: {}, params: {}, relief: null },
};

export const profileOf = (def) => {
  const id = (def.terrain && def.terrain.profile) || 'rocky';
  const p = PROFILES[id];
  if (!p) throw new Error(`world ${def.id}: unknown terrain profile '${id}' (have: ${Object.keys(PROFILES).join(', ')})`);
  return { id, ...p };
};
/** The numbers a profile's relief reads: its own defaults under whatever the world def's `terrain` object says. */
export const profileParams = (def) => ({ ...profileOf(def).params, ...(def.terrain || {}) });
/** A def's value for a field the field builder reads, falling back to its profile's default, then to the machinery's own default. */
export const pick = (def, key, fallback) => {
  if (def[key] !== undefined) return def[key];
  const d = profileOf(def).defaults;
  return d[key] !== undefined ? d[key] : fallback;
};
