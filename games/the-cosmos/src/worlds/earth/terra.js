// ============================================================================
// worlds/earth/terra.js - Earth's real heights, read from the small copy of public terrain data baked into earth-data.js (tools/bake-earth.mjs). Pure: no three.js,
// no DOM; the server and every phone inflate the same bytes, so they get the same ground. Top-level await: DecompressionStream is the same in Node and Safari 16.4+.
//
//   heightAt(lat, lon)  metres above (or below) sea level: the global 1/2-degree grid (continents, ranges, the sea floor), with Cape Canaveral's own 200 m window blended
//                       over it so the real coast, the rivers and the shelf are there where the Skyward complex stands
//   landAt(lat, lon)    true above sea level
//   biomeAt(lat, lon)   0 green, 1 desert or bare, 2 snow or ice (from the Blue Marble picture)
// Honest: the global grid is 55 km a cell, so away from the Cape a coast is within a cell or two of the real one and the mountains are smoothed. The ground you walk on
// everywhere gets finer detail from the field's own noise (def.js); only the Cape's coast is measured at that scale.
// ============================================================================
import { META, B64 } from './earth-data.js';

export const DEG = Math.PI / 180;

async function inflate(b64) {
  const bin = atob(b64), u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const stream = new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
function decode(bytes, w, h, unit) {
  const q = new Int32Array(w * h), out = new Float32Array(w * h);
  let p = 0;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    let z = 0, sh = 0, b;
    do { b = bytes[p++]; z += (b & 127) * 2 ** sh; sh += 7; } while (b & 128);
    const d = z % 2 ? -(z + 1) / 2 : z / 2;
    const pred = i > 0 ? q[j * w + i - 1] : j > 0 ? q[(j - 1) * w] : 0;
    q[j * w + i] = pred + d; out[j * w + i] = q[j * w + i] * unit;
  }
  return out;
}
const GRID = await decode(await inflate(B64.global), META.global.w, META.global.h, META.global.unit);
for (let k = 0; k < GRID.length; k++) if (GRID[k] < -200) GRID[k] = -200 + (GRID[k] + 200) * 5;       // the baker stored deep water five times coarser
const CAPE = await decode(await inflate(B64.cape), META.cape.w, META.cape.h, META.cape.unit);
const BIOME = await decode(await inflate(B64.biome), META.biome.w, META.biome.h, META.biome.unit);

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const GW = META.global.w, GH = META.global.h;
function cr(t, o) { const t2 = t * t, t3 = t2 * t; o[0] = -0.5 * t3 + t2 - 0.5 * t; o[1] = 1.5 * t3 - 2.5 * t2 + 1; o[2] = -1.5 * t3 + 2 * t2 + 0.5 * t; o[3] = 0.5 * t3 - 0.5 * t2; }
const _wx = [0, 0, 0, 0], _wy = [0, 0, 0, 0];
/** The global grid at (lat, lon): Catmull-Rom over the 4 x 4 nearest cells, wrapping round the world in longitude. */
function globalAt(lat, lon) {
  const fx = (lon + 180) / 360 * GW - 0.5, fy = (90 - lat) / 180 * GH - 0.5, ix = Math.floor(fx), iy = Math.floor(fy);
  cr(fx - ix, _wx); cr(fy - iy, _wy);
  let s = 0;
  for (let b = 0; b < 4; b++) {
    const j = Math.max(0, Math.min(GH - 1, iy - 1 + b)); let row = 0;
    for (let a = 0; a < 4; a++) row += _wx[a] * GRID[j * GW + (((ix - 1 + a) % GW) + GW) % GW];
    s += _wy[b] * row;
  }
  return s;
}
const C = META.cape, CHALF_LAT = C.h * C.d / 2, CHALF_LON = C.w * C.d / 2;
/** The Cape window at (lat, lon) bilinear, and its weight (1 inside, fading to 0 over the outer tenth). */
function capeAt(lat, lon, out) {
  const fx = (lon - (C.lon - CHALF_LON)) / C.d - 0.5, fy = ((C.lat + CHALF_LAT) - lat) / C.d - 0.5;
  if (fx < 0 || fy < 0 || fx > C.w - 1 || fy > C.h - 1) { out.w = 0; return 0; }
  const i = Math.min(C.w - 2, Math.floor(fx)), j = Math.min(C.h - 2, Math.floor(fy)), tx = fx - i, ty = fy - j;
  const a = CAPE[j * C.w + i], b = CAPE[j * C.w + i + 1], c = CAPE[(j + 1) * C.w + i], d = CAPE[(j + 1) * C.w + i + 1];
  const edge = Math.min(fx, fy, C.w - 1 - fx, C.h - 1 - fy) / (0.1 * C.w);
  out.w = sstep(0, 1, edge);
  return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
}
const _o = { w: 0 };
/** Metres above sea level at a place (degrees). */
export function heightAt(lat, lon) {
  const g = globalAt(lat, lon);
  if (Math.abs(lat - C.lat) > CHALF_LAT || Math.abs(lon - C.lon) > CHALF_LON) return g;
  const c = capeAt(lat, lon, _o);
  return _o.w > 0 ? g + (c - g) * _o.w : g;
}
/** What the land looks like from above (NASA Blue Marble, 1 degree): 0 green, 1 desert or bare, 2 snow or ice. */
export const biomeAt = (lat, lon) => BIOME[Math.max(0, Math.min(META.biome.h - 1, Math.floor((90 - lat) / 180 * META.biome.h))) * META.biome.w + ((Math.floor((lon + 180) / 360 * META.biome.w) % META.biome.w) + META.biome.w) % META.biome.w];
export const landAt = (lat, lon) => heightAt(lat, lon) > 0;
export const CAPE_WINDOW = { lat: C.lat, lon: C.lon, halfLatDeg: CHALF_LAT, halfLonDeg: CHALF_LON };
/** The raw global grid value (no Cape window): for the baked-shape checks. */
export const globalHeightAt = globalAt;
