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
const NS = [{ id: 'M-0002', x: 1.78, z: 0.34, name: 'left nightstand + lamp (made)' }, { id: 'M-0003', x: 1.78, z: -2.42, name: 'right nightstand + lamp (made)' }];
const placeOf = (x, z) => (x < B.x0 - 0.02 ? 'made-room' : (x >= SEEN_RECT.x0 && x <= SEEN_RECT.x1 && z >= SEEN_RECT.z0 && z <= SEEN_RECT.z1) ? 'seen-floor' : 'made-floor');

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
controls.minDistance = 2.2; controls.maxDistance = 11; controls.minPolarAngle = 0.08; controls.maxPolarAngle = Math.PI * 0.485;
const HOME_TARGET = new THREE.Vector3(-2.0, 0.3, -1.0), HOME_POS = new THREE.Vector3(1.7, 6.6, 7.7);
let bottomShift = 0;
function home() { camera.position.copy(HOME_POS); controls.target.copy(HOME_TARGET); controls.update(); }
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w < h ? 60 : 46;
  camera.setViewOffset(w, h, 0, bottomShift, w, h); camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
const bro = new ResizeObserver(() => { const sh = $('sheet').offsetHeight; bottomShift = Math.round(($('bottom').offsetHeight - sh) * 0.42 + sh * 0.3); resize(); }); bro.observe($('bottom'));

// ---------------------------------------------------------------- shader patches (world position, made tint, cut-away)
const U = {
  box: { value: new THREE.Vector4(B.x0, B.x1, B.z0, B.z1) }, H: { value: B.h }, cam: { value: new THREE.Vector3() },
  maskMin: { value: [0, 1, 2, 3].map(() => new THREE.Vector3(9, 9, 9)) }, maskMax: { value: [0, 1, 2, 3].map(() => new THREE.Vector3(9, 9, 9)) },
  maskOn: { value: 1 }, seenA: { value: 1 }, madeK: { value: 0.1 }, grid: { value: 0 }, t: { value: 0 },
};
function addWorld(sh) {
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nuniform vec4 uBox; uniform float uH;');
  sh.uniforms.uBox = U.box; sh.uniforms.uH = U.H;
}
const MADE_TINT = `
  { vec3 tint = vec3(0.30, 0.86, 0.80); float lum = dot(gl_FragColor.rgb, vec3(0.33));
    gl_FragColor.rgb = mix(gl_FragColor.rgb, tint * (0.30 + 0.95 * lum), uK);
    vec3 g = abs(fract(vWPos * 2.5) - 0.5); float ln = max(max(smoothstep(0.455, 0.5, g.x), smoothstep(0.455, 0.5, g.y)), smoothstep(0.455, 0.5, g.z));
    gl_FragColor.rgb += tint * ln * uGrid * 0.22; }`;
