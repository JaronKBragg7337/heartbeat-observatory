// ============================================================================
// ships/hauler/spec.js - the Drayman-class hauler, as data. One source of truth, like src/ships/raider/spec.js.
//
// THE CLASS: a 52 m freight and vehicle carrier. The Meridian is 49 m and the Shrike 36 m; the Drayman is built around a hold. Eleven metres wide,
// twenty long, 4.6 m under the gantry rails, with a stern ramp as wide as its two berth columns. Six rover berths stand in the hold (two
// columns, three rows) with a clear aisle down the middle. It is unarmed beyond a chin gun and slow (cruise 31 m/s): you buy it for what it carries.
//
// ROOMS, fore to aft:
//     cockpit       pilot and captain in front, navigator and comms behind, under a canopy
//     corridor      one passage down the middle
//       crew berth (port, four bunks) / mess (starboard)
//       airlock (port) / cargo control (starboard: the load plan, the berth board)
//       supplies (port) / (nothing, the hull is thick here)
//     engine room   reactor, tanks, the engineer's station
//     cargo hold    six rover berths, tie-down rails, a gantry, the stern ramp
//
// SHIP-LOCAL FRAME (metres): +X starboard, +Y up, -Z forward (the bow is at -Z). Origin: the centreline at the main-deck floor.
// REAL HUMAN SCALE: avatar 1.78 m, doors 1.0 by 2.1 m, corridor 1.6 m.
// ============================================================================

import { layoutKit } from '../layoutKit.js';
import { makeHull } from '../hullLoft.js';
import { AVATAR } from '../../ship/shipSpec.js';

export const HAULER_TYPE = 'hauler';
export const HAULER_CLASS = 'Drayman-class hauler';
export { AVATAR };

export const DECK = { main: 0.0, upper: 3.35, pitch: 3.0, clear: 2.7, slab: 0.3 };
const K = layoutKit(DECK);
const { room, door, prop, lamp } = K;

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------
room('cockpit', 'Flight deck', 'bridge', 'main', -3.4, 3.4, -15.2, -10.6, { canopy: true });
room('corridor_main', 'Main corridor', 'corridor', 'main', -0.8, 0.8, -10.4, 7.0);
room('crew_a', 'Crew berth', 'crew', 'main', -5.5, -1.0, -10.0, -3.6);
room('galley', 'Mess', 'galley', 'main', 1.0, 5.5, -10.0, -3.6);
room('airlock', 'Airlock', 'airlock', 'main', -5.5, -1.0, -3.2, 0.8);
room('control', 'Cargo control', 'evalocker', 'main', 1.0, 5.5, -3.2, 2.6, { style: 'engineering' });
room('stores', 'Supplies', 'evalocker', 'main', -5.5, -1.0, 1.2, 6.0, { style: 'engineering' });
room('engine', 'Engine room', 'engineering', 'main', -5.5, 5.5, 7.2, 12.6);
room('hold', 'Cargo hold', 'cargo', 'main', -5.5, 5.5, 12.8, 32.8, { h: 4.6 });

// ---------------------------------------------------------------------------
// Doors. axis 'x': the wall is the plane x = at, you pass along X.  axis 'z': the wall is z = at, you pass along Z.
// ---------------------------------------------------------------------------
door('d_cockpit', 'corridor_main', 'cockpit', 'z', -10.5, 0, { w: 1.2, h: 2.2, sign: 'FLIGHT' });
door('d_crew_a', 'corridor_main', 'crew_a', 'x', -0.9, -6.8, { sign: 'BERTH' });
door('d_galley', 'corridor_main', 'galley', 'x', 0.9, -6.8, { sign: 'MESS' });
door('d_airlock_in', 'corridor_main', 'airlock', 'x', -0.9, -1.2, { sign: 'AIRLOCK' });
door('d_control', 'corridor_main', 'control', 'x', 0.9, -0.2, { sign: 'CARGO CTRL', w: 1.0 });
door('d_stores', 'corridor_main', 'stores', 'x', -0.9, 3.4, { sign: 'SUPPLIES' });
door('d_engine', 'corridor_main', 'engine', 'z', 7.1, 0, { sign: 'ENGINE', w: 1.0 });
door('d_hold', 'engine', 'hold', 'z', 12.7, 0, { w: 2.6, h: 2.6, sign: 'HOLD' });
door('d_ramp', 'hold', 'outside', 'z', 32.8, 0, { kind: 'portal', w: 6.8, h: 4.4, noZone: true });
door('d_airlock_out', 'airlock', 'outside', 'x', -5.6, -1.2, { kind: 'outer', w: 1.3, h: 2.2 });

