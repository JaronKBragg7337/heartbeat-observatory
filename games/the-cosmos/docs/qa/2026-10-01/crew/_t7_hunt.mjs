import { SIM } from './_lib2.mjs';
export default async ({ launch }) => {
  const h = await launch({ w: 640, h: 400 });
  const { page, shot, browser } = h;
  await page.waitForFunction(() => window.cosmos.crew, null, { timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.evaluate(SIM);
  await page.evaluate(() => {
    const c = window.cosmos; ['pilot', 'captain', 'nav', 'gunner_dorsal', 'gunner_ventral'].forEach(id => c.crew.hire(id)); window.__sim(75);
    // the player walks aboard and stands in the corridor
    const s = c.ship; s.aboard = true; s.sw.place(0, 3, 0, 0);
    window.__log = []; const cr = c.crew; const old = cr.onSay; cr.onSay = (n, t) => { window.__log.push(`[${c.ship.time.toFixed(0)}s] ${n}: ${t}`); old(n, t); };
  });
  const state = () => page.evaluate(() => { const f = window.cosmos.ship.flight, lp = window.cosmos.port.site.toLocal(f.pos); return `agl=${f.agl.toFixed(0)} spd=${f.groundSpeed.toFixed(1)} local=(${lp.x.toFixed(0)},${lp.z.toFixed(0)}) landed=${f.landed} hull=${f.hull.toFixed(0)} neutral=${window.cosmos.ship.drones.neutral} order=${window.cosmos.crew.activeOrder() && window.cosmos.crew.activeOrder().type}`; });
  const logs = async () => { const l = await page.evaluate(() => { const x = window.__log; window.__log = []; return x; }); for (const s of l) console.log('   ', s); };
  const run = async (label, order, args, seconds, every = 20) => {
    console.log('==', label, JSON.stringify(await page.evaluate(([o, a]) => window.cosmos.crew.order(o, a), [order, args])));
    for (let t = 0; t < seconds; t += every) { await page.evaluate((e) => window.__sim(e), every); console.log(` t+${t + every}`, await state()); await logs(); }
  };
  await run('hunt', 'hunt', {}, 420, 30);
  await browser.close();
};
