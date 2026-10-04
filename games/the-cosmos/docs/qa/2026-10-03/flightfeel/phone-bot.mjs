// FLIGHTFEEL: a first-timer bot flying the REAL phone UI in WebKit (iPhone profile): a held thumb on the left half for the stick, held LIFT / SINK / BOOST buttons, a real tap on the LAND chip.
// Out 2 km from the Meridian's pad, land, fly back, land on the pad. Game time, not wall time. Run with  node phone-bot.mjs [assist|newtonian]
//   (the old stick is run by test/flightfeel-bot.mjs: the same bot policy on the same ground, headless)
import { startLocal, open, sitPilot, stepSec, outDir } from './_ff.mjs';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const style = process.argv[2] || 'assist';
const L = await startLocal();
const out = outDir();
try {
  const P = await open('phone', L.base);
  const page = P.page;
  await sitPilot(page); await stepSec(page, 1);
  const THUMB = { id: 71, x: 110, y: 640 };
  const ptr = (el, type, x, y, id) => page.evaluate(({ el, type, x, y, id }) => { const t = el === 'canvas' ? document.querySelector('canvas') : document.querySelector(el); const r = t.getBoundingClientRect();
    t.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: false, clientX: x ?? r.x + r.width / 2, clientY: y ?? r.y + r.height / 2, bubbles: true, cancelable: true })); }, { el, type, x, y, id });
  let thumbDown = false, held = {};
  const stick = async (fwd, yaw) => {   // the left thumb: up is go, right is turn. A new touch is born where the thumb lands; the deflection is the move from there.
    if (Math.abs(fwd) < 0.03 && Math.abs(yaw) < 0.03) { if (thumbDown) { await ptr('canvas', 'pointerup', THUMB.x, THUMB.y, THUMB.id); thumbDown = false; } return; }
    if (!thumbDown) { await ptr('canvas', 'pointerdown', THUMB.x, THUMB.y, THUMB.id); thumbDown = true; }
    await ptr('canvas', 'pointermove', THUMB.x + yaw * 60, THUMB.y - fwd * 60, THUMB.id);
  };
  const hold = async (sel, on) => { if (!!held[sel] === on) return; held[sel] = on; await ptr(sel, on ? 'pointerdown' : 'pointerup', null, null, 9 + sel.length); };
  const realTap = async (sel) => { const b = await page.locator(sel).boundingBox(); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); };
  if (style === 'newtonian') await realTap('#fb-mode');
  const info = () => page.evaluate(({ gx, gz }) => { const c = cosmos, f = c.ship.flight, s = c.space.portSite, g = s.toWorld(gx, 0, gz), fr = f._frame;
    const d = { x: g.x - f.pos.x, y: g.y - f.pos.y, z: g.z - f.pos.z }, dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z, du = dot(d, f.up), dh = { x: d.x - f.up.x * du, y: d.y - f.up.y * du, z: d.z - f.up.z * du };
    const ve = dot(f.vel, fr.east), vn = dot(f.vel, fr.north), brg = Math.atan2(dot(dh, fr.east), dot(dh, fr.north));
    return { dist: Math.hypot(dh.x, dh.y, dh.z), bearing: brg, heading: f.heading, agl: f.agl, vUp: f.verticalSpeed, vH: f.groundSpeed, landed: f.landed, hull: f.hull, ve, vn, rampUp: c.ship.rampCtl.cargo.progress < 0.02, mode: f.controls.mode, t: c.ship.time }; }, GOAL);
  const wrap = (a) => { a = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2); return a > Math.PI ? a - Math.PI * 2 : a; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  var GOAL = { gx: 2000, gz: 0 };

  const leg = async (goal, { pad = false } = {}) => {
    GOAL = goal; await page.evaluate((g) => { window.__goal = g; }, goal);
    const t0 = (await info()).t; let tOff = null, tNear = null, arrived = false, tDown = null, touch = null; const reaction = 0.33; const q = [];
    for (let step = 0; step < 4000; step++) {
      const s = await info(); const dtSim = s.t - t0;
      if (tOff === null && s.agl > 10 && !s.landed) tOff = dtSim;
      const err = wrap(s.bearing - s.heading), dist = s.dist;
      let fwd = 0, yaw = clamp(err * 1.6, -1, 1), lift = 0, land = false, boost = false;
      if (tOff === null) { lift = 1; fwd = style === 'assist' ? 0.3 : 0; if (Math.abs(err) > 0.4) yaw = clamp(err * 1.6, -1, 1); else yaw = 0; }
      else if (!arrived) {
        fwd = clamp(dist / Math.max(60, s.vH * 3.2), 0.12, 1) * (Math.abs(err) > 0.5 ? 0.5 : 1); if (Math.abs(err) > 1) fwd = 0;
        if (s.agl < 14) lift = 0.6;
        if (dist < 25 && s.vH < 4) arrived = true;
        if (dist < 35 && tNear === null) tNear = dtSim;
      } else { fwd = 0; yaw = 0; lift = -1; if (pad) { lift = 0; land = true; } }
      q.push({ fwd, yaw, lift, land, boost }); const a = q.length > reaction / 0.25 ? q.shift() : { fwd: 0, yaw: 0, lift: 0, land: false, boost: false };
      await stick(a.fwd, a.yaw); await hold('#btn-lift', a.lift > 0.3); await hold('#btn-sink', a.lift < -0.3);
      if (a.land && !held.landTapped) { held.landTapped = true; await realTap('#fb-land'); }
      if (!arrived) held.landTapped = false;
      await stepSec(page, 0.25);
      const n = await info();
      if (arrived && n.landed) { tDown = n.t - t0; break; }
      if (dtSim > 420) break;
    }
    await stick(0, 0); await hold('#btn-lift', false); await hold('#btn-sink', false);
    const e = await info();
    return { tTakeoff: tOff, tNear, tLanded: tDown, offGoal: +e.dist.toFixed(1), landed: e.landed, hull: e.hull };
  };

  const a = await leg({ gx: 2000, gz: 0 });
  await page.screenshot({ path: join(out, `phone-bot-${style}-landed-out.png`) });
  const b = await leg({ gx: 0, gz: 0 }, { pad: true });
  await page.screenshot({ path: join(out, `phone-bot-${style}-landed-pad.png`) });
  const res = { style, out: a, back: b, total: +(a.tLanded + b.tLanded).toFixed(1), errors: P.errors };
  console.log(JSON.stringify(res, null, 1));
  writeFileSync(join(out, `phone-bot-${style}.json`), JSON.stringify(res, null, 1));
  await P.close();
} finally { L.stop(); }
