// ============================================================================
// ships/descender/spec.js - the Kestrel-class descent transport, as data. SH15 (the transports that carry a new pilot on from Marineris to the
// chosen world). A 63 m wedge-bodied lander of the neutral Mars Line: bridge on the nose, two passenger cabins with three-bank seating, a
// pantry and boarding vestibule starboard, a head and stores to port, machinery, and a rear bay with a stern ramp. The bay is built round a
// lifeboat cradle (PROPS.lifeboatcradle): the boat that hangs in it is its own ship type (src/ships/lifeboat).
//
// SHIP-LOCAL FRAME (metres): +X starboard, +Y up, -Z forward. Origin: the centreline at the main-deck floor.
// HONEST: 63 m and the wedge are design numbers. Real human scale inside (avatar 1.78 m).
// ============================================================================

import { layoutKit } from '../layoutKit.js';
import { makeHull } from '../hullLoft.js';
import { AVATAR } from '../../ship/shipSpec.js';
import { PHYS as BASE_PHYS } from '../raider/spec.js';
export { AVATAR };

export const DESCENDER_TYPE = 'descender';
export const DESCENDER_CLASS = 'Kestrel-class descent transport';
export const DECK = { main: 0.0, upper: 3.4, pitch: 3.4, clear: 3.0, slab: 0.3 };
const K = layoutKit(DECK);
const { room, door, prop, lamp } = K;

export const HULL_STATIONS = [
  [-33, 0.8, -0.2, 1.05, 0.3, 0.3],
  [-28, 4.6, -0.8, 1.05, 0.6, 0.6],
  [-23.6, 6.9, -1.3, 1.05, 0.8, 0.9],
  [-23.0, 7.4, -1.6, 4.9, 1.4, 1.2],
  [-17, 10.2, -2.0, 5.3, 1.6, 1.4],
  [-9, 11.2, -2.2, 5.5, 1.6, 1.5],
  [16, 11.2, -2.2, 5.5, 1.6, 1.5],
  [24, 10.0, -2.1, 5.2, 1.5, 1.4],
  [33, 8.0, -2.0, 4.9, 1.4, 1.3],
];
export const HULL = makeHull(HULL_STATIONS);
export const CANOPY_ROOMS = ['bridge'];

room('bridge', 'Flight deck', 'bridge', 'main', -3.6, 3.6, -27.5, -22.2, { canopy: true, h: 3.0 });
room('cabin_a', 'Forward cabin', 'crew', 'main', -7.2, 7.2, -22.0, -5.0, { h: 3.0 });
room('cabin_b', 'Rear cabin', 'crew', 'main', -7.2, 7.2, -4.8, 11.6, { h: 3.0 });
room('galley', 'Pantry', 'galley', 'main', 7.4, 10.6, -4.8, 4.0, { h: 3.0 });
room('gate', 'Boarding vestibule', 'airlock', 'main', 7.4, 10.6, 4.2, 11.6, { h: 3.0 });
room('head', 'Heads', 'medbay', 'main', -10.6, -7.4, -4.8, 4.0, { h: 3.0, style: 'head' });
room('stores', 'Stores', 'evalocker', 'main', -10.6, -7.4, 4.2, 11.6, { h: 3.0, style: 'engineering' });
room('machinery', 'Machinery', 'engineering', 'main', -6, 6, 11.8, 17.0, { h: 3.4 });
room('bay', 'Boat bay', 'cargo', 'main', -5, 5, 17.2, 30, { h: 3.6 });

door('d_bridge', 'bridge', 'cabin_a', 'z', -22.1, 0, { w: 1.4, h: 2.2, sign: 'FLIGHT' });
door('d_ab', 'cabin_a', 'cabin_b', 'z', -4.9, 0, { w: 2.2, h: 2.3, sign: 'REAR CABIN' });
door('d_galley', 'cabin_b', 'galley', 'x', 7.3, -1.0, { w: 1.2, h: 2.2, sign: 'PANTRY' });
door('d_gate', 'cabin_b', 'gate', 'x', 7.3, 9.3, { w: 1.4, h: 2.2, sign: 'GATE' });
door('d_gate_out', 'gate', 'outside', 'x', 10.7, 9.3, { kind: 'outer', w: 1.4, h: 2.3 });
door('d_head', 'cabin_b', 'head', 'x', -7.3, -1.0, { w: 1.0, h: 2.1, sign: 'HEADS' });
door('d_stores', 'cabin_b', 'stores', 'x', -7.3, 9.3, { w: 1.2, h: 2.2, sign: 'STORES' });
door('d_machinery', 'cabin_b', 'machinery', 'z', 11.7, 0, { w: 1.6, h: 2.3, sign: 'MACHINERY' });
door('d_bay', 'machinery', 'bay', 'z', 17.1, 0, { w: 2.6, h: 2.6, sign: 'BAY' });
door('d_ramp', 'bay', 'outside', 'z', 30, 0, { kind: 'portal', w: 4.4, h: 3.4, noZone: true });

