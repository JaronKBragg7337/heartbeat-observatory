/* ============================================================================
   cinema.js — the Grand Palace, standing in Ashgrove
   ---------------------------------------------------------------------------
   The Grand Palace Cinema (github.com/JaronKBragg7337/Movie-Theater-Three.js-
   Asset-) was made for Ashgrove. Its inside is a three.js scene at
   /video/3d/; this file stands its outside up in the town, at its real size,
   and turns its front doors into the way in: walk up, use the doors, and you
   are sitting in the middle of the house facing the screen.

   Like destinations.js, nothing here is in town/. It hooks the town from
   outside:

   WHERE IT GOES. The town has no free block big enough — the building is
   38 m wide and 63 m deep, and the only open ground inside the grid is the
   park, which the townspeople use for lunch and errands. So the map grows
   east instead. The cinema faces west onto the east avenue (x = 280), across
   from the town, centred on the middle of the first long block (z = 62):

       canopy edge  x 288.6   (the avenue's lamps sit at 286.5, clear of it)
       glass front  x 294.0
       back wall    x 356.8   (past the old edge of the map at 324, so new
                               lawn is laid out to x 372)
       width        z 43 .. 81 (well clear of the cross streets at 24 and 100)

   CLEARING THE TREES. Trees are placed by the town's random stream, so they
   cannot simply be skipped — every later tree, lamp and car would move. Each
   tree that would stand on the cinema's ground is still "planted" (same
   random draws, same id), but into a scratch builder that is thrown away,
   and its collision box is taken back out. Nothing else in the town moves.
   ========================================================================== */
