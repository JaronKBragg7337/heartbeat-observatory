// ============================================================================
// desktopLighting.js - desktop-only HDR lighting setup.
// ============================================================================

import * as THREE from 'three';

export function installDesktopLighting(engine) {
  engine.scene.background = new THREE.Color(0x020309);
  engine.scene.fog = new THREE.FogExp2(0x020309, 0.0000012);

  const sun = new THREE.DirectionalLight(0xfff4df, 7.5);
  sun.name = 'desktop-key-sun';
  sun.position.set(14000, 9000, 5200);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.camera.near = 100;
  sun.shadow.camera.far = 80000;
  sun.shadow.camera.left = -12000;
  sun.shadow.camera.right = 12000;
  sun.shadow.camera.top = 12000;
  sun.shadow.camera.bottom = -12000;

  const sky = new THREE.HemisphereLight(0x7fa7ff, 0x090603, 1.35);
  sky.name = 'desktop-hemisphere-fill';

  const rim = new THREE.DirectionalLight(0x6aa2ff, 1.4);
  rim.name = 'desktop-blue-rim';
  rim.position.set(-6000, 4200, -9500);

  engine.scene.add(sun, sky, rim);
  return { sun, sky, rim };
}