export const SEATS = [
  ['pilot', -1.4, -26.0, 'flight', 'bridge', 'pilot', 0], ['captain', 1.4, -26.0, 'flight+guns', 'bridge', 'captain', 0],
  ['nav', -2.7, -24.0, 'navigation', 'bridge', 'swivel', 270], ['comms', 2.7, -24.0, 'comms', 'bridge', 'swivel', 90],
  ['engineer', 4.0, 14.4, 'power', 'machinery', 'swivel', 90],
].map(([id, x, z, role, rm, variant, yaw], i) => ({ id, x, y: 0, z, yaw, room: rm, name: id === 'nav' ? 'Navigator' : id[0].toUpperCase() + id.slice(1), variant,
  stationId: 'COS-MARS-STR-' + String(500 + i).padStart(4, '0'), lookYaw: 100, lookPitchUp: 55, lookPitchDown: 40, role, hint: 'Work the station' }));

prop('console', 'bridge', -1.4, -27.1, 1.8, 0.7, 0.72, 0, { extra: { screens: 3, lift: 0.2, fh: 0.36, sh: 0.32, station: 'pilot' } });
prop('console', 'bridge', 1.4, -27.1, 1.8, 0.7, 0.72, 0, { extra: { screens: 3, lift: 0.2, fh: 0.36, sh: 0.32, station: 'captain', decorative: true } });
prop('console', 'bridge', -3.3, -24.0, 1.4, 0.5, 1.0, 1, { extra: { screens: 2, station: 'nav' } });
prop('console', 'bridge', 3.3, -24.0, 1.4, 0.5, 1.0, 3, { extra: { screens: 2, station: 'comms' } });
prop('locker', 'bridge', -3.2, -22.7, 0.6, 0.5, 2.0, 2);
prop('locker', 'bridge', 3.2, -22.7, 0.6, 0.5, 2.0, 2);

// cabins: three banks of three seats a side of the two aisles; rows face the nose
function rows(roomId, z0, z1, n) {
  const pitch = (z1 - z0) / n;
  for (let i = 0; i < n; i++) {
    const z = z0 + pitch * (i + 0.5);
    const tone = i % 2 ? 'fabricBlue' : 'fabricGrey';
    prop('paxrow', roomId, -5.3, z, 3.6, 0.9, 1.5, 0, { extra: { seats: 6, tone } });
    prop('paxrow', roomId, 0, z, 3.6, 0.9, 1.5, 0, { extra: { seats: 6, tone } });
    prop('paxrow', roomId, 5.3, z, 3.6, 0.9, 1.5, 0, { extra: { seats: 6, tone } });
  }
}
rows('cabin_a', -20.6, -6.6, 6);
rows('cabin_b', -3.4, 8.6, 5);
prop('vending', 'cabin_a', -6.5, -21.4, 0.9, 0.7, 1.9, 2);
prop('luggage', 'cabin_a', 6.2, -6.0, 1.5, 0.8, 1.2, 0);
prop('planter', 'cabin_b', 6.0, 10.6, 1.0, 1.6, 1.2, 0);
prop('departboard', 'cabin_a', 4.4, -21.9, 2.4, 0.1, 1.4, 0, { y: 1.0, blocks: false });
prop('extinguisher', 'cabin_a', 7.1, -12.0, 0.14, 0.14, 0.5, 3, { y: 1.2, blocks: false });
prop('extinguisher', 'cabin_b', -7.1, 4.0, 0.14, 0.14, 0.5, 1, { y: 1.2, blocks: false });

// pantry, heads, stores
prop('counter', 'galley', 10.2, 0.4, 3.4, 0.6, 0.95, 3, { style: 'galley' });
prop('fridge', 'galley', 9.9, -3.6, 0.7, 0.7, 1.9, 3);
prop('table', 'galley', 8.6, 3.0, 0.7, 0.7, 0.9);
prop('toilet', 'head', -10.0, -3.4, 0.5, 0.7, 0.42, 1);
prop('toilet', 'head', -10.0, -1.4, 0.5, 0.7, 0.42, 1);
prop('sink', 'head', -10.1, 1.2, 0.6, 0.45, 0.95, 1);
prop('sink', 'head', -10.1, 2.6, 0.6, 0.45, 0.95, 1);
prop('crate', 'stores', -9.8, 5.6, 1.1, 1.1, 1.1);
prop('crate', 'stores', -9.8, 7.0, 1.1, 1.1, 1.1);
prop('rack', 'stores', -9.8, 10.2, 0.5, 1.8, 2.0, 1);
prop('suitrack', 'gate', 8.6, 11.0, 1.8, 0.6, 2.0, 2);
prop('bench', 'gate', 8.4, 5.4, 0.36, 1.6, 0.46, 0);
prop('extinguisher', 'gate', 7.52, 7.0, 0.14, 0.14, 0.5, 1, { y: 1.2, blocks: false });

