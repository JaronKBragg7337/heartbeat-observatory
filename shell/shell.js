/* ============================================================================
   shell.js — THE SHELL, as one system
   ---------------------------------------------------------------------------
   docs/SHELL.md is the law this file implements: "A player is ONE person who
   walks MANY worlds. Everything about being that person must be identical
   everywhere." Until now that only existed inside engine/hub/main.js, so
   World 2 re-implemented it and lost the settings panel, the character, the
   menu and the phone. This is that shell extracted once, so a world only has
   to supply a world.

   A world calls HBShell.mount() with four hooks and gets: identity, the
   character (one body across all worlds), touch + keyboard input, the HUD
   chips, settings, the phone, and multiplayer transport.

   TWO LAWS CARRIED VERBATIM FROM WORLD 1, both paid for in production:

   1. presence.track() is join/leave IDENTITY ONLY. Never call it from the
      movement cycle. Doing so tripped ClientPresenceRateLimitReached on a
      phone joystick, which throttles the WHOLE socket and starves state
      delivery for that player. Positions ride broadcast, always.
   2. Send at most 10Hz, and suppress sends when nothing a peer could see has
      changed (5s keepalive while idle).

   Plus one rule of Jaron's that World 1 does not follow yet, from RUSTFALL:
   the movement stick is INVISIBLE until a thumb is down. The world gets the
   whole screen; controls appear where you touch and fade when you let go.
   ========================================================================== */
