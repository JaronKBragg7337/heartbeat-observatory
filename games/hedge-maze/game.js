// The Hedge - a Halloween hedge maze. Built by Claude (Opus 5.5) for Heartbeat Observatory, 2026-10-31.
// One file on purpose: maze + hedges + the Eye + shadow creatures + traps (traps.json) + sound made in code.
import * as THREE from 'three';

const DEV = /[?&]dev=1/.test(location.search);
const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------- config
const N = 35;                 // cells per side (35 x 35)
const C = 4;                  // corridor width (m)
const T = 1.6;                // hedge thickness (m)
const P = C + T;              // cell pitch
const H = 5.4;                // hedge height = 3x a 1.8 m player
const G = 2 * N + 1;          // grid size (walls + cells)
const W = N * P + T;          // world size (m)
const SEED = 31102026;
const EYE_H = 105;
const FOG_FAR = 34;
const PLAYER_R = 0.55, EYE_LEVEL = 1.62, SPEED = 4.6;
const POOL_R = 8.5;
const HUNT_LOSE = 12;         // seconds without line of sight before the shadows give up
const SAVE_KEY = 'hedge-save-v1';

// ---------------------------------------------------------------- small helpers
function mulberry(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function strHash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function hash3(x, y, z) { let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function noise3(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
  const a = hash3(ix, iy, iz), b = hash3(ix + 1, iy, iz), c = hash3(ix, iy + 1, iz), d = hash3(ix + 1, iy + 1, iz);
  const e = hash3(ix, iy, iz + 1), f = hash3(ix + 1, iy, iz + 1), g = hash3(ix, iy + 1, iz + 1), h = hash3(ix + 1, iy + 1, iz + 1);
  const x1 = a + (b - a) * ux, x2 = c + (d - c) * ux, x3 = e + (f - e) * ux, x4 = g + (h - g) * ux;
  const y1 = x1 + (x2 - x1) * uy, y2 = x3 + (x4 - x3) * uy;
  return y1 + (y2 - y1) * uz;
}
function fbm(x, y, z) { return (noise3(x, y, z) * 0.5 + noise3(x * 2.03, y * 2.03, z * 2.03) * 0.3 + noise3(x * 4.1, y * 4.1, z * 4.1) * 0.2); }
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const cc = (c) => c * P + T + C / 2;                  // cell index -> world centre
const gStart = (i) => (i >> 1) * P + ((i & 1) ? T : 0);
const gSize = (i) => ((i & 1) ? C : T);
function toG(x) { if (x < 0) return -1; const k = Math.floor(x / P); const r = x - k * P; const g = r < T ? 2 * k : 2 * k + 1; return g >= G ? G : g; }
const toCell = (x) => clamp(Math.floor((x - T * 0.5) / P), 0, N - 1);
function fmtTime(s) { s = Math.max(0, Math.floor(s)); const m = Math.floor(s / 60); return m + ':' + String(s % 60).padStart(2, '0'); }

// ---------------------------------------------------------------- save
let save = null;
try { save = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { save = null; }
let prefs = { muted: false, best: 0 };
try { prefs = Object.assign(prefs, JSON.parse(localStorage.getItem('hedge-prefs') || '{}')); } catch (e) {}
function writeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }
function writePrefs() { try { localStorage.setItem('hedge-prefs', JSON.stringify(prefs)); } catch (e) {} }

// ---------------------------------------------------------------- traps file
const FALLBACK_TRAPS = { traps: [{ id: 'jaron-loop', by: 'Jaron', cell: 'auto', type: 'loop', params: { length: 9, axis: 'x', loops: 3 }, lines: ['Huh. This stretch feels long.', "Wait. Didn't I already pass that pumpkin?", 'Okay. The hedge is definitely laughing at me.', '...fine. The hedge lets you pass. This time.'], kind: 'both' }] };
async function loadTraps() {
  try { const r = await fetch('./traps.json', { cache: 'no-cache' }); if (!r.ok) throw 0; const j = await r.json(); if (!Array.isArray(j.traps)) throw 0; return j.traps; }
  catch (e) { return FALLBACK_TRAPS.traps; }
}

// ================================================================ MAZE
const grid = new Uint8Array(G * G);   // 0 floor, 1 hedge, 2 hidden gap (walkable curtain)
const protectedWall = new Uint8Array(G * G);
const gi = (gx, gz) => gz * G + gx;
const inG = (gx, gz) => gx >= 0 && gz >= 0 && gx < G && gz < G;
const isHedge = (gx, gz) => inG(gx, gz) && grid[gi(gx, gz)] === 1;
const solid = isHedge;
function open(x, y, dx, dy) { // can you walk from cell (x,y) to (x+dx,y+dy)?
  const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= N || ny >= N) return false;
  return grid[gi(2 * x + 1 + dx, 2 * y + 1 + dy)] !== 1;
}
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
function bfs(sx, sy, out) {
  out.fill(-1); const q = new Int32Array(N * N); let h = 0, t = 0;
  out[sy * N + sx] = 0; q[t++] = sy * N + sx;
  while (h < t) {
    const c = q[h++]; const x = c % N, y = (c / N) | 0; const d = out[c] + 1;
    for (const [dx, dy] of DIRS) { if (!open(x, y, dx, dy)) continue; const n = (y + dy) * N + x + dx; if (out[n] < 0) { out[n] = d; q[t++] = n; } }
  }
  return out;
}
function openings(x, y) { let n = 0; for (const [dx, dy] of DIRS) if (open(x, y, dx, dy)) n++; return n; }

let loopChain = null;   // {cells:[[x,y]...], axis, trap}
const canopy = new Set();
const shortcuts = [];   // {gx,gz, a:[x,y], b:[x,y], trap}

function buildMaze(traps) {
  const rnd = mulberry(SEED);
  grid.fill(1);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) grid[gi(2 * x + 1, 2 * y + 1)] = 0;
  // recursive backtracker (iterative)
  const seen = new Uint8Array(N * N); const stack = [[0, 0]]; seen[0] = 1;
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const opts = DIRS.filter(([dx, dy]) => { const nx = x + dx, ny = y + dy; return nx >= 0 && ny >= 0 && nx < N && ny < N && !seen[ny * N + nx]; });
    if (!opts.length) { stack.pop(); continue; }
    const [dx, dy] = opts[Math.floor(rnd() * opts.length)];
    grid[gi(2 * x + 1 + dx, 2 * y + 1 + dy)] = 0; seen[(y + dy) * N + x + dx] = 1; stack.push([x + dx, y + dy]);
  }
  // Jaron's loop corridor: a long straight run with solid sides
  const lt = traps.find((t) => t.type === 'loop');
  if (lt) {
    const p = lt.params || {}; const L = clamp(p.length | 0 || 9, 8, 15); const axis = p.axis === 'y' ? 'y' : 'x';
    let sx, sy;
    if (Array.isArray(lt.cell)) { sx = lt.cell[0] | 0; sy = lt.cell[1] | 0; } else { sx = Math.floor(N / 2) - Math.floor(L / 2); sy = Math.floor(N / 2); if (axis === 'y') { [sx, sy] = [sy, sx]; } }
    if (axis === 'x') { sx = clamp(sx, 1, N - L - 1); sy = clamp(sy, 1, N - 2); } else { sy = clamp(sy, 1, N - L - 1); sx = clamp(sx, 1, N - 2); }
    const cells = []; for (let i = 0; i < L; i++) cells.push(axis === 'x' ? [sx + i, sy] : [sx, sy + i]);
    for (let i = 0; i < L; i++) {
      const [x, y] = cells[i];
      if (i < L - 1) { const [nx, ny] = cells[i + 1]; grid[gi(x + nx + 1, y + ny + 1)] = 0; }
      if (i > 0 && i < L - 1) {
        const sides = axis === 'x' ? [[2 * x + 1, 2 * y], [2 * x + 1, 2 * y + 2]] : [[2 * x, 2 * y + 1], [2 * x + 2, 2 * y + 1]];
        for (const [gx, gz] of sides) { grid[gi(gx, gz)] = 1; protectedWall[gi(gx, gz)] = 1; }
      }
    }
    loopChain = { cells, axis, trap: lt, L };
  }
  // a few extra openings so there are loops to escape the shadows through
  for (let k = 0; k < N * N * 0.07; k++) {
    const x = Math.floor(rnd() * N), y = Math.floor(rnd() * N); const [dx, dy] = DIRS[Math.floor(rnd() * 4)];
    const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
    const w = gi(2 * x + 1 + dx, 2 * y + 1 + dy); if (protectedWall[w]) continue; grid[w] = 0;
  }
  // repair: every cell must be reachable
  const d = new Int32Array(N * N);
  for (let guard = 0; guard < 400; guard++) {
    bfs(0, 0, d); let fixed = false, any = false;
    for (let y = 0; y < N && !fixed; y++) for (let x = 0; x < N && !fixed; x++) {
      if (d[y * N + x] >= 0) continue; any = true;
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
        const w = gi(2 * x + 1 + dx, 2 * y + 1 + dy); if (protectedWall[w] || d[ny * N + nx] < 0) continue;
        grid[w] = 0; fixed = true; break;
      }
    }
    if (!any) break;
  }
  // exit gap in the east outer hedge at the far corner cell
  grid[gi(2 * N, 2 * (N - 1) + 1)] = 0;
  // hiding arches over some straight corridor cells
  const chainSet = new Set((loopChain ? loopChain.cells : []).map(([x, y]) => y * N + x));
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if ((x < 2 && y < 2) || chainSet.has(y * N + x)) continue;
    const ew = open(x, y, 1, 0) && open(x, y, -1, 0) && !open(x, y, 0, 1) && !open(x, y, 0, -1);
    const ns = open(x, y, 0, 1) && open(x, y, 0, -1) && !open(x, y, 1, 0) && !open(x, y, -1, 0);
    if ((ew || ns) && hash3(x, y, 77) < 0.16) canopy.add(y * N + x);
  }
}

