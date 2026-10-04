// ============================================================================
// spaceSky.js — the sky that turns black as you climb, the stars, the Sun, Mars's thin blue limb.
//
// OWNS: everything that changes with how high the camera is: background and fog, the ambient and Sun light, the star dome
//       (stars and the Milky Way, all procedural: no texture downloads), the Sun's disc and glow, and the atmosphere shell
//       that draws Mars's limb from orbit.
// DOES NOT OWN: the lights themselves (main.js made them; this scales them), Mars's ground, any ship.
//
// F2: THE SUN MOVES. `update` is given the Sun in the ACTIVE frame's axes (SpaceSystem.early: the real Sun at the real time, or the legacy
// fixed one in a dev session) and the sky follows its height over the horizon at the camera: day (butterscotch), dusk (the blue of a Martian
// sunset), night (black, stars, the dome turned with the planet), the key light fading as the Sun goes under the horizon, the Sun's disc and the
// dome turning with the frame, and Mars's own shadow when the camera is out in space behind it.
//
// BY DAY NOTHING CHANGES ON THE GROUND. Below SKY_FULL_M the blend is exactly 1, the dome and atmosphere are off, and the sky,
// fog and lights are what main.js set. Above it the sky thins with a real-ish scale height (Mars: 11.1 km) and is gone by
// 100 km.
// ============================================================================

import * as THREE from 'three';
import { sunDirection } from './spaceSpec.js';
import { rootSpin } from './frames.js';

export const SKY_FULL_M = 6000;           // below this height the ground sky is untouched
export const SKY_SCALE_M = 14000;         // e-folding height of the daylight sky above that
export const MARS_RADIUS_M = 3_389_500;

