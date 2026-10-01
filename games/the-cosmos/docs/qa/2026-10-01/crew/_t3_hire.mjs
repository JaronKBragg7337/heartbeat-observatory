import { SIM } from './_lib2.mjs';
const W = Number(process.env.W || 750), H = Number(process.env.H || 470), pre = process.env.PRE || 'a';
export default async ({ launch }) => {
  const h = await launch({ w: W, h: H, query: process.env.QUERY || '' });
  const { page, shot, browser } = h;
  await page.waitForFunction(() => window.cosmos.crew, null, { timeout: 60000 });
  await page.waitForTimeout(3000);
  await page.evaluate(SIM);
  // 1. the candidates, from the player's side
  await page.evaluate(() => { window.__sim(1); window.__cam(window.__pl(-9, 1.7, 36), window.__pl(-22, 1.2, 45)); });
  await shot(pre + '_hire01_candidates_wide');
  await page.evaluate(() => window.__cam(window.__pl(-17.5, 1.6, 40.5), window.__pl(-19.5, 1.35, 45.5)));
  await shot(pre + '_hire02_candidates_close');
  await page.evaluate(() => window.__cam(window.__pl(-21, 2.0, 40), window.__pl(-23.6, 2.0, 49.4)));
  await shot(pre + '_hire03_board');
  // 2. walk the player up to Ada: the Talk button
  await page.evaluate(() => {
    const c = window.cosmos; c.freeCam.off();
    const m = c.crew.members.get('pilot'); const w = c.walker;
    const p = c.port.site.toWorld(-16.0, 0.02, 42.2); Object.assign(w.worldPos, p); w.updateFrame();
    w.yaw = Math.atan2(1, 1) + 0; c.rebuildNear(true); window.__sim(1.2);
  });
  await page.waitForTimeout(400);
  console.log('talk button:', await page.evaluate(() => { const b = document.getElementById('crew-talk'); return [b.style.display, b.textContent]; }));
  await shot(pre + '_hire04_talk_button');
  await page.evaluate(() => { window.cosmos.crewUI.toggle(); });
  await page.waitForTimeout(300);
  await shot(pre + '_hire05_hire_panel');
  await browser.close();
};