// ================================================================ RENDERER / SCENE
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: (window.devicePixelRatio || 1) < 2, powerPreference: 'high-performance' });
let pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
renderer.setPixelRatio(pixelRatio);
const scene = new THREE.Scene();
const FOG_COL = new THREE.Color(0x141a24);
scene.background = FOG_COL.clone();
scene.fog = new THREE.Fog(FOG_COL, 3, FOG_FAR);
const camera = new THREE.PerspectiveCamera(72, 1, 0.08, 600);
camera.rotation.order = 'YXZ';
function resize() { const w = window.innerWidth, h = window.innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
window.addEventListener('resize', resize); resize();

scene.add(new THREE.HemisphereLight(0x6a7ca4, 0x141a10, 1.6));
const moon = new THREE.DirectionalLight(0x9fb4e0, 0.9); moon.position.set(-60, 120, -40); scene.add(moon);

function canvasTex(w, h, draw, repeat) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; }
  return t;
}
const leafTex = canvasTex(256, 256, (g, w, h) => {
  const r = mulberry(7); g.fillStyle = '#4a5a42'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 1400; i++) {
    const x = r() * w, y = r() * h, s = 5 + r() * 10, a = r() * Math.PI, l = 70 + r() * 150;
    g.fillStyle = `rgb(${l * 0.78 | 0},${l | 0},${l * 0.62 | 0})`;
    for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) { g.beginPath(); g.ellipse(x + ox, y + oy, s, s * 0.42, a, 0, Math.PI * 2); g.fill(); }
  }
  for (let i = 0; i < 260; i++) { g.fillStyle = 'rgba(0,0,0,.45)'; const x = r() * w, y = r() * h; g.beginPath(); g.arc(x, y, 1.5 + r() * 3, 0, 7); g.fill(); }
}, true);
const gravelTex = canvasTex(256, 256, (g, w, h) => {
  const r = mulberry(11); g.fillStyle = '#4b4741'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) { const l = 40 + r() * 90; g.fillStyle = `rgb(${l + 6 | 0},${l + 2 | 0},${l - 4 | 0})`; const x = r() * w, y = r() * h, s = 0.8 + r() * 2.6; g.beginPath(); g.ellipse(x, y, s, s * (0.6 + r() * 0.4), r() * 3, 0, 7); g.fill(); }
  for (let i = 0; i < 90; i++) { g.strokeStyle = `rgba(60,90,40,${0.4 + r() * 0.4})`; g.lineWidth = 1; const x = r() * w, y = r() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 4, y - 3 - r() * 5); g.stroke(); }
}, true);
function radialTex(stops) { return canvasTex(128, 128, (g, w, h) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); for (const [o, c] of stops) gr.addColorStop(o, c); g.fillStyle = gr; g.fillRect(0, 0, w, h); }); }
const glowTex = radialTex([[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,.55)'], [1, 'rgba(255,255,255,0)']]);

// sky: dark dome, stars, moon (none of it fogged)
{
  const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 24, 12), new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false, vertexColors: true, depthWrite: false }));
  const pos = sky.geometry.attributes.position; const col = [];
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i) / 500; const t = clamp(y, 0, 1); col.push(0.08 * (1 - t) + 0.01 * t, 0.10 * (1 - t) + 0.015 * t, 0.14 * (1 - t) + 0.03 * t); }
  sky.geometry.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); sky.renderOrder = -10; sky.frustumCulled = false; scene.add(sky);
  sky.userData.follow = true; scene.userData.sky = sky;
  const sp = []; const r = mulberry(3); for (let i = 0; i < 700; i++) { const th = r() * Math.PI * 2, ph = Math.acos(0.15 + r() * 0.85); sp.push(Math.cos(th) * Math.sin(ph) * 450, Math.cos(ph) * 450, Math.sin(th) * Math.sin(ph) * 450); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xc8d4ff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8, depthWrite: false }));
  stars.frustumCulled = false; scene.add(stars); scene.userData.stars = stars;
  const moonS = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex([[0, 'rgba(240,244,255,1)'], [0.18, 'rgba(225,232,255,1)'], [0.22, 'rgba(160,180,230,.35)'], [1, 'rgba(120,140,200,0)']]), fog: false, depthWrite: false, transparent: true }));
  moonS.scale.set(110, 110, 1); scene.add(moonS); scene.userData.moon = moonS;
}

// ground
const ground = new THREE.Mesh(new THREE.PlaneGeometry(W + 120, W + 120), new THREE.MeshLambertMaterial({ map: gravelTex, color: 0x9a948a }));
ground.rotation.x = -Math.PI / 2; ground.position.set(W / 2, 0, W / 2);
gravelTex.repeat.set((W + 120) / 3.2, (W + 120) / 3.2); scene.add(ground);

// ================================================================ HEDGE GEOMETRY (merged per chunk)
const CH = 10; // grid blocks per chunk side
const chunks = [];
const hedgeMat = new THREE.MeshLambertMaterial({ map: leafTex, vertexColors: true });
const clumpGeo = new THREE.IcosahedronGeometry(1, 0);
const clumpMat = new THREE.MeshLambertMaterial({ map: leafTex, color: 0xffffff });
const tmpC = new THREE.Color();

function buildHedges() {
  const bins = new Map();
  const bin = (x, z) => { const k = Math.floor(toG(x) / CH) * 100 + Math.floor(toG(z) / CH); let b = bins.get(k); if (!b) { b = { pos: [], uv: [], col: [], idx: [], clumps: [], cx: 0, cz: 0, n: 0 }; bins.set(k, b); } b.cx += x; b.cz += z; b.n++; return b; };
  // face: origin o, axis u (len lu, dir du), axis v (len lv, dir dv), normal n. taper flags [u0,u1,v0,v1]
  function face(b, o, du, lu, dv, lv, n, tap, dispAmp) {
    const nu = Math.max(1, Math.ceil(lu / 0.9)), nv = Math.max(1, Math.ceil(lv / 0.9));
    const base = b.pos.length / 3;
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const a = (i / nu) * lu, c = (j / nv) * lv;
      let x = o[0] + du[0] * a + dv[0] * c, y = o[1] + du[1] * a + dv[1] * c, z = o[2] + du[2] * a + dv[2] * c;
      let tp = 1;
      if (tap[0]) tp = Math.min(tp, smooth(0, 0.8, a)); if (tap[1]) tp = Math.min(tp, smooth(0, 0.8, lu - a));
      if (tap[2]) tp = Math.min(tp, smooth(0, 0.8, c)); if (tap[3]) tp = Math.min(tp, smooth(0, 0.8, lv - c));
      const nz = fbm(x * 0.55, y * 0.55, z * 0.55), nz2 = noise3(x * 2.3, y * 2.3, z * 2.3);
      const d = (0.06 + 0.4 * nz + 0.16 * nz2) * tp * dispAmp;
      x += n[0] * d; y += n[1] * d; z += n[2] * d;
      b.pos.push(x, y, z);
      // uv: world-scaled along the face
      b.uv.push(a / 1.7 + (o[0] + o[2]) * 0.13, c / 1.7 + o[1] * 0.2);
      // colour: dark green, dead patches, darker low down
      const dead = smooth(0.62, 0.78, noise3(x * 0.09 + 3, y * 0.12, z * 0.09 - 7));
      const ao = 0.38 + 0.62 * Math.pow(clamp(y / H, 0, 1), 0.6);
      const v = (0.75 + nz2 * 0.5) * ao * (0.7 + tp * 0.3);
      const gR = 0.08 + nz * 0.04, gG = 0.21 + nz * 0.09, gB = 0.07;
      const r = gR * (1 - dead) + 0.24 * dead, g = gG * (1 - dead) + 0.16 * dead, bb = gB * (1 - dead) + 0.06 * dead;
      b.col.push(r * v, g * v, bb * v);
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const a = base + j * (nu + 1) + i, bq = a + 1, c = a + nu + 1, d = c + 1;
      b.idx.push(a, bq, d, a, d, c);
    }
  }
  const flush = (gx, gz, ax, az, nx, nz) => isHedge(gx + ax, gz + az) && !isHedge(gx + ax + nx, gz + az + nz);
  function box(gx, gz, x0, x1, z0, z1, y0, y1, isCanopy) {
    const b = bin((x0 + x1) / 2, (z0 + z1) / 2); const dx = x1 - x0, dz = z1 - z0, h = y1 - y0;
    const has = (ax, az) => isCanopy ? false : isHedge(gx + ax, gz + az);
    // +x
    if (isCanopy ? open(toCell(x0 + 1), toCell(z0 + 1), 1, 0) : !has(1, 0))
      face(b, [x1, y0, z1], [0, 0, -1], dz, [0, 1, 0], h, [1, 0, 0], isCanopy ? [1, 1, 1, 1] : [!flush(gx, gz, 0, 1, 1, 0), !flush(gx, gz, 0, -1, 1, 0), 0, 1], 1);
    if (isCanopy ? open(toCell(x0 + 1), toCell(z0 + 1), -1, 0) : !has(-1, 0))
      face(b, [x0, y0, z0], [0, 0, 1], dz, [0, 1, 0], h, [-1, 0, 0], isCanopy ? [1, 1, 1, 1] : [!flush(gx, gz, 0, -1, -1, 0), !flush(gx, gz, 0, 1, -1, 0), 0, 1], 1);
    if (isCanopy ? open(toCell(x0 + 1), toCell(z0 + 1), 0, 1) : !has(0, 1))
      face(b, [x0, y0, z1], [1, 0, 0], dx, [0, 1, 0], h, [0, 0, 1], isCanopy ? [1, 1, 1, 1] : [!flush(gx, gz, -1, 0, 0, 1), !flush(gx, gz, 1, 0, 0, 1), 0, 1], 1);
    if (isCanopy ? open(toCell(x0 + 1), toCell(z0 + 1), 0, -1) : !has(0, -1))
      face(b, [x1, y0, z0], [-1, 0, 0], dx, [0, 1, 0], h, [0, 0, -1], isCanopy ? [1, 1, 1, 1] : [!flush(gx, gz, 1, 0, 0, -1), !flush(gx, gz, -1, 0, 0, -1), 0, 1], 1);
    // top: taper an edge only where a side face exists there
    face(b, [x0, y1, z1], [1, 0, 0], dx, [0, 0, -1], dz, [0, 1, 0], isCanopy ? [1, 1, 1, 1] : [!has(-1, 0), !has(1, 0), !has(0, 1), !has(0, -1)], 0.8);
    if (isCanopy) face(b, [x0, y0, z0], [1, 0, 0], dx, [0, 0, 1], dz, [0, -1, 0], [1, 1, 1, 1], 0.45);
    // leafy clumps on top break the straight silhouette, more poke out of the sides
    if (!isCanopy) {
      const sides = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (let si = 0; si < 4; si++) {
        const [ax, az] = sides[si]; if (has(ax, az)) continue;
        const flen = ax ? dz : dx; const k2 = Math.max(1, Math.round(flen / 2.2));
        for (let i = 0; i < k2; i++) {
          const ha = hash3(gx * 7 + si, gz, i + 40), hy = hash3(gx, gz * 7 + si, i + 50), hs = hash3(gx + si, gz, i + 60);
          const along = 0.2 + ha * 0.6; const y = 0.6 + hy * (H - 1.2);
          const px = ax ? (ax > 0 ? x1 + 0.05 : x0 - 0.05) : x0 + dx * along, pz = az ? (az > 0 ? z1 + 0.05 : z0 - 0.05) : z0 + dz * along;
          b.clumps.push(px, y, pz, 0.35 + hs * 0.4, hs * 0.85);
        }
      }
      const len = Math.max(dx, dz); const k = Math.max(1, Math.round(len / 1.9));
      for (let i = 0; i < k; i++) {
        const hx = hash3(gx, gz, i * 3 + 1), hz = hash3(gx, gz, i * 3 + 2), hs = hash3(gx, gz, i * 3 + 3);
        b.clumps.push(x0 + dx * (0.15 + hx * 0.7), y1 + 0.15 + hs * 0.25, z0 + dz * (0.15 + hz * 0.7), 0.55 + hs * 0.55, hs);
      }
    }
  }
  for (let gz = 0; gz < G; gz++) for (let gx = 0; gx < G; gx++) {
    if (grid[gi(gx, gz)] !== 1) continue;
    box(gx, gz, gStart(gx), gStart(gx) + gSize(gx), gStart(gz), gStart(gz) + gSize(gz), 0, H, false);
  }
  for (const k of canopy) { const x = k % N, y = (k / N) | 0; const x0 = x * P + T, z0 = y * P + T; box(2 * x + 1, 2 * y + 1, x0, x0 + C, z0, z0 + C, 3.7, H, true); }

  const dummy = new THREE.Object3D();
  for (const b of bins.values()) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
    geo.setIndex(b.idx); geo.computeVertexNormals(); geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, hedgeMat); scene.add(mesh);
    const cnt = b.clumps.length / 5; let inst = null;
    if (cnt) {
      inst = new THREE.InstancedMesh(clumpGeo, clumpMat, cnt);
      for (let i = 0; i < cnt; i++) {
        const [x, y, z, s, h] = b.clumps.slice(i * 5, i * 5 + 5);
        dummy.position.set(x, y, z); dummy.rotation.set(h * 3, h * 7, h * 5); dummy.scale.set(s * 1.1, s * 0.7, s); dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
        const dead = h > 0.86; tmpC.setRGB(dead ? 0.2 : 0.05 + h * 0.03, dead ? 0.13 : 0.13 + h * 0.06, dead ? 0.05 : 0.045);
        inst.setColorAt(i, tmpC);
      }
      inst.computeBoundingSphere(); scene.add(inst);
    }
    chunks.push({ mesh, inst, x: b.cx / b.n, z: b.cz / b.n });
  }
}

