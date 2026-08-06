/* ============================================================================
   settings.js — player-facing settings: data (T.Settings) + the panel UI
   ---------------------------------------------------------------------------
   One plain object, persisted whole to localStorage ("ashgrove-settings-v1"),
   read LIVE by its consumers so every toggle applies without a reload:

     render/player.js   sens + invertY, read at mouse/touch input time
     render/main.js     clock (HUD), night (T.setNight), the town panel
     render/npcs.js     npcs — a DISPLAY-only gate; the sim runs regardless

   Quality is the one exception: core.js reads ?q= at parse time, so the
   honest apply is storing the choice and reloading with the param — the
   panel says so next to the control.

   Load order: after core.js, before player.js. This module must not read
   anything that loads after it — all lookups into main.js-era surface
   (T.setNight) are runtime-optional.
   ========================================================================== */
(function () {
"use strict";
const T = (window.TOWN = window.TOWN || {});

const KEY = "ashgrove-settings-v1";
const DEFAULTS = {
  sens: 1.0,        // look sensitivity multiplier, 0.4–2.0
  invertY: false,   // flip pitch for mouse AND touch look
  quality: "auto",  // auto | high | low — applied via ?q= on reload
  clock: true,      // HUD town clock
  night: false,     // start the session at night (N toggles, kept in sync)
  npcs: true,       // NPC display layer (sim untouched — display only)
};

let loaded = {};
try { loaded = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { loaded = {}; }
const S = (T.Settings = Object.assign({}, DEFAULTS, loaded));

T.saveSettings = function () {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {}
};

/* ------------------------------------------------------------- the panel - */
const UI = (T.SettingsUI = { wired: false });
const q = (id) => document.getElementById(id);

UI.isOpen = function () {
  const el = q("settings");
  return !!(el && el.style.display === "block");
};

UI.toggle = function (force) {
  if (!UI.wired) UI.wire();
  const el = q("settings");
  if (!el) return;
  const show = force === undefined ? el.style.display !== "block" : force;
  el.style.display = show ? "block" : "none";
  const b = q("bSettings");
  if (b) b.classList.toggle("on", show);
  if (show) UI.sync();
};
UI.close = function () { UI.toggle(false); };

/* push T.Settings into the inputs (also called by T.setNight so the N
   hotkey and the checkbox never disagree) */
UI.sync = function () {
  if (!UI.wired) return;
  q("setSens").value = S.sens;
  q("setSensVal").textContent = Number(S.sens).toFixed(2);
  q("setInvertY").checked = !!S.invertY;
  q("setQuality").value = S.quality || "auto";
  q("setClock").checked = S.clock !== false;
  q("setNight").checked = !!S.night;
  q("setNpcs").checked = S.npcs !== false;
};

/* wired lazily on first open: the DOM exists by then and nothing here runs
   at parse time beyond the data object above */
UI.wire = function () {
  if (UI.wired || !q("settings")) return;
  UI.wired = true;

  q("setSens").addEventListener("input", (e) => {
    S.sens = Math.min(2, Math.max(0.4, parseFloat(e.target.value) || 1));
    q("setSensVal").textContent = S.sens.toFixed(2);
    T.saveSettings();
  });
  q("setInvertY").addEventListener("change", (e) => {
    S.invertY = !!e.target.checked; T.saveSettings();
  });
  q("setQuality").addEventListener("change", (e) => {
    S.quality = e.target.value; T.saveSettings();
    /* core.js reads ?q= once at parse time; the only truthful apply is a
       reload with the param set (auto = no param, the device default) */
    const url = new URL(location.href);
    if (S.quality === "auto") url.searchParams.delete("q");
    else url.searchParams.set("q", S.quality);
    location.href = url.toString();
  });
  q("setClock").addEventListener("change", (e) => {
    S.clock = !!e.target.checked; T.saveSettings();
  });
  q("setNight").addEventListener("change", (e) => {
    S.night = !!e.target.checked; T.saveSettings();
    if (T.setNight) T.setNight(S.night);   // main.js owns the light rig
  });
  q("setNpcs").addEventListener("change", (e) => {
    S.npcs = !!e.target.checked; T.saveSettings();
  });

  /* danger zone: wipe ONLY the world save and the first-run flag, then
     reload so boot founds the town afresh. Furniture edits
     ("ashgrove-edits-v1") and these settings are kept, and the confirm
     text says exactly that. */
  q("setReset").addEventListener("click", () => {
    if (!confirm("Reset the world? The saved town, its people and its history are deleted and refounded. Furniture edits and settings are kept.")) return;
    try {
      localStorage.removeItem("ashgrove-world-v1");
      localStorage.removeItem("ashgrove-seen");
    } catch (e) {}
    location.reload();
  });
};
})();
