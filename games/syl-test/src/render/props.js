// ============================================================================
// props.js — procedural prop + structure builders. The end of the box era.
//
// OWNS: reusable mesh builders (rocks, trees, spires, crystals, huts, gabled
//       buildings, towers, tanks, masts, dishes, pads, containers) and the
//       GROUNDING helpers that keep everything sitting flush on curved,
//       sloped terrain (no floating corners, no buried doors).
// DOES NOT OWN: where props go (worldDetails.js / planet.js decide layout),
//       collision (planet.js resolves; worldDetails.js emits collider specs),
//       terrain truth (terrainRadiusAt in planet.js is the ONLY height source).
//
// TECHNIQUE (World of ClaudeCraft): no model files. Displaced low-poly
// primitives + flatShading for rocks/trees; composite primitives + painted
// canvas textures (render/textures.js) for structures. Materials are deduped
// through surfaceMat() so hundreds of props share a handful of GPU programs.
//
// EXTENDING (future agents): add a make*() builder here, give it a header
// comment, keep it deterministic (callers pass a seeded rng), keep triangle
// counts phone-first (rocks ~80 tris, trees ~150, buildings ~200).
// ============================================================================

import * as THREE from 'three';
import {
  buildingWallTexture, metalPlateTexture, padTexture, fabricTexture, solarTexture,
} from './textures.js';

// --- Shared material factory (dedupe by key, WCC gfx.ts pattern). -----------
const matCache = new Map();
export function surfaceMat(opts = {}) {
  const key = `${opts.color ?? 'v'}|${opts.mapKey ?? ''}|${opts.flat ? 'f' : ''}|${opts.emissive ?? ''}|${opts.transparent ? 't' + opts.opacity : ''}|${opts.side ?? ''}|${opts.vertexColors ? 'vc' : ''}`;
  if (matCache.has(key)) return matCache.get(key);
  const mat = new THREE.MeshLambertMaterial({
    color: opts.color ?? 0xffffff,
    map: opts.map || null,
    flatShading: !!opts.flat,
    vertexColors: !!opts.vertexColors,
    transparent: !!opts.transparent,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide,
  });
  if (opts.emissive) { mat.emissive = new THREE.Color(opts.emissive); mat.emissiveIntensity = opts.emissiveIntensity ?? 1; }
  matCache.set(key, mat);
  return mat;
}
export function glowMat(color) { return surfaceMat({ color, emissive: color, emissiveIntensity: 0.9, mapKey: 'glow' }); }

