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
//   * (F2, Oct 3) Mars SPINS and the moons ORBIT: the game runs on real UTC (space/clock.js, rate 1: the calendar is not compressed). The
//     ground frame is Mars's turning body-fixed frame, so the Sun crosses the sky and a moon's centre moves in it (space/frames.js).
//     Phobos and Deimos have the real periods and distances; their PHASE is invented (the registry's parked shorthand: lonS is the
//     longitude at the epoch), and they move in Mars's equatorial plane on circles. A moon keeps one face to Mars (its yaw follows
//     its longitude); libration is not modelled.
//   * The drive's acceleration is fictional (it is the Meridian's own number, below). Distances, sizes and gravity are real.
//   * Transit ignores Mars's pull: the flight computer is assumed to hold the line.
// ============================================================================

import { allWorlds, isFrameWorld, onWorldsChanged, worldCentre } from '../worlds/registry.js';

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
  /** How far a course can fly under the drive, metres from Mars: the registry lists anything beyond as far (needs a jump lane). 1,000,000 km is nine hours at the top speed. */
  rangeM: 1.0e9,
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
/** The LEGACY fixed Sun: the mid-morning sun the ground game used before F2, at the spawn. It is what a `?dev=1` session without `?sky=` still uses (so
 *  the automated browser checks see one lighting whatever the hour); a real session uses the real Sun (space/frames.js sunDirFixed). */
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

/**
 * Every world with a frame of its own (a moon or a planet you can land on), by id: the SAME def objects the world registry holds
 * (src/worlds/<name>/def.js). Phobos and Deimos used to be written out here; they moved to their own folders unchanged. The table is
 * rebuilt in place if a world is registered after load (tests, a dev tool). The name "MOONS" is kept for the many callers: it means
 * "worlds with a frame", which now includes planets.
 */
export const MOONS = {};
/** The ids of MOONS (every frame world beyond Mars), kept current in place: one pad per ship and one edit store each. */
export const MOON_IDS = [];
/** The ids of the stations (built places with docks and no ground), kept current in place. */
export const STATION_IDS = [];

export const G_CONST = 6.6743e-11;

/**
 * Where a world's centre is in Mars's frame (metres). Read from the world's `orbit` (src/worlds/_kit/ephemeris.js): a moon of Mars
 * parked by the legacy shorthand (Phobos, Deimos) comes out bit-identical to the old `equatorial(lonS, orbitRadiusM)`; a real planet
 * sits where the Solar System puts it on the game's start date. Cached while nothing moves.
 */
/** Where a world is NOW (or at game time t), metres, in Mars's turning axes. Nothing is cached: it moves. */
export const moonCentre = (m, t) => worldCentre(m.id, t);

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
export const DESTINATIONS = [];

/** Base rows (Mars's own), then one row per world in the registry's order: a frame world is `kind: 'moon'` (the word means "a world
 *  with a frame of its own", planets included), a placeholder is `kind: 'far'`. Built from src/worlds/<name>/def.js. */
function rebuildFromRegistry() {
  for (const k of Object.keys(MOONS)) delete MOONS[k];
  MOON_IDS.length = 0; STATION_IDS.length = 0;
  DESTINATIONS.length = 0;
  DESTINATIONS.push(
    { id: 'port', kind: 'port', name: 'Marineris Port', blurb: "Back to the Meridian's own pad." },
    { id: 'orbit', kind: 'orbit', name: 'Mars orbit (400 km)', blurb: 'Hold over Mars. The view, and raiders.' },
  );
  const far = (d, blurb) => DESTINATIONS.push({ id: d.id, kind: 'far', name: d.navName || d.name, blurb: d.blurb || blurb });
  for (const d of allWorlds()) {
    if (d.root || d.nav === false || d.kind === 'star') continue;
    if (d.placeholder) { far(d, 'Another system. Needs a jump drive the Meridian does not have.'); continue; }
    const dist = Math.hypot(...Object.values(worldCentre(d.id)));
    // beyond the drive's range a world is reached by a jump lane (F3, `jump: true`) or not at all yet: it is listed, not flyable
    if (!d.jump && dist > DRIVE.rangeM) { far({ ...d, blurb: `${(dist / 1.495978707e11).toFixed(2)} AU away: beyond the drive's range. Needs a jump drive the Meridian does not have.` }); continue; }
    if (d.kind === 'station') {
      STATION_IDS.push(d.id);
      DESTINATIONS.push({ id: d.id, kind: 'station', name: d.navName || d.name, station: d.id, ...(d.jump ? { jump: true } : {}), blurb: d.blurb || `A station. The course holds ${Math.round(stationStandoff(d))} m off it.` });
    } else if (isFrameWorld(d)) {
      MOONS[d.id] = d; MOON_IDS.push(d.id);
      DESTINATIONS.push({ id: d.id, kind: 'moon', name: d.navName || d.name, moon: d.id, ...(d.jump ? { jump: true } : {}), blurb: d.blurb || `Land at the ${d.pad.name}.` });
    }
  }
}
/** Metres off a station's centre where a course holds: its own `standoffM`, else three radii and a margin. */
export const stationStandoff = (d) => d.standoffM ?? (3 * d.radiusM + 500);
rebuildFromRegistry();
onWorldsChanged(rebuildFromRegistry);

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
export function landingOrder(order) {return order?.type==='return'||order?.type==='land'||order?.type==='goto'&&!!order.land;}

// ---------------------------------------------------------------------------
// FREEFLIGHT (October 3): manual flight anywhere. The numbers; the physics is in freeflight.js.
// ---------------------------------------------------------------------------
export const FREE = {
  /** Time compression offered while coasting. Any burn, RCS or turning input drops it to x1. */
  warps: [1, 5, 20, 60, 500],
  /** Delta-v of a full tank, m/s. The drive's thrust is the Meridian's own fictional number; the tank is sized so a surface-to-Phobos trip is a fraction of it. */
  dvFullMs: 12_000,
  /** Reaction-control jets, m/s2 on each axis (they burn the same tank, one hundredth as hard per second as the main drive). */
  rcsAccel: 1.2,
  /** Hull turn rate under the stick, rad/s (pitch, yaw, roll) and how fast the jets can change it, rad/s2. */
  rot: { pitch: 0.6, yaw: 0.6, roll: 0.9 }, rotAccel: 1.6,
  /** Mars's air: density at the surface and scale height (real: about 0.020 kg/m3, 11.1 km). The deployable drag brakes: ballistic coefficient, kg/m2. */
  rho0: 0.020, scaleHeightM: 11_100, ballisticKgM2: 40,
  /** Aerodynamic deceleration above this, m/s2, hurts the hull. */
  maxDecel: 60,
  /** Below this height over Mars the stick flight (lift pods) takes over from free flight, if the ship is slower than `handoverMs`. */
  marsHandoverM: 10_000, handoverMs: 300,
  /** Above a moon: the flight assist takes over under this height (or higher if the ship is coming in fast: see freeflight.js). */
  moonHandoverM: 2_500,
  /** Inside this distance of a moon the ship rides with it (Mars's pull is cancelled at the moon's centre, fading out over the next quarter again: see freeflight.js). */
  patchM: 400_000,
  /** Refuel at a pad, fraction of a tank per second. */
  refuelPerS: 0.02,
  /** A raider closer than this, or another ship closer than `shipNearM`, holds the compression at x1. */
  raiderNearM: 20_000, shipNearM: 5_000,
  /** Relative speed under which free flight may be switched off again (the flight assist can hold a ship this slow). */
  releaseMs: 150,
};