// ---------------------------------------------------------------------------
// Ramps (the angle is solved at landing time so the tip touches the ground). The cargo ramp is 6.8 m wide: as wide as the two berth columns, so a rover drives straight out aft from either side.
// ---------------------------------------------------------------------------
export const RAMPS = {
  cargo: {
    id: 'ramp_cargo', name: 'Vehicle ramp',
    hinge: { x: 0, y: 0, z: 32.8 }, dir: { x: 0, z: 1 },
    length: 5.6, width: 6.8, raisedHeight: 4.4,
    panel: { thickness: 0.2 },
  },
  airlock: {
    id: 'ramp_airlock', name: 'Airlock gangway',
    hinge: { x: -5.65, y: 0, z: -1.2 }, dir: { x: -1, z: 0 },
    length: 5.0, width: 1.3, raisedHeight: 2.2,
    panel: { thickness: 0.1 },
  },
};

// ---------------------------------------------------------------------------
// The cargo deck the rovers drive on, and the berths that lock them down. A berth is where a rover's centre rests, yaw pi (the nose
// toward the stern, ready to drive out). 2.3 m wide rovers on 6.6 m centres leave a 4.3 m aisle and a 0.95 m lane at each wall.
// ---------------------------------------------------------------------------
export const CARGO_DECK = { x0: -5.5, x1: 5.5, z0: 12.8, z1: RAMPS.cargo.hinge.z, y: 0 };
export const BERTHS = [
  { id: 'b1', x: -3.3, z: 16.8 }, { id: 'b2', x: 3.3, z: 16.8 },
  { id: 'b3', x: -3.3, z: 22.3 }, { id: 'b4', x: 3.3, z: 22.3 },
  { id: 'b5', x: -3.3, z: 27.8 }, { id: 'b6', x: 3.3, z: 27.8 },
].map((b) => ({ ...b, yaw: Math.PI }));

// ---------------------------------------------------------------------------
// Seats. pos is the seat pan on the floor under it; yaw 0 faces the bow.
// ---------------------------------------------------------------------------
export const SEATS = [
  { id: 'captain', stationId: 'COS-MARS-STR-0071', name: "Captain's seat", room: 'cockpit', variant: 'captain',
    x: 1.3, y: 0.0, z: -12.9, yaw: 0, lookYaw: 115, lookPitchUp: 55, lookPitchDown: 35,
    role: 'flight+guns', hint: 'Fly the hauler and work the chin gun' },
  { id: 'pilot', stationId: 'COS-MARS-STR-0072', name: 'Pilot seat', room: 'cockpit', variant: 'pilot',
    x: -1.3, y: 0.0, z: -12.9, yaw: 0, lookYaw: 90, lookPitchUp: 50, lookPitchDown: 35,
    role: 'flight', hint: 'Fly it: lift, thrust, turn, land' },
  { id: 'nav', stationId: 'COS-MARS-STR-0073', name: 'Navigator', room: 'cockpit', variant: 'swivel',
    x: -2.3, y: 0.0, z: -11.5, yaw: 0, lookYaw: 100, lookPitchUp: 50, lookPitchDown: 35,
    role: 'navigation', hint: 'Plot a course to Mars orbit, Phobos or Deimos' },
  { id: 'comms', stationId: 'COS-MARS-STR-0074', name: 'Comms', room: 'cockpit', variant: 'swivel',
    x: 2.3, y: 0.0, z: -11.5, yaw: 0, lookYaw: 100, lookPitchUp: 50, lookPitchDown: 35,
    role: 'comms', hint: 'The port channel, the ship log, the crew account' },
  { id: 'engineer', stationId: 'COS-MARS-STR-0075', name: 'Engineering', room: 'engine', variant: 'swivel',
    x: 3.2, y: 0.0, z: 9.9, yaw: 90, lookYaw: 90, lookPitchUp: 50, lookPitchDown: 35,
    role: 'power', hint: 'Route reactor power between engines, guns and shields' },
];

