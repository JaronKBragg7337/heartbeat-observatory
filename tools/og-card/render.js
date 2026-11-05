// Re-render the share card + brand PNG:  node tools/og-card/render.js [out.jpg]
// Needs the playwright npm package resolvable (npm i playwright, or set NODE_PATH).
const { chromium } = require("playwright");
const path = require("path");
const root = path.join(__dirname, "..", "..");
const url = (p) => "file:///" + p.replace(/\\/g, "/");
(async () => {
  const out = process.argv[2] || path.join(root, "og-home-2026-10.jpg");
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  await p.goto(url(path.join(__dirname, "og-card.html")));
  await p.waitForTimeout(500);
  await p.screenshot({ path: out, type: "jpeg", quality: 92 });
  const s = await b.newPage({ viewport: { width: 512, height: 512 } });
  await s.goto(url(path.join(root, "brand", "h-heartbeat.svg")));
  await s.screenshot({ path: path.join(root, "brand", "h-heartbeat.png"), omitBackground: true });
  await b.close();
})();
