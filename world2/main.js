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
// The remake (2026-11-05): the city lives in ./city.js (bumped together with BUILD and ?v=). Supabase and the
// people loaders are imported LAZILY, after the city is on screen - the old static imports were most of the
// 40-second blank first load the 10/28 tester hit.
import { createThumbstick } from "/hb-thumbstick.js?v=2026-11-05a";   // the invisible floating stick (shared with Real City)
import { buildCity, cityFloor, routeTo, GRID, CITY_RECT, WALL_Z, RIVER, BRIDGE, ROAD } from "./city.js?v=2026-11-05-walk1";
const SUPA_ESM = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
const GLTF_ESM = "https://cdn.jsdelivr.net/npm/three@0.182.0/examples/jsm/loaders/GLTFLoader.js";
const SKEL_ESM = "https://cdn.jsdelivr.net/npm/three@0.182.0/examples/jsm/utils/SkeletonUtils.js";

const BUILD = "2026-11-05-walk1";
const QS = new URLSearchParams(location.search);
const PREVIEW = QS.get("preview") === "1";
const DEV = QS.get("dev") === "1";                       // test handle: window.W2 (state, renderer, camera override, tap)
const TOD = QS.has("tod") ? Math.max(0, Math.min(1, parseFloat(QS.get("tod")) || 0)) : null;   // freeze the clock (0.25 noon, 0.75 midnight) // gate-page spectate: orbit forever, join nothing // bumped with ?v= in /world2/index.html on every deploy
try { console.log("Heartbeat Observatory — World 2 build", BUILD); } catch (e) {}

// ---- DOM ----
const canvas = document.querySelector("#game");
const overlay = document.querySelector("#overlay");
const enterButton = document.querySelector("#enterButton");
const timeChip = document.querySelector("#timeChip");
const presenceChip = document.querySelector("#presenceChip");
const doorPrompt = document.querySelector("#doorPrompt");
const doorPromptText = document.querySelector("#doorPromptText");
const claimOverlay = document.querySelector("#claimOverlay");
const claimInput = document.querySelector("#claimInput");
const claimError = document.querySelector("#claimError");
const claimSubmit = document.querySelector("#claimSubmit");
const claimCancel = document.querySelector("#claimCancel");

const isTouch = matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;

// ---- world constants (movement numbers are World 1's — the proven feel) ----
const playerRadius = 0.35;
const standingEyeHeight = 1.65;
const crouchEyeHeight = 1.15;
const gravity = 17.5;
const jumpVelocity = 6.4;
const WORLD_SEED = 7337;
const WORLD_EDGE = 285;           // the terrain is 600 m across; you can walk the north woods too

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
// doors: every civic building in city.js has a real door; this maps its id to what the door does.
const DOOR_ACTS = {
  theater: { type: "interior", id: "theater" }, arcade: { type: "interior", id: "arcade" }, library: { type: "interior", id: "library" },
  social: { type: "page", path: "/social" }, projects: { type: "page", path: "/projects" }, news: { type: "page", path: "/news" },
  town: { type: "page", path: "/engine" }, ashgrove: { type: "page", path: "/world3/gate/" },
};
let city = null;                // handle from buildCity()
let guide = null, guideTimer = 0, walkMarker = null, guideBeacon = null;   // map "show me the way": a route + a beacon, YOU walk it (Jaron 11/5: no tap-to-walk)
const ROOM = { theater: { x: 620, z: -160 }, arcade: { x: 620, z: -45 }, library: { x: 620, z: 70 } };
let inInterior = null;          // interior id or null
let interiorReturn = null;
const interiorColliders = { theater: [], arcade: [], library: [] };
const interiorStations = { theater: [], arcade: [], library: [] };
let cineOnLeave = null; // theater screening cleanup (pause reel + house lights up) — called by exitInterior()

// ---- day/night palette (World 2's own — warmer dusk, deeper night than the town) ----
const W2_DAY = new THREE.Color(0xaecde4);
const W2_DUSK = new THREE.Color(0xe08c52);
const W2_NIGHT = new THREE.Color(0x0a1422);

// ---- player state ----
const state = { x: -35.5, y: 1.8, z: 6.5, yaw: -1.36, pitch: 0.07, stance: "stand" };   // on Berry St, looking east to the courthouse dome
const input = { crouchHeld: false, jumpQueued: false };   // walking input = keys + the floating stick (stick.x / stick.y)
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
renderer.setPixelRatio(window.HBDevice?.rendererPixelRatio(2, 1.55, 1.15) || Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = window.HBDevice?.quality?.allowShadows !== false;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const clock = new THREE.Clock();

// ---- sky / light handles (filled by buildWorld) ----
let sunLight = null, hemiLight = null;
let skyAnchor = null, sunDisc = null, moonDisc = null, stars = null;
// ---- a real sky (Jaron 9/28: no Roblox look) - same design as World 1's, own copy (World 2 imports nothing from /engine/hub/):
// blue zenith to pale horizon, drifting clouds, sun glow, warm sunsets, dark night; the same sky lights reflections.
let skyDome = null, skyEnvScene = null, skyEnvSky = null, skyPmrem = null, skyEnv = null, skyEnvAt = 0, skyEnvElev = 9;
function makeWorldSky(radius) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false,
    uniforms: { sunDir: { value: new THREE.Vector3(0, 1, 0) }, zenith: { value: new THREE.Color() }, horizon: { value: new THREE.Color() },
                glow: { value: new THREE.Color() }, cloudLit: { value: new THREE.Color() }, cloudShade: { value: new THREE.Color() }, time: { value: 0 }, clouds: { value: 1 } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform vec3 sunDir, zenith, horizon, glow, cloudLit, cloudShade; uniform float time, clouds; varying vec3 vDir;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<5;i++){ v+=a*n(p); p*=2.03; a*=0.5; } return v; }
      void main(){
        vec3 d = normalize(vDir); float up = max(d.y, 0.0);
        vec3 col = mix(horizon, zenith, pow(up, 0.55));
        if (d.y < 0.0) col = horizon * (1.0 + d.y * 0.6);
        float s = max(dot(d, normalize(sunDir)), 0.0);
        col += glow * (pow(s, 8.0) * 0.35 + pow(s, 64.0) * 0.6) + vec3(1.0, 0.97, 0.9) * smoothstep(0.9993, 0.9998, s) * step(0.0, sunDir.y + 0.05);
        if (d.y > 0.02 && clouds > 0.0) {
          vec2 uv = d.xz / (d.y + 0.12) * 0.9 + vec2(time * 0.006, time * 0.002);
          float c = smoothstep(0.52, 0.78, fbm(uv * 1.6)) * smoothstep(0.02, 0.25, d.y);
          vec3 cc = mix(cloudShade, cloudLit, clamp(fbm(uv * 1.6 + 0.35) * 1.4, 0.0, 1.0));
          col = mix(col, cc, c * 0.85 * clouds);
        }
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), mat); m.frustumCulled = false; return m;
}
const SKY_PAL = {
  night: { zenith: 0x060c1c, horizon: 0x1a2640, glow: 0x1d2a48, cloudLit: 0x26304a, cloudShade: 0x111827 },
  dusk:  { zenith: 0x1f3566, horizon: 0xe98a58, glow: 0xffa860, cloudLit: 0xf2a377, cloudShade: 0x5a4a66 },
  day:   { zenith: 0x2f6fc6, horizon: 0xb7d2ea, glow: 0xfff0d0, cloudLit: 0xffffff, cloudShade: 0xb9c3cf },
};
const _skyTmp = new THREE.Color();
function skyColorsFor(e, u) {
  const mixP = (a, b, t) => { for (const k of ["zenith", "horizon", "glow", "cloudLit", "cloudShade"]) u[k].value.setHex(a[k]).lerp(_skyTmp.setHex(b[k]), t); };
  if (e >= 0.25) mixP(SKY_PAL.day, SKY_PAL.day, 0);
  else if (e >= 0) mixP(SKY_PAL.dusk, SKY_PAL.day, e / 0.25);
  else if (e >= -0.2) mixP(SKY_PAL.dusk, SKY_PAL.night, -e / 0.2);
  else mixP(SKY_PAL.night, SKY_PAL.night, 0);
}
// ---- real people (Jaron 9/27-28): the Loft's MetaHumans instead of capsule-and-ball avatars. The capsule shows first; the
// person swaps in when the file arrives. Their colour picks the shirt; a Loft pick (hb-look) is who they are.
let peopleRoster = null; const peopleFiles = new Map();
function peopleList() {
  if (!peopleRoster) peopleRoster = fetch("/homes/people/people.json", { cache: "no-cache" }).then((r) => r.json()).then((j) => j.people || []).catch(() => []);
  return peopleRoster;
}
let peopleMods = null;
function loadPeopleMods() { if (!peopleMods) peopleMods = Promise.all([import(GLTF_ESM), import(SKEL_ESM)]); return peopleMods; }
function personFile(file) {
  if (!peopleFiles.has(file)) peopleFiles.set(file, loadPeopleMods().then(([g]) => new g.GLTFLoader().loadAsync("/homes/people/" + file)));
  return peopleFiles.get(file);
}
function myPerson() { try { return localStorage.getItem("hb-look") || ""; } catch (e) { return ""; } }   // the Loft's "You" pick
function personHash(name) { let h = 0; for (const ch of String(name || "Guest")) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; }
async function swapInPerson(group, colorHex, name, personId) {
  try {
    const list = await peopleList(); if (!list.length) return;
    const pick = list.find((p) => p.id === personId) || list[personHash(name) % list.length];
    const gl = await personFile(pick.file);
    const [, skel] = await loadPeopleMods();
    const body = skel.clone(gl.scene); body.rotation.y = Math.PI;
    body.traverse((m) => {
      if (!m.isMesh) return;
      m.frustumCulled = false; m.castShadow = true;
      const mt = m.material = m.material.clone(); const n = mt.name || "";
      if (/^Shirt/.test(n) && colorHex) mt.color.set(colorHex);
      if (/^HairCard/.test(n)) { mt.transparent = false; mt.alphaTest = 0.38; mt.side = THREE.DoubleSide; }
    });
    for (const c of [...group.children]) if (!c.isSprite) group.remove(c);
    group.add(body);
    const mixer = new THREE.AnimationMixer(body), acts = {};
    for (const clip of gl.animations) acts[clip.name] = mixer.clipAction(clip);
    group.userData.person = { mixer, acts, state: null, lx: group.position.x, lz: group.position.z };
  } catch (e) { try { console.warn("[W2] person", e); } catch (e2) {} }
}
function animatePeople(dt) {
  for (const remote of remotes.values()) {
    const g = remote.group, P = g && g.userData.person; if (!P) continue;
    const sp = Math.hypot(g.position.x - P.lx, g.position.z - P.lz) / Math.max(dt, 0.001); P.lx = g.position.x; P.lz = g.position.z;
    const st = sp > 0.25 ? "Walk" : "Idle";
    if (P.state !== st && P.acts[st]) { const prev = P.state && P.acts[P.state]; P.acts[st].reset().play(); if (prev) prev.crossFadeTo(P.acts[st], 0.3, false); P.state = st; }
    if (P.acts.Walk) P.acts.Walk.timeScale = Math.max(0.6, Math.min(1.8, sp / 1.4));
    P.mixer.update(dt);
  }
}


