const q = process.env.QUERY || '';
const W = Number(process.env.W || 750), Hh = Number(process.env.H || 470);
const pre = process.env.PRE || 'w';
export default async ({ launch }) => {
  const h = await launch({ w: W, h: Hh, query: q });
  const { page, shot, browser } = h;
  await page.evaluate(() => {
    const c = window.cosmos; const T = c.port.site; window.__T = { x: -60, z: -39 };
    const site = c.port.site, w = c.walker;
    window.__stop = () => c.desktop.keys.delete('KeyW');
    const realRender = c.engine.renderer.render.bind(c.engine.renderer);
    window.__quiet = (on) => { c.engine.renderer.render = on ? () => {} : realRender; };
    window.__to = (lx, lz, run = true) => {
      window.__quiet(true);
      c.desktop.keys.add('KeyW'); if (run) c.desktop.keys.add('ShiftLeft');
      let frames = 0, ok = false;
      for (let f = 0; f < 900; f++) {
        const p = site.toLocal(w.worldPos), dx = window.__T.x + lx - p.x, dz = window.__T.z + lz - p.z;
        if (Math.hypot(dx, dz) < 0.35) { ok = true; break; }
        const fr = w.updateFrame(), wx = site.right.x * dx + site.back.x * dz, wy = site.right.y * dx + site.back.y * dz, wz = site.right.z * dx + site.back.z * dz;
        w.yaw = Math.atan2(wx * fr.east.x + wy * fr.east.y + wz * fr.east.z, wx * fr.north.x + wy * fr.north.y + wz * fr.north.z);
        c.step(1 / 60); frames++;
      }
      c.desktop.keys.delete('KeyW'); c.desktop.keys.delete('ShiftLeft');
      for (let i = 0; i < 20; i++) c.step(1 / 60);
      window.__quiet(false);
      const q2 = site.toLocal(w.worldPos);
      return { ok, frames, y: +q2.y.toFixed(2), x: +(q2.x - window.__T.x).toFixed(2), z: +(q2.z - window.__T.z).toFixed(2), grounded: w.grounded };
    };
    window.__look = (yawOffset, pitch) => { w.pitch = pitch; w.yaw += yawOffset; for (let i = 0; i < 3; i++) c.step(1 / 60); };
    const p0 = site.toWorld(-60, 0.02, -39 + 9); Object.assign(w.worldPos, p0); w.velocity = { x: 0, y: 0, z: 0 }; w.grounded = true; w.updateFrame(); c.rebuildNear(true);
  });
  const log = async (label, js) => { const r = await page.evaluate(js); console.log(label, JSON.stringify(r)); return r; };
  await log('lobby door', () => window.__to(0, 6.6, false));
  await log('face door', () => window.__to(0, 1.6, false));
  await page.evaluate(() => { window.__look(0, 0); });
  await shot(`${pre}01_lobby_toward_stair_door`);
  await log('landing 0', () => window.__to(0, -0.1));
  await log('flight A foot', () => window.__to(-0.7, -0.8));
  await page.evaluate(() => { const c = window.cosmos; c.walker.yaw = Math.PI; window.__look(0, 0.35); });
  await shot(`${pre}02_flight_A_looking_up`);
  await log('flight A mid', () => window.__to(-0.7, -2.4));
  await shot(`${pre}03_flight_A_midway`);
  let lvl = 0;
  const climb = async (n) => {
    const F = { zLow: -0.7, zHigh: -3.94 };
    await log(`L${n} A head`, `() => window.__to(-0.7, ${F.zHigh - 0.1})`.replace('() =>', '() =>'));
  };
  for (let n = 0; n < 5; n++) {
    const r = await page.evaluate((n) => {
      const out = [];
      for (const [x, z] of [[-0.7, -0.8], [-0.7, -4.04], [0, -4.5], [0.7, -3.85], [0.7, -0.6], [0, -0.1]]) { out.push(window.__to(x, z)); if (!out[out.length - 1].ok) break; }
      return out[out.length - 1];
    }, n);
    console.log('level', n, JSON.stringify(r));
    if (n === 1) { await page.evaluate(() => window.__look(0, -0.05)); await shot(`${pre}04_landing_level_2`); }
    if (n === 2) { await page.evaluate(() => { window.cosmos.walker.yaw += Math.PI; window.__look(0, 0.2); }); await shot(`${pre}05_landing_level_3_looking_down_well`); }
  }
  await log('out of the door', () => window.__to(0, 1.4, false));
  await page.evaluate(() => { window.__look(0, 0); });
  await shot(`${pre}06_stepping_into_the_cab`);
  await log('supervisor spot', () => window.__to(0, 2.2, false));
  await page.evaluate(() => { const c = window.cosmos; c.walker.yaw = 0; window.__look(0, -0.05); });
  await shot(`${pre}07_cab_south_from_the_floor`);
  await page.evaluate(() => { window.__look(Math.PI / 2, -0.05); });
  await shot(`${pre}08_cab_west`);
  await page.evaluate(() => { window.__look(Math.PI, -0.05); });
  await shot(`${pre}09_cab_east`);
  await page.evaluate(() => { window.__look(Math.PI / 2, 0.0); });
  await shot(`${pre}10_cab_north_core`);
  await browser.close();
};
