/* ============================================================================
   arena-brains.mjs - the two AI roles of TEAM MODE, driven only through the
   player's existing commands (look, aim, fire, move-to, strafe, take-cover):

     followOrders()  the TEAMMATE. Reads ONLY rows of public.arena_orders
                     (Jaron's orders; RLS lets nobody else write them) and
                     carries them out: follow, hold, go to a spot, cover,
                     flank left/right, find them. It answers with one short
                     status line, written back to the same table, which only
                     Jaron can read (a bubble over the teammate, on his screen).
     Hunter          the OPPONENT. Searches the field (patrol round the cover,
                     the last place it saw or heard someone, the hiding spots
                     next to it), prefers Jaron as its target, takes cover,
                     dodges balls it senses coming. A skill from 1 to 5 sets
                     its reaction delay and how far its shots stray, so it can
                     be beaten.

   `api(route, body)` is the player's control: in a real game it is the CLI's
   call() to the running `join`; in test/team_sim.mjs it is the handlers
   directly. Nothing here talks to the realtime channel.

   TRUST: an order is a row in arena_orders, never a broadcast. Who is "Jaron"
   on the field comes from the broadcast id (his auth uid), which is only used
   to know whom to follow or where he stands, never to accept a command.
   ========================================================================== */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FD = await import(pathToFileURL(path.join(HERE, "..", "field.js")).href);
export const ORDER_TABLE = "arena_orders";
export const ORDER_KINDS = ["follow", "hold", "goto", "cover", "flank-left", "flank-right", "find"];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const r1 = (n) => Math.round(n * 10) / 10;
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const clampField = (p, F) => ({ x: Math.max(-F.halfX + 1, Math.min(F.halfX - 1, p.x)), z: Math.max(-F.halfZ + 1, Math.min(F.halfZ - 1, p.z)) });
let FIELDCACHE = { m: 0, F: null };
function fieldNow() {   // the same zones.json the players use (hot-loaded by mtime)
  const f = path.join(HERE, "..", "zones.json");
  try { const m = fs.statSync(f).mtimeMs; if (m !== FIELDCACHE.m) FIELDCACHE = { m, F: FD.fieldFrom(JSON.parse(fs.readFileSync(f, "utf8"))) }; } catch (_) {}
  return FIELDCACHE.F;
}
function spawnOf(team) {
  const F = fieldNow(); const z = (F.zones || []).find((q) => q.id === team);
  return (z && z.spawn) || { x: team === "a" ? -17.5 : 17.5, z: 0 };
}
/** a spot to stand behind cover c, hidden from point v */
function behind(F, c, v, extra = 0.5) {
  const ux0 = v.x - c.x, uz0 = v.z - c.z, ul = Math.hypot(ux0, uz0) || 1, ux = ux0 / ul, uz = uz0 / ul;
  const half = c.kind === "can" ? c.r : Math.abs(ux) * c.w / 2 + Math.abs(uz) * c.d / 2;
  return FD.pushOut(F, c.x - ux * (half + F.rules.playerRadius + extra), c.z - uz * (half + F.rules.playerRadius + extra));
}

/* ------------------------------------------------------- the name tag - */
/** the small state word under each player's name tag ("hunting", "covering", ...): what the brain is doing now.
   It rides the player's place field ("a|b||hunting"); the running join sends it. Set only when it changes. */
export const HUNT_WORDS = { out: "", dodge: "dodging", react: "spotted you", fire: "hunting", cover: "in cover", search: "searching", check: "searching", patrol: "patrolling" };
export const ORDER_WORDS = { follow: "following", cover: "covering", hold: "holding", goto: "moving up", "flank-left": "flanking", "flank-right": "flanking", find: "hunting" };
function doer(api) {
  let last = null;
  return async (word) => { if (word == null || word === last) return; last = word; try { await api("/doing", { word }); } catch (_) {} };
}

