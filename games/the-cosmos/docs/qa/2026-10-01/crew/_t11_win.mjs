import { SIM } from './_lib2.mjs';
export default async ({ launch }) => {
  const h = await launch({ w: 750, h: 470 });
  const { page, shot, browser } = h;
  await page.waitForFunction(() => window.cosmos.crew, null, { timeout: 60000 });
  await page.evaluate(SIM);
  const at = async (name, x, y, z, yawDeg, pitchDeg) => {
    await page.evaluate(([x, y, z, yawDeg, pitchDeg]) => { const c = window.cosmos, s = c.ship; s.aboard = true; s.sw.place(x, y, z, yawDeg * Math.PI / 180); s.sw.pitch = pitchDeg * Math.PI / 180; window.__sim(0.3); c.step(1 / 60); c.step(1 / 60); }, [x, y, z, yawDeg, pitchDeg]);
    await shot('t11_' + name);
  };
  await at('cabin_window', 5.6, 3, 4.95, 90, 5);
  await at('galley_window', 5.6, 3, -7.0, 90, 5);
  // the plating seen from outside, same region
  await page.evaluate(() => { const s = window.cosmos.ship; s.aboard = false; window.__cam(window.__sl(14, 6.0, 0.1), window.__sl(6.4, 4.2, 0.1)); });
  await shot('t11_outside_at_lounge');
  await browser.close();
};
