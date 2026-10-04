// ============================================================================
// worlds/ceres/outpost.js — OCCATOR WORKS: the Industrial Miners' station on the floor of Occator crater, drawn with the Meridian's own kit
// (shipKit.js and the port's PBR materials) so it holds the same bar as Marineris Port.
//
// WHAT STANDS HERE (layout.js says where; this file says how it looks)
//   the main pad (a concrete slab, stencilled), the FOUNDRY (a hall with a lit furnace mouth, two chimneys, a slag runnel, a portal crane),
//   three ore bins with a belt that climbs from the pit road (a belt that moves), OCCATOR SUPPLY (an open-fronted shed with racks, crates and a
//   counter), the bunkhouse (a row of containers), the lane office (a tower with a dish), a tank farm, two haul trucks, six floodlight masts, barriers,
//   drums, pipes and signs; three beacons on the ore outcrops; and the people (people.js).
// All the static geometry is merged into a handful of meshes (one per material): the phone draws it in about twenty calls.
// Solid things are listed in layout.js (BOXES); update() pushes the walker out of them, as the Mars port does.
// ============================================================================

import * as THREE from 'three';
import { Kit } from '../../ship/shipKit.js';
import { makePortMaterials } from '../../port/portArt.js';
import { buildSampleBeacon } from '../../space/hardware.js';
import { BOXES, MAIN_PAD, WORKERS, OUTPOST_NAME, outpostToFrame, frameToOutpost } from './layout.js';
import { OutpostPeople } from './people.js';

const RUST = [0.62, 0.34, 0.22], RUST2 = [0.5, 0.28, 0.2], SOOT = [0.28, 0.27, 0.27], STEEL = [0.74, 0.76, 0.78], GREY = [0.55, 0.56, 0.58], AMBER = [0.95, 0.66, 0.2];

