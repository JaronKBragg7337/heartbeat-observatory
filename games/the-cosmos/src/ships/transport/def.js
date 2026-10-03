// ============================================================================
// ships/transport/def.js - the Ares-class passenger transport as one entry in the fleet (SH15). See spec.js for the class, the rooms and why.
// Not for sale: it belongs to the Mars Line and flies the Earth-Mars run, with its sister ships beside it in the opening.
// ============================================================================

import { TRANSPORT_TYPE, TRANSPORT_CLASS, LAYOUT, GEAR, GUNS, PHYS, RAMPS, SEATS, PANELS, AVATAR, HULL, deckName } from './spec.js';
import { CREW_POSTS } from '../../crew/crewSpec.js';
import { passengerSeatsOf } from '../_liner/pax.js';
import { RAIDER_CREW_POSTS } from '../raider/crew.js';

const PAX = passengerSeatsOf(LAYOUT);

export const TRANSPORT = {
  order: 60,
  role: 'passenger',
  blurb: 'A 120 metre long-haul liner: a 64 metre promenade, 300 seats, a lounge with a panoramic window, and a stern ramp.',
  description: 'The Ares is the neutral Mars Line\'s long-haul passenger transport: 120 metres, 1,800 tonnes, a bridge on a low prow and one long passenger deck behind it. A promenade runs down the middle between five seating salons, a lounge with a panoramic window, a cafe, a medbay and a boarding hall, with machinery and a cargo hold with a stern ramp aft. It is what carries a pilot to Mars. It is not sold at the yard.',
  thumbnail: 'assets/ships/transport.webp',
  type: TRANSPORT_TYPE,
  class: TRANSPORT_CLASS,
  name: 'Ares',
  registryId: 'COS-MARS-VEH-0480',
  layout: LAYOUT, gear: GEAR, guns: GUNS, phys: PHYS, ramps: RAMPS, seats: SEATS, panels: PANELS, avatar: AVATAR,
  gunSeats: {},
  seatGun: { captain: 'main' },
  crewPosts: [...CREW_POSTS.filter((p) => ['pilot', 'captain', 'nav', 'comms'].includes(p.id)), RAIDER_CREW_POSTS.find((p) => p.id === 'engineer')],
  hull: {
    z0: HULL.z0, z1: HULL.z1, underside: HULL.underside, extraPoints: [],
    combat: { centre: { x: 0, y: 1.5, z: 0 }, radius: 56 },
    push: { topY: 6.8, zNose: -60, zTail: 60, hwAt: (z) => HULL.halfWidth(z), rampGap: { z: 58, hw: 2.4 }, hatch: { x: 13.4, z: 26.7, r: 1.4 } },
  },
  roles: { bridge: 'bridge', cargo: 'hold', engineering: 'engine', airlock: 'gate', corridor: 'promenade' },
  dock: {
    rampFoot: { x: 0, y: 0, z: 68 },
    boardSw: { x: 0, y: 0, z: 54, yaw: 0 },
    leaveLocal: { x: -17, y: -3, z: 40 },
    clearRampZ: 62,
    bounds: { x: 30, z: 70, y0: -5, y1: 14 },
    remote: { x: 0, z: 66, r: 40 },
    spawnY: 3.8,
  },
  features: { holo: false, practiceTargets: false, personalDrones: false, ventralGlass: false },
  hudName: 'Ares',
  deckName,
  envelope: { width: 28.4, height: 14, depth: 120 },
  passengerSeats: PAX,
  stats: { crewMax: 5, cargoKg: 240000, escorts: 0, passengers: PAX.length },
};

export default TRANSPORT;
