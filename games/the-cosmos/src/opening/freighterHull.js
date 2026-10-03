// The crashed freighter's pressure hull: one bent, torn shell with exposed frames. Cabin-local metres:
// x across (the +x side is the high side of the roll), y up from the cabin floor, z along (stern -z, door end +z).
import * as THREE from 'three';
import { Kit3, sheet, obox, beam, rng, fbm, noise, sstep, lerp, clamp } from './wreckKit.js';

const HALF = [[0, -.52], [1.9, -.52], [2.75, -.46], [3.25, -.2], [3.42, .25], [3.42, 2.55], [3.3, 3.05], [2.85, 3.4], [2.1, 3.57], [0, 3.62]];
function makeProfile(half) {
  const cum = [0], nrm = [];
  const segN = [];
  for (let i = 1; i < half.length; i++) { const dx = half[i][0] - half[i - 1][0], dy = half[i][1] - half[i - 1][1], l = Math.hypot(dx, dy);
    cum.push(cum[i - 1] + l); segN.push([dy / l, -dx / l]); }
  for (let i = 0; i < half.length; i++) { const a = segN[Math.max(0, i - 1)], b = segN[Math.min(segN.length - 1, i)];
    const x = a[0] + b[0], y = a[1] + b[1], l = Math.hypot(x, y) || 1; nrm.push([x / l, y / l]); }
  const S = cum[cum.length - 1];
  const at = (s) => {
    const sg = s < 0 ? -1 : 1; let a = Math.min(S, Math.abs(s)), i = 1; while (i < cum.length - 1 && cum[i] < a) i++;
    const t = (a - cum[i - 1]) / (cum[i] - cum[i - 1]), p0 = half[i - 1], p1 = half[i], n0 = nrm[i - 1], n1 = nrm[i];
    let nx = lerp(n0[0], n1[0], t), ny = lerp(n0[1], n1[1], t); const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
    return { x: sg * lerp(p0[0], p1[0], t), y: lerp(p0[1], p1[1], t), nx: sg * nx, ny };
  };
  return { S, at, cum, half, sAtY: (y, wallX = 3.4) => { for (let i = 1; i < half.length; i++) if (half[i][0] > wallX && half[i - 1][0] > wallX) {
    const y0 = half[i - 1][1], y1 = half[i][1]; if (y >= Math.min(y0, y1) && y <= Math.max(y0, y1)) return cum[i - 1] + Math.abs(y - y0); } return 0; } };
}
export const SKIN = makeProfile(HALF);
export const S = SKIN.S, SW0 = SKIN.sAtY(.95), SW1 = SKIN.sAtY(2.5);
export const WIN_Z = [-10, -7.4, -4.8, -2.2, .4, 3, 5.6];       // window centres, one per seat row
export const WIN_HALF = 1.15;
// Damage: z, s (signed arc, + is the high +x side), radii, in metres. Shared so skin, lining and frames agree on where it is open.
export const TEARS = [
  { z: -6.6, s: -(S - 1.8), rz: 2.7, rs: 1.85 },     // roof torn open, aft, low side
  { z: 3.4, s: SKIN.sAtY(.55), rz: 3.4, rs: .34 },    // long slit low on the high wall
  { z: -2.4, s: S - .9, rz: 1.15, rs: .85 },          // small roof hole, high side
  { z: 8.8, s: -(S - .5), rz: 1.1, rs: 1.0 },         // roof punched at the door end
  { z: 9.2, s: -SKIN.sAtY(.45), rz: 1.9, rs: .45 },    // low wall split
];
export const DAMAGE = { on: true };      // off while the undamaged (pre-crash) cabin is built
const hole = (z, s) => { if (!DAMAGE.on) return 9; let f = 9; for (const h of TEARS) { const dz = (z - h.z) / h.rz, ds = (s - h.s) / h.rs;
  const r = Math.hypot(dz, ds) + (fbm(z * 1.7 + 4, s * 1.7) - .5) * .5; f = Math.min(f, (r - 1) * Math.min(h.rz, h.rs) * 1.1); } return f; };
