// Openings — windows as real assemblies instead of rectangles on a wall.
//
// WHAT WAS THERE
// Each "window" was a single 45 mm glass slab sitting 18 mm PROUD of the facade:
// no frame, no mullion, no sill, no reveal. Backwards from how a real opening
// reads — an opening recesses and only the sill projects. Measured heights were
// 0.495-0.62 m against a ~1.2 m domestic norm.
//
// WHY THE FRAME PROJECTS RATHER THAN THE GLASS RECESSING
// The walls are solid boxes with no hole cut in them — the old slab was stuck on
// the outside. Recessing glass into the wall would simply bury it inside the
// solid. Cutting real openings means rebuilding the facades as geometry (CSG on
// a merged, material-batched mesh at runtime is fragile and slow). So the frame
// and sill project outward and the glass sits at the wall face: the pane reads
// as set ~70 mm inside its frame, and the sill throws a genuine shadow line.
// Real reveals come with the procedural facade rebuild, not from patching a GLB.
//
// COST
// Everything merges into three geometries (frame / stone / glass), so the whole
// town's windows are 3 draw calls regardless of count.
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.module.js";
import { mergeGeometries } from "https://cdn.jsdelivr.net/npm/three@0.182.0/examples/jsm/utils/BufferGeometryUtils.js";

// Section sizes in metres — joinery, not decoration.
const FRAME_SECTION = 0.055;  // stile/rail width
const FRAME_DEPTH   = 0.085;  // how far the frame stands off the wall
const GLASS_INSET   = 0.012;  // glass sits just off the wall face, inside the frame
const MULLION       = 0.042;
const TRANSOM       = 0.036;
const SILL_PROJECT  = 0.075;  // proud of the facade — this is the shadow line
const SILL_THICK    = 0.055;
const SILL_OVERHANG = 0.055;  // beyond the frame each side
const LINTEL_THICK  = 0.05;
const LINTEL_PROJECT = 0.035;

/**
 * Reproduce the generator's window layout for one building, in three.js world
 * coordinates. Blender authored these Z-up with y = -z_three; glTF export maps
 * Blender (X,Y,Z) -> three (X, Z, -Y), so a Blender "front" face at by - d/2
 * lands on the +Z side in three.
 */
export function windowLayout(b) {
  const wall = 0.16;
  const out = [];
  const floors = Math.max(1, Math.round(b.height / 1.5));
  for (let floor = 0; floor < floors; floor++) {
    const wz = Math.min(b.height - 0.62, 0.78 + floor * (b.height - 0.7) / Math.max(1, floors));
    const windowH = Math.min(0.62, b.height / (floors + 1) * 0.54);
    const cols = Math.max(2, Math.round(b.width / 1.25));
    for (let col = 0; col < cols; col++) {
      const wx = b.x - b.width * 0.39 + (b.width * 0.78) * (col + 0.5) / cols;
      const winW = b.width * 0.68 / cols;
      out.push({ x: wx, y: wz, z: b.z + b.depth / 2 + wall, w: winW, h: windowH, yaw: 0 });
      out.push({ x: wx, y: wz, z: b.z - b.depth / 2 - wall, w: winW, h: windowH, yaw: Math.PI });
    }
    const sideCols = Math.max(1, Math.round(b.depth / 1.5));
    for (let col = 0; col < sideCols; col++) {
      const wzz = b.z + b.depth * 0.36 - (b.depth * 0.72) * (col + 0.5) / sideCols;
      const winW = b.depth * 0.6 / sideCols;
      out.push({ x: b.x - b.width / 2 - wall, y: wz, z: wzz, w: winW, h: windowH, yaw: -Math.PI / 2 });
      out.push({ x: b.x + b.width / 2 + wall, y: wz, z: wzz, w: winW, h: windowH, yaw: Math.PI / 2 });
    }
  }
  return out;
}

/** Local-space assembly: facade plane at z = 0, outward = +Z, centred on (0,0). */
function assemblyParts(w, h) {
  const frame = [];
  const stone = [];
  const glass = [];
  const box = (sx, sy, sz, px, py, pz) => {
    const g = new THREE.BoxGeometry(sx, sy, sz);
    g.translate(px, py, pz);
    return g;
  };

  const fz = FRAME_DEPTH / 2;                    // frame centre, standing off the wall
  const hw = w / 2, hh = h / 2;

  // Jambs, head and cill of the frame itself.
  frame.push(box(FRAME_SECTION, h, FRAME_DEPTH, -hw + FRAME_SECTION / 2, 0, fz));
  frame.push(box(FRAME_SECTION, h, FRAME_DEPTH,  hw - FRAME_SECTION / 2, 0, fz));
  frame.push(box(w - FRAME_SECTION * 2, FRAME_SECTION, FRAME_DEPTH, 0,  hh - FRAME_SECTION / 2, fz));
  frame.push(box(w - FRAME_SECTION * 2, FRAME_SECTION, FRAME_DEPTH, 0, -hh + FRAME_SECTION / 2, fz));

  // A single pane reads as a hole; a mullion and transom read as a window.
  const innerW = w - FRAME_SECTION * 2;
  const innerH = h - FRAME_SECTION * 2;
  if (w > 0.7) frame.push(box(MULLION, innerH, FRAME_DEPTH * 0.8, 0, 0, fz * 0.9));
  if (h > 0.5) frame.push(box(innerW, TRANSOM, FRAME_DEPTH * 0.8, 0, innerH * 0.16, fz * 0.9));

  // Glass just off the wall face, so it sits ~70 mm inside the frame.
  glass.push(box(innerW, innerH, 0.010, 0, 0, GLASS_INSET));

  // Projecting sill — slightly wider than the frame, and the reason the opening
  // casts a line across the brick instead of floating on it.
  stone.push(box(w + SILL_OVERHANG * 2, SILL_THICK, SILL_PROJECT + 0.06,
                 0, -hh - SILL_THICK / 2, (SILL_PROJECT - 0.06) / 2));
  // Lintel / head band.
  stone.push(box(w + SILL_OVERHANG * 1.4, LINTEL_THICK, LINTEL_PROJECT + 0.06,
                 0, hh + LINTEL_THICK / 2, (LINTEL_PROJECT - 0.06) / 2));

  return { frame, stone, glass };
}

