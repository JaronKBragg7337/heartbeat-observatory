// ============================================================================
// settings.js — localStorage-backed game settings manager.
//
// OWNS: persistence of player preferences (mouse sensitivity, touch sensitivity,
//       graphics quality, sound toggle). DOES NOT OWN: UI rendering.
// ============================================================================

const LS_KEYS = {
  mouseSens: 'syl_settings_mouseSens',
  touchSens: 'syl_settings_touchSens',
  graphics: 'syl_settings_graphics',
  sound: 'syl_settings_sound',
};

const DEFAULTS = {
  mouseSens: 1.0,
  touchSens: 1.0,
  graphics: 'high',
  sound: 'on',
};

export class Settings {
  get(key) {
    const raw = localStorage.getItem(LS_KEYS[key]);
    if (raw === null) return DEFAULTS[key];
    if (key === 'mouseSens' || key === 'touchSens') {
      const n = parseFloat(raw);
      return Number.isFinite(n) ? Math.max(0.1, Math.min(3.0, n)) : DEFAULTS[key];
    }
    return raw;
  }

  set(key, value) {
    if (key === 'mouseSens' || key === 'touchSens') {
      const n = parseFloat(value);
      if (Number.isFinite(n)) {
        localStorage.setItem(LS_KEYS[key], Math.max(0.1, Math.min(3.0, n)).toFixed(2));
      }
    } else {
      localStorage.setItem(LS_KEYS[key], String(value));
    }
  }

  reset() {
    for (const k of Object.keys(LS_KEYS)) {
      localStorage.removeItem(LS_KEYS[k]);
    }
  }
}
