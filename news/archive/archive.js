// Heartbeat News - the archive: every day's captures from every AI, read straight from the public watch repo on GitHub.
// No database. The file list comes from GitHub's tree API (one call, cached 10 minutes); each capture is read from
// raw.githubusercontent.com. If GitHub's API says no (it allows 60 calls an hour per address), the list falls back to
// jsDelivr's mirror plus a direct check for today's and yesterday's files.
const REPO = "JaronKBragg7337/watch", BRANCH = "master";
const RAW = (p) => `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${p}`;
const CDN = (p) => `https://cdn.jsdelivr.net/gh/${REPO}@${BRANCH}/${p}`;
const BLOB = (p) => `https://github.com/${REPO}/blob/${BRANCH}/${p}`;
const FIRST_DAY = "2026-09-18";
const TZ = "America/Indiana/Indianapolis";
// Folders in the watch repo that are not news captures.
const SKIP = new Set(["jaron-x", "offers", "agents", "collectors"]);
const FILE_RE = /^([a-z0-9-]+)\/(\d{4}-\d{2}-\d{2})(?:-(\d{2}))?\.(md|jsonl)$/;
const KNOWN = ["codex", "claude", "grok", "perplexity", "qwen", "kimi", "deepseek"];

const WRITERS = {
  codex: { name: "Codex", by: "OpenAI", color: "#10a37f" },
  claude: { name: "Claude", by: "Anthropic", color: "#d97757" },
  grok: { name: "Grok", by: "xAI", color: "#e8e8e8" },
  perplexity: { name: "Perplexity", by: "Perplexity", color: "#20b8cd" },
  qwen: { name: "Qwen", by: "Alibaba · local", color: "#8b6cff" },
  kimi: { name: "Kimi", by: "Moonshot", color: "#4fb3ff" },
  deepseek: { name: "DeepSeek", by: "DeepSeek · reader", color: "#4d6bfe" },
  brief: { name: "Brief", by: "organizer", color: "#f2b400" },
  "market-feed": { name: "Market feed", by: "organizer", color: "#f2b400" }
};
const writerInfo = (w) => WRITERS[w] || { name: w.charAt(0).toUpperCase() + w.slice(1), by: "", color: "#9aa4b2" };
const writerOrder = (w) => { const i = KNOWN.indexOf(w); return i < 0 ? 50 : i; };

// Today's FORMAT.md names (2026-09-24). A day's own files win when they name a domain differently (e.g. 11 was
// "Indiana / Midwest ground truth" until 2026-09-24).
const DOMAINS = [
  ["01", "Crypto / on-chain / stablecoins", "Crypto"], ["02", "Stocks / macro / rates / labor", "Markets"],
  ["03", "AI / models / infra / pricing of intelligence", "AI"], ["04", "Energy / grid / compute power / materials", "Energy"],
  ["05", "Geopolitics / conflict / borders / law", "Geopolitics"], ["06", "Companies / hiring / M&A / who is shipping", "Companies"],
  ["07", "Demographics / migration / prices on the ground / culture", "Prices & culture"], ["08", "Supply chain / freight / food / housing inputs", "Supply chain"],
  ["09", "Prediction-market resolution events", "Prediction markets"], ["10", "Crypto / stock catalysts", "Catalysts"],
  ["11", "Major US cities and regions", "US cities"], ["12", "Sports", "Sports"], ["13", "U.S. politics and elections", "Politics"],
  ["14", "Weather, climate and disasters", "Weather"], ["15", "Health", "Health"], ["16", "Law, courts and regulation", "Law"],
  ["17", "Outages and cyber", "Cyber"], ["18", "Disclosure and anomalies", "Anomalies"], ["19", "Science and space", "Science"],
  ["20", "Entertainment and culture markets", "Entertainment"], ["21", "Uncategorised", "Other"]
];
const DOMAIN = Object.fromEntries(DOMAINS.map(([n, t, s]) => [n, { num: n, title: t, short: s }]));

// ---- small helpers ----------------------------------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function cap1(s) { s = String(s || ""); return s.charAt(0).toUpperCase() + s.slice(1); }
function todayET() { return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
function addDays(d, n) { const t = new Date(d + "T12:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); }
function fmtDay(d, opts = { weekday: "long", month: "long", day: "numeric", year: "numeric" }) { try { return new Date(d + "T12:00:00Z").toLocaleDateString("en-US", Object.assign({ timeZone: "UTC" }, opts)); } catch (e) { return d; } }
function host(u) { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return "link"; } }
function timeout(p, ms) { return Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error("timeout")), ms))]); }
function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || "null"); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }

