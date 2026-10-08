// ============================================================================
// worlds/earth/sea.js - the sea. The ground has a sea floor (the real one) and nothing above it (docs/ADD-A-WORLD.md: no water surface for `ocean`), so Earth draws its own:
// a disc of water centred under the camera, curved to the planet, 160 km across, rings getting wider with distance (a flat mirror needs no triangles; the waves are the
// shader's). It is see-through enough to show the sand of the shelf in the shallows and dark water over the deep. Beyond the disc the globe (globe.js) carries on.
// Client only (three.js).
// ============================================================================
import * as THREE from 'three';

const R = 6_371_000, RINGS = 64, SEGS = 72, R0 = 8, RMAX = 160_000, PERIOD = 2048;
const _q = new THREE.Quaternion(), _up = new THREE.Vector3(), _Y = new THREE.Vector3(0, 1, 0), _qi = new THREE.Quaternion(), _v = new THREE.Vector3();

function ringGeometry(low) {
  const rings = low ? 48 : RINGS, segs = low ? 56 : SEGS, q = Math.pow(RMAX / R0, 1 / (rings - 1));
  const pos = new Float32Array(((rings + 1) * segs + 1) * 3), nor = new Float32Array(pos.length);
  let n = 0;
  const put = (r, a) => {                                                   // a point on the sphere `r` metres (along the ground) from the centre
    const th = r / R, h = R * Math.cos(th) - R, d = R * Math.sin(th);       // y: the drop below the tangent plane; d: horizontal reach
    pos[n * 3] = d * Math.cos(a); pos[n * 3 + 1] = h; pos[n * 3 + 2] = d * Math.sin(a);
    nor[n * 3] = Math.sin(th) * Math.cos(a) * -1; nor[n * 3 + 1] = Math.cos(th); nor[n * 3 + 2] = Math.sin(th) * Math.sin(a) * -1;
    n++;
  };
  put(0, 0);
  const idx = [];
  for (let k = 0; k <= rings; k++) {
    const r = k === 0 ? 3 : R0 * Math.pow(q, k - 1);
    for (let s = 0; s < segs; s++) put(k === 0 ? 3 : r, s / segs * Math.PI * 2);
  }
  // centre fan, then quads between rings
  const at = (k, s) => 1 + k * segs + (s % segs);
  for (let s = 0; s < segs; s++) idx.push(0, at(0, s + 1), at(0, s));
  for (let k = 0; k < rings; k++) for (let s = 0; s < segs; s++) { const a = at(k, s), b = at(k, s + 1), c = at(k + 1, s), d = at(k + 1, s + 1); idx.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, n * 3), 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor.subarray(0, n * 3), 3));
  g.setIndex(idx); g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), RMAX * 1.2);
  return g;
}

