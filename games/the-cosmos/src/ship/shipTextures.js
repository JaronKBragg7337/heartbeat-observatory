// ============================================================================
// shipTextures.js — surfaces made in code. No downloads, nothing to license.
//
// OWNS: the painted textures (albedo, normal, roughness/metal) and the PBR
//       materials the ship is dressed in.
// DOES NOT OWN: geometry (shipKit.js) or where a texture is used.
//
// HOW A SURFACE IS MADE
// ---------------------
// Every texture is painted in METRES, not pixels: a wall panel is 1.35 m wide
// and its seam is 8 mm deep, whatever the canvas resolution. Each brush stroke
// lands on three layers at once,
//     colour      what it looks like
//     height      how far it stands off the surface (becomes the normal map)
//     material    roughness and metalness (packed the way three.js reads them)
// so a rivet is a coloured dot AND a bump AND a shinier patch, from one call.
// The normal map is derived from the height layer with a Sobel filter, wrapped
// so a tile joins itself.
//
// In Node (the validator) there is no canvas; materials come back plain and the
// geometry is unaffected.
// ============================================================================

import * as THREE from 'three';

const HAS_DOM = typeof document !== 'undefined';

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A painter that writes colour, height and material layers together. */
class Layers {
  constructor(wM, hM, pxPerM, seed = 1) {
    this.W = Math.round(wM * pxPerM); this.H = Math.round(hM * pxPerM);
    this.s = pxPerM; this.wM = wM; this.hM = hM;
    this.rnd = mulberry(seed);
    const mk = () => { const c = document.createElement('canvas'); c.width = this.W; c.height = this.H; return c; };
    this.cA = mk(); this.cH = mk(); this.cO = mk();
    this.a = this.cA.getContext('2d'); this.h = this.cH.getContext('2d'); this.o = this.cO.getContext('2d');
    for (const g of [this.a, this.h, this.o]) { g.imageSmoothingEnabled = true; }
  }
  // y is measured UP from the bottom of the tile (a wall's floor is y = 0), so the
  // transform flips the canvas: the texture then lands the right way up.
  _setup(g) { g.setTransform(this.s, 0, 0, -this.s, 0, this.H); }
  static gray(v) { const n = Math.max(0, Math.min(255, Math.round(v))); return `rgb(${n},${n},${n})`; }
  // orm: red = occlusion (unused, 255), green = roughness, blue = metal
  static orm(r, m) { return `rgb(255,${Math.round(r * 255)},${Math.round(m * 255)})`; }

  /** Rectangle in metres. o = { c, h, r, m, a } */
  rect(x, y, w, h, o) {
    for (const ox of [0, -this.wM, this.wM]) for (const oy of [0, -this.hM, this.hM]) {
      const px = x + ox, py = y + oy;
      if (px > this.wM || py > this.hM || px + w < 0 || py + h < 0) continue;
      this._fill(this.a, o.c, o.a, px, py, w, h);
      this._fill(this.h, Layers.gray(o.h ?? 128), o.a, px, py, w, h);
      this._fill(this.o, Layers.orm(o.r ?? 0.6, o.m ?? 0), o.a, px, py, w, h);
    }
  }
  _fill(g, style, alpha, x, y, w, h) {
    this._setup(g);
    g.globalAlpha = alpha ?? 1;
    g.fillStyle = style;
    g.fillRect(x, y, w, h);
    g.globalAlpha = 1;
  }
  fill(o) { this.rect(0, 0, this.wM, this.hM, o); }
  /** Circle in metres. */
  dot(x, y, r, o) {
    for (const ox of [0, -this.wM, this.wM]) for (const oy of [0, -this.hM, this.hM]) {
      const px = x + ox, py = y + oy;
      if (px + r < 0 || py + r < 0 || px - r > this.wM || py - r > this.hM) continue;
      for (const [g, style] of [[this.a, o.c], [this.h, Layers.gray(o.h ?? 128)], [this.o, Layers.orm(o.r ?? 0.6, o.m ?? 0)]]) {
        this._setup(g); g.globalAlpha = o.a ?? 1; g.fillStyle = style;
        g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
      }
    }
  }
  /** Vertical gradient band in colour only (grime, fade). */
  gradV(y0, y1, c0, c1, a0 = 1, a1 = 1, hAmt = null) {
    const g = this.a; this._setup(g);
    const gr = g.createLinearGradient(0, y0, 0, y1);
    gr.addColorStop(0, c0); gr.addColorStop(1, c1);
    g.globalAlpha = 1; g.fillStyle = gr; g.globalAlpha = Math.max(a0, a1); g.fillRect(0, Math.min(y0, y1), this.wM, Math.abs(y1 - y0)); g.globalAlpha = 1;
  }
  /** Scatter small marks in metres. */
  speckle(n, sMin, sMax, o) {
    for (let i = 0; i < n; i++) {
      const s = sMin + this.rnd() * (sMax - sMin);
      const jitter = (this.rnd() - 0.5) * (o.jitter ?? 0);
      this.rect(this.rnd() * this.wM, this.rnd() * this.hM, s * (o.aspect ?? 1), s,
        { c: o.c, h: (o.h ?? 128) + jitter * 60, r: o.r ?? 0.6, m: o.m ?? 0, a: o.a ?? 0.5 });
    }
  }
  /** Long streaks (dust runs, drips). */
  streaks(n, wM, lenMin, lenMax, o) {
    for (let i = 0; i < n; i++) {
      const x = this.rnd() * this.wM, y = this.rnd() * this.hM;
      const len = lenMin + this.rnd() * (lenMax - lenMin);
      this.rect(x, y, wM * (0.6 + this.rnd() * 0.8), len, { c: o.c, h: o.h ?? 128, r: o.r ?? 0.7, m: o.m ?? 0, a: (o.a ?? 0.12) * (0.5 + this.rnd()) });
    }
  }