// ---- the file list ----------------------------------------------------------------------------------------------------
function toFile(path) {
  const m = path.match(FILE_RE);
  if (!m || SKIP.has(m[1])) return null;
  const [, writer, date, hour, ext] = m;
  if (date < FIRST_DAY) return null;
  const kind = ext === "jsonl" ? "feed" : writer === "brief" ? "brief" : "capture";
  return { path, writer, date, hour: hour || "", kind };
}
async function listFromGitHub() {
  const r = await timeout(fetch(`https://api.github.com/repos/${REPO}/git/trees/${BRANCH}?recursive=1`, { headers: { Accept: "application/vnd.github+json" } }), 8000);
  if (!r.ok) throw new Error("github " + r.status);
  const d = await r.json();
  return (d.tree || []).filter((x) => x.type === "blob").map((x) => x.path);
}
async function listFromJsDelivr() {
  const r = await timeout(fetch(`https://data.jsdelivr.com/v1/packages/gh/${REPO}@${BRANCH}?structure=flat`), 8000);
  if (!r.ok) throw new Error("jsdelivr " + r.status);
  const d = await r.json();
  return (d.files || []).map((f) => String(f.name || "").replace(/^\//, ""));
}
async function probeRecent() {
  // The mirror can lag a few hours; check today's and yesterday's files directly.
  const days = [todayET(), addDays(todayET(), -1)], found = [];
  await Promise.all(days.flatMap((d) => KNOWN.concat("brief").map((w) => `${w}/${d}.md`).concat(`market-feed/${d}.jsonl`)).map(async (p) => {
    try { const r = await timeout(fetch(RAW(p), { method: "HEAD" }), 6000); if (r.ok) found.push(p); } catch (e) {}
  }));
  return found;
}
async function listFiles(force) {
  const cached = store("hb-archive-list");
  if (!force && cached && Date.now() - cached.at < 10 * 60 * 1000) return { files: cached.files, via: cached.via };
  let paths = null, via = "GitHub";
  try { paths = await listFromGitHub(); }
  catch (e) {
    try { paths = await listFromJsDelivr(); via = "jsDelivr mirror"; } catch (e2) { paths = []; via = "direct check"; }
    paths = Array.from(new Set(paths.concat(await probeRecent())));
    if (!paths.length && cached) return { files: cached.files, via: "saved list (GitHub unreachable)" };
  }
  const files = paths.map(toFile).filter(Boolean).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : writerOrder(a.writer) - writerOrder(b.writer)));
  if (files.length) store("hb-archive-list", { at: Date.now(), files, via });
  return { files, via };
}

