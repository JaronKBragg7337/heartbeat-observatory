// Real City world: streams real-map tiles around the player. See /realcity/README.md.
// Near tiles: full detail (storefronts, cornices, rooftop units, paint, crosswalks, street signs, lamps).
// Mid tiles: same buildings + streets, no signs/lamps/paint. Far: one instanced skyline of every building in the city.
import * as THREE from "three";
import { createThumbstick } from "/hb-thumbstick.js?v=2026-11-05a";
import { buildTile, buildDome, makeMaterials, shared, inside, distSeg, abbrev } from "./build.js?v=2026-11-05a";

const Q = new URLSearchParams(location.search);
const CITY = window.RC_CITY || Q.get("city") || "fort-wayne";
const DATA = `/realcity/data/${CITY}/`;
const DEV = Q.has("dev");
const $ = (id) => document.getElementById(id);
const loadT0 = performance.now();
const setLoad = (f, msg) => { const b = $("loadBar"); if (b) b.style.width = Math.round(f * 100) + "%"; if (msg && $("loadMsg")) $("loadMsg").textContent = msg; };

// ---------------------------------------------------------------------------------------------- renderer + scene
const canvas = $("game");
const tier = window.HBDevice;
const phone = matchMedia("(pointer: coarse)").matches;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(tier?.rendererPixelRatio ? tier.rendererPixelRatio(2, 1.5, 1.1) : Math.min(devicePixelRatio || 1, phone ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
const SHADOWS = tier?.quality?.allowShadows !== false && !Q.has("noshadow");
renderer.shadowMap.enabled = SHADOWS; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.3, 5000); camera.rotation.order = "YXZ";
scene.fog = new THREE.FogExp2(0xb7d2ea, 0.0011);
const maxAniso = renderer.capabilities.getMaxAnisotropy();
const M = makeMaterials(maxAniso);

// sky: World 2's sky design (gradient, sun glow, drifting fbm clouds), own copy
const sky = (() => {
  const mat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false,
    uniforms: { sunDir: { value: new THREE.Vector3(0, 1, 0) }, zenith: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, glow: { value: new THREE.Color() }, cloudLit: { value: new THREE.Color() }, cloudShade: { value: new THREE.Color() }, time: { value: 0 } },
    vertexShader: "varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }",
    fragmentShader: `uniform vec3 sunDir, zenith, horizon, glow, cloudLit, cloudShade; uniform float time; varying vec3 vDir;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<5;i++){ v+=a*n(p); p*=2.03; a*=0.5; } return v; }
      void main(){ vec3 d = normalize(vDir); float up = max(d.y, 0.0); vec3 col = mix(horizon, zenith, pow(up, 0.55)); if (d.y < 0.0) col = horizon * (1.0 + d.y * 0.6);
        float s = max(dot(d, normalize(sunDir)), 0.0); col += glow * (pow(s, 8.0) * 0.35 + pow(s, 64.0) * 0.6) + vec3(1.0,0.97,0.9) * smoothstep(0.9993, 0.9998, s) * step(0.0, sunDir.y + 0.05);
        if (d.y > 0.02) { vec2 uv = d.xz / (d.y + 0.12) * 0.9 + vec2(time * 0.006, time * 0.002); float c = smoothstep(0.52, 0.78, fbm(uv * 1.6)) * smoothstep(0.02, 0.25, d.y); vec3 cc = mix(cloudShade, cloudLit, clamp(fbm(uv * 1.6 + 0.35) * 1.4, 0.0, 1.0)); col = mix(col, cc, c * 0.85); }
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }` });
  const m = new THREE.Mesh(new THREE.SphereGeometry(4000, 32, 16), mat); m.frustumCulled = false; m.renderOrder = -1; scene.add(m); return m;
})();
const SKY_PAL = { night: { zenith: 0x060c1c, horizon: 0x1a2640, glow: 0x1d2a48, cloudLit: 0x26304a, cloudShade: 0x111827 }, dusk: { zenith: 0x1f3566, horizon: 0xe98a58, glow: 0xffa860, cloudLit: 0xf2a377, cloudShade: 0x5a4a66 }, day: { zenith: 0x2f6fc6, horizon: 0xb7d2ea, glow: 0xfff0d0, cloudLit: 0xffffff, cloudShade: 0xb9c3cf } };
const _t = new THREE.Color();
const sun = new THREE.DirectionalLight(0xfff1dc, 2.6); sun.castShadow = SHADOWS;
sun.shadow.mapSize.set(phone ? 1024 : 2048, phone ? 1024 : 2048); const SC = sun.shadow.camera; SC.left = SC.bottom = -110; SC.right = SC.top = 110; SC.near = 10; SC.far = 700; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.4;
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0xcfe3ff, 0x5a5040, 0.9); scene.add(hemi);
const pmrem = new THREE.PMREMGenerator(renderer);
let envTex = null;
function refreshEnv() { const s = new THREE.Scene(); const sk = sky.clone(); sk.material = sky.material; s.add(sk); if (envTex) envTex.dispose(); envTex = pmrem.fromScene(s, 0, 1, 5000).texture; scene.environment = envTex; }

