/* ============================================================================
   props.js — furniture, per-type building extras, and street furniture
   ========================================================================== */
(function () {
"use strict";
const T = window.TOWN, C = T.CODE, D = T.Detail;
const M = () => T.Mats;
const W = T.World;

/* ========================================================================= */
/* PER-TYPE BUILDING EXTRAS                                                  */
/* ========================================================================= */
T.Extras = function (b, dt, B) {
  const def = B.def, t = B.tint, metal = M().metal, paint = M().paint;
  const lv0 = B.plan.levels[0];

  /* --- bay window (Victorian) ------------------------------------------ */
  if (def.bay) {
    const bx = def.w * 0.62, bz = -0.9, y = B.floorY;
    b.id(`${B.id}-BAY`, "bay");
    b.box(bx, y, bz, 2.30, 2.30, 0.95, M().siding, { tint: t.wall, uvOff: B.uvOff });
    b.box(bx + 0.10, y + 0.75, bz - 0.03, 2.10, 1.30, 0.06, M().glass, { tint: [.85, .9, .95], ao: .9 });
    b.box(bx + 0.04, y + 0.68, bz - 0.06, 2.22, 0.09, 0.10, paint, { tint: t.trim, bevel: 0.008 });
    b.box(bx + 0.04, y + 2.05, bz - 0.06, 2.22, 0.09, 0.10, paint, { tint: t.trim, bevel: 0.008 });
    for (let i = 1; i < 3; i++) b.box(bx + i * 0.72, y + 0.75, bz - 0.05, 0.07, 1.30, 0.07, paint, { tint: t.trim, bevel: 0.005 });
    b.hipRoof(bx - 0.1, y + 2.32, bz - 0.1, 2.50, 1.15, 0.55, 0.12, M().shingle, { tint: t.roof });
    b.box(bx - 0.05, y - 0.20, bz - 0.05, 2.40, 0.22, 1.05, M().concrete, { tint: [.85, .85, .83], bevel: 0.012 });
    b.endId();
    B.solid(bx, bz, bx + 2.3, bz + 0.95, 0, y + 2.3, `${B.id}-BAY`, "bay");
  }

  /* --- half timbering (Tudor) ------------------------------------------ */
  if (def.halfTimber) {
    const lv = B.plan.levels[1] || lv0;
    b.id(`${B.id}-TMB`, "trim");
    const tt = { tint: [.28, .22, .18], bevel: 0.01 };
    for (const [ox, oz, w2, d2, ax] of [[0, -0.03, def.w, 0.06, 1], [0, def.d - 0.03, def.w, 0.06, 1],
                                        [-0.03, 0, 0.06, def.d, 0], [def.w - 0.03, 0, 0.06, def.d, 0]]) {
      b.box(ox, lv.y + 0.02, oz, w2, 0.16, d2, paint, tt);
      b.box(ox, lv.y + lv.ceilH - 0.20, oz, w2, 0.16, d2, paint, tt);
      const n = Math.round((ax ? def.w : def.d) / 1.3);
      for (let i = 1; i < n; i++) {
        const f = i / n;
        if (ax) b.box(ox + def.w * f - 0.07, lv.y + 0.18, oz, 0.14, lv.ceilH - 0.38, d2, paint, tt);
        else b.box(ox, lv.y + 0.18, oz + def.d * f - 0.07, w2, lv.ceilH - 0.38, 0.14, paint, tt);
      }
    }
    b.endId();
  }

  /* --- steeple (chapel) ------------------------------------------------- */
  if (def.steeple) {
    const cx = def.w / 2 - 0.9, y = B.top + (def.d / 2 + 0.45) * (def.pitch || 1);
    b.id(`${B.id}-SPR`, "steeple");
    b.box(cx, B.floorY, 0.4, 1.80, y - B.floorY + 0.6, 1.80, M().siding, { tint: t.wall, uvOff: B.uvOff });
    b.box(cx - 0.12, y + 0.6, 0.28, 2.04, 0.16, 2.04, paint, { tint: t.trim, bevel: 0.012 });
    b.box(cx + 0.10, y + 0.76, 0.5, 1.40, 1.55, 1.40, M().siding, { tint: t.wall });
    for (const [ox, oz, sw, sd] of [[0.2, -0.02, 1.0, 0.06], [0.2, 1.36, 1.0, 0.06], [-0.02, 0.2, 0.06, 1.0], [1.36, 0.2, 0.06, 1.0]])
      b.box(cx + 0.10 + ox, y + 1.0, 0.5 + oz, sw, 1.05, sd, M().glass, { tint: [.15, .16, .18], ao: .7 });
    b.box(cx + 0.0, y + 2.31, 0.4, 1.60, 0.14, 1.60, paint, { tint: t.trim, bevel: 0.012 });
    /* spire */
    const sy = y + 2.45, sx = cx + 0.80, sz = 1.2;
    for (let i = 0; i < 4; i++) {
      const a0 = i * Math.PI / 2, a1 = a0 + Math.PI / 2, R = 0.78;
      b.tri([sx + Math.cos(a0) * R, sy, sz + Math.sin(a0) * R], [sx, sy + 3.4, sz],
            [sx + Math.cos(a1) * R, sy, sz + Math.sin(a1) * R], M().shingle, { tint: [t.roof[0] * .8, t.roof[1] * .8, t.roof[2] * .8] });
    }
    dt.cyl(sx, sy + 3.4, sz, 0.03, 0.03, 0.55, 6, metal, { tint: [.8, .78, .6] });
    dt.box(sx - 0.18, sy + 3.75, sz - 0.02, 0.36, 0.05, 0.04, metal, { tint: [.8, .78, .6], bevel: 0.006 });
    b.endId();
    B.solid(cx, 0.4, cx + 1.8, 2.2, 0, y, `${B.id}-SPR`, "steeple");
  }

  /* --- portico (town hall, library) ------------------------------------- */
  if (def.portico) {
    const w = Math.min(6.4, def.w * 0.5), x0 = def.w / 2 - w / 2, dep = 2.4, y = B.floorY;
    b.id(`${B.id}-POR`, "portico");
    b.box(x0 - 0.4, 0, -dep, w + 0.8, y, dep + 0.2, M().concrete, { tint: [.88, .88, .85], bevel: 0.02, grime: .3 });
    B.surface(x0 - 0.4, -dep, x0 + w + 0.4, 0.1, y, `${B.id}-POR`);
    const n = 4;
    for (let i = 0; i < n; i++) {
      const px = x0 + (w - 0.44) * (i / (n - 1)) + 0.02;
      b.cyl(px + 0.22, y, -dep + 0.6, 0.22, 0.19, 4.0, 12, paint, { tint: [.97, .97, .95] });
      b.box(px, y, -dep + 0.38, 0.44, 0.16, 0.44, paint, { tint: [.97, .97, .95], bevel: 0.014 });
      b.box(px - 0.04, y + 4.0, -dep + 0.34, 0.52, 0.20, 0.52, paint, { tint: [.97, .97, .95], bevel: 0.014 });
      B.solid(px, -dep + 0.38, px + 0.44, -dep + 0.82, y, y + 4.2, `${B.id}-COL${i}`, "column");
    }
    b.box(x0 - 0.3, y + 4.2, -dep - 0.1, w + 0.6, 0.55, dep + 0.3, paint, { tint: [.97, .97, .95], bevel: 0.018 });
    /* pediment */
    const py = y + 4.75;
    b.tri([x0 - 0.3, py, -dep - 0.1], [x0 + w / 2, py + 1.5, -dep - 0.1], [x0 + w + 0.3, py, -dep - 0.1], paint, { tint: [.97, .97, .95] });
    b.tri([x0 + w + 0.3, py, 0], [x0 + w / 2, py + 1.5, 0], [x0 - 0.3, py, 0], paint, { tint: [.95, .95, .93] });
    b.quad([x0 - 0.3, py, -dep - 0.1], [x0 + w / 2, py + 1.5, -dep - 0.1], [x0 + w / 2, py + 1.5, 0], [x0 - 0.3, py, 0], M().shingle, { tint: t.roof });
    b.quad([x0 + w / 2, py + 1.5, -dep - 0.1], [x0 + w + 0.3, py, -dep - 0.1], [x0 + w + 0.3, py, 0], [x0 + w / 2, py + 1.5, 0], M().shingle, { tint: t.roof });
    b.endId();
    B.emitSteps(b, def.w / 2 - 1.4, -dep - 0.05, 2.8, y);
  }

  /* --- awning + signage (shops) ----------------------------------------- */
  if (def.awning) {
    b.id(`${B.id}-AWN`, "awning");
    const y = B.floorY + 2.85;
    b.quad([0.3, y + 0.55, -0.02], [0.3, y, -1.35], [def.w - 0.3, y, -1.35], [def.w - 0.3, y + 0.55, -0.02],
           paint, { tint: [.55, .18, .16], twoSided: true });
    b.box(0.3, y - 0.02, -1.42, def.w - 0.6, 0.22, 0.10, paint, { tint: [.48, .15, .14], bevel: 0.008 });
    for (let i = 0; i <= 5; i++) {
      const px = 0.4 + (def.w - 0.9) * (i / 5);
      dt.pipe(px, y + 0.55, -0.02, px, y, -1.35, 0.018, 6, metal, { tint: [.55, .55, .57] });
      D.bolt(dt, px, y + 0.57, -0.03, 0.011, metal);
    }
    b.endId();
  }
  if (def.sign) {
    b.id(`${B.id}-SGN`, "sign");
    const y = B.floorY + (def.awning ? 3.6 : 3.2);
    b.box(def.w * 0.15, y, -0.14, def.w * 0.7, 0.85, 0.12, paint, { tint: [.16, .18, .20], bevel: 0.012 });
    b.box(def.w * 0.16, y + 0.07, -0.16, def.w * 0.68, 0.71, 0.03, paint, { tint: [.92, .88, .74], bevel: 0.008 });
    for (const px of [def.w * 0.15, def.w * 0.85 - 0.08]) {
      dt.box(px, y - 0.02, -0.10, 0.08, 0.89, 0.10, metal, { tint: [.4, .4, .42], bevel: 0.006 });
      D.bolt(dt, px + 0.04, y + 0.05, -0.17, 0.012, metal);
      D.bolt(dt, px + 0.04, y + 0.80, -0.17, 0.012, metal);
    }
    b.endId();
  }

  /* --- apparatus bay door (fire station) -------------------------------- */
  if (def.bayDoor) {
    b.id(`${B.id}-BDR`, "door");
    const w = def.w * 0.55, x0 = def.w * 0.06, h = 3.6, y = B.floorY;
    b.box(x0, y, -0.06, w, h, 0.09, metal, { tint: [.90, .90, .88], bevel: 0.008 });
    for (let i = 0; i < 8; i++) b.box(x0 + 0.02, y + 0.06 + i * (h / 8), -0.10, w - 0.04, h / 8 - 0.05, 0.05, metal,
                                      { tint: [.84, .84, .82], bevel: 0.006 });
    b.box(x0 + 0.02, y + h * 0.62, -0.11, w - 0.04, 0.60, 0.03, M().glass, { tint: [.4, .45, .5], ao: .9 });
    b.box(x0 - 0.14, y, -0.16, 0.14, h + 0.16, 0.20, paint, { tint: [.95, .95, .93], bevel: 0.01 });
    b.box(x0 + w, y, -0.16, 0.14, h + 0.16, 0.20, paint, { tint: [.95, .95, .93], bevel: 0.01 });
    b.box(x0 - 0.14, y + h, -0.16, w + 0.28, 0.16, 0.20, paint, { tint: [.95, .95, .93], bevel: 0.01 });
    b.endId();
    /* apron slab */
    b.box(x0 - 0.3, -0.01, -6.0, w + 0.6, B.floorY + 0.01, 6.0, M().concrete, { tint: [.82, .82, .80], uvOff: B.uvOff, grime: .4 });
    B.surface(x0 - 0.3, -6.0, x0 + w + 0.3, 0.0, B.floorY, `${B.id}-APR`);
  }

  /* --- bell cupola (school) --------------------------------------------- */
  if (def.bell) {
    const y = B.top + (def.d / 2) * (def.pitch || 0.6);
    b.id(`${B.id}-CUP`, "cupola");
    b.box(def.w / 2 - 0.7, y, def.d / 2 - 0.7, 1.4, 1.3, 1.4, paint, { tint: [.96, .96, .94], bevel: 0.012 });
    for (const [ox, oz, sw, sd] of [[0.2, -0.03, 1.0, 0.06], [0.2, 1.37, 1.0, 0.06], [-0.03, 0.2, 0.06, 1.0], [1.37, 0.2, 0.06, 1.0]])
      b.box(def.w / 2 - 0.7 + ox, y + 0.25, def.d / 2 - 0.7 + oz, sw, 0.85, sd, M().glass, { tint: [.14, .15, .17], ao: .6 });
    b.hipRoof(def.w / 2 - 0.85, y + 1.3, def.d / 2 - 0.85, 1.7, 1.7, 0.9, 0.1, M().metalRoof, { tint: [.5, .52, .54] });
    b.cyl(def.w / 2, y + 0.35, def.d / 2, 0.26, 0.30, 0.42, 10, metal, { tint: [.55, .48, .28], caps: false });
    b.endId();
  }

  /* --- A-frame: roof to the ground, big glass gable --------------------- */
  if (def.aframe) {
    b.id(`${B.id}-AFR`, "roof");
    const h = B.top + def.d * 0.82;
    for (const sgn of [-1, 1]) {
      const z = def.d / 2 + sgn * (def.d / 2 + 0.5);
      b.quad([-0.5, -0.05, z], [-0.5, h, def.d / 2], [def.w + 0.5, h, def.d / 2], [def.w + 0.5, -0.05, z],
             M().shingle, { tint: t.roof, uvOff: B.uvOff });
    }
    b.endId();
    B.solid(-0.5, -0.4, 0.1, def.d + 0.4, 0, h, `${B.id}-AFR-L`, "roof");
    B.solid(def.w - 0.1, -0.4, def.w + 0.5, def.d + 0.4, 0, h, `${B.id}-AFR-R`, "roof");
  }
};

/* ========================================================================= */
/* STREET FURNITURE + VEGETATION                                             */
/* ========================================================================= */
const P = (T.Props = {});
let counters = {};
function nid(pfx) { counters[pfx] = (counters[pfx] || 0) + 1; return pfx + String(counters[pfx]).padStart(4, "0"); }
P.resetIds = () => { counters = {}; };

P.tree = function (b, x, z, r, scale) {
  const id = nid("TREE");
  const h = (4.2 + r() * 3.4) * (scale || 1);
  const tr = 0.13 * (h / 5.5);
  b.id(id, "tree");
  b.push(x, 0, z, r() * 6.28);
  /* trunk with a flare at the base + two boughs */
  b.cyl(0, -0.1, 0, tr * 1.7, tr, h * 0.42, 7, M().bark, { tint: [.9, .88, .86] });
  b.cyl(0, h * 0.40, 0, tr, tr * 0.7, h * 0.30, 6, M().bark, { tint: [.88, .86, .84] });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * 6.28 + r();
    b.pipe(0, h * 0.40, 0, Math.cos(a) * h * 0.16, h * 0.60, Math.sin(a) * h * 0.16, tr * 0.45, 5, M().bark, { tint: [.85, .83, .8] });
  }
  const cw = h * 0.72, cy = h * 0.42;
  b.crossCards(0, cy, 0, cw, h * 0.62, T.Q.foliage, M().leaf, { tint: [.8 + r() * .4, .85 + r() * .3, .7 + r() * .4] });
  b.crossCards(0, cy + h * 0.30, 0, cw * 0.7, h * 0.40, T.Q.foliage - 1, M().leaf, { tint: [.85 + r() * .3, .9 + r() * .2, .75 + r() * .3] });
  b.pop();
  b.shadowQuad(x + 0.35, z + 0.25, cw * 0.95, cw * 0.95, 0.014);
  b.endId();
  W.colliders.push({ x0: x - tr * 2, x1: x + tr * 2, z0: z - tr * 2, z1: z + tr * 2, y0: 0, y1: h * 0.5, id, type: "tree" });
  W.assets.push({ id, type: "tree", box: [x - cw / 2, 0, z - cw / 2, x + cw / 2, h, z + cw / 2], expectY: 0 });
};

P.bush = function (b, x, z, r) {
  const id = nid("BUSH"), s = 0.7 + r() * 0.7;
  b.id(id, "bush");
  b.crossCards(x, 0.02, z, s * 1.5, s * 1.3, 3, M().leaf, { tint: [.7 + r() * .3, .85, .6 + r() * .3] });
  b.shadowQuad(x, z, s * 1.7, s * 1.7, 0.013);
  b.endId();
  W.assets.push({ id, type: "bush", box: [x - s, 0, z - s, x + s, s * 1.3, z + s], expectY: 0 });
};

P.lamp = function (b, dt, x, z, yaw) {
  const id = nid("LAMP"), metal = M().metal, h = 4.6;
  b.id(id, "lamp");
  b.push(x, 0, z, yaw || 0);
  b.cyl(0, 0, 0, 0.14, 0.10, 0.30, 10, M().concrete, { tint: [.8, .8, .78] });
  b.cyl(0, 0.28, 0, 0.085, 0.062, h, 10, metal, { tint: [.26, .27, .28] });
  b.pipe(0, h * 0.94, 0, 0, h + 0.30, 1.05, 0.055, 8, metal, { tint: [.26, .27, .28] });
  b.box(-0.20, h + 0.14, 0.80, 0.40, 0.20, 0.52, metal, { tint: [.28, .29, .30], bevel: 0.014 });
  b.box(-0.17, h + 0.07, 0.83, 0.34, 0.08, 0.46, M().glass, { tint: [1, .95, .78], ao: 1 });
  dt.push(x, 0, z, yaw || 0);
  for (let i = 0; i < 4; i++) D.bolt(dt, -0.10 + (i % 2) * 0.20, 0.30, -0.10 + ((i / 2) | 0) * 0.20, 0.012, metal);
  dt.box(-0.06, 0.55, -0.10, 0.12, 0.28, 0.03, metal, { tint: [.4, .4, .42], bevel: 0.005 });   // access panel
  dt.pop();
  b.pop();
  b.shadowQuad(x, z, 1.1, 1.1, 0.013);
  b.endId();
  W.colliders.push({ x0: x - 0.12, x1: x + 0.12, z0: z - 0.12, z1: z + 0.12, y0: 0, y1: 3, id, type: "lamp" });
  W.assets.push({ id, type: "lamp", box: [x - 0.3, 0, z - 0.3, x + 0.3, h + 0.4, z + 1.4], expectY: 0 });
  const c = Math.cos(yaw || 0), s = Math.sin(yaw || 0);
  W.lamps.push({ x: x + s * 1.05, y: h + 0.1, z: z + c * 1.05, r: 13, street: true });
};

P.hydrant = function (b, x, z) {
  const id = nid("HYD"), m = M().metal, tint = [.86, .28, .22];
  b.id(id, "hydrant");
  b.cyl(x, 0.0, z, 0.19, 0.17, 0.12, 10, m, { tint });
  b.cyl(x, 0.12, z, 0.13, 0.13, 0.52, 10, m, { tint });
  b.cyl(x, 0.64, z, 0.16, 0.15, 0.10, 10, m, { tint: [.9, .3, .24] });
  b.cyl(x, 0.74, z, 0.10, 0.07, 0.12, 8, m, { tint: [.9, .3, .24] });
  b.cyl(x, 0.86, z, 0.035, 0.035, 0.05, 6, m, { tint: [.55, .56, .56] });
  for (const a of [0, Math.PI]) b.cyl(x + Math.cos(a) * 0.12, 0.40, z + Math.sin(a) * 0.12, 0.075, 0.075, 0.10, 8, m, { tint: [.8, .26, .2] });
  for (let i = 0; i < 6; i++) D.bolt(b, x + Math.cos(i) * 0.15, 0.60, z + Math.sin(i) * 0.15, 0.010, m);
  b.shadowQuad(x, z, 0.8, 0.8, 0.013);
  b.endId();
  W.colliders.push({ x0: x - 0.2, x1: x + 0.2, z0: z - 0.2, z1: z + 0.2, y0: 0, y1: 0.9, id, type: "hydrant" });
  W.assets.push({ id, type: "hydrant", box: [x - 0.2, 0, z - 0.2, x + 0.2, 0.9, z + 0.2], expectY: 0 });
};

P.bench = function (b, x, z, yaw) {
  const id = nid("BENCH"), wood = M().wood, m = M().metal;
  b.id(id, "bench"); b.push(x, 0, z, yaw || 0);
  for (const ox of [-0.72, 0.56]) {
    b.box(ox, 0, -0.24, 0.06, 0.42, 0.50, m, { tint: [.22, .24, .24], bevel: 0.006 });
    b.box(ox, 0.42, -0.24, 0.06, 0.06, 0.50, m, { tint: [.22, .24, .24], bevel: 0.006 });
    b.box(ox, 0.42, 0.16, 0.06, 0.52, 0.06, m, { tint: [.22, .24, .24], bevel: 0.006 });
    D.bolt(b, ox + 0.03, 0.06, -0.25, 0.010, m); D.bolt(b, ox + 0.03, 0.30, -0.25, 0.010, m);
  }
  for (let i = 0; i < 4; i++) b.box(-0.78, 0.44, -0.22 + i * 0.11, 1.56, 0.035, 0.09, wood, { tint: [.66, .48, .32], bevel: 0.006 });
  for (let i = 0; i < 3; i++) b.box(-0.78, 0.52 + i * 0.13, 0.20, 1.56, 0.10, 0.035, wood, { tint: [.66, .48, .32], bevel: 0.006 });
  b.pop(); b.shadowQuad(x, z, 2.0, 1.0, 0.013); b.endId();
  W.colliders.push({ x0: x - 0.85, x1: x + 0.85, z0: z - 0.4, z1: z + 0.4, y0: 0, y1: 0.9, id, type: "bench" });
  W.assets.push({ id, type: "bench", box: [x - 0.85, 0, z - 0.4, x + 0.85, 0.95, z + 0.4], expectY: 0 });
};

P.mailbox = function (b, x, z, yaw) {
  const id = nid("MAIL"), m = M().metal, wood = M().wood;
  b.id(id, "mailbox"); b.push(x, 0, z, yaw || 0);
  b.box(-0.05, 0, -0.05, 0.10, 1.05, 0.10, wood, { tint: [.6, .45, .32], bevel: 0.008 });
  b.box(-0.11, 1.05, -0.24, 0.22, 0.04, 0.48, wood, { tint: [.55, .40, .28], bevel: 0.006 });
  b.box(-0.09, 1.09, -0.22, 0.18, 0.20, 0.44, m, { tint: [.35, .38, .42], bevel: 0.02 });
  b.box(-0.09, 1.09, 0.20, 0.18, 0.20, 0.03, m, { tint: [.30, .33, .36], bevel: 0.01 });
  b.box(0.09, 1.14, -0.10, 0.03, 0.14, 0.02, m, { tint: [.8, .2, .16], bevel: 0.004 });
  b.pop(); b.endId();
  W.assets.push({ id, type: "mailbox", box: [x - 0.25, 0, z - 0.25, x + 0.25, 1.35, z + 0.25], expectY: 0 });
};

P.fence = function (b, x0, z0, x1, z1, tint) {
  const id = nid("FENCE"), paint = M().paint;
  const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz), a = Math.atan2(-dz, dx);
  b.id(id, "fence"); b.push(x0, 0, z0, -a);
  const h = 1.05;
  for (let p = 0; p <= L; p += 2.0) {
    b.box(p - 0.045, 0, -0.045, 0.09, h + 0.12, 0.09, paint, { tint, bevel: 0.008 });
    D.bolt(b, p, h - 0.1, -0.05, 0.008, M().metal);
  }
  for (const ry of [0.22, 0.72]) b.box(0, ry, -0.025, L, 0.07, 0.05, paint, { tint, bevel: 0.005 });
  const pk = T.Q.bevel ? 0.16 : 0.22;
  for (let p = 0.06; p < L - 0.06; p += pk)
    b.box(p, 0.06, -0.018, 0.085, h, 0.036, paint, { tint });
  b.pop(); b.endId();
  W.colliders.push({ x0: Math.min(x0, x1) - 0.06, x1: Math.max(x0, x1) + 0.06,
                     z0: Math.min(z0, z1) - 0.06, z1: Math.max(z0, z1) + 0.06, y0: 0, y1: 1.1, id, type: "fence" });
  W.assets.push({ id, type: "fence", box: [Math.min(x0, x1), 0, Math.min(z0, z1), Math.max(x0, x1), 1.2, Math.max(z0, z1)], expectY: 0 });
};

