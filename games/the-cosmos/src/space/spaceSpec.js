// ============================================================================
// spaceSpec.js — the numbers of space travel. Pure data: no three.js, no DOM, so the validator and the nav computer read
// the same file.
//
// OWNS: the drive (what the Meridian can do once it is out of the air), the real moons (Phobos, Deimos), where they are,
//       the destinations a course can be plotted to, and the one Sun direction the whole sky agrees on.
// DOES NOT OWN: the shape of a moon's ground (moonField.js), how any of it is drawn (moonWorld.js, spaceSky.js), the
//       flight itself (spaceTrip.js), money (the economy: see hooks in spaceSystem.js).
//
// HONEST SIMPLIFICATIONS (stated, not hidden)
//   * Mars does not spin in this build (everything is in Mars's body-fixed frame), so the moons do not orbit: each is parked
//     over a fixed spot of the sky at its real distance from Mars's centre. Phobos is tidally locked, so its real face
//     toward Mars is the face you see here; what is missing is its 2.1 km/s of orbital motion.
//   * The drive's acceleration is fictional (it is the Meridian's own number, below). Distances, sizes and gravity are real.
//   * Transit ignores Mars's pull: the flight computer is assumed to hold the line.
// ============================================================================

const DEG = Math.PI / 180;

/** Mars's gravitational parameter, m3/s2 (G * mass of Mars; the same product the body record states). */
export const MARS_MU = 6.6743e-11 * 6.417e23;

// ---------------------------------------------------------------------------
// THE DRIVE
// ---------------------------------------------------------------------------
export const DRIVE = {
  /** Twin main engines, newtons at 100% engine share, vacuum only (they will not light inside the atmosphere). */
  thrustN: 600_000,
  /** The ship's own mass is SHIP_PHYS.massKg (46 t): 13 m/s2 at the default 40% engine share is thrustN*factor/mass. */
  /** Highest speed the flight computer will cruise at, m/s. */
  vMaxMs: 30_000,
  /** The turn-over: how fast the hull can swing its nose (rad/s). 0.12 rad/s is 6.9 degrees a second: a flip takes 26 s. */
  turnRate: 0.12,
  /** Where the lift pods hand over to the main drive: above the atmosphere's last wisp, metres above the ground. */
  gateAltM: 120_000,
  /** Where "orbit Mars" holds the ship, metres above the ground. */
  orbitAltM: 400_000,
  /** A transit may be run faster than the clock ("time compression"). The cabin, crew and doors keep real time. */
  warps: [1, 5, 20, 60],
  /** Ascent assist: how fast the lift pods may climb, m/s, once the neutral airspace line is passed. */
  ascentVMaxMs: 1500,
  /** Sink and climb for flying about a moon at low level are the ordinary flight assist (12 m/s, 40 m/s cruise). */
};

/** Mars's atmosphere ends here for gameplay: the main drive may light above this height. */
export const ATMOSPHERE_TOP_M = 100_000;

// ---------------------------------------------------------------------------
// THE SUN
// ---------------------------------------------------------------------------
/** The Sun's direction is fixed in the world: it equals the mid-morning sun the ground game has always used, AT THE SPAWN. */
export const SUN_ELEV_DEG = 38, SUN_AZ_DEG = 118;
export const SPAWN = { lat: -14.0, lon: -59.2 };

/** World unit vector toward the Sun (computed from the spawn's local frame, so the day you spawn into is the day you see). */
export function sunDirection() {
  const lat = SPAWN.lat * DEG, lon = SPAWN.lon * DEG;
  const sl = Math.sin(lat), cl = Math.cos(lat), so = Math.sin(lon), co = Math.cos(lon);
  const east = { x: -so, y: 0, z: -co }, north = { x: -sl * co, y: cl, z: sl * so }, up = { x: cl * co, y: sl, z: -cl * so };
  const e = SUN_ELEV_DEG * DEG, a = SUN_AZ_DEG * DEG;
  const v = { x: 0, y: 0, z: 0 };
  for (const k of ['x', 'y', 'z']) v[k] = up[k] * Math.sin(e) + north[k] * Math.cos(e) * Math.cos(a) + east[k] * Math.cos(e) * Math.sin(a);
  const l = Math.hypot(v.x, v.y, v.z);
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}