export const PANELS = [
  { id: 'panel_ramp', name: 'Vehicle ramp', x: -4.6, y: 0, z: 31.4, radius: 2.2, action: 'ramp_cargo' },
  { id: 'panel_air', name: 'Airlock', x: -3.0, y: 0, z: -1.9, radius: 1.6, action: 'airlock' },
];

export const WALL_SCREENS = [
  { id: 'scr_berths', room: 'hold', kind: 'manifest', x: -5.37, y: 1.9, z: 14.2, w: 1.3, h: 0.8, facing: 'x+' },
  { id: 'scr_hold_b', room: 'hold', kind: 'manifest', x: 5.37, y: 1.9, z: 14.2, w: 1.3, h: 0.8, facing: 'x-' },
  { id: 'scr_crew_1', room: 'crew_a', kind: 'vitals', x: -5.37, y: 1.6, z: -5.2, w: 0.5, h: 0.32, facing: 'x+' },
  { id: 'scr_galley', room: 'galley', kind: 'menu', x: 5.37, y: 1.9, z: -8.0, w: 0.9, h: 0.55, facing: 'x-' },
  { id: 'scr_eng_wall', room: 'engine', kind: 'reactorwall', x: 2.2, y: 2.0, z: 7.33, w: 1.6, h: 0.75, facing: 'z+' },
];

// ---------------------------------------------------------------------------
// Furniture. kind, room, centre on the floor, plan size, rotation in 90-degree steps. Collision is the plan box.
// ---------------------------------------------------------------------------
const LOWCON = { screens: 3, lift: 0.2, fh: 0.36, sh: 0.32 };
// flight deck: low dashboards in front of pilot and captain; navigation and comms work side consoles
prop('console', 'cockpit', -1.45, -14.75, 2.4, 0.9, 0.72, 0, { extra: { ...LOWCON, station: 'pilot' } });
prop('console', 'cockpit', 1.45, -14.75, 2.4, 0.9, 0.72, 0, { extra: { ...LOWCON, station: 'captain' } });
prop('console', 'cockpit', -3.1, -11.6, 1.6, 0.5, 1.0, 1, { extra: { screens: 2, station: 'nav' } });
prop('console', 'cockpit', 3.1, -11.6, 1.6, 0.5, 1.0, 3, { extra: { screens: 2, station: 'comms' } });
prop('locker', 'cockpit', -3.1, -13.6, 0.6, 0.5, 2.0, 1);
prop('locker', 'cockpit', 3.1, -13.6, 0.6, 0.5, 2.0, 3);
prop('extinguisher', 'cockpit', -3.3, -10.9, 0.16, 0.16, 0.5, 1, { blocks: false, y: 1.2 });

// crew berth: four bunks (two double bunks) on the port wall, lockers and a table
prop('bunk', 'crew_a', -5.0, -8.8, 0.95, 2.1, 1.9, 0);
prop('bunk', 'crew_a', -5.0, -6.4, 0.95, 2.1, 1.9, 0);
prop('bunk', 'crew_a', -2.4, -9.0, 0.95, 2.1, 1.9, 0);
prop('locker', 'crew_a', -4.7, -4.0, 0.6, 0.55, 2.0, 2);
prop('locker', 'crew_a', -4.05, -4.0, 0.6, 0.55, 2.0, 2);
prop('locker', 'crew_a', -3.4, -4.0, 0.6, 0.55, 2.0, 2);
prop('table', 'crew_a', -2.3, -5.4, 0.9, 0.9, 0.75, 0);
prop('rug', 'crew_a', -3.0, -7.4, 2.4, 1.6, 0.02, 0, { blocks: false });

