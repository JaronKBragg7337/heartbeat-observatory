// WORLD 2 - shops (remake Phase 3, 2026-11-11). See /WORLD2-REMAKE.md and /world2/SHOPS.md.
//
// ONE shared shop-interior kit, dressed per shop from data (world2/shops.json): a shell (floor, two-tone walls, a
// glass front with the door, a back partition and a back room), a counter with a register, a back shelf, ceiling
// lamps, and then whatever the shop's kind asks for: cafe seating and machines, retail shelving and goods, or service
// stations. A shop is built when you walk in and thrown away when you walk out (one at a time).
//
// Budget (the plan: <= 30 draw calls, <= 60k triangles): every piece is merged into one mesh per material, so a shop
// is about 12 draw calls. While you are inside, the city is not drawn at all. The street you see through the window
// is the real street: three views of it are drawn once, just before you step in, and kept as one picture.
//
// Local frame of a shop: the door wall is z = 0, the shop runs back to -z, +x is your right as you walk in.

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.module.js";

export const SHOP_ROOM = { x: 620, z: 1400 };   // where the one shop interior stands: beyond the camera's range from the city and the three halls
const H = 3.4, BACK = 3.6;                      // ceiling height, back-room depth

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const _col = new THREE.Color();
const C = (hex, m = 1) => { _col.set(hex); return [_col.r * m, _col.g * m, _col.b * m]; };
const mul = (c, m) => [c[0] * m, c[1] * m, c[2] * m];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const WHITE = [1, 1, 1], clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = (R, arr) => arr[Math.floor(R() * arr.length) % arr.length];
const BRIGHT = ["#c8423a", "#e0a030", "#3a7ab8", "#4a9a5a", "#8a5ab0", "#d9d2c0", "#2a2e36", "#d87a4a", "#3aa0a0", "#b84a7a"];
const CLOTH = ["#3a4a66", "#7a2a2e", "#d8d0c0", "#2f4a36", "#1e1e22", "#9a7a52", "#5a6a7a", "#b8862a", "#6a3a5a", "#a8b4bc"];

