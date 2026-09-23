// Phone-width check of the site editor, end to end, with nothing real touched.
//
//   NODE_PATH=$(npm root -g) node tests/editor-browser.mjs [outDir]
//
// Serves this checkout locally. /api/site-edit is the real handler from
// api/site-edit.js, with fetch() swapped for a fake Supabase (says "admin") and
// a fake GitHub (an in-memory copy of the repo). supabase-js is swapped for a
// stub that reports a signed-in session. Then it drives Chromium at 390x844:
// edits words, a color and a JS-built line on the home page, publishes, and
// checks that the file changed in exactly those places and nowhere else.
// It also parses every page in the repo and compares with the browser's own parser.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
// require() honours NODE_PATH, so a globally installed playwright works.
const { chromium } = createRequire(import.meta.url)("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.argv[2] || path.join(ROOT, "tests", "editor-shots");
fs.mkdirSync(OUT, { recursive: true });

/* ---------- fake GitHub + Supabase behind the real handler ---------- */
const repo = new Map(); // file -> content
const commits = [];
const sha = s => crypto.createHash("sha1").update(s).digest("hex");
const readRepo = file => {
  if (!repo.has(file)) {
    const p = path.join(ROOT, file);
    if (!fs.existsSync(p)) return null;
    repo.set(file, fs.readFileSync(p, "utf8"));
  }
  return repo.get(file);
};
const blobs = new Map();
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
globalThis.fetch = async (url, opts = {}) => {
  const u = new URL(url);
  if (u.hostname.endsWith("supabase.co")) {
    if (u.pathname === "/auth/v1/user") return json(200, { id: "admin-id", email: "admin@example.com" });
    if (u.pathname === "/rest/v1/rpc/is_admin") return json(200, true);
  }
  if (u.hostname === "api.github.com") {
    const m = /^\/repos\/[^/]+\/[^/]+(\/.*)$/.exec(u.pathname);
    const p = m[1];
    if (p.startsWith("/contents/")) {
      const file = decodeURIComponent(p.slice(10));
      if ((opts.method || "GET") === "PUT") {
        const body = JSON.parse(opts.body);
        const cur = readRepo(file);
        if (sha(cur) !== body.sha) return json(409, {});
        const next = Buffer.from(body.content, "base64").toString("utf8");
        repo.set(file, next);
        const c = sha(next + Date.now());
        commits.unshift({ sha: c, file, message: body.message, content: next });
        return json(200, { content: { sha: sha(next) }, commit: { sha: c } });
      }
      const ref = u.searchParams.get("ref");
      const old = commits.find(c => c.sha === ref && c.file === file);
      const content = old ? old.content : readRepo(file);
      if (content == null) return json(404, {});
      blobs.set(sha(content), content);
      return json(200, { type: "file", sha: sha(content), size: Buffer.byteLength(content) });
    }
    if (p.startsWith("/git/blobs/")) {
      const content = blobs.get(p.slice(11));
      return json(200, { content: Buffer.from(content, "utf8").toString("base64") });
    }
    if (p === "/commits") {
      const file = u.searchParams.get("path");
      return json(200, commits.filter(c => c.file === file).map(c => ({ sha: c.sha, commit: { message: c.message, committer: { date: new Date().toISOString() } } })));
    }
  }
  return json(404, {});
};
process.env.SITE_EDITOR_GITHUB_TOKEN = "test-only";
const { default: handler } = await import(path.join(ROOT, "api", "site-edit.js"));

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml" };
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname === "/api/site-edit") {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const vreq = { method: req.method, headers: req.headers, query: Object.fromEntries(u.searchParams), body: raw ? JSON.parse(raw) : undefined };
    const vres = {
      statusCode: 200,
      setHeader: (k, v) => res.setHeader(k, v),
      status(c) { this.statusCode = c; return this; },
      json(b) { res.writeHead(this.statusCode, { "Content-Type": "application/json" }); res.end(JSON.stringify(b)); return this; }
    };
    return handler(vreq, vres);
  }
  let file = decodeURIComponent(u.pathname);
  if (file.endsWith("/")) file += "index.html";
  let p = path.join(ROOT, file);
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, "index.html");
  if (!fs.existsSync(p)) { res.writeHead(404); return res.end("nf"); }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, r));
const BASE = `http://127.0.0.1:${server.address().port}`;

