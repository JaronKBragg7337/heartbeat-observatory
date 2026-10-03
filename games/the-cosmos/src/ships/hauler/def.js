// ============================================================================
// ships/hauler/def.js - the Drayman-class hauler as one entry in the fleet (see src/ships/registry.js for what a definition is).
// It is the first ship that carries other vehicles on purpose: `cargoDeck` and `berths` say where a rover rides and is locked down.
// ============================================================================

import { HAULER_TYPE, HAULER_CLASS, LAYOUT, GEAR, GUNS, PHYS, RAMPS, SEATS, PANELS, AVATAR, HULL_FLIGHT, CARGO_DECK, BERTHS, deckName } from './spec.js';
import { CREW_POSTS } from '../../crew/crewSpec.js';
import { RAIDER_CREW_POSTS } from '../raider/crew.js';
import { HAULER_PRICE_CREDITS, HAULER_CARGO_KG } from './stats.js';

export const HAULER = {
  type: HAULER_TYPE,
  class: HAULER_CLASS,
  name: 'Drayman',
  registryId: 'COS-MARS-VEH-0070',
  layout: LAYOUT, gear: GEAR, guns: GUNS, phys: PHYS, ramps: RAMPS, seats: SEATS, panels: PANELS, avatar: AVATAR,
  gunSeats: {},
  seatGun: { captain: 'main' },
  crewPosts: [...CREW_POSTS.filter((p) => ['pilot', 'captain', 'nav', 'comms'].includes(p.id)), RAIDER_CREW_POSTS.find((p) => p.id === 'engineer')],
  hull: HULL_FLIGHT,
  roles: { bridge: 'cockpit', cargo: 'hold', engineering: 'engine', airlock: 'airlock', corridor: 'corridor_main' },
  // the vehicle bay: where a rover drives, and where it is locked down for flight (src/vehicles/support.js, server/vehicles.mjs)
  cargoDeck: CARGO_DECK,
  berths: BERTHS,
  dock: {
    rampFoot: { x: 0, y: 0, z: 39 },
    boardSw: { x: 0, y: 0, z: 30, yaw: 0 },
    leaveLocal: { x: -9, y: -1.2, z: 38 },
    clearRampZ: 34.5,
    bounds: { x: 12, z: 41, y0: -4, y1: 9 },     // the hull plus the port gangway (it reaches x = -10.4) and the foot of the 5.6 m vehicle ramp (z 38)
    remote: { x: 0, z: 36, r: 16 },
    spawnY: 3.4,
  },
  features: { holo: false, practiceTargets: false, personalDrones: false, ventralGlass: false },
  hudName: 'Drayman',
  deckName,
  envelope: { width: 17.36, height: 8.54, depth: 53.65 },     // measured against the built geometry (test/cargo-checks.mjs); see exterior.js
  stats: { crewMax: 5, cargoKg: HAULER_CARGO_KG, escorts: 0, priceCredits: HAULER_PRICE_CREDITS, roverBerths: BERTHS.length },
};
