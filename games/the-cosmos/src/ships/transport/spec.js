// ============================================================================
// ships/transport/spec.js - the Ares-class passenger transport, as data. SH15 (the big transports of the opening).
//
// THE CLASS: a 120 m, 28 m wide long-haul liner of the neutral Mars Line, the ship that carries a new pilot from Earth to Marineris and the
// one whose sister ships fly beside it on the way in. One long passenger deck at floor level: a 64 m promenade with four seating salons on
// each flank (window walls), a lounge with a panoramic window, a cafe, a medbay, a boarding hall with a gangway, then machinery and a
// hold with a stern ramp. A forward crew block (bridge on a low prow, crew quarters, crew mess). Walkable end to end, Meridian-level dressing.
//
// SHIP-LOCAL FRAME (metres): +X starboard, +Y up, -Z forward. Origin: the centreline at the main-deck floor, amidships (the bridge is at z -50).
// HONEST: 120 m is a design number (a real Mars transport is the pitch of the design, not a measured vessel). Sizes of doors, corridors and
// seats are real human scale (avatar 1.78 m).
// ============================================================================

import { layoutKit } from '../layoutKit.js';
import { makeHull } from '../hullLoft.js';
import { AVATAR } from '../../ship/shipSpec.js';
import { PHYS as BASE_PHYS } from '../raider/spec.js';
export { AVATAR };

export const TRANSPORT_TYPE = 'transport';
export const TRANSPORT_CLASS = 'Ares-class passenger transport';
export const DECK = { main: 0.0, upper: 3.6, pitch: 3.6, clear: 3.2, slab: 0.3 };

const K = layoutKit(DECK);
const { room, door, prop, lamp } = K;

// ---------------------------------------------------------------------------
// Hull: stations [z, half-width, keel y, deck y, top chamfer, bottom chamfer]. The deck drops to the canopy sill (1.05 m) over the prow;
// the body rises behind it. The salons stand inside the 14 m half-width with their outer wall at 13.2.
// ---------------------------------------------------------------------------
export const HULL_STATIONS = [
  [-60, 0.9, -0.4, 1.05, 0.35, 0.35],
  [-54, 4.8, -0.9, 1.05, 0.6, 0.7],
  [-46, 8.6, -1.4, 1.05, 0.8, 0.9],
  [-42.3, 10.4, -1.7, 1.05, 0.8, 1.2],
  [-41.7, 10.8, -2.0, 6.6, 1.6, 1.4],
  [-34, 13.2, -2.0, 6.8, 1.6, 1.4],
  [-20, 14.0, -2.0, 6.8, 1.6, 1.4],
  [30, 14.0, -2.0, 6.8, 1.6, 1.4],
  [40, 13.4, -2.0, 6.7, 1.6, 1.4],
  [52, 12.2, -1.9, 6.5, 1.6, 1.4],
  [60, 11.0, -1.8, 6.2, 1.5, 1.3],
];
export const HULL = makeHull(HULL_STATIONS);
export const CANOPY_ROOMS = ['bridge'];

// ---------------------------------------------------------------------------
// Rooms. Walls are 0.2 m between two rooms: a door stands in that gap.
// ---------------------------------------------------------------------------
room('bridge', 'Flight deck', 'bridge', 'main', -5, 5, -49.5, -42, { canopy: true, h: 3.0 });
room('fore_corr', 'Crew passage', 'corridor', 'main', -1.1, 1.1, -41.8, -33.2);
room('crew_q', 'Crew quarters', 'crew', 'main', -9.6, -1.3, -41.4, -33.6);
room('crew_mess', 'Crew mess', 'galley', 'main', 1.3, 9.6, -41.4, -33.6);

