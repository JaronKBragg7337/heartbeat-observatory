// ============================================================================
// edits.js — the ground is a solid object you can take pieces out of.
//
// OWNS: persistent changes to the material field, and the accounting that
//       makes those changes conserve matter.
// DOES NOT OWN: the base geology (field.js) or how a hole is drawn
//       (planetMesh.js). Both read this.
//
// WHAT JARON ASKED FOR, IN HIS WORDS
// ----------------------------------
// "someone can grab a shovel and literally start digging the ground and pick up
//  piece by piece because the ground is a physical object that can be
//  separated... what's scooped out is still a solid object that has to sit
//  somewhere and then the area that got scooped out of becomes a hole"
//
// That is matter conservation, and it is the reason the terrain had to be a
// volume rather than a height map. A height map can lower a surface; it cannot
// tell you how much material that removed, because there is no material — only
// a height. Here a scoop has a measured volume, that volume has a mass computed
// from the real density of the rock it came out of, and that mass has to be
// somewhere: in your hands, in a bucket, or in a pile on the ground.
//
// HOW AN EDIT WORKS
// -----------------
// An edit is a sphere with a sign:
//
//   sign -1   removed material: the field goes OPEN inside the sphere
//   sign +1   deposited material: the field goes SOLID inside the sphere
//
// The base geology is untouched and stays procedural. Edits are sparse — only
// the places someone actually changed — so a planet 3,389 km across costs
// nothing until somebody picks up a shovel.
//
// VOLUME IS MEASURED, NOT ASSUMED
// -------------------------------
// A scoop taken half out of a hillside removes less than a full sphere. Rather
// than pretend otherwise, the volume is measured by sampling the field on a
// grid inside the sphere and counting what was actually solid. The count is
// deterministic, so the same dig always yields the same mass.
// ============================================================================

const CELL_M = 8;               // spatial hash cell size, metres. Tight on purpose:
                                // a coarse bucket makes far too many points look
                                // "near an edit" and take the slow path.

export class EditStore {
  constructor(body) {
    this.body = body;
    this.edits = [];             // { id, x,y,z, radius, sign, materialId, volumeM3, massKg }
    this._cells = new Map();     // "i,j,k" -> edit indices
    this._seq = 0;
    this.totalRemovedM3 = 0;
    this.totalDepositedM3 = 0;

    // One bounding box over every edit ever made. This is the cheap gate that
    // protects the hot path: three compares reject a point, with no division,
    // no string key and no Map lookup. Building a hash key per query cost
    // ~300 ms per terrain rebuild once digging had started, because the key is
    // a string and there are twenty thousand vertices.
    this._min = { x: Infinity, y: Infinity, z: Infinity };
    this._max = { x: -Infinity, y: -Infinity, z: -Infinity };
  }

  _grow(edit) {
    const r = edit.radius;
    if (edit.x - r < this._min.x) this._min.x = edit.x - r;
    if (edit.y - r < this._min.y) this._min.y = edit.y - r;
    if (edit.z - r < this._min.z) this._min.z = edit.z - r;
    if (edit.x + r > this._max.x) this._max.x = edit.x + r;
    if (edit.y + r > this._max.y) this._max.y = edit.y + r;
    if (edit.z + r > this._max.z) this._max.z = edit.z + r;
  }

  /** Cheapest possible rejection. False means "definitely untouched ground". */
  inBounds(x, y, z, margin = 0) {
    return x >= this._min.x - margin && x <= this._max.x + margin &&
           y >= this._min.y - margin && y <= this._max.y + margin &&
           z >= this._min.z - margin && z <= this._max.z + margin;
  }

  _key(x, y, z) {
    return `${Math.floor(x / CELL_M)},${Math.floor(y / CELL_M)},${Math.floor(z / CELL_M)}`;
  }

  _index(edit, i) {
    // Register the edit in every cell its sphere touches, so lookup is a
    // handful of map reads instead of a scan over every edit ever made.
    const r = edit.radius;
    const x0 = Math.floor((edit.x - r) / CELL_M), x1 = Math.floor((edit.x + r) / CELL_M);
    const y0 = Math.floor((edit.y - r) / CELL_M), y1 = Math.floor((edit.y + r) / CELL_M);
    const z0 = Math.floor((edit.z - r) / CELL_M), z1 = Math.floor((edit.z + r) / CELL_M);
    for (let a = x0; a <= x1; a++) {
      for (let b = y0; b <= y1; b++) {
        for (let c = z0; c <= z1; c++) {
          const k = `${a},${b},${c}`;
          let arr = this._cells.get(k);
          if (!arr) { arr = []; this._cells.set(k, arr); }
          arr.push(i);
        }
      }
    }
  }

  /** Edits whose sphere could affect this point. Usually zero. */
  near(x, y, z) {
    const arr = this._cells.get(this._key(x, y, z));
    if (!arr) return null;
    return arr;
  }

  /**
   * Does a real edit sphere actually reach this point?
   *
   * `near()` alone is far too blunt to gate expensive work on. The spatial hash
   * buckets by CELL_M, so a single 0.09 m spade bite makes every point in its
   * whole bucket "near an edit". With the near-field terrain that meant ~20,000
   * vertices each took the slow ray-marched surface solve instead of the fast
   * Newton one, and a patch rebuild went from 72 ms to 2,575 ms.
   *
   * This is the precise test: a handful of distance checks against the few
   * candidates in the bucket, which is cheap and answers false almost always.
   */
  affects(x, y, z, marginM = 0) {
    // Reject against the overall bounds first — no string, no Map, no divide.
    if (!this.inBounds(x, y, z, marginM)) return false;
    const arr = this._cells.get(this._key(x, y, z));
    if (!arr) return false;
    for (let i = 0; i < arr.length; i++) {
      const e = this.edits[arr[i]];
      const reach = e.radius + marginM;
      const dx = x - e.x, dy = y - e.y, dz = z - e.z;
      if (dx * dx + dy * dy + dz * dz < reach * reach) return true;
    }
    return false;
  }

