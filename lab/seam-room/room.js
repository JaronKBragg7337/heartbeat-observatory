/* ============================================================================
   room.js - The Seam Room
   ---------------------------------------------------------------------------
   One room, two real pages. x < 0 is /lab/seam-room/a/, x >= 0 is
   /lab/seam-room/b/. Both pages load this file; the URL decides where you
   spawn. seam.js flips the URL as you walk. The shell (HBShell) carries the
   player, input, identity and the ONE realtime channel ("hb-seam-room") that
   both pages share, which is what makes it one room.

   The log/chair is the supply-chain seed: one object, one id, carried page to
   page, keeping its birth page, the pages it visited and what was done to it.
   ========================================================================== */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { Seam } from "/lab/seam-room/seam.js";

const $ = (id) => document.getElementById(id);
const W = 12, D = 8, H = 2.9;               // room size, metres. Seam at x = 0.
const HX = W / 2, HZ = D / 2;
const BENCH = { x: 4.55, z: -3.25 };        // the workbench on page B
const BLOCK = { x: -4.7, z: -2.4 };         // the chopping block on page A
const ASSET_KEY = "seam-room:asset:";       // + id
const CURRENT_KEY = "seam-room:current";
const NAMES = { a: "A", b: "B" };

/* ------------------------------------------------------------ seam log - */
const logLines = [];
function seamLog(text) {
  const t = new Date();
  logLines.push(`${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")} ${text}`);
  while (logLines.length > 5) logLines.shift();
  const box = $("seamLog");
  if (box) box.innerHTML = logLines.map((l) => `<div>${esc(l)}</div>`).join("");
}
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
window.__seamLog = logLines;

/* ---------------------------------------------------------------- seam - */
const ZONES = [
  { id: "a", url: "/lab/seam-room/a/", title: "Seam Room · Page A - Heartbeat Observatory", contains: (x) => x < 0 },
  { id: "b", url: "/lab/seam-room/b/", title: "Seam Room · Page B - Heartbeat Observatory", contains: (x) => x >= 0 },
];
const SPAWN = { a: { x: -3.6, z: 1.2, yaw: -Math.PI / 2 }, b: { x: 3.6, z: 1.2, yaw: Math.PI / 2 } };

const player = { x: 0, z: 0, yaw: 0, body: 0, speed: 0, mx: 0, my: 0, run: false };
const cam = { yaw: 0, pitch: 0.18 };
let zoneId = "a";
let shell = null;

const seam = Seam.define({
  zones: ZONES,
  hysteresis: 0.3,
  fallback: (document.documentElement.dataset.zone || "a"),
  onEnter(zone, from, info) {
    zoneId = zone.id;
    if (info.how === "load") {
      const s = SPAWN[zone.id];
      player.x = s.x; player.z = s.z; cam.yaw = s.yaw; player.body = Math.atan2(-Math.sin(s.yaw), -Math.cos(s.yaw));
      seamLog(`spawned on page ${NAMES[zone.id]} (from URL)`);
    } else if (info.how === "popstate") {
      // Back/Forward: put the walker just across the line, on the new side
      player.x = zone.id === "a" ? -0.7 : 0.7;
      seamLog(`← page ${NAMES[zone.id]} (back/forward)`);
    } else {
      seamLog(`→ page ${NAMES[zone.id]} (pushState)`);
    }
    if (shell) shell.setPlace("Page " + NAMES[zone.id]);
    if (from) onAssetCrossed(from.id, zone.id, info.how);
    updateCounter();
  },
});

/* ------------------------------------------------------------- renderer - */
const canvas = $("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a2420);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 60);
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize); resize();

/* ------------------------------------------------------------- textures - */
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
function rnd(seed) { let s = seed >>> 0; return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909), (s >>>= 0) / 4294967296)); }

