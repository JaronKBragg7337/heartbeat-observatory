// ============================================================================
// field.js — the planet is a volume of material, not a skin over nothing.
//
// OWNS: the authoritative answer to "what is at this exact point in space?" —
//       solid or void, which material, how deep, how strong.
// DOES NOT OWN: how any of it is drawn (planetMesh.js) or walked on (walker.js).
//       Those are consumers. This file is the truth they both read.
//
// WHY THIS SHAPE, AND WHY NOW
// ---------------------------
// The obvious way to build a planet is `radiusAt(direction)` — one ground
// height per compass direction. It is simpler, it renders fine, and it is a
// dead end, because it can only ever describe ONE surface along any line from
// the centre. A cave needs two. A tunnel needs two. An overhang needs two. A
// mineshaft with a room at the bottom needs four.
//
// There is no patch for that. The representation itself forbids it, so every
// system built on top — collision, the player's feet, the ship's landing
// clamp, navigation — gets rewritten the day you want a hole in the ground.
// That is the exact failure this project exists to avoid: doing the small
// thing first and finding out the big thing was never reachable from it.
//
// So the primitive here is a scalar field over 3D space:
//
//     density(p)  <  0   solid rock
//     density(p)  >  0   open air
//     density(p) === 0   the surface, wherever it happens to be
//
// A cave is not a special case. It is a region where the field went positive
// underground. The renderer and the collider both just find zero crossings,
// and neither one needs to know whether it is looking at a hillside, a cliff
// overhang, or the roof of a lava tube.
//
// PERFORMANCE
// -----------
// The field is evaluated, never stored. No voxel array is allocated for a
// planet 3,389 km across — that would be absurd on a phone or anywhere else.
// Marching uses the field's own magnitude as a safe step distance (sphere
// tracing), so empty sky is crossed in a handful of samples and cost is paid
// only near geometry.
//
// DETERMINISM
// -----------
// Same seed, same coordinate, same answer, forever, on every device. No
// Math.random anywhere in this file. That is what makes a coordinate a
// permanent address instead of a temporary one.
// ============================================================================

import { cartesianToGeodetic } from './geodesy.js';

// ---------------------------------------------------------------------------
// Deterministic value noise. Cheap, stable, no dependencies.
// ---------------------------------------------------------------------------
function hash3(ix, iy, iz, seed) {
  let h = seed | 0;
  h = Math.imul(h ^ (ix | 0), 0x27d4eb2d);
  h = Math.imul(h ^ (iy | 0), 0x165667b1);
  h = Math.imul(h ^ (iz | 0), 0x9e3779b1);
  h ^= h >>> 15;
  return ((h >>> 0) / 4294967296) * 2 - 1;      // -1..1
}

const smooth = (t) => t * t * t * (t * (t * 6 - 15) + 10);

function noise3(x, y, z, seed) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const u = smooth(fx), v = smooth(fy), w = smooth(fz);

  const c000 = hash3(ix, iy, iz, seed),         c100 = hash3(ix + 1, iy, iz, seed);
  const c010 = hash3(ix, iy + 1, iz, seed),     c110 = hash3(ix + 1, iy + 1, iz, seed);
  const c001 = hash3(ix, iy, iz + 1, seed),     c101 = hash3(ix + 1, iy, iz + 1, seed);
  const c011 = hash3(ix, iy + 1, iz + 1, seed), c111 = hash3(ix + 1, iy + 1, iz + 1, seed);

  const x00 = c000 + (c100 - c000) * u, x10 = c010 + (c110 - c010) * u;
  const x01 = c001 + (c101 - c001) * u, x11 = c011 + (c111 - c011) * u;
  const y0 = x00 + (x10 - x00) * v,     y1 = x01 + (x11 - x01) * v;
  return y0 + (y1 - y0) * w;
}

function fbm(x, y, z, seed, octaves = 5, lacunarity = 2.03, gain = 0.5) {
  let sum = 0, amp = 1, norm = 0, fx = x, fy = y, fz = z;
  for (let i = 0; i < octaves; i++) {
    sum += noise3(fx, fy, fz, seed + i * 1013) * amp;
    norm += amp;
    amp *= gain;
    fx *= lacunarity; fy *= lacunarity; fz *= lacunarity;
  }
  return sum / norm;                              // -1..1
}

// Ridged noise: sharp crests instead of rolling hills. This is what makes
// canyon walls and volcanic ridges read as rock rather than as dough.
function ridged(x, y, z, seed, octaves = 4) {
  let sum = 0, amp = 1, norm = 0, fx = x, fy = y, fz = z;
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(noise3(fx, fy, fz, seed + i * 7717));
    sum += n * n * amp;
    norm += amp;
    amp *= 0.5;
    fx *= 2.07; fy *= 2.07; fz *= 2.07;
  }
  return (sum / norm) * 2 - 1;
}

