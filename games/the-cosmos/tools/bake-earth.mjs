// Bakes our own small copy of Earth's real heights into src/worlds/earth/earth-data.js (WD-EARTH).
//   node tools/bake-earth.mjs        (needs network once; downloads are cached in $EARTH_CACHE or the OS temp folder)
// WHAT IS BAKED
//   global   AWS Open Data "Terrain Tiles" (Terrarium PNG, zoom 3: SRTM + GEBCO bathymetry + ETOPO1, public data) averaged to 1/2 degree: the continents, mountain ranges
//            and the sea floor, in metres (+-5 m unit on land and the shelf; below 200 m of water the sea floor is stored five times coarser, 25 m). Poles beyond 85 deg (the tiles stop there) are filled with a plateau of ice (south) and open sea (north).
//   biome    land look from orbit (green / desert / snow) from the Blue Marble picture already in the repo (assets/moon/earth.jpg), 360 x 180
//   cape     the same tiles at zoom 10 (about 130 m a pixel at 28 N) over a 0.8 x 0.8 degree window round Cape Canaveral: the real coast, the Banana and Indian
//            Rivers, Merritt Island, the shelf, at 195 x 222 m (1 m unit).
// ENCODING: heights rounded to a unit, predicted from the left neighbour (the first of a row from the one above), zig-zag, LEB128, raw deflate, base64 (the Moon's bake-lola.mjs
//   scheme; the reader is src/worlds/earth/terra.js and inflates once at import).
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import zlib from 'node:zlib'; import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(HERE, '..', 'src', 'worlds', 'earth', 'earth-data.js');
const CACHE = process.env.EARTH_CACHE || path.join(os.tmpdir(), 'earth-cache'); fs.mkdirSync(CACHE, { recursive: true });
const TILE = (z, x, y) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
const DEG = Math.PI / 180;
export const CAPE = { lat: 28.6082, lon: -80.6040 };          // the middle of the Cape window (LC-39A)

async function tile(z, x, y) {
  const f = path.join(CACHE, `t-${z}-${x}-${y}.png`);
  if (!(fs.existsSync(f) && fs.statSync(f).size > 0)) {
    for (let k = 0; k < 4; k++) { try { const r = await fetch(TILE(z, x, y)); if (r.status !== 200) throw new Error(String(r.status)); fs.writeFileSync(f, Buffer.from(await r.arrayBuffer())); break; } catch (e) { if (k === 3) throw e; } }
  }
  return decodePng(fs.readFileSync(f));
}
/** A minimal PNG reader: 8-bit RGB / RGBA, no interlace (what the terrain tiles are). Returns { w, h, px: Uint8Array RGBA }. */
function decodePng(buf) {
  let p = 8, w = 0, h = 0, ct = 0; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('latin1', p + 4, p + 8), data = buf.subarray(p + 8, p + 8 + len); p += 12 + len;
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ct = data[9]; if (data[8] !== 8 || data[12] !== 0 || (ct !== 2 && ct !== 6)) throw new Error('unsupported png'); }
    else if (type === 'IDAT') idat.push(data); else if (type === 'IEND') break;
  }
  const bpp = ct === 6 ? 4 : 3, raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * bpp, out = new Uint8Array(w * h * 4), prev = new Uint8Array(stride), cur = new Uint8Array(stride);
  let q = 0;
  for (let y = 0; y < h; y++) {
    const ft = raw[q++]; for (let i = 0; i < stride; i++) cur[i] = raw[q++];
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      let v = cur[i];
      if (ft === 1) v += a; else if (ft === 2) v += b; else if (ft === 3) v += (a + b) >> 1;
      else if (ft === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); v += (pa <= pb && pa <= pc) ? a : pb <= pc ? b : c; }
      cur[i] = v & 255;
    }
    for (let x = 0; x < w; x++) { out[(y * w + x) * 4] = cur[x * bpp]; out[(y * w + x) * 4 + 1] = cur[x * bpp + 1]; out[(y * w + x) * 4 + 2] = cur[x * bpp + 2]; out[(y * w + x) * 4 + 3] = 255; }
    prev.set(cur);
  }
  return { w, h, px: out };
}
function encode(grid, w, h, unit) {
  const bytes = []; const q = new Int32Array(w * h);
  for (let k = 0; k < w * h; k++) q[k] = Math.round(grid[k] / unit);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const pred = i > 0 ? q[j * w + i - 1] : j > 0 ? q[(j - 1) * w] : 0;
    let z = q[j * w + i] - pred; z = z >= 0 ? z * 2 : -z * 2 - 1;
    while (z >= 128) { bytes.push((z & 127) | 128); z >>= 7; } bytes.push(z);
  }
  return zlib.deflateRawSync(Buffer.from(bytes), { level: 9 }).toString('base64');
}
// web mercator: world pixel (at zoom z, 256 px tiles) <-> lat/lon
const wpx = (lon, z) => (lon + 180) / 360 * 256 * 2 ** z;
const wpy = (lat, z) => (1 - Math.log(Math.tan(lat * DEG) + 1 / Math.cos(lat * DEG)) / Math.PI) / 2 * 256 * 2 ** z;
const terr = (px, o) => (px[o] * 256 + px[o + 1] + px[o + 2] / 256) - 32768;