// --- Deterministic vertex displacement (rocks, canopies, spires). -----------
// Displaces each unique vertex along its normal by hash(position)-driven noise
// so shared/indexed vertices stay welded (no cracks).
export function displace(geo, amp, seed = 1) {
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const h = Math.sin(v.x * 12.9898 + v.y * 78.233 + v.z * 37.719 + seed * 3.7) * 43758.5453;
    const n = (h - Math.floor(h)) - 0.5;
    const len = v.length() || 1;
    const f = 1 + (n * 2 * amp) / len;
    pos.setXYZ(i, v.x * f, v.y * f, v.z * f);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

// --- GROUNDING ---------------------------------------------------------------
// sampleFootprint: sample terrain radius at the centre + 4 corner offsets of a
// footprint (halfE/halfN metres) around surface direction `dir` on `body`.
// Returns { minR, maxR, avgR, normal } — callers use minR to sink foundations,
// normal to sit flush. This is how "nothing floats" is enforced: every placed
// object bases itself on the LOWEST corner and fills the gap with a plinth.
const _fpDir = new THREE.Vector3();
const _fpE = new THREE.Vector3();
const _fpN = new THREE.Vector3();
const _upY = new THREE.Vector3(0, 1, 0);
export function sampleFootprint(body, dir, halfE, halfN, terrainRadiusAtFn) {
  const east = _fpE.crossVectors(_upY, dir);
  if (east.lengthSq() < 1e-6) east.set(1, 0, 0);
  east.normalize();
  const north = _fpN.crossVectors(dir, east).normalize();
  let minR = Infinity, maxR = -Infinity, sum = 0;
  const offs = [[0, 0], [halfE, halfN], [halfE, -halfN], [-halfE, halfN], [-halfE, -halfN]];
  for (const [e, n] of offs) {
    _fpDir.copy(dir).addScaledVector(east, e / body.radius).addScaledVector(north, n / body.radius).normalize();
    const r = terrainRadiusAtFn(body, _fpDir);
    if (r < minR) minR = r;
    if (r > maxR) maxR = r;
    sum += r;
  }
  // Terrain normal from finite differences (east/north slope).
  _fpDir.copy(dir).addScaledVector(east, halfE / body.radius).normalize();
  const rE = terrainRadiusAtFn(body, _fpDir);
  _fpDir.copy(dir).addScaledVector(east, -halfE / body.radius).normalize();
  const rW = terrainRadiusAtFn(body, _fpDir);
  _fpDir.copy(dir).addScaledVector(north, halfN / body.radius).normalize();
  const rN = terrainRadiusAtFn(body, _fpDir);
  _fpDir.copy(dir).addScaledVector(north, -halfN / body.radius).normalize();
  const rS = terrainRadiusAtFn(body, _fpDir);
  const normal = new THREE.Vector3()
    .copy(dir)
    .addScaledVector(east, -(rE - rW) / (2 * Math.max(halfE, 0.01)) * 0.9)
    .addScaledVector(north, -(rN - rS) / (2 * Math.max(halfN, 0.01)) * 0.9)
    .normalize();
  return { minR, maxR, avgR: sum / offs.length, normal, east: east.clone(), north: north.clone() };
}

// --- Nature -------------------------------------------------------------------
export function makeRock(rng, colorHex) {
  const size = 0.8 + rng() * 1.6;
  const geo = displace(new THREE.IcosahedronGeometry(size, 1), size * 0.35, Math.floor(rng() * 1e4));
  const rock = new THREE.Mesh(geo, surfaceMat({ color: colorHex, flat: true, mapKey: 'rock' }));
  rock.scale.set(1 + rng() * 1.1, 0.55 + rng() * 0.75, 0.8 + rng() * 1.2);
  rock.rotation.y = rng() * Math.PI * 2;
  return rock;
}

export function makeBoulderCluster(rng, colorHex) {
  const g = new THREE.Group();
  const n = 2 + Math.floor(rng() * 3);
  for (let i = 0; i < n; i++) {
    const r = makeRock(rng, colorHex);
    r.position.set((rng() - 0.5) * 3.4, 0, (rng() - 0.5) * 3.4);
    g.add(r);
  }
  return g;
}

// Leafy tree: tapered trunk + 2-3 displaced icosahedron canopies.
export function makeTree(rng, trunkHex, leafHex) {
  const g = new THREE.Group();
  const trunkH = 2.8 + rng() * 2.6;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22 + rng() * 0.1, 0.45 + rng() * 0.15, trunkH, 6),
    surfaceMat({ color: trunkHex, flat: true, mapKey: 'trunk' })
  );
  trunk.position.y = trunkH / 2;
  trunk.rotation.z = (rng() - 0.5) * 0.12;
  g.add(trunk);
  const leaf = new THREE.Color(leafHex);
  const blobs = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < blobs; i++) {
    const s = 1.5 + rng() * 1.3;
    const tint = leaf.clone().multiplyScalar(0.85 + rng() * 0.35).getHex();
    const blob = new THREE.Mesh(
      displace(new THREE.IcosahedronGeometry(s, 1), s * 0.28, Math.floor(rng() * 1e4)),
      surfaceMat({ color: tint, flat: true, mapKey: 'leaf' })
    );
    blob.position.set((rng() - 0.5) * 1.6, trunkH + s * 0.55 + i * s * 0.5, (rng() - 0.5) * 1.6);
    g.add(blob);
  }
  return g;
}

