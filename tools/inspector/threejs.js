/* ============================================================================
   tools/inspector/threejs.js — read-only adapter for the three.js worlds
   (World 2 at /world2/, Town Square at /engine/hub/)
   ---------------------------------------------------------------------------
   These worlds only exist in a browser, so: serve the repo locally, open the
   page in headless Chromium, and hand it a three.js whose WebGLRenderer.render
   remembers the scene it was given. Then walk that scene, bake every visible
   mesh (instances included) to world-space triangles and bring the soup back
   to Node, where tools/inspector/core.js measures it like any other world.

   three@0.182.0 is served from a local npm install (the sandbox may not reach
   the CDN): set INSPECTOR_THREE=<dir containing build/three.module.js>, or it
   looks for node_modules/three next to this file and in /tmp/claude-0/three.

   What a triangle soup with no building semantics CAN measure:
     roof holes     sky rays on a 0.5 m grid; a cell far lower than the ring
                    of roof around it is a hole (core.findPits)
     floating parts each separate mesh object under 30 m: drop a ray from
                    the middle of its underside onto everything else
     inventory      meshes / triangles per name, and files in the world's
                    folder that nothing references
   What it CANNOT (no rooms, doors or stairs in the data): stair, doorway and
   room checks. Those need an adapter that reads the world's own building
   records, like ashgrove.js does.
   ========================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");
const http = require("http");
const { Soup, AxisCaster, heightfield, findPits } = require("./core");

const REPO = path.join(__dirname, "..", "..");
const WORLDS = {
  world2: { page: "/world2/index.html", dir: "world2", settle: 12000 },
  townsquare: { page: "/engine/hub/index.html", dir: "engine/hub", settle: 15000 },
};

function threeDir() {
  for (const d of [process.env.INSPECTOR_THREE, path.join(__dirname, "node_modules", "three"),
                   path.join(REPO, "node_modules", "three"), "/tmp/claude-0/three/node_modules/three"])
    if (d && fs.existsSync(path.join(d, "build", "three.module.js"))) return d;
  throw new Error("three@0.182.0 not found: npm i three@0.182.0 in tools/inspector, or set INSPECTOR_THREE");
}

function serve() {
  return new Promise((res) => {
    const srv = http.createServer((q, r) => {
      let p = decodeURIComponent(q.url.split("?")[0]);
      if (p.endsWith("/")) p += "index.html";
      const f = path.join(REPO, p);
      if (!f.startsWith(REPO) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
      const ext = path.extname(f);
      r.writeHead(200, { "content-type": { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".glb": "model/gltf-binary", ".webp": "image/webp" }[ext] || "application/octet-stream" });
      fs.createReadStream(f).pipe(r);
    }).listen(0, () => res(srv));
  });
}

async function capture(worldKey) {
  const { chromium } = require("playwright");
  const W = WORLDS[worldKey], T3 = threeDir();
  const srv = await serve();
  const base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push("pageerror " + e.message));
  await page.route("https://cdn.jsdelivr.net/npm/three@0.182.0/**", async (route) => {
    const rel = route.request().url().split("three@0.182.0/")[1].split("?")[0];
    const f = path.join(T3, rel);
    if (!fs.existsSync(f)) return route.fulfill({ status: 404, body: "" });
    let body = fs.readFileSync(f, "utf8");
    if (rel === "build/three.module.js")
      body += "\n;{const __r=WebGLRenderer.prototype.render;WebGLRenderer.prototype.render=function(s,c){if(s&&s.isScene)globalThis.__INSP_SCENE=s;return __r.call(this,s,c);};}\n";
    return route.fulfill({ status: 200, contentType: "text/javascript", body });
  });
  /* everything else off-box (analytics, supabase, fonts): refuse quickly */
  /* (Playwright tries the LAST registered route first, so this pattern has to
     leave the three.js CDN path alone itself) */
  await page.route(/^https?:\/\/(?!127\.0\.0\.1|cdn\.jsdelivr\.net\/npm\/three@0\.182\.0\/)/, (route) => route.abort());
  await page.goto(base + W.page, { waitUntil: "load", timeout: 120000 });
  await page.waitForTimeout(3000);
  await page.evaluate(() => { const b = document.querySelector("#enterButton, #enter, button.enter"); if (b) b.click(); });
  await page.waitForFunction(() => !!globalThis.__INSP_SCENE, null, { timeout: 180000 });
  await page.waitForTimeout(W.settle);
  const dump = await page.evaluate(() => {
    const scene = globalThis.__INSP_SCENE;
    scene.updateMatrixWorld(true);
    const objs = [], chunks = [];
    let total = 0;
    const MAX = 2500000;
    scene.traverseVisible((o) => {
      if (!o.isMesh || o.isSkinnedMesh || !o.geometry || !o.geometry.attributes.position) return;
      if (o.material && (o.material.transparent && o.material.opacity < 0.2)) return;
      const g = o.geometry, pos = g.attributes.position, idx = g.index;
      const nTri = (idx ? idx.count : pos.count) / 3;
      const inst = o.isInstancedMesh ? o.count : 1;
      if (total + nTri * inst > MAX) return;
      const M = o.matrixWorld.clone(), IM = new M.constructor(), v = new (scene.position.constructor)();
      const out = new Float32Array(nTri * inst * 9);
      let k = 0;
      for (let i = 0; i < inst; i++) {
        const W2 = M.clone();
        if (o.isInstancedMesh) { o.getMatrixAt(i, IM); W2.multiply(IM); }
        for (let t = 0; t < nTri * 3; t++) {
          const vi = idx ? idx.getX(t) : t;
          v.fromBufferAttribute(pos, vi).applyMatrix4(W2);
          out[k++] = v.x; out[k++] = v.y; out[k++] = v.z;
        }
      }
      total += nTri * inst;
      const bytes = new Uint8Array(out.buffer);
      let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      objs.push({ name: o.name || (o.parent && o.parent.name) || o.type, mat: o.material && (o.material.name || o.material.type), tris: nTri * inst, instanced: !!o.isInstancedMesh });
      chunks.push(btoa(s));
    });
    return { objs, chunks, total };
  });
  await browser.close(); srv.close();
  return { dump, errors };
}

