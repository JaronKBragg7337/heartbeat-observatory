// ============================================================================
// ships/escort/def.js - the Line Marshal-class escort cutter as one entry in the fleet (SH15). See spec.js. Not for sale.
// ============================================================================

import { ESCORT_TYPE, ESCORT_CLASS, LAYOUT, GEAR, GUNS, PHYS, RAMPS, SEATS, PANELS, AVATAR, HULL, deckName } from './spec.js';
import { CREW_POSTS } from '../../crew/crewSpec.js';
import { RAIDER_CREW_POSTS } from '../raider/crew.js';

export const ESCORT = {
  order: 63,
  role: 'warship',
  blurb: 'A 44 metre escort cutter: swept wings, a chin cannon pair, an armoury and a rear bay with a ramp. Quick and tidy.',
  description: 'The Line Marshal is the neutral Mars Line\'s escort: a 44 metre swept-wing cutter that flies beside the big transports. A flight deck with five stations, quarters, a mess, an armoury, a boarding vestibule, heads and stores, machinery, and a rear bay with a ramp. Fast, lightly armed with a chin pair, and painted to be seen. It is not sold at the yard.',
  thumbnail: 'assets/ships/escort.webp',
  type: ESCORT_TYPE,
  class: ESCORT_CLASS,
  name: 'Line Marshal',
  registryId: 'COS-MARS-VEH-0483',
  layout: LAYOUT, gear: GEAR, guns: GUNS, phys: PHYS, ramps: RAMPS, seats: SEATS, panels: PANELS, avatar: AVATAR,
  gunSeats: {},
  seatGun: { captain: 'main' },
  crewPosts: [...CREW_POSTS.filter((p) => ['pilot', 'captain', 'nav', 'comms'].includes(p.id)), RAIDER_CREW_POSTS.find((p) => p.id === 'engineer')],
  hull: {
    z0: HULL.z0, z1: HULL.z1, underside: HULL.underside, extraPoints: [{ x: -15, y: -0.6, z: 14 }, { x: 15, y: -0.6, z: 14 }],
    combat: { centre: { x: 0, y: 0.8, z: 0 }, radius: 20 },
    push: { topY: 3.9, zNose: -22, zTail: 22, hwAt: (z) => HULL.halfWidth(z), rampGap: { z: 19.6, hw: 1.6 }, hatch: { x: 3.7, z: -4.0, r: 1.1 } },
  },
  roles: { bridge: 'bridge', cargo: 'hold', engineering: 'engine', airlock: 'gate', corridor: 'passage' },
  dock: {
    rampFoot: { x: 0, y: 0, z: 25 },
    boardSw: { x: 0, y: 0, z: 17, yaw: 0 },
    leaveLocal: { x: -9, y: -1.2, z: 22 },
    clearRampZ: 21,
    bounds: { x: 17, z: 26, y0: -3, y1: 7 },
    remote: { x: 0, z: 22, r: 14 },
    spawnY: 2.3,
  },
  features: { holo: false, practiceTargets: false, personalDrones: false, ventralGlass: false },
  hudName: 'Line Marshal',
  deckName,
  envelope: { width: 30.3, height: 9.1, depth: 46.7 },
  stats: { crewMax: 5, cargoKg: 3000, escorts: 0 },
};

export default ESCORT;
