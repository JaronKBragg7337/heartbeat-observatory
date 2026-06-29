// /api/pam-chat.js — public PAM bridge.
// The browser talks to this Vercel function, never directly to Jaron's local
// machine. When PAM_BRIDGE_URL and PAM_BRIDGE_TOKEN are configured server-side,
// this forwards authenticated user messages to the real PAM runtime. Until then
// it returns an honest bridge_not_configured note and no fabricated answer.

const SUPABASE_URL = "https://ygjpnvrwhkrowkrskftk.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Y-duV64ayMMEvVwMs5PWuw_6kvzbOrN";

async function readJson(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch (e) { return {}; }
  }
  return req.body;
}

async function verifyUser(authHeader) {
  const token = String(authHeader || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return { ok: false, note: "missing_auth" };
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${token}`
      }
    });
    if (!response.ok) return { ok: false, note: "invalid_auth" };
    const user = await response.json();
    return { ok: true, token, user };
  } catch (e) {
    return { ok: false, note: "auth_error" };
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ reply: "", note: "method_not_allowed" });
    return;
  }

  const auth = await verifyUser(req.headers.authorization);
  if (!auth.ok) {
    res.status(401).json({ reply: "", note: auth.note });
    return;
  }

  const body = await readJson(req);
  const message = String((body && body.message) || "").trim().slice(0, 8000);
  const threadId = String((body && body.thread_id) || "").trim().slice(0, 120);
  if (!message) {
    res.status(200).json({ reply: "", note: "empty" });
    return;
  }

  const bridgeUrl = process.env.PAM_BRIDGE_URL;
  const bridgeToken = process.env.PAM_BRIDGE_TOKEN;
  if (!bridgeUrl || !bridgeToken) {
    res.status(200).json({
      reply: "",
      note: "bridge_not_configured",
      next: "Set PAM_BRIDGE_URL and PAM_BRIDGE_TOKEN in Vercel, pointed at the authenticated PAM runtime bridge."
    });
    return;
  }

  try {
    const upstream = await fetch(bridgeUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${bridgeToken}`
      },
      body: JSON.stringify({
        message,
        thread_id: threadId,
        heartbeat_user: {
          id: auth.user && auth.user.id,
          email: auth.user && auth.user.email,
          user_metadata: auth.user && auth.user.user_metadata
        }
      })
    });

    if (!upstream.ok) {
      res.status(200).json({ reply: "", note: `bridge_${upstream.status}` });
      return;
    }

    const data = await upstream.json();
    res.status(200).json({
      reply: String((data && data.reply) || ""),
      thread_id: String((data && data.thread_id) || threadId || ""),
      note: data && data.reply ? "ok" : String((data && data.note) || "empty_reply")
    });
  } catch (e) {
    res.status(200).json({ reply: "", note: "bridge_error" });
  }
}