/* plank floor: rows of boards with offset joints, tone variation and grain */
function planks(base, seed, boardW) {
  return canvasTex(1024, 1024, (g, w, h) => {
    const r = rnd(seed), rows = Math.round(1024 / boardW);
    for (let i = 0; i < rows; i++) {
      let x = -r() * 400;
      while (x < w) {
        const len = 260 + r() * 360, tone = (r() - 0.5) * 26;
        g.fillStyle = `rgb(${base[0] + tone},${base[1] + tone * 0.8},${base[2] + tone * 0.6})`;
        g.fillRect(x, i * boardW, len, boardW);
        for (let k = 0; k < 14; k++) {          // grain
          g.strokeStyle = `rgba(${40 + r() * 30},${25 + r() * 20},10,${0.05 + r() * 0.08})`;
          g.lineWidth = 0.6 + r() * 1.4;
          const y = i * boardW + r() * boardW;
          g.beginPath(); g.moveTo(x, y);
          g.bezierCurveTo(x + len * 0.3, y + (r() - 0.5) * 8, x + len * 0.7, y + (r() - 0.5) * 8, x + len, y + (r() - 0.5) * 4);
          g.stroke();
        }
        if (r() < 0.25) {                       // a knot
          g.fillStyle = "rgba(60,35,15,.35)";
          g.beginPath(); g.ellipse(x + r() * len, i * boardW + boardW / 2, 6 + r() * 6, 3 + r() * 2, 0, 0, 7); g.fill();
        }
        g.fillStyle = "rgba(25,15,8,.55)"; g.fillRect(x, i * boardW, 2, boardW);  // end joint
        x += len;
      }
      g.fillStyle = "rgba(25,15,8,.5)"; g.fillRect(0, i * boardW, w, 2);       // side joint
    }
  }, [W / 4, D / 4]);
}
function plaster(base, seed) {
  return canvasTex(512, 512, (g, w, h) => {
    const r = rnd(seed);
    g.fillStyle = `rgb(${base.join(",")})`; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      const v = (r() - 0.5) * 18;
      g.fillStyle = `rgba(${v > 0 ? "255,250,240" : "40,30,20"},${Math.abs(v) / 260})`;
      g.beginPath(); g.arc(r() * w, r() * h, 3 + r() * 22, 0, 7); g.fill();
    }
  }, [3, 1.2]);
}
function persianRug() {
  return canvasTex(1024, 720, (g, w, h) => {
    const r = rnd(7);
    g.fillStyle = "#7d2a22"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#1f2c48"; g.fillRect(40, 40, w - 80, h - 80);
    g.fillStyle = "#7d2a22"; g.fillRect(80, 80, w - 160, h - 160);
    g.strokeStyle = "#d9c49a"; g.lineWidth = 6; g.strokeRect(60, 60, w - 120, h - 120); g.strokeRect(96, 96, w - 192, h - 192);
    for (let i = 0; i < 26; i++) {               // border motifs
      const t = i / 26;
      for (const [x, y] of [[60 + t * (w - 120), 60], [60 + t * (w - 120), h - 60]]) {
        g.fillStyle = "#d9c49a"; g.beginPath(); g.moveTo(x, y - 12); g.lineTo(x + 10, y); g.lineTo(x, y + 12); g.lineTo(x - 10, y); g.fill();
      }
    }
    g.save(); g.translate(w / 2, h / 2);          // medallion
    for (let k = 0; k < 4; k++) {
      g.fillStyle = ["#1f2c48", "#d9c49a", "#a8463a", "#2e4a3a"][k];
      g.beginPath(); g.ellipse(0, 0, 220 - k * 48, 150 - k * 33, 0, 0, 7); g.fill();
    }
    g.restore();
    for (let i = 0; i < 9000; i++) {              // wool texture
      g.fillStyle = `rgba(${r() < 0.5 ? "255,240,220" : "20,10,5"},${r() * 0.08})`;
      g.fillRect(r() * w, r() * h, 2, 2);
    }
  });
}
function juteRug() {
  return canvasTex(512, 512, (g, w, h) => {
    const r = rnd(11);
    g.fillStyle = "#b39a6e"; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 6) for (let x = 0; x < w; x += 6) {
      const v = (r() - 0.5) * 40 + (((x + y) / 6) % 2 ? 8 : -8);
      g.fillStyle = `rgb(${179 + v},${154 + v},${110 + v * 0.8})`; g.fillRect(x, y, 5, 5);
    }
    g.strokeStyle = "#6e5a3a"; g.lineWidth = 14; g.strokeRect(14, 14, w - 28, h - 28);
  });
}
function bark() {
  return canvasTex(256, 256, (g, w, h) => {
    const r = rnd(5);
    g.fillStyle = "#5a4130"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) {
      g.strokeStyle = `rgba(${r() < 0.5 ? "30,20,12" : "120,95,70"},${0.25 + r() * 0.4})`;
      g.lineWidth = 1 + r() * 4;
      const x = r() * w; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (r() - 0.5) * 20, h); g.stroke();
    }
  }, [2, 1]);
}
function endGrain() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "#c9a172"; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 18; k++) { g.strokeStyle = `rgba(110,70,35,${0.25 + (k % 3) * 0.12})`; g.lineWidth = 2; g.beginPath(); g.arc(w / 2 + 4, h / 2 - 3, k * 7 + 3, 0, 7); g.stroke(); }
    g.strokeStyle = "#4a3222"; g.lineWidth = 16; g.beginPath(); g.arc(w / 2, h / 2, 122, 0, 7); g.stroke();
  });
}
function signTex(letter, url) {
  return canvasTex(768, 480, (g, w, h) => {
    g.fillStyle = "#efe6d2"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#a07c3c"; g.lineWidth = 6; g.strokeRect(26, 26, w - 52, h - 52);
    g.fillStyle = "#2c2118"; g.textAlign = "center";
    g.font = "600 46px Georgia, 'Times New Roman', serif"; g.fillText("PAGE", w / 2, 150);
    g.font = "700 200px Georgia, 'Times New Roman', serif"; g.fillText(letter, w / 2, 330);
    g.font = "26px ui-monospace, Menlo, Consolas, monospace"; g.fillStyle = "#6b5a46"; g.fillText(url, w / 2, 410);
  });
}
function labelTex(text, sub) {
  return canvasTex(512, 160, (g, w, h) => {
    g.fillStyle = "#e8dcc2"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#2c2118"; g.textAlign = "center";
    g.font = "700 50px Georgia, serif"; g.fillText(text, w / 2, 70);
    g.font = "28px Georgia, serif"; g.fillStyle = "#5c4a36"; g.fillText(sub, w / 2, 122);
  });
}
function skyTex() {
  return canvasTex(64, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, "#8fb8de"); gr.addColorStop(0.65, "#d9e6ee"); gr.addColorStop(0.8, "#e9d9b8"); gr.addColorStop(1, "#7a8a5e");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
}

/* ------------------------------------------------------------ materials - */
const M = {
  floorA: new THREE.MeshStandardMaterial({ map: planks([186, 140, 92], 3, 64), roughness: 0.62 }),
  floorB: new THREE.MeshStandardMaterial({ map: planks([112, 78, 54], 9, 92), roughness: 0.7 }),
  wallA: new THREE.MeshStandardMaterial({ map: plaster([168, 176, 148], 21), roughness: 0.95 }),
  wallB: new THREE.MeshStandardMaterial({ map: plaster([126, 146, 158], 33), roughness: 0.95 }),
  ceiling: new THREE.MeshStandardMaterial({ map: plaster([236, 230, 218], 41), roughness: 0.98 }),
  trim: new THREE.MeshStandardMaterial({ color: 0xeee6d6, roughness: 0.55 }),
  timber: new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.72 }),
  oak: new THREE.MeshStandardMaterial({ color: 0x9c6f45, roughness: 0.55 }),
  walnut: new THREE.MeshStandardMaterial({ color: 0x5c3b25, roughness: 0.5 }),
  maple: new THREE.MeshStandardMaterial({ color: 0xc89c6a, roughness: 0.6 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xb8913f, roughness: 0.32, metalness: 0.9 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x5a5f63, roughness: 0.45, metalness: 0.8 }),
  black: new THREE.MeshStandardMaterial({ color: 0x1d1c1a, roughness: 0.6, metalness: 0.3 }),
  linen: new THREE.MeshStandardMaterial({ color: 0x8a7a63, roughness: 0.95 }),
  sofa: new THREE.MeshStandardMaterial({ color: 0x6d4636, roughness: 0.9 }),
  cushion: new THREE.MeshStandardMaterial({ color: 0xc9b48c, roughness: 0.95 }),
  ceramic: new THREE.MeshStandardMaterial({ color: 0xc46b45, roughness: 0.7 }),
  leaf: new THREE.MeshStandardMaterial({ color: 0x3f6b35, roughness: 0.8 }),
  glass: new THREE.MeshBasicMaterial({ map: skyTex() }),
  shadeA: new THREE.MeshStandardMaterial({ color: 0xf2e3c4, roughness: 0.9, emissive: 0xffc98a, emissiveIntensity: 0.55, side: THREE.DoubleSide }),
  shadeB: new THREE.MeshStandardMaterial({ color: 0x2f3b33, roughness: 0.5, metalness: 0.4, side: THREE.DoubleSide }),
  bulb: new THREE.MeshBasicMaterial({ color: 0xfff1d6 }),
  pegboard: new THREE.MeshStandardMaterial({ color: 0xb9946a, roughness: 0.85 }),
  bark: new THREE.MeshStandardMaterial({ map: bark(), roughness: 0.95 }),
  endGrain: new THREE.MeshStandardMaterial({ map: endGrain(), roughness: 0.85 }),
  rugA: new THREE.MeshStandardMaterial({ map: persianRug(), roughness: 0.98 }),
  rugB: new THREE.MeshStandardMaterial({ map: juteRug(), roughness: 0.98 }),
};

