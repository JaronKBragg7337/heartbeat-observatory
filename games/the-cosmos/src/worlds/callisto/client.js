// ============================================================================
// worlds/callisto/client.js — Callisto's dressing (docs/ADD-A-WORLD.md, "Dressing"): the Valhalla camp and the prospectors' camp
// (camp.js), Jupiter in the sky (jupiterSky.js), and the walker kept out of the solid things. Client only: the server reads def.js
// and layout.js. The people build when the Loft library is ready.
// ============================================================================
import { buildCamp } from './camp.js';
import { acquireJupiter } from './jupiterSky.js';

export default {
  dress(world, { engine }) {
    const space = world.space;
    const camp = buildCamp({ engine, world, space, tier: world.tier });
    const jupiter = acquireJupiter({ engine, space });       // one Jupiter, shown while the ship is in Callisto's frame
    return {
      camp, people: camp.people, jupiter,
      update(dt) {
        if (space.peopleLib && !camp.people.built) camp.people.build().catch((e) => console.error('Callisto people failed', e));
        camp.update(dt, space.walker.worldPos, space.ship.aboard ? null : space.walker);
      },
      dispose() { jupiter.release(); camp.dispose(); },
    };
  },
};
