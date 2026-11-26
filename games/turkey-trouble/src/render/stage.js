// Turkey Trouble: the stage (the look). Owned by Fable. The game never builds scenery or lights: it asks the stage.
// v1: the baked farm. Lighting is baked in Blender (lightmaps); the ground is drawn by its own wet shader; lamps reflect
// in wet ground; moving things are lit by the sky plus a small "lamp field" that only they see. No three.js lights at all.
// The API is the contract in ../../CONTRACT.md.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { PLACEHOLDERS, node } from './placeholders.js';
import { Post } from './post.js';
import { createFx, streakTexture } from './fx.js';

const BASE = new URL('../../', import.meta.url);
const A = (f) => new URL('assets/' + f, BASE).href;
const LAMPS = 8, MOVING = 4;

function pickQuality() {
  const coarse = matchMedia('(pointer: coarse)').matches;
  const mem = navigator.deviceMemory || 4, cores = navigator.hardwareConcurrency || 4;
  if (!coarse) return 'high';
  return mem <= 3 || cores <= 4 ? 'low' : 'mid';
}
const QUALITY = {
  // half = half-size lightmaps everywhere; groundHalf = only the two big ground ones; skyHalf = the 2K sky (phones)
  low: { dpr: 1.25, msaa: 0, bloom: 3, half: true, groundHalf: true, skyHalf: true, aniso: 2 },
  mid: { dpr: 1.6, msaa: 2, bloom: 4, half: false, groundHalf: true, skyHalf: true, aniso: 4 },
  high: { dpr: 2.0, msaa: 4, bloom: 5, half: false, groundHalf: false, skyHalf: false, aniso: 8 },
};

// ---------------------------------------------------------------- shared uniforms: the lamp field
const vecs = (n) => Array.from({ length: n }, () => new THREE.Vector3());
const U = {
  uLampPos: { value: vecs(LAMPS) }, uLampCol: { value: vecs(LAMPS) }, uLampReach: { value: new Float32Array(LAMPS).fill(1) },
  uMovePos: { value: vecs(MOVING) }, uMoveCol: { value: vecs(MOVING) },
  uSunDir: { value: new THREE.Vector3(-0.9, 0.06, 0.34).normalize() }, uSunCol: { value: new THREE.Vector3(0.14, 0.066, 0.03) },
  uTime: { value: 0 }, uFlash: { value: 0 },
};
const LAMP_PARS = /* glsl */`
varying vec3 vTTWorld;
uniform vec3 uLampPos[${LAMPS}]; uniform vec3 uLampCol[${LAMPS}]; uniform float uLampReach[${LAMPS}];
uniform vec3 uMovePos[${MOVING}]; uniform vec3 uMoveCol[${MOVING}];
uniform vec3 uSunDir; uniform vec3 uSunCol; uniform float uTime; uniform float uFlash;
`;
const WORLD_VERT = (sh) => {
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vTTWorld;')
    .replace('#include <project_vertex>', '#include <project_vertex>\n vTTWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
};
// Light for things that are not baked (actors, trees, fences): lamps, the last of the western glow, a lightning flash.
// uLampCol is already "light / pi at one metre", so it only needs the surface colour.
const LAMP_LIT = /* glsl */`
{
  vec3 ttN = inverseTransformDirection( normal, viewMatrix );
  vec3 ttAdd = vec3( 0.0 );
  for ( int i = 0; i < ${LAMPS}; i ++ ) {
    vec3 lv = uLampPos[ i ] - vTTWorld; float d2 = dot( lv, lv ) + 0.6; float d = sqrt( d2 );
    float nl = clamp( dot( ttN, lv / d ) * 0.7 + 0.3, 0.0, 1.0 );
    ttAdd += uLampCol[ i ] * ( nl * ( 1.0 - smoothstep( uLampReach[ i ] * 0.8, uLampReach[ i ] * 1.7, d ) ) / d2 );
  }
  for ( int i = 0; i < ${MOVING}; i ++ ) {
    vec3 lv = uMovePos[ i ] - vTTWorld; float d2 = dot( lv, lv ) + 1.0; float d = sqrt( d2 );
    ttAdd += uMoveCol[ i ] * ( clamp( dot( ttN, lv / d ) * 0.7 + 0.3, 0.0, 1.0 ) * ( 1.0 - smoothstep( 14.0, 30.0, d ) ) / d2 );
  }
  ttAdd += uSunCol * clamp( dot( ttN, uSunDir ) * 0.6 + 0.4, 0.0, 1.0 );
  ttAdd += uFlash * vec3( 0.45, 0.5, 0.65 ) * clamp( ttN.y * 0.5 + 0.5, 0.0, 1.0 );
  reflectedLight.directDiffuse += ttAdd * material.diffuseColor;
}
`;
function patchLit(mat) {
  if (!mat || mat.userData.ttLit || !mat.isMeshStandardMaterial) return mat;
  mat.userData.ttLit = true;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    WORLD_VERT(sh);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + LAMP_PARS)
      .replace('#include <lights_fragment_end>', LAMP_LIT + '\n#include <lights_fragment_end>');
  };
  mat.customProgramCacheKey = () => 'tt-lit';
  return mat;
}
// Baked scenery already carries the lamps' light. What it still needs is what moves: the torch, headlamps, lightning.
const MOVING_LIT = /* glsl */`
{
  vec3 ttMove = vec3( 0.0 );
  for ( int i = 0; i < ${MOVING}; i ++ ) {
    vec3 lv = uMovePos[ i ] - vTTWorld; float d2 = dot( lv, lv ) + 1.0;
    ttMove += uMoveCol[ i ] * ( ( 1.0 - smoothstep( 14.0, 30.0, sqrt( d2 ) ) ) / d2 );
  }
  ttMove += uFlash * vec3( 0.4, 0.45, 0.6 );
  TT_TARGET += ttMove * TT_COLOR;
}
`;
function patchBakedMatte(mat) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    WORLD_VERT(sh);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + LAMP_PARS)
      .replace('#include <aomap_fragment>', MOVING_LIT.replace('TT_TARGET', 'reflectedLight.indirectDiffuse').replace('TT_COLOR', 'vec3( 1.0 )') + '\n#include <aomap_fragment>');
  };
  mat.customProgramCacheKey = () => 'tt-baked-matte';
  return mat;
}
// Baked but shiny things (wet roofs, tin, glass): the lightmap is their diffuse light, the sky only reflects in them.
const MAPS_NO_SKY_DIFFUSE = THREE.ShaderChunk.lights_fragment_maps.replace('iblIrradiance += getIBLIrradiance( geometryNormal );', '');
function patchBakedShiny(mat) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    WORLD_VERT(sh);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + LAMP_PARS)
      .replace('#include <lights_fragment_maps>', MAPS_NO_SKY_DIFFUSE)
      .replace('#include <lights_fragment_end>', MOVING_LIT.replace('TT_TARGET', 'reflectedLight.directDiffuse').replace('TT_COLOR', 'material.diffuseColor') + '\n#include <lights_fragment_end>');
  };
  mat.customProgramCacheKey = () => 'tt-baked-shiny';
  return mat;
}

