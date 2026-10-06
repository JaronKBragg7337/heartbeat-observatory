// ============================================================================
// ships/_liner/hullShell.js - the shared hull builder for the big and the small ships of SH14 / SH15.
//
// OWNS: turning a lofted hull table (src/ships/hullLoft.js makeHull) into one plated mesh: rings every dz metres, octagonal sections, a
//       per-vertex colour from the ship's livery (panel tones, a stripe, a dark belly), end caps (the stern cap may carry a ramp hole), and
//       rectangular cut-outs in the vertical flanks (an airlock door, a hangar). Also the lit window rows and the hull-name decal.
// DOES NOT OWN: any ship's table (each ship folder has its own), the interior, or the people.
//
// Client only (it imports three). Folder name starts with '_' so tools/gen-registry.mjs skips it: it is a kit, not a ship.
// ============================================================================

import * as THREE from 'three';

const hash = (a, b = 0) => { const t = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return t - Math.floor(t); };

/**
 * @param hull     makeHull(...) result
 * @param mats     ship materials (uses mats.hull)
 * @param o        { dz, colorFn(x, y, z, ny, f) -> [r,g,b], cutouts: [{ side: +1|-1, z0, z1, y0, y1 }], nose: true, tail: { hole: {x0,x1,y0,y1} } | true }
 * @returns { mesh, caps }
 */
