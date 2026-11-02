/* ============================================================================
   room.js - The Seam Room
   ---------------------------------------------------------------------------
   One room, two real pages. x < 0 is /lab/seam-room/a/, x >= 0 is
   /lab/seam-room/b/; behind B's walnut door is the garage (/c/, garage.js),
   behind A's oak door the media room (/d/, den.js), behind B's back door the
   kitchen (/e/, kitchen.js). Every page loads this
   file; the URL decides where you spawn. seam.js flips the URL as you walk. The shell (HBShell) carries the
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
import { Seam } from "/lab/seam-room/seam.js?v=3";
/* Zone scenes (garage.js, den.js, kitchen.js, ...) are NOT imported here: zones.json names each zone's "module" and
   room.js import()s it, at load and again later when a new zone appears in zones.json (the hot-load, see "new rooms
   without a reload" near the end). */

const $ = (id) => document.getElementById(id);
const W = 12, D = 8, H = 2.9;               // room size, metres. Seam at x = 0.
const HX = W / 2, HZ = D / 2;
const BENCH = { x: 4.55, z: -3.25 };        // the workbench on page B
const BLOCK = { x: -4.7, z: -2.4 };         // the chopping block on page A
const PASS_B = { x0: 1.95, x1: 3.25, y0: 0.945, y1: 2.295 };   // B's back window, a real hole into the kitchen (kitchen.js)
const ASSET_KEY = "seam-room:asset:";       // + id
const CURRENT_KEY = "seam-room:current";
/* zones are data (zones.json): add a zone there and the room, the URL switching and the AI character all know it */
const ZONES_URL = "/lab/seam-room/zones.json";
let zonesText = "";   // the zones.json text last applied; the hot-load poll compares against it
const ZDATA = await fetch(ZONES_URL + "?v=" + Date.now(), { cache: "no-store" }).then((r) => r.text()).then((t) => { const d = JSON.parse(t); zonesText = t; return d; }).catch(() => ({
  hysteresis: 0.3, fallback: "a",
  zones: [
    { id: "a", label: "A", url: "/lab/seam-room/a/", title: "Seam Room · Page A - Heartbeat Observatory", bounds: { maxX: 0, minZ: -4, maxZ: 4 }, spawn: { x: -3.6, z: 1.2, yaw: -Math.PI / 2 } },
    { id: "b", label: "B", url: "/lab/seam-room/b/", title: "Seam Room · Page B - Heartbeat Observatory", bounds: { minX: 0, minZ: -4, maxZ: 4 }, spawn: { x: 3.6, z: 1.2, yaw: Math.PI / 2 } },
    { id: "c", label: "C", name: "Garage", module: "garage.js", url: "/lab/seam-room/c/", title: "Seam Room · Garage (Page C) - Heartbeat Observatory", bounds: { minX: 2, maxX: 8.6, minZ: 4, maxZ: 10.5 }, spawn: { x: 3.9, z: 6.6, yaw: Math.PI } },
    { id: "d", label: "D", name: "Media Room", module: "den.js", v: 2, url: "/lab/seam-room/d/", title: "Seam Room · Media Room (Page D) - Heartbeat Observatory", bounds: { minX: -8.4, maxX: -2, minZ: 4, maxZ: 9.7 }, spawn: { x: -4.3, z: 6.1, yaw: Math.PI } },
    { id: "e", label: "E", name: "Kitchen", module: "kitchen.js", url: "/lab/seam-room/e/", title: "Seam Room · Kitchen (Page E) - Heartbeat Observatory", bounds: { minX: 0, maxX: 6.5, minZ: -10.5, maxZ: -4 }, spawn: { x: 2.0, z: -6.3, yaw: -0.6 } },
  ],
  doors: [{ id: "middle", between: ["a", "b"], plane: { x: 0, minZ: -4, maxZ: 4 } }, { id: "b-c", between: ["b", "c"], kind: "door", name: "B's door", plane: { z: 4, minX: 4.14, maxX: 5.06 } },
    { id: "a-d", between: ["a", "d"], kind: "door", name: "A's door", plane: { z: 4, minX: -5.06, maxX: -4.14 } }, { id: "b-e", between: ["b", "e"], kind: "door", name: "B's back door", plane: { z: -4, minX: 0.54, maxX: 1.46 } }],
  walk: [
    { id: "room", minX: -6, maxX: 6, minZ: -4, maxZ: 4, h: 2.9 },
    { id: "garage", minX: 2.15, maxX: 8.45, minZ: 4.15, maxZ: 10.35, h: 2.8 },
    { id: "door-b-c", door: "b-c", minX: 4.14, maxX: 5.06, minZ: 3.1, maxZ: 5.05, h: 2.05, shrink: "x" },
    { id: "den", minX: -8.25, maxX: -2.15, minZ: 4.15, maxZ: 9.55, h: 2.75 },
    { id: "door-a-d", door: "a-d", minX: -5.06, maxX: -4.14, minZ: 3.1, maxZ: 5.05, h: 2.05, shrink: "x" },
    { id: "kitchen", minX: 0.15, maxX: 6.15, minZ: -10.15, maxZ: -4.15, h: 2.8 },
    { id: "door-b-e", door: "b-e", minX: 0.54, maxX: 1.46, minZ: -5.05, maxZ: -3.1, h: 2.05, shrink: "x" },
  ],
}));
/* the floor you can stand on: rectangles from zones.json. A rectangle with `door` is a doorway, open only while that door is. */
const WALK = ZDATA.walk || [{ id: "room", minX: -HX, maxX: HX, minZ: -HZ, maxZ: HZ, h: H }];
/* the real doors, from zones.json: every door with "kind": "door" and a z or x plane (front wall "b-c" to the garage,
   "a-d" to the media room; back wall "b-e" to the kitchen). Each leaf hangs on a hinge at its low edge (minX, or minZ
   for an x-plane door) and swings away from the room it is seen from (out = +1 toward +z/+x, -1 toward -z/-x; by
   default away from the middle of the room, "swing" in zones.json overrides). amt 0 = shut, 1 = open. A new door is
   one entry there, and it can arrive while the room runs (doorFromData + makeDoor, used by the hot-load).
   A door whose kind says "future" is decoration: a closed "coming soon" leaf on a solid wall, no hole, no walk. */