// ---------------------------------------------------------------- the ground
const GROUND_PARS = LAMP_PARS + /* glsl */`
varying vec2 vTTUv;
uniform sampler2D tSplat; uniform sampler2D tWet;
uniform sampler2D tMud; uniform sampler2D tGravel; uniform sampler2D tGrass; uniform sampler2D tAsphalt; uniform sampler2D tStubble;
uniform sampler2D tNrmSoft; uniform sampler2D tNrmHard; uniform sampler2D tNrmGravel;
float ttPuddle; float ttDamp; vec3 ttNw; float ttHard; float ttGravel; float ttAsphalt;
`;
const GROUND_MAP = /* glsl */`
{
  vec2 gp = vTTWorld.xz;
  vec3 sp = texture2D( tSplat, vTTUv ).rgb;
  vec3 wt = texture2D( tWet, vTTUv ).rgb;
  vec3 cMud = texture2D( tMud, gp * 0.31 ).rgb;
  vec3 cMud2 = texture2D( tMud, gp * 0.073 + 0.37 ).rgb;
  vec3 cGrass = texture2D( tGrass, gp * 0.37 ).rgb;
  vec3 cGrass2 = texture2D( tGrass, gp * 0.081 + 0.19 ).rgb;
  vec3 alb = cMud * ( 0.72 + cMud2 * 6.0 );
  alb = mix( alb, texture2D( tStubble, gp * vec2( 0.28, 0.28 ) ).rgb, wt.b );
  alb = mix( alb, texture2D( tGravel, gp * 0.47 ).rgb, sp.r );
  alb = mix( alb, cGrass * ( 0.7 + cGrass2 * 6.0 ), sp.g );
  alb = mix( alb, texture2D( tAsphalt, gp * 0.41 ).rgb * 1.15, sp.b );
  ttAsphalt = sp.b; ttGravel = sp.r * ( 1.0 - sp.b );
  ttHard = max( sp.b, sp.r * 0.8 );
  float relief = dot( alb, vec3( 0.8 ) );
  ttPuddle = smoothstep( 0.5, 0.74, wt.r + ( 0.35 - relief ) * 0.2 + ttAsphalt * 0.06 ) * ( 1.0 - sp.g );
  ttDamp = wt.g * ( 1.0 - sp.g * 0.7 );
  alb *= mix( 1.0, 0.62, ttDamp );
  alb = mix( alb, alb * 0.32 + vec3( 0.004, 0.005, 0.006 ), ttPuddle );
  diffuseColor.rgb = alb;
}
`;
const GROUND_ROUGH = /* glsl */`
float roughnessFactor = mix( 0.95, 0.68, ttDamp );
roughnessFactor = mix( roughnessFactor, 0.74, ttGravel );
roughnessFactor = mix( roughnessFactor, mix( 0.5, 0.2, ttDamp ), ttAsphalt );
roughnessFactor = mix( roughnessFactor, 0.03, ttPuddle );
`;
const GROUND_NORMAL = /* glsl */`
{
  vec2 gp = vTTWorld.xz;
  vec2 nS = ( texture2D( tNrmSoft, gp * 0.31 ).xy * 2.0 - 1.0 ) * 0.45;
  vec2 nG = ( texture2D( tNrmGravel, gp * 0.47 ).xy * 2.0 - 1.0 ) * 0.55;
  vec2 nA = ( texture2D( tNrmHard, gp * 0.83 ).xy * 2.0 - 1.0 ) * 0.2;
  vec3 nt = vec3( mix( mix( nS, nG, ttGravel ), nA, ttAsphalt ), 1.0 );
  vec2 rip = ( texture2D( tNrmHard, gp * 0.9 + vec2( uTime * 0.05, uTime * 0.03 ) ).xy + texture2D( tNrmHard, gp * 0.63 - vec2( uTime * 0.04, -uTime * 0.02 ) ).xy - 1.0 ) * 0.035;
  vec2 tilt = mix( nt.xy, rip, ttPuddle );
  ttNw = normalize( vec3( tilt.x, 1.0, - tilt.y ) );
  normal = normalize( ( viewMatrix * vec4( ttNw, 0.0 ) ).xyz );
}
`;
// Lamps in wet ground: only the shine (their light on the ground is in the lightmap). Headlamps add light and shine.
const GROUND_LAMPS = /* glsl */`
{
  vec3 V = normalize( cameraPosition - vTTWorld );
  float a = max( roughnessFactor, 0.045 ); a *= a; float a2 = a * a;
  float nv = max( dot( ttNw, V ), 0.02 );
  vec3 spec = vec3( 0.0 ); vec3 diff = vec3( 0.0 );
  for ( int i = 0; i < ${LAMPS}; i ++ ) {
    vec3 lv = uLampPos[ i ] - vTTWorld; float d2 = dot( lv, lv ) + 0.3; vec3 l = lv * inversesqrt( d2 );
    vec3 h = normalize( l + V ); float nh = max( dot( ttNw, h ), 0.0 ); float nl = max( dot( ttNw, l ), 0.0 );
    float dn = nh * nh * ( a2 - 1.0 ) + 1.0; float D = a2 / ( 3.14159 * dn * dn );
    float F = 0.04 + 0.96 * pow( 1.0 - max( dot( h, V ), 0.0 ), 5.0 );
    spec += uLampCol[ i ] * ( min( D, 900.0 ) * F * smoothstep( 0.0, 0.08, nl ) / ( 4.0 * nv * d2 ) );
  }
  for ( int i = 0; i < ${MOVING}; i ++ ) {
    vec3 lv = uMovePos[ i ] - vTTWorld; float d2 = dot( lv, lv ) + 0.5; float d = sqrt( d2 ); vec3 l = lv / d;
    vec3 h = normalize( l + V ); float nh = max( dot( ttNw, h ), 0.0 ); float nl = max( dot( ttNw, l ), 0.0 );
    float dn = nh * nh * ( a2 - 1.0 ) + 1.0; float D = a2 / ( 3.14159 * dn * dn );
    float F = 0.04 + 0.96 * pow( 1.0 - max( dot( h, V ), 0.0 ), 5.0 );
    float fall = 1.0 - smoothstep( 16.0, 34.0, d );
    if ( i < ${MOVING - 1} ) spec += uMoveCol[ i ] * ( min( D, 900.0 ) * F * smoothstep( 0.0, 0.08, nl ) * fall / ( 4.0 * nv * d2 ) );      // the last slot (the hero light) does not shine in the wet
    diff += uMoveCol[ i ] * ( nl * fall / d2 );
  }
  reflectedLight.directSpecular += spec * 3.14159;
  reflectedLight.directDiffuse += diff * material.diffuseColor;
  reflectedLight.directDiffuse += uFlash * vec3( 0.4, 0.45, 0.6 ) * material.diffuseColor;
}
`;

