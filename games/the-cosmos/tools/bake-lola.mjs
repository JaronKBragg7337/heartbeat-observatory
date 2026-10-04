// Bakes our own small copy of NASA's LRO LOLA lunar data into src/worlds/moon/lola-data.js (WD-MOON).
//   node tools/bake-lola.mjs            (needs network once; downloads are cached in $LOLA_CACHE or the OS temp folder; ffmpeg decodes the albedo jpg)
// WHAT IS BAKED (all public domain, NASA/GSFC; credit in credits.json):
//   global   LDEM_16 (1895 m/px) pooled to 1 pixel per degree: the Moon's whole shape, +-1 km class (maria, highlands, the South Pole-Aitken basin)
//   albedo   LROC WAC mosaic (NASA/GSFC/ASU, SVS 4720) as 360 x 180 grey: where the dark maria and the bright rays are
//   tiles    three 48 km windows round the settlements: Tranquility (LDEM_128, 237 m), Daedalus (LDEM_128), Shackleton (LDEM_80S_80M, 160 m)
//   illum    for the Shackleton window: the share of the year the Sun is above the horizon, worked out HERE from the heights by horizon
//            tracing (Sun elevation +-1.54 deg over the year, disc 0.27 deg radius): 0 = permanent shadow (where the ice is), 0.95 = the crest
// ENCODING: heights in metres rounded to a unit, predicted from the left neighbour (the first of a row from the one above), zig-zag, LEB128,
//   then raw deflate, then base64. The reader (lola.js) inflates once at import.
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import zlib from 'node:zlib'; import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(HERE, '..', 'src', 'worlds', 'moon', 'lola-data.js');
const CACHE = process.env.LOLA_CACHE || path.join(os.tmpdir(), 'lola-cache'); fs.mkdirSync(CACHE, { recursive: true });
const PDS = 'https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr';
const RM = 1737400, DEG = Math.PI / 180;

async function get(url, name, range) {
  const f = path.join(CACHE, name);
  if (fs.existsSync(f) && fs.statSync(f).size > 0) return fs.readFileSync(f);
  console.log('  fetching', name, range || '');
  const r = await fetch(url, range ? { headers: { Range: `bytes=${range[0]}-${range[1]}` } } : {});
  if (!(r.status === 200 || r.status === 206)) throw new Error(`${url}: ${r.status}`);
  const b = Buffer.from(await r.arrayBuffer()); fs.writeFileSync(f, b); return b;
}
const i16 = (b) => new Int16Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.length));

function encode(grid, w, h, unit) {          // grid Float32Array of metres -> deflated base64
  const bytes = []; const q = new Int32Array(w * h);
  for (let k = 0; k < w * h; k++) q[k] = Math.round(grid[k] / unit);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const pred = i > 0 ? q[j * w + i - 1] : j > 0 ? q[(j - 1) * w] : 0;
    let z = q[j * w + i] - pred; z = z >= 0 ? z * 2 : -z * 2 - 1;
    while (z >= 128) { bytes.push((z & 127) | 128); z >>= 7; } bytes.push(z);
  }
  return zlib.deflateRawSync(Buffer.from(bytes), { level: 9 }).toString('base64');
}

// ---- global heights and albedo -------------------------------------------------------------------------------------------
console.log('global');
const ld16 = i16(await get(`${PDS}/cylindrical/img/ldem_16.img`, 'ldem16.img'));
const GW = 360, GH = 180, F = 16, glob = new Float32Array(GW * GH);
for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { let s = 0; for (let j = 0; j < F; j++) for (let i = 0; i < F; i++) s += ld16[(y * F + j) * 5760 + x * F + i]; glob[y * GW + x] = s / (F * F) * 0.5; }
// stored with lon from 0 east (like the source), lat from 90 N down; pixel registered
const jpg = await get('https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_1k.jpg', 'lroc1k.jpg');
fs.writeFileSync(path.join(CACHE, 'lroc1k.in.jpg'), jpg);
const AW = 360, AH = 180;
const ff = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(CACHE, 'lroc1k.in.jpg'), '-vf', `scale=${AW}:${AH}:flags=area,format=gray`, '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], { maxBuffer: 1 << 24 });
if (ff.status !== 0) throw new Error('ffmpeg: ' + ff.stderr);
const alb = new Float32Array(AW * AH); for (let k = 0; k < AW * AH; k++) alb[k] = ff.stdout[k];   // lon from -180 (left) to 180, lat from 90 down

// ---- equatorial tiles from LDEM_128 -------------------------------------------------------------------------------------------
async function cylTile(id, lat, lon, halfKm, PPD) {
  const COLS = 360 * PPD, ROWB = COLS * 2;
  const dLat = halfKm * 1000 / RM / DEG, dLon = dLat / Math.cos(lat * DEG);
  const r0 = Math.floor((90 - (lat + dLat)) * PPD), r1 = Math.ceil((90 - (lat - dLat)) * PPD);
  const c0 = Math.floor((lon - dLon) * PPD), c1 = Math.ceil((lon + dLon) * PPD);
  const buf = await get(`${PDS}/cylindrical/img/ldem_${PPD}.img`, `ldem${PPD}-${id}.bin`, [r0 * ROWB, (r1 + 1) * ROWB - 1]);
  const all = i16(buf), w = c1 - c0 + 1, h = r1 - r0 + 1, g = new Float32Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) g[j * w + i] = all[j * COLS + c0 + i] * 0.5;
  return { id, kind: 'cyl', ppd: PPD, c0, r0, w, h, grid: g, lat, lon };
}
console.log('tiles');
const tranq = await cylTile('tranquility', 0.7, 23.5, 24, 128);
const daed = await cylTile('daedalus', -5.9, 179.4, 60, 64);

