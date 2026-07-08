// ============================================================================
// tuner.js — Jaron's live tuning editor. Polish the game WITHOUT AI usage.
//
// OWNS: the F8 tuning panel (sliders for light/sky/fog/exposure and ship
//       feel), persistence of those overrides (localStorage), and the
//       "Copy JSON" export so a tuned look can be pasted to an agent to make
//       canon in one cheap step.
// DOES NOT OWN: the systems it tunes. It only writes the shared TUNE object
//       (below) that render/lighting.js and ship.js multiply into their math.
//
// WHY THIS EXISTS: every "make the sun warmer / ship turn faster" round-trip
// through an AI costs usage. With this panel Jaron drags sliders in the live
// game, taps Copy JSON, and pastes ONE message ("make these canon") when he
// is happy. One agent edit instead of twenty.
//
// EXTENDING (future agents): add a row to FIELDS with {key, label, min, max,
// step, def}. Consume TUNE.<key> in the owning system. That's the whole API.
// ============================================================================

const LS_KEY = 'syl_tune_v1';

// The shared override table. Systems multiply these into their own values:
//   render/lighting.js: exposure, sun, hemi, fog
//   ship/ship.js:       thrust, turn
export const TUNE = {
  exposure: 1.0, sun: 1.0, hemi: 1.0, fog: 1.0,
  thrust: 1.0, turn: 1.0,
};

const FIELDS = [
  { key: 'exposure', label: 'Exposure (brightness curve)', min: 0.5, max: 1.8, step: 0.02, def: 1.0 },
  { key: 'sun', label: 'Sunlight strength', min: 0.3, max: 2.0, step: 0.05, def: 1.0 },
  { key: 'hemi', label: 'Sky/ambient fill', min: 0.2, max: 2.2, step: 0.05, def: 1.0 },
  { key: 'fog', label: 'Atmosphere haze', min: 0.0, max: 3.0, step: 0.05, def: 1.0 },
  { key: 'thrust', label: 'Ship thrust ×', min: 0.4, max: 2.5, step: 0.05, def: 1.0 },
  { key: 'turn', label: 'Ship turn rate ×', min: 0.4, max: 2.5, step: 0.05, def: 1.0 },
];

export function loadTune() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    for (const f of FIELDS) {
      const v = parseFloat(saved[f.key]);
      if (Number.isFinite(v)) TUNE[f.key] = Math.max(f.min, Math.min(f.max, v));
    }
  } catch (e) { /* corrupted tune = defaults */ }
}

function saveTune() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(TUNE)); } catch (e) { /* full/blocked */ }
}

export class Tuner {
  constructor(input, engine) {
    this.engine = engine;
    this.panel = null;
    loadTune();
    input.onPress('F8', () => this.toggle());
  }

  anyPanelOpen() { return !!this.panel && this.panel.style.display === 'block'; }

  toggle() {
    if (!this.panel) this.mount();
    const opening = this.panel.style.display !== 'block';
    this.panel.style.display = opening ? 'block' : 'none';
  }

  mount() {
    const root = document.getElementById('ui-root') || document.body;
    this.panel = document.createElement('div');
    this.panel.className = 'syl-panel tuner-panel';
    this.panel.style.cssText = 'position:fixed;top:60px;right:12px;z-index:60;background:rgba(10,16,20,.92);border:1px solid rgba(255,255,255,.25);border-radius:10px;padding:12px 14px;color:#dfe7ec;font:12px/1.5 system-ui;max-width:280px;max-height:70vh;overflow-y:auto;display:none;';
    const rows = FIELDS.map((f) => `
      <label style="display:block;margin-bottom:8px;">
        <span style="display:flex;justify-content:space-between;">
          <span>${f.label}</span><b data-val="${f.key}">${TUNE[f.key].toFixed(2)}</b>
        </span>
        <input type="range" data-key="${f.key}" min="${f.min}" max="${f.max}" step="${f.step}"
          value="${TUNE[f.key]}" style="width:100%;">
      </label>`).join('');
    this.panel.innerHTML = `
      <button class="panel-close" type="button" style="float:right;background:none;border:1px solid rgba(255,255,255,.3);color:#fff;border-radius:6px;padding:2px 8px;cursor:pointer;">Close</button>
      <h3 style="margin:0 0 4px;font-size:13px;">🎛 Tuner <span style="opacity:.6;font-weight:normal;">(F8)</span></h3>
      <p style="margin:0 0 10px;opacity:.75;">Drag until it feels right. Changes apply live and stick on this device. Copy JSON and paste it to any agent to make it permanent for everyone.</p>
      ${rows}
      <div style="display:flex;gap:8px;margin-top:6px;">
        <button type="button" data-act="copy" style="flex:1;background:#34623f;border:none;color:#fff;border-radius:6px;padding:7px;cursor:pointer;">Copy JSON</button>
        <button type="button" data-act="reset" style="background:#5a3434;border:none;color:#fff;border-radius:6px;padding:7px 10px;cursor:pointer;">Reset</button>
      </div>
      <p data-copied style="margin:6px 0 0;opacity:0;transition:opacity .3s;color:#9fe8a9;">Copied — paste it to Claude/Codex to make canon.</p>`;
    root.appendChild(this.panel);

    this.panel.querySelector('.panel-close').addEventListener('click', () => this.toggle());
    this.panel.addEventListener('input', (ev) => {
      const key = ev.target?.dataset?.key;
      if (!key) return;
      TUNE[key] = parseFloat(ev.target.value);
      this.panel.querySelector(`[data-val="${key}"]`).textContent = TUNE[key].toFixed(2);
      saveTune();
    });
    this.panel.addEventListener('click', async (ev) => {
      const act = ev.target?.dataset?.act;
      if (act === 'reset') {
        for (const f of FIELDS) TUNE[f.key] = f.def;
        saveTune();
        for (const f of FIELDS) {
          this.panel.querySelector(`[data-key="${f.key}"]`).value = f.def;
          this.panel.querySelector(`[data-val="${f.key}"]`).textContent = f.def.toFixed(2);
        }
      } else if (act === 'copy') {
        const payload = JSON.stringify({ syl_tuning: TUNE, note: 'Make these the game defaults' }, null, 2);
        try {
          await navigator.clipboard.writeText(payload);
          const el = this.panel.querySelector('[data-copied]');
          el.style.opacity = '1';
          setTimeout(() => { el.style.opacity = '0'; }, 2200);
        } catch (e) {
          window.prompt('Copy this:', payload); // clipboard blocked fallback
        }
      }
    });
  }
}
