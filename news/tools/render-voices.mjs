// Heartbeat News - render the anchors' "synth" voices to WAV files, exactly as the live show makes them.
// Opens the live news page in headless Chrome, runs the show's own VoiceBox (eSpeak + the studio effects chain) through an
// OfflineAudioContext, and saves one WAV per line. Used by the rendered (Unreal) show; the browser show is unchanged.
//   node news/tools/render-voices.mjs --episode 2026-09-27 --who vex --out DIR     (every Vex line of that episode)
//   node news/tools/render-voices.mjs --text "Hello." --who vex --out DIR           (one line -> line.wav)
// Writes DIR/manifest.json: [{ seg, line, who, text, file, seconds }]. Voice Studio settings from news_anchor_settings apply
// when --settings FILE (JSON {vex:{...}}) is given; otherwise the show's defaults (what viewers hear today).
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith("--") ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
const ORIGIN = args.origin || "https://www.heartbeatobservatory.com";
const WHO = args.who || "vex";
const OUT = path.resolve(args.out || "voices-out");
fs.mkdirSync(OUT, { recursive: true });
const CHROME = args.chrome || "C:/Program Files/Google/Chrome/Application/chrome.exe";

async function lines() {
  if (args.text) return [{ seg: "one", line: 0, who: WHO, text: args.text, file: "line.wav" }];
  const ep = await (await fetch(`${ORIGIN}/news/episodes/${args.episode}.json`)).json();
  const out = [];
  ep.segments.forEach((s, si) => (s.lines || []).forEach((l, li) => {
    if (l.who === WHO) out.push({ seg: s.id || String(si), line: li, who: l.who, text: l.text, file: `${String(si).padStart(2, "0")}_${String(li).padStart(2, "0")}_${l.who}.wav` });
  }));
  return out;
}

// ---- a tiny CDP client over Node's built-in WebSocket
const port = 9300 + Math.floor(Math.random() * 400);
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${port}`, "--no-first-run", "--autoplay-policy=no-user-gesture-required",
  `--user-data-dir=${path.join(OUT, ".chrome")}`, "about:blank"], { stdio: "ignore" });
let tabs;
for (let i = 0; i < 60 && !tabs; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); } catch { await new Promise((r) => setTimeout(r, 250)); } }
const page = tabs.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let seq = 0; const pending = new Map();
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const cdp = (method, params = {}) => new Promise((r) => { const id = ++seq; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async (expression) => {
  const r = await cdp("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || "page error");
  return r.result.result.value;
};
await cdp("Page.navigate", { url: `${ORIGIN}/news/?render=voices` });
await new Promise((r) => setTimeout(r, 4000));

const settings = args.settings ? fs.readFileSync(args.settings, "utf8") : "null";
await evaluate(`(async () => {
  const { VoiceBox } = await import("/news/voices.js");
  window.__vb = new VoiceBox(); const s = ${settings}; if (s) for (const k of Object.keys(s)) window.__vb.setSettings(k, s[k]);
  window.__renderLine = async (who, text) => {
    const vb = window.__vb, { wav, size } = await vb.render(who, text), rate = 48000;
    const dur = wav.samples.length / wav.rate / size + 0.9, ctx = new OfflineAudioContext(1, Math.ceil(dur * rate), rate);
    vb.ctx = ctx; vb.master = ctx.destination; vb.chains = {}; vb.buildChain(who);
    const buf = ctx.createBuffer(1, wav.samples.length, wav.rate); buf.getChannelData(0).set(wav.samples);
    const src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = size; src.connect(vb.chains[who].input); src.start(0.02);
    const d = (await ctx.startRendering()).getChannelData(0);
    let peak = 0; for (const v of d) peak = Math.max(peak, Math.abs(v)); const g = peak > 0.97 ? 0.97 / peak : 1;
    const b = new DataView(new ArrayBuffer(44 + d.length * 2)), w = (o, t) => [...t].forEach((c, i) => b.setUint8(o + i, c.charCodeAt(0)));
    w(0, "RIFF"); b.setUint32(4, 36 + d.length * 2, true); w(8, "WAVE"); w(12, "fmt "); b.setUint32(16, 16, true); b.setUint16(20, 1, true); b.setUint16(22, 1, true);
    b.setUint32(24, rate, true); b.setUint32(28, rate * 2, true); b.setUint16(32, 2, true); b.setUint16(34, 16, true); w(36, "data"); b.setUint32(40, d.length * 2, true);
    for (let i = 0; i < d.length; i++) b.setInt16(44 + i * 2, Math.max(-1, Math.min(1, d[i] * g)) * 32767, true);
    let bin = ""; const u8 = new Uint8Array(b.buffer); for (let i = 0; i < u8.length; i += 8192) bin += String.fromCharCode(...u8.subarray(i, i + 8192));
    return { b64: btoa(bin), seconds: d.length / rate };
  };
  return true;
})()`);

const list = await lines(), manifest = [];
for (const l of list) {
  const r = await evaluate(`window.__renderLine(${JSON.stringify(l.who)}, ${JSON.stringify(l.text)})`);
  fs.writeFileSync(path.join(OUT, l.file), Buffer.from(r.b64, "base64"));
  manifest.push({ ...l, seconds: +r.seconds.toFixed(3) }); console.log(l.file, r.seconds.toFixed(2) + "s");
}
fs.writeFileSync(path.join(OUT, `manifest_${WHO}.json`), JSON.stringify(manifest, null, 1));
ws.close(); chrome.kill(); console.log("done", manifest.length, "lines");
