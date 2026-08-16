// ============================================================================
// touch.js — the stick is not on the screen until your thumb is.
//
// OWNS: touch input. A movement stick on the left half, a look drag on the
//       right half, and the rule that neither one draws anything until it is
//       actually being used.
// DOES NOT OWN: what the input means (walker.js) or how it looks in 3D.
//
// THE RULE
// --------
// No permanent joystick graphic sitting in the corner. The left half of the
// screen IS the stick: touch anywhere there and the stick is born under your
// thumb at exactly that point. Lift, and it vanishes completely.
//
// Two reasons that is better than a fixed pad, beyond the screen being clean:
//   1. Your thumb never has to find a target it cannot see while looking at
//      the world. Wherever it lands is correct by definition.
//   2. On a 6.7" phone a fixed stick is either in a comfortable place or a
//      visible place, rarely both.
//
// Multi-touch is tracked per pointer id, so walking and looking at the same
// time works — which is the whole point of splitting the screen in half.
// ============================================================================

const DEAD_ZONE_PX = 6;
const MAX_RADIUS_PX = 62;      // thumb travel for full deflection
const RUN_THRESHOLD = 0.82;    // push most of the way to run

export class TouchControls {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.enabled = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    // Movement
    this.moveEast = 0;
    this.moveNorth = 0;
    this.run = false;

    // Look, consumed and zeroed each frame
    this.lookDX = 0;
    this.lookDY = 0;

    this.jumpQueued = false;
    this.active = false;         // is the stick currently held

    this._stick = null;          // { id, ox, oy, x, y }
    this._look = null;           // { id, lastX, lastY }
    this.lookSensitivity = opts.lookSensitivity || 0.0042;

    this._buildStickVisual();
    this._bind();
  }

  // --- The visual. Two rings, hidden by default, drawn in DOM so it costs the
  // renderer nothing and stays crisp at any DPR. ----------------------------
  _buildStickVisual() {
    const wrap = document.createElement('div');
    wrap.id = 'stick-layer';
    wrap.innerHTML = `
      <div id="stick-base"></div>
      <div id="stick-nub"></div>`;
    document.body.appendChild(wrap);
    this.el = wrap;
    this.base = wrap.querySelector('#stick-base');
    this.nub = wrap.querySelector('#stick-nub');
    this._hide();
  }

  _show(x, y) {
    this.base.style.transform = `translate(${x}px, ${y}px)`;
    this.nub.style.transform = `translate(${x}px, ${y}px)`;
    this.el.style.opacity = '1';
  }

  _hide() { this.el.style.opacity = '0'; }

  _moveNub(x, y) { this.nub.style.transform = `translate(${x}px, ${y}px)`; }

  _bind() {
    const c = this.canvas;
    const opt = { passive: false };

    c.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;     // mouse uses pointer lock
      const leftHalf = e.clientX < window.innerWidth * 0.5;

      if (leftHalf && !this._stick) {
        this._stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
        this.active = true;
        this._show(e.clientX, e.clientY);
        e.preventDefault();
      } else if (!leftHalf && !this._look) {
        this._look = { id: e.pointerId, lastX: e.clientX, lastY: e.clientY, startX: e.clientX, startY: e.clientY, t0: performance.now(), moved: 0 };
        e.preventDefault();
      }
    }, opt);

    c.addEventListener('pointermove', (e) => {
      if (this._stick && e.pointerId === this._stick.id) {
        this._stick.x = e.clientX; this._stick.y = e.clientY;
        let dx = e.clientX - this._stick.ox;
        let dy = e.clientY - this._stick.oy;
        const len = Math.hypot(dx, dy);

        if (len > MAX_RADIUS_PX) {
          // Drag the origin along so a long swipe keeps working instead of
          // pinning at full deflection with the nub stuck off-centre.
          const k = (len - MAX_RADIUS_PX) / len;
          this._stick.ox += dx * k;
          this._stick.oy += dy * k;
          dx = e.clientX - this._stick.ox;
          dy = e.clientY - this._stick.oy;
          this._show(this._stick.ox, this._stick.oy);
        }

        const l2 = Math.hypot(dx, dy);
        if (l2 < DEAD_ZONE_PX) { this.moveEast = 0; this.moveNorth = 0; this.run = false; }
        else {
          const norm = Math.min(1, l2 / MAX_RADIUS_PX);
          this.moveEast = (dx / l2) * norm;
          this.moveNorth = (-dy / l2) * norm;   // screen up = north
          this.run = norm > RUN_THRESHOLD;
        }
        this._moveNub(e.clientX, e.clientY);
        e.preventDefault();
      }

      if (this._look && e.pointerId === this._look.id) {
        const dx = e.clientX - this._look.lastX;
        const dy = e.clientY - this._look.lastY;
        this.lookDX += dx * this.lookSensitivity;
        this.lookDY += dy * this.lookSensitivity;
        this._look.moved += Math.hypot(dx, dy);
        this._look.lastX = e.clientX; this._look.lastY = e.clientY;
        e.preventDefault();
      }
    }, opt);

    const end = (e) => {
      if (this._stick && e.pointerId === this._stick.id) {
        this._stick = null;
        this.moveEast = 0; this.moveNorth = 0; this.run = false;
        this.active = false;
        this._hide();
      }
      if (this._look && e.pointerId === this._look.id) {
        // A quick tap on the right half that barely moved is a jump, so
        // jumping needs no button taking up screen space.
        const dt = performance.now() - this._look.t0;
        if (dt < 260 && this._look.moved < 12) this.jumpQueued = true;
        this._look = null;
      }
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);

    // Stop iOS rubber-banding and the double-tap zoom from fighting the game.
    document.addEventListener('touchmove', (e) => { if (e.touches.length) e.preventDefault(); }, opt);
    document.addEventListener('gesturestart', (e) => e.preventDefault());
  }

  /** Read and clear per-frame look deltas. */
  consumeLook() {
    const d = { dx: this.lookDX, dy: this.lookDY };
    this.lookDX = 0; this.lookDY = 0;
    return d;
  }

  consumeJump() {
    const j = this.jumpQueued;
    this.jumpQueued = false;
    return j;
  }
}

// ---------------------------------------------------------------------------
// Keyboard + mouse, for the same one client on a desktop browser.
// ---------------------------------------------------------------------------
export class DesktopControls {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.keys = new Set();
    this.lookDX = 0; this.lookDY = 0;
    this.sensitivity = opts.sensitivity || 0.0022;
    this.locked = false;

    window.addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    canvas.addEventListener('click', () => { if (!this.locked) canvas.requestPointerLock?.(); });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.lookDX += e.movementX * this.sensitivity;
      this.lookDY += e.movementY * this.sensitivity;
    });
  }

  get moveEast() { return (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0); }
  get moveNorth() { return (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0); }
  get run() { return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'); }

  consumeLook() {
    const d = { dx: this.lookDX, dy: this.lookDY };
    this.lookDX = 0; this.lookDY = 0;
    return d;
  }

  consumeJump() {
    if (this.keys.has('Space')) { this.keys.delete('Space'); return true; }
    return false;
  }
}
