// Heartbeat Rocket v1 - working title "Rocket".
// Real physics in one flat plane (2D: inverse-square gravity, thrust, fuel mass, drag that thins with height),
// drawn in real-looking 3D with three.js. A small planet like Kerbal's: radius 600 km, surface gravity 9.81,
// air up to 70 km, so orbit is about 2.3 km/s. Built by Claude (Opus 5.5) for Heartbeat Observatory. CC0.
import * as THREE from 'three';

// ---------------------------------------------------------------- planet + parts
const R = 600000, G0 = 9.81, GM = G0 * R * R;
const ATM_TOP = 70000, H_SCALE = 5600, RHO0 = 1.225;
const PAD_H = 1.5, SITE_R = 14;           // launch pad top height and radius (m)
const STEP = 1 / 120;                     // fixed physics step (s)
const MAX_LEAN = Math.PI / 2;             // full slider = lean 90 degrees from straight up
const CHUTE_CDA = 450, CHUTE_MAX_G = 6, SAFE_LAND = 14;
const DEG = Math.PI / 180;

const NOSES = {
  capsule: { name: 'Capsule', m: 900, cda: 1.3 },
  pointy:  { name: 'Pointy',  m: 860, cda: 1.0 },
};
const TANKS = {
  short:  { name: 'Short',  fuel: 800,  dry: 180, h: 3.0 },
  medium: { name: 'Medium', fuel: 3000, dry: 330, h: 5.6 },
  tall:   { name: 'Tall',   fuel: 7200, dry: 750, h: 9.6 },
};
const ENGINES = {
  small: { name: 'Small', thrust: 56000,  ispSL: 230, ispVac: 270, m: 450,  bellR: 0.72, bellH: 1.35 },
  big:   { name: 'Big',   thrust: 150000, ispSL: 265, ispVac: 310, m: 1300, bellR: 1.12, bellH: 2.15 },
};
const FINS_M = 120, FINS_CDA = 0.15;

const GOALS = [
  { id: 'clouds', alt: 2000,  title: 'Touch the clouds', done: 'You touched the clouds!', unlock: 'fins',
    unlockText: 'New part: fins', unlockSub: 'Fins help your rocket fly straighter.' },
  { id: 'space',  alt: 70000, title: 'Reach space', done: 'You reached space!', unlock: 'tall',
    unlockText: 'New part: the tall tank', unlockSub: 'Lots more fuel. Enough to go around the planet?' },
  { id: 'orbit',  alt: null,  title: 'Go all the way around', done: 'You went all the way around the planet!', unlock: null,
    unlockText: 'You are in orbit!', unlockSub: 'Stages and the trip home come in the next version.' },
];

// ---------------------------------------------------------------- saved progress (this device only)
const SAVE_KEY = 'hb-rocket-v1';
const DEFAULT_SAVE = {
  v: 1, reached: { clouds: false, space: false, orbit: false }, unlocked: { fins: false, tall: false },
  seen: { fins: true, tall: true }, config: { nose: 'capsule', tank: 'short', engine: 'small', fins: true },
  nums: false, sound: true, best: 0, flights: 0,
};
function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return structuredClone(DEFAULT_SAVE);
    const s = JSON.parse(raw);
    const out = structuredClone(DEFAULT_SAVE);
    for (const k of Object.keys(out)) if (s[k] !== undefined) out[k] = (typeof out[k] === 'object') ? { ...out[k], ...s[k] } : s[k];
    if (!TANKS[out.config.tank] || (out.config.tank === 'tall' && !out.unlocked.tall)) out.config.tank = 'short';
    if (!NOSES[out.config.nose]) out.config.nose = 'capsule';
    if (!ENGINES[out.config.engine]) out.config.engine = 'small';
    return out;
  } catch (e) { return structuredClone(DEFAULT_SAVE); }
}
let save = loadSave();
function writeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* private mode: play on */ } }
function currentGoal() { return GOALS.find(g => !save.reached[g.id]) || null; }

