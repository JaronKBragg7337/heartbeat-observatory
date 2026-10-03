// Shared harness for the 2026-10-03 polish shots. Dev server: PORT=8451 node server.js (from games/the-cosmos).
import { launch } from '../../2026-10-01/shot.mjs';
import path from 'path';
import { fileURLToPath } from 'url';
export const here = path.dirname(fileURLToPath(import.meta.url));
export const PORT = Number(process.env.PHOBOS2_PORT || 8471);
export async function open(opts, prefix) {
  const h = await launch({ w: opts.w, h: opts.h, query: opts.query || '', port: PORT });
  h.shot = async (name) => { await h.page.screenshot({ path: path.join(here, `${prefix}-${name}.jpg`), type: 'jpeg', quality: 86, timeout: 180000 }); console.log('shot', prefix, name); };
  await h.page.waitForTimeout(opts.wait ?? 8000);
  await h.page.evaluate(() => {
    const c = window.cosmos;
    if (c.engine.graphics) c.engine.graphics.checked = 1e6;   // headless frames under load can look blank: do not let the health check fall back to safe mode
    window.ff = (sec, dt = 0.05) => { const r = c.engine.renderer, save = r.render; r.render = () => {}; let t = 0; try { while (t < sec) { c.step(dt); t += dt; } } finally { r.render = save; } return t; };
    window.ext = (off, look) => { const f = c.ship.flight; const e = f.toWorld({ x: off[0], y: off[1], z: off[2] }, {}), t = f.toWorld({ x: look[0], y: look[1], z: look[2] }, {}); c.freeCam.set(e, t); for (let i = 0; i < 8; i++) c.step(1 / 60); };
  });
  return h;
}
export async function landPhobos(h) {
  return h.page.evaluate(() => { const c = window.cosmos; const l = c.space.debugLand('phobos'); for (let i = 0; i < 20; i++) c.step(1 / 30); return l; });
}
/** On foot at east/north metres from the Phobos pad. */
export async function stand(h, e, n, yaw = 0, pitch = 0) {
  return h.page.evaluate(([e, n, yaw, pitch]) => {
    const c = window.cosmos, sp = c.space;
    if (sp.frameId !== 'phobos') sp.debugLand('phobos');
    const sh = c.ship; sh.aboard = false; if (sh.seat) sh.stations.stand();
    c.freeCam.off();
    const mw = sp.worlds.get('phobos'), b = mw.body, pi = b.padInfo;
    const x = pi.point.x + pi.east.x * e + pi.north.x * n, y = pi.point.y + pi.east.y * e + pi.north.y * n, z = pi.point.z + pi.east.z * e + pi.north.z * n;
    const l = Math.hypot(x, y, z), R = b.surfaceRadius(x / l, y / l, z / l), w = c.walker;
    w.worldPos.x = x / l * (R + 0.03); w.worldPos.y = y / l * (R + 0.03); w.worldPos.z = z / l * (R + 0.03);
    w.velocity = { x: 0, y: 0, z: 0 }; w.yaw = yaw; w.pitch = pitch; w.grounded = true;
    mw.force(w.worldPos);
    for (let i = 0; i < 10; i++) c.step(1 / 30);
    return { grounded: w.grounded, rock: b.rockRelief(x / l, y / l, z / l) };
  }, [e, n, yaw, pitch]);
}
export async function lookAt(h, point, eastM, northM, pitch, upM = 0) {
  return h.page.evaluate(([px, py, pz, eastM, northM, pitch]) => {
    const c = window.cosmos, sp = c.space, mw = sp.worlds.get('phobos'), b = mw.body, w = c.walker;
    const sh = c.ship; sh.aboard = false; if (sh.seat) sh.stations.stand(); c.freeCam.off();
    const pi = b.padInfo;
    const x = px + pi.east.x * eastM + pi.north.x * northM, y = py + pi.east.y * eastM + pi.north.y * northM, z = pz + pi.east.z * eastM + pi.north.z * northM;
    const l = Math.hypot(x, y, z), R = b.surfaceRadius(x / l, y / l, z / l);
    w.worldPos.x = x / l * (R + 0.03); w.worldPos.y = y / l * (R + 0.03); w.worldPos.z = z / l * (R + 0.03);
    w.velocity = { x: 0, y: 0, z: 0 }; w.grounded = true; mw.force(w.worldPos);
    for (let i = 0; i < 4; i++) c.step(1 / 30);
    const f = w.updateFrame(), d = { x: px - w.worldPos.x, y: py - w.worldPos.y, z: pz - w.worldPos.z };
    w.yaw = Math.atan2(d.x * f.east.x + d.y * f.east.y + d.z * f.east.z, d.x * f.north.x + d.y * f.north.y + d.z * f.north.z);
    w.pitch = pitch;
    for (let i = 0; i < 8; i++) c.step(1 / 30);
    return { dist: Math.hypot(d.x, d.y, d.z) };
  }, [point.x, point.y, point.z, eastM, northM, pitch]);
}