// hidden gap: a thin see-through leaf curtain where a hedge used to be
const curtainTex = canvasTex(128, 256, (g, w, h) => {
  const r = mulberry(21); g.clearRect(0, 0, w, h);
  for (let i = 0; i < 520; i++) { const l = 50 + r() * 90; g.fillStyle = `rgba(${l * 0.55 | 0},${l | 0},${l * 0.45 | 0},${0.7 + r() * 0.3})`; const x = r() * w, y = r() * h; g.beginPath(); g.ellipse(x, y, 4 + r() * 6, 2 + r() * 2, r() * 3, 0, 7); g.fill(); }
});
function buildCurtain(gx, gz) {
  const x0 = gStart(gx), z0 = gStart(gz), sx = gSize(gx), sz = gSize(gz);
  const grp = new THREE.Group(); const mat = new THREE.MeshLambertMaterial({ map: curtainTex, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, color: 0x6c8a5c });
  const alongX = sx > sz; // wall runs along x (between z-neighbours)
  for (let k = 0; k < 4; k++) {
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(alongX ? sx : sz, H), mat);
    const off = -T / 2 + T * (k + 0.5) / 4;
    if (alongX) { pl.position.set(x0 + sx / 2, H / 2, z0 + sz / 2 + off); }
    else { pl.rotation.y = Math.PI / 2; pl.position.set(x0 + sx / 2 + off, H / 2, z0 + sz / 2); }
    grp.add(pl);
  }
  scene.add(grp);
}

// ================================================================ PROPS
const lanterns = [];
const lanternMat = new THREE.MeshBasicMaterial({ color: 0xffa040 });
const postMat = new THREE.MeshLambertMaterial({ color: 0x2a2018 });
function addLantern(cx, cy, k) {
  const sx = (hash3(cx, cy, 5) < 0.5 ? -1 : 1), sz = (hash3(cx, cy, 6) < 0.5 ? -1 : 1);
  const x = cc(cx) + sx * (C / 2 - 0.7), z = cc(cy) + sz * (C / 2 - 0.7);
  const grp = new THREE.Group(); grp.position.set(x, 0, z);
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.3, 0.12), postMat); post.position.y = 1.15; grp.add(post);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.42, 0.3), lanternMat.clone()); head.position.y = 2.45; grp.add(head);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.25, 4), postMat); cap.position.y = 2.78; cap.rotation.y = Math.PI / 4; grp.add(cap);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff9a3a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.85 }));
  glow.scale.set(2.6, 2.6, 1); glow.position.y = 2.45; grp.add(glow);
  scene.add(grp);
  lanterns.push({ x, z, cx, cy, head, glow, lit: k === 0, seed: hash3(cx, cy, 9) * 10, idx: lanterns.length });
}
const pumpkinTex = canvasTex(256, 128, (g, w, h) => {
  g.fillStyle = '#b8560f'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 12; i++) { g.fillStyle = i % 2 ? 'rgba(0,0,0,.12)' : 'rgba(255,200,120,.08)'; g.fillRect(i * w / 12, 0, w / 24, h); }
});
const pumpkinFace = canvasTex(256, 128, (g, w, h) => {
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffb030'; const cx = w * 0.25, cy = h * 0.5;
  const tri = (x, y, s) => { g.beginPath(); g.moveTo(x - s, y + s * 0.6); g.lineTo(x + s, y + s * 0.6); g.lineTo(x, y - s * 0.7); g.fill(); };
  tri(cx - 14, cy - 12, 8); tri(cx + 14, cy - 12, 8);
  g.beginPath(); g.moveTo(cx - 22, cy + 6); g.quadraticCurveTo(cx, cy + 26, cx + 22, cy + 6); g.lineTo(cx + 14, cy + 10); g.lineTo(cx + 8, cy + 6); g.lineTo(cx, cy + 12); g.lineTo(cx - 8, cy + 6); g.lineTo(cx - 14, cy + 10); g.closePath(); g.fill();
});
function addPumpkin(x, z, faceYaw, s = 1) {
  const grp = new THREE.Group(); grp.position.set(x, 0, z); grp.rotation.y = faceYaw;
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.42 * s, 20, 12), new THREE.MeshLambertMaterial({ map: pumpkinTex, emissiveMap: pumpkinFace, emissive: 0xffffff, emissiveIntensity: 1 }));
  body.scale.y = 0.78; body.position.y = 0.33 * s; grp.add(body);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * s, 0.06 * s, 0.16 * s, 6), postMat); stem.position.y = 0.68 * s; grp.add(stem);
  const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff8a20, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.5 }));
  gl.scale.set(1.6 * s, 1.6 * s, 1); gl.position.y = 0.35 * s; grp.add(gl);
  scene.add(grp); return grp;
}
const portalTex = canvasTex(64, 256, (g, w, h) => { const gr = g.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, 'rgba(190,255,210,.95)'); gr.addColorStop(0.6, 'rgba(120,255,170,.45)'); gr.addColorStop(1, 'rgba(80,255,150,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
const stoneMat = new THREE.MeshLambertMaterial({ color: 0x77736c });
function makeGate() {
  const grp = new THREE.Group();
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.7, 4.4, 0.7), stoneMat); p.position.set(s * 2.05, 2.2, 0); grp.add(p); const ball = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), stoneMat); ball.position.set(s * 2.05, 4.7, 0); grp.add(ball); }
  const arch = new THREE.Mesh(new THREE.TorusGeometry(2.05, 0.22, 8, 20, Math.PI), stoneMat); arch.position.y = 4.1; grp.add(arch);
  const portalMat = new THREE.MeshBasicMaterial({ map: portalTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const portal = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 5.6), portalMat); portal.position.y = 2.8; grp.add(portal);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x8cffb4, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8, fog: false }));
  glow.scale.set(9, 9, 1); glow.position.y = 2.6; grp.add(glow);
  scene.add(grp); return { grp, portal, glow };
}
function makeSign(x, z, yaw, text) {
  const tex = canvasTex(512, 300, (g, w, h) => {
    g.fillStyle = '#9a6a3a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(30,15,5,${0.15 + Math.random() * 0.2})`; g.lineWidth = 1 + Math.random() * 2; g.beginPath(); const y = Math.random() * h; g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + 6, w * 0.6, y - 6, w, y + 3); g.stroke(); }
    g.strokeStyle = '#2a1608'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
    g.fillStyle = '#1a0c04'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const lines = String(text).split('\n'); const fs = lines.length > 3 ? 40 : 46; g.font = `700 ${fs}px "Atkinson Hyperlegible", sans-serif`;
    lines.forEach((l, i) => g.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * fs * 1.2, w - 40));
  });
  const grp = new THREE.Group(); grp.position.set(x, 0, z); grp.rotation.y = yaw;
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.1, 0.07), [postMat, postMat, postMat, postMat, new THREE.MeshLambertMaterial({ map: tex, emissive: 0x140a04 }), postMat]);
  board.position.y = 1.75; board.rotation.z = (Math.random() - 0.5) * 0.12; grp.add(board);
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.5, 0.12), postMat); post.position.y = 0.75; grp.add(post);
  scene.add(grp); return grp;
}

