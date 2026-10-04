// ============================================================================
// shipSpec.js — the MSV Meridian, as data. One source of truth.
//
// OWNS: every measurement of the ship. Rooms, doors, stairs, ladders, seats,
//       furniture, lights, landing gear, guns. Geometry, collision, the
//       validator and the debug layer all READ this file; none of them keep a
//       private copy of a dimension.
// DOES NOT OWN: how anything looks (shipInterior.js / shipExterior.js), how a
//       body moves through it (shipWalker.js), or how it flies (shipFlight.js).
//
// WHY ONE FILE
// ------------
// The failure this project keeps having is a picture and a collider that
// disagree: a door you can see through but not walk through, a wall you can walk
// through but not see. That cannot happen if both are generated from the same
// rectangle. Nothing here imports three.js, so the validator can walk the ship
// in Node with no GPU.
//
// SHIP-LOCAL FRAME (metres)
//   +X starboard (right)   +Y up   -Z forward (the bow is at -Z)
//   Origin: the centreline, at the LOWER-deck floor. Right-handed, and the same
//   axes three.js gives a camera, so a seat's "forward" is simply -Z.
//
// REAL HUMAN SCALE. Avatar 1.78 m, eye 1.66 m. Deck pitch 3.0 m (2.7 m clear
// plus a 0.3 m slab). Doors 1.0 m wide by 2.1 m. Corridors 1.6 m wide. Stairs
// rise 0.1875 m per step, the same as a building code riser.
// ============================================================================

import { assignDoorLabels } from '../ships/layoutKit.js';

export const SHIP_ID = 'COS-MARS-VEH-0001';
export const SHIP_NAME = 'MSV Meridian';

export const DECK = { lower: 0.0, main: 3.0, bridge: 6.0, pitch: 3.0, clear: 2.7, slab: 0.3 };
export const AVATAR = { heightM: 1.78, eyeM: 1.66, radiusM: 0.28, stepM: 0.5, seatedEyeM: 1.12 };

// ---------------------------------------------------------------------------
// Rooms. Each is a clear box: the air you can stand in. Walls, floors and
// ceilings are generated on the faces of these boxes.
// ---------------------------------------------------------------------------
const rooms = [];
function room(id, name, kind, deck, x0, x1, z0, z1, o = {}) {
  const r = {
    id, name, kind, deck, x0, x1, z0, z1,
    y: o.y ?? DECK[deck], h: o.h ?? DECK.clear,
    style: o.style || kind,
    floorHoles: o.floorHoles || [], ceilHoles: o.ceilHoles || [],
    lights: o.lights || null,
  };
  rooms.push(r);
  return r;
}

// --- Main deck (y = 3.0) ---------------------------------------------------
// The corridor runs straight to the cargo door at its aft end. (It used to end in the engineering stair, whose top
// step sat beside the workshop and cabin doors and whose foot stood in front of the cargo door.)
room('corridor_main', 'Main corridor', 'corridor', 'main', -0.8, 0.8, -8.9, 9.6);
room('medbay',   'Medbay',           'medbay',   'main', -6.4, -1.0, -8.6, -3.6);
room('crew_a',   'Crew quarters A',  'crew',     'main', -6.4, -1.0, -3.4, 1.4);
room('niche',    'Turret ladder',    'niche',    'main', -2.4, -1.0, 1.6, 3.6, {
  ceilHoles: [{ x0: -2.4, x1: -1.2, z0: 2.1, z1: 3.1 }],
});
room('workshop', 'Workshop',         'workshop', 'main', -6.4, -1.0, 3.8, 9.0);
room('galley',   'Galley and mess',  'galley',   'main',  1.0, 6.4, -8.6, -2.6);
room('crew_b',   'Observation lounge', 'crew',     'main',  1.0, 6.4, -2.4, 2.6);
room('cabin',    "Captain's cabin",  'cabin',    'main',  1.0, 6.4, 2.8, 5.8);
room('head',     'Head',             'head',     'main',  1.0, 6.4, 6.0, 9.0);

// --- Lower deck (y = 0) ----------------------------------------------------
room('engineering', 'Engineering', 'engineering', 'lower', -6.4, 6.4, -7.0, 9.2);
room('corridor_low', 'Lower corridor', 'corridor', 'lower', -0.8, 0.8, -13.7, -7.2);
room('airlock',  'Airlock',      'airlock',   'lower', -6.4, -1.0, -12.8, -8.2);
room('evalocker','EVA locker',   'evalocker', 'lower',  1.0, 6.4, -12.8, -8.2);
room('ventral',  'Ventral turret access', 'ventral', 'lower', -2.2, 2.2, -16.8, -13.9, {
  floorHoles: [{ x0: -0.7, x1: 0.7, z0: -16.0, z1: -14.6 }],
});
room('cargo',    'Cargo bay',    'cargo',     'lower', -5.8, 5.8, 9.8, 20.9, { h: 5.5 });

// --- Upper decks -----------------------------------------------------------
room('bridge',   'Bridge',       'bridge', 'bridge', -4.0, 4.0, -19.4, -13.4);
room('nest',     'Dorsal turret', 'nest',  'bridge', -2.5, 1.6, 1.6, 4.0, {
  y: 6.95, h: 2.4,
  floorHoles: [{ x0: -2.4, x1: -1.2, z0: 2.1, z1: 3.1 }],
});

