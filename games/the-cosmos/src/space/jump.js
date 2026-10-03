// ============================================================================
// jump.js — the Ore Lane: how a ship gets from Mars's space to a far world's (and back). Pure data and arithmetic: no three.js, no DOM,
// so the authority, the browser and the validator share one answer.
//
// THE MECHANIC (bible v2.9: "the storm safe corridor", trade lanes; the nav computer said "needs a jump drive")
//   Each region has ONE lane mouth, a point in open space a long way out from its home planet where the main drive can open the Compact's
//   corridor (the one lane the Sun-heat storms leave open). A trip to another region is therefore: climb out, fly the main drive to the lane
//   mouth (time compression applies), hold still and spool the jump coils for JUMP.spoolS seconds of CABIN time (compression does not
//   apply), pay the lane fee, appear at the other mouth, fly the main drive in to the destination, land. The server owns every step.
//
// REGIONS. A region is a stretch of space the drive can fly across: Mars's (Mars, Phobos, Deimos: everything within JUMP.regionM of
//   Mars's centre) and, for every other frame world, its own (the world's frame is the region's root frame, so a region is named by it).
//   A world is reached by a lane when its def says `jump: true` (src/worlds/<name>/def.js); the registry then lists it as a destination
//   however far it is, and the course is this file's route.
//
// HONEST SIMPLIFICATIONS (stated, not hidden)
//   * A far world is at its real distance from Mars (its `orbit`, src/worlds/_kit/ephemeris.js: Ceres is 1.6 to 4 AU away), but the drive
//     tops out at 30 km/s: 4e11 m would take five months at x1. The corridor skips it. The world's frame sits at that real distance, so
//     nothing of Mars is ever in its sky and no ship can free-fly there (free flight is charted in Mars's space only).
//   * The lane fee, the spool time and the mouths' distances are the game's own numbers, not measurements.
// ============================================================================

import { worldCentre, worldDef } from '../worlds/registry.js';

const DEG = Math.PI / 180;

export const JUMP = {
  /** Cabin seconds the coils take to spool at the mouth. Time compression does not shorten it. */
  spoolS: 20,
  /** Credits the Compact's lane office takes when the coils fire. */
  feeCredits: 120,
  /** How far out the mouths are from the home planet's centre, metres: Mars's, and a far world's. */
  mouthM: { mars: 6.0e7, world: 5.0e7 },
  /** The mouth is a ring this wide, drawn at the mouth, metres (the ship stops at its centre). */
  gateRadiusM: 420,
  /** Frames whose centre is within this of Mars's centre belong to Mars's region. */
  regionM: 2.0e9,
};

const _regions = new Map();
/** The region a frame belongs to: 'mars', or the far world's own id. */
export function systemOfFrame(frameId) {
  if (frameId === 'mars') return 'mars';
  let r = _regions.get(frameId);
  if (!r) { const c = worldCentre(frameId); r = Math.hypot(c.x, c.y, c.z) < JUMP.regionM ? 'mars' : frameId; _regions.set(frameId, r); }
  return r;
}
/** The frame a region's drive legs are flown in (its root frame): the region's own name. */
export const rootFrameOf = (region) => region;
export const regionName = (region) => (region === 'mars' ? 'Mars' : worldDef(region).name);
export const laneName = (region) => `${regionName(region)} Gate`;
/** True for a world a ship reaches by the lane (a region of its own). */
export const isLaneWorld = (id) => id !== 'mars' && systemOfFrame(id) !== 'mars';

/** Mars's frame: the unit vector straight up from the port (spawn), so a ship leaving the port climbs, then cruises on the same line. */
export function solMouthDir() {
  const la = -14.0 * DEG, lo = -59.2 * DEG;
  return { x: Math.cos(la) * Math.cos(lo), y: Math.sin(la), z: -Math.cos(la) * Math.sin(lo) };
}

/** A far world's mouth is straight over its main pad. Needs the body record (moonField.js). */
export function worldMouthDir(body) { return { ...body.padInfo.up }; }

/** The mouth, in the coordinates of the region's root frame. `body` is only needed for a far world. */
export function mouthPoint(region, body = null) {
  if (region === 'mars') { const d = solMouthDir(), r = JUMP.mouthM.mars; return { x: d.x * r, y: d.y * r, z: d.z * r }; }
  const d = worldMouthDir(body), r = JUMP.mouthM.world;
  return { x: d.x * r, y: d.y * r, z: d.z * r };
}

/** What the drive must keep out of, in a region's root frame: the home planet's safety sphere and the floor it will not go under. */
export function transitBody(region, body = null) {
  if (region === 'mars') return { centre: { x: 0, y: 0, z: 0 }, safeR: 3_389_500 + 60_000, floorR: 3_389_500 + 25_000 };
  const R = body.radiusMean;
  // The destination's standoff point is a couple of kilometres over the pad, which can sit well under the mean radius (a basin's floor): the
  // safety sphere and the floor are under it. (The ship climbs straight up to spec.ascentM first and the mouth is straight over the main
  // pad, so the line in and out is radial.)
  const under = Math.max(3500, 0.02 * R);
  return { centre: { x: 0, y: 0, z: 0 }, safeR: R - under, floorR: R - under - 500 };
}
