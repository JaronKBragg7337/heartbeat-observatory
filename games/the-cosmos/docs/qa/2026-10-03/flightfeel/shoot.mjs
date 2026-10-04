// FLIGHTFEEL screenshots: the phone (iPhone WebKit, real taps on the chips, held thumb / buttons as pointer events) and the desktop (Chromium, real keys and mouse movement).
import { startLocal, open, sitPilot, stepSec, state, outDir } from './_ff.mjs';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';

const L = await startLocal();
const out = outDir();
const log = {};
try {
  // ---------------- phone ----------------
  const P = await open('phone', L.base);
  const page = P.page;
  await sitPilot(page); await stepSec(page, 1);
  const ptr = (el, type, x, y, id) => page.evaluate(({ el, type, x, y, id }) => { const t = el === 'canvas' ? document.querySelector('canvas') : document.querySelector(el); const r = t.getBoundingClientRect();
    t.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: false, clientX: x ?? r.x + r.width / 2, clientY: y ?? r.y + r.height / 2, bubbles: true, cancelable: true })); }, { el, type, x, y, id });
  const thumb = { down: false };
  const stick = async (fwd, yaw) => { if (!fwd && !yaw) { if (thumb.down) await ptr('canvas', 'pointerup', 110, 640, 71); thumb.down = false; return; } if (!thumb.down) { await ptr('canvas', 'pointerdown', 110, 640, 71); thumb.down = true; } await ptr('canvas', 'pointermove', 110 + yaw * 60, 640 - fwd * 60, 71); };
  const hold = (sel, on) => ptr(sel, on ? 'pointerdown' : 'pointerup', null, null, 9 + sel.length);
  const tap = async (sel) => { const b = await page.locator(sel).boundingBox(); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); };
  const shot = async (n) => { await stepSec(page, 0.05); await page.screenshot({ path: join(out, n + '.png') }); };
  await shot('phone-1-pad-ready');
  await hold('#btn-lift', true); await stepSec(page, 9); await hold('#btn-lift', false);                    // the ramp folds first, then she rises
  await stick(1, 0); await stepSec(page, 1.2); await shot('phone-2-takeoff-and-go');
  await stepSec(page, 4); await shot('phone-3-cruise-streaks'); log.cruise = await state(page);
  await hold('#btn-boost', true); await stepSec(page, 2.5); await shot('phone-4-boost-fov'); log.boost = await state(page); await hold('#btn-boost', false);
  await stick(0.8, 1); await stepSec(page, 1.6); await shot('phone-5-turning-bank'); await stick(0, 0);
  await stepSec(page, 3); await tap('#fb-view'); await stepSec(page, 0.4); await shot('phone-6-cockpit-view'); log.cockpit = await state(page); await tap('#fb-view');
  await tap('#fb-mode'); await stepSec(page, 0.4); await shot('phone-7-newtonian'); log.newton = await state(page); await tap('#fb-mode');
  await tap('#fb-land'); await stepSec(page, 4); await shot('phone-8-landing-assist-descending'); log.landing = await state(page);
  await stepSec(page, 40); await shot('phone-9-landed'); log.landed = await state(page);
  // high and fast: UP held a long time, then forward and boost
  await hold('#btn-lift', true); await stepSec(page, 14); await hold('#btn-lift', false);
  await stick(1, 0); await hold('#btn-boost', true); await stepSec(page, 5); await shot('phone-10-high-and-fast'); log.high = await state(page); await hold('#btn-boost', false); await stick(0, 0);
  log.phoneErrors = P.errors; await P.close();

  // ---------------- desktop ----------------
  const D = await open('desktop', L.base);
  const d = D.page;
  await sitPilot(d); await stepSec(d, 1);
  const dshot = async (n) => { await stepSec(d, 0.05); await d.screenshot({ path: join(out, n + '.png') }); };
  await dshot('desktop-1-pad-ready');
  await d.keyboard.down('Space'); await stepSec(d, 9); await d.keyboard.up('Space');
  await d.keyboard.down('KeyW'); await stepSec(d, 3);
  await d.evaluate(() => { cosmos.desktop.locked = true; });
  for (let i = 0; i < 20; i++) { await d.evaluate(() => document.dispatchEvent(new MouseEvent('mousemove', { movementX: 9, movementY: -4 }))); await stepSec(d, 1 / 20); }
  await dshot('desktop-2-mouse-aim-climb');
  await d.keyboard.down('ShiftLeft'); await stepSec(d, 3); await dshot('desktop-3-boost'); log.dboost = await state(d); await d.keyboard.up('ShiftLeft');
  await d.keyboard.up('KeyW'); await stepSec(d, 4); await d.keyboard.press('KeyL'); await stepSec(d, 6); await dshot('desktop-4-landing-assist');
  log.desktopErrors = D.errors; await D.close();
  writeFileSync(join(out, 'shoot-log.json'), JSON.stringify(log, null, 1));
  console.log(JSON.stringify(log));
} finally { L.stop(); }
