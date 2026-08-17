// ============================================================================
// excavation.js — geometry for ground that has been dug.
//
// OWNS: building a real 3D surface over any region someone has excavated, by
//       walking the material field cell by cell.
// DOES NOT OWN: the field (field.js), the edits (edits.js), or the undisturbed
//       ground (planetMesh.js). It draws what the field already knows.
//
// WHY THIS EXISTS — JARON'S POINT, EXACTLY
// ----------------------------------------
// "what if the planet is a giant object but it's only because a bunch of small
//  things are connected together... you can't break into small parts if it's
//  not made of small parts"
//
// That is the right diagnosis. The ground mesh is a HEIGHTFIELD: one ground
// height per column. It samples every 6.72 m, so a 0.18 m spade bite is 1/37th
// of a cell and cannot be drawn — but more fundamentally, a heightfield can
// never draw a hole with an overhanging lip, a tunnel mouth, or a cave roof at
// ANY resolution, because those need two surfaces on one vertical line.
//
// So the excavated region is drawn a different way: the volume is divided into
// small cells, each cell asks the field whether it is rock or air, and the
// surface is generated wherever those two meet. The "small parts" are the
// cells. They are not stored as objects — Mars at this resolution would be
// ~10^15 of them — they are evaluated on demand, only where someone has
// actually changed something. They become real geometry at the moment they
// need to be.
//
// ALGORITHM: naive surface nets. For every cell whose eight corners are not all
// the same sign, place one vertex at the average of its edge crossings. Then
// for every edge with a sign change, join the four cells around it into a quad.
// It produces smoother results than marching cubes with far fewer cases, which
// matters for dug soil.
// ============================================================================

import * as THREE from 'three';
import { density, materialAt } from './field.js';

const EDGES = [
  [0, 1], [1, 3], [2, 3], [0, 2],
  [4, 5], [5, 7], [6, 7], [4, 6],
  [0, 4], [1, 5], [2, 6], [3, 7],
];

// Corner offsets in (x, y, z) for the eight corners of a cell.
const CORNERS = [
  [0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0],
  [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1],
];

export class ExcavationMesh {
  /**
   * @param body
   * @param opts.cellM   cell size in metres (0.25 gives a visible spade bite)
   * @param opts.maxCells hard cap per axis, so a huge region cannot stall
   */
  constructor(body, opts = {}) {
    this.body = body;
    this.cellM = opts.cellM || 0.25;
    this.maxCells = opts.maxCells || 72;
    this.padM = opts.padM || 1.2;         // margin around the edited region
    // The excavated region must be WIDER THAN ONE HEIGHTFIELD QUAD, or the
    // heightfield cannot be told to step aside for it and simply covers the
    // hole. A 0.65 m pit inside a 6.72 m terrain cell is invisible not because
    // the pit is small but because nothing can be removed at that granularity.
    this.minRadiusM = opts.minRadiusM || 0;

    this.mesh = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshStandardMaterial({
        vertexColors: true, roughness: 0.95, metalness: 0.0,
        side: THREE.DoubleSide,          // you can be inside a hole you dug
        // The heightfield can only stop drawing in whole quads, so it always
        // hands over slightly LESS ground than this mesh covers — deliberately,
        // because the alternative is handing over more and leaving a strip
        // where nothing is drawn at all and you see through the planet. In that
        // overlap the two surfaces are 0.1-0.4 cm apart (measured), which is
        // pure z-fighting: the winner alternates per pixel and reads as stripes.
        // This mesh is the accurate one, so it wins the depth test outright.
        polygonOffset: true,
        polygonOffsetFactor: -2.0,
        polygonOffsetUnits: -2.0,
      })
    );
    this.mesh.name = 'excavation';
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = true;
    this.mesh.visible = false;

