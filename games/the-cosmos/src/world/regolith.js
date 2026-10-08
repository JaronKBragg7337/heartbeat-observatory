// Regolith - surface detail for the ground you stand on (Jaron 2026-09-28: "not look like Roblox texture").
//
// The patch was smooth vertex colour: at eye height Mars read as painted plastic. Real ground at 1-10 m is dust, grit,
// pebbles and small bumps. This adds that in the shader, with no texture download:
//   - 3D value noise evaluated on the WORLD position (patch-local + an f64-derived offset), so there is no projection
//     stretching on slopes, and the pattern stays nailed to the ground when the patch re-centres (the noise is periodic
//     over 360 m and the offset is the patch origin mod 360 m, so the seam never shows).
//   - albedo: broad dusty/darker patches, fine grit, and scattered dark pebbles.
//   - bumps: the same height field perturbs the normal (three.js's own bump-map maths), so low sun rakes across it.
// Cost: a handful of noise taps per pixel on the near patch only; the global shell is untouched.

export const REGOLITH_PERIOD = 360;

export function mod360(v) { return ((v % REGOLITH_PERIOD) + REGOLITH_PERIOD) % REGOLITH_PERIOD; }
/** The same wrap for a patch whose noise repeats over a longer period (the far tier of a moon: 3600 m). */
export function modP(v, P) { return ((v % P) + P) % P; }

// EARTH: the grass, scrub and sand of a Florida coast, in place of the moons' grey grit. The vertex colour already says what the ground is made of (green soil, pale sand);
// this only breathes life into the green: wet and dry country (10 m cells), tussocks (2.5 m), bare sandy patches with ragged edges, and a close grain of blades. Every
// octave's frequency times 360 m is a whole number, so the pattern repeats over 360 m with no seam, like the rest of regolith.js. Linear colours.
const EARTH_NEAR = `{
  float lumaE = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
  float rE = clamp(lumaE / 0.14, 0.6, 1.5);
  float nearE = 1.0 - smoothstep(18.0, 110.0, length(vViewPosition));
  float lushN = regN(vRegPos * 0.1, 36.0) * 0.65 + regN(vRegPos * 0.4, 144.0) * 0.35;
  float clumpN = regN(vRegPos * 0.4, 144.0) * 0.6 + regN(vRegPos * 1.0, 360.0) * 0.4;
  float bladeN = regN(vRegPos * 4.0, 1440.0) * 0.55 + regN(vRegPos * 12.0, 4320.0) * 0.45;
  float grassy = smoothstep(0.02, 0.05, diffuseColor.g - diffuseColor.r + (bladeN - 0.5) * 0.09 + (clumpN - 0.5) * 0.06);      // the edge of the beach is ragged, not a straight line between two vertices
  float bareN = smoothstep(0.62, 0.72, regN(vRegPos * 0.2, 72.0) * 0.6 + regN(vRegPos * 1.0, 360.0) * 0.25 + bladeN * 0.15);
  vec3 lushC = vec3(0.085, 0.19, 0.035), dryC = vec3(0.27, 0.255, 0.085), darkC = vec3(0.035, 0.085, 0.03), sandC = vec3(0.52, 0.46, 0.31);
  vec3 gE = mix(mix(darkC, lushC, smoothstep(0.30, 0.66, clumpN)), dryC, smoothstep(0.42, 0.78, lushN));
  gE *= 0.58 + 0.84 * mix(0.5, bladeN, nearE);
  gE = mix(gE, sandC * (0.88 + 0.24 * mix(0.5, bladeN, nearE)), bareN * 0.9);
  diffuseColor.rgb = mix(diffuseColor.rgb, gE * rE, grassy * 0.95);
}`;
const EARTH_FAR = `{
  float dF = length(vViewPosition), k30 = 1.0 - smoothstep(1500.0, 9000.0, dF), k15 = 1.0 - smoothstep(800.0, 5000.0, dF), k9 = 1.0 - smoothstep(300.0, 2500.0, dF);     // finer grain than a pixel is dropped (it shimmers)
  float lumaF = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
  float lushF = regN(vRegPos / 120.0, 30.0) * 0.6 + mix(0.5, regN(vRegPos / 30.0, 120.0), k30) * 0.4;
  float bareF = smoothstep(0.58, 0.72, regN(vRegPos / 60.0, 60.0) * 0.7 + mix(0.5, regN(vRegPos / 15.0, 240.0), k15) * 0.3);
  float edgeF = regN(vRegPos / 120.0, 30.0) * 0.4 + mix(0.5, regN(vRegPos / 30.0, 120.0), k30) * 0.35 + mix(0.5, regN(vRegPos / 9.0, 400.0), k9) * 0.25;
  float grassyF = smoothstep(0.02, 0.05, diffuseColor.g - diffuseColor.r + (edgeF - 0.5) * 0.2);       // ragged edges where sand meets grass (the triangles are hundreds of metres wide)
  vec3 gF = mix(vec3(0.055, 0.125, 0.028), vec3(0.14, 0.145, 0.05), smoothstep(0.35, 0.8, lushF));
  gF = mix(gF, vec3(0.34, 0.30, 0.20), bareF * 0.4);
  diffuseColor.rgb = mix(diffuseColor.rgb, gF * clamp(lumaF / 0.14, 0.6, 1.25), grassyF * 0.92);
}`;

