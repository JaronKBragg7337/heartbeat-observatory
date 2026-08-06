/* ============================================================================
   textures.js — procedural PBR-ish material library
   Every texture is drawn to a 2D canvas, so the build is offline and
   deterministic. RGB = albedo (sRGB), A = per-texel roughness modulation.
   Micro detail lives here: grain, pores, chips, scratches, rust, dust.

   TEXEL DENSITY: each material declares `world` = metres covered by the full
   texture. geom.js derives UVs from world position / world, so texel density
   is consistent by construction across the whole town (px/m = size / world).
   ========================================================================== */
(function () {
"use strict";
const T = window.TOWN;
const M = (T.Mats = {});
const R = T.rng;

function cv(size) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  return c;
}
function noise(ctx, size, amt, mono, alpha) {
  const im = ctx.getImageData(0, 0, size, size), d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amt * 255;
    if (mono) { d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    else { d[i] += n; d[i + 1] += (Math.random() - 0.5) * amt * 255; d[i + 2] += (Math.random() - 0.5) * amt * 255; }
    if (alpha !== undefined) d[i + 3] = alpha * 255 + (Math.random() - 0.5) * 40;
  }
  ctx.putImageData(im, 0, 0);
}
/* value-noise blotches — kills flat areas and breaks up tiling at macro scale */
function blotch(ctx, size, n, rad, col, a0, a1) {
  for (let i = 0; i < n; i++) {
    const x = Math.random() * size, y = Math.random() * size, r = rad * (0.4 + Math.random());
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const a = a0 + Math.random() * (a1 - a0);
    g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
  }
}
function scratches(ctx, size, n, w, a) {
  ctx.save(); ctx.lineCap = "round";
  for (let i = 0; i < n; i++) {
    ctx.strokeStyle = `rgba(255,255,255,${a * (0.3 + Math.random())})`;
    ctx.lineWidth = w * (0.4 + Math.random());
    const x = Math.random() * size, y = Math.random() * size, an = Math.random() * 6.28, l = size * (0.02 + Math.random() * 0.12);
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(an) * l * 0.5 + (Math.random() - .5) * 6, y + Math.sin(an) * l * 0.5 + (Math.random() - .5) * 6,
                         x + Math.cos(an) * l, y + Math.sin(an) * l);
    ctx.stroke();
  }
  ctx.restore();
}
/* write a roughness value into the alpha channel over the whole texture,
   modulated by luminance so darker (dirty / worn) pixels read rougher */
function bakeRough(ctx, size, base, lumInfluence, jitter) {
  const im = ctx.getImageData(0, 0, size, size), d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255;
    let r = base + (0.5 - lum) * lumInfluence + (Math.random() - 0.5) * jitter;
    d[i + 3] = Math.max(0, Math.min(255, r * 255));
  }
  ctx.putImageData(im, 0, 0);
}

/* ---------------------------------------------------------------- upload -- */
function upload(canvas, wrap) {
  const gl = T.GL.gl, tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  const w = wrap === false ? gl.CLAMP_TO_EDGE : gl.REPEAT;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, w);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, w);
  if (T.GL.aniso) gl.texParameterf(gl.TEXTURE_2D, T.GL.aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, T.GL.maxAniso));
  return tex;
}

