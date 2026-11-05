// hb-thumbstick.js - the invisible floating thumbstick for the walkable worlds (World 2, Real City, and the ones after).
// Jaron 11/5: "I don't want to tap to walk. I want to walk." + keep the screen clean: nothing on screen until a thumb
// touches the left side; the stick appears right where the thumb lands, follows it, and is gone on release.
// The right side is look-drag the same way, with no visible pad. Mouse: drag looks, a click is a tap.
// A quick tap (no drag) anywhere is handed to onTap, so worlds can let you USE things (doors, mats) by touching them.
//
// Built for driving later too: read stick.x / stick.y (-1..1, deadzone + smooth curve already applied) as
// steer / throttle, and stick.mag (0..1) as how hard the thumb is pushing. Pushing to the rim (mag > runAt) = run.
//
// Usage:
//   import { createThumbstick } from "/hb-thumbstick.js?v=1";
//   const stick = createThumbstick(canvas, { enabled: () => inWorld, onLook: (dx, dy, kind) => {...}, onTap: (x, y) => {...} });
//   each frame: forward = stick.y; strafe = stick.x; running = stick.running;

const CSS = `
.hb-stick{position:fixed;left:0;top:0;width:0;height:0;z-index:29;pointer-events:none;opacity:0;transition:opacity .12s ease-out}
.hb-stick.on{opacity:1}
.hb-stick i{position:absolute;border-radius:50%;transform:translate(-50%,-50%)}
.hb-stick .b{border:1.5px solid rgba(255,255,255,.28);background:radial-gradient(circle,rgba(255,255,255,.07),rgba(255,255,255,.02) 70%)}
.hb-stick .k{width:46px;height:46px;background:rgba(255,255,255,.34);border:1.5px solid rgba(255,255,255,.55);box-shadow:0 2px 10px rgba(0,0,0,.25)}
.hb-stick.run .k{background:rgba(232,184,106,.55);border-color:rgba(255,226,170,.85)}
`;

export function createThumbstick(surface, opts = {}) {
  const o = Object.assign({
    leftFraction: 0.5,     // the left part of the screen where a touch becomes the stick
    radius: 58,            // px from the centre to the rim
    deadzone: 0.1,
    runAt: 0.94,           // push to the rim = run
    enabled: () => true,
    onLook: () => {},
    onTap: () => {},
  }, opts);

  if (!document.getElementById("hb-stick-css")) {
    const st = document.createElement("style"); st.id = "hb-stick-css"; st.textContent = CSS; document.head.appendChild(st);
  }
  const el = document.createElement("div"); el.className = "hb-stick"; el.setAttribute("aria-hidden", "true");
  const base = document.createElement("i"); base.className = "b";
  const knob = document.createElement("i"); knob.className = "k";
  base.style.width = base.style.height = o.radius * 2 + "px";
  el.append(base, knob); document.body.appendChild(el);

  const stick = { x: 0, y: 0, mag: 0, running: false, active: false, reset };
  const S = { id: null, ox: 0, oy: 0, fx: 0, fy: 0, x0: 0, y0: 0, t0: 0, moved: false };   // the stick finger
  const L = { id: null, x: 0, y: 0, x0: 0, y0: 0, t0: 0, moved: false, kind: "" };          // the look finger / mouse

  function paint() {
    el.style.transform = `translate(${S.ox}px, ${S.oy}px)`;
    knob.style.left = (S.fx - S.ox) + "px"; knob.style.top = (S.fy - S.oy) + "px";
    el.classList.toggle("run", stick.running);
  }
  function solve() {
    let dx = S.fx - S.ox, dy = S.fy - S.oy, d = Math.hypot(dx, dy);
    if (d > o.radius) {   // the stick follows the thumb: drag past the rim and the base slides after it
      const k = (d - o.radius) / d; S.ox += dx * k; S.oy += dy * k; dx = S.fx - S.ox; dy = S.fy - S.oy; d = o.radius;
    }
    const raw = d / o.radius;
    const m = raw <= o.deadzone ? 0 : Math.min(1, (raw - o.deadzone) / (1 - o.deadzone));
    const curved = m * m * (3 - 2 * m) * 0.35 + m * 0.65;   // gentle start, full at the rim (fine control, later for steering too)
    stick.mag = curved;
    stick.x = d > 0 ? dx / d * curved : 0;
    stick.y = d > 0 ? -dy / d * curved : 0;
    stick.running = raw >= o.runAt;
    paint();
  }
  function endStick() {
    S.id = null; stick.active = false; stick.x = stick.y = stick.mag = 0; stick.running = false;
    el.classList.remove("on", "run");
  }
  function reset() { endStick(); L.id = null; }

  surface.addEventListener("pointerdown", (e) => {
    if (!o.enabled()) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const touch = e.pointerType !== "mouse";
    if (touch && S.id === null && e.clientX < window.innerWidth * o.leftFraction) {
      S.id = e.pointerId; S.ox = S.fx = S.x0 = e.clientX; S.oy = S.fy = S.y0 = e.clientY; S.t0 = performance.now(); S.moved = false;
      stick.active = true; solve(); el.classList.add("on");
    } else if (L.id === null) {
      L.id = e.pointerId; L.x = L.x0 = e.clientX; L.y = L.y0 = e.clientY; L.t0 = performance.now(); L.moved = false; L.kind = e.pointerType;
    } else return;
    try { surface.setPointerCapture(e.pointerId); } catch (err) {}
    if (touch) e.preventDefault();
  }, { passive: false });

  surface.addEventListener("pointermove", (e) => {
    if (e.pointerId === S.id) {
      S.fx = e.clientX; S.fy = e.clientY;
      if (!S.moved && Math.hypot(S.fx - S.x0, S.fy - S.y0) > 9) S.moved = true;
      solve();
    } else if (e.pointerId === L.id) {
      if (!L.moved && Math.hypot(e.clientX - L.x0, e.clientY - L.y0) > 7) L.moved = true;
      if (L.moved) o.onLook(e.clientX - L.x, e.clientY - L.y, L.kind);
      L.x = e.clientX; L.y = e.clientY;
    }
  });

  function up(e) {
    if (e.pointerId === S.id) {
      const tap = e.type === "pointerup" && !S.moved && performance.now() - S.t0 < 400;
      endStick();
      if (tap) o.onTap(e.clientX, e.clientY);
    } else if (e.pointerId === L.id) {
      const tap = e.type === "pointerup" && !L.moved && performance.now() - L.t0 < 600;
      L.id = null;
      if (tap) o.onTap(e.clientX, e.clientY);
    }
  }
  surface.addEventListener("pointerup", up);
  surface.addEventListener("pointercancel", up);
  surface.addEventListener("lostpointercapture", (e) => { if (e.pointerId === S.id) endStick(); else if (e.pointerId === L.id) L.id = null; });

  // iPhone Safari: no page bounce, pinch-zoom or double-tap zoom while two thumbs are on the glass
  surface.style.touchAction = "none";
  surface.addEventListener("touchmove", (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
  for (const ev of ["gesturestart", "gesturechange"]) document.addEventListener(ev, (e) => { if (o.enabled() && e.cancelable) e.preventDefault(); }, { passive: false });
  window.addEventListener("blur", reset);
  document.addEventListener("visibilitychange", () => { if (document.hidden) reset(); });

  return stick;
}
