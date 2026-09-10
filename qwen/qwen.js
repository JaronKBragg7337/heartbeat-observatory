import { getSupabase } from "/hb-supabase.js";

const QWEN_ID = "polymarket-qwen";
const EVENT_LIMIT = 60;
const MESSAGE_LIMIT = 200;
const POLL_MS = 12000;

const $ = (id) => document.getElementById(id);
const refs = {
  heroDot: $("heroDot"),
  lastSeen: $("lastSeen"),
  connectionNote: $("connectionNote"),
  componentGrid: $("componentGrid"),
  accountIdentity: $("accountIdentity"),
  accountStatus: $("accountStatus"),
  accountSource: $("accountSource"),
  credentialStatus: $("credentialStatus"),
  portfolioObserved: $("portfolioObserved"),
  balance: $("balance"),
  balanceNote: $("balanceNote"),
  positionsCount: $("positionsCount"),
  ordersCount: $("ordersCount"),
  retryCount: $("retryCount"),
  errorCount: $("errorCount"),
  positionsList: $("positionsList"),
  ordersList: $("ordersList"),
  activityPhase: $("activityPhase"),
  activityPulse: $("activityPulse"),
  activityLabel: $("activityLabel"),
  activityDetail: $("activityDetail"),
  marketsList: $("marketsList"),
  researchList: $("researchList"),
  streamDot: $("streamDot"),
  streamStatus: $("streamStatus"),
  eventStream: $("eventStream"),
  loadMoreEvents: $("loadMoreEvents"),
  authLink: $("authLink"),
  consoleState: $("consoleState"),
  authGate: $("authGate"),
  gateTitle: $("gateTitle"),
  gateNote: $("gateNote"),
  gateLink: $("gateLink"),
  chatArea: $("chatArea"),
  chatNotice: $("chatNotice"),
  chatLog: $("chatLog"),
  composer: $("composer"),
  messageInput: $("messageInput"),
  composerNote: $("composerNote"),
  sendButton: $("sendButton"),
  objectiveStatus: $("objectiveStatus"),
  objectiveLabel: $("objectiveLabel"),
  objectiveFile: $("objectiveFile")
};

let supabase;
let session = null;
let currentState = null;
let currentEvents = [];
let olderEventsLoaded = false;
let messageChannel = null;
let canControl = false;
let accessState = "checking";
let authEpoch = 0;
let sending = false;
let refreshInFlight = false;
let messageSignature = null;

const sensitiveKey = /(?:secret|password|authorization|private[_-]?key|api[_-]?key|access[_-]?token|refresh[_-]?token|credential[_-]?(?:value|secret|token|key))/i;

function redact(value, key = "", depth = 0) {
  if (sensitiveKey.test(String(key))) return "[REDACTED]";
  if (depth > 8) return "[TRUNCATED]";
  if (typeof value === "string") {
    return value
      .replace(/(bearer\s+)[^\s]+/gi, "$1[REDACTED]")
      .replace(/((?:api[_-]?key|secret|password|private[_-]?key|access[_-]?token|refresh[_-]?token)\s*[:=]\s*)[^,;\s}]+/gi, "$1[REDACTED]")
      .slice(0, 16000);
  }
  if (Array.isArray(value)) return value.map((item) => redact(item, "", depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([entryKey, entryValue]) => [entryKey, redact(entryValue, entryKey, depth + 1)]));
  }
  return value;
}

function text(node, value) {
  if (node) node.textContent = value == null ? "" : String(value);
}

function safe(value, fallback = "—") {
  return value == null || value === "" ? fallback : String(value);
}

function statusClass(status) {
  if (["online", "succeeded", "completed", "ok"].includes(String(status))) return "ok";
  if (["starting", "running", "working", "processing", "observing", "queued", "info", "offline", "unknown"].includes(String(status))) return "wait";
  if (String(status) === "degraded") return "degraded";
  return "bad";
}

