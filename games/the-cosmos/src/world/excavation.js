// ============================================================================
// excavation.js — drawing the ground somebody has changed.
//
// OWNS: turning the edit lattice (edits.js) into triangles, brick by brick, and
//       telling the coarser ground meshes where to stop drawing.
// DOES NOT OWN: the lattice (edits.js), the undisturbed geology (field.js), or
//       the heightfield tiers (planetMesh.js). It draws what the field says.
//
// WHAT WAS WRONG BEFORE (found by walking it, 2026-10-01)
// -------------------------------------------------------
// One mesh covered a box around EVERY edit ever made, so two digs 40 m apart
// made a 40 m box meshed at 0.8 m cells; the box had open sides (you looked
// through the planet at its edge); the heightfields could only yield in whole
// quads, so a hole narrower than a quad was covered by the quad ("the hole gets
// covered over again by this layer") or left a ring of nothing; and the mid-
// distance patch yielded around the NEAR patch, not around the dig, so walking
// away and back put the coarse ground over the hole.
//
// HOW IT WORKS NOW
// ----------------
//  * One mesh per 3.2 m brick that has ever been touched, built from that
//    brick's lattice with naive surface nets. Bricks are watertight with each
//    other: every quad belongs to exactly one brick (the one holding the lower
//    end of the edge it crosses) and cell vertices depend only on the cell's
//    own eight corners, so neighbours put their vertices in the same places.
//    Normals come from the lattice gradient, so they agree across seams too.
//  * The mesh is the lattice and the lattice is the field. There is no second
//    opinion about where the surface is.
//  * The heightfield tiers do not look at edits at all (they draw the original
//    geology) and are told, per pixel, to discard anywhere a built brick covers
//    them (a 3-D occupancy texture the shader reads). The discard stops 0.15 m
//    short of a face that borders ground nobody touched, so the two meshes
//    overlap by a hand's width there and no crack can open between them.
//  * Work is spread over frames: one brick at a time, nearest to the player
//    first, with a time budget.
// ============================================================================

import * as THREE from 'three';
import { BRICK_N, BRICK_M, CELL_M } from './edits.js';
import { materialAt, baseDensityAt } from './field.js';
import { cartesianToGeodetic } from './geodesy.js';
import { shadeVertex } from './planetMesh.js';
import { installRegolith } from './regolith.js';

const N = BRICK_N, S = N + 2, SS = S * S;
const H = CELL_M;

const EDGES = [
  [0, 1], [1, 3], [2, 3], [0, 2],
  [4, 5], [5, 7], [6, 7], [4, 6],
  [0, 4], [1, 5], [2, 6], [3, 7],
];
const CORNERS = [
  [0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0],
  [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1],
];

/**
 * Mesh one brick of the edit lattice. Pure: no THREE, no scene. Returns null if
 * the brick holds no surface.
 *
 * Positions are metres from the brick's own corner (so they stay float32-safe
 * 3,389 km from the planet's centre). `colorFn(wx,wy,wz,nx,ny,nz,out)` fills
 * out.r/g/b; world coordinates are f64.
 */
