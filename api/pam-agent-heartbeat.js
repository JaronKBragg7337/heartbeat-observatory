// /api/pam-agent-heartbeat.js — durable outbound local-agent heartbeat.
// The local desktop agent calls this public endpoint with its device token.
// Supabase stores only a token hash and accepts the heartbeat through a scoped RPC.

const SUPABASE_URL = "https://ygjpnvrwhkrowkrskftk.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Y-duV64ayMMEvVwMs5PWuw_6kvzbOrN";

async function readJson(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch (e) { return {}; }
  }
  return req.body;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ ok: false, note: "method_not_allowed" });
    return;
  }

  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    res.status(401).json({ ok: false, note: "missing_device_token" });
    return;
  }

  const body = await readJson(req);
  const payload = {
    p_device_token: token,
    p_device_name: String((body && body.device_name) || "").slice(0, 120),
    p_platform: String((body && body.platform) || "").slice(0, 240),
    p_capabilities: (body && body.capabilities && typeof body.capabilities === "object")
      ? body.capabilities
      : {}
  };

  try {
    const upstream = await fetch(`${SUPABASE_URL}/rest/v1/rpc/pam_agent_heartbeat`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!upstream.ok) {
      res.status(200).json({ ok: false, note: `supabase_${upstream.status}` });
      return;
    }

    const data = await upstream.json();
    res.status(data && data.ok ? 200 : 401).json(data || { ok: false, note: "empty_response" });
  } catch (e) {
    res.status(200).json({ ok: false, note: "heartbeat_error" });
  }
}
