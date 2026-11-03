#!/usr/bin/env node
/* ============================================================================
   team_sim.mjs - TEAM MODE, offline: a scripted "Jaron", his AI teammate in
   follow-orders mode, and an AI hunter in hunt mode, all in one Node process
   on a FAKE realtime layer (no network, no Supabase, no browser).

     node lab/arena/test/team_sim.mjs            (about 2-3 minutes, real time)
     node lab/arena/test/team_sim.mjs --skill 3  (the hunter's skill; default 4)

   The three players are the real arena-agent.mjs `join` (embedded: no control
   server) on a fake channel that delivers broadcasts with 10-40 ms of delay.
   The orders table is a fake too (rows in memory, the service role's view);
   the RLS itself is checked separately by test/orders_rls.sh on a real Postgres.

   Checks:
     1. orders get carried out: go to a spot, follow me, hold here, flank left,
        free text ("come with me"), and each gets a short status reply row
     2. only Jaron's rows count: a row from another user id, and an 'ai' row,
        are ignored; an order for another AI (to_name) is ignored
     3. friendly fire is off: the teammate fires straight at Jaron (the shot
        is predicted to hit him) and he is never tagged; no point is scored
     4. the hunter (team B) finds Jaron behind cover on team A's half and tags him
     5. "find them": the teammate goes hunting and reports a sighting
   ========================================================================== */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
process.env.ARENA_AGENT_HOME = fs.mkdtempSync(path.join(os.tmpdir(), "arena-sim-"));
const AG = await import(pathToFileURL(path.join(HERE, "..", "agent", "arena-agent.mjs")).href);
const BR = await import(pathToFileURL(path.join(HERE, "..", "agent", "arena-brains.mjs")).href);
const OWNER = "19689e52-05ad-4809-ad67-0d8600f02216";
const argv = process.argv.slice(2);
const SKILL = Number((argv[argv.indexOf("--skill") + 1]) || 4) || 4;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
const ts = () => ((Date.now() - t0) / 1000).toFixed(1).padStart(6) + "s";
const log = (who) => (line) => console.log(`${ts()}  ${who.padEnd(7)} ${line}`);

/* ------------------------------------------------ fake realtime layer - */
function fakeRealtime() {
  const chans = new Set();
  const later = (fn) => setTimeout(fn, 10 + Math.random() * 30);
  function channel(topic, opts) {
    const c = { topic, handlers: [], subscribed: false, meta: null, key: opts && opts.config && opts.config.presence && opts.config.presence.key };
    c.on = (type, filter, fn) => { c.handlers.push({ type, filter, fn }); return c; };
    c.subscribe = (cb) => { chans.add(c); setTimeout(() => { c.subscribed = true; cb && cb("SUBSCRIBED"); }, 20); return c; };
    c.send = async ({ type, event, payload }) => {
      const msg = JSON.parse(JSON.stringify(payload));   // what goes over the wire is JSON
      for (const o of chans) if (o !== c && o.subscribed && o.topic === topic)
        for (const h of o.handlers) if (h.type === type && h.filter.event === event) later(() => h.fn({ payload: msg }));
      return "ok";
    };
    c.track = async (meta) => { c.meta = meta; for (const o of chans) if (o !== c && o.topic === topic) for (const h of o.handlers) if (h.type === "presence" && h.filter.event === "join") later(() => h.fn({ newPresences: [meta] })); return "ok"; };
    c.untrack = async () => { const m = c.meta; c.meta = null; if (m) for (const o of chans) if (o !== c && o.topic === topic) for (const h of o.handlers) if (h.type === "presence" && h.filter.event === "leave") later(() => h.fn({ leftPresences: [m] })); return "ok"; };
    return c;
  }
  return () => ({ channel, removeChannel: async (c) => { chans.delete(c); }, removeAllChannels: async () => {} });
}

/* ------------------------------------------- fake arena_orders table - */
function fakeOrdersDb() {
  const rows = []; let id = 0;
  function builder(table) {
    const q = { filters: [], ord: null, lim: null, ins: null };
    const run = () => {
      if (table !== "arena_orders") return { data: null, error: { message: "no such table" } };
      if (q.ins) { const r = { id: ++id, created_at: new Date().toISOString(), ...q.ins }; rows.push(r); return { data: { id: r.id }, error: null }; }
      let out = rows.filter((r) => q.filters.every(([op, k, v]) => (op === "eq" ? r[k] === v : r[k] > v)));
      if (q.ord) out.sort((a, b) => (a[q.ord.k] - b[q.ord.k]) * (q.ord.asc ? 1 : -1));
      if (q.lim) out = out.slice(0, q.lim);
      return { data: out.map((r) => ({ ...r })), error: null };
    };
    const b = {
      select: () => b, eq: (k, v) => { q.filters.push(["eq", k, v]); return b; }, gt: (k, v) => { q.filters.push(["gt", k, v]); return b; },
      order: (k, o) => { q.ord = { k, asc: !o || o.ascending !== false }; return b; }, limit: (n) => { q.lim = n; return b; },
      insert: (obj) => { q.ins = obj; return b; }, single: () => b,
      then: (res, rej) => Promise.resolve(run()).then(res, rej),
    };
    return b;
  }
  return { from: builder, rows,
    order(kind, extra = {}) { const r = { id: ++id, user_id: OWNER, speaker: "human", kind, team: "a", created_at: new Date().toISOString(), body: "", ...extra }; rows.push(r); return r; },
    raw(extra) { const r = { id: ++id, created_at: new Date().toISOString(), ...extra }; rows.push(r); return r; } };
}

