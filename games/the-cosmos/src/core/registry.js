// ============================================================================
// registry.js — the address book. Nothing exists in this world unregistered.
//
// OWNS: stable asset IDs, the measured record behind each one, and the lookup
//       that turns an ID into "what is it, where is it, how big is it".
// DOES NOT OWN: geometry, rendering, or physics. It records; it does not draw.
//
// THE RULE
// --------
// If a thing can be seen, collided with, stood on, picked up, or blamed for a
// bug, it has an ID before it has a mesh. The ID is assigned at registration
// and never changes — not when the model is replaced, not when the material is
// retextured, not when it moves.
//
// ID FORMAT:  COS-<BODY>-<TYPE>-<SEQ>
//   COS       the project
//   BODY      MARS, PHOBOS, ... or SYS for things not on a body
//   TYPE      LMK landmark · TER terrain chunk · STR structure · PRP prop
//             VEH vehicle · CHR character · ITM held item · MRK marker
//   SEQ       zero-padded sequence, stable per (body, type)
//
// WHY IT MATTERS OPERATIONALLY
// ----------------------------
// The debug layer prints this ID in a floating bubble over the asset along with
// its coordinate. That turns "there's a rock clipping into a hill somewhere"
// into "COS-MARS-PRP-0042 at 18.6512N 133.8000W, +21903.2 m" — which is a
// findable, fixable, testable statement.
//
// EVERY RECORD CARRIES ITS MEASUREMENTS
// -------------------------------------
// Authored dimensions are an intent. Measured bounds, taken from the built
// geometry, are the evidence. Both are stored, and the validator compares them:
// a part whose measured size disagrees with its authored size is a defect,
// not a rounding detail.
// ============================================================================

import { cartesianToGeodetic, coordSlug } from '../world/geodesy.js';

const TYPES = new Set(['LMK', 'TER', 'STR', 'PRP', 'VEH', 'CHR', 'ITM', 'MRK']);

export class Registry {
  constructor() {
    this.byId = new Map();
    this._seq = new Map();          // "MARS:PRP" -> next number
    this._frozen = new Set();       // ids that must never be reassigned
  }

  nextId(bodyId, type) {
    if (!TYPES.has(type)) throw new Error(`unknown asset type: ${type}`);
    const body = (bodyId || 'sys').toUpperCase();
    const key = `${body}:${type}`;
    const n = (this._seq.get(key) || 0) + 1;
    this._seq.set(key, n);
    return `COS-${body}-${type}-${String(n).padStart(4, '0')}`;
  }

  /**
   * Register an asset. Returns the record.
   *
   * @param {object} spec
   *  id?          stable id; generated if absent
   *  bodyId       which world it belongs to
   *  type         one of TYPES
   *  name         human label
   *  position     {x,y,z} body-fixed metres  (or null for abstract records)
   *  authored     {width,height,depth} metres — what it is supposed to be
   *  massKg       real mass
   *  materialId   which material record governs its surface
   *  collision    'none' | 'box' | 'field' | 'mesh'
   *  object3d?    the render node, if it has one
   */
  register(spec) {
    if (!spec.type) throw new Error('asset needs a type');
    const id = spec.id || this.nextId(spec.bodyId, spec.type);
    if (this.byId.has(id)) throw new Error(`duplicate asset id: ${id}`);

    const rec = {
      id,
      bodyId: spec.bodyId || null,
      type: spec.type,
      name: spec.name || id,
      position: spec.position ? { ...spec.position } : null,
      authored: spec.authored || null,
      measured: null,                 // filled by measure(), never authored by hand
      massKg: spec.massKg ?? null,
      materialId: spec.materialId || null,
      collision: spec.collision || 'none',
      object3d: spec.object3d || null,
      note: spec.note || '',
      createdAt: Date.now(),
    };
    this.byId.set(id, rec);
    if (spec.id) this._frozen.add(id);
    return rec;
  }

  get(id) { return this.byId.get(id) || null; }
  all() { return [...this.byId.values()]; }
  ofType(type) { return this.all().filter((r) => r.type === type); }

  /**
   * Take the real bounds off the built geometry. This is evidence, not intent.
   *
   * Measured in the object's OWN space, with its world transform temporarily
   * neutralised. `Box3.setFromObject` walks world matrices, so a 2.4 m mast
   * standing plumb on a sphere — i.e. rotated to match local up — reported
   * 1.64 x 1.06 x 2.22 m instead of 0.60 x 2.40 x 0.60. That is the axis-aligned
   * box around a tilted object, not the object, and it made every correctly
   * placed asset look like it had failed its dimension check.
   *
   * A part's size is a property of the part. Where it happens to be pointing
   * is not.
   */
  measure(id, THREE) {
    const rec = this.byId.get(id);
    if (!rec || !rec.object3d) return null;
    const obj = rec.object3d;

    const savedPos = obj.position.clone();
    const savedQuat = obj.quaternion.clone();
    const savedParent = obj.parent;

    obj.position.set(0, 0, 0);
    obj.quaternion.identity();
    if (savedParent) obj.parent = null;
    obj.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(obj);

    obj.position.copy(savedPos);
    obj.quaternion.copy(savedQuat);
    if (savedParent) obj.parent = savedParent;
    obj.updateMatrixWorld(true);

    if (!isFinite(box.min.x) || box.isEmpty()) return null;
    const size = box.getSize(new THREE.Vector3());
    rec.measured = {
      width: size.x, height: size.y, depth: size.z,
      volume: size.x * size.y * size.z,
    };
    return rec.measured;
  }

  /** Where is it, in the coordinate a human can read back to me. */
  locate(id, body) {
    const rec = this.byId.get(id);
    if (!rec || !rec.position || !body) return null;
    const g = cartesianToGeodetic(body, rec.position.x, rec.position.y, rec.position.z);
    return {
      lat: g.lat, lon: g.lon, alt: g.alt,
      slug: coordSlug(body.id, g.lat, g.lon, g.alt),
    };
  }

  /**
   * Authored-vs-measured agreement. Anything beyond tolerance is a real defect:
   * either the model was built wrong or the spec was wrong, and both matter.
   */
  dimensionDrift(id, toleranceM = 0.05) {
    const rec = this.byId.get(id);
    if (!rec || !rec.authored || !rec.measured) return null;
    const d = {
      width: Math.abs(rec.measured.width - rec.authored.width),
      height: Math.abs(rec.measured.height - rec.authored.height),
      depth: Math.abs(rec.measured.depth - rec.authored.depth),
    };
    d.worst = Math.max(d.width, d.height, d.depth);
    d.withinTolerance = d.worst <= toleranceM;
    return d;
  }

  /** A one-line summary for the debug bubble. */
  summary(id, body) {
    const rec = this.byId.get(id);
    if (!rec) return null;
    const loc = this.locate(id, body);
    const m = rec.measured;
    return {
      id: rec.id,
      name: rec.name,
      coord: loc ? loc.slug : '—',
      size: m ? `${m.width.toFixed(2)} × ${m.height.toFixed(2)} × ${m.depth.toFixed(2)} m` : '—',
      mass: rec.massKg != null ? `${rec.massKg.toLocaleString()} kg` : '—',
      collision: rec.collision,
      material: rec.materialId || '—',
    };
  }

  /** Machine-readable dump, used by the validator and by bug reports. */
  manifest() {
    return this.all().map((r) => ({
      id: r.id, type: r.type, name: r.name, bodyId: r.bodyId,
      position: r.position, authored: r.authored, measured: r.measured,
      massKg: r.massKg, materialId: r.materialId, collision: r.collision,
    }));
  }
}

export const registry = new Registry();
