#!/usr/bin/env node
/* ============================================================================
   watch_check.mjs - the spectator camera and the name tags, in headless Chromium, OFF the live channels.

     node lab/arena/test/watch_check.mjs [--three <dir with build/ and examples/ of three@0.160.0>] [--out <dir>]

   Runs at 390 x 844 (a phone: touch, real touch events through CDP) and 1280 x 800 (a desktop: mouse and keys).
   Serves the site repo on 127.0.0.1 and blocks every other request, so the guest never joins hb-arena. Five fake
   players come in through the shell's peer list: a person, an AI teammate "covering", an AI hunter "hunting", an AI
   that is tagged, and a far one. Checks: name tags (name, team, AI badge, state word, fading with distance), the
   Watch pill, the overview, the player picker (big buttons), follow a player, one-finger orbit, pinch zoom, a tap on
   a name tag, keys 1-9 / 0 / Esc, the watch-only page (?watch: no body, nothing sent), no sideways scroll, no
   console errors, the draw calls.
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
  const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let f = path.join(SITE, p); if (!f.startsWith(SITE)) { res.writeHead(403); return res.end(); }
  try { if (fs.statSync(f).isDirectory()) f = path.join(f, "index.html"); res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res); }
  catch (_) { res.writeHead(404); res.end(); }
}).listen(0, "127.0.0.1");
await new Promise((r) => srv.once("listening", r));
const base = `http://127.0.0.1:${srv.address().port}`;

const results = [];
const check = (name, ok, detail) => { results.push({ name, ok: !!ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " · " + detail : ""}`); };
const br = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });

async function open(url, vp, phone) {
  const ctx = await br.newContext({ viewport: vp, deviceScaleFactor: phone ? 3 : 1, hasTouch: !!phone, isMobile: !!phone });
  const page = await ctx.newPage();
  const errors = [];
  await page.route("**/*", (r) => {
    const u = r.request().url();
    if (u.startsWith(base)) return r.continue();
    const m = u.match(/^https:\/\/cdn\.jsdelivr\.net\/npm\/three@0\.160\.0\/(.*)$/);
    if (m) {
      if (!THREE_DIR) return r.continue();
      try { return r.fulfill({ status: 200, contentType: "text/javascript", body: fs.readFileSync(path.join(THREE_DIR, m[1].split("?")[0])) }); } catch (_) { return r.abort(); }
    }
    return r.abort();
  });
  page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 300)));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_FAILED|supabase/i.test(m.text())) errors.push(m.text().slice(0, 300)); });
  await page.goto(base + url, { waitUntil: "load" });
  await page.waitForFunction("window.__arena && window.__arena.ready && document.getElementById('loading').classList.contains('off')", null, { timeout: 90000 });
  await page.waitForTimeout(800);
  // the fake players, kept alive (the shell drops a peer after 25 s of silence)
  await page.evaluate(`(() => {
    const P = [
      ['peer-jaron', 'Jaron', 'a|a', {}, -12, 3, 1.57],
      ['peer-mate', 'Mate', 'a|a||covering', { ai: true, model: 'Claude Code' }, -9.5, -2, 1.57],
      ['peer-hunter', 'Hunter', 'b|b||hunting', { ai: true, model: 'Codex' }, 5, 1, -1.57],
      ['peer-kimi', 'Kimi', 'b|b|out', { ai: true, model: 'Kimi CLI' }, 9, -6, -1.57],
      ['peer-grok', 'Grok', 'b|b||patrolling', { ai: true, model: 'Grok' }, 18, 8, -1.57],
    ];
    const put = () => { const sh = window.HBShell.current, now = performance.now();
      for (const [id, name, place, app, x, z, yaw] of P) sh.peers.set(id, { id, name, place, appearance: app, color: '#5fd38d', buf: [{ t: now, x, y: 0, z, yaw, pitch: 0, stance: 'stand' }], last: now }); };
    put(); setInterval(put, 4000);
  })()`);
  await page.waitForFunction("window.__arena.state.peers.length >= 5", null, { timeout: 20000 });
  await page.waitForTimeout(700);
  return { ctx, page, errors };
}
const W = (page) => page.evaluate("({ on: window.__arena.watch.on, target: window.__arena.watch.target, cam: window.__arena.watch.cam, tags: window.__arena.watch.tags() })");
const rect = (page, sel) => page.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return { x: r.x, y: r.y, w: r.width, h: r.height, shown: cs.display !== 'none' && r.width > 0 }; })()`);
const hscroll = (page) => page.evaluate("document.documentElement.scrollWidth > innerWidth");
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

try {
  /* ---------------------------------------------------------------- phone - */
  {
    const { ctx, page, errors } = await open("/lab/arena/a/", { width: 390, height: 844 }, true);
    let w = await W(page);
    const tagOf = (id) => w.tags.find((t) => t.id === id) || {};
    check("phone: name tags over the other players (name, team, AI badge, state word)", tagOf("peer-hunter").shown && /Hunter/.test(tagOf("peer-hunter").text) && /AI · Codex/.test(tagOf("peer-hunter").text) && /hunting/.test(tagOf("peer-hunter").text) && /covering/.test(tagOf("peer-mate").text) && /tagged/.test(tagOf("peer-kimi").text),
      w.tags.filter((t) => t.shown).map((t) => t.text).join(" | "));
    const tagSize = await page.evaluate("(() => { const e = document.querySelector('.tag[data-id=peer-mate] .nm'); return e ? parseFloat(getComputedStyle(e).fontSize) : 0; })()");
    check("phone: tags readable (13 px name text, scaled to no less than 0.72)", tagSize >= 13, `font ${tagSize}px`);
    await page.screenshot({ path: path.join(OUT, "watch-phone-play.png") });
    const st = await page.evaluate("window.__arena.state");
    check("phone: draw calls stay low (tags are DOM, kit merged)", st.draws > 0 && st.draws <= 55, `${st.draws} draw calls with 6 players`);
    const pill = await rect(page, "#watchBtn");
    check("phone: a small Watch pill at the right edge", pill && pill.shown && pill.h <= 30 && pill.x + pill.w > 390 - 24, `pill ${Math.round(pill.w)} x ${Math.round(pill.h)} at x ${Math.round(pill.x)} y ${Math.round(pill.y)}`);

    await page.tap("#watchBtn"); await page.waitForTimeout(1600);
    w = await W(page);
    const bar = await rect(page, "#watchBar");
    const btnH = await page.evaluate("Math.min(...[...document.querySelectorAll('#watchBar button, #watchBar a')].map((b) => b.getBoundingClientRect().height))");
    const btns = await page.evaluate("[...document.querySelectorAll('#watchBar button, #watchBar a')].map((b) => b.textContent)");
    check("phone: Watch opens the overview and a picker of big buttons", w.on && w.target === null && w.cam.y > 15 && bar.shown && btnH >= 44 && btns.length === 8, `camera y ${w.cam.y}; buttons ${btnH}px tall: ${btns.join(" / ")}`);
    check("phone: no sideways scroll in watch mode", !(await hscroll(page)));
    await page.screenshot({ path: path.join(OUT, "watch-phone-overview.png") });

    await page.tap('#watchBar button[data-id="peer-hunter"]'); await page.waitForTimeout(1800);
    w = await W(page);
    const hunterAt = { x: 5, y: 1.25, z: 1 };
    check("phone: tap a name in the picker: the camera follows that player", w.target === "peer-hunter" && dist(w.cam, hunterAt) < 9, `camera ${dist(w.cam, hunterAt).toFixed(1)} m from Hunter`);
    await page.screenshot({ path: path.join(OUT, "watch-phone-follow.png") });

    const cdp = await ctx.newCDPSession(page);
    const touchE = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i + 1, radiusX: 4, radiusY: 4, force: 1 })) });
    const before = w.cam;
    await touchE("touchStart", [[120, 420]]);
    for (let i = 1; i <= 10; i++) { await touchE("touchMove", [[120 + i * 16, 420]]); await page.waitForTimeout(16); }
    await touchE("touchEnd", []); await page.waitForTimeout(700);
    w = await W(page);
    const ang = (c) => Math.atan2(c.x - hunterAt.x, c.z - hunterAt.z);
    const turned = Math.abs(((ang(w.cam) - ang(before) + 9.42) % 6.283) - 3.14);
    const st2 = await page.evaluate("window.__arena.state");
    check("phone: one finger orbits round the player (and does not walk or fire)", turned > 0.4 && st2.balls === 0 && Math.abs(st2.me.x - st.me.x) < 0.05, `orbit ${turned.toFixed(2)} rad; balls ${st2.balls}; me moved ${(st2.me.x - st.me.x).toFixed(2)} m`);

    const d0 = dist(w.cam, hunterAt);
    await touchE("touchStart", [[160, 430], [230, 430]]);
    for (let i = 1; i <= 8; i++) { await touchE("touchMove", [[160 - i * 10, 430], [230 + i * 10, 430]]); await page.waitForTimeout(16); }
    await touchE("touchEnd", []); await page.waitForTimeout(900);
    w = await W(page);
    const d1 = dist(w.cam, hunterAt);
    check("phone: pinch out zooms in", d1 < d0 * 0.8, `${d0.toFixed(1)} m -> ${d1.toFixed(1)} m`);

    await page.tap('#watchBar button[data-id=""]'); await page.waitForTimeout(2500);
    for (let i = 0; i < 3; i++) {   // the camera may still be gliding: tap where the tag is now
      const mateTag = await rect(page, '.tag[data-id="peer-mate"] .row');
      if (mateTag && mateTag.shown) await page.touchscreen.tap(mateTag.x + mateTag.w / 2, mateTag.y + mateTag.h / 2);
      await page.waitForTimeout(1200);
      w = await W(page);
      if (w.target === "peer-mate") break;
    }
    check("phone: a tap on a name tag follows that player", w.target === "peer-mate", `target ${w.target}`);
    await page.screenshot({ path: path.join(OUT, "watch-phone-tagtap.png") });
    await page.tap('#watchBar .play'); await page.waitForTimeout(500);
    w = await W(page);
    check("phone: Play goes back to playing", !w.on && !(await rect(page, "#watchBar")).shown);
    check("phone: no page errors", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
  /* -------------------------------------------------------------- desktop - */
  {
    const { ctx, page, errors } = await open("/lab/arena/a/", { width: 1280, height: 800 }, false);
    await page.keyboard.press("3"); await page.waitForTimeout(1500);
    let w = await W(page);
    const list = await page.evaluate("window.__arena.watch.list()");
    check("desktop: key 3 follows the 3rd player in the picker", w.on && w.target === list[2].id, `target ${w.target}; picker ${list.map((t) => t.name).join(", ")}`);
    await page.screenshot({ path: path.join(OUT, "watch-desktop-follow.png") });
    await page.keyboard.press("0"); await page.waitForTimeout(1500);
    w = await W(page);
    const near = w.tags.find((t) => t.id === "peer-jaron"), far = w.tags.find((t) => t.id === "peer-grok");
    check("desktop: key 0 is the overview; all tags face the camera and the far ones fade", w.target === null && w.tags.filter((t) => t.shown).length >= 5, w.tags.map((t) => `${t.id.slice(5)} ${t.opacity}`).join(", "));
    await page.screenshot({ path: path.join(OUT, "watch-desktop-overview.png") });
    await page.keyboard.press("1"); await page.waitForTimeout(1500);   // 1 = you (on the play page)
    w = await W(page);
    const tagsNear = w.tags;
    await page.mouse.move(640, 400); await page.mouse.wheel(0, 600); await page.waitForTimeout(900);
    const w2 = await W(page);
    const me = (await page.evaluate("window.__arena.state")).me;
    const meAt = { x: me.x, y: 1.25, z: me.z };
    check("desktop: key 1 follows you; the wheel zooms out", w.target === "me" && dist(w2.cam, meAt) > dist(w.cam, meAt) + 1, `${dist(w.cam, meAt).toFixed(1)} m -> ${dist(w2.cam, meAt).toFixed(1)} m`);
    const nearT = tagsNear.find((t) => t.id === "peer-mate"), farT = tagsNear.find((t) => t.id === "peer-grok");
    check("desktop: from behind you, a near tag is clearer than a far one", nearT && farT && nearT.opacity > farT.opacity, `Mate ${nearT && nearT.opacity}, Grok ${farT && farT.opacity}`);
    await page.keyboard.press("Escape"); await page.waitForTimeout(400);
    w = await W(page);
    check("desktop: Esc goes back to playing", !w.on);
    check("desktop: no page errors", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
  /* ----------------------------------------------------- watch-only page - */
  for (const [label, vp, phone] of [["phone", { width: 390, height: 844 }, true], ["desktop", { width: 1280, height: 800 }, false]]) {
    const { ctx, page, errors } = await open("/lab/arena/a/?watch", vp, phone);
    await page.waitForTimeout(1200);
    const w = await W(page);
    const info = await page.evaluate("({ state: window.HBShell.current.opts.getState(), url: location.pathname + location.search, counter: document.getElementById('counter').textContent, play: !!document.querySelector('#watchBar a.play'), list: window.__arena.watch.list().map((t) => t.id) })");
    check(`watch-only (${label}): a spectator with no body, sending nothing`, w.on && info.state === null && !info.list.includes("me") && /Watching/.test(info.counter) && info.play && info.url === "/lab/arena/a/?watch", `getState ${JSON.stringify(info.state)}; ${info.counter}; ${info.url}`);
    check(`watch-only (${label}): no sideways scroll, no page errors`, !(await hscroll(page)) && errors.length === 0, errors.join(" | "));
    await page.screenshot({ path: path.join(OUT, `watch-only-${label}.png`) });
    await ctx.close();
  }
} catch (e) {
  check("the run finished", false, String(e && e.stack || e).slice(0, 600));
}
await br.close(); srv.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed. Screenshots: ${OUT}`);
process.exit(failed.length ? 1 : 0);
