import { open } from './lib.mjs';
const h = await open({ w: 800, h: 450, query: '?dev=1&solo=1&tier=high', wait: 9000 }, 'probe');
try {
  await h.page.waitForFunction(() => window.cosmos?.opening && cosmos.engine.frameCount >= 2, null, { timeout: 120000 });
  await h.page.evaluate(async () => { cosmos.engine.stop(); await cosmos.opening.ready; cosmos.step(0); });
  const r = await h.page.evaluate(() => {
    const o = cosmos.opening; o.state.stage = 3; o.stage = 3; cosmos.step(0); cosmos.step(0);
    const root = o.rover.root; root.updateMatrixWorld(true);
    const inv = root.matrixWorld.clone().invert();
    const out = {};
    o.driver.group.traverse(b => { if (b.isBone && /^(head|pelvis|hips|spine_01|neck_01|hand_l|foot_l|thigh_l|calf_l)$/i.test(b.name)) { const v = b.getWorldPosition(new b.position.constructor()); v.applyMatrix4(inv); out[b.name] = [v.x, v.y, v.z].map(n => +n.toFixed(2)); } });
    out.driverPos = o.driver.group.position.toArray(); out.pose = o.driver.pose;
    return out;
  });
  console.log(JSON.stringify(r));
} finally { await h.browser.close(); }
