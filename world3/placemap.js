/* ============================================================================
   placemap.js — Ashgrove's map: the shared place map (/hb-placemap.js)
   ---------------------------------------------------------------------------
   One small map button under the shell's top-right buttons. The places come
   from T.PlaceSources: destinations.js, eastside.js and cinema.js each add
   their own list, built from the same tables their doors use, so a new door
   shows up on the map by itself. Nothing in town/ is touched.

   "Show me the way" draws a route along the streets and a chip with an arrow;
   the player walks there. The map never moves the player.
   ========================================================================== */
import { createPlaceMap } from "/hb-placemap.js?v=2026-11-05-placemap";

const T = window.TOWN;
const ready = () => !!(T && T.Town && T.Town.buildings && T.Town.buildings.length && T.Player && T.Player.pos);

function streetRoute(ax, az, bx, bz) {
  /* along the street grid: out to the nearest avenue, along a cross street, down the target's avenue, in to the door */
  const Town = T.Town, xs = Town.roadsX, zs = Town.roadsZ;
  const near = (v, L) => L.reduce((b, l) => (Math.abs(l - v) < Math.abs(b - v) ? l : b), L[0]);
  if (Math.hypot(bx - ax, bz - az) < 30) return [[bx, bz]];
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

function start() {
  const Town = T.Town;
  let pm = null;
  pm = createPlaceMap({
    world: "Ashgrove",
    bounds: { x0: 0, x1: 372, z0: 0, z1: Town.D },
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
    places: () => {
      const out = [];
      for (const src of T.PlaceSources || []) { try { out.push(...(src() || [])); } catch (e) { console.warn("[placemap] source", e); } }
      return out;
    },
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
  T.PlaceMap = pm;
}

(function wait(n) {
  if (ready()) start();
  else if (n < 2400) setTimeout(() => wait(n + 1), 100);
})(0);
