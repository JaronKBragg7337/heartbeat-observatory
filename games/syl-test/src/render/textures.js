// ============================================================================
// textures.js — procedural canvas textures. NO image files, ever.
//
// OWNS: every runtime-painted texture in the game (terrain detail, building
//       walls, landing pads, roads, metal plates, fabric).
// DOES NOT OWN: materials (render/props.js + callers), geometry, lighting.
//
// TECHNIQUE (learned from World of ClaudeCraft, levy-street/world-of-claudecraft,
// src/render/textures.ts): paint small canvases at runtime with a SEEDED rng,
// wrap them in THREE.CanvasTexture, and multiply them over vertex colors /
// material colors. A 256px mottle repeated 200x across a planet is what turns
// "flat plastic Roblox" into surface that reads as real ground.
//
// RULES FOR FUTURE AGENTS:
// 1. Deterministic: use the module rng(), NEVER Math.random — same look every
//    boot, every device, every screenshot comparison.
// 2. Node-safe: every export returns null when `document` is missing so the
//    headless test suite can import any module that imports this one.
// 3. Cache by key: textures are shared, tiny, and built once.
// 4. Keep canvases <= 256px. This must stay phone-first.
// ============================================================================

import * as THREE from 'three';

const HAS_DOM = typeof document !== 'undefined';
const cache = new Map();

let seedState = 987654321;
function rng() {
  seedState = (seedState * 1103515245 + 12345) & 0x7fffffff;
  return seedState / 0x7fffffff;
}

function makeTex(key, size, draw, { repeat = null, srgb = true } = {}) {
  if (!HAS_DOM) return null;
  if (cache.has(key)) return cache.get(key);
  seedState = 0;
  for (let i = 0; i < key.length; i++) seedState = (seedState * 31 + key.charCodeAt(i)) & 0x7fffffff;
  seedState = seedState || 1;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) tex.repeat.set(repeat[0], repeat[1]);
  cache.set(key, tex);
  return tex;
}

function css(hex) { return `#${(hex & 0xffffff).toString(16).padStart(6, '0')}`; }
function shade(hex, f) {
  const r = Math.min(255, Math.max(0, ((hex >> 16) & 255) * f)) | 0;
  const g = Math.min(255, Math.max(0, ((hex >> 8) & 255) * f)) | 0;
  const b = Math.min(255, Math.max(0, (hex & 255) * f)) | 0;
  return `rgb(${r},${g},${b})`;
}

// --- Terrain: neutral mottle multiplied over terrain vertex colors. ---------
export function groundDetailTexture() {
  return makeTex('ground', 256, (ctx, s) => {
    ctx.fillStyle = '#b4b4b4';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 4200; i++) {
      const v = 140 + Math.floor(rng() * 115);
      ctx.fillStyle = `rgba(${v},${v},${v},0.32)`;
      const r = 1 + rng() * 3;
      ctx.fillRect(rng() * s, rng() * s, r, r);
    }
    // Larger soft blotches — breaks up tiling.
    for (let i = 0; i < 90; i++) {
      const v = 150 + Math.floor(rng() * 80);
      ctx.fillStyle = `rgba(${v},${v},${v},0.10)`;
      ctx.beginPath();
      ctx.arc(rng() * s, rng() * s, 8 + rng() * 26, 0, Math.PI * 2);
      ctx.fill();
    }
    // Fine cracks/streaks.
    for (let i = 0; i < 260; i++) {
      const v = 110 + Math.floor(rng() * 70);
      ctx.strokeStyle = `rgba(${v},${v},${v},0.22)`;
      const x = rng() * s, y = rng() * s, a = rng() * Math.PI * 2, l = 4 + rng() * 14;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      ctx.stroke();
    }
  });
}

// --- Buildings: panel wall with a window grid, some windows warm-lit. -------
export function buildingWallTexture(baseHex, accentHex, key = '') {
  return makeTex(`wall:${baseHex}:${accentHex}:${key}`, 128, (ctx, s) => {
    ctx.fillStyle = css(baseHex);
    ctx.fillRect(0, 0, s, s);
    // Panel seams
    ctx.strokeStyle = 'rgba(0,0,0,0.20)';
    ctx.lineWidth = 1;
    for (let y = 0; y <= s; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y); ctx.stroke(); }
    for (let x = 0; x <= s; x += 43) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, s); ctx.stroke(); }
    // Grime streaks from panel tops
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = `rgba(0,0,0,${0.05 + rng() * 0.08})`;
      const x = rng() * s, y = Math.floor(rng() * 4) * 32, w = 2 + rng() * 5;
      ctx.fillRect(x, y, w, 6 + rng() * 22);
    }
    // Window grid (rows of 4)
    for (let ry = 10; ry < s; ry += 32) {
      for (let rx = 8; rx < s - 12; rx += 30) {
        const lit = rng() < 0.38;
        ctx.fillStyle = lit ? '#ffd98a' : '#101820';
        ctx.fillRect(rx, ry, 14, 10);
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.strokeRect(rx + 0.5, ry + 0.5, 14, 10);
        if (lit) { ctx.fillStyle = 'rgba(255,217,138,0.25)'; ctx.fillRect(rx - 2, ry - 2, 18, 14); }
      }
    }
    // Accent band along the bottom
    ctx.fillStyle = css(accentHex);
    ctx.fillRect(0, s - 6, s, 3);
  });
}

