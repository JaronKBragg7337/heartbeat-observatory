/* ============================================================================
   buildings.js — 13 house types + 10 civic types, exterior + interior
   Every building is: solve plan → register colliders/surfaces/IDs →
   emit primary shell → secondary forms (roof, porch, dormers, bays) →
   tertiary detail (gutters, flashing, fascia, soffit, vents, hinges, bolts,
   seams) → interiors on demand.
   ========================================================================== */
(function () {
"use strict";
const T = window.TOWN, C = T.CODE, D = T.Detail;
const M = () => T.Mats;

/* world registry — everything the player and the inspector need ---------- */
const W = (T.World = {
  colliders: [],   // {x0,x1,z0,z1,y0,y1,id,type}
  surfaces: [],    // {x0,x1,z0,z1,y,id} | ramp {ramp:true,axis,lo,hi,...}
  assets: [],      // {id,type,box,expectY}
  doors: [],       // interactive
  buildings: [],
  lamps: [],
  items: [],       // movable furniture, one record per piece
});
W.reset = function () {
  for (const k of ["colliders","surfaces","assets","doors","buildings","lamps","items"]) W[k].length = 0;
};
/* keep an item's collider and inspection box in step with its transform.
   The AABB of a rotated rectangle, so free rotation stays honest.          */
W.syncItem = function (rec) {
  const c = Math.abs(Math.cos(rec.yaw)), s = Math.abs(Math.sin(rec.yaw));
  rec.fw = c * rec.w0 + s * rec.d0;
  rec.fd = s * rec.w0 + c * rec.d0;
  const hw = rec.fw / 2, hd = rec.fd / 2;
  const a = rec.asset.box;
  a[0] = rec.x - hw; a[2] = rec.z - hd; a[3] = rec.x + hw; a[5] = rec.z + hd;
  a[1] = rec.y; a[4] = rec.y + rec.h;
  rec.asset.expectY = rec.y;
  if (rec.col) {
    rec.col.x0 = rec.x - hw; rec.col.x1 = rec.x + hw;
    rec.col.z0 = rec.z - hd; rec.col.z1 = rec.z + hd;
    rec.col.y0 = rec.y; rec.col.y1 = rec.y + rec.h;
    rec.col.off = !!rec.deleted;
  }
};

/* --------------------------------------------------------------- palette - */
const SIDING = [[.94,.93,.90],[.80,.84,.86],[.66,.74,.78],[.88,.85,.74],[.74,.78,.68],
                [.62,.66,.62],[.90,.80,.70],[.55,.60,.66],[.85,.88,.88],[.72,.62,.56]];
const ROOFC  = [[.62,.63,.66],[.48,.48,.50],[.55,.50,.46],[.40,.44,.48],[.58,.46,.42]];
const TRIMC  = [[1,1,1],[.96,.95,.92],[.30,.34,.38],[.88,.86,.80],[.24,.26,.28]];
const DOORC  = [[.42,.20,.16],[.20,.30,.42],[.18,.34,.26],[.30,.28,.26],[.60,.44,.20],[.85,.85,.83]];

/* ========================================================================= */
/* helpers                                                                   */
/* ========================================================================= */
/* rectangle minus rectangle → up to four rectangles [x0,z0,x1,z1] */
function rectMinus(x0, z0, x1, z1, h) {
  if (!h || h.x1 <= x0 || h.x0 >= x1 || h.z1 <= z0 || h.z0 >= z1) return [[x0, z0, x1, z1]];
  const hx0 = Math.max(x0, h.x0), hx1 = Math.min(x1, h.x1);
  const hz0 = Math.max(z0, h.z0), hz1 = Math.min(z1, h.z1);
  const out = [];
  if (hz0 > z0) out.push([x0, z0, x1, hz0]);
  if (hz1 < z1) out.push([x0, hz1, x1, z1]);
  if (hx0 > x0) out.push([x0, hz0, hx0, hz1]);
  if (hx1 < x1) out.push([hx1, hz0, x1, hz1]);
  return out.filter((r) => r[2] - r[0] > 0.005 && r[3] - r[1] > 0.005);
}

function segsBetweenDoors(wall, y0, h) {
  const out = [];
  let cur = 0;
  for (const op of wall.openings) {
    if (op.kind !== "door" && op.kind !== "stairwell") continue;
    if (op.x - cur > 0.02) out.push({ a: cur, b: op.x, y0, y1: y0 + h });
    cur = op.x + op.w;
  }
  if (wall.len - cur > 0.02) out.push({ a: cur, b: wall.len, y0, y1: y0 + h });
  return out;
}

/* ========================================================================= */
function Building(def, id, wx, wz, yaw, seed) {
  this.def = def; this.id = id; this.wx = wx; this.wz = wz; this.yaw = yaw;
  this.rnd = T.rng(seed);
  const r = this.rnd;
  const c = Math.round(Math.cos(yaw)), s = Math.round(Math.sin(yaw));
  this.c = c; this.s = s;

  this.tint = {
    wall: def.wallTints ? T.pick(r, def.wallTints) : T.pick(r, SIDING),
    roof: T.pick(r, ROOFC),
    trim: def.trimTints ? T.pick(r, def.trimTints) : T.pick(r, TRIMC),
    door: T.pick(r, DOORC),
  };
  this.uvOff = [r() * 8, r() * 8];        // per-instance UV shift kills tiling echoes

  const spec = def.plan(r, def);
  spec.w = def.w; spec.d = def.d; spec.floorY = def.floorY === undefined ? 0.45 : def.floorY;
  this.floorY = spec.floorY;
  this.plan = T.makePlan(spec);
  this.issues = this.plan.issues.map((i) => ({ sev: i.sev, id: `${id}-${i.id}`, msg: i.msg, b: id }));
  this.top = T.planTop(this.plan);

  this.bounds = this.aabb(-0.6, -0.6, def.w + 0.6, def.d + 0.6);
  /* everything that actually sticks out: porch or portico at the front,
     chimney one side, condenser the other. Used for the separation check. */
  const frontOut = Math.max(def.porch ? def.porch.depth || 2.2 : 1.4,
                            def.portico ? 2.7 : 0, def.awning ? 1.5 : 0, def.bayDoor ? 1.0 : 0);
  this.outer = this.aabb(-1.1, -frontOut - 0.4, def.w + 1.1, def.d + 0.9);
  this.foot = this.aabb(0, 0, def.w, def.d);          // exact footprint
  this.center = [(this.bounds[0] + this.bounds[3]) / 2, (this.bounds[2] + this.bounds[5]) / 2];
  this.interior = null; this.interiorReq = false;
  W.buildings.push(this);
}
T.Building = Building;

Building.prototype.tx = function (lx, lz) { return this.c * lx + this.s * lz + this.wx; };
Building.prototype.tz = function (lx, lz) { return -this.s * lx + this.c * lz + this.wz; };
Building.prototype.aabb = function (x0, z0, x1, z1) {
  const px = [this.tx(x0, z0), this.tx(x1, z0), this.tx(x1, z1), this.tx(x0, z1)];
  const pz = [this.tz(x0, z0), this.tz(x1, z0), this.tz(x1, z1), this.tz(x0, z1)];
  return [Math.min(...px), 0, Math.min(...pz), Math.max(...px), 0, Math.max(...pz)];
};
/* register a solid box (local rect + height range) */
Building.prototype.solid = function (x0, z0, x1, z1, y0, y1, aid, type) {
  const b = this.aabb(x0, z0, x1, z1);
  W.colliders.push({ x0: b[0], x1: b[3], z0: b[2], z1: b[5], y0, y1, id: aid, type: type || "wall" });
};
Building.prototype.surface = function (x0, z0, x1, z1, y, aid) {
  const b = this.aabb(x0, z0, x1, z1);
  W.surfaces.push({ x0: b[0], x1: b[3], z0: b[2], z1: b[5], y, id: aid });
};
Building.prototype.asset = function (aid, type, x0, z0, x1, z1, y0, y1, expectY) {
  const b = this.aabb(x0, z0, x1, z1);
  W.assets.push({ id: aid, type, box: [b[0], y0, b[2], b[3], y1, b[5]], expectY, b: this.id });
};

/* ------------------------------------------------------------ REGISTER -- */
Building.prototype.register = function () {
  const P = this.plan, def = this.def;
  this.asset(this.id, "building", 0, 0, def.w, def.d, 0, this.top + 3, 0);
  this.items = [];
  const bq = ((Math.round(this.yaw / (Math.PI / 2)) % 4) + 4) % 4;
  const swapBq = bq === 1 || bq === 3;

  for (const lv of P.levels) {
    const lid = `${this.id}-L${lv.level}`;
    /* floors — with the stairwell removed so you can actually walk down it */
    const below = P.levels[lv.level - 1];
    const hole = below && below.stairs ? below.stairs.hole : null;
    for (const rm of lv.rooms) {
      if (rm.def.open) continue;
      for (const p of rectMinus(rm.x0 - 0.06, rm.z0 - 0.06, rm.x1 + 0.06, rm.z1 + 0.06, hole))
        this.surface(p[0], p[1], p[2], p[3], lv.y, `${lid}-${rm.id}`);
      this.asset(`${lid}-${rm.id}`, "room", rm.x0, rm.z0, rm.x1, rm.z1, lv.y, lv.y + lv.ceilH, lv.y);
      rm.gid = `${lid}-${rm.id}`;
      /* ceiling fitting doubles as the room's light source */
      W.lamps.push({ x: this.tx(rm.cx, rm.cz), y: lv.y + lv.ceilH - 0.12, z: this.tz(rm.cx, rm.cz),
                     r: 6.5, indoor: true });
    }

    /* ---- furniture as individually addressable items ------------------- */
    for (const rm of lv.rooms) {
      if (rm.def.open) continue;
      let items = T.furnishSpecs(rm, lv, this.rnd);
      const mine = lv.doors.filter((dr) => dr.a === rm.id || dr.b === rm.id);
      items = T.clearDoorways(items, rm, mine, this.issues, rm.gid);
      let fi = 0;
      for (const it of items) {
        const gid = `${rm.gid}-F${String(++fi).padStart(2, "0")}`;
        const rec = {
          id: gid, kind: it.kind, p: it.p, b: this.id, room: rm.gid, level: lv.level,
          x: this.tx(it.x, it.z), z: this.tz(it.x, it.z), y: lv.y + it.y,
          yaw: this.yaw + it.yaw, w0: it.w0, d0: it.d0, fw: it.fw, fd: it.fd,
          h: it.h, solid: it.solid, roomRect: rm, bld: this,
        };
        rec.home = { x: rec.x, z: rec.z, yaw: rec.yaw };
        this.items.push(rec);
        W.items.push(rec);
        rec.asset = { id: gid, type: "furniture", kind: it.kind, expectY: rec.y, item: rec,
                      box: [0, 0, 0, 0, 0, 0] };
        W.assets.push(rec.asset);
        if (it.solid && it.h > 0.34) {
          rec.col = { x0: 0, x1: 0, z0: 0, z1: 0, y0: rec.y, y1: rec.y + it.h, id: gid, type: "furniture" };
          W.colliders.push(rec.col);
        }
        W.syncItem(rec);
      }
    }
    /* wall colliders (gaps at doors only — a window sill still stops you) */
    for (const wl of lv.walls) {
      const zAxis = wl.axis === "z";
      for (const sg of segsBetweenDoors(wl, lv.y, lv.ceilH)) {
        const t = wl.thick;
        const x0 = zAxis ? (wl.x1 === 0 ? 0 : wl.x1 - t) : Math.min(wl.x1, wl.x2) + sg.a;
        const x1 = zAxis ? x0 + t : Math.min(wl.x1, wl.x2) + sg.b;
        const z0 = zAxis ? Math.min(wl.z1, wl.z2) + sg.a : (wl.z1 === 0 ? 0 : wl.z1 - t);
        const z1 = zAxis ? Math.min(wl.z1, wl.z2) + sg.b : z0 + t;
        this.solid(x0, z0, x1, z1, sg.y0, sg.y1, `${lid}-${wl.id}`);
      }
      this.asset(`${lid}-${wl.id}`, "wall",
        zAxis ? wl.x1 - wl.thick / 2 : Math.min(wl.x1, wl.x2),
        zAxis ? Math.min(wl.z1, wl.z2) : wl.z1 - wl.thick / 2,
        zAxis ? wl.x1 + wl.thick / 2 : Math.max(wl.x1, wl.x2),
        zAxis ? Math.max(wl.z1, wl.z2) : wl.z1 + wl.thick / 2,
        lv.y, lv.y + lv.ceilH, lv.y);
    }
    /* doors — interactive, collider toggles with the leaf */
    for (const dr of lv.doors) {
      if (dr.cased) continue;
      const gid = `${lid}-${dr.id}`;
      const zAxis = dr.axis === "z";
      const t = 0.06;
      const box = zAxis ? [dr.x - t, dr.z - dr.w / 2, dr.x + t, dr.z + dr.w / 2]
                        : [dr.x - dr.w / 2, dr.z - t, dr.x + dr.w / 2, dr.z + t];
      const b = this.aabb(box[0], box[1], box[2], box[3]);
      const col = { x0: b[0], x1: b[3], z0: b[2], z1: b[5], y0: lv.y, y1: lv.y + dr.h, id: gid, type: "door" };
      W.colliders.push(col);
      /* world hinge position: hinge at the left jamb looking along the wall */
      const hx = zAxis ? dr.x : dr.x - dr.w / 2, hz = zAxis ? dr.z - dr.w / 2 : dr.z;
      W.doors.push({
        id: gid, b: this.id, level: lv.level, w: dr.w, h: dr.h, ext: !!dr.ext,
        wx: this.tx(hx, hz), wz: this.tz(hx, hz), y: lv.y,
        baseYaw: this.yaw + (zAxis ? -Math.PI / 2 : 0), open: 0, target: 0,
        col, tint: dr.ext ? this.tint.door : [.93, .92, .90],
        cx: this.tx(dr.x, dr.z), cz: this.tz(dr.x, dr.z),
      });
      this.asset(gid, "door", box[0], box[1], box[2], box[3], lv.y, lv.y + dr.h, lv.y);
    }
    for (const wn of lv.windows) {
      if (wn.dead) continue;
      const gid = `${lid}-${wn.id}`;
      const zAxis = wn.axis === "z";
      const box = zAxis ? [wn.x - .1, wn.z - wn.w / 2, wn.x + .1, wn.z + wn.w / 2]
                        : [wn.x - wn.w / 2, wn.z - .1, wn.x + wn.w / 2, wn.z + .1];
      this.asset(gid, "window", box[0], box[1], box[2], box[3], lv.y + wn.sill, lv.y + wn.sill + wn.h, lv.y + wn.sill);
      wn.gid = gid;
    }
    /* stairs: ramp surface + tread surfaces */
    if (lv.stairs) {
      const s = lv.stairs;
      const x1 = s.x0 + (s.axis === "x" ? s.len : s.w);
      const z1 = s.z0 + (s.axis === "z" ? s.len : s.w);
      const b = this.aabb(s.x0, s.z0, x1, z1);
      const yLo = lv.y, yHi = lv.y + s.steps * s.rise;
      /* which world axis does the run follow, and does y increase with it? */
      const a0 = [this.tx(s.x0, s.z0), this.tz(s.x0, s.z0)];
      const a1 = s.axis === "x" ? [this.tx(x1, s.z0), this.tz(x1, s.z0)] : [this.tx(s.x0, z1), this.tz(s.x0, z1)];
      const wAxis = Math.abs(a1[0] - a0[0]) > Math.abs(a1[1] - a0[1]) ? "x" : "z";
      const asc = (wAxis === "x" ? a1[0] - a0[0] : a1[1] - a0[1]) > 0;
      W.surfaces.push({ ramp: true, axis: wAxis, asc, x0: b[0], x1: b[3], z0: b[2], z1: b[5],
                        yLo, yHi, id: `${lid}-ST` });
      this.asset(`${lid}-ST`, "stair", s.x0, s.z0, x1, z1, yLo, yHi + 1.0, yLo);
      s.world = { x0: b[0], x1: b[3], z0: b[2], z1: b[5], yLo, yHi, wAxis, asc };

      /* NO COLLIDER ON THE STAIR RUN — and that is a known, measured
         compromise rather than an oversight.
         You can currently walk through the side of a staircase. Solidifying it
         is the obvious fix and was tried on 2026-08-06: one box per step, each
         topping out at the tread below its span. It stopped the walk-through
         and it also sealed the upper floor. tools/walkable.js measured the
         damage — buildings whose upstairs a player can actually reach fell
         from 21 of 22 to 3 — because a run is typically flush against the
         building wall on one side and fenced by its own full-length railing on
         the other, so its only legitimate approach is sideways across the
         treads, which is exactly what the boxes blocked. Opening the low
         treads (LATERAL_OPEN) recovered only 1 building of the 18 lost.
         Being unable to get upstairs at all is worse than being able to clip
         through a bannister, so the colliders come back out.
         THE REAL FIX is upstream in the stair geometry: give the run a landing
         at its foot instead of starting it against a wall, and put a gap in
         the railing where a player is meant to step on. Then the run can be
         solid without walling itself off. walkable.js is the check that will
         prove it, and baseline.js's twoStoreyWalkable proves the climb. */
    }
  }
  return this;
};

/* ========================================================================= */
/* EXTERIOR                                                                  */
/* ========================================================================= */
Building.prototype.emitExterior = function (b, dt) {
  const def = this.def, P = this.plan, t = this.tint, r = this.rnd;
  const wallMat = M()[def.wallMat || "siding"];
  const trimMat = M().paint, metal = M().metal, glass = M().glass;
  const uv = this.uvOff;
  const base = { tint: t.wall, uvOff: uv, grime: 0.30, grimeY: this.floorY };
  const trim = { tint: t.trim, bevel: 0.012 };

  b.push(this.wx, 0, this.wz, this.yaw);
  dt.push(this.wx, 0, this.wz, this.yaw);
  /* the roof gets its own mesh so the inspection camera can lift it off */
  const rf = (this._rf = new T.Builder());
  rf.push(this.wx, 0, this.wz, this.yaw);

  /* ---- foundation + slab -------------------------------------------- */
  b.id(`${this.id}-FND`, "foundation");
  b.box(-0.05, -0.65, -0.05, def.w + 0.10, this.floorY + 0.65, def.d + 0.10, M().concrete,
        { uvOff: uv, grime: 0.45, grimeY: -0.4, bevel: 0.02 });
  b.endId();
  dt.id(`${this.id}-FVT`, "vent");
  for (let x = 1.2; x < def.w - 0.6; x += 3.4) {                 // foundation vents
    D.vent(dt, x, this.floorY - 0.28, -0.08, 0.36, 0.18, metal, [.5, .5, .52]);
    D.vent(dt, x, this.floorY - 0.28, def.d + 0.05 - 0.03, 0.36, 0.18, metal, [.5, .5, .52]);
  }
  dt.endId();

  /* ---- levels: exterior walls, trim, windows --------------------------- */
  for (const lv of P.levels) {
    const lid = `${this.id}-L${lv.level}`;
    for (const wl of lv.walls) {
      if (!wl.ext) continue;
      const zAxis = wl.axis === "z";
      const th = wl.thick;
      const x0 = zAxis ? (wl.x1 === 0 ? 0 : wl.x1 - th) : 0;
      const z0 = zAxis ? 0 : (wl.z1 === 0 ? 0 : wl.z1 - th);
      b.id(`${lid}-${wl.id}`, "wall");
      b.wallRun(x0, z0, wl.len, lv.y, lv.ceilH, th, wallMat, wl.openings,
                Object.assign({ axis: wl.axis }, base));
      b.endId();
    }
    /* band board between storeys (secondary form, reads in silhouette) */
    if (lv.level > 0)
      b.box(-0.05, lv.y - 0.22, -0.05, def.w + 0.10, 0.16, def.d + 0.10, trimMat,
            { tint: t.trim, bevel: 0.01 });

    /* windows: casing, sill, glass, muntins, drip cap, shutters */
    for (const wn of lv.windows) {
      if (wn.dead) continue;
      this.emitWindow(b, dt, lv, wn, trimMat, glass, metal);
    }
    /* exterior door surrounds */
    for (const dr of lv.doors) {
      if (!dr.ext) continue;
      this.emitDoorSurround(b, dt, lv, dr, trimMat, metal);
    }
  }

  /* ---- corner boards --------------------------------------------------- */
  const topY = P.levels[P.levels.length - 1].y + P.levels[P.levels.length - 1].ceilH;
  b.id(`${this.id}-CRN`, "trim");
  for (const [cx, cz] of [[0, 0], [def.w - 0.09, 0], [0, def.d - 0.09], [def.w - 0.09, def.d - 0.09]]) {
    b.box(cx - 0.02, this.floorY, cz - 0.02, 0.13, topY - this.floorY, 0.13, trimMat, trim);
  }
  b.endId();

  /* ---- roof + everything hanging off it -------------------------------- */
  this.emitRoof(b, dt, topY);

  /* ---- porch / stoop --------------------------------------------------- */
  if (def.porch) this.emitPorch(b, dt, def.porch);
  else this.emitStoop(b, dt);

  /* ---- per-type secondary forms (bay, steeple, portico, awning, sign) -- */
  if (T.Extras) T.Extras(b, dt, this);

  /* ---- utilities (tertiary) -------------------------------------------- */
  dt.id(`${this.id}-UTL`, "fixture");
  const mx = def.w - 1.2;
  dt.box(mx, this.floorY + 1.1, -0.14, 0.30, 0.42, 0.16, metal, { tint: [.8, .8, .78], bevel: 0.01 });  // meter
  dt.cyl(mx + 0.15, this.floorY + 1.52, -0.06, 0.10, 0.10, 0.04, 10, M().glass, { tint: [.9, .95, 1] });
  D.bolt(dt, mx + 0.02, this.floorY + 1.14, -0.15, 0.010, metal);
  D.bolt(dt, mx + 0.28, this.floorY + 1.14, -0.15, 0.010, metal);
  dt.cyl(0.6, this.floorY - 0.15, -0.10, 0.022, 0.022, 0.10, 6, metal, { tint: [.7, .72, .7] });        // hose bib
  if (!def.noAC) {                                                                                       // condenser
    const ax = def.w + 0.35, az = def.d * 0.35;
    dt.box(ax, 0.02, az, 0.62, 0.66, 0.62, metal, { tint: [.62, .66, .66], bevel: 0.012 });
    for (let i = 0; i < 9; i++) dt.box(ax + 0.02, 0.10 + i * 0.06, az - 0.005, 0.58, 0.03, 0.01, metal, { tint: [.4, .43, .43] });
    dt.cyl(ax + 0.31, 0.685, az + 0.31, 0.24, 0.24, 0.02, 12, metal, { tint: [.35, .37, .37] });
    for (let i = 0; i < 4; i++) D.bolt(dt, ax + 0.05 + (i % 2) * 0.52, 0.66, az + 0.05 + ((i / 2) | 0) * 0.52, 0.011, metal);
    b.shadowQuad(ax + 0.31, az + 0.31, 1.5, 1.5, 0.012);
  }
  dt.endId();

  /* contact shadow so the mass sits on the ground */
  b.id(`${this.id}-SHD`, "decal");
  b.shadowQuad(def.w / 2 + 0.6, def.d / 2 + 0.6, def.w * 1.5, def.d * 1.6, 0.015);
  b.endId();

  b.pop(); dt.pop(); rf.pop();
  this.roofMesh = rf.build();
  this._rf = null;
  return this;
};

/* ---------------------------------------------------------------- window - */
Building.prototype.emitWindow = function (b, dt, lv, wn, trimMat, glass, metal) {
  const t = this.tint, def = this.def;
  const zAxis = wn.axis === "z";
  const y0 = lv.y + wn.sill, h = wn.h, w = wn.w;
  const outward = zAxis ? (wn.x < 0.5 ? -1 : 1) : (wn.z < 0.5 ? -1 : 1);
  const face = zAxis ? (wn.x < 0.5 ? 0 : def.w) : (wn.z < 0.5 ? 0 : def.d);
  const th = C.wallExt;
  const cas = 0.075, casD = 0.035;

  b.id(wn.gid, "window");
  /* place a box in wall-local terms: (along, span, up, height, depth, thickness)
     `dep` is measured INWARD from the cladding face — negative means proud.  */
  const put = (a0, aw, yy, hh, dep, dw, mat, o) => {
    const p = outward > 0 ? face - dep - dw : face + dep;
    if (zAxis) b.box(p, yy, wn.z + a0, dw, hh, aw, mat, o);
    else b.box(wn.x + a0, yy, p, aw, hh, dw, mat, o);
  };
  const To = { tint: t.trim, bevel: 0.008 };
  /* casing: head, sill, two jambs — separate meshes, not one boolean frame */
  put(-w / 2 - cas, w + cas * 2, y0 + h, cas, -casD, casD, trimMat, To);
  put(-w / 2 - cas, w + cas * 2, y0 - 0.055, 0.055, -0.055, casD + 0.06, trimMat, To);  // stool, projects
  put(-w / 2 - cas, cas, y0, h, -casD, casD, trimMat, To);
  put(w / 2, cas, y0, h, -casD, casD, trimMat, To);
  /* drip cap flashing over the head */
  put(-w / 2 - cas - 0.01, w + cas * 2 + 0.02, y0 + h + cas, 0.022, -casD - 0.03, casD + 0.04, metal, { tint: [.72, .74, .75] });
  /* glass, set back 30 mm so the reveal reads */
  put(-w / 2 + 0.015, w - 0.03, y0 + 0.015, h - 0.03, 0.030, 0.018, glass, { tint: [.85, .9, .95], ao: 0.85 });
  /* sash + muntins in front of the glass */
  const sT = { tint: [t.trim[0] * .98, t.trim[1] * .98, t.trim[2] * .98], bevel: 0.005 };
  put(-w / 2 + 0.015, w - 0.03, y0 + h / 2 - 0.022, 0.044, 0.004, 0.028, trimMat, sT);
  put(-0.018, 0.036, y0 + 0.015, h - 0.03, 0.004, 0.028, trimMat, sT);
  b.endId();

  /* shutters (secondary form) + their hinges and bolts (tertiary) */
  if (def.shutters) {
    dt.id(wn.gid + "-SH", "shutter");
    const st = { tint: def.shutterTint || [.28, .32, .30], bevel: 0.008 };
    for (const side of [-1, 1]) {
      const a0 = side < 0 ? -w / 2 - cas - 0.30 : w / 2 + cas;
      put(a0, 0.30, y0, h, -0.038, 0.035, trimMat, st);
      for (let i = 0; i < 5; i++)                                     // louvres
        put(a0 + 0.03, 0.24, y0 + 0.10 + i * (h - 0.2) / 5, (h - 0.2) / 5 * 0.5, -0.050, 0.012,
            trimMat, { tint: [st.tint[0] * .7, st.tint[1] * .7, st.tint[2] * .7] });
      for (const hy of [y0 + 0.18, y0 + h - 0.18])
        if (!zAxis) D.hinge(dt, wn.x + a0 + (side < 0 ? 0.30 : 0), hy,
                            outward > 0 ? face + 0.02 : face - 0.02, side, metal);
    }
    dt.endId();
  }
};

/* -------------------------------------------------------- door surround -- */
Building.prototype.emitDoorSurround = function (b, dt, lv, dr, trimMat, metal) {
  const t = this.tint, def = this.def;
  const outward = dr.z < 0.5 ? -1 : 1;
  const face = dr.z < 0.5 ? 0 : def.d;
  const cas = 0.10, dep = 0.04;
  const To = { tint: t.trim, bevel: 0.01 };
  b.id(`${this.id}-L${lv.level}-${dr.id}-CAS`, "trim");
  b.box(dr.x - dr.w / 2 - cas, lv.y + dr.h, face + (outward > 0 ? -dep : 0), dr.w + cas * 2, cas + 0.03, dep, trimMat, To);
  b.box(dr.x - dr.w / 2 - cas, lv.y, face + (outward > 0 ? -dep : 0), cas, dr.h + cas, dep, trimMat, To);
  b.box(dr.x + dr.w / 2, lv.y, face + (outward > 0 ? -dep : 0), cas, dr.h + cas, dep, trimMat, To);
  b.box(dr.x - dr.w / 2 - cas - 0.02, lv.y + dr.h + cas + 0.03, face + (outward > 0 ? -dep - 0.03 : -0.01),
        dr.w + cas * 2 + 0.04, 0.03, dep + 0.04, metal, { tint: [.72, .74, .75] });          // head flashing
  b.box(dr.x - dr.w / 2 - 0.02, lv.y - 0.03, face + (outward > 0 ? -0.16 : -0.02), dr.w + 0.04, 0.035, 0.18,
        M().metal, { tint: [.66, .60, .48], bevel: 0.006 });                                  // threshold
  b.endId();
  if (dr.front) {
    dt.id(`${this.id}-FIX`, "fixture");
    const lx = dr.x + dr.w / 2 + 0.28, ly = lv.y + 1.95, lz = face + (outward > 0 ? -0.06 : 0.02);
    dt.box(lx - 0.06, ly, lz - 0.02, 0.12, 0.05, 0.10, metal, { tint: [.2, .2, .22], bevel: 0.006 });
    dt.box(lx - 0.055, ly - 0.20, lz, 0.11, 0.20, 0.09, M().glass, { tint: [1, .92, .72], ao: 1 });
    dt.box(lx - 0.065, ly - 0.235, lz - 0.005, 0.13, 0.04, 0.10, metal, { tint: [.2, .2, .22], bevel: 0.005 });
    dt.cyl(dr.x - dr.w / 2 - 0.18, lv.y + 1.05, lz, 0.016, 0.016, 0.014, 8, metal, { tint: [.85, .82, .6] }); // bell
    for (let i = 0; i < 3; i++)                                                                // house numbers
      dt.box(dr.x + dr.w / 2 + 0.22 + i * 0.09, lv.y + 1.5, lz, 0.055, 0.10, 0.012, metal, { tint: [.25, .25, .27], bevel: 0.004 });
    dt.endId();
  }
};

/* ------------------------------------------------------------------ roof - */
Building.prototype.emitRoof = function (b, dt, topY) {
  const def = this.def, t = this.tint, uv = this.uvOff;
  const roofMat = M()[def.roofMat || "shingle"], trimMat = M().paint, metal = M().metal;
  const ro = { tint: t.roof, uvOff: uv };
  const To = { tint: t.trim, bevel: 0.01 };
  const over = C.eaveOver, pitch = def.pitch || 0.5;
  const wallTop = topY;
  const rf = this._rf || b;               // roof planes live in their own mesh
  rf.id(`${this.id}-K01`, "roof");
  let R = null;

  if (def.roof === "hip") {
    R = rf.hipRoof(0, wallTop, 0, def.w, def.d, pitch, over, roofMat, ro);
  } else if (def.roof === "shed") {
    R = rf.shedRoof(0, wallTop, 0, def.w, def.d, pitch, over, roofMat, ro);
  } else if (def.roof === "flat") {
    rf.box(-over, wallTop, -over, def.w + over * 2, 0.10, def.d + over * 2, roofMat, ro);
    const pw = 0.16, ph = 0.55;                                    // parapet + coping
    for (const [x, z, w2, d2] of [[-over, -over, def.w + over * 2, pw], [-over, def.d + over - pw, def.w + over * 2, pw],
                                  [-over, -over, pw, def.d + over * 2], [def.w + over - pw, -over, pw, def.d + over * 2]]) {
      b.box(x, wallTop, z, w2, ph, d2, M()[def.wallMat || "stucco"], { tint: t.wall, uvOff: uv });
      b.box(x - 0.03, wallTop + ph, z - 0.03, w2 + 0.06, 0.05, d2 + 0.06, metal, { tint: [.7, .72, .73], bevel: 0.008 });
    }
    R = { X0: -over, X1: def.w + over, Z0: -over, Z1: def.d + over, eaveY: wallTop };
  } else if (def.roof === "gambrel") {
    const hw = def.d / 2 + over, cz = def.d / 2;
    const y1 = wallTop + hw * 0.42, y2 = wallTop + hw * 0.42 + hw * 0.62;
    const bx = -over, ex = def.w + over, k = hw * 0.55;
    for (const sgn of [-1, 1]) {
      const zE = cz + sgn * hw, zM = cz + sgn * k;
      rf._out([[bx, wallTop, zE], [bx, y1, zM], [ex, y1, zM], [ex, wallTop, zE]], [0, 0.5, sgn], roofMat, ro);
      /* the upper slope's far edge is at zM, not cz — it was collapsing */
      rf._out([[bx, y1, zM], [bx, y2, cz], [ex, y2, cz], [ex, y1, zM]], [0, 1, sgn * 0.5], roofMat, ro);
    }
    /* gable ends — each wound to face out of its own end */
    for (const [ex2, dir] of [[bx, -1], [ex, 1]]) {
      const gm = M()[def.wallMat], gt = { tint: t.wall, uvOff: uv };
      b._out([[ex2, wallTop, cz - hw], [ex2, y1, cz - k], [ex2, y1, cz + k], [ex2, wallTop, cz + hw]], [dir, 0, 0], gm, gt);
      b._out([[ex2, y1, cz - k], [ex2, y2, cz], [ex2, y1, cz + k]], [dir, 0, 0], gm, gt);
    }
    R = { X0: bx, X1: ex, Z0: cz - hw, Z1: cz + hw, eaveY: wallTop, ridgeY: y2 };
  } else {  /* gable */
    R = rf.gableRoof(0, wallTop, 0, def.w, def.d, pitch, over, roofMat, ro);
    /* Gable end walls. Both ends used to be wound the same way, so the one at
       x = 0 faced inwards, got back-face culled, and you looked straight into
       the roof cavity — which is what made roofs read as floating slabs. */
    const rise = (def.d / 2) * pitch;
    const gw = M()[def.wallMat || "siding"];
    const go = { tint: def.gableTint || t.wall, uvOff: uv };
    b._out([[0, wallTop, 0], [0, wallTop + rise, def.d / 2], [0, wallTop, def.d]], [-1, 0, 0], gw, go);
    b._out([[def.w, wallTop, 0], [def.w, wallTop + rise, def.d / 2], [def.w, wallTop, def.d]], [1, 0, 0], gw, go);
    /* rake boards down both slopes of both ends, plus the gable vent */
    for (const [x, dir] of [[-0.02, -1], [def.w - 0.14, 1]])
      for (const zEnd of [-over, def.d + over]) {
        b._out([[x, wallTop, zEnd], [x, wallTop + rise + over * pitch, def.d / 2],
                [x + 0.16, wallTop + rise + over * pitch, def.d / 2], [x + 0.16, wallTop, zEnd]],
               [dir, 0.35, 0], trimMat, To);
      }
    dt.id(`${this.id}-GV`, "vent");
    D.vent(dt, def.w / 2 - 0.28, wallTop + rise * 0.35, -0.03, 0.56, 0.42, trimMat, t.trim);
    dt.endId();
    /* ridge cap */
    rf.box(R.X0, R.ridgeY - 0.03, R.cz - 0.09, R.X1 - R.X0, 0.07, 0.18, roofMat, { tint: [t.roof[0] * .9, t.roof[1] * .9, t.roof[2] * .9] });
  }
  rf.endId();
  this.roofInfo = R;

  /* ---- fascia, soffit, gutters, downspouts --------------------------- */
  if (def.roof !== "flat") {
    b.id(`${this.id}-FSC`, "trim");
    const eave = R.eaveY !== undefined ? R.eaveY : wallTop;
    for (const z of [R.Z0, R.Z1 - C.fascia * 0.55]) {
      b.box(R.X0, eave - C.fascia - 0.09, z, R.X1 - R.X0, C.fascia, C.fascia * 0.55, trimMat, To);  // fascia
    }
    /* soffit returns (the flat underside back to the wall) */
    const so = { tint: [.88, .87, .84], ao: 0.6 };
    b.quad([R.X0, wallTop - 0.02, R.Z0], [R.X1, wallTop - 0.02, R.Z0], [R.X1, wallTop - 0.02, 0], [R.X0, wallTop - 0.02, 0], trimMat, so);
    b.quad([R.X0, wallTop - 0.02, def.d], [R.X1, wallTop - 0.02, def.d], [R.X1, wallTop - 0.02, R.Z1], [R.X0, wallTop - 0.02, R.Z1], trimMat, so);
    b.endId();
    dt.id(`${this.id}-GTR`, "gutter");
    const gy = (R.eaveY !== undefined ? R.eaveY : wallTop) - C.fascia - 0.10;
    D.gutter(dt, R.X0, R.X1, gy, R.Z0 - 0.12, metal, [.86, .86, .84]);
    D.gutter(dt, R.X0, R.X1, gy, R.Z1 + 0.01, metal, [.86, .86, .84]);
    D.downspout(dt, R.X0 + 0.15, R.Z0 - 0.10, gy, 0.05, metal, [.86, .86, .84]);
    D.downspout(dt, R.X1 - 0.24, R.Z1 + 0.03, gy, 0.05, metal, [.86, .86, .84]);
    for (let i = 0; i < 6; i++) D.bolt(dt, R.X0 + 0.4 + i * ((R.X1 - R.X0 - 0.8) / 5), gy + 0.03, R.Z0 - 0.13, 0.009, metal);
    dt.endId();
  }

  /* ---- chimney -------------------------------------------------------- */
  if (def.chimney) {
    b.id(`${this.id}-CHM`, "chimney");
    /* exterior stack against the gable end — an interior one used to grow
       straight up through the hall */
    const cx = -0.72, cz = def.d * 0.5 - 0.35;
    const ch = (R.ridgeY || wallTop + 1.5) + 0.85;
    this.solid(cx, cz, cx + 0.85, cz + 0.70, 0, ch, `${this.id}-CHM`, "chimney");
    b.box(cx, -0.3, cz, 0.85, ch + 0.3, 0.70, M().brick, { tint: [.95, .9, .88], uvOff: uv, grime: .3, grimeY: 0 });
    b.box(cx - 0.06, ch, cz - 0.06, 0.97, 0.09, 0.82, M().concrete, { tint: [.8, .8, .78], bevel: 0.014 });  // crown
    dt.box(cx + 0.18, ch + 0.09, cz + 0.16, 0.22, 0.30, 0.22, M().metal, { tint: [.5, .5, .5], bevel: 0.01 });
    dt.box(cx + 0.12, ch + 0.39, cz + 0.10, 0.34, 0.05, 0.34, M().metal, { tint: [.45, .45, .45] });
    /* counter-flashing where the stack meets the wall */
    dt.box(cx + 0.80, this.floorY + 0.4, cz - 0.03, 0.10, wallTop - this.floorY - 0.4, 0.76, M().metal, { tint: [.7, .72, .73] });
    b.endId();
  }
  /* ---- dormers -------------------------------------------------------- */
  if (def.dormers) {
    const n = def.dormers, lv = this.plan.levels[this.plan.levels.length - 1];
    for (let i = 0; i < n; i++) {
      const dx = def.w * ((i + 1) / (n + 1)) - 0.75;
      const dy = wallTop - 0.9, dz = 0.55;
      b.id(`${this.id}-DRM${i}`, "dormer");
      b.box(dx, dy, dz, 1.50, 1.35, 1.10, M()[def.wallMat || "siding"], { tint: this.tint.wall, uvOff: uv });
      rf.gableRoof(dx - 0.12, dy + 1.35, dz - 0.12, 1.74, 1.34, 0.9, 0.12, M()[def.roofMat || "shingle"], { tint: this.tint.roof });
      b.box(dx + 0.30, dy + 0.30, dz - 0.03, 0.90, 0.95, 0.06, M().glass, { tint: [.85, .9, .95], ao: .85 });
      b.box(dx + 0.24, dy + 0.24, dz - 0.06, 1.02, 0.07, 0.06, M().paint, { tint: this.tint.trim, bevel: .008 });
      b.box(dx + 0.24, dy + 1.25, dz - 0.06, 1.02, 0.07, 0.06, M().paint, { tint: this.tint.trim, bevel: .008 });
      b.endId();
    }
  }
};

/* ----------------------------------------------------------------- porch - */
Building.prototype.emitPorch = function (b, dt, p) {
  const def = this.def, t = this.tint, metal = M().metal, trimMat = M().paint;
  const dep = p.depth || 2.2;
  const x0 = p.full ? 0 : def.w * 0.12, w = p.full ? def.w : def.w * 0.62;
  const deckY = this.floorY - 0.04;
  b.id(`${this.id}-PCH`, "porch");
  /* deck + skirt */
  b.box(x0 - 0.1, deckY - 0.16, -dep, w + 0.2, 0.16, dep + 0.1, M().wood, { tint: [.82, .74, .64], uvOff: this.uvOff, bevel: 0.008 });
  b.box(x0 - 0.05, 0.0, -dep + 0.02, w + 0.1, deckY - 0.16, 0.06, M().paint, { tint: t.trim, ao: .7 });
  b.box(x0 - 0.05, 0.0, -dep + 0.02, 0.06, deckY - 0.16, dep, M().paint, { tint: t.trim, ao: .7 });
  b.box(x0 + w - 0.01, 0.0, -dep + 0.02, 0.06, deckY - 0.16, dep, M().paint, { tint: t.trim, ao: .7 });
  this.surface(x0 - 0.1, -dep, x0 + w + 0.1, 0.05, deckY, `${this.id}-PCH`);
  /* datum is grade: the skirt boards do run down to the ground */
  this.asset(`${this.id}-PCH`, "porch", x0 - 0.1, -dep, x0 + w + 0.1, 0.05, 0, deckY + 2.6, 0);

  /* posts with plinth + capital, railing with balusters */
  const n = Math.max(2, Math.round(w / 2.4));
  const postY = deckY, postH = 2.42;
  for (let i = 0; i <= n; i++) {
    const px = x0 + (w - 0.16) * (i / n);
    b.box(px, postY, -dep + 0.08, 0.16, postH, 0.16, trimMat, { tint: t.trim, bevel: 0.014 });
    b.box(px - 0.04, postY, -dep + 0.04, 0.24, 0.14, 0.24, trimMat, { tint: t.trim, bevel: 0.012 });          // plinth
    b.box(px - 0.05, postY + postH - 0.12, -dep + 0.03, 0.26, 0.12, 0.26, trimMat, { tint: t.trim, bevel: 0.012 }); // capital
    this.solid(px, -dep + 0.08, px + 0.16, -dep + 0.24, postY, postY + postH, `${this.id}-PCH-P${i}`, "post");
    if (i < n) {
      const sx = px + 0.16, ex = x0 + (w - 0.16) * ((i + 1) / n);
      if (p.rail !== false && !(p.gap && i === Math.floor(n / 2))) {
        b.box(sx, postY + 0.90, -dep + 0.10, ex - sx, 0.09, 0.12, trimMat, { tint: t.trim, bevel: 0.01 });
        b.box(sx, postY + 0.14, -dep + 0.11, ex - sx, 0.06, 0.10, trimMat, { tint: t.trim, bevel: 0.008 });
        const nb = Math.max(2, Math.round((ex - sx) / 0.14));
        for (let k = 1; k < nb; k++)
          b.box(sx + (ex - sx) * (k / nb) - 0.017, postY + 0.20, -dep + 0.125, 0.034, 0.70, 0.034, trimMat, { tint: t.trim, bevel: 0.005 });
        this.solid(sx, -dep + 0.10, ex, -dep + 0.22, postY, postY + 1.0, `${this.id}-PCH-R${i}`, "rail");
      }
    }
  }
  /* porch roof — shallow shed tucked under the eave */
  const pr = b.shedRoof(x0 - 0.35, deckY + postH, -dep - 0.35, w + 0.70, dep + 0.45, 0.22, 0.0,
                        M()[def.roofMat || "shingle"], { tint: t.roof, uvOff: this.uvOff });
  b.box(pr.X0, pr.lo - 0.20, pr.Z0, pr.X1 - pr.X0, 0.20, 0.10, trimMat, { tint: t.trim, bevel: 0.01 });
  dt.id(`${this.id}-PGT`, "gutter");
  D.gutter(dt, pr.X0, pr.X1, pr.lo - 0.25, pr.Z0 - 0.11, metal, [.86, .86, .84]);
  dt.endId();
  b.endId();
  this.emitSteps(b, x0 + w / 2 - 0.7, -dep - 0.05, 1.4, deckY);
};

Building.prototype.emitStoop = function (b, dt) {
  const def = this.def, lv = this.plan.levels[0];
  const dr = lv.doors.find((d2) => d2.front);
  if (!dr) return;
  const y = this.floorY;
  b.id(`${this.id}-STP`, "stoop");
  b.box(dr.x - 0.95, 0, -1.30, 1.90, y - 0.02, 1.32, M().concrete, { tint: [.88, .88, .86], uvOff: this.uvOff, bevel: 0.02, grime: .3 });
  this.surface(dr.x - 0.95, -1.30, dr.x + 0.95, 0.05, y - 0.02, `${this.id}-STP`);
  this.asset(`${this.id}-STP`, "stoop", dr.x - 0.95, -1.30, dr.x + 0.95, 0.02, 0, y, 0);
  b.endId();
  this.emitSteps(b, dr.x - 0.7, -1.30, 1.4, y - 0.02);
  /* small roof over the door */
  if (this.def.hood !== false) {
    b.id(`${this.id}-HOOD`, "canopy");
    b.shedRoof(dr.x - 1.15, this.floorY + 2.35, -1.15, 2.30, 1.20, 0.30, 0.0, M()[this.def.roofMat || "shingle"], { tint: this.tint.roof });
    for (const sx of [dr.x - 1.05, dr.x + 0.95]) {
      b.box(sx, this.floorY + 2.05, -1.05, 0.10, 0.34, 1.00, M().paint, { tint: this.tint.trim, bevel: 0.008 });
      D.bolt(b, sx + 0.05, this.floorY + 2.12, -0.02, 0.012, M().metal);
    }
    b.endId();
  }
};

Building.prototype.emitSteps = function (b, x, z, w, topY) {
  const n = Math.max(1, Math.round(topY / 0.17));
  const rise = topY / n, run = 0.30;
  b.id(`${this.id}-STEP`, "steps");
  for (let i = 0; i < n; i++) {
    const sy = i * rise, sz = z - (n - i) * run;
    b.box(x, sy, sz, w, rise, run + 0.03, M().concrete, { tint: [.86, .86, .84], bevel: 0.014, grime: .35 });
    const bx = this.aabb(x, sz, x + w, sz + run + 0.03);
    W.surfaces.push({ x0: bx[0], x1: bx[3], z0: bx[2], z1: bx[5], y: sy + rise, id: `${this.id}-STEP${i}` });
  }
  b.endId();
};

/* Reveal lining: head, sill and jambs across the wall thickness, plus a
   stool and apron on windows. Without these you see cladding from inside. */
Building.prototype.emitReveal = function (b, lv, wl, op, paint) {
  const zAxis = wl.axis === "z";
  const th = C.wallExt, t = 0.028;
  const near0 = zAxis ? wl.x1 === 0 : wl.z1 === 0;      // is the outside face at the low side?
  const face = zAxis ? wl.x1 : wl.z1;
  const a0 = (zAxis ? Math.min(wl.z1, wl.z2) : Math.min(wl.x1, wl.x2)) + op.x;
  const y0 = lv.y + op.y0, y1 = lv.y + op.y1;
  const To = { tint: [.98, .98, .96], bevel: 0.005, ao: .9 };
  const dep = th - 0.072;
  const d0 = near0 ? 0.055 : face - th + 0.017;
  const put = (along, alen, yy, hh, dd, ddep, o) => {
    if (zAxis) b.box(near0 ? d0 + dd : d0 + dd, yy, a0 + along, ddep, hh, alen, paint, o);
    else b.box(a0 + along, yy, d0 + dd, alen, hh, ddep, paint, o);
  };
  put(0, op.w, y1 - t, t, 0, dep, To);                       // head
  put(0, op.w, y0, t, 0, dep, To);                           // sill / threshold
  put(-t, t, y0, y1 - y0, 0, dep, To);                       // jambs
  put(op.w, t, y0, y1 - y0, 0, dep, To);
  /* casing on the room face */
  const cIn = near0 ? th : face - th - 0.03;
  const cd = 0.03;
  const cput = (along, alen, yy, hh) => {
    if (zAxis) b.box(cIn, yy, a0 + along, cd, hh, alen, paint, To);
    else b.box(a0 + along, yy, cIn, alen, hh, cd, paint, To);
  };
  cput(-0.07, op.w + 0.14, y1, 0.07);
  cput(-0.07, 0.07, y0, y1 - y0);
  cput(op.w, 0.07, y0, y1 - y0);
  if (op.kind === "window") {
    const sIn = near0 ? th - 0.01 : face - th - 0.055;
    if (zAxis) {
      b.box(sIn, y0 - 0.035, a0 - 0.09, 0.065, 0.035, op.w + 0.18, paint, { tint: [.98, .98, .96], bevel: 0.006 });
      b.box(sIn + 0.01, y0 - 0.115, a0 - 0.05, 0.03, 0.08, op.w + 0.10, paint, To);
    } else {
      b.box(a0 - 0.09, y0 - 0.035, sIn, op.w + 0.18, 0.035, 0.065, paint, { tint: [.98, .98, .96], bevel: 0.006 });
      b.box(a0 - 0.05, y0 - 0.115, sIn + 0.01, op.w + 0.10, 0.08, 0.03, paint, To);
    }
  }
};

/* ========================================================================= */
/* INTERIOR — built lazily, freed when far away                              */
/* ========================================================================= */
Building.prototype.buildInterior = function () {
  const b = new T.Builder();
  const def = this.def, P = this.plan, t = this.tint;
  b.push(this.wx, 0, this.wz, this.yaw);
  const paint = M().paint, dry = M().drywall;

  for (const lv of P.levels) {
    const lid = `${this.id}-L${lv.level}`;
    const below = P.levels[lv.level - 1];
    const floorHole = below && below.stairs ? below.stairs.hole : null;  // opening in THIS floor
    const ceilHole = lv.stairs ? lv.stairs.hole : null;                  // opening in THIS ceiling
    /* rooms are painted, not primed: a quiet colour per storey */
    const PAL = [[.97,.95,.90],[.86,.89,.90],[.92,.90,.86],[.84,.88,.82],[.94,.88,.86],[.88,.86,.92],[.97,.94,.84]];
    const wallTint = PAL[(this.rnd() * PAL.length) | 0];

    for (const rm of lv.rooms) {
      const fm = M()[rm.def.floor] || M().wood;
      const e = 0.06;
      b.id(rm.gid, "room");
      /* floor + ceiling, with the stairwell punched out of both so the run
         is actually open rather than boxed in by the slab above it */
      for (const p of rectMinus(rm.x0 - e, rm.z0 - e, rm.x1 + e, rm.z1 + e, floorHole))
        b.plane(p[0], p[1], p[2] - p[0], p[3] - p[1], lv.y + 0.005, fm,
                { uvOff: this.uvOff, ao: rm.def.ao * 0.95 });
      for (const p of rectMinus(rm.x0 - e, rm.z0 - e, rm.x1 + e, rm.z1 + e, ceilHole))
        b.quad([p[0], lv.y + lv.ceilH, p[1]], [p[2], lv.y + lv.ceilH, p[1]],
               [p[2], lv.y + lv.ceilH, p[3]], [p[0], lv.y + lv.ceilH, p[3]], M().ceiling,
               { tint: [.99, .99, .98], ao: 0.86 });
      /* baseboard + crown, as separate trim meshes */
      for (const [ax, az, aw, ad] of [[rm.x0, rm.z0 - 0.01, rm.w, 0.02], [rm.x0, rm.z1 - 0.01, rm.w, 0.02],
                                      [rm.x0 - 0.01, rm.z0, 0.02, rm.d], [rm.x1 - 0.01, rm.z0, 0.02, rm.d]]) {
        b.box(ax, lv.y + 0.006, az, aw, 0.105, ad + 0.018, paint, { tint: [.97, .97, .95], bevel: 0.006, ao: .8 });
      }
      /* ceiling fixture */
      b.box(rm.cx - 0.13, lv.y + lv.ceilH - 0.10, rm.cz - 0.13, 0.26, 0.10, 0.26, M().glass,
            { tint: [1, .95, .82], ao: 1 });
      b.box(rm.cx - 0.15, lv.y + lv.ceilH - 0.03, rm.cz - 0.15, 0.30, 0.03, 0.30, M().metal, { tint: [.8, .8, .8] });
      b.endId();
      /* furniture is NOT baked in here — it's drawn per item so each piece
         keeps its own ID and can be moved in edit mode */
    }

    /* interior wall faces (the exterior pass only built exterior walls) */
    for (const wl of lv.walls) {
      if (wl.ext) {
        /* inside face of the exterior wall gets drywall so you don't see siding indoors */
        const zAxis = wl.axis === "z";
        const th = 0.02;
        const x0 = zAxis ? (wl.x1 === 0 ? C.wallExt : wl.x1 - C.wallExt - th) : 0;
        const z0 = zAxis ? 0 : (wl.z1 === 0 ? C.wallExt : wl.z1 - C.wallExt - th);
        b.id(`${lid}-${wl.id}-IN`, "wall");
        b.wallRun(x0, z0, wl.len, lv.y, lv.ceilH, th, dry, wl.openings,
                  { axis: wl.axis, tint: wallTint, ao: 0.9 });
        b.endId();
        /* line every reveal so you never see cladding from indoors */
        for (const op of wl.openings) this.emitReveal(b, lv, wl, op, paint);
        continue;
      }
      const zAxis = wl.axis === "z";
      const th = wl.thick;
      const x0 = zAxis ? wl.x1 - th / 2 : Math.min(wl.x1, wl.x2);
      const z0 = zAxis ? Math.min(wl.z1, wl.z2) : wl.z1 - th / 2;
      b.id(`${lid}-${wl.id}`, "wall");
      b.wallRun(x0, z0, wl.len, lv.y, lv.ceilH, th, dry, wl.openings,
                { axis: wl.axis, tint: wallTint, ao: 0.92 });
      b.endId();
    }
    /* door casings, both faces */
    for (const dr of lv.doors) {
      if (dr.ext) continue;
      const zAxis = dr.axis === "z";
      const th = C.wallInt / 2 + 0.03;
      b.id(`${lid}-${dr.id}-CAS`, "trim");
      const To = { tint: [.97, .97, .95], bevel: 0.006, ao: .88 };
      for (const sgn of [-1, 1]) {
        if (zAxis) {
          b.box(dr.x + sgn * th - 0.02, lv.y, dr.z - dr.w / 2 - 0.07, 0.04, dr.h + 0.07, 0.07, paint, To);
          b.box(dr.x + sgn * th - 0.02, lv.y, dr.z + dr.w / 2, 0.04, dr.h + 0.07, 0.07, paint, To);
          b.box(dr.x + sgn * th - 0.02, lv.y + dr.h, dr.z - dr.w / 2 - 0.07, 0.04, 0.07, dr.w + 0.14, paint, To);
        } else {
          b.box(dr.x - dr.w / 2 - 0.07, lv.y, dr.z + sgn * th - 0.02, 0.07, dr.h + 0.07, 0.04, paint, To);
          b.box(dr.x + dr.w / 2, lv.y, dr.z + sgn * th - 0.02, 0.07, dr.h + 0.07, 0.04, paint, To);
          b.box(dr.x - dr.w / 2 - 0.07, lv.y + dr.h, dr.z + sgn * th - 0.02, dr.w + 0.14, 0.07, 0.04, paint, To);
        }
      }
      b.endId();
    }

    /* stairs */
    if (lv.stairs) {
      const s = lv.stairs;
      b.id(`${lid}-ST`, "stair");
      if (s.axis === "x") {
        /* stairs() always climbs along +Z, so an X-axis run has to be turned
           a quarter turn — otherwise the treads lie across the run and you
           can't walk up it */
        b.push(s.x0, lv.y, s.z0 + s.w, Math.PI / 2);
        b.stairs(0, 0, 0, s.w, s.steps, s.rise, s.run, M().wood, { tint: [.85, .78, .68] });
        b.pop();
        /* stringer + handrail + balusters */
        b.box(s.x0 - 0.04, lv.y, s.z0 + s.w, s.len + 0.08, 0.12, 0.04, paint, { tint: [.96, .96, .94] });
        /* balusters land ON the tread they belong to, not on a straight lerp */
        const nb = Math.max(4, Math.round(s.len / 0.42));
        for (let i = 0; i < nb; i++) {
          const bx = s.x0 + (i + 0.5) * (s.len / nb);
          const step = Math.min(s.steps, Math.floor((bx - s.x0) / s.run) + 1);
          b.box(bx - 0.017, lv.y + step * s.rise, s.z0 + s.w + 0.02, 0.034, 0.90, 0.034,
                paint, { tint: [.95, .95, .93], bevel: 0.005 });
        }
        b.box(s.x0 - 0.05, lv.y, s.z0 + s.w + 0.01, 0.09, 1.05, 0.09, M().wood, { tint: [.6, .44, .3], bevel: 0.01 }); // newel
        b.push(0, 0, 0, 0);
        b.pipe(s.x0, lv.y + 0.95, s.z0 + s.w + 0.04, s.x0 + s.len, lv.y + 0.95 + s.steps * s.rise, s.z0 + s.w + 0.04,
               0.026, 8, M().wood, { tint: [.7, .55, .38] });
        b.pop();
      } else {
        b.push(s.x0, lv.y, s.z0, 0);
        b.stairs(0, 0, 0, s.w, s.steps, s.rise, s.run, M().wood, { tint: [.85, .78, .68] });
        b.pop();
      }
      b.endId();
    }
  }
  b.pop();
  const mesh = b.build();
  mesh.assets = b.assets;
  return mesh;
};

/* ========================================================================= */
/* TYPE LIBRARY                                                              */
/* ========================================================================= */
const houseProgram = {
  /* single storey, hall down the middle */
  ranch: () => ({
    levels: [{
      hall: { depth: 1.15, after: 0 },
      bands: [
        { depth: 0.46, rooms: [{ t: "living", w: 2.1 }, { t: "kitchen", w: 1.3 }, { t: "dining", w: 1.1 }] },
        { depth: 0.54, rooms: [{ t: "bedMain", w: 1.7 }, { t: "bath", w: 0.85 }, { t: "bed", w: 1.25 }, { t: "bed", w: 1.25 }] },
      ],
    }],
  }),
  bungalow: () => ({
    levels: [{
      hall: { depth: 1.10, after: 0 },
      bands: [
        { depth: 0.48, rooms: [{ t: "living", w: 1.7 }, { t: "dining", w: 1.15 }] },
        { depth: 0.52, rooms: [{ t: "bedMain", w: 1.4 }, { t: "bath", w: 0.8 }, { t: "kitchen", w: 1.25 }] },
      ],
    }],
  }),
  cottage: () => ({
    levels: [{
      bands: [
        { depth: 0.55, rooms: [{ t: "living", w: 1.5 }, { t: "kitchen", w: 1.0 }] },
        { depth: 0.45, rooms: [{ t: "bedMain", w: 1.5 }, { t: "bath", w: 0.8 }] },
      ],
    }],
  }),
  duplex: () => ({
    levels: [{
      hall: { depth: 1.10, after: 0 },
      bands: [
        { depth: 0.48, rooms: [{ t: "living", w: 1.4 }, { t: "kitchen", w: 1.0 }, { t: "kitchen", w: 1.0 }, { t: "living", w: 1.4 }] },
        { depth: 0.52, rooms: [{ t: "bedMain", w: 1.3 }, { t: "bath", w: 0.75 }, { t: "bath", w: 0.75 }, { t: "bedMain", w: 1.3 }] },
      ],
    }],
  }),
  /* two storey */
  twoUp: (r) => ({
    levels: [
      {
        hall: { depth: 2.35, after: 0 }, stairs: true,
        bands: [
          { depth: 0.50, rooms: [{ t: "living", w: 1.8 }, { t: "office", w: 1.0 }] },
          { depth: 0.50, rooms: [{ t: "kitchen", w: 1.35 }, { t: "dining", w: 1.2 }, { t: "half", w: 0.6 }, { t: "laundry", w: 0.7 }] },
        ],
      },
      {
        hall: { depth: 1.15, after: 0 }, entry: false, backDoor: false,
        bands: [
          { depth: 0.46, rooms: [{ t: "bedMain", w: 1.6 }, { t: "bed", w: 1.2 }] },
          { depth: 0.54, rooms: [{ t: "bed", w: 1.25 }, { t: "bath", w: 0.85 }, { t: "bed", w: 1.25 }] },
        ],
      },
    ],
  }),
  townhouse: () => ({
    levels: [
      { hall: { depth: 2.30, after: 0 }, stairs: true,
        bands: [{ depth: 0.40, rooms: [{ t: "living", w: 1 }] },
                { depth: 0.60, rooms: [{ t: "kitchen", w: 1.2 }, { t: "dining", w: 1.0 }] }] },
      { hall: { depth: 1.10, after: 0 }, entry: false, backDoor: false,
        bands: [{ depth: 0.46, rooms: [{ t: "bedMain", w: 1 }] },
                { depth: 0.54, rooms: [{ t: "bed", w: 1.3 }, { t: "bath", w: 0.9 }] }] },
    ],
  }),
  capeCod: () => ({
    levels: [
      { hall: { depth: 2.25, after: 0 }, stairs: true,
        bands: [{ depth: 0.53, rooms: [{ t: "living", w: 1.6 }, { t: "office", w: 0.9 }] },
                { depth: 0.47, rooms: [{ t: "kitchen", w: 1.3 }, { t: "dining", w: 1.1 }, { t: "half", w: 0.6 }] }] },
      { hall: { depth: 1.10, after: 0 }, entry: false, backDoor: false,
        bands: [{ depth: 0.50, rooms: [{ t: "bedMain", w: 1.5 }, { t: "bed", w: 1.1 }] },
                { depth: 0.50, rooms: [{ t: "bed", w: 1.3 }, { t: "bath", w: 0.85 }] }] },
    ],
  }),
};

const HOUSES = (T.HOUSE_TYPES = {
  ranch:      { label: "Ranch",         w: 15.2, d: 9.8,  roof: "hip",    pitch: 0.42, wallMat: "siding", plan: houseProgram.ranch, porch: null, chimney: true, shutters: true },
  bungalow:   { label: "Bungalow",      w: 11.6, d: 12.2, roof: "gable",  pitch: 0.62, wallMat: "siding", plan: houseProgram.bungalow, porch: { full: true, depth: 2.4 }, chimney: true },
  capeCod:    { label: "Cape Cod",      w: 11.0, d: 8.6,  roof: "gable",  pitch: 0.95, wallMat: "siding", plan: houseProgram.capeCod, dormers: 3, chimney: true, shutters: true },
  colonial:   { label: "Colonial",      w: 12.2, d: 9.2,  roof: "gable",  pitch: 0.70, wallMat: "siding", plan: houseProgram.twoUp, shutters: true, chimney: true },
  farmhouse:  { label: "Farmhouse",     w: 13.0, d: 10.4, roof: "gable",  pitch: 0.80, wallMat: "siding", roofMat: "metalRoof", plan: houseProgram.twoUp, porch: { full: true, depth: 2.6 }, chimney: true },
  victorian:  { label: "Victorian",     w: 10.8, d: 11.6, roof: "gable",  pitch: 1.05, wallMat: "siding", plan: houseProgram.twoUp, porch: { full: true, depth: 2.2, gap: true }, chimney: true, bay: true,
                wallTints: [[.86,.74,.78],[.78,.80,.66],[.72,.66,.78],[.86,.82,.62]] },
  tudor:      { label: "Tudor",         w: 11.8, d: 10.4, roof: "gable",  pitch: 1.10, wallMat: "brick",  plan: houseProgram.twoUp, chimney: true, halfTimber: true,
                wallTints: [[.98,.94,.92],[.92,.88,.86]], gableTint: [.96,.94,.90] },
  modern:     { label: "Modern",        w: 13.4, d: 9.8,  roof: "flat",   pitch: 0,    wallMat: "concrete", plan: houseProgram.twoUp, floorY: 0.18, hood: false,
                wallTints: [[.86,.86,.84],[.62,.60,.58],[.74,.72,.70]], trimTints: [[.22,.22,.24]] },
  splitLevel: { label: "Split Level",   w: 13.6, d: 10.0, roof: "shed",   pitch: 0.34, wallMat: "siding", plan: houseProgram.ranch, chimney: true, split: true },
  cottage:    { label: "Cottage",       w: 8.8,  d: 7.6,  roof: "gable",  pitch: 0.90, wallMat: "siding", plan: houseProgram.cottage, chimney: true, shutters: true },
  aFrame:     { label: "A-Frame",       w: 9.2,  d: 10.6, roof: "gable",  pitch: 1.65, wallMat: "wood",   plan: houseProgram.cottage, floorY: 0.55, aframe: true, hood: false,
                wallTints: [[.78,.62,.44],[.66,.52,.38]] },
  townhouse:  { label: "Townhouse",     w: 7.6,  d: 11.0, roof: "gable",  pitch: 0.75, wallMat: "brick",  plan: houseProgram.townhouse, floorY: 0.55,
                wallTints: [[.92,.86,.82],[.80,.70,.66],[.96,.92,.88]] },
  duplex:     { label: "Duplex",        w: 16.8, d: 9.8,  roof: "hip",    pitch: 0.40, wallMat: "siding", plan: houseProgram.duplex, shutters: true },
});

const CIVIC = (T.CIVIC_TYPES = {
  townHall:   { label: "Town Hall",     w: 18.0, d: 13.0, roof: "hip",   pitch: 0.55, wallMat: "brick", floorY: 0.60, com: true, noAC: true,
                wallTints: [[.94,.90,.86]], trimTints: [[1,1,1]], portico: true,
                plan: () => ({ levels: [
                  { hall: { depth: 2.4, after: 0 }, stairs: true, com: true, entryW: 1.8,
                    bands: [{ depth: .40, rooms: [{ t: "lobby", w: 1 }] },
                            { depth: .60, rooms: [{ t: "officeC", w: 1 }, { t: "assembly", w: 1.8 }, { t: "officeC", w: 1 }] }] },
                  { hall: { depth: 1.4, after: 0 }, entry: false, backDoor: false, com: true,
                    bands: [{ depth: .45, rooms: [{ t: "officeC", w: 1 }, { t: "officeC", w: 1 }] },
                            { depth: .55, rooms: [{ t: "officeC", w: 1 }, { t: "bath", w: .6 }, { t: "officeC", w: 1 }] }] }] }) },
  church:     { label: "Chapel",        w: 12.0, d: 20.0, roof: "gable", pitch: 1.25, wallMat: "siding", floorY: 0.50, com: true, noAC: true, steeple: true,
                wallTints: [[.97,.97,.95]], trimTints: [[1,1,1]],
                plan: () => ({ levels: [{ com: true, entryW: 1.8, backDoor: false,
                  bands: [{ depth: .18, rooms: [{ t: "lobby", w: 1 }] },
                          { depth: .82, rooms: [{ t: "assembly", w: 1 }] }] }] }) },
  school:     { label: "Schoolhouse",   w: 20.0, d: 12.0, roof: "gable", pitch: 0.65, wallMat: "brick", floorY: 0.55, com: true, noAC: true, bell: true,
                wallTints: [[.86,.72,.66]],
                plan: () => ({ levels: [{ hall: { depth: 2.0, after: 0 }, com: true, entryW: 1.8,
                  bands: [{ depth: .42, rooms: [{ t: "classroom", w: 1 }, { t: "lobby", w: .7 }, { t: "classroom", w: 1 }] },
                          { depth: .58, rooms: [{ t: "classroom", w: 1 }, { t: "bath", w: .5 }, { t: "classroom", w: 1 }] }] }] }) },
  fireStn:    { label: "Fire Station",  w: 14.0, d: 13.0, roof: "gable", pitch: 0.5, wallMat: "brick", floorY: 0.20, com: true, noAC: true, bayDoor: true,
                wallTints: [[.80,.52,.46]],
                plan: () => ({ levels: [{ com: true, entryW: 1.0,
                  bands: [{ depth: .70, rooms: [{ t: "bay", w: 2.2 }, { t: "officeC", w: 1 }] },
                          { depth: .30, rooms: [{ t: "workshop", w: 1.4 }, { t: "bath", w: .6 }, { t: "storage", w: .7 }] }] }] }) },
  store:      { label: "General Store", w: 13.0, d: 12.0, roof: "flat",  pitch: 0, wallMat: "brick", floorY: 0.18, com: true, awning: true, sign: "GENERAL STORE",
                wallTints: [[.88,.80,.72]],
                plan: () => ({ levels: [{ com: true, entryW: 1.8,
                  bands: [{ depth: .70, rooms: [{ t: "retail", w: 1 }] },
                          { depth: .30, rooms: [{ t: "storage", w: 1 }, { t: "officeC", w: .8 }, { t: "bath", w: .5 }] }] }] }) },
  diner:      { label: "Diner",         w: 14.0, d: 9.0,  roof: "shed",  pitch: 0.16, wallMat: "metalRoof", floorY: 0.18, com: true, awning: true, sign: "DINER", noAC: false,
                wallTints: [[.92,.92,.92]],
                plan: () => ({ levels: [{ com: true, entryW: 1.2,
                  bands: [{ depth: .68, rooms: [{ t: "diner", w: 1 }] },
                          { depth: .32, rooms: [{ t: "kitchenC", w: 1.4 }, { t: "bath", w: .5 }, { t: "storage", w: .6 }] }] }] }) },
  library:    { label: "Library",       w: 15.0, d: 12.0, roof: "hip",   pitch: 0.5, wallMat: "brick", floorY: 0.55, com: true, noAC: true, portico: true, sign: "LIBRARY",
                wallTints: [[.90,.86,.80]],
                plan: () => ({ levels: [{ hall: { depth: 1.6, after: 0 }, com: true, entryW: 1.6,
                  bands: [{ depth: .40, rooms: [{ t: "lobby", w: 1 }, { t: "officeC", w: .8 }] },
                          { depth: .60, rooms: [{ t: "stacks", w: 1.4 }, { t: "stacks", w: 1.4 }, { t: "bath", w: .5 }] }] }] }) },
  clinic:     { label: "Clinic",        w: 13.0, d: 10.0, roof: "hip",   pitch: 0.45, wallMat: "siding", floorY: 0.25, com: true, sign: "CLINIC",
                wallTints: [[.94,.95,.94]],
                plan: () => ({ levels: [{ hall: { depth: 1.5, after: 0 }, com: true, entryW: 1.2,
                  bands: [{ depth: .42, rooms: [{ t: "lobby", w: 1 }, { t: "officeC", w: .8 }] },
                          { depth: .58, rooms: [{ t: "officeC", w: 1 }, { t: "officeC", w: 1 }, { t: "bath", w: .55 }] }] }] }) },
  postOffice: { label: "Post Office",   w: 12.0, d: 10.0, roof: "flat",  pitch: 0, wallMat: "concrete", floorY: 0.22, com: true, sign: "POST OFFICE",
                wallTints: [[.86,.84,.80]],
                plan: () => ({ levels: [{ com: true, entryW: 1.2,
                  bands: [{ depth: .55, rooms: [{ t: "lobby", w: 1 }] },
                          { depth: .45, rooms: [{ t: "workshop", w: 1.5 }, { t: "officeC", w: .8 }] }] }] }) },
  barn:       { label: "Barn",          w: 14.0, d: 11.0, roof: "gambrel", pitch: 0, wallMat: "siding", floorY: 0.20, com: true, noAC: true,
                wallTints: [[.62,.24,.20],[.55,.22,.18]], trimTints: [[.96,.95,.92]],
                plan: () => ({ levels: [{ com: true, entryW: 1.8,
                  bands: [{ depth: .70, rooms: [{ t: "workshop", w: 1 }] },
                          { depth: .30, rooms: [{ t: "storage", w: 1 }, { t: "storage", w: 1 }] }] }] }) },
});

/* propagate the com flag into the level specs */
for (const K of [HOUSES, CIVIC]) for (const k in K) {
  const d0 = K[k], orig = d0.plan;
  d0.key = k;
  d0.plan = (r) => { const s = orig(r, d0); if (d0.com) for (const l of s.levels) l.com = true; return s; };
}
})();
