// Review 7: what space costs: draw calls and triangles at the main places, build times, the per-frame work. Phone tier. Prints JSON.
import { boot, S, FF, stand } from './_sp.mjs';
const h = await boot({ w: 375, h: 740, query: '?tier=low', wait: 8000 });
const info = (label) => h.page.evaluate((label) => { const c = window.cosmos; const i = c.engine.renderer.info; i.autoReset = false; i.reset(); c.step(1 / 60); const r = { label, calls: i.render.calls, triangles: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures }; i.autoReset = true; return r; }, label);
const out = {};
out.ground = await info('Mars ground at the port (low tier)');
out.build = await h.page.evaluate(() => { const w = window.cosmos.space.worlds.get('phobos'); return { phobosBuildMs: Math.round(w.buildMs), shellVertices: w.shell.geometry.attributes.position.count, shellTriangles: w.shell.geometry.index ? w.shell.geometry.index.count / 3 : w.shell.geometry.attributes.position.count / 3 }; });
await h.page.evaluate(() => window.cam = null);
out.orbit = await h.page.evaluate(() => { const c = window.cosmos, p = c.ship.flight.pos, l = Math.hypot(p.x, p.y, p.z); const e = { x: p.x * (1 + 400000 / l), y: p.y * (1 + 400000 / l), z: p.z * (1 + 400000 / l) }; c.freeCam.set(e, { x: 0, y: 0, z: 0 }); for (let i = 0; i < 6; i++) c.step(1 / 60); const i = c.engine.renderer.info; i.autoReset = false; i.reset(); c.step(1 / 60); const r = { calls: i.render.calls, triangles: i.render.triangles }; i.autoReset = true; c.freeCam.off(); return r; });
const t0 = await h.page.evaluate(() => { const c = window.cosmos; const t = performance.now(); const r = c.space.debugLand('phobos'); return { debugLandMs: Math.round(performance.now() - t), r }; });
out.landMs = t0;
out.pad = await info('on the Phobos pad, ship landed (the interior culled as usual)');
await stand(h, 60, 20, 4.7, 0.0);
out.onFoot = await info('on foot 60 m from the ship');
out.lateMsOnPhobos = await h.page.evaluate(() => { const sp = window.cosmos.space; const t = performance.now(); for (let i = 0; i < 300; i++) sp.late(1 / 60); return +((performance.now() - t) / 300).toFixed(3); });
out.dest = await h.page.evaluate(() => { const c = window.cosmos; c.space.engine; const t = performance.now(); for (let i = 0; i < 20; i++) { c.space._destCache = null; c.space.destinations(); } return { destinationsMsEach: +((performance.now() - t) / 20).toFixed(1) }; });
out.tiersRebuild = await h.page.evaluate(() => { const mw = window.cosmos.space.worlds.get('phobos'); const t = performance.now(); mw.force(window.cosmos.walker.worldPos); return { forceAllTiersMs: Math.round(performance.now() - t) }; });
console.log(JSON.stringify(out, null, 1));
await h.browser.close();
