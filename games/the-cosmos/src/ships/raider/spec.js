// ============================================================================
// ships/raider/spec.js - the first raider class, as data. One source of truth, like src/ship/shipSpec.js is for the Meridian.
//
// OWNS: every measurement of the raider: rooms, doors, ladder, seats, furniture, lights, landing gear, guns, ramps, its
//       flight numbers and its hull table. Geometry, collision, the validator and the server all read this file.
// DOES NOT OWN: how it looks (exterior.js), who flies it (crew.js, brain.js), or what it is worth (stats.js).
//
// THE CLASS: a "Shrike", 36 m long and 18 m across the wings (the Meridian is 49 by 25). A fast, hard-hitting boat for a crew of four who
// would rather take a freighter than outrun the port's patrols. The rooms, fore to aft:
//
//     cockpit        pilot and captain seats under the canopy
//     corridor       one straight passage down the middle
//       crew quarters (port) / mess (starboard)  off the corridor, fore
//       airlock (port) / armoury (starboard)     off the corridor, amidships; the ladder to the dorsal turret is behind the armoury
//     engine room    the reactor and the engineer's station
//     cargo hold     the loot, and the stern boarding ramp
//
// SHIP-LOCAL FRAME (metres), the same as the Meridian: +X starboard, +Y up, -Z forward (the bow is at -Z). Origin: the
// centreline at the main-deck floor. Everything is on one deck except the dorsal turret, which is up a ladder.
// REAL HUMAN SCALE: avatar 1.78 m, doors 1.0 m by 2.1 m, corridor 1.6 m. (src/ship/shipSpec.js AVATAR.)
// ============================================================================

import { layoutKit } from '../layoutKit.js';
import { makeHull } from '../hullLoft.js';
import { AVATAR } from '../../ship/shipSpec.js';

export const RAIDER_TYPE = 'raider';
export const RAIDER_CLASS = 'Shrike-class raider';

export const DECK = { main: 0.0, upper: 3.35, pitch: 3.0, clear: 2.7, slab: 0.3 };
export { AVATAR };

const K = layoutKit(DECK);
const { room, door, prop, lamp } = K;

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------
room('cockpit', 'Cockpit', 'bridge', 'main', -2.8, 2.8, -12.8, -8.6, { canopy: true });
room('corridor_main', 'Main corridor', 'corridor', 'main', -0.8, 0.8, -8.4, 4.4);
room('crew_a', 'Crew quarters', 'crew', 'main', -4.6, -1.0, -7.8, -1.6);
room('galley', 'Mess', 'galley', 'main', 1.0, 4.6, -7.8, -1.6);
room('airlock', 'Airlock', 'airlock', 'main', -4.9, -1.0, -1.2, 2.4);
room('armoury', 'Armoury', 'evalocker', 'main', 1.0, 3.4, -1.2, 1.4, { style: 'engineering' });
room('niche', 'Turret ladder', 'niche', 'main', 1.0, 2.4, 1.6, 3.6, {
  ceilHoles: [{ x0: 1.2, x1: 2.4, z0: 2.1, z1: 3.1 }],
});
room('turret', 'Dorsal turret', 'nest', 'upper', -1.6, 2.5, 1.6, 4.0, {
  h: 2.4, shaftFrom: 2.7,
  floorHoles: [{ x0: 1.2, x1: 2.4, z0: 2.1, z1: 3.1 }],
});
room('engine', 'Engine room', 'engineering', 'main', -4.4, 4.4, 4.6, 9.4);
room('hold', 'Cargo hold', 'cargo', 'main', -4.4, 4.4, 9.6, 16.0, { h: 3.4 });

