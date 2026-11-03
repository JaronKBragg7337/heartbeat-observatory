#!/usr/bin/env node
/* ============================================================================
   team_browser_check.mjs - TEAM MODE in headless Chromium at 375 x 812 (touch), OFF the live channels.

     node lab/arena/test/team_browser_check.mjs [--three <dir with build/ and examples/ of three@0.160.0>] [--out <dir>]

   Serves the site repo on 127.0.0.1 and blocks every other request (so the guest never joins hb-arena and never
   touches the database). three.js comes from jsdelivr, or from --three (a local npm copy) where the CDN is blocked.
   Needs Node's playwright (require('playwright')).

   Checks: a teammate's ball passes through me (no tag, no point) while an enemy ball still tags me; the order box
   (drawn with the test handle; for anyone but Jaron the database refuses what it sends) is closed by default, small,
   at the right edge, never over the middle of the view, no sideways scroll; "Go to" + a tap on the ground sends a
   goto order with the spot; a quick button sends its order; the AI's status row puts a bubble over the teammate.
   ========================================================================== */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.resolve(HERE, "../../..");
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const THREE_DIR = arg("--three");
const OUT = arg("--out") || path.join(HERE, "shots");
fs.mkdirSync(OUT, { recursive: true });
const require = createRequire(import.meta.url);
let chromium; try { ({ chromium } = require("playwright")); } catch (_) { ({ chromium } = await import("playwright")); }

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".glb": "model/gltf-binary", ".png": "image/png", ".svg": "image/svg+xml" };
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let f = path.join(SITE, p); if (!f.startsWith(SITE)) { res.writeHead(403); return res.end(); }
  try { if (fs.statSync(f).isDirectory()) f = path.join(f, "index.html"); res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res); }
  catch (_) { res.writeHead(404); res.end(); }
}).listen(0, "127.0.0.1");
await new Promise((r) => srv.once("listening", r));
const base = `http://127.0.0.1:${srv.address().port}`;

