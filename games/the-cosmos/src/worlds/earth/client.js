// ============================================================================
// worlds/earth/client.js - Earth's dressing (docs/ADD-A-WORLD.md, "Dressing"): the sea, the globe seen from the sky, the sky itself and its clouds (sea.js, globe.js),
// and the Skyward Launch Complex (complex.js) with the walker kept out of its solid things. Client only: the server reads def.js and layout.js.
// ============================================================================
import { buildSea } from './sea.js';
import { buildGlobe } from './globe.js';
import { buildComplex } from './complex.js';
import { buildLife } from './life.js';
import { MoonPeople } from '../moon/people.js';
import { layoutOf } from './layout.js';
import { frameToOutpost, outpostToFrame, pushOut } from '../moon/place.js';

export default {
  dress(world, { engine }) {
    const space = world.space, tier = world.tier, pi = world.body.padInfo, layout = layoutOf();
    const globe = buildGlobe({ engine, world, tier, space });
    const sea = buildSea({ engine, world, tier });
    const complex = buildComplex({ engine, world, space, tier });
    const life = buildLife({ engine, world, complex, tier });
    // the two people (cast.js): the Moon's person class reads the layout it is given, here Earth's, and builds them from the same Loft library when the world is built
    const people = new MoonPeople({ root: complex.root || engine.scene, people: space.peopleLib || null, space, pi, worldId: 'earth' });
    people.layout = layout;
    let t = 0;
    return {
      complex, life, sea, globe, people,
      update(dt, focus) {
        t += dt;
        globe.update(dt, focus); sea.update(dt, focus);
        complex.tick(dt, t);
        if (space.peopleLib && !people.built) people.build().catch((e) => console.error('Earth people failed', e));
        if (space.walker) people.tick(dt, space.walker.worldPos);
        if (space && space.walker && !space.ship.aboard) {
          const walker = space.walker, p = frameToOutpost(pi, walker.worldPos);
          if (Math.abs(p.x) < 260 && Math.abs(p.z) < 260 && pushOut(layout, p)) {
            const w = outpostToFrame(pi, p.x, p.y, p.z);
            walker.worldPos.x = w.x; walker.worldPos.y = w.y; walker.worldPos.z = w.z;
            if (walker.velocity) { walker.velocity.x *= 0.2; walker.velocity.y *= 0.2; walker.velocity.z *= 0.2; }
          }
        }
      },
      dispose() { life.dispose(); complex.dispose(); sea.dispose(); globe.dispose(); },
    };
  },
};
