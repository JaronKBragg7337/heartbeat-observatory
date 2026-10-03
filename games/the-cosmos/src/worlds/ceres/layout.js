// ============================================================================
// worlds/ceres/layout.js — where everything at OCCATOR WORKS stands. Pure data: no three.js, no DOM. The browser draws from it
// (outpost.js), the authority checks "are you standing at the supply desk" and "may spoil be dropped here" against it, and the validator
// reads it. Outpost-local metres: x EAST, z SOUTH (north is -z), y up, origin at the middle of the main pad (padInfo.point), the same frame
// the Mars port and the moon pads are drawn in. The flat graded ground is 150 m round the origin, so everything stands inside 130 m.
// ============================================================================

export const OUTPOST_NAME = 'OCCATOR WORKS';

/** The main pad: a slab the Meridian's size, with the station round it. */
export const MAIN_PAD = { x: 0, z: 0, w: 58, d: 58 };

/** Solid footprints (people and carts do not walk through these; spoil is not poured on them). h is the height of what stands there. */
export const BOXES = [
  // the foundry hall: a door on its south face (the south wall is two pieces with a 10 m gap)
  { id: 'foundry-n', x0: -22, x1: 8, z0: -112, z1: -111.2, h: 11 },
  { id: 'foundry-w', x0: -22, x1: -21.2, z0: -112, z1: -88, h: 11 },
  { id: 'foundry-e', x0: 7.2, x1: 8, z0: -112, z1: -88, h: 11 },
  { id: 'foundry-sw', x0: -22, x1: -9, z0: -88.8, z1: -88, h: 11 },
  { id: 'foundry-se', x0: 1, x1: 8, z0: -88.8, z1: -88, h: 11 },
  { id: 'furnace', x0: -10, x1: -2, z0: -104, z1: -96, h: 7 },
  // the supply shed: open on its east side (toward the pad); back, side walls, and the counter across the front
  { id: 'supply-back', x0: -78.4, x1: -77.6, z0: 10, z1: 26, h: 6.5 },
  { id: 'supply-n', x0: -78.4, x1: -56, z0: 9.6, z1: 10.4, h: 6.5 },
  { id: 'supply-s', x0: -78.4, x1: -56, z0: 25.6, z1: 26.4, h: 6.5 },
  { id: 'supply-counter', x0: -64.6, x1: -63.6, z0: 11, z1: 25, h: 1.1 },
  // bunkhouse (containers in a row)
  { id: 'bunkhouse', x0: 49, x1: 83, z0: -60, z1: -48.5, h: 4.6 },
  // lane office
  { id: 'lane-office', x0: 74, x1: 82, z0: 26, z1: 34, h: 9 },
  // ore bins and the legs of the gantry
  { id: 'bin-1', x0: -66, x1: -57, z0: -80, z1: -71, h: 9 },
  { id: 'bin-2', x0: -54, x1: -45, z0: -80, z1: -71, h: 9 },
  { id: 'bin-3', x0: -42, x1: -33, z0: -80, z1: -71, h: 9 },
  // tanks
  { id: 'tank-1', x0: 83.5, x1: 94.5, z0: 55, z1: 66, h: 12 },
  { id: 'tank-2', x0: 96, x1: 107, z0: 55, z1: 66, h: 12 },
  { id: 'tank-3', x0: 83.5, x1: 94.5, z0: 69, z1: 80, h: 12 },
  // haul trucks parked west of the supply shed
  { id: 'truck-1', x0: -112, x1: -99, z0: 30, z1: 36.5, h: 5 },
  { id: 'truck-2', x0: -108, x1: -95, z0: 52, z1: 58.5, h: 5 },
  // the pole of each floodlight mast
  ...[[-38, -34], [38, -40], [44, 42], [-44, 44], [0, -66], [0, 74]].map(([x, z], i) => ({ id: 'mast-' + i, x0: x - 0.5, x1: x + 0.5, z0: z - 0.5, z1: z + 0.5, h: 16 })),
];