// --- Plain industrial metal (sheds, tanks, hulls). ---------------------------
export function metalPlateTexture(baseHex) {
  return makeTex(`metal:${baseHex}`, 128, (ctx, s) => {
    ctx.fillStyle = css(baseHex);
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    for (let y = 0; y <= s; y += 26) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y); ctx.stroke(); }
    for (let x = 0; x <= s; x += 34) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, s); ctx.stroke(); }
    // Rivets
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (let y = 4; y < s; y += 26) for (let x = 4; x < s; x += 17) { if (rng() < 0.8) ctx.fillRect(x, y, 2, 2); }
    // Wear
    for (let i = 0; i < 120; i++) {
      const light = rng() < 0.5;
      ctx.fillStyle = light ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';
      ctx.fillRect(rng() * s, rng() * s, 2 + rng() * 8, 1 + rng() * 3);
    }
  });
}

// --- Landing pad top: hazard ring, centre mark, wear. ------------------------
export function padTexture(accentHex) {
  return makeTex(`pad:${accentHex}`, 256, (ctx, s) => {
    const c = s / 2;
    ctx.fillStyle = '#2b3339';
    ctx.fillRect(0, 0, s, s);
    // Surface noise
    for (let i = 0; i < 1600; i++) {
      const v = 30 + Math.floor(rng() * 40);
      ctx.fillStyle = `rgba(${v},${v + 6},${v + 10},0.5)`;
      ctx.fillRect(rng() * s, rng() * s, 2, 2);
    }
    // Hazard ring (dashed)
    ctx.lineWidth = 10;
    for (let i = 0; i < 24; i++) {
      ctx.strokeStyle = i % 2 ? '#d8b021' : '#22282d';
      ctx.beginPath();
      ctx.arc(c, c, s * 0.42, (i / 24) * Math.PI * 2, ((i + 1) / 24) * Math.PI * 2);
      ctx.stroke();
    }
    // Faction ring
    ctx.strokeStyle = css(accentHex);
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(c, c, s * 0.30, 0, Math.PI * 2); ctx.stroke();
    // Centre circle + cross
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath(); ctx.arc(c, c, s * 0.10, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(c - s * 0.06, c); ctx.lineTo(c + s * 0.06, c); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(c, c - s * 0.06); ctx.lineTo(c, c + s * 0.06); ctx.stroke();
    // Skid scuffs
    for (let i = 0; i < 40; i++) {
      ctx.strokeStyle = `rgba(10,12,14,${0.2 + rng() * 0.3})`;
      ctx.lineWidth = 1 + rng() * 2;
      const x = c + (rng() - 0.5) * s * 0.7, y = c + (rng() - 0.5) * s * 0.7, a = rng() * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 22, y + Math.sin(a) * 22); ctx.stroke();
    }
  });
}

// --- Road strip: worn surface + centre dashes. Repeat along length. ----------
export function roadTexture() {
  return makeTex('road', 128, (ctx, s) => {
    ctx.fillStyle = '#23292e';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 900; i++) {
      const v = 26 + Math.floor(rng() * 34);
      ctx.fillStyle = `rgba(${v},${v + 4},${v + 8},0.55)`;
      ctx.fillRect(rng() * s, rng() * s, 2, 2);
    }
    // Centre dashes (texture V = along road)
    ctx.fillStyle = 'rgba(214,190,120,0.8)';
    for (let y = 6; y < s; y += 32) ctx.fillRect(s / 2 - 2, y, 4, 16);
    // Edge wear lines
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(4, 0, 2, s); ctx.fillRect(s - 6, 0, 2, s);
  });
}

// --- Canopy fabric with seams. ------------------------------------------------
export function fabricTexture(hex) {
  return makeTex(`fabric:${hex}`, 64, (ctx, s) => {
    ctx.fillStyle = css(hex);
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    for (let x = 0; x <= s; x += 12) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, s); ctx.stroke(); }
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.03 + rng() * 0.05})`;
      ctx.fillRect(rng() * s, rng() * s, 3, 1);
    }
  });
}

// --- Solar panel (settlement dressing). ---------------------------------------
export function solarTexture() {
  return makeTex('solar', 64, (ctx, s) => {
    ctx.fillStyle = '#0d1b33';
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(120,170,255,0.5)';
    for (let x = 0; x <= s; x += 8) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, s); ctx.stroke(); }
    for (let y = 0; y <= s; y += 8) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(0, 0, s / 3, s / 3);
  });
}

export function clearTextureCache() { cache.clear(); }
