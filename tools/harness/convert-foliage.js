// Composite ambientCG foliage atlases (separate Color + Opacity maps) into
// single RGBA WebP cutouts, which is what an alpha-tested leaf card needs.
//
// JPEG cannot carry alpha, so these stay PNG-sourced and land as RGBA WebP.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const SRC = process.argv[3] || process.env.HB_TEX_SRC ||
  path.resolve(__dirname, "..", "..", "..", "hb-textures", "src");
const OUT = process.argv[2] || path.resolve(__dirname, "..", "..", "engine", "hub", "assets", "textures");
const ASSETS = (process.argv[4] || "Foliage001,Foliage003,LeafSet030").split(",");
const SIZE = 1024;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  fs.mkdirSync(OUT, { recursive: true });
  let total = 0;

  for (const id of ASSETS) {
    const dir = path.join(SRC, id);
    if (!fs.existsSync(dir)) { console.log("missing", id); continue; }
    const files = fs.readdirSync(dir);
    const color = files.find((f) => /_Color\.png$/i.test(f));
    const opacity = files.find((f) => /_Opacity\.png$/i.test(f));
    if (!color || !opacity) { console.log("no color/opacity pair for", id); continue; }

    const b64 = (f) => fs.readFileSync(path.join(dir, f)).toString("base64");
    const dataUrl = await page.evaluate(async ({ c, o, size }) => {
      const load = (src) => new Promise((res, rej) => {
        const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src;
      });
      const [ci, oi] = await Promise.all([load(c), load(o)]);
      const cv = document.createElement("canvas");
      cv.width = size; cv.height = size;
      const ctx = cv.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(ci, 0, 0, size, size);
      const cd = ctx.getImageData(0, 0, size, size);

      const ov = document.createElement("canvas");
      ov.width = size; ov.height = size;
      const octx = ov.getContext("2d");
      octx.imageSmoothingQuality = "high";
      octx.drawImage(oi, 0, 0, size, size);
      const od = octx.getImageData(0, 0, size, size).data;

      // Opacity map is greyscale; take red as the mask.
      let opaque = 0;
      for (let i = 0; i < cd.data.length; i += 4) {
        const a = od[i];
        cd.data[i + 3] = a;
        if (a > 128) opaque++;
      }
      ctx.putImageData(cd, 0, 0);
      return { url: cv.toDataURL("image/webp", 0.88), coverage: opaque / (size * size) };
    }, { c: `data:image/png;base64,${b64(color)}`, o: `data:image/png;base64,${b64(opacity)}`, size: SIZE });

    const buf = Buffer.from(dataUrl.url.split(",")[1], "base64");
    const name = `${id}_leaf.webp`;
    fs.writeFileSync(path.join(OUT, name), buf);
    total += buf.length;
    console.log(`  ${name.padEnd(30)} ${(buf.length / 1024).toFixed(0).padStart(5)} KB   alpha coverage ${(dataUrl.coverage * 100).toFixed(1)}%`);
  }
  await browser.close();
  console.log(`\nTOTAL foliage: ${(total / 1024).toFixed(0)} KB -> ${OUT}`);
})();
