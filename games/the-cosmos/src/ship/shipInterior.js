// ============================================================================
// shipInterior.js — walls, floors, doors, stairs and everything in the rooms.
//
// OWNS: turning shipSpec.js into geometry. One Group per room (so a phone can
//       stop drawing rooms it cannot see), one mesh per material inside it.
// DOES NOT OWN: any dimension (all from shipSpec.js), collision
//       (shipWalker.js reads the same rectangles), or the screens' pictures.
//
// EVERY SURFACE IS A REAL FACE ON A REAL ROOM BOX. Walls are generated on the
// faces of each room's clear volume with holes cut for the doors in the spec, so
// the thing you see through a doorway and the thing you can walk through are the
// same rectangle.
//
// THE GAP BETWEEN ROOMS (0.2 m of "wall thickness") is empty space: each room's
// walls are one-sided quads facing in. A door frame fills the gap at each
// opening. The sliding leaf lives inside the gap, so when it opens it disappears
// behind the wall rather than through it.
// ============================================================================

import * as THREE from 'three';
import { Kit, resolveDepthLayers } from './shipKit.js';
import { drawProp, SEAT_DRAW } from './shipProps.js';
import { mulberry, enableDepthLift } from './shipTextures.js';
import { DECK, STAIRS, stairFloor, propBox } from './shipSpec.js';

const WALL_U = 1.35, WALL_V = 2.7;

const WALL_STYLE = {
  corridor: 'corridor', crew: 'crew', medbay: 'med', galley: 'galley', cabin: 'cabin', workshop: 'workshop',
  engineering: 'engineering', cargo: 'cargo', bridge: 'bridge', airlock: 'airlock', evalocker: 'airlock',
  ventral: 'airlock', niche: 'corridor', nest: 'bridge', head: 'med',
};
const FLOOR_STYLE = {
  corridor: 'deck', crew: 'carpet', medbay: 'med', galley: 'deck', cabin: 'carpet', workshop: 'deck',
  engineering: 'grate', cargo: 'grate', bridge: 'bridge', airlock: 'deck', evalocker: 'deck', ventral: 'grate',
  niche: 'deck', nest: 'bridge', head: 'med',
};
const ACCENT = { main: 'glowAmber', lower: 'glowAmber', bridge: 'glowBlue' };

/** Subtract axis-aligned holes from a rectangle. Returns a list of rectangles. */
export function rectsMinus(rect, holes) {
  let list = [rect];
  for (const h of holes) {
    const next = [];
    for (const r of list) {
      if (h.x1 <= r.x0 || h.x0 >= r.x1 || h.z1 <= r.z0 || h.z0 >= r.z1) { next.push(r); continue; }
      if (h.z0 > r.z0) next.push({ x0: r.x0, x1: r.x1, z0: r.z0, z1: h.z0 });
      if (h.z1 < r.z1) next.push({ x0: r.x0, x1: r.x1, z0: h.z1, z1: r.z1 });
      const a = Math.max(r.z0, h.z0), b = Math.min(r.z1, h.z1);
      if (h.x0 > r.x0) next.push({ x0: r.x0, x1: h.x0, z0: a, z1: b });
      if (h.x1 < r.x1) next.push({ x0: h.x1, x1: r.x1, z0: a, z1: b });
    }
    list = next;
  }
  return list;
}

function floorQuad(k, key, x0, x1, z0, z1, y) {
  k.poly(key, [[x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0]]);
}
function ceilQuad(k, key, x0, x1, z0, z1, y) {
  k.poly(key, [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]]);
}

/** Openings on one side of a room. */
function openingsFor(layout, r, axis, plane) {
  const out = [];
  for (const d of layout.doors) {
    if (d.axis !== axis) continue;
    if (Math.abs(d.at - plane) > 0.35) continue;
    if (d.a !== r.id && d.b !== r.id) continue;
    out.push({ u0: d.c - d.w / 2, u1: d.c + d.w / 2, y0: d.y, y1: d.y + d.h, door: d });
  }
  // windows on this wall
  for (const w of layout.windows || []) {
    if (w.room !== r.id) continue;
    const onPlane = axis === 'x' && ((w.wall === 'x0' && plane === r.x0) || (w.wall === 'x1' && plane === r.x1));
    if (!onPlane) continue;
    out.push({ u0: w.c - w.w / 2, u1: w.c + w.w / 2, y0: r.y + (w.y0 - 3.0) + 0.0, y1: r.y + (w.y1 - 3.0), window: w });
  }
  out.sort((a, b) => a.u0 - b.u0);
  return out;
}

/** One wall piece spanning [u0,u1] along the wall and [y0,y1] up. */
function wallPiece(k, key, r, side, u0, u1, y0, y1) {
  if (u1 - u0 < 1e-4 || y1 - y0 < 1e-4) return;
  const v0 = (y0 - r.y) / WALL_V, v1 = (y1 - r.y) / WALL_V;
  const P = side.plane;
  let a, b;                                   // wound so the normal faces into the room
  if (side.axis === 'x') {
    if (side.normal > 0) { a = [P, u1]; b = [P, u0]; } else { a = [P, u0]; b = [P, u1]; }
    const pts = [[a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]]];
    k.poly(key, pts, [[a[1] / WALL_U, v0], [b[1] / WALL_U, v0], [b[1] / WALL_U, v1], [a[1] / WALL_U, v1]]);
  } else {
    if (side.normal > 0) { a = [u0, P]; b = [u1, P]; } else { a = [u1, P]; b = [u0, P]; }
    const pts = [[a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]]];
    k.poly(key, pts, [[a[0] / WALL_U, v0], [b[0] / WALL_U, v0], [b[0] / WALL_U, v1], [a[0] / WALL_U, v1]]);
  }
}

/** Height of the turret nest's solid wall: the rest, up to the roof, is glass. */
export const NEST_SILL = 0.65;

