import { open } from './lib.mjs';
const h = await open({ wait: 6000 }, 'gate');
await h.page.evaluate(() => { const c = window.cosmos; c.ship.aboard = true; c.space.engage('ceres'); c.space.setWarp(60); window.hideUI(); });
const st = () => h.page.evaluate(() => { const sp = window.cosmos.space, t = sp.trip; return { frame: sp.frameId, phase: t && t.phase, spool: t && +t.spoolT.toFixed(1) }; });
const view = async (name, off, perp) => h.page.evaluate(([off, perp]) => {
  const c = window.cosmos, sp = c.space, f = c.ship.flight, p = f.pos;
  const frame = sp.frameId; const l = Math.hypot(p.x, p.y, p.z);
  const axis = frame === 'mars' ? { x: p.x / l, y: p.y / l, z: p.z / l } : { x: p.x / l, y: p.y / l, z: p.z / l };   // away from the home planet: toward the gate's open side
  const up = Math.abs(axis.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
  const side = { x: axis.y * up.z - axis.z * up.y, y: axis.z * up.x - axis.x * up.z, z: axis.x * up.y - axis.y * up.x }; const sl = Math.hypot(side.x, side.y, side.z);
  const eye = { x: p.x + axis.x * off + side.x / sl * perp, y: p.y + axis.y * off + side.y / sl * perp, z: p.z + axis.z * off + side.z / sl * perp };
  c.freeCam.set(eye, { x: p.x, y: p.y, z: p.z });
  const r = c.engine.renderer, save = r.render; r.render = () => {}; try { for (let i = 0; i < 6; i++) c.step(1 / 30); } finally { r.render = save; }
}, [off, perp]);
let done = new Set();
for (let i = 0; i < 400; i++) {
  await h.page.evaluate(() => { const c = window.cosmos, r = c.engine.renderer, save = r.render; r.render = () => {}; try { for (let k = 0; k < 30; k++) c.step(1 / 30); } finally { r.render = save; } });
  const s = await st();
  if (s.phase === 'spool' && !done.has('a')) { done.add('a'); await view('a', 1400, 500); await h.shot('mars-gate-idle'); }
  if (s.phase === 'spool' && s.spool > 14 && !done.has('b')) { done.add('b'); await view('b', 1400, 500); await h.shot('mars-gate-charging'); }
  if (s.frame === 'ceres' && s.phase === 'transit' && !done.has('c')) { done.add('c'); await view('c', 1400, 500); await h.shot('ceres-gate-arrival'); break; }
}
await h.browser.close();
