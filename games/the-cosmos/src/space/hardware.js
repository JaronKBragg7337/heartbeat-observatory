// ============================================================================
// hardware.js — the survey beacons and the drifting cargo module on Phobos.
//
// OWNS: the meshes. A beacon is a staked instrument head (mast, collars, sample port, latch, lamp, stencil), not a pole
//       with a ball on top. The cargo module is a battered pod: plates, a dogged door, broken hazard paint, scorch, skids
//       and a distress lamp. Both are merged down to a handful of draw calls so the phone tier (?tier=low&depth=16) can
//       carry them. Lamps stay as their own meshes: jobs.js recolors a beacon when its sample is taken, and blinks the
//       distress lamp until the module is claimed.
// DOES NOT OWN: where they stand (moonField's sample sites and derelict), or what salvaging and sampling pay (jobs.js).
// ============================================================================

import * as THREE from 'three';

const _shared = { ready: false };

function sharedMats() {
  if (_shared.ready) return _shared;
  const M = (color, roughness, metalness) => new THREE.MeshStandardMaterial({ color, roughness, metalness, fog: false });
  _shared.steel = M(0x7a756c, 0.58, 0.62);
  _shared.steelDark = M(0x3c3935, 0.72, 0.48);
  _shared.primer = M(0x6e4030, 0.7, 0.28);     // a plate that lost its paint
  _shared.scorch = M(0x161311, 0.92, 0.12);
  _shared.latch = M(0x9a958c, 0.38, 0.78);
  _shared.hazard = M(0xc9a24a, 0.5, 0.25);
  _shared.hazardK = M(0x141414, 0.62, 0.3);
  _shared.skid = M(0x2a2724, 0.88, 0.35);
  _shared.cable = M(0x1c1e22, 0.7, 0.2);
  _shared.solar = M(0x1a2740, 0.35, 0.55);
  _shared.ready = true;
  return _shared;
}

function addBox(parent, mat, x, y, z, w, h, d, rot) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  if (rot) mesh.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
  parent.add(mesh);
  return mesh;
}

function addCyl(parent, mat, x, y, z, r, len, seg, axis) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat);
  mesh.position.set(x, y, z);
  if (axis === 'x') mesh.rotation.z = Math.PI / 2;
  else if (axis === 'z') mesh.rotation.x = Math.PI / 2;
  parent.add(mesh);
  return mesh;
}

/** Collapse every mesh except the named ones into one mesh per material. The kept meshes are the lamps and the decals. */
function bake(root, keep) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();
  const drop = [];
  root.traverse((o) => {
    if (!o.isMesh || keep.has(o.name)) return;
    drop.push(o);
    let b = buckets.get(o.material);
    if (!b) { b = { mat: o.material, pos: [], nrm: [], idx: [] }; buckets.set(o.material, b); }
    const local = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    const nmat = new THREE.Matrix3().getNormalMatrix(local);
    const pos = o.geometry.attributes.position;
    const nrm = o.geometry.attributes.normal;
    const base = b.pos.length / 3;
    const v = new THREE.Vector3(), n = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(local);
      b.pos.push(v.x, v.y, v.z);
      if (nrm) { n.fromBufferAttribute(nrm, i).applyMatrix3(nmat).normalize(); b.nrm.push(n.x, n.y, n.z); }
      else b.nrm.push(0, 1, 0);
    }
    const index = o.geometry.index;
    if (index) for (let i = 0; i < index.count; i++) b.idx.push(base + index.getX(i));
    else for (let i = 0; i < pos.count; i++) b.idx.push(base + i);
  });
  for (const o of drop) o.removeFromParent();
  for (const b of buckets.values()) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(b.nrm, 3));
    geo.setIndex(b.idx);
    const mesh = new THREE.Mesh(geo, b.mat);
    mesh.name = 'hardware-shell';
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
  }
}