// ---------------------------------------------------------------------------
// MATERIALS — every layer is a real substance with real numbers.
// Densities are the honest ones for the rock type; strength is a relative
// mining-resistance scalar used by excavation later.
// ---------------------------------------------------------------------------
export const MATERIALS = {
  regolith: {
    id: 'MAT-REGOLITH', name: 'Martian regolith',
    densityKgM3: 1520, strength: 0.15, color: 0xb2673f, roughness: 0.96,
    note: 'Fine iron-oxide dust and sand. Loose, easily excavated, poor support.',
  },
  duricrust: {
    id: 'MAT-DURICRUST', name: 'Duricrust',
    densityKgM3: 1900, strength: 0.30, color: 0xa35f39, roughness: 0.90,
    note: 'Salt-cemented surface crust. Holds a cut face briefly.',
  },
  basalt: {
    id: 'MAT-BASALT', name: 'Basalt',
    densityKgM3: 2900, strength: 0.75, color: 0x5d5049, roughness: 0.72,
    note: 'Volcanic bedrock. Load-bearing. Tunnels hold without support.',
  },
  ironOxide: {
    id: 'MAT-HEMATITE', name: 'Hematite deposit',
    densityKgM3: 5150, strength: 0.65, color: 0x7a2f22, roughness: 0.55,
    note: 'Iron ore. Economically extractable.',
  },
  waterIce: {
    id: 'MAT-ICE', name: 'Subsurface water ice',
    densityKgM3: 917, strength: 0.25, color: 0xc8dbe0, roughness: 0.35,
    note: 'Buried ice. Real on Mars at these latitudes. Sublimates if exposed.',
  },
  mantle: {
    id: 'MAT-MANTLE', name: 'Mantle rock',
    densityKgM3: 3400, strength: 1.0, color: 0x3b302c, roughness: 0.8,
    note: 'Below the crust. Immutable boundary — cannot be excavated.',
  },
};

// ---------------------------------------------------------------------------
// TERRAIN ENVELOPE — the broad shape, in metres above the datum.
// This is the low-frequency landscape: basins, rises, canyon systems. It is
// still a function of direction, but it is only ONE INPUT to the field below,
// not the field itself. That distinction is the whole point.
// ---------------------------------------------------------------------------
export function elevationAt(body, dirX, dirY, dirZ) {
  const t = body.terrain;

  // Frequencies are chosen by WAVELENGTH ON THE GROUND, not by taste. For a
  // unit direction vector, k = 2*pi*R / lambda. Writing them this way is the
  // only way to know what a term will actually look like to someone standing
  // on the surface — the first version of this function used k = 34, which
  // sounds like "fine detail" and is really a 630 km feature. Measured across
  // an 800 m patch it produced 4.5 m of relief: a flat, dead plain.
  const R = body.radiusMean;
  const k = (lambdaM) => (2 * Math.PI * R) / lambdaM;

  const kContinent = k(9_000_000);   // whole-hemisphere highlands vs basins
  const kProvince  = k(1_200_000);   // volcanic provinces, canyon systems
  const kRegion    = k(140_000);     // ranges and large craters
  const kHill      = k(9_000);       // hills you walk over
  const kDune      = k(900);         // dunes and ridges you walk around
  const kRock      = k(120);         // ground roughness underfoot

  const continent = fbm(dirX * kContinent, dirY * kContinent, dirZ * kContinent, t.seed, 3);
  const province  = fbm(dirX * kProvince, dirY * kProvince, dirZ * kProvince, t.seed + 17, 3);
  const region    = ridged(dirX * kRegion, dirY * kRegion, dirZ * kRegion, t.seed + 91, 3);
  const hill      = fbm(dirX * kHill, dirY * kHill, dirZ * kHill, t.seed + 313, 3);
  const dune      = ridged(dirX * kDune, dirY * kDune, dirZ * kDune, t.seed + 577, 2);
  const rock      = fbm(dirX * kRock, dirY * kRock, dirZ * kRock, t.seed + 1201, 2);

  // Continental scale sets whether we are in highlands or a basin.
  let h = continent * t.localRelief * 2.2;
  h += province * t.localRelief * 1.4;

  // Ridges only bite in the highlands, which is how real volcanic provinces sit.
  const highland = Math.max(0, continent);
  h += region * t.localRelief * 0.9 * highland;

  // The scales a person on foot actually experiences.
  h += hill * 240;
  h += dune * 16;
  h += rock * 2.4;

  return h;
}

