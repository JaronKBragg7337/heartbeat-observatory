// /api/pam-chat.js — authenticated, persistent PAM chat bridge.
// Signed-in messages are saved to the user's PAM thread before the runtime
// bridge is attempted. If the local runtime is offline, the conversation still
// persists instead of disappearing from the page.

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

async function supabaseRest(path, authToken, options = {}) {
  const headers = {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    authorization: `Bearer ${authToken}`,
    "content-type": "application/json"
  };
  if (options.prefer) headers.prefer = options.prefer;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`supabase_${response.status}:${errorText.slice(0, 300)}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function titleFromMessage(message) {
  const clean = message.replace(/\s+/g, " ").trim();
  if (!clean) return "New chat";
  return clean.length > 52 ? `${clean.slice(0, 52).trim()}...` : clean;
}

async function ensurePamInstance(auth) {
  const rows = await supabaseRest(
    `pam_instances?select=id,display_name&owner_user_id=eq.${encodeURIComponent(auth.user.id)}&order=created_at.asc&limit=1`,
    auth.token
  );
  if (Array.isArray(rows) && rows[0]) return rows[0];

  const inserted = await supabaseRest("pam_instances?select=id,display_name", auth.token, {
    method: "POST",
    prefer: "return=representation",
    body: {
      owner_user_id: auth.user.id,
      display_name: "PAM",
      status: "active"
    }
  });
  return inserted && inserted[0];
}

async function ensureThread(auth, pamInstance, requestedThreadId, message) {
  if (isUuid(requestedThreadId)) {
    const rows = await supabaseRest(
      `pam_threads?select=id,title,pam_instance_id&owner_user_id=eq.${encodeURIComponent(auth.user.id)}&id=eq.${encodeURIComponent(requestedThreadId)}&limit=1`,
      auth.token
    );
    if (Array.isArray(rows) && rows[0]) return { ...rows[0], created: false };
  }

  const inserted = await supabaseRest("pam_threads?select=id,title,pam_instance_id", auth.token, {
    method: "POST",
    prefer: "return=representation",
    body: {
      pam_instance_id: pamInstance.id,
      owner_user_id: auth.user.id,
      title: titleFromMessage(message),
      status: "active"
    }
  });
  return { ...(inserted && inserted[0]), created: true };
}

async function insertMessage(auth, pamInstance, thread, senderType, body, provenanceTag = "Observed") {
  const inserted = await supabaseRest("pam_messages?select=id,created_at", auth.token, {
    method: "POST",
    prefer: "return=representation",
    body: {
      thread_id: thread.id,
      pam_instance_id: pamInstance.id,
      owner_user_id: auth.user.id,
      sender_type: senderType,
      body,
      provenance_tag: provenanceTag
    }
  });
  await supabaseRest(`pam_threads?id=eq.${encodeURIComponent(thread.id)}`, auth.token, {
    method: "PATCH",
    prefer: "return=minimal",
    body: { updated_at: new Date().toISOString() }
  });
  return inserted && inserted[0];
}

async function insertSystemReply(auth, pamInstance, thread, text, note) {
  const message = await insertMessage(auth, pamInstance, thread, "system", text, "Observed");
  return {
    reply: text,
    thread_id: thread.id,
    note,
    persisted: true,
    message_id: message && message.id
  };
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
  const requestedThreadId = String((body && body.thread_id) || "").trim().slice(0, 120);
  if (!message) {
    res.status(200).json({ reply: "", note: "empty" });
    return;
  }

  let pamInstance;
  let thread;
  let userMessage;
  try {
    pamInstance = await ensurePamInstance(auth);
    if (!pamInstance || !pamInstance.id) throw new Error("missing_pam_instance");
    thread = await ensureThread(auth, pamInstance, requestedThreadId, message);
    if (!thread || !thread.id) throw new Error("missing_thread");
    userMessage = await insertMessage(auth, pamInstance, thread, "user", message, "Observed");
  } catch (e) {
    res.status(200).json({
      reply: "",
      note: "persistence_error",
      detail: String(e && e.message ? e.message : e).slice(0, 300)
    });
    return;
  }

  const bridgeUrl = process.env.PAM_BRIDGE_URL;
  const bridgeToken = process.env.PAM_BRIDGE_TOKEN;
  if (!bridgeUrl || !bridgeToken) {
    const text = "Your message was saved to this PAM thread. The local runtime bridge is not configured right now, so I am holding the conversation state instead of fabricating a reply.";
    const payload = await insertSystemReply(auth, pamInstance, thread, text, "bridge_not_configured");
    res.status(200).json({ ...payload, user_message_id: userMessage && userMessage.id });
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
        thread_id: thread.id,
        heartbeat_user: {
          id: auth.user && auth.user.id,
          email: auth.user && auth.user.email,
          user_metadata: auth.user && auth.user.user_metadata
        }
      })
    });

    if (!upstream.ok) {
      const text = `Your message was saved to this PAM thread. The local runtime bridge returned ${upstream.status}, so no generated reply was accepted.`;
      const payload = await insertSystemReply(auth, pamInstance, thread, text, `bridge_${upstream.status}`);
      res.status(200).json({ ...payload, user_message_id: userMessage && userMessage.id });
      return;
    }

    const data = await upstream.json();
    const reply = String((data && data.reply) || "").trim();
    if (!reply) {
      const text = `Your message was saved to this PAM thread. The local runtime bridge returned no reply. Server note: ${String((data && data.note) || "empty_reply")}.`;
      const payload = await insertSystemReply(auth, pamInstance, thread, text, "empty_reply");
      res.status(200).json({ ...payload, user_message_id: userMessage && userMessage.id });
      return;
    }

    const pamMessage = await insertMessage(auth, pamInstance, thread, "pam", reply, "Observed");
    res.status(200).json({
      reply,
      thread_id: thread.id,
      note: "ok",
      persisted: true,
      user_message_id: userMessage && userMessage.id,
      pam_message_id: pamMessage && pamMessage.id
    });
  } catch (e) {
    const text = "Your message was saved to this PAM thread. The local runtime bridge could not be reached from the hosted server.";
    const payload = await insertSystemReply(auth, pamInstance, thread, text, "bridge_error");
    res.status(200).json({ ...payload, user_message_id: userMessage && userMessage.id });
  }
}