/** Stand `dist` m from a world point on Phobos, at `sunAng` radians around the horizon from the sunward direction (0 = sun behind you, lighting the face you look at), and look at it. */
export async function lookSun(h, point, dist, sunAng, pitch = 0.05, hide = true) {
  return h.page.evaluate(async ([px, py, pz, dist, sunAng, pitch, hide]) => {
    const c = window.cosmos, sp = c.space, mw = sp.worlds.get('phobos'), b = mw.body, w = c.walker;
    const sunDir = (await import('/src/space/spaceSpec.js')).sunDirection();
    const sh = c.ship; sh.aboard = false; if (sh.seat) sh.stations.stand(); c.freeCam.off();
    const pl = Math.hypot(px, py, pz), up = { x: px / pl, y: py / pl, z: pz / pl }, s = sunDir, d = s.x * up.x + s.y * up.y + s.z * up.z;
    let hx = s.x - up.x * d, hy = s.y - up.y * d, hz = s.z - up.z * d; const hl = Math.hypot(hx, hy, hz) || 1; hx /= hl; hy /= hl; hz /= hl;
    // rotate the sunward horizontal about the up axis by sunAng
    const cx = up.y * hz - up.z * hy, cy = up.z * hx - up.x * hz, cz = up.x * hy - up.y * hx, ca = Math.cos(sunAng), sa = Math.sin(sunAng);
    const ox = hx * ca + cx * sa, oy = hy * ca + cy * sa, oz = hz * ca + cz * sa;
    const x = px + ox * dist, y = py + oy * dist, z = pz + oz * dist, l = Math.hypot(x, y, z), R = b.surfaceRadius(x / l, y / l, z / l);
    w.worldPos.x = x / l * (R + 0.03); w.worldPos.y = y / l * (R + 0.03); w.worldPos.z = z / l * (R + 0.03);
    w.velocity = { x: 0, y: 0, z: 0 }; w.grounded = true; mw.force(w.worldPos);
    for (let i = 0; i < 4; i++) c.step(1 / 30);
    const f = w.updateFrame(), dd = { x: px - w.worldPos.x, y: py - w.worldPos.y, z: pz - w.worldPos.z };
    w.yaw = Math.atan2(dd.x * f.east.x + dd.y * f.east.y + dd.z * f.east.z, dd.x * f.north.x + dd.y * f.north.y + dd.z * f.north.z);
    w.pitch = pitch;
    if (hide) for (const e of document.body.children) if (e.tagName !== 'CANVAS' && e.id !== 'game-canvas' && e.tagName !== 'SCRIPT') e.style.visibility = 'hidden';
    for (let i = 0; i < 8; i++) c.step(1 / 30);
    return { sunElevDeg: Math.asin(d) * 180 / Math.PI };
  }, [point.x, point.y, point.z, dist, sunAng, pitch, hide]);
}
