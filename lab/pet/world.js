/* ============================================================================
   world.js - the pet's little world: a grass patch, warm light, a few props,
   day and night by the clock on your phone, touch controls, the name card and
   the save. The pet itself is pet.js (createPet) and could live anywhere else.
   ========================================================================== */
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { createPet, PALETTE, formatAge } from "./pet.js";

const SAVE_KEY = "hb-pet:v1";
const HINT_KEY = "hb-pet:hints";
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const NAMES = ["Pip", "Momo", "Bean", "Juno", "Tofu", "Wobble", "Sunny", "Pebble", "Mochi", "Dot", "Fig", "Nib"];

/* ---------------------------------------------------------------- save */
function loadSave() { try { const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch { return null; } }
function writeSave(data) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); return true; } catch { return false; } }
function loadHints() { try { return +(localStorage.getItem(HINT_KEY) || 0); } catch { return 0; } }
function writeHints(n) { try { localStorage.setItem(HINT_KEY, String(n)); } catch { /* private mode: fine */ } }

/* ---------------------------------------------------------------- renderer */
const canvas = $("gl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
pmrem.dispose();

const camera = new THREE.PerspectiveCamera(48, 1, 0.05, 60);

/* ---------------------------------------------------------------- light */
const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x6b7d4a, 1.15);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2dc, 2.2);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -4; sun.shadow.camera.right = 4; sun.shadow.camera.top = 4; sun.shadow.camera.bottom = -4;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 20;
sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.02; sun.shadow.radius = 3;
scene.add(sun, sun.target);
const lantern = new THREE.PointLight(0xffb26b, 0, 3.2, 2);
scene.add(lantern);

/* ---------------------------------------------------------------- sky */
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color(0x9ccaf5) }, bottom: { value: new THREE.Color(0xf4e0c0) }, haze: { value: new THREE.Color(0xf4e0c0) } },
  vertexShader: "varying vec3 vP; void main(){ vP = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
  fragmentShader: `uniform vec3 top; uniform vec3 bottom; uniform vec3 haze; varying vec3 vP;
    void main(){ float h = clamp(normalize(vP).y, -0.1, 1.0); vec3 c = mix(bottom, top, pow(max(h,0.0), 0.55)); c = mix(haze, c, smoothstep(-0.1, 0.12, h)); gl_FragColor = vec4(c, 1.0); }`,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(40, 24, 12), skyMat);
scene.add(sky);
scene.fog = new THREE.Fog(0xf4e0c0, 7, 24);

/* ---------------------------------------------------------------- ground */
const PATCH = 4.2;
function noise2(x, z) { return Math.sin(x * 1.7 + 0.3) * Math.cos(z * 1.3 - 0.7) * 0.5 + Math.sin(x * 3.9 + z * 2.3) * 0.25 + Math.sin(x * 0.6 - z * 0.9) * 0.25; }
const groundGeo = new THREE.CircleGeometry(PATCH, 96, 0, Math.PI * 2);
groundGeo.rotateX(-Math.PI / 2);
{
  const pos = groundGeo.attributes.position, col = new Float32Array(pos.count * 3);
  const a = new THREE.Color(0x8fbf5c), b = new THREE.Color(0x5f8f3e), c = new THREE.Color(0xa9c860), tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), d = Math.hypot(x, z) / PATCH;
    const n = noise2(x, z);
    pos.setY(i, (1 - d) * 0.025 * n + 0.012 * n * d);
    tmp.copy(a).lerp(b, clamp(d * 1.1 + n * 0.15, 0, 1)).lerp(c, clamp(0.5 + n * 0.6, 0, 1) * 0.3 * (1 - d));
    col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
  }
  groundGeo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  groundGeo.computeVertexNormals();
}
const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }));
ground.receiveShadow = true;
scene.add(ground);
// soft earth ring and the far meadow, fading into the haze
const rim = new THREE.Mesh(new THREE.RingGeometry(PATCH - 0.05, PATCH + 0.9, 96), new THREE.MeshStandardMaterial({ color: 0x8a6a46, roughness: 1 }));
rim.rotation.x = -Math.PI / 2; rim.position.y = -0.012; rim.receiveShadow = true;
scene.add(rim);
const far = new THREE.Mesh(new THREE.CircleGeometry(30, 48), new THREE.MeshStandardMaterial({ color: 0x6f9a48, roughness: 1 }));
far.rotation.x = -Math.PI / 2; far.position.y = -0.03;
scene.add(far);
// soft hills on the horizon
{
  const hillMat = new THREE.MeshStandardMaterial({ color: 0x7aa455, roughness: 1 });
  const hills = [[-12, 9, 5, 1.3], [11, 12, 6.5, 1.7], [3, -16, 7, 1.9], [-14, -8, 5.5, 1.4], [16, -3, 5, 1.2]];
  for (const [x, z, r, h] of hills) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 12), hillMat);
    m.scale.set(1, h / r, 1); m.position.set(x, -0.3, z);
    scene.add(m);
  }
}