room('promenade', 'Promenade', 'cabin', 'main', -3.3, 3.3, -33, 31, { h: 4.2, style: 'cabin' });
// port side (the window side the hull-name faces), aft to fore: three salons, a cafe, stores
room('sal_p1', 'Salon P1', 'crew', 'main', -13.2, -3.5, -31.6, -17.0, { h: 3.2 });
room('sal_p2', 'Salon P2', 'crew', 'main', -13.2, -3.5, -16.8, -2.2, { h: 3.2 });
room('sal_p3', 'Salon P3', 'crew', 'main', -13.2, -3.5, -2.0, 12.6, { h: 3.2 });
room('cafe', 'Cafe', 'galley', 'main', -13.2, -3.5, 12.8, 22.6, { h: 3.2 });
room('stores', 'Passenger stores', 'evalocker', 'main', -13.2, -3.5, 22.8, 30.6, { style: 'engineering', h: 3.2 });
// starboard side
room('sal_s1', 'Salon S1', 'crew', 'main', 3.5, 13.2, -31.6, -17.0, { h: 3.2 });
room('sal_s2', 'Salon S2', 'crew', 'main', 3.5, 13.2, -16.8, -2.2, { h: 3.2 });
room('lounge', 'Observation lounge', 'cabin', 'main', 3.5, 13.2, -2.0, 12.6, { h: 3.2 });
room('medbay', 'Medbay', 'medbay', 'main', 3.5, 13.2, 12.8, 22.6, { h: 3.2 });
room('gate', 'Boarding hall', 'airlock', 'main', 3.5, 13.2, 22.8, 30.6, { h: 3.2 });

room('engine', 'Machinery', 'engineering', 'main', -10, 10, 31.2, 44.6, { h: 4.4 });
room('hold', 'Cargo hold', 'cargo', 'main', -9, 9, 44.8, 58, { h: 4.4 });

// ---------------------------------------------------------------------------
// Doors. axis 'x': the wall is the plane x = at, you pass along X. axis 'z': the wall is z = at, you pass along Z.
// ---------------------------------------------------------------------------
door('d_bridge', 'fore_corr', 'bridge', 'z', -41.9, 0, { w: 1.4, h: 2.2, sign: 'FLIGHT' });
door('d_crew_q', 'fore_corr', 'crew_q', 'x', -1.2, -37.5, { sign: 'CREW' });
door('d_crew_mess', 'fore_corr', 'crew_mess', 'x', 1.2, -37.5, { sign: 'MESS' });
door('d_promenade', 'fore_corr', 'promenade', 'z', -33.1, 0, { w: 1.6, h: 2.3, sign: 'PASSENGERS' });
const SALON_DOORS = [['sal_p1', -3.4, -24.3], ['sal_p2', -3.4, -9.5], ['sal_p3', -3.4, 5.3], ['cafe', -3.4, 17.7], ['stores', -3.4, 26.7],
  ['sal_s1', 3.4, -24.3], ['sal_s2', 3.4, -9.5], ['lounge', 3.4, 5.3], ['medbay', 3.4, 17.7], ['gate', 3.4, 26.7]];
const SALON_SIGN = { sal_p1: 'SALON P1', sal_p2: 'SALON P2', sal_p3: 'SALON P3', cafe: 'CAFE', stores: 'STORES', sal_s1: 'SALON S1', sal_s2: 'SALON S2', lounge: 'LOUNGE', medbay: 'MEDBAY', gate: 'GATE' };
for (const [id, at, c] of SALON_DOORS) door('d_' + id, 'promenade', id, 'x', at, c, { w: id === 'gate' ? 1.8 : 1.4, h: 2.3, sign: SALON_SIGN[id], signFace: 'a' });
door('d_gate_out', 'gate', 'outside', 'x', 13.3, 26.7, { kind: 'outer', w: 1.8, h: 2.4 });
door('d_engine', 'promenade', 'engine', 'z', 31.1, 0, { w: 1.6, h: 2.4, sign: 'MACHINERY' });
door('d_hold', 'engine', 'hold', 'z', 44.7, 0, { w: 2.6, h: 2.8, sign: 'HOLD' });
door('d_ramp', 'hold', 'outside', 'z', 58, 0, { kind: 'portal', w: 4.4, h: 3.6, noZone: true });

// ---------------------------------------------------------------------------
// Seats (the flight deck and machinery) and consoles
// ---------------------------------------------------------------------------
export const SEATS = [
  ['pilot', -1.6, -47.4, 'flight', 'bridge', 'pilot', 0], ['captain', 1.6, -47.4, 'flight+guns', 'bridge', 'captain', 0],
  ['nav', -3.4, -45.2, 'navigation', 'bridge', 'swivel', 270], ['comms', 3.4, -45.2, 'comms', 'bridge', 'swivel', 90],
  ['engineer', 7.9, 36.2, 'power', 'engine', 'swivel', 90],
].map(([id, x, z, role, rm, variant, yaw], i) => ({ id, x, y: 0, z, yaw, room: rm, name: id === 'nav' ? 'Navigator' : id[0].toUpperCase() + id.slice(1), variant,
  stationId: 'COS-MARS-STR-' + String(480 + i).padStart(4, '0'), lookYaw: 100, lookPitchUp: 55, lookPitchDown: 40, role, hint: 'Work the station' }));

