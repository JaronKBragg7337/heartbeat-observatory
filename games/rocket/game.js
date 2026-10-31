// Heartbeat Rocket v2 - working title "Rocket".
// Real physics in one flat plane (physics.js: inverse-square gravity, thrust, fuel mass, drag that thins with
// height, stages, reentry heat), drawn in real-looking 3D with three.js. A small planet like Kerbal's: radius
// 600 km, surface gravity 9.81, air up to 70 km, so orbit is about 2.3 km/s.
// v2: stages, going all the way around, the map with a path that shows where you go, coming home with a
// heat shield. Built by Claude (Opus 5.5) for Heartbeat Observatory. CC0.
import * as THREE from 'three';
import {
  R, G0, ATM_TOP, PAD_H, SITE_R, STEP, DEG, NOSES, TANKS, ENGINES,
  newFlight as physicsFlight, stepPhysics, orbitInfo, inOrbit, conicPath, suggestedLean, stage, mass,
  fuelLeft, hasMoreStages, dropStage, separateCapsule, startComeHome, resumeBurn,
} from './physics.js';

const GOALS = [
  { id: 'clouds', alt: 2000,  title: 'Touch the clouds', done: 'You touched the clouds!', unlock: ['fins'],
    unlockText: 'New part: fins', unlockSub: 'Fins help your rocket fly straighter.' },
  { id: 'space',  alt: 70000, title: 'Reach space', done: 'You reached space!', unlock: ['tall', 'stages'],
    unlockText: 'New parts: the tall tank and stages', unlockSub: 'A booster now stacks under your rocket. That is enough to go all the way around!' },
  { id: 'orbit',  alt: null,  title: 'Go all the way around', done: 'You went all the way around!', unlock: ['shield'],
    unlockText: 'New part: the heat shield', unlockSub: 'Coming home from orbit is HOT. The shield keeps your capsule cool.' },
  { id: 'home',   alt: null,  title: 'Come home safe', done: 'You came home safe!', unlock: [],
    unlockText: 'Next: fly to the Moon', unlockSub: 'Coming soon in the next version.' },
];

// ---------------------------------------------------------------- saved progress (this device only)
const SAVE_KEY = 'hb-rocket-v1';            // same key as v1, so progress carries over
const WARPS = [1, 10, 50];
const DEFAULT_SAVE = {
  v: 2, reached: { clouds: false, space: false, orbit: false, home: false },
  unlocked: { fins: false, tall: false, stages: false, shield: false },
  seen: { fins: true, tall: true, stages: true, shield: true },
  config: { nose: 'capsule', tank: 'short', engine: 'small', fins: true, stages: 1, shield: true },
  nums: false, sound: true, best: 0, flights: 0, warp: 10,
};
function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return structuredClone(DEFAULT_SAVE);
    const s = JSON.parse(raw);
    const out = structuredClone(DEFAULT_SAVE);
    for (const k of Object.keys(out)) if (s[k] !== undefined && s[k] !== null) out[k] = (typeof out[k] === 'object') ? { ...out[k], ...s[k] } : s[k];
    // v1 -> v2: whoever reached space gets stages (a booster goes on right away); whoever went around gets the shield
    if (!s.v || s.v < 2) {
      if (out.reached.space) { out.unlocked.tall = true; out.unlocked.stages = true; out.seen.stages = false; out.config.stages = 2; }
      if (out.reached.orbit) { out.unlocked.shield = true; out.seen.shield = false; out.config.shield = true; }
      out.v = 2;
    }
    if (!['short', 'medium', 'tall'].includes(out.config.tank) || (out.config.tank === 'tall' && !out.unlocked.tall)) out.config.tank = 'short';
    if (!NOSES[out.config.nose]) out.config.nose = 'capsule';
    if (!['small', 'big'].includes(out.config.engine)) out.config.engine = 'small';
    if (out.config.stages !== 2 || !out.unlocked.stages) out.config.stages = out.unlocked.stages && out.config.stages === 2 ? 2 : 1;
    if (!WARPS.includes(out.warp)) out.warp = 10;
    return out;
  } catch (e) { return structuredClone(DEFAULT_SAVE); }
}
let save = loadSave();
function writeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* private mode: play on */ } }
writeSave();
function currentGoal() { return GOALS.find(g => !save.reached[g.id]) || null; }

// ---------------------------------------------------------------- dom
const $ = id => document.getElementById(id);
const canvas = $('c');
const ui = {
  goalText: $('goalText'), hangar: $('hangarUI'), flight: $('flightUI'), parts: $('parts'),
  vNose: $('vNose'), vTank: $('vTank'), vEngine: $('vEngine'), vFins: $('vFins'), pFins: $('pFins'),
  pStages: $('pStages'), vStages: $('vStages'), newStages: $('newStages'),
  pShield: $('pShield'), vShield: $('vShield'), newShield: $('newShield'),
  newFins: $('newFins'), newTank: $('newTank'), tip: $('hangarTip'),
  fuelTrack: $('fuelTrack'), prog: $('prog'), progFill: $('progFill'), progDot: $('progDot'), progGoal: $('progGoal'),
  leanTrack: $('leanTrack'), leanThumb: $('leanThumb'), leanGhost: $('leanGhost'), leanHint: $('leanHint'),
  act: $('btnAct'), warp: $('btnWarp'), ff: $('ff'), mini: $('mini'), heatGlow: $('heatGlow'),
  toast: $('toast'), nums: $('nums'), btnNums: $('btnNums'), btnSound: $('btnSound'),
  card: $('card'), cardArt: $('cardArt'), cardTitle: $('cardTitle'), cardText: $('cardText'),
  cardUnlock: $('cardUnlock'), cardNext: $('cardNext'), cardBtn: $('cardBtn'), cardBtn2: $('cardBtn2'),
  mapWrap: $('mapWrap'), map: $('map'), mapCap: $('mapCap'), loading: $('loading'),
};

// ---------------------------------------------------------------- renderer
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  ui.loading.querySelector('p').textContent = 'This browser cannot show 3D right now. Try Safari or Chrome.';
  throw e;
}
let dpr = Math.min(window.devicePixelRatio || 1, 2);
renderer.setPixelRatio(dpr);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(52, 1, 0.5, 40000);

// Sun: behind the camera's side and a little to the left, so the rocket is lit from the front.
const SUN = new THREE.Vector3(-0.45, 0.62, 0.64).normalize();
const SITE = new THREE.Vector3(0, 1, 0);

const sunLight = new THREE.DirectionalLight(0xfff3e2, 3.0);
scene.add(sunLight, sunLight.target);
const hemi = new THREE.HemisphereLight(0x9cc4ff, 0x4a4a32, 1.1);
scene.add(hemi);

// soft sky environment for the metal and paint (generated once, tiny)
{
  const envScene = new THREE.Scene();
  const g = new THREE.SphereGeometry(10, 32, 16);
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `varying vec3 vP; void main(){ float y = normalize(vP).y;
      vec3 sky = mix(vec3(0.75,0.85,1.0), vec3(0.25,0.45,0.85), smoothstep(0.0,0.8,y));
      vec3 gnd = mix(vec3(0.35,0.33,0.25), vec3(0.15,0.17,0.1), smoothstep(0.0,-0.6,y));
      gl_FragColor = vec4(y>0.0 ? sky : gnd, 1.0); }`,
  });
  envScene.add(new THREE.Mesh(g, m));
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(envScene, 0.02).texture;
  pm.dispose(); g.dispose(); m.dispose();
}

// ---------------------------------------------------------------- sky, planet, air, clouds, stars (one full-screen pass)
const skyMat = new THREE.ShaderMaterial({
  depthTest: false, depthWrite: false,
  uniforms: {
    uUp: { value: new THREE.Vector3(0, 1, 0) }, uCamR: { value: R + 10 }, uCamAlt: { value: 10 },
    uSun: { value: SUN }, uSite: { value: SITE }, uTime: { value: 0 }, uStar: { value: 420 },
    uInvProj: { value: new THREE.Matrix4() }, uCamRot: { value: new THREE.Matrix4() },
  },
  vertexShader: /* glsl */`
    uniform mat4 uInvProj; uniform mat4 uCamRot; varying vec3 vDir;
    void main(){ vec4 p = vec4(position.xy, 1.0, 1.0); vec4 v = uInvProj * p; v /= v.w;
      vDir = (uCamRot * vec4(v.xyz, 0.0)).xyz; gl_Position = vec4(position.xy, 1.0, 1.0); }`,
  fragmentShader: /* glsl */`
    precision highp float;
    varying vec3 vDir;
    uniform vec3 uUp; uniform float uCamR; uniform float uCamAlt; uniform vec3 uSun; uniform vec3 uSite;
    uniform float uTime; uniform float uStar;
    #define PR 600000.0
    #define AT 80000.0
    #define HR 6500.0
    #define HM 1200.0
    #define CLOUD_H 2300.0
    const vec3 BR = vec3(5.8e-6, 13.5e-6, 33.1e-6) * 1.05;
    const float BM = 2.5e-6;
    const vec3 SUNC = vec3(1.0, 0.96, 0.9) * 20.0;

    float hash13(vec3 p3){ p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
    float vnoise(vec3 p){ vec3 i = floor(p); vec3 f = fract(p); f = f*f*(3.0-2.0*f);
      float a = hash13(i), b = hash13(i+vec3(1,0,0)), c = hash13(i+vec3(0,1,0)), d = hash13(i+vec3(1,1,0));
      float e = hash13(i+vec3(0,0,1)), g = hash13(i+vec3(1,0,1)), h = hash13(i+vec3(0,1,1)), k = hash13(i+vec3(1,1,1));
      return mix(mix(mix(a,b,f.x), mix(c,d,f.x), f.y), mix(mix(e,g,f.x), mix(h,k,f.x), f.y), f.z); }
    float fbm(vec3 p, int oct){ float a = 0.5, s = 0.0;
      for (int i = 0; i < 6; i++){ if (i >= oct) break; s += a * vnoise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; }
      return s; }

    float airmass(float mu){ mu = clamp(mu, 0.0, 1.0); float z = degrees(acos(mu));
      return 1.0 / (mu + 0.50572 * pow(max(96.07995 - z, 0.01), -1.6364)); }
    // optical depth toward the sun from a point (unit normal np, altitude h); huge if the planet blocks the sun
    vec2 lightDepth(vec3 np, float h){
      float r = PR + h; float dip = sqrt(max(h * (2.0 * PR + h), 0.0)) / r;
      float m = dot(np, uSun) + dip;
      if (m < -0.02) return vec2(1e9);
      return vec2(HR * exp(-h / HR), HM * exp(-h / HM)) * airmass(max(m, 0.0));
    }

    vec3 ground(vec3 n, float dist, out float ocean){
      float c = fbm(n * 2.6 + vec3(3.1, 1.7, 5.2), 5);
      float sd = length(n - uSite) * PR;                 // metres from the launch pad
      float c0 = c;
      c = max(c, mix(c, 0.56, exp(-pow(sd / 90000.0, 2.0))));   // the pad always sits on green land
      float land = smoothstep(0.5, 0.512, c);
      ocean = 1.0 - land;
      float m = fbm(n * 32.0 + vec3(7.0), 3);
      vec3 green = vec3(0.08, 0.16, 0.045), dry = vec3(0.22, 0.19, 0.11), rock = vec3(0.17, 0.16, 0.15);
      vec3 l = mix(green, dry, smoothstep(0.5, 0.75, m));
      l = mix(l, rock, smoothstep(0.62, 0.74, c0) * (1.0 - exp(-pow(sd / 60000.0, 2.0))));
      float lat = abs(dot(n, normalize(vec3(0.25, 0.3, 1.0))));
      l = mix(l, vec3(0.75), smoothstep(0.84, 0.9, lat + (m - 0.5) * 0.15));
      float fine = 1.0 - smoothstep(2000.0, 30000.0, dist);
      if (fine > 0.0){
        float dn = fbm(n * 5000.0, 2);
        l *= mix(1.0, 0.7 + 0.6 * dn, fine);
        float ff = 1.0 - smoothstep(60.0, 1500.0, dist);
        if (ff > 0.0) l *= mix(1.0, 0.82 + 0.36 * vnoise(n * 120000.0), ff);
      }
      l = mix(l, vec3(0.30, 0.29, 0.27), 1.0 - smoothstep(22.0, 30.0, sd));   // concrete apron
      l = mix(l, vec3(0.14, 0.13, 0.12), 1.0 - smoothstep(6.0, 9.0, abs(sd - 90.0)) ); // ring road
      vec3 sea = mix(vec3(0.008, 0.03, 0.07), vec3(0.02, 0.08, 0.11), smoothstep(0.44, 0.5, c));
      return mix(sea, l, land);
    }

    void main(){
      vec3 d = normalize(vDir);
      float b = uCamR * dot(uUp, d);
      // planet surface
      float cG = uCamAlt * (2.0 * PR + uCamAlt);
      float discG = b * b - cG;
      float tG = -1.0;
      if (b < 0.0 && discG > 0.0) tG = cG / (-b + sqrt(discG));
      // air shell
      float cA = (uCamR - PR - AT) * (uCamR + PR + AT);
      float discA = b * b - cA;
      float t0 = 0.0, t1 = 0.0;
      if (discA > 0.0){
        float sq = sqrt(discA);
        if (cA < 0.0){ t0 = 0.0; t1 = b > 0.0 ? (-cA) / (b + sq) : (-b + sq); }
        else if (b < 0.0){ t0 = cA / (-b + sq); t1 = -b + sq; }
      }
      if (tG > 0.0) t1 = min(t1, tG);

      vec3 sumR = vec3(0.0), sumM = vec3(0.0); float odR = 0.0, odM = 0.0;
      if (t1 > t0){
        float ds = (t1 - t0) / 12.0;
        for (int i = 0; i < 12; i++){
          float t = t0 + ds * (float(i) + 0.5);
          vec3 p = uUp * uCamR + d * t; float r = length(p); float h = max(r - PR, 0.0); vec3 np = p / r;
          float dR = exp(-h / HR) * ds, dM = exp(-h / HM) * ds;
          odR += dR * 0.5; odM += dM * 0.5;
          vec2 ld = lightDepth(np, h);
          vec3 att = exp(-(BR * (odR + ld.x) + BM * 1.1 * (odM + ld.y)));
          sumR += dR * att; sumM += dM * att;
          odR += dR * 0.5; odM += dM * 0.5;
        }
      }
      vec3 T = exp(-(BR * odR + BM * 1.1 * odM));
      float mu = dot(d, uSun);
      float pR = 0.0596831 * (1.0 + mu * mu);
      float g = 0.76; float g2 = g * g;
      float pM = 0.1193662 * ((1.0 - g2) * (1.0 + mu * mu)) / ((2.0 + g2) * pow(1.0 + g2 - 2.0 * g * mu, 1.5));
      vec3 inscatter = SUNC * (sumR * BR * pR + sumM * BM * pM);

      vec3 col;
      if (tG > 0.0){
        vec3 n = normalize(uUp * uCamR + d * tG);
        float ocean; vec3 alb = ground(n, tG, ocean);
        vec2 ld = lightDepth(n, 0.0);
        vec3 sunT = exp(-(BR * ld.x + BM * 1.1 * ld.y));
        float ndl = max(dot(n, uSun), 0.0);
        vec3 amb = vec3(0.35, 0.5, 0.8) * 0.5 * smoothstep(-0.15, 0.4, dot(n, uSun));
        col = alb * (SUNC * sunT * ndl / 3.14159 + amb + vec3(0.05, 0.07, 0.13));   // a little moonlight on the night side
        col += ocean * SUNC * sunT * 0.35 * pow(max(dot(reflect(d, n), uSun), 0.0), 220.0);
        col = col * T + inscatter;
      } else {
        col = inscatter;
        // stars, fading out where the sky is bright
        vec3 sd = d * uStar; vec3 cell = floor(sd); float hs = hash13(cell);
        if (hs > 0.9965){
          vec3 cen = cell + 0.5 + (vec3(hash13(cell + 1.3), hash13(cell + 2.7), hash13(cell + 5.1)) - 0.5) * 0.5;
          float s = smoothstep(0.32, 0.0, length(sd - cen)) * (0.4 + (hs - 0.9965) * 300.0);
          float sky = dot(inscatter, vec3(0.3, 0.5, 0.2));
          col += vec3(0.9, 0.95, 1.0) * s * T * (1.0 - smoothstep(0.01, 0.12, sky));
        }
        // the sun
        col += T * SUNC * (smoothstep(0.99975, 0.9999, mu) * 6.0 + pow(max(mu, 0.0), 900.0) * 0.6);
      }

      // the cloud layer (thin shell at 2.3 km)
      float cC = (uCamAlt - CLOUD_H) * (2.0 * PR + uCamAlt + CLOUD_H);
      float discC = b * b - cC;
      if (discC > 0.0){
        float sq = sqrt(discC); float tc = -1.0;
        if (cC < 0.0) tc = b > 0.0 ? (-cC) / (b + sq) : (-b + sq);
        else if (b < 0.0) tc = cC / (-b + sq);
        if (tc > 0.0 && (tG < 0.0 || tc < tG)){
          vec3 nc = normalize(uUp * uCamR + d * tc);
          float cov = fbm(nc * 150.0 + vec3(uTime * 0.0004, 0.0, 0.0), 4) + 0.35 * fbm(nc * 1300.0, 2) - 0.17;
          float near = exp(-pow(length(nc - uSite) * PR / 5000.0, 2.0));
          float a = smoothstep(0.42, 0.62, cov + near * 0.12);
          a *= 1.0 - smoothstep(60000.0, 260000.0, tc);
          vec2 ldc = lightDepth(nc, CLOUD_H);
          vec3 sT = exp(-(BR * ldc.x + BM * ldc.y));
          float lit = max(dot(nc, uSun), 0.0);
          float under = cC < 0.0 ? 0.62 : 1.0;
          vec3 cc = SUNC * sT * (0.12 + 0.2 * lit) * under * (0.85 + 0.3 * cov) + vec3(0.25, 0.33, 0.45) * 0.6 * lit;
          float k = t1 > 0.0 ? clamp(tc / t1, 0.0, 1.0) : 0.0;
          vec3 Tc = pow(T, vec3(k));
          col = mix(col, cc * Tc + inscatter * k, a);
        }
      }

      col = 1.0 - exp(-col * 1.05);
      col = pow(col, vec3(1.0 / 2.2));
      col += (hash13(vec3(gl_FragCoord.xy, uTime)) - 0.5) / 255.0;
      gl_FragColor = vec4(col, 1.0);
    }`,
});
const skyQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), skyMat);
skyQuad.frustumCulled = false; skyQuad.renderOrder = -1000;
scene.add(skyQuad);

