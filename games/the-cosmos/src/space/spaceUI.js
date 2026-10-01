// ============================================================================
// spaceUI.js — the nav computer's sheet: where can we go, how long, go; and the jobs board.
//
// It exists only while you sit at the navigation, pilot, captain or communications seat (same rule as every station panel:
// nothing sits on screen waiting). One sheet, two tabs. Thumb-sized buttons; on a phone it sits under the status box and never
// covers LIFT, SINK or FIRE.
// ============================================================================

import { DRIVE } from './spaceSpec.js';
import { fmtDuration } from './spaceTrip.js';

const CSS = `
#space-sheet { position: fixed; z-index: 70; display: none; pointer-events: auto; font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  right: calc(10px + env(safe-area-inset-right, 0px)); top: calc(70px + env(safe-area-inset-top, 0px)); width: min(340px, calc(100vw - 20px));
  max-height: calc(100vh - 150px); overflow-y: auto; -webkit-overflow-scrolling: touch;
  background: rgba(4,20,27,.92); backdrop-filter: blur(10px); border: 1px solid rgba(95,216,255,.45); border-radius: 14px;
  padding: 10px 11px 12px; color: #d8f6ff; font-size: 12px; line-height: 1.45; }
#space-sheet h3 { margin: 0 0 6px; font-size: 10px; letter-spacing: 2px; color: #5fd8ff; font-weight: 600; display: flex; justify-content: space-between; align-items: center; }
#space-sheet .tabs { display: flex; gap: 6px; margin-bottom: 8px; }
#space-sheet .tab, #space-sheet .go, #space-sheet .wp { font: inherit; font-size: 12px; color: #d8f6ff; background: rgba(95,216,255,.1); border: 1px solid rgba(95,216,255,.4);
  border-radius: 10px; padding: 8px 10px; min-height: 44px; text-align: left; line-height: 1.25; }
#space-sheet .tab { flex: 1; text-align: center; min-height: 38px; }
#space-sheet .tab.on { background: rgba(95,216,255,.3); }
#space-sheet .go { display: block; width: 100%; margin: 0 0 6px; }
#space-sheet .go small, #space-sheet .go .sub { display: block; font-size: 10px; color: #8fc8d8; margin-top: 2px; }
#space-sheet .go[disabled] { opacity: .45; }
#space-sheet .go:active:not([disabled]), #space-sheet .tab:active, #space-sheet .wp:active { background: rgba(95,216,255,.4); }
#space-sheet .stop { border-color: rgba(255,120,90,.7); color: #ffd6c9; background: rgba(255,90,60,.14); }
#space-sheet .row { display: flex; gap: 6px; margin: 6px 0; }
#space-sheet .row .wp { flex: 1; text-align: center; min-height: 40px; }
#space-sheet .wp.on { background: rgba(95,216,255,.35); }
#space-sheet .dim { color: #6fa3b3; }
#space-sheet .big { font-size: 15px; color: #fff; }
#space-sheet .close { font: inherit; background: none; border: none; color: #8fc8d8; font-size: 18px; padding: 0 4px; }
@media (max-width: 520px) { #space-sheet { top: calc(96px + env(safe-area-inset-top, 0px)); right: 10px; left: 10px; width: auto; max-height: 48vh; } }
`;

export class SpaceUI {
  constructor(space) {
    this.space = space; this.open = false; this.tab = 'course'; this.acc = 0; this._sig = '';
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    const el = document.createElement('div'); el.id = 'space-sheet'; document.body.appendChild(el);
    this.el = el;
    el.addEventListener('click', (e) => this._click(e));
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
  }

  toggle(tab) {
    if (this.open && this.tab === tab) { this.close(); return; }
    this.open = true; this.tab = tab || this.tab; this._sig = ''; this.el.style.display = 'block'; this.draw(true);
  }
  close() { this.open = false; this.el.style.display = 'none'; }

