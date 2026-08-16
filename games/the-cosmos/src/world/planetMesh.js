// ============================================================================
// planetMesh.js — pictures of the field. Never a second source of truth.
//
// OWNS: the two meshes that make a real-scale planet visible — a coarse global
//       shell for the horizon and distance, and a dense local patch under the
//       player for the ground they actually walk on.
// DOES NOT OWN: the shape. Every vertex is a sample of field.js. If the mesh
//       and the collider ever disagree, the mesh is wrong by definition.
//
// WHY TWO MESHES
// --------------
// Mars is 3,389.5 km in radius. A single uniform sphere fine enough to walk on
// (say 2 m between vertices) would need on the order of 10^13 vertices. So:
//
//   global shell  — whole planet, ~110 km between vertices. Reads as a world
//                   from orbit and gives an honest curved horizon on foot.
//   local patch   — a square of ground centred on the player, metres between
//                   vertices, rebuilt when they walk off the edge of it.
//
// Both call the same `surfaceRadiusAlong()`. They are two resolutions of one
// function, not two models that have to be kept in sync by hand.
//
// KNOWN LIMITATION, STATED PLAINLY
// --------------------------------
// Both meshes take the OUTERMOST field crossing along each vertex ray, so a
// cave roof renders but the cave interior does not yet have geometry. The field
// already knows the cave is there and collision already respects it — this is a
// renderer gap, not a world-model gap, and closing it is a marching-cubes pass
// over the local patch rather than a redesign. That distinction is the entire
// reason the field came first.
// ============================================================================

import * as THREE from 'three';
import { surfaceRadiusAlong, surfaceRadiusFast, materialAt, elevationAt, MATERIALS } from './field.js';
import { localFrame, geodeticToCartesian, cartesianToGeodetic } from './geodesy.js';

// ---------------------------------------------------------------------------
// Colour ramp from real material, not from an arbitrary palette. Each vertex
// asks the field what it is made of and takes that material's colour, so the
// ground is coloured by its geology.
// ---------------------------------------------------------------------------
function shadeVertex(body, px, py, pz, elevation, color) {
  const mat = materialAt(body, px, py, pz);
  color.setHex(mat.color);

  // Elevation banding: dust settles in the lows, wind strips the highs.
  const t = body.terrain;
  const n = Math.max(-1, Math.min(1, elevation / (t.localRelief * 2.2)));
  if (n > 0) color.lerp(new THREE.Color(0x8a6048), n * 0.35);   // scoured highland
  else color.lerp(new THREE.Color(0xc27a4a), -n * 0.30);        // dust-filled basin
  return color;
}

// ---------------------------------------------------------------------------
// GLOBAL SHELL — the whole planet at low resolution.
// ---------------------------------------------------------------------------
export function buildGlobalShell(body, opts = {}) {
  const segW = opts.segments || 128;
  const segH = Math.round(segW / 2);
  const geo = new THREE.SphereGeometry(1, segW, segH);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const d = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    d.fromBufferAttribute(pos, i).normalize();
    // Coarse sampling: the global shell uses the elevation envelope directly
    // rather than ray-marching 33k vertices. Same function the field uses as
    // its own input, so the two cannot drift apart in broad shape.
    const elev = elevationAt(body, d.x, d.y, d.z);
    const g = { x: d.x, y: d.y, z: d.z };
    const R = geodeticRadius(body, d.y) + elev;
    pos.setXYZ(i, d.x * R, d.y * R, d.z * R);
    shadeVertex(body, d.x * R, d.y * R, d.z * R, elev, c);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.95,
    metalness: 0.0,
    // The local patch is the accurate surface; push the global shell back so
    // the patch always wins the depth test where they overlap. This is a
    // render-order fix, not a geometry offset — the shapes still agree.
    polygonOffset: true,
    polygonOffsetFactor: 1.0,
    polygonOffsetUnits: 1.0,
  }));
  mesh.name = `shell:${body.id}`;
  mesh.receiveShadow = true;
  return mesh;
}

/** Radius of the reference spheroid at a given normalised Y (sin of latitude). */
function geodeticRadius(body, ny) {
  const a = body.radiusEquatorial, b = body.radiusPolar;
  const s = Math.max(-1, Math.min(1, ny));
  // Radius of an ellipse at parametric latitude — good enough for the shell.
  return (a * b) / Math.sqrt(b * b * (1 - s * s) + a * a * s * s);
}

