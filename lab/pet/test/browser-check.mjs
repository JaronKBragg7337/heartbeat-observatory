/* browser-check.mjs - opens /lab/pet/ in headless Chromium at phone size, offline, with three.js from a local copy.
   Run:  THREE_DIR=/path/to/node_modules/three node lab/pet/test/browser-check.mjs
   (THREE_DIR must hold build/three.module.js and examples/jsm/.) It serves the repo on a local port, rewrites the
   importmap to the local copy, then: waits for the first frame, hatches, drops a berry, pokes, leads with a held
   finger, and checks for page errors, that the pet ate and grew, and the frame rate. Screenshots go to OUT_DIR. */
import { createServer } from "node:http";
import { readFile, stat, mkdir } from "node:fs/promises";
import { join, extname, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = resolve(fileURLToPath(import.meta.url), "../../../..");
const THREE_DIR = process.env.THREE_DIR;
const OUT = process.env.OUT_DIR || join(ROOT, "lab/pet/test/out");
if (!THREE_DIR) { console.error("set THREE_DIR to a local three.js package (npm pack three@0.160.0)"); process.exit(2); }
await mkdir(OUT, { recursive: true });
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png" };
const CDN = "https://cdn.jsdelivr.net/npm/three@0.160.0/";

const server = createServer(async (req, res) => {
  let url = decodeURIComponent(req.url.split("?")[0]);
  let file;
  if (url.startsWith("/__three/")) file = join(THREE_DIR, url.slice(9));
  else { file = join(ROOT, url); try { if ((await stat(file)).isDirectory()) file = join(file, "index.html"); } catch { /* 404 below */ } }
  try {
    let body = await readFile(file);
    if (file.endsWith(".html")) body = Buffer.from(body.toString().split(CDN).join("/__three/"));
    res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch { res.writeHead(404); res.end("no " + url); }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;

let pass = 0, fail = 0;
const ok = (c, m, x = "") => { if (c) { pass++; console.log(`  ok   ${m}`); } else { fail++; console.log(`  FAIL ${m} ${x}`); } };

const browser = await chromium.launch();
const hour = process.env.HOUR || "";
async function run(label, { width, height, dpr, query = "", storage = null }) {
  console.log(`\n${label}`);
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, hasTouch: true, isMobile: width < 500 });
  const page = await ctx.newPage();
  const errors = [], logs = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") logs.push(m.text()); });
  if (storage) await page.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, storage);
  await page.goto(`${base}/lab/pet/${query}`, { waitUntil: "load" });
  await page.waitForFunction(() => window.HBPet && window.HBPet.pet, null, { timeout: 30000 }).catch(() => {});
  ok(await page.evaluate(() => !!(window.HBPet && window.HBPet.pet)), "page booted and the pet exists", errors.join(" | "));
  await page.waitForTimeout(1500);
  const hatchOn = await page.evaluate(() => document.getElementById("hatch").classList.contains("on"));
  if (!storage) {
    ok(hatchOn, "first run shows the hatch screen");
    await page.screenshot({ path: join(OUT, `${label}-hatch.png`) });
    await page.fill("#hatchName", "Momo");
    await page.click("#hatchSwatches .swatch:nth-child(2)");
    await page.click("#hatchGo");
    await page.waitForTimeout(400);
    ok(await page.evaluate(() => document.getElementById("petName").textContent === "Momo" && window.HBPet.pet.colour === "mint"), "named Momo, mint, and the card says so");
    ok(await page.evaluate(() => { try { return JSON.parse(localStorage.getItem("hb-pet:v1")).name === "Momo"; } catch { return false; } }), "saved to localStorage after hatching");
  } else {
    ok(!hatchOn, "a saved pet skips the hatch screen");
    ok(await page.evaluate((n) => window.HBPet.pet.count === n, JSON.parse(storage["hb-pet:v1"]).cells), "a saved pet comes back the same size");
  }
  await page.waitForTimeout(2500);
  await page.screenshot({ path: join(OUT, `${label}-idle.png`) });
  const before = await page.evaluate(() => ({ cells: window.HBPet.pet.count, bites: window.HBPet.pet.sim.bites }));
  // drop a berry near the pet by tapping the grass beside it (project a ground point to the screen)
  for (let i = 0; i < 3; i++) {
    const pt = await page.evaluate(() => { const c = window.HBPet.pet.center.clone(); c.x += 0.7; c.y = 0; c.project(window.HBPet.camera); return { x: (c.x + 1) / 2 * innerWidth, y: (1 - c.y) / 2 * innerHeight }; });
    await page.touchscreen.tap(pt.x, pt.y);
    await page.waitForTimeout(150);
    if (i === 0) { await page.waitForTimeout(500); await page.screenshot({ path: join(OUT, `${label}-berry.png`) }); }
    await page.waitForFunction((b) => window.HBPet.pet.sim.bites > b, before.bites + i, { timeout: 12000 }).catch(() => {});
  }
  const after = await page.evaluate(() => ({ cells: window.HBPet.pet.count, bites: window.HBPet.pet.sim.bites, foods: window.HBPet.pet.sim.foods.length }));
  ok(after.bites >= before.bites + 3, `ate the three berries (${before.bites} -> ${after.bites})`);
  ok(after.cells === before.cells + 1, `grew one cell after three bites (${before.cells} -> ${after.cells})`);
  await page.screenshot({ path: join(OUT, `${label}-grown.png`) });
  // poke: tap the pet itself
  const pp = await page.evaluate(() => { const c = window.HBPet.pet.center.clone(); c.project(window.HBPet.camera); return { x: (c.x + 1) / 2 * innerWidth, y: (1 - c.y) / 2 * innerHeight }; });
  await page.touchscreen.tap(pp.x, pp.y);
  await page.waitForTimeout(250);
  ok(await page.evaluate(() => window.HBPet.pet.sim.pokeT > 0 || window.HBPet.pet.state === "poked"), "a tap on the pet pokes it");
  await page.screenshot({ path: join(OUT, `${label}-poke.png`) });
  // lead: hold a finger on the grass for 3 s on the far side
  const start = await page.evaluate(() => ({ x: window.HBPet.pet.center.x, z: window.HBPet.pet.center.z }));
  // a spot ~1.4 m from the pet that is on screen and on the patch (the camera yaw decides which side that is)
  const lead = await page.evaluate(() => {
    for (let k = 0; k < 12; k++) {
      const a = k * Math.PI / 6, c = window.HBPet.pet.center.clone(); c.x += Math.cos(a) * 1.4; c.z += Math.sin(a) * 1.4; c.y = 0;
      if (Math.hypot(c.x, c.z) > 2.4) continue;
      const p = c.clone().project(window.HBPet.camera), x = (p.x + 1) / 2 * innerWidth, y = (1 - p.y) / 2 * innerHeight;
      if (x > 40 && x < innerWidth - 40 && y > 120 && y < innerHeight - 80) return { x, y };
    }
    return null;
  });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: lead.x, y: lead.y }] });
  await page.waitForTimeout(1300);   // the poke wiggle (0.9 s) ends first, then it follows
  ok(await page.evaluate(() => window.HBPet.pet.state === "follow"), "holding a finger makes it follow");
  await page.waitForTimeout(2600);
  await page.screenshot({ path: join(OUT, `${label}-lead.png`) });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  const end = await page.evaluate(() => ({ x: window.HBPet.pet.center.x, z: window.HBPet.pet.center.z, state: window.HBPet.pet.state }));
  ok(Math.hypot(end.x - start.x, end.z - start.z) > 0.4, `it moved toward the finger (${Math.hypot(end.x - start.x, end.z - start.z).toFixed(2)} m)`);
  await page.waitForTimeout(300);
  ok(await page.evaluate(() => window.HBPet.pet.state !== "follow"), "lets go when the finger lifts");
  // layout at phone width
  const layout = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, card: document.getElementById("card").getBoundingClientRect().width, gear: document.getElementById("gear").getBoundingClientRect() }));
  ok(layout.sw <= layout.iw, `no sideways scroll (${layout.sw} <= ${layout.iw})`);
  ok(layout.card < layout.iw - 60 && layout.gear.right <= layout.iw, "the card and the gear fit the screen");
  const fps = await page.evaluate(() => window.__petFps || 0);
  const calls = await page.evaluate(() => window.HBPet.renderer.info.render.calls);
  console.log(`  info: ${fps.toFixed(0)} fps in software GL (not a phone number), ${calls} draw calls`);
  ok(calls < 60, `draw calls stay low (${calls})`);
  ok(errors.length === 0, "no page errors", errors.join(" | "));
  if (logs.length) console.log("  console:", logs.slice(0, 5).join(" | "));
  await ctx.close();
}

await run("phone-day", { width: 375, height: 667, dpr: 2, query: "?hour=14" });
await run("phone-night", { width: 375, height: 667, dpr: 2, query: "?hour=23", storage: { "hb-pet:v1": JSON.stringify({ v: 1, name: "Pebble", colour: "lilac", cells: 46, bites: 66, hunger: 0.3, bornAt: Date.now() - 3 * 864e5, savedAt: Date.now() - 2 * 3.6e6 }), "hb-pet:hints": "4" } });
await run("desktop-dusk", { width: 1100, height: 700, dpr: 1, query: "?hour=19", storage: { "hb-pet:v1": JSON.stringify({ v: 1, name: "Bean", colour: "peach", cells: 80, bites: 170, hunger: 0.9, bornAt: Date.now() - 12 * 864e5, savedAt: Date.now() }), "hb-pet:hints": "4" } });

await browser.close();
server.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