/**
 * Build every building's windows into three merged meshes.
 * @returns {{group: THREE.Group, boxes: Array, stats: object}}
 *   `boxes` are world-space AABBs of the OLD flat slabs, for stripGlassQuads().
 */
export function buildOpenings(buildings, materials) {
  const buckets = { frame: [], stone: [], glass: [] };
  const boxes = [];
  let count = 0;

  for (const b of buildings) {
    for (const win of windowLayout(b)) {
      const parts = assemblyParts(win.w, win.h);
      const m = new THREE.Matrix4()
        .makeRotationY(win.yaw)
        .setPosition(win.x, win.y, win.z);
      for (const key of ["frame", "stone", "glass"]) {
        for (const g of parts[key]) { g.applyMatrix4(m); buckets[key].push(g); }
      }
      // The old slab was 45 mm thick, 18 mm proud, at the same centre. Pad
      // generously — this box only needs to catch those quads and miss the
      // streetlamp glows, which share the material but are metres away.
      const pad = 0.12;
      const half = new THREE.Vector3(
        Math.abs(Math.cos(win.yaw)) * (win.w / 2 + pad) + Math.abs(Math.sin(win.yaw)) * 0.09,
        win.h / 2 + pad,
        Math.abs(Math.sin(win.yaw)) * (win.w / 2 + pad) + Math.abs(Math.cos(win.yaw)) * 0.09
      );
      const c = new THREE.Vector3(win.x, win.y, win.z);
      boxes.push(new THREE.Box3(c.clone().sub(half), c.clone().add(half)));
      count++;
    }
  }

  const group = new THREE.Group();
  group.name = "WindowAssemblies";
  const stats = { windows: count, drawCalls: 0, triangles: 0 };

  for (const key of ["frame", "stone", "glass"]) {
    if (!buckets[key].length) continue;
    const merged = mergeGeometries(buckets[key], false);
    for (const g of buckets[key]) g.dispose();
    if (!merged) continue;
    merged.computeVertexNormals();
    const mesh = new THREE.Mesh(merged, materials[key]);
    mesh.name = "Windows_" + key;
    mesh.castShadow = key !== "glass";
    mesh.receiveShadow = key !== "glass";
    group.add(mesh);
    stats.drawCalls++;
    stats.triangles += merged.index ? merged.index.count / 3 : merged.attributes.position.count / 3;
  }
  return { group, boxes, stats };
}

/**
 * Delete the old flat glass slabs from the merged town meshes, by position.
 *
 * The glass materials are shared with streetlamp glows and the door transom, and
 * everything is merged per material, so the mesh cannot simply be hidden.
 * Triangles whose centroid falls inside a window box are dropped; everything
 * else is kept untouched.
 *
 * @returns {{scanned:number, removed:number, meshes:number}}
 */
export function stripGlassQuads(townRoot, boxes) {
  const report = { scanned: 0, removed: 0, meshes: 0 };
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const centroid = new THREE.Vector3();

  townRoot.traverse((child) => {
    if (!child.isMesh) return;
    const name = String(child.material?.name || "").toLowerCase();
    if (!name.includes("glass")) return;

    const geo = child.geometry;
    const pos = geo.attributes.position;
    if (!pos) return;
    child.updateWorldMatrix(true, false);
    const mw = child.matrixWorld;

    const index = geo.index;
    const triCount = index ? index.count / 3 : pos.count / 3;
    const keep = [];
    for (let t = 0; t < triCount; t++) {
      const i0 = index ? index.getX(t * 3) : t * 3;
      const i1 = index ? index.getX(t * 3 + 1) : t * 3 + 1;
      const i2 = index ? index.getX(t * 3 + 2) : t * 3 + 2;
      a.fromBufferAttribute(pos, i0).applyMatrix4(mw);
      b.fromBufferAttribute(pos, i1).applyMatrix4(mw);
      c.fromBufferAttribute(pos, i2).applyMatrix4(mw);
      centroid.copy(a).add(b).add(c).multiplyScalar(1 / 3);
      let inside = false;
      for (let k = 0; k < boxes.length; k++) {
        if (boxes[k].containsPoint(centroid)) { inside = true; break; }
      }
      if (inside) report.removed++;
      else keep.push(i0, i1, i2);
    }
    report.scanned += triCount;
    report.meshes++;
    if (report.removed) geo.setIndex(keep);
  });
  return report;
}
