// Bedroom v2 (sonnet): closed room, honest seen/made layers, a man whose every step is an event, tap anything for its history.
// Claude Sonnet 5.5, Heartbeat Observatory engine bake-off, 2026-10-26. No build step; three.js 0.160 from jsDelivr.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { History } from './history.js';
import { Sfx } from './audio.js';

const Q = new URLSearchParams(location.search);
const REC = Q.has('rec');                       // deterministic stepping for the screen recording
const $ = (id) => document.getElementById(id);
const FIXED = 1 / 30;
if (REC) document.body.classList.add('rec');

// ---------------------------------------------------------------- the room we know (metres, from meta.json + the tracked footage)
const B = { x0: -1.40, x1: 2.02, z0: -3.50, z1: 1.50, h: 2.45 };   // closed box: made walls sit on these planes
const L = -0.99;                                                    // the lane between the door wall and the bed foot
const DX = -1.36, DW = 0.92, DH = 2.03;
const DOORS = [{ id: 'D-0001', z: -2.52, name: 'the first door' }, { id: 'D-0002', z: -0.97, name: 'the middle door' }, { id: 'D-0003', z: 0.67, name: 'the last door' }];
const SEEN_RECT = { x0: -1.40, x1: 1.55, z0: -3.45, z1: 0.62 };    // floor the camera really saw (approximate)
const MADE_ROOM = { x0: -4.30, x1: -1.44, z0: -1.97, z1: 0.03 };   // the room behind the middle door (made when unlocked)
const NS = [{ id: 'Q-0006', lamp: 'Q-0008', x: 1.78, z: 0.34, name: 'left nightstand' }, { id: 'Q-0007', lamp: 'Q-0009', x: 1.78, z: -2.42, name: 'right nightstand' }];
const placeOf = (x, z) => (x < B.x0 - 0.02 ? 'patched-room' : (x >= SEEN_RECT.x0 && x <= SEEN_RECT.x1 && z >= SEEN_RECT.z0 && z <= SEEN_RECT.z1) ? 'seen-floor' : 'patched-floor');

// ---------------------------------------------------------------- three.js
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !REC, alpha: false, preserveDrawingBuffer: REC });
renderer.setPixelRatio(REC ? 2 : Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0x16140f);
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xfff1d8, 0x2a2118, 1.5)); { const sun = new THREE.DirectionalLight(0xffe2b0, 1.6); sun.position.set(4, 5, 1); scene.add(sun); }
const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 80);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.08; controls.enablePan = false;
controls.minDistance = 2.2; controls.maxDistance = 18; controls.minPolarAngle = 0.08; controls.maxPolarAngle = Math.PI * 0.485;
// ONE place for the knobs other passes will turn (see HANDOFF.md). Cameras: 'inside' = Kimi's evidence-first opening (shows the most of the original photo), 'overview' = the dollhouse.
const CONFIG = {
  camera: { default: 'inside', inside: { pos: [5.15, 4.35, 8.15], target: [-0.15, 0.75, -1.0] }, overview: { pos: [1.7, 6.6, 7.7], target: [-2.0, 0.3, -1.0] } },
  seen: { veil: { wall: 0.22, floor: 0.48 }, anchorFrame: 'v1_f0001jpg', otherAlpha: 0.92 },
};
window.HB_CONFIG = CONFIG;
let viewName = CONFIG.camera.default;
const HOME_TARGET = new THREE.Vector3(), HOME_POS = new THREE.Vector3();
function setView(name) { viewName = name; const c = CONFIG.camera[name]; HOME_POS.set(...c.pos); HOME_TARGET.set(...c.target); camera.position.copy(HOME_POS); controls.target.copy(HOME_TARGET); U.overview.value = name === 'overview' ? 1 : 0; controls.update(); fitView(); }
// Fit the projected room (and, in Overview, the study once it exists) inside the usable rectangle between the header and the bottom panel, 12 px margins.
function usableRect() { const top = ($('seg') ? $('seg').parentElement.getBoundingClientRect().bottom : 90) + 12, bot = ($('bottom') ? $('bottom').getBoundingClientRect().top : innerHeight) - 12; return { l: 12, r: innerWidth - 12, t: top, b: Math.max(top + 80, bot) }; }
function fitView() {
  if (!person && !scene) return; const R = usableRect(), pts = [], boxes = [[B.x0, 0, B.z0, B.x1, B.h, B.z1]];
  if (viewName === 'overview' && sim.openT != null && view.t >= sim.openT) boxes.push([MADE_ROOM.x0, 0, MADE_ROOM.z0, MADE_ROOM.x1, B.h, MADE_ROOM.z1]);
  for (const b of boxes) for (const x of [b[0], b[3]]) for (const y of [b[1], b[4]]) for (const z of [b[2], b[5]]) pts.push(new THREE.Vector3(x, y, z));
  const dir = new THREE.Vector3().subVectors(camera.position, controls.target), v = new THREE.Vector3();
  const measure = () => { camera.position.copy(controls.target).add(dir); camera.updateMatrixWorld(); camera.updateProjectionMatrix(); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const p of pts) { v.copy(p).project(camera); const sx = (v.x + 1) / 2 * innerWidth, sy = (1 - v.y) / 2 * innerHeight; x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy); } return { x0, x1, y0, y1 }; };
  for (let i = 0; i < 24; i++) {
    const m = measure(), over = m.x0 < R.l || m.x1 > R.r || m.y0 < R.t || m.y1 > R.b;
    if (over) { dir.multiplyScalar(1.07); continue; }
    const fillX = (m.x1 - m.x0) / (R.r - R.l), fillY = (m.y1 - m.y0) / (R.b - R.t);
    if (Math.max(fillX, fillY) < 0.82) { dir.multiplyScalar(0.96); const m2 = (() => { camera.position.copy(controls.target).add(dir); camera.updateMatrixWorld(); return 0; })(); const mm = measure(); if (mm.x0 < R.l || mm.x1 > R.r || mm.y0 < R.t || mm.y1 > R.b) { dir.multiplyScalar(1 / 0.96); break; } continue; }
    break;
  }
  camera.position.copy(controls.target).add(dir); controls.update();
}
let bottomShift = 0;
function home() { userMoved = false; setView(viewName); }
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w < h ? 62 : 46;
  camera.setViewOffset(w, h, 0, bottomShift, w, h); camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
const bro = new ResizeObserver(() => { const sh = $('sheet').offsetHeight; bottomShift = Math.round(($('bottom').offsetHeight - sh) * 0.42 + sh * 0.3); resize(); if (window.__ready && !(modes && modes.cameraOwned()) && !userMoved) fitView(); }); bro.observe($('bottom'));
let userMoved = false; controls.addEventListener('start', () => { userMoved = true; });

// ---------------------------------------------------------------- shader patches (world position, made tint, cut-away)
const U = {
  box: { value: new THREE.Vector4(B.x0, B.x1, B.z0, B.z1) }, H: { value: B.h }, cam: { value: new THREE.Vector3() },
  maskMin: { value: [0, 1, 2, 3].map(() => new THREE.Vector3(9, 9, 9)) }, maskMax: { value: [0, 1, 2, 3].map(() => new THREE.Vector3(9, 9, 9)) },
  maskOn: { value: 1 }, seenA: { value: 1 }, kP: { value: 0.07 }, kM: { value: 0.07 }, gP: { value: 0 }, gM: { value: 0 }, t: { value: 0 }, overview: { value: 0 },
};
function addWorld(sh) {
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nuniform vec4 uBox; uniform float uH;');
  sh.uniforms.uBox = U.box; sh.uniforms.uH = U.H;
}
const MADE_TINT = `
  { vec3 tint = uTint; float lum = dot(gl_FragColor.rgb, vec3(0.33));
    gl_FragColor.rgb = mix(gl_FragColor.rgb, tint * (0.30 + 0.95 * lum), uK);
    vec3 g = abs(fract(vWPos * 2.5) - 0.5); float ln = max(max(smoothstep(0.455, 0.5, g.x), smoothstep(0.455, 0.5, g.y)), smoothstep(0.455, 0.5, g.z));
    gl_FragColor.rgb += tint * ln * uGrid * 0.22; }`;
const TINT_P = new THREE.Vector3(0.72, 0.60, 1.0), TINT_M = new THREE.Vector3(0.30, 0.86, 0.80);
function madeMat(map, ao, color = 0xffffff, warm = 0, kind = 'made') {
  const m = new THREE.MeshBasicMaterial({ map, color, side: THREE.FrontSide });
  m.onBeforeCompile = (sh) => {
    addWorld(sh); const P = kind === 'patched'; sh.uniforms.uK = P ? U.kP : U.kM; sh.uniforms.uGrid = P ? U.gP : U.gM; sh.uniforms.uTint = { value: P ? TINT_P : TINT_M };
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uK; uniform float uGrid; uniform vec3 uTint;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        ${ao === 0 ? 'float dd = min(min(vWPos.x - uBox.x, uBox.y - vWPos.x), min(vWPos.z - uBox.z, uBox.w - vWPos.z)); diffuseColor.rgb *= 0.62 + 0.38 * smoothstep(0.0, 0.95, dd);' : ''}
        ${ao === 1 ? 'diffuseColor.rgb *= (0.70 + 0.30 * smoothstep(0.0, 0.7, vWPos.y)) * (1.0 - 0.20 * smoothstep(1.85, 2.45, vWPos.y));' : ''}
        ${warm ? 'diffuseColor.rgb *= vec3(1.12, 1.0, 0.86);' : ''}`)
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n' + MADE_TINT);
  };
  return m;
}
// All rules about how the original photo is drawn live here (opts = CONFIG.seen).
function makeSeenMaterial(old, opts, meshName) {
  const m = new THREE.MeshBasicMaterial({ map: old.map, side: THREE.DoubleSide, transparent: true });
  // The anchor writes depth and draws last; the other frame only survives in its holes.
  const anchor = !opts.anchorFrame || !meshName || meshName === opts.anchorFrame; m.depthWrite = anchor; m.userData.anchor = anchor;
  m.onBeforeCompile = (sh) => {
    addWorld(sh);
    Object.assign(sh.uniforms, { uCam: U.cam, uMin: U.maskMin, uMax: U.maskMax, uMaskOn: U.maskOn, uSeenA: U.seenA, uOverview: U.overview, uFrameA: { value: anchor ? 1 : (opts.otherAlpha || 1) } });
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uCam; uniform vec3 uMin[4]; uniform vec3 uMax[4]; uniform float uMaskOn; uniform float uSeenA; uniform float uOverview; uniform float uFrameA;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        float e = min(min(vMapUv.x, 1.0 - vMapUv.x), min(vMapUv.y, 1.0 - vMapUv.y));
        diffuseColor.a *= smoothstep(0.0, 0.07, e) * uSeenA * uFrameA; diffuseColor.rgb *= 0.92;
        vec3 p = vWPos;
        // closed room: nothing seen outside the box (smeared depth) is kept
        if (p.x < uBox.x - 0.10 || p.x > uBox.y + 0.10 || p.z < uBox.z - 0.10 || p.z > uBox.w + 0.10 || p.y > uH + 0.04 || p.y < -0.25) discard;
        // In Overview, dissolve only the alcove depth behind the door planes, not the photographed doors themselves.
        if (uOverview > 0.5 && p.y > 0.06 && p.x < uBox.x + 0.04) {
          float doorZ = min(min(abs(p.z + 2.52), abs(p.z + 0.97)), abs(p.z - 0.67));
          if (doorZ < 0.56) diffuseColor.a *= smoothstep(uBox.x - 0.10, uBox.x + 0.04, p.x);
        }
        // dollhouse cut-away: when the camera is outside a wall, that wall's seen surface steps aside
        if (uCam.x < uBox.x && p.x < uBox.x + 0.30 && p.y > 0.06) discard;
        if (uCam.x > uBox.y && p.x > uBox.y - 0.12 && p.y > 0.06) discard;
        if (uCam.z < uBox.z && p.z < uBox.z + 0.30 && p.y > 0.06) discard;
        if (uCam.z > uBox.w && p.z > uBox.w - 0.35 && p.y > 0.06) discard;
        if (uCam.y > uH && p.y > uH - 0.25) discard;
        if (uMaskOn > 0.5) { for (int i = 0; i < 4; i++) { if (all(greaterThan(p, uMin[i])) && all(lessThan(p, uMax[i]))) discard; } }`)
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n if (gl_FragColor.a < 0.02) discard;');
  };
  return m;
}

