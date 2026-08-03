// Read renderer counters through the dev handle for legacy vs new, so the cost
// of the material system is a measured number rather than a claim.
const { chromium } = require("playwright");

const BASE = "http://localhost:8099/engine/hub/index.html?preview=1&dev=1&tod=0.17&cam=-16,1.65,-6,0,0";
const VIEWS = {
  desktop: { width: 1440, height: 900, dsf: 1, mobile: false },
  mobile: { width: 390, height: 844, dsf: 2, mobile: true },
};

async function run(url, view, label) {
  const v = VIEWS[view];
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const ctx = await b.newContext({ viewport: { width: v.width, height: v.height }, deviceScaleFactor: v.dsf, isMobile: v.mobile, hasTouch: v.mobile });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errs.push("[console] " + m.text()); });

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForEvent("console", { predicate: (m) => /realism kit loaded|kit fallback/i.test(m.text()), timeout: 90000 }).catch(() => {});
  // Let textures land and the render loop settle before reading counters.
  await page.evaluate(() => new Promise((r) => { let n = 0; const t = () => (++n >= 80 ? r() : requestAnimationFrame(t)); requestAnimationFrame(t); }));

  const stats = await page.evaluate(() => {
    if (!window.HB) return { error: "no dev handle" };
    const mats = window.HB.materials();
    return {
      render: window.HB.renderStats(),
      surfaces: window.HB.surfaceReport(),
      materialCount: mats.length,
      withNormal: mats.filter((m) => m.normalMap).length,
      withAO: mats.filter((m) => m.aoMap).length,
      pendingMaps: mats.filter((m) => m.map === "pending").length,
    };
  });

  // Measure sustained frame time over a fixed number of frames.
  const timing = await page.evaluate(() => new Promise((r) => {
    const N = 60; let n = 0; const t0 = performance.now(); const times = [];
    let last = t0;
    const tick = () => {
      const now = performance.now(); times.push(now - last); last = now;
      if (++n >= N) { times.sort((a, b) => a - b); r({ frames: N, totalMs: Math.round(now - t0), medianFrameMs: +times[Math.floor(N / 2)].toFixed(1) }); }
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));

  const bytes = await page.evaluate(() => performance.getEntriesByType("resource")
    .filter((e) => /\/assets\/textures\//.test(e.name))
    .reduce((a, e) => a + (e.encodedBodySize || e.transferSize || 0), 0));

  await b.close();
  return { label, view, stats, timing, textureBytes: bytes, errors: errs.slice(0, 5) };
}

(async () => {
  const out = [];
  for (const view of ["desktop", "mobile"]) {
    out.push(await run(BASE + "&legacy=1", view, "legacy"));
    out.push(await run(BASE, view, "new"));
  }
  for (const r of out) {
    console.log(`\n===== ${r.label} / ${r.view} =====`);
    if (r.stats.error) { console.log("  ", r.stats.error); }
    else {
      console.log("  draw calls   :", r.stats.render.calls);
      console.log("  triangles    :", r.stats.render.triangles.toLocaleString());
      console.log("  programs     :", r.stats.render.programs);
      console.log("  textures     :", r.stats.render.textures);
      console.log("  materials    :", r.stats.materialCount, `(normal:${r.stats.withNormal} ao:${r.stats.withAO} pending:${r.stats.pendingMaps})`);
      console.log("  surf quality :", JSON.stringify(r.stats.surfaces.quality));
    }
    console.log("  median frame :", r.timing.medianFrameMs, "ms  (software rasteriser — relative only)");
    console.log("  texture bytes:", (r.textureBytes / 1024).toFixed(0), "KB");
    if (r.errors.length) console.log("  ERRORS:", r.errors);
  }
})();