// ---- grass system (deterministic world-grid: tufts live in fixed world cells, so the set
// only changes at the far edge as you walk — no pop-in next to the player) ----
const GRASS_CELL = 10;          // world units per cell
const GRASS_CELL_RADIUS = 3;    // cells each side of the player -> 7x7 grid
const GRASS_PER_CELL = 54;      // 7*7*54 = 2646 finer tufts, still ONE draw call (realism pass 9/28)
let grass = null;
let grassCellX = 1e9, grassCellZ = 1e9;

// ---- fireflies (courthouse green, the riverfront, open lots, the north woods) ----
const FIREFLY_COUNT = 220;
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
// Phase 2's hills (domain-warped FBM) survive as the land AROUND the city: the remake flattens downtown, cuts the river
// across the north, and lets the old hills rise beyond the edges and across the water.
function smooth01(t) { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); }
function hillsRaw(x, z) {
  const wx = x + (vnoise(x * 0.01 + 113.7, z * 0.01 + 41.2) - 0.5) * 34;
  const wz = z + (vnoise(x * 0.01 + 77.1, z * 0.01 + 9.8) - 0.5) * 34;
  let h = (vnoise(wx * 0.008, wz * 0.008) - 0.5) * 2 * 5.6;
  h += (vnoise(wx * 0.024 + 37.7, wz * 0.024 + 19.3) - 0.5) * 2 * 1.9;
  h += (vnoise(x * 0.07 + 7.3, z * 0.07 + 3.1) - 0.5) * 2 * 0.45;
  return Math.max(-1, h + 2.5);
}
function groundHeight(x, z) {
  if (z >= WALL_Z) {   // the south bank: downtown is flat; the hills fade in past the edge and away from the water
    const dx = Math.max(0, CITY_RECT.x0 - x, x - CITY_RECT.x1), dz = Math.max(0, z - CITY_RECT.z1), d = Math.hypot(dx, dz);
    if (d <= 0) return -0.06;
    return -0.06 + hillsRaw(x, z) * smooth01((d - 4) / 45) * smooth01((z - WALL_Z) / 28);
  }
  if (z > RIVER.zN) {  // the river channel (deep against the stone wall, shelving up to the north bank)
    const t = (z - RIVER.zN) / (WALL_Z - RIVER.zN), walled = x > -184 && x < 184;
    return -3.6 * smooth01(t / 0.35) * (walled ? 1 : smooth01((1 - t) / 0.3));
  }
  const n = RIVER.zN - z;   // the north woods
  return 0.5 * smooth01(n / 10) + hillsRaw(x, z) * smooth01((n - 6) / 40);
}
function inCityZone(x, z, m = 0) { return x > CITY_RECT.x0 - m && x < CITY_RECT.x1 + m && z > WALL_Z - m && z < CITY_RECT.z1 + m; }
function inRiver(x, z, m = 0) { return z > RIVER.zN - m && z < WALL_Z + m; }
function floorAt(x, z) { const c = cityFloor(x, z); return c === null ? groundHeight(x, z) : c; }

// average gradient magnitude — used at build time for tree/grass placement, never per frame
function groundSlope(x, z) {
  const e = 0.6;
  const hx = groundHeight(x + e, z) - groundHeight(x - e, z);
  const hz = groundHeight(x, z + e) - groundHeight(x, z - e);
  return Math.hypot(hx, hz) / (2 * e);
}