const results = [];
const check = (name, ok, detail) => { results.push({ name, ok: !!ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " · " + detail : ""}`); };
const br = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const ctx = await br.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errors = [];
await page.route("**/*", (r) => {
  const u = r.request().url();
  if (u.startsWith(base)) return r.continue();
  const m = u.match(/^https:\/\/cdn\.jsdelivr\.net\/npm\/three@0\.160\.0\/(.*)$/);
  if (m) {
    if (!THREE_DIR) return r.continue();
    const f = path.join(THREE_DIR, m[1].split("?")[0]);
    try { return r.fulfill({ status: 200, contentType: "text/javascript", body: fs.readFileSync(f) }); } catch (_) { return r.abort(); }
  }
  return r.abort();
});
page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 300)));
page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_FAILED|supabase/i.test(m.text())) errors.push(m.text().slice(0, 300)); });

try {
  await page.goto(base + "/lab/arena/a/", { waitUntil: "load" });
  await page.waitForFunction("window.__arena && window.__arena.ready && document.getElementById('loading').classList.contains('off')", null, { timeout: 90000 });
  await page.waitForTimeout(1200);
  const st0 = await page.evaluate("window.__arena.state");
  check("page A loads as team A, off the live channel", st0.team === "a" && !st0.connected, `x ${st0.me.x}, connected ${st0.connected}`);

  // fake players: a teammate (AI) and an enemy, through the shell's peer list (re-sent later: the shell drops a peer after 25 s of silence)
  const addPeers = () => page.evaluate(`(() => {
    const sh = window.HBShell.current, now = performance.now();
    sh.peers.set('peer-mate', { id: 'peer-mate', name: 'Mate', place: 'a|a', appearance: { ai: true }, color: '#5fd38d', buf: [{ t: now, x: -13.5, y: 0, z: 1.2, yaw: 1.57, pitch: 0, stance: 'stand' }], last: now });
    sh.peers.set('peer-b', { id: 'peer-b', name: 'Hunter', place: 'b|b', appearance: { ai: true }, color: '#1f9bd6', buf: [{ t: now, x: 6, y: 0, z: 0, yaw: -1.57, pitch: 0, stance: 'stand' }], last: now });
  })()`);
  await addPeers();
  await page.waitForTimeout(600);

  // friendly fire: a ball from my own team, straight at me
  const fire = (id, team, by, from) => page.evaluate(`(async () => {
    const FD = await import('/lab/arena/field.js');
    const s = window.__arena.state.me, F = window.__arena.F(), p = ${JSON.stringify(from)};
    const v = FD.solveLaunch(F, p, [s.x, 1.1, s.z]);
    const hit = FD.hitTime(F, { p, v }, 0, 3, { x: s.x, y: 0, z: s.z });
    window.__arena.inject('arena-fire', { ball: { id: '${id}', by: '${by}', byName: '${by}', team: '${team}', page: '${team}', pages: ['${team}'], t0: Date.now(), p, v } });
    return hit;
  })()`);
  const me = (await page.evaluate("window.__arena.state")).me;
  const willHit = await fire("A-MATE1", "a", "peer-mate", [me.x + 4, 1.26, me.z + 0.5]);
  await page.waitForTimeout(1200);
  let st = await page.evaluate("window.__arena.state");
  check("friendly fire off: a teammate's ball on target passes through me", willHit != null && !st.me.out && st.score.a === 0 && st.score.b === 0, `predicted hit at ${willHit && willHit.toFixed(2)} s; out ${st.me.out}; score ${st.score.a}:${st.score.b}`);
  await page.evaluate("window.__arena.inject('arena-hit', { hit: { ball: 'A-MATE2', by: 'peer-mate', byName: 'Mate', byTeam: 'a', target: window.__arena.state.key, targetName: 'You', targetTeam: 'a', at: Date.now(), p: [0, 1, 0] } })");
  st = await page.evaluate("window.__arena.state");
  check("an own-team hit report (an old client) changes nothing", !st.me.out && st.score.a === 0 && st.score.b === 0, `score ${st.score.a}:${st.score.b}`);
  await fire("B-ENEMY1", "b", "peer-b", [me.x + 4, 1.26, me.z + 0.5]);
  await page.waitForTimeout(1200);
  st = await page.evaluate("window.__arena.state");
  check("an enemy ball still tags me and scores for B", st.me.out && st.score.b === 1, `out ${st.me.out}; score ${st.score.a}:${st.score.b}`);
  await page.waitForTimeout(3300);

  // the order box (Jaron's view): stub the database so nothing leaves the page, then draw it
  await page.evaluate(`(() => {
    const sh = window.HBShell.current; window.__sent = [];
    sh.uid = '19689e52-05ad-4809-ad67-0d8600f02216';
    sh.supa = { from: (t) => ({ insert: async (row) => { window.__sent.push({ t, row }); return { error: null }; } }), rpc: async () => ({ data: true }), channel: () => ({ on() { return this; }, subscribe() { return this; } }) };
    window.__arenaOrders.previewBox();
  })()`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, "team-closed.png") });
  const rect = (sel) => page.evaluate(`(() => { const e = document.querySelector('${sel}'); if (!e) return null; const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return { x: r.x, y: r.y, w: r.width, h: r.height, shown: cs.display !== 'none' && r.width > 0 }; })()`);
  const btn = await rect("#ordBtn"), closedBox = await rect("#ord");
  check("closed by default: one small pill at the right edge", btn && btn.shown && btn.w < 90 && btn.h <= 30 && btn.x + btn.w > 375 - 20 && !closedBox.shown, `pill ${Math.round(btn.w)} x ${Math.round(btn.h)} at x ${Math.round(btn.x)} y ${Math.round(btn.y)}`);
  await page.tap("#ordBtn");
  await page.waitForTimeout(200);
  const box = await rect("#ord");
  const cx = 375 / 2, cy = 812 / 2;
  const coversMiddle = box.x < cx + 60 && box.x + box.w > cx - 60 && box.y < cy + 60 && box.y + box.h > cy - 60;
  const hscroll = await page.evaluate("document.documentElement.scrollWidth > innerWidth");
  check("open: a narrow panel at the right edge, clear of the middle of the view", box.shown && box.w <= 200 && !coversMiddle && box.y + box.h < cy - 60 && !hscroll, `panel ${Math.round(box.w)} x ${Math.round(box.h)} at x ${Math.round(box.x)} y ${Math.round(box.y)}; sideways scroll ${hscroll}`);
  await page.screenshot({ path: path.join(OUT, "team-open.png") });
  // a quick button
  await page.tap('#ord button[data-k="follow"]');
  await page.waitForTimeout(200);
  let sent = await page.evaluate("window.__sent");
  const closedAfter = !(await rect("#ord")).shown;
  check("'Follow me' sends a follow order for team A and closes the panel", sent.length === 1 && sent[0].t === "arena_orders" && sent[0].row.kind === "follow" && sent[0].row.team === "a" && sent[0].row.speaker === "human" && closedAfter, JSON.stringify(sent[0] && sent[0].row));
  // Go to: tap the button, then the ground
  await page.tap("#ordBtn"); await page.waitForTimeout(150);
  await page.tap('#ord button[data-k="goto"]'); await page.waitForTimeout(150);
  const picking = await page.evaluate("window.__arenaOrders.picking");
  const hint = await page.evaluate("document.getElementById('ordHint').classList.contains('on') ? document.getElementById('ordHint').textContent : ''");
  await page.screenshot({ path: path.join(OUT, "team-goto-hint.png") });
  await page.touchscreen.tap(260, 600);
  await page.waitForTimeout(300);
  sent = await page.evaluate("window.__sent");
  const g = sent[1] && sent[1].row;
  const st2 = await page.evaluate("window.__arena.state");
  check("'Go to' + a tap on the ground sends the spot (and fires no ball)", picking && /Tap the ground/.test(hint) && g && g.kind === "goto" && Number.isFinite(g.x) && Number.isFinite(g.z) && Math.abs(g.x) <= 20 && Math.abs(g.z) <= 12, `hint "${hint}"; ${JSON.stringify(g)}; balls in flight ${st2.balls}`);
  await page.screenshot({ path: path.join(OUT, "team-goto-marker.png") });
  await addPeers(); await page.waitForTimeout(400);
  // the AI's status: a bubble over the teammate (only Jaron's page ever gets these rows)
  const shown = await page.evaluate("(() => { window.__arenaOrders.onOrderRow({ id: 1, speaker: 'ai', ai_key: 'peer-mate', ai_name: 'Mate', team: 'a', body: 'On you. Following.' }); return window.__arenaOrders.showBubble('peer-mate', 'On you. Following.', 5000); })()");
  const log = (await page.evaluate("window.__arena.log")).map((l) => l.text);
  const peersNow = (await page.evaluate("window.__arena.state")).peers;
  check("the AI's status shows as a bubble over the teammate and one log line", shown && log.some((l) => /Mate: On you/.test(l)), `${log.slice(-1)[0]}; bubble ${shown}; avatars ${peersNow.join(",")}`);
  await page.evaluate("window.__arena.aimAt(-13.5, 1.2)");
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, "team-bubble.png") });
  check("no page errors", errors.length === 0, errors.join(" | "));
} catch (e) {
  check("the run finished", false, String(e && e.message || e).slice(0, 400) + (errors.length ? " · errors: " + errors.join(" | ") : ""));
}
await br.close(); srv.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed. Screenshots: ${OUT}`);
process.exit(failed.length ? 1 : 0);
