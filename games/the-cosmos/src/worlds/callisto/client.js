// ============================================================================
// worlds/callisto/client.js — Callisto's dressing (docs/ADD-A-WORLD.md, "Dressing"): the Valhalla camp and the prospectors' camp
// (camp.js), Jupiter in the sky (jupiterSky.js), and the walker kept out of the solid things. Client only: the server reads def.js
// and layout.js. The people build when the Loft library is ready.
// ============================================================================
import { buildCamp } from './camp.js';
import { acquireJupiter } from './jupiterSky.js';
import { buildCallistoYards } from './yards.js';              // the two sides seen at work (Mystara's relay stand at the camp, the Unbound's freight pad at the prospectors' camp)

export default {
  dress(world, { engine }) {
    const space = world.space;
    const camp = buildCamp({ engine, world, space, tier: world.tier });
    const jupiter = acquireJupiter({ engine, space });       // one Jupiter, shown while the ship is in Callisto's frame
    let yards = [null, null];
    try { yards = buildCallistoYards({ engine, world, space, camp }); } catch (e) { console.error('Callisto yards failed', e); }
    return {
      camp, people: camp.people, jupiter, yard: yards[0], yard2: yards[1],
      update(dt, focus) {
        for (const y of yards) if (y) y.update(dt, focus || space.walker.worldPos);
        if (space.peopleLib && !camp.people.built) camp.people.build().catch((e) => console.error('Callisto people failed', e));
        camp.update(dt, space.walker.worldPos, space.ship.aboard ? null : space.walker);
      },
      dispose() { for (const y of yards) if (y) y.dispose(); jupiter.release(); camp.dispose(); },
    };
  },
};
