// ============================================================================
// ships/bulker/def.js - the Long Haul-class bulk carrier as one entry in the fleet (SH15). See spec.js. Not for sale.
// ============================================================================

import { BULKER_TYPE, BULKER_CLASS, LAYOUT, GEAR, GUNS, PHYS, RAMPS, SEATS, PANELS, AVATAR, HULL, deckName } from './spec.js';
import { CREW_POSTS } from '../../crew/crewSpec.js';
import { RAIDER_CREW_POSTS } from '../raider/crew.js';

export const BULKER = {
  order: 62,
  role: 'hauler',
  blurb: 'A 240 metre ore and water train: ten pods and four tanks on a spine girder, six engines, a walkable crew block at the nose.',
  description: 'The Long Haul is a 240 metre bulk carrier of the Mars Line: a crew block at the nose (flight deck, quarters, mess, machinery, boarding vestibule, cargo control and a hold bay with a ramp), a long spine girder carrying ten ore pods and four tank spheres, and six big engines at the tail. It is one of the huge ships that fly beside a passenger transport. It is not sold at the yard.',
  thumbnail: 'assets/ships/bulker.webp',
  type: BULKER_TYPE,
  class: BULKER_CLASS,
  name: 'Long Haul',
  registryId: 'COS-MARS-VEH-0482',
  layout: LAYOUT, gear: GEAR, guns: GUNS, phys: PHYS, ramps: RAMPS, seats: SEATS, panels: PANELS, avatar: AVATAR,
  gunSeats: {},
  seatGun: { captain: 'main' },
  crewPosts: [...CREW_POSTS.filter((p) => ['pilot', 'captain', 'nav', 'comms'].includes(p.id)), RAIDER_CREW_POSTS.find((p) => p.id === 'engineer')],
  hull: {
    z0: HULL.z0, z1: HULL.z1, underside: HULL.underside, extraPoints: [],
    combat: { centre: { x: 0, y: 3, z: 0 }, radius: 125 },
    push: { topY: 6.8, zNose: -120, zTail: 120, hwAt: (z) => HULL.halfWidth(z), rampGap: { z: -82, hw: 3.2 }, hatch: { x: 8.4, z: -99.4, r: 1.2 } },
  },
  roles: { bridge: 'bridge', cargo: 'bay', engineering: 'machinery', airlock: 'gate', corridor: 'passage' },
  dock: {
    rampFoot: { x: 0, y: 0, z: -72 },
    boardSw: { x: 0, y: 0, z: -86, yaw: 0 },
    leaveLocal: { x: -14, y: -3, z: -90 },
    clearRampZ: -76,
    bounds: { x: 22, z: 124, y0: -5, y1: 16 },
    remote: { x: 0, z: -78, r: 30 },
    spawnY: 3.8,
  },
  features: { holo: false, practiceTargets: false, personalDrones: false, ventralGlass: false },
  hudName: 'Long Haul',
  deckName,
  envelope: { width: 31.4, height: 14, depth: 248.2 },
  stats: { crewMax: 5, cargoKg: 18000000, escorts: 0 },
};

export default BULKER;