/* ============================================================ generators == */
const G = {

/* lap siding — 6" exposure boards, nail heads, board seams, weather streaks */
siding(s) {
  const c = cv(s), x = c.getContext("2d");
  x.fillStyle = "#d9d5cc"; x.fillRect(0, 0, s, s);
  const rows = 12, h = s / rows;                     // world 2.0m => 0.167m exposure
  for (let i = 0; i < rows; i++) {
    const y = i * h, t = 0.94 + Math.random() * 0.09;
    x.fillStyle = `rgba(255,255,255,${(t - 1) * 2 + 0.06})`; x.fillRect(0, y, s, h);
    // wood grain along the board
    for (let g = 0; g < 26; g++) {
      x.strokeStyle = `rgba(120,110,96,${0.03 + Math.random() * 0.05})`;
      x.lineWidth = 0.6 + Math.random();
      x.beginPath();
      const gy = y + Math.random() * h;
      x.moveTo(0, gy);
      for (let px = 0; px < s; px += 24) x.lineTo(px, gy + Math.sin(px * 0.05 + g) * 1.1);
      x.stroke();
    }
    // shadow line under the lap + highlight on the leading edge
    x.fillStyle = "rgba(40,36,30,.34)"; x.fillRect(0, y + h - 2.5, s, 2.5);
    x.fillStyle = "rgba(255,255,255,.30)"; x.fillRect(0, y, s, 1);
    // nail heads on stud spacing (406mm o.c.)
    for (let n = 0; n < 5; n++) {
      const nx = n * (s / 5) + 6 + Math.random() * 3, ny = y + h * 0.35;
      x.fillStyle = "rgba(70,64,55,.5)"; x.beginPath(); x.arc(nx, ny, 1.5, 0, 6.3); x.fill();
      x.fillStyle = "rgba(255,255,255,.3)"; x.beginPath(); x.arc(nx - .5, ny - .5, .8, 0, 6.3); x.fill();
    }
  }
  // butt joints between board runs (panel seams)
  for (let i = 0; i < 5; i++) {
    const jx = Math.random() * s, r = (Math.random() * rows) | 0;
    x.fillStyle = "rgba(50,45,38,.4)"; x.fillRect(jx, r * h, 1.5, h);
  }
  blotch(x, s, 26, s * 0.22, "150,146,132", 0.02, 0.09);   // anti-tile macro variation
  blotch(x, s, 10, s * 0.1, "90,84,70", 0.03, 0.10);       // dirt accumulation
  noise(x, s, 0.05, true);
  bakeRough(x, s, 0.68, 0.22, 0.07);
  return { c, world: 2.0, rough: 1.0, metal: 0.0 };
},

/* running-bond brick with mortar, chips and efflorescence */
brick(s) {
  const c = cv(s), x = c.getContext("2d");
  x.fillStyle = "#b9b2a6"; x.fillRect(0, 0, s, s);       // mortar
  const rows = 10, bh = s / rows, bw = s / 4;             // world 2.0m => 200x100mm brick
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * bw * 0.5;
    for (let b = -1; b < 5; b++) {
      const bx = b * bw + off + 2.5, by = r * bh + 2.5, w = bw - 5, h = bh - 5;
      const v = 0.86 + Math.random() * 0.28;
      x.fillStyle = `rgb(${(150 * v) | 0},${(84 * v) | 0},${(66 * v) | 0})`;
      x.fillRect(bx, by, w, h);
      // face grit
      for (let g = 0; g < 40; g++) {
        x.fillStyle = `rgba(${Math.random() > .5 ? 255 : 0},${Math.random() > .5 ? 240 : 0},200,${0.04 + Math.random() * 0.06})`;
        x.fillRect(bx + Math.random() * w, by + Math.random() * h, 1.6, 1.6);
      }
      // chipped corners (edge wear)
      if (Math.random() < 0.16) {
        x.fillStyle = "rgba(185,178,166,.85)";
        x.beginPath(); x.arc(bx + (Math.random() < .5 ? 0 : w), by + (Math.random() < .5 ? 0 : h), 2 + Math.random() * 3, 0, 6.3); x.fill();
      }
      x.fillStyle = "rgba(0,0,0,.16)"; x.fillRect(bx, by + h - 1.5, w, 1.5);
      x.fillStyle = "rgba(255,255,255,.10)"; x.fillRect(bx, by, w, 1);
    }
  }
  blotch(x, s, 18, s * 0.25, "120,110,100", 0.03, 0.10);
  blotch(x, s, 8, s * 0.12, "230,230,225", 0.02, 0.08);   // efflorescence
  noise(x, s, 0.07, true);
  bakeRough(x, s, 0.86, 0.12, 0.08);
  return { c, world: 2.0, rough: 1.0, metal: 0.0 };
},

