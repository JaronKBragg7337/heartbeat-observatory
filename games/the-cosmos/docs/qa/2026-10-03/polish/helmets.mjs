// Raider helmets: a lineup of four raider crew on the Mars pad, close up. PREFIX=before node helmets.mjs
import { open } from './lib.mjs';
const prefix = process.env.PREFIX || 'before';
async function run(phone) {
  const tag = phone ? 'p' : 'd';
  const h = await open({ w: phone ? 390 : 1280, h: phone ? 844 : 720, query: '?dev=1&solo=1&opening=off&' + (phone ? 'tier=low&depth=16' : 'tier=high'), wait: 9000 }, prefix + '-' + tag);
  try {
    await h.page.evaluate(async () => {
      const c = window.cosmos, THREE = await import('/lib/three.module.js'), { raiderLook } = await import('/src/ships/raider/looks.js');
      c.freeCam.off();
      const w = c.walker, f = w.updateFrame();
      const up = new THREE.Vector3(f.up.x, f.up.y, f.up.z), north = new THREE.Vector3(f.north.x, f.north.y, f.north.z);
      const z = north.clone().negate(), x = new THREE.Vector3().crossVectors(up, z).normalize();
      const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, up, z));
      window.__who = [];
      for (let i = 0; i < 4; i++) {
        const p = c.people.spawn(['ada', 'jorge', 'zuri', 'walter'][i]);
        p.dress(raiderLook(i + 1, i));
        const g = new THREE.Group(); g.add(p.group); c.engine.scene.add(g);
        const worldPos = { x: w.worldPos.x + f.north.x * 4 + f.east.x * (i - 1.5) * 0.9, y: w.worldPos.y + f.north.y * 4 + f.east.y * (i - 1.5) * 0.9, z: w.worldPos.z + f.north.z * 4 + f.east.z * (i - 1.5) * 0.9 };
        c.engine.track({ worldPos, object3d: g, quaternion: q });
        for (const e of document.body.children) if (e.tagName !== 'CANVAS' && e.id !== 'game-canvas' && e.tagName !== 'SCRIPT') e.style.visibility = 'hidden';
        window.__who.push({ p, worldPos });
      }
      window.__eye = (i, dist, side, up2) => {
        const wp = window.__who[i].worldPos, f2 = w.updateFrame();
        const eye = { x: wp.x + f2.north.x * dist + f2.east.x * side + f2.up.x * up2, y: wp.y + f2.north.y * dist + f2.east.y * side + f2.up.y * up2, z: wp.z + f2.north.z * dist + f2.east.z * side + f2.up.z * up2 };
        const at = { x: wp.x + f2.up.x * 1.62, y: wp.y + f2.up.y * 1.62, z: wp.z + f2.up.z * 1.62 };
        c.freeCam.set(eye, at); for (let k = 0; k < 6; k++) c.step(1 / 30);
      };
    });
    await h.page.waitForFunction(() => window.__who.every(o => o.p.loaded), null, { timeout: 120000 });
    await h.page.evaluate(() => { for (let k = 0; k < 20; k++) cosmos.step(1 / 30); });
    for (let i = 0; i < 4; i++) {
      await h.page.evaluate(([i]) => window.__eye(i, -1.0, 0.0, 1.62), [i]); await h.shot(`face-${i}`);
      await h.page.evaluate(([i]) => window.__eye(i, -0.9, 0.7, 1.7), [i]); await h.shot(`three-quarter-${i}`);
    }
    await h.page.evaluate(() => window.__eye(1, 1.1, 0.5, 1.75)); await h.shot('back-1');
    await h.page.evaluate(() => window.__eye(2, 0.1, 1.2, 1.5)); await h.shot('side-2');
    await h.page.evaluate(() => { const w = cosmos.walker, f = w.updateFrame(); const wp = window.__who[1].worldPos; cosmos.freeCam.set({ x: wp.x - f.north.x * 3.2 + f.up.x * 1.6, y: wp.y - f.north.y * 3.2 + f.up.y * 1.6, z: wp.z - f.north.z * 3.2 + f.up.z * 1.6 }, { x: wp.x + f.up.x * 1.3, y: wp.y + f.up.y * 1.3, z: wp.z + f.up.z * 1.3 }); for (let k = 0; k < 6; k++) cosmos.step(1 / 30); });
    await h.shot('lineup');
  } finally { await h.browser.close(); }
}
if (!process.env.PHONE_ONLY) await run(false);
if (!process.env.DESK_ONLY) await run(true);