// ---------------------------------------------------------------- dom
const $ = id => document.getElementById(id);
const canvas = $('c');
const ui = {
  goalText: $('goalText'), hangar: $('hangarUI'), flight: $('flightUI'), parts: $('parts'),
  vNose: $('vNose'), vTank: $('vTank'), vEngine: $('vEngine'), vFins: $('vFins'), pFins: $('pFins'),
  newFins: $('newFins'), newTank: $('newTank'), tip: $('hangarTip'),
  fuelFill: $('fuelFill'), progFill: $('progFill'), progDot: $('progDot'), progGoal: $('progGoal'),
  leanTrack: $('leanTrack'), leanThumb: $('leanThumb'), chute: $('btnChute'), ff: $('ff'),
  toast: $('toast'), nums: $('nums'), btnNums: $('btnNums'), btnSound: $('btnSound'),
  card: $('card'), cardArt: $('cardArt'), cardTitle: $('cardTitle'), cardText: $('cardText'),
  cardUnlock: $('cardUnlock'), cardNext: $('cardNext'), cardBtn: $('cardBtn'),
  mapWrap: $('mapWrap'), map: $('map'), loading: $('loading'),
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
        col = alb * (SUNC * sunT * ndl / 3.14159 + amb);
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
function tankTexture(heightM) {
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
    g.fillStyle = '#e8742c'; g.fillRect(0, 14, w, 16);
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
};
const tankTex = {}; for (const k of Object.keys(TANKS)) tankTex[k] = tankTexture(TANKS[k].h);
const tankMats = {}; for (const k of Object.keys(TANKS)) tankMats[k] = new THREE.MeshStandardMaterial({ map: tankTex[k], roughness: 0.42, metalness: 0.05 });
const stdMats = [...Object.values(M), ...Object.values(tankMats)];

// ---------------------------------------------------------------- the rocket model
const rocket = new THREE.Group(); scene.add(rocket);
const rocketBody = new THREE.Group(); rocket.add(rocketBody);
let rocketDims = { height: 10, bellR: 0.7, top: 10 };

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

function buildRocket(cfg, finsOn) {
  while (rocketBody.children.length) rocketBody.remove(rocketBody.children[0]);
  const E = ENGINES[cfg.engine], T = TANKS[cfg.tank];
  let y = 0;
  // engine: bell + mount + pumps
  const bell = new THREE.Mesh(cached('bell' + cfg.engine, () => bellGeometry(E.bellR, E.bellH)), M.bell);
  rocketBody.add(bell);
  y = E.bellH;
  const mount = new THREE.Mesh(cached('mount' + cfg.engine, () => new THREE.CylinderGeometry(1.2, E.bellR * 0.5, 0.55, 32)), M.dark);
  mount.position.y = y + 0.27; rocketBody.add(mount);
  if (cfg.engine === 'big') {
    const pump = new THREE.Mesh(cached('pump', () => new THREE.CylinderGeometry(0.16, 0.16, 0.7, 12)), M.metal);
    pump.position.set(0.55, y + 0.05, 0.25); rocketBody.add(pump);
    const pump2 = pump.clone(); pump2.position.set(-0.5, y + 0.05, -0.3); rocketBody.add(pump2);
  }
  y += 0.55;
  const ring = cached('ring', () => new THREE.CylinderGeometry(1.29, 1.29, 0.16, 40));
  const r1 = new THREE.Mesh(ring, M.dark); r1.position.y = y + 0.08; rocketBody.add(r1); y += 0.16;
  // tank
  const tank = new THREE.Mesh(cached('tank' + cfg.tank, () => new THREE.CylinderGeometry(1.25, 1.25, T.h, 48, 1, true)), tankMats[cfg.tank]);
  tank.rotation.y = Math.PI; tank.position.y = y + T.h / 2; rocketBody.add(tank);
  if (finsOn) {
    const fg = cached('fin', finGeometry);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4;
      const f = new THREE.Mesh(fg, M.orange);
      f.position.set(Math.sin(a) * 1.22, y - 0.6, Math.cos(a) * 1.22);
      f.rotation.y = a - Math.PI / 2; rocketBody.add(f);
    }
  }
  y += T.h;
  const r2 = new THREE.Mesh(ring, M.dark); r2.position.y = y + 0.08; rocketBody.add(r2); y += 0.16;
  // nose
  if (cfg.nose === 'capsule') {
    const cap = new THREE.Mesh(cached('capsule', () => lathe([[1.27, 0], [1.29, 0.1], [1.2, 0.3], [0.95, 1.0], [0.64, 1.7], [0.5, 1.95], [0.48, 2.25], [0.4, 2.33], [0, 2.35]], 48)), M.white);
    cap.position.y = y; rocketBody.add(cap);
    const sh = new THREE.Mesh(cached('shield', () => new THREE.CylinderGeometry(1.3, 1.28, 0.12, 40)), M.shield);
    sh.position.y = y + 0.06; rocketBody.add(sh);
    const win = new THREE.Mesh(cached('win', () => new THREE.CircleGeometry(0.2, 24)), M.glass);
    win.position.set(0, y + 1.15, 0.86); win.rotation.x = -0.42; rocketBody.add(win);
    const win2 = win.clone(); win2.position.set(0.62, y + 0.95, 0.68); win2.rotation.set(-0.3, 0.75, 0); win2.scale.setScalar(0.7); rocketBody.add(win2);
    y += 2.35;
  } else {
    const pts = []; const L = 3.5;
    for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push([1.26 * Math.pow(1 - Math.pow(t, 1.9), 0.62), t * L]); }
    pts.push([0, L]);
    const cone = new THREE.Mesh(cached('pointy', () => lathe(pts, 48)), M.white);
    cone.position.y = y; rocketBody.add(cone);
    const win = new THREE.Mesh(cached('win', () => new THREE.CircleGeometry(0.2, 24)), M.glass);
    win.position.set(0, y + 1.25, 0.98); win.rotation.x = -0.35; win.scale.setScalar(0.85); rocketBody.add(win);
    const tip = new THREE.Mesh(cached('tip', () => new THREE.SphereGeometry(0.09, 12, 8)), M.dark);
    tip.position.y = y + L; rocketBody.add(tip);
    y += L;
  }
  rocketDims = { height: y, bellR: E.bellR, top: y };
  chute.position.y = y;
}

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
let mode = 'hangar';          // hangar | flight | result
let F = null;                 // current flight
let lean = 0;                 // slider -1..1
let simAcc = 0, simSpeed = 1, clock = 0, hangarT = 0;
const camPos = new THREE.Vector3(), camTarget = new THREE.Vector3();
let camSmooth = null;

