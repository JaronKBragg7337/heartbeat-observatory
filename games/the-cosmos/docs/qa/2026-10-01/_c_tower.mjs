const q = process.env.QUERY || '';
const W = Number(process.env.W || 750), Hh = Number(process.env.H || 470);
const pre = process.env.PRE || 'c';
const views = (process.env.VIEWS || 'tower-stair-door,tower-stair-foot,tower-stair-landing,tower-stair-back-landing,tower-stair-top,tower-cab-south,tower-cab-west,tower-cab-east,tower-cab-looking-in,tower-cab-north-walk,tower-mast-from-the-apron,tower-cab').split(',');
export default async ({ launch }) => {
  const h = await launch({ w: W, h: Hh, query: q });
  const { page, shot, browser } = h;
  for (const v of views) {
    const r = await page.evaluate((name) => { const c = window.cosmos; const out = c.portTour(name); for (let i = 0; i < 6; i++) c.step(1/60); c.portTour.update(); c.engine.step(0); return out; }, v);
    console.log(v, JSON.stringify(r.eye));
    await shot(`${pre}_${v.replace('tower-', '')}`);
  }
  await browser.close();
};
