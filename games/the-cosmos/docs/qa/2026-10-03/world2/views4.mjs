import { open, landOccator, cam } from './lib.mjs';
const h = await open({ wait: 5000 }, 'v4');
await landOccator(h);
await h.page.evaluate(() => { window.cosmos.ship.aboard = false; window.hideUI(); });
const t0 = Date.now();
const orbit = async (name, altM, sideE, sideN, lookAtPad = true) => {
  await h.page.evaluate(([altM, sideE, sideN]) => {
    const c = window.cosmos, mw = c.space.worlds.get('ceres'), b = mw.body, pi = b.padInfo, R = b.radiusMean;
    const e = { x: pi.up.x * (R + altM) + pi.east.x * sideE + pi.north.x * sideN, y: pi.up.y * (R + altM) + pi.east.y * sideE + pi.north.y * sideN, z: pi.up.z * (R + altM) + pi.east.z * sideE + pi.north.z * sideN };
    c.freeCam.set(e, pi.point); mw.force(e);
    const w = c.walker; w.worldPos.x = e.x; w.worldPos.y = e.y; w.worldPos.z = e.z;
    window.quiet(40);
  }, [altM, sideE, sideN]);
  await h.shot(name); console.log(name, Date.now() - t0);
};
await orbit('far-globe', 2.2e7, 8e6, 0);
await orbit('globe-3000km', 3.2e6, 2e6, 0);
await orbit('high-300km', 3.0e5, 2e5, 0);
await orbit('mid-20km', 2.0e4, 1.5e4, 0);
await cam(h, [-5200, 500, 700], [-3300, -3000, -300]);
await h.shot('cut-from-rim');
await cam(h, [-3300, -3000, 3500], [-3300, -3000, 0]);
await h.shot('cut-from-above');
await h.browser.close();