/* ---------------------------------------------------------------- build - */
const solids = [];   // xz boxes the walker cannot enter: [minX, minZ, maxX, maxZ]
function box(w, h, d, mat, x, y, z, opts) {
  const o = opts || {};
  const geo = o.round ? new RoundedBoxGeometry(w, h, d, 3, o.round) : new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (o.ry) m.rotation.y = o.ry;
  m.castShadow = o.cast !== false; m.receiveShadow = true;
  (o.parent || scene).add(m);
  if (o.solid) solids.push([x - w / 2 - 0.05, z - d / 2 - 0.05, x + w / 2 + 0.05, z + d / 2 + 0.05]);
  return m;
}
function cyl(r1, r2, h, mat, x, y, z, opts) {
  const o = opts || {};
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, o.seg || 20), mat);
  m.position.set(x, y, z);
  if (o.rz) m.rotation.z = o.rz;
  if (o.rx) m.rotation.x = o.rx;
  m.castShadow = o.cast !== false; m.receiveShadow = true;
  (o.parent || scene).add(m);
  return m;
}
function plane(w, h, mat, x, y, z, rx, ry, parent) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, 0);
  m.receiveShadow = true;
  (parent || scene).add(m);
  return m;
}

function buildShell() {
  // floors (each half its own boards), with a brass threshold on the seam
  plane(HX, D, M.floorA, -HX / 2, 0, 0, -Math.PI / 2);
  plane(HX, D, M.floorB, HX / 2, 0, 0, -Math.PI / 2);
  M.floorA.map.repeat.set(HX / 4, D / 4); M.floorB.map.repeat.set(HX / 4, D / 4);
  box(0.05, 0.008, D, M.brass, 0, 0.004, 0, { cast: false });

  // ceiling
  plane(W, D, M.ceiling, 0, H, 0, Math.PI / 2);

  // walls: back (z=-4) and front (z=+4) are split at the seam; side walls are wholly A or B
  for (const [mat, cx] of [[M.wallA, -HX / 2], [M.wallB, HX / 2]]) {
    plane(HX, H, mat, cx, H / 2, -HZ, 0, 0);
    plane(HX, H, mat, cx, H / 2, HZ, 0, Math.PI);
  }
  plane(D, H, M.wallA, -HX, H / 2, 0, 0, Math.PI / 2);
  plane(D, H, M.wallB, HX, H / 2, 0, 0, -Math.PI / 2);

  // baseboards and crown
  for (const z of [-HZ + 0.01, HZ - 0.01]) { box(W, 0.12, 0.02, M.trim, 0, 0.06, z, { cast: false }); box(W, 0.06, 0.03, M.trim, 0, H - 0.03, z, { cast: false }); }
  for (const x of [-HX + 0.01, HX - 0.01]) { box(0.02, 0.12, D, M.trim, x, 0.06, 0, { cast: false }); box(0.03, 0.06, D, M.trim, x, H - 0.03, 0, { cast: false }); }

  // timber frame on the seam: posts on back and front walls + a ceiling beam.
  // Reads as an old house where two rooms were opened into one.
  box(0.18, H, 0.14, M.timber, 0, H / 2, -HZ + 0.07);
  box(0.18, H, 0.14, M.timber, 0, H / 2, HZ - 0.07);
  box(0.2, 0.22, D, M.timber, 0, H - 0.11, 0);
  for (const x of [-4, -2, 2, 4]) box(0.14, 0.16, D, M.timber, x, H - 0.08, 0);

  // windows on the back wall, one per side
  for (const x of [-2.6, 2.6]) {
    plane(1.3, 1.35, M.glass, x, 1.62, -HZ + 0.005);
    box(1.46, 0.08, 0.1, M.trim, x, 2.33, -HZ + 0.04);
    box(1.56, 0.05, 0.18, M.trim, x, 0.92, -HZ + 0.08);
    for (const dx of [-0.69, 0.69]) box(0.08, 1.45, 0.1, M.trim, x + dx, 1.62, -HZ + 0.04);
    box(0.04, 1.35, 0.05, M.trim, x, 1.62, -HZ + 0.03);
    box(1.3, 0.04, 0.05, M.trim, x, 1.62, -HZ + 0.03);
  }
  // linen curtains on A
  for (const dx of [-0.85, 0.85]) {
    const c = box(0.32, 1.9, 0.05, M.linen, -2.6 + dx, 1.5, -HZ + 0.16);
    c.geometry = new THREE.BoxGeometry(0.32, 1.9, 0.05, 8, 1, 1);
    const p = c.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + Math.sin(p.getX(i) * 40) * 0.03);
    c.geometry.computeVertexNormals();
  }
  cyl(0.015, 0.015, 2.2, M.brass, -2.6, 2.48, -HZ + 0.16, { rz: Math.PI / 2 });

  // panel doors on the front wall (closed)
  for (const [x, mat] of [[-4.6, M.oak], [4.6, M.walnut]]) {
    box(0.92, 2.05, 0.05, mat, x, 1.025, HZ - 0.03);
    for (const y of [0.55, 1.5]) box(0.62, 0.7, 0.02, mat, x, y, HZ - 0.06);
    box(1.04, 0.07, 0.07, M.trim, x, 2.08, HZ - 0.04);
    for (const dx of [-0.49, 0.49]) box(0.07, 2.08, 0.07, M.trim, x + dx, 1.04, HZ - 0.04);
    cyl(0.03, 0.03, 0.05, M.brass, x + 0.36, 1.0, HZ - 0.09, { rx: Math.PI / 2 });
  }

  // signs on each side wall
  for (const [letter, x, ry] of [["A", -HX + 0.03, Math.PI / 2], ["B", HX - 0.03, -Math.PI / 2]]) {
    const g = new THREE.Group(); g.position.set(x, 1.65, 0.4); g.rotation.y = ry; scene.add(g);
    box(1.12, 0.74, 0.04, M.walnut, 0, 0, 0, { parent: g, cast: false });
    plane(1.0, 0.625, new THREE.MeshStandardMaterial({ map: signTex(letter, `/lab/seam-room/${letter.toLowerCase()}/`), roughness: 0.8 }), 0, 0, 0.022, 0, 0, g);
    cyl(0.02, 0.03, 0.18, M.brass, 0, 0.47, 0.08, { parent: g, rx: Math.PI / 2 });   // picture light
  }
}

