// WORLD 2 — Heartbeat Observatory. Phase 1: the skeleton.
// Own code, own directory — nothing here imports from /engine/hub/. World 1 is untouchable.
// Laws honored in this file (from WORLD2-PLAN.md / TODO.md):
//   - BUILD const below is bumped together with ?v= in /world2/index.html, same commit, every push.
//   - TDZ / boot-order law: every const/let used by boot-path or frame-loop code is declared
//     ABOVE the buildWorld()/animate() calls — which sit at the very END of this file.
//   - No per-frame allocations in animate(): module-level temps are reused.
//   - Movement feel copied from World 1 (speeds, gravity, jump, look sensitivity) — proven shapes.
//   - groundHeight(x, z) exists from day one: movement already follows the ground, so the
//     Phase 2 terrain only has to raise the amplitude, not rewire movement.

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.module.js";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const BUILD = "2026-06-10-w2i";
const PREVIEW = new URLSearchParams(location.search).get("preview") === "1"; // gate-page spectate: orbit forever, join nothing // bumped with ?v= in /world2/index.html on every deploy
try { console.log("Heartbeat Observatory — World 2 build", BUILD); } catch (e) {}

// ---- DOM ----
const canvas = document.querySelector("#game");
const overlay = document.querySelector("#overlay");
const enterButton = document.querySelector("#enterButton");
const timeChip = document.querySelector("#timeChip");
const presenceChip = document.querySelector("#presenceChip");
const doorPrompt = document.querySelector("#doorPrompt");
const doorPromptText = document.querySelector("#doorPromptText");
const doorEnterBtn = document.querySelector("#doorEnterBtn"); // phone ENTER - World 1 muscle memory
const claimOverlay = document.querySelector("#claimOverlay");
const claimInput = document.querySelector("#claimInput");
const claimError = document.querySelector("#claimError");
const claimSubmit = document.querySelector("#claimSubmit");
const claimCancel = document.querySelector("#claimCancel");
const movePad = document.querySelector("#movePad");
const moveKnob = document.querySelector("#moveKnob");
const jumpButton = document.querySelector("#jumpButton");
const crouchButton = document.querySelector("#crouchButton");

const isTouch = matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;

// ---- world constants (movement numbers are World 1's — the proven feel) ----
const worldBounds = 140;          // soft edge; fog melts the far terrain long before this
const playerRadius = 0.35;        // used by resolveCollision once colliders exist (Phase 3)
const standingEyeHeight = 1.65;
const crouchEyeHeight = 1.15;
const gravity = 17.5;
const jumpVelocity = 6.4;
const WORLD_SEED = 7337;

// ---- the city district (Phase 3) — off-spawn, so the skyline is a destination you walk toward ----
const CITY = { x: 55, z: -45, r: 52, blend: 22, base: 1.2, street: 14 };

// ---- Phase 4: multiplayer — same Supabase project as World 1, NEW channel (world2-town).
// Sharing World 1's engine-town channel would double its traffic; this world has its own. ----
const SUPA_URL = "https://ygjpnvrwhkrowkrskftk.supabase.co";
const SUPA_KEY = "sb_publishable_Y-duV64ayMMEvVwMs5PWuw_6kvzbOrN";
const W2_CHANNEL = "world2-town";
const peerColors = ["#4fa3ff", "#5fd38d", "#f6b45b", "#e36d7c", "#a67cff", "#47c7b8", "#f0d461", "#d987e8"];
let supa = null;
let channel = null;
let connected = false;
let wantsConnection = false;
let reconnectTimer = null;
let myId = null;
let displayName = null;
let myColor = peerColors[0];
let sendAccumulator = 0;
let lastSentSig = "";   // idle-send guard: signature of the last broadcast state
let lastSentAt = 0;     // idle-send guard: keepalive clock
const peers = new Map();
const remotes = new Map();
let myUserId = null;       // signed-in residents claim; guests walk and watch (same law as World 1)

// ---- Phase 5: doors + plots. Doors lead to the SAME living pages as World 1's buildings. ----
const doors = [];          // { label, path, x, z, hw, hd }
let activeDoor = null;
let activePlot = null;
const plotPads = [];       // { plot, x, z, claimed, row, group, sign }
const claimedPadCenters = [];
let currentClaimPlot = null;
let spacesLoaded = false;
let spacesTimer = null;
// civic buildings: the big PERMANENT towers nearest the plaza, each with a real door in its
// face — Theater/Arcade/Library open into walk-in interiors styled for this world; the others
// go to the same living pages World 1's buildings open. Plots for residents ring the outskirts.
const CIVICS = [
  { id: "theater", label: "Theater", tint: 0xc97a6a, block: [1, 0], act: { type: "interior", id: "theater" }, h: 21 },
  { id: "arcade", label: "Arcade", tint: 0x6a93d6, block: [1, -1], act: { type: "interior", id: "arcade" }, h: 18 },
  { id: "library", label: "Library", tint: 0xb08a56, block: [-2, 0], act: { type: "interior", id: "library" }, h: 17 },
  { id: "social", label: "Social", tint: 0xd67a96, block: [-2, -1], act: { type: "page", path: "/social" }, h: 25 },
  { id: "projects", label: "Projects", tint: 0xd6b266, block: [0, 1], act: { type: "page", path: "/projects" }, h: 23 },
  { id: "town", label: "Town Square \u00b7 World 1", tint: 0x77c98a, block: [0, -2], act: { type: "page", path: "/engine" }, h: 16 }
];
const PLOT_COUNT = 8;
const ROOM = { theater: { x: 620, z: -160 }, arcade: { x: 620, z: -45 }, library: { x: 620, z: 70 } };
let inInterior = null;          // interior id or null
let interiorReturn = null;
const interiorColliders = { theater: [], arcade: [], library: [] };
const interiorStations = { theater: [], arcade: [], library: [] };

// ---- day/night palette (World 2's own — warmer dusk, deeper night than the town) ----
const W2_DAY = new THREE.Color(0xaecde4);
const W2_DUSK = new THREE.Color(0xe08c52);
const W2_NIGHT = new THREE.Color(0x0a1422);

// ---- player state ----
const state = { x: 0, y: 1.65, z: 10, yaw: 0, pitch: 0, stance: "stand" };
const input = { moveX: 0, moveY: 0, crouchHeld: false, jumpQueued: false, touchLookId: null, touchLookX: 0, touchLookY: 0, moveTouchId: null };
const settings = { sensitivity: 1, invertY: false };
const motion = { airOffset: 0, verticalVelocity: 0, onGround: true, sprinting: false, moving: false };
const keys = new Set();
let hasEntered = false;
let previewAngle = -0.55;

// ---- colliders (tree trunks now; Phase 3 adds buildings — same shape as World 1) ----
const buildingColliders = []; // { x, z, width, depth }

// ---- scene / renderer (the cinematic foundation — this alone is half the look) ----
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xaecde4);
scene.fog = new THREE.FogExp2(0xaecde4, 0.0115); // fog matched to sky = THE atmosphere trick

const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.08, 500);
camera.rotation.order = "YXZ";

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const clock = new THREE.Clock();

// ---- sky / light handles (filled by buildWorld) ----
let sunLight = null, hemiLight = null;
let skyAnchor = null, sunDisc = null, moonDisc = null, stars = null;

// ---- grass system (deterministic world-grid: tufts live in fixed world cells, so the set
// only changes at the far edge as you walk — no pop-in next to the player) ----
const GRASS_CELL = 10;          // world units per cell
const GRASS_CELL_RADIUS = 3;    // cells each side of the player -> 7x7 grid
const GRASS_PER_CELL = 18;      // 7*7*18 = 882 tufts, ONE draw call
let grass = null;
let grassCellX = 1e9, grassCellZ = 1e9;

// ---- city handles (emissive intensity driven by the day/night cycle) ----
let towerMat = null, lowMat = null, glassMat = null, bulbMat = null;
const FIREFLY_COUNT = 130;
let fireflies = null, fireflyBase = null;

// ---- module temps (reused every frame — no per-frame allocations) ----
const _sky = new THREE.Color();
const _sunOff = new THREE.Vector3();
const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _eu = new THREE.Euler();
const _vs = new THREE.Vector3();
const _vp = new THREE.Vector3();

// ---- seeded value noise (tiny, no library) + groundHeight ----
function hash2(ix, iz) {
  let h = (ix * 374761393 + iz * 668265263 + WORLD_SEED * 144665) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function vnoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz), b = hash2(ix + 1, iz), c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}
// Phase 2: real hills. Domain-warped FBM — the warp bends the noise grid so ridgelines
// meander like real terrain instead of sitting on an obvious lattice. Movement code did
// not change for this (the Phase 1 promise): it already follows groundHeight.
function groundHeight(x, z) {
  const wx = x + (vnoise(x * 0.01 + 113.7, z * 0.01 + 41.2) - 0.5) * 34;
  const wz = z + (vnoise(x * 0.01 + 77.1, z * 0.01 + 9.8) - 0.5) * 34;
  let h = (vnoise(wx * 0.008, wz * 0.008) - 0.5) * 2 * 5.6;             // broad hills
  h += (vnoise(wx * 0.024 + 37.7, wz * 0.024 + 19.3) - 0.5) * 2 * 1.9;  // mid swells
  h += (vnoise(x * 0.07 + 7.3, z * 0.07 + 3.1) - 0.5) * 2 * 0.45;       // surface detail
  const d = Math.hypot(x, z);
  const flat = Math.min(1, Math.max(0, (d - 10) / 26)); // spawn clearing stays level
  let g = h * flat;
  // Phase 3: the city rests on a plateau; terrain blends to it across a soft shoulder
  const cd = Math.hypot(x - CITY.x, z - CITY.z);
  if (cd < CITY.r + CITY.blend) {
    let cf = Math.min(1, Math.max(0, (cd - CITY.r) / CITY.blend));
    cf = cf * cf * (3 - 2 * cf);
    g = CITY.base + (g - CITY.base) * cf;
  }
  return g;
}

// average gradient magnitude — used at build time for tree/grass placement, never per frame
function groundSlope(x, z) {
  const e = 0.6;
  const hx = groundHeight(x + e, z) - groundHeight(x - e, z);
  const hz = groundHeight(x, z + e) - groundHeight(x, z - e);
  return Math.hypot(hx, hz) / (2 * e);
}

