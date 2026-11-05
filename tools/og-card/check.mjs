// check.mjs - does the share card still match the home page? (2026-11-05, Claude Code)
//
// Jaron: the share card must ALWAYS match the site. The card is drawn from tools/og-card/card.json; this compares that list
// with index.html and prints a WARNING for each drift. It never fails a deploy (warnings only).
// Runs on every deploy from tools/stamp-shared.mjs; run it alone with `node tools/og-card/check.mjs`.
//
// Checks:
//   1. index.html og:image + twitter:image point at card.json "out", and that file exists.
//   2. Every name on the card is still on the home page, and its card (data-hb-card / directory key) is not hidden.
//   3. Every world card and studio link on the home page is on the card, or listed in card.json "notOnCard".
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export function checkCard(root = join(fileURLToPath(import.meta.url), "..", "..", "..")) {
  const warn = [];
  let card, html;
  try { card = JSON.parse(readFileSync(join(root, "tools", "og-card", "card.json"), "utf8")); }
  catch (e) { return ["tools/og-card/card.json unreadable: " + e.message]; }
  try { html = readFileSync(join(root, "index.html"), "utf8"); }
  catch (e) { return ["index.html unreadable: " + e.message]; }

  // 1. meta tags
  for (const [attr, name] of [["property", "og:image"], ["name", "twitter:image"]]) {
    const m = html.match(new RegExp(`<meta\\s+${attr}="${name}"\\s+content="([^"]*)"`, "i"));
    if (!m) warn.push(`index.html has no ${name} tag`);
    else if (!m[1].endsWith("/" + card.out)) warn.push(`index.html ${name} is ${m[1]}, but the card is ${card.out}`);
  }
  if (!existsSync(join(root, card.out))) warn.push(`card image ${card.out} is missing - run: python tools/og-card/render.py`);

  // 2. card -> page
  const text = html.replace(/<[^>]+>/g, " ").replace(/&middot;/g, "·").replace(/\s+/g, " ").toLowerCase();
  let hidden = [];
  try { hidden = JSON.parse((html.match(/id="hb-hidden-cards">([\s\S]*?)<\/script>/) || [])[1] || "[]").map((c) => (typeof c === "string" ? c : c.key)); } catch {}
  const items = [
    ...(card.classics.check === false ? [] : [{ name: card.classics.label }]),
    ...card.classics.worlds, ...card.features, ...card.also.items,
  ];
  for (const it of items) {
    const words = it.match || it.name;
    if (it.check !== false && !text.includes(words.toLowerCase())) warn.push(`card shows "${it.name}" but the home page no longer says "${words}"`);
    if (it.card) {
      const onPage = html.includes(`data-hb-card="${it.card}"`) || new RegExp(`key:\\s*"${it.card}"`).test(html);
      if (!onPage) warn.push(`card shows "${it.name}" but the home page has no "${it.card}" card`);
      if (hidden.includes(it.card)) warn.push(`card shows "${it.name}" but "${it.card}" is hidden on the home page`);
    }
  }

  // 3. page -> card (world cards + studio links)
  const onCard = new Set(items.map((i) => i.name.toLowerCase()));
  const skip = new Set(Object.keys(card.notOnCard || {}).filter((k) => !k.startsWith("_")).map((k) => k.toLowerCase()));
  const re = /<a class="(world-card|studio-link)"[^>]*data-hb-card="([^"]+)"[^>]*>[\s\S]*?<h3>([\s\S]*?)<\/h3>/g;
  for (const m of html.matchAll(re)) {
    if (hidden.includes(m[2])) continue;
    const name = m[3].replace(/<[^>]+>/g, "").replace(/&middot;/g, "·").trim();
    const lower = name.toLowerCase();
    const covered = onCard.has(lower) || skip.has(lower) || [...onCard].some((n) => lower.includes(n));
    if (!covered) warn.push(`home page has "${name}" (${m[1]}) but the card doesn't - add it to tools/og-card/card.json or to "notOnCard"`);
  }
  return warn;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const w = checkCard();
  if (!w.length) console.log("share card: matches the home page");
  else { console.log(`share card WARNING: ${w.length} drift(s) - fix card.json, then python tools/og-card/render.py (new "out" filename so X refetches)`); for (const x of w) console.log("  " + x); }
}
