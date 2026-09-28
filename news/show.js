// Heartbeat News - the director: loads the day's episode, runs the loop, calls the shots, drives the graphics,
// and hands each line to the voices. Tunes in mid-show like a real channel: where the loop is depends on the clock.
import { createNewsroom } from "/news/studio3d.js";
import { VoiceBox, silentLevel, sentences, DEFAULT_SETTINGS } from "/news/voices.js";

const SUPABASE_URL = "https://ygjpnvrwhkrowkrskftk.supabase.co";
const SUPABASE_KEY = "sb_publishable_Y-duV64ayMMEvVwMs5PWuw_6kvzbOrN";
const $ = (id) => document.getElementById(id);
const NAMES = { vex: { name: "AI Robot Vex", title: "Anchor · Heartbeat News" }, joe: { name: "Alien Joe", title: "Co-anchor · Heartbeat News" } };
const WPS = 2.55;        // words per second at speed 1.0 (CHOSEN: broadcast read rate ~150 wpm)
const GAP = 0.45;        // pause between lines
const OPEN_LEAD = 4.4;   // title card + crane at the top of the show
const SEG_LEAD = 1.3;    // stinger into a new story
const BREAK_LEAD = 3.0;  // BREAKING NEWS slam

const voice = new VoiceBox();
let studio = null;
let ep = null, segs = [], items = [], wire = [], adsCat = { ads: [] };
const ADS_EVERY = 3;       // a house commercial after every 3 stories (2026-09-25)
let cur = null;
let mode = "silent";
let ccOn = true;
let paused = false;
let pendingEp = null;
let lastSegIndex = -1;
let hideTimers = [];

function esc(s) { const d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML; }
function words(s) { return String(s).trim().split(/\s+/).filter(Boolean).length; }
function hash(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function now() { return performance.now() / 1000; }
function timeout(p, ms) { return Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error("timeout")), ms))]); }
function speedOf(who) { return Math.max(0.5, +voice.settings[who].speed || 1); }
function speechEst(it) { return it.words / (WPS * speedOf(it.who)); }
function leadOf(it) { if (it.li !== 0) return 0; if (it.index === 0) return OPEN_LEAD; return it.seg.kind === "breaking" ? BREAK_LEAD : SEG_LEAD; }

// ---- episode ------------------------------------------------------------------------------------------------------
async function loadIndex() {
  const r = await timeout(fetch("/news/episodes/index.json", { cache: "no-store" }), 6000);
  if (!r.ok) throw new Error("index " + r.status);
  return r.json();
}
async function loadEpisode(date) {
  const r = await timeout(fetch("/news/episodes/" + date + ".json", { cache: "no-cache" }), 8000);
  if (!r.ok) throw new Error("episode " + r.status);
  return r.json();
}
async function loadWire() {
  try {
    const r = await timeout(fetch("/api/news"), 5000);
    const d = await r.json();
    return (d.items || []).filter((x) => x && x.title).slice(0, 6);
  } catch (e) { return []; }
}
function cleanHeadline(t) { return String(t).replace(/\s+/g, " ").replace(/[.\s]+$/, "").trim(); }
function wireLines(list) {
  const w = list.slice(0, 4);
  if (!w.length) return [];
  const out = [{ who: "joe", text: "Now a quick look at more headlines from the wires." }];
  w.forEach((x, i) => out.push({ who: i % 2 ? "joe" : "vex", text: cleanHeadline(x.title) + ". That's from " + (x.source || "the wires") + "." }));
  return out;
}