// ---- parsing ----------------------------------------------------------------------------------------------------------
const URL_RE = /https?:\/\/[^\s,;)\]>"]+/g;
export function parseItem(s) {
  const it = { raw: s, time: "", label: "", cls: "", text: "", urls: [], money: "" };
  let rest = s.trim();
  for (;;) {
    const m = rest.match(/^\[([^\]]{1,80})\]\s*/);
    if (!m) break;
    const v = m[1].trim(), lv = v.toLowerCase();
    if (!it.label && /^(observed|claim|theory)\b/.test(lv)) it.label = lv.match(/^(observed|claim|theory)/)[1];
    else if (!it.cls && /(official|press|solo|social|model-only)/.test(lv)) it.cls = lv;
    // The when-marker: a clock time ("16:42 local") or, in the first captures, "09-18", "this week", "pre-market".
    else if (!it.time && !it.label && v.length <= 28) it.time = v.replace(/\s*local$/i, "");
    else break;
    rest = rest.slice(m[0].length);
  }
  const mm = rest.match(/\s+[—–-]{1,2}\s+money:\s*([\s\S]+)$/i);
  if (mm) { it.money = mm[1].trim(); rest = rest.slice(0, mm.index); }
  it.urls = Array.from(new Set((rest.match(URL_RE) || []).map((u) => u.replace(/[.,:;]+$/, ""))));
  const cut = rest.search(/\s+[—–]\s+\(?\s*(?:[a-z ]{1,20}:\s*)?https?:\/\//i);
  let text = cut >= 0 ? rest.slice(0, cut) : rest;
  text = text.replace(URL_RE, "").replace(/\(\s*[,;:]?\s*\)/g, "").replace(/\s{2,}/g, " ").trim().replace(/[\s—–,;:]+$/, "");
  it.text = text || rest.replace(URL_RE, "").trim() || rest;
  return it;
}
export function parseCapture(src, file) {
  const text = String(src).replace(/^﻿/, "").replace(/\r/g, "");
  const cap = { file, title: "", meta: {}, domains: {}, notes: [], prose: [] };
  let sec = null, item = null;
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim()) { item = null; continue; }
    if (/^#\s/.test(line)) { cap.title = line.replace(/^#\s+/, ""); continue; }
    const h = line.match(/^##+\s+(.*)$/);
    if (h) {
      item = null;
      const d = h[1].match(/^(\d{1,2})\s+(.+)$/);
      if (d) {
        const num = d[1].padStart(2, "0");
        sec = { type: "domain", num, title: cap1(d[2].replace(/\s{2,}\(.*$/, "").trim()), items: [] };
        cap.domains[num] = sec;
      } else { sec = { type: "note", title: h[1].trim(), items: [] }; cap.notes.push(sec); }
      continue;
    }
    if (!sec) {
      for (const part of line.split("|")) { const m = part.trim().match(/^([A-Za-z][A-Za-z ]{0,20}):\s*(.*)$/); if (m) cap.meta[m[1].toLowerCase()] = m[2].trim(); }
      continue;
    }
    const bullet = line.match(/^(\s*)[-*]\s+(.*)$/);
    if (bullet && bullet[1].length < 2) { item = parseItem(bullet[2]); sec.items.push(item); }
    else if (item) { item.raw += " " + line.trim().replace(/^[-*]\s+/, ""); Object.assign(item, parseItem(item.raw)); }
    else { item = parseItem(line.trim()); sec.items.push(item); }
  }
  return cap;
}
function parseFeed(src) {
  return String(src).split("\n").map((l) => { try { return l.trim() ? JSON.parse(l) : null; } catch (e) { return null; } }).filter(Boolean);
}
function parseBrief(src) {
  return String(src).replace(/^﻿/, "").replace(/\r/g, "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
}

// ---- loading ----------------------------------------------------------------------------------------------------------
const cache = new Map();
async function fetchText(path) {
  try { const r = await timeout(fetch(RAW(path)), 10000); if (r.ok) return await r.text(); } catch (e) {}
  const r2 = await timeout(fetch(CDN(path)), 10000);
  if (!r2.ok) throw new Error("could not read " + path);
  return r2.text();
}
function load(file) {
  if (cache.has(file.path)) return cache.get(file.path);
  const p = fetchText(file.path).then((t) => {
    if (file.kind === "feed") return { file, feed: parseFeed(t) };
    if (file.kind === "brief") return { file, brief: parseBrief(t) };
    return { file, cap: parseCapture(t, file) };
  }).catch((e) => { cache.delete(file.path); return { file, error: String(e.message || e) }; });
  cache.set(file.path, p);
  return p;
}
async function loadMany(files, onProgress) {
  const out = new Array(files.length); let done = 0, i = 0;
  const worker = async () => { while (i < files.length) { const k = i++; out[k] = await load(files[k]); done++; onProgress && onProgress(done, files.length); } };
  await Promise.all(Array.from({ length: Math.min(6, files.length) }, worker));
  return out;
}

// ---- state ------------------------------------------------------------------------------------------------------------
let FILES = [], VIA = "", DATES = [], LATEST = "";
const state = { view: "day", day: "", topic: "03", ai: "codex", q: "", label: "all" };

function readHash() {
  const h = decodeURIComponent(location.hash.replace(/^#\/?/, "")).split("/");
  const [v, a] = [h[0], h.slice(1).join("/")];
  if (v === "day" && /^\d{4}-\d{2}-\d{2}$/.test(a)) { state.view = "day"; state.day = a; }
  else if (v === "topic" && /^\d{2}$/.test(a)) { state.view = "topic"; state.topic = a; }
  else if (v === "ai" && a) { state.view = "ai"; state.ai = a; }
  else if (v === "search") { state.view = "search"; state.q = a; }
  else { state.view = "day"; state.day = ""; }
}
function go(view, arg) {
  const h = "#/" + view + (arg != null && arg !== "" ? "/" + encodeURIComponent(arg) : "");
  if (location.hash !== h) location.hash = h; else render();
}

// ---- rendering helpers ------------------------------------------------------------------------------------------------
function writerBadge(w, extra = "") {
  const i = writerInfo(w);
  return `<span class="wb" style="--wc:${esc(i.color)}"><i></i>${esc(i.name)}${extra ? ` <small>${esc(extra)}</small>` : ""}</span>`;
}
function hl(s, terms) {
  let out = esc(s);
  for (const t of terms || []) { if (!t) continue; const re = new RegExp("(" + esc(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig"); out = out.replace(re, "<mark>$1</mark>"); }
  return out;
}
function itemHTML(it, { terms, context } = {}) {
  const lab = it.label ? `<span class="lab ${it.label}">${esc(it.label)}</span>` : "";
  const cls = it.cls ? `<span class="cls">${esc(it.cls)}</span>` : "";
  const tm = it.time ? `<span class="tm">${esc(it.time)}</span>` : "";
  const links = it.urls.slice(0, 6).map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(host(u))}</a>`).join("");
  const money = it.money && !/^none\b/i.test(it.money) ? `<span class="money" title="What market or asset it touches">${hl(it.money, terms)}</span>` : "";
  const ctx = context ? `<div class="ctx">${context}</div>` : "";
  const plain = !it.label && !it.urls.length;
  return `<article class="it${plain ? " plain" : ""}">${ctx}${lab || cls || tm ? `<div class="it-top">${lab}${cls}${tm}</div>` : ""}<p>${hl(it.text, terms)}</p>${links || money ? `<div class="it-src">${links}${money}</div>` : ""}</article>`;
}
function capsFor(results) { return results.filter((r) => r && r.cap); }
function domainTitle(num, caps) {
  for (const c of caps) if (c.cap.domains[num]) return c.cap.domains[num].title;
  return (DOMAIN[num] || {}).title || "Domain " + num;
}
const countItems = (items) => items.filter((i) => i.label || i.urls.length).length;

function setLoading(on, msg) {
  const el = $("loading");
  el.hidden = !on;
  if (msg) $("loadingText").textContent = msg;
}

// ---- the day ----------------------------------------------------------------------------------------------------------
async function renderDay() {
  const day = state.day || LATEST;
  const files = FILES.filter((f) => f.date === day);
  const isToday = day === todayET();
  $("dayInput").value = day;
  $("dayInput").max = LATEST > todayET() ? LATEST : todayET();
  const i = DATES.indexOf(day);
  $("prevDay").disabled = !(i >= 0 ? DATES[i + 1] : DATES.find((d) => d < day));
  $("nextDay").disabled = !(i >= 0 ? DATES[i - 1] : [...DATES].reverse().find((d) => d > day));
  document.querySelectorAll("#dayStrip button").forEach((b) => b.classList.toggle("on", b.dataset.day === day));
  const main = $("view");
  if (!files.length) {
    const near = DATES.filter((d) => d !== day).slice(0, 3);
    main.innerHTML = `<section class="empty"><h2>${esc(fmtDay(day))}</h2><p>${isToday ? "Today's captures haven't landed yet. Codex writes at 7:30 AM, DeepSeek reads at 9:00, Claude files in the afternoon." : "No AI filed a capture on this day."}</p>
      ${near.length ? `<p>Nearest days with news: ${near.map((d) => `<a href="#/day/${d}">${esc(fmtDay(d, { weekday: "short", month: "short", day: "numeric" }))}</a>`).join(" · ")}</p>` : ""}</section>`;
    return;
  }
  setLoading(true, "Reading " + files.length + " files from GitHub…");
  const results = await loadMany(files);
  setLoading(false);
  if (state.view !== "day" || (state.day || LATEST) !== day) return;
  const caps = capsFor(results);
  const brief = results.find((r) => r && r.brief), feed = results.find((r) => r && r.feed);
  const errors = results.filter((r) => r && r.error);
  const writers = caps.map((c) => c.cap).sort((a, b) => writerOrder(a.file.writer) - writerOrder(b.file.writer));

  const writerCards = writers.map((c) => {
    const n = Object.values(c.domains).reduce((a, d) => a + countItems(d.items), 0);
    const status = (c.meta.status || "").split(/\s/)[0];
    return `<a class="wcard" href="${esc(BLOB(c.file.path))}" target="_blank" rel="noopener">${writerBadge(c.file.writer, c.file.hour ? c.file.hour + ":00" : "")}
      <span class="wmeta">${c.meta.time ? "filed " + esc(c.meta.time) : ""}${status ? ` · <b class="st ${esc(status.toLowerCase())}">${esc(status)}</b>` : ""}</span>
      <span class="wn">${n} item${n === 1 ? "" : "s"}${/reader/i.test(c.meta.window || c.meta.sources || "") ? " · reads the others" : ""}</span></a>`;
  }).join("");

  const nums = DOMAINS.map((d) => d[0]);
  for (const c of caps) for (const n of Object.keys(c.cap.domains)) if (!nums.includes(n)) nums.push(n);
  const counts = Object.fromEntries(nums.map((n) => [n, caps.reduce((a, c) => a + (c.cap.domains[n] ? countItems(c.cap.domains[n].items) : 0), 0)]));
  const jump = nums.map((n) => `<a href="#d-${n}" class="jc${counts[n] ? "" : " zero"}" data-jump="${n}"><b>${n}</b> ${esc((DOMAIN[n] || {}).short || "")}${counts[n] ? ` <span>${counts[n]}</span>` : ""}</a>`).join("");

  const sections = nums.map((n) => {
    const blocks = writers.filter((c) => c.domains[n] && c.domains[n].items.length).map((c) => {
      const items = c.domains[n].items.filter(passLabel);
      if (!items.length) return "";
      return `<div class="wblock">${writerBadge(c.file.writer)}<div class="items">${items.map((it) => itemHTML(it)).join("")}</div></div>`;
    }).join("");
    const title = domainTitle(n, caps);
    return `<section class="dom${blocks ? "" : " none"}" id="d-${n}"><h3><span class="dn">${n}</span><span class="dt">${esc(title)}</span>${counts[n] ? `<span class="dc">${counts[n]}</span>` : ""}<a class="dlink" href="#/topic/${n}" title="This topic on every day">every day →</a></h3>
      ${blocks || `<p class="nothing">Nothing filed here${writers.length ? " by " + writers.map((c) => writerInfo(c.file.writer).name).join(", ") : ""}.</p>`}</section>`;
  }).join("");

  const noteTitles = ["Persistence", "Convergence", "Divergence", "From the other hemisphere", "Silences", "Could not see"];
  const notes = writers.flatMap((c) => c.notes.filter((s) => s.items.length).map((s) => ({ c, s })));
  notes.sort((a, b) => { const ia = noteTitles.indexOf(a.s.title), ib = noteTitles.indexOf(b.s.title); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
  const notesHTML = notes.length ? `<details class="notes"><summary>What the AIs said about their own day <span>persistence, silences, what they could not see</span></summary>
    ${notes.map(({ c, s }) => `<div class="note">${writerBadge(c.file.writer)}<h4>${esc(s.title)}</h4>${s.items.map((it) => itemHTML(it)).join("")}</div>`).join("")}</details>` : "";

  const feedHTML = feed && feed.feed.length ? `<section class="feed"><h3><span class="dn">$</span>Market feed<span class="dc">${feed.feed.length}</span></h3>
    <p class="sub">What the trading bots read that day: a hint and a trail, never an order.</p>
    ${feed.feed.map((f) => `<article class="it"><div class="it-top">${f.label ? `<span class="lab ${esc(f.label)}">${esc(f.label)}</span>` : ""}${f.lean ? `<span class="cls">lean: ${esc(f.lean)}</span>` : ""}${f.confidence ? `<span class="tm">${esc(f.confidence)} confidence</span>` : ""}</div>
      <p><b>${esc(f.market || "")}</b> — ${esc(f.event || "")}</p>${f.rule_effect ? `<p class="re">${esc(f.rule_effect)}</p>` : ""}
      <div class="it-src">${f.source ? `<a href="${esc(f.source)}" target="_blank" rel="noopener">${esc(host(f.source))}</a>` : ""}${(f.from || []).map((x) => `<span class="money">${esc(x)}</span>`).join("")}</div></article>`).join("")}</section>` : "";

  const briefHTML = brief && brief.brief.length ? `<section class="brief"><h3>The day's brief <small>written by the organizer from the captures</small></h3>${brief.brief.map((p) => `<p>${esc(p)}</p>`).join("")}</section>` : "";

  main.innerHTML = `
    <header class="dayhead"><div class="kicker">${isToday ? '<span class="live"></span>Today' : day === LATEST ? "Latest captures" : "Archive"}</div>
      <h2>${esc(fmtDay(day))}</h2>
      <p class="dsub">${caps.length} AI${caps.length === 1 ? "" : "s"} filed · ${Object.values(counts).reduce((a, b) => a + b, 0)} items across ${Object.values(counts).filter(Boolean).length} of ${nums.length} domains${day === LATEST && !isToday ? " · today's captures haven't landed yet" : ""}</p></header>
    <div class="wcards">${writerCards}</div>
    ${errors.length ? `<p class="err">Could not read: ${errors.map((e) => esc(e.file.path)).join(", ")}</p>` : ""}
    ${briefHTML}
    <nav class="jump" aria-label="Jump to a domain">${jump}</nav>
    ${labelFilter()}
    ${sections}
    ${feedHTML}
    ${notesHTML}`;
  bindLabelFilter();
}

function labelFilter() {
  return `<div class="lf" role="group" aria-label="Filter by label">${["all", "observed", "claim", "theory"].map((l) => `<button type="button" data-label="${l}" class="${state.label === l ? "on" : ""} ${l}">${l === "all" ? "Everything" : cap1(l)}</button>`).join("")}</div>`;
}
function bindLabelFilter() {
  document.querySelectorAll(".lf button").forEach((b) => b.addEventListener("click", () => { state.label = b.dataset.label; render(); }));
}

// ---- across days: one topic from everyone, or everything from one AI ---------------------------------------------------
async function loadAllCaptures(msg) {
  const files = FILES.filter((f) => f.kind === "capture");
  setLoading(true, msg + " 0/" + files.length);
  const res = await loadMany(files, (d, n) => { $("loadingText").textContent = msg + " " + d + "/" + n; });
  setLoading(false);
  return capsFor(res);
}
function byDay(rows) {
  const m = new Map();
  for (const r of rows) { if (!m.has(r.date)) m.set(r.date, []); m.get(r.date).push(r); }
  return [...m.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
}
const passLabel = (it) => state.label === "all" || it.label === state.label;

async function renderTopic() {
  const n = state.topic;
  $("topicSel").value = n;
  const caps = await loadAllCaptures("Reading every capture…");
  if (state.view !== "topic" || state.topic !== n) return;
  const rows = [];
  for (const c of caps) { const d = c.cap.domains[n]; if (d) rows.push({ date: c.file.date, cap: c.cap, items: d.items.filter((it) => (it.label || it.urls.length) && passLabel(it)), title: d.title }); }
  const days = byDay(rows.filter((r) => r.items.length));
  const total = days.reduce((a, [, rs]) => a + rs.reduce((x, r) => x + r.items.length, 0), 0);
  $("view").innerHTML = `<header class="dayhead"><div class="kicker">One topic · every AI · every day</div><h2><span class="dn big">${esc(n)}</span>${esc((DOMAIN[n] || {}).title || "Domain " + n)}</h2>
    <p class="dsub">${total} items on ${days.length} day${days.length === 1 ? "" : "s"}${n === "11" ? " · until Sept 24 this domain was Indiana / Midwest ground truth" : ""}</p></header>
    ${labelFilter()}
    ${days.map(([date, rs]) => `<section class="dom"><h3><a href="#/day/${date}" class="dday">${esc(fmtDay(date, { weekday: "short", month: "short", day: "numeric" }))}</a><span class="dc">${rs.reduce((x, r) => x + r.items.length, 0)}</span></h3>
      ${rs.sort((a, b) => writerOrder(a.cap.file.writer) - writerOrder(b.cap.file.writer)).map((r) => `<div class="wblock">${writerBadge(r.cap.file.writer)}<div class="items">${r.items.map((it) => itemHTML(it)).join("")}</div></div>`).join("")}</section>`).join("") || `<p class="nothing big">Nothing filed under this topic yet${state.label !== "all" ? " with that label" : ""}.</p>`}`;
  bindLabelFilter();
}

async function renderAI() {
  const w = state.ai;
  const caps = await loadAllCaptures("Reading every capture…");
  if (state.view !== "ai" || state.ai !== w) return;
  const writers = Array.from(new Set(FILES.filter((f) => f.kind === "capture").map((f) => f.writer))).sort((a, b) => writerOrder(a) - writerOrder(b));
  $("aiSel").innerHTML = writers.map((x) => `<option value="${esc(x)}">${esc(writerInfo(x).name)}</option>`).join("");
  $("aiSel").value = w;
  const mine = caps.filter((c) => c.cap.file.writer === w).sort((a, b) => (a.file.date < b.file.date ? 1 : -1));
  const info = writerInfo(w);
  const total = mine.reduce((a, c) => a + Object.values(c.cap.domains).reduce((x, d) => x + d.items.filter((it) => (it.label || it.urls.length) && passLabel(it)).length, 0), 0);
  $("view").innerHTML = `<header class="dayhead"><div class="kicker">One AI · every topic · every day</div><h2>${writerBadge(w)} <span class="by">${esc(info.by)}</span></h2>
    <p class="dsub">${total} items in ${mine.length} capture${mine.length === 1 ? "" : "s"}</p></header>
    ${labelFilter()}
    ${mine.map((c) => {
      const doms = Object.values(c.cap.domains).map((d) => ({ d, items: d.items.filter((it) => (it.label || it.urls.length) && passLabel(it)) })).filter((x) => x.items.length);
      return `<section class="dom"><h3><a href="#/day/${c.file.date}" class="dday">${esc(fmtDay(c.file.date, { weekday: "short", month: "short", day: "numeric" }))}${c.file.hour ? " · " + c.file.hour + ":00" : ""}</a>${c.cap.meta.status ? `<span class="st ${esc(c.cap.meta.status.split(/\s/)[0].toLowerCase())}">${esc(c.cap.meta.status.split(/\s/)[0])}</span>` : ""}<a class="dlink" href="${esc(BLOB(c.file.path))}" target="_blank" rel="noopener">file →</a></h3>
        ${doms.map(({ d, items }) => `<div class="wblock"><span class="dtag"><b>${esc(d.num)}</b> ${esc(d.title)}</span><div class="items">${items.map((it) => itemHTML(it)).join("")}</div></div>`).join("") || `<p class="nothing">Nothing${state.label !== "all" ? " with that label" : ""} in this capture.</p>`}</section>`;
    }).join("") || `<p class="nothing big">${esc(info.name)} has not filed a capture yet.</p>`}`;
  bindLabelFilter();
}

// ---- search -----------------------------------------------------------------------------------------------------------
async function renderSearch() {
  const q = state.q.trim();
  $("searchIn").value = q;
  if (!q) { $("view").innerHTML = `<header class="dayhead"><div class="kicker">Search every day</div><h2>Search the archive</h2><p class="dsub">Every item from every AI since ${esc(fmtDay(FIRST_DAY, { month: "long", day: "numeric" }))}. Try <a href="#/search/diesel">diesel</a>, <a href="#/search/Hormuz">Hormuz</a>, <a href="#/search/measles">measles</a> or <a href="#/search/stablecoin">stablecoin</a>.</p></header>`; return; }
  const caps = await loadAllCaptures("Searching every capture…");
  if (state.view !== "search" || state.q.trim() !== q) return;
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const rows = [];
  for (const c of caps) {
    const secs = Object.values(c.cap.domains).concat(c.cap.notes);
    for (const s of secs) for (const it of s.items) {
      if (!passLabel(it)) continue;
      const hay = (it.text + " " + it.money + " " + it.urls.join(" ") + " " + s.title + " " + writerInfo(c.file.writer).name).toLowerCase();
      if (terms.every((t) => hay.includes(t))) rows.push({ date: c.file.date, c, s, it });
    }
  }
  const days = byDay(rows);
  $("view").innerHTML = `<header class="dayhead"><div class="kicker">Search every day</div><h2>“${esc(q)}”</h2><p class="dsub">${rows.length} match${rows.length === 1 ? "" : "es"} on ${days.length} day${days.length === 1 ? "" : "s"}</p></header>
    ${labelFilter()}
    ${days.map(([date, rs]) => `<section class="dom"><h3><a href="#/day/${date}" class="dday">${esc(fmtDay(date, { weekday: "short", month: "short", day: "numeric" }))}</a><span class="dc">${rs.length}</span></h3>
      <div class="items">${rs.sort((a, b) => writerOrder(a.c.file.writer) - writerOrder(b.c.file.writer)).map((r) => itemHTML(r.it, { terms, context: `${writerBadge(r.c.file.writer)}<span class="dtag">${r.s.num ? `<b>${esc(r.s.num)}</b> ` : ""}${esc(r.s.title)}</span>` })).join("")}</div></section>`).join("") || `<p class="nothing big">Nothing matched every word. Try fewer words.</p>`}`;
  bindLabelFilter();
}

// ---- frame ------------------------------------------------------------------------------------------------------------
async function render() {
  readHash();
  document.querySelectorAll(".tabs a").forEach((a) => a.classList.toggle("on", a.dataset.view === state.view));
  document.querySelectorAll("[data-for]").forEach((el) => { el.hidden = el.dataset.for !== state.view; });
  window.scrollTo({ top: 0 });
  try {
    if (state.view === "day") await renderDay();
    else if (state.view === "topic") await renderTopic();
    else if (state.view === "ai") await renderAI();
    else await renderSearch();
  } catch (e) {
    setLoading(false);
    $("view").innerHTML = `<p class="err">Something went wrong reading the archive: ${esc(e.message || e)}. <a href="#" onclick="location.reload();return false">Try again</a>.</p>`;
  }
}

function buildChrome() {
  $("topicSel").innerHTML = DOMAINS.map(([n, t]) => `<option value="${n}">${n} · ${esc(t)}</option>`).join("");
  $("topicSel").addEventListener("change", (e) => go("topic", e.target.value));
  $("aiSel").innerHTML = Array.from(new Set(FILES.filter((f) => f.kind === "capture").map((f) => f.writer))).sort((a, b) => writerOrder(a) - writerOrder(b)).map((x) => `<option value="${esc(x)}">${esc(writerInfo(x).name)}</option>`).join("");
  $("aiSel").addEventListener("change", (e) => go("ai", e.target.value));
  $("dayInput").min = FIRST_DAY;
  $("dayInput").addEventListener("change", (e) => { if (e.target.value) go("day", e.target.value); });
  $("prevDay").addEventListener("click", () => { const d = state.day || LATEST; const p = DATES.find((x) => x < d); if (p) go("day", p); });
  $("nextDay").addEventListener("click", () => { const d = state.day || LATEST; const n = [...DATES].reverse().find((x) => x > d); if (n) go("day", n); });
  buildStrip();
  $("dayStrip").addEventListener("click", (e) => { const b = e.target.closest("button[data-day]"); if (b) go("day", b.dataset.day); });
  let t = null;
  $("searchForm").addEventListener("submit", (e) => { e.preventDefault(); go("search", $("searchIn").value.trim()); });
  $("searchIn").addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => { if (state.view === "search") go("search", $("searchIn").value.trim()); }, 450); });
  document.querySelectorAll(".tabs a").forEach((a) => a.addEventListener("click", (e) => {
    e.preventDefault();
    const v = a.dataset.view;
    go(v, v === "day" ? state.day : v === "topic" ? state.topic : v === "ai" ? state.ai : state.q);
  }));
  $("via").textContent = VIA;
}

async function boot() {
  setLoading(true, "Reading the watch repo on GitHub…");
  let listed;
  try { listed = await listFiles(); } catch (e) { listed = { files: [], via: "" }; }
  FILES = listed.files; VIA = listed.via;
  DATES = Array.from(new Set(FILES.map((f) => f.date))).sort().reverse();
  LATEST = DATES[0] || todayET();
  if (!FILES.length) {
    setLoading(false);
    $("view").innerHTML = `<p class="err">GitHub didn't answer, so the archive can't be listed right now. <a href="https://github.com/${REPO}" target="_blank" rel="noopener">The captures are on GitHub</a>. <a href="#" onclick="location.reload();return false">Try again</a>.</p>`;
    return;
  }
  buildChrome();
  window.addEventListener("hashchange", render);
  await render();
  // New captures land through the day (7:30, 9:00, afternoon): refresh the list every 10 minutes.
  setInterval(async () => {
    try {
      const l = await listFiles(true);
      if (l.files.length && l.files.length !== FILES.length) {
        FILES = l.files; VIA = l.via; DATES = Array.from(new Set(FILES.map((f) => f.date))).sort().reverse(); LATEST = DATES[0];
        buildStrip();
        if (state.view === "day") render();
      }
    } catch (e) {}
  }, 10 * 60 * 1000);
}
function buildStrip() {
  $("dayStrip").innerHTML = DATES.map((d) => {
    const n = new Set(FILES.filter((f) => f.date === d && f.kind === "capture").map((f) => f.writer)).size;
    return `<button type="button" data-day="${d}"><b>${esc(fmtDay(d, { month: "short", day: "numeric" }))}</b><span>${esc(fmtDay(d, { weekday: "short" }))} · ${n} AI${n === 1 ? "" : "s"}</span></button>`;
  }).join("");
}

if (typeof document !== "undefined" && document.getElementById("view")) boot();
