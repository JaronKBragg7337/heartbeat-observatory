// WORLDS LAB · lib v1 · textures.js
// Procedural canvas textures — every texture is drawn in code at runtime.
// Zero downloaded art, zero licensing questions, tiny payload (nothing to host).
// LIB FREEZE LAW: v1 files are frozen once worlds ship on them. Improvements go in lib/v2/.
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.module.js";

export const LIB_BUILD = "worlds-lab-v1";

// seeded random so textures look identical on every device/visit
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTex(w, h, draw, opts) {
  const o = opts || {};
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  if (o.repeat) tex.repeat.set(o.repeat[0], o.repeat[1]);
  tex.anisotropy = 4;
  return tex;
}

export function brickTexture(opts) {
  const { brick = "#9c5a48", mortar = "#cfc4b4", seed = 7, repeat = [2, 2] } = opts || {};
  const rnd = mulberry32(seed);
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = mortar; g.fillRect(0, 0, w, h);
    const bw = 32, bh = 16;
    for (let y = 0; y < h / bh; y++) {
      const off = (y % 2) * (bw / 2);
      for (let x = -1; x < w / bw; x++) {
        g.fillStyle = shade(brick, 0.85 + rnd() * 0.3);
        g.fillRect(x * bw + off + 1, y * bh + 1, bw - 2, bh - 2);
      }
    }
  }, { repeat });
}

export function plankTexture(opts) {
  const { wood = "#9a7048", seed = 3, vertical = false, repeat = [2, 2] } = opts || {};
  const rnd = mulberry32(seed);
  return canvasTex(256, 256, (g, w, h) => {
    const n = 8, s = w / n;
    for (let i = 0; i < n; i++) {
      g.fillStyle = shade(wood, 0.8 + rnd() * 0.4);
      if (vertical) g.fillRect(i * s, 0, s - 1, h); else g.fillRect(0, i * s, w, s - 1);
      g.fillStyle = "rgba(0,0,0,0.18)";
      for (let k = 0; k < 5; k++) {
        const p = rnd() * 256;
        if (vertical) g.fillRect(i * s + rnd() * s, p, 1.4, 10 + rnd() * 30);
        else g.fillRect(p, i * s + rnd() * s, 10 + rnd() * 30, 1.4);
      }
    }
  }, { repeat });
}

export function shingleTexture(opts) {
  const { color = "#5a6470", seed = 5, repeat = [3, 3] } = opts || {};
  const rnd = mulberry32(seed);
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = shade(color, 0.7); g.fillRect(0, 0, w, h);
    const sw = 32, sh = 20;
    for (let y = 0; y < h / sh + 1; y++) {
      const off = (y % 2) * (sw / 2);
      for (let x = -1; x < w / sw; x++) {
        g.fillStyle = shade(color, 0.85 + rnd() * 0.3);
        g.beginPath();
        g.moveTo(x * sw + off, y * sh);
        g.lineTo(x * sw + off + sw - 2, y * sh);
        g.lineTo(x * sw + off + sw - 2, y * sh + sh - 3);
        g.quadraticCurveTo(x * sw + off + sw / 2, y * sh + sh + 3, x * sw + off, y * sh + sh - 3);
        g.fill();
      }
    }
  }, { repeat });
}

export function stoneTexture(opts) {
  const { color = "#8d8d86", seed = 11, repeat = [2, 2] } = opts || {};
  const rnd = mulberry32(seed);
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = shade(color, 0.65); g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      const x = rnd() * w, y = rnd() * h, r = 10 + rnd() * 22;
      g.fillStyle = shade(color, 0.8 + rnd() * 0.35);
      g.beginPath();
      g.ellipse(x, y, r, r * (0.6 + rnd() * 0.4), rnd() * 3.2, 0, 6.3);
      g.fill();
    }
  }, { repeat });
}

