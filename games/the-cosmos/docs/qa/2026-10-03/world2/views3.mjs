import { open, landOccator, cam } from './lib.mjs';
const h = await open({ wait: 5000 }, 'v3');
await landOccator(h);
await h.page.evaluate(() => { const c = window.cosmos; c.ship.aboard = false; window.hideUI(); });
await h.page.waitForTimeout(8000);
const views = [
  ['clerk', [-58, -15, 1.7], [-68, -18, 1.5]],
  ['foreman', [-2, 75, 1.7], [-6, 84, 1.5]],
  ['marshal', [8, 28, 1.7], [12, 36, 1.5]],
  ['supply-in-light', [-50, -30, 2.2], [-70, -18, 2]],
  ['pad-ship', [-45, 40, 9], [0, 0, 4]],
];
for (const [n, e, a] of views) { await cam(h, e, a, { ground: false, settle: 40 }); await h.shot(n); }
await h.browser.close();
