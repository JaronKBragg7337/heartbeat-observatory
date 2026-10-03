import { open, landOccator, cam } from './lib.mjs';
const h = await open({ wait: 5000 }, 'v5');
await landOccator(h);
await h.page.evaluate(() => { window.cosmos.ship.aboard = false; window.hideUI(); });
await cam(h, [-1200, -900, 900], [-3300, 3000, -300], { settle: 60 }); await h.shot('cut-from-station');
await cam(h, [-3300, 3000, 4200], [-3300, 3000, 0], { settle: 60 }); await h.shot('cut-from-above');
await cam(h, [-3300, 600, 350], [-3300, 3000, -350], { settle: 60 }); await h.shot('cut-south-rim');
await cam(h, [-3300, 1200, 60], [-3300, 2100, -100], { ground: true, settle: 60 }); await h.shot('cut-bench-ground');
await h.browser.close();