function statusLabel(status) {
  const value = String(status || "unknown").replaceAll("_", " ");
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function setStatus(node, status, label = statusLabel(status)) {
  if (!node) return;
  node.className = node.className.replace(/\b(ok|wait|bad|degraded|online|starting|error)\b/g, "").trim() + " " + statusClass(status);
  if (node.matches(".phase-badge, .component-status")) text(node, label);
}

function formatTime(value, withDate = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, withDate
    ? { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
    : { hour: "numeric", minute: "2-digit", second: "2-digit" }).format(date);
}

function relativeTime(value) {
  if (!value) return "never";
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 8) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

function prettyPayload(payload) {
  const clean = redact(payload || {});
  if (typeof clean === "string") {
    try { return JSON.stringify(JSON.parse(clean), null, 2); } catch { return clean; }
  }
  try { return JSON.stringify(clean, null, 2); } catch { return String(clean); }
}

function scalar(value) {
  if (value == null) return "—";
  if (typeof value === "object") return JSON.stringify(redact(value));
  return String(value);
}

function rowTitle(row, kind) {
  if (!row || typeof row !== "object") return kind === "position" ? "Position" : "Order";
  return safe(row.title || row.market_title || row.market || row.slug || row.market_slug || row.name || row.id, kind === "position" ? "Position" : "Order");
}

function rowDetail(row) {
  if (!row || typeof row !== "object") return "Observed response row";
  const fields = [
    ["side", row.side], ["outcome", row.outcome], ["quantity", row.quantity ?? row.size],
    ["price", row.price], ["status", row.status], ["id", row.id]
  ].filter(([, value]) => value != null && value !== "");
  return fields.length ? fields.map(([key, value]) => `${key}: ${scalar(value)}`).join(" · ") : "Observed response row";
}

function rowsFrom(value, keys) {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value;
  for (const key of keys) {
    if (Array.isArray(value[key])) return value[key];
    if (value[key] && typeof value[key] === "object" && !Array.isArray(value[key])) return Object.values(value[key]);
  }
  return [];
}

function renderRows(node, rows, kind) {
  node.replaceChildren();
  if (!rows.length) {
    const empty = document.createElement("div");
    empty.className = "empty-row";
    empty.textContent = kind === "position" ? "No positions observed." : "No open orders observed.";
    node.appendChild(empty);
    return;
  }
  rows.slice(0, 20).forEach((row) => {
    const item = document.createElement("div");
    item.className = "data-row";
    const title = document.createElement("strong");
    title.textContent = rowTitle(row, kind);
    const detail = document.createElement("small");
    detail.textContent = rowDetail(row);
    item.append(title, detail);
    node.appendChild(item);
  });
}

function componentMeta(key, value) {
  const clean = value && typeof value === "object" ? value : {};
  const details = [];
  if (clean.model) details.push(clean.model);
  if (clean.server) details.push(clean.server);
  if (clean.api) details.push(clean.api);
  if (clean.last_error) details.push(`Last error: ${clean.last_error}`);
  if (clean.last_read_at) details.push(`Last read ${relativeTime(clean.last_read_at * 1000)}`);
  if (key === "polymarket" && clean.credentials_present !== undefined) details.push(clean.credentials_present ? "Credential presence confirmed" : "Credential presence not confirmed");
  return details.slice(0, 2).join(" · ") || "No additional detail reported";
}

function renderComponents(state) {
  const components = state?.components_json || {};
  const order = ["qwen", "ollama", "openclaw", "mcp", "polymarket"];
  refs.componentGrid.replaceChildren();
  order.forEach((key) => {
    const value = components[key] || {};
    const status = value.status || (key === "polymarket" ? (value.credentials_present === true ? "online" : "degraded") : "unknown");
    const card = document.createElement("article");
    card.className = "component-card";
    const head = document.createElement("div");
    head.className = "component-card-head";
    const name = document.createElement("strong");
    name.className = "component-name";
    name.textContent = key === "mcp" ? "MCP service" : key === "polymarket" ? "Polymarket US" : key === "ollama" ? "Ollama" : key === "openclaw" ? "OpenClaw" : "Qwen";
    const statusNode = document.createElement("span");
    statusNode.className = "component-status";
    const dot = document.createElement("span");
    dot.className = "status-dot";
    setStatus(dot, status);
    statusNode.append(dot, document.createTextNode(statusLabel(status)));
    setStatus(statusNode, status);
    head.append(name, statusNode);
    const meta = document.createElement("p");
    meta.className = "component-meta";
    meta.textContent = componentMeta(key, redact(value));
    card.append(head, meta);
    refs.componentGrid.appendChild(card);
  });
}

function renderState(state) {
  currentState = state;
  const overall = state?.status || "unknown";
  setStatus(refs.heroDot, overall);
  text(refs.lastSeen, state?.last_seen_at ? `Last heartbeat ${relativeTime(state.last_seen_at)}` : "Waiting for the first live heartbeat…");
  text(refs.connectionNote, state?.updated_at ? `State store updated ${formatTime(state.updated_at, true)}` : "Reading the remote state store…");
  renderComponents(state);

  const account = redact(state?.account_json || {});
  const portfolio = redact(state?.portfolio_json || {});
  text(refs.accountIdentity, safe(account.identity, "••••"));
  text(refs.accountStatus, statusLabel(account.status || "unknown"));
  text(refs.accountSource, safe(account.source, "Identity safely redacted"));
  text(refs.credentialStatus, account.credentials_present === true ? "Credential presence confirmed · value hidden" : account.credentials_present === false ? "Credential presence not confirmed" : "Credential presence: not observed yet");
  text(refs.portfolioObserved, portfolio.observed_at ? formatTime(Number(portfolio.observed_at) * 1000) : "—");
  text(refs.balance, safe(portfolio.balance_display, "$0.00"));
  text(refs.balanceNote, safe(portfolio.balance_note, "Waiting for live account response"));
  text(refs.positionsCount, portfolio.positions_count == null ? "—" : portfolio.positions_count);
  text(refs.ordersCount, portfolio.open_orders_count == null ? "—" : portfolio.open_orders_count);
  const retries = redact(state?.retry_json || {});
  const errors = redact(state?.error_json || {});
  text(refs.retryCount, retries.count == null ? "0" : retries.count);
  text(refs.errorCount, errors.count ? `${errors.count} error${errors.count === 1 ? "" : "s"} reported` : "No runtime errors reported");
  renderRows(refs.positionsList, rowsFrom(portfolio.positions, ["positions", "items", "data"]), "position");
  renderRows(refs.ordersList, rowsFrom(portfolio.open_orders, ["orders", "items", "data"]), "order");

  const activity = redact(state?.activity_json || {});
  const phase = activity.phase || overall;
  setStatus(refs.activityPhase, phase, statusLabel(phase));
  setStatus(refs.activityPulse, phase);
  text(refs.activityLabel, safe(activity.label, "Waiting for activity"));
  text(refs.activityDetail, activity.message_id ? `Owner message ${String(activity.message_id).slice(0, 8)}… · ${safe(activity.session, "persistent session")}` : "The MSI bridge publishes activity and observations through the durable message/event layer.");

  const objective = redact(state?.objective_json || {});
  text(refs.objectiveLabel, safe(objective.label, state?.objective_label || "Local-model Polymarket US experiment"));
  text(refs.objectiveFile, safe(objective.file, "OBJECTIVE.md"));
  setStatus(refs.objectiveStatus, objective.loaded ? "online" : "starting", objective.loaded ? "Loaded" : "Waiting");
}

function eventMarketLabel(event) {
  const payload = redact(event?.payload_json || {});
  const args = payload.arguments || payload.args || {};
  return args.slug || args.market_slug || args.query || payload.slug || payload.market_slug || payload.query || null;
}

function renderActivityFromEvents(events) {
  const markets = [];
  const research = [];
  const marketTools = new Set(["polymarket_search", "polymarket_list_markets", "polymarket_market", "polymarket_orderbook", "polymarket_bbo"]);
  events.forEach((event) => {
    const tool = event?.payload_json?.tool;
    if (event.event_type === "tool.started" && tool && marketTools.has(tool)) {
      const label = eventMarketLabel(event) || tool.replace("polymarket_", "");
      if (!markets.some((item) => item.label === label)) markets.push({ label, status: "inspecting", time: event.created_at });
    }
    if (event.event_type === "tool.completed" && tool) {
      const label = eventMarketLabel(event) || tool.replace("polymarket_", "");
      const researchLabel = `${tool.replaceAll("_", " ")} · ${event.status === "succeeded" ? "response received" : statusLabel(event.status)}`;
      if (!research.some((item) => item.label === researchLabel)) research.push({ label: researchLabel, status: event.status, time: event.created_at });
      const existing = markets.find((item) => item.label === label);
      if (existing) existing.status = event.status === "succeeded" ? "response received" : statusLabel(event.status);
    }
  });
  renderActivityList(refs.marketsList, markets.slice(0, 8), "No market inspection recorded yet.");
  renderActivityList(refs.researchList, research.slice(0, 8), "No research tool activity recorded yet.");
}

function renderActivityList(node, items, emptyText) {
  node.replaceChildren();
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "empty-row";
    empty.textContent = emptyText;
    node.appendChild(empty);
    return;
  }
  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "activity-row";
    const title = document.createElement("strong");
    title.textContent = String(item.label);
    const detail = document.createElement("small");
    detail.textContent = `${statusLabel(item.status)} · ${formatTime(item.time)}`;
    row.append(title, detail);
    node.appendChild(row);
  });
}