// ---------------------------------------------------------------- patch textures: real pixels from the Grok frames, grown by image quilting (see patches/sources.json)
const texLoader = new THREE.TextureLoader();
const TX = {};
function loadTex(name, file) { return new Promise((res) => texLoader.load(file, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; TX[name] = t; res(t); }, undefined, () => res(null))); }
async function loadPatches() {
  await Promise.all([['plaster', 'plaster.jpg'], ['ceiling', 'plaster_ceiling.jpg'], ['floor', 'floor.jpg'], ['trim', 'trim.jpg'], ['redwood', 'redwood.jpg'], ['fabric', 'fabric.jpg'], ['linen', 'linen.jpg'], ['picture', 'picture.jpg'], ['lamp', 'lamp.png']].map((a) => loadTex(a[0], 'patches/' + a[1])));
}
function tex(name, rx = 1, ry = 1, rot = 0) { const t = (TX[name] || new THREE.Texture()).clone(); t.needsUpdate = true; t.repeat.set(rx, ry); t.rotation = rot; t.center.set(0.5, 0.5); return t; }
function ctex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; }
let seed = 7; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const rugTex = () => ctex(256, 256, (x, w, h) => {
  x.fillStyle = '#7d3c2e'; x.fillRect(0, 0, w, h); x.strokeStyle = '#e6d3a6'; x.lineWidth = 6; x.strokeRect(14, 14, w - 28, h - 28); x.lineWidth = 2; x.strokeRect(30, 30, w - 60, h - 60);
  x.fillStyle = '#e6d3a6'; for (let i = 0; i < 5; i++) { x.save(); x.translate(w / 2, h / 2); x.rotate(Math.PI / 4 * i); x.fillRect(-4, -78, 8, 156); x.restore(); }
  for (let i = 0; i < 3000; i++) { x.fillStyle = `rgba(0,0,0,${rnd() * 0.08})`; x.fillRect(rnd() * w, rnd() * h, 2, 2); }
});

// ---------------------------------------------------------------- geometry helpers
function quad(pts, inward, uvf) {
  const [a, b, c, d] = pts.map((p) => new THREE.Vector3(...p));
  const n = new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a));
  const P = n.dot(new THREE.Vector3(...inward)) < 0 ? [a, d, c, b] : [a, b, c, d];
  const pos = [], uv = [];
  for (const i of [0, 1, 2, 0, 2, 3]) { const p = P[i]; pos.push(p.x, p.y, p.z); const u = uvf(p); uv.push(u[0], u[1]); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}
const uvXZ = (s) => (p) => [p.x / s, p.z / s], uvZY = (s) => (p) => [p.z / s, p.y / s], uvXY = (s) => (p) => [p.x / s, p.y / s];
function box(w, h, d, mat, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; }

// groups: patched = "made from pieces the camera did see, placed where it didn't"; made = invented geometry, nothing from the footage
const madeShell = new THREE.Group(); madeShell.name = 'patched-shell';   // Q-0001..Q-0005, Q-0013: floor, ceiling, four walls, trim, window
const patchedProps = new THREE.Group();                                      // Q-0006..Q-0011: nightstands, real lamps, headboard, bedding
const madeProps = new THREE.Group();                                         // M-0004, M-0007: bed skirt, ceiling light (pure made)
const madeRoomG = new THREE.Group(); madeRoomG.visible = false;             // M-0005 / M-0006: the study behind the middle door
const studyP = new THREE.Group(), studyM = new THREE.Group(); madeRoomG.add(studyP, studyM);
const doorP = new THREE.Group(); doorP.visible = false;                      // Q-0012: frame + leaf of the middle door
scene.add(madeShell, patchedProps, madeProps, madeRoomG, doorP);
const mats = {};
const pickables = { man: [], foot: [], doors: [], props: [], shell: [] };
const PM = (map, ao = 2, color = 0xffffff, warm = 0) => madeMat(map, ao, color, warm, 'patched');
const MM = (map, ao = 2, color = 0xffffff, warm = 0) => madeMat(map, ao, color, warm, 'made');
let _glow; function glowTex() { return _glow || (_glow = ctex(64, 64, (x, w, h) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); })); }
function tag(o, id, list) { o.traverse((c) => { c.userData.id = id; }); (list || pickables.props).push(...(o.isMesh || o.isSprite ? [o] : o.children.filter((c) => c.isMesh || c.isSprite))); return o; }

const TEX_USE = {};   // which texture each entity id really uses (checked against patches/sources.json by selfTest)
const use = (id, ...names) => { (TEX_USE[id] = TEX_USE[id] || new Set()); names.forEach((n) => TEX_USE[id].add(n)); };
function buildShell() {
  use('Q-0003', 'floor'); use('Q-0001', 'plaster'); use('Q-0002', 'plaster'); use('Q-0004', 'ceiling');
  mats.floor = PM(tex('floor'), 0); mats.wall = PM(tex('plaster'), 1, 0xffffff, 1); mats.ceil = PM(tex('ceiling'), 0);
  madeShell.userData.veil = [[mats.wall, CONFIG.seen.veil.wall], [mats.ceil, CONFIG.seen.veil.wall], [mats.floor, CONFIG.seen.veil.floor]];
  for (const [m, opacity] of madeShell.userData.veil) { m.transparent = true; m.opacity = opacity; m.depthWrite = false; }
  const add = (g, m, id, extra = {}) => { const me = new THREE.Mesh(g, m); me.userData = Object.assign({ id }, extra); madeShell.add(me); pickables.shell.push(me); return me; };
  const y0 = -0.06, w = 0.03;
  add(quad([[B.x0, y0, B.z1], [B.x1, y0, B.z1], [B.x1, y0, B.z0], [B.x0, y0, B.z0]], [0, 1, 0], uvXZ(1.9)), mats.floor, 'Q-0003', { floor: true });
  add(quad([[B.x0, B.h, B.z1], [B.x1, B.h, B.z1], [B.x1, B.h, B.z0], [B.x0, B.h, B.z0]], [0, -1, 0], uvXZ(2.0)), mats.ceil, 'Q-0004');
  const xw = B.x0 - w, zc = DOORS[1].z, za = zc - DW / 2, zb = zc + DW / 2;
  const wallW = (a0, b0, ya, yb, inward, x) => quad([[x, ya, a0], [x, ya, b0], [x, yb, b0], [x, yb, a0]], inward, uvZY(2.0));
  add(wallW(B.z0, za, 0, B.h, [1, 0, 0], xw), mats.wall, 'Q-0001'); add(wallW(zb, B.z1, 0, B.h, [1, 0, 0], xw), mats.wall, 'Q-0001'); add(wallW(za, zb, DH, B.h, [1, 0, 0], xw), mats.wall, 'Q-0001');
  const plug = new THREE.Mesh(wallW(za, zb, 0, DH, [1, 0, 0], xw - 0.01), new THREE.MeshBasicMaterial({ color: 0x14110c, side: THREE.FrontSide })); plug.name = 'plug'; madeShell.add(plug); madeShell.userData.plug = plug;
  add(quad([[B.x1 + w, 0, B.z0], [B.x1 + w, 0, B.z1], [B.x1 + w, B.h, B.z1], [B.x1 + w, B.h, B.z0]], [-1, 0, 0], uvZY(2.0)), mats.wall, 'Q-0001');
  add(quad([[B.x0, 0, B.z0 - w], [B.x1, 0, B.z0 - w], [B.x1, B.h, B.z0 - w], [B.x0, B.h, B.z0 - w]], [0, 0, 1], uvXY(2.0)), mats.wall, 'Q-0001');
  add(quad([[B.x0, 0, B.z1 + w], [B.x1, 0, B.z1 + w], [B.x1, B.h, B.z1 + w], [B.x0, B.h, B.z1 + w]], [0, 0, -1], uvXY(2.0)), mats.wall, 'Q-0002');   // the unseen wall
  // baseboards: the real dark trim, turned to run along the wall
  const bb = () => PM(tex('trim', 1, 4, Math.PI / 2), 2, 0xffffff);
  const L = [[(B.x0 + B.x1) / 2, 0.07, B.z1 + w - 0.02, B.x1 - B.x0, 0.14, 0.04], [(B.x0 + B.x1) / 2, 0.07, B.z0 - w + 0.02, B.x1 - B.x0, 0.14, 0.04], [B.x0 - w + 0.02, 0.07, (B.z0 + B.z1) / 2, 0.04, 0.14, B.z1 - B.z0], [B.x1 + w - 0.02, 0.07, (B.z0 + B.z1) / 2, 0.04, 0.14, B.z1 - B.z0]];
  const sides = ['z1', 'z0', 'x0', 'x1']; use('Q-0005', 'trim'); L.forEach((a, i) => { const m = box(a[3], a[4], a[5], bb(), a[0], a[1], a[2]); m.userData.id = 'Q-0005'; m.userData.cutSide = sides[i]; madeShell.add(m); });
  // a window on the unseen wall: frame = the real dark trim, glass = the real view out of the real window (a straight crop)
  const wz = B.z1 + w - 0.02, wx = 0.25, ww = 1.0, wh = 1.25, wy = 1.45, fr = bb();
  const winG = new THREE.Group(); winG.userData.cutSide = 'z1'; madeShell.add(winG); use('Q-0013', 'trim', 'picture');
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(ww, wh), PM(tex('picture'), 2, 0xffffff)); glass.rotation.y = Math.PI; glass.position.set(wx, wy, wz); glass.userData.id = 'Q-0013'; winG.add(glass); pickables.shell.push(glass);
  for (const [bw, bh, bx, by] of [[ww + 0.14, 0.07, wx, wy + wh / 2 + 0.035], [ww + 0.14, 0.09, wx, wy - wh / 2 - 0.045], [0.07, wh, wx - ww / 2 - 0.035, wy], [0.07, wh, wx + ww / 2 + 0.035, wy], [0.035, wh, wx, wy], [ww, 0.035, wx, wy]]) { const m = box(bw, bh, 0.06, PM(tex('trim', 1, 1, 0)), bx, by, wz - 0.025); m.userData.id = 'Q-0013'; winG.add(m); }
  // pure made: a ceiling light (nothing in the footage looks like it)
  const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.2, 24), new THREE.MeshBasicMaterial({ color: 0xfff1cf, side: THREE.DoubleSide })); lamp.rotation.x = Math.PI / 2; lamp.position.set(0.3, B.h - 0.01, -1.0); lamp.userData.id = 'M-0007'; lamp.userData.cutSide = 'y1'; madeProps.add(lamp); pickables.props.push(lamp);
}
function buildPatchedProps() {
  const red = () => PM(tex('redwood', 1, 1), 2, 0x9a8274), lampMap = (flip) => { const t = tex('lamp'); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; if (flip) { t.repeat.set(-1, 1); t.offset.set(1, 0); } return t; };
  NS.forEach((n, i) => {
    const g = new THREE.Group(); g.position.set(n.x, 0, n.z);
    g.add(box(0.40, 0.52, 0.50, red(), 0, 0.26, 0)); g.add(box(0.405, 0.035, 0.505, PM(tex('redwood', 2, 2), 2, 0xc2a898), 0, 0.535, 0));
    g.children.forEach((c) => { c.userData.id = n.id; pickables.props.push(c); }); patchedProps.add(g);
    // the real lamp, cut out of the real frame (right one mirrored): a fixed upright plane standing on the nightstand, facing into the room (-x). No extra glow: the cut-out is already lit.
    const lw = 0.8 * 114 / 206 * 1.15, lh = 0.8, pg = new THREE.PlaneGeometry(lw, lh);
    const lm = new THREE.MeshBasicMaterial({ map: lampMap(false), transparent: true, alphaTest: 0.04, side: THREE.DoubleSide });
    if (i === 1) { const uv = pg.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setX(k, 1 - uv.getX(k)); }   // explicit mirrored UVs for the right lamp
    const lp = new THREE.Mesh(pg, lm); lp.rotation.y = -Math.PI / 2; lp.position.set(n.x - 0.02, 0.55 + lh / 2 - 0.02, n.z); lp.userData.id = n.lamp; patchedProps.add(lp); pickables.props.push(lp); use(n.lamp, 'lamp');
    // restrained reconstructed detail on the nightstand (geometry only; the wood pixels are the real swatch)
    for (const [dy, dh] of [[0.37, 0.2], [0.14, 0.2]]) { const d = box(0.02, dh, 0.42, PM(tex('redwood', 1, 1), 2, 0x8f7565), n.x - 0.205, dy, n.z); d.userData.id = n.id; pickables.props.push(d); patchedProps.add(d); }
    for (const [lx, lz] of [[-0.17, -0.21], [-0.17, 0.21], [0.17, -0.21], [0.17, 0.21]]) { const lg = box(0.04, 0.06, 0.04, PM(tex('redwood', 1, 1), 2, 0x8f7565), n.x + lx, -0.01, n.z + lz); lg.userData.id = n.id; patchedProps.add(lg); }
    use(n.id, 'redwood');
  });
  // headboard: cream fabric panel in a red wood frame (both are pieces of the real bed)
  const hb = (w, h, d, m, x, y, z, id) => { const o = box(w, h, d, m, x, y, z); o.userData.id = id; patchedProps.add(o); pickables.props.push(o); return o; };
  use('Q-0011', 'redwood', 'fabric'); use('Q-0010', 'linen');
  hb(0.06, 1.12, 2.2, PM(tex('redwood', 2, 4), 2, 0x84705f), 1.985, 0.56, -1.12, 'Q-0011'); hb(0.04, 0.86, 1.94, PM(tex('fabric', 2, 1.2), 2), 1.945, 0.62, -1.12, 'Q-0011');
  // bedding: mattress end + two pillows from the real linen
  hb(0.42, 0.46, 2.0, PM(tex('linen', 2, 2), 2), 1.74, 0.23, -1.12, 'Q-0010');
  for (const z of [-0.55, -1.7]) { const p = hb(0.5, 0.13, 0.62, PM(tex('linen', 1, 1), 2), 1.66, 0.55, z, 'Q-0010'); p.rotation.y = z > -1 ? 0.12 : -0.1; }
}
function buildMadeProps() {
  const dark = MM(null, 2, 0x2b211b);
  for (const [w, h, d, x, y, z] of [[0.14, 0.30, 2.0, -0.68, 0.15, -1.0], [2.5, 0.30, 0.10, 0.62, 0.15, 0.04], [2.5, 0.30, 0.10, 0.62, 0.15, -2.03]]) { const sk = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), dark); sk.position.set(x, y, z); sk.userData.id = 'M-0004'; madeProps.add(sk); pickables.props.push(sk); }
}