// House commercials (news/ads/ads.json): spots for the site's own pages, with a camera shot of the page on the wall.
async function loadAds() {
  try { const r = await timeout(fetch("/news/ads/ads.json", { cache: "no-cache" }), 5000); return (await r.json()) || { ads: [] }; } catch (e) { return { ads: [] }; }
}
// Each spot has several "takes"; roll a die per visit so the jokes change (Jaron's idea, 2026-09-25).
const roll = (arr) => arr[Math.floor(Math.random() * arr.length)];
function adSeg(ad, prefix = "ad-") {
  const lines = ad.takes && ad.takes.length ? roll(ad.takes) : (ad.lines || []);
  return { id: prefix + ad.id, kind: "ad", strap: ad.strap || (ad.title || "").toUpperCase(), headline: ad.title, category: "COMMERCIAL", status: "",
    graphic: { kicker: ad.kicker || "COMMERCIAL", title: ad.title, image: ad.image || "", images: ad.images || null, url: ad.url || "" },
    sources: ad.url ? [{ name: ad.title + " (tap to visit)", url: ad.url }] : [], lines };
}
function withAds(list) {
  const ads = adsCat.ads || [];
  if (!ads.length) return list;
  const out = []; let stories = 0;
  let k = Math.floor(Date.now() / 86400000);   // rotate which spots air inside the loop, day by day
  list.forEach((seg) => {
    out.push(seg);
    if (["open", "close", "wire", "ad"].includes(seg.kind)) return;
    if (++stories % ADS_EVERY) return;
    out.push(adSeg(ads[k++ % ads.length]));
  });
  // The long break after the sign-off, before the loop starts again: everything the in-loop spots didn't cover.
  const br = adsCat.break;
  if (br && (br.spots || []).length) {
    const card = (id, lines, title) => ({ id, kind: "ad", strap: "HEARTBEAT NEWS · COMMERCIAL BREAK", headline: title, category: "COMMERCIAL", status: "",
      graphic: { kicker: "COMMERCIAL BREAK", title }, sources: [], lines });
    out.push(card("break-in", roll(br.intro || [[{ who: "joe", text: "We'll be right back." }]]), "More from Heartbeat"));
    br.spots.forEach((sp) => out.push(adSeg(sp, "break-")));
    out.push(card("break-out", roll(br.outro || [[{ who: "joe", text: "From the top." }]]), "Back to the news"));
  }
  return out;
}

function build(episode, { asRendered = false } = {}) {
  segs = []; items = [];
  // asRendered: the running order the video was made from (commercials + wires already in it, words fixed)
  (asRendered ? episode.segments || [] : withAds(episode.segments || [])).forEach((seg) => {
    let lines = seg.lines || [];
    let sources = seg.sources || [];
    let graphic = seg.graphic || {};
    if (seg.kind === "wire" && !asRendered) {
      lines = wireLines(wire);
      if (!lines.length) return;
      sources = wire.slice(0, 4).map((x) => ({ name: x.source || "wire", url: x.url || "" }));
      graphic = Object.assign({}, graphic, { bullets: wire.slice(0, 4).map((x) => cleanHeadline(x.title)) });
    }
    if (!lines.length) return;
    const s = Object.assign({}, seg, { lines, sources, graphic, index: segs.length, first: items.length });
    segs.push(s);
    lines.forEach((line, li) => {
      const who = line.who === "joe" ? "joe" : "vex";
      items.push({ seg: s, line, li, who, text: String(line.text || ""), words: Math.max(1, words(line.text || "")), index: items.length });
    });
  });
}
function totalLength() { return items.reduce((a, it) => a + leadOf(it) + speechEst(it) + GAP, 0); }
function tuneInIndex() {
  const total = totalLength();
  if (!total) return 0;
  let pos = (Date.now() / 1000) % total;
  for (const it of items) { const d = leadOf(it) + speechEst(it) + GAP; if (pos < d) return it.index; pos -= d; }
  return 0;
}

// ---- shots --------------------------------------------------------------------------------------------------------
function pickShot(it) {
  if (it.line.shot) return it.line.shot;
  const h = hash(it.seg.id + ":" + it.li);
  if (it.li === 0) return it.seg.kind === "weather" || it.seg.kind === "ad" ? "wall" : "two";
  if (h % 7 === 0) return "two";
  if (h % 5 === 0) return it.who === "vex" ? "vexX" : "joeX";
  return it.who;
}
function cutFor(it, shot) {
  const h = hash(it.seg.id + "/" + it.li);
  if (shot === "vex" || shot === "joe" || shot === "vexX" || shot === "joeX") return h % 3 === 0 ? "wall" : "two";
  return it.who;
}

// ---- graphics -----------------------------------------------------------------------------------------------------
function later(fn, ms) { const id = setTimeout(fn, ms); hideTimers.push(id); return id; }
function clearLater() { hideTimers.forEach(clearTimeout); hideTimers = []; }
function on(el, v) { el.classList.toggle("on", !!v); }

