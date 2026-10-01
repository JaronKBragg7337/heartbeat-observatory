// ============================================================================
// crewSpec.js — who can be hired, what they are good at, where they stand at the port, and what
// can be ordered. Pure data and tiny pure functions: no three.js, no DOM, so the validator can use it.
//
// BIBLE RULE (Jaron): NPC crew work at 70-85% efficiency with small delays. NPC crew exist for solo play; when
// other real players join they give the seat up. "Skill" below IS that efficiency: it sets how long an NPC takes to
// notice something (think) and how far off their aim and heading are (error). The player can take any seat, and the
// NPC at it steps aside.
// ============================================================================

/** The Loft people (homes/people). One of them is the player's own body (see playerLook); the rest are the crew pool. */
export const CREW_POSTS = [
  { id: 'pilot',          name: 'Ada',    personId: 'ada',    title: 'Pilot',          seat: 'pilot',      skill: 0.82,
    pitch: 'Flies what you point her at. Keeps the ship off the rocks and out of trouble.' },
  { id: 'captain',        name: 'Zuri',   personId: 'zuri',   title: 'Captain',        seat: 'captain',    skill: 0.85,
    pitch: 'Takes the chair, flies if there is no pilot, and works the main guns. You do not have to be the captain.' },
  { id: 'nav',            name: 'Jorge',  personId: 'jorge',  title: 'Navigator',      seat: 'nav',        skill: 0.78,
    pitch: 'Reads the scanner and the ground ahead and calls out what he sees.' },
  { id: 'gunner_dorsal',  name: 'Sunita', personId: 'sunita', title: 'Gunner (dorsal)', seat: 'gun_dorsal', skill: 0.75,
    pitch: 'Takes the turret on top. Fires only at raiders, and only outside Mars airspace.' },
  { id: 'gunner_ventral', name: 'Walter', personId: 'walter', title: 'Gunner (ventral)', seat: 'gun_ventral', skill: 0.72,
    pitch: 'Takes the belly turret. Slower to find a target than the others, steady once he has one.' },
];

/** Where each candidate stands at Marineris Port, in PORT-local metres (x right, z toward the south apron). They wait together
 *  by the Meridian's ramp, under a hiring board. `face` is a port-local point they look toward. */
export const HIRE_SPOTS = {
  pilot:          { x: -17.0, z: 44.0 },
  captain:        { x: -20.4, z: 46.2 },
  nav:            { x: -23.8, z: 44.6 },
  gunner_dorsal:  { x: -27.0, z: 46.4 },
  gunner_ventral: { x: -30.2, z: 44.4 },
};
export const HIRE_FACE = { x: -12.0, z: 36.0 };
export const HIRE_BOARD = { x: -23.6, z: 49.4 };

/** Seconds an NPC takes to notice a change, and radians of error in what they aim at. Small delays, never perfect. */
export const thinkDelay = (skill) => 0.25 + (1 - skill) * 4.0;
export const aimErrorRad = (skill) => (1 - skill) * 0.075;
/** The share of the ship's best the NPC reaches (cruise throttle, turn rate). */
export const throttleOf = (skill) => 0.55 + 0.45 * skill;

/** Named places the pilot can fly to, in PORT-local metres. `land` is the pad/spot to set down on; others are flown over. */
export const PLACES = [
  { id: 'pad01',   name: 'Pad 01, the Meridian\'s own pad', x: 0,   z: 0,   land: true },
  { id: 'pad02',   name: 'Pad 02 (shuttle)',                 x: 62,  z: -28, land: true },
  { id: 'pad03',   name: 'Pad 03 (courier)',                 x: 62,  z: 30,  land: true },
  { id: 'depot',   name: 'The supply depot apron',           x: -38, z: 18,  land: true },
  { id: 'tower',   name: 'Over the control tower',           x: -60, z: -39, land: false, agl: 60 },
];

/** Longest trip the crew will put in an order for: the ship cruises at ~40 m/s, so this is about forty minutes. */
export const MAX_TRIP_M = 100_000;

/** What can be ordered of whoever is flying. */
export const ORDERS = [
  { id: 'goto',   label: 'Fly to...',                 hint: 'Pick a place' },
  { id: 'hunt',   label: 'Hunt hostile drones',       hint: 'Out beyond Mars neutral airspace' },
  { id: 'supply', label: 'Get supplies',              hint: 'Depot run and back' },
  { id: 'roam',   label: 'Roam and explore',          hint: 'Wander the country; call out what is found' },
  { id: 'land',   label: 'Land here',                 hint: 'Set down where we are' },
  { id: 'hold',   label: 'Hold position',             hint: 'Hover and wait' },
  { id: 'return', label: 'Return to port',            hint: 'Back to the Meridian\'s pad' },
];

/** The reply lines. Kept here so the voice is one place. */
export const LINES = {
  hired:   (n) => `${n}: Aye. I'll find my station.`,
  noRamp:  (n) => `${n}: The ramp is up. Lower it and I'll come aboard.`,
  settle:  (n) => `${n}: Still getting the crew settled. One moment.`,
  needYou: (n) => `${n}: Come aboard first, boss. I won't lift without you.`,
};
