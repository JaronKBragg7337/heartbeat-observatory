// v3 — rebind on correct Vercel account
// /api/news.js — secret-safe live news via Perplexity (Sonar).
// The PERPLEXITY_API_KEY lives only in Vercel env and is read here on the server.
// The browser never sees the key — it only receives a finished, safe list of headlines.
export default async function handler(req, res) {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) {
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ items: [], note: "not_configured" });
    return;
  }
  try {
    const r = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + key,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "sonar",
        temperature: 0.1,
        max_tokens: 600,
        search_recency_filter: "day",
        messages: [
          {
            role: "system",
            content: "You return current news headlines as STRICT JSON only. No prose, no markdown, no code fences. Output a JSON array of up to 6 objects, each exactly {\"title\": string, \"source\": string}. Titles are real, current headlines. Source is the outlet name only."
          },
          {
            role: "user",
            content: "The most significant world and technology news headlines from the last 24 hours."
          }
        ]
      })
    });

    if (!r.ok) {
      res.setHeader("Cache-Control", "no-store");
      res.status(200).json({ items: [], note: "upstream_" + r.status });
      return;
    }

    const data = await r.json();
    const content = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "[]";
    const citations = Array.isArray(data && data.citations) ? data.citations : [];

    let parsed = [];
    try {
      const cleaned = String(content).replace(/```json|```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      parsed = [];
    }
    if (!Array.isArray(parsed)) parsed = [];

    const items = parsed.slice(0, 6).map((x, i) => ({
      title: String((x && x.title) || "").slice(0, 200),
      source: String((x && x.source) || "").slice(0, 80),
      url: typeof citations[i] === "string" ? citations[i] : ""
    })).filter(x => x.title);

    // CDN-cache for 15 min so we don't spend credits on every page view
    res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=1800");
    res.status(200).json({ items });
  } catch (e) {
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ items: [], note: "error" });
  }
}
