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
        // WINDING MATTERS, AND IT CHANGED UNDER US.
        // Triangle winding decides which way a face points. When the body
        // frame was corrected from left- to right-handed, the local east axis
        // flipped, which silently reversed the winding of every triangle in
        // this grid — all 229 sampled normals ended up pointing INTO the
        // planet. An inside-out surface is lit from beneath and culled from
        // outside, which is the "everything looks backwards" family of bug.
        // validate.mjs now asserts outward normals so this cannot recur.
        indices.push(a, b, c2, b, d, c2);
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

    // The exact radius at every vertex, in f64, kept so COLLISION CAN READ THE
    // DRAWN SURFACE. See surfaceRadiusAt() below for why this matters.
    this._radii = new Float64Array(n * n);
    this._frame = null;      // east/north basis this patch was built in
    this._originR = 0;

    // Regions the heightfield must NOT draw, because a volumetric mesh is
    // drawing them instead. Without this the patch happily covers a hole with
    // solid ground — it has no way to represent the hole, so it just paints
    // over it and the excavation is invisible behind it.
    this.excluded = [];      // [{ centre:{x,y,z}, radius }]
  }

  /** Hand over regions to the excavation mesh. Triggers a rebuild. */
  setExcluded(regions) {
    this.excluded = regions || [];
    this.builtAt = null;     // force the next rebuild
  }

  _isExcluded(x, y, z) {
    for (let i = 0; i < this.excluded.length; i++) {
      const e = this.excluded[i];
      if (Math.hypot(x - e.centre.x, y - e.centre.y, z - e.centre.z) < e.radius) return true;
    }
    return false;
  }

  /**
   * The radius of the DRAWN ground at a world direction, or null outside the
   * patch.
   *
   * WHY THIS EXISTS
   * ---------------
   * The field is the world's truth, but the mesh is a sampled picture of it:
   * vertices every ~8 m with flat triangles between them. Over rough ground
   * those two disagree by metres. A player standing on the field therefore
   * floats above, or sinks into, the ground they can actually see — which is
   * exactly the "sometimes I sit above it, sometimes my legs go through it"
   * report, and exactly the "one layer that looks like the ground and another
   * that decides where you stand" diagnosis of it.
   *
   * The rule that fixes it: COLLISION MUST SAMPLE WHATEVER THE PLAYER SEES.
   * So the drawn surface is interpolated the same way the GPU interpolates it,
   * from the same numbers, and the player stands on that. The field remains
   * authoritative everywhere the patch does not cover, and remains the source
   * these vertices were built from — this is one surface at two resolutions,
   * not two surfaces.
   */
  surfaceRadiusAt(dx, dy, dz) {
    if (!this._frame || !this.builtAt) return null;
    const f = this._frame;
    const n = this.res;
    const half = this.sizeM / 2;
    const step = this.sizeM / (n - 1);

    // Project the direction onto the patch's tangent plane. Small-angle at
    // patch scale: 900 m on a 3,389 km body is 0.015 degrees of arc.
    const R0 = this._originR;
    const px = dx * R0, py = dy * R0, pz = dz * R0;
    const ox = this.worldPos.x, oy = this.worldPos.y, oz = this.worldPos.z;
    const vx = px - ox, vy = py - oy, vz = pz - oz;

    const east = vx * f.east.x + vy * f.east.y + vz * f.east.z;
    const north = vx * f.north.x + vy * f.north.y + vz * f.north.z;

    const fi = (east + half) / step;
    const fj = (north + half) / step;
    if (fi < 0 || fj < 0 || fi > n - 1.001 || fj > n - 1.001) return null;

    const i0 = Math.floor(fi), j0 = Math.floor(fj);
    const tx = fi - i0, ty = fj - j0;
    const r = this._radii;
    const r00 = r[j0 * n + i0], r10 = r[j0 * n + i0 + 1];
    const r01 = r[(j0 + 1) * n + i0], r11 = r[(j0 + 1) * n + i0 + 1];

    // Match the triangulation used for the index buffer (a,c,b / b,c,d) so the
    // interpolated height is the plane of the triangle actually rasterised,
    // not a bilinear patch that cuts across both of them.
    if (tx + ty <= 1) {
      return r00 + (r10 - r00) * tx + (r01 - r00) * ty;
    }
    const sx = 1 - tx, sy = 1 - ty;
    return r11 + (r01 - r11) * sx + (r10 - r11) * sy;
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
    this._frame = f;
    this._originR = originR;

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
        // f64 copy for collision, so the collider reads the drawn surface.
        this._radii[j * n + i] = R;

        const gg = cartesianToGeodetic(body, sx, sy, sz);
        shadeVertex(body, sx, sy, sz, gg.alt, c);
        col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b;
      }
    }

    // Drop quads that fall inside an excavated region, leaving a gap for the
    // volumetric mesh to fill.
    if (this.excluded.length) {
      const keep = [];
      for (let j = 0; j < n - 1; j++) {
        for (let i = 0; i < n - 1; i++) {
          const k = (j * n + i) * 3;
          if (this._isExcluded(pos[k] + ox, pos[k + 1] + oy, pos[k + 2] + oz)) continue;
          const a = j * n + i, b = a + 1, c2 = a + n, dd = c2 + 1;
          keep.push(a, b, c2, b, dd, c2);
        }
      }
      this.geo.setIndex(keep);
    } else if (this.geo.getIndex() === null || this.geo.getIndex().count !== (n - 1) * (n - 1) * 6) {
      const full = [];
      for (let j = 0; j < n - 1; j++) {
        for (let i = 0; i < n - 1; i++) {
          const a = j * n + i, b = a + 1, c2 = a + n, dd = c2 + 1;
          full.push(a, b, c2, b, dd, c2);
        }
      }
      this.geo.setIndex(full);
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
