// Builds sitemap.xml from the folders that have an index.html. Public pages only.
// Run from the repo root:  node tools/gen-sitemap.mjs
// Add a folder to SKIP to keep it out. Pages with a noindex tag are skipped on their own.
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const SITE = "https://heartbeatobservatory.com";

// Folders (and everything under them) that stay out of the sitemap.
const SKIP = [
  "admin",                       // behind login
  "pam",                         // paused on purpose
  "live-systems/flies",          // fruit fly pages, paused
  "school",                      // fruit fly school pages
  "worlds-lab",                  // paused
  "lab/hidden",                  // hidden test pages
  "preview",                     // also Disallow in robots.txt
  "work/sample",                 // noindex samples
  "qwen",                        // hidden from the home directory
  "guides/voice-ai-team",        // not announced yet
  "live-systems/revenue",        // paused or hidden
  "live-systems/paper",
  "live-systems/crypto",
  "live-systems/habitat",
  "live-systems/trades",
  "games/syl-test",              // test copy
  "engine/hub",
  "powermap",                    // redirects to its own subdomain
  "live-systems/crew/trades",    // trading is paused
  "live-systems/crew/retired",
  "lab/tesseract/inside",        // sub-builds, the main page is listed
  "lab/arena/a", "lab/arena/b",  // copies of the arena for each builder
  "lab/seam-room/a", "lab/seam-room/b", "lab/seam-room/c", "lab/seam-room/d", "lab/seam-room/e",
  "lab/seam-room/f", "lab/seam-room/g", "lab/seam-room/h", "lab/seam-room/i", "lab/seam-room/j",
  "world2/gate", "world3/gate",  // sign-in gates
];
const SKIP_DIRS = new Set([".git", "node_modules", "tests", "tools", "supabase", "sql", "api", "docs"]);

const NOINDEX = /<meta[^>]+name=["']robots["'][^>]*noindex|<meta[^>]+noindex[^>]*name=["']robots["']/i;

const urls = [];
function walk(rel) {
  const dir = join(".", rel);
  if (existsSync(join(dir, "index.html"))) {
    const html = readFileSync(join(dir, "index.html"), "utf8");
    if (!NOINDEX.test(html)) urls.push(rel);
  }
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name) || name.startsWith(".")) continue;
    const next = rel ? `${rel}/${name}` : name;
    if (SKIP.some((s) => next === s || next.startsWith(s + "/"))) continue;
    if (statSync(join(".", next)).isDirectory()) walk(next);
  }
}
walk("");

// Each TV channel has its own address (see the rewrites in vercel.json).
const { channels } = JSON.parse(readFileSync("tv/channels.json", "utf8"));
for (const c of channels) urls.push(`tv/${c.id}`);

const body = [...new Set(urls)].sort().map((u) => `  <url><loc>${SITE}/${u ? u + "/" : ""}</loc></url>`).join("\n");
writeFileSync("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`);
console.log(`sitemap.xml: ${new Set(urls).size} pages`);
