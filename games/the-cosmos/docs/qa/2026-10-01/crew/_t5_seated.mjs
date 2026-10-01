import { SIM } from './_lib2.mjs';
const W = Number(process.env.W || 750), H = Number(process.env.H || 470), pre = process.env.PRE || 'a';
export default async ({ launch }) => {
  const h = await launch({ w: W, h: H, query: process.env.QUERY || '' });
  const { page, shot, browser } = h;
  await page.waitForFunction(() => window.cosmos.crew, null, { timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.evaluate(SIM);
  await page.evaluate(() => { ['pilot', 'captain', 'nav', 'gunner_dorsal', 'gunner_ventral'].forEach(id => window.cosmos.crew.hire(id)); window.__sim(75); });
  const at = async (name, x, y, z, yawDeg, pitchDeg) => {
    await page.evaluate(([x, y, z, yawDeg, pitchDeg]) => {
      const c = window.cosmos, s = c.ship; s.aboard = true; if (s.seat) s.stations.stand();
      s.sw.place(x, y, z, yawDeg * Math.PI / 180); s.sw.pitch = pitchDeg * Math.PI / 180;
      window.__sim(0.2); c.step(1 / 60); c.step(1 / 60);
    }, [x, y, z, yawDeg, pitchDeg]);
    await shot(pre + '_seat_' + name);
  };
  await at('01_bridge_from_stair', 0, 6, -12.4, 0, -3);
  await at('02_bridge_pilot_nav_close', 0.2, 6, -14.3, -20, -4);
  await at('03_bridge_nav_side', 0.4, 6, -15.6, 70, -4);
  await at('04_captain_from_behind', 0, 6, -12.9, 5, -8);
  await at('05_pilot_from_side', -2.9, 6, -16.0, 90, -4);
  await at('06_nest_gunner', -0.8, 6.95, 2.6, 80, -6);
  await at('07_ventral_gunner', 0, -1.0 + 1.0, -14.2, 0, -30);
  await browser.close();
};