function cfgFins() { return !!(save.unlocked.fins && save.config.fins); }
function rocketMass(cfg) { const N = NOSES[cfg.nose], T = TANKS[cfg.tank], E = ENGINES[cfg.engine]; return { dry: N.m + T.dry + E.m + (cfgFins() ? FINS_M : 0), fuel: T.fuel }; }

function newFlight() {
  const cfg = save.config, E = ENGINES[cfg.engine], T = TANKS[cfg.tank], N = NOSES[cfg.nose];
  const fins = cfgFins(), m = rocketMass(cfg);
  return {
    x: 0, y: R + PAD_H, vx: 0, vy: 0, heading: 0, fuel: T.fuel, fuelMax: T.fuel, dry: m.dry,
    cda: N.cda + (fins ? FINS_CDA : 0), fins, eng: E, mdot: E.thrust / (E.ispVac * G0), engineOn: true, ign: 0,
    lifted: false, t: 0, maxAlt: 0, chute: 0, chuteOn: false, outcome: null, newGoals: [], leanLow: 0,
    sputter: 0, wob: 0, endIn: -1, track: [], hit: 0, alt: PAD_H, air: 1, q: 0, thr: 0, exploded: false,
  };
}

// ---------------------------------------------------------------- physics (fixed step)
function wrapA(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }
function stepPhysics(f, dt) {
  const r = Math.hypot(f.x, f.y), h = r - R, ux = f.x / r, uy = f.y / r;
  const phi = Math.atan2(f.x, f.y);
  const rho = h < ATM_TOP ? RHO0 * Math.exp(-h / H_SCALE) : 0, air = rho / RHO0;
  const v2 = f.vx * f.vx + f.vy * f.vy, v = Math.sqrt(v2), q = 0.5 * rho * v2;
  const m = f.dry + f.fuel;
  const burning = f.engineOn && f.fuel > 0;
  f.air = air; f.q = q;

  // without fins, the rocket wobbles when the air pushes hard on it
  const wAmp = (f.fins ? 0.12 : 1) * Math.min(9, q / 2500) * DEG;
  f.wob = wAmp * (0.7 * Math.sin(f.t * 2.3) + 0.3 * Math.sin(f.t * 5.3 + 1));

  let target = null, rate = 0;
  if (burning) { target = f.lifted ? phi + lean * MAX_LEAN + f.wob : phi; rate = 30 * DEG; }
  else if (f.chuteOn && v > 0.5) { target = Math.atan2(-f.vx, -f.vy); rate = 120 * DEG * f.chute; }
  else if (q > 30 && v > 5) { target = Math.atan2(f.vx, f.vy); rate = Math.min(50, q / 250) * DEG; }
  if (target !== null) { const dA = wrapA(target - f.heading), mx = rate * dt; f.heading += Math.max(-mx, Math.min(mx, dA)); }

  let ax = -GM * ux / (r * r), ay = -GM * uy / (r * r);
  f.thr = 0;
  if (burning) {
    f.ign = Math.min(1, f.ign + dt / 0.8);
    const isp = f.eng.ispSL * air + f.eng.ispVac * (1 - air);
    const thrust = f.mdot * isp * G0 * f.ign;
    f.thr = thrust;
    ax += thrust / m * Math.sin(f.heading); ay += thrust / m * Math.cos(f.heading);
    f.fuel -= f.mdot * f.ign * dt;
    if (f.fuel <= 0) { f.fuel = 0; f.engineOn = false; f.sputter = 0.9; sound.cough(); }
    if (f.lifted && h < 8000) f.leanLow = Math.max(f.leanLow, Math.abs(lean));
  }
  if (rho > 0 && v > 0.01) {
    const aoa = wrapA(f.heading - Math.atan2(f.vx, f.vy));
    const s = Math.sin(aoa);
    let D = q * f.cda * (1 + (v > 30 ? 1.5 * s * s : 0));
    let Dc = q * CHUTE_CDA * f.chute * f.chute; Dc = Math.min(Dc, m * G0 * CHUTE_MAX_G);
    D += Dc;
    ax -= D / m * f.vx / v; ay -= D / m * f.vy / v;
  }
  if (f.chuteOn) f.chute = Math.min(1, f.chute + dt / 2.5);

  f.vx += ax * dt; f.vy += ay * dt;
  const nx = f.x + f.vx * dt, ny = f.y + f.vy * dt, nr = Math.hypot(nx, ny), nh = nr - R;
  const onPadSpot = Math.hypot(nx, ny - R) < SITE_R;   // near the pad (it is at the top of the planet)
  const floor = (!f.lifted || onPadSpot) ? PAD_H : 0;
  if (nh <= floor) {
    const nux = nx / nr, nuy = ny / nr;
    if (!f.lifted) { f.vx = 0; f.vy = 0; f.x = nux * (R + PAD_H); f.y = nuy * (R + PAD_H); }
    else { f.x = nux * (R + floor); f.y = nuy * (R + floor); touchdown(f, Math.hypot(f.vx, f.vy)); return; }
  } else { f.x = nx; f.y = ny; }
  if (nh > PAD_H + 3) f.lifted = true;
  f.t += dt;
  f.alt = nh;
  if (nh > f.maxAlt) f.maxAlt = nh;
}