function buildWalls(k, layout, r, wallKey) {
  // The bridge has windows: its forward and side walls stop at the sill.
  const sillTop = r.id === 'bridge' ? r.y + 1.05 : (r.id === 'nest' ? r.y + NEST_SILL : null);
  const sides = [
    { axis: 'x', plane: r.x0, normal: +1, lo: r.z0, hi: r.z1 },
    { axis: 'x', plane: r.x1, normal: -1, lo: r.z0, hi: r.z1 },
    { axis: 'z', plane: r.z0, normal: +1, lo: r.x0, hi: r.x1 },
    { axis: 'z', plane: r.z1, normal: -1, lo: r.x0, hi: r.x1 },
  ];
  for (const side of sides) {
    const yTop = (sillTop && !(r.id === 'bridge' && side.axis === 'z' && side.plane === r.z1)) ? sillTop : r.y + r.h;
    const ops = openingsFor(layout, r, side.axis, side.plane);
    let cursor = side.lo;
    for (const o of ops) {
      wallPiece(k, wallKey, r, side, cursor, o.u0, r.y, yTop);
      if (o.y1 < yTop) wallPiece(k, wallKey, r, side, o.u0, o.u1, o.y1, yTop);           // above the door
      if (o.y0 > r.y + 1e-3) wallPiece(k, wallKey, r, side, o.u0, o.u1, r.y, o.y0);
      cursor = o.u1;
    }
    wallPiece(k, wallKey, r, side, cursor, side.hi, r.y, yTop);
  }
}

/** Frame and glass for the windows of one room. */
function buildWindows(k, layout, r) {
  for (const w of layout.windows || []) {
    if (w.room !== r.id) continue;
    const plane = w.wall === 'x0' ? r.x0 : r.x1;
    const n = w.wall === 'x0' ? 1 : -1;                       // the wall faces into the room
    const y0 = r.y + (w.y0 - 3.0), y1 = r.y + (w.y1 - 3.0);
    const cy = (y0 + y1) / 2, h = y1 - y0, t = 0.08;
    const x = plane + n * 0.07;
    k.bevelBox('steelDark', x, y1 + t / 2, w.c, 0.16, t, w.w + t * 2, 0.02);
    k.bevelBox('steelDark', x, y0 - t / 2, w.c, 0.16, t, w.w + t * 2, 0.02);
    for (const s of [-1, 1]) k.bevelBox('steelDark', x, cy, w.c + s * (w.w / 2 + t / 2), 0.16, h, t, 0.02);
    k.bevelBox('steel', x, cy, w.c, 0.05, 0.03, w.w, 0.008);                // a mullion across the middle
    // the pane, in the plane of the wall
    const px = plane + n * 0.02;
    k._faceQuadUV('glassTint', [[px, y0, w.c - w.w / 2], [px, y0, w.c + w.w / 2], [px, y1, w.c + w.w / 2], [px, y1, w.c - w.w / 2]], [n, 0, 0], null);
  }
}

function buildDoorFrames(k, layout, r) {
  for (const d of layout.doors) {
    if (d.a !== r.id) continue;                             // each door framed once
    if (d.kind === 'outer' || d.kind === 'portal') continue;
    const depth = 0.36, t = 0.07;
    const cy = d.y + d.h / 2;
    const accent = d.kind === 'open' ? 'steelDark' : 'steelDark';
    if (d.axis === 'x') {
      for (const s of [-1, 1]) k.bevelBox(accent, d.at, d.y + d.h / 2 + 0.035, d.c + s * (d.w / 2 + t / 2), depth, d.h + 0.07, t, 0.012);
      k.bevelBox(accent, d.at, d.y + d.h + t / 2, d.c, depth, t, d.w + t * 2, 0.012);
      // a status strip in the header, on both faces
      for (const s of [-1, 1]) k.box(d.kind === 'open' ? 'glowCyan' : 'glowCyan', d.at + s * (depth / 2 + 0.002), d.y + d.h + t / 2, d.c, 0.004, 0.02, d.w * 0.6);
    } else {
      for (const s of [-1, 1]) k.bevelBox(accent, d.c + s * (d.w / 2 + t / 2), d.y + d.h / 2 + 0.035, d.at, t, d.h + 0.07, depth, 0.012);
      k.bevelBox(accent, d.c, d.y + d.h + t / 2, d.at, d.w + t * 2, t, depth, 0.012);
      for (const s of [-1, 1]) k.box('glowCyan', d.c, d.y + d.h + t / 2, d.at + s * (depth / 2 + 0.002), d.w * 0.6, 0.02, 0.004);
    }
  }
}

/** A run of handrail between posts. */
function handrail(k, ax, ay, az, bx, by, bz) {
  k.pipe('steel', [ax, ay, az], [bx, by, bz], 0.02, 8);
  const n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / 1.2));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = ax + (bx - ax) * t, y = ay + (by - ay) * t, z = az + (bz - az) * t;
    k.box('steelDark', x, y - 0.04, z, 0.03, 0.08, 0.03);
  }
}

// ---------------------------------------------------------------------------