// mess: a galley run along the starboard wall, a long table with benches, a fridge
prop('counter', 'galley', 5.15, -8.4, 2.6, 0.6, 0.95, 3, { style: 'galley' });
prop('fridge', 'galley', 5.1, -6.4, 0.7, 0.7, 1.9, 3);
prop('counter', 'galley', 5.15, -4.8, 1.8, 0.6, 0.95, 3, { style: 'galley' });
prop('table', 'galley', 3.2, -7.0, 0.9, 2.8, 0.76, 0, { style: 'mess' });
prop('bench', 'galley', 2.4, -7.0, 0.36, 2.7, 0.46, 0);
prop('bench', 'galley', 4.0, -7.0, 0.36, 2.7, 0.46, 0);
prop('locker', 'galley', 1.5, -4.0, 0.6, 0.55, 2.0, 2);
prop('locker', 'galley', 2.15, -4.0, 0.6, 0.55, 2.0, 2);

// airlock
prop('console', 'airlock', -3.2, -2.9, 1.0, 0.5, 1.1, 0, { extra: { screens: 1, decorative: true, station: 'airlock' } });
prop('suitrack', 'airlock', -5.2, -2.5, 0.8, 0.6, 2.0, 1);
prop('suitrack', 'airlock', -5.2, 0.4, 0.8, 0.6, 2.0, 1);

// cargo control: the load plan table, a chart console and a rack of tie-down gear
prop('table', 'control', 3.3, -0.2, 1.6, 1.0, 0.9, 0, { style: 'mess' });
prop('console', 'control', 5.1, -0.2, 2.4, 0.5, 1.15, 3, { extra: { screens: 2, decorative: true, station: 'loadmaster' } });
prop('rack', 'control', 3.0, 2.2, 1.4, 0.5, 2.1, 2);
prop('locker', 'control', 1.5, -2.8, 0.6, 0.5, 2.0, 0);
prop('locker', 'control', 2.2, -2.8, 0.6, 0.5, 2.0, 0);

// supplies: suits, spares, a first-aid wall
prop('suitrack', 'stores', -5.1, 2.2, 0.8, 0.6, 2.0, 1);
prop('suitrack', 'stores', -5.1, 5.0, 0.8, 0.6, 2.0, 1);
prop('rack', 'stores', -2.8, 5.6, 1.6, 0.5, 2.2, 2);
prop('crate', 'stores', -2.2, 2.0, 0.9, 0.9, 0.9, 0);
prop('locker', 'stores', -1.5, 5.0, 0.6, 0.5, 2.0, 3);

// engine room
prop('minireactor', 'engine', -2.8, 9.9, 2.4, 2.4, 2.4, 0, { extra: { radius: 0.95 } });
prop('console', 'engine', 5.15, 9.9, 2.4, 0.6, 1.15, 3, { extra: { screens: 2, station: 'engineer' } });
prop('tank', 'engine', -4.6, 8.1, 1.4, 1.4, 2.4, 0);
prop('tank', 'engine', -4.6, 11.7, 1.4, 1.4, 2.4, 0);
prop('pump', 'engine', 4.9, 8.0, 0.9, 0.8, 1.2, 0);
prop('rack', 'engine', 4.95, 11.9, 1.4, 0.6, 2.3, 1);
prop('extinguisher', 'engine', -5.4, 10.0, 0.16, 0.16, 0.5, 1, { blocks: false, y: 1.2 });

// cargo hold: two stacks of freight by the front wall, a drum row, the ramp console. The six berths and the aisle stay clear.
prop('crate', 'hold', -4.7, 13.8, 1.4, 1.4, 1.4, 0);
prop('crate', 'hold', -4.7, 13.8, 1.4, 1.4, 1.2, 0, { y: 1.4 });
prop('crate', 'hold', 4.7, 13.8, 1.4, 1.4, 1.4, 0);
prop('crate', 'hold', 4.7, 13.8, 1.2, 1.2, 1.0, 0, { y: 1.4 });
prop('drum', 'hold', -5.0, 20.0, 0.7, 0.7, 1.0, 0, { blocks: false });
prop('console', 'hold', -5.15, 31.3, 1.0, 0.5, 1.1, 1, { extra: { screens: 1, decorative: true, station: 'ramp' } });
prop('console', 'hold', 5.15, 31.3, 1.0, 0.5, 1.1, 3, { extra: { screens: 1, decorative: true, station: 'ramp' } });
prop('extinguisher', 'hold', -5.4, 19.5, 0.16, 0.16, 0.5, 1, { blocks: false, y: 1.2 });
prop('extinguisher', 'hold', 5.4, 25.0, 0.16, 0.16, 0.5, 3, { blocks: false, y: 1.2 });
prop('extinguisher', 'corridor_main', -0.72, -6.0, 0.16, 0.16, 0.5, 1, { blocks: false, y: 1.3 });
prop('firstaid', 'corridor_main', 0.74, -3.2, 0.3, 0.12, 0.3, 3, { blocks: false, y: 1.4 });