// bridge
prop('console', 'bridge', -1.6, -48.9, 2.2, 0.8, 0.72, 0, { extra: { screens: 3, lift: 0.2, fh: 0.36, sh: 0.32, station: 'pilot' } });
prop('console', 'bridge', 1.6, -48.9, 2.2, 0.8, 0.72, 0, { extra: { screens: 3, lift: 0.2, fh: 0.36, sh: 0.32, station: 'captain', decorative: true } });
prop('console', 'bridge', -4.6, -45.2, 1.6, 0.6, 1.0, 1, { extra: { screens: 2, station: 'nav' } });
prop('console', 'bridge', 4.6, -45.2, 1.6, 0.6, 1.0, 3, { extra: { screens: 2, station: 'comms' } });
prop('holotable', 'bridge', 0, -44.0, 1.3, 1.3, 1.0, 0);
prop('locker', 'bridge', -4.6, -42.6, 0.6, 0.5, 2.0, 2);
prop('locker', 'bridge', 4.6, -42.6, 0.6, 0.5, 2.0, 2);
prop('extinguisher', 'fore_corr', -1.03, -36.5, 0.14, 0.14, 0.5, 1, { y: 1.2, blocks: false });
// crew quarters: four bunk stacks and lockers
prop('bunkpair', 'crew_q', -8.7, -39.6, 1.9, 0.95, 2.0, 1);
prop('bunkpair', 'crew_q', -8.7, -37.2, 1.9, 0.95, 2.0, 1);
prop('bunkpair', 'crew_q', -8.7, -34.8, 1.9, 0.95, 2.0, 1);
prop('locker', 'crew_q', -5.6, -41.0, 0.6, 0.55, 2.0, 2);
prop('locker', 'crew_q', -4.9, -41.0, 0.6, 0.55, 2.0, 2);
prop('table', 'crew_q', -5.2, -37.0, 0.9, 1.2, 0.76);
prop('rug', 'crew_q', -5.2, -37.0, 2.6, 2.4, 0.01, 0, { blocks: false });
// crew mess
prop('table', 'crew_mess', 5.6, -39.0, 0.9, 2.4, 0.76);
prop('bench', 'crew_mess', 4.7, -39.0, 0.36, 2.3, 0.46);
prop('bench', 'crew_mess', 6.5, -39.0, 0.36, 2.3, 0.46);
prop('counter', 'crew_mess', 9.2, -37.5, 2.6, 0.6, 0.95, 3, { style: 'galley' });
prop('fridge', 'crew_mess', 9.1, -35.2, 0.7, 0.7, 1.9, 3);

// ---------------------------------------------------------------------------
// The passenger salons: forward-facing seat banks either side of an aisle, window walls outboard.
// ---------------------------------------------------------------------------
function salon(id, side) {
  const r = K.rooms.find((q) => q.id === id), s = side;                  // s = -1 port, +1 starboard
  const bankA = s * 11.5, bankB = s * 7.0;                               // window-side bank, centre bank
  for (let i = 0; i < 6; i++) {
    const z = r.z0 + 1.3 + i * 2.3;
    prop('paxrow', id, bankA, z, 2.4, 0.9, 1.5, 0, { extra: { seats: 4, tone: i % 2 ? 'fabricBlue' : 'fabricGrey' } });
    prop('paxrow', id, bankB, z, 3.6, 0.9, 1.5, 0, { extra: { seats: 6, tone: i % 2 ? 'fabricBlue' : 'fabricGrey' } });
  }
  prop('luggage', id, s * 4.3, r.z1 - 0.7, 1.5, 0.8, 1.2, 0);
  prop('vending', id, s * 4.35, r.z0 + 0.5, 0.9, 0.7, 1.9, 2);
}
salon('sal_p1', -1); salon('sal_p2', -1); salon('sal_p3', -1);
salon('sal_s1', 1); salon('sal_s2', 1);
for (const id of ['sal_p1', 'sal_p2', 'sal_p3', 'sal_s1', 'sal_s2']) {
  const r = K.rooms.find((q) => q.id === id), s = id.includes('_p') ? -1 : 1;
  prop('extinguisher', id, s * 3.62, r.z1 - 0.1, 0.14, 0.14, 0.5, s < 0 ? 3 : 1, { y: 1.2, blocks: false });
}