const isRealDoor = (d) => !!(d && d.kind === "door" && d.plane && (d.plane.z != null || d.plane.x != null));
const isFutureDoor = (d) => !!(d && /future/i.test(d.kind || "") && d.plane && (d.plane.z != null || d.plane.x != null));
function doorFromData(d) {
  const p = d.plane, ax = p.z != null ? "z" : "x";
  const u0 = ax === "z" ? p.minX : p.minZ, u1 = ax === "z" ? p.maxX : p.maxZ, c = ax === "z" ? p.z : p.x;
  const out = d.swing === 1 || d.swing === -1 ? d.swing : (c < 0 ? -1 : 1);
  const cx = (u0 + u1) / 2;
  return { id: d.id, name: d.name || `door ${d.id}`, ax, x0: u0, x1: u1, cx, z: c, c, out,
    lo: ax === "z" ? out : -out,                           // the swing in the door frame's own axes (local +z)
    px: ax === "z" ? cx : c + 0.07 * out, pz: ax === "z" ? c + 0.07 * out : cx,   // the "near the door" centre
    h: d.h || 2.05, hinge: u0 + 0.03, wood: d.wood, data: d,
    leaf: null, frame: null, amt: 0, open: false, tapUntil: 0, remote: new Map(), meNear: false, ping: 0 };
}
let DOORDATA = ZDATA.doors || [];
const DOORS = Object.fromEntries(DOORDATA.filter(isRealDoor).map((d) => [d.id, doorFromData(d)]));
const DOORWAY = DOORS["b-c"];
const door = DOORS["b-c"];   // kept for the garage tests / old handles
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
function doorPassable(id) { const d = DOORS[id]; return !d || d.amt > 0.3; }
/* a doorway shrinks only across its door: "shrink": "x" for a door in a z wall, "z" for a door in an x wall */
function rectClamp(w, x, z, r) {
  const sz = w.shrink === "x" ? 0 : r, sx = w.shrink === "z" ? 0 : r;
  return { x: clampN(x, w.minX + sx, w.maxX - sx), z: clampN(z, w.minZ + sz, w.maxZ - sz) };
}
/* nearest point that is on the floor (any walk rectangle, shrunk by radius r) */
function clampWalk(x, z, r, anyDoor) {
  let best = null, bd = Infinity;
  for (const w of WALK) {
    if (w.door && !anyDoor && !doorPassable(w.door)) continue;
    const p = rectClamp(w, x, z, r), d = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}
/* furniture the camera must not enter (tall kitchen pieces): [minX, minZ, maxX, maxZ, minY, maxY] */
const CAM_BLOCKS = [];
/* is this point of air inside the world (for the camera)? */
function airFree(x, y, z, m) {
  for (const b of CAM_BLOCKS) if (x > b[0] - m && x < b[2] + m && z > b[1] - m && z < b[3] + m && y > b[4] - m && y < b[5] + m) return false;
  for (const w of WALK) {
    if (w.door && !doorPassable(w.door)) continue;
    const sz = w.shrink === "x" ? 0 : m, sx = w.shrink === "z" ? 0 : m;
    if (x > w.minX + sx && x < w.maxX - sx && z > w.minZ + sz && z < w.maxZ - sz && y > 0.25 && y < (w.h || H) - m) return true;
  }
  return false;
}
const NAMES = Object.fromEntries(ZDATA.zones.map((z) => [z.id, z.label || z.id.toUpperCase()]));
/* "Kitchen" for the seam log: zones.json "name", else the word before "(Page E)" in the title */
function roomName(z) { const m = /·\s*([^(·]+?)\s*\(Page/i.exec(z.title || ""); return z.name || (m && m[1]) || `page ${z.label || z.id.toUpperCase()}`; }

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
const SEAMCFG = Seam.fromData(ZDATA);
const ZONES = SEAMCFG.zones;
const SPAWN = Object.fromEntries(ZONES.map((z) => [z.id, z.spawn || { x: 0, z: 0, yaw: 0 }]));

const player = { x: 0, z: 0, yaw: 0, body: 0, speed: 0, mx: 0, my: 0, run: false };
const cam = { yaw: 0, pitch: 0.18 };
let zoneId = "a";
let shell = null;

const seam = Seam.define({
  zones: ZONES,
  hysteresis: SEAMCFG.hysteresis,
  fallback: (document.documentElement.dataset.zone || SEAMCFG.fallback),
  onEnter(zone, from, info) {
    zoneId = zone.id;
    if (info.how === "load") {
      const s = SPAWN[zone.id];
      player.x = s.x; player.z = s.z; cam.yaw = s.yaw; player.body = Math.atan2(-Math.sin(s.yaw), -Math.cos(s.yaw));
      seamLog(`spawned on page ${NAMES[zone.id]} (from URL)`);
    } else if (info.how === "popstate") {
      // Back/Forward: put the walker just across the line, on the new side
      // put the walker just across the door between the two pages (or at the spawn if there is none)
      const dr = from && (SEAMCFG.doors || []).find((d) => d.between && d.between.includes(from.id) && d.between.includes(zone.id));
      const sp = SPAWN[zone.id];
      if (dr && dr.plane && dr.plane.x != null) {
        player.x = dr.plane.x + (zone.contains(dr.plane.x - 0.7, player.z) ? -0.7 : 0.7);
        player.z = clampN(player.z, dr.plane.minZ + 0.4, dr.plane.maxZ - 0.4);
      } else if (dr && dr.plane && dr.plane.z != null) {
        player.x = (dr.plane.minX + dr.plane.maxX) / 2;
        player.z = dr.plane.z + (zone.contains(player.x, dr.plane.z - 0.8) ? -0.8 : 0.95);
      } else if (sp) { player.x = sp.x; player.z = sp.z; }
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
const doorLeaf = new THREE.Group();   // B's walnut door; rotation.y = -amt * 90deg swings it into the garage
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

/* ------------------------------------------------- walls with openings - */
/* Each room wall half is one shape with its openings cut out (doors from DOORS, windows from WINDOWS), plus its
   baseboard broken at the doors, all in one group, so a door that arrives later (the hot-load) cuts its opening by
   rebuilding only that wall: buildWall(id). A wall's local +x runs along it from (ox, oz), local +z faces into the
   room; u(x, z) is a world point's distance along it. UVs are those of the whole half (u / len, v / H). */
const WALLS = {
  backA:  { mat: "wallA", len: HX, ox: -HX, oz: -HZ, ry: 0,            u: (x, z) => x + HX },
  backB:  { mat: "wallB", len: HX, ox: 0,   oz: -HZ, ry: 0,            u: (x, z) => x },
  frontA: { mat: "wallA", len: HX, ox: 0,   oz: HZ,  ry: Math.PI,      u: (x, z) => -x },
  frontB: { mat: "wallB", len: HX, ox: HX,  oz: HZ,  ry: Math.PI,      u: (x, z) => HX - x },
  sideA:  { mat: "wallA", len: D,  ox: -HX, oz: HZ,  ry: Math.PI / 2,  u: (x, z) => HZ - z },
  sideB:  { mat: "wallB", len: D,  ox: HX,  oz: -HZ, ry: -Math.PI / 2, u: (x, z) => z + HZ },
};
/* windows in a room wall that look INTO a zone: a real hole while that zone is built, a painted sky until then */
const WINDOWS = [{ wall: "backB", x0: PASS_B.x0, x1: PASS_B.x1, y0: PASS_B.y0, y1: PASS_B.y1, into: "e" }];
/* which room wall is this door in (null = a wall that belongs to a zone module) */
function wallOf(dr) {
  if (dr.ax === "z" && Math.abs(Math.abs(dr.c) - HZ) < 1e-6 && dr.x0 >= -HX && dr.x1 <= HX) return (dr.c < 0 ? "back" : "front") + (dr.cx < 0 ? "A" : "B");
  if (dr.ax === "x" && Math.abs(Math.abs(dr.c) - HX) < 1e-6 && dr.x0 >= -HZ && dr.x1 <= HZ) return dr.c < 0 ? "sideA" : "sideB";
  return null;
}
function doorSpan(w, dr) {   // the door's [u0, u1] along wall w
  const a = dr.ax === "z" ? w.u(dr.x0, dr.c) : w.u(dr.c, dr.x0), b = dr.ax === "z" ? w.u(dr.x1, dr.c) : w.u(dr.c, dr.x1);
  return { u0: Math.min(a, b), u1: Math.max(a, b), h: dr.h };
}
const SHARED_MATS = new Set(Object.values(M));
function disposeTree(root) {   // geometries + this tree's own materials (never the room's shared M.*; textures are left alone)
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    for (const m of o.material ? [].concat(o.material) : []) if (!SHARED_MATS.has(m)) m.dispose();
  });
}
const BUILT = {};   // zone id -> { key, mod, built, group, solids, camBlocks, opened, tv } (filled by buildZone)
function buildWall(id) {
  const w = WALLS[id];
  if (w.group) { scene.remove(w.group); disposeTree(w.group); }
  const g = new THREE.Group(); g.position.set(w.ox, 0, w.oz); g.rotation.y = w.ry; g.name = "wall-" + id; scene.add(g); w.group = g;
  const doors = Object.values(DOORS).filter((d) => wallOf(d) === id).map((d) => doorSpan(w, d)).sort((a, b) => a.u0 - b.u0);
  const sh = new THREE.Shape();
  sh.moveTo(0, 0);
  for (const d of doors) { sh.lineTo(d.u0, 0); sh.lineTo(d.u0, d.h); sh.lineTo(d.u1, d.h); sh.lineTo(d.u1, 0); }
  sh.lineTo(w.len, 0); sh.lineTo(w.len, H); sh.lineTo(0, H); sh.closePath();
  for (const win of WINDOWS.filter((q) => q.wall === id)) {
    const a = w.u(win.x0, w.oz), b = w.u(win.x1, w.oz), u0 = Math.min(a, b), u1 = Math.max(a, b);
    if (BUILT[win.into]) {
      const hole = new THREE.Path(); hole.moveTo(u0, win.y0); hole.lineTo(u1, win.y0); hole.lineTo(u1, win.y1); hole.lineTo(u0, win.y1); hole.closePath();
      sh.holes.push(hole);
    } else plane(u1 - u0, win.y1 - win.y0, M.glass, (u0 + u1) / 2, (win.y0 + win.y1) / 2, 0.005, 0, 0, g);   // painted sky
  }
  const geo = new THREE.ShapeGeometry(sh), pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / w.len, pos.getY(i) / H);
  const m = new THREE.Mesh(geo, M[w.mat]); m.receiveShadow = true; g.add(m);
  // baseboard, broken at the doors
  let u = 0;
  for (const d of doors.concat([{ u0: w.len + 0.06, u1: w.len }])) {
    const e = d.u0 - 0.06;
    if (e - u > 0.02) box(e - u, 0.12, 0.02, M.trim, (u + e) / 2, 0.06, 0.01, { parent: g, cast: false });
    u = d.u1 + 0.06;
  }
}

/* ---------------------------------------------------------------- doors - */
/* a door's frame group: local +x along the wall (world +x, or world +z for an x-plane door), local +z = the side the
   leaf swings to when lo = +1 */
function doorMount(dr) {
  const g = new THREE.Group();
  if (dr.ax === "z") g.position.set(0, 0, dr.c); else { g.position.set(dr.c, 0, 0); g.rotation.y = -Math.PI / 2; }
  g.name = "door-" + dr.id; scene.add(g);
  return g;
}
/* panel doors: A's oak door swings into the media room (D), B's walnut door into the garage (C), B's maple back door
   into the kitchen (E). Any other door gets zones.json "wood" (oak, walnut, maple) or a painted leaf. */
const DOOR_MAT = { "a-d": "oak", "b-c": "walnut", "b-e": "maple" };
function makeDoor(dr) {
  const mat = M[dr.wood || DOOR_MAT[dr.id]] || M.trim, lo = dr.lo, fz = -0.04 * lo;
  const F = doorMount(dr);
  box(1.04, 0.07, 0.07, M.trim, dr.cx, 2.08, fz, { parent: F });
  for (const dx of [-0.49, 0.49]) box(0.07, 2.08, 0.07, M.trim, dr.cx + dx, 1.04, fz, { parent: F });
  // a leaf on a hinge, panels and a knob on both faces
  const leaf = dr.id === "b-c" ? doorLeaf : new THREE.Group();
  leaf.position.set(dr.hinge, 0, -0.025 * lo); F.add(leaf);
  const lw = dr.x1 - 0.01 - dr.hinge;   // 0.88 m
  box(lw, 2.04, 0.045, mat, lw / 2, 1.02, 0, { parent: leaf, cast: false });
  for (const zf of [-1, 1]) {
    for (const y of [0.55, 1.5]) box(lw - 0.3, 0.7, 0.02, mat, lw / 2, y, zf * 0.028, { parent: leaf, cast: false });
    cyl(0.03, 0.03, 0.05, M.brass, lw - 0.1, 1.0, zf * 0.05, { rx: Math.PI / 2, parent: leaf, cast: false });
    cyl(0.04, 0.04, 0.008, M.brass, lw - 0.1, 1.0, zf * 0.026, { rx: Math.PI / 2, parent: leaf, cast: false });
  }
  for (const y of [0.25, 1.0, 1.8]) cyl(0.012, 0.012, 0.1, M.brass, 0, y, -0.03 * lo, { parent: leaf, cast: false });   // hinge knuckles
  dr.leaf = leaf; dr.frame = F;
  return dr;
}
/* a "future" door on a ROOM wall: a closed green panel door with a COMING SOON plaque on solid wall (a tap rattles it).
   The media room draws its own two (den.js). When zones.json turns it into "kind": "door", the hot-load swaps it for
   a real door and cuts the wall. */
const FUTURE = {};   // id -> { id, frame, leaf, rattle }
let futurePaint = null;
function makeFutureDoor(d) {
  const dr = doorFromData(d), lo = dr.lo, F = doorMount(dr), fz = -0.02 * lo;
  futurePaint = futurePaint || new THREE.MeshStandardMaterial({ color: 0x4a5a52, roughness: 0.5 });
  SHARED_MATS.add(futurePaint);
  box(1.04, 0.07, 0.03, M.trim, dr.cx, 2.085, fz, { parent: F, cast: false });
  for (const dx of [-0.495, 0.495]) box(0.07, 2.12, 0.03, M.trim, dr.cx + dx, 1.06, fz, { parent: F, cast: false });
  const leaf = new THREE.Group(); leaf.position.set(dr.hinge, 0, -0.025 * lo); F.add(leaf);
  const lw = dr.x1 - 0.01 - dr.hinge;
  box(lw, 2.04, 0.04, futurePaint, lw / 2, 1.02, 0, { parent: leaf, cast: false });
  for (const y of [0.55, 1.5]) box(lw - 0.3, 0.7, 0.012, futurePaint, lw / 2, y, -0.024 * lo, { parent: leaf, cast: false });
  cyl(0.03, 0.03, 0.05, M.brass, lw - 0.1, 1.0, -0.045 * lo, { rx: Math.PI / 2, parent: leaf, cast: false });
  const tex = canvasTex(320, 120, (g, w, h) => {
    g.fillStyle = "#2c2118"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#b8913f"; g.lineWidth = 4; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = "#e8c98a"; g.textAlign = "center";
    g.font = "700 40px Georgia, serif"; g.fillText("COMING SOON", w / 2, 58);
    g.font = "22px ui-monospace, Menlo, Consolas, monospace"; g.fillStyle = "#cdb88f"; g.fillText(`next page · ${d.id}`, w / 2, 94);
  });
  plane(0.32, 0.12, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }), lw / 2, 1.5, -0.031 * lo, 0, lo > 0 ? Math.PI : 0, leaf);
  FUTURE[d.id] = { id: d.id, frame: F, leaf, rattle: 0 };
}
function removeFutureDoor(id) {
  const f = FUTURE[id]; if (!f) return;
  scene.remove(f.frame); disposeTree(f.frame); delete FUTURE[id];
}
function tickFutureDoors(dt) {
  for (const f of Object.values(FUTURE)) {
    if (f.rattle <= 0) { f.leaf.rotation.y = 0; continue; }
    f.rattle = Math.max(0, f.rattle - dt);
    f.leaf.rotation.y = -Math.sin(f.rattle * 40) * 0.025 * (f.rattle / 0.45);   // locked: it gives a little, then stops
  }
}

function buildShell() {
  // floors (each half its own boards), with a brass threshold on the seam
  plane(HX, D, M.floorA, -HX / 2, 0, 0, -Math.PI / 2);
  plane(HX, D, M.floorB, HX / 2, 0, 0, -Math.PI / 2);
  M.floorA.map.repeat.set(HX / 4, D / 4); M.floorB.map.repeat.set(HX / 4, D / 4);
  box(0.05, 0.008, D, M.brass, 0, 0.004, 0, { cast: false });

  // ceiling
  plane(W, D, M.ceiling, 0, H, 0, Math.PI / 2);

  // walls: back (z=-4) and front (z=+4) are split at the seam; side walls are wholly A or B. They are built (and
  // rebuilt when a door arrives) by buildWall(), after the zones, from DOORS and WINDOWS.

  // baseboards and crown
  for (const z of [-HZ + 0.01, HZ - 0.01]) box(W, 0.06, 0.03, M.trim, 0, H - 0.03, z, { cast: false });
  // (the baseboards are part of each wall, broken at its doors: buildWall)
  for (const x of [-HX + 0.01, HX - 0.01]) box(0.03, 0.06, D, M.trim, x, H - 0.03, 0, { cast: false });

  // timber frame on the seam: posts on back and front walls + a ceiling beam.
  // Reads as an old house where two rooms were opened into one.
  box(0.18, H, 0.14, M.timber, 0, H / 2, -HZ + 0.07);
  box(0.18, H, 0.14, M.timber, 0, H / 2, HZ - 0.07);
  box(0.2, 0.22, D, M.timber, 0, H - 0.11, 0);
  for (const x of [-4, -2, 2, 4]) box(0.14, 0.16, D, M.timber, x, H - 0.08, 0);

  // windows on the back wall, one per side
  // A's looks out at the sky; B's is a real window into the kitchen (page E) while the kitchen is built (its clear pane
  // is in kitchen.js), else a painted sky like A's (WINDOWS, buildWall)
  for (const x of [-2.6, 2.6]) {
    if (x < 0) plane(1.3, 1.35, M.glass, x, 1.62, -HZ + 0.005);
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

  // (the panel doors are built by makeDoor / makeFutureDoor after the zones)

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
  // frustum covers the room AND the garage (its roof and walls cast, so the sun stays out of it)
  // ...and the media room (page D) on the other side; light-space +x is world -x here
  Object.assign(sun.shadow.camera, { left: -9.5, right: 9.9, top: 8.2, bottom: -3.3, near: 1, far: 23 });
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

/* ------------------------------------------------- zones from modules - */
/* Every zone with a "module" in zones.json (garage.js = page C, den.js = page D, kitchen.js = page E, ...) is built
   by that module's build function (its `buildZone`, default export, or first export named build*), into its own group,
   with the room's helpers. The same path runs at load and when a zone arrives later (the hot-load), so a module
   never needs to know which. A built zone may return: camBlocks (camera keep-outs), tick(dt), openDoor(id, door)
   (cut an opening in ITS OWN wall for a door that just became real; return true), plus anything room.js uses by name
   (garage: switchMesh/setLights/lightsOn; den: screenHits/future/rattle, and den.js's createNewsTV). */
let garage = null, den = null, kitchen = null;
const TV_OFF = { tap() {}, update() {}, near: () => false, prompt: () => "", start() {}, stop() {}, setSound() {}, get state() { return {}; } };
let tv = TV_OFF;
const zoneKey = (z) => (z.module ? `${z.module}?v=${z.v || 1}` : "");
function importZone(z) {
  if (!/^[\w-]+\.js$/.test(z.module || "")) return Promise.reject(new Error(`zone ${z.id}: bad module "${z.module}"`));
  return import(`/lab/seam-room/${z.module}?v=${z.v || 1}`);
}
function buildZone(z, mod) {
  const fn = (typeof mod.buildZone === "function" && mod.buildZone) || (typeof mod.default === "function" && mod.default)
    || Object.values(mod).find((f) => typeof f === "function" && /^build/.test(f.name));
  if (!fn) throw new Error(`zone ${z.id}: ${z.module} has no build function`);
  const group = new THREE.Group(); group.name = "zone-" + z.id; scene.add(group);
  const inGroup = (o) => (o && o.parent ? o : Object.assign({}, o, { parent: group }));
  const s0 = solids.length;
  let built;
  try {
    built = fn({ THREE, scene: group, M, canvasTex, rnd, solids, signTex, RoundedBoxGeometry,
      box: (w, h, d, mat, x, y, zz, o) => box(w, h, d, mat, x, y, zz, inGroup(o)),
      cyl: (r1, r2, h, mat, x, y, zz, o) => cyl(r1, r2, h, mat, x, y, zz, inGroup(o)),
      plane: (w, h, mat, x, y, zz, rx, ry, parent) => plane(w, h, mat, x, y, zz, rx, ry, parent || group) }) || {};
  } catch (e) { scene.remove(group); disposeTree(group); solids.splice(s0); throw e; }
  const entry = { id: z.id, key: zoneKey(z), mod, built, group, solids: solids.slice(s0), camBlocks: built.camBlocks || [], opened: [], tv: null };
  CAM_BLOCKS.push(...entry.camBlocks);
  if (mod.buildGarage) garage = built;
  if (mod.buildDen) den = built;
  if (mod.buildKitchen) kitchen = built;
  if (typeof mod.createNewsTV === "function") { entry.tv = tv = mod.createNewsTV({ THREE, den: built, onLog: (t) => seamLog(t) }); }
  BUILT[z.id] = entry;
  return entry;
}
/* take a built zone out of the world again (for a hot-swap): its group, its solids, its camera blocks, its TV */
function unbuildZone(id) {
  const e = BUILT[id]; if (!e) return null;
  if (e.tv) { try { e.tv.stop(); } catch (_) {} if (tv === e.tv) tv = TV_OFF; }
  scene.remove(e.group); disposeTree(e.group);
  for (const b of e.solids) { const i = solids.indexOf(b); if (i >= 0) solids.splice(i, 1); }
  for (const b of e.camBlocks) { const i = CAM_BLOCKS.indexOf(b); if (i >= 0) CAM_BLOCKS.splice(i, 1); }
  if (garage === e.built) garage = null;
  if (den === e.built) den = null;
  if (kitchen === e.built) kitchen = null;
  delete BUILT[id];
  return e;
}
/* a door that is real now: its leaf, and the opening in whichever wall it is in (a room wall, or a zone's own wall) */
function cutOpening(dr) {
  const w = wallOf(dr);
  if (w) { buildWall(w); return true; }
  for (const e of Object.values(BUILT)) {
    if (typeof e.built.openDoor === "function" && e.built.openDoor(dr.id, dr.data)) { if (!e.opened.includes(dr.id)) e.opened.push(dr.id); return true; }
  }
  return false;   // nobody owns that wall: the leaf is there, the opening is not
}
function openRealDoor(d) {
  const dr = doorFromData(d);
  DOORS[d.id] = dr;
  removeFutureDoor(d.id);
  makeDoor(dr);
  return cutOpening(dr);
}

/* at load: import every zone's module (in parallel), build them in zones.json order, then the walls and the doors */
let zonesRetry = false;
{
  const zs = ZDATA.zones.filter((z) => z.module);
  const mods = await Promise.all(zs.map((z) => importZone(z).catch((e) => { console.warn("seam-room:", e); return null; })));
  zs.forEach((z, i) => {
    if (!mods[i]) { zonesRetry = true; return; }
    try { buildZone(z, mods[i]); } catch (e) { console.warn("seam-room: zone", z.id, e); zonesRetry = true; }
  });
  for (const id of Object.keys(WALLS)) buildWall(id);
  for (const dr of Object.values(DOORS)) { makeDoor(dr); if (!wallOf(dr)) cutOpening(dr); }
  for (const d of DOORDATA) if (isFutureDoor(d) && !DOORS[d.id] && wallOf(doorFromData(d))) makeFutureDoor(d);
}

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

function zoneAt(x, z) { const zn = ZONES.find((q) => q.contains(x, z == null ? 0 : z)); return zn ? zn.id : ZONES[0].id; }

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
    const p = clampWalk(player.x + f.x * 0.6, player.z + f.z * 0.6, 0.35, true);
    asset.x = p.x; asset.z = p.z;
    asset.changes.push({ what: `set down on ${NAMES[zoneAt(asset.x, asset.z)]}`, at: Date.now() });
    commit(`${tag()} set down on page ${NAMES[zoneAt(asset.x, asset.z)]}`);
    return;
  }
  if (!(nearAsset() && !holderPresent()) && zoneId === "d" && tv.near(player.x, player.z)) { tv.tap(); return; }
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
      <dt>now on</dt><dd>page ${esc(NAMES[zoneAt(asset.x, asset.z)])} · x ${asset.x.toFixed(1)}, z ${asset.z.toFixed(1)} m</dd>
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
function nameSprite(text, color, ai) {
  const c = document.createElement("canvas"); c.width = 320; c.height = 64;
  const g = c.getContext("2d");
  g.fillStyle = "rgba(20,16,12,.72)"; g.beginPath(); g.roundRect(4, 8, 312, 48, 24); g.fill();
  g.fillStyle = color || "#8fd0ff"; g.beginPath(); g.arc(32, 32, 9, 0, 7); g.fill();
  let tx = 52;
  if (ai) {   // a small "AI" tag so nobody mistakes the character for a person
    g.fillStyle = "#e8c98a"; g.beginPath(); g.roundRect(48, 18, 46, 28, 8); g.fill();
    g.fillStyle = "#2a2014"; g.font = "800 19px system-ui, sans-serif"; g.textBaseline = "middle"; g.fillText("AI", 59, 33);
    tx = 104;
  }
  g.fillStyle = "#f3ead8"; g.font = "600 26px system-ui, sans-serif"; g.textBaseline = "middle"; g.fillText(text, tx, 33, 312 - tx - 14);
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
    const ai = !!(p.appearance && p.appearance.ai);
    e.ai = ai; e.name = p.name;
    const label = `${p.name || "Guest"} · on ${NAMES[p.place] || "?"}`;
    if (label + ai !== e.label) {
      if (e.sprite) e.group.remove(e.sprite);
      e.sprite = nameSprite(label, p.color, ai); e.group.add(e.sprite); e.label = label + ai;
    }
    const v = dt > 0 ? Math.hypot(p.x - e.px, p.z - e.pz) / dt : 0;
    e.speed += (Math.min(v, 4) - e.speed) * 0.2;
    e.px = p.x; e.pz = p.z; e.yaw = p.yaw; e.place = p.place;
    e.group.position.set(p.x, 0, p.z); e.group.rotation.y = p.yaw || 0;
    animate(e, e.speed, dt);
  }
  for (const [id, e] of peerAv) if (!live.has(id)) { scene.remove(e.group); peerAv.delete(id); }
  updateCounter();
  tickBubbles();
}

let counterSig = "";
function updateCounter() {
  const n = Object.fromEntries(ZONES.map((zn) => [zn.id, zn.id === zoneId ? 1 : 0]));
  for (const p of lastPeers) if (n[p.place] !== undefined) n[p.place] += 1;
  const sig = zoneId + "|" + ZONES.map((zn) => n[zn.id]).join("|");
  if (sig === counterSig) return;
  counterSig = sig;
  const el = $("counter");
  if (el) el.innerHTML = `You: <b>page ${NAMES[zoneId]}</b> · ` + ZONES.map((zn) => `On ${NAMES[zn.id]}: ${n[zn.id]}`).join(" · ");
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
shell.on("asset-ask", () => {
  shell.send("asset", { state: asset });
  if (garage && !garage.lightsOn) shell.send("garage-light", { on: false });
  for (const d of Object.values(DOORS)) if (performance.now() < d.tapUntil) shell.send("door", { id: d.id, open: true, ms: d.tapUntil - performance.now() });
});

/* ----------------------------------------- the doors (B->garage, A->den) - */
/* A door opens when anyone (people or the AI) is within 1.5 m, or when tapped; it stays open while anyone is near,
   then closes. Everyone computes "near" from the shared positions, and taps / my own approach go out as world events
   ("door", with the door's id) so a browser whose peer list lags still agrees. */
const DOOR_NEAR = 1.5, DOOR_TAP_MS = 8000;
function nearDoor(x, z, d) { d = d || door; return Math.hypot(x - d.px, z - d.pz) < DOOR_NEAR; }
function anyoneNearDoor(d) {
  d = d || door;
  if (nearDoor(player.x, player.z, d)) return true;
  for (const p of lastPeers) if (nearDoor(p.x, p.z, d)) return true;
  const now = performance.now();
  for (const [id, until] of d.remote) { if (now < until) return true; d.remote.delete(id); }
  return false;
}
function tapDoor(id) {
  const d = DOORS[id] || door;
  const someone = anyoneNearDoor(d);
  const open = !(d.open && !someone);          // a tap opens it; a tap on an open door with nobody near shuts it
  d.tapUntil = open ? performance.now() + DOOR_TAP_MS : 0;
  shell.send("door", { id: d.id, open, ms: DOOR_TAP_MS });
  seamLog(open ? `${d.name} opened (tap)` : `${d.name} closed (tap)`);
}
shell.on("door", (m, from) => {
  const d = m && DOORS[m.id];
  if (!d) return;
  if (m.near != null) { if (m.near) d.remote.set(from || "?", performance.now() + 4000); else d.remote.delete(from || "?"); return; }
  d.tapUntil = m.open ? performance.now() + Math.min(DOOR_TAP_MS, Number(m.ms) || DOOR_TAP_MS) : 0;
});
function stepDoor(dt) {
  const now = performance.now();
  for (const d of Object.values(DOORS)) {
    const meNear = nearDoor(player.x, player.z, d);
    if (meNear !== d.meNear || (meNear && now - d.ping > 2500)) {   // tell the room I am at the door (repeat while I stay)
      d.meNear = meNear; d.ping = now;
      if (shell.connected) shell.send("door", { id: d.id, near: meNear });
    }
    d.open = anyoneNearDoor(d) || now < d.tapUntil;
    d.amt = clampN(d.amt + (d.open ? 1 : -1) * dt / 0.6, 0, 1);
    const e = d.amt * d.amt * (3 - 2 * d.amt);   // ease in-out over 0.6 s
    d.leaf.rotation.y = -d.lo * e * Math.PI / 2;
  }
}
shell.on("garage-light", (m) => { if (garage && m && typeof m.on === "boolean") garage.setLights(m.on); });
function tapSwitch() {
  if (!garage) return;
  garage.setLights(!garage.lightsOn);
  shell.send("garage-light", { on: garage.lightsOn });
  seamLog(`garage lights ${garage.lightsOn ? "on" : "off"}`);
}

let announced = false;
function onConnected() {
  announced = true;
  void setupTalk();
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

/* ------------------------------------------------- talk: bubbles + chat - */
/* ONLY JARON TALKS TO THE AI. The AI character runs on his personal Claude
   plan. His lines go into public.seam_room_chat (RLS: only he can insert
   rows as himself, only he can read his conversation). The AI reads only his
   rows and writes its replies there, so only his device shows and speaks the
   words. Everyone else sees a "talking" dot over whoever is speaking.
   Broadcast chat is never trusted (anyone can forge "from"). */
const bubbles = new Map();          // avatar id ("self" or peer id) -> { sprite, holder, until, text, dots }
function bubbleSprite(text, dots) {
  const c = document.createElement("canvas"); c.width = 512; c.height = 256;
  const g = c.getContext("2d");
  const font = dots ? "800 40px system-ui, sans-serif" : "500 30px system-ui, sans-serif";
  g.font = font;
  let lines = [];
  if (dots) lines = ["• • •"];
  else {
    const words = String(text).split(/\s+/); let cur = "", used = 0;
    for (const w of words) {
      const t = cur ? cur + " " + w : w;
      if (g.measureText(t).width > 440 && cur) { lines.push(cur); cur = w; if (lines.length === 4) break; } else cur = t;
      used++;
    }
    if (lines.length < 4 && cur) lines.push(cur);
    if (used < words.length) lines[lines.length - 1] = lines[lines.length - 1].replace(/\s*\S{0,3}$/, "") + "…";
  }
  const w = Math.min(492, Math.max(dots ? 120 : 140, ...lines.map((l) => g.measureText(l).width + 44)));
  const h = 22 + lines.length * 38;
  const x0 = (512 - w) / 2, y0 = 256 - h - 26;
  g.fillStyle = "rgba(243,234,216,.96)"; g.beginPath(); g.roundRect(x0, y0, w, h, 22); g.fill();
  g.beginPath(); g.moveTo(256 - 14, y0 + h - 1); g.lineTo(256, 256 - 6); g.lineTo(256 + 14, y0 + h - 1); g.fill();
  g.fillStyle = "#2c2118"; g.font = font; g.textBaseline = "middle"; g.textAlign = "center";
  lines.forEach((l, i) => g.fillText(l, 256, y0 + 30 + i * 38));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(1.2, 0.6, 1); s.renderOrder = 11;
  return s;
}
function showBubble(id, text, ms, dots) {
  const holder = id === "self" ? selfAv : peerAv.get(id);
  if (!holder) return false;
  const old = bubbles.get(id);
  if (old) old.holder.group.remove(old.sprite);
  const sprite = bubbleSprite(text, dots);
  sprite.position.y = id === "self" ? 2.2 : 2.35;
  holder.group.add(sprite);
  bubbles.set(id, { sprite, holder, text: dots ? "" : text, dots: !!dots, until: performance.now() + (ms || 6000) });
  return true;
}
function tickBubbles() {
  const now = performance.now();
  for (const [id, b] of bubbles) {
    if (now > b.until || (id !== "self" && !peerAv.has(id))) { b.holder.group.remove(b.sprite); bubbles.delete(id); }
  }
}
// everyone: someone is talking (no words travel this way). Never replace a real bubble with dots.
shell.on("talking", (m, from) => {
  const b = bubbles.get(from);
  if (b && !b.dots) return;
  showBubble(from, "", Math.min(9000, Number(m.ms) || 3000), true);
});

/* the chat box - built only for the owner */
let canTalk = false, muted = false;
const chatLines = [];
try { muted = localStorage.getItem("seam-room:mute") === "1"; } catch (_) {}
function chatLog(name, text, ai) {
  chatLines.push({ name, text, ai, at: Date.now() });
  while (chatLines.length > 30) chatLines.shift();
  const box = $("chatLog"); if (!box) return;
  // Jaron 11/1: never cover the room. The bubbles over heads are the live view; the full history only shows when he
  // opens it with the clock button, and closes on a tap.
  box.innerHTML = chatLines.map((l) => `<div${l.ai ? ' class="ai"' : ""}><b>${esc(l.name)}${l.ai ? " <i>AI</i>" : ""}</b> ${esc(l.text)}</div>`).join("");
  if (box.classList.contains("on")) box.scrollTop = box.scrollHeight;
}
function speak(text) {
  if (muted || !("speechSynthesis" in window)) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    const vs = speechSynthesis.getVoices();
    const v = vs.find((x) => /^en[-_]US/i.test(x.lang) && /Samantha|Aaron|Google US|Natural|Aria|Jenny|Guy/i.test(x.name)) || vs.find((x) => /^en/i.test(x.lang));
    if (v) u.voice = v;
    u.rate = 1.02; speechSynthesis.speak(u);
  } catch (_) {}
}
function buildChat() {
  const wrap = document.createElement("div"); wrap.id = "chat";
  wrap.innerHTML = `<form id="chatForm" autocomplete="off">
      <input id="chatIn" type="text" maxlength="280" enterkeyhint="send" placeholder="Talk to the AI…" aria-label="Say something to the AI">
      <button id="chatSay" type="submit">Say</button>
      <button id="chatMute" type="button" aria-label="Mute spoken replies"></button>
      <button id="chatHist" type="button" aria-label="Show chat history" title="Chat history">🕘</button>
    </form>
    <div id="chatLog" aria-live="polite"></div>`;
  document.body.appendChild(wrap);
  // sit just under the shell's status chips, which wrap to two rows on a phone
  const placeChat = () => { const h = document.querySelector(".hbs-hud"); wrap.style.top = Math.round((h ? h.getBoundingClientRect().bottom : 40) + 6) + "px"; };
  placeChat(); addEventListener("resize", placeChat); setTimeout(placeChat, 1500);
  document.body.classList.add("can-talk");
  // keep taps here away from the shell's stick/look and the room's walk keys
  for (const ev of ["pointerdown", "touchstart", "mousedown"]) wrap.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  wrap.addEventListener("keydown", (e) => e.stopPropagation());
  const hist = $("chatHist"), logBox = $("chatLog");
  hist.addEventListener("click", () => { logBox.classList.toggle("on"); hist.classList.toggle("on", logBox.classList.contains("on")); logBox.scrollTop = logBox.scrollHeight; });
  logBox.addEventListener("click", () => { logBox.classList.remove("on"); hist.classList.remove("on"); });
  const mute = $("chatMute");
  const paintMute = () => { mute.textContent = muted ? "🔇" : "🔊"; mute.setAttribute("aria-pressed", muted ? "true" : "false"); mute.title = muted ? "Replies are muted" : "Replies are read aloud"; };
  paintMute();
  mute.addEventListener("click", () => {
    muted = !muted; paintMute();
    try { localStorage.setItem("seam-room:mute", muted ? "1" : "0"); } catch (_) {}
    if (muted && "speechSynthesis" in window) speechSynthesis.cancel();
    else speak("Sound on.");   // a tap also unlocks speech on iPhone
  });
  $("chatForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const inp = $("chatIn"), text = inp.value.trim().slice(0, 280);
    if (!text) return;
    // iPhone only lets a page speak after a tap; this tap counts
    if (!muted && "speechSynthesis" in window && !speechSynthesis.speaking) { try { speechSynthesis.speak(new SpeechSynthesisUtterance(" ")); } catch (_) {} }
    inp.value = ""; inp.blur();
    showBubble("self", text, 5000 + text.length * 50);
    shell.send("talking", { ms: Math.min(9000, 1500 + text.length * 55) });
    const { data, error } = await shell.supa.from("seam_room_chat")
      .insert({ user_id: shell.uid, speaker: "human", body: text, place: zoneId }).select("id").single();
    if (error) { chatLog("Not sent", /row-level security/i.test(error.message) ? "only the room's owner can talk to the AI" : error.message, false); return; }
    seenRows.add(data.id);
    chatLog("You", text, false);
  });
}
const seenRows = new Set();
function onChatRow(r) {
  if (!r || seenRows.has(r.id)) return;
  seenRows.add(r.id);
  if (r.speaker === "ai") {
    chatLog(r.ai_name || "AI", r.body, true);
    showBubble(r.ai_key, r.body, 5000 + r.body.length * 60);
    speak(r.body);
  } else chatLog("You", r.body, false);   // a line he sent from another device
}
async function setupTalk() {
  if (!shell.supa || !shell.uid) return;           // guests never get the box
  let ok = false;
  try { const { data } = await shell.supa.rpc("seam_room_is_owner"); ok = data === true; } catch (_) {}
  if (!ok) return;
  canTalk = true;
  buildChat();
  try {
    const { data } = await shell.supa.from("seam_room_chat").select("*").order("id", { ascending: false }).limit(3);
    for (const r of (data || []).reverse()) { seenRows.add(r.id); chatLog(r.speaker === "ai" ? (r.ai_name || "AI") : "You", r.body, r.speaker === "ai"); }
  } catch (_) {}
  shell.supa.channel("seam-chat-" + shell.uid)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "seam_room_chat", filter: `user_id=eq.${shell.uid}` }, ({ new: r }) => onChatRow(r))
    .subscribe();
}
/* test handle. previewBox() only draws the box: for anyone but Jaron the database refuses what it sends. */
window.__seamTalk = { showBubble, onChatRow, speak, previewBox: () => { if (!document.getElementById("chat")) buildChat(); }, get muted() { return muted; } };

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
  else if (garage && ray.intersectObject(garage.switchMesh, true).some((h) => h.distance < 6)) tapSwitch();
  else if (den && zoneId === "d" && ray.intersectObjects(den.screenHits, false).some((h) => h.distance < 9)) tv.tap();
  else {
    const fh = den && ray.intersectObjects(den.futureHits, true).find((h) => h.distance < 8);
    const f = fh && den.future.find((q) => { for (let o = fh.object; o; o = o.parent) if (o === q.leaf) return true; return false; });
    if (f) { den.rattle(f.id); seamLog(`door ${f.id}: coming soon (a future page)`); return; }
    for (const q of Object.values(FUTURE)) if (ray.intersectObject(q.leaf, true).some((h) => h.distance < 8)) { q.rattle = 0.45; seamLog(`door ${q.id}: coming soon (a future page)`); return; }
    for (const d of Object.values(DOORS)) if (ray.intersectObject(d.leaf, true).some((h) => h.distance < 8)) { tapDoor(d.id); break; }
  }
});

