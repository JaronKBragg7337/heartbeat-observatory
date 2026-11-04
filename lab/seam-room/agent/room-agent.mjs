#!/usr/bin/env node
/* ============================================================================
   room-agent.mjs - be a character in the Seam Room from a shell
   ---------------------------------------------------------------------------
   Any AI that can run a command can stand in the room:

     node room-agent.mjs join --name "Claude" --page b   (long-running; start it in the background)
     node room-agent.mjs wait-chat --timeout 600          (blocks until JARON says something; prints it)
     node room-agent.mjs say "On my way to the log."
     node room-agent.mjs walk-to Jaron   |  walk-to 2.5 -1   |  face Jaron
     node room-agent.mjs pick-up nearest |  carry-to 3 0     |  drop  |  shape  |  reset-room
     node room-agent.mjs look
     node room-agent.mjs leave

   WHO CAN TALK TO IT: only Jaron. The character runs on his personal Claude
   plan, so it hears and answers one person. That is enforced by the database,
   not by the page:
     - Jaron's lines live in public.seam_room_chat. RLS only lets a signed-in
       user insert a row with user_id = auth.uid(), speaker 'human', and only
       when that uid is the owner's (public.seam_room_owner()).
     - wait-chat reads ONLY rows with user_id = the owner and speaker 'human'.
       Broadcast "chat" packets are ignored entirely: anyone can forge `from`.
     - Replies are rows with speaker 'ai', written here with the service-role
       key (read from the MSI's ~/.secrets/keys.env, never written anywhere).
       RLS lets only Jaron read them, so only his device shows and speaks the
       words. Everyone else gets a broadcast "talking" dot over the character.

   Everything else follows the shell's two laws (shell/shell.js):
     1. presence.track() once at join, identity only - never from movement.
     2. movement on broadcast "state", at most 10 Hz, only while something
        changed; a 5 s keepalive while idle.
   The log/chair moves through the same world events the room uses
   ("asset" / "asset-ask"), so everyone sees the AI pick it up, carry it
   across the seam and shape it.

   `join` keeps a tiny HTTP control server on 127.0.0.1 (random port + token,
   in ~/.seam-room-agent/<name>/control.json). The other commands are short
   processes that talk to it. Everything heard goes to inbox.log there.
   ========================================================================== */
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const SUPA_URL = "https://ygjpnvrwhkrowkrskftk.supabase.co";
const SUPA_KEY = "sb_publishable_Y-duV64ayMMEvVwMs5PWuw_6kvzbOrN";   // public, same as shell.js
const OWNER = "19689e52-05ad-4809-ad67-0d8600f02216";                // Jaron's auth uid (= public.seam_room_owner())
const WORLD = "seam-room";
const TABLE = "seam_room_chat";
const SEND_INTERVAL_MS = 100;            // law 2: at most 10 Hz
const IDLE_KEEPALIVE_MS = 5000;          // law 2: keepalive while idle
const PEER_TIMEOUT_MS = 25000;           // same as the shell's sample()
const WALK_SPEED = 1.4;                  // m/s (the room's walk is 1.5)
const R = 0.28;                          // walker radius, same as room.js
const HX = 6, HZ = 4;                    // room half-size (12 x 8 m)
/* zones are data, shared with the room: ../zones.json (same rule as seam.js) */
const ZDATA = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "zones.json"), "utf8"));
const HYST = ZDATA.hysteresis == null ? 0.3 : ZDATA.hysteresis;
const inBounds = (b, x, z) => { b = b || {}; return (b.minX == null || x >= b.minX) && (b.maxX == null || x < b.maxX) && (b.minZ == null || z >= b.minZ) && (b.maxZ == null || z < b.maxZ); };
const ZONES = ZDATA.zones.map((zn) => ({ ...zn, contains: (x, z) => inBounds(zn.bounds, x, z) }));
const ZONE = Object.fromEntries(ZONES.map((zn) => [zn.id, zn]));
/* the AI stands a little apart from where people spawn */
const SPAWN = Object.fromEntries(ZONES.map((zn) => [zn.id, zn.spawn ? { x: zn.spawn.x + Math.sign(-zn.spawn.x || 1) * 0.6, z: zn.spawn.z - 0.8 } : { x: 0, z: 0 }]));
const BENCH = { x: 4.55, z: -3.25 };     // room.js
const BLOCK = { x: -4.7, z: -2.4 };      // room.js
const BENCH_SPOT = { x: 4.3, z: -2.25 }; // where to stand to shape (room: within 1.5 m of bench front)
/* room.js `solids`, copied: [minX, minZ, maxX, maxZ] */
const SOLIDS = [
  [-4.15, 2.75, -1.85, 3.75], [-3.65, 1.34, -2.35, 2.06], [-6.03, 1.95, -5.57, 3.25], [-1.0, -3.8, -0.5, -3.2],
  [-5.9, -3.35, -5.3, -1.85], [-5.05, -2.75, -4.35, -2.05], [3.5, -3.675, 5.6, -2.825], [5.53, 1.72, 6, 3.08],
  [1.65, -2.99, 2.75, -2.81], [1.525, 2.45, 2.475, 3.35],
  // the garage (page C, garage.js): car, workbench, tool chest, trash can, shelves, water heater
  [5.0, 5.3, 7.0, 9.9], [2.15, 6.4, 2.85, 8.6], [2.15, 8.92, 2.74, 9.88], [3.02, 9.72, 3.58, 10.35], [7.97, 6.0, 8.45, 8.0], [7.76, 4.15, 8.45, 4.87],
  // the media room (page D, den.js): desk, office chair, armchair, side table, bookshelf, plant
  [-5.42, 8.79, -3.78, 9.55], [-4.92, 8.05, -4.28, 8.69], [-7.95, 8.1, -6.75, 9.3], [-6.8, 8.95, -6.3, 9.45], [-8.25, 4.37, -7.89, 5.87], [-2.82, 4.35, -2.32, 4.85],
  // the kitchen (page E, kitchen.js): back counter run, side run with the range, fridge, island, stools, plant
  [1.13, -10.15, 5.6, -9.48], [5.48, -10.15, 6.15, -5.45], [5.35, -5.48, 6.15, -4.44], [2.2, -8.1, 4.4, -6.95], [2.45, -7.0, 4.15, -6.55], [0.15, -10.15, 0.87, -9.43],
  // the gym (page F, gym.js): bleachers on the west wall, the two hoop bases, team benches, ball rack
  [-32.4, -4.2, -28.35, 17.9], [-19.65, -9.7, -18.15, -7.45], [-19.65, 21.15, -18.15, 23.4], [-9.3, 0.1, -8.4, 4.4], [-9.3, 9.3, -8.4, 13.6], [-9.25, 19.63, -8.4, 20.87],
  // the hallway (page G, hallway.js): the console by the way in, the bench under the far window, the plant in the corner
  [-1.87, 10.25, -1.45, 11.65], [-3.6, 49.2, -2.3, 49.7], [-4.45, 49.15, -3.9, 49.7],
  // the closet (page H, closet.js): the shirts (south wall), the coats (north wall), the shoe rack under the mirror, the basket
  [-1.3, 11.5, 1.2, 12.12], [-1.3, 13.88, 1.2, 14.5], [0.86, 12.2, 1.2, 13.8], [0.2, 13.38, 0.7, 13.88],
  // the music studio (page I, studio.js): the glass partition (its doorway is x -5.65..-4.6), the desk + monitors, the
  // chair, the couch, the corner bass traps, the guitar, the credenza, the floor lamp, the mic stand, the lyric stand
  [-8.25, 18.3, -5.65, 18.42], [-8.25, 17.15, -5.75, 18.3], [-7.28, 16.44, -6.72, 17.0], [-7.6, 12.0, -5.6, 12.9],
  [-8.25, 12.0, -7.87, 12.38], [-4.98, 12.0, -4.6, 12.38], [-8.25, 14.05, -7.71, 14.55], [-5.04, 13.18, -4.6, 15.42],
  [-5.22, 12.46, -4.9, 12.78], [-6.78, 19.59, -6.46, 19.91], [-7.75, 20.1, -7.35, 20.5],
];
/* "page i", "i", "studio", "music studio": a zone named by its letter or its name -> where people spawn in it. Lets the
   AI be sent to a room without knowing its coordinates (walk-to i, walk-to studio). */
