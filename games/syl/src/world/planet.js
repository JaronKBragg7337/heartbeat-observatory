// ============================================================================
// planet.js — planet embodiment: terrain math, meshes, gravity, atmosphere.
//
// OWNS: - the ANALYTIC terrain function (single source of truth for ground
//         height, used by BOTH the visual mesh and all collision queries),
//       - planet/water/atmosphere mesh construction,
//       - gravity field math,
//       - landing-zone structures (simple built-from-scratch geometry).
// DOES NOT OWN: body DATA (bodies.js), who is where (worldState.js),
//               movement (player.js / ship.js).
//
// KUREARTHIS TRUTH APPLIED: a planet is NEVER one giant collision mesh.
// Collision here is ANALYTIC: terrainRadiusAt(body, dirUnit) returns the exact
// ground distance-from-center along any direction, in f64, valid everywhere,
// at any distance from origin. The rendered mesh is just a picture of that
// same function. This is the browser equivalent of "local collision patch":
// infinitely local, always exact, and it can never disagree with itself.
//
// LANDING ZONES are flattened INSIDE the analytic function (not by moving
// meshes), so visuals and collision agree by construction — the repo's
// "one surface, not stacked shells" law.
//
// Future agents: for close-up ground detail, add a quadtree LOD patch that
// samples the SAME terrainRadiusAt() — never a second height source.
// ============================================================================

import * as THREE from 'three';
import { fbm, smoothstep } from '../core/math3d.js';

// ---------------------------------------------------------------------------
// ANALYTIC TERRAIN — single source of truth.
// dir must be normalized (direction from body center). Returns meters from
// body center to the ground surface along dir.
// ---------------------------------------------------------------------------
export function terrainRadiusAt(body, dir) {
  const t = body.terrain;
  let h = fbm(dir.x, dir.y, dir.z, t.seed, t.octaves, t.freq) * t.amplitude;

  // Landing-zone flattening — blended into the SAME function.
  for (const zone of body.landingZones) {
    if (!zone.flatten) continue;
    const zd = zone._dirV; // normalized at registry load (see buildBodyVisual)
    const ang = Math.acos(Math.min(1, Math.max(-1, dir.dot(zd))));
    if (ang < zone.angularRadius * 1.6) {
      // 0 inside the pad -> 1 at the blend edge.
      const blend = smoothstep(zone.angularRadius * 0.7, zone.angularRadius * 1.6, ang);
      const flatH = zone._flatHeight; // sampled once at zone center
      h = flatH + (h - flatH) * blend;
    }
  }
  return body.radius + h;
}

// Altitude of a world-space point above the ground of `body` (negative = below).
export function altitudeAt(body, worldPos) {
  const rel = _tmpA.subVectors(worldPos, body._centerV);
  const dist = rel.length();
  if (dist < 1e-6) return -body.radius;
  const dir = rel.multiplyScalar(1 / dist);
  return dist - terrainRadiusAt(body, dir);
}

// Radial "up" unit vector at a world position (surface normal approximation).
export function upAt(body, worldPos, out) {
  out = out || new THREE.Vector3();
  return out.subVectors(worldPos, body._centerV).normalize();
}

// Inverse-square gravity acceleration (m/s²) from `body` at a world position.
// Direction is toward the body center. Returns a vector in `out`.
export function gravityAt(body, worldPos, out) {
  out = out || new THREE.Vector3();
  out.subVectors(body._centerV, worldPos);
  const d = out.length();
  if (d < 1e-6) return out.set(0, 0, 0);
  const g = body.surfaceGravity * Math.pow(body.radius / Math.max(d, body.radius * 0.5), 2);
  return out.multiplyScalar(g / d);
}

// The body whose gravity dominates at a world position (max |g|).
// This defines the player's/ship's reference frame ("second-body coexistence":
// all bodies always exist and pull; the strongest one is the local frame).
export function dominantBody(bodies, worldPos) {
  let best = null, bestG = -1;
  const tmp = _tmpB;
  for (const b of bodies) {
    gravityAt(b, worldPos, tmp);
    const g = tmp.length();
    if (g > bestG) { bestG = g; best = b; }
  }
  return best;
}

const _tmpA = new THREE.Vector3();
const _tmpB = new THREE.Vector3();