// ---------------------------------------------------------------- materials + textures
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function tankTexture(heightM, booster) {
  const w = 512, h = Math.max(128, Math.round(512 * heightM / (2 * Math.PI * 1.25)));
  return canvasTex(w, h, (g) => {
    g.fillStyle = '#ecebe6'; g.fillRect(0, 0, w, h);
    // panel seams
    g.strokeStyle = 'rgba(40,40,40,.10)'; g.lineWidth = 2;
    for (let y = 32; y < h; y += 52) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    for (let x = 0; x < w; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    // subtle grime toward the bottom
    const gr = g.createLinearGradient(0, h * 0.6, 0, h); gr.addColorStop(0, 'rgba(90,80,60,0)'); gr.addColorStop(1, 'rgba(90,80,60,.16)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    // orange band near the top + roll pattern at the bottom
    g.fillStyle = booster ? '#2b2f36' : '#e8742c'; g.fillRect(0, 14, w, 16);
    if (booster) { g.fillStyle = '#1d1f22'; for (let x = 0; x < w; x += w / 4) g.fillRect(x, h * 0.42, w / 8, h * 0.06); }
    g.fillStyle = '#1d1f22';
    const bandY = h - 46; g.fillRect(0, bandY, w / 4, 30); g.fillRect(w / 2, bandY, w / 4, 30);
    // name down the side (faces the camera)
    g.save(); g.translate(w * 0.5, h * 0.5); g.rotate(-Math.PI / 2);
    g.fillStyle = '#2b2f36'; g.font = `700 ${Math.min(44, h * 0.09)}px "Bricolage Grotesque", "Trebuchet MS", sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (h > 160) g.fillText('HEARTBEAT', 0, 0);
    g.restore();
  });
}
const M = {
  white: new THREE.MeshStandardMaterial({ color: 0xf1efe9, roughness: 0.42, metalness: 0.05 }),
  shield: new THREE.MeshStandardMaterial({ color: 0x3a2e25, roughness: 0.85, metalness: 0.1 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x2b2d31, roughness: 0.45, metalness: 0.7 }),
  metal: new THREE.MeshStandardMaterial({ color: 0xa6abb2, roughness: 0.32, metalness: 0.9 }),
  bell: new THREE.MeshStandardMaterial({ color: 0x5b4b40, roughness: 0.38, metalness: 0.9, side: THREE.DoubleSide }),
  orange: new THREE.MeshStandardMaterial({ color: 0xe0692a, roughness: 0.5, metalness: 0.1 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x0c141c, roughness: 0.06, metalness: 0.95 }),
  concrete: new THREE.MeshStandardMaterial({ color: 0x6e6b65, roughness: 0.95, metalness: 0 }),
  steel: new THREE.MeshStandardMaterial({ color: 0xb24a2a, roughness: 0.6, metalness: 0.5 }),
  trench: new THREE.MeshStandardMaterial({ color: 0x1c1b1a, roughness: 1, metalness: 0 }),
  heat: new THREE.MeshStandardMaterial({ color: 0x2c211a, roughness: 0.9, metalness: 0.05, emissive: 0x000000 }),
  inter: new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.5, metalness: 0.6, side: THREE.DoubleSide }),
};
const tankTex = {}; for (const k of Object.keys(TANKS)) tankTex[k] = tankTexture(TANKS[k].h, k === 'booster');
const tankMats = {}; for (const k of Object.keys(TANKS)) tankMats[k] = new THREE.MeshStandardMaterial({ map: tankTex[k], roughness: 0.42, metalness: 0.05 });
const stdMats = [...Object.values(M), ...Object.values(tankMats)];

// ---------------------------------------------------------------- the rocket model (a stack: booster, upper stage, capsule)
const rocket = new THREE.Group(); scene.add(rocket);
const rocketBody = new THREE.Group(); rocket.add(rocketBody);
let rocketDims = { height: 10, bellR: 0.7, top: 10 };
const stackG = { booster: null, upper: null, caps: null, boosterH: 0, upperH: 0, capsH: 0 };

function lathe(points, segs = 40) { return new THREE.LatheGeometry(points.map(p => new THREE.Vector2(p[0], p[1])), segs); }
function bellGeometry(rExit, h) {
  const pts = []; const rThroat = rExit * 0.34;
  for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push([rThroat + (rExit - rThroat) * Math.pow(t, 1.7), h * (1 - t)]); }
  return lathe(pts, 36);
}
function finGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.lineTo(1.15, -0.55); s.lineTo(1.2, 0.25); s.lineTo(0, 1.9); s.lineTo(0, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 });
  g.translate(0, 0, -0.035); return g;
}
const geoCache = {};
function cached(key, make) { return geoCache[key] || (geoCache[key] = make()); }

// one tank + engine pair, its bell tip at y = 0. Returns its height.
function buildStageModel(g, tankKey, engKey, finsOn) {
  const E = ENGINES[engKey], T = TANKS[tankKey];
  let y = 0;
  if (E.cluster) {
    for (let i = 0; i < E.cluster; i++) {
      const a = i / E.cluster * Math.PI * 2 + Math.PI / 2;
      const b = new THREE.Mesh(cached('bell' + engKey, () => bellGeometry(E.bellR, E.bellH)), M.bell);
      b.position.set(Math.cos(a) * 0.62, 0, Math.sin(a) * 0.62); g.add(b);
    }
  } else {
    g.add(new THREE.Mesh(cached('bell' + engKey, () => bellGeometry(E.bellR, E.bellH)), M.bell));
  }
  y = E.bellH;
  const mount = new THREE.Mesh(cached('mount' + engKey, () => new THREE.CylinderGeometry(1.2, E.cluster ? 1.05 : E.bellR * 0.5, 0.55, 32)), M.dark);
  mount.position.y = y + 0.27; g.add(mount);
  if (engKey === 'big') {
    const pump = new THREE.Mesh(cached('pump', () => new THREE.CylinderGeometry(0.16, 0.16, 0.7, 12)), M.metal);
    pump.position.set(0.55, y + 0.05, 0.25); g.add(pump);
    const pump2 = pump.clone(); pump2.position.set(-0.5, y + 0.05, -0.3); g.add(pump2);
  }
  y += 0.55;
  const ring = cached('ring', () => new THREE.CylinderGeometry(1.29, 1.29, 0.16, 40));
  const r1 = new THREE.Mesh(ring, M.dark); r1.position.y = y + 0.08; g.add(r1); y += 0.16;
  const tank = new THREE.Mesh(cached('tank' + tankKey, () => new THREE.CylinderGeometry(1.25, 1.25, T.h, 48, 1, true)), tankMats[tankKey]);
  tank.rotation.y = Math.PI; tank.position.y = y + T.h / 2; g.add(tank);
  if (finsOn) {
    const fg = cached('fin', finGeometry);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4;
      const f = new THREE.Mesh(fg, M.orange);
      f.position.set(Math.sin(a) * 1.22, y - 0.6, Math.cos(a) * 1.22);
      f.rotation.y = a - Math.PI / 2; g.add(f);
    }
  }
  y += T.h;
  const r2 = new THREE.Mesh(ring, M.dark); r2.position.y = y + 0.08; g.add(r2); y += 0.16;
  return y;
}
// capsule or pointy nose, with the heat shield under it when it is on. Bottom at y = 0. Returns its height.
function buildCapsule(g, noseKey, shieldOn) {
  let y = 0;
  if (shieldOn) {
    const sh = new THREE.Mesh(cached('heatshield', () => new THREE.CylinderGeometry(1.33, 1.24, 0.38, 44)), M.heat);
    sh.position.y = 0.19; g.add(sh);
    y = 0.38;
  }
  if (noseKey === 'capsule') {
    const cap = new THREE.Mesh(cached('capsule', () => lathe([[1.27, 0], [1.29, 0.1], [1.2, 0.3], [0.95, 1.0], [0.64, 1.7], [0.5, 1.95], [0.48, 2.25], [0.4, 2.33], [0, 2.35]], 48)), M.white);
    cap.position.y = y; g.add(cap);
    if (!shieldOn) {
      const sh = new THREE.Mesh(cached('shield', () => new THREE.CylinderGeometry(1.3, 1.28, 0.12, 40)), M.shield);
      sh.position.y = y + 0.06; g.add(sh);
    }
    const win = new THREE.Mesh(cached('win', () => new THREE.CircleGeometry(0.2, 24)), M.glass);
    win.position.set(0, y + 1.15, 0.86); win.rotation.x = -0.42; g.add(win);
    const win2 = win.clone(); win2.position.set(0.62, y + 0.95, 0.68); win2.rotation.set(-0.3, 0.75, 0); win2.scale.setScalar(0.7); g.add(win2);
    y += 2.35;
  } else {
    const pts = []; const L = 3.5;
    for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push([1.26 * Math.pow(1 - Math.pow(t, 1.9), 0.62), t * L]); }
    pts.push([0, L]);
    const cone = new THREE.Mesh(cached('pointy', () => lathe(pts, 48)), M.white);
    cone.position.y = y; g.add(cone);
    const win = new THREE.Mesh(cached('win', () => new THREE.CircleGeometry(0.2, 24)), M.glass);
    win.position.set(0, y + 1.25, 0.98); win.rotation.x = -0.35; win.scale.setScalar(0.85); g.add(win);
    const tip = new THREE.Mesh(cached('tip', () => new THREE.SphereGeometry(0.09, 12, 8)), M.dark);
    tip.position.y = y + L; g.add(tip);
    y += L;
  }
  return y;
}
// cfg: { nose, tank, engine, fins, shield, stages }
function buildRocket(cfg) {
  while (rocketBody.children.length) rocketBody.remove(rocketBody.children[0]);
  rocketBody.position.set(0, 0, 0);
  clearDebris();
  let y = 0;
  stackG.booster = null; stackG.boosterH = 0;
  if (cfg.stages === 2) {
    const bg = new THREE.Group();
    const bh = buildStageModel(bg, 'booster', 'booster', cfg.fins);
    // a dark ring (the interstage) hides the upper engine until the booster drops away
    const E = ENGINES[cfg.engine], ih = E.bellH + 0.55;
    const inter = new THREE.Mesh(cached('inter' + cfg.engine, () => new THREE.CylinderGeometry(1.27, 1.27, ih, 44, 1, true)), M.inter);
    inter.position.y = bh + ih / 2; bg.add(inter);
    rocketBody.add(bg); stackG.booster = bg; stackG.boosterH = bh; y = bh;
  }
  const ug = new THREE.Group();
  const uh = buildStageModel(ug, cfg.tank, cfg.engine, cfg.fins && cfg.stages !== 2);
  ug.position.y = y; rocketBody.add(ug); stackG.upper = ug; stackG.upperH = uh; y += uh;
  const cg = new THREE.Group();
  const ch = buildCapsule(cg, cfg.nose, cfg.shield);
  cg.position.y = y; rocketBody.add(cg); stackG.caps = cg; stackG.capsH = ch; y += ch;
  rocketDims = { height: y, bellR: cfg.stages === 2 ? 1.25 : ENGINES[cfg.engine].bellR, top: y };
  chute.position.y = y;
}
// after a stage drops: the stack is shorter and the rocket's base moves up
function shiftStack(h, bellR) {
  rocketBody.position.y -= h;
  rocketDims = { height: rocketDims.height - h, bellR, top: rocketDims.top - h };
  chute.position.y = rocketDims.top;
}

// pieces that fell off (spent stages), flying on their own for a while
const debris = [];
function shed(group, x, y, f, push) {
  const holder = new THREE.Group();
  group.position.set(0, 0, 0); holder.add(group); scene.add(holder);
  const dx = Math.sin(f.heading), dy = Math.cos(f.heading);
  debris.push({ g: holder, x, y, vx: f.vx - dx * push, vy: f.vy - dy * push, heading: f.heading, spin: (Math.random() < 0.5 ? -1 : 1) * (0.25 + Math.random() * 0.25), t: 0 });
  // a puff where they came apart
  for (let i = 0; i < 14; i++) {
    const a = Math.random() * Math.PI * 2;
    spawnSmoke(x + dx * 0.5, y + dy * 0.5, Math.sin(a) * 1.4, f.vx + Math.cos(a) * 4, f.vy + Math.sin(a) * 4, (Math.random() - 0.5) * 4,
      1.5 + Math.random(), 1.2, 5 + Math.random() * 3, 0.45, 0);
  }
}
function updateDebris(dt) {
  for (let i = debris.length - 1; i >= 0; i--) {
    const d = debris[i]; d.t += dt;
    const r = Math.hypot(d.x, d.y), h = r - R;
    if (d.t > 90 || h < 0) { scene.remove(d.g); debris.splice(i, 1); continue; }
    const rho = h < ATM_TOP ? 1.225 * Math.exp(-h / 5600) : 0, v = Math.hypot(d.vx, d.vy);
    const g = 9.81 * R * R / (r * r * r), drag = rho * v * 0.5 * 4 / 2500;
    const steps = Math.max(1, Math.ceil(dt / 0.05)), s = dt / steps;
    for (let k = 0; k < steps; k++) { d.vx += (-g * d.x - drag * d.vx) * s; d.vy += (-g * d.y - drag * d.vy) * s; d.x += d.vx * s; d.y += d.vy * s; }
    d.heading += d.spin * dt;
    d.g.position.set(d.x, d.y, 0);
    d.g.quaternion.setFromUnitVectors(Y, tmpDir.set(Math.sin(d.heading), Math.cos(d.heading), 0));
    d.g.visible = !F || Math.hypot(d.x - F.x, d.y - F.y) < 25000;
  }
}
function clearDebris() { for (const d of debris) scene.remove(d.g); debris.length = 0; }
const tmpDir = new THREE.Vector3();

// parachute (canopy + lines), hidden until opened
const chute = new THREE.Group(); rocket.add(chute);
{
  const tex = canvasTex(256, 32, (g, w, h) => { for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#f6f2ea' : '#e8642a'; g.fillRect(i * w / 16, 0, w / 16 + 1, h); } });
  const pts = []; for (let i = 0; i <= 10; i++) { const a = i / 10 * Math.PI * 0.42; pts.push(new THREE.Vector2(Math.sin(a) * 7.5, Math.cos(a) * 3.2)); }
  const canopy = new THREE.Mesh(new THREE.LatheGeometry(pts.reverse(), 16),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, side: THREE.DoubleSide }));
  canopy.position.y = 13; chute.add(canopy);
  const lp = [];
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; lp.push(0, 0, 0, Math.sin(a) * 7.0, 13 + 3.2 * Math.cos(0.42 * Math.PI) , Math.cos(a) * 7.0); }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
  chute.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0xd8d2c4, transparent: true, opacity: 0.7 })));
  chute.visible = false;
  stdMats.push(canopy.material);
}

// exhaust flame (two additive cones)
const flameMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uTime: { value: 0 }, uPower: { value: 0 }, uVac: { value: 0 }, uCore: { value: 1 } },
  vertexShader: /* glsl */`
    varying float vY; varying vec3 vN; varying vec3 vV;
    void main(){ vY = -position.y; vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: /* glsl */`
    varying float vY; varying vec3 vN; varying vec3 vV;
    uniform float uTime; uniform float uPower; uniform float uVac; uniform float uCore;
    float h(float n){ return fract(sin(n) * 43758.5453); }
    void main(){
      float edge = pow(abs(dot(vN, vV)), 1.6);
      float flick = 0.85 + 0.15 * sin(uTime * 60.0 + vY * 9.0) + 0.1 * sin(uTime * 37.0 - vY * 21.0);
      float fall = pow(clamp(1.0 - vY, 0.0, 1.0), mix(1.4, 2.6, uVac));
      vec3 hot = mix(vec3(1.0, 0.95, 0.8), vec3(1.0, 0.55, 0.15), smoothstep(0.0, 0.5, vY));
      hot = mix(hot, vec3(0.55, 0.65, 1.0), uVac * 0.55 * smoothstep(0.1, 0.8, vY));
      float a = edge * fall * flick * uPower * mix(1.0, 0.55, uVac) * uCore;
      gl_FragColor = vec4(hot * a * 1.6, a);
    }`,
});
const flameGeo = new THREE.CylinderGeometry(1, 0.35, 1, 28, 6, true); flameGeo.translate(0, -0.5, 0);
const flameOuter = new THREE.Mesh(flameGeo, flameMat);
const flameCoreMat = flameMat.clone(); flameCoreMat.uniforms = THREE.UniformsUtils.clone(flameMat.uniforms); flameCoreMat.uniforms.uCore.value = 1.4;
const flameCore = new THREE.Mesh(flameGeo, flameCoreMat);
rocket.add(flameOuter, flameCore);
const engineLight = new THREE.PointLight(0xff9a4a, 0, 80, 1.6); engineLight.position.y = -3; rocket.add(engineLight);

// reentry plasma: a glowing cap on the front and a long hot tail behind, both along the way you are moving
const plasmaMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  uniforms: { uTime: { value: 0 }, uP: { value: 0 } },
  vertexShader: /* glsl */`
    varying float vY; varying vec3 vN; varying vec3 vV; varying float vA;
    void main(){ vY = -position.y; vA = atan(position.z, position.x); vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: /* glsl */`
    varying float vY; varying vec3 vN; varying vec3 vV; varying float vA;
    uniform float uTime; uniform float uP;
    void main(){
      float edge = 0.5 + 0.5 * pow(1.0 - abs(dot(vN, vV)), 1.2);
      float streak = 0.65 + 0.35 * sin(vA * 9.0 + vY * 14.0 - uTime * 40.0) * sin(vA * 5.0 - uTime * 23.0);
      float fall = pow(clamp(1.0 - vY, 0.0, 1.0), 1.7);
      vec3 c = mix(vec3(1.0, 0.92, 0.75), vec3(1.0, 0.36, 0.12), smoothstep(0.0, 0.45, vY));
      c = mix(c, vec3(0.95, 0.3, 0.55), smoothstep(0.45, 1.0, vY) * 0.6);
      float a = edge * fall * streak * uP;
      gl_FragColor = vec4(c * a * 2.2, 1.0);   // additive: the colour itself is the light
    }`,
});
const plasma = new THREE.Group(); scene.add(plasma);
const plasmaTail = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.55, 1, 32, 8, true).translate(0, -0.5, 0), plasmaMat);
const plasmaBow = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), plasmaMat);
plasma.add(plasmaTail, plasmaBow); plasma.visible = false;

// ---------------------------------------------------------------- launch pad
const pad = new THREE.Group(); scene.add(pad);
{
  const slab = new THREE.Mesh(new THREE.CylinderGeometry(SITE_R, SITE_R + 2.5, PAD_H + 0.6, 40), M.concrete);
  slab.position.y = (PAD_H - 0.6) / 2 - 0.0; pad.add(slab);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(2.0, 24), M.trench); hole.rotation.x = -Math.PI / 2; hole.position.y = PAD_H + 0.01; pad.add(hole);
  // launch tower truss (one instanced draw)
  const beam = new THREE.BoxGeometry(1, 1, 1);
  const beams = [];
  const tx = -5.2, tz = -1.0, w = 2.2, H = 26;
  const post = (x, z) => beams.push({ p: [x, PAD_H + H / 2, z], s: [0.22, H, 0.22], r: 0 });
  post(tx - w / 2, tz - w / 2); post(tx + w / 2, tz - w / 2); post(tx - w / 2, tz + w / 2); post(tx + w / 2, tz + w / 2);
  for (let yy = PAD_H + 2; yy < PAD_H + H; yy += 2.6) {
    beams.push({ p: [tx, yy, tz - w / 2], s: [w, 0.14, 0.14], r: 0 }, { p: [tx, yy, tz + w / 2], s: [w, 0.14, 0.14], r: 0 });
    beams.push({ p: [tx - w / 2, yy, tz], s: [0.14, 0.14, w], r: 0 }, { p: [tx + w / 2, yy, tz], s: [0.14, 0.14, w], r: 0 });
    beams.push({ p: [tx, yy + 1.3, tz + w / 2], s: [Math.hypot(w, 2.6), 0.1, 0.1], r: Math.atan2(2.6, w) });
  }
  for (const [yy, len] of [[PAD_H + 7, 3.4], [PAD_H + 13, 3.4]]) beams.push({ p: [tx + w / 2 + len / 2, yy, tz + 0.6], s: [len, 0.35, 0.6], r: 0 });
  const inst = new THREE.InstancedMesh(beam, M.steel, beams.length);
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  beams.forEach((bm, i) => { e.set(0, 0, bm.r); q.setFromEuler(e); mtx.compose(new THREE.Vector3(...bm.p), q, new THREE.Vector3(...bm.s)); inst.setMatrixAt(i, mtx); });
  pad.add(inst);
  const light = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 16, 8), M.metal);
  light.position.set(10, PAD_H + 8, -6); pad.add(light);
  const l2 = light.clone(); l2.position.set(-11, PAD_H + 8, 7); pad.add(l2);
  pad.position.set(0, R, 0);
}

// ---------------------------------------------------------------- billboards (smoke + cloud puffs)
function makeBillboards(max, colors) {
  const base = new THREE.PlaneGeometry(1, 1);
  const g = new THREE.InstancedBufferGeometry();
  g.index = base.index; g.setAttribute('position', base.getAttribute('position'));
  const off = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3); off.setUsage(THREE.DynamicDrawUsage);
  const dat = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4); dat.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('iOff', off); g.setAttribute('iDat', dat); g.instanceCount = 0;
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uLit: { value: new THREE.Color(colors.lit) }, uShade: { value: new THREE.Color(colors.shade) },
      uGlow: { value: new THREE.Color(1.0, 0.55, 0.2) }, uSun2: { value: new THREE.Vector2(0, 1) }, uNear: { value: colors.near } },
    vertexShader: /* glsl */`
      attribute vec3 iOff; attribute vec4 iDat; uniform float uNear;
      varying vec2 vUv; varying vec4 vD; varying float vFade;
      void main(){ vUv = position.xy; vD = iDat;
        vec4 mv = modelViewMatrix * vec4(iOff, 1.0);
        float a = iDat.z * 6.2831; mat2 rot = mat2(cos(a), -sin(a), sin(a), cos(a));
        mv.xy += rot * position.xy * iDat.x;
        vFade = smoothstep(uNear * 0.2, uNear, -mv.z);
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */`
      varying vec2 vUv; varying vec4 vD; varying float vFade;
      uniform vec3 uLit; uniform vec3 uShade; uniform vec3 uGlow; uniform vec2 uSun2;
      float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(h2(i), h2(i+vec2(1,0)), f.x), mix(h2(i+vec2(0,1)), h2(i+vec2(1,1)), f.x), f.y); }
      void main(){
        float r = length(vUv) * 2.0; if (r > 1.0) discard;
        float n = n2(vUv * 4.0 + vD.z * 17.0) * 0.6 + n2(vUv * 9.0 - vD.z * 9.0) * 0.4;
        float a = smoothstep(1.0, 0.25, r + (n - 0.5) * 0.55) * vD.y * vFade;
        float l = clamp(0.62 + 0.45 * dot(vUv * 2.0, uSun2) + (n - 0.5) * 0.3, 0.0, 1.0);
        vec3 c = mix(uShade, uLit, l) + uGlow * vD.w;
        gl_FragColor = vec4(c, a);
      }`,
  });
  const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false;
  return { mesh, off, dat, g, mat, max };
}

// smoke: positions kept in doubles here; drawn relative to an anchor near the rocket
const smoke = makeBillboards(420, { lit: 0xf3efe8, shade: 0x8d8a86, near: 4 });
smoke.mesh.renderOrder = 2; scene.add(smoke.mesh);
const parts = []; // {x,y,z,vx,vy,vz,age,life,s0,s1,a,warm,seed}
function spawnSmoke(x, y, z, vx, vy, vz, life, s0, s1, a, warm) {
  if (parts.length >= smoke.max) parts.shift();
  parts.push({ x, y, z, vx, vy, vz, age: 0, life, s0, s1, a, warm, seed: Math.random() });
}

// cloud puffs around the launch column, so the rocket really flies through the cloud band
const puffs = makeBillboards(70, { lit: 0xffffff, shade: 0xb4bfcc, near: 60 });
puffs.mesh.renderOrder = 1; scene.add(puffs.mesh);
const puffList = [];
{
  let s = 7;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 70; i++) {
    const alt = 1950 + rnd() * 700, x = (rnd() - 0.5) * 1400, z = -40 - rnd() * 700 + (i < 18 ? 700 * rnd() : 0);
    puffList.push({ x, y: R + alt, z: Math.min(z, 260), size: 90 + rnd() * 200, seed: rnd() });
  }
}

// ---------------------------------------------------------------- sound (made in code, no files)
const sound = {
  ctx: null, eng: null, engGain: null, filt: null, master: null,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      const ctx = this.ctx = new AC();
      this.master = ctx.createGain(); this.master.gain.value = save.sound ? 0.8 : 0; this.master.connect(ctx.destination);
      const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      let last = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      this.noise = buf;
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      this.filt = ctx.createBiquadFilter(); this.filt.type = 'lowpass'; this.filt.frequency.value = 500;
      this.engGain = ctx.createGain(); this.engGain.gain.value = 0;
      src.connect(this.filt).connect(this.engGain).connect(this.master); src.start();
    } catch (e) { this.ctx = null; }
  },
  setMuted(m) { if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05); },
  engine(level, air) {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    const v = level * (0.12 + 0.88 * Math.min(1, air * 1.4 + 0.05));
    this.engGain.gain.setTargetAtTime(v * 0.9, t, 0.08);
    this.filt.frequency.setTargetAtTime(220 + 700 * level * (0.3 + 0.7 * air), t, 0.2);
  },
  burst(dur, freq, vol, when = 0) {
    if (!this.ctx) return; const ctx = this.ctx, t = ctx.currentTime + when;
    const s = ctx.createBufferSource(); s.buffer = this.noise;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(this.master); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  },
  cough() { this.burst(0.25, 700, 0.9, 0); this.burst(0.2, 600, 0.6, 0.32); this.burst(0.35, 420, 0.45, 0.62); },
  thud() { this.burst(0.8, 260, 1.2); },
  chime(up = true) {
    if (!this.ctx) return; const ctx = this.ctx; const notes = up ? [523.25, 659.25, 783.99, 1046.5] : [392, 523.25];
    notes.forEach((fq, i) => { const t = ctx.currentTime + i * 0.12; const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = fq;
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.22, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
      o.connect(g).connect(this.master); o.start(t); o.stop(t + 1); });
  },
};