export function meshBrick(store, bx, by, bz, colorFn, opts = {}) {
  const vals = new Float32Array(S * S * S);
  const gi0 = bx * N - 1, gj0 = by * N - 1, gk0 = bz * N - 1;
  let mn = Infinity, mx = -Infinity, o = 0;
  for (let k = 0; k < S; k++) for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const v = store.getPoint(gi0 + i, gj0 + j, gk0 + k);
    vals[o++] = v;
    if (v < mn) mn = v; if (v > mx) mx = v;
  }
  if (mn >= 0 || mx <= 0) return null;                     // all air or all rock: no surface here

  const C = N + 1;                                         // cells per axis, including the one before the brick
  const cellVert = new Int32Array(C * C * C).fill(-1);
  const pos = [], nrm = [], col = [], worldPos = opts.keepWorld ? [] : null;
  const out = { r: 1, g: 1, b: 1 };
  const d = new Float32Array(8);
  const ox = bx * BRICK_M, oy = by * BRICK_M, oz = bz * BRICK_M;

  for (let ck = 0; ck < C; ck++) for (let cj = 0; cj < C; cj++) for (let ci = 0; ci < C; ci++) {
    const b0 = (ck * S + cj) * S + ci;
    d[0] = vals[b0]; d[1] = vals[b0 + 1]; d[2] = vals[b0 + S]; d[3] = vals[b0 + S + 1];
    d[4] = vals[b0 + SS]; d[5] = vals[b0 + SS + 1]; d[6] = vals[b0 + SS + S]; d[7] = vals[b0 + SS + S + 1];
    let mask = 0;
    for (let c = 0; c < 8; c++) if (d[c] < 0) mask |= 1 << c;
    if (mask === 0 || mask === 255) continue;

    let sx = 0, sy = 0, sz = 0, n = 0;
    for (let e = 0; e < 12; e++) {
      const a = EDGES[e][0], b = EDGES[e][1];
      const da = d[a], db = d[b];
      if ((da < 0) === (db < 0)) continue;
      const t = da / (da - db);
      const ca = CORNERS[a], cb = CORNERS[b];
      sx += ca[0] + (cb[0] - ca[0]) * t; sy += ca[1] + (cb[1] - ca[1]) * t; sz += ca[2] + (cb[2] - ca[2]) * t;
      n++;
    }
    // Global lattice coordinates first, in f64: a vertex shared by two bricks comes out bit-identical.
    const gx = (bx * N + ci - 1 + sx / n) * H, gy = (by * N + cj - 1 + sy / n) * H, gz = (bz * N + ck - 1 + sz / n) * H;
    const lx = gx - ox, ly = gy - oy, lz = gz - oz;

    // Normal: the field's gradient over this cell. Depends only on the cell's own
    // corners, so two bricks sharing a cell shade it identically.
    let gnx = (d[1] - d[0]) + (d[3] - d[2]) + (d[5] - d[4]) + (d[7] - d[6]);
    let gny = (d[2] - d[0]) + (d[3] - d[1]) + (d[6] - d[4]) + (d[7] - d[5]);
    let gnz = (d[4] - d[0]) + (d[5] - d[1]) + (d[6] - d[2]) + (d[7] - d[3]);
    const gl = Math.hypot(gnx, gny, gnz) || 1; gnx /= gl; gny /= gl; gnz /= gl;

    cellVert[(ck * C + cj) * C + ci] = pos.length / 3;
    pos.push(lx, ly, lz); nrm.push(gnx, gny, gnz);
    if (worldPos) worldPos.push(gx, gy, gz);
    colorFn(gx, gy, gz, gnx, gny, gnz, out);
    col.push(out.r, out.g, out.b);
  }
  if (!pos.length) return null;

  const idx = [];
  const quad = (a, b, c, e, flip) => {
    if (a < 0 || b < 0 || c < 0 || e < 0) return;
    if (flip) idx.push(a, c, b, a, e, c); else idx.push(a, b, c, a, c, e);
  };
  const cv = (i, j, k) => cellVert[(k * C + j) * C + i];
  // Every edge whose lower end lies in this brick (lattice slots 1..N of the block) is this
  // brick's to draw. Cell indices run one lower on each axis than the edge, which is why the
  // block carries a one-point skirt on the low side.
  for (let K = 1; K <= N; K++) for (let J = 1; J <= N; J++) for (let I = 1; I <= N; I++) {
    const here = vals[(K * S + J) * S + I] < 0;
    if ((vals[(K * S + J) * S + I + 1] < 0) !== here) {
      quad(cv(I, J - 1, K - 1), cv(I, J, K - 1), cv(I, J, K), cv(I, J - 1, K), !here);
    }
    if ((vals[(K * S + J + 1) * S + I] < 0) !== here) {
      quad(cv(I - 1, J, K - 1), cv(I, J, K - 1), cv(I, J, K), cv(I - 1, J, K), here);
    }
    if ((vals[((K + 1) * S + J) * S + I] < 0) !== here) {
      quad(cv(I - 1, J - 1, K), cv(I, J - 1, K), cv(I, J, K), cv(I - 1, J, K), !here);
    }
  }
  if (!idx.length) return null;
  return {
    positions: new Float32Array(pos), normals: new Float32Array(nrm), colors: new Float32Array(col),
    indices: pos.length / 3 > 65000 ? new Uint32Array(idx) : new Uint16Array(idx),
    origin: { x: ox, y: oy, z: oz },
    worldPositions: worldPos ? new Float64Array(worldPos) : null,
  };
}