/* ---------------------------------------------------------------- grass */
const grassU = { uTime: { value: 0 } };
let grass;
{
  const COUNT = 2200;
  const g = new THREE.PlaneGeometry(1, 1, 1, 3);
  g.translate(0, 0.5, 0);
  const p = g.attributes.position, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    p.setX(i, p.getX(i) * (1 - y * 0.92));          // tapers to the tip
    p.setZ(i, y * y * 0.35);                        // bends
    const k = 0.5 + 0.5 * y;
    col[i * 3] = k; col[i * 3 + 1] = k; col[i * 3 + 2] = k;
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  // every blade is lit like the lawn it stands on (normals straight up), so no blade turns black when it faces away from the sun
  { const nrm = g.attributes.normal; for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, 0, 1, 0); }
  const mat = new THREE.MeshStandardMaterial({ color: 0x86bf52, roughness: 0.9, side: THREE.DoubleSide, vertexColors: true, emissive: 0x2a4a10, emissiveIntensity: 0.18 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = grassU.uTime;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uTime;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        { vec2 ip = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
          float w = sin(uTime * 1.6 + ip.x * 1.4 + ip.y * 1.1) * 0.5 + sin(uTime * 2.7 + ip.y * 2.3) * 0.25;
          transformed.x += w * 0.16 * uv.y * uv.y; transformed.z += w * 0.05 * uv.y * uv.y; }`);
    // double-sided blades must not flip their normal on the back face: both sides are "the lawn"
    sh.fragmentShader = sh.fragmentShader.replace("#include <normal_fragment_begin>", "#include <normal_fragment_begin>\nnormal = normalize(vNormal);");
  };
  mat.customProgramCacheKey = () => "hb-pet-grass-2";
  grass = new THREE.InstancedMesh(g, mat, COUNT);
  grass.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(COUNT * 3), 3);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3(), e = new THREE.Euler();
  for (let i = 0; i < COUNT; i++) {
    const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * (PATCH - 0.15);
    v.set(Math.cos(a) * d, 0, Math.sin(a) * d);
    const h = 0.05 + Math.random() * 0.07 + 0.03 * (1 - d / PATCH);
    e.set((Math.random() - 0.5) * 0.35, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.35);
    q.setFromEuler(e);
    s.set(0.016 + Math.random() * 0.012, h, 1);
    m.compose(v, q, s);
    grass.setMatrixAt(i, m);
    const t = Math.random();
    grass.instanceColor.setXYZ(i, 0.85 + t * 0.3, 0.9 + (t * 5.1 % 1) * 0.2, 0.8 + (t * 3.3 % 1) * 0.25);
  }
  grass.receiveShadow = true;
  scene.add(grass);
}
// a few little flowers (one draw call)
{
  const COUNT = 40;
  const fg = new THREE.SphereGeometry(0.022, 8, 6);
  const fm = new THREE.MeshStandardMaterial({ color: 0xfff4d6, roughness: 0.7, emissive: 0xfff0c0, emissiveIntensity: 0.15 });
  const flowers = new THREE.InstancedMesh(fg, fm, COUNT);
  flowers.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(COUNT * 3), 3);
  const m = new THREE.Matrix4();
  for (let i = 0; i < COUNT; i++) {
    const a = Math.random() * Math.PI * 2, d = 0.8 + Math.sqrt(Math.random()) * (PATCH - 1.0);
    m.makeTranslation(Math.cos(a) * d, 0.1 + Math.random() * 0.06, Math.sin(a) * d);
    flowers.setMatrixAt(i, m);
    const kind = Math.random();
    if (kind < 0.5) flowers.instanceColor.setXYZ(i, 1, 1, 1); else if (kind < 0.8) flowers.instanceColor.setXYZ(i, 1, 0.85, 0.45); else flowers.instanceColor.setXYZ(i, 1, 0.7, 0.85);
  }
  scene.add(flowers);
}

/* ---------------------------------------------------------------- props */
const props = new THREE.Group();
scene.add(props);
{
  // pebbles
  const pm = new THREE.MeshStandardMaterial({ color: 0x9a8f80, roughness: 0.85 });
  const spots = [[1.9, -1.4, 0.16, 0.5], [-2.2, 0.6, 0.12, 2.1], [2.6, 1.6, 0.1, 1.0], [-1.1, -2.6, 0.14, 0.2]];
  for (const [x, z, r, rot] of spots) {
    const g = new THREE.IcosahedronGeometry(r, 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (1 + noise2(p.getX(i) * 9, p.getZ(i) * 9) * 0.12), p.getY(i) * 0.65, p.getZ(i) * (1 + noise2(p.getZ(i) * 7, p.getX(i) * 5) * 0.12));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, pm); m.position.set(x, r * 0.45, z); m.rotation.y = rot; m.castShadow = true; m.receiveShadow = true;
    props.add(m);
  }
  // mushrooms
  const stemM = new THREE.MeshStandardMaterial({ color: 0xf1e3cc, roughness: 0.8 });
  const capM = new THREE.MeshStandardMaterial({ color: 0xd2663f, roughness: 0.55 });
  const dotM = new THREE.MeshStandardMaterial({ color: 0xfff3e2, roughness: 0.6 });
  const shrooms = [[-2.5, -1.3, 1.0], [-2.3, -1.05, 0.7], [2.1, 2.3, 0.85]];
  for (const [x, z, k] of shrooms) {
    const g = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.028 * k, 0.038 * k, 0.13 * k, 10), stemM); stem.position.y = 0.065 * k; stem.castShadow = true;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.085 * k, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), capM); cap.position.y = 0.1 * k; cap.scale.y = 0.75; cap.castShadow = true;
    g.add(stem, cap);
    for (let i = 0; i < 4; i++) {
      const a = i * 1.9 + x, d = new THREE.Mesh(new THREE.SphereGeometry(0.013 * k, 6, 5), dotM);
      d.position.set(Math.cos(a) * 0.05 * k, 0.14 * k + Math.sin(i) * 0.01, Math.sin(a) * 0.05 * k);
      g.add(d);
    }
    g.position.set(x, 0, z);
    props.add(g);
  }
  // the stump with a little lantern on it
  const wood = new THREE.MeshStandardMaterial({ color: 0x7d5a3c, roughness: 0.9 });
  const woodTop = new THREE.MeshStandardMaterial({ color: 0xc89c6c, roughness: 0.8 });
  const stump = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.22, 18), wood); trunk.position.y = 0.11; trunk.castShadow = true; trunk.receiveShadow = true;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.012, 18), woodTop); top.position.y = 0.225;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.004, 6, 24), new THREE.MeshStandardMaterial({ color: 0x9a7048, roughness: 0.9 })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.232;
  const ring2 = ring.clone(); ring2.scale.setScalar(0.5);
  stump.add(trunk, top, ring, ring2);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.12, 12), new THREE.MeshPhysicalMaterial({ color: 0xffd9a0, roughness: 0.2, transparent: true, opacity: 0.55, emissive: 0xffa040, emissiveIntensity: 0 }));
  glass.position.y = 0.23 + 0.06 + 0.012;
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.05, 0.025, 12), new THREE.MeshStandardMaterial({ color: 0x3b3230, roughness: 0.6, metalness: 0.4 })); lid.position.y = glass.position.y + 0.07;
  const base = lid.clone(); base.position.y = 0.23 + 0.018; base.scale.y = 0.6;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.004, 6, 16, Math.PI), lid.material); handle.position.y = lid.position.y + 0.012;
  stump.add(glass, lid, base, handle);
  stump.position.set(1.7, 0, -2.0);
  props.add(stump);
  lantern.position.set(1.7, 0.33, -2.0);
  props.userData.lanternGlass = glass;

  // the name sign
  const sign = new THREE.Group();
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.5, 0.035), wood); post.position.y = 0.25; post.castShadow = true;
  const plankCanvas = document.createElement("canvas"); plankCanvas.width = 512; plankCanvas.height = 192;
  const plankTex = new THREE.CanvasTexture(plankCanvas); plankTex.colorSpace = THREE.SRGBColorSpace;
  const plankMat = new THREE.MeshStandardMaterial({ map: plankTex, roughness: 0.85 });
  const plank = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.21, 0.03), [wood, wood, wood, wood, plankMat, wood]); plank.position.y = 0.44; plank.castShadow = true;
  sign.add(post, plank);
  sign.position.set(-1.8, 0, -1.9);
  sign.rotation.y = 0.45;
  props.add(sign);
  props.userData.drawSign = (name) => {
    const c = plankCanvas.getContext("2d");
    c.fillStyle = "#c08b58"; c.fillRect(0, 0, 512, 192);
    for (let i = 0; i < 14; i++) { c.fillStyle = `rgba(90,55,30,${0.08 + (i % 3) * 0.05})`; c.fillRect(0, 10 + i * 13 + Math.sin(i) * 4, 512, 3 + (i % 2)); }
    c.fillStyle = "#3a2416"; c.font = "600 86px Georgia, 'Times New Roman', serif"; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText(name, 256, 100, 470);
    plankTex.needsUpdate = true;
  };
}

/* ---------------------------------------------------------------- fireflies */
let fireflies;
{
  const N = 36;
  const pos = new Float32Array(N * 3), seeds = [];
  for (let i = 0; i < N; i++) { seeds.push({ a: Math.random() * 6.28, d: 1 + Math.random() * 3, h: 0.3 + Math.random() * 0.9, s: 0.3 + Math.random() * 0.5, p: Math.random() * 6.28 }); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const cv = document.createElement("canvas"); cv.width = cv.height = 64;
  const cx = cv.getContext("2d"), grd = cx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,240,170,1)"); grd.addColorStop(0.3, "rgba(255,220,120,0.6)"); grd.addColorStop(1, "rgba(255,200,80,0)");
  cx.fillStyle = grd; cx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(cv);
  const m = new THREE.PointsMaterial({ map: tex, size: 0.09, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffe6a0 });
  fireflies = new THREE.Points(g, m);
  fireflies.userData.seeds = seeds;
  fireflies.visible = false;
  scene.add(fireflies);
}

/* ---------------------------------------------------------------- day and night */
/* keyframes by local hour: sky top, sky bottom/haze, hemi sky, hemi ground, sun colour, sun strength, night 0..1 */
const KEYS = [
  { h: 0, top: 0x141a33, bot: 0x2a2f4a, hs: 0x2b3566, hg: 0x1c2018, sun: 0x8fa4ff, si: 0.35, night: 1, exp: 0.9 },
  { h: 5, top: 0x1b2140, bot: 0x3a3752, hs: 0x343d6e, hg: 0x1f2419, sun: 0x9fb0ff, si: 0.4, night: 0.95, exp: 0.92 },
  { h: 6.5, top: 0x8fb3e6, bot: 0xf6b98a, hs: 0xffd9b8, hg: 0x5a4a3a, sun: 0xffb078, si: 1.5, night: 0.2, exp: 1.0 },
  { h: 9, top: 0x8ec2f6, bot: 0xf6e3c4, hs: 0xd6ecff, hg: 0x6b7d4a, sun: 0xfff1dc, si: 2.2, night: 0, exp: 1.05 },
  { h: 13, top: 0x7fbaf6, bot: 0xf4e4c8, hs: 0xcfe8ff, hg: 0x6b7d4a, sun: 0xfff6e8, si: 2.4, night: 0, exp: 1.05 },
  { h: 17.5, top: 0x8fb6e8, bot: 0xf7cf9a, hs: 0xf2dcc2, hg: 0x66703e, sun: 0xffd3a0, si: 2.0, night: 0, exp: 1.03 },
  { h: 19.5, top: 0x4a4f8a, bot: 0xf09a6a, hs: 0xd9a89a, hg: 0x3e3a2e, sun: 0xff9a5c, si: 1.2, night: 0.3, exp: 0.98 },
  { h: 21, top: 0x1c2244, bot: 0x4a3c58, hs: 0x3c4476, hg: 0x22251b, sun: 0xa8b4ff, si: 0.45, night: 0.9, exp: 0.92 },
  { h: 24, top: 0x141a33, bot: 0x2a2f4a, hs: 0x2b3566, hg: 0x1c2018, sun: 0x8fa4ff, si: 0.35, night: 1, exp: 0.9 },
];
const dayC = { top: new THREE.Color(), bot: new THREE.Color(), hs: new THREE.Color(), hg: new THREE.Color(), sun: new THREE.Color() };
const tmpC = new THREE.Color();
let nightNow = 0;
function localHour() {
  const q = new URLSearchParams(location.search).get("hour");
  if (q != null && q !== "" && !isNaN(+q)) return ((+q % 24) + 24) % 24;
  const d = new Date();
  return d.getHours() + d.getMinutes() / 60;
}
function applyDayNight() {
  const h = localHour();
  let a = KEYS[0], b = KEYS[1];
  for (let i = 0; i < KEYS.length - 1; i++) if (h >= KEYS[i].h && h <= KEYS[i + 1].h) { a = KEYS[i]; b = KEYS[i + 1]; break; }
  const t = (h - a.h) / Math.max(0.001, b.h - a.h);
  const tt = t * t * (3 - 2 * t);
  for (const k of ["top", "bot", "hs", "hg", "sun"]) dayC[k].setHex(a[k]).lerp(tmpC.setHex(b[k]), tt);
  skyMat.uniforms.top.value.copy(dayC.top);
  skyMat.uniforms.bottom.value.copy(dayC.bot);
  skyMat.uniforms.haze.value.copy(dayC.bot);
  scene.fog.color.copy(dayC.bot);
  hemi.color.copy(dayC.hs); hemi.groundColor.copy(dayC.hg);
  sun.color.copy(dayC.sun);
  sun.intensity = lerp(a.si, b.si, tt);
  nightNow = lerp(a.night, b.night, tt);
  hemi.intensity = lerp(1.15, 0.45, nightNow);
  // the room environment lights every PBR material; dim it with the day or the night would glow like noon
  scene.traverse((o) => { if (o.material && o !== sky) for (const m of (Array.isArray(o.material) ? o.material : [o.material])) if ("envMapIntensity" in m && !m.userData.u) m.envMapIntensity = lerp(0.55, 0.06, nightNow); });
  pet.body.material.envMapIntensity = lerp(0.7, 0.12, nightNow);
  renderer.toneMappingExposure = lerp(a.exp, b.exp, tt);
  // the sun walks across the sky; at night the moon stands in from the other side
  const el = Math.sin(((h - 6) / 12) * Math.PI);
  const az = ((h - 6) / 12) * Math.PI;
  if (el > 0.08) sun.position.set(Math.cos(az) * 6, 2 + el * 7, -3 + Math.sin(az) * 2);
  else sun.position.set(-3, 5, 4);
  sun.target.position.set(0, 0, 0);
  // the lantern and the fireflies come on in the dark
  lantern.intensity = nightNow * 1.6;
  props.userData.lanternGlass.material.emissiveIntensity = nightNow * 1.4;
  fireflies.visible = nightNow > 0.05;
  fireflies.material.opacity = nightNow * 0.95;
  pet.setNight(nightNow);
}

/* ---------------------------------------------------------------- the pet */
const save = loadSave();
let pet = createPet(scene, save ? { save } : { name: NAMES[(Math.random() * NAMES.length) | 0], colour: PALETTE[(Math.random() * PALETTE.length) | 0].id, cells: 24 });
props.userData.drawSign(pet.name);
let dirty = false;
pet.onEvent((e) => {
  if (e === "grow") { floatLabel("+1 cell", true); dirty = true; }
  if (e === "eat") { dirty = true; }
  if (e === "poke") floatLabel("♥", false);
  if (e === "sleep") setStatus();
});

/* ---------------------------------------------------------------- camera */
const cam = { yaw: 0.35, dist: 1, zoom: 1, target: new THREE.Vector3(0, 0.3, 0) };
function placeCamera(dt) {
  const R = pet.radius;
  const aspect = innerWidth / Math.max(1, innerHeight);
  const portrait = aspect < 1 ? Math.pow(1 / aspect, 0.45) : 1;
  const want = (2.1 + R * 2.6) * portrait * cam.zoom;
  cam.dist += (want - cam.dist) * Math.min(1, dt * 1.5);
  const c = pet.center;
  cam.target.x += (c.x - cam.target.x) * Math.min(1, dt * 2.2);
  cam.target.z += (c.z - cam.target.z) * Math.min(1, dt * 2.2);
  cam.target.y += (R * 0.55 - cam.target.y) * Math.min(1, dt * 2);
  const pitch = 0.46;
  camera.position.set(cam.target.x + Math.sin(cam.yaw) * Math.cos(pitch) * cam.dist, cam.target.y + Math.sin(pitch) * cam.dist, cam.target.z + Math.cos(cam.yaw) * Math.cos(pitch) * cam.dist);
  camera.lookAt(cam.target);
}
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w < h ? 52 : 44;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();

/* ---------------------------------------------------------------- touch */
const ray = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const ndc = new THREE.Vector2(), hitP = new THREE.Vector3();
const pointers = new Map();
let primary = null;   // { id, x0, y0, t0, onPet, holding, point, timer }
let pinch0 = 0, pinchZoom0 = 1, orbitX0 = 0, orbitYaw0 = 0;
let hintStep = loadHints();

function groundPoint(x, y, out) {
  ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  return ray.ray.intersectPlane(groundPlane, out) ? out : null;
}
function startHold() {
  if (!primary || primary.holding) return;
  primary.holding = true;
  if (primary.point) pet.follow({ x: primary.point.x, z: primary.point.z });
  canvas.classList.add("holding");
}
canvas.addEventListener("pointerdown", (ev) => {
  if (ev.button !== undefined && ev.button > 0 && ev.pointerType === "mouse") { orbitX0 = ev.clientX; orbitYaw0 = cam.yaw; pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY, orbit: true }); return; }
  canvas.setPointerCapture?.(ev.pointerId);
  pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
  if (pointers.size === 1) {
    const p = groundPoint(ev.clientX, ev.clientY, new THREE.Vector3());
    ndc.set((ev.clientX / innerWidth) * 2 - 1, -(ev.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    primary = { id: ev.pointerId, x0: ev.clientX, y0: ev.clientY, t0: performance.now(), onPet: pet.hitTest(ray.ray), holding: false, point: p, timer: setTimeout(startHold, 260) };
  } else if (pointers.size === 2) {
    // two fingers: orbit and pinch; the hold (if any) ends
    if (primary) { clearTimeout(primary.timer); if (primary.holding) pet.follow(null); primary = null; canvas.classList.remove("holding"); }
    const [a, b] = [...pointers.values()];
    pinch0 = Math.hypot(a.x - b.x, a.y - b.y); pinchZoom0 = cam.zoom; orbitX0 = (a.x + b.x) / 2; orbitYaw0 = cam.yaw;
  }
});
canvas.addEventListener("pointermove", (ev) => {
  const rec = pointers.get(ev.pointerId);
  if (!rec) return;
  rec.x = ev.clientX; rec.y = ev.clientY;
  if (rec.orbit) { cam.yaw = orbitYaw0 + (ev.clientX - orbitX0) * 0.008; return; }
  if (pointers.size >= 2) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinch0 > 0) cam.zoom = clamp(pinchZoom0 * (pinch0 / Math.max(1, d)), 0.6, 1.8);
    cam.yaw = orbitYaw0 + ((a.x + b.x) / 2 - orbitX0) * 0.008;
    return;
  }
  if (primary && primary.id === ev.pointerId) {
    const moved = Math.hypot(ev.clientX - primary.x0, ev.clientY - primary.y0);
    const p = groundPoint(ev.clientX, ev.clientY, primary.point || new THREE.Vector3());
    if (p) primary.point = p;
    if (!primary.holding && moved > 10) { clearTimeout(primary.timer); startHold(); }
    if (primary.holding && primary.point) pet.follow({ x: primary.point.x, z: primary.point.z });
  }
});
function endPointer(ev) {
  const rec = pointers.get(ev.pointerId);
  pointers.delete(ev.pointerId);
  if (!rec) return;
  if (primary && primary.id === ev.pointerId) {
    clearTimeout(primary.timer);
    if (primary.holding) { pet.follow(null); bumpHint(3); }
    else if (ev.type !== "pointercancel") {
      if (primary.onPet) { pet.poke(); bumpHint(2); }
      else if (primary.point && Math.hypot(primary.point.x, primary.point.z) < PATCH + 0.4) { pet.feed(primary.point.x, primary.point.z); bumpHint(1); }
    }
    primary = null;
    canvas.classList.remove("holding");
  }
  if (pointers.size < 2) pinch0 = 0;
}
canvas.addEventListener("pointerup", endPointer);
canvas.addEventListener("pointercancel", endPointer);
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
addEventListener("wheel", (e) => { cam.zoom = clamp(cam.zoom * (1 + Math.sign(e.deltaY) * 0.08), 0.6, 1.8); }, { passive: true });
addEventListener("keydown", (e) => { if (e.key === "ArrowLeft") cam.yaw -= 0.15; if (e.key === "ArrowRight") cam.yaw += 0.15; });

/* ---------------------------------------------------------------- the card and hints */
const HINTS = ["Tap the grass to drop a berry.", "Tap {n} to say hi.", "Hold a finger on the grass and {n} follows.", "Every few berries, {n} grows a new cell."];
function bumpHint(step) { if (hintStep < step) { hintStep = step; writeHints(step); showHint(); } }
function showHint() {
  const el = $("hint");
  if (hintStep >= HINTS.length) { el.classList.add("off"); return; }
  el.textContent = HINTS[hintStep].replace("{n}", pet.name);
  el.classList.remove("off");
  if (hintStep === 3) setTimeout(() => { if (hintStep === 3) { hintStep = 4; writeHints(4); el.classList.add("off"); } }, 9000);
}
const STATE_WORDS = { idle: "sitting", wander: "wandering", sleep: "asleep", eat: "eating", follow: "following you", poked: "wiggling" };
function setStatus() {
  const s = pet.sim;
  const hungry = s.hunger < 0.4 ? (s.hunger < 0.2 ? " · hungry" : " · peckish") : "";
  $("status").textContent = `${pet.ageText} · ${pet.count} cells · ${STATE_WORDS[s.state] || s.state}${hungry}`;
  $("tummy").style.width = `${Math.round(s.hunger * 100)}%`;
}
$("petName").textContent = pet.name;

/* a little word that floats up from the pet ("+1 cell", "♥") */
const labelPos = new THREE.Vector3();
function floatLabel(text, big) {
  const el = document.createElement("div");
  el.className = "float" + (big ? " big" : "");
  el.textContent = text;
  labelPos.copy(pet.center); labelPos.y += pet.radius * 1.4;
  labelPos.project(camera);
  el.style.left = `${((labelPos.x + 1) / 2) * innerWidth}px`;
  el.style.top = `${((1 - labelPos.y) / 2) * innerHeight}px`;
  $("labels").appendChild(el);
  setTimeout(() => el.remove(), 1500);
}

/* ---------------------------------------------------------------- first run + settings sheet */
function buildSwatches(box, chosen, onPick) {
  box.innerHTML = "";
  for (const p of PALETTE) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "swatch" + (p.id === chosen ? " on" : ""); b.style.background = p.hex; b.title = p.name; b.setAttribute("aria-label", p.name);
    b.addEventListener("click", () => { box.querySelectorAll(".swatch").forEach((x) => x.classList.remove("on")); b.classList.add("on"); onPick(p.id); });
    box.appendChild(b);
  }
}
function openHatch() {
  const sheet = $("hatch");
  sheet.classList.add("on");
  let colour = pet.colour;
  $("hatchName").value = pet.name;
  buildSwatches($("hatchSwatches"), colour, (id) => { colour = id; pet.setColour(id); });
  $("hatchGo").onclick = () => {
    const n = $("hatchName").value.trim().slice(0, 18) || pet.name;
    pet.setName(n); pet.setColour(colour);
    $("petName").textContent = pet.name; props.userData.drawSign(pet.name);
    sheet.classList.remove("on");
    dirty = true; saveNow();
    hintStep = 0; writeHints(0); showHint();
    pet.poke();
  };
}
$("gear").addEventListener("click", () => { const s = $("sheet"); s.classList.toggle("on"); if (s.classList.contains("on")) { $("renameIn").value = pet.name; buildSwatches($("sheetSwatches"), pet.colour, (id) => { pet.setColour(id); dirty = true; }); $("reset").textContent = "Start over"; $("reset").dataset.armed = ""; } });
$("sheetClose").addEventListener("click", () => $("sheet").classList.remove("on"));
$("renameGo").addEventListener("click", () => { const n = $("renameIn").value.trim().slice(0, 18); if (n) { pet.setName(n); $("petName").textContent = n; props.userData.drawSign(n); dirty = true; saveNow(); showHint(); } $("sheet").classList.remove("on"); });
$("reset").addEventListener("click", (e) => {
  const b = e.currentTarget;
  if (!b.dataset.armed) { b.dataset.armed = "1"; b.textContent = "Tap again: a new egg, this one is gone"; return; }
  try { localStorage.removeItem(SAVE_KEY); localStorage.removeItem(HINT_KEY); } catch { /* fine */ }
  location.reload();
});

/* ---------------------------------------------------------------- save loop */
function saveNow() { if (writeSave(pet.save())) dirty = false; }
addEventListener("pagehide", saveNow);
addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") saveNow(); });

/* ---------------------------------------------------------------- go */
let last = performance.now(), statusT = 0, saveT = 0, dayT = 999, frames = 0, fpsT = 0;
applyDayNight();
pet.setNight(nightNow);
if (!save) openHatch(); else showHint();
setStatus();
$("loading").classList.add("off");

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000; last = now;
  if (!(dt > 0)) dt = 0.016;
  dt = Math.min(dt, 0.05);
  pet.update(dt);
  placeCamera(dt);
  pet.facePerson(camera.position);
  grassU.uTime.value += dt;
  if (fireflies.visible) {
    const p = fireflies.geometry.attributes.position, t = now / 1000;
    fireflies.userData.seeds.forEach((s, i) => { p.setXYZ(i, Math.cos(s.a + t * s.s * 0.4) * s.d, s.h + Math.sin(t * s.s * 1.7 + s.p) * 0.18, Math.sin(s.a + t * s.s * 0.4) * s.d); });
    p.needsUpdate = true;
    fireflies.material.opacity = nightNow * (0.6 + 0.4 * Math.sin(t * 2.3));
  }
  dayT += dt; if (dayT > 10) { dayT = 0; applyDayNight(); }
  statusT += dt; if (statusT > 0.5) { statusT = 0; setStatus(); }
  saveT += dt; if (saveT > 5) { saveT = 0; if (dirty) saveNow(); }
  frames++; fpsT += dt; if (fpsT >= 1) { window.__petFps = frames / fpsT; frames = 0; fpsT = 0; }
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

/* for the browser check and the console */
window.HBPet = { pet, scene, camera, renderer, saveNow, applyDayNight };