/** A mosaic of the tiles covering [tx0..tx1] x [ty0..ty1] at zoom z: { W, H, h: Float32Array of metres, x0, y0 } (x0, y0 the world pixel of its top-left). */
async function mosaic(z, tx0, tx1, ty0, ty1) {
  const W = (tx1 - tx0 + 1) * 256, H = (ty1 - ty0 + 1) * 256, g = new Float32Array(W * H);
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const t = await tile(z, ((tx % 2 ** z) + 2 ** z) % 2 ** z, ty);
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) g[((ty - ty0) * 256 + y) * W + (tx - tx0) * 256 + x] = terr(t.px, (y * 256 + x) * 4);
  }
  return { W, H, g, x0: tx0 * 256, y0: ty0 * 256 };
}
const bil = (m, px, py) => {          // bilinear in world pixels
  const x = px - m.x0 - 0.5, y = py - m.y0 - 0.5, i = Math.max(0, Math.min(m.W - 2, Math.floor(x))), j = Math.max(0, Math.min(m.H - 2, Math.floor(y))), fx = Math.min(1, Math.max(0, x - i)), fy = Math.min(1, Math.max(0, y - j));
  const a = m.g[j * m.W + i], b = m.g[j * m.W + i + 1], c = m.g[(j + 1) * m.W + i], d = m.g[(j + 1) * m.W + i + 1];
  return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
};

console.log('global (zoom 3)');
const GW = 720, GH = 360;
const Gm = await mosaic(3, 0, 7, 0, 7);
const glob = new Float32Array(GW * GH);
for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
  const lat = 90 - (j + 0.5) * 180 / GH, lon = -180 + (i + 0.5) * 360 / GW;
  if (lat > 84.9) { glob[j * GW + i] = -2500; continue; }
  if (lat < -84.9) { glob[j * GW + i] = 2600; continue; }
  let s = 0; for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) { const la = lat + ((a + 0.5) / 4 - 0.5) * 180 / GH, lo = lon + ((b + 0.5) / 4 - 0.5) * 360 / GW; s += bil(Gm, wpx(lo, 3), wpy(Math.max(-84.9, Math.min(84.9, la)), 3)); }
  glob[j * GW + i] = s / 16;
}
// the polar rows blend into the poles' fill so there is no step at 85 degrees
console.log('  land share', (glob.reduce((a, v) => a + (v > 0 ? 1 : 0), 0) / glob.length).toFixed(3), ' max', glob.reduce((a, v) => Math.max(a, v), -1e9).toFixed(0), ' min', glob.reduce((a, v) => Math.min(a, v), 1e9).toFixed(0));

console.log('cape (zoom 10)');
const CW = 400, CH = 400, CD = 0.002;
const z = 10, cx = CAPE.lon, cy = CAPE.lat;
const px0 = wpx(cx - CW * CD / 2, z), px1 = wpx(cx + CW * CD / 2, z), py0 = wpy(cy + CH * CD / 2, z), py1 = wpy(cy - CH * CD / 2, z);
const Cm = await mosaic(z, Math.floor(px0 / 256) - 0, Math.floor(px1 / 256), Math.floor(py0 / 256), Math.floor(py1 / 256));
const cape = new Float32Array(CW * CH);
for (let j = 0; j < CH; j++) for (let i = 0; i < CW; i++) {
  const lat = cy + CH * CD / 2 - (j + 0.5) * CD, lon = cx - CW * CD / 2 + (i + 0.5) * CD;
  let s = 0; for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) s += bil(Cm, wpx(lon + ((b + 0.5) / 2 - 0.5) * CD, z), wpy(lat + ((a + 0.5) / 2 - 0.5) * CD, z));
  cape[j * CW + i] = s / 4;
}
console.log('  land share', (cape.reduce((a, v) => a + (v > 0 ? 1 : 0), 0) / cape.length).toFixed(3), ' max', cape.reduce((a, v) => Math.max(a, v), -1e9).toFixed(0), ' min', cape.reduce((a, v) => Math.min(a, v), 1e9).toFixed(0));


// biome: what the land looks like from above, from NASA Blue Marble (assets/moon/earth.jpg, already in the repo) reduced to 360 x 180: 0 green (forest, field, scrub), 1 desert or bare, 2 snow or ice
console.log('biome (Blue Marble, from the repo)');
const BW = 360, BH = 180;
const ff = spawnSync('ffmpeg', ['-v', 'error', '-i', path.join(HERE, '..', 'assets', 'moon', 'earth.jpg'), '-vf', `scale=${BW}:${BH}:flags=area`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 26 });
if (ff.status !== 0 || ff.stdout.length !== BW * BH * 3) throw new Error('ffmpeg: ' + ff.stderr);
const biome = new Float32Array(BW * BH); const cnt = [0, 0, 0];
for (let k = 0; k < biome.length; k++) {
  const r = ff.stdout[k * 3], g = ff.stdout[k * 3 + 1], b = ff.stdout[k * 3 + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  biome[k] = (mn > 165 && mx - mn < 45) ? 2 : (r > g * 1.1 && r > b * 1.45 && r > 105) ? 1 : 0; cnt[biome[k]]++;
}
console.log('  green / desert / snow pixels', cnt.join(' / '));

const meta = {
  global: { w: GW, h: GH, unit: 5 }, cape: { w: CW, h: CH, unit: 1, lat: cy, lon: cx, d: CD }, biome: { w: BW, h: BH, unit: 1 },
};
const body = `// GENERATED by tools/bake-earth.mjs: do not edit. Earth's heights (AWS Terrain Tiles: SRTM, GEBCO, ETOPO1), Cape Canaveral's coast, . See credits.json.
export const META = ${JSON.stringify(meta)};
export const B64 = {
  global: '${encode(glob.map((v) => (v >= -200 ? v : -200 + (v + 200) / 5)), GW, GH, 5)}',
  cape: '${encode(cape, CW, CH, 1)}',
  biome: '${encode(biome, BW, BH, 1)}',
};
`;
fs.writeFileSync(OUT, body); console.log('wrote', OUT, (body.length / 1024).toFixed(0), 'KB');