function buildSideA() {
  // persian rug, sofa, coffee table
  plane(3.0, 2.1, M.rugA, -3.0, 0.006, 1.6, -Math.PI / 2);
  const s = { x: -3.0, z: 3.25 };
  box(2.2, 0.42, 0.9, M.sofa, s.x, 0.28, s.z, { round: 0.06, solid: true });
  box(2.2, 0.5, 0.2, M.sofa, s.x, 0.7, s.z + 0.36, { round: 0.07 });
  for (const dx of [-1.06, 1.06]) box(0.18, 0.62, 0.9, M.sofa, s.x + dx, 0.34, s.z, { round: 0.06 });
  for (const dx of [-0.5, 0.5]) box(0.96, 0.14, 0.7, M.cushion, s.x + dx, 0.55, s.z - 0.06, { round: 0.05 });
  box(1.2, 0.05, 0.62, M.walnut, -3.0, 0.42, 1.7, { solid: true });
  for (const dx of [-0.54, 0.54]) for (const dz of [-0.25, 0.25]) box(0.05, 0.4, 0.05, M.walnut, -3.0 + dx, 0.2, 1.7 + dz);
  // a book and a mug on the table
  box(0.22, 0.04, 0.16, new THREE.MeshStandardMaterial({ color: 0x2f4f6b, roughness: 0.7 }), -3.2, 0.465, 1.65, { ry: 0.3 });
  cyl(0.045, 0.04, 0.09, M.ceramic, -2.7, 0.49, 1.78);

  // bookshelf against the side wall
  const bx = -HX + 0.2, bz = 2.6;
  box(0.36, 2.0, 1.2, M.oak, bx, 1.0, bz, { solid: true });
  const r = rnd(77);
  for (let shelf = 0; shelf < 4; shelf++) {
    let z = bz - 0.54;
    while (z < bz + 0.5) {
      const t = 0.03 + r() * 0.05, h = 0.22 + r() * 0.1;
      const col = new THREE.Color().setHSL(r(), 0.35, 0.25 + r() * 0.2);
      box(0.24, h, t, new THREE.MeshStandardMaterial({ color: col, roughness: 0.8 }), bx + 0.06, 0.12 + shelf * 0.48 + h / 2, z + t / 2, { cast: false });
      z += t + 0.005;
    }
  }

  // floor lamp
  cyl(0.16, 0.18, 0.03, M.black, -1.6, 0.015, 3.4);
  cyl(0.012, 0.012, 1.55, M.brass, -1.6, 0.8, 3.4);
  cyl(0.14, 0.22, 0.28, M.shadeA, -1.6, 1.62, 3.4, { cast: false });

  // potted plant in the corner by the window
  cyl(0.2, 0.16, 0.38, M.ceramic, -0.75, 0.19, -3.5);
  const pr = rnd(4);
  for (let i = 0; i < 26; i++) {
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.1 + pr() * 0.08, 8, 6), M.leaf);
    l.scale.set(1, 0.45, 1.6);
    l.position.set(-0.75 + (pr() - 0.5) * 0.5, 0.5 + pr() * 0.8, -3.5 + (pr() - 0.5) * 0.5);
    l.rotation.set(pr() * 2, pr() * 6, pr());
    l.castShadow = true; scene.add(l);
  }
  solids.push([-1.0, -3.8, -0.5, -3.2]);

  // the woodpile and chopping block (page A is where trees are cut)
  const rack = { x: -HX + 0.4, z: -2.6 };
  box(0.5, 0.04, 1.4, M.black, rack.x, 0.08, rack.z);
  for (const dz of [-0.68, 0.68]) box(0.5, 1.0, 0.03, M.black, rack.x, 0.5, rack.z + dz);
  for (let row = 0; row < 4; row++) for (let i = 0; i < 6; i++) {
    const z = rack.z - 0.55 + i * 0.22 + (row % 2) * 0.1;
    if (z > rack.z + 0.62) continue;
    cyl(0.1, 0.1, 0.46, M.bark, rack.x, 0.2 + row * 0.19, z, { rz: Math.PI / 2, seg: 12 });
  }
  solids.push([rack.x - 0.3, rack.z - 0.75, rack.x + 0.3, rack.z + 0.75]);
  cyl(0.3, 0.33, 0.45, M.bark, BLOCK.x, 0.225, BLOCK.z);
  cyl(0.3, 0.3, 0.005, M.endGrain, BLOCK.x, 0.452, BLOCK.z, { cast: false });
  // a hatchet resting on the block
  box(0.04, 0.03, 0.42, M.maple, BLOCK.x + 0.12, 0.47, BLOCK.z + 0.04, { ry: 0.7 });
  box(0.02, 0.1, 0.12, M.steel, BLOCK.x + 0.26, 0.48, BLOCK.z - 0.12, { ry: 0.7 });
  solids.push([BLOCK.x - 0.35, BLOCK.z - 0.35, BLOCK.x + 0.35, BLOCK.z + 0.35]);
}

function buildSideB() {
  plane(2.6, 1.7, M.rugB, 3.2, 0.006, 1.4, -Math.PI / 2);

  // workbench against the back wall: thick maple top, legs, stretchers, vise
  const b = BENCH;
  box(2.0, 0.08, 0.75, M.maple, b.x, 0.88, b.z, { solid: true });
  for (const dx of [-0.92, 0.92]) for (const dz of [-0.3, 0.3]) box(0.08, 0.84, 0.08, M.oak, b.x + dx, 0.42, b.z + dz);
  box(1.9, 0.06, 0.06, M.oak, b.x, 0.2, b.z + 0.3);
  box(1.9, 0.03, 0.6, M.oak, b.x, 0.22, b.z);
  box(0.24, 0.12, 0.08, M.steel, b.x - 0.8, 0.86, b.z + 0.41);
  cyl(0.01, 0.01, 0.3, M.steel, b.x - 0.8, 0.84, b.z + 0.48, { rz: Math.PI / 2 });
  // a label on the bench apron
  plane(0.6, 0.19, new THREE.MeshStandardMaterial({ map: labelTex("WORKBENCH", "set a log here"), roughness: 0.8 }), b.x + 0.4, 0.78, b.z + 0.381);
  // pegboard with tools
  box(1.8, 0.9, 0.03, M.pegboard, b.x, 1.65, -HZ + 0.03, { cast: false });
  box(0.04, 0.32, 0.02, M.maple, b.x - 0.6, 1.68, -HZ + 0.07);           // hammer handle
  box(0.12, 0.05, 0.04, M.steel, b.x - 0.6, 1.85, -HZ + 0.07);
  box(0.5, 0.12, 0.01, M.steel, b.x - 0.1, 1.75, -HZ + 0.06);             // saw blade
  box(0.12, 0.14, 0.04, M.maple, b.x + 0.18, 1.75, -HZ + 0.07);
  for (let i = 0; i < 4; i++) cyl(0.012, 0.012, 0.24, M.black, b.x + 0.45 + i * 0.07, 1.6, -HZ + 0.07);  // chisels
  cyl(0.06, 0.06, 0.12, M.steel, b.x + 0.75, 1.8, -HZ + 0.08, { rx: Math.PI / 2 });

  // shelving on the side wall with tins and boxes
  const sx = HX - 0.22, sz = 2.4;
  for (const dz of [-0.6, 0.6]) box(0.36, 1.8, 0.04, M.steel, sx, 0.9, sz + dz);
  for (let i = 0; i < 4; i++) box(0.38, 0.03, 1.22, M.walnut, sx, 0.2 + i * 0.5, sz);
  const r = rnd(19);
  for (let i = 0; i < 4; i++) for (let k = 0; k < 4; k++) {
    if (r() < 0.25) continue;
    const z = sz - 0.45 + k * 0.3;
    if (r() < 0.5) cyl(0.07, 0.07, 0.16, new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(r(), 0.3, 0.4), roughness: 0.4, metalness: 0.5 }), sx, 0.3 + i * 0.5, z);
    else box(0.26, 0.18, 0.22, new THREE.MeshStandardMaterial({ color: 0xa88a62, roughness: 0.9 }), sx, 0.31 + i * 0.5, z);
  }
  solids.push([sx - 0.25, sz - 0.68, HX, sz + 0.68]);

  // a stool and a saw horse
  cyl(0.18, 0.18, 0.05, M.maple, 3.6, 0.65, -2.4);
  for (let i = 0; i < 3; i++) { const a = i * 2.09; cyl(0.018, 0.022, 0.64, M.black, 3.6 + Math.cos(a) * 0.13, 0.32, -2.4 + Math.sin(a) * 0.13); }
  box(1.0, 0.08, 0.08, M.oak, 2.2, 0.68, -2.9, { solid: true });
  for (const dx of [-0.42, 0.42]) for (const s of [-1, 1]) { const l = box(0.05, 0.72, 0.05, M.oak, 2.2 + dx, 0.34, -2.9 + s * 0.12); l.rotation.x = s * 0.25; }

  // a leather armchair by the rug so B is also a place you would sit
  box(0.85, 0.4, 0.8, M.sofa, 2.0, 0.26, 2.9, { round: 0.06, solid: true });
  box(0.85, 0.5, 0.18, M.sofa, 2.0, 0.66, 3.25, { round: 0.06 });
  for (const dx of [-0.4, 0.4]) box(0.14, 0.55, 0.8, M.sofa, 2.0 + dx, 0.32, 2.9, { round: 0.05 });
}

