// ============================================================================
// missions/boardProp.js - the notice board beside each hiring desk: two steel posts, a weathered frame, a painted heading ("JOBS - HANDS FOR HIRE"), pinned notices
// of different sizes and paper colours, and a small lamp so it can be read at night. One mesh group; drawn once, in the settlement's own frame (outpost metres, y up,
// z south), standing on the ground at (x, z) and facing `face` ('south' | 'north' | 'east' | 'west'). A prop, not a menu: the jobs themselves are in the dispatcher's
// mouth (the Talk panel) and the steps are arriving, carrying, landing, hiring.
// ============================================================================
import * as THREE from 'three';

const FACE = { south: 0, east: Math.PI / 2, north: Math.PI, west: -Math.PI / 2 };

/** A deterministic scatter so every board looks hand-pinned but the same for everyone. */
function rng(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }

function paint(title, sub, seed) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
  const g = c.getContext('2d'), r = rng(seed);
  g.fillStyle = '#2b2f33'; g.fillRect(0, 0, 1024, 512);
  g.fillStyle = '#3a3f44'; g.fillRect(14, 14, 996, 484);
  g.fillStyle = '#e8b53a'; g.fillRect(14, 14, 996, 96);
  g.fillStyle = '#1b1b1b'; g.font = 'bold 62px sans-serif'; g.textAlign = 'center'; g.fillText(title, 512, 82);
  g.fillStyle = '#c9ccd0'; g.font = '30px sans-serif'; g.fillText(sub, 512, 150);
  const paper = ['#f1ead6', '#e3d9b6', '#d8e4ea', '#f0d9c4', '#e7e7e7'];
  for (let i = 0; i < 16; i++) {
    const w = 120 + r() * 110, h = 96 + r() * 120, x = 36 + r() * (952 - w), y = 172 + r() * (470 - h - 172);
    g.save(); g.translate(x + w / 2, y + h / 2); g.rotate((r() - 0.5) * 0.12);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(-w / 2 + 4, -h / 2 + 5, w, h);
    g.fillStyle = paper[Math.floor(r() * paper.length)]; g.fillRect(-w / 2, -h / 2, w, h);
    g.fillStyle = '#3a3a3a';
    for (let k = 0; k < 5; k++) g.fillRect(-w / 2 + 10, -h / 2 + 14 + k * (h - 28) / 5, (w - 20) * (0.5 + 0.5 * r()), 5);
    g.fillStyle = '#b4332a'; g.beginPath(); g.arc(0, -h / 2 + 6, 5, 0, 7); g.fill();
    g.restore();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

/** @param o { x, z, face, title, sub, seed } -> THREE.Group */
export function buildBoard(o) {
  const grp = new THREE.Group(); grp.name = 'job-board';
  const steel = new THREE.MeshStandardMaterial({ color: 0x4b5157, roughness: 0.7, metalness: 0.5 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x6d5a45, roughness: 0.9 });
  const W = 3.0, H = 1.5;
  for (const sx of [-1, 1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 3.2, 0.14), steel); post.position.set(sx * (W / 2 + 0.05), 1.2, 0); grp.add(post); }
  const frame = new THREE.Mesh(new THREE.BoxGeometry(W + 0.2, H + 0.2, 0.1), wood); frame.position.set(0, 2.0, 0); grp.add(frame);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ map: paint(o.title || 'JOBS', o.sub || 'HANDS FOR HIRE · ASK THE DISPATCHER', o.seed || 7), roughness: 0.85 }));
  face.position.set(0, 2.0, 0.056); grp.add(face);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(W + 0.5, 0.08, 0.5), steel); roof.position.set(0, 2.88, 0.2); grp.add(roof);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd7a0, toneMapped: false })); lamp.position.set(0, 2.78, 0.38); grp.add(lamp);
  grp.position.set(o.x, 0.02, o.z); grp.rotation.y = FACE[o.face] ?? 0;
  grp.userData.spot = { x: o.x, z: o.z };
  return grp;
}
