// Turkey Trouble: stand-in models with the FINAL node names (see CONTRACT.md), used until the real models exist.
import * as THREE from 'three';

const mat = (color, more = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...more });
const mesh = (geo, material, name) => { const m = new THREE.Mesh(geo, material); if (name) m.name = name; return m; };
export function node(name, x = 0, y = 0, z = 0) { const o = new THREE.Group(); o.name = name; o.position.set(x, y, z); return o; }

// ---------------------------------------------------------------- placeholder models (node names are the contract)
function placeholderTurkey() {
  const dark = mat(0x3a2a20), tailM = mat(0x5a3a22), red = mat(0xb02a20), tan = mat(0xc9a86a), legM = mat(0x8a6a4a);
  const root = node('turkey');
  const body = node('body', 0, 0.46, 0); root.add(body);
  const b = mesh(new THREE.SphereGeometry(0.27, 14, 10), dark, 'body_mesh'); b.scale.set(1, 0.95, 1.35); body.add(b);
  const neck1 = node('neck1', 0, 0.16, 0.28); body.add(neck1);
  neck1.add(mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.2, 8).translate(0, 0.1, 0), red));
  const neck2 = node('neck2', 0, 0.2, 0.01); neck1.add(neck2);
  neck2.add(mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.18, 8).translate(0, 0.09, 0), red));
  const head = node('head', 0, 0.18, 0.01); neck2.add(head);
  head.add(mesh(new THREE.SphereGeometry(0.075, 10, 8).translate(0, 0.04, 0.02), red, 'head_mesh'));
  const beak = node('beak', 0, 0.035, 0.085); head.add(beak);
  beak.add(mesh(new THREE.ConeGeometry(0.028, 0.09, 6).rotateX(Math.PI / 2).translate(0, 0, 0.04), tan));
  const snood = node('snood', 0, 0.06, 0.09); head.add(snood);
  snood.add(mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.1, 6).translate(0, -0.05, 0), red));
  const wattle = node('wattle', 0, -0.02, 0.06); head.add(wattle);
  wattle.add(mesh(new THREE.SphereGeometry(0.04, 8, 6).translate(0, -0.03, 0), red));
  const tail = node('tail', 0, 0.1, -0.3); body.add(tail);
  for (let i = 0; i < 13; i++) {
    const f = node('tf' + i); f.rotation.z = (i - 6) * 0.2; tail.add(f);
    f.add(mesh(new THREE.PlaneGeometry(0.11, 0.5).translate(0, 0.25, 0), new THREE.MeshStandardMaterial({ color: i % 2 ? 0x5a3a22 : 0x6e4a2a, roughness: 0.8, side: THREE.DoubleSide })));
  }
  tail.rotation.x = -0.5;
  for (const s of [-1, 1]) {
    const wing = node(s < 0 ? 'wingL' : 'wingR', s * 0.24, 0.06, 0.05); body.add(wing);
    const w = mesh(new THREE.SphereGeometry(0.2, 10, 8), tailM); w.scale.set(0.28, 0.7, 1.15); w.position.set(s * 0.03, -0.06, -0.06); wing.add(w);
    const thigh = node(s < 0 ? 'thighL' : 'thighR', s * 0.11, -0.16, -0.02); body.add(thigh);
    thigh.add(mesh(new THREE.CylinderGeometry(0.05, 0.035, 0.16, 6).translate(0, -0.08, 0), dark));
    const shin = node(s < 0 ? 'shinL' : 'shinR', 0, -0.16, 0); thigh.add(shin);
    shin.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.14, 6).translate(0, -0.07, 0), legM));
    const foot = node(s < 0 ? 'footL' : 'footR', 0, -0.14, 0); shin.add(foot);
    foot.add(mesh(new THREE.BoxGeometry(0.07, 0.015, 0.13).translate(0, 0, 0.04), legM));
  }
  root.userData.size = { w: 0.6, h: 1.0, l: 0.9 };
  return root;
}
function placeholderVehicle(name, l, w, h, color) {
  const root = node(name);
  const body = node('body'); root.add(body);
  body.add(mesh(new THREE.BoxGeometry(w, h * 0.55, l).translate(0, h * 0.45, 0), mat(color, { roughness: 0.4, metalness: 0.4 })));
  body.add(mesh(new THREE.BoxGeometry(w * 0.9, h * 0.4, l * 0.35).translate(0, h * 0.85, l * 0.08), mat(0x20262c, { roughness: 0.2 })));
  const r = Math.min(0.45, h * 0.24);
  for (const [n, sx, sz] of [['wheel_fl', -1, 1], ['wheel_fr', 1, 1], ['wheel_rl', -1, -1], ['wheel_rr', 1, -1]]) {
    const wh = node(n, sx * w * 0.5, r, sz * l * 0.32); root.add(wh);
    wh.add(mesh(new THREE.CylinderGeometry(r, r, 0.26, 14).rotateZ(Math.PI / 2), mat(0x0c0c0c)));
  }
  for (const [n, sx] of [['headlight_l', -1], ['headlight_r', 1]]) {
    const hl = node(n, sx * w * 0.32, h * 0.5, l * 0.5); root.add(hl);
    hl.add(mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshStandardMaterial({ color: 0xfff2d0, emissive: 0xfff2d0, emissiveIntensity: 4 })));
  }
  for (const [n, sx] of [['taillight_l', -1], ['taillight_r', 1]]) {
    const tl = node(n, sx * w * 0.36, h * 0.5, -l * 0.5); root.add(tl);
    tl.add(mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshStandardMaterial({ color: 0xff2010, emissive: 0xff2010, emissiveIntensity: 3 })));
  }
  root.userData.size = { w, h, l };
  return root;
}
function placeholderDog() {
  const root = node('dog'), fur = mat(0x7a5a3a);
  const body = node('body', 0, 0.42, 0); root.add(body);
  body.add(mesh(new THREE.CapsuleGeometry(0.16, 0.5, 4, 8).rotateX(Math.PI / 2), fur));
  const head = node('head', 0, 0.12, 0.42); body.add(head);
  head.add(mesh(new THREE.BoxGeometry(0.18, 0.18, 0.28).translate(0, 0.02, 0.08), fur));
  const tail = node('tail', 0, 0.08, -0.4); body.add(tail);
  tail.add(mesh(new THREE.CylinderGeometry(0.02, 0.035, 0.3, 6).translate(0, 0.15, 0).rotateX(-0.9), fur));
  for (const [n, sx, sz] of [['legFL', -1, 1], ['legFR', 1, 1], ['legRL', -1, -1], ['legRR', 1, -1]]) {
    const leg = node(n, sx * 0.11, -0.08, sz * 0.24); body.add(leg);
    leg.add(mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.34, 6).translate(0, -0.17, 0), fur));
  }
  root.userData.size = { w: 0.4, h: 0.7, l: 1.0 };
  return root;
}
export const PLACEHOLDERS = {
  turkey: placeholderTurkey,
  pickup: () => placeholderVehicle('pickup', 5.6, 2.0, 1.9, 0x7a1f1a),
  tractor_wagon: () => { const r = node('tractor_wagon'); const t = placeholderVehicle('tractor', 4.0, 2.2, 2.7, 0x2e6b2e); t.position.z = 2.8; const w = placeholderVehicle('wagon', 5.0, 2.3, 1.9, 0xb89a4a); w.position.z = -2.2; r.add(t, w); r.userData.size = { w: 2.4, h: 2.7, l: 9.6 }; return r; },
  grain_truck: () => placeholderVehicle('grain_truck', 9.2, 2.5, 3.2, 0x345a7a),
  dog: placeholderDog,
  log: () => { const r = node('log'); r.add(mesh(new THREE.CylinderGeometry(0.42, 0.46, 4, 12).rotateX(Math.PI / 2).translate(0, 0.1, 0), mat(0x4a3424))); r.userData.size = { w: 0.9, h: 0.5, l: 4 }; return r; },
  pumpkin: () => { const r = node('pumpkin'); const p = mesh(new THREE.SphereGeometry(0.22, 12, 8), mat(0xd9731a, { roughness: 0.6 })); p.scale.y = 0.8; p.position.y = 0.17; r.add(p); r.userData.size = { w: 0.44, h: 0.36, l: 0.44 }; return r; },
  net: () => { const r = node('net'); r.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.6, 6).translate(0, 0.8, 0), mat(0x6a4a2a))); const hoop = mesh(new THREE.TorusGeometry(0.34, 0.02, 6, 20), mat(0x999999, { metalness: 0.6, roughness: 0.4 })); hoop.position.y = 1.9; r.add(hoop); r.userData.size = { w: 0.7, h: 2.2, l: 0.1 }; return r; },
  feather: () => { const r = node('feather'); r.add(mesh(new THREE.PlaneGeometry(0.05, 0.22), new THREE.MeshStandardMaterial({ color: 0x6e4a2a, side: THREE.DoubleSide }))); return r; },
};

