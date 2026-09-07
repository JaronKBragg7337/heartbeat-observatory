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

function logicalStatus(data) {
  if (data?.ok) return 200;
  if (["missing_controller_token", "invalid_controller_token"].includes(data?.note)) return 401;
  if (["actor_scope_mismatch", "capability_denied"].includes(data?.note)) return 403;
  return 400;
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
  const action = body.action && typeof body.action === "object" && !Array.isArray(body.action) ? body.action : null;
  if (!actor || !action) return res.status(400).json({ ok: false, note: "actor_and_action_required" });

  try {
    const upstream = await fetch(`${SUPABASE_URL}/rest/v1/rpc/habitat_apply_action`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        p_controller_token: token,
        p_actor_key: actor,
        p_action: action
      })
    });

    const text = await upstream.text();
    let data;
    try { data = text ? JSON.parse(text) : null; }
    catch (_) { data = { ok: false, note: "invalid_upstream_json" }; }
    if (!upstream.ok) return res.status(502).json({ ok: false, note: "action_upstream_error", status: upstream.status });
    return res.status(logicalStatus(data)).json(data || { ok: false, note: "empty_action_response" });
  } catch (_) {
    return res.status(502).json({ ok: false, note: "action_unavailable" });
  }
}