/* ------------------------------------------------------------ orders - */
/** one order row -> { kind, x, z, text, id }. Free text (kind "say") is read for a few plain words. */
export function parseOrder(row) {
  const kind = String(row.kind || "say").toLowerCase();
  const base = { id: row.id, text: String(row.body || "").slice(0, 140) };
  if (ORDER_KINDS.includes(kind)) {
    if (kind === "goto") {
      if (Number.isFinite(+row.x) && Number.isFinite(+row.z) && row.x != null && row.z != null) return { ...base, kind, x: +row.x, z: +row.z };
      return { ...base, kind: "unknown" };
    }
    return { ...base, kind };
  }
  const t = base.text.toLowerCase();
  const nums = t.match(/(-?\d+(?:\.\d+)?)[ ,]+(-?\d+(?:\.\d+)?)/);
  if (/\b(go|move|run|get)\b.*\b(to|at)\b/.test(t) && nums) return { ...base, kind: "goto", x: +nums[1], z: +nums[2] };
  const F = fieldNow(), cid = F && F.cover.find((c) => t.includes(c.id.toLowerCase()));
  if (cid && /\b(go|move|run|get|to|behind)\b/.test(t)) { const p = behind(F, cid, { x: cid.x < 0 ? 20 : -20, z: 0 }); return { ...base, kind: "goto", x: p.x, z: p.z, label: cid.id }; }
  if (/\bflank\b.*\bleft\b|\bleft flank\b|\bgo left\b/.test(t)) return { ...base, kind: "flank-left" };
  if (/\bflank\b.*\bright\b|\bright flank\b|\bgo right\b/.test(t)) return { ...base, kind: "flank-right" };
  if (/\bcover me\b|\bcover\b|\bprotect\b|\bwatch my back\b/.test(t)) return { ...base, kind: "cover" };
  if (/\bfollow\b|\bcome( with| here| to me)?\b|\bwith me\b|\bon me\b/.test(t)) return { ...base, kind: "follow" };
  if (/\bhold\b|\bstay\b|\bwait\b|\bstop\b/.test(t)) return { ...base, kind: "hold" };
  if (/\bfind\b|\bhunt\b|\bget (them|him|her)\b|\battack\b|\bpush\b|\bseek\b|\bgo get\b/.test(t)) return { ...base, kind: "find" };
  if (/\bbase\b/.test(t)) return { ...base, kind: "goto", base: true };
  return { ...base, kind: "unknown" };
}

/** the orders table, read and answered with the service role (the CLI) or a fake (the test).
    Reads ONLY Jaron's rows (user_id = owner, speaker 'human'); a row for another AI (to_name) or the other team is skipped. */
export function ordersFromDb(db, { owner, name, selfKey, team, cursorFile, sinceMs = 60000 }) {
  let last = 0, started = false;
  try { if (cursorFile) last = Number(fs.readFileSync(cursorFile, "utf8")) || 0; } catch (_) {}
  const save = () => { if (cursorFile) try { fs.writeFileSync(cursorFile, String(last)); } catch (_) {} };
  const mine = (r) => r && r.user_id === owner && r.speaker === "human" &&
    (!r.to_name || String(r.to_name).toLowerCase() === String(name).toLowerCase()) && (!r.team || r.team === team);
  return {
    get last() { return last; },
    /** the orders after the bookmark (on a first run: only orders from the last minute, never old ones) */
    async next() {
      let q = db.from(ORDER_TABLE).select("*").eq("user_id", owner).eq("speaker", "human");
      if (!started && !last) q = q.gt("created_at", new Date(Date.now() - sinceMs).toISOString());
      else q = q.gt("id", last);
      const { data, error } = await q.order("id").limit(20);
      if (error) throw new Error(`cannot read ${ORDER_TABLE}: ${error.message}`);
      started = true;
      const rows = data || [];
      for (const r of rows) last = Math.max(last, r.id);
      if (rows.length) save();
      return rows.filter(mine);
    },
    async reply(text, order) {
      const body = String(text || "").replace(/\s+/g, " ").trim().slice(0, 140);
      if (!body) return null;
      const { data, error } = await db.from(ORDER_TABLE).insert({ user_id: owner, speaker: "ai", kind: "status", body, ai_name: name, ai_key: selfKey,
        team, reply_to: order && order.id ? order.id : null }).select("id").single();
      if (error) throw new Error(`cannot write the status: ${error.message}`);
      return data;
    },
  };
}