  /** Finish: colour texture, normal map, roughness/metal map. */
  finish(normalStrength = 2.0, repeat = true) {
    const albedo = this._tex(this.cA, true, repeat);
    const orm = this._tex(this.cO, false, repeat);
    const normal = this._tex(normalFromHeight(this.cH, normalStrength), false, repeat);
    return { albedo, normal, orm };
  }
  _tex(canvas, srgb, repeat) {
    const t = new THREE.CanvasTexture(canvas);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    t.anisotropy = 4;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    return t;
  }
}

/** Sobel normal map from a height canvas, wrapping at the edges. */
function normalFromHeight(hc, strength) {
  const W = hc.width, H = hc.height;
  const src = hc.getContext('2d').getImageData(0, 0, W, H).data;
  const out = document.createElement('canvas'); out.width = W; out.height = H;
  const og = out.getContext('2d');
  const img = og.createImageData(W, H);
  const d = img.data;
  const hgt = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) hgt[i] = src[i * 4] / 255;
  const at = (x, y) => hgt[((y + H) % H) * W + ((x + W) % W)];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
      const dy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
      let nx = -dx * strength, ny = dy * strength, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l; ny /= l; nz /= l;
      const k = (y * W + x) * 4;
      d[k] = (nx * 0.5 + 0.5) * 255; d[k + 1] = (ny * 0.5 + 0.5) * 255; d[k + 2] = (nz * 0.5 + 0.5) * 255; d[k + 3] = 255;
    }
  }
  og.putImageData(img, 0, 0);
  return out;
}

// ---------------------------------------------------------------------------
// Surface recipes
// ---------------------------------------------------------------------------

const PALETTE = {
  corridor: { base: '#aeb4b8', band: '#4f5a63', trim: '#2c3339', stripe: '#e0a83c', dirt: '#3a3f44' },
  crew:     { base: '#b8ada0', band: '#5b4f47', trim: '#332d29', stripe: '#c9793a', dirt: '#403a35' },
  med:      { base: '#dfe6e8', band: '#2e8b93', trim: '#4a5c60', stripe: '#3fc2cc', dirt: '#5a6568' },
  galley:   { base: '#cfc7b3', band: '#6d7377', trim: '#3a3f42', stripe: '#d8a23d', dirt: '#4a4740' },
  cabin:    { base: '#a99a88', band: '#4d3f36', trim: '#2b2420', stripe: '#b3813d', dirt: '#3b342e' },
  workshop: { base: '#9aa2a0', band: '#3a4148', trim: '#22282c', stripe: '#e3b02f', dirt: '#33383a' },
  engineering: { base: '#8f979c', band: '#2f363c', trim: '#1c2226', stripe: '#f0b429', dirt: '#2a2f33' },
  cargo:    { base: '#818a8f', band: '#2e353a', trim: '#1a2024', stripe: '#f0b429', dirt: '#282d31' },
  bridge:   { base: '#7d8894', band: '#252c35', trim: '#161b21', stripe: '#4fa8ff', dirt: '#20262c' },
  airlock:  { base: '#a4a9aa', band: '#4a5054', trim: '#232a2e', stripe: '#e85d2a', dirt: '#333a3e' },
};

/** A wall tile: 1.35 m wide, one storey (2.7 m) tall. */
function paintWall(style, pxPerM, seed, cargo) {
  const P = PALETTE[style] || PALETTE.corridor;
  const L = new Layers(1.35, 2.7, pxPerM, seed);
  L.fill({ c: P.base, h: 130, r: 0.62, m: 0.05 });
  if (cargo) {
    // corrugated cargo-bay skin: vertical ribs every 0.15 m
    for (let i = 0; i < 9; i++) {
      L.rect(i * 0.15, 0, 0.075, 2.7, { c: shade(P.base, 1.12), h: 190, r: 0.5, m: 0.25 });
      L.rect(i * 0.15 + 0.075, 0, 0.075, 2.7, { c: shade(P.base, 0.86), h: 70, r: 0.7, m: 0.2 });
    }
    L.rect(0, 2.6, 1.35, 0.1, { c: P.trim, h: 210, r: 0.4, m: 0.7 });
    L.rect(0, 0, 1.35, 0.12, { c: P.trim, h: 210, r: 0.4, m: 0.7 });
    L.rect(0, 0.12, 1.35, 0.06, { c: P.stripe, h: 150, r: 0.5, m: 0.1 });
    L.streaks(24, 0.03, 0.3, 1.4, { c: P.dirt, a: 0.14 });
    L.speckle(700, 0.004, 0.014, { c: '#1a1f22', a: 0.35, jitter: 1 });
    return L.finish(2.6);
  }
  // upper and lower panels with a rail between
  const seam = (x) => { L.rect(x - 0.004, 0.18, 0.008, 2.42, { c: shade(P.base, 0.55), h: 30, r: 0.8, m: 0.1 }); };
  seam(0.0); seam(0.675);
  // a panel that sits slightly proud
  L.rect(0.02, 1.0, 0.63, 1.56, { c: shade(P.base, 1.05), h: 150, r: 0.55, m: 0.05, a: 0.9 });
  L.rect(0.695, 1.0, 0.63, 1.56, { c: shade(P.base, 0.98), h: 146, r: 0.55, m: 0.05, a: 0.9 });
  // lower band (kick plate) and rail
  L.rect(0, 0.0, 1.35, 0.16, { c: P.trim, h: 205, r: 0.38, m: 0.75 });
  L.rect(0, 0.16, 1.35, 0.72, { c: P.band, h: 120, r: 0.55, m: 0.2 });
  L.rect(0, 0.88, 1.35, 0.045, { c: P.trim, h: 215, r: 0.35, m: 0.8 });
  L.rect(0, 0.925, 1.35, 0.02, { c: P.stripe, h: 170, r: 0.45, m: 0.1 });
  // crown
  L.rect(0, 2.56, 1.35, 0.14, { c: P.trim, h: 205, r: 0.4, m: 0.7 });
  L.rect(0, 2.56, 1.35, 0.012, { c: shade(P.trim, 1.6), h: 230, r: 0.3, m: 0.8 });
  // hazard chevrons on engineering / workshop lower band
  if (style === 'engineering' || style === 'workshop' || style === 'airlock') {
    for (let i = -2; i < 12; i++) {
      const x = i * 0.13;
      L.rect(x, 0.2, 0.065, 0.66, { c: '#e8b32a', h: 140, r: 0.5, m: 0.1, a: 0.85 });
    }
    L.rect(0, 0.16, 1.35, 0.04, { c: P.trim, h: 190, r: 0.4, m: 0.6 });
    L.rect(0, 0.84, 1.35, 0.04, { c: P.trim, h: 190, r: 0.4, m: 0.6 });
  }
  // fasteners along the seams and rail
  for (const x of [0.0, 0.675]) {
    for (let y = 0.3; y < 2.55; y += 0.28) {
      L.dot(x + 0.018, y, 0.007, { c: shade(P.base, 0.4), h: 215, r: 0.3, m: 0.9 });
      L.dot(x - 0.018, y, 0.007, { c: shade(P.base, 0.4), h: 215, r: 0.3, m: 0.9 });
    }
  }
  // wear: darker near the floor, grime streaks, scuffs where shoulders touch
  L.gradV(0.0, 0.5, P.dirt, P.base, 0.55, 0.0);
  L.streaks(16, 0.03, 0.3, 1.1, { c: P.dirt, a: 0.13 });
  L.rect(0.3, 1.1, 0.35, 0.35, { c: shade(P.base, 1.1), h: 128, r: 0.35, m: 0.05, a: 0.05 });
  L.speckle(500, 0.004, 0.012, { c: '#20262a', a: 0.35, jitter: 1 });
  L.speckle(180, 0.004, 0.01, { c: '#e9edf0', a: 0.35, jitter: 1, r: 0.3 });
  return L.finish(2.4);
}