// Two stairwells are rooms too, with sloped floors and ceilings.
export const STAIRS = {
  up:   { id: 'stair_up',   name: 'Bridge stair',      x0: -0.8, x1: 0.8, zLow: -8.9, zHigh: -13.4, yLow: 3.0, yHigh: 6.0, rise: 16 },
  // The way between the decks: a stair up the west wall of the cargo bay to a gantry along the bay's fore wall,
  // and from the gantry a door into the main corridor. It stands in the biggest room on the ship, clear of every door.
  cargo: { id: 'stair_cargo', name: 'Cargo bay stair', x0: -5.6, x1: -4.0, zHigh: 11.4, zLow: 15.6, yHigh: 3.0, yLow: 0.0, rise: 16, solid: true, room: 'cargo' },
};

/** The gantry: a walkway at main-deck height along the cargo bay's fore wall. The stair comes up at its west end. */
export const GANTRY = { id: 'gantry', x0: -5.6, x1: 0.8, z0: 9.8, z1: 11.4, y: 3.0, thick: 0.3 };

// ---------------------------------------------------------------------------
// Doors. axis 'x': the wall is the plane x = at, you pass along X.
//        axis 'z': the wall is the plane z = at, you pass along Z.
// c = centre along the other axis. kind: slide | open | hatch | outer
// ---------------------------------------------------------------------------
const doors = [];
function door(id, a, b, axis, at, c, o = {}) {
  doors.push({
    id, a, b, axis, at, c,
    w: o.w ?? 1.0, h: o.h ?? 2.1, y: o.y ?? DECK[o.deck || 'main'],
    kind: o.kind || 'slide', sign: o.sign || null, signFace: o.signFace || 'a', noZone: !!o.noZone,
  });
}
// main deck, corridor to rooms
door('d_medbay',  'corridor_main', 'medbay',   'x', -0.9, -6.1, { sign: 'MEDBAY' });
door('d_crew_a',  'corridor_main', 'crew_a',   'x', -0.9, -1.0, { sign: 'CREW A' });
door('d_niche',   'corridor_main', 'niche',    'x', -0.9,  2.6, { kind: 'open', w: 1.4, h: 2.4 });
door('d_workshop','corridor_main', 'workshop', 'x', -0.9,  4.05,{ sign: 'WORKSHOP', w: 0.9 });
door('d_galley',  'corridor_main', 'galley',   'x',  0.9, -5.6, { sign: 'GALLEY' });
door('d_crew_b',  'corridor_main', 'crew_b',   'x',  0.9,  0.1, { sign: 'LOUNGE' });
door('d_cabin',   'corridor_main', 'cabin',    'x',  0.9,  3.3, { sign: 'CAPTAIN', w: 0.9 });
door('d_head',    'cabin',         'head',     'z',  5.9,  3.3, { sign: 'HEAD', w: 0.9 });
// bridge stair joins
door('d_stair_up_lo', 'corridor_main', 'stair_up', 'z', -8.9, 0, { kind: 'open', w: 1.2, h: 2.7 });
door('d_stair_up_hi', 'stair_up',      'bridge',   'z', -13.4, 0, { kind: 'open', w: 1.2, h: 2.7, y: 6.0, noZone: true });
// lower deck
door('d_eng_fore', 'engineering', 'corridor_low', 'z', -7.1, 0, { deck: 'lower', sign: 'ENGINEERING', signFace: 'b' });
door('d_airlock_in',  'corridor_low', 'airlock',   'x', -0.9, -10.8, { deck: 'lower', sign: 'AIRLOCK' });
door('d_evalocker',   'corridor_low', 'evalocker', 'x',  0.9, -10.8, { deck: 'lower', sign: 'EVA' });
door('d_ventral',     'corridor_low', 'ventral',   'z', -13.8, 0,   { deck: 'lower', kind: 'open', w: 1.2, h: 2.4 });
door('d_cargo',       'engineering',  'cargo',     'z',  9.5, 3.4,  { deck: 'lower', w: 2.4, h: 2.4, sign: 'CARGO LOWER' });
door('d_cargo_up',    'corridor_main', 'cargo',    'z',  9.7, 0,    { w: 1.0, h: 2.1, sign: 'CARGO UPPER' });
door('d_ramp',        'cargo',        'outside',   'z', 20.9, 0,    { deck: 'lower', kind: 'portal', w: 3.6, h: 5.2, noZone: true });
door('d_airlock_out', 'airlock',      'outside',   'x', -6.5, -10.8, { deck: 'lower', kind: 'outer', w: 1.3, h: 2.2 });

// ---------------------------------------------------------------------------
// Ramps that go to the ground. The lowered angle is solved at landing time so
// the end really touches the terrain; the numbers here are the hardware.
// ---------------------------------------------------------------------------
export const RAMPS = {
  cargo: {
    id: 'ramp_cargo', name: 'Boarding ramp',
    hinge: { x: 0, y: 0, z: 20.9 }, dir: { x: 0, z: 1 },      // runs aft, out of the ship
    length: 5.0, width: 3.6, raisedHeight: 5.0,
    panel: { thickness: 0.18 },
  },
  airlock: {
    id: 'ramp_airlock', name: 'Airlock gangway',
    hinge: { x: -6.55, y: 0, z: -10.8 }, dir: { x: -1, z: 0 }, // runs to port
    length: 5.0, width: 1.4, raisedHeight: 2.2,
    panel: { thickness: 0.12 },
  },
};

