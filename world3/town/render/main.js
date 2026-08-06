/* ============================================================================
   main.js — boot, render loop, lazy interiors, HUD
   ========================================================================== */
(function () {
"use strict";
const T = window.TOWN, C = T.CODE, W = T.World, m4 = T.m4;
let gl, prog, lineProg, skyProg, sky, lb;
const M = () => T.Mats;

/* --------------------------------------------------------------- camera - */
const view = m4.create(), proj = m4.create(), vp = m4.create();
const identity = m4.ident(m4.create());
const model = m4.create();
const itemBox = new Float32Array(6);
let planes = new Float32Array(24);

/* yaw-only model matrix, matching the builder's transform convention */
function setModel(m, x, y, z, yaw) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  m[0] = c; m[1] = 0; m[2] = -s; m[3] = 0;
  m[4] = 0; m[5] = 1; m[6] = 0; m[7] = 0;
  m[8] = s; m[9] = 0; m[10] = c; m[11] = 0;
  m[12] = x; m[13] = y; m[14] = z; m[15] = 1;
  return m;
}

/* ------------------------------------------------------------ lighting -- */
const SUN_DAY = {
  dir: (() => { const d = [0.42, 0.72, 0.55]; const l = Math.hypot(...d); return [d[0] / l, d[1] / l, d[2] / l]; })(),
  sun: [4.4, 4.05, 3.5], sky: [0.40, 0.47, 0.60], gnd: [0.30, 0.28, 0.25],
  fog: [0.66, 0.74, 0.82], skyTop: [0.24, 0.42, 0.78], horiz: [0.72, 0.80, 0.86], fogNear: 90, fogFar: 320,
};
const SUN_NIGHT = {
  dir: [-0.30, 0.60, -0.42], sun: [0.16, 0.20, 0.34], sky: [0.055, 0.070, 0.115], gnd: [0.020, 0.022, 0.030],
  fog: [0.055, 0.065, 0.095], skyTop: [0.020, 0.030, 0.070], horiz: [0.075, 0.085, 0.130], fogNear: 40, fogFar: 190,
};
let night = false;
/* single writer for the day/night state, kept in sync with the persisted
   setting (render/settings.js) so the N hotkey and the panel checkbox never
   disagree. No flash here — callers announce their own change. */
T.setNight = function (v) {
  night = !!v;
  if (T.Settings && T.Settings.night !== night) {
    T.Settings.night = night;
    if (T.saveSettings) T.saveSettings();
  }
  if (T.SettingsUI && T.SettingsUI.sync) T.SettingsUI.sync();
};
const L = Object.assign({}, SUN_DAY);
function lerpLight(a, dt) {
  const k = Math.min(1, dt * 2.2);
  for (const key of ["dir", "sun", "sky", "gnd", "fog", "skyTop", "horiz"])
    for (let i = 0; i < 3; i++) L[key][i] = T.lerp(L[key][i], a[key][i], k);
  L.fogNear = T.lerp(L.fogNear, a.fogNear, k);
  L.fogFar = T.lerp(L.fogFar, a.fogFar, k);
}

/* ------------------------------------------------------------ door mesh - */
const doorMeshes = {};
function buildDoorMesh(w) {
  const b = new T.Builder();
  const h = C.doorH, th = C.doorThk, paint = M().paint, metal = M().metal;
  const o = { tint: [1, 1, 1], bevel: 0.006 };
  b.box(0, 0, -th / 2, w, h, th, paint, o);
  /* stile-and-rail panels — separate meshes, real reveals */
  for (let r = 0; r < 2; r++) {
    const py = 0.22 + r * (h * 0.46);
    b.box(0.12, py, -th / 2 - 0.008, w - 0.24, h * 0.36, 0.010, paint, { tint: [.96, .96, .95], bevel: 0.006 });
    b.box(0.12, py, th / 2 - 0.002, w - 0.24, h * 0.36, 0.010, paint, { tint: [.96, .96, .95], bevel: 0.006 });
  }
  /* hinges, handle, strike */
  for (const hy of [0.28, h / 2, h - 0.28]) T.Detail.hinge(b, 0.004, hy, 0, 1, metal);
  T.Detail.handle(b, w - 0.075, 1.02, th / 2, 1, metal);
  T.Detail.handle(b, w - 0.075, 1.02, -th / 2, -1, metal);
  b.cyl(w - 0.075, 0.94, th / 2 + 0.004, 0.012, 0.012, 0.006, 8, metal, { tint: [.7, .68, .5] });
  const mesh = b.build();
  return mesh;
}

/* --------------------------------------------------------- interior LOD - */
const liveInteriors = [];
function updateInteriors(px, pz) {
  let built = 0;
  for (const b of W.buildings) {
    const d = Math.max(0, Math.abs((b.bounds[0] + b.bounds[3]) / 2 - px) - (b.bounds[3] - b.bounds[0]) / 2) +
              Math.max(0, Math.abs((b.bounds[2] + b.bounds[5]) / 2 - pz) - (b.bounds[5] - b.bounds[2]) / 2);
    b.dist = d;
    const want = (b === T.Cam.subject) ? 1e9 : T.Q.interiorDist;
    if (d < want && !b.interior && built < 1) {
      b.interior = b.buildInterior();
      liveInteriors.push(b);
      built++;
    }
  }
  if (liveInteriors.length > 16) {
    liveInteriors.sort((a, b) => a.dist - b.dist);
    while (liveInteriors.length > 16) {
      const b = liveInteriors.pop();
      if (b.dist < 60 || b === T.Cam.subject) { liveInteriors.unshift(b); break; }
      b.interior.free(); b.interior = null;
    }
  }
}
T.requestInterior = function (b) {
  if (b && !b.interior) { b.interior = b.buildInterior(); b.dist = 0; liveInteriors.push(b); }
};

/* ---------------------------------------------------------------- draw -- */
function drawMesh(mesh, mdl, decalPass) {
  if (!mesh || mesh.empty) return;
  mesh.bind(prog);
  gl.uniformMatrix4fv(prog.u.uModel, false, mdl || identity);
  const xray = T.Cam.xray;
  for (const g of mesh.groups) {
    const mat = g.mat;
    const isDecal = !!mat.decal;
    if (isDecal !== !!decalPass) continue;
    if (xray && mat.name === "ceiling") continue;   // lift the lid
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, mat.tex);
    gl.uniform1f(prog.u.uRough, mat.rough);
    gl.uniform1f(prog.u.uMetal, mat.metal);
    gl.uniform1f(prog.u.uAlphaMode, mat.cutout ? 1 : 0);
    gl.uniform1f(prog.u.uDecal, isDecal ? 1 : 0);
    gl.drawElements(gl.TRIANGLES, g.count, mesh.idxType, g.offset);
    T.GL.drawCalls++; T.GL.tris += g.count / 3;
  }
}