// promenade: planters down the middle, boards, kiosks, benches
prop('planter', 'promenade', 0, -26.5, 1.0, 3.0, 1.2, 0);
prop('planter', 'promenade', 0, -12.0, 1.0, 3.0, 1.2, 0);
prop('planter', 'promenade', 0, 2.5, 1.0, 3.0, 1.2, 0);
prop('planter', 'promenade', 0, 16.5, 1.0, 3.0, 1.2, 0);
prop('kiosk', 'promenade', -2.6, -31.2, 0.6, 0.5, 1.3, 0);
prop('kiosk', 'promenade', 2.6, 24.0, 0.6, 0.5, 1.3, 0);
prop('departboard', 'promenade', 0, 30.85, 2.6, 0.1, 1.6, 2, { y: 1.0, blocks: false });
prop('departboard', 'promenade', 3.2, -22.0, 3.0, 0.1, 1.5, 3, { y: 1.1, blocks: false });
prop('rug', 'promenade', 0, -1, 2.0, 56, 0.01, 0, { blocks: false });

// lounge: the panoramic window on the starboard flank, sofas facing it, a rail and the binoculars
for (const z of [0.4, 2.8, 5.2, 7.6, 10.0]) prop('sofa', 'lounge', 6.0, z, 0.8, 1.7, 0.85, 0);
prop('sofa', 'lounge', 8.8, 1.6, 0.8, 1.7, 0.85, 0);
prop('sofa', 'lounge', 8.8, 6.4, 0.8, 1.7, 0.85, 0);
prop('rail', 'lounge', 13.0, 5.3, 0.05, 11.2, 1.04, 0, { blocks: false });
prop('telescope', 'lounge', 12.3, 1.6, 0.5, 0.5, 1.5, 0);
prop('telescope', 'lounge', 12.3, 9.0, 0.5, 0.5, 1.5, 0);
prop('planter', 'lounge', 4.2, 11.8, 1.0, 1.6, 1.2, 0);
prop('table', 'lounge', 10.4, 4.0, 1.0, 1.0, 0.45);

// cafe: counter, tables with stools, the kitchen behind
prop('counter', 'cafe', -9.4, 13.35, 6.4, 0.7, 0.95, 0, { style: 'galley' });
prop('fridge', 'cafe', -4.0, 13.4, 0.7, 0.7, 1.9, 3);
prop('fridge', 'cafe', -4.0, 22.0, 0.7, 0.7, 1.9, 3);
for (const [x, z] of [[-8.8, 14.4], [-8.8, 17.6], [-8.8, 20.8], [-11.9, 14.4], [-11.9, 17.6], [-11.9, 20.8]]) {
  prop('table', 'cafe', x, z, 1.1, 1.1, 0.76);
  prop('bench', 'cafe', x - 0.95, z, 0.36, 1.0, 0.46);
  prop('bench', 'cafe', x + 0.95, z, 0.36, 1.0, 0.46);
}
prop('departboard', 'cafe', -13.0, 17.7, 2.0, 0.1, 1.0, 1, { y: 1.6, blocks: false });

// medbay
prop('medbed', 'medbay', 12.5, 14.6, 0.9, 2.1, 0.9, 0);
prop('medbed', 'medbay', 12.5, 17.4, 0.9, 2.1, 0.9, 0);
prop('medbed', 'medbay', 12.5, 20.2, 0.9, 2.1, 0.9, 0);
prop('counter', 'medbay', 6.2, 22.2, 2.6, 0.6, 0.95, 2, { style: 'med' });
prop('firstaid', 'medbay', 4.0, 14.1, 0.5, 0.2, 0.5, 1, { y: 1.3, blocks: false });
prop('locker', 'medbay', 9.0, 22.2, 0.6, 0.55, 2.0, 2);

