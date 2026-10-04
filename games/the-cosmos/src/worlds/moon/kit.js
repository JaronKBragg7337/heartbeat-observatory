// ============================================================================
// worlds/moon/kit.js - what the three Moon settlements are drawn with: the Meridian's own kit (shipKit.js) and the port's PBR materials, plus a few
// shapes a Moon needs (dishes, domes, solar wings, berms, tanks, towers), a one-draw-call sign atlas lettered by F0's faction styles, and a place to
// register the few things that move. Client only (three.js, canvas).
//
// Everything static is merged into one mesh per material, so a settlement is about twenty draw calls on a phone, like Marineris Port and Occator
// Works. Coordinates are outpost-local metres (place.js): x east, y up, z south, origin at the middle of the main pad.
// ============================================================================
import * as THREE from 'three';
import { Kit } from '../../ship/shipKit.js';
import { makePortMaterials } from '../../port/portArt.js';
import { drawSign, drawEmblem } from '../../factions/emblems.js';
import { factionStyle } from '../../factions/registry.js';
import { css } from '../../factions/_kit/style.js';
import { outpostToFrame, frameToOutpost } from './place.js';

/** All the signs of a settlement in one texture and one mesh. Add them while building; `build()` paints the atlas and returns the mesh. */
export class SignAtlas {
  constructor(tier) { this.low = tier === 'low'; this.items = []; this.S = this.low ? 1024 : 2048; this.pxPerM = this.low ? 26 : 44; }
  /** A plate on a wall or a post: (x, y, z) its centre, w x h metres, facing `yaw` (0 = looks toward +z/south), text lettered by `faction`'s style. */
  add(x, y, z, w, h, yaw, faction, text, kind = 'plate', o = {}) { this.items.push({ x, y, z, w, h, yaw, faction, text, kind, o }); }
  build() {
    if (!this.items.length) return null;
    const S = this.S, c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
    let x = 0, y = 0, rowH = 0; const pos = [], uv = [], idx = [];
    for (const it of this.items) {
      const pw = Math.min(S, Math.max(32, Math.round(it.w * this.pxPerM))), ph = Math.min(S, Math.max(16, Math.round(it.h * this.pxPerM)));
      if (x + pw > S) { x = 0; y += rowH + 2; rowH = 0; }
      if (y + ph > S) break;                                     // out of room: the rest stay unlettered (never fails a build)
      try {
        if (it.o.emblem) { const st = factionStyle(it.faction), pl = st.signs.plate; g.fillStyle = css(pl.bg); g.fillRect(x, y, pw, ph); drawEmblem(g, it.faction, x + pw / 2, y + ph / 2, Math.min(pw, ph) * 0.84); }
        else drawSign(g, it.faction, it.text, x, y, pw, ph, it.kind);
      } catch (e) { g.fillStyle = '#444'; g.fillRect(x, y, pw, ph); }
      const u0 = x / S, u1 = (x + pw) / S, v0 = 1 - (y + ph) / S, v1 = 1 - y / S;
      const ca = Math.cos(it.yaw), sa = Math.sin(it.yaw), hw = it.w / 2, hh = it.h / 2;
      const base = pos.length / 3;
      for (const [lx, ly, u, v] of [[-hw, -hh, u0, v0], [hw, -hh, u1, v0], [hw, hh, u1, v1], [-hw, hh, u0, v1]]) {
        // yaw about Y: local +x -> (cos, 0, -sin); the plate faces local +z
        pos.push(it.x + lx * ca, it.y + ly, it.z - lx * sa); uv.push(u, v);
      }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      x += pw + 2; rowH = Math.max(rowH, ph);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    const mesh = new THREE.Mesh(geo, mat); mesh.name = 'moon-signs'; mesh.frustumCulled = false;
    return mesh;
  }
}

/** A fixed-size canvas texture helper for the pad decals. */
export function canvasTexture(size, paint, aniso = 8) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  paint(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
export const rng = (seed) => { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; };

/**
 * One settlement's drawing kit. `ctx` = { engine, world, space, tier }. Returns the builder object K: primitives (B, X, cyl, pipe), the ground height at an
 * outpost-local point, shape helpers, `signs`, `animate(fn)` and `finish()` (merge everything, place it on the pad, return the handle the client uses).
 */
export function makeKit({ engine, world, space, tier }) {
  const low = tier === 'low', body = world.body, pi = body.padInfo, frame = world.frame;
  const art = makePortMaterials(tier, space.ship && space.ship.matsExt ? space.ship.matsExt : null);
  const mats = { ...art.mats };
  // the Moon's own wall: seamless ceramic panels with fine grooves, a few rivets and a little grime (the port's hull texture is rust-streaked Mars paint)
  // a plain steel for rails, masts, pipes and frames (the port's metal is the Meridian's rust-streaked hull steel)
  mats.metal = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.5, metalness: 0.4 });
  mats.panel = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.58, metalness: 0.08, map: canvasTexture(low ? 128 : 256, (g, S) => {
    const r = rng(91); g.fillStyle = '#e4e7ea'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < S * 6; i++) { const v = 205 + Math.floor(r() * 40); g.fillStyle = `rgba(${v},${v},${v + 2},0.35)`; g.fillRect(r() * S, r() * S, 1 + r() * 2, 1 + r() * 2); }
    g.fillStyle = 'rgba(120,128,138,0.55)'; g.fillRect(0, 0, S, 2); g.fillRect(0, S / 2 - 1, S, 2); g.fillRect(0, 0, 2, S); g.fillRect(S / 2 - 1, 0, 2, S);
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(0, 2, S, 1); g.fillRect(2, 0, 1, S);
    g.fillStyle = 'rgba(90,96,104,0.7)'; for (const [x, y] of [[8, 8], [S / 2 - 8, 8], [8, S / 2 - 8], [S / 2 - 8, S / 2 - 8], [S / 2 + 8, 8], [S - 8, 8], [S / 2 + 8, S / 2 - 8], [S - 8, S / 2 - 8], [8, S / 2 + 8], [S / 2 - 8, S / 2 + 8], [8, S - 8], [S / 2 - 8, S - 8], [S / 2 + 8, S / 2 + 8], [S - 8, S / 2 + 8], [S / 2 + 8, S - 8], [S - 8, S - 8]]) g.fillRect(x - 1, y - 1, 3, 3);
    const gr = g.createLinearGradient(0, 0, 0, S); gr.addColorStop(0, 'rgba(60,60,60,0.0)'); gr.addColorStop(1, 'rgba(60,60,60,0.12)'); g.fillStyle = gr; g.fillRect(0, 0, S, S);
  }, 4) });
  const root = new THREE.Group(); root.name = 'moon-outpost:' + body.id;
  const TILES = { paint: 8, panel: 4, metal: 2.5, wall: 2.7, floor: 2, fabric: 1 };
  let k = new Kit(); k.defaultTile = 4; k.tiles = { ...TILES };
  const signs = new SignAtlas(tier);
  const anims = [];                                              // per-frame callbacks (a dish that turns, a searchlight, a blinking lamp)
  const K = { low, body, pi, frame, k, mats, root, signs, THREE, outpostToFrame: (x, y, z) => outpostToFrame(pi, x, y, z), frameToOutpost: (p) => frameToOutpost(pi, p) };
  const B = (key, x, y, z, w, h, d, col, c = 0.04) => k.bevelBox(key, x, y, z, w, h, d, c, col ? { col } : {});
  const X = (key, x, y, z, w, h, d, col, skip) => k.box(key, x, y, z, w, h, d, { col, skip });
  const cyl = (key, x, y, z, r, h, seg, o) => k.cyl(key, x, y, z, r, h, low ? Math.min(seg, 10) : seg, o);
  const pipe = (key, a, b, r, seg = 8, o) => k.pipe(key, a, b, r, low ? 5 : seg, o);
  /** Height of the real ground above the pad's plane at an outpost-local point (so a thing on a slope can stand on it). */
  const groundY = (x, z) => { const p = outpostToFrame(pi, x, 0, z), l = Math.hypot(p.x, p.y, p.z), R = body.surfaceRadius(p.x / l, p.y / l, p.z / l); const s = { x: p.x / l * R - pi.point.x, y: p.y / l * R - pi.point.y, z: p.z / l * R - pi.point.z }; return s.x * pi.up.x + s.y * pi.up.y + s.z * pi.up.z; };
  Object.assign(K, { B, X, cyl, pipe, groundY, animate: (fn) => anims.push(fn) });

  /** A foundation: concrete from the lowest ground under the footprint up to the pad plane (a building on a slope stands on a plinth, not in the air). */
  K.plinth = (x0, z0, x1, z1, col = [0.62, 0.62, 0.6], top = 0) => {
    let lo = top; for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1], [(x0 + x1) / 2, (z0 + z1) / 2]]) lo = Math.min(lo, groundY(x, z));
    if (lo < top - 0.05) B('concrete', (x0 + x1) / 2, (lo + top) / 2 - 0.02, (z0 + z1) / 2, x1 - x0, top - lo + 0.04, z1 - z0, col, 0.06);
  };
  /** A sintered-regolith berm: a long low ramped bank (what the Moon builds against radiation and micrometeorites). */
  K.berm = (x0, z0, x1, z1, h = 2.2, col = [0.46, 0.45, 0.43]) => {
    k.prism('concrete', [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], -0.2, h, h * 1.3, h * 0.95, col);
  };
  /** A pressurised block: walls, a flat roof with a parapet, a strip of lit windows. `o`: { col, win ('strip'|'slit'|'glass'|null), lit, door: { side, c, w, h } , roof, ribs } */
  K.block = (x0, z0, x1, z1, h, o = {}) => {
    const WK = o.wallKey || 'panel', col = o.col || [0.7, 0.72, 0.74], w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    if (o.plinth !== false) K.plinth(x0 - 0.3, z0 - 0.3, x1 + 0.3, z1 + 0.3);
    const door = o.door;
    if (!door) B(WK, cx, h / 2, cz, w, h, d, col, 0.06);
    else {                                                        // four walls and a doorway (walkable inside)
      const t = 0.5, dw = door.w || 3.2, dh = door.h || 2.8, c = door.c || 0;
      const wall = (ax0, az0, ax1, az1) => B(WK, (ax0 + ax1) / 2, h / 2, (az0 + az1) / 2, ax1 - ax0, h, az1 - az0, col, 0.05);
      const side = door.side;
      const piece = (s, a0, a1, b0, b1) => { if (s === side) { const m0 = (a0 + a1) / 2 + c - dw / 2, m1 = (a0 + a1) / 2 + c + dw / 2; wall2(s, a0, m0, b0, b1); wall2(s, m1, a1, b0, b1); lintel(s, m0, m1, b0, b1); } else wall2(s, a0, a1, b0, b1); };
      const wall2 = (s, a0, a1, b0, b1) => { if (a1 - a0 < 0.05) return; if (s === 'n' || s === 's') wall(a0, b0, a1, b1); else wall(b0, a0, b1, a1); };
      const lintel = (s, m0, m1, b0, b1) => { if (s === 'n' || s === 's') B(WK, (m0 + m1) / 2, (dh + h) / 2, (b0 + b1) / 2, m1 - m0, h - dh, b1 - b0, col, 0.04); else B(WK, (b0 + b1) / 2, (dh + h) / 2, (m0 + m1) / 2, b1 - b0, h - dh, m1 - m0, col, 0.04); };
      piece('n', x0, x1, z0, z0 + t); piece('s', x0, x1, z1 - t, z1); piece('w', z0, z1, x0, x0 + t); piece('e', z0, z1, x1 - t, x1);
      X('floor', cx, 0.03, cz, w - 1.2, 0.04, d - 1.2); X('white', cx, h - 0.02, cz, w - 1.2, 0.05, d - 1.2, [0.9, 0.9, 0.9]);
    }
    B('concrete', cx, h + 0.22, cz, w + 0.5, 0.44, d + 0.5, o.roof || [col[0] * 0.8, col[1] * 0.8, col[2] * 0.8], 0.06);     // roof slab / parapet
    if (o.win) {
      const lit = o.lit || 'glowCool', wy = o.winY ?? h * 0.58, wh = o.win === 'slit' ? 0.22 : 0.9;
      for (const [sx, sz, nx, nz, len] of [[cx, z1 + 0.04, 0, 1, w], [cx, z0 - 0.04, 0, -1, w], [x1 + 0.04, cz, 1, 0, d], [x0 - 0.04, cz, -1, 0, d]]) {
        if (door && ((door.side === 's' && nz === 1) || (door.side === 'n' && nz === -1) || (door.side === 'e' && nx === 1) || (door.side === 'w' && nx === -1))) continue;
        const n = Math.max(1, Math.floor(len / (o.win === 'slit' ? 2.4 : 3.6)));
        for (let i = 0; i < n; i++) {
          const t = (i + 0.5) / n - 0.5, px = nz ? sx + t * len : sx, pz = nz ? sz : sz + t * len, ww = o.win === 'slit' ? 1.5 : 2.2;
          if (nz) X(o.win === 'glass' ? 'glassTint' : lit, px, wy, pz, ww, wh, 0.05); else X(o.win === 'glass' ? 'glassTint' : lit, px, wy, pz, 0.05, wh, ww);
        }
      }
    }
    if (o.ribs) for (let t = x0 + 1.5; t < x1 - 1; t += 3) X('steelDark', t, h / 2, z1 + 0.05, 0.12, h - 0.6, 0.08, [0.5, 0.52, 0.55]);
    return { x0, z0, x1, z1, h };
  };
  /** A parabolic dish on a pedestal. (x, z) the base, `r` the dish radius, aimed `az` (compass, radians from -z through +x) and `el` (up from the horizon). */
  K.dish = (x, z, r, az = 0, el = 1.1, o = {}) => {
    if (o.spin) {                                                  // a dish that turns: drawn on its own (centred on its base), a turning group of its own
      const saved = k, g0 = groundY(x, z); k = new Kit(); k.defaultTile = 4; k.tiles = { ...TILES };
      K.dish(0, 0, r, 0, el, { ...o, spin: 0, _ground: 0 });
      const grp = k.toGroup({ ...mats }, { name: 'moon-dish', cast: true, receive: true }); k = saved;
      const pivot = new THREE.Group(); pivot.position.set(x, g0, z); pivot.add(grp); root.add(pivot); grp.rotation.y = -az;
      anims.push((dt) => { grp.rotation.y -= dt * o.spin; });
      return pivot;
    }
    const col = o.col || [0.92, 0.94, 0.96], g = o._ground ?? groundY(x, z), seg = low ? 14 : 22, rings = low ? 4 : 6, f = r * 0.42, py = (o.pedestal ?? r * 0.55) + g;
    cyl('steelDark', x, (g + py) / 2, z, r * 0.1, py - g, 8, { r2: r * 0.07 }); B('concrete', x, g + 0.3, z, r * 0.5, 0.7, r * 0.5, null, 0.08);
    k.push(x, py, z, -az);
    // tilt about the local x axis by (PI/2 - el): the dish's axis (local +y before tilt) points at the sky at elevation `el`
    const ca = Math.cos(Math.PI / 2 - el), sa = Math.sin(Math.PI / 2 - el), T = (px, py2, pz) => [px, py2 * ca - pz * sa, py2 * sa + pz * ca];   // rotate about x
    const ring = (j) => { const rr = r * j / rings; return [rr, rr * rr / (4 * f)]; };
    for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) {
      const a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2, [r0, y0] = ring(j), [r1, y1] = ring(j + 1);
      const P = (rr, yy, a) => T(Math.cos(a) * rr, yy, Math.sin(a) * rr);
      const pts = [P(r0, y0, a0), P(r1, y1, a0), P(r1, y1, a1), P(r0, y0, a1)];
      const nrm = T(0, 1, 0);
      if (j === 0) k._faceQuad('panel', [pts[0], pts[1], pts[2]], nrm, col); else k._faceQuad('panel', pts, nrm, col);
      k._faceQuad('panel', pts.slice().reverse(), [-nrm[0], -nrm[1], -nrm[2]], [0.62, 0.64, 0.68]);          // the back
    }
    // feed horn on three struts
    const tip = T(0, f * 0.95 + 0.1, 0);
    for (let s = 0; s < 3; s++) { const a = s * Math.PI * 2 / 3 + 0.5, e = T(Math.cos(a) * r * 0.82, r * 0.82 * r * 0.82 / (4 * f), Math.sin(a) * r * 0.82); pipe('steelDark', e, tip, Math.max(0.03, r * 0.012), 5); }
    cyl('steelDark', tip[0], tip[1], tip[2], Math.max(0.1, r * 0.04), r * 0.1, 8);
    if (o.rim) { const rr = ring(rings); for (let i = 0; i < seg; i++) { const a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2; pipe(o.rim, T(Math.cos(a0) * rr[0], rr[1], Math.sin(a0) * rr[0]), T(Math.cos(a1) * rr[0], rr[1], Math.sin(a1) * rr[0]), 0.05, 4); } }
    k.pop();
  };
  /** A rectangular solar wing on a mast: `n` panels of w x h, a thin frame and cells. */
  K.solarWing = (x, y, z, w, h, yaw = 0, tilt = 0.3, col = [0.12, 0.2, 0.34]) => {
    k.push(x, y, z, yaw);
    const ca = Math.cos(tilt), sa = Math.sin(tilt), P = (px, py) => [px, py * ca, py * sa];
    k._faceQuad('metal', [P(-w / 2, -h / 2), P(w / 2, -h / 2), P(w / 2, h / 2), P(-w / 2, h / 2)].map((p) => [p[0], p[1], p[2]]), [0, sa, ca], col);
    k._faceQuad('metal', [P(-w / 2, h / 2), P(w / 2, h / 2), P(w / 2, -h / 2), P(-w / 2, -h / 2)].map((p) => [p[0], p[1] - 0.04, p[2]]), [0, -sa, -ca], [0.4, 0.4, 0.42]);
    const n = Math.max(2, Math.round(w / 2.2));
    for (let i = 0; i <= n; i++) { const px = -w / 2 + w * i / n; pipe('steelDark', [px, -h / 2 * ca, -h / 2 * sa], [px, h / 2 * ca, h / 2 * sa], 0.025, 4); }
    for (const sy of [-h / 2, 0, h / 2]) pipe('steelDark', [-w / 2, sy * ca, sy * sa], [w / 2, sy * ca, sy * sa], 0.03, 4);
    k.pop();
  };
  /** A cylindrical tank (upright), with a cap, a ladder and a band. */
  K.tank = (x, z, r, h, col = [0.8, 0.82, 0.84], o = {}) => {
    const g = groundY(x, z);
    K.plinth(x - r, z - r, x + r, z + r);
    cyl('metal', x, h / 2, z, r, h, 18, { col }); cyl('steelDark', x, h + 0.15, z, r * 0.92, 0.3, 14, { r2: r * 0.5 });
    for (const y of [h * 0.3, h * 0.7]) cyl('steelDark', x, y, z, r + 0.04, 0.12, 18);
    if (o.band) cyl(o.band, x, h * 0.5, z, r + 0.03, 0.5, 18);
    pipe('steelDark', [x + r + 0.3, 0.2, z], [x + r + 0.3, h, z], 0.05, 5);
    return g;
  };
  /** A lattice mast (three legs, rungs) with an optional beacon: for floodlights, comms, searchlights and power towers. */
  K.mast = (x, z, h, col = [0.62, 0.64, 0.68], r = 0.9) => {
    const g = groundY(x, z), top = g + h;
    const legs = [0, 1, 2].map((i) => [x + Math.cos(i * 2.094) * r, z + Math.sin(i * 2.094) * r]);
    for (const [lx, lz] of legs) pipe('steelDark', [lx, g, lz], [x + (lx - x) * 0.35, top, z + (lz - z) * 0.35], 0.07, 5);
    const n = Math.max(3, Math.round(h / 6));
    for (let j = 1; j <= n; j++) { const t = j / (n + 1), y = g + h * t, rr = r * (1 - 0.65 * t); for (let i = 0; i < 3; i++) { const a = i * 2.094, b = (i + 1) * 2.094; pipe('steelDark', [x + Math.cos(a) * rr, y, z + Math.sin(a) * rr], [x + Math.cos(b) * rr, y, z + Math.sin(b) * rr], 0.04, 4); } }
    B('concrete', x, g + 0.3, z, r * 2.6, 0.7, r * 2.6, null, 0.08);
    return top;
  };
  /** Hazard stripes, painted rails and bollards. */
  K.bollards = (pts, h = 1.0, col = [0.9, 0.7, 0.16]) => { for (const [x, z] of pts) { cyl('hazard', x, groundY(x, z) + h / 2, z, 0.14, h, 8, { col }); X('glowRed', x, groundY(x, z) + h + 0.03, z, 0.16, 0.06, 0.16); } };
  K.crate = (x, z, w, h, d, col, rot = 0, y0 = null) => { const g = y0 ?? groundY(x, z); k.push(x, g, z, rot); B('paint', 0, h / 2, 0, w, h, d, col, 0.03); X('steelDark', 0, h / 2, d / 2 + 0.006, w * 0.9, 0.06, 0.01); k.pop(); };
  K.barrel = (x, z, col = [0.5, 0.52, 0.55], h = 0.95) => { const g = groundY(x, z); cyl('metal', x, g + h / 2, z, 0.3, h, 10, { col }); cyl('steelDark', x, g + h * 0.3, z, 0.31, 0.05, 10); cyl('steelDark', x, g + h * 0.7, z, 0.31, 0.05, 10); };
  K.lampPost = (x, z, h = 6, glow = 'glowWhite') => { const g = groundY(x, z); cyl('steelDark', x, g + h / 2, z, 0.13, h, 6, { r2: 0.09 }); X(glow, x, g + h + 0.1, z, 0.5, 0.12, 0.5); B('steelDark', x, g + h, z, 0.6, 0.1, 0.6, null, 0.02); };

  /** The painted slab of the main pad: concrete, a decal on top. `paint(ctx, S)` draws it. */
  K.pad = (size, paint, name = 'pad') => {
    const g = X('concrete', 0, -0.14, 0, size, 0.4, size, [0.84, 0.84, 0.82]);
    const tex = canvasTexture(low ? 512 : 1024, paint);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size - 1, size - 1), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 }));
    m.rotation.x = -Math.PI / 2; m.position.set(0, 0.085, 0); m.receiveShadow = true; m.name = name; root.add(m);
    return m;
  };
  /** A wall run that follows the ground: segments of `seg` metres, each standing on the terrain under it. */
  K.wallRun = (x0, z0, x1, z1, h, t = 1.6, o = {}) => {
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(L / (o.seg || 8))), yaw = Math.atan2(-(z1 - z0), x1 - x0);
    const col = o.col || [0.46, 0.46, 0.45];
    for (let i = 0; i < n; i++) {
      const a = i / n, b = (i + 1) / n, mx = x0 + (x1 - x0) * (a + b) / 2, mz = z0 + (z1 - z0) * (a + b) / 2, seg = L / n;
      const g = Math.min(groundY(mx, mz), groundY(x0 + (x1 - x0) * a, z0 + (z1 - z0) * a), groundY(x0 + (x1 - x0) * b, z0 + (z1 - z0) * b));
      k.push(mx, g - 0.5, mz, yaw);
      B('concrete', 0, (h + 0.5) / 2, 0, seg + 0.05, h + 0.5, t, col, 0.08);
      if (o.parapet !== false) B('concrete', 0, h + 0.5 + 0.35, 0, seg + 0.05, 0.7, t + 0.5, [col[0] * 0.9, col[1] * 0.9, col[2] * 0.9], 0.06);
      if (o.buttress && i % 2 === 0) B('concrete', 0, (h + 0.5) / 2, (o.buttress > 0 ? 1 : -1) * (t / 2 + 0.5), 1.4, h + 0.5, 1.0, [col[0] * 0.95, col[1] * 0.95, col[2] * 0.95], 0.06);
      k.pop();
    }
  };

  /** Merge and place: the kit becomes a few meshes, signs one more; the group is tracked in the world's frame at the main pad, axes (east, up, south). */
  K.finish = ({ extra } = {}) => {
    const kitGroup = k.toGroup({ ...mats }, { name: 'moon-kit', cast: true, receive: true });
    root.add(kitGroup);
    const sm = signs.build(); if (sm) root.add(sm);
    if (extra) extra(root);
    const east = new THREE.Vector3(pi.east.x, pi.east.y, pi.east.z), up = new THREE.Vector3(pi.up.x, pi.up.y, pi.up.z), south = new THREE.Vector3().crossVectors(east, up).normalize();
    const quat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(east, up, south));
    engine.scene.add(root);
    const entry = engine.track({ worldPos: { x: pi.point.x, y: pi.point.y, z: pi.point.z }, object3d: root, quaternion: quat, frame });
    K.entry = entry;
    return {
      root, entry,
      tick(dt, t) { for (const f of anims) f(dt, t); },
      dispose() { engine.untrack(entry); engine.scene.remove(root); },
    };
  };
  return K;
}
