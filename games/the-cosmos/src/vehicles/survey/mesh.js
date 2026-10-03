// Survey rover mesh. Nose is local −Z (headlights sit at z < 0). Ground is y = 0, wheel axles at y = 0.42.
//
// A pressurised cab on six sprung wheels. The cab is built as thin walls, not solid blocks, so the
// camera can sit inside it: the driver and the right-hand seat look out through a raked windscreen over a
// dash, between A-pillars, under a roof liner. Seats are where def.seats says (x, z); the eye is
// seat.y + def.eye = 1.80 m above the ground, floor at 0.555 m, seat cushion at 1.0 m.
//
// Wheels are separate groups (tyre + rim) so the view can move them with the suspension and the opening
// can roll them about X. Wishbone arms and coil-over dampers are separate meshes that follow each wheel
// through sync() (high tier); on the phone tier they ride in the wheel group, which is cheaper.
// Suspension arms use their own materials: the shared metals carry vertex colours, and a mesh without
// colours would draw black.
//
// update(dt, o) advances the dust plume and the lamp glow; o = { speed, inside, steer }.

import * as THREE from 'three';
import { Kit } from '../../ship/shipKit.js';
import { SURVEY } from './def.js';

const HAS_DOM = typeof document !== 'undefined' && typeof document.createElement === 'function';

// ---- small geometry helpers ------------------------------------------------------------------
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

/** A thin slab whose outer face is the quad a,b,c,d (counter-clockwise seen from outside), t metres deep, so it has an inside too. */
function slab(k, key, a, b, c, d, t, col) {
  const n = norm(cross(sub(b, a), sub(c, a)));
  const off = (p) => [p[0] - n[0] * t, p[1] - n[1] * t, p[2] - n[2] * t];
  k.poly(key, [a, b, c, d], null, col);
  k.poly(key, [off(d), off(c), off(b), off(a)], null, col);
  const P = [a, b, c, d];
  for (let i = 0; i < 4; i++) {
    const p = P[i], q = P[(i + 1) % 4];
    k.poly(key, [p, off(p), off(q), q], null, col);
  }
}

/** A wheel arch: an arc of thin plate over the tyre at (side s, z), with a lip on its outer edge. */
function arch(k, s, z) {
  const x0 = s * 0.86, x1 = s * 1.28, ro = 0.52, ri = 0.48, cy = SURVEY.wheelRadius, steps = 7, span = 1.05;
  const P = (x, r, a) => [x, cy + r * Math.cos(a), z + r * Math.sin(a)];
  for (let i = 0; i < steps; i++) {
    const a0 = -span + (2 * span * i) / steps, a1 = -span + (2 * span * (i + 1)) / steps;
    const top = [P(x0, ro, a0), P(x1, ro, a0), P(x1, ro, a1), P(x0, ro, a1)];
    k.poly('plasticDark', s > 0 ? top.slice().reverse() : top);
    const lip = [P(x1, ri, a0), P(x1, ro, a0), P(x1, ro, a1), P(x1, ri, a1)];
    k.poly('plasticDark', s > 0 ? lip : lip.slice().reverse());
  }
}

/** Wedge: a block whose top and front slope. Back face open (it sits against the cab). */
function wedge(k, key, w, yBot, zBack, yTopBack, zFront, yTopFront, col) {
  const x = w / 2;
  k.poly(key, [[-x, yTopBack, zBack], [x, yTopBack, zBack], [x, yTopFront, zFront], [-x, yTopFront, zFront]], null, col);
  k.poly(key, [[-x, yTopFront, zFront], [x, yTopFront, zFront], [x, yBot, zFront], [-x, yBot, zFront]], null, col);
  k.poly(key, [[x, yBot, zBack], [x, yBot, zFront], [x, yTopFront, zFront], [x, yTopBack, zBack]], null, col);
  k.poly(key, [[-x, yBot, zFront], [-x, yBot, zBack], [-x, yTopBack, zBack], [-x, yTopFront, zFront]], null, col);
}

