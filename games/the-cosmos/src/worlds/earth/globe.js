// ============================================================================
// worlds/earth/globe.js - how Earth looks from the sky and from space. Client only (three.js).
//   globe     the whole planet as one textured ball (NASA Blue Marble, assets/earth/earth-2k.jpg) lit by the Sun, with a night side and a blue rim. It replaces the
//             engine's own coarse shell, which is a vertex-coloured copy of the ground and has no sea. The ground tiers draw over it near the camera, the sea disc (sea.js)
//             over the oceans.
//   air       a thin blue shell round the globe (the limb glow seen from orbit) and a layer of cloud on a second shell, both only drawn from high up
//   dome      the sky from the ground: a gradient from the haze at the horizon to deep blue overhead, warm round a low Sun. (The scene's own sky is one flat colour.)
//   deck      a cloud layer 2.4 km up, drawn round the camera, for when you are standing on the ground or flying low
// Every shader carries the logarithmic-depth chunks the engine's renderer needs. Nothing here is a texture download but the one picture.
// ============================================================================
import * as THREE from 'three';

const R = 6_371_000, DEG = Math.PI / 180;
const LOG_VS = '#include <common>\n#include <logdepthbuf_pars_vertex>';
const NOISE = `
float h31(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
float vn(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fb(vec3 p) { return 0.5 * vn(p) + 0.25 * vn(p * 2.03) + 0.125 * vn(p * 4.1) + 0.0625 * vn(p * 8.3); }`;

/** The globe's own sphere: positions in the frame's axes, texture coordinates from the BODY's longitude and latitude (so the picture sits on the real ground). */
function globeGeometry(body, segW, segH) {
  const pos = [], uv = [], idx = [], nor = [];
  const ex = body.axesWorld.ex, ey = body.axesWorld.ey;
  for (let j = 0; j <= segH; j++) {
    const lat = Math.PI / 2 - j / segH * Math.PI;
    for (let i = 0; i <= segW; i++) {
      const lon = -Math.PI + i / segW * 2 * Math.PI, cl = Math.cos(lat), u = cl * Math.cos(lon), v = cl * Math.sin(lon), w = Math.sin(lat);
      const x = u * ex.x + v * ey.x, y = w, z = u * ex.z + v * ey.z;
      pos.push(x * R, y * R, z * R); nor.push(x, y, z); uv.push(i / segW, 1 - j / segH);
    }
  }
  for (let j = 0; j < segH; j++) for (let i = 0; i < segW; i++) { const a = j * (segW + 1) + i, b = a + 1, c = a + segW + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), R * 1.1);
  return g;
}