export function buildHullShell(hull, mats, o = {}) {
  const dz = o.dz || 1;
  const cut = o.cutouts || [];
  const zs = [];
  for (let z = hull.z0; z < hull.z1 - 1e-6; z += dz) zs.push(z);
  zs.push(hull.z1);
  // a cut-out must start and end on a ring so its edges are real edges
  // fix-r1: a stepped roof (the Skiff's flight deck sits lower than its cabin). The near-vertical riser between z0 and z1 would stand in the
  // flight deck's view of its own aft door, so its lower part (below yMin) is left to the deck's aft wall, which takes its place.
  const riser = o.riser || null;
  if (riser) for (const z of [riser.z0, riser.z1]) if (!zs.some((q) => Math.abs(q - z) < 1e-6)) zs.push(z);
  for (const c of cut) for (const z of [c.z0, c.z1]) if (!zs.some((q) => Math.abs(q - z) < 1e-6)) zs.push(z);
  zs.sort((a, b) => a - b);
  const rings = zs.map((z) => hull.octagon(z));

  const cum = rings.map((P) => { const c = [0]; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; c.push(c[i] + Math.hypot(b[0] - a[0], b[1] - a[1])); } return c; });
  const posMain = [], uvMain = [], col = [];
  const pos = posMain, uv = uvMain;
  // FIX-R4: o.splitTop {z0,z1}: the roof faces of that stretch go into their own mesh (the 'inside-hidden' deck), so a ship can hide the part of its own skin
  // that lies across a flight deck's console and seats while the camera is aboard. Everything else is unchanged.
  const sp = o.splitTop || null, pos2 = [], uv2 = [];
  let into2 = false;
  const quad = (p0, p1, p2, p3, t0, t1, t2, t3) => {
    const pos = into2 ? pos2 : posMain, uv = into2 ? uv2 : uvMain;          // four [x,y,z] points and their [u,v] (metres): two triangles
    const P = [p0, p1, p2, p0, p2, p3], T = [t0, t1, t2, t0, t2, t3];
    for (let i = 0; i < 6; i++) { pos.push(P[i][0], P[i][1], P[i][2]); uv.push(T[i][0] / 8, T[i][1] / 8); }
  };
  for (let i = 0; i < zs.length - 1; i++) {
    const A = rings[i], B = rings[i + 1], zA = zs[i], zB = zs[i + 1];
    for (let f = 0; f < 8; f++) {
      const a0 = A[f], a1 = A[(f + 1) % 8], b0 = B[f], b1 = B[(f + 1) % 8];
      const side = f === 0 ? 1 : f === 4 ? -1 : 0;
      into2 = !!(sp && f >= 1 && f <= 3 && (zA + zB) / 2 > sp.z0 && (zA + zB) / 2 < sp.z1);
      if (riser && f >= 1 && f <= 3 && Math.abs(zA - riser.z0) < 1e-6 && Math.abs(zB - riser.z1) < 1e-6) {
        const lerpTo = (p, q) => { const t = Math.min(1, Math.max(0, (riser.yMin - p[1]) / Math.max(1e-6, q[1] - p[1]))); return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, zA + (zB - zA) * t]; };
        const c0 = lerpTo(a0, b0), c1 = lerpTo(a1, b1);
        quad(c0, c1, [b1[0], b1[1], zB], [b0[0], b0[1], zB], [cum[i][f], c0[2]], [cum[i][f + 1], c1[2]], [cum[i + 1][f + 1], zB], [cum[i + 1][f], zB]);
        continue;
      }
      const cuts = side ? cut.filter((c) => c.side === side && c.z0 < zB - 1e-6 && c.z1 > zA + 1e-6) : [];
      if (!cuts.length) {
        quad([a0[0], a0[1], zA], [a1[0], a1[1], zA], [b1[0], b1[1], zB], [b0[0], b0[1], zB],
          [cum[i][f], zA], [cum[i][f + 1], zA], [cum[i + 1][f + 1], zB], [cum[i + 1][f], zB]);
        continue;
      }
      // the flank between y lo and y hi: below and above the opening, nothing across it (the ring pair is aligned to the cut-out)
      const lo = Math.min(a0[1], a1[1]), hi = Math.max(a0[1], a1[1]);
      const x = (zz) => side * hull.halfWidth(zz);
      const c = cuts[0];
      const y0 = Math.max(lo, c.y0), y1 = Math.min(hi, c.y1);
      const uy = (y, ring, ri) => (side > 0 ? cum[ri][0] + (y - ring[0][1]) : cum[ri][4] + (ring[4][1] - y));
      const q = (ya, yb) => {
        if (yb - ya < 1e-4) return;
        if (side > 0) quad([x(zA), ya, zA], [x(zA), yb, zA], [x(zB), yb, zB], [x(zB), ya, zB], [uy(ya, A, i), zA], [uy(yb, A, i), zA], [uy(yb, B, i + 1), zB], [uy(ya, B, i + 1), zB]);
        else quad([x(zA), yb, zA], [x(zA), ya, zA], [x(zB), ya, zB], [x(zB), yb, zB], [uy(yb, A, i), zA], [uy(ya, A, i), zA], [uy(ya, B, i + 1), zB], [uy(yb, B, i + 1), zB]);
      };
      q(lo, y0); q(y1, hi);
    }
  }
  const colorFn = o.colorFn || (() => [0.85, 0.85, 0.85]);
  const toMesh = (pos, uv, name) => {
    if (!pos.length) return null;
    const col = [];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.computeVertexNormals();
    const nrm = geo.attributes.normal;
    for (let q = 0; q < nrm.count; q += 6) {
      let x = 0, y = 0, z = 0;
      for (let i = 0; i < 6; i++) { x += nrm.getX(q + i); y += nrm.getY(q + i); z += nrm.getZ(q + i); }
      const l = Math.hypot(x, y, z) || 1;
      for (let i = 0; i < 6; i++) nrm.setXYZ(q + i, x / l, y / l, z / l);
    }
    for (let i = 0; i < pos.length / 3; i++) {
      const c = colorFn(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2], nrm.getY(i), nrm.getX(i));
      col.push(c[0], c[1], c[2]);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.computeBoundingSphere(); geo.computeBoundingBox();
    const m = new THREE.Mesh(geo, mats.hull);
    m.name = name; m.castShadow = true; m.receiveShadow = true;
    return m;
  };
  const mesh = toMesh(posMain, uvMain, 'hull');
  const topMesh = toMesh(pos2, uv2, 'hull-top-inside-hidden');

  // end caps: the nose is closed, the tail may have a hole for a ramp
  const caps = new THREE.Group(); caps.name = 'hull-caps';
  const cap = (z, facing, hole) => {
    const P = hull.octagon(z);
    const shape = new THREE.Shape(P.map((p) => new THREE.Vector2(p[0], p[1])));
    if (hole) {
      const h = new THREE.Path();
      h.moveTo(hole.x0, hole.y0); h.lineTo(hole.x1, hole.y0); h.lineTo(hole.x1, hole.y1); h.lineTo(hole.x0, hole.y1); h.closePath();
      shape.holes.push(h);
    }
    const g = new THREE.ShapeGeometry(shape);
    if (facing < 0) { const ix = g.getIndex(); if (ix) { const a = ix.array; for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; } } }
    g.translate(0, 0, z); g.computeVertexNormals();
    if (facing < 0) { const nn = g.attributes.normal; for (let i = 0; i < nn.count; i++) nn.setZ(i, -1); }
    const u = g.attributes.uv; for (let i = 0; i < u.count; i++) u.setXY(i, u.getX(i) / 8, u.getY(i) / 8);
    const cc = o.capColor || [0.4, 0.4, 0.4];
    const arr = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < arr.length; i += 3) { arr[i] = cc[0]; arr[i + 1] = cc[1]; arr[i + 2] = cc[2]; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    const m = new THREE.Mesh(g, mats.hull); m.castShadow = true; m.receiveShadow = true; return m;
  };
  if (o.nose !== false) caps.add(cap(hull.z0, -1, null));
  if (o.tail) caps.add(cap(hull.z1, +1, o.tail === true ? null : o.tail.hole));
  return { mesh, caps, topMesh };
}

