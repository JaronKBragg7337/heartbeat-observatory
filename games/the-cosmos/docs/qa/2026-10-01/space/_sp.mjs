import { launch } from '../shot.mjs';
import path from 'path';
import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url));
export async function boot(opts = {}) {
  const h = await launch({ w: opts.w || 750, h: opts.h || 470, query: opts.query || '?tier=low', port: 8421 });
  h.shot = async (name) => { await h.page.screenshot({ path: path.join(here, name + '.jpg'), type: 'jpeg', quality: 84 }); console.log('shot', name); };
  await h.page.waitForTimeout(opts.wait ?? 6000);
  await h.page.evaluate(() => {
    const c = window.cosmos;
    window.ff = (sec, dt = 0.1, until = null) => { const r = c.engine.renderer, save = r.render; r.render = () => {}; let t = 0; try { while (t < sec) { c.engine.step(dt); t += dt; if (until && until()) break; } } finally { r.render = save; } return t; };
    window.st = () => { const s = c.space, f = c.ship.flight, t = s.trip; return { frame: s.frameId, phase: t && t.phase, stage: t && t.progress.stage, alt: Math.round(f.agl), v: +f.speed.toFixed(1), vs: +f.verticalSpeed.toFixed(2), landed: f.landed, dist: t && Math.round(t.progress.distM), eta: t && Math.round(t.progress.etaS), warp: t && t.warp, hull: Math.round(f.hull) }; };
    // an outside camera at a ship-local offset, looking at a ship-local point (pauses the flight: for stills)
    window.ext = (off, look) => { const f = c.ship.flight; const e = f.toWorld({ x: off[0], y: off[1], z: off[2] }, {}), t = f.toWorld({ x: look[0], y: look[1], z: look[2] }, {}); c.freeCam.set(e, t); for (let i = 0; i < 6; i++) c.step(1 / 60); };
    window.extOff = () => c.freeCam.off();
  });
  return h;
}
export const S = (h) => h.page.evaluate(() => window.st());
export const FF = (h, sec, dt = 0.1, untilSrc = null) => h.page.evaluate(([sec, dt, u]) => window.ff(sec, dt, u ? new Function('return ' + u)() : null), [sec, dt, untilSrc]);
// put the player on foot on the moon at (east, north) metres from the pad centre, looking along a compass yaw, pitch up
export async function stand(h, e, n, yaw = 0, pitch = 0, id = 'phobos') {
  return h.page.evaluate(([e, n, yaw, pitch, id]) => {
    const c = window.cosmos, sp = c.space; if (sp.frameId !== id) sp.debugLand(id);
    const sh = c.ship; sh.aboard = false; if (sh.seat) sh.stations.stand();
    const mw = sp.worlds.get(id), b = mw.body, pi = b.padInfo;
    const x = pi.point.x + pi.east.x * e + pi.north.x * n, y = pi.point.y + pi.east.y * e + pi.north.y * n, z = pi.point.z + pi.east.z * e + pi.north.z * n;
    const l = Math.hypot(x, y, z), R = b.surfaceRadius(x / l, y / l, z / l);
    const w = c.walker; w.worldPos.x = x / l * (R + 0.03); w.worldPos.y = y / l * (R + 0.03); w.worldPos.z = z / l * (R + 0.03);
    w.velocity = { x: 0, y: 0, z: 0 }; w.yaw = yaw; w.pitch = pitch; w.grounded = true;
    mw.force(w.worldPos);
    for (let i = 0; i < 8; i++) c.step(1 / 30);
    return { grounded: w.grounded };
  }, [e, n, yaw, pitch, id]);
}
