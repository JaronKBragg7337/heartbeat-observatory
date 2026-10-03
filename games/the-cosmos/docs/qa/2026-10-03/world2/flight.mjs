import { open } from './lib.mjs';
const h = await open({ wait: 6000 }, 'fl');
const errs = []; h.page.on('pageerror', e => errs.push(String(e).slice(0, 400)));
h.page.on('console', m => { if (m.type() === 'error') console.log('ERR', m.text().slice(0, 200)); });
const st = () => h.page.evaluate(() => { const c = window.cosmos, sp = c.space, t = sp.trip; return { frame: sp.frameId, phase: t && t.phase, leg: t && t.leg, spool: t && +t.spoolT.toFixed(1), warp: t && t.warp, dist: t && Math.round(t.progress.distM), landed: c.ship.flight.landed, credits: sp.ledger.credits, say: sp.log.slice(-1)[0] && sp.log.slice(-1)[0].text }; });
// board the ship (debug), give it the run
await h.page.evaluate(() => { const c = window.cosmos; c.ship.aboard = true; const r = c.space.engage('ceres'); window.__r = r; c.space.setWarp(60); });
console.log(JSON.stringify(await h.page.evaluate(() => window.__r)), JSON.stringify(await st()));
let last = '', shots = new Set();
for (let i = 0; i < 4000; i++) {
  await h.page.evaluate(() => { const c = window.cosmos, r = c.engine.renderer, save = r.render; r.render = () => {}; try { for (let k = 0; k < 30; k++) c.step(1 / 30); } finally { r.render = save; } });
  const s = await st(); const key = s.frame + '|' + s.phase + '|' + s.leg;
  if (key !== last) { console.log(i, JSON.stringify(s)); last = key; }
  if (s.phase === 'spool' && s.spool > 15 && !shots.has('spool')) { shots.add('spool'); await h.page.evaluate(() => { window.cosmos.step(1 / 30); }); await h.shot('spool-gate'); }
  if (s.frame === 'ceres' && s.phase === 'transit' && s.dist < 3e7 && !shots.has('arrive-mouth')) { shots.add('arrive-mouth'); await h.page.evaluate(() => window.cosmos.step(1 / 30)); await h.shot('ceres-mouth'); }
  if (s.frame === 'ceres' && s.phase === 'descent' && s.dist < 1500 && !shots.has('desc')) { shots.add('desc'); await h.page.evaluate(() => window.cosmos.step(1 / 30)); await h.shot('descent'); }
  if (!s.phase && s.frame === 'ceres') break;
}
console.log('final', JSON.stringify(await st()), 'errors', JSON.stringify(errs));
await h.shot('landed');
await h.browser.close();