/* ------------------------------------------------------- shared moves - */
class Mover {
  constructor(api) { this.api = api; this.goal = null; this.tries = 0; this.sentAt = 0; }
  /** run toward p (nowait). Returns "arrived" | "moving" | "stuck" */
  async to(L, p, near = 1.0) {
    const me = L.me;
    if (dist(me, p) <= near) { this.goal = null; this.tries = 0; return "arrived"; }
    const changed = !this.goal || dist(this.goal, p) > 0.7;
    if (changed) { this.goal = { x: p.x, z: p.z }; this.tries = 0; }
    if (changed || (!me.moving && Date.now() - this.sentAt > 600)) {
      if (!changed) this.tries++;
      if (this.tries > 4) return "stuck";
      this.sentAt = Date.now();
      try { await this.api("/move-to", { x: r1(p.x), z: r1(p.z), nowait: true }); } catch (_) {}
    }
    return "moving";
  }
  reset() { this.goal = null; this.tries = 0; }
}

/* ------------------------------------------------------------ hunter - */
export const SKILL = {   // reaction to a new sighting, shot stray (m at 10 m), gap between shots, chance to dodge, range
  1: { reactMs: 1200, aimErr: 1.6, fireGapMs: 1100, dodge: 0.15, range: 18, cover: false },
  2: { reactMs: 850, aimErr: 1.1, fireGapMs: 800, dodge: 0.35, range: 22, cover: true },
  3: { reactMs: 600, aimErr: 0.7, fireGapMs: 600, dodge: 0.55, range: 26, cover: true },
  4: { reactMs: 400, aimErr: 0.4, fireGapMs: 450, dodge: 0.75, range: 30, cover: true },
  5: { reactMs: 250, aimErr: 0.15, fireGapMs: 320, dodge: 0.9, range: 32, cover: true },
};

