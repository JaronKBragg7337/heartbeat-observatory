// Cost of the moon ground at the phone tier (and desktop): world build, and the time each ground tier takes to rebuild under the player.
//   PHOBOS2_PORT=8472 node perf.mjs     (before)    PHOBOS2_PORT=8471 node perf.mjs     (after)
// Desktop Chromium on SwiftShader, so only the ratio between the two runs means anything; a phone is slower in both.
import { open } from './lib.mjs';
for (const tier of ['low', 'high']) {
  const h = await open({ w: 390, h: 844, query: `?dev=1&solo=1&opening=off&tier=${tier}&depth=16`, wait: 8000 }, 'perf');
  try {
    const out = await h.page.evaluate(() => {
      const c = window.cosmos, res = {};
      for (const m of ['phobos', 'deimos']) {
        c.space.debugLand(m);
        const mw = c.space.worlds.get(m), pi = mw.body.padInfo;
        const T = { far: [], mid: [], near: [] };
        for (let k = 0; k < 4; k++) {
          const f = { x: pi.point.x + pi.east.x * (k * 300) + pi.up.x * 3, y: pi.point.y + pi.east.y * (k * 300) + pi.up.y * 3, z: pi.point.z + pi.east.z * (k * 300) + pi.up.z * 3 };
          mw.force(f);
          for (const t of ['far', 'mid', 'near']) T[t].push(mw[t].lastBuildMs);
        }
        const avg = (a) => +(a.reduce((s, v) => s + v, 0) / a.length).toFixed(1);
        res[m] = { buildMs: +mw.buildMs.toFixed(0), farMs: avg(T.far), midMs: avg(T.mid), nearMs: avg(T.near), triangles: { shell: mw.shell.geometry.index ? mw.shell.geometry.index.count / 3 : 0, far: mw.far.geo.index.count / 3, mid: mw.mid.geo.index.count / 3, near: mw.near.geo.index.count / 3 } };
      }
      return res;
    });
    console.log('PERF', tier, JSON.stringify(out));
  } finally { await h.browser.close(); }
}
