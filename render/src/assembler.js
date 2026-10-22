// hb-render: building assembler for modular facade kits (round 7). A kit file lays its pieces out
// in a showroom grid; we measure each piece, tag it from its name + size, and assemble a facade
// N modules wide x M floors with rules: doors (and garage doors) only on the ground floor, windows
// above, corners at the ends, cornice last. A seed + the writer's words pick among valid pieces, so
// two requests never build the identical facade but every result is buildable (nothing floats).
//
// Connectors (sockets), kept simple on purpose: every piece has a left/right socket on its module
// width (3 m grid), a bottom/top socket on the floor height (3 m), and inserts (window_/door_
// pieces) attach to the matching wall_ frame at the frame's own offset in the showroom.

import { makeMesh } from './mesh.js';

function rng(seed) { let s = (seed >>> 0) || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const pick = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];

function bbox(mesh) {
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < mesh.pos.length; i += 3) for (let a = 0; a < 3; a++) { mn[a] = Math.min(mn[a], mesh.pos[i + a]); mx[a] = Math.max(mx[a], mesh.pos[i + a]); }
  return { mn, mx, size: [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]] };
}

// group the loaded primitives by root node name -> piece {name, meshes, bb, kind, family}
export function measureKit(model) {
  const byName = new Map();
  for (const m of model.meshes) { const key = m.name; if (!byName.has(key)) byName.set(key, []); byName.get(key).push(m); }
  const pieces = [];
  for (const [name, list] of byName) {
    const bbs = list.map((m) => bbox(m.mesh));
    const mn = [0, 1, 2].map((a) => Math.min(...bbs.map((b) => b.mn[a]))), mx = [0, 1, 2].map((a) => Math.max(...bbs.map((b) => b.mx[a])));
    const size = [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]];
    const n = name.toLowerCase();
    let kind = 'other';
    if (/^wall_/.test(n)) {
      if (/corner/.test(n)) kind = 'corner';
      else if (/pier|end/.test(n)) kind = 'other';
      else if (/garage/.test(n)) kind = 'wall-garage';
      else if (/door_window/.test(n)) kind = 'wall-doorwindow';
      else if (/door/.test(n)) kind = 'wall-door';
      else if (/window/.test(n) && !/offset/.test(n)) kind = 'wall-window';
      else if (/standard_standard/.test(n)) kind = 'wall-plain';
    } else if (/^(window|door)_/.test(n)) kind = 'insert';
    else if (/^(cornice|crown)/.test(n)) kind = /corner/.test(n) ? 'top-corner' : (/standard_standard/.test(n) ? 'top' : 'other');
    else if (/^(base|dado)/.test(n)) kind = 'other';
    // family links a frame to its insert: wall_window_centered_large_01 <-> window_centered_large_01
    pieces.push({ name, meshes: list, mn, mx, size, kind, family: n.replace(/^wall_/, '').replace(/_\d+$/, '') });
  }
  return pieces;
}

// clone a piece's meshes placed so that its showroom min corner lands at `at`; mirror flips x
function place(piece, at, mirror, extraOffset = [0, 0, 0]) {
  const out = [];
  for (const m of piece.meshes) {
    const src = m.mesh, pos = new Float32Array(src.pos), nrm = new Float32Array(src.nrm);
    for (let i = 0; i < pos.length; i += 3) {
      let x = pos[i] - piece.mn[0] + extraOffset[0], y = pos[i + 1] - piece.mn[1] + extraOffset[1], z = pos[i + 2] - piece.mn[2] + extraOffset[2];
      if (mirror) { x = piece.size[0] - x; nrm[i] = -nrm[i]; }
      pos[i] = x + at[0]; pos[i + 1] = y + at[1]; pos[i + 2] = z + at[2] - piece.size[2]; // facade face toward +z... keep the showroom's -z depth behind the face
    }
    out.push({ mesh: makeMesh(pos, nrm, src.uv, src.idx), material: m.material, name: m.name });
  }
  return out;
}