let tod = Q.has("tod") ? +Q.get("tod") : 0.32, todTarget = null;   // 0.25 sunrise, 0.5 noon, 0.75 sunset
function applyTod(force) {
  const a = (tod - 0.25) * Math.PI * 2, e = Math.sin(a);          // sun elevation proxy
  const sd = new THREE.Vector3(Math.cos(a) * 0.8, Math.sin(a), 0.45).normalize();
  sky.material.uniforms.sunDir.value.copy(sd);
  const u = sky.material.uniforms, mix = (A, B, t) => { for (const k of ["zenith", "horizon", "glow", "cloudLit", "cloudShade"]) u[k].value.setHex(A[k]).lerp(_t.setHex(B[k]), t); };
  if (e >= 0.25) mix(SKY_PAL.day, SKY_PAL.day, 0); else if (e >= 0) mix(SKY_PAL.dusk, SKY_PAL.day, e / 0.25); else if (e >= -0.2) mix(SKY_PAL.dusk, SKY_PAL.night, -e / 0.2); else mix(SKY_PAL.night, SKY_PAL.night, 0);
  const day = THREE.MathUtils.clamp((e + 0.08) / 0.35, 0, 1), night = 1 - day;
  sun.userData.dir = e > -0.05 ? sd : new THREE.Vector3(-sd.x, Math.max(0.35, -sd.y), -sd.z);          // moonlight after dark
  sun.color.setHex(e > -0.05 ? (e < 0.2 ? 0xffc890 : 0xfff1dc) : 0x9fb4e8); sun.intensity = e > -0.05 ? 0.4 + 2.3 * day : 0.7;
  hemi.intensity = 0.55 + 0.4 * day; hemi.color.setHex(day > 0.3 ? 0xcfe3ff : 0x4a5d8a);
  scene.fog.color.copy(u.horizon.value); scene.fog.density = 0.0009 + 0.0005 * night;
  shared.litU.value = night > 0.35 ? 0.5 : 0.0;
  M.building.emissiveIntensity = night * 1.4; M.lampHead.emissiveIntensity = night * 3; M.sign.emissiveIntensity = 0.05 + night * 0.25;
  renderer.toneMappingExposure = 1.05 + night * 0.25;
  if (skyline) skyline.material.emissiveIntensity = night * 0.6;
  const key = night > 0.5 ? "n" : "d"; if (force || key !== applyTod.key) { applyTod.key = key; refreshEnv(); }
}

// ---------------------------------------------------------------------------------------------- city data
let city = null, skyline = null;
const tiles = new Map();   // key -> { state, built, level, ... }
const toXZ = (lat, lon) => { const [la0, lo0] = city.origin, phi = la0 * Math.PI / 180; const ml = 111132.92 - 559.82 * Math.cos(2 * phi) + 1.175 * Math.cos(4 * phi), mo = 111412.84 * Math.cos(phi) - 93.5 * Math.cos(3 * phi); return [(lon - lo0) * mo, -(lat - la0) * ml]; };
const state = { x: 0, y: 1.7, z: 0, yaw: 0, pitch: -0.02 };
const EYE = 1.65;
const NEAR_R = 330, MID_R = phone ? 620 : 800, DROP_R = MID_R + 260;
let landmarkDone = new Set(), hooks = [];