// ---------------------------------------------------------------------------
// Windows (the outer wall only). y is main-deck-relative + 3.0, the same convention as the Meridian's spec.
// ---------------------------------------------------------------------------
export const WINDOWS = [
  { room: 'crew_a', wall: 'x0', c: -7.5, w: 1.6, y0: 3.0 + 1.0, y1: 3.0 + 1.8 },
  { room: 'galley', wall: 'x1', c: -7.0, w: 1.6, y0: 3.0 + 1.0, y1: 3.0 + 1.8 },
  { room: 'control', wall: 'x1', c: 0.0, w: 1.2, y0: 3.0 + 1.0, y1: 3.0 + 1.7 },
];

export const OBSERVATION = [];

export const POSTERS = [
  { room: 'crew_a', wall: 'z0', u: -3.4, y: 1.8, w: 0.62, h: 0.62, idx: 3 },
  { room: 'galley', wall: 'z0', u: 3.4, y: 1.8, w: 0.6, h: 0.6, idx: 1 },
  { room: 'cockpit', wall: 'z1', u: -1.9, y: 1.9, w: 0.5, h: 0.5, idx: 4 },
  { room: 'control', wall: 'z1', u: 3.0, y: 1.9, w: 0.7, h: 0.7, idx: 2 },
];

// ---------------------------------------------------------------------------
// Ceiling lights
// ---------------------------------------------------------------------------
lamp('cockpit', -1.4, -12.7, { color: 0xdfeaff, intensity: 6, len: 1.8 });
lamp('cockpit', 1.4, -12.7, { color: 0xdfeaff, intensity: 6, len: 1.8 });
lamp('corridor_main', 0, -7.5, { len: 1.6, intensity: 4, range: 7 });
lamp('corridor_main', 0, -2.0, { len: 1.6, intensity: 4, range: 7 });
lamp('corridor_main', 0, 3.4, { len: 1.6, intensity: 4, range: 7 });
lamp('crew_a', -3.2, -6.8, { color: 0xffe9c8, intensity: 6, len: 2.2 });
lamp('galley', 3.2, -6.8, { color: 0xfff0d6, intensity: 8, len: 2.4 });
lamp('airlock', -3.2, -1.2, { color: 0xffb27a, intensity: 6, len: 1.6 });
lamp('control', 3.2, -0.3, { color: 0xffe6c0, intensity: 7, len: 2.2 });
lamp('stores', -3.2, 3.6, { color: 0xffe6c0, intensity: 6, len: 1.8 });
lamp('engine', -2.0, 9.9, { color: 0xffe6c0, intensity: 9, range: 12, len: 2.8 });
lamp('engine', 2.6, 9.9, { color: 0xffe6c0, intensity: 9, range: 12, len: 2.8 });
for (const z of [16.8, 22.3, 27.8]) for (const x of [-3.3, 3.3]) lamp('hold', x, z, { color: 0xf4f6ff, intensity: 24, range: 12, len: 3.0 });
lamp('hold', 0, 19.5, { color: 0xf4f6ff, intensity: 20, range: 14, len: 4.0 });
lamp('hold', 0, 26.0, { color: 0xf4f6ff, intensity: 20, range: 14, len: 4.0 });

// ---------------------------------------------------------------------------
// Landing gear. Telescopic: nominal 2.0 m so the 5.6 m stern ramp reaches the ground at about 24 degrees.
// ---------------------------------------------------------------------------
export const GEAR = {
  soleOffset: 0.25,
  nominal: 2.0, min: 1.2, max: 3.0, stroke: 0.7,
  legs: [
    { id: 'fl', x: -5.4, z: -8.0 }, { id: 'fr', x: 5.4, z: -8.0 },
    { id: 'al', x: -6.0, z: 25.0 }, { id: 'ar', x: 6.0, z: 25.0 },
  ],
  padRadius: 0.85,
  keel: [{ x: 0, z: -15 }, { x: 0, z: -4 }, { x: 0, z: 9 }, { x: 0, z: 20 }, { x: 0, z: 30 }],
  keelY: -0.8,
};

