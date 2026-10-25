// Studio save sheet (shared by the Beat Lab and the finished song). CC0, plain JS, no build step.
// Why: on iPhone a plain download link can end up as a blob: tab, and people could not find their file.
// So we offer: the phone's own share sheet (Save to Files, AirDrop, Messages...), a video (goes to Photos / Gallery),
// MP3, WAV, and parts. Every file also gets a visible download link and a plain note about where files go.
//
// MP3 encoder: lamejs 1.2.1 (LGPL-3.0, https://github.com/zhuker/lamejs), vendored at studio/vendor/lame.min.js
// (unmodified copy from cdnjs). It is loaded as its own script file, only when someone picks MP3. No runtime CDN.
//
// openSave({ title, getBuffer, wav, getParts?, start? })
//   title      name used for files and the video card
//   getBuffer  async () => AudioBuffer (stereo)       the thing to save
//   wav        (AudioBuffer) => Blob                  the page's WAV encoder
//   getParts   async (onProgress) => [{name, buffer}] optional: separate parts
//   start      "parts" to jump straight to the parts option
//   recipe     optional Beat Lab recipe (plain object). It is embedded in every WAV (LIST/INFO ICMT) and MP3 (ID3 TXXX "hbrecipe")
//              so the beat can be reopened and edited later. readRecipe(file) reads it back.

const CSS = `
.svx-back{position:fixed;inset:0;z-index:1000;background:rgba(10,7,5,.62);display:flex;align-items:flex-end;justify-content:center}
.svx{width:100%;max-width:560px;max-height:88vh;max-height:88dvh;overflow-y:auto;background:var(--panel,#221b15);color:var(--ink,#f3e9da);
  border:1px solid var(--line,#3d3226);border-bottom:0;border-radius:20px 20px 0 0;padding:16px 16px calc(18px + env(safe-area-inset-bottom));box-sizing:border-box;
  font-family:"Atkinson Hyperlegible",system-ui,sans-serif}
.svx *{box-sizing:border-box;min-width:0}
.svx h3{font-family:Fraunces,Georgia,serif;font-size:22px;margin:0 0 4px}
.svx .svx-sub{color:var(--soft,#c9b8a2);font-size:14px;margin:0 0 12px;overflow-wrap:anywhere}
.svx .svx-opt{display:block;width:100%;text-align:left;margin:8px 0;padding:12px 14px;min-height:56px;border-radius:14px;font:inherit;font-weight:700;color:var(--ink,#f3e9da);
  background:var(--panel2,#2b221a);border:1px solid var(--line,#3d3226);cursor:pointer;-webkit-tap-highlight-color:transparent}
.svx .svx-opt span{display:block;font-weight:400;font-size:13px;color:var(--faint,#8f7d68);margin-top:2px;line-height:1.35}
.svx .svx-opt.main{background:var(--accent,#e08a5a);border-color:var(--accent,#e08a5a);color:#1b130c}
.svx .svx-opt.main span{color:#3b2412}
.svx .svx-close{display:block;width:100%;margin-top:6px;min-height:44px;font:inherit;font-weight:700;color:var(--soft,#c9b8a2);background:none;border:1px solid var(--line,#3d3226);border-radius:12px;cursor:pointer}
.svx .svx-note{color:var(--faint,#8f7d68);font-size:13px;line-height:1.5;margin:10px 0 0}
.svx .svx-file{border:1px solid var(--line,#3d3226);border-radius:14px;padding:12px;margin:8px 0;background:var(--panel2,#2b221a)}
.svx .svx-file b{display:block;overflow-wrap:anywhere}
.svx .svx-file small{color:var(--faint,#8f7d68)}
.svx .svx-file a{color:var(--accent,#e08a5a);font-weight:700;overflow-wrap:anywhere;display:inline-block;margin-top:6px;padding:6px 0}
.svx .svx-bar{height:10px;border-radius:99px;background:var(--panel2,#2b221a);border:1px solid var(--line,#3d3226);overflow:hidden;margin:12px 0 6px}
.svx .svx-bar i{display:block;height:100%;width:0;background:var(--accent,#e08a5a);transition:width .2s}
.svx button:focus-visible,.svx a:focus-visible{outline:2px solid var(--teal,#7fb3ab);outline-offset:2px}
`;