// ================================================================ THE EYE
const eye = { grp: new THREE.Group(), target: new THREE.Vector3(W / 2, 0, W / 2), way: new THREE.Vector3(W / 2, 0, W / 2), state: 'scan', t: 0, cool: 6, blink: 0, pupil: null, light: null, cone: null, disk: null, glow: null };
function buildEye() {
  const R = 15;
  const veins = canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#e8dcc4'; g.fillRect(0, 0, w, h); const r = mulberry(5);
    for (let i = 0; i < 70; i++) { g.strokeStyle = `rgba(${150 + r() * 60 | 0},20,20,${0.3 + r() * 0.5})`; g.lineWidth = 0.6 + r() * 2.2; let x = r() * w, y = r() < 0.5 ? 0 : h; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 7; k++) { x += (r() - 0.5) * 50; y += (y < h / 2 ? 1 : -1) * (8 + r() * 14); g.lineTo(x, y); } g.stroke(); }
  });
  const sclera = new THREE.Mesh(new THREE.SphereGeometry(R, 40, 24), new THREE.MeshBasicMaterial({ map: veins, fog: false }));
  eye.grp.add(sclera);
  const irisGeo = new THREE.SphereGeometry(R * 1.006, 48, 20, 0, Math.PI * 2, 0, 0.62);
  const ip = irisGeo.attributes.position; const ic = [];
  for (let i = 0; i < ip.count; i++) { const a = Math.acos(clamp(ip.getY(i) / (R * 1.006), -1, 1)) / 0.62; const ring = 0.5 + 0.5 * Math.sin(Math.atan2(ip.getZ(i), ip.getX(i)) * 23) * 0.3; const k = a > 0.9 ? 0.25 : 1; ic.push((0.9 - a * 0.3) * k * (0.8 + ring * 0.2), (0.2 + a * 0.35) * k * ring, 0.03 * k); }
  irisGeo.setAttribute('color', new THREE.Float32BufferAttribute(ic, 3));
  const iris = new THREE.Mesh(irisGeo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false })); iris.rotation.x = Math.PI / 2; eye.grp.add(iris);
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(R * 1.03, 32, 8, 0, Math.PI * 2, 0, 0.26), new THREE.MeshBasicMaterial({ color: 0x050000, fog: false }));
  pupil.rotation.x = Math.PI / 2; pupil.scale.set(0.45, 1, 1); eye.grp.add(pupil); eye.pupil = pupil;
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffd9a0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.35, fog: false }));
  glow.scale.set(60, 60, 1); eye.glowSprite = glow; scene.add(glow);
  eye.grp.position.set(W / 2, EYE_H, W / 2); scene.add(eye.grp);
  // the searchlight
  const light = new THREE.SpotLight(0xfff0c8, 9, 0, 0.1, 0.45, 0); light.position.copy(eye.grp.position); scene.add(light); scene.add(light.target); eye.light = light;
  const coneGeo = new THREE.CylinderGeometry(0.06, 1, 1, 28, 1, true); coneGeo.translate(0, -0.5, 0);
  const cone = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 0.075, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  cone.position.copy(eye.grp.position); scene.add(cone); eye.cone = cone;
  const disk = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ map: radialTex([[0, 'rgba(255,245,215,.55)'], [0.7, 'rgba(255,240,200,.3)'], [1, 'rgba(255,240,200,0)']]), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  disk.rotation.x = -Math.PI / 2; disk.position.y = 0.04; scene.add(disk); eye.disk = disk;
}

// ================================================================ SHADOW CREATURES
const creatures = [];
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
const eyeGlowMat = new THREE.SpriteMaterial({ map: glowTex, color: 0xffc23a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
function makeCreature(kind) {
  const grp = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), shadowMat); body.scale.set(1, 0.85, 1.25); grp.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), shadowMat); head.position.set(0, 0.18, 0.42); grp.add(head);
  const tendrils = [];
  const nT = kind === 'squid' ? 8 : 6;
  for (let i = 0; i < nT; i++) {
    const piv = new THREE.Group(); const a = (i / nT) * Math.PI * 2;
    piv.position.set(Math.cos(a) * 0.3, -0.15, Math.sin(a) * 0.3 - 0.1);
    const len = kind === 'squid' ? 1.1 : 0.85;
    const tg = new THREE.ConeGeometry(0.07, len, 5); tg.translate(0, -len / 2, 0);
    const t = new THREE.Mesh(tg, shadowMat); piv.add(t); piv.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9);
    grp.add(piv); tendrils.push({ piv, a, base: piv.rotation.clone() });
  }
  const wings = [];
  if (kind === 'bat') {
    for (const s of [-1, 1]) {
      const shp = new THREE.Shape(); shp.moveTo(0, 0); shp.lineTo(s * 1.0, 0.35); shp.lineTo(s * 0.85, 0.05); shp.lineTo(s * 0.65, 0.2); shp.lineTo(s * 0.5, -0.05); shp.lineTo(s * 0.3, 0.1); shp.lineTo(0, -0.1);
      const wm = new THREE.Mesh(new THREE.ShapeGeometry(shp), new THREE.MeshBasicMaterial({ color: 0, side: THREE.DoubleSide }));
      const piv = new THREE.Group(); piv.position.set(s * 0.25, 0.15, 0); piv.add(wm); wm.rotation.x = -Math.PI / 2; grp.add(piv); wings.push({ piv, s });
    }
  }
  for (const s of [-1, 1]) { const e = new THREE.Sprite(eyeGlowMat); e.scale.set(0.26, 0.26, 1); e.position.set(s * 0.15, 0.24, 0.72); grp.add(e); const e2 = new THREE.Sprite(eyeGlowMat); e2.scale.set(0.09, 0.09, 1); e2.position.set(s * (kind === 'spider' ? 0.07 : 0.24), 0.36, 0.7); grp.add(e2); }
  scene.add(grp);
  return { grp, tendrils, wings, kind };
}

// ================================================================ AUDIO (all made in code)
const Snd = {
  ctx: null, master: null, noise: null, beatT: 0, ok: false,
  init() {
    if (this.ctx) { if (this.ctx.state !== 'running') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = this.ctx = new AC(); this.master = ctx.createGain(); this.master.gain.value = prefs.muted ? 0 : 1; this.master.connect(ctx.destination);
    const len = ctx.sampleRate * 2; const buf = ctx.createBuffer(1, len, ctx.sampleRate); const d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; this.noise = buf;
    // wind
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 0.7;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07; const lg = ctx.createGain(); lg.gain.value = 260; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
    const wg = ctx.createGain(); wg.gain.value = 0.2; src.connect(lp); lp.connect(wg); wg.connect(this.master); src.start();
    const gust = ctx.createBiquadFilter(); gust.type = 'bandpass'; gust.frequency.value = 1100; gust.Q.value = 0.8;
    const gg = ctx.createGain(); gg.gain.value = 0.02; const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.13; const lg2 = ctx.createGain(); lg2.gain.value = 0.03; lfo2.connect(lg2); lg2.connect(gg.gain); lfo2.start();
    src.connect(gust); gust.connect(gg); gg.connect(this.master);
    // low drone
    for (const f of [49, 73.4]) { const o = ctx.createOscillator(); o.frequency.value = f; const og = ctx.createGain(); og.gain.value = 0.028; o.connect(og); og.connect(this.master); o.start(); }
    this.hunt = ctx.createGain(); this.hunt.gain.value = 0; this.hunt.connect(this.master);
    const ho = ctx.createOscillator(); ho.type = 'sawtooth'; ho.frequency.value = 61; const hf = ctx.createBiquadFilter(); hf.type = 'lowpass'; hf.frequency.value = 240; ho.connect(hf); hf.connect(this.hunt); ho.start();
    this.ok = true;
  },
  setMuted(m) { prefs.muted = m; writePrefs(); if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.05); },
  burst(dur, type, freq, q, gain, dest, when, rate) {
    if (!this.ok) return; const ctx = this.ctx; const t = when || ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = rate || 1;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.02, dur * 0.3)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || this.master); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  },
  step() { this.burst(0.08, 'highpass', 1400 + Math.random() * 600, 0.7, 0.07); this.burst(0.06, 'bandpass', 380, 1.2, 0.05); },
  rustle() { this.burst(0.3 + Math.random() * 0.3, 'bandpass', 2400 + Math.random() * 1600, 0.9, 0.035); },
  thump(t, v) { if (!this.ok) return; const ctx = this.ctx; const o = ctx.createOscillator(); o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.14); const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.2); },
  heartbeat(v) { if (!this.ok) return; const t = this.ctx.currentTime; this.thump(t, 0.5 * v); this.thump(t + 0.19, 0.32 * v); },
  sting(soft) {
    if (!this.ok) return; const ctx = this.ctx; const t = ctx.currentTime; const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(soft ? 0.12 : 0.22, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(3500, t); f.frequency.exponentialRampToValueAtTime(500, t + 1.6); f.connect(g); g.connect(this.master);
    for (const [fr, det] of [[220, -30], [233, 20], [311, 0], [466, 15]]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(fr, t); o.frequency.exponentialRampToValueAtTime(fr * 0.94, t + 1.6); o.detune.value = det; o.connect(f); o.start(t); o.stop(t + 1.9); }
    if (!soft) { this.thump(t, 0.9); this.burst(1.2, 'lowpass', 300, 0.6, 0.25); }
  },
  boom() { if (!this.ok) return; const t = this.ctx.currentTime; this.thump(t, 1); this.burst(1.6, 'lowpass', 220, 0.5, 0.4); this.burst(0.6, 'highpass', 3000, 0.5, 0.1); },
  panner(x, y, z) { const p = this.ctx.createPanner(); p.panningModel = 'equalpower'; p.distanceModel = 'inverse'; p.refDistance = 2.5; p.rolloffFactor = 1.3; p.maxDistance = 60; this.setPos(p, x, y, z); p.connect(this.master); return p; },
  setPos(p, x, y, z) { if (p.positionX) { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; } else p.setPosition(x, y, z); },
  whisper(x, z) {
    if (!this.ok) return; const ctx = this.ctx; const t = ctx.currentTime; const p = this.panner(x, 1.6, z);
    for (let k = 0; k < 9; k++) { const tt = t + k * 0.22 + Math.random() * 0.06; this.burst(0.18, 'bandpass', 1400 + Math.random() * 1800, 4, 0.18, p, tt, 0.8); this.burst(0.14, 'bandpass', 600 + Math.random() * 300, 6, 0.08, p, tt); }
  },
  click(p) { this.burst(0.03, 'highpass', 2800 + Math.random() * 3000, 1, 0.3, p); },
  laugh() {
    if (!this.ok) return; const ctx = this.ctx; const t = ctx.currentTime;
    for (let k = 0; k < 5; k++) { const tt = t + k * 0.2; const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(300 - k * 22, tt); const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 3; const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(0.12, tt + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.16); o.connect(f); f.connect(g); g.connect(this.master); o.start(tt); o.stop(tt + 0.18); }
  },
  chime() { if (!this.ok) return; const ctx = this.ctx; const t = ctx.currentTime; for (const [fr, d] of [[523, 0], [659, 0.12], [784, 0.24]]) { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = fr; const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(0.09, t + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.9); o.connect(g); g.connect(this.master); o.start(t + d); o.stop(t + d + 1); } },
  listener(x, y, z, fx, fz) {
    if (!this.ok) return; const l = this.ctx.listener;
    if (l.positionX) { l.positionX.value = x; l.positionY.value = y; l.positionZ.value = z; l.forwardX.value = fx; l.forwardY.value = 0; l.forwardZ.value = fz; l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0; }
    else { l.setPosition(x, y, z); l.setOrientation(fx, 0, fz, 0, 1, 0); }
  },
};