// ---------------------------------------------------------------- game state
let mode = 'hangar';          // hangar | flight | paused (a card over a flight that goes on) | result
let F = null;                 // current flight
let lean = 0;                 // slider -1..1
let simAcc = 0, simSpeed = 1, clock = 0, hangarT = 0;
const camPos = new THREE.Vector3(), camTarget = new THREE.Vector3();
let camSmooth = null;

function cfgFins() { return !!(save.unlocked.fins && save.config.fins); }
function cfgShield() { return !!(save.unlocked.shield && save.config.shield); }
function cfgStages() { return save.unlocked.stages && save.config.stages === 2 ? 2 : 1; }
function flightCfg() {
  const c = save.config;
  return { nose: c.nose, tank: c.tank, engine: c.engine, fins: cfgFins(), shield: cfgShield(), stages: cfgStages(), coastAssist: !!save.unlocked.stages };
}
function newFlight() {
  const f = physicsFlight(flightCfg());
  Object.assign(f, { newGoals: [], endIn: -1, track: [], exploded: false, dropAuto: -1, burnPressed: false, sputter: 0, hint: '' });
  return f;
}
function vRadial(f) { return (f.vx * f.x + f.vy * f.y) / Math.hypot(f.x, f.y); }

function explode(f, hot) {
  f.exploded = true; sound.thud();
  rocket.visible = false; plasma.visible = false;
  const ux = f.x / Math.hypot(f.x, f.y), uy = f.y / Math.hypot(f.x, f.y);
  for (let i = 0; i < 70; i++) {
    const a = Math.random() * Math.PI * 2, sp = 4 + Math.random() * 14, up = 3 + Math.random() * 12;
    const vx0 = hot ? f.vx * 0.4 : 0, vy0 = hot ? f.vy * 0.4 : 0;
    spawnSmoke(f.x + ux * 3, f.y + uy * 3, (Math.random() - 0.5) * 4,
      vx0 + Math.cos(a) * sp * uy + ux * up, vy0 - Math.cos(a) * sp * ux + uy * up, Math.sin(a) * sp,
      3 + Math.random() * 3, 3 + Math.random() * 3, 12 + Math.random() * 10, 0.8, hot ? 2.2 : (i < 30 ? 1.2 : 0.3));
  }
}

