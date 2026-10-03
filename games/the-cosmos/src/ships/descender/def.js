// ============================================================================
// ships/descender/def.js - the Kestrel-class descent transport as one entry in the fleet (SH15). See spec.js. Not for sale.
// ============================================================================

import { DESCENDER_TYPE, DESCENDER_CLASS, LAYOUT, GEAR, GUNS, PHYS, RAMPS, SEATS, PANELS, AVATAR, HULL, deckName } from './spec.js';
import { CREW_POSTS } from '../../crew/crewSpec.js';
import { passengerSeatsOf } from '../_liner/pax.js';
import { RAIDER_CREW_POSTS } from '../raider/crew.js';

const PAX = passengerSeatsOf(LAYOUT);

export const DESCENDER = {
  order: 61,
  role: 'passenger',
  blurb: 'A 66 metre descent transport: two passenger cabins, a pantry, a boarding vestibule and a bay with a stern ramp.',
  description: 'The Kestrel is the neutral Mars Line\'s descent transport: a 66 metre wedge-bodied lander that carries passengers from Marineris down to the surface of another world. Two three-bank passenger cabins, a pantry and a boarding vestibule, heads and stores, machinery, and a boat bay with a stern ramp under a flight deck on the nose. It is not sold at the yard.',
  thumbnail: 'assets/ships/descender.webp',
  type: DESCENDER_TYPE,
  class: DESCENDER_CLASS,
  name: 'Kestrel',
  registryId: 'COS-MARS-VEH-0481',
  layout: LAYOUT, gear: GEAR, guns: GUNS, phys: PHYS, ramps: RAMPS, seats: SEATS, panels: PANELS, avatar: AVATAR,
  gunSeats: {},
  seatGun: { captain: 'main' },
  crewPosts: [...CREW_POSTS.filter((p) => ['pilot', 'captain', 'nav', 'comms'].includes(p.id)), RAIDER_CREW_POSTS.find((p) => p.id === 'engineer')],
  hull: {
    z0: HULL.z0, z1: HULL.z1, underside: HULL.underside, extraPoints: [],
    combat: { centre: { x: 0, y: 1, z: 0 }, radius: 30 },
    push: { topY: 5.5, zNose: -33, zTail: 33, hwAt: (z) => HULL.halfWidth(z), rampGap: { z: 30, hw: 2.4 }, hatch: { x: 10.8, z: 9.3, r: 1.2 } },
  },
  roles: { bridge: 'bridge', cargo: 'bay', engineering: 'machinery', airlock: 'gate', corridor: 'cabin_b' },
  dock: {
    rampFoot: { x: 0, y: 0, z: 38 },
    boardSw: { x: 0, y: 0, z: 27, yaw: 0 },
    leaveLocal: { x: -14, y: -3, z: 24 },
    clearRampZ: 34,
    bounds: { x: 22, z: 40, y0: -5, y1: 9 },
    remote: { x: 0, z: 36, r: 24 },
    spawnY: 3.8,
  },
  features: { holo: false, practiceTargets: false, personalDrones: false, ventralGlass: false },
  hudName: 'Kestrel',
  deckName,
  envelope: { width: 31.1, height: 14.5, depth: 68.5 },
  passengerSeats: PAX,
  stats: { crewMax: 5, cargoKg: 40000, escorts: 0, passengers: PAX.length },
};

export default DESCENDER;