// ---------------------------------------------------------------------------
// Ladders. `face` is the direction the climber looks (into the wall).
// ---------------------------------------------------------------------------
export const LADDERS = [
  {
    id: 'ladder_dorsal', name: 'Dorsal turret ladder',
    x: -2.05, z: 2.6, face: { x: -1, z: 0 },        // rungs on the wall at x = -2.35
    y0: 3.0, y1: 6.95,
    bottom: { x: -1.45, z: 2.6 },                   // where you stand to start climbing
    topExit: { x: -0.8, z: 2.6, y: 6.95 },          // where you step off at the top
    bottomExit: { x: -1.45, z: 2.6, y: 3.0 },
    topEnter: { x: -0.8, z: 2.6, y: 6.95 },
  },
  {
    id: 'ladder_ventral', name: 'Ventral turret ladder',
    x: 0, z: -14.85, face: { x: 0, z: 1 },          // rungs on the near wall of the hatch
    y0: -1.0, y1: 0.0,
    bottom: { x: 0, z: -15.0 },
    topExit: { x: 0, z: -14.15, y: 0.0 },
    bottomExit: { x: 0, z: -15.0, y: -1.0 },
    topEnter: { x: 0, z: -14.15, y: 0.0 },
  },
];

// Extra walkable pieces that are not simply a room floor.
export const EXTRA_ZONES = [
  { id: 'dais',  x0: -1.4, x1: 1.4, z0: -16.5, z1: -14.6, floor: 6.2, ceil: 8.7, kind: 'dais', room: 'bridge' },
  { id: 'pit',   x0: -0.7, x1: 0.7, z0: -16.0, z1: -14.6, floor: -1.0, ceil: 2.7, kind: 'pit', room: 'ventral' },
  { id: 'gantry', x0: GANTRY.x0, x1: GANTRY.x1, z0: GANTRY.z0, z1: GANTRY.z1, floor: GANTRY.y, ceil: 5.5, kind: 'gantry', room: 'cargo' },
];

// ---------------------------------------------------------------------------
// Seats. pos is the seat pan on the floor under it; yaw 0 faces the bow.
// ---------------------------------------------------------------------------
export const SEATS = [
  { id: 'captain', stationId: 'COS-MARS-STR-0010', name: "Captain's chair", room: 'bridge',
    x: 0.0, y: 6.2, z: -15.7, yaw: 0, lookYaw: 115, lookPitchUp: 55, lookPitchDown: 35,
    role: 'flight+guns', hint: 'Fly the ship and fire the main guns' },
  { id: 'pilot', stationId: 'COS-MARS-STR-0011', name: 'Pilot seat', room: 'bridge',
    x: -1.6, y: 6.0, z: -17.2, yaw: 0, lookYaw: 90, lookPitchUp: 50, lookPitchDown: 35,
    role: 'flight', hint: 'Fly the ship: lift, thrust, turn, land' },
  { id: 'nav', stationId: 'COS-MARS-STR-0012', name: 'Navigation', room: 'bridge',
    x: 1.6, y: 6.0, z: -17.2, yaw: 0, lookYaw: 90, lookPitchUp: 50, lookPitchDown: 35,
    role: 'nav', hint: 'Scanner and map: where you are on Mars' },
  { id: 'comms', stationId: 'COS-MARS-STR-0013', name: 'Communications', room: 'bridge',
    x: 2.5, y: 6.0, z: -15.7, yaw: 90, lookYaw: 90, lookPitchUp: 50, lookPitchDown: 35,
    role: 'comms', hint: 'Ship log and beacon' },
  { id: 'engineer', stationId: 'COS-MARS-STR-0014', name: 'Engineering', room: 'engineering',
    x: 4.75, y: 0.0, z: -3.2, yaw: 90, lookYaw: 90, lookPitchUp: 50, lookPitchDown: 35,
    role: 'power', hint: 'Route reactor power between engines, guns and shields' },
  { id: 'gun_dorsal', stationId: 'COS-MARS-STR-0015', name: 'Dorsal turret', room: 'nest',
    x: 0.2, y: 6.95, z: 2.8, yaw: 0, lookYaw: 180, lookPitchUp: 85, lookPitchDown: 8,
    role: 'turret', hint: 'Aim and fire the dorsal turret' },
  { id: 'gun_ventral', stationId: 'COS-MARS-STR-0016', name: 'Ventral turret', room: 'ventral',
    x: 0.0, y: -1.0, z: -15.3, yaw: 0, lookYaw: 180, lookPitchUp: 15, lookPitchDown: 80,
    role: 'turret', hint: 'Aim and fire the ventral turret' },
];

// ---------------------------------------------------------------------------
// Other things you operate by standing at them.
// ---------------------------------------------------------------------------
// moons-fix: how high a seated person's hips sit above the seat's floor mark depends on the chair that is DRAWN (its variant), not on the seat's name.
// Three renderers each had their own table keyed by the Meridian's seat ids, so on the Wayfarer (nav/comms/engineer drawn as bucket seats) crew floated or sank.
export const SEAT_PAN = { captain: 0.63, pilot: 0.47, swivel: 0.57, gunner: 0.44 };
const DEFAULT_SEAT_VARIANT = { captain: 'captain', pilot: 'pilot', nav: 'swivel', comms: 'swivel', engineer: 'swivel', gun_dorsal: 'gunner', gun_ventral: 'gunner' };
export const seatVariant = (seat) => seat.variant || DEFAULT_SEAT_VARIANT[seat.id] || 'pilot';
export const seatPan = (seat) => SEAT_PAN[seatVariant(seat)] ?? 0.47;
export const PANELS = [
  { id: 'panel_ramp',    name: 'Boarding ramp',  x: -5.0, y: 0, z: 20.1, radius: 2.1, action: 'ramp_cargo' },
  { id: 'panel_air',     name: 'Airlock',        x: -3.5, y: 0, z: -12.0, radius: 1.9, action: 'airlock' },
];

