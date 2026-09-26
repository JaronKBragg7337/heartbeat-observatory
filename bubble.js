/* Heartbeat Observatory - the Phone (v2, 2026-09-26, Claude Code).
   One phone for the whole site, replacing the old "M" messages bubble (kept as bubble-legacy.js) and, next, Ashgrove's shell
   phone. Jaron: "a realistic phone ... it would pull out in front of them and have apps on it: messaging, phone calls, social
   media, a library, the Heartbeat TV app." Every app is a small entry in APPS below - add one there.

   Loaded on every page by tools/stamp-shared.mjs. In games and 3D worlds the launcher is a slim tab on the right edge so it
   never covers game controls. Inside an iframe (a page shown inside the phone, or a game shown inside a page) it does nothing.
   Other code can open it: window.HBPhone.open("messages" | "tv" | ...). Messages use the real accounts tables. */
(function () {
  if (window.__hbBubble || window.top !== window) return;
  window.__hbBubble = true;

  var SUPABASE_URL = "https://ygjpnvrwhkrowkrskftk.supabase.co";
  var SUPABASE_KEY = "sb_publishable_Y-duV64ayMMEvVwMs5PWuw_6kvzbOrN";
  var inWorld = /^\/(engine|games\/[^/]+\/|PCGames\/[^/]+\/|world2|world3|worlds-lab\/(worlds|coming-soon|starter)|island|space|video\/3d|3DPrinterAsset|HeartbeatCenter|chat-neighborhood|live-systems\/flies\/brain|homes)/.test(location.pathname);

  // ---- the apps (order = home screen order; dock = the bottom row) ----
  var I = {
    messages: '<path d="M4 5.5C4 4.1 5.1 3 6.5 3h11C18.9 3 20 4.1 20 5.5v8c0 1.4-1.1 2.5-2.5 2.5H10l-4.2 3.3c-.5.4-1.3 0-1.3-.6V16.8A2.5 2.5 0 0 1 4 14.3z"/>',
    phone: '<path d="M6.6 3.2 9 3a1 1 0 0 1 1 .7l1 3a1 1 0 0 1-.3 1.1L9.3 9.1a12 12 0 0 0 5.6 5.6l1.3-1.4a1 1 0 0 1 1.1-.3l3 1a1 1 0 0 1 .7 1l-.2 2.4a2 2 0 0 1-2 1.8A15.2 15.2 0 0 1 4.8 5.2a2 2 0 0 1 1.8-2z"/>',
    tv: '<rect x="3" y="5" width="18" height="12" rx="2.2"/><path d="M8 20h8M9 2.5l3 2.5 3-2.5" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>',
    news: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M6.5 8h11M6.5 11.5h7M6.5 15h9" stroke="rgba(0,0,0,.35)" stroke-width="1.6" stroke-linecap="round"/>',
    social: '<circle cx="8" cy="9" r="3.2"/><circle cx="16.5" cy="10" r="2.6"/><path d="M2.5 19c.6-3.2 3-5 5.5-5s4.9 1.8 5.5 5zM13.2 19c.4-2.3 2-3.8 3.8-3.8s3.4 1.4 3.9 3.8z"/>',
    library: '<path d="M4 4.5h4v15H4zM9.5 4.5h4v15h-4zM15.2 5.3l3.8-1 3.1 14.3-3.8.9z"/>',
    crew: '<rect x="5" y="7" width="14" height="11" rx="3"/><circle cx="9.5" cy="12" r="1.5" fill="rgba(0,0,0,.45)"/><circle cx="14.5" cy="12" r="1.5" fill="rgba(0,0,0,.45)"/><path d="M12 7V3.8M10.5 3.5h3" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>',
    games: '<path d="M7.5 8h9a4.5 4.5 0 0 1 4.3 5.8l-1 3.4a2 2 0 0 1-3.4.8L14 15.5h-4L7.6 18a2 2 0 0 1-3.4-.8l-1-3.4A4.5 4.5 0 0 1 7.5 8z"/><path d="M8 10.5v3M6.5 12h3" stroke="rgba(0,0,0,.4)" stroke-width="1.5" stroke-linecap="round"/><circle cx="16" cy="11" r="1" fill="rgba(0,0,0,.4)"/><circle cx="17.5" cy="13" r="1" fill="rgba(0,0,0,.4)"/>',
    worlds: '<circle cx="12" cy="12" r="8.5"/><path d="M3.8 12h16.4M12 3.5c2.6 2.4 2.6 14.6 0 17M12 3.5c-2.6 2.4-2.6 14.6 0 17" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="1.4"/>',
    livi: '<circle cx="12" cy="12.5" r="7.5"/><circle cx="9.3" cy="11.5" r="1.4" fill="#0b2a44"/><circle cx="14.7" cy="11.5" r="1.4" fill="#0b2a44"/><path d="M10 15.2c1.2.9 2.8.9 4 0" stroke="#0b2a44" stroke-width="1.3" fill="none" stroke-linecap="round"/>',
    theater: '<path d="M4 6c3 1.2 5 1.2 8 0v9.5C12 18 10 20 8 20s-4-2-4-4.5zM12 6c3 1.2 5 1.2 8 0v9.5C20 18 18 20 16 20s-4-2-4-4.5z"/>',
    home: '<path d="M3.5 11.2 12 4l8.5 7.2V20a1 1 0 0 1-1 1h-5v-5.5h-5V21h-5a1 1 0 0 1-1-1z"/>',
    settings: '<circle cx="12" cy="12" r="3.2" fill="rgba(0,0,0,.35)"/><path d="M12 2.8l1.6 2.4 2.8-.8.6 2.8 2.8.6-.8 2.8 2.4 1.6-2.4 1.6.8 2.8-2.8.6-.6 2.8-2.8-.8L12 21.2l-1.6-2.4-2.8.8-.6-2.8-2.8-.6.8-2.8L2.8 12l2.4-1.6-.8-2.8 2.8-.6.6-2.8 2.8.8z" fill-rule="evenodd"/>'
  };
  var APPS = [
    { id: "tv", name: "HB TV", bg: "linear-gradient(160deg,#ff3b4e,#8f0b17)", icon: I.tv },
    { id: "news", name: "News", bg: "linear-gradient(160deg,#1d4ed8,#0b1f4d)", icon: I.news, url: "/news/" },
    { id: "social", name: "Social", bg: "linear-gradient(160deg,#22c55e,#0f5132)", icon: I.social, url: "/social/" },
    { id: "library", name: "Library", bg: "linear-gradient(160deg,#d6a354,#6b4a14)", icon: I.library, url: "/library/" },
    { id: "games", name: "Games", bg: "linear-gradient(160deg,#a855f7,#4c1d95)", icon: I.games, url: "/games/" },
    { id: "worlds", name: "Worlds", bg: "linear-gradient(160deg,#14b8a6,#115e59)", icon: I.worlds, url: "/worlds-lab/" },
    { id: "livi", name: "Livi", bg: "linear-gradient(160deg,#7dd3fc,#6366f1)", icon: I.livi, url: "https://livi-organism.vercel.app/" },
    { id: "crew", name: "The Crew", bg: "linear-gradient(160deg,#475569,#0f172a)", icon: I.crew, url: "/live-systems/crew/" },
    { id: "home", name: "My Loft", bg: "linear-gradient(160deg,#ec4899,#581c87)", icon: I.home, url: "/homes/" },
    { id: "theater", name: "Theater", bg: "linear-gradient(160deg,#f59e0b,#7c2d12)", icon: I.theater, url: "/video/" }
  ];
  var DOCK = [
    { id: "phone", name: "Phone", bg: "linear-gradient(160deg,#4ade80,#15803d)", icon: I.phone },
    { id: "messages", name: "Messages", bg: "linear-gradient(160deg,#4ade80,#16a34a)", icon: I.messages },
    { id: "tv", name: "HB TV", bg: "linear-gradient(160deg,#ff3b4e,#8f0b17)", icon: I.tv },
    { id: "settings", name: "Settings", bg: "linear-gradient(160deg,#9ca3af,#4b5563)", icon: I.settings }
  ];
  // Heartbeat TV channels - the same list the TV page and the Homes TV will use.
  // names only - the TV page (/tv/channels.json) decides what each channel plays
  var CHANNELS = [
    { n: 1, id: "news", name: "Heartbeat News" },
    { n: 2, id: "shows", name: "Shows" },
    { n: 3, id: "movies", name: "Movies", soon: "AI-made films, coming soon" },
    { n: 4, id: "comedy", name: "Comedy", soon: "Coming soon" },
    { n: 5, id: "music", name: "Music", soon: "Music videos, coming soon" },
    { n: 6, id: "aislop", name: "AI Slop", soon: "Your AI-made clips - the best move up to the main channels. Coming soon" }
  ];

  var state = { supabase: null, session: null, me: null, people: new Map(), messages: [], thread: "", loading: true, error: "", unread: 0, app: "home", channel: 1 };

  // ---- styles: a real phone. 71.6 x 147.6 mm (a 6.1" phone) -> width/height 0.485, 9 mm corner radius ----
  var css = document.createElement("style");
  css.textContent = [
    ".hbp-launch{position:fixed;z-index:90000;border:0;cursor:pointer;display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,sans-serif;-webkit-tap-highlight-color:transparent}",
    ".hbp-launch.round{right:calc(18px + env(safe-area-inset-right,0px));bottom:calc(18px + env(safe-area-inset-bottom,0px));width:56px;height:56px;border-radius:50%;background:linear-gradient(160deg,#2d3748,#0b0f14);box-shadow:0 8px 26px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.18)}",
    ".hbp-launch.edge{right:calc(4px + env(safe-area-inset-right,0px));top:56%;transform:translateY(-50%);width:34px;height:58px;border-radius:10px;background:rgba(16,23,28,.85);border:1px solid #2c3a42;opacity:.9}",
    ".hbp-launch svg{width:24px;height:24px;fill:#e8eef3}.hbp-launch.edge svg{width:18px;height:18px}",
    ".hbp-launch .dot{position:absolute;top:6px;right:6px;min-width:17px;height:17px;border-radius:9px;background:#ff3b30;color:#fff;font-size:10px;font-weight:700;display:none;align-items:center;justify-content:center;padding:0 4px}",
    ".hbp-launch .dot.on{display:flex}",
    ".hbp-scrim{position:fixed;inset:0;z-index:90001;background:rgba(0,0,0,0);pointer-events:none;transition:background .35s}",
    ".hbp-scrim.open{background:rgba(0,0,0,.45);pointer-events:auto}",
    ".hbp-stage{position:fixed;z-index:90002;left:50%;bottom:0;perspective:1400px;pointer-events:none}",
    ".hbp-phone{--w:min(372px,92vw,calc(90dvh * .485));width:var(--w);height:calc(var(--w) / .485);position:relative;border-radius:calc(var(--w) * .165);" +
      "background:linear-gradient(145deg,#8a8f98,#3b3f46 22%,#1d2025 50%,#5d626b 78%,#a3a8b1);padding:calc(var(--w) * .028);" +
      "box-shadow:0 30px 80px rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,.08) inset;transform:translate(-50%,105%) rotateX(24deg);transform-origin:50% 100%;" +
      "transition:transform .5s cubic-bezier(.2,.9,.25,1);pointer-events:auto;font-family:-apple-system,'SF Pro Text',system-ui,sans-serif;color:#fff;user-select:none;-webkit-user-select:none}",
    ".hbp-phone.open{transform:translate(-50%,calc(-1 * max(14px, env(safe-area-inset-bottom,0px)))) rotateX(0deg)}",
    ".hbp-btn-side{position:absolute;width:3px;border-radius:2px;background:#6b7079}",
    ".hbp-screen{position:absolute;inset:calc(var(--w) * .028);border-radius:calc(var(--w) * .14);overflow:hidden;background:#000}",
    ".hbp-wall{position:absolute;inset:0;background:radial-gradient(120% 70% at 20% 10%,#3b1f6b 0%,transparent 60%),radial-gradient(90% 60% at 90% 90%,#0e5a73 0%,transparent 60%),linear-gradient(180deg,#120a24,#04121b)}",
    ".hbp-island{position:absolute;top:calc(var(--w) * .03);left:50%;transform:translateX(-50%);width:calc(var(--w) * .3);height:calc(var(--w) * .088);border-radius:99px;background:#000;z-index:5}",
    ".hbp-status{position:absolute;top:0;left:0;right:0;height:calc(var(--w) * .15);display:flex;align-items:center;justify-content:space-between;padding:0 calc(var(--w) * .085);font-size:calc(var(--w) * .043);font-weight:600;z-index:4;pointer-events:none}",
    ".hbp-status .r{display:flex;gap:5px;align-items:center}.hbp-bars{display:flex;gap:1.5px;align-items:flex-end;height:11px}.hbp-bars i{width:3px;background:#fff;border-radius:1px}",
    ".hbp-batt{width:24px;height:11px;border:1.5px solid rgba(255,255,255,.6);border-radius:3.5px;position:relative;padding:1px}.hbp-batt b{display:block;height:100%;background:#fff;border-radius:1.5px}",
    ".hbp-batt:after{content:'';position:absolute;right:-4px;top:3px;width:2px;height:4px;border-radius:0 1px 1px 0;background:rgba(255,255,255,.6)}",
    ".hbp-home{position:absolute;inset:calc(var(--w) * .17) 0 calc(var(--w) * .3);display:grid;grid-template-columns:repeat(4,1fr);align-content:start;row-gap:calc(var(--w) * .06);padding:0 calc(var(--w) * .055)}",
    ".hbp-app{display:flex;flex-direction:column;align-items:center;gap:6px;background:none;border:0;color:#fff;cursor:pointer;padding:0;font-size:calc(var(--w) * .031);-webkit-tap-highlight-color:transparent}",
    ".hbp-ico{width:calc(var(--w) * .165);height:calc(var(--w) * .165);border-radius:calc(var(--w) * .038);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 10px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.25);position:relative;transition:transform .12s}",
    ".hbp-app:active .hbp-ico{transform:scale(.9)}.hbp-ico svg{width:58%;height:58%;fill:#fff}",
    ".hbp-ico .dot{position:absolute;top:-5px;right:-5px;min-width:19px;height:19px;border-radius:10px;background:#ff3b30;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 5px}",
    ".hbp-dock{position:absolute;left:calc(var(--w) * .035);right:calc(var(--w) * .035);bottom:calc(var(--w) * .07);height:calc(var(--w) * .225);border-radius:calc(var(--w) * .085);background:rgba(255,255,255,.16);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);display:flex;justify-content:space-around;align-items:center}",
    ".hbp-dock .hbp-app > span:not(.hbp-ico){display:none}",
    ".hbp-bar{position:absolute;bottom:calc(var(--w) * .022);left:50%;transform:translateX(-50%);width:calc(var(--w) * .36);height:5px;border-radius:3px;background:rgba(255,255,255,.85);z-index:9;cursor:pointer}",
    ".hbp-view{position:absolute;inset:0;background:#0b0f14;z-index:3;display:flex;flex-direction:column;transform:scale(.3);opacity:0;pointer-events:none;transition:transform .32s cubic-bezier(.2,.9,.25,1),opacity .2s;border-radius:inherit}",
    ".hbp-view.on{transform:none;opacity:1;pointer-events:auto}",
    ".hbp-top{padding:calc(var(--w) * .15) 14px 8px;display:flex;align-items:center;gap:10px;border-bottom:1px solid rgba(255,255,255,.08);background:#10151b}",
    ".hbp-top h4{margin:0;font-size:calc(var(--w) * .05);font-weight:700;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".hbp-top button{background:none;border:0;color:#3b9bff;font-size:calc(var(--w) * .043);cursor:pointer;padding:4px}",
    ".hbp-body{flex:1;overflow:auto;-webkit-overflow-scrolling:touch}",
    ".hbp-frame{flex:1;border:0;width:100%;background:#000}",
    ".hbp-row{display:flex;gap:12px;align-items:center;padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.06);background:none;border-left:0;border-right:0;border-top:0;color:#fff;width:100%;text-align:left;cursor:pointer;font:inherit}",
    ".hbp-av{width:40px;height:40px;border-radius:50%;background:linear-gradient(160deg,#64748b,#334155);display:flex;align-items:center;justify-content:center;font-weight:700;flex:0 0 auto}",
    ".hbp-row .t{flex:1;min-width:0}.hbp-row .n{font-weight:600;font-size:15px}.hbp-row .p{font-size:13px;color:#9aa7b3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hbp-row .w{font-size:12px;color:#7d8896}",
    ".hbp-thread{padding:12px;display:flex;flex-direction:column;gap:6px}",
    ".hbp-msg{max-width:78%;padding:8px 12px;border-radius:18px;font-size:15px;line-height:1.35;overflow-wrap:anywhere}",
    ".hbp-msg.me{align-self:flex-end;background:#0a84ff;border-bottom-right-radius:5px}.hbp-msg.them{align-self:flex-start;background:#262a30;border-bottom-left-radius:5px}",
    ".hbp-compose{display:flex;gap:8px;padding:8px 10px calc(var(--w) * .07);border-top:1px solid rgba(255,255,255,.08);background:#10151b}",
    ".hbp-compose input,.hbp-compose select{flex:1;min-width:0;background:#1c2229;border:1px solid #2b333c;color:#fff;border-radius:18px;padding:9px 13px;font-size:16px}",
    ".hbp-compose button{background:#0a84ff;border:0;color:#fff;border-radius:50%;width:38px;height:38px;font-size:18px;cursor:pointer;flex:0 0 auto}",
    ".hbp-empty{padding:30px 20px;text-align:center;color:#9aa7b3;font-size:14px;line-height:1.5}.hbp-empty a{color:#3b9bff}",
    ".hbp-tv{flex:1;display:flex;flex-direction:column;background:#000}.hbp-tv .scr{position:relative;flex:1;background:#000}",
    ".hbp-tv .scr iframe{position:absolute;inset:0;width:100%;height:100%;border:0}",
    ".hbp-tv .soon{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:20px;background:repeating-linear-gradient(0deg,#111 0 2px,#161616 2px 4px);color:#cbd5e1}",
    ".hbp-tv .soon b{font-size:22px;color:#fff;margin-bottom:6px}",
    ".hbp-remote{display:flex;gap:6px;padding:8px 8px calc(var(--w) * .07);overflow-x:auto;background:#0b0f14;border-top:1px solid rgba(255,255,255,.08)}",
    ".hbp-remote button{flex:0 0 auto;background:#1c2229;border:1px solid #2b333c;color:#e2e8f0;border-radius:12px;padding:8px 11px;font-size:13px;cursor:pointer}",
    ".hbp-remote button.on{background:#ff3b4e;border-color:#ff3b4e;color:#fff}",
    "html.hbp-open [data-hb-editor]{display:none!important}",
    ".hbp-call{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:calc(var(--w) * .2) 20px calc(var(--w) * .12);background:radial-gradient(80% 50% at 50% 20%,#1f3a5a,#07090d)}",
    ".hbp-call .who{text-align:center}.hbp-call .big{width:calc(var(--w) * .3);height:calc(var(--w) * .3);border-radius:50%;margin:0 auto 14px;background:linear-gradient(160deg,#64748b,#1e293b);display:flex;align-items:center;justify-content:center;font-size:calc(var(--w) * .13);font-weight:700}",
    ".hbp-call h3{margin:0;font-size:calc(var(--w) * .075);font-weight:600}.hbp-call .st{margin-top:6px;color:#9aa7b3;font-size:15px}",
    ".hbp-call .keys{display:flex;gap:calc(var(--w) * .1);justify-content:center}",
    ".hbp-call .k{width:calc(var(--w) * .2);height:calc(var(--w) * .2);border-radius:50%;border:0;color:#fff;font-size:13px;font-weight:600;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;background:rgba(255,255,255,.14)}",
    ".hbp-call .k.end{background:#ff3b30}.hbp-call .k.ok{background:#34c759}.hbp-call .k.on{background:#fff;color:#000}",
    ".hbp-call .k svg{width:42%;height:42%;fill:currentColor}",
    ".hbp-row .call{margin-left:auto;background:#34c759;border:0;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;cursor:pointer;flex:0 0 auto}.hbp-row .call svg{width:18px;height:18px;fill:#fff}",
    ".hbp-chip{position:absolute;top:10px;left:10px;background:rgba(0,0,0,.6);padding:4px 9px;border-radius:8px;font-size:12px;font-weight:700;z-index:2;pointer-events:none}"
  ].join("");
  document.head.appendChild(css);

  function esc(v) { var d = document.createElement("div"); d.textContent = v == null ? "" : String(v); return d.innerHTML; }
  function svg(p) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + p + "</svg>"; }
  function ago(iso) {
    var s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    return s < 60 ? "now" : s < 3600 ? Math.floor(s / 60) + "m" : s < 86400 ? Math.floor(s / 3600) + "h" : new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
  }
  function nameFor(id) { var p = state.people.get(id); return p ? ((p.display_name && p.display_name.trim()) || p.handle || "Member") : "Member"; }

  // ---- build the device ----
  var launch = document.createElement("button");
  launch.className = "hbp-launch " + (inWorld ? "edge" : "round");
  launch.setAttribute("aria-label", "Open phone");
  launch.innerHTML = svg('<rect x="6.5" y="2" width="11" height="20" rx="2.6"/><rect x="8.2" y="4.2" width="7.6" height="14.4" rx="1" fill="#0b0f14"/><rect x="10.3" y="19.5" width="3.4" height="1" rx=".5" fill="#0b0f14"/>') + '<span class="dot"></span>';
  var scrim = document.createElement("div"); scrim.className = "hbp-scrim";
  var stage = document.createElement("div"); stage.className = "hbp-stage";
  var phone = document.createElement("div"); phone.className = "hbp-phone"; phone.setAttribute("role", "dialog"); phone.setAttribute("aria-label", "Phone");
  phone.innerHTML =
    '<span class="hbp-btn-side" style="left:-2px;top:19%;height:4%"></span><span class="hbp-btn-side" style="left:-2px;top:27%;height:8%"></span>' +
    '<span class="hbp-btn-side" style="left:-2px;top:37%;height:8%"></span><span class="hbp-btn-side" style="right:-2px;top:28%;height:12%"></span>' +
    '<div class="hbp-screen"><div class="hbp-wall"></div><div class="hbp-island"></div>' +
    '<div class="hbp-status"><span class="clock"></span><span class="r"><span class="hbp-bars"><i style="height:4px"></i><i style="height:6px"></i><i style="height:8px"></i><i style="height:11px"></i></span>5G<span class="hbp-batt"><b></b></span></span></div>' +
    '<div class="hbp-home"></div><div class="hbp-dock"></div><div class="hbp-view"></div><div class="hbp-bar" title="Home"></div></div>';
  stage.appendChild(phone);
  var $ = function (sel) { return phone.querySelector(sel); };
  var view = $(".hbp-view");

  function appButton(a) {
    var badge = a.id === "messages" && state.unread ? '<span class="dot">' + state.unread + "</span>" : "";
    return '<button class="hbp-app" data-app="' + a.id + '"><span class="hbp-ico" style="background:' + a.bg + '">' + svg(a.icon) + badge + "</span><span>" + esc(a.name) + "</span></button>";
  }
  function renderHome() { $(".hbp-home").innerHTML = APPS.map(appButton).join(""); $(".hbp-dock").innerHTML = DOCK.map(appButton).join(""); }

  // live status bar: real time, real battery where the browser shares it
  function tick() { $(".clock").textContent = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).replace(/\s?[AP]M/i, ""); }
  tick(); setInterval(tick, 15000);
  try { navigator.getBattery && navigator.getBattery().then(function (b) { var f = function () { $(".hbp-batt b").style.width = Math.round(b.level * 100) + "%"; }; f(); b.addEventListener("levelchange", f); }); } catch (e) {}

  // ---- apps ----
  function top(title, back) {
    return '<div class="hbp-top">' + (back ? '<button data-act="' + back + '">‹ Back</button>' : "") + "<h4>" + esc(title) + "</h4></div>";
  }
  function openApp(id) {
    state.app = id;
    var a = APPS.concat(DOCK).find(function (x) { return x.id === id; });
    if (id === "messages") { state.thread = ""; renderMessages(); }
    else if (id === "tv") renderTV();
    else if (id === "phone") renderContacts();
    else if (id === "settings") view.innerHTML = top("Settings", "home") + '<div class="hbp-body"><div class="hbp-empty">' + (state.session ? "Signed in." : '<a href="/admin">Sign in</a> to message and call.') + '<br><br>Heartbeat Phone v2 · ' + APPS.length + " apps</div></div>";
    else if (a && a.url) view.innerHTML = top(a.name, "home") + '<iframe class="hbp-frame" src="' + a.url + '" allow="autoplay; fullscreen" loading="lazy"></iframe>';
    view.classList.add("on");
  }
  function goHome() { if (call && state.app !== "call") { return renderCall(); } state.app = "home"; view.classList.remove("on"); setTimeout(function () { if (state.app === "home") view.innerHTML = ""; }, 350); renderHome(); }

  function renderContacts() {
    if (!state.session) { view.innerHTML = top("Phone", "home") + '<div class="hbp-body"><div class="hbp-empty">Sign in to call people.<br><br><a href="/admin">Sign in</a></div></div>'; return; }
    var people = Array.from(state.people.values()).filter(function (p) { return p.auth_user_id !== state.me; });
    view.innerHTML = top("Contacts", "home") + '<div class="hbp-body">' + (people.length ? people.map(function (p) {
      var n = nameFor(p.auth_user_id);
      return '<div class="hbp-row"><span class="hbp-av">' + esc(n.charAt(0).toUpperCase()) + '</span><span class="t"><div class="n">' + esc(n) + '</div><div class="p">Heartbeat member</div></span>' +
        '<button class="call" data-call="' + esc(p.auth_user_id) + '" aria-label="Call ' + esc(n) + '">' + svg(I.phone) + "</button></div>";
    }).join("") : '<div class="hbp-empty">No other members yet.</div>') + '<div class="hbp-empty" style="font-size:12px">Calls ring the other person on any page of the site while they are signed in.</div></div>';
  }

  // ---- calls: 1:1 voice, straight between the two browsers (WebRTC). Signaling rides Supabase Realtime broadcast on a
  // channel per account ("hbcall-<user id>"). Public STUN only for now - some cell networks may need a TURN relay later.
  var call = null; // { id, peer, pc, stream, dir, status, t0, muted, pending: [] }
  var ICE = { iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }] };
  var outbox = {};
  function chanFor(uid) {
    if (!outbox[uid]) {
      var ch = state.supabase.channel("hbcall-" + uid, { config: { broadcast: { self: false } } });
      outbox[uid] = { ch: ch, ready: new Promise(function (res) { ch.subscribe(function (st) { if (st === "SUBSCRIBED") res(); }); setTimeout(res, 4000); }) };
    }
    return outbox[uid];
  }
  function signal(uid, payload) {
    payload.from = state.me; payload.name = nameFor(state.me);
    var o = chanFor(uid), tries = 0;
    o.ready.then(function go() { var r = o.ch.send({ type: "broadcast", event: "signal", payload: payload }); if (r && r.then) r.then(function (x) { if (x !== "ok" && tries++ < 8) setTimeout(go, 400); }); });
  }
  var ringTimer = null, ringCtx = null;
  function ring(on) {
    clearInterval(ringTimer); ringTimer = null;
    if (!on) return;
    var beep = function () {
      try { navigator.vibrate && navigator.vibrate([400, 200, 400]); } catch (e) {}
      try {
        ringCtx = ringCtx || new (window.AudioContext || window.webkitAudioContext)();
        [0, 0.45].forEach(function (d) { var o = ringCtx.createOscillator(), g = ringCtx.createGain(); o.frequency.value = 440; o.connect(g); g.connect(ringCtx.destination);
          var t = ringCtx.currentTime + d; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38); o.start(t); o.stop(t + 0.4); });
      } catch (e) {}
    };
    beep(); ringTimer = setInterval(beep, 2400);
  }
  function renderCall() {
    if (!call) return;
    var n = call.name || nameFor(call.peer);
    var st = call.status === "incoming" ? "Heartbeat call…" : call.status === "calling" ? "Calling…" : call.status === "connecting" ? "Connecting…"
      : call.status === "live" ? fmt((Date.now() - call.t0) / 1000) : call.status;
    var keys = call.status === "incoming"
      ? '<button class="k end" data-act="decline">' + svg(I.phone) + 'Decline</button><button class="k ok" data-act="accept">' + svg(I.phone) + "Accept</button>"
      : '<button class="k' + (call.muted ? " on" : "") + '" data-act="mute">' + (call.muted ? "Unmute" : "Mute") + '</button><button class="k end" data-act="hangup">' + svg(I.phone) + "End</button>";
    view.innerHTML = '<div class="hbp-call"><div class="who"><div class="big">' + esc(n.charAt(0).toUpperCase()) + "</div><h3>" + esc(n) + '</h3><div class="st">' + esc(st) + '</div></div><div class="keys">' + keys + "</div></div>";
    state.app = "call"; view.classList.add("on");
  }
  function fmt(sec) { sec = Math.floor(sec); return Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0"); }
  var callTick = null;
  function newPC() {
    var pc = new RTCPeerConnection(ICE);
    pc.onicecandidate = function (e) { if (e.candidate && call) signal(call.peer, { kind: "ice", id: call.id, c: e.candidate }); };
    pc.ontrack = function (e) { var a = document.getElementById("hbp-remote") || document.body.appendChild(Object.assign(document.createElement("audio"), { id: "hbp-remote", autoplay: true })); a.srcObject = e.streams[0]; a.play && a.play().catch(function () {}); };
    pc.onconnectionstatechange = function () {
      if (!call) return;
      if (pc.connectionState === "connected") { call.status = "live"; call.t0 = Date.now(); clearInterval(callTick); callTick = setInterval(renderCall, 1000); renderCall(); }
      if (pc.connectionState === "failed") { endCall("Couldn't connect - the network blocked a direct call.", true); }
    };
    return pc;
  }
  async function startCall(uid) {
    if (call) return;
    try {
      var stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      call = { id: Math.random().toString(36).slice(2), peer: uid, name: nameFor(uid), dir: "out", status: "calling", stream: stream, pending: [] };
      call.pc = newPC(); stream.getTracks().forEach(function (t) { call.pc.addTrack(t, stream); });
      var offer = await call.pc.createOffer(); await call.pc.setLocalDescription(offer);
      signal(uid, { kind: "offer", id: call.id, sdp: offer });
      renderCall();
      call.timeout = setTimeout(function () { if (call && call.status === "calling") { signal(uid, { kind: "end", id: call.id }); endCall("No answer", true); } }, 35000);
    } catch (e) { alert("The phone needs your microphone to call. " + (e.message || "")); cleanup(); }
  }
  async function accept() {
    if (!call) return; ring(false);
    try {
      call.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      call.pc = newPC(); call.stream.getTracks().forEach(function (t) { call.pc.addTrack(t, call.stream); });
      await call.pc.setRemoteDescription(call.offer);
      call.pending.forEach(function (c) { call.pc.addIceCandidate(c).catch(function () {}); }); call.pending = [];
      var ans = await call.pc.createAnswer(); await call.pc.setLocalDescription(ans);
      signal(call.peer, { kind: "answer", id: call.id, sdp: ans });
      call.status = "connecting"; renderCall();
    } catch (e) { signal(call.peer, { kind: "end", id: call.id }); endCall("Microphone blocked", true); }
  }
  function cleanup() {
    ring(false); clearInterval(callTick); clearTimeout(call && call.timeout);
    if (call) { try { call.pc && call.pc.close(); } catch (e) {} if (call.stream) call.stream.getTracks().forEach(function (t) { t.stop(); }); }
    call = null;
  }
  function endCall(msg, linger) {
    if (call && linger) { call.status = msg || "Call ended"; renderCall(); var keep = call; setTimeout(function () { if (call === keep) { cleanup(); goHome(); } }, 1800); ring(false); clearInterval(callTick); try { keep.pc && keep.pc.close(); } catch (e) {} if (keep.stream) keep.stream.getTracks().forEach(function (t) { t.stop(); }); return; }
    cleanup(); goHome();
  }
  async function onSignal(p) {
    if (!p || !p.from) return;
    if (p.kind === "offer") {
      if (call) { signal(p.from, { kind: "busy", id: p.id }); return; }
      call = { id: p.id, peer: p.from, name: p.name, dir: "in", status: "incoming", offer: p.sdp, pending: [] };
      open(); setTimeout(renderCall, 130); ring(true);
      call.timeout = setTimeout(function () { if (call && call.status === "incoming") endCall("Missed call", true); }, 35000);
      return;
    }
    if (!call || p.id !== call.id) return;
    if (p.kind === "answer") { clearTimeout(call.timeout); call.status = "connecting"; await call.pc.setRemoteDescription(p.sdp); call.pending.forEach(function (c) { call.pc.addIceCandidate(c).catch(function () {}); }); call.pending = []; renderCall(); }
    else if (p.kind === "ice") { if (call.pc && call.pc.remoteDescription) call.pc.addIceCandidate(p.c).catch(function () {}); else call.pending.push(p.c); }
    else if (p.kind === "decline") endCall("Declined", true);
    else if (p.kind === "busy") endCall("Busy", true);
    else if (p.kind === "end") endCall("Call ended", true);
  }

  function renderTV() {
    var ch = CHANNELS.find(function (c) { return c.n === state.channel; }) || CHANNELS[0];
    view.innerHTML = top("Heartbeat TV", "home") + '<div class="hbp-tv"><div class="scr"><iframe src="/tv/?embed=1&ch=' + ch.n + '" allow="autoplay; fullscreen"></iframe></div><div class="hbp-remote">' +
      CHANNELS.map(function (c) { return '<button data-ch="' + c.n + '" class="' + (c.n === ch.n ? "on" : "") + '">' + c.n + " " + esc(c.name) + "</button>"; }).join("") +
      '<button data-app-link="/tv/">Full TV ↗</button></div></div>';
  }
  function renderMessages() {
    if (state.app !== "messages") return;
    var body;
    if (state.loading) body = '<div class="hbp-empty">Loading…</div>';
    else if (!state.session) body = '<div class="hbp-empty">Sign in to send and read messages.<br><br><a href="/admin">Sign in</a></div>';
    else if (state.thread) {
      var t = state.messages.filter(function (m) { return (m.sender_id === state.me ? m.recipient_id : m.sender_id) === state.thread; });
      view.innerHTML = top(nameFor(state.thread), "list") + '<div class="hbp-body"><div class="hbp-thread">' +
        (t.length ? t.map(function (m) { return '<div class="hbp-msg ' + (m.sender_id === state.me ? "me" : "them") + '">' + esc(m.body) + "</div>"; }).join("") : '<div class="hbp-empty">Say hi.</div>') +
        '</div></div><div class="hbp-compose"><input id="hbpText" maxlength="4000" placeholder="Message" enterkeyhint="send"><button data-act="send" aria-label="Send">↑</button></div>';
      var b = view.querySelector(".hbp-body"); b.scrollTop = b.scrollHeight;
      return;
    } else {
      var seen = {}, rows = [];
      state.messages.slice().reverse().forEach(function (m) {
        var o = m.sender_id === state.me ? m.recipient_id : m.sender_id;
        if (!o || seen[o]) return; seen[o] = 1; rows.push({ id: o, last: m });
      });
      var people = Array.from(state.people.values()).filter(function (p) { return p.auth_user_id !== state.me; });
      body = (rows.length ? rows.map(function (r) {
        var n = nameFor(r.id);
        return '<button class="hbp-row" data-thread="' + esc(r.id) + '"><span class="hbp-av">' + esc(n.charAt(0).toUpperCase()) + '</span><span class="t"><div class="n">' + esc(n) + '</div><div class="p">' + esc(r.last.body) + '</div></span><span class="w">' + ago(r.last.created_at) + "</span></button>";
      }).join("") : '<div class="hbp-empty">No conversations yet.</div>') +
        '<div class="hbp-compose"><select id="hbpTo"><option value="">New message to…</option>' +
        people.map(function (p) { return '<option value="' + esc(p.auth_user_id) + '">' + esc(nameFor(p.auth_user_id)) + "</option>"; }).join("") + "</select></div>";
    }
    view.innerHTML = top("Messages", "home") + '<div class="hbp-body">' + body + "</div>";
  }

  async function send() {
    var inp = view.querySelector("#hbpText"); var text = inp && inp.value.trim();
    if (!text || !state.thread) return;
    inp.value = "";
    var r = await state.supabase.rpc("send_message", { recipient: state.thread, body: text });
    if (r.error) {
      var ins = await state.supabase.from("messages").insert({ sender_id: state.me, recipient_id: state.thread, sender_handle: nameFor(state.me), recipient_handle: nameFor(state.thread), body: text });
      if (ins.error) { alert("Message not sent: " + ins.error.message); return; }
    }
    await loadMessages(); renderMessages();
  }

  // ---- open / close ----
  function open(app) {
    phone.classList.add("open"); scrim.classList.add("open"); document.documentElement.classList.add("hbp-open"); renderHome();
    if (app) setTimeout(function () { openApp(app); }, 120);
    if (state.session) { state.unread = 0; badge(); }
  }
  function close() { phone.classList.remove("open"); scrim.classList.remove("open"); document.documentElement.classList.remove("hbp-open"); setTimeout(goHome, 450); }
  function badge() { var d = launch.querySelector(".dot"); d.textContent = state.unread; d.classList.toggle("on", state.unread > 0); }

  phone.addEventListener("click", function (e) {
    var t = e.target.closest("[data-app],[data-act],[data-thread],[data-ch],[data-call],[data-app-link],.hbp-bar"); if (!t) return;
    if (t.classList.contains("hbp-bar")) return state.app === "home" ? close() : goHome();
    if (t.dataset.app) return openApp(t.dataset.app);
    if (t.dataset.thread) { state.thread = t.dataset.thread; return renderMessages(); }
    if (t.dataset.ch) { state.channel = +t.dataset.ch; return renderTV(); }
    if (t.dataset.appLink) { location.href = t.dataset.appLink; return; }
    if (t.dataset.act === "home") return goHome();
    if (t.dataset.act === "list") { state.thread = ""; return renderMessages(); }
    if (t.dataset.act === "send") return send();
    if (t.dataset.call) return startCall(t.dataset.call);
    if (t.dataset.act === "accept") return accept();
    if (t.dataset.act === "decline") { if (call) signal(call.peer, { kind: "decline", id: call.id }); return endCall(); }
    if (t.dataset.act === "hangup") { if (call) signal(call.peer, { kind: "end", id: call.id }); return endCall("Call ended", true); }
    if (t.dataset.act === "mute" && call && call.stream) { call.muted = !call.muted; call.stream.getAudioTracks().forEach(function (a) { a.enabled = !call.muted; }); return renderCall(); }
  });
  phone.addEventListener("change", function (e) { if (e.target.id === "hbpTo" && e.target.value) { state.thread = e.target.value; renderMessages(); } });
  phone.addEventListener("keydown", function (e) { if (e.target.id === "hbpText" && e.key === "Enter") { e.preventDefault(); send(); } e.stopPropagation(); });
  // swipe up on the home bar = home, swipe the phone down = put it away
  var y0 = null;
  phone.addEventListener("touchstart", function (e) { y0 = e.touches[0].clientY; }, { passive: true });
  phone.addEventListener("touchend", function (e) {
    if (y0 == null) return; var dy = e.changedTouches[0].clientY - y0; var fromBar = e.target.closest && e.target.closest(".hbp-bar");
    if (fromBar && dy < -30) state.app === "home" ? close() : goHome();
    else if (dy > 120 && state.app === "home") close();
    y0 = null;
  }, { passive: true });
  scrim.addEventListener("click", close);
  launch.addEventListener("click", function () { phone.classList.contains("open") ? close() : open(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && phone.classList.contains("open")) close(); });

  // ---- data ----
  async function loadPeople() {
    var r = await state.supabase.from("people").select("auth_user_id, handle, display_name");
    if (!r.error) { state.people = new Map(); (r.data || []).forEach(function (p) { if (p.auth_user_id) state.people.set(p.auth_user_id, p); }); }
  }
  async function loadMessages() {
    var r = await state.supabase.from("messages").select("id, sender_id, recipient_id, sender_handle, recipient_handle, body, created_at").order("created_at", { ascending: true });
    if (!r.error) state.messages = r.data || [];
  }
  async function init() {
    try {
      try { state.supabase = await (await import("/hb-supabase.js")).getSupabase(); }
      catch (e) { state.supabase = (await import("https://esm.sh/@supabase/supabase-js@2")).createClient(SUPABASE_URL, SUPABASE_KEY); }
      var s = await state.supabase.auth.getSession();
      state.session = s.data && s.data.session; state.me = state.session && state.session.user.id;
      if (state.session) {
        await Promise.all([loadPeople(), loadMessages()]);
        state.supabase.channel("hb-phone-messages").on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, function (p) {
          var m = p.new; if (!m || (m.sender_id !== state.me && m.recipient_id !== state.me)) return;
          if (!state.messages.some(function (x) { return x.id === m.id; })) state.messages.push(m);
          if (m.sender_id !== state.me && !(phone.classList.contains("open") && state.app === "messages")) { state.unread++; badge(); renderHome(); }
          renderMessages();
        }).subscribe();
        state.supabase.channel("hbcall-" + state.me, { config: { broadcast: { self: false } } })
          .on("broadcast", { event: "signal" }, function (m) { onSignal(m.payload); }).subscribe();
      }
    } catch (e) {}
    state.loading = false; renderMessages();
  }

  function mount() {
    // Ashgrove's shell has its own phone button in its HUD; it opens this phone, so no second launcher there.
    if (document.querySelector('script[src*="shell/shell.js"]')) launch.style.display = "none";
    document.body.appendChild(launch); document.body.appendChild(scrim); document.body.appendChild(stage);
    renderHome(); init();
  }
  window.HBPhone = { open: open, close: close, apps: APPS, channels: CHANNELS };
  if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);
})();