/** A real 2D canvas. The crew checks install a stand-in document whose getContext cannot read pixels. */
function canvasPaints() {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return false;
  try {
    const c = document.createElement('canvas');
    const g = c && c.getContext && c.getContext('2d');
    if (!g || typeof g.getImageData !== 'function') return false;
    const img = g.getImageData(0, 0, 1, 1);
    return !!(img && img.data && img.data.length);
  } catch {
    return false;
  }
}

function stencil(title, sub) {
  if (!canvasPaints()) return null;
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#2a2826';
  g.fillRect(0, 0, 512, 256);
  g.strokeStyle = '#8a847a';
  g.lineWidth = 10;
  g.strokeRect(12, 12, 488, 232);
  g.fillStyle = '#d8d2c6';
  g.font = '700 54px ui-monospace, Consolas, monospace';
  g.fillText(title, 36, 100);
  g.fillStyle = '#c9a24a';
  g.font = '600 36px ui-monospace, Consolas, monospace';
  g.fillText(sub, 36, 168);
  g.fillStyle = '#6e4030';
  g.fillRect(36, 196, 180, 16);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function decalMesh(tex, w, h, x, y, z, rotY) {
  const mat = tex
    ? new THREE.MeshBasicMaterial({ map: tex, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
    : sharedMats().steelDark;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  mesh.name = 'hardware-decal';
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotY;
  return mesh;
}

/**
 * A survey sample beacon. Local +Y is up; the foot sits on y = 0.
 * @returns {{ group: THREE.Group, lamp: THREE.Mesh, halo: THREE.Mesh }}
 */
export function buildSampleBeacon(opts = {}) {
  const low = !!opts.low;
  const seg = low ? 6 : 8;
  const id = opts.id || 'S1';
  const M = sharedMats();
  const g = new THREE.Group();
  g.name = `sample-beacon:${id}`;
  const parts = ['foot', 'mast', 'collar', 'head', 'port', 'latch', 'antenna', 'solar', 'lamp', 'decal'];
  if (!low) parts.push('cable', 'scuff');

  // three stakes, one of them bent: it was hammered into regolith, not printed standing in space
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    const foot = addBox(g, M.skid, Math.cos(a) * 0.28, 0.16, Math.sin(a) * 0.28, 0.08, 0.34, 0.1);
    foot.rotation.z = Math.cos(a) * 0.35;
    foot.rotation.x = -Math.sin(a) * 0.35;
    if (i === 0) foot.rotation.z += 0.4;
  }
  addCyl(g, M.steelDark, 0, 1.35, 0, 0.045, 2.35, seg, 'y');
  for (const y of low ? [0.7, 2.15] : [0.55, 1.25, 2.15]) addCyl(g, M.latch, 0, y, 0, 0.07, 0.06, seg, 'y');
  if (!low) addCyl(g, M.cable, 0.09, 1.3, 0, 0.012, 2.2, 5, 'y');

  // the head: a box you could unlatch, with the coring port on the front
  addBox(g, M.steel, 0, 2.62, 0, 0.46, 0.32, 0.36);
  addBox(g, M.steelDark, 0, 2.62, 0.2, 0.28, 0.2, 0.06);
  addCyl(g, M.latch, 0, 2.62, 0.26, 0.05, 0.1, seg, 'z');
  addBox(g, M.primer, 0.18, 2.55, 0.02, 0.06, 0.1, 0.08);          // the latch dog
  addBox(g, M.latch, 0.18, 2.55, 0.08, 0.03, 0.04, 0.06);
  addBox(g, M.solar, 0, 2.82, 0, 0.36, 0.025, 0.26);
  addCyl(g, M.steelDark, -0.1, 3.05, 0, 0.012, low ? 0.35 : 0.55, 5, 'y');
  if (!low) addBox(g, M.scorch, -0.16, 1.7, 0.05, 0.05, 0.4, 0.02);  // a scuff up the mast

  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, low ? 8 : 12, low ? 6 : 8), new THREE.MeshBasicMaterial({ color: 0x42d9ff, toneMapped: false, fog: false }));
  lamp.name = 'beacon-lamp';
  lamp.position.set(0.16, 3.02, 0);
  g.add(lamp);
  // a small steady pip under the head so the lamp is not the only light on the stick
  const pip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.025, 0.02), new THREE.MeshBasicMaterial({ color: 0x7dffb2, toneMapped: false, fog: false }));
  pip.name = 'beacon-pip';
  pip.position.set(0, 2.42, 0.19);
  g.add(pip);

  const decal = decalMesh(stencil(id, 'MSO CORE'), 0.3, 0.16, 0, 2.62, -0.19, Math.PI);
  g.add(decal);

  const halo = new THREE.Mesh(new THREE.RingGeometry(1.15, 1.45, low ? 24 : 40), new THREE.MeshBasicMaterial({
    color: 0x42d9ff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, toneMapped: false, depthWrite: false, fog: false,
  }));
  halo.name = 'beacon-halo';
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.04;
  g.add(halo);

  bake(g, new Set(['beacon-lamp', 'beacon-pip', 'hardware-decal', 'beacon-halo']));
  g.userData.parts = parts;
  g.userData.kind = 'sample-beacon';
  return { group: g, lamp, halo };
}