// ---------------------------------------------------------------------------
// VISUAL construction — meshes are pictures of the analytic function above.
// Returns { group, bodyMesh } ; group is tracked by the floating origin.
// ---------------------------------------------------------------------------
export function buildBodyVisual(body, factionById) {
  // One-time derived fields on the body record (kept on the data object so
  // every system shares them; underscore = derived, not serialized).
  body._centerV = new THREE.Vector3().fromArray(body.position);
  for (const zone of body.landingZones) {
    zone._dirV = new THREE.Vector3().fromArray(zone.dir).normalize();
    // Sample the raw noise at zone center once => the pad's flat height.
    const t = body.terrain;
    zone._flatHeight = fbm(zone._dirV.x, zone._dirV.y, zone._dirV.z, t.seed, t.octaves, t.freq) * t.amplitude;
  }

  const group = new THREE.Group();
  group.name = `body:${body.id}`;

  // --- Terrain mesh: icosphere displaced by terrainRadiusAt (SAME function).
  const detail = body.radius > 2000 ? 64 : (body.radius > 600 ? 48 : 32);
  const geo = new THREE.SphereGeometry(1, detail * 2, detail);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cLow = new THREE.Color(body.colors.low);
  const cMid = new THREE.Color(body.colors.mid);
  const cHigh = new THREE.Color(body.colors.high);
  const dir = new THREE.Vector3();
  const cTmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    dir.fromBufferAttribute(pos, i).normalize();
    const r = terrainRadiusAt(body, dir);
    pos.setXYZ(i, dir.x * r, dir.y * r, dir.z * r);
    // Color by height above base radius.
    const hN = (r - body.radius) / Math.max(1, body.terrain.amplitude); // ~[-1,1]
    if (hN < 0) cTmp.lerpColors(cLow, cMid, hN + 1);
    else cTmp.lerpColors(cMid, cHigh, hN);
    colors[i * 3] = cTmp.r; colors[i * 3 + 1] = cTmp.g; colors[i * 3 + 2] = cTmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const bodyMesh = new THREE.Mesh(
    geo,
    new THREE.MeshLambertMaterial({ vertexColors: true })
  );
  bodyMesh.name = `terrain:${body.id}`;
  group.add(bodyMesh);

  // --- Water shell (visual only; collision treats water as passable ground fog).
  if (body.seaLevel !== null && body.seaLevel !== undefined && body.colors.water) {
    const water = new THREE.Mesh(
      new THREE.SphereGeometry(body.radius + body.seaLevel, 96, 48),
      new THREE.MeshLambertMaterial({ color: body.colors.water, transparent: true, opacity: 0.85 })
    );
    water.name = `water:${body.id}`;
    group.add(water);
  }

  // --- Atmosphere shell: back-side sphere, additive; opacity handled per-frame
  // by traversal.js (fades with camera altitude — surface sky -> space stars).
  if (body.atmosphere) {
    const atmoGeo = new THREE.SphereGeometry(body.radius + body.atmosphere.height, 64, 32);
    const atmoMat = new THREE.MeshBasicMaterial({
      color: body.atmosphere.color, transparent: true, opacity: 0.45,
      side: THREE.BackSide, depthWrite: false,
    });
    const atmo = new THREE.Mesh(atmoGeo, atmoMat);
    atmo.name = `atmo:${body.id}`;
    body._atmoMesh = atmo;
    group.add(atmo);
  }

  // --- Landing-zone structures: authored from scratch (SYL law: no premade
  // assets; the world is built, not spawned). Simple but physical-looking.
  for (const zone of body.landingZones) {
    const zGroup = buildZoneStructures(body, zone, factionById);
    group.add(zGroup);
  }

  body._group = group;
  return { group, bodyMesh };
}

// Position an object on the surface at `dir` with local up = radial.
function placeOnSurface(body, dirUnit, obj, extraHeight = 0) {
  const r = terrainRadiusAt(body, dirUnit) + extraHeight;
  obj.position.copy(dirUnit).multiplyScalar(r); // group-local (group sits at body center)
  // Orient: local +Y -> radial up.
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dirUnit);
}