function buildSkyline() {
  const S = city.skyline, n = S.length;
  const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, emissive: 0x332514, emissiveIntensity: 0 });
  const im = new THREE.InstancedMesh(geo, mat, n), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color(), ax = new THREE.Vector3(0, 1, 0);
  const FC = [0x9a6a58, 0xd6ccb8, 0x8fa3b3, 0xc9c4ba, 0xd8d3c8, 0xa9adb0, 0xbdb8b0];
  im.userData.mats = new Array(n);
  for (let i = 0; i < n; i++) { const [mx, mz, w, d, ang, h, g, fam] = S[i]; q.setFromAxisAngle(ax, -ang / 1000); m4.compose(new THREE.Vector3(mx / 10, g / 10 - 0.5, mz / 10), q, new THREE.Vector3(Math.max(1, w / 10), h / 10 + 0.5, Math.max(1, d / 10))); im.setMatrixAt(i, m4); im.userData.mats[i] = m4.clone(); im.setColorAt(i, c.setHex(FC[fam] || 0xaaaaaa)); }
  im.computeBoundingSphere(); im.frustumCulled = false; im.name = "skyline"; scene.add(im); return im;
}
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
function skylineHide(key, hide) {
  const r = city.skylineTile[key]; if (!r || !skyline) return;
  for (let i = r[0]; i < r[0] + r[1]; i++) skyline.setMatrixAt(i, hide ? ZERO : skyline.userData.mats[i]);
  skyline.instanceMatrix.needsUpdate = true;
}

async function loadTile(key) {
  const t = tiles.get(key);
  try { const r = await fetch(DATA + "t_" + key + ".json"); t.data = await r.json(); t.state = "loaded"; }
  catch (e) { t.state = "error"; console.warn("tile " + key, e); }
}
function buildTileNow(key, detail) {
  const t = tiles.get(key);
  const res = buildTile(t.data, city, { detail, maxAniso, showGuess: Q.has("guess") });
  if (t.built) disposeTile(t);
  t.built = res; t.level = detail ? 2 : 1; scene.add(res.group); skylineHide(key, true);
  // landmarks: the courthouse dome sits on its footprint centroid
  for (const L of city.landmarks) if (L.kind === "dome" && !(L.partsTop > L.roof + 5) && L.tile === key && !landmarkDone.has(L.id)) { const d = buildDome(L.x, L.z, L.ground + L.roof); scene.add(d); t.dome = d; landmarkDone.add(L.id); L.top = d.userData.top; }
}
function disposeTile(t) {
  const g = t.built.group; scene.remove(g); g.traverse((o) => { if (o.isMesh && o.geometry && !o.isInstancedMesh) o.geometry.dispose(); if (o.isInstancedMesh) o.dispose(); });
  if (t.dome) { scene.remove(t.dome); for (const L of city.landmarks) if (L.tile === t.data.ix + "_" + t.data.iz) landmarkDone.delete(L.id); t.dome = null; }
  t.built = null;
}
function tileDist(key) { const [ix, iz] = key.split("_").map(Number), T = city.tile, cx = (ix + 0.5) * T, cz = (iz + 0.5) * T; return Math.max(0, Math.hypot(cx - state.x, cz - state.z) - T * 0.7); }
let streamBusy = false;
async function stream(maxBuilds = 1) {
  if (streamBusy || !city) return; streamBusy = true;
  try {
    const want = city.tiles.map((k) => [k, tileDist(k)]).filter(([, d]) => d < DROP_R).sort((a, b) => a[1] - b[1]);
    let builds = 0;
    for (const [k, d] of want) {
      if (!tiles.has(k)) tiles.set(k, { state: "new" });
      const t = tiles.get(k);
      const lvl = d < NEAR_R ? 2 : d < MID_R ? 1 : 0;
      if (t.state === "new") { t.state = "loading"; loadTile(k); continue; }
      if (t.state !== "loaded" || builds >= maxBuilds) continue;
      if (lvl > 0 && (t.level || 0) < lvl) { buildTileNow(k, lvl === 2); builds++; }
    }
    for (const [k, t] of tiles) if (t.built) { const d = tileDist(k); if (d > DROP_R) { disposeTile(t); t.level = 0; skylineHide(k, false); } else if (d > NEAR_R + 80 && t.level === 2) { const g = t.built.group; for (const o of g.children) if (o.name === "signs" || o.name === "lamps" || o.name === "lampHeads") o.visible = false; } else if (t.level === 2) for (const o of t.built.group.children) o.visible = true; }
  } finally { streamBusy = false; }
}
const builtTiles = () => [...tiles.values()].filter((t) => t.built);

