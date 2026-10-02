// the Shrike on the phone tier (?tier=low) at 390 x 844: outside, then three rooms
import { boot } from './_fl.mjs';
const h = await boot({ wait: 9000, w: 390, h: 844, query: '?dev=1&solo=1&ship=raider&tier=low' });
const info = await h.page.evaluate(() => { const c = window.cosmos; return { type: c.ship.def.type, tier: c.ship.tier, tris: c.ship.interior.triangles, build: Math.round(c.ship.buildMs) }; });
console.log(JSON.stringify(info));
await h.page.evaluate(() => { window.cosmos.ship.aboard = false; });
await h.page.evaluate(() => window.ext([-18, 6, -24], [0, 1.5, -2])); await h.page.waitForTimeout(600); await h.shot('f03_a_phone_exterior');
await h.page.evaluate(() => window.extOff());            // back from the outside camera to the player's own eyes
const A = async (name, room, x, z, yaw, pitch = 0) => { await h.page.evaluate(([room, x, z, yaw, pitch]) => window.cosmos.at(room, x, z, yaw, pitch, 14), [room, x, z, yaw, pitch]); await h.page.waitForTimeout(500); await h.shot(name); };
await A('f03_b_phone_cockpit', 'cockpit', 0, -9.2, 0, -4);
await A('f03_c_phone_corridor', 'corridor_main', 0, -7.4, 180, 0);
await A('f03_d_phone_hold', 'hold', 0, 10.4, 180, -4);
await h.browser.close();