// boarding hall: suit racks, a bench, the board
prop('suitrack', 'gate', 4.6, 24.4, 1.8, 0.6, 2.0, 0);
prop('suitrack', 'gate', 6.6, 24.4, 1.8, 0.6, 2.0, 0);
prop('bench', 'gate', 8.9, 29.0, 0.36, 3.2, 0.46, 0);
prop('luggage', 'gate', 5.2, 29.6, 1.8, 1.0, 1.2, 0);
prop('departboard', 'gate', 3.62, 27.6, 1.4, 0.1, 1.0, 1, { y: 1.2, blocks: false });
prop('extinguisher', 'gate', 3.62, 25.0, 0.14, 0.14, 0.5, 1, { y: 1.2, blocks: false });

// stores
prop('crate', 'stores', -12.3, 24.0, 1.1, 1.1, 1.1);
prop('crate', 'stores', -12.3, 25.4, 1.1, 1.1, 1.1);
prop('crate', 'stores', -12.3, 29.4, 1.1, 1.1, 1.1);
prop('rack', 'stores', -4.4, 24.0, 0.5, 1.8, 2.0, 1);
prop('rack', 'stores', -4.4, 28.2, 0.5, 1.8, 2.0, 1);
prop('drum', 'stores', -9.0, 28.8, 0.6, 0.6, 0.9);
prop('drum', 'stores', -9.0, 25.2, 0.6, 0.6, 0.9);

// machinery: the reactor and the engineer's station, tanks, pumps
prop('minireactor', 'engine', -3.4, 38.0, 1.9, 1.9, 2.8, 0, { extra: { radius: 0.7 } });
prop('console', 'engine', 8.7, 36.2, 1.6, 0.55, 1.1, 3, { extra: { screens: 2, station: 'engineer' } });
prop('tank', 'engine', -8.4, 34.0, 1.1, 1.1, 2.8);
prop('tank', 'engine', -8.4, 36.6, 1.1, 1.1, 2.8);
prop('tank', 'engine', -8.4, 41.6, 1.1, 1.1, 2.8);
prop('pump', 'engine', 5.4, 42.0, 0.8, 0.8, 1.0);
prop('pump', 'engine', 7.4, 42.0, 0.8, 0.8, 1.0);
prop('extinguisher', 'engine', 9.88, 33.0, 0.14, 0.14, 0.5, 3, { y: 1.2, blocks: false });

// hold: crates, drums, luggage pallets
for (const [x, z, k2] of [[-7.4, 46.4, 'crate'], [-7.4, 48.0, 'crate'], [-5.8, 46.4, 'crate'], [7.2, 47.0, 'crate'], [7.2, 48.7, 'crate'], [-7.0, 52.5, 'drum'], [-7.8, 52.5, 'drum'], [6.8, 53.4, 'drum']])
  prop(k2, 'hold', x, z, k2 === 'crate' ? 1.2 : 0.6, k2 === 'crate' ? 1.2 : 0.6, k2 === 'crate' ? 1.2 : 0.9);
prop('luggage', 'hold', -3.2, 49.5, 3.2, 1.6, 1.6, 0);
prop('luggage', 'hold', 3.6, 54.2, 3.2, 1.6, 1.6, 0);

for (const r of K.rooms) {
  if (r.id === 'promenade') { for (let z = -28; z <= 28; z += 8) lamp('promenade', 0, z, { intensity: 9, len: 3.2, range: 12 }); continue; }
  const n = Math.max(1, Math.round((r.z1 - r.z0) / 9));
  for (let i = 0; i < n; i++) lamp(r.id, (r.x0 + r.x1) / 2, r.z0 + ((i + 0.5) * (r.z1 - r.z0)) / n, { intensity: r.id === 'hold' || r.id === 'engine' ? 13 : 7, len: 2.4, range: 11 });
}