// ---- realism pass (Jaron 9/28: "not look like Roblox texture") - World 2's own copy of World 1's foliage idea:
// alpha-cutout leaf cards over each broadleaf crown, needle-branch cards in tiers on each conifer, all instanced
// on the SAME matrices as the canopies (still one draw call per tree type). The old solid crowns stay, darkened, as the
// shade inside the foliage. Leaf card: /world2/assets/canopy_leaf.webp (copied from World 1's CC0 kit).
function w2Rng(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
function w2CardShell(opts) {   // leaf cards scattered over an ellipsoid, facing outward (merged into one geometry)
  const rng = w2Rng(opts.seed || 1), pos = [], uv = [], nor = [], idx = [];
  const z = new THREE.Vector3(0, 0, 1), n = new THREE.Vector3(), q = new THREE.Quaternion(), q2 = new THREE.Quaternion(), v = new THREE.Vector3();
  for (let i = 0; i < opts.cards; i++) {
    const u = (i + rng() * 0.85) / opts.cards, phi = Math.acos(1 - 2 * u), th = i * 2.399963 + rng() * 0.6;
    const sx = Math.sin(phi) * Math.cos(th), sy = Math.cos(phi) * 0.85 + 0.12, sz = Math.sin(phi) * Math.sin(th);
    n.set(sx, sy * 0.7, sz).normalize(); q.setFromUnitVectors(z, n); q.premultiply(q2.setFromAxisAngle(n, rng() * Math.PI * 2));
    const s = opts.size * (0.82 + rng() * 0.42), base = pos.length / 3;
    for (const [px, py, tu, tv] of [[-0.5, -0.5, 0, 0], [0.5, -0.5, 1, 0], [0.5, 0.5, 1, 1], [-0.5, 0.5, 0, 1]]) {
      v.set(px * s, py * s, 0).applyQuaternion(q).add(new THREE.Vector3(sx * opts.rx, opts.cy + sy * opts.ry, sz * opts.rz));
      pos.push(v.x, v.y, v.z); uv.push(tu, tv); nor.push(n.x, n.y, n.z);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return w2Geo(pos, uv, nor, idx);
}
function w2PineTiers(opts) {   // needle branches: rings of drooping cards, wide at the bottom, narrow at the top
  const rng = w2Rng(opts.seed || 7), pos = [], uv = [], nor = [], idx = [];
  const tiers = opts.tiers, H = opts.height, R = opts.radius;
  for (let t = 0; t < tiers; t++) {
    const f = t / (tiers - 1), y = -H / 2 + 0.35 + f * (H - 0.6), r = R * (1 - f) * 0.95 + 0.22, count = Math.max(4, Math.round(7 - f * 3));
    for (let k = 0; k < count; k++) {
      const a = (k / count) * Math.PI * 2 + t * 0.7 + rng() * 0.4, ca = Math.cos(a), sa = Math.sin(a);
      const len = r * 1.25 + 0.25, wid = 0.55 + r * 0.35, droop = 0.35 + f * 0.1, base = pos.length / 3;
      // a card from the trunk out to the tip, drooping, turned so its face looks up-and-out
      const ox = ca * 0.1, oz = sa * 0.1, tx = ca * len, tz = sa * len, px = -sa * wid / 2, pz = ca * wid / 2;
      const quad = [[ox - px, y + 0.05, oz - pz, 0, 0], [ox + px, y + 0.05, oz + pz, 1, 0], [tx + px, y - droop, tz + pz, 1, 1], [tx - px, y - droop, tz - pz, 0, 1]];
      for (const [x, yy, zz, tu, tv] of quad) { pos.push(x, yy, zz); uv.push(tu, tv); nor.push(ca * 0.4, 0.9, sa * 0.4); }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  return w2Geo(pos, uv, nor, idx);
}
function w2Geo(pos, uv, nor, idx) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(idx); g.computeBoundingSphere(); return g;
}
function w2NeedleTexture() {   // a painted needle branch: stem + short needles, cut out by alpha
  const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d"); const r = w2Rng(99);
  g.lineCap = "round";
  for (let b = 0; b < 3; b++) {
    const x0 = 40 + b * 88; g.strokeStyle = "#3b2c1c"; g.lineWidth = 3; g.beginPath(); g.moveTo(x0, 250); g.lineTo(x0 + (r() - 0.5) * 20, 8); g.stroke();
    for (let i = 0; i < 70; i++) {
      const t = r(), y = 250 - t * 240, x = x0 + (r() - 0.5) * 6, side = r() < 0.5 ? -1 : 1, l = 10 + r() * 22 * (1 - t * 0.5);
      const gr = 70 + r() * 60; g.strokeStyle = `rgb(${24 + r() * 20},${gr},${36 + r() * 24})`; g.lineWidth = 1.6 + r();
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + side * l, y - l * (0.35 + r() * 0.3)); g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
let w2LeafMat = null, w2NeedleMat = null;
function w2FoliageMaterials() {
  if (!w2LeafMat) {
    const map = new THREE.TextureLoader().load("/world2/assets/canopy_leaf.webp"); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
    w2LeafMat = new THREE.MeshStandardMaterial({ map, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.88, metalness: 0 });
    w2NeedleMat = new THREE.MeshStandardMaterial({ map: w2NeedleTexture(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9, metalness: 0 });
  }
  return { leaf: w2LeafMat, needle: w2NeedleMat };
}

// ---- boot progress (the loading screen in index.html shows these) ----
function progress(p, label) { try { window.__w2Progress && window.__w2Progress(p, label); } catch (e) {} }
const yieldFrame = () => new Promise((r) => setTimeout(r, 0));

// ---- build the world ----
async function buildWorld() {
  progress(0.12, "Shaping the land");
  await yieldFrame();
  const size = 600, segs = 120;
  const groundGeo = new THREE.PlaneGeometry(size, size, segs, segs);
  groundGeo.rotateX(-Math.PI / 2);
  const pos = groundGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, groundHeight(pos.getX(i), pos.getZ(i)));
  groundGeo.computeVertexNormals();
  const nrm = groundGeo.attributes.normal;
  const colors = new Float32Array(pos.count * 3);
  const cLush = new THREE.Color(0x4c6b46), cDry = new THREE.Color(0x7d7a4e), cHigh = new THREE.Color(0x8a8378), cRock = new THREE.Color(0x6e685e);
  const cMud = new THREE.Color(0x5a5244), cEdge = new THREE.Color(0x5e6a4a);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), h = pos.getY(i), ny = nrm.getY(i);
    const t = Math.min(1, Math.max(0, (h + 1) / 9));
    _sky.copy(cLush).lerp(cDry, Math.min(1, t * 1.5)).lerp(cHigh, Math.max(0, t - 0.6) * 2.5);
    _sky.lerp(cRock, Math.min(1, Math.max(0, (0.82 - ny) / 0.25)));
    if (inRiver(x, z, 3)) _sky.lerp(cMud, 0.75);
    else if (inCityZone(x, z, 14)) _sky.lerp(cEdge, 0.4);
    const jitter = (vnoise(x * 0.3 + 91, z * 0.3 + 17) - 0.5) * 0.06;
    colors[i * 3] = _sky.r + jitter; colors[i * 3 + 1] = _sky.g + jitter; colors[i * 3 + 2] = _sky.b + jitter;
  }
  groundGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const texL = new THREE.TextureLoader(), tile = size / 3;
  const detail = texL.load("/world2/assets/ground_detail.webp"); detail.colorSpace = THREE.SRGBColorSpace;
  const bumps = texL.load("/world2/assets/ground_normal.webp");
  for (const t of [detail, bumps]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(tile, tile); t.anisotropy = 8; }
  const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ vertexColors: true, map: detail, normalMap: bumps, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.95, metalness: 0 }));
  ground.receiveShadow = true;
  scene.add(ground);

  // boulders out in the hills only (instanced — one draw call); every one a different size, tilt and tone
  const rockCount = 90;
  const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), rockCount);
  let rocksPlaced = 0;
  for (let i = 0; i < rockCount * 3 && rocksPlaced < rockCount; i++) {
    const x = (hash2(i, 11) - 0.5) * 2 * 285, z = (hash2(i, 23) - 0.5) * 2 * 285;
    if (inCityZone(x, z, 10) || inRiver(x, z, 6)) continue;
    const sc = 0.4 + hash2(i, 41) * 1.6;
    _eu.set(hash2(i, 5) * Math.PI, hash2(i, 7) * Math.PI, hash2(i, 9) * Math.PI);
    _q.setFromEuler(_eu);
    _vs.set(sc * (0.8 + hash2(i, 3) * 0.6), sc * (0.6 + hash2(i, 13) * 0.6), sc);
    _vp.set(x, groundHeight(x, z) + sc * 0.15, z);
    _m4.compose(_vp, _q, _vs);
    rocks.setMatrixAt(rocksPlaced, _m4);
    const g = 0.42 + hash2(i, 57) * 0.2;
    _sky.setRGB(g, g * (0.97 + hash2(i, 61) * 0.06), g * (0.94 + hash2(i, 67) * 0.06));
    rocks.setColorAt(rocksPlaced, _sky);
    rocksPlaced++;
  }
  rocks.count = rocksPlaced;
  rocks.castShadow = true; rocks.receiveShadow = true;
  scene.add(rocks);

  // ---- the woods around the city and across the river: two archetypes, all instanced ----
  const treeSpots = [];
  for (let i = 0; i < 4200 && treeSpots.length < 520; i++) {
    const x = (hash2(i, 211) - 0.5) * 2 * 290;
    const z = (hash2(i, 223) - 0.5) * 2 * 290;
    if (inCityZone(x, z, 9) || inRiver(x, z, 4)) continue;
    if (Math.abs(x - BRIDGE.x) < 6 && z < RIVER.zN && z > RIVER.zN - 14) continue;   // the bridge landing stays open
    if (groundSlope(x, z) > 0.55) continue;
    if (groundHeight(x, z) > 9.5) continue;
    treeSpots.push({ x, z, s: 0.75 + hash2(i, 227) * 0.75, kind: hash2(i, 229) < 0.55 ? 0 : 1, seed: i });
  }
  const conifers = treeSpots.filter((t) => t.kind === 0);
  const broadleafs = treeSpots.filter((t) => t.kind === 1);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 });
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
  function plantTrees(spots, trunkGeo, trunkH, canopyGeo, canopyY, canopyColors, cardGeo, cardMat) {
    if (!spots.length) return;
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
    const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, spots.length);
    const cards = cardGeo ? new THREE.InstancedMesh(cardGeo, cardMat, spots.length) : null;
    for (let i = 0; i < spots.length; i++) {
      const t = spots[i];
      const gy = groundHeight(t.x, t.z);
      _eu.set(0, hash2(t.seed, 233) * Math.PI * 2, 0);
      _q.setFromEuler(_eu);
      _vs.set(t.s, t.s * (0.85 + hash2(t.seed, 235) * 0.35), t.s);
      _vp.set(t.x, gy + (trunkH / 2 - 0.15) * t.s, t.z);
      _m4.compose(_vp, _q, _vs);
      trunks.setMatrixAt(i, _m4);
      _vp.set(t.x, gy + canopyY * t.s, t.z);
      _m4.compose(_vp, _q, _vs);
      canopies.setMatrixAt(i, _m4);
      if (cards) cards.setMatrixAt(i, _m4);
      const shade = 0.85 + hash2(t.seed, 239) * 0.3;
      _sky.setRGB(0.32 * shade, 0.24 * shade, 0.16 * shade);
      trunks.setColorAt(i, _sky);
      const golden = hash2(t.seed, 241) < 0.08;
      _sky.set(canopyColors[golden ? 2 : (hash2(t.seed, 251) < 0.5 ? 0 : 1)]);
      _sky.multiplyScalar(0.86 + hash2(t.seed, 257) * 0.28);
      if (cards) { cards.setColorAt(i, _sky.clone().multiplyScalar(1.9)); _sky.multiplyScalar(0.5); }
      canopies.setColorAt(i, _sky);
      buildingColliders.push({ x: t.x, z: t.z, width: 0.55 * t.s + 0.25, depth: 0.55 * t.s + 0.25, h: 6 });
    }
    trunks.castShadow = true; canopies.castShadow = true; canopies.receiveShadow = true;
    scene.add(trunks); scene.add(canopies);
    if (cards) { cards.castShadow = true; cards.receiveShadow = true; scene.add(cards); }
  }
  const foliage = w2FoliageMaterials();
  plantTrees(conifers, new THREE.CylinderGeometry(0.14, 0.22, 2.4, 6), 2.4, new THREE.ConeGeometry(1.2, 4.2, 7), 2.4 * 0.8 + 2.2,
    [0x2e4a32, 0x3a5638, 0x8a6b2e], w2PineTiers({ tiers: 7, height: 4.6, radius: 1.55, seed: 11 }), foliage.needle);
  const leafShell = w2CardShell({ cards: 26, rx: 1.75, ry: 1.25, rz: 1.7, cy: 0, size: 1.55, seed: 20260928 });
  plantTrees(broadleafs, new THREE.CylinderGeometry(0.16, 0.26, 2.0, 6), 2.0, new THREE.IcosahedronGeometry(1.55, 1), 2.0 + 1.1,
    [0x4a6b35, 0x55763c, 0x8a7a3a], leafShell, foliage.leaf);

  // ---- grass (only grows off the pavement; skipped in the gate-page preview) ----
  if (!PREVIEW) {
    grass = new THREE.InstancedMesh(
      makeGrassGeometry(),
      new THREE.MeshStandardMaterial({ map: makeGrassTexture(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1, metalness: 0 }),
      (GRASS_CELL_RADIUS * 2 + 1) * (GRASS_CELL_RADIUS * 2 + 1) * GRASS_PER_CELL
    );
    grass.receiveShadow = true;
    grass.frustumCulled = false;
    scene.add(grass);
  }

  // one sun (the moon borrows it at night), PCFSoft shadows, tight shadow camera that follows the player
  sunLight = new THREE.DirectionalLight(0xffffff, 2.0);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(window.HBDevice?.tier === "desktop" ? 2048 : 1024, window.HBDevice?.tier === "desktop" ? 2048 : 1024);
  sunLight.shadow.camera.left = -55; sunLight.shadow.camera.right = 55; sunLight.shadow.camera.top = 55; sunLight.shadow.camera.bottom = -55;
  sunLight.shadow.camera.near = 2; sunLight.shadow.camera.far = 320;
  sunLight.shadow.bias = -0.0006; sunLight.shadow.normalBias = 0.04;
  scene.add(sunLight);
  scene.add(sunLight.target);
  hemiLight = new THREE.HemisphereLight(0xbfd6e8, 0x4a4438, 1.0);
  scene.add(hemiLight);

  skyAnchor = new THREE.Group();
  scene.add(skyAnchor);
  sunDisc = new THREE.Mesh(new THREE.CircleGeometry(9, 24), new THREE.MeshBasicMaterial({ color: 0xffd9a0, fog: false, depthWrite: false }));
  skyAnchor.add(sunDisc);
  moonDisc = new THREE.Mesh(new THREE.CircleGeometry(5.5, 24), new THREE.MeshBasicMaterial({ color: 0xd8e2ef, fog: false, depthWrite: false, transparent: true, opacity: 0.92 }));
  skyAnchor.add(moonDisc);
  const starCount = 420;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const az = hash2(i, 101) * Math.PI * 2, el = Math.asin(0.06 + hash2(i, 103) * 0.93), r = 230;
    starPos[i * 3] = Math.cos(el) * Math.cos(az) * r; starPos[i * 3 + 1] = Math.sin(el) * r; starPos[i * 3 + 2] = Math.cos(el) * Math.sin(az) * r;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xeaf2ff, size: 1.7, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  skyAnchor.add(stars);

  progress(0.3, "Drawing the street grid");
  await yieldFrame();
  // ---- THE CITY (world2/city.js): streets, the building kit, lamps, signals, cars, the river ----
  const waterNormal = new THREE.TextureLoader().load("/world2/assets/ground_normal.webp");
  city = await buildCity(scene, { progress, yieldFrame, leafGeo: leafShell, leafMat: foliage.leaf, waterNormal });
  for (const c of city.colliders) buildingColliders.push(c);
  for (const d of city.doors) doors.push({ id: d.id, label: d.label, x: d.x, z: d.z, hw: d.hw, hd: d.hd, act: DOOR_ACTS[d.id] || { type: "page", path: "/" } });
  for (const pl of city.plots) plotPads.push({ plot: pl.plot, x: pl.fx, z: pl.fz, cx: pl.x, cz: pl.z, box: pl.box, claimed: false, row: null });
  progress(0.97, "Opening the doors");
  buildInteriors();
  buildFireflies();
  buildMinimap();
  walkMarker = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.5, 28), new THREE.MeshBasicMaterial({ color: 0x7bd88f, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
  walkMarker.rotation.x = -Math.PI / 2; walkMarker.renderOrder = 3; scene.add(walkMarker);
  // the map's beacon: a tall soft green light column over the place you picked (you walk to it; it never walks you)
  guideBeacon = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 60, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0x7bd88f, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  guideBeacon.visible = false; guideBeacon.renderOrder = 3; scene.add(guideBeacon);
}

// fireflies: one Points draw call, visible only at night, drifting on cheap sine paths
function buildFireflies() {
  fireflyBase = new Float32Array(FIREFLY_COUNT * 3);
  const pos = new Float32Array(FIREFLY_COUNT * 3);
  const spots = (city && city.firefly) || [];
  for (let i = 0; i < FIREFLY_COUNT; i++) {
    let x, z;
    if (i < spots.length) { x = spots[i][0]; z = spots[i][1]; }
    else { x = (hash2(i, 801) - 0.5) * 360; z = RIVER.zN - 6 - hash2(i, 807) * 90; }   // the north woods across the river
    fireflyBase[i * 3] = x;
    fireflyBase[i * 3 + 1] = floorAt(x, z) + 0.5 + hash2(i, 809) * 1.6;
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
  // realism pass (Jaron 9/28): fine, dense blades in natural field greens with straw tips, dark at the root so each tuft
  // melts into the ground instead of standing on it like a paper cut-out
  const c = document.createElement("canvas");
  c.width = 128; c.height = 128;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, 128, 128);
  for (let i = 0; i < 46; i++) {
    const bx = 6 + hash2(i, 401) * 116;
    const lean = (hash2(i, 409) - 0.5) * 26;
    const w = 0.9 + hash2(i, 419) * 1.5;
    const top = 6 + hash2(i, 421) * 46;
    const g = 70 + Math.floor(hash2(i, 431) * 55), straw = hash2(i, 433) < 0.25;
    const grad = ctx.createLinearGradient(0, 128, 0, top);
    grad.addColorStop(0, `rgb(${Math.floor(g * 0.3)},${Math.floor(g * 0.45)},${Math.floor(g * 0.2)})`);
    grad.addColorStop(0.55, `rgb(${Math.floor(g * 0.58)},${g},${Math.floor(g * 0.36)})`);
    grad.addColorStop(1, straw ? `rgb(${Math.floor(g * 1.25)},${Math.floor(g * 1.12)},${Math.floor(g * 0.55)})` : `rgb(${Math.floor(g * 0.72)},${Math.floor(g * 1.1)},${Math.floor(g * 0.45)})`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(bx - w, 128);
    ctx.quadraticCurveTo(bx - w * 0.3 + lean * 0.5, 70, bx + lean, top);
    ctx.quadraticCurveTo(bx + w * 0.3 + lean * 0.5, 70, bx + w, 128);
    ctx.closePath();
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// two crossed quads, anchored at the bottom, normals up so grass takes light like the ground
function makeGrassGeometry() {
  const geo = new THREE.BufferGeometry();
  const w = 0.34, h = 0.46;
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
  const deep = inCityZone(state.x, state.z, -GRASS_CELL * (GRASS_CELL_RADIUS + 1));   // nothing grows downtown: skip the draw
  grass.visible = !deep; if (deep) return;
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
        let bare = groundSlope(x, z) > 0.55 || gy > 9 || inCityZone(x, z, 1) || inRiver(x, z, 1);
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
  // the canvas grows with the text (the old fixed 256 px canvas clipped long labels: the 10/28 "tiny, cut off" plot label)
  const font = "600 30px system-ui, sans-serif";
  const m = document.createElement("canvas").getContext("2d"); m.font = font;
  const tw = Math.ceil(m.measureText(name).width) + 30, W = Math.max(256, Math.min(1024, tw + 16));
  const c = document.createElement("canvas");
  c.width = W; c.height = 64;
  const ctx = c.getContext("2d");
  ctx.font = font; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(8,12,16,0.62)";
  ctx.beginPath(); ctx.roundRect((W - tw) / 2, 8, tw, 48, 14); ctx.fill();
  ctx.fillStyle = "#eef4fa";
  ctx.fillText(name, W / 2, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(1.9 * (W / 256) * (scaleMul || 1), 0.475 * (scaleMul || 1), 1);
  return sprite;
}

function buildAvatarBody(colorHex, name, personId) {
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
  swapInPerson(group, colorHex, name, personId);
  return group;
}

function remoteFootY(player) {
  return player.y - (player.stance === "crouch" ? crouchEyeHeight : standingEyeHeight);
}

function createRemote(player) {
  const group = buildAvatarBody(player.color, player.name, player.person);
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
    channel.track({ id: selfId(), name: displayName, color: myColor, person: myPerson(), x: state.x, y: state.y, z: state.z, yaw: state.yaw, stance: state.stance });
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
    payload: { id: selfId(), name: displayName, color: myColor, person: myPerson(), x: state.x, y: state.y, z: state.z, yaw: state.yaw, pitch: state.pitch, stance: state.stance }
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

let supaLoading = null;
function supaReady() {
  if (supa) return Promise.resolve(supa);
  if (!supaLoading) supaLoading = import(SUPA_ESM).then((m) => { if (!supa) supa = m.createClient(SUPA_URL, SUPA_KEY); return supa; });
  return supaLoading;
}
async function connect() {
  if (!wantsConnection || channel) return;
  ensureIdentity();
  try { await supaReady(); } catch (e) { scheduleReconnect(); return; }
  if (!wantsConnection || channel) return;
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
  const label = !connected ? "connecting" : n === 0 ? "just you so far" : n === 1 ? "1 other here" : n + " others here";
  if (presenceChip.textContent !== label) presenceChip.textContent = label;
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
  // THE SCREENING SYSTEM - real film (ported 2026-07-04 from worlds-lab Marquee Row, lib/v1/cinema.js).
  // Legally-free reels from their ORIGINAL sources (Blender CC BY / Internet Archive PD / NASA PD),
  // credits shown in-room. Clear unavailable states; per-visitor playback for now (shared sync = next step).
  const FILMS = [
    { title: "Big Buck Bunny", year: 2008, license: "CC BY 3.0", credit: "(c) 2008 Blender Foundation - bigbuckbunny.org", src: "https://upload.wikimedia.org/wikipedia/commons/transcoded/c/c0/Big_Buck_Bunny_4K.webm/Big_Buck_Bunny_4K.webm.720p.vp9.webm", srcFallback: "https://archive.org/download/BigBuckBunny_328/BigBuckBunny_512kb.mp4" },
    { title: "Sintel", year: 2010, license: "CC BY 3.0", credit: "(c) 2010 Blender Foundation - sintel.org", src: "https://upload.wikimedia.org/wikipedia/commons/transcoded/f/f1/Sintel_movie_4K.webm/Sintel_movie_4K.webm.720p.vp9.webm", srcFallback: "https://archive.org/download/Sintel/sintel-2048-stereo_512kb.mp4" },
    { title: "Tears of Steel", year: 2012, license: "CC BY 3.0", credit: "(c) 2012 Blender Foundation - tearsofsteel.org", src: "https://upload.wikimedia.org/wikipedia/commons/transcoded/c/cb/Tears_of_Steel_1080p.webm/Tears_of_Steel_1080p.webm.720p.vp9.webm", srcFallback: "https://archive.org/download/Tears-of-Steel/tears_of_steel_720p.mp4" },
    { title: "Elephants Dream", year: 2006, license: "CC BY 2.5", credit: "(c) 2006 Blender Foundation / NMAI - orange.blender.org", src: "https://upload.wikimedia.org/wikipedia/commons/transcoded/2/28/Elephants_Dream_%282006%29_1080p24.webm/Elephants_Dream_%282006%29_1080p24.webm.720p.vp9.webm", srcFallback: "https://archive.org/download/ElephantsDream/ed_1024_512kb.mp4" },
    { title: "His Girl Friday", year: 1940, license: "Public Domain", credit: "Public domain - Internet Archive", src: "https://archive.org/download/his_girl_friday/his_girl_friday_512kb.mp4" },
    { title: "Plan 9 from Outer Space", year: 1959, license: "Public Domain", credit: "Public domain - Internet Archive", src: "https://archive.org/download/plan-9-from-outer-space-1959/Plan%209%20From%20Outer%20Space%20%281959%29.ia.mp4" },
    { title: "Artemis - Success and Preparation", year: 2025, license: "Public Domain (NASA)", credit: "Video courtesy of NASA - images.nasa.gov", src: "https://images-assets.nasa.gov/video/KSC-20250128-MH-NAS02-0001-Artemis_Success_and_Preparation_Short_Versions-M11615/KSC-20250128-MH-NAS02-0001-Artemis_Success_and_Preparation_Short_Versions-M11615~mobile.mp4", srcFallback: "https://images-assets.nasa.gov/video/KSC-20250128-MH-NAS02-0001-Artemis_Success_and_Preparation_Short_Versions-M11615/KSC-20250128-MH-NAS02-0001-Artemis_Success_and_Preparation_Short_Versions-M11615~medium.mp4" },
  ];
  const video = document.createElement("video");
  video.crossOrigin = "anonymous"; video.playsInline = true; video.setAttribute("playsinline", "");
  video.preload = "none"; video.volume = 0.85;
  let cIdx = 0, cStarted = false, cVideoTex = null, cFails = 0, cTriedFallback = false;
  const boardTex = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; return { c: c, tex: tex }; };
  const drawLines = (bt, lines, opts) => {
    opts = opts || {};
    const ctx = bt.c.getContext("2d");
    ctx.fillStyle = opts.bg || "#0a0d12"; ctx.fillRect(0, 0, bt.c.width, bt.c.height);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (let i = 0; i < lines.length; i++) {
      ctx.font = i === 0 ? (opts.font || "bold 52px system-ui, sans-serif") : (opts.subFont || "30px system-ui, sans-serif");
      ctx.fillStyle = i === 0 ? (opts.accent || "#ffd166") : "#9fb0bd";
      ctx.fillText(lines[i], bt.c.width / 2, bt.c.height * (i + 1) / (lines.length + 1));
    }
    bt.tex.needsUpdate = true;
  };
  // 16:9 screen so film is never stretched; dark masking panels fill the rest of the wall
  const mask = new THREE.Mesh(new THREE.BoxGeometry(16, 5.8, 0.1), new THREE.MeshStandardMaterial({ color: 0x0b0910, roughness: 0.9 }));
  mask.position.set(tr.x, 3.1, tr.z - 8.78);
  scene.add(mask);
  const screenBoard = boardTex(1024, 576);
  drawLines(screenBoard, ["The screen is waiting", "Step on the rear green pad to start the screening", "Rear amber pad changes the reel"], {});
  const screenMat = new THREE.MeshStandardMaterial({ map: screenBoard.tex, color: 0xffffff, roughness: 0.4, emissive: 0x3a4252, emissiveIntensity: 0.55, emissiveMap: screenBoard.tex });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(9.6, 5.4), screenMat);
  screen.position.set(tr.x, 3.1, tr.z - 8.68);
  scene.add(screen);
  const statusBoard = boardTex(1024, 96);
  const statusMesh = new THREE.Mesh(new THREE.PlaneGeometry(9.0, 0.84), new THREE.MeshBasicMaterial({ map: statusBoard.tex }));
  statusMesh.position.set(tr.x, 0.5, tr.z - 8.68);
  scene.add(statusMesh);
  const setStatus = (t) => drawLines(statusBoard, [t], { font: "34px system-ui, sans-serif", accent: "#9fb0bd" });
  const nowBoard = boardTex(1024, 300);
  const nowMesh = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.3), new THREE.MeshBasicMaterial({ map: nowBoard.tex }));
  nowMesh.position.set(tr.x - 9.2, 3.4, tr.z - 8.68);
  scene.add(nowMesh);
  const plaqueBoard = boardTex(1024, 400);
  const plaqueMesh = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.7), new THREE.MeshBasicMaterial({ map: plaqueBoard.tex }));
  plaqueMesh.position.set(tr.x + 9.2, 3.2, tr.z - 8.68);
  scene.add(plaqueMesh);
  const setNowShowing = () => {
    const f = FILMS[cIdx];
    drawLines(nowBoard, ["NOW SHOWING", f.title + " (" + f.year + ")"], { font: "bold 44px system-ui, sans-serif" });
    drawLines(plaqueBoard, ["About this screening", f.title + " (" + f.year + ") - " + f.license, f.credit, "Played from the original free source."], { accent: "#7bd88f", font: "bold 40px system-ui, sans-serif", subFont: "24px system-ui, sans-serif" });
  };
  const houseLights = [];
  [[tr.x - 5, tr.z - 2], [tr.x + 5, tr.z + 3]].forEach((pl) => {
    const l = new THREE.PointLight(0xffe9c4, 1.4, 26, 1.6);
    l.position.set(pl[0], 5.6, pl[1]); l.userData = { up: 1.4, down: 0.2 };
    scene.add(l); houseLights.push(l);
  });
  const padMats = [];
  const setHouse = (bright) => {
    houseLights.forEach((l) => { l.intensity = bright ? l.userData.up : l.userData.down; });
    padMats.forEach((m) => { m.emissiveIntensity = bright ? 1.0 : 0.22; });
  };
  const attachTexture = () => {
    if (cVideoTex) return;
    cVideoTex = new THREE.VideoTexture(video);
    cVideoTex.colorSpace = THREE.SRGBColorSpace;
    screenMat.map = cVideoTex; screenMat.emissiveMap = cVideoTex;
    screenMat.emissive = new THREE.Color(0xffffff); screenMat.emissiveIntensity = 0.85;
    screenMat.needsUpdate = true;
    setHouse(false);
  };
  video.addEventListener("playing", () => { attachTexture(); cFails = 0; setStatus(FILMS[cIdx].credit); });
  video.addEventListener("error", () => {
    const f = FILMS[cIdx];
    if (f.srcFallback && !cTriedFallback) { cTriedFallback = true; setStatus("Main reel unreachable - trying the backup print..."); video.src = f.srcFallback; video.play().catch(() => {}); return; }
    cFails++;
    if (cFails >= FILMS.length) { setStatus("No reel reachable right now. Try again later."); cStarted = false; return; }
    setStatus("That reel didn't load - trying the next one...");
    cIdx = (cIdx + 1) % FILMS.length; cTriedFallback = false; setNowShowing();
    if (cStarted) startShow();
  });
  const startShow = () => {
    const f = FILMS[cIdx];
    cTriedFallback = false; cStarted = true;
    setNowShowing(); setStatus("Projecting - " + f.title);
    if (video.src !== f.src) video.src = f.src;
    const p = video.play();
    if (p && p.catch) p.catch(() => {
      video.muted = true; // some phones insist on a muted first start - honor it, sound on next use
      video.play().then(() => setStatus(FILMS[cIdx].credit + "  (use the pad again for sound)")).catch(() => {});
    });
  };
  const toggleSound = () => { if (video.muted) { video.muted = false; setStatus(FILMS[cIdx].credit); return true; } return false; };
  cineOnLeave = () => { try { video.pause(); } catch (e) {} cStarted = false; setHouse(true); };
  [[tr.x - 5.0, tr.z + 6.4, "#7bd88f", "START"], [tr.x + 5.0, tr.z + 6.4, "#ffd166", "NEXT"]].forEach((pd) => {
    const pm = new THREE.MeshStandardMaterial({ color: new THREE.Color(pd[2]), emissive: new THREE.Color(pd[2]), emissiveIntensity: 1.0, roughness: 0.6 });
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.05, 20), pm);
    pad.position.set(pd[0], 0.03, pd[1]);
    scene.add(pad); padMats.push(pm);
    const sl = makeNameSprite(pd[3], 1.2);
    sl.position.set(pd[0], 1.25, pd[1]);
    scene.add(sl);
  });
  interiorStations.theater.push({ label: "Start the screening", x: tr.x - 5.0, z: tr.z + 6.4, hw: 1.5, hd: 1.5, act: { type: "fn", fn: () => { if (!toggleSound() || !cStarted) startShow(); } } });
  interiorStations.theater.push({ label: "Next reel", x: tr.x + 5.0, z: tr.z + 6.4, hw: 1.5, hd: 1.5, act: { type: "fn", fn: () => { cIdx = (cIdx + 1) % FILMS.length; cTriedFallback = false; setNowShowing(); if (cStarted) startShow(); } } });
  setNowShowing();
  setStatus("House lights up - rear pads run the show.");
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
  interiorStations.theater.push({ label: "Grand Palace \u00b7 take your seat", x: tr.x + 9.5, z: tr.z + 5.5, hw: 2, hd: 2, act: { type: "page", path: "/video/3d/?start=seats&from=world2" } });

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
  try { if (cineOnLeave) cineOnLeave(); } catch (e) {}
  inInterior = null;
  if (interiorReturn) {
    state.x = interiorReturn.x;
    state.z = interiorReturn.z;
    state.yaw = interiorReturn.yaw;
  }
  if (grass) { grass.visible = true; grassCellX = 1e9; }
}