// ---------------------------------------------------------------- flight events (from physics, goals, results)
function handleEvents(f) {
  for (const e of f.events) {
    if (e === 'stageEmpty') { f.sputter = 0.9; sound.cough(); f.dropAuto = 5; toast('Bottom tank is empty!', 'Tap Drop stage'); }
    else if (e === 'burnout') { f.sputter = 0.9; sound.cough(); }
    else if (e === 'coast') { sound.chime(false); toast('The top of your path is in space!', 'Engine resting. At the top: lean flat, tap Burn.'); }
    else if (e === 'orbitCut') { sound.burst(0.3, 500, 0.3); }
    else if (e === 'retroDone') { doSeparate(); toast('Heading home!', 'The empty tank lets go. Shield first!'); }
    else if (e === 'retroNoFuel') { toast('Out of fuel!', 'Not enough to slow down, so you keep going around.'); }
    else if (e === 'toasty') { f.endIn = 2.4; explode(f, true); }
    else if (e === 'landed') { f.endIn = 1.4; sound.burst(0.3, 300, 0.4); if (f.wasOrbit && !save.reached.home) reachGoal(f, GOALS[3]); }
    else if (e === 'crash') { f.endIn = 2.0; explode(f, false); }
  }
  f.events.length = 0;
}
function checkGoals(f) {
  for (const g of GOALS) {
    if (g.alt == null || save.reached[g.id] || f.newGoals.includes(g)) continue;
    if (f.maxAlt >= g.alt) reachGoal(f, g);
  }
  if (f.outcome) return;
  if (!f.engineOn && !f.coasting && f.alt > ATM_TOP && orbitInfo(f).escape) { f.outcome = 'escape'; f.endIn = 2.5; return; }
  if (!f.wasOrbit && !f.engineOn && !f.retro && inOrbit(f)) {
    f.wasOrbit = true;
    if (!save.reached.orbit) { reachGoal(f, GOALS[2], true); showOrbitCard(f); }
    else toast('All the way around!', fuelLeft(f) > 0 ? 'Tap Come home when you are ready.' : 'No fuel left to come home. Tap X when you are done.');
  }
}
function reachGoal(f, g, quiet) {
  f.newGoals.push(g);
  save.reached[g.id] = true;
  for (const u of g.unlock) {
    save.unlocked[u] = true; save.seen[u] = false;
    if (u === 'fins') save.config.fins = true;
    if (u === 'stages') save.config.stages = 2;
    if (u === 'shield') save.config.shield = true;
  }
  writeSave();
  sound.chime(true);
  if (!quiet) toast(g.done, g.unlockText);
  setGoalText();
  ui.progGoal.style.backgroundImage = progIcon();
  ui.prog.hidden = !currentGoal() || currentGoal().id === 'home';
}

function finishFlight() {
  const f = F; if (!f) return;
  mode = 'result';
  save.flights++; save.best = Math.max(save.best, f.maxAlt); writeSave();
  showResult(f);
}

const ART = {
  cloud: '<svg viewBox="0 0 120 80"><defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#cfd9e6"/></linearGradient></defs><path d="M30 66c-12 0-20-8-20-18s8-18 19-18c3-12 13-20 26-20 14 0 25 9 27 22 11 0 20 8 20 17s-8 17-19 17z" fill="url(#cg)"/><path d="M60 52 l6 -22 l6 22z" fill="#f07a2e"/></svg>',
  space: '<svg viewBox="0 0 120 90"><circle cx="60" cy="120" r="70" fill="#3d6fb6"/><circle cx="60" cy="120" r="74" fill="none" stroke="#8fc0ff" stroke-opacity=".5" stroke-width="4"/><circle cx="20" cy="18" r="2" fill="#fff"/><circle cx="96" cy="12" r="2.5" fill="#fff"/><circle cx="104" cy="40" r="1.6" fill="#fff"/><circle cx="34" cy="40" r="1.4" fill="#fff"/><path d="M60 10l7 18 19 2-15 12 5 19-16-10-16 10 5-19-15-12 19-2z" fill="#ffd36a"/></svg>',
  orbit: '<svg viewBox="0 0 120 90"><defs><radialGradient id="og" cx=".35" cy=".35"><stop offset="0" stop-color="#6aa2e6"/><stop offset="1" stop-color="#1d3d6e"/></radialGradient></defs><circle cx="60" cy="45" r="24" fill="url(#og)"/><path d="M48 30c6-4 14-3 18 2-4 3-11 4-18-2z" fill="#4e7d3e"/><ellipse cx="60" cy="45" rx="48" ry="34" fill="none" stroke="#7fd69b" stroke-width="3.5"/><path d="M104 36l4 9-9-2z" fill="#7fd69b"/><circle cx="12" cy="45" r="5" fill="#fff"/></svg>',
  chute: '<svg viewBox="0 0 120 90"><path d="M20 40a40 30 0 0 1 80 0z" fill="#e8642a"/><path d="M40 40a20 30 0 0 1 40 0z" fill="#f6f2ea"/><path d="M20 40l36 36M100 40l-36 36M60 40v34" stroke="#d8d2c4" stroke-width="1.5"/><rect x="52" y="72" width="16" height="12" rx="3" fill="#f1efe9"/></svg>',
  puff: '<svg viewBox="0 0 120 90"><circle cx="45" cy="52" r="20" fill="#9a958e"/><circle cx="70" cy="46" r="24" fill="#b9b4ac"/><circle cx="58" cy="62" r="18" fill="#d8d3cb"/><circle cx="84" cy="62" r="13" fill="#a7a29a"/><path d="M28 70l-10 8M96 70l10 8M60 22v-10" stroke="#f0b53a" stroke-width="4" stroke-linecap="round"/></svg>',
  heavy: '<svg viewBox="0 0 120 90"><rect x="30" y="64" width="60" height="10" rx="3" fill="#8d8a83"/><rect x="50" y="18" width="20" height="44" rx="4" fill="#f1efe9"/><path d="M50 18l10-12 10 12z" fill="#f1efe9"/><path d="M38 80q22-14 44 0" stroke="#f0b53a" stroke-width="4" fill="none" stroke-linecap="round"/></svg>',
  toasty: '<svg viewBox="0 0 120 90"><path d="M42 18q-6 8 0 14t0 14M60 12q-6 8 0 14t0 14M78 18q-6 8 0 14t0 14" stroke="#b9b4ac" stroke-width="3" fill="none" stroke-linecap="round" opacity=".8"/><path d="M36 82l8-30q16-8 32 0l8 30z" fill="#4a3426"/><path d="M44 52q16-8 32 0l-3-10q-13-6-26 0z" fill="#2b1d14"/><circle cx="60" cy="66" r="6" fill="#ff9a4d"/><path d="M30 84h60" stroke="#f07a2e" stroke-width="4" stroke-linecap="round"/></svg>',
  home: '<svg viewBox="0 0 120 90"><path d="M24 40a36 26 0 0 1 72 0z" fill="#e8642a"/><path d="M42 40a18 26 0 0 1 36 0z" fill="#f6f2ea"/><path d="M24 40l30 30M96 40l-30 30M60 40v28" stroke="#d8d2c4" stroke-width="1.5"/><path d="M50 82l3-14h14l3 14z" fill="#f1efe9"/><rect x="48" y="81" width="24" height="5" rx="2" fill="#2a201a"/><path d="M8 88h104" stroke="#7fd69b" stroke-width="4" stroke-linecap="round"/><path d="M100 14l2.5 6 6.5.5-5 4 1.6 6.3L100 27l-5.6 3.8L96 24.5l-5-4 6.5-.5z" fill="#ffd36a"/></svg>',
};

function showCard({ art, title, text = '', unlock = '', next = '', btn = 'Back to hangar', btn2 = '' }) {
  ui.cardArt.innerHTML = art;
  ui.cardTitle.textContent = title;
  ui.cardText.textContent = text; ui.cardText.hidden = !text;
  ui.cardUnlock.innerHTML = unlock; ui.cardUnlock.hidden = !unlock;
  ui.cardNext.innerHTML = next; ui.cardNext.hidden = !next;
  ui.cardBtn.textContent = btn;
  ui.cardBtn2.textContent = btn2; ui.cardBtn2.hidden = !btn2;
  ui.card.hidden = false;
  ui.act.hidden = true; ui.ff.hidden = true; ui.warp.hidden = true; ui.leanHint.hidden = true;
  setTimeout(() => ui.cardBtn.focus({ preventScroll: true }), 50);
}
function showOrbitCard(f) {
  mode = 'paused';
  const g = GOALS[2];
  const hasFuel = fuelLeft(f) > 0;
  showCard({
    art: ART.orbit, title: g.done,
    text: 'Your rocket is falling sideways so fast that it keeps missing the ground. That is an orbit!',
    unlock: `${g.unlockText}<small>${f.shield ? g.unlockSub : 'This rocket has no shield yet, so coming home now will get toasty! Try it, or put the shield on next time.'}</small>`,
    next: `Next goal: <b>Come home safe</b>${hasFuel ? '. Tap <b>Come home</b> when you are ready.' : ''}`,
    btn: 'Keep flying', btn2: 'Back to hangar',
  });
}

