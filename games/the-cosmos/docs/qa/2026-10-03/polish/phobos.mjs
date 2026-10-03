// Phobos ground pictures: PREFIX=before node phobos.mjs
import { open, landPhobos, stand, lookAt, lookSun } from './lib.mjs';
const prefix = process.env.PREFIX || 'before';
async function run(phone) {
  const tag = phone ? 'p' : 'd';
  const h = await open({ w: phone ? 390 : 1280, h: phone ? 844 : 720, query: '?dev=1&solo=1&opening=off&' + (phone ? 'tier=low&depth=16' : 'tier=high'), wait: 9000 }, prefix + '-' + tag);
  try {
    console.log(JSON.stringify(await landPhobos(h)).slice(0, 120));
    // find a tall rock 70..180 m from the pad, a mid one, and a stone field
    const spots = await h.page.evaluate(() => {
      const b = window.cosmos.space.worlds.get('phobos').body, pi = b.padInfo, out = { tall: { rock: -1 }, mid: { rock: -1 } };
      for (let e = -200; e <= 200; e += 3) for (let n = -200; n <= 200; n += 3) {
        const x = pi.point.x + pi.east.x * e + pi.north.x * n, y = pi.point.y + pi.east.y * e + pi.north.y * n, z = pi.point.z + pi.east.z * e + pi.north.z * n;
        const l = Math.hypot(x, y, z), r = b.rockRelief(x / l, y / l, z / l), d = Math.hypot(e, n);
        if (d < 70 || d > 190) continue;
        if (r > out.tall.rock) out.tall = { rock: r, e, n };
        if (r > 0.5 && r < 1.2 && d < 120 && (out.mid.rock < 0 || Math.abs(e) + Math.abs(n) < Math.abs(out.mid.e) + Math.abs(out.mid.n))) out.mid = { rock: r, e, n };
      }
      return out;
    });
    console.log(JSON.stringify(spots));
    const pt = (e, n) => h.page.evaluate(([e, n]) => { const pi = window.cosmos.space.worlds.get('phobos').body.padInfo; return { x: pi.point.x + pi.east.x * e + pi.north.x * n, y: pi.point.y + pi.east.y * e + pi.north.y * n, z: pi.point.z + pi.east.z * e + pi.north.z * n }; }, [e, n]);
    const T = await pt(spots.tall.e, spots.tall.n), M = await pt(spots.mid.e, spots.mid.n);
    console.log('sun', JSON.stringify(await lookSun(h, T, 11, 0, 0.12)));
    await h.shot('rock-tall-lit-11m');
    await lookSun(h, T, 9, 1.2, 0.1); await h.shot('rock-tall-rake-9m');
    await lookSun(h, T, 18, 0.5, 0.06); await h.shot('rock-tall-18m');
    await lookSun(h, T, 5.5, 0.3, 0.02); await h.shot('rock-tall-close');
    await lookSun(h, M, 6, 0.3, 0.1); await h.shot('rock-mid-6m');
    await lookSun(h, M, 3.2, 0.9, -0.45); await h.shot('rock-mid-down');
    // the field toward the horizon, craters in the vertex shading
    await stand(h, 80, 20, 1.2, 0.08); await h.shot('field-east');
    await stand(h, 70, 20, 4.7, -0.03); await h.shot('field-pad-from-70');
    await stand(h, 40, 30, 0.0, 0.05); await h.shot('field-north');
    await stand(h, -60, 60, 2.6, 0.05); await h.shot('field-sw');
    // a crater from above: free camera high over a big groove/crater
    await h.page.evaluate(() => {
      const c = window.cosmos, mw = c.space.worlds.get('phobos'), b = mw.body, pi = b.padInfo, w = c.walker;
      const e = 300, n = 120, up = pi.up;
      const x = pi.point.x + pi.east.x * e + pi.north.x * n, y = pi.point.y + pi.east.y * e + pi.north.y * n, z = pi.point.z + pi.east.z * e + pi.north.z * n;
      const l = Math.hypot(x, y, z), R = b.surfaceRadius(x / l, y / l, z / l);
      w.worldPos.x = x / l * (R + 0.03); w.worldPos.y = y / l * (R + 0.03); w.worldPos.z = z / l * (R + 0.03); w.grounded = true;
      mw.force(w.worldPos);
      const eye = { x: x / l * (R + 55) + pi.east.x * -80, y: y / l * (R + 55) + pi.east.y * -80, z: z / l * (R + 55) + pi.east.z * -80 };
      const at = { x: x / l * (R - 4) + pi.east.x * 60, y: y / l * (R - 4) + pi.east.y * 60, z: z / l * (R - 4) + pi.east.z * 60 };
      c.freeCam.set(eye, at); for (let i = 0; i < 20; i++) c.step(1 / 30);
    });
    await h.shot('field-aerial');
  } finally { await h.browser.close(); }
}
if (!process.env.PHONE_ONLY) await run(false);
if (!process.env.DESK_ONLY) await run(true);
