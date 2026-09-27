/* Heartbeat TV remote - one remote for every TV on the site: the TV page, the phone's HB TV app and the Loft TV.
   A button on the right edge (just above the phone's) brings up a real remote held at the bottom of the screen, not a
   full-screen panel (Jaron 9/27). Power, channel up/down, volume up/down + mute, number pad (2.2 = channel 2, show 2),
   guide, and a small display. Any press also turns the sound on - phones only allow sound after a touch, so the remote's
   first touch is that touch.
   A page with a TV registers it:  HBRemote.attach({ state(), power(), step(d), tune(ch, i), volume(v), mute(m), guide(), soundOn() })
   and HBRemote.detach() when the TV goes away. state() -> { on, label, volume (0..1), muted }. */
(function () {
  if (window.HBRemote) return;
  let tv = null, open = false, typed = "", typedT = 0;
  const css = `
  .hbr-tab{position:fixed;z-index:90004;right:calc(4px + env(safe-area-inset-right,0px));top:calc(56% - 100px);width:34px;height:58px;border-radius:10px;
    background:rgba(16,23,28,.85);border:1px solid #2a3440;display:none;align-items:center;justify-content:center;cursor:pointer;-webkit-tap-highlight-color:transparent}
  .hbr-tab.on{display:flex}.hbr-tab svg{width:18px;height:18px;fill:#e8eef3}.hbr-tab.open{border-color:#ff3b4e}
  .hbr-wrap{position:fixed;z-index:90005;left:50%;bottom:0;transform-origin:50% 100%;transform:translate(-50%,105%) rotate(-4deg) scale(var(--sc,1));transition:transform .35s cubic-bezier(.2,.9,.25,1);
    pointer-events:none;filter:drop-shadow(0 18px 30px rgba(0,0,0,.6))}
  .hbr-wrap.open{transform:translate(-50%,6%) rotate(-4deg) scale(var(--sc,1));pointer-events:auto}
  .hbr{width:min(210px,52vw,24vh);border-radius:44px 44px 30px 30px;padding:18px 16px 40px;
    background:linear-gradient(90deg,#15181d 0%,#262a31 22%,#2c3038 50%,#23272e 78%,#121418 100%);
    box-shadow:inset 0 1px 0 rgba(255,255,255,.14),inset 0 -2px 6px rgba(0,0,0,.6),0 0 0 1px #0a0b0e;font-family:system-ui,-apple-system,sans-serif;color:#cfd6de;user-select:none}
  .hbr .ir{width:34px;height:8px;border-radius:5px;margin:0 auto 12px;background:linear-gradient(#3a1016,#12060a);box-shadow:inset 0 1px 2px rgba(0,0,0,.8)}
  .hbr .lcd{height:30px;border-radius:7px;margin:0 2px 12px;background:linear-gradient(#0d1f1a,#08140f);color:#7ff0b4;font:700 13px/30px ui-monospace,Consolas,monospace;
    text-align:center;letter-spacing:.06em;box-shadow:inset 0 2px 4px rgba(0,0,0,.8);overflow:hidden;white-space:nowrap;text-overflow:ellipsis;padding:0 8px}
  .hbr .top{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px}
  .hbr .top b.k:not(.pow){padding:0 12px;min-width:40px}
  .hbr b.k{display:flex;align-items:center;justify-content:center;border-radius:12px;height:34px;cursor:pointer;
    background:linear-gradient(#3b4049,#2a2e35);box-shadow:0 2px 0 #0b0c0f,inset 0 1px 0 rgba(255,255,255,.12);font-size:13px;font-weight:700;color:#dfe5ec}
  .hbr b.k:active{transform:translateY(2px);box-shadow:0 0 0 #0b0c0f,inset 0 1px 0 rgba(255,255,255,.08)}
  .hbr b.pow{flex:0 0 40px;width:40px;height:40px;border-radius:50%;background:radial-gradient(circle at 40% 35%,#ff5a67,#b3121f 70%);color:#fff}
  .hbr .rock{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}
  .hbr .rk{display:grid;grid-template-rows:38px 20px 38px;border-radius:22px;background:linear-gradient(#30353d,#23272d);box-shadow:0 2px 0 #0b0c0f,inset 0 1px 0 rgba(255,255,255,.1)}
  .hbr .rk b.k{background:none;box-shadow:none;height:auto;font-size:18px}
  .hbr .rk span{font-size:10px;letter-spacing:.14em;text-align:center;color:#8b96a3;align-self:center}
  .hbr .pad{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px}
  .hbr .row2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .hbr b.guide{background:linear-gradient(#264b9e,#1b3572);color:#fff}
  .hbr b.mute.on{background:linear-gradient(#7a1a24,#4d0f16);color:#fff}
  .hbr .vol{height:5px;border-radius:3px;background:#15181c;margin:0 4px 12px;overflow:hidden}.hbr .vol i{display:block;height:100%;background:#7ff0b4}
  .hbr .brand{margin-top:14px;text-align:center;font:800 11px/1 system-ui;letter-spacing:.3em;color:#6d7784}
  .hbr .brand em{color:#ff3b4e;font-style:normal}`;
  const s = document.createElement("style"); s.textContent = css; document.head.appendChild(s);
  const tab = document.createElement("button"); tab.className = "hbr-tab"; tab.setAttribute("aria-label", "TV remote");
  tab.innerHTML = '<svg viewBox="0 0 24 24"><path d="M9 2h6a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3zm3 3a1.6 1.6 0 1 0 0 3.2A1.6 1.6 0 0 0 12 5zM9.5 11v2h2v-2zm3 0v2h2v-2zm-3 3.5v2h2v-2zm3 0v2h2v-2z"/></svg>';
  const wrap = document.createElement("div"); wrap.className = "hbr-wrap";
  const k = (act, label, cls = "") => `<b class="k ${cls}" data-a="${act}">${label}</b>`;
  wrap.innerHTML = `<div class="hbr" role="group" aria-label="TV remote"><div class="ir"></div>
    <div class="top">${k("power", "⏻", "pow")}${k("mute", "MUTE", "mute")}${k("close", "✕")}</div>
    <div class="lcd" id="hbrLcd">HEARTBEAT TV</div><div class="vol"><i id="hbrVol"></i></div>
    <div class="rock"><div class="rk">${k("ch+", "▲")}<span>CH</span>${k("ch-", "▼")}</div><div class="rk">${k("vol+", "+")}<span>VOL</span>${k("vol-", "−")}</div></div>
    <div class="row2" style="margin-bottom:12px">${k("guide", "☰ GUIDE", "guide")}${k("last", "↺ BACK")}</div>
    <div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => k("n" + n, n)).join("")}${k("dot", "•")}${k("n0", "0")}${k("ok", "OK")}</div>
    <div class="brand">HEARTBEAT <em>TV</em></div></div>`;
  document.addEventListener("DOMContentLoaded", () => { document.body.appendChild(tab); document.body.appendChild(wrap); });
  if (document.body) { document.body.appendChild(tab); document.body.appendChild(wrap); }
  let lastCh = null;
  function show() {
    if (!tv) return;
    const st = tv.state() || {};
    const lcd = wrap.querySelector("#hbrLcd"); if (lcd) lcd.textContent = typed ? "CH " + typed + "_" : st.on === false ? "OFF" : st.muted ? "MUTED · " + (st.label || "") : (st.label || "HEARTBEAT TV");
    const vol = wrap.querySelector("#hbrVol"); if (vol) vol.style.width = Math.round((st.muted ? 0 : st.volume ?? 1) * 100) + "%";
    const m = wrap.querySelector('[data-a="mute"]'); if (m) m.classList.toggle("on", !!st.muted);
  }
  function fit() { const r = wrap.firstElementChild; if (r) wrap.style.setProperty('--sc', Math.min(1, (window.innerHeight * 0.8) / (r.offsetHeight || 1)).toFixed(3)); }
  addEventListener('resize', fit);
  function setOpen(o) { if (o) fit(); open = o; wrap.classList.toggle("open", o); tab.classList.toggle("open", o); show(); }
  tab.onclick = () => { if (tv && tv.soundOn) tv.soundOn(); setOpen(!open); };
  wrap.addEventListener("click", (e) => {
    const b = e.target.closest("[data-a]"); if (!b || !tv) return;
    const a = b.dataset.a, st = tv.state() || {};
    if (tv.soundOn && a !== "mute") tv.soundOn();          // any press is the touch that lets sound play
    if (a === "close") return setOpen(false);
    if (a === "power") tv.power();
    else if (a === "mute") tv.mute(!st.muted);
    else if (a === "ch+" || a === "ch-") { lastCh = st.label; tv.step(a === "ch+" ? 1 : -1); }
    else if (a === "vol+" || a === "vol-") tv.volume(Math.max(0, Math.min(1, (st.volume ?? 1) + (a === "vol+" ? 0.1 : -0.1))));
    else if (a === "guide") { tv.guide(); setOpen(false); }
    else if (a === "last" && tv.back) tv.back();
    else if (a[0] === "n" || a === "dot") {
      typed += a === "dot" ? "." : a.slice(1); clearTimeout(typedT);
      typedT = setTimeout(go, 1400);
    } else if (a === "ok") go();
    show();
  });
  function go() {
    clearTimeout(typedT); const t = typed; typed = "";
    const m = t.match(/^(\d+)(?:\.(\d+))?$/); if (m && tv) tv.tune(+m[1], m[2] ? +m[2] - 1 : 0);
    show();
  }
  window.HBRemote = {
    attach(adapter) { tv = adapter; tab.classList.add("on"); show(); },
    detach(adapter) { if (!adapter || adapter === tv) { tv = null; tab.classList.remove("on"); setOpen(false); } },
    refresh: show,
  };
})();