(function () {
"use strict";
const T = window.TOWN;
if (!T || !T.Town || !T.Props || !T.Builder) return;

/* ------------------------------------------------------------ placement - */
const FX = 294.0;            // glass line of the entrance (faces -x, west)
const ZC = 62.0;             // centre line of the building
const DEPTH = 62.5;          // glass line to the back wall (layout.js: 34 - -28.5)
const HALF = 19.0;           // layout.js bldgHalfW
const LOBBY_HALF = 18.0;     // layout.js lobbyHalfW — the glazed front
const TOP = 14.5;            // layout.js bldgHeight
const CANOPY_OUT = 5.4;      // layout.js canopyZ - facadeZ
const CANOPY_Y = 4.6;        // layout.js canopyY (centre of the slab)
const CANOPY_T = 0.55;
const CANOPY_HALF = 12.0;
const KERB = 280 + 5.9;      // back of the east avenue's footway
const RESERVE = { x0: KERB, x1: FX + DEPTH + 6, z0: ZC - HALF - 5, z1: ZC + HALF + 5 };
const DOOR = { x0: FX - 4.2, x1: FX, z0: ZC - 5, z1: ZC + 5 };
const SEATS_URL = "/video/3d/?start=seats&from=ashgrove";

const inside = (r, x, z) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;

/* ------------------------------------------------------- clear the trees - */
const plantTree = T.Props.tree;
T.Props.tree = function (b, x, z, r, scale) {
  if (!inside(RESERVE, x, z)) return plantTree.apply(this, arguments);
  const W = T.World, nc = W.colliders.length, na = W.assets.length;
  plantTree.call(this, new T.Builder(), x, z, r, scale);   // same draws, same id
  W.colliders.length = nc;
  W.assets.length = na;
};

/* ------------------------------------------------------------- textures - */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function uploadCanvas(c) {
  const gl = T.GL.gl, tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

/* Channel letters, the same words and faces as the real sign
   (textures.js makeSignFace). Cut out, so only the letters stand on the
   fascia and the sky shows between them. */
function signMaterial() {
  const W = 2048, H = 512, c = document.createElement("canvas");
  c.width = W; c.height = H;
  const x = c.getContext("2d");
  x.textAlign = "center";
  x.lineJoin = "round";
  x.font = "bold 210px Georgia, serif";
  x.lineWidth = 14; x.strokeStyle = "#1b1206"; x.strokeText("GRAND PALACE", W / 2, 250);
  x.fillStyle = "#fff0cc"; x.fillText("GRAND PALACE", W / 2, 250);
  x.font = "bold 96px Arial, sans-serif";
  if ("letterSpacing" in x) x.letterSpacing = "28px";
  x.lineWidth = 10; x.strokeStyle = "#08131b"; x.strokeText("CINEMA", W / 2, 400);
  x.fillStyle = "#dff3ff"; x.fillText("CINEMA", W / 2, 400);
  /* hard alpha: the town's cutout pass keeps texels at 0.5 and up */
  const im = x.getImageData(0, 0, W, H), d = im.data;
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] > 90 ? 255 : 0;
  x.putImageData(im, 0, 0);
  return { tex: uploadCanvas(c), name: "gpSign", world: 1, rough: 0.5, metal: 0, cutout: true };
}

/* The four posters in the real cases (textures.js makePoster, seeds 21-24). */
const POSTERS = [
  ["#0b1d3a", "#2a6fb0", "#f2c14e", "THE LAST PROJECTOR"],
  ["#2a0713", "#8c1c34", "#e8c26a", "VELVET HOUR"],
  ["#06231c", "#159c76", "#f0f5e6", "DEEP FIELD"],
  ["#1a1420", "#6b3fa0", "#ffd9a0", "NIGHT REEL"],
  ["#2b1400", "#c4661f", "#ffe9b0", "DUST & EMBER"],
  ["#001018", "#0f7c8c", "#d9f2ff", "SILENT ORBIT"],
];
function posterMaterial() {
  const PW = 256, PH = 384, c = document.createElement("canvas");
  c.width = PW * 4; c.height = 512;
  const x = c.getContext("2d");
  x.fillStyle = "#111"; x.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 4; i++) {
    const seed = 21 + i, rand = mulberry32(seed), p = POSTERS[seed % POSTERS.length];
    x.save(); x.translate(i * PW, 0);
    const g = x.createLinearGradient(0, 0, 0, PH);
    g.addColorStop(0, p[0]); g.addColorStop(0.6, p[1]); g.addColorStop(1, p[0]);
    x.fillStyle = g; x.fillRect(0, 0, PW, PH);
    x.fillStyle = "rgba(0,0,0,0.55)";
    x.beginPath(); x.moveTo(0, PH * 0.78);
    for (let px = 0; px <= PW; px += 16) {
      x.lineTo(px, PH * (0.62 + rand() * 0.18));
      x.lineTo(px + 16, PH * (0.62 + rand() * 0.18));
    }
    x.lineTo(PW, PH); x.lineTo(0, PH); x.closePath(); x.fill();
    x.globalAlpha = 0.5; x.fillStyle = p[2];
    x.beginPath(); x.arc(PW * 0.68, PH * 0.28, PW * 0.16, 0, Math.PI * 2); x.fill();
    x.globalAlpha = 1;
    x.fillStyle = p[2]; x.font = "bold 23px Georgia, serif"; x.textAlign = "center";
    p[3].split(" ").forEach((w, k) => x.fillText(w, PW / 2, PH * 0.80 + k * 25));
    x.fillStyle = "rgba(255,255,255,0.75)"; x.font = "8px Arial";
    x.fillText("COMING SOON", PW / 2, PH * 0.95);
    x.restore();
  }
  return { tex: uploadCanvas(c), name: "gpPoster", world: 1, rough: 0.35, metal: 0 };
}

let MAT = null;
function mats() {
  if (!MAT) MAT = { sign: signMaterial(), poster: posterMaterial() };
  return MAT;
}

/* ---------------------------------------------------------------- build - */
const ACM = [0.40, 0.41, 0.44];        // the real cladding: a cool charcoal panel
const ACM_DARK = [0.30, 0.31, 0.33];
const METAL = [0.22, 0.23, 0.24];
const CONC = [0.80, 0.79, 0.76];

function emitCinema() {
  const M = T.Mats, W = T.World, m = mats();
  const b = new T.Builder(), dt = new T.Builder();
  const X0 = FX - 0.9, X1 = FX + DEPTH + 0.3, Z0 = ZC - HALF - 0.3, Z1 = ZC + HALF + 0.3;

  /* new ground east of the old map edge, and a forecourt off the avenue */
  b.id("GP-LAWN", "ground");
  b.plane(324, -20, 48, 240, 0, M.grass, { tint: [0.97, 0.99, 0.95] });
  b.endId();
  b.id("GP-FORECOURT", "ground");
  b.plane(KERB, ZC - 16, X0 - KERB, 32, 0.012, M.concrete, { tint: [0.93, 0.92, 0.89] });
  b.plane(FX - 2.2, ZC - 4, 2.2, 8, 0.02, M.metal, { tint: [0.16, 0.16, 0.17] });   // entrance matting
  b.endId();
  b.shadowQuad(FX + DEPTH / 2, ZC, DEPTH + 6, HALF * 2 + 6, 0.015);

  b.id("GRANDPALACE", "cinema");
  /* auditorium block — clad flanks and rear on a board-formed concrete base */
  b.box(FX, 0, ZC - HALF, DEPTH, TOP, HALF * 2, M.paint, { tint: ACM, skip: "-x-y" });
  for (const s of [-1, 1]) {
    const zb = s < 0 ? ZC - HALF - 0.06 : ZC + HALF - 0.66;
    b.box(FX + 0.4, 0, zb, DEPTH - 0.4, 2.6, 0.72, M.concrete, { tint: CONC, skip: "-y" });
    for (let jx = FX + 1.0; jx < FX + DEPTH - 0.5; jx += 1.75)       // panel reveals
      b.box(jx, 2.6, s < 0 ? ZC - HALF - 0.03 : ZC + HALF, 0.03, TOP - 2.8, 0.03, M.paint, { tint: ACM_DARK });
  }
  b.box(FX + DEPTH - 0.06, 0, ZC - HALF, 0.72, 2.6, HALF * 2, M.concrete, { tint: CONC, skip: "-y" });
  /* front elevation above the glazing, and the returns beside it */
  b.box(X0, 8.2, Z0, 0.9, TOP - 8.2, Z1 - Z0, M.paint, { tint: ACM });
  b.box(X0, 0, Z0, 0.9, 8.2, HALF + 0.3 - LOBBY_HALF, M.paint, { tint: ACM, skip: "-y" });
  b.box(X0, 0, ZC + LOBBY_HALF, 0.9, 8.2, HALF + 0.3 - LOBBY_HALF, M.paint, { tint: ACM, skip: "-y" });
  /* parapet with a metal coping, and the roof deck inside it */
  b.box(X0 - 0.05, TOP, Z0 - 0.05, X1 - X0 + 0.1, 1.1, 0.5, M.paint, { tint: ACM });
  b.box(X0 - 0.05, TOP, Z1 - 0.45, X1 - X0 + 0.1, 1.1, 0.5, M.paint, { tint: ACM });
  b.box(X0 - 0.05, TOP, Z0 - 0.05, 0.5, 1.1, Z1 - Z0 + 0.1, M.paint, { tint: ACM });
  b.box(X1 - 0.45, TOP, Z0 - 0.05, 0.5, 1.1, Z1 - Z0 + 0.1, M.paint, { tint: ACM });
  for (const [x, z, w, d] of [[X0 - 0.11, Z0 - 0.12, X1 - X0 + 0.22, 0.64], [X0 - 0.11, Z1 - 0.52, X1 - X0 + 0.22, 0.64],
                              [X0 - 0.12, Z0 - 0.11, 0.64, Z1 - Z0 + 0.22], [X1 - 0.52, Z0 - 0.11, 0.64, Z1 - Z0 + 0.22]])
    b.box(x, TOP + 1.1, z, w, 0.09, d, M.metal, { tint: METAL });
  /* rooftop plant: three package units on curbs */
  for (const [ox, oz] of [[18, -8], [26, 6], [44, -2]]) {
    b.box(FX + ox, TOP, ZC + oz, 3.2, 0.3, 2.2, M.concrete, { tint: CONC, skip: "-y" });
    b.box(FX + ox + 0.15, TOP + 0.3, ZC + oz + 0.15, 2.9, 1.5, 1.9, M.metal, { tint: [0.62, 0.63, 0.64], skip: "-y" });
  }
  b.endId();

  /* glazed curtain wall: 18 bays, two door openings, mullions and transoms */
  b.id("GP-ENTRANCE", "door");
  const bays = 18, bayW = (LOBBY_HALF * 2) / bays, glassTop = 8.2, doorH = 2.6;
  const openings = [-2.75, 2.75], openW = 2.55;
  const glassFace = (z0, z1, y0, y1, tint, x) =>
    b.quad([x, y0, z1], [x, y1, z1], [x, y1, z0], [x, y0, z0], M.glass, { tint });
  for (let i = 0; i < bays; i++) {
    const lz = -LOBBY_HALF + (i + 0.5) * bayW;
    const inDoor = openings.some((c) => Math.abs(lz - c) < openW / 2 + bayW * 0.5);
    const sill = inDoor ? doorH + 0.16 : 0;
    glassFace(ZC + lz - bayW / 2 + 0.05, ZC + lz + bayW / 2 - 0.05, sill, glassTop, [1.0, 0.94, 0.82], FX);
    /* the lobby glass behind the door leaves, so the doorways read as glass too */
    if (inDoor) glassFace(ZC + lz - bayW / 2, ZC + lz + bayW / 2, 0, sill, [0.9, 0.85, 0.74], FX + 0.08);
    if (!inDoor) b.box(FX - 0.07, 3.08, ZC + lz - bayW / 2 + 0.05, 0.05, 0.55, bayW - 0.1, M.paint, { tint: ACM_DARK });
  }
  for (let i = 0; i <= bays; i++)
    b.box(FX - 0.1, 0, ZC - LOBBY_HALF + i * bayW - 0.05, 0.2, glassTop, 0.1, M.metal, { tint: METAL, skip: "-y" });
  for (const hy of [3.62, 6.0, glassTop - 0.1])
    b.box(FX - 0.1, hy - 0.05, ZC - LOBBY_HALF, 0.2, 0.1, LOBBY_HALF * 2, M.metal, { tint: METAL });
  b.box(FX - 0.15, 0, ZC - LOBBY_HALF, 0.3, 0.16, LOBBY_HALF * 2, M.metal, { tint: METAL, skip: "-y" });
  /* four glass door leaves in two pairs, framed, with push bars */
  for (const c of openings) {
    b.box(FX - 0.11, doorH + 0.07, ZC + c - openW / 2 - 0.1, 0.22, 0.09, openW + 0.2, M.metal, { tint: METAL });
    for (const side of [-1, 1]) {
      const z0 = side < 0 ? ZC + c - openW / 2 : ZC + c + 0.02;
      const w = openW / 2 - 0.02;
      glassFace(z0 + 0.06, z0 + w - 0.06, 0.06, doorH - 0.06, [0.95, 0.88, 0.74], FX - 0.03);
      b.box(FX - 0.06, 0, z0, 0.05, doorH, 0.06, M.metal, { tint: METAL, skip: "-y" });
      b.box(FX - 0.06, 0, z0 + w - 0.06, 0.05, doorH, 0.06, M.metal, { tint: METAL, skip: "-y" });
      b.box(FX - 0.06, 0, z0, 0.05, 0.12, w, M.metal, { tint: METAL, skip: "-y" });
      b.box(FX - 0.06, doorH - 0.06, z0, 0.05, 0.06, w, M.metal, { tint: METAL });
      dt.box(FX - 0.16, 1.02, z0 + 0.12, 0.04, 0.05, w - 0.24, M.metal, { tint: [0.85, 0.7, 0.4] });   // brass push bar
    }
  }
  b.endId();

  /* canopy, fascia and the channel-letter sign */
  b.id("GP-CANOPY", "canopy");
  const cy0 = CANOPY_Y - CANOPY_T / 2, cy1 = CANOPY_Y + CANOPY_T / 2, cx0 = FX - CANOPY_OUT;
  b.box(cx0, cy0, ZC - CANOPY_HALF, CANOPY_OUT - 0.3, CANOPY_T, CANOPY_HALF * 2, M.paint, { tint: ACM });
  b.box(cx0 - 0.08, cy1, ZC - CANOPY_HALF - 0.08, CANOPY_OUT - 0.14, 0.1, CANOPY_HALF * 2 + 0.16, M.metal, { tint: METAL });
  b.box(cx0, cy1, ZC - CANOPY_HALF, 0.28, 1.45, CANOPY_HALF * 2, M.paint, { tint: ACM_DARK });
  b.box(cx0 - 0.04, cy1 + 1.45, ZC - CANOPY_HALF - 0.06, 0.36, 0.09, CANOPY_HALF * 2 + 0.12, M.metal, { tint: METAL });
  for (const oz of [0.9, CANOPY_OUT - 1.2])                                     // LED slots in the soffit
    b.box(FX - oz - 0.24, cy0 - 0.1, ZC - CANOPY_HALF + 1, 0.24, 0.1, CANOPY_HALF * 2 - 2, M.glass, { tint: [1.4, 1.3, 1.05] });
  for (const s of [-1, 1]) for (const oz of [3.2, 8.4])                          // tension rods back to the facade
    b.pipe(cx0 + 0.6, cy1, ZC + s * oz, FX - 0.95, 8.2, ZC + s * oz, 0.03, 6, M.metal, { tint: METAL });
  /* sign: 19.2 x 4.8 m, centred on the fascia, facing the avenue */
  const sx = cx0 - 0.02, sy = cy1 + 0.74, sw = 9.6, sh = 2.4;
  b.quad([sx, sy - sh, ZC + sw], [sx, sy + sh, ZC + sw], [sx, sy + sh, ZC - sw], [sx, sy - sh, ZC - sw],
         m.sign, { uv: [1, 0, 1, 1, 0, 1, 0, 0] });
  b.endId();

  /* backlit poster cases flanking the entrance, under the canopy */
  b.id("GP-POSTERS", "poster");
  [-7.9, -5.6, 5.6, 7.9].forEach((lz, i) => {
    const z = ZC + lz;
    b.box(FX - 0.25, 1.09, z - 0.71, 0.22, 2.02, 1.42, M.metal, { tint: METAL });
    const u0 = i / 4, u1 = (i + 1) / 4, v0 = 128 / 512, v1 = 1;
    b.quad([FX - 0.26, 1.24, z + 0.575], [FX - 0.26, 2.96, z + 0.575], [FX - 0.26, 2.96, z - 0.575], [FX - 0.26, 1.24, z - 0.575],
           m.poster, { uv: [u1, v0, u1, v1, u0, v1, u0, v0] });
  });
  b.endId();

  /* where the building stops you, and what the town's inspector reports */
  W.colliders.push({ x0: X0 - 0.05, x1: X1 + 0.1, z0: Z0 - 0.05, z1: Z1 + 0.05, y0: 0, y1: TOP + 1.2, id: "GRANDPALACE", type: "wall" });
  W.assets.push({ id: "GRANDPALACE", type: "cinema", box: [cx0, 0, Z0, X1, TOP + 1.8, Z1], expectY: 0 });
  /* canopy downlights and a wash on the sign, for after dark */
  for (const oz of [-8, 0, 8]) W.lamps.push({ x: FX - 2.7, y: cy0 - 0.2, z: ZC + oz, r: 10, street: true });
  W.lamps.push({ x: cx0 - 5, y: 7.5, z: ZC, r: 13, street: true });
  /* the ground past the old map edge crosses the town's road lines; keep
     walkers on the grass there instead of a kerb's depth below it */
  for (const rz of [24, 100, 176]) W.surfaces.push({ x0: 324, x1: 372, z0: rz - 4, z1: rz + 4, y: 0, id: "GP-LAWN" });

  const ch = { key: "cinema", base: null, detail: null };
  ch.mesh = b.build();
  ch.detailMesh = dt.build();
  ch.assets = b.assets.concat(dt.assets);
  ch.bounds = ch.mesh.bounds.slice ? ch.mesh.bounds.slice() : ch.mesh.bounds;
  if (!ch.detailMesh.empty) {
    const db = ch.detailMesh.bounds;
    for (let i = 0; i < 3; i++) ch.bounds[i] = Math.min(ch.bounds[i], db[i]);
    for (let i = 3; i < 6; i++) ch.bounds[i] = Math.max(ch.bounds[i], db[i]);
  }
  T.Town.chunks.set("cinema", ch);
  T.Town.staticTris = (T.Town.staticTris || 0) + b.tris + dt.tris;
}

const buildTown = T.Town.build;
T.Town.build = function () {
  const out = buildTown.apply(this, arguments);
  try { emitCinema(); } catch (e) { console.error("Grand Palace not placed", e); }
  return out;
};

/* ---------------------------------------------------------------- doors - */
const CINEMA = {
  label: "the Grand Palace",
  verb: "Enter the Grand Palace — take your seat",
  blurb: "The Grand Palace Cinema.",
  kind: "cinema",
  buildingId: "GRANDPALACE",
};
function atDoors() {
  const P = T.Player;
  if (!P || !P.pos || P.building) return false;
  return inside(DOOR, P.pos[0], P.pos[2]);
}
function hookDoors() {
  const D = T.Destinations;
  if (!D || D.__grandPalace) return;
  D.__grandPalace = true;
  const here = D.here, use = D.use;
  D.here = function () {
    return here.apply(this, arguments) || (atDoors() ? Object.assign({}, CINEMA) : null);
  };
  D.use = function (shell) {
    if (!D.open && !(T.Player && T.Player.building) && atDoors()) {
      location.assign(SEATS_URL);
      return true;
    }
    return use.apply(this, arguments);
  };
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", hookDoors);
else setTimeout(hookDoors, 0);

T.GrandPalace = { FX, ZC, DOOR, RESERVE, url: SEATS_URL };
})();
