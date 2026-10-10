// ============================================================================
// worlds/callisto/camp.js — the VALHALLA CAMP and the prospectors' camp, drawn with the Meridian's own kit (shipKit.js and the port's
// PBR materials) so they hold the same bar as Marineris Port. Mystara's look comes from F0's style sheet (src/factions/mystara):
// violet basalt walls, old-gold inlay, glyph light that pulses when something is being measured, everything low and half-buried.
//
// WHAT STANDS HERE (layout.js says where; this file says how it looks)
//   the main pad (a slab, stencilled), THE ARCHIVE (Mystara's buried hall: a glyph-lit door, a band of narrow east windows and one
//   big viewing window facing Jupiter), THE STANDING ARRAY (nine instrument stones round a plinth; the middle stone's glyph pulses),
//   two listening dishes and a comms mast (the camp listens to Europa), the QUARTERMASTER's open shed, five floodlight masts, the
//   notice board beside the camp desk, barrels, crates, cable runs; THE DEAD RELAY out on the Listening Scar's rim (about 780 m),
//   the door of SEALED SITE FOUR in a low mound (about 690 m), and the PROSPECTORS' CAMP at the world port 1.2 km north (huts, a
//   drill rig, a claim board, string lights); and the people (cast.js). Jupiter hangs in the eastern sky (jupiterSky.js).
// All the static geometry of each site is merged into a handful of meshes (one per material): the phone draws about twenty calls.
// Solid things are listed in layout.js (BOXES and PORT_BOXES); update() pushes the walker out of them, as the Mars port does.
// ============================================================================

import * as THREE from 'three';
import { Kit } from '../../ship/shipKit.js';
import { makePortMaterials } from '../../port/portArt.js';
import { factionLook, factionStyle } from '../../factions/registry.js';
import { personVisible } from '../../crew/personVisibility.js';
import { Person } from '../../crew/personRig.js';
import { bleedSideways } from '../moon/place.js';
import { BOXES, PORT_BOXES, MAIN_PAD, PEOPLE, OUTPOST_NAME, outpostToFrame, frameToOutpost, pushOut } from './layout.js';
import { buildBoard } from '../../missions/boardProp.js';
import { DESKS } from '../../missions/desk.js';

const BASALT = [0.165, 0.145, 0.25], BASALT2 = [0.21, 0.18, 0.3], SOOT = [0.12, 0.11, 0.14], STEEL = [0.74, 0.76, 0.78], GREY = [0.55, 0.56, 0.58], GOLD = [0.85, 0.76, 0.48], FROST = [0.8, 0.83, 0.88];

