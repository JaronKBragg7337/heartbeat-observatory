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

const BUILD = "2026-06-10-w2b"; // bumped with ?v= in /world2/index.html on every deploy
try { console.log("Heartbeat Observatory — World 2 build", BUILD); } catch (e) {}

// ---- DOM ----
const canvas = document.querySelector("#game");
const overlay = document.querySelector("#overlay");
const enterButton = document.querySelector("#enterButton");
const timeChip = document.querySelector("#timeChip");
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
  return h * flat;
}

// average gradient magnitude — used at build time for tree/grass placement, never per frame
function groundSlope(x, z) {
  const e = 0.6;
  const hx = groundHeight(x + e, z) - groundHeight(x - e, z);
  const hz = groundHeight(x, z + e) - groundHeight(x, z - e);
  return Math.hypot(hx, hz) / (2 * e);
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
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), h = pos.getY(i), ny = nrm.getY(i);
    const t = Math.min(1, Math.max(0, (h + 1) / 7));
    _sky.copy(cLush).lerp(cDry, Math.min(1, t * 1.5)).lerp(cHigh, Math.max(0, t - 0.6) * 2.5);
    const steep = Math.min(1, Math.max(0, (0.82 - ny) / 0.25)); // cliffsides read as rock
    _sky.lerp(cRock, steep);
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
  for (let i = 0; i < rockCount; i++) {
    const ang = hash2(i, 11) * Math.PI * 2;
    const dist = 15 + hash2(i, 23) * 115;
    const x = Math.cos(ang) * dist, z = Math.sin(ang) * dist;
    const sc = 0.4 + hash2(i, 41) * 1.3;
    _eu.set(hash2(i, 5) * Math.PI, hash2(i, 7) * Math.PI, hash2(i, 9) * Math.PI);
    _q.setFromEuler(_eu);
    _vs.set(sc, sc * (0.7 + hash2(i, 13) * 0.5), sc);
    _vp.set(x, groundHeight(x, z) + sc * 0.18, z);
    _m4.compose(_vp, _q, _vs);
    rocks.setMatrixAt(i, _m4);
    const g = 0.42 + hash2(i, 57) * 0.2;
    _sky.setRGB(g, g * (0.97 + hash2(i, 61) * 0.06), g * (0.94 + hash2(i, 67) * 0.06));
    rocks.setColorAt(i, _sky);
  }
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
  if (!grass) return;
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
        const bare = groundSlope(x, z) > 0.55 || gy > 5.8 || Math.hypot(x, z) < 3.2;
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

  const eyeTarget = eyeHeightForStance(state.stance) + groundHeight(state.x, state.z) + motion.airOffset;
  state.y += (eyeTarget - state.y) * Math.min(1, dt * 14);
}

function resolveCollision() {
  state.x = Math.max(-worldBounds, Math.min(worldBounds, state.x));
  state.z = Math.max(-worldBounds, Math.min(worldBounds, state.z));

  for (const collider of buildingColliders) {
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
  updateLocal(dt);
  updateGrass();
  updateDayNight();
  updateCamera(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

// ---- enter flow ----
function enterWorld() {
  hasEntered = true;
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
  if (!hasEntered && (event.code === "Enter" || event.code === "Space")) {
    event.preventDefault();
    enterWorld();
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

window.addEventListener("blur", clearMovementInput);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) clearMovementInput();
});

// ---- BOOT (end of file by design: every const/let above is initialized before these run — TDZ law) ----
buildWorld();
animate();
