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
import { installRegolith, mod360 } from './regolith.js';
import { surfaceRadiusAlong, surfaceRadiusFast, materialAt, elevationAt, MATERIALS } from './field.js';
import { localFrame, geodeticToCartesian, cartesianToGeodetic } from './geodesy.js';

// Fill the 440 m -> 166 km gap without spending phone triangles on the whole planet.
// All tiers sample the same original field, including planetary curvature; no relief exaggeration.
export const DISTANT_TIERS = {
  low: [{ sizeM: 8000, res: 65, skirtM: 80 }, { sizeM: 64000, res: 65, skirtM: 300 }, { sizeM: 320000, res: 49, skirtM: 1400 }],
  high: [{ sizeM: 8000, res: 97, skirtM: 80 }, { sizeM: 64000, res: 97, skirtM: 300 }, { sizeM: 320000, res: 65, skirtM: 1400 }],
};
export const TERRAIN_FOG_DENSITY = 0.000012;

/** Per-pixel handover: a coarse triangle must never cover finer relief inside its square. */
export function installTierDiscard(material) {
  const uniforms = {
    uTierOffset: { value: new THREE.Vector3() }, uTierEast: { value: new THREE.Vector3() },
    uTierNorth: { value: new THREE.Vector3() }, uTierHalf: { value: 0 },
    uTierUp: { value: new THREE.Vector3() }, uTierPlane: { value: new THREE.Vector3() },
  };
  const prior = material.onBeforeCompile, priorKey = material.customProgramCacheKey();
  material.onBeforeCompile = function(shader, renderer) {
    prior.call(this, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vTierPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTierPos = position;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vTierPos;
uniform vec3 uTierOffset, uTierEast, uTierNorth;
uniform vec3 uTierUp, uTierPlane;
uniform float uTierHalf;`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
vec3 tp = vTierPos + uTierOffset;
float ts = uTierPlane.z / (uTierPlane.z + dot(tp, uTierUp));
float te = (dot(tp, uTierEast) + uTierPlane.x) * ts - uTierPlane.x;
float tn = (dot(tp, uTierNorth) + uTierPlane.y) * ts - uTierPlane.y;
if (abs(te) < uTierHalf && abs(tn) < uTierHalf) discard;`);
  };
  material.customProgramCacheKey = () => `${priorKey}:tier-square-v1`;
  material.needsUpdate = true;
  return { uniforms, update(coarseOrigin, fine) {
    if (!fine.builtAt) { uniforms.uTierHalf.value = 0; return; }
    uniforms.uTierOffset.value.set(coarseOrigin.x - fine.worldPos.x, coarseOrigin.y - fine.worldPos.y, coarseOrigin.z - fine.worldPos.z);
    uniforms.uTierEast.value.copy(fine._frame.east);
    uniforms.uTierNorth.value.copy(fine._frame.north);
    uniforms.uTierUp.value.copy(fine._frame.up);
    const o = new THREE.Vector3().copy(fine.worldPos);
    uniforms.uTierPlane.value.set(o.dot(uniforms.uTierEast.value), o.dot(uniforms.uTierNorth.value), o.dot(uniforms.uTierUp.value));
    // A narrow overlap covered by the finer tier's skirt seals interpolation differences at the seam.
    uniforms.uTierHalf.value = fine.sizeM / 2 - Math.min(2, fine.spacingM * 0.1);
  } };
}