function touchdown(f, speed) {
  f.engineWasOnAtHit = f.engineOn && f.fuel > 0;
  f.vx = 0; f.vy = 0; f.engineOn = false;
  if (speed < SAFE_LAND) { f.outcome = 'landed'; f.endIn = 1.4; sound.burst(0.3, 300, 0.4); }
  else { f.outcome = 'crash'; f.endIn = 2.0; f.hit = speed; explode(f); }
}

function explode(f) {
  f.exploded = true; sound.thud();
  rocket.visible = false;
  const ux = f.x / Math.hypot(f.x, f.y), uy = f.y / Math.hypot(f.x, f.y);
  for (let i = 0; i < 70; i++) {
    const a = Math.random() * Math.PI * 2, sp = 4 + Math.random() * 14, up = 3 + Math.random() * 12;
    spawnSmoke(f.x + ux * 3, f.y + uy * 3, (Math.random() - 0.5) * 4,
      Math.cos(a) * sp * uy + ux * up, -Math.cos(a) * sp * ux + uy * up, Math.sin(a) * sp,
      3 + Math.random() * 3, 3 + Math.random() * 3, 12 + Math.random() * 10, 0.8, i < 30 ? 1.2 : 0.3);
  }
}

function orbitInfo(f) {
  const r = Math.hypot(f.x, f.y), v2 = f.vx * f.vx + f.vy * f.vy;
  const E = 0.5 * v2 - GM / r, hm = f.x * f.vy - f.y * f.vx;
  if (E >= 0) return { escape: true, peri: 0, apo: Infinity };
  const a = -GM / (2 * E), e = Math.sqrt(Math.max(0, 1 + 2 * E * hm * hm / (GM * GM)));
  return { escape: false, peri: a * (1 - e) - R, apo: a * (1 + e) - R };
}

// ---------------------------------------------------------------- flight events (goals, results)
function checkGoals(f) {
  for (const g of GOALS) {
    if (g.alt == null || save.reached[g.id] || f.newGoals.includes(g)) continue;
    if (f.maxAlt >= g.alt) reachGoal(f, g);
  }
  if (!f.engineOn && f.alt > ATM_TOP && !f.outcome) {
    const o = orbitInfo(f);
    if (o.escape) { f.outcome = 'escape'; f.endIn = 2.5; }
    else if (o.peri > ATM_TOP) {
      const g = GOALS[2]; if (!save.reached.orbit) reachGoal(f, g);
      f.outcome = 'orbit'; f.endIn = 3.0;
    }
  }
}
function reachGoal(f, g) {
  f.newGoals.push(g);
  save.reached[g.id] = true;
  if (g.unlock) { save.unlocked[g.unlock] = true; save.seen[g.unlock] = false; }
  if (g.unlock === 'fins') save.config.fins = true;
  writeSave();
  sound.chime(true);
  toast(g.done, g.unlockText);
  setGoalText();
  ui.progGoal.style.backgroundImage = progIcon();
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
  orbit: '<svg viewBox="0 0 120 90"><circle cx="60" cy="45" r="24" fill="#3d6fb6"/><ellipse cx="60" cy="45" rx="50" ry="22" fill="none" stroke="#f07a2e" stroke-width="3" stroke-dasharray="6 5"/><circle cx="110" cy="45" r="5" fill="#fff"/></svg>',
  chute: '<svg viewBox="0 0 120 90"><path d="M20 40a40 30 0 0 1 80 0z" fill="#e8642a"/><path d="M40 40a20 30 0 0 1 40 0z" fill="#f6f2ea"/><path d="M20 40l36 36M100 40l-36 36M60 40v34" stroke="#d8d2c4" stroke-width="1.5"/><rect x="52" y="72" width="16" height="12" rx="3" fill="#f1efe9"/></svg>',
  puff: '<svg viewBox="0 0 120 90"><circle cx="45" cy="52" r="20" fill="#9a958e"/><circle cx="70" cy="46" r="24" fill="#b9b4ac"/><circle cx="58" cy="62" r="18" fill="#d8d3cb"/><circle cx="84" cy="62" r="13" fill="#a7a29a"/><path d="M28 70l-10 8M96 70l10 8M60 22v-10" stroke="#f0b53a" stroke-width="4" stroke-linecap="round"/></svg>',
  heavy: '<svg viewBox="0 0 120 90"><rect x="30" y="64" width="60" height="10" rx="3" fill="#8d8a83"/><rect x="50" y="18" width="20" height="44" rx="4" fill="#f1efe9"/><path d="M50 18l10-12 10 12z" fill="#f1efe9"/><path d="M38 80q22-14 44 0" stroke="#f0b53a" stroke-width="4" fill="none" stroke-linecap="round"/></svg>',
};