// Wall screens that are not part of a console. facing = the way the screen looks.
export const WALL_SCREENS = [
  { id: 'scr_med_1', room: 'medbay', kind: 'vitals', x: -6.37, y: 4.55, z: -7.3, w: 0.5, h: 0.32, facing: 'x+' },
  { id: 'scr_med_2', room: 'medbay', kind: 'vitals', x: -6.37, y: 4.55, z: -5.3, w: 0.5, h: 0.32, facing: 'x+' },
  { id: 'scr_galley', room: 'galley', kind: 'menu', x: 6.37, y: 4.9, z: -3.9, w: 0.9, h: 0.55, facing: 'x-' },
  { id: 'scr_work', room: 'workshop', kind: 'schematic', x: -6.37, y: 4.5, z: 5.0, w: 0.9, h: 0.6, facing: 'x+' },
  { id: 'scr_cargo', room: 'cargo', kind: 'manifest', x: -5.77, y: 1.7, z: 16.4, w: 1.0, h: 0.65, facing: 'x+' },
  { id: 'scr_eng_wall', room: 'engineering', kind: 'reactorwall', x: 2.3, y: 2.0, z: -6.97, w: 1.6, h: 0.75, facing: 'z+' },
  { id: 'scr_bridge_big', room: 'bridge', kind: 'ship', x: -3.97, y: 7.45, z: -15.8, w: 1.2, h: 0.7, facing: 'x+' },
];


// ---------------------------------------------------------------------------
// Furniture. kind, room, position of the centre on the floor, plan size,
// rotation in 90-degree steps. Collision is the plan box; both come from here.
// ---------------------------------------------------------------------------
const props = [];
function prop(kind, roomId, x, z, w, d, h, rot = 0, o = {}) {
  const r = rooms.find((q) => q.id === roomId);
  props.push({
    kind, room: roomId, x, z, y: o.y ?? (r ? r.y : 0), w, d, h, rot,
    blocks: o.blocks !== false, style: o.style || null, ...(o.extra || {}),
  });
}

// medbay
prop('medbed', 'medbay', -5.0, -7.3, 2.0, 0.85, 0.62, 0, { extra: { arch: true } });
prop('medbed', 'medbay', -5.0, -5.3, 2.0, 0.85, 0.62, 0);
prop('counter','medbay', -4.65, -8.3, 3.3, 0.6, 0.95, 0, { style: 'med' });
prop('locker', 'medbay', -6.05, -3.9, 0.6, 0.55, 2.0, 2);
prop('locker', 'medbay', -5.4, -3.9, 0.6, 0.55, 2.0, 2);
prop('locker', 'medbay', -4.75, -3.9, 0.6, 0.55, 2.0, 2);
prop('monitor_stand','medbay', -2.6, -8.0, 0.5, 0.5, 1.5, 0);

// crew A: two double bunks on the port wall, lockers, a small table
prop('bunk', 'crew_a', -5.85, -2.2, 0.95, 2.1, 1.9, 0);
prop('bunk', 'crew_a', -5.85,  0.2, 0.95, 2.1, 1.9, 0);
prop('locker','crew_a', -3.2, 1.1, 0.6, 0.55, 2.0, 2);
prop('locker','crew_a', -2.55, 1.1, 0.6, 0.55, 2.0, 2);
prop('locker','crew_a', -1.9, 1.1, 0.6, 0.55, 2.0, 2);
prop('table', 'crew_a', -3.9, -1.9, 0.9, 0.9, 0.75, 0);

// workshop
prop('counter','workshop', -6.05, 6.4, 3.6, 0.7, 0.95, 1, { style: 'bench' });
prop('printer','workshop', -6.0, 8.55, 0.7, 0.7, 1.4, 0);
prop('locker', 'workshop', -3.2, 8.7, 0.6, 0.55, 2.0, 2);
prop('locker', 'workshop', -2.55, 8.7, 0.6, 0.55, 2.0, 2);
prop('locker', 'workshop', -1.9, 8.7, 0.6, 0.55, 2.0, 2);
prop('crate',  'workshop', -3.4, 5.4, 0.9, 0.9, 0.9, 0);
prop('drill',  'workshop', -4.6, 8.4, 0.5, 0.5, 1.5, 0);

// galley
prop('counter','galley', 6.05, -7.35, 2.5, 0.6, 0.95, 3, { style: 'galley' });
prop('fridge', 'galley', 6.0, -5.55, 0.7, 0.7, 1.9, 3);
prop('counter','galley', 6.05, -3.85, 2.2, 0.6, 0.95, 3, { style: 'galley' });
prop('table',  'galley', 3.75, -5.6, 0.9, 2.4, 0.76, 0, { style: 'mess' });
prop('bench',  'galley', 2.95, -5.6, 0.36, 2.3, 0.46, 0);
prop('bench',  'galley', 4.55, -5.6, 0.36, 2.3, 0.46, 0);