    this.worldPos = { x: 0, y: 0, z: 0 };
    this.bounds = null;                   // { min, max, centre, radius }
    this.buildCount = 0;
    this.lastBuildMs = 0;
    this.vertexCount = 0;
  }

  /** The region the excavation covers, so the heightfield can step aside. */
  footprint() { return this.bounds; }

  /**
   * Rebuild over the bounding box of the supplied edits.
   * Only called after the ground actually changes, never per frame.
   */
  rebuild(edits) {
    const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    if (!edits || !edits.length) { this.mesh.visible = false; this.bounds = null; return 0; }

    // Bounding box of everything dug or dumped, plus a margin.
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (const e of edits) {
      const r = e.radius + this.padM;
      minX = Math.min(minX, e.x - r); maxX = Math.max(maxX, e.x + r);
      minY = Math.min(minY, e.y - r); maxY = Math.max(maxY, e.y + r);
      minZ = Math.min(minZ, e.z - r); maxZ = Math.max(maxZ, e.z + r);
    }

    // Grow to the minimum workable radius around the centre of the edits.
    if (this.minRadiusM > 0) {
      const cx0 = (minX + maxX) / 2, cy0 = (minY + maxY) / 2, cz0 = (minZ + maxZ) / 2;
      const need = this.minRadiusM;
      minX = Math.min(minX, cx0 - need); maxX = Math.max(maxX, cx0 + need);
      minY = Math.min(minY, cy0 - need); maxY = Math.max(maxY, cy0 + need);
      minZ = Math.min(minZ, cz0 - need); maxZ = Math.max(maxZ, cz0 + need);
    }

    // Cell counts, capped. If someone excavates a stadium, the cells grow
    // rather than the build time exploding.
    let cell = this.cellM;
    const span = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
    if (span / cell > this.maxCells) cell = span / this.maxCells;

    const nx = Math.max(2, Math.ceil((maxX - minX) / cell)) + 1;
    const ny = Math.max(2, Math.ceil((maxY - minY) / cell)) + 1;
    const nz = Math.max(2, Math.ceil((maxZ - minZ) / cell)) + 1;

    const body = this.body;
    const scratch = {};

    // --- Sample the field at every grid corner. ------------------------------
    const field = new Float32Array(nx * ny * nz);
    const idx = (i, j, k) => (k * ny + j) * nx + i;
    for (let k = 0; k < nz; k++) {
      const z = minZ + k * cell;
      for (let j = 0; j < ny; j++) {
        const y = minY + j * cell;
        for (let i = 0; i < nx; i++) {
          field[idx(i, j, k)] = density(body, minX + i * cell, y, z, scratch);
        }
      }
    }

    // --- One vertex per surface-crossing cell. ------------------------------
    const cellVert = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
    const cIdx = (i, j, k) => (k * (ny - 1) + j) * (nx - 1) + i;
    const positions = [];
    const colors = [];
    const colour = new THREE.Color();

    for (let k = 0; k < nz - 1; k++) {
      for (let j = 0; j < ny - 1; j++) {
        for (let i = 0; i < nx - 1; i++) {
          let mask = 0;
          const d = [];
          for (let c = 0; c < 8; c++) {
            const [dx, dy, dz] = CORNERS[c];
            const v = field[idx(i + dx, j + dy, k + dz)];
            d.push(v);
            if (v < 0) mask |= (1 << c);
          }
          if (mask === 0 || mask === 255) continue;   // wholly air or wholly rock

          // Vertex position: mean of the zero crossings on the cell's edges.
          let sx = 0, sy = 0, sz = 0, n = 0;
          for (const [a, b] of EDGES) {
            const da = d[a], db = d[b];
            if ((da < 0) === (db < 0)) continue;
            const t = da / (da - db);
            const ca = CORNERS[a], cb = CORNERS[b];
            sx += ca[0] + (cb[0] - ca[0]) * t;
            sy += ca[1] + (cb[1] - ca[1]) * t;
            sz += ca[2] + (cb[2] - ca[2]) * t;
            n++;
          }
          if (!n) continue;

          const wx = minX + (i + sx / n) * cell;
          const wy = minY + (j + sy / n) * cell;
          const wz = minZ + (k + sz / n) * cell;

          cellVert[cIdx(i, j, k)] = positions.length / 3;
          positions.push(wx, wy, wz);

          // Colour from the material actually exposed by the cut, so a dug
          // face shows the strata it went through.
          const mat = materialAt(body, wx, wy, wz);
          colour.setHex(mat.color);
          colors.push(colour.r, colour.g, colour.b);
        }
      }
    }

    if (!positions.length) { this.mesh.visible = false; this.bounds = null; return 0; }

    // --- Join cells around every crossing edge into quads. ------------------
    const indices = [];
    const quad = (a, b, c, dd, flip) => {
      if (a < 0 || b < 0 || c < 0 || dd < 0) return;
      if (flip) indices.push(a, c, b, a, dd, c);
      else indices.push(a, b, c, a, c, dd);
    };

    // Each of the three edge directions needs its OWN guard. The four cells
    // around a +X edge span j-1..j and k-1..k but sit at a single i, so that
    // quad needs j>0 and k>0 and nothing else. Guarding all three directions on
    // i>0 && j>0 && k>0 threw away the i=0 layer of X-facing quads, which is a
    // missing strip down one wall of every hole.
    //
    // WINDING. Listed in cycle order around the edge, the four cells wind
    // counter-clockwise seen from +X and from +Z, but CLOCKWISE seen from +Y —
    // because X x Z = -Y, not +Y. So the +Y case needs the opposite flip from
    // the other two, and `solid` (rock on the low side, air on the high side)
    // means the face has to look towards the high side. Every one of these was
    // inverted before: all 518 triangles of a test dig faced into the rock.
    // validate.mjs now measures this against the field itself.
    for (let k = 0; k < nz - 1; k++) {
      for (let j = 0; j < ny - 1; j++) {
        for (let i = 0; i < nx - 1; i++) {
          const solid = field[idx(i, j, k)] < 0;

          // +X edge -> quad in the YZ plane, wound CCW from +X.
          if (j > 0 && k > 0 && (field[idx(i + 1, j, k)] < 0) !== solid) {
            quad(cellVert[cIdx(i, j - 1, k - 1)], cellVert[cIdx(i, j, k - 1)],
                 cellVert[cIdx(i, j, k)], cellVert[cIdx(i, j - 1, k)], !solid);
          }
          // +Y edge -> quad in the XZ plane, wound CW from +Y.
          if (i > 0 && k > 0 && (field[idx(i, j + 1, k)] < 0) !== solid) {
            quad(cellVert[cIdx(i - 1, j, k - 1)], cellVert[cIdx(i, j, k - 1)],
                 cellVert[cIdx(i, j, k)], cellVert[cIdx(i - 1, j, k)], solid);
          }
          // +Z edge -> quad in the XY plane, wound CCW from +Z.
          if (i > 0 && j > 0 && (field[idx(i, j, k + 1)] < 0) !== solid) {
            quad(cellVert[cIdx(i - 1, j - 1, k)], cellVert[cIdx(i, j - 1, k)],
                 cellVert[cIdx(i, j, k)], cellVert[cIdx(i - 1, j, k)], !solid);
          }
        }
      }
    }

    // --- Upload, stored relative to the region centre for float32 safety. ---
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, cz = (minZ + maxZ) / 2;
    for (let v = 0; v < positions.length; v += 3) {
      positions[v] -= cx; positions[v + 1] -= cy; positions[v + 2] -= cz;
    }

    const geo = this.mesh.geometry;
    geo.dispose();
    const ng = new THREE.BufferGeometry();
    ng.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    ng.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    ng.setIndex(indices);
    ng.computeVertexNormals();
    ng.computeBoundingSphere();
    this.mesh.geometry = ng;
    this.mesh.visible = true;

    this.worldPos.x = cx; this.worldPos.y = cy; this.worldPos.z = cz;
    this.bounds = {
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ },
      centre: { x: cx, y: cy, z: cz },
      radius: Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) / 2,
      // The largest sphere that fits INSIDE the box. `radius` above is the
      // half-DIAGONAL and is 73% larger — handing over that much told the
      // heightfield to stop drawing beyond where this mesh reaches, leaving a
      // 0.45 m ring drawn by nothing at all.
      halfM: Math.min(maxX - minX, maxY - minY, maxZ - minZ) / 2,
      // How much ground to hand to the heightfield, as the half-side of a
      // SQUARE laid flat on the ground rather than a sphere.
      //
      // WHY A SQUARE. The heightfield yields in whole quads, and its quads are
      // axis-aligned in its own tangent frame. Asking it to yield a circle
      // makes the answer depend on where the circle happens to fall against
      // that grid: measured, the best-placed quad had its far corner 0.91 m
      // from the centre against a 0.907 m radius, so NOTHING was handed over
      // and the pit stayed buried — a 3 mm miss with a completely binary
      // result. A square aligned to the same grid has no such phase: a span of
      // 2 quads always contains a whole quad, wherever it starts.
      //
      // 0.60 of the half-width keeps the square's corners (0.60 x sqrt2 = 0.85
      // of the half-width) inside the box with room left for the ground to
      // slope across it.
      handoverM: 0.60 * Math.min(maxX - minX, maxY - minY, maxZ - minZ) / 2,
      cellM: cell,
    };

    this.vertexCount = positions.length / 3;
    this.buildCount++;
    this.lastBuildMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
    return this.lastBuildMs;
  }
}
