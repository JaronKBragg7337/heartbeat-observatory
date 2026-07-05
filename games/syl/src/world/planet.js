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
// Raw analytic terrain (fbm + zone flattening). Used to BUILD each body's
// radius grid; runtime queries go through terrainRadiusAt below, which
// interpolates that grid exactly like the GPU rasterizes the mesh.
export function analyticTerrainRadiusAt(body, dir) {
  const t = body.terrain;
  let h = fbm(dir.x, dir.y, dir.z, t.seed, t.octaves, t.freq) * t.amplitude;
  h = shapeTerrainProfile(t, dir, h);

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

function shapeTerrainProfile(t, dir, baseHeight) {
  const profile = t.profile || 'continental';
  const amp = t.amplitude || 1;
  const seed = t.seed || 1;
  if (profile === 'ridged') {
    const r = 1 - Math.abs(fbm(dir.x, dir.y, dir.z, seed + 17, t.octaves + 1, t.freq * 1.7));
    return baseHeight * 0.45 + Math.pow(r, 2.6) * amp * 1.35 - amp * 0.18;
  }
  if (profile === 'cratered') {
    const basins = 1 - Math.abs(fbm(dir.x, dir.y, dir.z, seed + 31, 4, t.freq * 1.15));
    const rims = Math.sin(Math.max(0, basins) * Math.PI * 7.0);
    return baseHeight * 0.55 - Math.pow(basins, 4.0) * amp * 1.2 + Math.max(0, rims) * amp * 0.22;
  }
  if (profile === 'volcanic') {
    const cones = Math.pow(Math.max(0, fbm(dir.x, dir.y, dir.z, seed + 53, 5, t.freq * 2.2)), 3.2);
    const trenches = Math.pow(1 - Math.abs(fbm(dir.z, dir.x, dir.y, seed + 57, 4, t.freq * 3.0)), 5.0);
    return baseHeight * 0.75 + cones * amp * 1.7 - trenches * amp * 0.65;
  }
  if (profile === 'ice') {
    const cracks = Math.pow(1 - Math.abs(fbm(dir.x, dir.y, dir.z, seed + 71, 4, t.freq * 8.0)), 9.0);
    return baseHeight * 0.32 + cracks * amp * 0.95;
  }
  if (profile === 'dune') {
    const bands = Math.sin((dir.x * 7.0 + dir.z * 5.0 + fbm(dir.x, dir.y, dir.z, seed + 83, 3, t.freq)) * Math.PI);
    return baseHeight * 0.22 + bands * amp * 0.38;
  }
  if (profile === 'oceanic') {
    const islands = Math.max(0, fbm(dir.x, dir.y, dir.z, seed + 97, t.octaves, t.freq * 1.4));
    return baseHeight * 0.24 + Math.pow(islands, 2.2) * amp * 1.25 - amp * 0.28;
  }
  if (profile === 'gas') {
    const bands = Math.sin((dir.y * 18.0 + fbm(dir.x, dir.y, dir.z, seed + 101, 3, 2.0) * 2.5) * Math.PI);
    return bands * amp * 0.18 + baseHeight * 0.05;
  }
  return baseHeight;
}

// ---------------------------------------------------------------------------
// MESH-TRUE COLLISION (2026-07-04 root-cause fix).
// The old runtime collision sampled the raw fbm function, but the rendered
// mesh is a LINEAR interpolation of that function across ~150 m triangles —
// on rugged terrain the two disagreed by many meters. Players stood on air,
// sank under the grass, and the camera clipped inside the planet ("see
// through the ground"). The fix makes the LAW true by construction:
// buildBodyVisual stores each body's exact vertex-radius grid, and
// terrainRadiusAt intersects the query ray with the SAME triangle the GPU
// draws. Collision now equals the picture to float precision, everywhere.
// Future agents: if you add terrain LOD, keep this rule — collision must
// sample whatever the player currently SEES.
// ---------------------------------------------------------------------------
export function terrainRadiusAt(body, dir) {
  const g = body._terrainGrid;
  if (!g) return analyticTerrainRadiusAt(body, dir); // pre-build fallback
  // Map dir -> SphereGeometry (u,v). three.js param: x=-cosφ·sinθ, y=cosθ, z=sinφ·sinθ.
  const vy = Math.min(1, Math.max(-1, dir.y));
  const theta = Math.acos(vy);
  let phi = Math.atan2(dir.z, -dir.x);
  if (phi < 0) phi += Math.PI * 2;
  const fx = (phi / (Math.PI * 2)) * g.W;
  const fy = (theta / Math.PI) * g.H;
  let ix = Math.min(Math.floor(fx), g.W - 1);
  let iy = Math.min(Math.floor(fy), g.H - 1);
  if (ix < 0) ix = 0;
  if (iy < 0) iy = 0;
  const sN = fx - ix, tN = fy - iy;
  // Quad corners (matching the geometry): b=(ix,iy) a=(ix+1,iy) c=(ix,iy+1) d=(ix+1,iy+1)
  _gp(g, body, ix + 1, iy, _pa);
  _gp(g, body, ix, iy, _pb);
  _gp(g, body, ix, iy + 1, _pc);
  _gp(g, body, ix + 1, iy + 1, _pd);
  // three.js splits the quad along the b–d diagonal: (a,b,d) upper, (b,c,d) lower.
  let r = sN > tN ? _rayTri(dir, _pa, _pb, _pd) : _rayTri(dir, _pb, _pc, _pd);
  if (!(r > 0)) r = sN > tN ? _rayTri(dir, _pb, _pc, _pd) : _rayTri(dir, _pa, _pb, _pd);
  if (!(r > 0)) {
    // Degenerate (pole seam): bilinear on radius is exact enough there.
    const rb = g.radii[iy * (g.W + 1) + ix], ra = g.radii[iy * (g.W + 1) + ix + 1];
    const rc = g.radii[(iy + 1) * (g.W + 1) + ix], rd = g.radii[(iy + 1) * (g.W + 1) + ix + 1];
    r = (rb + (ra - rb) * sN) * (1 - tN) + (rc + (rd - rc) * sN) * tN;
  }
  return r;
}

// Vertex position of grid point (ix,iy) into `out` (body-local, meters).
function _gp(g, body, ix, iy, out) {
  const phi = (ix / g.W) * Math.PI * 2;
  const theta = (iy / g.H) * Math.PI;
  const st = Math.sin(theta);
  const r = g.radii[iy * (g.W + 1) + ix];
  return out.set(-Math.cos(phi) * st * r, Math.cos(theta) * r, Math.sin(phi) * st * r);
}

// Distance from body center along `dir` to the triangle (p0,p1,p2); 0 if miss.
function _rayTri(dir, p0, p1, p2) {
  _e1.subVectors(p1, p0);
  _e2.subVectors(p2, p0);
  _n.crossVectors(_e1, _e2);
  const denom = _n.dot(dir);
  if (Math.abs(denom) < 1e-9) return 0;
  const r = _n.dot(p0) / denom;
  return r > 0 && Number.isFinite(r) ? r : 0;
}
const _pa = new THREE.Vector3(), _pb = new THREE.Vector3(), _pc = new THREE.Vector3(), _pd = new THREE.Vector3();
const _e1 = new THREE.Vector3(), _e2 = new THREE.Vector3(), _n = new THREE.Vector3();

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
const _structRel = new THREE.Vector3();
const _structDir = new THREE.Vector3();
const _zoneEast = new THREE.Vector3();
const _zoneNorth = new THREE.Vector3();
const _worldY = new THREE.Vector3(0, 1, 0);

// ---------------------------------------------------------------------------
// STRUCTURE COLLISION — analytic footprints for authored zone structures.
// These are intentionally simple capsule-vs-footprint blockers: visuals can
// stay handmade Three.js primitives, while movement never depends on mesh
// collision at true-scale coordinates.
// ---------------------------------------------------------------------------
export function structureCollidersForZone(zone) {
  if (zone.structures === 'outpost') {
    return [
      ...[[40, 0], [-42, 10], [10, -46], [-15, 44]].map(([east, north]) => ({
        kind: 'box', east, north, halfEast: 8, halfNorth: 6, height: 7,
      })),
      { kind: 'circle', east: 30, north: 30, radius: 3.2, height: 24 },
    ];
  }
  if (zone.structures === 'relay') {
    return [
      { kind: 'circle', east: 18, north: -12, radius: 7.5, height: 10 },
    ];
  }
  if (zone.structures === 'depot') {
    return [
      { kind: 'box', east: -18, north: 0, halfEast: 12, halfNorth: 7, height: 8 },
      { kind: 'box', east: 18, north: 7, halfEast: 9, halfNorth: 6, height: 6 },
      { kind: 'circle', east: 5, north: -18, radius: 4, height: 15 },
    ];
  }
  if (zone.structures === 'beacon') {
    return [
      { kind: 'circle', east: 0, north: 0, radius: 2, height: 13 },
    ];
  }
  if (zone.structures === 'transit') {
    return [
      { kind: 'box', east: -20, north: 4, halfEast: 15, halfNorth: 7, height: 8 },
      { kind: 'box', east: 20, north: -5, halfEast: 11, halfNorth: 6, height: 7 },
      { kind: 'circle', east: 0, north: 24, radius: 3.5, height: 18 },
      { kind: 'circle', east: 0, north: -24, radius: 3.5, height: 18 },
    ];
  }
  return [];
}

export function structureCollidersForBody(body) {
  const out = [];
  for (const zone of body.landingZones) {
    for (const collider of structureCollidersForZone(zone)) {
      out.push({ ...collider, zoneId: zone.id, zone });
    }
  }
  return out;
}

export function resolveStructureCollision(body, worldPos, radius = 0.45) {
  if (!body?._centerV) return false;
  const rel = _structRel.subVectors(worldPos, body._centerV);
  const dist = rel.length();
  if (dist < 1e-6) return false;
  const dir = _structDir.copy(rel).multiplyScalar(1 / dist);
  const altitude = dist - terrainRadiusAt(body, dir);
  let changed = false;

  for (const zone of body.landingZones) {
    const ang = Math.acos(Math.min(1, Math.max(-1, dir.dot(zone._dirV))));
    if (ang > zone.angularRadius * 1.8) continue;

    const frame = zoneFrame(zone._dirV, body);
    const dEast = dir.dot(frame.east) * body.radius;
    const dNorth = dir.dot(frame.north) * body.radius;

    for (const c of structureCollidersForZone(zone)) {
      if (altitude > c.height) continue;
      let outEast = dEast;
      let outNorth = dNorth;

      if (c.kind === 'box') {
        const localE = dEast - c.east;
        const localN = dNorth - c.north;
        const overlapE = c.halfEast + radius - Math.abs(localE);
        const overlapN = c.halfNorth + radius - Math.abs(localN);
        if (overlapE <= 0 || overlapN <= 0) continue;
        if (overlapE < overlapN) {
          outEast = c.east + Math.sign(localE || 1) * (c.halfEast + radius);
        } else {
          outNorth = c.north + Math.sign(localN || 1) * (c.halfNorth + radius);
        }
      } else if (c.kind === 'circle') {
        const localE = dEast - c.east;
        const localN = dNorth - c.north;
        const len = Math.hypot(localE, localN);
        const minLen = c.radius + radius;
        if (len >= minLen) continue;
        const nx = len > 1e-6 ? localE / len : 1;
        const ny = len > 1e-6 ? localN / len : 0;
        outEast = c.east + nx * minLen;
        outNorth = c.north + ny * minLen;
      }

      const newDir = zone._dirV.clone()
        .addScaledVector(frame.east, outEast / body.radius)
        .addScaledVector(frame.north, outNorth / body.radius)
        .normalize();
      const newR = terrainRadiusAt(body, newDir) + Math.max(altitude, 0);
      worldPos.copy(newDir).multiplyScalar(newR).add(body._centerV);
      dir.copy(newDir);
      changed = true;
    }
  }
  return changed;
}

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

  // --- Terrain mesh + collision grid (one surface by construction).
  // The grid stores the exact analytic radius at every mesh vertex; the mesh
  // displaces from the grid, and runtime collision interpolates the grid the
  // same way the GPU does. Bumped detail (2026-07-04): finer triangles both
  // look better and shrink each triangle's deviation from the raw function.
  const detail = body.radius > 2000 ? 96 : (body.radius > 600 ? 64 : 48);
  {
    const W = detail * 2, H = detail;
    const radii = new Float64Array((W + 1) * (H + 1));
    const gd = new THREE.Vector3();
    for (let iy = 0; iy <= H; iy++) {
      const theta = (iy / H) * Math.PI;
      for (let ix = 0; ix <= W; ix++) {
        const phi = (ix / W) * Math.PI * 2;
        const st = Math.sin(theta);
        gd.set(-Math.cos(phi) * st, Math.cos(theta), Math.sin(phi) * st);
        if (gd.lengthSq() < 1e-12) gd.set(0, theta < 1 ? 1 : -1, 0);
        gd.normalize();
        radii[iy * (W + 1) + ix] = analyticTerrainRadiusAt(body, gd);
      }
    }
    body._terrainGrid = { W, H, radii };
  }
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
  } else if (zone.structures === 'depot') {
    const steel = new THREE.MeshLambertMaterial({ color: 0x455a64 });
    const dark = new THREE.MeshLambertMaterial({ color: 0x263238 });
    const red = new THREE.MeshBasicMaterial({ color: fColor });
    const shedA = new THREE.Mesh(new THREE.BoxGeometry(22, 8, 12), steel);
    placeOnSurface(body, offsetDir(zone._dirV, -18, 0, body), shedA, 4);
    g.add(shedA);
    const shedB = new THREE.Mesh(new THREE.BoxGeometry(16, 6, 10), dark);
    placeOnSurface(body, offsetDir(zone._dirV, 18, 7, body), shedB, 3);
    g.add(shedB);
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 12, 12), steel);
    placeOnSurface(body, offsetDir(zone._dirV, 5, -18, body), tank, 6);
    g.add(tank);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 8), red);
    placeOnSurface(body, offsetDir(zone._dirV, 5, -18, body), lamp, 13);
    g.add(lamp);
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
  } else if (zone.structures === 'transit') {
    const steel = new THREE.MeshLambertMaterial({ color: 0x546e7a });
    const dark = new THREE.MeshLambertMaterial({ color: 0x1f2a30 });
    const glass = new THREE.MeshLambertMaterial({ color: 0x8fd7ff, transparent: true, opacity: 0.42 });
    const signal = new THREE.MeshBasicMaterial({ color: fColor });
    const terminal = new THREE.Mesh(new THREE.BoxGeometry(28, 8, 12), steel);
    placeOnSurface(body, offsetDir(zone._dirV, -20, 4, body), terminal, 4);
    g.add(terminal);
    const concourse = new THREE.Mesh(new THREE.BoxGeometry(18, 6, 10), dark);
    placeOnSurface(body, offsetDir(zone._dirV, 20, -5, body), concourse, 3);
    g.add(concourse);
    const windows = new THREE.Mesh(new THREE.BoxGeometry(24, 2, 0.4), glass);
    placeOnSurface(body, offsetDir(zone._dirV, -20, 10.3, body), windows, 7);
    g.add(windows);
    for (const north of [24, -24]) {
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.8, 16, 8), steel);
      const d = offsetDir(zone._dirV, 0, north, body);
      placeOnSurface(body, d, mast, 8);
      g.add(mast);
      const light = new THREE.Mesh(new THREE.SphereGeometry(1.2, 10, 8), signal);
      placeOnSurface(body, d, light, 17);
      g.add(light);
    }
    const gate = new THREE.Mesh(new THREE.TorusGeometry(8, 0.28, 8, 32), signal);
    placeOnSurface(body, offsetDir(zone._dirV, 0, 0, body), gate, 2.6);
    gate.rotateX(Math.PI / 2);
    g.add(gate);
  }
  return g;
}

// Direction slightly offset from a zone center by (east, north) meters.
function offsetDir(dirUnit, eastM, northM, body) {
  const frame = zoneFrame(dirUnit);
  return dirUnit.clone()
    .addScaledVector(frame.east, eastM / body.radius)
    .addScaledVector(frame.north, northM / body.radius)
    .normalize();
}

function zoneFrame(dirUnit) {
  const east = _zoneEast.crossVectors(_worldY, dirUnit);
  if (east.lengthSq() < 1e-6) east.set(1, 0, 0);
  east.normalize();
  const north = _zoneNorth.crossVectors(dirUnit, east).normalize();
  return { east, north };
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
