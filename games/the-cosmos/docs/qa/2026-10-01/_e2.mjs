import { HELPERS } from './_lib.mjs';
export default async ({ launch }) => {
  const h = await launch({ w: 750, h: 470 });
  const { page, shot, browser } = h;
  await page.evaluate(HELPERS);
  const r = await page.evaluate(() => {
    const c = window.cosmos;
    qa.setOrigin(qa.portPoint(-22, 66));
    for (let k = 0; k < 9; k++) { const p = qa.local(0, 0, -0.2 - k * 0.7); c.edits.dig(p.x, p.y, p.z, 0.75); }
    qa.stand(0, 0);
    for (let i = 0; i < 60; i++) c.step(1 / 60);
    qa.flush();
    const sky = c.engine.scene.children.find((o) => o.isHemisphereLight);
    const d = qa.V.dot(qa.V.sub(qa.O, c.walker.worldPos), qa.fr.up);
    c.walker.pitch = 0.0; c.walker.yaw = 1.0; for (let i = 0; i < 4; i++) c.step(1 / 60);
    return { depth: d, skyI: sky.intensity, skyPos: sky.position.toArray(), grounded: c.walker.grounded };
  });
  console.log(JSON.stringify(r));
  await shot('_e2_wall');
  await page.evaluate(() => { const c = window.cosmos; c.walker.pitch = 1.2; for (let i = 0; i < 3; i++) c.step(1 / 60); });
  await shot('_e2_up');
  await browser.close();
};