function groundMaterial(tex, lightMap, range) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, lightMap, lightMapIntensity: range * Math.PI });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U, {
      tSplat: { value: tex.splat }, tWet: { value: tex.wet }, tMud: { value: tex.mud }, tGravel: { value: tex.gravel }, tGrass: { value: tex.grass },
      tAsphalt: { value: tex.asphalt }, tStubble: { value: tex.stubble }, tNrmSoft: { value: tex.nrmSoft }, tNrmHard: { value: tex.nrmHard }, tNrmGravel: { value: tex.nrmGravel },
    });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTTWorld; varying vec2 vTTUv;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n vTTWorld = (modelMatrix * vec4(transformed, 1.0)).xyz; vTTUv = uv;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + GROUND_PARS)
      .replace('#include <map_fragment>', GROUND_MAP)
      .replace('#include <roughnessmap_fragment>', GROUND_ROUGH)
      .replace('#include <normal_fragment_maps>', GROUND_NORMAL)
      .replace('#include <lights_fragment_maps>', MAPS_NO_SKY_DIFFUSE)
      .replace('#include <lights_fragment_end>', GROUND_LAMPS + '\n#include <lights_fragment_end>');
  };
  m.customProgramCacheKey = () => 'tt-ground';
  return m;
}


// ---------------------------------------------------------------- light you can see in the damp air
// A soft cone of mist under a pole lamp or ahead of a headlamp: brightest seen through its middle, gone at its edge.
function beamMaterial(color, strength) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color).multiplyScalar(strength) } },
    vertexShader: /* glsl */`
      varying vec3 vN; varying vec3 vV; varying float vH;
      void main() {
        vec4 wp = modelMatrix * vec4( position, 1.0 );
        vN = normalize( mat3( modelMatrix ) * normal ); vV = normalize( cameraPosition - wp.xyz ); vH = uv.y;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vN; varying vec3 vV; varying float vH; uniform vec3 uColor;
      void main() {
        float through = pow( abs( dot( normalize( vN ), normalize( vV ) ) ), 2.4 );
        gl_FragColor = vec4( uColor * through * ( 0.08 + vH * vH * 0.92 ), 1.0 );
      }`,
    blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
  });
}

