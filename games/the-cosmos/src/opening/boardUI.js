// ============================================================================
// opening/boardUI.js - the arrivals board (BIBLE-v3 10.1 step 3): every world and every faction, a picture, a few plain lines and the live
// numbers, and the choice. Plain DOM over the game, phone first: one column, big touch targets, a row of world chips that scrolls sideways.
// The data is opening/worlds.js boardData() (registries, F0's style sheet, the economy tables, the shared world's own counts).
// The board only asks: it calls onPick({ world, faction, stay }) and the authority decides (src/opening/state.js _pick).
// ============================================================================
import { drawEmblem } from '../factions/emblems.js';
import { boardFmt, boardDayText } from './worlds.js';
import { bindActivation } from '../ui/activation.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hex = (n) => '#' + (n >>> 0).toString(16).padStart(6, '0');
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** A picture of a world (canvas, drawn from nothing: no download): a lit disc over stars. */
export function drawWorld(canvas, id) {
  const g = canvas.getContext('2d'), W = canvas.width, H = canvas.height, r = rng(id.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
  g.fillStyle = '#05060a'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 140; i++) { g.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.7})`; g.fillRect(r() * W, r() * H, r() < 0.1 ? 2 : 1, r() < 0.1 ? 2 : 1); }
  const R = H * 0.42, cx = W * 0.5, cy = H * 0.52;
  const look = {
    mars: { base: '#b8693a', dark: '#7a3f25', light: '#e0a66a', cap: true, atm: '#e8a070' },
    ceres: { base: '#5d5853', dark: '#37332f', light: '#9a948b', bright: true, atm: null },
    moon: { base: '#8f8f8d', dark: '#55555a', light: '#c9c8c2', atm: null, maria: true },
    earth: { base: '#2a5aa6', dark: '#173a73', light: '#4a8a4a', clouds: true, atm: '#7fb0ff' },
    callisto: { base: '#4a443d', dark: '#2b2723', light: '#a8a193', bright: true, atm: null },
  }[id] || { base: '#666', dark: '#333', light: '#999', atm: null };
  g.save(); g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.clip();
  g.fillStyle = look.base; g.fillRect(cx - R, cy - R, R * 2, R * 2);
  for (let i = 0; i < 46; i++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * R * 0.95, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d, s = (look.maria ? 10 + r() * 38 : 4 + r() * 20);
    g.fillStyle = look.dark; g.globalAlpha = 0.25 + r() * 0.35; g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.fill();
    if (id === 'earth' || id === 'mars') { g.fillStyle = look.light; g.globalAlpha = 0.2 + r() * 0.3; g.beginPath(); g.ellipse(x + 6, y - 3, s * 1.3, s * 0.7, r() * 3, 0, Math.PI * 2); g.fill(); } }
  g.globalAlpha = 1;
  if (look.bright) for (let i = 0; i < 5; i++) { g.fillStyle = look.light; g.globalAlpha = 0.5 + r() * 0.4; g.beginPath(); g.arc(cx + (r() - 0.3) * R, cy + (r() - 0.5) * R * 0.8, 2 + r() * 5, 0, Math.PI * 2); g.fill(); }
  g.globalAlpha = 1;
  if (look.cap) { g.fillStyle = 'rgba(250,245,240,.85)'; g.beginPath(); g.ellipse(cx, cy - R * 0.92, R * 0.34, R * 0.12, 0, 0, Math.PI * 2); g.fill(); }
  if (look.clouds) for (let i = 0; i < 26; i++) { g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(cx + (r() - 0.5) * R * 1.8, cy + (r() - 0.5) * R * 1.6, 8 + r() * 22, 3 + r() * 6, r() * 0.6, 0, Math.PI * 2); g.fill(); }
  const sh = g.createRadialGradient(cx - R * 0.45, cy - R * 0.4, R * 0.1, cx, cy, R * 1.1);   // the light from the upper left, the night side on the right
  sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(0.55, 'rgba(0,0,0,.18)'); sh.addColorStop(1, 'rgba(0,0,0,.85)');
  g.fillStyle = sh; g.fillRect(cx - R, cy - R, R * 2, R * 2); g.restore();
  if (look.atm) { g.strokeStyle = look.atm; g.globalAlpha = 0.35; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, R + 1.5, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1; }
}

const CSS = `
#opening-board{position:fixed;inset:0;z-index:120;background:rgba(9,7,8,.985);color:#ece4d9;font:15px/1.5 system-ui,sans-serif;overflow-y:auto;-webkit-overflow-scrolling:touch;
  padding:max(14px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) max(24px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left));pointer-events:auto}