// ================================================================ GAME STATE
const player = { x: cc(0), z: cc(0), yaw: 0, pitch: 0.08, vx: 0, vz: 0, bob: 0 };
const game = { started: false, over: false, t: 0, walked: 0, caught: 0, cp: 0, hunt: false, huntLost: 0, reverse: 0, dark: 0, darkLine: null, loopFog: 0, frozen: 0, lastCell: -1 };
const distP = new Int32Array(N * N); const distStart = new Int32Array(N * N);
let traps = []; let exitGate = null;

function toast(text, kind = 'info', by = '', urgent = false) {
  if (!text) return;
  if (urgent) { toastQ.length = 0; toastQ.push({ text, kind, by }); toastGen++; nextToast(); return; }
  toastQ.push({ text, kind, by }); if (!toastBusy) nextToast();
}
const toastQ = []; let toastBusy = false, toastGen = 0;
function nextToast() {
  const gen = toastGen;
  const el = $('toast'); const m = toastQ.shift(); if (!m) { toastBusy = false; el.classList.remove('show'); return; }
  toastBusy = true; el.className = 'toast ' + m.kind; el.innerHTML = ''; el.textContent = m.text;
  if (m.by) { const s = document.createElement('span'); s.className = 'by'; s.textContent = 'trap by ' + m.by; el.appendChild(s); }
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { if (gen !== toastGen) return; el.classList.remove('show'); setTimeout(() => { if (gen === toastGen) nextToast(); }, 380); }, 2600 + m.text.length * 35);
}

// ---------------------------------------------------------------- traps: resolve + place
function resolveTraps(defs) {
  const used = new Set([0]); if (loopChain) for (const [x, y] of loopChain.cells) used.add(y * N + x);
  const maxD = Math.max(...distStart);
  const deadEnds = []; const cells = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const k = y * N + x; if (openings(x, y) === 1) deadEnds.push(k); cells.push(k); }
  const out = [];
  for (const def of defs) {
    if (!def || !def.type) continue;
    const r = mulberry(strHash(def.id || def.type));
    let cell = null;
    if (def.type === 'loop') { if (loopChain && loopChain.trap === def) out.push({ def, cell: loopChain.cells[0], st: { loops: 0, entry: null, released: false } }); continue; }
    if (Array.isArray(def.cell)) cell = [clamp(def.cell[0] | 0, 0, N - 1), clamp(def.cell[1] | 0, 0, N - 1)];
    else {
      const pool = (def.type === 'fake_exit' ? deadEnds : cells).filter((k) => !used.has(k) && distStart[k] > maxD * 0.18 && distStart[k] < maxD * 0.9 && !canopy.has(k));
      if (!pool.length) continue; const k = pool[Math.floor(r() * pool.length)]; cell = [k % N, (k / N) | 0];
    }
    used.add(cell[1] * N + cell[0]);
    out.push({ def, cell, st: {} });
  }
  return out;
}
function wallSideOf(x, y, r) { // a direction from cell (x,y) that is a hedge (for leaning signs / gates against)
  const ds = DIRS.filter(([dx, dy]) => !open(x, y, dx, dy)); if (!ds.length) return null; return ds[Math.floor(r() * ds.length)];
}
function placeTrapProps() {
  for (const tr of traps) {
    const d = tr.def; const [x, y] = tr.cell; const r = mulberry(strHash((d.id || '') + 'p'));
    tr.wx = cc(x); tr.wz = cc(y);
    if (d.type === 'sign') {
      const s = wallSideOf(x, y, r) || [0, -1]; const sx = cc(x) + s[0] * (C / 2 - 0.8), sz = cc(y) + s[1] * (C / 2 - 0.8);
      makeSign(sx, sz, Math.atan2(-s[0], -s[1]), (d.params && d.params.text) || (d.lines && d.lines[0]) || '...'); tr.wx = sx; tr.wz = sz;
    } else if (d.type === 'fake_exit') {
      let s = null; for (const [dx, dy] of DIRS) if (open(x, y, dx, dy)) s = [-dx, -dy]; s = s || [1, 0];
      const g = makeGate(); g.grp.position.set(cc(x) + s[0] * (C / 2 - 0.75), 0, cc(y) + s[1] * (C / 2 - 0.75)); g.grp.rotation.y = Math.atan2(-s[0], -s[1]); tr.gate = g; tr.wx = g.grp.position.x; tr.wz = g.grp.position.z;
    } else if (d.type === 'shortcut') {
      // open a hedge between this cell and a neighbour that is far away along the paths
      let best = null, bestGain = 0; const tmp = new Int32Array(N * N); bfs(x, y, tmp);
      for (const [dx, dy] of DIRS) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= N || ny >= N || open(x, y, dx, dy)) continue; const gwi = gi(2 * x + 1 + dx, 2 * y + 1 + dy); if (protectedWall[gwi]) continue; const gain = tmp[ny * N + nx]; if (gain > bestGain) { bestGain = gain; best = [dx, dy]; } }
      if (best) { const gx = 2 * x + 1 + best[0], gz = 2 * y + 1 + best[1]; grid[gi(gx, gz)] = 2; tr.gap = [gx, gz]; tr.wx = gStart(gx) + gSize(gx) / 2; tr.wz = gStart(gz) + gSize(gz) / 2; }
    }
  }
}

// ---------------------------------------------------------------- input
const keys = {}; const joy = { id: null, ox: 0, oy: 0, x: 0, y: 0 }; const look = { id: null, lx: 0, ly: 0 };
addEventListener('keydown', (e) => { keys[e.code] = true; if (e.code === 'KeyM') toggleMute(); });
addEventListener('keyup', (e) => { keys[e.code] = false; });
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
canvas.addEventListener('pointerdown', (e) => {
  Snd.init();
  if (!game.started) return;
  if (e.pointerType === 'mouse') { if (!document.pointerLockElement && canvas.requestPointerLock) { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (er) {} } look.id = e.pointerId; look.lx = e.clientX; look.ly = e.clientY; return; }
  if (e.clientX < innerWidth * 0.45 && joy.id === null) { joy.id = e.pointerId; joy.ox = e.clientX; joy.oy = e.clientY; joy.x = joy.y = 0; const j = $('joy'); j.hidden = false; j.style.left = e.clientX + 'px'; j.style.top = e.clientY + 'px'; $('knob').style.transform = ''; $('hint').style.opacity = 0; }
  else if (look.id === null) { look.id = e.pointerId; look.lx = e.clientX; look.ly = e.clientY; }
  try { canvas.setPointerCapture(e.pointerId); } catch (er) {}
});
canvas.addEventListener('pointermove', (e) => {
  if (document.pointerLockElement === canvas && e.pointerType === 'mouse') { player.yaw -= e.movementX * 0.0025; player.pitch = clamp(player.pitch - e.movementY * 0.0022, -1.2, 1.35); return; }
  if (e.pointerId === joy.id) { let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy; const m = Math.hypot(dx, dy), R = 52; if (m > R) { dx *= R / m; dy *= R / m; } joy.x = dx / R; joy.y = dy / R; $('knob').style.transform = `translate(${dx}px,${dy}px)`; }
  else if (e.pointerId === look.id) { const dx = e.clientX - look.lx, dy = e.clientY - look.ly; look.lx = e.clientX; look.ly = e.clientY; const k = e.pointerType === 'mouse' ? 0.004 : 0.0062; player.yaw -= dx * k; player.pitch = clamp(player.pitch - dy * k * 0.8, -1.2, 1.35); }
});
function endPtr(e) { if (e.pointerId === joy.id) { joy.id = null; joy.x = joy.y = 0; $('joy').hidden = true; } if (e.pointerId === look.id) look.id = null; }
canvas.addEventListener('pointerup', endPtr); canvas.addEventListener('pointercancel', endPtr);
function toggleMute() { const m = !prefs.muted; Snd.setMuted(m); $('btnSound').classList.toggle('off', m); $('btnSound').setAttribute('aria-label', m ? 'Sound off' : 'Sound on'); }
$('btnSound').addEventListener('click', () => { Snd.init(); toggleMute(); });
$('btnSound').classList.toggle('off', prefs.muted);

// ---------------------------------------------------------------- movement / collision
function collide(px, pz, r) {
  for (let it = 0; it < 2; it++) {
    const g0 = toG(px - r), g1 = toG(px + r), h0 = toG(pz - r), h1 = toG(pz + r);
    for (let gz = h0; gz <= h1; gz++) for (let gx = g0; gx <= g1; gx++) {
      if (!solid(gx, gz)) continue;
      const x0 = gStart(gx), x1 = x0 + gSize(gx), z0 = gStart(gz), z1 = z0 + gSize(gz);
      const qx = clamp(px, x0, x1), qz = clamp(pz, z0, z1); let dx = px - qx, dz = pz - qz; const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 1e-8) { const d = Math.sqrt(d2); px = qx + dx / d * r; pz = qz + dz / d * r; }
        else { const l = px - x0, rr = x1 - px, t = pz - z0, b = z1 - pz; const m = Math.min(l, rr, t, b); if (m === l) px = x0 - r; else if (m === rr) px = x1 + r; else if (m === t) pz = z0 - r; else pz = z1 + r; }
      }
    }
  }
  return [px, pz];
}
function lineOfSight(ax, az, bx, bz) { // ray-march on the grid, hedges block
  const d = Math.hypot(bx - ax, bz - az); if (d > 40) return false; const n = Math.ceil(d / 0.5);
  for (let i = 1; i < n; i++) { const x = ax + (bx - ax) * i / n, z = az + (bz - az) * i / n; if (solid(toG(x), toG(z))) return false; }
  return true;
}