function shade(hex, k) {
  const c = new THREE.Color(hex);
  c.r = Math.min(1, c.r * k); c.g = Math.min(1, c.g * k); c.b = Math.min(1, c.b * k);
  return '#' + c.getHexString();
}

/** A 2 m floor tile. */
function paintFloor(kind, pxPerM, seed) {
  const L = new Layers(2, 2, pxPerM, seed);
  if (kind === 'grate') {
    L.fill({ c: '#171a1d', h: 40, r: 0.7, m: 0.4 });
    // bearing bars and cross bars, with dark voids between
    const pitch = 0.04;
    for (let i = 0; i < 50; i++) {
      L.rect(i * pitch, 0, 0.016, 2, { c: '#7a8288', h: 225, r: 0.42, m: 0.85 });
    }
    for (let j = 0; j < 12; j++) L.rect(0, j * 0.166, 2, 0.02, { c: '#6c747a', h: 210, r: 0.45, m: 0.85 });
    // frame every metre
    for (const p of [0, 1]) {
      L.rect(p - 0.03, 0, 0.06, 2, { c: '#3d444a', h: 235, r: 0.35, m: 0.8 });
      L.rect(0, p - 0.03, 2, 0.06, { c: '#3d444a', h: 235, r: 0.35, m: 0.8 });
    }
    L.streaks(10, 0.05, 0.3, 1.0, { c: '#0c0e10', a: 0.2 });
    L.speckle(300, 0.006, 0.02, { c: '#a7752f', a: 0.25, jitter: 1 });
    return L.finish(3.0);
  }
  if (kind === 'deck') {
    // rubber tread on steel: diamond plate
    L.fill({ c: '#565d62', h: 110, r: 0.55, m: 0.5 });
    for (let j = 0; j < 20; j++) for (let i = 0; i < 20; i++) {
      const x = i * 0.1 + (j % 2) * 0.05, y = j * 0.1;
      L.rect(x, y, 0.045, 0.02, { c: '#7d858b', h: 210, r: 0.42, m: 0.7 });
      L.rect(x + 0.02, y + 0.03, 0.02, 0.045, { c: '#7d858b', h: 210, r: 0.42, m: 0.7 });
    }
    for (const p of [0, 1]) {
      L.rect(p - 0.012, 0, 0.024, 2, { c: '#252a2e', h: 40, r: 0.7, m: 0.3 });
      L.rect(0, p - 0.012, 2, 0.024, { c: '#252a2e', h: 40, r: 0.7, m: 0.3 });
    }
    L.rect(0.32, 0.05, 0.02, 1.9, { c: '#e0a83c', h: 132, r: 0.55, m: 0.1, a: 0.7 });
    L.streaks(14, 0.06, 0.2, 0.8, { c: '#1a1d20', a: 0.2 });
    L.speckle(400, 0.006, 0.02, { c: '#a7752f', a: 0.2, jitter: 1 });
    return L.finish(1.5);
  }
  if (kind === 'carpet') {
    L.fill({ c: '#3a4149', h: 128, r: 0.95, m: 0 });
    L.speckle(2600, 0.008, 0.024, { c: '#4a525b', a: 0.55, jitter: 1, r: 0.98 });
    L.speckle(1800, 0.008, 0.024, { c: '#2a3036', a: 0.55, jitter: 1, r: 0.98 });
    for (const p of [0, 1]) {
      L.rect(p - 0.01, 0, 0.02, 2, { c: '#242a30', h: 90, r: 0.9, m: 0 });
      L.rect(0, p - 0.01, 2, 0.02, { c: '#242a30', h: 90, r: 0.9, m: 0 });
    }
    return L.finish(1.6);
  }
  if (kind === 'med') {
    L.fill({ c: '#c9d3d6', h: 128, r: 0.35, m: 0 });
    for (const p of [0, 0.5, 1, 1.5]) {
      L.rect(p - 0.006, 0, 0.012, 2, { c: '#8b979b', h: 60, r: 0.6, m: 0 });
      L.rect(0, p - 0.006, 2, 0.012, { c: '#8b979b', h: 60, r: 0.6, m: 0 });
    }
    L.speckle(500, 0.006, 0.02, { c: '#9aa6aa', a: 0.3, jitter: 1 });
    L.rect(0.0, 0.94, 2, 0.12, { c: '#2e8b93', h: 128, r: 0.4, m: 0, a: 0.85 });
    return L.finish(1.4);
  }
  // 'bridge': dark composite with pale guide lines
  L.fill({ c: '#2a3038', h: 128, r: 0.4, m: 0.2 });
  for (const p of [0, 1]) {
    L.rect(p - 0.02, 0, 0.04, 2, { c: '#12161a', h: 60, r: 0.6, m: 0.4 });
    L.rect(0, p - 0.02, 2, 0.04, { c: '#12161a', h: 60, r: 0.6, m: 0.4 });
  }
  L.rect(0.5 - 0.008, 0, 0.016, 2, { c: '#4fa8ff', h: 140, r: 0.3, m: 0.1, a: 0.5 });
  L.speckle(500, 0.006, 0.018, { c: '#3d4650', a: 0.35, jitter: 1 });
  return L.finish(2.0);
}