// ---------------------------------------------------------------------------------------------------------------
// textures: drawn on canvases once and kept (0 bytes downloaded)
// ---------------------------------------------------------------------------------------------------------------
const TEX = {};
function cv(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return [c, c.getContext("2d")]; }
function tex(c, repeat) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }
function speckle(g, s, R, n, a) { for (let i = 0; i < n; i++) { g.fillStyle = R() < 0.5 ? `rgba(0,0,0,${R() * a})` : `rgba(255,255,255,${R() * a})`; g.fillRect(R() * s, R() * s, 1 + R() * 2, 1 + R() * 2); } }
function floorTex(kind) {
  if (TEX["f" + kind]) return TEX["f" + kind];
  const [c, g] = cv(256, 256), R = rng(kind.length * 977 + 5);
  if (kind === "wood") {   // planks, 2 m of floor per tile
    for (let r = 0; r < 16; r++) { let x = -R() * 90; while (x < 256) { const w = 70 + R() * 80, v = 0.86 + R() * 0.16; g.fillStyle = `rgb(${172 * v | 0},${128 * v | 0},${84 * v | 0})`; g.fillRect(x, r * 16, w - 1, 15); x += w; } }
    g.globalAlpha = 0.05; for (let i = 0; i < 800; i++) { g.fillStyle = "#2a1a0c"; g.fillRect(R() * 256, R() * 256, 12 + R() * 40, 1); } g.globalAlpha = 1;
  } else if (kind === "check") {
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? "#e9e4d8" : "#2a2a2c"; g.fillRect(i * 64, j * 64, 64, 64); }
    speckle(g, 256, R, 1500, 0.07);
  } else if (kind === "tile") {
    g.fillStyle = "#d9d4c8"; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const v = 0.94 + R() * 0.1; g.fillStyle = `rgb(${222 * v | 0},${216 * v | 0},${203 * v | 0})`; g.fillRect(i * 64 + 1.5, j * 64 + 1.5, 61, 61); }
    speckle(g, 256, R, 1800, 0.05);
  } else {   // concrete
    g.fillStyle = "#9a9892"; g.fillRect(0, 0, 256, 256); speckle(g, 256, R, 6000, 0.1);
    for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(${R() < 0.5 ? "60,58,54" : "190,188,182"},${0.05 + R() * 0.06})`; g.beginPath(); g.ellipse(R() * 256, R() * 256, 20 + R() * 50, 12 + R() * 30, R() * 3, 0, 7); g.fill(); }
    g.strokeStyle = "rgba(60,60,58,0.5)"; g.lineWidth = 1.5; g.strokeRect(0.5, 0.5, 255, 255);   // saw-cut joints every 2 m
  }
  return (TEX["f" + kind] = tex(c, true));
}
function noiseTex() { if (TEX.noise) return TEX.noise; const [c, g] = cv(128, 128); g.fillStyle = "#f4f4f4"; g.fillRect(0, 0, 128, 128); speckle(g, 128, rng(3), 3200, 0.035); return (TEX.noise = tex(c, true)); }
function woodTex() {
  if (TEX.wood) return TEX.wood; const [c, g] = cv(256, 256), R = rng(8);
  g.fillStyle = "#e6e0d6"; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) { g.fillStyle = R() < 0.6 ? `rgba(60,40,20,${R() * 0.12})` : `rgba(255,255,255,${R() * 0.1})`; g.fillRect(R() * 256, R() * 256, 30 + R() * 120, 1 + R()); }
  return (TEX.wood = tex(c, true));
}
function blobTex() {
  if (TEX.blob) return TEX.blob; const [c, g] = cv(64, 64);
  const gr = g.createRadialGradient(32, 32, 6, 32, 32, 32); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.6, "rgba(255,255,255,0.55)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return (TEX.blob = t);
}
// the goods atlas: 8 x 8 cells of 64 px. Book-spine strips, covers, labels, a pegboard of tools, a wall of keys, ...
const cell = (cx, cy, cw = 1, ch = 1, inset = 0.004) => [cx / 8 + inset, 1 - (cy + ch) / 8 + inset, (cx + cw) / 8 - inset, 1 - cy / 8 - inset];
const ATLAS = {
  books: [cell(0, 0, 4, 1), cell(4, 0, 4, 1), cell(0, 1, 4, 1), cell(4, 1, 4, 1)],
  covers: Array.from({ length: 16 }, (_, k) => cell(k % 8, 2 + Math.floor(k / 8))),
  labels: Array.from({ length: 16 }, (_, k) => cell(k % 8, 4 + Math.floor(k / 8))),
  tools: cell(0, 6, 2, 2), keys: cell(2, 6, 2, 2), clock: cell(4, 6), grille: cell(5, 6), plaid: cell(6, 6), stripe: cell(7, 6),
  plain: cell(4, 7, 1, 1, 0.03), screen: cell(5, 7), paper: cell(6, 7), art: cell(7, 7),
};
function goodsTex() {
  if (TEX.goods) return TEX.goods; const [c, g] = cv(512, 512), R = rng(4242);
  const rc = () => pick(R, BRIGHT);
  for (let s = 0; s < 4; s++) {   // book spines
    const x0 = (s % 2) * 256, y0 = Math.floor(s / 2) * 64; let x = x0;
    g.fillStyle = "#1a1512"; g.fillRect(x0, y0, 256, 64);
    while (x < x0 + 256) { const w = Math.min(x0 + 256 - x, 6 + R() * 12), top = R() * 10; g.fillStyle = pick(R, ["#7a2a2a", "#2a4a6a", "#3a5a3a", "#b8a070", "#4a3a5a", "#c8c0b0", "#8a5a2a", "#1e2a3a", "#a03a3a", "#d0b84a"]);
      g.fillRect(x + 0.5, y0 + top, w - 1, 64 - top); g.fillStyle = "rgba(255,240,200,0.75)"; g.fillRect(x + w * 0.3, y0 + top + 8, Math.max(1, w * 0.3), 14 + R() * 20); g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(x, y0 + top, 1, 64); x += w; }
  }
  for (let k = 0; k < 16; k++) {   // covers: records, magazines, posters
    const x = (k % 8) * 64, y = 128 + Math.floor(k / 8) * 64; const gr = g.createLinearGradient(x, y, x + 64, y + 64); gr.addColorStop(0, rc()); gr.addColorStop(1, rc()); g.fillStyle = gr; g.fillRect(x, y, 64, 64);
    g.fillStyle = rc(); g.globalAlpha = 0.85; if (R() < 0.5) { g.beginPath(); g.arc(x + 18 + R() * 28, y + 22 + R() * 24, 9 + R() * 14, 0, 7); g.fill(); } else g.fillRect(x + 6 + R() * 20, y + 16 + R() * 20, 18 + R() * 26, 10 + R() * 22);
    g.globalAlpha = 1; g.fillStyle = R() < 0.5 ? "#ffffff" : "#111111"; g.fillRect(x + 6, y + 6, 30 + R() * 22, 5); g.fillRect(x + 6, y + 14, 16 + R() * 18, 2.5);
    g.strokeStyle = "rgba(0,0,0,0.35)"; g.strokeRect(x + 0.5, y + 0.5, 63, 63);
  }
  for (let k = 0; k < 16; k++) {   // labels: boxes, cans, jars
    const x = (k % 8) * 64, y = 256 + Math.floor(k / 8) * 64, a = rc(), b = rc();
    g.fillStyle = a; g.fillRect(x, y, 64, 64); g.fillStyle = "#f4efe2"; g.fillRect(x, y + 16, 64, 30); g.fillStyle = b; g.beginPath(); g.arc(x + 32, y + 31, 10, 0, 7); g.fill();
    g.fillStyle = "#222"; g.fillRect(x + 8, y + 20, 12, 3); g.fillRect(x + 44, y + 20, 12, 3); g.fillRect(x + 12, y + 50, 40, 3);
  }
  { const x = 0, y = 384; g.fillStyle = "#b89a6a"; g.fillRect(x, y, 128, 128); g.fillStyle = "rgba(0,0,0,0.25)"; for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) g.fillRect(x + 3 + i * 8, y + 3 + j * 8, 1.5, 1.5);   // pegboard
    g.strokeStyle = "#3a3d42"; g.lineCap = "round";
    const tool = (tx, ty, kind) => { g.lineWidth = 4; g.beginPath(); g.moveTo(x + tx, y + ty); g.lineTo(x + tx, y + ty + 30); g.stroke(); g.fillStyle = kind ? "#b8322a" : "#3a3d42";
      if (kind === 0) g.fillRect(x + tx - 9, y + ty - 4, 18, 9); else if (kind === 1) g.fillRect(x + tx - 3, y + ty + 16, 6, 16); else { g.beginPath(); g.arc(x + tx, y + ty, 6, 0, 7); g.fill(); } };
    for (let i = 0; i < 6; i++) tool(14 + i * 20, 12 + (i % 2) * 6, i % 3); for (let i = 0; i < 5; i++) tool(22 + i * 22, 74, (i + 1) % 3); }
  { const x = 128, y = 384; g.fillStyle = "#2a2d32"; g.fillRect(x, y, 128, 128);   // keys on hooks
    for (let i = 0; i < 8; i++) for (let j = 0; j < 5; j++) { const kx = x + 10 + i * 15, ky = y + 8 + j * 24; g.fillStyle = "#888"; g.fillRect(kx, ky, 2, 3); g.fillStyle = pick(R, ["#c8a84a", "#b8bcc4", "#c8a84a", "#a8743a"]); g.beginPath(); g.arc(kx + 1, ky + 8, 4, 0, 7); g.fill(); g.fillRect(kx, ky + 10, 2.5, 9); } }
  { const x = 256, y = 384; g.fillStyle = "#3a2a1c"; g.fillRect(x, y, 64, 64); g.fillStyle = "#f4efe2"; g.beginPath(); g.arc(x + 32, y + 32, 27, 0, 7); g.fill();   // clock face
    g.fillStyle = "#222"; for (let k = 0; k < 12; k++) { const a = k / 12 * 6.283; g.fillRect(x + 32 + Math.sin(a) * 22 - 1.5, y + 32 - Math.cos(a) * 22 - 1.5, 3, 3); }
    g.strokeStyle = "#111"; g.lineWidth = 3; g.beginPath(); g.moveTo(x + 32, y + 32); g.lineTo(x + 42, y + 22); g.moveTo(x + 32, y + 32); g.lineTo(x + 32, y + 12); g.stroke(); }
  { const x = 320, y = 384; g.fillStyle = "#4a3a2a"; g.fillRect(x, y, 64, 64); g.fillStyle = "#1a1612"; for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) { g.beginPath(); g.arc(x + 6 + i * 6.5, y + 6 + j * 6.5, 1.7, 0, 7); g.fill(); } }   // speaker grille
  { const x = 384, y = 384; g.fillStyle = "#a8463a"; g.fillRect(x, y, 64, 64); g.fillStyle = "rgba(20,30,60,0.55)"; for (let i = 0; i < 4; i++) { g.fillRect(x + i * 16, y, 7, 64); g.fillRect(x, y + i * 16, 64, 7); } }   // plaid
  { const x = 448, y = 384; for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? "#f1ece0" : "#2f4a6a"; g.fillRect(x + i * 8, y, 8, 64); } }   // stripes
  g.fillStyle = "#ffffff"; g.fillRect(256, 448, 64, 64);   // plain (vertex colour only)
  { const x = 320, y = 448; g.fillStyle = "#0e2238"; g.fillRect(x, y, 64, 64); g.fillStyle = "#7fd0ff"; g.fillRect(x + 6, y + 8, 30, 5); g.fillStyle = "#cfe8ff"; for (let i = 0; i < 4; i++) g.fillRect(x + 6, y + 20 + i * 9, 20 + R() * 30, 3); g.fillStyle = "#7bd88f"; g.fillRect(x + 40, y + 46, 18, 10); }   // screen
  { const x = 384, y = 448; g.fillStyle = "#efe9da"; g.fillRect(x, y, 64, 64); g.fillStyle = "#1a1a1a"; g.fillRect(x + 5, y + 5, 54, 9); g.fillStyle = "#555"; for (let i = 0; i < 7; i++) g.fillRect(x + 5, y + 19 + i * 6, 24, 2); g.fillStyle = "#8a8a8a"; g.fillRect(x + 33, y + 19, 26, 20); for (let i = 0; i < 3; i++) g.fillRect(x + 33, y + 43 + i * 6, 26, 2); }   // newspaper
  { const x = 448, y = 448; const gr = g.createLinearGradient(x, y, x, y + 64); gr.addColorStop(0, "#f2b46a"); gr.addColorStop(0.6, "#d86a4a"); gr.addColorStop(1, "#3a3050"); g.fillStyle = gr; g.fillRect(x, y, 64, 64); g.fillStyle = "#1c1a2a"; for (let i = 0; i < 7; i++) g.fillRect(x + i * 9 + 1, y + 34 + R() * 14, 8, 30); }   // skyline print
  return (TEX.goods = tex(c, false));
}

// the shop's own sheet (1024 x 512): its name, the menu or price board, the job board, the link poster, the notice,
// station labels. One canvas for every shop, redrawn on entry.
const SHEET = { name: [0, 0, 640, 160], menu: [640, 0, 384, 320], job: [0, 160, 256, 256], link: [256, 160, 192, 256], notice: [448, 160, 192, 128], thanks: [448, 288, 192, 128],
  staff: [640, 320, 192, 96], exit: [832, 320, 192, 96], label: (k) => [k * 170, 416, 170, 96] };
const sheetUV = (r) => [r[0] / 1024, 1 - (r[1] + r[3]) / 512, (r[0] + r[2]) / 1024, 1 - r[1] / 512];
let sheetCanvas = null, sheetTexture = null;
function fit(g, text, maxW, size, font) { let s = size; g.font = font.replace("%", s); while (g.measureText(text).width > maxW && s > 9) { s -= 1; g.font = font.replace("%", s); } return s; }
function wrap(g, text, maxW) { const out = []; let line = ""; for (const w of String(text).split(/\s+/)) { const t = line ? line + " " + w : w; if (g.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; } if (line) out.push(line); return out; }
function drawSheet(row, K, table, job, labels) {
  if (!sheetCanvas) { [sheetCanvas] = cv(1024, 512); sheetTexture = tex(sheetCanvas, false); }
  const g = sheetCanvas.getContext("2d"), acc = K.accent || "#2f5d46", cur = (table.currency && table.currency.name) || "beats";
  g.clearRect(0, 0, 1024, 512); g.textAlign = "center"; g.textBaseline = "middle"; g.shadowBlur = 0;
  const panel = (r, bg, edge) => { g.fillStyle = bg; g.fillRect(r[0], r[1], r[2], r[3]); if (edge) { g.strokeStyle = edge; g.lineWidth = 4; g.strokeRect(r[0] + 6, r[1] + 6, r[2] - 12, r[3] - 12); } };
  // name
  let r = SHEET.name; panel(r, acc, "rgba(255,240,210,0.6)"); g.fillStyle = "#fff4dc"; fit(g, row.name, r[2] - 50, 74, "700 %px Georgia, serif"); g.fillText(row.name, r[0] + r[2] / 2, r[1] + r[3] / 2 + 3);
  // menu / price board (chalkboard)
  r = SHEET.menu; panel(r, "#1d2420", "#8a7a5a"); g.fillStyle = "#f2ead6"; g.font = "700 30px Georgia, serif"; g.fillText(row.menu ? "TODAY" : "IN THE SHOP", r[0] + r[2] / 2, r[1] + 40);
  const lines = row.menu ? row.menu.slice(0, 6).map((m) => { const k = String(m).lastIndexOf(" "); return [m.slice(0, k), m.slice(k + 1)]; }) : (row.sells || []).slice(0, 4).map((s) => [s.item, String(s.price)]);
  g.font = "600 24px system-ui, sans-serif"; lines.forEach(([a, b], k) => { const y = r[1] + 92 + k * 36; g.textAlign = "left"; g.fillStyle = "#e9e2cf"; fit(g, a, r[2] - 110, 24, "600 %px system-ui, sans-serif"); g.fillText(a, r[0] + 26, y); g.textAlign = "right"; g.fillStyle = "#f2c94c"; g.font = "700 24px system-ui, sans-serif"; g.fillText(b, r[0] + r[2] - 26, y); });
  g.textAlign = "center"; g.fillStyle = "#9fb0a6"; g.font = "600 17px system-ui, sans-serif"; g.fillText("prices in " + cur + " (play money)", r[0] + r[2] / 2, r[1] + r[3] - 26);
  // job board
  r = SHEET.job; panel(r, "#f1e9d4", "#3a3226");
  if (job) { g.fillStyle = "#b8322a"; g.font = "900 34px system-ui, sans-serif"; g.fillText("HELP WANTED", r[0] + 128, r[1] + 48); g.fillStyle = "#2a2622"; fit(g, job.title, 216, 30, "800 %px Georgia, serif"); g.fillText(job.title, r[0] + 128, r[1] + 98);
    g.font = "600 19px system-ui, sans-serif"; g.fillStyle = "#4a4238"; const what = job.kind === "courier" ? ["The bike is out front.", job.runs + " delivery runs."] : [job.seconds + " second shift.", "Paid in " + cur + "."]; what.forEach((t, k) => g.fillText(t, r[0] + 128, r[1] + 142 + k * 26));
    g.fillStyle = "#1f6b3a"; g.font = "800 22px system-ui, sans-serif"; g.fillText(job.kind === "courier" ? "TAKE THE BIKE" : "CLOCK IN HERE", r[0] + 128, r[1] + 216); }
  else { g.fillStyle = "#2a2622"; g.font = "800 30px Georgia, serif"; g.fillText("HOURS", r[0] + 128, r[1] + 52); g.font = "600 21px system-ui, sans-serif"; ["Open every day", "sunrise to sunrise", "", "Come back soon"].forEach((t, k) => g.fillText(t, r[0] + 128, r[1] + 100 + k * 30)); }
  // link poster: this shop's doorway to the rest of the Observatory
  r = SHEET.link; panel(r, "#141c2c", "#7bd88f");
  if (row.link) { g.fillStyle = "#7bd88f"; g.font = "800 17px system-ui, sans-serif"; g.fillText("HEARTBEAT", r[0] + 96, r[1] + 40); g.fillText("OBSERVATORY", r[0] + 96, r[1] + 62);
    g.fillStyle = "#ffffff"; g.font = "800 23px Georgia, serif"; wrap(g, row.link.label, 160).slice(0, 4).forEach((t, k) => g.fillText(t, r[0] + 96, r[1] + 112 + k * 28)); g.fillStyle = "#9fd0ff"; g.font = "700 16px system-ui, sans-serif"; g.fillText("walk up and tap", r[0] + 96, r[1] + 228); }
  // the notice by the register: the policy, in every shop
  r = SHEET.notice; panel(r, "#fbf6e8", "#1f6b3a"); g.fillStyle = "#1f6b3a"; g.font = "900 22px system-ui, sans-serif"; g.fillText("PLAY MONEY ONLY", r[0] + 96, r[1] + 36);
  g.fillStyle = "#2a2622"; g.font = "600 15px system-ui, sans-serif"; ["We take " + cur + ".", "Nothing here costs", "real money."].forEach((t, k) => g.fillText(t, r[0] + 96, r[1] + 64 + k * 19));
  r = SHEET.thanks; panel(r, "#e9e2cf", "#8a7a5a"); g.fillStyle = "#3a3226"; g.font = "italic 700 26px Georgia, serif"; g.fillText("Thank you", r[0] + 96, r[1] + 52); g.font = "600 16px system-ui, sans-serif"; g.fillText("come again", r[0] + 96, r[1] + 84);
  r = SHEET.staff; panel(r, "#2a2622"); g.fillStyle = "#e9e2cf"; g.font = "800 30px system-ui, sans-serif"; g.fillText("STAFF ONLY", r[0] + 96, r[1] + 50);
  r = SHEET.exit; panel(r, "#0e2a16"); g.fillStyle = "#7bd88f"; g.font = "900 44px system-ui, sans-serif"; g.fillText("EXIT", r[0] + 96, r[1] + 52);
  (labels || []).slice(0, 6).forEach((t, k) => { r = SHEET.label(k); panel(r, "#f4efe2", "#2a2622"); g.fillStyle = "#1a1a1a"; fit(g, t.toUpperCase(), 150, 30, "900 %px system-ui, sans-serif"); g.fillText(t.toUpperCase(), r[0] + 85, r[1] + 50); });
  sheetTexture.needsUpdate = true;
  return sheetTexture;
}

// ---------------------------------------------------------------------------------------------------------------
// materials: made once and kept, so walking into a second shop compiles nothing. Per shop only the floor and the
// sheet change.
// ---------------------------------------------------------------------------------------------------------------
let MATS = null;
function materials() {
  if (MATS) return MATS;
  const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, roughness: 0.85, metalness: 0 }, o));
  MATS = {
    floor: std({ roughness: 0.5 }), matte: std({ map: noiseTex(), roughness: 0.95 }), wood: std({ map: woodTex(), roughness: 0.6 }),
    metal: std({ roughness: 0.34, metalness: 0.85, envMapIntensity: 2.2 }), gloss: std({ roughness: 0.16, metalness: 0.05, envMapIntensity: 1.6 }),
    goods: std({ map: goodsTex(), roughness: 0.75 }), sign: std({ emissive: 0xffffff, emissiveIntensity: 0.3, roughness: 0.8, vertexColors: false }),
    glass: std({ color: 0xcfe4ea, vertexColors: false, transparent: true, opacity: 0.14, roughness: 0.04, metalness: 0.3, depthWrite: false, side: THREE.DoubleSide }),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true }),
    mark: new THREE.MeshBasicMaterial({ color: 0x7bd88f, transparent: true, opacity: 0.42, depthWrite: false }),
    blob: new THREE.MeshBasicMaterial({ map: blobTex(), color: 0x000000, transparent: true, opacity: 0.34, depthWrite: false }),
  };
  return MATS;
}

// ---------------------------------------------------------------------------------------------------------------
// the builder: every piece goes into one buffer per material (world-space UVs for the tiling materials)
// ---------------------------------------------------------------------------------------------------------------
const UVK = { floor: 0.5, matte: 1.9, wood: 0.8 };
function makeKit() {
  const bufs = new Map(), stack = [new THREE.Matrix4()], colliders = [];
  const M = new THREE.Matrix4(), L = new THREE.Matrix4(), N = new THREE.Matrix3(), v = new THREE.Vector3(), Q = new THREE.Quaternion(), E = new THREE.Euler(0, 0, 0, "YXZ"), S = new THREE.Vector3(), T = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), D = new THREE.Vector3();
  const BOX = new THREE.BoxGeometry(1, 1, 1), PLANE = new THREE.PlaneGeometry(1, 1);
  const cur = () => stack[stack.length - 1];
  function push(mat, geo, m, col, uvCell) {
    let b = bufs.get(mat); if (!b) bufs.set(mat, (b = { p: [], n: [], u: [], c: [], i: [], v: 0 }));
    M.multiplyMatrices(cur(), m); N.getNormalMatrix(M);
    const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv, base = b.v, k = UVK[mat];
    for (let j = 0; j < pos.count; j++) {
      v.fromBufferAttribute(pos, j).applyMatrix4(M); const px = v.x, py = v.y, pz = v.z; b.p.push(px, py, pz);
      v.fromBufferAttribute(nor, j).applyMatrix3(N).normalize(); b.n.push(v.x, v.y, v.z);
      if (uvCell) b.u.push(uvCell[0] + (uvCell[2] - uvCell[0]) * uv.getX(j), uvCell[1] + (uvCell[3] - uvCell[1]) * uv.getY(j));
      else if (k) { const ax = Math.abs(v.x), ay = Math.abs(v.y), az = Math.abs(v.z); if (ay >= ax && ay >= az) b.u.push(px * k, pz * k); else if (ax >= az) b.u.push(pz * k, py * k); else b.u.push(px * k, py * k); }
      else if (mat === "goods") b.u.push((ATLAS.plain[0] + ATLAS.plain[2]) / 2, (ATLAS.plain[1] + ATLAS.plain[3]) / 2);
      else b.u.push(uv ? uv.getX(j) : 0, uv ? uv.getY(j) : 0);
      b.c.push(col[0], col[1], col[2]);
    }
    const idx = geo.index; for (let j = 0; j < idx.count; j++) b.i.push(base + idx.getX(j)); b.v += pos.count;
  }
  const mt = (x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0) => { E.set(rx, ry, rz); Q.setFromEuler(E); return L.compose(T.set(x, y, z), Q, S.set(sx, sy, sz)); };
  const K = {
    // box: centred on x,z; y is its bottom
    box(mat, x, y, z, w, h, d, col, ry = 0, uvCell) { push(mat, BOX, mt(x, y + h / 2, z, w, h, d, ry), col, uvCell); },
    // plane: centred on x,y,z; faces +z, then turned by ry (and rx: -PI/2 = faces up, +PI/2 = faces down)
    plane(mat, x, y, z, w, h, col, ry = 0, uvCell, rx = 0) { push(mat, PLANE, mt(x, y, z, w, h, 1, ry, rx), col, uvCell); },
    cyl(mat, x, y, z, rt, rb, h, col, seg = 10, o = {}) { const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, !!o.open); push(mat, g, mt(x, y + (o.center ? 0 : h / 2), z, 1, 1, 1, o.ry || 0, o.rx || 0, o.rz || 0), col, o.cell); },
    sph(mat, x, y, z, sx, sy, sz, col, ws = 8, hs = 6) { push(mat, new THREE.SphereGeometry(1, ws, hs), mt(x, y, z, sx, sy, sz), col); },
    lathe(mat, x, y, z, pts, col, seg = 10) { push(mat, new THREE.LatheGeometry(pts.map(([r, yy]) => new THREE.Vector2(r, yy)), seg), mt(x, y, z, 1, 1, 1), col); },
    torus(mat, x, y, z, R, r, col, ry = 0, rx = 0, ts = 14) { push(mat, new THREE.TorusGeometry(R, r, 5, ts), mt(x, y, z, 1, 1, 1, ry, rx), col); },
    // rod: a tube from a to b (legs, rails, frames)
    rod(mat, a, b, r, col, seg = 6, r2) { D.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); const len = D.length(); Q.setFromUnitVectors(UP, D.normalize());
      push(mat, new THREE.CylinderGeometry(r2 === undefined ? r : r2, r, len, seg, 1, true), L.compose(T.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), Q, S.set(1, 1, 1)), col); },
    // a wall panel from (x0,z0) to (x1,z1) between y0 and y1, lit from the +normal side; per-row colours give the soft shading
    wall(mat, x0, z0, x1, z1, y0, y1, cBottom, cTop, nx, nz) {
      let b = bufs.get(mat); if (!b) bufs.set(mat, (b = { p: [], n: [], u: [], c: [], i: [], v: 0 }));
      const base = b.v, k = UVK[mat] || 1, m = cur(), pts = [[x0, y0, z0], [x1, y0, z1], [x1, y1, z1], [x0, y1, z0]];
      const w = []; for (const p of pts) { v.set(p[0], p[1], p[2]).applyMatrix4(m); w.push([v.x, v.y, v.z]); b.p.push(v.x, v.y, v.z); }
      N.getNormalMatrix(m); v.set(nx, 0, nz).applyMatrix3(N).normalize(); const n = [v.x, v.y, v.z];
      for (let j = 0; j < 4; j++) { b.n.push(n[0], n[1], n[2]); const c = j < 2 ? cBottom : cTop; b.c.push(c[0], c[1], c[2]); b.u.push((Math.abs(n[0]) > Math.abs(n[2]) ? w[j][2] : w[j][0]) * k, w[j][1] * k); }
      const e1 = [w[1][0] - w[0][0], w[1][1] - w[0][1], w[1][2] - w[0][2]], e2 = [w[2][0] - w[0][0], w[2][1] - w[0][1], w[2][2] - w[0][2]];
      const flip = (e1[1] * e2[2] - e1[2] * e2[1]) * n[0] + (e1[2] * e2[0] - e1[0] * e2[2]) * n[1] + (e1[0] * e2[1] - e1[1] * e2[0]) * n[2] < 0;
      if (!flip) b.i.push(base, base + 1, base + 2, base, base + 2, base + 3); else b.i.push(base, base + 2, base + 1, base, base + 3, base + 2); b.v += 4;
    },
    // a soft dark patch on the floor under furniture (stands in for contact shadows: the shop has no shadow pass)
    blob(x, z, w, d, ry = 0) { push("blob", PLANE, mt(x, 0.012, z, w, d, 1, ry, -Math.PI / 2), WHITE); },
    // local frame: fn draws a piece facing +z around its own origin
    at(x, z, ry, fn, y = 0) { const m = new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z); stack.push(new THREE.Matrix4().multiplyMatrices(cur(), m)); try { fn(); } finally { stack.pop(); } },
    pt(x, y, z) { v.set(x, y, z).applyMatrix4(cur()); return { x: v.x, y: v.y, z: v.z }; },
    solid(x0, z0, x1, z1) { let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity; for (const [x, z] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]) { v.set(x, 0, z).applyMatrix4(cur()); a = Math.min(a, v.x); b = Math.max(b, v.x); c = Math.min(c, v.z); d = Math.max(d, v.z); }
      colliders.push({ x: (a + b) / 2, z: (c + d) / 2, width: b - a, depth: d - c }); },
    colliders,
    finish(group, mats) {
      let tris = 0; const meshes = [];
      for (const [mat, b] of bufs) {
        if (!b.v || !mats[mat]) continue;
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(b.p, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(b.n, 3));
        g.setAttribute("uv", new THREE.Float32BufferAttribute(b.u, 2)); g.setAttribute("color", new THREE.Float32BufferAttribute(b.c, 3));
        g.setIndex(b.v > 65000 ? new THREE.Uint32BufferAttribute(b.i, 1) : new THREE.Uint16BufferAttribute(b.i, 1)); g.computeBoundingSphere();
        const m = new THREE.Mesh(g, mats[mat]); m.name = "shop:" + mat; m.frustumCulled = false; if (mat === "blob") m.renderOrder = 1; if (mat === "glass" || mat === "mark") m.renderOrder = 2;
        group.add(m); meshes.push(m); tris += b.i.length / 3;
      }
      return { tris, meshes };
    },
  };
  return K;
}

// ---------------------------------------------------------------------------------------------------------------
// goods: what stands on a shelf. stock(K, style, x0, x1, y, z, R) fills one shelf board from x0 to x1 (front = +z).
// ---------------------------------------------------------------------------------------------------------------
const BOTTLE = [[0.036, 0], [0.036, 0.16], [0.013, 0.22], [0.013, 0.28]];
const VASES = [[[0, 0], [0.05, 0], [0.085, 0.09], [0.07, 0.2], [0.035, 0.26], [0.05, 0.3]], [[0, 0], [0.06, 0], [0.07, 0.16], [0.04, 0.2], [0.04, 0.24]], [[0, 0], [0.045, 0], [0.1, 0.12], [0.1, 0.16], [0.07, 0.2]]];
function stock(K, style, x0, x1, y, z, R) {
  let x = x0 + 0.03; const end = x1 - 0.03, lab = () => pick(R, ATLAS.labels), bright = () => C(pick(R, BRIGHT)), soft = () => mul(WHITE, 0.82 + R() * 0.18);
  const step = (w, fn) => { if (x + w > end) { x = end + 1; return; } fn(x + w / 2, w); x += w; };
  switch (style) {
    case "books": while (x < end) { if (R() < 0.12) { x += 0.05 + R() * 0.1; continue; } step(0.16 + R() * 0.34, (cx, w) => { const h = 0.19 + R() * 0.07; K.box("matte", cx, y, z - 0.01, w, h, 0.15, C("#e8dfc8")); K.plane("goods", cx, y + h / 2, z + 0.066, w, h, soft(), 0, pick(R, ATLAS.books)); }); } break;
    case "records": case "mags": { const s = style === "records" ? 0.3 : 0.2, hh = style === "records" ? 0.3 : 0.27; K.box("wood", (x0 + x1) / 2, y, z + 0.08, x1 - x0, 0.04, 0.03, C("#2a221c"));
      while (x < end) step(s + 0.025, (cx) => K.plane("goods", cx, y + hh / 2 + 0.01, z + 0.02, s, hh, soft(), 0, pick(R, ATLAS.covers), -0.16)); break; }
    case "boxes": while (x < end) step(0.13 + R() * 0.2, (cx, w) => { const h = 0.12 + R() * 0.2; K.box("goods", cx, y, z, w - 0.012, h, 0.16 + R() * 0.06, soft(), 0, lab()); }); break;
    case "cans": while (x < end) step(0.085, (cx) => { const c = lab(); const two = R() < 0.7; K.cyl("goods", cx, y, z + 0.05, 0.037, 0.037, 0.11, soft(), 6, { cell: c, open: two }); if (two) K.cyl("goods", cx, y + 0.11, z + 0.05, 0.037, 0.037, 0.11, soft(), 6, { cell: c }); }); break;
    case "paint": while (x < end) step(0.13, (cx) => { K.cyl("metal", cx, y, z + 0.03, 0.055, 0.055, 0.12, C("#b8bcc4"), 8); K.cyl("gloss", cx, y + 0.03, z + 0.03, 0.057, 0.057, 0.06, bright(), 8, { open: true }); }); break;
    case "bottles": { const tones = ["#2f5a36", "#6a3a18", "#c8d8d0", "#1e2a3a", "#8a2a2a", "#d8c890"]; while (x < end) step(0.085 + R() * 0.02, (cx) => K.lathe("gloss", cx, y, z + 0.04 - R() * 0.06, BOTTLE, C(pick(R, tones)), 6)); break; }
    case "jars": while (x < end) step(0.12, (cx) => { K.cyl("gloss", cx, y, z + 0.03, 0.048, 0.048, 0.13, bright(), 7, { open: true }); K.cyl("metal", cx, y + 0.13, z + 0.03, 0.05, 0.05, 0.018, C("#b8a060"), 7); }); break;
    case "bags": while (x < end) step(0.15, (cx) => { K.box("matte", cx, y, z + 0.02, 0.12, 0.2, 0.07, C(pick(R, ["#8a6a44", "#2a2622", "#b89a6a", "#6a2a22"]))); K.plane("goods", cx, y + 0.1, z + 0.057, 0.09, 0.09, WHITE, 0, lab()); }); break;
    case "cups": while (x < end) step(0.11, (cx) => { const n = 1 + Math.floor(R() * 3); K.cyl("gloss", cx, y, z + 0.03, 0.042, 0.032, 0.085 + (n - 1) * 0.022, C(pick(R, ["#f4efe6", "#f4efe6", "#d8e4e0", "#2a2e36"])), 9); }); break;
    case "plates": while (x < end) step(0.26, (cx) => K.cyl("gloss", cx, y, z + 0.02, 0.11, 0.07, 0.03 + R() * 0.06, C("#f1ede4"), 12)); break;
    case "folded": while (x < end) step(0.32, (cx) => { let yy = y; for (let k = 0; k < 2 + Math.floor(R() * 3); k++) { K.box("matte", cx, yy, z + 0.01, 0.27, 0.045, 0.22, C(pick(R, CLOTH))); yy += 0.047; } }); break;
    case "shoes": while (x < end) step(0.36, (cx) => { const c = C(pick(R, ["#2a2a2e", "#6a4a2e", "#c8c0b0", "#8a2a2a", "#2a3a5a", "#d8d2c4"])); for (const s of [-0.075, 0.075]) { K.box("matte", cx + s, y, z + 0.03, 0.1, 0.022, 0.27, C("#1a1a1a"), 0.25); K.sph("matte", cx + s - 0.012, y + 0.06, z + 0.0, 0.05, 0.052, 0.11, c, 6, 4); K.sph("matte", cx + s + 0.02, y + 0.045, z + 0.1, 0.045, 0.03, 0.07, c, 6, 4); } }); break;
    case "toys": while (x < end) step(0.2 + R() * 0.08, (cx) => { const t = Math.floor(R() * 4), c = bright();
      if (t === 0) K.sph("gloss", cx, y + 0.075, z + 0.03, 0.075, 0.075, 0.075, c);
      else if (t === 1) { K.box("matte", cx, y, z + 0.03, 0.14, 0.07, 0.07, c, 0.3); K.box("matte", cx, y + 0.07, z + 0.03, 0.07, 0.07, 0.07, bright(), -0.4); }
      else if (t === 2) { const f = C(pick(R, ["#b0804a", "#d8c8a8", "#8a6a4a"])); K.sph("matte", cx, y + 0.07, z + 0.03, 0.065, 0.07, 0.055, f); K.sph("matte", cx, y + 0.17, z + 0.03, 0.045, 0.045, 0.045, f); for (const s of [-1, 1]) K.sph("matte", cx + s * 0.035, y + 0.21, z + 0.03, 0.018, 0.018, 0.012, f, 5, 4); }
      else { K.cyl("gloss", cx, y, z + 0.03, 0.035, 0.04, 0.16, C("#e8e4dc"), 8); K.cyl("gloss", cx, y + 0.16, z + 0.03, 0.001, 0.036, 0.08, c, 8); } }); break;
    case "cameras": while (x < end) step(0.24, (cx) => { const body = R() < 0.5 ? C("#1e1f22") : C("#b8bcc0"); K.box("metal", cx, y, z + 0.02, 0.14, 0.085, 0.06, body); K.box("metal", cx - 0.02, y + 0.085, z + 0.02, 0.05, 0.025, 0.05, body);
      K.cyl("metal", cx + 0.01, y + 0.045, z + 0.075, 0.034, 0.03, 0.055, C("#141518"), 10, { rx: Math.PI / 2, center: true }); }); break;
    case "radios": while (x < end) step(0.36, (cx) => { const w = 0.3, h = 0.19; K.box("wood", cx, y, z + 0.01, w, h, 0.15, C(pick(R, ["#6a4428", "#3a2a1e", "#8a6a44"]))); K.plane("goods", cx - 0.05, y + h / 2, z + 0.087, 0.16, 0.14, WHITE, 0, ATLAS.grille); K.plane("glow", cx + 0.09, y + h / 2 + 0.03, z + 0.087, 0.07, 0.04, C("#f2c060")); }); break;
    case "plants": while (x < end) step(0.26, (cx) => { K.cyl("matte", cx, y, z + 0.02, 0.07, 0.05, 0.1, C("#a8603a"), 9); const gcol = C(pick(R, ["#3a6a36", "#4a7a3a", "#2f5a3a"])); for (let k = 0; k < 3; k++) K.sph("matte", cx + (R() - 0.5) * 0.08, y + 0.17 + k * 0.045, z + 0.02 + (R() - 0.5) * 0.06, 0.075, 0.06, 0.075, mul(gcol, 0.85 + R() * 0.3), 6, 4); }); break;
    case "vases": while (x < end) step(0.24, (cx) => K.lathe("gloss", cx, y, z + 0.02, pick(R, VASES), C(pick(R, ["#c8623a", "#3a6a8a", "#e8e0d0", "#5a7a5a", "#2a2e3a", "#d8a84a"])), 8)); break;
    case "bread": while (x < end) step(0.27, (cx) => { const c = C(pick(R, ["#c8843a", "#b8742e", "#d8a05a"])); if (R() < 0.3) K.cyl("matte", cx, y + 0.035, z + 0.03, 0.035, 0.035, 0.24, c, 8, { rz: Math.PI / 2, center: true }); else K.sph("matte", cx, y + 0.055, z + 0.03, 0.11, 0.06, 0.075, c, 8, 5); }); break;
    case "yarn": while (x < end) step(0.13, (cx) => { const c = C(pick(R, CLOTH.concat(BRIGHT))); K.sph("matte", cx, y + 0.06, z + 0.04, 0.062, 0.058, 0.062, c, 6, 4); if (R() < 0.6) K.sph("matte", cx + 0.06, y + 0.165, z + 0.02, 0.058, 0.055, 0.058, C(pick(R, BRIGHT)), 6, 4); }); break;
    case "tools": case "keys": { const s = 0.36; while (x < end) step(s + 0.01, (cx) => K.plane("goods", cx, y + s / 2 + 0.01, z - 0.1, s, s, WHITE, 0, style === "tools" ? ATLAS.tools : ATLAS.keys)); break; }
    case "clocks": while (x < end) step(0.34, (cx) => { const r = 0.11 + R() * 0.04; K.cyl("wood", cx, y + r + 0.02, z - 0.06, r + 0.02, r + 0.02, 0.05, C("#5a3a22"), 14, { rx: Math.PI / 2, center: true }); K.plane("goods", cx, y + r + 0.02, z - 0.03, r * 2, r * 2, WHITE, 0, ATLAS.clock); }); break;
    case "guitars": while (x < end) step(0.42, (cx) => guitar(K, cx, y, z, C(pick(R, ["#b8742e", "#7a2a22", "#d8b06a", "#1e1e22", "#2a5a7a"])))); break;
    default: while (x < end) step(0.2, (cx, w) => K.box("goods", cx, y, z, w - 0.02, 0.16, 0.16, soft(), 0, lab()));
  }
}
function guitar(K, x, y, z, c) {   // stands on the shelf, leaning on the wall
  K.cyl("gloss", x, y + 0.17, z, 0.17, 0.17, 0.07, c, 14, { rx: Math.PI / 2, center: true }); K.cyl("gloss", x, y + 0.38, z, 0.125, 0.125, 0.07, c, 12, { rx: Math.PI / 2, center: true });
  K.cyl("matte", x, y + 0.22, z + 0.037, 0.045, 0.045, 0.005, C("#1a1410"), 10, { rx: Math.PI / 2, center: true });
  K.box("wood", x, y + 0.46, z + 0.01, 0.045, 0.5, 0.025, C("#3a2a1e")); K.box("wood", x, y + 0.96, z + 0.01, 0.065, 0.13, 0.022, c);
}

// ---------------------------------------------------------------------------------------------------------------
// furniture and props (each is drawn facing +z around its own origin; place it with K.at)
// ---------------------------------------------------------------------------------------------------------------
function shelfUnit(K, w, style, R, woodC, o = {}) {   // against a wall: back at z = 0, front at z = depth
  const d = o.d || 0.32, h = o.h || 2.1, y0s = o.rows || [0.12, 0.54, 0.96, 1.38, 1.8];
  if (style === "guitars") { K.box("wood", 0, 0.5, d / 2, w, 0.05, d, woodC); stock(K, "guitars", -w / 2, w / 2, 0.55, 0.12, R); K.box("wood", 0, 0, d / 2, w, 0.5, d, mul(woodC, 0.8)); K.blob(0, d / 2 + 0.1, w + 0.3, d + 0.5); K.solid(-w / 2, 0, w / 2, d); return; }
  for (const s of [-1, 1]) K.box("wood", s * (w / 2 - 0.02), 0, d / 2, 0.04, h, d, woodC);
  K.plane("wood", 0, h / 2, 0.012, w, h, mul(woodC, 0.7));
  y0s.forEach((y, k) => { K.box("wood", 0, y - 0.03, d / 2, w - 0.08, 0.03, d, woodC); if (k < y0s.length - (o.topBare ? 1 : 0)) stock(K, Array.isArray(style) ? style[k % style.length] : style, -w / 2 + 0.05, w / 2 - 0.05, y, d / 2 + 0.02, R); });
  K.box("wood", 0, h - 0.04, d / 2, w, 0.04, d + 0.02, woodC);
  K.blob(0, d / 2 + 0.1, w + 0.3, d + 0.5); K.solid(-w / 2, 0, w / 2, d);
}
function chair(K, c, legC) {
  K.box("wood", 0, 0.43, 0, 0.4, 0.035, 0.4, c); K.box("wood", 0, 0.62, -0.19, 0.38, 0.3, 0.025, c);
  for (const sx of [-1, 1]) { K.rod("wood", [sx * 0.17, 0, 0.17], [sx * 0.17, 0.43, 0.17], 0.016, legC, 5); K.rod("wood", [sx * 0.17, 0, -0.18], [sx * 0.175, 0.92, -0.2], 0.016, legC, 5); }
}
function roundTable(K, c, metalC, r = 0.38) { K.cyl("wood", 0, 0.71, 0, r, r, 0.035, c, 16); K.rod("metal", [0, 0.02, 0], [0, 0.71, 0], 0.03, metalC, 8); K.cyl("metal", 0, 0, 0, 0.1, 0.24, 0.03, metalC, 12); K.blob(0, 0, r * 2.6, r * 2.6); K.solid(-r * 0.75, -r * 0.75, r * 0.75, r * 0.75); }
function stool(K, c, metalC) { K.cyl("gloss", 0, 0.62, 0, 0.17, 0.16, 0.06, c, 14); K.rod("metal", [0, 0.02, 0], [0, 0.62, 0], 0.025, metalC, 8); K.cyl("metal", 0, 0, 0, 0.06, 0.2, 0.025, metalC, 12); K.torus("metal", 0, 0.26, 0, 0.14, 0.012, metalC, 0, Math.PI / 2, 12); K.blob(0, 0, 0.6, 0.6); }
function booth(K, c, woodC) {   // against a wall (back at z = 0), two benches and a table, 1.7 m of wall
  for (const s of [-1, 1]) { K.box("matte", s * 0.6, 0.08, 0.6, 0.48, 0.37, 1.15, c); K.box("matte", s * 0.8, 0.08, 0.6, 0.1, 1.0, 1.15, mul(c, 0.9)); K.box("wood", s * 0.6, 0, 0.6, 0.5, 0.08, 1.17, mul(woodC, 0.6)); }
  K.box("wood", 0, 0.71, 0.56, 0.6, 0.04, 1.05, woodC); K.rod("metal", [0, 0, 0.7], [0, 0.71, 0.7], 0.035, C("#2a2c30"), 8);
  K.blob(0, 0.6, 2.0, 1.5); K.solid(-0.85, 0, 0.85, 1.2);
}
function pendant(K, x, z, shadeC, len = 0.75) {
  K.rod("metal", [x, H - len, z], [x, H, z], 0.006, C("#1a1a1a"), 4);
  K.lathe("metal", x, H - len - 0.2, z, [[0.2, 0], [0.19, 0.02], [0.11, 0.15], [0.035, 0.2], [0.03, 0.22]], shadeC, 12);
  K.sph("glow", x, H - len - 0.16, z, 0.06, 0.06, 0.06, C("#fff0c8"), 8, 6);
}
function panelLight(K, x, z, w = 1.2, d = 0.32) { K.box("metal", x, H - 0.04, z, w + 0.06, 0.04, d + 0.06, C("#d8d8d4")); K.plane("glow", x, H - 0.045, z, w, d, C("#fffaf0"), 0, null, Math.PI / 2); }
function plantPot(K, s = 1) {
  K.lathe("matte", 0, 0, 0, [[0, 0], [0.17 * s, 0], [0.22 * s, 0.4 * s], [0.2 * s, 0.42 * s]], C("#8a5a3a"), 10);
  const R = rng(91); for (let k = 0; k < 7; k++) { const a = k * 0.9, r = 0.05 + R() * 0.09; K.cyl("matte", Math.cos(a) * r, 0.4 * s, Math.sin(a) * r, 0.003, 0.06 * s, (0.7 + R() * 0.6) * s, C(pick(R, ["#3a6a36", "#2f5a34", "#4a7a3e"])), 5, { rx: Math.sin(a) * 0.25, rz: -Math.cos(a) * 0.25 }); }
  K.blob(0, 0, 0.8 * s, 0.8 * s);
}
function register(K, acc) {   // on the counter top: an old brass-and-enamel till
  K.box("metal", 0, 0, 0, 0.36, 0.1, 0.38, C("#3a342c")); K.box("gloss", 0, 0.1, -0.02, 0.32, 0.13, 0.3, acc); K.sph("gloss", 0, 0.23, -0.04, 0.16, 0.1, 0.14, acc, 10, 6);
  K.plane("goods", 0, 0.37, 0.02, 0.2, 0.09, WHITE, 0, ATLAS.screen); K.box("metal", 0, 0.3, 0, 0.22, 0.12, 0.03, C("#3a342c"));
  K.rod("metal", [0.19, 0.16, 0], [0.24, 0.3, 0.02], 0.012, C("#b8a060"), 5); K.sph("gloss", 0.24, 0.31, 0.02, 0.025, 0.025, 0.025, C("#1a1a1a"), 6, 5);
  for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) K.cyl("gloss", -0.1 + k * 0.066, 0.1 + r * 0.035, 0.14 + r * 0.01 - 0.02 * r, 0.02, 0.02, 0.02, C(r === 2 ? "#b8322a" : "#f1ece0"), 6);
}
function bike(K, c) {   // length along z, wheels on the floor
  const dk = C("#1a1b1e"), mt = C("#b8bcc4");
  for (const z of [-0.52, 0.52]) K.torus("gloss", 0, 0.35, z, 0.33, 0.022, dk, Math.PI / 2, 0, 18);
  const bb = [0, 0.33, -0.08], seat = [0, 0.86, -0.22], head = [0, 0.84, 0.36];
  K.rod("gloss", bb, seat, 0.02, c); K.rod("gloss", seat, head, 0.02, c); K.rod("gloss", bb, head, 0.023, c); K.rod("gloss", bb, [0, 0.35, -0.52], 0.015, c); K.rod("gloss", seat, [0, 0.35, -0.52], 0.013, c); K.rod("gloss", head, [0, 0.35, 0.52], 0.016, c);
  K.rod("metal", head, [0, 1.0, 0.33], 0.015, mt); K.rod("metal", [-0.27, 1.0, 0.33], [0.27, 1.0, 0.33], 0.014, mt); K.rod("metal", seat, [0, 0.95, -0.24], 0.014, mt); K.box("matte", 0, 0.95, -0.25, 0.14, 0.05, 0.26, dk);
}

// ---------------------------------------------------------------------------------------------------------------
// one shop
// ---------------------------------------------------------------------------------------------------------------
const GENERAL = { layout: "retail", floor: "wood", wall: "#e2dccb", accent: "#3a5a4a", goods: ["boxes", "jars", "cans"], center: "table", back: ["boxes"], icon: "store" };
export function shopKind(table, row) { const k = (table.kinds && table.kinds[row.kind]) || GENERAL; return Object.assign({}, GENERAL, k.layout === "service" && !k.center ? { center: null } : null, k, row.center ? { center: row.center } : null, row.floor ? { floor: row.floor } : null, row.wall ? { wall: row.wall } : null, row.accent ? { accent: row.accent } : null, row.goods ? { goods: row.goods } : null, row.props ? { props: row.props } : null, row.back ? { back: row.back } : null); }

function buildShop(slot, table, group) {
  const row = slot.row, kind = shopKind(table, row), R = rng(slot.seed ^ 0x5bd1e995), mats = materials();
  const job = row.job ? (table.jobs || []).find((j) => j.id === row.job) : null, working = job && job.kind === "orders" ? job : null;
  const W = clamp(slot.w - 0.8, 5.6, 10.5), hw = W / 2, Dm = kind.layout === "retail" ? 10 : 9.2, zB = -Dm;
  // the door is where it is on the facade, but never closer than 1.9 m to a side wall: whatever stands along a wall
  // (a booth, a barber's chair, a workbench) then never reaches the way in
  const dx = clamp(slot.doorS - slot.w / 2, -(hw - 1.9), hw - 1.9), ps = dx > 0 ? -1 : 1;   // ps: which side the staff pass and the back-room door are on
  const wallC = C(kind.wall), acc = C(kind.accent), dark = !!kind.dark;
  const woodC = dark ? C("#4a3526") : C("#a8845a"), woodD = dark ? C("#2e2219") : C("#6a4c32"), metalC = C("#2a2c30"), wains = mix(wallC, acc, dark ? 0.25 : 0.42), ceilC = dark ? mul(wallC, 1.25) : C("#f2efe8");
  const K = makeKit(), stations = [], spots = { queue: [], work: {} };
  const st = (o) => { stations.push(o); return o; };

  // ---- shell: floor, ceiling, two-tone walls (darker toward the floor and the ceiling: the soft shading a bake would give)
  K.plane("floor", 0, 0, -(Dm + BACK) / 2, W, Dm + BACK, WHITE, 0, null, -Math.PI / 2);
  K.plane("matte", 0, H, -(Dm + BACK) / 2, W, Dm + BACK, ceilC, 0, null, Math.PI / 2);
  const wallBands = (x0, z0, x1, z1, nx, nz, ya = 0, yb = H) => {
    const bands = [[0, 0.95, mul(wains, 0.62), wains], [0.95, 1.0, mul(wains, 0.75), mul(wains, 0.75)], [1.0, 2.5, wallC, wallC], [2.5, H, wallC, mul(wallC, 0.8)]];
    for (const [a, b, c0, c1] of bands) { const lo = Math.max(a, ya), hi = Math.min(b, yb); if (hi - lo > 0.001) K.wall("matte", x0, z0, x1, z1, lo, hi, a === lo ? c0 : mix(c0, c1, (lo - a) / (b - a)), b === hi ? c1 : mix(c0, c1, (hi - a) / (b - a)), nx, nz); }
  };
  wallBands(-hw, 0, -hw, -(Dm + BACK), 1, 0); wallBands(hw, -(Dm + BACK), hw, 0, -1, 0); wallBands(-hw, -(Dm + BACK), hw, -(Dm + BACK), 0, 1);
  for (const s of [-1, 1]) K.box("wood", s * (hw - 0.012), 0, -(Dm + BACK) / 2, 0.024, 0.11, Dm + BACK, woodD);
  // back partition with the doorway to the back room
  const px = ps * (hw - 0.8), pa = px - 0.55, pb = px + 0.55;
  for (const [n, zz] of [[1, zB + 0.06], [-1, zB - 0.06]]) { wallBands(-hw, zz, pa, zz, 0, n); wallBands(pb, zz, hw, zz, 0, n); wallBands(pa, zz, pb, zz, 0, n, 2.15, H); }
  for (const xx of [pa, pb]) K.box("wood", xx, 0, zB, 0.07, 2.15, 0.16, woodD); K.box("wood", px, 2.15, zB, 1.24, 0.07, 0.16, woodD);
  K.plane("sign", px, 2.42, zB + 0.082, 0.72, 0.3, WHITE, 0, sheetUV(SHEET.staff));
  K.colliders.push({ x: (-hw + pa) / 2, z: zB, width: pa + hw, depth: 0.22 }, { x: (pb + hw) / 2, z: zB, width: hw - pb, depth: 0.22 });
  // the front: knee wall, glass, mullions, header, the door (the way out is the green mat, like every door in the city)
  const d0 = dx - 0.62, d1 = dx + 0.62, glassC = WHITE;
  for (const [a, b] of [[-hw, d0], [d1, hw]]) {
    if (b - a < 0.2) continue;
    K.box("matte", (a + b) / 2, 0, -0.15, b - a, 0.55, 0.3, wains); K.box("wood", (a + b) / 2, 0.55, -0.17, b - a, 0.035, 0.36, woodC);
    K.plane("glass", (a + b) / 2, 1.65, -0.05, b - a, 2.2, glassC, Math.PI);
    const n = Math.max(1, Math.round((b - a) / 1.7)); for (let k = 0; k <= n; k++) K.box("metal", a + (b - a) * k / n, 0.58, -0.05, 0.05, 2.17, 0.06, metalC);
  }
  K.box("matte", 0, 2.75, -0.1, W, H - 2.75, 0.2, wallC); K.box("metal", 0, 2.72, -0.05, W, 0.05, 0.07, metalC);
  for (const xx of [d0, d1]) K.box("metal", xx, 0, -0.05, 0.07, 2.75, 0.09, metalC); K.box("metal", dx, 2.18, -0.05, 1.24, 0.06, 0.09, metalC);
  K.plane("glass", dx, 1.09, -0.05, 1.17, 2.18, glassC, Math.PI); K.plane("glass", dx, 2.47, -0.05, 1.17, 0.5, glassC, Math.PI);
  K.rod("metal", [dx - 0.45, 1.05, -0.1], [dx + 0.45, 1.05, -0.1], 0.018, C("#b8bcc4"), 6); K.box("metal", dx, 0, -0.05, 1.17, 0.2, 0.03, metalC);
  K.plane("mark", dx, 0.014, -0.75, 1.5, 1.1, WHITE, 0, null, -Math.PI / 2);
  K.plane("sign", dx, 2.47, -0.09, 0.5, 0.25, WHITE, Math.PI, sheetUV(SHEET.exit));
  st({ kind: "exit", label: "Out to the street", x: dx, z: -0.8, hw: 0.85, hd: 0.75, y: 1.2, r: 0.9, tx: dx, tz: -0.05 });
  const lane = (x, z, pad = 0.9) => Math.abs(x - dx) < pad && z > -2.6;   // keep the way in clear

  // ---- the counter, the register, the keeper's spot, the back shelf, the shop's name
  const zc = zB + 2.55, ca = ps > 0 ? -hw + 0.02 : -hw + 1.25, cb = ps > 0 ? hw - 1.25 : hw - 0.02, cm = (ca + cb) / 2, cl = cb - ca;
  const xr = ps > 0 ? cb - 0.75 : ca + 0.75;
  K.box("wood", cm, 0.1, zc, cl, 0.88, 0.6, woodD); K.box("matte", cm, 0, zc, cl - 0.06, 0.1, 0.52, C("#1c1a18")); K.box("matte", cm, 0.2, zc + 0.305, cl - 0.3, 0.62, 0.012, mix(woodD, acc, 0.55));
  K.box("wood", cm, 0.98, zc, cl + 0.06, 0.05, 0.74, woodC); K.rod("wood", [ca - 0.03, 1.005, zc + 0.37], [cb + 0.03, 1.005, zc + 0.37], 0.026, woodC, 6);
  K.blob(cm, zc + 0.2, cl + 0.6, 1.5); K.colliders.push({ x: cm, z: zc, width: cl, depth: 0.74 });
  K.at(xr, zc - 0.02, 0, () => register(K, mix(acc, C("#b8a060"), 0.3)), 1.03);
  K.plane("sign", xr - ps * 0.62, 1.13, zc + 0.2, 0.3, 0.2, WHITE, -ps * 0.25, sheetUV(SHEET.notice)); K.box("wood", xr - ps * 0.62, 1.03, zc + 0.17, 0.3, 0.2, 0.012, woodD, -ps * 0.25);
  spots.keeper = { x: xr, z: zc - 0.82, yaw: 0 };
  const sell = (row.sells || [])[0];
  if (sell) st({ kind: "buy", item: sell.item, price: sell.price, label: "", x: xr, z: zc + 0.95, hw: 1.0, hd: 0.65, y: 1.25, r: 0.55, tx: xr, tz: zc });
  // back shelf: a cabinet with shelves of the shop's goods above it; cafes keep their machines on it
  const ba = ps > 0 ? -hw + 0.15 : pb + 0.2, bbx = ps > 0 ? pa - 0.2 : hw - 0.15, bm = (ba + bbx) / 2, bl = bbx - ba, zs = zB + 0.31, cafe = kind.layout === "cafe", bank = kind.stations === "teller";
  if (!bank) {
    K.box("wood", bm, 0, zs, bl, 0.9, 0.5, woodD); K.box("wood", bm, 0.9, zs, bl + 0.04, 0.045, 0.54, woodC); K.blob(bm, zs + 0.2, bl + 0.4, 1.0); K.colliders.push({ x: bm, z: zs, width: bl, depth: 0.5 });
    const back = (kind.back && kind.back.length ? kind.back : ["boxes"]), boards = cafe ? [1.52] : [1.32, 1.74, 2.16];
    boards.forEach((y, k) => { K.box("wood", bm, y - 0.035, zB + 0.2, bl, 0.035, 0.26, woodC); for (let xx = ba + 0.2; xx < bbx; xx += 1.1) K.rod("metal", [xx, y - 0.035, zB + 0.3], [xx, y - 0.2, zB + 0.08], 0.008, metalC, 4); stock(K, back[k % back.length], ba + 0.05, bbx - 0.05, y, zB + 0.2, R); });
    if (!cafe && !working) stock(K, back[0], ba + 0.1, bbx - 0.1, 0.945, zs, R);
  }
  const nameW = Math.min(bl - 0.2, 2.9);
  K.plane("sign", bm, 2.98, zB + 0.082, nameW, nameW / 4, WHITE, 0, sheetUV(SHEET.name)); K.box("wood", bm, 2.98 - nameW / 8 - 0.03, zB + 0.068, nameW + 0.08, nameW / 4 + 0.06, 0.012, woodD);
  if (cafe) { K.plane("sign", bm, 2.16, zB + 0.082, 1.2, 1.0, WHITE, 0, sheetUV(SHEET.menu)); K.box("wood", bm, 1.64, zB + 0.068, 1.26, 1.04, 0.012, woodD); }
  else if (row.sells || row.menu) { K.plane("sign", ps * (hw - 0.03), 1.75, zc + 1.5, 0.96, 0.8, WHITE, -ps * Math.PI / 2, sheetUV(SHEET.menu)); }

  // ---- work stations for an "orders" job (the barista): one prop and one label per step, along the back shelf
  if (working) {
    const ids = Object.keys(working.stations || {}), n = ids.length, y = 0.945;
    ids.forEach((id, k) => {
      const x = n > 1 ? ba + 0.55 + (bl - 1.1) * k / (n - 1) : bm, z = zs;
      if (id === "cup") { for (let c = 0; c < 3; c++) K.cyl("gloss", x - 0.12 + c * 0.12, y, z, 0.045, 0.034, 0.2 + c * 0.05, C("#f4efe6"), 9); }
      else if (id === "espresso") espresso(K, x, y, z);
      else if (id === "milk") { K.lathe("metal", x - 0.1, y, z, [[0, 0], [0.055, 0], [0.06, 0.12], [0.045, 0.15], [0.05, 0.16]], C("#c8ccd0"), 10); K.cyl("gloss", x + 0.08, y, z, 0.045, 0.045, 0.22, C("#f6f4ee"), 9); K.cyl("gloss", x + 0.08, y + 0.22, z, 0.02, 0.04, 0.05, C("#3a7ab8"), 8); }
      else if (id === "water") { K.cyl("metal", x, y, z, 0.085, 0.095, 0.4, C("#c8ccd0"), 12); K.sph("metal", x, y + 0.4, z, 0.085, 0.04, 0.085, C("#c8ccd0"), 10, 5); K.rod("metal", [x, y + 0.14, z + 0.09], [x, y + 0.12, z + 0.16], 0.012, metalC, 5); K.sph("glow", x, y + 0.27, z + 0.092, 0.012, 0.012, 0.006, C("#ff7a4a"), 5, 4); }
      else if (id === "choc") { for (let c = 0; c < 3; c++) { const bx = x - 0.11 + c * 0.11; K.cyl("gloss", bx, y, z, 0.04, 0.04, 0.2, C(["#4a2a1a", "#8a5a2a", "#e8d8b8"][c]), 8); K.rod("metal", [bx, y + 0.2, z], [bx, y + 0.27, z + 0.04], 0.008, metalC, 4); } }
      else if (id === "tea") { K.box("goods", x - 0.1, y, z, 0.13, 0.13, 0.13, WHITE, 0, pick(R, ATLAS.labels)); K.box("goods", x - 0.1, y + 0.13, z, 0.13, 0.1, 0.13, WHITE, 0.2, pick(R, ATLAS.labels)); K.sph("gloss", x + 0.1, y + 0.08, z, 0.085, 0.075, 0.085, C("#3a6a5a"), 9, 6); K.rod("gloss", [x + 0.17, y + 0.07, z], [x + 0.25, y + 0.13, z], 0.012, C("#3a6a5a"), 5); }
      else K.box("goods", x, y, z, 0.2, 0.2, 0.2, WHITE, 0, pick(R, ATLAS.labels));
      K.plane("sign", x, 1.28, zB + 0.082, 0.42, 0.14, WHITE, 0, sheetUV(SHEET.label(k)));
      spots.work[id] = st({ kind: "work", id, off: true, label: working.stations[id], x, z: zs + 0.75, hw: Math.max(0.3, Math.min(0.5, (bl - 1.1) / Math.max(1, n - 1) / 2 - 0.02)), hd: 0.55, y: 1.15, r: 0.33, tx: x, tz: zs, reach: 2.6 });
    });
    const lo = ps > 0 ? ca + 2.2 : ca + 2.1, sx = clamp(dx, lo, Math.max(lo, ps > 0 ? cb - 2.1 : cb - 2.2));   // where the customers come up to the counter (clear of the till and the pastry case)
    spots.serve = st({ kind: "serve", off: true, label: "Hand it over", x: sx, z: zc - 0.62, hw: 0.9, hd: 0.26, y: 1.1, r: 0.5, tx: sx, tz: zc + 0.1, reach: 3.2 });
    for (let k = 0; k < 3; k++) spots.queue.push({ x: sx + (k === 0 ? 0 : (k === 1 ? 0.75 : -0.75)), z: zc + 0.92 + (k ? 0.35 : 0), yaw: Math.PI });
    spots.door = { x: dx, z: -1.0 };
  } else if (cafe) {
    const props = kind.props || [], spotsX = [ba + 0.6, bm - 0.9, bbx - 0.7]; let n = 0;
    for (const p of props) {
      if (p === "espresso") espresso(K, spotsX[n++ % 3], 0.945, zs);
      else if (p === "grill") { const x = spotsX[n++ % 3] + 0.2; K.box("metal", x, 0.945, zs, 1.0, 0.08, 0.46, C("#3a3c40")); K.box("metal", x, 2.2, zs - 0.02, 1.2, 0.5, 0.46, C("#b8bcc4")); K.box("metal", x, 2.7, zs - 0.08, 0.5, H - 2.7, 0.3, C("#a8acb4")); }
      else if (p === "oven") { const x = bbx - 0.9; K.box("matte", x, 0.945, zs - 0.03, 1.3, 1.25, 0.44, C("#a8573e")); K.cyl("matte", x, 1.2, zs + 0.2, 0.34, 0.34, 0.03, C("#1a1210"), 14, { rx: Math.PI / 2, center: true }); K.plane("glow", x, 1.14, zs + 0.222, 0.44, 0.2, C("#ff9a3a")); K.box("matte", x, 2.195, zs - 0.08, 0.5, H - 2.195, 0.3, C("#8a4632")); }
      else if (p === "breadrack") stock(K, "bread", ba + 0.1, bbx - 0.1, 0.945, zs, R);
    }
  }
  // things that sit on the counter itself
  const onCounter = cafe && !working ? (kind.props || []) : working ? ["pastry"] : [];
  const cx0 = ps > 0 ? ca + 0.85 : cb - 0.85;   // the end of the counter away from the register
  if (onCounter.includes("pastry") || onCounter.includes("tubs")) {
    const tubs = onCounter.includes("tubs"), w = 1.3, y = 1.03;
    K.box("gloss", cx0, y, zc + 0.05, w, 0.03, 0.5, C("#e8e4dc"));
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) K.rod("metal", [cx0 + a * w / 2, y, zc + 0.05 + b * 0.25], [cx0 + a * w / 2, y + 0.42, zc + 0.05 + b * 0.25], 0.01, C("#b8bcc4"), 4);
    K.plane("glass", cx0, y + 0.21, zc + 0.3, w, 0.42, WHITE); K.plane("glass", cx0, y + 0.42, zc + 0.05, w, 0.5, WHITE, 0, null, -Math.PI / 2); for (const s of [-1, 1]) K.plane("glass", cx0 + s * w / 2, y + 0.21, zc + 0.05, 0.5, 0.42, WHITE, Math.PI / 2);
    if (tubs) for (let k = 0; k < 6; k++) K.cyl("gloss", cx0 - 0.5 + (k % 3) * 0.5 - 0.0, y + 0.03, zc + (k < 3 ? -0.07 : 0.17), 0.1, 0.1, 0.08, C(["#f4d8e0", "#6a3a22", "#f2e6a8", "#a8d8b0", "#e8a05a", "#c8a0d8"][k]), 12);
    else { K.box("gloss", cx0, y + 0.2, zc + 0.03, w - 0.06, 0.012, 0.4, C("#e8e4dc"));
      for (let k = 0; k < 12; k++) { const px2 = cx0 - 0.52 + (k % 6) * 0.21, top = k >= 6, py = y + 0.03 + (top ? 0.185 : 0), pz = zc + 0.08 + (R() - 0.5) * 0.12, t = Math.floor(R() * 3);
        if (t === 0) K.torus("matte", px2, py + 0.02, pz, 0.045, 0.02, C(pick(R, ["#c8843a", "#6a3a22", "#e8a0b0"])), 0, Math.PI / 2, 10); else if (t === 1) K.sph("matte", px2, py + 0.03, pz, 0.07, 0.035, 0.045, C("#c88a3e"), 7, 5); else { K.cyl("matte", px2, py, pz, 0.04, 0.03, 0.045, C("#8a5a32"), 8); K.sph("matte", px2, py + 0.05, pz, 0.048, 0.035, 0.048, C(pick(R, ["#6a3a22", "#d8a85a", "#3a2418"])), 7, 5); } } }
  }
  if (onCounter.includes("taps")) { const x = cm; K.box("metal", x, 1.03, zc - 0.12, 0.7, 0.34, 0.12, C("#c8ccd0")); for (let k = 0; k < 4; k++) { const tx = x - 0.24 + k * 0.16; K.rod("gloss", [tx, 1.3, zc - 0.05], [tx, 1.5, zc + 0.02], 0.017, C(pick(R, BRIGHT)), 6); K.rod("metal", [tx, 1.28, zc - 0.06], [tx, 1.22, zc + 0.02], 0.012, metalC, 5); } }

  // ---- the job board (a time clock) at the staff pass, or the hours card
  K.plane("sign", ps * (hw - 0.03), 1.6, zc + 0.05, 0.62, 0.62, WHITE, -ps * Math.PI / 2, sheetUV(SHEET.job)); K.box("wood", ps * (hw - 0.014), 1.26, zc + 0.05, 0.02, 0.68, 0.68, woodD);
  if (working) { K.box("metal", ps * (hw - 0.06), 1.0, zc + 0.05, 0.1, 0.2, 0.22, C("#3a3c40")); K.plane("glow", ps * (hw - 0.112), 1.12, zc + 0.05, 0.1, 0.05, C("#7bd88f"), -ps * Math.PI / 2);
    st({ kind: "clock", job: working.id, label: "", x: ps * (hw - 0.7), z: zc + 0.05, hw: 0.62, hd: 0.8, y: 1.5, r: 0.5, tx: ps * (hw - 0.03), tz: zc + 0.05 }); }

  // ---- the poster that opens another part of the Observatory (the first world's rule: things inside go somewhere)
  const ls = -ps, lz = -1.7;
  if (row.link) { K.plane("sign", ls * (hw - 0.03), 1.62, lz, 0.78, 1.04, WHITE, -ls * Math.PI / 2, sheetUV(SHEET.link)); K.box("wood", ls * (hw - 0.014), 1.07, lz, 0.02, 1.1, 0.84, woodD);
    st({ kind: "link", link: row.link, label: row.link.label, x: ls * (hw - 0.85), z: lz, hw: 0.8, hd: 0.8, y: 1.6, r: 0.6, tx: ls * (hw - 0.03), tz: lz }); }

  // ---- the customer floor, by layout
  const fz0 = zc + 1.75, fz1 = -1.1, sideX = (s) => s * hw, facing = (s) => (s < 0 ? Math.PI / 2 : -Math.PI / 2);   // a piece on the wall at side s faces into the room
  const centre = (c) => {   // what stands in the middle of the floor
    const goods = kind.goods && kind.goods.length ? kind.goods : ["boxes"], cz = (fz0 + fz1) / 2 - 0.4;
    if (c === "gondola" || c === "crates") { const xs = W > 9.6 ? [-hw * 0.38, hw * 0.38] : [0];
      for (const gx of xs) K.at(gx, cz, Math.PI / 2, () => { if (c === "gondola") { K.box("wood", 0, 0, 0, 2.3, 1.35, 0.05, woodD); K.box("wood", 0, 0, 0, 2.3, 0.12, 0.8, woodD);
          for (const f of [0, Math.PI]) K.at(0, 0, f, () => [0.12, 0.52, 0.92].forEach((y, k) => { K.box("wood", 0, y - 0.03, 0.2, 2.3, 0.03, 0.36, woodC); stock(K, goods[(k + (f ? 1 : 0)) % goods.length], -1.12, 1.12, y, 0.2, R); }));
        } else for (let k = 0; k < 3; k++) { const x = -0.8 + k * 0.8, fr = C(["#c8423a", "#6a9a3a", "#e08a2a"][k]); K.box("wood", x, 0.35, 0, 0.7, 0.3, 0.75, woodC); for (const [lx, lz2] of [[-0.3, -0.3], [0.3, -0.3], [0.3, 0.3], [-0.3, 0.3]]) K.rod("wood", [x + lx, 0, lz2], [x + lx, 0.35, lz2], 0.02, woodD, 4);
          for (let a = 0; a < 12; a++) K.sph("gloss", x - 0.24 + (a % 4) * 0.16, 0.69, -0.24 + Math.floor(a / 4) * 0.24, 0.07, 0.065, 0.07, mul(fr, 0.85 + R() * 0.3), 6, 4); }
        K.blob(0, 0, 2.7, 1.3); K.solid(-1.15, -0.4, 1.15, 0.4); }); }
    else if (c === "table" || c === "telescopes") for (const tx0 of c === "table" && W > 8.6 ? [-hw * 0.36, hw * 0.36] : [0]) K.at(tx0, cz, 0, () => { K.box("wood", 0, 0.74, 0, 1.6, 0.05, 0.85, woodC); for (const [lx, lz2] of [[-0.72, -0.36], [0.72, -0.36], [0.72, 0.36], [-0.72, 0.36]]) K.rod("wood", [lx, 0, lz2], [lx, 0.74, lz2], 0.028, woodD, 5, 0.035);
        stock(K, goods[0], -0.75, 0.75, 0.79, 0.18, R); K.at(0, 0, Math.PI, () => stock(K, goods[goods.length > 1 ? 1 : 0], -0.75, 0.75, 0.79, 0.18, R)); K.blob(0, 0, 2.0, 1.25); K.solid(-0.8, -0.42, 0.8, 0.42);
        if (c === "telescopes") for (const s of [-1, 1]) K.at(s * 1.75, 0.2, s * 0.6, () => { for (let k = 0; k < 3; k++) { const a = k * 2.094; K.rod("wood", [Math.sin(a) * 0.42, 0, Math.cos(a) * 0.42], [0, 1.15, 0], 0.016, woodD, 5); } K.cyl("gloss", 0, 1.3, 0.05, 0.065, 0.075, 0.95, C("#e8e4dc"), 12, { rx: -1.05, center: true }); K.cyl("metal", 0, 1.3, 0.05, 0.08, 0.08, 0.1, C("#b8a060"), 12, { rx: -1.05, center: true }); K.blob(0, 0, 1.0, 1.0); K.solid(-0.3, -0.3, 0.3, 0.3); }); });
    else if (c === "bins") for (const bx of W > 9 ? [-hw * 0.36, hw * 0.36] : [0]) for (const bz of [cz + 0.55, cz - 0.55]) K.at(bx, bz, 0, () => { for (let k = 0; k < 3; k++) { const x = -0.62 + k * 0.62; K.box("wood", x, 0.72, 0, 0.56, 0.22, 0.42, woodC); for (let rr = 0; rr < 6; rr++) K.plane("goods", x, 1.0, -0.15 + rr * 0.06, 0.48, 0.34, mul(WHITE, 0.85 + R() * 0.15), 0, pick(R, ATLAS.covers), -0.12); }
        for (const [lx, lz2] of [[-0.85, -0.17], [0.85, -0.17], [0.85, 0.17], [-0.85, 0.17]]) K.rod("wood", [lx, 0, lz2], [lx, 0.72, lz2], 0.022, woodD, 4); K.blob(0, 0, 2.2, 0.9); K.solid(-0.92, -0.22, 0.92, 0.22); });
    else if (c === "racks") for (const s of W > 8 ? [-1, 1] : [0]) K.at(s * hw * 0.34, cz, Math.PI / 2, () => { for (const e of [-0.8, 0.8]) { K.rod("metal", [e, 0, 0], [e, 1.5, 0], 0.016, C("#b8bcc4"), 6); K.rod("metal", [e, 0.02, -0.25], [e, 0.02, 0.25], 0.016, C("#b8bcc4"), 4); } K.rod("metal", [-0.8, 1.5, 0], [0.8, 1.5, 0], 0.014, C("#b8bcc4"), 6);
        for (let g = 0; g < 11; g++) { const gh = 0.55 + R() * 0.3; K.box("matte", -0.7 + g * 0.14, 1.44 - gh, 0, 0.035, gh, 0.42, C(pick(R, CLOTH))); } K.blob(0, 0, 2.0, 0.9); K.solid(-0.82, -0.24, 0.82, 0.24); });
    else if (c === "bikes") for (let k = 0; k < (W > 8 ? 4 : 3); k++) K.at(-((W > 8 ? 3 : 2) * 0.45) + k * 0.9, cz, 0.35, () => { bike(K, C(pick(R, ["#d0562a", "#2a5a8a", "#2f6a3a", "#b8a030", "#1e1e22", "#b84a7a"]))); K.blob(0, 0, 0.5, 1.9); K.solid(-0.2, -0.75, 0.2, 0.75); });
    else if (c === "buckets") K.at(0, cz, 0, () => { for (let t = 0; t < 3; t++) K.box("wood", 0, t * 0.22, -0.3 + t * 0.3, 2.0, 0.22, 0.3, woodC);
        for (let t = 0; t < 3; t++) for (let k = 0; k < 5; k++) { const x = -0.8 + k * 0.4, y = (t + 1) * 0.22 - (t === 2 ? 0 : 0), z = -0.3 + t * 0.3 - 0.0; K.cyl("metal", x, t * 0.22 + 0.22, z, 0.11, 0.085, 0.22, C("#3a4a44"), 9); const fc = C(pick(R, ["#e84a5a", "#f2c230", "#f4f0e8", "#d86ad0", "#f08a3a", "#8a6ad8"]));
          K.cyl("matte", x, t * 0.22 + 0.44, z, 0.1, 0.03, 0.22, C("#3a6a36"), 7, { open: true }); for (let b = 0; b < 4; b++) K.sph("matte", x + Math.cos(b * 1.57) * 0.07, t * 0.22 + 0.67 + (b % 2) * 0.03, z + Math.sin(b * 1.57) * 0.07, 0.055, 0.045, 0.055, mul(fc, 0.85 + R() * 0.3), 6, 4); }
        K.blob(0, 0, 2.4, 1.3); K.solid(-1.0, -0.46, 1.0, 0.46); });
    else if (c === "bench") K.at(0, cz, 0, () => { K.box("wood", 0, 0.38, 0, 1.5, 0.06, 0.42, woodC); for (const e of [-0.65, 0.65]) K.box("wood", e, 0, 0, 0.06, 0.38, 0.38, woodD); K.blob(0, 0, 1.9, 0.8); K.solid(-0.75, -0.21, 0.75, 0.21);
        K.at(1.4, -0.3, -0.5, () => { K.box("wood", 0, 0.42, 0, 0.5, 0.42, 0.3, C("#1e1e22")); K.plane("goods", 0, 0.63, 0.152, 0.4, 0.32, WHITE, 0, ATLAS.grille); K.blob(0, 0.42, 0.8, 0.6); }); });
  };
  if (kind.layout === "cafe") {
    const seating = kind.seating || ["tables"], bs = -ps;   // booths go on the wall away from the staff pass... and away from the door lane
    if (seating.includes("booths")) for (let k = 0; k < 2; k++) { const z = fz1 - 1.3 - k * 1.95; if (z - 0.9 < fz0 - 0.4 || (row.link && Math.abs(z - lz) < 1.5 && bs === ls)) continue; K.at(sideX(bs), z, facing(bs), () => booth(K, mix(acc, C("#7a2a2a"), 0.2), woodC)); }
    if (seating.includes("stools") && !working) for (let x = ca + 0.5; x <= cb - 0.4; x += 0.72) { if (Math.abs(x - xr) < 1.0) continue; K.at(x, zc + 0.72, 0, () => stool(K, acc, C("#b8bcc4"))); }
    if (seating.includes("tables")) {
      const nc = Math.max(2, Math.floor((W - 1.4) / 2.3)), cols = Array.from({ length: nc }, (_, k) => -hw + 1.25 + (W - 2.5) * k / (nc - 1)), rows = [-2.1, -4.2];
      for (const tx of cols) for (const tz of rows) { if (lane(tx, tz, 1.25) || tz < fz0 + 0.3 || (seating.includes("booths") && Math.sign(tx) === bs && Math.abs(tx) > hw - 2.6)) continue;
        K.at(tx, tz, R() * 0.6, () => { roundTable(K, woodC, metalC); for (let c = 0; c < 2 + (R() < 0.5 ? 1 : 0); c++) { const a = c * 2.2 + 0.4; K.at(Math.sin(a) * 0.62, Math.cos(a) * 0.62, a + Math.PI, () => chair(K, woodD, mul(woodD, 0.8))); } K.cyl("gloss", 0.1, 0.745, 0.05, 0.035, 0.028, 0.07, C("#f4efe6"), 8); }); }
    }
  } else if (kind.layout === "retail") {
    const goods = kind.goods && kind.goods.length ? kind.goods : ["boxes"]; let gi = 0;
    for (const s of [-1, 1]) for (let z = fz1 - 0.5; z - 0.6 > fz0 - 0.9; z -= 1.3) {
      if (row.link && s === ls && Math.abs(z - lz) < 1.25) continue;
      if (s === ps && z < zc + 2.2) continue;   // leave the menu board and the pass clear
      const style = goods[gi++ % goods.length]; K.at(sideX(s) - s * 0.02, z, facing(s), () => shelfUnit(K, 1.2, style, R, woodC));
    }
    centre(kind.center);
  } else {
    const kindS = kind.stations, ws = -ps;   // the working wall is the one away from the staff pass
    const along = (n, gap, fn) => { for (let k = 0; k < n; k++) { const z = fz1 - 0.7 - k * gap; if (z < fz0 - 0.3 || (row.link && ws === ls && Math.abs(z - lz) < 1.1)) continue; K.at(sideX(ws), z, facing(ws), () => fn(k)); } };
    if (kindS === "barber") along(3, 1.55, () => { K.plane("gloss", 0, 1.55, 0.03, 0.8, 1.05, C("#b9c8d0")); K.box("wood", 0, 1.0, 0.012, 0.9, 1.15, 0.02, woodD); K.box("wood", 0, 0.93, 0.14, 0.9, 0.035, 0.26, woodC); stock(K, "bottles", -0.42, 0.42, 0.965, 0.12, R);
        K.at(0, 1.05, Math.PI, () => { K.cyl("metal", 0, 0, 0, 0.24, 0.28, 0.05, C("#b8bcc4"), 14); K.rod("metal", [0, 0.05, 0], [0, 0.42, 0], 0.05, C("#b8bcc4"), 8); K.box("matte", 0, 0.42, 0, 0.52, 0.12, 0.5, acc); K.box("matte", 0, 0.54, -0.23, 0.48, 0.62, 0.1, acc); K.sph("matte", 0, 1.22, -0.23, 0.12, 0.07, 0.06, acc, 7, 5);
          for (const s of [-1, 1]) { K.box("metal", s * 0.28, 0.66, 0, 0.05, 0.03, 0.42, C("#b8bcc4")); K.rod("metal", [s * 0.28, 0.5, 0.15], [s * 0.28, 0.66, 0.15], 0.012, C("#b8bcc4"), 4); } K.box("metal", 0, 0.2, 0.36, 0.34, 0.025, 0.18, C("#b8bcc4")); K.blob(0, 0, 1.1, 1.1); K.solid(-0.3, -0.3, 0.3, 0.3); }); });
    else if (kindS === "washers") { for (const s of [-1, 1]) for (let k = 0; k < 5; k++) { const z = fz1 - 0.5 - k * 0.68; if (z < fz0 - 0.2 || (s === ps && z < zc + 2.1) || (row.link && s === ls && Math.abs(z - lz) < 1.0) || lane(sideX(s) - s * 0.4, z, 0.8)) continue;
        K.at(sideX(s), z, facing(s), () => { for (const y of [0, 0.9]) { K.box("gloss", 0, y, 0.3, 0.64, 0.88, 0.6, C("#eef0f0")); K.torus("metal", 0, y + 0.42, 0.605, 0.19, 0.03, C("#b8bcc4"), 0, 0, 16); K.cyl("gloss", 0, y + 0.42, 0.6, 0.17, 0.17, 0.02, C(y ? "#1e2a36" : "#2a3a4a"), 14, { rx: Math.PI / 2, center: true }); K.plane("goods", 0, y + 0.8, 0.602, 0.5, 0.09, WHITE, 0, ATLAS.screen); } K.blob(0, 0.35, 0.9, 1.0); K.solid(-0.32, 0, 0.32, 0.6); }); }
      K.at(0, (fz0 + fz1) / 2, 0, () => { K.box("wood", 0, 0.86, 0, 1.8, 0.05, 0.8, C("#e8e4dc")); for (const [lx, lz2] of [[-0.8, -0.32], [0.8, -0.32], [0.8, 0.32], [-0.8, 0.32]]) K.rod("metal", [lx, 0, lz2], [lx, 0.86, lz2], 0.02, C("#b8bcc4"), 5); stock(K, "folded", -0.8, 0.8, 0.91, 0, R); K.blob(0, 0, 2.2, 1.2); K.solid(-0.9, -0.4, 0.9, 0.4); }); }
    else if (kindS === "nails") along(3, 1.5, () => K.at(0, 0.95, 0, () => { K.box("gloss", 0, 0.72, 0, 0.5, 0.04, 0.95, C("#f6f2ee")); for (const [lx, lz2] of [[-0.2, -0.42], [0.2, -0.42], [0.2, 0.42], [-0.2, 0.42]]) K.rod("metal", [lx, 0, lz2], [lx, 0.72, lz2], 0.014, C("#b8bcc4"), 4);
        K.rod("metal", [0.15, 0.76, -0.3], [0.05, 1.12, -0.12], 0.01, C("#b8bcc4"), 4); K.sph("glow", 0.04, 1.1, -0.1, 0.045, 0.03, 0.045, C("#fff4d8"), 6, 4); for (let b = 0; b < 6; b++) K.cyl("gloss", -0.16 + b * 0.065, 0.76, 0.3, 0.018, 0.018, 0.06, C(pick(R, BRIGHT)), 6);
        for (const s of [-1, 1]) K.at(s * 0.6, 0, s > 0 ? -Math.PI / 2 : Math.PI / 2, () => chair(K, acc, C("#b8bcc4"))); K.blob(0, 0, 1.7, 1.3); K.solid(-0.25, -0.47, 0.25, 0.47); }));
    else if (kindS === "sewing") { K.at(sideX(ws), fz1 - 1.0, facing(ws), () => { K.box("wood", 0, 0.74, 0.35, 1.5, 0.05, 0.62, woodC); for (const [lx, lz2] of [[-0.68, 0.08], [0.68, 0.08], [0.68, 0.6], [-0.68, 0.6]]) K.rod("wood", [lx, 0, lz2], [lx, 0.74, lz2], 0.025, woodD, 5);
          K.box("gloss", 0.2, 0.79, 0.35, 0.44, 0.05, 0.19, C("#1c1c20")); K.box("gloss", 0.38, 0.84, 0.35, 0.09, 0.26, 0.15, C("#1c1c20")); K.box("gloss", 0.2, 1.04, 0.35, 0.44, 0.09, 0.13, C("#1c1c20")); K.cyl("metal", 0.44, 0.97, 0.35, 0.06, 0.06, 0.03, C("#b8bcc4"), 10, { rz: Math.PI / 2, center: true }); K.cyl("matte", 0.05, 1.13, 0.35, 0.025, 0.025, 0.06, C("#c8423a"), 7);
          stock(K, "folded", -0.7, -0.15, 0.79, 0.35, R); K.blob(0, 0.35, 1.9, 1.0); K.solid(-0.75, 0, 0.75, 0.66); });
      for (let k = 0; k < 2; k++) K.at(sideX(ws) - ws * 0.6, fz1 - 2.9 - k * 1.1, facing(ws) + (k ? 0.3 : -0.2), () => { K.lathe("matte", 0, 0.95, 0, [[0, 0], [0.11, 0], [0.15, 0.1], [0.12, 0.26], [0.17, 0.42], [0.16, 0.5], [0.06, 0.56], [0.05, 0.62], [0, 0.63]], C(pick(R, ["#e8dcc4", "#3a4a66", "#7a2a2e"])), 12); K.rod("metal", [0, 0, 0], [0, 0.95, 0], 0.016, metalC, 5); K.cyl("metal", 0, 0, 0, 0.05, 0.2, 0.03, metalC, 10); K.blob(0, 0, 0.7, 0.7); }); }
    else if (kindS === "printers") { along(2, 1.5, (k) => { K.box("gloss", 0, 0, 0.36, 0.72, 0.95, 0.66, C("#dcdcd8")); K.box("gloss", 0, 0.95, 0.36, 0.74, 0.1, 0.68, C("#3a3c40")); K.plane("goods", 0.2, 1.1, 0.6, 0.2, 0.14, WHITE, 0, ATLAS.screen, -0.6); K.box("gloss", 0, 0.5, 0.74, 0.5, 0.03, 0.14, C("#f4f4f0")); K.blob(0, 0.4, 1.0, 1.1); K.solid(-0.37, 0, 0.37, 0.7); });
      K.at(0, (fz0 + fz1) / 2 - 0.3, 0, () => { K.box("gloss", 0, 0.85, 0, 1.6, 0.28, 0.42, C("#2a2c30")); for (const e of [-0.72, 0.72]) K.rod("metal", [e, 0, 0], [e, 0.85, 0], 0.03, C("#b8bcc4"), 6); K.plane("goods", 0, 0.52, 0.215, 1.2, 0.72, WHITE, 0, ATLAS.art); K.blob(0, 0, 2.0, 0.9); K.solid(-0.8, -0.22, 0.8, 0.22); }); }
    else if (kindS === "workbench") K.at(sideX(ws), (fz0 + fz1) / 2 - 0.2, facing(ws), () => { K.box("wood", 0, 0.86, 0.33, 2.6, 0.06, 0.62, woodC); K.box("wood", 0, 0, 0.33, 2.5, 0.86, 0.56, woodD); for (let k = 0; k < 4; k++) K.plane("goods", -0.93 + k * 0.62, 1.55, 0.02, 0.6, 0.6, WHITE, 0, ATLAS.tools);
        stock(K, (kind.goods && kind.goods[0]) || "radios", -1.2, 0.5, 0.92, 0.3, R); K.rod("metal", [1.0, 0.92, 0.2], [0.85, 1.35, 0.3], 0.012, metalC, 4); K.sph("glow", 0.84, 1.33, 0.31, 0.05, 0.035, 0.05, C("#fff0c8"), 6, 4);
        K.blob(0, 0.35, 3.0, 1.1); K.solid(-1.3, 0, 1.3, 0.64); K.at(0.2, 1.05, 0, () => stool(K, C("#2a2c30"), C("#b8bcc4"))); });
    else if (kindS === "teller") {
      for (let k = 0; k < Math.max(2, Math.floor(cl / 1.4)); k++) { const n = Math.max(2, Math.floor(cl / 1.4)), x = ca + cl * (k + 0.5) / n, w = cl / n; K.plane("glass", x, 1.55, zc + 0.2, w - 0.12, 1.0, WHITE); for (const e of [-1, 1]) K.box("metal", x + e * (w / 2 - 0.03), 1.03, zc + 0.2, 0.05, 1.1, 0.05, C("#b8a060")); K.box("metal", x, 2.08, zc + 0.2, w, 0.05, 0.05, C("#b8a060")); }
      for (let k = 0; k < 4; k++) { const x = -1.35 + k * 0.9, z = zc + 2.0; K.rod("metal", [x, 0.03, z], [x, 0.95, z], 0.022, C("#b8a060"), 8); K.cyl("metal", x, 0, z, 0.05, 0.15, 0.03, C("#b8a060"), 12); K.sph("metal", x, 0.97, z, 0.035, 0.035, 0.035, C("#b8a060"), 6, 5); if (k < 3) K.rod("matte", [x, 0.9, z], [x + 0.9, 0.9, z], 0.016, C("#7a1f24"), 5); }
      K.at(bm, zB + 0.068, 0, () => { K.cyl("metal", 0, 1.2, 0.1, 1.0, 1.0, 0.2, C("#9aa0a6"), 28, { rx: Math.PI / 2, center: true }); K.cyl("metal", 0, 1.2, 0.2, 0.82, 0.82, 0.06, C("#b8bcc4"), 28, { rx: Math.PI / 2, center: true }); K.torus("metal", 0, 1.2, 0.3, 0.3, 0.025, C("#c8ccd0"), 0, 0, 20);
        for (let k = 0; k < 4; k++) { const a = k * Math.PI / 4; K.rod("metal", [-Math.cos(a) * 0.3, 1.2 - Math.sin(a) * 0.3, 0.3], [Math.cos(a) * 0.3, 1.2 + Math.sin(a) * 0.3, 0.3], 0.014, C("#c8ccd0"), 5); } for (const y of [0.7, 1.7]) K.box("metal", -1.05, y, 0.12, 0.18, 0.26, 0.18, C("#7a8086")); });
    }
    if (kind.goods && kind.goods.length && kindS !== "washers" && kindS !== "workbench") for (let k = 0; k < 2; k++) { const z = fz1 - 0.6 - k * 1.3; if (ps === ls && row.link && Math.abs(z - lz) < 1.25) continue; if (z < zc + 2.2) continue; K.at(sideX(ps) - ps * 0.02, z, facing(ps), () => shelfUnit(K, 1.2, kind.goods[k % kind.goods.length], R, woodC)); }
    if (kind.center) centre(kind.center);
    // somewhere to wait
    if (kindS !== "washers") K.at(clamp(dx + (dx > 0 ? -2.0 : 2.0), -hw + 1.0, hw - 1.0), -0.62, Math.PI, () => { K.box("wood", 0, 0.42, 0, 1.4, 0.05, 0.4, woodC); K.box("wood", 0, 0.55, -0.19, 1.4, 0.36, 0.03, woodC); for (const e of [-0.62, 0.62]) for (const zz of [-0.16, 0.16]) K.rod("metal", [e, 0, zz], [e, 0.42, zz], 0.016, metalC, 4); K.blob(0, 0, 1.7, 0.8); K.solid(-0.7, -0.22, 0.7, 0.22); });
  }

  // ---- framed prints on the bare stretches of wall
  if (kind.layout !== "retail") for (const s of [-1, 1]) for (const z of [-2.5, -4.2]) {
    if (z < zc + 2.0 || (row.link && s === ls && Math.abs(z - lz) < 1.3)) continue;
    if (kind.layout === "cafe" && (kind.seating || []).includes("booths") && s === -ps) continue;
    if (kind.layout === "service" && (s === -ps || (kind.goods && kind.goods.length))) continue;
    const pw = 0.5 + R() * 0.25, ph = 0.5 + R() * 0.3;
    K.plane("goods", s * (hw - 0.03), 1.72, z, pw, ph, mul(WHITE, 0.92), -s * Math.PI / 2, R() < 0.35 ? ATLAS.art : pick(R, ATLAS.covers)); K.box("wood", s * (hw - 0.014), 1.72 - ph / 2 - 0.03, z, 0.02, ph + 0.06, pw + 0.06, woodD);
  }

  // ---- the window ledge, a plant, a mat inside the door, the lamps
  for (const [a, b] of [[-hw + 0.3, d0 - 0.2], [d1 + 0.2, hw - 0.3]]) if (b - a > 0.8) { const st0 = pick(R, kind.goods && kind.goods.length ? kind.goods : (kind.back && kind.back.length ? kind.back : ["plants"])); stock(K, ["guitars", "tools", "keys", "clocks"].includes(st0) ? "plants" : st0, a, b, 0.585, -0.2, R); }
  { const cxs = [ps * (hw - 0.45), -ps * (hw - 0.45)], px2 = lane(cxs[1], -0.6, 1.0) ? cxs[0] : cxs[1]; if (!lane(px2, -0.6, 0.9)) { K.at(px2, -0.75, 0, () => plantPot(K, 1)); K.colliders.push({ x: px2, z: -0.75, width: 0.4, depth: 0.4 }); } }
  K.plane("matte", dx, 0.006, -1.9, 1.3, 0.9, mul(acc, 0.5), 0, null, -Math.PI / 2);
  const lampsX = W > 8.5 ? [-hw * 0.5, hw * 0.5] : [0], lampsZ = [-1.9, -4.6, zc + 0.2];
  for (const lx of lampsX) for (const lz2 of lampsZ) { if (kind.floor === "wood" || kind.floor === "check") pendant(K, lx, lz2, lz2 === lampsZ[2] ? mix(acc, C("#1a1a1a"), 0.3) : C("#2a2a2c"), lz2 === lampsZ[2] ? 0.95 : 0.7); else panelLight(K, lx, lz2); }

  // ---- the back room: stock on steel racks, the rear exit (it does not open), a mop
  const zr = -(Dm + BACK);
  for (const rx of W > 8 ? [-ps * hw * 0.5, -ps * hw * 0.05] : [-ps * hw * 0.35]) K.at(rx, zr + 0.02, 0, () => { for (const [ex, ez] of [[-0.75, 0.04], [0.75, 0.04], [0.75, 0.46], [-0.75, 0.46]]) K.rod("metal", [ex, 0, ez], [ex, 2.0, ez], 0.014, C("#8a9096"), 4);
    [0.2, 0.8, 1.4, 2.0].forEach((y, k) => { K.box("metal", 0, y - 0.02, 0.25, 1.54, 0.02, 0.46, C("#8a9096")); if (k < 3) { let x = -0.7; while (x < 0.5) { const w = 0.3 + R() * 0.25, h = 0.2 + R() * 0.28; K.box("matte", x + w / 2, y, 0.25, w - 0.02, h, 0.36, C(pick(R, ["#b08a5a", "#a8824e", "#c09a68"]))); x += w; } } });
    K.blob(0, 0.3, 1.9, 0.9); K.solid(-0.78, 0, 0.78, 0.5); });
  K.at(px, zr + 0.02, 0, () => { K.box("metal", 0, 0, 0.03, 0.95, 2.08, 0.05, C("#5a6a66")); K.rod("metal", [-0.38, 1.0, 0.08], [0.38, 1.0, 0.08], 0.018, C("#b8bcc4"), 5); K.plane("sign", 0, 2.3, 0.06, 0.44, 0.22, WHITE, 0, sheetUV(SHEET.exit)); });
  K.at(-ps * (hw - 0.4), zB - 0.5, 0, () => { K.cyl("gloss", 0, 0, 0, 0.16, 0.13, 0.26, C("#d8b030"), 10, { open: true }); K.rod("wood", [0.05, 0.05, 0], [0.3, 1.35, -0.12], 0.014, woodC, 5); });
  if (bank) { K.plane("goods", 0, 1.4, zr + 0.03, Math.min(W - 1.6, 5), 2.0, C("#9aa0a6"), 0, ATLAS.keys); }
  else K.plane("sign", -ps * (hw - 0.03), 1.6, zB - 1.6, 0.6, 0.4, WHITE, ps * Math.PI / 2, sheetUV(SHEET.thanks));

  // ---- the street outside (a hollow box in front of the window; the picture of the real street goes on it)
  const built = K.finish(group, mats);
  return { W, hw, Dm, dx, ps, zc, stations, spots, colliders: K.colliders, tris: built.tris, meshes: built.meshes, kind, row, job, working };
}
function espresso(K, x, y, z) {
  const ch = C("#c8ccd0"), dk = C("#1e1f22");
  K.box("metal", x, y, z, 0.62, 0.36, 0.42, ch); K.box("metal", x, y + 0.36, z - 0.02, 0.6, 0.03, 0.36, dk); K.box("metal", x, y, z + 0.24, 0.56, 0.03, 0.1, dk);
  for (const s of [-1, 1]) { K.cyl("metal", x + s * 0.15, y + 0.17, z + 0.2, 0.035, 0.035, 0.06, dk, 8); K.rod("matte", [x + s * 0.15, y + 0.17, z + 0.22], [x + s * 0.2, y + 0.15, z + 0.36], 0.012, dk, 5); K.cyl("metal", x + s * 0.2, y + 0.3, z + 0.212, 0.03, 0.03, 0.01, C("#f4f4f0"), 10, { rx: Math.PI / 2, center: true }); }
  K.rod("metal", [x + 0.29, y + 0.3, z + 0.18], [x + 0.36, y + 0.1, z + 0.24], 0.008, ch, 4);
  for (let c = 0; c < 4; c++) K.cyl("gloss", x - 0.2 + c * 0.13, y + 0.39, z - 0.04, 0.035, 0.028, 0.06, C("#f4efe6"), 8);
}

// ---------------------------------------------------------------------------------------------------------------
// the street through the window. Just before you step in, the real street is drawn three times into strips of the
// canvas (left, ahead, right: 180 degrees) and copied into one texture. Inside, a hollow box the size of the street
// (ground, the far building line, the sky) carries that picture, projected from where it was taken, so it lines up
// and shifts a little as you move. It uses the same shaders the city is already drawn with, so nothing compiles.
// ---------------------------------------------------------------------------------------------------------------
function captureStreet(renderer, scene, slot, capY) {
  const dbs = renderer.getDrawingBufferSize(new THREE.Vector2()), pr = renderer.getPixelRatio();
  // three views: stacked rows on a tall screen (a phone), columns on a wide one, whichever keeps each view closest to square
  const cols = dbs.x / 3 / dbs.y > 0.45 || dbs.x > dbs.y, w = cols ? Math.min(Math.floor(dbs.x / 3), 640) : Math.min(dbs.x, 900), h = cols ? Math.min(dbs.y, 900) : Math.min(Math.floor(dbs.y / 3), 640);
  const tex2 = new THREE.FramebufferTexture(cols ? w * 3 : w, cols ? h : h * 3); tex2.minFilter = tex2.magFilter = THREE.LinearFilter;
  const f = new THREE.Vector3(slot.face[0], 0, slot.face[1]), right = new THREE.Vector3(slot.face[1], 0, -slot.face[0]), Cw = new THREE.Vector3(slot.cap[0], capY, slot.cap[1]);
  const cams = [], vps = [], fovV = Math.max(62, 2 * Math.atan(Math.tan(Math.PI / 6) / (w / h)) * 180 / Math.PI), down = fovV < 75 ? -0.9 : 0;
  const oldVP = renderer.getViewport(new THREE.Vector4()), oldSc = renderer.getScissor(new THREE.Vector4()), oldST = renderer.getScissorTest(), au = renderer.shadowMap.autoUpdate;
  renderer.shadowMap.autoUpdate = false; renderer.setScissorTest(true);
  // Things within 7 m of the window (the lamp and the tree on this sidewalk, a car at the curb, someone walking past)
  // would be painted onto the far side of the street many times too big, so they sit out of the picture: their
  // instances are zeroed for these three draws and put back straight after.
  const hidden = [];
  scene.traverse((o) => {
    if (!o.isInstancedMesh || !o.visible || !o.count) return; const a = o.instanceMatrix.array; let saved = null;
    for (let i = 0; i < o.count; i++) { const p = i * 16, dx = a[p + 12] - Cw.x, dz = a[p + 14] - Cw.z; if (dx * dx + dz * dz < 49 && (a[p] !== 0 || a[p + 5] !== 0)) { (saved || (saved = [])).push([p, a.slice(p, p + 16)]); a.fill(0, p, p + 16); } }
    if (saved) { o.instanceMatrix.needsUpdate = true; hidden.push([o, saved]); }
  });
  try {
    for (let k = 0; k < 3; k++) {
      const a = (k - 1) * Math.PI / 3, dir = f.clone().multiplyScalar(Math.cos(a)).addScaledVector(right, Math.sin(a));
      const cam = new THREE.PerspectiveCamera(fovV, w / h, 0.25, 420); cam.position.copy(Cw); cam.lookAt(Cw.clone().addScaledVector(dir, 10).add(new THREE.Vector3(0, down, 0))); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
      const vx = cols ? k * w / pr : 0, vy = cols ? 0 : k * h / pr;
      renderer.setViewport(vx, vy, w / pr, h / pr); renderer.setScissor(vx, vy, w / pr, h / pr); renderer.render(scene, cam);
      cams.push(cam); vps.push(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    }
    renderer.copyFramebufferToTexture(tex2, new THREE.Vector2(0, 0));
  } finally {
    renderer.setViewport(oldVP); renderer.setScissor(oldSc); renderer.setScissorTest(oldST); renderer.shadowMap.autoUpdate = au;
    for (const [o, saved] of hidden) { for (const [p, m] of saved) o.instanceMatrix.array.set(m, p); o.instanceMatrix.needsUpdate = true; }
  }
  return { tex: tex2, vps, f, right, Cw, cols };
}
function streetBox(cap, group, fallbackColor) {
  const geo = new THREE.BoxGeometry(110, 46, 18.4); geo.translate(0, 22.9, 9.2 + 0.02);   // interior-local: from the glass out to the far building line
  if (!cap) { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: fallbackColor, side: THREE.BackSide, fog: false })); m.name = "shop:street"; group.add(m); return m; }
  // where each corner of the box is on the real street (the picture was taken at local (0, capY, 0.45))
  const pos = geo.attributes.position, aw = new Float32Array(pos.count * 3);
  for (let k = 0; k < pos.count; k++) { const lx = pos.getX(k), ly = pos.getY(k) - 1.6, lz = pos.getZ(k) - 0.45;
    aw[k * 3] = cap.Cw.x + cap.right.x * lx + cap.f.x * lz; aw[k * 3 + 1] = cap.Cw.y + ly; aw[k * 3 + 2] = cap.Cw.z + cap.right.z * lx + cap.f.z * lz; }
  geo.setAttribute("aW", new THREE.BufferAttribute(aw, 3));
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, fog: false, toneMapped: false,
    uniforms: { map: { value: cap.tex }, vp: { value: cap.vps }, cw: { value: cap.Cw }, fw: { value: cap.f }, rt: { value: cap.right }, dim: { value: 1 }, cols: { value: cap.cols ? 1 : 0 } },
    vertexShader: `attribute vec3 aW; varying vec3 vW; void main(){ vW = aW; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D map; uniform mat4 vp[3]; uniform vec3 cw, fw, rt; uniform float dim, cols; varying vec3 vW;
      void main(){
        vec3 d = vW - cw; float ang = atan(dot(d, rt), dot(d, fw));
        float k = ang < -0.5236 ? 0.0 : (ang > 0.5236 ? 2.0 : 1.0);
        vec4 c = (k < 0.5 ? vp[0] : (k < 1.5 ? vp[1] : vp[2])) * vec4(vW, 1.0);
        vec2 uv = clamp(c.xy / max(c.w, 0.0001) * 0.5 + 0.5, 0.003, 0.997);
        gl_FragColor = vec4(texture2D(map, cols > 0.5 ? vec2((k + uv.x) / 3.0, uv.y) : vec2(uv.x, (k + uv.y) / 3.0)).rgb * dim, 1.0);
      }`,
  });
  const m = new THREE.Mesh(geo, mat); m.name = "shop:street"; m.frustumCulled = false; group.add(m); return m;
}

// ---------------------------------------------------------------------------------------------------------------
// the handle main.js holds
// ---------------------------------------------------------------------------------------------------------------
export function createShops(scene, renderer, table) {
  let now = null;   // the one shop that exists
  const tmp = new THREE.Vector3();
  return {
    get current() { return now; },
    // build the shop behind this storefront. Call while the city is still visible (the street picture is taken first).
    open(slot, opts = {}) {
      if (now) this.close();
      const group = new THREE.Group(); group.name = "shop"; group.position.set(SHOP_ROOM.x, 0, SHOP_ROOM.z);
      let cap = null; try { if (opts.street !== false) cap = captureStreet(renderer, scene, slot, (opts.floorY || 0.15) + 1.6); } catch (e) { try { console.warn("[W2] shop street view", e); } catch (e2) {} cap = null; }
      const mats = materials(), row = slot.row, kind = shopKind(table, row), job = row.job ? (table.jobs || []).find((j) => j.id === row.job) : null;
      const sheet = drawSheet(row, kind, table, job, job && job.stations ? Object.values(job.stations) : null);
      mats.sign.map = sheet; mats.sign.emissiveMap = sheet; mats.sign.needsUpdate = true;
      mats.floor.map = floorTex(kind.floor); mats.floor.roughness = kind.floor === "wood" ? 0.5 : kind.floor === "concrete" ? 0.9 : 0.3; mats.floor.needsUpdate = true;
      const b = buildShop(slot, table, group);
      const street = streetBox(cap, group, opts.sky || 0x9fb8cc);
      // light: a warm room. Daylight comes in from the window side by day; at night the lamps carry it.
      const dark = !!kind.dark, hemi = new THREE.HemisphereLight(0xfff4e2, 0x5a4a3c, dark ? 0.75 : 1.15), sun = new THREE.DirectionalLight(0xfff6e8, 1.0);
      sun.position.set(1.5, 4, 6); sun.target.position.set(0, 0.5, -5); const p1 = new THREE.PointLight(0xffd9a0, dark ? 16 : 12, 11, 1.6), p2 = new THREE.PointLight(0xffe2b8, dark ? 12 : 9, 11, 1.6);
      p1.position.set(0, 2.5, b.zc + 0.3); p2.position.set(0, 2.5, -2.6);
      group.add(hemi, sun, sun.target, p1, p2);
      scene.add(group); group.updateMatrixWorld(true);
      const wx = (o) => Object.assign(o, { x: o.x + SHOP_ROOM.x, z: o.z + SHOP_ROOM.z }, o.tx !== undefined ? { tx: o.tx + SHOP_ROOM.x, tz: o.tz + SHOP_ROOM.z } : null);
      b.stations.forEach(wx); b.colliders.forEach(wx); for (const q of b.spots.queue) wx(q); if (b.spots.keeper) wx(b.spots.keeper); if (b.spots.door) wx(b.spots.door);
      now = { slot, row, kind, job: b.job, working: b.working, group, street, cap, hemi, sun, p1, p2, dark, stations: b.stations, colliders: b.colliders, spots: b.spots, tris: b.tris, calls: b.meshes.length + 1,
        bounds: { x: SHOP_ROOM.x, z: SHOP_ROOM.z - (b.Dm + BACK) / 2, hw: b.hw - 0.36, hd: (b.Dm + BACK) / 2 - 0.36 }, spawn: { x: SHOP_ROOM.x + b.dx, z: SHOP_ROOM.z - 2.0, yaw: 0 }, W: b.W, Dm: b.Dm };
      this.light(opts.night || 0);
      return now;
    },
    // nightF 0..1: by day the window lights the room, at night the lamps do
    light(nightF) {
      if (!now) return; const day = 1 - nightF;
      now.sun.intensity = (now.dark ? 0.5 : 1.25) * day; now.hemi.intensity = (now.dark ? 0.55 : 0.8) + 0.4 * day * (now.dark ? 0.5 : 1);
      now.p1.intensity = (now.dark ? 16 : 10) + 8 * nightF; now.p2.intensity = (now.dark ? 12 : 7) + 8 * nightF;
    },
    close() {
      if (!now) return;
      scene.remove(now.group);
      now.group.traverse((o) => { if (o.isMesh && o.geometry) o.geometry.dispose(); });
      if (now.street && now.street.material) now.street.material.dispose();
      if (now.cap && now.cap.tex) now.cap.tex.dispose();
      now = null;
    },
    stats() { return now ? { shop: now.row.name, kind: now.row.kind, tris: now.tris, meshes: now.calls, width: +now.W.toFixed(1) } : null; },
  };
}
