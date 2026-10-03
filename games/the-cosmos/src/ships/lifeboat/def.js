// ============================================================================
// ships/lifeboat/def.js - the lifeboat (the starter ship) as one entry in the fleet (SH14). See spec.js. Not for sale at the yard: a pilot is
// given one, and may repair and earn with it. `stats.valueCredits` is what the yard would value it at; there is no `priceCredits`.
// `looks` is one paint per start world; the renderer reads opts.world (default mars). Faction livery can replace the paint later.
// ============================================================================

import { LIFEBOAT_TYPE, LIFEBOAT_CLASS, LAYOUT, GEAR, GUNS, PHYS, RAMPS, SEATS, PANELS, AVATAR, HULL, deckName } from './spec.js';
import { LIFEBOAT_LOOKS } from './looks.js';
import { CREW_POSTS } from '../../crew/crewSpec.js';

export const LIFEBOAT = {
  order: 45,
  role: 'other',
  blurb: 'An 11 metre lifeboat: a three-seat flight deck, a cabin with benches and survival gear, a side hatch and a rear ramp.',
  description: 'The Skiff is a small, worn, honest working boat: eleven metres, under seven tonnes, a canopy flight deck with three stations, a cabin with bench seats, a bunk and a locker of survival gear, a vestibule with a side hatch, and a rear bay with a ramp. Each world paints its own. Nobody buys one at the yard: a pilot is handed one, then makes it earn.',
  // thumbnail: 'assets/ships/lifeboat.webp' (the mars paint; the other worlds' are lifeboat-<world>.webp)
  thumbnail: 'assets/ships/lifeboat.webp',
  type: LIFEBOAT_TYPE,
  class: LIFEBOAT_CLASS,
  name: 'Skiff',
  registryId: 'COS-MARS-VEH-0484',
  layout: LAYOUT, gear: GEAR, guns: GUNS, phys: PHYS, ramps: RAMPS, seats: SEATS, panels: PANELS, avatar: AVATAR,
  gunSeats: {},
  seatGun: { captain: 'main' },
  crewPosts: CREW_POSTS.filter((p) => ['pilot', 'captain', 'nav'].includes(p.id)),
  looks: LIFEBOAT_LOOKS,
  hull: {
    z0: HULL.z0, z1: HULL.z1, underside: HULL.underside, extraPoints: [],
    combat: { centre: { x: 0, y: 0.8, z: 0 }, radius: 6 },
    push: { topY: 3.05, zNose: -5.5, zTail: 5.6, hwAt: (z) => HULL.halfWidth(z), rampGap: { z: 5.4, hw: 1.3 }, hatch: { x: 2.5, z: -0.9, r: 0.8 } },
  },
  roles: { bridge: 'cockpit', cargo: 'hold', engineering: 'stores', airlock: 'lock', corridor: 'cabin' },
  dock: {
    rampFoot: { x: 0, y: 0, z: 8.4 },
    boardSw: { x: 0, y: 0, z: 4.6, yaw: 0 },
    leaveLocal: { x: -4.5, y: -1.2, z: 6 },
    clearRampZ: 7,
    bounds: { x: 6, z: 9, y0: -2, y1: 5 },
    remote: { x: 0, z: 7.4, r: 8 },
    spawnY: 1.8,
  },
  features: { holo: false, practiceTargets: false, personalDrones: false, ventralGlass: false },
  hudName: 'Skiff',
  deckName,
  envelope: { width: 5.4, height: 5.7, depth: 12.7 },
  stats: { crewMax: 3, cargoKg: 800, escorts: 0, valueCredits: 1800 },
};

export default LIFEBOAT;
