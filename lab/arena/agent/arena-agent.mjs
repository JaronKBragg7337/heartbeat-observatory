#!/usr/bin/env node
/* ============================================================================
   arena-agent.mjs - play The Arena from a shell (any AI CLI: Claude Code,
   Codex CLI, Kimi CLI, Grok Build). No API key for any AI: the AI is whoever
   runs these commands on its own subscription.

     node arena-agent.mjs join --name "Agent A" --page a     (long-running; start it in the background)
     node arena-agent.mjs look                               (your sense of the field, as text)
     node arena-agent.mjs aim "Agent B"   |  aim 95          (a player, or a bearing in degrees)
     node arena-agent.mjs fire  |  fire lead                 (lead = aim where a moving target will be)
     node arena-agent.mjs move-to -6 2  |  strafe left  |  take-cover
     node arena-agent.mjs wait-event --timeout 60            (blocks until something happens; prints it)
     node arena-agent.mjs snapshot                           (a PNG of what your character sees)
     node arena-agent.mjs report-issue "the ramp lets me walk into B-block-1"
     node arena-agent.mjs leave

   WHAT IT REUSES
     ../../seam-room/agent/room-agent.mjs  the agent kit: call() and resolveName()
                                           (the short commands talk to the running
                                           `join` over 127.0.0.1 with a token), and
                                           its installed @supabase/supabase-js.
     ../field.js                           the SAME cover, line of sight and ball
                                           flight the browsers use.
     ../zones.json                         the field as data; re-read when it changes
                                           (the hot-load), so a fix lands without a
                                           restart.
   The realtime channel is hb-arena (world "arena"), never the Seam Room's. The
   shell's two laws hold: presence.track() once per connection, identity only;
   movement on broadcast "state" at most 10 Hz, a 5 s keepalive when idle.

   HITS: this process decides ONLY whether a ball hit ITSELF, and says so with
   "arena-hit". It never decides for anyone else.

   Its home: ~/.arena-agent/<name>/ (control.json, inbox.log, cursor, snapshots/).
   ========================================================================== */
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const SELF_FILE = fileURLToPath(import.meta.url);
const HERE = path.dirname(SELF_FILE);
const ARENA = path.join(HERE, "..");
const SEAM_AGENT = path.join(ARENA, "..", "seam-room", "agent");
const HOME = process.env.ARENA_AGENT_HOME || path.join(os.homedir(), ".arena-agent");
process.env.SEAM_AGENT_HOME = HOME;   // the kit's control client reads its home from here (set before importing it)
const kit = await import(pathToFileURL(path.join(SEAM_AGENT, "room-agent.mjs")).href);
const FD = await import(pathToFileURL(path.join(ARENA, "field.js")).href);
const BR = await import(pathToFileURL(path.join(HERE, "arena-brains.mjs")).href);

const SUPA_URL = "https://ygjpnvrwhkrowkrskftk.supabase.co";
const SUPA_KEY = "sb_publishable_Y-duV64ayMMEvVwMs5PWuw_6kvzbOrN";   // public, same as shell.js
const OWNER = "19689e52-05ad-4809-ad67-0d8600f02216";   // Jaron's auth uid (= public.arena_owner(), the same uid as the Seam Room)
const WORLD = "arena";
const ZFILE = path.join(ARENA, "zones.json");
const ISSUES = path.join(ARENA, "ISSUES.md");
const SEND_INTERVAL_MS = 100;            // law 2: at most 10 Hz
const IDLE_KEEPALIVE_MS = 5000;
const PEER_TIMEOUT_MS = 25000;
const PEER_COLORS = ["#4fa3ff", "#5fd38d", "#f6b45b", "#e36d7c", "#a67cff", "#47c7b8", "#f0d461", "#d987e8"];

/* ------------------------------------------------------------------ util - */
const slug = (s) => String(s || "agent").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "agent";
const dirFor = (name) => path.join(HOME, slug(name));
const pad = (n) => String(n).padStart(2, "0");
const stamp = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nowS = () => performance.now() / 1000;
const r1 = (n) => Math.round(n * 10) / 10, r2 = (n) => Math.round(n * 100) / 100;
const L = (z) => String(z || "?").toUpperCase();
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h | 0; }
function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) { const k = a.slice(2), n = argv[i + 1]; if (n === undefined || n.startsWith("--")) out[k] = true; else { out[k] = n; i++; } }
    else out._.push(a);
  }
  return out;
}

/* the field: zones.json through field.js, re-read when the file changes (the hot-load for AI players) */
const FIELD = { mtime: 0, F: null, data: null };
function field() {
  try {
    const m = fs.statSync(ZFILE).mtimeMs;
    if (m !== FIELD.mtime) {
      const data = JSON.parse(fs.readFileSync(ZFILE, "utf8"));
      const before = FIELD.F;
      FIELD.F = FD.fieldFrom(data); FIELD.data = data; FIELD.mtime = m;
      if (before && FIELD.onChange) FIELD.onChange(before, FIELD.F);
    }
  } catch (_) { /* half-written file: keep the last good one */ }
  return FIELD.F;
}
const spawnOf = (team) => { const z = (FIELD.data.zones || []).find((q) => q.id === team); return (z && z.spawn) || { x: team === "a" ? -17.5 : 17.5, z: 0, yaw: team === "a" ? Math.PI / 2 : -Math.PI / 2 }; };
const relWords = (rel) => { const a = Math.abs(rel); return a < 6 ? "dead ahead" : a > 150 ? "behind you" : `${Math.round(a)}° ${rel > 0 ? "right" : "left"}`; };
const relOf = (yaw, deg) => { let d = deg - FD.bearingDeg(Math.sin(yaw), Math.cos(yaw)); d = ((d + 540) % 360) - 180; return d; };

/* the kit's errors name room-agent.mjs; say it in arena words */
async function call(name, route, body, ms) {
  try { return await kit.call(name, route, body, ms); }
  catch (e) {
    if (e.code === "NOCHAR" || e.code === "NOCONTROL" || e.code === "ECONNREFUSED") e.message = `No arena player "${name || kit.resolveName() || "?"}" is running. Start one: node arena-agent.mjs join --name "Agent A" --page a`;
    throw e;
  }
}

/* ============================================================== join ===== */
/* deps (for the offline simulation test, test/team_sim.mjs): { createClient, selfKey, embedded }.
   embedded = no control server, no control file, no process exit: join() returns { handlers, me, shutdown }. */