/* --------------------------------------------------------------- run - */
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok: !!ok, detail }); console.log(`${ts()}  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? " · " + detail : ""}`); };
const waitFor = async (fn, ms, step = 200) => { const end = Date.now() + ms; while (Date.now() < end) { const v = await fn(); if (v) return v; await sleep(step); } return null; };
const d = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

const createClient = fakeRealtime();
const db = fakeOrdersDb();
const jaron = await AG.join({ name: "Jaron", page: "a" }, { createClient, selfKey: OWNER, embedded: true, human: true });
const mate = await AG.join({ name: "Mate", page: "a", z: 2 }, { createClient, embedded: true });
const J = jaron.handlers, M = mate.handlers;
const mateApi = (route, body) => M[route](body || {});
await waitFor(() => jaron.isConnected() && mate.isConnected(), 3000);
await sleep(600);

const statuses = () => db.rows.filter((r) => r.speaker === "ai" && r.ai_key === mate.selfKey);
const lastStatus = () => (statuses().slice(-1)[0] || {}).body || "";
const statusAfter = (id) => statuses().filter((r) => r.reply_to === id).map((r) => r.body);
let stopAll = false;
const orders = BR.ordersFromDb(db, { owner: OWNER, name: "Mate", selfKey: mate.selfKey, team: "a" });
const mateRun = BR.followOrders({ api: mateApi, orders, log: log("Mate"), pollMs: 500, stop: () => stopAll });
const jaronGo = (x, z) => J["/move-to"]({ x, z, nowait: true });
const jaronAt = async (x, z, ms = 12000) => waitFor(() => d(jaron.me, { x, z }) < 0.6, ms);

console.log(`${ts()}  ----  phase 1: orders (no enemy on the field)`);
// 1. go to a tapped spot
let o = db.order("goto", { x: -8, z: 5, body: "Go to x -8.0, z 5.0" });
let ok = await waitFor(() => d(mate.me, { x: -8, z: 5 }) < 1.3 && statusAfter(o.id).some((s) => /In position/.test(s)), 15000);
check("goto: teammate runs to the tapped spot and says it is in position", ok, `at x ${mate.me.x.toFixed(1)} z ${mate.me.z.toFixed(1)}; replies: ${statusAfter(o.id).join(" | ")}`);

// 2. follow me
await jaronGo(-13, -6); await jaronAt(-13, -6);
o = db.order("follow", { body: "Follow me" });
ok = await waitFor(() => d(mate.me, jaron.me) < 3.8 && !mate.me.goal, 15000);
check("follow: teammate comes to Jaron", ok, `${d(mate.me, jaron.me).toFixed(1)} m apart; reply: ${statusAfter(o.id).join(" | ")}`);
await jaronGo(-16, 6); await jaronAt(-16, 6);
ok = await waitFor(() => d(mate.me, jaron.me) < 3.8, 12000);
check("follow: teammate keeps up when Jaron moves", ok, `${d(mate.me, jaron.me).toFixed(1)} m apart`);

// 3. hold here
o = db.order("hold", { body: "Hold here" });
await sleep(1200);
const held = { x: mate.me.x, z: mate.me.z };
await jaronGo(-6, -9); await jaronAt(-6, -9);
await sleep(1500);
check("hold: teammate stays put while Jaron walks away", d(mate.me, held) < 1.5 && d(mate.me, jaron.me) > 6, `moved ${d(mate.me, held).toFixed(2)} m; reply: ${statusAfter(o.id).join(" | ")}`);

// 4. flank left (Jaron faces east, toward team B: left is north, +z)
await J["/aim"]({ bearing: 90 });
o = db.order("flank-left", { body: "Flank left" });
ok = await waitFor(() => statusAfter(o.id).some((s) => /In position on the left/.test(s)), 20000);
check("flank left: teammate goes to Jaron's left (north of him) and reports", ok && mate.me.z > jaron.me.z + 3, `mate z ${mate.me.z.toFixed(1)} vs Jaron z ${jaron.me.z.toFixed(1)}; replies: ${statusAfter(o.id).join(" | ")}`);