// ---- roads (Phase 3): painted into the terrain, not separate geometry — phone-cheap,
// and every system (ground color, grass, trees, rocks, lamps) samples the same truth ----
function cityDist(x, z) { return Math.hypot(x - CITY.x, z - CITY.z); }
// distance to the main road: the straight line from spawn to the city heart
function roadDist(x, z) {
  const L2 = CITY.x * CITY.x + CITY.z * CITY.z;
  let t = (x * CITY.x + z * CITY.z) / L2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(x - CITY.x * t, z - CITY.z * t);
}
// distance to the nearest city street line (12-unit grid in city-local coordinates)
function streetDist(x, z) {
  const dx = x - CITY.x, dz = z - CITY.z;
  const mx = Math.abs(dx - Math.round(dx / CITY.street) * CITY.street);
  const mz = Math.abs(dz - Math.round(dz / CITY.street) * CITY.street);
  return Math.min(mx, mz);
}
// 0..1 how paved this spot is (main road, city streets, central plaza)
function pavedAt(x, z) {
  let p = Math.min(1, Math.max(0, (3.2 - roadDist(x, z)) / 1.2));
  const cd = cityDist(x, z);
  if (cd < CITY.r + 4) {
    p = Math.max(p, Math.min(1, Math.max(0, (3.6 - streetDist(x, z)) / 1.2)));
    p = Math.max(p, Math.min(1, Math.max(0, (10.4 - cd) / 1.5)));
  }
  return p;
}

// ---- build the world ----
function buildWorld() {
  // ground: heightfield plane. Displace first, compute normals, THEN color by height AND
  // slope — the normal.y we get from computeVertexNormals is a free slope measure per vertex.
  const size = 600, segs = 196;
  const groundGeo = new THREE.PlaneGeometry(size, size, segs, segs);
  groundGeo.rotateX(-Math.PI / 2);
  const pos = groundGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, groundHeight(pos.getX(i), pos.getZ(i)));
  }
  groundGeo.computeVertexNormals();
  const nrm = groundGeo.attributes.normal;
  const colors = new Float32Array(pos.count * 3);
  const cLush = new THREE.Color(0x4c6b46), cDry = new THREE.Color(0x7d7a4e), cHigh = new THREE.Color(0x8a8378), cRock = new THREE.Color(0x6e685e);
  const cRoad = new THREE.Color(0x3f3f3d), cDust = new THREE.Color(0x6b6456);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), h = pos.getY(i), ny = nrm.getY(i);
    const t = Math.min(1, Math.max(0, (h + 1) / 7));
    _sky.copy(cLush).lerp(cDry, Math.min(1, t * 1.5)).lerp(cHigh, Math.max(0, t - 0.6) * 2.5);
    const steep = Math.min(1, Math.max(0, (0.82 - ny) / 0.25)); // cliffsides read as rock
    _sky.lerp(cRock, steep);
    // Phase 3: streets and the city floor are painted into the terrain itself
    const dust = Math.min(1, Math.max(0, (CITY.r - cityDist(x, z)) / 8)) * 0.4;
    if (dust > 0) _sky.lerp(cDust, dust);
    const pv = pavedAt(x, z);
    if (pv > 0) _sky.lerp(cRoad, pv * 0.85);
    const jitter = (vnoise(x * 0.3 + 91, z * 0.3 + 17) - 0.5) * 0.06;
    colors[i * 3] = _sky.r + jitter;
    colors[i * 3 + 1] = _sky.g + jitter;
    colors[i * 3 + 2] = _sky.b + jitter;
  }
  groundGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }));
  ground.receiveShadow = true;
  scene.add(ground);

  // spawn marker: a flat stone disc — honest "you arrive here", not a fake plaza
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(2.6, 2.8, 0.18, 28),
    new THREE.MeshStandardMaterial({ color: 0x8e8a80, roughness: 0.85 })
  );
  disc.position.set(0, 0.02, 0);
  disc.receiveShadow = true;
  scene.add(disc);

  // scattered boulders: scale + parallax reference while walking (instanced — one draw call)
  const rockCount = 70;
  const rocks = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(1, 0),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }),
    rockCount
  );
  let rocksPlaced = 0;
  for (let i = 0; i < rockCount; i++) {
    const ang = hash2(i, 11) * Math.PI * 2;
    const dist = 15 + hash2(i, 23) * 115;
    const x = Math.cos(ang) * dist, z = Math.sin(ang) * dist;
    if (cityDist(x, z) < CITY.r + 6 || roadDist(x, z) < 4.5) continue; // streets stay clear
    const sc = 0.4 + hash2(i, 41) * 1.3;
    _eu.set(hash2(i, 5) * Math.PI, hash2(i, 7) * Math.PI, hash2(i, 9) * Math.PI);
    _q.setFromEuler(_eu);
    _vs.set(sc, sc * (0.7 + hash2(i, 13) * 0.5), sc);
    _vp.set(x, groundHeight(x, z) + sc * 0.18, z);
    _m4.compose(_vp, _q, _vs);
    rocks.setMatrixAt(rocksPlaced, _m4);
    const g = 0.42 + hash2(i, 57) * 0.2;
    _sky.setRGB(g, g * (0.97 + hash2(i, 61) * 0.06), g * (0.94 + hash2(i, 67) * 0.06));
    rocks.setColorAt(rocksPlaced, _sky);
    rocksPlaced++;
  }
  rocks.count = rocksPlaced; // unused instances would otherwise render as identity boulders at spawn
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  scene.add(rocks);

  // ---- trees: two archetypes, all instanced — 4 draw calls for the whole forest ----
  // placement: seeded rejection sampling; no trees on cliffsides, ridgetops, or the spawn clearing
  const treeSpots = [];
  for (let i = 0; i < 2600 && treeSpots.length < 440; i++) {
    const x = (hash2(i, 211) - 0.5) * 2 * 280;
    const z = (hash2(i, 223) - 0.5) * 2 * 280;
    const d = Math.hypot(x, z);
    if (d < 16) continue;
    if (cityDist(x, z) < CITY.r + 10) continue; // the city carves its clearing from the forest
    if (roadDist(x, z) < 4.5) continue;         // the road stays open
    let nearPlot = false;
    for (let pp = 0; pp < PLOT_COUNT; pp++) {
      const s = plotSpot(pp);
      if (Math.abs(x - s.x) < 8 && Math.abs(z - s.z) < 8) { nearPlot = true; break; }
    }
    if (nearPlot) continue; // residents' plots stay open
    if (groundSlope(x, z) > 0.55) continue;
    if (groundHeight(x, z) > 6.2) continue;
    treeSpots.push({ x, z, s: 0.75 + hash2(i, 227) * 0.7, kind: hash2(i, 229) < 0.58 ? 0 : 1, seed: i });
  }
  const conifers = treeSpots.filter((t) => t.kind === 0);
  const broadleafs = treeSpots.filter((t) => t.kind === 1);

  const trunkMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 });
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });

  function plantTrees(spots, trunkGeo, trunkH, canopyGeo, canopyY, canopyColors) {
    if (!spots.length) return;
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
    const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, spots.length);
    for (let i = 0; i < spots.length; i++) {
      const t = spots[i];
      const gy = groundHeight(t.x, t.z);
      _eu.set(0, hash2(t.seed, 233) * Math.PI * 2, 0);
      _q.setFromEuler(_eu);
      _vs.set(t.s, t.s, t.s);
      _vp.set(t.x, gy + (trunkH / 2 - 0.15) * t.s, t.z);
      _m4.compose(_vp, _q, _vs);
      trunks.setMatrixAt(i, _m4);
      _vp.set(t.x, gy + canopyY * t.s, t.z);
      _m4.compose(_vp, _q, _vs);
      canopies.setMatrixAt(i, _m4);
      const shade = 0.85 + hash2(t.seed, 239) * 0.3;
      _sky.setRGB(0.32 * shade, 0.24 * shade, 0.16 * shade);
      trunks.setColorAt(i, _sky);
      const golden = hash2(t.seed, 241) < 0.08; // a few autumn-gold trees in the green
      _sky.set(canopyColors[golden ? 2 : (hash2(t.seed, 251) < 0.5 ? 0 : 1)]);
      const v = 0.86 + hash2(t.seed, 257) * 0.28;
      _sky.multiplyScalar(v);
      canopies.setColorAt(i, _sky);
      // trunks are solid where the player can actually reach (same collider shape as World 1)
      if (Math.hypot(t.x, t.z) <= worldBounds + 5) {
        buildingColliders.push({ x: t.x, z: t.z, width: 0.55 * t.s + 0.25, depth: 0.55 * t.s + 0.25 });
      }
    }
    trunks.castShadow = true;
    canopies.castShadow = true;
    canopies.receiveShadow = true;
    scene.add(trunks);
    scene.add(canopies);
  }

  plantTrees(
    conifers,
    new THREE.CylinderGeometry(0.14, 0.22, 2.4, 6), 2.4,
    new THREE.ConeGeometry(1.5, 4.4, 7), 2.4 * 0.8 + 2.2,
    [0x2e4a32, 0x3a5638, 0x8a6b2e]
  );
  plantTrees(
    broadleafs,
    new THREE.CylinderGeometry(0.16, 0.26, 2.0, 6), 2.0,
    new THREE.IcosahedronGeometry(1.75, 0), 2.0 + 1.1,
    [0x4a6b35, 0x55763c, 0x8a7a3a]
  );

  // ---- grass: one instanced mesh of crossed quads wearing a procedural CanvasTexture ----
  grass = new THREE.InstancedMesh(
    makeGrassGeometry(),
    new THREE.MeshStandardMaterial({ map: makeGrassTexture(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1, metalness: 0 }),
    (GRASS_CELL_RADIUS * 2 + 1) * (GRASS_CELL_RADIUS * 2 + 1) * GRASS_PER_CELL
  );
  grass.receiveShadow = true;
  grass.frustumCulled = false; // matrices move with the player; one mesh, skip the stale-bounds cull
  scene.add(grass);

  // one sun, PCFSoft shadows, tight shadow camera that follows the player
  sunLight = new THREE.DirectionalLight(0xffffff, 2.0);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.camera.left = -48;
  sunLight.shadow.camera.right = 48;
  sunLight.shadow.camera.top = 48;
  sunLight.shadow.camera.bottom = -48;
  sunLight.shadow.camera.near = 2;
  sunLight.shadow.camera.far = 260;
  sunLight.shadow.bias = -0.0005;
  scene.add(sunLight);
  scene.add(sunLight.target);

  hemiLight = new THREE.HemisphereLight(0xbfd6e8, 0x4a4438, 1.0);
  scene.add(hemiLight);

  // sky elements ride an anchor pinned to the player, so they never drift close or fall behind
  skyAnchor = new THREE.Group();
  scene.add(skyAnchor);

  sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(9, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd9a0, fog: false, depthWrite: false })
  );
  skyAnchor.add(sunDisc);

  moonDisc = new THREE.Mesh(
    new THREE.CircleGeometry(5.5, 24),
    new THREE.MeshBasicMaterial({ color: 0xd8e2ef, fog: false, depthWrite: false, transparent: true, opacity: 0.92 })
  );
  skyAnchor.add(moonDisc);

  const starCount = 420;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const az = hash2(i, 101) * Math.PI * 2;
    const el = Math.asin(0.06 + hash2(i, 103) * 0.93);
    const r = 230;
    starPos[i * 3] = Math.cos(el) * Math.cos(az) * r;
    starPos[i * 3 + 1] = Math.sin(el) * r;
    starPos[i * 3 + 2] = Math.cos(el) * Math.sin(az) * r;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xeaf2ff, size: 1.7, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  skyAnchor.add(stars);

  buildCity();
  buildCivic();
  buildInteriors();
  buildLamps();
  buildFireflies();
  buildPlotPads();
}