function setLamps(px, py, pz) {
  const near = [];
  const want = night || (T.Player.room != null);
  if (want) {
    for (const lp of W.lamps) {
      if (lp.indoor && !T.Player.building) continue;
      const d = (lp.x - px) ** 2 + (lp.z - pz) ** 2 + (lp.y - py) ** 2;
      if (d > lp.r * lp.r * 1.6) continue;
      near.push({ lp, d });
    }
    near.sort((a, b) => a.d - b.d);
  }
  const buf = new Float32Array(32);
  for (let i = 0; i < 8; i++) {
    if (i < near.length) {
      const l = near[i].lp;
      buf[i * 4] = l.x; buf[i * 4 + 1] = l.y; buf[i * 4 + 2] = l.z; buf[i * 4 + 3] = l.r;
    }
  }
  gl.uniform4fv(prog.u.uLamps, buf);
  /* by day the fittings are just fill; at night they carry the scene */
  const k = night ? 1.0 : 0.34;
  gl.uniform3f(prog.u.uLampCol, 1.15 * k, 0.92 * k, 0.62 * k);
}

/* ============================================================== render == */
let last = 0, fpsAcc = 0, fpsN = 0, fps = 60;
function frame(ts) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (ts - last) / 1000 || 0.016); last = ts;
  fpsAcc += dt; fpsN++;
  if (fpsAcc > 0.4) { fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }

  const P = T.Player;
  const Cam = T.Cam;
  if (Cam.mode === "fps") { P.readKeys(); P.update(dt); }
  if (T.Npcs) T.Npcs.update(dt, ts);
  P.animateDoors(dt);
  Cam.update(dt);
  lerpLight(night ? SUN_NIGHT : SUN_DAY, dt);
  T.GL.resize();

  const ex = Cam.eye[0], ey = Cam.eye[1], ez = Cam.eye[2];
  const cp = Math.cos(Cam.pitch), sp = Math.sin(Cam.pitch);
  const fx = -Math.sin(Cam.yaw) * cp, fy = sp, fz = -Math.cos(Cam.yaw) * cp;
  m4.persp(proj, 1.08, T.GL.w / T.GL.h, 0.06, 900);
  m4.lookAt(view, ex, ey, ez, ex + fx, ey + fy, ez + fz, 0, 1, 0);
  m4.mul(vp, proj, view);
  planes = T.frustum(vp, planes);

  updateInteriors(ex, ez);

  T.GL.drawCalls = 0; T.GL.tris = 0;
  gl.clearColor(L.fog[0], L.fog[1], L.fog[2], 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  /* sky */
  gl.depthMask(false);
  skyProg.use();
  gl.uniformMatrix4fv(skyProg.u.uVP, false, vp);
  gl.uniform3f(skyProg.u.uCam, ex, ey, ez);
  gl.uniform3fv(skyProg.u.uSkyCol, L.skyTop);
  gl.uniform3fv(skyProg.u.uHorizCol, L.horiz);
  gl.uniform3fv(skyProg.u.uSunDir, L.dir);
  gl.uniform3fv(skyProg.u.uSunCol, L.sun);
  sky.bind(skyProg);
  gl.drawElements(gl.TRIANGLES, sky.groups[0].count, sky.idxType, sky.groups[0].offset);
  gl.depthMask(true);

  /* world */
  prog.use();
  gl.uniformMatrix4fv(prog.u.uVP, false, vp);
  gl.uniform3f(prog.u.uCam, ex, ey, ez);
  gl.uniform3fv(prog.u.uSunDir, L.dir);
  gl.uniform3fv(prog.u.uSunCol, L.sun);
  gl.uniform3fv(prog.u.uSkyCol, L.sky);
  gl.uniform3fv(prog.u.uGndCol, L.gnd);
  gl.uniform3fv(prog.u.uFogCol, L.fog);
  gl.uniform2f(prog.u.uFog, L.fogNear, L.fogFar);
  gl.uniform3f(prog.u.uTint, 1, 1, 1);
  gl.uniform1f(prog.u.uEmit, 0);
  gl.uniform1f(prog.u.uOpacity, 1);
  setLamps(ex, ey, ez);

  const visChunks = [];
  for (const ch of T.Town.chunks.values()) {
    if (!ch.mesh || ch.mesh.empty) continue;
    if (!T.aabbVisible(planes, ch.bounds)) continue;
    visChunks.push(ch);
    drawMesh(ch.mesh, identity, false);
  }
  for (const ch of visChunks) {
    const cx = (ch.bounds[0] + ch.bounds[3]) / 2, cz = (ch.bounds[2] + ch.bounds[5]) / 2;
    if (Math.hypot(cx - ex, cz - ez) < T.Q.detailDist) drawMesh(ch.detailMesh, identity, false);
  }
  /* roofs are a separate mesh per building so x-ray can drop them */
  if (!T.Cam.xray) {
    for (const b of W.buildings) {
      if (!b.roofMesh || b.roofMesh.empty) continue;
      if (!T.aabbVisible(planes, b.roofMesh.bounds)) continue;
      drawMesh(b.roofMesh, identity, false);
    }
  }
  const interiorRange = T.Cam.mode === "fps" ? 42 : 300;
  for (const b of liveInteriors) {
    if ((b.dist > interiorRange && b !== T.Cam.subject) || !b.interior) continue;
    if (!T.aabbVisible(planes, b.interior.bounds)) continue;
    drawMesh(b.interior, identity, false);
    /* furniture: one draw per piece, from a shared mesh cache */
    for (const it of b.items) {
      if (it.deleted) continue;
      const dx = it.x - ex, dz = it.z - ez;
      if (dx * dx + dz * dz > 900) continue;
      const hw = it.fw / 2, hd = it.fd / 2;
      itemBox[0] = it.x - hw; itemBox[1] = it.y; itemBox[2] = it.z - hd;
      itemBox[3] = it.x + hw; itemBox[4] = it.y + it.h; itemBox[5] = it.z + hd;
      if (!T.aabbVisible(planes, itemBox)) continue;
      setModel(model, it.x, it.y, it.z, it.yaw);
      drawMesh(T.furnitureMesh(it.kind, it.p), model, false);
    }
  }
  /* door leaves */
  for (const d of W.doors) {
    if (Math.hypot(d.cx - ex, d.cz - ez) > 34) continue;
    setModel(model, d.wx, d.y, d.wz, d.baseYaw + d.open * 1.48);
    const mesh = doorMeshes[d.w.toFixed(3)] || doorMeshes[C.doorIntW.toFixed(3)];
    gl.uniform3fv(prog.u.uTint, d.tint);
    drawMesh(mesh, model, false);
  }
  gl.uniform3f(prog.u.uTint, 1, 1, 1);

  /* people and pets, ghosted through the world (no colliders by design) */
  if (T.Npcs) T.Npcs.draw(drawMesh, setModel, planes, ex, ez);
  gl.uniform3f(prog.u.uTint, 1, 1, 1);

  /* decals (contact shadows) — multiply, no depth write */
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ZERO, gl.SRC_COLOR);
  gl.depthMask(false);
  for (const ch of visChunks) drawMesh(ch.mesh, identity, true);
  gl.depthMask(true);
  gl.disable(gl.BLEND);

  /* inspection layer + edit gizmos share the line pass */
  T.Edit.update();
  if (T.Debug.on || T.Edit.on) {
    if (T.Debug.on) T.Debug.buildLines(lb, ex, ez, ey);
    else lb.clear();
    T.Edit.lines(lb);
    lb.upload();
    lineProg.use();
    gl.uniformMatrix4fv(lineProg.u.uVP, false, vp);
    gl.uniform1f(lineProg.u.uAlpha, 1);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    lb.draw(lineProg);
    gl.depthMask(true); gl.disable(gl.BLEND);
  }
  T.Debug.updateLabels(vp, ex, ez);

  hud();
  T.Cam.hud();
  T.TownPanel.frame(ts);
  T.Debug.panel({ fps, draws: T.GL.drawCalls, tris: T.GL.tris, interiors: liveInteriors.length });
}