/* ---------- browser ---------- */
const SUPABASE_STUB = `
export function createClient() {
  const session = { access_token: "test-token", user: { id: "admin-id" } };
  const empty = { data: [], error: null };
  const q = () => { const o = { select: () => o, eq: () => o, order: () => o, limit: () => o, in: () => o, maybeSingle: async () => ({ data: null }),
    then: (r) => Promise.resolve(empty).then(r) }; return o; };
  return { auth: { getSession: async () => ({ data: { session } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
    rpc: async (name) => ({ data: name === "is_admin" ? true : null }), from: q,
    channel: () => ({ on() { return this; }, subscribe() { return this; }, track() {}, send() {} }), removeChannel() {} };
}`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.route(/esm\.sh\/@supabase|jsdelivr\.net\/npm\/@supabase/, r => r.fulfill({ contentType: "text/javascript", body: SUPABASE_STUB }));
await ctx.addInitScript(() => localStorage.setItem("sb-ygjpnvrwhkrowkrskftk-auth-token", "{}"));
const page = await ctx.newPage();
page.on("pageerror", e => console.log("page error:", e.message));
page.on("dialog", d => d.accept());

const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " - " + detail : ""}`); };
const shadow = sel => page.locator(`[data-hb-editor] >> css=${sel}`);

await page.goto(BASE + "/", { waitUntil: "load" });
await shadow("#pill").waitFor({ timeout: 10000 });
check("Edit button shows for the admin", await shadow("#pill").isVisible());
await page.screenshot({ path: path.join(OUT, "1-home-edit-button.png") });

await shadow("#pill").tap();
await shadow("#bar.on").waitFor();
check("edit bar opens", true);

// Words: the hero heading's first piece.
await page.locator("#hero-title").tap({ position: { x: 20, y: 20 } });
await shadow(".sheet.on textarea").first().waitFor();
const first = await shadow(".sheet.on textarea").first().inputValue();
check("heading words load into the box", first === "Make room for", JSON.stringify(first));
await shadow(".sheet.on textarea").first().fill("Make space for");
check("page shows the new words at once", (await page.locator("#hero-title").innerText()).startsWith("Make space for"));
await page.screenshot({ path: path.join(OUT, "2-editing-heading.png") });

// Look: background of the hero section via "Bigger area".
await shadow("#up").tap();
await shadow("#up").tap();
const what = await shadow(".what").innerText();
await shadow("#bg").evaluate(el => { el.value = "#ffeecc"; el.dispatchEvent(new Event("input", { bubbles: true })); });
await page.screenshot({ path: path.join(OUT, "3-block-look.png") });
check("bigger area reaches the hero block", /Section|Block/.test(what), what);

// A line the page builds with its own script (directory descriptions), if present.
const dirItem = page.locator(".surface-summary").first();
let looseOk = null;
if (await dirItem.count()) {
  await shadow("#close").tap();
  const before = await dirItem.innerText();
  await dirItem.tap();
  await shadow(".sheet.on textarea").first().waitFor();
  const disabled = await shadow(".sheet.on textarea").first().isDisabled();
  if (!disabled) {
    await shadow(".sheet.on textarea").first().fill(before + " (edited)");
    looseOk = true;
  } else {
    looseOk = false;
    console.log("note: directory line not editable:", await shadow(".sheet.on .small").first().innerText());
  }
  await page.screenshot({ path: path.join(OUT, "4-script-built-line.png") });
}

// Page panel.
await shadow("#bPage").tap();
await shadow(".sheet.on input[data-c]").first().waitFor({ timeout: 10000 });
const colorCount = await shadow(".sheet.on input[data-c]").count();
check("page colors listed", colorCount > 0, `${colorCount} colors`);
await shadow(".sheet.on input[data-c]").first().evaluate(el => { el.value = "#fafafa"; el.dispatchEvent(new Event("input", { bubbles: true })); });
await page.screenshot({ path: path.join(OUT, "5-page-panel.png"), fullPage: false });

// Changes list.
await shadow("#bChanges").tap();
const items = await shadow(".sheet.on .item").count();
await page.screenshot({ path: path.join(OUT, "6-changes.png") });
check("changes list counts the edits", items >= 3, `${items} items`);

// Publish.
const original = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
await shadow("#bPublish").tap();
await shadow(".toast.on").waitFor();
const toastText = await shadow(".toast.on").innerText();
check("publish reports saved", /Saved/.test(toastText), toastText);
await page.screenshot({ path: path.join(OUT, "7-published.png") });
const saved = repo.get("index.html");
let expected = original.replace("Make room for <em>", "Make space for <em>");
expected = expected.replace(/<section class="home-hero"/, `<section style="background: #ffeecc" class="home-hero"`);
const lineDiff = (a, b) => { const A = a.split("\n"), B = b.split("\n"); const out = []; for (let i = 0; i < Math.max(A.length, B.length); i++) if (A[i] !== B[i]) out.push(i + 1); return out; };
const changed = lineDiff(original, saved);
for (const n of changed) console.log(`  saved line ${n}: ${saved.split("\n")[n - 1].trim().slice(0, 150)}`);
if (looseOk) {
  // The directory edit is the only other change; take it out of the comparison.
  const rest = lineDiff(expected, saved);
  check("only the three intended spots changed", rest.length === 1 && saved.includes("(edited)"), `lines ${changed.join(",")}`);
} else {
  check("only the intended spots changed", saved === expected, `lines ${changed.join(",")}`);
}
const css = fs.readFileSync(path.join(ROOT, "observatory.css"), "utf8");
check("shared color saved to the stylesheet, one spot only", repo.get("observatory.css") === css.replace("--paper: #f4f1ea;", "--paper: #fafafa;"));
check("commit message names the file", /^Site edit: index\.html - /.test(commits.find(c => c.file === "index.html")?.message || ""), commits.find(c => c.file === "index.html")?.message.split("\n")[0]);

// Visitors: no session -> nothing loads.
const visitor = await browser.newContext({ viewport: { width: 390, height: 844 } });
const vp = await visitor.newPage();
const loaded = [];
vp.on("request", r => loaded.push(r.url()));
await vp.goto(BASE + "/", { waitUntil: "load" });
await vp.waitForTimeout(800);
check("signed-out visitors never load the editor", !loaded.some(u => u.includes("hb-editor-app")));
await visitor.close();

/* ---------- parser vs the browser's parser, every page ---------- */
const files = fs.readdirSync(ROOT, { recursive: true }).filter(f => f.endsWith(".html") && !f.includes("node_modules") && !f.startsWith("tests"));
await page.goto(BASE + "/tests/editor-shots/../../hb-editor.js");
const report = await page.evaluate(async ({ files, base }) => {
  const mod = await import(base + "/hb-editor-source.js");
  const out = [];
  for (const f of files) {
    const src = await (await fetch(base + "/" + f)).text();
    const index = mod.parseSource(src);
    const doc = new DOMParser().parseFromString(src, "text/html");
    const implied = new Set(["html", "head", "body", "tbody"]);
    const mine = index.elements.map(e => e.tag).filter(t => !implied.has(t));
    // DOMParser runs with scripting off, so it reads <noscript> as markup; a live page reads it as text.
    const liveLike = Array.from(doc.querySelectorAll("*")).filter(e => !e.parentElement || !e.parentElement.closest("noscript"));
    const theirs = liveLike.map(e => e.tagName.toLowerCase()).filter(t => !implied.has(t) && !t.includes(":"));
    // Same elements in the same order, and each element shows the same words.
    let firstBad = -1;
    for (let i = 0; i < Math.max(mine.length, theirs.length); i++) if (mine[i] !== theirs[i]) { firstBad = i; break; }
    let wordsBad = 0;
    const samples = [];
    if (firstBad < 0) {
      const els = index.elements.filter(e => !implied.has(e.tag));
      const live = liveLike.filter(e => !implied.has(e.tagName.toLowerCase()));
      els.forEach((e, i) => {
        if (["script", "style", "noscript", "template", "textarea", "title"].includes(e.tag)) return;
        const a = mod.norm(mod.sourceText(e)), b = mod.norm(mod.liveText(live[i]));
        if (a !== b) { wordsBad++; if (samples.length < 2) samples.push([e.tag, a.slice(0, 120), b.slice(0, 120)]); }
      });
    }
    out.push({ f, mine: mine.length, theirs: theirs.length, firstBad, near: firstBad >= 0 ? [mine.slice(firstBad - 2, firstBad + 3), theirs.slice(firstBad - 2, firstBad + 3)] : null, wordsBad, samples });
  }
  return out;
}, { files, base: BASE });
const bad = report.filter(r => r.firstBad >= 0 || r.wordsBad);
for (const r of bad) console.log("  parser differs:", JSON.stringify(r));
check(`parser matches the browser on every page (${report.length} pages)`, bad.length === 0, `${bad.length} differ`);

await browser.close();
server.close();
const failed = results.filter(r => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed. Screenshots: ${OUT}`);
process.exit(failed ? 1 : 0);