// ---------------------------------------------------------------- the hunt
function spotted(decoy) {
  if (decoy) { eye.state = 'decoy'; eye.t = 2.2; Snd.sting(true); return; }
  eye.state = 'lock'; eye.t = 3.5; Snd.sting(false);
  setStatus('It sees you. RUN.', 'hunt'); $('vignette').classList.add('hunt'); toast('The Eye sees you. Something is coming. RUN.', 'scary');
  spawnCreatures();
}
function spawnCreatures() {
  for (const c of creatures) scene.remove(c.grp); creatures.length = 0;
  const pcx = toCell(player.x), pcy = toCell(player.z); bfs(pcx, pcy, distP);
  const cand = []; for (let k = 0; k < N * N; k++) if (distP[k] >= 5 && distP[k] <= 8) cand.push(k);
  if (!cand.length) for (let k = 0; k < N * N; k++) if (distP[k] >= 3) cand.push(k);
  const kinds = ['squid', 'bat', 'spider']; const pick = [];
  for (let i = 0; i < 2 && cand.length; i++) {
    let k = cand[Math.floor(Math.random() * cand.length)];
    if (pick.length) { // second one from a different side if possible
      const far = cand.filter((c) => Math.abs((c % N) - (pick[0] % N)) + Math.abs(((c / N) | 0) - ((pick[0] / N) | 0)) > 4); if (far.length) k = far[Math.floor(Math.random() * far.length)];
    }
    pick.push(k);
    const v = makeCreature(kinds[(i + game.caught) % 3]);
    const cr = Object.assign(v, { x: cc(k % N), z: cc((k / N) | 0), y: 0.9, phase: Math.random() * 6, seen: true, fade: 0, alive: true, p: Snd.ok ? Snd.panner(cc(k % N), 1, cc((k / N) | 0)) : null });
    cr.grp.position.set(cr.x, cr.y, cr.z); cr.grp.scale.setScalar(0.01); creatures.push(cr);
  }
  game.hunt = true; game.huntLost = 0; game.huntT = 0;
}
function endHunt(caught) {
  game.hunt = false; $('vignette').classList.remove('hunt');
  for (const c of creatures) c.alive = false;
  if (!caught) { toast('They lost you. Breathe.', 'info'); }
  eye.state = 'scan'; eye.cool = caught ? 14 : 18;
}
let distT = 0;
function updateCreatures(dt) {
  if (!creatures.length) return;
  distT -= dt; const pcx = toCell(player.x), pcy = toCell(player.z);
  if (distT <= 0) { bfs(pcx, pcy, distP); distT = 0.25; }
  let anySeen = false; let nearest = 1e9;
  for (const c of creatures) {
    c.phase += dt * 9;
    if (!c.alive) { c.fade += dt; c.grp.scale.setScalar(Math.max(0.01, 1.5 - c.fade * 2)); c.grp.position.y += dt * 1.5; continue; }
    c.grp.scale.setScalar(Math.min(1.5, c.grp.scale.x + dt * 3));
    const dxp = player.x - c.x, dzp = player.z - c.z; const dp = Math.hypot(dxp, dzp); nearest = Math.min(nearest, dp);
    const los = lineOfSight(c.x, c.z, player.x, player.z); if (los) anySeen = true;
    const sp = los ? 5.7 : 3.7;
    let tx, tz;
    if (los && dp < 12) { tx = player.x; tz = player.z; }
    else {
      const cx = toCell(c.x), cy = toCell(c.z); let best = null, bd = distP[cy * N + cx];
      for (const [dx, dy] of DIRS) { if (!open(cx, cy, dx, dy)) continue; const v = distP[(cy + dy) * N + cx + dx]; if (v >= 0 && v < bd) { bd = v; best = [cx + dx, cy + dy]; } }
      const ccx = cc(cx), ccz = cc(cy);
      if (best) {
        const off = best[0] !== cx ? Math.abs(c.z - ccz) : Math.abs(c.x - ccx);
        if (off > 0.45) { tx = best[0] !== cx ? c.x + (best[0] - cx) * 0.3 : ccx; tz = best[0] !== cx ? ccz : c.z + (best[1] - cy) * 0.3; }
        else { tx = cc(best[0]); tz = cc(best[1]); }
      } else { tx = player.x; tz = player.z; }
    }
    const mx = tx - c.x, mz = tz - c.z, ml = Math.hypot(mx, mz) || 1; const step = Math.min(ml, sp * dt);
    let nx = c.x + mx / ml * step, nz = c.z + mz / ml * step; [nx, nz] = collide(nx, nz, 0.3); c.x = nx; c.z = nz;
    c.grp.position.set(c.x, (c.kind === 'bat' ? 1.6 : 1.05) + Math.sin(c.phase * 0.7) * 0.15, c.z); c.grp.rotation.y = Math.atan2(mx, mz);
    for (const t of c.tendrils) { t.piv.rotation.x = t.base.x + Math.sin(c.phase + t.a * 2) * 0.35; t.piv.rotation.z = t.base.z + Math.cos(c.phase * 1.1 + t.a) * 0.35; }
    for (const w of c.wings) w.piv.rotation.z = w.s * Math.sin(c.phase * 1.6) * 0.7;
    if (c.p) { Snd.setPos(c.p, c.x, 0.8, c.z); if (Math.random() < dt * (los ? 16 : 9)) Snd.click(c.p); }
    if (dp < 0.95 && !game.frozen) { caughtByShadow(); return; }
  }
  for (let i = creatures.length - 1; i >= 0; i--) if (!creatures[i].alive && creatures[i].fade > 0.8) { scene.remove(creatures[i].grp); if (creatures[i].p) creatures[i].p.disconnect(); creatures.splice(i, 1); }
  if (game.hunt) {
    game.huntT += dt;
    if (anySeen) game.huntLost = 0; else game.huntLost += dt;
    setStatus(anySeen ? 'They see you. RUN.' : `Hide... they're sniffing (${Math.ceil(HUNT_LOSE - game.huntLost)})`, 'hunt');
    if (game.huntLost > HUNT_LOSE || game.huntT > 45) endHunt(false);
    game.near = nearest;
  }
}
const CAUGHT_LINES = [
  'The shadows say hi. Back to the lantern.',
  'Tag. You are it. (Back to the last lantern.)',
  'Squid: 1. You: 0.',
  'They only wanted a hug. A cold, cold hug.',
  'Caught! The Eye writes this down in its little book.',
  'That was a spider. Or a bat. Or a squid. Nobody knows.',
];
function caughtByShadow() {
  game.frozen = 1; game.caught++; Snd.boom();
  $('caughtText').textContent = CAUGHT_LINES[(game.caught - 1) % CAUGHT_LINES.length]; $('caught').classList.add('on');
  setTimeout(() => {
    for (const c of creatures) { scene.remove(c.grp); if (c.p) c.p.disconnect(); } creatures.length = 0; endHunt(true);
    respawn(); setTimeout(() => { $('caught').classList.remove('on'); game.frozen = 0; }, 300);
  }, 2300);
}
function respawn() {
  const l = lanterns[game.cp] || lanterns[0];
  player.x = cc(l.cx); player.z = cc(l.cy); player.vx = player.vz = 0;
  // face an open corridor
  for (const [dx, dy] of DIRS) if (open(l.cx, l.cy, dx, dy)) { player.yaw = Math.atan2(-dx, -dy); break; }
}

// ---------------------------------------------------------------- eye update
const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), DOWN = new THREE.Vector3(0, -1, 0);
let susT = 0;
function setStatus(text, cls) { const s = $('status'); if (s.textContent !== text) s.textContent = text; s.className = 'status ' + (cls || ''); }
function updateEye(dt) {
  const pcell = toCell(player.z) * N + toCell(player.x); const hidden = canopy.has(pcell);
  eye.cool = Math.max(0, eye.cool - dt);
  if (eye.state === 'lock' || eye.state === 'decoy') { eye.target.lerp(tmpV.set(player.x, 0, player.z), Math.min(1, dt * 6)); eye.t -= dt; if (eye.t <= 0) { if (eye.state === 'decoy') { eye.blink = 0.35; const tr = eye.decoyTrap; if (tr) toast(lineOf(tr, 0), tr.def.kind || 'scary', tr.def.by); eye.decoyTrap = null; } const wasDecoy = eye.state === 'decoy'; eye.state = 'scan'; eye.cool = Math.max(eye.cool, wasDecoy ? 5 : 2); eye.way.set(player.x + (Math.random() - 0.5) * 80, 0, player.z + (Math.random() - 0.5) * 80); } }
  else {
    tmpV.copy(eye.way).sub(eye.target); tmpV.y = 0; const d = tmpV.length();
    if (d < 1.5) { // new waypoint: often near the player, to keep it tense
      if (Math.random() < 0.38) eye.way.set(player.x + (Math.random() - 0.5) * 40, 0, player.z + (Math.random() - 0.5) * 40);
      else eye.way.set(10 + Math.random() * (W - 20), 0, 10 + Math.random() * (W - 20));
      eye.way.x = clamp(eye.way.x, 4, W - 4); eye.way.z = clamp(eye.way.z, 4, W - 4);
    } else eye.target.addScaledVector(tmpV, Math.min(1, (eye.state === 'suspect' ? 2.5 : 7.5) * dt / d));
    const pd = Math.hypot(player.x - eye.target.x, player.z - eye.target.z);
    const inPool = pd < POOL_R * 0.85 && !hidden && !game.frozen && game.started && !game.over;
    if (!game.hunt && eye.cool <= 0) {
      if (inPool) { if (eye.state !== 'suspect') { eye.state = 'suspect'; susT = 0; Snd.heartbeat(0.8); } susT += dt; eye.target.lerp(tmpV2.set(player.x, 0, player.z), dt * 1.2); if (susT > 0.85) spotted(false); }
      else if (eye.state === 'suspect') { susT -= dt * 2; if (susT <= 0) eye.state = 'scan'; }
    }
    if (!game.hunt) {
      if (eye.state === 'suspect') setStatus('The light is on you...', 'warn');
      else if (hidden) setStatus('Hidden under the arch', 'safe');
      else if (pd < POOL_R * 2.2) setStatus('The light is close!', 'warn');
      else setStatus('The Eye is searching...', '');
    }
  }
  // place light + cone
  const ep = eye.grp.position; tmpV.copy(eye.target).sub(ep); const len = tmpV.length(); tmpV.normalize();
  eye.light.target.position.copy(eye.target); eye.light.angle = Math.atan(POOL_R * 1.1 / len);
  eye.cone.quaternion.setFromUnitVectors(DOWN, tmpV); eye.cone.scale.set(POOL_R, len, POOL_R);
  eye.disk.position.set(eye.target.x, 0.04, eye.target.z); eye.disk.scale.setScalar(POOL_R * 1.05);
  const col = eye.state === 'lock' || (game.hunt) ? 0xff3a2a : eye.state === 'suspect' || eye.state === 'decoy' ? 0xffa040 : 0xfff0c8;
  eye.light.color.setHex(col); eye.cone.material.color.setHex(col); eye.disk.material.color.setHex(col); eye.glowSprite.material.color.setHex(col === 0xfff0c8 ? 0xffd9a0 : col);
  // look + pupil + blink
  const look = eye.state === 'lock' || eye.state === 'decoy' ? tmpV2.set(player.x, 1.6, player.z) : eye.target;
  eye.grp.lookAt(look);
  const ps = eye.state === 'lock' || eye.state === 'decoy' ? 0.9 : 0.45 + Math.sin(performance.now() / 900) * 0.05; eye.pupil.scale.x += (ps - eye.pupil.scale.x) * Math.min(1, dt * 8);
  eye.blink = Math.max(0, eye.blink - dt); if (Math.random() < dt * 0.05) eye.blink = 0.25;
  eye.grp.scale.set(1, eye.blink > 0 ? 0.08 : 1, 1);
  eye.glowSprite.position.copy(ep);
}

