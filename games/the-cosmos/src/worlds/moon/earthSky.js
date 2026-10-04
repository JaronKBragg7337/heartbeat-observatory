// ============================================================================
// worlds/moon/earthSky.js - Earth in the Moon's sky. 3.7 times the width of the Moon seen from Earth (1.9 degrees), lit by the same Sun as the ground, in the
// direction the ephemeris puts it (worlds/_kit/ephemeris.js: the Moon goes round the Earth on its real orbit). The picture is NASA's Blue Marble (public domain,
// 1024 x 512, assets/moon/earth.jpg). From the far side Earth is never above the horizon, which is the whole reason Daedalus is where the dishes are.
// One Earth serves all three landings (they are one body): it is made by the first landing built, shown whenever the ship is in the Moon's region (any of the three
// frames, on the ground or in the drive's long legs) and hidden everywhere else.
// Honest note: a frame can only turn about Mars's pole (worlds/_kit docs), so the Moon's own pole and its libration are not drawn: Earth is placed by the real
// Earth-Moon line, and the Moon's longitude 0 faces it on average.
// ============================================================================
import * as THREE from 'three';
import { worldCentre } from '../registry.js';
import { rotY } from '../../space/frames.js';

const EARTH_R = 6_371_000, D = 2.0e8;
export const MOON_FRAMES = ['moon', 'moon-shackleton', 'moon-daedalus'];
const VS = `varying vec3 vN; varying vec3 vNV; varying vec2 vUv; void main(){ vN = normalize(mat3(modelMatrix) * normal); vNV = normalize(normalMatrix * normal); vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FS = `uniform sampler2D uMap; uniform vec3 uSun; varying vec3 vN; varying vec3 vNV; varying vec2 vUv;
void main(){
  vec3 c = texture2D(uMap, vUv).rgb;
  float d = dot(normalize(vN), normalize(uSun));
  float day = smoothstep(-0.08, 0.18, d);
  vec3 night = c * c * vec3(0.012, 0.016, 0.03);
  vec3 lit = c * (0.08 + 1.5 * max(d, 0.0));
  float rim = pow(1.0 - clamp(normalize(vNV).z, 0.0, 1.0), 3.0);
  gl_FragColor = vec4(mix(night, lit, day) + vec3(0.06, 0.2, 0.55) * rim * (0.2 + 0.8 * day) * 0.5, 1.0);
  #include <colorspace_fragment>
}`;

let _shared = null;
/** The Earth for this engine (made once, counted). `release()` it when a landing is disposed. */
export function acquireEarth({ engine, space }) {
  if (_shared && _shared.engine === engine) { _shared.refs++; return _shared.api; }
  const mat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: { uMap: { value: null }, uSun: { value: new THREE.Vector3(1, 0, 0) } }, toneMapped: false, fog: false, depthWrite: false });
  new THREE.TextureLoader().load(new URL('../../../assets/moon/earth.jpg', import.meta.url).href, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; mat.uniforms.uMap.value = t; mat.needsUpdate = true; }, undefined, () => {});
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 24), mat); mesh.name = 'earth-in-the-sky'; mesh.frustumCulled = false; mesh.renderOrder = 6; mesh.visible = false;
  engine.scene.add(mesh);
  let nextAt = 0, dist = 3.844e8; const dir = new THREE.Vector3(1, 0, 0), tmp = {};
  const api = {
    mesh,
    /** Where Earth is now, in the active frame's axes. Cheap: the line is recomputed twice a second. Called every frame by the engine. */
    update() {
      mesh.visible = MOON_FRAMES.includes(space.frameId) && !!mat.uniforms.uMap.value;
      if (!mesh.visible) return;
      const now = performance.now();
      if (now > nextAt) {
        nextAt = now + 500;
        const T = space.timeS(), m = worldCentre('moon', T), e = worldCentre('earth', T), d = { x: e.x - m.x, y: e.y - m.y, z: e.z - m.z };
        dist = Math.hypot(d.x, d.y, d.z) || 3.844e8;
        const r = rotY(d, -engine.activeFrame.yaw, tmp); dir.set(r.x / dist, r.y / dist, r.z / dist);
      }
      mesh.position.copy(dir).multiplyScalar(D);
      mesh.scale.setScalar(D * Math.tan(Math.asin(EARTH_R / dist)));
      mat.uniforms.uSun.value.copy(space.sunLocal);
      mesh.rotation.y = (space.timeS() / 86400) * Math.PI * 2;                       // it turns once a day
    },
    release() { if (_shared && _shared.api === api && --_shared.refs <= 0) { engine.scene.remove(mesh); mat.dispose(); mesh.geometry.dispose(); _shared = null; } },
  };
  _shared = { engine, refs: 1, api };
  engine.addUpdater(() => { if (_shared && _shared.api === api) api.update(); });
  return api;
}