// The stern petals: slits every so often, each petal ends at its own length and curls its own way.
const SLITS = [-9.1, -7.2, -5.1, -3.0, -1.2, .5, 2.3, 4.2, 6.1, 8.0, 9.4].map((x, i) => x + Math.sin(i * 2.7) * .35);
const sternEdge = (s) => -12.15 - 4.3 * Math.pow(fbm(s * .62 + 8, 2.3), 1.7) * 1.1;
const slitField = (z, s) => { if (z > -12.4) return 9; let f = 9; for (const x of SLITS) f = Math.min(f, Math.abs(s - x) - .05 - .04 * (-12.4 - z) * .3); return f; };
const petal = (s) => { let i = 0; while (i < SLITS.length && s > SLITS[i]) i++; const h = noise(i * 3.1, 7.7, 2); return (h - .38) * 1.45; };
const frontEdge = (s) => 14.25 + 1.15 * fbm(s * .7 + 2, 5.1);
export const skinField = (z, s) => Math.min(z - sternEdge(s), frontEdge(s) - z, hole(z, s), slitField(z, s));
export const liningField = (z, s) => Math.min(hole(z * .96 + .25, s) + .15, 9);
const DENTS = [
  { z: 6, s: -3.2, rz: 2.2, rs: 1.1, a: -.3 }, { z: -2, s: -2.6, rz: 3, rs: 1.3, a: -.22 }, { z: 11, s: -3.6, rz: 1.6, rs: .9, a: -.2 },
  { z: -5.5, s: 0, rz: 3, rs: 1.5, a: -.2 }, { z: 2, s: 1.1, rz: 2, rs: 1, a: -.13 }, { z: 8.8, s: 2.6, rz: 1.9, rs: 1.2, a: -.16 },
  { z: 3.6, s: -8.3, rz: 2.3, rs: 1.5, a: -.2 }, { z: -9.4, s: 7.9, rz: 2.4, rs: 1.4, a: -.26 }, { z: 6.4, s: 8.6, rz: 1.8, rs: 1.2, a: -.15 },
  { z: -8, s: -3.7, rz: 1.8, rs: 1.4, a: .1 }, { z: 1, s: 7.4, rz: 2.4, rs: 1, a: .08 },
];
const inBand = (s) => { const a = Math.abs(s); return 1 - sstep(0, .5, Math.max(SW0 - a, a - SW1, 0)) ; };    // 1 inside the window band
export function skinDisp(z, s) {
  if (!DAMAGE.on) return 0;
  let d = 0; for (const t of DENTS) d += t.a * Math.exp(-(((z - t.z) / t.rz) ** 2 + ((s - t.s) / t.rs) ** 2));
  d *= 1 - .85 * inBand(s);
  const crush = sstep(-5.5, -10.5, z);                                                        // accordion buckling toward the stern
  d += crush * (.09 + .05 * noise(s, 3)) * Math.sin(z * 5.8 + noise(s * .8, z * .3) * 4) * (1 - .6 * inBand(s));
  d += (fbm(z * .9, s * .9, 9) - .5) * .09;                                                   // oil-canning
  if (z < -12) { const t = -12 - z; d += clamp(petal(s) * Math.pow(t, 1.35), -.8, 1.0); }
  if (z > 13.2) d += .06 * (z - 13.2);
  return d;
}
const bendY = (z) => -.11 * Math.exp(-(((z + 3) / 7) ** 2)) + .04 * Math.sin(z * .4);
export const WRECK_Y = .42;                                       // how high the cabin origin sits above the dirt (the belly is plowed in)
export const groundY = (x, z) => -WRECK_Y - .105 * x + .015 * z;     // the dirt plane in cabin-local metres (roll .105, pitch .015)
export function skinP(z, s, inset = 0) {
  const pr = SKIN.at(s), d = skinDisp(z, s) - inset;
  let x = pr.x + pr.nx * d, y = pr.y + pr.ny * d + bendY(z);
  if (z < -11.5) y = Math.max(y, groundY(x, z) + .05 + .02 * noise(x, z));                       // peeled plating rests on the ground
  return [x, y, z];
}
const OUT = (p) => [p[0], p[1] - 1.5, 0];

