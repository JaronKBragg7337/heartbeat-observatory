// Whole-town draw-call comparison at a FIXED wide camera.
//
// An earlier measurement used a camera pointed at a single facade, where frustum
// culling hid most of the scene and made draw calls look flat. Comparing cost
// requires a view that actually contains the town.
const { chromium } = require("playwright");

// Positioned to match the preview orbit's framing, but pinned so both runs see
// exactly the same geometry.
const CAM = "11.5,15.5,21.1,0.498,-0.573";
const BASE = `http://localhost:8099/engine/hub/index.html?preview=1&dev=1&tod=0.17&cam=${CAM}`;

async function run(url, label, view) {
  const vp = view === "mobile"
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
    : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const ctx = await b.newContext(vp);
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e)));
  await p.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
  await p.waitForEvent("console", { predicate: (m) => /realism kit loaded|kit fallback/i.test(m.text()), timeout: 90000 }).catch(() => {});
  await p.evaluate(() => new Promise((r) => { let n = 0; const t = () => (++n >= 75 ? r() : requestAnimationFrame(t)); requestAnimationFrame(t); }));
  const s = await p.evaluate(() => {
    const r = window.HB.renderStats();
    // Count meshes actually in the scene, and how many are the town art vs ours.
    let meshes = 0, townMeshes = 0;
    window.HB.scene.traverse((o) => {
      if (!o.isMesh) return;
      meshes++;
      if (o.name && /^Town_/.test(o.name)) townMeshes++;
    });
    return { ...r, sceneMeshes: meshes, townMeshes,
             canopy: window.HB.canopyStats, win: window.HB.windowStats };
  });
  await b.close();
  return { label, view, ...s, errors: errs.slice(0, 3) };
}

(async () => {
  const rows = [];
  for (const view of ["desktop", "mobile"]) {
    rows.push(await run(BASE + "&legacy=1", "legacy", view));
    rows.push(await run(BASE, "new", view));
  }
  for (const r of rows) {
    console.log(`\n=== ${r.label} / ${r.view} ===`);
    console.log("  draw calls  :", r.calls);
    console.log("  triangles   :", r.triangles.toLocaleString());
    console.log("  scene meshes:", r.sceneMeshes, " (town art:", r.townMeshes + ")");
    console.log("  geometries  :", r.geometries, " textures:", r.textures, " programs:", r.programs);
    if (r.canopy) console.log("  canopy      :", JSON.stringify(r.canopy));
    if (r.win) console.log("  windows     : drawCalls", r.win.drawCalls, "tris", r.win.triangles);
    if (r.errors.length) console.log("  ERRORS:", r.errors);
  }
})();