P.car = function (b, dt, x, z, yaw, r) {
  const id = nid("CAR"), paint = M().paint, glass = M().glass, m = M().metal;
  const body = [[.62,.16,.16],[.18,.28,.46],[.86,.86,.88],[.16,.18,.20],[.42,.46,.40],[.72,.62,.30]][((r() * 6) | 0)];
  const gy = T.Town ? T.Town.groundY(x, z) : 0;
  b.id(id, "car"); b.push(x, gy, z, yaw || 0);
  const L = 4.55, w = 1.82;
  /* primary mass: rocker → body → bonnet/boot decks → cabin */
  b.box(-w / 2 + 0.04, 0.30, -L / 2 + 0.10, w - 0.08, 0.30, L - 0.20, paint,
        { tint: [body[0] * .82, body[1] * .82, body[2] * .82], bevel: 0.03 });
  b.box(-w / 2, 0.56, -L / 2 + 0.06, w, 0.36, L - 0.12, paint, { tint: body, bevel: 0.05 });
  b.box(-w / 2 + 0.03, 0.90, -L / 2 + 0.10, w - 0.06, 0.06, 1.05, paint, { tint: body, bevel: 0.03 });  // bonnet
  b.box(-w / 2 + 0.03, 0.90, L / 2 - 1.02, w - 0.06, 0.09, 0.92, paint, { tint: body, bevel: 0.03 });   // boot
  /* cabin (secondary form) with glass set inside it */
  const cz0 = -L / 2 + 1.10, cL = L * 0.50;
  b.box(-w / 2 + 0.06, 0.92, cz0, w - 0.12, 0.50, cL, paint, { tint: body, bevel: 0.05 });
  b.box(-w / 2 + 0.02, 0.96, cz0 + 0.05, w - 0.04, 0.40, cL - 0.10, glass, { tint: [.32, .38, .44], ao: .9 });
  b.box(-w / 2 + 0.08, 0.96, cz0 - 0.03, w - 0.16, 0.40, 0.04, glass, { tint: [.34, .40, .46], ao: .9 });
  b.box(-w / 2 + 0.08, 0.96, cz0 + cL - 0.01, w - 0.16, 0.40, 0.04, glass, { tint: [.34, .40, .46], ao: .9 });
  b.box(-w / 2 + 0.05, 1.40, cz0 + 0.02, w - 0.10, 0.06, cL - 0.04, paint, { tint: body, bevel: 0.03 });  // roof
  /* wheels: axles run across the car, so they're capped tubes on X */
  for (const [wx, wz] of [[-w / 2, -L / 2 + 1.18], [w / 2, -L / 2 + 1.18], [-w / 2, L / 2 - 1.19], [w / 2, L / 2 - 1.19]]) {
    const sgn = wx < 0 ? -1 : 1;
    b.pipe(wx - sgn * 0.03, 0.33, wz, wx + sgn * 0.18, 0.33, wz, 0.33, 14, paint, { tint: [.09, .09, .10], caps: true });
    b.pipe(wx + sgn * 0.06, 0.33, wz, wx + sgn * 0.175, 0.33, wz, 0.20, 10, m, { tint: [.72, .73, .75], caps: true });
    b.box(wx - (sgn > 0 ? 0.03 : 0.21), 0.60, wz - 0.48, 0.24, 0.14, 0.96, paint,
          { tint: [body[0] * .7, body[1] * .7, body[2] * .7], bevel: 0.02 });   // arch
  }
  /* tertiary: bumpers, lamps, mirrors, handles, panel seams */
  b.box(-w / 2 - 0.02, 0.42, -L / 2 - 0.06, w + 0.04, 0.26, 0.10, paint, { tint: [.18, .18, .19], bevel: 0.02 });
  b.box(-w / 2 - 0.02, 0.42, L / 2 - 0.04, w + 0.04, 0.26, 0.10, paint, { tint: [.18, .18, .19], bevel: 0.02 });
  for (const sx of [-1, 1]) {
    b.box(sx * 0.52 - 0.19, 0.72, -L / 2 - 0.02, 0.38, 0.16, 0.08, glass, { tint: [1, .96, .86], ao: 1 });
    b.box(sx * 0.52 - 0.19, 0.74, L / 2 - 0.05, 0.38, 0.14, 0.07, glass, { tint: [.8, .12, .10], ao: 1 });
    dt.push(x, gy, z, yaw || 0);
    dt.box(sx * (w / 2) - (sx > 0 ? 0 : 0.14), 1.02, -L / 2 + 1.12, 0.14, 0.09, 0.20, paint, { tint: [.2, .2, .21], bevel: 0.01 });
    dt.box(sx * (w / 2 - 0.02) - (sx > 0 ? 0 : 0.03), 0.80, -0.30, 0.05, 0.035, 0.20, m, { tint: [.75, .76, .78], bevel: 0.006 });
    dt.box(sx * (w / 2 - 0.02) - (sx > 0 ? 0 : 0.03), 0.80, 0.34, 0.05, 0.035, 0.20, m, { tint: [.75, .76, .78], bevel: 0.006 });
    dt.box(sx * (w / 2 - 0.005) - (sx > 0 ? 0 : 0.01), 0.36, -0.02, 0.012, 0.58, 0.02, paint, { tint: [body[0] * .7, body[1] * .7, body[2] * .7] });
    dt.pop();
  }
  b.pop();
  b.shadowQuad(x, z, 3.2, 5.6, gy + 0.014);
  b.endId();
  const rot = Math.abs(Math.cos(yaw || 0)) > 0.5;
  const hw = rot ? 0.95 : 2.4, hd = rot ? 2.4 : 0.95;
  W.colliders.push({ x0: x - hw, x1: x + hw, z0: z - hd, z1: z + hd, y0: gy, y1: gy + 1.5, id, type: "car" });
  W.assets.push({ id, type: "car", box: [x - hw, gy, z - hd, x + hw, gy + 1.5, z + hd], expectY: gy });
};