/** A 1.5 m ceiling tile with a service panel. */
function paintCeiling(pxPerM, seed) {
  const L = new Layers(1.5, 1.5, pxPerM, seed);
  L.fill({ c: '#a3a9ad', h: 130, r: 0.6, m: 0.1 });
  L.rect(0.03, 0.03, 1.44, 1.44, { c: '#b3b9bd', h: 142, r: 0.55, m: 0.1 });
  for (const p of [0, 0.75]) {
    L.rect(p - 0.006, 0, 0.012, 1.5, { c: '#3a4045', h: 40, r: 0.8, m: 0.1 });
    L.rect(0, p - 0.006, 1.5, 0.012, { c: '#3a4045', h: 40, r: 0.8, m: 0.1 });
  }
  for (const [x, y] of [[0.05, 0.05], [1.45, 0.05], [0.05, 1.45], [1.45, 1.45], [0.75, 0.05], [0.75, 1.45]]) {
    L.dot(x, y, 0.008, { c: '#40474c', h: 210, r: 0.3, m: 0.9 });
  }
  L.streaks(8, 0.04, 0.2, 0.7, { c: '#54595c', a: 0.16 });
  L.speckle(200, 0.004, 0.012, { c: '#22282b', a: 0.3, jitter: 1 });
  return L.finish(2.0);
}

/** Painted armour plate for the outside: an 8 m tile, panels of 2 x 1 m. */
function paintHull(pxPerM, seed) {
  const L = new Layers(8, 8, pxPerM, seed);
  const rnd = L.rnd;
  L.fill({ c: '#cfd2cc', h: 130, r: 0.5, m: 0.5 });
  // panels: staggered rows, each with its own slight tint; a few are dark slate
  const tints = ['#d3d6d0', '#cdd0ca', '#d7d9d4', '#cacdc7', '#d0d3cd', '#c8cbc5'];
  const rowH = 1.0;
  for (let j = 0; j < 8; j++) {
    const off = (j % 2) * 1.0;
    for (let i = -1; i < 5; i++) {
      const x = i * 2.0 + off, y = j * rowH;
      const slate = rnd() < 0.04;
      L.rect(x + 0.012, y + 0.012, 1.976, rowH - 0.024,
        { c: slate ? '#8a9198' : tints[Math.floor(rnd() * tints.length)], h: 138 + rnd() * 10, r: 0.46 + rnd() * 0.15, m: 0.5 });
      // panel seam grooves, dark and deep
      L.rect(x, y, 2.0, 0.012, { c: '#454a4e', h: 44, r: 0.8, m: 0.2 });
      L.rect(x, y, 0.012, rowH, { c: '#454a4e', h: 44, r: 0.8, m: 0.2 });
      // rivets along the edges
      for (let k = 0.15; k < 2.0; k += 0.25) {
        L.dot(x + k, y + 0.05, 0.011, { c: '#8f918c', h: 215, r: 0.35, m: 0.85 });
        L.dot(x + k, y + rowH - 0.05, 0.011, { c: '#8f918c', h: 215, r: 0.35, m: 0.85 });
      }
      // an inspection hatch on a few panels
      if (rnd() < 0.14) {
        L.rect(x + 0.5, y + 0.25, 1.0, 0.5, { c: '#b3b6b0', h: 178, r: 0.45, m: 0.6 });
        L.rect(x + 0.5, y + 0.25, 1.0, 0.016, { c: '#23272a', h: 24, r: 0.8, m: 0.2 });
        L.rect(x + 0.5, y + 0.735, 1.0, 0.016, { c: '#23272a', h: 24, r: 0.8, m: 0.2 });
        L.dot(x + 1.0, y + 0.5, 0.05, { c: '#7c7f7a', h: 220, r: 0.35, m: 0.85 });
      }
      // stencilled service marks: a small dark bar and dots
      if (rnd() < 0.22) {
        L.rect(x + 0.2 + rnd() * 0.8, y + 0.4, 0.34, 0.05, { c: '#2b3036', h: 140, r: 0.5, m: 0.1, a: 0.8 });
        L.rect(x + 0.2 + rnd() * 0.8, y + 0.52, 0.2, 0.03, { c: '#2b3036', h: 140, r: 0.5, m: 0.1, a: 0.7 });
      }
      // paint chip: bare metal showing on an edge
      if (rnd() < 0.3) {
        const cx = x + rnd() * 1.8, cy = y + (rnd() < 0.5 ? 0.02 : rowH - 0.05);
        L.rect(cx, cy, 0.05 + rnd() * 0.25, 0.03, { c: '#6f7274', h: 190, r: 0.4, m: 0.9, a: 0.8 });
      }
    }
  }
  // weathering, restrained: pale dust runs from the seams, a few dark stains, scorch near the engines is painted elsewhere
  L.streaks(46, 0.04, 0.4, 2.6, { c: '#a58366', a: 0.08, r: 0.85 });
  L.streaks(30, 0.02, 0.3, 1.4, { c: '#3a3733', a: 0.10, r: 0.7 });
  L.streaks(8, 0.03, 0.2, 0.9, { c: '#7d3d1e', a: 0.10, r: 0.9, m: 0.1 });
  L.speckle(1800, 0.006, 0.026, { c: '#4d4a44', a: 0.22, jitter: 1 });
  L.speckle(1200, 0.006, 0.026, { c: '#f0ece2', a: 0.25, jitter: 1 });
  return L.finish(2.6);
}

