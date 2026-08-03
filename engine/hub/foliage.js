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

// The baked card keeps its leaves inside a border margin, so the visible cluster
// is about 0.9 of the quad. Scale up to compensate or the canopy reads small.
const CLUSTER_FILL = 1.15;

let sharedLeafMaterial = null;

/**
 * One shared alpha-tested leaf material for every canopy in the world — town
 * trees and player-placed trees alike — so they batch identically and only one
 * texture is ever uploaded.
 */
export function leafMaterial(THREE_NS, renderer) {
  if (sharedLeafMaterial) return sharedLeafMaterial;
  const map = new THREE_NS.TextureLoader().load("/engine/hub/assets/textures/canopy_leaf.webp");
  map.colorSpace = THREE_NS.SRGBColorSpace;
  map.anisotropy = renderer ? Math.min(4, renderer.capabilities.getMaxAnisotropy()) : 4;
  sharedLeafMaterial = new THREE_NS.MeshStandardMaterial({
    map,
    // alphaTest, NOT transparent: cards must write depth so they sort against
    // each other and cast cut-out shadows rather than solid squares.
    alphaTest: 0.5,
    transparent: false,
    side: THREE_NS.DoubleSide,
    roughness: 0.88,
    metalness: 0,
  });
  return sharedLeafMaterial;
}

/**
 * Merged leaf-card geometry for a single crown, in the caller's local space.
 * Used both by the static town canopy and by each placed tree prop.
 */
export function canopyGeometry({ cx = 0, cy = 0, cz = 0, rx, ry, rz, cards = CARDS_PER_TREE, size, seed = 1 }) {
  const rng = makeRng(seed);
  const geos = [];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const zAxis = new THREE.Vector3(0, 0, 1);

  for (let i = 0; i < cards; i++) {
    const u = (i + rng() * 0.85) / cards;
    const phi = Math.acos(1 - 2 * u);
    const theta = i * 2.399963 + rng() * 0.6;   // golden angle + jitter
    const sx = Math.sin(phi) * Math.cos(theta);
    const sy = Math.cos(phi) * 0.85 + 0.12;     // bias up: canopies are domed
    const sz = Math.sin(phi) * Math.sin(theta);

    normal.set(sx, sy * 0.7, sz).normalize();
    q.setFromUnitVectors(zAxis, normal);
    q.premultiply(new THREE.Quaternion().setFromAxisAngle(normal, rng() * Math.PI * 2));

    const s = size * CLUSTER_FILL * (0.82 + rng() * 0.42);
    scale.set(s, s, s);
    m.compose(new THREE.Vector3(cx + sx * rx, cy + sy * ry, cz + sz * rz), q, scale);

    const g = new THREE.PlaneGeometry(1, 1);
    g.applyMatrix4(m);
    geos.push(g);
  }
  const merged = mergeGeometries(geos, false);
  for (const g of geos) g.dispose();
  return merged;
}

/**
 * Build one merged mesh of leaf cards covering every tree crown.
 * @param {THREE.Material} material alpha-tested leaf material
 * @returns {{mesh: THREE.Mesh, stats: object}}
 */
export function buildCanopy(material, cardsPerTree = CARDS_PER_TREE) {
  const parts = [];
  for (let t = 0; t < TREE_SPOTS.length; t++) {
    const [x, z] = TREE_SPOTS[t];
    const height = 4.6 + (t % 5) * 0.26;
    const trunkH = height * 0.42;
    // Crown centre and envelope, matching mature_tree()'s ico() placement.
    parts.push(canopyGeometry({
      cx: x, cy: trunkH + height * 0.20, cz: z,
      rx: height * 0.30, ry: height * 0.21, rz: height * 0.30,
      cards: cardsPerTree, size: height * 0.30, seed: 20260803 + t * 7919,
    }));
  }
  const merged = mergeGeometries(parts, false);
  for (const g of parts) g.dispose();
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
      cardsPerTree,
      cards: TREE_SPOTS.length * cardsPerTree,
      triangles: merged.index ? merged.index.count / 3 : merged.attributes.position.count / 3,
      drawCalls: 1,
    },
  };
}