export function buildSea({ engine, world, tier }) {
  const low = tier === 'low', body = world.body, pi = body.padInfo;
  const E0 = new THREE.Vector3(pi.east.x, pi.east.y, pi.east.z), N0 = new THREE.Vector3(pi.north.x, pi.north.y, pi.north.z);
  const U = { uE: { value: new THREE.Vector3() }, uN: { value: new THREE.Vector3() }, uOff: { value: new THREE.Vector2() }, uT: { value: 0 }, uSky: { value: new THREE.Color(0x8fc0ee) }, uDeep: { value: new THREE.Color(0x0a4052) }, uShallow: { value: new THREE.Color(0x1f8f9a) } };
  const mat = new THREE.MeshStandardMaterial({ color: 0x0b4a5c, roughness: 0.1, metalness: 0.0, transparent: true, opacity: 0.8, depthWrite: false, envMapIntensity: 0 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform vec3 uE; uniform vec3 uN;\nvarying vec3 vSeaPos; varying vec3 vTE; varying vec3 vTN; varying float vDist;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSeaPos = position; vTE = normalize(normalMatrix * uE); vTN = normalize(normalMatrix * uN); vDist = length(position.xz);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform vec3 uE; uniform vec3 uN; uniform vec2 uOff; uniform float uT; uniform vec3 uSky; uniform vec3 uDeep; uniform vec3 uShallow;
varying vec3 vSeaPos; varying vec3 vTE; varying vec3 vTN; varying float vDist;
// a swell and a chop: sums of travelling sines in the world's own (east, north) plane, and their slope
vec2 seaSlope(vec2 p, float t, float fade) {
  vec2 g = vec2(0.0);
  const int N = 6;
  float kx[6]; float kz[6]; float am[6]; float sp[6];
  kx[0] = 0.021; kz[0] = 0.008; am[0] = 0.55; sp[0] = 0.9;
  kx[1] = -0.013; kz[1] = 0.027; am[1] = 0.40; sp[1] = 1.1;
  kx[2] = 0.063; kz[2] = -0.031; am[2] = 0.22; sp[2] = 1.6;
  kx[3] = -0.052; kz[3] = -0.071; am[3] = 0.16; sp[3] = 1.9;
  kx[4] = 0.17; kz[4] = 0.11; am[4] = 0.07; sp[4] = 2.8;
  kx[5] = -0.21; kz[5] = 0.19; am[5] = 0.05; sp[5] = 3.2;
  for (int i = 0; i < N; i++) {
    float k = length(vec2(kx[i], kz[i]));
    float ph = dot(vec2(kx[i], kz[i]), p) + t * sp[i];
    float f = (i > 3) ? fade : 1.0;
    g += vec2(kx[i], kz[i]) * cos(ph) * am[i] * f * 0.55;
  }
  return g;
}`).replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{
  vec2 wp = vec2(uOff.x + dot(vSeaPos, uE), uOff.y + dot(vSeaPos, uN));
  float fade = 1.0 - smoothstep(60.0, 700.0, vDist), calm = 1.0 - 0.8 * smoothstep(400.0, 6000.0, vDist);
  vec2 sl = seaSlope(wp, uT, fade) * calm * 0.12;
  normal = normalize(normal - sl.x * vTE - sl.y * vTN);
}`).replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{
  float ndv = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
  float fres = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
  totalEmissiveRadiance += uSky * fres * 0.9;
  diffuseColor.a = clamp(diffuseColor.a + fres * 0.6, 0.0, 1.0);
}`);
  };
  mat.customProgramCacheKey = () => 'earth-sea-v1';
  const mesh = new THREE.Mesh(ringGeometry(low), mat);
  mesh.name = 'earth-sea'; mesh.renderOrder = 2; mesh.frustumCulled = false; mesh.receiveShadow = false; mesh.castShadow = false;
  engine.scene.add(mesh);
  const entry = engine.track({ worldPos: { x: 0, y: 0, z: 0 }, object3d: mesh, frame: world.frame, quaternion: new THREE.Quaternion() });
  let t = 0;
  return {
    mesh, material: mat,
    /** focus: the camera in this world's metres. */
    update(dt, focus) {
      t += dt;
      const l = Math.hypot(focus.x, focus.y, focus.z) || 1, alt = l - R;
      mesh.visible = alt < 400_000;
      if (!mesh.visible) return;
      _up.set(focus.x / l, focus.y / l, focus.z / l);
      _q.setFromUnitVectors(_Y, _up); entry.quaternion.copy(_q);
      entry.worldPos.x = _up.x * R; entry.worldPos.y = _up.y * R; entry.worldPos.z = _up.z * R;
      _qi.copy(_q).invert();
      U.uE.value.copy(E0).applyQuaternion(_qi); U.uN.value.copy(N0).applyQuaternion(_qi);
      // the waves live in the pad's (east, north) plane: where the patch's centre is in it
      const ox = entry.worldPos.x * E0.x + entry.worldPos.y * E0.y + entry.worldPos.z * E0.z, oz = entry.worldPos.x * N0.x + entry.worldPos.y * N0.y + entry.worldPos.z * N0.z;
      U.uOff.value.set(ox, oz);
      U.uT.value = t;
    },
    setLook(sky, deep) { U.uSky.value.set(sky); mat.color.set(deep); },
    dispose() { engine.untrack(entry); engine.scene.remove(mesh); mesh.geometry.dispose(); mat.dispose(); },
  };
}