function signTexture(lines, w = 1024, h = 256, { bg = '#120f1e', fg = '#d8c27a', border = '#9b6bff', size = 0.28 } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.strokeStyle = border; g.lineWidth = 6; g.strokeRect(8, 8, w - 16, h - 16);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  const n = lines.length;
  lines.forEach((t, i) => { g.font = `${i === 0 ? 700 : 500} ${Math.round(h * (i === 0 ? size : size * 0.6))}px "Palatino Linotype", Palatino, Georgia, serif`; g.fillText(t, w / 2, h * ((i + 1) / (n + 1)) + (i === 0 ? -4 : 6), w - 60); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

function padTexture() {
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#5d5b58'; g.fillRect(0, 0, S, S);
  let seed = 17; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 24000; i++) { const v = 66 + Math.floor(rnd() * 50); g.fillStyle = `rgba(${v},${v},${v - 4},0.32)`; g.fillRect(Math.floor(rnd() * S), Math.floor(rnd() * S), 1 + Math.floor(rnd() * 2), 1 + Math.floor(rnd() * 2)); }
  g.strokeStyle = '#26252a'; g.lineWidth = 3; for (let i = 1; i < 8; i++) { g.beginPath(); g.moveTo(i * S / 8, 0); g.lineTo(i * S / 8, S); g.moveTo(0, i * S / 8); g.lineTo(S, i * S / 8); g.stroke(); }
  g.strokeStyle = '#d8c27a'; g.lineWidth = 14; g.strokeRect(34, 34, S - 68, S - 68);
  g.lineWidth = 8; g.beginPath(); g.arc(S / 2, S / 2, 360, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#d8c27a'; g.textAlign = 'center'; g.font = '700 108px "Palatino Linotype", Palatino, Georgia, serif';
  g.fillText('VALHALLA', S / 2, S / 2 - 40); g.fillText('CAMP', S / 2, S / 2 + 90); g.font = '700 64px Georgia, serif';
  g.fillText('PAD 01', S / 2, S - 90);
  for (const [x, y] of [[300, 300], [724, 300], [300, 724], [724, 724]]) { const gr = g.createRadialGradient(x, y, 4, x, y, 90); gr.addColorStop(0, 'rgba(16,16,20,.55)'); gr.addColorStop(1, 'rgba(16,16,20,0)'); g.fillStyle = gr; g.fillRect(x - 100, y - 100, 200, 200); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

export function buildCamp({ engine, world, space, tier }) {
  const low = tier === 'low', body = world.body, pi = body.padInfo, frame = world.frame;
  const portOff = body.ports && body.ports[0] ? frameToOutpost(pi, body.ports[0].point) : null;
  const portPi = portOff ? body.playerPad(portOff.x, portOff.z) : null;      // a full { point, up, east, north } at the port
  const art = makePortMaterials(tier, space.ship && space.ship.matsExt ? space.ship.matsExt : null);
  const mats = art.mats;
  const root = new THREE.Group(); root.name = 'camp:' + body.id;
  const portRoot = new THREE.Group(); portRoot.name = 'prospectors:' + body.id;
  const kit = (k) => { k.defaultTile = 4; k.tiles = { paint: 8, metal: 1, wall: 2.7, floor: 2, fabric: 1 }; return k; };
  const k = kit(new Kit());                                     // the pad site's geometry
  const kp = kit(new Kit());                                    // the prospectors' camp's geometry (its own frame)
  const B = (kk) => (key, x, y, z, w, h, d, col, c = 0.04) => kk.bevelBox(key, x, y, z, w, h, d, c, col ? { col } : {});
  const X = (kk) => (key, x, y, z, w, h, d, col, skip) => kk.box(key, x, y, z, w, h, d, { col, skip });
  const cylW = (kk) => (key, x, y, z, r, h, seg, o) => kk.cyl(key, x, y, z, r, h, low ? Math.min(seg, 10) : seg, o);
  const pipeW = (kk) => (key, a, b, r, seg = 8, o) => kk.pipe(key, a, b, r, low ? 5 : seg, o);
  const Bk = B(k), Xk = X(k), cyl = cylW(k), pipe = pipeW(k);
  const Bp = B(kp), Xp = X(kp), cylP = cylW(kp), pipeP = pipeW(kp);
  const groundY = (x, z) => { const p = outpostToFrame(pi, x, 0, z), l = Math.hypot(p.x, p.y, p.z), R = body.surfaceRadius(p.x / l, p.y / l, p.z / l); const s = { x: p.x / l * R - pi.point.x, y: p.y / l * R - pi.point.y, z: p.z / l * R - pi.point.z }; return s.x * pi.up.x + s.y * pi.up.y + s.z * pi.up.z; };
  const ribs = (kk) => (x, z, along, len, y0, y1, step, side) => {
    for (let t = -len / 2 + step / 2; t < len / 2; t += step) {
      if (along === 'x') kk.box('steelDark', x + t, (y0 + y1) / 2, z + side * 0.09, 0.08, y1 - y0, 0.06, { col: [0.5, 0.42, 0.62] });
      else kk.box('steelDark', x + side * 0.09, (y0 + y1) / 2, z + t, 0.06, y1 - y0, 0.08, { col: [0.5, 0.42, 0.62] });
    }
  };
  const ribsK = ribs(k);
  const lampK = (x, y, z, w = 1.0) => { Bk('steelDark', x, y, z, w + 0.1, 0.12, 0.24, null, 0.02); Xk('glowAmber', x, y - 0.075, z, w, 0.025, 0.16); };
  const barrelK = (x, z, col = BASALT2, h = 0.95) => { cyl('metal', x, h / 2, z, 0.3, h, 10, { col }); cyl('steelDark', x, h * 0.3, z, 0.31, 0.05, 10); cyl('steelDark', x, h * 0.7, z, 0.31, 0.05, 10); };
  const crateK = (x, z, w, h, d, col, y0 = 0, rot = 0) => { k.push(x, y0, z, rot); Bk('paint', 0, h / 2, 0, w, h, d, col, 0.03); Xk('steelDark', 0, h / 2, d / 2 + 0.006, w * 0.9, 0.06, 0.01); k.pop(); };

  // ---- the ground: main pad slab, aprons, the path east toward the array ----
  Xk('concrete', 0, -0.2, 0, MAIN_PAD.w, 0.4, MAIN_PAD.d, [0.86, 0.87, 0.9]);
  for (const [x, z, w, d] of [[0, -62, 14, 40], [-46, 0, 50, 12], [38, 6, 28, 10], [-52, 24, 16, 14]]) Xk('concrete', x, -0.15, z, w, 0.3, d, [0.75, 0.76, 0.8]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { cyl('steelDark', sx * 27, 0.55, sz * 27, 0.17, 1.1, 8); Xk('glowAmber', sx * 27, 1.15, sz * 27, 0.34, 0.12, 0.34); }
  for (let i = -26; i <= 26; i += 4.2) for (const z of [-30.2, 30.2]) { if (Math.abs(i) < 5) continue; Bk('concrete', i, 0.4, z, 3.6, 0.8, 0.5, [0.8, 0.81, 0.85], 0.06); Xk('glyphGold', i, 0.55, z + (z > 0 ? 0.26 : -0.26), 3.2, 0.1, 0.012); }

  // ---- the Archive: a buried hall, its door to the camp, its one big window facing Jupiter (east) ----
  {
    const x0 = -24, x1 = 8, z0 = -104, z1 = -80, H = 9.5;
    Bk('concrete', (x0 + x1) / 2, -0.15, (z0 + z1) / 2, 34, 0.5, 26, [0.6, 0.62, 0.68], 0.05);
    Xk('floor', (x0 + x1) / 2, 0.03, (z0 + z1) / 2, 31.4, 0.04, 23.4);
    // walls: violet basalt, corrugated; the south wall in two pieces round an 8 m doorway
    Bk('wall', (x0 + x1) / 2, H / 2, z0 + 0.4, 32, H, 0.8, BASALT, 0.05);
    Bk('wall', x0 + 0.4, H / 2, (z0 + z1) / 2, 0.8, H, 24, BASALT, 0.05);
    Bk('wall', x1 - 0.4, H / 2, (z0 + z1) / 2, 0.8, H, 24, BASALT, 0.05);
    Bk('wall', x0 + 6, H / 2, z1 - 0.4, 12, H, 0.8, BASALT, 0.05);
    Bk('wall', x1 - 2, H / 2, z1 - 0.4, 8, H, 0.8, BASALT, 0.05);
    Bk('wall', -8, H - 1.2, z1 - 0.4, 8, 2.4, 0.8, BASALT, 0.05);           // the lintel over the doorway
    ribsK(x0 + 6, z1 + 0.05, 'x', 12, 0.6, H - 0.4, 1.3, 1); ribsK(x1 - 2, z1 + 0.05, 'x', 8, 0.6, H - 0.4, 1.3, 1);
    ribsK((x0 + x1) / 2, z0 - 0.05, 'x', 32, 0.6, H - 0.4, 1.3, -1); ribsK(x0 - 0.05, (z0 + z1) / 2, 'z', 24, 0.6, H - 0.4, 1.3, -1); ribsK(x1 + 0.05, (z0 + z1) / 2, 'z', 24, 0.6, H - 0.4, 1.3, 1);
    // gold inlay along the base; a glyph strip over the door
    Xk('glyphGold', (x0 + x1) / 2, 0.35, z1 + 0.43, 32, 0.16, 0.012);
    for (const s of [-1, 1]) Bk('steelDark', -8 + s * 4.2, 4.0, z1 + 0.3, 0.5, 8.2, 0.7, null, 0.06);
    Bk('glyphGold', -8, 8.35, z1 + 0.34, 9.4, 0.2, 0.1, null, 0.02);
    Xk('glyphViolet', -8, 7.4, z1 + 0.45, 7.6, 0.5, 0.02);
    // the door stands open: a dark interior, warm lamplight on the back wall, a lit glyph line in the floor
    Xk('concrete', -8, 3.4, z0 + 1.2, 7.2, 6.6, 0.04, [0.05, 0.04, 0.09]);
    Xk('glyphViolet', -8, 0.06, (z0 + z1) / 2, 0.5, 0.05, 20, [0.55, 0.4, 0.9]);
    Xk('glowAmber', -14, 3.4, z0 + 1.0, 5, 5, 0.03, [0.5, 0.4, 0.3]);
    // windows: a band of narrow slits and one wide viewing window, all on the east face toward Jupiter
    for (const z of [-98, -92, -86]) { Bk('steelDark', x1 + 0.05, 5.6, z, 0.14, 3.2, 1.0, null, 0.03); Xk('glowCool', x1 + 0.12, 5.6, z, 0.02, 2.8, 0.8, [0.45, 0.5, 0.6]); }
    Bk('steelDark', x1 + 0.05, 5.2, -84.5, 0.16, 4.4, 6.4, null, 0.03);
    k.box('glassTint', x1 + 0.14, 5.2, -84.5, 0.06, 4.0, 6.0);
    // earth-covered roof: a low ice berm over the hall, and a standing periscope mast
    for (const s of [-1, 1]) k._faceQuad('metal', [[x0 - 0.6, H, (z0 + z1) / 2 + s * 12.6], [x1 + 0.6, H, (z0 + z1) / 2 + s * 12.6], [x1 + 0.6, H + 1.6, (z0 + z1) / 2], [x0 - 0.6, H + 1.6, (z0 + z1) / 2]], [0, 1, s * 0.4], FROST);
    k._faceQuad('wall', [[x0 - 0.6, H - 0.25, (z0 + z1) / 2 + 12.6], [x1 + 0.6, H - 0.25, (z0 + z1) / 2 + 12.6], [x1 + 0.6, H + 1.35, (z0 + z1) / 2], [x0 - 0.6, H + 1.35, (z0 + z1) / 2]], [0, -1, 0], SOOT);
    for (const sx of [x0 - 0.5, x1 + 0.5]) k.poly('metal', [[sx, H, z0 - 0.5], [sx, H, z1 + 0.5], [sx, H + 1.6, (z0 + z1) / 2]], null, FROST);
    pipe('steelDark', [-2, H + 1, -92], [-2, H + 4.6, -92], 0.12, 8); Xk('glowRed', -2, H + 4.8, -92, 0.3, 0.3, 0.3);
    // inside the doorway, the covered plinth of a standing instrument
    Bk('concrete', -8, 0.6, -94, 3.6, 1.2, 3.6, [0.3, 0.3, 0.36], 0.06);
    cyl('steel', -8, 1.9, -94, 0.5, 1.4, 12, { col: GOLD });
    k.dome('steel', -8, 2.6, -94, 0.5, low ? 8 : 12, low ? 4 : 6, { thetaMax: Math.PI * 0.5, col: GOLD });
    // the hall's sign
    const hs = new THREE.Mesh(new THREE.PlaneGeometry(11, 2.6), new THREE.MeshBasicMaterial({ map: signTexture(['THE ARCHIVE', 'MYSTARA · VALHALLA BASIN · THE INSTRUMENT IS LISTENING'], 1280, 300, { size: 0.28 }), toneMapped: false }));
    hs.position.set(-8, 7.6, z1 + 0.5); root.add(hs);
  }

  // ---- the standing array: nine instrument stones round a plinth; the middle stone's glyph pulses (separately, below) ----
  let pulseStone = null;
  {
    const cx = -54, cz = 38;
    Bk('concrete', cx, 0.35, cz, 5.2, 0.7, 5.2, [0.7, 0.72, 0.78], 0.05);
    cyl('steel', cx, 1.0, cz, 0.8, 0.7, 12, { col: GOLD });
    k.dome('steel', cx, 1.4, cz, 0.8, low ? 10 : 16, low ? 4 : 8, { thetaMax: Math.PI * 0.5, col: STEEL });
    for (let i = 0; i < 9; i++) {
      const a = i * (Math.PI * 2 / 9) + 0.35, x = cx + Math.cos(a) * 34, z = cz + Math.sin(a) * 34, h = 5.5 + (i % 3) * 1.2;
      k.push(x, 0, z, -a + Math.PI / 2);
      Bk('wall', 0, h / 2, 0, 2.0, h, 1.2, i % 2 ? BASALT : BASALT2, 0.08);
      Xk('glyphGold', 0, h - 0.5, 0.62, 1.7, 0.16, 0.02);
      Xk('glyphViolet', 0, h * 0.45, 0.62, 1.5, 0.28, 0.02);
      Xk('glyphGold', 0, 0.6, 0.62, 1.7, 0.1, 0.02);
      k.pop();
      if (i === 4) pulseStone = { x, z, h, a };
    }
  }

  // ---- the listening dishes and the comms mast ----
  {
    const [x, z, r] = [-72, 58.5, 4.4];
    Bk('concrete', x, 0.3, z, 9.4, 0.6, 9.4, [0.7, 0.72, 0.78], 0.05);
    cyl('steelDark', x, 1.0, z, 0.5, 1.6, 12);
    k.dome('steel', x, 2.2, z, r, low ? 14 : 22, low ? 6 : 11, { thetaMax: Math.PI * 0.42, col: [0.82, 0.84, 0.88] });
    pipe('steelDark', [x, 1.4, z], [x + 2.6, 2.2 + r * 0.72, z - 1.2], 0.09, 8);
    Xk('glowRed', x + 2.7, 2.3 + r * 0.72, z - 1.25, 0.22, 0.22, 0.22);
    const [x2, z2, r2] = [-89, 41.5, 2.9];
    Bk('concrete', x2, 0.25, z2, 6.8, 0.5, 6.8, [0.7, 0.72, 0.78], 0.05);
    cyl('steelDark', x2, 0.9, z2, 0.4, 1.3, 10);
    k.dome('steel', x2, 1.9, z2, r2, low ? 12 : 18, low ? 5 : 9, { thetaMax: Math.PI * 0.42, col: [0.8, 0.82, 0.86] });
    pipe('steelDark', [x2, 1.1, z2], [x2 + 1.8, 1.6 + r2 * 0.7, z2 - 0.8], 0.07, 8);
    // the comms mast: 26 m, banded, two small dishes, a red lamp, guy wires
    const mx = 0, mz = -120;
    Bk('concrete', mx, 0.25, mz, 2.6, 0.5, 2.6, [0.7, 0.72, 0.78], 0.05);
    pipe('steelDark', [mx, 0, mz], [mx, 26, mz], 0.16, 8);
    for (let y = 3; y < 25; y += 4) { Bk('steelDark', mx, y, mz, Math.max(0.3, 1.2 - y * 0.035), 0.14, Math.max(0.3, 1.2 - y * 0.035), null, 0.02); }
    k.dome('steel', mx + 1.1, 21, mz, 0.9, low ? 8 : 12, low ? 4 : 6, { thetaMax: Math.PI * 0.5, col: STEEL });
    k.dome('steel', mx - 1.0, 16.5, mz + 0.4, 0.6, low ? 8 : 10, low ? 4 : 5, { thetaMax: Math.PI * 0.5, col: STEEL });
    Xk('glowRed', mx, 26.4, mz, 0.36, 0.36, 0.36);
    for (const a of [0.6, 2.3, 4.0]) pipe('steelDark', [mx, 22, mz], [mx + Math.cos(a) * 6, 0.2, mz + Math.sin(a) * 6], 0.02, 4);
  }

  // ---- the quartermaster's shed: open to the pad, racks, crates, a counter, lit screens ----
  {
    const x0 = 26, x1 = 50, z0 = 46, z1 = 66, H = 5.8;
    Bk('concrete', (x0 + x1) / 2, -0.15, (z0 + z1) / 2, 26, 0.5, 22, [0.66, 0.68, 0.74], 0.05);
    Xk('floor', (x0 + x1) / 2, 0.03, (z0 + z1) / 2, 24, 0.04, 20);
    Bk('wall', x1 - 0.4, H / 2, (z0 + z1) / 2, 0.8, H, 20, BASALT2, 0.05);
    Bk('wall', (x0 + x1) / 2, H / 2, z0 + 0.4, 24, H, 0.8, BASALT2, 0.05);
    Bk('wall', (x0 + x1) / 2, H / 2, z1 - 0.4, 24, H, 0.8, BASALT2, 0.05);
    ribsK(x1 + 0.05, (z0 + z1) / 2, 'z', 20, 0.5, H - 0.3, 1.2, 1); ribsK((x0 + x1) / 2, z0 - 0.05, 'x', 24, 0.5, H - 0.3, 1.2, -1); ribsK((x0 + x1) / 2, z1 + 0.05, 'x', 24, 0.5, H - 0.3, 1.2, 1);
    k._faceQuad('metal', [[x0 - 0.6, H, z0 - 0.6], [x0 - 0.6, H, z1 + 0.6], [x0 + 2.6, H - 0.8, z1 + 0.6], [x0 + 2.6, H - 0.8, z0 - 0.6]], [1, 0, 0.12], FROST);
    for (const z of [z0 + 1, (z0 + z1) / 2, z1 - 1]) pipe('steelDark', [x0 + 2.4, 0, z], [x0 + 2.4, H - 0.9, z], 0.1, 6);
    for (let z = z0 + 1.6; z < z1 - 1; z += 2.4) {
      Bk('steelDark', x1 - 1.3, 1.6, z, 0.12, 3.2, 0.12, null, 0.02);
      for (let sh = 0; sh < 3; sh++) Bk('steel', x1 - 1.6, 0.5 + sh * 1.1, z + 1.2, 1.2, 0.07, 2.4, GREY, 0.02);
    }
    const goods = [[0.35, 0.28, 0.22], [0.4, 0.42, 0.48], [0.55, 0.5, 0.3], [0.3, 0.36, 0.5]];
    for (let z = z0 + 1.6; z < z1 - 1; z += 2.4) for (let sh = 0; sh < 3; sh++) for (let j = 0; j < 2; j++) Bk('paint', x1 - 1.6, 0.7 + sh * 1.1, z + 0.7 + j * 1.1, 0.9, 0.5, 0.8, goods[(Math.floor(z) + sh + j) & 3], 0.03);
    // the counter has a 4 m gap in the middle (z 54 to 58) so a customer can walk up to the quartermaster
    for (const zc of [50.5, 61.5]) { Bk('plasticDark', 27.9, 0.55, zc, 1.0, 1.1, 7, [0.4, 0.38, 0.42], 0.04); Xk('steel', 27.9, 1.12, zc, 1.2, 0.06, 7.2, STEEL); }
    for (const z of [52.5, 59.5]) { Bk('plasticDark', 27.95, 1.4, z, 0.5, 0.5, 0.06, null, 0.02); Xk('glowCyan', 28.0, 1.4, z, 0.4, 0.38, 0.02); }
    for (let z = z0 + 2.5; z < z1; z += 4) lampK(x0 + 6, H - 0.5, z, 2.2);
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.2), new THREE.MeshBasicMaterial({ map: signTexture(['QUARTERMASTER', 'WATER · RATIONS · CABLE · SPARES · POWER CELLS'], 1024, 250, { size: 0.3 }), toneMapped: false }));
    sg.position.set(x0 + 0.4, H - 0.5, 56); sg.rotation.y = -Math.PI / 2; root.add(sg);
    barrelK(24.4, 44.2, [0.3, 0.28, 0.4]); barrelK(23.6, 44.9, [0.5, 0.44, 0.26]); crateK(24.2, 68.4, 1.6, 1.4, 1.6, [0.36, 0.34, 0.44], 0, 0.3);
  }

  // ---- floodlight masts, drums, crates, cable runs, the lit ways ----
  for (const [mx, mz] of [[-38, -30], [40, -34], [44, 40], [-40, 46], [0, -60]]) {
    cyl('steelDark', mx, 8, mz, 0.22, 16, 8, { r2: 0.14 }); Bk('concrete', mx, 0.25, mz, 1.2, 0.5, 1.2, null, 0.05);
    k.push(mx, 16.2, mz, Math.atan2(-mz, -mx));
    Bk('steelDark', 0, 0, 0, 0.3, 0.3, 3.0, null, 0.04);
    for (let j = -1; j <= 1; j++) { Bk('steelDark', 0.3, 0.1, j * 0.95, 0.3, 0.7, 0.85, null, 0.03); Xk('glowWhite', 0.47, 0.1, j * 0.95, 0.02, 0.55, 0.7); }
    k.pop();
  }
  for (let i = 0; i < 9; i++) barrelK(-34 + (i % 3) * 0.7, 40 + Math.floor(i / 3) * 0.7, [[0.3, 0.28, 0.4], [0.35, 0.4, 0.48], [0.5, 0.46, 0.28]][i % 3]);
  for (const [x, z, w, h, d, c] of [[36, 14, 2.4, 1.5, 2.4, [0.4, 0.42, 0.5]], [40, 17.5, 1.8, 1.2, 1.8, [0.5, 0.44, 0.3]], [-30, -14, 2.6, 1.6, 2.2, [0.36, 0.4, 0.5]], [-34, -10, 1.6, 1.2, 1.6, [0.5, 0.32, 0.24]]]) crateK(x, z, w, h, d, c, 0, x * 0.1);
  pipe('pipeYellow', [0, 1.2, -119], [0, 1.2, -70], 0.09, 6); pipe('pipeBlue', [0.6, 1.0, -119], [0.6, 1.0, -70], 0.08, 6);
  for (let z = -114; z < -72; z += 8) Bk('steelDark', 0.3, 0.6, z, 0.26, 1.2, 0.26, null, 0.03);
  // worn dark tracks along the camp's ways
  Xk('concrete', 0, 0.031, -52, 5, 0.012, 40, [0.3, 0.3, 0.32]);
  Xk('concrete', -26, 0.032, 30, 40, 0.012, 5, [0.3, 0.3, 0.32]);

  // ---- far props on open ground: the dead relay, and the door of Sealed Site Four ----
  const blinkers = [];
  {
    // the relay on the Listening Scar's rim: a mast fallen against its own dish, panels scattered, one red eye still blinking
    const x = 610, z = -480, gy = groundY(x, z);
    k.push(x, gy, z, 0.7);
    pipe('steelDark', [0, 0, 0], [6.5, 11, 1.5], 0.18, 8);
    for (let t = 0.8; t < 6; t += 1.1) Bk('steelDark', t, t * 1.7, t * 0.23, Math.max(0.2, 0.9 - t * 0.09), 0.12, Math.max(0.2, 0.9 - t * 0.09), null, 0.02);
    cyl('steelDark', 1.2, 0.5, -1.2, 0.5, 1.0, 10);
    k.dome('steel', 1.2, 1.1, -1.2, 2.6, low ? 10 : 16, low ? 4 : 7, { thetaMax: Math.PI * 0.5, col: [0.5, 0.5, 0.55] });
    Xk('steel', 2.6, 0.35, 2.2, 2.6, 0.06, 1.8, GREY); Xk('steel', -1.8, 0.3, 1.8, 2.2, 0.06, 1.6, GREY);
    k.pop();
    const lampM = new THREE.MeshBasicMaterial({ color: 0xff2a20, toneMapped: false });
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), lampM); eye.position.set(x + 6.4, gy + 11.1, z + 1.5); root.add(eye);
    blinkers.push({ mat: lampM, phase: 0 });
  }
  {
    // Sealed Site Four: a violet door of seven locks in a low ice mound, glyph-lit, fenced, signposted (Mystara will not open it)
    const x = 330, z = 610, gy = groundY(x, z);
    k.dome('concrete', x, gy - 0.4, z, 9, low ? 12 : 20, low ? 5 : 9, { scaleY: 0.35, col: [0.72, 0.75, 0.82], thetaMax: Math.PI / 2 });
    k.push(x, gy, z, Math.PI / 4);
    Bk('wall', 0, 2.6, 0, 4.6, 5.2, 1.4, BASALT, 0.1);
    Bk('glyphGold', 0, 5.35, 0, 4.8, 0.3, 1.5, null, 0.04);
    for (let i = 0; i < 7; i++) { const a = (i - 3) * 0.5; cyl('steel', Math.sin(a) * 1.6, 2.4, 0.78, 0.16, 0.5, 8, { col: GOLD, axis: 'z' }); }
    Xk('glyphViolet', 0, 0.5, 0.74, 4.2, 0.14, 0.02);
    k.pop();
    for (const [fx, fz] of [[-8, -8], [8, -8], [-8, 8], [8, 8]]) { const fy = groundY(x + fx, z + fz); Bk('steelDark', x + fx, fy + 0.7, z + fz, 0.14, 1.4, 0.14, null, 0.02); }
    pipe('steelDark', [x - 8, groundY(x - 8, z - 8) + 1.2, z - 8], [x + 8, groundY(x + 8, z - 8) + 1.2, z - 8], 0.02, 4);
    const ss = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.1), new THREE.MeshBasicMaterial({ map: signTexture(['SEALED SITE FOUR', 'DO NOT'], 640, 160, { size: 0.34 }), toneMapped: false, side: THREE.DoubleSide }));
    ss.position.set(x - 11, groundY(x - 11, z - 13) + 1.6, z - 13); ss.rotation.y = -2.4; root.add(ss);
  }

  // ---- the prospectors' camp (the world port, 1.2 km north): huts, a drill rig, a claim board, string lights, a buggy ----
  if (portPi) {
    Xp('concrete', 0, -0.18, 0, 40, 0.36, 30, [0.74, 0.72, 0.68]);
    for (const [hx, hz, rot] of [[-14, -6, 0.06], [0, -12, -0.04], [20, -8, 0.1]]) {
      kp.push(hx, 0, hz, rot);
      Bp('wall', 0, 1.9, 0, 14, 3.8, 5.6, [0.42, 0.34, 0.26], 0.06);
      for (let t = -6.6; t <= 6.6; t += 0.8) Xp('steelDark', t, 1.9, 2.83, 0.07, 3.6, 0.04, [0.34, 0.27, 0.2]);
      Bp('steelDark', 0, 3.9, 0, 14.2, 0.16, 5.8, [0.35, 0.3, 0.26], 0.04);
      Bp('plasticDark', 3.2, 4.2, -1, 1.6, 0.5, 1.4, null, 0.04);
      Bp('steelDark', -3.4, 1.4, 2.9, 1.2, 2.4, 0.12, null, 0.03); Xp('glowAmber', -3.4, 2.0, 2.96, 1.0, 0.9, 0.02, [0.9, 0.8, 0.62]);
      kp.pop();
    }
    { // the drill rig: a small derrick over the warm borehole
      const rx = -4, rz = 16;
      for (const [dx, dz] of [[-2.4, -2.4], [2.4, -2.4], [-2.4, 2.4], [2.4, 2.4]]) pipeP('steelDark', [rx + dx, 0, rz + dz], [rx + dx * 0.25, 15, rz + dz * 0.25], 0.14, 8);
      for (const y of [4, 8, 12]) {
        Bp('steelDark', rx, y, rz - 2.4 + y * 0.12, Math.max(0.3, 4.8 - y * 0.28), 0.14, 0.14, null, 0.02);
        Bp('steelDark', rx, y, rz + 2.4 - y * 0.12, Math.max(0.3, 4.8 - y * 0.28), 0.14, 0.14, null, 0.02);
        Bp('steelDark', rx - 2.4 + y * 0.12, y, rz, 0.14, 0.14, Math.max(0.3, 4.8 - y * 0.28), null, 0.02);
        Bp('steelDark', rx + 2.4 - y * 0.12, y, rz, 0.14, 0.14, Math.max(0.3, 4.8 - y * 0.28), null, 0.02);
      }
      pipeP('steel', [rx, 14.8, rz], [rx, 2.2, rz], 0.3, 10);
      cylP('metal', rx, 0.5, rz, 1.1, 1.0, 12, { col: [0.35, 0.28, 0.2] });
      Xp('glowAmber', rx, 1.05, rz, 1.6, 0.06, 1.6, [0.8, 0.5, 0.25]);
      Xp('glowRed', rx, 15.3, rz, 0.3, 0.3, 0.3);
    }
    { // the claim board: the open seat, in plain words
      const bx = 10, bz = 8;
      for (const s of [-1, 1]) Bp('steelDark', bx + s * 2.2, 1.4, bz, 0.18, 2.8, 0.18, null, 0.02);
      const cb = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 1.6), new THREE.MeshBasicMaterial({ map: signTexture(['THE OPEN SEAT', 'RAISE A BUILDING AND IT IS YOURS'], 900, 260, { bg: '#241c10', fg: '#ffd36b', border: '#8a6a2a', size: 0.3 }), toneMapped: false, side: THREE.DoubleSide }));
      cb.position.set(bx, 2.2, bz); portRoot.add(cb);
    }
    for (const [lx0, lz0, lx1, lz1, y] of [[-21, -16, 27, -16, 3.4], [-21, 13, 14, 13, 3.2]]) {          // string lights
      pipeP('pipeYellow', [lx0, y, lz0], [lx1, y, lz1], 0.02, 4);
      const n = Math.max(2, Math.round(Math.hypot(lx1 - lx0, lz1 - lz0) / 3));
      for (let i = 0; i <= n; i++) { const t = i / n; Xp('glowAmber', lx0 + (lx1 - lx0) * t, y - 0.12 - Math.sin(t * Math.PI) * 0.35, lz0 + (lz1 - lz0) * t, 0.14, 0.14, 0.14); }
    }
    cylP('steelDark', -24, 6, 14, 0.12, 12, 8, { r2: 0.07 }); Xp('glowAmber', -24, 12.3, 14, 0.3, 0.24, 0.3);   // the camp beacon
    cylP('metal', -18, 0.48, 10, 0.3, 0.95, 10, { col: [0.45, 0.36, 0.24] }); cylP('metal', -17.2, 0.48, 10.6, 0.3, 0.95, 10, { col: [0.32, 0.36, 0.44] });
    kp.push(18, 0, 6, 0.2); Bp('paint', 0, 0.65, 0, 1.7, 1.3, 1.7, [0.44, 0.38, 0.28], 0.03); kp.pop();
    { // a tracked buggy parked by the huts
      const gx2 = -12, gz = 4;
      kp.push(gx2, 0, gz, 0.3);
      for (const s of [-1, 1]) { Bp('rubber', 0, 0.55, s * 1.1, 3.4, 0.8, 0.5, null, 0.08); for (let wx = -1.3; wx <= 1.3; wx += 0.65) cylP('steelDark', wx, 0.55, s * 1.12, 0.34, 0.54, 8, { axis: 'z' }); }
      Bp('wall', 0, 1.35, 0, 3.2, 0.7, 1.9, [0.5, 0.42, 0.3], 0.08);
      Bp('wall', 0.4, 2.1, 0, 1.8, 0.9, 1.7, [0.55, 0.46, 0.32], 0.08);
      kp.box('glassTint', 1.32, 2.2, 0, 0.08, 0.6, 1.4);
      pipeP('steelDark', [-1.2, 1.8, 0.6], [-1.2, 3.2, 0.6], 0.04, 5); Xp('glowRed', -1.2, 3.3, 0.6, 0.16, 0.16, 0.16);
      kp.pop();
    }
  }

  // ---- merge each site into meshes, add the pad's painted decal, the signs, the notice board ----
  const GLYPH_VIOLET = new THREE.MeshBasicMaterial({ color: 0x9b6bff, toneMapped: false });
  const GLYPH_GOLD = new THREE.MeshBasicMaterial({ color: 0xd8c27a, toneMapped: false });
  const mapMats = { ...mats, glyphViolet: GLYPH_VIOLET, glyphGold: GLYPH_GOLD };
  root.add(k.toGroup(mapMats, { name: 'camp-kit', cast: true, receive: true }));
  if (portPi) portRoot.add(kp.toGroup(mapMats, { name: 'prospectors-kit', cast: true, receive: true }));
  const padTex = padTexture();
  const padDecal = new THREE.Mesh(new THREE.PlaneGeometry(MAIN_PAD.w - 1, MAIN_PAD.d - 1), new THREE.MeshStandardMaterial({ map: padTex, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 }));
  padDecal.rotation.x = -Math.PI / 2; padDecal.position.set(0, 0.025, 0); padDecal.receiveShadow = true; root.add(padDecal);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(13, 3.2), new THREE.MeshBasicMaterial({ map: signTexture([OUTPOST_NAME, 'MYSTARA · VALHALLA BASIN · CALLISTO'], 1280, 320, { size: 0.3 }), toneMapped: false, side: THREE.DoubleSide }));
  sign.position.set(24, 5.6, 62); root.add(sign);
  for (const sx of [18.6, 29.4]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, 5.8, 0.4), mats.metal); post.position.set(sx, 2.9, 62); root.add(post); }
  root.add(buildBoard({ ...DESKS.callisto.board, title: 'JOBS', sub: 'HANDS FOR HIRE · ASK THE CAMP DESK', seed: 53 }));
  // the middle array stone's glyph: a separate mesh with its own pulsing material
  const pulseMat = new THREE.MeshBasicMaterial({ color: 0x9b6bff, toneMapped: false, transparent: true });
  const pulse = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.34, 0.06), pulseMat);
  if (pulseStone) { pulse.position.set(pulseStone.x, pulseStone.h * 0.62, pulseStone.z); pulse.rotation.y = -pulseStone.a + Math.PI / 2; root.add(pulse); }

  // placement: each group's axes are (east, up, south) at its site
  const place = (grp, sitePi) => {
    const east = new THREE.Vector3(sitePi.east.x, sitePi.east.y, sitePi.east.z), up = new THREE.Vector3(sitePi.up.x, sitePi.up.y, sitePi.up.z), south = new THREE.Vector3().crossVectors(east, up).normalize();
    const quat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(east, up, south));
    engine.scene.add(grp);
    return engine.track({ worldPos: { x: sitePi.point.x, y: sitePi.point.y, z: sitePi.point.z }, object3d: grp, quaternion: quat, frame });
  };
  const entry = place(root, pi);
  const portEntry = portPi ? place(portRoot, portPi) : null;

  // ---- the people (cast.js): one at the prospectors' camp, the rest at the pad ----
  const people = new CampPeople({ roots: { pad: root, port: portRoot }, padPi: pi, portPi, people: space.peopleLib || null });
  let t = 0;
  const out = {
    root, portRoot, entry, portEntry, people,
    update(dt, walkerWorldPos, walker) {
      t += dt;
      pulseMat.opacity = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 2.1));
      for (const b of blinkers) b.mat.color.setHex(Math.sin(t * 2.4 + b.phase) > 0.3 ? 0xff2a20 : 0x330806);
      people.tick(dt, walkerWorldPos);
      if (walker && walkerWorldPos) {
        const p = frameToOutpost(pi, walkerWorldPos);
        if (Math.abs(p.x) < 200 && Math.abs(p.z) < 200 && pushOut(p, BOXES)) {
          const w = outpostToFrame(pi, p.x, p.y, p.z); walker.worldPos.x = w.x; walker.worldPos.y = w.y; walker.worldPos.z = w.z;
          bleedSideways(walker, pi.up);
        } else if (portPi && Math.abs(p.x) < 80 && Math.abs(p.z + 1200) < 80) {
          const pc = frameToOutpost(portPi, walkerWorldPos);
          if (pushOut(pc, PORT_BOXES)) { const w = outpostToFrame(portPi, pc.x, pc.y, pc.z); walker.worldPos.x = w.x; walker.worldPos.y = w.y; walker.worldPos.z = w.z; bleedSideways(walker, portPi.up); }
        }
      }
    },
    setVisible(on) { root.visible = on; if (portRoot) portRoot.visible = on; },
    dispose() { engine.untrack(entry); engine.scene.remove(root); if (portEntry) engine.untrack(portEntry); if (portRoot) engine.scene.remove(portRoot); GLYPH_VIOLET.dispose(); GLYPH_GOLD.dispose(); pulseMat.dispose(); },
  };
  return out;
}