/**
 * The drifting cargo module. Local +Y is up after it is settled on its skids; the pod itself is listed, as if it came down hard.
 * @returns {{ group: THREE.Group, lamp: THREE.Mesh }}
 */
export function buildCargoModule(opts = {}) {
  const low = !!opts.low;
  const seg = low ? 6 : 8;
  const M = sharedMats();
  const g = new THREE.Group();
  g.name = 'derelict-cargo-module';
  const inner = new THREE.Group();
  g.add(inner);
  const parts = ['panel', 'door', 'latch', 'stripe', 'skid', 'vent', 'scorch', 'damage', 'antenna', 'lamp', 'decal', 'lug'];

  // the shell, then plates standing proud of it with a gap, so the seams are real edges and not a texture stretched over one box
  addBox(inner, M.steelDark, 0, 1.5, 0, 6.05, 2.5, 2.5);
  const tones = [M.steel, M.steel, M.primer, M.steelDark, M.scorch, M.steel];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 2; j++) {
        const x = -2.15 + i * 1.42;
        const y = 0.95 + j * 1.12;
        const missing = side > 0 && i === 2 && j === 0;
        if (missing) {
          // the plate is gone: two ribs and a dark bay
          addBox(inner, M.latch, x, y, side * 1.2, 1.15, 0.05, 0.06);
          addBox(inner, M.latch, x, y, side * 1.2, 0.05, 0.9, 0.06);
          addBox(inner, M.scorch, x, y, side * 1.18, 0.9, 0.7, 0.02);
          continue;
        }
        const tone = tones[(i + j + (side < 0 ? 2 : 0)) % tones.length];
        const plate = addBox(inner, tone, x, y, side * 1.31, 1.28, 0.98, 0.05);
        if (i === 0 && j === 1 && side < 0) plate.rotation.y = 0.04;   // one plate cocked out of the row
      }
    }
  }
  // roof plates, one of them scorched
  for (let i = 0; i < 4; i++) {
    addBox(inner, i === 3 ? M.scorch : (i === 1 ? M.primer : M.steel), -2.15 + i * 1.42, 2.8, 0, 1.28, 0.05, 2.15);
  }
  // broken hazard paint: segments, not one clean stripe, and two of them missing
  for (let i = 0; i < 9; i++) {
    if (i === 3 || i === 7) continue;
    addBox(inner, i % 2 ? M.hazard : M.hazardK, -2.5 + i * 0.62, 2.86, 0.55, 0.28, 0.035, 0.22);
  }
  // the door on the +X end, with four dog latches and a handle
  addBox(inner, M.steelDark, 3.1, 1.5, 0, 0.08, 2.15, 2.15);
  addBox(inner, M.steel, 3.16, 1.55, 0, 0.05, 1.7, 1.7);
  for (const [y, z] of [[0.9, -0.55], [0.9, 0.55], [2.15, -0.55], [2.15, 0.55]]) {
    addBox(inner, M.latch, 3.22, y, z, 0.06, 0.16, 0.16);
    addCyl(inner, M.latch, 3.26, y, z, 0.025, 0.08, seg, 'x');
  }
  addBox(inner, M.hazard, 3.22, 1.15, 0.85, 0.04, 0.5, 0.1);
  // scorch up the port quarter, where something burned on the way down
  addBox(inner, M.scorch, -2.3, 2.15, -1.32, 1.3, 0.9, 0.03);
  addBox(inner, M.scorch, -1.4, 1.1, -1.32, 0.7, 0.45, 0.025);
  // skids and tie-down lugs
  for (const s of [-1, 1]) {
    addBox(inner, M.skid, 0.1, 0.14, s * 0.72, 5.5, 0.12, 0.16);
    if (!low) {
      addBox(inner, M.latch, -2.6, 0.28, s * 1.15, 0.12, 0.12, 0.12);
      addBox(inner, M.latch, 2.5, 0.28, s * 1.15, 0.12, 0.12, 0.12);
    }
  }
  // vents on the starboard side
  for (let i = 0; i < (low ? 4 : 7); i++) addBox(inner, M.steelDark, -0.3 + i * 0.18, 2.15, 1.33, 0.07, 0.42, 0.02);
  // a short mast, the distress lamp, and a red sidelight that stays on
  addCyl(inner, M.steelDark, -2.35, 3.15, 0.4, 0.04, 0.7, seg, 'y');
  addCyl(inner, M.cable, -2.15, 2.5, 0.55, 0.012, 0.8, 5, 'y');
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.11, low ? 8 : 12, low ? 6 : 8), new THREE.MeshBasicMaterial({ color: 0xffb23a, toneMapped: false, fog: false }));
  lamp.name = 'cargo-beacon';
  lamp.position.set(-2.35, 3.55, 0.4);
  inner.add(lamp);
  const side = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.05), new THREE.MeshBasicMaterial({ color: 0xff3a2a, toneMapped: false, fog: false }));
  side.name = 'cargo-sidelight';
  side.position.set(2.4, 2.7, -1.34);
  inner.add(side);
  if (!low) addCyl(inner, M.steelDark, 1.8, 3.25, -0.6, 0.015, 0.7, 5, 'y');

  const decal = decalMesh(stencil('PHB-04', 'CARGO  DRIFT'), 0.9, 0.42, 0.2, 1.7, 1.35, 0);
  inner.add(decal);

  bake(inner, new Set(['cargo-beacon', 'cargo-sidelight', 'hardware-decal']));
  // listed, as if it struck and stayed. Lift it so the low skid meets the ground (settle() redoes this against the real slope).
  inner.rotation.set(0.05, 0.46, 0.12);
  inner.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(inner);
  inner.position.y = -bb.min.y + 0.03;
  g.userData.parts = parts;
  g.userData.kind = 'cargo-module';

  /**
   * Seat the module on real ground. `heightAt(x, z)` is the ground's height above the module's origin plane, at a point of
   * that plane (the group's own frame, +Y up). The pod is laid on the best-fit plane through six points along its two skids,
   * kept a little off true (it came down hard), lifted until nothing is below the ground, and every skid point that is left
   * hanging in the air gets a prop to the dirt: a steel post on a flat foot, set a little way into the ground. So it rests
   * on six points and not one, whatever the slope. Safe to call once.
   */
  function settle(heightAt) {
    const YAW = 0.46, pts = [];
    for (const sx of [-2.7, 0, 2.7]) for (const sz of [-0.72, 0.72]) pts.push([sx, sz]);
    // 1. plane fit on the ground under the skids, in the module's yawed footprint
    const c = Math.cos(YAW), sn = Math.sin(YAW);
    const place = pts.map(([x, z]) => [x * c + z * sn, -x * sn + z * c]);
    let sx = 0, sz = 0, sy = 0, sxx = 0, szz = 0, sxz = 0, sxy = 0, szy = 0;
    const H = place.map(([x, z]) => heightAt(x, z));
    place.forEach(([x, z], i) => { const h = H[i]; sx += x; sz += z; sy += h; sxx += x * x; szz += z * z; sxz += x * z; sxy += x * h; szy += z * h; });
    const n = place.length;
    // normal equations for h = a x + b z + d
    const m = [[sxx, sxz, sx, sxy], [sxz, szz, sz, szy], [sx, sz, n, sy]];
    for (let i = 0; i < 3; i++) {
      let p = i; for (let r = i + 1; r < 3; r++) if (Math.abs(m[r][i]) > Math.abs(m[p][i])) p = r;
      [m[i], m[p]] = [m[p], m[i]];
      for (let r = i + 1; r < 3; r++) { const f = m[r][i] / (m[i][i] || 1e-9); for (let k = i; k < 4; k++) m[r][k] -= f * m[i][k]; }
    }
    const d = m[2][3] / (m[2][2] || 1e-9), b = (m[1][3] - m[1][2] * d) / (m[1][1] || 1e-9), a = (m[0][3] - m[0][1] * b - m[0][2] * d) / (m[0][0] || 1e-9);
    const slope = new THREE.Vector3(-a, 1, -b).normalize();
    // a pod does not sit square on a 20 degree slope: it settles at most 9 degrees off level, and props take up the rest
    const fullDeg = Math.acos(Math.min(1, slope.y)), keep = Math.min(1, 0.157 / (fullDeg || 1e-6));
    slope.lerp(new THREE.Vector3(0, 1, 0), 1 - keep).normalize();
    const tilt = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), slope);
    // 2. the pod lies on that plane, with a small list of its own
    const q = tilt.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.02, YAW, 0.04, 'YXZ')));
    inner.quaternion.copy(q);
    inner.position.set(0, 0, 0);
    inner.updateMatrixWorld(true);
    // 3. lift until no skid point is under the ground
    const feet = pts.map(([x, z]) => {
      const w = new THREE.Vector3(x, 0.08, z).applyMatrix4(inner.matrix);
      return { w, ground: heightAt(w.x, w.z) };
    });
    let lift = -Infinity;
    for (const f of feet) lift = Math.max(lift, f.ground - f.w.y);
    inner.position.y = lift;
    // 4. a prop under every point that is left in the air
    const props = new THREE.Group();
    const postMat = _shared.steelDark, footMat = _shared.skid;
    let posts = 0;
    for (const f of feet) {
      const bottom = f.w.y + lift, gap = bottom - f.ground;
      if (gap < 0.04) continue;
      const len = gap + 0.14;
      addCyl(props, postMat, f.w.x, bottom - len / 2 + 0.02, f.w.z, 0.09, len, seg, 'y');
      addCyl(props, footMat, f.w.x, f.ground - 0.1, f.w.z, 0.2, 0.08, seg, 'y');
      posts++;
    }
    if (posts) { g.add(props); bake(props, new Set()); }
    g.userData.settled = { groundSlopeDeg: fullDeg * 180 / Math.PI, tiltDeg: Math.acos(Math.min(1, slope.y)) * 180 / Math.PI, lift, posts, gaps: feet.map((f) => f.w.y + lift - f.ground) };
    return g.userData.settled;
  }

  return { group: g, lamp, settle };
}

/** Triangles in a built prop, for the phone budget. */
export function hardwareTriangles(obj) {
  let n = 0;
  obj.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const g = o.geometry;
    n += (g.index ? g.index.count : g.attributes.position.count) / 3;
  });
  return n;
}
