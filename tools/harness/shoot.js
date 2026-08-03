// Headless capture harness for Heartbeat Observatory (doctrine Part 9.5).
//
// Two traps this is written around, both called out in the doctrine:
//  · The renderer here is SwiftShader (software) and runs at a few fps. Anything
//    that waits on wall-clock time will read as broken when it is fine. So we
//    wait on SIGNALS — the kit's own console line, then a measured count of
//    rAF ticks — never on a sleep.
//  · A blank canvas is indistinguishable from a slow one in a screenshot. So we
//    sample real pixels off the drawing buffer and refuse to report success on
//    a frame that never drew.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const VIEWPORTS = {
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  mobile:  { width: 390,  height: 844, deviceScaleFactor: 2, isMobile: true,  hasTouch: true,
             userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" },
};

async function capture({ url, viewport, out, label, waitFrames = 45, settleMs = 0 }) {
  const vp = VIEWPORTS[viewport];
  const browser = await chromium.launch({
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
           "--ignore-gpu-blocklist", "--enable-webgl", "--disable-dev-shm-usage"],
  });
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.deviceScaleFactor,
    isMobile: vp.isMobile,
    hasTouch: vp.hasTouch,
    ...(vp.userAgent ? { userAgent: vp.userAgent } : {}),
  });
  const page = await ctx.newPage();

  const consoleLines = [];
  const errors = [];
  page.on("console", (m) => consoleLines.push(`[${m.type()}] ${m.text()}`));
  page.on("pageerror", (e) => errors.push(String(e)));

  // Resolves when the town kit reports itself loaded, but never blocks forever.
  const kitLoaded = page
    .waitForEvent("console", { predicate: (m) => /realism kit loaded|kit fallback/i.test(m.text()), timeout: 90000 })
    .then((m) => m.text())
    .catch(() => null);

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
  const kitMsg = await kitLoaded;

  // Count real animation frames rather than sleeping — the only honest way to
  // know the renderer produced work on a software rasteriser.
  const frames = await page.evaluate((n) => new Promise((resolve) => {
    let c = 0;
    const t0 = performance.now();
    const tick = () => { if (++c >= n) resolve({ frames: c, ms: Math.round(performance.now() - t0) });
                         else requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    setTimeout(() => resolve({ frames: c, ms: Math.round(performance.now() - t0), timedOut: true }), 120000);
  }), waitFrames);

  if (settleMs) await page.waitForTimeout(settleMs);

  // Prove the canvas actually drew: read the backbuffer and measure it.
  const canvasStats = await page.evaluate(() => {
    const c = document.querySelector("#game");
    if (!c) return { error: "no #game canvas" };
    const gl = c.getContext("webgl2") || c.getContext("webgl");
    const info = { cssW: c.clientWidth, cssH: c.clientHeight, bufW: c.width, bufH: c.height, gl: !!gl };
    if (!gl) return info;
    const w = Math.min(c.width, 220), h = Math.min(c.height, 220);
    const px = new Uint8Array(w * h * 4);
    try { gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px); } catch (e) { info.readErr = String(e); return info; }
    let sum = 0, min = 255, max = 0; const seen = new Set();
    for (let i = 0; i < px.length; i += 4) {
      const l = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114);
      sum += l; if (l < min) min = l; if (l > max) max = l;
      seen.add((px[i] >> 4) << 8 | (px[i + 1] >> 4) << 4 | (px[i + 2] >> 4));
    }
    info.meanLuma = +(sum / (px.length / 4)).toFixed(1);
    info.minLuma = min; info.maxLuma = max; info.distinctColors = seen.size;
    // preserveDrawingBuffer is off, so readPixels after a compositing frame can
    // come back cleared. distinctColors is the reliable "did it draw" signal.
    return info;
  });

  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.screenshot({ path: out, animations: "disabled" });
  const bytes = fs.statSync(out).size;

  await browser.close();
  return { label, viewport, url, out, bytes, kitMsg, frames, canvasStats,
           errors, console: consoleLines.slice(-12) };
}

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => {
    const i = a.indexOf("="); return i < 0 ? [a.replace(/^--/, ""), true] : [a.slice(2, i), a.slice(i + 1)];
  }));
  const url = args.url || "https://heartbeatobservatory.com/engine/hub/?preview=1";
  const tag = args.tag || "before";
  const dir = args.dir || path.join(__dirname, "shots");
  const views = (args.views || "desktop,mobile").split(",");

  const results = [];
  for (const v of views) {
    const out = path.join(dir, `${tag}-${v}.png`);
    process.stdout.write(`capturing ${v} -> ${out}\n`);
    results.push(await capture({ url, viewport: v, out, label: tag,
                                 waitFrames: +(args.frames || 45), settleMs: +(args.settle || 0) }));
  }
  fs.writeFileSync(path.join(dir, `${tag}-report.json`), JSON.stringify(results, null, 2));
  for (const r of results) {
    console.log(`\n=== ${r.label} / ${r.viewport} ===`);
    console.log("  png bytes   :", r.bytes);
    console.log("  kit         :", r.kitMsg || "(no kit message seen)");
    console.log("  frames      :", JSON.stringify(r.frames));
    console.log("  canvas      :", JSON.stringify(r.canvasStats));
    if (r.errors.length) console.log("  PAGE ERRORS :", r.errors.slice(0, 4));
  }
}
main().catch((e) => { console.error("HARNESS FAIL:", e); process.exit(1); });
