// The DOM side: HUD, toasts, cards. Plain DOM, no framework.
const $ = (id) => document.getElementById(id);

export function fmtTime(s) {
  s = Math.max(0, s); const m = Math.floor(s / 60), r = Math.floor(s % 60);
  return `${m}:${r < 10 ? '0' : ''}${r}`;
}

export function createHud() {
  const el = {
    hud: $('hud'), label: $('hudLabel'), time: $('hudTime'), heart: $('heart'), bpm: $('bpm'), hearts: $('hearts'),
    woods: $('woods'), woodsArrow: $('woodsArrow'), stamina: $('stamina'), staminaBar: $('staminaBar'), action: $('btnAction'),
    toast: $('toast'), hint: $('hint'), dev: $('dev'), hurt: $('hurt'), mute: $('btnMute'),
  };
  let toastT = 0, hintT = 0, lastTime = -1, lastHearts = -1, lastStam = -1, lastArrow = 1e9;
  const screens = ['loading', 'title', 'between', 'result', 'pause', 'ending', 'glLost'];

  const hud = {
    el,
    show(on) { el.hud.hidden = !on; if (!on) { el.action.hidden = true; el.stamina.hidden = true; } },
    screen(name) { for (const s of screens) $(s).hidden = s !== name; },
    hideScreens() { for (const s of screens) $(s).hidden = true; },
    setup(game) {
      el.label.textContent = game.hud.label;
      el.heart.hidden = game.kind !== 'find';
      el.hearts.hidden = game.kind !== 'hunted';
      el.woods.hidden = !game.hud.arrow;
      el.action.hidden = !game.hud.action;
      if (game.hud.action) el.action.textContent = game.hud.action;
      el.stamina.hidden = game.kind === 'escape';
      lastTime = -1; lastHearts = -1; lastStam = -1; lastArrow = 1e9;
      if (game.kind === 'hunted') { el.hearts.innerHTML = ''; for (let i = 0; i < game.hud.hearts; i++) el.hearts.appendChild(document.createElement('i')); }
    },
    update(game, dt, camYaw) {
      const h = game.hud;
      const sec = Math.floor(h.time); if (sec !== lastTime) { el.time.textContent = fmtTime(h.time); lastTime = sec; }
      if (game.kind === 'find') el.bpm.textContent = Math.round(h.bpm);
      if (game.kind === 'hunted' && h.hearts !== lastHearts) {
        [...el.hearts.children].forEach((c, i) => c.classList.toggle('gone', i >= h.hearts)); lastHearts = h.hearts;
      }
      if (!el.stamina.hidden) {
        const s = Math.round(h.stamina * 100) / 100;
        if (s !== lastStam) { el.staminaBar.style.transform = `scaleX(${s})`; el.stamina.classList.toggle('show', s < 0.99); el.stamina.classList.toggle('low', s < 0.25); lastStam = s; }
      }
      if (!el.woods.hidden) {
        // points south (toward the woods) relative to the camera
        let a = camYaw; while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI;
        const deg = Math.round((a * 180) / Math.PI);
        if (deg !== lastArrow) { el.woodsArrow.style.transform = `rotate(${deg}deg)`; lastArrow = deg; }
      }
      if (!el.action.hidden) el.action.classList.toggle('cool', !!h.down);
      if (toastT > 0 && (toastT -= dt) <= 0) el.toast.classList.remove('on');
      if (hintT > 0 && (hintT -= dt) <= 0) { el.hint.classList.add('fade'); setTimeout(() => { if (hintT <= 0) el.hint.hidden = true; }, 700); }
    },
    toast(text, secs = 1.6, big = false) {
      el.toast.textContent = text; el.toast.classList.toggle('big', big); el.toast.classList.add('on'); toastT = secs;
    },
    hint(text, secs = 5) { el.hint.textContent = text; el.hint.hidden = false; el.hint.classList.remove('fade'); hintT = secs; },
    beat() { el.heart.classList.remove('beat'); void el.heart.offsetWidth; el.heart.classList.add('beat'); },
    hurt() { el.hurt.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => el.hurt.classList.remove('on'))); },
    setMuted(m) { el.mute.classList.toggle('off', m); el.mute.setAttribute('aria-label', m ? 'Sound off' : 'Sound on'); },
    dev(text) { el.dev.hidden = false; el.dev.textContent = text; },
  };
  return hud;
}