function buildStudy() {
  const R = MADE_ROOM, h = B.h - 0.1, y0 = -0.06;
  use('M-0005', 'floor', 'plaster', 'ceiling', 'picture', 'trim');
  const floorM = PM(tex('floor'), 0, 0xffffff, 1), wallM = PM(tex('plaster'), 1, 0xffffff, 1), ceilM = PM(tex('ceiling'), 0, 0xffffff, 1);
  const add = (g, m) => { const me = new THREE.Mesh(g, m); me.userData.id = 'M-0005'; studyP.add(me); pickables.shell.push(me); return me; };
  add(quad([[R.x0, y0, R.z1], [R.x1, y0, R.z1], [R.x1, y0, R.z0], [R.x0, y0, R.z0]], [0, 1, 0], uvXZ(1.9)), floorM);
  add(quad([[R.x0, h, R.z1], [R.x1, h, R.z1], [R.x1, h, R.z0], [R.x0, h, R.z0]], [0, -1, 0], uvXZ(2.0)), ceilM);
  add(quad([[R.x0, 0, R.z0], [R.x0, 0, R.z1], [R.x0, h, R.z1], [R.x0, h, R.z0]], [1, 0, 0], uvZY(2.0)), wallM);
  add(quad([[R.x0, 0, R.z0], [R.x1, 0, R.z0], [R.x1, h, R.z0], [R.x0, h, R.z0]], [0, 0, 1], uvXY(2.0)), wallM);
  add(quad([[R.x0, 0, R.z1], [R.x1, 0, R.z1], [R.x1, h, R.z1], [R.x0, h, R.z1]], [0, 0, -1], uvXY(2.0)), wallM);
  const xw = B.x0 - 0.035 - 0.012, zc = DOORS[1].z, za = zc - DW / 2, zb = zc + DW / 2;
  const wp = (a, b, ya, yb) => quad([[xw, ya, a], [xw, ya, b], [xw, yb, b], [xw, yb, a]], [-1, 0, 0], uvZY(2.0));
  add(wp(R.z0, za, 0, h), wallM); add(wp(zb, R.z1, 0, h), wallM); add(wp(za, zb, DH, h), wallM);
  // window on the west wall: real trim frame, real view
  const wg = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.2), PM(tex('picture'), 2, 0xffffff, 1)); wg.rotation.y = Math.PI / 2; wg.position.set(R.x0 + 0.02, 1.35, -0.97); wg.userData.id = 'M-0005'; studyP.add(wg); pickables.shell.push(wg);
  for (const [bw, bh, bd, by, bz] of [[0.05, 0.06, 1.05, 1.98, -0.97], [0.05, 0.08, 1.05, 0.72, -0.97], [0.05, 1.2, 0.06, 1.35, -0.97 - 0.5], [0.05, 1.2, 0.06, 1.35, -0.97 + 0.5], [0.05, 1.2, 0.03, 1.35, -0.97], [0.05, 0.03, 0.95, 1.35, -0.97]]) { const m = box(bw, bh, bd, PM(tex('trim')), R.x0 + 0.04, by, bz); m.userData.id = 'M-0005'; studyP.add(m); }
  // furniture is MADE: nothing of it was ever filmed (M-0006)
  const wood = MM(null, 2, 0x5a3720, 1), mk = (o) => { o.userData.id = 'M-0006'; studyM.add(o); pickables.shell.push(o); return o; };
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.2), MM(rugTex(), 2, 0xffffff, 1)); rug.rotation.x = -Math.PI / 2; rug.rotation.z = Math.PI / 2; rug.position.set(-2.85, 0.005, -0.97); rug.material.side = THREE.DoubleSide; mk(rug);
  mk(box(0.55, 0.04, 1.3, wood, -3.98, 0.74, -0.97)); [[-0.35], [0.35]].forEach(([dz]) => mk(box(0.5, 0.74, 0.05, wood, -3.98, 0.37, -0.97 + dz * 1.55)));
  // the computer on the desk
  const blk = MM(null, 2, 0x16181c);
  mk(box(0.20, 0.02, 0.36, MM(null, 2, 0x2a2d33), -3.78, 0.77, -0.97)); mk(box(0.16, 0.02, 0.16, blk, -4.02, 0.77, -0.97)); mk(box(0.04, 0.12, 0.05, blk, -4.02, 0.83, -0.97)); mk(box(0.04, 0.34, 0.56, blk, -4.04, 1.0, -0.97));
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.3), new THREE.MeshBasicMaterial({ color: 0x8fd6ff })); scr.rotation.y = Math.PI / 2; scr.position.set(-4.015, 1.0, -0.97); mk(scr);
  const chairM = MM(null, 2, 0x3b2c22, 1); mk(box(0.42, 0.05, 0.42, chairM, -3.35, 0.46, -0.97)); mk(box(0.05, 0.5, 0.42, chairM, -3.15, 0.72, -0.97)); [[-0.17, -0.17], [-0.17, 0.17], [0.17, -0.17], [0.17, 0.17]].forEach(([a, b]) => mk(box(0.04, 0.44, 0.04, wood, -3.35 + a, 0.22, -0.97 + b)));
  const shelf = mk(box(0.3, 1.7, 1.1, wood, -2.9, 0.85, R.z0 + 0.16)); shelf.scale.set(3.4, 1, 0.5);
  const cols = [0xb9473a, 0x3d6a8a, 0xd0a64a, 0x587a4f, 0x8e5b8f, 0xdcd2b8];
  for (let r = 0; r < 4; r++) for (let i = 0; i < 12; i++) { const bk = box(0.07, 0.28, 0.22, MM(null, 2, cols[(i * 5 + r * 3) % 6], 1), -3.55 + i * 0.1, 0.25 + r * 0.38, R.z0 + 0.17); bk.userData.id = 'M-0006'; studyM.add(bk); }
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.22, 18, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe2a8, side: THREE.DoubleSide })); lamp.position.set(-4.0, 0.98, -0.45); lamp.userData.id = 'M-0006'; studyM.add(lamp);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xffd48a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.95 })); glow.scale.setScalar(1.5); glow.position.set(-4.0, 0.98, -0.45); studyM.add(glow);
  madeRoomG.userData.label = new THREE.Vector3(-2.9, 1.9, -0.97);
}