// ---------------------------------------------------------------------------
// Doors. axis 'x': the wall is the plane x = at, you pass along X.  axis 'z': the wall is z = at, you pass along Z.
// ---------------------------------------------------------------------------
door('d_cockpit', 'corridor_main', 'cockpit', 'z', -8.5, 0, { w: 1.2, h: 2.2, sign: 'COCKPIT' });
door('d_crew_a', 'corridor_main', 'crew_a', 'x', -0.9, -4.7, { sign: 'CREW' });
door('d_galley', 'corridor_main', 'galley', 'x', 0.9, -4.7, { sign: 'MESS' });
door('d_airlock_in', 'corridor_main', 'airlock', 'x', -0.9, 0.6, { sign: 'AIRLOCK' });
door('d_armoury', 'corridor_main', 'armoury', 'x', 0.9, 0.1, { sign: 'ARMOURY', w: 0.9 });
door('d_niche', 'corridor_main', 'niche', 'x', 0.9, 2.6, { kind: 'open', w: 1.4, h: 2.4 });
door('d_engine', 'corridor_main', 'engine', 'z', 4.5, 0, { sign: 'ENGINE', w: 1.0 });
door('d_hold', 'engine', 'hold', 'z', 9.5, 0, { w: 2.0, h: 2.4, sign: 'HOLD' });
door('d_ramp', 'hold', 'outside', 'z', 16.0, 0, { kind: 'portal', w: 3.0, h: 3.0, noZone: true });
door('d_airlock_out', 'airlock', 'outside', 'x', -5.0, 0.6, { kind: 'outer', w: 1.3, h: 2.2 });

// ---------------------------------------------------------------------------
// Ramps that go to the ground (the angle is solved at landing time so the end touches the terrain).
// ---------------------------------------------------------------------------
export const RAMPS = {
  cargo: {
    id: 'ramp_cargo', name: 'Boarding ramp',
    hinge: { x: 0, y: 0, z: 16.0 }, dir: { x: 0, z: 1 },
    length: 4.4, width: 3.0, raisedHeight: 3.0,
    panel: { thickness: 0.16 },
  },
  airlock: {
    id: 'ramp_airlock', name: 'Airlock gangway',
    hinge: { x: -5.05, y: 0, z: 0.6 }, dir: { x: -1, z: 0 },
    length: 4.4, width: 1.3, raisedHeight: 2.2,
    panel: { thickness: 0.1 },
  },
};

// Ladder to the dorsal turret (mirror of the Meridian's: rungs on the niche's starboard wall).
export const LADDERS = [
  {
    id: 'ladder_dorsal', name: 'Dorsal turret ladder', rooms: ['niche', 'turret'],
    x: 2.05, z: 2.6, face: { x: 1, z: 0 },
    y0: 0.0, y1: DECK.upper,
    bottom: { x: 1.45, z: 2.6 },
    topExit: { x: 0.8, z: 2.6, y: DECK.upper },
    bottomExit: { x: 1.45, z: 2.6, y: 0.0 },
    topEnter: { x: 0.8, z: 2.6, y: DECK.upper },
  },
];

// ---------------------------------------------------------------------------
// Seats. pos is the seat pan on the floor under it; yaw 0 faces the bow.
// ---------------------------------------------------------------------------
export const SEATS = [
  { id: 'captain', stationId: 'COS-MARS-STR-0021', name: "Captain's seat", room: 'cockpit', variant: 'captain',
    x: 1.3, y: 0.0, z: -10.6, yaw: 0, lookYaw: 115, lookPitchUp: 55, lookPitchDown: 35,
    role: 'flight+guns', hint: 'Fly the boat and fire the nose guns' },
  { id: 'pilot', stationId: 'COS-MARS-STR-0022', name: 'Pilot seat', room: 'cockpit', variant: 'pilot',
    x: -1.3, y: 0.0, z: -10.6, yaw: 0, lookYaw: 90, lookPitchUp: 50, lookPitchDown: 35,
    role: 'flight', hint: 'Fly the boat: lift, thrust, turn, land' },
  { id: 'engineer', stationId: 'COS-MARS-STR-0023', name: 'Engineering', room: 'engine', variant: 'swivel',
    x: 2.65, y: 0.0, z: 6.4, yaw: 90, lookYaw: 90, lookPitchUp: 50, lookPitchDown: 35,
    role: 'power', hint: 'Route reactor power between engines, guns and shields' },
  { id: 'gun_dorsal', stationId: 'COS-MARS-STR-0024', name: 'Dorsal turret', room: 'turret', variant: 'gunner',
    x: -0.2, y: DECK.upper, z: 2.8, yaw: 0, lookYaw: 180, lookPitchUp: 85, lookPitchDown: 8,
    role: 'turret', hint: 'Aim and fire the dorsal turret' },
];