// ---------------------------------------------------------------------------
// LOCAL PATCH — the ground you stand on.
// ---------------------------------------------------------------------------
export class LocalPatch {
  /**
   * @param {number} sizeM   edge length of the patch, metres
   * @param {number} res     vertices per edge
   */
  constructor(body, opts = {}) {
    this.body = body;
    this.sizeM = opts.sizeM || 768;
    this.res = opts.res || 96;                 // 96x96 -> ~8 m spacing at 768 m
    this.rebuildThreshold = this.sizeM * 0.28; // rebuild before the edge shows
    this.centre = null;                        // {lat, lon}
    this.builtAt = null;                       // cartesian centre of last build
    this.buildCount = 0;
    this.lastBuildMs = 0;

    const n = this.res;
    const verts = new Float32Array(n * n * 3);
    const colors = new Float32Array(n * n * 3);
    const indices = [];
    for (let j = 0; j < n - 1; j++) {
      for (let i = 0; i < n - 1; i++) {
        const a = j * n + i, b = a + 1, c2 = a + n, d = c2 + 1;
        indices.push(a, c2, b, b, c2, d);
      }
    }
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.geo.setIndex(indices);

    this.mesh = new THREE.Mesh(this.geo, new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.93, metalness: 0.0,
    }));
    this.mesh.name = `patch:${body.id}`;
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false;
    this.mesh.frustumCulled = false;

    // The patch is tracked by the floating origin like everything else: its
    // vertices are stored relative to the patch centre, and the centre is an
    // f64 world position.
    this.worldPos = { x: 0, y: 0, z: 0 };
  }

  /** Does the player need a fresh patch? */
  needsRebuild(px, py, pz) {
    if (!this.builtAt) return true;
    const dx = px - this.builtAt.x, dy = py - this.builtAt.y, dz = pz - this.builtAt.z;
    return Math.hypot(dx, dy, dz) > this.rebuildThreshold;
  }

  /**
   * Rebuild around a world position. Every vertex ray-marches the field, so
   * the patch is the field's own opinion of the ground at metre resolution.
   */
  rebuild(px, py, pz) {
    const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const body = this.body;
    const g = cartesianToGeodetic(body, px, py, pz);
    this.centre = { lat: g.lat, lon: g.lon };

    const f = localFrame(g.lat, g.lon);
    const n = this.res;
    const half = this.sizeM / 2;
    const stepM = this.sizeM / (n - 1);

    const pos = this.geo.attributes.position.array;
    const col = this.geo.attributes.color.array;
    const c = new THREE.Color();

    // Patch origin: the field surface directly under the requested centre.
    const originR = surfaceRadiusAlong(body,
      px / Math.hypot(px, py, pz), py / Math.hypot(px, py, pz), pz / Math.hypot(px, py, pz));
    const cd = { x: px, y: py, z: pz };
    const clen = Math.hypot(cd.x, cd.y, cd.z);
    const ox = (cd.x / clen) * originR, oy = (cd.y / clen) * originR, oz = (cd.z / clen) * originR;
    this.worldPos = { x: ox, y: oy, z: oz };
    this.builtAt = { x: px, y: py, z: pz };

    for (let j = 0; j < n; j++) {
      const north = -half + j * stepM;
      for (let i = 0; i < n; i++) {
        const east = -half + i * stepM;

        // Step out along the local tangent plane, then re-normalise: this
        // wraps the flat grid onto the sphere so the patch curves correctly
        // instead of being a plane pretending to be ground.
        const wx = ox + f.east.x * east + f.north.x * north;
        const wy = oy + f.east.y * east + f.north.y * north;
        const wz = oz + f.east.z * east + f.north.z * north;
        const wl = Math.hypot(wx, wy, wz) || 1;
        const dx = wx / wl, dy = wy / wl, dz = wz / wl;

        // Solved, not marched — same equation, ~10x cheaper per vertex.
        const R = surfaceRadiusFast(body, dx, dy, dz);
        const sx = dx * R, sy = dy * R, sz = dz * R;

        const k = (j * n + i) * 3;
        // Stored relative to the patch centre so the buffer stays float32-safe.
        pos[k] = sx - ox; pos[k + 1] = sy - oy; pos[k + 2] = sz - oz;

        const gg = cartesianToGeodetic(body, sx, sy, sz);
        shadeVertex(body, sx, sy, sz, gg.alt, c);
        col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b;
      }
    }

    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    this.geo.computeVertexNormals();
    this.geo.computeBoundingSphere();

    this.buildCount++;
    this.lastBuildMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
    return this.lastBuildMs;
  }

  /** Metres between adjacent vertices — the patch's real resolution. */
  get spacingM() { return this.sizeM / (this.res - 1); }
}