// ---------------------------------------------------------------- traps update
function lineOf(tr, i) { const l = tr.def.lines || []; return l.length ? l[Math.min(i, l.length - 1)] : ''; }
function updateTraps(dt) {
  const pcx = toCell(player.x), pcy = toCell(player.z);
  for (const tr of traps) {
    const d = tr.def; const st = tr.st; const inCell = pcx === tr.cell[0] && pcy === tr.cell[1]; const dist = Math.hypot(player.x - tr.wx, player.z - tr.wz);
    st.cd = Math.max(0, (st.cd || 0) - dt);
    switch (d.type) {
      case 'loop': updateLoop(tr); break;
      case 'sign': if (dist < 3.6 && !st.cd && d.lines && d.lines.length > (d.params && d.params.text ? 0 : 1)) { toast(lineOf(tr, d.params && d.params.text ? 0 : 1), d.kind, d.by); st.cd = 40; } break;
      case 'fake_exit':
        if (!st.done && dist < 5.2) { st.done = true; toast(lineOf(tr, 0), d.kind, d.by); Snd.laugh(); st.fadeT = 1.2; }
        if (st.fadeT > 0) { st.fadeT -= dt; const k = Math.max(0, st.fadeT / 1.2) * (Math.random() < 0.3 ? 0.2 : 1); tr.gate.portal.material.opacity = k; tr.gate.glow.material.opacity = k * 0.8; }
        break;
      case 'whisper': if (inCell && !st.cd) { Snd.whisper(tr.wx + (Math.random() - 0.5) * 6, tr.wz + (Math.random() - 0.5) * 6); toast(lineOf(tr, 0), d.kind, d.by); st.cd = 60; } break;
      case 'jumpscare': if (inCell && !st.done) { st.done = true; jumpscare(); setTimeout(() => toast(lineOf(tr, 0), d.kind, d.by), 800); } break;
      case 'darkness': if (inCell && !st.cd) { game.dark = (d.params && d.params.seconds) || 8; game.darkFog = (d.params && d.params.fog) || 7; game.darkTrap = tr; toast(lineOf(tr, 0), d.kind, d.by); st.cd = 90; Snd.burst(1.5, 'lowpass', 200, 0.5, 0.25); } break;
      case 'reverse': if (inCell && !st.cd) { game.reverse = (d.params && d.params.seconds) || 6; toast(lineOf(tr, 0), d.kind, d.by); st.cd = 60; } break;
      case 'decoy_eye': if (inCell && !st.done && !game.hunt) { st.done = true; eye.decoyTrap = tr; spotted(true); setStatus('The light is on you...', 'warn'); } break;
      case 'shortcut': if (tr.gap && !st.done && dist < 1.4) { st.done = true; toast(lineOf(tr, 0), d.kind, d.by); Snd.rustle(); Snd.rustle(); } break;
    }
  }
}
function updateLoop(tr) {
  if (!loopChain) return; const st = tr.st; const ch = loopChain; const ax = ch.axis === 'x';
  const s = ax ? player.x : player.z, perp = ax ? player.z : player.x;
  const [fx, fy] = ch.cells[0]; const a0 = cc(ax ? fx : fy), a1 = a0 + (ch.L - 1) * P, pc = cc(ax ? fy : fx);
  const inZone = Math.abs(perp - pc) < C / 2 + 0.2 && s > a0 - C / 2 && s < a1 + C / 2;
  game.inLoop = inZone && s > a0 + P * 0.5 && s < a1 - P * 0.5;
  if (!inZone) { st.entry = null; return; }
  if (!st.entry) st.entry = s < (a0 + a1) / 2 ? 'lo' : 'hi';
  const maxLoops = (tr.def.params && tr.def.params.loops) || 3; const trig = Math.min(ch.L - 3, 5), jump = (trig - 2) * P;
  const past = st.entry === 'lo' ? s > a0 + trig * P : s < a1 - trig * P;
  if (!past) return;
  if (st.loops < maxLoops) {
    const sh = st.entry === 'lo' ? -jump : jump; if (ax) player.x += sh; else player.z += sh;
    for (const c of creatures) { if (ax) c.x += sh; else c.z += sh; } // keep chasers in the same spot relative to you
    st.loops++; toast(lineOf(tr, st.loops - 1), tr.def.kind || 'both', tr.def.by, true); Snd.rustle();
    if (save) { save.loops = st.loops; writeSave(); }
  } else if (!st.released) { st.released = true; toast(lineOf(tr, maxLoops), tr.def.kind || 'both', tr.def.by, true); Snd.laugh(); }
}
function jumpscare() { const s = $('scare'); s.classList.remove('on'); void s.offsetWidth; s.classList.add('on'); Snd.sting(false); if (navigator.vibrate) try { navigator.vibrate(120); } catch (e) {} }

// ---------------------------------------------------------------- lights near the player
const pls = []; for (let i = 0; i < 3; i++) { const l = new THREE.PointLight(0xff9a40, 0, 15, 1.6); scene.add(l); pls.push(l); }
const exitLight = new THREE.PointLight(0x8cffb4, 30, 30, 1.4);
let plT = 0;
function updateLanterns(dt, now) {
  plT -= dt;
  if (plT <= 0) {
    plT = 0.35; const sorted = lanterns.map((l) => [Math.hypot(l.x - player.x, l.z - player.z), l]).sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < pls.length; i++) { const e = sorted[i]; pls[i].userData.l = e && e[0] < 30 ? e[1] : null; }
  }
  const darkK = game.dark > 0 ? 0.05 : 1;
  for (const l of pls) { const ln = l.userData.l; if (!ln) { l.intensity = 0; continue; } l.position.set(ln.x, 2.45, ln.z); const fl = 0.85 + Math.sin(now * 0.011 + ln.seed) * 0.08 + Math.sin(now * 0.037 + ln.seed * 3) * 0.07; l.intensity = (ln.lit ? 9 : 5) * fl * darkK; }
  for (const ln of lanterns) {
    const fl = 0.8 + Math.sin(now * 0.011 + ln.seed) * 0.1; ln.glow.material.opacity = (ln.lit ? 0.95 : 0.5) * fl * darkK; ln.head.material.color.setHex(darkK < 1 ? 0x221006 : ln.lit ? 0xffc060 : 0xb06020);
    if (Math.hypot(ln.x - player.x, ln.z - player.z) < 3.2 && game.cp !== ln.idx && !game.frozen) {
      const first = !ln.lit; ln.lit = true; game.cp = ln.idx; Snd.chime(); if (first) toast('Lantern lit. If they catch you, you come back here.', 'info');
      save = { cp: game.cp, t: game.t, walked: game.walked, caught: game.caught, loops: loopTrap() ? loopTrap().st.loops : 0, lit: lanterns.filter((x) => x.lit).map((x) => x.idx) }; writeSave();
    }
  }
}
const loopTrap = () => traps.find((t) => t.def.type === 'loop');

