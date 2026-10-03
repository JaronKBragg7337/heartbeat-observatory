// The salvage cargo module on its slope: PREFIX=before node cargo.mjs
import { open, landPhobos, lookSun } from './lib.mjs';
const prefix = process.env.PREFIX || 'before';
async function run(phone) {
  const tag = phone ? 'p' : 'd';
  const h = await open({ w: phone ? 390 : 1280, h: phone ? 844 : 720, query: '?dev=1&solo=1&opening=off&' + (phone ? 'tier=low&depth=16' : 'tier=high'), wait: 9000 }, prefix + '-' + tag);
  try {
    await landPhobos(h);
    const D = await h.page.evaluate(() => { const d = window.cosmos.space.worlds.get('phobos').body.derelict; return { x: d.point.x, y: d.point.y, z: d.point.z }; });
    // aim a little above the ground at the module's middle
    const up = await h.page.evaluate(() => { const d = window.cosmos.space.worlds.get('phobos').body.derelict; return d.up; });
    const mid = { x: D.x + up.x * 1.4, y: D.y + up.y * 1.4, z: D.z + up.z * 1.4 };
    for (const [name, dist, ang, pitch] of [['front', 12, 0.3, 0.12], ['side-low', 8, 1.6, 0.0], ['other-side-low', 8, -1.6, 0.0], ['end-low', 9, 3.0, 0.02], ['wide', 28, 0.9, 0.15]]) {
      console.log(name, JSON.stringify(await lookSun(h, mid, dist, ang, pitch)));
      await h.shot('cargo-' + name);
    }
    // free camera right at ground level, along the skid, to see the contact
    await h.page.evaluate(async () => {
      const c = window.cosmos, mw = c.space.worlds.get('phobos'), b = mw.body, d = b.derelict, w = c.walker;
      const spec = await import('/src/space/spaceSpec.js'), s = spec.sunDirection();
      const u = d.up, e1x = u.y * 0 - u.z * 1, e1y = u.z * 0 - u.x * 0, e1z = u.x * 1 - 0; // a tangent: up x (0,1,0)... fallback below
      let tx = u.z, ty = 0, tz = -u.x; const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; tz /= tl;
      const at = { x: d.point.x + u.x * 0.2, y: d.point.y + u.y * 0.2, z: d.point.z + u.z * 0.2 };
      const eye = { x: d.point.x + tx * 9 + u.x * 0.35, y: d.point.y + ty * 9 + u.y * 0.35, z: d.point.z + tz * 9 + u.z * 0.35 };
      const l = Math.hypot(eye.x, eye.y, eye.z), R = b.surfaceRadius(eye.x / l, eye.y / l, eye.z / l);
      eye.x = eye.x / l * (R + 0.4); eye.y = eye.y / l * (R + 0.4); eye.z = eye.z / l * (R + 0.4);
      w.worldPos.x = eye.x; w.worldPos.y = eye.y; w.worldPos.z = eye.z; mw.force(w.worldPos);
      c.freeCam.set(eye, at); for (let i = 0; i < 12; i++) c.step(1 / 30);
      for (const e of document.body.children) if (e.tagName !== 'CANVAS' && e.id !== 'game-canvas' && e.tagName !== 'SCRIPT') e.style.visibility = 'hidden';
    });
    await h.shot('cargo-ground-contact');
    const info = await h.page.evaluate(() => { const m = window.cosmos.space.jobs.markers?.derelict?.group; return m && m.userData.settled ? m.userData.settled : null; });
    console.log('settled', JSON.stringify(info));
  } finally { await h.browser.close(); }
}
if (!process.env.PHONE_ONLY) await run(false);
if (!process.env.DESK_ONLY) await run(true);
