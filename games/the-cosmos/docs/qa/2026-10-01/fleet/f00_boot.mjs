import { boot } from './_fl.mjs';
const h = await boot({ wait: 9000 });
const info = await h.page.evaluate(() => { const c = window.cosmos; return { type: c.ship.def.type, ready: c.ship.ready, tris: c.ship.interior.triangles, rooms: c.ship.interior.roomList.length, ext: c.ship.exterior.triangles, build: c.ship.buildMs, layer: c.ship.interior.layerStats }; });
console.log(JSON.stringify(info));
await h.shot('f00_boot');
await h.browser.close();