function showResult(f) {
  const got = f.newGoals;
  let art, title, text = '', unlock = '', next = '';
  const cur = currentGoal();
  if (f.outcome === 'toasty') {
    art = ART.toasty; title = 'Too toasty!';
    text = save.unlocked.shield
      ? (save.config.shield ? 'Coming home that fast heats the air until it glows, and this capsule had no heat shield. Your next rocket has the shield on. Try again!'
        : 'Coming home that fast heats the air until it glows, and your capsule got way too hot. Turn the heat shield on in the hangar.')
      : (f.maxAlt > ATM_TOP && orbitInfo(f).apo !== Infinity && f.maxAlt < 200000
        ? 'So close to going all the way around! Coming back down that fast made it way too hot. Lean over a bit sooner, and tap Burn at the top.'
        : 'Falling from way up high makes you super fast, and super fast through the air gets HOT. Go all the way around to unlock the heat shield.');
    if (got.length) unlock = got.filter(g => g.unlock.length).map(g => `${g.unlockText}<small>${g.unlockSub}</small>`).join('');
  } else if (got.length) {
    const top = got[got.length - 1];
    art = top.id === 'clouds' ? ART.cloud : top.id === 'space' ? ART.space : top.id === 'orbit' ? ART.orbit : ART.home;
    title = top.done;
    if (top.id === 'home') text = 'All the way around the planet, through the fire, and down under the parachute. A real space trip!';
    else if (f.outcome === 'landed') text = got.length > 1 ? 'Clouds and space in one flight! And you landed safely.' : 'And your capsule landed safely.';
    else if (f.outcome === 'crash') text = 'The landing was a bit bumpy, but you did it!';
    else if (top.id === 'orbit') text = 'Your rocket is falling sideways so fast that it keeps missing the ground.';
    else if (got.length > 1) text = 'Clouds and space in one flight!';
    unlock = got.map(g => `${g.unlockText}<small>${g.unlockSub}</small>`).join('');
  } else {
    const hint = hintFor(f, cur);
    art = hint.art; title = hint.title; text = hint.text;
  }
  next = cur ? `Next goal: <b>${cur.title}</b>` : (save.reached.home && !got.some(g => g.id === 'home') ? 'Next: <b>the Moon</b>, coming soon' : '');
  showCard({ art, title, text, unlock, next });
}

function suggestion(f) {
  const c = save.config;
  if (c.tank === 'short') return 'Try the medium tank?';
  if (c.engine === 'small' && f.maxAlt < 50000) return 'Try the big engine? It pushes much harder.';
  if (save.unlocked.tall && c.tank !== 'tall') return 'Try the tall tank?';
  if (f.leanLow > 0.35) return 'Try going straight up for longer before you lean.';
  if (save.unlocked.fins && !c.fins) return 'Try adding fins?';
  return 'Every flight teaches you something. Try again?';
}
function orbitTip(f) {
  const c = save.config;
  if (cfgStages() === 1 && save.unlocked.stages) return 'Tap + Stage in the hangar. A booster gives you lots more push.';
  if (c.tank === 'short') return 'Try the medium tank on top of the booster?';
  if (c.engine === 'small' && (c.tank === 'tall' || f.maxAlt < ATM_TOP)) return 'Try the big engine on top. The small one is too weak to push that much fuel sideways.';
  if (f.leanLow > 0.6) return 'Go straight up first. Lean when you see "Lean now".';
  if (!f.coastUsed) return f.maxAlt < ATM_TOP ? 'Lean over more once you are above the clouds, so the top of your path reaches space.' : 'Lean over once you are above the clouds, so you go sideways and not just up.';
  if (!f.burnPressed) return 'When the engine rests, wait for the top of your path, lean flat and tap Burn!';
  return 'At the top, lean all the way flat while you burn.';
}
function hintFor(f, goal) {
  if (f.outcome === 'heavy') return { art: ART.heavy, title: 'Too heavy to lift off!',
    text: 'The small engine can\'t push that much fuel. Try the big engine?' };
  if (f.outcome === 'crash') {
    if (f.leanLow > 0.5 || f.engineWasOnAtHit) return { art: ART.puff, title: 'Bonk!',
      text: 'Leaning a lot sent your rocket sideways into the ground. Go straight up first, then lean just a little.' };
    return { art: ART.puff, title: 'Bonk!', text: 'It came down too fast. The parachute needs a little time to open, so open it early.' };
  }
  if (f.outcome === 'escape') return { art: ART.space, title: 'Wow, it flew away!', text: 'Your rocket is going so fast it will never come back. That is called escape speed.' };
  if (f.wasOrbit && !f.outcome) return { art: ART.orbit, title: 'Still going around!',
    text: fuelLeft(f) > 0 ? 'Your rocket is still in orbit. Next time, tap Come home to fly back down.' : 'Your rocket is still in orbit. Keep some fuel next time so you can come home.' };
  if (!goal) return { art: ART.home, title: 'Nice flight!', text: 'You have done every goal in this version. The Moon is coming soon!' };
  if (goal.id === 'home') return { art: ART.chute, title: 'Nice flight!',
    text: 'To come home safe: go all the way around, tap Come home, and keep the heat shield on.' };
  if (goal.id === 'orbit') return { art: ART.chute, title: f.maxAlt > ATM_TOP ? 'So close!' : 'Nice flight!', text: orbitTip(f) };
  const frac = goal.alt ? f.maxAlt / goal.alt : 0;
  const name = goal.id === 'clouds' ? 'the clouds' : 'space';
  const t = frac < 0.25 ? `Your rocket ran out of fuel only a little way up toward ${name}.`
    : frac < 0.5 ? `Your rocket ran out of fuel part of the way to ${name}.`
    : frac < 0.85 ? `Your rocket got more than halfway to ${name} before the fuel ran out.`
    : `So close! Your rocket ran out of fuel just below ${name}.`;
  return { art: ART.chute, title: 'Nice try!', text: `${t} ${suggestion(f)}` };
}

// ---------------------------------------------------------------- ui wiring
let toastTimer = 0;
function toast(big, small) {
  ui.toast.innerHTML = `${big}${small ? `<small>${small}</small>` : ''}`;
  ui.toast.classList.add('show'); clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 3400);
}
function setGoalText() { const g = currentGoal(); ui.goalText.textContent = g ? g.title : 'Moon: coming soon'; }

function refreshHangar() {
  const c = save.config;
  ui.vNose.textContent = NOSES[c.nose].name;
  ui.vTank.textContent = TANKS[c.tank].name;
  ui.vEngine.textContent = ENGINES[c.engine].name;
  ui.pFins.hidden = !save.unlocked.fins;
  ui.vFins.textContent = c.fins ? 'On' : 'Off';
  ui.pStages.hidden = !save.unlocked.stages;
  ui.vStages.textContent = cfgStages() === 2 ? '2 stages' : '+ Stage';
  ui.pShield.hidden = !save.unlocked.shield;
  ui.vShield.textContent = c.shield ? 'On' : 'Off';
  const n = 3 + (save.unlocked.fins ? 1 : 0) + (save.unlocked.stages ? 1 : 0) + (save.unlocked.shield ? 1 : 0);
  ui.parts.classList.toggle('four', n === 4);
  ui.newFins.hidden = save.seen.fins !== false;
  ui.newTank.hidden = save.seen.tall !== false;
  ui.newStages.hidden = save.seen.stages !== false;
  ui.newShield.hidden = save.seen.shield !== false;
  ui.tip.textContent = save.flights === 0 ? 'Tap a part to change it' : '';
  ui.tip.hidden = save.flights !== 0;
  buildRocket(flightCfg());
  setGoalText();
  pop = 1;
  resize();
}
let pop = 0;
function cycle(list, cur) { const i = list.indexOf(cur); return list[(i + 1) % list.length]; }
ui.btnLaunchEl = $('btnLaunch');
$('pNose').addEventListener('click', () => { save.config.nose = cycle(Object.keys(NOSES), save.config.nose); writeSave(); refreshHangar(); tapSound(); });
$('pTank').addEventListener('click', () => {
  const list = save.unlocked.tall ? ['short', 'medium', 'tall'] : ['short', 'medium'];
  const nx = cycle(list, save.config.tank);
  if (!save.unlocked.tall && save.config.tank === 'medium') toast('Tall tank', 'Reach space to unlock it');
  save.config.tank = nx; if (nx === 'tall') save.seen.tall = true; writeSave(); refreshHangar(); tapSound();
});
$('pEngine').addEventListener('click', () => { save.config.engine = cycle(['small', 'big'], save.config.engine); writeSave(); refreshHangar(); tapSound(); });
ui.pFins.addEventListener('click', () => { save.config.fins = !save.config.fins; save.seen.fins = true; writeSave(); refreshHangar(); tapSound(); });
ui.pStages.addEventListener('click', () => {
  save.config.stages = cfgStages() === 2 ? 1 : 2; save.seen.stages = true; writeSave(); refreshHangar(); tapSound();
  if (save.config.stages === 2) toast('Booster added!', 'It pushes first. Drop it when it is empty.');
});
ui.pShield.addEventListener('click', () => { save.config.shield = !save.config.shield; save.seen.shield = true; writeSave(); refreshHangar(); tapSound(); });
function tapSound() { sound.init(); sound.burst(0.08, 1800, 0.25); }

ui.btnLaunchEl.addEventListener('click', () => { sound.init(); startFlight(); });
$('btnHome').addEventListener('click', () => {
  if (F && (F.newGoals.length || F.wasOrbit) && mode === 'flight') { finishFlight(); return; }
  toHangar();
});
ui.cardBtn.addEventListener('click', () => {
  if (mode === 'paused') { mode = 'flight'; ui.card.hidden = true; last = performance.now(); return; }
  toHangar();
});
ui.cardBtn2.addEventListener('click', toHangar);
ui.act.addEventListener('click', () => { if (F) doAction(F); });
ui.warp.addEventListener('click', () => { save.warp = cycle(WARPS, save.warp); writeSave(); tapSound(); updateWarpLabel(); });
function updateWarpLabel() { ui.warp.innerHTML = save.warp === 1 ? 'Speed 1x &rsaquo;' : `Speed ${save.warp}x &rsaquo;&rsaquo;`; }
updateWarpLabel();
$('btnMap').addEventListener('click', () => { ui.mapWrap.hidden = false; requestAnimationFrame(drawMap); drawMap(); });
$('btnMapClose').addEventListener('click', () => { ui.mapWrap.hidden = true; });

ui.btnNums.addEventListener('click', () => { save.nums = !save.nums; writeSave(); applyNums(); });
function applyNums() { ui.btnNums.setAttribute('aria-pressed', String(save.nums)); ui.nums.hidden = !save.nums; }
ui.btnSound.addEventListener('click', () => { save.sound = !save.sound; writeSave(); sound.init(); sound.setMuted(!save.sound); applySound(); });
function applySound() { ui.btnSound.classList.toggle('off', !save.sound); ui.btnSound.setAttribute('aria-label', save.sound ? 'Sound on' : 'Sound off'); }

// lean slider: press anywhere on the track, drag; snaps to the middle notch
const THUMB_HALF = 38;
{
  const tr = ui.leanTrack; let active = null;
  const setFrom = (clientX) => {
    const r = tr.getBoundingClientRect();
    let v = ((clientX - r.left - THUMB_HALF) / (r.width - THUMB_HALF * 2)) * 2 - 1;
    v = Math.max(-1, Math.min(1, v)); if (Math.abs(v) < 0.05) v = 0; setLean(v);
  };
  tr.addEventListener('pointerdown', (e) => { active = e.pointerId; tr.setPointerCapture(e.pointerId); setFrom(e.clientX); e.preventDefault(); });
  tr.addEventListener('pointermove', (e) => { if (e.pointerId === active) setFrom(e.clientX); });
  const end = (e) => { if (e.pointerId === active) active = null; };
  tr.addEventListener('pointerup', end); tr.addEventListener('pointercancel', end);
  tr.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') setLean(Math.max(-1, lean - 0.1)); else if (e.key === 'ArrowRight') setLean(Math.min(1, lean + 0.1));
    else if (e.key === 'Home' || e.key === '0') setLean(0); else return; e.preventDefault();
  });
}
function leanPx(v) { const r = ui.leanTrack.clientWidth; return v * (r / 2 - THUMB_HALF - 6); }
function setLean(v) {
  lean = v;
  ui.leanThumb.style.transform = `translateX(${leanPx(v)}px)`;
  ui.leanTrack.setAttribute('aria-valuenow', v.toFixed(2));
}
window.addEventListener('keydown', (e) => {
  if (mode !== 'flight') { if (mode === 'hangar' && (e.key === ' ' || e.key === 'Enter') && document.activeElement === document.body) startFlight(); return; }
  if (e.key === 'a' || e.key === 'ArrowLeft') { if (document.activeElement !== ui.leanTrack) setLean(Math.max(-1, lean - 0.1)); }
  if (e.key === 'd' || e.key === 'ArrowRight') { if (document.activeElement !== ui.leanTrack) setLean(Math.min(1, lean + 0.1)); }
  if ((e.key === 'p' || e.key === ' ') && F && !ui.act.hidden) { doAction(F); e.preventDefault(); }
  if (e.key === 'm') { ui.mapWrap.hidden = !ui.mapWrap.hidden; if (!ui.mapWrap.hidden) drawMap(); }
});

// the one big button in flight changes with what is needed now
let actKind = '';
function pickAction(f) {
  if (f.outcome || mode !== 'flight') return '';
  const vr = vRadial(f);
  if (f.needDrop) return 'drop';
  if (f.coasting && fuelLeft(f) > 0 && (vr < 220 || f.alt > ATM_TOP + 20000) && !(vr < 0 && f.alt < ATM_TOP - 15000)) return 'burn';
  if (f.wasOrbit && !f.retro && !f.capsuleOnly && !f.engineOn && fuelLeft(f) > 0 && inOrbit(f)) return 'home';
  if (!f.engineOn && !f.chuteOn && f.lifted && vr < -5 && f.alt < ATM_TOP && f.plasma < 0.05 && Math.hypot(f.vx, f.vy) < 500) return 'chute';
  return '';
}
const ACT_TEXT = { drop: 'Drop stage', burn: 'Burn!', home: 'Come home', chute: 'Open parachute' };
function doAction(f) {
  const k = pickAction(f);
  if (k === 'drop') doDrop();
  else if (k === 'burn') { if (resumeBurn(f)) { f.burnPressed = true; sound.burst(0.4, 900, 0.5); } }
  else if (k === 'home') { if (startComeHome(f)) toast('Turning around...', 'The engine slows you down, then down you go.'); }
  else if (k === 'chute') openChute(f);
}
function doDrop() {
  const f = F; if (!f || !f.needDrop || !stackG.booster) return;
  const ox = f.x, oy = f.y, h = stackG.boosterH;
  if (!dropStage(f, h)) return;
  shed(stackG.booster, ox, oy, f, 3); stackG.booster = null;
  shiftStack(h, ENGINES[stage(f).engine].bellR);
  sound.burst(0.5, 1100, 0.5);
  toast('Stage dropped!', 'Next engine on.');
  layoutFuel(f);
}
function doSeparate() {
  const f = F; if (!f || f.capsuleOnly || !stackG.upper) return;
  const ox = f.x, oy = f.y, h = stackG.upperH;
  if (!separateCapsule(f, h)) return;
  shed(stackG.upper, ox, oy, f, 2); stackG.upper = null;
  shiftStack(h, 0.5);
  sound.burst(0.5, 1100, 0.5);
  layoutFuel(f);
}
function openChute(f) {
  if (f.chuteOn || f.engineOn && fuelLeft(f) > 0) return;
  f.chuteOn = true; chute.visible = true; sound.burst(0.5, 1200, 0.35);
}