export function buildInterior(layout, mats, opts = {}) {
  const low = opts.tier === 'low';
  const root = new THREE.Group(); root.name = 'ship-interior';
  const out = {
    root, rooms: new Map(), roomList: [], doors: [], screens: [], seatGroups: new Map(),
    animated: {}, lights: [], holo: null, reactorCore: null, triangles: 0,
    signAtlas: opts.signMaterial || null, low,
  };
  const rooms = layout.rooms;
  const doorsByRoom = new Map();
  // Every kit is mounted on an empty group now and filled at the end, after resolveDepthLayers has
  // looked at ALL of them together (a stair tread and the wall beside it live in different kits).
  const pending = [];
  const mount = (k, mm, o) => { const g = new THREE.Group(); g.name = o.name; pending.push({ g, k, mm, o }); return g; };
  if (opts.signs) enableDepthLift(opts.signs.material);
  if (opts.posters) enableDepthLift(opts.posters.material);

  // --- One kit per room. ------------------------------------------------------
  for (const r of rooms) {
    const k = new Kit();
    k.tiles = {
      'floor:deck': 2, 'floor:grate': 2, 'floor:carpet': 2, 'floor:med': 2, 'floor:bridge': 2, ceil: 1.5,
      steel: 1, steelDark: 1, gunmetal: 1, steelDark2: 1,
    };
    const wallKey = 'wall:' + (WALL_STYLE[r.style] || 'corridor');
    const floorKey = 'floor:' + (FLOOR_STYLE[r.kind] || 'deck');
    const rnd = mulberry(r.id.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7));

    buildWalls(k, layout, r, wallKey);

    // floor and ceiling, with holes
    const yF = r.y, yC = r.y + r.h;
    for (const q of rectsMinus({ x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1 }, r.floorHoles)) floorQuad(k, floorKey, q.x0, q.x1, q.z0, q.z1, yF);
    for (const q of rectsMinus({ x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1 }, r.ceilHoles)) ceilQuad(k, 'ceil', q.x0, q.x1, q.z0, q.z1, yC);

    // hatch coaming around any holes
    for (const h of r.floorHoles) {
      if (r.id === 'corridor_main') continue;                  // the stair fills that one
      const t = 0.06;
      k.bevelBox('steelDark', (h.x0 + h.x1) / 2, yF + 0.03, h.z0 - t / 2, h.x1 - h.x0 + t * 2, 0.06, t, 0.01);
      k.bevelBox('steelDark', (h.x0 + h.x1) / 2, yF + 0.03, h.z1 + t / 2, h.x1 - h.x0 + t * 2, 0.06, t, 0.01);
      k.bevelBox('steelDark', h.x0 - t / 2, yF + 0.03, (h.z0 + h.z1) / 2, t, 0.06, h.z1 - h.z0, 0.01);
      k.bevelBox('steelDark', h.x1 + t / 2, yF + 0.03, (h.z0 + h.z1) / 2, t, 0.06, h.z1 - h.z0, 0.01);
      k.box('hazard', (h.x0 + h.x1) / 2, yF + 0.062, h.z0 - t / 2, h.x1 - h.x0 + t * 2, 0.004, 0.02);
    }

    buildDoorFrames(k, layout, r);
    buildWindows(k, layout, r);

    // lamps in this room
    for (const L of layout.lights.filter((l) => l.room === r.id)) {
      const key = L.color === 0xdfeaff || L.color === 0xe8f6ff || L.color === 0xf2f6ff || L.color === 0xf4f6ff ? 'glowCool'
        : (L.color === 0xffb27a || L.color === 0xffd7a8 || L.color === 0xffdfb4) ? 'glowAmber' : 'glowWhite';
      const w = L.axis === 'z' ? L.w : L.len, d = L.axis === 'z' ? L.len : L.w;
      k.bevelBox('plasticDark', L.x, L.y + 0.03, L.z, w + 0.08, 0.06, d + 0.08, 0.012);
      k.box(key, L.x, L.y - 0.003, L.z, w, 0.008, d);
      out.lights.push({ ...L, roomId: r.id });
    }

    // room-specific dressing
    dressRoom(k, layout, r, rnd, out, low);

    // props
    for (const p of layout.props.filter((q) => q.room === r.id)) {
      drawProp(k, p);
    }

    // greebles: junction boxes, conduits, vents
    greeble(k, layout, r, rnd, low);

    const g = mount(k, mats, { name: 'room:' + r.id, cast: !low, receive: !low });
    g.userData.roomId = r.id;
    out.triangles += k.triangles;
    root.add(g);
    out.rooms.set(r.id, g);
    out.roomList.push({ id: r.id, group: g, def: r });
  }

  // --- The reactor core: a separate mesh so it can pulse. -----------------------
  if (out.coreSpec) {
    const c = out.coreSpec;
    const core = new THREE.Mesh(new THREE.CylinderGeometry(c.r, c.r, c.h, low ? 16 : 28, 1, false), mats.reactor);
    core.position.set(c.x, c.y, c.z);
    core.name = 'reactor-core';
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(c.r * 0.5, c.r * 0.5, c.h - 0.04, 16, 1, false), mats.glowWhite);
    inner.position.copy(core.position);
    out.rooms.get('engineering').add(core, inner);
    out.reactorCore = core; out.reactorInner = inner;
  }

  // --- Stairs and ladders. Each is drawn whenever ANY room it touches is drawn: the engineering stair is a big
  //     block standing in engineering, so it must not disappear just because the corridor above it is culled. ----
  out.sharedGroups = [];
  {
    const STAIR_ROOMS = { up: ['corridor_main', 'bridge'], down: ['engineering', 'corridor_main'] };
    for (const key of ['up', 'down']) {
      const k = new Kit();
      k.tiles = { 'floor:deck': 2, ceil: 1.5, steel: 1, steelDark: 1, gunmetal: 1 };
      buildStairs(k, layout, key);
      const g = mount(k, mats, { name: 'stairs:' + key, cast: !low, receive: !low });
      root.add(g);
      out.sharedGroups.push({ g, rooms: STAIR_ROOMS[key] });
    }
    const LADDER_ROOMS = { ladder_dorsal: ['niche', 'nest'], ladder_ventral: ['corridor_low', 'ventral'] };
    for (const L of layout.ladders) {
      const k = new Kit();
      drawLadder(k, L);
      const g = mount(k, mats, { name: 'ladder:' + L.id });
      root.add(g);
      out.sharedGroups.push({ g, rooms: LADDER_ROOMS[L.id] || ['corridor_main'] });
    }
  }

  // --- Doors that slide. ----------------------------------------------------------
  for (const d of layout.doors) {
    if (d.kind === 'open' || d.kind === 'hatch' || d.kind === 'portal') continue;
    const leaves = d.w > 1.6 ? 2 : 1;
    const dl = { def: d, leaves: [], open: 0, target: 0, group: new THREE.Group() };
    dl.group.name = 'door:' + d.id;
    for (let i = 0; i < leaves; i++) {
      const lw = leaves === 2 ? d.w / 2 + 0.02 : d.w + 0.06;
      const geo = new THREE.BoxGeometry(d.axis === 'x' ? 0.06 : lw, d.h - 0.02, d.axis === 'x' ? lw : 0.06);
      const mesh = new THREE.Mesh(geo, mats.door);
      mesh.castShadow = !low; mesh.receiveShadow = !low;
      mesh.userData.leafW = lw;
      dl.leaves.push(mesh);
      dl.group.add(mesh);
    }
    dl.group.position.set(d.axis === 'x' ? d.at : d.c, d.y + (d.h - 0.02) / 2 + 0.01, d.axis === 'x' ? d.c : d.at);
    out.doors.push(dl);
    // On the ship's root, not inside a room's group: a hidden room hides its children, and a door leaf is
    // seen from BOTH sides (the ship's origin is the interior's origin, so positions are the same).
    root.add(dl.group);
  }

  // --- Signs above the doors, on the wall you approach it from. ----------------------
  if (opts.signs) {
    const k = new Kit();
    k.tiles = { sign: 1 };
    for (const d of layout.doors.filter((q) => q.sign)) {
      const faceRoom = layout.roomById.get(d.signFace === 'b' ? d.b : d.a);
      if (!faceRoom) continue;
      const w = 0.72, h = 0.17, y = d.y + d.h + 0.22;
      const uv = opts.signs.uvFor(d.sign);
      if (d.axis === 'x') {
        const cR = (faceRoom.x0 + faceRoom.x1) / 2;
        const n = cR > d.at ? 1 : -1;
        const x = d.at + 0.1 * n + 0.012 * n;
        // right-hand direction for a viewer looking at the wall: up x normal = (0,0,-n)
        const rz = -n;
        const pts = [[x, y - h / 2, d.c - rz * w / 2], [x, y - h / 2, d.c + rz * w / 2], [x, y + h / 2, d.c + rz * w / 2], [x, y + h / 2, d.c - rz * w / 2]];
        k._faceQuadUV('sign', pts, [n, 0, 0], uv);
      } else {
        const cR = (faceRoom.z0 + faceRoom.z1) / 2;
        const n = cR > d.at ? 1 : -1;
        const z = d.at + 0.1 * n + 0.012 * n;
        const rx = n;                       // up x (0,0,n) = (n,0,0)
        const pts = [[d.c - rx * w / 2, y - h / 2, z], [d.c + rx * w / 2, y - h / 2, z], [d.c + rx * w / 2, y + h / 2, z], [d.c - rx * w / 2, y + h / 2, z]];
        k._faceQuadUV('sign', pts, [0, 0, n], uv);
      }
    }
    root.add(mount(k, { sign: opts.signs.material }, { name: 'signs' }));
  }

  // --- Posters and photographs. ---------------------------------------------------------
  if (opts.posters) {
    for (const r of rooms) {
      const list = (layout.posters || []).filter((q) => q.room === r.id);
      if (!list.length) continue;
      const k = new Kit();
      k.tiles = { poster: 1 };
      for (const P of list) {
        const uv = opts.posters.uvFor(P.idx);
        const y = P.y, w = P.w, h = P.h;
        let pts, nrm;
        const off = 0.012;
        if (P.wall === 'x0') { nrm = [1, 0, 0]; const x = r.x0 + off; pts = [[x, y - h / 2, P.u + w / 2], [x, y - h / 2, P.u - w / 2], [x, y + h / 2, P.u - w / 2], [x, y + h / 2, P.u + w / 2]]; }
        else if (P.wall === 'x1') { nrm = [-1, 0, 0]; const x = r.x1 - off; pts = [[x, y - h / 2, P.u - w / 2], [x, y - h / 2, P.u + w / 2], [x, y + h / 2, P.u + w / 2], [x, y + h / 2, P.u - w / 2]]; }
        else if (P.wall === 'z0') { nrm = [0, 0, 1]; const z = r.z0 + off; pts = [[P.u - w / 2, y - h / 2, z], [P.u + w / 2, y - h / 2, z], [P.u + w / 2, y + h / 2, z], [P.u - w / 2, y + h / 2, z]]; }
        else { nrm = [0, 0, -1]; const z = r.z1 - off; pts = [[P.u + w / 2, y - h / 2, z], [P.u - w / 2, y - h / 2, z], [P.u - w / 2, y + h / 2, z], [P.u + w / 2, y + h / 2, z]]; }
        k._faceQuadUV('poster', pts, nrm, uv);
        // a slim frame
        const fr = 0.02;
        k.tiles.metal = 1;
        const fx = P.wall === 'x0' ? r.x0 + 0.006 : P.wall === 'x1' ? r.x1 - 0.006 : null;
        const fz = P.wall === 'z0' ? r.z0 + 0.006 : P.wall === 'z1' ? r.z1 - 0.006 : null;
        if (fx !== null) { k.bevelBox('steelDark', fx, y, P.u, 0.012, h + fr * 2, w + fr * 2, 0.004); }
        else { k.bevelBox('steelDark', P.u, y, fz, w + fr * 2, h + fr * 2, 0.012, 0.004); }
      }
      // frames belong to 'metal', posters to 'poster'
      const g = mount(k, { poster: opts.posters.material, metal: mats.metal }, { name: 'posters:' + r.id });
      out.rooms.get(r.id).add(g);
    }
  }

  // --- Look at every flat face together and give the ones that share a plane their own depth layer. ---
  out.kits = pending.map((q) => q.k);
  out.layerStats = resolveDepthLayers(out.kits);
  for (const { g, k, mm, o } of pending) {
    const built = k.toGroup(mm, o);
    while (built.children.length) g.add(built.children[0]);
  }

  return out;
}

