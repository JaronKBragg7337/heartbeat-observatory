// Heartbeat News - Voice Studio (admins only; loaded after is_admin() says true).
// A channel strip per anchor, like a mixing desk: engine, voice, character, pitch, speed, size (formant), tone,
// effects, and how he looks. Changes play live on this screen; "Save for everyone" writes them to
// news_anchor_settings so every viewer hears and sees the same anchors.
import { DEFAULT_SETTINGS, SYNTH_VARIANTS } from "/news/voices.js";

const SAMPLE = {
  vex: "Good evening. I'm AI Robot Vex, and this is Heartbeat News. Diesel hit six dollars and fifty-three cents a gallon.",
  joe: "And I'm Alien Joe. Here's what happened on your planet today, and why it matters."
};
const DRAFT_KEY = "hb-news-studio-draft";

const SLIDERS = [
  // key, label, min, max, step, synthOnly, group
  ["pitch", "Pitch", 0.4, 1.8, 0.01, false, "Voice"],
  ["speed", "Speed", 0.6, 1.6, 0.01, false, "Voice"],
  ["volume", "Volume", 0, 1.2, 0.01, false, "Voice"],
  ["size", "Size (formant)", 0.75, 1.3, 0.01, true, "Voice"],
  ["bass", "Bass", -12, 12, 0.5, true, "Tone"],
  ["presence", "Presence", -12, 12, 0.5, true, "Tone"],
  ["treble", "Treble", -12, 12, 0.5, true, "Tone"],
  ["robot", "Robot", 0, 1, 0.01, true, "Effects"],
  ["robotHz", "Robot Hz", 5, 220, 1, true, "Effects"],
  ["metal", "Metal", 0, 1, 0.01, true, "Effects"],
  ["crush", "Bit crush", 0, 1, 0.01, true, "Effects"],
  ["radio", "Radio", 0, 1, 0.01, true, "Effects"],
  ["echo", "Echo", 0, 1, 0.01, true, "Effects"]
];
const LOOKS = {
  vex: [["body", "Body paint"], ["trim", "Joints & trim"], ["eyes", "Eyes & mouth LEDs"], ["tie", "Tie plate"]],
  joe: [["skin", "Skin"], ["eyes", "Eyes"], ["suit", "Suit"], ["tie", "Tie"]]
};

function esc(s) { const d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML; }
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function fmt(v, step) { return step >= 1 ? String(Math.round(v)) : step >= 0.5 ? (+v).toFixed(1) : (+v).toFixed(2); }

