// ============================================================================
// laneGate.js — the Ore Lane's mouth, as a thing you can see: a ring of beacons 840 m across, where the main drive stops and the jump
// coils spool (jump.js). The ship comes to rest at its centre. The ring is the Compact's marker, not the mechanism: the drive does the
// jumping. While the coils spool the ring spins up and brightens; at the end of the spool the screen goes white (spaceSystem.js).
//
// OWNS: the ring's meshes and how they glow with the charge. DOES NOT OWN: when it charges (the trip's spool phase).
// One torus, two thin rings, 24 beacon posts and a faint membrane: about 3,000 triangles, drawn only when something of it is on screen.
// ============================================================================

import * as THREE from 'three';
import { JUMP } from './jump.js';

/**
 * @param o { engine, frame, point: {x,y,z} in the frame, toward: unit vector the ring faces (toward the home planet), low }
 * @returns { update(dt, charge 0..1, timeSec), group, entry }
 */
export function buildLaneGate(o) {
  const R = JUMP.gateRadiusM, group = new THREE.Group(), low = !!o.low;
  group.name = 'lane-gate:' + o.frame.id;
  const hue = o.frame.id === 'mars' ? [0.35, 0.85, 1.0] : [1.0, 0.68, 0.28];
  const mk = (c, op = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(...c), transparent: op < 1, opacity: op, toneMapped: false, fog: false, side: THREE.DoubleSide, depthWrite: op >= 1 });
  const frameMat = mk([0.12, 0.13, 0.15]);
  const torus = new THREE.Mesh(new THREE.TorusGeometry(R, 11, low ? 8 : 12, low ? 64 : 96), frameMat);
  const beaconMat = mk(hue);
  const rings = [];
  for (const [rr, w] of [[R * 0.9, 3.5], [R * 0.78, 2.5]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(rr, w, 6, low ? 64 : 96), beaconMat.clone());
    ring.userData.base = rr; rings.push(ring); group.add(ring);
  }
  // 24 posts round the ring, each with a lamp: they read as a gate from a few kilometres, as a ring of lights from far off
  const posts = new THREE.Group();
  const postGeo = new THREE.BoxGeometry(20, 60, 20), lampGeo = new THREE.SphereGeometry(16, 8, 6);
  const lamps = [];
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    const post = new THREE.Mesh(postGeo, frameMat); post.position.set(c * (R + 30), s * (R + 30), 0); post.rotation.z = a; posts.add(post);
    const lamp = new THREE.Mesh(lampGeo, beaconMat.clone()); lamp.position.set(c * (R + 52), s * (R + 52), 0); posts.add(lamp); lamps.push(lamp);
  }
  // the membrane: a faint disc that fills as the coils charge
  const mem = new THREE.Mesh(new THREE.CircleGeometry(R * 0.76, low ? 40 : 64), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, blending: THREE.AdditiveBlending,
    uniforms: { uCol: { value: new THREE.Vector3(...hue) }, uK: { value: 0 }, uT: { value: 0 } },
    vertexShader: 'varying vec2 vP; void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `precision highp float; varying vec2 vP; uniform vec3 uCol; uniform float uK, uT;
      void main() { float r = length(vP) / ${(R * 0.76).toFixed(1)}; float a = atan(vP.y, vP.x);
        float sw = 0.5 + 0.5 * sin(a * 5.0 + r * 18.0 - uT * (2.0 + 9.0 * uK)); float edge = smoothstep(1.0, 0.7, r);
        gl_FragColor = vec4(uCol * (0.15 + 0.85 * sw) * edge * uK * 0.85, 1.0); }`,
  }));
  group.add(torus, posts, mem);
  const n = new THREE.Vector3(o.toward.x, o.toward.y, o.toward.z).normalize();
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
  o.engine.scene.add(group);
  const entry = o.engine.track({ worldPos: { x: o.point.x, y: o.point.y, z: o.point.z }, object3d: group, quaternion: quat, frame: o.frame });
  const col = new THREE.Color();
  return {
    group, entry,
    update(dt, charge, t) {
      // dim when idle, bright when charging; the lamps chase round the ring
      const idle = 0.34 + 0.12 * Math.sin(t * 1.3), k = idle + (1 - idle) * charge;
      mem.material.uniforms.uK.value = charge; mem.material.uniforms.uT.value = t;
      for (const r of rings) { r.material.color.setRGB(hue[0] * k, hue[1] * k, hue[2] * k); r.rotation.z += dt * (0.1 + 3.2 * charge); }
      for (let i = 0; i < lamps.length; i++) { const on = charge > 0 ? 0.35 + 0.65 * Math.max(0, Math.sin(t * (3 + 14 * charge) - i * 0.6)) : 0.55 + 0.45 * Math.max(0, Math.sin(t * 0.9 - i * 0.55)); lamps[i].material.color.setRGB(hue[0] * on, hue[1] * on, hue[2] * on); }
    },
  };
}
