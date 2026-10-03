// ============================================================================
// worlds/ceres/client.js — the client dressing of Ceres (docs/ADD-A-WORLD.md, "Dressing"): OCCATOR WORKS, the Industrial Miners' station,
// drawn with the Meridian's own kit (outpost.js) and its people (people.js). Called once when the world is built (the jump spool builds it, so
// the cost hides in the 20 seconds), ticked while the camera is within four radii. The server never loads this file: what it must know (where
// things stand, what is for sale) is layout.js and trade.js.
// ============================================================================
import { buildOutpost } from './outpost.js';

function dress(world, { engine }) {
  const space = world.space;
  const out = buildOutpost({ engine, world, space, tier: world.tier });
  return {
    outpost: out, people: out.people,
    update(dt) {
      if (space.peopleLib && !out.people.built) out.people.build().catch((e) => console.error('Ceres people failed', e));
      out.update(dt, space.walker.worldPos, space.ship.aboard ? null : space.walker);
    },
    dispose() { out.dispose(); },
  };
}

export default { dress };