/* lights: daylight through the back windows + a pendant per side */
function buildLights() {
  scene.add(new THREE.HemisphereLight(0xfff2dc, 0x4a3828, 0.55));
  const sun = new THREE.DirectionalLight(0xfff0d8, 1.4);
  sun.position.set(-1.5, 6, -9); sun.target.position.set(0, 0, 1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 6, bottom: -6, near: 1, far: 20 });
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);

  // page A: warm fabric pendant over the coffee table
  cyl(0.004, 0.004, 0.9, M.black, -3.0, H - 0.45, 1.7, { cast: false });
  cyl(0.18, 0.3, 0.26, M.shadeA, -3.0, H - 1.0, 1.7, { cast: false, seg: 28 });
  const la = new THREE.PointLight(0xffb873, 9, 9, 1.6); la.position.set(-3.0, H - 1.12, 1.7); scene.add(la);
  const lamp = new THREE.PointLight(0xffc68a, 3, 5, 1.8); lamp.position.set(-1.6, 1.55, 3.3); scene.add(lamp);
  // page B: green enamel work light over the bench, a touch cooler
  cyl(0.004, 0.004, 1.1, M.black, BENCH.x, H - 0.55, BENCH.z + 0.1, { cast: false });
  cyl(0.05, 0.28, 0.2, M.shadeB, BENCH.x, H - 1.18, BENCH.z + 0.1, { cast: false, seg: 28 });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), M.bulb); bulb.position.set(BENCH.x, H - 1.28, BENCH.z + 0.1); scene.add(bulb);
  const lb = new THREE.PointLight(0xffe2bf, 10, 8, 1.6); lb.position.set(BENCH.x, H - 1.32, BENCH.z + 0.1); scene.add(lb);
  const fillB = new THREE.PointLight(0xe8eef5, 3.5, 9, 1.6); fillB.position.set(3.2, 2.3, 1.6); scene.add(fillB);
}

buildShell(); buildSideA(); buildSideB(); buildLights();

/* ---------------------------------------------------------- the object - */
/* One object with one id. Its state is plain JSON so it can move between
   pages, browsers and (later) a server unchanged. */
/* Asset ID per decisions/3D-STANDARDS.md ("every asset has an ID"), in the
   readable spatial style Ashgrove uses (B07-L1-R03-F02):
     SR1   - the world: Seam Room #1
     A     - the page it was born on
     LOG   - what it was at birth (it keeps this ID when it becomes a chair)
     0001  - serial; "reset room" makes the next one
   Stable, not random: every browser that opens the room fresh agrees on
   SR1-A-LOG-0001, so two visitors never hold two different "first logs". */
function assetId(serial) { return `SR1-A-LOG-${String(serial).padStart(4, "0")}`; }
function freshAsset(rev, serial) {
  return {
    id: assetId(serial || 1), serial: serial || 1, kind: "log", born: "a", visited: ["a"],
    changes: [{ what: "cut on A", at: Date.now() }],
    holder: null, holderName: "", x: BLOCK.x, z: BLOCK.z, onBlock: true,
    rev: rev || 0, updatedAt: Date.now(),
  };
}
function loadAsset() {
  try {
    const id = localStorage.getItem(CURRENT_KEY);
    if (id) {
      const s = JSON.parse(localStorage.getItem(ASSET_KEY + id) || "null");
      if (s && s.id) { s.holder = null; s.holderName = ""; return s; }   // a reload drops it where it was
    }
  } catch (_) {}
  return freshAsset(0);
}
function saveAsset() {
  try {
    localStorage.setItem(ASSET_KEY + asset.id, JSON.stringify(asset));
    localStorage.setItem(CURRENT_KEY, asset.id);
  } catch (_) {}
}
function newer(a, b) {
  if (!b) return true;
  if (a.rev !== b.rev) return a.rev > b.rev;
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt;
  return String(a.id) > String(b.id);
}
let asset = loadAsset();
saveAsset();
const tag = () => `${asset.kind} #${asset.id}`;

function commit(note) {          // local change -> rev up, save, tell everyone
  asset.rev += 1; asset.updatedAt = Date.now();
  saveAsset();
  if (shell) shell.send("asset", { state: asset });
  if (note) seamLog(note);
  rebuildAssetMesh(); renderCard();
}

/* meshes for each form of the object */
function makeLog() {
  const g = new THREE.Group();
  const body = cyl(0.11, 0.115, 0.72, M.bark, 0, 0, 0, { rz: Math.PI / 2, parent: g, seg: 16 });
  for (const s of [-1, 1]) {
    const cap = new THREE.Mesh(new THREE.CircleGeometry(0.108, 18), M.endGrain);
    cap.position.x = s * 0.361; cap.rotation.y = s * Math.PI / 2; g.add(cap);
  }
  body.userData.asset = true;
  g.userData.lift = 0.115;
  return g;
}
function makeChair() {
  const g = new THREE.Group(), m = M.maple;
  box(0.42, 0.04, 0.4, m, 0, 0.45, 0, { parent: g, round: 0.01 });
  for (const dx of [-0.18, 0.18]) for (const dz of [-0.17, 0.17]) box(0.04, 0.45, 0.04, m, dx, 0.225, dz, { parent: g });
  for (const dx of [-0.18, 0.18]) box(0.04, 0.48, 0.04, m, dx, 0.71, -0.17, { parent: g });
  box(0.4, 0.08, 0.03, m, 0, 0.9, -0.17, { parent: g });
  for (const dx of [-0.09, 0, 0.09]) box(0.025, 0.36, 0.02, m, dx, 0.67, -0.17, { parent: g });
  box(0.36, 0.025, 0.025, m, 0, 0.12, 0.17, { parent: g });
  g.userData.lift = 0;
  return g;
}
let assetMesh = null;
const assetHalo = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.47, 40), new THREE.MeshBasicMaterial({ color: 0xffd38a, transparent: true, opacity: 0.0, depthWrite: false }));
assetHalo.rotation.x = -Math.PI / 2; scene.add(assetHalo);
function rebuildAssetMesh() {
  if (assetMesh && assetMesh.userData.kind === asset.kind) return;
  if (assetMesh) scene.remove(assetMesh);
  assetMesh = asset.kind === "chair" ? makeChair() : makeLog();
  assetMesh.userData.kind = asset.kind;
  assetMesh.traverse((o) => { if (o.isMesh) { o.userData.asset = true; o.castShadow = true; } });
  scene.add(assetMesh);
}
rebuildAssetMesh();

