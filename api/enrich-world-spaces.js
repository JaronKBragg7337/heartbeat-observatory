const SUPABASE_URL = "https://ygjpnvrwhkrowkrskftk.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Y-duV64ayMMEvVwMs5PWuw_6kvzbOrN";

export default async function handler(request, response) {
  if (request.method !== "GET" && request.method !== "POST") {
    response.setHeader("Allow", "GET, POST");
    return response.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const cronSecret = process.env.CRON_SECRET;
  const cronHeader = request.headers["x-vercel-cron-schedule"];
  if (cronSecret && !cronHeader && request.headers.authorization !== `Bearer ${cronSecret}`) {
    return response.status(401).json({ ok: false, error: "Not authorized" });
  }

  const enrichSecret = process.env.WORLD_SPACE_ENRICH_SECRET;
  if (!enrichSecret) {
    return response.status(503).json({ ok: false, error: "WORLD_SPACE_ENRICH_SECRET is not configured" });
  }

  try {
    const spaces = await selectSpacesForEnrichment();
    const results = [];

    for (const space of spaces) {
      const repo = parseGitHubRepo(space.github_url);
      if (!repo) {
        results.push(await saveMetadata(space.world, space.plot, {}, "Invalid GitHub repository URL"));
        continue;
      }

      const metadata = await fetchRepoMetadata(repo);
      results.push(await saveMetadata(space.world, space.plot, metadata, metadata.error || null));
    }

    return response.status(200).json({
      ok: true,
      checked: spaces.length,
      updated: results.filter((r) => r.ok).length,
      results
    });
  } catch (error) {
    return response.status(500).json({ ok: false, error: error.message || "Enrichment failed" });
  }
}

async function selectSpacesForEnrichment() {
  const staleBefore = new Date(Date.now() - 55 * 60 * 1000).toISOString();
  const query = new URLSearchParams({
    select: "world,plot,github_url,project_name,repo_fetched_at",
    github_url: "not.is.null",
    order: "repo_fetched_at.asc.nullsfirst",
    limit: "12"
  });
  const result = await supabaseFetch(`/rest/v1/world_spaces?${query}`);
  const rows = Array.isArray(result) ? result : [];
  return rows.filter((row) => !row.repo_fetched_at || row.repo_fetched_at < staleBefore);
}

function parseGitHubRepo(url) {
  try {
    const parsed = new URL(url);
    if (!/(^|\.)github\.com$/i.test(parsed.hostname)) return null;
    const [owner, repo] = parsed.pathname.split("/").filter(Boolean);
    if (!owner || !repo) return null;
    return { owner, repo: repo.replace(/\.git$/i, "") };
  } catch {
    return null;
  }
}

async function fetchRepoMetadata(repo) {
  const headers = {
    "Accept": "application/vnd.github+json",
    "User-Agent": "heartbeat-observatory-enrichment"
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  const url = `https://api.github.com/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    return {
      owner: repo.owner,
      name: repo.repo,
      html_url: `https://github.com/${repo.owner}/${repo.repo}`,
      error: `GitHub returned ${res.status}`
    };
  }

  const data = await res.json();
  return {
    owner: data.owner?.login || repo.owner,
    name: data.name || repo.repo,
    full_name: data.full_name || `${repo.owner}/${repo.repo}`,
    description: data.description || "",
    homepage: data.homepage || "",
    html_url: data.html_url || `https://github.com/${repo.owner}/${repo.repo}`,
    language: data.language || "",
    topics: Array.isArray(data.topics) ? data.topics.slice(0, 12) : [],
    stars: Number.isFinite(data.stargazers_count) ? data.stargazers_count : 0,
    forks: Number.isFinite(data.forks_count) ? data.forks_count : 0,
    pushed_at: data.pushed_at || "",
    updated_at: data.updated_at || "",
    license: data.license?.spdx_id || ""
  };
}

async function saveMetadata(world, plot, metadata, error) {
  try {
    await supabaseFetch("/rest/v1/rpc/set_world_space_repo_metadata", {
      method: "POST",
      body: JSON.stringify({
        p_secret: process.env.WORLD_SPACE_ENRICH_SECRET,
        p_world: world || "town",
        p_plot: plot,
        p_metadata: metadata || {},
        p_error: error || null
      })
    });
    return { ok: true, plot, repo: metadata?.full_name || metadata?.name || null, error: error || null };
  } catch (writeError) {
    return { ok: false, plot, error: writeError.message || "Could not save metadata" };
  }
}

async function supabaseFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      "apikey": SUPABASE_PUBLISHABLE_KEY,
      "Authorization": `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Supabase returned ${res.status}`);
  }

  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}