// ---------------------------------------------------------------------------
// Windows: the outer wall of every room on a flank. y values are in the layout's window convention (the main floor sits at 3.0).
// ---------------------------------------------------------------------------
export const WINDOWS = [];
for (const id of ['sal_p1', 'sal_p2', 'sal_p3']) { const r = K.rooms.find((q) => q.id === id); for (const f of [0.2, 0.5, 0.8]) WINDOWS.push({ room: id, wall: 'x0', c: r.z0 + (r.z1 - r.z0) * f, w: 2.6, y0: 3.9, y1: 5.3 }); }
for (const id of ['sal_s1', 'sal_s2']) { const r = K.rooms.find((q) => q.id === id); for (const f of [0.2, 0.5, 0.8]) WINDOWS.push({ room: id, wall: 'x1', c: r.z0 + (r.z1 - r.z0) * f, w: 2.6, y0: 3.9, y1: 5.3 }); }
WINDOWS.push({ room: 'lounge', wall: 'x1', c: 5.3, w: 11.2, y0: 3.45, y1: 5.9 });
WINDOWS.push({ room: 'cafe', wall: 'x0', c: 15.0, w: 3.0, y0: 3.9, y1: 5.3 }, { room: 'cafe', wall: 'x0', c: 20.4, w: 3.0, y0: 3.9, y1: 5.3 });
WINDOWS.push({ room: 'medbay', wall: 'x1', c: 15.4, w: 1.6, y0: 4.0, y1: 5.2 });
WINDOWS.push({ room: 'crew_q', wall: 'x0', c: -37.5, w: 1.6, y0: 4.0, y1: 5.1 });

export const OBSERVATION = [
  { id: 'lounge_scope_a', name: 'Lounge binoculars', room: 'lounge', x: 12.3, y: 3, z: 1.6, radius: 1.5, fov: 24 },
  { id: 'lounge_scope_b', name: 'Lounge binoculars', room: 'lounge', x: 12.3, y: 3, z: 9.0, radius: 1.5, fov: 24 },
];

// ---------------------------------------------------------------------------
// Ramps: the cargo ramp aft (a loading ramp 4.4 m wide, long enough for the tall legs) and the boarding gangway to starboard.
// ---------------------------------------------------------------------------
export const RAMPS = {
  cargo: { id: 'ramp_cargo', name: 'Cargo ramp', hinge: { x: 0, y: 0, z: 58 }, dir: { x: 0, z: 1 }, length: 7.4, width: 4.4, raisedHeight: 3.6, panel: { thickness: 0.2 } },
  airlock: { id: 'ramp_airlock', name: 'Boarding gangway', hinge: { x: 13.35, y: 0, z: 26.7 }, dir: { x: 1, z: 0 }, length: 8.2, width: 1.8, raisedHeight: 2.4, panel: { thickness: 0.12 } },
};
export const GEAR = {
  soleOffset: 0.3, nominal: 3.0, min: 2.4, max: 3.8, stroke: 0.8, padRadius: 1.9,
  legs: [{ id: 'fl', x: -11.5, z: -30 }, { id: 'fr', x: 11.5, z: -30 }, { id: 'al', x: -10.5, z: 42 }, { id: 'ar', x: 10.5, z: 42 }],
  keel: [{ x: 0, z: -48 }, { x: 0, z: -20 }, { x: 0, z: 20 }, { x: 0, z: 54 }], keelY: -2.0,
};
export const GUNS = {
  main: { id: 'main', name: 'Point defence', seat: 'captain', muzzles: [{ x: -2, y: 0.6, z: -53 }, { x: 2, y: 0.6, z: -53 }], pivot: { x: 0, y: 0.6, z: -50 },
    arcYawDeg: 30, arcPitchUpDeg: 25, arcPitchDownDeg: 20, rate: 2.0, speed: 280, damage: 4, range: 800 },
};
export const PHYS = {
  ...BASE_PHYS, massKg: 1800000, liftThrustN: 7600000, driveThrustN: 4200000, cruiseSpeed: 26, climbSpeed: 7, turnRate: 0.22, shieldBase: 420, hullFactor: 0.12,
};
export const PANELS = [
  { id: 'panel_ramp', name: 'Cargo ramp', x: -3, y: 0, z: 56.5, radius: 2.4, action: 'ramp_cargo' },
  { id: 'panel_air', name: 'Boarding gangway', x: 12.2, y: 0, z: 25.0, radius: 1.8, action: 'airlock' },
];
export const LAYOUT = K.finish({ ramps: RAMPS, gear: GEAR, guns: GUNS, seats: SEATS, panels: PANELS, stairs: {}, ladders: [], extraZones: [], portals: [],
  windows: WINDOWS, posters: [], observation: OBSERVATION, wallScreens: [], custom: null });
export const deckName = () => 'Passenger deck';
