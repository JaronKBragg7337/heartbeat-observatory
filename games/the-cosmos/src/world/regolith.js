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
  const flat = !!opts.flat;
  if (flat) uniforms.uRegUp = { value: new THREE.Vector3(0, 1, 0) };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uRegOffset;\nvarying vec3 vRegPos;')
      .replace('#include <begin_vertex>', opts.world
        ? '#include <begin_vertex>\nvRegPos = (modelMatrix * vec4(position, 1.0)).xyz + uRegOffset;'
        : '#include <begin_vertex>\nvRegPos = position + uRegOffset;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uRegBump;
uniform float uRegPebble;
${phobos ? 'uniform vec3 uGrooveAcross;' : ''}
${flat ? 'uniform vec3 uRegUp;' : ''}
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
  float broad = regN(p * 0.05, 18.0) * 0.6 + regN(p * 0.2, 72.0) * 0.4;       // 20 m / 5 m dusty vs darker patches
  float grit  = regN(p * 2.0, 720.0) * 0.6 + regN(p * 6.0, 2160.0) * 0.4;     // 50 cm / 17 cm grit
  float peb   = regN(p * 3.0, 1080.0);                                          // pebbles: the peaks of a 33 cm field
  pebble = smoothstep(0.78, 0.86, peb) * near * uRegPebble;                                  // fine detail fades with distance (no far speckle)
  return broad * 0.55 + mix(0.5, grit, near) * 0.35 + pebble * 0.6;
}
float regHeight = 0.0;
vec3 regPerturb(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection) {   // three.js perturbNormalArb
  vec3 vSigmaX = normalize(dFdx(surf_pos.xyz)); vec3 vSigmaY = normalize(dFdy(surf_pos.xyz)); vec3 vN = surf_norm;
  vec3 R1 = cross(vSigmaY, vN); vec3 R2 = cross(vN, vSigmaX);
  float fDet = dot(vSigmaX, R1) * faceDirection;
  vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
  return normalize(abs(fDet) * surf_norm - vGrad);
}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  float near = 1.0 - smoothstep(35.0, 140.0, length(vViewPosition));
  float pebble; float h = regField(vRegPos, near, pebble); regHeight = h;
  float shade = 0.8 + 0.3 * (h - 0.5) - 0.28 * pebble;       // dust lighter, grit and pebbles darker
  diffuseColor.rgb *= clamp(shade, 0.5, 1.15);
  ${phobos ? `// Phobos: pull the rust out, then streak ACROSS the grooves (they run with the long axis, so the lines follow them). Mean of the multiplier is 1, so the 1.22 colour lift still matches the shell.
  float luma = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(luma), 0.38);
  float across = dot(vRegPos, uGrooveAcross);
  float lane = sin(across * 0.08);
  float streak = sin(across * 9.0 + regN(vRegPos * 0.7, 252.0) * 6.2831853);
  float dustg = regN(vRegPos * 1.6, 576.0);
  diffuseColor.rgb *= clamp(1.0 + 0.09 * lane + 0.06 * streak + 0.04 * (dustg - 0.5), 0.82, 1.18);` : ''}
}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
${flat ? `{
  vec3 nW = inverseTransformDirection(normal, viewMatrix);
  float steep = 1.0 - clamp(dot(nW, uRegUp), 0.0, 1.0);
  float faceAmt = smoothstep(0.10, 0.26, steep);
  vec3 fN = normalize(cross(dFdx(-vViewPosition), dFdy(-vViewPosition)));
  if (dot(fN, normal) < 0.0) fN = -fN;
  normal = normalize(mix(normal, fN, faceAmt * 0.9));
}` : ''}
normal = regPerturb(-vViewPosition, normal, vec2(dFdx(regHeight), dFdy(regHeight)) * uRegBump, faceDirection);`);
  };
  material.customProgramCacheKey = () => (phobos ? (flat ? 'regolith-v3-phobos-flat' : 'regolith-v3-phobos') : (opts.world ? 'regolith-v2-world' : 'regolith-v2'));
  material.needsUpdate = true;
  return uniforms;
}
