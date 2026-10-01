import { SIM } from './_lib2.mjs';
export default async ({ launch }) => {
  const h = await launch({ w: 900, h: 520 });
  const { page, shot, browser } = h;
  await page.waitForFunction(() => window.cosmos.crew, null, { timeout: 60000 });
  await page.evaluate(SIM);
  await page.evaluate(() => window.__cam(window.__sl(34, 6, 2), window.__sl(0, 4, 2)));
  await shot('t9_starboard');
  await page.evaluate(() => window.__cam(window.__sl(-34, 6, 2), window.__sl(0, 4, 2)));
  await shot('t9_port');
  await browser.close();
};