/* three-tab asphalt shingle with granules, tab shadows, streaking */
shingle(s) {
  const c = cv(s), x = c.getContext("2d");
  x.fillStyle = "#4a4d52"; x.fillRect(0, 0, s, s);
  const courses = 8, ch = s / courses;                    // world 2.4m => 300mm exposure
  for (let r = 0; r < courses; r++) {
    const y = r * ch, off = (r % 2) * (s / 6);
    const v = 0.92 + Math.random() * 0.16;
    x.fillStyle = `rgb(${(70 * v) | 0},${(73 * v) | 0},${(79 * v) | 0})`;
    x.fillRect(0, y, s, ch);
    for (let t = -1; t < 7; t++) {                        // tab slots
      const tx = t * (s / 6) + off;
      x.fillStyle = "rgba(15,16,18,.75)"; x.fillRect(tx, y + ch * 0.42, 2.5, ch * 0.58);
    }
    x.fillStyle = "rgba(10,11,13,.55)"; x.fillRect(0, y + ch - 2, s, 2);   // course shadow
    x.fillStyle = "rgba(255,255,255,.05)"; x.fillRect(0, y, s, 1.2);
  }
  for (let i = 0; i < 9000; i++) {                        // granules
    const g = 40 + Math.random() * 90;
    x.fillStyle = `rgba(${g | 0},${(g * (0.93 + Math.random() * .16)) | 0},${(g * 0.95) | 0},.5)`;
    x.fillRect(Math.random() * s, Math.random() * s, 1.5, 1.5);
  }
  for (let i = 0; i < 14; i++) {                          // algae / water streaks (weathering decal)
    const sx = Math.random() * s;
    const g = x.createLinearGradient(sx, 0, sx, s);
    g.addColorStop(0, "rgba(30,40,35,0)"); g.addColorStop(1, "rgba(28,38,33,.35)");
    x.fillStyle = g; x.fillRect(sx, 0, 6 + Math.random() * 22, s);
  }
  noise(x, s, 0.09, true);
  bakeRough(x, s, 0.9, 0.1, 0.09);
  return { c, world: 2.4, rough: 1.0, metal: 0.0 };
},

/* standing seam metal roof */
metalRoof(s) {
  const c = cv(s), x = c.getContext("2d");
  x.fillStyle = "#7d8790"; x.fillRect(0, 0, s, s);
  const ribs = 6, rw = s / ribs;                          // world 2.4m => 400mm pans
  for (let i = 0; i < ribs; i++) {
    const rx = i * rw;
    const g = x.createLinearGradient(rx, 0, rx + rw, 0);
    g.addColorStop(0, "rgba(255,255,255,.16)"); g.addColorStop(.12, "rgba(0,0,0,.16)");
    g.addColorStop(.5, "rgba(255,255,255,.05)"); g.addColorStop(1, "rgba(0,0,0,.10)");
    x.fillStyle = g; x.fillRect(rx, 0, rw, s);
    x.fillStyle = "rgba(255,255,255,.28)"; x.fillRect(rx, 0, 2.5, s);       // seam highlight
    x.fillStyle = "rgba(20,24,28,.5)"; x.fillRect(rx + 3, 0, 1.5, s);       // seam shadow
  }
  for (let i = 0; i < 8; i++) {                                            // rust bloom at fasteners
    const rx = Math.random() * s, ry = Math.random() * s;
    const g = x.createRadialGradient(rx, ry, 0, rx, ry, 10 + Math.random() * 14);
    g.addColorStop(0, "rgba(122,64,28,.5)"); g.addColorStop(1, "rgba(122,64,28,0)");
    x.fillStyle = g; x.beginPath(); x.arc(rx, ry, 24, 0, 6.3); x.fill();
  }
  scratches(x, s, 60, 1.1, 0.10);
  noise(x, s, 0.04, true);
  bakeRough(x, s, 0.34, 0.30, 0.10);
  return { c, world: 2.4, rough: 1.0, metal: 0.85 };
},

