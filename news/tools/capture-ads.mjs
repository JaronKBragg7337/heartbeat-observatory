// The "camera" for Heartbeat News commercials. Opens each page in headless Chrome at the LED wall's shape (7:3), lets it
// load (3D included), optionally taps a button to get past an intro, and saves news/ads/<id>.jpg.
//   node news/tools/capture-ads.mjs            -> every spot in news/ads/ads.json
//   node news/tools/capture-ads.mjs livi crew  -> just those
// Re-run whenever a page changes so the commercials show the current site.
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const adsDir = join(here, "..", "ads");
const catalog = JSON.parse(readFileSync(join(adsDir, "ads.json"), "utf8"));
const only = process.argv.slice(2);
const CHROME = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function shoot(ad) {
  const port = 9300 + Math.floor(Math.random() * 400);
  const chrome = spawn(CHROME, ["--headless=new", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--hide-scrollbars",
    "--autoplay-policy=no-user-gesture-required", `--remote-debugging-port=${port}`, `--user-data-dir=${process.env.TEMP || "/tmp"}/ad-cam-${port}`, "about:blank"]);
  try {
    let list;
    for (let i = 0; i < 60; i++) { try { list = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch { await sleep(250); } }
    const ws = new WebSocket(list.find((t) => t.type === "page").webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener("open", r));
    let id = 0; const pend = new Map();
    ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } });
    const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
    await send("Page.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: 1400, height: 600, deviceScaleFactor: 1, mobile: false });
    await send("Page.navigate", { url: ad.url });
    await sleep(ad.wait || 9000);
    if (ad.click) {
      // click the visible element whose own text matches (buttons, links, or clickable divs)
      await send("Runtime.evaluate", { expression: `(() => {
        const want = ${JSON.stringify(ad.click.toLowerCase())};
        const el = [...document.querySelectorAll("button,a,[role=button],div,span")].filter((x) => {
          const r = x.getBoundingClientRect(); return r.width > 0 && r.height > 0 && x.textContent.trim().toLowerCase() === want;
        }).pop() || [...document.querySelectorAll("button,a")].find((x) => x.textContent.toLowerCase().includes(want));
        if (el) { el.click(); return true; } return false; })()` });
      await sleep(ad.afterClick || 6000);
    }
    if (ad.hideText) {
      // hide an intro overlay (the smallest fixed/absolute box that contains this text) so the scene behind it shows
      await send("Runtime.evaluate", { expression: `(() => {
        const t = ${JSON.stringify(ad.hideText)};
        const boxes = [...document.querySelectorAll("body *")].filter((x) => x.innerText && x.innerText.includes(t) && /fixed|absolute/.test(getComputedStyle(x).position));
        boxes.sort((a, b) => b.innerText.length - a.innerText.length);
        if (boxes[0]) boxes[0].style.display = "none"; })()` });
      await sleep(3000);
    }
    if (ad.scroll) { await send("Runtime.evaluate", { expression: `window.scrollTo(0, ${ad.scroll})` }); await sleep(1500); }
    const shot = await send("Page.captureScreenshot", { format: "jpeg", quality: 82 });
    writeFileSync(join(adsDir, ad.id + ".jpg"), Buffer.from(shot.data, "base64"));
    console.log("captured", ad.id);
    ws.close();
  } finally { chrome.kill(); }
}

mkdirSync(adsDir, { recursive: true });
for (const ad of [...catalog.ads, ...(catalog.shots || [])]) if (!only.length || only.includes(ad.id)) await shoot(ad).catch((e) => console.log("FAILED", ad.id, e.message));
process.exit(0);
