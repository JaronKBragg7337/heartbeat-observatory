// ============================================================================
// ships/bulker/spec.js - the Long Haul-class bulk carrier, as data. SH15 (the huge ships that fly beside the opening's transport). A 240 m ore
// and water train: a bridge tower and crew block forward, a long spine girder behind it carrying ten ore pods and four tank spheres, and a
// cluster of six big engines. The crew block is walkable (bridge, passage, quarters, mess, machinery, boarding vestibule, cargo control and a
// bay with a ramp). The pods are not entered: they are hauled, not lived in. HONEST: that is a decision for scope, not a claim about the pods.
//
// SHIP-LOCAL FRAME (metres): +X starboard, +Y up, -Z forward. Origin: the centreline at the main-deck floor of the crew block (z = -105).
// The ship's own z runs -120 (nose) to +120 (engines); the crew block stands at the nose.
// ============================================================================

import { layoutKit } from '../layoutKit.js';
import { makeHull } from '../hullLoft.js';
import { AVATAR } from '../../ship/shipSpec.js';
import { PHYS as BASE_PHYS } from '../raider/spec.js';
export { AVATAR };

export const BULKER_TYPE = 'bulker';
export const BULKER_CLASS = 'Long Haul-class bulk carrier';
export const DECK = { main: 0.0, upper: 3.2, pitch: 3.2, clear: 2.8, slab: 0.3 };
const K = layoutKit(DECK);
const { room, door, prop, lamp } = K;

// A wide crew block at the nose, then a narrow spine girder the pods hang from.
export const HULL_STATIONS = [
  [-120, 0.9, -0.5, 1.05, 0.3, 0.3],
  [-116, 5.2, -1.2, 1.05, 0.6, 0.7],
  [-111.7, 8.6, -1.9, 1.05, 0.8, 1.0],
  [-111.5, 9.0, -2.4, 6.4, 1.6, 1.5],
  [-100, 9.4, -2.6, 6.8, 1.8, 1.6],
  [-78, 9.4, -2.6, 6.8, 1.8, 1.6],
  [-72, 4.4, -2.6, 5.4, 1.4, 1.4],
  [100, 4.4, -2.6, 5.4, 1.4, 1.4],
  [110, 7.0, -3.0, 7.0, 1.8, 1.8],
  [120, 7.4, -3.2, 7.2, 1.8, 1.8],
];
export const HULL = makeHull(HULL_STATIONS);
export const CANOPY_ROOMS = ['bridge'];

room('bridge', 'Flight deck', 'bridge', 'main', -5.2, 5.2, -119, -111.6, { canopy: true, h: 3.0 });
room('passage', 'Crew passage', 'corridor', 'main', -1.1, 1.1, -111.4, -91.8);
room('crew', 'Crew quarters', 'crew', 'main', -8.2, -1.3, -111.0, -102.0, { h: 2.8 });
room('mess', 'Crew mess', 'galley', 'main', 1.3, 8.2, -111.0, -102.0, { h: 2.8 });
room('machinery', 'Machinery', 'engineering', 'main', -8.2, -1.3, -101.8, -95.0, { h: 3.2 });
room('gate', 'Boarding vestibule', 'airlock', 'main', 1.3, 8.2, -101.8, -97.0, { h: 2.8 });
room('control', 'Cargo control', 'evalocker', 'main', 1.3, 8.2, -96.8, -91.8, { style: 'engineering', h: 2.8 });
room('stores', 'Stores', 'evalocker', 'main', -8.2, -1.3, -94.8, -91.8, { style: 'engineering', h: 2.8 });
room('bay', 'Hold bay', 'cargo', 'main', -6.5, 6.5, -91.6, -82.0, { h: 4.4 });