export function mountStudio(root, { supabase, session, voice, api }) {
  let saved = { vex: clone(voice.settings.vex), joe: clone(voice.settings.joe) };
  let work = clone(saved);
  try { const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); if (d && d.vex && d.joe) work = { vex: Object.assign({}, work.vex, d.vex), joe: Object.assign({}, work.joe, d.joe) }; } catch (e) {}
  ["vex", "joe"].forEach((w) => api.applySettings(w, work[w]));

  root.hidden = false;
  root.innerHTML = `
    <h2>Voice Studio</h2>
    <p class="intro">Admins only. Every change plays here right away. <b>Save for everyone</b> makes it what every viewer hears and sees.
      The <b>code synth</b> takes every knob and effect. A <b>device voice</b> sounds more natural but only takes pitch, speed and volume, and it differs by phone and computer.</p>
    <div class="strips">${["vex", "joe"].map(strip).join("")}</div>
    <div class="bar">
      <button class="btn primary" type="button" data-act="save">Save for everyone</button>
      <button class="btn" type="button" data-act="revert">Back to saved</button>
      <span class="msg" id="studioMsg"></span>
    </div>`;

  function strip(who) {
    const s = work[who], name = who === "vex" ? "AI Robot Vex" : "Alien Joe";
    const groups = {};
    SLIDERS.forEach(([k, label, min, max, step, synthOnly, g]) => {
      (groups[g] = groups[g] || []).push(`<div class="row" data-synth="${synthOnly ? 1 : 0}"><label for="${who}-${k}">${label}</label>
        <input type="range" id="${who}-${k}" data-who="${who}" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${s[k] ?? DEFAULT_SETTINGS[who][k]}">
        <output id="${who}-${k}-o">${fmt(s[k] ?? DEFAULT_SETTINGS[who][k], step)}</output></div>`);
    });
    return `<div class="strip" data-strip="${who}">
      <h3>${name} <small id="${who}-engineNote"></small></h3>
      <div class="row"><label for="${who}-engine">Engine</label><select id="${who}-engine" data-who="${who}" data-k="engine">
        <option value="synth">Code synth (eSpeak) — all effects</option><option value="browser">Device voice — natural, no effects</option></select></div>
      <div class="row" data-browser="1"><label for="${who}-voiceName">Device voice</label><select id="${who}-voiceName" data-who="${who}" data-k="voiceName"></select></div>
      <div class="row" data-synth="1"><label for="${who}-variant">Character</label><select id="${who}-variant" data-who="${who}" data-k="variant">
        ${SYNTH_VARIANTS.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join("")}</select></div>
      ${Object.entries(groups).map(([g, rows]) => `<div class="grp">${g}</div>${rows.join("")}`).join("")}
      <div class="grp">Look</div>
      ${LOOKS[who].map(([k, l]) => `<div class="row"><label for="${who}-look-${k}">${l}</label><input type="color" id="${who}-look-${k}" data-who="${who}" data-look="${k}" value="${esc((s.look || {})[k] || DEFAULT_SETTINGS[who].look[k])}"></div>`).join("")}
      <div class="acts">
        <button class="btn primary" type="button" data-act="test" data-who="${who}">▶ Test voice</button>
        <button class="btn" type="button" data-act="reset" data-who="${who}">Reset to defaults</button>
      </div>
    </div>`;
  }

  function fillVoices() {
    ["vex", "joe"].forEach((who) => {
      const sel = root.querySelector(`#${who}-voiceName`); if (!sel) return;
      const list = voice.englishVoices();
      const curName = work[who].voiceName || "";
      sel.innerHTML = `<option value="">Auto (best on this device${voice.pickVoice(who) ? ": " + esc(voice.pickVoice(who).name) : ""})</option>` +
        list.map((v) => `<option value="${esc(v.name)}">${esc(v.name)} · ${esc(v.lang)}${v.localService ? "" : " · online"}</option>`).join("");
      sel.value = list.some((v) => v.name === curName) ? curName : "";
      if (curName && sel.value !== curName) sel.insertAdjacentHTML("beforeend", `<option value="${esc(curName)}" selected>${esc(curName)} (not on this device)</option>`), sel.value = curName;
    });
  }
  function sync() {
    ["vex", "joe"].forEach((who) => {
      const s = work[who];
      root.querySelector(`#${who}-engine`).value = s.engine;
      root.querySelector(`#${who}-variant`).value = s.variant || "m3";
      SLIDERS.forEach(([k, , , , step]) => { const el = root.querySelector(`#${who}-${k}`); const v = s[k] ?? DEFAULT_SETTINGS[who][k]; el.value = v; root.querySelector(`#${who}-${k}-o`).textContent = fmt(v, step); });
      LOOKS[who].forEach(([k]) => { root.querySelector(`#${who}-look-${k}`).value = (s.look || {})[k] || DEFAULT_SETTINGS[who].look[k]; });
      const synth = s.engine === "synth";
      root.querySelectorAll(`[data-strip="${who}"] [data-synth="1"]`).forEach((r) => r.classList.toggle("dim", !synth));
      root.querySelectorAll(`[data-strip="${who}"] [data-browser="1"]`).forEach((r) => r.classList.toggle("dim", synth));
      root.querySelector(`#${who}-engineNote`).textContent = synth ? "same on every device" : "varies by device";
    });
    fillVoices();
  }
  function changed(who) {
    api.applySettings(who, work[who]);
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(work)); } catch (e) {}
    msg("Unsaved changes — playing on this screen only.", "");
  }
  function msg(t, cls) { const m = root.querySelector("#studioMsg"); m.textContent = t; m.className = "msg " + (cls || ""); }

  root.addEventListener("input", (e) => {
    const el = e.target, who = el.dataset.who; if (!who) return;
    if (el.dataset.look) { work[who].look = Object.assign({}, work[who].look, { [el.dataset.look]: el.value }); changed(who); return; }
    const k = el.dataset.k; if (!k) return;
    work[who][k] = el.type === "range" ? +el.value : el.value;
    if (el.type === "range") { const def = SLIDERS.find((x) => x[0] === k); root.querySelector(`#${who}-${k}-o`).textContent = fmt(el.value, def ? def[4] : 0.01); }
    changed(who);
    if (k === "engine") sync();
  });
  root.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const act = b.dataset.act, who = b.dataset.who;
    if (act === "test") {
      api.unlock(); api.pause();
      b.disabled = true; b.textContent = "Speaking…";
      await voice.speak(who, SAMPLE[who]);
      b.disabled = false; b.textContent = "▶ Test voice";
      api.resume();
    } else if (act === "reset") {
      work[who] = clone(DEFAULT_SETTINGS[who]); sync(); changed(who);
    } else if (act === "revert") {
      work = clone(saved); ["vex", "joe"].forEach((w) => api.applySettings(w, work[w])); sync();
      try { localStorage.removeItem(DRAFT_KEY); } catch (e2) {}
      msg("Back to the saved settings.", "");
    } else if (act === "save") {
      b.disabled = true; msg("Saving…", "");
      const rows = ["vex", "joe"].map((w) => ({ anchor: w, settings: work[w], updated_by: session.user.id, updated_at: new Date().toISOString() }));
      const { error } = await supabase.from("news_anchor_settings").upsert(rows, { onConflict: "anchor" });
      b.disabled = false;
      if (error) {
        const missing = /does not exist|schema cache|42P01|PGRST205/i.test((error.message || "") + (error.code || ""));
        msg(missing ? "Not saved: the settings table isn't in the database yet (SQL waiting in AI-Shared/projects/news-show). Your changes still play on this screen." : "Not saved: " + error.message, "err");
        return;
      }
      saved = clone(work);
      try { localStorage.removeItem(DRAFT_KEY); } catch (e2) {}
      msg("Saved. Everyone now hears and sees these settings.", "ok");
    }
  });
  if (typeof speechSynthesis !== "undefined") { try { speechSynthesis.addEventListener("voiceschanged", fillVoices); } catch (e) {} }
  sync();
}
