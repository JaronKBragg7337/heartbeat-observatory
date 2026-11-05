// Real City tile builder. Turns one data tile (tools/realcity/fetch.mjs output) into a few merged meshes.
// Look follows World 2's kit (brick / limestone / glass / ribbon families, storefronts, cornices, rooftop units, warm lit
// windows at night) but is rebuilt for REAL footprints: every wall is a polygon edge, and every facade piece is a cell in ONE
// texture atlas. A small shader patch tiles the cell (fract + textureGrad, so no mip seams) and lights windows one by one at
// night from a hash. Result: all buildings in a tile = 1 draw call, all ground/roads/paint/parks = 1 draw call.
// Coordinates: x east, z south (north = -z), metres from the city origin, y up (0 = ground at the origin).
import * as THREE from "three";

// ------------------------------------------------------------------------------------------------ utils
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const _c = new THREE.Color();
const hexc = (h, m = 1) => { _c.setHex(h); return [_c.r * m, _c.g * m, _c.b * m]; };
const cv = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return [c, c.getContext("2d")]; };
function grain(g, x, y, w, h, R, n, dark, light) { for (let i = 0; i < n; i++) { const s = 1 + R() * 2; g.fillStyle = R() < 0.5 ? `rgba(0,0,0,${R() * dark})` : `rgba(255,255,255,${R() * light})`; g.fillRect(x + R() * w, y + R() * h, s, s); } }

// ------------------------------------------------------------------------------------------------ the facade atlas (4 x 4 cells, 256 px)
// cell ids. Each facade cell = one bay of one floor. BAY = [bay width m, floor height m].
export const CELL = { brick: 0, buff: 1, stone: 2, glass: 3, ribbon: 4, house: 5, industrial: 6, garage: 7, shopA: 8, shopB: 9, lobby: 10, blankBrick: 11, blankStone: 12, roof: 13, shingle: 14, metal: 15 };
const BAY = { 0: [3.2, 3.6], 1: [3.2, 3.6], 2: [3.4, 3.9], 3: [1.6, 3.9], 4: [3.0, 3.7], 5: [3.6, 3.0], 6: [6, 5], 7: [8, 3.1] };
const cellOff = (k) => [(k % 4) * 0.25, 1 - (Math.floor(k / 4) + 1) * 0.25];

