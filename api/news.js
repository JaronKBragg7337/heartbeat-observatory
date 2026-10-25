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


    let parsed = [];
    try {
      const cleaned = String(content).replace(/```json|```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      parsed = [];
    }
    if (!Array.isArray(parsed)) parsed = [];

    // Sonar's citations are mostly front pages and wire listings, not the article itself, so pairing them with headlines
    // put wrong stories under links (10/25). Each headline now links to a news search for that exact headline + outlet.
    const items = parsed.slice(0, 6).map((x) => {
      const title = String((x && x.title) || "").slice(0, 200);
      const source = String((x && x.source) || "").slice(0, 80);
      return { title, source, url: title ? "https://news.google.com/search?q=" + encodeURIComponent(`"${title}" ${source}`) : "" };
    }).filter(x => x.title);

    // CDN-cache for 6 hours so a fresh Perplexity call happens at most ~4x/day
    res.setHeader("Cache-Control", "s-maxage=21600, stale-while-revalidate=3600");
    res.status(200).json({ items });
  } catch (e) {
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ items: [], note: "error" });
  }
}