const WHERE = "Where did it go? iPhone: Files app > Recents (usually iCloud Drive, or Downloads). Safari's download arrow also shows it. Android: Files app > Downloads. Nothing is uploaded.";
const safe = (s) => String(s || "song").replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "") || "song";
const sizeText = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");
const tick = () => new Promise((r) => setTimeout(r, 0));
const canShareFiles = (files) => { try { return !!(navigator.share && navigator.canShare && navigator.canShare({ files })); } catch (e) { return false; } };
const toFile = (blob, name, type) => new File([blob], name, { type: type || blob.type || "application/octet-stream" });

let styleDone = false;
function addStyle() { if (styleDone) return; styleDone = true; const s = document.createElement("style"); s.textContent = CSS; document.head.append(s); }

let lamePromise = null;
function loadLame() {
  if (window.lamejs && window.lamejs.Mp3Encoder) return Promise.resolve();
  if (!lamePromise) lamePromise = new Promise((res, rej) => {
    const s = document.createElement("script"); s.src = new URL("./vendor/lame.min.js", import.meta.url).href;
    s.onload = () => (window.lamejs && window.lamejs.Mp3Encoder ? res() : rej(new Error("mp3 encoder missing")));
    s.onerror = () => { lamePromise = null; rej(new Error("mp3 encoder failed to load")); }; document.head.append(s);
  });
  return lamePromise;
}

export async function encodeMp3(buf, onProgress, kbps = 192) {
  await loadLame();
  const L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L, n = buf.length;
  let peak = 0; for (let i = 0; i < n; i++) { const a = Math.abs(L[i]), b = Math.abs(R[i]); if (a > peak) peak = a; if (b > peak) peak = b; }
  const g = peak > 0.75 ? 0.75 / peak : 1, enc = new window.lamejs.Mp3Encoder(2, buf.sampleRate, kbps), out = [], step = 1152 * 10;
  const l16 = new Int16Array(step), r16 = new Int16Array(step);
  for (let i = 0, k = 0; i < n; i += step, k++) {
    const m = Math.min(step, n - i);
    for (let j = 0; j < m; j++) { l16[j] = Math.max(-1, Math.min(1, L[i + j] * g)) * 32767; r16[j] = Math.max(-1, Math.min(1, R[i + j] * g)) * 32767; }
    const d = enc.encodeBuffer(l16.subarray(0, m), r16.subarray(0, m)); if (d.length) out.push(new Uint8Array(d));
    if (k % 8 === 7) { if (onProgress) onProgress(i / n); await tick(); }
  }
  const e = enc.flush(); if (e.length) out.push(new Uint8Array(e));
  return new Blob(out, { type: "audio/mpeg" });
}


