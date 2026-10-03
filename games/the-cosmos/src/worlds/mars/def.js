// ============================================================================
// worlds/mars/def.js - Mars, the root world: every other frame is a translated copy of its body-fixed frame.
//
// Real measured numbers; every one has a source (see `sources`, docs/PROVENANCE.md). Moved here unchanged from src/world/bodies.js:
// that file now reads this one through the world registry. The field itself (terrain.js, field.js) is not a world's business.
// ============================================================================

import { SOLAR } from '../_kit/solar.js';

export default {
  id: 'mars', name: 'Mars', kind: 'planet', root: true, order: 0, worldIndex: 0,
  blurb: 'Home. Marineris Port.',
  // Where it is in the real Solar System (JPL approximate elements, rates per century) and how it turns. Nothing moves yet: see _kit/ephemeris.js.
  orbit: SOLAR.orbit.mars,
  rotation: { periodS: 88642.44, axialTiltDeg: 25.19, prime0Deg: 176.630 },
  body: {
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
};
