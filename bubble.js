/* Heartbeat Observatory — floating message bubble.
   On normal pages it is a message bubble; inside the sim world (/engine/hub)
   it renders as a phone. Honest by design: messaging is not built yet, so the
   panel shows a truthful empty state rather than any invented content. */
(function () {
  if (window.__hbBubble) return;
  window.__hbBubble = true;

  var inWorld = location.pathname.indexOf("/engine/hub") === 0;

  var style = document.createElement("style");
  style.textContent =
    ".hb-bubble-btn{position:fixed;z-index:90000;border:0;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 26px rgba(0,0,0,.4);transition:transform .12s ease;}" +
    ".hb-bubble-btn:active{transform:scale(.94);}" +
    ".hb-b-normal{right:calc(18px + env(safe-area-inset-right,0px));bottom:calc(18px + env(safe-area-inset-bottom,0px));width:54px;height:54px;border-radius:50%;background:#1d6fe0;color:#fff;font-size:24px;}" +
    ".hb-b-world{right:calc(12px + env(safe-area-inset-right,0px));top:50%;transform:translateY(-50%);width:46px;height:64px;border-radius:12px;background:#10171c;border:1px solid #2c3a42;color:#cfe0ea;font-size:20px;}" +
    ".hb-b-world:active{transform:translateY(-50%) scale(.95);}" +
    ".hb-panel{position:fixed;z-index:90001;display:none;flex-direction:column;overflow:hidden;background:#0e1417;border:1px solid #243036;color:#e6edf1;font-family:system-ui,-apple-system,sans-serif;box-shadow:0 20px 60px rgba(0,0,0,.55);}" +
    ".hb-panel.open{display:flex;}" +
    ".hb-p-normal{right:calc(18px + env(safe-area-inset-right,0px));bottom:calc(82px + env(safe-area-inset-bottom,0px));width:min(320px,86vw);max-height:60vh;border-radius:16px;}" +
    ".hb-p-world{right:calc(12px + env(safe-area-inset-right,0px));top:50%;transform:translateY(-50%);width:min(280px,80vw);height:min(440px,72vh);border-radius:26px;border:6px solid #05080a;background:#0b1115;}" +
    ".hb-head{padding:14px 16px;border-bottom:1px solid #1e2a30;font-size:14px;font-weight:600;display:flex;justify-content:space-between;align-items:center;}" +
    ".hb-head .hb-x{cursor:pointer;opacity:.7;font-size:18px;line-height:1;background:none;border:0;color:#cdd6db;}" +
    ".hb-body{overflow:auto;flex:1;display:flex;flex-direction:column;}" +
    ".hb-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;color:#9fb0bb;font-size:13px;line-height:1.55;flex:1;padding:24px 18px;}" +
    ".hb-empty .hb-ico{font-size:34px;opacity:.85;}" +
    ".hb-foot{padding:12px 16px;border-top:1px solid #1e2a30;font-size:11.5px;color:#7d909c;line-height:1.5;}";
  document.head.appendChild(style);

  var btn = document.createElement("button");
  btn.className = "hb-bubble-btn " + (inWorld ? "hb-b-world" : "hb-b-normal");
  btn.setAttribute("aria-label", inWorld ? "Phone" : "Messages");
  btn.textContent = inWorld ? "\uD83D\uDCF1" : "\uD83D\uDCAC";

  var panel = document.createElement("div");
  panel.className = "hb-panel " + (inWorld ? "hb-p-world" : "hb-p-normal");
  panel.innerHTML =
    '<div class="hb-head"><span>' + (inWorld ? "Phone" : "Messages") + '</span><button class="hb-x" aria-label="Close">\u00D7</button></div>' +
    '<div class="hb-body"><div class="hb-empty"><div class="hb-ico">\u2709\uFE0F</div>' +
    "<div>No messages yet.<br>Messaging between people and minds is being built \u2014 this is where it will live.</div>" +
    "</div></div>" +
    '<div class="hb-foot">' + (inWorld ? "Your phone travels with you through the world." : "This stays with you across every page.") + "</div>";

  function toggle(open) {
    var willOpen = open === undefined ? !panel.classList.contains("open") : open;
    panel.classList.toggle("open", willOpen);
  }

  btn.addEventListener("click", function () { toggle(); });
  panel.querySelector(".hb-x").addEventListener("click", function () { toggle(false); });

  function mount() {
    document.body.appendChild(btn);
    document.body.appendChild(panel);
  }
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);
})();