export function asphaltTexture(opts) {
  const { dash = false, seed = 13, repeat = [1, 6] } = opts || {};
  const rnd = mulberry32(seed);
  return canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = "#3a3d42"; g.fillRect(0, 0, w, h);
    g.fillStyle = "rgba(255,255,255,0.05)";
    for (let i = 0; i < 500; i++) g.fillRect(rnd() * w, rnd() * h, 1.5, 1.5);
    if (dash) {
      g.fillStyle = "#d8c66a";
      for (let y = 0; y < h; y += 48) g.fillRect(w / 2 - 3, y, 6, 26);
    }
  }, { repeat });
}

export function paverTexture(opts) {
  const { color = "#9a948a", seed = 17, repeat = [4, 4] } = opts || {};
  const rnd = mulberry32(seed);
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = shade(color, 0.6); g.fillRect(0, 0, w, h);
    const s = 42;
    for (let y = 0; y < h / s; y++) for (let x = 0; x < w / s; x++) {
      g.fillStyle = shade(color, 0.85 + rnd() * 0.3);
      g.fillRect(x * s + 2, y * s + 2, s - 4, s - 4);
    }
  }, { repeat });
}

export function grassTexture(opts) {
  const { color = "#5f8f4e", seed = 19, repeat = [10, 10] } = opts || {};
  const rnd = mulberry32(seed);
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = color; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = shade(color, 0.75 + rnd() * 0.55);
      g.fillRect(rnd() * w, rnd() * h, 2, 4 + rnd() * 5);
    }
  }, { repeat });
}

export function sandTexture(opts) {
  const { color = "#d9c08c", seed = 23, repeat = [8, 8] } = opts || {};
  const rnd = mulberry32(seed);
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = color; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) {
      g.fillStyle = shade(color, 0.82 + rnd() * 0.36);
      g.fillRect(rnd() * w, rnd() * h, 2, 2);
    }
    g.strokeStyle = "rgba(0,0,0,0.05)"; g.lineWidth = 3;
    for (let i = 0; i < 9; i++) {
      g.beginPath();
      const y0 = rnd() * h;
      g.moveTo(0, y0);
      g.bezierCurveTo(w * 0.3, y0 + 18, w * 0.6, y0 - 18, w, y0 + 6);
      g.stroke();
    }
  }, { repeat });
}

export function snowTexture(opts) {
  const { seed = 29, repeat = [8, 8] } = opts || {};
  const rnd = mulberry32(seed);
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "#eef3f8"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) {
      g.fillStyle = "rgba(180,200,225," + (0.06 + rnd() * 0.12).toFixed(2) + ")";
      const r = 3 + rnd() * 9;
      g.beginPath(); g.arc(rnd() * w, rnd() * h, r, 0, 6.3); g.fill();
    }
    for (let i = 0; i < 250; i++) {
      g.fillStyle = "rgba(255,255,255,0.8)";
      g.fillRect(rnd() * w, rnd() * h, 1.6, 1.6);
    }
  }, { repeat });
}

export function waterTexture(opts) {
  const { deep = "#1d5e8a", light = "#7fd4e8", seed = 31, repeat = [6, 6] } = opts || {};
  const rnd = mulberry32(seed);
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = deep; g.fillRect(0, 0, w, h);
    g.strokeStyle = light; g.globalAlpha = 0.35; g.lineWidth = 2.4;
    for (let i = 0; i < 26; i++) {
      g.beginPath();
      let x = rnd() * w, y = rnd() * h;
      g.moveTo(x, y);
      for (let k = 0; k < 4; k++) { x += 14 + rnd() * 26; y += (rnd() - 0.5) * 22; g.lineTo(x, y); }
      g.stroke();
    }
    g.globalAlpha = 1;
  }, { repeat });
}

