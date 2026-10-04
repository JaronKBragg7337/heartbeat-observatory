// ============================================================================
// worlds/moon/lola.js - the Moon's real heights and brightness, read from the small copy of NASA's LOLA / LROC data baked into lola-data.js
// (tools/bake-lola.mjs). Pure: no three.js, no DOM; the server and every phone decode the same bytes, so they get the same ground.
//
// WHAT IT ANSWERS (lat/lon in degrees, selenographic: lon 0 faces Earth, east positive)
//   heightAt(lat, lon)   metres above the 1,737.4 km reference sphere: the global grid (1 pixel per degree), with each settlement's own
//                        window (Tranquility 237 m, Daedalus 474 m, Shackleton 160 m) blended over it so the seam never shows
//   albedoAt(lat, lon)   0..1 brightness (LROC): the dark maria and the bright rays
//   illumAt(lat, lon)    the share of the year the Sun is above the horizon (Shackleton window only; null elsewhere); 0 = permanent shadow
//   inShadow(lat, lon)   permanently shadowed ground: where the ice is
// The data is inflated once, at import (top-level await: the DecompressionStream is the same in Node and in Safari 16.4+).
// ============================================================================
import { META, B64 } from './lola-data.js';

const DEG = Math.PI / 180;
const RM = 1_737_400;