// ---- the polar tile from LDEM_80S_80M -----------------------------------------------------------------------------------------
const N = 7600, R0 = 3000, ROWS = 1600;
const pbuf = i16(await get(`${PDS}/polar/img/ldem_80s_80m.img`, 'pole-rows.bin', [R0 * N * 2, (R0 + ROWS) * N * 2 - 1]));
const PH = (l, s) => pbuf[(l - R0) * N + s] * 0.5;
const CS = 3900, CL = 3880, EV = 300, STEP = 2, TW = (2 * EV) / STEP + 1;   // centre on Shackleton (about 10 km from the pole); 301 x 301 at 160 m
const pole = new Float32Array(TW * TW);
for (let j = 0; j < TW; j++) for (let i = 0; i < TW; i++) { const s = CS - EV + i * STEP, l = CL - EV + j * STEP; pole[j * TW + i] = (PH(l, s) + PH(l, s + 1) + PH(l + 1, s) + PH(l + 1, s + 1)) / 4; }
console.log('illumination (horizon tracing)');
const NAZ = 48, dirs = Array.from({ length: NAZ }, (_, i) => [Math.cos(2 * Math.PI * i / NAZ), Math.sin(2 * Math.PI * i / NAZ)]);
const illum = new Float32Array(TW * TW);
for (let j = 0; j < TW; j++) for (let i = 0; i < TW; i++) {
  const s0 = CS - EV + i * STEP, l0 = CL - EV + j * STEP, h0 = PH(l0, s0) + 1.7; let acc = 0;
  for (const [dx, dy] of dirs) {
    let best = -90, d = 0, st = 80;
    for (let k = 0; k < 400; k++) {
      d += st; if (k > 20) st = Math.min(640, st * 1.04);
      const s = Math.round(s0 + dx * d / 80), l = Math.round(l0 + dy * d / 80);
      if (s < 3000 || s > 4800 || l < R0 + 1 || l > R0 + ROWS - 10) break;
      const e = Math.atan2(PH(l, s) - h0 - d * d / (2 * RM), d); if (e > best) best = e;
    }
    acc += Math.acos(Math.max(-1, Math.min(1, (best / DEG - 0.266) / 1.5424))) / Math.PI;
  }
  illum[j * TW + i] = acc / NAZ;
}

// ---- write -------------------------------------------------------------------------------------------------------------------
const q8 = new Float32Array(illum.length); for (let k = 0; k < q8.length; k++) q8[k] = Math.round(illum[k] * 32);
const meta = {
  source: 'NASA LRO LOLA GDR (LDEM_16, LDEM_128, LDEM_80S_80M), NASA/GSFC; LROC WAC mosaic, NASA/GSFC/ASU (SVS 4720). Public domain. Baked by tools/bake-lola.mjs.',
  global: { w: GW, h: GH, unit: 32, note: 'LDEM_16 pooled to 1 pixel/degree, heights in 32 m units, lon 0..360 east, lat 90 N down' },
  albedo: { w: AW, h: AH, unit: 1, note: 'grey 0..255, lon -180..180, lat 90 N down' },
  tiles: {
    tranquility: { kind: 'cyl', ppd: 128, c0: tranq.c0, r0: tranq.r0, w: tranq.w, h: tranq.h, unit: 4 },
    daedalus: { kind: 'cyl', ppd: 64, c0: daed.c0, r0: daed.r0, w: daed.w, h: daed.h, unit: 4 },
    shackleton: { kind: 'polar', mPerPx: 80, centre: 3799.5, s0: CS - EV, l0: CL - EV, step: STEP, w: TW, h: TW, unit: 4 },
  },
  illum: { w: TW, h: TW, unit: 1, scale: 32, note: 'Shackleton window: lit share of the year x32' },
};
const B = {
  global: encode(glob, GW, GH, 32), albedo: encode(alb, AW, AH, 1),
  tranquility: encode(tranq.grid, tranq.w, tranq.h, 4), daedalus: encode(daed.grid, daed.w, daed.h, 4),
  shackleton: encode(pole, TW, TW, 4), illum: encode(q8, TW, TW, 1),
};
for (const [k, v] of Object.entries(B)) console.log(' ', k.padEnd(12), (v.length / 1024).toFixed(1), 'KB base64');
const js = `// GENERATED by tools/bake-lola.mjs - do not edit. NASA LRO LOLA / LROC data, public domain (see credits.json).\nexport const META = ${JSON.stringify(meta)};\nexport const B64 = {\n${Object.entries(B).map(([k, v]) => `  ${k}: '${v}',`).join('\n')}\n};\n`;
fs.writeFileSync(OUT, js); console.log('wrote', OUT, (js.length / 1024).toFixed(0), 'KB');