/* painted trim / doors / fascia — enamel with chips down to primer */
paint(s) {
  const c = cv(s), x = c.getContext("2d");
  x.fillStyle = "#efeeea"; x.fillRect(0, 0, s, s);
  for (let i = 0; i < 40; i++) {                          // brush strokes
    x.strokeStyle = `rgba(${Math.random() > .5 ? 255 : 205},255,250,${0.03 + Math.random() * .05})`;
    x.lineWidth = 2 + Math.random() * 5;
    const y = Math.random() * s; x.beginPath(); x.moveTo(0, y); x.lineTo(s, y + (Math.random() - .5) * 8); x.stroke();
  }
  for (let i = 0; i < 60; i++) {                          // paint chips → primer
    x.fillStyle = `rgba(${150 + Math.random() * 30 | 0},${140 + Math.random() * 30 | 0},125,${0.2 + Math.random() * .5})`;
    const px = Math.random() * s, py = Math.random() * s, r = 1 + Math.random() * 3.5;
    x.beginPath(); x.ellipse(px, py, r, r * (0.5 + Math.random()), Math.random() * 3, 0, 6.3); x.fill();
  }
  blotch(x, s, 12, s * 0.2, "160,158,150", 0.02, 0.07);
  scratches(x, s, 30, 0.9, 0.06);
  noise(x, s, 0.03, true);
  bakeRough(x, s, 0.38, 0.28, 0.07);
  return { c, world: 1.2, rough: 1.0, metal: 0.0 };
},

/* interior wall paint / drywall — roller stipple, scuffs near the floor */
drywall(s) {
  const c = cv(s), x = c.getContext("2d");
  x.fillStyle = "#f2efe9"; x.fillRect(0, 0, s, s);
  for (let i = 0; i < 2600; i++) {                        // roller stipple
    x.fillStyle = `rgba(0,0,0,${0.012 + Math.random() * 0.02})`;
    x.beginPath(); x.arc(Math.random() * s, Math.random() * s, 0.8 + Math.random() * 1.6, 0, 6.3); x.fill();
  }
  blotch(x, s, 10, s * 0.3, "180,175,165", 0.02, 0.05);
  for (let i = 0; i < 10; i++) {                          // scuffs
    x.strokeStyle = `rgba(90,86,78,${0.04 + Math.random() * .08})`; x.lineWidth = 1 + Math.random() * 3;
    const px = Math.random() * s, py = Math.random() * s;
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + (Math.random() - .5) * 40, py + (Math.random() - .5) * 12); x.stroke();
  }
  noise(x, s, 0.025, true);
  bakeRough(x, s, 0.82, 0.14, 0.06);
  return { c, world: 2.0, rough: 1.0, metal: 0.0 };
},

/* same surface as drywall, but its own material so the x-ray camera can drop
   every ceiling in one go without touching the walls */
ceiling(s) { return G.drywall(s); },