// ---------------------------------------------------------------------------
// Room-specific dressing: things that are not furniture.
// ---------------------------------------------------------------------------
function dressRoom(k, layout, r, rnd, out, low) {
  const yF = r.y, yC = r.y + r.h;
  const accent = ACCENT[r.deck] || 'glowAmber';

  // Floor edge light strips in the main corridor and lower corridor
  if (r.kind === 'corridor') {
    for (const sx of [-1, 1]) {
      const x = sx * 0.76;
      // handrails, broken at doors
      const ops = openingsFor(layout, r, 'x', sx * 0.8);
      const gaps = ops.map((o) => [o.u0 - 0.1, o.u1 + 0.1]);
      let z = r.z0 + 0.2;
      const zEnd = r.id === 'corridor_main' ? 4.0 : r.z1 - 0.2;
      const segs = [];
      for (const gp of gaps) { if (gp[0] > z) segs.push([z, Math.min(gp[0], zEnd)]); z = Math.max(z, gp[1]); }
      if (z < zEnd) segs.push([z, zEnd]);
      for (const s of segs) if (s[1] - s[0] > 0.35) handrail(k, x, yF + 0.95, s[0], x, yF + 0.95, s[1]);
      // ceiling conduits
      k.pipe(sx < 0 ? 'pipeBlue' : 'pipeRed', [sx * 0.6, yC - 0.14, r.z0 + 0.1], [sx * 0.6, yC - 0.14, r.z1 - 0.1], 0.04, 8);
      for (let zz = r.z0 + 0.7; zz < r.z1 - 0.3; zz += 1.6) k.box('steelDark', sx * 0.6, yC - 0.07, zz, 0.05, 0.1, 0.06);
    }
    k.box('steelDark', 0, yC - 0.05, (r.z0 + r.z1) / 2, 0.22, 0.05, r.z1 - r.z0 - 0.3);       // cable tray
    // floor guide strip
    for (const sx of [-1, 1]) k.box(accent, sx * 0.62, yF + 0.006, (r.z0 + r.z1) / 2, 0.012, 0.004, r.z1 - r.z0 - 0.4);
  }

  if (r.id === 'engineering') {
    // overhead pipe racks, running fore-aft
    for (const [x, key] of [[-4.2, 'pipeBlue'], [-3.85, 'pipeRed'], [4.0, 'pipeYellow'], [4.35, 'pipeSteel']]) {
      k.pipe(key, [x, yC - 0.2, r.z0 + 0.2], [x, yC - 0.2, r.z1 - 0.2], 0.07, 10);
      for (let z = r.z0 + 0.8; z < r.z1 - 0.5; z += 1.8) k.box('steelDark', x, yC - 0.1, z, 0.12, 0.12, 0.1);
    }
    // a cable ladder over the reactor and a gantry rail
    k.pipe('steelDark', [-1.9, yC - 0.06, -2.4], [-1.9, yC - 0.06, 1.0], 0.04);
    k.pipe('steelDark', [1.9, yC - 0.06, -2.4], [1.9, yC - 0.06, 1.0], 0.04);
    // reactor ring on the floor: hazard circle
    k.lathe('hazard', 0, yF + 0.005, -0.8, [[2.15, 0], [2.3, 0]], 28);
    // yellow walkway lines
    for (const x of [-2.8, 2.8]) k.box('hazard', x, yF + 0.012, 1.4, 0.06, 0.003, 12.6);
    // The reactor core itself is a separate mesh so it can pulse
    out.coreSpec = { x: 0, y: yF + 1.4, z: -0.8, r: 0.62, h: 2.24 };   // ends 3 cm inside the caps, not flush with them
  }

  if (r.id === 'cargo') {
    // overhead gantry rails and hoist
    for (const x of [-4.0, 4.0]) k.bevelBox('steelDark', x, yC - 0.3, (r.z0 + r.z1) / 2, 0.24, 0.3, r.z1 - r.z0 - 0.3, 0.02);
    k.bevelBox('steelDark', 0, yC - 0.3, 14.0, 8.2, 0.3, 0.3, 0.02);
    k.bevelBox('hazard', 0, yC - 0.62, 14.0, 0.7, 0.32, 0.6, 0.03);
    k.pipe('steel', [0, yC - 0.78, 14.0], [0, yC - 2.2, 14.0], 0.02);
    k.bevelBox('red', 0, yC - 2.3, 14.0, 0.28, 0.14, 0.14, 0.02);
    // ribs along the walls
    for (let z = r.z0 + 0.6; z < r.z1 - 0.3; z += 1.7) {
      for (const sx of [-1, 1]) k.bevelBox('steelDark', sx * (r.x1 - 0.08), (yF + yC) / 2, z, 0.14, r.h, 0.16, 0.02);
    }
    // floor lane markings and tie-down rings
    for (const x of [-2.2, 2.2]) k.box('hazard', x, yF + 0.012, 15.2, 0.1, 0.003, 10.5);
    for (let z = 10.6; z < 20.3; z += 1.6) for (const sx of [-1, 1]) {
      k.cyl('steel', sx * 2.9, yF + 0.02, z, 0.06, 0.02, 10);
    }
    // the aft door: a frame for the ramp opening, stern wall pieces are the walls; add frame
    const w = 3.8, h = 5.2;
    k.bevelBox('steelDark', -w / 2 - 0.1, h / 2, r.z1 - 0.06, 0.2, h + 0.2, 0.3, 0.02);
    k.bevelBox('steelDark', w / 2 + 0.1, h / 2, r.z1 - 0.06, 0.2, h + 0.2, 0.3, 0.02);
    k.bevelBox('steelDark', 0, h + 0.1, r.z1 - 0.06, w + 0.4, 0.2, 0.3, 0.02);
    for (let i = 0; i < 9; i++) k.box(i % 2 ? 'hazard' : 'gunmetal', -w / 2 + 0.2 + i * 0.4, h + 0.1, r.z1 - 0.215, 0.2, 0.16, 0.01);
  }

  if (r.id === 'bridge') dressBridge(k, r, out);

  if (r.id === 'nest') {
    // the hatch shaft through the roof space, between the turret ladder niche and this floor
    const hh = r.floorHoles[0];
    const yLo = 5.7, yHi = r.y;
    const wq = (pts, n) => k._faceQuadUV('wall:corridor', pts, n, null);
    wq([[hh.x0, yLo, hh.z0], [hh.x1, yLo, hh.z0], [hh.x1, yHi, hh.z0], [hh.x0, yHi, hh.z0]], [0, 0, 1]);
    wq([[hh.x0, yLo, hh.z1], [hh.x1, yLo, hh.z1], [hh.x1, yHi, hh.z1], [hh.x0, yHi, hh.z1]], [0, 0, -1]);
    wq([[hh.x0, yLo, hh.z0], [hh.x0, yLo, hh.z1], [hh.x0, yHi, hh.z1], [hh.x0, yHi, hh.z0]], [1, 0, 0]);
    wq([[hh.x1, yLo, hh.z0], [hh.x1, yLo, hh.z1], [hh.x1, yHi, hh.z1], [hh.x1, yHi, hh.z0]], [-1, 0, 0]);
    // glass band and sill; the roof is the ceiling
    const y0 = yF + NEST_SILL;
    k.bevelBox('steelDark', (r.x0 + r.x1) / 2, y0 - 0.02, r.z0 + 0.03, r.x1 - r.x0, 0.05, 0.08, 0.01);
    k.bevelBox('steelDark', (r.x0 + r.x1) / 2, y0 - 0.02, r.z1 - 0.03, r.x1 - r.x0, 0.05, 0.08, 0.01);
    k.bevelBox('steelDark', r.x1 - 0.03, y0 - 0.02, (r.z0 + r.z1) / 2, 0.08, 0.05, r.z1 - r.z0, 0.01);
  }

  if (r.id === 'airlock') {
    // hazard frame on the outer wall, warning lamps
    k.box('hazard', r.x0 + 0.012, yF + 2.3, -10.8, 0.006, 0.12, 1.5);
    k.box('glowAmber', r.x0 + 0.012, yF + 2.55, -10.8, 0.006, 0.08, 0.3);
  }

  if (r.id === 'ventral') {
    // the pit: walls, glass floor, seat placed by the seat pass
    const pit = layout.extraZones.find((z) => z.id === 'pit');
    const y1 = 0, y0 = pit.floor;
    // No walls: the pit is an open glass pod. (Solid walls left the gunner staring at panelling, with the ground
    // visible only straight down.) Four corner posts and a rim at floor level carry it.
    for (const x of [pit.x0, pit.x1]) for (const z of [pit.z0, pit.z1]) k.bevelBox('steelDark', x, (y0 + y1) / 2, z, 0.07, y1 - y0, 0.07, 0.015);
    for (const x of [pit.x0, pit.x1]) k.bevelBox('steelDark', x, y1 - 0.03, (pit.z0 + pit.z1) / 2, 0.07, 0.06, pit.z1 - pit.z0 + 0.07, 0.012);
    for (const z of [pit.z0, pit.z1]) k.bevelBox('steelDark', 0, y1 - 0.03, z, pit.x1 - pit.x0 + 0.07, 0.06, 0.07, 0.012);
    // the floor is see-through: a glass plate in a steel frame
    k.poly('glassTint', [[pit.x0, y0 + 0.01, pit.z1], [pit.x1, y0 + 0.01, pit.z1], [pit.x1, y0 + 0.01, pit.z0], [pit.x0, y0 + 0.01, pit.z0]]);
    for (const x of [-0.35, 0, 0.35]) k.box('steelDark', x, y0 + 0.02, (pit.z0 + pit.z1) / 2, 0.05, 0.03, pit.z1 - pit.z0);
    for (const z of [pit.z0 + 0.4, pit.z1 - 0.4]) k.box('steelDark', 0, y0 + 0.02, z, pit.x1 - pit.x0, 0.03, 0.05);
    k.box('glowAmber', pit.x0 + 0.02, y0 + 0.2, (pit.z0 + pit.z1) / 2, 0.01, 0.03, 1.2);
  }
}

