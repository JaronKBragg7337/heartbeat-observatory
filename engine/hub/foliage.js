// Foliage — alpha-cutout canopy cards.
//
// The trees were five smooth icosphere crowns each. A texture cannot fix that:
// the fault is the SILHOUETTE. A sphere reads as a green ball from every angle
// and no amount of surface detail changes the outline, which is the first thing
// the eye uses to identify a tree.
//
// So the spheres stay (they carry volume and cast the canopy's shadow mass) and
// get darkened to read as interior shade, while alpha-tested leaf cards are
// scattered over the crown envelope to break the outline. Doctrine's vegetation
// law — never ship foliage without a cutout map — is the point of this file.
//
// Cards use alphaTest rather than transparency so they write depth, sort
// correctly against each other, and cast cut-out shadows instead of squares.
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.module.js";
import { mergeGeometries } from "https://cdn.jsdelivr.net/npm/three@0.182.0/examples/jsm/utils/BufferGeometryUtils.js";

// Mirrors tree_spots in tools/blender/generate_heartbeat_town_realism.py.
// Heights follow the same 4.6 + (idx % 5) * 0.26 rule the generator used, so the
// cards land on the crowns actually present in the GLB.
export const TREE_SPOTS = [
  [-12, 5], [12, 5], [-12, -5], [12, -5], [-20, -16], [20, -16],
  [-20, 16], [20, 16], [-29, -6], [29, -6], [-29, 6], [29, 6],
  [-5, 14], [5, 14], [-7, 25], [-26, 22], [26, 22], [-26, -22],
  [26, -22], [-16.2, -29.6], [-0.2, -29.6], [16.2, -29.6],
  [-25.5, -24], [25.5, -24],
];

const CARDS_PER_TREE = 16;

/** Seeded LCG — the canopy must be identical on every client and every reload. */
function makeRng(seed) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

/**
 * Build one merged mesh of leaf cards covering every tree crown.
 * @param {THREE.Material} material alpha-tested leaf material
 * @returns {{mesh: THREE.Mesh, stats: object}}
 */
export function buildCanopy(material) {
  const rng = makeRng(20260803);
  const geos = [];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const normal = new THREE.Vector3();
  const scale = new THREE.Vector3();

  for (let t = 0; t < TREE_SPOTS.length; t++) {
    const [x, z] = TREE_SPOTS[t];
    const height = 4.6 + (t % 5) * 0.26;
    const trunkH = height * 0.42;
    // Crown centre and envelope, matching mature_tree()'s ico() placement.
    const cy = trunkH + height * 0.20;
    const rx = height * 0.30;
    const ry = height * 0.21;
    const rz = height * 0.30;
    const cardSize = height * 0.30;

    for (let i = 0; i < CARDS_PER_TREE; i++) {
      // Even-ish distribution over the ellipsoid, jittered so it never reads
      // as a lattice.
      const u = (i + rng() * 0.85) / CARDS_PER_TREE;
      const phi = Math.acos(1 - 2 * u);
      const theta = i * 2.399963 + rng() * 0.6;   // golden angle + jitter
      const sx = Math.sin(phi) * Math.cos(theta);
      const sy = Math.cos(phi) * 0.85 + 0.12;     // bias up: canopies are domed
      const sz = Math.sin(phi) * Math.sin(theta);

      const px = x + sx * rx;
      const py = cy + sy * ry;
      const pz = z + sz * rz;

      // Face outward from the crown centre, with a random roll so identical
      // cards never line up.
      normal.set(sx, sy * 0.7, sz).normalize();
      q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
      const roll = new THREE.Quaternion().setFromAxisAngle(normal, rng() * Math.PI * 2);
      q.premultiply(roll);

      const s = cardSize * (0.82 + rng() * 0.42);
      scale.set(s, s, s);
      m.compose(new THREE.Vector3(px, py, pz), q, scale);

      const g = new THREE.PlaneGeometry(1, 1);
      g.applyMatrix4(m);
      geos.push(g);
    }
  }

  const merged = mergeGeometries(geos, false);
  for (const g of geos) g.dispose();
  const mesh = new THREE.Mesh(merged, material);
  mesh.name = "CanopyCards";
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  // Cards sit outside the crown spheres; without this the town's fog/frustum
  // culling can pop them as the camera turns.
  mesh.frustumCulled = true;

  return {
    mesh,
    stats: {
      trees: TREE_SPOTS.length,
      cards: geos.length,
      triangles: merged.index ? merged.index.count / 3 : merged.attributes.position.count / 3,
      drawCalls: 1,
    },
  };
}
