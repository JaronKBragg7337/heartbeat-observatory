// ============================================================================
// gamepad.js - a controller plays the whole game (2026-11-19). PC pads now; consoles map to the same thing later.
//
// OWNS: reading the standard Gamepad API and turning it into the input the game already understands.
//   * Every action in the game is a key (ui/keyActions.js): the touch buttons already work by sending that key. A pad button does the
//     same, so anything a key or a touch button can do, a pad can do, in every system, with no system knowing a pad exists.
//   * The left stick is the walk / fly keys (W A S D). The right stick turns the view (it adds to the same look the mouse feeds).
//   * The D-pad moves a focus ring over whatever buttons are on screen (panels, the arrivals board, talk answers); A presses the
//     focused one, B closes. With no ring showing, A is jump.
// DOES NOT OWN: what any key does. Platform-neutral on purpose: no user-agent checks, no vendor names.
//
// Standard mapping (https://w3c.github.io/gamepad/#remapping): 0 A, 1 B, 2 X, 3 Y, 4 LB, 5 RB, 6 LT, 7 RT, 8 View, 9 Menu,
// 10 L3, 11 R3, 12-15 D-pad up/down/left/right. Axes 0,1 left stick; 2,3 right stick.
// ============================================================================

/** Button -> the key it stands for. (The same codes as ui/keyActions.js.) */
export const PAD_KEYS = {
  0: 'Space',       // A: jump / ascend (or press the focused button)
  1: 'Escape',      // B: close panels
  2: 'KeyE',        // X: use / dig / lift
  3: 'KeyT',        // Y: talk / hire
  4: 'KeyQ',        // LB: drop one
  5: 'KeyC',        // RB: climb / descend
  6: 'ShiftLeft',   // LT: run
  7: 'KeyF',        // RT: fire
  8: 'KeyV',        // View: first / third person
  11: 'KeyR',       // R3: drop all
};
export const PAD_HELP = 'Controller: left stick move · right stick look · A jump · X use · Y talk · LT run · RT fire · D-pad menus · B close';

const DEAD = 0.2, STICK_KEY = 0.42, LOOK_RATE = 2.6;     // look: radians a second at full stick
const FOCUSABLE = 'button, [role="button"], a[href], input, select, summary';

export class GamepadControls {
  /** @param desktop DesktopControls (its lookDX / lookDY take the right stick) */
  constructor(desktop, opts = {}) {
    this.desktop = desktop;
    this.down = new Set();         // key codes this pad is holding
    this.btn = [];                 // last frame's button states
    this.active = false;           // a pad has been used this session
    this.focus = null;             // the element under the focus ring
    this.repeatT = 0;
    this.toolIdx = 0;
    this.onFirstUse = opts.onFirstUse || null;
    const st = document.createElement('style');
    st.textContent = '.pad-focus{outline:3px solid #ffd27a !important;outline-offset:2px !important;box-shadow:0 0 0 6px rgba(255,210,122,.25) !important}';
    document.head.appendChild(st);
    window.addEventListener('blur', () => this.releaseAll());
    // any other kind of input takes the ring away (a mouse or a thumb does not need it)
    window.addEventListener('pointerdown', () => this.setFocus(null), true);
  }

