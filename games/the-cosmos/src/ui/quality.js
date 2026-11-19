// ============================================================================
// quality.js - the picture-quality setting and the slow-device check (2026-11-19, part 4: the game shell).
//
// OWNS: which of the two detail tiers this device starts in ('low' = Fast, 'high' = Full detail), the player's own choice of it
//   (Settings, "Picture quality", remembered on the device), and a quiet watch on the frame rate that offers Fast once when Full
//   detail runs slow. Changing the tier reloads the page: the tiers build different worlds (terrain rings, shadows, people).
// DOES NOT OWN: what each tier draws (every system reads `tier` itself). Platform-neutral: no device names, only touch-or-not as the
//   starting guess, and the measured frame rate after that.
// ============================================================================
const KEY = 'cosmos-quality';

/** The player's saved choice: 'low', 'high' or 'auto'. */
export function savedQuality(storage = globalThis.localStorage) { try { const v = storage?.getItem(KEY); return v === 'low' || v === 'high' ? v : 'auto'; } catch { return 'auto'; } }
/** The tier to start in. A ?tier= in the address wins (reviews and tests), then the saved choice, then the guess: touch = Fast, else Full. */
export function pickTier({ search = '', touch = false, safe = false, saved = 'auto' } = {}) {
  if (safe) return 'low';
  const asked = new URLSearchParams(search).get('tier'); if (asked === 'low' || asked === 'high') return asked;
  if (saved === 'low' || saved === 'high') return saved;
  return touch ? 'low' : 'high';
}
export function saveQuality(v, storage = globalThis.localStorage) { try { if (v === 'low' || v === 'high') storage?.setItem(KEY, v); else storage?.removeItem(KEY); } catch { /* storage may be blocked */ } }
/** Reload into a tier (drops a ?tier= from the address so the saved choice is what counts). */
export function applyQuality(v) { saveQuality(v); const u = new URL(location.href); u.searchParams.delete('tier'); location.replace(u.href); }

/** Median frames a second from a list of frame gaps in milliseconds (the median ignores the odd long hitch). */
export function medianFps(gaps) { if (!gaps.length) return 0; const s = [...gaps].sort((a, b) => a - b); return 1000 / s[s.length >> 1]; }

/**
 * Watch the real frame rate. On Full detail, if the median stays under `slowFps` for a whole window after a grace period, offer Fast once
 * (never again on this device once dismissed). `busy()` true pauses the watch (loading, the opening's film, a hidden tab).
 */
export function watchFrameRate({ tier, busy = () => false, slowFps = 22, windowMs = 15000, graceMs = 40000, storage = globalThis.localStorage } = {}) {
  const state = { fps: 0, offered: false, samples: 0 };
  if (typeof window === 'undefined') return state;
  let last = 0, gaps = [], since = 0, started = performance.now();
  const dismissed = () => { try { return storage?.getItem(KEY + '-offer') === 'no'; } catch { return false; } };
  const tick = (now) => {
    requestAnimationFrame(tick);
    if (document.hidden || busy()) { last = 0; gaps = []; since = 0; return; }
    if (last) { const g = now - last; if (g < 1000) { gaps.push(g); since += g; } }
    last = now;
    if (since >= windowMs) {
      state.fps = medianFps(gaps); state.samples++; gaps = []; since = 0;
      if (tier === 'high' && !state.offered && now - started > graceMs && state.fps > 0 && state.fps < slowFps && !dismissed()) { state.offered = true; offer(Math.round(state.fps), storage); }
    }
  };
  requestAnimationFrame(tick);
  return state;
}
function offer(fps, storage) {
  const el = document.createElement('div'); el.id = 'quality-offer'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Picture quality');
  el.style.cssText = 'position:fixed;z-index:120;left:50%;transform:translateX(-50%);bottom:calc(96px + env(safe-area-inset-bottom,0px));width:min(92vw,420px);background:rgba(16,13,11,.94);border:1px solid rgba(240,185,120,.45);border-radius:12px;padding:12px 14px;color:#f1e2d0;font:14px/1.45 system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.5)';
  const p = document.createElement('p'); p.style.margin = '0 0 10px'; p.textContent = `The picture is running slowly on this device (about ${fps} frames a second). Fast mode draws less detail and runs smoother.`;
  const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap';
  const mk = (t, primary) => { const b = document.createElement('button'); b.textContent = t; b.style.cssText = `flex:1;min-height:48px;border-radius:8px;border:1px solid ${primary ? '#f0b978' : '#c7b29666'};background:${primary ? '#f0b978' : 'transparent'};color:${primary ? '#1a120b' : '#f1e2d0'};font:600 14px system-ui,sans-serif;padding:8px 12px;cursor:pointer`; return b; };
  const yes = mk('Switch to Fast', true), no = mk('Keep Full detail', false);
  yes.onclick = () => applyQuality('low');
  no.onclick = () => { try { storage?.setItem(KEY + '-offer', 'no'); } catch { /* storage may be blocked */ } el.remove(); };
  row.append(yes, no); el.append(p, row); document.body.append(el);
}
