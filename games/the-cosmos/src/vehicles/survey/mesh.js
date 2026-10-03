// Survey rover mesh. Nose is local −Z (headlights sit at z < 0). Wheels are separate
// groups so the view can move them with the suspension. The body is one kit merge.
// Suspension arms use their own material: the shared metals have vertex colours, and a
// mesh without colours would draw black.

import * as THREE from 'three';
import { Kit } from '../../ship/shipKit.js';
import { SURVEY } from './def.js';

export function buildSurveyRover(materials, opts = {}) {
  const low = opts.tier === 'low' || opts.tier === 'safe';
  const seg = low ? 8 : 12;
  const root = new THREE.Group();
  root.name = 'survey-rover';
  const k = new Kit();
  // Pressurised cab, chassis, rear stowage. Nose toward −Z.
  k.bevelBox('white', 0, 0.92, 0.1, 1.62, 0.46, 3.2, 0.05);
  k.bevelBox('steelDark', 0, 0.64, 0.1, 1.28, 0.12, 2.9, 0.03);
  k.bevelBox('plasticDark', 0, 1.28, -0.72, 1.38, 0.62, 1.45, 0.04);
  k.bevelBox('glassTint', 0, 1.32, -1.46, 1.22, 0.42, 0.05, 0.01);
  k.bevelBox('glassTint', -0.7, 1.3, -0.72, 0.04, 0.36, 1.05, 0.008);
  k.bevelBox('glassTint', 0.7, 1.3, -0.72, 0.04, 0.36, 1.05, 0.008);
  k.bevelBox('hullAccent', 0, 1.2, 0.95, 1.45, 0.08, 1.35, 0.02);
  k.bevelBox('fabricGrey', 0, 1.38, 1.2, 1.15, 0.32, 0.85, 0.02);
  k.box('hazard', 0, 0.78, -1.62, 0.7, 0.07, 0.03);
  k.box('glowCool', -0.46, 0.9, -1.68, 0.18, 0.1, 0.05);
  k.box('glowCool', 0.46, 0.9, -1.68, 0.18, 0.1, 0.05);
  k.box('glowAmber', -0.55, 0.88, 1.7, 0.14, 0.08, 0.04);
  k.box('glowAmber', 0.55, 0.88, 1.7, 0.14, 0.08, 0.04);
  k.cyl('steel', 0.48, 1.85, 0.55, 0.018, 0.85, 6);
  k.box('glowCool', 0.48, 2.3, 0.55, 0.08, 0.06, 0.08);
  const body = k.toGroup(materials, { name: 'survey-body', cast: true, receive: true });
  root.add(body);

  const rubber = new THREE.MeshStandardMaterial({ color: 0x1a1c1f, roughness: 0.92, metalness: 0.02 });
  const hub = new THREE.MeshStandardMaterial({ color: 0x3c4248, roughness: 0.4, metalness: 0.7 });
  const arm = new THREE.MeshStandardMaterial({ color: 0x8b939c, roughness: 0.42, metalness: 0.55 });
  const wheels = [];
  for (const w of SURVEY.wheels) {
    const g = new THREE.Group();
    g.name = 'wheel-' + w.id;
    g.position.set(w.x, SURVEY.wheelRadius, w.z);
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(SURVEY.wheelRadius, SURVEY.wheelRadius, 0.26, seg), rubber);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = !low;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.28, Math.max(6, seg - 2)), hub);
    cap.rotation.z = Math.PI / 2;
    const link = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.38, 6), arm);
    link.position.y = 0.22;
    g.add(tire, cap, link);
    root.add(g);
    wheels.push(g);
  }

  const n = low ? 16 : 36;
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const dustMat = new THREE.PointsMaterial({ color: 0xc4a574, size: low ? 0.22 : 0.16, transparent: true, opacity: 0, depthWrite: false });
  const dust = new THREE.Points(dustGeo, dustMat);
  dust.frustumCulled = false;
  root.add(dust);

  const lights = [];
  if (!low) {
    const spot = new THREE.SpotLight(0xfff1dc, 2.2, 16, 0.55, 0.45, 1.4);
    spot.position.set(0, 0.95, -1.7);
    const target = new THREE.Object3D();
    target.position.set(0, 0.3, -8);
    root.add(spot, target);
    spot.target = target;
    lights.push(spot);
  }

  root.userData.dispose = () => {
    rubber.dispose(); hub.dispose(); arm.dispose(); dustMat.dispose(); dustGeo.dispose();
    for (const g of wheels) for (const c of g.children) c.geometry?.dispose();
  };
  return { group: root, wheels, dust, lights, triangles: countTriangles(root) };
}

export function countTriangles(root) {
  let n = 0;
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const idx = o.geometry.index;
    n += idx ? idx.count / 3 : o.geometry.getAttribute('position').count / 3;
  });
  return n;
}