  _seatOk() {
    const s = this.space.ship.seat;
    return !!s && ['nav', 'pilot', 'captain', 'comms'].includes(s.id);
  }

  update(dt) {
    if (this.open && !this._seatOk()) { this.close(); return; }
    if (!this.open) return;
    this.acc += dt;
    if (this.acc < 0.4) return;
    this.acc = 0;
    this.draw(false);
  }

  draw(force) {
    const sp = this.space, trip = sp.trip && sp.trip.active ? sp.trip : null;
    let h = `<h3><span>NAV COMPUTER</span><button class="close" data-a="close" aria-label="Close">×</button></h3>`;
    h += `<div class="tabs"><button class="tab ${this.tab === 'course' ? 'on' : ''}" data-a="tab" data-t="course">Course</button><button class="tab ${this.tab === 'jobs' ? 'on' : ''}" data-a="tab" data-t="jobs">Jobs</button></div>`;
    if (this.tab === 'jobs') {
      h += `<div>${sp.jobs.summary()}</div>`;
    } else if (trip) {
      const p = trip.progress, d = trip.dest;
      h += `<div class="big">${trip.phase === 'transit' ? 'Drive burning' : trip.phase[0].toUpperCase() + trip.phase.slice(1)} to ${d.name}</div>`;
      if (trip.phase === 'transit') {
        h += `<div>${(p.speed / 1000).toFixed(2)} km/s · ${fmtKm(p.distM)} to go<br>arrival in ${fmtDuration(p.etaS / Math.max(1, trip.warp))}${trip.warp > 1 ? ` (at ×${trip.warp} compression)` : ''}</div>`;
        h += `<div class="dim" style="margin-top:6px">Time compression runs the burn faster. The cabin, crew and doors keep real time; you can walk the ship at any setting.</div><div class="row">`;
        for (const w of DRIVE.warps) h += `<button class="wp ${trip.warp === w ? 'on' : ''}" data-a="warp" data-w="${w}">×${w}</button>`;
        h += `</div>`;
      } else if (trip.phase === 'ascent') h += `<div>${fmtKm(p.distM)} to the gate · ${Math.round(p.speed)} m/s</div>`;
      else h += `<div class="dim">${trip.phase}</div>`;
      h += `<button class="go stop" data-a="cancel">Cancel course<small>${trip.phase === 'transit' ? 'Brakes to a stop where we are' : 'Holds here'}</small></button>`;
    } else {
      const f = sp.ship.flight;
      h += `<div class="dim" style="margin-bottom:6px">${sp.onMoon ? sp.activeMoon.body.name : 'Mars'} · drive ${(DRIVE.thrustN * Math.min(1.8, f.engineFactor) * f.damageFactor / f.massKg).toFixed(1)} m/s² at ${f.power.engines}% engines</div>`;
      for (const d of sp.destinations()) {
        h += `<button class="go" data-a="go" data-d="${d.id}" ${d.ok ? '' : 'disabled'}>${esc(d.name)}<small>${d.ok ? `${fmtKm(d.distM)} · about ${fmtDuration(d.etaS)}` : esc(d.reason)}</small><small>${esc(d.blurb)}</small></button>`;
      }
    }
    if (force || h !== this._sig) { this.el.innerHTML = h; this._sig = h; }
  }

  _click(e) {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    e.preventDefault(); e.stopPropagation();
    const sp = this.space, a = b.dataset.a;
    if (a === 'close') this.close();
    else if (a === 'tab') { this.tab = b.dataset.t; this.draw(true); }
    else if (a === 'warp') { sp.setWarp(Number(b.dataset.w)); this.draw(true); }
    else if (a === 'cancel') { const r = sp.cancel(); if (!r.ok) sp.say(r.msg, true); this.draw(true); }
    else if (a === 'go') { const r = sp.engage(b.dataset.d); sp.say(r.msg, !r.ok); this.draw(true); }
  }
}

const fmtKm = (m) => (m >= 1e5 ? `${(m / 1000).toFixed(0)} km` : m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