// ---------------------------------------------------------------------------
// The occupancy texture the heightfield shaders read. One byte per brick:
//   bit 0  a built brick stands here (discard the heightfield)
//   bits 1-6  -x +x -y +y -z +z: the neighbour on that side is NOT built, so keep
//             the heightfield for the outer 0.15 m of that face (the overlap).
// ---------------------------------------------------------------------------
export const COVER_SIZE = 64;
export const COVER_SHRINK_M = 0.15;

export class CoverGrid {
  constructor({safe=false}={}) {
    this.safe=safe;this.size = COVER_SIZE;
    this.data = new Uint8Array(COVER_SIZE ** 3);
    this.atlas=safe?new Uint8Array(COVER_SIZE ** 3):null;
    this.tex = safe?new THREE.DataTexture(this.atlas,512,512):new THREE.Data3DTexture(this.data, COVER_SIZE, COVER_SIZE, COVER_SIZE);
    this.tex.format = safe?THREE.LuminanceFormat:THREE.RedFormat; this.tex.type = THREE.UnsignedByteType;
    this.tex.minFilter = THREE.NearestFilter; this.tex.magFilter = THREE.NearestFilter;
    this.tex.wrapS = this.tex.wrapT = this.tex.wrapR = THREE.ClampToEdgeWrapping;
    this.tex.unpackAlignment = 1;
    this.tex.needsUpdate = true;
    this.origin = { x: 0, y: 0, z: 0 };         // brick coordinates of texel (0,0,0)
    this.originWorld = { x: 0, y: 0, z: 0 };    // metres
    this.shared = {
      uCover: { value: this.tex },
      uCoverOn: { value: 0 },
      uCoverBrick: { value: BRICK_M },
      uCoverShrink: { value: COVER_SHRINK_M / BRICK_M },
    };
  }
  /** Rebuild the texture around a focus brick from the set of built bricks. */
  rebuild(focus, built) {
    const h = COVER_SIZE / 2;
    this.origin = { x: focus.bx - h, y: focus.by - h, z: focus.bz - h };
    this.originWorld = { x: this.origin.x * BRICK_M, y: this.origin.y * BRICK_M, z: this.origin.z * BRICK_M };
    this.data.fill(0);
    const at = (a, b, c) => {
      const x = a - this.origin.x, y = b - this.origin.y, z = c - this.origin.z;
      if (x < 0 || y < 0 || z < 0 || x >= COVER_SIZE || y >= COVER_SIZE || z >= COVER_SIZE) return -1;
      return (z * COVER_SIZE + y) * COVER_SIZE + x;
    };
    const has = new Set();
    for (const b of built.values()) has.add(`${b.bx},${b.by},${b.bz}`);
    let any = 0;
    for (const b of built.values()) {
      const i = at(b.bx, b.by, b.bz);
      if (i < 0) continue;
      let v = 1;
      if (!has.has(`${b.bx - 1},${b.by},${b.bz}`)) v |= 2;
      if (!has.has(`${b.bx + 1},${b.by},${b.bz}`)) v |= 4;
      if (!has.has(`${b.bx},${b.by - 1},${b.bz}`)) v |= 8;
      if (!has.has(`${b.bx},${b.by + 1},${b.bz}`)) v |= 16;
      if (!has.has(`${b.bx},${b.by},${b.bz - 1}`)) v |= 32;
      if (!has.has(`${b.bx},${b.by},${b.bz + 1}`)) v |= 64;
      this.data[i] = v; any++;
    }
    if(this.safe)for(let z=0;z<COVER_SIZE;z++)for(let y=0;y<COVER_SIZE;y++)for(let x=0;x<COVER_SIZE;x++)this.atlas[(Math.floor(z/8)*64+y)*512+(z%8)*64+x]=this.data[(z*64+y)*64+x];
    this.shared.uCoverOn.value = any ? 1 : 0;
    this.tex.needsUpdate = true;
  }
  /** CPU twin of the shader's test: is this ground covered (and so not drawn by a heightfield)? */
  covers(x, y, z) {
    const gx = x / BRICK_M - this.origin.x, gy = y / BRICK_M - this.origin.y, gz = z / BRICK_M - this.origin.z;
    if (gx < 0 || gy < 0 || gz < 0 || gx >= COVER_SIZE || gy >= COVER_SIZE || gz >= COVER_SIZE) return false;
    const v = this.data[(Math.floor(gz) * COVER_SIZE + Math.floor(gy)) * COVER_SIZE + Math.floor(gx)];
    if (!(v & 1)) return false;
    const m = COVER_SHRINK_M / BRICK_M;
    const fx = gx - Math.floor(gx), fy = gy - Math.floor(gy), fz = gz - Math.floor(gz);
    if (((v & 2) && fx < m) || ((v & 4) && fx > 1 - m) || ((v & 8) && fy < m) ||
        ((v & 16) && fy > 1 - m) || ((v & 32) && fz < m) || ((v & 64) && fz > 1 - m)) return false;
    return true;
  }
}

