const SUPABASE_URL = "https://ygjpnvrwhkrowkrskftk.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Y-duV64ayMMEvVwMs5PWuw_6kvzbOrN";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    return res.status(405).json({ ok: false, note: "method_not_allowed" });
  }

  const rawWorld = Array.isArray(req.query?.world) ? req.query.world[0] : req.query?.world;
  const world = String(rawWorld || "habitat-v0").trim().slice(0, 80) || "habitat-v0";

  try {
    const upstream = await fetch(`${SUPABASE_URL}/rest/v1/rpc/habitat_public_snapshot`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ p_world_key: world })
    });

    const text = await upstream.text();
    let data;
    try { data = text ? JSON.parse(text) : null; }
    catch (_) { data = { ok: false, note: "invalid_upstream_json" }; }

    if (!upstream.ok) {
      return res.status(502).json({ ok: false, note: "snapshot_upstream_error", status: upstream.status });
    }
    return res.status(data?.ok === false ? 404 : 200).json(data || { ok: false, note: "empty_snapshot" });
  } catch (_) {
    return res.status(502).json({ ok: false, note: "snapshot_unavailable" });
  }
}
