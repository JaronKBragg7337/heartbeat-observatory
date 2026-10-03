// Ground-level look, before | after. Dev servers: "after" = this worktree (PORT=8378 node server.js), "before" = the live tree (PORT=8379 node server.js in heartbeat-observatory/games/the-cosmos).
//   node ground.mjs  (from this folder)   -> ground-{after,before}-*.jpg
import { launch } from '../../2026-10-01/shot.mjs';
import path from 'path'; import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url));
const W = Number(process.env.SHOT_W || 1000), H = Number(process.env.SHOT_H || 560);
for (const [tag, port] of (process.env.ONLY ? [[process.env.ONLY, process.env.ONLY === 'after' ? 8378 : 8379]] : [['after', 8378], ['before', 8379]])) {
  const h = await launch({ w: W, h: H, query: '?dev=1&solo=1&opening=off&tier=' + (process.env.TIER || 'low'), port });
  const page = h.page, shot = async (n) => { await page.screenshot({ path: path.join(here, `ground-${tag}-${n}.jpg`), type: 'jpeg', quality: 88, timeout: 180000 }); console.log('shot', tag, n); };
  await page.waitForTimeout(9000);
  await page.evaluate(() => { const c = cosmos; if (c.engine.graphics) c.engine.graphics.checked = 1e6; window.ff = (sec, dt = 0.05) => { const r = c.engine.renderer, save = r.render; r.render = () => {}; let t = 0; try { while (t < sec) { c.step(dt); t += dt; } } finally { r.render = save; } return t; }; });
  const marsAt = (x, z, yaw, pitch) => page.evaluate(([x, z, yaw, pitch]) => { const c = cosmos, w = c.walker, p = c.port.site.toWorld(x, 0.3, z); c.ship.aboard = false; w.worldPos.x = p.x; w.worldPos.y = p.y; w.worldPos.z = p.z; w.velocity = { x: 0, y: 0, z: 0 }; w.yaw = yaw; w.pitch = pitch; for (let i = 0; i < 30; i++) c.step(1 / 30); }, [x, z, yaw, pitch]);
  await marsAt(200, 250, 1.2, -0.38); await page.evaluate(() => ff(3)); await shot('mars-ground');
  // walk forward 14 m to leave prints, then turn round and look at them
  await page.evaluate(() => { cosmos.walker.pitch = -0.1; }); await page.keyboard.down('KeyW'); await page.evaluate(() => ff(11, 1 / 30)); await page.keyboard.up('KeyW');
  await page.evaluate(() => { const w = cosmos.walker; w.yaw += Math.PI; w.pitch = -0.5; ff(1); }); await shot('mars-prints');
  await page.evaluate(() => { cosmos.view.mode = 'third'; cosmos.walker.pitch = -0.15; ff(1.5); }); await shot('mars-third');
  await page.evaluate(() => { cosmos.view.mode = 'first'; });
  await marsAt(200, 250, 2.4, -0.9); await page.evaluate(() => ff(2)); await shot('mars-closeup');
  // Phobos / Deimos
  for (const moon of ['phobos', 'deimos']) {
    await page.evaluate((moon) => { const c = cosmos, sp = c.space; if (sp.frameId !== moon) sp.debugLand(moon); for (let i = 0; i < 20; i++) c.step(1 / 30); }, moon);
    await page.evaluate((moon) => { const c = cosmos, sp = c.space, mw = sp.worlds.get(moon), b = mw.body, pi = b.padInfo, w = c.walker, sh = c.ship; sh.aboard = false; if (sh.seat) sh.stations.stand(); c.freeCam.off();
      const e = 24, n = -10, x = pi.point.x + pi.east.x * e + pi.north.x * n, y = pi.point.y + pi.east.y * e + pi.north.y * n, z = pi.point.z + pi.east.z * e + pi.north.z * n, l = Math.hypot(x, y, z), R = b.surfaceRadius(x / l, y / l, z / l);
      w.worldPos.x = x / l * (R + 0.03); w.worldPos.y = y / l * (R + 0.03); w.worldPos.z = z / l * (R + 0.03); w.velocity = { x: 0, y: 0, z: 0 }; w.yaw = 0.8; w.pitch = -0.4; w.grounded = true; mw.force(w.worldPos); for (let i = 0; i < 20; i++) c.step(1 / 30); }, moon);
    await page.evaluate(() => ff(3)); await shot(moon + '-ground');
    await page.keyboard.down('KeyW'); await page.evaluate(() => ff(9, 1 / 30)); await page.keyboard.up('KeyW');
    await page.evaluate(() => { const w = cosmos.walker; w.yaw += Math.PI; w.pitch = -0.5; ff(1); }); await shot(moon + '-prints');
  }
  await h.browser.close();
}
