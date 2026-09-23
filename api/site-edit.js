// ============================================================
// SITE EDITOR ROUTE - Vercel serverless function.
// Lets the site admin change the site's own files from the page
// itself (hb-editor.js). Every save is a commit on the live branch,
// so Vercel redeploys it and git keeps every earlier version.
//
//   GET  ?file=games/index.html      -> { file, sha, content }
//   GET  ?history=games/index.html   -> { commits: [...] }
//   POST { action:"publish", file, sha, patches:[{start,end,expect,replace}], summary }
//   POST { action:"restore", file, commit }
//
// Who may use it: a signed-in Heartbeat account for which the
// database's is_admin() says true. Checked on every request with the
// caller's own session token; nothing here trusts the browser.
//
// Needs env var SITE_EDITOR_GITHUB_TOKEN in the Vercel project: a
// fine-grained token for this repo only, Contents: Read and write.
// Optional: SITE_EDITOR_REPO (owner/name), SITE_EDITOR_BRANCH (main).
// ============================================================

const SUPABASE_URL = "https://ygjpnvrwhkrowkrskftk.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Y-duV64ayMMEvVwMs5PWuw_6kvzbOrN";
const REPO = process.env.SITE_EDITOR_REPO || "JaronKBragg7337/heartbeat-observatory";
const BRANCH = process.env.SITE_EDITOR_BRANCH || "main";

/** Page files and stylesheets only. Code, database and workflow files stay out of reach. */
const BLOCKED_DIRS = ["api/", "supabase/", "tests/", "tools/", ".github/", ".git/", "node_modules/"];
const MAX_FILE_BYTES = 3_500_000;
const MAX_PATCHES = 200;

function cleanFile(raw) {
  const file = String(raw || "").replace(/^\/+/, "");
  if (!/^[A-Za-z0-9_\-./]+\.(html|css)$/.test(file)) return null;
  if (file.split("/").some(part => part === ".." || part === "." || part === "")) return null;
  if (BLOCKED_DIRS.some(dir => file.startsWith(dir))) return null;
  return file;
}

async function requireAdmin(req) {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return { error: 401, reason: "sign-in-required" };
  const headers = { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` };
  let user;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers });
    if (!r.ok) return { error: 401, reason: "session-not-valid" };
    user = await r.json();
  } catch {
    return { error: 503, reason: "accounts-unreachable" };
  }
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_admin`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: "{}"
    });
    if (!r.ok) return { error: 503, reason: "admin-check-failed" };
    if ((await r.json()) !== true) return { error: 403, reason: "admin-only" };
  } catch {
    return { error: 503, reason: "accounts-unreachable" };
  }
  return { user };
}