export function buildSkin(k, low, rnd) {
  const cell = low ? .8 : .42, th = .035;
  const hullTint = (p, f, a, b, o) => {
    const g = .88 + .3 * fbm(a * .6, b * .6, 3), dust = clamp(sstep(1.0, -.5, p[1]) * .5 + .12 * fbm(a * .4, b * .4, 11), 0, .6);
    let r = lerp(g, .8, dust), gg = lerp(g, .5, dust), bb = lerp(g, .4, dust);
    if (o && o.lower) { const t = Math.abs(b); if (t > 3.1) { r *= .66; gg *= .72; bb *= .84; } else if (t > 2.6) { r *= .55; gg *= .55; bb *= .56; } else { r *= .5; gg *= .5; bb *= .52; } if (t > 3.1 && t < 3.3) { r *= 1.3; gg *= .8; bb *= .35; } }
    if (o && o.stripe) { const t = b - SW1; if (t > .12 && t < .62) { r *= .25; gg *= .62; bb *= .8; } else if (t >= .62 && t < .72) { r *= 1.1; gg *= .7; bb *= .25; } }
    const soot = (1 - sstep(0, 1.5, f)) * (.35 + .65 * sstep(.35, .7, fbm(a * 1.3, b * 1.3, 21)));
    const burn = 1 - soot * .88; return [r * burn, gg * burn, bb * burn];
  };
  const common = { cell, field: skinField, faceTo: OUT, col: (p, f, a, b) => hullTint(p, f, a, b, null), thick: th, inner: { key: 'steelDark', tint: [.55, .5, .46] }, lip: { key: 'steel', tint: [1.1, .95, .8] },
    uv: (a, b) => [a / 8, b / 8], nearM: 1.4 };
  const z0 = -17.4, z1 = 15.6, P = (z, s) => skinP(z, s);
  // hull and belly, wrapping both lower walls
  sheet(k, 'hull', { ...common, P, a0: z0, a1: z1, b0: -SW0, b1: SW0, cellB: cell, col: (p, f, a, b) => hullTint(p, f, a, b, { lower: true }) });
  // roof halves, wall tops
  for (const sg of [-1, 1]) {
    const f = (a, b) => b, P2 = (z, t) => skinP(z, sg * t);
    sheet(k, 'hull', { ...common, P: P2, field: (z, t) => skinField(z, sg * t), a0: z0, a1: z1, b0: SW1, b1: S, cellB: cell, col: (p, f, a, b) => hullTint(p, f, a, b, { stripe: true }) });
  }
  // the window band: solid between windows and past the last ones; the windows themselves are holes
  const segs = []; let zc = z0;
  for (const wz of WIN_Z) { segs.push([zc, wz - WIN_HALF]); zc = wz + WIN_HALF; } segs.push([zc, z1]);
  for (const sg of [-1, 1]) for (const [za, zb] of segs) if (zb - za > .05)
    sheet(k, 'hull', { ...common, P: (z, t) => skinP(z, sg * t), field: (z, t) => skinField(z, sg * t), a0: za, a1: zb, b0: SW0, b1: SW1, cell: Math.min(cell, (zb - za) / 1 || cell), cellB: .55 });
}