P.sign = function (b, x, z, yaw, text) {
  const id = nid("SIGN"), m = M().metal;
  b.id(id, "sign"); b.push(x, 0, z, yaw || 0);
  b.cyl(0, 0, 0, 0.045, 0.040, 2.35, 8, m, { tint: [.55, .56, .57] });
  b.box(-0.42, 2.10, -0.03, 0.84, 0.24, 0.03, m, { tint: [.20, .34, .24], bevel: 0.008 });
  b.box(-0.40, 2.13, -0.045, 0.80, 0.18, 0.02, m, { tint: [.92, .93, .90] });
  D.bolt(b, 0, 2.16, -0.05, 0.010, m); D.bolt(b, 0, 2.28, -0.05, 0.010, m);
  b.pop(); b.endId();
  W.assets.push({ id, type: "sign", box: [x - 0.5, 0, z - 0.2, x + 0.5, 2.4, z + 0.2], expectY: 0, note: text });
};

P.bin = function (b, x, z) {
  const id = nid("BIN"), m = M().metal;
  b.id(id, "bin");
  b.cyl(x, 0.02, z, 0.30, 0.34, 0.85, 12, m, { tint: [.30, .36, .32] });
  b.cyl(x, 0.87, z, 0.36, 0.30, 0.10, 12, m, { tint: [.24, .28, .26] });
  for (let i = 0; i < 3; i++) b.cyl(x, 0.20 + i * 0.25, z, 0.315 + i * 0.008, 0.315 + i * 0.008, 0.03, 12, m, { tint: [.26, .3, .28] });
  b.shadowQuad(x, z, 0.9, 0.9, 0.013);
  b.endId();
  W.colliders.push({ x0: x - 0.34, x1: x + 0.34, z0: z - 0.34, z1: z + 0.34, y0: 0, y1: 1, id, type: "bin" });
  W.assets.push({ id, type: "bin", box: [x - 0.36, 0, z - 0.36, x + 0.36, 0.97, z + 0.36], expectY: 0 });
};