export function installRegolith(material, THREE, opts = {}) {
  const phobos = opts.kind === 'phobos';
  const across = opts.across || { x: 0, y: 1, z: 0 };
  const uniforms = {
    uRegOffset: { value: new THREE.Vector3() },
    uRegBump: { value: opts.bump ?? 0.9 },
    uRegPebble: { value: opts.pebble ?? 1.0 },     // how dark the scattered pebbles are (a dark moon wants fewer black flecks)
  };
  if (phobos) uniforms.uGrooveAcross = { value: new THREE.Vector3(across.x, across.y, across.z) };
  // Flat faces on steep ground (the walking-scale patch only): the normal snaps toward each triangle's own, so a rock wall reads as a plane
  // with a hard edge where two walls meet, and gentle ground stays smooth. uRegUp is the patch's local up in world space.
  // The FAR tier (a moon's 8 km patch, seen from a few hundred metres up to orbit): the grit and pebbles are far below a pixel there, so it gets
  // the large-scale mottling and lumpy relief instead (30-120 m dust drifts, rock-strewn and clean ground), repeating every 3600 m.
  const far = !!opts.far;
  const flat = !!opts.flat;
  const earth = !!opts.earth;      // Earth's own ground (Florida grass, scrub and sand): see EARTH_NEAR / EARTH_FAR
  if (flat) uniforms.uRegUp = { value: new THREE.Vector3(0, 1, 0) };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uRegOffset;\nvarying vec3 vRegPos;' + (flat ? '\nattribute float rockness;\nvarying float vRockness;' : ''))
      .replace('#include <begin_vertex>', (opts.world
        ? '#include <begin_vertex>\nvRegPos = (modelMatrix * vec4(position, 1.0)).xyz + uRegOffset;'
        : '#include <begin_vertex>\nvRegPos = position + uRegOffset;') + (flat ? '\nvRockness = rockness;' : ''));
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uRegBump;
uniform float uRegPebble;
${phobos ? 'uniform vec3 uGrooveAcross;' : ''}
${flat ? 'uniform vec3 uRegUp;\nvarying float vRockness;' : ''}
varying vec3 vRegPos;
float regH(vec3 i, float P) { i = mod(i, P); return fract(sin(dot(i, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float regN(vec3 p, float P) {   // value noise, periodic every P cells
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float a = mix(mix(regH(i, P), regH(i + vec3(1,0,0), P), f.x), mix(regH(i + vec3(0,1,0), P), regH(i + vec3(1,1,0), P), f.x), f.y);
  float b = mix(mix(regH(i + vec3(0,0,1), P), regH(i + vec3(1,0,1), P), f.x), mix(regH(i + vec3(0,1,1), P), regH(i + vec3(1,1,1), P), f.x), f.y);
  return mix(a, b, f.z);
}
// frequencies are cells per metre; P = 360 m * frequency keeps every octave periodic over 360 m
float regField(vec3 p, float near, out float pebble) {
  float fineK = ${opts.moon || phobos ? '1.0 - smoothstep(250.0, 1000.0, length(vViewPosition))' : '1.0'};       // the 5 m octave is below a pixel past a few hundred metres: it aliases into a hatching
  float broad = regN(p * 0.05, 18.0) * 0.6 + mix(0.5, regN(p * 0.2, 72.0), fineK) * 0.4;       // 20 m / 5 m dusty vs darker patches
  float grit  = regN(p * 2.0, 720.0) * 0.6 + regN(p * 6.0, 2160.0) * 0.4;     // 50 cm / 17 cm grit
  float peb   = regN(p * 3.0, 1080.0);                                          // pebbles: the peaks of a 33 cm field
  float nearP = 1.0 - smoothstep(10.0, 60.0, length(vViewPosition));      // ROUND7: the 33 cm pebble speckle aliased into black sparkle from 30 m out; it now fades 10-60 m (the real stones below take over close in)
  pebble = smoothstep(0.78, 0.86, peb) * nearP * uRegPebble;                                  // fine detail fades with distance (no far speckle)
  // ROUND7 micro grain, only within a few metres of the eye (a walking-height shot looks at ground a metre or two away): 4 cm crumbs and 1.4 cm grain.
  // Each octave is gone before a pixel (about 1.5 cm at 8 m on a phone) gets as big as half its feature, or it moirés into rings.
  float dEye = length(vViewPosition), mk1 = 1.0 - smoothstep(1.2, 4.5, dEye), mk2 = 1.0 - smoothstep(0.5, 1.8, dEye), micro = 0.0;
  if (mk1 > 0.0) { micro = (regN(p * 25.0, 9000.0) - 0.5) * 0.34 * mk1; if (mk2 > 0.0) micro += (regN(p * 70.0, 25200.0) - 0.5) * 0.26 * mk2; }
  return broad * 0.55 + mix(0.5, grit, near) * 0.35 + pebble * 0.6 + micro;
}
float regHeight = 0.0;
vec3 regPerturb(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection) {   // three.js perturbNormalArb
  vec3 vSigmaX = normalize(dFdx(surf_pos.xyz)); vec3 vSigmaY = normalize(dFdy(surf_pos.xyz)); vec3 vN = surf_norm;
  vec3 R1 = cross(vSigmaY, vN); vec3 R2 = cross(vN, vSigmaX);
  float fDet = dot(vSigmaX, R1) * faceDirection;
  vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
  return normalize(abs(fDet) * surf_norm - vGrad);
}`)
      .replace('#include <color_fragment>', far ? `#include <color_fragment>
{
  float broadF = regN(vRegPos / 120.0, 30.0) * 0.5 + regN(vRegPos / 30.0, 120.0) * 0.3 + regN(vRegPos / 9.0, 400.0) * 0.2;
  float h = broadF; regHeight = h;
  diffuseColor.rgb *= clamp(0.84 + 0.42 * (h - 0.5), 0.62, 1.15);
  ${earth ? EARTH_FAR : ''}
  ${phobos ? `float luma = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(luma), 0.38);
  diffuseColor.rgb *= clamp(1.0 + 0.035 * sin(dot(vRegPos, uGrooveAcross) * 0.013), 0.95, 1.05);` : ''}
}` : `#include <color_fragment>
{
  float near = 1.0 - smoothstep(35.0, 140.0, length(vViewPosition));
  float pebble; float h = regField(vRegPos, near, pebble); regHeight = h;
  float shade = 0.8 + 0.3 * (h - 0.5) - 0.28 * pebble;       // dust lighter, grit and pebbles darker
  diffuseColor.rgb *= clamp(shade, 0.5, 1.15);
  ${earth ? EARTH_NEAR : ''}
  ${phobos ? `// Phobos: pull the rust out, then streak ACROSS the grooves (they run with the long axis, so the lines follow them). Mean of the multiplier is 1, so the 1.22 colour lift still matches the shell.
  float luma = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(luma), 0.38);
  float across = dot(vRegPos, uGrooveAcross);
  float lane = sin(across * 0.08);
  float streak = sin(across * 9.0 + regN(vRegPos * 0.7, 252.0) * 6.2831853);
  float dustg = regN(vRegPos * 1.6, 576.0);
  diffuseColor.rgb *= clamp(1.0 + 0.09 * lane * (1.0 - 0.6 * (1.0 - near)) + (0.06 * streak + 0.04 * (dustg - 0.5)) * near, 0.82, 1.18);     // the 70 cm streaks fade out with distance (they alias into a grid past a few tens of metres)` : ''}
}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
${flat ? `{
  vec3 nW = inverseTransformDirection(normal, viewMatrix);
  float steep = 1.0 - clamp(dot(nW, uRegUp), 0.0, 1.0);
  float faceAmt = smoothstep(0.10, 0.26, steep) * smoothstep(0.05, 0.5, vRockness);     // facets on rock only: on a crater wall a 0.6 m grid of flat triangles reads as a staircase
  vec3 fN = normalize(cross(dFdx(-vViewPosition), dFdy(-vViewPosition)));
  if (dot(fN, normal) < 0.0) fN = -fN;
  normal = normalize(mix(normal, fN, faceAmt * 0.9));
}` : ''}
normal = regPerturb(-vViewPosition, normal, vec2(dFdx(regHeight), dFdy(regHeight)) * uRegBump, faceDirection);`);
  };
  material.customProgramCacheKey = () => (earth ? `regolith-v1-earth-${far ? 'far' : 'near'}` : far ? (phobos ? 'regolith-v3-phobos-far' : 'regolith-v3-far') : opts.moon ? `regolith-v7-moon-${phobos ? 'p' : 'd'}${flat ? '-flat' : ''}` : phobos ? (flat ? 'regolith-v7-phobos-flat' : 'regolith-v5-phobos') : (opts.world ? 'regolith-v4-world' : 'regolith-v4'));
  material.needsUpdate = true;
  return uniforms;
}
