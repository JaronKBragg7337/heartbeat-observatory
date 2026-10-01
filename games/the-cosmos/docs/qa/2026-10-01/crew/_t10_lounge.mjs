import { SIM } from './_lib2.mjs';
const W = Number(process.env.W || 750), H = Number(process.env.H || 470), pre = process.env.PRE || 'a';
export default async ({ launch }) => {
  const h = await launch({ w: W, h: H, query: process.env.QUERY || '' });
  const { page, shot, browser } = h;
  await page.waitForFunction(() => window.cosmos.crew, null, { timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.evaluate(SIM);
  const at = async (name, x, y, z, yawDeg, pitchDeg, zoom) => {
    await page.evaluate(([x, y, z, yawDeg, pitchDeg, zoom]) => {
      const c = window.cosmos, s = c.ship; s.aboard = true; if (s.seat) s.stations.stand();
      s.sw.place(x, y, z, yawDeg * Math.PI / 180); s.sw.pitch = pitchDeg * Math.PI / 180;
      s.zoomOn = !!zoom; s.zoomFov = 24;
      window.__sim(zoom ? 1.0 : 0.3); c.step(1 / 60); c.step(1 / 60);
    }, [x, y, z, yawDeg, pitchDeg, zoom]);
    await page.waitForTimeout(200);
    await shot(pre + '_lounge_' + name);
  };
  await at('01_from_door', 1.3, 3, 0.1, 90, -4);
  await at('02_at_the_glass', 5.2, 3, -0.9, 90, 0);
  await at('03_sofas_from_window', 5.6, 3, 0.1, -90, -6);
  await at('04_binoculars_stand', 4.6, 3, 0.1, 90, -8);
  await at('05_binoculars_zoomed_ground', 5.0, 3, 0.7, 75, 2, true);
  // in flight: the pilot flies a roam while we stand at the glass
  await page.evaluate(() => { ['pilot', 'captain', 'nav', 'gunner_dorsal', 'gunner_ventral'].forEach(id => window.cosmos.crew.hire(id)); window.__sim(75); const c = window.cosmos; c.ship.aboard = true; c.ship.sw.place(1.3, 3, 0.1, 0); console.log(JSON.stringify(c.crew.order('roam'))); window.__sim(40); });
  await at('06_in_flight_window', 5.2, 3, -0.4, 90, 0);
  await at('07_in_flight_zoomed', 5.1, 3, 0.7, 70, -4, true);
  await at('08_in_flight_window_rear', 5.2, 3, 0.4, 150, -3);
  await browser.close();
};
