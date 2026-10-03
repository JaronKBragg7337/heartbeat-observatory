// phoneLayout.js - one real phone layout. Every floating game button lives in a docked flex column (so two can never sit on top of
// each other), the flight speed bar has its own row, and any press gets instant feedback and a pending state.
//
// Before (10/3, Jaron's iPhone): each module pinned its own button with its own "bottom: 120px / 176px / 230px", so Hold to talk,
// Talk to crew, the speed bar, LIFT, SINK, Stand and Controls stacked on each other. Now the modules still own WHAT each button does
// and WHEN it shows; this file owns WHERE. On touch devices (or a window narrower than 520px) matching buttons are moved into:
//   #dock-right  (column, bottom up)  the thing you do now: action / tool / drop / climb / talk-to-crew / deliver / fire / sink / lift
//   #dock-left   (column, bottom up)  Controls, World / crew, the market stall button, Hold to talk
//   #dock-bottom (its own row)        the flight speed bar
// Showing and hiding stays with the modules (display), so a hidden button takes no room.

export const DOCKS = {
  right: ['#btn-action', '#btn-tool', '#btn-drop-all', '#btn-climb', '#crew-talk', '#quest-deliver', '#btn-fire', '#btn-sink', '#btn-lift'],
  left: ['#key-controls', '#multiplayer-button', '#shop-button', '#voice-talk'],
  bottom: ['#ff-bar', '#flight-speed'],   // FREEFLIGHT: the free-flight bar has the bottom row while it is on
};
// A panel that opens over the screen is a modal: the dock steps aside while it is open.
const MODALS = ['#multiplayer-panel:not([hidden])', '#crew-panel', '#account-panel', '#space-sheet', '#settings-panel.open', '#shop-panel'];

const CSS = `
#phone-ui{position:fixed;inset:0;z-index:68;pointer-events:none;display:flex;flex-direction:column;justify-content:flex-end;
  padding:0 calc(12px + env(safe-area-inset-right,0px)) calc(12px + env(safe-area-inset-bottom,0px)) calc(12px + env(safe-area-inset-left,0px));gap:8px;box-sizing:border-box}
#phone-ui #phone-main{display:flex;justify-content:space-between;align-items:flex-end;gap:8px;min-height:0}
#phone-ui .dock{display:flex;flex-direction:column-reverse;gap:8px;min-width:0;pointer-events:none}
#phone-ui #dock-left{align-items:flex-start}#phone-ui #dock-right{align-items:flex-end}
#phone-ui.modal .dock,#phone-ui.modal #dock-bottom{visibility:hidden}
#phone-ui.pad-open #dock-right,#phone-ui.pad-open #dock-bottom,#phone-ui.pad-open #dock-left>:not(#key-controls){visibility:hidden}
#phone-ui .dk{position:static!important;inset:auto!important;transform:none!important;margin:0!important;pointer-events:auto;box-sizing:border-box;
  min-width:96px!important;max-width:46vw;min-height:48px!important;flex:none}
#phone-ui .sbtn.dk,#phone-ui .cbtn.dk{font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace}
#phone-ui #key-controls.dk{position:relative!important;min-width:0!important;min-height:0!important;pointer-events:none}
#phone-ui #key-controls.dk #btn-key-controls{min-width:96px;min-height:48px}
#phone-ui #key-controls.dk #key-pad{position:absolute;left:0;bottom:calc(100% + 8px)}
#phone-ui #flight-speed.dk{max-width:none;width:100%;display:block}
#phone-ui #flight-speed.dk[hidden]{display:none}
#phone-ui #flight-speed.dk button{min-width:48px;min-height:44px}
#phone-ui #ff-bar.dk{max-width:none;width:100%}
#phone-ui #ff-bar.dk[hidden]{display:none}
html.phone-ui #hud{max-width:calc(100vw - 118px)}
html.phone-ui #voice-heard{top:calc(var(--hud-bottom,64px) + 46px)}
html.phone-ui #ship-panel{max-height:calc(var(--dock-top,60vh) - 96px - env(safe-area-inset-top,0px))}
/* instant feedback: every button answers the moment a finger lands, and shows it is waiting while the shared world decides */
button.pressed,a.btn.pressed{filter:brightness(1.45)}
button.pending{opacity:.72}
button.pending::after{content:"";display:inline-block;width:.8em;height:.8em;margin-left:.6em;vertical-align:-.1em;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:hbspin .7s linear infinite}
button.refused{animation:hbshake .35s}
@keyframes hbspin{to{transform:rotate(360deg)}}
@keyframes hbshake{25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}
`;

