/* ============================================================================
   player.js — first-person controller, collision, floors, touch input
   ========================================================================== */
(function () {
"use strict";
const T = window.TOWN, C = T.CODE, W = T.World;

const EYE = 1.660, RAD = 0.300, STEP = C.stepUp;
const WALK = 3.1, RUN = 5.6, ACC = 26, AIR = 3;

const Pl = (T.Player = {
  pos: [0, 2, 0], vel: [0, 0, 0], yaw: 0, pitch: 0,
  onGround: false, sprint: false, noclip: false,
  room: null, building: null, nearDoor: null,
  keys: {}, look: [0, 0], move: [0, 0],
});

Pl.reset = function (spawn) {
  Pl.pos = [spawn[0], spawn[1], spawn[2]];
  Pl.vel = [0, 0, 0]; Pl.yaw = 0; Pl.pitch = -0.05;
};
Pl.teleport = function (x, z, y) {
  Pl.pos[0] = x; Pl.pos[2] = z;
  Pl.pos[1] = y !== undefined ? y : Pl.floorAt(x, z, 1e5) + 0.05;
  Pl.vel = [0, 0, 0];
};

/* ---------------------------------------------------------------- floors - */
Pl.floorAt = function (x, z, feet) {
  let best = T.Town.groundY(x, z);
  const lim = feet + STEP;
  for (const s of W.surfaces) {
    if (x < s.x0 || x > s.x1 || z < s.z0 || z > s.z1) continue;
    let y;
    if (s.ramp) {
      const t = s.axis === "x" ? (x - s.x0) / Math.max(0.01, s.x1 - s.x0)
                               : (z - s.z0) / Math.max(0.01, s.z1 - s.z0);
      const u = s.asc ? t : 1 - t;
      y = s.yLo + (s.yHi - s.yLo) * T.clamp(u, 0, 1);
    } else y = s.y;
    if (y <= lim && y > best) best = y;
  }
  return best;
};

/* ------------------------------------------------------------- collision - */
function blocked(x, z, feet) {
  const lo = feet + STEP, hi = feet + 1.75;
  for (const c of W.colliders) {
    if (c.off) continue;
    if (c.y1 <= lo || c.y0 >= hi) continue;
    if (x + RAD <= c.x0 || x - RAD >= c.x1) continue;
    if (z + RAD <= c.z0 || z - RAD >= c.z1) continue;
    return c;
  }
  return null;
}
Pl.blockedAt = blocked;

/* ---------------------------------------------------------------- update - */
Pl.update = function (dt) {
  dt = Math.min(dt, 0.05);
  const sp = (Pl.sprint ? RUN : WALK);
  let mx = Pl.move[0], mz = Pl.move[1];
  const ml = Math.hypot(mx, mz);
  if (ml > 1) { mx /= ml; mz /= ml; }

  /* yaw = 0 looks down -Z, so forward = (-sin, -cos) and right = (cos, -sin).
     The forward term used to carry an extra negation, which drove you
     backwards and made every turn read as mirrored. */
  const sy = Math.sin(Pl.yaw), cy = Math.cos(Pl.yaw);
  const wantX = -sy * mz + cy * mx;
  const wantZ = -cy * mz - sy * mx;

  const a = Pl.onGround ? ACC : AIR;
  Pl.vel[0] += (wantX * sp - Pl.vel[0]) * Math.min(1, a * dt);
  Pl.vel[2] += (wantZ * sp - Pl.vel[2]) * Math.min(1, a * dt);

  if (Pl.noclip) {
    Pl.pos[0] += Pl.vel[0] * dt; Pl.pos[2] += Pl.vel[2] * dt;
    Pl.pos[1] += (Pl.keys.Space ? 6 : Pl.keys.ShiftLeft ? -6 : 0) * dt;
    Pl.updateContext(); return;
  }

  Pl.vel[1] -= 18.5 * dt;

  /* axis-separated resolution keeps you sliding along walls */
  const feet = Pl.pos[1];
  const nx = Pl.pos[0] + Pl.vel[0] * dt;
  if (!blocked(nx, Pl.pos[2], feet)) Pl.pos[0] = nx; else Pl.vel[0] = 0;
  const nz = Pl.pos[2] + Pl.vel[2] * dt;
  if (!blocked(Pl.pos[0], nz, feet)) Pl.pos[2] = nz; else Pl.vel[2] = 0;

  /* vertical */
  Pl.pos[1] += Pl.vel[1] * dt;
  const g = Pl.floorAt(Pl.pos[0], Pl.pos[2], Pl.pos[1]);
  if (Pl.pos[1] <= g + 0.001) {
    Pl.pos[1] = g;
    if (Pl.vel[1] < 0) Pl.vel[1] = 0;
    Pl.onGround = true;
    if (Pl.keys.Space) { Pl.vel[1] = 5.0; Pl.onGround = false; }
  } else Pl.onGround = false;

  /* head bump: don't rise through a ceiling collider */
  if (Pl.vel[1] > 0 && blocked(Pl.pos[0], Pl.pos[2], Pl.pos[1])) Pl.vel[1] = 0;

  if (Pl.pos[1] < -12) Pl.teleport(T.Town.spawn[0], T.Town.spawn[2]);
  Pl.updateContext();
};

/* ------------------------------------- which room / building am I in? ---- */
Pl.updateContext = function () {
  const x = Pl.pos[0], z = Pl.pos[2], y = Pl.pos[1];
  Pl.building = null; Pl.room = null;
  for (const b of W.buildings) {
    const bb = b.bounds;
    if (x < bb[0] || x > bb[3] || z < bb[2] || z > bb[5]) continue;
    Pl.building = b;
    for (const lv of b.plan.levels) {
      if (y < lv.y - 0.6 || y > lv.y + lv.ceilH) continue;
      for (const rm of lv.rooms) {
        const bx0 = Math.min(b.tx(rm.x0, rm.z0), b.tx(rm.x1, rm.z1));
        const bx1 = Math.max(b.tx(rm.x0, rm.z0), b.tx(rm.x1, rm.z1));
        const bz0 = Math.min(b.tz(rm.x0, rm.z0), b.tz(rm.x1, rm.z1));
        const bz1 = Math.max(b.tz(rm.x0, rm.z0), b.tz(rm.x1, rm.z1));
        if (x >= bx0 && x <= bx1 && z >= bz0 && z <= bz1) { Pl.room = { rm, lv, b }; break; }
      }
      if (Pl.room) break;
    }
    break;
  }
  /* nearest door in front of the camera */
  Pl.nearDoor = null;
  let best = 2.6;
  const fx = -Math.sin(Pl.yaw), fz = -Math.cos(Pl.yaw);
  for (const d of W.doors) {
    const dx = d.cx - x, dz = d.cz - z;
    const dist = Math.hypot(dx, dz);
    if (dist > best) continue;
    if (Math.abs(d.y - y) > 2.4) continue;
    if ((dx * fx + dz * fz) / (dist || 1) < 0.25) continue;
    best = dist; Pl.nearDoor = d;
  }
};

Pl.useDoor = function () {
  const d = Pl.nearDoor;
  if (!d) return false;
  d.target = d.target > 0.5 ? 0 : 1;
  return true;
};
Pl.animateDoors = function (dt) {
  for (const d of W.doors) {
    if (Math.abs(d.open - d.target) < 0.001) continue;
    const dir = d.target > d.open ? 1 : -1;
    d.open = T.clamp(d.open + dir * dt * 2.6, 0, 1);
    d.col.off = d.open > 0.25;
  }
};

/* ============================================================== INPUT ==== */
Pl.bindInput = function (canvas) {
  const K = Pl.keys;
  let locked = false;

  addEventListener("keydown", (e) => {
    K[e.code] = true;
    if (e.code === "ShiftLeft" || e.code === "ShiftRight") Pl.sprint = true;
    if (["KeyW","KeyA","KeyS","KeyD","Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.code)) e.preventDefault();
    /* E opens doors, unless edit mode has something selected — then Q/E spin it */
    if (e.code === "KeyE" && !(T.Edit && T.Edit.on && T.Edit.sel)) Pl.useDoor();
    if (T.onKey) T.onKey(e);
  });
  addEventListener("keyup", (e) => {
    K[e.code] = false;
    if (e.code === "ShiftLeft" || e.code === "ShiftRight") Pl.sprint = false;
  });
  addEventListener("blur", () => { for (const k in K) K[k] = false; Pl.sprint = false; });

  canvas.addEventListener("click", () => { if (!T.mobile && !locked) canvas.requestPointerLock(); });
  document.addEventListener("pointerlockchange", () => { locked = document.pointerLockElement === canvas; });
  addEventListener("mousemove", (e) => {
    if (!locked) return;
    /* settings (render/settings.js) are read at input time — live, no reload */
    const S = T.Settings || {};
    const k = 0.0022 * (S.sens || 1), inv = S.invertY ? -1 : 1;
    Pl.yaw -= e.movementX * k;
    Pl.pitch = T.clamp(Pl.pitch - e.movementY * k * inv, -1.52, 1.52);
  });

  /* ---- touch: left half drives the stick, right half looks ------------- */
  const stick = document.getElementById("stick");
  const knob = stick.firstElementChild;
  let stickId = null, lookId = null, sx0 = 0, sy0 = 0, lx = 0, ly = 0;

  const onStart = (e) => {
    for (const t of e.changedTouches) {
      if (t.clientX < innerWidth * 0.45 && stickId === null) {
        stickId = t.identifier;
        const r = stick.getBoundingClientRect();
        sx0 = r.left + r.width / 2; sy0 = r.top + r.height / 2;
      } else if (lookId === null) { lookId = t.identifier; lx = t.clientX; ly = t.clientY; }
    }
  };
  const onMove = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === stickId) {
        const dx = T.clamp((t.clientX - sx0) / 52, -1, 1), dy = T.clamp((t.clientY - sy0) / 52, -1, 1);
        Pl.move[0] = dx; Pl.move[1] = -dy;
        knob.style.transform = `translate(${dx * 34}px,${dy * 34}px)`;
        Pl.sprint = Math.hypot(dx, dy) > 0.92 || Pl.runLock;
      } else if (t.identifier === lookId) {
        const S = T.Settings || {};
        const k = 0.0060 * (S.sens || 1), inv = S.invertY ? -1 : 1;
        Pl.yaw -= (t.clientX - lx) * k;
        Pl.pitch = T.clamp(Pl.pitch - (t.clientY - ly) * k * inv, -1.52, 1.52);
        lx = t.clientX; ly = t.clientY;
      }
    }
    e.preventDefault();
  };
  const onEnd = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === stickId) { stickId = null; Pl.move[0] = Pl.move[1] = 0; knob.style.transform = ""; Pl.sprint = Pl.runLock; }
      if (t.identifier === lookId) lookId = null;
    }
  };
  addEventListener("touchstart", onStart, { passive: false });
  addEventListener("touchmove", onMove, { passive: false });
  addEventListener("touchend", onEnd);
  addEventListener("touchcancel", onEnd);

  if (T.mobile) {
    document.getElementById("touch").style.display = "block";
    const use = document.getElementById("tUse"), run = document.getElementById("tRun");
    use.addEventListener("touchstart", (e) => {
      e.stopPropagation();
      /* doors first; if no door was used, an NPC/workplace offer may take it */
      if (!Pl.useDoor() && T.Npcs && T.Npcs.promptAction) T.Npcs.interact();
    });
    run.addEventListener("touchstart", (e) => {
      e.stopPropagation(); Pl.runLock = !Pl.runLock; Pl.sprint = Pl.runLock;
      run.style.background = Pl.runLock ? "rgba(127,209,255,.28)" : "";
    });
  }
};

Pl.readKeys = function () {
  if (T.mobile && (Pl.move[0] || Pl.move[1])) return;
  const K = Pl.keys;
  Pl.move[0] = (K.KeyD || K.ArrowRight ? 1 : 0) - (K.KeyA || K.ArrowLeft ? 1 : 0);
  Pl.move[1] = (K.KeyW || K.ArrowUp ? 1 : 0) - (K.KeyS || K.ArrowDown ? 1 : 0);
};
})();
