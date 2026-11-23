// ============================================================================
// ui/keepWalking.js - KEEP WALKING: a long walk without a held thumb (phone comfort, 11/23).
//
// Some of the best walks in the game are long: 800 m up the haul road to the ice well, 850 m to the rim of the Listening Scar, 1.1 km to the first
// footprints. On a phone that was minutes of holding the stick hard over. Now, once the stick has been in its run zone for two seconds, a button appears
// in the left dock: "Keep walking". Tap it (with the other thumb) and the walker keeps running the way the view faces; steer by dragging the view; the
// left thumb can let go. It stops when you tap it again ("Stop"), touch the stick again, get where the job was sending you, walk into something, open a
// panel or board a ship.
//
// OWNS: the button and one flag. DOES NOT OWN: the stick (ui/touch.js), the walker, where the button sits (ui/phoneLayout.js docks it on the left).
// Touch only: a keyboard has no thumb to tire, and a gamepad's stick rests under the thumb. COST: a few comparisons a frame.
// ============================================================================
import { bindActivation } from './activation.js';

const SHOW_AFTER_S = 2, LINGER_S = 6, STUCK_S = 1.6, STUCK_SPEED = 0.35;

export class KeepWalking {
  /** o: { touch (TouchControls), note?(text) } */
  constructor(o) {
    this.touch = o.touch; this.note = o.note || null;
    this.on = false; this._runS = 0; this._showS = 0; this._stuckS = 0; this._released = false; this._goal = null; this._shown = false; this._label = '';
    const b = this.btn = document.createElement('button'); b.id = 'btn-keepwalk'; b.className = 'btn'; b.type = 'button'; b.style.display = 'none';
    b.setAttribute('aria-pressed', 'false');
    const st = document.createElement('style');
    st.textContent = '#btn-keepwalk{left:calc(12px + env(safe-area-inset-left,0px));bottom:calc(232px + env(safe-area-inset-bottom,0px));min-width:96px;min-height:48px;font-size:12px;color:#ffd9ac;border-color:rgba(240,185,120,.55)}#btn-keepwalk.on{background:rgba(240,185,120,.3);border-color:#f0b978;color:#fff}';
    document.head.appendChild(st); document.body.appendChild(b);
    bindActivation(b, () => this.toggle());
  }
  toggle() { if (this.on) this.stop(); else { this.on = true; this._released = !this.touch.active; this._stuckS = 0; this._draw(); } }
  stop() { if (!this.on) return; this.on = false; this._showS = LINGER_S; this._draw(); }

  /**
   * Once a frame. s: { dt, onFoot (walking, not aboard, not in the opening), modal (a panel is open), speed (m/s over the ground), goalId (the job step the
   * arrow points at, or null) }. Returns true while the walker should keep going.
   */
  update(s) {
    const t = this.touch;
    if (!t.enabled || !s.onFoot || s.modal) { if (this.on) this.stop(); this._runS = 0; this._showS = 0; this._draw(); return false; }
    if (this.on) {
      if (!t.active) this._released = true;
      else if (this._released) { this.stop(); return false; }                              // the thumb is back on the stick: it has the walker again
      if (this._goal !== null && s.goalId !== this._goal) { this.stop(); return false; }       // arrived: the step it was walking to is done
      this._stuckS = s.speed < STUCK_SPEED ? this._stuckS + s.dt : 0;
      if (this._stuckS > STUCK_S) { this.stop(); if (this.note) this.note('Stopped: something is in the way.'); return false; }
      this._draw(); return true;
    }
    this._goal = s.goalId ?? null;
    this._runS = t.active && t.run ? this._runS + s.dt : 0;
    if (this._runS >= SHOW_AFTER_S) this._showS = LINGER_S; else if (this._showS > 0) this._showS -= s.dt;
    this._draw(); return false;
  }
  /** The stick's numbers this frame, with the lock applied. */
  apply(input) { if (this.on) { input.moveEast = 0; input.moveNorth = 1; input.run = true; } return input; }
  _draw() {
    const show = this.on || this._showS > 0, label = this.on ? 'Stop' : 'Keep walking';
    if (show !== this._shown) { this._shown = show; this.btn.style.display = show ? 'block' : 'none'; }
    if (label !== this._label) { this._label = label; this.btn.textContent = label; this.btn.classList.toggle('on', this.on); this.btn.setAttribute('aria-pressed', String(this.on)); }
  }
  status() { return { on: this.on, shown: this._shown, label: this._label }; }
}