function madeMat(map, ao, color = 0xffffff, warm = 0) {
  const m = new THREE.MeshBasicMaterial({ map, color, side: THREE.FrontSide });
  m.onBeforeCompile = (sh) => {
    addWorld(sh); sh.uniforms.uK = U.madeK; sh.uniforms.uGrid = U.grid;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uK; uniform float uGrid;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        ${ao === 0 ? 'float dd = min(min(vWPos.x - uBox.x, uBox.y - vWPos.x), min(vWPos.z - uBox.z, uBox.w - vWPos.z)); diffuseColor.rgb *= 0.62 + 0.38 * smoothstep(0.0, 0.95, dd);' : ''}
        ${ao === 1 ? 'diffuseColor.rgb *= (0.70 + 0.30 * smoothstep(0.0, 0.7, vWPos.y)) * (1.0 - 0.20 * smoothstep(1.85, 2.45, vWPos.y));' : ''}
        ${warm ? 'diffuseColor.rgb *= vec3(1.12, 1.0, 0.86);' : ''}`)
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n' + MADE_TINT);
  };
  return m;
}
function seenMat(old) {
  const m = new THREE.MeshBasicMaterial({ map: old.map, side: THREE.DoubleSide, transparent: true });
  m.onBeforeCompile = (sh) => {
    addWorld(sh);
    Object.assign(sh.uniforms, { uCam: U.cam, uMin: U.maskMin, uMax: U.maskMax, uMaskOn: U.maskOn, uSeenA: U.seenA });
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uCam; uniform vec3 uMin[4]; uniform vec3 uMax[4]; uniform float uMaskOn; uniform float uSeenA;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        float e = min(min(vMapUv.x, 1.0 - vMapUv.x), min(vMapUv.y, 1.0 - vMapUv.y));
        diffuseColor.a *= smoothstep(0.0, 0.07, e) * uSeenA; diffuseColor.rgb *= 0.92;
        vec3 p = vWPos;
        // closed room: nothing seen outside the box (smeared depth) is kept
        if (p.x < uBox.x - 0.10 || p.x > uBox.y + 0.10 || p.z < uBox.z - 0.10 || p.z > uBox.w + 0.10 || p.y > uH + 0.04 || p.y < -0.25) discard;
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

// ---------------------------------------------------------------- canvas textures (made surfaces: in keeping with the Grok room)
function ctex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; }
let seed = 7; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const woodTex = (dark) => ctex(512, 512, (x, w, h) => {
  const n = 8, pw = w / n;
  for (let i = 0; i < n; i++) {
    const base = dark ? [44 + rnd() * 16, 30 + rnd() * 10, 22 + rnd() * 8] : [96 + rnd() * 22, 66 + rnd() * 14, 42 + rnd() * 10];
    x.fillStyle = `rgb(${base.map(Math.round)})`; x.fillRect(i * pw, 0, pw, h);
    for (let k = 0; k < 26; k++) { x.strokeStyle = `rgba(${dark ? '10,6,4' : '40,22,10'},${0.05 + rnd() * 0.12})`; x.lineWidth = 0.6 + rnd() * 1.2; const gx = i * pw + rnd() * pw; x.beginPath(); x.moveTo(gx, 0); x.bezierCurveTo(gx + (rnd() - 0.5) * 6, h * 0.3, gx + (rnd() - 0.5) * 6, h * 0.7, gx + (rnd() - 0.5) * 4, h); x.stroke(); }
    x.fillStyle = 'rgba(0,0,0,.45)'; x.fillRect(i * pw, 0, 1.6, h);
    const seam = rnd() * h; x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(i * pw, seam, pw, 1.4);
  }
});
const plasterTex = (c0) => ctex(256, 256, (x, w, h) => {
  x.fillStyle = c0; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) { x.fillStyle = `rgba(${rnd() > 0.5 ? '255,250,238' : '120,100,76'},${0.02 + rnd() * 0.04})`; x.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 3, 1 + rnd() * 3); }
});
const rugTex = () => ctex(256, 256, (x, w, h) => {
  x.fillStyle = '#7d3c2e'; x.fillRect(0, 0, w, h); x.strokeStyle = '#e6d3a6'; x.lineWidth = 6; x.strokeRect(14, 14, w - 28, h - 28); x.lineWidth = 2; x.strokeRect(30, 30, w - 60, h - 60);
  x.fillStyle = '#e6d3a6'; for (let i = 0; i < 5; i++) { x.save(); x.translate(w / 2, h / 2); x.rotate(Math.PI / 4 * i); x.fillRect(-4, -78, 8, 156); x.restore(); }
  for (let i = 0; i < 3000; i++) { x.fillStyle = `rgba(0,0,0,${rnd() * 0.08})`; x.fillRect(rnd() * w, rnd() * h, 2, 2); }
});

// ---------------------------------------------------------------- made geometry helpers
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

const madeShell = new THREE.Group(); madeShell.name = 'made-shell';     // M-0001: floor, ceiling, four walls
const madeProps = new THREE.Group();                                       // M-0002, M-0003, M-0004
const madeRoomG = new THREE.Group(); madeRoomG.visible = false;           // M-0005: only exists after the middle door is unlocked
scene.add(madeShell, madeProps, madeRoomG);
const mats = {};
const pickables = { man: [], foot: [], doors: [], props: [], shell: [] };

function buildMadeShell() {
  mats.floor = madeMat(woodTex(true), 0); mats.wall = madeMat(plasterTex('#d8cdb6'), 1); mats.ceil = madeMat(plasterTex('#e6dfcf'), 0);
  const add = (g, m, id, list = pickables.shell, extra = {}) => { const me = new THREE.Mesh(g, m); me.userData = Object.assign({ id }, extra); madeShell.add(me); list.push(me); return me; };
  const y0 = -0.06, w = 0.03;
  add(quad([[B.x0, y0, B.z1], [B.x1, y0, B.z1], [B.x1, y0, B.z0], [B.x0, y0, B.z0]], [0, 1, 0], uvXZ(1.44)), mats.floor, 'M-0001', pickables.shell, { floor: true });
  add(quad([[B.x0, B.h, B.z1], [B.x1, B.h, B.z1], [B.x1, B.h, B.z0], [B.x0, B.h, B.z0]], [0, -1, 0], uvXZ(1.5)), mats.ceil, 'M-0001');
  // door wall, in pieces so the middle door can really open
  const xw = B.x0 - w, zc = DOORS[1].z, za = zc - DW / 2, zb = zc + DW / 2;
  const wallW = (za0, zb0, ya, yb, inward, x) => quad([[x, ya, za0], [x, ya, zb0], [x, yb, zb0], [x, yb, za0]], inward, uvZY(1.5));
  add(wallW(B.z0, za, 0, B.h, [1, 0, 0], xw), mats.wall, 'M-0001'); add(wallW(zb, B.z1, 0, B.h, [1, 0, 0], xw), mats.wall, 'M-0001'); add(wallW(za, zb, DH, B.h, [1, 0, 0], xw), mats.wall, 'M-0001');
  // the doorway "plug": what is behind the door is not known until it is made
  const plug = new THREE.Mesh(wallW(za, zb, 0, DH, [1, 0, 0], xw - 0.01), new THREE.MeshBasicMaterial({ color: 0x14110c, side: THREE.FrontSide })); plug.name = 'plug'; madeShell.add(plug); madeShell.userData.plug = plug;
  add(quad([[B.x1 + w, 0, B.z0], [B.x1 + w, 0, B.z1], [B.x1 + w, B.h, B.z1], [B.x1 + w, B.h, B.z0]], [-1, 0, 0], uvZY(1.5)), mats.wall, 'M-0001');
  add(quad([[B.x0, 0, B.z0 - w], [B.x1, 0, B.z0 - w], [B.x1, B.h, B.z0 - w], [B.x0, B.h, B.z0 - w]], [0, 0, 1], uvXY(1.5)), mats.wall, 'M-0001');
  add(quad([[B.x0, 0, B.z1 + w], [B.x1, 0, B.z1 + w], [B.x1, B.h, B.z1 + w], [B.x0, B.h, B.z1 + w]], [0, 0, -1], uvXY(1.5)), mats.wall, 'M-0001');
  // baseboards + a made picture on the unseen wall (so the made wall is not a blank)
  const trim = madeMat(null, 2, 0xcfc4ad);
  [[(B.x0 + B.x1) / 2, 0.06, B.z1 - 0.02, B.x1 - B.x0, 0.12, 0.04], [(B.x0 + B.x1) / 2, 0.06, B.z0 + 0.02, B.x1 - B.x0, 0.12, 0.04]].forEach((a) => madeShell.add(box(a[3], a[4], a[5], trim, a[0], a[1], a[2])));
  [[B.x0 + 0.02, 0.06, (B.z0 + B.z1) / 2, 0.04, 0.12, B.z1 - B.z0], [B.x1 - 0.02, 0.06, (B.z0 + B.z1) / 2, 0.04, 0.12, B.z1 - B.z0]].forEach((a) => madeShell.add(box(a[3], a[4], a[5], trim, a[0], a[1], a[2])));
  const frame = madeMat(null, 2, 0x2d2018), art = madeMat(plasterTex('#c9b894'), 2);
  const fz = B.z1 - 0.05; madeShell.add(box(0.95, 0.68, 0.04, frame, 0.35, 1.45, fz)); madeShell.add(box(0.8, 0.54, 0.045, art, 0.35, 1.45, fz - 0.005));
  // recessed ceiling light (made)
  const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.2, 24), new THREE.MeshBasicMaterial({ color: 0xfff1cf, side: THREE.DoubleSide })); lamp.rotation.x = Math.PI / 2; lamp.position.set(0.3, B.h - 0.01, -1.0); madeShell.add(lamp);
}
function buildMadeProps() {
  const wood = madeMat(null, 2, 0x4a2a1a), shade = new THREE.MeshBasicMaterial({ color: 0xffe2a8 }), base = madeMat(null, 2, 0xcab99a), dark = madeMat(null, 2, 0x2b211b);
  const add = (o, id) => { o.userData.id = id; madeProps.add(o); pickables.props.push(o); };
  for (const n of NS) {
    const g = new THREE.Group(); g.position.set(n.x, 0, n.z);
    g.add(box(0.40, 0.52, 0.50, wood, 0, 0.26, 0)); g.add(box(0.405, 0.035, 0.505, madeMat(null, 2, 0x7d4a2d), 0, 0.535, 0));
    g.add(box(0.015, 0.06, 0.2, madeMat(null, 2, 0xc9a24a), -0.205, 0.38, 0));
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.2, 14), base); b.position.set(0, 0.65, 0); g.add(b);
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.2, 18, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe2a8, side: THREE.DoubleSide })); s.position.set(0, 0.86, 0); g.add(s);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xffd48a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 })); glow.scale.setScalar(0.9); glow.position.set(0, 0.86, 0); g.add(glow);
    g.traverse((o) => { if (o.isMesh) o.userData.id = n.id; }); g.children.forEach((c) => { if (c.isMesh) pickables.props.push(c); });
    madeProps.add(g);
  }
  // made headboard + pillows + mattress end (the footage smeared this corner into window glass)
  { const hb = madeMat(woodTex(true), 2, 0x9b6a4a), wh = madeMat(null, 2, 0xe8e8ee), lin = madeMat(null, 2, 0xf1f1f4);
    add(box(0.07, 1.05, 2.1, hb, 1.96, 0.52, -1.12), 'M-0004'); add(box(0.06, 1.2, 2.2, madeMat(null, 2, 0x2b211b), 1.99, 0.6, -1.12), 'M-0004');
    add(box(0.42, 0.46, 2.0, wh, 1.74, 0.23, -1.12), 'M-0004'); add(box(0.5, 0.13, 0.62, lin, 1.66, 0.55, -0.55), 'M-0004'); add(box(0.5, 0.13, 0.62, lin, 1.66, 0.55, -1.7), 'M-0004'); }
  // bed-foot skirt: covers the jagged edge where the footage cut off
  for (const [w, h, d, x, y, z] of [[0.14, 0.30, 2.0, -0.68, 0.15, -1.0], [2.5, 0.30, 0.10, 0.62, 0.15, 0.04], [2.5, 0.30, 0.10, 0.62, 0.15, -2.03]]) { const sk = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), dark); sk.position.set(x, y, z); add(sk, 'M-0004'); }
}
let _glow; function glowTex() { return _glow || (_glow = ctex(64, 64, (x, w, h) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); })); }

function buildMadeRoom() {
  const R = MADE_ROOM, floorM = madeMat(woodTex(false), 0, 0xffffff, 1), wallM = madeMat(plasterTex('#e2d3b0'), 1, 0xffffff, 1), ceilM = madeMat(plasterTex('#efe4cc'), 0, 0xffffff, 1);
  const add = (g, m) => { const me = new THREE.Mesh(g, m); me.userData.id = 'M-0005'; madeRoomG.add(me); pickables.shell.push(me); return me; };
  const h = B.h - 0.1, y0 = -0.06;
  add(quad([[R.x0, y0, R.z1], [R.x1, y0, R.z1], [R.x1, y0, R.z0], [R.x0, y0, R.z0]], [0, 1, 0], uvXZ(1.44)), floorM);
  add(quad([[R.x0, h, R.z1], [R.x1, h, R.z1], [R.x1, h, R.z0], [R.x0, h, R.z0]], [0, -1, 0], uvXZ(1.5)), ceilM);
  add(quad([[R.x0, 0, R.z0], [R.x0, 0, R.z1], [R.x0, h, R.z1], [R.x0, h, R.z0]], [1, 0, 0], uvZY(1.5)), wallM);
  add(quad([[R.x0, 0, R.z0], [R.x1, 0, R.z0], [R.x1, h, R.z0], [R.x0, h, R.z0]], [0, 0, 1], uvXY(1.5)), wallM);
  add(quad([[R.x0, 0, R.z1], [R.x1, 0, R.z1], [R.x1, h, R.z1], [R.x0, h, R.z1]], [0, 0, -1], uvXY(1.5)), wallM);
  // the back of the doorway wall, with the doorway cut out
  const xw = B.x0 - 0.035 - 0.012, zc = DOORS[1].z, za = zc - DW / 2, zb = zc + DW / 2;
  const wp = (a, b, ya, yb) => quad([[xw, ya, a], [xw, ya, b], [xw, yb, b], [xw, yb, a]], [-1, 0, 0], uvZY(1.5));
  add(wp(R.z0, za, 0, h), wallM); add(wp(zb, R.z1, 0, h), wallM); add(wp(za, zb, DH, h), wallM);
  const props = new THREE.Group(); madeRoomG.add(props);
  const wood = madeMat(null, 2, 0x5a3720, 1), rug = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.2), madeMat(rugTex(), 2, 0xffffff, 1)); rug.rotation.x = -Math.PI / 2; rug.rotation.z = Math.PI / 2; rug.position.set(-2.85, 0.005, -0.97);
  rug.material.side = THREE.DoubleSide; rug.userData.id = 'M-0005'; props.add(rug); pickables.shell.push(rug);
  const desk = box(0.55, 0.04, 1.3, wood, -3.98, 0.74, -0.97); desk.userData.id = 'M-0005'; props.add(desk); pickables.shell.push(desk);
  [[-0.35], [0.35]].forEach(([dz]) => { const l = box(0.5, 0.74, 0.05, wood, -3.98, 0.37, -0.97 + dz * 1.55); l.userData.id = 'M-0005'; props.add(l); });
  const chair = box(0.42, 0.05, 0.42, madeMat(null, 2, 0x3b2c22, 1), -3.35, 0.46, -0.97); props.add(chair); props.add(box(0.05, 0.5, 0.42, madeMat(null, 2, 0x3b2c22, 1), -3.15, 0.72, -0.97)); [[-0.17, -0.17], [-0.17, 0.17], [0.17, -0.17], [0.17, 0.17]].forEach(([a, b]) => props.add(box(0.04, 0.44, 0.04, wood, -3.35 + a, 0.22, -0.97 + b)));
  const shelf = box(0.3, 1.7, 1.1, wood, -4.12, 0.85, -1.62); shelf.position.set(-2.9, 0.85, R.z0 + 0.16); shelf.scale.set(3.4, 1, 0.5); shelf.userData.id = 'M-0005'; props.add(shelf); pickables.shell.push(shelf);
  const cols = [0xb9473a, 0x3d6a8a, 0xd0a64a, 0x587a4f, 0x8e5b8f, 0xdcd2b8];
  for (let r = 0; r < 4; r++) for (let i = 0; i < 12; i++) { const bk = box(0.07, 0.28, 0.22, madeMat(null, 2, cols[(i * 5 + r * 3) % 6], 1), -4.4 + 0.1 * i + 0.8 + 0.1, 0.25 + r * 0.38, R.z0 + 0.1); bk.position.x = -3.55 + i * 0.1; bk.position.z = R.z0 + 0.17; props.add(bk); }
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.22, 18, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe2a8, side: THREE.DoubleSide })); lamp.position.set(-4.0, 0.98, -0.62); props.add(lamp);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xffd48a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.95 })); glow.scale.setScalar(1.5); glow.position.set(-4.0, 0.98, -0.62); props.add(glow);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.2), new THREE.MeshBasicMaterial({ color: 0xfff6dc })); win.position.set(R.x0 + 0.02, 1.35, 0.0 - 0.99 + 0.0 - 0); win.rotation.y = Math.PI / 2; win.position.set(R.x0 + 0.015, 1.35, -0.97); win.userData.id = 'M-0005'; props.add(win); pickables.shell.push(win);
  for (const [dx, dz] of [[0, 0], [0.475, 0]]) { /* mullions */ }
  props.add(box(0.02, 1.2, 0.03, wood, R.x0 + 0.03, 1.35, -0.97)); props.add(box(0.02, 0.03, 0.95, wood, R.x0 + 0.03, 1.35, -0.97));
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
  const zc = DOORS[1].z, dk = madeMat(null, 2, 0x35200f), hinge = zc + DW / 2 - 0.02;
  const g = new THREE.Group(); g.visible = false; scene.add(g);
  g.add(box(0.1, DH + 0.08, 0.07, dk, DX - 0.01, (DH + 0.08) / 2, zc - DW / 2 - 0.03)); g.add(box(0.1, DH + 0.08, 0.07, dk, DX - 0.01, (DH + 0.08) / 2, zc + DW / 2 + 0.03)); g.add(box(0.1, 0.08, DW + 0.14, dk, DX - 0.01, DH + 0.04, zc));
  const pivot = new THREE.Group(); pivot.position.set(DX - 0.02, 0, hinge); g.add(pivot);
  const slab = box(0.045, DH - 0.02, DW - 0.04, madeMat(woodTex(true), 2, 0xb08a68), 0, (DH - 0.02) / 2, -(DW - 0.04) / 2); slab.userData.id = 'D-0002'; pivot.add(slab); pickables.doors.push(slab);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 10), new THREE.MeshBasicMaterial({ color: 0xd9b45a })); knob.position.set(0.04, 1.0, -DW + 0.14); pivot.add(knob);
  leaf = { g, pivot };
}

// ---------------------------------------------------------------- history + state
const hist = new History();
const sim = {
  t: 0, x: L, z: 1.05, yaw: Math.PI, cyc: 0, ww: 0, tasks: [], cur: null, idleT: 0, nStep: 0, lastStepT: -9, lastPass: {}, sched: [],
  inMade: false, unlockT: null, openT: null, visitDone: 0, speed: 0.763, lastSoundN: 0, music: false,
};
const view = { t: 0, live: true, playing: true };
const state = { sound: false, follow: false, trail: true, mode: 'explore', seg: 'both', sel: null };
const listeners = [];       // modes subscribe to events
function emit(o) { const ev = hist.emit(o); for (const f of listeners) f(ev); return ev; }
function defineEntities() {
  const E = (id, o) => hist.entity(id, o);
  E('P-0001', { kind: 'person', label: 'the man', basis: 'rebuilt', note: 'AI-generated person (not real). Body: Grok Imagine + Hunyuan3D. Walk: rebuilt from a tracked video. Route: scripted by us.' });
  DOORS.forEach((d, i) => E(d.id, { kind: 'door', label: d.name, basis: 'seen', note: 'The doorway is in the footage; what is behind it never was.' }));
  E('O-0001', { kind: 'object', label: 'the bed', basis: 'seen' }); E('O-0002', { kind: 'object', label: 'the window wall', basis: 'seen' }); E('O-0003', { kind: 'floor', label: 'the floor (seen part)', basis: 'seen' });
  E('M-0001', { kind: 'made', label: 'the closed-room shell (floor, ceiling, 4 walls)', basis: 'made', note: 'Built by our tools so the room is closed. Nobody saw the left side from the bed.' });
  E('M-0002', { kind: 'made', label: NS[0].name, basis: 'made' }); E('M-0003', { kind: 'made', label: NS[1].name, basis: 'made' });
  E('M-0004', { kind: 'made', label: 'bed-foot skirt', basis: 'made', note: 'Hides the torn edge where the footage stopped.' });
  E('M-0005', { kind: 'made', label: 'the room behind the middle door', basis: 'made', note: 'Does not exist in any footage. Built when the door was unlocked.' });
  E('C-0001', { kind: 'viewer', label: 'you', basis: 'seen' });
  hist.emit({ t: 0, id: 'O-0001', e: 'seen', basis: 'seen', note: 'in the Grok room footage' }); hist.emit({ t: 0, id: 'O-0002', e: 'seen', basis: 'seen', note: 'in the Grok room footage' }); hist.emit({ t: 0, id: 'O-0003', e: 'seen', basis: 'seen', note: 'the part of the floor the camera passed over' });
  for (const m of ['M-0001', 'M-0002', 'M-0003', 'M-0004']) hist.emit({ t: 0, id: m, e: 'built', parent: 'tool:bedroom-sonnet', basis: 'made', note: hist.entities.get(m).note || '' });
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
function sound(t, id, parent, snd, p) { const sid = hist.nextId('S'); hist.entity(sid, { kind: 'sound', label: 'sound ' + sid + ' (' + snd.k + ')', basis: 'made' }); const ev = emit({ t, id: sid, e: 'sounded', parent, snd, p, basis: 'made' }); sndList.push(ev); return sid; }

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
  gait = { pL: iL / N, pR: iR2 / N, offL: pl[iL], offR: pr[iR2], yOff: -minV, ok: true, rawR: iR / N };
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
  return [doNow(() => { if (reason) emit({ t: sim.t, id: 'P-0001', e: 'paused', p: [sim.x, 0, sim.z], basis: 'made', note: reason }); }),
    go(L, zc, { r: 0.12 }), wait(0.5, DX, zc), go(DX + 0.1, zc, { r: 0.1, sp: 0.8 }),
    doNow(() => emit({ t: sim.t, id: 'P-0001', e: 'entered', target: 'M-0005', p: [sim.x, 0, sim.z], basis: 'made', note: 'Into a room that exists only because the door was unlocked (made).' })),
    go(-2.7, zc, { r: 0.12, sp: 0.8 }), wait(3.2, -4.0, zc - 0.2, 'He looks at the desk in the made room.'),
    go(-1.7, zc, { r: 0.15 }), doNow(() => emit({ t: sim.t, id: 'P-0001', e: 'left', target: 'M-0005', p: [sim.x, 0, sim.z], basis: 'made' })), go(L, zc, { r: 0.12 })];
}
function loopTasks() {
  const zc = DOORS[1].z, T = [];
  T.push(go(L, 0.45));
  if (doorOpen()) T.push(...visitTasks('')); else T.push(go(L, zc, { r: 0.1 }), wait(1.6, DX, zc, 'He tries the middle door.', { onStart: () => { const id = 'D-0002'; emit({ t: sim.t, id: 'P-0001', e: 'tried_door', target: id, p: [sim.x, 0, sim.z], basis: 'made', note: 'Locked. ' }); sound(sim.t, 'S', id, { k: 'locked', pan: -0.4 }); } }));
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
  const c = sim.cur; let moved = 0, moving = false;
  if (!c.started) { c.started = true; if (c.onStart) c.onStart(); }
  if (c.type === 'go') {
    const dx = c.to[0] - sim.x, dz = c.to[1] - sim.z, d = Math.hypot(dx, dz), want = Math.atan2(dx, dz), diff = angDiff(want, sim.yaw);
    const rate = 3.4; sim.yaw += Math.max(-rate * dt, Math.min(rate * dt, diff));
    const f = Math.abs(diff) > 1.0 ? 0 : Math.max(0.4, 1 - Math.abs(diff) / 1.4);
    const sp = sim.speed * (c.sp || 1) * f, step = Math.min(d, sp * dt);
    sim.x += Math.sin(sim.yaw) * step; sim.z += Math.cos(sim.yaw) * step; moved = step; moving = step > 1e-5;
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
  if (moving && sim.x > DX + 0.1) for (const d of DOORS) if (Math.abs(sim.z - d.z) < 0.1 && sim.t - (sim.lastPass[d.id] || -9) > 4) { sim.lastPass[d.id] = sim.t; emit({ t: sim.t, id: 'P-0001', e: 'walked_past', target: d.id, p: [sim.x, 0, sim.z], v: [Math.sin(sim.yaw) * sim.speed, 0, Math.cos(sim.yaw) * sim.speed], basis: 'made', note: '' }); sound(sim.t, 'S', d.id, { k: 'tick', g: 0.5 }); }
  hist.sample(sim.t, sim.x, sim.z, sim.yaw, sim.cyc, sim.ww);
  if (hist.samples.length > 80000) hist.samples.splice(0, 8000);
}
function plantStep(t, x, z, foot) {
  const n = ++sim.nStep, id = hist.nextId('F'), place = placeOf(x, z), v = [Math.sin(sim.yaw) * sim.speed, 0, Math.cos(sim.yaw) * sim.speed];
  hist.entity(id, { kind: 'footstep', label: `footstep ${n} (${foot === 'L' ? 'left' : 'right'})`, basis: place === 'seen-floor' ? 'rebuilt' : 'made' });
  const target = place === 'seen-floor' ? 'O-0003' : place === 'made-room' ? 'M-0005' : 'M-0001';
  const sidN = (hist.counters['S'] || 0) + 1, sid = 'S-' + String(sidN).padStart(4, '0');
  sim.stepInfo = { foot, n, gap: t - sim.lastStepT, x, z }; sim.lastStepT = t;
  const ev = emit({ t, id, e: 'planted', parent: 'P-0001', target, p: [x, 0, z], v, place, children: [sid], basis: place === 'seen-floor' ? 'rebuilt' : 'made', note: `${foot === 'L' ? 'left' : 'right'} foot, step ${n}` });
  sound(t, id, id, { k: 'step', foot, place, pan: Math.max(-1, Math.min(1, (z + 1) / 3.5)), g: sim.music ? 0.45 : 1 }, [x, 0, z]);
}

// ---------------------------------------------------------------- viewer actions
function unlockMiddleDoor() {
  const t = sim.t, id = 'D-0002';
  if (sim.unlockT != null) return false;
  sim.unlockT = t;
  const un = emit({ t, id, e: 'unlocked', parent: 'C-0001', basis: 'made', note: 'The latch clicks. Nothing behind this door was ever filmed, so what opens is made.' });
  sound(t, id, id, { k: 'chime', g: 1, pan: -0.3 });
  sim.sched.push({ at: t + 0.5, fn: (at) => {
    sim.openT = at; emit({ t: at, id, e: 'opened', parent: 'C-0001', children: ['M-0005'], basis: 'made' }); un.children = ['M-0005'];
    sound(at, id, id, { k: 'creak', dur: 1.5, pan: -0.5 });
    emit({ t: at, id: 'M-0005', e: 'built', parent: id, basis: 'made', note: 'A small study, made by our tools the moment the door opened.' });
  } });
  sim.sched.push({ at: t + 1.9, fn: (at) => {   // he heard the click: come back and go in
    sim.tasks = visitTasks('He heard the latch click and turned back to the middle door.'); sim.cur = null;
  } });
  return true;
}
function viewerTap(id, p, note) { const t = sim.t; const ev = emit({ t, id: 'C-0001', e: 'tapped', target: id, p, basis: 'seen', note: note || '' }); return ev; }

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
  leaf.g.visible = unlocked && state.seg !== 'seen'; const fr = opened ? Math.min(1, (t - opT) / 1.4) : 0; const e = fr * fr * (3 - 2 * fr); leaf.pivot.rotation.y = e * 1.85 + Math.sin(fr * 18) * 0.02 * (1 - fr) * (fr > 0 ? 1 : 0);
  madeRoomG.visible = opened; madeShell.userData.plug.visible = !unlocked;
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
    const made = ev.place !== 'seen-floor'; m.material.color.setHex(made ? 0x5fd6c6 : 0xf0c36b);
    const pulse = Math.max(0, 1 - age / 0.4); m.material.opacity = Math.max(0.0, 0.62 * (1 - age / 22)) + pulse * 0.35;
    m.position.set(ev.p[0], 0.012, ev.p[2]); m.rotation.y = Math.atan2(ev.v[0], ev.v[2]); m.scale.setScalar(1 + pulse * 0.9);
  }
  for (; pi < pool.length; pi++) pool[pi].visible = false;
  // trail
  const arr = trailGeo.attributes.position.array; let n = 0; const sm = hist.samples;
  if (state.trail && sm.length) { let hiS = Math.min(sm.length - 1, Math.floor(t * 30 + 0.5)); if (sm[hiS] && sm[hiS][0] > t + 0.1) { hiS = Math.max(0, hiS - 1); } for (let i = hiS; i >= 0 && n < TRAIL_N; i -= 3) { const q = sm[i]; if (!q || t - q[0] > 16) break; arr[n * 3] = q[1]; arr[n * 3 + 1] = 0.02; arr[n * 3 + 2] = q[2]; n++; } }
  trailGeo.setDrawRange(0, n); trailGeo.attributes.position.needsUpdate = true; trail.material.color.setHex(placeOf(s[1], s[2]) === 'seen-floor' ? 0xf0c36b : 0x5fd6c6);
  // selection ring
  if (state.sel === 'P-0001') { ring.material.opacity = 0.85; ring.position.set(s[1], 0.025, s[2]); ring.scale.setScalar(1 + 0.08 * Math.sin(performance.now() / 220)); } else ring.material.opacity = 0;
  // sound for this view step
  pumpAudioOrdered(lastAudioT, t); lastAudioT = t;
}

// ---------------------------------------------------------------- selection + history sheet (Necklace style)
const sheet = $('sheet');
function esc(s) { return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
function select(id) {
  state.sel = id; const st = hist.story(id), ent = hist.entities.get(id) || {};
  const evs = st.events.slice().filter((e) => e.e !== 'sounded' || ent.kind === 'sound').slice(-40).reverse();
  let h = `<h2>${esc(st.label)} <span class="chip ${ent.basis}">${esc(id)} · ${ent.basis === 'made' ? 'MADE' : esc(ent.basis || '')}</span><button class="x" type="button" id="sx">close</button></h2>`;
  h += st.summary.map((s) => `<p>${esc(s)}</p>`).join('');
  h += `<div class="acts"><button type="button" id="sreplay">Replay its first moment</button><button type="button" id="sjson">{ } JSON</button>${ent.kind === 'person' ? '<button type="button" id="sfollow">Follow</button>' : ''}</div>`;
  h += `<p style="color:var(--dim)">${st.counts.events} events touch this. Newest first. Tap a line to be there.</p>`;
  h += evs.map((e) => `<div class="ev" data-t="${e.t}"><b>${e.t.toFixed(1)}s</b><span>${esc(hist.words(e).replace(/^[\d.]+ s: /, ''))}</span></div>`).join('');
  sheet.innerHTML = h; sheet.classList.add('open'); sheet.scrollTop = 0;
  $('sx').onclick = () => { state.sel = null; sheet.classList.remove('open'); showMarkers(null); };
  $('sjson').onclick = () => openJSON(JSON.stringify(hist.story(id), null, 1));
  const sf = $('sfollow'); if (sf) sf.onclick = () => { state.follow = !state.follow; sf.classList.toggle('on', state.follow); };
  $('sreplay').onclick = () => { const first = st.events[0]; seek(first ? first.t - 1.2 : 0, true); };
  sheet.querySelectorAll('.ev').forEach((d) => d.onclick = () => seek(parseFloat(d.dataset.t) - 0.8, true));
  showMarkers(st);
}
function showMarkers(st) {
  let i = 0;
  if (st) { const evs = st.events.filter((e) => e.p && e.e !== 'sounded' && e.e !== 'planted').slice(-40); for (const e of evs) { if (i >= markers.length) break; const m = markers[i++]; m.visible = true; m.position.set(e.p[0], 0.03, e.p[2]); m.material.color.setHex(evColor[e.e] || 0xffffff); } }
  for (; i < markers.length; i++) markers[i].visible = false;
}
function openJSON(txt) { $('jpre').textContent = txt; $('jsonbox').classList.add('open'); $('jcopy').onclick = () => { try { navigator.clipboard.writeText(txt); say('Copied'); } catch (e) {} }; }
$('jclose').onclick = () => $('jsonbox').classList.remove('open');

function seek(t, play) { view.t = Math.max(0, Math.min(sim.t, t)); view.live = false; view.playing = !!play; lastAudioT = view.t; syncBtns(); if (view.t >= sim.t - 0.02) goLive(); }
function goLive() { view.live = true; view.playing = true; view.t = sim.t; lastAudioT = view.t; syncBtns(); }
function syncBtns() { $('bLive').classList.toggle('on', view.live); $('bPlay').textContent = view.playing ? 'pause' : 'play'; $('bLive').style.opacity = view.live ? 0.55 : 1; }
$('bLive').onclick = goLive; $('bPlay').onclick = () => { if (view.live) { view.live = false; view.playing = false; } else view.playing = !view.playing; syncBtns(); };

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
function handlePick() {
  if (state.mode === 'film') return;
  let h = pickFrom([proxy.man]);
  if (h) return onPick('P-0001', h.point);
  h = pickFrom(pickables.foot); if (h) return onPick(h.object.userData.id, h.point);
  h = pickFrom(pickables.doors); if (h) return onPick(h.object.userData.id, h.point);
  h = pickFrom(pickables.props); if (h) return onPick(h.object.userData.id, h.point);
  h = pickFrom(pickables.bed); if (h) return onPick('O-0001', h.point);
  h = pickFrom(pickables.shell);
  if (h) { let id = h.object.userData.id; if (h.object.userData.floor && state.seg !== 'made' && h.point.x >= SEEN_RECT.x0 && h.point.x <= SEEN_RECT.x1 && h.point.z >= SEEN_RECT.z0 && h.point.z <= SEEN_RECT.z1) id = 'O-0003'; return onPick(id, h.point); }
  if (state.sel) { state.sel = null; sheet.classList.remove('open'); showMarkers(null); }
}
let onPickHook = null;
function onPick(id, point) {
  if (onPickHook && onPickHook(id, point)) return;
  const p = [point.x, point.y, point.z];
  const ent = hist.entities.get(id);
  if (id === 'D-0002') {
    if (sim.unlockT == null) { viewerTap(id, p, 'Locked. You unlocked it.'); unlockMiddleDoor(); say('Unlocked. What opens is MADE, never seen.', true); }
    else { viewerTap(id, p, 'Already open.'); say('Open. The room behind it is made, not seen.', true); }
  } else if (id === 'D-0001' || id === 'D-0003') {
    viewerTap(id, p, 'Locked: nothing was ever filmed behind it.'); doorGroups[id].mesh.material.uniforms.k.value = 1; sound(sim.t, id, id, { k: 'locked' }); say('Locked - not seen yet');
  } else viewerTap(id, p, '');
  select(id);
}

// ---------------------------------------------------------------- seen / made toggle
function setSeg(v) {
  state.seg = v; document.querySelectorAll('#seg button').forEach((b) => b.classList.toggle('on', b.dataset.v === v));
  const both = v === 'both', seen = v === 'seen', made = v === 'made';
  madeShell.visible = !seen; madeProps.visible = !seen; if (!seen && madeRoomG.visible !== undefined) madeRoomG.userData.hide = false;
  U.seenA.value = made ? 0.10 : 1; U.maskOn.value = seen ? 0 : 1; U.madeK.value = made ? 0.55 : both ? 0.055 : 0; U.grid.value = made ? 1 : 0;
  madeRoomG.userData.forceHide = seen;
  say(both ? 'Seen + made together (made has a teal wash)' : seen ? 'Only what the camera saw. Gaps stay open.' : 'Only what we made, in teal.', made);
}
document.querySelectorAll('#seg button').forEach((b) => b.addEventListener('click', () => setSeg(b.dataset.v)));

// ---------------------------------------------------------------- timeline strip (Studio-style lanes)
const tl = $('tl'), tx = tl.getContext('2d'); let tlW = 0, tlH = 0; const WIN = 24;
function tlSize() { const r = tl.getBoundingClientRect(); const d = Math.min(window.devicePixelRatio || 1, 2); tlW = r.width; tlH = r.height; tl.width = Math.round(r.width * d); tl.height = Math.round(r.height * d); tx.setTransform(d, 0, 0, d, 0, 0); }
new ResizeObserver(tlSize).observe(tl);
let tlDrag = null;
tl.addEventListener('pointerdown', (e) => { tl.setPointerCapture(e.pointerId); tlDrag = { x: e.clientX, t: view.t, moved: false }; if (REC) addTapDot(e.clientX, e.clientY); });
tl.addEventListener('pointermove', (e) => { if (!tlDrag) return; const dx = e.clientX - tlDrag.x; if (Math.abs(dx) > 3) tlDrag.moved = true; if (tlDrag.moved) { view.live = false; view.playing = false; view.t = Math.max(0, Math.min(sim.t, tlDrag.t - (dx / tlW) * WIN)); lastAudioT = view.t; syncBtns(); } });
tl.addEventListener('pointerup', (e) => { if (tlDrag && !tlDrag.moved) { const t = view.t + ((e.clientX - tl.getBoundingClientRect().left) / tlW - 0.62) * WIN; seek(t, false); } tlDrag = null; });
function drawTimeline() {
  if (!tlW) return; const t = view.t, x0 = t - WIN * 0.62, X = (tt2) => ((tt2 - x0) / WIN) * tlW;
  tx.clearRect(0, 0, tlW, tlH); tx.fillStyle = '#1b1812'; tx.fillRect(0, 0, tlW, tlH);
  // second grid
  tx.font = '9px system-ui'; tx.fillStyle = '#6f6850'; tx.strokeStyle = '#2a251b'; tx.lineWidth = 1;
  for (let s = Math.ceil(x0 / 5) * 5; s < x0 + WIN; s += 5) { const x = X(s); tx.beginPath(); tx.moveTo(x, 0); tx.lineTo(x, tlH); tx.stroke(); tx.fillText(s + 's', x + 2, tlH - 3); }
  // made-floor band (where the man is on floor we made)
  const lanes = [['STEPS', 15], ['DOORS', 33], ['SOUND', 49]]; tx.fillStyle = '#6f6850'; tx.font = '8px system-ui'; lanes.forEach(([n, y]) => tx.fillText(n, 4, y - 5));
  const evs = hist.eventsBetween(x0 - 1, x0 + WIN + 1, { limit: 700 });
  for (const e of evs) {
    const x = X(e.t); if (x < 0 || x > tlW) continue;
    if (e.e === 'planted') { tx.fillStyle = e.place === 'seen-floor' ? '#f0c36b' : '#5fd6c6'; tx.fillRect(x - 1, 7, 2, 10); }
    else if (e.e === 'sounded') { if (e.snd.k !== 'step') { tx.fillStyle = e.snd.k === 'kick' || e.snd.k === 'clap' || e.snd.k === 'hat' || e.snd.k === 'bass' ? '#e9a24b' : '#ece6d4'; tx.fillRect(x - 1, 44, 2, 7); } }
    else if (['tapped', 'unlocked', 'opened', 'tried_door', 'walked_past', 'entered', 'left', 'paused', 'built'].includes(e.e) && e.id !== 'M-0001' && e.id !== 'M-0002' && e.id !== 'M-0003' && e.id !== 'M-0004') {
      tx.fillStyle = e.e === 'unlocked' || e.e === 'opened' || e.e === 'entered' || e.basis === 'made' && e.e === 'built' ? '#5fd6c6' : e.e === 'tapped' ? '#fff' : '#e9a24b'; tx.save(); tx.translate(x, 33); tx.rotate(Math.PI / 4); tx.fillRect(-3, -3, 6, 6); tx.restore();
    }
  }
  // now marker + playhead
  const xn = X(sim.t); if (xn < tlW) { tx.fillStyle = 'rgba(240,195,107,.12)'; tx.fillRect(xn, 0, tlW - xn, tlH); }
  const xp = X(t); tx.strokeStyle = view.live ? '#f0c36b' : '#fff'; tx.lineWidth = 2; tx.beginPath(); tx.moveTo(xp, 0); tx.lineTo(xp, tlH); tx.stroke();
  tx.fillStyle = view.live ? '#f0c36b' : '#fff'; tx.font = '10px ui-monospace, monospace'; tx.fillText(t.toFixed(1) + 's' + (view.live ? ' live' : ' replay'), Math.max(4, Math.min(tlW - 150, xp - 80)), 10);
}

// ---------------------------------------------------------------- the camera helpers modes use
const ctx = { THREE, scene, camera, controls, renderer, hist, sim, view, state, B, DOORS, DX, DW, DH, L, MADE_ROOM, NS, $, say, emit, sound, playSnd, listeners, seek, goLive, select, placeOf, doorFrac,
  unlockMiddleDoor, get sfx() { return sfx; }, soundOn, soundOff, home, HOME_POS, HOME_TARGET, REC, simStep, applyView, setSeg, get person() { return person; }, doorOpen, sndList, setPickHook: (f) => { onPickHook = f; }, sceneRefs: { madeShell, madeRoomG } };

// ---------------------------------------------------------------- boot
let modes = null, clockLast = 0, acc = 0;
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
  // labels
  camera.updateMatrixWorld(); const tag = $('tag'); hv.set(person.position.x, 1.95, person.position.z).project(camera);
  if (hv.z < 1 && !(modes && modes.hideTag())) { tag.style.display = 'block'; tag.style.left = ((hv.x + 1) / 2 * innerWidth - 0) + 'px'; tag.style.top = ((1 - hv.y) / 2 * innerHeight) + 'px'; } else tag.style.display = 'none';
  const ml = $('madeLabel'); if (madeRoomG.visible && state.seg !== 'seen' && !(modes && modes.hideTag())) { hv.copy(madeRoomG.userData.label).project(camera); if (hv.z < 1) { ml.style.display = 'block'; ml.style.left = ((hv.x + 1) / 2 * innerWidth) + 'px'; ml.style.top = ((1 - hv.y) / 2 * innerHeight) + 'px'; } else ml.style.display = 'none'; } else ml.style.display = 'none';
  if (madeRoomG.visible && state.seg === 'seen') madeRoomG.visible = false;
  if (REC && toastUntil && sim.t > toastUntil) { toastEl.classList.remove('show'); toastUntil = 0; }
  drawTimeline();
  renderer.render(scene, camera);
}

(async () => {
  try {
    const meta = await (await fetch('meta.json')).json();
    const [room, per] = await Promise.all([loadGLB('room.glb'), loadGLB('person.glb')]);
    room.scene.scale.setScalar(meta.scale);
    room.scene.traverse((o) => { if (o.isMesh) { o.material = seenMat(o.material); o.renderOrder = 1; } });
    scene.add(room.scene);
    buildMadeShell(); buildMadeProps(); buildMadeRoom(); DOORS.forEach(makeDoor); buildRealDoor(); buildFootPool(); buildMarkers(); scene.add(trail);
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
    setSeg('both'); say('', false); toastEl.classList.remove('show');
    resize(); home();
    // run the opening 0.8 s so the man is already in the room
    sim.x = L; sim.z = 1.15; sim.yaw = Math.PI;
    for (let i = 0; i < 12; i++) simStep(FIXED); view.t = sim.t;
    const { initModes } = await import('./modes.js'); modes = initModes(ctx);
    $('msg').remove();
  } catch (err) { $('msg').textContent = 'Could not load the room (' + (err && err.message || err) + ').'; console.error(err); return; }
  syncBtns();
  window.HB = {
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