// ---------------------------------------------------------------- the sky
function skyDome(tex, range) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { tSky: { value: tex }, uRange: { value: range }, uFlash: U.uFlash },
    vertexShader: 'varying vec3 vDir; void main() { vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
    fragmentShader: /* glsl */`
      varying vec3 vDir; uniform sampler2D tSky; uniform float uRange; uniform float uFlash;
      void main() {
        vec3 d = normalize( vDir );
        vec2 uv = vec2( atan( d.z, d.x ) * 0.15915494 + 0.5, asin( clamp( d.y, -1.0, 1.0 ) ) * 0.31830989 + 0.5 );
        vec3 c = texture2D( tSky, uv ).rgb; c = c * c * c * uRange;
        vec3 hz = texture2D( tSky, vec2( uv.x, 0.531 ) ).rgb; hz = hz * hz * hz * uRange;      // haze: below about 5 degrees the sky keeps the colour it has at 5 degrees
        c = mix( c, hz, smoothstep( 0.09, 0.03, d.y ) );
        c += uFlash * vec3( 0.5, 0.55, 0.75 ) * smoothstep( 0.35, 0.0, d.y ) * smoothstep( -0.2, 0.6, d.x );
        gl_FragColor = vec4( c, 1.0 );
      }`,
    side: THREE.BackSide, depthWrite: false, depthTest: true, fog: false,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), mat);
  dome.scale.setScalar(350); dome.frustumCulled = false; dome.renderOrder = -10; dome.name = 'sky';
  return dome;
}