// Frames and stringers, visible only where the plating is gone (or about to be).
export function buildFrames(k, low, rnd) {
  const step = low ? 1.15 : .72, zs = []; for (let z = -11; z < 12.6; z += 2.6) zs.push(z); zs.push(-13.6, -16.2);
  const metal = [1.5, 1.6, 1.75];
  for (const z0 of zs) {
    const stern = z0 < -12;
    let prev = null;
    for (let s = -S; s <= S + 1e-6; s += step) {
      const p = skinP(z0 + (stern ? (noise(s, z0) - .5) * .5 : 0), s, .13), f = Math.min(skinField(z0, s), liningField(z0, s) + .6);
      const cur = { p, f, s };
      if (prev) {
        const fm = Math.min(prev.f, cur.f);
        let keep = fm < 1.6; if (stern && fm > .35) keep = keep && noise(s * 1.7, z0, 4) > .15 * (-12.4 - z0);
        if (stern && (skinField(z0, prev.s) < .05 || skinField(z0, cur.s) < .05)) keep = false;
        if (keep) {
          const tn = skinP(z0, (prev.s + cur.s) / 2, 0); const mn = [(prev.p[0] + cur.p[0]) / 2, (prev.p[1] + cur.p[1]) / 2, (prev.p[2] + cur.p[2]) / 2];
          let a = prev.p, b = cur.p;
          if (fm < .2 && rnd() < .55) { b = [b[0] + (rnd() - .5) * .5, b[1] + (rnd() - .3) * .5, b[2] + (rnd() - .5) * .45]; }
          const tint = [metal[0] * (.75 + .35 * rnd()), metal[1] * (.75 + .35 * rnd()), metal[2] * (.75 + .35 * rnd())];
          const radial = [mn[0] - 0, mn[1] - 1.5, 0]; const rl = Math.hypot(radial[0], radial[1]) || 1, up = [radial[0] / rl, radial[1] / rl, 0];
          beam(k, 'plasticDark', a, b, .03, .24, tint, up);
          if (!low) beam(k, 'plasticDark', [a[0] + up[0] * .12, a[1] + up[1] * .12, a[2]], [b[0] + up[0] * .12, b[1] + up[1] * .12, b[2]], .15, .035, tint, up);
        }
      }
      prev = cur;
    }
  }
  // stringers along the length, where the skin is open or ragged
  const sst = low ? 1.9 : 1.15;
  for (let s = -S + .6; s < S; s += sst) {
    let prev = null;
    for (let z = -16.6; z < 14.2; z += .95) {
      const q = skinP(z, s, .1), f = Math.min(skinField(z, s), liningField(z, s) + .5);
      if (prev && Math.min(prev.f, f) < .5 && (z > -12.4 || (skinField(z, s) > .1 && skinField(prev.z, s) > .1))) beam(k, 'plasticDark', prev.q, q, .05, .1, [1.4, 1.5, 1.6], [q[0], q[1] - 1.5, 0]);
      prev = { q, f, z };
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The cabin lining: wall panels and ceiling just inside the hull, sagging where the roof is open.
const LHALF = [[0, 3.14], [2.5, 3.12], [3.08, 2.7], [3.08, 0]];
export const LIN = makeProfile(LHALF);
export const LS = LIN.S;
const LW_TOP = LIN.sAtY(2.5, 3.0), LW_BOT = LIN.sAtY(.95, 3.0), LCEIL = LIN.cum[1];
export { LW_TOP, LW_BOT, LCEIL };
const SK_TAB = (() => { const t = []; for (let s = 0; s <= S; s += .1) { const p = SKIN.at(s); t.push([s, p.x, p.y]); } return t; })();
export function skinSOf(x, y) { let best = 1e9, bs = 0; const ax = Math.abs(x); for (const [s, px, py] of SK_TAB) { const d = (px * .75 - ax * .75) ** 2 + (py - y) ** 2; if (d < best) { best = d; bs = s; } } return x < 0 ? -bs : bs; }
const liningHoleList = [TEARS[0], TEARS[2], TEARS[3]];
export function liningTear(z, x, y) {
  if (!DAMAGE.on) return 9;
  const s = skinSOf(x, y); let f = 9;
  for (const h of liningHoleList) { const dz = (z - h.z) / (h.rz * .94), ds = (s - h.s) / (h.rs * .96);
    const r = Math.hypot(dz, ds) + (fbm(z * 1.9 + 9, s * 1.9) - .5) * .55; f = Math.min(f, (r - 1) * Math.min(h.rz, h.rs) * 1.1); }
  return f;
}
export function liningP(z, l) {
  const pr = LIN.at(l), x0 = pr.x, y0 = pr.y, f = liningTear(z, x0, y0), s = skinSOf(x0, y0);
  let d = Math.max(-.05, -skinDisp(z, s) * .5) + (fbm(z * .8, l * .8, 4) - .5) * .03;
  let x = x0 + pr.nx * d, y = y0 + pr.ny * d;
  if (Math.abs(l) < LCEIL + .5) { const sag = .62 * Math.pow(1 - sstep(0, 1.9, f), 1.5); y -= sag; x -= Math.sign(l) * sag * .25; }
  else { const bulge = .18 * (1 - sstep(0, 1.2, f)); x += pr.nx * bulge; }
  return [x, y, z];
}
export function buildLining(k, low, nearTearOnly = false) {
  const cell = low ? .75 : .38;
  const grime = (p, f, a, b) => { const g = .82 + .22 * fbm(a * .5, b * .5, 31), low = sstep(.9, 0, p[1]) * .35;
    const soot = (1 - sstep(0, 1.1, f)) * .8; const k2 = (1 - soot) * (1 - low * .5); return [g * k2, g * k2 * (1 - low * .12), g * k2 * (1 - low * .25)]; };
  const common = { cell, faceTo: (p) => [-p[0], 1.55 - p[1], 0.0001], thick: .03, inner: { key: 'steelDark', tint: [.5, .47, .45] }, lip: { key: 'steel', tint: [1, .9, .75] }, nearM: 1.4 };
  const fieldFn = (sg) => (z, t) => { const l = sg * t, p = LIN.at(l); return Math.min(liningTear(z, p.x, p.y), z + 12.05, 14.0 - z); };
  const z0 = -12.05, z1 = 14.0;
  for (const sg of [-1, 1]) {
    const P = (z, t) => liningP(z, sg * t), F = fieldFn(sg);
    // ceiling (both halves meet at the centreline)
    sheet(k, 'ceil', { ...common, P, field: F, a0: z0, a1: z1, b0: 0, b1: LCEIL, cellB: .45, col: grime, uv: (z, t) => [t / 1.5, z / 1.5] });
    // shoulder and the strip above the windows
    sheet(k, 'wall:cabin', { ...common, P, field: F, a0: z0, a1: z1, b0: LCEIL, b1: LW_TOP, cellB: .3, col: grime, uv: (z, t) => [z / 1.35, LIN.at(t).y / 2.7] });
    // sills and below: the wainscot, down to the floor
    sheet(k, 'wall:cabin', { ...common, P, field: F, a0: z0, a1: z1, b0: LW_BOT, b1: LS, cellB: .4, col: grime, uv: (z, t) => [z / 1.35, LIN.at(t).y / 2.7] });
    // between windows
    const segs = []; let zc = z0; for (const wz of WIN_Z) { segs.push([zc, wz - WIN_HALF]); zc = wz + WIN_HALF; } segs.push([zc, z1]);
    for (const [za, zb] of segs) if (zb - za > .04) sheet(k, 'wall:cabin', { ...common, P, field: F, a0: za, a1: zb, b0: LW_TOP, b1: LW_BOT, cell: Math.min(cell, zb - za), cellB: .5, col: grime, uv: (z, t) => [z / 1.35, LIN.at(t).y / 2.7] });
  }
}