export class Hunter {
  constructor({ api, skill = 3, target = "Jaron", log = () => {}, rng = Math.random, onlyEnemies = true }) {
    this.api = api; this.skill = Math.max(1, Math.min(5, Math.round(Number(skill) || 3))); this.P = SKILL[this.skill];
    this.target = String(target || "").toLowerCase(); this.log = log; this.rng = rng; this.onlyEnemies = onlyEnemies;
    this.mv = new Mover(api); this.lastSeen = null; this.sight = null; this.lastShot = 0; this.checks = []; this.patrol = null; this.patrolI = 0;
    this.dodged = new Set(); this.underFireAt = 0; this.coverAt = 0; this.hitsAt = null; this.say = null;
  }
  prefers(p) { return p.owner || (this.target && p.name.toLowerCase().includes(this.target)); }
  /** what it senses: enemies in line of sight (body or head), or close enough to hear (3 m) */
  visible(L) { return L.players.filter((p) => (!this.onlyEnemies || p.enemy) && !p.out && (p.line_of_sight !== "no" || p.distance_m < 3)); }
  buildPatrol(L) {   // round the cover on the far half first (where the enemy lives), then the middle, then their base
    const F = fieldNow(), me = L.me, enemyTeam = me.team === "a" ? "b" : "a", side = enemyTeam === "a" ? -1 : 1, sp = spawnOf(enemyTeam);
    const pts = [];
    for (const c of F.cover) {
      if (c.kind === "ramp") continue;
      const m = (c.kind === "can" ? c.r : Math.max(c.w, c.d) / 2) + 1.2;
      for (const [dx, dz] of [[0, m], [0, -m]]) { const p = FD.pushOut(F, c.x + dx, c.z + dz); pts.push({ x: p.x, z: p.z, far: Math.sign(c.x) === side ? 1 : 0, d: Math.hypot(p.x - sp.x, p.z - sp.z) }); }
    }
    pts.sort((a, b) => (b.far - a.far) || (b.d - a.d));   // sweep from the middle toward their base
    pts.push({ x: sp.x - side * 3, z: sp.z + 4 }, { x: sp.x - side * 3, z: sp.z - 4 });
    this.patrol = pts.map((p) => clampField(p, F)); this.patrolI = 0;
  }
  noteHeard(L) {   // a ball coming at it gives away where the shooter stands
    for (const b of L.incoming) if (b.from_x != null) {
      const shooter = L.players.find((p) => p.name === b.from);
      if (shooter && shooter.enemy === false) continue;
      if (!this.sight) this.lastSeen = { x: b.from_x, z: b.from_z, name: b.from, t: Date.now(), heard: true };
      this.underFireAt = Date.now();
    }
  }
  /** one decision. Returns a short word for logs: dodge, react, fire, close-in, cover, search, check, patrol, out */
  async step(L) {
    const me = L.me, now = Date.now(), P = this.P;
    if (me.out) { this.sight = null; this.mv.reset(); return "out"; }
    if (this.hitsAt == null) this.hitsAt = me.hits;
    if (me.hits > this.hitsAt) { this.hitsAt = me.hits; this.say && this.say("tagged"); }
    this.noteHeard(L);
    // dodge a ball that will hit it (it senses the ball; skill decides if it reacts in time)
    const inc = L.incoming.find((b) => b.will_hit_me && b.time_to_impact_s < 1.0 && !this.dodged.has(b.ball));
    if (inc) {
      this.dodged.add(inc.ball); if (this.dodged.size > 200) this.dodged.clear();
      if (this.rng() < P.dodge) { this.mv.reset(); try { await this.api("/strafe", { dir: this.rng() < 0.5 ? "left" : "right", m: 1.8 }); } catch (_) {} return "dodge"; }
    }
    const vis = this.visible(L);
    const pick = vis.filter((p) => this.prefers(p))[0] || vis.sort((a, b) => a.distance_m - b.distance_m)[0];
    if (pick) {
      if (!this.sight || this.sight.name !== pick.name) { this.sight = { name: pick.name, at: now }; this.say && this.say("found", pick); }
      this.lastSeen = { x: pick.x, z: pick.z, name: pick.name, t: now }; this.checks = [];
      if (now - this.sight.at < P.reactMs) return "react";
      try { await this.api("/aim", { who: pick.name }); } catch (_) { return "react"; }
      let did = "aim";
      if (pick.distance_m <= P.range && pick.line_of_sight !== "no" && now - this.lastShot >= P.fireGapMs) {
        this.lastShot = now;
        try { await this.api("/fire", { lead: this.skill >= 3, err: P.aimErr * Math.max(1, pick.distance_m / 10) }); did = "fire"; } catch (_) {}
      }
      if (P.cover && now - this.underFireAt < 1500 && now - this.coverAt > 7000) {
        this.coverAt = now; this.mv.reset();
        try { await this.api("/take-cover", {}); } catch (_) {}
        return "cover";
      }
      if (pick.distance_m > P.range * 0.7) {   // close in, stopping at a good range
        const k = (pick.distance_m - P.range * 0.5) / pick.distance_m;
        await this.mv.to(L, { x: me.x + (pick.x - me.x) * k, z: me.z + (pick.z - me.z) * k }, 1.5);
        return did === "fire" ? "fire" : "close-in";
      }
      return did;
    }
    this.sight = null;
    // where it last saw or heard someone (20 s memory), then the hiding spots round that place
    const F = fieldNow();
    if (this.lastSeen && now - this.lastSeen.t < 20000) {
      const s = this.lastSeen;
      if ((await this.mv.to(L, s, 1.4)) === "moving") return "search";
      this.lastSeen = null;
      this.checks = F.cover.filter((c) => c.kind !== "ramp" && Math.hypot(c.x - s.x, c.z - s.z) < 9)
        .map((c) => behind(F, c, me, 0.9)).sort((a, b) => dist(a, s) - dist(b, s)).slice(0, 4);
    }
    if (this.checks.length) {
      const r = await this.mv.to(L, this.checks[0], 1.2);
      if (r !== "moving") this.checks.shift();
      return "check";
    }
    if (!this.patrol) this.buildPatrol(L);
    const r = await this.mv.to(L, this.patrol[this.patrolI % this.patrol.length], 1.3);
    if (r !== "moving") this.patrolI++;
    return "patrol";
  }
}

