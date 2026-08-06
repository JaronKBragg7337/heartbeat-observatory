/* ============================================================================
   debug.js — the inspection layer
   One key (G) turns the world into something you can file a bug against:
   the 4 m grid with cell IDs, every asset's permanent ID, collision boxes,
   and a float / bury report measured against each asset's expected datum.
   ========================================================================== */
(function () {
"use strict";
const T = window.TOWN, C = T.CODE, W = T.World;

const Dbg = (T.Debug = {
  on: false, radius: 34, labels: 60, showColliders: true, showGrid: true,
  findings: [], built: false, hudHidden: false,
});

const COLOR = {
  building: [0.45, 0.85, 1, 0.55], room: [0.45, 1, 0.6, 0.5], wall: [0.55, 0.7, 1, 0.35],
  door: [1, 0.85, 0.3, 0.8], window: [0.6, 0.9, 1, 0.5], stair: [1, 0.6, 1, 0.7],
  tree: [0.5, 1, 0.5, 0.4], car: [1, 0.7, 0.4, 0.5], lamp: [1, 1, 0.6, 0.5],
  furniture: [1, 0.62, 0.9, 0.55],
  collider: [1, 0.35, 0.35, 0.30], bad: [1, 0.15, 0.15, 0.95], grid: [0.45, 0.75, 1, 0.28],
  gridMajor: [0.55, 0.9, 1, 0.55], def: [0.8, 0.8, 0.9, 0.35],
};

/* ---------------------------------------------------------- float / bury - */
Dbg.audit = function () {
  const out = [];
  for (const a of W.assets) {
    if (a.expectY === undefined || a.type === "building") continue;
    const d = a.box[1] - a.expectY;
    if (d > 0.025) out.push({ sev: Math.abs(d) > 0.15 ? "bad" : "warn", id: a.id,
                              msg: `FLOATING ${(d * 1000) | 0}mm above its datum`, asset: a, delta: d });
    else if (d < -0.025) out.push({ sev: Math.abs(d) > 0.15 ? "bad" : "warn", id: a.id,
                              msg: `BURIED ${(-d * 1000) | 0}mm below its datum`, asset: a, delta: d });
  }
  /* collider sanity: a door collider that never clears is a trap */
  for (const d of W.doors)
    if (d.col.y1 - d.col.y0 < C.doorH - 0.05)
      out.push({ sev: "warn", id: d.id, msg: `door collider ${(d.col.y1 - d.col.y0).toFixed(2)}m, expected ${C.doorH}m` });
  Dbg.findings = out;
  Dbg.floatSet = new Set(out.filter((o) => o.asset).map((o) => o.id));
  return out;
};

/* -------------------------------------------------------------- geometry - */
Dbg.buildLines = function (lb, px, pz, py) {
  lb.clear();
  const R = Dbg.radius, g = C.grid;
  if (Dbg.showGrid) {
    const c0 = Math.floor((px - R) / g), c1 = Math.ceil((px + R) / g);
    const r0 = Math.floor((pz - R) / g), r1 = Math.ceil((pz + R) / g);
    const yy = () => 0.03;
    for (let c = c0; c <= c1; c++) {
      const x = c * g, major = c % 8 === 0;
      lb.line(x, yy(), r0 * g, x, yy(), r1 * g, major ? COLOR.gridMajor : COLOR.grid);
    }
    for (let r = r0; r <= r1; r++) {
      const z = r * g, major = r % 8 === 0;
      lb.line(c0 * g, yy(), z, c1 * g, yy(), z, major ? COLOR.gridMajor : COLOR.grid);
    }
    /* the cell you're standing in, lifted so it reads through geometry */
    const gc = T.Town.gridOf(px, pz);
    const bx = gc.col * g, bz = gc.row * g;
    lb.box([bx, 0.05, bz, bx + g, 0.06, bz + g], [1, 0.9, 0.2, 0.9]);
  }

  const R2 = R * R;
  let n = 0;
  for (const a of W.assets) {
    const cx = (a.box[0] + a.box[3]) / 2, cz = (a.box[2] + a.box[5]) / 2;
    const dx = cx - px, dz = cz - pz;
    if (dx * dx + dz * dz > R2) continue;
    if (a.type === "building") continue;
    const bad = Dbg.floatSet && Dbg.floatSet.has(a.id);
    lb.box(a.box, bad ? COLOR.bad : (COLOR[a.type] || COLOR.def));
    if (++n > 900) break;
  }
  if (Dbg.showColliders) {
    let m = 0;
    for (const c of W.colliders) {
      const cx = (c.x0 + c.x1) / 2, cz = (c.z0 + c.z1) / 2;
      const dx = cx - px, dz = cz - pz;
      if (dx * dx + dz * dz > R2) continue;
      lb.box([c.x0, c.y0, c.z0, c.x1, c.y1, c.z1], c.off ? [0.3, 1, 0.5, 0.25] : COLOR.collider);
      if (++m > 700) break;
    }
  }
};

/* --------------------------------------------------------------- labels -- */
const labelPool = [];
Dbg.updateLabels = function (vp, px, pz) {
  const host = document.getElementById("labels");
  if (!Dbg.on) { host.style.display = "none"; return; }
  host.style.display = "block";
  const cands = [];
  const R2 = Dbg.radius * Dbg.radius;
  for (const a of W.assets) {
    if (a.type === "building") continue;
    const cx = (a.box[0] + a.box[3]) / 2, cz = (a.box[2] + a.box[5]) / 2;
    const d = (cx - px) * (cx - px) + (cz - pz) * (cz - pz);
    if (d > R2) continue;
    cands.push({ a, d, cx, cy: (a.box[1] + a.box[4]) / 2, cz });
  }
  cands.sort((u, v) => u.d - v.d);
  const use = cands.slice(0, Dbg.labels);
  while (labelPool.length < use.length) {
    const el = document.createElement("div"); el.className = "lb"; host.appendChild(el); labelPool.push(el);
  }
  const wpx = T.GL.canvas.clientWidth, hpx = T.GL.canvas.clientHeight;
  for (let i = 0; i < labelPool.length; i++) {
    const el = labelPool[i];
    if (i >= use.length) { el.style.display = "none"; continue; }
    const u = use[i];
    const x = u.cx, y = u.cy, z = u.cz;
    const cx2 = vp[0] * x + vp[4] * y + vp[8] * z + vp[12];
    const cy2 = vp[1] * x + vp[5] * y + vp[9] * z + vp[13];
    const cw = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
    if (cw <= 0.1) { el.style.display = "none"; continue; }
    const sx = (cx2 / cw * 0.5 + 0.5) * wpx, sy = (1 - (cy2 / cw * 0.5 + 0.5)) * hpx;
    if (sx < -80 || sy < -20 || sx > wpx + 80 || sy > hpx + 20) { el.style.display = "none"; continue; }
    const bad = Dbg.floatSet && Dbg.floatSet.has(u.a.id);
    el.style.display = "block";
    el.style.left = sx + "px"; el.style.top = sy + "px";
    el.className = "lb" + (bad ? " bad" : u.a.type === "room" ? " room" : "");
    el.textContent = u.a.kind ? `${u.a.id} ${u.a.kind}` : u.a.id;
  }
};

/* ---------------------------------------------------------------- panel -- */
Dbg.panel = function (stats) {
  const p = document.getElementById("dbg");
  p.style.display = Dbg.on ? "block" : "none";
  if (!Dbg.on) return;
  const P = T.Player;
  const g = T.Town.gridOf(P.pos[0], P.pos[2]);
  const room = P.room ? `${P.room.rm.gid}  ${P.room.rm.name}` : "—";
  const rows = [
    ["grid", T.Town.gridId(P.pos[0], P.pos[2])],
    ["world", `${P.pos[0].toFixed(2)}, ${P.pos[1].toFixed(2)}, ${P.pos[2].toFixed(2)}`],
    ["facing", `${((-P.yaw * 180 / Math.PI) % 360 + 360).toFixed(0)}°`],
    ["inside", room],
    ["door", P.nearDoor ? P.nearDoor.id + (P.nearDoor.open > .5 ? " (open)" : " (shut)") : "—"],
    ["fps", stats.fps.toFixed(0)],
    ["draws / tris", `${stats.draws} / ${(stats.tris / 1000).toFixed(0)}k`],
    ["buildings", `${T.Town.buildingCount}  (${stats.interiors} interiors live)`],
    ["assets / colliders", `${W.assets.length} / ${W.colliders.length}`],
    ["static vram", `${(T.Town.staticBytes / 1048576).toFixed(1)} MB`],
    ["texel density", `${T.Mats.siding.density.toFixed(0)} px/m target ${T.TEXEL_TARGET}`],
  ];
  document.getElementById("dbgStats").innerHTML =
    rows.map((r) => `<div class="row"><span>${r[0]}</span><b>${r[1]}</b></div>`).join("");

  const all = Dbg.findings.concat(T.Town.issues || []);
  const bad = all.filter((i) => i.sev === "bad"), warn = all.filter((i) => i.sev !== "bad");
  const near = (i) => {
    if (!i.asset) return 1e9;
    const cx = (i.asset.box[0] + i.asset.box[3]) / 2, cz = (i.asset.box[2] + i.asset.box[5]) / 2;
    return Math.hypot(cx - P.pos[0], cz - P.pos[2]);
  };
  const list = bad.concat(warn).sort((a, b) => near(a) - near(b)).slice(0, 40);
  document.getElementById("dbgIssues").innerHTML =
    (all.length === 0 ? `<div class="iss ok">no violations — ${W.assets.length} assets clean</div>` : "") +
    `<div class="iss ${bad.length ? "bad" : "ok"}">${bad.length} errors · ${warn.length} warnings</div>` +
    list.map((i) => `<div class="iss ${i.sev}">${i.id} — ${i.msg}</div>`).join("");
};

/* ------------------------------------------------------------- teleport -- */
/* accepts:  B07  ·  H07  ·  L0-H14-R8  ·  B07-L1-R03  ·  B07-L0-D02
             G14-09  ·  120,64  ·  TREE0042                              */
Dbg.resolve = function (q) {
  q = (q || "").trim().toUpperCase();
  if (!q) return null;

  let m = q.match(/^G\s*(\d+)\s*[-,: ]\s*(\d+)$/);
  if (m) {
    const [x, z] = T.Town.gridCenter(+m[1], +m[2]);
    return { kind: "grid", x, z, label: `G${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}` };
  }
  m = q.match(/^(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)$/);
  if (m) return { kind: "xz", x: +m[1], z: +m[2], label: `${m[1]}, ${m[2]}` };

  /* normalise the loose forms into the canonical asset id */
  const bn = q.match(/(?:^|[^A-Z])[BH](\d+)/);
  const ln = q.match(/L(\d+)/);
  const rn = q.match(/[-]R(\d+)/) || q.match(/R(\d+)$/);
  const dn = q.match(/[-]([DNWF])(\d+)/);
  if (bn) {
    const bid = "B" + bn[1].padStart(2, "0");
    let id = bid;
    if (ln) id += "-L" + ln[1];
    if (rn) id += "-R" + rn[1].padStart(2, "0");
    else if (dn) id += "-" + dn[1] + dn[2].padStart(2, "0");
    let a = W.assets.find((x) => x.id === id);
    if (!a && ln && !rn && !dn) a = W.assets.find((x) => x.id === bid);
    if (!a) a = W.assets.find((x) => x.id.startsWith(id));
    if (a) return { kind: "asset", asset: a, label: a.id };
  }
  const a2 = W.assets.find((x) => x.id === q) || W.assets.find((x) => x.id.startsWith(q));
  if (a2) return { kind: "asset", asset: a2, label: a2.id };
  return null;
};

Dbg.goto = function (q) {
  const r = Dbg.resolve(q);
  if (!r) return `no match for "${q}"`;
  const P = T.Player;
  if (r.kind === "asset") {
    const b = r.asset.box;
    const cx = (b[0] + b[3]) / 2, cz = (b[2] + b[5]) / 2;
    /* stand inside rooms, stand outside solid things */
    if (r.asset.type === "room" || r.asset.type === "building" || r.asset.type === "porch") {
      P.teleport(cx, cz, b[1] + 0.02);
    } else {
      let ox = cx, oz = cz, found = false;
      for (let rr = 1.2; rr <= 4 && !found; rr += 0.7)
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * 6.283;
          const tx = cx + Math.cos(a) * rr, tz = cz + Math.sin(a) * rr;
          const fy = P.floorAt(tx, tz, b[1] + 1);
          if (!P.blockedAt(tx, tz, fy)) { ox = tx; oz = tz; found = true; break; }
        }
      P.teleport(ox, oz, P.floorAt(ox, oz, b[1] + 1) + 0.02);
      P.yaw = Math.atan2(-(cx - ox), -(cz - oz));
    }
  } else {
    P.teleport(r.x, r.z);
  }
  return `→ ${r.label}`;
};

/* --------------------------------------------------------------- report -- */
Dbg.report = function () {
  const P = T.Player;
  const L = [];
  L.push(`ASHGROVE INSPECTION REPORT   ${new Date().toISOString()}`);
  L.push(`grid ${C.grid}m · origin SW · ${T.Town.buildingCount} buildings · ${W.assets.length} assets`);
  L.push(`observer at ${T.Town.gridId(P.pos[0], P.pos[2])}  (x=${P.pos[0].toFixed(2)} y=${P.pos[1].toFixed(2)} z=${P.pos[2].toFixed(2)})`);
  L.push(`inside ${P.room ? P.room.rm.gid + " " + P.room.rm.name : "outdoors"}`);
  L.push("");
  const all = Dbg.findings.concat(T.Town.issues || []);
  const bad = all.filter((i) => i.sev === "bad");
  const warn = all.filter((i) => i.sev !== "bad");
  L.push(`ERRORS (${bad.length})`);
  for (const i of bad) L.push(`  ${i.id}  ${i.msg}`);
  L.push("");
  L.push(`WARNINGS (${warn.length})`);
  for (const i of warn.slice(0, 200)) L.push(`  ${i.id}  ${i.msg}`);
  if (warn.length > 200) L.push(`  … ${warn.length - 200} more`);
  return L.join("\n");
};

Dbg.coord = function () {
  const P = T.Player;
  const room = P.room ? ` inside ${P.room.rm.gid} (${P.room.rm.name})` : " outdoors";
  const near = W.assets
    .map((a) => ({ a, d: Math.hypot((a.box[0] + a.box[3]) / 2 - P.pos[0], (a.box[2] + a.box[5]) / 2 - P.pos[2]) }))
    .filter((o) => o.a.type !== "building" && o.a.type !== "ground")
    .sort((u, v) => u.d - v.d).slice(0, 3).map((o) => o.a.id).join(", ");
  return `I'm at ${T.Town.gridId(P.pos[0], P.pos[2])} (x=${P.pos[0].toFixed(2)}, y=${P.pos[1].toFixed(2)}, z=${P.pos[2].toFixed(2)}),${room}. Nearest assets: ${near}.`;
};

/* ------------------------------------------------------------------ wire - */
Dbg.wire = function () {
  const inp = document.getElementById("tpIn");
  const go = () => {
    const msg = Dbg.goto(inp.value);
    T.flash(msg);
    inp.blur();
  };
  document.getElementById("tpGo").onclick = go;
  inp.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") go(); });
  inp.addEventListener("keyup", (e) => e.stopPropagation());
  document.getElementById("tpCopy").onclick = () => {
    copy(Dbg.report()); T.flash("inspection report copied");
  };
  document.getElementById("tpHere").onclick = () => { copy(Dbg.coord()); T.flash("coordinate copied"); };
  document.getElementById("bDbg").onclick = () => T.toggleDebug();
};
function copy(s) {
  if (navigator.clipboard) navigator.clipboard.writeText(s).catch(() => fallback(s));
  else fallback(s);
}
function fallback(s) {
  const ta = document.createElement("textarea");
  ta.value = s; document.body.appendChild(ta); ta.select();
  try { document.execCommand("copy"); } catch (e) {}
  ta.remove();
}
})();