function paintFacades(glow) {
  const S = 256, [c, g] = cv(S * 4, S * 4);
  g.fillStyle = "#000"; g.fillRect(0, 0, S * 4, S * 4);
  const at = (k) => [(k % 4) * S, Math.floor(k / 4) * S];
  const R = rng(91);
  const win = (x, y, w, h, kind) => {   // a window opening with depth shading
    if (glow) { const gr = g.createRadialGradient(x + w / 2, y + h * 0.35, 4, x + w / 2, y + h / 2, Math.max(w, h)); gr.addColorStop(0, kind === "office" ? "#f2f6ff" : "#ffe2b2"); gr.addColorStop(1, kind === "office" ? "#7f95b8" : "#b8682e"); g.fillStyle = gr; g.fillRect(x, y, w, h); if (kind !== "office") { g.fillStyle = "rgba(60,30,10,.55)"; g.fillRect(x + 2, y + 2, w * 0.22, h - 4); g.fillRect(x + w * 0.78 - 2, y + 2, w * 0.22, h - 4); } g.fillStyle = "#000"; g.fillRect(x + w / 2 - 2, y, 4, h); return; }
    const gr = g.createLinearGradient(x, y, x + w * 0.4, y + h); gr.addColorStop(0, "#6c7f90"); gr.addColorStop(0.5, "#2f3a46"); gr.addColorStop(1, "#1a2129"); g.fillStyle = gr; g.fillRect(x, y, w, h);
    g.fillStyle = "rgba(255,255,255,.12)"; g.beginPath(); g.moveTo(x + w * 0.2, y); g.lineTo(x + w * 0.5, y); g.lineTo(x + w * 0.15, y + h); g.lineTo(x - w * 0.1, y + h); g.fill();
    g.fillStyle = "rgba(0,0,0,.45)"; g.fillRect(x, y, w, 6); g.fillRect(x, y, 5, h);   // reveal shadow (light from above-right)
    g.fillStyle = "#26282b"; g.fillRect(x + w / 2 - 2, y, 4, h); g.fillRect(x, y + h * 0.48, w, 3);
  };
  const brick = (x, y, base, mortar, seed) => { const Rb = rng(seed); g.fillStyle = mortar; g.fillRect(x, y, S, S); const rh = S / 22, cw = S / 6; for (let r = 0; r < 22; r++) for (let k = -1; k <= 6; k++) { const v = 0.8 + Rb() * 0.3; g.fillStyle = `rgb(${Math.min(255, base[0] * v) | 0},${Math.min(255, base[1] * v) | 0},${Math.min(255, base[2] * v) | 0})`; g.fillRect(x + k * cw + (r % 2) * cw / 2 + 1, y + r * rh + 1, cw - 2, rh - 2); } grain(g, x, y, S, S, Rb, 1800, 0.15, 0.06); };
  const stone = (x, y) => { g.fillStyle = "#d8cfbb"; g.fillRect(x, y, S, S); g.strokeStyle = "rgba(90,80,64,.35)"; g.lineWidth = 2; for (let r = 0; r <= 4; r++) { g.beginPath(); g.moveTo(x, y + r * 64); g.lineTo(x + S, y + r * 64); g.stroke(); } for (let r = 0; r < 4; r++) { g.beginPath(); g.moveTo(x + (r % 2) * 128 + 64, y + r * 64); g.lineTo(x + (r % 2) * 128 + 64, y + r * 64 + 64); g.stroke(); } grain(g, x, y, S, S, R, 2500, 0.08, 0.08); };
  const sill = (x, y, w) => { g.fillStyle = glow ? "#000" : "#e3dccb"; g.fillRect(x - 6, y, w + 12, 9); g.fillStyle = glow ? "#000" : "rgba(0,0,0,.3)"; g.fillRect(x - 6, y + 9, w + 12, 4); };
  // 0 red brick, 1 buff brick: punched window, sill + lintel
  for (const [k, base, mortar] of [[0, [150, 72, 52], "#b9ad9c"], [1, [200, 176, 134], "#d6cdbd"]]) {
    const [x, y] = at(k); if (!glow) brick(x, y, base, mortar, 11 + k);
    if (!glow) { g.fillStyle = "#e3dccb"; g.fillRect(x + 62, y + 34, 132, 12); }
    win(x + 70, y + 46, 116, 150, "home"); if (!glow) sill(x + 70, y + 196, 116);
  }
  { const [x, y] = at(2); if (!glow) { stone(x, y); g.fillStyle = "rgba(0,0,0,.12)"; g.fillRect(x, y + 236, S, 8); } win(x + 64, y + 40, 128, 168, "home"); if (!glow) sill(x + 64, y + 208, 128); }
  { const [x, y] = at(3); // curtain wall: 1 bay, spandrel at the slab
    if (!glow) { g.fillStyle = "#1e2a35"; g.fillRect(x, y, S, S); const gr = g.createLinearGradient(x, y, x + S, y + S); gr.addColorStop(0, "#9fb6c9"); gr.addColorStop(0.45, "#4d6478"); gr.addColorStop(1, "#22303c"); g.fillStyle = gr; g.fillRect(x + 6, y + 6, S - 12, 188); g.fillStyle = "#2b3640"; g.fillRect(x, y + 196, S, 60); g.fillStyle = "#5a636b"; g.fillRect(x, y, 6, S); g.fillRect(x + S - 6, y, 6, S); g.fillRect(x, y + 192, S, 6); }
    else { const gr = g.createLinearGradient(x, y, x, y + 190); gr.addColorStop(0, "#f4f8ff"); gr.addColorStop(1, "#8aa0bf"); g.fillStyle = gr; g.fillRect(x + 6, y + 6, S - 12, 160); }
  }
  { const [x, y] = at(4); // ribbon: concrete band + strip glass
    if (!glow) { g.fillStyle = "#cfcac0"; g.fillRect(x, y, S, S); grain(g, x, y, S, S, R, 1500, 0.08, 0.06); g.fillStyle = "rgba(0,0,0,.25)"; g.fillRect(x, y + 168, S, 6); } win(x, y + 10, S, 158, "office"); }
  { const [x, y] = at(5); // house siding
    if (!glow) { g.fillStyle = "#e9e4d8"; g.fillRect(x, y, S, S); for (let l = 0; l < S; l += 12) { g.fillStyle = "rgba(0,0,0,.13)"; g.fillRect(x, y + l, S, 2); } g.fillStyle = "#3d4a5a"; g.fillRect(x + 52, y + 56, 22, 130); g.fillRect(x + 182, y + 56, 22, 130); }
    win(x + 78, y + 56, 100, 130, "home"); if (!glow) { g.fillStyle = "#ffffff"; g.fillRect(x + 72, y + 186, 112, 8); } }
  { const [x, y] = at(6); // industrial: corrugated metal, a clerestory strip
    if (!glow) { g.fillStyle = "#a9adb0"; g.fillRect(x, y, S, S); for (let l = 0; l < S; l += 8) { g.fillStyle = l % 16 ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.14)"; g.fillRect(x + l, y, 4, S); } } win(x + 20, y + 24, 216, 40, "office"); }
  { const [x, y] = at(7); // parking garage: spandrel + dark open deck
    if (!glow) { g.fillStyle = "#c4c0b8"; g.fillRect(x, y, S, S); g.fillStyle = "#24272b"; g.fillRect(x, y + 20, S, 140); g.fillStyle = "#b8b3aa"; g.fillRect(x + 118, y + 20, 20, 140); grain(g, x, y, S, S, R, 900, 0.1, 0.05); }
    else { g.fillStyle = "#3a3020"; g.fillRect(x, y + 20, S, 140); } }
  // 8, 9 storefronts: glass with shelves + sign band; 10 lobby with doors
  for (const k of [8, 9]) {
    const [x, y] = at(k), Rk = rng(500 + k), sh = (hex, m) => { _c.set(hex).multiplyScalar(m); return "#" + _c.getHexString(); }, m = glow ? 1 : 0.55;
    if (!glow) { g.fillStyle = k === 8 ? "#2a2622" : "#1d2f55"; g.fillRect(x, y, S, 58); g.fillStyle = "#e6dcc4"; g.fillRect(x + 30, y + 16, 196, 26); g.fillStyle = "#3a332b"; for (let i = 0; i < 9; i++) g.fillRect(x + 40 + i * 20, y + 22, 12, 14); }
    else { g.fillStyle = "#ffe8b8"; g.fillRect(x + 30, y + 16, 196, 26); }
    g.fillStyle = sh(["#efe4cf", "#d8e4ea"][k - 8], m); g.fillRect(x + 10, y + 64, S - 20, 160);
    for (let s = 0; s < 3; s++) { g.fillStyle = sh("#5b4632", m); g.fillRect(x + 18, y + 104 + s * 34, S - 36, 4); for (let it = 0; it < 16; it++) { g.fillStyle = sh(["#d9534f", "#f0ad4e", "#5bc0de", "#5cb85c", "#8e6bbf", "#c97b4a"][Math.floor(Rk() * 6)], m); const h = 8 + Rk() * 16; g.fillRect(x + 22 + it * 13, y + 104 + s * 34 - h, 7 + Rk() * 4, h); } }
    if (!glow) { const gr = g.createLinearGradient(x, y + 64, x + S, y + 224); gr.addColorStop(0, "rgba(200,220,240,.35)"); gr.addColorStop(0.5, "rgba(200,220,240,.05)"); gr.addColorStop(1, "rgba(200,220,240,.2)"); g.fillStyle = gr; g.fillRect(x + 10, y + 64, S - 20, 160); g.fillStyle = "#26282b"; g.fillRect(x + 10, y + 64, S - 20, 5); g.fillRect(x + 126, y + 64, 5, 160); g.fillStyle = "#4a4540"; g.fillRect(x, y + 224, S, 32); g.fillRect(x, y + 58, 10, 200); g.fillRect(x + S - 10, y + 58, 10, 200); }
  }
  { const [x, y] = at(10); if (!glow) { stone(x, y); g.fillStyle = "#2b2e33"; g.fillRect(x + 64, y + 60, 128, 196); } const gr = g.createLinearGradient(x, y + 70, x, y + 256); gr.addColorStop(0, glow ? "#fff1cf" : "#5b6d7e"); gr.addColorStop(1, glow ? "#c08a50" : "#1d242c"); g.fillStyle = gr; g.fillRect(x + 72, y + 68, 112, 188); g.fillStyle = "#000"; g.fillRect(x + 126, y + 68, 4, 188); }
  if (!glow) {
    { const [x, y] = at(11); brick(x, y, [150, 72, 52], "#b9ad9c", 31); }
    { const [x, y] = at(12); stone(x, y); }
    { const [x, y] = at(13); g.fillStyle = "#6a6a66"; g.fillRect(x, y, S, S); grain(g, x, y, S, S, R, 9000, 0.35, 0.2); }
    { const [x, y] = at(14); g.fillStyle = "#4a4440"; g.fillRect(x, y, S, S); for (let r = 0; r < 16; r++) for (let k = -1; k < 9; k++) { g.fillStyle = `rgba(${R() < 0.5 ? "0,0,0" : "255,255,255"},${R() * 0.12})`; g.fillRect(x + k * 32 + (r % 2) * 16, y + r * 16, 30, 14); } }
    { const [x, y] = at(15); g.fillStyle = "#9aa0a6"; g.fillRect(x, y, S, S); grain(g, x, y, S, S, R, 2000, 0.12, 0.1); for (let l = 0; l < S; l += 32) { g.fillStyle = "rgba(0,0,0,.18)"; g.fillRect(x, y + l, S, 3); } }
  }
  return c;
}
// ground atlas: 0 asphalt, 1 sidewalk, 2 lawn, 3 park, 4 woods floor, 5 parking, 6 paint white, 7 paint yellow, 8 ballast, 9 steel, 10 urban ground, 11 pitch, 12 bridge deck concrete, 13 cemetery, 14 dirt path, 15 curb
export const GCELL = { asphalt: 0, sidewalk: 1, lawn: 2, park: 3, woods: 4, parking: 5, white: 6, yellow: 7, ballast: 8, steel: 9, urban: 10, pitch: 11, deck: 12, cemetery: 13, path: 14, curb: 15 };
function paintGround() {
  const S = 256, [c, g] = cv(S * 4, S * 4), R = rng(7);
  const at = (k) => [(k % 4) * S, Math.floor(k / 4) * S];
  const fill = (k, col, n, d, l, extra) => { const [x, y] = at(k); g.fillStyle = col; g.fillRect(x, y, S, S); grain(g, x, y, S, S, R, n, d, l); if (extra) extra(x, y); };
  fill(0, "#3c3d3f", 9000, 0.3, 0.12, (x, y) => { for (let i = 0; i < 10; i++) { g.fillStyle = `rgba(${R() < 0.5 ? "0,0,0" : "90,90,90"},${0.05 + R() * 0.08})`; g.fillRect(x + R() * 200, y + R() * 200, 30 + R() * 60, 20 + R() * 50); } });
  fill(1, "#bdb8ad", 5000, 0.1, 0.06, (x, y) => { g.fillStyle = "rgba(60,55,50,.5)"; g.fillRect(x, y, S, 3); g.fillRect(x, y, 3, S); g.fillRect(x, y + 128, S, 2); g.fillRect(x + 128, y, 2, S); });
  fill(2, "#5f7d42", 9000, 0.25, 0.1); fill(3, "#567a3a", 9000, 0.25, 0.12); fill(4, "#3f4a2a", 9000, 0.35, 0.08);
  fill(5, "#4a4b4d", 7000, 0.25, 0.1, (x, y) => { g.fillStyle = "rgba(230,230,230,.55)"; g.fillRect(x + 4, y, 5, 110); g.fillRect(x + 132, y, 5, 110); });
  fill(6, "#e9e7df", 300, 0.1, 0.0); fill(7, "#e2b33a", 300, 0.1, 0.0);
  fill(8, "#6d6560", 12000, 0.4, 0.2); fill(9, "#8a8e93", 500, 0.2, 0.2);
  fill(10, "#7d8064", 9000, 0.3, 0.12, (x, y) => { for (let i = 0; i < 12; i++) { g.fillStyle = `rgba(120,110,90,${0.1 + R() * 0.2})`; g.beginPath(); g.ellipse(x + R() * S, y + R() * S, 10 + R() * 40, 8 + R() * 30, R() * 3, 0, 7); g.fill(); } });
  fill(11, "#4f8a3c", 6000, 0.2, 0.1); fill(12, "#a9a59c", 5000, 0.12, 0.08); fill(13, "#5c7a45", 9000, 0.25, 0.1); fill(14, "#9a8b70", 8000, 0.25, 0.12); fill(15, "#cfcac0", 2000, 0.1, 0.1);
  return c;
}

// ------------------------------------------------------------------------------------------------ materials
export const shared = { litU: { value: 0 }, mats: null, signTex: null };
function atlasMat(map, emap, o) {
  const m = new THREE.MeshStandardMaterial(Object.assign({ map, vertexColors: true, roughness: 0.88, metalness: 0 }, emap ? { emissiveMap: emap, emissive: 0xffffff, emissiveIntensity: 0 } : {}, o));
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uLit = shared.litU;
    sh.vertexShader = "attribute vec3 cell;\nvarying vec3 vCell;\n" + sh.vertexShader.replace("#include <uv_vertex>", "#include <uv_vertex>\n vCell = cell;");
    sh.fragmentShader = "varying vec3 vCell;\nuniform float uLit;\nfloat rcHash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }\n" + sh.fragmentShader
      .replace("#include <map_fragment>", "vec2 rcU = vMapUv; vec2 rcA = vCell.xy + (fract(rcU) * 0.94 + 0.03) * 0.25; vec2 rcDx = dFdx(rcU) * 0.235, rcDy = dFdy(rcU) * 0.235;\n vec4 sampledDiffuseColor = textureGrad(map, rcA, rcDx, rcDy); diffuseColor *= sampledDiffuseColor;")
      .replace("#include <emissivemap_fragment>", emap ? "float rcOn = step(rcHash(floor(rcU) + vCell.z), uLit); totalEmissiveRadiance *= textureGrad(emissiveMap, rcA, rcDx, rcDy).rgb * rcOn;" : "");
  };
  m.customProgramCacheKey = () => "rcatlas" + (emap ? 1 : 0);
  return m;
}
export function makeMaterials(maxAniso) {
  if (shared.mats) return shared.mats;
  const tex = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(8, maxAniso || 4); t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; return t; };
  const facade = tex(paintFacades(false)), glow = tex(paintFacades(true)), ground = tex(paintGround());
  const [sc] = cv(2048, 2048); const sg = sc.getContext("2d"); sg.fillStyle = "#1d6b3a"; sg.fillRect(0, 0, 2048, 2048);
  const signTex = new THREE.CanvasTexture(sc); signTex.colorSpace = THREE.SRGBColorSpace; signTex.anisotropy = 4;
  shared.signTex = signTex; shared.signCanvas = sc;
  shared.mats = {
    building: atlasMat(facade, glow, {}),
    ground: atlasMat(ground, null, { roughness: 0.95 }),
    water: new THREE.MeshStandardMaterial({ color: 0x2c4a55, roughness: 0.08, metalness: 0.3, envMapIntensity: 1.2 }),
    sign: new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.5, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.05 }),
    pole: new THREE.MeshStandardMaterial({ color: 0x2b2e33, roughness: 0.5, metalness: 0.6 }),
    lampHead: new THREE.MeshStandardMaterial({ color: 0xf4efe0, emissive: 0xffd9a0, emissiveIntensity: 0, roughness: 0.4 }),
    trunk: new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 1 }),
    crown: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true }),
    stone: new THREE.MeshStandardMaterial({ color: 0xd8ccb6, roughness: 0.8 }),
    copper: new THREE.MeshStandardMaterial({ color: 0x6f9a86, roughness: 0.45, metalness: 0.35 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xc9a54a, roughness: 0.35, metalness: 0.8 }),
    mat: new THREE.MeshBasicMaterial({ color: 0x7bd88f, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
  };
  return shared.mats;
}

