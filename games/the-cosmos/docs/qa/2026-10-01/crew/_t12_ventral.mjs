import { SIM } from './_lib2.mjs';
const W = Number(process.env.W || 750), H = Number(process.env.H || 470), pre = process.env.PRE || 'a';
export default async ({ launch }) => {
  const h = await launch({ w: W, h: H, query: process.env.QUERY || '' });
  const { page, shot, browser } = h;
  await page.waitForFunction(() => window.cosmos.crew, null, { timeout: 60000 });
  await page.evaluate(SIM);
  const look = async (name, yaw, pitch) => {
    await page.evaluate(([yaw, pitch]) => { const c = window.cosmos, s = c.ship; s.look.yaw = yaw; s.look.pitch = pitch; window.__sim(0.3); c.step(1 / 60); c.step(1 / 60); }, [yaw, pitch]);
    await shot(pre + '_ventral_' + name);
  };
  await page.evaluate(() => { const c = window.cosmos; c.ship.teleport('gun_ventral'); window.__sim(0.3); });
  await look('01_default', 0, -0.7);
  await look('02_straight_down', 0, -1.35);
  await look('03_forward', 0, -0.1);
  await look('04_down_left', 1.2, -1.0);
  await page.evaluate(() => { const c = window.cosmos; c.ship.teleport('gun_dorsal'); window.__sim(0.3); });
  await look('05_dorsal_up', 0, 1.3);
  await browser.close();
};
