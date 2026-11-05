#!/usr/bin/env node
/* ============================================================================
   tools/inspector/shoot.js — before/after evidence shots for Ashgrove
   ---------------------------------------------------------------------------
       node tools/inspector/shoot.js <siteRoot> <outDir> [--phone]

   Serves <siteRoot> (the repo root, or a copy of it with the old render/
   files for the BEFORE set) on a local port, opens /world3/town/ in headless
   Chromium (SwiftShader: software WebGL, so looks are real but frame times
   mean nothing), points the town's own orbit camera at the buildings the
   inspector flagged, and saves PNGs. Also records every console error, at
   1280x800 and at 390x844 (iPhone-sized) — the run fails loudly if any.
   ========================================================================== */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const root = path.resolve(process.argv[2] || path.join(__dirname, "..", ".."));
const out = path.resolve(process.argv[3] || path.join(__dirname, "shots"));
fs.mkdirSync(out, { recursive: true });

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".png": "image/png", ".jpg": "image/jpeg", ".json": "application/json", ".webp": "image/webp", ".glb": "model/gltf-binary",
  ".svg": "image/svg+xml", ".ktx2": "image/ktx2", ".webmanifest": "application/manifest+json" };
function serve() {
  return new Promise((res) => {
    const srv = http.createServer((q, r) => {
      let p = decodeURIComponent(q.url.split("?")[0]);
      if (p.endsWith("/")) p += "index.html";
      const f = path.join(root, p);
      if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
      r.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" });
      fs.createReadStream(f).pipe(r);
    }).listen(0, () => res(srv));
  });
}

/* [file, building id, preset, extra yaw (rad), what it shows] */
const SHOTS = [
  ["gable-bungalow-B27", "B27", "SIDE", 0, "gable end: the wedge up both rakes"],
  ["shed-splitlevel-B47", "B47", "SIDE", 0, "shed roof: open side wedge"],
  ["shed-splitlevel-B47-back", "B47", "AERIAL", Math.PI, "shed roof: open high back"],
  ["aframe-B31", "B31", "SIDE", 0, "A-frame gable end"],
  ["chapel-B04", "B04", "FRONT", 0, "chapel: steeple stood inside the nave on the front door"],
  ["townhouse-B38-fence", "B38", "AERIAL", 0, "boundary fence through the house"],
];

async function main() {
  const srv = await serve();
  const base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const errors = [];
  for (const vp of [{ width: 1280, height: 800, tag: "desk", dpr: 1 }, { width: 390, height: 844, tag: "phone", mobile: true }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1,
      isMobile: !!vp.mobile, hasTouch: !!vp.mobile });
    const page = await ctx.newPage();
    page.on("console", (m) => { if (m.type() === "error") errors.push(`[${vp.tag}] ${m.text()}`); });
    page.on("pageerror", (e) => errors.push(`[${vp.tag}] pageerror ${e.message}`));
    await page.goto(`${base}/world3/town/index.html?q=low`, { waitUntil: "load" });
    await page.waitForFunction(() => window.TOWN && TOWN.Town && TOWN.Town.buildings && TOWN.Town.buildings.length >= 49 && TOWN.Cam, null, { timeout: 180000 });
    await page.waitForTimeout(4000);
    if (vp.tag === "phone") { await page.screenshot({ path: path.join(out, "phone-first-screen.png"), timeout: 180000 }); await ctx.close(); continue; }
    for (const [name, id, preset, dyaw] of SHOTS) {
      await page.evaluate(([id, preset, dyaw]) => {
        const T = window.TOWN, b = T.Town.buildings.find((x) => x.id === id);
        document.querySelectorAll(".panel,.overlay,#intro,#help").forEach((e) => (e.style.display = "none"));
        /* a free (noclip) camera placed outside the building and aimed at it:
           the orbit rig eases toward its preset over many frames, and at
           SwiftShader's few fps it is still somewhere odd at shutter time */
        T.Cam.exit();
        const bb = b.bounds, cx = (bb[0] + bb[3]) / 2, cz = (bb[2] + bb[5]) / 2;
        const top = b.top + (b.def.roof === "flat" ? 0.8 : b.def.d * 0.5 * (b.def.pitch || 0.5));
        const diag = Math.hypot(bb[3] - bb[0], bb[5] - bb[2]);
        const lx = [b.c, -b.s], lz = [b.s, b.c];                 // local +x and +z in world
        let dir = preset === "SIDE" ? [lx[0], lx[1]] : preset === "FRONT" ? [-lz[0], -lz[1]] : [lx[0] - lz[0], lx[1] - lz[1]];
        if (dyaw) dir = [-dir[0], -dir[1]];
        const n = Math.hypot(dir[0], dir[1]); dir = [dir[0] / n, dir[1] / n];
        const D = diag * (preset === "AERIAL" ? 1.3 : 1.05), ey = preset === "AERIAL" ? top * 1.6 : top * 0.75;
        const ex = cx + dir[0] * D, ez = cz + dir[1] * D;
        T.Player.noclip = true; T.Player.vel = [0, 0, 0];
        T.Player.pos = [ex, ey - 1.66, ez];
        const dx = cx - ex, dz = cz - ez, dy = top * 0.55 - ey;
        T.Player.yaw = Math.atan2(-dx, -dz); T.Player.pitch = Math.atan2(dy, Math.hypot(dx, dz));
      }, [id, preset, dyaw]);
      await page.waitForTimeout(2500);
      await page.screenshot({ path: path.join(out, `${name}.png`), timeout: 180000 });
    }
    /* inside: stand at the foot of the Tudor stair and look up the well */
    await page.evaluate(() => {
      const T = window.TOWN, b = T.Town.buildings.find((x) => x.id === "B12");
      T.Cam.exit(); T.Player.noclip = false;
      const s = b.plan.levels[0].stairs.world;
      /* stand 0.6 m in front of the first step (or where it would be), face up the run */
      const lo = s.wAxis === "x" ? s.x0 : s.z0, hi = s.wAxis === "x" ? s.x1 : s.z1;
      const foot = s.asc ? lo - 0.6 : hi + 0.6, mid = s.wAxis === "x" ? (s.z0 + s.z1) / 2 : (s.x0 + s.x1) / 2;
      const x = s.wAxis === "x" ? foot : mid, z = s.wAxis === "x" ? mid : foot;
      if (T.requestInterior) T.requestInterior(b);
      T.Player.reset([x, s.yLo + 0.05, z]);
      T.Player.yaw = s.wAxis === "x" ? (s.asc ? -Math.PI / 2 : Math.PI / 2) : (s.asc ? Math.PI : 0);
      T.Player.pitch = 0.75;
    });
    await page.waitForTimeout(3500);
    await page.screenshot({ path: path.join(out, "stairwell-B12-looking-up.png"), timeout: 180000 });
    await ctx.close();
  }
  await browser.close(); srv.close();
  fs.writeFileSync(path.join(out, "console-errors.txt"), errors.join("\n") + "\n");
  console.log(`${errors.length} console error(s)`); for (const e of errors.slice(0, 20)) console.log("  " + e);
}
main().catch((e) => { console.error(e); process.exit(2); });