/** A sliding door leaf: 1.06 x 2.08 m of painted steel with a hazard edge and a window slit. */
function paintDoor(pxPerM, seed) {
  const L = new Layers(1.1, 2.1, pxPerM, seed);
  L.fill({ c: '#aab1b6', h: 128, r: 0.42, m: 0.7 });
  L.rect(0.06, 0.1, 0.98, 1.9, { c: '#b9c0c5', h: 150, r: 0.4, m: 0.7 });
  for (const x of [0.0, 1.0]) {
    L.rect(x, 0, 0.1, 2.1, { c: '#2b3035', h: 120, r: 0.6, m: 0.3 });
    for (let i = -1; i < 22; i++) L.rect(x + 0.005, i * 0.1, 0.09, 0.05, { c: '#e6b422', h: 130, r: 0.5, m: 0.2 });
  }
  L.rect(0.1, 0, 0.9, 0.22, { c: '#3c4248', h: 190, r: 0.4, m: 0.8 });
  L.rect(0.1, 0.95, 0.9, 0.05, { c: '#3c4248', h: 200, r: 0.4, m: 0.8 });
  L.rect(0.34, 1.42, 0.42, 0.42, { c: '#12232b', h: 60, r: 0.1, m: 0.1 });
  L.rect(0.34, 1.42, 0.42, 0.02, { c: '#5fd8ff', h: 128, r: 0.3, m: 0 });
  L.rect(0.34, 1.82, 0.42, 0.02, { c: '#5fd8ff', h: 128, r: 0.3, m: 0 });
  L.rect(0.42, 1.12, 0.26, 0.09, { c: '#e8eaea', h: 175, r: 0.4, m: 0.1 });
  L.rect(0.46, 1.145, 0.18, 0.012, { c: '#2b3035', h: 140, r: 0.5, m: 0 });
  L.rect(0.46, 1.17, 0.12, 0.012, { c: '#2b3035', h: 140, r: 0.5, m: 0 });
  L.rect(0.82, 0.55, 0.05, 0.3, { c: '#4a5157', h: 40, r: 0.5, m: 0.6 });
  L.streaks(8, 0.03, 0.2, 0.7, { c: '#2a2f33', a: 0.14 });
  L.speckle(200, 0.004, 0.012, { c: '#20262a', a: 0.3, jitter: 1 });
  return L.finish(1.6, false);
}