// street-name blades: lazily drawn into one 2048 atlas (4 x 32 cells of 512 x 64)
const signSlots = new Map(); let signNext = 0;
export function abbrev(n) {
  const W = { north: "N", south: "S", east: "E", west: "W", street: "ST", avenue: "AVE", boulevard: "BLVD", drive: "DR", road: "RD", place: "PL", court: "CT", lane: "LN", parkway: "PKWY", highway: "HWY", alley: "ALY", square: "SQ", terrace: "TER", way: "WAY" };
  return n.split(/\s+/).map((w) => W[w.toLowerCase()] || w.toUpperCase()).join(" ");
}
function signSlot(name) {
  if (signSlots.has(name)) return signSlots.get(name);
  const k = signNext++ % 128, x = (k % 4) * 512, y = Math.floor(k / 4) * 64, g = shared.signCanvas.getContext("2d");
  g.fillStyle = "#1d6b3a"; g.fillRect(x, y, 512, 64); g.strokeStyle = "#fff"; g.lineWidth = 3; g.strokeRect(x + 6, y + 6, 500, 52);
  const t = abbrev(name); let s = 40; g.font = `700 ${s}px system-ui, -apple-system, "Segoe UI", sans-serif`; while (g.measureText(t).width > 470 && s > 14) { s--; g.font = `700 ${s}px system-ui, -apple-system, "Segoe UI", sans-serif`; }
  g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(t, x + 256, y + 35);
  for (const [n, kk] of signSlots) if (kk === k) signSlots.delete(n);
  signSlots.set(name, k); shared.signTex.needsUpdate = true; return k;
}

// ------------------------------------------------------------------------------------------------ geometry accumulator
class Acc {
  constructor(withCell) { this.p = []; this.n = []; this.u = []; this.c = []; this.k = withCell ? [] : null; this.i = []; this.v = 0; }
  quad(a, b, c, d, n, uv, col, cell, seed = 0) {
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const flip = (e1[1] * e2[2] - e1[2] * e2[1]) * n[0] + (e1[2] * e2[0] - e1[0] * e2[2]) * n[1] + (e1[0] * e2[1] - e1[1] * e2[0]) * n[2] < 0;
    const v = this.v; this.p.push(...a, ...b, ...c, ...d);
    for (let q = 0; q < 4; q++) { this.n.push(n[0], n[1], n[2]); this.c.push(col[0], col[1], col[2]); }
    this.u.push(...uv);
    if (this.k) { const o = cellOff(cell); for (let q = 0; q < 4; q++) this.k.push(o[0], o[1], seed); }
    if (!flip) this.i.push(v, v + 1, v + 2, v, v + 2, v + 3); else this.i.push(v, v + 2, v + 1, v, v + 3, v + 2);
    this.v += 4;
  }
  tris(pts, tri, n, uvf, col, cell) {   // pts [[x,y,z]], tri indices
    const v = this.v, o = this.k ? cellOff(cell) : null;
    for (const p of pts) { this.p.push(p[0], p[1], p[2]); this.n.push(n[0], n[1], n[2]); this.c.push(col[0], col[1], col[2]); const uv = uvf(p); this.u.push(uv[0], uv[1]); if (o) this.k.push(o[0], o[1], 0); }
    for (const t of tri) this.i.push(v + t[0], v + t[2], v + t[1]);   // ShapeUtils gives CW in x/-z; flip for +y normal
    this.v += pts.length;
  }
  geo() {
    if (!this.v) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.u, 2)); g.setAttribute("color", new THREE.Float32BufferAttribute(this.c, 3));
    if (this.k) g.setAttribute("cell", new THREE.Float32BufferAttribute(this.k, 3));
    g.setIndex(this.v > 65000 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1));
    g.computeBoundingSphere(); g.computeBoundingBox(); return g;
  }
}
function triFix(pts, tri) { // make the triangle wind so the normal is +y regardless of ShapeUtils' orientation
  const out = []; for (const t of tri) { const a = pts[t[0]], b = pts[t[1]], c = pts[t[2]]; const cy = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]); out.push(cy > 0 ? [t[0], t[2], t[1]] : t); } return out;
}
function upTris(acc, pts, tri, uvf, col, cell) {   // add triangles with +y normal, winding checked
  const v = acc.v, o = acc.k ? cellOff(cell) : null;
  for (const p of pts) { acc.p.push(p[0], p[1], p[2]); acc.n.push(0, 1, 0); acc.c.push(col[0], col[1], col[2]); const uv = uvf(p); acc.u.push(uv[0], uv[1]); if (o) acc.k.push(o[0], o[1], 0); }
  for (const t of tri) { const a = pts[t[0]], b = pts[t[1]], c = pts[t[2]]; const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]); if (ny >= 0) acc.i.push(v + t[0], v + t[1], v + t[2]); else acc.i.push(v + t[0], v + t[2], v + t[1]); }
  acc.v += pts.length;
}
function triangulate(outer, holes) {
  const V = (r) => r.map((p) => new THREE.Vector2(p[0], p[1]));
  try { return THREE.ShapeUtils.triangulateShape(V(outer), holes.map(V)); } catch (e) { return []; }
}

