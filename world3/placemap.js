/* ============================================================================
   placemap.js — Ashgrove's map: the shared place map (/hb-placemap.js)
   ---------------------------------------------------------------------------
   One small map button under the shell's top-right buttons. The places come
   from T.PlaceSources: destinations.js, eastside.js and cinema.js each add
   their own list, built from the same tables their doors use, so a new door
   shows up on the map by itself. Nothing in town/ is touched.

   "Show me the way" draws a route along the streets, a chip that reads like
   directions ("Turn left at the corner · Sparks Hall 43 m") and a line of
   small soft-green arrowheads on the ground from your feet to the place
   (one tiny extra draw, after the town's own frame). The player walks there.
   The map never moves the player.
   ========================================================================== */
import { createPlaceMap, groundDarts } from "/hb-placemap.js?v=2026-11-05-route";

const T = window.TOWN;
const ready = () => !!(T && T.Town && T.Town.buildings && T.Town.buildings.length && T.Player && T.Player.pos);

/* everything solid seen from above: the houses, the east-side shops, the cinema (x0, z0, x1, z1) */
function solids() {
  const out = [];
  for (const b of T.Town.buildings || []) { const f = b.foot; out.push([f[0], f[2], f[3], f[5]]); }
  if (T.EastSide) for (const s of T.EastSide.SHOPS) out.push([T.EastSide.FX, s.z0, T.EastSide.FX + s.d, s.z1]);
  if (T.GrandPalace) { const G = T.GrandPalace; out.push([G.FX, G.ZC - 19, G.FX + 62.5, G.ZC + 19]); }
  return out;
}
/* can you see the place from here (no building in between)? slab test of the sight line against each footprint */
function lineClear(ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  for (const r of solids()) {
    const x0 = r[0] + 0.4, z0 = r[1] + 0.4, x1 = r[2] - 0.4, z1 = r[3] - 0.4;
    let t0 = 0, t1 = 1, hit = true;
    for (const [p, d, lo, hi] of [[ax, dx, x0, x1], [az, dz, z0, z1]]) {
      if (Math.abs(d) < 1e-9) { if (p < lo || p > hi) { hit = false; break; } continue; }
      let ta = (lo - p) / d, tb = (hi - p) / d; if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) { hit = false; break; }
    }
    if (hit) return false;
  }
  return true;
}

function streetRoute(ax, az, bx, bz) {
  /* along the street grid: out to the nearest avenue, along a cross street, down the target's avenue, in to the door.
     In plain sight (nothing built in between) and not far: straight there. */
  const Town = T.Town, xs = Town.roadsX, zs = Town.roadsZ;
  const near = (v, L) => L.reduce((b, l) => (Math.abs(l - v) < Math.abs(b - v) ? l : b), L[0]);
  /* (only up to 90 m: past that, the open lawns would send you on a long diagonal through back yards) */
  const far = Math.hypot(bx - ax, bz - az);
  if (far < 30 || (far < 90 && lineClear(ax, az, bx, bz))) return [[bx, bz]];
  /* the town's own footway network (town/world/streets.js): the sidewalks and corner crossings, from where you stand.
     Stable as you walk (it does not jump to whichever avenue is nearest), and on the pavement, not down the road. */
  const ASH = globalThis.ASH;
  if (ASH && ASH.streetGraph && ASH.routeStreets) {
    try {
      if (!streetRoute.graph) streetRoute.graph = ASH.streetGraph();
      const p = ASH.routeStreets(streetRoute.graph, [ax, az], [bx, bz]);
      if (p && p.length >= 2) return p.slice(1);
    } catch (e) { /* fall back to the plain grid route below */ }
  }
  const xa = near(ax, xs), xb = near(bx, xs);
  let best = null;
  for (const zr of zs) {
    const p = [[xa, az], [xa, zr], [xb, zr], [xb, bz], [bx, bz]];
    let len = 0, prev = [ax, az];
    for (const q of p) { len += Math.abs(q[0] - prev[0]) + Math.abs(q[1] - prev[1]); prev = q; }
    if (!best || len < best.len) best = { len, p };
  }
  // the same avenue, or the same cross street: no detour
  const za = near(az, zs), zb = near(bz, zs);
  if (xa === xb) best = { p: [[xa, az], [xa, bz], [bx, bz]] };
  else if (za === zb && Math.abs(az - za) < 12 && Math.abs(bz - zb) < 12) best = { p: [[ax, za], [bx, zb], [bx, bz]] };
  return best.p.filter((q, i, arr) => i === 0 || Math.hypot(q[0] - arr[i - 1][0], q[1] - arr[i - 1][1]) > 0.5);
}