function dressBridge(k, r, out) {
  const yF = r.y, yC = r.y + r.h;
  // The forward canopy: a raked windscreen, side windows, and the frames between.
  const zf = r.z0 + 0.0, ybase = yF + 1.05, ytop = yC;
  // front sill / console top rail is the consoles; frame: mullions at intervals
  const raked = 0.6;
  // no pillar dead centre: the captain's reticle and the pilot's horizon are straight ahead
  const mull = [-4.0, -2.6, -1.3, 1.3, 2.6, 4.0];
  for (const x of mull) {
    k.pipe('gunmetal', [x, ybase, zf + 0.0], [x, ytop, zf + raked], 0.034, 8);
  }
  k.pipe('gunmetal', [-4.0, ytop, zf + raked], [4.0, ytop, zf + raked], 0.05, 8);
  k.pipe('gunmetal', [-4.0, ybase, zf], [4.0, ybase, zf], 0.05, 8);
  // side window mullions
  for (const s of [-1, 1]) {
    const x = s * 4.0;
    for (const z of [r.z0, r.z0 + 1.2, r.z0 + 2.4, r.z0 + 3.6, r.z0 + 4.8, r.z1 - 0.4]) {
      k.pipe('gunmetal', [x, ybase, z], [x, ytop, z], 0.04, 8);
    }
    k.pipe('gunmetal', [x, ybase, r.z0], [x, ybase, r.z1 - 0.4], 0.05, 8);
    k.pipe('gunmetal', [x, ytop, r.z0], [x, ytop, r.z1 - 0.4], 0.05, 8);
  }
  // overhead light bars along the canopy edge
  k.box('glowBlue', 0, ytop - 0.06, r.z0 + raked + 0.2, 7.2, 0.012, 0.03);
}