  /**
   * Combine edits into a base field value.
   * Removal opens up material; deposit fills it in. Both use the signed
   * distance to the sphere so the result stays smooth and traceable.
   */
  apply(baseDensity, x, y, z) {
    // Same cheap gate. density() runs this on every field sample in the world.
    if (!this.inBounds(x, y, z)) return baseDensity;
    const idx = this.near(x, y, z);
    if (!idx) return baseDensity;
    let d = baseDensity;
    for (let n = 0; n < idx.length; n++) {
      const e = this.edits[idx[n]];
      const dist = Math.hypot(x - e.x, y - e.y, z - e.z);
      const inside = e.radius - dist;          // >0 inside the sphere
      if (inside <= 0) continue;
      if (e.sign < 0) d = Math.max(d, inside);       // carve open
      else d = Math.min(d, -inside);                 // fill solid
    }
    return d;
  }

  /** Is there any edit at all? Lets the hot path skip everything. */
  get isEmpty() { return this.edits.length === 0; }

  /**
   * Measure how much SOLID material sits inside a sphere right now, in m^3,
   * along with which material dominates. Deterministic grid sampling.
   */
  measureSolid(densityFn, materialFn, cx, cy, cz, radius, samplesPerAxis = 9) {
    const n = samplesPerAxis;
    const step = (radius * 2) / n;
    const cellVol = step * step * step;
    let solid = 0, volume = 0;
    const tally = new Map();

    for (let i = 0; i < n; i++) {
      const x = cx - radius + (i + 0.5) * step;
      for (let j = 0; j < n; j++) {
        const y = cy - radius + (j + 0.5) * step;
        for (let k = 0; k < n; k++) {
          const z = cz - radius + (k + 0.5) * step;
          if (Math.hypot(x - cx, y - cy, z - cz) > radius) continue;
          if (densityFn(x, y, z) < 0) {
            solid++;
            volume += cellVol;
            const m = materialFn(x, y, z);
            tally.set(m.id, (tally.get(m.id) || 0) + 1);
          }
        }
      }
    }

    let dominant = null, best = 0;
    for (const [id, count] of tally) if (count > best) { best = count; dominant = id; }
    return { volumeM3: volume, solidSamples: solid, materialId: dominant };
  }

  /**
   * Remove material. Returns the lot that came out — a real object with a
   * volume, a mass, a composition and an origin, which now has to go somewhere.
   */
  dig(densityFn, materialFn, materials, cx, cy, cz, radius) {
    const m = this.measureSolid(densityFn, materialFn, cx, cy, cz, radius);
    if (m.volumeM3 <= 0) return null;

    const mat = Object.values(materials).find((x) => x.id === m.materialId) || materials.regolith;
    if (mat.id === 'MAT-MANTLE') return null;      // the immutable boundary

    const edit = {
      id: `COS-EDIT-${String(++this._seq).padStart(5, '0')}`,
      x: cx, y: cy, z: cz, radius, sign: -1,
      materialId: mat.id, volumeM3: m.volumeM3,
      massKg: m.volumeM3 * mat.densityKgM3,
      at: Date.now(),
    };
    this.edits.push(edit);
    this._index(edit, this.edits.length - 1);
    this._grow(edit);
    this.totalRemovedM3 += m.volumeM3;

    return {
      lotId: `COS-LOT-${String(this._seq).padStart(5, '0')}`,
      materialId: mat.id,
      materialName: mat.name,
      // Loose material occupies more room than it did in the ground. 1.25 is a
      // normal bulking factor for excavated soil, and it matters the moment a
      // vehicle has to carry it.
      solidVolumeM3: m.volumeM3,
      looseVolumeM3: m.volumeM3 * 1.25,
      massKg: m.volumeM3 * mat.densityKgM3,
      fromEditId: edit.id,
      origin: { x: cx, y: cy, z: cz },
    };
  }

  /**
   * Put material back. The deposited sphere is sized from the LOOSE volume,
   * because a pile of dug soil is bulkier than the hole it came from.
   */
  deposit(lot, cx, cy, cz) {
    const r = Math.cbrt((3 * lot.looseVolumeM3) / (4 * Math.PI));
    const edit = {
      id: `COS-EDIT-${String(++this._seq).padStart(5, '0')}`,
      x: cx, y: cy, z: cz, radius: r, sign: +1,
      materialId: lot.materialId, volumeM3: lot.looseVolumeM3,
      massKg: lot.massKg, at: Date.now(),
    };
    this.edits.push(edit);
    this._index(edit, this.edits.length - 1);
    this._grow(edit);
    this.totalDepositedM3 += lot.solidVolumeM3;
    return edit;
  }

  /** The books. Everything dug must be accounted for. */
  ledger(carriedLots = []) {
    const carried = carriedLots.reduce((a, l) => a + l.solidVolumeM3, 0);
    return {
      removedM3: this.totalRemovedM3,
      depositedM3: this.totalDepositedM3,
      carriedM3: carried,
      unaccountedM3: this.totalRemovedM3 - this.totalDepositedM3 - carried,
      edits: this.edits.length,
    };
  }
}
