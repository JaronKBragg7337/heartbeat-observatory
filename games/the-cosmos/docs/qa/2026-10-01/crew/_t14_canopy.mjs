import { SIM } from './_lib2.mjs';
const W = Number(process.env.W || 750), H = Number(process.env.H || 470), pre = process.env.PRE || 'a';
export default async ({ launch }) => {
  const h = await launch({ w: W, h: H, query: process.env.QUERY || '' });
  const { page, shot, browser } = h;
  await page.waitForFunction(() => window.cosmos.crew, null, { timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.evaluate(SIM);
  await page.evaluate(() => { ['pilot', 'captain', 'nav', 'gunner_dorsal', 'gunner_ventral'].forEach(id => window.cosmos.crew.hire(id)); window.__sim(75); });
  await page.evaluate(() => window.__cam(window.__sl(2.5, 8.2, -31), window.__sl(0, 6.8, -17)));
  await shot(pre + '_canopy01_crew_seen_through_the_bridge_glass');
  await page.evaluate(() => window.__cam(window.__sl(11, 9.5, 8), window.__sl(0, 7.3, 2.8)));
  await shot(pre + '_canopy02_dorsal_turret_gunner_from_outside');
  await browser.close();
};
