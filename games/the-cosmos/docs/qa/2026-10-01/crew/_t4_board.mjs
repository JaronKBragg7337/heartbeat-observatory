import { SIM } from './_lib2.mjs';
const W = Number(process.env.W || 750), H = Number(process.env.H || 470), pre = process.env.PRE || 'a';
export default async ({ launch }) => {
  const h = await launch({ w: W, h: H, query: process.env.QUERY || '' });
  const { page, shot, browser } = h;
  await page.waitForFunction(() => window.cosmos.crew, null, { timeout: 60000 });
  await page.waitForTimeout(3000);
  await page.evaluate(SIM);
  const st = () => page.evaluate(() => [...window.cosmos.crew.members.values()].map(m => `${m.name}:${m.status}/${m.place}/${m.mode}${m.seated ? '/SEATED' : ''}` + (m.place === 'ship' ? ` (${m.sw.x.toFixed(1)},${m.sw.y.toFixed(1)},${m.sw.z.toFixed(1)})` : '')).join('  '));
  const r = await page.evaluate(() => { const c = window.cosmos; c.view.mode = 'third'; return ['pilot', 'captain', 'nav', 'gunner_dorsal', 'gunner_ventral'].map(id => JSON.stringify(c.crew.hire(id))); });
  console.log(r.join(' '));
  for (let t = 0; t < 10; t++) {
    await page.evaluate(() => window.__sim(8));
    console.log((t + 1) * 8 + 's', await st());
    if (t === 0) {
      await page.evaluate(() => { const c = window.cosmos; window.__cam(window.__pl(-9, 2.2, 36), window.__sl(0, -1.0, 27.5)); });
      await shot(pre + '_board01_walking_to_ramp'); await page.evaluate(() => window.cosmos.freeCam.off());
    }
    if (t === 4) {
      await page.evaluate(() => { window.__cam(window.__sl(8, 1.8, 30), window.__sl(-2, 0.4, 20)); });
      await shot(pre + '_board02_on_the_ramp'); await page.evaluate(() => window.cosmos.freeCam.off());
    }
  }
  await browser.close();
};