// ------------------------------------------------------------------------------------------------ palettes
const FAMS = ["brick", "stone", "glass", "concrete", "house", "industrial", "garage"];
const PAL = {
  brick: [[1, 1, 1], [0.92, 0.88, 0.86], [1.06, 0.98, 0.92], [0.82, 0.76, 0.74], [0.98, 0.9, 0.84]],
  stone: [[1, 1, 1], [0.93, 0.93, 0.95], [1.02, 0.97, 0.9], [0.86, 0.84, 0.82]],
  glass: [[1, 1, 1], [0.85, 0.95, 1.0], [0.9, 0.92, 0.85], [0.75, 0.82, 0.9]],
  concrete: [[1, 1, 1], [0.95, 0.93, 0.88], [0.9, 0.92, 0.95]],
  house: [[1, 1, 1], [0.86, 0.9, 0.95], [0.98, 0.92, 0.78], [0.82, 0.9, 0.82], [0.95, 0.85, 0.8], [0.75, 0.75, 0.78]],
  industrial: [[1, 1, 1], [0.9, 0.92, 0.95], [0.95, 0.9, 0.85]],
  garage: [[1, 1, 1], [0.95, 0.94, 0.9]],
};
const ROOFCOL = [[0.55, 0.42, 0.38], [0.42, 0.42, 0.44], [0.3, 0.3, 0.32], [0.5, 0.36, 0.28]];

