#!/usr/bin/env node
/* ============================================================================
   tools/layers.js — enforce the layer boundary
   ---------------------------------------------------------------------------
   The whole architecture rests on one rule:

       sim/ must never depend on render/

   An NPC working a night shift in a building nobody is standing near must
   still exist. If simulation state is reachable only through Three.js objects,
   meshes or the DOM, that stops being true the moment the camera walks away —
   the town frees building interiors at ~46 m and caps them at 16 live.

   This check makes that rule mechanical instead of aspirational.

       node tools/layers.js        exits 1 on a violation
   ========================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

/* what a layer is forbidden from touching, and why */
const RULES = [
  { dir: "sim",
    banned: [
      [/\brender\//, "sim must not reference the render layer"],
      [/\bTOWN\.(GL|Mats|Builder|Mesh|Program|LineBatch|Cam|Debug|Edit)\b/, "sim must not touch renderer objects"],
      [/\b(document|window|navigator|requestAnimationFrame|canvas|WebGL)\b/, "sim must not touch the DOM or a GPU"],
      [/\bTHREE\b/, "sim must not depend on a 3D library"],
    ] },
  { dir: "world",
    banned: [
      [/\b(document|requestAnimationFrame)\b/, "world state must not depend on a frame loop or the DOM"],
      [/\bTHREE\b/, "world state must not depend on a 3D library"],
    ] },
];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : (e.name.endsWith(".js") ? [p] : []);
  });
}

let bad = 0, files = 0;
for (const rule of RULES) {
  for (const file of walk(path.join(ROOT, rule.dir))) {
    files++;
    const lines = fs.readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;          // comments may discuss them
      for (const [re, why] of rule.banned) {
        if (re.test(line)) {
          console.error(`${path.relative(ROOT, file)}:${i + 1}  ${why}\n    ${line.trim()}`);
          bad++;
        }
      }
    });
  }
}
console.log(bad ? `\n${bad} layer violation(s) in ${files} file(s)`
                : `layer boundaries hold (${files} file(s) checked)`);
process.exit(bad ? 1 : 0);
