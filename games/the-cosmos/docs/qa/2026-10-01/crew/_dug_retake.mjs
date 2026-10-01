// Re-take of the two views the last build left unverified: the bottom of a deep dug shaft, and inside a dug tunnel, after the final lighting.
import { HELPERS } from '../_lib.mjs';
const W = Number(process.env.W || 750), H = Number(process.env.H || 470), pre = process.env.PRE || 'a';
export default async ({ launch }) => {
  const h = await launch({ w: W, h: H, query: process.env.QUERY || '' });
  const { page, shot, browser } = h;
  await page.evaluate(HELPERS);
  const made = await page.evaluate(() => {
    const c = window.cosmos; qa.setOrigin(qa.portPoint(-22, 66));
    // a shaft: overlapping 1 m bites straight down 7 m, then a wider chamber at the foot
    let n = 0;
    for (let k = 0; k < 12; k++) { const p = qa.local(0, 0, -0.4 - k * 0.6); if (c.edits.dig(p.x, p.y, p.z, 1.0)) n++; }
    for (const [e, no] of [[0.6, 0], [-0.6, 0], [0, 0.6], [0, -0.6]]) { const p = qa.local(e, no, -6.9); if (c.edits.dig(p.x, p.y, p.z, 0.9)) n++; }
    qa.flush();
    return n;
  });
  console.log('shaft bites', made);
  const where = await page.evaluate(() => {
    const c = window.cosmos, w = c.walker;
    const g = qa.surfaceAt(0, 0); const l = qa.V.len(g);
    Object.assign(w.worldPos, { x: g.x * (1 + 0.02 / l), y: g.y * (1 + 0.02 / l), z: g.z * (1 + 0.02 / l) });
    w.velocity = { x: 0, y: 0, z: 0 }; w.grounded = true; w.updateFrame(); c.rebuildNear(true);
    for (let i = 0; i < 8; i++) c.step(1 / 60);
    const f = w.updateFrame(); const d = qa.V.sub(w.worldPos, qa.O);
    return { depth: +(-qa.V.dot(d, f.up)).toFixed(2), grounded: w.grounded };
  });
  console.log('bottom', JSON.stringify(where));
  const look = async (name, yaw, pitch) => { await page.evaluate(([yaw, pitch]) => { const c = window.cosmos; c.walker.yaw = yaw; c.walker.pitch = pitch; for (let i = 0; i < 6; i++) c.step(1 / 60); }, [yaw, pitch]); await shot(pre + '_dug_' + name); };
  await look('01_shaft_bottom_looking_up', 0.3, 1.1);
  await look('02_shaft_bottom_wall_east', Math.PI / 2, 0.0);
  await look('03_shaft_bottom_wall_south', Math.PI, -0.1);
  await look('04_shaft_bottom_floor', 0.5, -0.8);
  // a tunnel out of the foot of the shaft, east, two bites high, ten long
  const tun = await page.evaluate(() => {
    const c = window.cosmos, w = c.walker, f = w.updateFrame(); const base = { ...w.worldPos };
    let made = 0;
    for (let k = 0; k < 10; k++) for (const hgt of [0.6, 1.5]) {
      const p = qa.V.add(base, qa.V.add(qa.V.mul(f.east, 1.9 + k * 0.6), qa.V.mul(f.up, hgt)));
      if (c.edits.dig(p.x, p.y, p.z, 0.75)) made++;
    }
    qa.flush(); return made;
  });
  console.log('tunnel bites', tun);
  await page.evaluate(() => { const c = window.cosmos; c.walker.yaw = Math.PI / 2; c.walker.pitch = 0; for (let i = 0; i < 6; i++) c.step(1 / 60); });
  await shot(pre + '_dug_05_foot_of_shaft_looking_into_tunnel');
  // stand inside the tunnel, three and a half metres in from the shaft (placed, then settled by the real walker physics)
  const walked = await page.evaluate(() => {
    const c = window.cosmos, w = c.walker; const f = w.updateFrame();
    const p = qa.V.add(qa.V.add(qa.O, qa.V.mul(f.up, -7.9)), qa.V.mul(f.east, 3.6));
    Object.assign(w.worldPos, p); w.velocity = { x: 0, y: 0, z: 0 }; w.grounded = false; w.updateFrame(); c.rebuildNear(true);
    for (let i = 0; i < 40; i++) c.step(1 / 60);
    w.yaw = Math.PI / 2; w.pitch = 0; for (let i = 0; i < 6; i++) c.step(1 / 60);
    const d = qa.V.sub(w.worldPos, qa.O);
    return { east: +qa.V.dot(d, f.east).toFixed(2), down: +(-qa.V.dot(d, f.up)).toFixed(2), grounded: w.grounded };
  });
  console.log('in the tunnel', JSON.stringify(walked));
  await shot(pre + '_dug_06_inside_tunnel_looking_on');
  await page.evaluate(() => { const c = window.cosmos; c.walker.yaw += Math.PI; for (let i = 0; i < 6; i++) c.step(1 / 60); });
  await shot(pre + '_dug_07_inside_tunnel_looking_back_at_the_shaft_light');
  await page.evaluate(() => { const c = window.cosmos; c.walker.yaw += Math.PI; c.walker.pitch = 0.9; for (let i = 0; i < 6; i++) c.step(1 / 60); });
  await shot(pre + '_dug_08_inside_tunnel_roof');
  // a luminance read of each, so "nearly black" is a number: the mean of the middle of the frame
  await browser.close();
};
