/* ============================================================================
   plan.js — the floorplan solver
   ---------------------------------------------------------------------------
   This is the part that answers "how does an AI build a house without it
   coming out broken". Not by copying blueprints — by solving a layout against
   a code book of real construction dimensions, then VALIDATING it and
   reporting what failed instead of shipping it silently.

   Layout model: BAND GRID.
     A footprint is sliced into bands along Z (front → back), optionally with a
     circulation band (hall/foyer) between them; each band is sliced into rooms
     along X. Every room is therefore a clean rectangle, every partition line
     is shared exactly once, and the wall set is derived rather than guessed.
   Connectivity: adjacency graph → BFS spanning tree from the entry room →
     one door per tree edge. Any room the BFS can't reach is a hard error.
   ========================================================================== */
(function () {
"use strict";
const T = window.TOWN;

/* -------------------------------------------------------- THE CODE BOOK --
   Metric values, cross-checked against the imperial dimensions they came
   from. These are the numbers that stop a generator producing nonsense.     */
const CODE = (T.CODE = {
  grid:        4.000,   // world grid cell (m)
  ceil:        2.440,   // 8'-0"   finished ceiling, habitable
  ceilMin:     2.286,   // 7'-6"   IRC minimum habitable ceiling
  ceilCom:     3.050,   // 10'-0"  commercial
  floorAssy:   0.305,   // 12"     joist + subfloor + finish between storeys
  wallExt:     0.165,   // 2x6 stud + sheathing + cladding
  wallInt:     0.114,   // 2x4 stud + 12.7mm board each face
  doorExtW:    0.914,   // 36"     entry door
  doorIntW:    0.762,   // 30"     interior passage door
  doorH:       2.032,   // 6'-8"
  doorThk:     0.045,
  hallMin:     1.067,   // 42"     comfortable; IRC allows 36"
  winW:        0.910,
  winH:        1.220,
  winSill:     0.950,
  winSillCom:  0.760,
  egressArea:  0.530,   // m²      IRC R310 emergency escape opening
  stairRise:   0.1905,  // 7.5"
  stairRun:    0.254,   // 10"
  stairW:      0.914,   // 36"
  studSpace:   0.406,   // 16" o.c.
  eaveOver:    0.450,
  fascia:      0.190,
  counterH:    0.914,   // 36"
  tableH:      0.750,
  seatH:       0.450,
  curbH:       0.150,
  laneW:       3.650,   // 12'     travel lane
  walkW:       1.830,   // 6'      sidewalk
  stepUp:      0.320,   // player: max auto-step
});

/* ------------------------------------------------------------ room types - */
const RT = (T.ROOM = {
  living:   { name: "Living",    min: 11.0, minDim: 3.0, floor: "wood",   ao: 1.0 },
  family:   { name: "Family",    min: 11.0, minDim: 3.0, floor: "fabric", ao: 1.0 },
  kitchen:  { name: "Kitchen",   min:  6.0, minDim: 2.4, floor: "tile",   ao: 1.0 },
  dining:   { name: "Dining",    min:  7.5, minDim: 2.6, floor: "wood",   ao: 1.0 },
  bed:      { name: "Bedroom",   min:  7.0, minDim: 2.13, floor: "fabric", ao: 1.0, egress: true },
  bedMain:  { name: "Main Bed",  min:  11.0, minDim: 2.9, floor: "fabric", ao: 1.0, egress: true },
  bath:     { name: "Bath",      min:  3.2, minDim: 1.5, floor: "tile",   ao: .95 },
  half:     { name: "WC",        min:  1.8, minDim: 0.9, floor: "tile",   ao: .95 },
  hall:     { name: "Hall",      min:  1.0, minDim: 1.0, floor: "wood",   ao: .9 },
  foyer:    { name: "Foyer",     min:  2.0, minDim: 1.2, floor: "tile",   ao: .92 },
  office:   { name: "Study",     min:  5.0, minDim: 2.1, floor: "wood",   ao: 1.0 },
  laundry:  { name: "Laundry",   min:  2.4, minDim: 1.2, floor: "tile",   ao: .95 },
  utility:  { name: "Utility",   min:  2.0, minDim: 1.0, floor: "concrete", ao: .85 },
  porchR:   { name: "Porch",     min:  2.0, minDim: 1.2, floor: "wood",   ao: 1.0, open: true },
  garage:   { name: "Garage",    min: 14.0, minDim: 3.0, floor: "concrete", ao: .85 },
  /* non-residential */
  retail:   { name: "Shop Floor",min: 18.0, minDim: 3.0, floor: "tile",   ao: 1.0, com: true },
  diner:    { name: "Dining Rm", min: 18.0, minDim: 3.0, floor: "tile",   ao: 1.0, com: true },
  lobby:    { name: "Lobby",     min:  8.0, minDim: 2.4, floor: "tile",   ao: 1.0, com: true },
  assembly: { name: "Hall",      min: 30.0, minDim: 4.0, floor: "wood",   ao: 1.0, com: true },
  classroom:{ name: "Classroom", min: 20.0, minDim: 3.5, floor: "tile",   ao: 1.0, com: true },
  stacks:   { name: "Stacks",    min: 12.0, minDim: 2.6, floor: "fabric", ao: 1.0, com: true },
  bay:      { name: "Apparatus", min: 24.0, minDim: 4.0, floor: "concrete", ao: .9, com: true },
  workshop: { name: "Workshop",  min: 12.0, minDim: 2.6, floor: "concrete", ao: .9, com: true },
  storage:  { name: "Store",     min:  2.0, minDim: 1.0, floor: "concrete", ao: .8 },
  kitchenC: { name: "Kitchen",   min:  8.0, minDim: 2.4, floor: "tile",   ao: 1.0, com: true },
  officeC:  { name: "Office",    min:  6.0, minDim: 2.2, floor: "fabric", ao: 1.0, com: true },
});

/* ========================================================================= */
function ov(a0, a1, b0, b1) { return Math.min(a1, b1) - Math.max(a0, b0); }

/* Solve one level of a band-grid plan.
   spec = { w, d, bands:[{depth, rooms:[{t,w}]}], hall:{depth,after}|null,
            stairs:bool, entrySide:'front'|null, com:bool }                  */
function solveLevel(L, w, d, spec, issues, lid) {
  const inset = CODE.wallExt;
  const ix0 = inset, iz0 = inset, iw = w - inset * 2, id = d - inset * 2;
  const rooms = [];
  const bands = spec.bands;
  const ceilH = spec.com ? CODE.ceilCom : CODE.ceil;

  /* --- distribute depth over bands + hall ------------------------------- */
  let hallD = spec.hall ? Math.max(CODE.hallMin, spec.hall.depth || CODE.hallMin) : 0;
  /* Circulation stacks. If the storey below has a hall, this one's hall is
     forced to the same depth and position, so the stairwell rises inside a
     hall on both floors instead of surfacing through a bedroom wall.       */
  if (spec.alignHall && spec.hall) {
    hallD = spec.alignHall.depth;
    const availA = id - hallD;
    const want = T.clamp((spec.alignHall.z0 - iz0) / Math.max(availA, 0.01), 0.05, 0.95);
    let rest = 0;
    for (let i = 1; i < bands.length; i++) rest += bands[i].depth;
    const scale = (1 - want) / Math.max(rest, 1e-6);
    bands[0].depth = want;
    for (let i = 1; i < bands.length; i++) bands[i].depth *= scale;
  }
  const avail = id - hallD;
  let wsum = 0; for (const b of bands) wsum += b.depth;
  let z = iz0;
  const bandZ = [];
  const hallAfter = spec.hall ? (spec.hall.after === undefined ? 0 : spec.hall.after) : -1;

  for (let i = 0; i < bands.length; i++) {
    const bd = (bands[i].depth / wsum) * avail;
    bandZ.push({ z0: z, z1: z + bd, band: bands[i] });
    z += bd;
    if (i === hallAfter) {
      bandZ.push({ z0: z, z1: z + hallD, hall: true });
      z += hallD;
    }
  }

  /* --- slice each band into rooms along X ------------------------------- */
  let rid = 0;
  for (const bz of bandZ) {
    if (bz.hall) {
      rooms.push({ id: `R${String(++rid).padStart(2, "0")}`, t: "hall",
                   x0: ix0, x1: ix0 + iw, z0: bz.z0, z1: bz.z1, band: -1 });
      continue;
    }
    let ws = 0; for (const r of bz.band.rooms) ws += r.w;
    let x = ix0;
    for (let i = 0; i < bz.band.rooms.length; i++) {
      const r = bz.band.rooms[i];
      const rw = i === bz.band.rooms.length - 1 ? ix0 + iw - x : (r.w / ws) * iw;
      rooms.push({ id: `R${String(++rid).padStart(2, "0")}`, t: r.t,
                   x0: x, x1: x + rw, z0: bz.z0, z1: bz.z1, band: bandZ.indexOf(bz) });
      x += rw;
    }
  }
  for (const r of rooms) {
    r.w = r.x1 - r.x0; r.d = r.z1 - r.z0; r.area = r.w * r.d;
    r.cx = (r.x0 + r.x1) / 2; r.cz = (r.z0 + r.z1) / 2;
    r.def = RT[r.t] || RT.storage;
    r.name = r.def.name;
    r.doors = []; r.windows = [];
  }

  /* --- walls, derived from the partition lines (never duplicated) -------- */
  const walls = [];
  let wid = 0;
  const W = (x1, z1, x2, z2, ext) => {
    const wl = { id: `W${String(++wid).padStart(2, "0")}`, x1, z1, x2, z2, ext,
                 thick: ext ? CODE.wallExt : CODE.wallInt,
                 len: Math.hypot(x2 - x1, z2 - z1), axis: Math.abs(z2 - z1) < 1e-6 ? "x" : "z",
                 openings: [] };
    walls.push(wl); return wl;
  };
  /* exterior shell */
  const EW = {
    front: W(0, 0, w, 0, true),
    back:  W(0, d, w, d, true),
    left:  W(0, 0, 0, d, true),
    right: W(w, 0, w, d, true),
  };
  /* interior: band boundaries (along X) */
  for (let i = 0; i < bandZ.length - 1; i++) {
    const zc = bandZ[i].z1;
    W(ix0, zc, ix0 + iw, zc, false).sep = [i, i + 1];
  }
  /* interior: column boundaries within each band (along Z) */
  for (const bz of bandZ) {
    if (bz.hall) continue;
    const inBand = rooms.filter((r) => r.z0 === bz.z0 && r.z1 === bz.z1);
    for (let i = 0; i < inBand.length - 1; i++)
      W(inBand[i].x1, bz.z0, inBand[i].x1, bz.z1, false);
  }

  /* --- adjacency -------------------------------------------------------- */
  const adj = rooms.map(() => []);
  for (let i = 0; i < rooms.length; i++)
    for (let j = i + 1; j < rooms.length; j++) {
      const a = rooms[i], b = rooms[j];
      let shared = null;
      if (Math.abs(a.z1 - b.z0) < 1e-6 || Math.abs(b.z1 - a.z0) < 1e-6) {
        const o = ov(a.x0, a.x1, b.x0, b.x1);
        if (o > CODE.doorIntW + 0.30)
          shared = { axis: "x", z: Math.abs(a.z1 - b.z0) < 1e-6 ? a.z1 : b.z1,
                     c: (Math.max(a.x0, b.x0) + Math.min(a.x1, b.x1)) / 2, o };
      } else if (Math.abs(a.x1 - b.x0) < 1e-6 || Math.abs(b.x1 - a.x0) < 1e-6) {
        const o = ov(a.z0, a.z1, b.z0, b.z1);
        if (o > CODE.doorIntW + 0.30)
          shared = { axis: "z", x: Math.abs(a.x1 - b.x0) < 1e-6 ? a.x1 : b.x1,
                     c: (Math.max(a.z0, b.z0) + Math.min(a.z1, b.z1)) / 2, o };
      }
      if (shared) { adj[i].push({ j, shared }); adj[j].push({ j: i, shared }); }
    }

  /* --- entry room + spanning tree of doors ------------------------------ */
  const frontRooms = rooms.filter((r) => Math.abs(r.z0 - iz0) < 1e-6);
  let entry = frontRooms.find((r) => r.t === "foyer") ||
              frontRooms.find((r) => r.t === "living" || r.t === "retail" || r.t === "lobby" ||
                                     r.t === "diner" || r.t === "assembly" || r.t === "bay") ||
              frontRooms[0] || rooms[0];
  const eIdx = rooms.indexOf(entry);

  const doors = [];
  let did = 0;
  const seen = new Array(rooms.length).fill(false);
  const q = [eIdx]; seen[eIdx] = true;
  /* prefer opening onto circulation first so halls become real halls */
  const rank = (i) => (rooms[i].t === "hall" || rooms[i].t === "foyer" ? 0 : 1);
  while (q.length) {
    q.sort((a, b) => rank(a) - rank(b));
    const i = q.shift();
    for (const e of adj[i]) {
      if (seen[e.j]) continue;
      seen[e.j] = true; q.push(e.j);
      const a = rooms[i], b = rooms[e.j];
      const wide = a.def.com || b.def.com || b.t === "dining" || b.t === "kitchen" && a.t === "living";
      const dw = wide ? 1.20 : CODE.doorIntW;
      const dr = { id: `D${String(++did).padStart(2, "0")}`, axis: e.shared.axis,
                   w: dw, h: CODE.doorH, a: a.id, b: b.id, ext: false,
                   cased: b.t === "dining" || b.t === "kitchen" || a.def.com };
      if (e.shared.axis === "x") { dr.z = e.shared.z; dr.x = e.shared.c; }
      else { dr.x = e.shared.x; dr.z = e.shared.c; }
      doors.push(dr); a.doors.push(dr.id); b.doors.push(dr.id);
    }
  }
  for (let i = 0; i < rooms.length; i++)
    if (!seen[i] && !rooms[i].def.open)
      issues.push({ sev: "bad", id: `${lid}-${rooms[i].id}`,
                    msg: `${rooms[i].name} unreachable from the entry (no door path)` });

  /* --- exterior door(s) ------------------------------------------------- */
  if (spec.entry !== false) {
    const dw = spec.entryW || CODE.doorExtW;
    doors.push({ id: `D${String(++did).padStart(2, "0")}`, axis: "x", x: entry.cx, z: 0,
                 w: dw, h: CODE.doorH, a: "OUT", b: entry.id, ext: true, front: true });
    entry.doors.push(`D${String(did).padStart(2, "0")}`);
    entry.isEntry = true;
  }
  const backCand = rooms.filter((r) => Math.abs(r.z1 - (iz0 + id)) < 1e-6 &&
                                       (r.t === "kitchen" || r.t === "utility" || r.t === "laundry" || r.t === "family"));
  if (backCand.length && spec.backDoor !== false) {
    const r = backCand[0];
    doors.push({ id: `D${String(++did).padStart(2, "0")}`, axis: "x", x: r.cx, z: d,
                 w: CODE.doorExtW, h: CODE.doorH, a: "OUT", b: r.id, ext: true });
    r.doors.push(`D${String(did).padStart(2, "0")}`);
  }

  /* --- windows on exterior walls ---------------------------------------- */
  const wins = [];
  let nid = 0;
  const sill = spec.com ? CODE.winSillCom : CODE.winSill;
  const wh = spec.com ? 1.70 : CODE.winH;
  const addWin = (r, axis, x, z, ww) => {
    const win = { id: `N${String(++nid).padStart(2, "0")}`, axis, x, z, w: ww, h: wh, sill, room: r.id };
    wins.push(win); r.windows.push(win.id); return win;
  };
  for (const r of rooms) {
    if (r.t === "hall" || r.def.open) continue;
    const sides = [];
    if (Math.abs(r.z0 - iz0) < 1e-6) sides.push({ axis: "x", z: 0, a0: r.x0, a1: r.x1 });
    if (Math.abs(r.z1 - (iz0 + id)) < 1e-6) sides.push({ axis: "x", z: d, a0: r.x0, a1: r.x1 });
    if (Math.abs(r.x0 - ix0) < 1e-6) sides.push({ axis: "z", x: 0, a0: r.z0, a1: r.z1 });
    if (Math.abs(r.x1 - (ix0 + iw)) < 1e-6) sides.push({ axis: "z", x: w, a0: r.z0, a1: r.z1 });
    for (const s of sides) {
      const span = s.a1 - s.a0;
      const ww = r.def.com ? Math.min(2.4, span - 1.0) : CODE.winW;
      if (ww < 0.5) continue;
      let n = Math.max(1, Math.min(3, Math.floor(span / (r.def.com ? 3.0 : 2.4))));
      if (r.t === "bath" || r.t === "half" || r.t === "laundry" || r.t === "storage") n = 1;
      for (let i = 0; i < n; i++) {
        const c = s.a0 + (span * (i + 1)) / (n + 1);
        /* don't collide with an exterior door on the same wall */
        const clash = doors.some((dd) => dd.ext &&
          (s.axis === "x" ? Math.abs(dd.z - s.z) < 1e-6 && Math.abs(dd.x - c) < (dd.w + ww) / 2 + 0.2
                          : false));
        if (clash) continue;
        if (s.axis === "x") addWin(r, "x", c, s.z, ww); else addWin(r, "z", s.x, c, ww);
      }
    }
  }

  /* --- stairs ----------------------------------------------------------- */
  let stairs = null;
  if (spec.stairs) {
    const hallR = rooms.find((r) => r.t === "hall" || r.t === "foyer");
    const host = hallR || rooms.reduce((a, b) => (a.area > b.area ? a : b));
    /* the run has to reach THIS storey's floor-to-floor, not the residential
       default — a 3.05 m commercial storey left the stair 0.61 m short */
    const storey = ceilH + CODE.floorAssy;
    const steps = Math.ceil(storey / CODE.stairRise);
    const rise = storey / steps;
    const runLen = steps * CODE.stairRun;
    /* hug one side of the hall so the landing keeps a usable strip beside
       the stairwell rather than two half-width slivers either side */
    if (host.w >= runLen + 0.2 && host.d >= CODE.stairW) {
      stairs = { axis: "x", x0: host.x0 + 0.1, z0: host.z0 + 0.08,
                 len: runLen, w: CODE.stairW, steps, rise, run: CODE.stairRun, room: host.id };
    } else if (host.d >= runLen + 0.2 && host.w >= CODE.stairW) {
      stairs = { axis: "z", x0: host.x0 + 0.08, z0: host.z0 + 0.1,
                 len: runLen, w: CODE.stairW, steps, rise, run: CODE.stairRun, room: host.id };
    } else {
      issues.push({ sev: "bad", id: `${lid}-${host.id}`,
                    msg: `no legal stair run (need ${runLen.toFixed(2)}m × ${CODE.stairW}m, room is ${host.w.toFixed(2)}×${host.d.toFixed(2)})` });
    }
  }

  /* --- punch openings into the wall runs --------------------------------- */
  const punch = (wl, along, width, y0, y1, kind, ref) => {
    const start = T.clamp(along - width / 2, 0.10, wl.len - width - 0.10);
    if (start < 0.05 || width > wl.len - 0.2) {
      issues.push({ sev: "warn", id: `${lid}-${wl.id}`, msg: `opening ${ref} doesn't fit wall ${wl.id}` });
      return null;
    }
    const op = { x: start, w: width, y0, y1, kind, ref };
    wl.openings.push(op); return op;
  };
  const wallAlong = (axis, fixed, coord) =>
    walls.find((wl) => wl.axis === axis &&
      (axis === "x" ? Math.abs(wl.z1 - fixed) < 1e-6 : Math.abs(wl.x1 - fixed) < 1e-6) &&
      (axis === "x" ? coord >= Math.min(wl.x1, wl.x2) - 1e-6 && coord <= Math.max(wl.x1, wl.x2) + 1e-6
                    : coord >= Math.min(wl.z1, wl.z2) - 1e-6 && coord <= Math.max(wl.z1, wl.z2) + 1e-6));

  for (const dr of doors) {
    const wl = dr.axis === "x" ? wallAlong("x", dr.z, dr.x) : wallAlong("z", dr.x, dr.z);
    if (!wl) { issues.push({ sev: "bad", id: `${lid}-${dr.id}`, msg: `door ${dr.id} has no host wall` }); continue; }
    const along = dr.axis === "x" ? dr.x - Math.min(wl.x1, wl.x2) : dr.z - Math.min(wl.z1, wl.z2);
    const op = punch(wl, along, dr.w, 0, dr.h, "door", dr.id);
    if (op) { dr.wall = wl.id; dr.along = op.x + op.w / 2;
              if (dr.axis === "x") dr.x = Math.min(wl.x1, wl.x2) + dr.along; else dr.z = Math.min(wl.z1, wl.z2) + dr.along; }
  }
  for (const win of wins) {
    const wl = win.axis === "x" ? wallAlong("x", win.z, win.x) : wallAlong("z", win.x, win.z);
    if (!wl) continue;
    const along = win.axis === "x" ? win.x - Math.min(wl.x1, wl.x2) : win.z - Math.min(wl.z1, wl.z2);
    const op = punch(wl, along, win.w, win.sill, win.sill + win.h, "window", win.id);
    if (op) { win.wall = wl.id; win.along = op.x + op.w / 2;
              if (win.axis === "x") win.x = Math.min(wl.x1, wl.x2) + win.along; else win.z = Math.min(wl.z1, wl.z2) + win.along; }
    else { win.dead = true; }
  }
  for (const w2 of walls) w2.openings.sort((a, b) => a.x - b.x);

  /* --- VALIDATE --------------------------------------------------------- */
  if (stairs) {
    const climb = stairs.steps * stairs.rise, need = ceilH + CODE.floorAssy;
    if (Math.abs(climb - need) > 0.005)
      issues.push({ sev: "bad", id: `${lid}-ST`,
        msg: `stair climbs ${climb.toFixed(3)}m but the storey is ${need.toFixed(3)}m` });
    if (stairs.rise > 0.1985)
      issues.push({ sev: "warn", id: `${lid}-ST`, msg: `riser ${(stairs.rise * 1000) | 0}mm over the 198mm max` });
  }
  if (ceilH < CODE.ceilMin)
    issues.push({ sev: "bad", id: lid, msg: `ceiling ${ceilH}m below IRC minimum ${CODE.ceilMin}m` });
  for (const r of rooms) {
    const minDim = Math.min(r.w, r.d);
    if (r.area < r.def.min - 0.05)
      issues.push({ sev: "warn", id: `${lid}-${r.id}`,
        msg: `${r.name} ${r.area.toFixed(1)}m² under the ${r.def.min}m² minimum` });
    if (minDim < r.def.minDim - 0.02)
      issues.push({ sev: "warn", id: `${lid}-${r.id}`,
        msg: `${r.name} narrow dimension ${minDim.toFixed(2)}m < ${r.def.minDim}m` });
    if (r.def.egress) {
      const live = r.windows.map((wi) => wins.find((q2) => q2.id === wi)).filter((q2) => q2 && !q2.dead);
      const best = live.reduce((m, q2) => Math.max(m, q2.w * q2.h), 0);
      if (best < CODE.egressArea)
        issues.push({ sev: "bad", id: `${lid}-${r.id}`,
          msg: `${r.name} has no egress window (needs ${CODE.egressArea}m² clear)` });
    }
    if (r.t === "hall" && Math.min(r.w, r.d) < CODE.hallMin - 0.005)
      issues.push({ sev: "warn", id: `${lid}-${r.id}`,
        msg: `hall ${Math.min(r.w, r.d).toFixed(3)}m narrower than ${CODE.hallMin}m` });
  }
  for (const dr of doors) {
    const need = dr.ext ? CODE.doorExtW : CODE.doorIntW;
    if (dr.w < need - 0.001)
      issues.push({ sev: "bad", id: `${lid}-${dr.id}`, msg: `door ${dr.w.toFixed(3)}m under ${need}m` });
  }

  return { rooms, walls, doors, windows: wins, stairs, entry: entry.id, ceilH, level: L };
}

/* ------------------------------------------------------------------------ */
T.makePlan = function (spec) {
  const issues = [];
  const levels = [];
  let y = spec.floorY || 0;
  for (let L = 0; L < spec.levels.length; L++) {
    const ls = spec.levels[L];
    if (L > 0 && ls.hall) {
      const prev = levels[L - 1];
      const ph = prev.rooms.find((r) => r.t === "hall");
      if (ph) ls.alignHall = { z0: ph.z0, depth: ph.d };
    }
    const lv = solveLevel(L, spec.w, spec.d, ls, issues, `L${L}`);
    lv.y = y;
    lv.h = lv.ceilH;
    levels.push(lv);
    y += lv.ceilH + CODE.floorAssy;
  }
  /* stair alignment between storeys — a classic silent-failure spot */
  for (let L = 0; L < levels.length - 1; L++) {
    const s = levels[L].stairs;
    if (!s) { issues.push({ sev: "bad", id: `L${L}`, msg: `storey ${L + 1} exists with no stair from level ${L}` }); continue; }
    const up = levels[L + 1];
    const sx1 = s.x0 + (s.axis === "x" ? s.len : s.w), sz1 = s.z0 + (s.axis === "z" ? s.len : s.w);
    /* the landing is the room with the LARGEST share of the stair footprint,
       not merely the first one it clips — that misread put stairs in beds */
    let land = null, bestA = 0;
    for (const r of up.rooms) {
      const a = Math.max(0, Math.min(sx1, r.x1) - Math.max(s.x0, r.x0)) *
                Math.max(0, Math.min(sz1, r.z1) - Math.max(s.z0, r.z0));
      if (a > bestA) { bestA = a; land = r; }
    }
    s.hole = { x0: s.x0 - 0.05, z0: s.z0 - 0.05, x1: sx1 + 0.05, z1: sz1 + 0.05 };
    if (!land) { issues.push({ sev: "bad", id: `L${L}`, msg: `stair from L${L} lands outside any L${L + 1} room` }); continue; }
    s.landing = land.id;
    if (land.t !== "hall" && land.t !== "foyer")
      issues.push({ sev: "warn", id: `L${L + 1}-${land.id}`, msg: `stair lands in ${land.name}, not circulation` });

    /* Any upper wall crossing the stairwell gets an opening the full height
       of the storey. Without this you climb the run and hit a partition. */
    for (const wl of up.walls) {
      if (wl.ext) continue;
      const zAxis = wl.axis === "z";
      const wx = zAxis ? wl.x1 : null, wz = zAxis ? null : wl.z1;
      const crosses = zAxis
        ? wx > s.hole.x0 && wx < s.hole.x1 &&
          Math.max(wl.z1, wl.z2) > s.hole.z0 && Math.min(wl.z1, wl.z2) < s.hole.z1
        : wz > s.hole.z0 && wz < s.hole.z1 &&
          Math.max(wl.x1, wl.x2) > s.hole.x0 && Math.min(wl.x1, wl.x2) < s.hole.x1;
      if (!crosses) continue;
      const lo = zAxis ? Math.min(wl.z1, wl.z2) : Math.min(wl.x1, wl.x2);
      const a0 = Math.max(0, (zAxis ? s.hole.z0 : s.hole.x0) - lo);
      const a1 = Math.min(wl.len, (zAxis ? s.hole.z1 : s.hole.x1) - lo);
      if (a1 - a0 < 0.05) continue;
      wl.openings.push({ x: a0, w: a1 - a0, y0: 0, y1: up.ceilH, kind: "stairwell", ref: `${lid}-ST` });
      wl.openings.sort((p, q) => p.x - q.x);
      issues.push({ sev: "warn", id: `L${L + 1}-${wl.id}`, msg: `wall crossed the stairwell — opened ${(a1 - a0).toFixed(2)}m` });
    }

    /* the landing needs somewhere to stand: a clear strip beside the hole */
    const clear = Math.max(land.z1 - s.hole.z1, s.hole.z0 - land.z0,
                           land.x1 - s.hole.x1, s.hole.x0 - land.x0);
    if (clear < 0.70)
      issues.push({ sev: "bad", id: `L${L + 1}-${land.id}`,
        msg: `stair landing only ${clear.toFixed(2)}m clear — needs 0.70m to step off` });
  }
  return { w: spec.w, d: spec.d, levels, issues, spec };
};

/* height of the whole shell, used to sit the roof on */
T.planTop = function (plan) {
  const l = plan.levels[plan.levels.length - 1];
  return l.y + l.ceilH + 0.25;
};
})();
