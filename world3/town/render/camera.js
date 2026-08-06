/* ============================================================================
   camera.js — the camera rig
   Three modes share one output (eye / yaw / pitch) that main.js renders from:
     fps    walking, driven by the player
     orbit  a building on a turntable, with elevation presets and roof x-ray
     tour   a scripted sequence that flies between shots and flips the
            inspection layer on and off as it goes
   ========================================================================== */
(function () {
"use strict";
const T = window.TOWN, W = T.World;

const Cam = (T.Cam = {
  mode: "fps",
  eye: [0, 2, 0], yaw: 0, pitch: 0,
  target: [0, 0, 0], dist: 24, oYaw: 0.7, oPitch: 0.42,
  spin: 0, xray: false, subject: null, preset: "AERIAL",
  fov: 1.08,
});

/* --------------------------------------------------------------- presets -
   dist is a multiple of the building's diagonal, so a chapel and a cottage
   both frame properly.                                                     */
const PRESETS = {
  FRONT:  { pitch: 0.06, dist: 1.35, yawFromFront: 0,           label: "front elevation" },
  SIDE:   { pitch: 0.10, dist: 1.30, yawFromFront: Math.PI / 2, label: "side elevation" },
  AERIAL: { pitch: 0.62, dist: 1.30, yawFromFront: 0.7,         label: "three-quarter aerial" },
  ROOF:   { pitch: 1.38, dist: 1.15, yawFromFront: 0.4,         label: "roof plan" },
  EAVE:   { pitch: 0.30, dist: 0.62, yawFromFront: 0.9,         label: "eave detail" },
};
Cam.presetNames = Object.keys(PRESETS);

function subjectFrame(b) {
  const bb = b.bounds;
  const cx = (bb[0] + bb[3]) / 2, cz = (bb[2] + bb[5]) / 2;
  const top = b.top + (b.def.roof === "flat" ? 0.8 : b.def.d * 0.5 * (b.def.pitch || 0.5));
  const diag = Math.hypot(bb[3] - bb[0], bb[5] - bb[2], top);
  return { cx, cz, cy: top * 0.45, diag, front: b.yaw };
}

Cam.setPreset = function (name) {
  if (!Cam.subject || !PRESETS[name]) return;
  const p = PRESETS[name], f = subjectFrame(Cam.subject);
  Cam.preset = name;
  Cam.target = [f.cx, f.cy, f.cz];
  Cam.dist = f.diag * p.dist;
  Cam.oPitch = p.pitch;
  /* the building's front faces -Z rotated by its yaw; sit off that axis */
  Cam.oYaw = f.front + p.yawFromFront;
  T.flash(`${Cam.subject.id} ${Cam.subject.def.label} — ${p.label}`);
};

Cam.orbit = function (b, preset) {
  if (!b) { T.flash("no building in view"); return; }
  Cam.subject = b;
  Cam.mode = "orbit";
  Cam.spin = 0;
  Cam.setPreset(preset || "AERIAL");
  document.body.classList.add("orbiting");
  if (b.interior === null && b.buildInterior) T.requestInterior && T.requestInterior(b);
};

Cam.exit = function () {
  Cam.mode = "fps";
  Cam.subject = null;
  Cam.xray = false;
  document.body.classList.remove("orbiting");
  T.Tour.stop(true);
};

/* nearest building to the camera, preferring whatever is under the reticle */
Cam.pickSubject = function () {
  const P = T.Player;
  const ox = Cam.eye[0], oz = Cam.eye[2];
  const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
  let best = null, score = 1e9;
  for (const b of W.buildings) {
    const bb = b.bounds;
    const cx = (bb[0] + bb[3]) / 2, cz = (bb[2] + bb[5]) / 2;
    const dx = cx - ox, dz = cz - oz;
    const d = Math.hypot(dx, dz);
    if (d > 90) continue;
    const dot = (dx * fx + dz * fz) / (d || 1);
    const s = d * (1.6 - dot);           // in front of you counts as nearer
    if (s < score) { score = s; best = b; }
  }
  return best;
};
Cam.step = function (dir) {
  if (!Cam.subject) return;
  const i = W.buildings.indexOf(Cam.subject);
  const n = W.buildings[(i + dir + W.buildings.length) % W.buildings.length];
  Cam.subject = n;
  Cam.setPreset(Cam.preset);
};

/* ---------------------------------------------------------------- update - */
Cam.update = function (dt) {
  if (Cam.mode === "tour") { T.Tour.update(dt); return; }
  if (Cam.mode === "fps") {
    const P = T.Player;
    Cam.eye[0] = P.pos[0]; Cam.eye[1] = P.pos[1] + 1.66; Cam.eye[2] = P.pos[2];
    Cam.yaw = P.yaw; Cam.pitch = P.pitch;
    return;
  }
  /* orbit */
  Cam.oYaw += Cam.spin * dt;
  Cam.oPitch = T.clamp(Cam.oPitch, -0.25, 1.50);
  Cam.dist = T.clamp(Cam.dist, 3, 260);
  applyOrbit();
};

function applyOrbit() {
  const cp = Math.cos(Cam.oPitch), sp = Math.sin(Cam.oPitch);
  Cam.eye[0] = Cam.target[0] + Math.sin(Cam.oYaw) * cp * Cam.dist;
  Cam.eye[1] = Cam.target[1] + sp * Cam.dist;
  Cam.eye[2] = Cam.target[2] + Math.cos(Cam.oYaw) * cp * Cam.dist;
  if (Cam.eye[1] < 0.4) Cam.eye[1] = 0.4;
  lookAtTarget();
}
function lookAtTarget() {
  const dx = Cam.target[0] - Cam.eye[0], dy = Cam.target[1] - Cam.eye[1], dz = Cam.target[2] - Cam.eye[2];
  Cam.yaw = Math.atan2(-dx, -dz);
  Cam.pitch = Math.atan2(dy, Math.hypot(dx, dz));
}
Cam.applyOrbit = applyOrbit;
Cam.lookAtTarget = lookAtTarget;

/* ============================================================== the tour ==
   A shot list. Each shot names a subject, a start and end camera state, and
   whether the inspection layer is on — so the film alternates between the
   thing and the data about the thing.                                       */
const Tour = (T.Tour = { on: false, i: 0, t: 0, shots: [], caption: "" });

const ease = (u) => u * u * (3 - 2 * u);

function shot(subject, from, to, dur, debug, caption) {
  return { subject, from, to, dur, debug, caption };
}
function orbitState(b, preset, yawOffset) {
  const p = PRESETS[preset], f = subjectFrame(b);
  return {
    target: [f.cx, f.cy, f.cz],
    dist: f.diag * p.dist,
    yaw: f.front + p.yawFromFront + (yawOffset || 0),
    pitch: p.pitch,
  };
}

Tour.build = function () {
  const B = W.buildings;
  const pick = (key) => B.find((b) => b.key === key) || B[0];
  const shots = [];

  const hall = pick("townHall"), church = pick("church"), farm = pick("farmhouse");
  const vic = pick("victorian"), tudor = pick("tudor"), cape = pick("capeCod");
  const modern = pick("modern"), barn = pick("barn"), diner = pick("diner");
  const store = pick("store"), aframe = pick("aFrame"), fire = pick("fireStn");

  /* opening: high aerial over the crossroads, drifting down */
  const cx = (T.Town.roadsX[1] + T.Town.roadsX[2]) / 2;
  const cz = (T.Town.roadsZ[0] + T.Town.roadsZ[1]) / 2;
  shots.push(shot(null,
    { target: [cx, 6, cz], dist: 190, yaw: 0.5, pitch: 0.95 },
    { target: [cx, 4, cz], dist: 120, yaw: 1.4, pitch: 0.62 },
    7.0, false, "Ashgrove — 49 buildings on a 4 m grid"));

  /* the same shot again with the inspection layer up */
  shots.push(shot(null,
    { target: [cx, 4, cz], dist: 120, yaw: 1.4, pitch: 0.62 },
    { target: [cx, 4, cz], dist: 96, yaw: 2.1, pitch: 0.72 },
    5.5, true, "every asset has a permanent ID on that grid"));

  const pairs = [
    [hall, "FRONT", "the civic block — portico, pediment, brick"],
    [church, "AERIAL", "chapel: steeple, spire, louvred belfry"],
    [farm, "ROOF", "standing-seam metal roof, ridge to eave"],
    [cape, "ROOF", "shingle courses, three dormers, gable vent"],
    [vic, "AERIAL", "bay window, wrap porch, turned balusters"],
    [tudor, "FRONT", "half-timbering over brick"],
    [modern, "AERIAL", "flat roof with parapet and coping"],
    [barn, "SIDE", "gambrel — two pitches per side"],
    [aframe, "FRONT", "A-frame: roof carried to grade"],
    [fire, "FRONT", "apparatus bay, ribbed door, apron slab"],
    [diner, "EAVE", "gutter, hangers, downspout, drip cap"],
    [store, "EAVE", "awning ribs, bolts, fascia, sign brackets"],
  ];
  for (const [b, preset, cap] of pairs) {
    if (!b) continue;
    shots.push(shot(b, orbitState(b, preset, -0.55), orbitState(b, preset, 0.55), 5.0, false, `${b.id} — ${cap}`));
    shots.push(shot(b, orbitState(b, preset, 0.55), orbitState(b, preset, 0.95), 3.0, true,
      `${b.id} — collision boxes, IDs, float/bury audit`));
  }
  /* closing pull-out */
  shots.push(shot(null,
    { target: [cx, 4, cz], dist: 90, yaw: 3.0, pitch: 0.55 },
    { target: [cx, 8, cz], dist: 230, yaw: 4.4, pitch: 1.0 },
    8.0, false, "0 errors · 0 warnings · 4302 assets"));
  Tour.shots = shots;
  return shots;
};

Tour.start = function () {
  if (!Tour.shots.length) Tour.build();
  Tour.on = true; Tour.i = 0; Tour.t = 0;
  Cam.mode = "tour";
  Cam.xray = false;
  T.Debug.hudHidden = true;
  document.getElementById("topright").style.display = "none";
  document.getElementById("tourbar").style.display = "flex";
  document.body.classList.add("orbiting");
};
Tour.stop = function (quiet) {
  if (!Tour.on) return;
  Tour.on = false;
  T.Debug.on = false;
  T.Debug.hudHidden = false;
  document.getElementById("topright").style.display = "flex";
  document.getElementById("tourbar").style.display = "none";
  document.getElementById("bDbg").classList.remove("on");
  if (!quiet) { Cam.mode = "fps"; document.body.classList.remove("orbiting"); }
};
Tour.skip = function (dir) {
  Tour.i = T.clamp(Tour.i + dir, 0, Tour.shots.length - 1);
  Tour.t = 0;
};

Tour.update = function (dt) {
  const s = Tour.shots[Tour.i];
  if (!s) { Tour.stop(); Cam.mode = "fps"; document.body.classList.remove("orbiting"); return; }
  Tour.t += dt;
  const u = ease(T.clamp(Tour.t / s.dur, 0, 1));
  Cam.target[0] = T.lerp(s.from.target[0], s.to.target[0], u);
  Cam.target[1] = T.lerp(s.from.target[1], s.to.target[1], u);
  Cam.target[2] = T.lerp(s.from.target[2], s.to.target[2], u);
  Cam.dist = T.lerp(s.from.dist, s.to.dist, u);
  Cam.oYaw = T.lerp(s.from.yaw, s.to.yaw, u);
  Cam.oPitch = T.lerp(s.from.pitch, s.to.pitch, u);
  Cam.subject = s.subject;
  applyOrbit();

  if (T.Debug.on !== s.debug) {
    T.Debug.on = s.debug;
    if (s.debug) T.Debug.audit();
  }
  if (Tour.caption !== s.caption) {
    Tour.caption = s.caption;
    document.getElementById("tourcap").textContent = s.caption;
  }
  document.getElementById("tourprog").style.width =
    (((Tour.i + T.clamp(Tour.t / s.dur, 0, 1)) / Tour.shots.length) * 100).toFixed(1) + "%";

  if (Tour.t >= s.dur) { Tour.i++; Tour.t = 0; }
};

/* ---------------------------------------------------------------- input -- */
Cam.bind = function (canvas) {
  let drag = null;

  canvas.addEventListener("mousedown", (e) => {
    if (Cam.mode !== "orbit" || (T.Edit.on && T.Edit.sel)) return;
    drag = { x: e.clientX, y: e.clientY, b: e.button };
  });
  addEventListener("mousemove", (e) => {
    if (!drag || Cam.mode !== "orbit") return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY;
    if (drag.b === 2) {                       // right-drag pans the target
      const s = Cam.dist * 0.0016;
      const cy = Math.cos(Cam.oYaw), sy = Math.sin(Cam.oYaw);
      Cam.target[0] += (-cy * dx + sy * dy) * s;
      Cam.target[2] += (sy * dx + cy * dy) * s;
    } else {
      Cam.oYaw -= dx * 0.006;
      Cam.oPitch = T.clamp(Cam.oPitch + dy * 0.005, -0.25, 1.5);
    }
  });
  addEventListener("mouseup", () => (drag = null));
  canvas.addEventListener("contextmenu", (e) => { if (Cam.mode === "orbit") e.preventDefault(); });
  addEventListener("wheel", (e) => {
    if (Cam.mode !== "orbit") return;
    Cam.dist = T.clamp(Cam.dist * (1 + Math.sign(e.deltaY) * 0.11), 3, 260);
    e.preventDefault();
  }, { passive: false });

  /* touch: one finger orbits, two fingers pinch-zoom */
  let ts = null;
  addEventListener("touchstart", (e) => {
    if (Cam.mode !== "orbit" || (T.Edit.on && T.Edit.dragging)) return;
    const el = e.changedTouches[0].target;
    if (el && el.closest && el.closest(".btn, .panel, #editbar, #tourbar, #orbitbar")) return;
    ts = { t: Array.from(e.touches), d: pinch(e.touches) };
    e.preventDefault(); e.stopImmediatePropagation();
  }, { passive: false, capture: true });
  addEventListener("touchmove", (e) => {
    if (Cam.mode !== "orbit" || !ts) return;
    if (T.Edit.on && T.Edit.dragging) return;
    if (e.touches.length >= 2) {
      const d = pinch(e.touches);
      if (ts.d) Cam.dist = T.clamp(Cam.dist * (ts.d / d), 3, 260);
      ts.d = d;
    } else {
      const a = e.touches[0], p = ts.t[0];
      if (p) {
        Cam.oYaw -= (a.clientX - p.clientX) * 0.008;
        Cam.oPitch = T.clamp(Cam.oPitch + (a.clientY - p.clientY) * 0.006, -0.25, 1.5);
      }
    }
    ts.t = Array.from(e.touches);
    e.preventDefault(); e.stopImmediatePropagation();
  }, { passive: false, capture: true });
  addEventListener("touchend", () => { ts = null; }, { capture: true });
  function pinch(t) { return t.length >= 2 ? Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY) : 0; }

  /* buttons */
  const on = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
  on("bOrbit", () => (Cam.mode === "orbit" ? Cam.exit() : Cam.orbit(Cam.pickSubject())));
  on("bTour", () => (T.Tour.on ? (T.Tour.stop(), Cam.exit()) : T.Tour.start()));
  for (const n of Cam.presetNames) on("cp" + n, () => Cam.setPreset(n));
  on("cpXray", () => { Cam.xray = !Cam.xray; document.getElementById("cpXray").classList.toggle("on", Cam.xray);
                       T.flash(Cam.xray ? "x-ray: roofs and ceilings hidden" : "x-ray off"); });
  on("cpSpin", () => { Cam.spin = Cam.spin ? 0 : 0.28; document.getElementById("cpSpin").classList.toggle("on", !!Cam.spin); });
  on("cpPrev", () => Cam.step(-1));
  on("cpNext", () => Cam.step(1));
  on("cpExit", () => Cam.exit());
  on("tourStop", () => { T.Tour.stop(); Cam.exit(); });
  on("tourPrev", () => T.Tour.skip(-1));
  on("tourNext", () => T.Tour.skip(1));
};

Cam.hud = function () {
  const bar = document.getElementById("orbitbar");
  bar.style.display = Cam.mode === "orbit" ? "flex" : "none";
  if (Cam.mode !== "orbit") return;
  const b = Cam.subject;
  document.getElementById("orbitinfo").innerHTML = b
    ? `<b>${b.id}</b> ${b.def.label} · ${b.def.w.toFixed(1)}×${b.def.d.toFixed(1)} m · ` +
      `${b.plan.levels.length} storey${b.plan.levels.length > 1 ? "s" : ""} · roof ${b.def.roof}` +
      `${b.def.pitch ? ` ${(b.def.pitch * 12).toFixed(0)}:12` : ""}`
    : "orbit";
};
})();