// plots: eight open lots on the edge of downtown (city.js marks them with gravel and a big readable board).
// A claimed lot becomes a real kit building with the project's name on it - same law as World 1.
function applySpaceRow(pad, row) {
  if (!pad || !row || !row.github_url || pad.claimed || !city) return;
  pad.claimed = true;
  pad.row = row;
  const built = city.claimPlot(pad.plot, row);
  if (!built) return;
  buildingColliders.push({ x: pad.box.x, z: pad.box.z, width: pad.box.width, depth: pad.box.depth, h: built.H });
  doors.push({ label: built.door.label, x: built.door.x, z: built.door.z, hw: built.door.hw, hd: built.door.hd, act: { type: "page", path: "/space/?plot=" + pad.plot + "&world=world2" } });
  mapDirty = true;
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
      const b = pad.box;
      if (Math.abs(state.x - b.x) > b.width / 2 + 2.6 || Math.abs(state.z - b.z) > b.depth / 2 + 2.6) continue;
      const d = Math.hypot(state.x - pad.x, state.z - pad.z);
      if (d < bp) { bp = d; nextPlot = pad; }
    }
  }
  activePlot = nextPlot;
  if (doorPrompt && doorPromptText) {
    if (activeDoor) {
      doorPromptText.textContent = (isTouch ? "Tap — " : "Press E — ") + activeDoor.label;
      doorPrompt.classList.remove("hidden");
    } else if (activePlot) {
      doorPromptText.textContent = (isTouch ? "Tap — " : "Press E — ") + "Lot " + (activePlot.plot + 1) + " is open: claim it with a GitHub repo";
      doorPrompt.classList.remove("hidden");
    } else {
      doorPrompt.classList.add("hidden");
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
    else if (act.type === "fn") { try { act.fn(); } catch (e) {} }
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
    await supaReady();
    const { data: { session } } = await supa.auth.getSession();
    if (session && session.user) {
      myUserId = session.user.id;
      // Reality ledger: record that this resident has walked World 2 (spectators never count).
      if (!PREVIEW) { try { supa.rpc("touch_world", { p_world: "world2" }).then(() => {}, () => {}); } catch (e) {} }
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

const HEMI_DAY = new THREE.Color(0xbfd6e8), HEMI_NIGHT = new THREE.Color(0x8ea4d2), MOON_COL = new THREE.Color(0xa9bde6);
function updateDayNight() {
  if (!sunLight) return;
  const CYCLE = 300;
  const t = TOD !== null ? TOD : ((Date.now() / 1000) % CYCLE) / CYCLE;
  const a = t * Math.PI * 2;
  const e = Math.sin(a);
  const horiz = Math.cos(a);
  const day = Math.max(0, Math.min(1, e * 1.6 + 0.08));

  _sunOff.set(horiz * 60, e * 70, 24 + e * 6);
  const fx = hasEntered ? state.x : 10, fz = hasEntered ? state.z : -10;   // shadows follow you (or the preview's view)
  const moon = e < -0.02, nightF = Math.max(0, Math.min(1, -e * 1.5 + 0.1));
  if (moon) {   // after sunset the same light becomes moonlight from the opposite sky: soft, blue, still casting shadows
    sunLight.position.set(fx - _sunOff.x, Math.max(20, -_sunOff.y), fz - _sunOff.z);
    sunLight.intensity = 0.5 * Math.min(1, -e * 5);
    sunLight.color.copy(MOON_COL);
  } else {
    sunLight.position.set(fx + _sunOff.x, Math.max(6, _sunOff.y), fz + _sunOff.z);
    sunLight.intensity = 0.1 + 2.2 * day;
    sunLight.color.setRGB(1, 0.92 - 0.16 * (1 - day), 0.82 - 0.28 * (1 - day));
  }
  sunLight.target.position.set(fx, 0, fz);
  if (hemiLight) {
    hemiLight.intensity = 0.62 + 0.62 * Math.max(0, Math.min(1, e + 0.3));
    hemiLight.color.copy(HEMI_DAY).lerp(HEMI_NIGHT, nightF);
  }

  // atmosphere driven by the cycle: sky, fog color AND density, tone exposure
  const sky = pickSky(e);
  scene.background.copy(sky);
  scene.fog.color.copy(sky);
  // golden hour: fog leans warmer than the sky itself — distant trees melt into amber
  const golden = Math.max(0, 1 - Math.abs(e) / 0.18);
  if (golden > 0) scene.fog.color.lerp(W2_DUSK, golden * 0.3);
  scene.fog.density = 0.0040 + (1 - day) * 0.0018;   // a city you can see across (the old 0.0095-0.016 swallowed it)
  renderer.toneMappingExposure = 1.1 + 0.04 * day;

  if (skyAnchor) skyAnchor.position.set(state.x, 0, state.z);
  if (!skyDome) {
    skyDome = makeWorldSky(420); skyDome.renderOrder = -2; scene.add(skyDome);
    skyEnvScene = new THREE.Scene(); skyEnvSky = makeWorldSky(60); skyEnvSky.material.uniforms.clouds.value = 0.4; skyEnvScene.add(skyEnvSky);
    skyPmrem = new THREE.PMREMGenerator(renderer);
  }
  {
    const sunDir = _sunOff.clone().normalize(), su = skyDome.material.uniforms;
    skyDome.position.copy(camera.position); su.sunDir.value.copy(sunDir); su.time.value = performance.now() / 1000; skyColorsFor(e, su);
    scene.fog.color.copy(su.horizon.value); if (golden > 0) scene.fog.color.lerp(W2_DUSK, golden * 0.25);
    const now = performance.now();
    if (Math.abs(e - skyEnvElev) > 0.04 && now - skyEnvAt > 2500) {
      skyEnvAt = now; skyEnvElev = e; const eu = skyEnvSky.material.uniforms; eu.sunDir.value.copy(sunDir); skyColorsFor(e, eu);
      const rt = skyPmrem.fromScene(skyEnvScene, 0, 0.1, 200); if (skyEnv) skyEnv.dispose(); skyEnv = rt; scene.environment = rt.texture;
    }
    scene.environmentIntensity = 0.12 + 0.3 * day;
    if (stars) stars.renderOrder = -1;
  }
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
  if (stars) stars.material.opacity = nightF * 0.95;

  // the night-city moment: windows, shop fronts, signs and lamps come on exactly as the sky darkens
  if (city) city.setNight(Math.min(1, Math.pow(1 - day, 1.3) * 1.05), day);
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

  forward += stick.y;   // the floating stick is analog: half a push is half speed, the rim runs
  strafe += stick.x;

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

  const wantsSprint = (keys.has("ShiftLeft") || keys.has("ShiftRight") || stick.running) && forward > 0 && !crouching && motion.onGround;
  motion.sprinting = wantsSprint;
  motion.moving = Math.abs(forward) + Math.abs(strafe) > 0.01;

  const speed = crouching ? 2.45 : wantsSprint ? 7.2 : 4.65;
  const sin = Math.sin(state.yaw);
  const cos = Math.cos(state.yaw);

  state.x += (cos * strafe + -sin * forward) * speed * dt;
  state.z += (-sin * strafe + -cos * forward) * speed * dt;

  resolveCollision();
  updateActiveDoor();

  const floorY = inInterior ? 0 : floorAt(state.x, state.z);
  const eyeTarget = eyeHeightForStance(state.stance) + floorY + motion.airOffset;
  state.y += (eyeTarget - state.y) * Math.min(1, dt * 14);
}

function resolveCollision() {
  if (inInterior) {
    const r = ROOM[inInterior];
    state.x = Math.max(r.x - 12.4, Math.min(r.x + 12.4, state.x));
    state.z = Math.max(r.z - 8.4, Math.min(r.z + 8.4, state.z));
  } else clampWorld();
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

// the river is a real edge: you stay on your bank unless you take the bridge
function clampWorld() {
  state.x = Math.max(-WORLD_EDGE, Math.min(WORLD_EDGE, state.x));
  state.z = Math.max(-WORLD_EDGE, Math.min(WORLD_EDGE, state.z));
  if (state.z < WALL_Z + 0.35 && state.z > RIVER.zN - 0.6) {
    if (Math.abs(state.x - BRIDGE.x) < BRIDGE.half - 0.25 + 0.6) state.x = Math.max(BRIDGE.x - BRIDGE.half + 0.4, Math.min(BRIDGE.x + BRIDGE.half - 0.4, state.x));
    else if (state.z > (RIVER.zN + WALL_Z) / 2) state.z = WALL_Z + 0.35;
    else state.z = RIVER.zN - 0.6;
  }
}

// ---- NO tap-to-walk (Jaron 11/5: "I don't want to tap to walk. I want to walk."). You walk with the stick or the keys.
// A tap/click is for USING things: a door, its green mat, an open lot. The map shows the way (a route on the minimap,
// a green beacon at the place); it never walks you.
function blockedAt(x, z, y) {
  for (const c of buildingColliders) { if ((c.h || 30) < y) continue; if (Math.abs(x - c.x) < c.width / 2 && Math.abs(z - c.z) < c.depth / 2) return c; }
  return null;
}
function lineClear(ax, az, bx, bz) {
  const n = Math.ceil(Math.hypot(bx - ax, bz - az));
  for (let k = 1; k < n; k++) { const t = k / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t; const c = blockedAt(x, z, 1.2); if (c && c.width > 1.2) return false; }
  return true;
}
function nearestDoorTo(x, z, r, list) {
  let best = null, bd = r;
  for (const d of (list || (inInterior ? interiorStations[inInterior] : doors))) { const e = Math.hypot(d.x - x, d.z - z); if (e < bd) { bd = e; best = d; } }
  return best;
}

// the map's "show me the way": a street route on the minimap + a green beacon at the place. Arrive and it clears.
function guideTo(x, z, name) {
  const door = nearestDoorTo(x, z, 6.5, doors); if (door) { x = door.x; z = door.z; name = name || door.label; }
  guide = { x, z, name: name || "the marked spot", path: null };
  guideTimer = 0;
  refreshGuidePath();
  if (walkMarker) { walkMarker.position.set(x, floorAt(x, z) + 0.05, z); walkMarker.material.opacity = 0.85; }
  if (guideBeacon) guideBeacon.position.set(x, floorAt(x, z) + 30, z);
  paintGuideChip();
}
function clearGuide() {
  guide = null;
  if (walkMarker) walkMarker.material.opacity = 0;
  if (guideBeacon) guideBeacon.visible = false;
  paintGuideChip();
}
function refreshGuidePath() {
  if (!guide) return;
  guide.path = lineClear(state.x, state.z, guide.x, guide.z) || !inCityZone(state.x, state.z) ? [[guide.x, guide.z]] : routeTo(state.x, state.z, guide.x, guide.z);
}
function updateGuide(dt) {
  if (!guide) return;
  const out = !inInterior;
  if (guideBeacon) guideBeacon.visible = out && hasEntered;
  if (walkMarker) { walkMarker.visible = out; const k = 0.5 + 0.5 * Math.sin(performance.now() / 260); walkMarker.material.opacity = 0.55 + 0.3 * k; walkMarker.scale.setScalar(1.6 + 0.5 * k); }
  if (!out) return;
  const d = Math.hypot(guide.x - state.x, guide.z - state.z);
  if (d < 2.6) { showHint("You're at " + guide.name); clearGuide(); return; }
  if ((guideTimer -= dt) <= 0) { guideTimer = 0.5; refreshGuidePath(); paintGuideChip(d); }
}
let guideChip = null, hintEl = null, hintTimer = 0;
function paintGuideChip(dist) {
  if (!guideChip) {
    const wrap = document.querySelector("#mapWrap"); if (!wrap) return;
    guideChip = document.createElement("button"); guideChip.type = "button"; guideChip.id = "guideChip";
    guideChip.setAttribute("aria-label", "Route on the map - tap to clear it");
    guideChip.addEventListener("click", (e) => { e.stopPropagation(); clearGuide(); });
    wrap.appendChild(guideChip);
  }
  if (!guide) { guideChip.classList.add("hidden"); return; }
  const d = dist != null ? dist : Math.hypot(guide.x - state.x, guide.z - state.z);
  guideChip.textContent = "→ " + guide.name + " · " + Math.round(d) + " m  ✕";
  guideChip.classList.remove("hidden");
}
function showHint(text) {
  if (!hintEl) { hintEl = document.createElement("div"); hintEl.id = "tapHint"; hintEl.setAttribute("role", "status"); document.body.appendChild(hintEl); }
  hintEl.textContent = text; hintEl.classList.add("show");
  clearTimeout(hintTimer); hintTimer = setTimeout(() => hintEl.classList.remove("show"), 2600);
}

// a tap/click on the world USES what it touches (a door, a green mat, an open lot). The ground does nothing.
const USE_REACH = 9;   // metres: close enough to reach out and use it
const _ray = new THREE.Raycaster(), _ndc = new THREE.Vector2();
function worldPointAt(cx, cy) {
  _ndc.set(cx / window.innerWidth * 2 - 1, -(cy / window.innerHeight) * 2 + 1);
  _ray.setFromCamera(_ndc, camera);
  const o = _ray.ray.origin, d = _ray.ray.direction;
  for (let t = 0.6; t < 240; t += 0.5) {
    const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
    if (inInterior) { if (y <= 0) return [x, z]; continue; }
    if (blockedAt(x, z, y)) { const b = t - 1.2; return [o.x + d.x * b, o.z + d.z * b]; }   // a building face: the point just in front of it
    if (y <= floorAt(x, z)) return [x, z];
  }
  return null;
}
function useAt(cx, cy) {
  const hit = worldPointAt(cx, cy); if (!hit) return false;
  const door = nearestDoorTo(hit[0], hit[1], 3.5);
  if (door) {
    if (Math.hypot(door.x - state.x, door.z - state.z) <= USE_REACH) { activeDoor = door; enterActive(); }
    else showHint(door.label + " - walk to the green mat to go in");
    return true;
  }
  if (!inInterior) for (const pad of plotPads) {
    if (pad.claimed) continue;
    const b = pad.box;
    if (Math.abs(hit[0] - b.x) > b.width / 2 + 1.5 || Math.abs(hit[1] - b.z) > b.depth / 2 + 1.5) continue;
    if (Math.hypot(pad.x - state.x, pad.z - state.z) <= USE_REACH + 6) openClaim(pad);
    else showHint("Lot " + (pad.plot + 1) + " is open - walk over to claim it");
    return true;
  }
  return false;
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
  if (DEV && window.__camOverride) { const o = window.__camOverride; camera.position.set(o[0], o[1], o[2]); camera.lookAt(o[3], o[4], o[5]); return; }
  if (!hasEntered) {   // the gate-page peek and the intro card: a slow orbit around downtown, the skyline in view
    previewAngle += dt * 0.05;
    const radius = 150;
    camera.position.set(10 + Math.sin(previewAngle) * radius, 66, -10 + Math.cos(previewAngle) * radius);
    camera.lookAt(10, 8, -10);
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
  animatePeople(dt);
  updateGrass();
  updateFireflies();
  updateDayNight();
  if (city) city.update(dt, performance.now() / 1000, hasEntered && !inInterior ? state : null);
  updateCamera(dt);
  updateGuide(dt);
  sendState();
  renderer.render(scene, camera);
  frameNo++;
  if (frameNo === 2) { document.getElementById("loadingWorld")?.classList.add("hidden"); try { window.__w2Ready = performance.now(); console.log("[W2] first frame at", Math.round(performance.now()), "ms"); } catch (e) {} }
  mapTimer += dt; if (mapTimer > 0.12) { mapTimer = 0; drawMinimap(); }
  requestAnimationFrame(animate);
}
let frameNo = 0, mapTimer = 0;

// ---- enter flow ----
function enterWorld() {
  hasEntered = true;
  wantsConnection = true;
  connect();
  overlay.classList.add("hidden");
  document.body.classList.add("entered");
  mapDirty = true;
  if (isTouch) goFullscreen();
  // No pointer lock: it swallowed the first click and was half of the "double-click to walk" problem.
  // Look = drag; walk = WASD/arrows or the left stick. A tap/click only USES things (doors, mats, lots).
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
  input.crouchHeld = false;
  input.jumpQueued = false;
  if (stick) stick.reset();
}

// ---- input wiring ----
enterButton.addEventListener("click", enterWorld);
if (PREVIEW) {
  // Gate-page embed: hide the intro and every control, keep the orbit camera circling the
  // plaza (updateCamera already orbits while !hasEntered - we simply never enter).
  document.body.classList.add("preview");
  overlay.classList.add("hidden");
}

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
  if (event.code === "Escape" && mapOpen) { event.preventDefault(); toggleMap(false); return; }
  if (hasEntered && event.code === "KeyM") { event.preventDefault(); toggleMap(); return; }
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

// ---- touch + mouse: the invisible floating stick (/hb-thumbstick.js). Nothing on screen until a thumb lands on the
// left half; the stick appears under it, follows it, and is gone on release. The right half drags the view. Both at once.
// Mouse: drag looks. A quick tap/click anywhere USES what it touches (a door, a green mat, an open lot) - never walks.
const stick = createThumbstick(canvas, {
  enabled: () => hasEntered && !mapOpen,
  onLook: (dx, dy, kind) => { const k = kind === "mouse" ? 1.1 : 2.4; look(dx * k, dy * k); },
  onTap: (x, y) => { if (hasEntered) useAt(x, y); },
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

doorPrompt.addEventListener("click", () => enterActive());
claimSubmit.addEventListener("click", submitClaim);
claimCancel.addEventListener("click", closeClaim);
claimInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); submitClaim(); } });

window.addEventListener("pagehide", () => { try { channel?.untrack(); } catch (e) {} });
window.addEventListener("blur", clearMovementInput);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) clearMovementInput();
});

