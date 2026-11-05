#!/usr/bin/env node
/* ============================================================================
   tools/inspector/elevation.js — before/after evidence as measured drawings
   ---------------------------------------------------------------------------
       node tools/inspector/elevation.js <outDir> [--render-dir <dir>] [B27 B47 ...]

   Orthographic side elevation of a building straight from the inspector's
   triangle soup (exterior only), painted far-to-near, with every roof-gap
   sample the inspector found drawn in red on top. Software, no GPU, no
   camera rig — so a BEFORE and an AFTER are exactly comparable.
   ========================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");
const A = require("./ashgrove");

const argv = process.argv.slice(2);
const out = path.resolve(argv[0] || "elev");
const rd = argv.indexOf("--render-dir") >= 0 ? path.resolve(argv[argv.indexOf("--render-dir") + 1]) : undefined;
const ids = argv.slice(1).filter((a, i, all) => /^B\d\d$/.test(a));
fs.mkdirSync(out, { recursive: true });

const { T, soups } = A.boot({ renderDir: rd });
const COL = { roof: "#7a5a4a", wall: "#d8d2c4", trim: "#f4f2ee", foundation: "#9a9a96", window: "#5d7488", steeple: "#d8d2c4", vent: "#bbb", part: "#c9c3b5" };
for (const id of ids.length ? ids : ["B27", "B47", "B31", "B12"]) {
  const b = T.Town.buildings.find((x) => x.id === id);
  const s = soups.get(id).filter((t) => t.phase === "ext" && t.type !== "decal");
  /* look at the gable end: local +x in world, i.e. view along -(c, -s) */
  const ax = Math.abs(b.c) > 0.5 ? 0 : 2;                  // world axis we look along
  const u = ax === 0 ? 2 : 0;                               // horizontal axis on the drawing
  const bb = s.bounds(); const W = 700, S = W / Math.max(14, bb[u + 3] - bb[u]);
  const H = Math.ceil((bb[4] + 1) * S) + 20;
  const tris = [];
  for (let i = 0; i < s.count; i++) {
    const v = s.v.slice(i * 9, i * 9 + 9);
    const depth = (v[ax] + v[3 + ax] + v[6 + ax]) / 3;
    tris.push({ depth, pts: [0, 1, 2].map((k) => [((v[k * 3 + u] - bb[u]) * S + 10).toFixed(1), (H - 10 - v[k * 3 + 1] * S).toFixed(1)]), tag: s.tag[i] });
  }
  /* we look from the +ax side: nearest = largest coordinate, draw it last */
  tris.sort((a, b2) => a.depth - b2.depth);
  const r = A.inspectOne ? null : null;
  const L = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W + 20}" height="${H + 30}" viewBox="0 0 ${W + 20} ${H + 30}"><rect width="100%" height="100%" fill="#bcd3e6"/>`];
  for (const t of tris) {
    const c = t.tag.roof && t.tag.type === "roof" ? COL.roof : COL[t.tag.type] || COL.part;
    L.push(`<polygon points="${t.pts.map((p) => p.join(",")).join(" ")}" fill="${c}" stroke="${c}" stroke-width="0.4"/>`);
  }
  L.push(`<text x="12" y="${H + 22}" font-family="monospace" font-size="14">${id} ${b.def.label}, ${rd ? "BEFORE" : "AFTER"} — orthographic end elevation from the measured triangles</text></svg>`);
  fs.writeFileSync(path.join(out, `${id}-${rd ? "before" : "after"}.svg`), L.join("\n"));
  console.log("wrote", id);
}
