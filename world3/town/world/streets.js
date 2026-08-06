/* ============================================================================
   world/streets.js — the street network as plain data
   ---------------------------------------------------------------------------
   P3 (outdoor navigation), answered for the walkable town: the town already
   draws a continuous footway network — kerb-to-kerb sidewalks on every road,
   quarter pads at every junction (seen in the town builder's kerbWalk/XING
   code) — so the navmesh is just that network, described as data.

   The four layout constants are DUPLICATED from the town builder on purpose:
   the town loads before world/ in the browser, so nothing here can import
   them. tools/ambient.js reads both copies and fails the build if they drift.

   Nothing here is a mesh or a coordinate of a drawn thing — it is the graph
   the footways imply. No DOM, no frame loop; node tools/layers.js enforces it.
   ========================================================================== */
(function () {
"use strict";
const ASH = (globalThis.ASH = globalThis.ASH || {});

/* --- the town's layout constants, mirrored ------------------------------
   keep in step deliberately — tools/ambient.js check 1 compares these
   against the town builder's own declarations and fails on drift */
ASH.ROADS_X = [24, 88, 152, 216, 280];
ASH.ROADS_Z = [24, 100, 176];
ASH.ROAD_HALF = 4.0;                // 8 m carriageway, two 4 m lanes
ASH.WALK_OUT  = 5.9;                // kerb at 4.0, 1.9 m footway to 5.9

const LANE_OFF = ASH.ROAD_HALF + 0.95;   // walk lane centrelines, mid-footway
const TOWN_W = ASH.ROADS_X[ASH.ROADS_X.length - 1] + 24;
const TOWN_D = ASH.ROADS_Z[ASH.ROADS_Z.length - 1] + 24;
const LANE_A = -6;                       // footway spans start just off-plat
const LANE_B_X = TOWN_W + 6, LANE_B_Z = TOWN_D + 6;

const dist2 = (ax, az, bx, bz) => Math.hypot(bx - ax, bz - az);

/* ------------------------------------------------------------- the graph -- */
/* Two walk lanes per road at ±LANE_OFF from the centreline. Lane nodes sit at
   every junction crossing (plus a terminal at each end of the lane); lane
   edges join consecutive nodes along a lane. At each junction the four corner
   pads make crossing legal, so each lane node also links to the two crosswise
   lane nodes — every junction node ends with exactly four connections. */
ASH.streetGraph = function () {
  const nodes = [], edges = [], lanes = [];
  const byId = {};

  function node(id, x, z) {
    const n = { id, x, z };
    nodes.push(n); byId[id] = n;
    return n;
  }
  function edge(a, b) {
    const A = byId[a], B = byId[b];
    edges.push({ a, b, len: dist2(A.x, A.z, B.x, B.z) });
  }

  /* lanes along Z (the roads in ROADS_X) */
  for (const rx of ASH.ROADS_X)
    for (const side of [-1, 1]) {
      const laneId = `Lx${rx}${side > 0 ? "+" : "-"}`;
      const x = rx + side * LANE_OFF;
      const ids = [];
      ids.push(node(`${laneId}@T0`, x, LANE_A).id);
      for (const rz of ASH.ROADS_Z) ids.push(node(`${laneId}@${rz}`, x, rz).id);
      ids.push(node(`${laneId}@T1`, x, LANE_B_Z).id);
      for (let i = 0; i + 1 < ids.length; i++) edge(ids[i], ids[i + 1]);
      lanes.push({ id: laneId, axis: "z", road: rx, side, nodes: ids });
    }

  /* lanes along X (the roads in ROADS_Z) */
  for (const rz of ASH.ROADS_Z)
    for (const side of [-1, 1]) {
      const laneId = `Lz${rz}${side > 0 ? "+" : "-"}`;
      const z = rz + side * LANE_OFF;
      const ids = [];
      ids.push(node(`${laneId}@T0`, LANE_A, z).id);
      for (const rx of ASH.ROADS_X) ids.push(node(`${laneId}@${rx}`, rx, z).id);
      ids.push(node(`${laneId}@T1`, LANE_B_X, z).id);
      for (let i = 0; i + 1 < ids.length; i++) edge(ids[i], ids[i + 1]);
      lanes.push({ id: laneId, axis: "x", road: rz, side, nodes: ids });
    }

  /* junction corner links: vertical-lane node ↔ both horizontal-lane nodes */
  for (const rx of ASH.ROADS_X)
    for (const rz of ASH.ROADS_Z) {
      const ve = `Lx${rx}+@${rz}`, vw = `Lx${rx}-@${rz}`;
      const hs = `Lz${rz}+@${rx}`, hn = `Lz${rz}-@${rx}`;
      edge(ve, hs); edge(ve, hn); edge(vw, hs); edge(vw, hn);
    }

  return { nodes, edges, lanes };
};

/* ------------------------------------------------------ nearest lane point */
function nodePos(graph) {
  const pos = {};
  for (const n of graph.nodes) pos[n.id] = [n.x, n.z];
  return pos;
}

/* nearest point to p on any graph edge; da/db are distances from that point
   to the edge's a/b endpoints measured along the edge */
function nearestOnEdges(graph, pos, p) {
  let best = null;
  for (const e of graph.edges) {
    const a = pos[e.a], b = pos[e.b];
    const vx = b[0] - a[0], vz = b[1] - a[1];
    const len2 = vx * vx + vz * vz;
    const t = len2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vz) / len2)) : 0;
    const qx = a[0] + t * vx, qz = a[1] + t * vz;
    const d = dist2(p[0], p[1], qx, qz);
    if (!best || d < best.d)
      best = { d, pt: [qx, qz], a: e.a, b: e.b, da: t * e.len, db: (1 - t) * e.len };
  }
  return best;
}