// The observation lounge (it was crew quarters B): the starboard wall is one long window, two lounge seats face it, and
// there is room to stand at the glass and use the binoculars. (Jaron, 10/1: "there isn't any spots to observe places".)
prop('sofa', 'crew_b', 4.5, -1.05, 0.8, 1.5, 0.85, 0);
prop('sofa', 'crew_b', 4.5,  1.25, 0.8, 1.5, 0.85, 0);
prop('rail', 'crew_b', 6.18, 0.1, 0.05, 4.3, 1.04, 0, { blocks: false });
prop('telescope', 'crew_b', 5.7, 0.1, 0.5, 0.5, 1.5, 0);
prop('locker','crew_b', 3.2, 2.3, 0.6, 0.55, 2.0, 2);
prop('locker','crew_b', 3.85, 2.3, 0.6, 0.55, 2.0, 2);

// captain's cabin
prop('bed',   'cabin', 5.3, 4.95, 2.0, 1.5, 0.55, 0);
prop('desk',  'cabin', 1.95, 5.45, 1.5, 0.7, 0.75, 2);
prop('locker','cabin', 6.1, 3.15, 0.6, 0.55, 2.0, 3);
prop('locker','cabin', 6.1, 3.75, 0.6, 0.55, 2.0, 3);

// head
prop('toilet', 'head', 2.2, 8.65, 0.5, 0.7, 0.42, 2);
prop('sink',   'head', 3.3, 8.75, 0.6, 0.45, 0.95, 2);
prop('shower', 'head', 5.75, 8.45, 1.0, 1.0, 2.2, 0);

// rugs, extinguishers, first aid: things that make a room look lived in. None of them is in the way.
prop('rug', 'crew_a', -3.5, -1.0, 2.6, 1.7, 0.02, 0, { blocks: false });
prop('rug', 'crew_b', 3.7, 0.1, 2.6, 1.7, 0.02, 0, { blocks: false });
prop('rug', 'cabin', 3.6, 4.2, 2.2, 1.5, 0.02, 0, { blocks: false });
prop('rug', 'medbay', -3.4, -6.1, 2.2, 1.6, 0.02, 0, { blocks: false, extra: { tone: 'med' } });
prop('extinguisher', 'corridor_main', -0.72, -4.0, 0.16, 0.16, 0.5, 1, { blocks: false, y: 4.3 });
prop('extinguisher', 'corridor_main', 0.72, 2.0, 0.16, 0.16, 0.5, 3, { blocks: false, y: 4.3 });
prop('firstaid', 'corridor_main', 0.74, -2.6, 0.3, 0.12, 0.3, 3, { blocks: false, y: 4.4 });
prop('firstaid', 'corridor_low', -0.74, -9.5, 0.3, 0.12, 0.3, 1, { blocks: false, y: 1.4 });
prop('extinguisher', 'corridor_low', 0.72, -12.0, 0.16, 0.16, 0.5, 3, { blocks: false, y: 1.3 });
prop('extinguisher', 'engineering', 6.3, 6.8, 0.16, 0.16, 0.5, 3, { blocks: false, y: 1.2 });
prop('extinguisher', 'cargo', 5.7, 19.4, 0.16, 0.16, 0.5, 3, { blocks: false, y: 1.2 });

// engineering
prop('reactor', 'engineering', 0.0, -0.8, 3.6, 3.6, 2.7, 0, { extra: { radius: 1.25 } });
prop('console', 'engineering', 6.05, -3.2, 2.4, 0.6, 1.15, 3, { extra: { screens: 2, station: 'engineer' } });
prop('rack',    'engineering', -6.0, -5.7, 1.4, 0.7, 2.3, 1);
prop('rack',    'engineering', -6.0, -4.1, 1.4, 0.7, 2.3, 1);
prop('rack',    'engineering', -6.0, -2.5, 1.4, 0.7, 2.3, 1);
prop('tank',    'engineering', -5.3, 2.0, 1.4, 1.4, 2.7, 0);
prop('tank',    'engineering', -5.3, 4.3, 1.4, 1.4, 2.7, 0);
prop('tank',    'engineering', -5.3, 6.6, 1.4, 1.4, 2.7, 0);
prop('pump',    'engineering',  5.4, 3.0, 1.2, 1.6, 1.3, 0);
prop('pump',    'engineering',  5.4, 5.6, 1.2, 1.6, 1.3, 0);
prop('console', 'engineering', -4.4, -6.55, 2.0, 0.6, 1.15, 0, { extra: { screens: 2, decorative: true, station: 'diag' } });
prop('crate',   'engineering',  5.7, 7.2, 1.0, 1.0, 1.0, 0);