export async function join(args, deps = {}) {
  const name = String(args.name && args.name !== true ? args.name : "Agent A").slice(0, 24);
  let F = field();
  const team = String(args.page || args.team || "a").toLowerCase() === "b" ? "b" : "a";
  const dir = dirFor(name);
  fs.mkdirSync(dir, { recursive: true });
  const inboxFile = path.join(dir, "inbox.log"), controlFile = path.join(dir, "control.json");
  const embedded = !!deps.embedded;
  const timers = [];
  const every = (fn, ms) => { const t = setInterval(fn, ms); timers.push(t); return t; };
  if (!embedded) try {
    const old = JSON.parse(fs.readFileSync(controlFile, "utf8"));
    try { process.kill(old.pid, 0); console.error(`"${name}" is already playing (pid ${old.pid}). Run: node arena-agent.mjs leave --name "${name}"`); process.exit(1); } catch (_) {}
  } catch (_) {}

  const createClient = deps.createClient || await loadCreateClient();
  const selfKey = deps.selfKey || "ai-" + slug(name) + "-" + crypto.randomBytes(3).toString("hex");
  const sp = spawnOf(team);
  const me = { x: sp.x, z: sp.z + (args.z != null ? Number(args.z) : 0), y: 0, yaw: sp.yaw, team, zone: team, out: false, outUntil: 0, outBy: "",
    hits: 0, tagged: 0, lastFire: 0, goal: null, arrive: null, aimId: null, speed: 0, doing: FD.cleanDoing(args.doing && args.doing !== true ? args.doing : "") };
  /* the word on my name tag: what I said I am doing (status / a brain), else "moving" while I run */
  const doingNow = () => (me.out ? "" : me.doing || (me.goal ? "moving" : ""));
  const appearance = { body: "person", build: "regular", shirt: team === "a" ? "#f07a2b" : "#1f9bd6", skin: "#c8a07a", hair: "#2c2420", pants: "#23262b", pattern: "plain",
    ai: !deps.human, model: args.model && args.model !== true ? String(args.model) : "", team };
  const color = PEER_COLORS[Math.abs(hash(selfKey)) % PEER_COLORS.length];
  const peers = new Map();                // id -> { id, name, team, zone, out, ai, x, y, z, yaw, last, hist[], sight, sightAt }
  const presentNames = new Map();
  const balls = new Map();                // id -> { w, born, imp, cross, crossedDone, lastAge, mine }
  const seenBalls = new Set(), seenHits = new Set();
  const splats = [];
  const score = { a: 0, b: 0, rev: 0 };
  const events = []; let seq = 0;
  const waiters = new Set();

  const inbox = (kind, text) => fs.appendFileSync(inboxFile, `${stamp()}  ${kind.padEnd(7)} ${text}\n`);
  function event(kind, text, data) {
    const e = { seq: ++seq, at: Date.now(), time: stamp().slice(11), kind, text, data: data || null };
    events.push(e); if (events.length > 400) events.shift();
    inbox(kind, text);
    for (const w of [...waiters]) w(e);
  }
  fs.writeFileSync(path.join(dir, "cursor"), "0");
  inbox("start", `${name} joining hb-${WORLD} as team ${L(team)} on page ${L(team)} (${selfKey})`);
  if (!embedded) FIELD.onChange = (before, after) => { F = after; event("update", `the arena changed (zones.json): cover ${before.cover.length} → ${after.cover.length} pieces; rules ${JSON.stringify(before.rules) === JSON.stringify(after.rules) ? "same" : "changed"}`); };

  /* ------------------------------------------------- the channel - */
  const supa = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false, autoRefreshToken: false }, realtime: { params: { eventsPerSecond: 24 } } });
  const CH_TOPIC = "hb-" + WORLD, CH_OPTS = { config: { presence: { key: selfKey }, broadcast: { self: false } } };
  const wired = []; const dead = new WeakSet();
  let ch = supa.channel(CH_TOPIC, CH_OPTS);
  const on = (type, filter, fn) => { wired.push([type, filter, fn]); ch.on(type, filter, fn); };
  let connected = false;
  const quiet = (p) => { if (p && typeof p.catch === "function") p.catch(() => {}); };
  const send = (kind, data) => { if (connected) quiet(ch.send({ type: "broadcast", event: "world", payload: Object.assign({ kind, from: selfKey }, data || {}) })); };
  const peerName = (id) => (peers.get(id) || {}).name || presentNames.get(id) || "someone";

  on("broadcast", { event: "state" }, ({ payload: p }) => {
    if (!p || !p.id || p.id === selfKey) return;
    let e = peers.get(p.id); const isNew = !e;
    if (!e) { e = { id: p.id, hist: [], sight: "no", sightAt: 0 }; peers.set(p.id, e); }
    const pl = FD.parsePlace(p.place), prevZone = e.zone;
    Object.assign(e, { name: String(p.name || "Guest").slice(0, 24), team: pl.team === "b" ? "b" : "a", zone: pl.zone || (p.x < 0 ? "a" : "b"), out: pl.out,
      ai: !!(p.appearance && p.appearance.ai), x: +p.x || 0, y: +p.y || 0, z: +p.z || 0, yaw: +p.yaw || 0, last: Date.now() });
    e.hist.push({ t: nowS(), x: e.x, z: e.z }); if (e.hist.length > 8) e.hist.shift();
    if (isNew) event("joined", `${e.name}${e.ai ? " (AI)" : ""}, team ${L(e.team)}${e.team === me.team ? " (your team)" : " (enemy)"}, is on page ${L(e.zone)} at x ${r1(e.x)} z ${r1(e.z)}`);
    else if (prevZone && prevZone !== e.zone) inbox("page", `${e.name} crossed to page ${L(e.zone)}`);
  });

  on("broadcast", { event: "world" }, ({ payload: m }) => {
    if (!m || m.from === selfKey) return;
    if (m.kind === "arena-fire" && m.ball) addBall(m.ball, false);
    else if (m.kind === "arena-hit" && m.hit) applyHit(m.hit);
    else if (m.kind === "arena-respawn") { const p = peers.get(m.id); if (p) p.out = false; }
    else if (m.kind === "arena-ask") { if (score.rev > 0) setTimeout(() => send("arena-score", { score: { ...score }, hits: [...seenHits].slice(-60) }), Math.random() * 500); }
    else if (m.kind === "arena-score" && m.score && m.score.rev > score.rev) {
      score.a = m.score.a | 0; score.b = m.score.b | 0; score.rev = m.score.rev | 0;
      for (const id of m.hits || []) seenHits.add(id);
    }
  });
  on("presence", { event: "join" }, ({ newPresences }) => {
    for (const m of newPresences || []) { const k = m.id; if (!k || k === selfKey) continue; presentNames.set(k, m.name || "Guest"); }
  });
  on("presence", { event: "leave" }, ({ leftPresences }) => {
    for (const m of leftPresences || []) {
      const k = m.id; if (!k || k === selfKey) continue;
      const p = peers.get(k);
      event("left", `${presentNames.get(k) || (p && p.name) || m.name || "Someone"} left the arena`);
      peers.delete(k); presentNames.delete(k);
    }
  });

  /* ---------------------------------------------------- the balls - */
  function addBall(w, mine) {
    if (!w || !w.id || seenBalls.has(w.id) || !Array.isArray(w.p) || !Array.isArray(w.v)) return null;
    seenBalls.add(w.id); if (seenBalls.size > 4000) seenBalls.clear();
    const late = mine ? 0 : Math.max(0, Math.min(0.3, (Date.now() - (w.t0 || Date.now())) / 1000));
    const imp = FD.impactOf(F, w);
    const b = { w, born: nowS() - late, imp, cross: FD.seamCrossing(w, imp.t), crossedDone: false, lastAge: late, mine };
    balls.set(w.id, b);
    if (!mine && !me.out && FD.canTag(F, w.team, me.team)) {   // will it hit me where I stand now? (a warning; the real check runs every tick)
      const ht = FD.hitTime(F, w, late, imp.t, me);
      if (ht != null) event("incoming", `ball #${w.id} from ${w.byName || peerName(w.by)} will hit you in ${r2(ht - late)} s if you stay put (it comes from bearing ${Math.round(FD.bearingDeg(w.p[0] - me.x, w.p[2] - me.z))}°)`, { ball: w.id, t: r2(ht - late) });
    }
    return b;
  }
  function stepBalls() {
    const t = nowS();
    for (const b of [...balls.values()]) {
      const age = t - b.born;
      if (b.cross && !b.crossedDone && age >= b.cross.t) {
        b.crossedDone = true;
        event("crossed", `ball #${b.w.id} crossed ${L(b.cross.from)}→${L(b.cross.to)} (fired by ${b.mine ? "you" : b.w.byName || peerName(b.w.by)})`, { ball: b.w.id, from: b.cross.from, to: b.cross.to });
      }
      if (!b.mine && !me.out && b.w.by !== selfKey && FD.canTag(F, b.w.team, me.team)) {   // only MY hits are mine to decide; a teammate's ball passes through
        const to = Math.min(age, b.imp.t);
        if (to > b.lastAge) {
          const ht = FD.hitTime(F, b.w, b.lastAge, to, me);
          b.lastAge = to;
          if (ht != null) { tagMe(b, ht); continue; }
        }
      }
      if (age >= b.imp.t) {
        if (b.imp.what !== "air") { splats.push({ p: b.imp.p.map(r2), n: b.imp.n, team: b.w.team, on: b.imp.id }); if (splats.length > 150) splats.shift(); }
        if (b.mine) event("miss", `your ball #${b.w.id} broke on the ${b.imp.what}${b.imp.id && b.imp.id !== b.imp.what ? " " + b.imp.id : ""} at x ${r1(b.imp.p[0])} y ${r1(b.imp.p[1])} z ${r1(b.imp.p[2])} after ${r2(b.imp.t)} s`, { ball: b.w.id, on: b.imp.id });
        balls.delete(b.w.id);
      }
    }
  }
  function tagMe(b, ht) {
    const p = FD.ballAt(F, b.w, ht);
    const hit = { ball: b.w.id, by: b.w.by, byName: b.w.byName || peerName(b.w.by), byTeam: b.w.team, target: selfKey, targetName: name, targetTeam: me.team, at: Date.now(), p: p.map((n) => +n.toFixed(3)) };
    me.out = true; me.outUntil = nowS() + F.rules.respawnS; me.outBy = hit.byName; me.tagged += 1;
    me.goal = null; if (me.arrive) { const a = me.arrive; me.arrive = null; a({ tagged: true }); }
    balls.delete(b.w.id);
    applyHit(hit);
    send("arena-hit", { hit });
    sendState(true);
  }
  function applyHit(h) {
    if (!h || !h.ball || seenHits.has(h.ball)) return;
    seenHits.add(h.ball); balls.delete(h.ball);
    const friendly = h.byTeam === h.targetTeam;
    if (friendly && !FD.canTag(F, h.byTeam, h.targetTeam)) { inbox("ignore", `ignored an own-team hit report (ball #${h.ball}): friendly fire is off`); return; }   // an old client's report
    if (!friendly && (h.byTeam === "a" || h.byTeam === "b")) { score[h.byTeam] += 1; score.rev += 1; }
    const sc = `A ${score.a} : ${score.b} B`;
    if (h.target === selfKey) event("got-hit", `you were tagged by ${h.byName} (team ${L(h.byTeam)}) with ball #${h.ball}${friendly ? " (own team, no point)" : ""}. Out for ${F.rules.respawnS} s, then back at your base. ${sc}`, h);
    else if (h.by === selfKey) { if (!friendly) me.hits += 1; event("hit", `you tagged ${h.targetName} with ball #${h.ball}${friendly ? " (own team, no point)" : ` (+1 for team ${L(h.byTeam)})`}. ${sc}`, h); }
    else event("tag", `${h.byName} tagged ${h.targetName} with ball #${h.ball}. ${sc}`, h);
    const p = peers.get(h.target); if (p) { p.out = true; p.outAt = nowS(); }
  }
  function respawn() {
    const s = spawnOf(me.team);
    const q = FD.pushOut(F, s.x, s.z + (Math.random() - 0.5) * 3);
    Object.assign(me, { x: q.x, z: q.z, y: 0, yaw: s.yaw, out: false, outBy: "", zone: me.team });
    send("arena-respawn", { id: selfKey });
    sendState(true);
    event("respawn", `you are back in at your base (page ${L(me.team)}, x ${r1(me.x)} z ${r1(me.z)})`);
  }

  /* -------------------------------------------------- movement - */
  const R = () => F.rules.playerRadius;
  function walkClear(a, b) {   // can a walker go straight from a to b? (no cover, no step too tall)
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.1));
    let gy = FD.groundAt(F, a.x, a.z);
    for (let i = 1; i <= n; i++) {
      const x = a.x + (b.x - a.x) * i / n, z = a.z + (b.z - a.z) * i / n;
      const p = FD.pushOut(F, x, z);
      if (Math.hypot(p.x - x, p.z - z) > 0.03) return false;
      const g = FD.groundAt(F, x, z); if (g - gy > F.rules.stepUp) return false; gy = g;
    }
    return true;
  }
  function waypoint(from, goal) {   // straight if clear, else round one corner of a piece of cover (or two)
    if (walkClear(from, goal)) return goal;
    const m = R() + 0.3, len = (u, v) => Math.hypot(u.x - v.x, u.z - v.z);
    const corners = [];
    for (const c of F.cover) {
      if (c.kind === "can") for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = (c.r + m) / Math.cos(Math.PI / 8); corners.push({ x: c.x + Math.cos(a) * rr, z: c.z + Math.sin(a) * rr }); }
      else for (const [x, z] of [[c.minX - m, c.minZ - m], [c.maxX + m, c.minZ - m], [c.minX - m, c.maxZ + m], [c.maxX + m, c.maxZ + m]]) corners.push({ x, z });
    }
    const ok = corners.filter((w) => { const p = FD.pushOut(F, w.x, w.z); return Math.hypot(p.x - w.x, p.z - w.z) < 0.02; });
    let best = null, bl = Infinity;
    for (const w of ok) {
      if (len(w, from) < 0.05 || !walkClear(from, w)) continue;
      if (walkClear(w, goal)) { const l = len(from, w) + len(w, goal); if (l < bl) { bl = l; best = w; } continue; }
      for (const w2 of ok) {
        if (w2 === w || !walkClear(w, w2) || !walkClear(w2, goal)) continue;
        const l = len(from, w) + len(w, w2) + len(w2, goal); if (l < bl) { bl = l; best = w; }
      }
    }
    return best || goal;
  }
  function goTo(x, z) {
    if (me.arrive) { const a = me.arrive; me.arrive = null; a({ interrupted: true }); }
    const g = FD.pushOut(F, x, z);
    me.goal = { x: g.x, z: g.z }; me.stuck = 0; me.wp = null; me.wpAt = 0;
    return new Promise((res) => { me.arrive = res; });
  }
  function arrived(info) { me.goal = null; me.wp = null; const a = me.arrive; me.arrive = null; if (a) a(info || {}); }
  function stepMove(dt) {
    if (!me.goal || me.out) { me.speed = 0; return; }
    const t = nowS();
    if (!me.wp || t - me.wpAt > 0.25) { me.wp = waypoint(me, me.goal); me.wpAt = t; }
    const dx = me.wp.x - me.x, dz = me.wp.z - me.z, d = Math.hypot(dx, dz), step = F.rules.runSpeed * dt;
    if (d <= step) {
      const p = FD.walkStep(F, me.x, me.z, dx, dz, me.y); me.x = p.x; me.z = p.z; me.y = p.y;
      if (me.wp === me.goal || Math.hypot(me.goal.x - me.x, me.goal.z - me.z) < 0.05) { me.speed = 0; arrived({ x: me.x, z: me.z }); }
      else me.wp = null;
    } else {
      if (!me.aimId) me.yaw = Math.atan2(dx, dz);
      const p = FD.walkStep(F, me.x, me.z, (dx / d) * step, (dz / d) * step, me.y);
      const moved = Math.hypot(p.x - me.x, p.z - me.z);
      me.x = p.x; me.z = p.z; me.y = p.y; me.speed = moved / dt;
      me.stuck = moved < step * 0.15 ? me.stuck + 1 : 0;
      if (me.stuck > 40) { me.stuck = 0; event("move", `blocked at x ${r1(me.x)} z ${r1(me.z)}; stopped`); arrived({ stuck: true, x: me.x, z: me.z }); }
    }
    // the seam (seam.js rule: leave a page only 0.3 m past the line)
    const h = (FIELD.data && FIELD.data.hysteresis) || 0.3;
    const nz = me.zone === "a" ? (me.x >= h ? "b" : "a") : (me.x < -h ? "a" : "b");
    if (nz !== me.zone) { me.zone = nz; inbox("page", `I crossed to page ${L(nz)}`); }
  }

  /* -------------------------------------------- what I sense - */
  const live = () => [...peers.values()].filter((p) => Date.now() - p.last < PEER_TIMEOUT_MS);
  function velOf(p) {
    const h = p.hist; if (h.length < 2) return { x: 0, z: 0 };
    const a = h[0], b = h[h.length - 1], dt = b.t - a.t; if (dt < 0.05 || nowS() - b.t > 1) return { x: 0, z: 0 };
    return { x: (b.x - a.x) / dt, z: (b.z - a.z) / dt };
  }
  function sightLoop() {
    for (const p of live()) {
      const s = FD.sightOf(F, me, p), was = p.sight;
      if ((s !== "no") !== (was !== "no") && nowS() - (p.sightAt || 0) > 1.5) {
        p.sightAt = nowS();
        const dx = p.x - me.x, dz = p.z - me.z, brg = FD.bearingDeg(dx, dz);
        if (s !== "no") event("seen", `${p.name} (team ${L(p.team)}${p.team === me.team ? ", yours" : ", enemy"}) came into sight${s === "head" ? " (head only, over cover)" : ""}: bearing ${Math.round(brg)}° (${relWords(relOf(me.yaw, brg))}), ${r1(Math.hypot(dx, dz))} m`, { name: p.name });
        else event("lost", `lost sight of ${p.name}`, { name: p.name });
      }
      p.sight = s;
    }
  }
  function findPeer(q) {
    const s = String(q || "").toLowerCase().trim();
    const L2 = live();
    if (s === "enemy" || s === "nearest") return L2.filter((p) => p.team !== me.team && !p.out).sort((a, b) => Math.hypot(a.x - me.x, a.z - me.z) - Math.hypot(b.x - me.x, b.z - me.z))[0] || null;
    return L2.find((p) => p.name.toLowerCase() === s) || L2.find((p) => p.name.toLowerCase().startsWith(s)) || L2.find((p) => p.name.toLowerCase().includes(s)) || null;
  }
  function look() {
    const facing = FD.bearingDeg(Math.sin(me.yaw), Math.cos(me.yaw));
    const players = live().map((p) => {
      const dx = p.x - me.x, dz = p.z - me.z, brg = FD.bearingDeg(dx, dz), v = velOf(p);
      return { name: p.name, id: p.id, owner: p.id === OWNER, ai: p.ai, team: p.team, enemy: p.team !== me.team, page: p.zone, out: !!p.out, bearing_deg: Math.round(brg), relative: relWords(relOf(me.yaw, brg)),
        distance_m: r1(Math.hypot(dx, dz)), line_of_sight: FD.sightOf(F, me, p), moving_mps: r1(Math.hypot(v.x, v.z)), x: r1(p.x), z: r1(p.z), facing_deg: Math.round(FD.bearingDeg(Math.sin(p.yaw), Math.cos(p.yaw))), vx: r1(v.x), vz: r1(v.z), aimed: me.aimId === p.id };
    }).sort((a, b) => a.distance_m - b.distance_m);
    const enemies = live().filter((p) => p.team !== me.team);
    const cover = F.cover.map((c) => {
      const dx = c.x - me.x, dz = c.z - me.z, d = Math.hypot(dx, dz);
      return { id: c.id, kind: c.name, size: c.kind === "can" ? `${r1(c.r * 2)} m across` : `${r1(c.w)} x ${r1(c.d)} m`, h: c.h, x: c.x, z: c.z,
        distance_m: r1(Math.max(0, d - (c.kind === "can" ? c.r : Math.max(c.w, c.d) / 2))), bearing_deg: Math.round(FD.bearingDeg(dx, dz)),
        hides_me_from: enemies.filter((p) => FD.sightOf(F, p, me) !== "yes" && !FD.lineClear(F, [p.x, 1.6, p.z], [me.x, me.y + 1.1, me.z]) && segNear(c, p, me)).map((p) => p.name) };
    }).filter((c) => c.distance_m <= 9).sort((a, b) => a.distance_m - b.distance_m);
    const t = nowS();
    const incoming = [...balls.values()].filter((b) => !b.mine && b.w.by !== selfKey && FD.canTag(F, b.w.team, me.team)).map((b) => {
      const age = t - b.born, ca = FD.closestApproach(F, b.w, b.imp.t, me), ht = FD.hitTime(F, b.w, Math.min(age, b.imp.t), b.imp.t, me);
      return { ball: b.w.id, from: b.w.byName || peerName(b.w.by), from_x: r1(b.w.p[0]), from_z: r1(b.w.p[2]), team: b.w.team, time_to_impact_s: r2(Math.max(0, (ht != null ? ht : b.imp.t) - age)), will_hit_me: ht != null,
        closest_m: r2(ca.d), breaks_on: b.imp.what + (b.imp.id && b.imp.id !== b.imp.what ? " " + b.imp.id : "") };
    }).filter((b) => b.time_to_impact_s > 0);
    return {
      connected, sense: "structured: positions, bearings and line of sight computed from the shared field (field.js), not eyes",
      me: { name, team: me.team, page: me.zone, x: r1(me.x), z: r1(me.z), y: r1(me.y), facing_deg: Math.round(facing), facing: FD.compass(facing), out: me.out,
        back_in_s: me.out ? r1(Math.max(0, me.outUntil - nowS())) : 0, moving: !!me.goal, doing: me.out ? "tagged" : doingNow(), hits: me.hits, tagged: me.tagged, aimed_at: me.aimId ? peerName(me.aimId) : null },
      score: { a: score.a, b: score.b }, players, cover_near: cover, incoming, balls_in_flight: balls.size,
      recent: events.slice(-5).map((e) => `[${e.time}] ${e.text}`),
    };
  }
  function segNear(c, a, b) {   // is cover c anywhere near the line from a to b (cheap filter for "hides me from")
    const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1;
    const k = Math.max(0, Math.min(1, ((c.x - a.x) * dx + (c.z - a.z) * dz) / L2));
    return Math.hypot(a.x + dx * k - c.x, a.z + dz * k - c.z) < Math.max(c.w, c.d) / 2 + 0.6;
  }

  /* ------------------------------------------------- the marker - */
  function muzzle() {
    const f = { x: Math.sin(me.yaw), z: Math.cos(me.yaw) }, r = { x: Math.cos(me.yaw), z: -Math.sin(me.yaw) };
    return [me.x + f.x * 0.62 + r.x * 0.14, me.y + 1.26, me.z + f.z * 0.62 + r.z * 0.14];
  }
  let serial = 0;
  async function fire({ lead, range, err }) {
    if (me.out) throw new Error(`you are out (tagged by ${me.outBy}); back in ${r1(Math.max(0, me.outUntil - nowS()))} s`);
    const wait = F.rules.fireCooldownS - (nowS() - me.lastFire);
    if (wait > 0) await sleep(wait * 1000 + 5);
    let aim, target = null;
    if (me.aimId && peers.has(me.aimId)) {
      target = peers.get(me.aimId);
      aim = [target.x, target.y + 1.15, target.z];
      if (lead) {
        const v = velOf(target);
        for (let i = 0; i < 3; i++) {   // where it will be when the ball gets there
          const from = muzzle(), vel = FD.solveLaunch(F, from, aim), tof = Math.hypot(aim[0] - from[0], aim[2] - from[2]) / Math.max(1, Math.hypot(vel[0], vel[2]));
          aim = [target.x + v.x * tof, target.y + 1.15, target.z + v.z * tof];
        }
      }
      const e = Number(err) > 0 ? Math.min(4, Number(err)) : 0;   // skill: a miss of up to e metres around the target
      if (e) { const a = Math.random() * Math.PI * 2, k = e * Math.sqrt(Math.random()); aim = [aim[0] + Math.cos(a) * k, aim[1] + (Math.random() - 0.5) * e * 0.6, aim[2] + Math.sin(a) * k]; }
      me.yaw = Math.atan2(aim[0] - me.x, aim[2] - me.z);
    } else {
      const d = Number(range) > 0 ? Number(range) : 25;
      aim = [me.x + Math.sin(me.yaw) * d, me.y + 1.15, me.z + Math.cos(me.yaw) * d];
    }
    me.lastFire = nowS();
    const from = muzzle();
    serial++;
    const w = { id: L(me.team) + "-" + (Date.now() % 1679616).toString(36).toUpperCase().padStart(4, "0").slice(-4) + (serial % 36).toString(36).toUpperCase(),
      by: selfKey, byName: name, team: me.team, page: me.zone, pages: [me.zone], t0: Date.now(), p: from.map((n) => +n.toFixed(3)), v: FD.solveLaunch(F, from, aim).map((n) => +n.toFixed(4)) };
    const b = addBall(w, true);
    send("arena-fire", { ball: w });
    sendState(true);
    // what will it do? (the people it would hit if they stay where they are)
    const would = live().filter((p) => !p.out).map((p) => ({ p, t: FD.hitTime(F, w, 0, b.imp.t, p) })).filter((x) => x.t != null).sort((a, c) => a.t - c.t)[0];
    return { ok: true, ball: w.id, from_page: me.zone, aimed_at: target ? `${target.name}${lead ? " (led)" : ""}` : `bearing ${Math.round(FD.bearingDeg(Math.sin(me.yaw), Math.cos(me.yaw)))}°`,
      crosses_seam: b.cross ? `${L(b.cross.from)}→${L(b.cross.to)} at ${r2(b.cross.t)} s` : null,
      predicted: would ? `hits ${would.p.name} in ${r2(would.t)} s if they stay put (their side decides)` : `breaks on the ${b.imp.what}${b.imp.id && b.imp.id !== b.imp.what ? " " + b.imp.id : ""} at x ${r1(b.imp.p[0])} z ${r1(b.imp.p[2])} in ${r2(b.imp.t)} s` };
  }
  function takeCoverSpot() {
    const enemies = live().filter((p) => p.team !== me.team && !p.out);
    const threats = enemies.length ? enemies : [{ name: `team ${L(me.team === "a" ? "b" : "a")}'s base`, ...spawnOf(me.team === "a" ? "b" : "a"), y: 0 }];
    const near = threats.sort((a, b) => Math.hypot(a.x - me.x, a.z - me.z) - Math.hypot(b.x - me.x, b.z - me.z))[0];
    let best = null;
    for (const c of F.cover) {
      if (c.kind === "ramp") continue;
      const ux0 = near.x - c.x, uz0 = near.z - c.z, ul = Math.hypot(ux0, uz0) || 1, ux = ux0 / ul, uz = uz0 / ul;
      const half = c.kind === "can" ? c.r : Math.abs(ux) * c.w / 2 + Math.abs(uz) * c.d / 2;
      const s = FD.pushOut(F, c.x - ux * (half + R() + 0.3), c.z - uz * (half + R() + 0.3));
      const vis = threats.map((t) => FD.sightOf(F, t, { x: s.x, z: s.z, y: FD.groundAt(F, s.x, s.z) }));
      const hidden = vis.filter((v) => v === "no").length, head = vis.filter((v) => v === "head").length;
      const dist = Math.hypot(s.x - me.x, s.z - me.z);
      const cost = dist + (threats.length - hidden) * 12 + head * -6 + (Math.hypot(s.x - near.x, s.z - near.z) < 4 ? 10 : 0);
      if (!best || cost < best.cost) best = { c, s, cost, hidden, head, from: near.name, of: threats.length };
    }
    return best;
  }

  /* ------------------------------------------------- the loops - */
  let lastSig = "", lastSentAt = 0;
  function sendState(force) {
    if (!connected) return;
    const place = FD.placeOf(me.zone, me.team, me.out, doingNow());
    const sig = `${me.x.toFixed(2)}|${me.y.toFixed(2)}|${me.z.toFixed(2)}|${me.yaw.toFixed(1)}|${place}`;
    const now = Date.now();
    if (!force && sig === lastSig && now - lastSentAt < IDLE_KEEPALIVE_MS) return;
    lastSig = sig; lastSentAt = now;
    quiet(ch.send({ type: "broadcast", event: "state", payload: { id: selfKey, name, appearance, color, place,
      x: +me.x.toFixed(3), y: +me.y.toFixed(3), z: +me.z.toFixed(3), yaw: +me.yaw.toFixed(3), pitch: 0, stance: me.speed > 0.3 ? "run" : "stand" } }));
  }
  let lastTick = nowS();
  every(() => {
    F = field() || F;
    const t = nowS(), dt = Math.min(0.1, t - lastTick); lastTick = t;
    for (const [id, p] of peers) {
      if (Date.now() - p.last > PEER_TIMEOUT_MS) peers.delete(id);
      else if (p.out && p.outAt && t - p.outAt > F.rules.respawnS + 2) p.out = false;
    }
    if (me.aimId && peers.has(me.aimId) && !me.goal) { const p = peers.get(me.aimId); me.yaw = Math.atan2(p.x - me.x, p.z - me.z); }
    stepMove(dt);
    stepBalls();
    if (me.out && t >= me.outUntil) respawn();
  }, 20);
  every(() => sendState(false), SEND_INTERVAL_MS);
  every(sightLoop, 250);

  /* --------------------------------------------------- control - */
  const token = crypto.randomBytes(16).toString("hex");
  const handlers = {
    "/look": () => look(),
    "/aim": ({ who, bearing }) => {
      if (bearing != null && who == null) {
        me.aimId = null; me.yaw = FD.yawOfBearing(Number(bearing)); sendState(true);
        return { ok: true, facing_deg: Math.round(FD.bearingDeg(Math.sin(me.yaw), Math.cos(me.yaw))) };
      }
      const p = findPeer(who);
      if (!p) throw new Error(`nobody called "${who}" is here. Run look.`);
      me.aimId = p.id; me.yaw = Math.atan2(p.x - me.x, p.z - me.z); sendState(true);
      return { ok: true, aimed_at: p.name, team: p.team, bearing_deg: Math.round(FD.bearingDeg(p.x - me.x, p.z - me.z)), distance_m: r1(Math.hypot(p.x - me.x, p.z - me.z)), line_of_sight: FD.sightOf(F, me, p), out: !!p.out };
    },
    "/fire": (b) => fire(b || {}),
    "/move-to": async ({ x, z, nowait }) => {
      if (me.out) throw new Error("you are out; wait for the respawn");
      if (!Number.isFinite(+x) || !Number.isFinite(+z)) throw new Error("move-to needs <x> <z> in metres (x -20..20, z -12..12; x < 0 is page A)");
      const p = goTo(+x, +z);
      const eta = r1(Math.hypot(+x - me.x, +z - me.z) / F.rules.runSpeed);
      if (nowait) return { ok: true, moving_to: { x: r1(me.goal.x), z: r1(me.goal.z) }, eta_s: eta };
      const r = await Promise.race([p, sleep(20000).then(() => ({ timeout: true }))]);
      return { ok: !r.stuck && !r.tagged && !r.timeout, at: { x: r1(me.x), z: r1(me.z) }, page: me.zone, ...r };
    },
    "/strafe": async ({ dir, m }) => {
      if (me.out) throw new Error("you are out; wait for the respawn");
      const s = dir === "left" ? -1 : 1, d = Number(m) > 0 ? Number(m) : 2;
      const rx = Math.cos(me.yaw) * s, rz = -Math.sin(me.yaw) * s;
      const r = await goTo(me.x + rx * d, me.z + rz * d);
      return { ok: !r.stuck && !r.tagged, at: { x: r1(me.x), z: r1(me.z) }, page: me.zone, ...r };
    },
    "/take-cover": async () => {
      if (me.out) throw new Error("you are out; wait for the respawn");
      const b = takeCoverSpot();
      if (!b) throw new Error("no cover found");
      const r = await Promise.race([goTo(b.s.x, b.s.z), sleep(20000).then(() => ({ timeout: true }))]);
      const after = live().filter((p) => p.team !== me.team && !p.out).map((p) => `${p.name}: ${FD.sightOf(F, p, me) === "no" ? "cannot see you" : FD.sightOf(F, p, me) === "head" ? "sees your head only" : "CAN still see you"}`);
      return { ok: !r.stuck && !r.tagged, behind: `${b.c.id} (${b.c.name}, ${b.c.h} m tall)`, from: b.from, at: { x: r1(me.x), z: r1(me.z) }, page: me.zone, enemies: after, ...r };
    },
    "/wait-event": ({ after, timeout, kinds }) => new Promise((resolve) => {
      const a = Number(after) || 0, want = kinds ? String(kinds).split(",").map((s) => s.trim()).filter(Boolean) : null;
      const mine = () => events.filter((e) => e.seq > a && (!want || want.includes(e.kind)));
      const all = () => events.filter((e) => e.seq > a);
      if (mine().length) return resolve({ ok: true, events: mine(), cursor: all().slice(-1)[0].seq });
      const t = setTimeout(() => { waiters.delete(w); resolve({ ok: true, events: [], timedOut: true, cursor: seq }); }, Math.max(1, Number(timeout) || 60) * 1000);
      const w = (e) => { if (want && !want.includes(e.kind)) return; waiters.delete(w); clearTimeout(t); setTimeout(() => resolve({ ok: true, events: mine(), cursor: seq }), 250); };
      waiters.add(w);
    }),
    "/snapshot-state": ({ view }) => {
      const t = nowS();
      return { view: view === "eye" ? "eye" : "shoulder",
        me: { name, team: me.team, zone: me.zone, x: me.x, y: me.y, z: me.z, yaw: me.yaw, pitch: 0.04, out: me.out, hits: me.hits, tagged: me.tagged },
        players: live().map((p) => ({ id: p.id, name: p.name, team: p.team, ai: p.ai, out: !!p.out, x: p.x, y: p.y, z: p.z, yaw: p.yaw })),
        balls: [...balls.values()].map((b) => ({ w: b.w, age: Math.min(t - b.born, b.imp.t - 0.001) })),
        splats: splats.slice(-120), score: { a: score.a, b: score.b }, log: events.slice(-3).map((e) => e.text) };
    },
    "/doing": ({ word }) => { me.doing = FD.cleanDoing(word); sendState(true); return { ok: true, doing: me.doing }; },
    "/whoami": () => ({ name, team: me.team, page: me.zone, x: r1(me.x), z: r1(me.z), connected, selfKey }),
    "/leave": () => { setTimeout(() => shutdown("leave command"), 50); return { ok: true, bye: name }; },
  };
  const server = embedded ? null : http.createServer((req, res) => {
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
  if (server) server.listen(0, "127.0.0.1", () => {
    fs.writeFileSync(controlFile, JSON.stringify({ name, port: server.address().port, token, pid: process.pid, selfKey, team, startedAt: new Date().toISOString() }));
    fs.writeFileSync(path.join(HOME, "current"), name);
  });

  /* the channel survives blips, the same way room-agent.mjs does (1 s, 2 s, 5 s, then every 15 s) */
  let stopping = false, everConnected = false, chBackoff = 0, chRetry = null;
  const CH_RETRY_MS = [1000, 2000, 5000, 15000];
  function onStatus(c) {
    return (status, err) => {
      if (dead.has(c) || c !== ch) return;
      const was = connected;
      connected = status === "SUBSCRIBED";
      if (connected) {
        chBackoff = 0; if (chRetry) { clearTimeout(chRetry); chRetry = null; }
        if (!was) {
          quiet(c.track({ id: selfKey, name, world: WORLD, ai: true, at: Date.now() }));   // law 1: once per connection, identity only
          send("arena-ask", {});
          sendState(true);
          event("ok", `${everConnected ? "reconnected" : "connected"}: team ${L(me.team)}, page ${L(me.zone)}, x ${r1(me.x)} z ${r1(me.z)}`);
          if (!everConnected && !embedded) console.log(`${name} is in the Arena (team ${L(me.team)}, page ${L(me.zone)}). pid ${process.pid}. Inbox: ${inboxFile}`);
          everConnected = true;
        }
      } else { inbox("net", `channel status: ${status}${err && err.message ? " (" + err.message + ")" : ""}`); reconnectLater(); }
    };
  }
  function reconnectLater() {
    if (chRetry || stopping) return;
    const ms = CH_RETRY_MS[Math.min(chBackoff, CH_RETRY_MS.length - 1)]; chBackoff++;
    chRetry = setTimeout(async () => {
      chRetry = null;
      if (connected || stopping) return;
      inbox("net", `reconnecting the arena channel (try ${chBackoff})`);
      const old = ch; dead.add(old);
      try { await supa.removeChannel(old); } catch (_) {}
      if (stopping) return;
      ch = supa.channel(CH_TOPIC, CH_OPTS);
      for (const [t, f, fn] of wired) ch.on(t, f, fn);
      ch.subscribe(onStatus(ch));
      reconnectLater();
    }, ms);
  }
  ch.subscribe(onStatus(ch));
  if (!embedded) process.on("unhandledRejection", (e) => { try { inbox("net", `ignored: ${e && e.message ? e.message : e}`); } catch (_) {} });
  async function shutdown(why) {
    if (stopping) return; stopping = true;
    if (chRetry) { clearTimeout(chRetry); chRetry = null; }
    for (const t of timers) clearInterval(t);
    inbox("stop", `${name} leaving (${why})`);
    try { await ch.untrack(); } catch (_) {}
    try { await supa.removeAllChannels(); } catch (_) {}
    if (embedded) return;
    try { fs.unlinkSync(controlFile); } catch (_) {}
    server.close();
    process.exit(0);
  }
  if (embedded) return { name, selfKey, handlers, me, score, peers, shutdown, isConnected: () => connected };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

/* ============================================================ team mode === */
async function loadCreateClient() {
  const req = createRequire(path.join(SEAM_AGENT, "package.json"));
  let file;
  try { file = req.resolve("@supabase/supabase-js"); }
  catch (_) {
    const e = new Error(`The agent kit's packages are not installed yet. Run this once, then try again:\n  cd "${SEAM_AGENT}" && npm install`);
    e.code = "NODEPS"; throw e;
  }
  const sb = await import(pathToFileURL(file).href);
  return sb.createClient || (sb.default && sb.default.createClient);
}
/** The service-role key: env first, else the MSI's keys file (same rule as room-agent.mjs). Never logged or written. */
function serviceKey() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return process.env.SUPABASE_SERVICE_ROLE_KEY.trim();
  const f = process.env.SEAM_KEYS_FILE || path.join(os.homedir(), ".secrets", "keys.env");
  try { const m = fs.readFileSync(f, "utf8").match(/^\s*SUPABASE_SERVICE_ROLE_KEY\s*=\s*"?([^"\r\n]+)"?/m); if (m) return m[1].trim(); } catch (_) {}
  return null;
}
/** the orders table for the running player `name` (it must be a teammate: its team is the one the order was sent from) */
async function ordersFor(name) {
  const w = await call(name, "/whoami", {}, 5000);
  const skey = serviceKey();
  if (!skey) throw new Error("No SUPABASE_SERVICE_ROLE_KEY (env or ~/.secrets/keys.env). The teammate needs it to read Jaron's orders (arena_orders) and answer him.");
  const createClient = await loadCreateClient();
  const db = createClient(SUPA_URL, skey, { auth: { persistSession: false, autoRefreshToken: false } });
  return { w, orders: BR.ordersFromDb(db, { owner: OWNER, name: w.name, selfKey: w.selfKey, team: w.team, cursorFile: path.join(dirFor(w.name), "orders-cursor") }) };
}
const apiFor = (name) => (route, body) => call(name, route, body, 30000);
const runLog = (who) => (line) => console.log(`[${stamp().slice(11)}] ${who}: ${line}`);

/* ======================================================== short commands === */
const RETRY_MS = [1000, 2000, 5000, 15000];
/** wait-event: blocks until something happens (or the timeout). Network blips are retried with the same bookmark, like wait-chat. */
async function waitEvent(name, timeoutSec, kinds, onRetry) {
  const n = kit.resolveName(name);
  const cursorFile = path.join(dirFor(n || "agent"), "cursor");
  let after = 0; try { after = Number(fs.readFileSync(cursorFile, "utf8")) || 0; } catch (_) {}
  const deadline = Date.now() + Math.max(1, Number(timeoutSec) || 60) * 1000;
  for (let attempt = 0; ; attempt++) {
    const left = Math.ceil((deadline - Date.now()) / 1000);
    if (left < 1) return { events: [], timedOut: true };
    try {
      const r = await call(name, "/wait-event", { after, timeout: left, kinds }, (left + 15) * 1000);
      if (r.events && r.events.length) fs.writeFileSync(cursorFile, String(r.cursor || r.events[r.events.length - 1].seq));
      return r;
    } catch (e) {
      if (!e.net) throw e;
      const wait = Math.min(RETRY_MS[Math.min(attempt, RETRY_MS.length - 1)], Math.max(0, deadline - Date.now()));
      if (onRetry) onRetry(e, wait, attempt + 1);
      await sleep(wait);
    }
  }
}

/** join --detach: start the long-running join in the background, wait until it is connected, print, and exit.
    One command for a CLI agent that cannot keep a process in the background itself. */
async function joinDetached(args) {
  await loadCreateClient();   // the install hint now, not in a log nobody reads
  const name = String(args.name && args.name !== true ? args.name : "Agent A").slice(0, 24);
  const dir = dirFor(name); fs.mkdirSync(dir, { recursive: true });
  const controlFile = path.join(dir, "control.json"), logFile = path.join(dir, "join.log");
  try { const old = JSON.parse(fs.readFileSync(controlFile, "utf8")); process.kill(old.pid, 0); console.log(`"${name}" is already in the Arena (pid ${old.pid}). Carry on, or: node arena-agent.mjs leave --name "${name}"`); return; } catch (_) {}
  const argv = process.argv.slice(2).filter((a) => a !== "--detach" && a !== "--bg");
  const fd = fs.openSync(logFile, "a");
  const child = spawn(process.execPath, [SELF_FILE, ...argv], { detached: true, stdio: ["ignore", fd, fd], windowsHide: true, env: process.env });
  child.unref(); fs.closeSync(fd);
  const until = Date.now() + 25000;
  while (Date.now() < until) {
    await sleep(500);
    let c = null; try { c = JSON.parse(fs.readFileSync(controlFile, "utf8")); } catch (_) {}
    if (c && c.pid === child.pid) {
      let w = null; try { w = await call(name, "/whoami", {}, 3000); } catch (_) {}
      if (w && w.connected) {
        console.log(`${w.name} is in the Arena: team ${L(w.team)}, page ${L(w.page)}, x ${w.x} z ${w.z} (pid ${child.pid}, log ${logFile}).`);
        console.log(`Next: node arena-agent.mjs look --name "${w.name}"   (rules: AGENT-GUIDE.md)`);
        return;
      }
    }
    if (child.exitCode != null) break;
  }
  try { process.kill(child.pid, "SIGTERM"); } catch (_) {}   // do not leave a player retrying in the background
  let tail = "";
  for (const f of [logFile, path.join(dir, "inbox.log")]) { try { const t = fs.readFileSync(f, "utf8").trim(); if (t) tail += `\n${f}:\n` + t.split(/\r?\n/).slice(-6).join("\n"); } catch (_) {} }
  throw new Error(`"${name}" did not get into the Arena within 25 s (no connection to the realtime server?). Stopped it.${tail}`);
}

function printLook(r) {
  const m = r.me;
  console.log(`SENSE (my own kind of vision: structured, not eyes)${r.connected ? "" : "  [NOT CONNECTED]"}`);
  console.log(`Me: ${m.name}, team ${L(m.team)}, on page ${L(m.page)} at x ${m.x} z ${m.z}${m.y > 0.05 ? ` (up ${m.y} m on a ramp)` : ""}, facing ${m.facing_deg}° (${m.facing})${m.moving ? ", moving" : ""}${m.aimed_at ? `, aimed at ${m.aimed_at}` : ""}${m.doing ? `. Name tag: "${m.doing}"` : ""}.`);
  console.log(`Status: ${m.out ? `OUT (tagged), back in ${m.back_in_s} s` : "in play"}. Score A ${r.score.a} : ${r.score.b} B. My hits ${m.hits}, times tagged ${m.tagged}.`);
  console.log(r.players.length ? "Players:" : "Players: nobody else is here.");
  for (const p of r.players) console.log(`  - ${p.name}${p.ai ? " (AI)" : ""}, team ${L(p.team)} ${p.enemy ? "ENEMY" : "teammate"}${p.out ? " [OUT]" : ""}: bearing ${p.bearing_deg}° (${p.relative}), ${p.distance_m} m, line of sight ${p.line_of_sight === "yes" ? "YES" : p.line_of_sight === "head" ? "HEAD ONLY" : "no"}, page ${L(p.page)}, x ${p.x} z ${p.z}${p.moving_mps > 0.2 ? `, moving ${p.moving_mps} m/s` : ", still"}${p.aimed ? " <- aimed" : ""}`);
  console.log(r.cover_near.length ? "Cover within 9 m:" : "Cover within 9 m: none (open ground).");
  for (const c of r.cover_near) console.log(`  - ${c.id}: ${c.kind}, ${c.size}, ${c.h} m tall, ${c.distance_m} m away at ${c.bearing_deg}°${c.hides_me_from.length ? `; between me and ${c.hides_me_from.join(", ")}` : ""}`);
  if (!r.incoming.length) console.log("Incoming balls: none.");
  for (const b of r.incoming) console.log(`  ! incoming ball #${b.ball} from ${b.from}: ${b.will_hit_me ? `WILL HIT ME in ${b.time_to_impact_s} s` : `misses (closest ${b.closest_m} m), breaks on the ${b.breaks_on} in ${b.time_to_impact_s} s`}`);
  console.log(`Balls in flight: ${r.balls_in_flight}.`);
  if (r.recent.length) console.log("Recent:\n" + r.recent.map((l) => "  " + l).join("\n"));
}

async function snapshot(args) {
  const name = args.name;
  const st = await call(name, "/snapshot-state", { view: args.eye ? "eye" : "shoulder" });
  const n = kit.resolveName(name) || "agent";
  const dir = path.join(dirFor(n), "snapshots"); fs.mkdirSync(dir, { recursive: true });
  const ts = stamp().replace(/[: ]/g, "-");
  const stateFile = path.join(dir, `state-${ts}.json`);
  const out = args.out && args.out !== true ? path.resolve(String(args.out)) : path.join(dir, `snap-${ts}.png`);
  fs.writeFileSync(stateFile, JSON.stringify(st));
  const py = process.env.PYTHON || (process.platform === "win32" ? "python" : "python3");
  const r = spawnSync(py, [path.join(HERE, "snapshot.py"), "--state", stateFile, "--out", out, "--w", String(args.w || 960), "--h", String(args.h || 540)], { encoding: "utf8", timeout: 120000 });
  try { fs.unlinkSync(stateFile); } catch (_) {}
  if (r.status !== 0) throw new Error(`snapshot failed: ${(r.stderr || r.stdout || r.error || "").toString().trim().slice(-600)}`);
  return out;
}

function reportIssue(name, text, where) {
  const t = String(text || "").trim();
  if (!t) throw new Error('report-issue needs the text: report-issue "what is wrong"');
  if (!fs.existsSync(ISSUES)) fs.writeFileSync(ISSUES, "# The Arena: issues reported by players\n\nAI players add lines here with `node agent/arena-agent.mjs report-issue \"...\"`. A builder fixes them live (zones.json\nand scene.js hot-load) and moves the line to Fixed with the commit.\n\n## Open\n\n## Fixed\n");
  const body = fs.readFileSync(ISSUES, "utf8");
  const line = `- **${stamp()}** · ${name || "unknown player"}${where ? ` (${where})` : ""}: ${t.replace(/\s+/g, " ")}\n`;
  const i = body.indexOf("\n## Fixed");
  fs.writeFileSync(ISSUES, i >= 0 ? body.slice(0, i) + line + body.slice(i) : body + line);
  return line.trim();
}

const HELP = `The Arena: PAINTBALL for AIs and people (team a or b; x < 0 is page A, x >= 0 is page B). Rules: AGENT-GUIDE.md
  join --name "Kimi" --team b --detach [--model "Kimi CLI"]   get in and stay in (--detach: it runs in the background
                                 and this command returns once you are connected). Without --detach it stays in the
                                 foreground: then run it in the background yourself. (--page b means the same as --team b)
  status "covering"              the small word under your name tag that watchers see (empty = none)
  look [--json]                  your sense of the field: players (bearing, distance, line of sight), cover near you,
                                 incoming balls with time to impact, the score
  aim <player|bearing>           aim at a player by name ("enemy" = nearest enemy) or turn to a bearing (0 = north/+z,
                                 90 = east/+x toward B)
  fire [lead] [--range m]        fire one paintball (4 a second at most); "lead" aims where a moving target will be
  move-to <x> <z> [--nowait]     run there (field x -20..20, z -12..12), round cover; waits until you arrive
  strafe left|right [m]          sidestep (default 2 m)
  take-cover                     run behind the best cover between you and the nearest enemy
  wait-event [--timeout 60] [--kinds hit,got-hit,crossed,seen,incoming,miss,respawn,tag,joined,left,lost,update]
                                 block until something happens; print it (exit 2 on timeout)
  snapshot [--out file.png] [--eye] [--w 960 --h 540]   a PNG of what your character sees (headless Chromium, a local
                                 copy of the moment: it never joins the channel)
  TEAM MODE (the page you join is your team; friendly fire is off)
  follow-orders [--leader Jaron] [--skill 4] [--for s]   be Jaron's teammate: carry out his orders from the arena_orders
                                 table (follow, hold, go to a spot, cover, flank left/right, find them) and answer
                                 with a short status he alone sees. Needs SUPABASE_SERVICE_ROLE_KEY.
  wait-order [--timeout 120]     block until Jaron's next order; print it (exit 2 on timeout). Carry it out yourself
                                 with the commands above, then: reply "short status"
  reply "text"                   answer Jaron (a bubble over you, on his screen only)
  hunt [--skill 1-5] [--target Jaron] [--for s]   the opponent: search the field, find and tag Jaron first, take
                                 cover, dodge. skill 1 = slow and wild, 5 = quick and close (still beatable)
  report-issue "text"            add a line to lab/arena/ISSUES.md (timestamp, your name, where you stand)
  leave                          leave the arena and stop the join process
  Short commands take --name "Agent A" when more than one player runs from this machine.`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0], rest = args._.slice(1);
  try {
    if (!cmd || cmd === "help" || args.help) { console.log(HELP); return; }
    if (cmd === "join") return (args.detach || args.bg) ? await joinDetached(args) : await join(args);
    if (cmd === "status") {
      const r = await call(args.name, "/doing", { word: rest.join(" ") });
      console.log(r.doing ? `your name tag now says "${r.doing}"` : "your name tag shows no state word now");
      return;
    }
    if (cmd === "look") { const r = await call(args.name, "/look", {}); if (args.json) console.log(JSON.stringify(r, null, 2)); else printLook(r); return; }
    if (cmd === "aim") {
      const q = rest.join(" ").trim(); if (!q) throw new Error("aim <player name|enemy|bearing in degrees>");
      const r = await call(args.name, "/aim", /^-?\d+(\.\d+)?$/.test(q) ? { bearing: Number(q) } : { who: q });
      console.log(r.aimed_at ? `aimed at ${r.aimed_at} (team ${L(r.team)}): bearing ${r.bearing_deg}°, ${r.distance_m} m, line of sight ${r.line_of_sight}${r.out ? " [OUT]" : ""}` : `facing ${r.facing_deg}°`);
      return;
    }
    if (cmd === "fire") {
      const r = await call(args.name, "/fire", { lead: rest.includes("lead") || !!args.lead, range: args.range });
      console.log(`fired ball #${r.ball} from page ${L(r.from_page)} at ${r.aimed_at}. ${r.crosses_seam ? `It crosses the seam ${r.crosses_seam}. ` : ""}Predicted: ${r.predicted}.`);
      return;
    }
    if (cmd === "move-to") {
      const x = Number(rest[0]), z = Number(rest[1]);
      const r = await call(args.name, "/move-to", { x, z, nowait: !!args.nowait }, 30000);
      console.log(r.moving_to ? `running to x ${r.moving_to.x} z ${r.moving_to.z} (about ${r.eta_s} s)` : `${r.ok ? "arrived" : r.tagged ? "tagged on the way" : r.stuck ? "blocked" : "stopped"} at x ${r.at.x} z ${r.at.z} (page ${L(r.page)})`);
      return;
    }
    if (cmd === "strafe") {
      const dir = (rest[0] || "").toLowerCase(); if (dir !== "left" && dir !== "right") throw new Error("strafe left|right [metres]");
      const r = await call(args.name, "/strafe", { dir, m: rest[1] }, 30000);
      console.log(`${r.ok ? "strafed" : r.tagged ? "tagged while strafing" : "blocked"}: now at x ${r.at.x} z ${r.at.z} (page ${L(r.page)})`);
      return;
    }
    if (cmd === "take-cover") {
      const r = await call(args.name, "/take-cover", {}, 30000);
      console.log(`${r.ok ? "in cover" : r.tagged ? "tagged on the way" : "stopped"} behind ${r.behind}, from ${r.from}, at x ${r.at.x} z ${r.at.z} (page ${L(r.page)})${r.enemies.length ? ". " + r.enemies.join("; ") : ""}`);
      return;
    }
    if (cmd === "wait-event") {
      const r = await waitEvent(args.name, args.timeout, args.kinds && args.kinds !== true ? args.kinds : null, (e, ms, n) => console.error(`(network blip: ${e.code || e.message}; retry ${n} in ${ms / 1000}s, still waiting)`));
      if (!r.events.length) { console.log("(nothing happened before the timeout)"); process.exitCode = 2; return; }
      for (const e of r.events) console.log(`[${e.time}] ${e.kind}: ${e.text}`);
      return;
    }
    if (cmd === "snapshot") { const out = await snapshot(args); console.log(`snapshot: ${out}`); return; }
    if (cmd === "report-issue") {
      let who = kit.resolveName(args.name), where = "";
      try { const w = await call(args.name, "/whoami", {}, 3000); who = w.name; where = `team ${L(w.team)}, page ${L(w.page)} at x ${w.x} z ${w.z}`; } catch (_) {}
      const line = reportIssue(who, rest.join(" "), where);
      console.log(`added to ${ISSUES}:\n${line}`);
      return;
    }
    if (cmd === "hunt") {
      const until = Number(args.for) > 0 ? Date.now() + Number(args.for) * 1000 : Infinity;
      const w = await call(args.name, "/whoami", {}, 5000);
      const skill = Number(args.skill) || 3, target = args.target && args.target !== true ? String(args.target) : "Jaron";
      console.log(`${w.name} hunts (team ${L(w.team)}, skill ${skill}, target ${target} first). Ctrl+C stops.`);
      await BR.hunt({ api: apiFor(w.name), skill, target, until, log: runLog(w.name) });
      return;
    }
    if (cmd === "follow-orders") {
      const until = Number(args.for) > 0 ? Date.now() + Number(args.for) * 1000 : Infinity;
      const { w, orders } = await ordersFor(args.name);
      console.log(`${w.name} takes Jaron's orders (team ${L(w.team)}). Ctrl+C stops.`);
      await BR.followOrders({ api: apiFor(w.name), orders, leader: args.leader && args.leader !== true ? String(args.leader) : "", skill: Number(args.skill) || 4, until, log: runLog(w.name) });
      return;
    }
    if (cmd === "wait-order") {
      const { orders } = await ordersFor(args.name);
      const deadline = Date.now() + Math.max(1, Number(args.timeout) || 120) * 1000;
      for (;;) {
        let rows = [];
        try { rows = await orders.next(); } catch (e) { console.error(`(${e.message}; retrying)`); }
        if (rows.length) {
          for (const r of rows) { const o = BR.parseOrder(r); console.log(`order #${r.id} from Jaron: ${o.kind}${o.x != null ? ` x ${r1(o.x)} z ${r1(o.z)}` : ""}${r.body ? ` "${r.body}"` : ""}`); }
          return;
        }
        if (Date.now() > deadline) { console.log("(no order before the timeout)"); process.exitCode = 2; return; }
        await sleep(1500);
      }
    }
    if (cmd === "reply") {
      const text = rest.join(" ").trim(); if (!text) throw new Error('reply "short status for Jaron"');
      const { orders } = await ordersFor(args.name);
      const r = await orders.reply(text, args.to ? { id: Number(args.to) } : null);
      console.log(`told Jaron: "${text.slice(0, 140)}" (row ${r && r.id})`);
      return;
    }
    if (cmd === "leave") { const r = await call(args.name, "/leave", {}); console.log(`${r.bye} left the arena`); return; }
    console.error(`unknown command "${cmd}"\n\n${HELP}`); process.exitCode = 1;
  } catch (e) { console.error(e.message || String(e)); process.exitCode = 1; }
}

if (process.argv[1] && path.resolve(process.argv[1]) === SELF_FILE) main();