/* ------------------------------------------------- town status panel (J) - */
/* Everything shown is read live from the restored sim via N.simState() —
   no copies, no fake numbers. If the NPC layer never initialised (no sim),
   the panel says "no living world yet" instead of showing zeros. */
const TownPanel = (T.TownPanel = {
  open: false, lastBuild: 0,
  toggle(force) {
    const el = document.getElementById("town");
    const show = force === undefined ? el.style.display !== "block" : force;
    el.style.display = show ? "block" : "none";
    document.getElementById("bTown").classList.toggle("on", show);
    this.open = show;
    if (show) this.build();
  },
  frame(ts) {
    /* piggybacks the render loop like T.Debug.panel; rebuilds at most 2×/s */
    if (!this.open || ts - this.lastBuild < 500) return;
    this.build();
  },
  build() {
    this.lastBuild = performance.now();
    const body = document.getElementById("townBody");
    const st = T.Npcs && T.Npcs.simState ? T.Npcs.simState() : null;
    if (!st) { body.innerHTML = `<div class="row"><span>no living world yet</span></div>`; return; }
    const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const row = (k, v, cls) => `<div class="row${cls ? " " + cls : ""}"><span>${k}</span><span>${v}</span></div>`;

    const alive = Object.values(st.people).filter((p) => p.alive).length;
    let out = row("day", st.day) +
      row("population", alive) +
      row("households", Object.keys(st.households).length) +
      row("buildings", T.Town.buildingCount);

    /* stocks. state.counters are LIFETIME totals (sim/resources.js step 8.4),
       so the day's net rate is derived here from live state instead:
       production from occupied utility seats (plus the player seat inside
       the same show-up gate the engine uses) minus ASH.consumptionFor().
       Mirrors step 8.1–8.3 exactly — display only, the sim is untouched. */
    const R = ASH.RESOURCE;
    const prod = { food: 0, water: 0, energy: 0 };
    for (const biz of Object.values(st.businesses))
      for (const seat of biz.seats) {
        const res = R.ROLE_RESOURCE[seat.role];
        if (!res || !seat.occupantId || !st.people[seat.occupantId]) continue;
        prod[res] += R.PRODUCE[seat.role];
      }
    if (st.player && st.player.seatId && st.day - st.player.lastWorkDay <= 1) {
      const biz = st.businesses[st.player.employerId];
      const seat = biz && biz.seats.find((s) => s.id === st.player.seatId);
      const res = seat && R.ROLE_RESOURCE[seat.role];
      if (res) prod[res] += R.PRODUCE[seat.role];
    }
    const cons = ASH.consumptionFor(st);
    out += `<div class="sec"><h3>STOCKS</h3>`;
    for (const r of ["food", "water", "energy"]) {
      const net = prod[r] - cons[r];
      const netTxt = (net >= 0 ? "+" : "−") + Math.abs(net) + "/day";
      const bad = st.stocks[r] === 0 || st.hardship[r] > 0;
      out += row(r, `${st.stocks[r]} · ${netTxt}`, bad ? "bad" : "");
      if (st.hardship[r] > 0)
        out += row(`short of ${r}`, `${st.hardship[r]} day(s)`, "bad");
    }
    out += `</div>`;

    /* jobs: seats filled / total per business; an occupant outside
       state.people is the player (D12 — the player is never in people) */
    out += `<div class="sec"><h3>JOBS</h3>`;
    for (const biz of Object.values(st.businesses)) {
      const filled = biz.seats.filter((s) => s.occupantId).length;
      const you = biz.seats.some((s) => s.occupantId && !st.people[s.occupantId]);
      out += row(esc(biz.name) + (you ? " <b>(you)</b>" : ""), `${filled}/${biz.seats.length}`);
    }
    out += `</div>`;

    const evs = st.events.slice(-8).reverse();
    out += `<div class="sec"><h3>RECENT EVENTS</h3>` +
      (evs.length
        ? evs.map((e) => `<div class="ev"><b>d${e.day}</b>  ${esc(e.msg)}</div>`).join("")
        : `<div class="row"><span>nothing yet</span></div>`) +
      `</div>`;
    body.innerHTML = out;
  },
});

