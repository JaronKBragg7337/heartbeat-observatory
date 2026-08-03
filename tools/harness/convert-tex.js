// Convert ambientCG PNG/JPG map sets to web-delivery WebP at a chosen size.
// Uses Chromium's own encoder so there's no native dependency to install.
//
// Doctrine Part 5: "Compress before you downscale." Colour and normal keep 1024;
// roughness/AO drop to 512 because they carry low-frequency information and the
// eye cannot resolve the difference once the surface is tiled at 1-3 m.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

// Source = a directory of extracted ambientCG map sets, one folder per asset.
// Override with argv or HB_TEX_SRC; defaults to a sibling of the repo.
const SRC = process.argv[3] || process.env.HB_TEX_SRC ||
  path.resolve(__dirname, "..", "..", "..", "hb-textures", "src");
const OUT = process.argv[2] || path.resolve(__dirname, "..", "..", "engine", "hub", "assets", "textures");

// map suffix -> [outputSuffix, size, quality]
// Normals stay at 512: WebP encodes high-frequency normal noise very poorly
// (a 1024 asphalt normal cost 486 KB on its own — a fifth of the whole budget),
// and at 1-4 m tiling the extra resolution is not resolvable on a phone.
const WANT = [
  [/_Color\.(jpg|png)$/i,            "color",  1024, 0.82],
  [/_NormalGL\.(jpg|png)$/i,         "normal",  512, 0.85],
  [/_Roughness\.(jpg|png)$/i,        "rough",   512, 0.78],
  [/_AmbientOcclusion\.(jpg|png)$/i, "ao",      512, 0.78],
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  fs.mkdirSync(OUT, { recursive: true });

  const dirs = fs.readdirSync(SRC).filter((d) => fs.statSync(path.join(SRC, d)).isDirectory());
  let totalBytes = 0;
  const manifest = [];

  for (const dir of dirs) {
    const files = fs.readdirSync(path.join(SRC, dir));
    const entry = { id: dir, maps: {} };
    for (const [re, suffix, size, q] of WANT) {
      const f = files.find((x) => re.test(x));
      if (!f) continue;
      const srcPath = path.join(SRC, dir, f);
      const b64 = fs.readFileSync(srcPath).toString("base64");
      const ext = path.extname(f).slice(1).toLowerCase();
      const dataUrl = await page.evaluate(async ({ src, size, q }) => {
        const img = new Image();
        await new Promise((r, j) => { img.onload = r; img.onerror = j; img.src = src; });
        // Preserve aspect ratio: longest edge -> size.
        const scale = size / Math.max(img.width, img.height);
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        const ctx = c.getContext("2d");
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, w, h);
        return c.toDataURL("image/webp", q);
      }, { src: `data:image/${ext === "jpg" ? "jpeg" : ext};base64,${b64}`, size, q });

      const buf = Buffer.from(dataUrl.split(",")[1], "base64");
      const outName = `${dir}_${suffix}.webp`;
      fs.writeFileSync(path.join(OUT, outName), buf);
      totalBytes += buf.length;
      entry.maps[suffix] = outName;
      console.log(`  ${outName.padEnd(38)} ${(buf.length / 1024).toFixed(0).padStart(5)} KB`);
    }
    manifest.push(entry);
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, "_manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`\nTOTAL: ${(totalBytes / 1024 / 1024).toFixed(2)} MB across ${manifest.length} materials -> ${OUT}`);
})();