// ---------------------------------------------------------------- doors (faded + locked, v1 look) and the one that can open
const doorMeshes = [], doorGroups = {};
function lockSprite() {
  const t = ctex(64, 64, (x) => { x.strokeStyle = '#f0c36b'; x.fillStyle = '#f0c36b'; x.lineWidth = 5; x.globalAlpha = 0.9; x.beginPath(); x.arc(32, 26, 11, Math.PI, 0); x.stroke(); x.fillRect(18, 28, 28, 22); });
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, opacity: 0.8 }));
}
function makeDoor(d) {
  const a = new THREE.Vector3(DX + 0.012, 0, d.z - DW / 2), b = new THREE.Vector3(DX + 0.012, 0, d.z + DW / 2), up = new THREE.Vector3(0, DH, 0);
  const P = [a, b, b.clone().add(up), a.clone().add(up)];
  const g = new THREE.BufferGeometry(); g.setFromPoints([P[0], P[1], P[2], P[0], P[2], P[3]]); g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 2));
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { t: { value: 0 }, k: { value: 0 }, fade: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec2 vUv; uniform float t; uniform float k; uniform float fade;
      void main(){ float edge = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y)); float band = 0.5 + 0.5 * sin(vUv.y * 9.0 - t * 1.4 + vUv.x * 2.0);
        float a = 0.30 + 0.20 * band + 0.30 * k; a *= smoothstep(0.0, 0.16, edge) * 0.85 + 0.15; gl_FragColor = vec4(mix(vec3(0.96,0.88,0.70), vec3(1.0,0.95,0.80), band), a * fade); }` });
  const mesh = new THREE.Mesh(g, mat); mesh.userData.id = d.id; mesh.renderOrder = 5;
  const spr = lockSprite(); spr.position.copy(a.clone().add(b).multiplyScalar(0.5)).add(new THREE.Vector3(0.02, DH * 0.52, 0)); spr.scale.setScalar(0.34); spr.renderOrder = 6;
  const ol = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(P), new THREE.LineBasicMaterial({ color: 0xf0c36b, transparent: true, opacity: 0.55 }));
  const grp = new THREE.Group(); grp.add(mesh, spr, ol); scene.add(grp); doorMeshes.push(mesh); pickables.doors.push(mesh); doorGroups[d.id] = { mesh, spr, ol, grp };
}
let leaf = null;
function buildRealDoor() {
  const zc = DOORS[1].z, trimM = () => PM(tex('trim', 1, 1), 2), hinge = zc + DW / 2 - 0.02, g = doorP;
  const part = (o, id) => { o.userData.id = id; o.userData.interactionTarget = 'D-0002'; pickables.doors.push(o); return o; };
  g.add(part(box(0.1, DH + 0.08, 0.07, trimM(), DX - 0.01, (DH + 0.08) / 2, zc - DW / 2 - 0.03), 'Q-0012')); g.add(part(box(0.1, DH + 0.08, 0.07, trimM(), DX - 0.01, (DH + 0.08) / 2, zc + DW / 2 + 0.03), 'Q-0012')); g.add(part(box(0.1, 0.08, DW + 0.14, trimM(), DX - 0.01, DH + 0.04, zc), 'Q-0012'));
  const pivot = new THREE.Group(); pivot.position.set(DX - 0.02, 0, hinge); g.add(pivot);
  const slab = box(0.045, DH - 0.02, DW - 0.04, PM(tex('redwood', 1, 2), 2, 0x9a7a66), 0, (DH - 0.02) / 2, -(DW - 0.04) / 2); slab.userData.id = 'Q-0012'; slab.userData.interactionTarget = 'D-0002'; pivot.add(slab); pickables.doors.push(slab);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 10), new THREE.MeshBasicMaterial({ color: 0xd9b45a })); knob.position.set(0.04, 1.0, -DW + 0.14); knob.userData.id = 'M-0008'; knob.userData.interactionTarget = 'D-0002'; const knobG = new THREE.Group(); knobG.userData.basisGroup = 'made'; knobG.add(knob); pivot.add(knobG); pickables.doors.push(knob); use('Q-0012', 'trim', 'redwood');
  leaf = { g, pivot, knobG };
}

// ---------------------------------------------------------------- history + state
const hist = new History();
const sim = {
  t: 0, x: L, z: 1.05, yaw: Math.PI, cyc: 0, ww: 0, tasks: [], cur: null, idleT: 0, nStep: 0, lastStepT: -9, lastPass: {}, sched: [],
  inMade: false, unlockT: null, openT: null, visitDone: 0, vel: [0, 0, 0], reactEv: null, speed: 0.763, lastSoundN: 0, music: false,
};
const view = { t: 0, live: true, playing: true };
const state = { sound: false, follow: false, trail: true, mode: 'explore', seg: 'all', sel: null };
const listeners = [];       // modes subscribe to events
function emit(o) { const ev = hist.emit(o); for (const f of listeners) f(ev); return ev; }
let SRCS = { entities: {}, textures: {}, frames: {} };
function defineEntities() {
  const E = (id, o) => hist.entity(id, o);
  E('P-0001', { kind: 'person', label: 'the man', basis: 'rebuilt', note: 'AI-generated person (not real). Body: Grok Imagine + Hunyuan3D. Walk: rebuilt from a tracked video. Route: scripted by us.' });
  DOORS.forEach((d) => E(d.id, { kind: 'door', label: d.name, basis: 'seen', note: 'The doorway is in the footage; what is behind it never was.' }));
  E('O-0001', { kind: 'object', label: 'the bed', basis: 'seen' }); E('O-0002', { kind: 'object', label: 'the window wall', basis: 'seen' }); E('O-0003', { kind: 'floor', label: 'the floor (seen part)', basis: 'seen' });
  // PATCHED: made from pieces the camera did see, placed where it did not. Each one carries its source frame + pixel rectangle.
  for (const [id, e] of Object.entries(SRCS.entities)) {
    const pieces = e.textures.map((n) => SRCS.textures[n]).filter(Boolean).flatMap((t) => t.frames.map((f) => ({ texture: t.label, texture_file: t.file, frame: f.frame, rect: f.rect, method: t.method })));
    E(id, { kind: id[0] === 'Q' ? 'patched' : 'room', label: e.label, basis: 'patched', source: { rule: 'PATCHED = made from pieces the camera did see, placed where it did not', pieces, mirrored: id === 'Q-0009' } });
  }
  E('M-0004', { kind: 'made', label: 'bed skirt (dark boxes)', basis: 'made', note: 'Plain geometry that hides the torn edge where the footage stopped. No pixels from the footage.' });
  E('M-0006', { kind: 'made', label: 'study furniture: desk, computer, chair, shelf, rug', basis: 'made', note: 'Invented. Nothing like it was ever filmed.' });
  E('M-0007', { kind: 'made', label: 'ceiling light', basis: 'made', note: 'Invented.' });
  E('C-0001', { kind: 'viewer', label: 'you (the viewer)', basis: 'made', note: 'Input from the person using the page. Not in the footage; every action of yours is recorded with origin viewer-input.' });
  E('M-0008', { kind: 'made', label: 'door knob (invented brass sphere)', basis: 'made', note: 'Invented. Nothing in the footage shows a knob.' });
  E('T-0001', { kind: 'tool', label: 'script trigger (HB API)', basis: 'made', note: 'An unlock requested by code, not by a tap.' });
  for (const id of ['O-0001', 'O-0002', 'O-0003']) hist.emit({ t: 0, id, e: 'seen', basis: 'seen', note: 'in the Grok room footage' });
  for (const id of Object.keys(SRCS.entities)) if (id[0] === 'Q') hist.emit({ t: 0, id, e: 'patched', parent: 'tool:quilt', basis: 'patched', note: 'cut from the real frames and placed where nobody filmed' });
  for (const id of ['M-0004', 'M-0007']) hist.emit({ t: 0, id, e: 'built', parent: 'tool:bedroom-sonnet-v3', basis: 'made', note: hist.entities.get(id).note });
}

// ---------------------------------------------------------------- audio (muted until a tap)
let sfx = null;
async function soundOn() { if (!sfx) { sfx = Sfx.live(); if (!sfx) return false; } await sfx.unlock(); if (!sfx.tone) sfx.tone = sfx.roomTone(sfx.now, 60 * 60 * 3, 1); state.sound = true; return true; }
function soundOff() { state.sound = false; try { sfx && sfx.ctx.suspend(); } catch (e) {} }
function playSnd(snd, delay = 0) { if (state.sound && sfx) { try { sfx.play(snd, sfx.now + delay); } catch (e) {} } }
let sndList = [], sndIdx = 0, lastAudioT = 0;
// sounds must be played oldest-first: collect then play in order
function pumpAudioOrdered(t0, t1) {
  if (!state.sound || t1 <= t0 || t1 - t0 > 0.6) return;
  const arr = []; for (let i = sndList.length - 1; i >= 0; i--) { const ev = sndList[i]; if (ev.t <= t0) break; if (ev.t <= t1) arr.push(ev); }
  arr.reverse().forEach((ev) => playSnd(ev.snd, 0));
}
// sound(t, _, actor, snd, p, causeEv, sid): causeEv = the EVENT that made this sound; sid = a pre-reserved S-id (plantStep reserves the contact sound before listeners run)
function sound(t, id, parent, snd, p, causeEv, sid) {
  sid = sid || hist.nextId('S'); hist.entity(sid, { kind: 'sound', label: 'sound ' + sid + ' (' + snd.k + ')', basis: 'made' });
  const ev = emit({ t, id: sid, e: 'sounded', parent, cause: causeEv && causeEv.eid, snd, p, basis: 'made' }); sndList.push(ev);
  if (causeEv) hist.addChild(causeEv, sid);
  return sid;
}

// ---------------------------------------------------------------- the man
let person, mixer, walkA, idleA, gait = { pL: 0.0, pR: 0.5, offL: [0.1, 0.1], offR: [-0.1, 0.1], yOff: 0, ok: false };
const gl = new GLTFLoader(); const loadGLB = (u) => new Promise((res, rej) => gl.load(u, res, undefined, rej));
function analyzeGait() {
  const fl = person.getObjectByName('FootL'), fr = person.getObjectByName('FootR'); const N = 48; const yl = [], yr = [], pl = [], pr = [];
  const skin = []; person.traverse((o) => { if (o.isSkinnedMesh) skin.push(o); });
  walkA.setEffectiveWeight(1); idleA.setEffectiveWeight(0); person.position.set(0, 0, 0); person.rotation.set(0, 0, 0); let minV = 9; const v = new THREE.Vector3(), w = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    walkA.time = (i / N) * walkA.getClip().duration; mixer.update(0); person.updateMatrixWorld(true);
    fl.getWorldPosition(w); yl.push(w.y); pl.push([w.x, w.z]); fr.getWorldPosition(w); yr.push(w.y); pr.push([w.x, w.z]);
    for (const s of skin) { const n = s.geometry.attributes.position.count; for (let k = 0; k < n; k += 9) { s.getVertexPosition(k, v).applyMatrix4(s.matrixWorld); if (v.y < minV) minV = v.y; } }
  }
  const arg = (a) => a.indexOf(Math.min(...a));
  const iL = arg(yl), iR = arg(yr);
  const iR2 = (iL + N / 2) % N;   // the clip is a plain two-step cycle: right foot lands half a cycle after left
  const sl = (arr, i) => { const a = arr[(i + N - 2) % N], b = arr[(i + 2) % N]; const dz = b[1] - a[1]; return Math.abs(dz + 4 / N * 0.84) * 100; };   // planted foot should move back by the root's travel (4/48 cycle = 7 cm)
  gait = { pL: iL / N, pR: iR2 / N, offL: pl[iL], offR: pr[iR2], yOff: -minV, ok: true, rawR: iR / N, slide_cm: [sl(pl, iL), sl(pr, iR2)], sole_min_y_rest: minV };
  walkA.time = 0; mixer.update(0);
}
function setPose(x, z, yaw, cyc, ww, idleT) {
  person.position.set(x, gait.yOff, z); person.rotation.y = yaw;
  walkA.setEffectiveWeight(ww); idleA.setEffectiveWeight(1 - ww);
  walkA.time = (((cyc % 1) + 1) % 1) * walkA.getClip().duration; idleA.time = idleT % idleA.getClip().duration; mixer.update(0);
}

// --- tasks: the man's script (made by us). He reacts to the viewer: the unlock click brings him back to the door.
const go = (x, z, o = {}) => Object.assign({ type: 'go', to: [x, z] }, o);
const wait = (s, fx, fz, note, o = {}) => Object.assign({ type: 'wait', dur: s, face: [fx, fz], note }, o);
const doNow = (fn) => ({ type: 'do', fn });
const doorOpen = () => sim.openT != null && sim.t - sim.openT > 1.5;
function visitTasks(reason) {
  const zc = DOORS[1].z;
  return [doNow(() => { if (reason) sim.reactEv = emit({ t: sim.t, id: 'P-0001', e: 'paused', p: [sim.x, 0, sim.z], parent: 'P-0001', cause: sim.reactCause, origin: 'script', basis: 'made', note: reason }); }),
    go(L, zc, { r: 0.12 }), wait(0.5, DX, zc), go(DX + 0.1, zc, { r: 0.1, sp: 0.8 }),
    doNow(() => { sim.enteredEv = emit({ t: sim.t, id: 'P-0001', e: 'entered', target: 'M-0005', p: [sim.x, 0, sim.z], parent: 'P-0001', cause: sim.reactEv ? sim.reactEv.eid : sim.reactCause, origin: 'script', basis: 'made', note: 'Into a room that was never filmed: patched surfaces, made furniture.' }); }),
    go(-2.7, zc, { r: 0.12, sp: 0.8 }), wait(3.2, -4.0, zc - 0.2, 'He looks at the desk in the made room.'),
    go(-1.7, zc, { r: 0.15 }), doNow(() => emit({ t: sim.t, id: 'P-0001', e: 'left', target: 'M-0005', p: [sim.x, 0, sim.z], parent: 'P-0001', cause: sim.enteredEv && sim.enteredEv.eid, origin: 'script', basis: 'made' })), go(L, zc, { r: 0.12 })];
}
function loopTasks() {
  const zc = DOORS[1].z, T = [];
  T.push(go(L, 0.45));
  if (doorOpen()) T.push(...visitTasks('')); else T.push(go(L, zc, { r: 0.1 }), wait(1.6, DX, zc, 'He tries the middle door.', { onStart: () => { const id = 'D-0002'; const td = emit({ t: sim.t, id: 'P-0001', e: 'tried_door', target: id, p: [sim.x, 0, sim.z], parent: 'P-0001', origin: 'script', basis: 'made', note: 'Locked. ' }); sound(sim.t, 'S', id, { k: 'locked', pan: -0.4 }, null, td); } }));
  T.push(go(L, -2.5), go(-0.35, -2.8), go(1.0, -2.8), wait(2.2, 1.0, -3.8, 'He looks out of the window.'), go(-0.3, -2.8), go(L, -2.45), go(L, 0.45), go(0.5, 0.95), go(1.05, 0.95), wait(1.8, 1.8, 0.4, 'He glances at the left nightstand (made).'), go(L, 0.95));
  return T;
}
function nextTask() {
  if (!sim.tasks.length) sim.tasks = loopTasks();
  sim.cur = sim.tasks.shift(); sim.curT = 0; sim.started = false;
  while (sim.cur && sim.cur.type === 'do') { sim.cur.fn(); sim.cur = sim.tasks.length ? sim.tasks.shift() : null; }
  if (!sim.cur) nextTask();
}
const angDiff = (a, b) => { let d = a - b; return Math.atan2(Math.sin(d), Math.cos(d)); };
function doorFrac(t) { return sim.openT == null ? 0 : Math.min(1, Math.max(0, (t - sim.openT) / 1.4)); }

function simStep(dt) {
  const t0 = sim.t; sim.t += dt;
  // scheduled future events (creak, hats, ...)
  if (sim.sched.length) { const keep = []; for (const s of sim.sched) { if (s.at <= sim.t) s.fn(s.at); else keep.push(s); } sim.sched = keep; }
  if (!sim.cur) nextTask();
  const c = sim.cur; let moved = 0, moving = false; if (c.type !== 'go') sim.vel = [0, 0, 0];
  if (!c.started) { c.started = true; if (c.onStart) c.onStart(); }
  if (c.type === 'go') {
    const dx = c.to[0] - sim.x, dz = c.to[1] - sim.z, d = Math.hypot(dx, dz), want = Math.atan2(dx, dz), diff = angDiff(want, sim.yaw);
    const rate = 3.4; sim.yaw += Math.max(-rate * dt, Math.min(rate * dt, diff));
    const f = Math.abs(diff) > 1.0 ? 0 : Math.max(0.4, 1 - Math.abs(diff) / 1.4);
    const sp = sim.speed * (c.sp || 1) * f, step = Math.min(d, sp * dt);
    const px = sim.x, pz = sim.z; sim.x += Math.sin(sim.yaw) * step; sim.z += Math.cos(sim.yaw) * step; moved = step; moving = step > 1e-5; sim.vel = [(sim.x - px) / dt, 0, (sim.z - pz) / dt];
    const nxt = sim.tasks[0]; const r = c.r || (nxt && nxt.type === 'go' ? 0.24 : 0.07);
    if (d < r) sim.cur = null;
  } else if (c.type === 'wait') {
    c.t = (c.t || 0) + dt; const want = Math.atan2(c.face[0] - sim.x, c.face[1] - sim.z); sim.yaw += Math.max(-2.6 * dt, Math.min(2.6 * dt, angDiff(want, sim.yaw)));
    if (!c.said && c.note) { c.said = true; emit({ t: sim.t, id: 'P-0001', e: 'paused', p: [sim.x, 0, sim.z], basis: 'made', place: placeOf(sim.x, sim.z), note: c.note }); }
    if (c.t >= c.dur && Math.abs(angDiff(want, sim.yaw)) < 0.5) sim.cur = null;
  }
  // gait: distance drives the cycle so feet do not skate
  const prevCyc = sim.cyc; sim.cyc += moved / 0.84;
  sim.ww += ((moving ? 1 : 0) - sim.ww) * Math.min(1, dt * 7);
  sim.idleT += dt;
  if (moving && gait.ok && sim.ww > 0.55) {
    for (const [ph, off, foot] of [[gait.pL, gait.offL, 'L'], [gait.pR, gait.offR, 'R']]) {
      if (Math.floor(sim.cyc - ph) > Math.floor(prevCyc - ph)) {
        const cs = Math.cos(sim.yaw), sn = Math.sin(sim.yaw), fx = sim.x + off[0] * cs + off[1] * sn, fz = sim.z - off[0] * sn + off[1] * cs;
        plantStep(sim.t, fx, fz, foot);
      }
    }
  }
  // passing doors
  if (moving && sim.x > DX + 0.1) for (const d of DOORS) if (Math.abs(sim.z - d.z) < 0.1 && sim.t - (sim.lastPass[d.id] || -9) > 4) { sim.lastPass[d.id] = sim.t; { const wp = emit({ t: sim.t, id: 'P-0001', e: 'walked_past', target: d.id, p: [sim.x, 0, sim.z], v: sim.vel.slice(), parent: 'P-0001', origin: 'script', basis: 'made', note: '' }); sound(sim.t, 'S', d.id, { k: 'tick', g: 0.5 }, null, wp); } }
  hist.sample(sim.t, sim.x, sim.z, sim.yaw, sim.cyc, sim.ww);
  if (hist.samples.length > 80000) hist.samples.splice(0, 8000);
}
function plantStep(t, x, z, foot) {
  const n = ++sim.nStep, id = hist.nextId('F'), place = placeOf(x, z), v = sim.vel.slice();
  hist.entity(id, { kind: 'footstep', label: `footstep ${n} (${foot === 'L' ? 'left' : 'right'})`, basis: 'made' });
  const target = place === 'seen-floor' ? 'O-0003' : place === 'patched-room' ? 'M-0005' : 'Q-0003';
  const sid = hist.nextId('S');   // reserve the contact sound id BEFORE any listener (Music) can create sounds
  sim.stepInfo = { foot, n, gap: t - sim.lastStepT, x, z }; sim.lastStepT = t;
  const ev = emit({ t, id, e: 'planted', parent: 'P-0001', origin: 'script', target, p: [x, 0, z], v, place, children: [sid], basis: 'made', floor_basis: place === 'seen-floor' ? 'seen' : 'patched', note: `${foot === 'L' ? 'left' : 'right'} foot, step ${n}` });
  sound(t, id, id, { k: 'step', foot, place, pan: Math.max(-1, Math.min(1, (z + 1) / 3.5)), g: sim.music ? 0.45 : 1 }, [x, 0, z], ev, sid);
}

// ---------------------------------------------------------------- viewer actions
function unlockMiddleDoor(tapEid) {
  const t = sim.t, id = 'D-0002';
  if (sim.unlockT != null) return false;
  sim.unlockT = t;
  // a script-triggered unlock (no tap) gets its own explicit made trigger event; it is never attributed to an unrelated tap
  let causeEid = tapEid;
  if (!causeEid) causeEid = emit({ t, id: 'T-0001', e: 'triggered', parent: 'tool:hb-api', origin: 'script', basis: 'made', target: id, note: 'Unlock requested by code (HB.unlockMiddleDoor), not by a tap.' }).eid;
  const un = emit({ t, id, e: 'unlocked', parent: 'C-0001', cause: causeEid, origin: tapEid ? 'viewer-input' : 'script', basis: 'made', note: 'The latch clicks. Nothing behind this door was ever filmed, so what opens is not footage.' });
  sound(t, id, 'C-0001', { k: 'chime', g: 1, pan: -0.3 }, null, un);
  sim.reactCause = un.eid;
  sim.sched.push({ at: t + 0.5, fn: (at) => {
    sim.openT = at; const op = emit({ t: at, id, e: 'opened', parent: 'C-0001', cause: un.eid, children: ['M-0005', 'M-0006'], basis: 'made' });
    sound(at, id, 'C-0001', { k: 'creak', dur: 1.5, pan: -0.5 }, null, op);
    emit({ t: at, id: 'M-0005', e: 'built', parent: id, cause: op.eid, basis: 'patched', note: 'A small study: walls, floor and ceiling patched from the real room textures.' }); emit({ t: at, id: 'M-0006', e: 'built', parent: id, cause: op.eid, basis: 'made', note: 'Desk, computer, chair, shelf and rug: invented.' });
    if (viewName === 'overview') fitView();
  } });
  sim.sched.push({ at: t + 1.9, fn: (at) => {   // he heard the click: come back and go in
    sim.tasks = visitTasks('He heard the latch click and turned back to the middle door.'); sim.cur = null;
  } });
  return true;
}
function viewerTap(id, p, note) { const t = sim.t; const ev = emit({ t, id: 'C-0001', e: 'tapped', target: id, p, basis: 'made', origin: 'viewer-input', note: note || '' }); return ev; }

// ---------------------------------------------------------------- view state (a pure function of history + time)
const stepEvents = []; // planted events (in order)
listeners.push((ev) => { if (ev.e === 'planted') stepEvents.push(ev); });
const pool = []; let ring;
function buildFootPool() {
  const geo = new THREE.CircleGeometry(0.075, 14); geo.scale(0.62, 1, 1); geo.rotateX(-Math.PI / 2);
  for (let i = 0; i < 44; i++) { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xf0c36b, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })); m.position.y = 0.012; m.visible = false; m.renderOrder = 3; scene.add(m); pool.push(m); pickables.foot.push(m); }
  ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.34, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xf0c36b, transparent: true, opacity: 0.0, depthWrite: false })); ring.position.y = 0.02; ring.renderOrder = 4; scene.add(ring);
}
const trailGeo = new THREE.BufferGeometry(); const TRAIL_N = 400; trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_N * 3), 3)); trailGeo.setDrawRange(0, 0);
const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: 0xf0c36b, transparent: true, opacity: 0.55, depthWrite: false })); trail.frustumCulled = false; trail.renderOrder = 3;
const markers = []; let markGeo;
function buildMarkers() { markGeo = new THREE.RingGeometry(0.06, 0.095, 20).rotateX(-Math.PI / 2); for (let i = 0; i < 40; i++) { const m = new THREE.Mesh(markGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false })); m.visible = false; m.position.y = 0.03; m.renderOrder = 4; scene.add(m); markers.push(m); } }
const proxy = { man: null };
const evColor = { walked_past: 0xf0c36b, tried_door: 0xe9a24b, tapped: 0xffffff, unlocked: 0x5fd6c6, opened: 0x5fd6c6, entered: 0x5fd6c6, left: 0xaaaaaa, paused: 0xc9b99a, planted: 0xf0c36b, built: 0x5fd6c6 };

function applyView() {
  const t = view.t, s = hist.trackAt(t); if (!s || !person) return;
  setPose(s[1], s[2], s[3], s[4], s[5], t);
  proxy.man.position.set(s[1], 0.9, s[2]);
  // doors
  const unT = sim.unlockT, opT = sim.openT, unlocked = unT != null && t >= unT, opened = opT != null && t >= opT;
  const fade = unlocked ? Math.max(0, 1 - (t - unT) / 0.5) : 1;
  const g = doorGroups['D-0002']; g.mesh.material.uniforms.fade.value = fade; g.spr.material.opacity = 0.8 * fade; g.ol.material.opacity = 0.55 * fade; g.mesh.visible = fade > 0.01; g.spr.visible = fade > 0.01; g.ol.visible = fade > 0.01;
   const fr = opened ? Math.min(1, (t - opT) / 1.4) : 0; const e = fr * fr * (3 - 2 * fr); leaf.pivot.rotation.y = e * 1.85 + Math.sin(fr * 18) * 0.02 * (1 - fr) * (fr > 0 ? 1 : 0);
  applySegVis(unlocked, opened); applyCutaway(); madeShell.userData.plug.visible = !unlocked;
  U.maskMin.value[0].set(1.1, 0.12, -0.3); U.maskMax.value[0].set(2.3, 1.7, 1.0); U.maskMin.value[1].set(1.1, 0.12, -3.1); U.maskMax.value[1].set(2.3, 1.7, -2.1);
  U.maskMin.value[3].set(1.52, -0.05, -2.25); U.maskMax.value[3].set(2.4, 1.05, -0.25);
  U.maskMin.value[2].set(-1.95, -0.1, DOORS[1].z - DW / 2 - 0.02); U.maskMax.value[2].set(-1.0, DH + 0.05, DOORS[1].z + DW / 2 + 0.02);
  if (!opened) { U.maskMin.value[2].set(9, 9, 9); U.maskMax.value[2].set(9, 9, 9); }
  // footprints: the last few seconds of this man's steps, ageing out
  let hi = stepEvents.length; { let lo = 0, h = stepEvents.length; while (lo < h) { const m = (lo + h) >> 1; if (stepEvents[m].t <= t) lo = m + 1; else h = m; } hi = lo; }
  let pi = 0;
  for (let i = hi - 1; i >= 0 && pi < pool.length; i--) {
    const ev = stepEvents[i], age = t - ev.t; if (age > 22) break;
    const m = pool[pi++]; m.visible = true; m.userData.id = ev.id; m.userData.ev = ev;
    m.material.color.setHex(0x5fd6c6);
    const pulse = Math.max(0, 1 - age / 0.4); m.material.opacity = Math.max(0.0, 0.62 * (1 - age / 22)) + pulse * 0.35;
    m.position.set(ev.p[0], 0.012, ev.p[2]); m.rotation.y = Math.atan2(ev.v[0], ev.v[2]); m.scale.setScalar(1 + pulse * 0.9);
  }
  for (; pi < pool.length; pi++) pool[pi].visible = false;
  if (state.seg === 'seen') { for (const m of pool) m.visible = false; for (const m of markers) m.visible = false; }
  // trail
  const arr = trailGeo.attributes.position.array; let n = 0; const sm = hist.samples;
  if (state.trail && sm.length) { let hiS = Math.min(sm.length - 1, Math.floor(t * 30 + 0.5)); if (sm[hiS] && sm[hiS][0] > t + 0.1) { hiS = Math.max(0, hiS - 1); } for (let i = hiS; i >= 0 && n < TRAIL_N; i -= 3) { const q = sm[i]; if (!q || t - q[0] > 16) break; arr[n * 3] = q[1]; arr[n * 3 + 1] = 0.02; arr[n * 3 + 2] = q[2]; n++; } }
  trailGeo.setDrawRange(0, n); trailGeo.attributes.position.needsUpdate = true; trail.material.color.setHex(0x5fd6c6);
  // selection ring
  if (state.sel === 'P-0001') { ring.material.opacity = 0.85; ring.position.set(s[1], 0.025, s[2]); ring.scale.setScalar(1 + 0.08 * Math.sin(performance.now() / 220)); } else ring.material.opacity = 0;
  // sound for this view step
  pumpAudioOrdered(lastAudioT, t); lastAudioT = t;
}

// ---------------------------------------------------------------- selection + history sheet (Necklace style)
const sheet = $('sheet');
function esc(s) { return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
function whyText(step) {
  const ev = step.eid ? hist.byEid(step.eid) : null;
  if (!ev) return step.e === 'viewer-input' ? 'Your tap: input from you, not from the footage.' : step.e === 'tool' ? 'Our bedroom tools built this from the recorded evidence.' : step.e === 'actor' ? 'He is an actor with a scripted route, not a cause: no earlier recorded event made this happen.' : 'This is where the recorded chain begins.';
  const name = (id) => (hist.entities.get(id) || { label: id }).label;
  switch (ev.e) {
    case 'planted': return `The man's ${/left/.test(ev.note || '') ? 'left' : 'right'} foot touched ${ev.place === 'seen-floor' ? 'floor the camera saw' : ev.place === 'patched-room' ? 'the study’s patched floor' : 'floor patched from real pixels'}. The contact was scripted.`;
    case 'sounded': return { step: 'That footstep made a contact sound.', locked: 'The locked handle made a dull click.', chime: 'The unlock made a chime.', creak: 'The opening door made a creak.', tick: 'The door made a small passing sound.' }[ev.snd && ev.snd.k] || 'That action made a sound.';
    case 'tapped': return `You tapped ${name(ev.target)}.`;
    case 'triggered': return 'Code (the HB API) asked for the unlock; there was no tap.';
    case 'unlocked': return `You unlocked ${name(ev.id)}. The room beyond was never filmed.`;
    case 'opened': return `${name(ev.id)} swung open on the unfilmed study (patched surfaces, made furniture).`;
    case 'entered': return `He stepped into ${name(ev.target)}.`;
    case 'patched': return 'We moved real pixels from the footage to repair this surface.';
    case 'built': return 'Our tools built this; it was not filmed.';
    case 'seen': return 'This appears in the original Grok footage.';
    case 'walked_past': return `He walked past ${name(ev.target)}.`;
    case 'tried_door': return `He tried ${name(ev.target)}, but it was locked.`;
    default: return hist.words(ev).replace(/^[\d.]+ s: /, '');
  }
}
function showWhy(id) {
  const chain = hist.why(id).reverse();           // root first, effect last
  const sel = hist.primaryEvent(id);
  // the effect: sounds whose recorded cause is THIS event (a footstep explains its contact sound, not a music layer)
  const eff = sel ? hist.events.filter((e) => e.cause === sel.eid && e.e === 'sounded') : [];
  const effect = eff.find((e) => e.snd && e.snd.k === 'step') || eff[0];
  if (effect) chain.push({ id: effect.id, eid: effect.eid, t: effect.t, e: effect.e });
  if (!chain.length) chain.push({ id, e: 'actor', t: 0 });
  sheet.querySelector('.why-card')?.remove();
  const h = `<section class="why-card" aria-label="Causal trace"><h3>Why this happened</h3><p>Cause to effect, by event id. Tap any step to replay it.</p><ol>${chain.map((s) => {
    const t = Number.isFinite(s.t) ? s.t : 0;
    return `<li><button class="why-step" type="button" data-t="${t}"><b>${esc(whyText(s))}</b><small>${s.eid ? t.toFixed(1) + 's · Replay this moment · ' + esc(s.eid) : 'root'}</small></button></li>`;
  }).join('')}</ol></section>`;
  sheet.querySelector('.acts').insertAdjacentHTML('afterend', h);
  sheet.querySelectorAll('.why-step').forEach((b) => b.onclick = () => seek(parseFloat(b.dataset.t) - 0.6, true));
  sheet.querySelector('.why-card').scrollIntoView({ block: 'nearest' });
  say('Cause to effect. Tap a step to replay it.');
}
function select(id) {
  state.sel = id; const st = hist.story(id), ent = hist.entities.get(id) || {};
  const evs = st.events.slice().filter((e) => e.e !== 'sounded' || ent.kind === 'sound').slice(-40).reverse();
  let h = `<h2>${esc(st.label)} <span class="chip ${ent.basis}">${esc(id)} · ${ent.basis === 'made' ? 'MADE' : ent.basis === 'patched' ? 'PATCHED' : esc(ent.basis || '')}</span><button class="x" type="button" id="sx">close</button></h2>`;
  h += (ent.source ? st.summary.slice(0, 1) : st.summary).map((s) => `<p>${esc(s)}</p>`).join('') + sourceHTML(ent);
  h += `<div class="acts"><button type="button" id="swhy">Why?</button><button type="button" id="sreplay">Replay its first moment</button><button type="button" id="sjson">{ } JSON</button>${ent.kind === 'person' ? '<button type="button" id="sfollow">Follow</button>' : ''}</div>`;
  h += `<p style="color:var(--dim)">${st.counts.events} events touch this. Newest first. Tap a line to be there.</p>`;
  h += evs.map((e) => `<div class="ev" data-t="${e.t}"><b>${e.t.toFixed(1)}s</b><span>${esc(hist.words(e).replace(/^[\d.]+ s: /, ''))}</span></div>`).join('');
  sheet.innerHTML = h; sheet.classList.add('open'); sheet.scrollTop = 0; drawSources();
  $('sx').onclick = () => { state.sel = null; sheet.classList.remove('open'); showMarkers(null); };
  $('swhy').onclick = () => showWhy(id);
  $('sjson').onclick = () => openJSON(JSON.stringify(hist.story(id), null, 1), 'story-' + id + '.json');
  const sf = $('sfollow'); if (sf) sf.onclick = () => { state.follow = !state.follow; sf.classList.toggle('on', state.follow); };
  $('sreplay').onclick = () => { const first = st.events[0]; seek(first ? first.t - 1.2 : 0, true); };
  sheet.querySelectorAll('.ev').forEach((d) => d.onclick = () => seek(parseFloat(d.dataset.t) - 0.8, true));
  showMarkers(st);
}
const IMGS = {};
function sourceHTML(ent) {
  if (!ent || !ent.source) return '';
  let h = `<p style="margin-top:8px;color:var(--patched)"><b>Where these pixels came from</b> (the Necklace for a picture): ${esc(ent.source.rule)}${ent.source.mirrored ? ' This one is the same lamp, mirrored.' : ''}</p>`;
  ent.source.pieces.forEach((p) => { h += `<div class="src"><canvas data-f="${esc(p.frame)}" data-r="${p.rect.join(',')}"></canvas><div><b>${esc(p.texture)}</b><br>frame <code>${esc(p.frame)}</code>, pixels (${p.rect[0]},${p.rect[1]}) to (${p.rect[2]},${p.rect[3]}) = ${p.rect[2] - p.rect[0]} x ${p.rect[3] - p.rect[1]} px<br><img src="${esc(p.texture_file)}" alt=""><br><span class="dim">${esc(p.method)}</span></div></div>`; });
  return h;
}
function drawSources() {
  sheet.querySelectorAll('canvas[data-f]').forEach((c) => {
    const fr = SRCS.frames[c.dataset.f]; if (!fr) return; const r = c.dataset.r.split(',').map(Number);
    const go = (img) => { const sc = img.width / fr.w; c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); x.lineWidth = 3; x.strokeStyle = '#b79cff'; x.fillStyle = 'rgba(183,156,255,.22)'; x.fillRect(r[0] * sc, r[1] * sc, (r[2] - r[0]) * sc, (r[3] - r[1]) * sc); x.strokeRect(r[0] * sc, r[1] * sc, (r[2] - r[0]) * sc, (r[3] - r[1]) * sc); };
    if (IMGS[fr.file] && IMGS[fr.file].complete) go(IMGS[fr.file]); else { const im = new Image(); IMGS[fr.file] = im; im.onload = () => go(im); im.src = fr.file; }
  });
}
function showMarkers(st) {
  let i = 0;
  if (st) { const evs = st.events.filter((e) => e.p && e.e !== 'sounded' && e.e !== 'planted').slice(-40); for (const e of evs) { if (i >= markers.length) break; const m = markers[i++]; m.visible = true; m.position.set(e.p[0], 0.03, e.p[2]); m.material.color.setHex(evColor[e.e] || 0xffffff); } }
  for (; i < markers.length; i++) markers[i].visible = false;
}
function downloadJSON(name, txt) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
// Self-test: replaying history must not write new history; ids unique; every patched thing names its source pixels.
function selfTest() {
  const out = [], ck = (name, ok, detail) => out.push({ name, ok: !!ok, detail });
  const n0 = hist.events.length, s0 = hist.samples.length, vt = view.t, vl = view.live, vp = view.playing;
  view.live = false; view.playing = false; for (const t of [0.5, 2, 5, 1]) { view.t = Math.min(t, sim.t); applyView(); }
  view.t = vt; view.live = vl; view.playing = vp; applyView();
  ck('replay appends nothing', hist.events.length === n0 && hist.samples.length === s0, `events ${n0}->${hist.events.length}, samples ${s0}->${hist.samples.length}`);
  ck('event ids unique', new Set(hist.events.map((e) => e.eid)).size === hist.events.length, hist.events.length + ' events');
  const bad = [...hist.entities.values()].filter((e) => e.basis === 'patched' && !(e.source && e.source.pieces.length && e.source.pieces.every((p) => p.frame && p.rect && p.rect.length === 4)));
  ck('every patched entity names frame + pixel rectangle', bad.length === 0, bad.map((e) => e.id).join(',') || 'all ok');
  const ref = (id) => !id || id.startsWith('tool:') || hist.entities.has(id) || /^E-/.test(id);
  const dang = hist.events.filter((e) => !ref(e.parent) || !(e.children || []).every(ref));
  ck('parents and children resolve', dang.length === 0, dang.length + ' dangling');
  const steps = hist.events.filter((e) => e.e === 'planted'); ck('scripted steps are labelled made, floor basis kept apart', steps.every((e) => e.basis === 'made' && e.floor_basis), steps.length + ' steps');
  ck('feet: planted-foot slide measured', gait.slide_cm && gait.slide_cm.every((v) => v < 6), 'left ' + gait.slide_cm[0].toFixed(1) + ' cm, right ' + gait.slide_cm[1].toFixed(1) + ' cm');
  // ---- finding 1: causal edges go by event id; an unrelated earlier tap never explains another action
  const unl = hist.events.filter((e) => e.e === 'unlocked'), badCause = [];
  for (const u of unl) { const ch = hist.why(u.eid); const root = ch.find((c) => c.e === 'tapped' || c.e === 'triggered'); if (!root || (root.e === 'tapped' && hist.byEid(root.eid).target !== u.id)) badCause.push(u.eid); }
  ck('why: every unlock traces to the tap/trigger of ITS door by event id', badCause.length === 0, unl.length + ' unlocks, bad: ' + (badCause.join(',') || 'none'));
  const noncausal = hist.events.filter((e) => e.cause && !hist.byEid(e.cause)); ck('why: every cause is an existing event id', noncausal.length === 0, noncausal.length + ' dangling');
  const anyActorParent = hist.events.filter((e) => e.cause && /^[A-Z]-\d{4}$/.test(e.cause)); ck('why: cause is never an entity id', anyActorParent.length === 0, anyActorParent.length + ' entity-id causes');
  // ---- finding 3: pickable pieces carry an id whose basis matches the group they live in
  const groupBasis = (o) => { for (let q = o; q; q = q.parent) { if (q.userData && q.userData.basisGroup) return q.userData.basisGroup; if (q === madeShell || q === patchedProps || q === studyP || q === doorP) return 'patched'; if (q === madeProps || q === studyM) return 'made'; } return null; };
  const wrong = []; for (const list of Object.values(pickables)) for (const o of list) { const gb = groupBasis(o); const id = o.userData && o.userData.id; if (!gb || !id) continue; const ent = hist.entities.get(id); if (!ent) { wrong.push(id + ' (no entity)'); continue; } if (ent.basis !== gb) wrong.push(id + ' is ' + ent.basis + ' but sits in a ' + gb + ' group'); }
  ck('provenance: no patched/made piece answers with a seen id', wrong.length === 0, [...new Set(wrong)].slice(0, 5).join('; ') || 'all consistent');
  const sd = pickables.doors.filter((o) => o.userData.id === 'D-0002' && groupBasis(o)); ck('provenance: D-0002 stays the filmed doorway only', sd.length === 0, sd.length + ' replacement pieces still named D-0002');
  // ---- finding 9: every texture a piece really uses is covered by its entity's sources
  const miss = []; for (const [id, set] of Object.entries(TEX_USE)) { const have = new Set((SRCS.entities[id] && SRCS.entities[id].textures) || []); for (const n of set) if (!have.has(n) && !have.has(n === 'ceiling' ? 'plaster_ceiling' : n)) miss.push(id + ':' + n); }
  ck('sources cover every texture used', miss.length === 0, miss.join(',') || 'all covered');
  // ---- finding 8: each step's first child is its own contact sound; every cause/child link is reciprocal, in any mode
  const badStep = steps.filter((e) => { const c0 = hist.entities.has(e.children && e.children[0]) && hist.events.find((x) => x.id === e.children[0]); return !c0 || !c0.snd || c0.snd.k !== 'step' || c0.cause !== e.eid; });
  ck('steps: children[0] is the contact sound caused by that step', badStep.length === 0, steps.length + ' steps, bad: ' + badStep.slice(0, 3).map((e) => e.eid).join(','));
  const nonrecip = hist.events.filter((e) => e.e === 'sounded' && e.cause).filter((e) => { const p = hist.byEid(e.cause); return !p || !(p.children || []).includes(e.id); });
  ck('sounds: cause event lists the sound as a child', nonrecip.length === 0, nonrecip.length + ' non-reciprocal');
  // ---- finding 2: Seen hides everything invented
  const keepSeg = state.seg; setSeg('seen'); applyView();
  const inv = [person && person.visible, proxy.man.visible, trail.visible, ring.visible, pool.some((m) => m.visible), Object.values(doorGroups).some((d) => d.grp.visible), patchedProps.visible, madeShell.visible, studyP.visible, studyM.visible, madeProps.visible, doorP.visible].filter(Boolean).length;
  setSeg(keepSeg); applyView();
  ck('Seen hides the person, footprints, path, door overlays and every patched/made piece', inv === 0, inv + ' invented layers still visible');
  return { pass: out.every((o) => o.ok), checks: out };
}
function openJSON(txt, fname = 'history-excerpt.json') {
  $('jpre').textContent = txt; $('jsonbox').classList.add('open'); $('jsonbox').dataset.file = fname;
  $('jcopy').onclick = async () => { try { await navigator.clipboard.writeText(txt); say('Copied'); } catch (e) { say('Copy was blocked here: use Download'); } };
  $('jdl').onclick = () => downloadJSON(fname, txt);
}
$('jclose').onclick = () => $('jsonbox').classList.remove('open');

