// ============================================================================
// touch.js — mobile/touch control layer (virtual joystick, look, buttons).
//
// OWNS: on-screen touch controls and their translation into virtual key
//       presses + look deltas on the shared Input (engine.js).
// DOES NOT OWN: what keys mean (systems read Input exactly as with keyboard).
//
// DESIGN: zero changes required in gameplay systems — touch presses go
// through Input.setVirtual('KeyW', …) etc., and look drags feed the same
// mouseDX/mouseDY the mouse uses. If it plays on keyboard, it plays on touch.
//
// LAYOUT (thumbs): left = movement joystick; right = drag to look; button
// clusters bottom-right (actions) and right edge (ship throttle/brake).
//
// Future agents: tune sizes/deadzones here; add haptics (navigator.vibrate)
// on pickups/landings; contextual button relabeling reads traversal mode.
// ============================================================================

const JOY_R = 64;        // joystick base radius (px)
const DEAD = 0.25;       // joystick deadzone fraction
const LOOK_SENS = 2.4;   // touch-look multiplier vs mouse pixels

export function isTouchDevice() {
  return ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
}

export function initTouch(input, root) {
  if (!isTouchDevice()) return false;
  input.touchMode = true;

  const wrap = document.createElement('div');
  wrap.id = 'touch-root';
  wrap.innerHTML = `
    <div id="joy-base"><div id="joy-knob"></div></div>
    <div id="touch-btns">
      <button data-code="KeyE"  class="tbtn">E</button>
      <button data-code="KeyF"  class="tbtn">F</button>
      <button data-code="KeyB"  class="tbtn">B</button>
      <button data-code="KeyM"  class="tbtn">M</button>
      <button data-code="Space" class="tbtn wide">JUMP / THRUST</button>
    </div>
    <div id="ship-btns">
      <button data-code="KeyW" class="tbtn hold">THR +</button>
      <button data-code="KeyS" class="tbtn hold">THR −</button>
      <button data-code="KeyA" class="tbtn hold">&#9664; TURN</button>
      <button data-code="KeyD" class="tbtn hold">TURN &#9654;</button>
      <button data-code="KeyX" class="tbtn hold">BRAKE</button>
      <button data-code="KeyG" class="tbtn">GEAR</button>
    </div>`;
  const style = document.createElement('style');
  style.textContent = `
    #touch-root { position:fixed; inset:0; pointer-events:none; z-index:30;
                  font-family:inherit; -webkit-user-select:none; user-select:none; }
    #joy-base { position:absolute; left:26px; bottom:calc(30px + env(safe-area-inset-bottom, 0px));
                width:${JOY_R * 2}px; height:${JOY_R * 2}px;
                border:2px solid rgba(207,216,220,0.45); border-radius:50%;
                background:rgba(8,12,16,0.35); pointer-events:auto; touch-action:none; }
    #joy-knob { position:absolute; left:50%; top:50%; width:46px; height:46px; margin:-23px 0 0 -23px;
                border-radius:50%; background:rgba(183,28,28,0.75); border:1px solid #ef9a9a; }
    #touch-btns { position:absolute; right:16px; bottom:26px; display:grid;
                  grid-template-columns:repeat(4, 54px); gap:8px; pointer-events:auto; }
    #ship-btns { position:absolute; right:16px; top:32%; display:none; flex-direction:column;
                 gap:8px; pointer-events:auto; }
    #touch-root.piloting #ship-btns { display:flex; }
    #touch-root.panel-open #joy-base,
    #touch-root.panel-open #touch-btns,
    #touch-root.panel-open #ship-btns { display:none; }
    .tbtn { height:48px; border-radius:10px; border:1px solid #455a64; color:#cfd8dc;
            background:rgba(8,12,16,0.6); font-size:13px; font-weight:600; touch-action:none; }
    .tbtn:active { background:rgba(183,28,28,0.6); border-color:#ef9a9a; }
    .tbtn.wide { grid-column:1 / span 4; }
    #ship-btns .tbtn { width:86px; }
    @media (max-width: 700px) {
      #joy-base { left:18px; bottom:calc(22px + env(safe-area-inset-bottom, 0px));
                  width:112px; height:112px; }
      #joy-knob { width:40px; height:40px; margin:-20px 0 0 -20px; }
      #touch-btns { right:12px; bottom:calc(20px + env(safe-area-inset-bottom, 0px));
                    grid-template-columns:repeat(4, 42px); gap:6px; }
      #ship-btns { right:12px; top:30%; gap:7px; }
      #ship-btns .tbtn { width:78px; }
      .tbtn { height:42px; border-radius:9px; font-size:12px; }
      .tbtn.wide { height:42px; }
    }
  `;
  document.head.appendChild(style);
  (root || document.body).appendChild(wrap);
  setInterval(() => {
    const mode = window.game?.traversal?.mode;
    wrap.classList.toggle('piloting', mode === 'PILOTING');
    wrap.classList.toggle('panel-open', !!document.querySelector('.syl-panel[style*="display: block"]'));
  }, 250);

  // --- Buttons → virtual keys (hold-to-press; taps still register once). ---
  wrap.querySelectorAll('.tbtn').forEach((btn) => {
    const code = btn.dataset.code;
    const on = (e) => { e.preventDefault(); input.setVirtual(code, true); };
    const off = (e) => { e.preventDefault(); input.setVirtual(code, false); };
    btn.addEventListener('touchstart', on, { passive: false });
    btn.addEventListener('touchend', off, { passive: false });
    btn.addEventListener('touchcancel', off, { passive: false });
  });

  // --- Joystick → WASD virtual keys. ---------------------------------------
  const base = wrap.querySelector('#joy-base');
  const knob = wrap.querySelector('#joy-knob');
  let joyId = null;
  function setMove(dx, dy, radius = JOY_R) {
    // dx right+, dy down+ (screen). Map to WASD with deadzone.
    const mag = Math.hypot(dx, dy) / radius;
    input.setVirtual('KeyD', mag > DEAD && dx > Math.abs(dy) * 0.5);
    input.setVirtual('KeyA', mag > DEAD && -dx > Math.abs(dy) * 0.5);
    input.setVirtual('KeyS', mag > DEAD && dy > Math.abs(dx) * 0.5);
    input.setVirtual('KeyW', mag > DEAD && -dy > Math.abs(dx) * 0.5);
    input.setVirtual('ShiftLeft', mag > 0.92); // slam the stick = run
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
  }
  base.addEventListener('touchstart', (e) => {
    e.preventDefault();
    joyId = e.changedTouches[0].identifier;
  }, { passive: false });
  base.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier !== joyId) continue;
      const r = base.getBoundingClientRect();
      const radius = r.width / 2;
      let dx = t.clientX - (r.left + radius), dy = t.clientY - (r.top + radius);
      const d = Math.hypot(dx, dy);
      if (d > radius) { dx *= radius / d; dy *= radius / d; }
      setMove(dx, dy, radius);
    }
  }, { passive: false });
  const joyEnd = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === joyId) { joyId = null; setMove(0, 0); }
    }
  };
  base.addEventListener('touchend', joyEnd);
  base.addEventListener('touchcancel', joyEnd);

  // --- Look: drag anywhere else on screen (canvas area). -------------------
  const looks = new Map(); // touchId -> {x,y}
  window.addEventListener('touchstart', (e) => {
    for (const t of e.changedTouches) {
      if (e.target.closest && e.target.closest('#joy-base, .tbtn, .syl-panel')) continue;
      looks.set(t.identifier, { x: t.clientX, y: t.clientY });
    }
  }, { passive: true });
  window.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      const prev = looks.get(t.identifier);
      if (!prev) continue;
      input.mouseDX += (t.clientX - prev.x) * LOOK_SENS;
      input.mouseDY += (t.clientY - prev.y) * LOOK_SENS;
      prev.x = t.clientX; prev.y = t.clientY;
    }
  }, { passive: true });
  const lookEnd = (e) => { for (const t of e.changedTouches) looks.delete(t.identifier); };
  window.addEventListener('touchend', lookEnd);
  window.addEventListener('touchcancel', lookEnd);

  return true;
}