// ---------------------------------------------------------------------------------------------- ground height + collisions
function groundAt(x, z) {
  const key = Math.floor(x / city.tile) + "_" + Math.floor(z / city.tile), t = tiles.get(key);
  let y = t && t.built ? t.built.ground(x, z) : 0;
  for (const tt of builtTiles()) for (const b of tt.built.bridges) { if (distSeg(x, z, [b.ax, b.az, b.bx, b.bz]) < b.hw) { const L = Math.hypot(b.bx - b.ax, b.bz - b.az) || 1, s = Math.max(0, Math.min(1, ((x - b.ax) * (b.bx - b.ax) + (z - b.az) * (b.bz - b.az)) / (L * L))); y = Math.max(y, b.ya + (b.yb - b.ya) * s + 0.05); } }
  return y + 0.15;
}
function blocked(x, z) {
  const r = 0.35;
  for (const t of builtTiles()) { const [ix, iz] = t.built.group.name.slice(5).split("_").map(Number); const T = city.tile; if (x < ix * T - 60 || x > (ix + 1) * T + 60 || z < iz * T - 60 || z > (iz + 1) * T + 60) continue;
    for (const b of t.built.buildings) { if (b.y0 > state.y + 1 || b.top < state.y - 1) continue; if (inside([x, z], b.ring) && !b.holes.some((h) => inside([x, z], h))) return b; for (let i = 0; i < b.ring.length; i++) { const p = b.ring[i], q = b.ring[(i + 1) % b.ring.length]; if (distSeg(x, z, [p[0], p[1], q[0], q[1]]) < r) return b; } } }
  return null;
}
function moveBy(dx, dz) {
  const nx = state.x + dx, nz = state.z + dz;
  if (!blocked(nx, nz)) { state.x = nx; state.z = nz; return true; }
  if (!blocked(nx, state.z)) { state.x = nx; return true; }
  if (!blocked(state.x, nz)) { state.z = nz; return true; }
  return false;
}
function pushOut(x, z) { if (!blocked(x, z)) return [x, z]; for (let r = 1; r < 60; r += 1) for (let a = 0; a < 16; a++) { const px = x + Math.cos(a / 16 * 6.283) * r, pz = z + Math.sin(a / 16 * 6.283) * r; if (!blocked(px, pz)) return [px, pz]; } return [x, z]; }