// ---- the map: a minimap (top right) and a full map with every door; tap a place and it shows you the way ----
let mapStatic = null, mapDirty = true, mapOpen = false;
const MAPB = { x0: -182, x1: 182, z0: -196, z1: 178 };
const mini = document.querySelector("#minimap"), bigmap = document.querySelector("#bigmap"), mapOverlay = document.querySelector("#mapOverlay");
const placeLabel = document.querySelector("#placeLabel"), placeList = document.querySelector("#placeList");
function mxy(x, z, W, H) { return [(x - MAPB.x0) / (MAPB.x1 - MAPB.x0) * W, (z - MAPB.z0) / (MAPB.z1 - MAPB.z0) * H]; }
function drawCityMap(ctx, W, H, big) {
  ctx.fillStyle = "#2f3b2c"; ctx.fillRect(0, 0, W, H);
  const r = (x0, z0, x1, z1, col) => { const a = mxy(x0, z0, W, H), b = mxy(x1, z1, W, H); ctx.fillStyle = col; ctx.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]); };
  r(MAPB.x0, RIVER.zN, MAPB.x1, WALL_Z, "#2d5b74");
  r(CITY_RECT.x0, WALL_Z, CITY_RECT.x1, CITY_RECT.z1, "#4b4e52");
  const xs = GRID.xs, zs = GRID.zs;
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < zs.length - 1; j++) r(xs[i] + ROAD, zs[j] + ROAD, xs[i + 1] - ROAD, zs[j + 1] - ROAD, i === 3 && j === 1 ? "#5f8a4e" : "#b9b09c");
  r(BRIDGE.x - 2.6, BRIDGE.z0, BRIDGE.x + 2.6, BRIDGE.z1, "#c9c3b4");
  const s = W / 300;
  if (big) {
    ctx.font = `600 ${Math.max(9, 11 * s)}px system-ui, sans-serif`; ctx.fillStyle = "#e8e8e2"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    // street names sit in the margins (bottom for north-south streets, left edge for east-west) so they never sit on a place label
    ctx.fillStyle = "#cfd6dc";
    for (let i = 0; i < xs.length; i++) { const p = mxy(xs[i], 174, W, H); ctx.fillText(GRID.xNames[i].replace(" St", ""), p[0], p[1]); }
    ctx.textAlign = "left";
    for (let j = 0; j < zs.length; j++) { const p = mxy(-181, zs[j], W, H); ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(-Math.PI / 2); ctx.textAlign = "center"; ctx.fillText(GRID.zNames[j].replace(" St", "").replace(" Blvd", ""), 0, 4 * s); ctx.restore(); }
    ctx.textAlign = "center";
    const rp = mxy(110, (RIVER.zN + WALL_Z) / 2, W, H); ctx.fillStyle = "#9fd0ff"; ctx.fillText("the river", rp[0], rp[1]);
  }
  if (city) {
    for (const l of city.landmarks) {
      const p = mxy(l.x, l.z, W, H);
      ctx.fillStyle = l.kind === "plot" ? "#7bd88f" : l.kind === "parking" ? "#5a8ad0" : l.kind === "civic" ? "#ffd166" : "#e9e2cf";
      if (l.kind === "parking" && !big) continue;
      ctx.beginPath(); ctx.arc(p[0], p[1], (l.kind === "civic" ? 3.2 : l.kind === "plot" && big ? 5 : 2.4) * Math.max(1, s * 0.9), 0, 7); ctx.fill();
      if (big && l.kind === "plot") { ctx.fillStyle = "#08130c"; ctx.font = `800 ${Math.max(8, 8 * s)}px system-ui, sans-serif`; ctx.fillText(l.name.replace("Lot ", ""), p[0], p[1] + 0.5); }
      else if (big && (l.kind === "civic" || l.kind === "landmark" || l.kind === "bridge" || l.kind === "park")) {
        const short = { "Grand Palace Theater": "Theater", "Social Hall": "Social", "Public Library": "Library", "Union Station": "Station", "Wells St Bridge": "Bridge" }[l.name] || l.name;
        const below = l.name === "Social Hall" || l.name === "Arcade" || l.name === "Courthouse";
        ctx.font = `700 ${Math.max(9, 10 * s)}px system-ui, sans-serif`; const tw = ctx.measureText(short).width, ty = p[1] + (below ? 11 : -11) * s;
        ctx.fillStyle = "rgba(10,14,18,0.72)"; ctx.fillRect(p[0] - tw / 2 - 3, ty - 7 * s, tw + 6, 14 * s);
        ctx.fillStyle = "#ffffff"; ctx.fillText(short, p[0], ty);
      }
    }
  }
}
function buildMinimap() {
  if (!mini) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1), size = mini.clientWidth || 112;
  mini.width = mini.height = Math.round(size * dpr);
  mapStatic = document.createElement("canvas"); mapStatic.width = mapStatic.height = mini.width;
  drawCityMap(mapStatic.getContext("2d"), mapStatic.width, mapStatic.height, false);
  mapDirty = false;
  if (placeList && city) {
    const places = doors.filter((d) => d.id).map((d) => ({ name: d.label, x: d.x, z: d.z }))
      .concat(plotPads.filter((p) => !p.claimed).map((p) => ({ name: "Lot " + (p.plot + 1) + " · open for a project", x: p.x, z: p.z })))
      .concat(city.landmarks.filter((l) => l.kind === "landmark" || l.kind === "bridge" || l.kind === "park" || l.kind === "tower").map((l) => ({ name: l.name, x: l.kind === "bridge" ? BRIDGE.x : l.x, z: l.kind === "bridge" ? WALL_Z + 2 : l.kind === "landmark" ? l.z - 16 : l.z + (l.kind === "tower" ? -16 : 0) })));
    placeList.innerHTML = "";
    for (const pl of places) { const b = document.createElement("button"); b.type = "button"; b.textContent = pl.name; b.addEventListener("click", () => { toggleMap(false); guideTo(pl.x, pl.z, pl.name.split(" · ")[0]); }); placeList.appendChild(b); }
  }
}
function nearestName(v, lines, names) { let k = 0, d = Infinity; lines.forEach((L, i) => { const e = Math.abs(v - L); if (e < d) { d = e; k = i; } }); return [names[k], d]; }
function drawMinimap() {
  if (!mini || !mapStatic || !hasEntered) return;
  if (mapDirty) buildMinimap();
  const ctx = mini.getContext("2d"), W = mini.width, H = mini.height;
  ctx.drawImage(mapStatic, 0, 0);
  for (const r of remotes.values()) { const p = mxy(r.group.position.x, r.group.position.z, W, H); ctx.fillStyle = "#4fa3ff"; ctx.beginPath(); ctx.arc(p[0], p[1], 2.5 * W / 112, 0, 7); ctx.fill(); }
  if (guide && !inInterior) drawGuide(ctx, W, H, W / 112);
  if (!inInterior) {
    const p = mxy(state.x, state.z, W, H), a = Math.atan2(-Math.sin(state.yaw), -Math.cos(state.yaw)), k = W / 112;
    ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(a + Math.PI / 2);
    ctx.fillStyle = "#ffffff"; ctx.strokeStyle = "#0b0f14"; ctx.lineWidth = 1.5 * k;
    ctx.beginPath(); ctx.moveTo(0, -6 * k); ctx.lineTo(4.2 * k, 4.5 * k); ctx.lineTo(0, 2.4 * k); ctx.lineTo(-4.2 * k, 4.5 * k); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  }
  if (placeLabel) {
    let label;
    if (inInterior) label = ({ theater: "Grand Palace Theater", arcade: "Arcade", library: "Public Library" })[inInterior] || "inside";
    else if (state.z < WALL_Z - 0.5) label = state.z > RIVER.zN ? "Wells St Bridge" : "the north woods";
    else if (!inCityZone(state.x, state.z)) label = "outside downtown";
    else { const [xn, dx] = nearestName(state.x, GRID.xs, GRID.xNames), [zn, dz] = nearestName(state.z, GRID.zs, GRID.zNames); label = state.z < GRID.zs[0] - ROAD ? "Riverfront" : dx < 10 && dz < 10 ? xn + " & " + zn : dx < dz ? xn : zn; }
    if (placeLabel.textContent !== label) placeLabel.textContent = label;
  }
}
// the route from you to the place you picked, drawn on a map canvas (minimap and full map)
function drawGuide(ctx, W, H, k) {
  if (!guide) return;
  ctx.save(); ctx.lineJoin = ctx.lineCap = "round";
  const pts = [[state.x, state.z]].concat(guide.path || [[guide.x, guide.z]]);
  for (const pass of [["rgba(8,19,12,.85)", 4.2], ["#7bd88f", 2.2]]) {
    ctx.strokeStyle = pass[0]; ctx.lineWidth = pass[1] * k; ctx.beginPath();
    pts.forEach((q, i) => { const m = mxy(q[0], q[1], W, H); if (i) ctx.lineTo(m[0], m[1]); else ctx.moveTo(m[0], m[1]); });
    ctx.stroke();
  }
  const e = mxy(guide.x, guide.z, W, H); ctx.fillStyle = "#7bd88f"; ctx.strokeStyle = "#08130c"; ctx.lineWidth = 1.5 * k;
  ctx.beginPath(); ctx.arc(e[0], e[1], 4 * k, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore();
}
function toggleMap(open) {
  mapOpen = open === undefined ? !mapOpen : open;
  if (!mapOverlay) return;
  mapOverlay.classList.toggle("hidden", !mapOpen);
  if (mapOpen && bigmap) {
    const dpr = Math.min(2, window.devicePixelRatio || 1), size = Math.min(window.innerWidth - 48, 520, window.innerHeight * 0.55);
    bigmap.style.width = bigmap.style.height = size + "px"; bigmap.width = bigmap.height = Math.round(size * dpr);
    const ctx = bigmap.getContext("2d"); drawCityMap(ctx, bigmap.width, bigmap.height, true);
    if (guide && !inInterior) drawGuide(ctx, bigmap.width, bigmap.height, bigmap.width / 300);
    if (!inInterior) { const p = mxy(state.x, state.z, bigmap.width, bigmap.height); ctx.fillStyle = "#ffffff"; ctx.strokeStyle = "#000"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p[0], p[1], 6 * dpr, 0, 7); ctx.fill(); ctx.stroke(); }
    clearMovementInput();
  }
}
if (mini) mini.addEventListener("click", () => { if (hasEntered) toggleMap(true); });
document.querySelector("#mapClose")?.addEventListener("click", () => toggleMap(false));
if (bigmap) bigmap.addEventListener("click", (e) => {
  const r = bigmap.getBoundingClientRect(), x = MAPB.x0 + (e.clientX - r.left) / r.width * (MAPB.x1 - MAPB.x0), z = MAPB.z0 + (e.clientY - r.top) / r.height * (MAPB.z1 - MAPB.z0);
  toggleMap(false); guideTo(x, z);
});