// Conifer: ragged stacked cones.
export function makePine(rng, trunkHex, leafHex) {
  const g = new THREE.Group();
  const trunkH = 1.6 + rng() * 1.4;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.34, trunkH, 6),
    surfaceMat({ color: trunkHex, flat: true, mapKey: 'trunk' })
  );
  trunk.position.y = trunkH / 2;
  g.add(trunk);
  const layers = 3;
  const leaf = new THREE.Color(leafHex);
  let y = trunkH;
  let r = 1.7 + rng() * 0.8;
  for (let i = 0; i < layers; i++) {
    const h = 1.8 + rng() * 1.0;
    const cone = new THREE.Mesh(
      displace(new THREE.ConeGeometry(r, h, 7), r * 0.16, Math.floor(rng() * 1e4)),
      surfaceMat({ color: leaf.clone().multiplyScalar(0.8 + i * 0.12).getHex(), flat: true, mapKey: 'leaf' })
    );
    cone.position.y = y + h * 0.42;
    g.add(cone);
    y += h * 0.62;
    r *= 0.7;
  }
  return g;
}

export function makeIceSpire(rng, hex) {
  const h = 3.5 + rng() * 7;
  const geo = displace(new THREE.ConeGeometry(0.9 + rng() * 1.1, h, 6), 0.35, Math.floor(rng() * 1e4));
  const spire = new THREE.Mesh(geo, surfaceMat({ color: hex, flat: true, transparent: true, opacity: 0.85, mapKey: 'ice' }));
  spire.position.y = h * 0.42;
  spire.rotation.z = (rng() - 0.5) * 0.24;
  return spire;
}

export function makeCrystalCluster(rng, hex) {
  const g = new THREE.Group();
  const n = 3 + Math.floor(rng() * 3);
  for (let i = 0; i < n; i++) {
    const h = 1.2 + rng() * 2.6;
    const c = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.5 + rng() * 0.4, 0),
      surfaceMat({ color: hex, flat: true, emissive: hex, emissiveIntensity: 0.35, mapKey: 'crystal' })
    );
    c.scale.y = h;
    c.position.set((rng() - 0.5) * 2.2, h * 0.4, (rng() - 0.5) * 2.2);
    c.rotation.set((rng() - 0.5) * 0.5, rng() * Math.PI, (rng() - 0.5) * 0.5);
    g.add(c);
  }
  const base = makeRock(rng, 0x3a3f45);
  base.scale.multiplyScalar(1.4);
  g.add(base);
  return g;
}

export function makeVent(rng, rockHex, lavaHex = 0xff6d00) {
  const g = new THREE.Group();
  const h = 2.2 + rng() * 4.2;
  const cone = new THREE.Mesh(
    displace(new THREE.ConeGeometry(2.6 + rng() * 2.4, h, 9), 0.6, Math.floor(rng() * 1e4)),
    surfaceMat({ color: rockHex, flat: true, mapKey: 'basalt' })
  );
  cone.position.y = h * 0.42;
  g.add(cone);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.7 + rng() * 0.5, 8, 6), glowMat(lavaHex));
  glow.position.y = h * 0.92;
  g.add(glow);
  return g;
}

// --- Structures ----------------------------------------------------------------
// Every structure builder returns a Group whose local origin is the BASE of its
// foundation; callers position that origin at footprint minR and the plinth
// fills any slope gap. All exteriors get painted textures, roofs, and trim so
// nothing reads as a naked box.

function foundation(w, d, gap, hex = 0x353c41) {
  // Plinth from local y=0 up to y=gap+0.4 — covers the slope gap under the
  // lowest corner so no wall edge ever hangs in the air.
  const h = gap + 0.4;
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), surfaceMat({ color: hex, mapKey: 'plinth' }));
  m.position.y = h / 2;
  return { mesh: m, top: h };
}