/* ------------------------------------------------------------------ hud - */
function hud() {
  const P = T.Player;
  const el = document.getElementById("readout");
  if (T.Debug.hudHidden) { el.style.display = "none"; document.getElementById("crosshair").style.display = "none"; return; }
  el.style.display = "block"; document.getElementById("crosshair").style.display = "block";
  const room = P.room ? `${P.room.rm.name}  ${P.room.rm.gid}` : (P.building ? P.building.def.label : "outdoors");
  /* town clock: HH:MM of the visible day, when the NPC layer is running
     and the settings toggle (render/settings.js) hasn't hidden it */
  const tm = T.Npcs && T.Npcs.townMin;
  const showClock = !T.Settings || T.Settings.clock !== false;
  const clock = tm == null || !showClock ? "" :
    `   ${String(Math.floor(tm / 60)).padStart(2, "0")}:${String(Math.floor(tm % 60)).padStart(2, "0")}`;
  el.innerHTML = `<b>${T.Town.gridId(P.pos[0], P.pos[2])}</b>   ${P.pos[0].toFixed(1)}, ${P.pos[2].toFixed(1)}\n${room}${clock}`;
  const pr = document.getElementById("prompt");
  if (P.nearDoor) {
    pr.style.display = "block";
    pr.innerHTML = `<b>${T.mobile ? "USE" : "E"}</b>  ${P.nearDoor.open > 0.5 ? "close" : "open"} ${P.nearDoor.id}`;
  } else if (T.Npcs && T.Npcs.prompt) {
    pr.style.display = "block";
    pr.innerHTML = T.Npcs.prompt;
  } else pr.style.display = "none";
}