// ---- Phase 3: the city — instanced boxes wearing procedural facade + emissive-window
// textures. Hundreds of windows, a handful of draw calls. The Bilawal-demo technique. ----
function makeFacadeTextures(cols, rows, opts) {
  opts = opts || {};
  const baseCol = opts.base || "#3a4049";
  const darkWin = opts.darkWin || "#14181f";
  const faceLit = opts.faceLit || "#322f27"; // dim on the facade — the night glow is emissive's job
  const litRatio = opts.litRatio === undefined ? 0.36 : opts.litRatio;
  const warm = opts.palette || ["#ffb066", "#ffd093", "#ffe9c4", "#bcd6ff"];
  const W = 192, H = 256;
  const face = document.createElement("canvas"); face.width = W; face.height = H;
  const glow = document.createElement("canvas"); glow.width = W; glow.height = H;
  const fc = face.getContext("2d"), gc = glow.getContext("2d");
  fc.fillStyle = baseCol; fc.fillRect(0, 0, W, H);
  for (let i = 0; i < 340; i++) { // concrete speckle
    const v = 44 + Math.floor(hash2(i, rows * 97) * 30);
    fc.fillStyle = "rgb(" + v + "," + (v + 3) + "," + (v + 7) + ")";
    fc.fillRect(hash2(i, 501) * W, hash2(i, 503) * H, 2, 2);
  }
  gc.fillStyle = "#000"; gc.fillRect(0, 0, W, H);
  const x0 = 10, y0 = 8, gw = (W - 20) / cols, gh = (H * 0.78) / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const wx = x0 + c * gw + 2, wy = y0 + r * gh + 2, ww = gw - 5, wh = gh - 6;
      const lit = hash2(c * 13 + cols, r * 29 + rows) < litRatio;
      fc.fillStyle = lit ? faceLit : darkWin;
      fc.fillRect(wx, wy, ww, wh);
      if (lit) {
        gc.fillStyle = warm[Math.floor(hash2(c * 7 + 3, r * 11 + 5) * warm.length)];
        gc.globalAlpha = 0.55 + hash2(c * 3, r * 17) * 0.45;
        gc.fillRect(wx, wy, ww, wh);
        gc.globalAlpha = 1;
      }
    }
  }
  // the unwindowed band at the canvas bottom = street level (flipY: canvas top is building top)
  const map = new THREE.CanvasTexture(face); map.colorSpace = THREE.SRGBColorSpace;
  const emissiveMap = new THREE.CanvasTexture(glow); emissiveMap.colorSpace = THREE.SRGBColorSpace;
  return { map, emissiveMap };
}

function buildCity() {
  // one composition per block, ALIGNED to the street grid — orderly rows, not scatter.
  // Archetypes: podium+tower (downtown, some glass), stepped tower, twin slabs, plain
  // tower, low slab pairs (edge ring). Every part is still a box instance: 3 draw calls.
  const towerParts = [], lowParts = [], glassParts = [];
  const solid = (x, z, w, d) => buildingColliders.push({ x, z, width: w, depth: d });

  for (let gi = -4; gi <= 3; gi++) {
    for (let gj = -4; gj <= 3; gj++) {
      const bx = CITY.x + gi * CITY.street + CITY.street / 2;
      const bz = CITY.z + gj * CITY.street + CITY.street / 2;
      const cd = Math.hypot(bx - CITY.x, bz - CITY.z);
      if (cd > CITY.r - 5) continue;
      if (cd < 11) continue; // plaza blocks stay open
      let civicHere = false;
      for (let ci = 0; ci < CIVICS.length; ci++) {
        if (CIVICS[ci].block[0] === gi && CIVICS[ci].block[1] === gj) { civicHere = true; break; }
      }
      if (civicHere) continue; // a civic tower stands here (built with its door in buildCivic)
      const s1 = hash2(gi * 7 + 103, gj * 13 + 59);
      const s2 = hash2(gi * 17 + 5, gj * 29 + 11);
      const seed = (gi + 9) * 100 + (gj + 9);
      const core = Math.max(0, 1 - cd / CITY.r);
      if (core > 0.55) {
        // downtown: podium + tower; some towers are glass
        lowParts.push({ x: bx, z: bz, w: 8.8, h: 2.8 + s2 * 1.2, d: 8.8, seed });
        (s2 < 0.45 ? glassParts : towerParts).push({ x: bx, z: bz, w: 5.4, h: 15 + s1 * 14, d: 5.4, seed: seed + 1 });
        solid(bx, bz, 8.8, 8.8);
      } else if (core > 0.3) {
        if (s1 < 0.34) {
          // stepped tower: wide base, thinner shaft rising past it
          towerParts.push({ x: bx, z: bz, w: 6.8, h: 8 + s2 * 5, d: 6.8, seed });
          towerParts.push({ x: bx, z: bz, w: 4.4, h: 13 + s2 * 7, d: 4.4, seed: seed + 1 });
          solid(bx, bz, 6.8, 6.8);
        } else if (s1 < 0.67) {
          // twin slabs, axis alternating by block parity — reads as rows along the streets
          const flip = (gi + gj) & 1;
          const ox = flip ? 0 : 2.55, oz = flip ? 2.55 : 0;
          const w = flip ? 8 : 3.7, d = flip ? 3.7 : 8;
          towerParts.push({ x: bx - ox, z: bz - oz, w, h: 9 + s2 * 7, d, seed });
          towerParts.push({ x: bx + ox, z: bz + oz, w, h: 9 + s1 * 6, d, seed: seed + 1 });
          solid(bx - ox, bz - oz, w, d);
          solid(bx + ox, bz + oz, w, d);
        } else {
          (s2 < 0.3 ? glassParts : towerParts).push({ x: bx, z: bz, w: 7, h: 10 + s2 * 9, d: 7, seed });
          solid(bx, bz, 7, 7);
        }
      } else {
        // edge ring: low and orderly
        if (s1 < 0.5) {
          lowParts.push({ x: bx, z: bz, w: 8.4, h: 3.2 + s2 * 2.4, d: 8.4, seed });
          solid(bx, bz, 8.4, 8.4);
        } else {
          const flip = (gi + gj) & 1;
          const ox = flip ? 0 : 2.55, oz = flip ? 2.55 : 0;
          const w = flip ? 7.8 : 3.5, d = flip ? 3.5 : 7.8;
          lowParts.push({ x: bx - ox, z: bz - oz, w, h: 3 + s2 * 2, d, seed });
          lowParts.push({ x: bx + ox, z: bz + oz, w, h: 3 + s1 * 2, d, seed: seed + 1 });
          solid(bx - ox, bz - oz, w, d);
          solid(bx + ox, bz + oz, w, d);
        }
      }
    }
  }

  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  boxGeo.translate(0, 0.5, 0); // origin at the base: scale = footprint + height directly
  const tTex = makeFacadeTextures(5, 13, { base: "#363c45", litRatio: 0.34 });
  towerMat = new THREE.MeshStandardMaterial({ map: tTex.map, emissive: 0xffffff, emissiveMap: tTex.emissiveMap, emissiveIntensity: 0.03, roughness: 0.85, metalness: 0.05 });
  const lTex = makeFacadeTextures(7, 5, { base: "#3d4140" });
  lowMat = new THREE.MeshStandardMaterial({ map: lTex.map, emissive: 0xffffff, emissiveMap: lTex.emissiveMap, emissiveIntensity: 0.03, roughness: 0.9, metalness: 0 });
  const gTex = makeFacadeTextures(6, 14, { base: "#2a3744", darkWin: "#1c2733", faceLit: "#2e3b48", litRatio: 0.5, palette: ["#cfe2ff", "#e8f1ff", "#ffe9c4", "#bcd6ff"] });
  glassMat = new THREE.MeshStandardMaterial({ map: gTex.map, emissive: 0xffffff, emissiveMap: gTex.emissiveMap, emissiveIntensity: 0.03, roughness: 0.55, metalness: 0.25 });

  function instanceParts(list, mat) {
    if (!list.length) return;
    const mesh = new THREE.InstancedMesh(boxGeo, mat, list.length);
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      _vp.set(b.x, groundHeight(b.x, b.z) - 0.5, b.z); // sunk foundation
      _q.identity();
      _vs.set(b.w, b.h + 0.5, b.d);
      _m4.compose(_vp, _q, _vs);
      mesh.setMatrixAt(i, _m4);
      const v = 0.82 + hash2(b.seed, 701) * 0.26;
      _sky.setRGB(v, v * (0.96 + hash2(b.seed, 703) * 0.07), v * (0.92 + hash2(b.seed, 709) * 0.12));
      mesh.setColorAt(i, _sky);
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }
  instanceParts(towerParts, towerMat);
  instanceParts(lowParts, lowMat);
  instanceParts(glassParts, glassMat);

  buildRoads();

  // plaza waymark — a quiet stone spire; the city has no name yet, and the stone doesn't pretend to one
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8e8a80, roughness: 0.85 });
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.9, 0.5, 18), stoneMat);
  plinth.position.set(CITY.x, groundHeight(CITY.x, CITY.z) + 0.25, CITY.z);
  plinth.castShadow = true; plinth.receiveShadow = true;
  scene.add(plinth);
  const spire = new THREE.Mesh(new THREE.BoxGeometry(0.6, 4.2, 0.6), new THREE.MeshStandardMaterial({ color: 0x6e685e, roughness: 0.7 }));
  spire.position.set(CITY.x, groundHeight(CITY.x, CITY.z) + 2.6, CITY.z);
  spire.castShadow = true;
  scene.add(spire);
  buildingColliders.push({ x: CITY.x, z: CITY.z, width: 3.4, depth: 3.4 });
}