// ---------------------------------------------------------------------------
// Weapons: one light chin gun, worked from the captain's seat. A hauler is not a warship.
// ---------------------------------------------------------------------------
export const GUNS = {
  main: {
    id: 'main', name: 'Chin gun', seat: 'captain',
    muzzles: [{ x: -0.6, y: 0.3, z: -19.0 }, { x: 0.6, y: 0.3, z: -19.0 }],
    pivot: { x: 0, y: 0.3, z: -16.5 },
    arcYawDeg: 20, arcPitchUpDeg: 18, arcPitchDownDeg: 20,
    rate: 2.2, speed: 260, damage: 6, range: 1400,
  },
};

// ---------------------------------------------------------------------------
// Flight numbers. Heavy and slow: it lifts a full hold, it does not dance.
// ---------------------------------------------------------------------------
export const PHYS = {
  massKg: 62000,
  liftThrustN: 400000,
  driveThrustN: 300000,
  reactorUnits: 100,
  defaultPower: { engines: 50, guns: 15, shields: 35 },
  cruiseSpeed: 31,
  climbSpeed: 9,
  turnRate: 0.5,
  shieldBase: 260,
  hullFactor: 0.24,
};

// ---------------------------------------------------------------------------
// The hull: stations are [z, half-width, keel y, deck y, top chamfer, bottom chamfer]. The deck drops to the canopy sill (1.1 m) over the
// flight deck and nose; the hull rises over the hold.
// ---------------------------------------------------------------------------
export const HULL_STATIONS = [
  [-19.6, 0.55, 0.0, 0.8, 0.25, 0.25],
  [-17.6, 2.2, -0.3, 1.1, 0.4, 0.4],
  [-14.6, 4.3, -0.6, 1.15, 0.45, 0.5],
  [-11.1, 5.85, -0.7, 1.15, 0.5, 0.55],
  [-10.5, 6.0, -0.7, 3.45, 0.6, 0.6],
  [6.0, 6.0, -0.7, 3.45, 0.6, 0.6],
  [8.2, 6.2, -0.75, 5.65, 0.7, 0.65],       // the hold is 4.6 m under the rails: the hull rises over it
  [32.0, 6.2, -0.75, 5.65, 0.7, 0.65],
  [32.95, 6.15, -0.75, 5.6, 0.65, 0.6],     // the aft plate stands 15 cm beyond the hold's stern wall (z 32.8)
];
export const HULL = makeHull(HULL_STATIONS);
export const CANOPY_ROOMS = ['cockpit'];

/** What the landing constraint reads: the hull's underside, and the engine nacelles and the like. */
export const HULL_FLIGHT = {
  z0: HULL.z0, z1: HULL.z1, underside: HULL.underside,
  extraPoints: [...[-1, 1].flatMap((s) => [16, 24, 31].map((z) => ({ x: s * 7.9, y: 0.4, z })))],
  combat: { centre: { x: 0, y: 1.8, z: 6 }, radius: 17 },
  push: {
    topY: 8.5, zNose: -19.8, zTail: 33.1,
    hwAt: (z) => (z < HULL.z0 || z > HULL.z1 ? 0 : HULL.halfWidth(z)),
    rampGap: { z: 31.3, hw: 3.7 }, hatch: { x: -5.7, z: -1.2, r: 1.0 },
  },
};

// ---------------------------------------------------------------------------
// Derived layout, built once. The hold dresses itself (src/ships/hauler/interior.js): the layout carries its own `custom`.
// ---------------------------------------------------------------------------
export const LAYOUT = K.finish({
  posters: POSTERS, windows: WINDOWS, stairs: {}, ramps: RAMPS, ladders: [], seats: SEATS, panels: PANELS,
  extraZones: [], gear: GEAR, guns: GUNS, wallScreens: WALL_SCREENS, observation: OBSERVATION, portals: [],
});

export function deckName() { return 'Main deck'; }