$("reset").addEventListener("click", resetRoom);
for (const ev of ["pointerdown", "touchstart"]) $("hudSeam").addEventListener(ev, (e) => { if (e.target.closest("button,a")) e.stopPropagation(); }, { passive: true });

/* --------------------------------------------------------------- move - */
function clampToRoom(x, z, r) { return clampWalk(x, z, r); }   // room + garage + den + each doorway while its door is open
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
  let tvText = false;
  if (!text && zoneId === "d" && tv.near(player.x, player.z)) { text = tv.prompt(); tvText = true; }
  if (text === promptText) return;
  promptText = text;
  shell.setPrompt(text ? (shell.isTouch ? text : `${text}  (E)`) : "");
  const btn = document.querySelector(".hbs-act.go");          // shell's use button says "Enter"; say what it does here
  if (btn) btn.textContent = !text ? "Use" : tvText ? (/Watch|Open/.test(text) ? "Watch" : "Sound") : iHold() ? (/Shape/.test(text) ? "Shape" : "Drop") : "Pick up";
}

/* ------------------------------------------------------------- camera - */
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
function placeCamera(dt) {
  const dist = 2.9, h = 1.55;
  const cx = player.x + Math.sin(cam.yaw) * dist * Math.cos(cam.pitch);
  const cz = player.z + Math.cos(cam.yaw) * dist * Math.cos(cam.pitch);
  const cy = h + Math.sin(cam.pitch) * dist;
  // walk from the head out toward the wanted spot; stop where a wall (or the shut door) would be in the way
  const y1 = Math.max(0.4, cy), hx = player.x, hy = 1.35, hz = player.z;
  let tBest = 0;
  for (let i = 1; i <= 24; i++) {
    const tt = i / 24;
    if (!airFree(hx + (cx - hx) * tt, hy + (y1 - hy) * tt, hz + (cz - hz) * tt, 0.16)) break;
    tBest = tt;
  }
  camPos.set(hx + (cx - hx) * tBest, hy + (y1 - hy) * tBest, hz + (cz - hz) * tBest);
  camera.position.lerp(camPos, Math.min(1, dt * 12));
  camLook.set(player.x, 1.35, player.z);
  camera.lookAt(camLook);
}