/** The camp's people: the same Loft bodies as everywhere, dressed by F0's faction styles, standing where cast.js puts them.
 *  A person has the shape of a port worker so the Talk button treats them the same; `talk`/`act`/`speech` drive the panel. */
class CampPeople {
  constructor(o) { this.roots = o.roots; this.padPi = o.padPi; this.portPi = o.portPi; this.library = o.people; this.members = []; this.built = false; }
  async build() {
    if (this.built || !this.library) return this;
    this.built = true;
    const roster = await this.library.roster();
    let seq = 0;
    for (const w of PEOPLE) {
      const r = roster.find((q) => q.id === w.body) || roster[0];
      const person = r ? this.library.spawn(r.id, r.file) : new Person(w.body);
      const st = factionStyle(w.faction);
      const look = { ...factionLook(w.faction, seq++, w.role), personId: w.body };
      Object.assign(look, { helmet: true, shell: st.palette.primary, helmetTrim: st.palette.accent, visorTint: 0x20262e, visorOpacity: 0.7 });
      person.dress(look);
      person.play('Idle', 0);
      if (w.site === 'port' && this.portPi) {
        const wp = outpostToFrame(this.padPi, w.x, 0, w.z);
        const local = frameToOutpost(this.portPi, wp);
        person.group.position.set(local.x, 0.02, local.z);
      } else {
        person.group.position.set(w.x, 0.02, w.z);
      }
      person.group.rotation.y = { south: 0, east: Math.PI / 2, north: Math.PI, west: -Math.PI / 2 }[w.face] || 0;
      (this.roots[w.site === 'port' ? 'port' : 'pad'] || this.roots.pad).add(person.group);
      this.members.push({ ...w, y: 0, status: 'worker', def: { title: w.title }, person, line: w.line, world: true,
        talk: (view, e) => this._talk(w, view, e), act: (a, ds, ui) => this._act(w, a, ds, ui),
        speech: (view) => this._speech(w, view),
        worldDist: (worldPos) => { const p = frameToOutpost(this.padPi, worldPos); return Math.hypot(p.x - w.x, p.y, p.z - w.z); } });
    }
    await Promise.all(this.members.map((m) => m.person.ready));
    return this;
  }
  tick(dt, worldPos) {
    if (!this.built || !worldPos) return;
    const p = frameToOutpost(this.padPi, worldPos), range = this.library && this.library.phone ? 90 : 160;
    for (const m of this.members) {
      m.person.group.visible = Math.hypot(p.x - m.x, p.z - m.z) < range;
      if (m.person.group.visible) m.person.update(dt);
    }
  }
  nearest(worldPos) {
    const p = frameToOutpost(this.padPi, worldPos);
    let best = null, dist = 3;
    for (const m of this.members) { const d = Math.hypot(p.x - m.x, p.y, p.z - m.z); if (d < dist && personVisible(m.person)) { best = m; dist = d; } }
    return best;
  }
  _speech(w, view) {
    if (view === 'answer') return w.answer ? [{ voice: w.voice, text: w.answer }] : [];
    return w.line ? [{ voice: w.voice, text: w.line }] : [];
  }
  _talk(w, view, e) {
    void e;
    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    let h = view === 'answer' ? `<p class="stat">${esc(w.title)}</p><div class="col">` : `<p>${esc(w.line)}</p><div class="col">`;
    if (view === 'answer') h += `<div class="say">${esc(w.answer)}</div><button class="cbtn" data-a="worker-reply">${esc(w.reply)}</button>`;
    else h += `<button class="cbtn" data-a="worker-question">${esc(w.question)}</button>`;
    return h + `<button class="cbtn" data-a="close">Goodbye</button></div>`;
  }
  async _act(w, a, ds, ui) { void w; void a; void ds; void ui; return null; }
}
