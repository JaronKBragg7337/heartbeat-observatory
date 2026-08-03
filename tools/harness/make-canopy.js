// Bake a leaf-cluster canopy card from ambientCG's LeafSet030 scatter atlas.
//
// ambientCG ships leaf SETS (individual leaves on white) rather than canopy
// cards, so the cluster is composited here: leaves are drawn at random rotation
// and scale with a radial density falloff, then hue-rotated from autumn brown to
// summer green. Baking offline rather than at runtime keeps load time flat and
// makes the result deterministic — the RNG is seeded, so the card is reproducible.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const SRC = process.env.HB_TEX_SRC || path.resolve(__dirname, "..", "..", "..", "hb-textures", "src");
const OUT = process.argv[2] || path.resolve(__dirname, "..", "..", "engine", "hub", "assets", "textures");
const SET = "LeafSet030";
const SIZE = 1024;
const GRID = 4;            // LeafSet030 is a 4x4 sheet
// Raised from 150 once leaves were confined inside a border margin: the cluster
// occupies a 0.9x circle rather than the whole card, so it needs more leaves to
// reach the same density inside that circle.
const LEAVES = 260;

(async () => {
  const dir = path.join(SRC, SET);
  const files = fs.readdirSync(dir);
  const colorF = files.find((f) => /_Color\.png$/i.test(f));
  const opacF = files.find((f) => /_Opacity\.png$/i.test(f));
  const b64 = (f) => `data:image/png;base64,${fs.readFileSync(path.join(dir, f)).toString("base64")}`;

  const browser = await chromium.launch();
  const page = await browser.newPage();

  const result = await page.evaluate(async ({ c, o, size, grid, count }) => {
    const load = (src) => new Promise((res, rej) => {
      const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src;
    });
    const [ci, oi] = await Promise.all([load(c), load(o)]);

    // Build an RGBA source sheet (colour + opacity) once.
    const sheet = document.createElement("canvas");
    sheet.width = ci.width; sheet.height = ci.height;
    const sctx = sheet.getContext("2d");
    sctx.drawImage(ci, 0, 0);
    const sd = sctx.getImageData(0, 0, sheet.width, sheet.height);
    const ov = document.createElement("canvas");
    ov.width = ci.width; ov.height = ci.height;
    const octx = ov.getContext("2d");
    octx.drawImage(oi, 0, 0, ci.width, ci.height);
    const od = octx.getImageData(0, 0, ci.width, ci.height).data;
    for (let i = 0; i < sd.data.length; i += 4) sd.data[i + 3] = od[i];
    sctx.putImageData(sd, 0, 0);

    // Seeded LCG so the bake is reproducible.
    let seed = 9137;
    const rng = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;

    const cv = document.createElement("canvas");
    cv.width = size; cv.height = size;
    const ctx = cv.getContext("2d");
    // Autumn oak -> summer green, with a touch of desaturation so it does not
    // read as plastic under the ACES curve.
    ctx.filter = "hue-rotate(72deg) saturate(1.05) brightness(0.92)";

    const cw = sheet.width / grid, ch = sheet.height / grid;
    let drawn = 0;
    // Leaves must never reach the card border. If they do, the quad's straight
    // edge shows as a hard cut through the foliage whenever a card is seen
    // near edge-on — which was visible on the first bake.
    const MAX_R = 0.30, MAX_LEAF = 0.30;   // 0.30 + 0.30/2 = 0.45 < 0.5
    for (let i = 0; i < count; i++) {
      // Radial falloff: dense core, ragged edge.
      const r = Math.pow(rng(), 0.62) * MAX_R * size;
      const th = rng() * Math.PI * 2;
      const x = size / 2 + Math.cos(th) * r;
      const y = size / 2 + Math.sin(th) * r;
      const col = Math.floor(rng() * grid), row = Math.floor(rng() * grid);
      const s = (0.18 + rng() * (MAX_LEAF - 0.18)) * size / Math.max(cw, ch);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rng() * Math.PI * 2);
      ctx.globalAlpha = 0.82 + rng() * 0.18;
      ctx.drawImage(sheet, col * cw, row * ch, cw, ch,
                    -cw * s / 2, -ch * s / 2, cw * s, ch * s);
      ctx.restore();
      drawn++;
    }

    // Belt and braces: force alpha to zero in the outer ring, and verify no
    // opaque pixel survives near the border.
    const img = ctx.getImageData(0, 0, size, size);
    const px = img.data;
    const cxp = size / 2, cyp = size / 2, edge = size * 0.47;
    let opaque = 0, edgeHits = 0;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        const d = Math.hypot(x - cxp, y - cyp);
        if (d > edge) {
          if (px[i + 3] > 8) edgeHits++;
          px[i + 3] = 0;
        }
        if (px[i + 3] > 128) opaque++;
      }
    }
    ctx.putImageData(img, 0, 0);
    return { url: cv.toDataURL("image/webp", 0.86), coverage: opaque / (size * size), drawn, edgeHits };
  }, { c: b64(colorF), o: b64(opacF), size: SIZE, grid: GRID, count: LEAVES });

  await browser.close();
  fs.mkdirSync(OUT, { recursive: true });
  const buf = Buffer.from(result.url.split(",")[1], "base64");
  const name = "canopy_leaf.webp";
  fs.writeFileSync(path.join(OUT, name), buf);
  console.log(`${name}  ${(buf.length / 1024).toFixed(0)} KB   leaves drawn ${result.drawn}   alpha coverage ${(result.coverage * 100).toFixed(1)}%   pixels clipped at border ${result.edgeHits}`);
})();
