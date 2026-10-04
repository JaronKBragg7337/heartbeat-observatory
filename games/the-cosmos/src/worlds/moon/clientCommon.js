// ============================================================================
// worlds/moon/clientCommon.js - the client dressing every Moon landing shares (docs/ADD-A-WORLD.md, "Dressing"): the settlement drawn by its builder, its
// people (people.js), Earth in the sky (earthSky.js), and the walker kept out of solid things. Called once when the world is built (the lane jump builds it
// behind the 20 second spool), ticked while the camera is within four radii. The server never loads this file: what it must know is layout.js and trade.js.
// ============================================================================
import * as THREE from 'three';
import { MoonPeople } from './people.js';
import { acquireEarth } from './earthSky.js';
import { layoutOf } from './layout.js';
import { frameToOutpost, outpostToFrame, pushOut } from './place.js';
import { buildSampleBeacon } from '../../space/hardware.js';

export function dressMoon(world, { engine }, build) {
  const space = world.space, pi = world.body.padInfo, layout = layoutOf(world.id);
  const out = build({ engine, world, space, tier: world.tier });
  const people = new MoonPeople({ root: out.root, people: space.peopleLib || null, space, pi, worldId: world.id });
  const earth = acquireEarth({ engine, space });       // one Earth for all three landings, shown whenever the ship is in the Moon's region
  // survey beacons on a world's marked finds (def.seams: Shackleton's ice), as Occator Works marks its ore
  const beacons = [];
  if (world.body.spec.seams) for (const sm of world.body.sampleSites) {
    const bcn = buildSampleBeacon({ low: world.tier === 'low', id: 'ice-' + sm.id });
    engine.scene.add(bcn.group);
    const l = Math.hypot(sm.point.x, sm.point.y, sm.point.z), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(sm.point.x / l, sm.point.y / l, sm.point.z / l));
    const e = engine.track({ worldPos: { x: sm.point.x, y: sm.point.y, z: sm.point.z }, object3d: bcn.group, quaternion: q, frame: world.frame });
    bcn.lamp.material.color.setHex(0x7fe3ff); bcn.halo.material.color.setHex(0x7fe3ff);
    beacons.push({ bcn, e });
  }
  let t = 0;
  return {
    outpost: out, people, earth,
    update(dt) {
      t += dt;
      if (space.peopleLib && !people.built) people.build().catch((e) => console.error('Moon people failed', e));
      out.tick(dt, t);
      const wp = space.walker.worldPos;
      people.tick(dt, wp);
      if (!space.ship.aboard) {
        const p = frameToOutpost(pi, wp);
        if (Math.abs(p.x) < 260 && Math.abs(p.z) < 260 && pushOut(layout, p)) {
          const w = outpostToFrame(pi, p.x, p.y, p.z), walker = space.walker;
          walker.worldPos.x = w.x; walker.worldPos.y = w.y; walker.worldPos.z = w.z;
          if (walker.velocity) { walker.velocity.x *= 0.2; walker.velocity.y *= 0.2; walker.velocity.z *= 0.2; }
        }
      }
    },
    dispose() { out.dispose(); earth.release(); for (const b of beacons) { engine.untrack(b.e); engine.scene.remove(b.bcn.group); } },
  };
}
