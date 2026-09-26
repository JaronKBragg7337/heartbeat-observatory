// stamp-shared.mjs - every page gets the site-wide pieces, automatically (2026-09-26, Claude Code).
//
// Jaron: things that belong on every page kept missing from new pages (the phone, the editor), because whoever built the page
// had to remember. Now nobody has to: Vercel runs this before every deploy (vercel.json "buildCommand"), and it adds whatever a
// page is missing. Run it locally too: `node tools/stamp-shared.mjs` (add --check to only report).
//
// Stamped into every .html page unless the page opts out with a marker comment:
//   analytics  - Vercel Web Analytics                         opt out: <!-- hb:no-analytics -->
//   editor     - /hb-editor.js (admin Edit button + phone fixes) opt out: <!-- hb:no-editor -->
//   phone      - /bubble.js (the messages phone)               opt out: <!-- hb:no-phone -->  (pages with their own phone,
//                e.g. Ashgrove's shell phone, are skipped automatically)
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const CHECK = process.argv.includes("--check");
const SKIP_DIRS = new Set(["node_modules", ".git", ".vercel", "tests", "supabase", "docs", "tools", "api"]);

const PIECES = [
  { id: "analytics", has: /_vercel\/insights\/script\.js/, optOut: "hb:no-analytics", where: "head",
    tag: '<script>window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments)};</script>\n<script defer src="/_vercel/insights/script.js"></script>\n' },
  { id: "editor", has: /\/hb-editor\.js/, optOut: "hb:no-editor", where: "body", tag: '<script defer src="/hb-editor.js"></script>\n' },
  { id: "phone", has: /\/bubble\.js/, optOut: "hb:no-phone", where: "body", tag: '<script defer src="/bubble.js"></script>\n' },
];

function* pages(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      // built game bundles (assets/, dist/, vendor/) are someone else's output - leave them alone
      if (["assets", "dist", "vendor", "lib"].includes(name)) continue;
      yield* pages(p);
    } else if (name.endsWith(".html")) yield p;
  }
}

let changed = 0, missing = [];
for (const file of pages(root)) {
  let html = readFileSync(file, "utf8");
  if (!/<\/body>/i.test(html) || !/<\/head>/i.test(html)) continue;   // fragments / partial templates
  const before = html;
  for (const piece of PIECES) {
    if (piece.has.test(html) || html.includes(piece.optOut)) continue;
    missing.push(`${relative(root, file).split(sep).join("/")}: ${piece.id}`);
    if (piece.where === "head") html = html.replace(/<\/head>/i, piece.tag + "</head>");
    else { const i = html.search(/<\/body>(?![\s\S]*<\/body>)/i); html = html.slice(0, i) + piece.tag + html.slice(i); }
  }
  if (html !== before && !CHECK) { writeFileSync(file, html); changed++; }
}
console.log(`${CHECK ? "missing" : "stamped"}: ${missing.length} piece(s)${CHECK ? "" : ` across ${changed} page(s)`}`);
for (const m of missing) console.log("  " + m);
if (CHECK && missing.length) process.exitCode = 1;