function zoneAt(x) { return x < 0 ? "a" : "b"; }

/* the object crossed the seam because its carrier did */
function onAssetCrossed(fromId, toId, how) {
  if (!shell || asset.holder !== shell.selfKey) return;
  asset.visited.push(toId);
  asset.changes.push({ what: `crossed ${NAMES[fromId]}→${NAMES[toId]}${how === "popstate" ? " (back button)" : ""}`, at: Date.now() });
  commit(`${tag()} crossed ${NAMES[fromId]}→${NAMES[toId]}`);
}

function nearAsset() { return Math.hypot(player.x - asset.x, player.z - asset.z) < 1.35; }
function nearBench() { return Math.hypot(player.x - BENCH.x, player.z - (BENCH.z + 0.4)) < 1.5; }
function holderPresent() {
  if (!asset.holder || !shell) return false;
  if (asset.holder === shell.selfKey) return true;
  return lastPeers.some((p) => p.id === asset.holder);
}
function iHold() { return shell && asset.holder === shell.selfKey; }

function useAction() {
  if (!shell) return;
  if (iHold()) {
    // put it down; on the bench, a log becomes a chair, same id
    const f = facing();
    if (asset.kind === "log" && nearBench()) {
      asset.kind = "chair";
      asset.holder = null; asset.holderName = ""; asset.onBlock = false;
      asset.x = BENCH.x - 0.3; asset.z = BENCH.z + 0.85;
      asset.changes.push({ what: "shaped into chair on B", at: Date.now() });
      commit(`log #${asset.id} shaped into chair`);
      return;
    }
    asset.holder = null; asset.holderName = ""; asset.onBlock = false;
    const p = clampToRoom(player.x + f.x * 0.6, player.z + f.z * 0.6, 0.35);
    asset.x = p.x; asset.z = p.z;
    asset.changes.push({ what: `set down on ${NAMES[zoneAt(asset.x)]}`, at: Date.now() });
    commit(`${tag()} set down on page ${NAMES[zoneAt(asset.x)]}`);
    return;
  }
  if (nearAsset() && !holderPresent()) {
    asset.holder = shell.selfKey; asset.holderName = shell.displayName; asset.onBlock = false;
    asset.changes.push({ what: `picked up on ${NAMES[zoneId]}`, at: Date.now() });
    commit(`${tag()} picked up on page ${NAMES[zoneId]}`);
  }
}

function resetRoom() {
  asset = freshAsset(asset.rev + 1, (asset.serial || 1) + 1);
  asset.updatedAt = Date.now();
  saveAsset();
  if (shell) shell.send("asset", { state: asset });
  rebuildAssetMesh(); renderCard();
  seamLog(`room reset - new log #${asset.id} on A`);
}

/* ---------------------------------------------------------- the card - */
let cardOpen = false;
function renderCard() {
  const c = $("card");
  if (!c || !cardOpen) return;
  const pages = asset.visited.map((v) => NAMES[v]).join(" → ");
  const changes = asset.changes.slice(-8).map((ch) => `<li>${esc(ch.what)} <span>${new Date(ch.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></li>`).join("");
  const holder = asset.holder ? (iHold() ? "you" : (asset.holderName || "someone")) : "nobody";
  let act = "";
  if (iHold()) act = asset.kind === "log" && nearBench() ? "Shape it on the bench" : "Put it down";
  else if (nearAsset() && !holderPresent()) act = "Pick it up";
  c.innerHTML = `
    <div class="card-head"><b>${esc(asset.kind === "chair" ? "Chair" : "Log")} #${esc(asset.id)}</b><button type="button" data-x>×</button></div>
    <dl>
      <dt>id</dt><dd>${esc(asset.id)}</dd>
      <dt>born on</dt><dd>page ${esc(NAMES[asset.born])}</dd>
      <dt>pages</dt><dd>${esc(pages)}</dd>
      <dt>now on</dt><dd>page ${esc(NAMES[zoneAt(asset.x)])} · x ${asset.x.toFixed(1)}, z ${asset.z.toFixed(1)} m</dd>
      <dt>held by</dt><dd>${esc(holder)}</dd>
    </dl>
    <div class="card-sub">Changes</div><ol>${changes}</ol>
    ${act ? `<button type="button" class="card-act" data-act>${act}</button>` : `<div class="card-note">Walk up to it to pick it up.</div>`}`;
  c.querySelector("[data-x]").onclick = () => { cardOpen = false; c.classList.remove("on"); };
  const a = c.querySelector("[data-act]");
  if (a) a.onclick = () => { useAction(); renderCard(); };
}
function openCard() { cardOpen = true; $("card").classList.add("on"); renderCard(); }
for (const ev of ["pointerdown", "touchstart"]) $("card").addEventListener(ev, (e) => e.stopPropagation(), { passive: true });

/* ------------------------------------------------------------ people - */
let template = null, clips = {};
const loader = new GLTFLoader();
const selfAv = { group: new THREE.Group(), mixer: null, walk: null, idle: null };
scene.add(selfAv.group);
const fallbackMat = new THREE.MeshStandardMaterial({ color: 0x7a8a99, roughness: 0.8 });

function makeAvatar(holder) {
  if (template) {
    const body = SkeletonUtils.clone(template);
    holder.group.add(body);
    holder.mixer = new THREE.AnimationMixer(body);
    holder.walk = holder.mixer.clipAction(clips.walk); holder.idle = holder.mixer.clipAction(clips.idle);
    holder.walk.play(); holder.idle.play(); holder.walk.setEffectiveWeight(0); holder.idle.setEffectiveWeight(1);
  } else {
    // placeholder until the person model arrives
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 1.3, 4, 12), fallbackMat);
    m.position.y = 0.85; m.castShadow = true; m.userData.placeholder = true;
    holder.group.add(m);
  }
}
function animate(holder, speed, dt) {
  if (!holder.mixer) return;
  const w = Math.min(1, speed / 0.6);
  holder.walk.setEffectiveWeight(w); holder.idle.setEffectiveWeight(1 - w);
  holder.walk.timeScale = Math.max(0.6, speed / 1.0);
  holder.mixer.update(dt);
}
function upgradeAvatar(holder) {
  if (holder.mixer || !template) return;
  holder.group.children.filter((c) => c.userData.placeholder).forEach((c) => holder.group.remove(c));
  makeAvatar(holder);
}
makeAvatar(selfAv);