function showResult(f) {
  const got = f.newGoals;
  let art, title, text = '', unlock = '', next = '';
  const cur = currentGoal();
  if (got.length) {
    const top = got[got.length - 1];
    art = top.id === 'clouds' ? ART.cloud : top.id === 'space' ? ART.space : ART.orbit;
    title = top.done;
    if (f.outcome === 'landed') text = got.length > 1 ? 'Clouds and space in one flight! And you landed safely.' : 'And your capsule landed safely.';
    else if (f.outcome === 'crash') text = 'The landing was a bit bumpy, but you did it!';
    else if (f.outcome === 'orbit') text = 'Your rocket is falling sideways so fast that it keeps missing the ground.';
    else if (got.length > 1) text = 'Clouds and space in one flight!';
    unlock = got.filter(g => g.unlock).map(g => `${g.unlockText}<small>${g.unlockSub}</small>`).join('');
    if (!unlock && top.id === 'orbit') unlock = `${top.unlockText}<small>${top.unlockSub}</small>`;
  } else {
    const hint = hintFor(f, cur);
    art = hint.art; title = hint.title; text = hint.text;
  }
  if (cur) next = `Next goal: <b>${cur.title}</b>`;
  ui.cardArt.innerHTML = art;
  ui.cardTitle.textContent = title;
  ui.cardText.textContent = text; ui.cardText.hidden = !text;
  ui.cardUnlock.innerHTML = unlock; ui.cardUnlock.hidden = !unlock;
  ui.cardNext.innerHTML = next; ui.cardNext.hidden = !next;
  ui.card.hidden = false;
  ui.chute.hidden = true; ui.ff.hidden = true;
  setTimeout(() => ui.cardBtn.focus({ preventScroll: true }), 50);
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
function hintFor(f, goal) {
  if (f.outcome === 'heavy') return { art: ART.heavy, title: 'Too heavy to lift off!',
    text: 'The small engine can\'t push that much fuel. Try the big engine?' };
  if (f.outcome === 'crash') {
    if (f.leanLow > 0.5 || f.engineWasOnAtHit) return { art: ART.puff, title: 'Bonk!',
      text: 'Leaning a lot sent your rocket sideways into the ground. Go straight up first, then lean just a little.' };
    return { art: ART.puff, title: 'Bonk!', text: 'It came down too fast. The parachute needs a little time to open, so open it early.' };
  }
  if (f.outcome === 'escape') return { art: ART.space, title: 'Wow, it flew away!', text: 'Your rocket is going so fast it will never come back. That is called escape speed.' };
  if (f.outcome === 'orbit') return { art: ART.orbit, title: 'Around and around!', text: 'You are in orbit again.' };
  if (!goal) return { art: ART.chute, title: 'Nice flight!', text: 'You have done every goal in this version. More is coming soon.' };
  const frac = goal.alt ? f.maxAlt / goal.alt : 0;
  if (goal.id === 'orbit') return { art: ART.chute, title: 'Nice flight!',
    text: f.maxAlt < ATM_TOP ? 'To go all the way around, first get to space, then lean far over so you fly sideways really fast.'
      : 'You went up and came back down. To go around, lean over more once you are high up, so you fly sideways faster.' };
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
  toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 3200);
}
function setGoalText() { const g = currentGoal(); ui.goalText.textContent = g ? g.title : 'Fly anywhere you like'; }

