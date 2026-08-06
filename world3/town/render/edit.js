/* ============================================================================
   edit.js — in-game edit mode
   Point at any piece of furniture, drag it, spin it, delete it. Changes are
   kept in localStorage per asset ID, so they survive a reload and you can
   hand the diff to an agent.
   ========================================================================== */
(function () {
"use strict";
const T = window.TOWN, W = T.World;

const E = (T.Edit = {
  on: false, sel: null, hover: null, dragging: false,
  grab: [0, 0], snap: 0.05, rotStep: Math.PI / 12,
  ray: [0, 0, 0], origin: [0, 0, 0],
  pointer: null,          // {x,y} in CSS pixels, null = use screen centre
  dirty: false,
});

const STORE = "ashgrove-edits-v1";

/* ------------------------------------------------------------ persistence */
E.load = function () {
  let data;
  try { data = JSON.parse(localStorage.getItem(STORE) || "{}"); } catch (e) { return 0; }
  let n = 0;
  for (const it of W.items) {
    const d = data[it.id];
    if (!d) continue;
    it.x = it.home.x + (d.dx || 0);
    it.z = it.home.z + (d.dz || 0);
    it.yaw = it.home.yaw + (d.dr || 0);
    it.deleted = !!d.del;
    W.syncItem(it);
    n++;
  }
  return n;
};
E.save = function () {
  const data = {};
  for (const it of W.items) {
    const dx = it.x - it.home.x, dz = it.z - it.home.z, dr = it.yaw - it.home.yaw;
    if (Math.abs(dx) < 1e-4 && Math.abs(dz) < 1e-4 && Math.abs(dr) < 1e-4 && !it.deleted) continue;
    data[it.id] = { dx: +dx.toFixed(4), dz: +dz.toFixed(4), dr: +dr.toFixed(4), del: !!it.deleted };
  }
  try { localStorage.setItem(STORE, JSON.stringify(data)); } catch (e) {}
  E.changed = Object.keys(data).length;
};
E.clearAll = function () {
  for (const it of W.items) {
    it.x = it.home.x; it.z = it.home.z; it.yaw = it.home.yaw; it.deleted = false;
    W.syncItem(it);
  }
  try { localStorage.removeItem(STORE); } catch (e) {}
  E.changed = 0;
  T.flash("all edits reset");
};

/* ------------------------------------------------------------------ ray -- */
function buildRay(px, py) {
  const P = T.Player;
  const w = T.GL.canvas.clientWidth, h = T.GL.canvas.clientHeight;
  const ndcX = (px / w) * 2 - 1, ndcY = 1 - (py / h) * 2;
  const tanH = Math.tan(1.08 / 2), asp = w / h;
  const cp = Math.cos(P.pitch), sp = Math.sin(P.pitch);
  const sy = Math.sin(P.yaw), cy = Math.cos(P.yaw);
  const f = [-sy * cp, sp, -cy * cp];
  const r = [cy, 0, -sy];
  const u = [sy * sp, cp, cy * sp];
  const d = [
    f[0] + r[0] * ndcX * tanH * asp + u[0] * ndcY * tanH,
    f[1] + r[1] * ndcX * tanH * asp + u[1] * ndcY * tanH,
    f[2] + r[2] * ndcX * tanH * asp + u[2] * ndcY * tanH,
  ];
  const l = Math.hypot(d[0], d[1], d[2]) || 1;
  E.ray = [d[0] / l, d[1] / l, d[2] / l];
  E.origin = [P.pos[0], P.pos[1] + 1.66, P.pos[2]];
}

function hitAABB(o, d, b) {           // b = [x0,y0,z0,x1,y1,z1]; returns t or -1
  let tmin = 0, tmax = 1e9;
  for (let i = 0; i < 3; i++) {
    const inv = 1 / (d[i] || 1e-9);
    let t0 = (b[i] - o[i]) * inv, t1 = (b[i + 3] - o[i]) * inv;
    if (t0 > t1) { const t = t0; t0 = t1; t1 = t; }
    tmin = Math.max(tmin, t0); tmax = Math.min(tmax, t1);
    if (tmax < tmin) return -1;
  }
  return tmin;
}

E.pick = function () {
  const w = T.GL.canvas.clientWidth, h = T.GL.canvas.clientHeight;
  const p = E.pointer || { x: w / 2, y: h / 2 };
  buildRay(p.x, p.y);
  let best = null, bt = 7.5;
  for (const it of W.items) {
    if (it.deleted) continue;
    const hw = it.fw / 2, hd = it.fd / 2;
    const box = [it.x - hw, it.y, it.z - hd, it.x + hw, it.y + Math.max(0.12, it.h), it.z + hd];
    const t = hitAABB(E.origin, E.ray, box);
    if (t >= 0 && t < bt) { bt = t; best = it; }
  }
  return best;
};

/* -------------------------------------------------------------- actions -- */
function planeHit(y) {
  const dy = E.ray[1];
  if (Math.abs(dy) < 1e-5) return null;
  const t = (y - E.origin[1]) / dy;
  if (t < 0.15 || t > 14) return null;
  return [E.origin[0] + E.ray[0] * t, E.origin[2] + E.ray[2] * t];
}

E.beginDrag = function () {
  if (!E.sel) return false;
  const w = T.GL.canvas.clientWidth, h = T.GL.canvas.clientHeight;
  const p = E.pointer || { x: w / 2, y: h / 2 };
  buildRay(p.x, p.y);
  const hit = planeHit(E.sel.y + 0.02);
  if (!hit) return false;
  E.grab = [E.sel.x - hit[0], E.sel.z - hit[1]];
  E.dragging = true;
  return true;
};
E.drag = function () {
  if (!E.dragging || !E.sel) return;
  const w = T.GL.canvas.clientWidth, h = T.GL.canvas.clientHeight;
  const p = E.pointer || { x: w / 2, y: h / 2 };
  buildRay(p.x, p.y);
  const hit = planeHit(E.sel.y + 0.02);
  if (!hit) return;
  const s = E.snap;
  E.sel.x = Math.round((hit[0] + E.grab[0]) / s) * s;
  E.sel.z = Math.round((hit[1] + E.grab[1]) / s) * s;
  W.syncItem(E.sel);
  E.dirty = true;
};
E.endDrag = function () {
  if (!E.dragging) return;
  E.dragging = false;
  if (E.dirty) { E.save(); E.dirty = false; }
};
E.rotate = function (dir) {
  if (!E.sel) return;
  E.sel.yaw += dir * E.rotStep;
  W.syncItem(E.sel);
  E.save();
};
E.nudgeY = function (dy) {
  if (!E.sel) return;
  E.sel.y = Math.max(E.sel.y + dy, 0);
  W.syncItem(E.sel);
  E.save();
};
E.del = function () {
  if (!E.sel) return;
  E.sel.deleted = !E.sel.deleted;
  W.syncItem(E.sel);
  E.save();
  T.flash(E.sel.deleted ? `${E.sel.id} hidden` : `${E.sel.id} restored`);
};
E.reset = function () {
  if (!E.sel) return;
  E.sel.x = E.sel.home.x; E.sel.z = E.sel.home.z; E.sel.yaw = E.sel.home.yaw; E.sel.deleted = false;
  W.syncItem(E.sel);
  E.save();
  T.flash(`${E.sel.id} reset`);
};

/* --------------------------------------------------------------- toggle -- */
E.toggle = function (force) {
  E.on = force === undefined ? !E.on : force;
  document.getElementById("bEdit").classList.toggle("on", E.on);
  document.getElementById("editbar").style.display = E.on ? "flex" : "none";
  if (!E.on) { E.sel = null; E.hover = null; E.dragging = false; }
  else T.flash("edit mode — point at a thing, drag to move, Q/E to spin, X to hide");
  E.panel();
};

E.panel = function () {
  const el = document.getElementById("editinfo");
  if (!E.on) return;
  const it = E.sel || E.hover;
  el.innerHTML = it
    ? `<b>${it.id}</b>  ${it.kind}${it.deleted ? "  (hidden)" : ""}<br>` +
      `${it.x.toFixed(2)}, ${it.y.toFixed(2)}, ${it.z.toFixed(2)}   ${((it.yaw * 180 / Math.PI) % 360).toFixed(0)}°` +
      (E.sel ? "" : "  — click to select")
    : "point at a piece of furniture";
};

/* --------------------------------------------------------------- render -- */
const SEL = [1, 0.85, 0.2, 0.95], HOV = [0.5, 0.9, 1, 0.7], GHOST = [1, 0.85, 0.2, 0.35];
E.lines = function (lb) {
  if (!E.on) return;
  if (E.hover && E.hover !== E.sel) {
    const h = E.hover, hw = h.fw / 2, hd = h.fd / 2;
    lb.box([h.x - hw, h.y, h.z - hd, h.x + hw, h.y + Math.max(0.12, h.h), h.z + hd], HOV);
  }
  if (E.sel) {
    const s = E.sel, hw = s.fw / 2, hd = s.fd / 2;
    lb.box([s.x - hw, s.y, s.z - hd, s.x + hw, s.y + Math.max(0.12, s.h), s.z + hd], SEL);
    /* footprint on the floor + a facing tick, so rotation is legible */
    lb.box([s.x - hw, s.y + 0.004, s.z - hd, s.x + hw, s.y + 0.006, s.z + hd], GHOST);
    const fx = -Math.sin(s.yaw), fz = -Math.cos(s.yaw);
    lb.line(s.x, s.y + 0.02, s.z, s.x + fx * (hd + 0.45), s.y + 0.02, s.z + fz * (hd + 0.45), SEL);
  }
};

/* ---------------------------------------------------------------- input -- */
E.bind = function (canvas) {
  const isTouch = T.mobile;

  canvas.addEventListener("mousemove", (e) => {
    if (!E.on) return;
    if (document.pointerLockElement === canvas) E.pointer = null;
    else E.pointer = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener("mousedown", (e) => {
    if (!E.on || e.button !== 0) return;
    const hit = E.pick();
    if (hit) { E.sel = hit; E.beginDrag(); e.preventDefault(); }
    else E.sel = null;
    E.panel();
  });
  addEventListener("mouseup", () => E.endDrag());
  addEventListener("wheel", (e) => { if (E.on && E.sel) { E.rotate(e.deltaY > 0 ? 1 : -1); e.preventDefault(); } },
                   { passive: false });

  /* Touch. These listeners live on window and are registered BEFORE the
     player's, so when a tap lands on a piece of furniture we can claim the
     touch with stopImmediatePropagation and the look-camera never sees it.
     Anything we don't claim falls through to walking and looking. */
  let tId = null;
  addEventListener("touchstart", (e) => {
    if (!E.on || tId !== null) return;
    const t = e.changedTouches[0];
    if (t.clientX < innerWidth * 0.45 && t.clientY > innerHeight * 0.62) return;  // joystick zone
    const el = t.target;
    if (el && el.closest && el.closest("#touch, .btn, .panel, #editbar")) return;  // a control, not the world
    E.pointer = { x: t.clientX, y: t.clientY };
    const hit = E.pick();
    if (hit) {
      tId = t.identifier;
      E.sel = hit; E.beginDrag();
      e.preventDefault(); e.stopImmediatePropagation();
    } else if (E.sel) {
      E.sel = null;                       // tap empty space to deselect
    }
    E.panel();
  }, { passive: false, capture: true });
  addEventListener("touchmove", (e) => {
    if (!E.on || tId === null) return;
    for (const t of e.changedTouches) {
      if (t.identifier !== tId) continue;
      E.pointer = { x: t.clientX, y: t.clientY };
      if (E.dragging) { E.drag(); e.preventDefault(); e.stopImmediatePropagation(); }
    }
  }, { passive: false, capture: true });
  const endTouch = (e) => {
    for (const t of e.changedTouches) if (t.identifier === tId) { tId = null; E.endDrag(); E.pointer = null; }
  };
  addEventListener("touchend", endTouch, { capture: true });
  addEventListener("touchcancel", endTouch, { capture: true });

  document.getElementById("bEdit").onclick = () => E.toggle();
  document.getElementById("eRotL").onclick = () => E.rotate(-1);
  document.getElementById("eRotR").onclick = () => E.rotate(1);
  document.getElementById("eDel").onclick = () => E.del();
  document.getElementById("eReset").onclick = () => E.reset();
  document.getElementById("eResetAll").onclick = () => E.clearAll();
};

/* per-frame: keep hover fresh and keep dragging alive under the mouse */
E.update = function () {
  if (!E.on) { document.getElementById("editbar").style.display = "none"; return; }
  if (E.dragging) E.drag();
  else E.hover = E.pick();
  E.panel();
};
})();
