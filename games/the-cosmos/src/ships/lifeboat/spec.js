// ============================================================================
// ships/lifeboat/spec.js - the lifeboat, as data. SH14 (the starter ship). A small, worn, honest working boat: a canopy cockpit with three
// stations, a cabin with bench seats and survival gear, a starboard vestibule with a side hatch, a stores locker, and a rear bay with a
// ramp. 11 m long, 5 m wide. One hull type for every start world; each world gives it its own paint (src/ships/lifeboat/looks.js), because the
// bible says "one per world, local look" and a boat that was built on the Moon should not look Martian.
//
// SHIP-LOCAL FRAME (metres): +X starboard, +Y up, -Z forward. Origin: the centreline at the main-deck floor.
// ============================================================================

import { layoutKit } from '../layoutKit.js';
import { makeHull } from '../hullLoft.js';
import { AVATAR } from '../../ship/shipSpec.js';
import { PHYS as BASE_PHYS } from '../raider/spec.js';
export { AVATAR };

export const LIFEBOAT_TYPE = 'lifeboat';
export const LIFEBOAT_CLASS = 'Skiff-class lifeboat';
export const DECK = { main: 0.0, upper: 2.6, pitch: 2.6, clear: 2.4, slab: 0.25 };
const K = layoutKit(DECK);
const { room, door, prop, lamp } = K;

export const HULL_STATIONS = [
  [-5.5, 0.5, -0.3, 0.9, 0.25, 0.25],
  [-5.2, 1.5, -0.55, 0.95, 0.45, 0.5],
  [-3.4, 2.25, -0.85, 1.05, 0.6, 0.7],
  [-2.8, 2.45, -0.9, 3.05, 0.8, 0.8],
  [0, 2.6, -0.9, 3.1, 0.8, 0.8],
  [3, 2.6, -0.9, 3.1, 0.8, 0.8],
  [5.6, 2.3, -0.8, 3.0, 0.6, 0.7],
];
export const HULL = makeHull(HULL_STATIONS);
export const CANOPY_ROOMS = ['cockpit'];

room('cockpit', 'Flight deck', 'bridge', 'main', -2.0, 2.0, -5.1, -2.5, { canopy: true, h: 2.4 });
room('cabin', 'Cabin', 'crew', 'main', -2.3, 1.0, -2.3, 3.1, { h: 2.4 });
room('lock', 'Vestibule', 'airlock', 'main', 1.2, 2.3, -2.3, 0.5, { h: 2.4 });
room('stores', 'Stores', 'evalocker', 'main', 1.2, 2.3, 0.7, 3.1, { h: 2.4, style: 'engineering' });
room('hold', 'Rear bay', 'cargo', 'main', -1.9, 1.9, 3.3, 5.4, { h: 2.4 });

door('d_cockpit', 'cockpit', 'cabin', 'z', -2.4, -0.6, { w: 1.2, h: 2.1, sign: 'FLIGHT' });
door('d_lock', 'cabin', 'lock', 'x', 1.1, -0.9, { w: 0.9, h: 2.1, sign: 'HATCH' });
door('d_lock_out', 'lock', 'outside', 'x', 2.4, -0.9, { kind: 'outer', w: 0.9, h: 2.0 });
door('d_stores', 'cabin', 'stores', 'x', 1.1, 1.9, { w: 0.9, h: 2.1, sign: 'STORES' });
door('d_hold', 'cabin', 'hold', 'z', 3.2, 0.3, { w: 1.2, h: 2.1, sign: 'BAY' });
door('d_ramp', 'hold', 'outside', 'z', 5.4, 0, { kind: 'portal', w: 2.4, h: 2.2, noZone: true });

export const SEATS = [
  ['pilot', -0.9, -4.3, 'flight', 'cockpit', 'pilot', 0], ['captain', 0.9, -4.3, 'flight+guns', 'cockpit', 'captain', 0],
  ['nav', 1.0, -3.1, 'navigation', 'cockpit', 'swivel', 90],
].map(([id, x, z, role, rm, variant, yaw], i) => ({ id, x, y: 0, z, yaw, room: rm, name: id === 'nav' ? 'Navigator' : id[0].toUpperCase() + id.slice(1), variant,
  stationId: 'COS-MARS-STR-' + String(520 + i).padStart(4, '0'), lookYaw: 100, lookPitchUp: 55, lookPitchDown: 40, role, hint: 'Work the station' }));