function refreshHangar() {
  const c = save.config;
  ui.vNose.textContent = NOSES[c.nose].name;
  ui.vTank.textContent = TANKS[c.tank].name;
  ui.vEngine.textContent = ENGINES[c.engine].name;
  ui.pFins.hidden = !save.unlocked.fins;
  ui.parts.classList.toggle('four', save.unlocked.fins);
  ui.vFins.textContent = c.fins ? 'On' : 'Off';
  ui.newFins.hidden = save.seen.fins !== false;
  ui.newTank.hidden = save.seen.tall !== false;
  ui.tip.textContent = save.flights === 0 ? 'Tap a part to change it' : '';
  ui.tip.hidden = save.flights !== 0;
  buildRocket(c, cfgFins());
  setGoalText();
  pop = 1;
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
function tapSound() { sound.init(); sound.burst(0.08, 1800, 0.25); }

ui.btnLaunchEl.addEventListener('click', () => { sound.init(); startFlight(); });
$('btnHome').addEventListener('click', () => {
  if (F && F.newGoals.length && mode === 'flight') { finishFlight(); return; }
  toHangar();
});
ui.cardBtn.addEventListener('click', toHangar);
ui.chute.addEventListener('click', () => { if (F) openChute(F); });
$('btnMap').addEventListener('click', () => { ui.mapWrap.hidden = false; drawMap(); });
$('btnMapClose').addEventListener('click', () => { ui.mapWrap.hidden = true; });

ui.btnNums.addEventListener('click', () => { save.nums = !save.nums; writeSave(); applyNums(); });
function applyNums() { ui.btnNums.setAttribute('aria-pressed', String(save.nums)); ui.nums.hidden = !save.nums; }
ui.btnSound.addEventListener('click', () => { save.sound = !save.sound; writeSave(); sound.init(); sound.setMuted(!save.sound); applySound(); });
function applySound() { ui.btnSound.classList.toggle('off', !save.sound); ui.btnSound.setAttribute('aria-label', save.sound ? 'Sound on' : 'Sound off'); }

// lean slider: press anywhere on the track, drag; snaps to the middle notch
{
  const tr = ui.leanTrack; let active = null;
  const setFrom = (clientX) => {
    const r = tr.getBoundingClientRect(), half = 38;
    let v = ((clientX - r.left - half) / (r.width - half * 2)) * 2 - 1;
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
function setLean(v) {
  lean = v;
  const r = ui.leanTrack.clientWidth, half = 38;
  ui.leanThumb.style.transform = `translateX(${v * (r / 2 - half - 6)}px)`;
  ui.leanTrack.setAttribute('aria-valuenow', v.toFixed(2));
}
window.addEventListener('keydown', (e) => {
  if (mode !== 'flight') { if (mode === 'hangar' && (e.key === ' ' || e.key === 'Enter') && document.activeElement === document.body) startFlight(); return; }
  if (e.key === 'a' || e.key === 'ArrowLeft') { if (document.activeElement !== ui.leanTrack) setLean(Math.max(-1, lean - 0.1)); }
  if (e.key === 'd' || e.key === 'ArrowRight') { if (document.activeElement !== ui.leanTrack) setLean(Math.min(1, lean + 0.1)); }
  if (e.key === 'p' && F) openChute(F);
  if (e.key === 'm') { ui.mapWrap.hidden = !ui.mapWrap.hidden; if (!ui.mapWrap.hidden) drawMap(); }
});

function openChute(f) {
  if (f.chuteOn || f.engineOn && f.fuel > 0) return;
  f.chuteOn = true; chute.visible = true; ui.chute.hidden = true; sound.burst(0.5, 1200, 0.35);
}

function startFlight() {
  if (mode !== 'hangar') return;
  F = newFlight(); mode = 'flight';
  save.seen.fins = true; save.seen.tall = true; writeSave();
  parts.length = 0; rocket.visible = true; chute.visible = false; chute.scale.setScalar(0.01);
  setLean(0); simAcc = 0;
  ui.hangar.hidden = true; ui.flight.hidden = false; document.body.classList.add('flying');
  ui.card.hidden = true; ui.mapWrap.hidden = true; ui.chute.hidden = true;
  ui.progGoal.style.backgroundImage = progIcon();
}
function toHangar() {
  mode = 'hangar'; F = null; parts.length = 0;
  ui.card.hidden = true; ui.mapWrap.hidden = true; ui.flight.hidden = true; ui.hangar.hidden = false;
  document.body.classList.remove('flying');
  rocket.visible = true; chute.visible = false; camSmooth = null;
  sound.engine(0, 1);
  refreshHangar();
}
function progIcon() {
  const g = currentGoal();
  const svg = !g || g.id === 'clouds'
    ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80"><path d="M30 66c-12 0-20-8-20-18s8-18 19-18c3-12 13-20 26-20 14 0 25 9 27 22 11 0 20 8 20 17s-8 17-19 17z" fill="#fff"/></svg>'
    : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2l3 7 7 .6-5.4 4.6 1.7 7.3L12 17.6 5.7 21.5l1.7-7.3L2 9.6 9 9z" fill="#ffd36a"/></svg>';
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

// ---------------------------------------------------------------- map (zoomed-out planet + predicted path)
function predictPath(f) {
  const pts = []; let x = f.x, y = f.y, vx = f.vx, vy = f.vy;
  const o = orbitInfo(f); const span = Math.max(4000, Math.min(60, (o.apo === Infinity ? 1e6 : o.apo + R) / 2000));
  let ang = 0, last = Math.atan2(x, y);
  for (let i = 0; i < 1500; i++) {
    const r = Math.hypot(x, y); if (r < R) break;
    const dt = Math.max(1, Math.min(30, (r - R) / 2000 + 1));
    const a = -GM / (r * r * r); vx += a * x * dt; vy += a * y * dt; x += vx * dt; y += vy * dt;
    const na = Math.atan2(x, y); ang += Math.abs(wrapA(na - last)); last = na;
    if (i % 2 === 0) pts.push([x, y]);
    if (ang > Math.PI * 2.02) break;
    if (r > R * 8) break;
  }
  return pts;
}
function drawMap() {
  if (ui.mapWrap.hidden || !F) return;
  const cv = ui.map, w = cv.clientWidth, h = cv.clientHeight, pr = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== Math.round(w * pr)) { cv.width = Math.round(w * pr); cv.height = Math.round(h * pr); }
  const g = cv.getContext('2d'); g.setTransform(pr, 0, 0, pr, 0, 0); g.clearRect(0, 0, w, h);
  const path = predictPath(F);
  let ext = R + Math.max(160000, F.maxAlt * 1.2);
  for (const p of path) ext = Math.max(ext, Math.hypot(p[0], p[1]) * 1.05);
  ext = Math.min(ext, R * 4);
  const s = Math.min(w, h) * 0.42 / ext, cx = w / 2, cy = h / 2;
  const P = (x, y) => [cx + x * s, cy - y * s];
  const at = g.createRadialGradient(cx, cy, R * s, cx, cy, (R + ATM_TOP) * s);
  at.addColorStop(0, 'rgba(110,170,255,.45)'); at.addColorStop(1, 'rgba(110,170,255,0)');
  g.fillStyle = at; g.beginPath(); g.arc(cx, cy, (R + ATM_TOP) * s, 0, Math.PI * 2); g.fill();
  const pg = g.createRadialGradient(cx - R * s * 0.4, cy - R * s * 0.4, R * s * 0.1, cx, cy, R * s);
  pg.addColorStop(0, '#5f9be0'); pg.addColorStop(1, '#1d3d6e');
  g.fillStyle = pg; g.beginPath(); g.arc(cx, cy, R * s, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(90,150,80,.8)'; g.beginPath(); g.ellipse(cx, cy - R * s * 0.6, R * s * 0.35, R * s * 0.25, 0, 0, Math.PI * 2); g.fill();
  // where we've been
  g.strokeStyle = 'rgba(255,248,236,.55)'; g.lineWidth = 2; g.setLineDash([3, 4]); g.beginPath();
  F.track.forEach((p, i) => { const [a, b] = P(p[0], p[1]); i ? g.lineTo(a, b) : g.moveTo(a, b); }); g.stroke();
  // where we're going
  g.strokeStyle = '#f07a2e'; g.lineWidth = 3; g.setLineDash([]); g.beginPath();
  const [sx, sy] = P(F.x, F.y); g.moveTo(sx, sy); for (const p of path) { const [a, b] = P(p[0], p[1]); g.lineTo(a, b); } g.stroke();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(sx, sy, 6, 0, Math.PI * 2); g.fill();
}

// ---------------------------------------------------------------- per-frame update
const tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), Z = new THREE.Vector3(0, 0, 1), Y = new THREE.Vector3(0, 1, 0);
let numsT = 0, mapT = 0, trackT = 0;

function update(dtReal) {
  clock += dtReal;
  if (pop > 0) pop = Math.max(0, pop - dtReal * 3);

  if (mode === 'flight' || mode === 'result') {
    const f = F;
    // auto fast-forward through the slow parts (coasting, hanging under the parachute)
    const burning = f.engineOn && f.fuel > 0;
    let sp = 1;
    if (!burning && !f.outcome) {
      if (f.chuteOn) sp = f.alt > 60 ? 12 : 1;
      else if (f.alt > ATM_TOP) sp = 10;
      else if (f.alt > 4000) sp = 4;
    } else if (burning && f.alt > 15000) sp = 2;
    simSpeed = sp;
    if (!f.outcome) {
      simAcc += dtReal * sp;
      let n = 0;
      while (simAcc >= STEP && n < 2000) { stepPhysics(f, STEP); simAcc -= STEP; n++; if (f.outcome) { simAcc = 0; break; } }
      if (!f.lifted && burning && f.t > 5) { f.engineOn = false; f.outcome = 'heavy'; f.endIn = 1.2; }
      checkGoals(f);
      // auto-open the parachute low down if nobody pressed it
      const vr = (f.vx * f.x + f.vy * f.y) / Math.hypot(f.x, f.y);
      if (!f.engineOn && !f.chuteOn && f.lifted && vr < 0 && f.alt < 5000) openChute(f);
      ui.chute.hidden = !( !f.engineOn && !f.chuteOn && f.lifted && vr < -5 && !f.outcome);
      trackT -= dtReal * sp; if (trackT <= 0) { f.track.push([f.x, f.y]); trackT = 2; if (f.track.length > 1500) f.track.splice(0, 2); }
      if (f.alt > ATM_TOP && !f.spaceSeen) { f.spaceSeen = true; }
    } else if (f.endIn > 0) {
      f.endIn -= dtReal; if (f.endIn <= 0 && mode === 'flight') finishFlight();
    }
    ui.ff.hidden = sp === 1 || !!f.outcome;
    // fuel + progress bars
    const fr = f.fuel / f.fuelMax;
    ui.fuelFill.style.height = (fr * 100).toFixed(1) + '%';
    ui.fuelFill.classList.toggle('low', fr < 0.2);
    const g = currentGoal(); const gAlt = g && g.alt ? g.alt : (g ? 150000 : 70000);
    const pf = Math.max(0, Math.min(1, f.alt / gAlt));
    ui.progFill.style.height = (pf * 100) + '%'; ui.progDot.style.bottom = (pf * 100) + '%';
    if (!ui.mapWrap.hidden) { mapT -= dtReal; if (mapT <= 0) { drawMap(); mapT = 0.25; } }
  }

  // ---- rocket transform + effects
  let base, dir, up, alt, air = 1, power = 0;
  if (F && mode !== 'hangar') {
    base = tmpV.set(F.x, F.y, 0).clone();
    dir = new THREE.Vector3(Math.sin(F.heading), Math.cos(F.heading), 0);
    up = base.clone().normalize(); alt = F.alt; air = F.air;
    power = F.thr > 0 ? F.ign : 0;
    if (F.sputter > 0) { F.sputter -= dtReal; power = (Math.sin(F.sputter * 40) > 0.3 ? 0.6 : 0) * F.sputter; }
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
  sound.engine(mode === 'flight' ? power : 0, air);

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
  updateSmoke(dtReal * (F ? simSpeed : 1), base);
  updatePuffs();

  // ---- lights fade toward space
  const airLook = Math.exp(-Math.max(0, alt) / 9000);
  hemi.intensity = 0.15 + 0.95 * airLook;
  hemi.color.setRGB(0.6 * airLook + 0.05, 0.75 * airLook + 0.05, 1.0 * airLook + 0.08);
  for (const m of stdMats) m.envMapIntensity = 0.25 + 0.75 * airLook;
  sunLight.position.copy(base).addScaledVector(SUN, 100); sunLight.target.position.copy(base);
  pad.visible = alt < 6000;

  // ---- camera
  updateCamera(dtReal, base, dir, up, alt);

  // ---- grown-up numbers
  numsT -= dtReal;
  if (save.nums && numsT <= 0) { numsT = 0.1; ui.nums.textContent = numbersText(); }
}

function numbersText() {
  if (mode === 'hangar' || !F) {
    const c = save.config, m = rocketMass(c), E = ENGINES[c.engine];
    const m0 = m.dry + m.fuel, twr = E.thrust * E.ispSL / E.ispVac / (m0 * G0);
    const dv = E.ispVac * G0 * Math.log(m0 / m.dry);
    return `mass   ${(m0 / 1000).toFixed(2)} t\nthrust ${(E.thrust / 1000).toFixed(0)} kN\nTWR    ${twr.toFixed(2)}\nΔv     ${(dv / 1000).toFixed(2)} km/s\nbest   ${(save.best / 1000).toFixed(1)} km`;
  }
  const f = F, v = Math.hypot(f.vx, f.vy), r = Math.hypot(f.x, f.y), vr = (f.vx * f.x + f.vy * f.y) / r;
  const o = orbitInfo(f);
  const km = (x) => Math.abs(x) >= 10000 ? (x / 1000).toFixed(1) + ' km' : x.toFixed(0) + ' m';
  return `height ${km(f.alt)}\nspeed  ${v.toFixed(0)} m/s\nup     ${vr.toFixed(0)} m/s\nfuel   ${(100 * f.fuel / f.fuelMax).toFixed(0)} %\ntop    ${km(f.maxAlt)}\napo    ${o.escape ? 'escape' : km(o.apo)}\nperi   ${o.escape ? '-' : km(o.peri)}${simSpeed > 1 ? `\ntime   ${simSpeed}x` : ''}`;
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
    dist = (H * 0.5 + 2) / (fovT * avail * 0.95);
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
requestAnimationFrame((t) => { last = t; frame(t); });
setTimeout(() => ui.loading.classList.add('done'), 250);
document.addEventListener('visibilitychange', () => { if (document.hidden) sound.engine(0, 1); last = performance.now(); });

// test hook for automated checks (harmless for players)
window.__rocket = { get fps() { return 1000 / frameAvg; }, get dpr() { return dpr; }, get F() { return F; }, get mode() { return mode; }, get save() { return save; }, setLean, R };