/**
 * Teach a heightfield material to discard what the brick meshes cover. Wraps any
 * onBeforeCompile already on the material (the regolith detail).
 * `offset` is a { value: Vector3 } holding (this mesh's world position) - (the
 * occupancy window's world origin), refreshed each frame by the owner.
 */
export function installCoverDiscard(material, grid, offset, THREE_) {
  material.userData.safeCover = {grid,offset};
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    if (prev) prev(shader, renderer);
    Object.assign(shader.uniforms, grid.shared, { uCoverOffset: offset });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uCoverOffset;\nvarying vec3 vCoverPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCoverPos = position + uCoverOffset;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform highp sampler3D uCover;
uniform float uCoverOn;
uniform float uCoverBrick;
uniform float uCoverShrink;
varying vec3 vCoverPos;`)
      .replace('void main() {', `void main() {
  if (uCoverOn > 0.5) {
    vec3 cg = vCoverPos / uCoverBrick;
    if (cg.x >= 0.0 && cg.y >= 0.0 && cg.z >= 0.0 && cg.x < ${COVER_SIZE}.0 && cg.y < ${COVER_SIZE}.0 && cg.z < ${COVER_SIZE}.0) {
      int cv = int(texture(uCover, cg / ${COVER_SIZE}.0).r * 255.0 + 0.5);
      if ((cv & 1) != 0) {
        vec3 cf = fract(cg);
        bool keep = (((cv & 2) != 0) && cf.x < uCoverShrink) || (((cv & 4) != 0) && cf.x > 1.0 - uCoverShrink) ||
                    (((cv & 8) != 0) && cf.y < uCoverShrink) || (((cv & 16) != 0) && cf.y > 1.0 - uCoverShrink) ||
                    (((cv & 32) != 0) && cf.z < uCoverShrink) || (((cv & 64) != 0) && cf.z > 1.0 - uCoverShrink);
        if (!keep) discard;
      }
    }
  }`);
  };
  const key = material.customProgramCacheKey ? material.customProgramCacheKey() : '';
  material.customProgramCacheKey = () => key + '+cover-v1';
  material.needsUpdate = true;
}

// ---------------------------------------------------------------------------
// The scene side: one THREE.Mesh per built brick.
// ---------------------------------------------------------------------------
export class EditedTerrain {
  /**
   * @param opts.rangeM    bricks farther than this from the focus are not drawn
   * @param opts.budgetMs  milliseconds of meshing per frame (at least one brick always gets built)
   */
  constructor(engine, body, store, opts = {}) {
    this.engine = engine; this.body = body; this.store = store;
    this.rangeM = opts.rangeM || 80;
    this.budgetMs = opts.budgetMs || 5;
    this.meshes = new Map();               // key -> { mesh, entry, bx, by, bz }
    this.pending = new Map();              // key -> { bx, by, bz }
    this.coverDirty = true;
    this.cover = new CoverGrid({safe:!!engine.safe});
    this.focus = { bx: 0, by: 0, bz: 0 };
    this.lastBuildMs = 0; this.builtCount = 0; this.triangles = 0;
    this.material = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.95, metalness: 0,
      // The brick wins wherever it overlaps the heightfield (the 0.15 m band, or the
      // tier's own sag between its vertices).
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8,
    });
    this._reg = installRegolith(this.material, THREE, { world: true });
    this._tmpColor = new THREE.Color();
    this._camMod = { x: 0, y: 0, z: 0 };
  }

  /** Collision's question: has this ground been changed? (True the moment it is, drawn or not.) */
  touchedAt(x, y, z) {
    if (this.store.isEmpty) return false;
    const [bx, by, bz] = this.store.brickCoord(x, y, z);
    return this.store.touched.has(this.store.keyOf(bx, by, bz));
  }

  _color(wx, wy, wz, nx, ny, nz, out) {
    const body = this.body;
    const mat = materialAt(body, wx, wy, wz);
    const c = this._tmpColor;
    const g = cartesianToGeodetic(body, wx, wy, wz);
    shadeVertex(body, wx, wy, wz, g.alt, c, mat);
    // Dug faces are fresh, not weathered, and the deeper a cut goes the less light reaches it.
    const depth = Math.max(0, -baseDensityAt(body, wx, wy, wz));
    const ux = wx, uy = wy, uz = wz, ul = Math.hypot(ux, uy, uz) || 1;
    const wall = 1 - Math.abs((nx * ux + ny * uy + nz * uz) / ul);          // 0 on flat ground, 1 on a vertical face
    const dark = Math.max(0.7, 1 - 0.08 * Math.min(depth, 3.5)) * (1 - 0.06 * wall);
    out.r = c.r * dark; out.g = c.g * dark; out.b = c.b * dark;
  }

  _buildOne(key, rec) {
    const t0 = performance.now();
    const m = meshBrick(this.store, rec.bx, rec.by, rec.bz, (a, b, c, d, e, f, o) => this._color(a, b, c, d, e, f, o));
    let have = this.meshes.get(key);
    if (!m) {
      if (have) this._drop(key);
      return performance.now() - t0;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(m.positions, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(m.normals, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(m.colors, 3));
    geo.setIndex(new THREE.BufferAttribute(m.indices, 1));
    geo.computeBoundingSphere();
    if (have) {
      have.mesh.geometry.dispose();
      have.mesh.geometry = geo;
    } else {
      const mesh = new THREE.Mesh(geo, this.material);
      mesh.name = `edit-brick:${rec.bx},${rec.by},${rec.bz}`;
      mesh.castShadow = true; mesh.receiveShadow = true;
      this.engine.scene.add(mesh);
      const entry = this.engine.track({ worldPos: m.origin, object3d: mesh });
      have = { mesh, entry, bx: rec.bx, by: rec.by, bz: rec.bz };
      this.meshes.set(key, have);
      this.coverDirty = true;
    }
    this.triangles = 0;
    for (const v of this.meshes.values()) this.triangles += v.mesh.geometry.index.count / 3;
    this.builtCount++;
    return performance.now() - t0;
  }

  _drop(key) {
    const have = this.meshes.get(key);
    if (!have) return;
    this.engine.scene.remove(have.mesh);
    this.engine.untrack(have.entry);
    have.mesh.geometry.dispose();
    this.meshes.delete(key);
    this.coverDirty = true;
  }

  /** Per frame. `focus` is the player's (or ship's) f64 world position. */
  update(dt, focus) {
    const store = this.store;
    const [fbx, fby, fbz] = store.brickCoord(focus.x, focus.y, focus.z);
    this.focus = { bx: fbx, by: fby, bz: fbz };

    for (const key of store.consumeDirty()) {
      const t = store.touched.get(key);
      if (t) this.pending.set(key, t);
    }

    // Build, nearest first, inside the frame budget.
    if (this.pending.size) {
      const ranked = [];
      for (const [key, t] of this.pending) {
        const cx = (t.bx + 0.5) * BRICK_M - focus.x, cy = (t.by + 0.5) * BRICK_M - focus.y, cz = (t.bz + 0.5) * BRICK_M - focus.z;
        const dist = Math.hypot(cx, cy, cz);
        if (dist > this.rangeM) continue;
        ranked.push([dist, key, t]);
      }
      ranked.sort((a, b) => a[0] - b[0]);
      let spent = 0;
      for (const [, key, t] of ranked) {
        spent += this._buildOne(key, t);
        this.pending.delete(key);
        if (spent >= this.budgetMs) break;
      }
      this.lastBuildMs = spent;
    }

    // Let go of bricks the player has walked far from; they come back when he does.
    if ((this.engine.frameCount & 63) === 0) {
      for (const [key, v] of this.meshes) {
        const d = Math.hypot((v.bx + 0.5) * BRICK_M - focus.x, (v.by + 0.5) * BRICK_M - focus.y, (v.bz + 0.5) * BRICK_M - focus.z);
        if (d > this.rangeM * 1.35) { this._drop(key); this.pending.set(key, { bx: v.bx, by: v.by, bz: v.bz }); }
      }
      // And bring back the ones he has returned to.
      for (const [key, t] of store.touched) {
        if (!this.meshes.has(key) && !this.pending.has(key)) {
          const d = Math.hypot((t.bx + 0.5) * BRICK_M - focus.x, (t.by + 0.5) * BRICK_M - focus.y, (t.bz + 0.5) * BRICK_M - focus.z);
          if (d <= this.rangeM) this.pending.set(key, t);
        }
      }
    }

    // The occupancy window follows the player.
    const c = COVER_SIZE / 2, o = this.cover.origin;
    const off = Math.max(Math.abs(fbx - (o.x + c)), Math.abs(fby - (o.y + c)), Math.abs(fbz - (o.z + c)));
    if (this.coverDirty || off > 12) {
      this.cover.rebuild(this.focus, this.meshes);
      this.coverDirty = false;
    }

    // Detail noise pinned to the world, for the brick meshes (their vertices are brick-relative).
    const cw = this.engine.cameraWorldPos;
    const mod = (v) => ((v % 360) + 360) % 360;
    this._reg.uRegOffset.value.set(mod(cw.x), mod(cw.y), mod(cw.z));
  }

  /** A heightfield mesh calls this each frame so its shader knows where the occupancy window is. */
  coverOffsetFor(worldPos, offsetUniform) {
    const w = this.cover.originWorld;
    offsetUniform.value.set(worldPos.x - w.x, worldPos.y - w.y, worldPos.z - w.z);
  }

  /** Build everything pending right now (tests and screenshots; play spreads it over frames). */
  flush(focus) {
    const saved = this.budgetMs, savedRange = this.rangeM;
    this.budgetMs = 1e9; this.rangeM = 1e9;
    this.update(0, focus);
    this.budgetMs = saved; this.rangeM = savedRange;
  }
}