/** Merge BufferGeometries that share the same attributes (position, normal, uv), non-indexed result. */
function mergeGeos(list) {
  let n = 0;
  const flat = list.map((g) => (g.index ? g.toNonIndexed() : g));
  for (const g of flat) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  let o = 0;
  for (const g of flat) {
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return out;
}

/** Tyre: a lathe with a real sidewall and rounded shoulders, plus tread lugs, as one geometry. Axle along X, radius = wheelRadius. */
function tyreGeometry(R, low) {
  const hw = 0.17, r0 = 0.3, tread = R - 0.018;
  const prof = [
    [r0, -hw + 0.01], [tread - 0.07, -hw], [tread - 0.02, -hw + 0.04], [tread, -0.06],
    [tread, 0.06], [tread - 0.02, hw - 0.04], [tread - 0.07, hw], [r0, hw - 0.01],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const body = new THREE.LatheGeometry(prof, low ? 12 : 26);
  body.rotateZ(Math.PI / 2);                    // lathe axis Y -> axle X
  const parts = [body];
  const n = low ? 8 : 16, lug = new THREE.BoxGeometry(0.26, 0.036, 0.075);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), a);
    // staggered chevron: alternate lugs shift sideways so the tread is not one straight bar
    const sx = (i % 2 ? 1 : -1) * 0.012;
    m.compose(new THREE.Vector3(sx, Math.cos(a) * (tread + 0.014), Math.sin(a) * (tread + 0.014)), q, new THREE.Vector3(1, 1, 1));
    parts.push(lug.clone().applyMatrix4(m));
  }
  const g = mergeGeos(parts);
  lug.dispose();
  return g;
}

/** Rim: a dished disc, six lug nuts, a hub cap and a brake disc, one geometry with vertex colours. */
function rimGeometry(R, low, side) {
  const parts = [], cols = [];
  const add = (geo, rgb) => { parts.push(geo); cols.push(rgb); };
  const disc = new THREE.CylinderGeometry(0.255, 0.255, 0.03, low ? 10 : 20, 1);
  disc.rotateZ(Math.PI / 2);
  add(disc.translate(side * 0.155, 0, 0), [0.62, 0.65, 0.68]);
  const barrel = new THREE.CylinderGeometry(0.27, 0.27, 0.12, low ? 10 : 20, 1, true);
  barrel.rotateZ(Math.PI / 2);
  add(barrel.translate(side * 0.1, 0, 0), [0.5, 0.53, 0.56]);
  const hubcap = new THREE.CylinderGeometry(0.1, 0.12, 0.07, low ? 8 : 12, 1);
  hubcap.rotateZ(Math.PI / 2);
  add(hubcap.translate(side * 0.19, 0, 0), [0.22, 0.24, 0.27]);
  if (!low) {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2, nut = new THREE.CylinderGeometry(0.02, 0.02, 0.03, 5);
      nut.rotateZ(Math.PI / 2);
      add(nut.translate(side * 0.2, Math.cos(a) * 0.17, Math.sin(a) * 0.17), [0.82, 0.84, 0.86]);
    }
    // slots cut into the disc read as dark spokes
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + Math.PI / 5, slot = new THREE.BoxGeometry(0.012, 0.09, 0.05);
      slot.rotateX(a).translate(side * 0.172, Math.cos(a) * 0.2, Math.sin(a) * 0.2);
      add(slot, [0.05, 0.05, 0.06]);
    }
    const brake = new THREE.CylinderGeometry(0.2, 0.2, 0.012, 14);
    brake.rotateZ(Math.PI / 2);
    add(brake.translate(-side * 0.02, 0, 0), [0.3, 0.3, 0.32]);
  }
  const flat = parts.map((g) => (g.index ? g.toNonIndexed() : g));
  const merged = mergeGeos(flat);
  const colors = new Float32Array(merged.attributes.position.count * 3);
  let o = 0;
  flat.forEach((g, i) => { for (let v = 0; v < g.attributes.position.count; v++) { colors[(o + v) * 3] = cols[i][0]; colors[(o + v) * 3 + 1] = cols[i][1]; colors[(o + v) * 3 + 2] = cols[i][2]; } o += g.attributes.position.count; });
  merged.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return merged;
}

const softDot = (() => {
  let tex = null;
  return () => {
    if (tex || !HAS_DOM) return tex;
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    if (!g || !g.createRadialGradient) return null;
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    if (!gr || !gr.addColorStop) return null;
    gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    tex = new THREE.CanvasTexture(c);
    return tex;
  };
})();