// fuel bar: one piece per stage, the top piece is the top stage
function layoutFuel(f) {
  ui.fuelTrack.innerHTML = '';
  if (f.capsuleOnly) { ui.fuelTrack.parentElement.hidden = true; return; }
  ui.fuelTrack.parentElement.hidden = false;
  for (let i = f.stages.length - 1; i >= f.si; i--) {
    const seg = document.createElement('div'); seg.className = 'fseg';
    const fill = document.createElement('div'); fill.className = 'fuel-fill'; seg.appendChild(fill);
    seg.dataset.i = i; ui.fuelTrack.appendChild(seg);
  }
}
function updateFuel(f) {
  for (const seg of ui.fuelTrack.children) {
    const s = f.stages[+seg.dataset.i]; const fr = s.fuel / s.fuelMax;
    const fill = seg.firstChild; fill.style.height = (fr * 100).toFixed(1) + '%'; fill.classList.toggle('low', fr < 0.2);
  }
}

function startFlight() {
  if (mode !== 'hangar') return;
  F = newFlight(); mode = 'flight';
  for (const k of Object.keys(save.seen)) save.seen[k] = true; writeSave();
  parts.length = 0; rocket.visible = true; chute.visible = false; chute.scale.setScalar(0.01); plasma.visible = false;
  setLean(0); simAcc = 0;
  ui.hangar.hidden = true; ui.flight.hidden = false; document.body.classList.add('flying');
  ui.card.hidden = true; ui.mapWrap.hidden = true; ui.act.hidden = true; ui.warp.hidden = true;
  ui.progGoal.style.backgroundImage = progIcon();
  ui.prog.hidden = !currentGoal() || currentGoal().id === 'home';
  layoutFuel(F); actKind = '';
}
function toHangar() {
  mode = 'hangar'; F = null; parts.length = 0;
  ui.card.hidden = true; ui.mapWrap.hidden = true; ui.flight.hidden = true; ui.hangar.hidden = false;
  document.body.classList.remove('flying');
  rocket.visible = true; chute.visible = false; plasma.visible = false; camSmooth = null;
  ui.heatGlow.style.opacity = 0;
  sound.engine(0, 1);
  refreshHangar();
}
function progIcon() {
  const g = currentGoal();
  const svg = !g || g.id === 'clouds'
    ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80"><path d="M30 66c-12 0-20-8-20-18s8-18 19-18c3-12 13-20 26-20 14 0 25 9 27 22 11 0 20 8 20 17s-8 17-19 17z" fill="#fff"/></svg>'
    : g.id === 'orbit'
    ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" fill="#5f9be0"/><ellipse cx="12" cy="12" rx="10.5" ry="7" fill="none" stroke="#7fd69b" stroke-width="2"/></svg>'
    : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2l3 7 7 .6-5.4 4.6 1.7 7.3L12 17.6 5.7 21.5l1.7-7.3L2 9.6 9 9z" fill="#ffd36a"/></svg>';
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

// ---------------------------------------------------------------- the planet picture for the map (same land and sea as the flight view)
function fract(x) { return x - Math.floor(x); }
function hash13(x, y, z) {
  x = fract(x * 0.1031); y = fract(y * 0.1031); z = fract(z * 0.1031);
  const d = x * (z + 31.32) + y * (y + 31.32) + z * (x + 31.32);
  x += d; y += d; z += d; return fract((x + y) * z);
}
function vnoise(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  let fx = x - ix, fy = y - iy, fz = z - iz;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
  const L = (a, b, t) => a + (b - a) * t;
  const a = hash13(ix, iy, iz), b = hash13(ix + 1, iy, iz), c = hash13(ix, iy + 1, iz), d = hash13(ix + 1, iy + 1, iz);
  const e = hash13(ix, iy, iz + 1), g = hash13(ix + 1, iy, iz + 1), h = hash13(ix, iy + 1, iz + 1), k = hash13(ix + 1, iy + 1, iz + 1);
  return L(L(L(a, b, fx), L(c, d, fx), fy), L(L(e, g, fx), L(h, k, fx), fy), fz);
}
function fbm(x, y, z, oct) {
  let a = 0.5, s = 0;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x, y, z); x = x * 2.03 + 1.7; y = y * 2.03 + 9.2; z = z * 2.03 + 3.1; a *= 0.5; }
  return s;
}
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
let planetImg = null;
function makePlanetImage(N, done) {
  const cv = document.createElement('canvas'); cv.width = cv.height = N;
  const g = cv.getContext('2d'); const img = g.createImageData(N, N); const px = img.data;
  const sun = [-0.45, 0.62, 0.64]; const sl = Math.hypot(...sun); sun[0] /= sl; sun[1] /= sl; sun[2] /= sl;
  let row = 0;
  const work = () => {
    const end = Math.min(N, row + 24);
    for (; row < end; row++) {
      for (let col = 0; col < N; col++) {
        const u = (col + 0.5) / N * 2 - 1, v = 1 - (row + 0.5) / N * 2, rr = u * u + v * v;
        if (rr > 1) continue;
        const nz = Math.sqrt(1 - rr), nx = u, ny = v;
        let c = fbm(nx * 2.6 + 3.1, ny * 2.6 + 1.7, nz * 2.6 + 5.2, 5);
        const sd = Math.hypot(nx, ny - 1, nz) * 600000;
        const c0 = c;
        c = Math.max(c, c + (0.56 - c) * Math.exp(-Math.pow(sd / 90000, 2)));
        const land = sstep(0.5, 0.512, c);
        const m = fbm(nx * 32 + 7, ny * 32 + 7, nz * 32 + 7, 3);
        const dryT = sstep(0.5, 0.75, m);
        let lr = 0.08 + (0.22 - 0.08) * dryT, lg = 0.16 + (0.19 - 0.16) * dryT, lb = 0.045 + (0.11 - 0.045) * dryT;
        const rk = sstep(0.62, 0.74, c0) * (1 - Math.exp(-Math.pow(sd / 60000, 2)));
        lr += (0.17 - lr) * rk; lg += (0.16 - lg) * rk; lb += (0.15 - lb) * rk;
        const st = sstep(0.44, 0.5, c);
        const sr = 0.008 + 0.012 * st, sg = 0.03 + 0.05 * st, sb = 0.07 + 0.04 * st;
        let r = sr + (lr - sr) * land, gg = sg + (lg - sg) * land, b = sb + (lb - sb) * land;
        const ndl = Math.max(0, nx * sun[0] + ny * sun[1] + nz * sun[2]);
        const light = 4.6 * ndl + 0.55;           // brighter night side than real, so the map stays readable
        r *= light; gg *= light; b *= light;
        // air haze toward the rim
        const haze = Math.pow(1 - nz, 2.2) * 0.9 * (0.35 + ndl);
        r += 0.10 * haze; gg += 0.22 * haze; b += 0.55 * haze;
        const tm = (x) => Math.pow(1 - Math.exp(-x * 1.05), 1 / 2.2) * 255;
        const o = (row * N + col) * 4;
        px[o] = tm(r); px[o + 1] = tm(gg); px[o + 2] = tm(b);
        px[o + 3] = 255 * Math.min(1, (1 - Math.sqrt(rr)) * N * 0.5);   // soft edge
      }
    }
    if (row < N) setTimeout(work, 0);
    else { g.putImageData(img, 0, 0); planetImg = cv; done && done(); }
  };
  work();
}