let flashT = 0;
T.flash = function (msg) {
  const el = document.getElementById("where");
  el.textContent = msg; el.style.opacity = 1;
  clearTimeout(flashT);
  flashT = setTimeout(() => { el.style.opacity = 0; }, 2200);
};
T.toggleDebug = function () {
  T.Debug.on = !T.Debug.on;
  document.getElementById("bDbg").classList.toggle("on", T.Debug.on);
  if (T.Debug.on) { T.Debug.audit(); T.flash("inspection layer ON — grid, IDs, colliders, float/bury"); }
};

/* ------------------------------------------------- live world session (D15)
   bootWorld hands back `.session` — the live continuation of the boot's
   catch-up. While the town is watched, days still advance one per real day
   from genesis (O3, sim/clock.js); liveWorldTick steps them through the
   session instead of waiting for the next reload's catch-up. One check every
   20 s and at most ONE day per tick: a day that completes a growth building
   rebuilds the town through tryBuild (the same validated Town.build path as
   load), and one-per-tick keeps such rebuilds from chaining back-to-back.
   Days owed beyond that are picked up by later ticks, or by the next boot's
   catch-up exactly as before — the persisted world is identical either way
   (tools/growth.js §4: live and catch-up reach the byte-same digest). */
let worldSession = null;
function liveWorldTick() {
  if (!worldSession || !window.ASH) return;
  try {
    const owed = ASH.catchupDays(worldSession.doc.genesisMs, worldSession.sim.state.day, Date.now());
    if (owed <= 0) return;
    const r = worldSession.advanceDay();     // persists records + log + snapshot
    console.log(`%cWORLD`, "color:#7ce38b;font-weight:bold",
      `day ${r.day} stepped live` +
      (r.committed.length ? ` · committed ${r.committed.map((c) => c.id).join(", ")}` : ""));
    /* the snapshot on disk advanced — let the visible layer re-restore:
       new people/pets get meshes, a growth building's door anchor joins
       the plan view (render/npcs.js N.refresh) */
    if (T.Npcs && T.Npcs.refresh) T.Npcs.refresh();
  } catch (e) {
    console.error("live world day failed; the town stands and the tick retries", e);
  }
}

/* ----------------------------------------------------------------- boot - */
function skyMesh() {
  const b = new T.Builder();
  const m = { name: "sky", world: 1, rough: 1, metal: 0 };
  const s = 1;
  b.box(-s, -s, -s, 2 * s, 2 * s, 2 * s, m, { skip: "" });
  /* invert winding by drawing from inside: flip cull for the sky draw instead */
  const buckets = Array.from(b.buckets.values());
  for (const bk of buckets) for (let i = 0; i < bk.idx.length; i += 3) {
    const t = bk.idx[i]; bk.idx[i] = bk.idx[i + 2]; bk.idx[i + 2] = t;
  }
  return new T.Mesh(buckets);
}

/* yield to the browser so the loading bar paints. Falls back to a timer:
   a tab that isn't compositing never fires rAF, and boot would hang there. */
const wait = () => new Promise((r) => {
  let done = false;
  const go = () => { if (!done) { done = true; r(); } };
  requestAnimationFrame(() => requestAnimationFrame(go));
  setTimeout(go, 60);
});
function setLoad(p, msg) {
  document.getElementById("loadBar").style.width = (p * 100).toFixed(0) + "%";
  if (msg) document.getElementById("loadMsg").textContent = msg;
}