(function () {
"use strict";
if (window.HBShell) return;

const SUPA_URL = "https://ygjpnvrwhkrowkrskftk.supabase.co";
const SUPA_KEY = "sb_publishable_Y-duV64ayMMEvVwMs5PWuw_6kvzbOrN";

const SEND_HZ = 10;
const SEND_INTERVAL = 1 / SEND_HZ;
const IDLE_KEEPALIVE_MS = 5000;
/* SHELL.md: "Interp delay >= 2x send interval with buffered hold." */
const INTERP_DELAY_MS = (1000 / SEND_HZ) * 2;

const PEER_COLORS = ["#4fa3ff", "#5fd38d", "#f6b45b", "#e36d7c", "#a67cff", "#47c7b8", "#f0d461", "#d987e8"];

/* ------------------------------------------------------------------ util - */
const $ = (id) => document.getElementById(id);
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function idChunk() { return Math.random().toString(36).slice(2, 10); }
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function sanitizeName(raw) {
  const s = String(raw || "").trim().slice(0, 24);
  return s.length ? s : "";
}

/* ------------------------------------------------------------------ css - */
/* Injected rather than shipped as a file so a world needs exactly one script
   tag. Everything is scoped under .hbs- so it cannot collide with a world. */
const CSS = `
.hbs-hud{position:fixed;top:calc(8px + env(safe-area-inset-top));left:calc(8px + env(safe-area-inset-left));z-index:70;display:flex;flex-wrap:wrap;gap:6px;max-width:calc(100vw - 120px);pointer-events:none;font:600 11px/1 system-ui,-apple-system,sans-serif;letter-spacing:.04em}
.hbs-chip{background:rgba(14,20,23,.82);border:1px solid #2c3a42;color:#cfe0ea;border-radius:8px;padding:8px 11px;backdrop-filter:blur(8px);text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:46vw}
.hbs-chip.on{color:#7ce38b}
.hbs-chip.place{color:#8fd0ff}
.hbs-top-right{position:fixed;top:calc(8px + env(safe-area-inset-top));right:calc(8px + env(safe-area-inset-right));z-index:71;display:flex;gap:6px}
.hbs-icon{width:46px;height:46px;border-radius:10px;background:rgba(14,20,23,.9);border:1px solid #2c3a42;color:#cfe0ea;font-size:17px;cursor:pointer;display:flex;align-items:center;justify-content:center}
.hbs-icon:active{transform:scale(.94)}

/* Movement: no fixed pad. The stick is born under the thumb and dies with it. */
.hbs-stick{position:fixed;z-index:64;width:132px;height:132px;margin:-66px 0 0 -66px;border-radius:50%;
  border:1px solid rgba(255,255,255,.16);background:rgba(12,16,22,.28);backdrop-filter:blur(2px);
  opacity:0;transition:opacity .18s ease;pointer-events:none;display:none}
.hbs-stick.live{opacity:1}
.hbs-stick i{position:absolute;left:50%;top:50%;width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:50%;
  background:rgba(232,237,242,.34);border:1px solid rgba(255,255,255,.34)}
.hbs-actions{position:fixed;right:calc(16px + env(safe-area-inset-right));bottom:calc(26px + env(safe-area-inset-bottom));
  z-index:65;display:none;flex-direction:column;gap:11px;align-items:center}
body.hbs-touch .hbs-actions{display:flex}
.hbs-act{width:74px;height:74px;border-radius:50%;border:1px solid rgba(255,255,255,.22);background:rgba(236,243,248,.9);
  color:#0d1418;font:700 13px/1 system-ui,sans-serif;display:flex;align-items:center;justify-content:center;user-select:none;cursor:pointer}
.hbs-act:active{transform:scale(.93)}
.hbs-act.ghost{background:rgba(14,20,23,.62);color:#dfe9ef}
.hbs-act.go{background:rgba(159,208,160,.92);color:#08130c}
.hbs-act.hide{display:none}

.hbs-prompt{position:fixed;left:50%;bottom:calc(150px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:66;
  background:rgba(14,20,23,.92);border:1px solid #2c3a42;color:#e6edf1;border-radius:10px;padding:9px 14px;
  font:600 13px/1.3 system-ui,sans-serif;display:none;max-width:min(420px,92vw);text-align:center}
.hbs-prompt.on{display:block}

.hbs-panel{position:fixed;z-index:90001;display:none;flex-direction:column;overflow:hidden;background:#0e1417;
  border:1px solid #243036;color:#e6edf1;font-family:system-ui,-apple-system,sans-serif;box-shadow:0 20px 60px rgba(0,0,0,.55);
  right:calc(12px + env(safe-area-inset-right));top:50%;transform:translateY(-50%);width:min(310px,86vw);height:min(560px,80vh);
  border-radius:26px;border:6px solid #05080a;background:#0b1115}
.hbs-panel.open{display:flex}
.hbs-phead{min-height:46px;padding:11px 14px;border-bottom:1px solid #1e2a30;display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:14px;font-weight:700}
.hbs-pbody{overflow:auto;flex:1;-webkit-overflow-scrolling:touch}
.hbs-pill{cursor:pointer;font-size:13px;background:#121b20;border:1px solid #26343b;color:#cdd6db;border-radius:7px;min-width:30px;height:30px;padding:0 9px}

/* the phone home screen — a grid of apps, not a wall of messages */
.hbs-apps{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;padding:20px 16px}
.hbs-app{background:none;border:0;color:#e6edf1;display:flex;flex-direction:column;align-items:center;gap:7px;cursor:pointer;font:600 10px/1.2 system-ui,sans-serif}
.hbs-app .g{width:54px;height:54px;border-radius:15px;display:flex;align-items:center;justify-content:center;font-size:23px;background:#1a242a;border:1px solid #26343b}
.hbs-app:active .g{transform:scale(.93)}
.hbs-app .badge{position:absolute;transform:translate(20px,-8px);background:#e06060;color:#fff;border-radius:9px;font-size:9px;padding:1px 5px;font-weight:800}
.hbs-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;color:#9fb0bb;font-size:13px;line-height:1.55;flex:1;padding:26px 18px;height:100%}
.hbs-link{color:#8fd0ff;text-decoration:underline}
.hbs-conv{display:grid;grid-template-columns:1fr auto;gap:6px;padding:12px 14px;border-bottom:1px solid #1b262c;background:transparent;color:#e6edf1;text-align:left;cursor:pointer;width:100%;border-left:0;border-right:0;border-top:0}
.hbs-conv b{font-size:13px}
.hbs-conv .p{grid-column:1/-1;color:#9fb0bb;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hbs-conv .t{color:#7d909c;font-size:11px}
.hbs-msg{max-width:86%;padding:9px 11px;border-radius:12px;font-size:13px;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere;margin:4px 12px}
.hbs-msg.me{margin-left:auto;background:#e6edf1;color:#091016}
.hbs-msg.them{background:#131c22;border:1px solid #233037}
.hbs-foot{padding:10px 12px;border-top:1px solid #1e2a30;display:grid;gap:8px;background:#0b1115}
.hbs-foot select,.hbs-foot textarea{width:100%;border:1px solid #26343b;background:#090e12;color:#e6edf1;border-radius:8px;font:inherit;font-size:13px}
.hbs-foot select{height:36px;padding:0 9px}
.hbs-foot textarea{min-height:58px;max-height:110px;resize:vertical;padding:9px 10px}
.hbs-send{border:0;border-radius:8px;background:#9fd0a0;color:#09130e;font:700 13px system-ui,sans-serif;padding:9px 14px;cursor:pointer}
.hbs-send:disabled{opacity:.5}
.hbs-row{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:11px 15px;border-bottom:1px solid #1b262c;font-size:13px}
.hbs-row input[type=range]{width:130px;accent-color:#8fd0ff}
.hbs-row input[type=checkbox]{width:17px;height:17px;accent-color:#8fd0ff}
.hbs-sw{display:flex;flex-wrap:wrap;gap:8px;padding:12px 15px}
.hbs-sw button{width:30px;height:30px;border-radius:50%;border:2px solid transparent;cursor:pointer}
.hbs-sw button.sel{border-color:#e6edf1}
.hbs-lab{font-size:10px;opacity:.55;letter-spacing:.05em;padding:12px 15px 0;text-transform:uppercase}
.hbs-seg{display:flex;gap:6px;padding:10px 15px}
.hbs-seg button{flex:1;padding:8px;border-radius:8px;border:1px solid #26343b;background:#121b20;color:#cdd6db;font:600 12px system-ui,sans-serif;cursor:pointer}
.hbs-seg button.sel{background:#8fd0ff;color:#08131a;border-color:#8fd0ff}
.hbs-note{font-size:11px;color:#82929c;padding:9px 15px;line-height:1.45}
`;

/* ======================================================================== */
const HBShell = { version: "0.1.0" };

HBShell.mount = function mount(options) {
  const opts = Object.assign({
    world: "world3",
    worldLabel: "World",
    gateUrl: "/",
    /* hooks the world supplies */
    getState: () => null,          // -> {x,y,z,yaw,pitch,stance,place} or null
    onPeers: () => {},             // (peersArray) -> void, every frame-ish
    onSettings: () => {},          // (settings) -> void
    onAction: () => {},            // ("use"|"jump"|"duck-down"|"duck-up"|"run-down"|"run-up") -> void
    onMove: () => {},              // ({x, y, active}) -> void, normalised -1..1
    onLook: () => {},              // (dx, dy) -> void, pixels
  }, options || {});

  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  const isTouch = matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
  if (isTouch) document.body.classList.add("hbs-touch");

  const shell = {
    opts, isTouch,
    supa: null, session: null, uid: null,
    displayName: "", handle: "",
    appearance: { body: "person", build: "regular", shirt: "#4fa3ff", skin: "#e0b48c", hair: "#5a3a22", pants: "#3a4654", pattern: "plain" },
    settings: loadSettings(),
    channel: null, connected: false,
    peers: new Map(),
    place: "",
    selfKey: null,
  };

  /* ---------------------------------------------------------------- dom - */
  const hud = el("div", "hbs-hud");
  const cStatus = chip("connecting"), cCount = chip("0 live"), cNet = chip("realtime"),
        cName = chip("Guest"), cPlace = chip(opts.worldLabel, "place");
  hud.append(cStatus, cCount, cNet, cName, cPlace);

  const topRight = el("div", "hbs-top-right");
  const bPhone = el("button", "hbs-icon"); bPhone.textContent = "▣"; bPhone.setAttribute("aria-label", "Phone");
  const bMenu = el("button", "hbs-icon"); bMenu.textContent = "☰"; bMenu.setAttribute("aria-label", "Menu");
  topRight.append(bPhone, bMenu);

  const stick = el("div", "hbs-stick"); stick.appendChild(document.createElement("i"));
  const actions = el("div", "hbs-actions");
  const aUse  = act("Enter", "go hide"), aJump = act("Jump", "ghost"), aDuck = act("Duck", "");
  actions.append(aUse, aJump, aDuck);

  const prompt = el("div", "hbs-prompt");
  const phone = el("div", "hbs-panel");
  const menu  = el("div", "hbs-panel");

  document.body.append(hud, topRight, stick, actions, prompt, phone, menu);

  function el(tag, cls) { const n = document.createElement(tag); if (cls) n.className = cls; return n; }
  function chip(text, extra) { const n = el("span", "hbs-chip" + (extra ? " " + extra : "")); n.textContent = text; return n; }
  function act(label, cls) { const n = el("div", "hbs-act" + (cls ? " " + cls : "")); n.textContent = label; return n; }

  /* ------------------------------------------------------------- input - */
  /* Movement stick: appears under the thumb, anywhere on the left 45% of the
     screen, and fades on release. Look: drag anywhere on the right. */
  const input = { moveId: null, ox: 0, oy: 0, x: 0, y: 0, lookId: null, lx: 0, ly: 0 };

  function stickDown(e) {
    if (!isTouch || input.moveId !== null) return false;
    if (e.clientX > window.innerWidth * 0.45) return false;
    input.moveId = e.pointerId; input.ox = e.clientX; input.oy = e.clientY;
    stick.style.left = e.clientX + "px"; stick.style.top = e.clientY + "px";
    stick.style.display = "block";
    requestAnimationFrame(() => stick.classList.add("live"));
    return true;
  }
  function stickMove(e) {
    if (e.pointerId !== input.moveId) return;
    const dx = e.clientX - input.ox, dy = e.clientY - input.oy;
    const len = Math.hypot(dx, dy), max = 52;
    const k = len > max ? max / len : 1;
    const kx = dx * k, ky = dy * k;
    stick.firstChild.style.transform = `translate(${kx}px, ${ky}px)`;
    input.x = clamp(kx / max, -1, 1); input.y = clamp(ky / max, -1, 1);
    opts.onMove({ x: input.x, y: input.y, active: true });
  }
  function stickUp(e) {
    if (e.pointerId !== input.moveId) return;
    input.moveId = null; input.x = 0; input.y = 0;
    stick.classList.remove("live");
    stick.firstChild.style.transform = "";
    setTimeout(() => { if (input.moveId === null) stick.style.display = "none"; }, 200);
    opts.onMove({ x: 0, y: 0, active: false });
  }

  /* e.target is not always an Element -- a synthetic event, or one retargeted
     to the document or window, has no closest() and would otherwise throw and
     kill every control on the page. */
  function onChrome(e) {
    const t = e.target;
    return !!(t && typeof t.closest === "function" && t.closest(".hbs-act,.hbs-icon,.hbs-panel"));
  }

  addEventListener("pointerdown", (e) => {
    if (isPanelOpen() || onChrome(e)) return;
    if (stickDown(e)) return;
    if (isTouch && e.clientX > window.innerWidth * 0.45) {
      input.lookId = e.pointerId; input.lx = e.clientX; input.ly = e.clientY;
    }
  }, { passive: true });

  addEventListener("pointermove", (e) => {
    if (e.pointerId === input.moveId) return stickMove(e);
    if (e.pointerId === input.lookId) {
      opts.onLook((e.clientX - input.lx) * 2.2, (e.clientY - input.ly) * 2.2);
      input.lx = e.clientX; input.ly = e.clientY;
    }
  }, { passive: true });

  function releasePointer(e) {
    if (e.pointerId === input.moveId) stickUp(e);
    if (e.pointerId === input.lookId) input.lookId = null;
  }
  addEventListener("pointerup", releasePointer, { passive: true });
  addEventListener("pointercancel", releasePointer, { passive: true });

  bind(aUse, "use"); bind(aJump, "jump");
  aDuck.addEventListener("pointerdown", (e) => { e.preventDefault(); opts.onAction("duck-down"); });
  aDuck.addEventListener("pointerup", () => opts.onAction("duck-up"));
  aDuck.addEventListener("pointercancel", () => opts.onAction("duck-up"));
  function bind(node, name) {
    node.addEventListener("pointerdown", (e) => { e.preventDefault(); opts.onAction(name); });
  }

  bPhone.addEventListener("click", () => { closeMenu(); togglePhone(); });
  bMenu.addEventListener("click", () => { closePhone(); toggleMenu(); });

  /* --------------------------------------------------------- the prompt - */
  shell.setPrompt = function (text) {
    if (!text) { prompt.classList.remove("on"); aUse.classList.add("hide"); return; }
    prompt.textContent = text;
    prompt.classList.add("on");
    aUse.classList.remove("hide");
  };
  shell.setPlace = function (name) {
    if (!name || name === shell.place) return;
    shell.place = name;
    cPlace.textContent = name;
    saveCharacterSoon();
  };

  /* ------------------------------------------------------------ phone - */
  /* Opens on a HOME SCREEN of apps. Messages is one app inside it, not the
     whole device — the shape Jaron asked for. */
  let phoneView = "home";
  let phoneThread = "";
  const people = new Map();
  let messages = [];

  function togglePhone() { phone.classList.contains("open") ? closePhone() : openPhone(); }
  function closePhone() { phone.classList.remove("open"); }
  function openPhone(view) {
    phone.classList.add("open");
    phoneView = view || "home";
    renderPhone();
    void loadMessages();
  }
  /* A world can open the phone straight to an app — the post office counter
     opens Messages, the diner booth opens People. */
  shell.openPhone = openPhone;
  shell.closePhone = closePhone;

  function renderPhone() {
    const title = phoneView === "home" ? "Phone"
      : phoneView === "messages" ? "Messages"
      : phoneView === "thread" ? (people.get(phoneThread) || "Message")
      : phoneView === "people" ? "People here"
      : "Worlds";
    phone.innerHTML =
      `<div class="hbs-phead"><span>${esc(title)}</span><span>` +
      (phoneView === "home" ? "" : `<button class="hbs-pill" data-a="back">‹</button> `) +
      `<button class="hbs-pill" data-a="close">×</button></span></div>` +
      `<div class="hbs-pbody">${phoneBody()}</div>` +
      (phoneView === "thread" || phoneView === "messages" ? composer() : "");

    phone.querySelectorAll("[data-a]").forEach((n) => n.addEventListener("click", () => {
      const a = n.dataset.a;
      if (a === "close") return closePhone();
      if (a === "back") { phoneView = phoneView === "thread" ? "messages" : "home"; return renderPhone(); }
      if (a === "app") { phoneView = n.dataset.app; return renderPhone(); }
      if (a === "thread") { phoneThread = n.dataset.id; phoneView = "thread"; return renderPhone(); }
      if (a === "send") return void sendMessage();
    }));
  }

  function phoneBody() {
    if (phoneView === "home") {
      const unread = messages.length;
      return `<div class="hbs-apps">
        ${app("messages", "✉", "Messages", unread)}
        ${app("people", "☻", "People")}
        ${app("worlds", "◍", "Worlds")}
      </div>
      <div class="hbs-note">Signed in as ${esc(shell.displayName || "a guest")}. Your character and your messages follow you into every world.</div>`;
    }
    if (phoneView === "people") {
      const live = [...shell.peers.values()];
      if (!live.length) return `<div class="hbs-empty">Nobody else is here right now.</div>`;
      return live.map((p) => `<div class="hbs-row"><span>${esc(p.name)}</span><span style="color:#7ce38b">here</span></div>`).join("");
    }
    if (phoneView === "worlds") {
      return [["Town Square", "/engine/hub/"], ["World 2 · the city", "/world2/"], ["Ashgrove", "/world3/"]]
        .map(([n, u]) => `<div class="hbs-row"><span>${esc(n)}</span><a class="hbs-link" href="${u}">go</a></div>`).join("");
    }
    if (!shell.session) {
      return `<div class="hbs-empty"><div>Messages require a signed-in account.</div><a class="hbs-link" href="/admin">Sign in</a></div>`;
    }
    if (phoneView === "messages") {
      if (!messages.length) return `<div class="hbs-empty">No conversations yet. Pick someone below and send the first real message.</div>`;
      const seen = new Set(); const rows = [];
      for (const m of messages) {
        const other = m.sender_id === shell.uid ? m.recipient_id : m.sender_id;
        if (seen.has(other)) continue;
        seen.add(other);
        rows.push(`<button class="hbs-conv" data-a="thread" data-id="${esc(other)}">
          <b>${esc(people.get(other) || "Someone")}</b>
          <span class="t">${new Date(m.created_at).toLocaleDateString()}</span>
          <span class="p">${esc(m.body)}</span></button>`);
      }
      return rows.join("");
    }
    const thread = messages
      .filter((m) => m.sender_id === phoneThread || m.recipient_id === phoneThread)
      .slice().reverse();
    return thread.map((m) =>
      `<div class="hbs-msg ${m.sender_id === shell.uid ? "me" : "them"}">${esc(m.body)}</div>`).join("");
  }

  function app(id, glyph, label, badge) {
    return `<button class="hbs-app" data-a="app" data-app="${id}">
      <span class="g">${glyph}</span>${badge ? `<span class="badge">${badge}</span>` : ""}
      <span>${label}</span></button>`;
  }

  function composer() {
    if (!shell.session) return "";
    const picker = phoneView === "messages"
      ? `<select id="hbsTo"><option value="">Choose a person…</option>` +
        [...people.entries()].filter(([id]) => id !== shell.uid)
          .map(([id, n]) => `<option value="${esc(id)}">${esc(n)}</option>`).join("") + `</select>`
      : "";
    return `<div class="hbs-foot">${picker}
      <textarea id="hbsBody" maxlength="4000" placeholder="Write a message…"></textarea>
      <button class="hbs-send" data-a="send">Send</button></div>`;
  }

  async function loadMessages() {
    if (!shell.supa || !shell.session) return;
    try {
      const [{ data: pr }, { data: ms }] = await Promise.all([
        shell.supa.from("people").select("auth_user_id, display_name, handle"),
        shell.supa.from("messages").select("*").order("created_at", { ascending: false }).limit(120),
      ]);
      people.clear();
      (pr || []).forEach((p) => p.auth_user_id && people.set(p.auth_user_id, p.display_name || p.handle || "Someone"));
      messages = ms || [];
      if (phone.classList.contains("open")) renderPhone();
    } catch (_) { /* offline is not an error worth shouting about */ }
  }

  async function sendMessage() {
    const body = ($("hbsBody") || {}).value || "";
    const to = phoneView === "thread" ? phoneThread : (($("hbsTo") || {}).value || "");
    if (!body.trim() || !to || !shell.session) return;
    const btn = phone.querySelector(".hbs-send"); if (btn) btn.disabled = true;
    try {
      await shell.supa.from("messages").insert({
        sender_id: shell.uid, recipient_id: to,
        sender_handle: shell.handle || shell.displayName,
        recipient_handle: people.get(to) || "",
        body: body.trim(),
      });
      phoneThread = to; phoneView = "thread";
      await loadMessages();
      renderPhone();
    } catch (_) { if (btn) btn.disabled = false; }
  }

  /* ------------------------------------------------------------- menu - */
  function toggleMenu() { menu.classList.contains("open") ? closeMenu() : openMenu(); }
  function closeMenu() { menu.classList.remove("open"); }
  function openMenu() { menu.classList.add("open"); renderMenu(); }
  function isPanelOpen() { return phone.classList.contains("open") || menu.classList.contains("open"); }

  const SHIRTS = ["#4fa3ff", "#5fd38d", "#f6b45b", "#e36d7c", "#a67cff", "#47c7b8"];
  const SKINS  = ["#f4d4b8", "#e0b48c", "#c8a07a", "#a9794f", "#7a5230", "#4a3322"];
  const HAIRS  = ["#2c2420", "#5a3a22", "#8a6a3a", "#d3a84a", "#a23a26", "#cfd6db"];
  const PANTS  = ["#3a4654", "#23262b", "#6b4f3a", "#46563a", "#6a6f78", "#7a3a4a"];

  function renderMenu() {
    const s = shell.settings, a = shell.appearance;
    menu.innerHTML =
      `<div class="hbs-phead"><span>Settings</span><button class="hbs-pill" data-a="close">×</button></div>
       <div class="hbs-pbody">
         <div class="hbs-row"><span>Sensitivity</span><input type="range" id="hbsSens" min="0.4" max="3" step="0.1" value="${s.sensitivity}"></div>
         <div class="hbs-row"><span>FOV</span><input type="range" id="hbsFov" min="62" max="92" step="1" value="${s.fov}"></div>
         <div class="hbs-row"><span>Invert Y</span><input type="checkbox" id="hbsInv" ${s.invertY ? "checked" : ""}></div>
         <div class="hbs-lab">Character</div>
         <div class="hbs-seg" id="hbsBuild">${["slim", "regular", "broad"].map((b) =>
            `<button data-build="${b}" class="${a.build === b ? "sel" : ""}">${b[0].toUpperCase() + b.slice(1)}</button>`).join("")}</div>
         ${swatchRow("Shirt", "shirt", SHIRTS, a.shirt)}
         ${swatchRow("Skin", "skin", SKINS, a.skin)}
         ${swatchRow("Hair", "hair", HAIRS, a.hair)}
         ${swatchRow("Pants", "pants", PANTS, a.pants)}
         <div class="hbs-note">${shell.session
            ? "Saved to your account — the same body in every world."
            : `<a class="hbs-link" href="/admin">Sign in</a> to keep this character across worlds.`}</div>
         <div class="hbs-lab">World</div>
         <div class="hbs-row"><span>Developer tools</span><input type="checkbox" id="hbsDev" ${s.dev ? "checked" : ""}></div>
         <div class="hbs-note">Inspect, edit, orbit and tour. Off by default — they are not player controls.</div>
         <div class="hbs-row"><a class="hbs-link" href="${opts.gateUrl}">Leave ${esc(opts.worldLabel)}</a></div>
       </div>`;

    menu.querySelector('[data-a="close"]').addEventListener("click", closeMenu);
    wire("hbsSens", "sensitivity", parseFloat);
    wire("hbsFov", "fov", parseFloat);
    wire("hbsInv", "invertY", null, true);
    wire("hbsDev", "dev", null, true);
    menu.querySelectorAll("#hbsBuild button").forEach((b) => b.addEventListener("click", () => {
      shell.appearance.build = b.dataset.build; renderMenu(); saveCharacterSoon();
    }));
    menu.querySelectorAll("[data-swatch]").forEach((b) => b.addEventListener("click", () => {
      shell.appearance[b.dataset.swatch] = b.dataset.color; renderMenu(); saveCharacterSoon();
    }));
  }

  function swatchRow(label, key, colors, current) {
    return `<div class="hbs-lab">${label}</div><div class="hbs-sw">` +
      colors.map((c) => `<button data-swatch="${key}" data-color="${c}" style="background:${c}" class="${c === current ? "sel" : ""}"></button>`).join("") +
      `</div>`;
  }

  function wire(id, key, cast, isCheck) {
    const n = $(id); if (!n) return;
    n.addEventListener("input", () => {
      shell.settings[key] = isCheck ? n.checked : (cast ? cast(n.value) : n.value);
      saveSettings(shell.settings);
      opts.onSettings(shell.settings);
    });
  }

  function loadSettings() {
    let s = { sensitivity: 1, fov: 74, invertY: false, dev: false };
    try { Object.assign(s, JSON.parse(localStorage.getItem("hb-shell-settings") || "{}")); } catch (_) {}
    return s;
  }
  function saveSettings(s) { try { localStorage.setItem("hb-shell-settings", JSON.stringify(s)); } catch (_) {} }

  /* ------------------------------------------------------------- auth - */
  let saveTimer = null;
  function saveCharacterSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void saveCharacter(), 900);
  }

  async function saveCharacter() {
    if (!shell.supa || !shell.session) return;
    try {
      await shell.supa.from("world_characters").upsert({
        auth_user_id: shell.uid,
        display_name: shell.displayName,
        appearance: shell.appearance,
        presence: "present",
        location: shell.place || opts.worldLabel,
        last_world: opts.world,
        last_seen_at: new Date().toISOString(),
      }, { onConflict: "auth_user_id" });
    } catch (_) {}
  }

  async function connect() {
    const mod = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
    shell.supa = mod.createClient(SUPA_URL, SUPA_KEY, {
      realtime: { params: { eventsPerSecond: 24 } },
    });

    const { data: auth } = await shell.supa.auth.getSession();
    shell.session = auth && auth.session ? auth.session : null;
    shell.uid = shell.session ? shell.session.user.id : null;

    if (shell.uid) {
      const { data: ch } = await shell.supa.from("world_characters")
        .select("display_name, appearance, worlds_visited").eq("auth_user_id", shell.uid).maybeSingle();
      if (ch) {
        shell.displayName = sanitizeName(ch.display_name) || "Resident";
        if (ch.appearance && typeof ch.appearance === "object" && Object.keys(ch.appearance).length) {
          Object.assign(shell.appearance, ch.appearance);
        }
        /* record that this account has now walked this world */
        const seen = new Set([...(ch.worlds_visited || []), opts.world]);
        shell.supa.from("world_characters")
          .update({ worlds_visited: [...seen], last_world: opts.world })
          .eq("auth_user_id", shell.uid).then(() => {}, () => {});
      } else {
        shell.displayName = sanitizeName((shell.session.user.email || "").split("@")[0]) || "Resident";
      }
      const { data: p } = await shell.supa.from("people")
        .select("handle").eq("auth_user_id", shell.uid).maybeSingle();
      shell.handle = (p && p.handle) || "";
      void saveCharacter();
    } else {
      shell.displayName = "Guest " + idChunk().slice(0, 4).toUpperCase();
    }

    cName.textContent = shell.displayName;
    shell.selfKey = shell.uid || ("guest-" + idChunk());
    joinChannel();
    void loadMessages();
  }

  /* ---------------------------------------------------------------- net - */
  function joinChannel() {
    if (shell.channel) return;
    const ch = shell.supa.channel("hb-" + opts.world, {
      config: { presence: { key: shell.selfKey } },
    });

    ch.on("broadcast", { event: "state" }, ({ payload }) => {
      if (!payload || payload.id === shell.selfKey) return;
      const now = performance.now();
      let p = shell.peers.get(payload.id);
      if (!p) { p = { id: payload.id, buf: [] }; shell.peers.set(payload.id, p); }
      p.name = payload.name; p.appearance = payload.appearance;
      p.color = payload.color; p.place = payload.place;
      /* buffered hold: keep a short history and render INTERP_DELAY_MS behind
         so a dropped packet reads as smooth motion rather than a teleport */
      p.buf.push({ t: now, x: payload.x, y: payload.y, z: payload.z, yaw: payload.yaw, pitch: payload.pitch, stance: payload.stance });
      if (p.buf.length > 12) p.buf.shift();
      p.last = now;
    });

    /* A general world-event lane, separate from the movement lane.
       Movement is high-frequency, lossy and fine to drop; a door opening is
       rare and must not be. Worlds publish through shell.send(kind, data) and
       subscribe with shell.on(kind, fn). Doors use it now; trash, vehicles
       and the bus are the same shape. Own messages are filtered out here so a
       world never has to check. */
    ch.on("broadcast", { event: "world" }, ({ payload }) => {
      if (!payload || payload.from === shell.selfKey) return;
      const list = worldHandlers[payload.kind];
      if (list) for (const fn of list) { try { fn(payload, payload.from); } catch (_) {} }
    });

    /* presence carries IDENTITY ONLY — never movement. See law 1 at the top. */
    ch.on("presence", { event: "sync" }, syncPresence);
    ch.on("presence", { event: "join" }, syncPresence);
    ch.on("presence", { event: "leave" }, ({ leftPresences }) => {
      (leftPresences || []).forEach((m) => shell.peers.delete(m.key || m.id));
      syncPresence();
    });

    ch.subscribe((status) => {
      shell.connected = status === "SUBSCRIBED";
      cStatus.textContent = shell.connected ? "online" : "connecting";
      cStatus.classList.toggle("on", shell.connected);
      if (!shell.connected) return;
      /* one track call, at join. Never again from the movement cycle. */
      ch.track({ id: shell.selfKey, name: shell.displayName, world: opts.world, at: Date.now() });
      if (shell.session) {
        shell.supa.rpc("touch_world", { p_world: opts.world }).then(() => {}, () => {});
      }
    });

    shell.channel = ch;
  }

  function syncPresence() {
    if (!shell.channel) return;
    let live = 0;
    const state = shell.channel.presenceState();
    for (const k in state) live += 1;
    cCount.textContent = live + " live";
  }

  /* one send loop, rate-capped and idle-suppressed (law 2) */
  let sendAcc = 0, lastSig = "", lastSentAt = 0;
  function pump(dt) {
    sendAcc += dt;
    if (sendAcc < SEND_INTERVAL) return;
    sendAcc = 0;
    if (!shell.connected || !shell.channel) return;
    const s = opts.getState();
    if (!s) return;
    const sig = [s.x, s.y, s.z].map((n) => n.toFixed(2)).join("|") + "|" +
                (s.yaw || 0).toFixed(1) + "|" + (s.pitch || 0).toFixed(1) + "|" + (s.stance || "") + "|" + (s.place || "");
    const now = performance.now();
    if (sig === lastSig && now - lastSentAt < IDLE_KEEPALIVE_MS) return;
    lastSig = sig; lastSentAt = now;
    shell.channel.send({
      type: "broadcast", event: "state",
      payload: {
        id: shell.selfKey, name: shell.displayName, appearance: shell.appearance,
        color: PEER_COLORS[Math.abs(hash(shell.selfKey)) % PEER_COLORS.length],
        x: s.x, y: s.y, z: s.z, yaw: s.yaw || 0, pitch: s.pitch || 0,
        stance: s.stance || "stand", place: s.place || "",
      },
    });
  }

  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h | 0; }

  /* ------------------------------------------------------ world events - */
  const worldHandlers = Object.create(null);

  /* Publish something every other client in this world should know about.
     Unlike movement this is not rate-capped or idle-suppressed: these are
     discrete facts, and dropping one leaves two players disagreeing. */
  shell.send = function (kind, data) {
    if (!shell.connected || !shell.channel) return false;
    shell.channel.send({
      type: "broadcast", event: "world",
      payload: Object.assign({ kind, from: shell.selfKey }, data || {}),
    });
    return true;
  };

  shell.on = function (kind, fn) {
    (worldHandlers[kind] || (worldHandlers[kind] = [])).push(fn);
    return () => {
      const l = worldHandlers[kind];
      if (l) worldHandlers[kind] = l.filter((f) => f !== fn);
    };
  };

  /* Peers, sampled INTERP_DELAY_MS in the past and interpolated. */
  function sample() {
    const target = performance.now() - INTERP_DELAY_MS;
    const out = [];
    for (const p of shell.peers.values()) {
      if (performance.now() - p.last > 25000) { shell.peers.delete(p.id); continue; }
      const b = p.buf;
      if (!b.length) continue;
      let a = b[0], c = b[b.length - 1];
      for (let i = 0; i < b.length - 1; i++) {
        if (b[i].t <= target && b[i + 1].t >= target) { a = b[i]; c = b[i + 1]; break; }
      }
      const span = Math.max(1, c.t - a.t);
      const k = clamp((target - a.t) / span, 0, 1);
      out.push({
        id: p.id, name: p.name, color: p.color, appearance: p.appearance, place: p.place,
        x: a.x + (c.x - a.x) * k, y: a.y + (c.y - a.y) * k, z: a.z + (c.z - a.z) * k,
        yaw: a.yaw + angleDelta(a.yaw, c.yaw) * k, pitch: a.pitch, stance: c.stance,
      });
    }
    return out;
  }
  function angleDelta(a, b) { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; }

  shell.frame = function (dt) {
    pump(dt);
    opts.onPeers(sample());
  };

  addEventListener("beforeunload", () => {
    try { shell.channel && shell.channel.untrack(); } catch (_) {}
    if (shell.supa && shell.session) {
      try { shell.supa.from("world_characters").update({ presence: "away" }).eq("auth_user_id", shell.uid); } catch (_) {}
    }
  });

  /* keyboard parity, desktop */
  addEventListener("keydown", (e) => {
    if (e.target.matches("input,textarea,select")) return;
    const k = e.key.toLowerCase();
    if (k === "e") opts.onAction("use");
    else if (k === " ") opts.onAction("jump");
    else if (k === "escape") { closePhone(); closeMenu(); }
  });

  void connect().catch(() => { cStatus.textContent = "offline"; });
  opts.onSettings(shell.settings);
  /* One mounted shell per page. Exposed so a world, a console or a test can
     read who is connected and where they are without reaching into a closure. */
  HBShell.current = shell;
  return shell;
};

window.HBShell = HBShell;
})();
