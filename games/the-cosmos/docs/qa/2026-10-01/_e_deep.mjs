import { HELPERS } from './_lib.mjs';
const q = process.env.QUERY || '';
const W = Number(process.env.W || 750), Hh = Number(process.env.H || 470);
const pre = process.env.PRE || 'e';
export default async ({ launch }) => {
  const h = await launch({ w: W, h: Hh, query: q });
  const { page, shot, browser } = h;
  await page.evaluate(HELPERS);
  await page.evaluate(() => { qa.setOrigin(qa.portPoint(-22, 66)); qa.stand(0, -2.4); });
  // A deep shaft with the bucket: stand at the rim, bite down at the axis, step in when it is wide enough, keep going.
  const res = await page.evaluate(() => {
    const c = window.cosmos; c.setTool(2); const out = { cycles: [] };
    for (let cycle = 0; cycle < 5; cycle++) {
      let bites = 0;
      for (let n = 0; n < 12; n++) {
        qa.aimAt(qa.local(0, 0, -cycle * 1.3 - 0.4));
        let r = c.doDig();
        if (!r.ok && /full/i.test(r.msg)) break;
        if (!r.ok) { qa.aimAt(qa.local(0, -0.7, -cycle * 1.3 + 0.4)); r = c.doDig(); if (!r.ok) break; }
        bites++;
      }
      let dumps = 0; while (c.carried.length) { const d = c.doDump(); if (!d.ok) break; dumps++; }
      const s = qa.surfaceAt(0, 0); const depth = qa.V.dot(qa.V.sub(qa.O, s), qa.fr.up);
      out.cycles.push({ bites, dumps, depth: +depth.toFixed(2) });
      if (depth > 1.6 && cycle >= 1) { qa.stand(0, 0); }
    }
    // keep digging from inside until it is deep
    qa.stand(0, 0);
    for (let k = 0; k < 6; k++) {
      const floor = qa.surfaceAt(0, 0);
      qa.aimAt(floor); c.doDig();
      if (c.carried.length >= 3) { while (c.carried.length) c.doDump(); }
      qa.stand(0, 0);
    }
    while (c.carried.length) c.doDump();
    qa.flush();
    const s = qa.surfaceAt(0, 0); out.depth = qa.V.dot(qa.V.sub(qa.O, s), qa.fr.up);
    out.ledger = c.ledger(); out.delta = c.edits.fieldDeltaM3(); out.bricks = c.edits.bricks.size; out.meshes = c.terrain.meshes.size;
    out.piles = c.edits.piles.map((p) => ({ r: +p.radiusM.toFixed(1), v: +p.volumeM3.toFixed(1), loads: p.loads, h: +(p.apexM - p.centreGroundM).toFixed(2) }));
    return out;
  });
  console.log('deep', JSON.stringify(res));
  // looking down from the rim, and across the whole thing from the side
  await page.evaluate(() => { qa.stand(0, -3.2); qa.aimAt(qa.local(0, 0, -2)); for (let i = 0; i < 3; i++) window.cosmos.step(1/60); });
  await shot(`${pre}01_deep_from_the_rim_eye`);
  await page.evaluate(() => { qa.cam([0, -0.3, 3.2], [0, 0, -2]); });
  await shot(`${pre}02_deep_looking_straight_down`);
  await page.evaluate(() => { qa.cam([-4, -4, 1.7], [0, 0, -1.5]); });
  await shot(`${pre}03_deep_side_view_with_heaps`);
  // at the bottom, looking up and around
  await page.evaluate(() => { qa.camOff(); qa.stand(0, 0); const c = window.cosmos; c.walker.yaw = 0.3; c.walker.pitch = 1.0; for (let i = 0; i < 4; i++) c.step(1/60); });
  await shot(`${pre}04_bottom_looking_up_at_the_sky`);
  await page.evaluate(() => { const c = window.cosmos; c.walker.yaw = 1.8; c.walker.pitch = 0.1; for (let i = 0; i < 3; i++) c.step(1/60); });
  await shot(`${pre}05_bottom_the_wall_and_its_layers`);
  await page.evaluate(() => { const c = window.cosmos; c.walker.yaw = 4.0; c.walker.pitch = -0.55; for (let i = 0; i < 3; i++) c.step(1/60); });
  await shot(`${pre}06_bottom_looking_down_at_the_floor`);
  const st = await page.evaluate(() => { const c = window.cosmos; return { grounded: c.walker.grounded, depth: qa.V.dot(qa.V.sub(qa.O, c.walker.worldPos), qa.fr.up), fps: c.engine.fps }; });
  console.log('standing', JSON.stringify(st));

  // A tunnel out of the bottom of the shaft, eight bites in two rows, then walked into.
  const tun = await page.evaluate(() => {
    const c = window.cosmos; c.setTool(2); const w = c.walker; const f = w.updateFrame();
    qa.stand(0, 0);
    const base = { ...w.worldPos };
    const east = f.east, up = f.up;
    let made = 0;
    for (let k = 0; k < 7; k++) for (const hgt of [0.6, 1.55]) {
      const p = qa.V.add(qa.V.add(base, east, 1.9 + k * 0.6), up, hgt);
      const lot = c.edits.dig(p.x, p.y, p.z, 0.7);
      if (lot) { made++; c.carried.push(lot); }
    }
    let guard = 0; while (c.carried.length && guard++ < 40) { if (!c.doDump().ok) break; }       // the spoil goes out onto the apron
    qa.flush();
    return { made, base: { ...base } };
  });
  console.log('tunnel', JSON.stringify(tun.made));
  await page.evaluate(() => { const c = window.cosmos; c.walker.yaw = Math.PI / 2; c.walker.pitch = 0; for (let i = 0; i < 4; i++) c.step(1/60); });
  await shot(`${pre}07_shaft_foot_looking_into_the_tunnel`);
  const walked = await page.evaluate(() => {
    const c = window.cosmos; const w = c.walker; const start = { ...w.worldPos };
    window.__quietR = c.engine.renderer.render.bind(c.engine.renderer); c.engine.renderer.render = () => {};
    c.desktop.keys.add('KeyW');
    for (let i = 0; i < 360; i++) c.step(1/60);
    c.desktop.keys.delete('KeyW');
    c.engine.renderer.render = window.__quietR;
    for (let i = 0; i < 6; i++) c.step(1/60);
    const f = w.updateFrame();
    const d = qa.V.sub(w.worldPos, start);
    return { alongM: +qa.V.dot(d, f.east).toFixed(2), grounded: w.grounded };
  });
  console.log('walked the tunnel', JSON.stringify(walked));
  await shot(`${pre}08_inside_the_tunnel_looking_on`);
  await page.evaluate(() => { const c = window.cosmos; c.walker.yaw += Math.PI; for (let i = 0; i < 3; i++) c.step(1/60); });
  await shot(`${pre}09_inside_the_tunnel_looking_back_at_the_light`);
  await page.evaluate(() => { const c = window.cosmos; c.walker.yaw += Math.PI; c.walker.pitch = 1.1; for (let i = 0; i < 3; i++) c.step(1/60); });
  await shot(`${pre}10_inside_the_tunnel_roof`);
  await browser.close();
};
