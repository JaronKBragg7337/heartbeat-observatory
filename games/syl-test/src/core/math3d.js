// ============================================================================
// math3d.js — deterministic noise, seeded RNG, and math helpers.
//
// OWNS: all procedural-noise math and small vector utilities shared by
//       terrain generation (visual mesh) AND terrain collision (analytic).
// DOES NOT OWN: any game state, rendering, or physics stepping.
//
// CRITICAL INVARIANT (from Kurearthis findings): the SAME noise functions here
// are used both to displace planet mesh vertices and to answer collision
// queries analytically. If you change any function here, visuals and collision
// change together and stay in agreement. NEVER give collision its own copy.
//
// Future agents: add new noise types (ridged, crater) here; keep everything
// pure/deterministic (same inputs -> same outputs, no Math.random()).
// ============================================================================

// --- Seeded PRNG (mulberry32) — deterministic streams per seed. -------------
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- 3D value-noise with smooth interpolation. ------------------------------
// Hash is seed-mixed so each body gets unique terrain from its own seed.
function hash3(ix, iy, iz, seed) {
  let h = seed >>> 0;
  h = Math.imul(h ^ ix, 0x27d4eb2d);
  h = Math.imul(h ^ iy, 0x165667b1);
  h = Math.imul(h ^ iz, 0x9e3779b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return ((h >>> 0) / 4294967296) * 2 - 1; // [-1, 1]
}

function smooth(t) { return t * t * (3 - 2 * t); }

export function valueNoise3(x, y, z, seed) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const u = smooth(fx), v = smooth(fy), w = smooth(fz);
  const lerp = (a, b, t) => a + (b - a) * t;
  const c000 = hash3(ix, iy, iz, seed),     c100 = hash3(ix + 1, iy, iz, seed);
  const c010 = hash3(ix, iy + 1, iz, seed), c110 = hash3(ix + 1, iy + 1, iz, seed);
  const c001 = hash3(ix, iy, iz + 1, seed), c101 = hash3(ix + 1, iy, iz + 1, seed);
  const c011 = hash3(ix, iy + 1, iz + 1, seed), c111 = hash3(ix + 1, iy + 1, iz + 1, seed);
  return lerp(
    lerp(lerp(c000, c100, u), lerp(c010, c110, u), v),
    lerp(lerp(c001, c101, u), lerp(c011, c111, u), v),
    w
  );
}

// --- Fractal Brownian Motion over the unit sphere direction. ----------------
// dir must be a UNIT vector (direction from body center). freq scales detail.
export function fbm(dirX, dirY, dirZ, seed, octaves = 5, freq = 2.0, gain = 0.5) {
  let amp = 1, f = freq, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise3(dirX * f + 100, dirY * f + 100, dirZ * f + 100, seed + i * 101);
    norm += amp;
    amp *= gain;
    f *= 2.03;
  }
  return sum / norm; // roughly [-1, 1]
}

// --- Small helpers (plain objects/numbers; THREE.Vector3 used elsewhere). ---
export function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
export function lerpN(a, b, t) { return a + (b - a) * t; }

// Smoothstep between edges (used to flatten landing zones into the terrain).
export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}