// ---------------------------------------------------------------------------
// STRATA — which material is at a given depth below the local surface.
// Real Mars ordering: dust over crust over bedrock, with ice at depth in the
// mid latitudes and ore in veins.
// ---------------------------------------------------------------------------
export function materialAtDepth(body, depthM, px, py, pz, latDeg) {
  if (depthM > body.terrain.crustThickness) return MATERIALS.mantle;

  // Ore veins: rare, 3D, and genuinely volumetric — a vein can sit inside solid
  // rock with nothing on the surface to show for it.
  const vein = ridged(px * 2.6e-4, py * 2.6e-4, pz * 2.6e-4, body.terrain.seed + 5501, 3);
  if (depthM > 12 && vein > 0.62) return MATERIALS.ironOxide;

  // Buried ice: latitude dependent, as observed. Poleward of ~45° it is shallow.
  const absLat = Math.abs(latDeg);
  const iceDepth = absLat > 45 ? 1.5 : absLat > 30 ? 12 : 60;
  if (depthM > iceDepth) {
    const icePatch = fbm(px * 9e-5, py * 9e-5, pz * 9e-5, body.terrain.seed + 77, 3);
    if (icePatch > (absLat > 45 ? -0.15 : 0.42)) return MATERIALS.waterIce;
  }

  if (depthM < 0.9) return MATERIALS.regolith;
  if (depthM < 4.5) return MATERIALS.duricrust;
  return MATERIALS.basalt;
}

// ---------------------------------------------------------------------------
// CAVES — carved in 3D, which is the thing a height shell can never do.
//
// Tube caves are found where two independent ridged fields are both near their
// crest. That intersection naturally produces long, winding, branching conduits
// rather than blobs, and it costs two noise evaluations.
// ---------------------------------------------------------------------------
// Cave SIZE is governed by CAVE_SCALE (how big a noise cell is), not by
// CAVE_HEIGHT — that only scales the field magnitude for ray stepping. A
// 6 km cell produced 700 m caverns; 1.4 km cells produce lava-tube geometry.
const CAVE_SCALE = 7.0e-4;      // ~1.4 km per noise cell
const CAVE_CEILING = 45;        // minimum rock roof over any void, metres
const CAVE_FLOOR = 3000;        // no natural voids below 3 km depth
const CAVE_HEIGHT = 12;         // field magnitude scale inside a void

export function caveOpenness(body, px, py, pz, depthM) {
  if (depthM < CAVE_CEILING || depthM > CAVE_FLOOR) return -1;

  const a = ridged(px * CAVE_SCALE, py * CAVE_SCALE, pz * CAVE_SCALE, body.terrain.seed + 2207, 3);
  const b = ridged(px * CAVE_SCALE * 1.37 + 133.7, py * CAVE_SCALE * 1.37,
                   pz * CAVE_SCALE * 1.37, body.terrain.seed + 8821, 3);

  // Both near crest -> a conduit. Taking the min sharpens the intersection into
  // a winding tube rather than a blob.
  const conduit = Math.min(a, b);

  // Fade the void out near the ceiling and floor limits so caves close
  // gracefully instead of being cut off mid-air, and so every void keeps a
  // real rock roof over it rather than a 6 m lid that would collapse.
  const ceilFade = Math.min(1, (depthM - CAVE_CEILING) / 120);
  const floorFade = Math.min(1, (CAVE_FLOOR - depthM) / 500);

  return (conduit - 0.58) * ceilFade * floorFade;
}

// ---------------------------------------------------------------------------
// THE FIELD ITSELF.
//
// Negative inside solid material, positive in open space, and approximately
// metric near the surface so it can be sphere-traced.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// PERSISTENT EDITS
// The base geology above is procedural and immutable. Anything a player digs
// or dumps lives in an EditStore attached here. Because it is applied inside
// density(), a hole is real to EVERYTHING at once — the renderer, the
// collider, the material query, the ground the feet stand on. There is no
// separate "hole mesh" that could disagree with where you can walk.
// ---------------------------------------------------------------------------
let _edits = null;
export function attachEdits(store) { _edits = store; }
export function getEdits() { return _edits; }

export function density(body, px, py, pz, scratch = {}) {
  const base = baseDensity(body, px, py, pz, scratch);
  if (_edits && !_edits.isEmpty) return _edits.apply(base, px, py, pz);
  return base;
}

