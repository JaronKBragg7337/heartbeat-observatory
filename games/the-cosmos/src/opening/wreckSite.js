// The crash site on the ground: the plowed scar behind the hull, heaped dirt, debris that lies on the dirt, rocks,
// a burning engine pod. Everything is placed from the real terrain height, so nothing floats. Frame: the opening's
// local ground frame (x right, y up, z back). The ship slid in from -z and stopped nose-first at about z = +14.
import * as THREE from 'three';
import { Kit3, sheet, obox, beam, cable, rng, fbm, noise, sstep, lerp, clamp } from './wreckKit.js';
import { seatForSite, bagForSite } from './freighterInterior.js';

function blobTexture() {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(.55, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
}

// A ribbon draped on the terrain along a path, with a height profile and per-vertex colour+alpha (soft edges, no seams).
function ribbon(h, path, halfW, K, profile, colour) {
  const rows = path.length, cols = K * 2 + 1, pos = new Float32Array(rows * cols * 3), col = new Float32Array(rows * cols * 4), idx = [];
  for (let i = 0; i < rows; i++) {
    const a = path[Math.max(0, i - 1)], b = path[Math.min(rows - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l, hw = typeof halfW === 'function' ? halfW(i, path[i]) : halfW;
    for (let j = 0; j < cols; j++) {
      const u = (j - K) / K, x = path[i][0] + nx * u * hw, z = path[i][1] + nz * u * hw, v = i * cols + j, pr = profile(u, i, x, z), cc = colour(u, i, x, z);
      pos.set([x, h(x, z) + pr, z], v * 3); col.set(cc, v * 4);
    }
  }
  for (let i = 0; i < rows - 1; i++) for (let j = 0; j < cols - 1; j++) { const a = i * cols + j, b = a + 1, c = a + cols, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 4)); g.setIndex(idx); g.computeVertexNormals();
  const nn = g.attributes.normal; for (let i = 0; i < nn.count; i++) if (nn.getY(i) < 0) nn.setXYZ(i, -nn.getX(i), -nn.getY(i), -nn.getZ(i));
  return g;
}

export function buildSite({ ext, mats, h, low, scaleRef }) {
  const group = new THREE.Group(); group.name = 'wreck-site';
  const rnd = rng(9137);
  const dirtMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
  const soil = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, side: THREE.DoubleSide, roughness: 1, metalness: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const emit = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  const M = { ...ext, dirt: dirtMat, emerg: emit };
  const geos = [], mats2 = [soil, dirtMat, emit];
  const fall = (u) => 1 - sstep(.72, 1, Math.abs(u));

  // --- the scar: churned dirt in the channel, heaped berms on either side, fading out beyond the fine terrain
  const path = []; for (let z = 12.5; z >= -66; z -= low ? 2.2 : 1.4) path.push([-.2 + .55 * Math.sin(z * .05) + .35 * noise(z * .12, 3), z]);
  const wz = (z) => 3.5 + 1.6 * sstep(-50, 10, z);
  const fade = (z) => sstep(-68, -34, z) * 1 + 0;            // 0 at the far end, 1 near the hull
  const scarGeo = ribbon(h, path, (i, p) => wz(p[1]) * 1.55, low ? 6 : 10,
    (u, i, x, z) => { const a = Math.abs(u), f = fade(z); const berm = (.42 * f + .05) * Math.exp(-(((a - .72) / .24) ** 2)) * (.75 + .5 * noise(x * .5, z * .5)); return berm + .02; },
    (u, i, x, z) => { const a = Math.abs(u), f = fade(z), n = noise(x * .8, z * .8, 9); const al = clamp((1 - sstep(.6, 1, a)) * (.25 + .75 * f), 0, 1);
      const chan = 1 - sstep(.45, .66, a); const grain = .8 + .35 * n + .12 * Math.sin(u * 52 + z * .1) * chan;
      const cr = lerp(.62 * grain, .3 * grain, chan), cg = lerp(.3 * grain, .15 * grain, chan), cb = lerp(.21 * grain, .11 * grain, chan);
      return [cr, cg, cb, al * (.55 + .45 * (chan + (1 - chan) * .8))]; });
  geos.push(scarGeo); group.add(new THREE.Mesh(scarGeo, soil));
  group.children[group.children.length - 1].renderOrder = 1;

  // --- heaped dirt hugging the hull, and the pile the nose pushed up
  const heapCol = (u, i, x, z) => { const n = noise(x * .7, z * .7, 4); return [.5 + .12 * n, .25 + .07 * n, .17 + .05 * n, 1 - sstep(.5, 1, Math.abs(u))]; };
  const side = (x0, z0, z1, ht, hw) => { const p = []; for (let z = z0; z <= z1; z += 1.2) p.push([x0 + .3 * Math.sin(z * .3), z]); return ribbon(h, p, hw, 6, (u, i, x, z) => ht * (1 - u * u) * (.7 + .5 * noise(x * .5, z * .5, 2)) * sstep(z0 - .5, z0 + 3, z) * sstep(z1 + .5, z1 - 3, z), heapCol); };
  for (const g of [side(-4.9, -13, 13, .55, 1.9), side(4.8, -12, 11, .48, 1.7), side(3.9, -13, 4, .3, .9)]) { geos.push(g); const m = new THREE.Mesh(g, soil); m.renderOrder = 2; group.add(m); }
  // --- contact shadow blobs (the phone tier has no real shadows)
  const blobT = blobTexture(), blobM = new THREE.MeshBasicMaterial({ map: blobT, transparent: true, depthWrite: false, opacity: .8, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }); mats2.push(blobM);
  const blob = (x, z, rx, rz, yaw = 0, op = 1) => { const g = new THREE.PlaneGeometry(2, 2, 6, 6); g.rotateX(-Math.PI / 2); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const px = p.getX(i) * rx, pz = p.getZ(i) * rz, c = Math.cos(yaw), s = Math.sin(yaw), wx = x + px * c - pz * s, wz2 = z + px * s + pz * c; p.setXYZ(i, wx, h(wx, wz2) + .045, wz2); }
    geos.push(g); const m = new THREE.Mesh(g, blobM); m.renderOrder = 3; m.material = blobM; group.add(m); };
  blob(-.2, 0, 4.9, 15.5, 0); blob(-.3, -14, 4.2, 4.2, 0);

  // --- debris, rock and gear: one merged kit per material
  const dk = new Kit3(low); dk.tiles = { hull: 8, metal: 1 };
  const rest = (x, z, r) => { let m = h(x, z); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; m = Math.max(m, h(x + Math.cos(a) * r, z + Math.sin(a) * r)); } return m; };
  const plate = (x, z, w, d, yaw, lean = 0, key = 'hull', bend = .14) => {
    const y = rest(x, z, Math.max(w, d) * .5) + .05 + Math.abs(lean) * w * .5;
    dk.push(x, y, z, yaw, 0, lean);
    sheet(dk, key, { P: (u, v) => [u, bend * Math.cos(u * 1.7) * Math.cos(v * 1.3) + .06 * (u * u) / (w * w) * 4 + (fbm(u * 1.2, v * 1.2, 4) - .5) * .12, v], a0: -w / 2, a1: w / 2, b0: -d / 2, b1: d / 2, cell: .3, cellB: .3,
      field: (u, v) => { const a = u / (w * .5), b = v / (d * .5), n = (fbm(u * 1.9 + 3, v * 1.9 + yaw * 5) - .5) * .55; const hp = Math.min(1 - Math.abs(a), 1 - Math.abs(b), (1.55 - Math.abs(a + b * .45)) * .8, (1.5 - Math.abs(a - b * .6)) * .8); return (hp + n) * Math.min(w, d) * .5; }, faceTo: () => [0, 1, 0], thick: .035, uv: (u, v) => [u / 8, v / 8],
      col: (p, f) => { const dust = .55 + .25 * noise(p[0] * 2, p[2] * 2, 4), soot = 1 - (1 - sstep(0, .5, f)) * .7; return [lerp(.85, .75, dust) * soot, lerp(.85, .42, dust) * soot, lerp(.85, .32, dust) * soot]; },
      inner: { key: 'steelDark', tint: [.5, .46, .42] }, lip: { key: 'steel', tint: [1, .88, .72] }, nearM: 1 });
    dk.pop();
  };
  const arc = (x, z, yaw, r, ang, key = 'steelDark') => { const pts = []; for (let i = 0; i <= 8; i++) { const a = -ang / 2 + ang * i / 8; pts.push([Math.sin(a) * r, Math.cos(a) * r * .0 + (1 - Math.cos(a)) * r * .35, Math.cos(a) * r * .0 + Math.sin(a * .5) * .0]); }
    dk.push(x, rest(x, z, r * .6) + .09, z, yaw);
    let prev = null; for (let i = 0; i <= 8; i++) { const a = -ang / 2 + ang * i / 8, p = [Math.sin(a) * r, .0, (1 - Math.cos(a)) * r]; if (prev) { beam(dk, key, prev, p, .07, .22, [.55, .53, .5]); beam(dk, 'steel', [prev[0], prev[1] + .1, prev[2]], [p[0], p[1] + .1, p[2]], .17, .035, [.6, .58, .55]); } prev = p; }
    dk.pop(); };
  // plates around the scar and out along it
  const pl = [[-6.5, -16.5, 3.1, 2.2, .6, 0], [6.2, -18, 2.4, 1.7, -.4, 0], [-2.1, -24, 4.2, 2.4, .2, .0], [3.8, -31, 2.6, 1.9, 1.2, .0], [-7.4, -33, 2.9, 2.1, -.7, .0], [1.2, -41, 3.4, 2.3, .9, 0], [-5.2, -48, 2.3, 1.7, .3, 0], [7.4, -9, 2.2, 1.6, .5, 0], [-8.6, -4, 2.6, 1.8, -.2, 0], [8.8, 3, 2.0, 1.5, .1, 0], [-8.8, 9.5, 2.4, 1.6, 1.4, 0], [5.6, -26, 1.9, 1.4, 2.2, 0]];
  for (const [x, z, w, d, yaw, lean] of pl) plate(x, z, w, d, yaw, lean);
  // plates leaning on the berm
  plate(-5.9, 6, 3.4, 1.9, 1.57, -.2); plate(5.9, -2, 2.9, 1.7, -1.5, .2); plate(-5.5, -8.5, 2.2, 1.6, 1.4, -.2, 'hull', .1);
  for (const [x, z, yaw, r, ang] of [[-6.8, -10, .5, 3.2, 1.4], [6.5, -13, 2.1, 2.6, 1.2], [-2.2, -19, 1.2, 3.8, 1.5], [3.2, -29, 2.5, 2.8, 1.1], [-9.4, -24, 2.9, 2.5, 1.3], [-4.5, 11.6, .2, 2.4, 1.1]]) arc(x, z, yaw, r, ang);
  // seats torn from the floor, lying where they landed
  for (const [x, z, yaw, st] of [[-7.3, -12.5, .9, 'ripped'], [5.6, -22, 2.3, 'torn'], [-3.4, -28, 4.1, 'ok'], [-9.6, -18, 3.4, 'ripped'], [2.4, -37, .3, 'torn']]) {
    const y = rest(x, z, .9) + .56;
    dk.push(x, y, z, yaw, rnd() * .3 - .15, (rnd() < .5 ? 1 : -1) * 1.5); seatForSite(dk, st, low, rnd); dk.pop();
  }
  // luggage thrown clear
  for (const [x, z, yaw, w, hh, d, key, col, open] of [[-4.9, -17, .3, .7, .32, .46, 'leather', [.9, .55, .35]], [3.4, -15, 1.7, .6, .3, .4, 'crateC', null, true], [-1.2, -22, 2.6, .8, .34, .5, 'plasticDark', [1, 1.05, 1.2]], [6.9, -9, .4, .6, .3, .4, 'red', [.8, .75, .75]], [-6.3, -26, 1.1, .74, .32, .48, 'crateA', null], [2.2, -34, 2.9, .66, .3, .44, 'leather', [.7, .6, .55], true], [-3, -45, 0, .6, .3, .4, 'crateB', null], [-10, -2, 1.9, .7, .3, .46, 'plasticDark', null, true], [0.2, 7.2, 5.1, .7, .3, .45, 'red', null]]) {
    const y = rest(x, z, .5); dk.push(x, y, z, 0); bagForSite(dk, 0, 0, yaw, w, hh, d, key, col || undefined, rnd, open, rnd() < .45); dk.pop();
  }
  // scrap: small bits lying about, heavier close to the hull
  for (let i = 0; i < (low ? 40 : 90); i++) {
    const z = -62 + rnd() * 78, spread = 3 + Math.min(20, Math.abs(z + 8) * .35), x = (rnd() - .5) * 2 * spread; if (Math.abs(x) < 3.6 && z > -12 && z < 15) continue;
    const s = .08 + rnd() * rnd() * .55, y = rest(x, z, s) + .02;
    dk.push(x, y, z, rnd() * 6.28, (rnd() - .5) * .5, (rnd() - .5) * .5);
    if (rnd() < .6) dk.bevelBox(['hull', 'steelDark', 'hull', 'crateA'][i % 4], 0, 0, 0, s * 1.5, .012 + rnd() * .02, s, .004, { col: [.7 + rnd() * .3, .6 + rnd() * .25, .5 + rnd() * .2] });
    else dk.pipe('steelDark', [-s, 0, 0], [s, .02, .1 * s], .01 + rnd() * .012, 5);
    dk.pop();
  }
  // rocks (angular, dusty), clustered along the scar and around the crate
  const rk = new Kit3(low);
  const rock = (x, z, r) => { const y = rest(x, z, r * .7) + r * .2, g = new THREE.IcosahedronGeometry(r, r > .3 ? 2 : 1), p = g.attributes.position, ni0 = g.computeVertexNormals(), c0 = [.32 + rnd() * .08, .19 + rnd() * .05, .14 + rnd() * .04];
    for (let i = 0; i < p.count; i++) { const k = 1 + (noise(p.getX(i) * 5 + x, p.getZ(i) * 5 + z, 6) - .5) * .5; p.setXYZ(i, p.getX(i) * k * 1.15, p.getY(i) * k * .62, p.getZ(i) * k); }
    const q = rk._bucket('dirt'), base = q.pos.length / 3, yaw = rnd() * 6.28, cs = Math.cos(yaw), sn = Math.sin(yaw), ni = g.attributes.normal;
    for (let i = 0; i < p.count; i++) { const px = p.getX(i), pz = p.getZ(i); q.pos.push(x + px * cs - pz * sn, y + p.getY(i), z + px * sn + pz * cs); { const rx = p.getX(i) / 1.15, ry = p.getY(i) / .62, rz = p.getZ(i), rl = Math.hypot(rx, ry, rz) || 1, nx = ni.getX(i) * .2 + rx / rl * .8, ny = ni.getY(i) * .2 + ry / rl * .8, nz = ni.getZ(i) * .2 + rz / rl * .8; q.nrm.push(nx * cs - nz * sn, ny, nx * sn + nz * cs); } q.uv.push(0, 0);
      const t = .75 + .5 * noise(px * 8 + x, pz * 8, 8) + p.getY(i) * .6; q.col.push(c0[0] * t, c0[1] * t, c0[2] * t); }
    const ix = g.index ? Array.from(g.index.array) : Array.from({ length: p.count }, (_, i) => i); for (const i of ix) q.idx.push(base + i); rk.triangles += ix.length / 3; g.dispose(); };
  for (let i = 0; i < (low ? 34 : 80); i++) { const z = -52 + rnd() * 90, x = (rnd() - .5) * (14 + rnd() * 26); if (Math.abs(x) < 4.2 && z > -13 && z < 15) continue; if (Math.hypot(x - 4, z - 20) < 1.8) continue; rock(x, z, .1 + rnd() * rnd() * .5); }
  for (let i = 0; i < 9; i++) { const a = rnd() * 6.28, d = 2.2 + rnd() * 2.8; rock(4 + Math.cos(a) * d, 20 + Math.sin(a) * d, .12 + rnd() * .22); }
  rock(-11, -14, .6); rock(11, -6, .5); rock(-13, 6, .5); rock(8, -38, .6); rock(-10, -41, .7);

  // --- an engine pod, torn from the stern and still burning
  const ek = new Kit3(low); ek.tiles = { hull: 8, metal: 1 };
  const pod = { x: -17, z: -52, yaw: 2.4 };
  const py = rest(pod.x, pod.z, 2) + .95;
  ek.push(pod.x, py, pod.z, pod.yaw, .06, .28);
  const seg = low ? 14 : 24;
  ek.lathe('engine', 0, 0, 0, [[.05, -2.6], [.8, -2.55], [1.2, -2.2], [1.34, -1.5], [1.4, -.4], [1.4, 1.6], [1.2, 2.3], [.95, 2.5], [.85, 2.9], [1.25, 3.7], [1.75, 4.5], [1.82, 4.6]], seg, { axis: 'z', col: [.55, .53, .52] });
  ek.lathe('hull', 0, 0, 0, [[1.41, -1.7], [1.41, -.2]], seg, { axis: 'z', col: [.95, .85, .8] });
  for (const z of [-2.1, -1.0, .5, 1.5]) ek.lathe('steelDark', 0, 0, 0, [[1.36, z - .05], [1.46, z - .03], [1.46, z + .03], [1.36, z + .05]], seg, { axis: 'z', col: [.5, .5, .5] });
  ek.lathe('emerg', 0, 0, 0, [[.9, 3.3], [1.45, 4.1]], seg, { axis: 'z', col: [1.8, .5, .1], inward: true });
  for (let i = 0; i < 7; i++) { const a = i / 7 * 6.28; beam(ek, 'crateA', [Math.cos(a) * 1.4, Math.sin(a) * 1.4, -2.0], [Math.cos(a + .25) * (1.0 + rnd() * .6), Math.sin(a + .25) * (1.0 + rnd() * .6), -3.0 - rnd() * .8], .07, .1, [.8, .85, .7]); }
  beam(ek, 'steelDark', [.6, 1.3, -.5], [2.6, 2.9, -1.2], .22, .22, [.5, .5, .5]);   // the mounting strut, snapped
  ek.pop();

  const addKit = (k, matsMap, name, cast) => { const g = k.toGroup(matsMap, { name, cast: !low && cast, receive: true }); group.add(g); return g; };
  addKit(dk, M, 'site-debris', true); addKit(rk, M, 'site-rocks', true); addKit(ek, M, 'site-pod', true);

  // beacon + glow at the pod
  const emitters = [
    { p: [pod.x + Math.sin(pod.yaw) * 3.2, py + 1.2, pod.z + Math.cos(pod.yaw) * 3.2], count: 46, size: 2.6, rise: 2.0, life: 9, alpha: .55, spread: 1.0, color: [.1, .095, .095], lit: .09, windK: 1.6 },
    { p: [pod.x + Math.sin(pod.yaw) * 3.2, py + .8, pod.z + Math.cos(pod.yaw) * 3.2], count: 18, size: 1.1, rise: 2.4, life: 3, alpha: .4, spread: .6, color: [.9, .35, .08], windK: 1.0 },
  ];
  const podLight = low ? null : new THREE.PointLight(0xff7a2c, 14, 30, 1.7); if (podLight) { podLight.position.set(pod.x + Math.sin(pod.yaw) * 3.4, py + .6, pod.z + Math.cos(pod.yaw) * 3.4); group.add(podLight); }
  const update = (t) => { if (podLight) podLight.intensity = 12 + 5 * Math.sin(t * 13.1) * Math.sin(t * 7.3) + 3 * Math.sin(t * 29); };
  const dispose = () => { for (const g of geos) g.dispose(); for (const m of mats2) m.dispose(); blobT?.dispose(); };
  return { group, emitters, update, dispose, triangles: dk.triangles + rk.triangles + ek.triangles };
}