#opening-board *{box-sizing:border-box}
#opening-board .ob-head{display:flex;align-items:center;justify-content:space-between;gap:10px}
#opening-board .ob-head b{letter-spacing:.14em;font-size:13px;color:#8fedef}
#opening-board .ob-season{font-size:12px;color:#c7b296;margin:4px 0 10px}
#opening-board button{font:inherit;color:#f1e2d0;background:#1a1716;border:1px solid #c7b29688;border-radius:8px;min-height:48px;padding:10px 16px;cursor:pointer}
#opening-board button:disabled{opacity:.45;cursor:default}
#opening-board .ob-tabs{display:flex;flex-wrap:wrap;gap:8px;padding:4px 0 10px}
#opening-board .ob-tabs button{flex:1 1 auto;min-height:44px;padding:8px 12px}
#opening-board .ob-tabs button[aria-selected=true]{background:#2b2420;border-color:#ffd9a0;color:#fff}
#opening-board .ob-tabs button .st{display:block;font-size:10px;letter-spacing:.1em;color:#9fb;opacity:.8}
#opening-board .ob-tabs button .st.coming{color:#e9b}
#opening-board canvas.pic{width:100%;max-width:520px;height:auto;border-radius:10px;display:block;margin:2px 0 8px;background:#05060a}
#opening-board h2{margin:6px 0 2px;font-size:22px}
#opening-board h3{margin:18px 0 6px;font-size:13px;letter-spacing:.12em;color:#8fedef;text-transform:uppercase}
#opening-board .ob-line{margin:4px 0 10px;color:#e5dccf}
#opening-board .ob-facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 12px;font-size:13px}
#opening-board .ob-facts div{background:#15110f;border:1px solid #ffffff14;border-radius:8px;padding:7px 10px}
#opening-board .ob-facts span{display:block;font-size:11px;color:#a89c8a;letter-spacing:.06em}
#opening-board .ob-goods{font-size:13px;color:#d6c9b4;margin-top:8px}
#opening-board .ob-side{display:grid;grid-template-columns:64px 1fr;gap:10px;align-items:start;border:1px solid #ffffff22;border-radius:10px;padding:10px;margin:8px 0;cursor:pointer;background:#120f0e}
#opening-board .ob-side[aria-checked=true]{border-color:#ffd9a0;background:#201914}
#opening-board .ob-side canvas{width:64px;height:64px;border-radius:8px}
#opening-board .ob-side b{display:block;font-size:16px}
#opening-board .ob-side i{display:block;color:#cdbfa8;font-size:13px;margin:2px 0}
#opening-board .ob-side small{display:block;color:#9fa;font-size:12px;margin-top:3px}
#opening-board .ob-actions{display:grid;gap:8px;margin-top:14px}
#opening-board .ob-primary{background:#6a3a1c;border-color:#ffd9a0;font-weight:600}
#opening-board .ob-note{font-size:13px;color:#e9b;margin:8px 0}
@media(min-width:760px){#opening-board{padding:28px 12vw}}
`;

/**
 * Open the board. `data` is boardData(); `onPick({world,faction,stay})` returns a promise of {ok,msg}; `onClose()` runs when the board is dismissed.
 * Returns { close(), el }.
 */
export function openBoard({ data, onPick, onClose, initial = 'mars' }) {
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  const el = document.createElement('div'); el.id = 'opening-board'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Arrivals board');
  document.body.appendChild(el);
  let world = data.worlds.find((w) => w.id === initial) || data.worlds[0], faction = null, busy = false, msg = '';
  const close = () => { el.remove(); style.remove(); onClose?.(); };
  const render = () => {
    const w = world, open = w.status === 'open', f = w.facts;
    const facts = [['Size', f.radiusKm ? `${boardFmt(f.radiusKm, 0)} km radius` : 'n/a'], ['Gravity', f.gravity ? `${boardFmt(f.gravity, 2)} m/s2 (${boardFmt(f.gravity / 9.80665, 2)} g)` : 'n/a'],
      ['Day', f.dayH ? boardDayText(f.dayH) : 'n/a'], ['From Mars now', f.distanceMkm === 0 ? 'you are here' : f.distanceMkm ? `${boardFmt(f.distanceMkm, 0)} million km` : 'varies'],
      ['Players', `${w.players} (${w.online} online)`], ['Local money', w.money], ['Nearest port', esc(w.port)], ['Governor', esc(w.governor)]];
    el.innerHTML = `
      <div class="ob-head"><b>ARRIVALS / WHERE TO?</b><button class="ob-close" aria-label="Close the board">Close</button></div>
      ${data.season ? `<div class="ob-season">Season ${data.season.number}. ${esc(data.season.season)}</div>` : ''}
      <div class="ob-tabs" role="tablist">${data.worlds.map((x) => `<button role="tab" data-w="${x.id}" aria-selected="${x.id === w.id}">${esc(x.name)}<span class="st ${x.status}">${x.status === 'open' ? 'OPEN' : 'COMING'}</span></button>`).join('')}</div>
      <canvas class="pic" width="520" height="190"></canvas>
      <h2>${esc(w.name)}</h2>
      <p class="ob-line">${esc(w.line)}</p>
      <div class="ob-facts">${facts.map(([k, v]) => `<div><span>${esc(k)}</span>${v}</div>`).join('')}</div>
      <div class="ob-goods"><b>Good at:</b> ${esc(w.good)}<br><b>Lacks:</b> ${esc(w.lacks)}${w.goods.length ? '<br>' + w.goods.map(esc).join('<br>') : ''}</div>
      ${w.factions.length ? `<h3>${open ? 'Pick a side, or none yet' : 'The two sides'}</h3>
        ${w.factions.map((fc) => `<div class="ob-side" role="radio" tabindex="0" data-f="${fc.id}" aria-checked="${faction === fc.id}"><canvas width="128" height="128"></canvas><div><b>${esc(fc.name)}</b><i>${esc(fc.tagline)}</i><span>${esc(fc.ethos)}</span><small>Good at: ${esc(fc.good)}<br>Lacks: ${esc(fc.lacks)}<br>${fc.members} member${fc.members === 1 ? '' : 's'} so far</small></div></div>`).join('')}
        ${open ? `<div class="ob-side" role="radio" tabindex="0" data-f="" aria-checked="${faction === null}"><div></div><div><b>No side yet</b><i>Fly there, look around, and let the jobs decide.</i></div></div>` : ''}` : ''}
      <div class="ob-actions">
        ${open ? `<button class="ob-primary" data-act="go" ${busy ? 'disabled' : ''}>${w.id === 'mars' ? 'Fly the Kestrel to the Marineris desert' : `Fly the Kestrel to ${esc(w.name)}${faction ? ' with ' + esc(w.factions.find((x) => x.id === faction)?.name || '') : ''}`}</button>` : `<div class="ob-note">${esc(w.name)} is not built yet. The Kestrel does not fly there. ${w.nearest ? 'The nearest start that is open: Mars, or Ceres.' : ''}</div>`}
        ${w.id === 'mars' ? `<button data-act="stay" ${busy ? 'disabled' : ''}>Stay on Mars: walk out of the port, no side</button>` : ''}
        ${!open ? `<button data-act="ceres">Look at Ceres instead</button>` : ''}
      </div>
      ${msg ? `<div class="ob-note" role="status">${esc(msg)}</div>` : ''}
      ${data.moons?.length ? `<h3>Also in the system</h3><div class="ob-goods">${data.moons.map((m) => `<b>${esc(m.name)}</b>: ${esc(m.line)}`).join('<br>')}<br>Reached from Mars later, by ship. Not starts.</div>` : ''}`;
    drawWorld(el.querySelector('canvas.pic'), w.id);
    el.querySelectorAll('.ob-side').forEach((n) => {
      const id = n.dataset.f, c = n.querySelector('canvas'), fc = w.factions.find((x) => x.id === id);
      if (c && fc) { const g = c.getContext('2d'); g.fillStyle = hex(fc.colors.dark); g.fillRect(0, 0, 128, 128); g.strokeStyle = hex(fc.colors.accent); g.lineWidth = 4; g.strokeRect(2, 2, 124, 124); drawEmblem(g, id, 64, 64, 92); }
      const pick = () => { faction = id || null; render(); };
      n.addEventListener('click', pick); n.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
    });
    el.querySelectorAll('.ob-tabs button').forEach((b) => bindActivation(b, () => { world = data.worlds.find((x) => x.id === b.dataset.w); faction = null; msg = ''; render(); }));
    bindActivation(el.querySelector('.ob-close'), close);
    const go = el.querySelector('[data-act=go]'), stay = el.querySelector('[data-act=stay]'), ceres = el.querySelector('[data-act=ceres]');
    const send = async (stayFlag) => { if (busy) return; busy = true; render();
      const r = await onPick({ world: world.id, faction: stayFlag ? null : faction, stay: !!stayFlag }).catch((e) => ({ ok: false, msg: e.message })); busy = false;
      if (r && r.ok) { el.remove(); style.remove(); onClose?.(r); } else { msg = (r && r.msg) || 'The board did not take that.'; render(); } };
    if (go) bindActivation(go, () => send(false));
    if (stay) bindActivation(stay, () => send(true));
    if (ceres) bindActivation(ceres, () => { world = data.worlds.find((x) => x.id === 'ceres'); faction = null; render(); });
  };
  render();
  return { close, el };
}