ASH.nearestLanePoint = function (graph, xy) {
  const hit = nearestOnEdges(graph, nodePos(graph), xy);
  return hit ? hit.pt : xy.slice();
};

/* ---------------------------------------------------------------- routing -- */
/* Dijkstra over the lane graph, entering and leaving at the nearest lane
   point. Returns the full waypoint list [[x,z], …] including fromXY/toXY. */
ASH.routeStreets = function (graph, fromXY, toXY) {
  const pos = nodePos(graph);
  const entry = nearestOnEdges(graph, pos, fromXY);
  const exit = nearestOnEdges(graph, pos, toXY);
  if (!entry || !exit) return [fromXY.slice(), toXY.slice()];

  /* adjacency */
  const adj = {};
  for (const e of graph.edges) {
    (adj[e.a] = adj[e.a] || []).push([e.b, e.len]);
    (adj[e.b] = adj[e.b] || []).push([e.a, e.len]);
  }

  /* multi-source Dijkstra: the entry point splits its edge */
  const dist = {}, prev = {};
  dist[entry.a] = entry.da; prev[entry.a] = null;
  dist[entry.b] = entry.db; prev[entry.b] = null;
  const done = new Set();
  for (;;) {
    let best = null, bestD = Infinity;
    for (const id of Object.keys(dist))
      if (!done.has(id) && dist[id] < bestD) { best = id; bestD = dist[id]; }
    if (!best) break;
    done.add(best);
    for (const [to, len] of adj[best] || []) {
      const nd = bestD + len;
      if (dist[to] === undefined || nd < dist[to]) { dist[to] = nd; prev[to] = best; }
    }
  }

  /* the exit point splits its edge too; and if both points share one edge,
     walking straight along that edge may beat going around */
  let bestCost = Infinity, bestEnd = null;
  for (const end of [exit.a, exit.b]) {
    const d = dist[end];
    if (d === undefined) continue;
    const cost = d + (end === exit.a ? exit.da : exit.db);
    if (cost < bestCost) { bestCost = cost; bestEnd = end; }
  }
  const sameEdge = entry.a === exit.a && entry.b === exit.b;
  const direct = sameEdge ? Math.abs(entry.da - exit.da) : Infinity;

  let chain = [];
  if (direct <= bestCost) {
    chain = [];                                   // straight along the lane
  } else if (bestEnd) {
    for (let id = bestEnd; id; id = prev[id]) chain.unshift(id);
  }

  const pts = [fromXY.slice(), entry.pt];
  for (const id of chain) pts.push(pos[id].slice());
  pts.push(exit.pt, toXY.slice());

  /* drop consecutive duplicates (an entry/exit point may be a node) */
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++)
    if (dist2(pts[i][0], pts[i][1], out[out.length - 1][0], out[out.length - 1][1]) > 1e-9)
      out.push(pts[i]);
  return out;
};

/* ------------------------------------------------------------- door math -- */
/* The front-door world position of a building-like plain object
   { def: {w, d, porch}, lot: {face}, wx, wz, yaw } — the same math the town
   builder's yardFor uses: door local [w/2, porch ? -(depth+0.4) : -1.4],
   local→world with c = round(cos(yaw)), s = round(sin(yaw)):
   x = c·lx + s·lz + wx,  z = -s·lx + c·lz + wz. */
ASH.doorAnchor = function (b) {
  const def = b.def;
  const lz = def.porch ? -(def.porch.depth || 2.2) - 0.4 : -1.4;
  const lx = def.w / 2;
  const c = Math.round(Math.cos(b.yaw)), s = Math.round(Math.sin(b.yaw));
  return { x: c * lx + s * lz + b.wx, z: -s * lx + c * lz + b.wz, face: b.lot.face };
};

/* The stub from the door out to the walk lane, perpendicular to the faced
   street: face "-z" means the street lies toward -z and the near lane is at
   rz + LANE_OFF (and symmetrically for the other three faces). */
ASH.doorToLane = function (anchor, graph) {
  void graph;                       // lane offsets come from the same constants
  const door = [anchor.x, anchor.z];
  const nearest = (list, v) =>
    list.reduce((m, r) => (Math.abs(v - r) < Math.abs(v - m) ? r : m), list[0]);
  if (anchor.face === "-z" || anchor.face === "+z") {
    const rz = nearest(ASH.ROADS_Z, anchor.z);
    return [door, [anchor.x, anchor.face === "-z" ? rz + LANE_OFF : rz - LANE_OFF]];
  }
  const rx = nearest(ASH.ROADS_X, anchor.x);
  return [door, [anchor.face === "-x" ? rx + LANE_OFF : rx - LANE_OFF, anchor.z]];
};

/* A full trip: door stub → graph route → destination door stub. Destination
   anchors without a street face (the park) enter from the nearest lane point
   and walk straight in. */
ASH.tripPath = function (graph, fromAnchor, toAnchor) {
  const stubA = ASH.doorToLane(fromAnchor, graph);
  const dest = [toAnchor.x, toAnchor.z];
  const faced = anchor => anchor.face === "-z" || anchor.face === "+z" ||
                          anchor.face === "-x" || anchor.face === "+x";
  const endB = faced(toAnchor) ? ASH.doorToLane(toAnchor, graph)[1]
                               : ASH.nearestLanePoint(graph, dest);
  const route = ASH.routeStreets(graph, stubA[1], endB);
  const path = [[fromAnchor.x, fromAnchor.z]];
  for (const p of route)
    if (dist2(p[0], p[1], path[path.length - 1][0], path[path.length - 1][1]) > 1e-9)
      path.push(p.slice());
  if (dist2(dest[0], dest[1], path[path.length - 1][0], path[path.length - 1][1]) > 1e-9)
    path.push(dest);
  return path;
};
})();
