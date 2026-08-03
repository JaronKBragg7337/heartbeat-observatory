// Derive real-world tile size for a texture by measuring its repeating course
// pitch, rather than trusting a metadata field (ambientCG reports 0x0 for some).
//
// Method: mean luminance per scanline gives a 1-D signal whose period is the
// course pitch. Autocorrelation finds that period without threshold tuning —
// important, because a threshold scan on running-bond masonry can lock onto
// every other course and silently report a 2x error.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const targets = process.argv.slice(2);
if (!targets.length) { console.error("usage: node measure-tex.js <file> [courses_mm]"); process.exit(1); }

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  for (const t of targets) {
    const [file, assumeMM] = t.split("|");
    const b64 = fs.readFileSync(file).toString("base64");
    const ext = path.extname(file).slice(1).toLowerCase();
    const res = await p.evaluate(async ({ src }) => {
      const img = new Image();
      await new Promise((r, j) => { img.onload = r; img.onerror = j; img.src = src; });
      const c = document.createElement("canvas");
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;

      // row-mean luminance
      const rows = new Float64Array(c.height);
      for (let y = 0; y < c.height; y++) {
        let s = 0;
        for (let x = 0; x < c.width; x++) {
          const i = (y * c.width + x) * 4;
          s += d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
        }
        rows[y] = s / c.width;
      }
      const mean = rows.reduce((a, v) => a + v, 0) / rows.length;
      const sig = Array.from(rows, (v) => v - mean);

      // autocorrelation over plausible course pitches
      const maxLag = Math.floor(c.height / 3);
      const ac = [];
      for (let lag = 4; lag <= maxLag; lag++) {
        let s = 0, n = 0;
        for (let i = 0; i + lag < sig.length; i++) { s += sig[i] * sig[i + lag]; n++; }
        ac.push({ lag, v: s / n });
      }
      const norm = ac[0] ? Math.max(...ac.map((a) => Math.abs(a.v))) : 1;
      // first strong local peak = fundamental period
      let best = null;
      for (let i = 1; i < ac.length - 1; i++) {
        if (ac[i].v > ac[i - 1].v && ac[i].v > ac[i + 1].v && ac[i].v / norm > 0.35) { best = ac[i]; break; }
      }
      const top = [...ac].sort((a, b) => b.v - a.v).slice(0, 6).map((a) => ({ lag: a.lag, r: +(a.v / norm).toFixed(3) }));
      return { w: c.width, h: c.height, firstPeakLag: best ? best.lag : null,
               firstPeakStrength: best ? +(best.v / norm).toFixed(3) : null, topPeaks: top };
    }, { src: `data:image/${ext === "jpg" ? "jpeg" : ext};base64,${b64}` });

    const name = path.basename(file);
    const pitch = res.firstPeakLag;
    const coursesInTile = pitch ? res.h / pitch : null;
    const mm = assumeMM ? +assumeMM : 75; // standard brick course = 65 brick + 10 joint
    console.log(`\n=== ${name} ===`);
    console.log(`  image           : ${res.w} x ${res.h}`);
    console.log(`  course pitch    : ${pitch} px  (strength ${res.firstPeakStrength})`);
    console.log(`  top AC peaks    : ${JSON.stringify(res.topPeaks)}`);
    if (pitch) {
      console.log(`  courses in tile : ${coursesInTile.toFixed(2)}`);
      console.log(`  => tile height  : ${(coursesInTile * mm / 1000).toFixed(3)} m  (at ${mm} mm per course)`);
      console.log(`  => tile width   : ${(coursesInTile * mm / 1000 * (res.w / res.h)).toFixed(3)} m`);
    }
  }
  await b.close();
})();