export function buildSurveyRover(materials, opts = {}) {
  const low = opts.tier === 'low' || opts.tier === 'safe';
  const R = SURVEY.wheelRadius;
  const root = new THREE.Group();
  root.name = 'survey-rover';
  const k = new Kit();
  const B = (key, cx, cy, cz, w, h, d, c) => (low ? k.box(key, cx, cy, cz, w, h, d) : k.bevelBox(key, cx, cy, cz, w, h, d, c));

  // ---------------------------------------------------------------- undercarriage
  for (const s of [-1, 1]) B('gunmetal', s * 0.52, 0.44, 0, 0.16, 0.12, 4.0, 0.02);
  for (const z of [-1.45, 0, 1.45]) {
    B('gunmetal', 0, 0.44, z, 1.2, 0.1, 0.14, 0.02);
    k.cyl('steelDark', 0, R, z, 0.05, 1.9, 8, { axis: 'x' });
    k.cyl('gunmetal', 0, R, z, 0.14, 0.26, 12, { axis: 'z' });
  }
  B('plasticDark', 0, 0.36, 0.25, 0.92, 0.2, 1.9, 0.03);
  k.box('hazard', 0, 0.255, 0.25, 0.3, 0.005, 0.18);
  B('steelDark', 0, 0.5, -1.95, 1.5, 0.07, 0.5, 0.02);

  // ---------------------------------------------------------------- cab tub: floor, sills, liners
  B('plasticDark', 0, 0.52, -0.2, 1.72, 0.06, 2.9, 0.02);
  k.box('rubber', 0, 0.553, -0.15, 1.5, 0.008, 2.7);
  k.box('hazard', 0, 0.554, -1.5, 0.5, 0.006, 0.12);
  for (const s of [-1, 1]) {
    B('white', s * 0.84, 0.8, -0.2, 0.08, 0.5, 2.9, 0.02);                  // outer sill, y .55–1.05
    B('plasticDark', s * 0.79, 0.86, -0.2, 0.02, 0.38, 2.7, 0.01);          // inner liner
    B('white', s * 0.9, 1.1, -0.2, 0.2, 0.1, 2.9, 0.03);                    // belt shelf over the tyres
    B('fabricGrey', s * 0.755, 1.05, -0.2, 0.07, 0.06, 0.8, 0.02);          // armrest
    k.box('hullAccent', s * 0.941, 0.9, -0.2, 0.012, 0.05, 2.7);                     // livery stripe
    for (const z of [-0.74, 0.46]) k.box('plasticDark', s * 0.94, 0.85, z, 0.012, 0.46, 0.012);   // door seams
    B('steelDark', s * 0.945, 0.94, -0.62, 0.025, 0.035, 0.18, 0.008);      // door handle
    k.cyl('steel', s * 0.8, 2.0, -0.1, 0.012, 0.75, 6, { axis: 'z' });               // grab handle
    k.cyl('steel', s * 0.8, 1.95, -0.45, 0.01, 0.1, 6);
    k.cyl('steel', s * 0.8, 1.95, 0.25, 0.01, 0.1, 6);
    for (const z of [-1.45, 0, 1.45]) arch(k, s, z);
    B('steelDark', s * 0.9, 0.5, -0.2, 0.1, 0.09, 4.0, 0.02);              // side skirt rail
  }
  // ---------------------------------------------------------------- nose
  wedge(k, 'white', 1.76, 0.6, -1.62, 1.26, -2.1, 0.96);
  B('plasticDark', 0, 0.8, -2.12, 1.5, 0.2, 0.05, 0.015);                 // grille band
  for (let i = 0; i < 5; i++) k.box('steelDark', 0, 0.74 + i * 0.04, -2.15, 1.3, 0.012, 0.012);
  B('steelDark', 0, 0.58, -2.15, 1.94, 0.12, 0.12, 0.03);                 // bumper
  k.box('hazard', 0, 0.58, -2.215, 1.2, 0.06, 0.012);
  k.cyl('gunmetal', 0, 0.58, -2.2, 0.075, 0.5, 12, { axis: 'x' });                  // winch drum
  for (const s of [-1, 1]) {
    B('plasticDark', s * 0.62, 0.84, -2.1, 0.36, 0.16, 0.06, 0.02);       // lamp housings
    k.box('glowWhite', s * 0.62, 0.84, -2.135, 0.3, 0.1, 0.012);
    k.box('glowAmber', s * 0.84, 0.82, -2.09, 0.06, 0.1, 0.012);
    k.cyl('steelDark', s * 0.3, 0.55, -2.2, 0.025, 0.1, 6, { axis: 'z' });          // tow hooks
  }
  // wipers
  for (const s of [-1, 1]) k.cyl('plasticDark', s * 0.25, 1.33, -1.58, 0.008, 0.62, 5, { axis: 'x', col: undefined });

  // ---------------------------------------------------------------- the dash and what is on it
  B('plasticDark', 0, 1.2, -1.45, 1.7, 0.2, 0.34, 0.04);                  // top y 1.30
  B('plasticDark', -0.42, 1.34, -1.36, 0.6, 0.1, 0.22, 0.03);             // driver's binnacle
  k.box('plasticDark', 0, 0.8, -1.64, 1.7, 0.5, 0.03);                             // toe board
  // displays tilted at the seats: a dark bezel, a dim glass, and a few lit lines of readout
  const screen = (x0, x1, y0, z0, h, dz, glow) => {
    k.poly('gunmetal', [[x0 - 0.03, y0 - 0.012, z0 + 0.02], [x1 + 0.03, y0 - 0.012, z0 + 0.02], [x1 + 0.03, y0 + h * 1.3 - 0.004, z0 - dz * 1.3 - 0.02], [x0 - 0.03, y0 + h * 1.3 - 0.004, z0 - dz * 1.3 - 0.02]]);
    k.poly('plasticDark', [[x0, y0, z0], [x1, y0, z0], [x1, y0 + h, z0 - dz], [x0, y0 + h, z0 - dz]]);
    const lines = 5, L = Math.hypot(dz, h) || 1, nY = dz / L * 0.006, nZ = h / L * 0.006;
    for (let i = 0; i < lines; i++) {
      const f = (i + 0.7) / (lines + 0.4), w = (0.35 + 0.5 * ((i * 7) % 5) / 4) * (x1 - x0);
      const ya = y0 + h * f + nY, za = z0 - dz * f + nZ, yb = y0 + h * (f + 0.045) + nY, zb = z0 - dz * (f + 0.045) + nZ;
      k.poly(glow, [[x0 + 0.03, ya, za], [x0 + 0.03 + w, ya, za], [x0 + 0.03 + w, yb, zb], [x0 + 0.03, yb, zb]]);
    }
  };
  screen(-0.62, -0.22, 1.385, -1.24, 0.09, 0.1, 'glowCyan');
  screen(0.22, 0.62, 1.335, -1.28, 0.065, 0.1, 'glowGreen');
  for (let i = 0; i < 4; i++) k.box(i === 2 ? 'glowAmber' : 'glowGreen', -0.05 + i * 0.04, 1.31, -1.32, 0.022, 0.006, 0.03);
  for (const x of [-0.42, 0.42]) { k.box('plasticDark', x, 0.62, -1.5, 0.12, 0.03, 0.1); }   // pedals
  // steering yoke: a ring tilted at the driver's chest, on a column from the binnacle
  {
    const cx = -0.42, cy = 1.24, cz = -1.07, a = -0.62, rr = 0.17, n = 12;
    const pt = (i) => { const f = (i / n) * Math.PI * 2, x = Math.cos(f) * rr, y = Math.sin(f) * rr; return [cx + x, cy + y * Math.cos(a), cz + y * Math.sin(a)]; };
    for (let i = 0; i < n; i++) k.pipe('plasticDark', pt(i), pt(i + 1), 0.013, 5);
    k.pipe('plasticDark', [cx, cy, cz], pt(3), 0.009, 4);
    k.pipe('plasticDark', [cx, cy, cz], pt(9), 0.009, 4);
    k.pipe('steelDark', [cx, cy, cz], [cx, 1.3, -1.3], 0.03, 6);
  }
  // overhead console, cabin lights
  B('plasticDark', 0, 2.075, -0.8, 0.78, 0.06, 0.36, 0.02);
  for (const x of [-0.18, 0.18]) k.box('glowWhite', x, 2.043, -0.8, 0.08, 0.008, 0.08);
  k.box('glowAmber', 0, 2.043, -0.92, 0.3, 0.006, 0.02);
  k.box('glowWhite', 0, 2.113, 0.45, 0.5, 0.008, 0.14);

  // ---------------------------------------------------------------- the glass: windscreen, door windows, rear window
  const WB = [1.3, -1.62], WT = [2.05, -1.12];      // [y, z] of the windscreen's bottom and top edge
  k.poly('glassTint', [[-0.84, WB[0], WB[1]], [0.84, WB[0], WB[1]], [0.82, WT[0], WT[1]], [-0.82, WT[0], WT[1]]]);
  for (const s of [-1, 1]) {
    k.pipe('plasticDark', [s * 0.86, WB[0] - 0.04, WB[1]], [s * 0.84, WT[0] + 0.04, WT[1]], 0.028, 6);       // A-pillar
    k.poly('glassTint', [[s * 0.915, 1.3, -1.6], [s * 0.915, 1.3, 0.36], [s * 0.915, 2.04, 0.36], [s * 0.915, 2.04, -1.14]]);   // door window
    k.poly('glassTint', [[s * 0.915, 1.2, 0.54], [s * 0.915, 1.2, 1.14], [s * 0.915, 2.04, 1.14], [s * 0.915, 2.04, 0.54]]);    // quarter window
    B('plasticDark', s * 0.9, 1.62, 0.45, 0.08, 0.86, 0.1, 0.02);                                    // B-pillar
    B('plasticDark', s * 0.915, 1.27, -0.6, 0.03, 0.05, 1.95, 0.01);                                 // lower window rail
    B('plasticDark', s * 0.915, 1.27, 0.84, 0.03, 0.05, 0.62, 0.01);
    B('plasticDark', s * 0.915, 2.06, -0.38, 0.03, 0.05, 1.55, 0.01);                                // upper rail
    B('plasticDark', s * 0.915, 2.06, 0.84, 0.03, 0.05, 0.62, 0.01);
    B('plasticDark', s * 0.9, 1.62, 1.2, 0.08, 0.86, 0.1, 0.02);                                     // C-pillar
  }
  k.poly('glassTint', [[0.7, 1.4, 1.235], [-0.7, 1.4, 1.235], [-0.7, 2.0, 1.235], [0.7, 2.0, 1.235]]);        // rear window (faces the stern)
  B('white', 0, 1.2, 1.2, 1.76, 0.2, 0.1, 0.03);                                                      // rear bulkhead lower
  for (const s of [-1, 1]) B('white', s * 0.8, 1.7, 1.2, 0.2, 0.7, 0.1, 0.03);

  // ---------------------------------------------------------------- roof
  B('white', 0, 2.17, 0.05, 1.9, 0.09, 2.5, 0.03);                         // z −1.2 … 1.3
  B('plasticDark', 0, 2.1, -1.17, 1.8, 0.07, 0.1, 0.02);                  // windscreen header
  k.box('hullAccent', 0, 2.218, 0.05, 0.5, 0.004, 2.4);
  B('plasticDark', 0, 2.26, -1.0, 1.4, 0.08, 0.16, 0.03);                 // light bar
  for (let i = 0; i < 5; i++) k.box('glowWhite', -0.5 + i * 0.25, 2.262, -1.085, 0.18, 0.04, 0.012);
  for (const s of [-1, 1]) {                                                         // roof rails and a sample tube
    k.pipe('steel', [s * 0.8, 2.3, -0.5], [s * 0.8, 2.3, 1.2], 0.014, 5);
    for (const z of [-0.5, 0.35, 1.2]) k.pipe('steel', [s * 0.8, 2.22, z], [s * 0.8, 2.3, z], 0.012, 5);
  }
  k.cyl('white', 0.34, 2.36, 0.5, 0.07, 1.2, 10, { axis: 'z' });
  k.cyl('hazard', 0.34, 2.36, 0.0, 0.074, 0.08, 10, { axis: 'z' });
  k.cyl('steelDark', -0.5, 2.28, 0.95, 0.03, 0.12, 6);                               // beacon base
  k.cyl('glowAmber', -0.5, 2.36, 0.95, 0.045, 0.06, 8);
  k.cyl('steel', 0.62, 2.55, 1.15, 0.01, 0.75, 5);                                   // whip
  k.cyl('steelDark', 0.62, 2.24, 1.15, 0.03, 0.06, 6);
  k.dome('white', -0.1, 2.3, 0.62, 0.22, low ? 10 : 16, low ? 4 : 6, { thetaMax: Math.PI * 0.5 });   // dish
  k.cyl('steelDark', -0.1, 2.25, 0.62, 0.025, 0.1, 6);

  // ---------------------------------------------------------------- rear deck, stowage, stern
  B('steelDark', 0, 0.98, 1.72, 1.84, 0.06, 0.9, 0.02);
  for (const s of [-1, 1]) {
    B('white', s * 0.92, 1.1, 1.72, 0.06, 0.2, 0.9, 0.02);
    k.box('hazard', s * 0.945, 1.1, 1.72, 0.006, 0.06, 0.7);
  }
  B('crateA', -0.42, 1.24, 1.64, 0.66, 0.44, 0.52, 0.04);
  B('crateB', 0.46, 1.17, 1.8, 0.58, 0.3, 0.46, 0.04);
  k.box('steel', -0.42, 1.466, 1.64, 0.5, 0.01, 0.02);
  k.cyl('pipeBlue', 0.62, 1.3, 2.0, 0.07, 0.6, 10);
  k.cyl('pipeYellow', 0.46, 1.3, 2.0, 0.065, 0.6, 10);
  k.pipe('steel', [0.1, 1.03, 1.35], [0.1, 1.55, 1.35], 0.012, 5);                  // tie-down stanchions
  k.pipe('steel', [-0.9, 1.03, 2.05], [-0.9, 1.3, 2.05], 0.012, 5);
  B('steelDark', 0, 0.62, 2.15, 1.94, 0.12, 0.12, 0.03);                  // rear bumper
  k.box('hazard', 0, 0.8, 2.165, 0.9, 0.07, 0.012);
  for (const s of [-1, 1]) {
    B('plasticDark', s * 0.78, 0.9, 2.12, 0.24, 0.14, 0.06, 0.02);
    k.box('glowRed', s * 0.78, 0.9, 2.152, 0.2, 0.09, 0.012);
    k.box('glowWhite', s * 0.5, 0.74, 2.16, 0.07, 0.05, 0.012);
  }
  k.cyl('steelDark', 0, 0.62, 2.26, 0.03, 0.18, 8, { axis: 'z' });                  // hitch

  // The cab's own glass: a touch denser than the ships' tint so the windscreen and doors read from outside.
  const glass = materials.glassTint.clone();
  glass.opacity = 0.34; glass.color.setHex(0x6f93a6); glass.roughness = 0.04; glass.metalness = 0.55;
  const body = k.toGroup({ ...materials, glassTint: glass }, { name: 'survey-body', cast: true, receive: true });
  for (const m of body.children) if (m.material === glass) { m.castShadow = false; m.renderOrder = 2; }
  root.add(body);

  // ---------------------------------------------------------------- seats (a second kit: fabric)
  const sk = new Kit();
  // lighter than the bare fabric: the cab's roof shades the seats, and a black seat in a pale cab reads as a hole
  const LIT = { col: [2.1, 2.05, 2.0] };
  const SB = (key, cx, cy, cz, w, h, d, c) => (low ? sk.box(key, cx, cy, cz, w, h, d, LIT) : sk.bevelBox(key, cx, cy, cz, w, h, d, c, LIT));
  const seat = (x, z, back = true) => {
    sk.cyl('steelDark', x, 0.78, z, 0.07, 0.4, 8);
    SB('fabricGrey', x, 0.96, z, 0.46, 0.09, 0.46, 0.04);
    SB('fabricGrey', x - 0.22, 1.0, z, 0.06, 0.12, 0.44, 0.03);
    SB('fabricGrey', x + 0.22, 1.0, z, 0.06, 0.12, 0.44, 0.03);
    if (back) {
      SB('fabricGrey', x, 1.36, z + 0.3, 0.44, 0.7, 0.12, 0.05);
      SB('fabricGrey', x, 1.78, z + 0.31, 0.26, 0.2, 0.1, 0.04);
      sk.box('red', x + 0.14, 1.45, z + 0.235, 0.05, 0.5, 0.008);                    // belt
    }
  };
  seat(-0.42, -0.85); seat(0.42, -0.85); seat(-0.42, 0.55); seat(0.42, 0.55);
  root.add(sk.toGroup(materials, { name: 'survey-seats', cast: false, receive: true }));

  // ---------------------------------------------------------------- wheels
  const rubber = new THREE.MeshStandardMaterial({ color: 0x1b1d20, roughness: 0.94, metalness: 0.0 });
  const rimMat = new THREE.MeshStandardMaterial({ vertexColors: true, color: 0xffffff, roughness: 0.42, metalness: 0.55 });
  const arm = new THREE.MeshStandardMaterial({ color: 0x8b939c, roughness: 0.4, metalness: 0.5 });
  const springMat = new THREE.MeshStandardMaterial({ color: 0xd9691c, roughness: 0.45, metalness: 0.4 });
  const tyreGeo = tyreGeometry(R, low);
  const rimGeoL = rimGeometry(R, low, -1), rimGeoR = rimGeometry(R, low, 1);
  const wheels = [], susp = [];
  const unit = new THREE.CylinderGeometry(1, 1, 1, 5);                              // unit-length bar, stretched between two points
  for (const w of SURVEY.wheels) {
    const g = new THREE.Group();
    g.name = 'wheel-' + w.id;
    g.position.set(w.x, R, w.z);
    const side = Math.sign(w.x);                                                      // +1 right
    const tyre = new THREE.Mesh(tyreGeo, rubber);
    tyre.castShadow = !low;
    const rim = new THREE.Mesh(side > 0 ? rimGeoR : rimGeoL, rimMat);
    g.add(tyre, rim);
    root.add(g);
    wheels.push(g);
    // wishbone + coil-over: fixed chassis points, free end at the hub
    const inner = [side * 0.58, 0.5, w.z], mount = [side * 0.66, 1.0, w.z], hubX = side * 0.9;
    const mkBar = (mat, r) => { const m = new THREE.Mesh(unit, mat); m.userData.r = r; m.castShadow = false; return m; };
    const lower = mkBar(arm, 0.032), shock = mkBar(arm, 0.028), spring = mkBar(springMat, 0.05);
    susp.push({ w: g, inner, mount, hubX, lower, shock, spring });
    if (low) { lower.visible = false; shock.visible = false; spring.visible = false; }
    root.add(lower, shock, spring);
  }
  const place = (m, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.hypot(dx, dy, dz) || 1e-4;
    m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx / len, dy / len, dz / len));
    m.scale.set(m.userData.r, len, m.userData.r);
  };
  const sync = () => {
    for (const s of susp) {
      const hub = [s.hubX, s.w.position.y, s.w.position.z];
      const lowerEnd = [s.hubX - Math.sign(s.hubX) * 0.1, s.w.position.y + 0.02, s.w.position.z];
      place(s.lower, s.inner, lowerEnd);
      const mid = [(s.inner[0] + hub[0]) / 2, (s.inner[1] + hub[1]) / 2 + 0.02, s.w.position.z];
      place(s.shock, s.mount, mid);
      place(s.spring, s.mount, [s.mount[0] + (mid[0] - s.mount[0]) * 0.55, s.mount[1] + (mid[1] - s.mount[1]) * 0.55, s.mount[2]]);
    }
  };
  if (!low) sync();

  // ---------------------------------------------------------------- dust plume (stays where it was thrown, so it trails)
  const n = low ? 24 : 64;
  const dustGeo = new THREE.BufferGeometry();
  const dpos = new Float32Array(n * 3), dcol = new Float32Array(n * 4), age = new Float32Array(n).fill(1), vel = new Float32Array(n * 3);
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  dustGeo.setAttribute('color', new THREE.BufferAttribute(dcol, 4));
  const dustMat = new THREE.PointsMaterial({ color: 0xcfa87c, size: low ? 0.7 : 0.55, sizeAttenuation: true, transparent: true, opacity: 1, depthWrite: false, vertexColors: true, map: softDot(), alphaTest: 0.002 });
  const dust = new THREE.Points(dustGeo, dustMat);
  dust.frustumCulled = false;
  dust.name = 'dust-plume';
  root.add(dust);
  let nextDust = 0, acc = 0;
  const update = (dt, o = {}) => {
    const speed = Math.abs(o.speed || 0);
    for (const b of beams) b.visible = !!o.night;                      // the lamp cones are a dusk effect (the opening); in daylight the lamps are just lamps
    const emit = !o.inside && speed > 0.8;
    acc += dt * Math.min(n * 0.9, speed * 4);
    // the dust is simulated in the rover's frame: it falls back at the rover's speed, rises, spreads and fades
    for (let i = 0; i < n; i++) {
      if (age[i] < 1) {
        age[i] += dt / (1.3 + (i % 5) * 0.12);
        dpos[i * 3] += vel[i * 3] * dt;
        dpos[i * 3 + 1] += vel[i * 3 + 1] * dt;
        dpos[i * 3 + 2] += (vel[i * 3 + 2] + (o.speed || 0)) * dt;
        vel[i * 3 + 1] *= 0.97;
        const f = Math.max(0, 1 - age[i]);
        dcol[i * 4] = 0.82; dcol[i * 4 + 1] = 0.66; dcol[i * 4 + 2] = 0.5; dcol[i * 4 + 3] = f * f * Math.min(0.5, 0.12 + speed * 0.03);
      } else dcol[i * 4 + 3] = 0;
    }
    while (emit && acc >= 1) {
      acc -= 1;
      const i = nextDust++ % n, side = (i & 1) ? 1 : -1;
      // thrown up behind the rear wheels
      dpos[i * 3] = side * 1.1 + ((i * 37) % 10 - 5) * 0.03;
      dpos[i * 3 + 1] = 0.1 + ((i * 13) % 6) * 0.03;
      dpos[i * 3 + 2] = 1.7 + ((i * 17) % 8) * 0.05;
      vel[i * 3] = side * (0.25 + ((i * 11) % 7) * 0.08);
      vel[i * 3 + 1] = 0.6 + ((i * 7) % 5) * 0.18;
      vel[i * 3 + 2] = ((i * 5) % 9 - 4) * 0.12;
      age[i] = 0;
    }
    dustGeo.attributes.position.needsUpdate = true;
    dustGeo.attributes.color.needsUpdate = true;
  };

  // ---------------------------------------------------------------- lights: a real spot (high tier) and a soft beam you can see in dust
  const lights = [];
  if (!low) {
    const spot = new THREE.SpotLight(0xfff1dc, 2.2, 16, 0.55, 0.45, 1.4);
    spot.position.set(0, 0.95, -2.2);
    const target = new THREE.Object3D();
    target.position.set(0, 0.3, -9);
    root.add(spot, target);
    spot.target = target;
    lights.push(spot);
  }
  const beamGeo = new THREE.ConeGeometry(1.7, 9, 14, 1, true);
  beamGeo.rotateX(Math.PI / 2);                               // tip at the lamp, widening forward (-Z)
  beamGeo.translate(0, 0, -4.5);
  {
    const p = beamGeo.attributes.position, c = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { const f = Math.min(1, Math.max(0, (-p.getZ(i)) / 9)); const a = 0.03 * (1 - f) * (1 - f); c[i * 3] = a; c[i * 3 + 1] = a * 0.93; c[i * 3 + 2] = a * 0.8; }
    beamGeo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  }
  const beamMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const beams = [];
  for (const s of [-1, 1]) {
    const b = new THREE.Mesh(beamGeo, beamMat);
    b.position.set(s * 0.62, 0.84, -2.15);
    b.rotation.x = 0.1;
    b.scale.set(0.35, 0.35, 1);
    b.name = 'lamp-beam';
    b.visible = false;
    b.frustumCulled = false;
    root.add(b);
    beams.push(b);
  }

  root.userData.dispose = () => {
    glass.dispose(); rubber.dispose(); rimMat.dispose(); arm.dispose(); springMat.dispose(); dustMat.dispose(); dustGeo.dispose();
    tyreGeo.dispose(); rimGeoL.dispose(); rimGeoR.dispose(); unit.dispose(); beamGeo.dispose(); beamMat.dispose();
    for (const c of root.children) if (c.name?.startsWith('survey-')) c.children.forEach((m) => m.geometry?.dispose?.());
  };
  return { group: root, wheels, dust, lights, beams, sync, update, triangles: countTriangles(root) };
}

export function countTriangles(root) {
  let n = 0;
  root.traverse((o) => {
    if (!(o.isMesh || o.isPoints) || !o.geometry || o.isPoints || o.name === 'lamp-beam' || o.visible === false) return;
    const idx = o.geometry.index;
    n += idx ? idx.count / 3 : o.geometry.getAttribute('position').count / 3;
  });
  return n;
}