function seek(t, play) { view.t = Math.max(0, Math.min(sim.t, t)); view.live = false; view.playing = !!play; lastAudioT = view.t; syncBtns(); if (view.t >= sim.t - 0.02) goLive(); }
function goLive() { view.live = true; view.playing = true; view.t = sim.t; lastAudioT = view.t; syncBtns(); }
function syncBtns() { $('bLive').classList.toggle('on', view.live); $('bPlay').textContent = view.playing ? 'pause' : 'play'; $('bLive').style.opacity = view.live ? 0.55 : 1; }
$('bLive').onclick = goLive; $('bPlay').onclick = () => { if (view.live) { view.live = false; view.playing = false; } else view.playing = !view.playing; syncBtns(); };

const labels = { list: [], add(id, pos, text, cls = '') { const el = document.createElement('div'); el.className = 'wlabel ' + cls; el.textContent = text; document.body.appendChild(el); const o = { id, pos: new THREE.Vector3(...pos), el }; this.list.push(o); return o; }, remove(o) { o.el.remove(); this.list = this.list.filter((x) => x !== o); } };
// One layout pass for every pill on screen: the AI-person disclosure first, then the study label, then door labels. Each is measured, clamped inside the usable
// rectangle, pushed apart by >= 6 px, and joined to its anchor by a leader line when it had to move.
function layoutLabels(tagVisible) {
  const R = usableRect(), svg = $('leaders'), v = new THREE.Vector3(), placed = [], items = [];
  const add = (el, wx, wy, wz, ok) => { if (!ok) { el.style.display = 'none'; return; } v.set(wx, wy, wz).project(camera); if (!(v.z > 0 && v.z < 1)) { el.style.display = 'none'; return; } el.style.display = 'block'; items.push({ el, ax: (v.x + 1) / 2 * innerWidth, ay: (1 - v.y) / 2 * innerHeight }); };
  add($('tag'), person.position.x, 1.95, person.position.z, tagVisible && state.seg !== 'seen');
  add($('madeLabel'), madeRoomG.userData.label.x, madeRoomG.userData.label.y, madeRoomG.userData.label.z, madeRoomG.visible && state.seg !== 'seen' && tagVisible);
  for (const o of labels.list) add(o.el, o.pos.x, o.pos.y, o.pos.z, tagVisible);
  let lines = '';
  for (const it of items) {
    const w = it.el.offsetWidth, h = it.el.offsetHeight; let x = Math.max(R.l + w / 2, Math.min(R.r - w / 2, it.ax)), y = Math.max(R.t + h / 2, Math.min(R.b - h / 2, it.ay - (it.el.id === 'tag' ? h / 2 + 4 : 0)));
    const hit = (yy) => placed.some((q) => Math.abs(q.x - x) < (q.w + w) / 2 + 6 && Math.abs(q.y - yy) < (q.h + h) / 2 + 6);
    if (hit(y)) { let done = false; for (let k = 1; k < 14 && !done; k++) for (const s of [-1, 1]) { const yy = y + s * k * (h + 6); if (yy - h / 2 >= R.t && yy + h / 2 <= R.b && !hit(yy)) { y = yy; done = true; break; } } }
    placed.push({ x, y, w, h }); it.el.style.left = x + 'px'; it.el.style.top = y + 'px'; it.el.style.transform = 'translate(-50%,-50%)';
    if (Math.hypot(x - it.ax, y - it.ay) > 22) lines += `<line x1="${x}" y1="${y}" x2="${it.ax}" y2="${it.ay}"/><circle cx="${it.ax}" cy="${it.ay}" r="2.5"/>`;
  }
  if (svg) svg.innerHTML = lines;
}
// ---------------------------------------------------------------- toast + picking
const toastEl = $('toast'); let tt;
let toastUntil = 0;
function say(s, made) { toastEl.textContent = s; toastEl.classList.toggle('made', !!made); toastEl.classList.add('show'); clearTimeout(tt); if (REC) toastUntil = sim.t + 2.2; else tt = setTimeout(() => toastEl.classList.remove('show'), 2100); }
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let down = null;
canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; if (REC) addTapDot(e.clientX, e.clientY); });
if (REC) document.addEventListener('pointerdown', (e) => { if (e.target !== canvas && e.target !== tl) addTapDot(e.clientX, e.clientY); }, true);
function addTapDot(x, y) { const d = document.createElement('div'); d.className = 'tap'; d.style.left = x + 'px'; d.style.top = y + 'px'; document.body.appendChild(d); setTimeout(() => d.remove(), 600); }
canvas.addEventListener('pointerup', (e) => {
  if (!down) return; const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null; if (moved > 9) return;
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); handlePick();
});
const shown = (o) => { while (o) { if (o.visible === false) return false; o = o.parent; } return true; };
function pickFrom(list, far = 99) { const h = ray.intersectObjects(list, false).filter((x) => shown(x.object) && x.distance < far); return h[0] || null; }
const seenMeshes = [];
const inMask = (p) => { if (U.maskOn.value < 0.5) return false; for (let i = 0; i < 4; i++) { const a = U.maskMin.value[i], b = U.maskMax.value[i]; if (p.x > a.x && p.y > a.y && p.z > a.z && p.x < b.x && p.y < b.y && p.z < b.z) return true; } return false; };
// a hit on the real (seen) geometry counts only where the shader would really draw it
function seenHitOk(p) {
  const c = camera.position; if (p.x < B.x0 - 0.10 || p.x > B.x1 + 0.10 || p.z < B.z0 - 0.10 || p.z > B.z1 + 0.10 || p.y > B.h + 0.04 || p.y < -0.25) return false;
  if (c.x < B.x0 && p.x < B.x0 + 0.30 && p.y > 0.06) return false; if (c.x > B.x1 && p.x > B.x1 - 0.12 && p.y > 0.06) return false;
  if (c.z < B.z0 && p.z < B.z0 + 0.30 && p.y > 0.06) return false; if (c.z > B.z1 && p.z > B.z1 - 0.35 && p.y > 0.06) return false;
  if (c.y > B.h && p.y > B.h - 0.25) return false; return !inMask(p);
}
function pickSeen(maxDist) {
  if (state.seg === 'made') return null;
  const hs = ray.intersectObjects(seenMeshes, false).filter((x) => x.distance < maxDist && seenHitOk(x.point) && (!x.uv || Math.min(x.uv.x, 1 - x.uv.x, x.uv.y, 1 - x.uv.y) > 0.035));   // same edge fade as the shader: faded pixels are not 'seen'
  return hs[0] || null;
}
function pickId() {   // returns { id, point, target }
  let h = pickFrom([proxy.man]); if (h) return { id: 'P-0001', point: h.point };
  h = pickFrom(pickables.foot); if (h) return { id: h.object.userData.id, point: h.point };
  h = pickFrom(pickables.doors); if (h) return { id: h.object.userData.id, point: h.point, target: h.object.userData.interactionTarget };
  h = pickFrom(pickables.props); if (h) return { id: h.object.userData.id, point: h.point };
  h = pickFrom(pickables.bed); if (h) return { id: 'O-0001', point: h.point };
  const sh = pickFrom(pickables.shell), sd = pickSeen(sh ? sh.distance + 0.05 : 99);
  if (sd) return { id: sd.point.y < 0.12 ? 'O-0003' : 'O-0002', point: sd.point };     // real geometry: seen floor / seen walls and windows
  if (sh) return { id: sh.object.userData.id, point: sh.point };                       // replacement surface: stays patched (no remapping to seen)
  return null;
}
function handlePick() {
  if (state.mode === 'film') return;
  const r = pickId(); if (r) return onPick(r.id, r.point, r.target);
  if (state.sel) { state.sel = null; sheet.classList.remove('open'); showMarkers(null); }
}
let onPickHook = null;
function onPick(id, point, target) {
  if (onPickHook && onPickHook(id, point)) return;
  const p = [point.x, point.y, point.z], act = target || id;
  let tap;
  if (act === 'D-0002') {
    if (sim.unlockT == null) { tap = viewerTap(act, p, 'Locked. You unlocked it.'); unlockMiddleDoor(tap.eid); say('Unlocked. The room behind it was never filmed.', true); }
    else { tap = viewerTap(act, p, 'Already open.'); say('Open. The room behind it was never filmed: patched surfaces, made furniture.', true); }
  } else if (act === 'D-0001' || act === 'D-0003') {
    tap = viewerTap(act, p, 'Locked: nothing was ever filmed behind it.'); doorGroups[act].mesh.material.uniforms.k.value = 1; sound(sim.t, act, 'C-0001', { k: 'locked' }, null, tap); say('Locked - not seen yet');
  } else viewerTap(id, p, '');
  select(id);
}