loader.load("/lab/bedroom/person.glb", (gltf) => {
  const p = gltf.scene;
  p.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; if (o.material) o.material.roughness = 0.85; } });
  const bb = new THREE.Box3().setFromObject(p), h = bb.max.y - bb.min.y;
  if (h > 0.1) p.scale.multiplyScalar(1.76 / h);
  p.position.y = -bb.min.y * (1.76 / h);
  template = new THREE.Group(); template.add(p);
  for (const c of gltf.animations) clips[c.name] = c;
  if (!clips.walk) clips.walk = gltf.animations[0];
  if (!clips.idle) clips.idle = gltf.animations[1] || gltf.animations[0];
  upgradeAvatar(selfAv);
  for (const e of peerAv.values()) upgradeAvatar(e);
}, undefined, (err) => console.warn("seam-room: person model did not load", err));

const peerAv = new Map();
let lastPeers = [];
function nameSprite(text, color) {
  const c = document.createElement("canvas"); c.width = 320; c.height = 64;
  const g = c.getContext("2d");
  g.fillStyle = "rgba(20,16,12,.72)"; g.beginPath(); g.roundRect(4, 8, 312, 48, 24); g.fill();
  g.fillStyle = color || "#8fd0ff"; g.beginPath(); g.arc(32, 32, 9, 0, 7); g.fill();
  g.fillStyle = "#f3ead8"; g.font = "600 26px system-ui, sans-serif"; g.textBaseline = "middle"; g.fillText(text, 52, 33);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(0.9, 0.18, 1); s.position.y = 2.0; s.renderOrder = 10;
  return s;
}
function syncPeers(list, dt) {
  lastPeers = list;
  const live = new Set();
  for (const p of list) {
    live.add(p.id);
    let e = peerAv.get(p.id);
    if (!e) {
      e = { group: new THREE.Group(), mixer: null, px: p.x, pz: p.z, speed: 0, label: "" };
      makeAvatar(e); scene.add(e.group); peerAv.set(p.id, e);
    }
    const label = `${p.name || "Guest"} · on ${NAMES[p.place] || "?"}`;
    if (label !== e.label) {
      if (e.sprite) e.group.remove(e.sprite);
      e.sprite = nameSprite(label, p.color); e.group.add(e.sprite); e.label = label;
    }
    const v = dt > 0 ? Math.hypot(p.x - e.px, p.z - e.pz) / dt : 0;
    e.speed += (Math.min(v, 4) - e.speed) * 0.2;
    e.px = p.x; e.pz = p.z; e.yaw = p.yaw; e.place = p.place;
    e.group.position.set(p.x, 0, p.z); e.group.rotation.y = p.yaw || 0;
    animate(e, e.speed, dt);
  }
  for (const [id, e] of peerAv) if (!live.has(id)) { scene.remove(e.group); peerAv.delete(id); }
  updateCounter();
}

let counterSig = "";
function updateCounter() {
  const n = { a: zoneId === "a" ? 1 : 0, b: zoneId === "b" ? 1 : 0 };
  for (const p of lastPeers) if (n[p.place] !== undefined) n[p.place] += 1;
  const sig = `${zoneId}|${n.a}|${n.b}`;
  if (sig === counterSig) return;
  counterSig = sig;
  const el = $("counter");
  if (el) el.innerHTML = `You: <b>page ${NAMES[zoneId]}</b> · On A: ${n.a} · On B: ${n.b}`;
  window.__seamCount = n;
}

/* ------------------------------------------------------------- shell - */
function facing() { return { x: Math.sin(player.body), z: Math.cos(player.body) }; }

shell = window.HBShell.mount({
  world: "seam-room",
  worldLabel: "Seam Room",
  gateUrl: "/",
  getState() {
    return { x: player.x, y: 0, z: player.z, yaw: player.body, pitch: 0, stance: player.speed > 2.2 ? "run" : "stand", place: zoneId };
  },
  onPeers() { /* sampled in the loop via shell.frame -> syncPeers */ },
  onMove({ x, y }) { player.mx = x; player.my = y; },
  onLook(dx, dy) {
    const k = 0.0042 * (shell.settings.sensitivity || 1), inv = shell.settings.invertY ? -1 : 1;
    cam.yaw -= dx * k; cam.pitch = Math.max(-0.35, Math.min(0.75, cam.pitch + dy * k * inv * 0.6));
  },
  onAction(name) { if (name === "use") useAction(); },
  onSettings(s) { camera.fov = s.fov || 70; camera.updateProjectionMatrix(); },
});
// The shell calls onPeers from shell.frame(); route it here with dt.
let frameDt = 0;
shell.opts.onPeers = (list) => syncPeers(list, frameDt);
shell.setPlace("Page " + NAMES[zoneId]);

shell.on("asset", (msg) => {
  const s = msg && msg.state;
  if (!s || !s.id) return;
  if (!newer(s, asset)) return;
  const prev = asset;
  asset = s; saveAsset(); rebuildAssetMesh(); renderCard();
  if (prev.id !== s.id) seamLog(`${s.kind} #${s.id} arrived from the room`);
  else {
    const last = s.changes[s.changes.length - 1];
    if (last && prev.changes.length !== s.changes.length) seamLog(`${s.kind === "chair" && /shaped/.test(last.what) ? "log" : s.kind} #${s.id} ${last.what}`);
  }
});
shell.on("asset-ask", () => { shell.send("asset", { state: asset }); });

let announced = false;
function onConnected() {
  announced = true;
  shell.send("asset-ask", {});
  shell.send("asset", { state: asset });
  seamLog("joined the room channel");
}

addEventListener("pagehide", () => {
  if (iHold()) {
    asset.holder = null; asset.holderName = "";
    asset.changes.push({ what: `set down on ${NAMES[zoneId]} (left)`, at: Date.now() });
    asset.rev += 1; asset.updatedAt = Date.now();
    saveAsset();
    try { shell.send("asset", { state: asset }); } catch (_) {}
  }
});

/* ------------------------------------------------------- keyboard/mouse - */
const keys = {};
addEventListener("keydown", (e) => { if (!e.target.matches || !e.target.matches("input,textarea,select")) keys[e.code] = true; });
addEventListener("keyup", (e) => { keys[e.code] = false; });
addEventListener("blur", () => { for (const k in keys) keys[k] = false; });

let drag = null;
canvas.addEventListener("pointerdown", (e) => {
  drag = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0, mouse: e.pointerType === "mouse" };
});
addEventListener("pointermove", (e) => {
  if (!drag) return;
  drag.moved = Math.max(drag.moved, Math.hypot(e.clientX - drag.x, e.clientY - drag.y));
  if (drag.mouse && e.buttons & 1) {
    cam.yaw -= e.movementX * 0.0042 * (shell.settings.sensitivity || 1);
    cam.pitch = Math.max(-0.35, Math.min(0.75, cam.pitch + e.movementY * 0.0028 * (shell.settings.invertY ? -1 : 1)));
  }
});
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
addEventListener("pointerup", (e) => {
  const d = drag; drag = null;
  if (!d || d.moved > 10 || performance.now() - d.t > 400) return;
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  if (assetMesh && ray.intersectObject(assetMesh, true).length) openCard();
});