// cargo
// (the west side belongs to the stair and the gantry now; its crates stand at the aft end of the bay)
prop('crate', 'cargo', -4.9, 18.1, 1.4, 1.4, 1.4, 0);
// moons-fix: this crate stood at (-2.8, 19.7) and sealed the ramp panel (-5, 20.1) in a pocket: from inside the ship you could not get within reach of it, so on a moon (ramp raised) nobody could lower the ramp
prop('crate', 'cargo', 4.9, 19.9, 1.4, 1.4, 1.4, 0);
prop('crate', 'cargo', -4.9, 18.1, 1.4, 1.4, 1.4, 0, { y: 1.4 });
prop('crate', 'cargo', -3.0, 17.8, 1.8, 1.4, 1.2, 0);
prop('crate', 'cargo',  5.0, 12.7, 1.6, 1.6, 1.6, 0);              // clear of the engineering door: 1 m of floor in front of it
prop('crate', 'cargo',  5.0, 12.7, 1.6, 1.6, 1.0, 0, { y: 1.6 });
prop('crate', 'cargo',  5.0, 14.2, 1.0, 1.0, 1.0, 0);
prop('drum',  'cargo',  4.8, 15.2, 0.7, 0.7, 1.0, 0);
prop('drum',  'cargo',  4.8, 16.1, 0.7, 0.7, 1.0, 0);
prop('drum',  'cargo',  4.0, 15.6, 0.7, 0.7, 1.0, 0);
// The hold rover is a vehicle (src/vehicles, type 'survey'), spawned on the centreline by the server.
// the gantry: columns under it and a rail along every open edge (a rail only stops someone standing ON the gantry)
prop('column', 'cargo', -3.0, 11.2, 0.3, 0.3, 2.7, 0);
prop('column', 'cargo', -0.4, 11.2, 0.3, 0.3, 2.7, 0);
prop('rail', 'cargo', -1.65, 11.34, 4.7, 0.1, 1.05, 0, { y: 3.0 });
prop('rail', 'cargo',  0.74, 10.54, 0.1, 1.48, 1.05, 0, { y: 3.0 });

// lower fore
prop('console', 'airlock', -3.5, -12.55, 1.0, 0.5, 1.1, 0, { extra: { screens: 1, decorative: true, station: 'airlock' } });
prop('console', 'cargo', -5.55, 20.1, 1.0, 0.5, 1.1, 1, { extra: { screens: 1, decorative: true, station: 'ramp' } });
prop('suitrack', 'evalocker', 6.05, -11.9, 0.8, 0.6, 2.0, 3);
prop('suitrack', 'evalocker', 6.05, -10.7, 0.8, 0.6, 2.0, 3);
prop('suitrack', 'evalocker', 6.05, -9.5, 0.8, 0.6, 2.0, 3);
prop('bench',    'evalocker', 3.4, -10.8, 0.4, 2.2, 0.46, 0);
prop('suitrack', 'airlock', -6.05, -12.4, 0.8, 0.6, 2.0, 1);
prop('suitrack', 'airlock', -6.05, -9.2, 0.8, 0.6, 2.0, 1);

// bridge
// The flight consoles are LOW: a dashboard, not a wall. Their screens end at 7.09 m, just under the seated eye
// (pilot 6.0 + 1.12), so the windscreen above them is clear to fly by. (They used to reach 7.5 m, right across the horizon.)
const LOWCON = { screens: 3, lift: 0.2, fh: 0.36, sh: 0.32 };
prop('console', 'bridge', -1.6, -18.85, 2.2, 1.0, 0.72, 0, { extra: { ...LOWCON, station: 'pilot' } });
prop('console', 'bridge',  1.6, -18.85, 2.2, 1.0, 0.72, 0, { extra: { ...LOWCON, station: 'nav' } });
prop('console', 'bridge', -3.45, -18.85, 1.1, 1.0, 0.72, 0, { extra: { ...LOWCON, screens: 1, decorative: true } });
prop('console', 'bridge',  3.45, -18.85, 1.1, 1.0, 0.72, 0, { extra: { ...LOWCON, screens: 1, decorative: true } });
prop('holotable','bridge', -3.3, -15.8, 1.3, 1.5, 1.0, 0);
prop('console', 'bridge',  3.65, -15.7, 2.6, 0.7, 1.05, 3, { extra: { screens: 2, station: 'comms' } });
prop('locker', 'bridge', -3.3, -13.7, 0.6, 0.5, 2.0, 2);
prop('locker', 'bridge', -2.65, -13.7, 0.6, 0.5, 2.0, 2);
prop('locker', 'bridge',  2.65, -13.7, 0.6, 0.5, 2.0, 2);
prop('locker', 'bridge',  3.3, -13.7, 0.6, 0.5, 2.0, 2);

// dorsal turret nest
prop('console', 'nest', -0.9, 3.6, 0.8, 0.5, 1.0, 2, { extra: { decorative: true } });

// Real windows in the outer walls. The interior wall simply has a hole; because nothing is drawn
// between it and the world (the hull is invisible from inside), you look straight out at Mars.
// wall: 'x0' (port) or 'x1' (starboard); c is the centre along the wall.
export const WINDOWS = [
  { room: 'crew_a', wall: 'x0', c: -1.0, w: 1.8, y0: 4.95, y1: 5.45 },
  { room: 'crew_b', wall: 'x1', c: 0.1, w: 4.4, y0: 3.5, y1: 5.45 },     // the observation lounge: a panoramic window, sill 0.5 m off the deck
  { room: 'medbay', wall: 'x0', c: -6.3, w: 1.4, y0: 4.6, y1: 5.3 },
  { room: 'galley', wall: 'x1', c: -7.3, w: 1.3, y0: 4.7, y1: 5.35 },
  { room: 'cabin', wall: 'x1', c: 4.95, w: 1.2, y0: 4.35, y1: 5.05 },
  { room: 'workshop', wall: 'x0', c: 7.9, w: 1.2, y0: 4.55, y1: 5.3 },
];

