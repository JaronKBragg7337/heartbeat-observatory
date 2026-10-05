// aimMarker.js - the ring that shows where a dig or a drop will land. Shared by the ordinary game (main.js) and the opening's crate dig.
import * as THREE from 'three';

export function buildAimMarker(hex) {
  const g = new THREE.Group();
  const glow = (geo, opacity) => new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color: hex, transparent: true, opacity, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  }));
  const rim = glow(new THREE.RingGeometry(0.88, 1.0, 56), 0.95);
  const fill = glow(new THREE.CircleGeometry(1.0, 56), 0.13);
  const stem = glow(new THREE.CylinderGeometry(0.045, 0.045, 1, 10, 1, true), 0.5);
  stem.rotation.x = Math.PI / 2;          // cylinder is +Y; the stem runs along -Z
  g.add(rim, fill, stem);
  g.renderOrder = 10;
  g.frustumCulled = false;
  for (const m of g.children) m.frustumCulled = false;
  return { group: g, rim, fill, stem };
}