/** A tint wobble per panel so a flat hull reads as plates, not paint. Returns a multiplier near 1. */
export function panelTone(x, y, z, panel = 2.2) {
  const px = Math.floor(x / (panel * 0.7)), pz = Math.floor(z / panel), py = Math.floor(y / (panel * 0.8));
  return 0.93 + 0.12 * hash(px * 7 + py * 3, pz);
}
export { hash };

/** Rows of lit windows on the vertical flanks. k is a Kit. Both sides. */
export function windowRows(k, hull, z0, z1, pitch, ys, o = {}) {
  const w = o.w || 0.9, h = o.h || 0.6, key = o.key || 'glowWhite';
  for (let z = z0; z <= z1 + 1e-6; z += pitch) {
    const hw = hull.halfWidth(z);
    for (const y of ys) for (const s of [-1, 1]) {
      if (o.skip && o.skip(s, z, y)) continue;
      const lit = hash(z * 1.7, y + s) > (o.dark ?? 0.08);
      k.box(lit ? key : 'steelDark', s * (hw + 0.015), y, z, 0.03, h, w);
      k.box('steelDark', s * (hw + 0.005), y, z, 0.02, h + 0.14, w + 0.14);
    }
  }
}

/**
 * The ship's name and registry painted along both flanks (a flat plane each, in the hull's own skin). decal is the CanvasTexture the game
 * made with visuals.decalTexture; with none (the validator has no canvas) nothing is drawn. The plane stands 2 cm proud of the flank.
 */
export function nameDecals(root, decal, hull, o) {
  if (!decal) return [];
  const out = [];
  for (const s of [-1, 1]) {
    // the game hands buildExterior a ready MeshBasicMaterial (opts.decal, made from the texture decalTexture returned); a bare texture works too
    const mat = decal.isMaterial ? decal : new THREE.MeshBasicMaterial({ map: decal, transparent: true, toneMapped: false, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(o.w, o.h), mat);
    const hw = hull.halfWidth(o.z);
    m.position.set(s * (hw + 0.025), o.y, o.z);
    m.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2;
    // each flank reads left to right for someone standing outside it (the plane is not mirrored)
    m.name = 'name-decal'; root.add(m); out.push(m);
  }
  return out;
}

/** A canvas decal painter shared by the line ships: big name, registry, a stripe. Returns null where there is no canvas. */
export function paintNameTexture(THREE_, name, registry, o = {}) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null;
  try {
    const c = document.createElement('canvas'); c.width = 2048; c.height = 256;
    const g = c.getContext('2d'); if (!g || typeof g.getImageData !== 'function') return null;
    g.getImageData(0, 0, 1, 1);
    g.clearRect(0, 0, c.width, c.height);
    g.fillStyle = o.ink || '#20242a'; g.font = '800 ' + (o.size || 190) + 'px "Arial Narrow", Arial, sans-serif'; g.textBaseline = 'middle';
    g.fillText(String(name).toUpperCase(), 40, 120);
    g.font = '600 46px ui-monospace, Consolas, monospace'; g.fillStyle = o.ink || '#20242a'; g.fillText(registry, 46, 226);
    const t = new THREE_.CanvasTexture(c); t.colorSpace = THREE_.SRGBColorSpace; t.anisotropy = 4; return t;
  } catch { return null; }
}

/** Clone every material of the set so a ship may recolour its own without touching the Meridian's; paint the livery slots. */
export function finishMats(matsIn, palette) {
  const mats = {};
  for (const k of Object.keys(matsIn)) mats[k] = k === '_textures' ? matsIn[k] : (matsIn[k] && matsIn[k].clone ? matsIn[k].clone() : matsIn[k]);
  if (mats.hullDark && palette.dark != null) mats.hullDark.color.setHex(palette.dark);
  if (mats.hullAccent && palette.accent != null) mats.hullAccent.color.setHex(palette.accent);
  if (mats.hullStripe && palette.stripe != null) mats.hullStripe.color.setHex(palette.stripe);
  if (mats.engineGlow && palette.engine != null) mats.engineGlow.color.setHex(palette.engine);
  return mats;
}