export const PANELS = [
  { id: 'panel_ramp', name: 'Boarding ramp', x: -3.5, y: 0, z: 15.1, radius: 2.0, action: 'ramp_cargo' },
  { id: 'panel_air', name: 'Airlock', x: -3.0, y: 0, z: -0.2, radius: 1.6, action: 'airlock' },
];

export const WALL_SCREENS = [
  { id: 'scr_crew_1', room: 'crew_a', kind: 'vitals', x: -4.57, y: 1.6, z: -2.6, w: 0.5, h: 0.32, facing: 'x+' },
  { id: 'scr_galley', room: 'galley', kind: 'menu', x: 4.57, y: 1.9, z: -4.5, w: 0.9, h: 0.55, facing: 'x-' },
  { id: 'scr_hold', room: 'hold', kind: 'manifest', x: -4.37, y: 1.7, z: 12.8, w: 1.0, h: 0.65, facing: 'x+' },
  { id: 'scr_eng_wall', room: 'engine', kind: 'reactorwall', x: 2.0, y: 2.0, z: 4.63, w: 1.6, h: 0.75, facing: 'z+' },
];

// ---------------------------------------------------------------------------
// Furniture. kind, room, centre on the floor, plan size, rotation in 90-degree steps. Collision is the plan box.
// ---------------------------------------------------------------------------
// cockpit: the flight consoles are LOW (a dashboard, not a wall): their screens end just under the seated eye so the canopy is clear.
const LOWCON = { screens: 3, lift: 0.2, fh: 0.36, sh: 0.32 };
prop('console', 'cockpit', -1.45, -12.25, 2.4, 1.0, 0.72, 0, { extra: { ...LOWCON, station: 'pilot' } });
prop('console', 'cockpit', 1.45, -12.25, 2.4, 1.0, 0.72, 0, { extra: { ...LOWCON, station: 'nav' } });
prop('locker', 'cockpit', -2.45, -9.0, 0.6, 0.5, 2.0, 1);
prop('locker', 'cockpit', 2.45, -9.0, 0.6, 0.5, 2.0, 3);
prop('extinguisher', 'cockpit', -2.74, -10.0, 0.16, 0.16, 0.5, 1, { blocks: false, y: 1.2 });
prop('rug', 'cockpit', 0, -10.5, 2.4, 1.6, 0.02, 0, { blocks: false });

// crew quarters: two double bunks on the port wall, lockers on the back wall, a small table
prop('bunk', 'crew_a', -4.05, -6.75, 0.95, 2.1, 1.9, 0);
prop('bunk', 'crew_a', -4.05, -4.5, 0.95, 2.1, 1.9, 0);
prop('locker', 'crew_a', -3.3, -1.9, 0.6, 0.55, 2.0, 2);
prop('locker', 'crew_a', -2.65, -1.9, 0.6, 0.55, 2.0, 2);
prop('locker', 'crew_a', -2.0, -1.9, 0.6, 0.55, 2.0, 2);
prop('table', 'crew_a', -2.35, -3.0, 0.9, 0.9, 0.75, 0);
prop('rug', 'crew_a', -2.7, -5.4, 2.2, 1.6, 0.02, 0, { blocks: false });

// mess
prop('counter', 'galley', 4.25, -6.5, 2.5, 0.6, 0.95, 3, { style: 'galley' });
prop('fridge', 'galley', 4.25, -4.6, 0.7, 0.7, 1.9, 3);
prop('counter', 'galley', 4.25, -3.0, 2.2, 0.6, 0.95, 3, { style: 'galley' });
prop('table', 'galley', 2.9, -5.0, 0.9, 2.4, 0.76, 0, { style: 'mess' });
prop('bench', 'galley', 2.1, -5.0, 0.36, 2.3, 0.46, 0);
prop('bench', 'galley', 3.7, -5.0, 0.36, 2.3, 0.46, 0);
prop('locker', 'galley', 1.5, -1.9, 0.6, 0.55, 2.0, 2);
prop('locker', 'galley', 2.15, -1.9, 0.6, 0.55, 2.0, 2);

// airlock
prop('console', 'airlock', -3.0, -0.95, 1.0, 0.5, 1.1, 0, { extra: { screens: 1, decorative: true, station: 'airlock' } });
prop('suitrack', 'airlock', -4.55, -0.75, 0.8, 0.6, 2.0, 1);
prop('suitrack', 'airlock', -4.55, 1.95, 0.8, 0.6, 2.0, 1);

