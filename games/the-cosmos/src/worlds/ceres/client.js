// ============================================================================
// worlds/ceres/client.js — the client dressing of Ceres (docs/ADD-A-WORLD.md, "Dressing"): OCCATOR WORKS, the Industrial Miners' station,
// drawn with the Meridian's own kit (outpost.js) and its people (people.js). Called once when the world is built (the jump spool builds it, so
// the cost hides in the 20 seconds), ticked while the camera is within four radii. The server never loads this file: what it must know (where
// things stand, what is for sale) is layout.js and trade.js.
// ============================================================================
import { buildOutpost } from './outpost.js';
import { buildBoard } from '../../missions/boardProp.js';       // MISSIONS: the flight office's notice board
import { DESKS } from '../../missions/desk.js';
import { CeresActivity } from './activity.js';                 // the two sides at work: people, ships, stockpile, standing board (decoration only)

function dress(world, { engine }) {
  const space = world.space;
  const out = buildOutpost({ engine, world, space, tier: world.tier });
  if (out.root) out.root.add(buildBoard({ ...DESKS.ceres.board, title: 'JOBS', sub: 'HANDS FOR HIRE · ASK THE FLIGHT OFFICE', seed: 23 }));
  let activity = null;
  try { if (out.root) activity = new CeresActivity({ engine, world, space, outpost: out, tier: world.tier }); } catch (e) { console.error('Ceres activity failed', e); }
  return {
    outpost: out, people: out.people, activity,
    update(dt, focus) {
      if (space.peopleLib && !out.people.built) out.people.build().catch((e) => console.error('Ceres people failed', e));
      out.update(dt, space.walker.worldPos, space.ship.aboard ? null : space.walker);
      if (activity) activity.update(dt, focus || space.walker.worldPos);
    },
    dispose() { if (activity) activity.dispose(); out.dispose(); },
  };
}

export default { dress };