function baseDensity(body, px, py, pz, scratch = {}) {
  const r = Math.hypot(px, py, pz);
  if (r < 1e-6) return -body.radiusMean;              // dead centre: solid

  const inv = 1 / r;
  const dx = px * inv, dy = py * inv, dz = pz * inv;

  const g = cartesianToGeodetic(body, px, py, pz, scratch);
  const groundElev = elevationAt(body, dx, dy, dz);

  // Positive above ground, negative below. This is the base solid/void split.
  let d = g.alt - groundElev;

  const depth = -d;
  if (depth > 0) {
    // Underground: a cave can flip the sign back to open.
    const open = caveOpenness(body, px, py, pz, depth);
    if (open > 0) d = open * CAVE_HEIGHT;             // scale to rough metres

    // Below the crust nothing is ever open. This is the unmineable boundary,
    // expressed as a material rule rather than an invisible wall.
    if (depth > body.terrain.crustThickness) d = -(depth - body.terrain.crustThickness) - 1;
  }

  return d;
}

/** Material at a point. Only meaningful where density < 0. */
export function materialAt(body, px, py, pz) {
  const r = Math.hypot(px, py, pz) || 1;
  const g = cartesianToGeodetic(body, px, py, pz);
  const groundElev = elevationAt(body, px / r, py / r, pz / r);
  const depth = groundElev - g.alt;
  return materialAtDepth(body, Math.max(0, depth), px, py, pz, g.lat);
}

/**
 * March a ray through the field and return EVERY solid/void transition, in
 * order. This is what makes caves real to the rest of the engine: a ray from
 * space to the core through a lava tube reports four crossings, not one.
 *
 * @returns Array<{ t, kind: 'enter'|'exit', point:{x,y,z} }>
 */
export function raycast(body, ox, oy, oz, dx, dy, dz, maxDist, opts = {}) {
  const minStep = opts.minStep || 0.35;
  const maxStep = opts.maxStep || 5000;
  const maxSamples = opts.maxSamples || 900;
  const hits = [];
  const scratch = {};

  let t = 0;
  let prev = density(body, ox, oy, oz, scratch);
  let wasSolid = prev < 0;

  for (let i = 0; i < maxSamples && t < maxDist; i++) {
    // Sphere tracing: the field magnitude is a safe distance to jump.
    const step = Math.max(minStep, Math.min(maxStep, Math.abs(prev) * 0.85));
    const nt = Math.min(t + step, maxDist);
    const nx = ox + dx * nt, ny = oy + dy * nt, nz = oz + dz * nt;
    const cur = density(body, nx, ny, nz, scratch);
    const isSolid = cur < 0;

    if (isSolid !== wasSolid) {
      // Bisect the bracketed crossing to sub-centimetre precision.
      let lo = t, hi = nt, dlo = prev;
      for (let k = 0; k < 24; k++) {
        const mid = (lo + hi) * 0.5;
        const dm = density(body, ox + dx * mid, oy + dy * mid, oz + dz * mid, scratch);
        if ((dm < 0) === (dlo < 0)) { lo = mid; dlo = dm; } else { hi = mid; }
        if (hi - lo < 0.005) break;
      }
      const tc = (lo + hi) * 0.5;
      hits.push({
        t: tc,
        kind: isSolid ? 'enter' : 'exit',
        point: { x: ox + dx * tc, y: oy + dy * tc, z: oz + dz * tc },
      });
      wasSolid = isSolid;
      if (opts.firstOnly) return hits;
    }

    t = nt; prev = cur;
  }
  return hits;
}

/**
 * The ground under a position: the first solid surface found looking straight
 * down. Returns null if there is no ground below within range (standing over a
 * shaft, for instance).
 */
export function groundBelow(body, px, py, pz, maxDrop = 6000) {
  // A ray that STARTS inside material never reports an 'enter' — it is already
  // past it. Standing exactly on the surface is the single most common query
  // in the game, so this case is answered directly instead of being marched.
  // Without this the feet oscillate: contact is missed, gravity pulls in, the
  // solid-push backstop shoves back out, forever.
  if (density(body, px, py, pz) <= 0) {
    return {
      point: { x: px, y: py, z: pz },
      distance: 0,
      material: materialAt(body, px, py, pz),
      startedInside: true,
    };
  }

  const r = Math.hypot(px, py, pz) || 1;
  const dx = -px / r, dy = -py / r, dz = -pz / r;      // toward the centre
  const hits = raycast(body, px, py, pz, dx, dy, dz, maxDrop, { firstOnly: true, minStep: 0.25 });
  const enter = hits.find((h) => h.kind === 'enter');
  if (!enter) return null;
  return {
    point: enter.point,
    distance: enter.t,
    material: materialAt(body, enter.point.x, enter.point.y, enter.point.z),
    startedInside: false,
  };
}