// armoury: guns and suits, a bench to check them on
prop('weaponrack', 'armoury', 3.05, -0.2, 1.4, 0.45, 2.0, 3);
prop('weaponrack', 'armoury', 3.05, 0.85, 0.9, 0.45, 2.0, 3);
prop('suitrack', 'armoury', 1.8, 1.1, 0.8, 0.6, 2.0, 2);
prop('suitrack', 'armoury', 2.6, 1.1, 0.8, 0.6, 2.0, 2);

// engine room
prop('minireactor', 'engine', -2.3, 6.6, 2.4, 2.4, 2.4, 0, { extra: { radius: 0.95 } });
prop('console', 'engine', 3.95, 6.4, 2.4, 0.6, 1.15, 3, { extra: { screens: 2, station: 'engineer' } });
prop('rack', 'engine', -4.05, 5.2, 1.4, 0.7, 2.3, 1);
prop('tank', 'engine', -3.4, 8.7, 1.4, 1.4, 2.4, 0);
prop('tank', 'engine', 3.5, 8.7, 1.4, 1.4, 2.4, 0);
prop('pump', 'engine', 3.6, 5.1, 0.9, 0.8, 1.2, 0);
prop('extinguisher', 'engine', 4.34, 9.0, 0.16, 0.16, 0.5, 3, { blocks: false, y: 1.2 });

// cargo hold: what the crew took, stacked along the walls (the middle stays clear: 3 m wide for the ramp)
prop('crate', 'hold', -3.7, 10.8, 1.4, 1.4, 1.4, 0);
prop('crate', 'hold', -3.7, 10.8, 1.4, 1.4, 1.0, 0, { y: 1.4 });
prop('crate', 'hold', -3.7, 12.4, 1.4, 1.4, 1.2, 0);
prop('crate', 'hold', -3.7, 14.0, 1.4, 1.4, 1.4, 0);
prop('loot', 'hold', 3.4, 11.6, 1.8, 1.6, 1.2, 0);
prop('crate', 'hold', 3.7, 13.4, 1.2, 1.2, 1.2, 0);
prop('drum', 'hold', 3.9, 14.5, 0.7, 0.7, 1.0, 0);
prop('drum', 'hold', 3.9, 15.3, 0.7, 0.7, 1.0, 0);
prop('drum', 'hold', 3.1, 14.9, 0.7, 0.7, 1.0, 0);
prop('console', 'hold', -4.0, 15.4, 1.0, 0.5, 1.1, 1, { extra: { screens: 1, decorative: true, station: 'ramp' } });
prop('extinguisher', 'hold', 4.34, 10.2, 0.16, 0.16, 0.5, 3, { blocks: false, y: 1.2 });
prop('extinguisher', 'corridor_main', -0.72, -4.0, 0.16, 0.16, 0.5, 1, { blocks: false, y: 1.3 });
prop('firstaid', 'corridor_main', 0.74, -2.6, 0.3, 0.12, 0.3, 3, { blocks: false, y: 1.4 });

// dorsal turret nest
prop('console', 'turret', -0.9, 3.6, 0.8, 0.5, 1.0, 2, { extra: { decorative: true } });

// ---------------------------------------------------------------------------
// Windows (the outer wall only). y is main-deck-relative + 3.0, the same convention as the Meridian's spec.
// ---------------------------------------------------------------------------
export const WINDOWS = [
  { room: 'crew_a', wall: 'x0', c: -2.4, w: 1.6, y0: 3.0 + 1.0, y1: 3.0 + 1.8 },
  { room: 'galley', wall: 'x1', c: -4.6, w: 1.4, y0: 3.0 + 1.0, y1: 3.0 + 1.8 },
  { room: 'engine', wall: 'x1', c: 8.0, w: 0.9, y0: 3.0 + 1.1, y1: 3.0 + 1.7 },
];

export const OBSERVATION = [];