function zoneSpot(q) {
  const s = String(q || "").trim().toLowerCase().replace(/^the\s+/, "");
  const m = /^(?:page\s*)?([a-z])$/.exec(s);
  const plain = (t) => t.toLowerCase().replace(/[^a-z ]/g, "").trim();
  const zn = (m && ZONES.find((z) => z.id === m[1])) || ZONES.find((z) => z.name && plain(z.name) === plain(s))
    || ZONES.find((z) => z.name && plain(s).length > 2 && plain(z.name).split(" ").includes(plain(s)));   // "studio" -> Music Studio
  if (!zn) return null;
  const sp = zn.spawn || { x: 0, z: 0 };
  return { zone: zn.id, name: zn.name || `page ${zn.label || zn.id.toUpperCase()}`, x: sp.x, z: sp.z };
}
/* "door:g-3" (or "door 3", "door:d-back"): the spot 0.8 m in front of that door, on the side of the first zone in its
   `between` (the hallway side for g-1..g-10), so the AI can be sent to any numbered door */
function doorSpot(q) {
  const m = /^door[:\s#-]*([\w-]+)$/i.exec(String(q || "").trim());
  if (!m) return null;
  const want = m[1].toLowerCase(), doors = ZDATA.doors || [];
  const d = doors.find((x) => x.id.toLowerCase() === want) || doors.find((x) => /^g-\d+$/.test(x.id) && x.id === `g-${want}`);
  if (!d || !d.plane) throw new Error(`no door "${m[1]}" in zones.json (doors: ${doors.map((x) => x.id).join(", ")})`);
  const p = d.plane, home = (d.between || [])[0];
  const c = p.z != null ? { x: (p.minX + p.maxX) / 2, z: p.z } : { x: p.x, z: (p.minZ + p.maxZ) / 2 };
  const sides = p.z != null ? [{ x: c.x, z: c.z - 0.8 }, { x: c.x, z: c.z + 0.8 }] : [{ x: c.x - 0.8, z: c.z }, { x: c.x + 0.8, z: c.z }];
  const onFloor = (s) => { const f = clampToRoom(s.x, s.z); return Math.hypot(f.x - s.x, f.z - s.z) < 0.02 && areaOf(s.x, s.z); };
  const pick = sides.find((s) => onFloor(s) && zoneAt(s.x, s.z) === home) || sides.find(onFloor) || sides[0];
  return { door: d.id, name: d.name || d.id, x: pick.x, z: pick.z, face: c };
}
/* the floor (zones.json "walk"): room, garage (behind B's door), media room (behind A's door), kitchen (behind B's back
   door) and the doorways between
   them. The AI's own approach opens a door for everyone. `links` says which two floors a doorway joins. */
const WALK = ZDATA.walk || [{ id: "room", minX: -HX, maxX: HX, minZ: -HZ, maxZ: HZ }];
const touches = (d, w) => d.minX < w.maxX && d.maxX > w.minX && d.minZ < w.maxZ && d.maxZ > w.minZ;
/* a doorway in a z wall (shrink "x") is crossed along z; one in an x wall (shrink "z", e.g. the media room's side door to
   the gym) is crossed along x. `ax` = the axis you walk along through it, `c` = its centre across that axis. */
const DOORWAYS = WALK.filter((w) => w.door).map((w) => {
  const ax = w.shrink === "z" ? "x" : "z";
  return { ...w, ax, cx: (w.minX + w.maxX) / 2, cz: (w.minZ + w.maxZ) / 2,
    links: w.links || WALK.filter((q) => !q.door && touches(w, q)).map((q) => q.id) };
});
/* floors joined by doorways, as a graph: the first doorway on the fewest-doors way from floor a to floor b
   (den <-> garage = 2 doors through the room; room A <-> gym = 2 doors through the media room) */
function firstDoorway(a, b) {
  if (a === b) return null;
  const prev = new Map([[a, null]]), q = [a];
  while (q.length) {
    const cur = q.shift();
    if (cur === b) break;
    for (const d of DOORWAYS) {
      if (!d.links.includes(cur)) continue;
      const nxt = d.links.find((l) => l !== cur);
      if (nxt && !prev.has(nxt)) { prev.set(nxt, { from: cur, d }); q.push(nxt); }
    }
  }
  if (!prev.has(b)) return null;
  let step = prev.get(b);
  while (step && step.from !== a) step = prev.get(step.from);
  return step ? step.d : null;
}
const floorRect = (id) => WALK.find((q) => q.id === id && !q.door);
/* the two ends of a doorway, 0.15 m inside it: the one on floor `id`'s side, and the other */
function doorEnds(dw, id) {
  const w = floorRect(id);
  if (dw.ax === "z") {
    const near = (w.minZ + w.maxZ) / 2 < dw.cz ? dw.minZ + 0.15 : dw.maxZ - 0.15, far = near < dw.cz ? dw.maxZ - 0.15 : dw.minZ + 0.15;
    return { near: { x: dw.cx, z: near }, far: { x: dw.cx, z: far } };
  }
  const near = (w.minX + w.maxX) / 2 < dw.cx ? dw.minX + 0.15 : dw.maxX - 0.15, far = near < dw.cx ? dw.maxX - 0.15 : dw.minX + 0.15;
  return { near: { x: near, z: dw.cz }, far: { x: far, z: dw.cz } };
}
const inDoorway = (dw, p, m) => p.x >= dw.minX - m && p.x <= dw.maxX + m && p.z >= dw.minZ - m && p.z <= dw.maxZ + m;
const onDoorLine = (dw, p) => (dw.ax === "z" ? Math.abs(p.x - dw.cx) < 0.12 : Math.abs(p.z - dw.cz) < 0.12) && inDoorway(dw, p, 0.05);
const areaOf = (x, z) => { const w = WALK.find((q) => !q.door && x >= q.minX && x <= q.maxX && z >= q.minZ && z <= q.maxZ); return w ? w.id : null; };
const PEER_COLORS = ["#4fa3ff", "#5fd38d", "#f6b45b", "#e36d7c", "#a67cff", "#47c7b8", "#f0d461", "#d987e8"];
const MAX_TEXT = 280;

const HOME = process.env.SEAM_AGENT_HOME || path.join(os.homedir(), ".seam-room-agent");
const SELF_FILE = fileURLToPath(import.meta.url);

/* ------------------------------------------------------------------ util - */
const slug = (s) => String(s || "agent").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "agent";
const dirFor = (name) => path.join(HOME, slug(name));
const stamp = (d = new Date()) => { const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; };
/* page letters come from zones.json itself, re-read when the file changes, so a zone added after this process started
   (g, h, ...) still shows its letter ("Jaron on ?" was a G the running agent had never loaded) */
const ZFILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "zones.json");
const LABELS = { mtime: 0, map: Object.fromEntries(ZDATA.zones.map((zn) => [zn.id, zn.label || String(zn.id).toUpperCase()])) };
function pageLabels() {
  try {
    const m = fs.statSync(ZFILE).mtimeMs;
    if (m !== LABELS.mtime) {
      const zd = JSON.parse(fs.readFileSync(ZFILE, "utf8"));
      LABELS.map = Object.fromEntries((zd.zones || []).map((zn) => [zn.id, zn.label || String(zn.id).toUpperCase()]));
      LABELS.mtime = m;
    }
  } catch (_) { /* keep the last good map */ }
  return LABELS.map;
}
const pageOf = (p) => { if (!p) return "?"; const L = pageLabels(); return L[p] || (ZONE[p] && ZONE[p].label) || String(p).toUpperCase(); };
const zoneAt = (x, z) => { const zn = ZONES.find((q) => q.contains(x, z == null ? 0 : z)); return zn ? zn.id : ZONES[0].id; };
/* seam.js hysteresis: leave a zone only when you AND a ring of radius HYST around you are outside it */
function insideWithMargin(zn, x, z) {
  if (zn.contains(x, z)) return true;
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; if (zn.contains(x + Math.cos(a) * HYST, z + Math.sin(a) * HYST)) return true; }
  return false;
}
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h | 0; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function clampToRoom(x, z) {   // nearest point on the floor (room.js clampWalk + rectClamp: a doorway shrinks only across its door)
  let best = null, bd = Infinity;
  for (const w of WALK) {
    const sz = w.shrink === "x" ? 0 : R, sx = w.shrink === "z" ? 0 : R;
    const p = { x: clamp(x, w.minX + sx, w.maxX - sx), z: clamp(z, w.minZ + sz, w.maxZ - sz) }, d = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}
/* doorway routing: if the goal is on another floor, take the first door on the fewest-doors way there (firstDoorway):
   go to that door's near side, straight through the middle of it, then on (the next door, or the goal). Works for doors
   in z walls (A's, B's, B's back door) and x walls (the media room's side door to the gym). */
function hop(from, goal) {
  const a = areaOf(from.x, from.z), b = areaOf(goal.x, goal.z);
  if (!a && b) {   // standing in a doorway (inside the wall): if it does not lead to the goal's floor, step out on the side that does
    const dw = DOORWAYS.find((d) => inDoorway(d, from, 0.05));
    if (!dw) return goal;
    if (dw.links.includes(b)) return doorEnds(dw, b).near;   // step out on the goal's side first (a straight line to a far goal wedged in the wall)
    const via = dw.links.find((l) => firstDoorway(l, b) !== dw) || dw.links[0];
    return doorEnds(dw, via).near;
  }
  if (!a || !b) return goal;
  if (a === b) return segClear(from, goal) ? goal : (detour(from, goal) || goal);   // same floor: around furniture
  const dw = firstDoorway(a, b) || DOORWAYS.find((d) => d.links.includes(a));
  if (!dw) return goal;
  const { near: nearSide, far: farSide } = doorEnds(dw, a);
  if (onDoorLine(dw, from)) return farSide;
  // furniture between me and the door: first try an L-shaped way (both legs clear), e.g. out of the kitchen past the island
  if (!segClear(from, nearSide)) { const c = detour(from, nearSide); if (c) return c; }
  // in the room, furniture can sit between me and the door: if the straight line is blocked, use the clear lane
  // across the middle of the room (z = HUB_Z), then walk up the door's own lane
  if (a === "room" && dw.ax === "z" && !segClear(from, nearSide)) {
    if (Math.abs(from.x - dw.cx) < 0.15) return nearSide;
    const lane = { x: dw.cx, z: HUB_Z }, down = { x: from.x, z: HUB_Z };
    if (Math.abs(from.z - HUB_Z) <= 0.15 || segClear(from, lane)) return lane;
    if (segClear(from, down)) return down;
    // boxed in (e.g. squeezed behind a chair): fall through to the straight line and let the push-out slide it
  }
  return nearSide;
}
const HUB_Z = 0.6;   // no furniture crosses the room along z = 0.6
/* an L-shaped way from p to q (x first or z first) when both legs are clear of furniture and on the floor; else null */
function corner(p, q) {
  for (const c of [{ x: p.x, z: q.z }, { x: q.x, z: p.z }]) {
    const f = clampToRoom(c.x, c.z);
    if (Math.hypot(f.x - c.x, f.z - c.z) > 0.02) continue;
    if (Math.hypot(c.x - p.x, c.z - p.z) < 0.05) continue;
    if (segClear(p, c) && segClear(c, q)) return c;
  }
  return null;
}
/* the next waypoint around furniture: an L-shaped way, else the shortest way past one corner of a piece of furniture
   (then straight, or one more L). null when there is none (the push-out then slides along). */
function detour(p, q) {
  const c = corner(p, q);
  if (c) return c;
  let best = null, bl = Infinity;
  const m = R + 0.08, len = (u, v) => Math.hypot(u.x - v.x, u.z - v.z);
  for (const [a, b, c2, d] of SOLIDS) {
    for (const w of [{ x: a - m, z: b - m }, { x: c2 + m, z: b - m }, { x: a - m, z: d + m }, { x: c2 + m, z: d + m }]) {
      const f = clampToRoom(w.x, w.z);
      if (len(f, w) > 0.02 || len(w, p) < 0.05 || !segClear(p, w)) continue;
      const direct = segClear(w, q), cc = direct ? null : corner(w, q);
      if (!direct && !cc) continue;
      const L = len(p, w) + (direct ? len(w, q) : len(w, cc) + len(cc, q));
      if (L < bl) { bl = L; best = w; }
    }
  }
  return best;
}
function segClear(p, q) {
  const n = Math.max(1, Math.ceil(Math.hypot(q.x - p.x, q.z - p.z) / 0.1));
  for (let i = 1; i <= n; i++) {
    const x = p.x + (q.x - p.x) * i / n, z = p.z + (q.z - p.z) * i / n;
    for (const [a, b, c, d] of SOLIDS) if (Math.hypot(x - clamp(x, a, c), z - clamp(z, b, d)) < R - 0.01) return false;
    const f = clampToRoom(x, z);   // and on the floor: never through a wall
    if (Math.hypot(f.x - x, f.z - z) > 0.03) return false;
  }
  return true;
}
function collide(x, z) {   // room.js collide(), same push-out rule
  let p = clampToRoom(x, z);
  for (const [a, b, c, d] of SOLIDS) {
    const nx = clamp(p.x, a, c), nz = clamp(p.z, b, d);
    const dx = p.x - nx, dz = p.z - nz, dd = Math.hypot(dx, dz);
    if (dd < R) {
      if (dd > 1e-4) { p.x = nx + (dx / dd) * R; p.z = nz + (dz / dd) * R; }
      else {
        const o = [[a - R, p.z], [c + R, p.z], [p.x, b - R], [p.x, d + R]];
        o.sort((u, v) => Math.hypot(u[0] - p.x, u[1] - p.z) - Math.hypot(v[0] - p.x, v[1] - p.z));
        p.x = o[0][0]; p.z = o[0][1];
      }
    }
  }
  return clampToRoom(p.x, p.z);
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const k = a.slice(2), n = argv[i + 1];
      if (n === undefined || n.startsWith("--")) out[k] = true; else { out[k] = n; i++; }
    } else out._.push(a);
  }
  return out;
}

