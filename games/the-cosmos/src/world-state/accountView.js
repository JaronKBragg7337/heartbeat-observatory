// ============================================================================
// world-state/accountView.js - "Account and character" in Settings: who you are in the shared world, and how to start over.
//
// OWNS: the Settings section that shows guest / signed-in, signs in (the site's Supabase login) and out, starts a fresh character after a
//       confirmation, and for site admins switches between saved characters or starts a new test one.
// DOES NOT OWN: the identity itself. The server decides who a token belongs to (server/authority.mjs join) and holds the characters;
//       this only shows what the welcome message said and sends the one request (discard) it is allowed to.
//
// A guest keeps one character per browser. A signed-in person keeps theirs on any device. Start fresh asks twice and deletes
// the character it is pressed on (a guest's or an account's). A site admin's Start fresh adds a new saved character instead of deleting.
// ============================================================================
import { siteAuth } from './remoteWorld.js';

const SLOT_KEY = 'cosmos-slot';
const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };
const BTN = 'display:block;width:100%;min-height:44px;margin:6px 0;border-radius:6px;border:1px solid #ae8548;color:#ffe0b0;background:#382817;font:inherit;padding:6px 10px;text-align:left';
const NOTES = {
  adopted: 'Your guest ship from this device is now saved to your account.',
  'kept-account': 'Your account already had a ship, so you are flying that one. The guest ship on this device stays until it has been idle for a day.',
};

export class AccountView {
  constructor(mp) {
    this.mp = mp; this.world = mp.world; this.busy = false; this.confirming = null; this.msg = '';
    this.root = el('section', { id: 'account-section' });
    this.root.style.cssText = 'margin:10px 0;padding:10px 0;border-top:1px solid rgba(232,201,168,.22);border-bottom:1px solid rgba(232,201,168,.22)';
    const panel = document.getElementById('settings-panel');
    const anchor = document.getElementById('save-status');
    if (panel) (anchor ? anchor.after(this.root) : panel.prepend(this.root));
    this.draw();
    const note = NOTES[this.world.who?.note];
    if (note) mp.ship.note(note);
    // Refresh when the panel opens, so a changed connection shows.
    document.getElementById('btn-settings')?.addEventListener('click', () => this.draw());
  }

  async signIn(email, password) {
    this.busy = true; this.msg = 'Signing in...'; this.draw();
    try {
      const mod = await import('/hb-supabase.js'), sb = await mod.getSupabase();
      const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
      if (error) { this.msg = /invalid/i.test(error.message) ? 'That email and password did not match.' : error.message; this.busy = false; this.draw(); return; }
      location.reload();
    } catch { this.msg = 'Could not reach the sign-in service. Try again.'; this.busy = false; this.draw(); }
  }

  async signOut() {
    this.busy = true; this.draw();
    try { const a = await siteAuth(); await a?.sb?.auth.signOut(); } catch { /* signed out locally anyway below */ }
    try { localStorage.removeItem(SLOT_KEY); } catch { /* storage may be blocked */ }
    location.reload();
  }

  async discard() {
    this.busy = true; this.msg = 'Starting over...'; this.draw();
    const r = await this.world.discardCurrent();
    if (!r.ok) { this.busy = false; this.confirming = null; this.msg = r.msg || 'Could not start fresh right now.'; this.draw(); return; }
    try { if (this.world.who?.admin) localStorage.setItem(SLOT_KEY, 'main'); } catch { /* storage may be blocked */ }
    location.reload();
  }

  newSlot() {
    const id = 't' + Date.now().toString(36).slice(-7);
    try { localStorage.setItem(SLOT_KEY, id); } catch { this.msg = 'This browser would not save the choice.'; this.draw(); return; }
    location.reload();
  }

  switchTo(id) {
    try { localStorage.setItem(SLOT_KEY, id); } catch { this.msg = 'This browser would not save the choice.'; this.draw(); return; }
    location.reload();
  }

  draw() {
    if (!this.root) return;
    const who = this.world.who, r = this.root; r.replaceChildren();
    r.append(el('h2', { textContent: 'Account and character' }));
    const line = (t, color) => { const p = el('p', { textContent: t }); p.style.cssText = `margin:4px 0;line-height:1.5;${color ? 'color:' + color : ''}`; r.append(p); };
    const btn = (label, fn, danger) => { const b = el('button', { textContent: label, disabled: this.busy }); b.style.cssText = BTN + (danger ? ';border-color:#c0583a' : ''); b.onclick = fn; r.append(b); return b; };
    if (!who) { line('Not connected to the shared world.'); return; }
    if (who.signedIn) {
      line(`Signed in as ${who.email || 'your account'}${who.admin ? ' (site admin)' : ''}. Your ship, crew and marks follow you to any device.`);
      if (who.admin) {
        line('Saved characters', '#f0b978');
        who.slots.forEach((s, i) => {
          const label = `${s.id === 'main' ? 'Main character' : 'Test character ' + i} (${s.name})`;
          if (s.current) line(`${label} - playing now`, '#bfe8ff');
          else btn(`Switch to ${label}`, () => this.switchTo(s.id));
        });
      }
      btn('Sign out', () => this.signOut());
    } else {
      line('Playing as a guest. This ship is saved in this browser only. Sign in to keep it on any device or in a private tab.');
      if (!this.form) this.form = { email: '', password: '' };
      const email = el('input', { type: 'email', placeholder: 'Email', autocomplete: 'username', value: this.form.email }), pw = el('input', { type: 'password', placeholder: 'Password', autocomplete: 'current-password', value: this.form.password });
      for (const i of [email, pw]) { i.style.cssText = 'display:block;box-sizing:border-box;width:100%;min-height:44px;margin:6px 0;padding:6px 10px;border-radius:6px;border:1px solid #ae8548;background:#1d150d;color:#ffe0b0;font:inherit'; }
      email.oninput = () => { this.form.email = email.value; }; pw.oninput = () => { this.form.password = pw.value; };
      r.append(email, pw);
      btn('Sign in', () => this.signIn(email.value, pw.value));
      const a = el('a', { textContent: 'Create an account (opens the site sign-up)', href: '/admin/', target: '_blank', rel: 'noopener' });
      a.style.cssText = 'display:block;margin:6px 0;color:#f0b978'; r.append(a);
    }
    // Start fresh. Admins keep their other characters; everyone else deletes this one.
    line('Start fresh', '#f0b978');
    if (who.admin && who.signedIn) {
      btn('Start fresh: a new test character (the others are kept)', () => this.newSlot());
      if (this.confirming === 'delete') { line('Delete THIS character (its ship, crew and marks)? This cannot be undone.', '#ffb09a'); btn('Yes, delete this character', () => this.discard(), true); btn('Keep it', () => { this.confirming = null; this.draw(); }); }
      else btn('Delete this character', () => { this.confirming = 'delete'; this.draw(); }, true);
    } else if (this.confirming === 'fresh') {
      line('This deletes your current character (its ship, crew, marks and pad) and begins a new one, with the opening again. It cannot be undone.', '#ffb09a');
      btn('Yes, start fresh', () => this.discard(), true);
      btn('Keep my character', () => { this.confirming = null; this.draw(); });
    } else btn('Start fresh: new character, new ship, opening again', () => { this.confirming = 'fresh'; this.draw(); });
    if (this.msg) line(this.msg, '#ffb09a');
  }
}