// ---------------------------------------------------------------------------------------------- input: you WALK, drag looks, a tap USES things
// Jaron 11/5: "I don't want to tap to walk. I want to walk." Phone: the invisible floating stick (/hb-thumbstick.js, shared
// with World 2) - a thumb on the left half becomes the stick right where it lands; the right half drags the view; both at
// once; nothing on screen otherwise. Desktop: WASD / arrow keys + mouse drag, Shift runs. A tap on a door mat uses it, a tap
// on a building shows what it is, a tap on the ground does nothing.
const keys = new Set();
const ray = new THREE.Raycaster(), v2 = new THREE.Vector2();
const WALK_SPEED = 4.65, RUN_SPEED = 9;   // m/s: World 1/2's walk; the run is quicker than theirs because a real city is big
const USE_REACH = 9;                      // metres: close enough to reach out and use a door mat
const stick = createThumbstick(canvas, {
  enabled: () => entered && !bigOpen,
  onLook: (dx, dy, kind) => { const s = kind === "mouse" ? 0.0025 : 0.0055; state.yaw -= dx * s; state.pitch = THREE.MathUtils.clamp(state.pitch - dy * s, -1.35, 1.2); },
  onTap: (x, y) => tap(x, y),
});
const isTyping = (t) => t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
addEventListener("keydown", (e) => {
  if (isTyping(e.target)) return;
  if (entered && /^Arrow|^Space$/.test(e.code)) e.preventDefault();
  if (entered && (e.code === "KeyE" || e.code === "Enter") && nearHook) { e.preventDefault(); useHook(nearHook); return; }
  keys.add(e.code); if (e.code === "KeyN") toggleNight();
});
addEventListener("keyup", (e) => keys.delete(e.code));
addEventListener("blur", () => keys.clear());
document.addEventListener("visibilitychange", () => { if (document.hidden) keys.clear(); });
function pickables() { const o = []; for (const t of builtTiles()) for (const m of t.built.group.children) if (m.name === "buildings" || m.name === "ground" || m.name === "water") o.push(m); for (const h of hooks) if (h.mesh) o.push(h.mesh); return o; }
function buildingFromHit(hit) { const own = hit.object.userData.owner; if (!own) return null; const idx = hit.faceIndex * 3; let lo = 0, hi = own.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (own[mid][0] <= idx) lo = mid; else hi = mid - 1; } for (const t of builtTiles()) if (t.built.bMesh === hit.object) return t.built.buildings[own[lo][1]]; return null; }
function tap(cx, cy) {
  if (!entered) return;
  v2.set((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1); ray.setFromCamera(v2, camera); ray.far = 600;
  const hit = ray.intersectObjects(pickables(), false)[0]; if (!hit) { hideInfo(); return; }
  // a door mat: use it when you are close enough to reach it; from further away, say where it is
  const hk = hooks.find((h) => h.mesh === hit.object) || hooks.find((h) => h.mesh && Math.hypot(h.x - hit.point.x, h.z - hit.point.z) < 2.5);
  if (hk) { if (Math.hypot(hk.x - state.x, hk.z - state.z) <= USE_REACH) useHook(hk); else showNote(hk.label, "Walk to the green mat to go in."); return; }
  if (hit.object.name === "buildings") { const b = buildingFromHit(hit); if (b) showInfo(b); }
  else hideInfo();   // the ground: nothing happens (no tap-to-walk)
}
function useHook(h) { if (h.onEnter) h.onEnter(h); else if (h.href) location.href = h.href; else showNote(h.label, "Inside comes later."); }
function showNote(title, line) { const el = $("info"); el.textContent = ""; const b = document.createElement("b"); b.textContent = title; const s = document.createElement("span"); s.textContent = line; el.append(b, s); el.classList.remove("hidden"); clearTimeout(showInfo.t); showInfo.t = setTimeout(hideInfo, 3500); }

// ---------------------------------------------------------------------------------------------- hooks: site pages live inside the world (doors, cabinets, shelves). register() is the API.
function registerHook(h) {
  // h = { id, kind: "door", label, x, z | lat, lon, href, onEnter }
  if (h.lat != null && h.x == null) [h.x, h.z] = toXZ(h.lat, h.lon);
  hooks.push(h); return h;
}
function placeHookMeshes() {
  for (const h of hooks) {
    if (h.mesh || h.kind !== "door") continue;
    // snap the door mat to the nearest building wall (the courthouse), just outside it
    let best = null, bd = 1e9;
    for (const t of builtTiles()) for (const b of t.built.buildings) for (let i = 0; i < b.ring.length; i++) { const p = b.ring[i], q = b.ring[(i + 1) % b.ring.length], d = distSeg(h.x, h.z, [p[0], p[1], q[0], q[1]]); if (d < bd) { bd = d; best = [p, q, b]; } }
    if (!best || bd > 40) continue;
    const [p, q] = best, dx = q[0] - p[0], dz = q[1] - p[1], L = Math.hypot(dx, dz), t = Math.max(0.1, Math.min(0.9, ((h.x - p[0]) * dx + (h.z - p[1]) * dz) / (L * L)));
    let nx = dz / L, nz = -dx / L; const mx = p[0] + dx * t, mz = p[1] + dz * t; if (inside([mx + nx, mz + nz], best[2].ring)) { nx = -nx; nz = -nz; }
    h.x = mx + nx * 1.6; h.z = mz + nz * 1.6;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.6).rotateX(-Math.PI / 2), M.mat); mesh.position.set(h.x, groundAt(h.x, h.z) + 0.03, h.z); mesh.rotation.y = Math.atan2(dx, dz); mesh.name = "hook " + h.id; scene.add(mesh); h.mesh = mesh;
  }
}
let nearHook = null;
function checkHooks() {
  let near = null; for (const h of hooks) if (h.mesh && Math.hypot(h.x - state.x, h.z - state.z) < 2.2) near = h;
  nearHook = near;
  const el = $("doorPrompt");
  if (near) { el.classList.remove("hidden"); el.textContent = near.href ? (phone ? "Tap: enter " : "E: enter ") + near.label : near.label + " - inside comes later"; el.onclick = () => useHook(near); }
  else el.classList.add("hidden");
}

