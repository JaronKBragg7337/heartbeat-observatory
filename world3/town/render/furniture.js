/* ============================================================================
   furniture.js — furniture as ITEMS, not baked scenery
   ---------------------------------------------------------------------------
   Each piece is a separate addressable object with its own permanent ID, its
   own transform, and a mesh drawn from a shared cache. That buys three things
   at once: every chair shows up in the inspection layer, a doorway-clearance
   pass can move things that block a door, and edit mode is just a matrix.

   Local space for every kind: origin at the footprint centre, y = 0 at the
   floor, FRONT FACES -Z (same convention as buildings).
   ========================================================================== */
(function () {
"use strict";
const T = window.TOWN, C = T.CODE, D = T.Detail;
const M = () => T.Mats;

const F = (T.FURN = {});
const wood = () => M().wood, fab = () => M().fabric, paint = () => M().paint,
      metal = () => M().metal, glass = () => M().glass, tile = () => M().tile;

/* ------------------------------------------------------------- helpers -- */
function legs(b, w, d, h, mat, tint, th) {
  th = th || 0.05;
  const i = 0.03;
  for (const [ox, oz] of [[-w / 2 + i, -d / 2 + i], [w / 2 - i - th, -d / 2 + i],
                          [-w / 2 + i, d / 2 - i - th], [w / 2 - i - th, d / 2 - i - th]])
    b.box(ox, 0, oz, th, h - 0.04, th, mat, { tint, bevel: 0.005 });
}
function drawerFront(b, x, y, z, w, h, mat, tint) {
  b.box(x, y, z, w, h, 0.02, mat, { tint, bevel: 0.006 });
  b.box(x + w / 2 - 0.12, y + h / 2 - 0.012, z - 0.028, 0.24, 0.024, 0.03, metal(),
        { tint: [.8, .78, .7], bevel: 0.004 });
}
const SOFA_C = [[.46, .48, .52], [.52, .44, .40], [.40, .46, .42], [.56, .52, .44]];

/* ============================================================== library == */
/* def: { size(p) -> [w,d], h, solid, y, build(b,p) }                        */

F.bed = {
  size: (p) => [(p.big ? 1.60 : 1.37) + 0.12, 2.03 + 0.14], h: 0.95, solid: true,
  build(b, p) {
    const w = p.big ? 1.60 : 1.37, l = 2.03;
    const x = -w / 2, z = -l / 2;
    b.box(x - 0.04, 0.10, z - 0.04, w + 0.08, 0.16, l + 0.08, wood(), { tint: [.6, .44, .30], bevel: 0.012 });
    b.box(x, 0.22, z, w, 0.28, l, fab(), { tint: [.85, .84, .86], bevel: 0.02 });
    b.box(x - 0.05, 0.10, z - 0.11, w + 0.10, 0.85, 0.08, wood(), { tint: [.6, .44, .30], bevel: 0.014 });
    for (const [lx, lz] of [[x, z], [x + w - 0.09, z], [x, z + l - 0.09], [x + w - 0.09, z + l - 0.09]])
      b.box(lx, 0, lz, 0.09, 0.11, 0.09, wood(), { tint: [.5, .36, .24], bevel: 0.006 });
    b.box(x + 0.06, 0.50, z + 0.10, w - 0.12, 0.12, 0.42, fab(), { tint: [.96, .96, .95], bevel: 0.03 });
    b.box(x - 0.02, 0.34, z + l * 0.42, w + 0.04, 0.10, l * 0.56, fab(), { tint: [.44, .48, .56], bevel: 0.02 });
  },
};

F.nightstand = {
  size: () => [0.44, 0.42], h: 0.55, solid: true,
  build(b) {
    b.box(-0.21, 0.06, -0.20, 0.42, 0.44, 0.40, wood(), { tint: [.6, .44, .30], bevel: 0.008 });
    b.box(-0.22, 0.50, -0.21, 0.44, 0.03, 0.42, wood(), { tint: [.55, .40, .27], bevel: 0.006 });
    drawerFront(b, -0.18, 0.28, -0.21, 0.36, 0.16, wood(), [.68, .5, .35]);
    b.cyl(0.02, 0.53, 0.00, 0.03, 0.03, 0.28, 8, metal(), { tint: [.8, .78, .7] });
    b.cyl(0.02, 0.81, 0.00, 0.15, 0.12, 0.20, 10, paint(), { tint: [.95, .92, .84], caps: false });
  },
};

F.dresser = {
  size: () => [0.92, 0.52], h: 1.20, solid: true,
  build(b) {
    b.box(-0.45, 0, -0.25, 0.90, 1.20, 0.50, wood(), { tint: [.62, .46, .32], bevel: 0.010 });
    for (let i = 0; i < 3; i++) drawerFront(b, -0.42, 0.08 + i * 0.37, -0.26, 0.84, 0.33, wood(), [.68, .5, .35]);
  },
};

F.sofa = {
  size: () => [2.30, 0.94], h: 0.88, solid: true,
  build(b, p) {
    const c = SOFA_C[(p.v || 0) % SOFA_C.length];
    const dk = [c[0] * .92, c[1] * .92, c[2] * .92];
    b.box(-1.05, 0.18, -0.45, 2.10, 0.28, 0.90, fab(), { tint: c, bevel: 0.03 });
    b.box(-1.05, 0.46, 0.15, 2.10, 0.42, 0.30, fab(), { tint: dk, bevel: 0.03 });
    b.box(-1.15, 0.18, -0.45, 0.14, 0.46, 0.90, fab(), { tint: dk, bevel: 0.03 });
    b.box(1.01, 0.18, -0.45, 0.14, 0.46, 0.90, fab(), { tint: dk, bevel: 0.03 });
    for (const lx of [-0.99, 0.89]) for (const lz of [-0.39, 0.33])
      b.box(lx, 0, lz, 0.07, 0.18, 0.07, wood(), { tint: [.4, .3, .22], bevel: 0.005 });
  },
};

F.coffeeTable = {
  size: () => [1.10, 0.60], h: 0.42, solid: true,
  build(b) {
    b.box(-0.55, 0.38, -0.30, 1.10, 0.04, 0.60, wood(), { tint: [.72, .56, .38], bevel: 0.006 });
    legs(b, 1.10, 0.60, 0.42, wood(), [.72, .56, .38]);
    b.box(-0.48, 0.26, -0.24, 0.96, 0.03, 0.48, wood(), { tint: [.66, .50, .34], bevel: 0.004 });
  },
};

F.mediaUnit = {
  size: () => [1.62, 0.44], h: 1.30, solid: true,
  build(b) {
    b.box(-0.80, 0, -0.21, 1.60, 0.52, 0.42, wood(), { tint: [.34, .30, .28], bevel: 0.008 });
    b.box(-0.76, 0.06, -0.23, 0.74, 0.40, 0.02, wood(), { tint: [.40, .36, .33], bevel: 0.005 });
    b.box(0.02, 0.06, -0.23, 0.74, 0.40, 0.02, wood(), { tint: [.40, .36, .33], bevel: 0.005 });
    b.box(-0.60, 0.58, -0.05, 1.20, 0.68, 0.05, paint(), { tint: [.10, .10, .11], bevel: 0.008 });
    b.box(-0.56, 0.61, -0.07, 1.12, 0.62, 0.02, glass(), { tint: [.16, .17, .19], ao: .9 });
    b.box(-0.10, 0.52, -0.03, 0.20, 0.07, 0.14, paint(), { tint: [.12, .12, .13], bevel: 0.006 });
  },
};

F.rug = {
  size: (p) => [p.w, p.d], h: 0.02, solid: false,
  build(b, p) { b.plane(-p.w / 2, -p.d / 2, p.w, p.d, 0.012, fab(), { tint: p.tint || [.58, .42, .38] }); },
};

/* kitchen ---------------------------------------------------------------- */
F.counterRun = {
  size: (p) => [p.len, 0.64], h: 0.95, solid: true,
  build(b, p) {
    const len = p.len, x = -len / 2, cab = [.90, .89, .86];
    b.box(x, 0.10, -0.31, len, C.counterH - 0.14, 0.62, paint(), { tint: cab, bevel: 0.006 });
    b.box(x - 0.01, C.counterH - 0.04, -0.32, len + 0.02, 0.04, 0.64, tile(), { tint: [.8, .8, .82], bevel: 0.006 });
    b.box(x + 0.03, 0, -0.26, len - 0.06, 0.10, 0.57, paint(), { tint: [.63, .62, .60] });
    const n = Math.max(1, Math.round(len / 0.6));
    for (let i = 0; i < n; i++) {
      const dx = x + (len / n) * i;
      b.box(dx + 0.008, 0.13, -0.325, len / n - 0.016, C.counterH - 0.20, 0.014, paint(),
            { tint: [.94, .93, .90], bevel: 0.005 });
      b.box(dx + len / n / 2 - 0.05, C.counterH - 0.30, -0.345, 0.10, 0.018, 0.02, metal(),
            { tint: [.8, .8, .82], bevel: 0.004 });
    }
  },
};

F.upperCabs = {
  size: (p) => [p.len, 0.36], h: 0.75, solid: false, y: 1.45,
  build(b, p) {
    const len = p.len, x = -len / 2, cab = [.90, .89, .86];
    const n = Math.max(1, Math.round(len / 0.9));
    for (let i = 0; i < n; i++) {
      const w = len / n - 0.04;
      b.box(x + i * (len / n) + 0.02, 0, -0.17, w, 0.75, 0.34, paint(), { tint: cab, bevel: 0.006 });
      b.box(x + i * (len / n) + w / 2 - 0.045, 0.15, -0.20, 0.09, 0.02, 0.03, metal(), { tint: [.8, .8, .82] });
    }
  },
};

F.sink = {
  size: () => [0.62, 0.46], h: 1.20, solid: false,
  build(b) {
    b.box(-0.30, C.counterH - 0.18, -0.21, 0.60, 0.16, 0.42, metal(), { tint: [.78, .80, .82], bevel: 0.01 });
    b.cyl(0.00, C.counterH, -0.17, 0.018, 0.018, 0.26, 8, metal(), { tint: [.85, .86, .88] });
    b.pipe(0.00, C.counterH + 0.26, -0.17, 0.00, C.counterH + 0.24, 0.01, 0.015, 6, metal(), { tint: [.85, .86, .88] });
  },
};

F.range = {
  size: () => [0.78, 0.66], h: 1.10, solid: true,
  build(b) {
    b.box(-0.38, 0, -0.32, 0.76, 0.92, 0.64, metal(), { tint: [.72, .74, .76], bevel: 0.01 });
    for (let i = 0; i < 4; i++)
      b.cyl(-0.18 + (i % 2) * 0.36, 0.925, -0.16 + ((i / 2) | 0) * 0.28, 0.09, 0.09, 0.008, 10, metal(), { tint: [.3, .3, .32] });
    b.box(-0.35, 0.20, -0.36, 0.70, 0.52, 0.04, glass(), { tint: [.2, .2, .22], ao: .8 });
    b.box(-0.35, 0.74, -0.38, 0.70, 0.05, 0.05, metal(), { tint: [.85, .86, .88], bevel: 0.008 });
  },
};

F.fridge = {
  size: () => [0.78, 0.72], h: 1.80, solid: true,
  build(b) {
    b.box(-0.38, 0, -0.35, 0.76, 1.78, 0.70, metal(), { tint: [.80, .81, .82], bevel: 0.012 });
    b.box(-0.36, 0.60, -0.38, 0.72, 0.02, 0.05, metal(), { tint: [.6, .6, .62] });
    b.box(0.17, 0.75, -0.39, 0.04, 0.55, 0.05, metal(), { tint: [.7, .7, .72], bevel: 0.006 });
    b.box(0.17, 0.10, -0.39, 0.04, 0.42, 0.05, metal(), { tint: [.7, .7, .72], bevel: 0.006 });
  },
};

/* dining ----------------------------------------------------------------- */
F.diningTable = {
  size: (p) => [p.w, p.d], h: 0.78, solid: true,
  build(b, p) {
    b.box(-p.w / 2, C.tableH - 0.04, -p.d / 2, p.w, 0.04, p.d, wood(), { tint: [.66, .48, .32], bevel: 0.006 });
    legs(b, p.w, p.d, C.tableH, wood(), [.66, .48, .32], 0.06);
    b.box(-p.w / 2 + 0.06, C.tableH - 0.12, -p.d / 2 + 0.05, p.w - 0.12, 0.05, 0.03, wood(), { tint: [.60, .43, .28], bevel: 0.004 });
    b.box(-p.w / 2 + 0.06, C.tableH - 0.12, p.d / 2 - 0.08, p.w - 0.12, 0.05, 0.03, wood(), { tint: [.60, .43, .28], bevel: 0.004 });
  },
};

F.chair = {
  size: () => [0.44, 0.46], h: 0.95, solid: true,
  build(b, p) {
    const tint = p.dark ? [.24, .26, .28] : [.62, .45, .30];
    const mat = p.dark ? paint() : wood();
    b.box(-0.21, 0.42, -0.21, 0.42, 0.045, 0.42, mat, { tint, bevel: 0.006 });
    for (const [ox, oz] of [[-0.19, -0.19], [0.15, -0.19], [-0.19, 0.15], [0.15, 0.15]])
      b.box(ox, 0, oz, 0.04, 0.42, 0.04, mat, { tint, bevel: 0.004 });
    b.box(-0.20, 0.465, -0.21, 0.40, 0.50, 0.045, mat, { tint, bevel: 0.006 });   // back at -Z (front)
  },
};

/* bath ------------------------------------------------------------------- */
F.toilet = {
  size: () => [0.42, 0.84], h: 0.82, solid: true,
  build(b) {
    b.box(-0.19, 0, -0.42, 0.38, 0.40, 0.68, paint(), { tint: [.98, .98, .97], bevel: 0.02 });
    b.box(-0.21, 0.40, -0.44, 0.42, 0.06, 0.56, paint(), { tint: [.99, .99, .98], bevel: 0.02 });
    b.box(-0.19, 0.40, 0.16, 0.38, 0.42, 0.20, paint(), { tint: [.98, .98, .97], bevel: 0.012 });
    b.box(-0.07, 0.82, 0.18, 0.14, 0.03, 0.16, paint(), { tint: [.96, .96, .95], bevel: 0.006 });
  },
};

F.vanity = {
  size: () => [0.78, 0.52], h: 0.90, solid: true,
  build(b) {
    b.box(-0.375, 0.06, -0.25, 0.75, 0.78, 0.50, paint(), { tint: [.86, .84, .80], bevel: 0.008 });
    b.box(-0.395, 0.84, -0.27, 0.79, 0.05, 0.54, tile(), { tint: [.9, .9, .88], bevel: 0.008 });
    b.cyl(0.00, 0.86, 0.00, 0.16, 0.14, 0.05, 12, paint(), { tint: [1, 1, .99] });
    b.cyl(0.00, 0.89, -0.18, 0.014, 0.014, 0.16, 8, metal(), { tint: [.85, .86, .88] });
    drawerFront(b, -0.33, 0.20, -0.26, 0.66, 0.24, paint(), [.90, .88, .84]);
  },
};

F.mirror = {
  size: () => [0.74, 0.06], h: 0.90, solid: false, y: 1.20,
  build(b) {
    b.box(-0.37, 0, -0.03, 0.74, 0.88, 0.03, paint(), { tint: [.9, .9, .88], bevel: 0.006 });
    b.box(-0.33, 0.03, -0.045, 0.66, 0.82, 0.02, glass(), { tint: [.8, .84, .88], ao: 1 });
  },
};

F.tub = {
  size: () => [0.78, 1.72], h: 0.60, solid: true,
  build(b) {
    b.box(-0.38, 0, -0.85, 0.76, 0.55, 1.70, tile(), { tint: [.96, .96, .95], bevel: 0.02 });
    b.box(-0.32, 0.12, -0.79, 0.64, 0.45, 1.58, tile(), { tint: [.88, .90, .90], bevel: 0.03, ao: .8 });
    b.cyl(0.00, 0.55, -0.72, 0.016, 0.016, 1.40, 8, metal(), { tint: [.85, .86, .88] });
    b.cyl(0.00, 1.90, -0.72, 0.07, 0.07, 0.03, 10, metal(), { tint: [.85, .86, .88] });
  },
};

/* work ------------------------------------------------------------------- */
F.desk = {
  size: (p) => [p.w || 1.42, 0.72], h: 0.78, solid: true,
  build(b, p) {
    const w = p.w || 1.42;
    b.box(-w / 2, 0.70, -0.36, w, 0.04, 0.72, wood(), { tint: [.55, .40, .28], bevel: 0.006 });
    legs(b, w, 0.72, 0.74, wood(), [.55, .40, .28], 0.06);
    if (p.screen) {
      b.box(-0.25, 0.75, 0.02, 0.50, 0.05, 0.30, metal(), { tint: [.2, .2, .22], bevel: 0.006 });
      b.box(-0.23, 0.80, 0.10, 0.46, 0.30, 0.03, glass(), { tint: [.2, .24, .28], ao: .9 });
    }
  },
};

F.bookshelf = {
  size: (p) => [p.len || 1.10, 0.38], h: 1.90, solid: true,
  build(b, p) {
    const len = p.len || 1.10, x = -len / 2;
    b.box(x, 0, -0.19, len, 1.90, 0.36, wood(), { tint: [.58, .42, .30], bevel: 0.008 });
    const bs = T.Q.bookStep;
    for (let i = 0; i < 4; i++) {
      b.box(x + 0.02, 0.30 + i * 0.42, -0.20, len - 0.04, 0.03, 0.34, wood(), { tint: [.5, .36, .25] });
      for (let k = 0; k * bs < len - 0.12; k++)
        b.box(x + 0.06 + k * bs, 0.33 + i * 0.42, -0.14, bs * 0.80, 0.26 + (k % 3) * 0.03, 0.26,
              paint(), { tint: [.3 + (k % 4) * .16, .35 + (k % 3) * .14, .5 - (k % 3) * .1], bevel: 0.004 });
    }
  },
};

F.washer = {
  size: () => [0.68, 0.68], h: 0.98, solid: true,
  build(b) {
    b.box(-0.33, 0, -0.33, 0.66, 0.90, 0.66, metal(), { tint: [.90, .91, .92], bevel: 0.012 });
    b.cyl(0.00, 0.50, -0.34, 0.22, 0.22, 0.04, 14, glass(), { tint: [.4, .45, .5], ao: .85 });
    b.box(-0.29, 0.92, -0.30, 0.58, 0.05, 0.20, metal(), { tint: [.75, .76, .78], bevel: 0.006 });
  },
};

/* commercial ------------------------------------------------------------- */
F.shopShelf = {
  size: (p) => [p.len, 0.60], h: 1.90, solid: true,
  build(b, p) {
    const len = p.len, x = -len / 2;
    b.box(x, 0, -0.28, len, 1.85, 0.55, paint(), { tint: [.80, .80, .78], bevel: 0.008 });
    for (let s = 0; s < 4; s++) {
      b.box(x + 0.02, 0.32 + s * 0.42, -0.31, len - 0.04, 0.035, 0.60, metal(), { tint: [.78, .78, .8] });
      for (let k = 0; k * 0.30 < len - 0.20; k++)
        b.box(x + 0.08 + k * 0.30, 0.355 + s * 0.42, -0.28, 0.22, 0.22 + (k % 3) * 0.04, 0.22,
              paint(), { tint: [.4 + (k % 5) * .12, .5 - (k % 3) * .12, .35 + (k % 4) * .14], bevel: 0.006 });
    }
  },
};

F.shopCounter = {
  size: (p) => [p.len, 0.68], h: 1.08, solid: true,
  build(b, p) {
    const len = p.len, x = -len / 2;
    b.box(x, 0.06, -0.33, len, 0.99, 0.65, wood(), { tint: [.5, .38, .28], bevel: 0.012 });
    b.box(x - 0.03, 1.05, -0.36, len + 0.06, 0.05, 0.72, tile(), { tint: [.85, .85, .82], bevel: 0.008 });
    for (let i = 0; i < Math.max(1, Math.round(len / 0.8)); i++)
      b.box(x + 0.04 + i * 0.8, 0.12, -0.345, Math.min(0.72, len - 0.08), 0.85, 0.015, wood(),
            { tint: [.56, .42, .31], bevel: 0.005 });
  },
};

F.pew = {
  size: (p) => [p.len, 0.48], h: 1.05, solid: true,
  build(b, p) {
    const len = p.len, x = -len / 2;
    b.box(x, 0.42, -0.24, len, 0.06, 0.42, wood(), { tint: [.58, .42, .30], bevel: 0.008 });
    b.box(x, 0.48, 0.14, len, 0.55, 0.06, wood(), { tint: [.58, .42, .30], bevel: 0.008 });
    b.box(x, 0, -0.22, 0.06, 0.42, 0.38, wood(), { tint: [.5, .36, .25], bevel: 0.006 });
    b.box(x + len - 0.06, 0, -0.22, 0.06, 0.42, 0.38, wood(), { tint: [.5, .36, .25], bevel: 0.006 });
  },
};

F.pulpit = {
  size: () => [1.12, 0.58], h: 1.20, solid: true,
  build(b) {
    b.box(-0.55, 0, -0.28, 1.10, 1.15, 0.55, wood(), { tint: [.48, .34, .24], bevel: 0.014 });
    b.box(-0.58, 1.13, -0.31, 1.16, 0.05, 0.61, wood(), { tint: [.42, .30, .21], bevel: 0.008 });
  },
};

F.classDesk = {
  size: () => [1.12, 0.58], h: 0.75, solid: true,
  build(b) {
    b.box(-0.55, 0.68, -0.28, 1.10, 0.045, 0.55, wood(), { tint: [.72, .58, .40], bevel: 0.006 });
    legs(b, 1.10, 0.55, 0.72, wood(), [.72, .58, .40], 0.045);
  },
};

F.board = {
  size: (p) => [p.len, 0.08], h: 1.32, solid: false, y: 0.99,
  build(b, p) {
    b.box(-p.len / 2, 0, -0.05, p.len, 1.32, 0.05, wood(), { tint: [.5, .36, .25], bevel: 0.008 });
    b.box(-p.len / 2 + 0.06, 0.06, -0.075, p.len - 0.12, 1.20, 0.05, paint(), { tint: [.18, .26, .22], bevel: 0.008 });
  },
};

F.stackShelf = {
  size: (p) => [p.len, 0.36], h: 2.05, solid: true,
  build(b, p) {
    const len = p.len, x = -len / 2, bs = T.Q.bookStep;
    b.box(x, 0, -0.17, len, 2.05, 0.34, wood(), { tint: [.55, .40, .28], bevel: 0.008 });
    for (let s = 0; s < 5; s++) {
      b.box(x + 0.02, 0.28 + s * 0.36, -0.19, len - 0.04, 0.03, 0.36, wood(), { tint: [.48, .34, .24] });
      for (let k = 0; k * bs < len - 0.16; k++)
        b.box(x + 0.08 + k * bs, 0.31 + s * 0.36, -0.15, bs * 0.82, 0.22 + (k % 5) * 0.03, 0.26,
              paint(), { tint: [.3 + (k % 7) * .08, .28 + (k % 5) * .09, .34 + (k % 4) * .12] });
    }
  },
};

F.fireEngine = {
  size: () => [2.60, 6.50], h: 2.30, solid: true,
  build(b) {
    const w = 2.50, L = 6.40, x = -w / 2, z = -L / 2;
    b.box(x, 0.42, z, w, 1.55, L, paint(), { tint: [.62, .10, .10], bevel: 0.03 });
    b.box(x + 0.05, 1.10, z + 0.2, w - 0.10, 0.75, 1.9, glass(), { tint: [.3, .35, .4], ao: .9 });
    b.box(x - 0.06, 0.30, z - 0.15, w + 0.12, 0.22, 0.30, metal(), { tint: [.8, .8, .82], bevel: 0.01 });
    b.box(x + 0.15, 1.99, z + 2.6, w - 0.30, 0.16, 3.5, metal(), { tint: [.75, .76, .78], bevel: 0.01 });
    for (let i = 0; i < 8; i++) b.box(x + 0.20, 2.00, z + 2.7 + i * 0.42, w - 0.40, 0.05, 0.05, metal(), { tint: [.7, .7, .72] });
    for (const [wx, wz] of [[x, z + 1.05], [x + w, z + 1.05], [x, z + 4.5], [x + w, z + 4.5]]) {
      const sgn = wx < 0 ? -1 : 1;
      b.pipe(wx - sgn * 0.03, 0.45, wz, wx + sgn * 0.22, 0.45, wz, 0.45, 12, paint(), { tint: [.12, .12, .13], caps: true });
    }
    b.box(x + 0.6, 1.98, z + 0.1, 1.3, 0.12, 0.35, glass(), { tint: [1, .3, .25], ao: 1 });
  },
};

F.workBench = {
  size: (p) => [p.len, 0.72], h: 0.95, solid: true,
  build(b, p) {
    const len = p.len, x = -len / 2;
    b.box(x, 0.10, -0.35, len, 0.78, 0.70, wood(), { tint: [.55, .44, .34], bevel: 0.008 });
    b.box(x - 0.02, 0.88, -0.37, len + 0.04, 0.06, 0.74, wood(), { tint: [.48, .38, .29], bevel: 0.008 });
  },
};

F.lobbyCounter = {
  size: () => [1.90, 0.76], h: 1.12, solid: true,
  build(b) {
    b.box(-0.90, 0.06, -0.33, 1.80, 1.05, 0.65, wood(), { tint: [.5, .38, .28], bevel: 0.012 });
    b.box(-0.95, 1.11, -0.38, 1.90, 0.06, 0.75, tile(), { tint: [.85, .85, .82], bevel: 0.008 });
  },
};

F.rack = {
  size: (p) => [p.w, p.d], h: 1.90, solid: true,
  build(b, p) {
    for (let i = 0; i < 4; i++)
      b.box(-p.w / 2, i * 0.55, -p.d / 2, p.w, 0.05, p.d, metal(), { tint: [.6, .6, .58] });
    for (const [ox, oz] of [[-p.w / 2, -p.d / 2], [p.w / 2 - 0.05, -p.d / 2], [-p.w / 2, p.d / 2 - 0.05], [p.w / 2 - 0.05, p.d / 2 - 0.05]])
      b.box(ox, 0, oz, 0.05, 1.90, 0.05, metal(), { tint: [.55, .55, .53] });
  },
};

F.picture = {
  size: () => [0.66, 0.06], h: 0.86, solid: false, y: 0.95,
  build(b) {
    b.box(-0.33, 0, -0.03, 0.66, 0.86, 0.03, wood(), { tint: [.5, .36, .26], bevel: 0.008 });
    b.box(-0.28, 0.05, -0.045, 0.56, 0.76, 0.02, paint(), { tint: [.86, .82, .74] });
  },
};

/* ============================================================== meshes === */
const cache = new Map();
function key(kind, p) {
  const d = F[kind];
  const s = d.size(p || {});
  return `${kind}|${s[0].toFixed(2)}|${s[1].toFixed(2)}|${p && p.v || 0}|${p && p.big ? 1 : 0}|${p && p.dark ? 1 : 0}|${p && p.screen ? 1 : 0}|${p && p.len ? p.len.toFixed(2) : ""}|${p && p.w ? p.w.toFixed(2) : ""}|${p && p.d ? p.d.toFixed(2) : ""}`;
}
T.furnitureMesh = function (kind, p) {
  const k = key(kind, p);
  let m = cache.get(k);
  if (!m) {
    const b = new T.Builder();
    F[kind].build(b, p || {});
    m = b.build();
    cache.set(k, m);
  }
  return m;
};
T.furnitureCacheSize = () => cache.size;

/* ============================================================== layout === */
/* Every spec is in BUILDING-local coordinates. yaw is a quarter turn.        */
function spec(out, kind, x, z, yaw, p) {
  const d = F[kind];
  const s = d.size(p || {});
  const q = ((Math.round(yaw / (Math.PI / 2)) % 4) + 4) % 4;
  const swap = q === 1 || q === 3;
  out.push({
    kind, x, z, yaw: q * (Math.PI / 2), p: p || {},
    w0: s[0], d0: s[1],                       // unrotated footprint
    fw: swap ? s[1] : s[0], fd: swap ? s[0] : s[1],
    h: d.h, y: d.y || 0, solid: !!d.solid,
  });
  return out[out.length - 1];
}

/* place a run of items against a wall of the room */
T.furnishSpecs = function (rm, lv, rnd) {
  const out = [];
  const t = rm.t;
  const W = rm.w, Dp = rm.d;
  const cx = rm.cx, cz = rm.cz;
  const S = (k, x, z, y, p) => spec(out, k, x, z, y, p);

  if (t === "bed" || t === "bedMain") {
    const big = t === "bedMain";
    const bw = (big ? 1.60 : 1.37) + 0.12;
    S("bed", rm.x0 + 0.30 + bw / 2, rm.z0 + 0.25 + 1.09, 0, { big });
    S("nightstand", rm.x0 + 0.30 + bw + 0.30, rm.z0 + 0.50, 0);
    S("dresser", rm.x1 - 0.70, rm.z1 - 0.35, Math.PI);
  } else if (t === "living" || t === "family") {
    S("sofa", cx, rm.z1 - 0.55, Math.PI, { v: (rnd() * 4) | 0 });
    S("coffeeTable", cx, cz + 0.10, 0);
    S("mediaUnit", cx, rm.z0 + 0.30, 0);
    S("rug", cx, cz + 0.05, 0, { w: Math.min(2.6, W - 1.0), d: Math.min(1.8, Dp - 1.4) });
  } else if (t === "kitchen" || t === "kitchenC") {
    const len = Math.max(1.2, Math.min(W - 2.2, 3.4));
    S("counterRun", rm.x0 + 0.25 + len / 2, rm.z0 + 0.42, 0, { len });
    S("upperCabs", rm.x0 + 0.25 + len / 2, rm.z0 + 0.28, 0, { len });
    S("sink", rm.x0 + 0.25 + len * 0.45, rm.z0 + 0.44, 0);
    S("range", rm.x0 + 0.35 + len + 0.42, rm.z0 + 0.44, 0);
    S("fridge", rm.x1 - 0.50, rm.z0 + 0.48, 0);
  } else if (t === "dining" || t === "diner") {
    const tw = T.clamp(W - 1.8, 1.0, 1.9), td = T.clamp(Dp - 1.8, 0.8, 1.0);
    S("diningTable", cx, cz, 0, { w: tw, d: td });
    const n = Math.max(2, Math.floor(tw / 0.7));
    for (let i = 0; i < n; i++) {
      const x = cx - tw / 2 + tw * ((i + 0.5) / n);
      S("chair", x, cz - td / 2 - 0.36, Math.PI);
      S("chair", x, cz + td / 2 + 0.36, 0);
    }
  } else if (t === "bath" || t === "half") {
    S("toilet", rm.x0 + 0.32, rm.z0 + 0.50, 0);
    S("vanity", rm.x1 - 0.45, rm.z0 + 0.32, 0);
    S("mirror", rm.x1 - 0.45, rm.z0 + 0.06, 0);
    if (t === "bath" && Dp > 2.2 && W > 1.6) S("tub", rm.x0 + 0.42, rm.z1 - 0.95, 0);
  } else if (t === "office" || t === "officeC") {
    S("desk", rm.x0 + 0.95, rm.z0 + 0.55, 0, { screen: true, w: Math.min(1.42, W - 0.9) });
    S("chair", rm.x0 + 0.95, rm.z0 + 1.30, 0, { dark: true });
    S("bookshelf", rm.x1 - 0.25, cz, -Math.PI / 2, { len: Math.min(1.4, Dp - 1.0) });
  } else if (t === "laundry" || t === "utility") {
    S("washer", rm.x0 + 0.45, rm.z0 + 0.45, 0);
    S("washer", rm.x0 + 1.18, rm.z0 + 0.45, 0);
  } else if (t === "retail" || t === "store") {
    const len = Math.max(1.5, W - 2.0);
    for (let i = 0; i * 2.5 < Dp - 2.4; i++) {
      const z = rm.z0 + 1.5 + i * 2.5;
      if (z > rm.z1 - 1.4) break;
      S("shopShelf", cx, z, 0, { len });
    }
    S("shopCounter", rm.x0 + 1.6, rm.z1 - 0.7, Math.PI, { len: Math.min(2.4, W - 1.2) });
  } else if (t === "assembly") {
    const plen = W / 2 - 1.4;
    for (let i = 0; i * 1.05 < Dp - 3.4; i++) {
      const z = rm.z0 + 2.0 + i * 1.05;
      S("pew", cx - plen / 2 - 0.5, z, 0, { len: plen });
      S("pew", cx + plen / 2 + 0.5, z, 0, { len: plen });
    }
    S("pulpit", cx, rm.z1 - 1.4, Math.PI);
  } else if (t === "classroom") {
    for (let i = 0; i < 3; i++) for (let k = 0; k < 3; k++) {
      const x = rm.x0 + 1.3 + k * 1.5, z = rm.z0 + 1.7 + i * 1.35;
      if (x > rm.x1 - 1.0 || z > rm.z1 - 1.1) continue;
      S("classDesk", x, z, 0);
      S("chair", x, z + 0.75, 0);
    }
    S("board", cx, rm.z0 + 0.09, 0, { len: Math.min(3.4, W - 1.6) });
  } else if (t === "stacks") {
    const len = Math.max(1.2, W - 1.4);
    for (let i = 0; i * 1.7 < Dp - 1.6; i++) S("stackShelf", cx, rm.z0 + 1.0 + i * 1.7, 0, { len });
  } else if (t === "bay") {
    S("fireEngine", cx, rm.z0 + 3.6, 0);
  } else if (t === "workshop") {
    S("workBench", cx, rm.z0 + 0.55, 0, { len: Math.min(W - 1.0, 4.0) });
    S("rack", rm.x1 - 0.6, rm.z1 - 0.8, 0, { w: 1.0, d: 0.5 });
  } else if (t === "lobby" || t === "foyer") {
    if (W > 3 && Dp > 2.4) S("lobbyCounter", cx, rm.z1 - 0.60, Math.PI);
    S("rug", cx, rm.z0 + 0.85, 0, { w: Math.min(1.8, W - 1), d: 1.1, tint: [.35, .32, .30] });
  } else if (t === "storage") {
    S("rack", cx, cz, 0, { w: Math.max(0.6, W - 0.6), d: Math.min(0.5, Dp - 0.4) });
  } else if (t === "hall") {
    if (W > 3) S("picture", rm.x0 + 0.9, rm.z0 + 0.06, 0);
  }
  return out;
};

/* ===================================================== doorway clearance =
   The generator used to drop a dresser straight across a doorway. Every door
   gets a keep-clear rectangle a metre deep on both sides; anything sitting in
   one slides along its wall until it fits, or is removed and reported.       */
function overlaps(a, b) {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;
}
function footprint(it, pad) {
  pad = pad || 0;
  return { x0: it.x - it.fw / 2 - pad, x1: it.x + it.fw / 2 + pad,
           z0: it.z - it.fd / 2 - pad, z1: it.z + it.fd / 2 + pad };
}

T.clearDoorways = function (items, rm, doors, issues, tag) {
  const zones = [];
  for (const dr of doors) {
    const half = dr.w / 2 + 0.16, reach = dr.cased ? 0.75 : 1.00;
    const z = dr.axis === "x"
      ? { x0: dr.x - half, x1: dr.x + half, z0: dr.z - reach, z1: dr.z + reach }
      : { x0: dr.x - reach, x1: dr.x + reach, z0: dr.z - half, z1: dr.z + half };
    if (z.x1 < rm.x0 - 0.2 || z.x0 > rm.x1 + 0.2 || z.z1 < rm.z0 - 0.2 || z.z0 > rm.z1 + 0.2) continue;
    zones.push(z);
  }
  if (!zones.length) return items;

  const bad = (it, others) => {
    const f = footprint(it);
    if (f.x0 < rm.x0 - 0.02 || f.x1 > rm.x1 + 0.02 || f.z0 < rm.z0 - 0.02 || f.z1 > rm.z1 + 0.02) return true;
    for (const z of zones) if (overlaps(f, z)) return true;
    for (const o of others) if (o !== it && o.solid && overlaps(f, footprint(o, -0.02))) return true;
    return false;
  };

  const kept = [];
  for (const it of items) {
    if (!it.solid) { kept.push(it); continue; }
    if (!bad(it, kept)) { kept.push(it); continue; }
    /* try sliding along each axis, nearest offset first */
    let placed = false;
    const ox = it.x, oz = it.z;
    outer:
    for (let step = 0.15; step <= 3.2; step += 0.15)
      for (const [dx, dz] of [[step, 0], [-step, 0], [0, step], [0, -step],
                              [step, step], [-step, step], [step, -step], [-step, -step]]) {
        it.x = ox + dx; it.z = oz + dz;
        if (!bad(it, kept)) { placed = true; break outer; }
      }
    if (placed) { it.moved = true; kept.push(it); }
    else {
      it.x = ox; it.z = oz;
      issues.push({ sev: "warn", id: tag, msg: `${it.kind} removed — no clear spot outside the door swing` });
    }
  }
  return kept;
};
})();