/** The people of the Works. `trade` names what the Talk panel offers (people.js). `title` is what the button shows. Voices: none yet (text only). */
export const WORKERS = [
  { id: 'foreman', name: 'Marta Voss', title: 'Foundry foreman', x: -6, z: -84, face: 'south', trade: 'ore', personId: 'sunita',
    line: 'Ore and salt in, ingot and soda out. Weigh it at the hopper and I pay on the spot. Mars pays better, if you want the longer haul.',
    question: 'Why does the Compact smelt on Ceres?', answer: 'Everything a furnace needs is within a kilometre: the metal under the flats, the salt for flux, the ice for the quench. And the gravity is so low that a ladle weighs next to nothing. The hard part is the dig, not the burn.', reply: 'Then let me show you my load.' },
  { id: 'supply', name: 'Idris Kell', title: 'Supply desk', x: -68, z: 18, face: 'east', trade: 'supply', personId: 'jorge',
    line: 'Water, rations, oxygen, spares, ammunition. Ceres has water; it does not have the rest. I pay twice what Mars charges for anything that came up the lane.',
    question: 'You have ice under your feet. Why buy water?', answer: 'Clean water, sealed and tested. Ours comes from the brine and tastes of salt, and the Greenhaven filters cost more than the water. A litre from Mars is a litre nobody had to boil.', reply: 'Then let me see what you will pay for.' },
  { id: 'pad-marshal', name: 'Teo Alvarado', title: 'Pad marshal', x: 12, z: 36, face: 'north', trade: null, personId: 'aoi',
    line: 'Pad one is the Works\' own. Visitors have their pads east of the cut road: follow the amber lights. Keep your boots off the markings, and mind how you jump: one hop and you are over the barriers.',
    question: 'What is the white ground over there?', answer: 'Salt. Sodium carbonate, from the brine that came up through Occator. The big bright patch east is the dome, eleven kilometres out: Cerealia. The Compact fences the thick deposits. The pans by the road are ours to dig.', reply: 'Salt. Got it.' },
  { id: 'lane-clerk', name: 'Ines Okafor', title: 'Lane office', x: 72, z: 30, face: 'west', trade: null, personId: 'zuri',
    line: 'Lane office. One hundred and twenty credits a jump, taken when the coils fire. The gate is open between the storms; that is all anyone promises.',
    question: 'What is the Ore Lane?', answer: 'A surveyed corridor between here and Mars: the one lane the Sun-heat storms leave open. Ceres is a long way past what the drive can fly, so the Compact keeps the gates and charges for the upkeep. You fly to the gate, the coils spool twenty seconds, and the corridor does the rest.', reply: 'Twenty seconds. Understood.' },
  { id: 'shift-boss', name: 'Dray Hallett', title: 'Shift boss', x: 58, z: -43, face: 'south', trade: null, personId: 'walter',
    line: 'Bunks are for Compact crews. If the Compact strikes, nothing leaves this place, so mind what you promise anyone. And the Greenhaven people are not the enemy, whatever the board says.',
    question: 'What is a strike like?', answer: 'The belts stop, the furnaces idle and the gates go quiet. A week of it and the shelves at the supply desk are bare, and the Greenhaven domes start rationing us water. Then everyone remembers why they signed.', reply: 'I will stay out of it.' },
  { id: 'driller', name: 'Noor Bekele', title: 'Haul driver', x: -95, z: 44, face: 'east', trade: null, personId: 'ada', pose: 'seated',
    line: 'Eight benches down and eight back up, forty tonnes a run. Mind the ramps: they are wider than they look. And do not drop anything on the way: it falls slowly enough to hit you.',
    question: 'What is it like in The Cut?', answer: 'Dark at the bottom and the walls ring when the blasting starts. Seams run rust-red through the grey, and the white salt comes up in veins. Dig where the colour is.', reply: 'Dig where the colour is.' },
  { id: 'welder', name: 'Piet Lang', title: 'Maintenance welder', x: 14, z: -86, face: 'west', trade: null, personId: 'isaiah',
    line: 'Everything here is welded twice: once for the load and once for the cold. Stand back from the tap.',
    question: 'Any advice for a newcomer?', answer: 'It is a hundred and seventy below in the shade and not much warmer in the light. Keep your suit heaters up, and never put a bare hand on anything that has not seen the Sun.', reply: 'Heaters up. Right.' },
];

/** The ore seams' beacons and the cut road are drawn from the world's own spec (spec.seams). */

/** Is outpost-local (x, z) on something solid or on a worker? (the spoil guard) */
export function solidAt(x, z, margin = 0.3) {
  for (const b of BOXES) if (x > b.x0 - margin && x < b.x1 + margin && z > b.z0 - margin && z < b.z1 + margin) return true;
  for (const w of WORKERS) if (Math.hypot(x - w.x, z - w.z) < 0.7) return true;
  if (Math.abs(x - MAIN_PAD.x) < MAIN_PAD.w / 2 + 1.5 && Math.abs(z - MAIN_PAD.z) < MAIN_PAD.d / 2 + 1.5) return true;
  return false;
}

/** Outpost-local (x east, y up, z south) -> the world's frame coordinates, given the body's padInfo ({ point, east, up, north }). */
export function outpostToFrame(pi, x, y, z) {
  return { x: pi.point.x + pi.east.x * x + pi.up.x * y - pi.north.x * z, y: pi.point.y + pi.east.y * x + pi.up.y * y - pi.north.y * z, z: pi.point.z + pi.east.z * x + pi.up.z * y - pi.north.z * z };
}
/** And back: a frame point to outpost-local metres. */
export function frameToOutpost(pi, p) {
  const dx = p.x - pi.point.x, dy = p.y - pi.point.y, dz = p.z - pi.point.z;
  return { x: dx * pi.east.x + dy * pi.east.y + dz * pi.east.z, y: dx * pi.up.x + dy * pi.up.y + dz * pi.up.z, z: -(dx * pi.north.x + dy * pi.north.y + dz * pi.north.z) };
}