/** 1 on the ground, 0 in space: how much of the butterscotch daylight sky is left at a height above the areoid. */
export function skyBlend(h) { return h <= SKY_FULL_M ? 1 : Math.exp(-(h - SKY_FULL_M) / SKY_SCALE_M); }
const D2R = Math.PI / 180;
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export const DOME_VS = `
varying vec3 vDir;
void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

// Stars: three layers of hashed cells on the sphere of directions, sized to about a pixel with derivatives, so they stay
// crisp and do not shimmer into noise. The Milky Way is a band round a galactic plane, mottled and cut by dust lanes.
export const DOME_FS = `
precision highp float;
varying vec3 vDir;
uniform vec3 uBg;
uniform float uStars;
uniform vec3 uGal;
float h31(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
vec3 h33(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
float vn(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fb(vec3 p) { return 0.5 * vn(p) + 0.25 * vn(p * 2.03) + 0.125 * vn(p * 4.1) + 0.0625 * vn(p * 8.3); }
// One layer: the sphere of directions cut into cells, a star (or none) in the middle part of each. Each cell only ever looks at
// itself (a star stays inside its own cell), so a layer costs one hash, not twenty-seven: it has to run for every pixel of a phone.
vec3 starLayer(vec3 d, float scale, float density, float size) {
  vec3 p = d * scale, c = floor(p), f = fract(p);
  vec3 r = h33(c + 17.0);
  if (r.x > density) return vec3(0.0);
  vec3 pos = (0.28 + 0.44 * h33(c + 71.0)) - f;      // from this pixel to the star, in cell units
  float px = length(fwidth(p)) * 0.9;               // one pixel, in cell units
  float rad = clamp(max(size, px), 0.0, 0.26);
  float core = exp(-dot(pos, pos) / (rad * rad * 0.8));
  float mag = 0.25 + 0.75 * r.y * r.y;
  vec3 tint = mix(vec3(0.62, 0.74, 1.0), vec3(1.0, 0.82, 0.62), r.z);
  return tint * core * mag * min(1.0, size / rad * 1.4 + 0.25);
}
void main() {
  vec3 d = normalize(vDir);
  vec3 col = uBg;
  if (uStars > 0.001) {
    vec3 s = starLayer(d, 30.0, 0.30, 0.03) * 1.15 + starLayer(d, 64.0, 0.22, 0.03) * 0.95 + starLayer(d, 130.0, 0.16, 0.03) * 0.8;
    // the galaxy: a band round a galactic plane, mottled, with dust lanes cut through it
    float lat = dot(d, normalize(uGal));
    float band = exp(-pow(lat / 0.20, 2.0));
    if (band > 0.02) {
      float core = exp(-pow(lat / 0.07, 2.0));
      float m = fb(d * 5.0) * 0.8 + 0.2 * fb(d * 18.0);
      float lane = smoothstep(0.35, 0.62, fb(d * 9.0 + 3.7)) * 0.65 * band;
      vec3 glow = vec3(0.50, 0.55, 0.72) * band * (0.35 + 0.9 * m) + vec3(0.70, 0.60, 0.48) * core * 0.45 * m;
      glow *= (1.0 - lane);
      vec3 dust = starLayer(d, 130.0, 0.55 * band, 0.03) * band * 0.9;
      s += dust * 0.6;
      col += glow * 0.16 * uStars;
    }
    col += s * uStars;
  }
  gl_FragColor = vec4(col, 1.0);
}`;

// Mars's atmosphere seen from outside: a thin shell, integrated along the view ray (eight samples). Dust is warm and low,
// the gas is a faint blue and higher; the Sun lights the shell by the angle of each sample to it.
const ATM_VS = `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
  #include <logdepthbuf_vertex>
}`;
const ATM_FS = `
precision highp float;
#include <common>
#include <logdepthbuf_pars_fragment>
varying vec3 vW;
uniform vec3 uC; uniform float uRp; uniform float uRa; uniform vec3 uSun; uniform float uK;
vec2 isect(vec3 ro, vec3 rd, vec3 c, float r) {
  vec3 oc = ro - c; float b = dot(oc, rd), cc = dot(oc, oc) - r * r, d = b * b - cc;
  if (d < 0.0) return vec2(1.0, -1.0);
  d = sqrt(d); return vec2(-b - d, -b + d);
}
void main() {
  #include <logdepthbuf_fragment>
  vec3 rd = normalize(vW), ro = vec3(0.0);
  vec2 a = isect(ro, rd, uC, uRa);
  if (a.y < 0.0) discard;
  float t0 = max(a.x, 0.0), t1 = a.y;
  vec2 p = isect(ro, rd, uC, uRp);
  if (p.y > 0.0 && p.x > 0.0) t1 = min(t1, p.x);
  if (t1 <= t0) discard;
  float dt = (t1 - t0) / 8.0;
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    float t = t0 + (float(i) + 0.5) * dt;
    vec3 q = ro + rd * t - uC;
    float r = length(q), h = max(0.0, r - uRp);
    float rhoD = exp(-h / 9000.0), rhoG = exp(-h / 13000.0);
    float lit = smoothstep(-0.12, 0.35, dot(q / r, uSun));
    float cs = dot(rd, uSun);
    float g = 0.76, ph = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * cs, 1.5) * 0.08 + 0.55;
    vec3 dust = vec3(0.92, 0.62, 0.40) * rhoD * ph;
    vec3 gas = vec3(0.42, 0.62, 1.0) * rhoG * 0.55 * (0.75 + 0.25 * cs * cs);
    acc += (dust * 0.62 + gas * 1.7) * lit * dt;
  }
  gl_FragColor = vec4(acc * uK, 1.0);
}`;

export class SpaceSky {
  /**
   * @param o { engine, sun (DirectionalLight), hemi (HemisphereLight), oldStars (Points|null), tier, skyColor, horizonColor }
   */
  constructor(o) {
    this.engine = o.engine; this.sun = o.sun; this.hemi = o.hemi; this.oldStars = o.oldStars || null; this.tier = o.tier || 'high';
    this.skyColor = new THREE.Color(o.skyColor); this.horizonColor = new THREE.Color(o.horizonColor);
    this.groundFog = o.fogDensity ?? 0.000012;
    this.sunWorld = new THREE.Vector3(...Object.values(sunDirection())).normalize();
    this.solSunDir = this.sunWorld.clone();       // WORLD2: kept so a frame of another system can borrow `sunWorld` and give it back
    this.system = null;
    this.state = { h: 0, s: 1, sunBlend: 0, elev: 90, vis: 1, day: 1 };
    this._dusk = new THREE.Color(0.17, 0.21, 0.36); this._duskH = new THREE.Color(0.30, 0.31, 0.40);
    // Marsshine: the light Mars throws back. Real Phobos gets about 1% of the Sun's strength from it; this is a stronger, readable fill
    // (so a cargo module's shadow side is not pure black) that only ever lights what faces Mars, and never Mars itself.
    this.shine = new THREE.DirectionalLight(0xffc7a0, 0);
    this.shine.name = 'marsshine';
    o.engine.scene.add(this.shine);
    this._tmp = new THREE.Vector3(); this._cam = {};
    this._envBase = new Map();
    const scene = this.engine.scene;

    // star dome (opaque, drawn first, no depth: it IS the background when the sky is gone)
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(1e6, 48, 24), new THREE.ShaderMaterial({
      vertexShader: DOME_VS, fragmentShader: DOME_FS, side: THREE.BackSide, depthTest: false, depthWrite: false, toneMapped: false,
      uniforms: { uBg: { value: new THREE.Color(0, 0, 0) }, uStars: { value: 0 }, uGal: { value: new THREE.Vector3(0.38, 0.86, 0.34) } },
      extensions: { derivatives: true },
    }));
    this.dome.name = 'star-dome'; this.dome.renderOrder = -1000; this.dome.frustumCulled = false; this.dome.visible = false;
    scene.add(this.dome);

    // the Sun: a hot core and a wide faint glow, additive, depth-tested so planets and moons can eclipse it
    const tex = (stops) => {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      for (const [p, col] of stops) gr.addColorStop(p, col);
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    };
    const core = tex([[0, 'rgba(255,255,250,1)'], [0.58, 'rgba(255,248,230,1)'], [0.74, 'rgba(255,230,190,0.55)'], [1, 'rgba(255,220,170,0)']]);
    const glow = tex([[0, 'rgba(255,240,215,0.55)'], [0.18, 'rgba(255,225,185,0.25)'], [0.5, 'rgba(255,205,160,0.07)'], [1, 'rgba(255,200,150,0)']]);
    const sm = (t, op) => new THREE.SpriteMaterial({ map: t, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false, opacity: op });
    this.sunCore = new THREE.Sprite(sm(core, 1)); this.sunGlow = new THREE.Sprite(sm(glow, 1));
    for (const s of [this.sunCore, this.sunGlow]) { s.frustumCulled = false; scene.add(s); }
    this.sunCore.renderOrder = 5; this.sunGlow.renderOrder = 4;
    this.SUN_DIST = 3.0e8;
    this.sunCore.scale.setScalar(2 * this.SUN_DIST * Math.tan(0.34 * Math.PI / 180) * 1.36);
    this.sunGlow.scale.setScalar(2 * this.SUN_DIST * Math.tan(5 * Math.PI / 180));

    // Mars's limb
    this.atm = new THREE.Mesh(new THREE.SphereGeometry(1, this.tier === 'low' ? 72 : 112, this.tier === 'low' ? 48 : 72), new THREE.ShaderMaterial({
      vertexShader: ATM_VS, fragmentShader: ATM_FS, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
      side: THREE.FrontSide,
      uniforms: { uC: { value: new THREE.Vector3() }, uRp: { value: MARS_RADIUS_M }, uRa: { value: MARS_RADIUS_M + 95000 }, uSun: { value: this.sunWorld.clone() }, uK: { value: 0 } },
    }));
    this.atm.scale.setScalar(MARS_RADIUS_M + 95000);
    this.atm.name = 'mars-atmosphere'; this.atm.frustumCulled = false; this.atm.visible = false; this.atm.renderOrder = 3;
    scene.add(this.atm);
  }

  /** A cached THREE.Color for a world's sky/horizon (0xRRGGBB), so the per-frame update allocates nothing. */
  _airSky(hex, key) { const c = this._airC || (this._airC = {}); const k = key + hex; return c[k] || (c[k] = new THREE.Color(hex)); }

  /**
   * WORLD2: the sky of a world far from Mars (Ceres): its own star in its own direction, colour and size, no Mars (no limb, no Marsshine), and a
   * fill that comes from the bright ground. `cfg` = { sunDir: THREE.Vector3, color: [r,g,b], glow: [r,g,b], diskDeg, fill: {sky, ground, intensity},
   * giant: { dir: THREE.Vector3, color: [r,g,b], lit: 0..1 } } or null to go back to Mars's.
   */
  setSystem(cfg) {
    if (!cfg && !this.system) return;
    this.system = cfg;
    this.sunWorld.copy(cfg ? cfg.sunDir : this.solSunDir);
    const f = cfg ? cfg.diskDeg / 0.34 : 1;
    this.sunCore.scale.setScalar(2 * this.SUN_DIST * Math.tan(0.34 * Math.PI / 180) * 1.36 * f);
    this.sunGlow.scale.setScalar(2 * this.SUN_DIST * Math.tan(5 * Math.PI / 180) * (cfg ? 1.25 : 1));
    this.sunCore.material.color.setRGB(...(cfg ? cfg.color : [1, 1, 1]));
    this.sunGlow.material.color.setRGB(...(cfg ? cfg.glow : [1, 1, 1]));
    this._sunSet = true;
  }

  /** The Sun's direction as a unit vector, world axes (the same in every frame: frames are translated copies). */
  get sunDir() { return this.sunWorld; }

  /**
   * Call once a frame, AFTER main.js has set the lights and camera.
   * @param localSun   THREE.Vector3 the ground game's own Sun direction this frame (what main.js just used)
   * @param extra      { marsShine: number 0..1 } extra ambient for a moon's Mars-lit side;
   *                   { air: { h, scaleHeightM, skyColor, horizonColor, fogDensity } } the camera is over a world with its OWN atmosphere
   *                   (a planet from its def): its sky, fog and daylight fade with height replace Mars's (the limb glow stays Mars's)
   */
  update(dt, localSun, extra = {}) {
    const e = this.engine, scene = e.scene;
    const live = !!extra.live && !this.system, AF = e.activeFrame;       // (WORLD2: another system has its own star: setSystem, below, owns the light there)
    if (extra.sun && !this.system) this.sunWorld.copy(extra.sun);
    const cam = e.cameraIn(e.rootFrame, this._cam);                                  // the camera in Mars's turning axes
    const r = Math.hypot(cam.x, cam.y, cam.z), hMars = r - MARS_RADIUS_M;
    // Mars's centre and the camera relative to it, in the axes the scene is drawn in (the active frame's)
    const tm = e.frameDir(e.rootFrame, AF, { x: -cam.x, y: -cam.y, z: -cam.z }, this._toMars || (this._toMars = {}));
    const camA = this._camA || (this._camA = {}); camA.x = -tm.x; camA.y = -tm.y; camA.z = -tm.z;
    const air = extra.air || null, k = air ? air.scaleHeightM / 11_100 : 1;       // a thicker or thinner air scales the whole fade (Mars: 11.1 km scale height)
    const h = air ? air.h : hMars;
    // how high the Sun is over the horizon of the ground the camera is over (a sphere of the body's radius), and how much of it Mars's own shadow leaves
    let elev = 90, dayK = 1, ambK = 1, twK = 0, starK = 0, vis = 1, airK = 1;
    if (live) {
      const ca = e.cameraWorldPos, cl = Math.hypot(ca.x, ca.y, ca.z) || 1, sd = this.sunWorld;
      const bodyR = extra.body ? extra.body.radiusMean : MARS_RADIUS_M;
      const sinE = (ca.x * sd.x + ca.y * sd.y + ca.z * sd.z) / cl, dip = cl > bodyR ? Math.acos(Math.min(1, bodyR / cl)) : 0;
      elev = Math.asin(Math.max(-1, Math.min(1, sinE))) / D2R;
      const dipD = dip / D2R;
      vis = sstep(-dipD - 0.6, -dipD + 2.2, elev);                                 // the Sun's light reaches the camera: soft over the horizon
      // Mars's shadow, for a camera behind it (a moon in Mars's shadow, a ship on the night side): the Sun's direction in Mars's axes
      const sr = e.frameDir(AF, e.rootFrame, sd, this._sr || (this._sr = {})), along = cam.x * sr.x + cam.y * sr.y + cam.z * sr.z;
      if (along < 0) { const mx = cam.x - along * sr.x, my = cam.y - along * sr.y, mz = cam.z - along * sr.z, miss = Math.hypot(mx, my, mz); vis *= sstep(MARS_RADIUS_M * 0.992, MARS_RADIUS_M * 1.012, miss); }
      dayK = sstep(-4, 22, elev);                                                  // the sky's daylight colour
      ambK = sstep(-11, 24, elev);                                                 // the ambient light (dust keeps a long twilight, but it dims fast once the Sun is on the horizon)
      airK = 0.25 + 0.75 * sstep(0, 22, elev);                                     // a low Sun shines through more air: dimmer
      twK = sstep(-14, -3, elev);                                                  // the blue glow of dusk and dawn
      starK = 1 - sstep(-13, -3, elev);                                            // stars come out as it darkens
    }
    this.state.elev = elev; this.state.vis = vis; this.state.day = dayK;
    const skyC = air ? this._airSky(air.skyColor, 'sky') : this.skyColor, horC = air ? this._airSky(air.horizonColor, 'hor') : this.horizonColor;
    const groundFog = air && air.fogDensity !== undefined ? air.fogDensity : this.groundFog;
    const s = air ? (h <= SKY_FULL_M * k ? 1 : Math.exp(-(h - SKY_FULL_M * k) / (SKY_SCALE_M * k))) : skyBlend(h);
    const space = 1 - s;
    this.state.h = h; this.state.s = s;
    // the sky's colour now: night, the blue of dusk, then the butterscotch day (a thin-air sky is the same, scaled by `s`)
    const col = this._skyNow || (this._skyNow = new THREE.Color()), fogc = this._fogNow || (this._fogNow = new THREE.Color());
    col.setRGB(0.004, 0.005, 0.010).lerp(this._dusk, twK * 0.9).lerp(skyC, dayK).multiplyScalar(s);
    fogc.setRGB(0.004, 0.005, 0.009).lerp(this._duskH, twK * 0.9).lerp(horC, dayK).multiplyScalar(Math.max(0.02, s));

    // background and fog
    if (scene.background && scene.background.isColor) scene.background.copy(col);
    if (scene.fog) { scene.fog.density = groundFog * s * s; scene.fog.color.copy(fogc); }

    // star dome
    const dome = this.dome;
    const starsNow = Math.max(Math.min(1, space * 1.15), s * starK);
    dome.visible = starsNow > 0.02;
    if (dome.visible) {
      const u = dome.material.uniforms;
      u.uBg.value.copy(scene.background && scene.background.isColor ? scene.background : skyC);
      u.uStars.value = starsNow;
      // the stars are fixed in INERTIAL space: seen from Mars's turning axes (or a moon's) the dome turns the other way
      dome.rotation.y = live ? -(rootSpin(extra.T ?? 0) + AF.yaw) : 0;
    }
    if (this.oldStars) { this.oldStars.visible = s * dayK > 0.4; this.oldStars.material.opacity = 0.55 * Math.min(1, (s * dayK - 0.4) / 0.6); if (live) this.oldStars.rotation.y = -(rootSpin(extra.T ?? 0) + AF.yaw); }

    // lights
    const t = sstep(20000 * k, 80000 * k, h);
    this.state.sunBlend = t;
    if (t > 0) {
      const v = this._tmp.copy(localSun).multiplyScalar(1 - t).addScaledVector(this.sunWorld, t).normalize();
      this.sun.position.copy(v).multiplyScalar(140);
    }
    const inSpace = sstep(0.0, 0.9, space);
    this.sun.intensity = 2.4 * (1 + 0.45 * inSpace) * vis * (inSpace > 0.5 ? 1 : airK);
    this.sun.color.setRGB(1, 0.914 + 0.06 * inSpace, 0.824 + 0.14 * inSpace);
    if (live && elev < 12) { const w = 1 - sstep(0, 12, elev); this.sun.color.g -= 0.16 * w; this.sun.color.b -= 0.34 * w; }       // a low Sun: warmer light
    // ambient: the sky's own light fades with the Sun; a floor of starlight and glow keeps the ground readable (and the port's lights matter)
    this.hemi.intensity *= (0.05 + 0.95 * s) * (1 - s * 0.95 * (1 - ambK));
    this.hemi.color.copy(skyC).lerp(new THREE.Color(0x6a5c58), 1 - s);
    if (live && s > 0.01) this.hemi.color.lerp(this._night || (this._night = new THREE.Color(0.30, 0.38, 0.66)), s * (1 - ambK));
    // On a moon there is no sky, and the Sun alone leaves everything it does not touch black. What lights the shadow side is Mars
    // (a huge, rust-coloured, sunlit ball overhead) and the sunlit ground itself, so the fill is a rusty ambient from above and a
    // warm grey bounce from below, strongest when Mars is full. Real Phobos gets less than this: the picture needs to be readable.
    this.moonFill = 0;
    if (!this._groundBase) this._groundBase = this.hemi.groundColor.clone();
    else if (!(extra.marsShine && space > 0.5)) this.hemi.groundColor.copy(this._groundBase);
    if (extra.marsShine && space > 0.5) {
      const d = Math.max(r, 1), cosPhase = (camA.x * this.sunWorld.x + camA.y * this.sunWorld.y + camA.z * this.sunWorld.z) / d;
      const big = Math.min(1, (MARS_RADIUS_M / d) * (MARS_RADIUS_M / d) * 6), lit = 0.35 + 0.65 * sstep(-0.2, 0.7, cosPhase);
      this.moonFill = big * lit;
      this.hemi.color.setRGB(0.72, 0.45, 0.34);
      this.hemi.groundColor.setRGB(0.30, 0.27, 0.25);
      this.hemi.intensity = 0.85 * (0.4 + 0.6 * big * lit);
      if (extra.up) this.hemi.position.set(extra.up.x, extra.up.y, extra.up.z);          // the moon's own up (the ground game's is the planet's: right for Mars, wrong here)
      this.sun.intensity = 2.4 * 1.55;
    }

    // Marsshine: from Mars's centre toward the camera; strength by how big Mars is in the sky and how much of it the Sun lights
    {
      const d = Math.max(r, 1), cosPhase = (camA.x * this.sunWorld.x + camA.y * this.sunWorld.y + camA.z * this.sunWorld.z) / d;
      const big = Math.min(1, (MARS_RADIUS_M / d) * (MARS_RADIUS_M / d) * 6), lit = sstep(-0.2, 0.7, cosPhase);
      this.shine.intensity = space > 0.5 ? (extra.marsShine ? 0.62 : 0.34) * big * lit : 0;
      this.shine.position.set(tm.x / d * 10, tm.y / d * 10, tm.z / d * 10);        // the light sits toward Mars, shining out at the camera
    }

    // WORLD2: another system's own light overrides everything Mars-specific above
    if (this.system) {
      const c = this.system, fill = c.fill;
      this.hemi.color.setRGB(...fill.sky); this.hemi.groundColor.setRGB(...fill.ground);
      this.hemi.intensity = fill.intensity;
      if (extra.up) this.hemi.position.set(extra.up.x, extra.up.y, extra.up.z);
      this.sun.intensity = (c.sunIntensity || 2.4) * 1.1;
      this.sun.color.setRGB(...c.color);
      this.moonFill = 1;
      if (c.giant) {
        this.shine.color.setRGB(...c.giant.color);
        this.shine.intensity = c.giant.intensity * c.giant.lit;
        this.shine.position.set(c.giant.dir.x * 10, c.giant.dir.y * 10, c.giant.dir.z * 10);     // the light sits toward the giant and shines out at the ground (as Marsshine does)
      } else this.shine.intensity = 0;
    }

    // the Sun's disc: always where the Sun is, fixed in the world (camera-relative)
    const sd = this.sunWorld;
    for (const sp of [this.sunCore, this.sunGlow]) sp.position.set(sd.x * this.SUN_DIST, sd.y * this.SUN_DIST, sd.z * this.SUN_DIST);
    this.sunGlow.material.opacity = 0.25 + 0.75 * inSpace;
    this.sunCore.material.opacity = 1;

    // the limb
    const atm = this.atm;
    atm.visible = hMars > 15000 && !this.system;
    if (atm.visible) {
      atm.position.set(tm.x, tm.y, tm.z);
      atm.material.uniforms.uC.value.set(tm.x, tm.y, tm.z);
      atm.material.side = hMars > 95000 ? THREE.FrontSide : THREE.BackSide;
      atm.material.uniforms.uK.value = sstep(15000, 60000, hMars) * 3.0e-6;
    }
  }

  /** Scale the ship's exterior reflections (a dusty sky is not there to reflect in space). Called with the ship's matsExt. */
  scaleEnvironment(mats) {
    if (!mats) return;
    const k = 0.22 + 0.78 * this.state.s * (0.12 + 0.88 * this.state.day);
    for (const key of Object.keys(mats)) {
      const m = mats[key];
      if (!m || !m.isMaterial || m.envMapIntensity === undefined) continue;
      if (!this._envBase.has(m)) this._envBase.set(m, m.envMapIntensity);
      m.envMapIntensity = this._envBase.get(m) * k;
    }
  }
}
