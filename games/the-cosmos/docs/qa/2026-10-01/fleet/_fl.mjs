import { launch } from '../shot.mjs';
import path from 'path';
import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url));
export async function boot(opts = {}) {
  const h = await launch({ w: opts.w || 900, h: opts.h || 560, query: opts.query || '?dev=1&solo=1&ship=raider&tier=high', port: opts.port || 8431 });
  h.shot = async (name) => { await h.page.screenshot({ path: path.join(here, name + '.jpg'), type: 'jpeg', quality: 86, timeout: 180000 }); console.log('shot', name); };
  await h.page.waitForTimeout(opts.wait ?? 6000);
  await h.page.evaluate(() => {
    const c = window.cosmos;
    c.engine.stop();            // stills are rendered on demand (cosmos.step), not by a free-running loop that starves the screenshot
    window.ff = (sec, dt = 0.1) => { const r = c.engine.renderer, save = r.render; r.render = () => {}; let t = 0; try { while (t < sec) { c.engine.step(dt); t += dt; } } finally { r.render = save; } return t; };
    // an outside camera at a ship-local offset, looking at a ship-local point (pauses the flight: for stills)
    window.ext = (off, look) => { const f = c.ship.flight; const e = f.toWorld({ x: off[0], y: off[1], z: off[2] }, {}), t = f.toWorld({ x: look[0], y: look[1], z: look[2] }, {}); c.freeCam.set(e, t); for (let i = 0; i < 6; i++) c.step(1 / 60); };
    window.extOff = () => c.freeCam.off();
  });
  return h;
}
