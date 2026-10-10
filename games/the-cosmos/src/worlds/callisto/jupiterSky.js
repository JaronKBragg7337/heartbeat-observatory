// ============================================================================
// worlds/callisto/jupiterSky.js - Jupiter in Callisto's sky. 71,492 km across at 1,882,700 km, about 4.4 degrees wide: nine full
// Moons, banded, always in the same place (Callisto keeps one face to it). The picture is the game's own copy of the Solar System
// Scope Jupiter texture (CC BY 4.0, credited in credits.json; based on NASA data). Lit by the same Sun as the ground, placed by the
// real Jupiter-Callisto line from the ephemeris (worlds/_kit/ephemeris.js), in the direction the ephemeris puts it.
// One Jupiter serves the engine (made once, counted): shown whenever the ship is in Callisto's frame, hidden everywhere else.
// Honest note: a frame can only turn about Mars's pole (worlds/_kit docs), so Callisto's own pole and libration are not drawn.
// ============================================================================
import * as THREE from 'three';
import { worldCentre } from '../registry.js';
import { rotY } from '../../space/frames.js';

const JUPITER_R = 71_492_000, D = 2.0e8;
const UP = new THREE.Vector3(0, 1, 0), pole = new THREE.Vector3(), spin = new THREE.Quaternion();
const VS = `varying vec3 vN; varying vec3 vNV; varying vec2 vUv; void main(){ vN = normalize(mat3(modelMatrix) * normal); vNV = normalize(normalMatrix * normal); vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FS = `uniform sampler2D uMap; uniform vec3 uSun; varying vec3 vN; varying vec3 vNV; varying vec2 vUv;
void main(){
  vec3 c = texture2D(uMap, vUv).rgb;
  // the cloud bands are low-contrast in the picture: stretch them and warm them so the stripes and the Great Red Spot read at 4 degrees
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = clamp(mix(vec3(l), c, 1.55), 0.0, 1.0);
  c = clamp((c - 0.5) * 1.45 + 0.5, 0.0, 1.0);
  float d = dot(normalize(vN), normalize(uSun));
  // a deep cloud deck scatters light round the terminator: wrap the light so the lit side is a broad, banded crescent-to-gibbous
  float wrap = clamp((d + 0.25) / 1.25, 0.0, 1.0);
  float day = smoothstep(-0.25, 0.1, d);
  vec3 night = c * c * vec3(0.012, 0.014, 0.026);
  vec3 lit = c * (0.12 + 1.75 * wrap);
  float rim = pow(1.0 - clamp(normalize(vNV).z, 0.0, 1.0), 3.0);
  gl_FragColor = vec4(mix(night, lit, day) + vec3(0.72, 0.62, 0.5) * rim * (0.15 + 0.85 * day) * 0.35, 1.0);
  #include <colorspace_fragment>
}`;

let _shared = null;
/** The Jupiter for this engine (made once, counted). `release()` it when the world's dressing is disposed. */
export function acquireJupiter({ engine, space }) {
  if (_shared && _shared.engine === engine) { _shared.refs++; return _shared.api; }
  const mat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: { uMap: { value: null }, uSun: { value: new THREE.Vector3(1, 0, 0) } }, toneMapped: false, fog: false, depthWrite: false });
  new THREE.TextureLoader().load(new URL('../../../assets/callisto/jupiter-1k.jpg', import.meta.url).href, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; mat.uniforms.uMap.value = t; mat.needsUpdate = true; }, undefined, () => {});
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 28), mat); mesh.name = 'jupiter-in-the-sky'; mesh.frustumCulled = false; mesh.renderOrder = 6; mesh.visible = false;
  engine.scene.add(mesh);
  let nextAt = 0, dist = 1.8827e9; const dir = new THREE.Vector3(1, 0, 0), tmp = {};
  const api = {
    mesh,
    /** Where Jupiter is now, in the active frame's axes. Cheap: the line is recomputed twice a second. Called every frame by the engine. */
    update() {
      mesh.visible = space.frameId === 'callisto' && !!mat.uniforms.uMap.value;
      if (!mesh.visible) return;
      const now = performance.now();
      if (now > nextAt) {
        nextAt = now + 500;
        const T = space.timeS(), c = worldCentre('callisto', T), j = worldCentre('jupiter', T), d = { x: j.x - c.x, y: j.y - c.y, z: j.z - c.z };
        dist = Math.hypot(d.x, d.y, d.z) || 1.8827e9;
        const r = rotY(d, -engine.activeFrame.yaw, tmp); dir.set(r.x / dist, r.y / dist, r.z / dist);
      }
      mesh.position.copy(dir).multiplyScalar(D);
      mesh.scale.setScalar(D * Math.tan(Math.asin(Math.min(1, JUPITER_R / dist))));
      mat.uniforms.uSun.value.copy(space.sunLocal);
      // The spin axis must lie across the line of sight, or the camp sees Jupiter pole-on (the dull grey cap, no stripes). Callisto's frame
      // turns about Mars's pole only, so Jupiter's real pole is not drawable here: take whichever frame axis is most across the line of
      // sight (so the bands run across the disc) and turn the planet about it, once every 9 h 55 m.
      const ax = Math.abs(dir.x) <= Math.abs(dir.y) && Math.abs(dir.x) <= Math.abs(dir.z) ? [1, 0, 0] : Math.abs(dir.z) <= Math.abs(dir.y) ? [0, 0, 1] : [0, 1, 0];
      const dp = ax[0] * dir.x + ax[1] * dir.y + ax[2] * dir.z;
      pole.set(ax[0] - dir.x * dp, ax[1] - dir.y * dp, ax[2] - dir.z * dp).normalize();
      mesh.quaternion.setFromUnitVectors(UP, pole).multiply(spin.setFromAxisAngle(UP, (space.timeS() / 35730) * Math.PI * 2));
    },
    release() { if (_shared && _shared.api === api && --_shared.refs <= 0) { engine.scene.remove(mesh); mat.dispose(); mesh.geometry.dispose(); _shared = null; } },
  };
  _shared = { engine, refs: 1, api };
  engine.addUpdater(() => { if (_shared && _shared.api === api) api.update(); });
  return api;
}
