import { open, landOccator, cam } from './lib.mjs';
const h = await open({ wait: 5000 }, 'v2');
const errs = []; h.page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
await landOccator(h);
await h.page.evaluate(() => { const c = window.cosmos; c.ship.aboard = false; window.hideUI(); });
// frame a few views from the pad edge
const views = [
  ['station-wide', [60, -95, 14], [-20, 60, 6]],
  ['foundry', [-4, 50, 3], [-4, 100, 6]],
  ['bins-belt', [-30, 40, 5], [-55, 80, 7]],
  ['supply', [-40, -14, 2.2], [-70, -18, 2]],
  ['bunkhouse', [40, 35, 2.5], [66, 52, 2.5]],
  ['lane-office', [55, -35, 3], [78, -30, 8]],
  ['trucks-tanks', [-70, -45, 3], [-100, -40, 3]],
];
for (const [n, e, a] of views) { await cam(h, e, a, { ground: false, settle: 25 }); await h.shot(n); }
console.log('errors', JSON.stringify(errs));
await h.browser.close();
