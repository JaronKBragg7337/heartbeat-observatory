// ============================================================================
// opening/script.js - the opening's one set of beats, timings and places. Pure data and maths (no three.js): the server checks players
// against it, the client plays it. Nothing here is random: the same clock gives the same picture on every phone (and after a refresh).
//
// THE BEATS (BIBLE-v3 10.1, DECISIONS 10/3 10:46 AM)
//   0 LINER    wake aboard the Ares liner inbound to Mars, the convoy flying beside, walk the passenger deck, the entry, a normal landing on
//              the port's Apron A. (Stage clock 0..LINER_SECONDS; the player leaves by the starboard gangway once it is down.)
//   1 PORT     walk the port to the arrivals hall, read the world board, pick a world and a side (or none), walk to Pad 01 and board the Kestrel.
//   2 DESCENT  the Kestrel climbs out, flies to the chosen world, and crashes there (the season's cause). Stage clock 0..KESTREL_SECONDS.
//   3 WRECK    wake in the wreck: the crew locker, the way out.
//   4 DIG      the buried supply crate (dig, then carry).
//   5 CONTACT  a rover comes; its driver is from one of the world's two sides (random per player) and pitches.
//   6 TRAVEL   the ride (or the walk) to the port; the other side's recruiter waits.
//   7 DONE     the player is placed at the world's port with the purse and the drained lifeboat.
// ============================================================================
import { LINER_SPOT, APRON, WALKWAY } from '../port/portSpec.js';
import { LINER_SECONDS, KESTREL_SECONDS } from './dialogue.js';

export const OPENING_VERSION = 2;
export const STAGE = { LINER: 0, PORT: 1, DESCENT: 2, WRECK: 3, DIG: 4, CONTACT: 5, TRAVEL: 6, DONE: 7 };
export const RIDE_SECONDS = 65;
export const CONTACT_SECONDS = 8;
export { LINER_SECONDS, KESTREL_SECONDS };

/** The two ships of the opening (ship types in src/ships/): the line's liner and the descent transport. */
export const LINER = { type: 'transport', name: 'Hellas Dawn', registry: 'MR-0412', spot: LINER_SPOT };
export const KESTREL = { type: 'descender', name: 'Soft Landing', registry: 'MR-3101', spot: { x: 0, z: 0 } };   // on Pad 01

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

/** How far a ship's origin stands above flat ground when it rests on its gear (metres). */
export const restHeight = (def) => def.gear.nominal + def.gear.soleOffset;
/** The angle a lowered ramp makes with flat ground under this ship (the game clamps it the same way: ship/shipSystem.js _solveRamp). */
export function rampAngle(def, key) { const R = def.ramps[key]; return clamp(Math.asin(clamp(restHeight(def) / R.length, 0.05, 0.9)), 0.12, 0.72); }
/** Where a lowered ramp meets the ground, in ship-local metres (x, z). */
export function rampFoot(def, key) {
  const R = def.ramps[key], run = R.length * Math.cos(rampAngle(def, key));
  return { x: R.hinge.x + R.dir.x * run, z: R.hinge.z + R.dir.z * run };
}

// ---- stage 0: the liner ------------------------------------------------------------------------------------------------
/** Phases of the liner clock. Cruise is in space with the convoy; the entry is the heat and shaking (the switch to the ground is hidden in it). */
export const LINER_PHASE = { cruiseEnd: 118, entryEnd: 136, touch: 190, rampsDown: 196 };
export function linerPhase(t) {
  return t < LINER_PHASE.cruiseEnd ? 'cruise' : t < LINER_PHASE.entryEnd ? 'entry' : t < LINER_PHASE.touch ? 'descent' : 'landed';
}
/** Where the Ares stands when it is down (port-local, the ship's origin; nose to -z). */
export function linerDown(def) { return { x: LINER_SPOT.x, y: restHeight(def), z: LINER_SPOT.z }; }
/**
 * The Ares on its way down, port-local, for liner clock t (only meaningful from entryEnd to touch). It comes up from the south, nose first,
 * heading north over the apron: the port lies to the east, off the starboard windows, which is where the lounge looks. Eases to rest.
 */
export function linerDescentPose(t, def) {
  const s = clamp((t - LINER_PHASE.entryEnd) / (LINER_PHASE.touch - LINER_PHASE.entryEnd), 0, 1), k = 1 - s;
  const down = linerDown(def);
  const h = 3200 * Math.pow(k, 2.3), d = 2600 * k * k;
  return { x: down.x + 0.04 * d * Math.sin(s * 2.1), y: down.y + h, z: down.z + d, pitch: 0.06 * Math.sin(Math.min(1, s * 1.15) * Math.PI) - 0.05 * clamp((s - 0.8) / 0.2, 0, 1), roll: 0.03 * Math.sin(s * 5) * k };
}
/** The ramp lowering (0..1) on the liner clock: the gangway and the stern ramp come down after touchdown. */
export const linerRampProgress = (t) => clamp((t - LINER_PHASE.touch - 1) / 5, 0, 1);

