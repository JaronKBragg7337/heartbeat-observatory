import { HELPERS } from './_lib.mjs';
const q = process.env.QUERY || '';
const W = Number(process.env.W || 750), Hh = Number(process.env.H || 470);
export default async ({ launch }) => {
  const h = await launch({ w: W, h: Hh, query: q });
  const { page, shot, browser } = h;
  await page.evaluate(HELPERS);
  // A scene with everything in it: a 3 m pit with widened walls, a tunnel out of it, a ramp, heaps round it, a second
  // pit 30 m away, and a trench across the old apron edge of the earthworks. Built straight into the edit store.
  const build = await page.evaluate(() => {
    const c = window.cosmos, E = c.edits;
    qa.setOrigin(qa.portPoint(-22, 66));
    const lots = [];
    const dig = (e, n, depth, r) => { const p = qa.local(e, n, -depth); const l = E.dig(p.x, p.y, p.z, r); if (l) lots.push(l); return !!l; };
    for (let k = 0; k < 5; k++) dig(0, 0, 0.3 + k * 0.6, 0.7);
    for (const d of [0.4, 1.1, 1.9, 2.6]) for (const [e, n] of [[0.9, 0], [-0.9, 0], [0, 0.9], [0, -0.9]]) dig(e, n, d, 0.55);
    for (let k = 0; k < 8; k++) for (const hgt of [1.6, 2.5]) dig(1.6 + k * 0.6, 0.0, hgt, 0.7);          // a tunnel east out of the pit
    for (let k = 0; k < 6; k++) dig(-1.4 - k * 0.7, 0.0, 0.3 + k * 0.45, 0.6);                              // a ramp west out of the pit
    for (let k = 0; k < 4; k++) dig(30 + (k % 2) * 0.9, 4 + Math.floor(k / 2) * 0.9, 0.3 + k * 0.5, 0.7); // a second pit
    // pour every lot out as heaps round the site, as the player would
    const spots = [[4.5, 4.5], [-4.5, 4.8], [5.5, -4.5], [-5, -5], [0, 6.5], [0, -6.5]];
    let i = 0; for (const l of lots.slice(0, 12)) { const s = spots[i++ % spots.length]; const g = qa.surfaceAt(s[0], s[1]); E.deposit(l, g.x, g.y, g.z, { pile: E.pileNear(g.x, g.y, g.z, 0.5) }); }
    qa.flush(); for (let k = 0; k < 8; k++) { c.terrain.update(0.016, qa.local(0, 0, 1)); }
    return { lots: lots.length, bricks: E.bricks.size, meshes: c.terrain.meshes.size, ledger: c.edits.ledger([]) };
  });
  console.log('scene', JSON.stringify(build));
  // THE AUDIT: everything magenta-on-magenta. Any pure magenta pixel in a downward view is a hole in all geometry.
  const audit = await page.evaluate((size) => {
    const c = window.cosmos, eng = c.engine, gl = eng.renderer.getContext(), canvas = eng.renderer.domElement;
    const scene = eng.scene, savedBg = scene.background, savedFog = scene.fog;
    scene.background = scene.background.clone().setHex(0xff00ff); scene.fog = null;
    const wpx = canvas.width, hpx = canvas.height, buf = new Uint8Array(wpx * hpx * 4);
    const eyes = [];
    const ring = (r, n, up) => { for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2; eyes.push([Math.cos(a) * r, Math.sin(a) * r, up]); } };
    ring(2.6, 6, 1.7); ring(6, 6, 1.7); ring(11, 4, 1.7); ring(3.5, 4, 4);       // round the site, standing and from a step up
    eyes.push([0, 0, -2.2], [0.2, 0.1, -3.0], [1.0, 0, -1.9], [3.0, 0, -1.9], [4.5, 0, -1.8], [-2.5, 0, -0.9], [30.4, 4.5, -0.3], [29, 3, 1.2], [31.5, 5.5, 1.2], [32, 3, 1.7]); // in the pit, in the tunnel, on the ramp, in the other pit
    let views = 0, bad = []; let worst = 0;
    for (const e of eyes) for (let a = 0; a < 8; a++) for (const pitch of [-45, -75]) {
      const eye = qa.local(e[0], e[1], e[2]);
      const yaw = a / 8 * Math.PI * 2, pr = pitch * Math.PI / 180;
      const dir = qa.V.add(qa.V.add(qa.V.mul(qa.fr.north, Math.cos(yaw) * Math.cos(pr)), qa.V.mul(qa.fr.east, Math.sin(yaw) * Math.cos(pr))), qa.V.mul(qa.fr.up, Math.sin(pr)));
      c.freeCam.set(eye, qa.V.add(eye, dir));
      c.engine.step(1 / 60);
      gl.readPixels(0, 0, wpx, hpx, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      let n = 0; for (let p = 0; p < buf.length; p += 4) if (buf[p] > 235 && buf[p + 1] < 25 && buf[p + 2] > 235) n++;
      views++; worst = Math.max(worst, n);
      if (n > 4) bad.push({ eye: e, yaw: +(yaw * 180 / Math.PI).toFixed(0), pitch, n });
    }
    scene.background = savedBg; scene.fog = savedFog;
    return { views, worst, bad: bad.slice(0, 20), badCount: bad.length };
  });
  console.log('gap audit', JSON.stringify(audit));
  await page.evaluate(() => { window.cosmos.freeCam.off(); });
  await browser.close();
};