// ------------------------------------------------------------------------------------------------ tile build
// returns { group, buildings: [{ring, holes, y0, top, name, h, flags, id}], bridges: [{ax,az,bx,bz,ya,yb,hw}], ground(x,z), info }
export function buildTile(T, city, opts) {
  const TILE = city.tile, ox = T.ix * TILE, oz = T.iz * TILE, M = makeMaterials(opts.maxAniso);
  const B = new Acc(true), G = new Acc(true), Wt = new Acc(false), Sg = new Acc(false);
  const D = (v) => v / 10;
  const R = rng((T.ix * 73856093) ^ (T.iz * 19349663));
  const gs = city.elevation ? city.elevation.gridStep : 0, gn = gs ? TILE / gs + 1 : 0;
  const ground = (x, z) => {   // world x,z -> y
    if (!T.g) return 0;
    const fi = Math.max(0, Math.min(gn - 1.0001, (x - ox) / gs)), fj = Math.max(0, Math.min(gn - 1.0001, (z - oz) / gs)), i = Math.floor(fi), j = Math.floor(fj), u = fi - i, v = fj - j, g = (a, b) => T.g[b * gn + a] / 10;
    return (g(i, j) * (1 - u) + g(i + 1, j) * u) * (1 - v) + (g(i, j + 1) * (1 - u) + g(i + 1, j + 1) * u) * v;
  };
  const ring = (flat) => { const r = []; for (let i = 0; i < flat.length; i += 2) r.push([ox + flat[i] / 10, oz + flat[i + 1] / 10]); return r; };

  // ---- roads first (we need street-facing edges for storefronts + sign posts)
  const segs = [];      // [ax,az,bx,bz, halfWidth, kind]
  const junction = new Map();
  const bridges = [];
  const roadPieces = T.r.map((r) => { const [kind, wdm, nameIx, flags, layer, lanes, pts, jn, gy] = r; return { kind, w: wdm / 10, nameIx, flags, layer, lanes, pts: ring(pts), jn, gy }; });
  for (const r of roadPieces) for (let i = 0; i < r.pts.length - 1; i++) segs.push([r.pts[i][0], r.pts[i][1], r.pts[i + 1][0], r.pts[i + 1][1], r.w / 2, r.kind]);

  // ---- buildings
  const bInfo = [];
  const triOwner = [];   // [first index position, building index] for tap lookups
  for (let bi = 0; bi < T.b.length; bi++) {
    const [rf, hf, hdm, mindm, gdm, flags, fam, levels, nameIx, colour, osmId, roofHdm, roofColour] = T.b[bi];
    const outer = ring(rf), holes = hf.map(ring), h = D(hdm), g0 = D(gdm), base = g0 + D(mindm), top = g0 + h;
    const isLandmark = city.landmarkIds && city.landmarkIds.has(osmId);
    const fname = FAMS[fam] || "brick"; const Rb = rng(osmId % 2147483647);
    let col = PAL[fname][Math.floor(Rb() * PAL[fname].length)];
    if (colour && typeof colour === "string") { try { _c.setStyle(colour); const l = (_c.r + _c.g + _c.b) / 3; const k = (v) => Math.min(1.25, 0.45 + 0.75 * v / Math.max(0.25, l) * Math.max(0.35, l)); col = [k(_c.r), k(_c.g), k(_c.b)]; } catch (e) { } }   // tint, never black
    if (opts.showGuess && (flags & 1)) col = [1.4, 0.7, 0.3];
    const shade = 0.9 + Rb() * 0.18; col = col.map((v) => v * shade);
    const famCell = fname === "brick" ? (Rb() < 0.7 ? CELL.brick : CELL.buff) : fname === "stone" ? CELL.stone : fname === "glass" ? (h > 30 || Rb() < 0.5 ? CELL.glass : CELL.ribbon) : fname === "concrete" ? CELL.ribbon : fname === "house" ? CELL.house : fname === "industrial" ? CELL.industrial : CELL.garage;
    const [bw, fh] = BAY[famCell];
    const pitched = (flags & 4) && h < 14 && holes.length === 0;
    const shopOK = (fname === "brick" || fname === "stone" || fname === "glass" || fname === "concrete") && h >= 5 && D(mindm) < 1;
    const gh = 4.4;
    let eave = top, ridgeH = 0, obb = null;
    const dome = (flags & 32) && holes.length === 0, domeH = dome ? Math.max(1, D(roofHdm || 0) || (top - base) * 0.5) : 0;
    if (dome) eave = top - domeH;
    if (pitched) { obb = OBB(outer); ridgeH = Math.min(3.2, Math.max(1.2, Math.min(obb.w, obb.d) * 0.33)); eave = Math.max(base + 2.4, top - ridgeH); }
    const first = B.i.length;
    const doRing = (r, isHole) => {
      let A = 0; for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; A += p[0] * q[1] - q[0] * p[1]; }
      const sgn = (A > 0) !== isHole ? 1 : -1;
      for (let i = 0; i < r.length; i++) {
        const a = r[i], b = r[(i + 1) % r.length], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); if (L < 0.2) continue;
        const n = [sgn * dz / L, 0, -sgn * dx / L];
        const y0 = base - (D(mindm) > 0 ? 0 : 1.0);
        // street-facing? midpoint near a named street segment
        let street = false;
        if (shopOK && L > 3 && !isHole) { const mx = (a[0] + b[0]) / 2 + n[0] * 2, mz = (a[1] + b[1]) / 2 + n[2] * 2; for (const s of segs) { if (s[5] > 5 && s[5] !== 7) continue; if (distSeg(mx, mz, s) < s[4] + 7) { street = true; break; } } }
        let ys = y0;
        if (street) {
          const nb = Math.max(1, Math.round(L / 4.4)), cellK = h > 30 ? CELL.lobby : (Rb() < 0.5 ? CELL.shopA : CELL.shopB);
          B.quad([a[0], base, a[1]], [b[0], base, b[1]], [b[0], base + gh, b[1]], [a[0], base + gh, a[1]], n, [0, 0, nb, 0, nb, 1, 0, 1], [1, 1, 1], cellK, Rb() * 50);
          if (y0 < base) B.quad([a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], base, b[1]], [a[0], base, a[1]], n, [0, 0, L / 3, 0, L / 3, 0.3, 0, 0.3], col, CELL.blankStone);
          // awning-ish storefront cornice: a little box out of the wall
          const o = 0.35, y1 = base + gh, yb = y1 - 0.35, nx = n[0] * o, nz = n[2] * o;
          B.quad([a[0] + nx, yb, a[1] + nz], [b[0] + nx, yb, b[1] + nz], [b[0] + nx, y1, b[1] + nz], [a[0] + nx, y1, a[1] + nz], n, [0, 0, L / 3, 0, L / 3, 0.1, 0, 0.1], [0.85, 0.82, 0.75], CELL.metal);
          B.quad([a[0], y1, a[1]], [b[0], y1, b[1]], [b[0] + nx, y1, b[1] + nz], [a[0] + nx, y1, a[1] + nz], [0, 1, 0], [0, 0, L / 3, 0, L / 3, 0.1, 0, 0.1], [0.7, 0.7, 0.7], CELL.metal);
          ys = base + gh;
        }
        const wallTop = pitched || dome ? eave : top;
        const blankCell = famCell === CELL.stone || famCell === CELL.glass || famCell === CELL.ribbon ? CELL.blankStone : CELL.blankBrick;
        const punched = famCell === CELL.brick || famCell === CELL.buff || famCell === CELL.stone;
        const par = punched && !pitched && wallTop - ys > 4 ? 1.0 : 0;
        const wy1 = wallTop - par;
        if (wy1 > ys + 0.2) {
          const windows = L >= 2.2 && !(isHole && famCell === CELL.glass);
          const nb = Math.max(1, Math.round(L / bw)), nf = levels > 0 ? Math.max(1, Math.round(levels * (wy1 - Math.max(ys, base)) / Math.max(1, top - base)) - (ys > base + 1 ? 0 : 0)) : Math.max(1, Math.round((wy1 - Math.max(ys, base)) / fh));   // tagged floors win
          const v0 = (ys - Math.max(ys, base)) / ((wy1 - Math.max(ys, base)) / nf);
          if (windows) B.quad([a[0], ys, a[1]], [b[0], ys, b[1]], [b[0], wy1, b[1]], [a[0], wy1, a[1]], n, [0, v0, nb, v0, nb, nf, 0, nf], col, famCell, (osmId % 997) + i * 3.1);
          else B.quad([a[0], ys, a[1]], [b[0], ys, b[1]], [b[0], wy1, b[1]], [a[0], wy1, a[1]], n, [0, ys / 3, L / 3, ys / 3, L / 3, wy1 / 3, 0, wy1 / 3], famCell === CELL.house ? col : col, famCell === CELL.house ? CELL.house : blankCell, 9e3);
        }
        if (par) {
          const pc = famCell === CELL.stone ? col : col.map((v) => v * 0.95);
          B.quad([a[0], wy1, a[1]], [b[0], wy1, b[1]], [b[0], wallTop, b[1]], [a[0], wallTop, a[1]], n, [0, 0, L / 3, 0, L / 3, 0.33, 0, 0.33], pc, blankCell);
          if (opts.detail && !isHole) {   // cornice: a projecting band under the parapet
            const o = 0.4, c0 = wy1 - 0.45, c1 = wy1 + 0.05, nx = n[0] * o, nz = n[2] * o, tc = [0.95, 0.92, 0.85];
            B.quad([a[0] + nx, c0, a[1] + nz], [b[0] + nx, c0, b[1] + nz], [b[0] + nx, c1, b[1] + nz], [a[0] + nx, c1, a[1] + nz], n, [0, 0, L / 3, 0, L / 3, 0.15, 0, 0.15], tc, CELL.blankStone);
            B.quad([a[0], c0, a[1]], [b[0], c0, b[1]], [b[0] + nx, c0, b[1] + nz], [a[0] + nx, c0, a[1] + nz], [0, -1, 0], [0, 0, L / 3, 0, L / 3, 0.1, 0, 0.1], tc.map((v) => v * 0.6), CELL.blankStone);
            B.quad([a[0], c1, a[1]], [b[0], c1, b[1]], [b[0] + nx, c1, b[1] + nz], [a[0] + nx, c1, a[1] + nz], [0, 1, 0], [0, 0, L / 3, 0, L / 3, 0.1, 0, 0.1], tc, CELL.blankStone);
          }
        }
      }
    };
    doRing(outer, false); for (const hr of holes) doRing(hr, true);
    // roof
    if (dome) {   // roof:shape=dome: a hemisphere fitted to the footprint
      const [cx, cz] = cent(outer); let r = 0; for (const p of outer) r += Math.hypot(p[0] - cx, p[1] - cz); r /= outer.length;
      let dc = [0.58, 0.62, 0.56]; if (roofColour) { try { _c.setStyle(roofColour); dc = [_c.r, _c.g, _c.b]; } catch (e) { } }
      const sph = new THREE.SphereGeometry(1, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), P = sph.attributes.position, N = sph.attributes.normal, o = cellOff(CELL.metal), v = B.v;
      for (let k = 0; k < P.count; k++) { B.p.push(cx + P.getX(k) * r, eave + P.getY(k) * domeH, cz + P.getZ(k) * r); const n = norm([N.getX(k) / r, N.getY(k) / domeH, N.getZ(k) / r]); B.n.push(n[0], n[1], n[2]); B.u.push(P.getX(k) * 2, P.getY(k) * 2); B.c.push(dc[0], dc[1], dc[2]); B.k.push(o[0], o[1], 0); }
      for (let k = 0; k < sph.index.count; k++) B.i.push(v + sph.index.getX(k)); B.v += P.count;
    } else if (pitched) {
      const { c, ux, uz, vx, vz, w, d } = obb, ov = 0.35, alongU = w >= d, rc = ROOFCOL[Math.floor(Rb() * ROOFCOL.length)];
      const hu = w / 2 + ov, hv = d / 2 + ov, P = (u, v, y) => [c[0] + ux * u + vx * v, y, c[1] + uz * u + vz * v];
      if (alongU) {
        const r0 = P(-hu, 0, top), r1 = P(hu, 0, top), e00 = P(-hu, -hv, eave - 0.15), e10 = P(hu, -hv, eave - 0.15), e01 = P(-hu, hv, eave - 0.15), e11 = P(hu, hv, eave - 0.15);
        const n1 = norm(cross(sub(e10, e00), sub(r0, e00))), n2 = norm(cross(sub(r1, e11), sub(e01, e11)));
        B.quad(e00, e10, r1, r0, n1[1] > 0 ? n1 : n1.map((x) => -x), [0, 0, w / 3, 0, w / 3, hv / 2, 0, hv / 2], rc, CELL.shingle);
        B.quad(e11, e01, r0, r1, n2[1] > 0 ? n2 : n2.map((x) => -x), [0, 0, w / 3, 0, w / 3, hv / 2, 0, hv / 2], rc, CELL.shingle);
        for (const [s, ea, eb, r] of [[-1, e00, e01, r0], [1, e10, e11, r1]]) { const nn = [ux * s, 0, uz * s]; const ea2 = P(s * (hu - ov), -(hv - ov), eave), eb2 = P(s * (hu - ov), hv - ov, eave), rr = P(s * (hu - ov), 0, top); B.quad(ea2, eb2, rr, rr, nn, [0, 0, 2, 0, 1, 1, 1, 1], col, CELL.house, 9e3); }
      } else {
        const r0 = P(0, -hv, top), r1 = P(0, hv, top), e00 = P(-hu, -hv, eave - 0.15), e01 = P(-hu, hv, eave - 0.15), e10 = P(hu, -hv, eave - 0.15), e11 = P(hu, hv, eave - 0.15);
        const n1 = norm(cross(sub(e01, e00), sub(r0, e00))), n2 = norm(cross(sub(r1, e11), sub(e10, e11)));
        B.quad(e00, e01, r1, r0, n1[1] > 0 ? n1 : n1.map((x) => -x), [0, 0, d / 3, 0, d / 3, hu / 2, 0, hu / 2], rc, CELL.shingle);
        B.quad(e11, e10, r0, r1, n2[1] > 0 ? n2 : n2.map((x) => -x), [0, 0, d / 3, 0, d / 3, hu / 2, 0, hu / 2], rc, CELL.shingle);
        for (const [s] of [[-1], [1]]) { const nn = [vx * s, 0, vz * s]; const ea2 = P(-(hu - ov), s * (hv - ov), eave), eb2 = P(hu - ov, s * (hv - ov), eave), rr = P(0, s * (hv - ov), top); B.quad(ea2, eb2, rr, rr, nn, [0, 0, 2, 0, 1, 1, 1, 1], col, CELL.house, 9e3); }
      }
    } else {
      const tri = triangulate(outer, holes); const pts = outer.concat(...holes).map((p) => [p[0], top - (famCell === CELL.brick || famCell === CELL.buff || famCell === CELL.stone ? 0.55 : 0), p[1]]);
      upTris(B, pts, tri, (p) => [p[0] / 8, p[2] / 8], [0.85, 0.85, 0.84], CELL.roof);
      // rooftop units (detail tiles, big flat roofs)
      if (opts.detail && h > 6) {
        const ar = Math.abs(polyArea(outer)), units = ar > 250 ? 1 + Math.floor(Rb() * 3) : 0, [cx, cz] = cent(outer);
        for (let u = 0; u < units; u++) {
          const px = cx + (Rb() - 0.5) * Math.sqrt(ar) * 0.5, pz = cz + (Rb() - 0.5) * Math.sqrt(ar) * 0.5; if (!inside([px, pz], outer)) continue;
          const uw = 1.2 + Rb() * 2.4, ud = 1 + Rb() * 2, uh = 0.9 + Rb() * 1.4; boxAcc(B, px - uw / 2, top - 0.5, pz - ud / 2, px + uw / 2, top - 0.5 + uh, pz + ud / 2, Rb() < 0.5 ? [0.95, 0.95, 0.95] : [0.75, 0.77, 0.8], CELL.metal);
        }
      }
    }
    triOwner.push([first, bInfo.length]);
    bInfo.push({ ring: outer, holes, y0: base, top, h, name: nameIx >= 0 ? city.names[nameIx] : "", flags, levels, id: osmId, fam: fname, landmark: isLandmark });
  }

  // ---- ground: terrain grid (urban ground), areas, roads, paint
  const GN = T.g ? gn - 1 : 1, gstep = TILE / GN;
  const ground_y0 = 0;
  for (let j = 0; j < GN; j++) for (let i = 0; i < GN; i++) {
    const x0 = ox + i * gstep, z0 = oz + j * gstep, x1 = x0 + gstep, z1 = z0 + gstep;
    const p = [[x0, ground(x0, z0), z0], [x1, ground(x1, z0), z0], [x1, ground(x1, z1), z1], [x0, ground(x0, z1), z1]];
    const n = norm(cross(sub(p[3], p[0]), sub(p[1], p[0])));
    G.quad(p[0], p[1], p[2], p[3], n[1] > 0 ? n : n.map((v) => -v), [x0 / 5, -z0 / 5, x1 / 5, -z0 / 5, x1 / 5, -z1 / 5, x0 / 5, -z1 / 5], [1, 1, 1], GCELL.urban);
  }
  const AC = [null, GCELL.park, GCELL.lawn, GCELL.woods, GCELL.parking, GCELL.pitch, GCELL.cemetery];
  const treeSpots = [];
  for (const [k, of, hf, lvl] of T.a) {
    const outer = ring(of), holes = hf.map(ring), tri = triangulate(outer, holes); if (!tri.length) continue;
    const all = outer.concat(...holes);
    if (k === 0) { const y = T.g ? lvl / 10 + 0.25 : -0.4; upTris(Wt, all.map((p) => [p[0], y, p[1]]), tri, (p) => [p[0], p[2]], [1, 1, 1], 0); continue; }
    let gy = 0; for (const p of outer) gy += ground(p[0], p[1]); gy /= outer.length;
    upTris(G, all.map((p) => [p[0], Math.max(ground(p[0], p[1]), gy - 0.5) + (k === 4 ? 0.1 : 0.07), p[1]]), tri, (p) => [p[0] / 5, -p[2] / 5], [1, 1, 1], AC[k] ?? GCELL.lawn);
    if (k === 1 || k === 3 || k === 6) {   // scatter trees in parks and woods
      const ar = Math.abs(polyArea(outer)), n = Math.min(k === 3 ? 160 : 60, Math.floor(ar / (k === 3 ? 60 : 220))), [x0, z0, x1, z1] = bbox(outer);
      for (let t = 0, tries = 0; t < n && tries < n * 4; tries++) { const x = x0 + R() * (x1 - x0), z = z0 + R() * (z1 - z0); if (inside([x, z], outer) && !holes.some((hh) => inside([x, z], hh))) { treeSpots.push([x, z, k === 3 ? 1.2 : 1]); t++; } }
    }
  }
  for (const [wdm, nameIx, pts] of T.w) { const r = ring(pts), lvl = T.g ? Math.min(...r.map((p) => ground(p[0], p[1]))) + 0.2 : -0.4; ribbon(Wt, r, wdm / 20, () => lvl, 0, [1, 1, 1], null); }
  const roadY = (r) => {   // per-vertex heights: bridges lerp between their ends, the rest follows the ground
    if (r.flags & 2) { const L = cum(r.pts), tot = L[L.length - 1] || 1, ya = r.gy[0] / 10, yb = r.gy[r.gy.length - 1] / 10; return (x, z, s) => ya + (yb - ya) * (s / tot) + 0.35; }
    return (x, z) => ground(x, z);
  };
  const OFF = { sidewalk: 0.1, asphalt: 0.15, paint: 0.19 };
  const signPosts = [];
  for (const r of roadPieces) {
    const yf = roadY(r), hw = r.w / 2, isStreet = r.kind <= 4, foot = r.kind >= 6;
    if (isStreet && !(r.flags & 2) && r.kind !== 0) ribbon(G, r.pts, hw + 3.2, yf, OFF.sidewalk, [1, 1, 1], GCELL.sidewalk, 3);
    ribbon(G, r.pts, hw, yf, foot ? OFF.sidewalk + 0.02 : OFF.asphalt, [1, 1, 1], foot ? (r.kind === 9 || r.kind === 11 ? GCELL.path : GCELL.sidewalk) : (r.flags & 2 && foot ? GCELL.deck : GCELL.asphalt), foot ? 2 : 6);
    if (r.flags & 2) {   // bridge: deck sides + railings
      const L = cum(r.pts); for (let i = 0; i < r.pts.length - 1; i++) { const a = r.pts[i], b = r.pts[i + 1]; bridges.push({ ax: a[0], az: a[1], bx: b[0], bz: b[1], ya: yf(a[0], a[1], L[i]), yb: yf(b[0], b[1], L[i + 1]), hw: hw + 0.5 }); }
      for (const side of [-1, 1]) sideWall(G, r.pts, hw * side, yf, 0.15, -1.4, GCELL.deck), sideWall(G, r.pts, (hw + 0.1) * side, yf, 1.1, 0.15, GCELL.steel);
    }
    // paint (detail): centre lines, lane lines, crosswalks; trimmed at junctions
    if (opts.detail && r.kind >= 1 && r.kind <= 4 && !foot) {
      const L = cum(r.pts), tot = L[L.length - 1], jd = []; r.jn.forEach((j, i) => { if (j) jd.push(L[i]); });
      const ok = (s) => jd.every((d) => Math.abs(s - d) > hw + 5);
      if (!(r.flags & 1) && r.kind <= 3) { for (const o of [-0.13, 0.13]) dashed(G, r.pts, L, o, 0.11, yf, OFF.paint, GCELL.yellow, 1e9, 0, ok); }
      else if ((r.flags & 1) && r.lanes >= 2) { for (let l = 1; l < r.lanes; l++) dashed(G, r.pts, L, -hw + (r.w / r.lanes) * l, 0.11, yf, OFF.paint, GCELL.white, 3, 6, ok); }
      if (tot > 3 * hw + 10) for (let i = 0; i < r.pts.length; i++) if (r.jn[i] && (i === 0 || i === r.pts.length - 1) && r.kind <= 4) crosswalk(G, r.pts, L, i === 0 ? hw + 3.5 : tot - hw - 3.5, hw, yf);
    }
    // junctions for sign posts
    if (r.kind <= 5 && r.nameIx >= 0) r.pts.forEach((p, i) => { if (!r.jn[i]) return; const key = Math.round(p[0]) + "," + Math.round(p[1]); let J = junction.get(key); if (!J) junction.set(key, (J = { x: p[0], z: p[1], y: yf(p[0], p[1], 0), roads: [] })); const q = r.pts[i === 0 ? 1 : i - 1]; let dx = q[0] - p[0], dz = q[1] - p[1]; const l = Math.hypot(dx, dz) || 1; J.roads.push({ name: city.names[r.nameIx], dx: dx / l, dz: dz / l, hw }); });
  }
  // rails: ballast + two rails
  for (const [flags, layer, nameIx, pts, gyv] of T.rl) {
    const r = ring(pts); if (flags & 8) continue; const L = cum(r), tot = L[L.length - 1] || 1;
    const yf = flags & 2 ? (x, z, s) => gyv[0] / 10 + (gyv[gyv.length - 1] - gyv[0]) / 10 * (s / tot) + 0.6 : (x, z) => ground(x, z) + 0.05;
    ribbon(G, r, 1.8, yf, 0.12, [1, 1, 1], GCELL.ballast, 3);
    for (const o of [-0.72, 0.72]) sideWall(G, offsetLine(r, o), 0, yf, 0.32, 0.17, GCELL.steel);
    if (flags & 2) for (const side of [-1, 1]) sideWall(G, r, 2.0 * side, yf, 0.6, -1.2, GCELL.deck);
  }

  // ---- sign posts at named junctions (two blades, each parallel to its street)
  const SG = opts.detail ? new Acc(false) : null;
  if (SG) for (const J of junction.values()) {
    const uniq = []; for (const r of J.roads) if (!uniq.some((u) => u.name === r.name)) uniq.push(r);
    if (uniq.length < 2) continue;
    const r1 = uniq[0], r2 = uniq[1];
    const px = J.x + r1.dx * (r2.hw + 2.2) + r2.dx * (r1.hw + 2.2), pz = J.z + r1.dz * (r2.hw + 2.2) + r2.dz * (r1.hw + 2.2), py = ground(px, pz) + OFF.sidewalk;
    boxAcc(SG, px - 0.05, py, pz - 0.05, px + 0.05, py + 3.6, pz + 0.05, [0.6, 0.6, 0.6], 0, true);
    [[r1, 3.0], [r2, 3.32]].forEach(([r, y]) => {
      const k = signSlot(r.name), u0 = (k % 4) / 4, u1 = u0 + 0.25, v1 = 1 - Math.floor(k / 4) / 32, v0 = v1 - 1 / 32;
      const L = 1.5, hx = r.dx * L / 2, hz = r.dz * L / 2, n = [-r.dz, 0, r.dx];
      const a = [px - hx, py + y, pz - hz], b = [px + hx, py + y, pz + hz], c = [px + hx, py + y + 0.24, pz + hz], d = [px - hx, py + y + 0.24, pz - hz];
      const off = (p, s) => [p[0] + n[0] * s, p[1], p[2] + n[2] * s];
      // a viewer on the +n side has +d to the right, so that face runs a->b; the back face runs b->a (text never mirrored)
      SG.quad(off(a, 0.012), off(b, 0.012), off(c, 0.012), off(d, 0.012), n, [u0, v0, u1, v0, u1, v1, u0, v1], [1, 1, 1]);
      SG.quad(off(b, -0.012), off(a, -0.012), off(d, -0.012), off(c, -0.012), [-n[0], 0, -n[2]], [u0, v0, u1, v0, u1, v1, u0, v1], [1, 1, 1]);
    });
    signPosts.push({ x: px, z: pz, names: [r1.name, r2.name] });
  }

  // ---- lamps along streets (detail) + trees
  const lamps = [];
  if (opts.detail) for (const r of roadPieces) { if (r.kind < 1 || r.kind > 4 || (r.flags & 2)) continue; const L = cum(r.pts), tot = L[L.length - 1]; let side = 1; for (let s = 12; s < tot - 8; s += 32) { const [x, z, dx, dz] = along(r.pts, L, s); const o = (r.w / 2 + 0.8) * side; side = -side; lamps.push([x - dz * o, ground(x - dz * o, z + dx * o) + OFF.sidewalk, z + dx * o]); } }
  for (let i = 0; i < T.t.length; i += 2) treeSpots.push([ox + T.t[i] / 10, oz + T.t[i + 1] / 10, 1]);

  // ---- meshes
  const group = new THREE.Group(); group.name = "tile " + T.ix + "_" + T.iz;
  const add = (acc, mat, cast, name) => { const g = acc.geo(); if (!g) return null; const m = new THREE.Mesh(g, mat); m.castShadow = cast; m.receiveShadow = true; m.name = name; group.add(m); return m; };
  const bMesh = add(B, M.building, true, "buildings"); const gMesh = add(G, M.ground, false, "ground"); add(Wt, M.water, false, "water");
  if (SG) { const s = add(SG, M.sign, false, "signs"); }
  if (bMesh) bMesh.userData.owner = triOwner;
  if (lamps.length) {
    const pole = new THREE.InstancedMesh(LAMP.pole, M.pole, lamps.length), head = new THREE.InstancedMesh(LAMP.head, M.lampHead, lamps.length), m4 = new THREE.Matrix4();
    lamps.forEach((p, i) => { m4.makeTranslation(p[0], p[1], p[2]); pole.setMatrixAt(i, m4); head.setMatrixAt(i, m4); }); pole.computeBoundingSphere(); head.computeBoundingSphere(); pole.castShadow = true; group.add(pole, head); pole.name = "lamps"; head.name = "lampHeads";
  }
  if (treeSpots.length) {
    const n = Math.min(treeSpots.length, 400), tr = new THREE.InstancedMesh(TREE.trunk, M.trunk, n), cr = new THREE.InstancedMesh(TREE.crown, M.crown, n), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
    for (let i = 0; i < n; i++) { const [x, z, big] = treeSpots[i]; const sc = (0.75 + R() * 0.6) * big; q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), R() * 6.28); s.set(sc, sc * (0.9 + R() * 0.3), sc); p.set(x, ground(x, z) + 0.05, z); m4.compose(p, q, s); tr.setMatrixAt(i, m4); cr.setMatrixAt(i, m4); col.setHSL(0.24 + R() * 0.08, 0.35 + R() * 0.2, 0.22 + R() * 0.1); cr.setColorAt(i, col); }
    tr.computeBoundingSphere(); cr.computeBoundingSphere(); tr.castShadow = cr.castShadow = true; cr.receiveShadow = true; group.add(tr, cr); cr.name = "trees";
  }
  return { group, buildings: bInfo, bridges, ground, signPosts, lamps: lamps.length, bMesh, gMesh };
}