/** Where a passenger comes out of the liner onto the port (port-local): the foot of the starboard gangway, and the way they face (east, +x). */
export function linerExit(def) {
  const f = rampFoot(def, 'airlock');
  return { x: LINER_SPOT.x + f.x + 1.2, y: 0, z: LINER_SPOT.z + f.z, yaw: Math.PI / 2, pitch: 0 };
}
/** Ship-local x past which the gangway counts as left (the end of the ramp, with the walker's own exit check). */
export function gangwayEndX(def) { return rampFoot(def, 'airlock').x - 0.8; }

// ---- stage 1: the port --------------------------------------------------------------------------------------------------
/** The world board: stand under the arrivals hall's roof, near the guide's lectern (port-local). */
export const BOARD_SPOT = { x: -88, z: 40.4, reach: 8.5 };
/** The guide stands behind the lectern (a counter in the middle of the hall). */
export const GUIDE_SPOT = { x: -88, z: 38.6, face: 'south' };
/** The gate agent stands at the foot of the Kestrel's gangway; the Kestrel sits on Pad 01. */
export function kestrelGate(def) {
  const f = rampFoot(def, 'airlock');
  return { x: KESTREL.spot.x + f.x + 1.0, z: KESTREL.spot.z + f.z, reach: 6 };
}
/** Bounds of the port walk (port-local metres): from the apron's west edge to the Kestrel pad and its taxiway. */
export const PORT_BOUNDS = { x0: APRON.x - APRON.w / 2 - 20, x1: 110, z0: -110, z1: 110 };
/** Lit way markers from the gangway foot to the arrivals hall, then on to the Kestrel (port-local; the hall is under a roof, so the line goes to its door). */
export function portPath(def) {
  const e = linerExit(def), g = kestrelGate(def);
  return [[e.x, e.z], [WALKWAY.x0 + 20, e.z], [-103, 40], [BOARD_SPOT.x - 12, 41], [-62, 38], [-30, 38], [-6, 38], [g.x, g.z]];
}

// ---- stage 2: the Kestrel ------------------------------------------------------------------------------------------------
export const KESTREL_PHASE = { lift: 3, climbEnd: 17, spaceStart: 24, crash: 60 };
export function kestrelPhase(t) {
  return t < KESTREL_PHASE.lift ? 'pad' : t < KESTREL_PHASE.climbEnd ? 'climb' : t < KESTREL_PHASE.spaceStart ? 'ascent' : t < KESTREL_PHASE.crash ? 'descent' : 'crash';
}
/** The Kestrel leaving Pad 01, port-local (origin y), clock t in [3, 17]: a straight, slow lift that gathers speed. */
export function kestrelLift(t, def) {
  const s = clamp((t - KESTREL_PHASE.lift) / (KESTREL_PHASE.climbEnd - KESTREL_PHASE.lift), 0, 1);
  return { x: KESTREL.spot.x, z: KESTREL.spot.z, y: restHeight(def) + 2400 * s * s * (0.35 + 0.65 * s), pitch: -0.18 * s };
}
/** How far the world below has come up, 0 (a point) to 1 (the ground), over the descent (24..60). */
export const kestrelApproach = (t) => clamp((t - KESTREL_PHASE.spaceStart) / (KESTREL_PHASE.crash - KESTREL_PHASE.spaceStart), 0, 1);
export const kestrelShake = (t, cause) => {
  const k = clamp((t - 26) / 34, 0, 1);
  return (cause === 'failure' ? 1.1 : cause === 'weather' ? 1.0 : 0.8) * k * k + (t > KESTREL_PHASE.crash - 1.5 ? 1.2 : 0);
};

// ---- stage 3..6: the wreck site (frames as before: x right, y up, z back, origin 2.6 km from the port) ---------------------
export const WRECK_ORIGIN_PORT = { x: 2600, z: 350 };   // where the site's origin sits in port-local metres (negative x is the port's side: the origin is 2.6 km WEST... see openingBody)
export const LOCKER = { x: 2.55, z: 7.6, reach: 2.4 };   // the crew locker, in the wreck cabin's own frame
export const CRATE = { x: 4, z: 20 };

/** Does the stage keep the player on a ship (ship-local pose) or on the ground? */
export const aboardStage = (stage) => stage === STAGE.LINER || stage === STAGE.DESCENT;