/* wood plank floor / decking */
wood(s) {
  const c = cv(s), x = c.getContext("2d");
  x.fillStyle = "#9a6b40"; x.fillRect(0, 0, s, s);
  const planks = 6, pw = s / planks;                      // world 1.6m => 267mm boards
  for (let i = 0; i < planks; i++) {
    const px = i * pw, v = 0.84 + Math.random() * 0.34;
    x.fillStyle = `rgb(${(154 * v) | 0},${(107 * v) | 0},${(64 * v) | 0})`;
    x.fillRect(px, 0, pw, s);
    for (let g = 0; g < 46; g++) {                        // grain
      x.strokeStyle = `rgba(${70 + Math.random() * 40 | 0},${44 + Math.random() * 24 | 0},22,${0.05 + Math.random() * .13})`;
      x.lineWidth = 0.5 + Math.random() * 1.6;
      const gx = px + Math.random() * pw;
      x.beginPath(); x.moveTo(gx, 0);
      for (let py = 0; py < s; py += 18) x.lineTo(gx + Math.sin(py * 0.03 + g) * 2.4, py);
      x.stroke();
    }
    for (let k = 0; k < 2; k++) {                         // knots
      if (Math.random() > 0.55) continue;
      const kx = px + pw * (0.2 + Math.random() * 0.6), ky = Math.random() * s;
      for (let rr = 7; rr > 0; rr--) {
        x.strokeStyle = `rgba(60,36,18,${0.08 + rr * 0.03})`; x.lineWidth = 1;
        x.beginPath(); x.ellipse(kx, ky, rr * 1.4, rr * 2.1, 0.4, 0, 6.3); x.stroke();
      }
    }
    x.fillStyle = "rgba(30,18,8,.5)"; x.fillRect(px, 0, 1.6, s);           // plank seam
    x.fillStyle = "rgba(255,225,190,.10)"; x.fillRect(px + 1.6, 0, 1, s);
    if (Math.random() < .5) { x.fillStyle = "rgba(30,18,8,.45)"; x.fillRect(px, Math.random() * s, pw, 1.4); } // butt joint
  }
  blotch(x, s, 14, s * 0.24, "60,38,18", 0.02, 0.08);     // traffic wear
  noise(x, s, 0.04, true);
  bakeRough(x, s, 0.42, 0.3, 0.1);
  return { c, world: 1.6, rough: 1.0, metal: 0.0 };
},

/* poured concrete — sidewalk, foundation, kerb */
concrete(s) {
  const c = cv(s), x = c.getContext("2d");
  x.fillStyle = "#b4b2ad"; x.fillRect(0, 0, s, s);
  for (let i = 0; i < 5000; i++) {                        // pores + aggregate
    const g = Math.random() > 0.5 ? 60 : 210;
    x.fillStyle = `rgba(${g},${g},${g - 5},${0.03 + Math.random() * 0.12})`;
    x.beginPath(); x.arc(Math.random() * s, Math.random() * s, 0.5 + Math.random() * 2.2, 0, 6.3); x.fill();
  }
  blotch(x, s, 22, s * 0.26, "120,120,116", 0.02, 0.10);  // stains
  for (let i = 0; i < 5; i++) {                           // hairline cracks
    x.strokeStyle = `rgba(60,58,54,${0.14 + Math.random() * .2})`; x.lineWidth = 0.8 + Math.random();
    let px = Math.random() * s, py = Math.random() * s;
    x.beginPath(); x.moveTo(px, py);
    for (let k = 0; k < 9; k++) { px += (Math.random() - .5) * 44; py += (Math.random() - .5) * 44; x.lineTo(px, py); }
    x.stroke();
  }
  noise(x, s, 0.05, true);
  bakeRough(x, s, 0.9, 0.08, 0.07);
  return { c, world: 2.0, rough: 1.0, metal: 0.0 };
},

/* asphalt road surface */
asphalt(s) {
  const c = cv(s), x = c.getContext("2d");
  x.fillStyle = "#43443f"; x.fillRect(0, 0, s, s);
  for (let i = 0; i < 14000; i++) {
    const g = 30 + Math.random() * 85;
    x.fillStyle = `rgba(${g | 0},${g | 0},${(g * .97) | 0},${0.25 + Math.random() * .5})`;
    x.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 2.2, 1 + Math.random() * 2.2);
  }
  blotch(x, s, 16, s * 0.3, "20,20,20", 0.03, 0.1);
  for (let i = 0; i < 7; i++) {                           // crack seal
    x.strokeStyle = `rgba(18,18,18,${0.3 + Math.random() * .3})`; x.lineWidth = 1.5 + Math.random() * 2.5;
    let px = Math.random() * s, py = Math.random() * s;
    x.beginPath(); x.moveTo(px, py);
    for (let k = 0; k < 7; k++) { px += (Math.random() - .5) * 60; py += (Math.random() - .5) * 60; x.lineTo(px, py); }
    x.stroke();
  }
  noise(x, s, 0.07, true);
  bakeRough(x, s, 0.94, 0.06, 0.06);
  return { c, world: 3.0, rough: 1.0, metal: 0.0 };
},