// real, visible road geometry: instanced street strips on the flat plateau, a plaza disc,
// and a main-road ribbon that conforms to the hills from the spawn stone to the plaza
function buildRoads() {
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x3b3b39, roughness: 1, metalness: 0, side: THREE.DoubleSide });
  const strip = new THREE.PlaneGeometry(1, 1);
  strip.rotateX(-Math.PI / 2);
  const lines = [];
  for (let k = -3; k <= 3; k++) {
    const off = k * CITY.street;
    const half = Math.sqrt(Math.max(0, (CITY.r - 1.5) * (CITY.r - 1.5) - off * off));
    if (half < 6) continue;
    lines.push({ axis: 0, off, len: half * 2 });
    lines.push({ axis: 1, off, len: half * 2 });
  }
  const streets = new THREE.InstancedMesh(strip, roadMat, lines.length);
  _q.identity();
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    if (L.axis === 0) { _vp.set(CITY.x, CITY.base + 0.04, CITY.z + L.off); _vs.set(L.len, 1, 4.6); }
    else { _vp.set(CITY.x + L.off, CITY.base + 0.04, CITY.z); _vs.set(4.6, 1, L.len); }
    _m4.compose(_vp, _q, _vs);
    streets.setMatrixAt(i, _m4);
  }
  streets.receiveShadow = true;
  scene.add(streets);

  const plaza = new THREE.Mesh(new THREE.CircleGeometry(10, 36), roadMat);
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.set(CITY.x, CITY.base + 0.03, CITY.z);
  plaza.receiveShadow = true;
  scene.add(plaza);

  const len = Math.hypot(CITY.x, CITY.z);
  const ux = CITY.x / len, uz = CITY.z / len, nx = -uz, nz = ux;
  const t0 = 2.4 / len, t1 = 1 - 9.6 / len, segs = 72, wHalf = 2.1;
  const pos = new Float32Array((segs + 1) * 2 * 3);
  const idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = t0 + (t1 - t0) * (i / segs);
    const cx = CITY.x * t, cz = CITY.z * t;
    for (let s = 0; s < 2; s++) {
      const side = s === 0 ? -1 : 1;
      const x = cx + nx * wHalf * side, z = cz + nz * wHalf * side;
      const o = (i * 2 + s) * 3;
      pos[o] = x; pos[o + 1] = groundHeight(x, z) + 0.1; pos[o + 2] = z;
    }
    if (i < segs) {
      const a = i * 2, b = i * 2 + 1, c = i * 2 + 2, d = i * 2 + 3;
      idx.push(a, b, c, b, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const ribbon = new THREE.Mesh(geo, roadMat);
  ribbon.receiveShadow = true;
  scene.add(ribbon);
}

// street lamps: emissive bulbs only (no per-lamp lights — the glow illusion is fog + tone mapping)
function buildLamps() {
  const spots = [];
  const roadLen = Math.hypot(CITY.x, CITY.z);
  const nx = -CITY.z / roadLen, nz = CITY.x / roadLen;
  for (let i = 0; i < 22; i++) {
    const t = 0.06 + (i / 21) * 0.88;
    const side = i % 2 === 0 ? 1 : -1;
    spots.push({ x: CITY.x * t + nx * 3.1 * side, z: CITY.z * t + nz * 3.1 * side });
  }
  for (let k = -3; k <= 3; k++) {
    for (let l = -3; l <= 3; l++) {
      const lx = CITY.x + k * CITY.street + 2.9, lz = CITY.z + l * CITY.street + 2.9;
      if (cityDist(lx, lz) > CITY.r - 4) continue;
      spots.push({ x: lx, z: lz });
    }
  }
  const posts = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.06, 0.08, 3.4, 6),
    new THREE.MeshStandardMaterial({ color: 0x2c3138, roughness: 0.6, metalness: 0.4 }),
    spots.length
  );
  bulbMat = new THREE.MeshStandardMaterial({ color: 0x665d4a, emissive: 0xffd9a0, emissiveIntensity: 0.1, roughness: 0.5 });
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.17, 10, 8), bulbMat, spots.length);
  _q.identity();
  _vs.set(1, 1, 1);
  for (let i = 0; i < spots.length; i++) {
    const s = spots[i];
    const gy = groundHeight(s.x, s.z);
    _vp.set(s.x, gy + 1.7, s.z);
    _m4.compose(_vp, _q, _vs);
    posts.setMatrixAt(i, _m4);
    _vp.set(s.x, gy + 3.5, s.z);
    _m4.compose(_vp, _q, _vs);
    bulbs.setMatrixAt(i, _m4);
  }
  posts.castShadow = true;
  scene.add(posts);
  scene.add(bulbs);
}

// fireflies: one Points draw call, visible only at night, drifting on cheap sine paths
function buildFireflies() {
  fireflyBase = new Float32Array(FIREFLY_COUNT * 3);
  const pos = new Float32Array(FIREFLY_COUNT * 3);
  for (let i = 0; i < FIREFLY_COUNT; i++) {
    const a = hash2(i, 801) * Math.PI * 2;
    const dd = 12 + hash2(i, 807) * 100;
    const x = Math.cos(a) * dd, z = Math.sin(a) * dd;
    fireflyBase[i * 3] = x;
    fireflyBase[i * 3 + 1] = groundHeight(x, z) + 0.5 + hash2(i, 809) * 1.4;
    fireflyBase[i * 3 + 2] = z;
    pos[i * 3] = fireflyBase[i * 3];
    pos[i * 3 + 1] = fireflyBase[i * 3 + 1];
    pos[i * 3 + 2] = fireflyBase[i * 3 + 2];
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  fireflies = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xd8ffa0, size: 0.16, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  fireflies.frustumCulled = false;
  fireflies.visible = false;
  scene.add(fireflies);
}

function updateFireflies() {
  if (!fireflies || !fireflies.visible) return;
  const t = performance.now() * 0.001;
  const arr = fireflies.geometry.attributes.position.array;
  for (let i = 0; i < FIREFLY_COUNT; i++) {
    const p = i * 3;
    arr[p] = fireflyBase[p] + Math.sin(t * 0.5 + i * 1.7) * 1.6;
    arr[p + 1] = fireflyBase[p + 1] + Math.sin(t * 0.9 + i * 2.3) * 0.5;
    arr[p + 2] = fireflyBase[p + 2] + Math.cos(t * 0.45 + i * 1.1) * 1.6;
  }
  fireflies.geometry.attributes.position.needsUpdate = true;
}

// ---- grass helpers (procedural texture: zero downloads, zero copyright questions) ----
function makeGrassTexture() {
  const c = document.createElement("canvas");
  c.width = 64; c.height = 64;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, 64, 64);
  for (let i = 0; i < 9; i++) {
    const bx = 5 + hash2(i, 401) * 54;
    const lean = (hash2(i, 409) - 0.5) * 14;
    const w = 2.4 + hash2(i, 419) * 2.4;
    const top = 4 + hash2(i, 421) * 14;
    const g = 96 + Math.floor(hash2(i, 431) * 70);
    ctx.fillStyle = `rgb(${Math.floor(g * 0.55)},${g},${Math.floor(g * 0.42)})`;
    ctx.beginPath();
    ctx.moveTo(bx - w, 64);
    ctx.quadraticCurveTo(bx - w * 0.3 + lean * 0.4, 34, bx + lean, top);
    ctx.quadraticCurveTo(bx + w * 0.3 + lean * 0.4, 34, bx + w, 64);
    ctx.closePath();
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// two crossed quads, anchored at the bottom, normals up so grass takes light like the ground
function makeGrassGeometry() {
  const geo = new THREE.BufferGeometry();
  const w = 0.42, h = 0.6;
  const positions = new Float32Array([
    -w, 0, 0,  w, 0, 0,  w, h, 0,  -w, h, 0,
    0, 0, -w,  0, 0, w,  0, h, w,  0, h, -w
  ]);
  const uvs = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1]);
  const normals = new Float32Array(24);
  for (let i = 0; i < 8; i++) normals[i * 3 + 1] = 1;
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geo.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
  return geo;
}

// runs only when the player crosses a 10-unit cell boundary — never per frame
function updateGrass() {
  if (!grass || inInterior) return;
  const cx = Math.round(state.x / GRASS_CELL), cz = Math.round(state.z / GRASS_CELL);
  if (cx === grassCellX && cz === grassCellZ) return;
  grassCellX = cx; grassCellZ = cz;
  let idx = 0;
  for (let dxc = -GRASS_CELL_RADIUS; dxc <= GRASS_CELL_RADIUS; dxc++) {
    for (let dzc = -GRASS_CELL_RADIUS; dzc <= GRASS_CELL_RADIUS; dzc++) {
      const cellX = cx + dxc, cellZ = cz + dzc;
      for (let k = 0; k < GRASS_PER_CELL; k++) {
        // position is a pure function of (cellX, cellZ, k): tufts in cells you keep
        // walking through land in EXACTLY the same world spot every rebuild
        const x = (cellX + hash2(cellX * 31 + k * 7, cellZ * 57 + k * 13) - 0.5) * GRASS_CELL;
        const z = (cellZ + hash2(cellX * 17 + k * 11, cellZ * 91 + k * 5) - 0.5) * GRASS_CELL;
        const gy = groundHeight(x, z);
        let bare = groundSlope(x, z) > 0.55 || gy > 5.8 || Math.hypot(x, z) < 3.2 || pavedAt(x, z) > 0.25;
        if (!bare) {
          for (let ci = 0; ci < claimedPadCenters.length; ci++) {
            if (Math.abs(x - claimedPadCenters[ci].x) < 4.4 && Math.abs(z - claimedPadCenters[ci].z) < 4.4) { bare = true; break; }
          }
        }
        const s = bare ? 0.0001 : 0.7 + hash2(cellX * 13 + k, cellZ * 7 + k * 3) * 0.8;
        _vp.set(x, gy, z);
        _eu.set(0, hash2(cellX + k * 29, cellZ + k * 37) * Math.PI, 0);
        _q.setFromEuler(_eu);
        _vs.set(s, s, s);
        _m4.compose(_vp, _q, _vs);
        grass.setMatrixAt(idx, _m4);
        const v = 0.8 + hash2(cellX * 3 + k, cellZ * 11 + k) * 0.45;
        _sky.setRGB(0.62 * v, 0.78 * v, 0.5 * v);
        grass.setColorAt(idx, _sky);
        idx++;
      }
    }
  }
  grass.instanceMatrix.needsUpdate = true;
  if (grass.instanceColor) grass.instanceColor.needsUpdate = true;
}

// ---- Phase 4: presence + state (World 1's launch-night laws, ported verbatim) ----
function sanitizeDisplayName(raw) {
  if (!raw) return null;
  const s = String(raw).replace(/[<>&"']/g, "").trim().slice(0, 24);
  return s.length ? s : null;
}
function randomIdChunk() {
  return Math.random().toString(36).slice(2, 10);
}
function selfId() {
  if (!myId) myId = "guest:" + randomIdChunk() + randomIdChunk().slice(0, 4);
  return myId;
}
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function ensureIdentity() {
  if (displayName) return;
  const params = new URLSearchParams(location.search);
  displayName = sanitizeDisplayName(params.get("name")) || "Wanderer " + selfId().slice(6, 10);
  myColor = peerColors[hashStr(selfId()) % peerColors.length];
}

function makeNameSprite(name, scaleMul) {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 64;
  const ctx = c.getContext("2d");
  ctx.font = "600 30px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(8,12,16,0.55)";
  const tw = Math.min(244, ctx.measureText(name).width + 26);
  ctx.beginPath();
  ctx.roundRect((256 - tw) / 2, 8, tw, 48, 14);
  ctx.fill();
  ctx.fillStyle = "#eef4fa";
  ctx.fillText(name, 128, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(1.9 * (scaleMul || 1), 0.475 * (scaleMul || 1), 1);
  return sprite;
}

function buildAvatarBody(colorHex, name) {
  const group = new THREE.Group();
  const col = new THREE.Color(colorHex || "#4fa3ff");
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.3, 1.0, 10),
    new THREE.MeshStandardMaterial({ color: col, roughness: 0.7 })
  );
  body.position.y = 0.78;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.21, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xe8d3b8, roughness: 0.8 })
  );
  head.position.y = 1.46;
  head.castShadow = true;
  group.add(head);
  const plate = makeNameSprite(name || "Guest");
  plate.position.y = 1.95;
  group.add(plate);
  return group;
}

