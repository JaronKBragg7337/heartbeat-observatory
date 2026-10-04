// ============================================================================
// farWorlds.js - the rest of the Solar System, in view (F3, client only). One space, no loading screen: a ship flying from Mars to Ceres (or Earth, the
// Moon, Callisto) sees the destination from the first moment, a point of light that grows, and the planets she passes.
//
// WHAT IT DRAWS
//   * a MARKER for every world (a point of light a few pixels across, fixed in pixels, placed at the world's true centre in the root frame): the planets are
//     sub-pixel for most of a trip (Earth from 1 AU is 0.003 degrees), so without a marker they would be invisible until a few hours out;
//     a marker fades out as the world's true disc grows past a few pixels, and the true disc takes over;
//   * a SPHERE for every world that has no ground of its own yet (Earth, the Moon, Callisto, the other placeholders), lit by the Sun like everything else, so
//     "Holding off Earth" is a planet in the window. A built world (Ceres, Phobos) draws its own shell (moonWorld.js).
// The camera's far plane is 1e13 m (engine.js) so none of this is clipped; the floating origin keeps the numbers small.
// ============================================================================
import * as THREE from 'three';
import { allWorlds } from '../worlds/registry.js';
import { worldKin } from './frames.js';

/** Mean radii (m) and colours of the placeholder worlds, from the NASA planetary fact sheets (the registry's placeholders carry none for most). Colours are albedo-ish. */
const BODY = {
  mercury: { r: 2_439_700, c: 0x8c8782 }, venus: { r: 6_051_800, c: 0xe8d2a0 }, earth: { r: 6_371_000, c: 0x4a78b8 }, moon: { r: 1_737_400, c: 0xa8a49e },
  jupiter: { r: 69_911_000, c: 0xc9a67d }, saturn: { r: 58_232_000, c: 0xdcc9a0 }, uranus: { r: 25_362_000, c: 0x9fd4d8 }, neptune: { r: 24_622_000, c: 0x4a68d0 },
  callisto: { r: 2_410_300, c: 0x6a625a }, mars: { r: 3_389_500, c: 0xb5694a },
};

export class FarWorlds {
  constructor({ engine, space }) {
    this.engine = engine; this.space = space; this.built = false; this.items = [];
  }

  /** Build once, the first time a long trip is plotted or a ship is out in deep space. */
  ensure() {
    if (this.built) return;
    this.built = true;
    const e = this.engine;
    const dot = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    for (const d of allWorlds()) {
      if (d.root || d.kind === 'star' || d.kind === 'station' || (!d.orbit && d.id !== 'mars')) continue;
      const spec = BODY[d.id] || (d.radiusMean ? { r: d.radiusMean, c: 0xb0b0b0 } : null);
      if (!spec) continue;
      const it = { id: d.id, r: spec.r, color: new THREE.Color(spec.c), world: d, mesh: null, marker: null, built: !d.placeholder && d.id !== 'mars' };
      // a marker: a sprite that stays a few pixels across at any distance
      const mat = new THREE.SpriteMaterial({ map: dot, color: spec.c, transparent: true, depthWrite: false, depthTest: true, sizeAttenuation: false, fog: false, toneMapped: false, opacity: 0.9 });
      const sp = new THREE.Sprite(mat); sp.scale.set(0.012, 0.012, 1); sp.renderOrder = 5; sp.frustumCulled = false; sp.visible = false; sp.name = `far-marker:${d.id}`;
      e.scene.add(sp); it.marker = sp;
      it.markerEntry = e.track({ worldPos: { x: 0, y: 0, z: 0 }, object3d: sp });
      if (d.placeholder) {                       // a world with no ground yet: a plain lit ball
        const m = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), new THREE.MeshStandardMaterial({ color: spec.c, roughness: 0.95, metalness: 0, fog: false }));
        m.scale.setScalar(spec.r); m.frustumCulled = false; m.visible = false; m.name = `far-world:${d.id}`;
        e.scene.add(m); it.mesh = m; it.meshEntry = e.track({ worldPos: { x: 0, y: 0, z: 0 }, object3d: m });
      }
      this.items.push(it);
    }
  }

  /** Every frame: put each world where the clock says (Mars's turning axes, the root frame), hide what is not wanted. `show` = the ship is in or heading for deep space. */
  update(T, show, camAngleScale = 1) {
    if (!this.built) return;
    const e = this.engine, cam = e.cameraWorldPos, A = e.activeFrame.origin;
    for (const it of this.items) {
      const k = worldKin(it.id, T), c = k.c;
      // distance from the camera, in the root frame's axes (the active frame's origin is in the root frame too)
      const dx = c.x - A.x - cam.x, dy = c.y - A.y - cam.y, dz = c.z - A.z - cam.z, dist = Math.hypot(dx, dy, dz) || 1;
      const ang = it.r / dist;                                     // the true disc's angular radius, radians
      const here = e.activeFrame.id === it.id;                      // standing on it (or in its frame): its own shell is all there is
      const wantMarker = show && !here && ang < 0.0035;
      it.marker.visible = wantMarker;
      if (wantMarker) {
        it.markerEntry.worldPos.x = c.x; it.markerEntry.worldPos.y = c.y; it.markerEntry.worldPos.z = c.z;
        it.marker.material.opacity = Math.min(0.95, 0.25 + 0.7 * (1 - ang / 0.0035));
      }
      if (it.mesh) {
        const wantBall = show && !here && ang > 0.0006;
        it.mesh.visible = wantBall;
        if (wantBall) { it.meshEntry.worldPos.x = c.x; it.meshEntry.worldPos.y = c.y; it.meshEntry.worldPos.z = c.z; it.mesh.rotation.y = -k.yawI; }
      }
    }
    void camAngleScale;
  }
}