export function isPhoneUi() {
  try { return 'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth <= 520; } catch { return false; }
}

export class PhoneLayout {
  constructor() {
    this.phone = isPhoneUi();
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    this._feedback();
    if (!this.phone) return;
    document.documentElement.classList.add('phone-ui');
    const root = document.createElement('div'); root.id = 'phone-ui';
    root.innerHTML = '<div id="phone-main"><div class="dock" id="dock-left"></div><div class="dock" id="dock-right"></div></div><div class="dock" id="dock-bottom"></div>';
    document.body.appendChild(root);
    this.root = root;
    this.docks = { left: root.querySelector('#dock-left'), right: root.querySelector('#dock-right'), bottom: root.querySelector('#dock-bottom') };
    this.update();
    this.timer = setInterval(() => this.update(), 250);
    window.addEventListener('resize', () => this.update());
  }

  /** Move any not-yet-docked button into its dock (modules create them at different times), then measure. */
  update() {
    if (!this.phone) return;
    for (const [dock, list] of Object.entries(DOCKS)) list.forEach((sel, i) => {
      const el = document.querySelector(sel); if (!el) return;
      if (!el.classList.contains('dk')) { el.classList.add('dk'); this.docks[dock].appendChild(el); }
      el.style.order = String(i);
    });
    const modal = MODALS.some(sel => { const el = document.querySelector(sel); return el && getComputedStyle(el).display !== 'none'; });
    this.root.classList.toggle('modal', modal);
    this.root.classList.toggle('pad-open', document.querySelector('#key-pad')?.style.display === 'grid');
    // top edge of the highest visible docked button: panels higher on the screen stop above it
    let top = innerHeight;
    for (const el of this.root.querySelectorAll('.dk')) { const r = el.getBoundingClientRect(); if (r.width > 0 && r.height > 0) top = Math.min(top, r.top); }
    document.documentElement.style.setProperty('--dock-top', Math.round(top) + 'px');
    const hud = document.getElementById('hud');
    if (hud) document.documentElement.style.setProperty('--hud-bottom', Math.round(hud.getBoundingClientRect().bottom) + 'px');
  }

  /** The press is shown on the pointer-down, not after the round trip; an action that goes to the shared world shows a spinner until its receipt. */
  _feedback() {
    let last = null;
    document.addEventListener('pointerdown', e => {
      const b = e.target.closest?.('button,a.btn'); if (!b || b.disabled) return;
      b.classList.add('pressed'); last = { b, t: performance.now() };
      const off = () => { b.classList.remove('pressed'); document.removeEventListener('pointerup', off, true); document.removeEventListener('pointercancel', off, true); };
      document.addEventListener('pointerup', off, true); document.addEventListener('pointercancel', off, true);
      setTimeout(off, 1500);
    }, true);
    const waiting = new Map();
    window.addEventListener('cosmos-request', e => {
      const id = e.detail.id, b = last && performance.now() - last.t < 1500 ? last.b : null;
      if (!b || !document.contains(b)) return;
      b.classList.add('pending'); b.setAttribute('aria-busy', 'true');
      const done = () => { b.classList.remove('pending'); b.removeAttribute('aria-busy'); };
      waiting.set(id, { b, done, timer: setTimeout(() => { done(); waiting.delete(id); }, 10000) });
    });
    window.addEventListener('cosmos-receipt', e => {
      const w = waiting.get(e.detail.id); if (!w) return;
      clearTimeout(w.timer); w.done(); waiting.delete(e.detail.id);
      if (!e.detail.ok) { w.b.classList.add('refused'); setTimeout(() => w.b.classList.remove('refused'), 400); }
    });
  }
}
