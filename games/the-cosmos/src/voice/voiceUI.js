// voiceUI.js - the player-facing pieces of voice: the settings rows, the Talk button, the "who is talking" line, and the
// plain-words microphone dialog. Behaviour lives in voice.js and proximity.js; this only draws and wires them.
import { bindActivation } from '../ui/activation.js';

const CSS = `
#voice-talk{position:fixed;left:calc(12px + env(safe-area-inset-left,0px));bottom:calc(176px + env(safe-area-inset-bottom,0px));z-index:68;min-height:48px;min-width:96px;
  display:none;background:#281c12;color:#ffe0b0;border:1px solid #ae8548;border-radius:24px;padding:0 16px;font:600 13px system-ui,sans-serif;touch-action:none;
  -webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
#voice-talk[data-on="true"]{background:#8a3b14;border-color:#ffb36b;color:#fff}
#voice-talk small{display:block;font-weight:400;font-size:10px;color:#cdb08c}
#voice-talk[data-on="true"] small{color:#ffe4c9}
#voice-heard{position:fixed;left:50%;transform:translateX(-50%);top:calc(46px + env(safe-area-inset-top,0px));z-index:66;display:none;pointer-events:none;
  background:rgba(12,9,7,.78);color:#ffe0b0;border:1px solid rgba(232,201,168,.3);border-radius:14px;padding:3px 10px;font:12px system-ui,sans-serif}
#voice-mic-dialog{position:fixed;inset:0;z-index:300;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.55);padding:16px}
#voice-mic-dialog .card{max-width:340px;background:#18120b;color:#ffe0b0;border:1px solid #ae8548;border-radius:14px;padding:16px;font:14px/1.45 system-ui,sans-serif}
#voice-mic-dialog h3{margin:0 0 8px;font-size:15px;color:#f0b978}
#voice-mic-dialog p{margin:0 0 10px}
#voice-mic-dialog .row{display:flex;gap:8px;margin-top:6px}
#voice-mic-dialog button{flex:1;min-height:46px;background:#281c12;color:#ffe0b0;border:1px solid #ae8548;border-radius:8px;font:600 14px system-ui,sans-serif}
#voice-mic-dialog button.go{background:#6b3a12}
#voice-mic-dialog .err{color:#ff9a7a;font-size:12px;display:none}
`;

/** Settings rows are in index.html (set-voice-volume, set-voice-chat, set-voice-mute); this binds them to the voice settings. */
export function bindVoiceSettings(voice) {
  const vol = document.getElementById('set-voice-volume'), chat = document.getElementById('set-voice-chat'), mute = document.getElementById('set-voice-mute');
  if (vol) { vol.value = String(Math.round(voice.settings.volume * 100)); vol.addEventListener('input', () => voice.set('volume', Number(vol.value) / 100)); }
  if (chat) { chat.checked = !!voice.settings.chat; chat.addEventListener('change', () => voice.set('chat', chat.checked)); }
  if (mute) { mute.checked = !!voice.settings.muteMic; mute.addEventListener('change', () => voice.set('muteMic', mute.checked)); }
}

export class VoiceUI {
  constructor({ voice, chat, isTouch }) {
    this.voice = voice; this.chat = chat; this.isTouch = isTouch;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    const root = document.createElement('div'); root.id = 'voice-ui';
    root.innerHTML = `<button id="voice-talk" type="button" aria-label="Hold to talk to players near you"><span id="voice-talk-label">Hold to talk</span><small id="voice-talk-sub"></small></button>
<div id="voice-heard" aria-live="polite"></div>
<div id="voice-mic-dialog" role="dialog" aria-modal="true" aria-labelledby="voice-mic-title"><div class="card">
<h3 id="voice-mic-title">Talk to players near you</h3>
<p>Players close to you in the game can hear each other, like standing next to someone. You already hear them without doing anything.</p>
<p>To speak, the game needs your microphone. It is only on while you hold the Talk button${isTouch ? '' : ' (or the B key)'}, it goes straight to the players near you, and nothing is recorded or kept. You can turn all of this off in Settings.</p>
<p class="err" id="voice-mic-err"></p>
<div class="row"><button type="button" id="voice-mic-no">Not now</button><button type="button" class="go" id="voice-mic-yes">Allow microphone</button></div></div></div>`;
    document.body.appendChild(root);
    this.btn = root.querySelector('#voice-talk'); this.sub = root.querySelector('#voice-talk-sub'); this.label = root.querySelector('#voice-talk-label');
    this.heard = root.querySelector('#voice-heard'); this.dialog = root.querySelector('#voice-mic-dialog'); this.err = root.querySelector('#voice-mic-err');
    this._wire(); this._wasTalking = false;
  }
  _wire() {
    const down = (e) => { e.preventDefault(); e.stopPropagation(); try { this.btn.setPointerCapture?.(e.pointerId); } catch { /* none */ } this.voice.unlock(); this.press(); };
    const up = (e) => { e.preventDefault(); this.chat.releaseTalk(); };
    this.btn.addEventListener('pointerdown', down);
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) this.btn.addEventListener(ev, up);
    this.btn.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyB' && !e.repeat && !e.ctrlKey && !e.metaKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '')) { this.voice.unlock(); this.press(); }
    });
    window.addEventListener('keyup', (e) => { if (e.code === 'KeyB') this.chat.releaseTalk(); });
    window.addEventListener('blur', () => this.chat.releaseTalk());
    bindActivation(this.dialog.querySelector('#voice-mic-no'), () => { this.dialog.style.display = 'none'; });
    bindActivation(this.dialog.querySelector('#voice-mic-yes'), async () => {
      this.err.style.display = 'none';
      const ok = await this.chat.startMic();
      if (ok) { this.dialog.style.display = 'none'; }
      else { this.err.textContent = 'The browser did not give the game the microphone, so you can listen but not talk. You can allow it in the browser’s site settings and try again.'; this.err.style.display = 'block'; }
    });
  }
  async press() {
    const r = await this.chat.pressTalk();
    if (r === 'explain') { this.dialog.style.display = 'flex'; }
  }
  update() {
    const c = this.chat, show = c.anyoneHere();
    this.btn.style.display = show ? 'block' : 'none';
    if (show) {
      const talking = c.talking && !!c.track && c.track.enabled, muted = this.voice.settings.muteMic;
      this.btn.dataset.on = String(talking);
      this.label.textContent = muted ? 'Mic muted' : talking ? 'Talking' : (this.isTouch ? 'Hold to talk' : 'Hold B to talk');
      const near = [...c.peers.values()].filter((p) => p.state === 'connected' && (p.heard ?? 0) > 0.02).length;
      this.sub.textContent = near ? near + ' in earshot' : 'no one near';
    }
    const names = [...c.speaking.keys()].map((id) => c.world.snapshot?.players?.[id]?.name || 'Player');
    this.heard.style.display = names.length ? 'block' : 'none';
    if (names.length) this.heard.textContent = names.slice(0, 3).join(', ') + ' talking';
  }
}