function renderEvents(events) {
  currentEvents = events;
  refs.eventStream.replaceChildren();
  if (!events.length) {
    const empty = document.createElement("div");
    empty.className = "empty-row";
    empty.style.padding = "17px";
    empty.textContent = "No events recorded yet. The bridge will publish its first heartbeat when it connects.";
    refs.eventStream.appendChild(empty);
  }
  events.forEach((event) => {
    const details = document.createElement("details");
    details.className = "event-item";
    const summary = document.createElement("summary");
    summary.className = "event-summary";
    const dot = document.createElement("span");
    dot.className = "status-dot";
    setStatus(dot, event.status);
    const type = document.createElement("span");
    type.className = "event-type";
    type.textContent = safe(event.event_type, "event");
    const message = document.createElement("span");
    message.className = "event-text";
    message.textContent = safe(event.summary, "No summary");
    const time = document.createElement("time");
    time.className = "event-time";
    time.dateTime = event.created_at || "";
    time.textContent = formatTime(event.created_at);
    summary.append(dot, type, message, time);
    const payloadWrap = document.createElement("div");
    payloadWrap.className = "event-payload";
    const label = document.createElement("div");
    label.className = "event-payload-label";
    label.textContent = event.event_type && event.event_type.startsWith("tool.") ? "Observed tool response / arguments" : "Recorded payload";
    const pre = document.createElement("pre");
    pre.textContent = prettyPayload(event.payload_json);
    payloadWrap.append(label, pre);
    details.append(summary, payloadWrap);
    refs.eventStream.appendChild(details);
  });
  renderActivityFromEvents(events);
  text(refs.streamStatus, events.length ? `Live · ${events.length} events` : "Waiting");
  setStatus(refs.streamDot, events.length ? "online" : "starting");
  refs.loadMoreEvents.hidden = events.length < EVENT_LIMIT || olderEventsLoaded;
}