door('d_bridge', 'passage', 'bridge', 'z', -111.5, 0, { w: 1.4, h: 2.2, sign: 'FLIGHT' });
door('d_crew', 'passage', 'crew', 'x', -1.2, -106.5, { sign: 'CREW' });
door('d_mess', 'passage', 'mess', 'x', 1.2, -106.5, { sign: 'MESS' });
door('d_machinery', 'passage', 'machinery', 'x', -1.2, -98.4, { w: 1.2, sign: 'MACHINERY' });
door('d_gate', 'passage', 'gate', 'x', 1.2, -99.4, { w: 1.2, sign: 'GATE' });
door('d_gate_out', 'gate', 'outside', 'x', 8.3, -99.4, { kind: 'outer', w: 1.3, h: 2.2 });
door('d_control', 'passage', 'control', 'x', 1.2, -94.2, { w: 1.0, sign: 'CARGO CTRL' });
door('d_stores', 'passage', 'stores', 'x', -1.2, -93.3, { w: 1.0, sign: 'STORES' });
door('d_bay', 'passage', 'bay', 'z', -91.7, 0, { w: 1.8, h: 2.8, sign: 'HOLD' });
door('d_ramp', 'bay', 'outside', 'z', -82.0, 0, { kind: 'portal', w: 6.0, h: 4.2, noZone: true });

export const SEATS = [
  ['pilot', -1.5, -117.2, 'flight', 'bridge', 'pilot', 0], ['captain', 1.5, -117.2, 'flight+guns', 'bridge', 'captain', 0],
  ['nav', -3.2, -114.6, 'navigation', 'bridge', 'swivel', 270], ['comms', 3.2, -114.6, 'comms', 'bridge', 'swivel', 90],
  ['engineer', -4.3, -96.4, 'power', 'machinery', 'swivel', 90],
].map(([id, x, z, role, rm, variant, yaw], i) => ({ id, x, y: 0, z, yaw, room: rm, name: id === 'nav' ? 'Navigator' : id[0].toUpperCase() + id.slice(1), variant,
  stationId: 'COS-MARS-STR-' + String(540 + i).padStart(4, '0'), lookYaw: 100, lookPitchUp: 55, lookPitchDown: 40, role, hint: 'Work the station' }));