// 5. free text
o = db.order("say", { body: "come with me" });
ok = await waitFor(() => statusAfter(o.id).length && d(mate.me, jaron.me) < 3.8, 15000);
check("free text 'come with me' = follow", ok && /Following|On you/.test(statusAfter(o.id)[0] || ""), `reply: ${statusAfter(o.id).join(" | ")}`);
o = db.order("say", { body: "do a backflip" });
ok = await waitFor(() => statusAfter(o.id).length, 5000);
check("an order it cannot read gets a plain answer, and the last order stands", ok && /didn't get/.test(statusAfter(o.id)[0] || ""), `reply: ${statusAfter(o.id).join(" | ")}`);

// 6. only Jaron's rows count
const before = statuses().length;
db.raw({ user_id: "00000000-0000-0000-0000-000000000bad", speaker: "human", kind: "hold", team: "a", body: "spoof" });
db.raw({ user_id: OWNER, speaker: "ai", kind: "hold", team: "a", body: "an ai row", ai_key: "someone-else" });
db.raw({ user_id: OWNER, speaker: "human", kind: "hold", team: "a", to_name: "Some Other AI", body: "not for Mate" });
db.raw({ user_id: OWNER, speaker: "human", kind: "hold", team: "b", body: "for team B" });
await sleep(1800);
check("rows from another user, 'ai' rows, orders for another AI or the other team are ignored", statuses().length === before, `status rows before ${before}, after ${statuses().length}`);

// 7. friendly fire is off
await sleep(500);
stopAll = true; await mateRun;            // pause the brain so it does not re-aim
const scoreBefore = { ...jaron.score };
const shots = [];
for (let i = 0; i < 4; i++) { await M["/aim"]({ who: "Jaron" }); shots.push(await M["/fire"]({})); }
await sleep(2500);
const predictedHits = shots.filter((s) => /hits Jaron/.test(s.predicted)).length;
check("friendly fire off: teammate's balls at Jaron never tag him", predictedHits >= 1 && jaron.me.tagged === 0 && jaron.score.a === scoreBefore.a && jaron.score.b === scoreBefore.b,
  `${shots.length} shots, ${predictedHits} predicted on target, Jaron tagged ${jaron.me.tagged}, score A ${jaron.score.a} : ${jaron.score.b} B`);

console.log(`${ts()}  ----  phase 2: the hunter (team B, skill ${SKILL}) looks for Jaron`);
stopAll = false;
const mateRun2 = BR.followOrders({ api: mateApi, orders, log: log("Mate"), pollMs: 500, stop: () => stopAll });
o = db.order("goto", { x: -17.5, z: -10.5, body: "Go to the corner" });   // out of the way: the hunter's own job
await waitFor(() => statusAfter(o.id).some((s) => /In position|Blocked/.test(s)), 15000);
await jaronGo(-12.6, 0.4); await jaronAt(-12.6, 0.4);   // behind A-block-1 (1.8 m: hides him from the east)
const hunter = await AG.join({ name: "Hunter", page: "b" }, { createClient, embedded: true });
await waitFor(() => hunter.isConnected(), 3000);
const hunterLog = [];
let stopHunt = false;
const huntRun = BR.hunt({ api: (r, b) => hunter.handlers[r](b || {}), skill: SKILL, target: "Jaron", log: (l) => { hunterLog.push(l); log("Hunter")(l); }, stop: () => stopHunt });
const tagStart = Date.now();
ok = await waitFor(() => jaron.me.tagged > 0, 150000, 250);
check("hunter finds Jaron (behind cover, other half) and tags him", ok && hunterLog.some((l) => /found Jaron/.test(l)),
  ok ? `tagged after ${((Date.now() - tagStart) / 1000).toFixed(1)} s by ${jaron.me.outBy}; score A ${jaron.score.a} : ${jaron.score.b} B` : `not tagged in 150 s; hunter log: ${hunterLog.slice(-6).join(" | ")}`);
check("the hit came from the other team and scored for B", jaron.me.outBy === "Hunter" && jaron.score.b >= 1, `out by ${jaron.me.outBy || "-"}, B ${jaron.score.b}`);

console.log(`${ts()}  ----  phase 3: "find them" (the teammate hunts the hunter)`);
o = db.order("find", { body: "Find them" });
ok = await waitFor(() => statusAfter(o.id).some((s) => /Found Hunter/.test(s)), 60000);
check("find them: teammate searches and reports the enemy it found", ok, `replies: ${statusAfter(o.id).join(" | ")}`);

stopAll = true; stopHunt = true;
await Promise.all([mateRun2, huntRun]);
for (const p of [jaron, mate, hunter]) await p.shutdown("test over");

console.log(`\nStatus rows Jaron would see (bubbles over Mate):\n${statuses().map((r) => `  #${r.id} -> order ${r.reply_to}: ${r.body}`).join("\n")}`);
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed${failed.length ? "; FAILED: " + failed.map((f) => f.name).join("; ") : ""}`);
try { fs.rmSync(process.env.ARENA_AGENT_HOME, { recursive: true, force: true }); } catch (_) {}
process.exit(failed.length ? 1 : 0);