function greeble(k, layout, r, rnd, low) {
  if (r.kind === 'nest' || r.kind === 'niche') return;
  const n = low ? 6 : 12;
  const yF = r.y;
  // walls list
  const sides = [
    { axis: 'x', plane: r.x0, normal: +1, lo: r.z0, hi: r.z1 },
    { axis: 'x', plane: r.x1, normal: -1, lo: r.z0, hi: r.z1 },
    { axis: 'z', plane: r.z0, normal: +1, lo: r.x0, hi: r.x1 },
    { axis: 'z', plane: r.z1, normal: -1, lo: r.x0, hi: r.x1 },
  ];
  const boxes = layout.props.filter((p) => p.room === r.id).map(propBox);
  for (let i = 0; i < n; i++) {
    const side = sides[Math.floor(rnd() * 4)];
    const ops = openingsFor(layout, r, side.axis, side.plane);
    const span = side.hi - side.lo;
    if (span < 1.0) continue;
    const u = side.lo + 0.4 + rnd() * (span - 0.8);
    if (ops.some((o) => u > o.u0 - 0.5 && u < o.u1 + 0.5)) continue;
    const y = yF + 1.2 + rnd() * (r.h > 3 ? 3.0 : 1.2);
    const w = 0.12 + rnd() * 0.3, h = 0.1 + rnd() * 0.24, dep = 0.04 + rnd() * 0.07;
    // avoid furniture in front
    const px = side.axis === 'x' ? side.plane + side.normal * 0.2 : u;
    const pz = side.axis === 'x' ? u : side.plane + side.normal * 0.2;
    if (boxes.some((b) => px > b.x0 - 0.15 && px < b.x1 + 0.15 && pz > b.z0 - 0.15 && pz < b.z1 + 0.15 && y < b.y1 + 0.3)) continue;
    const off = dep / 2 + 0.002;
    const cx = side.axis === 'x' ? side.plane + side.normal * off : u;
    const cz = side.axis === 'x' ? u : side.plane + side.normal * off;
    const sw = side.axis === 'x' ? dep : w, sd = side.axis === 'x' ? w : dep;
    const kind = Math.floor(rnd() * 3);
    if (kind === 0) {
      k.bevelBox('steelDark', cx, y, cz, sw, h, sd, 0.01);
      const lx = side.axis === 'x' ? side.plane + side.normal * (dep + 0.003) : u + (rnd() - 0.5) * w * 0.4;
      const lz = side.axis === 'x' ? u + (rnd() - 0.5) * w * 0.4 : side.plane + side.normal * (dep + 0.003);
      k.box(rnd() < 0.5 ? 'glowGreen' : 'glowAmber', lx, y + h * 0.25, lz, 0.016, 0.016, 0.016);
    } else if (kind === 1) {
      // a vent grille
      k.bevelBox('gunmetal', cx, y, cz, sw, h * 0.8, sd, 0.008);
      for (let j = 0; j < 4; j++) {
        const yy = y - h * 0.3 + j * h * 0.2;
        const gx = side.axis === 'x' ? side.plane + side.normal * (dep + 0.002) : u;
        const gz = side.axis === 'x' ? u : side.plane + side.normal * (dep + 0.002);
        k.box('steelDark', gx, yy, gz, side.axis === 'x' ? 0.006 : w * 0.85, 0.012, side.axis === 'x' ? w * 0.85 : 0.006);
      }
    } else {
      // a conduit run with a clamp
      const len = 0.5 + rnd() * 1.2;
      if (side.axis === 'x') k.pipe('pipeSteel', [side.plane + side.normal * 0.04, y, u - len / 2], [side.plane + side.normal * 0.04, y, u + len / 2], 0.022, 6);
      else k.pipe('pipeSteel', [u - len / 2, y, side.plane + side.normal * 0.04], [u + len / 2, y, side.plane + side.normal * 0.04], 0.022, 6);
      k.bevelBox('steelDark', cx, y, cz, sw * 0.6, 0.06, sd * 0.6, 0.008);
    }
  }
}