/** hunt mode: run the Hunter until `until` (ms epoch) or stop() */
export async function hunt({ api, skill = 3, target = "Jaron", log = () => {}, tickMs = 200, until = Infinity, stop = () => false, rng }) {
  const h = new Hunter({ api, skill, target, log, rng });
  const doing = doer(api);
  let lastWord = "";
  h.say = (what, p) => { if (what === "found") log(`found ${p.name} at x ${p.x} z ${p.z} (${p.distance_m} m)`); if (what === "tagged") log("tagged someone"); };
  while (Date.now() < until && !stop()) {
    let L; try { L = await api("/look", {}); } catch (e) { log(`look failed: ${e.message}`); await sleep(1000); continue; }
    const w = await h.step(L);
    await doing(w in HUNT_WORDS ? HUNT_WORDS[w] : "hunting");
    if (w !== lastWord && (w === "patrol" || w === "search" || w === "check" || w === "out")) log(w);
    lastWord = w;
    await sleep(tickMs);
  }
  return h;
}

/* ---------------------------------------------------------- teammate - */
/** follow-orders mode. orders = ordersFromDb(...) (or a fake). Default before any order: follow Jaron, quietly. */
export async function followOrders({ api, orders, log = () => {}, leader = "", tickMs = 250, pollMs = 1000, until = Infinity, stop = () => false, skill = 4, rng = Math.random }) {
  const mv = new Mover(api);
  const doing = doer(api);
  let cur = { kind: "follow", quiet: true }, lastPoll = 0, lastShot = 0, lostSince = 0, saidLost = false, heldOut = false;
  const hunter = new Hunter({ api, skill, target: "", rng });
  const P = SKILL[Math.max(1, Math.min(5, skill))];
  const reply = async (text, o) => { log(`status: ${text}`); try { await orders.reply(text, o); } catch (e) { log(e.message); } };
  hunter.say = (what, p) => { if (cur.kind !== "find") return; if (what === "found") void reply(`Found ${p.name}, ${Math.round(p.distance_m)} m from me. Engaging.`, cur); if (what === "tagged") void reply("Got one!", cur); };
  const lead = (L) => L.players.find((p) => p.owner) || (leader && L.players.find((p) => p.name.toLowerCase() === leader.toLowerCase())) || null;
  async function engage(L, prefer) {
    const vis = L.players.filter((p) => p.enemy && !p.out && p.line_of_sight !== "no" && p.distance_m <= P.range);
    if (!vis.length) return false;
    const t = prefer ? vis.sort((a, b) => dist(a, prefer) - dist(b, prefer))[0] : vis.sort((a, b) => a.distance_m - b.distance_m)[0];
    if (Date.now() - lastShot < P.fireGapMs) return true;
    lastShot = Date.now();
    try { await api("/aim", { who: t.name }); await api("/fire", { lead: true, err: P.aimErr * Math.max(1, t.distance_m / 10) }); } catch (_) {}
    return true;
  }
  async function dodge(L) {
    const inc = L.incoming.find((b) => b.will_hit_me && b.time_to_impact_s < 0.9 && !hunter.dodged.has(b.ball));
    if (!inc) return false;
    hunter.dodged.add(inc.ball);
    if (rng() > P.dodge) return false;
    mv.reset(); try { await api("/strafe", { dir: rng() < 0.5 ? "left" : "right", m: 1.6 }); } catch (_) {}
    return true;
  }
  function plan(o, L) {   // an order -> what to do, worked out once from where everyone stands now
    const F = fieldNow(), me = L.me, J = lead(L);
    const enemyTeam = me.team === "a" ? "b" : "a";
    switch (o.kind) {
      case "follow": return { ...o, say: J ? "On you. Following." : "Following, but I can't see you yet." };
      case "hold": return { ...o, at: { x: me.x, z: me.z }, say: `Holding here (x ${r1(me.x)}, z ${r1(me.z)}).` };
      case "cover": return { ...o, say: J ? "Covering you." : "I'll cover you as soon as I see you." };
      case "find": hunter.lastSeen = null; hunter.checks = []; hunter.patrol = null; return { ...o, say: "Going to find them." };
      case "goto": {
        const p = o.base ? spawnOf(me.team) : clampField(FD.pushOut(F, o.x, o.z), F);
        return { ...o, kind: "goto", to: p, say: `Moving to ${o.label || `x ${r1(p.x)}, z ${r1(p.z)}`}.` };
      }
      case "flank-left": case "flank-right": {
        const from = J || me;
        const seen = L.players.filter((p) => p.enemy && !p.out).sort((a, b) => dist(a, from) - dist(b, from))[0];
        const tgt = seen || spawnOf(enemyTeam);
        const dx = tgt.x - from.x, dz = tgt.z - from.z, d = Math.hypot(dx, dz) || 1, fx = dx / d, fz = dz / d;
        const s = o.kind === "flank-left" ? 1 : -1;   // facing (fx, fz) toward them: left is (-fz, fx), right is (fz, -fx) (+x east, +z north)
        const adv = Math.min(8, d * 0.5);
        const p = clampField(FD.pushOut(F, from.x + fx * adv - s * fz * 7, from.z + fz * adv + s * fx * 7), F);
        return { ...o, to: p, say: `Flanking ${o.kind === "flank-left" ? "left" : "right"} to x ${r1(p.x)}, z ${r1(p.z)}.` };
      }
      default: return { ...o, kind: cur.kind, keep: true, say: `I didn't get "${o.text}". Try: follow me, hold, go to, cover me, flank left/right, find them.` };
    }
  }
  while (Date.now() < until && !stop()) {
    let L; try { L = await api("/look", {}); } catch (e) { log(`look failed: ${e.message}`); await sleep(1000); continue; }
    if (Date.now() - lastPoll >= pollMs) {
      lastPoll = Date.now();
      let rows = []; try { rows = await orders.next(); } catch (e) { log(e.message); }
      for (const row of rows) {
        const o = parseOrder(row);
        log(`order #${row.id}: ${row.kind}${row.body ? ` "${row.body}"` : ""}${o.x != null ? ` (x ${o.x} z ${o.z})` : ""}`);
        const p = plan(o, L);
        if (!p.keep) { cur = p; mv.reset(); saidLost = false; }
        await reply(p.say, row);
      }
    }
    const me = L.me;
    if (me.out) { mv.reset(); await sleep(tickMs); continue; }
    if (await dodge(L)) { await sleep(tickMs); continue; }
    const J = lead(L);
    if (J) { lostSince = 0; } else if (!lostSince) lostSince = Date.now();
    if ((cur.kind === "follow" || cur.kind === "cover") && !cur.quiet && !J && Date.now() - lostSince > 6000 && !saidLost) { saidLost = true; await reply("I can't see you on the field. Holding here.", cur); }
    if (J && J.out && cur.kind === "cover" && !heldOut) { heldOut = true; await reply("You're out. I'm holding until you're back.", cur); }
    if (J && !J.out) heldOut = false;
    await doing(ORDER_WORDS[cur.kind] || "");
    switch (cur.kind) {
      case "follow": case "cover": {
        if (J && !J.out) {
          const f = FD.yawOfBearing(J.facing_deg || 0), fx = Math.sin(f), fz = Math.cos(f);
          const side = cur.kind === "cover" ? 1.6 : 1.0, back = cur.kind === "cover" ? 1.0 : 2.2;
          const spot = { x: J.x - fx * back + fz * side, z: J.z - fz * back - fx * side };
          if (dist(me, J) > (cur.kind === "cover" ? 3.0 : 3.5) || mv.goal) await mv.to(L, spot, 1.2);
        }
        await engage(L, cur.kind === "cover" && J ? J : null);
        break;
      }
      case "hold": await engage(L); if (dist(me, cur.at) > 1.5) await mv.to(L, cur.at, 1.0); break;
      case "goto": case "flank-left": case "flank-right": {
        const r = await mv.to(L, cur.to, 1.0);
        if (r === "arrived") { await reply(cur.kind === "goto" ? `In position at x ${r1(me.x)}, z ${r1(me.z)}. Holding.` : `In position on the ${cur.kind === "flank-left" ? "left" : "right"}. Holding.`, cur); cur = { kind: "hold", at: { x: me.x, z: me.z }, id: cur.id }; }
        else if (r === "stuck") { await reply(`Blocked near x ${r1(me.x)}, z ${r1(me.z)}. Holding here.`, cur); cur = { kind: "hold", at: { x: me.x, z: me.z }, id: cur.id }; }
        else await engage(L);
        break;
      }
      case "find": await hunter.step(L); break;
    }
    await sleep(tickMs);
  }
  return { get order() { return cur; } };
}