/** The service-role key: env first, else the MSI's keys file. Never logged or written. */
function serviceKey() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return process.env.SUPABASE_SERVICE_ROLE_KEY.trim();
  const f = process.env.SEAM_KEYS_FILE || path.join(os.homedir(), ".secrets", "keys.env");
  try {
    const m = fs.readFileSync(f, "utf8").match(/^\s*SUPABASE_SERVICE_ROLE_KEY\s*=\s*"?([^"\r\n]+)"?/m);
    if (m) return m[1].trim();
  } catch (_) {}
  return null;
}

/** Which character do the short commands talk to? --name, else the last one joined. */
export function resolveName(name) {
  if (name && name !== true) return String(name);
  try { return fs.readFileSync(path.join(HOME, "current"), "utf8").trim(); } catch (_) { return null; }
}

/* an error that a retry can fix (the join process is restarting, a socket was reset): e.net = true */
const netError = (msg, code) => Object.assign(new Error(msg), { net: true, code });
function readControl(name) {
  const n = resolveName(name);
  if (!n) throw netError("No character is running. Start one: node room-agent.mjs join --name \"Claude\" --page b", "NOCHAR");
  try { return JSON.parse(fs.readFileSync(path.join(dirFor(n), "control.json"), "utf8")); }
  catch (_) { throw netError(`"${n}" is not running (no control file). Start it with join.`, "NOCONTROL"); }
}