function github(path, options = {}) {
  return fetch(`https://api.github.com/repos/${REPO}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${process.env.SITE_EDITOR_GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "heartbeat-site-editor",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    }
  });
}

const encodePath = file => file.split("/").map(encodeURIComponent).join("/");

async function readFile(file, ref = BRANCH) {
  const meta = await github(`/contents/${encodePath(file)}?ref=${encodeURIComponent(ref)}`);
  if (meta.status === 404) return { error: 404 };
  if (!meta.ok) return { error: 502 };
  const info = await meta.json();
  if (Array.isArray(info) || info.type !== "file") return { error: 404 };
  if (info.size > MAX_FILE_BYTES) return { error: 413 };
  const blob = await github(`/git/blobs/${info.sha}`);
  if (!blob.ok) return { error: 502 };
  const data = await blob.json();
  return { sha: info.sha, content: Buffer.from(data.content, "base64").toString("utf8") };
}

async function writeFile(file, content, sha, message) {
  const r = await github(`/contents/${encodePath(file)}`, {
    method: "PUT",
    body: JSON.stringify({ message, content: Buffer.from(content, "utf8").toString("base64"), sha, branch: BRANCH })
  });
  if (r.status === 409 || r.status === 422) return { error: 409 };
  if (!r.ok) return { error: 502 };
  const out = await r.json();
  return { sha: out.content?.sha, commit: out.commit?.sha, url: out.commit?.html_url };
}

/** Same checks as applyPatches in hb-editor-source.js: every range must still read what the editor saw. */
function applyPatches(src, patches) {
  const sorted = patches.slice().sort((a, b) => b.start - a.start || b.end - a.end);
  let prevStart = Infinity;
  let out = src;
  for (const p of sorted) {
    if (!(Number.isInteger(p.start) && Number.isInteger(p.end) && p.start >= 0 && p.end >= p.start && p.end <= src.length)) {
      throw new Error("bad-range");
    }
    if (typeof p.expect !== "string" || typeof p.replace !== "string") throw new Error("bad-patch");
    if (p.end > prevStart) throw new Error("overlap");
    if (src.slice(p.start, p.end) !== p.expect) throw new Error("stale");
    out = out.slice(0, p.start) + p.replace + out.slice(p.end);
    prevStart = p.start;
  }
  return out;
}

const oneLine = (s, n) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!process.env.SITE_EDITOR_GITHUB_TOKEN) return res.status(503).json({ error: "not-configured" });

  const auth = await requireAdmin(req);
  if (auth.error) return res.status(auth.error).json({ error: auth.reason });

  if (req.method === "GET") {
    if (req.query.history) {
      const file = cleanFile(req.query.history);
      if (!file) return res.status(400).json({ error: "bad-file" });
      const r = await github(`/commits?path=${encodeURIComponent(file)}&sha=${encodeURIComponent(BRANCH)}&per_page=15`);
      if (!r.ok) return res.status(502).json({ error: "github-error" });
      const commits = (await r.json()).map(c => ({
        sha: c.sha,
        message: oneLine(c.commit?.message, 200),
        date: c.commit?.committer?.date || c.commit?.author?.date
      }));
      return res.status(200).json({ file, commits });
    }
    const file = cleanFile(req.query.file);
    if (!file) return res.status(400).json({ error: "bad-file" });
    const got = await readFile(file);
    if (got.error === 404) return res.status(404).json({ error: "no-such-file" });
    if (got.error === 413) return res.status(413).json({ error: "file-too-large" });
    if (got.error) return res.status(502).json({ error: "github-error" });
    return res.status(200).json({ file, sha: got.sha, content: got.content });
  }

  if (req.method !== "POST") return res.status(405).json({ error: "GET or POST" });
  const body = req.body || {};
  const file = cleanFile(body.file);
  if (!file) return res.status(400).json({ error: "bad-file" });

  if (body.action === "publish") {
    const patches = Array.isArray(body.patches) ? body.patches : [];
    if (!patches.length || patches.length > MAX_PATCHES) return res.status(400).json({ error: "no-changes" });
    const current = await readFile(file);
    if (current.error) return res.status(502).json({ error: "github-error" });
    if (body.sha && body.sha !== current.sha) return res.status(409).json({ error: "file-changed" });
    let next;
    try {
      next = applyPatches(current.content, patches);
    } catch (err) {
      return res.status(409).json({ error: err.message === "stale" ? "file-changed" : err.message });
    }
    if (next === current.content) return res.status(400).json({ error: "no-changes" });
    const summary = oneLine(body.summary, 120) || `${patches.length} change${patches.length === 1 ? "" : "s"}`;
    const wrote = await writeFile(file, next, current.sha, `Site edit: ${file} - ${summary}\n\nMade in the site editor by the site admin.`);
    if (wrote.error === 409) return res.status(409).json({ error: "file-changed" });
    if (wrote.error) return res.status(502).json({ error: "github-error" });
    return res.status(200).json({ ok: true, ...wrote });
  }

  if (body.action === "restore") {
    const commit = String(body.commit || "");
    if (!/^[0-9a-f]{7,40}$/.test(commit)) return res.status(400).json({ error: "bad-commit" });
    const old = await readFile(file, commit);
    if (old.error) return res.status(404).json({ error: "no-such-version" });
    const current = await readFile(file);
    if (current.error) return res.status(502).json({ error: "github-error" });
    if (old.content === current.content) return res.status(400).json({ error: "no-changes" });
    const wrote = await writeFile(file, old.content, current.sha,
      `Site edit: ${file} - restore the version from ${commit.slice(0, 7)}\n\nMade in the site editor by the site admin.`);
    if (wrote.error === 409) return res.status(409).json({ error: "file-changed" });
    if (wrote.error) return res.status(502).json({ error: "github-error" });
    return res.status(200).json({ ok: true, ...wrote });
  }

  return res.status(400).json({ error: "unknown-action" });
}