/**
 * Places to stand and look out. `scope` is a pair of binoculars on a stand: press the action button there and the view
 * closes to a 3x zoom (and slows your look to match) until you press it again or walk away.
 */
export const OBSERVATION = [
  { id: 'lounge_scope', name: 'Lounge binoculars', room: 'crew_b', x: 5.7, y: 3, z: 0.1, radius: 1.5, fov: 24 },
];

// Posters and photographs on the walls. wall: which face of the room; u: position along it.
export const POSTERS = [
  { room: 'crew_a', wall: 'z0', u: -3.7, y: 4.8, w: 0.62, h: 0.62, idx: 0 },
  { room: 'crew_a', wall: 'x1', u: 0.7, y: 4.75, w: 0.5, h: 0.5, idx: 1 },
  { room: 'crew_b', wall: 'x0', u: 1.5, y: 4.7, w: 0.5, h: 0.5, idx: 4 },
  { room: 'crew_b', wall: 'z0', u: 3.9, y: 4.8, w: 0.6, h: 0.6, idx: 7 },
  { room: 'medbay', wall: 'z1', u: -3.4, y: 4.7, w: 0.6, h: 0.6, idx: 7 },
  { room: 'galley', wall: 'z1', u: 3.4, y: 4.8, w: 0.7, h: 0.7, idx: 0 },
  { room: 'galley', wall: 'z0', u: 2.6, y: 4.8, w: 0.6, h: 0.6, idx: 3 },
  { room: 'workshop', wall: 'z1', u: -5.3, y: 4.8, w: 0.6, h: 0.6, idx: 5 },
  { room: 'workshop', wall: 'z0', u: -4.4, y: 4.7, w: 0.6, h: 0.6, idx: 2 },
  { room: 'cabin', wall: 'z0', u: 4.1, y: 4.75, w: 0.6, h: 0.6, idx: 1 },
  { room: 'engineering', wall: 'x0', u: 7.6, y: 1.9, w: 0.7, h: 0.7, idx: 2 },
  { room: 'airlock', wall: 'z1', u: -3.5, y: 1.7, w: 0.62, h: 0.62, idx: 6 },
  { room: 'evalocker', wall: 'z1', u: 3.5, y: 1.7, w: 0.62, h: 0.62, idx: 2 },
  { room: 'cargo', wall: 'x1', u: 15.5, y: 2.0, w: 0.8, h: 0.8, idx: 2 },
];

// ---------------------------------------------------------------------------
// Ceiling lights. Real fixtures; the renderer pools a few point lights over
// the nearest ones so a phone is never asked to light the whole ship at once.
// ---------------------------------------------------------------------------
const lights = [];
function lamp(roomId, x, z, o = {}) {
  const r = rooms.find((q) => q.id === roomId);
  lights.push({
    room: roomId, x, y: (r.y + r.h) - 0.08, z,
    color: o.color ?? 0xfff1dc, intensity: o.intensity ?? 7, range: o.range ?? 10,
    len: o.len ?? 1.4, w: o.w ?? 0.28, axis: o.axis || 'z',
  });
}
lamp('corridor_main', 0, -6.0, { len: 1.6, intensity: 4, range: 7 });
lamp('corridor_main', 0, -1.5, { len: 1.6, intensity: 4, range: 7 });
lamp('corridor_main', 0,  3.0, { len: 1.6, intensity: 4, range: 7 });
lamp('corridor_main', 0,  7.4, { len: 1.6, intensity: 4, range: 7 });
lamp('medbay', -3.5, -6.1, { color: 0xe8f6ff, intensity: 9, len: 2.6, axis: 'z' });
lamp('crew_a', -3.6, -1.0, { color: 0xffe9c8, intensity: 6, len: 2.2 });
lamp('workshop', -3.7, 6.4, { color: 0xf6f2e8, intensity: 8, len: 2.6 });
lamp('galley', 3.7, -5.6, { color: 0xfff0d6, intensity: 8, len: 2.6 });
lamp('crew_b', 3.7, 0.1, { color: 0xffe9c8, intensity: 6, len: 2.2 });
lamp('cabin', 3.7, 4.3, { color: 0xffdfb4, intensity: 6, len: 1.8 });
lamp('head', 3.7, 7.5, { color: 0xf2f6ff, intensity: 5, len: 1.4 });
lamp('engineering', -3.0, -2.0, { color: 0xffe6c0, intensity: 9, range: 12, len: 3.0 });
lamp('engineering',  3.0, -2.0, { color: 0xffe6c0, intensity: 9, range: 12, len: 3.0 });
lamp('engineering', -3.0,  5.0, { color: 0xffe6c0, intensity: 9, range: 12, len: 3.0 });
lamp('engineering',  3.0,  5.0, { color: 0xffe6c0, intensity: 9, range: 12, len: 3.0 });
lamp('corridor_low', 0, -10.5, { len: 1.6, intensity: 4, range: 7 });
lamp('airlock', -3.7, -10.8, { color: 0xffb27a, intensity: 6, len: 2.0 });
lamp('evalocker', 3.7, -10.8, { color: 0xf2f6ff, intensity: 6, len: 2.0 });
lamp('ventral', 0, -15.3, { color: 0xffb27a, intensity: 4, range: 5, len: 1.0 });
lamp('cargo', -2.6, 12.5, { color: 0xf4f6ff, intensity: 22, range: 15, len: 3.0 });
lamp('cargo',  2.6, 12.5, { color: 0xf4f6ff, intensity: 22, range: 15, len: 3.0 });
lamp('cargo', -2.6, 17.5, { color: 0xf4f6ff, intensity: 22, range: 15, len: 3.0 });
lamp('cargo',  2.6, 17.5, { color: 0xf4f6ff, intensity: 22, range: 15, len: 3.0 });
lamp('bridge', -2.0, -15.4, { color: 0xdfeaff, intensity: 7, len: 2.0 });
lamp('bridge',  2.0, -15.4, { color: 0xdfeaff, intensity: 7, len: 2.0 });
lamp('bridge',  0.0, -17.6, { color: 0xdfeaff, intensity: 6, len: 2.0, axis: 'x' });
lamp('nest', -0.4, 2.8, { color: 0xffd7a8, intensity: 5, range: 5, len: 1.4 });