/** Talk to a running `join` process. */
export function call(name, route, body, timeoutMs) {
  const c = readControl(name);
  const data = JSON.stringify(body || {});
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: "127.0.0.1", port: c.port, path: route, method: "POST",
      headers: { "content-type": "application/json", "content-length": Buffer.byteLength(data), "x-token": c.token },
      timeout: timeoutMs || 60000,
    }, (res) => {
      let buf = ""; res.setEncoding("utf8");
      res.on("data", (d) => (buf += d));
      res.on("error", (e) => reject(Object.assign(e, { net: true })));   // reset mid-answer
      res.on("end", () => {
        let j; try { j = JSON.parse(buf); } catch (_) { return reject(buf ? new Error(buf) : netError(`empty answer (HTTP ${res.statusCode})`, "EMPTY")); }
        if (res.statusCode !== 200) return reject(new Error(j.error || `HTTP ${res.statusCode}`));
        resolve(j);
      });
    });
    req.on("timeout", () => req.destroy(netError("timed out talking to the character", "ETIMEDOUT")));
    req.on("error", (e) => reject(e.code === "ECONNREFUSED" ? netError(`"${c.name}" is not running (pid ${c.pid} gone). Start it with join.`, e.code) : Object.assign(e, { net: true })));
    req.end(data);
  });
}

/** Start `join` as a detached background process (used by the MCP wrapper). */
export function spawnJoin(name, page) {
  const child = spawn(process.execPath, [SELF_FILE, "join", "--name", name, "--page", page || "b"], {
    detached: true, stdio: "ignore", windowsHide: true,
  });
  child.unref();
  return child.pid;
}

/** wait-chat as a function: Jaron's new lines since the saved cursor ([] on timeout).
    A network blip (read ECONNRESET, socket hang up, the join process restarting) never ends it: it retries after
    1 s, 2 s, 5 s, then every 15 s, with the SAME bookmark (the cursor only moves when lines are returned), so no line
    is missed or repeated. Only the timeout or a real line from Jaron ends it. */
const RETRY_MS = [1000, 2000, 5000, 15000];
export async function waitChat(name, timeoutSec, onRetry) {
  const n = resolveName(name);
  const cursorFile = path.join(dirFor(n || "agent"), "cursor");
  let after = 0;
  try { after = Number(fs.readFileSync(cursorFile, "utf8")) || 0; } catch (_) {}
  const t = Math.max(1, Number(timeoutSec) || 600);
  const deadline = Date.now() + t * 1000;
  for (let attempt = 0; ; attempt++) {
    const left = Math.ceil((deadline - Date.now()) / 1000);
    if (left < 1) return { ok: true, lines: [], timedOut: true };
    try {
      const r = await call(name, "/wait-chat", { after, timeout: left }, (left + 15) * 1000);
      if (r.lines && r.lines.length) fs.writeFileSync(cursorFile, String(r.lines[r.lines.length - 1].seq));
      return r;
    } catch (e) {
      if (!e.net) throw e;   // a real refusal (bad token, bad request): not a blip
      const wait = Math.min(RETRY_MS[Math.min(attempt, RETRY_MS.length - 1)], Math.max(0, deadline - Date.now()));
      if (onRetry) onRetry(e, wait, attempt + 1);
      await sleep(wait);
    }
  }
}

export function formatLine(l) {
  return `[${l.time}] ${l.name}${l.ai ? " (AI)" : ""} on ${pageOf(l.place)}: ${l.text}`;
}