grass(s) {
  const c = cv(s), x = c.getContext("2d");
  x.fillStyle = "#5c7a3e"; x.fillRect(0, 0, s, s);
  for (let i = 0; i < 9000; i++) {
    const v = 0.6 + Math.random() * 0.85;
    x.strokeStyle = `rgba(${(96 * v) | 0},${(128 * v) | 0},${(58 * v) | 0},.75)`;
    x.lineWidth = 1 + Math.random();
    const px = Math.random() * s, py = Math.random() * s;
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + (Math.random() - .5) * 5, py - 2 - Math.random() * 5); x.stroke();
  }
  blotch(x, s, 26, s * 0.24, "110,96,52", 0.02, 0.12);    // dry patches
  blotch(x, s, 14, s * 0.2, "40,66,30", 0.03, 0.12);
  noise(x, s, 0.07, false);
  bakeRough(x, s, 0.95, 0.05, 0.06);
  return { c, world: 4.0, rough: 1.0, metal: 0.0 };
},

dirt(s) {
  const c = cv(s), x = c.getContext("2d");
  x.fillStyle = "#7a6144"; x.fillRect(0, 0, s, s);
  for (let i = 0; i < 6000; i++) {
    const g = 60 + Math.random() * 90;
    x.fillStyle = `rgba(${g | 0},${(g * .82) | 0},${(g * .6) | 0},${0.1 + Math.random() * .4})`;
    x.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 3, 1 + Math.random() * 3);
  }
  blotch(x, s, 20, s * 0.3, "60,46,30", 0.03, 0.13);
  noise(x, s, 0.07, true);
  bakeRough(x, s, 0.96, 0.04, 0.05);
  return { c, world: 3.0, rough: 1.0, metal: 0.0 };
},

/* window glass — grime, streaks, a faint sky gradient baked in */
glass(s) {
  const c = cv(s), x = c.getContext("2d");
  const g = x.createLinearGradient(0, 0, 0, s);
  g.addColorStop(0, "#8fb0cc"); g.addColorStop(.5, "#5f7d96"); g.addColorStop(1, "#33424e");
  x.fillStyle = g; x.fillRect(0, 0, s, s);
  for (let i = 0; i < 30; i++) {                          // rain streaks + fingerprints
    x.strokeStyle = `rgba(255,255,255,${0.02 + Math.random() * .05})`; x.lineWidth = 1 + Math.random() * 4;
    const px = Math.random() * s; x.beginPath(); x.moveTo(px, 0); x.lineTo(px + (Math.random() - .5) * 10, s); x.stroke();
  }
  blotch(x, s, 12, s * 0.16, "220,225,230", 0.02, 0.07);
  noise(x, s, 0.015, true);
  bakeRough(x, s, 0.09, 0.12, 0.03);
  return { c, world: 2.0, rough: 1.0, metal: 0.15 };
},

/* galvanised / painted metal for gutters, flashing, hinges, bolts, poles */
metal(s) {
  const c = cv(s), x = c.getContext("2d");
  x.fillStyle = "#9aa0a6"; x.fillRect(0, 0, s, s);
  blotch(x, s, 30, s * 0.14, "200,205,210", 0.03, 0.14);  // spangle
  blotch(x, s, 22, s * 0.1, "90,96,102", 0.03, 0.14);
  for (let i = 0; i < 12; i++) {                          // rust
    const rx = Math.random() * s, ry = Math.random() * s, rr = 5 + Math.random() * 16;
    const g = x.createRadialGradient(rx, ry, 0, rx, ry, rr);
    g.addColorStop(0, "rgba(126,63,26,.55)"); g.addColorStop(1, "rgba(126,63,26,0)");
    x.fillStyle = g; x.beginPath(); x.arc(rx, ry, rr, 0, 6.3); x.fill();
  }
  scratches(x, s, 70, 1.0, 0.12);
  noise(x, s, 0.04, true);
  bakeRough(x, s, 0.42, 0.34, 0.12);
  return { c, world: 1.0, rough: 1.0, metal: 0.9 };
},