  _key(type, code) { window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true })); }
  press(code) { if (this.down.has(code)) return; this.down.add(code); this._key('keydown', code); }
  release(code) { if (!this.down.has(code)) return; this.down.delete(code); this._key('keyup', code); }
  releaseAll() { for (const c of [...this.down]) this.release(c); }

  _pad() {
    const list = navigator.getGamepads ? navigator.getGamepads() : [];
    let best = null;
    for (const p of list) if (p && p.connected && (!best || (p.mapping === 'standard' && best.mapping !== 'standard'))) best = p;
    return best;
  }

  /** Call once a frame, before the game reads its input. */
  poll(dt) {
    const p = this._pad();
    if (!p) { if (this.down.size) this.releaseAll(); return; }
    const ax = (i) => { const v = p.axes[i] || 0; return Math.abs(v) < DEAD ? 0 : (v - Math.sign(v) * DEAD) / (1 - DEAD); };
    const b = (i) => !!(p.buttons[i] && (p.buttons[i].pressed || p.buttons[i].value > 0.5));
    const lx = ax(0), ly = ax(1), rx = ax(2), ry = ax(3);
    if (!this.active && (lx || ly || rx || ry || p.buttons.some((q) => q && q.pressed))) {
      this.active = true; document.documentElement.dataset.input = 'gamepad';
      if (this.onFirstUse) { try { this.onFirstUse(); } catch { /* a hint is never worth a crash */ } }
    }
    if (!this.active) return;

    // left stick: the walk / fly keys
    const want = { KeyW: ly < -STICK_KEY, KeyS: ly > STICK_KEY, KeyA: lx < -STICK_KEY, KeyD: lx > STICK_KEY };
    for (const code in want) { if (want[code]) this.press(code); else this.release(code); }
    // right stick: the view (the curve gives fine aim near the centre)
    if (this.desktop && (rx || ry)) {
      this.desktop.lookDX += Math.sign(rx) * rx * rx * LOOK_RATE * dt;
      this.desktop.lookDY += Math.sign(ry) * ry * ry * LOOK_RATE * 0.8 * dt;
    }

    // D-pad: the focus ring (with a repeat while held)
    const dir = b(12) ? [0, -1] : b(13) ? [0, 1] : b(14) ? [-1, 0] : b(15) ? [1, 0] : null;
    if (dir) {
      this.repeatT -= dt;
      if (!this._dirHeld || this.repeatT <= 0) { this.moveFocus(dir[0], dir[1]); this.repeatT = this._dirHeld ? 0.14 : 0.36; }
      this._dirHeld = true;
    } else this._dirHeld = false;
    if (this.focus && !this._usable(this.focus)) this.setFocus(null);

    for (let i = 0; i < p.buttons.length; i++) {
      const now = b(i), was = !!this.btn[i]; this.btn[i] = now;
      if (now === was) continue;
      if (i === 0 && this.focus) { if (now) this.focus.click(); continue; }                  // A presses the focused button
      if (i === 1 && now && this.focus) this.setFocus(null);                                    // B also drops the ring (and closes, below)
      if (i === 9) { if (now) { const s = document.getElementById('btn-settings'); if (s) s.click(); } continue; }      // Menu: settings
      if (i === 10) { if (now) { this.toolIdx = (this.toolIdx + 1) % 3; const c = 'Digit' + (this.toolIdx + 1); this._key('keydown', c); this._key('keyup', c); } continue; }   // L3: next tool
      const code = PAD_KEYS[i];
      if (code) { if (now) this.press(code); else this.release(code); }
    }
  }

  _usable(el) {
    if (!el || !el.isConnected || el.disabled) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || cs.pointerEvents === 'none' || Number(cs.opacity) < 0.05) return false;
    // what is really on top there? (a button under a panel is not reachable)
    const top = document.elementFromPoint(Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2)), Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2)));
    return !!top && (top === el || el.contains(top) || top.contains(el));
  }

  setFocus(el) {
    if (this.focus === el) return;
    if (this.focus) this.focus.classList.remove('pad-focus');
    this.focus = el;
    if (el) { el.classList.add('pad-focus'); try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch { /* old engines */ } }
  }

  /** Move the ring to the nearest usable control in a direction (or to the first one when there is no ring yet). */
  moveFocus(dx, dy) {
    const all = [...document.querySelectorAll(FOCUSABLE)].filter((el) => !el.id || !el.id.startsWith('touch-key-') || this._usable(el)).filter((el) => this._usable(el));
    if (!all.length) { this.setFocus(null); return; }
    if (!this.focus || !all.includes(this.focus)) {
      // start from the control nearest the middle of the screen, leaning the way that was pressed
      const cx = innerWidth / 2 + dx * innerWidth * 0.2, cy = innerHeight / 2 + dy * innerHeight * 0.2;
      let best = null, bd = 1e9;
      for (const el of all) { const r = el.getBoundingClientRect(), d = Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2 - cy); if (d < bd) { bd = d; best = el; } }
      this.setFocus(best); return;
    }
    const r0 = this.focus.getBoundingClientRect(), x0 = r0.left + r0.width / 2, y0 = r0.top + r0.height / 2;
    let best = null, bs = 1e9;
    for (const el of all) {
      if (el === this.focus) continue;
      const r = el.getBoundingClientRect(), ex = r.left + r.width / 2 - x0, ey = r.top + r.height / 2 - y0;
      const along = ex * dx + ey * dy, across = Math.abs(ex * dy) + Math.abs(ey * dx);
      if (along < 6) continue;
      const score = along + across * 2.2;
      if (score < bs) { bs = score; best = el; }
    }
    if (best) this.setFocus(best);
    else {
      // nothing further that way: a scrolling panel moves instead
      let sc = this.focus.parentElement;
      while (sc && !(sc.scrollHeight > sc.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
      if (sc && dy) sc.scrollBy({ top: dy * 120 });
    }
  }
}

/** What the player is holding right now: 'pad' once a controller has been used, else 'touch' on a touch screen, else 'keys'. */
export function inputKind() {
  if (document.documentElement.dataset.input === 'gamepad') return 'pad';
  return ('ontouchstart' in window || navigator.maxTouchPoints > 0) ? 'touch' : 'keys';
}
/** The same hint in the words of the device in the player's hands. */
export function hintFor(h) { const k = inputKind(); return h[k] || h.keys; }