// ------------------------------------------------------------------------------------------------ shared instanced geometry
import { mergeGeometries } from "https://cdn.jsdelivr.net/npm/three@0.182.0/examples/jsm/utils/BufferGeometryUtils.js";
const LAMP = (() => {
  const pole = mergeGeometries([new THREE.CylinderGeometry(0.07, 0.11, 4.6, 6).translate(0, 2.3, 0), new THREE.CylinderGeometry(0.18, 0.22, 0.5, 8).translate(0, 0.25, 0), new THREE.BoxGeometry(0.06, 0.06, 1.1).translate(0, 4.55, 0.5)]);
  const head = new THREE.CylinderGeometry(0.12, 0.28, 0.35, 8).translate(0, 4.4, 1.0);
  return { pole, head };
})();
const TREE = (() => ({ trunk: new THREE.CylinderGeometry(0.12, 0.2, 2.6, 5).translate(0, 1.3, 0), crown: new THREE.IcosahedronGeometry(2.3, 1).scale(1, 1.15, 1).translate(0, 4.2, 0) }))();

// ------------------------------------------------------------------------------------------------ geometry helpers
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function norm(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
export function inside(pt, r) { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, zi] = r[i], [xj, zj] = r[j]; if ((zi > pt[1]) !== (zj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - zi) / (zj - zi) + xi) c = !c; } return c; }
function polyArea(r) { let A = 0; for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; A += p[0] * q[1] - q[0] * p[1]; } return A / 2; }
function cent(r) { let x = 0, z = 0; for (const p of r) { x += p[0]; z += p[1]; } return [x / r.length, z / r.length]; }
function bbox(r) { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; for (const p of r) { a = Math.min(a, p[0]); b = Math.min(b, p[1]); c = Math.max(c, p[0]); d = Math.max(d, p[1]); } return [a, b, c, d]; }
export function distSeg(x, z, s) { const dx = s[2] - s[0], dz = s[3] - s[1], l2 = dx * dx + dz * dz || 1; let t = ((x - s[0]) * dx + (z - s[1]) * dz) / l2; t = Math.max(0, Math.min(1, t)); return Math.hypot(x - s[0] - t * dx, z - s[1] - t * dz); }
function OBB(r) {
  let best = 0, ang = 0; for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length], L = Math.hypot(q[0] - p[0], q[1] - p[1]); if (L > best) { best = L; ang = Math.atan2(q[1] - p[1], q[0] - p[0]); } }
  const ux = Math.cos(ang), uz = Math.sin(ang), vx = -uz, vz = ux, [cx, cz] = cent(r); let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const p of r) { const u = (p[0] - cx) * ux + (p[1] - cz) * uz, v = (p[0] - cx) * vx + (p[1] - cz) * vz; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
  const mu = (u0 + u1) / 2, mv = (v0 + v1) / 2; return { c: [cx + ux * mu + vx * mv, cz + uz * mu + vz * mv], ux, uz, vx, vz, w: u1 - u0, d: v1 - v0 };
}
function cum(pts) { const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return L; }
function along(pts, L, s) { let i = 0; while (i < L.length - 2 && L[i + 1] < s) i++; const a = pts[i], b = pts[i + 1], l = L[i + 1] - L[i] || 1, t = (s - L[i]) / l, dx = (b[0] - a[0]) / l, dz = (b[1] - a[1]) / l; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, dx, dz]; }
function densify(pts, step) { const out = []; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step)); for (let k = 0; k < n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); } out.push(pts[pts.length - 1]); return out; }
function offsetLine(pts, o) { return pts.map((p, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]; let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; return [p[0] - dz / l * o, p[1] + dx / l * o]; }); }
// flat ribbon along a polyline (mitred), heights from yf(x,z,s)
function ribbon(acc, pts0, hw, yf, off, col, cell, uvScale = 4) {
  const pts = densify(pts0, 10); if (pts.length < 2) return; const L = cum(pts);
  const sides = pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]; let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    let m = 1; if (i > 0 && i < pts.length - 1) { const d1x = p[0] - a[0], d1z = p[1] - a[1], l1 = Math.hypot(d1x, d1z) || 1; m = 1 / Math.max(0.4, (d1x / l1) * dx + (d1z / l1) * dz); }
    const y = yf(p[0], p[1], L[i]) + off; return [[p[0] - dz * hw * m, y, p[1] + dx * hw * m], [p[0] + dz * hw * m, y, p[1] - dx * hw * m]];
  });
  for (let i = 0; i < pts.length - 1; i++) {
    const [a0, a1] = sides[i], [b0, b1] = sides[i + 1];
    acc.quad(a0, b0, b1, a1, [0, 1, 0], [a0[0] / uvScale, -a0[2] / uvScale, b0[0] / uvScale, -b0[2] / uvScale, b1[0] / uvScale, -b1[2] / uvScale, a1[0] / uvScale, -a1[2] / uvScale], col, cell);
  }
}
function sideWall(acc, pts0, o, yf, yTop, yBot, cell) {   // vertical strip along a line, offset o; from y+yBot to y+yTop
  const pts = offsetLine(densify(pts0, 10), o), L = cum(pts);
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], ya = yf(a[0], a[1], L[i]), yb = yf(b[0], b[1], L[i + 1]), dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, s = o >= 0 ? 1 : -1;
    const n = [-dz / l * s, 0, dx / l * s];
    acc.quad([a[0], ya + yBot, a[1]], [b[0], yb + yBot, b[1]], [b[0], yb + yTop, b[1]], [a[0], ya + yTop, a[1]], n, [L[i] / 3, 0, L[i + 1] / 3, 0, L[i + 1] / 3, 0.3, L[i] / 3, 0.3], [1, 1, 1], cell);
  }
}
function dashed(acc, pts, L, o, hw, yf, off, cell, dash, gap, ok) {
  const tot = L[L.length - 1], step = dash + gap;
  for (let s = 0; s < tot; s += Math.min(step, 4)) {
    const e = Math.min(tot, s + Math.min(dash, 4)); if (!ok(s) || !ok(e)) continue; if (gap && (s % step) >= dash) continue;
    const [x0, z0, dx, dz] = along(pts, L, s), [x1, z1] = along(pts, L, e); const nx = -dz, nz = dx;
    const y0 = yf(x0, z0, s) + off, y1 = yf(x1, z1, e) + off;
    acc.quad([x0 + nx * (o - hw), y0, z0 + nz * (o - hw)], [x1 + nx * (o - hw), y1, z1 + nz * (o - hw)], [x1 + nx * (o + hw), y1, z1 + nz * (o + hw)], [x0 + nx * (o + hw), y0, z0 + nz * (o + hw)], [0, 1, 0], [0, 0, 1, 0, 1, 1, 0, 1], [1, 1, 1], cell);
  }
}
function crosswalk(acc, pts, L, s, hw, yf) {
  const [x, z, dx, dz] = along(pts, L, s), nx = -dz, nz = dx, y = yf(x, z, s) + 0.19;
  for (let o = -hw + 0.4; o < hw - 0.3; o += 1.1) {
    const cx = x + nx * o, cz = z + nz * o, a = 1.5, b = 0.25;
    acc.quad([cx - dx * a - nx * b, y, cz - dz * a - nz * b], [cx + dx * a - nx * b, y, cz + dz * a - nz * b], [cx + dx * a + nx * b, y, cz + dz * a + nz * b], [cx - dx * a + nx * b, y, cz - dz * a + nz * b], [0, 1, 0], [0, 0, 1, 0, 1, 1, 0, 1], [1, 1, 1], GCELL.white);
  }
}
function boxAcc(acc, x0, y0, z0, x1, y1, z1, col, cell, noCell) {
  const q = (a, b, c, d, n) => acc.quad(a, b, c, d, n, [0, 0, 1, 0, 1, 1, 0, 1], col, cell);
  q([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [0, 0, -1]); q([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]);
  q([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]); q([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], [1, 0, 0]);
  q([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], [0, 1, 0]);
}

// ------------------------------------------------------------------------------------------------ landmark: the Allen County Courthouse dome
// OSM gives the footprint and an eave height of 19 m. The dome is hand-built: drum with columns, copper-green dome,
// lantern and a statue. Its height is ESTIMATED from photos, not measured. Proper Beaux-Arts detail = Blender bake later.
export function buildDome(cx, cz, baseY) {
  const M = makeMaterials(); const g = new THREE.Group(); g.name = "courthouse dome";
  const y = baseY;
  const add = (geo, mat, px, py, pz) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
  add(new THREE.CylinderGeometry(11.5, 11.5, 2.2, 32), M.stone, cx, y + 1.1, cz);                // base ring over the roof
  add(new THREE.CylinderGeometry(9.4, 9.4, 7.5, 32, 1, true), M.stone, cx, y + 2.2 + 3.75, cz);  // drum
  const colGeo = mergeGeometries(Array.from({ length: 16 }, (_, i) => { const a = i / 16 * Math.PI * 2; return new THREE.CylinderGeometry(0.42, 0.48, 6.8, 8).translate(Math.cos(a) * 10.2, 0, Math.sin(a) * 10.2); }));
  add(colGeo, M.stone, cx, y + 2.2 + 3.4, cz);
  add(new THREE.CylinderGeometry(10.9, 10.9, 1.0, 32), M.stone, cx, y + 10.2, cz);                 // entablature
  add(new THREE.SphereGeometry(9.6, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.18, 1), M.copper, cx, y + 10.7, cz);
  add(new THREE.CylinderGeometry(2.0, 2.3, 4.2, 12), M.stone, cx, y + 10.7 + 11.3 + 2.1, cz);     // lantern
  add(new THREE.SphereGeometry(2.4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.copper, cx, y + 26.2, cz);
  add(new THREE.CylinderGeometry(0.25, 0.4, 3.2, 8), M.gold, cx, y + 28.2 + 1.6, cz);             // statue (stand-in)
  g.userData.top = y + 31.4;
  return g;
}
