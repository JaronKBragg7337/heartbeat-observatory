import { startLocal, open, sitPilot, stepSec, outDir } from './_ff.mjs';
import { join } from 'node:path';
const L = await startLocal(); const out = outDir();
try {
  for (const [w, h, name] of [[393, 852, 'portrait'], [844, 390, 'landscape'], [360, 640, 'small']]) {
    const P = await open('phone', L.base, { w, h });
    await sitPilot(P.page); await stepSec(P.page, 1.2);
    const r = await P.page.evaluate(() => {
      const shown = (el) => { for (let n = el; n && n !== document.documentElement; n = n.parentElement) { const c = getComputedStyle(n); if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity === 0 || n.hidden) return false; } const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      const name = (e) => (e.id ? '#' + e.id : (e.textContent || '').trim().slice(0, 14));
      const list = [...document.querySelectorAll('button,a.btn,[role=button]')].filter(shown).filter((e) => !e.closest('#settings-panel,#multiplayer-panel,#account-panel,#crew-panel,#space-sheet,#key-pad,#voice-mic-dialog'));
      const bad = [], W = innerWidth, H = innerHeight;
      for (const e of list) { const r = e.getBoundingClientRect(); if (r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > H + 1) bad.push(name(e) + ' off-screen'); if (r.height < 40 && !e.closest('#hud')) bad.push(name(e) + ' under 40 px tall (' + Math.round(r.height) + ')'); }
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) { const a = list[i], b = list[j]; if (a.contains(b) || b.contains(a)) continue;
        const p = a.getBoundingClientRect(), q = b.getBoundingClientRect(), ww = Math.min(p.right, q.right) - Math.max(p.left, q.left), hh = Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top); if (ww > 1 && hh > 1) bad.push(name(a) + ' x ' + name(b)); }
      return { n: list.length, bad };
    });
    console.log(name, w + 'x' + h, JSON.stringify(r));
    await P.page.screenshot({ path: join(out, 'layout-' + name + '.png') });
    await P.close();
  }
} finally { L.stop(); }