async function boot() {
  const canvas = document.getElementById("gl");
  gl = T.GL.init(canvas);
  addEventListener("resize", () => T.GL.resize());

  setLoad(0.05, "compiling shaders");
  await wait();
  prog = new T.Program(T.shaders.VS, T.shaders.FS, "world");
  lineProg = new T.Program(T.shaders.LVS, T.shaders.LFS, "line");
  skyProg = new T.Program(T.shaders.SVS, T.shaders.SFS, "sky");
  lb = new T.LineBatch();

  setLoad(0.15, "generating materials");
  await wait();
  T.buildMaterials();
  sky = skyMesh();

  setLoad(0.28, "solving floorplans and raising the town");
  await wait();

  /* ---- the living world: committed growth replays over the founding town --
     Everything in this block is optional by design: if the sim or the world
     state fails in any way, the founding town still loads, exactly as before. */
  let worldRecords = [];
  try {
    const doc = window.ASH && ASH.worldLoad(localStorage);
    if (doc && doc.records && doc.records.length) worldRecords = doc.records;
  } catch (e) { console.error("world records unreadable; founding town only", e); }
  T.Town.build(20260804, (p, msg) => {}, worldRecords);

  try {
    if (window.ASH) {
      setLoad(0.62, "catching up the world");
      await wait();
      const overlapScan = () => {
        const B = T.Town.buildings;
        for (let i = 0; i < B.length; i++)
          for (let j = i + 1; j < B.length; j++) {
            const a = B[i].foot, b = B[j].foot;
            if (Math.max(a[0] - b[3], b[0] - a[3]) < 0 && Math.max(a[2] - b[5], b[2] - a[5]) < 0) return false;
          }
        return true;
      };
      const adapter = {
        foundingCount: () => T.Town.buildings.filter((b) => !b.growth).length,
        houseHomes: () => {
          const out = {};
          for (const b of T.Town.buildings)
            if (!b.def.com && !b.growth) out[b.id] = { beds: T.Town.bedroomsOf(b) };
          return out;
        },
        businessAddress: () => {
          const barn = T.Town.buildings.find((b) => b.key === "barn");
          return (barn || T.Town.buildings.find((b) => b.def.com)).id;
        },
        /* D14: the real utility addresses — General Store / Diner /
           Water & Light instead of the barn fallback */
        buildingByKey: (key) => {
          const b = T.Town.buildings.find((b) => b.key === key && !b.growth);
          return b ? b.id : null;
        },
        freeLots: () => T.Town.freeLots(),
        houseTypes: () => {
          const out = {};
          for (const [k, d] of Object.entries(T.HOUSE_TYPES)) out[k] = { w: d.w, d: d.d, label: d.label };
          return out;
        },
        bedsByType: () => {
          const out = {};
          for (const b of T.Town.buildings)
            if (!b.def.com && out[b.key] === undefined) out[b.key] = T.Town.bedroomsOf(b);
          return out;
        },
        /* D15 P1: the founding plat as records, captured once so every
           founding building gets an identity-derived seed in the world doc */
        foundingRecords: () => {
          const out = [];
          for (const b of T.Town.buildings) {
            if (b.growth) continue;
            const block = (T.Town.blocks || []).find((bl) => bl.lots.includes(b.lot));
            if (!block) continue;
            out.push({ id: b.id, key: b.key, lot: { block: block.key, index: b.lot.index } });
          }
          return out;
        },
        /* D15 P2: fires once per LIVE growth commit, never during load-time
           catch-up (world/bootstrap.js guarantees it, tools/growth.js §3
           proves it — so no double-spawn is possible from replay). By the
           time this runs, tryBuild below has ALREADY rebuilt the town with
           the record — the exact load-time code path: Town.build's growth
           branch maps record.key → house type → mesh construction, seeded
           from the record's identity (idSeed). The building simply stands
           complete; what remains here is render-side bookkeeping for the
           caches that pointed into the previous build. */
        onGrowthCommitted: (record) => {
          if (T.Cam.subject || T.Cam.mode !== "fps") T.Cam.exit();   // stale subject
          if (T.Edit && T.Edit.sel) T.Edit.sel = null;               // stale furniture ref
          T.flash(`${record.id} raised at lot ${record.lot.block}:${record.lot.index} — the town grew while you watched`);
        },
      };
      /* MULTIPLAYER FIX (2026-08-06). nowMs was Date.now(), which becomes the
         world's genesis the first time a browser founds it — so every player
         had a town with a different birthday, a different day number, and
         therefore a different population: Jaron and Lillith saw DIFFERENT
         PEOPLE, not just the same people in different places. Genesis is now
         a fixed instant every client shares, so the day count is a pure
         function of the wall clock and the town has one population. */
      const WORLD_GENESIS_MS = Date.UTC(2026, 7, 6, 0, 0, 0);   // 2026-08-06T00:00Z
      const outcome = ASH.bootWorld({
        storage: localStorage, seed: "ashgrove-001", townSeed: 20260804,
        nowMs: Date.now(), genesisMs: WORLD_GENESIS_MS,
        adapter,
        tryBuild: (records) => {
          /* a rebuild replaces every chunk mesh and drops every cached
             interior — free the GL buffers of the build being replaced
             (catch-up replays this path several times, and a live commit
             replays it mid-session) */
          for (const ch of T.Town.chunks.values()) {
            if (ch.mesh) ch.mesh.free();
            if (ch.detailMesh) ch.detailMesh.free();
          }
          for (const b of liveInteriors) { if (b.interior) { b.interior.free(); b.interior = null; } }
          liveInteriors.length = 0;
          T.Town.build(20260804, null, records);
          const bad = T.Town.issues.filter((i) => i.sev === "bad").map((i) => `${i.id} ${i.msg}`);
          if (!overlapScan()) bad.push("building overlap detected");
          const bedsById = {};
          for (const b of T.Town.buildings) if (b.growth) bedsById[b.id] = T.Town.bedroomsOf(b);
          return { ok: bad.length === 0, errors: bad, bedsById };
        },
      });
      worldSession = outcome.session || null;   // D15: the live continuation of this boot
      if (outcome.grew) {
        /* the last tryBuild already stands the grown town */
        T.flash(`${outcome.records.length} new building${outcome.records.length > 1 ? "s" : ""} raised while you were away`);
      }
      if (outcome.days > 0)
        console.log(`%cWORLD`, "color:#7ce38b;font-weight:bold",
          `${outcome.days} day(s) caught up · ${outcome.records.length} growth building(s)`);
    }
  } catch (e) {
    console.error("world sim failed; the town stands without it", e);
    T.Town.build(20260804, null, worldRecords);   // restore the last good state
  }

  /* ---- the visible layer of that world: people and pets walking the day --
     Same optional-by-design discipline as the world block above. */
  try { if (window.ASH) T.Npcs.init({ storage: localStorage }); }
  catch (e) { console.error("NPC layer failed; town stands without it", e); }

  /* D15: keep stepping world days LIVE while the town is watched (usually a
     no-op — one day per real day; the tick is cheap and self-guarding) */
  setInterval(liveWorldTick, 20000);

  setLoad(0.88, "milling doors");
  await wait();
  doorMeshes[C.doorIntW.toFixed(3)] = buildDoorMesh(C.doorIntW);
  doorMeshes[C.doorExtW.toFixed(3)] = buildDoorMesh(C.doorExtW);
  doorMeshes["1.200"] = buildDoorMesh(1.2);
  doorMeshes["1.800"] = buildDoorMesh(1.8);
  doorMeshes["1.000"] = buildDoorMesh(1.0);
  doorMeshes["1.600"] = buildDoorMesh(1.6);

  setLoad(0.96, "validating");
  await wait();
  const restored = T.Edit.load();
  T.Debug.audit();
  T.Debug.wire();
  T.Edit.bind(canvas);
  T.Cam.bind(canvas);
  T.Player.reset(T.Town.spawn);
  T.Player.bindInput(canvas);
  if (T.mobile) document.body.classList.add("touch");
  /* coarse pointers have no Esc key: the ✕ MENU button (index.html #bMenu)
     stands in for it — visible only on touch/coarse-pointer devices */
  if (T.mobile || (window.matchMedia && matchMedia("(pointer: coarse)").matches))
    document.body.classList.add("coarse");
  if (restored) T.flash(`${restored} saved furniture edits restored`);

  const bad = T.Town.issues.filter((i) => i.sev === "bad").length + T.Debug.findings.filter((i) => i.sev === "bad").length;
  console.log(`%cASHGROVE`, "color:#7fd1ff;font-weight:bold",
    `\n  ${T.Town.buildingCount} buildings · ${W.assets.length} assets · ${W.colliders.length} colliders`,
    `\n  ${(T.Town.staticTris / 1000).toFixed(0)}k static tris · ${(T.Town.staticBytes / 1048576).toFixed(1)} MB`,
    `\n  validation: ${bad} errors, ${T.Town.issues.length + T.Debug.findings.length - bad} warnings  (press G)`);

  /* exposed so screenshot tooling can force a draw without waiting on rAF */
  T.renderFrame = (ts) => frame(ts === undefined ? performance.now() : ts);

  setLoad(1, "ready");
  await wait();
  const ld = document.getElementById("load");
  ld.style.opacity = 0;
  setTimeout(() => (ld.style.display = "none"), 500);

  document.getElementById("bHelp").onclick = () => toggleHelp();
  document.getElementById("bClose").onclick = () => toggleHelp(false);
  document.getElementById("bTown").onclick = () => T.TownPanel.toggle();
  document.getElementById("bTownClose").onclick = () => T.TownPanel.toggle(false);
  document.getElementById("bSettings").onclick = () => T.SettingsUI.toggle();
  document.getElementById("bSettingsClose").onclick = () => T.SettingsUI.close();
  /* the touch stand-in for Esc: leave pointer lock (if any) and open settings */
  document.getElementById("bMenu").onclick = () => {
    if (document.pointerLockElement) document.exitPointerLock();
    T.SettingsUI.toggle(true);
  };
  if (T.Settings && T.Settings.night) T.setNight(true);   // persisted night
  if (!localStorage.getItem("ashgrove-seen")) { toggleHelp(true); localStorage.setItem("ashgrove-seen", "1"); }

  requestAnimationFrame(frame);
}