// ---------------------------------------------------------------- main loop
let last = performance.now(), fpsAcc = 0, fpsN = 0, stepAcc = 0, rustleT = 0, beatT = 0, chunkT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000; last = now; if (dt > 0.1) dt = 0.1;
  if (game.started && !game.over) tick(dt, now);
  // fog: thick, thicker in the loop corridor and in darkness events
  const target = game.dark > 0 ? game.darkFog : game.inLoop ? 12 : FOG_FAR;
  scene.fog.far += (target - scene.fog.far) * Math.min(1, dt * (game.dark > 0 ? 3 : 0.8));
  scene.fog.near = Math.min(3, scene.fog.far * 0.2);
  // cull hedge chunks hidden by fog
  chunkT -= dt; if (chunkT <= 0) { chunkT = 0.2; const lim = scene.fog.far + 40; for (const c of chunks) { const v = Math.hypot(c.x - player.x, c.z - player.z) < lim; c.mesh.visible = v; if (c.inst) c.inst.visible = v; } }
  camera.position.set(player.x, EYE_LEVEL + Math.sin(player.bob) * 0.045, player.z); camera.rotation.set(player.pitch, player.yaw, 0);
  const sky = scene.userData.sky; sky.position.copy(camera.position); scene.userData.stars.position.copy(camera.position);
  scene.userData.moon.position.set(camera.position.x - 160, camera.position.y + 260, camera.position.z - 120);
  renderer.render(scene, camera);
  // adapt resolution if the phone struggles
  fpsAcc += dt; fpsN++; if (fpsAcc > 3) { const fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; game.fps = fps; if (fps < 38 && pixelRatio > 1) { pixelRatio = Math.max(1, pixelRatio - 0.25); renderer.setPixelRatio(pixelRatio); resize(); } }
}
function tick(dt, now) {
  game.t += dt;
  if (game.frozen) return;
  // input
  let f = 0, s = 0;
  if (keys.KeyW || keys.ArrowUp) f += 1; if (keys.KeyS || keys.ArrowDown) f -= 1; if (keys.KeyD) s += 1; if (keys.KeyA) s -= 1;
  if (keys.ArrowLeft) player.yaw += dt * 2.2; if (keys.ArrowRight) player.yaw -= dt * 2.2;
  if (joy.id !== null) { f = -joy.y; s = joy.x; }
  const m = Math.hypot(f, s); if (m > 1) { f /= m; s /= m; }
  if (game.reverse > 0) { game.reverse -= dt; f = -f; s = -s; }
  const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
  const wx = (-sy * f + cy * s) * SPEED, wz = (-cy * f - sy * s) * SPEED;
  const k = Math.min(1, dt * 10); player.vx += (wx - player.vx) * k; player.vz += (wz - player.vz) * k;
  const ox = player.x, oz = player.z;
  [player.x, player.z] = collide(player.x + player.vx * dt, player.z + player.vz * dt, PLAYER_R);
  const moved = Math.hypot(player.x - ox, player.z - oz); game.walked += moved;
  const sp = moved / dt; player.bob += sp * dt * 2.1; stepAcc += moved; if (stepAcc > 1.25) { stepAcc = 0; Snd.step(); }
  rustleT -= dt; if (rustleT <= 0) { rustleT = 1.5 + Math.random() * 4; if (Math.random() < 0.6) Snd.rustle(); }
  // heartbeat: faster when hunted
  beatT -= dt; const hb = game.hunt ? Math.max(0.36, 0.55 - Math.max(0, 14 - (game.near || 14)) * 0.012) : eye.state === 'suspect' ? 0.6 : 0;
  if (hb && beatT <= 0) { beatT = hb; Snd.heartbeat(game.hunt ? 1 : 0.6); }
  if (Snd.hunt) Snd.hunt.gain.setTargetAtTime(game.hunt ? 0.05 : 0, Snd.ctx.currentTime, 0.4);
  if (game.dark > 0) { game.dark -= dt; if (game.dark <= 0 && game.darkTrap) { const l = game.darkTrap.def.lines; if (l && l[1]) toast(l[1], game.darkTrap.def.kind, game.darkTrap.def.by); } }
  updateEye(dt); updateCreatures(dt); updateTraps(dt); updateLanterns(dt, now);
  const fx = -sy, fz = -cy; Snd.listener(player.x, EYE_LEVEL, player.z, fx, fz);
  // exit gate shimmer + win
  if (exitGate) exitGate.portal.material.opacity = 0.75 + Math.sin(now * 0.004) * 0.2;
  if (player.x > W + 0.8) win();
  // HUD
  { $('stats').textContent = fmtTime(game.t) + ' · ' + Math.round(game.walked) + ' m'; $('needle').style.transform = `rotate(${player.yaw}rad)`; }
}
function win() {
  game.over = true; Snd.chime(); setTimeout(() => Snd.chime(), 400);
  toastQ.length = 0; toastGen++; $('toast').classList.remove('show');
  const t = game.t; const best = prefs.best && prefs.best < t ? prefs.best : t; const isBest = best === t; if (!DEV) { prefs.best = best; writePrefs(); }
  $('winText').textContent = `Out in ${fmtTime(t)}. You walked ${Math.round(game.walked)} m and got caught ${game.caught} time${game.caught === 1 ? '' : 's'}.`;
  $('winBest').textContent = isBest ? 'Your best time on this device.' : `Your best: ${fmtTime(best)}.`;
  save = null; try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
  $('win').hidden = false; $('hud').hidden = true; $('status').hidden = true; for (const c of creatures) c.alive = false;
  if (document.exitPointerLock) document.exitPointerLock();
}

// ---------------------------------------------------------------- start
function startGame(cont) {
  Snd.init();
  $('intro').hidden = true; $('hud').hidden = false; $('status').hidden = false;
  if (isTouch) { $('hint').hidden = false; setTimeout(() => { $('hint').style.opacity = 0; }, 6000); }
  game.started = true; game.over = false;
  if (cont && save) {
    game.cp = save.cp | 0; game.t = save.t || 0; game.walked = save.walked || 0; game.caught = save.caught | 0;
    for (const i of save.lit || []) if (lanterns[i]) lanterns[i].lit = true;
    const lt = loopTrap(); if (lt) lt.st.loops = Math.min(save.loops | 0, 3);
    respawn(); toast('Back at your lantern.', 'info');
  } else {
    save = null; try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    game.cp = 0; game.t = 0; game.walked = 0; game.caught = 0; respawn();
    setTimeout(() => toast("Find the way out. Don't let the Eye see you.", 'scary'), 600);
  }
  eye.cool = 8;
}
$('btnAgain').addEventListener('click', () => { location.reload(); });

async function boot() {
  const defs = await loadTraps();
  buildMaze(defs);
  bfs(0, 0, distStart);
  traps = resolveTraps(defs);
  placeTrapProps();
  buildHedges();
  for (const tr of traps) if (tr.gap) buildCurtain(tr.gap[0], tr.gap[1]);
  buildEye();
  // lanterns: start + spread-out junctions
  addLantern(0, 0, 0);
  const junc = []; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (openings(x, y) >= 3) junc.push([x, y]);
  const r = mulberry(SEED + 1); for (let i = junc.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [junc[i], junc[j]] = [junc[j], junc[i]]; }
  const chainSet = new Set((loopChain ? loopChain.cells : []).map(([x, y]) => y * N + x));
  for (const [x, y] of junc) { if (lanterns.length > 34 || chainSet.has(y * N + x)) continue; if (lanterns.every((l) => Math.max(Math.abs(l.cx - x), Math.abs(l.cy - y)) > 5)) addLantern(x, y, 1); }
  // pumpkins: the loop's landmark + some decoration
  if (loopChain) {
    const ch = loopChain; const [fx, fy] = ch.cells[0]; const ax = ch.axis === 'x';
    const along = cc(ax ? fx : fy) + 3.5 * P, side = cc(ax ? fy : fx) + (C / 2 - 0.85);
    if (ax) addPumpkin(along, side, Math.PI, 1.15); else addPumpkin(side, along, -Math.PI / 2, 1.15);
  }
  for (const l of lanterns) if (hash3(l.cx, l.cy, 31) < 0.45) addPumpkin(l.x + (cc(l.cx) - l.x) * 0.25, l.z + (cc(l.cy) - l.z) * 0.6, Math.atan2(cc(l.cx) - l.x, cc(l.cy) - l.z), 0.8 + hash3(l.cx, l.cy, 32) * 0.4);
  // the real exit
  exitGate = makeGate(); exitGate.grp.position.set(W - T / 2, 0, cc(N - 1)); exitGate.grp.rotation.y = -Math.PI / 2;
  exitLight.position.set(W - 1.5, 3, cc(N - 1)); scene.add(exitLight);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.4, 120, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0x6cff9c, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  beam.position.set(W + 3, 60, cc(N - 1)); scene.add(beam);
  const out = makeSign(W + 3.5, cc(N - 1) - 2.6, -Math.PI / 2, 'WAY OUT\nyou did it.\nprobably.');
  respawn();
  if (DEV) devPanel();
  window.hedge = { player, game, eye, traps, lanterns, N, W, cc, teleport(x, y, yaw) { player.x = cc(x); player.z = cc(y); if (yaw !== undefined) player.yaw = yaw; }, spot() { eye.target.set(player.x, 0, player.z); eye.cool = 0; spotted(false); }, loopChain, canopy, open, creatures, renderer, chunks, faceOpen() { const x = toCell(player.x), y = toCell(player.z); let best = null, bl = -1; for (const [dx, dy] of DIRS) { let l = 0, cx = x, cy = y; while (open(cx, cy, dx, dy) && l < 20) { cx += dx; cy += dy; l++; } if (l > bl) { bl = l; best = [dx, dy]; } } player.yaw = Math.atan2(-best[0], -best[1]); player.pitch = 0.02; return bl; } };
  $('loading').classList.add('done'); setTimeout(() => { $('loading').hidden = true; }, 600);
  const b = $('btnStart'); b.disabled = false;
  if (save && typeof save.cp === 'number') { b.textContent = 'Continue from your lantern'; $('btnNew').hidden = false; b.onclick = () => startGame(true); $('btnNew').onclick = () => startGame(false); }
  else { b.textContent = 'Enter the maze'; b.onclick = () => startGame(false); }
  requestAnimationFrame(frame);
}
function devPanel() {
  const p = $('dev'); p.hidden = false;
  const add = (label, fn) => { const b = document.createElement('button'); b.textContent = label; b.onclick = fn; p.appendChild(b); };
  if (loopChain) { const [x, y] = loopChain.cells[0]; add('Loop start', () => { window.hedge.teleport(x, y, loopChain.axis === 'x' ? -Math.PI / 2 : Math.PI); }); }
  for (const tr of traps) if (tr.def.type !== 'loop') add(tr.def.type + ': ' + tr.def.id, () => { const [x, y] = tr.cell; let nx = x, ny = y; for (const [dx, dy] of DIRS) if (open(x, y, dx, dy)) { nx = x + dx; ny = y + dy; break; } window.hedge.teleport(nx, ny, Math.atan2(-(x - nx), -(y - ny))); });
  add('Near exit', () => window.hedge.teleport(N - 1, N - 1, -Math.PI / 2));
  add('Spot me', () => window.hedge.spot());
  add('Arch', () => { const k = [...canopy][0]; window.hedge.teleport(k % N, (k / N) | 0); });
}
document.addEventListener('visibilitychange', () => { last = performance.now(); });
boot();