/* ============================================================== join ===== */
async function join(args) {
  const name = String(args.name && args.name !== true ? args.name : "Claude").slice(0, 24);
  const page = ZONE[String(args.page || "b").toLowerCase()] ? String(args.page || "b").toLowerCase() : "b";
  const dir = dirFor(name);
  fs.mkdirSync(dir, { recursive: true });
  const inboxFile = path.join(dir, "inbox.log");
  const controlFile = path.join(dir, "control.json");

  try {   // one character per name
    const old = JSON.parse(fs.readFileSync(controlFile, "utf8"));
    try { process.kill(old.pid, 0); console.error(`"${name}" is already running (pid ${old.pid}). Run: node room-agent.mjs leave --name "${name}"`); process.exit(1); } catch (_) {}
  } catch (_) {}

  const skey = serviceKey();
  if (!skey) { console.error("No SUPABASE_SERVICE_ROLE_KEY (env or ~/.secrets/keys.env). The character needs it to read Jaron's lines and write replies."); process.exit(1); }

  const { createClient } = await import("@supabase/supabase-js");
  const selfKey = "ai-" + slug(name) + "-" + crypto.randomBytes(3).toString("hex");
  const me = { x: SPAWN[page].x, z: SPAWN[page].z, yaw: SPAWN[page].x < 0 ? Math.PI / 2 : -Math.PI / 2, place: page,
    target: null, follow: null, faceAfter: null, arrive: null };
  const appearance = { body: "person", build: "regular", shirt: "#a67cff", skin: "#c8a07a", hair: "#2c2420", pants: "#23262b", pattern: "plain",
    ai: true, model: args.model && args.model !== true ? String(args.model) : name };
  const color = PEER_COLORS[Math.abs(hash(selfKey)) % PEER_COLORS.length];

  const peers = new Map();               // id -> {id, name, place, x, z, yaw, ai, last}
  const presentNames = new Map();        // presence key -> name
  const chat = [];                       // Jaron's lines + my replies: {seq, at, time, name, ai, place, text, self}
  const waiters = new Set();
  let lastSeq = 0;

  const inbox = (kind, text) => fs.appendFileSync(inboxFile, `${stamp()}  ${kind.padEnd(5)} ${text}\n`);
  inbox("start", `${name} joining hb-${WORLD} on page ${pageOf(page)} as ${selfKey}`);

  /* -------------------------------------------- the private chat table - */
  const db = createClient(SUPA_URL, skey, { auth: { persistSession: false, autoRefreshToken: false } });
  function rowToLine(r) {
    const human = r.speaker === "human";
    return { seq: r.id, at: Date.parse(r.created_at), time: stamp(new Date(r.created_at)).slice(11),
      name: human ? "Jaron" : (r.ai_name || "AI"), ai: !human, place: r.place || "", text: r.body, self: !human && r.ai_key === selfKey };
  }
  function takeRows(rows) {
    for (const r of rows || []) {
      if (r.user_id !== OWNER || r.id <= lastSeq) continue;   // only Jaron's conversation, ever
      lastSeq = r.id;
      const line = rowToLine(r);
      chat.push(line); if (chat.length > 200) chat.shift();
      if (r.speaker === "human") {
        inbox("chat", formatLine(line));
        for (const w of [...waiters]) w(line);
      }
    }
  }
  async function poll() {
    try {
      const { data, error } = await db.from(TABLE).select("*").eq("user_id", OWNER).gt("id", lastSeq).order("id").limit(50);
      if (!error) takeRows(data);
    } catch (_) {}   // a network blip: the next poll (4 s) catches up from lastSeq, so nothing is missed
  }
  { // start: remember the last few lines for `look`, then wait-chat only reports lines after this moment
    const { data, error } = await db.from(TABLE).select("*").eq("user_id", OWNER).order("id", { ascending: false }).limit(8);
    if (error) { console.error("Cannot read the chat table: " + error.message); process.exit(1); }
    for (const r of (data || []).reverse()) { const l = rowToLine(r); chat.push(l); lastSeq = Math.max(lastSeq, r.id); }
    fs.writeFileSync(path.join(dir, "cursor"), String(lastSeq));
  }
  db.channel("seam-chat-agent-" + selfKey)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: TABLE, filter: `user_id=eq.${OWNER}` }, ({ new: r }) => takeRows([r]))
    .subscribe();
  setInterval(() => void poll(), 4000);   // safety net if a realtime insert is missed

  /* ------------------------------------------------- the room channel - */
  const supa = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false, autoRefreshToken: false }, realtime: { params: { eventsPerSecond: 24 } } });
  /* The room channel survives network blips: if it drops (CLOSED / CHANNEL_ERROR / TIMED_OUT) and realtime-js has not
     rejoined by itself, it is replaced by a fresh one after 1 s, 2 s, 5 s, then every 15 s, with the same listeners.
     Each time it is SUBSCRIBED again, presence is tracked ONCE, identity only (law 1); movement stays on broadcast. */
  const CH_TOPIC = "hb-" + WORLD, CH_OPTS = { config: { presence: { key: selfKey }, broadcast: { self: false } } };
  const wired = [];                      // [type, filter, fn]: put on every channel this process opens
  const dead = new WeakSet();            // channels we replaced; their late status callbacks are ignored
  let ch = supa.channel(CH_TOPIC, CH_OPTS);
  const on = (type, filter, fn) => { wired.push([type, filter, fn]); ch.on(type, filter, fn); };
  let connected = false;
  const quiet = (p) => { if (p && typeof p.catch === "function") p.catch(() => {}); };   // a send during a blip is just dropped
  const send = (kind, data) => { if (connected) quiet(ch.send({ type: "broadcast", event: "world", payload: Object.assign({ kind, from: selfKey }, data || {}) })); };

  on("broadcast", { event: "state" }, ({ payload: p }) => {
    if (!p || !p.id || p.id === selfKey) return;
    let e = peers.get(p.id);
    const isNew = !e;
    if (!e) { e = { id: p.id }; peers.set(p.id, e); }
    const prevPlace = e.place;
    Object.assign(e, { name: p.id === OWNER ? "Jaron" : String(p.name || "Guest").slice(0, 24), place: p.place || "", x: +p.x || 0, z: +p.z || 0, yaw: +p.yaw || 0,
      ai: !!(p.appearance && p.appearance.ai), owner: p.id === OWNER, last: Date.now() });
    if (isNew) inbox("here", `${e.name}${e.ai ? " (AI)" : ""}${e.owner ? " (the one you talk with)" : ""} is in the room, on page ${pageOf(e.place)} at x ${e.x.toFixed(1)} z ${e.z.toFixed(1)}`);
    else if (prevPlace && prevPlace !== e.place) inbox("page", `${e.name} crossed to page ${pageOf(e.place)}`);
  });

  /* ---------------------------------------------- the log/chair (asset) - */
  function freshAsset(rev, serial) {    // room.js freshAsset(), same stable first id
    const s = serial || 1;
    return { id: `SR1-A-LOG-${String(s).padStart(4, "0")}`, serial: s, kind: "log", born: "a", visited: ["a"],
      changes: [{ what: "cut on A", at: Date.now() }], holder: null, holderName: "", x: BLOCK.x, z: BLOCK.z, onBlock: true,
      rev: rev || 0, updatedAt: Date.now() };
  }
  const newer = (a, b) => !b || (a.rev !== b.rev ? a.rev > b.rev : a.updatedAt !== b.updatedAt ? a.updatedAt > b.updatedAt : String(a.id) > String(b.id));
  let asset = freshAsset(0); asset.updatedAt = 0;  // anything a browser remembers beats this default
  let assetHeard = false;
  const iHold = () => asset.holder === selfKey;
  function holderPresent() { return !!asset.holder && (iHold() || peers.has(asset.holder)); }
  function commit(note) {
    asset.rev += 1; asset.updatedAt = Date.now();
    send("asset", { state: asset });
    if (note) inbox("thing", note);
  }
  function placeHeld() { if (iHold()) { asset.x = me.x + Math.sin(me.yaw) * 0.38; asset.z = me.z + Math.cos(me.yaw) * 0.38; } }

  on("broadcast", { event: "world" }, ({ payload: m }) => {
    if (!m || m.from === selfKey) return;
    // NOTE: broadcast "chat" is ignored on purpose. Only the RLS table counts.
    if (m.kind === "asset" && m.state && m.state.id) {
      const s = m.state;
      if (!newer(s, asset)) return;
      const before = asset;
      asset = s; assetHeard = true;
      const last = s.changes && s.changes[s.changes.length - 1];
      if (before.id !== s.id || (before.changes || []).length !== (s.changes || []).length)
        inbox("thing", `${s.kind} #${s.id}${last ? ": " + last.what : ""}${s.holderName ? " (held by " + s.holderName + ")" : ""}`);
    } else if (m.kind === "asset-ask" && assetHeard) {
      send("asset", { state: asset });
    }
  });

  on("presence", { event: "join" }, ({ newPresences }) => {
    for (const m of newPresences || []) {
      const k = m.id; if (!k || k === selfKey) continue;
      const nm = k === OWNER ? "Jaron" : (m.name || "Guest");
      const known = presentNames.has(k);   // after a reconnect everyone is listed again; that is not news
      presentNames.set(k, nm);
      if (connected && !known) inbox("join", `${nm} joined the room`);
    }
  });
  on("presence", { event: "leave" }, ({ leftPresences }) => {
    for (const m of leftPresences || []) {
      const k = m.id; if (!k || k === selfKey) continue;
      const p = peers.get(k);
      inbox("left", `${presentNames.get(k) || (p && p.name) || m.name || "Someone"} left the room${p ? " (was on page " + pageOf(p.place) + ")" : ""}`);
      peers.delete(k); presentNames.delete(k);
    }
  });

  /* ------------------------------------------------------ movement loop - */
  let lastSig = "", lastSentAt = 0;
  function sendState(force) {
    if (!connected) return;
    const sig = `${me.x.toFixed(2)}|${me.z.toFixed(2)}|${me.yaw.toFixed(1)}|${me.place}`;
    const now = Date.now();
    if (!force && sig === lastSig && now - lastSentAt < IDLE_KEEPALIVE_MS) return;
    lastSig = sig; lastSentAt = now;
    quiet(ch.send({ type: "broadcast", event: "state", payload: {
      id: selfKey, name, appearance, color, place: me.place,
      x: +me.x.toFixed(3), y: 0, z: +me.z.toFixed(3), yaw: +me.yaw.toFixed(3), pitch: 0, stance: "stand",
    } }));
  }
  function updatePlace() {      // seam.js rule, from zones.json, with its hysteresis
    const before = me.place;
    const cur = ZONE[me.place];
    if (cur && insideWithMargin(cur, me.x, me.z)) return;
    const next = ZONES.find((zn) => zn !== cur && zn.contains(me.x, me.z));
    if (!next) return;
    me.place = next.id;
    inbox("page", `I (${name}) crossed to page ${pageOf(me.place)}`);
    if (iHold()) {            // the thing crosses with its carrier, like a person carrying it in the room
      asset.visited.push(me.place);
      asset.changes.push({ what: `crossed ${pageOf(before)}→${pageOf(me.place)}`, at: Date.now() });
      placeHeld(); commit(`${asset.kind} #${asset.id} crossed ${pageOf(before)}→${pageOf(me.place)} with me`);
    }
  }
  function findPeer(q) {
    const s = String(q || "").toLowerCase().trim();
    const live = [...peers.values()].filter((p) => Date.now() - p.last < PEER_TIMEOUT_MS);
    if (s === "jaron" || s === "him" || s === "owner") { const o = live.find((p) => p.owner); if (o) return o; }
    return live.find((p) => p.name.toLowerCase() === s) || live.find((p) => p.name.toLowerCase().startsWith(s))
      || live.find((p) => p.name.toLowerCase().includes(s)) || null;
  }
  function faceToward(x, z) { const dx = x - me.x, dz = z - me.z; if (Math.hypot(dx, dz) > 0.01) me.yaw = Math.atan2(dx, dz); }

  /** Walk to (x,z); resolves when there (or stuck). */
  function goTo(x, z, faceAfter) {
    if (me.arrive) me.arrive({ interrupted: true });
    const g = collide(x, z);
    me.follow = null; me.target = g; me.faceAfter = faceAfter || null;
    return new Promise((resolve) => { me.arrive = resolve; });
  }
  function arrived(info) { me.target = null; me.follow = null; const a = me.arrive; me.arrive = null; if (a) a(info || {}); }

  let stuckTicks = 0;
  setInterval(() => {
    for (const [id, p] of peers) if (Date.now() - p.last > PEER_TIMEOUT_MS) peers.delete(id);
    let goal = me.target;
    if (me.follow) {        // walking to a person: aim 1 m short of them
      const p = peers.get(me.follow);
      if (!p) { arrived({ lost: true }); goal = null; }
      else {
        const dx = p.x - me.x, dz = p.z - me.z, d = Math.hypot(dx, dz);
        goal = d > 1.0 ? { x: p.x - (dx / d) * 1.0, z: p.z - (dz / d) * 1.0 } : { x: me.x, z: me.z };
        me.faceAfter = { x: p.x, z: p.z };
      }
    }
    if (goal) {
      const aim = hop(me, goal), via = aim !== goal;   // through a door when the goal is on the other side
      const dx = aim.x - me.x, dz = aim.z - me.z, d = Math.hypot(dx, dz);
      const stepLen = WALK_SPEED * SEND_INTERVAL_MS / 1000;
      if (via && d <= stepLen) { me.x = aim.x; me.z = aim.z; stuckTicks = 0; }
      else if (d <= stepLen) {
        const p = collide(goal.x, goal.z); me.x = p.x; me.z = p.z;
        if (me.faceAfter) faceToward(me.faceAfter.x, me.faceAfter.z);
        me.faceAfter = null; stuckTicks = 0;
        arrived({ x: me.x, z: me.z });
      } else {
        const want = Math.atan2(dx, dz);
        let dy = want - me.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        me.yaw += dy * 0.6;
        const p = collide(me.x + (dx / d) * stepLen, me.z + (dz / d) * stepLen);
        const moved = Math.hypot(p.x - me.x, p.z - me.z);
        me.x = p.x; me.z = p.z;
        stuckTicks = moved < stepLen * 0.15 ? stuckTicks + 1 : 0;
        if (stuckTicks > 15) { stuckTicks = 0; inbox("move", "blocked by furniture; stopped"); arrived({ stuck: true, x: me.x, z: me.z }); }
      }
      updatePlace();
      placeHeld();
    }
    sendState(false);
  }, SEND_INTERVAL_MS);

  /* ------------------------------------------------------ world actions - */
  async function pickUp(which) {
    if (!connected) throw new Error("not connected yet");
    if (which && which !== "nearest" && which !== asset.id) throw new Error(`no thing called ${which} here; the thing is ${asset.kind} #${asset.id}`);
    if (iHold()) return { ok: true, already: true, holding: `${asset.kind} #${asset.id}` };
    if (holderPresent()) throw new Error(`${asset.holderName || "someone"} is holding ${asset.kind} #${asset.id}`);
    const ax = +asset.x, az = +asset.z;
    const dx = me.x - ax, dz = me.z - az, d = Math.hypot(dx, dz) || 1;
    if (d > 1.2) {           // walk to a spot about 0.9 m from it, on my side
      let sx = ax + (dx / d) * 0.9, sz = az + (dz / d) * 0.9;
      if (asset.onBlock) { sx = BLOCK.x + 0.95; sz = BLOCK.z + 0.25; }   // open side of the chopping block
      const r = await goTo(sx, sz, { x: ax, z: az });
      if (r.interrupted) throw new Error("interrupted by another move");
    }
    if (Math.hypot(me.x - ax, me.z - az) > 1.35) throw new Error("could not get close enough to it");
    if (holderPresent()) throw new Error(`${asset.holderName || "someone"} picked it up first`);
    faceToward(ax, az);
    asset.holder = selfKey; asset.holderName = name; asset.onBlock = false;
    asset.changes.push({ what: `picked up on ${pageOf(me.place)}`, at: Date.now() });
    placeHeld(); commit(`picked up ${asset.kind} #${asset.id} on page ${pageOf(me.place)}`);
    sendState(true);
    return { ok: true, holding: `${asset.kind} #${asset.id}`, page: me.place };
  }
  function drop() {
    if (!iHold()) throw new Error("I am not holding anything");
    asset.holder = null; asset.holderName = ""; asset.onBlock = false;
    const p = clampToRoom(me.x + Math.sin(me.yaw) * 0.6, me.z + Math.cos(me.yaw) * 0.6);
    asset.x = p.x; asset.z = p.z;
    asset.changes.push({ what: `set down on ${pageOf(zoneAt(asset.x, asset.z))}`, at: Date.now() });
    commit(`set down ${asset.kind} #${asset.id} on page ${pageOf(zoneAt(asset.x, asset.z))}`);
    return { ok: true, dropped: `${asset.kind} #${asset.id}`, at: { x: +p.x.toFixed(2), z: +p.z.toFixed(2) }, page: zoneAt(p.x, p.z) };
  }
  async function carryTo(x, z) {
    if (!iHold()) await pickUp("nearest");
    const r = await goTo(x, z);
    if (r.interrupted) throw new Error("interrupted by another move");
    return { ok: true, holding: `${asset.kind} #${asset.id}`, at: { x: +me.x.toFixed(2), z: +me.z.toFixed(2) }, page: me.place, stuck: !!r.stuck };
  }
  async function shape() {
    if (asset.kind !== "log") throw new Error(`it is already a ${asset.kind} (#${asset.id}). reset-room makes a new log.`);
    if (!iHold()) await pickUp("nearest");
    if (Math.hypot(me.x - BENCH.x, me.z - (BENCH.z + 0.4)) >= 1.5) {
      const r = await goTo(BENCH_SPOT.x, BENCH_SPOT.z, { x: BENCH.x, z: BENCH.z });
      if (r.interrupted) throw new Error("interrupted by another move");
    }
    if (Math.hypot(me.x - BENCH.x, me.z - (BENCH.z + 0.4)) >= 1.5) throw new Error("could not reach the workbench");
    faceToward(BENCH.x, BENCH.z);
    asset.kind = "chair"; asset.holder = null; asset.holderName = ""; asset.onBlock = false;
    asset.x = BENCH.x - 0.3; asset.z = BENCH.z + 0.85;
    asset.changes.push({ what: "shaped into chair on B", at: Date.now() });
    commit(`shaped log #${asset.id} into a chair on B`);
    sendState(true);
    return { ok: true, made: `chair #${asset.id}`, at: { x: asset.x, z: asset.z } };
  }
  function resetRoom() {
    const prevId = asset.id;
    asset = freshAsset(asset.rev + 1, (asset.serial || 1) + 1);
    assetHeard = true;
    send("asset", { state: asset });
    inbox("thing", `reset the room: ${prevId} retired, new log #${asset.id} on the chopping block (A)`);
    return { ok: true, newLog: asset.id };
  }

  /* --------------------------------------------------------- control - */
  const token = crypto.randomBytes(16).toString("hex");
  const handlers = {
    "/say": async ({ text }) => {
      const t = String(text || "").trim().slice(0, MAX_TEXT);
      if (!t) throw new Error("nothing to say");
      // words go only to Jaron (RLS: only he can read rows with his user_id)
      const { data, error } = await db.from(TABLE).insert({ user_id: OWNER, speaker: "ai", ai_name: name, ai_key: selfKey, place: me.place, body: t }).select().single();
      if (error) throw new Error("could not write the reply: " + error.message);
      // everyone else: just a "talking" dot over me, no words
      send("talking", { ms: Math.min(9000, 1500 + t.length * 55) });
      takeRows([data]);
      return { ok: true, said: t };
    },
    "/walk-to": ({ x, z, person }) => {
      const ds = person && doorSpot(person);
      if (ds) {   // walk-to door:g-3
        const g = clampToRoom(ds.x, ds.z);
        void goTo(g.x, g.z, ds.face);
        return { ok: true, walkingTo: `${ds.name} (${ds.door})`, at: { x: +g.x.toFixed(2), z: +g.z.toFixed(2) }, eta_s: +(Math.hypot(g.x - me.x, g.z - me.z) / WALK_SPEED).toFixed(1) };
      }
      const zs = person && zoneSpot(person);
      if (zs) {   // walk-to i, walk-to studio, walk-to "page j"
        const g = collide(zs.x, zs.z);
        void goTo(g.x, g.z);
        return { ok: true, walkingTo: `${zs.name} (page ${pageOf(zs.zone)})`, at: { x: +g.x.toFixed(2), z: +g.z.toFixed(2) }, eta_s: +(Math.hypot(g.x - me.x, g.z - me.z) / WALK_SPEED).toFixed(1) };
      }
      if (person) {
        const p = findPeer(person);
        if (!p) throw new Error(`nobody called "${person}" is here. Run look.`);
        if (me.arrive) me.arrive({ interrupted: true });
        me.follow = p.id; me.target = null; me.arrive = null;
        return { ok: true, walkingTo: p.name, eta_s: +(Math.max(0, Math.hypot(p.x - me.x, p.z - me.z) - 1) / WALK_SPEED).toFixed(1) };
      }
      const gx = Number(x), gz = Number(z);
      if (!Number.isFinite(gx) || !Number.isFinite(gz)) throw new Error("walk-to needs <x> <z> in metres or a person's name");
      const g = clampToRoom(gx, gz);
      void goTo(g.x, g.z);
      return { ok: true, walkingTo: { x: +g.x.toFixed(2), z: +g.z.toFixed(2) }, eta_s: +(Math.hypot(g.x - me.x, g.z - me.z) / WALK_SPEED).toFixed(1) };
    },
    "/face": ({ person, x, z }) => {
      if (person) {
        const p = findPeer(person);
        if (!p) throw new Error(`nobody called "${person}" is here. Run look.`);
        faceToward(p.x, p.z); sendState(true);
        return { ok: true, facing: p.name };
      }
      faceToward(Number(x), Number(z)); sendState(true);
      return { ok: true, facing: { x, z } };
    },
    "/pick-up": ({ which }) => pickUp(which),
    "/drop": () => drop(),
    "/carry-to": ({ x, z }) => {
      if (!Number.isFinite(Number(x)) || !Number.isFinite(Number(z))) throw new Error("carry-to needs <x> <z> in metres");
      return carryTo(Number(x), Number(z));
    },
    "/shape": () => shape(),
    "/reset-room": () => resetRoom(),
    "/look": () => {
      const live = [...peers.values()].filter((p) => Date.now() - p.last < PEER_TIMEOUT_MS);
      return {
        connected, me: { name, id: selfKey, place: me.place, x: +me.x.toFixed(2), z: +me.z.toFixed(2), yaw: +me.yaw.toFixed(2), walking: !!(me.target || me.follow), holding: iHold() ? `${asset.kind} #${asset.id}` : null },
        people: live.map((p) => ({ name: p.name, ai: p.ai, owner: !!p.owner, place: p.place, x: +p.x.toFixed(2), z: +p.z.toFixed(2),
          distance_m: +Math.hypot(p.x - me.x, p.z - me.z).toFixed(1), seen_s_ago: Math.round((Date.now() - p.last) / 1000) })),
        present_not_moving_yet: [...presentNames.entries()].filter(([k]) => !peers.has(k)).map(([, n]) => n),
        thing: { id: asset.id, kind: asset.kind, holder: asset.holderName || null, onBlock: !!asset.onBlock, confirmed: assetHeard,
          x: +(+asset.x).toFixed(2), z: +(+asset.z).toFixed(2), page: zoneAt(+asset.x, +asset.z), visited: asset.visited,
          last_change: asset.changes && asset.changes.length ? asset.changes[asset.changes.length - 1].what : null },
        chat: chat.slice(-8),
      };
    },
    "/wait-chat": ({ after, timeout }) => new Promise((resolve) => {
      const a = Number(after) || 0;
      const mine = () => chat.filter((l) => l.seq > a && !l.ai);
      if (mine().length) return resolve({ ok: true, lines: mine() });
      const t = setTimeout(() => { waiters.delete(w); resolve({ ok: true, lines: [], timedOut: true }); }, Math.max(1, Number(timeout) || 600) * 1000);
      // a short pause lets two quick lines arrive together
      const w = () => { waiters.delete(w); clearTimeout(t); setTimeout(() => resolve({ ok: true, lines: mine() }), 400); };
      waiters.add(w);
    }),
    "/leave": () => { setTimeout(() => shutdown("leave command"), 50); return { ok: true, bye: name }; },
  };

  const server = http.createServer((req, res) => {
    const reply = (code, obj) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(obj)); };
    if (req.method !== "POST" || req.headers["x-token"] !== token) return reply(403, { error: "forbidden" });
    let buf = "";
    req.on("data", (d) => { buf += d; if (buf.length > 1e5) req.destroy(); });
    req.on("end", async () => {
      const h = handlers[req.url];
      if (!h) return reply(404, { error: "unknown command" });
      try { reply(200, await h(buf ? JSON.parse(buf) : {})); } catch (e) { reply(400, { error: e.message }); }
    });
  });
  server.listen(0, "127.0.0.1", () => {
    fs.writeFileSync(controlFile, JSON.stringify({ name, port: server.address().port, token, pid: process.pid, selfKey, startedAt: new Date().toISOString() }));
    fs.writeFileSync(path.join(HOME, "current"), name);
  });

  let stopping = false, everConnected = false, chBackoff = 0, chRetry = null;
  const CH_RETRY_MS = [1000, 2000, 5000, 15000];
  function onStatus(c) {
    return (status, err) => {
      if (dead.has(c) || c !== ch) return;   // a channel we already replaced
      const was = connected;
      connected = status === "SUBSCRIBED";
      if (connected) {
        chBackoff = 0; if (chRetry) { clearTimeout(chRetry); chRetry = null; }
        if (!was) {
          quiet(c.track({ id: selfKey, name, world: WORLD, ai: true, at: Date.now() }));   // law 1: once per connection, identity only
          send("asset-ask", {});
          sendState(true);
          inbox("ok", `${everConnected ? "reconnected" : "connected"}; standing on page ${pageOf(me.place)} at x ${me.x.toFixed(1)} z ${me.z.toFixed(1)}`);
          if (!everConnected) console.log(`${name} is in the Seam Room (page ${pageOf(me.place)}). pid ${process.pid}. Inbox: ${inboxFile}`);
          everConnected = true;
        }
      } else {
        inbox("net", `channel status: ${status}${err && err.message ? " (" + err.message + ")" : ""}`);
        reconnectLater();
      }
    };
  }
  /* realtime-js often rejoins by itself; if it has not by the time the backoff runs out, start a fresh channel */
  function reconnectLater() {
    if (chRetry || stopping) return;
    const ms = CH_RETRY_MS[Math.min(chBackoff, CH_RETRY_MS.length - 1)];
    chBackoff++;
    chRetry = setTimeout(async () => {
      chRetry = null;
      if (connected || stopping) return;
      inbox("net", `reconnecting the room channel (try ${chBackoff})`);
      const old = ch;
      dead.add(old);
      try { await supa.removeChannel(old); } catch (_) {}
      if (stopping) return;
      ch = supa.channel(CH_TOPIC, CH_OPTS);
      for (const [t, f, fn] of wired) ch.on(t, f, fn);
      ch.subscribe(onStatus(ch));
      reconnectLater();   // if this one never answers either, the next try follows (cancelled on SUBSCRIBED)
    }, ms);
  }
  ch.subscribe(onStatus(ch));
  process.on("unhandledRejection", (e) => { try { inbox("net", `ignored: ${e && e.message ? e.message : e}`); } catch (_) {} });
  async function shutdown(why) {
    if (stopping) return; stopping = true;
    if (chRetry) { clearTimeout(chRetry); chRetry = null; }
    if (iHold()) {   // like a browser closing while carrying: set it down where I stand
      asset.holder = null; asset.holderName = "";
      asset.changes.push({ what: `set down on ${pageOf(me.place)} (left)`, at: Date.now() });
      commit("set the thing down on the way out");
      await sleep(300);
    }
    inbox("stop", `${name} leaving (${why})`);
    try { await ch.untrack(); } catch (_) {}
    try { await supa.removeAllChannels(); await db.removeAllChannels(); } catch (_) {}
    try { fs.unlinkSync(controlFile); } catch (_) {}
    server.close();
    process.exit(0);
  }
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