// (the last six are the raider's doors: src/ships/raider/spec.js)
// fix-r1: build the atlas from the fleet's labels; an unfamiliar room must never become MEDBAY.
export const SIGN_NAMES = ['MEDBAY', 'CREW A', 'LOUNGE', 'GALLEY', 'WORKSHOP', 'CAPTAIN', 'HEAD', 'ENGINEERING', 'AIRLOCK', 'EVA', 'CARGO', 'BRIDGE', 'COCKPIT', 'CREW', 'MESS', 'ARMOURY', 'ENGINE', 'HOLD'];
/** One canvas holding every door sign; each sign is a 512 x 64 cell. */
export function makeSignAtlas(labels = []) {
  const names = [...new Set([...SIGN_NAMES,...labels])];
  const n = names.length;
  const uvFor = (name) => {
    const i = names.indexOf(name);
    if (i < 0) throw new Error('Unregistered door label: ' + name);
    const v0 = 1 - (i + 1) / n, v1 = 1 - i / n;
    return [[0, v0], [1, v0], [1, v1], [0, v1]];
  };
  if (!HAS_DOM) return { material: new THREE.MeshBasicMaterial({ color: 0x3a2a12, vertexColors: true }), uvFor };
  const c = document.createElement('canvas'); c.width = 512; c.height = 64 * n;
  const g = c.getContext('2d');
  names.forEach((name, i) => {
    const y = i * 64;
    g.fillStyle = '#10130f'; g.fillRect(0, y, 512, 64);
    g.strokeStyle = '#ffb45a'; g.lineWidth = 4; g.strokeRect(5, y + 5, 502, 54);
    g.fillStyle = '#ffb45a'; g.font = '700 40px ui-monospace, Consolas, monospace'; g.textBaseline = 'middle'; g.textAlign = 'center';
    g.fillText(name, 266, y + 34, 440);
    g.fillRect(16, y + 20, 12, 24);
    g.beginPath(); g.moveTo(34, y + 20); g.lineTo(50, y + 32); g.lineTo(34, y + 44); g.fill();
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return { material: new THREE.MeshBasicMaterial({ map: t, toneMapped: false, vertexColors: true }), uvFor };
}

/** A sheet of posters and photographs, 8 cells of 256 x 256. */
export const POSTER_COUNT = 8;
export function makePosterAtlas() {
  const uvFor = (i) => {
    const cx = i % 4, cy = Math.floor(i / 4);
    const u0 = cx / 4, u1 = (cx + 1) / 4, v1 = 1 - cy / 2, v0 = 1 - (cy + 1) / 2;
    return [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
  };
  if (!HAS_DOM) return { material: new THREE.MeshStandardMaterial({ color: 0x9a8f7a, vertexColors: true }), uvFor };
  const S = 256;
  const c = document.createElement('canvas'); c.width = S * 4; c.height = S * 2;
  const g = c.getContext('2d');
  const cell = (i) => [(i % 4) * S, Math.floor(i / 4) * S];
  const frame = (x, y, col) => { g.fillStyle = col; g.fillRect(x, y, S, S); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 8; g.strokeRect(x + 4, y + 4, S - 8, S - 8); };
  { // 0: expedition poster
    const [x, y] = cell(0); frame(x, y, '#20120c');
    const gr = g.createRadialGradient(x + 128, y + 120, 10, x + 128, y + 120, 92);
    gr.addColorStop(0, '#f0a070'); gr.addColorStop(0.6, '#c2603a'); gr.addColorStop(1, '#6a2a18');
    g.fillStyle = gr; g.beginPath(); g.arc(x + 128, y + 120, 90, 0, 6.3); g.fill();
    g.fillStyle = '#f0e2c8'; g.font = '700 26px Arial'; g.textAlign = 'center'; g.fillText('MARS EXPEDITION', x + 128, y + 236);
    g.font = '500 14px Arial'; g.fillText('VALLES MARINERIS SURVEY', x + 128, y + 22);
  }
  { // 1: family photograph: silhouettes against a sunset
    const [x, y] = cell(1); frame(x, y, '#e8dcc4');
    const gr = g.createLinearGradient(0, y, 0, y + S); gr.addColorStop(0, '#5a6a9a'); gr.addColorStop(1, '#f2b27a');
    g.fillStyle = gr; g.fillRect(x + 16, y + 16, S - 32, S - 32);
    g.fillStyle = '#1e1a1c';
    for (const [px, h] of [[70, 84], [104, 100], [142, 62], [176, 76]]) { g.beginPath(); g.arc(x + px, y + 156 - h, 15, 0, 6.3); g.fill(); g.fillRect(x + px - 14, y + 170 - h, 28, h - 10); }
    g.fillRect(x + 16, y + 200, S - 32, 40);
  }
  { // 2: safety
    const [x, y] = cell(2); frame(x, y, '#e6b422');
    g.fillStyle = '#20232a'; g.font = '800 30px Arial'; g.textAlign = 'center';
    g.fillText('CLEAR THE', x + 128, y + 76); g.fillText('RAMP BEFORE', x + 128, y + 116); g.fillText('LIFT-OFF', x + 128, y + 156);
    for (let i = 0; i < 8; i++) g.fillRect(x + 20 + i * 28, y + 196, 14, 30);
  }
  { // 3: canyon map
    const [x, y] = cell(3); frame(x, y, '#0d2733');
    g.strokeStyle = '#5fd8ff'; g.lineWidth = 2;
    for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(x + 20, y + 40 + i * 20); g.bezierCurveTo(x + 90, y + 20 + i * 24, x + 170, y + 90 + i * 8, x + 236, y + 60 + i * 16); g.stroke(); }
    g.fillStyle = '#ffb45a'; g.fillRect(x + 118, y + 116, 14, 14);
    g.fillStyle = '#d8f6ff'; g.font = '600 16px monospace'; g.textAlign = 'center'; g.fillText('WE ARE HERE', x + 128, y + 150);
  }
  { // 4: a child's crayon drawing of a ship and a red planet
    const [x, y] = cell(4); frame(x, y, '#f4efe0');
    g.strokeStyle = '#c23a2a'; g.lineWidth = 6; g.beginPath(); g.arc(x + 178, y + 70, 36, 0, 6.3); g.stroke();
    g.strokeStyle = '#2f5fbf'; g.beginPath(); g.moveTo(x + 40, y + 170); g.lineTo(x + 120, y + 150); g.lineTo(x + 170, y + 170); g.lineTo(x + 120, y + 190); g.closePath(); g.stroke();
    g.strokeStyle = '#e6a020'; g.beginPath(); g.moveTo(x + 40, y + 170); g.lineTo(x + 8, y + 160); g.moveTo(x + 40, y + 170); g.lineTo(x + 10, y + 180); g.stroke();
    g.fillStyle = '#2b2b2b'; g.font = '600 22px cursive'; g.textAlign = 'center'; g.fillText('DAD FLYS HERE', x + 128, y + 230);
  }
  { // 5: assay chart
    const [x, y] = cell(5); frame(x, y, '#dfe6ea');
    for (let r = 0; r < 5; r++) for (let q = 0; q < 8; q++) { g.fillStyle = ['#8fb8d8', '#d8a86a', '#9ec59a', '#c78f8f'][(r + q) % 4]; g.fillRect(x + 18 + q * 27, y + 30 + r * 34, 24, 30); }
    g.fillStyle = '#20232a'; g.font = '700 16px Arial'; g.textAlign = 'center'; g.fillText('REGOLITH ASSAY', x + 128, y + 232);
  }
  { // 6: airlock procedure
    const [x, y] = cell(6); frame(x, y, '#20272d');
    g.fillStyle = '#e85d2a'; g.fillRect(x + 16, y + 16, S - 32, 34);
    g.fillStyle = '#fff'; g.font = '800 22px Arial'; g.textAlign = 'center'; g.fillText('AIRLOCK CYCLE', x + 128, y + 41);
    g.fillStyle = '#d8dee2'; g.font = '500 17px monospace'; g.textAlign = 'left';
    ['1 SEAL INNER', '2 PUMP DOWN', '3 OPEN OUTER', '4 EXIT', '5 REPEAT IN'].forEach((t, i) => g.fillText(t, x + 30, y + 92 + i * 28));
  }
  { // 7: hydrate
    const [x, y] = cell(7); frame(x, y, '#2a6fa8');
    g.fillStyle = '#e8f6ff'; g.beginPath(); g.moveTo(x + 128, y + 40); g.bezierCurveTo(x + 200, y + 120, x + 190, y + 190, x + 128, y + 190); g.bezierCurveTo(x + 66, y + 190, x + 56, y + 120, x + 128, y + 40); g.fill();
    g.font = '800 26px Arial'; g.textAlign = 'center'; g.fillText('DRINK WATER', x + 128, y + 232);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return { material: new THREE.MeshStandardMaterial({ map: t, roughness: 0.7, metalness: 0, vertexColors: true }), uvFor };
}

/** Small tileable scratched-metal detail for props. */
function paintMetal(pxPerM, seed, tone) {
  const L = new Layers(1, 1, pxPerM, seed);
  L.fill({ c: tone, h: 128, r: 0.45, m: 0.8 });
  for (let i = 0; i < 60; i++) {
    const y = L.rnd() * 1.0;
    L.rect(0, y, 1, 0.002 + L.rnd() * 0.004, { c: shade(tone, 1.25), h: 128 + (L.rnd() - 0.5) * 60, r: 0.35, m: 0.9, a: 0.35 });
  }
  L.speckle(500, 0.004, 0.015, { c: shade(tone, 0.6), a: 0.35, jitter: 1 });
  return L.finish(1.4);
}

/** Fabric weave, for seats and mattresses. */
function paintFabric(pxPerM, seed, tone) {
  const L = new Layers(0.4, 0.4, pxPerM, seed);
  L.fill({ c: tone, h: 128, r: 0.95, m: 0 });
  for (let i = 0; i < 40; i++) {
    L.rect(i * 0.01, 0, 0.005, 0.4, { c: shade(tone, 1.15), h: 150, r: 0.98, m: 0, a: 0.5 });
    L.rect(0, i * 0.01, 0.4, 0.005, { c: shade(tone, 0.85), h: 110, r: 0.98, m: 0, a: 0.5 });
  }
  return L.finish(1.2);
}

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------

/**
 * Build every material the ship uses.
 * @param {object} o  { tier: 'high'|'low', envInterior, envExterior }
 */
export function makeShipMaterials(o = {}) {
  const low = o.tier === 'low' || o.tier === 'safe';
  const px = low ? 96 : 192;             // pixels per metre for room surfaces
  const pxHull = low ? 40 : 72;
  const mats = {};
  const lit = (params, tex, tile) => {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, ...params });
    if (tex) {
      m.map = tex.albedo; m.normalMap = tex.normal;
      m.roughnessMap = tex.orm; m.metalnessMap = tex.orm;
      m.roughness = 1; m.metalness = 1;
      m.normalScale = new THREE.Vector2(0.9, 0.9);
    }
    return m;
  };

  const tex = {};
  if (HAS_DOM && o.tier !== 'safe') {
    let seed = 11;
    for (const style of Object.keys(PALETTE)) {
      tex['wall:' + style] = paintWall(style, px, seed++, style === 'cargo');
    }
    tex['floor:grate'] = paintFloor('grate', px * 1.0, 31);
    tex['floor:deck'] = paintFloor('deck', px * 1.0, 32);
    tex['floor:carpet'] = paintFloor('carpet', px * 0.45, 33);
    tex['floor:med'] = paintFloor('med', px * 0.5, 34);
    tex['floor:bridge'] = paintFloor('bridge', px * 0.5, 35);
    tex['ceil'] = paintCeiling(px * 0.6, 41);
    tex['hull'] = paintHull(pxHull, 51);
    tex['door'] = paintDoor(px * 0.8, 71);
    tex['metalDark'] = paintMetal(px * 0.5, 61, '#454c52');
    tex['metalBright'] = paintMetal(px * 0.5, 62, '#a4acb2');
    tex['fabricBlue'] = paintFabric(px * 0.6, 63, '#39506b');
    tex['fabricGrey'] = paintFabric(px * 0.6, 64, '#5b626a');
    tex['leather'] = paintFabric(px * 0.6, 65, '#6a4a37');
  }
  for (const key of Object.keys(PALETTE)) {
    mats['wall:' + key] = lit({ side: THREE.FrontSide }, tex['wall:' + key]);
    if (!HAS_DOM) mats['wall:' + key].color = new THREE.Color(PALETTE[key].base);
  }
  const floorFor = { grate: 0x2a2f33, deck: 0x565d62, carpet: 0x3a4149, med: 0xc9d3d6, bridge: 0x2a3038 };
  for (const k of Object.keys(floorFor)) {
    mats['floor:' + k] = lit({}, tex['floor:' + k]);
    if (!HAS_DOM) mats['floor:' + k].color = new THREE.Color(floorFor[k]);
  }
  mats.ceil = lit({}, tex.ceil); if (!HAS_DOM) mats.ceil.color = new THREE.Color(0xa3a9ad);

  const plain = (color, rough, metal, extra = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, vertexColors: true, ...extra });
    return m;
  };
  const withNormal = (m, t, s = 0.6, albedo = false) => {
    if (t) {
      m.normalMap = t.normal; m.roughnessMap = t.orm; m.metalnessMap = t.orm; m.normalScale = new THREE.Vector2(s, s);
      if (albedo) m.map = t.albedo;
    }
    return m;
  };
  mats.steel = withNormal(plain(0xb5bcc2, 1, 1), tex.metalBright);
  mats.steelDark = withNormal(plain(0x6a727a, 1, 1), tex.metalDark);
  mats.gunmetal = withNormal(plain(0x40464c, 1, 1), tex.metalDark);
  mats.rubber = plain(0x1c1e20, 0.92, 0.0);
  mats.plastic = plain(0xd6d9d6, 0.42, 0.0);
  mats.plasticDark = plain(0x2b3035, 0.5, 0.05);
  mats.white = plain(0xe9ecec, 0.4, 0.05);
  mats.fabricBlue = withNormal(plain(0xffffff, 1, 0), tex.fabricBlue, 0.7, true);
  mats.fabricGrey = withNormal(plain(0xffffff, 1, 0), tex.fabricGrey, 0.7, true);
  mats.leather = withNormal(plain(0xffffff, 1, 0), tex.leather, 0.5, true);
  mats.mattress = withNormal(plain(0xd9d3c4, 1, 0), tex.fabricGrey, 0.5);
  mats.blanket = withNormal(plain(0x8a3b2e, 1, 0), tex.fabricGrey, 0.6);
  mats.hazard = plain(0xe8b32a, 0.55, 0.1);
  mats.red = plain(0xb3372b, 0.5, 0.15);
  mats.pipeRed = plain(0xa8322a, 0.4, 0.5);
  mats.pipeBlue = plain(0x2c5f9e, 0.4, 0.5);
  mats.pipeYellow = plain(0xd7a627, 0.4, 0.5);
  mats.pipeSteel = plain(0x9aa2a8, 0.35, 0.85);
  mats.copper = plain(0xb0703a, 0.3, 0.9);
  mats.crateA = plain(0x6b7c68, 0.7, 0.3);
  mats.crateB = plain(0x8d7a52, 0.75, 0.25);
  mats.crateC = plain(0x5a6f86, 0.7, 0.3);
  mats.wood = plain(0x8a6a48, 0.75, 0);
  mats.tile = plain(0xdfe4e2, 0.3, 0);
  // The merged finishes (see ALIAS in shipKit.js): colour comes from the vertices.
  mats.metal = withNormal(plain(0xffffff, 1, 1), tex.metalBright, 0.6);
  mats.paint = plain(0xffffff, 0.5, 0.06);
  mats.fabric = withNormal(plain(0xffffff, 1, 0), tex.fabricGrey, 0.7, true);
  mats.glow = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, toneMapped: false });
  mats.door = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 1 });
  if (tex.door) {
    mats.door.map = tex.door.albedo; mats.door.normalMap = tex.door.normal;
    mats.door.roughnessMap = tex.door.orm; mats.door.metalnessMap = tex.door.orm; mats.door.normalScale = new THREE.Vector2(0.8, 0.8);
  } else mats.door.color.setHex(0xa6adb2);
  mats.counter = plain(0x2b3237, 0.35, 0.3);

  // Emissives (never lit, never tone mapped, so they read as light sources)
  const glow = (c, i = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(i), toneMapped: false, vertexColors: true });
  mats.glowWhite = glow(0xfff4e0, 1.25);
  mats.glowCool = glow(0xdfeaff, 1.2);
  mats.glowAmber = glow(0xffa64a, 1.1);
  mats.glowCyan = glow(0x59d8ff, 1.1);
  mats.glowRed = glow(0xff4a3a, 1.1);
  mats.glowGreen = glow(0x5cff9a, 1.0);
  mats.glowBlue = glow(0x4fa8ff, 1.1);
  // The reactor core is animated.
  mats.reactor = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x66e0ff).multiplyScalar(1.4), toneMapped: false, transparent: true, opacity: 0.88 });

  // Glass
  mats.glass = new THREE.MeshPhysicalMaterial({
    color: 0x9fc4d6, roughness: 0.04, metalness: 0.0, transmission: 0.0, transparent: true, opacity: 0.16,
    side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.4,
  });
  mats.glassTint = new THREE.MeshStandardMaterial({
    color: 0x87b6ca, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.22,
    side: THREE.DoubleSide, depthWrite: false,
  });

  // Hull (outside, lit by the sun)
  mats.hull = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 1 });
  if (tex.hull) {
    mats.hull.map = tex.hull.albedo; mats.hull.normalMap = tex.hull.normal;
    mats.hull.roughnessMap = tex.hull.orm; mats.hull.metalnessMap = tex.hull.orm;
    mats.hull.normalScale = new THREE.Vector2(1.1, 1.1);
  } else { mats.hull.color = new THREE.Color(0xb7b9b3); mats.hull.roughness = 0.55; mats.hull.metalness = 0.5; }
  mats.hullDark = plain(0x3c4248, 0.55, 0.6);
  mats.hullAccent = plain(0xc8632c, 0.5, 0.35);
  mats.hullStripe = plain(0xe0a83c, 0.5, 0.3);
  mats.engine = plain(0x2b2f33, 0.35, 0.9);
  mats.engineGlow = new THREE.MeshBasicMaterial({ color: 0x9fdcff, toneMapped: false, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  mats.nozzleInner = new THREE.MeshBasicMaterial({ color: 0xffb066, toneMapped: false, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });

  for (const key of Object.keys(mats)) enableDepthLift(mats[key]);
  mats._textures = tex;
  return mats;
}

/**
 * DEPTH LIFT. Faces the kit found sharing a plane with another face carry an `aLift` layer number
 * (shipKit.js, resolveDepthLayers); this pulls a layer-n face n buffer steps toward the camera so the
 * two never fight. One shared uniform holds the step in clip-space units; ShipSystem sets it from the
 * real depth buffer's bit count (a phone may give 16 bits where a laptop gives 24).
 */
export const DEPTH_LIFT = { value: 4e-6 };
export function depthLiftStepFor(bits) {
  // one layer = 3 buffer steps (clip z spans 2 units over 2^bits steps), never below what float maths can resolve
  return Math.max(3 * 2 / Math.pow(2, bits || 16), 6e-7);
}
export function enableDepthLift(m) {
  if (!m || !(m.isMeshStandardMaterial || m.isMeshBasicMaterial || m.isMeshPhysicalMaterial)) return m;
  if (m.transparent) return m;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uLiftStep = DEPTH_LIFT;
    sh.vertexShader = sh.vertexShader
      .replace('void main() {', ['attribute float aLift;', 'uniform float uLiftStep;', 'void main() {'].join('\n'))
      .replace('#include <project_vertex>', ['#include <project_vertex>', '\tgl_Position.z -= aLift * uLiftStep * gl_Position.w;'].join('\n'));
  };
  m.customProgramCacheKey = () => 'shipDepthLift1';
  return m;
}

/** Give every lit material a reflection environment. */
export function applyEnvironment(mats, env, intensity = 1) {
  for (const k of Object.keys(mats)) {
    const m = mats[k];
    if (m && m.isMeshStandardMaterial) { m.envMap = env; m.envMapIntensity = intensity; m.needsUpdate = true; }
  }
}

export { mulberry, Layers, PALETTE };