/**
 * The outermost surface along a direction — the "sky-facing" ground. Used to
 * build the render mesh. Note this deliberately takes the FIRST crossing seen
 * from orbit, so an overhang renders its roof; the field still knows about
 * everything underneath it.
 */
export function surfaceRadiusAlong(body, dx, dy, dz, opts = {}) {
  // Starting from the top of the atmosphere costs ~28 km of marching per
  // vertex, which measured at 814 ms to rebuild one 110x110 ground patch —
  // a visible freeze. Callers that already know roughly where the ground is
  // (the local patch knows its own centre's radius) pass `startRadius` and
  // skip that entire empty span.
  const fullStart = body.radiusEquatorial + body.terrain.reliefMax + 5000;
  const startR = opts.startRadius || fullStart;
  const range = opts.startRadius ? (opts.range || 4000) : startR * 0.9;

  let hits = raycast(body,
    dx * startR, dy * startR, dz * startR,
    -dx, -dy, -dz,
    range,
    { firstOnly: true, minStep: opts.minStep || 1.0 });
  let enter = hits.find((h) => h.kind === 'enter');

  // If the near start missed — a cliff taller than the margin, or a start
  // point already underground — fall back to the full march so the answer is
  // still correct rather than merely fast.
  if (!enter && opts.startRadius) {
    hits = raycast(body,
      dx * fullStart, dy * fullStart, dz * fullStart,
      -dx, -dy, -dz,
      fullStart * 0.9,
      { firstOnly: true, minStep: opts.minStep || 1.0 });
    enter = hits.find((h) => h.kind === 'enter');
  }

  if (!enter) return body.radiusMean;
  const p = enter.point;
  return Math.hypot(p.x, p.y, p.z);
}

/**
 * The outermost surface along a direction, solved instead of marched.
 *
 * `density()` is (geodetic altitude - ground elevation), so along a ray from
 * the centre its derivative with respect to radius is very close to 1. That
 * makes Newton's method converge in about three evaluations, where the general
 * ray march needs roughly thirty. Measured: it took one 110x110 ground patch
 * from 780 ms to well under a tenth of that.
 *
 * This is NOT a second source of truth. It solves exactly the same equation
 * the marcher brackets — `validate.mjs` asserts the two agree to under a
 * centimetre over hundreds of directions.
 *
 * It finds only the OUTERMOST surface, which is all a top-down render needs.
 * If a cave is ever allowed to breach the surface, the caller must fall back
 * to `surfaceRadiusAlong()`; today the field enforces a 45 m minimum rock
 * roof, so no void reaches the sky.
 */
export function surfaceRadiusFast(body, dx, dy, dz, iterations = 3) {
  const scratch = {};
  let r = body.radiusMean;
  for (let i = 0; i < iterations; i++) {
    const d = baseDensity(body, dx * r, dy * r, dz * r, scratch);
    r -= d;
    // Guard against a pathological step leaving the body entirely.
    if (!(r > 0) || r > body.radiusEquatorial * 2) return body.radiusMean;
  }

  // Newton assumes the field increases smoothly with radius. A dug hole breaks
  // that — it puts open space inside solid rock, so there are now several
  // crossings along this ray and the solved one may be the wrong one, or may
  // sit inside a void. Where anyone has actually edited the ground, pay for
  // the real ray march. Everywhere else (which is almost everywhere) keep the
  // cheap path.
  // Precise proximity, not bucket occupancy. Gating on the bucket made every
  // vertex within CELL_M of any edit pay for a full ray march.
  if (_edits && !_edits.isEmpty && _edits.affects(dx * r, dy * r, dz * r, 2.5)) {
    return surfaceRadiusAlong(body, dx, dy, dz, {
      minStep: 0.12, startRadius: r + 60, range: 200,
    });
  }
  return r;
}

/** Surface normal from the field gradient. Exact for any shape, including caves. */
export function normalAt(body, px, py, pz, h = 0.6, out = {}) {
  const s = {};
  const dX = density(body, px + h, py, pz, s) - density(body, px - h, py, pz, s);
  const dY = density(body, px, py + h, pz, s) - density(body, px, py - h, pz, s);
  const dZ = density(body, px, py, pz + h, s) - density(body, px, py, pz - h, s);
  const len = Math.hypot(dX, dY, dZ) || 1;
  out.x = dX / len; out.y = dY / len; out.z = dZ / len;
  return out;
}

/** Is this point inside solid material? The one-line question everything asks. */
export const isSolid = (body, px, py, pz) => density(body, px, py, pz) < 0;
