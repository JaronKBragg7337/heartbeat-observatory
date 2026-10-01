import { HELPERS } from './_lib.mjs';
const q = process.env.QUERY || '';
const W = Number(process.env.W || 750), Hh = Number(process.env.H || 470);
const pre = process.env.PRE || 'f';
export default async ({ launch }) => {
  const h = await launch({ w: W, h: Hh, query: q });
  const { page, shot, browser } = h;
  for (const v of ['port-edge-flat', 'port-edge-grade', 'earthworks-detail', 'pad-02-wear']) {
    await page.evaluate((name) => { const c = window.cosmos; c.portTour(name); for (let i = 0; i < 4; i++) c.step(1 / 60); c.portTour.update(); c.engine.step(0); }, v);
    await shot(`${pre}_${v}`);
  }
  await page.evaluate(() => window.cosmos.portTour('off'));
  await page.evaluate(HELPERS);
  // Digging right up against the edge of pad 01 (its concrete slab is 0.5 m thick and is not cut): look at the slab's edge in the hole.
  const r = await page.evaluate(() => {
    const c = window.cosmos; qa.setOrigin(qa.portPoint(2, 33.6));
    c.setTool(2); qa.stand(0, -2.6);   // port +z is geodetic south: the pad is to the NORTH of this spot
    const out = [];
    for (let i = 0; i < 3; i++) { qa.aimAt(qa.local(0, 0.7 - i * 0.2, -0.4 - i * 0.8)); out.push(c.doDig().msg); }
    qa.aimAt(qa.local(0, 2.2, -0.15)); out.push('into the pad: ' + c.doDig().msg);     // aimed INTO the concrete slab: refused
    qa.emptyHands(); qa.flush();
    return out;
  });
  console.log('edge dig', JSON.stringify(r));
  await page.evaluate(() => { qa.cam([0, -2.8, 1.5], [0, 0.8, -0.8]); });
  await shot(`${pre}_dug_against_the_pad_edge_eye`);
  await page.evaluate(() => { qa.cam([2.2, -2.2, 3.4], [0, 0.8, -0.8]); });
  await shot(`${pre}_dug_against_the_pad_edge_above`);
  await page.evaluate(() => { qa.cam([-1.5, 5.5, 1.6], [0, 0.4, -0.8]); });
  await shot(`${pre}_dug_against_the_pad_edge_from_the_pad`);
  await browser.close();
};