export function assembleBuilding(model, opts = {}) {
  const r = rng(opts.seed ?? 1);
  const pieces = measureKit(model);
  const walls = (k) => pieces.filter((p) => p.kind === k);
  const module = 3; // the kit's grid
  const floors = Math.max(1, Math.min(opts.floors ?? 2, 8));
  const width = Math.max(2, Math.min(opts.width ?? 4, 12));   // modules
  const features = (opts.features || []).map((f) => String(f).toLowerCase());
  const insertFor = (wall) => pieces.find((p) => p.kind === 'insert' && p.family === wall.family && Math.abs(p.mn[1] - wall.mn[1]) < 1.5 && p.mn[0] >= wall.mn[0] - 0.1 && p.mx[0] <= wall.mx[0] + 0.1 && Math.abs(p.mn[2] - wall.mn[2]) < 2.5);
  const report = [];
  const out = [];
  // one window family per building keeps it coherent
  const windowWalls = walls('wall-window');
  const families = [...new Set(windowWalls.map((p) => p.family.replace(/_\d+$/, '')))];
  const fam = families.length ? pick(r, families) : null;
  const famWalls = windowWalls.filter((p) => !fam || p.family.replace(/_\d+$/, '') === fam);
  const plain = walls('wall-plain');
  const doors = walls('wall-door'), garages = walls('wall-garage').filter((p) => p.size[0] <= 6.01), dw = walls('wall-doorwindow');
  const corners = walls('corner').filter((p) => p.size[0] <= 2.5), tops = walls('top'), topCorners = walls('top-corner').filter((p) => p.size[0] <= 2.5);
  const put = (piece, col, floor, mirror = false, zOff = 0) => {
    const at = [col * module, floor * module, zOff];
    out.push(...place(piece, at, mirror));
    const ins = insertFor(piece);
    // the insert keeps its showroom offset inside the frame (x, y) and its face depth relative to the frame's face (z)
    if (ins) out.push(...place(ins, [at[0] + (mirror ? (piece.size[0] - (ins.mx[0] - piece.mn[0])) : (ins.mn[0] - piece.mn[0])), at[1] + (ins.mn[1] - piece.mn[1]), at[2] + (ins.mx[2] - piece.mx[2])], mirror));
  };
  // ground floor: a door at a random column, a garage door if asked, windows/plain elsewhere
  const wantGarage = features.some((f) => /garage/.test(f)) && garages.length;
  const doorCol = Math.floor(r() * width);
  let garageCol = -1;
  if (wantGarage) { garageCol = Math.floor(r() * (width - 1)); if (garageCol === doorCol || garageCol + 1 === doorCol) garageCol = (garageCol + 2) % Math.max(1, width - 1); }
  for (let f = 0; f < floors; f++) {
    for (let c = 0; c < width; c++) {
      if (f === 0 && c === garageCol && garages.length) { const g = pick(r, garages); put(g, c, f); c += Math.round(g.size[0] / module) - 1; continue; }
      if (f === 0 && c === doorCol && doors.length) { put(pick(r, doors), c, f); continue; }
      const useWindow = famWalls.length && (f > 0 ? r() < 0.85 : r() < 0.6);
      if (useWindow) put(pick(r, famWalls), c, f);
      else if (f > 0 && dw.length && r() < 0.15) put(pick(r, dw), c, f);
      else if (plain.length) put(pick(r, plain), c, f);
      else if (famWalls.length) put(pick(r, famWalls), c, f);
    }
  }
  // corners at both ends (right end mirrored), every floor
  if (corners.length) {
    const ck = pick(r, corners);
    for (let f = 0; f < floors; f++) { out.push(...place(ck, [-ck.size[0], f * module, 0], false)); out.push(...place(ck, [width * module, f * module, 0], true)); }
  }
  // cornice along the top, last
  if (tops.length) {
    const t = pick(r, tops);
    for (let c = 0; c < width; c++) out.push(...place(t, [c * module, floors * module, 0], false));
    if (topCorners.length) { const tc = pick(r, topCorners); out.push(...place(tc, [-tc.size[0], floors * module, 0], false)); out.push(...place(tc, [width * module, floors * module, 0], true)); }
  }
  report.push(`${width} modules x ${floors} floors from ${pieces.length} kit pieces: ${fam ? 'windows ' + fam : 'no windows'}, door at column ${doorCol + 1}${wantGarage ? ', garage at column ' + (garageCol + 1) : ''}, ${corners.length ? 'corners' : 'no corner pieces'}, ${tops.length ? 'cornice' : 'no cornice'}; seed ${opts.seed ?? 1}`);
  return { meshes: out, report, widthMeters: width * module + (corners.length ? 2 * corners[0].size[0] : 0), heightMeters: floors * module };
}