async function loadState() {
  const { data, error } = await supabase.from("qwen_state").select("*").eq("qwen_id", QWEN_ID).maybeSingle();
  if (error) throw error;
  if (data) renderState(data);
}

async function loadEvents(older = false) {
  const epoch = authEpoch;
  let query = supabase.from("qwen_events").select("id,qwen_id,visibility,event_type,status,summary,payload_json,created_at").eq("qwen_id", QWEN_ID).order("created_at", { ascending: false }).limit(EVENT_LIMIT);
  if (older && currentEvents.length) query = query.lt("created_at", currentEvents[currentEvents.length - 1].created_at);
  const { data, error } = await query;
  if (epoch !== authEpoch) return;
  if (error) throw error;
  if (older) {
    const combined = [...currentEvents, ...(data || [])];
    const byId = new Map(combined.map((event) => [event.id, event]));
    renderEvents([...byId.values()].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
    olderEventsLoaded = true;
  } else {
    renderEvents(data || []);
  }
}

function messageStatusLabel(message) {
  if (message.status === "queued") return "Queued for Qwen";
  if (message.status === "processing") return "Qwen is working";
  if (message.status === "failed") return safe(message.error_text, "The bridge reported an error");
  return "Observed / persisted";
}

function renderMessages(messages) {
  const signature = JSON.stringify(messages);
  if (signature === messageSignature) return;
  const followLatest = messageSignature === null || refs.chatLog.scrollHeight - refs.chatLog.scrollTop - refs.chatLog.clientHeight < 60;
  messageSignature = signature;
  refs.chatLog.replaceChildren();
  if (!messages.length) {
    const empty = document.createElement("div");
    empty.className = "chat-empty";
    empty.textContent = "No messages in this persistent Qwen session yet. Send one below.";
    refs.chatLog.appendChild(empty);
    return;
  }
  messages.forEach((message) => {
    const row = document.createElement("div");
    row.className = `chat-message ${message.sender_type || "system"}`;
    const meta = document.createElement("span");
    meta.className = "chat-meta";
    meta.textContent = `${message.sender_type === "qwen" ? "Qwen" : message.sender_type === "user" ? "You" : "System"} · ${formatTime(message.created_at, true)}`;
    const bubble = document.createElement("div");
    bubble.className = "chat-bubble";
    bubble.textContent = redact(message.body || "");
    row.append(meta, bubble);
    if (message.sender_type === "user" && message.status !== "completed") {
      const status = document.createElement("span");
      status.className = "chat-status";
      status.textContent = messageStatusLabel(message);
      row.appendChild(status);
    }
    refs.chatLog.appendChild(row);
  });
  if (followLatest) refs.chatLog.scrollTop = refs.chatLog.scrollHeight;
}

async function loadMessages() {
  if (!canControl) return;
  const epoch = authEpoch;
  const { data, error } = await supabase.from("qwen_messages").select("id,sender_type,body,status,provenance_tag,response_to_id,error_text,created_at,started_at,completed_at").eq("qwen_id", QWEN_ID).order("created_at", { ascending: false }).limit(MESSAGE_LIMIT);
  if (epoch !== authEpoch || !canControl) return;
  if (error) throw error;
  refs.chatNotice.hidden = true;
  renderMessages([...(data || [])].reverse());
  const pending = (data || []).some((message) => ["queued", "processing"].includes(message.status));
  if (!sending) text(refs.composerNote, pending ? "Qwen is working in the persistent session…" : "Messages persist in the owner channel.");
  setStatus(refs.consoleState, pending ? "running" : "online", pending ? "Working" : "Connected");
}

function updateAuthUi() {
  const signedIn = Boolean(session?.user?.id);
  refs.authGate.hidden = canControl;
  refs.chatArea.hidden = !canControl;
  refs.messageInput.disabled = !canControl;
  refs.sendButton.disabled = !canControl || sending;
  text(refs.authLink, signedIn ? "Account" : "Sign in to control");
  refs.gateLink.hidden = accessState === "checking" || accessState === "error";
  if (canControl) {
    setStatus(refs.consoleState, "online", "Owner connected");
  } else {
    refs.chatLog.replaceChildren();
    messageSignature = null;
    const copy = accessState === "checking"
      ? ["Checking access", "Checking your session…", "Confirming access to the owner channel."]
      : accessState === "error"
        ? ["Access check failed", "Could not verify owner access", "Your sign-in is still recognized. The access check will retry automatically."]
        : signedIn
          ? ["Observer access", "You're signed in as an observer", "This account can view the dashboard. Only the configured owner can message this Qwen agent."]
          : ["Sign-in required", "Private control channel", "Anyone can view the dashboard. Sign in with the owner account to message Qwen."];
    setStatus(refs.consoleState, accessState === "error" ? "degraded" : "starting", copy[0]);
    text(refs.gateTitle, copy[1]);
    text(refs.gateNote, copy[2]);
    text(refs.gateLink, signedIn ? "Manage account →" : "Sign in to message Qwen →");
  }
}

async function resolveAccess() {
  const epoch = authEpoch;
  if (!session?.user?.id) {
    canControl = false;
    accessState = "guest";
  } else {
    // RLS returns only the owner's instance ID. No private configuration is
    // granted to the browser; enqueue still independently checks ownership.
    let data = null;
    let error = null;
    try {
      ({ data, error } = await supabase.from("qwen_instances").select("id").eq("id", QWEN_ID).maybeSingle());
    } catch {
      error = true;
    }
    if (epoch !== authEpoch) return;
    canControl = !error && data?.id === QWEN_ID;
    accessState = error ? "error" : canControl ? "owner" : "observer";
  }
  updateAuthUi();
}

function setSession(nextSession) {
  const changed = session?.user?.id !== nextSession?.user?.id;
  session = nextSession;
  if (changed) {
    authEpoch += 1;
    canControl = false;
    accessState = session ? "checking" : "guest";
    messageSignature = null;
    refs.chatLog.replaceChildren();
    refs.messageInput.value = "";
    refs.chatNotice.hidden = true;
    // Owner-only events and messages must not survive account switching.
    currentEvents = [];
    olderEventsLoaded = false;
    refs.eventStream.replaceChildren();
    refs.marketsList.replaceChildren();
    refs.researchList.replaceChildren();
  }
  updateAuthUi();
}

function showMessageError() {
  if (!canControl) return;
  refs.chatNotice.hidden = false;
  text(refs.chatNotice, "You're signed in. Message history couldn't load; retrying automatically. The public dashboard is separate.");
  setStatus(refs.consoleState, "degraded", "History unavailable");
}

async function sendMessage(event) {
  event.preventDefault();
  const body = refs.messageInput.value.trim();
  if (!body || !canControl || sending) return;
  const epoch = authEpoch;
  sending = true;
  refs.sendButton.disabled = true;
  text(refs.composerNote, "Queueing the owner message…");
  try {
    const { data, error } = await supabase.rpc("qwen_enqueue_message", { p_qwen_id: QWEN_ID, p_body: body });
    if (epoch !== authEpoch) return;
    if (error || !data?.ok) {
      text(refs.composerNote, "Could not confirm delivery. Your draft is kept; check the conversation before trying again.");
      return;
    }
    refs.messageInput.value = "";
    text(refs.composerNote, "Queued · waiting for the MSI bridge");
    refs.chatLog.scrollTop = refs.chatLog.scrollHeight;
    // A history refresh failure must never turn a successful enqueue into a
    // failed send or leave the Send button permanently disabled.
    await loadMessages().catch(showMessageError);
    await loadEvents().catch(() => {});
  } catch {
    if (epoch === authEpoch) text(refs.composerNote, "Could not confirm delivery. Your draft is kept; check the conversation before trying again.");
  } finally {
    sending = false;
    refs.sendButton.disabled = !canControl;
  }
}

async function refreshAll() {
  if (refreshInFlight) return;
  refreshInFlight = true;
  try {
    await resolveAccess();
    await Promise.all([
      loadState().catch(() => text(refs.connectionNote, "The latest runtime snapshot couldn't load; retrying. Any visible snapshot is the last one received.")),
      loadEvents().catch(() => {
        setStatus(refs.streamDot, "degraded");
        text(refs.streamStatus, "Event feed retrying");
      }),
      loadMessages().catch(showMessageError)
    ]);
    await subscribeMessages();
  } finally {
    refreshInFlight = false;
  }
}

async function subscribe() {
  supabase.channel("qwen-public-observatory")
    .on("postgres_changes", { event: "*", schema: "public", table: "qwen_state", filter: `qwen_id=eq.${QWEN_ID}` }, () => loadState().catch(() => {}))
    .on("postgres_changes", { event: "*", schema: "public", table: "qwen_events", filter: `qwen_id=eq.${QWEN_ID}` }, () => loadEvents().catch(() => {}))
    .subscribe();
}

async function subscribeMessages() {
  if (messageChannel && canControl && messageChannel.ownerEpoch === authEpoch) return;
  if (messageChannel) {
    await supabase.removeChannel(messageChannel);
    messageChannel = null;
  }
  if (!canControl) return;
  messageChannel = supabase.channel("qwen-owner-messages")
    .on("postgres_changes", { event: "*", schema: "public", table: "qwen_messages", filter: `qwen_id=eq.${QWEN_ID}` }, () => loadMessages().catch(showMessageError))
    .subscribe();
  messageChannel.ownerEpoch = authEpoch;
}

async function boot() {
  try {
    supabase = await getSupabase();
    const auth = await supabase.auth.getSession();
    setSession(auth.data?.session || null);
    await refreshAll();
    await subscribe();
    await subscribeMessages();
    supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      // Supabase auth callbacks must return before starting other auth-backed
      // requests, otherwise the shared client's session lock can deadlock.
      setTimeout(() => { refreshAll().catch(() => {}); }, 0);
    });
    setInterval(() => refreshAll().catch(() => {}), POLL_MS);
  } catch (error) {
    text(refs.connectionNote, "Could not load the remote state store. The page will retry when it can.");
    text(refs.streamStatus, "Unavailable");
    setStatus(refs.streamDot, "error");
    setStatus(refs.heroDot, "error");
  }
}

refs.composer.addEventListener("submit", sendMessage);
refs.loadMoreEvents.addEventListener("click", () => loadEvents(true).catch(() => {}));
boot();