export const POSTERS = [
  { room: 'crew_a', wall: 'z0', u: -3.4, y: 1.8, w: 0.62, h: 0.62, idx: 3 },
  { room: 'crew_a', wall: 'x1', u: -5.4, y: 1.75, w: 0.5, h: 0.5, idx: 5 },
  { room: 'galley', wall: 'z0', u: 2.6, y: 1.8, w: 0.6, h: 0.6, idx: 1 },
  { room: 'galley', wall: 'x0', u: -3.0, y: 1.7, w: 0.5, h: 0.5, idx: 6 },
  { room: 'cockpit', wall: 'z1', u: -1.9, y: 1.9, w: 0.5, h: 0.5, idx: 4 },
  { room: 'armoury', wall: 'z0', u: 2.2, y: 1.8, w: 0.6, h: 0.6, idx: 2 },
  { room: 'hold', wall: 'x1', u: 13.4, y: 2.0, w: 0.8, h: 0.8, idx: 7 },
];

// ---------------------------------------------------------------------------
// Ceiling lights
// ---------------------------------------------------------------------------
lamp('cockpit', -1.4, -10.6, { color: 0xdfeaff, intensity: 6, len: 1.8 });
lamp('cockpit', 1.4, -10.6, { color: 0xdfeaff, intensity: 6, len: 1.8 });
lamp('corridor_main', 0, -5.6, { len: 1.6, intensity: 4, range: 7 });
lamp('corridor_main', 0, -1.0, { len: 1.6, intensity: 4, range: 7 });
lamp('corridor_main', 0, 2.8, { len: 1.6, intensity: 4, range: 7 });
lamp('crew_a', -2.8, -4.7, { color: 0xffe9c8, intensity: 6, len: 2.2 });
lamp('galley', 2.8, -4.7, { color: 0xfff0d6, intensity: 8, len: 2.4 });
lamp('airlock', -3.0, 0.6, { color: 0xffb27a, intensity: 6, len: 1.6 });
lamp('armoury', 2.2, 0.1, { color: 0xffb27a, intensity: 5, len: 1.4 });
lamp('engine', -2.0, 6.9, { color: 0xffe6c0, intensity: 9, range: 12, len: 2.8 });
lamp('engine', 2.0, 6.9, { color: 0xffe6c0, intensity: 9, range: 12, len: 2.8 });
lamp('hold', -2.0, 12.0, { color: 0xf4f6ff, intensity: 20, range: 14, len: 2.8 });
lamp('hold', 2.0, 12.0, { color: 0xf4f6ff, intensity: 20, range: 14, len: 2.8 });
lamp('hold', 0.0, 14.8, { color: 0xf4f6ff, intensity: 20, range: 14, len: 3.4, axis: 'x' });
lamp('turret', -0.4, 2.8, { color: 0xffd7a8, intensity: 5, range: 5, len: 1.4 });

// ---------------------------------------------------------------------------
// Landing gear. Telescopic: nominal 2.0 m, stroke 0.6 either way.
// ---------------------------------------------------------------------------
export const GEAR = {
  soleOffset: 0.25,
  nominal: 2.0, min: 1.2, max: 3.0, stroke: 0.6,
  legs: [
    { id: 'fl', x: -3.9, z: -8.0 }, { id: 'fr', x: 3.9, z: -8.0 },
    { id: 'al', x: -4.3, z: 12.0 }, { id: 'ar', x: 4.3, z: 12.0 },
  ],
  padRadius: 0.75,
  keel: [{ x: 0, z: -12 }, { x: 0, z: -4 }, { x: 0, z: 5 }, { x: -2.5, z: 10 }, { x: 2.5, z: 10 }, { x: 0, z: 15 }],
  keelY: -0.6,
};

// ---------------------------------------------------------------------------
// Weapons. Muzzles are ship-local. Two nose guns (fixed forward, a narrow arc) and the dorsal turret.
// ---------------------------------------------------------------------------
export const GUNS = {
  main: {
    id: 'main', name: 'Nose guns', seat: 'captain',
    muzzles: [{ x: -0.85, y: 0.6, z: -17.0 }, { x: 0.85, y: 0.6, z: -17.0 }],
    pivot: { x: 0, y: 0.6, z: -14.0 },
    arcYawDeg: 22, arcPitchUpDeg: 20, arcPitchDownDeg: 22,
    rate: 3.2, speed: 280, damage: 14, range: 1800,
  },
  dorsal: {
    id: 'dorsal', name: 'Dorsal turret', seat: 'gun_dorsal',
    pivot: { x: 0.2, y: 6.3, z: 2.8 },
    muzzles: [{ x: -0.95, y: 0, z: -2.1 }, { x: 0.95, y: 0, z: -2.1 }],
    rate: 3.0, speed: 300, damage: 9, range: 1800,
  },
};