/* ceramic tile — bathrooms, kitchens, shop floors */
tile(s) {
  const c = cv(s), x = c.getContext("2d");
  x.fillStyle = "#8e8b86"; x.fillRect(0, 0, s, s);        // grout
  const n = 8, t = s / n;                                 // world 1.6m => 200mm tiles
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const v = 0.93 + Math.random() * 0.12;
    x.fillStyle = `rgb(${(226 * v) | 0},${(224 * v) | 0},${(216 * v) | 0})`;
    x.fillRect(i * t + 2, j * t + 2, t - 4, t - 4);
    x.fillStyle = "rgba(255,255,255,.22)"; x.fillRect(i * t + 2, j * t + 2, t - 4, 1.5);
    x.fillStyle = "rgba(0,0,0,.10)"; x.fillRect(i * t + 2, j * t + t - 3.5, t - 4, 1.5);
  }
  blotch(x, s, 10, s * 0.2, "150,148,142", 0.02, 0.06);
  noise(x, s, 0.02, true);
  bakeRough(x, s, 0.2, 0.3, 0.06);
  return { c, world: 1.6, rough: 1.0, metal: 0.0 };
},

/* carpet / upholstery */
fabric(s) {
  const c = cv(s), x = c.getContext("2d");
  x.fillStyle = "#8b8478"; x.fillRect(0, 0, s, s);
  for (let i = 0; i < 16000; i++) {
    const v = 0.7 + Math.random() * 0.6;
    x.fillStyle = `rgba(${(139 * v) | 0},${(132 * v) | 0},${(120 * v) | 0},.6)`;
    x.fillRect(Math.random() * s, Math.random() * s, 1.6, 1.6);
  }
  blotch(x, s, 12, s * 0.25, "90,84,74", 0.02, 0.08);
  noise(x, s, 0.05, true);
  bakeRough(x, s, 0.96, 0.04, 0.04);
  return { c, world: 1.0, rough: 1.0, metal: 0.0 };
},

/* foliage card — alpha cutout leaf cluster */
leaf(s) {
  const c = cv(s), x = c.getContext("2d");
  x.clearRect(0, 0, s, s);
  for (let i = 0; i < 260; i++) {
    const px = s * 0.5 + (Math.random() - .5) * s * 0.94;
    const py = s * 0.5 + (Math.random() - .5) * s * 0.94;
    const d = Math.hypot(px - s / 2, py - s / 2) / (s / 2);
    if (Math.random() < d * d * 1.15) continue;
    const v = 0.55 + Math.random() * 0.7;
    x.fillStyle = `rgb(${(78 * v) | 0},${(112 * v) | 0},${(48 * v) | 0})`;
    x.save(); x.translate(px, py); x.rotate(Math.random() * 6.3);
    x.beginPath(); x.ellipse(0, 0, 5 + Math.random() * 9, 3 + Math.random() * 5, 0, 0, 6.3); x.fill();
    x.restore();
  }
  bakeRoughKeepAlpha(x, s);
  return { c, world: 1.0, rough: 0.72, metal: 0.0, cutout: true, twoSided: true };
},

