/* ============================================================================
   eastside.js — Ashgrove's east side: the Arcade, the Gazette, Ashgrove TV,
   the Studio and Sparks Hall (Jaron 11/5: every world gets its own arcade,
   news, TV, studio and sparks buildings, each in that world's own style)
   ---------------------------------------------------------------------------
   Same way the Grand Palace stands in the town (cinema.js): nothing here is
   in town/. Five small front-gable buildings, painted signs, porches, face
   WEST onto the east avenue (x = 280), north of the cinema, in the long block
   between the cross streets at z = 100 and z = 176, plus Sparks Hall past the
   last cross street. Walk up to the front door and use it:
     Arcade      -> a card of real games on the site (the Ashgrove card UI)
     Gazette     -> /news/
     Ashgrove TV -> /tv/
     Studio      -> /studio/
     Sparks Hall -> /sparks/
   They are closed buildings (you use the door from the porch), like the
   cinema. Trees that would stand on their ground are planted into a scratch
   builder and thrown away, so no other tree, lamp or car in the town moves.
   One chunk, one sign texture: a handful of draw calls for all five.
   ========================================================================== */
(function () {
"use strict";
const T = window.TOWN;
if (!T || !T.Town || !T.Props || !T.Builder) return;

const KERB = 280 + 5.9;      // back of the east avenue's footway
const FX = 290.0;            // front wall line (faces -x, west); avenue lamps stand at 286.4
const GAMES = [
  { name: "Parkworks Tycoon", url: "/games/parkworks/", note: "build a park" },
  { name: "Rocket", url: "/games/rocket/", note: "fly to the Moon" },
  { name: "The Hedge", url: "/games/hedge-maze/", note: "a maze at night" },
  { name: "Fable Survival", url: "/games/fable-survival/", note: "survive the night" },
  { name: "President Sim", url: "/games/president-sim/", note: "run the country" },
  { name: "SYL", url: "/games/syl/", note: "a space game" },
  { name: "Rustfall", url: "/games/rustfall/", note: "the wasteland" },
  { name: "Every game", url: "/games/", note: "the Games page" },
];
/* z0..z1 = frontage along the avenue; d = depth east; wall/trim/roof tints; sign row in the atlas */
const SHOPS = [
  { id: "ASH-ARCADE", icon: "arcade", key: "arcade", z0: 107.5, z1: 120.5, d: 11, h: 4.6, wall: [0.70, 0.30, 0.26], mat: "brick", trim: [0.95, 0.93, 0.88], roof: [0.30, 0.32, 0.30], sign: 0,
    dest: { label: "the Ashgrove Arcade", verb: "Enter the Arcade — pick a game", blurb: "Real games on the site. Pick one and play.", kind: "list", rows: GAMES } },
  { id: "ASH-GAZETTE", icon: "news", key: "gazette", z0: 123.5, z1: 135.5, d: 10, h: 4.4, wall: [0.93, 0.92, 0.88], mat: "siding", trim: [0.20, 0.30, 0.24], roof: [0.26, 0.28, 0.30], sign: 1,
    dest: { label: "the Ashgrove Gazette", verb: "Open the Gazette — today's news", blurb: "Today's news.", kind: "go", url: "/news/" } },
  { id: "ASH-TV", icon: "tv", key: "tv", z0: 138.5, z1: 151.5, d: 11, h: 5.0, wall: [0.55, 0.66, 0.74], mat: "siding", trim: [0.96, 0.96, 0.94], roof: [0.24, 0.26, 0.30], sign: 2, mast: true,
    dest: { label: "Ashgrove TV", verb: "Go in to Ashgrove TV — watch", blurb: "Heartbeat TV: flip the channels.", kind: "go", url: "/tv/" } },
  { id: "ASH-STUDIO", icon: "studio", key: "studio", z0: 154.5, z1: 166.0, d: 10, h: 4.4, wall: [0.36, 0.36, 0.38], mat: "siding", trim: [0.92, 0.90, 0.86], roof: [0.20, 0.20, 0.22], sign: 3, rec: true,
    dest: { label: "the Studio", verb: "Go in to the Studio — make music and videos", blurb: "The Studio.", kind: "go", url: "/studio/" } },
  { id: "ASH-SPARKS", icon: "sparks", key: "sparks", z0: 183.0, z1: 195.0, d: 10, h: 4.8, wall: [0.96, 0.95, 0.91], mat: "siding", trim: [0.80, 0.64, 0.28], roof: [0.22, 0.26, 0.40], sign: 4,
    dest: { label: "Sparks Hall", verb: "Go in to Sparks Hall", blurb: "People who light the way.", kind: "go", url: "/sparks/" } },
];
const SIGN_ROWS = [
  ["ASHGROVE ARCADE", "#1f3b2d", "#f2e3b3"],
  ["THE ASHGROVE GAZETTE", "#f4efe2", "#1d2a22"],
  ["ASHGROVE TV", "#14324a", "#ffffff"],
  ["STUDIO", "#1a1a1a", "#f2f2f2"],
  ["SPARKS HALL", "#1b2340", "#f3cf6b"],
  ["RECORDING", "#2a0505", "#ff5a4a"],
];
const reserveOf = (s) => ({ x0: KERB, x1: FX + s.d + 3, z0: s.z0 - 2, z1: s.z1 + 2 });
const doorOf = (s) => { const zc = (s.z0 + s.z1) / 2; return { x0: FX - 3.4, x1: FX, z0: zc - 2.2, z1: zc + 2.2, zc }; };
const inside = (r, x, z) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;

/* ------------------------------------------------------- clear the trees - */
const plantTree = T.Props.tree;
T.Props.tree = function (b, x, z) {
  if (!SHOPS.some((s) => inside(reserveOf(s), x, z))) return plantTree.apply(this, arguments);
  const W = T.World, nc = W.colliders.length, na = W.assets.length;
  plantTree.call(this, new T.Builder(), ...Array.prototype.slice.call(arguments, 1));   // same draws, same id
  W.colliders.length = nc;
  W.assets.length = na;
};

/* ---------------------------------------------------------------- signs - */
function signMaterial() {
  const W = 1024, H = 1024, c = document.createElement("canvas");
  c.width = W; c.height = H;
  const x = c.getContext("2d");
  SIGN_ROWS.forEach(([text, bg, fg], k) => {
    const y = k * 128;
    x.fillStyle = bg; x.fillRect(0, y, W, 128);
    x.strokeStyle = fg; x.lineWidth = 6; x.globalAlpha = 0.7; x.strokeRect(10, y + 10, W - 20, 108); x.globalAlpha = 1;
    x.fillStyle = fg; x.textAlign = "center"; x.textBaseline = "middle";
    let fs = 78; x.font = `bold ${fs}px Georgia, serif`;
    while (x.measureText(text).width > W - 80 && fs > 30) { fs -= 4; x.font = `bold ${fs}px Georgia, serif`; }
    x.fillText(text, W / 2, y + 68);
  });
  const gl = T.GL.gl, tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return { tex, name: "ashEastSign", world: 1, rough: 0.6, metal: 0 };
}
let SIGN = null;
const rowUV = (k) => { const v1 = 1 - k / 8 - 0.004, v0 = 1 - (k + 1) / 8 + 0.004; return [1, v0, 1, v1, 0, v1, 0, v0]; };

/* ---------------------------------------------------------------- build - */
function emitEast() {
  const M = T.Mats, W = T.World, b = new T.Builder();
  if (!SIGN) SIGN = signMaterial();
  const out = (pts, dir, mat, o) => b._out(pts, dir, mat, o);
  for (const s of SHOPS) {
    const X0 = FX, X1 = FX + s.d, Z0 = s.z0, Z1 = s.z1, w = Z1 - Z0, zc = (Z0 + Z1) / 2, H = s.h;
    const wallMat = M[s.mat] || M.siding, rise = (w / 2) * 0.62;
    /* forecourt walk from the avenue footway to the porch */
    b.id(s.id + "-WALK", "ground");
    b.plane(KERB, zc - 1.6, X0 - KERB, 3.2, 0.012, M.concrete, { tint: [0.90, 0.89, 0.86] });
    b.endId();
    b.shadowQuad(X0 + s.d / 2, zc, s.d + 3, w + 3, 0.015);
    b.id(s.id, "shop");
    /* walls on a low concrete base */
    b.box(X0, 0, Z0, s.d, 0.45, w, M.concrete, { tint: [0.74, 0.73, 0.70], skip: "-y" });
    b.box(X0, 0.45, Z0, s.d, H - 0.45, w, wallMat, { tint: s.wall, skip: "-y+y", grime: 0.25 });
    /* front gable (faces the avenue) and the back gable */
    out([[X0, H, Z0], [X0, H + rise, zc], [X0, H, Z1]], [-1, 0, 0], wallMat, { tint: s.wall });
    out([[X1, H, Z0], [X1, H + rise, zc], [X1, H, Z1]], [1, 0, 0], wallMat, { tint: s.wall });
    /* roof: ridge runs back from the street, so the gable shows */
    b.gableRoof(X0, H, Z0, s.d, w, 0.62, 0.45, M.shingle || M.metalRoof, { tint: s.roof });
    /* corner boards and a fascia band under the sign */
    for (const z of [Z0 - 0.06, Z1 - 0.12]) b.box(X0 - 0.06, 0.45, z, 0.18, H - 0.45, 0.18, M.paint, { tint: s.trim });
    b.box(X0 - 0.08, H - 0.2, Z0, 0.12, 0.2, w, M.paint, { tint: s.trim });
    /* the sign board across the front, under the gable */
    const sw = Math.min(w - 1.2, 9), sh = sw / 8 * 1.0, sy = H - 0.55;
    b.box(X0 - 0.16, sy - sh / 2 - 0.08, zc - sw / 2 - 0.08, 0.08, sh + 0.16, sw + 0.16, M.paint, { tint: s.trim });
    b.quad([X0 - 0.17, sy - sh / 2, zc + sw / 2], [X0 - 0.17, sy + sh / 2, zc + sw / 2], [X0 - 0.17, sy + sh / 2, zc - sw / 2], [X0 - 0.17, sy - sh / 2, zc - sw / 2], SIGN, { uv: rowUV(s.sign) });
    /* front door (centre), glass lights, and two shop windows */
    b.box(X0 - 0.08, 0.45, zc - 0.75, 0.1, 2.3, 1.5, M.wood, { tint: [0.30, 0.20, 0.13] });
    b.quad([X0 - 0.1, 1.55, zc + 0.5], [X0 - 0.1, 2.5, zc + 0.5], [X0 - 0.1, 2.5, zc - 0.5], [X0 - 0.1, 1.55, zc - 0.5], M.glass, { tint: [1.0, 0.92, 0.76] });
    b.box(X0 - 0.12, 2.75, zc - 0.95, 0.14, 0.14, 1.9, M.paint, { tint: s.trim });
    for (const sd of [-1, 1]) {
      const wz = zc + sd * (w / 4 + 0.6), ww = Math.min(2.6, w / 4);
      b.quad([X0 - 0.05, 1.0, wz + ww / 2], [X0 - 0.05, 3.0, wz + ww / 2], [X0 - 0.05, 3.0, wz - ww / 2], [X0 - 0.05, 1.0, wz - ww / 2], M.glass, { tint: [0.95, 0.9, 0.78] });
      b.box(X0 - 0.12, 0.85, wz - ww / 2 - 0.1, 0.16, 0.15, ww + 0.2, M.paint, { tint: s.trim });
      b.box(X0 - 0.12, 3.0, wz - ww / 2 - 0.1, 0.16, 0.12, ww + 0.2, M.paint, { tint: s.trim });
    }
    /* porch: a deck, two steps, posts and a little shed roof */
    b.box(X0 - 2.4, 0, zc - 2.4, 2.4, 0.24, 4.8, M.wood, { tint: [0.62, 0.52, 0.40] });
    b.box(X0 - 2.85, 0, zc - 1.2, 0.45, 0.12, 2.4, M.wood, { tint: [0.58, 0.48, 0.37] });
    for (const sd of [-1, 1]) b.box(X0 - 2.3, 0.24, zc + sd * 2.2 - 0.07, 0.14, 2.68, 0.14, M.paint, { tint: s.trim });
    b.box(X0 - 2.6, 2.92, zc - 2.6, 2.6, 0.12, 5.2, M.paint, { tint: s.roof });
    /* extras */
    if (s.mast) {   // a broadcast mast on the roof with a red light
      b.cyl(X0 + s.d * 0.6, H + rise * 0.4, zc, 0.22, 0.08, 9, 6, M.metal, { tint: [0.78, 0.8, 0.84] });
      for (const [yy, rr] of [[2.5, 1.1], [5, 0.75], [7.2, 0.45]]) b.cyl(X0 + s.d * 0.6, H + rise * 0.4 + yy, zc, rr, rr, 0.08, 8, M.metal, { tint: [0.82, 0.84, 0.88] });
      b.box(X0 + s.d * 0.6 - 0.18, H + rise * 0.4 + 9, zc - 0.18, 0.36, 0.3, 0.36, M.paint, { tint: [1.4, 0.2, 0.15] });
    }
    if (s.rec) {    // the red RECORDING light over the door
      b.quad([X0 - 0.2, 3.05, zc + 0.9], [X0 - 0.2, 3.5, zc + 0.9], [X0 - 0.2, 3.5, zc - 0.9], [X0 - 0.2, 3.05, zc - 0.9], SIGN, { uv: rowUV(5) });
    }
    b.endId();
    W.colliders.push({ x0: X0 - 0.2, x1: X1 + 0.5, z0: Z0 - 0.5, z1: Z1 + 0.5, y0: 0, y1: H + rise + 1, id: s.id, type: "wall" });
    W.assets.push({ id: s.id, type: "shop", box: [X0 - 2.9, 0, Z0 - 0.5, X1 + 0.5, H + rise + 1, Z1 + 0.5], expectY: 0 });
    /* the porch is a low step up, walkable */
    if (W.surfaces) W.surfaces.push({ x0: X0 - 2.4, x1: X0, z0: zc - 2.4, z1: zc + 2.4, y: 0.24, id: s.id + "-PORCH" });
    W.lamps.push({ x: X0 - 1.4, y: 2.8, z: zc, r: 8, street: true });
  }
  const ch = { key: "eastside", base: null, detail: null };
  ch.mesh = b.build();
  ch.detailMesh = new T.Builder().build();
  ch.assets = b.assets;
  ch.bounds = ch.mesh.bounds.slice ? ch.mesh.bounds.slice() : ch.mesh.bounds;
  T.Town.chunks.set("eastside", ch);
  T.Town.staticTris = (T.Town.staticTris || 0) + b.tris;
  T.EastSide.tris = b.tris;
}

const buildTown = T.Town.build;
T.Town.build = function () {
  const out = buildTown.apply(this, arguments);
  try { emitEast(); } catch (e) { console.error("Ashgrove east side not placed", e); }
  return out;
};
const buildTownAsync = T.Town.buildAsync;
T.Town.buildAsync = async function () {
  const out = await buildTownAsync.apply(this, arguments);
  try { emitEast(); } catch (e) { console.error("Ashgrove east side not placed", e); }
  return out;
};

/* ---------------------------------------------------------------- doors - */
function atDoor() {
  const P = T.Player;
  if (!P || !P.pos || P.building) return null;
  return SHOPS.find((s) => inside(doorOf(s), P.pos[0], P.pos[2])) || null;
}
function hookDoors() {
  const D = T.Destinations;
  if (!D || D.__eastSide) return;
  D.__eastSide = true;
  const here = D.here, use = D.use;
  D.here = function () {
    const s = atDoor();
    return here.apply(this, arguments) || (s ? Object.assign({ buildingId: s.id }, s.dest) : null);
  };
  D.use = function (shell) {
    const s = !D.open && atDoor();
    if (s) {
      if (s.dest.kind === "go") { location.assign(s.dest.url); return true; }
      if (D.show) { D.show(Object.assign({ buildingId: s.id }, s.dest)); return true; }
    }
    return use.apply(this, arguments);
  };
}
/* destinations.js loads after this file, and deferred scripts run while the
   page is already "interactive", so wait until it is really there (11/5 fix:
   a single setTimeout could fire first and the doors were never hooked). */
(function waitForDestinations(n) {
  if (T.Destinations) hookDoors();
  else if (n < 600) setTimeout(() => waitForDestinations(n + 1), 50);
})(0);

/* on the place map (world3/placemap.js), straight from SHOPS: a new shop here is on the map by itself */
(T.PlaceSources = T.PlaceSources || []).push(function () {
  return SHOPS.map((s) => {
    const d = doorOf(s), name = s.dest.label.replace(/^the /, "");
    return { id: s.id, icon: s.icon || "place", name: name.charAt(0).toUpperCase() + name.slice(1), blurb: s.dest.blurb, x: d.x0 - 0.6, z: d.zc,
      open: s.dest.kind === "go" ? s.dest.url : () => T.Destinations && T.Destinations.show && T.Destinations.show(Object.assign({ buildingId: s.id }, s.dest)) };
  });
});

T.EastSide = { FX, SHOPS, doorOf, games: GAMES };
})();
