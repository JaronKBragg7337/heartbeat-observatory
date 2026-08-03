// Contact sheet of downloaded texture Color maps, so the whole palette can be
// judged in one look instead of ten separate reads.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const SRC = process.argv[2] || process.env.HB_TEX_SRC ||
  path.resolve(__dirname, "..", "..", "..", "hb-textures", "src");
const dirs = fs.readdirSync(SRC).filter((d) => fs.statSync(path.join(SRC, d)).isDirectory());

const cells = dirs.map((d) => {
  const files = fs.readdirSync(path.join(SRC, d));
  const color = files.find((f) => /_Color\.(jpg|png)$/i.test(f));
  if (!color) return null;
  const p = path.join(SRC, d, color);
  const b64 = fs.readFileSync(p).toString("base64");
  const ext = path.extname(color).slice(1).toLowerCase();
  return { name: d, src: `data:image/${ext === "jpg" ? "jpeg" : ext};base64,${b64}` };
}).filter(Boolean);

const html = `<style>
  body{margin:0;background:#141414;font:13px system-ui;color:#eee}
  .g{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;padding:8px}
  .c{position:relative;aspect-ratio:1;overflow:hidden;border:1px solid #333;background:#000}
  .c img{width:100%;height:100%;object-fit:cover;display:block}
  .l{position:absolute;left:0;right:0;bottom:0;background:rgba(0,0,0,.72);padding:4px 6px;font-weight:600}
</style><div class="g">
${cells.map((c) => `<div class="c"><img src="${c.src}"><div class="l">${c.name}</div></div>`).join("\n")}
</div>`;

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 620 } });
  await p.setContent(html);
  await p.waitForLoadState("networkidle");
  const out = path.join(__dirname, "shots", "texture-contact-sheet.png");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await p.screenshot({ path: out, fullPage: true });
  await b.close();
  console.log("wrote", out, "cells:", cells.length);
})();
