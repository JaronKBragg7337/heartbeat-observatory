// ============================================================================
// ships/raider/stats.js - what a raider is worth and how it behaves. Numbers only; each is the one place it is written.
// ============================================================================

/** The shipyard's price at Marineris Port, in credits (marks are four to the credit, as everywhere in the economy). */
export const RAIDER_PRICE_CREDITS = 2400;
/** A captured or claimed prize also brings what was in its hold. Credits, per hull, spread by the hull's number so no two are the same. */
export const LOOT_CREDITS = [380, 520, 640, 450, 760, 590];

/** How many escort drones fly with one raider. (They used to be three small drones that arrived alone.) */
export const ESCORTS_PER_RAIDER = 3;
/** The hull integrity at or below which the drive is dead and the crew surrender. (Percent; the ship's hull starts at 100.) */
export const DISABLED_HULL = 35;
/** A claim or capture must be made from this close, metres. */
export const CLAIM_REACH_M = 160;

/** Where raiders are found: outside Mars neutral airspace. `agl` is metres above the ground (or the moon's surface). */
export const STATIONS = [
  { id: 'mars-orbit', frame: 'mars', agl: 2600, ring: 1500, bearing: 0.9, name: 'high over the port' },
  { id: 'phobos', frame: 'phobos', agl: 1900, ring: 900, bearing: 0.3, name: 'over Phobos' },
  { id: 'deimos', frame: 'deimos', agl: 1900, ring: 900, bearing: 2.2, name: 'over Deimos' },
];

/** How the AI fights. Distances in metres, from its own nose. */
export const FIGHT = {
  senseM: 3200,          // sees a ship in hostile airspace this far away
  closeM: 520,           // the range it tries to hold while shooting
  mainRangeM: 1100,      // the nose guns fire inside this
  turretRangeM: 950,
  breakoffM: 4200,       // a target this far off is forgotten
  escortSpeed: 70,
  escortStrafeM: 240,
  escortShotDamage: 12,
  retreatHull: 55,       // below this, with the target still shooting, it falls back to its station
};

export const RAIDER_NAMES = ['Cinder Hawk', 'Dust Wolf', 'Red Lantern', 'Bad Penny', 'Salt Magpie', 'Long Odds', 'Quiet Knife', 'Gallow Jack'];

/** What the world keeps flying. Each station holds `raiders` live raiders and `derelicts` abandoned hulls (a derelict is placed once and stays until claimed). */
export const FLEET_PLAN = [
  { station: 'mars-orbit', raiders: 1, derelicts: 0 },
  { station: 'phobos', raiders: 1, derelicts: 0 },
  { station: 'deimos', raiders: 0, derelicts: 1 },
];
/** World seconds before a station that lost its raider (claimed, or left abandoned) gets a new one. */
export const RESPAWN_S = 240;
/** The most abandoned hulls the world keeps: the oldest drifts away when a new one is made. */
export const ABANDONED_CAP = 4;
/** Paid to the ship whose guns disabled a raider (the escorts pay the old drone bounty, src/space/spaceSpec.js BOUNTY_CREDITS). */
export const DISABLE_BOUNTY_CREDITS = 150;