/* ----------------------------------------- new rooms without a reload - */
/* Jaron 11/1: someone standing in the room when a new zone deploys sees it arrive. Every ~20 s, only while the tab is
   visible, room.js fetches zones.json (no-store + ?v=time: one small request; an unchanged file is one string compare
   and nothing else). When the text changed it diffs against what is built:
     - a NEW zone: import() its "module", build it into the running scene, add it to the seam (URL switching), the
       counter, the names and spawns; one quiet line in the seam log ("new room: Kitchen (page E) is here").
     - a door that became "kind": "door" (it was a "future" decoration, or new): the real leaf, and the opening in its
       wall (a room wall is rebuilt alone; a zone's own wall is cut by that zone's openDoor()).
     - walk: the floor list is replaced (a doorway stays shut until its door opens).
     - a CHANGED zone ("module" or "v" changed; bump "v" when you change a zone's module): the old one is taken out
       and the new one built in its place (hot-swap). Anything it cannot apply (a zone or door removed, a door moved,
       a failed import) gives one quiet line instead: "an update is ready, reload when you like".
   Your position, the people, the log/chair and the seam log are never touched. */
const ZONES_POLL_MS = 20000;
const ZRAW = Object.fromEntries(ZDATA.zones.map((z) => [z.id, JSON.stringify(z)]));
let zonesBusy = false, zonesLastPoll = Date.now(), updateNoticed = false;
function updateReady() { if (!updateNoticed) { updateNoticed = true; seamLog("an update is ready, reload when you like"); } }
async function applyZones(data) {
  let ok = true;
  const wallsToRebuild = new Set();
  for (const z of data.zones || []) {
    if (!z || !z.id) continue;
    const raw = JSON.stringify(z), known = ZONES.find((q) => q.id === z.id), had = BUILT[z.id];
    const needBuild = !!z.module && (!had || had.key !== zoneKey(z));
    if (known && ZRAW[z.id] === raw && !needBuild) continue;
    try {
      if (needBuild) {
        const mod = await importZone(z);   // import first: if it fails, the old zone stays as it is
        let lights = null;
        if (had) { lights = had.built.lightsOn; unbuildZone(z.id); }
        const e = buildZone(z, mod);
        if (lights === false && e.built.setLights) e.built.setLights(false);
        for (const dr of Object.values(DOORS)) if (!wallOf(dr) && had && had.opened.includes(dr.id)) cutOpening(dr);   // its doors stay open
        for (const win of WINDOWS) if (win.into === z.id) wallsToRebuild.add(win.wall);
      }
      seam.addZone(Seam.zoneFromData(z));
      NAMES[z.id] = z.label || z.id.toUpperCase();
      SPAWN[z.id] = z.spawn || { x: 0, z: 0, yaw: 0 };
      if (needBuild && had) seamLog(`${roomName(z)} (page ${NAMES[z.id]}) updated`);
      else if (needBuild || !known) seamLog(`new room: ${roomName(z)} (page ${NAMES[z.id]}) is here`);
      ZRAW[z.id] = raw;
    } catch (e) { console.warn("seam-room: zone", z.id, e); ok = false; updateReady(); }
  }
  if ((data.zones || []).length < ZONES.length && ZONES.some((q) => !(data.zones || []).find((z) => z && z.id === q.id))) updateReady();   // a zone was removed

  // doors: a "future" one (or a new one) that is real now gets its leaf and its opening; a new future one on a room wall is drawn
  const newDoors = data.doors || [];
  for (const d of newDoors) {
    if (!d || !d.id) continue;
    const was = DOORDATA.find((q) => q.id === d.id);
    if (was && JSON.stringify(was) === JSON.stringify(d)) continue;
    if (isRealDoor(d)) {
      if (DOORS[d.id]) { updateReady(); continue; }   // a real door that moved or changed shape: that needs a reload
      if (!openRealDoor(d)) updateReady();
    } else if (DOORS[d.id]) updateReady();         // a real door made decoration again
    else if (isFutureDoor(d) && !FUTURE[d.id] && wallOf(doorFromData(d))) makeFutureDoor(d);
  }
  for (const id of Object.keys(DOORS)) if (!newDoors.find((d) => d && d.id === id)) updateReady();   // a door was removed
  for (const id of Object.keys(FUTURE)) if (!newDoors.find((d) => d && d.id === id && isFutureDoor(d))) removeFutureDoor(id);
  DOORDATA = newDoors; SEAMCFG.doors = newDoors;
  for (const w of wallsToRebuild) buildWall(w);
  if (Array.isArray(data.walk)) WALK.splice(0, WALK.length, ...data.walk);
  counterSig = ""; updateCounter();
  return ok;
}
async function pollZones(force) {
  if (zonesBusy || (!force && document.hidden)) return false;
  zonesBusy = true; zonesLastPoll = Date.now();
  try {
    const r = await fetch(ZONES_URL + "?v=" + Date.now(), { cache: "no-store" });
    if (!r.ok) return false;
    const text = await r.text();
    if (text === zonesText && !zonesRetry) return false;
    let data;
    try { data = JSON.parse(text); } catch (_) { return false; }   // half a deploy: try again next time
    zonesRetry = false;
    if (await applyZones(data)) zonesText = text; else zonesRetry = true;
    return true;
  } catch (_) { return false; } finally { zonesBusy = false; }
}
setInterval(() => { if (!document.hidden) void pollZones(); }, ZONES_POLL_MS);
document.addEventListener("visibilitychange", () => { if (!document.hidden && Date.now() - zonesLastPoll > ZONES_POLL_MS) void pollZones(); });