// ---------------------------------------------------------------------------------------------- HUD: place label, info card, minimap, big map, day/night
function nearestStreet() {
  let best = null, bd = 40;
  for (const t of builtTiles()) for (const r of t.data.r) { const [kind, , nameIx, , , , pts] = r; if (kind > 5 || nameIx < 0) continue; const ox = t.data.ix * city.tile, oz = t.data.iz * city.tile; for (let i = 0; i < pts.length - 2; i += 2) { const d = distSeg(state.x, state.z, [ox + pts[i] / 10, oz + pts[i + 1] / 10, ox + pts[i + 2] / 10, oz + pts[i + 3] / 10]); if (d < bd) { bd = d; best = city.names[nameIx]; } } }
  return best;
}
function showInfo(b) {
  const el = $("info"); const how = b.flags & 1 ? "height guessed from the building type" : b.flags & 2 ? `height from ${b.levels} floors on the map` : "height from the map";
  el.innerHTML = `<b>${b.name || (b.fam === "house" ? "House" : "Building")}</b><span>${Math.round(b.h)} m tall · ${how}</span>${b.landmark ? "<span>Landmark: custom model coming later</span>" : ""}<a href="https://www.openstreetmap.org/way/${b.id}" target="_blank" rel="noopener">see it on OpenStreetMap</a>`;
  el.classList.remove("hidden"); clearTimeout(showInfo.t); showInfo.t = setTimeout(hideInfo, 6000);
}
function hideInfo() { $("info").classList.add("hidden"); }
const mm = $("minimap"), mg = mm.getContext("2d");
function drawMap(g, W, H, cx, cz, scale, full) {
  g.fillStyle = "#24301f"; g.fillRect(0, 0, W, H);
  const X = (x) => W / 2 + (x - cx) * scale, Z = (z) => H / 2 + (z - cz) * scale;
  // water + buildings (skyline boxes are city-wide)
  for (const t of builtTiles()) for (const a of t.data.a) { if (a[0] !== 0 && a[0] !== 1) continue; const ox = t.data.ix * city.tile, oz = t.data.iz * city.tile, p = a[1]; g.fillStyle = a[0] === 0 ? "#2f5d74" : "#3d5a2c"; g.beginPath(); for (let i = 0; i < p.length; i += 2) g[i ? "lineTo" : "moveTo"](X(ox + p[i] / 10), Z(oz + p[i + 1] / 10)); g.fill(); }
  g.fillStyle = "#8c8780";
  for (const s of city.skyline) { const x = s[0] / 10, z = s[1] / 10, sx = X(x), sz = Z(z); if (sx < -20 || sz < -20 || sx > W + 20 || sz > H + 20) continue; g.save(); g.translate(sx, sz); g.rotate(s[4] / 1000); g.fillRect(-s[2] / 20 * scale, -s[3] / 20 * scale, s[2] / 10 * scale, s[3] / 10 * scale); g.restore(); }
  g.strokeStyle = "#e8e4da"; g.lineCap = "round";
  for (const r of city.roadsLite || []) { g.lineWidth = Math.max(1, (r[0] <= 3 ? 12 : r[0] === 4 ? 8 : 4) * scale); g.beginPath(); for (let i = 2; i < r.length; i += 2) g[i === 2 ? "moveTo" : "lineTo"](X(r[i]), Z(r[i + 1])); g.stroke(); }
  if (full) { g.fillStyle = "#fff"; g.font = "600 11px system-ui"; const seen = new Set(); for (const r of city.roadsLite || []) { if (r[0] > 3 || r[1] < 0 || seen.has(r[1])) continue; seen.add(r[1]); const m = 2 + 2 * Math.floor((r.length - 2) / 4); g.fillText(abbrev(city.names[r[1]]), X(r[m]) + 3, Z(r[m + 1]) - 3); } }
  for (const L of city.landmarks) if (L.x != null) { g.fillStyle = "#e8b86a"; g.beginPath(); g.arc(X(L.x), Z(L.z), full ? 6 : 4, 0, 7); g.fill(); }
  // you
  g.save(); g.translate(X(state.x), Z(state.z)); g.rotate(-state.yaw); g.fillStyle = "#7bd88f"; g.strokeStyle = "#0b1a10"; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -9); g.lineTo(6, 6); g.lineTo(0, 3); g.lineTo(-6, 6); g.closePath(); g.fill(); g.stroke(); g.restore();
}
let bigOpen = false, bigView = null;
function openBig() {
  bigOpen = true; $("mapOverlay").classList.remove("hidden");
  const c = $("bigmap"), W = Math.min(innerWidth - 28, 620), H = Math.min(innerHeight - 150, 620); c.width = W * devicePixelRatio; c.height = H * devicePixelRatio; c.style.width = W + "px"; c.style.height = H + "px";
  const [x0, z0, x1, z1] = city.box, sc = Math.min(W / (x1 - x0), H / (z1 - z0)); bigView = { cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, sc, W, H };
  const g = c.getContext("2d"); g.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); drawMap(g, W, H, bigView.cx, bigView.cz, sc, true);
}
$("minimap").addEventListener("click", openBig);
$("mapClose").addEventListener("click", () => { bigOpen = false; $("mapOverlay").classList.add("hidden"); });
$("bigmap").addEventListener("click", (e) => { const r = e.target.getBoundingClientRect(), x = bigView.cx + (e.clientX - r.left - bigView.W / 2) / bigView.sc, z = bigView.cz + (e.clientY - r.top - bigView.H / 2) / bigView.sc; bigOpen = false; $("mapOverlay").classList.add("hidden"); teleport(x, z); });
$("toCourt").addEventListener("click", () => { bigOpen = false; $("mapOverlay").classList.add("hidden"); goSpawn(); });
function toggleNight() { const e = Math.sin((tod - 0.25) * Math.PI * 2); todTarget = e > 0 ? 0.83 : 0.32; }
$("nightBtn").addEventListener("click", toggleNight);
async function teleport(x, z) { state.x = x; state.z = z; for (let i = 0; i < 40; i++) { await stream(3); const k = Math.floor(x / city.tile) + "_" + Math.floor(z / city.tile); const t = tiles.get(k); if (!t || t.built || t.state === "error") break; await new Promise((r) => setTimeout(r, 60)); } [state.x, state.z] = pushOut(x, z); state.y = groundAt(state.x, state.z) + EYE; }
function spawnXZ() { const s = city.spawn || { lat: city.origin[0], lon: city.origin[1], lookLat: city.origin[0] + 0.001, lookLon: city.origin[1] }; return s.x != null ? [s.x, s.z, s.lookX, s.lookZ] : [...toXZ(s.lat, s.lon), ...toXZ(s.lookLat, s.lookLon)]; }
function goSpawn() { const [x, z, lx, lz] = spawnXZ(); state.yaw = Math.atan2(-(lx - x), -(lz - z)); state.pitch = city.spawn?.pitch ?? 0.12; return teleport(x, z); }

