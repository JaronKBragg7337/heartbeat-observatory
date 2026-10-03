// Shared harness for the world 2 (Occator) shots. Dev server: PORT=8481 node server.js (from games/the-cosmos). Chromium + SwiftShader.
import { launch } from '../../2026-10-01/shot.mjs';
import path from 'path';
import { fileURLToPath } from 'url';
export const here = path.dirname(fileURLToPath(import.meta.url));
export const PORT = Number(process.env.WORLD2_PORT || 8481);
export async function open(opts = {}, prefix = 'w2') {
  const h = await launch({ w: opts.w || 750, h: opts.h || 470, query: opts.query ?? ('?dev=1&solo=1&opening=off&' + (opts.w && opts.w < 500 ? 'tier=low&depth=16' : 'tier=high')), port: PORT });
  h.shot = async (name) => { await h.page.screenshot({ path: path.join(here, `${prefix}-${name}.jpg`), type: 'jpeg', quality: 86, timeout: 240000 }); console.log('shot', prefix, name); };
  await h.page.waitForTimeout(opts.wait ?? 6000);
  await h.page.evaluate(() => {
    const c = window.cosmos;
    if (c.engine.graphics) c.engine.graphics.checked = 1e6;
    window.quiet = (frames) => { const r = c.engine.renderer, save = r.render; r.render = () => {}; try { for (let i = 0; i < frames; i++) c.step(1 / 30); } finally { r.render = save; } c.step(1 / 60); };
    window.hideUI = () => { for (const e of document.body.children) if (e.tagName !== 'CANVAS' && e.id !== 'game-canvas' && e.tagName !== 'SCRIPT') e.style.visibility = 'hidden'; };
  });
  return h;
}
/** Land the ship on Occator's main pad (debug: skips the flight). Returns the pad record. */
export async function landOccator(h) {
  return h.page.evaluate(() => { const c = window.cosmos; const l = c.space.debugLand('ceres'); for (let i = 0; i < 20; i++) c.step(1 / 30); return l; });
}
/** Put the camera at [east, north, up] metres from the main pad point; look at [east, north, up]. `ground`: the up values are over the ground there. */
export async function cam(h, eye, at, { ground = false, settle = 30 } = {}) {
  return h.page.evaluate(([eye, at, ground, settle]) => {
    const c = window.cosmos, sp = c.space, mw = sp.worlds.get('ceres'), b = mw.body, pi = b.padInfo;
    const pt = (e, n, u) => { let x = pi.point.x + pi.east.x * e + pi.north.x * n, y = pi.point.y + pi.east.y * e + pi.north.y * n, z = pi.point.z + pi.east.z * e + pi.north.z * n;
      const l = Math.hypot(x, y, z); if (ground) { const R = b.surfaceRadius(x / l, y / l, z / l); return { x: x / l * (R + u), y: y / l * (R + u), z: z / l * (R + u) }; }
      return { x: x + pi.up.x * u, y: y + pi.up.y * u, z: z + pi.up.z * u }; };
    c.engine.graphics && (c.engine.graphics.checked = 1e6);
    const E = pt(...eye); c.freeCam.set(E, pt(...at)); mw.force(E);
    const w = c.walker; w.worldPos.x = E.x; w.worldPos.y = E.y; w.worldPos.z = E.z; w.velocity = { x: 0, y: 0, z: 0 };
    window.quiet(settle);
    return { eye: E };
  }, [eye, at, ground, settle]);
}