P.playSet = function (b, x, z) {
  const id = nid("PLAY"), m = M().metal, wood = M().wood;
  b.id(id, "playset"); b.push(x, 0, z, 0);
  for (const sx of [-1.6, 1.6]) for (const sz of [-0.9, 0.9])
    b.cyl(sx, 0, sz, 0.06, 0.06, 2.4, 8, m, { tint: [.65, .25, .22] });
  b.pipe(-1.7, 2.4, 0, 1.7, 2.4, 0, 0.07, 8, m, { tint: [.25, .45, .65] });
  for (const sx of [-0.6, 0.6]) {
    b.box(sx - 0.02, 0.55, -0.22, 0.04, 1.85, 0.04, m, { tint: [.3, .3, .32] });
    b.box(sx - 0.02, 0.55, 0.18, 0.04, 1.85, 0.04, m, { tint: [.3, .3, .32] });
    b.box(sx - 0.22, 0.50, -0.24, 0.44, 0.05, 0.48, wood, { tint: [.5, .38, .28], bevel: 0.006 });
  }
  b.pop(); b.shadowQuad(x, z, 4.0, 2.6, 0.014); b.endId();
  W.assets.push({ id, type: "playset", box: [x - 1.8, 0, z - 1.1, x + 1.8, 2.5, z + 1.1], expectY: 0 });
};
})();