// Gabled building: walls + overhanging prism roof + door + trim.
export function makeGabledBuilding(rng, w, h, d, baseHex, accentHex, slopeGap = 0.4) {
  const g = new THREE.Group();
  const f = foundation(w + 0.6, d + 0.6, slopeGap);
  g.add(f.mesh);
  const wallMat = surfaceMat({ color: 0xffffff, map: buildingWallTexture(baseHex, accentHex), mapKey: `wall${baseHex}:${accentHex}` });
  const walls = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
  walls.position.y = f.top + h / 2;
  g.add(walls);
  // Prism roof (BufferGeometry) with eaves overhang.
  const ow = w * 0.56 + 0.5, od = d / 2 + 0.5, rh = Math.min(w, 7) * 0.38;
  const y0 = f.top + h, y1 = y0 + rh;
  const roofGeo = new THREE.BufferGeometry();
  const verts = new Float32Array([
    // side A
    -ow, y0, -od,  ow, y0, -od,  0, y1, -od,
    // side B
    ow, y0, od,  -ow, y0, od,  0, y1, od,
    // slope 1
    -ow, y0, -od, 0, y1, -od, 0, y1, od,   -ow, y0, -od, 0, y1, od, -ow, y0, od,
    // slope 2
    0, y1, -od, ow, y0, -od, ow, y0, od,   0, y1, -od, ow, y0, od, 0, y1, od,
  ]);
  roofGeo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  roofGeo.computeVertexNormals();
  const roof = new THREE.Mesh(roofGeo, surfaceMat({ color: 0x37464f, flat: true, mapKey: 'roof' }));
  g.add(roof);
  // Door
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.2, 0.15), surfaceMat({ color: accentHex, mapKey: 'door' }));
  door.position.set((rng() - 0.5) * (w * 0.4), f.top + 1.1, d / 2 + 0.08);
  g.add(door);
  return g;
}

// Quonset hut: half-cylinder shell + end caps + door.
export function makeQuonsetHut(rng, w, len, baseHex, accentHex, slopeGap = 0.4) {
  const g = new THREE.Group();
  const f = foundation(w + 0.6, len + 0.6, slopeGap);
  g.add(f.mesh);
  const r = w / 2;
  const mat = surfaceMat({ color: 0xffffff, map: metalPlateTexture(baseHex), mapKey: `metal${baseHex}` });
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 12, 1, false, 0, Math.PI), mat);
  shell.rotation.set(Math.PI / 2, 0, Math.PI / 2);
  shell.position.y = f.top;
  g.add(shell);
  const capGeo = new THREE.CircleGeometry(r, 12, 0, Math.PI);
  for (const side of [-1, 1]) {
    const cap = new THREE.Mesh(capGeo, surfaceMat({ color: baseHex, side: THREE.DoubleSide, mapKey: 'cap' }));
    cap.position.set(0, f.top, side * len / 2);
    cap.rotation.y = side < 0 ? Math.PI : 0;
    g.add(cap);
  }
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.3, 0.15), surfaceMat({ color: accentHex, mapKey: 'door' }));
  door.position.set(0, f.top + 1.15, len / 2 + 0.05);
  g.add(door);
  return g;
}

// Block tower with setbacks, lit window texture, antenna.
export function makeBlockTower(rng, w, totalH, baseHex, accentHex, slopeGap = 0.4) {
  const g = new THREE.Group();
  const f = foundation(w + 0.8, w + 0.8, slopeGap);
  g.add(f.mesh);
  let y = f.top, cw = w;
  const tiers = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < tiers; i++) {
    const th = (totalH / tiers) * (0.85 + rng() * 0.3);
    const wallMat = surfaceMat({ color: 0xffffff, map: buildingWallTexture(baseHex, accentHex), mapKey: `wall${baseHex}:${accentHex}` });
    const tier = new THREE.Mesh(new THREE.BoxGeometry(cw, th, cw), wallMat);
    tier.position.y = y + th / 2;
    g.add(tier);
    // Tier trim
    const trim = new THREE.Mesh(new THREE.BoxGeometry(cw + 0.3, 0.35, cw + 0.3), surfaceMat({ color: 0x2c353b, mapKey: 'trim' }));
    trim.position.y = y + th;
    g.add(trim);
    y += th;
    cw *= 0.72;
  }
  const mastH = 2.5 + rng() * 2.5;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, mastH, 5), surfaceMat({ color: 0x8a959c, mapKey: 'mast' }));
  mast.position.y = y + mastH / 2;
  g.add(mast);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), glowMat(0xff4040));
  beacon.position.y = y + mastH;
  g.add(beacon);
  return g;
}