// ---- BOOT (end of file by design: every const/let above is initialized before these run — TDZ law) ----
if (DEV) window.W2 = {
  BUILD, state, renderer, scene, camera, get city() { return city; }, doors, plotPads, buildingColliders,
  enter: () => enterWorld(), tap: (x, y) => useAt(x, y), guideTo: (x, z, n) => guideTo(x, z, n), clearGuide: () => clearGuide(), get guide() { return guide && { name: guide.name, x: guide.x, z: guide.z }; }, path: () => guide && guide.path && guide.path.map((p) => p.map((v) => Math.round(v))), stick,
  activeDoor: () => activeDoor && activeDoor.label, activePlot: () => activePlot && activePlot.plot, enterActive: () => enterActive(), inInterior: () => inInterior,
  remotes: () => remotes.size, connected: () => connected,
  tris() {   // static triangle count by kind (instanced meshes multiplied out) - for the phone budget
    const out = {};
    scene.traverse((o) => {
      if (!o.isMesh && !o.isPoints) return;
      const g = o.geometry; if (!g) return;
      const t = Math.round((g.index ? g.index.count : g.attributes.position.count) / 3) * (o.isInstancedMesh ? o.count : 1);
      const k = o.userData.kit ? "kit:" + o.userData.kit : o.isInstancedMesh ? "inst:" + (o.material.name || g.type) + ":" + (o.count) : o.isPoints ? "points" : "mesh:" + g.type;
      out[k] = (out[k] || 0) + t;
    });
    return out;
  },
};
async function boot() {
  progress(0.08, "Starting the engine");
  await buildWorld();
  progress(1, "Ready");
  animate();
  resolveIdentity();   // loads the database client AFTER the city is on screen
}
boot().catch((e) => {
  try { console.error("[W2] boot failed", e); window.__w2Progress && window.__w2Progress(-1, "The city failed to load: " + (e && e.message || e)); } catch (e2) {}
});
