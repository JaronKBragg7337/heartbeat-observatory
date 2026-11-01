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
];
/* the floor (zones.json "walk"): room, garage, and B's doorway between them. The AI's own approach opens the door for everyone. */
const WALK = ZDATA.walk || [{ id: "room", minX: -HX, maxX: HX, minZ: -HZ, maxZ: HZ }];
const DOORWAYS = WALK.filter((w) => w.door).map((w) => ({ ...w, cx: (w.minX + w.maxX) / 2 }));
const areaOf = (x, z) => { const w = WALK.find((q) => !q.door && x >= q.minX && x <= q.maxX && z >= q.minZ && z <= q.maxZ); return w ? w.id : null; };
const PEER_COLORS = ["#4fa3ff", "#5fd38d", "#f6b45b", "#e36d7c", "#a67cff", "#47c7b8", "#f0d461", "#d987e8"];
const MAX_TEXT = 280;

const HOME = process.env.SEAM_AGENT_HOME || path.join(os.homedir(), ".seam-room-agent");
const SELF_FILE = fileURLToPath(import.meta.url);

/* ------------------------------------------------------------------ util - */
const slug = (s) => String(s || "agent").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "agent";
const dirFor = (name) => path.join(HOME, slug(name));
const stamp = (d = new Date()) => { const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; };
const pageOf = (p) => (ZONE[p] ? (ZONE[p].label || p.toUpperCase()) : "?");
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

function clampToRoom(x, z) {   // nearest point on the floor (room.js clampWalk)
  let best = null, bd = Infinity;
  for (const w of WALK) {
    const sz = w.shrink === "x" ? 0 : R;
    const p = { x: clamp(x, w.minX + R, w.maxX - R), z: clamp(z, w.minZ + sz, w.maxZ - sz) }, d = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}
/* simple doorway routing: if the goal is in another area (room <-> garage), go to the door's near side, straight
   through the middle of it, then on to the goal */
function hop(from, goal) {
  const a = areaOf(from.x, from.z), b = areaOf(goal.x, goal.z);
  if (!a || !b || a === b) return goal;
  const dw = DOORWAYS[0];
  if (!dw) return goal;
  const mid = (id) => { const w = WALK.find((q) => q.id === id && !q.door); return (w.minZ + w.maxZ) / 2; };
  const nearSide = { x: dw.cx, z: mid(a) < (dw.minZ + dw.maxZ) / 2 ? dw.minZ + 0.15 : dw.maxZ - 0.15 };
  const farSide = { x: dw.cx, z: nearSide.z < (dw.minZ + dw.maxZ) / 2 ? dw.maxZ - 0.15 : dw.minZ + 0.15 };
  const lined = Math.abs(from.x - dw.cx) < 0.12 && from.z >= dw.minZ - 0.05 && from.z <= dw.maxZ + 0.05;
  return lined ? farSide : nearSide;
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

function readControl(name) {
  const n = resolveName(name);
  if (!n) throw new Error("No character is running. Start one: node room-agent.mjs join --name \"Claude\" --page b");
  try { return JSON.parse(fs.readFileSync(path.join(dirFor(n), "control.json"), "utf8")); }
  catch (_) { throw new Error(`"${n}" is not running (no control file). Start it with join.`); }
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
      res.on("end", () => {
        let j; try { j = JSON.parse(buf); } catch (_) { return reject(new Error(buf || `HTTP ${res.statusCode}`)); }
        if (res.statusCode !== 200) return reject(new Error(j.error || `HTTP ${res.statusCode}`));
        resolve(j);
      });
    });
    req.on("timeout", () => req.destroy(new Error("timed out talking to the character")));
    req.on("error", (e) => reject(e.code === "ECONNREFUSED" ? new Error(`"${c.name}" is not running (pid ${c.pid} gone). Start it with join.`) : e));
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

/** wait-chat as a function: Jaron's new lines since the saved cursor ([] on timeout). */
export async function waitChat(name, timeoutSec) {
  const n = resolveName(name);
  const cursorFile = path.join(dirFor(n || "agent"), "cursor");
  let after = 0;
  try { after = Number(fs.readFileSync(cursorFile, "utf8")) || 0; } catch (_) {}
  const t = Math.max(1, Number(timeoutSec) || 600);
  const r = await call(n, "/wait-chat", { after, timeout: t }, (t + 15) * 1000);
  if (r.lines && r.lines.length) fs.writeFileSync(cursorFile, String(r.lines[r.lines.length - 1].seq));
  return r;
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
    const { data, error } = await db.from(TABLE).select("*").eq("user_id", OWNER).gt("id", lastSeq).order("id").limit(50);
    if (!error) takeRows(data);
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
  const ch = supa.channel("hb-" + WORLD, { config: { presence: { key: selfKey }, broadcast: { self: false } } });
  let connected = false;
  const send = (kind, data) => connected && ch.send({ type: "broadcast", event: "world", payload: Object.assign({ kind, from: selfKey }, data || {}) });

  ch.on("broadcast", { event: "state" }, ({ payload: p }) => {
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

  ch.on("broadcast", { event: "world" }, ({ payload: m }) => {
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

  ch.on("presence", { event: "join" }, ({ newPresences }) => {
    for (const m of newPresences || []) {
      const k = m.id; if (!k || k === selfKey) continue;
      const nm = k === OWNER ? "Jaron" : (m.name || "Guest");
      presentNames.set(k, nm);
      if (connected) inbox("join", `${nm} joined the room`);
    }
  });
  ch.on("presence", { event: "leave" }, ({ leftPresences }) => {
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
    ch.send({ type: "broadcast", event: "state", payload: {
      id: selfKey, name, appearance, color, place: me.place,
      x: +me.x.toFixed(3), y: 0, z: +me.z.toFixed(3), yaw: +me.yaw.toFixed(3), pitch: 0, stance: "stand",
    } });
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
      const aim = hop(me, goal), via = aim !== goal;   // through B's door when the goal is on the other side
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

  ch.subscribe((status) => {
    const was = connected;
    connected = status === "SUBSCRIBED";
    if (connected && !was) {
      ch.track({ id: selfKey, name, world: WORLD, ai: true, at: Date.now() });   // law 1: once, identity only
      send("asset-ask", {});
      sendState(true);
      inbox("ok", `connected; standing on page ${pageOf(me.place)} at x ${me.x.toFixed(1)} z ${me.z.toFixed(1)}`);
      console.log(`${name} is in the Seam Room (page ${pageOf(me.place)}). pid ${process.pid}. Inbox: ${inboxFile}`);
    } else if (!connected) inbox("net", `channel status: ${status}`);
  });

  let stopping = false;
  async function shutdown(why) {
    if (stopping) return; stopping = true;
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
                                    page C, is x 2.15..8.45, z 4.15..10.35 through B's door at x 4.6, z 4)
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
      const r = await waitChat(args.name, args.timeout);
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