/* --------------------------------------------------------------- loop - */
const clock = new THREE.Clock();
let t = 0;
const startZone = seam.start();
zoneId = startZone.id;
camera.position.set(player.x + Math.sin(cam.yaw) * 2.9, 1.9, player.z + Math.cos(cam.yaw) * 2.9);

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05); t += dt; frameDt = dt;
  stepDoor(dt);
  for (const e of Object.values(BUILT)) if (e.built.tick) e.built.tick(dt);
  tickFutureDoors(dt);
  step(dt);
  tv.update(player.x, player.z, zoneId === "d");
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
  shell: () => shell, use: useAction, reset: resetRoom, openCard, solids, zones: ZONES,
  get bubbles() { return [...bubbles.entries()].map(([id, b]) => ({ id, text: b.text, dots: b.dots })); },
  get chat() { return chatLines.slice(); }, get canTalk() { return canTalk; },
  teleport(x, z) { player.x = x; player.z = z; },
  door, doors: DOORS, tapDoor, tapSwitch, renderer, camera, scene, walk: WALK, future: FUTURE, built: BUILT,
  get garage() { return garage; }, get den() { return den; }, get tv() { return tv; }, get kitchen() { return kitchen; },
  pollZones: (force) => pollZones(force !== false), get zonesText() { return zonesText; },
};
