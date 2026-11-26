// Controls. Phone: the site's invisible floating thumbstick (left half walks, rim = run; right half drag looks) plus
// one action button. Desktop: WASD / arrows, mouse drag looks, Shift runs, Space is the action.
import { createThumbstick } from '/hb-thumbstick.js?v=1';

export function createControls(canvas, { enabled, onLook, onFirstGesture, actionButton }) {
  const keys = new Set();
  let actionQueued = false, gestured = false;
  const first = () => { if (!gestured) { gestured = true; onFirstGesture && onFirstGesture(); } };
  const stick = createThumbstick(canvas, {
    enabled,
    onLook: (dx, dy) => onLook(dx, dy),
    onTap: () => {},
  });
  canvas.addEventListener('pointerdown', first, { passive: true });
  addEventListener('keydown', (e) => {
    first();
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    const k = e.key.toLowerCase();
    if (k === ' ' || k === 'spacebar') { if (!e.repeat && enabled()) actionQueued = true; e.preventDefault(); }
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    keys.add(k);
  });
  addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  addEventListener('blur', () => keys.clear());
  if (actionButton) {
    actionButton.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); first(); if (enabled()) actionQueued = true; actionButton.classList.add('down'); }, { passive: false });
    const up = () => actionButton.classList.remove('down');
    actionButton.addEventListener('pointerup', up); actionButton.addEventListener('pointercancel', up); actionButton.addEventListener('pointerleave', up);
  }

  // Fill a game input (world space) from the controls and the camera yaw.
  function read(input, yaw) {
    let sx = stick.x, sy = stick.y, run = stick.running;
    let kx = 0, ky = 0;
    if (keys.has('w') || keys.has('arrowup')) ky += 1;
    if (keys.has('s') || keys.has('arrowdown')) ky -= 1;
    if (keys.has('d') || keys.has('arrowright')) kx += 1;
    if (keys.has('a') || keys.has('arrowleft')) kx -= 1;
    if (kx || ky) { const l = Math.hypot(kx, ky); sx = kx / l; sy = ky / l; run = keys.has('shift'); }
    const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = -Math.cos(yaw), rz = Math.sin(yaw);
    input.mx = fx * sy + rx * sx; input.mz = fz * sy + rz * sx;
    input.run = run; input.fx = fx; input.fz = fz;
  }
  function takeAction() { const a = actionQueued; actionQueued = false; return a; }
  function clear() { actionQueued = false; keys.clear(); stick.reset && stick.reset(); }
  return { read, takeAction, clear, stick, keys };
}