// ---------------------------------------------------------------- seen / made toggle
function applyCutaway() {   // attached pieces step aside with the wall/ceiling they belong to (same decision as the shader)
  const c = camera.position, hide = { x0: c.x < B.x0, x1: c.x > B.x1, z0: c.z < B.z0, z1: c.z > B.z1, y1: c.y > B.h };
  for (const g of [madeShell, madeProps]) g.traverse((o) => { if (o.userData && o.userData.cutSide) o.visible = !hide[o.userData.cutSide]; });
}
function applySegVis(unlocked, opened) {
  const sg = state.seg, P = sg === 'patched' || sg === 'all', M = sg === 'made' || sg === 'all';
  madeShell.visible = P; patchedProps.visible = P; studyP.visible = P; doorP.visible = P && unlocked; madeProps.visible = M; studyM.visible = M; madeRoomG.visible = opened && (P || M);
  // Seen = only what the camera filmed: no rebuilt person, no scripted footprints/path/markers, no generated door overlays
  if (leaf && leaf.knobG) leaf.knobG.visible = M;
  const S = sg !== 'seen'; if (person) person.visible = S; if (proxy.man) proxy.man.visible = S;
  for (const k in doorGroups) doorGroups[k].grp.visible = S;
  trail.visible = S; ring.visible = S; for (const m of markers) m.userData.hideInSeen = true;
}
function setSeg(v) {
  state.seg = v; document.querySelectorAll('#seg button').forEach((b) => b.classList.toggle('on', b.dataset.v === v));
  const seen = v === 'seen', pat = v === 'patched', made = v === 'made', all = v === 'all';
  U.seenA.value = made ? 0.10 : 1; U.maskOn.value = seen ? 0 : 1;
  U.kP.value = pat ? 0.28 : all ? 0.07 : 0; U.gP.value = pat ? 1 : 0; U.kM.value = made ? 0.55 : all ? 0.07 : 0; U.gM.value = made ? 1 : 0;
  for (const [m, opacity] of madeShell.userData.veil || []) { if (m.transparent !== all) { m.transparent = all; m.needsUpdate = true; } m.opacity = all ? opacity : 1; m.depthWrite = !all; }
  say(all ? 'Everything: the real picture first, with quiet patched and made layers' : seen ? 'Only what the camera saw. The gaps stay open.' : pat ? 'Patched: real pixels moved to where nobody filmed (lilac)' : 'Made: invented, nothing from the footage (teal)', made);
  applySegVis(sim.unlockT != null, sim.openT != null && view.t >= sim.openT);
}
document.querySelectorAll('#seg button').forEach((b) => b.addEventListener('click', () => setSeg(b.dataset.v)));

