// ============================================================================
// missions/props.js - what the jobs leave standing in the world, for everyone to see (BIBLE-v3 17: a mechanic is witnessed in the place). Today: Homeguard's first
// footing on Earth. The survey stakes stand at the place the job names from the start; each cartload a pilot carries there (the `build` of a job, kept by the
// authority in homes.<world>.built) lays more of the footing, then a low course of shell rock on it. A shared world only; drawn into the settlement's own group.
// ============================================================================
import * as THREE from 'three';

export const FOOTING = { world: 'earth', key: 'footing', x: 30, z: -52 };
const LOAD_KG = 300;

function build(root) {
  const g = new THREE.Group(); g.name = 'homeguard-footing'; g.position.set(FOOTING.x, 0.02, FOOTING.z);
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 0.9 }), tape = new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.6 }), grey = new THREE.MeshStandardMaterial({ color: 0x9a9a94, roughness: 0.95 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x6f6b62, roughness: 1 });
  // the survey stakes and the string line round the footprint (10 m by 4 m)
  const corners = [[-5, -2], [5, -2], [5, 2], [-5, 2]];
  for (const [x, z] of corners) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.9, 0.06), wood); s.position.set(x, 0.45, z); g.add(s); const f = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.02), tape); f.position.set(x + 0.14, 0.85, z); g.add(f); }
  for (let i = 0; i < 4; i++) { const [x0, z0] = corners[i], [x1, z1] = corners[(i + 1) % 4], L = Math.hypot(x1 - x0, z1 - z0); const line = new THREE.Mesh(new THREE.BoxGeometry(L, 0.012, 0.012), tape); line.position.set((x0 + x1) / 2, 0.6, (z0 + z1) / 2); line.rotation.y = -Math.atan2(z1 - z0, x1 - x0); g.add(line); }
  // the footing: grows a metre of length per cartload, up to eight
  const strip = new THREE.Mesh(new THREE.BoxGeometry(1, 0.35, 1.2), grey); strip.position.y = 0.17; strip.castShadow = strip.receiveShadow = true; strip.visible = false; g.add(strip);
  // the course of shell rock on the footing: rough blocks, from the third cartload
  const course = new THREE.Group(); course.visible = false;
  for (let i = 0; i < 16; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.46 + (i * 37 % 7) * 0.02, 0.28, 0.5), i % 2 ? dark : grey); b.position.set(-3.75 + i * 0.5, 0.49, ((i * 53) % 5 - 2) * 0.02); b.rotation.y = ((i * 29) % 9 - 4) * 0.015; b.castShadow = b.receiveShadow = true; course.add(b); }
  g.add(course);
  // the heap still waiting beside it (the last load tipped, not yet laid)
  const heap = new THREE.Mesh(new THREE.ConeGeometry(0.9, 0.7, 7), dark); heap.position.set(6.2, 0.35, 0.6); heap.scale.set(1.2, 1, 1); heap.visible = false; g.add(heap);
  g.userData = { strip, course, heap, loads: -1 };
  root.add(g); return g;
}

/** Make the world's props match the shared record. Cheap and idempotent: call it about once a second. */
export function syncProps(space, snapshot) {
  const w = space && space.worlds && space.worlds.get('earth'), root = w && w.client && w.client.complex && w.client.complex.root;
  if (!root) return;
  let g = root.userData.__footing; if (!g) { g = build(root); root.userData.__footing = g; }
  const built = snapshot && snapshot.homes && snapshot.homes.earth && snapshot.homes.earth.built, loads = Math.round(((built && built.footing) || 0) / LOAD_KG);
  const u = g.userData; if (u.loads === loads) return; u.loads = loads;
  const len = Math.min(8, loads);
  u.strip.visible = len > 0; u.strip.scale.x = Math.max(1, len); u.strip.position.x = -4.5 + len / 2;
  u.course.visible = loads >= 3; u.heap.visible = loads > 0 && loads < 8;
  for (let i = 0; i < u.course.children.length; i++) u.course.children[i].visible = i < Math.min(16, (loads - 2) * 3 + 1);
}