function remoteFootY(player) {
  return player.y - (player.stance === "crouch" ? crouchEyeHeight : standingEyeHeight);
}

function createRemote(player) {
  const group = buildAvatarBody(player.color, player.name);
  group.position.set(player.x, remoteFootY(player), player.z);
  group.rotation.y = player.yaw || 0;
  return {
    group,
    target: new THREE.Vector3(player.x, remoteFootY(player), player.z),
    targetYaw: player.yaw || 0,
    targetScaleY: player.stance === "crouch" ? 0.72 : 1,
    lastUpdate: performance.now(),
    buf: []
  };
}

function removeRemote(id) {
  const remote = remotes.get(id);
  if (!remote) return;
  scene.remove(remote.group);
  remote.group.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); }
  });
  remotes.delete(id);
}

function applyPeerState(player) {
  if (!player || !player.id || player.id === selfId()) return;
  player.name = sanitizeDisplayName(player.name) || "Guest";
  peers.set(player.id, player);
  let remote = remotes.get(player.id);
  if (!remote) {
    remote = createRemote(player);
    remotes.set(player.id, remote);
    scene.add(remote.group);
    updatePresenceChip();
  }
  remote.target.set(player.x, remoteFootY(player), player.z);
  remote.targetYaw = player.yaw;
  remote.targetScaleY = player.stance === "crouch" ? 0.72 : 1;
  remote.lastUpdate = performance.now();
  remote.buf.push({ t: remote.lastUpdate, x: player.x, y: remoteFootY(player), z: player.z, yaw: player.yaw });
  if (remote.buf.length > 10) remote.buf.shift();
}

function lerpAngle(a, b, k) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}

function updateRemotes(dt) {
  const blend = Math.min(1, dt * 12);
  // LAW: interpolation delay >= 2x the send interval (250ms at 10Hz). Less and network jitter
  // makes this flap between the buffered path and the chase fallback — that flap IS teleporting.
  const renderT = performance.now() - 250;
  for (const [id, remote] of remotes) {
    if (performance.now() - remote.lastUpdate > 20000) { removeRemote(id); updatePresenceChip(); continue; }
    const buf = remote.buf;
    if (buf && buf.length >= 2 && buf[buf.length - 1].t >= renderT) {
      while (buf.length > 2 && buf[1].t <= renderT) buf.shift();
      const a = buf[0], b = buf[1] || a;
      if (b.t - a.t > 1200) {
        // idle-resume guard: never glide across a keepalive gap — snap once to the fresh packet
        buf.splice(0, buf.length - 1);
        remote.group.position.set(b.x, b.y, b.z);
        remote.group.rotation.y = b.yaw;
        remote.group.scale.y += (remote.targetScaleY - remote.group.scale.y) * blend;
        continue;
      }
      const span = Math.max(1, b.t - a.t);
      const k = Math.max(0, Math.min(1, (renderT - a.t) / span));
      remote.group.position.set(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, a.z + (b.z - a.z) * k);
      remote.group.rotation.y = lerpAngle(a.yaw, b.yaw, k);
    } else {
      // dry buffer = they stopped moving. Hold/ease to the NEWEST buffered packet, never the
      // live target — the buffered path renders 250ms in the past; chasing live on every
      // pause/resume is a visible forward/back jump.
      if (buf && buf.length) {
        const hb = buf[buf.length - 1];
        remote.target.set(hb.x, hb.y, hb.z);
        remote.targetYaw = hb.yaw;
      }
      remote.group.position.lerp(remote.target, blend);
      remote.group.rotation.y = lerpAngle(remote.group.rotation.y, remote.targetYaw, blend);
    }
    remote.group.scale.y += (remote.targetScaleY - remote.group.scale.y) * blend;
  }
}

function trackSelf() {
  if (PREVIEW) return; // spectators are not residents
  // LAW: presence.track() is join/leave identity ONLY. It is called once on subscribe and
  // NEVER from the movement cycle (per-client presence rate limit throttles the whole socket).
  if (!channel) return;
  try {
    channel.track({ id: selfId(), name: displayName, color: myColor, x: state.x, y: state.y, z: state.z, yaw: state.yaw, stance: state.stance });
  } catch (e) {}
}

function sendState(force = false) {
  if (PREVIEW) return;
  if (!connected || !channel || !hasEntered) return;
  if (!force && sendAccumulator < 0.1) return; // LAW: state sends capped at 10Hz
  // LAW: idle suppression — skip sends when nothing visible changed; 5s keepalive while idle
  const sig = state.x.toFixed(2) + "|" + state.y.toFixed(2) + "|" + state.z.toFixed(2) + "|" + state.yaw.toFixed(1) + "|" + state.pitch.toFixed(1) + "|" + state.stance;
  if (!force && sig === lastSentSig && performance.now() - lastSentAt < 5000) return;
  lastSentSig = sig; lastSentAt = performance.now();
  sendAccumulator = 0;
  channel.send({
    type: "broadcast",
    event: "state",
    payload: { id: selfId(), name: displayName, color: myColor, x: state.x, y: state.y, z: state.z, yaw: state.yaw, pitch: state.pitch, stance: state.stance }
  });
}

function syncPresence() {
  if (!channel) return;
  const presenceState = channel.presenceState();
  const live = new Set();
  for (const key in presenceState) {
    const metas = presenceState[key];
    if (metas && metas[0]) {
      const meta = metas[0];
      const id = meta.id || key;
      if (!id || id === selfId()) continue;
      live.add(id);
      if (!peers.has(id) && typeof meta.x === "number") applyPeerState({ ...meta, id });
    }
  }
  for (const id of [...peers.keys()]) {
    if (!live.has(id)) {
      peers.delete(id);
      removeRemote(id);
    }
  }
  updatePresenceChip();
}

function scheduleReconnect() {
  if (!wantsConnection || reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (!wantsConnection) return;
    try { if (channel) supa.removeChannel(channel); } catch (e) {}
    channel = null;
    connect();
  }, 2200);
}

function connect() {
  if (!wantsConnection || channel) return;
  ensureIdentity();
  if (!supa) supa = createClient(SUPA_URL, SUPA_KEY);
  channel = supa.channel(W2_CHANNEL, {
    config: {
      presence: { key: selfId() },
      broadcast: { self: false }
    }
  });
  channel.on("broadcast", { event: "state" }, ({ payload }) => applyPeerState(payload));
  channel.on("broadcast", { event: "space" }, ({ payload }) => {
    if (payload && payload.id !== selfId() && typeof payload.plot === "number") refetchPlot(payload.plot);
  });
  channel.on("presence", { event: "sync" }, () => syncPresence());
  channel.on("presence", { event: "leave" }, ({ leftPresences }) => {
    for (const p of leftPresences || []) {
      if (!p.id || p.id === selfId()) continue;
      peers.delete(p.id);
      removeRemote(p.id);
    }
    updatePresenceChip();
  });
  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      connected = true;
      trackSelf(); // once, at join — identity only
      sendState(true);
      updatePresenceChip();
    } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
      connected = false;
      scheduleReconnect();
    }
  });
}

function updatePresenceChip() {
  if (!presenceChip) return;
  const n = remotes.size;
  const label = !connected ? "connecting" : n === 0 ? "alone here" : n === 1 ? "1 other here" : n + " others here";
  if (presenceChip.textContent !== label) presenceChip.textContent = label;
}

// ---- Phase 5.5: civic towers with doors in their faces (the World 1 way), and
// walk-in interiors styled for this world. The buildings ARE the city — no gaps, no portals. ----
function buildCivic() {
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  boxGeo.translate(0, 0.5, 0);
  const civicMesh = new THREE.InstancedMesh(boxGeo, towerMat, CIVICS.length);
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x07090c, roughness: 0.55 });
  const padMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e2, roughness: 0.5, emissive: 0xffffff, emissiveIntensity: 0.08 });
  for (let i = 0; i < CIVICS.length; i++) {
    const c = CIVICS[i];
    const x = CITY.x + c.block[0] * CITY.street + CITY.street / 2;
    const z = CITY.z + c.block[1] * CITY.street + CITY.street / 2;
    const gy = groundHeight(x, z);
    const W = 9.6;
    _vp.set(x, gy - 0.5, z);
    _q.identity();
    _vs.set(W, c.h + 0.5, W);
    _m4.compose(_vp, _q, _vs);
    civicMesh.setMatrixAt(i, _m4);
    _sky.set(c.tint);
    civicMesh.setColorAt(i, _sky);
    buildingColliders.push({ x, z, width: W, depth: W });
    // the door sits on the plaza-facing side, snapped to the dominant axis
    const lx = x - CITY.x, lz = z - CITY.z;
    let dx = 0, dz = 0;
    if (Math.abs(lx) >= Math.abs(lz)) dx = lx > 0 ? -1 : 1; else dz = lz > 0 ? -1 : 1;
    const doorX = x + dx * (W / 2 + 0.05), doorZ = z + dz * (W / 2 + 0.05);
    const doorway = new THREE.Mesh(new THREE.BoxGeometry(dx === 0 ? 2.4 : 0.5, 3.4, dz === 0 ? 2.4 : 0.5), doorMat);
    doorway.position.set(doorX, gy + 1.7, doorZ);
    scene.add(doorway);
    const stepPad = new THREE.Mesh(new THREE.BoxGeometry(dx === 0 ? 3.6 : 2.4, 0.16, dz === 0 ? 3.6 : 2.4), padMat);
    stepPad.position.set(x + dx * (W / 2 + 1.4), gy + 0.08, z + dz * (W / 2 + 1.4));
    stepPad.receiveShadow = true;
    scene.add(stepPad);
    const sign = makeNameSprite(c.label, 2.1);
    sign.position.set(doorX + dx * 0.6, gy + 5.0, doorZ + dz * 0.6);
    scene.add(sign);
    doors.push({ label: c.label, x: x + dx * (W / 2 + 1.6), z: z + dz * (W / 2 + 1.6), hw: 2.6, hd: 2.6, act: c.act });
  }
  civicMesh.castShadow = true;
  civicMesh.receiveShadow = true;
  scene.add(civicMesh);
}

