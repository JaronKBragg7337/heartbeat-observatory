// ============================================================================
// ships/escort/spec.js - the Line Marshal-class escort cutter, as data. SH15 (the escort that flies beside the opening's transport). A 44 m
// swept-wing cutter of the neutral Mars Line: a flight deck, a crew passage with quarters, mess, an armoury, a boarding vestibule, heads and
// stores, machinery and a rear bay with a ramp. Fast, lightly armed (a chin pair), and the one ship in the fleet a customs officer is happy to see.
//
// SHIP-LOCAL FRAME (metres): +X starboard, +Y up, -Z forward. Origin: the centreline at the main-deck floor.
// ============================================================================

import { layoutKit } from '../layoutKit.js';
import { makeHull } from '../hullLoft.js';
import { AVATAR } from '../../ship/shipSpec.js';
import { PHYS as BASE_PHYS, GUNS as BASE_GUNS } from '../raider/spec.js';
export { AVATAR };

export const ESCORT_TYPE = 'escort';
export const ESCORT_CLASS = 'Line Marshal-class escort cutter';
export const DECK = { main: 0.0, upper: 3.0, pitch: 3.0, clear: 2.7, slab: 0.3 };
const K = layoutKit(DECK);
const { room, door, prop, lamp } = K;

export const HULL_STATIONS = [
  [-22, 0.5, -0.1, 0.9, 0.25, 0.25],
  [-19.6, 1.9, -0.45, 1.05, 0.4, 0.45],
  [-16.6, 3.2, -0.8, 1.05, 0.6, 0.7],
  [-13.8, 4.0, -1.0, 1.05, 0.7, 0.8],
  [-13.2, 4.3, -1.2, 3.7, 0.9, 0.9],
  [-4, 4.7, -1.3, 3.9, 1.0, 1.0],
  [10, 4.6, -1.3, 3.9, 1.0, 1.0],
  [16, 4.4, -1.2, 3.8, 0.9, 0.9],
  [22, 4.1, -1.1, 3.6, 0.9, 0.9],
];
export const HULL = makeHull(HULL_STATIONS);
export const CANOPY_ROOMS = ['bridge'];

room('bridge', 'Flight deck', 'bridge', 'main', -3.0, 3.0, -18.8, -13.6, { canopy: true });
room('passage', 'Crew passage', 'corridor', 'main', -0.8, 0.8, -13.4, 9.4);
room('crew', 'Crew quarters', 'crew', 'main', -3.6, -1.0, -13.0, -6.4);
room('mess', 'Mess', 'galley', 'main', 1.0, 3.6, -13.0, -6.4);
room('armoury', 'Armoury', 'evalocker', 'main', -3.6, -1.0, -6.2, -0.8, { style: 'engineering' });
room('gate', 'Boarding vestibule', 'airlock', 'main', 1.0, 3.6, -6.2, -1.8);
room('stores', 'Stores', 'evalocker', 'main', 1.0, 3.6, -1.6, 4.6, { style: 'engineering' });
room('head', 'Heads', 'medbay', 'main', -3.6, -1.0, -0.6, 3.6, { style: 'head' });
room('engine', 'Machinery', 'engineering', 'main', -3.4, 3.4, 9.6, 14.6);
room('hold', 'Rear bay', 'cargo', 'main', -3.2, 3.2, 14.8, 19.6, { h: 3.0 });

door('d_bridge', 'passage', 'bridge', 'z', -13.5, 0, { w: 1.2, h: 2.2, sign: 'FLIGHT' });
door('d_crew', 'passage', 'crew', 'x', -0.9, -9.7, { sign: 'CREW' });
door('d_mess', 'passage', 'mess', 'x', 0.9, -9.7, { sign: 'MESS' });
door('d_armoury', 'passage', 'armoury', 'x', -0.9, -3.5, { sign: 'ARMOURY' });
door('d_gate', 'passage', 'gate', 'x', 0.9, -4.0, { sign: 'GATE' });
door('d_gate_out', 'gate', 'outside', 'x', 3.7, -4.0, { kind: 'outer', w: 1.3, h: 2.2 });
door('d_stores', 'passage', 'stores', 'x', 0.9, 1.5, { sign: 'STORES' });
door('d_head', 'passage', 'head', 'x', -0.9, 1.5, { sign: 'HEADS' });
door('d_engine', 'passage', 'engine', 'z', 9.5, 0, { w: 1.2, sign: 'MACHINERY' });
door('d_hold', 'engine', 'hold', 'z', 14.7, 0, { w: 1.8, sign: 'BAY' });
door('d_ramp', 'hold', 'outside', 'z', 19.6, 0, { kind: 'portal', w: 2.8, h: 2.8, noZone: true });

export const SEATS = [
  ['pilot', -1.2, -17.2, 'flight', 'bridge', 'pilot', 0], ['captain', 1.2, -17.2, 'flight+guns', 'bridge', 'captain', 0],
  ['nav', -2.2, -15.0, 'navigation', 'bridge', 'swivel', 270], ['comms', 2.2, -15.0, 'comms', 'bridge', 'swivel', 90],
  ['engineer', 1.4, 12.2, 'power', 'engine', 'swivel', 90],
].map(([id, x, z, role, rm, variant, yaw], i) => ({ id, x, y: 0, z, yaw, room: rm, name: id === 'nav' ? 'Navigator' : id[0].toUpperCase() + id.slice(1), variant,
  stationId: 'COS-MARS-STR-' + String(560 + i).padStart(4, '0'), lookYaw: 100, lookPitchUp: 55, lookPitchDown: 40, role, hint: 'Work the station' }));