// Storage tank: cylinder + dome + pipes + ladder strip.
export function makeStorageTank(rng, r, h, hex, slopeGap = 0.4) {
  const g = new THREE.Group();
  const f = foundation(r * 2 + 0.8, r * 2 + 0.8, slopeGap);
  g.add(f.mesh);
  const mat = surfaceMat({ color: 0xffffff, map: metalPlateTexture(hex), mapKey: `metal${hex}` });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 14), mat);
  body.position.y = f.top + h / 2;
  g.add(body);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat);
  dome.position.y = f.top + h;
  g.add(dome);
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, h * 0.9, 6), surfaceMat({ color: 0x6b7d86, mapKey: 'pipe' }));
  pipe.position.set(r + 0.25, f.top + h * 0.45, 0);
  g.add(pipe);
  const ladder = new THREE.Mesh(new THREE.BoxGeometry(0.5, h, 0.1), surfaceMat({ color: 0x39444b, mapKey: 'ladder' }));
  ladder.position.set(0, f.top + h / 2, r + 0.06);
  g.add(ladder);
  return g;
}

// Lattice comms mast: pole, crossarms, guy wires, blinking-color light.
export function makeLatticeMast(rng, h, hex, lightHex) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.4, h, 6), surfaceMat({ color: hex, mapKey: 'mast' }));
  pole.position.y = h / 2;
  g.add(pole);
  for (let i = 1; i <= 3; i++) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.6 - i * 0.3, 0.12, 0.12), surfaceMat({ color: hex, mapKey: 'mast' }));
    arm.position.y = (h * i) / 3.4;
    arm.rotation.y = i * 0.7;
    g.add(arm);
  }
  const wireMat = surfaceMat({ color: 0x222a2f, mapKey: 'wire' });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, h * 1.02, 3), wireMat);
    wire.position.set(Math.cos(a) * h * 0.22, h * 0.5, Math.sin(a) * h * 0.22);
    wire.rotation.z = Math.cos(a) * 0.42;
    wire.rotation.x = -Math.sin(a) * 0.42;
    g.add(wire);
  }
  const light = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), glowMat(lightHex));
  light.position.y = h + 0.3;
  g.add(light);
  return g;
}

// Comms dish: lathe bowl on a yoke.
export function makeDish(rng, r, hex) {
  const g = new THREE.Group();
  const pts = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    pts.push(new THREE.Vector2(t * r, t * t * r * 0.45));
  }
  const bowl = new THREE.Mesh(new THREE.LatheGeometry(pts, 16), surfaceMat({ color: hex, side: THREE.DoubleSide, mapKey: 'dish' }));
  const yokeH = r * 0.9;
  const yoke = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.34, yokeH, 6), surfaceMat({ color: 0x546e7a, mapKey: 'mast' }));
  yoke.position.y = yokeH / 2;
  g.add(yoke);
  bowl.position.y = yokeH + 0.2;
  bowl.rotation.x = -0.9 - rng() * 0.4;
  g.add(bowl);
  const feed = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, r * 0.5, 4), surfaceMat({ color: 0x8a959c, mapKey: 'mast' }));
  feed.position.copy(bowl.position);
  feed.rotation.copy(bowl.rotation);
  feed.translateY(r * 0.3);
  g.add(feed);
  return g;
}