function drawTown(ctx, px, k, C) {
  const Town = T.Town, xs = Town.roadsX, zs = Town.roadsZ, RH = 4.0, WALK = 5.9;
  const rect = (x0, z0, x1, z1, col) => { const a = px(x0, z0), b = px(x1, z1); ctx.fillStyle = col; ctx.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]); };
  rect(0, 0, 372, Town.D, C.grass);
  for (const bl of Town.blocks || []) rect(bl.x0, bl.z0, bl.x1, bl.z1, bl.kind === "park" ? C.park : bl.kind === "downtown" ? "#8f9a7c" : C.grass);
  // footways, then the carriageways on top
  for (const x of xs) rect(x - WALK, 0, x + WALK, Town.D, C.walk);
  for (const z of zs) rect(0, z - WALK, Town.W, z + WALK, C.walk);
  for (const x of xs) rect(x - RH, 0, x + RH, Town.D, C.road);
  for (const z of zs) rect(0, z - RH, Town.W, z + RH, C.road);
  ctx.strokeStyle = C.roadLine; ctx.lineWidth = Math.max(1, 0.25 * k); ctx.setLineDash([2 * k, 2 * k]);
  for (const x of xs) { const a = px(x, 0), b = px(x, Town.D); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
  for (const z of zs) { const a = px(0, z), b = px(Town.W, z); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
  ctx.setLineDash([]);
  const box = (x0, z0, x1, z1, fill) => {
    const a = px(x0, z0), w = (x1 - x0) * k, h = (z1 - z0) * k;
    ctx.fillStyle = C.shadow; ctx.fillRect(a[0] + 0.5 * k, a[1] + 0.5 * k, w, h);
    ctx.fillStyle = fill || C.building; ctx.fillRect(a[0], a[1], w, h);
    ctx.strokeStyle = C.buildingEdge; ctx.lineWidth = Math.max(1, 0.2 * k); ctx.strokeRect(a[0], a[1], w, h);
  };
  for (const b of Town.buildings) { const f = b.foot; box(f[0], f[2], f[3], f[5], b.def.com ? "#f0e2c4" : C.building); }
  if (T.EastSide) for (const s of T.EastSide.SHOPS) box(T.EastSide.FX, s.z0, T.EastSide.FX + s.d, s.z1, "#f0e2c4");
  if (T.GrandPalace) { const G = T.GrandPalace; box(G.FX, G.ZC - 19, G.FX + 62.5, G.ZC + 19, "#d9cdb4"); }
  // a few names on the ground so the map reads without tapping
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = `700 ${Math.max(11, 3.6 * k)}px system-ui, sans-serif`; ctx.fillStyle = "#24331f";
  const park = (Town.blocks || []).find((b) => b.kind === "park");
  if (park) { const p = px((park.x0 + park.x1) / 2, (park.z0 + park.z1) / 2); ctx.fillText("Town park", p[0], p[1]); }
}

/* ---- the route on the ground: a line of small soft-green arrowheads (hb-placemap.js groundDarts), drawn with the
   town's own flat-colour shader in one extra draw right after the town's frame (Cam.hud runs then, with the depth
   buffer still full, so the arrowheads sit under kerbs, cars and people like paint). Phone cheap: one small buffer. */
const ground = { pts: null, count: 0, buf: null, gpu: null, vbo: null, prog: null, dirty: false,
  vp: new Float32Array(16), proj: new Float32Array(16), view: new Float32Array(16) };
function setGroundPath(pts) {
  ground.pts = pts;
  if (!pts) { ground.count = 0; return; }
  const Town = T.Town;
  const r = groundDarts(pts, { y: (x, z) => Town.groundY(x, z), lift: 0.05, spacing: 2.4, out: ground.buf || (ground.buf = new Float32Array(320 * 18)) });
  ground.count = r.count;
  if (!ground.gpu) ground.gpu = new Float32Array(320 * 6 * 7);
  const g = ground.gpu, col = [0.52, 0.86, 0.6, 0.62];   /* the map's route green */
  for (let v = 0; v < r.count * 6; v++) {
    g[v * 7] = r.data[v * 3]; g[v * 7 + 1] = r.data[v * 3 + 1]; g[v * 7 + 2] = r.data[v * 3 + 2];
    g[v * 7 + 3] = col[0]; g[v * 7 + 4] = col[1]; g[v * 7 + 5] = col[2]; g[v * 7 + 6] = col[3];
  }
  ground.dirty = true;
}
function drawGroundPath() {
  if (!ground.count || !T.GL || !T.GL.gl || T.Player.building != null) return;
  const gl = T.GL.gl, Cam = T.Cam, m4 = T.m4;
  if (!ground.prog) { ground.prog = new T.Program(T.shaders.LVS, T.shaders.LFS, "groundpath"); ground.vbo = gl.createBuffer(); ground.dirty = true; }
  gl.bindBuffer(gl.ARRAY_BUFFER, ground.vbo);
  if (ground.dirty) { gl.bufferData(gl.ARRAY_BUFFER, ground.gpu.subarray(0, ground.count * 42), gl.DYNAMIC_DRAW); ground.dirty = false; }
  /* the same view-projection the town just drew with (render/main.js frame) */
  const ex = Cam.eye[0], ey = Cam.eye[1], ez = Cam.eye[2], cp = Math.cos(Cam.pitch), sp = Math.sin(Cam.pitch);
  m4.persp(ground.proj, 1.08, T.GL.w / T.GL.h, 0.06, 900);
  m4.lookAt(ground.view, ex, ey, ez, ex - Math.sin(Cam.yaw) * cp, ey + sp, ez - Math.cos(Cam.yaw) * cp, 0, 1, 0);
  m4.mul(ground.vp, ground.proj, ground.view);
  const p = ground.prog.use();
  gl.uniformMatrix4fv(p.u.uVP, false, ground.vp);
  gl.uniform1f(p.u.uAlpha, 1);
  gl.enableVertexAttribArray(p.a.aPos); gl.vertexAttribPointer(p.a.aPos, 3, gl.FLOAT, false, 28, 0);
  gl.enableVertexAttribArray(p.a.aCol); gl.vertexAttribPointer(p.a.aCol, 4, gl.FLOAT, false, 28, 12);
  gl.disable(gl.CULL_FACE); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
  gl.drawArrays(gl.TRIANGLES, 0, ground.count * 6);
  gl.depthMask(true); gl.disable(gl.BLEND); gl.enable(gl.CULL_FACE);
  gl.disableVertexAttribArray(p.a.aCol);
  T.GL.drawCalls++;
}
function hookGroundPath() {
  const Cam = T.Cam;
  if (!Cam || Cam.__groundHooked || typeof Cam.hud !== "function") return;
  const orig = Cam.hud;
  Cam.hud = function () { try { drawGroundPath(); } catch (e) { ground.count = 0; console.warn("[placemap] ground path", e); } return orig.apply(this, arguments); };
  Cam.__groundHooked = true;
}
/* where the town really is: houses, shops, the cinema, the streets and every door, plus a few metres */
function contentBounds(places) {
  const Town = T.Town;
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  const add = (a, b, c, d) => { x0 = Math.min(x0, a); z0 = Math.min(z0, b); x1 = Math.max(x1, c); z1 = Math.max(z1, d); };
  for (const r of solids()) add(r[0], r[1], r[2], r[3]);
  for (const x of Town.roadsX) add(x - 6, Town.roadsZ[0] - 6, x + 6, Town.roadsZ[Town.roadsZ.length - 1] + 6);
  for (const z of Town.roadsZ) add(Town.roadsX[0] - 6, z - 6, Town.roadsX[Town.roadsX.length - 1] + 6, z + 6);
  for (const p of places) add(p.x, p.z, p.x, p.z);
  const pad = 6;
  return { x0: Math.max(0, x0 - pad), z0: Math.max(0, z0 - pad), x1: Math.min(372, x1 + pad), z1: Math.min(Town.D, z1 + pad) };
}

function start() {
  const Town = T.Town;
  let pm = null;
  const places = () => {
    const out = [];
    for (const src of T.PlaceSources || []) { try { out.push(...(src() || [])); } catch (e) { console.warn("[placemap] source", e); } }
    return out;
  };
  pm = createPlaceMap({
    world: "Ashgrove",
    bounds: { x0: 0, x1: 372, z0: 0, z1: Town.D },
    content: contentBounds(places()),
    outside: "#33432d",   /* past the edge of town: the countryside, not a black void */
    buttonPos: { top: "calc(env(safe-area-inset-top) + 64px)", right: "calc(env(safe-area-inset-right) + 8px)" },
    enabled: () => {
      if (!ready()) return false;
      const load = document.getElementById("load");
      if (load && getComputedStyle(load).display !== "none" && getComputedStyle(load).opacity !== "0") return false;
      return !document.body.classList.contains("orbiting") && !(T.Edit && T.Edit.on) && !(T.Tour && T.Tour.on);
    },
    player: () => {
      const P = T.Player;
      if (!P || !P.pos) return null;
      return { x: P.pos[0], z: P.pos[2], yaw: P.yaw };
    },
    route: streetRoute,
    places,
    groundPath: setGroundPath,
    drawBase: drawTown,
    arrive: 4.5,
    onOpen: () => { const P = T.Player; if (P) { P.move[0] = P.move[1] = 0; for (const k in P.keys) P.keys[k] = false; } },
  });
  // the town can regrow (new buildings): redraw the base next time the map opens
  for (const fn of ["build", "buildAsync"]) {
    const orig = Town[fn];
    if (typeof orig !== "function") continue;
    Town[fn] = function () { const out = orig.apply(this, arguments); try { pm.rebuildBase(); } catch (e) {} return out; };
  }
  hookGroundPath();
  T.PlaceMap = pm;
  T.PlaceMapGround = ground;   /* tests: how many arrowheads are on the ground */
}

(function wait(n) {
  if (ready()) start();
  else if (n < 2400) setTimeout(() => wait(n + 1), 100);
})(0);