prop('console', 'bridge', -1.5, -118.6, 2.0, 0.7, 0.72, 0, { extra: { screens: 3, lift: 0.2, fh: 0.36, sh: 0.32, station: 'pilot' } });
prop('console', 'bridge', 1.5, -118.6, 2.0, 0.7, 0.72, 0, { extra: { screens: 3, lift: 0.2, fh: 0.36, sh: 0.32, station: 'captain', decorative: true } });
prop('console', 'bridge', -4.7, -114.6, 1.5, 0.5, 1.0, 1, { extra: { screens: 2, station: 'nav' } });
prop('console', 'bridge', 4.7, -114.6, 1.5, 0.5, 1.0, 3, { extra: { screens: 2, station: 'comms' } });
prop('holotable', 'bridge', 0, -113.6, 1.2, 1.2, 1.0, 0);
prop('locker', 'bridge', -4.5, -112.2, 0.6, 0.5, 2.0, 2);
prop('locker', 'bridge', 4.5, -112.2, 0.6, 0.5, 2.0, 2);
prop('bunkpair', 'crew', -7.3, -109.4, 1.9, 0.95, 2.0, 1);
prop('bunkpair', 'crew', -7.3, -107.0, 1.9, 0.95, 2.0, 1);
prop('bunkpair', 'crew', -7.3, -104.6, 1.9, 0.95, 2.0, 1);
prop('locker', 'crew', -4.2, -110.5, 0.6, 0.55, 2.0, 2);
prop('locker', 'crew', -3.5, -110.5, 0.6, 0.55, 2.0, 2);
prop('table', 'crew', -4.2, -104.8, 0.9, 1.2, 0.76);
prop('table', 'mess', 5.0, -108.2, 0.9, 2.6, 0.76);
prop('bench', 'mess', 4.1, -108.2, 0.36, 2.5, 0.46);
prop('bench', 'mess', 5.9, -108.2, 0.36, 2.5, 0.46);
prop('counter', 'mess', 7.9, -105.6, 3.0, 0.6, 0.95, 3, { style: 'galley' });
prop('fridge', 'mess', 7.8, -103.2, 0.7, 0.7, 1.9, 3);
prop('minireactor', 'machinery', -6.0, -97.4, 1.9, 1.9, 2.8, 0, { extra: { radius: 0.7 } });
prop('console', 'machinery', -2.0, -96.4, 1.4, 0.5, 1.1, 3, { extra: { screens: 2, station: 'engineer' } });
prop('tank', 'machinery', -7.5, -100.6, 0.9, 0.9, 2.6);
prop('suitrack', 'gate', 4.4, -101.2, 1.8, 0.6, 2.0, 0);
prop('bench', 'gate', 6.6, -97.9, 0.36, 1.8, 0.46, 0);
prop('console', 'control', 7.8, -94.2, 2.4, 0.6, 1.0, 3, { extra: { screens: 2, decorative: true } });
prop('locker', 'control', 3.0, -92.4, 0.6, 0.5, 2.0, 2);
prop('crate', 'stores', -7.5, -93.4, 1.0, 1.0, 1.0);
prop('rack', 'stores', -3.5, -93.0, 0.5, 1.8, 2.0, 1);
prop('crate', 'bay', -5.2, -90.0, 1.2, 1.2, 1.2);
prop('crate', 'bay', 5.2, -90.0, 1.2, 1.2, 1.2);
prop('drum', 'bay', -5.4, -84.0, 0.6, 0.6, 0.9);
prop('drum', 'bay', 5.4, -84.0, 0.6, 0.6, 0.9);
prop('extinguisher', 'passage', -1.03, -102.0, 0.14, 0.14, 0.5, 1, { y: 1.2, blocks: false });
for (const r of K.rooms) lamp(r.id, (r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2, { intensity: r.id === 'bay' || r.id === 'machinery' ? 13 : 7, len: 1.8, range: 10 });

export const WINDOWS = [
  { room: 'crew', wall: 'x0', c: -106.5, w: 1.8, y0: 4.2, y1: 5.2 }, { room: 'mess', wall: 'x1', c: -106.5, w: 1.8, y0: 4.2, y1: 5.2 },
];
export const RAMPS = {
  cargo: { id: 'ramp_cargo', name: 'Hold ramp', hinge: { x: 0, y: 0, z: -82.0 }, dir: { x: 0, z: 1 }, length: 8.0, width: 6.0, raisedHeight: 4.2, panel: { thickness: 0.2 } },
  airlock: { id: 'ramp_airlock', name: 'Boarding gangway', hinge: { x: 8.45, y: 0, z: -99.4 }, dir: { x: 1, z: 0 }, length: 8.0, width: 1.3, raisedHeight: 2.2, panel: { thickness: 0.12 } },
};
export const GEAR = {
  soleOffset: 0.3, nominal: 3.2, min: 2.6, max: 4.0, stroke: 0.8, padRadius: 3,
  legs: [{ id: 'fl', x: -8.5, z: -104 }, { id: 'fr', x: 8.5, z: -104 }, { id: 'al', x: -9, z: 104 }, { id: 'ar', x: 9, z: 104 }],
  keel: [{ x: 0, z: -112 }, { x: 0, z: -60 }, { x: 0, z: 0 }, { x: 0, z: 60 }, { x: 0, z: 116 }], keelY: -2.6,
};
export const GUNS = {
  main: { id: 'main', name: 'Point defence', seat: 'captain', muzzles: [{ x: -2.4, y: 0.6, z: -123 }, { x: 2.4, y: 0.6, z: -123 }], pivot: { x: 0, y: 0.6, z: -120 },
    arcYawDeg: 30, arcPitchUpDeg: 25, arcPitchDownDeg: 20, rate: 1.6, speed: 280, damage: 4, range: 800 },
};
export const PHYS = { ...BASE_PHYS, massKg: 38000000, liftThrustN: 1.5e8, driveThrustN: 8e7, cruiseSpeed: 20, climbSpeed: 5, turnRate: 0.08, shieldBase: 900, hullFactor: 0.08 };
export const PANELS = [
  { id: 'panel_ramp', name: 'Hold ramp', x: -4, y: 0, z: -83.5, radius: 2.4, action: 'ramp_cargo' },
  { id: 'panel_air', name: 'Boarding gangway', x: 7.2, y: 0, z: -97.6, radius: 1.6, action: 'airlock' },
];
export const LAYOUT = K.finish({ ramps: RAMPS, gear: GEAR, guns: GUNS, seats: SEATS, panels: PANELS, stairs: {}, ladders: [], extraZones: [], portals: [],
  windows: WINDOWS, posters: [], observation: [], wallScreens: [], custom: null });
export const deckName = () => 'Crew deck';
