const SUPABASE_URL = "https://ygjpnvrwhkrowkrskftk.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Y-duV64ayMMEvVwMs5PWuw_6kvzbOrN";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("Cache-Control", "no-store");
}

function readJson(req) {
  if (!req.body) return {};
  if (typeof req.body === "object") return req.body;
  try { return JSON.parse(req.body); } catch (_) { return {}; }
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json({ ok: false, note: "method_not_allowed" });
  }

  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return res.status(401).json({ ok: false, note: "missing_controller_token" });

  const body = readJson(req);
  const actor = String(body.actor || "").trim().slice(0, 120);
  const session = String(body.session || "").trim().slice(0, 160);
  if (!actor || !session) return res.status(400).json({ ok: false, note: "actor_and_session_required" });

  const payload = {
    p_controller_token: token,
    p_actor_key: actor,
    p_session_key: session,
    p_provider: body.provider == null ? null : String(body.provider).slice(0, 120),
    p_model: body.model == null ? null : String(body.model).slice(0, 160),
    p_capabilities: Array.isArray(body.capabilities) ? body.capabilities.slice(0, 128) : null,
    p_metadata: body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata) ? body.metadata : {}
  };

  try {
    const upstream = await fetch(`${SUPABASE_URL}/rest/v1/rpc/habitat_controller_heartbeat`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    const text = await upstream.text();
    let data;
    try { data = text ? JSON.parse(text) : null; }
    catch (_) { data = { ok: false, note: "invalid_upstream_json" }; }
    if (!upstream.ok) return res.status(502).json({ ok: false, note: "heartbeat_upstream_error", status: upstream.status });
    const code = data?.ok ? 200 : (["invalid_controller_token", "missing_controller_token"].includes(data?.note) ? 401 : 400);
    return res.status(code).json(data || { ok: false, note: "empty_heartbeat_response" });
  } catch (_) {
    return res.status(502).json({ ok: false, note: "heartbeat_unavailable" });
  }
}