// ---------------------------------------------------------------------------
// THE MOONS
// ---------------------------------------------------------------------------
/** Position in Mars's body-fixed frame of a point on the equator plane at S-longitude lonDeg and radius r. */
export function equatorial(lonDeg, r) {
  const lon = lonDeg * DEG;
  return { x: r * Math.cos(lon), y: 0, z: -r * Math.sin(lon) };      // geodesy.js: -Z is east
}

export const MOONS = {
  phobos: {
    id: 'phobos', name: 'Phobos', designation: 'SOL-4-I',
    // Semi-axes, metres: NSSDC Mars satellite table 13.0 x 11.4 x 9.1 km (live fetch 2026-10-01); NASA states 27 x 22 x 18 km across.
    axes: { a: 13_030, b: 11_400, c: 9_140 },          // a points at Mars, b along the orbit, c along the spin axis
    radiusMean: 11_266.7,                              // NSSDC mean radius
    massKg: 1.0659e16,                                 // NSSDC table value
    orbitRadiusM: 9_376_000,                           // semi-major axis, centre of Mars to centre of Phobos
    orbitPeriodS: 0.31891 * 86400,
    lonS: -109,                                        // where it is parked: low over the spawn's sky (19 degrees up), and on the sunlit side so the pad is in daylight
    seed: 61,
    regolithDepthM: 70,
    craterScale: 1.0,
    roughScale: 1.0,
    craterDensity: 0.62,                               // share of crater cells that hold a crater
    cellScale: 1.0,                                    // crater cell sizes (the biggest crater is a quarter of its cell)
    landmarks: [
      // Stickney: the big crater, about 9 km across (NASA: ~9 km), near 1 N 49 W on the Mars-facing hemisphere's trailing side.
      { id: 'COS-PHB-LMK-0001', name: 'Stickney', lat: 1, lon: -49, radiusM: 4500, depthM: 1700, note: 'The largest crater, about 9 km across.' },
      { id: 'COS-PHB-LMK-0002', name: 'Limtoc', lat: 11, lon: -54, radiusM: 1000, depthM: 220, note: 'A 2 km crater on the rim of Stickney.' },
    ],
    // The landing zone and its three sample sites, in body latitude / longitude. The pad is graded flat (a plane under the ship).
    pad: { lat: -25, lon: -8, flatM: 62, blendM: 150, name: 'Stickney East survey pad' },
    // a drifting cargo module that came down on the moon: the distress beacon (jobs.js). Distance and bearing from the pad.
    derelict: { distM: 780, bearingDeg: 215 },
  },
  deimos: {
    id: 'deimos', name: 'Deimos', designation: 'SOL-4-II',
    axes: { a: 7_800, b: 6_000, c: 5_100 },            // NSSDC 7.8 x 6.0 x 5.1 km (NASA: 15 x 12 x 11 km across)
    radiusMean: 6_200,
    massKg: 1.4762e15,                                 // Jacobson and Lainey 2014; the NSSDC page still lists an older 2.4e15
    orbitRadiusM: 23_459_000,
    orbitPeriodS: 1.26244 * 86400,
    lonS: -89,
    seed: 83,
    regolithDepthM: 100,                               // NASA: regolith about 100 m deep, which is why Deimos looks smooth
    craterScale: 0.55,
    craterDensity: 0.3, cellScale: 0.5,
    roughScale: 0.3,                                   // the deep dust smooths everything below a few hundred metres
    landmarks: [{ id: 'COS-DMS-LMK-0001', name: 'Voltaire', lat: 20, lon: 5, radiusM: 950, depthM: 120, note: 'The largest crater, about 2 km across (NASA: 2.3 km).' }],
    pad: { lat: -20, lon: -49, flatM: 62, blendM: 150, name: 'Deimos survey pad' },
  },
};

export const G_CONST = 6.6743e-11;

export const moonCentre = (m) => equatorial(m.lonS, m.orbitRadiusM);