function showL3(seg) {
  const tag = $("l3tag");
  const breaking = seg.kind === "breaking";
  tag.textContent = breaking ? "BREAKING" : (seg.category || "HBN");
  tag.classList.toggle("red", breaking);
  const head = $("l3head");
  head.textContent = seg.strap || seg.headline || "";
  head.style.fontSize = "";
  const src = (seg.sources || []).map((s) => s.name).filter(Boolean).slice(0, 3);
  const status = seg.status === "claim" ? "REPORTED CLAIM · " : seg.status === "mixed" ? "SOME CLAIMS UNCONFIRMED · " : "";
  $("l3sub").textContent = seg.kind === "open" || seg.kind === "close"
    ? "HEARTBEAT NEWS · " + (ep && ep.date ? fmtDate(ep.date) : "")
    : status + (src.length ? "SOURCES: " + src.join(" · ") : "HEARTBEAT NEWS");
  on($("l3"), true);
  fitL3();
}
// Long straps shrink to fit the bar instead of getting cut off, like a real graphics package does.
function fitL3() {
  const head = $("l3head"), u = $("screen").clientWidth / 100;
  let size = 3.1;
  head.style.fontSize = "";
  while (head.scrollWidth > head.clientWidth + 1 && size > 2.1) { size -= 0.1; head.style.fontSize = (size * u).toFixed(2) + "px"; }
}
function hideL3() { on($("l3"), false); }
function showName(who) {
  $("nbName").textContent = NAMES[who].name; $("nbTitle").textContent = NAMES[who].title;
  on($("l3"), false); on($("namebar"), true);
  later(() => on($("namebar"), false), 5200);
}
function showOTS(seg) {
  const g = seg.graphic || {};
  $("otsK").textContent = (g.kicker || seg.category || "").toUpperCase();
  $("otsT").textContent = seg.headline || g.title || "";
  $("ots").classList.toggle("breaking-t", seg.kind === "breaking");
  // commercials: the page's photo fills the box and stays up for the whole spot
  const ad = seg.kind === "ad" && (g.image || (g.images && g.images[0]));
  $("ots").classList.toggle("ad-shot", !!ad);
  $("ots").style.backgroundImage = ad ? `linear-gradient(180deg, rgba(0,0,0,0) 45%, rgba(0,0,0,.75)), url("${ad}")` : "";
  on($("ots"), true);
  if (!ad) later(() => on($("ots"), false), 7000);
}
// The wipe must always clear: phones can pause a CSS animation mid-sweep (app switch, screen dim) and leave the bars
// frozen across the picture (Jaron, 2026-09-25). So switch it off after it should have finished, and on returning.
let stingerOff = 0;
document.addEventListener("visibilitychange", () => { if (!document.hidden) $("stinger").classList.remove("go"); });
function stinger() {
  const s = $("stinger"); s.classList.remove("go"); void s.offsetWidth; s.classList.add("go");
  clearTimeout(stingerOff); stingerOff = setTimeout(() => s.classList.remove("go"), 1300);
  later(() => s.classList.remove("go"), 1100);
}
function breakingSlam() {
  on($("breaking"), true);
  later(() => on($("breaking"), false), 2500);
}
function titleCard() {
  $("tcDate").textContent = ep && ep.date ? fmtDate(ep.date).toUpperCase() : "";
  on($("titlecard"), true);
  later(() => on($("titlecard"), false), (OPEN_LEAD - 0.6) * 1000);
}
function fmtDate(d) {
  try { return new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }); } catch (e) { return d; }
}

// Caption blocks the way broadcast captioners cut them: sentence by sentence, long ones split near 12 words.
function captionChunks(text) {
  const out = [];
  for (const sen of sentences(text)) {
    const w = sen.split(/\s+/);
    if (w.length <= 14) { out.push(sen); continue; }
    let buf = [];
    w.forEach((word, i) => {
      buf.push(word);
      const left = w.length - i - 1;
      if ((buf.length >= 12 || (buf.length >= 7 && /[,;:]$/.test(word))) && left >= 4) { out.push(buf.join(" ")); buf = []; }
    });
    if (buf.length) out.push(buf.join(" "));
  }
  return out.length ? out : [text];
}
function setCaption(text) { $("ccText").textContent = text || ""; $("cc").style.visibility = text ? "visible" : "hidden"; }

// ---- ticker + clock -----------------------------------------------------------------------------------------------
let tkX = 0, tkSetW = 0;
function buildTicker() {
  const lines = [].concat(ep && ep.ticker ? ep.ticker : [], wire.map((w) => cleanHeadline(w.title).toUpperCase() + (w.source ? " — " + String(w.source).toUpperCase() : "")));
  const one = lines.map((l) => `<span class="it">${esc(l)}</span><span class="sep"></span>`).join("");
  const mv = $("tkmove");
  mv.innerHTML = `<span style="display:inline-flex;align-items:center" id="tkA">${one}</span><span style="display:inline-flex;align-items:center">${one}</span>`;
  requestAnimationFrame(() => { const a = $("tkA"); tkSetW = a ? a.getBoundingClientRect().width : 0; });
}
function tickTicker(dt) {
  if (!tkSetW) return;
  const u = $("screen").clientWidth / 100;
  tkX -= u * 7 * dt;
  if (tkX < -tkSetW) tkX += tkSetW;
  $("tkmove").style.transform = `translate3d(${tkX.toFixed(1)}px,0,0)`;
}
function tickClock() {
  try { $("clock").textContent = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }).format(new Date()); } catch (e) {}
}