function signTexture(lines, w = 1024, h = 256, { bg = '#1b130c', fg = '#ffcf7a', border = '#d69a3a', size = 0.28 } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.strokeStyle = border; g.lineWidth = 8; g.strokeRect(10, 10, w - 20, h - 20);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  const n = lines.length;
  lines.forEach((t, i) => { g.font = `${i === 0 ? 800 : 500} ${Math.round(h * (i === 0 ? size : size * 0.62))}px "Arial Narrow", Arial, sans-serif`; g.fillText(t, w / 2, h * ((i + 1) / (n + 1)) + (i === 0 ? -4 : 6), w - 60); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

function padTexture() {
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#6a6862'; g.fillRect(0, 0, S, S);
  let seed = 11; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 24000; i++) { const v = 70 + Math.floor(rnd() * 50); g.fillStyle = `rgba(${v},${v - 2},${v - 6},0.32)`; g.fillRect(Math.floor(rnd() * S), Math.floor(rnd() * S), 1 + Math.floor(rnd() * 2), 1 + Math.floor(rnd() * 2)); }
  g.strokeStyle = '#2f2e2b'; g.lineWidth = 3; for (let i = 1; i < 8; i++) { g.beginPath(); g.moveTo(i * S / 8, 0); g.lineTo(i * S / 8, S); g.moveTo(0, i * S / 8); g.lineTo(S, i * S / 8); g.stroke(); }
  g.strokeStyle = '#e8b53a'; g.lineWidth = 16; g.strokeRect(34, 34, S - 68, S - 68);
  g.lineWidth = 9; g.beginPath(); g.arc(S / 2, S / 2, 360, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#e8b53a'; g.textAlign = 'center'; g.font = 'bold 120px "Arial Narrow", Arial, sans-serif';
  g.fillText('OCCATOR', S / 2, S / 2 - 40); g.fillText('WORKS', S / 2, S / 2 + 90); g.font = 'bold 70px Arial'; g.fillText('PAD 01', S / 2, S - 90);
  // scorch, oil, and rubber from a decade of landings
  for (const [x, y] of [[300, 300], [724, 300], [300, 724], [724, 724]]) { const gr = g.createRadialGradient(x, y, 4, x, y, 90); gr.addColorStop(0, 'rgba(20,20,20,.55)'); gr.addColorStop(1, 'rgba(20,20,20,0)'); g.fillStyle = gr; g.fillRect(x - 100, y - 100, 200, 200); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

function beltTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256;
  const g = c.getContext('2d'); g.fillStyle = '#1d1c1b'; g.fillRect(0, 0, 64, 256);
  g.fillStyle = '#3c3a38'; for (let y = 0; y < 256; y += 32) g.fillRect(2, y, 60, 6);
  g.fillStyle = '#6b4a33'; for (let i = 0; i < 90; i++) g.fillRect(Math.random() * 60 + 2, Math.random() * 250, 3 + Math.random() * 6, 2 + Math.random() * 4);   // ore on the belt
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function buildOutpost({ engine, world, space, tier }) {
  const low = tier === 'low', body = world.body, pi = body.padInfo, frame = world.frame;
  const art = makePortMaterials(tier, space.ship && space.ship.matsExt ? space.ship.matsExt : null);
  const mats = art.mats;
  const root = new THREE.Group(); root.name = 'outpost:' + body.id;
  const k = new Kit(); k.defaultTile = 4; k.tiles = { paint: 8, metal: 1, wall: 2.7, floor: 2, fabric: 1 };
  const B = (key, x, y, z, w, h, d, col, c = 0.04) => k.bevelBox(key, x, y, z, w, h, d, c, col ? { col } : {});
  const X = (key, x, y, z, w, h, d, col, skip) => k.box(key, x, y, z, w, h, d, { col, skip });
  const groundY = (x, z) => { const p = outpostToFrame(pi, x, 0, z), l = Math.hypot(p.x, p.y, p.z), R = body.surfaceRadius(p.x / l, p.y / l, p.z / l); const s = { x: p.x / l * R - pi.point.x, y: p.y / l * R - pi.point.y, z: p.z / l * R - pi.point.z }; return s.x * pi.up.x + s.y * pi.up.y + s.z * pi.up.z; };
  const cyl = (key, x, y, z, r, h, seg, o) => k.cyl(key, x, y, z, r, h, low ? Math.min(seg, 10) : seg, o);
  const pipe = (key, a, b, r, seg = 8, o) => k.pipe(key, a, b, r, low ? 5 : seg, o);
  const ribs = (x, z, along, len, y0, y1, step, side) => {          // corrugation: thin vertical ribs along a wall
    for (let t = -len / 2 + step / 2; t < len / 2; t += step) {
      if (along === 'x') X('steelDark', x + t, (y0 + y1) / 2, z + side * 0.09, 0.08, y1 - y0, 0.06, [0.55, 0.3, 0.2]);
      else X('steelDark', x + side * 0.09, (y0 + y1) / 2, z + t, 0.06, y1 - y0, 0.08, [0.55, 0.3, 0.2]);
    }
  };
  const lamp = (x, y, z, w = 1.0) => { B('steelDark', x, y, z, w + 0.1, 0.12, 0.24, null, 0.02); X('glowAmber', x, y - 0.075, z, w, 0.025, 0.16); };
  const barrel = (x, z, col = RUST2, h = 0.95) => { cyl('metal', x, h / 2, z, 0.3, h, 10, { col }); cyl('steelDark', x, h * 0.3, z, 0.31, 0.05, 10); cyl('steelDark', x, h * 0.7, z, 0.31, 0.05, 10); };
  const crate = (x, z, w, h, d, col, y0 = 0, rot = 0) => { k.push(x, y0, z, rot); B('paint', 0, h / 2, 0, w, h, d, col, 0.03); X('steelDark', 0, h / 2, d / 2 + 0.006, w * 0.9, 0.06, 0.01); k.pop(); };

  // ---- the ground: main pad slab, pavements, the cut road ----------------------------------------------------------------
  X('concrete', 0, -0.2, 0, MAIN_PAD.w, 0.4, MAIN_PAD.d, [0.9, 0.9, 0.88]);
  for (const [x, z, w, d] of [[0, -62, 12, 44], [-50, 0, 90, 12], [60, 0, 30, 10], [-60, -86, 14, 14]]) X('concrete', x, -0.15, z, w, 0.3, d, [0.78, 0.78, 0.76]);          // aprons and roadway
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { cyl('steelDark', sx * 27, 0.55, sz * 27, 0.17, 1.1, 8); X('glowAmber', sx * 27, 1.15, sz * 27, 0.34, 0.12, 0.34); }
  // jersey barriers round the pad's edge, with gaps for the walking routes
  for (let i = -26; i <= 26; i += 4.2) for (const z of [-30.2, 30.2]) { if (Math.abs(i) < 5) continue; B('concrete', i, 0.4, z, 3.6, 0.8, 0.5, [0.8, 0.8, 0.78], 0.06); X('hazard', i, 0.55, z + (z > 0 ? 0.26 : -0.26), 3.2, 0.12, 0.01); }

  // ---- the foundry --------------------------------------------------------------------------------------------------------
  {
    const x0 = -22, x1 = 8, z0 = -112, z1 = -88, H = 9.5;
    B('concrete', (x0 + x1) / 2, -0.15, (z0 + z1) / 2, 32, 0.5, 26, [0.7, 0.7, 0.68], 0.05);
    X('floor', (x0 + x1) / 2, 0.03, (z0 + z1) / 2, 29.4, 0.04, 23.4);
    // walls: north, east, west whole; south in two pieces round a 10 m doorway
    B('wall', (x0 + x1) / 2, H / 2, z0 + 0.4, 30, H, 0.8, RUST, 0.05);
    B('wall', x0 + 0.4, H / 2, (z0 + z1) / 2, 0.8, H, 24, RUST, 0.05);
    B('wall', x1 - 0.4, H / 2, (z0 + z1) / 2, 0.8, H, 24, RUST, 0.05);
    B('wall', x0 + 6.5, H / 2, z1 - 0.4, 13, H, 0.8, RUST, 0.05);
    B('wall', x1 - 3.5, H / 2, z1 - 0.4, 7, H, 0.8, RUST, 0.05);
    B('wall', -4, H - 1.4, z1 - 0.4, 10, 2.8, 0.8, RUST, 0.05);          // the lintel over the doorway
    ribs(x0 + 6.5, z1 + 0.05, 'x', 13, 0.6, H - 0.4, 1.3, 1); ribs(x1 - 3.5, z1 + 0.05, 'x', 7, 0.6, H - 0.4, 1.3, 1);
    ribs((x0 + x1) / 2, z0 - 0.05, 'x', 30, 0.6, H - 0.4, 1.3, -1); ribs(x0 - 0.05, (z0 + z1) / 2, 'z', 24, 0.6, H - 0.4, 1.3, -1); ribs(x1 + 0.05, (z0 + z1) / 2, 'z', 24, 0.6, H - 0.4, 1.3, 1);
    // soot streaks above the door and a band of hazard paint on the plinth
    X('concrete', -4, H - 3.4, z1 + 0.45, 10.4, 5.5, 0.01, [0.2, 0.2, 0.2]);
    X('hazard', (x0 + x1) / 2, 0.35, z1 + 0.43, 30, 0.2, 0.01);
    // gable roof, two skins, with a ridge vent
    const rise = 4.2;
    for (const s of [-1, 1]) {
      const zE = s * 12 + (z0 + z1) / 2;
      k._faceQuad('metal', [[x0 - 0.5, H, zE + s * 0.6], [x1 + 0.5, H, zE + s * 0.6], [x1 + 0.5, H + rise, (z0 + z1) / 2], [x0 - 0.5, H + rise, (z0 + z1) / 2]], [0, s > 0 ? 1 : 1, s * 0.5], RUST2);
      k._faceQuad('wall', [[x0 - 0.5, H - 0.2, zE + s * 0.6], [x1 + 0.5, H - 0.2, zE + s * 0.6], [x1 + 0.5, H + rise - 0.2, (z0 + z1) / 2], [x0 - 0.5, H + rise - 0.2, (z0 + z1) / 2]], [0, -1, -s * 0.5], SOOT);
    }
    for (const sx of [x0 - 0.5, x1 + 0.5]) k.poly('metal', [[sx, H, z0 - 0.6], [sx, H, z1 + 0.6], [sx, H + rise, (z0 + z1) / 2]], null, RUST2);
    B('steelDark', (x0 + x1) / 2, H + rise + 0.25, (z0 + z1) / 2, 28, 0.5, 1.2, null, 0.05);
    for (let x = x0 + 3; x < x1 - 2; x += 5) X('glowAmber', x, H + rise + 0.52, (z0 + z1) / 2, 2.4, 0.04, 0.5);
    // doorway frame and the hot light that comes out of it
    for (const s of [-1, 1]) B('steelDark', -4 + s * 5.2, 4.2, z1 + 0.3, 0.5, 8.6, 0.7, null, 0.06);
    B('steelDark', -4, 8.55, z1 + 0.3, 11, 0.5, 0.7, null, 0.06);
    X('glowAmber', -4, 4.0, z0 + 1.0, 9.4, 7.6, 0.04, [0.75, 0.6, 0.45]);          // the glow on the back wall: furnace light
    for (const x of [x0 + 6.5, x1 - 3.5]) { k.push(x, 5.6, z1 + 0.5, 0); B('steelDark', 0, 0, 0, 3.2, 1.8, 0.14, null, 0.03); X('glowAmber', 0, 0, 0.08, 2.9, 1.5, 0.02, [0.6, 0.6, 0.55]); k.pop(); }   // two lit windows
    for (let x = x0 + 3; x < x1 - 2; x += 6) lamp(x, H - 1.2, z1 - 1.0, 1.6);
    // inside: the furnace, with its mouth to the door, a ladle rail overhead and a tap
    B('steelDark', -6, 3.4, -100, 8.4, 6.8, 8.4, [0.5, 0.42, 0.38], 0.08);
    X('glowAmber', -6, 2.2, -95.75, 4.2, 3.2, 0.06, [1.1, 0.85, 0.55]);
    for (const s of [-1, 1]) B('steel', -6 + s * 2.4, 2.2, -95.62, 0.34, 3.6, 0.2, GREY, 0.05);
    B('steel', -6, 4.15, -95.62, 5.2, 0.34, 0.2, GREY, 0.05);
    cyl('steelDark', -6, 7.4, -100, 1.2, 1.2, 14);
    pipe('pipeSteel', [-6, 7.4, -100], [-6, 12.5, -100], 0.8, 10);
    pipe('pipeYellow', [-2, 6.5, -100], [3, 6.5, -100], 0.22, 8); pipe('pipeYellow', [3, 6.5, -100], [3, 1.0, -100], 0.22, 8);
    for (let x = x0 + 2; x < x1 - 1; x += 3) B('steelDark', x, H - 0.9, -100, 0.28, 0.5, 20, null, 0.03);       // overhead rail
    B('steel', -14, 5.8, -100, 0.6, 0.5, 5, GREY, 0.04); pipe('steelDark', [-14, 5.6, -102], [-14, 3.0, -102], 0.05, 6);   // a ladle on its rail
    cyl('metal', -14, 2.3, -101.5, 1.1, 1.8, 14, { col: RUST2 });
    X('glowAmber', -14, 3.15, -101.5, 1.9, 0.04, 1.9, [1.0, 0.7, 0.4]);
    // chimneys behind: banded, with a glowing lip and a red lamp
    for (const [cx, cz, r, hh] of [[-16, -114, 1.7, 58], [-8, -118, 1.4, 47]]) {
      cyl('metal', cx, hh / 2, cz, r, hh, 14, { col: [0.5, 0.46, 0.44], r2: r * 0.78 });
      for (let y = 6; y < hh - 4; y += 9) cyl('hazard', cx, y, cz, r * (1 - y / hh * 0.22) + 0.04, 2.2, 14);
      cyl('glowAmber', cx, hh + 0.1, cz, r * 0.7, 0.1, 10);
      X('glowRed', cx, hh + 1.2, cz, 0.35, 0.35, 0.35);
      pipe('pipeSteel', [cx, 7, cz + r], [cx, 11, -111], 0.45, 8);
    }
    // the slag runnel east of the hall: a glowing trough that cools to black
    X('concrete', 14, 0.02, -100, 12, 0.01, 4.2, [0.1, 0.1, 0.1]);
    X('glowAmber', 13.4, 0.07, -100, 8, 0.05, 0.5, [1.0, 0.6, 0.3]);
    X('glowAmber', 17.0, 0.07, -99.4, 1.6, 0.05, 0.4, [0.7, 0.35, 0.15]);
    // the portal crane over the yard east of the hall
    for (const [cx, cz] of [[22, -95], [22, -77], [44, -95], [44, -77]]) { B('steelDark', cx, 5.5, cz, 0.7, 11, 0.7, [0.85, 0.78, 0.5], 0.05); B('steelDark', cx, 0.25, cz, 1.4, 0.5, 1.4, null, 0.05); }
    for (const cz of [-95, -77]) B('steelDark', 33, 11.2, cz, 23.5, 1.2, 0.8, [0.9, 0.78, 0.4], 0.05);
    for (const cx of [22, 44]) B('steelDark', cx, 11.2, -86, 0.8, 1.2, 19, [0.9, 0.78, 0.4], 0.05);
    B('steelDark', 33, 10.0, -86, 1.6, 1.2, 1.6, [0.4, 0.4, 0.42], 0.05);
    pipe('steel', [33, 9.4, -86], [33, 5.5, -86], 0.04, 6); B('hazard', 33, 5.2, -86, 1.4, 0.5, 1.0, null, 0.04);
    crate(30, -90, 2.4, 1.6, 1.6, [0.45, 0.32, 0.25]); crate(36, -82, 1.8, 1.5, 1.8, [0.4, 0.4, 0.43], 0, 0.4);
    // slag-cooled ingots stacked in racks
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) B('steel', 28 + j * 1.3, 0.2 + i * 0.4, -80 - i * 0.0, 1.2, 0.34, 3.2, [0.58, 0.58, 0.6], 0.03);
  }

  // ---- ore bins and the belt -------------------------------------------------------------------------------------------------
  for (const bx of [-61.5, -49.5, -37.5]) {
    const z = -75.5;
    for (const [dx, dz] of [[-3.7, -3.7], [3.7, -3.7], [-3.7, 3.7], [3.7, 3.7]]) B('steelDark', bx + dx, 2.4, z + dz, 0.5, 4.8, 0.5, [0.8, 0.72, 0.5], 0.04);
    B('metal', bx, 6.2, z, 9, 4.4, 9, RUST, 0.07);
    // the hopper: a tapering skirt under the bin
    for (const [a, b, c, d] of [[-4.5, -4.5, 4.5, -4.5], [4.5, -4.5, 4.5, 4.5], [4.5, 4.5, -4.5, 4.5], [-4.5, 4.5, -4.5, -4.5]]) k.poly('metal', [[bx + a, 4.0, z + b], [bx + c, 4.0, z + d], [bx + c * 0.2, 2.2, z + d * 0.2], [bx + a * 0.2, 2.2, z + b * 0.2]], null, RUST2);
    B('steelDark', bx, 8.5, z, 9.4, 0.3, 9.4, null, 0.05);
    ribs(bx, z + 4.55, 'x', 9, 4.1, 8.3, 0.9, 1);
    X('hazard', bx, 4.35, z + 4.56, 9, 0.5, 0.01);
    for (let s = -1; s <= 1; s += 2) pipe('steelDark', [bx + s * 4.2, 8.6, z + 4.6], [bx + s * 4.2, 11.4, z + 4.6], 0.04, 5);
    // an ore heap under each chute, and tracks of it across the apron
    k.dome('concrete', bx, 0, z + 0.2, 3.4, low ? 10 : 14, low ? 4 : 7, { scaleY: 0.5, col: [0.5, 0.34, 0.26], thetaMax: Math.PI / 2 });
    B('floor', bx, -0.02, z, 11, 0.08, 11, [0.3, 0.3, 0.3], 0.02);
  }
  const trestle = (x, z, y, wd = 2.4) => {
    const g = groundY(x, z);
    for (const s of [-1, 1]) pipe('steelDark', [x + s * wd / 2, g, z], [x + s * wd / 2, y - 0.3, z], 0.12, 6);
    B('steelDark', x, y - 0.35, z, wd + 0.5, 0.2, 0.3, null, 0.03);
    B('steelDark', x, (g + y) / 2, z, wd, 0.1, 0.1, null, 0.02);
  };
  // the belt: from the pit road in the north-west, climbing to the bins' tops; then a short run from the bins to the foundry
  const belts = [];
  const beltRun = (ax, az, ay, bx, bz, by, w = 1.6) => {
    const dx = bx - ax, dz = bz - az, dy = by - ay, L = Math.hypot(dx, dz), len = Math.hypot(L, dy);
    k.push((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2, Math.atan2(-dz, dx));
    const pitch = Math.atan2(dy, L);
    // a sloped box: write the side rails and the bed in the run's own frame, tilted by pitch (about local z)
    const c = Math.cos(pitch), s = Math.sin(pitch), tp = (x, y) => [x * c - y * s, x * s + y * c];
    const rail = (zz, yy) => { const [px0, py0] = tp(-len / 2, yy), [px1, py1] = tp(len / 2, yy); pipe('steelDark', [px0, py0, zz], [px1, py1, zz], 0.07, 6); };
    rail(-w / 2, 0.4); rail(w / 2, 0.4); rail(-w / 2, -0.12); rail(w / 2, -0.12);
    k.pop();
    belts.push({ ax, az, ay, bx, bz, by, w, len, pitch, yaw: Math.atan2(-dz, dx) });
    const n = Math.max(2, Math.round(L / 9));
    for (let i = 0; i <= n; i++) { const t = i / n; trestle(ax + dx * t, az + dz * t, ay + dy * t + (t > 0.02 ? 0.0 : 0)); }
  };
  beltRun(-150, -136, 1.4, -61.5, -77, 11.2);
  beltRun(-33, -80, 11.2, -22, -96, 7.6);

  // ---- cutbank supply: an open-fronted shed -----------------------------------------------------------------------------------
  {
    const x0 = -78, x1 = -56, z0 = 10, z1 = 26, H = 6.2;
    B('concrete', (x0 + x1) / 2, -0.15, (z0 + z1) / 2, 24, 0.5, 18, [0.72, 0.72, 0.7], 0.05);
    X('floor', (x0 + x1) / 2, 0.03, (z0 + z1) / 2, 22, 0.04, 16);
    B('wall', x0 + 0.4, H / 2, (z0 + z1) / 2, 0.8, H, 16, RUST, 0.05);
    B('wall', (x0 + x1) / 2, H / 2, z0 + 0.4, 22, H, 0.8, RUST, 0.05);
    B('wall', (x0 + x1) / 2, H / 2, z1 - 0.4, 22, H, 0.8, RUST, 0.05);
    ribs(x0 - 0.05, (z0 + z1) / 2, 'z', 16, 0.5, H - 0.3, 1.2, -1); ribs((x0 + x1) / 2, z0 - 0.05, 'x', 22, 0.5, H - 0.3, 1.2, -1); ribs((x0 + x1) / 2, z1 + 0.05, 'x', 22, 0.5, H - 0.3, 1.2, 1);
    // roof: a shallow slope toward the pad, deep overhang over the counter
    k._faceQuad('metal', [[x0 - 0.5, H, z0 - 0.6], [x1 + 3, H - 0.9, z0 - 0.6], [x1 + 3, H - 0.9, z1 + 0.6], [x0 - 0.5, H, z1 + 0.6]], [0, 1, 0.1], RUST2);
    k._faceQuad('wall', [[x0 - 0.5, H - 0.25, z0 - 0.6], [x1 + 3, H - 1.15, z0 - 0.6], [x1 + 3, H - 1.15, z1 + 0.6], [x0 - 0.5, H - 0.25, z1 + 0.6]], [0, -1, 0], SOOT);
    for (const z of [z0 - 0.6, z1 + 0.6]) { k.poly('metal', [[x0 - 0.5, H - 0.25, z], [x1 + 3, H - 1.15, z], [x1 + 3, H - 0.9, z], [x0 - 0.5, H, z]], null, RUST2); }
    for (const z of [z0 + 1, (z0 + z1) / 2, z1 - 1]) { pipe('steelDark', [x1 + 2.6, 0, z], [x1 + 2.6, H - 1.1, z], 0.12, 6); }       // posts at the overhang's edge
    // racks along the back and side walls, stocked
    for (let z = z0 + 1.6; z < z1 - 1; z += 2.4) {
      B('steelDark', x0 + 1.3, 1.6, z, 0.12, 3.2, 0.12, null, 0.02);
      for (let sh = 0; sh < 3; sh++) { B('steel', x0 + 1.6, 0.5 + sh * 1.1, z + 1.2, 1.2, 0.07, 2.4, GREY, 0.02); }
    }
    const goods = [[0.35, 0.25, 0.2], [0.4, 0.42, 0.45], [0.55, 0.45, 0.28], [0.3, 0.4, 0.5]];
    for (let z = z0 + 1.6; z < z1 - 1; z += 2.4) for (let sh = 0; sh < 3; sh++) for (let j = 0; j < 2; j++) B('paint', x0 + 1.6, 0.7 + sh * 1.1, z + 0.7 + j * 1.1, 0.9, 0.5, 0.8, goods[(Math.floor(z) + sh + j) & 3], 0.03);
    for (let x = x0 + 6; x < x1 - 4; x += 5) { B('steelDark', x, 1.4, z0 + 1.0, 0.12, 2.8, 0.12, null, 0.02); }
    for (let x = x0 + 5; x < x1 - 5; x += 3.6) { B('paint', x, 1.2, z0 + 1.0, 2.8, 2.4, 1.3, goods[(Math.floor(x) + 4) & 3], 0.04); }
    // the counter across the front, with a lit screen, a scale, and a cash drawer
    B('plasticDark', -64.1, 0.55, 18, 1.0, 1.1, 14, [0.45, 0.42, 0.4], 0.04);
    X('steel', -64.1, 1.12, 18, 1.2, 0.06, 14.2, STEEL);
    for (const z of [14.5, 21.5]) { B('plasticDark', -64.05, 1.4, z, 0.5, 0.5, 0.06, null, 0.02); X('glowCyan', -64.0, 1.4, z, 0.4, 0.38, 0.02); }
    B('steel', -64.1, 1.25, 18, 0.5, 0.2, 0.7, GREY, 0.03);
    // strip lights under the roof
    for (let z = z0 + 2.5; z < z1; z += 4) lamp(-67, H - 0.5, z, 2.2);
    // signs
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.2), new THREE.MeshBasicMaterial({ map: signTexture(['OCCATOR SUPPLY', 'WATER · RATIONS · OXYGEN · SPARES · AMMUNITION'], 1024, 256, { size: 0.3 }), toneMapped: false }));
    sg.position.set(-57.2, H - 0.45, 18); sg.rotation.y = Math.PI / 2; root.add(sg);
    // drums, a pallet and a hand truck at the shed's mouth
    barrel(-58, 8.5); barrel(-57.2, 8.6, [0.3, 0.4, 0.5]); barrel(-58.5, 27.8, [0.55, 0.5, 0.2]); crate(-58, 28.6, 1.6, 1.4, 1.6, [0.42, 0.45, 0.38], 0, 0.3);
  }

  // ---- the bunkhouse: eight containers in a row, two high at the ends ------------------------------------------------------
  {
    const zc = -54, y0 = 0;
    for (let i = 0; i < 4; i++) {
      const cx = 51.5 + i * 8.6, col = [[0.55, 0.28, 0.2], [0.32, 0.4, 0.46], [0.58, 0.46, 0.22], [0.4, 0.42, 0.4]][i];
      B('wall', cx, 1.4, zc, 8.4, 2.8, 11.2, col, 0.06);
      for (let t = -4; t <= 4; t += 0.8) X('steelDark', cx + t, 1.4, zc + 5.63, 0.07, 2.6, 0.04, [col[0] * 0.8, col[1] * 0.8, col[2] * 0.8]);
      // a door and two windows on the south face
      B('steelDark', cx - 2.4, 1.1, zc + 5.7, 1.1, 2.1, 0.12, null, 0.03);
      for (const wx of [0.6, 2.8]) { B('steelDark', cx + wx, 1.6, zc + 5.68, 1.1, 0.8, 0.1, null, 0.03); X('glowAmber', cx + wx, 1.6, zc + 5.74, 0.95, 0.65, 0.02, [0.9, 0.85, 0.7]); }
      B('steelDark', cx, 2.9, zc, 8.6, 0.16, 11.4, [0.45, 0.45, 0.47], 0.04);
      B('plasticDark', cx + 2, 3.2, zc - 2, 1.6, 0.5, 1.4, null, 0.04);               // a roof unit
      if (i % 2 === 0) { B('steelDark', cx - 4.1, 3.4, zc - 5.8, 0.2, 0.6, 0.2, null, 0.02); }
      // steps and a landing
      B('steel', cx - 2.4, 0.3, zc + 6.6, 1.5, 0.12, 1.2, GREY, 0.03); B('steel', cx - 2.4, 0.6, zc + 6.2, 1.5, 0.12, 0.6, GREY, 0.03);
      lamp(cx - 2.4, 2.4, zc + 6.0, 0.9);
    }
    // an awning and a bench outside
    k._faceQuad('metal', [[48, 3.1, zc + 5.7], [86, 3.1, zc + 5.7], [86, 2.7, zc + 8.2], [48, 2.7, zc + 8.2]], [0, 1, 0.1], RUST2);
    for (const x of [49, 67, 85]) pipe('steelDark', [x, 0, zc + 8.1], [x, 2.8, zc + 8.1], 0.07, 6);
    B('wood', 62, 0.45, zc + 7.3, 3.2, 0.1, 0.7, null, 0.02); for (const x of [60.6, 63.4]) B('steelDark', x, 0.22, zc + 7.3, 0.1, 0.44, 0.6, null, 0.02);
    const bs = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.1), new THREE.MeshBasicMaterial({ map: signTexture(['BUNKS · COMPACT CREWS', 'DAY SHIFT · NIGHT SHIFT · REST'], 1024, 190, { size: 0.3 }), toneMapped: false }));
    bs.position.set(67, 2.9, zc + 8.35); bs.rotation.x = 0.1; root.add(bs);
  }

  // ---- the lane office: a tower with a glazed cab and a dish -------------------------------------------------------------------
  {
    const x = 78, z = 30;
    B('concrete', x, -0.15, z, 10, 0.5, 10, [0.7, 0.7, 0.68], 0.05);
    B('wall', x, 4.5, z, 8, 9, 8, [0.45, 0.46, 0.5], 0.08);
    X('glowAmber', x - 4.04, 6.5, z, 0.03, 0.8, 5.6);
    B('steelDark', x - 4.1, 1.4, z, 0.2, 2.4, 1.6, null, 0.04); X('glowCyan', x - 4.24, 2.9, z, 0.05, 0.2, 1.7);
    for (let i = 0; i < 9; i++) B('steel', x - 5.4 + 0.0, 0.2 + i * 0.5, z + 3.6 - i * 0.0 + 0, 0.4, 0.1, 0.8, GREY, 0.02);       // a short stair against the wall
    // the cab: a band of glass and a roof
    B('steelDark', x, 9.2, z, 10.2, 0.5, 10.2, null, 0.05);
    for (const s of [-1, 1]) for (const t of [-1, 1]) B('steelDark', x + s * 4.9, 10.8, z + t * 4.9, 0.3, 2.8, 0.3, null, 0.03);
    k.box('glassTint', x, 10.8, z, 9.8, 2.5, 9.8);
    B('steelDark', x, 12.4, z, 10.8, 0.4, 10.8, null, 0.05);
    X('glowCool', x, 10.2, z, 5, 0.1, 5, [0.5, 0.6, 0.65]);
    // mast, dish and the red lamp
    pipe('steelDark', [x, 12.6, z], [x, 24, z], 0.18, 8); X('glowRed', x, 24.3, z, 0.4, 0.4, 0.4);
    k.dome('steel', x + 2.5, 13.8, z, 1.4, low ? 10 : 14, low ? 4 : 7, { thetaMax: Math.PI * 0.45, col: STEEL });
    pipe('steelDark', [x + 2.5, 12.6, z], [x + 2.5, 14.6, z], 0.08, 6);
    for (const a of [0, 1.57, 3.14, 4.71]) pipe('steelDark', [x, 22, z], [x + Math.cos(a) * 2.2, 17, z + Math.sin(a) * 2.2], 0.025, 4);
    const ls = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.2), new THREE.MeshBasicMaterial({ map: signTexture(['LANE OFFICE', 'ORE LANE · 120 CR / JUMP'], 1024, 270, { size: 0.3 }), toneMapped: false }));
    ls.position.set(x - 4.12, 4.2, z); ls.rotation.y = -Math.PI / 2; root.add(ls);
  }

  // ---- the tank farm --------------------------------------------------------------------------------------------------------------
  for (const [i, [tx, tz]] of [[89, 60.5], [101.5, 60.5], [89, 74.5]].entries()) {
    B('concrete', tx, -0.1, tz, 13, 0.3, 13, [0.7, 0.7, 0.68], 0.05);
    cyl('metal', tx, 5.5, tz, 5.4, 11, 20, { col: [0.62, 0.64, 0.66] });
    cyl('steelDark', tx, 11.1, tz, 5.5, 0.3, 20);
    for (let y = 2; y < 11; y += 3) cyl('steelDark', tx, y, tz, 5.46, 0.14, 20);
    pipe('steelDark', [tx + 5.5, 0.3, tz], [tx + 5.5, 11, tz], 0.04, 5); for (let y = 0.8; y < 11; y += 0.6) B('steelDark', tx + 5.45, y, tz, 0.5, 0.05, 0.3, null, 0.01);
    pipe('pipeBlue', [tx - 5.4, 1.2, tz], [tx - 8, 1.2, tz], 0.3, 8);
    X(i === 0 ? 'glowCyan' : 'glowAmber', tx, 11.5, tz, 0.5, 0.2, 0.5);
    const tt = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 1.2), new THREE.MeshBasicMaterial({ map: signTexture([['WATER', 'FUEL', 'COOLANT'][i], ['SOLAR MELT', 'RESERVE', 'SLAG QUENCH'][i]], 512, 140, { size: 0.34 }), toneMapped: false }));
    tt.position.set(tx, 4, tz - 5.45); tt.rotation.y = Math.PI; root.add(tt);
  }
  pipe('pipeBlue', [95.5, 0.8, 60.5], [95.5, 0.8, 74.5], 0.3, 8); pipe('pipeSteel', [94.5, 0.6, 60.5], [94.5, 0.6, 62], 0.2, 8);
  for (const [px, pz] of [[84, 61], [84, 75]]) barrel(px, pz, [0.5, 0.5, 0.52]);

  // ---- haul trucks: wheels two metres tall ----------------------------------------------------------------------------------------
  for (const [i, [tx, tz, ry]] of [[-105.5, 33, 0.1], [-101.5, 55, -0.2]].entries()) {
    k.push(tx, 0, tz, ry);
    for (const sx of [-5, -1.6, 4.2]) for (const sz of [-1, 1]) { cyl('rubber', sx, 1.9, sz * 2.9, 1.9, 1.5, 14, { axis: 'z' }); cyl('steelDark', sx, 1.9, sz * 2.9, 0.9, 1.56, 12, { axis: 'z' }); }
    B('wall', -0.5, 2.7, 0, 14, 1.0, 4.4, RUST2, 0.1);                                  // chassis
    B('wall', 5.2, 4.6, 0, 3.6, 3.0, 4.2, [0.78, 0.6, 0.18], 0.1);                      // cab
    k.box('glassTint', 6.9, 5.0, 0, 0.1, 1.5, 3.4);
    for (const s of [-1, 1]) X('glowAmber', 7.05, 3.7, s * 1.6, 0.06, 0.3, 0.7);
    B('metal', -2.6, 5.4, 0, 8.4, 3.6, 4.6, RUST, 0.12);                                // the bed, tilted a touch by a lower rear
    k.dome('concrete', -2.6, 7.0, 0, 3.8, low ? 10 : 14, low ? 4 : 7, { scaleY: 0.45, thetaMax: Math.PI / 2, col: [0.5, 0.36, 0.28] });
    for (const s of [-1, 1]) pipe('steelDark', [4.4, 6.2, s * 2.0], [4.4, 7.4, s * 2.0], 0.05, 5);
    B('hazard', -6.8, 3.0, 0, 0.12, 0.5, 4.5, null, 0.03);
    k.pop();
  }

  // ---- floodlight masts, drums, pipes, cable runs ----------------------------------------------------------------------------------
  for (const [mx, mz] of [[-38, -34], [38, -40], [44, 42], [-44, 44], [0, -66], [0, 74]]) {
    cyl('steelDark', mx, 8, mz, 0.22, 16, 8, { r2: 0.14 }); B('concrete', mx, 0.25, mz, 1.2, 0.5, 1.2, null, 0.05);
    k.push(mx, 16.2, mz, Math.atan2(-mz, -mx));
    B('steelDark', 0, 0, 0, 0.3, 0.3, 3.0, null, 0.04);
    for (let j = -1; j <= 1; j++) { B('steelDark', 0.3, 0.1, j * 0.95, 0.3, 0.7, 0.85, null, 0.03); X('glowWhite', 0.47, 0.1, j * 0.95, 0.02, 0.55, 0.7); }
    k.pop();
  }
  for (let i = 0; i < 9; i++) { const a = i * 0.8; barrel(-30 + (i % 3) * 0.7, 34 + Math.floor(i / 3) * 0.7, [[0.5, 0.3, 0.2], [0.3, 0.38, 0.45], [0.55, 0.5, 0.2]][i % 3]); }
  for (const [x, z, w, h, d, c] of [[40, 12, 2.4, 1.5, 2.4, [0.4, 0.46, 0.4]], [43, 15, 1.8, 1.2, 1.8, [0.5, 0.4, 0.28]], [-36, -14, 2.6, 1.6, 2.2, [0.36, 0.42, 0.5]], [-40, -10, 1.6, 1.2, 1.6, [0.5, 0.3, 0.22]]]) crate(x, z, w, h, d, c, 0, x * 0.1);
  // a cable run and a pipe rack from the foundry to the pad's edge
  for (let z = -86; z < -30; z += 8) { B('steelDark', 24, 0.7, z, 0.3, 1.4, 0.3, null, 0.03); }
  pipe('pipeYellow', [24, 1.3, -86], [24, 1.3, -32], 0.1, 6); pipe('pipeBlue', [24.5, 1.1, -86], [24.5, 1.1, -32], 0.09, 6); pipe('pipeRed', [23.5, 1.1, -86], [23.5, 1.1, -32], 0.07, 6);
  // wind-free dust is not a thing here, but ore dust is: a darkened strip along the pit road, tyre tracks across the aprons
  X('concrete', -52, 0.03, 0, 100, 0.01, 6, [0.22, 0.22, 0.22]);
  X('concrete', -52, 0.04, 2.4, 100, 0.01, 0.5, [0.14, 0.14, 0.14]); X('concrete', -52, 0.04, -2.4, 100, 0.01, 0.5, [0.14, 0.14, 0.14]);

  // fix-r1: illuminated routes and building fronts stay readable across the real night side.
  const paths=[[[32,20],[32,44]],[[32,20],[-52,20]],[[-32,-28],[-6,-84]]];
  for(const pts of paths)for(let i=1;i<pts.length;i++) {
    const [ax,az]=pts[i-1],[bx,bz]=pts[i],n=Math.ceil(Math.hypot(bx-ax,bz-az)/6);
    for(let j=0;j<=n;j++){const x=ax+(bx-ax)*j/n,z=az+(bz-az)*j/n;X('glowAmber',x,.12,z,.3,.12,.3);}
  }
  for(const [x,z] of [[-7,-87],[-56,18],[32,45]]) {
    X('glowAmber',x,3,z,5,.12,.08);
    const l=new THREE.PointLight(0xffd4a0,100,65,1.5);l.position.set(x,3.5,z+2);l.name='settlement front light';root.add(l);
  }
  // ---- merge into meshes, add the pad's painted decal, the station sign, the beacons ------------------------------------------------
  const mapMats = { ...mats };
  const kitGroup = k.toGroup(mapMats, { name: 'outpost-kit', cast: true, receive: true });
  root.add(kitGroup);
  const padTex = padTexture();
  const padDecal = new THREE.Mesh(new THREE.PlaneGeometry(MAIN_PAD.w - 1, MAIN_PAD.d - 1), new THREE.MeshStandardMaterial({ map: padTex, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 }));
  padDecal.rotation.x = -Math.PI / 2; padDecal.position.set(0, 0.025, 0); padDecal.receiveShadow = true; root.add(padDecal);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(14, 3.6), new THREE.MeshBasicMaterial({ map: signTexture([OUTPOST_NAME, 'INDUSTRIAL MINERS COMPACT · CALORIS PLANITIA · CERES'], 1280, 330, { size: 0.3 }), toneMapped: false, side: THREE.DoubleSide }));
  sign.position.set(-24, 6.3, 62); root.add(sign);
  for (const sx of [-30, -18]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, 6.4, 0.4), mats.metal); post.position.set(sx, 3.2, 62); root.add(post); }
  // the belt's moving bed
  const beltTex = beltTexture();
  const beltMat = new THREE.MeshStandardMaterial({ map: beltTex, roughness: 0.95, side: THREE.DoubleSide });
  for (const b of belts) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(b.len, b.w * 0.9), beltMat.clone());
    m.material.map = beltTex.clone(); m.material.map.needsUpdate = true; m.material.map.repeat.set(1, b.len / 14); m.material.map.rotation = Math.PI / 2;
    m.rotation.order = 'YZX';
    m.position.set((b.ax + b.bx) / 2, (b.ay + b.by) / 2 + 0.38, (b.az + b.bz) / 2);
    m.rotation.y = b.yaw; m.rotation.z = b.pitch; m.rotation.x = -Math.PI / 2;
    b.mesh = m; root.add(m);
  }
  // furnace and chimney glow: small unlit meshes that flicker
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xffa040, toneMapped: false, transparent: true, opacity: 0.9, depthWrite: false });
  for (const [cx, cz, hh] of [[-16, -114, 58], [-8, -118, 47]]) { const g = new THREE.Mesh(new THREE.SphereGeometry(1.5, 10, 6), glowMat); g.position.set(cx, hh + 0.6, cz); g.scale.set(1, 0.35, 1); root.add(g); }
  root.traverse((o) => { o.frustumCulled = o.isMesh ? o.frustumCulled : o.frustumCulled; });

  // placement: the group's axes are (east, up, south) at the main pad
  const east = new THREE.Vector3(pi.east.x, pi.east.y, pi.east.z), up = new THREE.Vector3(pi.up.x, pi.up.y, pi.up.z), south = new THREE.Vector3().crossVectors(east, up).normalize();
  const quat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(east, up, south));
  engine.scene.add(root);
  const entry = engine.track({ worldPos: { x: pi.point.x, y: pi.point.y, z: pi.point.z }, object3d: root, quaternion: quat, frame });
  // beacons on the three outcrops (the same beacon the Phobos survey uses; here they mark where the ore shows)
  const beacons = [];
  for (const sm of body.sampleSites) {
    const bcn = buildSampleBeacon({ low, id: 'seam-' + sm.id });
    engine.scene.add(bcn.group);
    const l = Math.hypot(sm.point.x, sm.point.y, sm.point.z), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(sm.point.x / l, sm.point.y / l, sm.point.z / l));
    const e = engine.track({ worldPos: { x: sm.point.x, y: sm.point.y, z: sm.point.z }, object3d: bcn.group, quaternion: q, frame });
    bcn.lamp.material.color.setHex(0xffa23a); bcn.halo.material.color.setHex(0xffa23a);
    beacons.push({ bcn, e });
  }
  const people = new OutpostPeople({ root, people: space.peopleLib || null, space, body, pi });
  let t = 0;
  const out = {
    root, entry, people, boxes: BOXES, belts,
    /** per frame: the belt moves, the glow breathes, the walker is kept out of solid things; people are animated by people.js */
    update(dt, walkerWorldPos, walker) {
      t += dt;
      for (const b of belts) b.mesh.material.map.offset.y = (b.mesh.material.map.offset.y - dt * 0.35 / 14 * b.len / b.len) % 1;
      glowMat.opacity = 0.75 + 0.2 * Math.sin(t * 7) * Math.sin(t * 3.1) + 0.05;
      people.tick(dt, walkerWorldPos);
      if (walker && walkerWorldPos) {
        const p = frameToOutpost(pi, walkerWorldPos), r = 0.38;
        if (Math.abs(p.x) < 200 && Math.abs(p.z) < 200) {
          let pushed = false;
          for (const b of BOXES) {
            if (p.y > 0.4 + b.h || p.y + 1.8 < -0.2) continue;
            if (p.x <= b.x0 - r || p.x >= b.x1 + r || p.z <= b.z0 - r || p.z >= b.z1 + r) continue;
            const ch = [{ dx: b.x0 - r - p.x, dz: 0 }, { dx: b.x1 + r - p.x, dz: 0 }, { dx: 0, dz: b.z0 - r - p.z }, { dx: 0, dz: b.z1 + r - p.z }].sort((a, c) => Math.hypot(a.dx, a.dz) - Math.hypot(c.dx, c.dz))[0];
            p.x += ch.dx; p.z += ch.dz; pushed = true;
          }
          if (pushed) { const w = outpostToFrame(pi, p.x, p.y, p.z); walker.worldPos.x = w.x; walker.worldPos.y = w.y; walker.worldPos.z = w.z; if (walker.velocity) { walker.velocity.x *= 0.2; walker.velocity.y *= 0.2; walker.velocity.z *= 0.2; } }
        }
      }
    },
    setVisible(on) { root.visible = on; for (const b of beacons) b.bcn.group.visible = on; },
    dispose() { engine.untrack(entry); engine.scene.remove(root); },
  };
  return out;
}
