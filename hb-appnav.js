/**
 * Home-screen app navigation (2026-10-25). Stamped into every page by tools/stamp-shared.mjs.
 *
 * Jaron adds the site to his iPhone home screen. In that standalone mode there is no Safari bar: no back, no reload.
 * This draws a small Back + Refresh pill at the TOP-LEFT (bottom corners belong to the phone widget and the Edit button).
 * It does nothing at all in a normal browser tab.
 *
 * Pages that need the whole screen (games) add <!-- hb:no-appnav --> and get ONE small corner button instead;
 * tapping it opens Back / Refresh / Home.
 */
(function () {
  "use strict";
  try {
    var standalone = window.navigator.standalone === true ||
      (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
      /[?&]hbappnav=1/.test(location.search); // ?hbappnav=1 previews the bar in a normal browser (testing only)
    if (!standalone || document.getElementById("hb-appnav")) return;

    // find the opt-out comment: the page wants the full screen
    var compact = false;
    try {
      var w = document.createTreeWalker(document, NodeFilter.SHOW_COMMENT, null);
      var n;
      while ((n = w.nextNode())) { if (n.nodeValue.indexOf("hb:no-appnav") !== -1) { compact = true; break; } }
    } catch (e) {}

    var atHome = location.pathname === "/" || location.pathname === "/index.html";
    function goBack() {
      if (history.length > 1) history.back(); else location.href = "/";
    }
    function refresh() { location.reload(); }
    function home() { location.href = "/"; }

    var css = document.createElement("style");
    css.textContent =
      "#hb-appnav{position:fixed;z-index:2147483000;top:calc(env(safe-area-inset-top,0px) + 6px);left:calc(env(safe-area-inset-left,0px) + 8px);" +
      "display:flex;gap:0;align-items:center;background:rgba(20,20,20,.72);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);" +
      "border:1px solid rgba(255,255,255,.22);border-radius:22px;overflow:hidden;opacity:.62;transition:opacity .2s;" +
      "font:600 20px/1 -apple-system,system-ui,sans-serif;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}" +
      "#hb-appnav:active,#hb-appnav.open{opacity:1}" +
      "#hb-appnav button{all:unset;box-sizing:border-box;width:44px;height:44px;display:flex;align-items:center;justify-content:center;" +
      "color:#fff;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation;font:inherit}" +
      "#hb-appnav button:active{background:rgba(255,255,255,.25)}" +
      "#hb-appnav button+button{border-left:1px solid rgba(255,255,255,.18)}" +
      "#hb-appnav svg{width:22px;height:22px;fill:none;stroke:#fff;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round;pointer-events:none}" +
      "#hb-appnav [hidden]{display:none!important}";
    (document.head || document.documentElement).appendChild(css);

    var ICON = {
      back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
      refresh: '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4v5h-5"/></svg>',
      home: '<svg viewBox="0 0 24 24"><path d="M4 11l8-7 8 7"/><path d="M6 10v10h12V10"/></svg>',
      more: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/></svg>'
    };
    var bar = document.createElement("div");
    bar.id = "hb-appnav";
    bar.setAttribute("role", "navigation");
    bar.setAttribute("aria-label", "App navigation");
    function mk(label, icon, fn, hidden) {
      var b = document.createElement("button");
      b.type = "button"; b.setAttribute("aria-label", label); b.innerHTML = icon;
      if (hidden) b.hidden = true;
      b.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); fn(); });
      bar.appendChild(b);
      return b;
    }
    if (!compact) {
      var back = mk("Back", ICON.back, goBack);
      if (atHome && history.length <= 1) back.hidden = true;
      mk("Refresh", ICON.refresh, refresh);
    } else {
      // full-screen pages: one small button; tap to open Back / Refresh / Home
      var more = mk("Page menu", ICON.more, function () {
        var open = !bar.classList.contains("open");
        bar.classList.toggle("open", open);
        more.hidden = open; // swap the ... for the three actions
        for (var i = 0; i < extras.length; i++) extras[i].hidden = !open;
        if (open) clearTimeout(t), t = setTimeout(close, 5000);
      });
      var extras = [
        mk("Back", ICON.back, goBack, true),
        mk("Refresh", ICON.refresh, refresh, true),
        mk("Home", ICON.home, home, true)
      ];
      var t;
      var close = function () { bar.classList.remove("open"); more.hidden = false; for (var i = 0; i < extras.length; i++) extras[i].hidden = true; };
    }
    (document.body || document.documentElement).appendChild(bar);

    // Some pages already have their own control in the top-left corner (a back pill, a menu). If something tappable sits
    // under the bar, move the bar to the top-right; if that is taken too, leave it where it is.
    function taken(x, y) {
      var el = document.elementFromPoint(x, y);
      if (!el || bar.contains(el)) return false;
      return !!(el.closest && el.closest("a,button,input,select,textarea,summary,[role=button],[onclick]"));
    }
    function place() {
      try {
        bar.style.pointerEvents = "none";
        bar.style.left = ""; bar.style.right = "";
        var r = bar.getBoundingClientRect(), pts = [[r.left + 6, r.top + 6], [r.left + r.width / 2, r.top + r.height / 2], [r.right - 6, r.bottom - 6]];
        var hit = pts.some(function (p) { return taken(p[0], p[1]); });
        if (hit) {
          bar.style.left = "auto"; bar.style.right = "calc(env(safe-area-inset-right,0px) + 8px)";
          var r2 = bar.getBoundingClientRect();
          var hit2 = [[r2.left + 6, r2.top + 6], [r2.left + r2.width / 2, r2.top + r2.height / 2], [r2.right - 6, r2.bottom - 6]].some(function (p) { return taken(p[0], p[1]); });
          if (hit2) { bar.style.left = ""; bar.style.right = ""; }
        }
      } catch (e) {}
      bar.style.pointerEvents = "";
    }
    place(); setTimeout(place, 1200); setTimeout(place, 3500);
    window.addEventListener("load", place);
  } catch (e) { /* never break a page */ }
})();