// ---------------------------------------------------------------- timeline strip (Studio-style lanes)
const tl = $('tl'), tx = tl.getContext('2d'); let tlW = 0, tlH = 0; const WIN = 24;
function tlSize() { const r = tl.getBoundingClientRect(); const d = Math.min(window.devicePixelRatio || 1, 2); tlW = r.width; tlH = r.height; tl.width = Math.round(r.width * d); tl.height = Math.round(r.height * d); tx.setTransform(d, 0, 0, d, 0, 0); }
new ResizeObserver(tlSize).observe(tl);
if (REC || Q.has('tl')) document.body.classList.add('tl-open');
$('bReplay').onclick = () => { const o = document.body.classList.toggle('tl-open'); $('bReplay').setAttribute('aria-expanded', o); $('bReplay').textContent = o ? 'Hide timeline' : 'Replay timeline'; };
new MutationObserver(() => document.body.classList.toggle('sheet-open', $('sheet').classList.contains('open'))).observe($('sheet'), { attributes: true, attributeFilter: ['class'] });
let tlDrag = null;
tl.addEventListener('pointerdown', (e) => { tl.setPointerCapture(e.pointerId); tlDrag = { x: e.clientX, t: view.t, moved: false }; if (REC) addTapDot(e.clientX, e.clientY); });
tl.addEventListener('pointermove', (e) => { if (!tlDrag) return; const dx = e.clientX - tlDrag.x; if (Math.abs(dx) > 3) tlDrag.moved = true; if (tlDrag.moved) { view.live = false; view.playing = false; view.t = Math.max(0, Math.min(sim.t, tlDrag.t - (dx / tlW) * WIN)); lastAudioT = view.t; syncBtns(); } });
tl.addEventListener('pointerup', (e) => { if (tlDrag && !tlDrag.moved) { const t = view.t + ((e.clientX - tl.getBoundingClientRect().left) / tlW - 0.62) * WIN; seek(t, false); } tlDrag = null; });
function drawTimeline() {
  if (!tlW) return; const t = view.t, x0 = t - WIN * 0.62, X = (tt2) => ((tt2 - x0) / WIN) * tlW;
  tx.clearRect(0, 0, tlW, tlH); tx.fillStyle = '#1b1812'; tx.fillRect(0, 0, tlW, tlH);
  // second grid
  tx.font = '11px system-ui'; tx.fillStyle = '#8a8265'; tx.strokeStyle = '#2a251b'; tx.lineWidth = 1;
  for (let s = Math.ceil(x0 / 5) * 5; s < x0 + WIN; s += 5) { const x = X(s); tx.beginPath(); tx.moveTo(x, 0); tx.lineTo(x, tlH); tx.stroke(); tx.fillText(s + 's', x + 2, tlH - 3); }
  // made-floor band (where the man is on floor we made)
  const lanes = [['STEPS', 17], ['DOORS', 35], ['SOUND', 53]]; tx.fillStyle = '#8a8265'; tx.font = '11px system-ui'; lanes.forEach(([n, y]) => tx.fillText(n, 4, y - 3));
  const evs = hist.eventsBetween(x0 - 1, x0 + WIN + 1, { limit: 700 });
  for (const e of evs) {
    const x = X(e.t); if (x < 0 || x > tlW) continue;
    if (e.e === 'planted') { tx.fillStyle = '#5fd6c6'; tx.fillRect(x - 1, 7, 2, 10); }
    else if (e.e === 'sounded') { if (e.snd.k !== 'step') { tx.fillStyle = e.snd.k === 'kick' || e.snd.k === 'clap' || e.snd.k === 'hat' || e.snd.k === 'bass' ? '#e9a24b' : '#ece6d4'; tx.fillRect(x - 1, 44, 2, 7); } }
    else if (['tapped', 'unlocked', 'opened', 'tried_door', 'walked_past', 'entered', 'left', 'paused', 'built'].includes(e.e) && e.id !== 'M-0004' && e.id !== 'M-0007' && e.id[0] !== 'Q') {
      tx.fillStyle = e.e === 'unlocked' || e.e === 'opened' || e.e === 'entered' || e.basis === 'made' && e.e === 'built' ? '#5fd6c6' : e.e === 'tapped' ? '#fff' : '#e9a24b'; tx.save(); tx.translate(x, 33); tx.rotate(Math.PI / 4); tx.fillRect(-3, -3, 6, 6); tx.restore();
    }
  }
  // now marker + playhead
  const xn = X(sim.t); if (xn < tlW) { tx.fillStyle = 'rgba(240,195,107,.12)'; tx.fillRect(xn, 0, tlW - xn, tlH); }
  const xp = X(t); tx.strokeStyle = view.live ? '#f0c36b' : '#fff'; tx.lineWidth = 2; tx.beginPath(); tx.moveTo(xp, 0); tx.lineTo(xp, tlH); tx.stroke();
  tx.fillStyle = view.live ? '#f0c36b' : '#fff'; tx.font = '11px ui-monospace, monospace'; tx.fillText(t.toFixed(1) + 's' + (view.live ? ' live' : ' replay'), Math.max(4, Math.min(tlW - 150, xp - 80)), 10);
}