// ---------------------------------------------------------------------------------------------- loop
let entered = false, frames = 0, lastMap = 0, lastStream = 0, lastHud = 0;
const fwd = new THREE.Vector3();
function step(dt) {
  if (todTarget != null) { tod += Math.sign(todTarget - tod) * Math.min(Math.abs(todTarget - tod), dt * 0.25); if (Math.abs(todTarget - tod) < 1e-3) { tod = todTarget; todTarget = null; } applyTod(); }
  // walking: keys (WASD / arrows, like World 2) + the analog floating stick; Shift or the stick's rim runs
  let mx = 0, mz = 0;
  if (entered) {
    if (keys.has("KeyW") || keys.has("ArrowUp")) mz -= 1; if (keys.has("KeyS") || keys.has("ArrowDown")) mz += 1;
    if (keys.has("KeyA") || keys.has("ArrowLeft")) mx -= 1; if (keys.has("KeyD") || keys.has("ArrowRight")) mx += 1;
    mx += stick.x; mz -= stick.y;
  }
  const l = Math.hypot(mx, mz);
  if (l > 0.02) {
    const n = Math.max(1, l), sp = ((keys.has("ShiftLeft") || keys.has("ShiftRight") || stick.running) ? RUN_SPEED : WALK_SPEED) * dt;
    const s = Math.sin(state.yaw), c = Math.cos(state.yaw); moveBy((mx * c + mz * s) / n * sp, (-mx * s + mz * c) / n * sp);
  }
  const gy = groundAt(state.x, state.z) + EYE; state.y += (gy - state.y) * Math.min(1, dt * 10);
  if (!DEV || !window.RC?.camOverride) { camera.position.set(state.x, state.y, state.z); camera.rotation.set(state.pitch, state.yaw, 0); }
  // sun + shadow follow the player
  const sd = sun.userData.dir || new THREE.Vector3(0.5, 1, 0.3); sun.position.set(camera.position.x + sd.x * 300, camera.position.y + sd.y * 300, camera.position.z + sd.z * 300); sun.target.position.copy(camera.position); sun.target.updateMatrixWorld();
  sky.position.copy(camera.position); sky.material.uniforms.time.value += dt;
}
let lastT = performance.now();
function loop() {
  requestAnimationFrame(loop);
  const now = performance.now(), dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  step(dt);
  if (now - lastStream > 250) { lastStream = now; stream(1).then(placeHookMeshes); }
  if (now - lastHud > 300 && entered) { lastHud = now; checkHooks(); const n = nearestStreet(); $("placeLabel").textContent = n ? abbrev(n) : ""; }
  if (now - lastMap > 200 && entered) { lastMap = now; drawMap(mg, mm.width, mm.height, state.x, state.z, mm.width / 420, false); }
  renderer.render(scene, camera); frames++;
}
addEventListener("resize", () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

// ---------------------------------------------------------------------------------------------- boot
(async () => {
  try {
    setLoad(0.08, "Reading the map index...");
    city = await (await fetch(DATA + "index.json")).json();
    city.landmarkIds = new Set(city.landmarks.map((l) => l.osm));
    document.title = city.name + " - Real City - Heartbeat Observatory";
    $("cityName").textContent = city.name; if ($("loadCity")) $("loadCity").textContent = city.name;
    $("attrElev").classList.toggle("hidden", !city.elevation);
    for (const h of city.hooks || []) registerHook(Object.assign({}, h));
    skyline = buildSkyline();
    { const [x0, z0, x1, z1] = city.box; const pad = 3000, gp = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 + pad, z1 - z0 + pad).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x6f7560, roughness: 1 })); gp.position.set((x0 + x1) / 2, -1.2, (z0 + z1) / 2); gp.receiveShadow = false; gp.name = "far ground"; scene.add(gp); }
    applyTod(true);
    const [sx, sz, lx, lz] = spawnXZ(); state.x = sx; state.z = sz; state.yaw = Math.atan2(-(lx - sx), -(lz - sz)); state.pitch = city.spawn?.pitch ?? 0.12;
    // first ring of tiles before the curtain lifts
    setLoad(0.15, "Downloading the streets around you...");
    const first = city.tiles.filter((k) => tileDist(k) < NEAR_R);
    for (const k of first) tiles.set(k, { state: "loading" });
    let done = 0; await Promise.all(first.map((k) => loadTile(k).then(() => setLoad(0.15 + 0.4 * (++done / first.length)))));
    let b = 0; for (const k of first.sort((a, c) => tileDist(a) - tileDist(c))) { if (tiles.get(k).state === "loaded") buildTileNow(k, true); setLoad(0.55 + 0.4 * (++b / first.length), "Raising the buildings..."); await new Promise((r) => setTimeout(r, 0)); }
    placeHookMeshes();
    [state.x, state.z] = pushOut(state.x, state.z); state.y = groundAt(state.x, state.z) + EYE;
    setLoad(1, "Ready"); loop();
    window.__rcReady = true; window.__rcLoadMs = Math.round(performance.now() - loadT0);
    $("loading").classList.add("hidden");
  } catch (e) { console.error(e); setLoad(1, "Could not load the city: " + e.message); $("loading").classList.add("failed"); }
})();
$("enterButton").addEventListener("click", () => { entered = true; $("overlay").classList.add("hidden"); document.body.classList.add("entered"); });

// dev handle: ?dev=1
window.RC = {
  state, tiles, hooks, registerHook, teleport, goSpawn, renderer, camera, scene, toXZ: (a, b) => toXZ(a, b), get city() { return city; },
  tap: (x, y) => tap(x, y), stick, useHook, get nearHook() { return nearHook && nearHook.label; },
  setTod: (v) => { tod = v; todTarget = null; applyTod(); }, camOverride: false, groundAt, nearestStreet, blocked,
  stats: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, tilesBuilt: builtTiles().length, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures }),
};