/** Surface gravity from mass and mean radius: real numbers in, real number out (about 0.0056 m/s2 on Phobos). */
export const moonSurfaceGravity = (m) => G_CONST * m.massKg / (m.radiusMean * m.radiusMean);

// ---------------------------------------------------------------------------
// DESTINATIONS a course can be plotted to
// ---------------------------------------------------------------------------
/**
 * kind: 'port'    Marineris Port (a descent to the Meridian's own pad)
 *       'orbit'   hold at a height over Mars
 *       'moon'    arrive and land on a moon (a frame of its own)
 *       'far'     listed so the player knows it exists; out of range until the drive is better
 */
export const DESTINATIONS = [
  { id: 'port', kind: 'port', name: 'Marineris Port', blurb: 'Back to the Meridian\'s own pad.' },
  { id: 'orbit', kind: 'orbit', name: 'Mars orbit (400 km)', blurb: 'Hold over Mars. The view, and raiders.' },
  { id: 'phobos', kind: 'moon', name: 'Phobos', moon: 'phobos', blurb: 'Land at the Stickney East survey pad. Low gravity, you can dig.' },
  { id: 'deimos', kind: 'moon', name: 'Deimos', moon: 'deimos', blurb: 'The outer moon. A smooth, deep-dust world.' },
  { id: 'fortis', kind: 'far', name: 'Fortis (the Empire\'s home world)', blurb: 'Another system. Needs a jump drive the Meridian does not have.' },
  { id: 'greenhaven', kind: 'far', name: 'Greenhaven', blurb: 'Another system. Needs a jump drive the Meridian does not have.' },
  { id: 'ironclad', kind: 'far', name: 'Ironclad (the miners\' home)', blurb: 'Another system. Needs a jump drive the Meridian does not have.' },
];

/** The altitude, in metres above the moon's surface, a ship is brought to before it descends to land. */
export const STANDOFF_M = 1800;
/** Raiders (beyond Mars's neutral airspace) are suspended while the ship is faster than this: they cannot keep up, and they do not follow a transit. */
export const RAIDER_SUSPEND_MS = 300;
/** Paid for each raider shot down outside neutral space. A hook: the economy builder owns the real number. */
export const BOUNTY_CREDITS = 25;

// ---------------------------------------------------------------------------
// TIME COMPRESSION IN THE CLIMB AND THE LANDING (space-fix)
// ---------------------------------------------------------------------------
/** Highest compression allowed at a height above the ground: x1 for the last 400 m, x4 under 1.5 km, x10 under 6 km, then anything. */
export const STICK_WARP_BANDS = [[400, 1], [1500, 4], [6000, 10], [Infinity, 1e9]];
export const bandCap = (aglM) => { for (const [h, w] of STICK_WARP_BANDS) if (aglM < h) return w; return 1e9; };
/** The longest slice of ship time one frame may run, seconds. The flight model still sub-steps it at 1/120 s, so every sub-step is
 *  a full contact / spring / landing check; this only bounds how many sub-steps a frame costs (120). */
export const STICK_MAX_SIM_S = 1.0;

/**
 * The compression to run a climb or a descent at right now.
 * @param requested what the player chose (1, 5, 20, 60)
 * @param aglM      height above the ground, vsMs vertical speed (negative = sinking), dtReal the frame's real seconds
 * A compression is allowed only if the ship, moving at this speed for TWO frames of it, would still be in a band that allows it: the
 * ship can never skip from a fast band into the last 400 m inside one frame.
 */
export function stickWarpCap(requested, aglM, vsMs, dtReal) {
  if (!(requested > 1) || !Number.isFinite(aglM)) return 1;
  let best = 1;
  for (const w of [60, 20, 10, 5, 4, 2]) {
    if (w > requested) continue;
    const sim = Math.min(dtReal * w, STICK_MAX_SIM_S);
    const ahead = aglM - Math.max(0, -vsMs) * sim * 2;        // where a sinking ship could be two frames from now (a climbing one only gets higher)
    if (bandCap(Math.min(aglM, ahead)) >= w) { best = w; break; }
  }
  return Math.min(best, requested);
}