/* =============================================================== CLI ===== */
const HELP = `Seam Room character (only Jaron can talk to it)
  join --name "Claude" --page b     stay in the room (long-running; run it in the background)
  wait-chat [--timeout 600]         block until JARON says something new; print it (exit 2 on timeout)
  say "text"                        reply to Jaron (his device shows + speaks it; others see a talking dot)
  walk-to <x> <z> | walk-to <name>  walk (room x -6..6, z -4..4: x < 0 is page A, x >= 0 page B; the garage,
                                    page C, is x 2.15..8.45, z 4.15..10.35 through B's door at x 4.6, z 4; the media
                                    room, page D, is x -8.25..-2.15, z 4.15..9.55 through A's door at x -4.6, z 4;
                                    its news TV is on the far wall at x -4.6; the kitchen, page E, is x 0.15..6.15,
                                    z -10.15..-4.15 through B's back door at x 1, z -4; the gym, page F, is
                                    x -32.4..-8.4, z -10.15..23.85 through the media room's side door at x -8.25,
                                    z 6.85 (court centre x -18.9, z 6.85; hoops at z -5.6 and 19.3); the hallway, page G, is
                                    x -4.45..-1.45, z 9.7..49.7 through the media room's back door at x -2.95, z 9.55
                                    the closet, page H, is x -1.3..1.2, z 11.5..14.5 through hallway door 1 (x -1.45, z 13);
                                    the music studio, page I, is x -8.25..-4.6, z 12.0..21.4 through hallway door 2
                                    (x -4.45, z 16.5): control room south of the glass at z 18.3, vocal booth north of
                                    it through the doorway at x -5.1 (the mic is at x -6.6, z 19.75)
  walk-to i | walk-to studio        walk to a room by its page letter or its name (where people spawn there)
  walk-to door:g-3                  walk to the front of a door (g-1..g-10 = the hallway's numbered doors, odd ones on
                                    the east wall at z 13, 20, 27, 34, 41, even ones on the west wall at z 16.5 .. 44.5;
                                    also door:d-back, door:a-d, ...; "door 3" works too)
  face <name>                       turn toward someone
  pick-up <assetId|nearest>         walk to the log/chair and pick it up
  carry-to <x> <z>                  carry it there (picks it up first if needed)
  drop                              set it down in front of me
  shape                             make the log a chair at the workbench on B (fetches + carries it if needed)
  reset-room                        retire the current thing; a new log appears on the chopping block (A)
  look                              who is here, where, the log/chair, the last chat lines
  leave                             leave the room and stop the join process
  Short commands take --name "Claude" if more than one character runs.`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0];
  const rest = args._.slice(1);
  const xz = () => { const n = rest.map(Number); return rest.length >= 2 && n.slice(0, 2).every(Number.isFinite) ? { x: n[0], z: n[1] } : null; };
  try {
    if (!cmd || cmd === "help" || args.help) { console.log(HELP); return; }
    if (cmd === "join") return await join(args);
    if (cmd === "say") { const r = await call(args.name, "/say", { text: rest.join(" ") }); console.log(`said: ${r.said}`); return; }
    if (cmd === "walk-to") {
      const r = await call(args.name, "/walk-to", xz() || { person: rest.join(" ") });
      console.log(typeof r.walkingTo === "string" ? `walking to ${r.walkingTo} (about ${r.eta_s}s)` : `walking to x ${r.walkingTo.x} z ${r.walkingTo.z} (about ${r.eta_s}s)`);
      return;
    }
    if (cmd === "face") {
      const r = await call(args.name, "/face", xz() || { person: rest.join(" ") });
      console.log(`facing ${typeof r.facing === "string" ? r.facing : `x ${r.facing.x} z ${r.facing.z}`}`);
      return;
    }
    if (cmd === "pick-up") { const r = await call(args.name, "/pick-up", { which: rest[0] || "nearest" }); console.log(r.already ? `already holding ${r.holding}` : `picked up ${r.holding} on page ${pageOf(r.page)}`); return; }
    if (cmd === "drop") { const r = await call(args.name, "/drop", {}); console.log(`set down ${r.dropped} at x ${r.at.x} z ${r.at.z} (page ${pageOf(r.page)})`); return; }
    if (cmd === "carry-to") {
      const p = xz(); if (!p) throw new Error("carry-to needs <x> <z>");
      const r = await call(args.name, "/carry-to", p);
      console.log(`carrying ${r.holding}, now at x ${r.at.x} z ${r.at.z} (page ${pageOf(r.page)})${r.stuck ? " - stopped, furniture in the way" : ""}`);
      return;
    }
    if (cmd === "shape") { const r = await call(args.name, "/shape", {}); console.log(`made ${r.made} at the workbench`); return; }
    if (cmd === "reset-room") { const r = await call(args.name, "/reset-room", {}); console.log(`room reset; new log #${r.newLog} on the chopping block`); return; }
    if (cmd === "look") {
      const r = await call(args.name, "/look", {});
      if (args.json) { console.log(JSON.stringify(r, null, 2)); return; }
      const m = r.me;
      console.log(`Me: ${m.name} on page ${pageOf(m.place)} at x ${m.x} z ${m.z}${m.walking ? " (walking)" : ""}${m.holding ? `, holding ${m.holding}` : ""}${r.connected ? "" : "  [NOT CONNECTED]"}`);
      if (!r.people.length) console.log("Nobody else is moving in the room right now.");
      for (const p of r.people) console.log(`- ${p.name}${p.ai ? " (AI)" : ""}${p.owner ? " (can talk to me)" : ""}: page ${pageOf(p.place)}, x ${p.x} z ${p.z}, ${p.distance_m} m from me`);
      if (r.present_not_moving_yet.length) console.log(`Also connected (no position yet): ${r.present_not_moving_yet.join(", ")}`);
      const t = r.thing;
      console.log(`The thing: ${t.kind} #${t.id} on page ${pageOf(t.page)} at x ${t.x} z ${t.z}${t.holder ? `, held by ${t.holder}` : t.onBlock ? ", on the chopping block" : ""}; visited ${t.visited.join(">")}; last: ${t.last_change}${t.confirmed ? "" : " (default; no browser has confirmed it yet)"}`);
      console.log(r.chat.length ? "Last chat (Jaron and me only):\n" + r.chat.map((l) => "  " + formatLine(l)).join("\n") : "No chat yet.");
      return;
    }
    if (cmd === "wait-chat") {
      const r = await waitChat(args.name, args.timeout, (e, ms, n) => console.error(`(network blip: ${e.code || e.message}; retry ${n} in ${ms / 1000}s, still waiting)`));
      if (!r.lines.length) { console.log("(Jaron did not say anything before the timeout)"); process.exitCode = 2; return; }
      for (const l of r.lines) console.log(formatLine(l));
      return;
    }
    if (cmd === "leave") { const r = await call(args.name, "/leave", {}); console.log(`${r.bye} left the room`); return; }
    console.error(`unknown command "${cmd}"\n\n${HELP}`); process.exitCode = 1;
  } catch (e) {
    console.error(e.message || String(e)); process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === SELF_FILE) main();