// ---- the recipe travels with the file ----
const TAG = "hbrecipe1:";
const ascii = (s) => { const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 255; return u; };
const jsonAscii = (o) => JSON.stringify(o);   // recipe is numbers, words and note names: plain ASCII already
export async function embedRecipe(blob, recipe) {
  if (!recipe) return blob;
  try {
    const text = ascii(TAG + jsonAscii(recipe));
    if (blob.type === "audio/wav") {
      const cl = text.length + 1, pad = cl % 2, ck = new Uint8Array(8 + 4 + 8 + cl + pad), dv = new DataView(ck.buffer);
      ck.set(ascii("LIST"), 0); dv.setUint32(4, 4 + 8 + cl + pad, true); ck.set(ascii("INFO"), 8); ck.set(ascii("ICMT"), 12); dv.setUint32(16, cl + pad, true); ck.set(text, 20);
      const head = new Uint8Array(await blob.slice(0, 12).arrayBuffer()), hv = new DataView(head.buffer);
      hv.setUint32(4, hv.getUint32(4, true) + ck.length, true);
      return new Blob([head, blob.slice(12), ck], { type: "audio/wav" });
    }
    if (blob.type === "audio/mpeg") {
      const desc = ascii("hbrecipe"), body = new Uint8Array(1 + desc.length + 1 + text.length); body.set(desc, 1); body.set(text, 1 + desc.length + 1);
      const tag = new Uint8Array(10 + 10 + body.length), dv = new DataView(tag.buffer), n = 10 + body.length;
      tag.set(ascii("ID3"), 0); tag[3] = 3; tag[4] = 0; tag[5] = 0;
      tag[6] = (n >> 21) & 127; tag[7] = (n >> 14) & 127; tag[8] = (n >> 7) & 127; tag[9] = n & 127;      // sync-safe size
      tag.set(ascii("TXXX"), 10); dv.setUint32(14, body.length, false); tag.set(body, 20);
      return new Blob([tag, blob], { type: "audio/mpeg" });
    }
  } catch (e) {}
  return blob;
}
// returns the recipe object from a WAV or MP3 File made by the Beat Lab, or null
export async function readRecipe(file) {
  try {
    const u8 = async (a, b) => new Uint8Array(await file.slice(a, b).arrayBuffer()), txt = (u) => String.fromCharCode(...u);
    const parse = (t) => { const i = t.indexOf(TAG); if (i < 0) return null; const j = t.slice(i + TAG.length); try { return JSON.parse(j.replace(/[\x00\s]+$/, "")); } catch (e) { return null; } };
    const h = await u8(0, 12);
    if (txt(h.slice(0, 4)) === "RIFF" && txt(h.slice(8, 12)) === "WAVE") {
      let pos = 12;
      while (pos + 8 <= file.size) {
        const c = await u8(pos, pos + 8), id = txt(c.slice(0, 4)), len = new DataView(c.buffer).getUint32(4, true);
        if (id === "LIST" && len < 200000) { const r = parse(txt(await u8(pos + 8, pos + 8 + len))); if (r) return r; }
        pos += 8 + len + (len % 2);
      }
      return null;
    }
    if (txt(h.slice(0, 3)) === "ID3") {
      const size = (h[6] << 21) | (h[7] << 14) | (h[8] << 7) | h[9]; if (size > 200000) return null;
      const t = await u8(10, 10 + size);
      for (let p = 0; p + 10 < t.length;) {
        const id = txt(t.slice(p, p + 4)), len = new DataView(t.buffer, t.byteOffset + p + 4, 4).getUint32(0, false); if (!/^[A-Z0-9]{4}$/.test(id) || !len) break;
        if (id === "TXXX") { const r = parse(txt(t.slice(p + 10, p + 10 + len))); if (r) return r; }
        p += 10 + len;
      }
    }
  } catch (e) {}
  return null;
}