// machinery
prop('minireactor', 'machinery', -2.6, 14.4, 1.9, 1.9, 2.8, 0, { extra: { radius: 0.7 } });
prop('console', 'machinery', 5.0, 14.4, 1.4, 0.5, 1.1, 3, { extra: { screens: 2, station: 'engineer' } });
prop('tank', 'machinery', -5.2, 12.8, 0.9, 0.9, 2.6);
prop('tank', 'machinery', -5.2, 16.0, 0.9, 0.9, 2.6);

// the bay: a boat on a cradle, tie-downs and a gantry
prop('lifeboatcradle', 'bay', 0, 22.6, 3.4, 8.6, 2.6, 0);
prop('crate', 'bay', -4.2, 18.3, 1.0, 1.0, 1.0);
prop('crate', 'bay', 4.2, 18.3, 1.0, 1.0, 1.0);
prop('drum', 'bay', 4.3, 28.7, 0.6, 0.6, 0.9);
prop('drum', 'bay', -4.3, 28.7, 0.6, 0.6, 0.9);

for (const r of K.rooms) {
  const n = Math.max(1, Math.round((r.z1 - r.z0) / 7));
  for (let i = 0; i < n; i++) lamp(r.id, (r.x0 + r.x1) / 2, r.z0 + ((i + 0.5) * (r.z1 - r.z0)) / n, { intensity: r.id === 'bay' || r.id === 'machinery' ? 12 : 7, len: 2.2, range: 10 });
}

export const WINDOWS = [];
for (const [id, wall] of [['cabin_a', 'x0'], ['cabin_a', 'x1'], ['cabin_b', 'x0'], ['cabin_b', 'x1']]) {
  // the cabins' own flank walls stand at 7.2; on cabin_b the pantry/head/stores stand outboard, so only cabin_a has side glass
  if (id === 'cabin_b') continue;
  const r = K.rooms.find((q) => q.id === id);
  for (const f of [0.2, 0.5, 0.8]) WINDOWS.push({ room: id, wall, c: r.z0 + (r.z1 - r.z0) * f, w: 2.2, y0: 3.9, y1: 5.2 });
}
WINDOWS.push({ room: 'galley', wall: 'x1', c: 0.3, w: 1.4, y0: 4.0, y1: 5.0 }, { room: 'head', wall: 'x0', c: 0.3, w: 1.0, y0: 4.4, y1: 5.1 }, { room: 'stores', wall: 'x0', c: 8.0, w: 1.0, y0: 4.2, y1: 5.0 });
export const OBSERVATION = [];

export const RAMPS = {
  cargo: { id: 'ramp_cargo', name: 'Boat bay ramp', hinge: { x: 0, y: 0, z: 30 }, dir: { x: 0, z: 1 }, length: 7.2, width: 4.4, raisedHeight: 3.4, panel: { thickness: 0.2 } },
  airlock: { id: 'ramp_airlock', name: 'Boarding gangway', hinge: { x: 10.75, y: 0, z: 9.3 }, dir: { x: 1, z: 0 }, length: 7.4, width: 1.4, raisedHeight: 2.3, panel: { thickness: 0.12 } },
};
export const GEAR = {
  soleOffset: 0.3, nominal: 3.0, min: 2.4, max: 3.8, stroke: 0.8, padRadius: 1.6,
  legs: [{ id: 'fl', x: -8.5, z: -14 }, { id: 'fr', x: 8.5, z: -14 }, { id: 'al', x: -8.5, z: 17 }, { id: 'ar', x: 8.5, z: 17 }],
  keel: [{ x: 0, z: -26 }, { x: 0, z: -8 }, { x: 0, z: 10 }, { x: 0, z: 30 }], keelY: -2.2,
};
export const GUNS = {
  main: { id: 'main', name: 'Point defence', seat: 'captain', muzzles: [{ x: -1.4, y: 0.6, z: -31 }, { x: 1.4, y: 0.6, z: -31 }], pivot: { x: 0, y: 0.6, z: -29 },
    arcYawDeg: 28, arcPitchUpDeg: 25, arcPitchDownDeg: 20, rate: 2.0, speed: 280, damage: 4, range: 800 },
};
export const PHYS = { ...BASE_PHYS, massKg: 420000, liftThrustN: 1750000, driveThrustN: 1500000, cruiseSpeed: 34, climbSpeed: 9, turnRate: 0.4, shieldBase: 300, hullFactor: 0.15 };
export const PANELS = [
  { id: 'panel_ramp', name: 'Boat bay ramp', x: -3, y: 0, z: 28.6, radius: 2.2, action: 'ramp_cargo' },
  { id: 'panel_air', name: 'Boarding gangway', x: 9.6, y: 0, z: 7.7, radius: 1.6, action: 'airlock' },
];
export const LAYOUT = K.finish({ ramps: RAMPS, gear: GEAR, guns: GUNS, seats: SEATS, panels: PANELS, stairs: {}, ladders: [], extraZones: [], portals: [],
  windows: WINDOWS, posters: [], observation: OBSERVATION, wallScreens: [], custom: null });
export const deckName = () => 'Passenger deck';