// ---------------------------------------------------------------- the stage
export async function createStage({ canvas, quality = 'auto', onProgress = () => {} } = {}) {
  const qName = quality === 'auto' ? pickQuality() : quality;
  const Q = QUALITY[qName] || QUALITY.mid;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false, stencil: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, Q.dpr));
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.45;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(58, 1, 0.12, 700);
  const texLoader = new THREE.TextureLoader(), gltfLoader = new GLTFLoader();
  gltfLoader.setDRACOLoader(new DRACOLoader().setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.182.0/examples/jsm/libs/draco/'));
  // a phone on a weak signal drops a file now and then: every file gets three tries before the game gives up
  const texLoad = texLoader.loadAsync.bind(texLoader), gltfLoad = gltfLoader.loadAsync.bind(gltfLoader);
  const again = (fn, tries = 3) => fn().catch((e) => (tries > 1 ? new Promise((r) => setTimeout(r, 600)).then(() => again(fn, tries - 1)) : Promise.reject(e)));
  const loadTex = (url) => again(() => texLoad(url)), loadGltf = (url) => again(() => gltfLoad(url));
  let loaded = 0; const total = 20;
  const tick = (v) => { loaded += 1; onProgress(Math.min(0.98, loaded / total)); return v; };
  const colorTex = (f) => loadTex(A(f)).then((t) => { t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = Q.aniso; return tick(t); });
  // wrap = false is for the two ground masks: they are read with the ground's own (exported) UVs, so no flip
  const dataTex = (f, wrap = true) => loadTex(A(f)).then((t) => { t.colorSpace = THREE.NoColorSpace; if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping; else t.flipY = false; t.anisotropy = Q.aniso; return tick(t); });
  const lmTex = (f) => loadTex(A(Q.half || (Q.groundHalf && f.startsWith('ground_')) ? f.replace('_lm.webp', '_lm_half.webp') : f)).then((t) => { t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.channel = 1; return tick(t); });

  const [layout, meta, gltf, env, sky] = await Promise.all([
    again(() => fetch(new URL('layout.json', BASE)).then((r) => r.json())),
    again(() => fetch(A('world.json')).then((r) => r.json())),
    loadGltf(A('world.glb')).then(tick),
    again(() => new RGBELoader().loadAsync(A('sky_env.hdr'))).then(tick),
    loadTex(A(Q.skyHalf ? 'sky_half.webp' : 'sky.webp')).then((t) => { t.colorSpace = THREE.NoColorSpace; t.wrapS = THREE.RepeatWrapping; return tick(t); }),
  ]);
  const gt = {};
  [gt.splat, gt.wet, gt.mud, gt.gravel, gt.grass, gt.asphalt, gt.stubble, gt.nrmSoft, gt.nrmHard, gt.nrmGravel] = await Promise.all([
    dataTex('ground_splat.png', false), dataTex('ground_wet.png', false), colorTex('ground_mud.webp'), colorTex('ground_gravel.webp'), colorTex('ground_grass.webp'),
    colorTex('ground_asphalt.webp'), colorTex('ground_stubble.webp'), dataTex('ground_mud_n.webp'), dataTex('ground_asphalt_n.webp'), dataTex('ground_gravel_n.webp'),
  ]);

  // the sky lights everything that is not baked, and reflects in everything wet
  env.mapping = THREE.EquirectangularReflectionMapping;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromEquirectangular(env).texture;
  env.dispose(); pmrem.dispose();
  scene.add(skyDome(sky, meta.skyRange));
  scene.fog = new THREE.FogExp2(meta.fog ? new THREE.Color().setRGB(meta.fog[0], meta.fog[1], meta.fog[2]) : new THREE.Color().setRGB(0.092, 0.088, 0.105), 0.0105);

  // lamps: strength measured from the bake itself (the light on the ground under each lamp), so actors match the scenery
  const amb = meta.ambient;
  const lampList = meta.lamps.map((L) => {
    const k = L.y * L.y, seen = L.under[0] + L.under[1] + L.under[2] > 0.02, c = new THREE.Color(L.color);
    // a lamp under a roof could not be measured on the ground: take its strength from its watts instead (the yard lamp is the yardstick)
    const col = seen ? new THREE.Vector3(Math.max(L.under[0] - amb[0], 0.002) * k, Math.max(L.under[1] - amb[1], 0.001) * k, Math.max(L.under[2] - amb[2], 0.0005) * k)
      : new THREE.Vector3(c.r, c.g, c.b).multiplyScalar(41 * (L.watts || 150) / 1500);
    return { L, pos: new THREE.Vector3(L.x, L.y, L.z), col, d: 0 };
  });
  // the shaders carry 8 lamps: the 8 nearest to where the camera looks, each fading out before another takes its place
  const lampAt = new THREE.Vector3(1e9, 0, 0), lampProbe = new THREE.Vector3();
  function pickLamps(force) {
    camera.getWorldDirection(lampProbe).multiplyScalar(12).add(camera.position);
    if (!force && lampProbe.distanceToSquared(lampAt) < 1.0) return;
    lampAt.copy(lampProbe);
    for (const e of lampList) e.d = e.pos.distanceTo(lampProbe);
    lampList.sort((a, b) => a.d - b.d);
    const edge = lampList.length > LAMPS ? lampList[LAMPS].d : 1e9;
    for (let i = 0; i < LAMPS; i++) {
      const e = lampList[i];
      if (!e) { U.uLampCol.value[i].set(0, 0, 0); continue; }
      const fade = Math.min(1, Math.max(0, (edge - e.d) / (0.25 * edge)));
      U.uLampPos.value[i].copy(e.pos); U.uLampCol.value[i].copy(e.col).multiplyScalar(fade); U.uLampReach.value[i] = e.L.reach;
    }
  }
  pickLamps(true);
  U.uSunDir.value.set(meta.sunDir[0], meta.sunDir[1], meta.sunDir[2]).normalize();

  // ---- the world: give every mesh the right kind of material
  const world = gltf.scene; world.name = 'world';
  const lightmaps = new Map(), made = new Map();
  const kinds = [];
  world.traverse((o) => { if (o.isMesh) kinds.push([o, o.userData.kind ? o : (o.parent && o.parent.userData.kind ? o.parent : o)]); });
  for (const [, src] of kinds) if (src.userData.lm && !lightmaps.has(src.userData.lm)) lightmaps.set(src.userData.lm, lmTex(src.userData.lm));
  for (const [k, p] of lightmaps) lightmaps.set(k, await p);
  const SHINY = /^(shingles|tin|glass|galv|iron|stone|pumpkin|water|door_|concrete)/;
  const spinners = [];
  let water = null;
  for (const [o, src] of kinds) {
    const kind = src.userData.kind || 'unbaked', m = o.material, key = kind + ':' + (src.userData.lm || '') + ':' + m.uuid;
    o.matrixAutoUpdate = false; o.updateMatrix();
    if (m.map) m.map.anisotropy = Q.aniso;
    if (kind === 'ground') {
      o.material = made.get(key) || made.set(key, groundMaterial(gt, lightmaps.get(src.userData.lm), src.userData.lmRange)).get(key);
    } else if (kind === 'baked') {
      const lm = lightmaps.get(src.userData.lm), intensity = src.userData.lmRange * Math.PI;
      if (!made.has(key)) {
        if (SHINY.test(m.name)) { const c = m.clone(); c.lightMap = lm; c.lightMapIntensity = intensity; c.envMapIntensity = 1.0; made.set(key, patchBakedShiny(c)); }
        else made.set(key, patchBakedMatte(new THREE.MeshBasicMaterial({ name: m.name, map: m.map, color: m.color, lightMap: lm, lightMapIntensity: intensity })));
      }
      o.material = made.get(key);
    } else if (kind === 'water') {
      // the creek after the storm: mostly a mirror for the sky, running east
      const wm = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.10, 0.12, 0.15), roughness: 0.14, metalness: 0.82, envMapIntensity: 0.85, normalMap: gt.nrmSoft.clone(), normalScale: new THREE.Vector2(1.3, 1.3) });
      wm.normalMap.repeat.set(0.16, 0.42); wm.normalMap.needsUpdate = true;
      wm.emissiveMap = streakTexture(); wm.emissiveMap.repeat.set(0.045, 0.2); wm.emissive = new THREE.Color().setRGB(0.20, 0.24, 0.30);
      o.material = wm; water = wm;
    } else if (kind === 'glow') {
      if (m.emissiveMap || (m.emissive && (m.emissive.r + m.emissive.g + m.emissive.b) > 0.01)) {
        if (!made.has(key)) {
          const strength = m.emissiveMap ? 2.6 : 14.0;
          made.set(key, new THREE.MeshBasicMaterial({ name: m.name, map: m.emissiveMap || null, color: m.emissiveMap ? new THREE.Color(strength, strength, strength) : m.emissive.clone().multiplyScalar(strength), fog: false }));
        }
        o.material = made.get(key);
      } else o.material = patchLit(m);
    } else {
      if (src.userData.kind === 'spin') spinners.push(src);
      if (m.name === 'tufts') { m.transparent = false; m.alphaTest = 0.42; m.depthWrite = true; m.roughness = 1; m.envMapIntensity = 0.7; }      // grass cut-outs
      o.material = patchLit(m);
      if (m.name === 'far') { m.roughness = 1; m.envMapIntensity = 0.6; }
    }
  }
  for (const s of spinners) { s.traverse((c) => { c.matrixAutoUpdate = true; }); }
  scene.add(world);
  // mist cones under the three pole lamps
  const beams = new Map();
  for (const L of meta.lamps) {
    if (!L.pole && !/^(yard|highway_)/.test(L.id)) continue;
    if (!beams.has(L.color)) beams.set(L.color, beamMaterial(L.color, 0.07));
    const cone = new THREE.Mesh(new THREE.ConeGeometry(L.y * 0.85, L.y, 24, 1, true), beams.get(L.color));
    cone.position.set(L.x, L.y / 2, L.z); cone.renderOrder = 4; cone.name = 'beam_' + L.id; world.add(cone);
  }
  const headBeam = beamMaterial('#fff1d6', 0.16);
  const headGeo = new THREE.ConeGeometry(1.5, 11, 14, 1, true).rotateX(-Math.PI / 2).translate(0, 0, 5.5);      // tip at the lamp, opening forward (+z)
  const dynamic = new THREE.Group(); dynamic.name = 'dynamic'; scene.add(dynamic);
  const flashlight = new THREE.Object3D(); flashlight.visible = false; flashlight.intensity = 0; flashlight.target = new THREE.Object3D();

  // ---- models and people
  const roots = new Map();
  for (const file of ['models.glb', 'turkey.glb']) {
    try {
      const g = await loadGltf(A(file));
      g.scene.traverse((o) => {
        if (o.isMesh) {
          const m = o.material;
          if (m.map && (m.transparent || m.alphaTest > 0 || /feather|net/.test(m.name))) { m.transparent = false; m.alphaTest = 0.45; m.depthWrite = true; m.side = THREE.DoubleSide; }
          patchLit(m);
        }
        if (o.userData && typeof o.userData.part === 'string') o.name = o.userData.part;
      });
      for (const child of g.scene.children) roots.set(child.name, child);
    } catch (e) { console.warn('stage: could not load', file, e); }
  }
  const personCache = new Map();
  const PAINTS = [0x6b1512, 0x1f3a5c, 0xb8b4a8, 0x25402a, 0x70706c, 0x8a5a14, 0x101214];
  // the parked pickup and tractor: scenery (their shadows are in the baked ground), lamps off
  const parked = (colliderId, model, child, paint) => {
    const c = layout.colliders.find((k) => k.id === colliderId), src = roots.get(model);
    if (!c || !src) return;
    const from = child ? src.getObjectByName(child) : src;
    if (!from) return;
    const o = from.clone(true); o.position.set(c.x, 0, c.z); o.rotation.set(0, c.rotY || 0, 0); o.scale.set(1, 1, 1);
    o.traverse((m) => {
      if (!m.isMesh) return;
      if (m.material.name === 'paint' && paint !== undefined) { m.material = m.material.clone(); m.material.color.set(paint); patchLit(m.material); }
      if (/headlamp|taillamp|amber/.test(m.material.name)) { m.material = m.material.clone(); m.material.emissiveIntensity = 0; patchLit(m.material); }
    });
    o.name = 'parked_' + model; world.add(o);
  };
  parked('pickup_parked', 'pickup', null, 0x5a1411);
  parked('tractor_parked', 'tractor_wagon', 'tractor', undefined);
  onProgress(1);

  const post = new Post(renderer, Q);
  const fx = createFx(scene, camera);
  const tmp = new THREE.Vector3();
  let lightning = 0, nextBolt = 14 + Math.random() * 20, hero = 1;

  const stage = {
    THREE, scene, camera, renderer, layout, quality: qName, world, dynamic, flashlight, uniforms: U,
    async loadModel(name, opts = {}) {
      const real = roots.get(name);
      let copy;
      if (real) {
        copy = real.clone(true); copy.position.set(0, 0, 0); copy.rotation.set(0, 0, 0); copy.scale.set(1, 1, 1);
        if (opts.paint !== undefined || /pickup|grain_truck/.test(name)) {
          const c = opts.paint !== undefined ? opts.paint : PAINTS[Math.floor(Math.random() * PAINTS.length)];
          copy.traverse((o) => { if (o.isMesh && o.material && o.material.name === 'paint') { o.material = o.material.clone(); o.material.color.set(c); patchLit(o.material); } });
        }
      } else {
        if (!PLACEHOLDERS[name]) throw new Error(`stage.loadModel: no model named "${name}"`);
        copy = PLACEHOLDERS[name]();
        copy.traverse((o) => { if (o.isMesh) patchLit(o.material); });
      }
      if (!copy.userData.size) { const b = new THREE.Box3().setFromObject(copy), s = b.getSize(tmp); copy.userData.size = { w: s.x, h: s.y, l: s.z }; }
      for (const side of ['headlight_l', 'headlight_r']) {                  // every moving vehicle throws two beams into the mist
        const hl = copy.getObjectByName(side);
        if (hl && !hl.getObjectByName('beam')) { const beam = new THREE.Mesh(headGeo, headBeam); beam.name = 'beam'; beam.renderOrder = 4; beam.rotation.x = 0.06; hl.add(beam); }
      }
      return copy;
    },
    async loadPerson(id) {
      if (!personCache.has(id)) personCache.set(id, loadGltf(`/homes/people/${id}.glb`).catch((e) => { personCache.delete(id); throw e; }));
      const g = await personCache.get(id);
      const inner = SkeletonUtils.clone(g.scene);
      // the site's people are already in metres, feet on the ground (a skinned mesh's box cannot be trusted to rescale it)
      const root = node('person_' + id); root.add(inner);
      const mixer = new THREE.AnimationMixer(inner), actions = {};
      for (const clip of g.animations) if (clip.name === 'Idle' || clip.name === 'Walk') actions[clip.name] = mixer.clipAction(clip);
      inner.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.material = patchLit(o.material.clone()); } });
      return { root, mixer, actions, height: 1.76 };
    },
    groundHeight(x, z) { return 0; },
    fx: {
      splash(x, z) { fx.splash(x, z, -0.05); }, feathers(x, y, z, n = 8) { fx.feathers(x, y, z, n); }, dust(x, z) { fx.dust(x, z); },
      lightning() { lightning = 1; },
    },
    update(dt, focus) {
      U.uTime.value += dt; pickLamps(false);
      if (water) { water.normalMap.offset.x -= dt * 0.11; water.normalMap.offset.y += dt * 0.012; water.emissiveMap.offset.x -= dt * 0.055; }
      fx.update(dt);
      for (const s of spinners) s.rotation.z += dt * 0.9;
      nextBolt -= dt;
      if (nextBolt <= 0) { lightning = 1; nextBolt = 18 + Math.random() * 30; }
      lightning = Math.max(0, lightning - dt * 2.2);
      U.uFlash.value = lightning > 0 ? lightning * lightning * (0.6 + 0.4 * Math.sin(U.uTime.value * 60)) : 0;
      // the torch and the nearest headlamps are the "moving lamps"
      let n = 0;
      if (flashlight.visible && flashlight.intensity > 0) {
        tmp.copy(flashlight.target.position).sub(flashlight.position).normalize();
        U.uMovePos.value[n].copy(flashlight.position).addScaledVector(tmp, 4.5); U.uMovePos.value[n].y = 1.4;
        U.uMoveCol.value[n].set(2.4, 2.1, 1.7).multiplyScalar(Math.min(flashlight.intensity, 4)); n += 1;
      }
      for (const v of dynamic.children) {
        if (n >= MOVING - 1) break;
        const hl = v.userData.headlamp !== undefined ? v.userData.headlamp : (v.userData.headlamp = v.getObjectByName('headlight_l') || null);
        if (!hl || !v.visible) continue;
        hl.getWorldPosition(tmp);
        if (tmp.distanceToSquared(camera.position) > 70 * 70) continue;
        v.getWorldDirection(U.uMovePos.value[n]); U.uMovePos.value[n].multiplyScalar(5.5).add(tmp); U.uMovePos.value[n].y = 1.1;
        U.uMoveCol.value[n].set(5.5, 5.0, 4.2); n += 1;
      }
      for (; n < MOVING - 1; n++) U.uMoveCol.value[n].set(0, 0, 0);
      // the last slot is a faint cool light that stays over the one you play, so the hero never sinks into the dark
      if (focus && hero > 0) { U.uMovePos.value[MOVING - 1].set(focus.x, (focus.y || 0) + 5.0, focus.z); U.uMoveCol.value[MOVING - 1].set(3.2, 3.8, 5.2).multiplyScalar(hero); }
      else U.uMoveCol.value[MOVING - 1].set(0, 0, 0);
    },
    render() { post.render(scene, camera, U.uTime.value); },
    resize() {
      const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); post.resize();
    },
    setQuality() {}, setHero(v) { hero = v; },
    dispose() { renderer.dispose(); },
  };
  stage.resize();
  return stage;
}