// ---- walk-in interiors (Theater / Arcade / Library), this world's own style:
// dark cinematic rooms, emissive light, honest signs. Same body as World 1 — the library
// shelves open the SAME real free-knowledge sources, the booth opens the same pages. ----
function roomShell(id, wHalf, dHalf, wallColor) {
  const r = ROOM[id];
  const mat = new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.95 });
  const floor = new THREE.Mesh(new THREE.BoxGeometry(wHalf * 2, 0.4, dHalf * 2), new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 0.9 }));
  floor.position.set(r.x, -0.2, r.z);
  floor.receiveShadow = true;
  scene.add(floor);
  const ceil = new THREE.Mesh(new THREE.BoxGeometry(wHalf * 2, 0.3, dHalf * 2), mat);
  ceil.position.set(r.x, 6.4, r.z);
  scene.add(ceil);
  const wallDefs = [
    { x: r.x, z: r.z - dHalf, w: wHalf * 2, d: 0.4 },
    { x: r.x, z: r.z + dHalf, w: wHalf * 2, d: 0.4 },
    { x: r.x - wHalf, z: r.z, w: 0.4, d: dHalf * 2 },
    { x: r.x + wHalf, z: r.z, w: 0.4, d: dHalf * 2 }
  ];
  for (const wd of wallDefs) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(wd.w, 6.5, wd.d), mat);
    wall.position.set(wd.x, 3.05, wd.z);
    scene.add(wall);
    interiorColliders[id].push({ x: wd.x, z: wd.z, width: wd.w, depth: wd.d });
  }
  // exit door: glowing slab on the south wall + station
  const exitMesh = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3.2, 0.5), new THREE.MeshStandardMaterial({ color: 0x0d1a12, emissive: 0x7bd88f, emissiveIntensity: 0.35, roughness: 0.6 }));
  exitMesh.position.set(r.x, 1.6, r.z + dHalf - 0.45);
  scene.add(exitMesh);
  interiorStations[id].push({ label: "Exit to the city", x: r.x, z: r.z + dHalf - 1.4, hw: 1.8, hd: 1.6, act: { type: "exit" } });
}

function buildInteriors() {
  // THEATER — dark hall, glowing screen wall, seat rows. Honest: first screening coming soon.
  roomShell("theater", 13, 9, 0x241f22);
  const tr = ROOM.theater;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(16, 5.4), new THREE.MeshStandardMaterial({ color: 0x0a0d12, emissive: 0xcfe2ff, emissiveIntensity: 0.85, roughness: 0.4 }));
  screen.position.set(tr.x, 3.1, tr.z - 8.7);
  scene.add(screen);
  const nowShowing = makeNameSprite("NOW SHOWING \u00b7 first screening coming soon", 1.7);
  nowShowing.position.set(tr.x, 3.1, tr.z - 8.2);
  scene.add(nowShowing);
  // Real theater chairs (June 10): cushion + backrest sharing one matrix set - two draw
  // calls for 24 seats, all facing the screen. The old cubes read as boxes, not chairs.
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x7a3640, roughness: 0.85 });
  const backMat = new THREE.MeshStandardMaterial({ color: 0x652c36, roughness: 0.85 });
  const cushionGeo = new THREE.BoxGeometry(0.95, 0.5, 0.9);
  cushionGeo.translate(0, 0.25, 0);
  const backGeo = new THREE.BoxGeometry(0.95, 1.05, 0.18);
  backGeo.translate(0, 0.92, 0.36);
  const cushions = new THREE.InstancedMesh(cushionGeo, seatMat, 24);
  const backs = new THREE.InstancedMesh(backGeo, backMat, 24);
  let si = 0;
  _q.identity(); _vs.set(1, 1, 1);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 6; col++) {
      _vp.set(tr.x - 5 + col * 2 + (row % 2) * 0.5, 0, tr.z - 3.6 + row * 2.2);
      _m4.compose(_vp, _q, _vs);
      cushions.setMatrixAt(si, _m4);
      backs.setMatrixAt(si, _m4);
      si++;
    }
  }
  cushions.castShadow = true;
  backs.castShadow = true;
  scene.add(cushions);
  scene.add(backs);
  interiorStations.theater.push({ label: "Theater page \u00b7 pick your seat soon", x: tr.x + 9.5, z: tr.z + 5.5, hw: 2, hd: 2, act: { type: "page", path: "/video" } });

  // ARCADE — neon dark, one REAL cabinet (President Sim lives on the Games page), honest shells.
  roomShell("arcade", 11, 8, 0x171c26);
  const ar = ROOM.arcade;
  const neon = new THREE.Mesh(new THREE.BoxGeometry(21, 0.18, 0.18), new THREE.MeshStandardMaterial({ color: 0x0a0f14, emissive: 0x57d8c4, emissiveIntensity: 1.4 }));
  neon.position.set(ar.x, 5.6, ar.z - 7.6);
  scene.add(neon);
  const cabGeo = new THREE.BoxGeometry(1.5, 2.4, 1.1);
  cabGeo.translate(0, 1.2, 0);
  const cabMat = new THREE.MeshStandardMaterial({ color: 0x10141c, roughness: 0.7 });
  const cabs = [[-6, "PRESIDENT SIM", true], [-2, "coming soon", false], [2, "coming soon", false], [6, "coming soon", false]];
  for (const [ox, label, live] of cabs) {
    const cab = new THREE.Mesh(cabGeo, cabMat);
    cab.position.set(ar.x + ox, 0, ar.z - 6.6);
    cab.castShadow = true;
    scene.add(cab);
    const screenP = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.85), new THREE.MeshStandardMaterial({ color: 0x05140c, emissive: live ? 0x6fe89a : 0x111418, emissiveIntensity: live ? 1.1 : 0.15 }));
    screenP.position.set(ar.x + ox, 1.55, ar.z - 6.04);
    scene.add(screenP);
    const cs = makeNameSprite(label, live ? 1.2 : 0.95);
    cs.position.set(ar.x + ox, 2.95, ar.z - 6.2);
    scene.add(cs);
    interiorColliders.arcade.push({ x: ar.x + ox, z: ar.z - 6.6, width: 1.5, depth: 1.1 });
    if (live) interiorStations.arcade.push({ label: "Play President Sim \u00b7 Games page", x: ar.x + ox, z: ar.z - 5.2, hw: 1.6, hd: 1.4, act: { type: "page", path: "/games" } });
  }

  // LIBRARY — shelves of real free knowledge (the same eight sources World 1's hall opens) + the writing desk.
  roomShell("library", 13, 9, 0x2a2118);
  const lr = ROOM.library;
  const shelfGeo = new THREE.BoxGeometry(2.6, 3.4, 0.7);
  shelfGeo.translate(0, 1.7, 0);
  const shelfMat = new THREE.MeshStandardMaterial({ color: 0x4a3826, roughness: 0.85 });
  const spineGeo = new THREE.BoxGeometry(0.34, 0.55, 0.18);
  const spineColors = [0xb84a4a, 0x4a7ab8, 0x4ab86e, 0xb8a44a, 0x8a4ab8, 0xb8784a];
  const spines = new THREE.InstancedMesh(spineGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }), 8 * 6);
  const SOURCES = [
    ["Khan Academy", "https://www.khanacademy.org"],
    ["Open Library", "https://openlibrary.org"],
    ["Wikipedia", "https://www.wikipedia.org"],
    ["Project Gutenberg", "https://www.gutenberg.org"],
    ["LibriVox", "https://librivox.org"],
    ["Standard Ebooks", "https://standardebooks.org"],
    ["Wikisource", "https://wikisource.org"],
    ["OpenStax", "https://openstax.org"]
  ];
  let spi = 0;
  _q.identity();
  for (let i = 0; i < 8; i++) {
    const side = i < 4 ? -1 : 1;
    // South row leaves the exit doorway clear (the old spacing put a shelf dead-center
    // in front of the door - Jaron walked into it). Door zone is +/-1.8 around center.
    const ox = side > 0 ? [-10, -5.4, 5.4, 10][i % 4] : (-9 + (i % 4) * 4.6);
    const sx = lr.x + ox, sz = lr.z + side * 7.6;
    const shelf = new THREE.Mesh(shelfGeo, shelfMat);
    shelf.position.set(sx, 0, sz);
    shelf.castShadow = true;
    scene.add(shelf);
    interiorColliders.library.push({ x: sx, z: sz, width: 2.6, depth: 0.7 });
    for (let b = 0; b < 6; b++) {
      _vp.set(sx - 0.95 + b * 0.38, 1.2 + (b % 2) * 0.9, sz + side * -0.45);
      _vs.set(1, 1, 1);
      _m4.compose(_vp, _q, _vs);
      spines.setMatrixAt(spi, _m4);
      _sky.set(spineColors[(i + b) % spineColors.length]);
      spines.setColorAt(spi, _sky);
      spi++;
    }
    const label = makeNameSprite(SOURCES[i][0], 1.25);
    label.position.set(sx, 4.1, sz);
    scene.add(label);
    interiorStations.library.push({ label: "Open " + SOURCES[i][0], x: sx, z: sz + side * -1.5, hw: 1.7, hd: 1.5, act: { type: "ext", url: SOURCES[i][1] } });
  }
  scene.add(spines);
  const desk = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.0, 1.4), shelfMat);
  desk.position.set(lr.x + 9.5, 0.5, lr.z + 3);
  desk.castShadow = true;
  scene.add(desk);
  interiorColliders.library.push({ x: lr.x + 9.5, z: lr.z + 3, width: 3.4, depth: 1.4 });
  const deskSign = makeNameSprite("Write a book \u00b7 Written Here", 1.35);
  deskSign.position.set(lr.x + 9.5, 2.4, lr.z + 3);
  scene.add(deskSign);
  interiorStations.library.push({ label: "Write a book \u00b7 Written Here", x: lr.x + 9.5, z: lr.z + 1.6, hw: 1.9, hd: 1.5, act: { type: "page", path: "/library" } });
}

function enterInterior(id) {
  if (!ROOM[id]) return;
  interiorReturn = { x: state.x, z: state.z, yaw: state.yaw };
  inInterior = id;
  state.x = ROOM[id].x;
  state.z = ROOM[id].z + 6.2;
  state.yaw = Math.PI; // face into the room
  if (grass) grass.visible = false;
}

function exitInterior() {
  inInterior = null;
  if (interiorReturn) {
    state.x = interiorReturn.x;
    state.z = interiorReturn.z;
    state.yaw = interiorReturn.yaw;
  }
  if (grass) { grass.visible = true; grassCellX = 1e9; }
}

// plots ring the OUTSKIRTS — residents build the city's edge, the core stays civic
function plotSpot(i) {
  let a = (i / PLOT_COUNT) * Math.PI * 2 + 0.32;
  let x = CITY.x + Math.cos(a) * (CITY.r + 13);
  let z = CITY.z + Math.sin(a) * (CITY.r + 13);
  if (roadDist(x, z) < 7) {
    a += 0.38;
    x = CITY.x + Math.cos(a) * (CITY.r + 13);
    z = CITY.z + Math.sin(a) * (CITY.r + 13);
  }
  return { x, z };
}

function buildPlotPads() {
  const padMat = new THREE.MeshStandardMaterial({ color: 0x8e8a80, roughness: 0.85 });
  for (let i = 0; i < PLOT_COUNT; i++) {
    const s = plotSpot(i);
    const pad = { plot: i, x: s.x, z: s.z, claimed: false, row: null, group: null, sign: null };
    plotPads.push(pad);
    const gy = groundHeight(pad.x, pad.z);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.3, 0.22, 22), padMat);
    disc.position.set(pad.x, gy + 0.11, pad.z);
    disc.receiveShadow = true;
    scene.add(disc);
    const sign = makeNameSprite("Empty plot \u00b7 sign in to claim", 1.25);
    sign.position.set(pad.x, gy + 2.2, pad.z);
    scene.add(sign);
    pad.sign = sign;
    pad.pad = disc;
  }
}