async function inspect(worldKey) {
  const W = WORLDS[worldKey];
  const { dump, errors } = await capture(worldKey);
  const soup = new Soup(), perObj = [];
  dump.objs.forEach((o, oi) => {
    const f = new Float32Array(Buffer.from(dump.chunks[oi], "base64").buffer.slice(0));
    const s0 = soup.count;
    for (let i = 0; i < f.length; i += 9) soup.add([f[i], f[i + 1], f[i + 2]], [f[i + 3], f[i + 4], f[i + 5]], [f[i + 6], f[i + 7], f[i + 8]], oi);
    perObj.push({ ...o, first: s0, last: soup.count });
  });
  const b = soup.bounds();
  const yC = new AxisCaster(soup, 1, 1.0);
  /* roof holes over the whole world, 0.5 m sky grid */
  const hf = heightfield(yC, Math.max(b[0], -400), Math.max(b[2], -400), Math.min(b[3], 400), Math.min(b[5], 400), 0.5);
  const pits = findPits(hf, { minDrop: 1.5, ring: 3, minRoof: 3.0, maxPitCells: 40 });
  /* floating: each modest-size object, ray down from the middle of its underside */
  const floating = [];
  for (const o of perObj) {
    if (o.instanced || o.last - o.first < 2) continue;
    let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (let t = o.first; t < o.last; t++) for (let k = 0; k < 9; k++) { const v = soup.v[t * 9 + k]; const a = k % 3; if (v < mn[a]) mn[a] = v; if (v > mx[a]) mx[a] = v; }
    if (mx[0] - mn[0] > 30 || mx[2] - mn[2] > 30) continue;      // merged chunk meshes: not one part
    const cx = (mn[0] + mx[0]) / 2 + 0.013, cz = (mn[2] + mx[2]) / 2 + 0.013;
    const own = new Set(); for (let t = o.first; t < o.last; t++) own.add(t);
    const below = yC.hits(cx, cz).filter((h) => !own.has(h.tri) && h.at <= mn[1] + 0.02);
    const support = below.length ? below[below.length - 1].at : null;
    const gap = support === null ? null : mn[1] - support;
    if (support === null || gap > 0.15)
      floating.push({ name: o.name, at: [+cx.toFixed(1), +mn[1].toFixed(2), +cz.toFixed(1)], gapM: gap === null ? "nothing below" : +gap.toFixed(2), tris: o.tris });
  }
  const byName = {};
  for (const o of perObj) { const k = o.name; byName[k] = byName[k] || { meshes: 0, tris: 0 }; byName[k].meshes++; byName[k].tris += o.tris; }
  /* files in the world's folder nothing references */
  const dir = path.join(REPO, W.dir), files = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else files.push(p); } };
  walk(dir);
  const code = files.filter((f) => /\.(html|js|mjs|css|json)$/.test(f)).map((f) => fs.readFileSync(f, "utf8")).join("\n");
  const neverLoaded = files.filter((f) => !f.endsWith("index.html") && !code.includes(path.basename(f))).map((f) => path.relative(REPO, f));

  const r = { world: worldKey, generated: new Date().toISOString(), page: W.page, meshes: perObj.length, triangles: soup.count,
              bounds: b.map((v) => +v.toFixed(1)), roofHoles: pits, floating, byName, neverLoaded, consoleErrors: errors };
  const L = [`# ${worldKey} — building inspector report (read-only)`, "",
    `Generated ${r.generated} by \`node tools/inspector/inspect.js ${worldKey}\`: ${W.page} opened in headless Chromium, the live three.js scene baked to ${r.triangles} world-space triangles from ${r.meshes} visible meshes.`, "",
    "No building records are exposed by this world, so stair, doorway and room checks are **not measured** here (see tools/inspector/README.md).", "",
    `## Roof holes (sky rays, 0.5 m grid): ${pits.length}`, ""];
  for (const p of pits.slice(0, 60)) L.push(`- ${p.areaM2} m² at (x ${p.x}, z ${p.z}), ray fell to y=${p.floorY}`);
  L.push("", `## Floating parts (> 0.15 m above whatever is under them): ${floating.length}`, "");
  for (const f of floating.slice(0, 60)) L.push(`- ${f.name} at (${f.at.join(", ")}): ${f.gapM === "nothing below" ? "nothing below it" : f.gapM + " m gap"}`);
  L.push("", "## Meshes by name", "", "| name | meshes | triangles |", "|---|---|---|");
  for (const [k, v] of Object.entries(byName).sort((a, b) => b[1].tris - a[1].tris).slice(0, 40)) L.push(`| ${k} | ${v.meshes} | ${v.tris} |`);
  L.push("", "## Files in the folder that nothing references", "", neverLoaded.length ? neverLoaded.map((f) => `- \`${f}\``).join("\n") : "None.");
  L.push("", `## Console errors during the run (${errors.length})`, "", "Off-box requests (analytics, Supabase, fonts) are refused on purpose in this run, so errors about those are expected here.", "");
  for (const e of errors.slice(0, 30)) L.push(`- ${e.slice(0, 200)}`);
  L.push("");
  r.markdown = L.join("\n");
  return r;
}

module.exports = { inspect };