// Landing pad: textured disc + rim + edge lights.
export function makeLandingPad(accentHex) {
  const g = new THREE.Group();
  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(26, 27.5, 1.1, 28),
    [
      surfaceMat({ color: 0x37474f, mapKey: 'padside' }),                            // side
      surfaceMat({ color: 0xffffff, map: padTexture(accentHex), mapKey: `pad${accentHex}` }), // top
      surfaceMat({ color: 0x2b3339, mapKey: 'padbottom' }),                          // bottom
    ]
  );
  top.position.y = 0.55;
  g.add(top);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.34, 6, 5), glowMat(accentHex));
    l.position.set(Math.cos(a) * 25.2, 1.25, Math.sin(a) * 25.2);
    g.add(l);
  }
  return g;
}

// Cargo container (settlement/depot dressing).
export function makeContainer(rng, hex) {
  const g = new THREE.Group();
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(4.2, 2.4, 2.2),
    surfaceMat({ color: 0xffffff, map: metalPlateTexture(hex), mapKey: `metal${hex}` })
  );
  box.position.y = 1.35;
  g.add(box);
  for (const s of [-1.6, 1.6]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 2.2), surfaceMat({ color: 0x2c353b, mapKey: 'trim' }));
    skid.position.set(s, 0.15, 0);
    g.add(skid);
  }
  return g;
}

// Solar array on a tilt frame.
export function makeSolarArray(rng) {
  const g = new THREE.Group();
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 1.4, 5), surfaceMat({ color: 0x546e7a, mapKey: 'mast' }));
  leg.position.y = 0.7;
  g.add(leg);
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(4.4, 0.12, 2.6),
    surfaceMat({ color: 0xffffff, map: solarTexture(), mapKey: 'solar' })
  );
  panel.position.y = 1.5;
  panel.rotation.x = -0.5;
  g.add(panel);
  return g;
}

// Tensile canopy (transit stations): poles + sagging fabric.
export function makeCanopy(rng, w, d, hex) {
  const g = new THREE.Group();
  const poleMat = surfaceMat({ color: 0x546e7a, mapKey: 'mast' });
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 4.6, 6), poleMat);
    pole.position.set(sx * (w / 2 - 0.4), 2.3, sz * (d / 2 - 0.4));
    g.add(pole);
  }
  // Sagging fabric: plane with sine dip.
  const geo = new THREE.PlaneGeometry(w, d, 8, 6);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) / (w / 2), yv = pos.getY(i) / (d / 2);
    pos.setZ(i, -(Math.cos(x * Math.PI / 2) * Math.cos(yv * Math.PI / 2)) * 0.9);
  }
  geo.computeVertexNormals();
  const fabric = new THREE.Mesh(geo, surfaceMat({ color: 0xffffff, map: fabricTexture(hex), mapKey: `fab${hex}`, side: THREE.DoubleSide }));
  fabric.rotation.x = -Math.PI / 2;
  fabric.position.y = 4.55;
  g.add(fabric);
  return g;
}

// Flag/banner on a pole (faction identity in the world).
export function makeBanner(rng, accentHex) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 5.2, 5), surfaceMat({ color: 0x6b7d86, mapKey: 'mast' }));
  pole.position.y = 2.6;
  g.add(pole);
  const flagGeo = new THREE.PlaneGeometry(1.9, 1.1, 6, 3);
  const pos = flagGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    pos.setZ(i, Math.sin((x + 0.95) * 2.4) * 0.14);
  }
  flagGeo.computeVertexNormals();
  const flag = new THREE.Mesh(flagGeo, surfaceMat({ color: accentHex, side: THREE.DoubleSide, mapKey: `flag${accentHex}` }));
  flag.position.set(1.0, 4.55, 0);
  g.add(flag);
  return g;
}

// Enable shadows on every mesh in a prop (called by layout code, gated by
// the graphics setting — see render/lighting.js).
export function enableShadows(obj, cast = true, receive = true) {
  obj.traverse((o) => {
    if (o.isMesh) { o.castShadow = cast; o.receiveShadow = receive; }
  });
  return obj;
}
