// Bake Callisto's globe picture from the USGS Voyager/Galileo global mosaic (assets/callisto/usgs-global.jpg,
// public domain USGS; the game's own copy of the picture, see credits.json): resize to 1024x512, fill the
// unmapped pole wedges with their row's mean, and colour the grey albedo to Callisto's ice palette
// (dark dust-stained plains to bright brown-white crater floors). Writes assets/callisto/callisto-1k.jpg.
// Run from games/the-cosmos:  node tools/bake-callisto.mjs
import { spawnSync } from 'node:child_process';
import { writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'assets/callisto/usgs-global.jpg');
const OUT = join(ROOT, 'assets/callisto/callisto-1k.jpg');
if (!existsSync(SRC)) { console.error('missing the USGS mosaic:', SRC); process.exit(1); }

const OW = 1024, OH = 512;
const probe = spawnSync('ffmpeg', ['-v', 'error', '-i', SRC, '-vf', `scale=${OW}:${OH}:flags=lanczos`, '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], { encoding: 'buffer', maxBuffer: 1 << 24 });
if (probe.status !== 0 || probe.stdout.length !== OW * OH) { console.error('ffmpeg decode failed:', probe.stderr?.toString()); process.exit(1); }
const g = probe.stdout;
console.log(`mosaic decoded: ${OW}x${OH} grey`);

// per-row mean of the mapped pixels (for filling the unmapped black wedges at the poles)
const rowMean = new Array(OH).fill(0);
for (let y = 0; y < OH; y++) { let s = 0, n = 0; for (let x = 0; x < OW; x++) { const v = g[y * OW + x]; if (v > 10) { s += v; n++; } } rowMean[y] = n > OW * 0.3 ? s / n : 40; }

// Callisto's palette: dark plains (geometric albedo 0.22 gives the brown-grey) to bright crater floors
const DARK = [0.30, 0.285, 0.255], BRIGHT = [0.78, 0.755, 0.70], ICE = [0.82, 0.86, 0.90];
const out = Buffer.alloc(OW * OH * 3);
for (let y = 0; y < OH; y++) {
  for (let x = 0; x < OW; x++) {
    let v = g[y * OW + x];
    if (v < 8) v = rowMean[y];                                   // unmapped wedge: the row's own mean
    const t = Math.pow(v / 255, 0.85);
    // slight cool cast on the brightest ground (excavated ice)
    const mix = Math.max(0, (t - 0.72) / 0.28) * 0.5;
    for (let k = 0; k < 3; k++) {
      const base = DARK[k] + (BRIGHT[k] - DARK[k]) * t;
      out[(y * OW + x) * 3 + k] = Math.max(0, Math.min(255, Math.round((base * (1 - mix) + ICE[k] * mix) * 255)));
    }
  }
}
writeFileSync(join(ROOT, 'assets/callisto/callisto-1k.raw'), out);
const enc = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${OW}x${OH}`, '-i', join(ROOT, 'assets/callisto/callisto-1k.raw'), '-q:v', '4', OUT], { encoding: 'utf8' });
if (enc.status !== 0) { console.error(enc.stderr); process.exit(1); }
spawnSync('rm', ['-f', join(ROOT, 'assets/callisto/callisto-1k.raw')]);
console.log('wrote', OUT);