prop('console', 'bridge', -1.2, -18.4, 1.7, 0.6, 0.72, 0, { extra: { screens: 2, lift: 0.2, fh: 0.36, sh: 0.32, station: 'pilot' } });
prop('console', 'bridge', 1.2, -18.4, 1.7, 0.6, 0.72, 0, { extra: { screens: 2, lift: 0.2, fh: 0.36, sh: 0.32, station: 'captain', decorative: true } });
prop('console', 'bridge', -2.75, -15.0, 1.4, 0.5, 1.0, 1, { extra: { screens: 2, station: 'nav' } });
prop('console', 'bridge', 2.75, -15.0, 1.4, 0.5, 1.0, 3, { extra: { screens: 2, station: 'comms' } });
prop('locker', 'bridge', -2.6, -13.9, 0.5, 0.4, 1.9, 2);
prop('bunk', 'crew', -2.9, -11.4, 0.95, 2.1, 1.9, 0);
prop('bunk', 'crew', -2.9, -9.0, 0.95, 2.1, 1.9, 0);
prop('locker', 'crew', -1.5, -6.7, 0.5, 0.45, 2.0, 2);
prop('table', 'mess', 2.6, -10.8, 0.8, 1.4, 0.76);
prop('bench', 'mess', 1.9, -10.8, 0.34, 1.3, 0.46);
prop('counter', 'mess', 3.3, -8.4, 1.4, 0.55, 0.95, 3, { style: 'galley' });
prop('weaponrack', 'armoury', -2.4, -5.9, 2.2, 0.3, 1.9, 0);
prop('weaponrack', 'armoury', -3.35, -3.4, 2.2, 0.3, 1.9, 1);
prop('suitrack', 'gate', 2.9, -5.4, 0.8, 0.6, 2.0, 3);
prop('crate', 'stores', 2.8, 3.8, 0.8, 0.8, 0.8);
prop('rack', 'stores', 3.3, 0.5, 0.4, 1.4, 2.0, 0);
prop('toilet', 'head', -3.2, 2.8, 0.5, 0.7, 0.42, 1);
prop('sink', 'head', -3.2, 1.0, 0.6, 0.45, 0.95, 1);
prop('minireactor', 'engine', -1.8, 12.0, 1.7, 1.7, 2.4, 0, { extra: { radius: 0.6 } });
prop('console', 'engine', 2.8, 12.2, 1.2, 0.5, 1.1, 3, { extra: { screens: 2, station: 'engineer' } });
prop('crate', 'hold', -2.4, 17.2, 0.9, 0.9, 0.9);
prop('drum', 'hold', 2.4, 18.8, 0.6, 0.6, 0.9);
prop('extinguisher', 'passage', -0.73, 5.5, 0.14, 0.14, 0.5, 1, { y: 1.2, blocks: false });
for (const r of K.rooms) lamp(r.id, (r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2, { intensity: r.id === 'hold' || r.id === 'engine' ? 12 : 7, len: 1.6, range: 9 });

export const WINDOWS = [{ room: 'crew', wall: 'x0', c: -9.7, w: 1.4, y0: 4.2, y1: 5.1 }, { room: 'mess', wall: 'x1', c: -9.7, w: 1.4, y0: 4.2, y1: 5.1 }];
export const RAMPS = {
  cargo: { id: 'ramp_cargo', name: 'Boarding ramp', hinge: { x: 0, y: 0, z: 19.6 }, dir: { x: 0, z: 1 }, length: 4.4, width: 2.8, raisedHeight: 2.8, panel: { thickness: 0.14 } },
  airlock: { id: 'ramp_airlock', name: 'Gangway', hinge: { x: 3.75, y: 0, z: -4.0 }, dir: { x: 1, z: 0 }, length: 4.0, width: 1.3, raisedHeight: 2.2, panel: { thickness: 0.1 } },
};
export const GEAR = {
  soleOffset: 0.25, nominal: 1.7, min: 1.1, max: 2.6, stroke: 0.6, padRadius: 0.7,
  legs: [{ id: 'fl', x: -3.4, z: -9 }, { id: 'fr', x: 3.4, z: -9 }, { id: 'al', x: -3.4, z: 14 }, { id: 'ar', x: 3.4, z: 14 }],
  keel: [{ x: 0, z: -19 }, { x: 0, z: 0 }, { x: 0, z: 20 }], keelY: -1.3,
};
export const GUNS = { main: { ...BASE_GUNS.main, name: 'Chin cannons', damage: 14, muzzles: [{ x: -1.0, y: 0.5, z: -21.4 }, { x: 1.0, y: 0.5, z: -21.4 }], pivot: { x: 0, y: 0.5, z: -18.5 } } };
export const PHYS = { ...BASE_PHYS, massKg: 24000, liftThrustN: 105000, driveThrustN: 240000, cruiseSpeed: 70, climbSpeed: 17, turnRate: 1.2, shieldBase: 160, hullFactor: 0.2 };
export const PANELS = [
  { id: 'panel_ramp', name: 'Boarding ramp', x: -1.8, y: 0, z: 18.6, radius: 1.6, action: 'ramp_cargo' },
  { id: 'panel_air', name: 'Gangway', x: 2.6, y: 0, z: -2.6, radius: 1.5, action: 'airlock' },
];
export const LAYOUT = K.finish({ ramps: RAMPS, gear: GEAR, guns: GUNS, seats: SEATS, panels: PANELS, stairs: {}, ladders: [], extraZones: [], portals: [],
  windows: WINDOWS, posters: [], observation: [], wallScreens: [], custom: null });
export const deckName = () => 'Main deck';