export function metalTexture(opts) {
  const { color = "#8b95a0", seed = 37, repeat = [2, 2] } = opts || {};
  const rnd = mulberry32(seed);
  return canvasTex(256, 256, (g, w, h) => {
    const s = 64;
    for (let y = 0; y < h / s; y++) for (let x = 0; x < w / s; x++) {
      g.fillStyle = shade(color, 0.88 + rnd() * 0.22);
      g.fillRect(x * s, y * s, s - 2, s - 2);
      g.fillStyle = "rgba(0,0,0,0.35)";
      g.fillRect(x * s + 5, y * s + 5, 3, 3);
      g.fillRect(x * s + s - 10, y * s + 5, 3, 3);
      g.fillRect(x * s + 5, y * s + s - 10, 3, 3);
      g.fillRect(x * s + s - 10, y * s + s - 10, 3, 3);
    }
  }, { repeat });
}

export function neonGridTexture(opts) {
  const { line = "#36e6ff", bg = "#0a0d18", repeat = [4, 4] } = opts || {};
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = line; g.lineWidth = 2; g.shadowColor = line; g.shadowBlur = 8;
    g.strokeRect(1, 1, w - 2, h - 2);
  }, { repeat });
}

export function stripeTexture(opts) {
  const { a = "#e2574c", b = "#f2ead8", n = 8, repeat = [2, 1] } = opts || {};
  return canvasTex(256, 256, (g, w, h) => {
    for (let i = 0; i < n; i++) {
      g.fillStyle = i % 2 ? b : a;
      g.fillRect((i * w) / n, 0, w / n + 1, h);
    }
  }, { repeat });
}

export function hazardTexture(opts) {
  const { repeat = [3, 1] } = opts || {};
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = "#d8b021"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#23262b";
    for (let i = -1; i < 5; i++) {
      g.beginPath();
      g.moveTo(i * 32, h); g.lineTo(i * 32 + 32, h); g.lineTo(i * 32 + 64, 0); g.lineTo(i * 32 + 32, 0);
      g.fill();
    }
  }, { repeat });
}

// building facade with a lit-window grid — returns {map, emissiveMap} so windows
// can glow at night (World 2's technique: emissiveIntensity rides the day cycle).
export function facadeMaps(opts) {
  const { base = "#5e6772", glass = "#202c38", lit = "#ffd9a0", litRatio = 0.45, rows = 8, cols = 5, seed = 41, repeat = [1, 1] } = opts || {};
  const rnd = mulberry32(seed);
  const litMask = [];
  for (let i = 0; i < rows * cols; i++) litMask.push(rnd() < litRatio);
  const draw = (emissive) => (g, w, h) => {
    g.fillStyle = emissive ? "#000000" : base; g.fillRect(0, 0, w, h);
    const mx = w / (cols * 5), my = h / (rows * 5);
    const ww = (w - mx * (cols + 1)) / cols, wh = (h - my * (rows + 1)) / rows;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const on = litMask[r * cols + c];
      g.fillStyle = emissive ? (on ? lit : "#000000") : (on ? lit : glass);
      g.fillRect(mx + c * (ww + mx), my + r * (wh + my), ww, wh);
    }
  };
  return {
    map: canvasTex(256, 512, draw(false), { repeat }),
    emissiveMap: canvasTex(256, 512, draw(true), { repeat }),
  };
}

export function curtainTexture(opts) {
  const { color = "#7a1f2b", repeat = [4, 1] } = opts || {};
  return canvasTex(128, 256, (g, w, h) => {
    for (let x = 0; x < w; x++) {
      const v = 0.7 + 0.3 * Math.sin((x / w) * Math.PI * 8);
      g.fillStyle = shade(color, v);
      g.fillRect(x, 0, 1, h);
    }
  }, { repeat });
}

export function carpetTexture(opts) {
  const { color = "#5e1f28", seed = 43, repeat = [6, 6] } = opts || {};
  const rnd = mulberry32(seed);
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = color; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 500; i++) {
      g.fillStyle = shade(color, 0.8 + rnd() * 0.4);
      g.fillRect(rnd() * w, rnd() * h, 1.6, 1.6);
    }
  }, { repeat });
}

