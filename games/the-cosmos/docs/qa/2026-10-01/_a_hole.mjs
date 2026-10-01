import { HELPERS } from './_lib.mjs';
const q = process.env.QUERY || '';
const W = Number(process.env.W || 750), Hh = Number(process.env.H || 470);
const pre = process.env.PRE || 'a';
export default async ({ launch }) => {
  const h = await launch({ w: W, h: Hh, query: q });
  const { page, shot, browser } = h;
  await page.evaluate(HELPERS);
  await page.evaluate(() => { qa.setOrigin(qa.portPoint(10, 62)); qa.stand(0, -1.7); });
  // one bite, from where the player stands
  let r = await page.evaluate(() => {
    qa.aimAt(qa.local(0, 0, 0)); const d = window.cosmos.doDig(); qa.flush(); return d;
  });
  console.log('first bite', JSON.stringify(r));
  await shot(`${pre}01_one_bite_eye`);
  await page.evaluate(() => { qa.cam([0.0, -1.6, 1.0], [0, 0, -0.1]); });
  await shot(`${pre}02_one_bite_close`);
  await page.evaluate(() => qa.camOff());

  // Dig a pit the way a person does: bucket from the rim, then stand in it and widen and deepen.
  const t0 = Date.now();
  const res = await page.evaluate(() => {
    const c = window.cosmos; const out = { steps: [] };
    c.setTool(2);
    qa.stand(0, -1.9);
    for (let i = 0; i < 3; i++) { qa.aimAt(qa.local(0, 0, -0.3)); out.steps.push(c.doDig().msg); }
    qa.emptyHands();
    for (let layer = 0; layer < 2; layer++) {
      qa.stand(0, 0);
      const pts = [];
      for (let a = 0; a < 8; a++) { const ang = a / 8 * Math.PI * 2; pts.push(qa.surfaceAt(Math.cos(ang) * 0.75, Math.sin(ang) * 0.75)); }
      pts.push(qa.surfaceAt(0, 0));
      out.steps.push(JSON.stringify(qa.digPoints(pts, 2, true)));
    }
    out.emptied = qa.emptyHands();
    qa.flush();
    out.ledger = c.ledger();
    out.delta = c.edits.fieldDeltaM3();
    out.piles = c.edits.piles.map((p) => ({ r: +p.radiusM.toFixed(2), v: +p.volumeM3.toFixed(3), loads: p.loads }));
    out.bricks = c.edits.bricks.size;
    out.meshes = c.terrain.meshes.size;
    const s = qa.surfaceAt(0, 0); out.depth = qa.V.dot(qa.V.sub(qa.O, s), qa.fr.up);
    return out;
  });
  console.log('dig', Date.now() - t0, 'ms', JSON.stringify(res));
  await page.evaluate(() => { qa.stand(0, -2.2); qa.aimAt(qa.local(0, 0, -0.5)); c = window.cosmos; });
  await shot(`${pre}03_pit_from_rim_eye`);
  await page.evaluate(() => { qa.cam([0.0, -0.4, 4.0], [0, 0, -0.5]); });
  await shot(`${pre}04_pit_from_above`);
  await page.evaluate(() => { qa.cam([-3.0, -3.0, 1.6], [0, 0, -0.5]); });
  await shot(`${pre}05_pit_side_and_pile`);
  await page.evaluate(() => { qa.cam([0.0, -4.0, 1.2], [0, 1.5, 0.0]); });
  await shot(`${pre}06_pit_and_pile_low`);
  // standing in the pit looking up and around
  await page.evaluate(() => { qa.camOff(); qa.stand(0, 0); const c = window.cosmos; c.walker.pitch = 0.5; c.walker.yaw = 0; for (let i = 0; i < 3; i++) c.step(1/60); });
  await shot(`${pre}07_in_pit_looking_up_n`);
  await page.evaluate(() => { const c = window.cosmos; c.walker.yaw = 1.57; c.walker.pitch = 0.15; c.step(1/60); });
  await shot(`${pre}08_in_pit_looking_e`);
  await page.evaluate(() => { const c = window.cosmos; c.walker.yaw = 3.14; c.walker.pitch = -0.3; c.step(1/60); });
  await shot(`${pre}09_in_pit_looking_s_down`);
  const st = await page.evaluate(() => { const c = window.cosmos; return { grounded: c.walker.grounded, pos: qa.V.sub(c.walker.worldPos, qa.O), depth: qa.V.dot(qa.V.sub(qa.O, c.walker.worldPos), qa.fr.up), fps: c.engine.fps }; });
  console.log('standing', JSON.stringify(st));
  await browser.close();
};