function buildZoneStructures(body, zone, factionById) {
  const g = new THREE.Group();
  g.name = `zone:${zone.id}`;
  const faction = zone.factionId && factionById ? factionById[zone.factionId] : null;
  const fColor = faction ? faction.color : 0x546e7a;

  // Pad ring — every zone gets one (visual marker; the flat ground itself is
  // already part of the analytic terrain).
  const pad = new THREE.Mesh(
    new THREE.CylinderGeometry(26, 26, 0.6, 24),
    new THREE.MeshLambertMaterial({ color: 0x37474f })
  );
  placeOnSurface(body, zone._dirV, pad, 0.3);
  g.add(pad);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(24, 0.3, 8, 48),
    new THREE.MeshBasicMaterial({ color: fColor })
  );
  placeOnSurface(body, zone._dirV, ring, 0.35);
  ring.rotateX(Math.PI / 2);
  g.add(ring);

  if (zone.structures === 'outpost') {
    // Fortis outpost: armored blocks + watchtower + beacon (steel + red canon).
    const steel = new THREE.MeshLambertMaterial({ color: 0x455a64 });
    const offsets = [[40, 0], [-42, 10], [10, -46], [-15, 44]];
    for (const [ox, oz] of offsets) {
      const bunker = new THREE.Mesh(new THREE.BoxGeometry(14, 7, 10), steel);
      const d = offsetDir(zone._dirV, ox, oz, body);
      placeOnSurface(body, d, bunker, 3.5);
      g.add(bunker);
    }
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.2, 22, 8), steel);
    const td = offsetDir(zone._dirV, 30, 30, body);
    placeOnSurface(body, td, tower, 11);
    g.add(tower);
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(1.6, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0xd32f2f })
    );
    placeOnSurface(body, td, beacon, 23);
    g.add(beacon);
  } else if (zone.structures === 'relay') {
    const dish = new THREE.Mesh(
      new THREE.ConeGeometry(6, 3, 16, 1, true),
      new THREE.MeshLambertMaterial({ color: 0x607d8b, side: THREE.DoubleSide })
    );
    const d = offsetDir(zone._dirV, 18, -12, body);
    placeOnSurface(body, d, dish, 8);
    g.add(dish);
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.8, 9, 6),
      new THREE.MeshLambertMaterial({ color: 0x546e7a })
    );
    placeOnSurface(body, d, mast, 4.5);
    g.add(mast);
  } else if (zone.structures === 'beacon') {
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 1.0, 12, 6),
      new THREE.MeshLambertMaterial({ color: 0x546e7a })
    );
    placeOnSurface(body, zone._dirV, mast, 6);
    g.add(mast);
    const light = new THREE.Mesh(
      new THREE.SphereGeometry(1.1, 10, 8),
      new THREE.MeshBasicMaterial({ color: fColor })
    );
    placeOnSurface(body, zone._dirV, light, 12.6);
    g.add(light);
  }
  return g;
}

// Direction slightly offset from a zone center by (east, north) meters.
function offsetDir(dirUnit, eastM, northM, body) {
  const up = dirUnit.clone();
  const east = new THREE.Vector3(0, 1, 0).cross(up);
  if (east.lengthSq() < 1e-6) east.set(1, 0, 0);
  east.normalize();
  const north = up.clone().cross(east).normalize();
  return up.clone()
    .addScaledVector(east, eastM / body.radius)
    .addScaledVector(north, northM / body.radius)
    .normalize();
}

// World-space position of a zone's center on the surface (for spawning).
export function zoneWorldPos(body, zone, extraHeight = 0) {
  const r = terrainRadiusAt(body, zone._dirV) + extraHeight;
  return new THREE.Vector3().copy(zone._dirV).multiplyScalar(r).add(body._centerV);
}

// --- Starfield: one distant, camera-anchored point cloud. -------------------
export function buildStarfield(count = 3500, radius = 400000) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    // Uniform-ish on sphere.
    const u = Math.random() * 2 - 1;
    const th = Math.random() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    positions[i * 3] = s * Math.cos(th) * radius;
    positions[i * 3 + 1] = u * radius;
    positions[i * 3 + 2] = s * Math.sin(th) * radius;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const stars = new THREE.Points(
    geo,
    new THREE.PointsMaterial({ color: 0xbfd4ff, size: 2.2, sizeAttenuation: false })
  );
  stars.name = 'starfield';
  stars.frustumCulled = false;
  return stars;
}