// ---------------------------------------------------------------- the camera helpers modes use
const ctx = { openJSON: (t, f) => openJSON(t, f), viewerTap: (...a) => viewerTap(...a), labels, why: (id) => hist.why(id), THREE, scene, camera, controls, renderer, hist, sim, view, state, B, DOORS, DX, DW, DH, L, MADE_ROOM, NS, $, say, emit, sound, playSnd, listeners, seek, goLive, select, placeOf, doorFrac,
  unlockMiddleDoor, get sfx() { return sfx; }, soundOn, soundOff, home, setView, get viewName() { return viewName; }, CONFIG, HOME_POS, HOME_TARGET, REC, simStep, applyView, setSeg, get person() { return person; }, doorOpen, sndList, setPickHook: (f) => { onPickHook = f; }, sceneRefs: { madeShell, madeRoomG } };

// ---------------------------------------------------------------- boot
var modes = null; let clockLast = 0, acc = 0;
function frame(dtReal) {
  // advance the sim in fixed steps (live), view follows
  acc += Math.min(dtReal, 0.1);
  while (acc >= FIXED) { acc -= FIXED; simStep(FIXED); }
  tickView(dtReal); renderOnce(dtReal);
}
function tickView(dt) {
  if (view.live) view.t = sim.t;
  else if (view.playing) { const t0 = view.t; view.t += dt; if (view.t >= sim.t - 0.03) { goLive(); } }
}
const hv = new THREE.Vector3();
function renderOnce(dt) {
  applyView();
  U.t.value = view.t; for (const m of doorMeshes) { m.material.uniforms.t.value = view.t; m.material.uniforms.k.value *= 0.96; }
  modes && modes.update(dt);
  if (!(modes && modes.cameraOwned())) { if (state.follow && person) controls.target.lerp(hv.set(person.position.x, 1.0, person.position.z), 0.08); controls.update(); }
  U.cam.value.copy(camera.position);
  camera.updateMatrixWorld(); layoutLabels(!(modes && modes.hideTag()));
  if (REC && toastUntil && sim.t > toastUntil) { toastEl.classList.remove('show'); toastUntil = 0; }
  drawTimeline();
  renderer.render(scene, camera);
}

(async () => {
  try {
    const meta = await (await fetch('meta.json')).json();
    const [room, per] = await Promise.all([loadGLB('room.glb'), loadGLB('person.glb')]);
    room.scene.scale.setScalar(meta.scale);
    room.scene.traverse((o) => { if (o.isMesh) { o.material = makeSeenMaterial(o.material, CONFIG.seen, o.name); o.renderOrder = o.material.userData.anchor ? 2 : 1; } });
    scene.add(room.scene); room.scene.traverse((o) => { if (o.isMesh) seenMeshes.push(o); });
    await loadPatches(); try { SRCS = await (await fetch('patches/sources.json')).json(); } catch (e) { console.warn('no sources.json', e); }
    buildShell(); buildPatchedProps(); buildMadeProps(); buildStudy(); DOORS.forEach(makeDoor); buildRealDoor(); buildFootPool(); buildMarkers(); scene.add(trail);
    DOORS.forEach((d, i) => labels.add(d.id, [DX + 0.04, 2.14, d.z], `D${i + 1} · BEYOND UNFILMED`, 'seen door-note'));
    // bed proxy (seen), invisible but pickable
    const bedP = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.7, 1.95), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })); bedP.position.set(0.62, 0.35, -1.0); bedP.userData.id = 'O-0001'; scene.add(bedP); pickables.bed = [bedP];
    person = per.scene; scene.add(person);
    person.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.material.roughness = 0.9; o.material.emissive = new THREE.Color(0x0e0e14); } });
    mixer = new THREE.AnimationMixer(person);
    const clips = {}; for (const c of per.animations) clips[c.name] = c;
    walkA = mixer.clipAction(clips.walk); idleA = mixer.clipAction(clips.idle); walkA.play(); idleA.play();
    analyzeGait();
    const pm = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.1, 2, 8), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })); scene.add(pm); proxy.man = pm; pm.visible = true;
    defineEntities();
    const lt = (e) => { if (e.e === 'sounded') { /* already in sndList */ } };
    setSeg('all'); say('', false); toastEl.classList.remove('show');
    resize(); setView(CONFIG.camera.default);
    // run the opening 0.8 s so the man is already in the room
    sim.x = L; sim.z = 1.15; sim.yaw = Math.PI;
    for (let i = 0; i < 12; i++) simStep(FIXED); view.t = sim.t;
    const { initModes } = await import('./modes.js'); modes = initModes(ctx);
    $('msg').remove();
  } catch (err) { $('msg').textContent = 'Could not load the room (' + (err && err.message || err) + ').'; console.error(err); return; }
  syncBtns();
  window.HB = {
    selfTest: () => selfTest(),
    pickRay: (ox, oy, oz, dx, dy, dz) => { ray.set(new THREE.Vector3(ox, oy, oz), new THREE.Vector3(dx, dy, dz).normalize()); const r = pickId(); return r && { id: r.id, target: r.target || null, point: [r.point.x, r.point.y, r.point.z].map((v) => +v.toFixed(3)) }; },
    layerState: () => ({ seg: state.seg, person: !!person.visible, manProxy: proxy.man.visible, footprints: pool.filter((m) => m.visible).length, trail: trail.visible, doorOverlays: Object.values(doorGroups).filter((d) => d.grp.visible).length, patched: madeShell.visible, made: madeProps.visible, studyOpen: madeRoomG.visible, windowGroupVisible: (() => { let v = null; madeShell.traverse((o) => { if (o.userData && o.userData.cutSide === 'z1' && o.isGroup) v = o.visible; }); return v; })(), ceilingLight: (() => { let v = null; madeProps.traverse((o) => { if (o.userData && o.userData.id === 'M-0007') v = o.visible; }); return v; })(), camera: camera.position.toArray().map((x) => +x.toFixed(2)) }), grounding: () => ({ sole_min_y_m: gait.sole_min_y_rest, applied_offset_m: gait.yOff, foot_slide_cm_per_7cm_of_root_travel: { left: +gait.slide_cm[0].toFixed(1), right: +gait.slide_cm[1].toFixed(1) }, note: 'Measured on the ankle bone over +/-2/48 of the walk cycle against the root travel. Grounding (sole at y=0) does not prove the feet never slide; this number says how much they do.' }),
    download: () => downloadJSON('history.json', JSON.stringify(hist.toJSON())), why: (id) => hist.why(id),
    help: 'Bedroom v2 (sonnet). HB.history = event store. HB.story("P-0001"), HB.eventsBetween(t0,t1,{e,id}), HB.entities(), HB.where(t), HB.snapshot(). See AI-README.md.',
    history: hist, story: (id) => hist.story(id), eventsBetween: (a, b, o) => hist.eventsBetween(a, b, o), entities: () => [...hist.entities.values()],
    where: (t) => { const s = hist.trackAt(t); return s && { t: s[0], x: s[1], z: s[2], yaw: s[3], place: placeOf(s[1], s[2]) }; }, snapshot: () => hist.toJSON(), jsonl: () => hist.toJSONL(), now: () => sim.t,
    unlockMiddleDoor: () => unlockMiddleDoor(), modes: () => modes,
  };
  window.__ready = true;
  window.__dbg = { ctx, THREE, setSeg, step: (n = 1) => { for (let i = 0; i < n; i++) { simStep(FIXED); tickView(FIXED); } renderOnce(FIXED); }, view, sim, hist, camera, controls, pickables, U };
  window.__proj = (x, y, z) => { camera.updateMatrixWorld(); const v = new THREE.Vector3(x, y, z).project(camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; };
  window.__cap = (s) => { const e = $('rcap'); if (e) { e.textContent = s; e.style.opacity = s ? 1 : 0; } };
  // offline render of the sound events in [t0,t1] (what the page would play), for the video's audio track. returns base64 WAV.
  window.__renderAudio = async (vts, fps) => {
    const sr = 44100, dur = vts.length / fps, oc = new OfflineAudioContext(2, Math.ceil(sr * dur), sr), sf = new Sfx(oc);
    sf.roomTone(0, dur, 1);
    for (let f = 1; f < vts.length; f++) { const a0 = vts[f - 1], a1 = vts[f]; if (!(a1 > a0) || a1 - a0 > 0.1) continue;
      for (let i = sndList.length - 1; i >= 0; i--) { const ev = sndList[i]; if (ev.t <= a0) break; if (ev.t <= a1) { try { sf.play(ev.snd, f / fps + 0.001); } catch (e) {} } } }
    const buf = await oc.startRendering(), n = buf.length, ch = [buf.getChannelData(0), buf.getChannelData(1)], out = new DataView(new ArrayBuffer(44 + n * 4));
    const w = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); out.setUint32(4, 36 + n * 4, true); w(8, 'WAVE'); w(12, 'fmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 2, true); out.setUint32(24, sr, true); out.setUint32(28, sr * 4, true); out.setUint16(32, 4, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, n * 4, true);
    let peak = 0; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(ch[0][i]), Math.abs(ch[1][i])); const g = peak > 0.9 ? 0.9 / peak : 1;
    for (let i = 0; i < n; i++) { out.setInt16(44 + i * 4, Math.max(-1, Math.min(1, ch[0][i] * g)) * 32767, true); out.setInt16(46 + i * 4, Math.max(-1, Math.min(1, ch[1][i] * g)) * 32767, true); }
    let s = ''; const u8 = new Uint8Array(out.buffer); for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s);
  };
  if (REC) { window.__step = (n = 1) => { for (let i = 0; i < n; i++) { simStep(FIXED); tickView(FIXED); } renderOnce(FIXED); }; return; }
  let last = performance.now();
  renderer.setAnimationLoop((now) => { const dt = Math.min((now - last) / 1000, 0.1); last = now; frame(dt); });
})();