// ---------------------------------------------------------------------------
// Colour ramp from real material, not from an arbitrary palette. Each vertex
// asks the field what it is made of and takes that material's colour, so the
// ground is coloured by its geology.
// ---------------------------------------------------------------------------
const _basalt = new THREE.Color(0x4a3029), _dustBright = new THREE.Color(0xd7a06c), _ice = new THREE.Color(0xe6e2dc);
const _scoured = new THREE.Color(0x8a6048), _dusty = new THREE.Color(0xc27a4a);   // allocated once: this runs per vertex
export function shadeVertex(body, px, py, pz, elevation, color, matKnown) {
  const mat = matKnown || materialAt(body, px, py, pz);
  color.setHex(mat.color);
  if (body.kind === 'moon') {
    // A moon's ground is its own material's colour with broad patches of lighter and darker dust. (The planet's rust and
    // dust tints below are Mars's.)
    const k = 0.84 + 0.30 * (0.5 + 0.5 * Math.sin(px * 0.0023 + py * 0.0017) * Math.sin(pz * 0.0021 + px * 0.0009 + 1.3));
    const f = 0.9 + 0.2 * (0.5 + 0.5 * Math.sin(px * 0.071 + pz * 0.053) * Math.sin(py * 0.067 + px * 0.041));
    return color.multiplyScalar(k * f);
  }

  // Planet-scale albedo, seen from orbit: dark basaltic provinces, bright dust, and the polar caps. The waves are thousands
  // of kilometres long, so walking-scale ground barely changes; Mars from 400 km stops being one flat orange.
  if (body.id === 'mars') {
    const r = Math.hypot(px, py, pz) || 1, x = px / r, y = py / r, z = pz / r;
    const n1 = Math.sin(x * 3.1 + 1.2) * Math.sin(y * 2.6 + 0.4) * Math.sin(z * 3.7 + 2.0);
    const n2 = Math.sin(x * 7.3 + y * 5.1 + 0.7) * Math.sin(z * 6.1 - x * 4.4 + 1.9);
    const n3 = Math.sin(x * 15.0 + z * 11.0 + 0.3) * Math.sin(y * 13.0 - z * 9.0 + 2.2);
    const dark = Math.max(0, Math.min(1, (n1 * 0.9 + n2 * 0.45 + n3 * 0.25 - 0.05) * 1.6));
    const bright = Math.max(0, Math.min(1, (-n1 * 0.7 - n2 * 0.3 + 0.1) * 1.4));
    color.lerp(_basalt, dark * 0.58).lerp(_dustBright, bright * 0.34);
    const cap = Math.max(0, Math.min(1, (Math.abs(y) + 0.012 * n2 + 0.008 * n3 - 0.962) / 0.02));
    if (cap > 0) color.lerp(_ice, cap * 0.92);
  }
  // Elevation banding: dust settles in the lows, wind strips the highs.
  const t = body.terrain;
  const n = Math.max(-1, Math.min(1, elevation / (t.localRelief * 2.2)));
  if (n > 0) color.lerp(_scoured, n * 0.35);   // scoured highland
  else color.lerp(_dusty, -n * 0.30);          // dust-filled basin
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
    this.skirtM = opts.skirtM || 0;
    this.rebuildThreshold = this.sizeM * 0.28; // rebuild before the edge shows
    this.centre = null;                        // {lat, lon}
    this.builtAt = null;                       // cartesian centre of last build
    this.buildCount = 0;
    this.lastBuildMs = 0;

    const n = this.res;
    this._edge = [];
    if (this.skirtM) {
      for (let i = 0; i < n - 1; i++) this._edge.push(i);
      for (let j = 0; j < n - 1; j++) this._edge.push(j * n + n - 1);
      for (let i = n - 1; i > 0; i--) this._edge.push((n - 1) * n + i);
      for (let j = n - 1; j > 0; j--) this._edge.push(j * n);
    }
    const verts = new Float32Array((n * n + this._edge.length) * 3);
    const colors = new Float32Array(verts.length);
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
    // dust, grit, pebbles and bumps at walking scale (regolith.js) - pinned to world position
    this._regolith = installRegolith(this.mesh.material, THREE);
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
  setExcluded(regions, rebuildNow = false) {
    this.excluded = regions || [];
    if (rebuildNow) this.builtAt = null;     // legacy: force the next full rebuild
    else this.reindex();
  }

  /**
   * True where this patch has handed the ground to another mesh and is drawing
   * nothing. Collision asks THIS rather than re-deriving the shape, because a
   * second copy of the rule is a second chance for the ground you stand on to
   * disagree with the ground you can see.
   */
  handedOver(x, y, z) { return this._isExcluded(x, y, z); }

  /**
   * Two shapes of handed-over region, and the difference matters.
   *
   * `radius`   — a sphere. Fine for handing the mid patch's ground to the near
   *              patch, where the region is far larger than either grid.
   * `halfSideM`— a SQUARE laid flat on the ground, in this patch's own tangent
   *              frame, so its edges run along the quad grid. A region only a
   *              few quads across has to be this shape: a circle's overlap with
   *              the grid depends on where it falls, and a 3 mm difference in
   *              phase decided between yielding a quad and yielding nothing.
   *              Height is deliberately ignored — a heightfield column either
   *              yields or it does not.
   */
  _isExcluded(x, y, z) {
    for (let i = 0; i < this.excluded.length; i++) {
      const e = this.excluded[i];
      const dx = x - e.centre.x, dy = y - e.centre.y, dz = z - e.centre.z;
      if (e.halfSideM !== undefined) {
        const f = this._frame;
        if (!f) continue;
        const east = dx * f.east.x + dy * f.east.y + dz * f.east.z;
        const north = dx * f.north.x + dy * f.north.y + dz * f.north.z;
        if (Math.abs(east) <= e.halfSideM && Math.abs(north) <= e.halfSideM) return true;
      } else if (Math.hypot(dx, dy, dz) < e.radius) return true;
    }
    return false;
  }

  /**
   * Drop a quad only when ALL FOUR of its corners are inside the handed-over
   * region.
   *
   * WHICH WAY TO BE WRONG. A quad is 0.6 m across and the region is a smooth
   * shape, so they never line up; the rule has to choose which error to make.
   * Testing one corner (or any corner) stops drawing MORE ground than the other
   * mesh covers, and the difference is a strip where nothing is drawn at all —
   * you look through the planet. Testing all four stops drawing LESS, and the
   * difference is a strip drawn twice, which is a depth-test question the
   * excavation material settles with a polygon offset. A seam you can see
   * through is a hole; a seam drawn twice is a bias. Take the bias.
   */
  _quadExcluded(pos, ox, oy, oz, n, i, j) {
    for (let dj = 0; dj <= 1; dj++) {
      for (let di = 0; di <= 1; di++) {
        const k = ((j + dj) * n + (i + di)) * 3;
        if (!this._isExcluded(pos[k] + ox, pos[k + 1] + oy, pos[k + 2] + oz)) return false;
      }
    }
    return true;
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

  /** Radial ray / drawn-triangle intersection, including curvature. Used to join distant tiers. */
  surfaceRadiusExact(dx, dy, dz) {
    if (!this.builtAt) return null;
    const f = this._frame, o = this.worldPos, n = this.res, step = this.spacingM;
    // Intersect the ORIGINAL tangent plane to recover the grid coordinates exactly.
    const q = (o.x * f.up.x + o.y * f.up.y + o.z * f.up.z) / (dx * f.up.x + dy * f.up.y + dz * f.up.z);
    const x = dx * q - o.x, y = dy * q - o.y, z = dz * q - o.z;
    const fi = (x * f.east.x + y * f.east.y + z * f.east.z + this.sizeM / 2) / step;
    const fj = (x * f.north.x + y * f.north.y + z * f.north.z + this.sizeM / 2) / step;
    if (fi < 0 || fj < 0 || fi >= n - 1 || fj >= n - 1) return null;
    const i = Math.floor(fi), j = Math.floor(fj), a = j * n + i, pos = this.geo.attributes.position.array;
    const ids = fi - i + fj - j <= 1 ? [a, a + 1, a + n] : [a + 1, a + n + 1, a + n];
    const [A, B, C] = ids.map(v => v * 3);
    const ux = pos[B] - pos[A], uy = pos[B + 1] - pos[A + 1], uz = pos[B + 2] - pos[A + 2];
    const vx = pos[C] - pos[A], vy = pos[C + 1] - pos[A + 1], vz = pos[C + 2] - pos[A + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    return (nx * (pos[A] + o.x) + ny * (pos[A + 1] + o.y) + nz * (pos[A + 2] + o.z)) / (nx * dx + ny * dy + nz * dz);
  }

  /** Morph the outer two rows into the actual coarser triangles, sealing LOD height discontinuities. */
  blendEdgeTo(coarse) {
    if (!this.builtAt || !coarse.builtAt) return;
    const signature = `${this.buildCount}/${coarse.buildCount}/${coarse._blendSignature || ''}`;
    if (this._blendSignature === signature) return;
    if (this._baseBuild !== this.buildCount) {
      this._baseBuild = this.buildCount;
      this._basePos = this.geo.attributes.position.array.slice();
      this._baseRadii = this._radii.slice();
    }
    const pos = this.geo.attributes.position.array, base = this._basePos, n = this.res, o = this.worldPos;
    pos.set(base); this._radii.set(this._baseRadii);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const edge = Math.min(i, j, n - 1 - i, n - 1 - j);
      if (edge >= 2) continue;
      const v = j * n + i, k = v * 3;
      const x = base[k] + o.x, y = base[k + 1] + o.y, z = base[k + 2] + o.z, l = Math.hypot(x, y, z);
      const r = coarse.surfaceRadiusExact(x / l, y / l, z / l);
      if (r === null) continue;
      const t = 1 - edge / 2, weight = t * t * (3 - 2 * t), nr = l + (r - l) * weight;
      pos[k] = x / l * nr - o.x; pos[k + 1] = y / l * nr - o.y; pos[k + 2] = z / l * nr - o.z;
      this._radii[v] = nr;
    }
    for (let e = 0; e < this._edge.length; e++) {
      const k = this._edge[e] * 3, q = (n * n + e) * 3;
      const x = pos[k] + o.x, y = pos[k + 1] + o.y, z = pos[k + 2] + o.z, l = Math.hypot(x, y, z);
      pos[q] = pos[k] - x / l * this.skirtM; pos[q + 1] = pos[k + 1] - y / l * this.skirtM; pos[q + 2] = pos[k + 2] - z / l * this.skirtM;
    }
    this.geo.attributes.position.needsUpdate = true;
    this._computeNormals(); this.geo.computeBoundingSphere();
    this._blendSignature = signature;
  }

  /** Does the player need a fresh patch? */
  needsRebuild(px, py, pz) {
    if (!this.builtAt) return true;
    const dx = px - this.builtAt.x, dy = py - this.builtAt.y, dz = pz - this.builtAt.z;
    // Climbing above the same ground does not change its samples. Only travel along
    // the surface should spend the phone's rebuild budget.
    if (this._frame) {
      const f = this._frame;
      return Math.hypot(dx * f.east.x + dy * f.east.y + dz * f.east.z,
        dx * f.north.x + dy * f.north.y + dz * f.north.z) > this.rebuildThreshold;
    }
    return Math.hypot(dx, dy, dz) > this.rebuildThreshold;
  }

  /**
   * Rebuild around a world position. Every vertex ray-marches the field, so
   * the patch is the field's own opinion of the ground at metre resolution.
   */
  rebuild(px, py, pz) {
    this.beginRebuild(px, py, pz);
    this.stepRebuild(Infinity);
    return this.lastBuildMs;
  }

  /**
   * Rebuild in slices. Sampling the field under every vertex is the cost (about 100 ms for the wide
   * tier on a desktop, several times that on a phone). A walker would feel that as a freeze every time
   * he crossed half a kilometre, so the work is spread over frames: begin, then step a couple of
   * milliseconds per frame until it says done. The old surface stays drawn, and stays the one the feet
   * stand on, until the new one is complete; then the two are swapped in one move.
   */
  beginRebuild(px, py, pz) {
    const body = this.body, n = this.res;
    const g = cartesianToGeodetic(body, px, py, pz);
    const f = localFrame(g.lat, g.lon);
    const l = Math.hypot(px, py, pz);
    const originR = surfaceRadiusFast(body, px / l, py / l, pz / l, 4, { ignoreEdits: true });
    this._job = {
      px, py, pz, g, f, originR, row: 0,
      ox: (px / l) * originR, oy: (py / l) * originR, oz: (pz / l) * originR,
      pos: new Float32Array(this.geo.attributes.position.array.length), col: new Float32Array(this.geo.attributes.color.array.length), radii: new Float64Array(n * n),
      t0: (typeof performance !== 'undefined' ? performance.now() : Date.now()), spent: 0,
      color: new THREE.Color(),
    };
    return this._job;
  }

  get rebuilding() { return !!this._job; }

  /** Sample rows for up to `budgetMs`. Returns true when the whole patch is built and swapped in. */
  stepRebuild(budgetMs) {
    const job = this._job;
    if (!job) return true;
    const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const t0 = now();
    const body = this.body, n = this.res, half = this.sizeM / 2, stepM = this.sizeM / (n - 1);
    const { f, ox, oy, oz, pos, col, radii, color } = job;
    while (job.row < n) {
      const j = job.row++;
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
        // The heightfield draws the ORIGINAL geology. Whatever has been dug or dumped is drawn
        // by the brick meshes (excavation.js), which this tier is told to discard under; letting
        // the heightfield also "see" an edit just puts a coarse lid over the hole.
        const R = surfaceRadiusFast(body, dx, dy, dz, 3, { ignoreEdits: true });
        const sx = dx * R, sy = dy * R, sz = dz * R;

        const k = (j * n + i) * 3;
        // Stored relative to the patch centre so the buffer stays float32-safe.
        pos[k] = sx - ox; pos[k + 1] = sy - oy; pos[k + 2] = sz - oz;
        // f64 copy for collision, so the collider reads the drawn surface.
        radii[j * n + i] = R;

        const gg = cartesianToGeodetic(body, sx, sy, sz);
        shadeVertex(body, sx, sy, sz, gg.alt, color);
        col[k] = color.r; col[k + 1] = color.g; col[k + 2] = color.b;
      }
      if (now() - t0 >= budgetMs) break;
    }
    job.spent += now() - t0;
    if (job.row < n) return false;

    for (let e = 0; e < this._edge.length; e++) {
      const k = this._edge[e] * 3, q = (n * n + e) * 3;
      const x = pos[k] + ox, y = pos[k + 1] + oy, z = pos[k + 2] + oz, l = Math.hypot(x, y, z);
      pos[q] = pos[k] - x / l * this.skirtM;
      pos[q + 1] = pos[k + 1] - y / l * this.skirtM;
      pos[q + 2] = pos[k + 2] - z / l * this.skirtM;
      col[q] = col[k]; col[q + 1] = col[k + 1]; col[q + 2] = col[k + 2];
    }

    // Done: swap the new surface in, all at once.
    this.centre = { lat: job.g.lat, lon: job.g.lon };
    this.worldPos = { x: ox, y: oy, z: oz };
    if (this._regolith) this._regolith.uRegOffset.value.set(mod360(ox), mod360(oy), mod360(oz));
    this.builtAt = { x: job.px, y: job.py, z: job.pz };
    this._frame = f;
    this._originR = job.originR;
    this.geo.attributes.position.array.set(pos);
    this.geo.attributes.color.array.set(col);
    this._radii.set(radii);
    this._reindexFrom(this.geo.attributes.position.array, ox, oy, oz);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    this._computeNormals();
    this.geo.computeBoundingSphere();
    this.buildCount++;
    this.lastBuildMs = job.spent;
    this._job = null;
    return true;
  }

  _computeNormals() {
    const n = this.res;
    this.geo.computeVertexNormals();
    // Skirts seal the edge but must not bend the terrain's lighting toward a vertical wall.
    if (this._edge.length) {
      const all = this.geo.index.array.slice(), coreCount = all.length - this._edge.length * 6;
      this.geo.setIndex(Array.from(all.subarray(0, coreCount)));
      this.geo.computeVertexNormals();
      const normals = this.geo.attributes.normal.array;
      for (let e = 0; e < this._edge.length; e++) {
        const k = this._edge[e] * 3, q = (n * n + e) * 3;
        normals[q] = normals[k]; normals[q + 1] = normals[k + 1]; normals[q + 2] = normals[k + 2];
      }
      this.geo.setIndex(Array.from(all));
    }
  }

  /**
   * Which quads to draw. A quad is dropped only when all four corners are inside a
   * region handed to a finer tier. Cheap (no field sampling): the vertices are kept.
   */
  _reindexFrom(pos, ox, oy, oz) {
    const n = this.res;
    if (this.excluded.length) {
      const keep = [];
      for (let j = 0; j < n - 1; j++) {
        for (let i = 0; i < n - 1; i++) {
          if (this._quadExcluded(pos, ox, oy, oz, n, i, j)) continue;
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
    if (this._edge.length) {
      const idx = Array.from(this.geo.index.array), m = this._edge.length;
      for (let e = 0; e < m; e++) {
        const next = (e + 1) % m, a = this._edge[e], b = this._edge[next], c = n * n + e, d = n * n + next;
        idx.push(a, c, b, b, c, d);
      }
      this.geo.setIndex(idx);
    }
  }

  /** Re-cut the excluded regions without re-sampling the ground. */
  reindex() {
    if (!this.builtAt) return;
    this._reindexFrom(this.geo.attributes.position.array, this.worldPos.x, this.worldPos.y, this.worldPos.z);
  }

  /** Metres between adjacent vertices — the patch's real resolution. */
  get spacingM() { return this.sizeM / (this.res - 1); }
}