// ---------------------------------------------------------------- map (zoomed-out planet + predicted path)
// Drawn with a plain 2D canvas (no WebGL lines), so it looks the same on every phone.
const MAPCOL = { orbit: '#7fd69b', almost: '#ffd36a', fall: '#ff9a4d', away: '#9cc7ff' };
function pathState(f) {
  if (!f.lifted || f.outcome === 'landed' || f.outcome === 'crash') return { path: null, kind: 'none' };
  const p = conicPath(f.x, f.y, f.vx, f.vy);
  const o = orbitInfo(f);
  let kind = 'fall';
  if (p.escape) kind = 'away';
  else if (p.wraps && o.peri > ATM_TOP) kind = 'orbit';
  else if (p.wraps) kind = 'almost';
  return { path: p, kind, o };
}
function drawPlanetView(g, w, h, f, opt) {
  const { path, kind } = pathState(f);
  const mini = !!opt.mini;
  // framing: the whole planet once the path goes far around; otherwise zoom in on the flight so the path is big
  const pts = [[0, R], [f.x, f.y]];
  if (path) for (let i = 0; i < path.pts.length; i += 4) pts.push(path.pts[i]);
  if (path && path.pts.length) pts.push(path.pts[path.pts.length - 1]);
  for (let i = 0; i < f.track.length; i += 3) pts.push(f.track[i]);
  let maxAng = 0, maxR = R;
  for (const p of pts) { maxAng = Math.max(maxAng, Math.abs(Math.atan2(p[0], p[1]))); maxR = Math.max(maxR, Math.hypot(p[0], p[1])); }
  let cx0, cy0, ext;
  const padTop = opt.padTop || 0, padBot = opt.padBot || 0, availH = h - padTop - padBot;
  if (mini || kind === 'orbit' || kind === 'almost' || kind === 'away' || maxAng > 0.6 || maxR > R * 1.35) {
    cx0 = 0; cy0 = 0; ext = Math.min(R * 3.2, Math.max(R * (mini ? 1.16 : 1.22), maxR * 1.06));
    if (mini) ext = Math.min(ext, R * 1.7);
  } else {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    const half = Math.max(6000, (x1 - x0) * 0.62, (y1 - y0) * 0.62 * Math.max(1, w / availH));
    cx0 = (x0 + x1) / 2; cy0 = (y0 + y1) / 2 - half * 0.18; ext = half;
  }
  const s = Math.min(w, availH) * (mini ? 0.5 : 0.44) / ext;
  const cx = w / 2 - cx0 * s, cy = padTop + availH / 2 + cy0 * s;
  const P = (x, y) => [cx + x * s, cy - y * s];
  const Rpx = R * s;
  // stars
  if (!mini) {
    g.fillStyle = 'rgba(255,255,255,.55)';
    for (let i = 0; i < 70; i++) { const x = fract(Math.sin(i * 12.9898) * 43758.5) * w, y = fract(Math.sin(i * 78.233) * 12345.6) * h; g.fillRect(x, y, i % 7 ? 1 : 1.6, i % 7 ? 1 : 1.6); }
  }
  const zoomedIn = Rpx > 1400;
  if (zoomedIn) {
    // close up: a huge circle would be blocky (and risky for some browsers), so draw just the piece of ground in view
    const ac = Math.atan2(cx0, cy0), span = Math.min(Math.PI, (Math.max(w, h) / s) / R * 1.2 + 0.002);
    const surf = [];
    for (let i = 0; i <= 48; i++) { const a = ac - span + 2 * span * i / 48; surf.push(P(R * Math.sin(a), R * Math.cos(a))); }
    const deep = (Math.max(w, h) * 2) / s;
    g.beginPath(); surf.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
    for (let i = 48; i >= 0; i--) { const a = ac - span + 2 * span * i / 48; const [x, y] = P((R - deep) * Math.sin(a), (R - deep) * Math.cos(a)); g.lineTo(x, y); }
    g.closePath();
    const [tx, ty] = P(R * Math.sin(ac), R * Math.cos(ac)), [bx, by] = P((R - 60 / s) * Math.sin(ac), (R - 60 / s) * Math.cos(ac));
    const gg = g.createLinearGradient(tx, ty, bx, by); gg.addColorStop(0, '#567f40'); gg.addColorStop(1, '#22391d');
    g.fillStyle = gg; g.fill();
    g.lineJoin = 'round';
    g.strokeStyle = 'rgba(120,175,255,.28)'; g.lineWidth = 14; strokePoly(g, surf);
    g.strokeStyle = 'rgba(200,230,255,.7)'; g.lineWidth = 2; strokePoly(g, surf);
  } else {
    // air: a thin glowing shell
    const at = g.createRadialGradient(cx, cy, Rpx * 0.985, cx, cy, (R + ATM_TOP) * s);
    at.addColorStop(0, 'rgba(120,175,255,.55)'); at.addColorStop(0.5, 'rgba(110,170,255,.22)'); at.addColorStop(1, 'rgba(110,170,255,0)');
    g.fillStyle = at; g.beginPath(); g.arc(cx, cy, (R + ATM_TOP) * s, 0, Math.PI * 2); g.fill();
  }
  // the planet
  if (zoomedIn) { /* drawn above */ } else if (planetImg) g.drawImage(planetImg, cx - Rpx, cy - Rpx, Rpx * 2, Rpx * 2);
  else {
    const pg = g.createRadialGradient(cx - Rpx * 0.4, cy - Rpx * 0.4, Rpx * 0.1, cx, cy, Rpx);
    pg.addColorStop(0, '#4f7fb8'); pg.addColorStop(1, '#13284a');
    g.fillStyle = pg; g.beginPath(); g.arc(cx, cy, Rpx, 0, Math.PI * 2); g.fill();
  }
  // where we've been
  if (f.track.length > 1) {
    g.strokeStyle = 'rgba(255,248,236,.6)'; g.lineWidth = mini ? 1 : 2; g.setLineDash(mini ? [2, 2] : [3, 4]); g.beginPath();
    f.track.forEach((p, i) => { const [a, b] = P(p[0], p[1]); i ? g.lineTo(a, b) : g.moveTo(a, b); });
    const [rx, ry] = P(f.x, f.y); g.lineTo(rx, ry); g.stroke(); g.setLineDash([]);
  }
  // launch site: a little flag
  {
    const [sx, sy] = P(0, R);
    const fl = mini ? 7 : 16;
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = mini ? 3 : 4; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx, sy - fl); g.stroke();
    g.strokeStyle = '#fff8ec'; g.lineWidth = mini ? 1.4 : 2; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx, sy - fl); g.stroke();
    g.fillStyle = '#f07a2e'; g.beginPath(); g.moveTo(sx, sy - fl); g.lineTo(sx + fl * 0.6, sy - fl * 0.8); g.lineTo(sx, sy - fl * 0.6); g.closePath(); g.fill();
    if (!mini) label(g, 'Start', sx, sy - fl - 10, '#fff8ec');
  }
  // where we're going
  let hitPx = null;
  if (path && path.pts.length > 1) {
    const col = MAPCOL[kind] || MAPCOL.fall;
    const sp = path.pts.map(p => P(p[0], p[1]));
    g.lineJoin = 'round'; g.lineCap = 'round';
    g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = mini ? 3.4 : 8; strokePoly(g, sp);
    g.strokeStyle = col; g.lineWidth = mini ? 1.8 : 4.5; strokePoly(g, sp);
    // arrows along the path: which way you are going
    const every = mini ? 34 : 64; let acc = every * 0.55; let arrows = 0;
    for (let i = 1; i < sp.length; i++) {
      const dx = sp[i][0] - sp[i - 1][0], dy = sp[i][1] - sp[i - 1][1], L = Math.hypot(dx, dy);
      if (L < 1e-6) continue;
      acc += L;
      if (acc >= every && (!path.hit || i < sp.length - 2)) { acc = 0; arrows++; arrow(g, sp[i][0], sp[i][1], Math.atan2(dy, dx), mini ? 4.2 : 9, col); }
    }
    if (!arrows && sp.length > 2) {   // a short path still gets one arrow in its middle
      const m = Math.floor(sp.length / 2), a0 = sp[m - 1], a1 = sp[m];
      arrow(g, a1[0], a1[1], Math.atan2(a1[1] - a0[1], a1[0] - a0[0]), mini ? 4.2 : 9, col);
    }
    if (path.hit) {
      hitPx = P(path.hit[0], path.hit[1]);
      const [hx, hy] = hitPx, k = mini ? 3.5 : 8;
      g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = mini ? 3.5 : 6;
      g.beginPath(); g.moveTo(hx - k, hy - k); g.lineTo(hx + k, hy + k); g.moveTo(hx + k, hy - k); g.lineTo(hx - k, hy + k); g.stroke();
      g.strokeStyle = '#ff6a4a'; g.lineWidth = mini ? 1.8 : 3.2;
      g.beginPath(); g.moveTo(hx - k, hy - k); g.lineTo(hx + k, hy + k); g.moveTo(hx + k, hy - k); g.lineTo(hx - k, hy + k); g.stroke();
      if (!mini) label(g, 'Lands here', hx, hy + 22, '#ffb49a');
    }
  }
  // the rocket: a little arrowhead pointing the way it moves
  {
    const [rx, ry] = P(f.x, f.y);
    const v = Math.hypot(f.vx, f.vy);
    const ang = v > 3 ? Math.atan2(-f.vy, f.vx) : Math.atan2(-Math.cos(f.heading), Math.sin(f.heading));
    const k = mini ? 5.5 : 11;
    g.save(); g.translate(rx, ry); g.rotate(ang);
    g.beginPath(); g.moveTo(k * 1.25, 0); g.lineTo(-k * 0.8, k * 0.75); g.lineTo(-k * 0.35, 0); g.lineTo(-k * 0.8, -k * 0.75); g.closePath();
    g.fillStyle = '#fff8ec'; g.strokeStyle = 'rgba(0,0,0,.7)'; g.lineWidth = mini ? 1.2 : 2; g.fill(); g.stroke();
    g.restore();
    if (!mini) {
      const pulse = 0.5 + 0.5 * Math.sin(clock * 4);
      g.strokeStyle = `rgba(255,154,77,${0.35 + 0.4 * pulse})`; g.lineWidth = 2;
      g.beginPath(); g.arc(rx, ry, k * 1.6 + pulse * 4, 0, Math.PI * 2); g.stroke();
    }
  }
  return kind;
}
function strokePoly(g, sp) { g.beginPath(); g.moveTo(sp[0][0], sp[0][1]); for (let i = 1; i < sp.length; i++) g.lineTo(sp[i][0], sp[i][1]); g.stroke(); }
function arrow(g, x, y, a, k, col) {
  g.save(); g.translate(x, y); g.rotate(a);
  g.beginPath(); g.moveTo(k, 0); g.lineTo(-k * 0.7, k * 0.8); g.lineTo(-k * 0.7, -k * 0.8); g.closePath();
  g.fillStyle = col; g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 1.5; g.fill(); g.stroke(); g.restore();
}
function label(g, t, x, y, col) {
  g.font = '700 14px "Atkinson Hyperlegible", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 4; g.strokeStyle = 'rgba(4,7,14,.85)'; g.strokeText(t, x, y); g.fillStyle = col; g.fillText(t, x, y);
}
function fitCanvas(cv) {
  const w = cv.clientWidth, h = cv.clientHeight, pr = Math.min(2, window.devicePixelRatio || 1);
  if (!w || !h) return null;
  if (cv.width !== Math.round(w * pr) || cv.height !== Math.round(h * pr)) { cv.width = Math.round(w * pr); cv.height = Math.round(h * pr); }
  const g = cv.getContext('2d'); g.setTransform(pr, 0, 0, pr, 0, 0); g.clearRect(0, 0, w, h);
  return { g, w, h };
}
const MAPCAP = {
  pad: 'This is your planet. You start at the flag.',
  fall: 'Your path comes back down to the ground at the X.',
  almost: 'Almost all the way around! The air down low will slow you down.',
  orbit: 'All the way around! The green line never touches the ground. That is an orbit.',
  away: 'You are going so fast you will fly away from the planet!',
};
function drawMap() {
  if (ui.mapWrap.hidden || !F) return;
  const c = fitCanvas(ui.map); if (!c) return;
  const kind = drawPlanetView(c.g, c.w, c.h, F, { padTop: 70, padBot: 110 });
  let cap = !F.lifted ? MAPCAP.pad : (MAPCAP[kind] || MAPCAP.fall);
  if (F.engineOn && fuelLeft(F) > 0 && F.lifted && kind !== 'orbit') cap = 'The engine is still pushing, so your path keeps growing. ' + cap;
  if (F.lifted && kind !== 'none') cap += ' The arrows show which way you are going.';
  if (ui.mapCap.textContent !== cap) ui.mapCap.textContent = cap;
}
function drawMini() {
  if (!F || ui.flight.hidden) return;
  const c = fitCanvas(ui.mini); if (!c) return;
  c.g.save(); c.g.beginPath(); c.g.arc(c.w / 2, c.h / 2, c.w / 2, 0, Math.PI * 2); c.g.clip();
  drawPlanetView(c.g, c.w, c.h, F, { mini: true });
  c.g.restore();
}

// ---------------------------------------------------------------- per-frame update
const tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), Z = new THREE.Vector3(0, 0, 1), Y = new THREE.Vector3(0, 1, 0);
let numsT = 0, mapT = 0, miniT = 0, trackT = 0, hintShown = '';
let turbo = 1;                // test hook only: run the clock faster in automated checks

function update(dtReal) {
  clock += dtReal;
  if (pop > 0) pop = Math.max(0, pop - dtReal * 3);

  if (F && (mode === 'flight' || mode === 'result' || mode === 'paused')) {
    const f = F;
    const st = stage(f), burning = f.engineOn && st && st.fuel > 0;
    const vr = vRadial(f);
    // speed up the slow parts (coasting, going around, hanging under the parachute)
    let sp = 1;
    const orbiting = f.wasOrbit && !f.engineOn && !f.retro && f.alt > ATM_TOP && inOrbit(f);
    if (burning) sp = f.retro ? 2 : (f.alt > 15000 ? 2 : 1);
    else if (f.retro) sp = 4;
    else if (f.needDrop) sp = 1;
    else if (f.coasting) sp = vr < 260 ? 1 : (f.alt > 4000 ? 4 : 1);
    else if (f.chuteOn) sp = f.alt > 60 ? 12 : 1;
    else if (orbiting) sp = save.warp;
    else if (f.alt > ATM_TOP) sp = 10;
    else if (f.plasma > 0.02) sp = 2;
    else if (f.alt > 4000) sp = 4;
    simSpeed = sp;
    if (mode === 'flight' && !f.outcome) {
      simAcc += dtReal * sp * turbo;
      let n = 0;
      while (simAcc >= STEP && n < 3000) {
        stepPhysics(f, STEP, lean); simAcc -= STEP; n++;
        if (f.events.length) { handleEvents(f); if (f.outcome) { simAcc = 0; break; } }
      }
      if (!f.lifted && burning && f.t > 5) { f.engineOn = false; f.outcome = 'heavy'; f.endIn = 1.2; }
      checkGoals(f);
      // the empty stage drops by itself if nobody taps
      if (f.needDrop && f.dropAuto > 0) { f.dropAuto -= dtReal; if (f.dropAuto <= 0) doDrop(); }
      // auto-open the parachute low down if nobody pressed it
      if (!f.engineOn && !f.chuteOn && f.lifted && vr < 0 && f.alt < 5000) openChute(f);
      trackT -= dtReal * sp; if (trackT <= 0) { f.track.push([f.x, f.y]); trackT = 2; if (f.track.length > 1500) f.track.splice(0, 2); }
    } else if (f.outcome && f.endIn > 0) {
      f.endIn -= dtReal; if (f.endIn <= 0 && mode === 'flight') finishFlight();
    }
    if (mode === 'flight') {
      // the one action button
      const k = pickAction(f);
      if (k !== actKind) { actKind = k; ui.act.hidden = !k; if (k) { ui.act.textContent = ACT_TEXT[k]; ui.act.dataset.kind = k; } }
      ui.warp.hidden = !(orbiting && !f.outcome);
      ui.ff.hidden = sp === 1 || !!f.outcome || !ui.warp.hidden;
      updateLeanHint(f, burning);
      updateFuel(f);
      // progress toward the goal: height for clouds/space, sideways speed for going around
      const g = currentGoal();
      let pf = 0;
      if (g && g.alt) pf = f.alt / g.alt;
      else if (g && g.id === 'orbit') { const r = Math.hypot(f.x, f.y), vt = Math.abs(f.x * f.vy - f.y * f.vx) / r; pf = vt / Math.sqrt(9.81 * R * R / (R + ATM_TOP + 10000)); }
      pf = Math.max(0, Math.min(1, pf));
      ui.progFill.style.height = (pf * 100) + '%'; ui.progDot.style.bottom = (pf * 100) + '%';
      miniT -= dtReal; if (miniT <= 0) { drawMini(); miniT = 0.12; }
    }
    if (!ui.mapWrap.hidden) { mapT -= dtReal; if (mapT <= 0) { drawMap(); mapT = 0.1; } }
  }

  // ---- rocket transform + effects
  let base, dir, up, alt, air = 1, power = 0;
  if (F && mode !== 'hangar') {
    base = tmpV.set(F.x, F.y, 0).clone();
    dir = new THREE.Vector3(Math.sin(F.heading), Math.cos(F.heading), 0);
    up = base.clone().normalize(); alt = F.alt; air = F.air;
    power = F.thr > 0 ? F.ign : 0;
    if (F.sputter > 0) { F.sputter -= dtReal; power = (Math.sin(F.sputter * 40) > 0.3 ? 0.6 : 0) * F.sputter; }
    if (F.capsuleOnly) power = 0;
  } else {
    base = new THREE.Vector3(0, R + PAD_H, 0); dir = Y.clone(); up = Y.clone(); alt = PAD_H;
  }
  rocket.position.copy(base);
  tmpQ.setFromUnitVectors(Y, dir); rocket.quaternion.copy(tmpQ);
  rocketBody.scale.setScalar(1 + Math.sin(pop * Math.PI) * 0.04);
  if (F && F.chuteOn) { const s = Math.max(0.02, F.chute); chute.scale.set(s, Math.sqrt(s), s); }

  const vac = 1 - air;
  const len = (rocketDims.bellR * 7 + 4) * (0.6 + 0.4 * power) * (1 + vac * 0.8);
  flameOuter.scale.set(rocketDims.bellR * (1 + vac * 2.2), len, rocketDims.bellR * (1 + vac * 2.2));
  flameCore.scale.set(rocketDims.bellR * 0.62, len * 0.55, rocketDims.bellR * 0.62);
  flameMat.uniforms.uPower.value = power; flameMat.uniforms.uVac.value = vac; flameMat.uniforms.uTime.value = clock;
  flameCoreMat.uniforms.uPower.value = power; flameCoreMat.uniforms.uVac.value = vac; flameCoreMat.uniforms.uTime.value = clock;
  flameOuter.visible = flameCore.visible = power > 0.01 && rocket.visible;
  engineLight.intensity = power * 60 * (0.85 + Math.random() * 0.3);
  engineLight.color.setHex(0xff9a4a);
  sound.engine(mode === 'flight' ? power : 0, air);

  // ---- reentry glow
  const pl = F && mode !== 'hangar' && rocket.visible ? F.plasma : 0;
  plasma.visible = pl > 0.01;
  if (plasma.visible) {
    const v = Math.hypot(F.vx, F.vy), vd = tmpDir.set(F.vx / v, F.vy / v, 0);
    const H = rocketDims.height, c = Math.abs(vd.dot(dir));
    const center = base.clone().addScaledVector(dir, H * 0.5);
    const front = center.addScaledVector(vd, c * H * 0.5 + (1 - c) * 1.3 + 0.4);
    plasma.position.copy(front);
    plasma.quaternion.setFromUnitVectors(Y, vd);
    const wide = 1.55 + (1 - c) * H * 0.35;
    plasmaBow.scale.set(wide, 0.7 + pl * 0.6, wide);
    plasmaTail.scale.set(wide * 1.05, (H + 10) * (0.6 + pl * 1.4), wide * 1.05);
    plasmaMat.uniforms.uP.value = Math.min(1, pl * 1.3); plasmaMat.uniforms.uTime.value = clock;
    engineLight.color.setHex(0xff7a3a); engineLight.intensity = Math.max(engineLight.intensity, pl * 90);
  }
  M.heat.emissive.setRGB(1.0 * pl, 0.32 * pl, 0.08 * pl);
  ui.heatGlow.style.opacity = (pl * 0.75).toFixed(3);

  // smoke
  if (F && mode !== 'hangar' && power > 0.05 && air > 0.01 && rocket.visible) {
    const rate = (F.alt < 40 ? 70 : 30) * power * Math.min(1, air * 1.6) * dtReal * simSpeed;
    let n = Math.floor(rate + Math.random());
    const ex = -dir.x, ey = -dir.y;
    while (n-- > 0) {
      const jet = 25 + Math.random() * 15;
      if (F.alt < 40) {
        const a = Math.random() < 0.5 ? 1 : -1, sp = 12 + Math.random() * 20;
        spawnSmoke(F.x + (Math.random() - 0.5) * 2, F.y + 0.5, (Math.random() - 0.5) * 6,
          a * sp * up.y, 2 + Math.random() * 3, (Math.random() - 0.5) * 14, 6 + Math.random() * 4, 2.5, 18 + Math.random() * 10, 0.75, 0.3);
      } else {
        spawnSmoke(F.x + ex * 2, F.y + ey * 2, (Math.random() - 0.5) * 1.2,
          ex * jet + F.vx * 0.15, ey * jet + F.vy * 0.15, (Math.random() - 0.5) * 3, 5 + Math.random() * 4, 1.6, 9 + Math.random() * 8, 0.55 * Math.min(1, air * 2), 0.25);
      }
    }
  }
  const simDt = dtReal * (F && mode === 'flight' ? simSpeed : (mode === 'paused' ? 0 : 1));
  updateSmoke(simDt, base);
  updateDebris(simDt);
  updatePuffs();

  // ---- lights fade toward space
  const airLook = Math.exp(-Math.max(0, alt) / 9000);
  hemi.intensity = 0.15 + 0.95 * airLook;
  hemi.color.setRGB(0.6 * airLook + 0.05, 0.75 * airLook + 0.05, 1.0 * airLook + 0.08);
  for (const m of stdMats) m.envMapIntensity = 0.25 + 0.75 * airLook;
  sunLight.position.copy(base).addScaledVector(SUN, 100); sunLight.target.position.copy(base);
  pad.visible = Math.hypot(base.x, base.y - R) < 8000;

  // ---- camera
  updateCamera(dtReal, base, dir, up, alt);

  // ---- grown-up numbers
  numsT -= dtReal;
  if (save.nums && numsT <= 0) { numsT = 0.1; ui.nums.textContent = numbersText(); }
}

