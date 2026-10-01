// Review 8: precision across the distances. At Deimos (23,459 km from Mars's centre) and in the middle of a transit, how big are the numbers the
// GPU is handed for the things you can see, and does the ship still sit where the f64 position says?
import { boot, S, FF } from './_sp.mjs';
const h = await boot({ w: 750, h: 470, query: '?tier=low', wait: 6000 });
const res = {};
const probe = (label) => h.page.evaluate((label) => {
  const c = window.cosmos, e = c.engine, f = c.ship.flight, cam = e.cameraWorldPos, A = e.activeFrame.origin;
  const ext = c.ship.entryExt.object3d.position;                     // render-space position of the ship: float32 values the GPU gets
  const expect = { x: f.pos.x - cam.x, y: f.pos.y - cam.y, z: f.pos.z - cam.z };         // the f64 truth
  const err = Math.hypot(ext.x - expect.x, ext.y - expect.y, ext.z - expect.z);
  const sceneBodies = [];
  for (const [n, obj] of [['mars shell', e.scene.getObjectByName('shell:mars')], ['phobos shell', e.scene.getObjectByName('shell:phobos')], ['deimos shell', e.scene.getObjectByName('shell:deimos')]]) if (obj && obj.visible) sceneBodies.push([n, +(obj.position.length() / 1000).toFixed(0) + ' km from the camera']);
  const mw = c.space.worlds.get(c.space.frameId);
  const near = mw ? mw.near.mesh.position.length() : null;
  return { label, frame: e.activeFrame.id, cameraFromMarsCentre_km: +(Math.hypot(cam.x + A.x, cam.y + A.y, cam.z + A.z) / 1000).toFixed(0), shipRenderPos_m: +ext.length().toFixed(6), shipRenderPosError_m: +err.toExponential(2), bodiesDrawn: sceneBodies, nearTileFromCamera_m: near && +near.toFixed(2), depthBits: c.depthBits, far: e.camera.far };
}, label);
await h.page.evaluate(() => { const c = window.cosmos; c.ship.teleport('pilot'); c.step(1 / 60); c.space.engage('deimos'); });
await FF(h, 600, 0.2, '() => window.cosmos.space.trip.phase === "transit"');
await h.page.evaluate(() => window.cosmos.space.setWarp(60));
await FF(h, 8, 0.1);
res.midTransit = await probe('in transit, about 4 minutes of ship time out');
await FF(h, 600, 0.1, '() => !window.cosmos.space.trip');
await FF(h, 6, 0.1);
res.landedDeimos = await probe('landed on Deimos');
await h.page.evaluate(() => { const c = window.cosmos; c.ship.stations.stand(); c.ship.boardAt(0, 0, 24, 0); c.step(1 / 60); });
res.aboardDeimos = await probe('aboard, on Deimos');
console.log(JSON.stringify(res, null, 1));
await h.browser.close();