// ---- rundown + "now" ----------------------------------------------------------------------------------------------
function renderRundown() {
  const ol = $("rundown");
  ol.innerHTML = segs.map((s) => {
    const st = s.status || (s.kind === "open" || s.kind === "close" || s.kind === "ad" ? "" : "observed");
    const chip = st ? `<span class="chip ${esc(st)}">${esc(st === "mixed" ? "some claims" : st)}</span>` : "";
    const src = (s.sources || []).filter((x) => x.url).map((x) => `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.name)}</a>`).join(" · ");
    const note = s.kind === "wire" ? "Live from the Perplexity headlines feed." : s.kind === "ad" ? "A house commercial for this site." : "";
    return `<li data-seg="${s.index}"><span class="num">${String(s.index + 1).padStart(2, "0")}</span><div><div class="h">${esc(s.headline || s.strap)}</div>
      <div class="meta"><span class="chip">${esc(s.category || "")}</span>${chip}<span>${s.lines.length} lines</span></div>
      ${src || note ? `<div class="src">${src}${src && note ? " · " : ""}${esc(note)}</div>` : ""}</div></li>`;
  }).join("");
  ol.querySelectorAll("li").forEach((li) => li.addEventListener("click", (e) => { if (e.target.closest("a")) return; jumpToSeg(+li.dataset.seg); }));
  const mins = Math.round(totalLength() / 60);
  $("rundownIntro").textContent = `${segs.length} stories, about ${mins} minutes, looping until the next show. Every story, its source, and whether it was seen first-hand or is a claim. Tap a story to jump to it.`;
  const srcs = (ep.sources || []).map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a>`).join(", ");
  $("epMeta").innerHTML = `This show: <b>${esc(fmtDate(ep.date))}</b>, written by ${esc(ep.writer || "Claude")}. Read from: ${srcs}. <a href="/news/archive/#/day/${esc(ep.date)}">Everything the AIs found that day →</a>`;
}
function markRundown(segIndex) {
  document.querySelectorAll("#rundown li").forEach((li) => li.classList.toggle("cur", +li.dataset.seg === segIndex));
}
function setNow(it) {
  $("nowLbl").textContent = `Now · Story ${it.seg.index + 1} of ${segs.length} · ${it.seg.category || ""}`;
  $("nowHd").textContent = it.seg.headline || it.seg.strap || "";
  $("nowLn").innerHTML = `<b>${esc(NAMES[it.who].name)}:</b> ${esc(it.text)}`;
}

// ---- playback -----------------------------------------------------------------------------------------------------
function startItem(i, { jump = false } = {}) {
  if (!items.length) return;
  if (pendingEp && (i === 0 || items[i].li === 0)) { swapEpisode(); i = 0; }
  i = ((i % items.length) + items.length) % items.length;
  const it = items[i];
  const segChange = jump || it.seg.index !== lastSegIndex;
  const lead = segChange ? (i === 0 ? OPEN_LEAD : it.seg.kind === "breaking" ? BREAK_LEAD : SEG_LEAD) : 0;
  const t = now();
  const shot = pickShot(it);
  const est = speechEst(it);
  cur = { i, it, start: t, speechAt: t + lead, est, dur: est, shot, spoken: false, done: false, doneAt: 0, cutAt: 0, cutShot: null, seq: (cur ? cur.seq : 0) + 1 };
  if (est > 10) { cur.cutAt = cur.speechAt + est * 0.56; cur.cutShot = cutFor(it, shot); }
  voice.cancel();
  setCaption("");
  if (segChange) {
    clearLater();
    lastSegIndex = it.seg.index;
    on($("ots"), false); on($("namebar"), false); hideL3();
    $("toptagText").textContent = (it.seg.category || "HEARTBEAT NEWS").toUpperCase();
    on($("toptag"), true);
    $("tkSection").textContent = it.seg.kind === "wire" ? "WIRES" : it.seg.kind === "ad" ? "COMMERCIAL" : it.seg.kind === "breaking" ? "BREAKING" : it.seg.kind === "weather" ? "WEATHER" : "TOP STORIES";
    if (i === 0) {
      titleCard();
      if (studio) { studio.setShot("crane", t, OPEN_LEAD + 2); studio.setWall(it.seg); }
    } else {
      stinger();
      later(() => { if (studio) { studio.setWall(it.seg); studio.setShot(it.seg.kind === "breaking" ? "two" : "wide", now(), 6); } }, 480);
      if (it.seg.kind === "breaking") later(breakingSlam, 700);
    }
    const l3At = (lead - 0.1) * 1000;
    later(() => { if (it.seg.kind === "open") showName(it.who); else showL3(it.seg); }, Math.max(300, l3At));
    markRundown(it.seg.index);
  } else if (it.seg.kind === "open" && it.li === 1) {
    later(() => showName(it.who), 200);
  } else if (it.seg.kind !== "open" && !$("l3").classList.contains("on")) {
    showL3(it.seg);
  }
  setNow(it);
  // Prepare the next line's synth audio while this one plays.
  const nx = items[(i + 1) % items.length];
  if (mode === "sound") voice.prepare(it.who, it.text);
  if (mode === "sound" && nx) setTimeout(() => voice.prepare(nx.who, nx.text), 50);
}

function speakCurrent() {
  const c = cur, it = c.it;
  c.spoken = true;
  if (studio) studio.setShot(c.shot, now(), c.est + 2);
  if ((c.shot === "vex" || c.shot === "joe") && it.li <= 1 && it.seg.kind !== "open" && it.seg.kind !== "close" && it.seg.kind !== "wire") showOTS(it.seg);
  if (mode === "sound" && !paused) {
    const seq = c.seq;
    c.soundStart = now();
    voice.speak(it.who, it.text, { onStart: (d) => { if (cur && cur.seq === seq && d > 0) { cur.dur = d; cur.speechAt = now(); if (cur.est > 10) cur.cutAt = cur.speechAt + d * 0.56; } } })
      .then(() => {
        if (!cur || cur.seq !== seq) return;
        // A device that can't make sound (no audio engine, speech refused) ends lines instantly. Keep the show's pace:
        // finish this line on the clock, mouths animated, as if muted.
        if (now() - c.soundStart < c.est * 0.3) { cur.silentFallback = true; return; }
        cur.done = true; cur.doneAt = now() + GAP;
      });
  }
}

function jumpToSeg(si) {
  const s = segs[si]; if (!s) return;
  const rv = document.getElementById("rv");
  if (rv && renderedTimeline) { const L = renderedTimeline.find((l) => items[l.item] && items[l.item].seg.index === si); if (L) { rv.currentTime = Math.max(0, L.start - 0.5); rv.play().catch(() => {}); } return; }
  startItem(s.first, { jump: true });
}

function swapEpisode() {
  ep = pendingEp; pendingEp = null;
  build(ep); lastSegIndex = -1; renderRundown(); buildTicker();
}

let lastT = now();
function frame() {
  requestAnimationFrame(frame);
  const t = now(), dt = Math.min(0.1, t - lastT); lastT = t;
  const levels = { vex: 0, joe: 0 };
  let talker = null;
  const c = cur;
  if (c && !paused) {
    if (!c.spoken && t >= c.speechAt) speakCurrent();
    if (c.spoken) {
      const since = t - c.speechAt;
      talker = c.it.who;
      if (mode === "sound" && !c.silentFallback) {
        levels[c.it.who] = voice.level(c.it.who);
        if (c.done && t >= c.doneAt) { startItem(c.i + 1); }
        else if (!c.done && t - c.soundStart > c.est * 2.6 + 8) { startItem(c.i + 1); } // an engine that never ended
      } else {
        levels[c.it.who] = silentLevel(c.it.text, since, c.dur);
        if (since >= c.dur + GAP) startItem(c.i + 1);
      }
      if (c.cutAt && t >= c.cutAt && studio) { studio.setShot(c.cutShot, t, Math.max(4, c.dur * 0.5)); c.cutAt = 0; }
      if (ccOn && cur === c) {
        const parts = c.it.cc || (c.it.cc = captionChunks(c.it.text));
        if (parts.length === 1) setCaption(parts[0]);
        else {
          const total = c.it.words; let acc = 0, idx = 0;
          const pos = Math.min(0.999, Math.max(0, since / Math.max(0.1, c.dur))) * total;
          for (let k = 0; k < parts.length; k++) { acc += words(parts[k]); if (pos < acc) { idx = k; break; } idx = k; }
          setCaption(parts[idx]);
        }
      }
      if (since > c.dur + 0.1 && mode !== "sound") setCaption("");
    }
  } else if (paused) {
    levels.vex = voice.level("vex"); levels.joe = voice.level("joe");
    talker = levels.vex > 0.02 ? "vex" : levels.joe > 0.02 ? "joe" : null;
  }
  tickTicker(dt);
  if (studio) { try { studio.frame(t, dt, { levels, talker }); } catch (e) { console.error(e); studio = null; } }
}

// ---- sound, CC, fullscreen, debug ---------------------------------------------------------------------------------
function setMode(m) {
  mode = m;
  $("soundLabel").textContent = m === "sound" ? "Sound on — tap to mute" : "Sound off — tap to listen";
  $("soundBtn").classList.toggle("primary", m !== "sound");
  $("tap").classList.toggle("gone", m === "sound");
}
function soundOn() {
  const rv = document.getElementById("rv");
  if (rv) { rv.muted = false; rv.play().catch(() => {}); $("tap").style.display = "none"; return; }   // rendered episode: its own soundtrack
  voice.unlock();
  setMode("sound");
  // Restart the current line with voice (from the top of the line, not the story).
  if (cur) { const i = cur.i; const keepSeg = lastSegIndex; startItem(i); lastSegIndex = keepSeg; cur.speechAt = now() + 0.15; }
}
function soundOff() { setMode("silent"); voice.cancel(); if (cur) { cur.soundStart = 0; cur.speechAt = now(); cur.spoken = false; } }
$("tap").addEventListener("click", soundOn);
// The TV remote (TV page, phone TV app, Loft wall) reaches in here: sound on from its tap, and the room's volume.
window.HBTVSound = {
  on() { const rv = document.getElementById("rv"); if (rv) { rv.muted = false; rv.play().catch(() => {}); $("tap").style.display = "none"; return; } if (mode !== "sound") soundOn(); },
  volume(v) { voice.setVolume(v); const rv = document.getElementById("rv"); if (rv) rv.volume = v; },
};
$("soundBtn").addEventListener("click", () => (mode === "sound" ? soundOff() : soundOn()));
$("ccBtn").addEventListener("click", () => { ccOn = !ccOn; $("ccBtn").setAttribute("aria-pressed", String(ccOn)); $("cc").classList.toggle("off", !ccOn); });
function isFs() { return document.fullscreenElement || document.webkitFullscreenElement; }
$("fsBtn").addEventListener("click", async () => {
  const tv = $("tv");
  const req = tv.requestFullscreen || tv.webkitRequestFullscreen;
  tv.classList.add("max");
  if (req) { try { await req.call(tv); if (screen.orientation && screen.orientation.lock) screen.orientation.lock("landscape").catch(() => {}); } catch (e) {} }
  onResize();
});
$("exitMax").addEventListener("click", () => {
  if (isFs()) { const p = (document.exitFullscreen || document.webkitExitFullscreen).call(document); if (p && p.catch) p.catch(() => {}); }
  $("tv").classList.remove("max"); onResize();
});
["fullscreenchange", "webkitfullscreenchange"].forEach((ev) => document.addEventListener(ev, () => { if (!isFs()) $("tv").classList.remove("max"); onResize(); }));
let dbgOn = false;
$("dbgBtn").addEventListener("click", () => { dbgOn = !dbgOn; $("dbgBtn").setAttribute("aria-pressed", String(dbgOn)); if (studio) studio.setDebug(dbgOn, $("dbg")); });
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { voice.cancel(); }
  else if (cur && mode === "sound") { startItem(cur.i); }
});

function onResize() {
  const sc = $("screen");
  const w = sc.clientWidth, h = sc.clientHeight;
  sc.style.setProperty("--u", (w / 100).toFixed(3) + "px");
  if (studio) studio.resize(w, h);
  if ($("l3").classList.contains("on")) fitL3();
  if (tkSetW) requestAnimationFrame(() => { const a = $("tkA"); tkSetW = a ? a.getBoundingClientRect().width : tkSetW; });
}
if (window.ResizeObserver) new ResizeObserver(onResize).observe($("screen"));
window.addEventListener("resize", onResize);

// ---- anchor settings (voice + look), shared for everyone ----------------------------------------------------------
export async function loadAnchorSettings() {
  try {
    const r = await timeout(fetch(SUPABASE_URL + "/rest/v1/news_anchor_settings?select=anchor,settings,updated_at", { headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY } }), 5000);
    if (!r.ok) return { ok: false, status: r.status };
    const rows = await r.json();
    for (const row of rows) if (row && (row.anchor === "vex" || row.anchor === "joe")) applySettings(row.anchor, row.settings || {});
    return { ok: true, rows };
  } catch (e) { return { ok: false, error: String(e) }; }
}
function applySettings(who, s) {
  voice.setSettings(who, s);
  if (studio) studio.setLook(who, voice.settings[who].look);
}

// Admins get the Voice Studio. Anyone else never downloads it.
async function maybeStudio() {
  try {
    const hasSession = Object.keys(localStorage).some((k) => /^sb-.*-auth-token$/.test(k));
    if (!hasSession) return;
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase.rpc("is_admin");
    if (data !== true) return;
    const mod = await import("/news/studio-panel.js");
    mod.mountStudio($("studio"), { supabase, session, voice, api: window.HBNews });
  } catch (e) { console.warn("studio", e); }
}

window.HBNews = {
  voice,
  get studio() { return studio; },
  applySettings,
  defaults: DEFAULT_SETTINGS,
  // rendered show: the video keeps the picture and sound, so a Voice Studio test pauses the video instead
  pause() { const rv = document.getElementById("rv"); if (rv) { rv.pause(); return; } paused = true; voice.cancel(); setCaption(""); },
  resume() { const rv = document.getElementById("rv"); if (rv) { rv.play().catch(() => {}); return; } paused = false; if (cur) startItem(cur.i); },
  get rendered() { return !!document.getElementById("rv"); },
  unlock() { voice.unlock(); },
  get mode() { return mode; }
};

// ---- boot ---------------------------------------------------------------------------------------------------------
// ---- rendered episodes (made in Unreal on the MSI each morning, stored in Supabase Storage "news-video") -------------
// ?rendered=1 forces it on, ?rendered=0 forces the live 3D show. RENDERED_DEFAULT turns it on for everyone once approved.
const RENDERED_DEFAULT = false;
const RENDERED_INDEX = SUPABASE_URL + "/storage/v1/object/public/news-video/index.json";
async function renderedFor(date) {
  const q = new URLSearchParams(location.search).get("rendered");
  if (q === "0" || (!RENDERED_DEFAULT && q !== "1")) return null;
  try {
    const idx = await (await timeout(fetch(RENDERED_INDEX, { cache: "no-cache" }), 4000)).json();
    return (idx.episodes || []).find((e) => e.date === date) || null;
  } catch (e) { return null; }
}
// The rendered video carries picture and sound; the page still plays the broadcast graphics on top of it - rundown
// highlight, story tag, stinger, lower thirds, over-the-shoulder box, subtitles - timed from the video's own clock using
// the timing file published with it (each line's start and length). Tapping a story in the rundown jumps the video there.
let renderedTimeline = null;
async function driveRendered(r, tl) {
  if (!tl) return;
  const v = document.getElementById("rv"); if (!v) return;
  mode = "silent";
  renderedTimeline = tl.lines.map((l) => ({ ...l, item: items.findIndex((it) => it.seg.id === l.seg && it.li === l.li) })).filter((l) => l.item >= 0);
  let at = -1, lastT = performance.now();
  const tick = () => { requestAnimationFrame(tick); const n = performance.now(); tickTicker(Math.min(0.1, (n - lastT) / 1000)); lastT = n; };
  requestAnimationFrame(tick);
  const loop = () => {
    const t = v.currentTime;
    let k = -1;
    for (let i = 0; i < renderedTimeline.length; i++) if (renderedTimeline[i].start - 0.6 <= t) k = i; else break;
    if (k < 0) { if (at !== -1) { at = -1; lastSegIndex = -1; } return; }
    const L = renderedTimeline[k];
    if (k !== at) {
      if (k < at || k > at + 1) lastSegIndex = -1;   // a jump (seek / loop): redraw the story's graphics from scratch
      at = k; startItem(L.item, { jump: lastSegIndex === -1 });
      const it = items[L.item];
      if ((L.camera === "vex" || L.camera === "joe") && it.li <= 1 && !["open", "close", "wire"].includes(it.seg.kind)) setTimeout(() => showOTS(it.seg), 300);
    }
    const since = t - L.start, it = items[L.item];
    if (!ccOn || since < 0 || since > L.dur + 0.15) { setCaption(""); return; }
    const parts = it.cc || (it.cc = captionChunks(it.text));
    if (parts.length === 1) return setCaption(parts[0]);
    const pos = Math.min(0.999, Math.max(0, since / Math.max(0.1, L.dur))) * it.words; let acc = 0, idx = 0;
    for (let q = 0; q < parts.length; q++) { acc += words(parts[q]); if (pos < acc) { idx = q; break; } idx = q; }
    setCaption(parts[idx]);
  };
  setInterval(loop, 100);   // a steady clock (animation frames pause in hidden tabs; the graphics must not)
}

function playRendered(r) {
  const scr = $("screen");
  $("gl").style.display = "none";
  // the broadcast graphics stay: driveRendered() plays them in time with the video
  const v = document.createElement("video");
  v.id = "rv"; v.src = r.video; if (r.poster) v.poster = r.poster;
  v.playsInline = true; v.autoplay = true; v.muted = true; v.loop = true; v.preload = "auto";
  v.style.cssText = "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#000;z-index:0";
  scr.insertBefore(v, scr.firstChild);
  v.play().catch(() => {});
  const tap = $("tap");
  if (tap) { tap.style.display = ""; tap.onclick = (e) => { e.stopPropagation(); v.muted = false; v.play(); tap.style.display = "none"; }; }
  $("loading").classList.add("gone");
}

async function boot() {
  onResize();
  const fontsReady = document.fonts ? timeout(Promise.all([document.fonts.load('800 40px "Barlow Condensed"'), document.fonts.load('600 40px "Barlow Condensed"')]), 2500).catch(() => {}) : Promise.resolve();
  let date = null;
  try { const idx = await loadIndex(); date = idx.latest; } catch (e) { date = null; }
  const [episode, w] = await Promise.all([
    (date ? loadEpisode(date) : Promise.reject(new Error("no index"))).catch(() => loadEpisode("2026-09-24")),
    loadWire(),
    loadAds()
  ]).then(([e, wl, a]) => { adsCat = a; return [e, wl]; });
  ep = episode; wire = w;
  await fontsReady;
  // The rendered (Unreal) episode, when the MSI has made today's: play the video instead of drawing the studio live.
  const rendered = await renderedFor(ep.date);
  if (rendered) {
    playRendered(rendered);
    $("madeRendered").hidden = false; $("madeLive").hidden = true;
    const tl = rendered.timing ? await fetch(rendered.timing, { cache: "no-cache" }).then((x) => x.json()).catch(() => null) : null;
    if (tl && tl.segments) build({ segments: tl.segments }, { asRendered: true }); else build(ep);
    renderRundown(); buildTicker(); tickClock(); setInterval(tickClock, 1000);
    setTimeout(maybeStudio, 1200);
    driveRendered(rendered, tl).catch((e) => console.error(e));
    return;
  }
  const quality = Object.assign({}, (window.HBDevice && window.HBDevice.quality) || { tier: "desktop", allowShadows: true, allowBloom: true, maxPixelRatio: 2 });
  // ?quality=lite|phone|desktop forces a tier (for checking what a phone draws); ?bloom=0 turns the glow pass off.
  const qp = new URLSearchParams(location.search);
  if (qp.get("quality") === "lite") Object.assign(quality, { tier: "mobile-lite", allowShadows: false, allowBloom: false, maxPixelRatio: 1.15 });
  if (qp.get("quality") === "phone") Object.assign(quality, { tier: "mobile-high", allowShadows: true, allowBloom: true, maxPixelRatio: 1.5 });
  if (qp.get("quality") === "desktop") Object.assign(quality, { tier: "desktop", allowShadows: true, allowBloom: true, maxPixelRatio: 2 });
  if (qp.get("bloom") === "1") quality.bloom = true;
  if (quality.tier !== "no-webgl") {
    try { studio = createNewsroom($("gl"), { quality }); } catch (e) { console.error(e); studio = null; }
  }
  if (!studio) $("loadingText").textContent = "3D IS OFF ON THIS DEVICE — CAPTIONS AND SOUND STILL PLAY";
  onResize();
  const settingsP = loadAnchorSettings();
  build(ep);
  renderRundown();
  buildTicker();
  tickClock(); setInterval(tickClock, 1000);
  await Promise.race([settingsP, new Promise((r) => setTimeout(r, 1500))]);
  for (const who of ["vex", "joe"]) if (studio) studio.setLook(who, voice.settings[who].look);
  const start = tuneInIndex();
  // Tuning in mid-story: open on that story's graphics without replaying the show open.
  startItem(start, { jump: true });
  requestAnimationFrame(frame);
  setTimeout(() => $("loading").classList.add("gone"), studio ? 350 : 2500);
  setTimeout(maybeStudio, 1200);
  // A new day's show replaces this one at the next story break.
  setInterval(async () => {
    try { const idx = await loadIndex(); if (idx.latest && ep && idx.latest !== ep.date) { const next = await loadEpisode(idx.latest); wire = await loadWire(); pendingEp = next; } } catch (e) {}
  }, 10 * 60 * 1000);
}
boot().catch((e) => { console.error(e); $("loadingText").textContent = "THE SHOW COULD NOT LOAD — " + String(e.message || e).toUpperCase(); });