// a claimed plot becomes a real building, automatically — same law as World 1
function applySpaceRow(pad, row) {
  if (!pad || !row || !row.github_url || pad.claimed) return;
  pad.claimed = true;
  pad.row = row;
  if (pad.sign) { scene.remove(pad.sign); pad.sign = null; }
  claimedPadCenters.push({ x: pad.x, z: pad.z });
  const gy = groundHeight(pad.x, pad.z);
  const h = 9 + (hashStr(String(row.project_name || pad.plot)) % 9);
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  boxGeo.translate(0, 0.5, 0);
  const tower = new THREE.Mesh(boxGeo, glassMat);
  tower.position.set(pad.x, gy - 0.4, pad.z);
  tower.scale.set(6.2, h, 6.2);
  tower.castShadow = true;
  tower.receiveShadow = true;
  scene.add(tower);
  const sign = makeNameSprite((row.project_name || "Project") + " · " + (row.claimed_by || "Resident"), 1.45);
  sign.position.set(pad.x, gy + h + 0.9, pad.z);
  scene.add(sign);
  pad.group = tower;
  pad.topSign = sign;
  buildingColliders.push({ x: pad.x, z: pad.z, width: 6.2, depth: 6.2 });
  doors.push({ label: (row.project_name || "Project") + " \u2014 Project Hall", x: pad.x, z: pad.z, hw: 4.8, hd: 4.8, act: { type: "page", path: "/space/?plot=" + pad.plot + "&world=world2" } });
  if (grass) { grassCellX = 1e9; } // force a grass rebuild so tufts clear the new footprint
}

async function loadSpaces() {
  if (spacesLoaded || !supa) return;
  spacesLoaded = true;
  const refetch = async () => {
    try {
      const { data } = await supa.from("world_spaces")
        .select("plot, github_url, project_name, claimed_by, repo_metadata, repo_fetched_at, space_type")
        .eq("world", "world2");
      for (const row of data || []) {
        const pad = plotPads[row.plot];
        if (pad && !pad.claimed) applySpaceRow(pad, row);
      }
      if ((data || []).some((r) => r.space_type === "repo" && !r.repo_fetched_at)) {
        try { fetch("/api/enrich-world-spaces").catch(() => {}); } catch (e) {}
      }
    } catch (e) {}
  };
  await refetch();
  // LAW: postgres_changes is unreliable on this project — shared objects sync by
  // broadcast events + a ground-truth reconcile refetch loop (World 1's prop pattern).
  if (!spacesTimer) spacesTimer = setInterval(refetch, 30000);
}

function updateActiveDoor() {
  if (!hasEntered) { activeDoor = null; activePlot = null; return; }
  const list = inInterior ? interiorStations[inInterior] : doors;
  let next = null, best = Infinity;
  for (const door of list) {
    const dx = state.x - door.x, dz = state.z - door.z;
    if (Math.abs(dx) > door.hw || Math.abs(dz) > door.hd) continue;
    const d = Math.hypot(dx, dz);
    if (d < best) { best = d; next = door; }
  }
  activeDoor = next;
  let nextPlot = null;
  if (!next && !inInterior) {
    let bp = Infinity;
    for (const pad of plotPads) {
      if (pad.claimed) continue;
      const dx = state.x - pad.x, dz = state.z - pad.z;
      if (Math.abs(dx) > 4 || Math.abs(dz) > 4) continue;
      const d = Math.hypot(dx, dz);
      if (d < bp) { bp = d; nextPlot = pad; }
    }
  }
  activePlot = nextPlot;
  if (doorPrompt && doorPromptText) {
    if (activeDoor) {
      doorPromptText.textContent = (isTouch ? "Tap — " : "Press E — ") + activeDoor.label;
      doorPrompt.classList.remove("hidden");
      if (doorEnterBtn) doorEnterBtn.classList.add("active");
    } else if (activePlot) {
      doorPromptText.textContent = (isTouch ? "Tap — " : "Press E — ") + "Claim this plot with a GitHub repo";
      doorPrompt.classList.remove("hidden");
      if (doorEnterBtn) doorEnterBtn.classList.add("active");
    } else {
      doorPrompt.classList.add("hidden");
      if (doorEnterBtn) doorEnterBtn.classList.remove("active");
    }
  }
}

function enterActive() {
  if (claimOverlay && claimOverlay.style.display === "flex") return;
  if (activeDoor) {
    const act = activeDoor.act || { type: "page", path: activeDoor.path };
    if (act.type === "interior") enterInterior(act.id);
    else if (act.type === "exit") exitInterior();
    else if (act.type === "ext") { try { window.open(act.url, "_blank", "noopener"); } catch (e) {} }
    else location.assign(act.path);
    activeDoor = null;
    return;
  }
  if (activePlot) openClaim(activePlot);
}

function openClaim(pad) {
  currentClaimPlot = pad;
  if (!claimOverlay) return;
  claimError.textContent = "";
  claimInput.value = "";
  claimOverlay.style.display = "flex";
  setTimeout(() => { try { claimInput.focus(); } catch (e) {} }, 50);
}

function closeClaim() {
  currentClaimPlot = null;
  if (claimOverlay) claimOverlay.style.display = "none";
}

async function submitClaim() {
  if (!currentClaimPlot) return;
  if (!myUserId) {
    claimError.textContent = "Sign in on the account page to claim a permanent space — guests can look around, residents plant buildings.";
    return;
  }
  const url = claimInput.value.trim();
  if (!supa) { claimError.textContent = "Still connecting — try again in a moment."; return; }
  claimError.textContent = "Claiming…";
  try {
    // Same gated RPC as World 1, now world-aware: sign-in enforced at the database,
    // URL validated, one project space per account, owner recorded.
    const { data, error } = await supa.rpc("claim_repo", { p_plot: currentClaimPlot.plot, p_url: url, p_world: "world2" });
    if (error || !data || !data.ok) {
      const e = (data && data.error) || "";
      claimError.textContent =
        e === "signin" ? "Sign in to claim a permanent space — then it's yours, tied to your account." :
        e === "plot_taken" ? "That plot was just claimed by someone else." :
        e === "already_claimed" ? "One project space per account — yours is already standing (maybe in the town)." :
        e === "bad_url" ? "Enter a full GitHub link (github.com/owner/project)." :
        "Could not save the claim.";
      return;
    }
    const pad = currentClaimPlot;
    applySpaceRow(pad, { github_url: url, project_name: data.project_name, claimed_by: displayName });
    closeClaim();
    try { fetch("/api/enrich-world-spaces").catch(() => {}); } catch (e) {}
    if (channel && connected) {
      try { channel.send({ type: "broadcast", event: "space", payload: { id: selfId(), plot: pad.plot } }); } catch (e) {}
    }
  } catch (e) {
    claimError.textContent = "Could not save the claim.";
  }
}

async function refetchPlot(plotIndex) {
  if (!supa) return;
  try {
    const { data } = await supa.from("world_spaces")
      .select("plot, github_url, project_name, claimed_by, repo_metadata, repo_fetched_at, space_type")
      .eq("world", "world2").eq("plot", plotIndex);
    if (data && data[0]) {
      const pad = plotPads[plotIndex];
      if (pad && !pad.claimed) applySpaceRow(pad, data[0]);
    }
  } catch (e) {}
}

// identity plug-in: the same account is ONE person across both worlds
async function resolveIdentity() {
  try {
    if (!supa) supa = createClient(SUPA_URL, SUPA_KEY);
    const { data: { session } } = await supa.auth.getSession();
    if (session && session.user) {
      myUserId = session.user.id;
      const { data } = await supa.from("world_characters").select("display_name, appearance").eq("auth_user_id", myUserId);
      if (data && data[0]) {
        if (data[0].display_name) displayName = sanitizeDisplayName(data[0].display_name) || displayName;
        const ap = data[0].appearance;
        if (ap && typeof ap.color === "string" && /^#[0-9a-f]{6}$/i.test(ap.color)) myColor = ap.color;
      }
      if (channel && connected) { trackSelf(); sendState(true); } // one re-track: identity changed, not movement
    }
  } catch (e) {}
  loadSpaces();
}

// ---- day/night (wall-clock driven like World 1: every visitor sees the same sky) ----
function pickSky(e) {
  if (e > 0.18) _sky.copy(W2_DAY);
  else if (e > 0) _sky.copy(W2_DUSK).lerp(W2_DAY, e / 0.18);
  else if (e > -0.22) _sky.copy(W2_NIGHT).lerp(W2_DUSK, (e + 0.22) / 0.22);
  else _sky.copy(W2_NIGHT);
  return _sky;
}

function updateDayNight() {
  if (!sunLight) return;
  const CYCLE = 300;
  const t = ((Date.now() / 1000) % CYCLE) / CYCLE;
  const a = t * Math.PI * 2;
  const e = Math.sin(a);
  const horiz = Math.cos(a);
  const day = Math.max(0, Math.min(1, e * 1.6 + 0.08));

  _sunOff.set(horiz * 60, e * 70, 24 + e * 6);
  sunLight.position.set(state.x + _sunOff.x, _sunOff.y, state.z + _sunOff.z);
  sunLight.target.position.set(state.x, 0, state.z);
  sunLight.intensity = 0.1 + 2.2 * day;
  sunLight.color.setRGB(1, 0.92 - 0.16 * (1 - day), 0.82 - 0.28 * (1 - day));
  if (hemiLight) hemiLight.intensity = 0.32 + 0.85 * Math.max(0, Math.min(1, e + 0.3));

  // atmosphere driven by the cycle: sky, fog color AND density, tone exposure
  const sky = pickSky(e);
  scene.background.copy(sky);
  scene.fog.color.copy(sky);
  // golden hour: fog leans warmer than the sky itself — distant trees melt into amber
  const golden = Math.max(0, 1 - Math.abs(e) / 0.18);
  if (golden > 0) scene.fog.color.lerp(W2_DUSK, golden * 0.3);
  scene.fog.density = 0.0095 + (1 - day) * 0.0065;
  renderer.toneMappingExposure = 0.92 + 0.24 * day;

  if (skyAnchor) skyAnchor.position.set(state.x, 0, state.z);
  if (sunDisc) {
    const len = _sunOff.length() || 1;
    sunDisc.position.set(_sunOff.x / len * 215, _sunOff.y / len * 215, _sunOff.z / len * 215);
    sunDisc.visible = e > -0.08;
    sunDisc.material.color.setRGB(1, 0.74 + 0.2 * day, 0.5 + 0.42 * day);
    sunDisc.lookAt(camera.position);
  }
  if (moonDisc) {
    const len = _sunOff.length() || 1;
    moonDisc.position.set(-_sunOff.x / len * 205, -_sunOff.y / len * 205, -_sunOff.z / len * 205);
    moonDisc.visible = e < 0.08;
    moonDisc.lookAt(camera.position);
  }
  const nightF = Math.max(0, Math.min(1, -e * 1.5 + 0.1));
  if (stars) stars.material.opacity = nightF * 0.95;

  // the night-city moment: windows brighten exactly as the sky darkens
  const glow = 0.03 + Math.pow(1 - day, 1.6) * 1.5;
  if (towerMat) towerMat.emissiveIntensity = glow;
  if (lowMat) lowMat.emissiveIntensity = glow;
  if (glassMat) glassMat.emissiveIntensity = glow * 0.9;
  if (bulbMat) bulbMat.emissiveIntensity = 0.1 + (1 - day) * 2.4;
  if (fireflies) {
    fireflies.visible = nightF > 0.04;
    fireflies.material.opacity = nightF * 0.9;
  }

  if (timeChip) {
    const label = e > 0.25 ? "daylight" : e > 0 ? "golden hour" : e > -0.12 ? "dusk" : "night";
    if (timeChip.textContent !== label) timeChip.textContent = label;
  }
}

// ---- movement (World 1's feel, ground-following from day one) ----
function eyeHeightForStance(stance) {
  return stance === "crouch" ? crouchEyeHeight : standingEyeHeight;
}

function updateLocal(dt) {
  if (!hasEntered) {
    motion.sprinting = false;
    motion.moving = false;
    input.jumpQueued = false;
    state.stance = "stand";
    return;
  }

  let forward = 0;
  let strafe = 0;
  const crouching = keys.has("ControlLeft") || keys.has("ControlRight") || keys.has("KeyC") || input.crouchHeld;

  if (keys.has("KeyW") || keys.has("ArrowUp")) forward += 1;
  if (keys.has("KeyS") || keys.has("ArrowDown")) forward -= 1;
  if (keys.has("KeyA") || keys.has("ArrowLeft")) strafe -= 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) strafe += 1;

  forward += input.moveY;
  strafe += input.moveX;

  const length = Math.hypot(forward, strafe);
  if (length > 1) {
    forward /= length;
    strafe /= length;
  }

  state.stance = crouching ? "crouch" : "stand";

  if (input.jumpQueued && motion.onGround && !crouching) {
    motion.verticalVelocity = jumpVelocity;
    motion.onGround = false;
  }
  input.jumpQueued = false;

  if (!motion.onGround) {
    motion.verticalVelocity -= gravity * dt;
    motion.airOffset += motion.verticalVelocity * dt;
    if (motion.airOffset <= 0) {
      motion.airOffset = 0;
      motion.verticalVelocity = 0;
      motion.onGround = true;
    }
  }

  const wantsSprint = (keys.has("ShiftLeft") || keys.has("ShiftRight")) && forward > 0 && !crouching && motion.onGround;
  motion.sprinting = wantsSprint;
  motion.moving = Math.abs(forward) + Math.abs(strafe) > 0.01;

  const speed = crouching ? 2.45 : wantsSprint ? 7.2 : 4.65;
  const sin = Math.sin(state.yaw);
  const cos = Math.cos(state.yaw);

  state.x += (cos * strafe + -sin * forward) * speed * dt;
  state.z += (-sin * strafe + -cos * forward) * speed * dt;

  resolveCollision();
  updateActiveDoor();

  const floorY = inInterior ? 0 : groundHeight(state.x, state.z);
  const eyeTarget = eyeHeightForStance(state.stance) + floorY + motion.airOffset;
  state.y += (eyeTarget - state.y) * Math.min(1, dt * 14);
}

