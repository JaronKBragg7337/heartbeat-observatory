// ============================================================================
// worldDetails.js — RETIRED V1 surface-dressing layer (produces nothing).
//
// OWNS: nothing in the world any more. This module is kept as a sealed, empty
//       seam so the one on-hold caller (src/desktop/desktopPlanet.js) and the
//       regression tests keep resolving, and so the reason for the removal
//       travels with the code instead of only living in a changelog.
// DOES NOT OWN: terrain (planet.js), collision (planet.js), or any V2 site.
//
// WHAT WAS HERE, AND WHY IT WENT
// ------------------------------
// It scattered settlements, nature props, and "roads" around every landing
// zone from a seeded RNG, then emitted matching collider specs. It was
// internally consistent — visuals and blockers came from one layout — but the
// layout itself was meaningless:
//
//   - roads were 4-segment boxes stamped through pads and structures, joined
//     to nothing, and no AI or vehicle could use them,
//   - buildings were sealed primitives with no interior, door, parcel,
//     utility, or support,
//   - placement answered to a hash, not to a site plan.
//
// CANON.md, ARCHITECTURE.md §8, and PHYSICAL_WORLD_CONTRACT.md require the
// opposite order: declare destinations and connection anchors, measure the
// parcels, then derive grading, road surface, collision, vehicle lanes,
// pedestrian routes, and AI navigation from that ONE spatial graph. Nothing in
// this file could be promoted toward that, so keeping it would only have made
// the substrate look finished while staying spatially false.
//
// The visuals and their colliders were removed in the SAME change, so no
// removed prop can leave an invisible wall behind.
//
// REPLACING THIS
// --------------
// Do not re-enable these functions. The V2 successor is a measured site graph
// (ROADMAP Phase 5) whose road mesh, collision, lanes, and navigation are all
// products of one dataset. Until then these exports stay empty on purpose, and
// test/run_tests.mjs asserts exactly that.
// ============================================================================

import * as THREE from 'three';

const RETIRED = Object.freeze([]);

// Empty stats block, same shape the old layer reported, so any reader
// (scene reports, debug overlays) sees zeros instead of undefined.
function emptyStats() {
  return {
    zonesDetailed: 0,
    settlementBuildings: 0,
    roadSegments: 0,
    naturalProps: 0,
    lightMasts: 0,
    profile: 'retired',
    retired: true,
  };
}

// Returns an empty, named group. It is still added to the body group by the
// on-hold desktop route; an empty group renders nothing and costs nothing.
export function buildWorldDetailLayer(body /* , factionById, terrainRadiusAtFn, options */) {
  const group = new THREE.Group();
  group.name = `world-detail:retired:${body?.id ?? 'unknown'}`;
  if (body) body._detailStats = emptyStats();
  return group;
}

export function computeSettlementLayout() { return RETIRED; }
export function computeNatureLayout() { return RETIRED; }
export function detailCollidersForLayout() { return RETIRED; }
export function natureCollidersForLayout() { return RETIRED; }