function toggleHelp(force) {
  const h = document.getElementById("help");
  const show = force === undefined ? h.style.display !== "block" : force;
  h.style.display = show ? "block" : "none";
}

T.onKey = function (e) {
  if (document.activeElement && document.activeElement.tagName === "INPUT") return;
  switch (e.code) {
    case "KeyG": T.toggleDebug(); break;
    case "KeyH": case "Slash": toggleHelp(); break;
    case "KeyJ": T.TownPanel.toggle(); break;
    case "KeyN": T.setNight(!night); T.flash(night ? "night" : "day"); break;
    case "KeyP": T.Debug.hudHidden = !T.Debug.hudHidden;
      document.getElementById("topright").style.display = T.Debug.hudHidden ? "none" : "flex"; break;
    case "KeyC": if (T.Debug.on || true) { T.Debug.wire, navigator.clipboard && navigator.clipboard.writeText(T.Debug.coord()); T.flash("coordinate copied"); } break;
    case "KeyT": {
      if (!T.Debug.on) T.toggleDebug();
      const i = document.getElementById("tpIn"); i.focus(); i.select();
      break;
    }
    case "KeyV": T.Player.noclip = !T.Player.noclip; T.flash("noclip " + (T.Player.noclip ? "on" : "off")); break;
    case "KeyM": T.Edit.toggle(); break;
    case "KeyO": T.Cam.mode === "orbit" ? T.Cam.exit() : T.Cam.orbit(T.Cam.pickSubject()); break;
    case "KeyF": T.Tour.on ? (T.Tour.stop(), T.Cam.exit()) : T.Tour.start(); break;
    case "KeyR": if (T.Cam.mode !== "fps") { T.Cam.xray = !T.Cam.xray;
      document.getElementById("cpXray").classList.toggle("on", T.Cam.xray);
      T.flash(T.Cam.xray ? "x-ray: roofs and ceilings hidden" : "x-ray off"); } break;
    case "Digit1": case "Digit2": case "Digit3": case "Digit4": case "Digit5": {
      const n = T.Cam.presetNames[+e.code.slice(5) - 1];
      if (T.Cam.mode === "orbit" && n) T.Cam.setPreset(n);
      break;
    }
    case "Comma": if (T.Cam.mode === "orbit") T.Cam.step(-1); else if (T.Tour.on) T.Tour.skip(-1); break;
    case "Period": if (T.Cam.mode === "orbit") T.Cam.step(1); else if (T.Tour.on) T.Tour.skip(1); break;
    case "KeyQ": if (T.Edit.on) T.Edit.rotate(-1);
      else if (T.Npcs && T.Npcs.promptAction === "work") T.Npcs.quitJob(); break;
    case "KeyE": if (T.Edit.on && T.Edit.sel) T.Edit.rotate(1);
      else if (!T.Edit.on && T.Npcs && T.Npcs.promptAction) T.Npcs.interact(); break;
    case "KeyX": if (T.Edit.on) T.Edit.del(); break;
    case "KeyZ": if (T.Edit.on) { if (e.shiftKey) T.Edit.clearAll(); else T.Edit.reset(); } break;
    case "BracketLeft": if (T.Edit.on) T.Edit.nudgeY(-0.05); break;
    case "BracketRight": if (T.Edit.on) T.Edit.nudgeY(0.05); break;
    case "Escape":
      if (T.Tour.on) { T.Tour.stop(); T.Cam.exit(); }
      else if (T.Cam.mode === "orbit") T.Cam.exit();
      else if (T.Edit.on && T.Edit.sel) T.Edit.sel = null;
      else if (T.SettingsUI && T.SettingsUI.isOpen()) T.SettingsUI.close();
      else if (T.TownPanel.open) T.TownPanel.toggle(false);
      else toggleHelp(false);
      break;
  }
};

addEventListener("DOMContentLoaded", () => boot().catch((err) => {
  document.getElementById("loadMsg").textContent = "error: " + err.message;
  console.error(err);
}));
if (document.readyState !== "loading") { /* already fired */ }
})();
