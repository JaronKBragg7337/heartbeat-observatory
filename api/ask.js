// /api/ask.js — the in-world guide: Claude, scoped to Heartbeat Observatory.
// ANTHROPIC_API_KEY lives only in Vercel env and is read here on the server.
// The browser never sees the key. If the key is absent we return an honest
// "offline" note and NEVER fabricate a reply (honesty is the rule of this world).
// Mirrors the secret-safe pattern in /api/news.js.

const SYSTEM_PROMPT = [
  "You are Claude, appearing as a friendly guide inside Heartbeat Observatory \u2014 a walkable 3D town where real people and real AIs meet, build, and hang out together. Speak as yourself: warm, plain, and brief (2\u20134 sentences unless asked for more). Write in plain conversational text, with no markdown, asterisks, headers, or bullet symbols.",
  "",
  "What you help with: what this place is; how to get around (move with the on-screen joystick or WASD, look by dragging the screen or moving the mouse, jump, duck, throw a snowball, hold an item like coffee or a ball, and press E or tap Enter to go into a building); how to claim a spot of your own (link a GitHub project to an open plot, or earn a personal home as you get involved); and what the different spaces are.",
  "",
  "Honesty is the rule of this world: never invent a feature or claim something works if you are not sure. If you do not know, say so plainly and suggest they look around or sign in.",
  "",
  "Stay on the world and this project. Politely skip politics, real public figures, and online drama \u2014 a quick redirect back to the Observatory is perfect. Keep people feeling welcome."
].join("\n");

const SUPABASE_URL = "https://ygjpnvrwhkrowkrskftk.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Y-duV64ayMMEvVwMs5PWuw_6kvzbOrN";

// Soft rate limit (for now): ~3 replies/hour per IP via a SECURITY DEFINER RPC.
// Fails OPEN so a limiter hiccup never takes the guide offline.
async function askAllowed(ip) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/ask_allow`, {
      method: "POST",
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: "Bearer " + SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ p_ip: ip || "unknown" })
    });
    if (!r.ok) return true;
    const v = await r.json();
    return v !== false;
  } catch (e) {
    return true;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ reply: "", note: "method_not_allowed" });
    return;
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ reply: "", note: "not_configured" });
    return;
  }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const message = String((body && body.message) || "").trim().slice(0, 500);
  if (!message) {
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ reply: "", note: "empty" });
    return;
  }

  const ip = String(req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || "").split(",")[0].trim();
  if (!(await askAllowed(ip))) {
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ reply: "", note: "rate_limited" });
    return;
  }

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: message }]
      })
    });

    if (!r.ok) {
      res.setHeader("Cache-Control", "no-store");
      res.status(200).json({ reply: "", note: "upstream_" + r.status });
      return;
    }

    const data = await r.json();
    const parts = (data && Array.isArray(data.content)) ? data.content : [];
    const reply = parts.filter(p => p && p.type === "text").map(p => p.text).join("\n").trim();

    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ reply: reply || "", note: reply ? "ok" : "empty_reply" });
  } catch (e) {
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ reply: "", note: "error" });
  }
}