// ---------------------------------------------------------------------------
// Stairs: closed-riser treads sitting on the same ramp the walker follows.
// ---------------------------------------------------------------------------
function buildStairs(k, layout, only) {
  const rise = 3.0 / 16;
  for (const key of only ? [only] : ['up', 'down']) {
    const st = STAIRS[key];
    const n = st.rise;
    const run = Math.abs(st.zHigh - st.zLow) / n;
    const dir = Math.sign(st.zHigh - st.zLow);              // +1 if ascending toward +z
    // Each step is a riser and a tread and nothing else: the sides are walled below, the back is the next
    // step's riser, the underside is never seen. (Every face that used to be written twice on the same plane
    // was one of the "white blocks" on the stairs.)
    const backFace = dir > 0 ? '+z' : '-z';
    for (let i = 0; i < n; i++) {
      // step i counted from the LOW end
      const zA = st.zLow + dir * i * run, zB = st.zLow + dir * (i + 1) * run;
      const z0 = Math.min(zA, zB), z1 = Math.max(zA, zB);
      const top = st.yLow + (i + 0.5) * rise;
      const bottom = key === 'down' ? 0.0 : top - 0.45;
      k.boxMM('steelDark', st.x0, bottom, z0, st.x1, top, z1, { skip: '+x-x+y-y' + backFace });
      // the tread plate is the top face; a hazard nosing strip takes the leading 5 cm of it (no overlap)
      const nz0 = dir > 0 ? z1 - 0.05 : z0, nz1 = dir > 0 ? z1 : z0 + 0.05;
      const pz0 = dir > 0 ? z0 : nz1, pz1 = dir > 0 ? nz0 : z1;
      const tread = (key2, za, zb) => k.poly(key2, [[st.x0, top, zb], [st.x1, top, zb], [st.x1, top, za], [st.x0, top, za]]);
      tread('floor:deck', pz0, pz1);
      tread('hazard', nz0, nz1);
    }
    // handrails on both sides, following the slope
    for (const sx of [-1, 1]) {
      const x = sx * 0.72;
      const yl = st.yLow + 0.95, yh = st.yHigh + 0.95;
      handrail(k, x, yl, st.zLow, x, yh, st.zHigh);
      // returns to the newel at each end
      for (const [z, y] of [[st.zLow, yl], [st.zHigh, yh]]) k.pipe('steel', [x, y, z], [x, y - 0.95, z], 0.02, 6);
    }
    // slanted walls for the up stair (shaft)
    if (key === 'up') {
      for (const sx of [-1, 1]) {
        const x = sx * 0.8;
        const pts = [
          [x, st.yLow, st.zLow], [x, st.yHigh, st.zHigh],
          [x, st.yHigh + DECK.clear, st.zHigh], [x, st.yLow + DECK.clear, st.zLow],
        ];
        const uv = [[st.zLow / 1.35, 0], [st.zHigh / 1.35, 0], [st.zHigh / 1.35, 1], [st.zLow / 1.35, 1]];
        k._faceQuadUV('wall:corridor', pts, [-sx, 0, 0], uv);
      }
      // sloped ceiling
      k._faceQuadUV('ceil', [
        [st.x0, st.yLow + DECK.clear, st.zLow], [st.x1, st.yLow + DECK.clear, st.zLow],
        [st.x1, st.yHigh + DECK.clear, st.zHigh], [st.x0, st.yHigh + DECK.clear, st.zHigh],
      ], [0, -1, 0], null);
    }
    if (key === 'down') {
      // the hole in the main floor is walled by the stair itself; the side walls
      // below the slab are the corridor walls carried down
      for (const sx of [-1, 1]) {
        const x = sx * 0.8;
        // outward face, seen from engineering
        const pts = [[x, 0, st.zHigh], [x, 0, st.zLow], [x, DECK.main, st.zLow], [x, DECK.main, st.zHigh]];
        k._faceQuadUV('wall:engineering', [[x, 0, st.zHigh], [x, 0, st.zLow], [x, 2.7, st.zLow], [x, 2.7, st.zHigh]], [sx, 0, 0],
          [[st.zHigh / 1.35, 0], [st.zLow / 1.35, 0], [st.zLow / 1.35, 1], [st.zHigh / 1.35, 1]]);
      }
      // the same walls seen from INSIDE the stairwell (they were one-way: standing on the stair you could
      // look straight out into engineering)
      for (const sx of [-1, 1]) {
        const x = sx * 0.8;
        k._faceQuadUV('wall:corridor', [[x, 0, st.zHigh], [x, 0, st.zLow], [x, DECK.main, st.zLow], [x, DECK.main, st.zHigh]], [-sx, 0, 0],
          [[st.zHigh / 1.35, 0], [st.zLow / 1.35, 0], [st.zLow / 1.35, 3 / 1.35], [st.zHigh / 1.35, 3 / 1.35]]);
      }
      // the slab's cut edge at the low end of the hole, so you do not see into the floor
      k._faceQuadUV('wall:corridor', [[-0.8, 2.7, st.zLow], [0.8, 2.7, st.zLow], [0.8, DECK.main, st.zLow], [-0.8, DECK.main, st.zLow]], [0, 0, -1], null);
      // the front face of the closed stair, in engineering
      k._faceQuadUV('wall:engineering', [[-0.8, 0, 4.5], [0.8, 0, 4.5], [0.8, 2.7, 4.5], [-0.8, 2.7, 4.5]], [0, 0, -1],
        [[0, 0], [1.6 / 1.35, 0], [1.6 / 1.35, 1], [0, 1]]);
      // a light and a warning stripe on the front face
      k.box('hazard', 0, 0.9, 4.49, 1.5, 0.12, 0.006);
      k.box('glowAmber', 0, 2.3, 4.485, 0.8, 0.04, 0.006);
    }
  }
}