function resolveCollision() {
  if (inInterior) {
    const r = ROOM[inInterior];
    state.x = Math.max(r.x - 12.4, Math.min(r.x + 12.4, state.x));
    state.z = Math.max(r.z - 8.4, Math.min(r.z + 8.4, state.z));
  } else {
    state.x = Math.max(-worldBounds, Math.min(worldBounds, state.x));
    state.z = Math.max(-worldBounds, Math.min(worldBounds, state.z));
  }
  const colliderList = inInterior ? interiorColliders[inInterior] : buildingColliders;
  for (const collider of colliderList) {
    const halfW = collider.width / 2 + playerRadius;
    const halfD = collider.depth / 2 + playerRadius;
    const dx = state.x - collider.x;
    const dz = state.z - collider.z;
    if (Math.abs(dx) >= halfW || Math.abs(dz) >= halfD) continue;
    const pushX = halfW - Math.abs(dx);
    const pushZ = halfD - Math.abs(dz);
    if (pushX < pushZ) state.x += dx < 0 ? -pushX : pushX;
    else state.z += dz < 0 ? -pushZ : pushZ;
  }
}

function look(deltaX, deltaY) {
  const sensitivity = 0.0023 * settings.sensitivity;
  const invert = settings.invertY ? -1 : 1;
  state.yaw -= deltaX * sensitivity;
  state.pitch -= deltaY * sensitivity * invert;
  state.pitch = Math.max(-1.25, Math.min(1.25, state.pitch));
}

function queueJump() {
  input.jumpQueued = true;
}

function updateCamera(dt) {
  if (!hasEntered) {
    previewAngle += dt * 0.085;
    const radius = 26;
    camera.position.set(Math.sin(previewAngle) * radius, 13.5, Math.cos(previewAngle) * radius);
    camera.lookAt(0, 1.2, 0);
    return;
  }
  camera.position.set(state.x, state.y, state.z);
  camera.rotation.y = state.yaw;
  camera.rotation.x = state.pitch;
}

// ---- frame loop ----
function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  sendAccumulator += dt;
  updateLocal(dt);
  updateRemotes(dt);
  updateGrass();
  updateFireflies();
  updateDayNight();
  updateCamera(dt);
  sendState();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

// ---- enter flow ----
function enterWorld() {
  hasEntered = true;
  wantsConnection = true;
  connect();
  overlay.classList.add("hidden");
  goFullscreen();
  if (!isTouch) {
    try {
      const lockAttempt = canvas.requestPointerLock?.();
      lockAttempt?.catch?.(() => {});
    } catch (e) {
      // headless browsers / embedded webviews reject pointer lock
    }
  }
}

function goFullscreen() {
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen;
  if (req && !document.fullscreenElement) {
    try {
      const r = req.call(el);
      if (r && r.catch) r.catch(() => {});
    } catch (e) {}
  }
}

function clearMovementInput() {
  keys.clear();
  input.moveX = 0;
  input.moveY = 0;
  input.crouchHeld = false;
  input.jumpQueued = false;
  input.moveTouchId = null;
  input.touchLookId = null;
  if (moveKnob) moveKnob.style.transform = "translate(-50%, -50%)";
}

// ---- input wiring ----
enterButton.addEventListener("click", enterWorld);
if (PREVIEW) {
  // Gate-page embed: hide the intro and every control, keep the orbit camera circling the
  // plaza (updateCamera already orbits while !hasEntered - we simply never enter).
  document.body.classList.add("preview");
  overlay.classList.add("hidden");
}

canvas.addEventListener("click", () => {
  if (!isTouch && hasEntered && document.pointerLockElement !== canvas) {
    try {
      const lockAttempt = canvas.requestPointerLock?.();
      lockAttempt?.catch?.(() => {});
    } catch (e) {}
  }
});

document.addEventListener("pointerlockchange", () => {
  if (document.pointerLockElement !== canvas) clearMovementInput();
});

document.addEventListener("mousemove", (event) => {
  if (document.pointerLockElement !== canvas) return;
  look(event.movementX, event.movementY);
});

document.addEventListener("keydown", (event) => {
  const t = event.target;
  if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
  if (claimOverlay && claimOverlay.style.display === "flex") {
    if (event.code === "Escape") { event.preventDefault(); closeClaim(); }
    return;
  }
  if (!hasEntered && (event.code === "Enter" || event.code === "Space")) {
    event.preventDefault();
    enterWorld();
    return;
  }
  if (hasEntered && (event.code === "KeyE" || event.code === "Enter") && (activeDoor || activePlot)) {
    event.preventDefault();
    enterActive();
    return;
  }
  if (hasEntered && (event.code === "ArrowUp" || event.code === "ArrowDown" || event.code === "ArrowLeft" || event.code === "ArrowRight")) {
    event.preventDefault();
  }
  keys.add(event.code);
  if (event.code === "Space") {
    event.preventDefault();
    queueJump();
  }
});

document.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

canvas.addEventListener("pointerdown", (event) => {
  if (!isTouch || event.clientX < window.innerWidth * 0.35) return;
  input.touchLookId = event.pointerId;
  input.touchLookX = event.clientX;
  input.touchLookY = event.clientY;
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener("pointermove", (event) => {
  if (event.pointerId !== input.touchLookId) return;
  look((event.clientX - input.touchLookX) * 2.4, (event.clientY - input.touchLookY) * 2.4);
  input.touchLookX = event.clientX;
  input.touchLookY = event.clientY;
});

function endTouchLook(event) {
  if (event.pointerId === input.touchLookId) input.touchLookId = null;
}
canvas.addEventListener("pointerup", endTouchLook);
canvas.addEventListener("pointercancel", endTouchLook);

function updateMovePad(event) {
  const rect = movePad.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const maxRadius = rect.width * 0.36;
  const dx = event.clientX - centerX;
  const dy = event.clientY - centerY;
  const length = Math.min(maxRadius, Math.hypot(dx, dy));
  const angle = Math.atan2(dy, dx);
  const knobX = Math.cos(angle) * length;
  const knobY = Math.sin(angle) * length;
  input.moveX = knobX / maxRadius;
  input.moveY = -knobY / maxRadius;
  moveKnob.style.transform = `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`;
}

function resetMovePad(event) {
  if (event.pointerId !== input.moveTouchId) return;
  input.moveTouchId = null;
  input.moveX = 0;
  input.moveY = 0;
  moveKnob.style.transform = "translate(-50%, -50%)";
}

movePad.addEventListener("pointerdown", (event) => {
  input.moveTouchId = event.pointerId;
  movePad.setPointerCapture(event.pointerId);
  updateMovePad(event);
});
movePad.addEventListener("pointermove", (event) => {
  if (event.pointerId === input.moveTouchId) updateMovePad(event);
});
movePad.addEventListener("pointerup", resetMovePad);
movePad.addEventListener("pointercancel", resetMovePad);

jumpButton.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  queueJump();
});
crouchButton.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  input.crouchHeld = true;
});
crouchButton.addEventListener("pointerup", () => { input.crouchHeld = false; });
crouchButton.addEventListener("pointercancel", () => { input.crouchHeld = false; });

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

doorPrompt.addEventListener("click", () => enterActive());
if (doorEnterBtn) doorEnterBtn.addEventListener("click", (e) => { e.preventDefault(); enterActive(); });
claimSubmit.addEventListener("click", submitClaim);
claimCancel.addEventListener("click", closeClaim);
claimInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); submitClaim(); } });

window.addEventListener("pagehide", () => { try { channel?.untrack(); } catch (e) {} });
window.addEventListener("blur", clearMovementInput);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) clearMovementInput();
});

// ---- BOOT (end of file by design: every const/let above is initialized before these run — TDZ law) ----
buildWorld();
animate();
resolveIdentity();