export function buildGlobe({ engine, world, tier, space }) {
  const low = tier === 'low', body = world.body, scene = engine.scene;
  const sunU = { value: new THREE.Vector3(1, 0, 0) }, hazeCol = { value: new THREE.Color(0xbcd9f2) }, hazeK = { value: 0 };
  const objs = [];

  // ---- the globe
  const gmat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: null }, uSun: sunU, uHaze: hazeCol, uHazeK: hazeK },
    vertexShader: `${LOG_VS}
varying vec3 vN; varying vec3 vNV; varying vec2 vUv; varying vec3 vV;
void main(){ vN = normal; vNV = normalize(normalMatrix * normal); vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; gl_Position = projectionMatrix * mv;
#include <logdepthbuf_vertex>
}`,
    fragmentShader: `precision highp float;
#include <common>
#include <logdepthbuf_pars_fragment>
uniform sampler2D uMap; uniform vec3 uSun; uniform vec3 uHaze; uniform float uHazeK;
varying vec3 vN; varying vec3 vNV; varying vec2 vUv; varying vec3 vV;
void main(){
#include <logdepthbuf_fragment>
  vec3 c = texture2D(uMap, vUv).rgb;
  float d = dot(normalize(vN), normalize(uSun));
  float day = smoothstep(-0.06, 0.22, d);
  vec3 lit = c * (0.05 + 1.35 * max(d, 0.0));
  float ndv = clamp(dot(normalize(vNV), normalize(vV)), 0.0, 1.0);
  float rim = pow(1.0 - ndv, 3.0);
  lit += vec3(0.28, 0.52, 1.0) * rim * 0.55 * smoothstep(-0.2, 0.4, d);
  // a glint of the Sun off the sea (the sea is the dark, blue part of the picture)
  float sea = smoothstep(0.30, 0.0, c.r - c.b + 0.05);
  vec3 refl = reflect(-normalize(vV), normalize(vNV));
  lit += vec3(1.0, 0.95, 0.85) * sea * pow(max(dot(refl, normalize((viewMatrix * vec4(uSun, 0.0)).xyz)), 0.0), 60.0) * 0.5;
  vec3 night = c * c * vec3(0.012, 0.016, 0.03);
  vec3 col = mix(night, lit, day);
  float f = 1.0 - exp(-pow(uHazeK * length(vV), 2.0));
  col = mix(col, uHaze, clamp(f, 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
#include <colorspace_fragment>
}`,
    toneMapped: false, fog: false,
  });
  const globe = new THREE.Mesh(globeGeometry(body, low ? 256 : 384, low ? 128 : 192), gmat);
  globe.name = 'earth-globe'; globe.frustumCulled = false; globe.renderOrder = -1;
  // the globe stands 150 m under sea level: its coarse triangles dip under the true sphere and must never poke through the sea or the ground tiers
  globe.scale.setScalar((R - 150) / R);
  scene.add(globe); objs.push(globe);
  const gEntry = engine.track({ worldPos: { x: 0, y: 0, z: 0 }, object3d: globe, frame: world.frame });
  new THREE.TextureLoader().load(new URL('../../../assets/earth/earth-2k.jpg', import.meta.url).href, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.wrapS = THREE.RepeatWrapping; gmat.uniforms.uMap.value = t; gmat.needsUpdate = true; }, undefined, () => {});

  // ---- the rim of air, and the cloud
  const amat = new THREE.ShaderMaterial({
    uniforms: { uSun: sunU }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide, toneMapped: false, fog: false,
    vertexShader: `${LOG_VS}
varying vec3 vN; varying vec3 vNV; varying vec3 vV;
void main(){ vN = normal; vNV = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; gl_Position = projectionMatrix * mv;
#include <logdepthbuf_vertex>
}`,
    fragmentShader: `precision highp float;
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uSun; varying vec3 vN; varying vec3 vNV; varying vec3 vV;
void main(){
#include <logdepthbuf_fragment>
  float ndv = clamp(dot(-normalize(vNV), normalize(vV)), 0.0, 1.0);          // 1 at the middle of the ball's disc, 0 at its edge
  float g = pow(1.0 - ndv, 2.2);
  float lit = smoothstep(-0.25, 0.5, dot(normalize(vN), normalize(uSun)));
  vec3 col = mix(vec3(0.20, 0.45, 1.0), vec3(0.55, 0.78, 1.0), pow(1.0 - ndv, 6.0)) * g * lit;
  gl_FragColor = vec4(col * 0.9, 1.0);
#include <colorspace_fragment>
}`,
  });
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.02, low ? 64 : 96, low ? 40 : 64), amat);
  atmo.name = 'earth-air'; atmo.frustumCulled = false; atmo.renderOrder = 3; scene.add(atmo); objs.push(atmo);
  const aEntry = engine.track({ worldPos: { x: 0, y: 0, z: 0 }, object3d: atmo, frame: world.frame });

  const cmat = new THREE.ShaderMaterial({
    uniforms: { uSun: sunU, uT: { value: 0 }, uHaze: hazeCol, uHazeK: hazeK }, transparent: true, depthWrite: false, side: THREE.FrontSide, toneMapped: false, fog: false,
    vertexShader: `${LOG_VS}
varying vec3 vN; varying vec3 vNV; varying vec3 vV; varying vec3 vP;
void main(){ vN = normal; vP = normal; vNV = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; gl_Position = projectionMatrix * mv;
#include <logdepthbuf_vertex>
}`,
    fragmentShader: `precision highp float;
#include <common>
#include <logdepthbuf_pars_fragment>
${NOISE}
uniform vec3 uSun; uniform float uT; uniform vec3 uHaze; uniform float uHazeK; varying vec3 vN; varying vec3 vNV; varying vec3 vV; varying vec3 vP;
void main(){
#include <logdepthbuf_fragment>
  vec3 p = normalize(vP);
  float lat = abs(p.y);
  float band = 0.5 + 0.5 * cos(lat * 12.0 + 0.6);                    // wetter belts at the equator and the mid-latitudes
  float n = fb(p * 4.2 + vec3(uT * 0.0006, 0.0, 0.0)) * 0.75 + fb(p * 11.0 - 3.1) * 0.25;
  float a = smoothstep(0.50 - 0.10 * band, 0.78 - 0.10 * band, n);
  float d = dot(normalize(vN), normalize(uSun));
  float day = smoothstep(-0.08, 0.2, d);
  vec3 col = vec3(1.0) * (0.04 + 1.1 * max(d, 0.0)) * day + vec3(0.01, 0.014, 0.025) * (1.0 - day);
  float f = 1.0 - exp(-pow(uHazeK * length(vV), 2.0));
  col = mix(col, uHaze, clamp(f, 0.0, 1.0));
  gl_FragColor = vec4(col, a * 0.92);
#include <colorspace_fragment>
}`,
  });
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(R + 11_000, low ? 128 : 192, low ? 64 : 96), cmat);
  clouds.name = 'earth-clouds'; clouds.frustumCulled = false; clouds.renderOrder = 2; scene.add(clouds); objs.push(clouds);
  const cEntry = engine.track({ worldPos: { x: 0, y: 0, z: 0 }, object3d: clouds, frame: world.frame });

  // ---- the sky from the ground
  const U = { uUp: { value: new THREE.Vector3(0, 1, 0) }, uSun: sunU, uZen: { value: new THREE.Color(0x2c68c8) }, uHor: { value: new THREE.Color(0xbcd9f2) }, uK: { value: 1 }, uSunEl: { value: 1 }, uBg: { value: new THREE.Color(0, 0, 0) } };
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), new THREE.ShaderMaterial({
    uniforms: U, side: THREE.BackSide, depthTest: false, depthWrite: false, toneMapped: false, fog: false,
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: `precision highp float;
uniform vec3 uUp; uniform vec3 uSun; uniform vec3 uZen; uniform vec3 uHor; uniform float uK; uniform float uSunEl; uniform vec3 uBg; varying vec3 vDir;
void main(){
  vec3 d = normalize(vDir);
  float e = dot(d, uUp);
  float t = pow(clamp(e, 0.0, 1.0), 0.45);
  vec3 col = mix(uHor, uZen, t);
  col = mix(col, uHor * 0.95, smoothstep(0.0, -0.12, e));                      // below the horizon: haze, the ground draws over it
  float s = max(dot(d, normalize(uSun)), 0.0);
  float low = 1.0 - smoothstep(4.0, 30.0, uSunEl);
  col += vec3(1.0, 0.62, 0.32) * pow(s, 6.0) * 0.55 * low + vec3(1.0, 0.9, 0.75) * pow(s, 40.0) * 0.25;
  gl_FragColor = vec4(mix(uBg, col, uK), 1.0);
#include <colorspace_fragment>
}`,
  }));
  dome.name = 'earth-sky'; dome.renderOrder = -900; dome.frustumCulled = false; dome.scale.setScalar(1e5); scene.add(dome); objs.push(dome);

  // ---- the cloud deck
  const dk = { uOff: { value: new THREE.Vector2() }, uT: { value: 0 }, uSun: sunU, uUp: U.uUp, uCover: { value: 0.42 }, uK: { value: 1 }, uHaze: hazeCol };
  const deck = new THREE.Mesh(new THREE.CircleGeometry(60_000, 64, 0, Math.PI * 2), new THREE.ShaderMaterial({
    uniforms: dk, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false,
    vertexShader: `${LOG_VS}
varying vec3 vL; varying vec3 vV; void main(){ vL = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; gl_Position = projectionMatrix * mv;
#include <logdepthbuf_vertex>
}`,
    fragmentShader: `precision highp float;
#include <common>
#include <logdepthbuf_pars_fragment>
${NOISE}
uniform vec2 uOff; uniform float uT; uniform vec3 uSun; uniform vec3 uUp; uniform float uCover; uniform float uK; uniform vec3 uHaze; varying vec3 vL; varying vec3 vV;
void main(){
#include <logdepthbuf_fragment>
  vec2 p = (vL.xy + uOff) / 1400.0;                                          // the disc lies in its own x-y plane (rotated flat by the mesh)
  vec3 q = vec3(p, uT * 0.004);
  float n = fb(q) * 0.65 + fb(q * 3.7 + 5.0) * 0.35;
  float a = smoothstep(1.0 - uCover - 0.10, 1.0 - uCover + 0.10, n);
  float r = length(vL.xy) / 60000.0;
  a *= 1.0 - smoothstep(0.55, 1.0, r);
  float sun = clamp(dot(normalize(uSun), uUp), 0.0, 1.0);
  float shade = 0.62 + 0.38 * smoothstep(0.35, 0.7, n);                      // thicker cloud is greyer underneath
  vec3 col = mix(vec3(0.60, 0.64, 0.70), vec3(1.0, 0.99, 0.97), shade) * (0.15 + 0.85 * sqrt(sun));
  float f = 1.0 - exp(-pow(0.000032 * length(vV), 2.0));
  col = mix(col, uHaze, clamp(f, 0.0, 1.0) * 0.8);
  gl_FragColor = vec4(col, a * 0.94 * uK);
#include <colorspace_fragment>
}`,
  }));
  deck.name = 'earth-cloud-deck'; deck.renderOrder = 4; deck.frustumCulled = false; scene.add(deck); objs.push(deck);
  const dEntry = engine.track({ worldPos: { x: 0, y: 0, z: 0 }, object3d: deck, frame: world.frame, quaternion: new THREE.Quaternion() });

  // keep the engine's own shell hidden: it is the same ground without the sea or the picture
  for (const m of [world.shell, world.shellFar]) if (m) Object.defineProperty(m, 'visible', { get: () => false, set() {}, configurable: true });

  // the engine's old dust-sky stars show by day on Mars; here the daytime sky is blue: keep them off while the camera is in Earth's frame
  const oldStars = scene.getObjectByName('starfield'); let starsStored = oldStars ? oldStars.visible : false;
  if (oldStars) Object.defineProperty(oldStars, 'visible', { get: () => starsStored && !(space && space.frameId === 'earth'), set(v) { starsStored = v; }, configurable: true });
  // a little fill from the sky and the bright ground, so a wall in shade is white-grey and not blue-black (the shared sky light is tuned for Mars)
  const fill = new THREE.AmbientLight(0xdfe9ff, 0); fill.name = 'earth-fill'; scene.add(fill); objs.push(fill);
  const _up = new THREE.Vector3(), _q = new THREE.Quaternion(), _a = new THREE.Vector3(0, 0, 1), E0 = new THREE.Vector3(body.padInfo.east.x, body.padInfo.east.y, body.padInfo.east.z), N0 = new THREE.Vector3(body.padInfo.north.x, body.padInfo.north.y, body.padInfo.north.z);
  let t = 0;
  return {
    globe, atmo, clouds, dome, deck,
    update(dt, focus) {
      t += dt;
      const l = Math.hypot(focus.x, focus.y, focus.z) || 1, alt = l - R, st = space && space.sky ? space.sky.state : { s: 1, day: 1, elev: 40 };
      _up.set(focus.x / l, focus.y / l, focus.z / l);
      if (space && space.sunLocal) sunU.value.copy(space.sunLocal);
      const fog = scene.fog; hazeCol.value.copy(fog ? fog.color : new THREE.Color(0xbcd9f2)); hazeK.value = fog ? fog.density : 0;
      const dayK = Math.max(0.02, st.day), blend = Math.max(0, Math.min(1, st.s));
      // the dome: only while there is air around the camera; its colours follow the day
      dome.visible = blend * Math.max(0, Math.min(1, (st.day - 0.02) / 0.3)) > 0.03 && alt < 120_000;
      dome.position.set(0, 0, 0);
      U.uUp.value.copy(_up); U.uSunEl.value = st.elev; if (scene.background && scene.background.isColor) U.uBg.value.copy(scene.background);
      U.uZen.value.set(0x2a66c6).multiplyScalar(dayK * (0.5 + 0.5 * dayK)); U.uHor.value.set(0xc4ddf3).multiplyScalar(0.25 + 0.75 * dayK);
      const nightFade = Math.max(0, Math.min(1, (st.day - 0.02) / 0.3));
      U.uK.value = blend * nightFade;
      // the deck and the cloud shell trade places around 14 km
      const sea = alt;
      deck.visible = sea < 40_000;
      dk.uK.value = 1 - Math.max(0, Math.min(1, (sea - 12_000) / 20_000)) ;
      _q.setFromUnitVectors(_a, _up);
      dEntry.quaternion.copy(_q);
      const r0 = R + 2400; dEntry.worldPos.x = _up.x * r0; dEntry.worldPos.y = _up.y * r0; dEntry.worldPos.z = _up.z * r0;
      const wx = dEntry.worldPos.x, wy = dEntry.worldPos.y, wz = dEntry.worldPos.z;
      // slide the pattern with the wind and keep it fixed to the ground: the disc follows the camera, the noise is read at (east, north) of the pad
      const ox = wx * E0.x + wy * E0.y + wz * E0.z + t * 6, oz = wx * N0.x + wy * N0.y + wz * N0.z;
      // the disc's own x axis is (rotated) arbitrary, so give the shader the pad-plane offset and let it read local x-y: a drifting field is all it needs
      dk.uOff.value.set(ox, oz);
      cmat.uniforms.uT.value = t; dk.uT.value = t;
      fill.intensity = (space && space.frameId === 'earth') ? 0.55 * blend * Math.max(0, Math.min(1, st.day)) : 0;
      clouds.visible = alt > 9_000;
      atmo.visible = alt > 30_000;
      deck.material.uniforms.uK.value = dk.uK.value;
    },
    setTextureReady() { return !!gmat.uniforms.uMap.value; },
    dispose() { for (const e of [gEntry, aEntry, cEntry, dEntry]) engine.untrack(e); for (const o of objs) { scene.remove(o); if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); } if (oldStars) { delete oldStars.visible; oldStars.visible = starsStored; } },
  };
}