export function starfieldTexture(opts) {
  const { seed = 47, density = 320, repeat = [1, 1] } = opts || {};
  const rnd = mulberry32(seed);
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = "#050810"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < density; i++) {
      const a = 0.3 + rnd() * 0.7;
      g.fillStyle = "rgba(255,255,255," + a.toFixed(2) + ")";
      const s = rnd() < 0.9 ? 1.4 : 2.4;
      g.fillRect(rnd() * w, rnd() * h, s, s);
    }
  }, { repeat });
}

// generic readable text panel (signs, plaques) — honest typography, drawn in code
export function textTexture(lines, opts) {
  const { w = 512, h = 256, bg = "#10151c", fg = "#e8eef4", accent = null, pad = 26, font = "bold 36px system-ui, sans-serif", subFont = "24px system-ui, sans-serif", border = true } = opts || {};
  return canvasTex(w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    if (border) { g.strokeStyle = accent || fg; g.lineWidth = 5; g.strokeRect(8, 8, w - 16, h - 16); }
    g.textAlign = "center"; g.textBaseline = "middle";
    const list = Array.isArray(lines) ? lines : [lines];
    const step = (h - pad * 2) / list.length;
    list.forEach((line, i) => {
      g.fillStyle = i === 0 && accent ? accent : fg;
      g.font = i === 0 ? font : subFont;
      g.fillText(String(line), w / 2, pad + step * (i + 0.5), w - pad * 2);
    });
  }, {});
}

// typographic movie poster — title cards only, drawn in code (no copied artwork)
export function posterTexture(title, subtitle, opts) {
  const { hue = 210, seed = 53 } = opts || {};
  const rnd = mulberry32(seed);
  return canvasTex(256, 384, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "hsl(" + hue + ",45%,22%)");
    grad.addColorStop(1, "hsl(" + ((hue + 40) % 360) + ",55%,10%)");
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = "rgba(255,255,255," + (0.04 + rnd() * 0.08).toFixed(2) + ")";
      g.beginPath(); g.arc(rnd() * w, rnd() * h * 0.6, 1 + rnd() * 2.4, 0, 6.3); g.fill();
    }
    g.strokeStyle = "rgba(255,230,180,0.85)"; g.lineWidth = 4; g.strokeRect(10, 10, w - 20, h - 20);
    g.textAlign = "center"; g.fillStyle = "#f4e8cf";
    g.font = "bold 30px Georgia, serif";
    wrapText(g, String(title).toUpperCase(), w / 2, h * 0.42, w - 44, 34);
    g.font = "16px system-ui, sans-serif"; g.fillStyle = "rgba(238,238,238,0.85)";
    wrapText(g, subtitle || "", w / 2, h * 0.78, w - 44, 20);
  }, {});
}

export function marqueeTexture(text, opts) {
  const { accent = "#ffd166" } = opts || {};
  return canvasTex(512, 160, (g, w, h) => {
    g.fillStyle = "#15100a"; g.fillRect(0, 0, w, h);
    g.fillStyle = accent;
    for (let x = 14; x < w; x += 24) { g.beginPath(); g.arc(x, 14, 5, 0, 6.3); g.fill(); g.beginPath(); g.arc(x, h - 14, 5, 0, 6.3); g.fill(); }
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillStyle = "#fff6e0"; g.font = "bold 52px system-ui, sans-serif";
    g.fillText(String(text).toUpperCase(), w / 2, h / 2, w - 70);
  }, {});
}

function wrapText(g, text, x, y, maxW, lineH) {
  const words = String(text).split(/\s+/);
  let line = "", yy = y;
  for (const word of words) {
    const test = line ? line + " " + word : word;
    if (g.measureText(test).width > maxW && line) { g.fillText(line, x, yy); line = word; yy += lineH; }
    else line = test;
  }
  if (line) g.fillText(line, x, yy);
}

export function shade(hex, v) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(v);
  return "#" + c.getHexString();
}