prop('console', 'cockpit', -0.9, -4.95, 1.2, 0.5, 0.72, 0, { extra: { screens: 2, lift: 0.2, fh: 0.36, sh: 0.32, station: 'pilot' } });
prop('console', 'cockpit', 0.9, -4.95, 1.2, 0.5, 0.72, 0, { extra: { screens: 2, lift: 0.2, fh: 0.36, sh: 0.32, station: 'captain', decorative: true } });
prop('console', 'cockpit', 1.75, -3.1, 1.2, 0.4, 1.0, 3, { extra: { screens: 1, station: 'nav' } });
prop('locker', 'cockpit', -1.7, -2.8, 0.6, 0.5, 2.0, 1);
prop('extinguisher', 'cockpit', -1.93, -3.8, 0.14, 0.14, 0.5, 1, { y: 1.1, blocks: false });
// cabin: a bench along each wall, a table between, survival gear
prop('bench', 'cabin', -1.9, 0.9, 0.5, 3.4, 0.46, 0);
prop('table', 'cabin', -0.4, 1.2, 0.7, 1.0, 0.7);
prop('bunk', 'cabin', -0.9, 2.45, 0.9, 1.2, 1.9, 0);
prop('locker', 'cabin', -1.95, -1.7, 0.6, 0.5, 2.0, 1);
prop('firstaid', 'cabin', 0.95, 0.4, 0.5, 0.2, 0.5, 3, { y: 1.3, blocks: false });
prop('extinguisher', 'cabin', -2.2, 3.0, 0.14, 0.14, 0.5, 1, { y: 1.2, blocks: false });
prop('suitrack', 'lock', 1.75, 0.0, 0.5, 1.0, 2.0, 3);
prop('locker', 'stores', 1.9, 1.05, 0.6, 0.5, 2.0, 3);
prop('crate', 'stores', 1.75, 2.7, 0.8, 0.8, 0.8);
prop('tank', 'hold', -1.4, 4.2, 0.6, 0.6, 1.4);
prop('tank', 'hold', -1.4, 4.9, 0.6, 0.6, 1.4);
prop('crate', 'hold', 1.4, 4.7, 0.8, 0.8, 0.8);
for (const r of K.rooms) lamp(r.id, (r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2, { intensity: 6, len: 1.4, range: 7 });

export const WINDOWS = [{ room: 'cabin', wall: 'x0', c: -0.4, w: 1.6, y0: 4.0, y1: 4.9 }, { room: 'cabin', wall: 'x0', c: 1.6, w: 1.0, y0: 4.0, y1: 4.9 }];
export const RAMPS = {
  cargo: { id: 'ramp_cargo', name: 'Rear ramp', hinge: { x: 0, y: 0, z: 5.4 }, dir: { x: 0, z: 1 }, length: 3.0, width: 2.4, raisedHeight: 2.2, panel: { thickness: 0.12 } },
  airlock: { id: 'ramp_airlock', name: 'Side hatch', hinge: { x: 2.45, y: 0, z: -0.9 }, dir: { x: 1, z: 0 }, length: 2.8, width: 0.9, raisedHeight: 2.0, panel: { thickness: 0.08 } },
};
export const GEAR = {
  soleOffset: 0.2, nominal: 1.2, min: 0.8, max: 1.8, stroke: 0.4, padRadius: 0.6,
  legs: [{ id: 'fl', x: -1.9, z: -3.6 }, { id: 'fr', x: 1.9, z: -3.6 }, { id: 'al', x: -1.9, z: 4.0 }, { id: 'ar', x: 1.9, z: 4.0 }],
  keel: [{ x: 0, z: -4.6 }, { x: 0, z: 0 }, { x: 0, z: 5.0 }], keelY: -0.9,
};
export const GUNS = {
  main: { id: 'main', name: 'Flare launcher', seat: 'captain', muzzles: [{ x: -0.5, y: 0.5, z: -5.6 }, { x: 0.5, y: 0.5, z: -5.6 }], pivot: { x: 0, y: 0.5, z: -5.0 },
    arcYawDeg: 20, arcPitchUpDeg: 20, arcPitchDownDeg: 15, rate: 1.5, speed: 220, damage: 2, range: 400 },
};
export const PHYS = { ...BASE_PHYS, massKg: 6800, liftThrustN: 52000, driveThrustN: 38000, cruiseSpeed: 36, climbSpeed: 11, turnRate: 0.9, shieldBase: 40, hullFactor: 0.3 };
export const PANELS = [
  { id: 'panel_ramp', name: 'Rear ramp', x: -1.2, y: 0, z: 4.6, radius: 1.4, action: 'ramp_cargo' },
  { id: 'panel_air', name: 'Side hatch', x: 1.7, y: 0, z: -1.6, radius: 1.2, action: 'airlock' },
];
export const LAYOUT = K.finish({ ramps: RAMPS, gear: GEAR, guns: GUNS, seats: SEATS, panels: PANELS, stairs: {}, ladders: [], extraZones: [], portals: [],
  windows: WINDOWS, posters: [], observation: [], wallScreens: [], custom: null });
export const deckName = () => 'Main deck';