// "lean now" help: a glowing spot on the slider shows where to hold it (from the second goal ladder step on)
function updateLeanHint(f, burning) {
  let show = false, target = 0, text = '';
  const side = lean < -0.05 ? -1 : 1;
  if (save.unlocked.stages && !f.outcome && f.lifted && !f.retro && !f.capsuleOnly) {
    if (f.coasting && fuelLeft(f) > 0) {
      target = 1; show = true;
      if (Math.abs(lean) < 0.75) text = side > 0 ? 'Lean flat →' : '← Lean flat';
      else if (pickAction(f) !== 'burn') text = 'Coasting up to the top...';
    } else if (burning && f.alt > 8500 && f.alt < ATM_TOP + 30000) {
      target = suggestedLean(f); show = true;
      if (Math.abs(lean) < target - 0.22) text = side > 0 ? 'Lean now →' : '← Lean now';
      else if (Math.abs(lean) > target + 0.3 && f.alt < 40000) text = 'Lean a little less';
    }
  }
  ui.leanGhost.hidden = !show;
  if (show) ui.leanGhost.style.transform = `translateX(${leanPx(target * side)}px)`;
  if (text !== hintShown) { hintShown = text; ui.leanHint.textContent = text; ui.leanHint.hidden = !text; }
}

function numbersText() {
  if (mode === 'hangar' || !F) {
    const f = physicsFlight(flightCfg());
    let m0 = mass(f), dv = 0;
    const twr = f.stages[0].eng.thrust * f.stages[0].eng.ispSL / f.stages[0].eng.ispVac / (m0 * G0);
    for (let i = 0; i < f.stages.length; i++) {
      const s = f.stages[i], m1 = m0 - s.fuel;
      dv += s.eng.ispVac * G0 * Math.log(m0 / m1); m0 = m1 - s.dry;
    }
    return `mass   ${(mass(f) / 1000).toFixed(2)} t\nstages ${f.stages.length}\nthrust ${(f.stages[0].eng.thrust / 1000).toFixed(0)} kN\nTWR    ${twr.toFixed(2)}\nΔv     ${(dv / 1000).toFixed(2)} km/s\nbest   ${(save.best / 1000).toFixed(1)} km`;
  }
  const f = F, v = Math.hypot(f.vx, f.vy), r = Math.hypot(f.x, f.y), vr = (f.vx * f.x + f.vy * f.y) / r;
  const o = orbitInfo(f), st = stage(f);
  const km = (x) => Math.abs(x) >= 10000 ? (x / 1000).toFixed(1) + ' km' : x.toFixed(0) + ' m';
  return `height ${km(f.alt)}\nspeed  ${v.toFixed(0)} m/s\nup     ${vr.toFixed(0)} m/s\nfuel   ${st ? (100 * st.fuel / st.fuelMax).toFixed(0) : 0} %\nstage  ${f.capsuleOnly ? 'capsule' : (f.si + 1) + '/' + f.stages.length}\ntop    ${km(f.maxAlt)}\napo    ${o.escape ? 'escape' : km(o.apo)}\nperi   ${o.escape ? '-' : km(o.peri)}${f.plasma > 0 ? `\nheat   ${(f.heat * 100).toFixed(0)} %` : ''}${simSpeed > 1 ? `\ntime   ${simSpeed}x` : ''}`;
}

function updateSmoke(dt, base) {
  // re-anchor near the rocket so numbers stay small on the GPU
  const ax = Math.round(base.x / 1000) * 1000, ay = Math.round(base.y / 1000) * 1000;
  smoke.mesh.position.set(ax, ay, 0);
  let n = 0; const o = smoke.off.array, d = smoke.dat.array;
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.age += dt;
    if (p.age > p.life) { parts.splice(i, 1); continue; }
    const k = Math.exp(-dt * 0.9); p.vx *= k; p.vy *= k; p.vz *= k;
    const r = Math.hypot(p.x, p.y); p.vx += p.x / r * 1.2 * dt; p.vy += p.y / r * 1.2 * dt;  // warm smoke rises a little
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
  }
  for (const p of parts) {
    const t = p.age / p.life;
    o[n * 3] = p.x - ax; o[n * 3 + 1] = p.y - ay; o[n * 3 + 2] = p.z;
    d[n * 4] = p.s0 + (p.s1 - p.s0) * Math.sqrt(t);
    d[n * 4 + 1] = p.a * Math.min(1, t * 8) * (1 - t) * (1 - t);
    d[n * 4 + 2] = p.seed; d[n * 4 + 3] = p.warm * Math.max(0, 1 - t * 4);
    n++;
  }
  smoke.g.instanceCount = n; smoke.off.needsUpdate = true; smoke.dat.needsUpdate = true;
}
function updatePuffs() {
  const camAlt = camera.position.length() - R;
  puffs.mesh.visible = camAlt < 14000;
  if (!puffs.mesh.visible) return;
  const ax = 0, ay = R + 2300; puffs.mesh.position.set(ax, ay, 0);
  const o = puffs.off.array, d = puffs.dat.array;
  puffList.forEach((p, i) => {
    o[i * 3] = p.x - ax; o[i * 3 + 1] = p.y - ay; o[i * 3 + 2] = p.z;
    d[i * 4] = p.size; d[i * 4 + 1] = 0.85; d[i * 4 + 2] = p.seed; d[i * 4 + 3] = 0;
  });
  puffs.g.instanceCount = puffList.length; puffs.off.needsUpdate = true; puffs.dat.needsUpdate = true;
  // light direction in screen space for the puffs' shading
  const s = SUN.clone().transformDirection(camera.matrixWorldInverse);
  puffs.mat.uniforms.uSun2.value.set(s.x, s.y).normalize();
  smoke.mat.uniforms.uSun2.value.set(s.x, s.y).normalize();
}

// camera: hangar showcase, then a chase view that tilts down as you climb so the curve of the planet shows
let uiPad = { top: 80, bottom: 200 };
function updateCamera(dt, base, dir, up, alt) {
  const east = new THREE.Vector3(up.y, -up.x, 0);
  const H = rocketDims.height;
  let target, dist, el, az = 0;
  const center = base.clone().addScaledVector(dir, H * 0.5);
  const fovT = Math.tan(camera.fov * DEG / 2);
  if (mode === 'hangar' || !F) {
    hangarT += dt;
    const avail = Math.max(0.35, 1 - (uiPad.top + uiPad.bottom) / Math.max(1, canvas.clientHeight));
    dist = (H * 0.5 + 2) / (fovT * avail * 0.88);
    if (camera.aspect < 0.8) dist = Math.max(dist, (H * 0.5 + 2.5) / (fovT * avail * 0.95));
    dist = Math.max(dist, 16);
    el = 4 * DEG; az = 0.55 * Math.sin(hangarT * 0.18) + 0.25;
    target = center;
  } else {
    const chuteOpen = F.chuteOn ? F.chute : 0;
    dist = 20 + H * 1.5 + chuteOpen * 26 + Math.min(20, Math.hypot(F.vx, F.vy) / 60);
    el = (6 + 26 * smoothstep(400, 45000, alt)) * DEG;
    target = center.clone().addScaledVector(up, chuteOpen * 9);
    az = 0.12 * Math.sin(clock * 0.05);
  }
  const off = new THREE.Vector3()
    .addScaledVector(Z, Math.cos(az) * Math.cos(el))
    .addScaledVector(east, Math.sin(az) * Math.cos(el))
    .addScaledVector(up, Math.sin(el)).multiplyScalar(dist);
  const want = target.clone().add(off);
  // keep the camera above the ground
  const wr = want.length(); if (wr < R + 2.5) want.multiplyScalar((R + 2.5) / wr);
  if (!camSmooth) camSmooth = { pos: want.clone(), tgt: target.clone(), up: up.clone() };
  const k = 1 - Math.exp(-dt * 6);
  // follow position exactly along the flight (no lag at 2 km/s), smooth only the framing offset
  camSmooth.off = camSmooth.off ? camSmooth.off.lerp(off, k) : off.clone();
  camSmooth.up.lerp(up, k).normalize();
  camera.position.copy(target).add(camSmooth.off);
  const cr = camera.position.length(); if (cr < R + 2.5) camera.position.multiplyScalar((R + 2.5) / cr);
  camera.up.copy(camSmooth.up);
  camera.lookAt(target);
  // launch rumble
  if (F && mode === 'flight' && F.thr > 0 && F.alt < 300) {
    const s = 0.06 * (1 - F.alt / 300);
    camera.position.addScaledVector(east, (Math.random() - 0.5) * s * dist * 0.05).addScaledVector(up, (Math.random() - 0.5) * s * dist * 0.05);
  }
  camera.updateMatrixWorld();
  const camAlt = camera.position.length() - R;
  skyMat.uniforms.uUp.value.copy(camera.position).normalize();
  skyMat.uniforms.uCamR.value = R + camAlt;
  skyMat.uniforms.uCamAlt.value = camAlt;
  skyMat.uniforms.uTime.value = clock;
}
function smoothstep(a, b, x) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

// ---------------------------------------------------------------- resize + loop
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w / h < 0.7 ? 58 : 50;
  const topEl = document.querySelector('.top'), botEl = ui.hangar;
  uiPad.top = topEl ? topEl.getBoundingClientRect().bottom : 80;
  uiPad.bottom = botEl && !botEl.hidden ? h - botEl.getBoundingClientRect().top + 10 : 200;
  const shift = (uiPad.bottom - uiPad.top) / 2;
  camera.setViewOffset(w, h, 0, mode === 'hangar' ? shift : 0, w, h);
  camera.updateProjectionMatrix();
  setLean(lean);
  starScale();
}
function starScale() { skyMat.uniforms.uStar.value = Math.max(260, canvas.clientHeight * dpr * 0.32); }
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));

let last = performance.now(), frameAvg = 16, perfT = 0, lastMode = mode;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000; last = now;
  if (!(dt > 0)) dt = 1 / 60;
  dt = Math.min(dt, 0.1);           // a hidden tab pauses instead of jumping ahead
  if (mode !== lastMode) { lastMode = mode; resize(); }
  update(dt);
  skyMat.uniforms.uInvProj.value.copy(camera.projectionMatrixInverse);
  skyMat.uniforms.uCamRot.value.extractRotation(camera.matrixWorld);
  renderer.render(scene, camera);
  // keep it smooth on slower phones: step the resolution down if frames run long
  frameAvg = frameAvg * 0.95 + dt * 1000 * 0.05; perfT += dt;
  if (perfT > 3 && frameAvg > 24 && dpr > 1) { dpr = Math.max(1, dpr - 0.25); resize(); perfT = 0; }
}

// ---------------------------------------------------------------- start
applyNums(); applySound(); refreshHangar(); resize();
setTimeout(() => makePlanetImage(448), 600);
requestAnimationFrame((t) => { last = t; frame(t); });
setTimeout(() => ui.loading.classList.add('done'), 250);
document.addEventListener('visibilitychange', () => { if (document.hidden) sound.engine(0, 1); last = performance.now(); });

// test hook for automated checks (harmless for players)
window.__rocket = { get fps() { return 1000 / frameAvg; }, get dpr() { return dpr; }, get F() { return F; }, get mode() { return mode; }, get save() { return save; },
  get act() { return actKind; }, get simSpeed() { return simSpeed; }, get planetReady() { return !!planetImg; }, setLean, doAction: () => F && doAction(F), setTurbo: (k) => { turbo = k; }, R };