// ---------------------------------------------------------------------------
// Landing gear. Extension is telescopic: nominal 2.4 m, stroke 0.8 either way.
// ---------------------------------------------------------------------------
export const GEAR = {
  soleOffset: 0.25, // rubber foot geometry extends 25 cm below its attachment
  nominal: 2.4, min: 1.4, max: 3.6, stroke: 0.8,
  legs: [
    { id: 'fl', x: -5.6, z: -14.6 }, { id: 'fr', x: 5.6, z: -14.6 },
    { id: 'al', x: -6.6, z: 13.5 },  { id: 'ar', x: 6.6, z: 13.5 },
  ],
  padRadius: 0.95,
  // hull points that must never go below the ground
  keel: [{ x: 0, z: -13 }, { x: 0, z: -4 }, { x: 0, z: 6 }, { x: -3, z: 12 }, { x: 3, z: 12 }, { x: 0, z: 19 }],
  keelY: -1.1,
};

// ---------------------------------------------------------------------------
// Weapons. Muzzles are ship-local.
// ---------------------------------------------------------------------------
export const GUNS = {
  main: {
    id: 'main', name: 'Main guns', seat: 'captain',
    muzzles: [{ x: -1.55, y: 1.0, z: -23.3 }, { x: 1.55, y: 1.0, z: -23.3 }],
    pivot: { x: 0, y: 1.0, z: -19.5 },
    arcYawDeg: 28, arcPitchUpDeg: 22, arcPitchDownDeg: 24,
    rate: 5.0, speed: 260, damage: 40, range: 1800,
  },
  dorsal: {
    id: 'dorsal', name: 'Dorsal turret', seat: 'gun_dorsal',
    pivot: { x: 0.2, y: 9.9, z: 2.8 },
    muzzles: [{ x: -1.45, y: 0, z: -2.95 }, { x: 1.45, y: 0, z: -2.95 }],  // turret-local; z is how far out the barrel ends
    rate: 7.0, speed: 300, damage: 25, range: 1800,
  },
  ventral: {
    id: 'ventral', name: 'Ventral turret', seat: 'gun_ventral',
    pivot: { x: 0.0, y: -1.75, z: -15.3 },
    muzzles: [{ x: -1.45, y: 0, z: -2.95 }, { x: 1.45, y: 0, z: -2.95 }],
    rate: 6.0, speed: 300, damage: 30, range: 1800,
  },
};

// ---------------------------------------------------------------------------
// Ship physical numbers
// ---------------------------------------------------------------------------
export const SHIP_PHYS = {
  massKg: 46000,                 // dry ship and crew stores
  liftThrustN: 300000,           // total vertical thrusters at 100% engine share
  driveThrustN: 260000,          // main engines
  reactorUnits: 100,             // power to share out
  defaultPower: { engines: 40, guns: 30, shields: 30 },
  cruiseSpeed: 40,               // m/s at the default engine share
  climbSpeed: 12,
  turnRate: 0.75,                // rad/s
};

// ---------------------------------------------------------------------------
// Derived layout, built once
// ---------------------------------------------------------------------------
export function buildLayout() {
  const roomById = new Map(rooms.map((r) => [r.id, r]));
  assignDoorLabels(doors,roomById,Object.values(STAIRS));
  return { rooms, roomById, doors, props, lights, posters: POSTERS, windows: WINDOWS, stairs: STAIRS, ramps: RAMPS, ladders: LADDERS,
           seats: SEATS, panels: PANELS, extraZones: EXTRA_ZONES, gear: GEAR, guns: GUNS };
}

/** Height of the stair floor at z. */
export function stairFloor(st, z) {
  const t = (z - st.zLow) / (st.zHigh - st.zLow);
  return st.yLow + (st.yHigh - st.yLow) * Math.max(0, Math.min(1, t));
}

/** Which deck a point on the ship is on, for the HUD. */
export function deckName(y) {
  if (y < -0.5) return 'Ventral pit';
  if (y < 2.5) return 'Lower deck';
  if (y < 5.3) return 'Main deck';
  return 'Upper deck';
}

/** Rotate a prop's plan box into ship axes. rot is in 90-degree steps. */
export function propBox(p) {
  const swap = (p.rot % 2) !== 0;
  const w = swap ? p.d : p.w, d = swap ? p.w : p.d;
  return { x0: p.x - w / 2, x1: p.x + w / 2, z0: p.z - d / 2, z1: p.z + d / 2, y0: p.y, y1: p.y + p.h };
}