function drawLadder(k, L) {
  const fx = L.face.x, fz = L.face.z;
  const wallOff = 0.30;                      // rungs stand this far in front of the climber
  const rx = L.x + fx * wallOff, rz = L.z + fz * wallOff;
  const px = fz !== 0 ? 1 : 0, pz = fx !== 0 ? 1 : 0;       // across the ladder
  const top = L.y1 + 0.55, bot = L.y0 + 0.02;
  for (const s of [-1, 1]) {
    k.pipe('steel', [rx + px * s * 0.22, bot, rz + pz * s * 0.22], [rx + px * s * 0.22, top, rz + pz * s * 0.22], 0.022, 8);
  }
  const n = Math.max(3, Math.round((top - bot) / 0.28));
  for (let i = 0; i < n; i++) {
    const y = bot + 0.14 + i * ((top - bot - 0.2) / Math.max(1, n - 1));
    k.pipe('steelDark', [rx - px * 0.22, y, rz - pz * 0.22], [rx + px * 0.22, y, rz + pz * 0.22], 0.014, 6);
  }
  // wall standoffs
  for (const y of [bot + 0.3, (bot + top) / 2, top - 0.3]) for (const s of [-1, 1]) {
    k.box('steelDark', rx + px * s * 0.22 + fx * 0.03, y, rz + pz * s * 0.22 + fz * 0.03, 0.04, 0.04, 0.04);
  }
}

/** Build the seats. Each is its own Group so it can be measured and hidden. */
export function buildSeats(layout, mats, interior) {
  const low = !!interior.low;
  for (const s of layout.seats) {
    const k = new Kit();
    const variant = { captain: 'captain', pilot: 'pilot', nav: 'swivel', comms: 'swivel', engineer: 'swivel', gun_dorsal: 'gunner', gun_ventral: 'gunner' }[s.id];
    SEAT_DRAW[variant](k);
    const g = k.toGroup(mats, { name: 'seat:' + s.id, cast: !low, receive: !low });
    g.position.set(s.x, s.y, s.z);
    g.rotation.y = -s.yaw * Math.PI / 180;
    g.userData.seatId = s.id;
    const roomGroup = interior.rooms.get(s.room);
    roomGroup.add(g);
    interior.seatGroups.set(s.id, g);
    interior.triangles += k.triangles;
  }
  // The captain's dais: a low step with light strips.
  {
    const k = new Kit();
    k.bevelBox('gunmetal', 0, 6.1, -14.95, 2.8, 0.2, 1.9, 0.03);
    k.box('glowBlue', 0, 6.205, -13.98, 2.7, 0.006, 0.03);
    k.box('glowBlue', -1.39, 6.205, -14.95, 0.03, 0.006, 1.8);
    k.box('glowBlue', 1.39, 6.205, -14.95, 0.03, 0.006, 1.8);
    interior.rooms.get('bridge').add(k.toGroup(mats, { name: 'dais' }));
  }
}

