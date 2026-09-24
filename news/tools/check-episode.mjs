// Checks a Heartbeat News episode before it ships. Usage: node news/tools/check-episode.mjs news/episodes/2026-09-24.json
// Exit code 1 = the page would break or read wrong; fix and run again.
import fs from "fs";

const file = process.argv[2];
if (!file) { console.error("usage: node news/tools/check-episode.mjs <episode.json>"); process.exit(2); }
const errs = [], warns = [];
let ep;
try { ep = JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { console.error("not valid JSON: " + e.message); process.exit(1); }

if (!/^\d{4}-\d{2}-\d{2}$/.test(ep.date || "")) errs.push("date must be YYYY-MM-DD");
if (!file.endsWith((ep.date || "?") + ".json")) errs.push("file name must match date");
if (!Array.isArray(ep.ticker) || ep.ticker.length < 5) errs.push("ticker needs at least 5 items");
if (!Array.isArray(ep.sources) || !ep.sources.length) errs.push("sources (the capture files read) are required");
const segs = ep.segments || [];
if (segs.length < 5) errs.push("at least 5 segments (open, 3+ stories, close)");
if (!segs.length || segs[0].kind !== "open") errs.push("first segment must be kind 'open'");
if (!segs.length || segs[segs.length - 1].kind !== "close") errs.push("last segment must be kind 'close'");
if (!segs.some((s) => s.kind === "wire")) warns.push("no 'wire' segment: the live Perplexity headlines will not be read on air");
const kinds = new Set(["open", "story", "breaking", "weather", "sports", "wire", "close"]);
const ids = new Set();
let words = 0;
segs.forEach((s, i) => {
  const at = `segment ${i} (${s.id || "no id"})`;
  if (!s.id || ids.has(s.id)) errs.push(at + ": id missing or repeated"); ids.add(s.id);
  if (!kinds.has(s.kind)) errs.push(at + ": kind must be one of " + [...kinds].join(", "));
  if (!s.strap) errs.push(at + ": strap (lower-third headline) missing");
  if (s.strap && s.strap.length > 70) warns.push(at + ": strap over 70 characters will shrink on screen");
  if (!s.headline) errs.push(at + ": headline missing");
  if (!s.graphic || !s.graphic.title) errs.push(at + ": graphic.title missing");
  if (["story", "breaking", "weather", "sports"].includes(s.kind)) {
    if (!Array.isArray(s.sources) || !s.sources.length) errs.push(at + ": a story needs sources [{name,url}]");
    (s.sources || []).forEach((x) => { if (!/^https?:\/\//.test(x.url || "")) errs.push(at + ": source url must be http(s): " + x.url); });
    if (!["observed", "claim", "mixed"].includes(s.status)) errs.push(at + ": status must be observed, claim or mixed");
  }
  if (s.kind !== "wire") {
    if (!Array.isArray(s.lines) || !s.lines.length) errs.push(at + ": lines missing");
    (s.lines || []).forEach((l, j) => {
      if (l.who !== "vex" && l.who !== "joe") errs.push(`${at} line ${j}: who must be vex or joe`);
      const n = String(l.text || "").trim().split(/\s+/).filter(Boolean).length;
      if (!n) errs.push(`${at} line ${j}: empty text`);
      if (n > 70) warns.push(`${at} line ${j}: ${n} words; split lines over ~60 words`);
      if (/\$\d|\d%|\d{2,}/.test(l.text || "")) warns.push(`${at} line ${j}: digits in a spoken line; spell numbers the way they should be read`);
      if (l.shot && !["wide", "two", "vex", "joe", "vexX", "joeX", "wall", "crane"].includes(l.shot)) errs.push(`${at} line ${j}: unknown shot ${l.shot}`);
      words += n;
    });
  }
});
const minutes = words / (2.55 * 60);
console.log(`${file}: ${segs.length} segments, ${words} spoken words, about ${minutes.toFixed(1)} min before transitions and wire`);
warns.forEach((w) => console.log("warn: " + w));
errs.forEach((e) => console.log("ERROR: " + e));
process.exit(errs.length ? 1 : 0);