bark(s) {
  const c = cv(s), x = c.getContext("2d");
  x.fillStyle = "#5b4634"; x.fillRect(0, 0, s, s);
  for (let i = 0; i < 130; i++) {                         // vertical fissures
    const px = Math.random() * s, w = 2 + Math.random() * 9;
    x.fillStyle = `rgba(${20 + Math.random() * 60 | 0},${14 + Math.random() * 44 | 0},8,${0.1 + Math.random() * .35})`;
    x.beginPath(); x.moveTo(px, 0);
    for (let py = 0; py <= s; py += 16) x.lineTo(px + Math.sin(py * 0.04 + i) * 3, py);
    for (let py = s; py >= 0; py -= 16) x.lineTo(px + w + Math.sin(py * 0.04 + i) * 3, py);
    x.closePath(); x.fill();
  }
  blotch(x, s, 16, s * 0.2, "120,110,80", 0.02, 0.1);     // lichen
  noise(x, s, 0.09, true);
  bakeRough(x, s, 0.95, 0.05, 0.06);
  return { c, world: 1.4, rough: 1.0, metal: 0.0 };
},

/* road markings sheet: white/yellow paint on transparent for decal quads */
markings(s) {
  const c = cv(s), x = c.getContext("2d");
  x.fillStyle = "#e8e4d8"; x.fillRect(0, 0, s, s);
  blotch(x, s, 18, s * 0.24, "70,66,58", 0.05, 0.2);      // worn through to asphalt
  scratches(x, s, 50, 1.4, 0.08);
  noise(x, s, 0.06, true);
  bakeRough(x, s, 0.8, 0.14, 0.08);
  return { c, world: 1.0, rough: 1.0, metal: 0.0 };
},

/* soft blob for contact shadows under buildings, trees and cars */
shadowBlob(s) {
  const c = cv(s), x = c.getContext("2d");
  x.fillStyle = "#fff"; x.fillRect(0, 0, s, s);
  const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, "rgba(0,0,0,.36)"); g.addColorStop(.5, "rgba(0,0,0,.17)"); g.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = g; x.fillRect(0, 0, s, s);
  const im = x.getImageData(0, 0, s, s), d = im.data;
  for (let i = 0; i < d.length; i += 4) d[i + 3] = 255;
  x.putImageData(im, 0, 0);
  return { c, world: 1.0, rough: 1.0, metal: 0.0, decal: true, clamp: true };
},
};

function bakeRoughKeepAlpha(ctx, s) {
  const im = ctx.getImageData(0, 0, s, s), d = im.data;
  for (let i = 0; i < d.length; i += 4) d[i + 3] = d[i + 3] > 40 ? 255 : 0;
  ctx.putImageData(im, 0, 0);
}

/* ============================================================== build ===== */
const SIZES = { siding: 512, brick: 512, shingle: 512, concrete: 512, asphalt: 512, wood: 512,
                grass: 512, metalRoof: 256, paint: 256, drywall: 256, ceiling: 256, metal: 256, glass: 256,
                tile: 256, fabric: 256, leaf: 256, bark: 256, dirt: 256, markings: 128, shadowBlob: 128 };

T.buildMaterials = function () {
  for (const k in G) {
    const size = SIZES[k] || 256;
    const m = G[k](size);
    m.tex = upload(m.c, !m.clamp);
    m.name = k;
    m.px = size;
    m.density = size / m.world;             // texels per metre — reported by /inspect
    m.c = null;                             // release the canvas
    M[k] = m;
  }
  /* target density; anything more than 2x off is flagged by the validator */
  T.TEXEL_TARGET = 256;
  return M;
};

/* Drop-in hook for AI-generated images later:
     TOWN.overrideMaterial('siding', 'textures/siding_ai.png', 2.0)
   Keeps the same world size so texel density stays calibrated.            */
T.overrideMaterial = function (name, url, world) {
  const img = new Image();
  img.onload = function () {
    const m = M[name]; if (!m) return;
    T.GL.gl.deleteTexture(m.tex);
    m.tex = upload(img, true);
    if (world) { m.world = world; m.density = img.width / world; }
  };
  img.src = url;
};
})();