$("reset").addEventListener("click", resetRoom);
for (const ev of ["pointerdown", "touchstart"]) $("hudSeam").addEventListener(ev, (e) => { if (e.target.closest("button,a")) e.stopPropagation(); }, { passive: true });

/* --------------------------------------------------------------- move - */
function clampToRoom(x, z, r) {
  return { x: Math.max(-HX + r, Math.min(HX - r, x)), z: Math.max(-HZ + r, Math.min(HZ - r, z)) };
}
function collide(x, z, r) {
  let p = clampToRoom(x, z, r);
  for (const [a, b, c, d] of solids) {
    const nx = Math.max(a, Math.min(c, p.x)), nz = Math.max(b, Math.min(d, p.z));
    const dx = p.x - nx, dz = p.z - nz, dd = Math.hypot(dx, dz);
    if (dd < r) {
      if (dd > 1e-4) { p.x = nx + (dx / dd) * r; p.z = nz + (dz / dd) * r; }
      else {  // centre inside the box: push out the shortest way
        const opts = [[a - r, p.z], [c + r, p.z], [p.x, b - r], [p.x, d + r]];
        opts.sort((u, v) => Math.hypot(u[0] - p.x, u[1] - p.z) - Math.hypot(v[0] - p.x, v[1] - p.z));
        p.x = opts[0][0]; p.z = opts[0][1];
      }
    }
  }
  return clampToRoom(p.x, p.z, r);
}

function step(dt) {
  let ix = player.mx, iy = player.my;
  if (keys.KeyW || keys.ArrowUp) iy -= 1;
  if (keys.KeyS || keys.ArrowDown) iy += 1;
  if (keys.KeyA || keys.ArrowLeft) ix -= 1;
  if (keys.KeyD || keys.ArrowRight) ix += 1;
  const len = Math.hypot(ix, iy);
  if (len > 1) { ix /= len; iy /= len; }
  const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
  const mx = fx * -iy + rx * ix, mz = fz * -iy + rz * ix;
  const run = keys.ShiftLeft || keys.ShiftRight || Math.hypot(player.mx, player.my) > 0.95;
  const target = Math.min(1, Math.hypot(mx, mz)) * (run ? 2.9 : 1.5);
  player.speed += (target - player.speed) * Math.min(1, dt * 8);
  if (Math.hypot(mx, mz) > 0.05) {
    const want = Math.atan2(mx, mz);
    let d = want - player.body; d = Math.atan2(Math.sin(d), Math.cos(d));
    player.body += d * Math.min(1, dt * 10);
    const n = Math.hypot(mx, mz);
    const p = collide(player.x + (mx / n) * player.speed * dt, player.z + (mz / n) * player.speed * dt, 0.28);
    player.x = p.x; player.z = p.z;
  }
  seam.update(player.x, player.z);
}

/* where the object is drawn: on its spot, or in the hands of whoever holds it */
function placeAsset(t) {
  if (!assetMesh) return;
  let x = asset.x, z = asset.z, y = assetMesh.userData.lift, yaw = 0, held = false;
  if (asset.onBlock && asset.kind === "log") y = 0.45 + 0.115;
  if (asset.holder) {
    let hx = null, hz = null, hy = 0;
    if (iHold()) { hx = player.x; hz = player.z; hy = player.body; }
    else { const p = lastPeers.find((q) => q.id === asset.holder); if (p) { hx = p.x; hz = p.z; hy = p.yaw; } }
    if (hx !== null) {
      held = true;
      x = hx + Math.sin(hy) * 0.38; z = hz + Math.cos(hy) * 0.38; yaw = hy;
      y = asset.kind === "chair" ? 0.55 : 1.02;
      if (iHold()) { asset.x = x; asset.z = z; }
    }
  }
  assetMesh.position.set(x, y, z);
  assetMesh.rotation.y = yaw;
  // a soft halo when you can act on it
  const canUse = !held && nearAsset() && !holderPresent();
  assetHalo.position.set(x, 0.01, z);
  assetHalo.material.opacity += ((canUse ? 0.55 + Math.sin(t * 4) * 0.15 : 0) - assetHalo.material.opacity) * 0.15;
}

let promptText = "";
function updatePrompt() {
  let text = "";
  if (iHold()) text = asset.kind === "log" && nearBench() ? `Shape log #${asset.id} on the bench` : `Put down ${tag()}`;
  else if (nearAsset() && !holderPresent()) text = `Pick up ${tag()}`;
  if (text === promptText) return;
  promptText = text;
  shell.setPrompt(text ? (shell.isTouch ? text : `${text}  (E)`) : "");
  const btn = document.querySelector(".hbs-act.go");          // shell's use button says "Enter"; say what it does here
  if (btn) btn.textContent = !text ? "Use" : iHold() ? (/Shape/.test(text) ? "Shape" : "Drop") : "Pick up";
}

/* ------------------------------------------------------------- camera - */
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
function placeCamera(dt) {
  const dist = 2.9, h = 1.55;
  const cx = player.x + Math.sin(cam.yaw) * dist * Math.cos(cam.pitch);
  const cz = player.z + Math.cos(cam.yaw) * dist * Math.cos(cam.pitch);
  const cy = h + Math.sin(cam.pitch) * dist;
  const c = clampToRoom(cx, cz, 0.18);
  camPos.set(c.x, Math.max(0.4, Math.min(H - 0.15, cy)), c.z);
  camera.position.lerp(camPos, Math.min(1, dt * 12));
  camLook.set(player.x, 1.35, player.z);
  camera.lookAt(camLook);
}

/* --------------------------------------------------------------- loop - */
const clock = new THREE.Clock();
let t = 0;
const startZone = seam.start();
zoneId = startZone.id;
camera.position.set(player.x + Math.sin(cam.yaw) * 2.9, 1.9, player.z + Math.cos(cam.yaw) * 2.9);

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05); t += dt; frameDt = dt;
  step(dt);
  selfAv.group.position.set(player.x, 0, player.z);
  selfAv.group.rotation.y = player.body;
  animate(selfAv, player.speed, dt);
  shell.frame(dt);
  if (!announced && shell.connected) onConnected();
  placeAsset(t);
  updatePrompt();
  placeCamera(dt);
  renderer.render(scene, camera);
});

const loading = $("loading"); if (loading) setTimeout(() => loading.classList.add("off"), 250);

/* test handle: read state without reaching into closures */
window.__seam = {
  seam, player, cam, get asset() { return asset; }, get zone() { return zoneId; }, get peers() { return lastPeers; },
  shell: () => shell, use: useAction, reset: resetRoom, openCard,
  teleport(x, z) { player.x = x; player.z = z; },
};
