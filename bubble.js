/* Heartbeat Observatory floating messages.
   Reads and writes the real account messages table. Empty means no real
   messages are visible to this account yet. */
(function () {
  if (window.__hbBubble) return;
  window.__hbBubble = true;

  var SUPABASE_URL = "https://ygjpnvrwhkrowkrskftk.supabase.co";
  var SUPABASE_KEY = "sb_publishable_Y-duV64ayMMEvVwMs5PWuw_6kvzbOrN";
  var inWorld = location.pathname.indexOf("/engine/hub") === 0;
  var state = {
    supabase: null,
    session: null,
    me: null,
    people: new Map(),
    messages: [],
    activeOtherId: "",
    loading: true,
    error: "",
    status: ""
  };

  var style = document.createElement("style");
  style.textContent =
    ".hb-bubble-btn{position:fixed;z-index:90000;border:0;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 26px rgba(0,0,0,.4);transition:transform .12s ease;font-family:system-ui,-apple-system,sans-serif;letter-spacing:0;}" +
    ".hb-bubble-btn:active{transform:scale(.94);}" +
    ".hb-b-normal{right:calc(18px + env(safe-area-inset-right,0px));bottom:calc(18px + env(safe-area-inset-bottom,0px));width:54px;height:54px;border-radius:50%;background:#1d6fe0;color:#fff;font-size:17px;font-weight:800;}" +
    ".hb-b-world{right:calc(12px + env(safe-area-inset-right,0px));top:50%;transform:translateY(-50%);width:46px;height:64px;border-radius:12px;background:#10171c;border:1px solid #2c3a42;color:#cfe0ea;font-size:10px;font-weight:800;}" +
    ".hb-b-world:active{transform:translateY(-50%) scale(.95);}" +
    ".hb-panel{position:fixed;z-index:90001;display:none;flex-direction:column;overflow:hidden;background:#0e1417;border:1px solid #243036;color:#e6edf1;font-family:system-ui,-apple-system,sans-serif;box-shadow:0 20px 60px rgba(0,0,0,.55);}" +
    ".hb-panel.open{display:flex;}" +
    ".hb-p-normal{right:calc(18px + env(safe-area-inset-right,0px));bottom:calc(82px + env(safe-area-inset-bottom,0px));width:min(360px,90vw);height:min(560px,72vh);border-radius:14px;}" +
    ".hb-p-world{right:calc(12px + env(safe-area-inset-right,0px));top:50%;transform:translateY(-50%);width:min(300px,84vw);height:min(480px,76vh);border-radius:24px;border:6px solid #05080a;background:#0b1115;}" +
    ".hb-head{min-height:48px;padding:12px 14px;border-bottom:1px solid #1e2a30;font-size:14px;font-weight:700;display:flex;justify-content:space-between;align-items:center;gap:10px;}" +
    ".hb-head-title{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}" +
    ".hb-head-actions{display:flex;align-items:center;gap:6px;}" +
    ".hb-icon{cursor:pointer;font-size:14px;line-height:1;background:#121b20;border:1px solid #26343b;color:#cdd6db;border-radius:6px;min-width:30px;height:30px;padding:0 8px;}" +
    ".hb-body{overflow:auto;flex:1;display:flex;flex-direction:column;}" +
    ".hb-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;color:#9fb0bb;font-size:13px;line-height:1.55;flex:1;padding:24px 18px;}" +
    ".hb-list{display:flex;flex-direction:column;}" +
    ".hb-conv{display:grid;grid-template-columns:1fr auto;gap:7px;padding:12px 14px;border-bottom:1px solid #1b262c;background:transparent;color:#e6edf1;text-align:left;cursor:pointer;}" +
    ".hb-conv:hover{background:#121a1f;}" +
    ".hb-name{font-size:13px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}" +
    ".hb-prev{grid-column:1/-1;color:#9fb0bb;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}" +
    ".hb-time{color:#7d909c;font-size:11px;white-space:nowrap;}" +
    ".hb-thread{display:flex;flex-direction:column;gap:8px;padding:12px 12px 16px;}" +
    ".hb-msg{max-width:86%;padding:9px 11px;border-radius:12px;font-size:13px;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere;}" +
    ".hb-msg.mine{align-self:flex-end;background:#e6edf1;color:#091016;}" +
    ".hb-msg.theirs{align-self:flex-start;background:#131c22;border:1px solid #233037;color:#e6edf1;}" +
    ".hb-meta{display:block;margin-top:4px;font-size:10px;opacity:.62;}" +
    ".hb-foot{padding:10px 12px;border-top:1px solid #1e2a30;display:grid;gap:8px;background:#0b1115;}" +
    ".hb-foot select,.hb-foot textarea{width:100%;border:1px solid #26343b;background:#090e12;color:#e6edf1;border-radius:8px;font:inherit;font-size:13px;}" +
    ".hb-foot select{height:36px;padding:0 9px;}" +
    ".hb-foot textarea{min-height:64px;max-height:120px;resize:vertical;padding:9px 10px;line-height:1.45;}" +
    ".hb-sendrow{display:flex;align-items:center;justify-content:space-between;gap:8px;}" +
    ".hb-send{border:0;border-radius:8px;background:#9fd0a0;color:#09130e;font:inherit;font-size:13px;font-weight:800;padding:9px 14px;cursor:pointer;}" +
    ".hb-send:disabled{opacity:.5;cursor:default;}" +
    ".hb-note{min-width:0;color:#82929c;font-size:11px;line-height:1.35;}" +
    ".hb-note.err{color:#e69191;}" +
    ".hb-note.ok{color:#9fd0a0;}" +
    ".hb-link{color:#9fd0ff;text-decoration:none;border-bottom:1px solid rgba(159,208,255,.45);}";
  document.head.appendChild(style);

  var btn = document.createElement("button");
  btn.className = "hb-bubble-btn " + (inWorld ? "hb-b-world" : "hb-b-normal");
  btn.setAttribute("aria-label", inWorld ? "Phone" : "Messages");
  btn.textContent = inWorld ? "PHONE" : "M";

  var panel = document.createElement("div");
  panel.className = "hb-panel " + (inWorld ? "hb-p-world" : "hb-p-normal");

  function esc(value) {
    var d = document.createElement("div");
    d.textContent = value == null ? "" : String(value);
    return d.innerHTML;
  }

  function nameForPerson(person) {
    if (!person) return "Member";
    return (person.display_name && person.display_name.trim()) || person.handle || "Member";
  }

  function nameForId(id) {
    return nameForPerson(state.people.get(id));
  }

  function handleForId(id) {
    return nameForId(id);
  }

  function ago(iso) {
    var t = new Date(iso).getTime();
    if (!Number.isFinite(t)) return "";
    var s = Math.max(0, Math.floor((Date.now() - t) / 1000));
    if (s < 60) return "now";
    var m = Math.floor(s / 60);
    if (m < 60) return m + "m";
    var h = Math.floor(m / 60);
    if (h < 24) return h + "h";
    var d = Math.floor(h / 24);
    if (d < 7) return d + "d";
    return new Date(iso).toLocaleDateString();
  }

  function otherId(message) {
    if (!state.me) return "";
    return message.sender_id === state.me ? message.recipient_id : message.sender_id;
  }

  function otherName(message) {
    if (!state.me) return "Member";
    return message.sender_id === state.me
      ? (message.recipient_handle || nameForId(message.recipient_id))
      : (message.sender_handle || nameForId(message.sender_id));
  }

  function buildConversations() {
    var seen = new Set();
    var conversations = [];
    var ordered = state.messages.slice().sort(function (a, b) {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    ordered.forEach(function (message) {
      var id = otherId(message);
      if (!id || seen.has(id)) return;
      seen.add(id);
      conversations.push({ id: id, name: otherName(message), last: message });
    });
    return conversations;
  }

  function render() {
    var title = state.activeOtherId ? nameForId(state.activeOtherId) : (inWorld ? "Phone" : "Messages");
    var body = "";
    var foot = "";
    var canSend = !!state.session && state.people.size > 1;
    var noteClass = state.error ? " err" : state.status ? " ok" : "";
    var note = state.error || state.status || (state.session ? "Real account messages only." : "Sign in to use messages.");

    if (state.loading) {
      body = '<div class="hb-empty">Loading real messages...</div>';
    } else if (!state.session) {
      body = '<div class="hb-empty"><div>Messages require a signed-in account.</div><a class="hb-link" href="/admin">Sign in</a></div>';
      canSend = false;
    } else if (state.activeOtherId) {
      var thread = state.messages.filter(function (m) { return otherId(m) === state.activeOtherId; });
      if (thread.length === 0) {
        body = '<div class="hb-empty">No messages with ' + esc(nameForId(state.activeOtherId)) + ' yet.</div>';
      } else {
        body = '<div class="hb-thread">' + thread.map(function (m) {
          var mine = m.sender_id === state.me;
          return '<div class="hb-msg ' + (mine ? "mine" : "theirs") + '">' +
            esc(m.body) + '<span class="hb-meta">' + (mine ? "you" : esc(m.sender_handle || nameForId(m.sender_id))) + " · " + ago(m.created_at) + '</span></div>';
        }).join("") + '</div>';
      }
    } else {
      var conversations = buildConversations();
      if (conversations.length === 0) {
        body = '<div class="hb-empty">No conversations yet. Choose a member below and send the first real message.</div>';
      } else {
        body = '<div class="hb-list">' + conversations.map(function (c) {
          return '<button class="hb-conv" type="button" data-other="' + esc(c.id) + '">' +
            '<span class="hb-name">' + esc(c.name) + '</span><span class="hb-time">' + ago(c.last.created_at) + '</span>' +
            '<span class="hb-prev">' + esc(c.last.body) + '</span></button>';
        }).join("") + '</div>';
      }
    }

    if (state.session) {
      var people = Array.from(state.people.values()).filter(function (p) { return p.auth_user_id !== state.me; });
      var select = "";
      if (!state.activeOtherId) {
        select = '<select id="hbTo" ' + (people.length ? "" : "disabled") + '>' +
          (people.length ? '<option value="">Choose a member...</option>' : '<option value="">No other members yet</option>') +
          people.map(function (p) {
            return '<option value="' + esc(p.auth_user_id) + '">' + esc(nameForPerson(p)) + '</option>';
          }).join("") +
          '</select>';
      }
      foot = '<div class="hb-foot">' + select +
        '<textarea id="hbBody" maxlength="4000" placeholder="' + (state.activeOtherId ? "Write a reply..." : "Write a private message...") + '" ' + (canSend ? "" : "disabled") + '></textarea>' +
        '<div class="hb-sendrow"><span class="hb-note' + noteClass + '">' + esc(note) + '</span><button class="hb-send" id="hbSend" type="button" ' + (canSend ? "" : "disabled") + '>Send</button></div>' +
        '</div>';
    }

    panel.innerHTML =
      '<div class="hb-head"><span class="hb-head-title">' + esc(title) + '</span><span class="hb-head-actions">' +
      (state.activeOtherId ? '<button class="hb-icon" id="hbBack" type="button" aria-label="Back">Back</button>' : "") +
      '<button class="hb-icon" id="hbRefresh" type="button" aria-label="Refresh">↻</button>' +
      '<button class="hb-icon" id="hbClose" type="button" aria-label="Close">×</button></span></div>' +
      '<div class="hb-body">' + body + '</div>' + foot;

    var close = panel.querySelector("#hbClose");
    if (close) close.addEventListener("click", function () { toggle(false); });
    var refresh = panel.querySelector("#hbRefresh");
    if (refresh) refresh.addEventListener("click", function () { refreshData(); });
    var back = panel.querySelector("#hbBack");
    if (back) back.addEventListener("click", function () { state.activeOtherId = ""; state.error = ""; state.status = ""; render(); });
    panel.querySelectorAll("[data-other]").forEach(function (el) {
      el.addEventListener("click", function () {
        state.activeOtherId = el.getAttribute("data-other") || "";
        state.error = "";
        state.status = "";
        render();
      });
    });
    var send = panel.querySelector("#hbSend");
    if (send) send.addEventListener("click", sendMessage);
  }

  function toggle(open) {
    var willOpen = open === undefined ? !panel.classList.contains("open") : open;
    panel.classList.toggle("open", willOpen);
    if (willOpen && state.supabase && state.session) refreshData();
  }

  async function refreshData() {
    if (!state.supabase || !state.session) return;
    state.error = "";
    state.status = "Refreshing...";
    render();
    await Promise.all([loadPeople(), loadMessages()]);
    state.status = "";
    render();
  }

  async function loadPeople() {
    try {
      var result = await state.supabase.from("people").select("auth_user_id, handle, display_name");
      if (result.error) throw result.error;
      state.people = new Map();
      (result.data || []).forEach(function (person) {
        if (person.auth_user_id) state.people.set(person.auth_user_id, person);
      });
    } catch (error) {
      state.error = error.message || "Could not load members.";
    }
  }

  async function loadMessages() {
    try {
      var result = await state.supabase
        .from("messages")
        .select("id, sender_id, recipient_id, sender_handle, recipient_handle, body, created_at")
        .order("created_at", { ascending: true });
      if (result.error) throw result.error;
      state.messages = result.data || [];
    } catch (error) {
      state.error = error.message || "Could not load messages.";
    }
  }

  async function sendMessage() {
    if (!state.supabase || !state.session || !state.me) return;
    var bodyEl = panel.querySelector("#hbBody");
    var toEl = panel.querySelector("#hbTo");
    var body = bodyEl ? bodyEl.value.trim() : "";
    var recipient = state.activeOtherId || (toEl ? toEl.value : "");
    if (!recipient) { state.error = "Choose who to message."; state.status = ""; render(); return; }
    if (!body) { state.error = "Write a message first."; state.status = ""; render(); return; }

    state.error = "";
    state.status = "Sending...";
    render();

    var sent = false;
    var rpc = await state.supabase.rpc("send_message", { recipient: recipient, body: body });
    if (!rpc.error) {
      sent = true;
    } else {
      var insert = await state.supabase.from("messages").insert({
        sender_id: state.me,
        recipient_id: recipient,
        sender_handle: handleForId(state.me),
        recipient_handle: handleForId(recipient),
        body: body
      });
      if (!insert.error) sent = true;
      else state.error = "Database is not accepting message sends yet: " + (insert.error.message || rpc.error.message);
    }

    if (sent) {
      state.status = "Sent.";
      state.error = "";
      if (!state.activeOtherId) state.activeOtherId = recipient;
      await loadMessages();
    } else {
      state.status = "";
    }
    render();
  }

  function subscribeMessages() {
    try {
      state.supabase.channel("hb-messages")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, function (payload) {
          var row = payload.new;
          if (!row || (row.sender_id !== state.me && row.recipient_id !== state.me)) return;
          if (!state.messages.find(function (m) { return m.id === row.id; })) state.messages.push(row);
          render();
        })
        .subscribe();
    } catch {}
  }

  async function init() {
    render();
    try {
      try {
        var shared = await import("/hb-supabase.js");
        state.supabase = await shared.getSupabase();
      } catch (sharedError) {
        var mod = await import("https://esm.sh/@supabase/supabase-js@2");
        state.supabase = mod.createClient(SUPABASE_URL, SUPABASE_KEY);
      }
      var result = await state.supabase.auth.getSession();
      state.session = result.data && result.data.session;
      state.me = state.session && state.session.user && state.session.user.id;
      if (state.session) {
        await Promise.all([loadPeople(), loadMessages()]);
        subscribeMessages();
      }
    } catch (error) {
      state.error = error.message || "Messages could not start.";
    }
    state.loading = false;
    state.status = "";
    render();
  }

  function mount() {
    document.body.appendChild(btn);
    document.body.appendChild(panel);
    btn.addEventListener("click", function () { toggle(); });
    init();
  }

  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);
})();