// ---- video (audio + a simple picture), recorded in real time ----
function pickVideoType() {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return null;
  for (const t of ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4;codecs=avc1,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"])
    if (MediaRecorder.isTypeSupported(t)) return t;
  return null;
}
function peaksOf(buf, count) {
  const L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L, per = Math.max(1, Math.floor(buf.length / count)), out = [];
  for (let c = 0; c < count; c++) { let p = 0; for (let i = c * per, e = Math.min(buf.length, i + per); i < e; i += 8) p = Math.max(p, Math.abs(L[i]), Math.abs(R[i])); out.push(p); }
  const m = Math.max(0.0001, ...out); return out.map((p) => p / m);
}
function mmss(s) { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }

// ctx must be created inside the user's tap (iOS keeps audio locked otherwise)
function recordVideo(ctx, buf, title, seconds, onProgress, ctl) {
  return new Promise((resolve, reject) => {
    const type = pickVideoType(); if (!type) return reject(new Error("no video recorder"));
    const W = 540, H = 960, cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d");
    const dur = Math.min(seconds || buf.duration, buf.duration), bars = 54, peaks = peaksOf(buf, bars);
    const dest = ctx.createMediaStreamDestination(), src = ctx.createBufferSource(), an = ctx.createAnalyser(); an.fftSize = 512;
    src.buffer = buf; src.connect(an); src.connect(dest); const data = new Uint8Array(an.fftSize);
    const stream = cv.captureStream(30); dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    let rec; try { rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 1500000, audioBitsPerSecond: 160000 }); } catch (e) { return reject(e); }
    const chunks = []; let t0 = 0, done = false, raf = 0, timer = 0, level = 0;
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onerror = (e) => finish(e.error || new Error("recorder error"));
    rec.onstop = () => { if (ctl.cancelled) return finish(new Error("cancelled")); finish(null, new Blob(chunks, { type: type.split(";")[0] })); };
    function finish(err, blob) {
      if (done) return; done = true; cancelAnimationFrame(raf); clearInterval(timer);
      try { src.stop(); } catch (e) {} try { stream.getTracks().forEach((t) => t.stop()); } catch (e) {}
      err ? reject(err) : resolve({ blob, type: type.split(";")[0] });
    }
    ctl.stop = () => { ctl.cancelled = true; try { if (rec.state !== "inactive") rec.stop(); else finish(new Error("cancelled")); } catch (e) { finish(new Error("cancelled")); } };
    const accent = "#e08a5a", ink = "#efe6da", faint = "#8f7d68";
    function draw() {
      const el = Math.min(dur, ctx.currentTime - t0), p = el / dur;
      an.getByteTimeDomainData(data); let s = 0; for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; s += v * v; } level += (Math.sqrt(s / data.length) * 3 - level) * 0.3;
      g.fillStyle = "#1d1916"; g.fillRect(0, 0, W, H);
      const cx = W / 2, cy = 300, r = 70 + Math.min(1, level) * 46;                       // pulse, like a heartbeat
      g.fillStyle = "rgba(224,138,90,.16)"; g.beginPath(); g.arc(cx, cy, r + 26, 0, 7); g.fill();
      g.fillStyle = accent; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
      g.fillStyle = ink; g.textAlign = "center";
      g.font = "700 34px Georgia, serif"; wrap(g, title, cx, 500, W - 80, 42, 2);
      g.font = "500 20px system-ui, sans-serif"; g.fillStyle = faint; g.fillText("made in Heartbeat Observatory Studio", cx, 620);
      const bx = 40, bw = (W - 80) / bars, by = 760;
      for (let i = 0; i < bars; i++) { const h = 8 + peaks[i] * 90; g.fillStyle = i / bars <= p ? accent : "#4a3d30"; g.fillRect(bx + i * bw + 1, by - h / 2, bw - 2, h); }
      g.fillStyle = faint; g.fillRect(bx, 840, W - 80, 4); g.fillStyle = accent; g.fillRect(bx, 840, (W - 80) * p, 4);
      g.fillStyle = ink; g.font = "600 18px system-ui, sans-serif"; g.textAlign = "left"; g.fillText(mmss(el), bx, 880); g.textAlign = "right"; g.fillText(mmss(dur), W - bx, 880);
      g.textAlign = "center"; g.fillStyle = faint; g.font = "500 16px system-ui, sans-serif"; g.fillText("heartbeatobservatory.com", cx, 925);
      if (onProgress) onProgress(p);
      if (el >= dur && !done) { if (rec.state !== "inactive") rec.stop(); return; }
      raf = requestAnimationFrame(draw);
    }
    ctx.resume().then(() => {
      if (ctl.cancelled) return finish(new Error("cancelled"));
      rec.start(); t0 = ctx.currentTime; src.start(0, 0, dur + 0.05);
      draw(); timer = setInterval(() => { if (!done && ctx.currentTime - t0 >= dur + 0.4 && rec.state !== "inactive") rec.stop(); }, 500);   // if the tab sleeps, still finish
    }, finish);
  });
}
function wrap(g, text, x, y, maxW, lh, maxLines) {
  const words = String(text).split(/\s+/), lines = []; let cur = "";
  for (const w of words) { const t = cur ? cur + " " + w : w; if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  lines.push(cur); lines.slice(0, maxLines).forEach((l, i) => g.fillText(l, x, y + i * lh));
}

// ---- the sheet ----
export function openSave(opts) {
  addStyle();
  const { title, getBuffer, wav, getParts, recipe } = opts, base = safe(title), urls = [];
  const AC = window.AudioContext || window.webkitAudioContext;
  let bufP = null; const buffer = () => (bufP = bufP || Promise.resolve(getBuffer()));
  const back = document.createElement("div"); back.className = "svx-back";
  const box = document.createElement("div"); box.className = "svx"; box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true"); box.setAttribute("aria-label", "Save or share");
  back.append(box); document.body.append(back);
  let ctl = null, closed = false;
  const prevFocus = document.activeElement;
  function close() {
    if (closed) return; closed = true; if (ctl) ctl.stop && ctl.stop(); document.removeEventListener("keydown", onKey);
    back.remove(); setTimeout(() => urls.forEach((u) => URL.revokeObjectURL(u)), 5 * 60 * 1000);   // later, not now: a share or download may still be reading it
    try { prevFocus && prevFocus.focus(); } catch (e) {}
  }
  const onKey = (e) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  back.addEventListener("click", (e) => { if (e.target === back) close(); });

  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.textContent = html; return e; };
  const opt = (label, sub, fn, main) => { const b = el("button", "svx-opt" + (main ? " main" : ""), label); b.type = "button"; b.append(el("span", "", sub)); b.onclick = fn; return b; };
  const closeBtn = (label) => { const b = el("button", "svx-close", label || "Close"); b.type = "button"; b.onclick = close; return b; };
  function set(...kids) { box.replaceChildren(...kids); box.scrollTop = 0; const f = box.querySelector("button"); if (f) f.focus({ preventScroll: true }); }

  function menu() {
    ctl = null;
    const kids = [el("h3", "", "Save or share"), el("p", "svx-sub", title)];
    kids.push(opt("MP3 (best for sharing, about 4 MB)", "Small file that plays anywhere and fits chat and upload limits. Good everyday choice.", () => makeAudio("mp3"), true));
    kids.push(opt("Share or save to Files", "Opens your phone's share sheet: Save to Files, AirDrop, Messages, Drive and more (saves a WAV).", () => makeAudio("wav", true)));
    kids.push(opt("Save as video (goes to Photos / Gallery)", "A video with the sound and a simple picture. Easy to post anywhere.", videoChoose));
    kids.push(opt("WAV (big file, for mixing)", "Full quality, about 10 times bigger than MP3 (a 3 minute song is about 33 MB). Too big for many uploads.", () => makeAudio("wav")));
    if (getParts) kids.push(opt("Save the parts (drums, bass, keys, melody)", "Four separate files, to mix or swap in another app.", parts));
    kids.push(el("p", "svx-note", WHERE), closeBtn());
    set(...kids);
  }

  function working(text, cancel) {
    const bar = el("div", "svx-bar"), fill = el("i"); bar.append(fill); const msg = el("p", "svx-sub", text);
    const kids = [el("h3", "", "Working"), msg, bar]; if (cancel) { const c = el("button", "svx-close", "Cancel"); c.type = "button"; c.onclick = cancel; kids.push(c); }
    set(...kids);
    return { text: (t) => (msg.textContent = t), pct: (p) => (fill.style.width = Math.round(Math.max(0, Math.min(1, p)) * 100) + "%") };
  }
  function fail(text) { set(el("h3", "", "That did not work"), el("p", "svx-sub", text), opt("Back", "Pick another way to save.", menu), closeBtn()); }

  // Result: each file gets a Share/Save button (if the phone can), a visible download link, and the "where did it go" note.
  function result(files, heading, hint) {
    const kids = [el("h3", "", heading || "Ready"), el("p", "svx-sub", hint || "Tap the big button to save it. Your file is ready.")];
    const note = el("p", "svx-note", WHERE);
    const say = (t) => { note.textContent = t; };
    const shareThem = async (list) => {
      try { await navigator.share({ files: list, title }); say("Done. If you picked Save to Files, look in the folder you chose. " + WHERE); }
      catch (e) { if (e && e.name === "AbortError") return; say("Sharing did not open here. Use the Download link instead. " + WHERE); }
    };
    if (files.length > 1 && canShareFiles(files)) { const b = opt("Share or save all " + files.length + " files", "One share sheet for every part.", () => shareThem(files), true); kids.push(b); }
    files.forEach((f, i) => {
      const card = el("div", "svx-file"); card.append(el("b", "", f.name), el("small", "", sizeText(f.size) + " · " + (f.type || "file")));
      const share = canShareFiles([f]);
      if (share) { const b = opt(f.type.startsWith("video") ? "Share now (choose Save Video)" : "Share now (choose Save to Files)", "Opens your share sheet.", () => shareThem([f]), files.length === 1); card.append(b); }
      const u = URL.createObjectURL(f); urls.push(u);
      const a = el("a", "", "Download " + f.name); a.href = u; a.download = f.name; a.rel = "noopener"; card.append(document.createElement("br"), a);
      kids.push(card);
    });
    kids.push(note, opt("Back", "Pick another way to save.", menu), closeBtn("Done"));
    set(...kids);
  }

  async function makeAudio(kind, preferShare) {
    const w = working(kind === "mp3" ? "Making your MP3…" : "Getting your song ready…"); w.pct(0.05);
    try {
      const buf = await buffer(); let blob, name;
      if (kind === "mp3") { w.text("Making your MP3… (192 kbps stereo)"); blob = await encodeMp3(buf, (p) => w.pct(p)); name = base + ".mp3"; }
      else { blob = wav(buf); name = base + ".wav"; }
      blob = await embedRecipe(blob, recipe);
      if (closed) return; result([toFile(blob, name, blob.type)], "Your " + kind.toUpperCase() + " is ready");
    } catch (e) { if (!closed) fail(kind === "mp3" ? "Could not make the MP3. Try WAV instead." : "Could not get the song ready. Try again."); }
  }

  function videoChoose() {
    if (!AC || !pickVideoType()) { fail("This browser cannot record a video. Use MP3 or WAV, or try Safari on iPhone or Chrome on Android."); return; }
    buffer().catch(() => {});
    set(el("h3", "", "Save as video"), el("p", "svx-sub", "It records while the song plays, so a full song takes as long as the song. Keep this page open."),
      opt("30 second clip", "Quick. Good for a preview.", () => makeVideo(30), true), opt("Full song", "Takes as long as the song plays.", () => makeVideo(0)),
      opt("Back", "Pick another way to save.", menu), closeBtn());
  }
  async function makeVideo(seconds) {
    let ctx; try { ctx = new AC(); ctx.resume && ctx.resume(); } catch (e) { return fail("Could not start audio here."); }   // made inside the tap
    ctl = { cancelled: false, stop: null }; const my = ctl;
    const w = working("Getting your song ready…", () => { my.cancelled = true; my.stop && my.stop(); menu(); });
    try {
      const buf = await buffer(); if (my.cancelled) throw new Error("cancelled");
      const total = seconds ? Math.min(seconds, buf.duration) : buf.duration;
      w.text("Recording the video. Keep this page open and your screen on. " + mmss(total) + " to go.");
      const r = await recordVideo(ctx, buf, title, seconds, (p) => { w.pct(p); w.text("Recording the video… " + Math.round(p * 100) + "%. Keep this page open."); }, my);
      try { ctx.close(); } catch (e) {}
      if (closed || my.cancelled) return; ctl = null;
      const ext = r.type.includes("mp4") ? ".mp4" : ".webm";
      result([toFile(r.blob, base + (seconds ? "-clip" : "") + ext, r.type)], "Your video is ready",
        "On iPhone: Share now, then Save Video, and it lands in Photos. On Android: Share now, or Download, then find it in Files or Gallery." + (ext === ".webm" ? " This browser made a WebM video; some gallery apps cannot play WebM, so MP3 may be easier." : ""));
    } catch (e) { try { ctx.close(); } catch (e2) {} if (!closed && !my.cancelled) fail("Could not record the video here. Use MP3 or WAV instead."); }
  }

  async function parts() {
    const w = working("Making the four parts…");
    try {
      const list = await getParts((p) => w.pct(p));
      if (closed) return;
      const files = []; for (const p of list) files.push(toFile(await embedRecipe(wav(p.buffer), recipe), base + "-" + safe(p.name) + ".wav", "audio/wav"));
      result(files, "Your parts are ready", "Four WAV files that line up with each other. Save them one at a time, or all at once if your phone allows.");
    } catch (e) { if (!closed) fail("Could not make the parts. Try again."); }
  }

  if (opts.start === "parts" && getParts) parts(); else menu();
  return { close };
}
