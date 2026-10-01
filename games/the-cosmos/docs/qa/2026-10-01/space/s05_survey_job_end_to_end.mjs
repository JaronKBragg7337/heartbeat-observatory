import { boot, S, FF, stand } from './_sp.mjs';
// Review 5: the survey job end to end in the real game, flown (no shortcuts): pad -> Phobos -> samples -> dig -> stow -> salvage -> home -> paid. Prints the ledger.
const h = await boot({ w: 900, h: 560 });
const log = (...a) => console.log(...a);
// 1. out: pad -> Phobos by the nav computer
await h.page.evaluate(() => { const c = window.cosmos; c.ship.teleport('pilot'); c.step(1 / 60); window.r1 = c.space.engage('phobos'); });
log('engage', JSON.stringify(await h.page.evaluate(() => window.r1)));
for (let i = 0; i < 300; i++) {
  await FF(h, 6, 0.1, '() => !window.cosmos.space.trip');
  const s = await S(h);
  if (s.phase === 'transit' && s.warp === 1) await h.page.evaluate(() => window.cosmos.space.setWarp(60));
  if (!s.phase) break;
}
log('at Phobos', JSON.stringify(await S(h)));
// 2. on foot: disembark properly (lower ramp, walk down)
await h.page.evaluate(() => { const c = window.cosmos; c.ship.stations.stand(); c.ship.teleport('cargo'); c.ship.toggleRamp('cargo'); });
await FF(h, 9, 0.1);
await h.page.evaluate(() => { const c = window.cosmos; c.ship.sw.place(0, 0, 18, Math.PI); c.desktop.keys.add('KeyW'); });
for (let i = 0; i < 40; i++) { await FF(h, 0.5, 0.05, '() => !window.cosmos.ship.aboard'); if (!(await h.page.evaluate(() => window.cosmos.ship.aboard))) break; }
await h.page.evaluate(() => window.cosmos.desktop.keys.clear());
log('walked off', JSON.stringify(await h.page.evaluate(() => ({ aboard: window.cosmos.ship.aboard, body: window.cosmos.walker.body.id }))));
// 3. walk to each sample site (by placing), take samples with the real contextual action
for (const i of [0, 1, 2]) {
  const r = await h.page.evaluate((i) => {
    const c = window.cosmos, sp = c.space, s = sp.jobs.sites[i], w = c.walker, l = Math.hypot(s.point.x, s.point.y, s.point.z);
    w.worldPos.x = s.point.x * (1 + 1.5 / l) + 0.5; w.worldPos.y = s.point.y * (1 + 1.5 / l); w.worldPos.z = s.point.z * (1 + 1.5 / l);
    sp.worlds.get('phobos').force(w.worldPos); for (let k = 0; k < 6; k++) c.step(1 / 30);
    const a = sp.jobs.contextAction(false);
    const res = a ? a.run() : null;
    return { label: a && a.label, res: res && res.msg, taken: sp.jobs.taken.size, aboard: sp.jobs.samplesAboard };
  }, i);
  log('sample', i, JSON.stringify(r));
  if (i === 1) { await h.shot('job_sample2'); }
}
// 4. dig with the bucket where the clay should be (the pad's own regolith first), stow
const d = await h.page.evaluate(() => {
  const c = window.cosmos, w = c.walker; c.setTool(2); w.pitch = -1.2;
  const out = []; for (let k = 0; k < 6; k++) { const r = c.doDig(); out.push(r.ok ? r.lot.materialName + ' ' + Math.round(r.lot.massKg) + 'kg' : r.msg); }
  return { out, carried: c.carried.length, kg: c.digger.carriedMass() };
});
log('dug', JSON.stringify(d));
await h.shot('job_dig');
// bring it to the ship and stow
const st = await h.page.evaluate(() => { const c = window.cosmos, sp = c.space, pi = sp.worlds.get('phobos').body.padInfo, w = c.walker;
  const l = Math.hypot(pi.point.x, pi.point.y, pi.point.z); w.worldPos.x = pi.point.x + pi.east.x * 22; w.worldPos.y = pi.point.y + pi.east.y * 22; w.worldPos.z = pi.point.z + pi.east.z * 22;
  const ll = Math.hypot(w.worldPos.x, w.worldPos.y, w.worldPos.z), R = sp.worlds.get('phobos').body.surfaceRadius(w.worldPos.x / ll, w.worldPos.y / ll, w.worldPos.z / ll);
  w.worldPos.x *= (R + 0.03) / ll; w.worldPos.y *= (R + 0.03) / ll; w.worldPos.z *= (R + 0.03) / ll;
  for (let k = 0; k < 6; k++) c.step(1 / 30);
  const a = sp.jobs.contextAction(!!c.ship.contextAction()); const r = a ? a.run() : null; return { label: a && a.label, r: r && r.msg, cargo: [...sp.ledger.cargo], ledger: c.ledger() }; });
log('stow', JSON.stringify(st));
// 4b. the distress beacon's module
const sv = await h.page.evaluate(() => { const c = window.cosmos, sp = c.space, dl = sp.worlds.get('phobos').body.derelict, w = c.walker, l = Math.hypot(dl.point.x, dl.point.y, dl.point.z); w.worldPos.x = dl.point.x * (1 + 1 / l) + 1; w.worldPos.y = dl.point.y * (1 + 1 / l); w.worldPos.z = dl.point.z * (1 + 1 / l); sp.worlds.get('phobos').force(w.worldPos); for (let k = 0; k < 6; k++) c.step(1 / 30); const a = sp.jobs.contextAction(false); const r = a && a.run(); return { label: a && a.label, r: r && r.msg, credits: sp.ledger.credits }; });
log('salvage', JSON.stringify(sv));
// 5. back aboard and home
await h.page.evaluate(() => { const c = window.cosmos; c.ship.teleport('pilot'); c.step(1 / 60); window.r2 = c.space.engage('port'); });
log('engage home', JSON.stringify(await h.page.evaluate(() => window.r2)));
for (let i = 0; i < 400; i++) {
  await FF(h, 6, 0.1, '() => !window.cosmos.space.trip');
  const s = await S(h);
  if (s.phase === 'transit' && s.warp === 1) await h.page.evaluate(() => window.cosmos.space.setWarp(60));
  if (!s.phase) break;
}
log('home', JSON.stringify(await S(h)));
const fin = await h.page.evaluate(() => { const sp = window.cosmos.space; return { credits: sp.ledger.credits, entries: sp.ledger.entries, cargo: [...sp.ledger.cargo], log: sp.log.slice(-6).map(l => l.text) }; });
log(JSON.stringify(fin, null, 1));
await h.browser.close();
