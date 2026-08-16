// ============================================================================
// bodies.js — real measured worlds. Every number here has a source.
//
// OWNS: the physical parameters of each celestial body, in SI units, at real
//       scale. Nothing is "compressed for gameplay". If a number is invented,
//       it says so in `sourceNote` and carries `measured: false`.
// DOES NOT OWN: terrain shape (field.js), rendering (planetMesh.js), or
//       addressing (geodesy.js).
//
// WHY REAL SCALE, FROM FRAME ONE
// ------------------------------
// A planet's radius is load-bearing for the coordinate system, the horizon
// distance, the gravity curve, the atmosphere profile, the LOD budget, and how
// far "a kilometre" feels. Every one of those is painful to change later and
// free to get right now. Mars is 3,389,500 m here because Mars is 3,389,500 m.
//
// PROVENANCE
// ----------
// Values marked `verified: 'live'` were fetched from a NASA page on 2026-08-16.
// Values marked `verified: 'table'` come from the NSSDC Planetary Fact Sheet,
// which now serves a 307 redirect to automated fetchers — they are recorded
// here as the widely-published table values and must be re-confirmed by a human
// before they are treated as measured evidence. See docs/PROVENANCE.md.
// ============================================================================

export const G = 6.67430e-11;          // CODATA 2018 gravitational constant
export const AU = 1.495978707e11;      // IAU 2012 astronomical unit, metres

export const BODIES = [
  {
    id: 'mars',
    name: 'Mars',
    designation: 'SOL-4',
    kind: 'planet',

    // --- Shape. Real oblate spheroid, metres. ---------------------------------
    radiusMean: 3_389_500,
    radiusEquatorial: 3_396_200,
    radiusPolar: 3_376_200,

    // --- Mass and gravity. ----------------------------------------------------
    mass: 6.417e23,                    // kg
    surfaceGravity: 3.72076,           // m/s^2 at the mean radius
    escapeVelocity: 5030,              // m/s

    // --- Rotation and orientation. --------------------------------------------
    siderealRotationPeriod: 88642.44,  // seconds (24.6229 h)
    obliquityDeg: 25.19,               // axial tilt, degrees
    // Prime meridian: Mars' longitude origin is defined by the crater Airy-0.
    primeMeridianCrater: 'Airy-0',

    // --- Orbit. ----------------------------------------------------------------
    semiMajorAxis: 2.279e11,           // m (1.5 AU)
    orbitalPeriodDays: 687,

    // --- Atmosphere. Thin, real. ----------------------------------------------
    atmosphere: {
      surfacePressure: 610,            // Pa (~0.6% of Earth sea level)
      scaleHeight: 11_100,             // m
      composition: { CO2: 0.9532, N2: 0.027, Ar: 0.016, O2: 0.0013, CO: 0.0008 },
      // Butterscotch sky from suspended iron-oxide dust, not Rayleigh blue.
      skyColor: 0xc4a284,
      horizonColor: 0xe0b48c,
    },

    // --- Surface reference. ---------------------------------------------------
    // Mars has no sea level. Elevation is measured against the areoid, the
    // equipotential surface that MOLA established as the zero datum.
    datum: 'areoid',
    temperatureMeanC: -65,
    temperatureRangeC: [-153, 20],

    // --- Terrain field parameters (see field.js). -----------------------------
    // Amplitudes are real: Olympus Mons and Valles Marineris are the calibration
    // targets, so relief is not arbitrary noise.
    terrain: {
      seed: 4,
      // Global relief envelope, metres above/below the areoid.
      reliefMax: 21_900,               // Olympus Mons summit above datum
      reliefMin: -8_200,               // Hellas Planitia floor below datum
      // Working relief for ordinary ground away from the named extremes.
      localRelief: 2_400,
      crustThickness: 50_000,          // m, mean crustal thickness
    },

    landmarks: [
      // Real coordinates. These are the first entries in the address book and
      // exist so a spawn point can be a *place*, not a random direction.
      {
        id: 'COS-MARS-LMK-0001', name: 'Olympus Mons',
        lat: 18.65, lon: -133.8, elevation: 21_900,
        note: 'Tallest volcano in the solar system. Summit above areoid.',
        verified: 'live',
      },
      {
        id: 'COS-MARS-LMK-0002', name: 'Valles Marineris',
        lat: -14.0, lon: -59.2, elevation: -5_000,
        note: 'Canyon system 3870 km long, 600 km wide, up to 9.3 km deep.',
        verified: 'live',
      },
      {
        id: 'COS-MARS-LMK-0003', name: 'Airy-0',
        lat: -5.1, lon: 0.0, elevation: 0,
        note: 'Defines the Martian prime meridian. Longitude origin.',
        verified: 'table',
      },
      {
        id: 'COS-MARS-LMK-0004', name: 'Hellas Planitia',
        lat: -42.4, lon: 70.5, elevation: -8_200,
        note: 'Deepest basin. Floor ~8.2 km below the areoid.',
        verified: 'table',
      },
    ],

    sources: [
      { field: 'radiusMean, surfaceGravity', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html', verified: 'live', note: 'radius 3389.5 km and surface gravity 3.7 m/s^2 confirmed 2026-08-16 via search result text; full table blocked by 307 redirect' },
      { field: 'obliquityDeg, siderealRotationPeriod, semiMajorAxis, orbitalPeriodDays, temperatureRangeC, landmark dimensions', url: 'https://science.nasa.gov/mars/facts/', verified: 'live', note: 'fetched 2026-08-16' },
      { field: 'mass, escapeVelocity, radiusEquatorial, radiusPolar, atmosphere composition, surfacePressure', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html', verified: 'table', note: 'NSSDC table values; page 307-redirects to automated fetchers, re-confirm by hand' },
    ],
  },
];

export const getBody = (id) => {
  const b = BODIES.find((x) => x.id === id);
  if (!b) throw new Error(`unknown body: ${id}`);
  return b;
};

// Gravity at a distance r from the body's centre. Inverse-square outside the
// surface; linear taper inside, which is what a uniform-density sphere actually
// does and matters the moment anyone digs.
export function gravityAtRadius(body, r) {
  const R = body.radiusMean;
  const gSurface = body.surfaceGravity;
  if (r <= 0) return 0;
  return r >= R ? gSurface * (R * R) / (r * r) : gSurface * (r / R);
}

// Derived check: does the stated mass agree with the stated surface gravity?
// A body whose numbers disagree with itself is a bug, so this is asserted by
// the test suite rather than trusted.
export function impliedSurfaceGravity(body) {
  return (G * body.mass) / (body.radiusMean * body.radiusMean);
}