// ---------------------------------------------------------------------------
// Flight numbers. Light and strong: it out-climbs and out-turns the Meridian.
// ---------------------------------------------------------------------------
export const PHYS = {
  massKg: 15500,
  liftThrustN: 135000,
  driveThrustN: 110000,
  reactorUnits: 100,
  defaultPower: { engines: 40, guns: 30, shields: 30 },
  cruiseSpeed: 52,
  climbSpeed: 16,
  turnRate: 1.05,
  shieldBase: 240,            // the Meridian's is 200
  hullFactor: 0.22,           // the share of a hit that gets through to the hull once the shield is gone (the Meridian's is 0.25)
};

// ---------------------------------------------------------------------------
// The hull: stations are [z, half-width, keel y, deck y, top chamfer, bottom chamfer]. The deck drops to the canopy sill (1.05 m)
// over the cockpit and nose; that is where the windscreen stands.
// ---------------------------------------------------------------------------
export const HULL_STATIONS = [
  [-17.2, 0.45, 0.05, 0.55, 0.2, 0.2],
  [-15.6, 1.7, -0.2, 0.85, 0.35, 0.35],
  [-13.6, 3.1, -0.5, 1.05, 0.45, 0.5],
  [-9.4, 4.5, -0.55, 1.05, 0.45, 0.55],
  [-8.2, 5.0, -0.55, 3.15, 0.55, 0.55],
  [-2.0, 5.2, -0.55, 3.2, 0.55, 0.55],
  [6.0, 5.2, -0.55, 3.2, 0.55, 0.55],
  [9.0, 5.1, -0.55, 3.8, 0.6, 0.55],         // the hold is taller (3.4 m): the hull rises over it
  [12.0, 5.0, -0.55, 3.8, 0.6, 0.55],
  [16.15, 4.8, -0.5, 3.7, 0.55, 0.5],      // the aft plate stands 15 cm beyond the hold stern wall (z 16.0), or the two share a plane
];
export const HULL = makeHull(HULL_STATIONS);
/** Where the cockpit's canopy stands (the hull does not close over it): the validator exempts these rooms above the sill. */
export const CANOPY_ROOMS = ['cockpit', 'turret'];

/** What the landing constraint reads: the hull's underside and the wing tips and the like. */
export const HULL_FLIGHT = {
  z0: HULL.z0, z1: HULL.z1, underside: HULL.underside,
  extraPoints: [{ x: -7.4, y: 0.9, z: 3.5 }, { x: 7.4, y: 0.9, z: 3.5 }, { x: -7.4, y: 0.9, z: 7.5 }, { x: 7.4, y: 0.9, z: 7.5 }],
  combat: { centre: { x: 0, y: 1.2, z: 0 }, radius: 10.5 },       // the sphere a bolt must cross to hit it
  push: {
    topY: 7.0, zNose: -17.4, zTail: 16.35,
    hwAt: (z) => (z < HULL.z0 || z > HULL.z1 ? 0 : HULL.halfWidth(z)),
    rampGap: { z: 14.5, hw: 1.8 }, hatch: { x: -4.4, z: 0.6, r: 1.0 },
  },
};

// ---------------------------------------------------------------------------
// Derived layout, built once
// ---------------------------------------------------------------------------
export const LAYOUT = K.finish({
  posters: POSTERS, windows: WINDOWS, stairs: {}, ramps: RAMPS, ladders: LADDERS, seats: SEATS, panels: PANELS,
  extraZones: [], gear: GEAR, guns: GUNS, wallScreens: WALL_SCREENS, observation: OBSERVATION,
  // the openings that are not doors (a hatch is a room you climb through)
  portals: [{ id: 'hatch_dorsal', a: 'niche', b: 'turret', x: 1.8, y: 3.3, z: 2.6, r: 1.4, door: null }],
});

/** Which deck a point on the ship is on, for the HUD. */
export function deckName(y) { return y > 2.0 ? 'Turret deck' : 'Main deck'; }