async function inflate(b64) {
  const bin = atob(b64), u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const stream = new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
/** Undo the baker's encoding: LEB128 zig-zag deltas from the left neighbour (the first of a row from the one above). */
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
const dec = async (key, spec) => decode(await inflate(B64[key]), spec.w, spec.h, spec.unit);

const GLOBAL = await dec('global', META.global);
const ALBEDO = await dec('albedo', META.albedo);
const TILES = {};
for (const [id, t] of Object.entries(META.tiles)) TILES[id] = { ...t, g: await dec(id, t) };
const ILLUM = await dec('illum', META.illum);
const ILLUM_SCALE = META.illum.scale || 1;

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** Catmull-Rom weights for four taps at fractional position t. */
function cr(t, o) { const t2 = t * t, t3 = t2 * t; o[0] = -0.5 * t3 + t2 - 0.5 * t; o[1] = 1.5 * t3 - 2.5 * t2 + 1; o[2] = -1.5 * t3 + 2 * t2 + 0.5 * t; o[3] = 0.5 * t3 - 0.5 * t2; }
const _wx = [0, 0, 0, 0], _wy = [0, 0, 0, 0];

/** Bicubic sample of a grid at fractional pixel (fx, fy); `at(i, j)` fetches a clamped or wrapped pixel. */
function bicubic(at, fx, fy) {
  const i0 = Math.floor(fx), j0 = Math.floor(fy);
  cr(fx - i0, _wx); cr(fy - j0, _wy);
  let s = 0;
  for (let j = 0; j < 4; j++) { let r = 0; for (let i = 0; i < 4; i++) r += _wx[i] * at(i0 - 1 + i, j0 - 1 + j); s += _wy[j] * r; }
  return s;
}
function bilinear(at, fx, fy) {
  const i0 = Math.floor(fx), j0 = Math.floor(fy), tx = fx - i0, ty = fy - j0;
  return (at(i0, j0) * (1 - tx) + at(i0 + 1, j0) * tx) * (1 - ty) + (at(i0, j0 + 1) * (1 - tx) + at(i0 + 1, j0 + 1) * tx) * ty;
}

// ---- the global grid: pixel registered, lon 0..360 east, lat 90 N down ----------------------------------------------------
const GW = META.global.w, GH = META.global.h;
const gAt = (i, j) => { j = j < 0 ? -1 - j : j >= GH ? 2 * GH - 1 - j : j; i = ((i % GW) + GW) % GW; return GLOBAL[j * GW + i]; };   // over a pole it folds back (the pole's own row repeats)
export function globalHeight(lat, lon) {
  const L = ((lon % 360) + 360) % 360;
  return bicubic(gAt, L - 0.5, 90 - lat - 0.5);
}

// ---- the albedo: lon -180..180 ------------------------------------------------------------------------------------------------
const AW = META.albedo.w, AH = META.albedo.h;
const aAt = (i, j) => { j = j < 0 ? 0 : j >= AH ? AH - 1 : j; i = ((i % AW) + AW) % AW; return ALBEDO[j * AW + i]; };
export function albedoAt(lat, lon) {
  const L = ((lon + 180) % 360 + 360) % 360;
  return bilinear(aAt, L * AW / 360 - 0.5, (90 - lat) * AH / 180 - 0.5) / 255;
}

// ---- the three windows --------------------------------------------------------------------------------------------------------
/** Fractional pixel of (lat, lon) in a tile, or null when the point is not within the tile's reach. */
function tilePixel(t, lat, lon) {
  if (t.kind === 'cyl') {
    let L = ((lon % 360) + 360) % 360; const c0 = t.c0 / t.ppd; if (L < c0 - 180) L += 360; else if (L > c0 + 180) L -= 360;
    return [L * t.ppd - 0.5 - t.c0, (90 - lat) * t.ppd - 0.5 - t.r0];
  }
  if (lat > -85) return null;
  const rho = 2 * RM * Math.tan((90 + lat) * DEG / 2), lm = lon * DEG;
  const s = t.centre + rho * Math.sin(lm) / t.mPerPx, l = t.centre - rho * Math.cos(lm) / t.mPerPx;
  return [(s - t.s0) / t.step, (l - t.l0) / t.step];
}
/** 1 inside, falling to 0 at the tile's edge (over the outer tenth), so the window melts into the global grid. */
function tileWeight(t, fx, fy) {
  const e = Math.min(fx, fy, t.w - 1 - fx, t.h - 1 - fy), m = 0.12 * Math.min(t.w, t.h);
  return e <= 1.5 ? 0 : sstep(1.5, m, e);
}
const tileAt = (t) => (i, j) => t.g[(j < 0 ? 0 : j >= t.h ? t.h - 1 : j) * t.w + (i < 0 ? 0 : i >= t.w ? t.w - 1 : i)];
for (const t of Object.values(TILES)) t.at = tileAt(t);

/** Height in metres above the reference sphere: the global grid, with each window blended over it. */
export function heightAt(lat, lon) {
  const g = globalHeight(lat, lon);
  let h = g;
  for (const t of Object.values(TILES)) {
    const p = tilePixel(t, lat, lon); if (!p) continue;
    const w = tileWeight(t, p[0], p[1]); if (w <= 0) continue;
    h += w * (bicubic(t.at, p[0], p[1]) - g);
  }
  return h;
}
/** Which window a point is in (for the ground's other layers), or null. */
export function windowAt(lat, lon) {
  for (const [id, t] of Object.entries(TILES)) { const p = tilePixel(t, lat, lon); if (p && tileWeight(t, p[0], p[1]) > 0) return id; }
  return null;
}

// ---- Shackleton's year of sunlight ------------------------------------------------------------------------------------------------
const POLE = TILES.shackleton, IW = META.illum.w, IH = META.illum.h;
const iAt = (i, j) => ILLUM[(j < 0 ? 0 : j >= IH ? IH - 1 : j) * IW + (i < 0 ? 0 : i >= IW ? IW - 1 : i)];
/** The share of the year the Sun is above the horizon at a point inside the Shackleton window (0..1), or null outside it. */
export function illumAt(lat, lon) {
  const p = tilePixel(POLE, lat, lon); if (!p || p[0] < 0 || p[1] < 0 || p[0] > IW - 1 || p[1] > IH - 1) return null;
  return Math.max(0, Math.min(1, bilinear(iAt, p[0], p[1]) / ILLUM_SCALE));
}
/** Permanently shadowed ground (the Sun never clears the horizon there in a year), inside the Shackleton window. */
export const inShadow = (lat, lon) => { const v = illumAt(lat, lon); return v !== null && v < 0.5 / ILLUM_SCALE; };

export const DATA = { META, TILES, GLOBAL, ALBEDO, ILLUM };
