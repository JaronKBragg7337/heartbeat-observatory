// ============================================================================
// economy/shopView.js - the market row at Marineris Port as you see it: six stalls with signs, and the phone sheet for renting, stocking,
// pricing and buying. Reads the shared snapshot (state.shops); every change is a request to the authority (server/shops.mjs), which does the
// checking, so nothing here can move a mark or a kilogram.
//
// PHONE FIRST: one button appears when you stand at a stall ("Stall 3 - rent it" / "Your stall" / the shop's name). It opens one sheet with big
// buttons, numbers typed in a 16 px field (no zoom), the receipt of the last thing you did at the top, and nothing hidden behind a long press.
// ============================================================================

import * as THREE from 'three';
import { Kit } from '../ship/shipKit.js';
import { guardSheetPress } from '../ui/activation.js';
import { SOL_SECONDS } from './catalog.js';
import { STALLS, STALL_REACH_M, SHOP_GOODS, RENT_MARKS, RENT_SOLS, MAX_AHEAD_SOLS, PRICE_MAX, npcCeiling, onShip, solsLeft, isLapsed, goodIds } from './shops.js';

const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids.filter((k) => k !== null && k !== undefined && k !== false)); return e; };
const marks = (n) => `${Number(n).toLocaleString('en-US')} marks`;
const LINE = 'font:10px ui-monospace,monospace;opacity:.75';

function signSprite(w = 512, h = 72) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: true, transparent: true }));
  s.userData = { c, tex, w, h, text: null }; s.scale.set(w / 150, h / 150, 1);
  return s;
}
function setSign(s, line1, line2, hot) {
  const u = s.userData, key = line1 + '|' + line2 + '|' + !!hot; if (u.text === key) return; u.text = key;
  const x = u.c.getContext('2d'); x.clearRect(0, 0, u.w, u.h);
  x.fillStyle = hot ? '#3a2208f2' : '#17120cf2'; x.fillRect(0, 0, u.w, u.h);
  x.strokeStyle = '#d99a3c'; x.lineWidth = 4; x.strokeRect(2, 2, u.w - 4, u.h - 4);
  x.fillStyle = '#ffe0ab'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = 'bold 30px sans-serif'; x.fillText(line1, u.w / 2, 26, u.w - 24);
  x.fillStyle = hot ? '#ffbe5c' : '#9fb7c4'; x.font = '22px sans-serif'; x.fillText(line2, u.w / 2, 54, u.w - 24);
  u.tex.needsUpdate = true;
}

export class ShopView {
  constructor(mp) {
    this.mp = mp; this.stalls = new Map(); this.near = null; this.open = false; this.last = null; this.confirmClose = false; this.sig = '';
    this.buildStalls(); this.buildUI();
  }
  get world() { return this.mp.world; }
  get snapshot() { return this.world.snapshot; }
  get shops() { return this.snapshot?.shops || {}; }
  me() { return this.snapshot?.players?.[this.world.playerId] || null; }
  flagship() { const p = this.me(); return p && this.snapshot.ships[p.shipId]; }
  clock() { return this.snapshot?.clock || 0; }

  // ---- the stalls, in the world --------------------------------------------------------------------------------------
  buildStalls() {
    const mats = this.mp.ship.matsExt;
    for (const st of STALLS) {
      const g = new THREE.Group(); g.name = 'market-stall:' + st.id; g.position.set(st.x, 0, st.z);
      const k = new Kit(); k.tiles = { hull: 8, metal: 1 };
      k.bevelBox('steelDark', 0, 0.55, 0, 3.2, 1.1, 0.9, 0.04);                    // the counter
      k.bevelBox('steel', 0, 1.12, 0.02, 3.3, 0.06, 1.0, 0.02);
      k.bevelBox('metal', 0, 1.3, 0.95, 3.2, 2.6, 0.12, 0.03, { col: [0.62, 0.52, 0.4] });   // the back wall
      for (const sx of [-1, 1]) k.bevelBox('steelDark', sx * 1.62, 1.6, -0.5, 0.1, 3.2, 0.1, 0.02);     // front posts
      for (let i = 0; i < 6; i++) k.bevelBox(i % 2 ? 'white' : 'red', -1.5 + i * 0.6, 3.25, 0.2, 0.6, 0.08, 2.2, 0.01);   // the awning
      for (let i = 0; i < 3; i++) k.bevelBox(i % 2 ? 'crateA' : 'crateC', -1.0 + i * 1.0, 1.4, 0.2, 0.7, 0.4, 0.5, 0.03);  // goods on the counter
      k.box('glowAmber', 0, 3.1, -0.85, 3.0, 0.04, 0.04);
      g.add(k.toGroup(mats, { name: 'stall-' + st.number, cast: false, receive: false }));
      const sign = signSprite(); sign.position.set(0, 3.8, -0.3); g.add(sign);
      const shutter = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.5, 0.06), new THREE.MeshStandardMaterial({ color: 0x5b5044, emissive: 0x2b241b, roughness: 0.8 }));
      shutter.position.set(0, 1.9, -0.5); g.add(shutter);
      this.mp.hallRoot.add(g);
      this.stalls.set(st.id, { st, g, sign, shutter });
    }
  }
  onSnapshot() {
    const sig = JSON.stringify(Object.values(this.shops).map((s) => [s.id, s.name, Object.keys(s.listings).length, s.paidUntil > this.clock()]));
    const me = this.me();
    const s2 = sig + '|' + (me ? me.id : '');
    if (s2 === this.sig) return; this.sig = s2;
    for (const { st, sign, shutter } of this.stalls.values()) {
      const shop = this.shops[st.id];
      if (!shop) { setSign(sign, `${st.name} - FOR RENT`, `${RENT_MARKS} marks, ${RENT_SOLS} sols`, true); shutter.visible = true; }
      else {
        const lapsed = isLapsed(shop, this.clock()), n = Object.keys(shop.listings).length;
        setSign(sign, shop.name, lapsed ? 'closed: rent due' : n ? `${n} line${n > 1 ? 's' : ''} for sale` : 'opening soon', !lapsed && n > 0);
        shutter.visible = lapsed || n === 0;
      }
    }
  }

  // ---- the button and the sheet -----------------------------------------------------------------------------------------
  buildUI() {
    const style = document.createElement('style');
    style.textContent = `
      #shop-button{position:fixed;left:12px;bottom:176px;z-index:68;min-height:44px;max-width:calc(100vw - 24px);padding:8px 14px;background:#2d2012;color:#ffe0b0;border:1px solid #d99a3c;border-radius:8px;font:13px/1.2 ui-monospace,monospace;display:none;text-align:left}
      #shop-panel{position:fixed;left:10px;right:10px;bottom:64px;z-index:75;max-width:440px;max-height:calc(100dvh - 120px);overflow:auto;box-sizing:border-box;padding:12px;background:#18120bf8;color:#ffdfb9;border:1px solid #ae8548;border-radius:12px;font:13px/1.45 ui-monospace,monospace;touch-action:pan-y;overscroll-behavior:contain;display:none}
      #shop-panel h3{margin:2px 0 4px;font-size:15px;color:#ffe9c4} #shop-panel h4{margin:12px 0 4px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#d99a3c}
      #shop-panel button,#shop-panel input{min-height:44px;border:1px solid #ae8548;border-radius:8px;background:#342713;color:#ffdfb9;font:inherit;padding:6px 10px;box-sizing:border-box}
      #shop-panel input{background:#0f0b07;font-size:16px;width:100%}
      #shop-panel button[disabled]{opacity:.45} #shop-panel button.go{background:#6b4513;border-color:#ffbe5c;color:#fff4de}
      #shop-panel .row{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:4px 0} #shop-panel .row>*{flex:1 1 auto}
      #shop-panel .card{border:1px solid #5c4524;border-radius:8px;padding:8px;margin:6px 0;background:#1f170d}
      #shop-panel .rcpt{border:1px solid #6f8c3c;background:#18240f;color:#dff2b0;border-radius:8px;padding:8px;margin:6px 0}
      #shop-panel .err{border:1px solid #b04a3a;background:#2a120d;color:#ffd0c4;border-radius:8px;padding:8px;margin:6px 0}
      #shop-panel .top{position:sticky;top:-12px;background:#18120b;display:flex;justify-content:space-between;align-items:center;padding:4px 0 6px;z-index:1}
      #shop-panel small{opacity:.75} #shop-panel .x{flex:0 0 auto;min-width:44px}`;
    document.head.append(style);
    this.btn = el('button', { id: 'shop-button', type: 'button' }); this.btn.setAttribute('aria-label', 'Market stall');
    this.panel = el('div', { id: 'shop-panel' }); guardSheetPress(this.panel);
    document.body.append(this.btn, this.panel);
    this.btn.onclick = () => { this.open = !this.open; this.draw(true); };
    window.addEventListener('keydown', (e) => { if (e.code === 'Escape' && this.open) { this.open = false; this.draw(true); } });
  }

  nearest() {
    const mp = this.mp;
    if (!this.snapshot || mp.ship.aboard || mp.space.frameId !== 'mars' || mp.vehicles?.seated?.()) return null;
    const p = mp.site.toLocal(mp.walker.worldPos); let best = null, bd = STALL_REACH_M;
    for (const st of STALLS) { const d = Math.hypot(p.x - st.x, p.z - (st.z - 2)); if (d < bd) { bd = d; best = st; } }
    return best;
  }
  /** Per frame: the button follows where you stand; the sheet closes when you walk away. */
  update(dt) {
    this._t = (this._t || 0) + dt; if (this._t < 0.2) return; this._t = 0;
    if (!this.world.connected) { this.btn.style.display = 'none'; this.panel.style.display = 'none'; return; }
    const st = this.nearest(), was = this.near; this.near = st;
    if (!st) { this.btn.style.display = 'none'; if (this.open) { this.open = false; this.draw(true); } return; }
    const shop = this.shops[st.id], me = this.me();
    const label = !shop ? `${st.name} is free: rent it` : shop.ownerId === me?.id ? `Your stall: ${shop.name}` : `${shop.name}: browse and buy`;
    if (this.btn.textContent !== label) this.btn.textContent = label;
    this.btn.style.display = 'block';
    if (was?.id !== st.id && this.open) { this.confirmClose = false; this.draw(true); }
  }
  /** After each snapshot, refresh an open sheet (unless a thumb is on it or a field is being typed in). */
  refresh() { this.onSnapshot(); if (this.open) this.draw(false); }

  // ---- requests ------------------------------------------------------------------------------------------------------------
  async act(a, okNote) {
    this.err = null;
    const r = await this.mp.request({ ...a, stall: this.near?.id });
    if (r.ok) { this.last = r.receipt ? { receipt: r.receipt, msg: r.msg } : { msg: okNote || r.msg }; } else this.err = r.msg || 'That did not go through.';
    this.draw(true);
    return r;
  }

  // ---- the sheet ----------------------------------------------------------------------------------------------------------
  draw(force) {
    this.panel.style.display = this.open && this.near ? 'block' : 'none';
    this.btn.setAttribute('aria-expanded', String(this.open));
    if (!this.open || !this.near) return;
    if (!force && (this.panel.dataset.pressed || this.panel.contains(document.activeElement) && document.activeElement.tagName === 'INPUT')) return;
    const st = this.near, shop = this.shops[st.id], me = this.me(), flag = this.flagship(), clock = this.clock();
    if (!me || !flag) return;
    // Snapshots arrive ten times a second; the sheet is rebuilt only when something it shows has changed (or you asked for it), so a thumb
    // never lands on a button that was just replaced and a half-typed price is never wiped.
    const sig = JSON.stringify([st.id, shop || null, flag.economy.marks, flag.economy.inventory, flag.hold, (flag.holdLots || []).length, flag.pose?.landed, me.id, me.name,
      shop ? Math.floor(solsLeft(shop, clock) * 10) : 0, this.err || null, this.last || null, this.confirmClose]);
    if (!force && sig === this.drawnSig) return;
    this.drawnSig = sig;
    const scroll = this.panel.scrollTop; this.panel.replaceChildren();
    const close = el('button', { className: 'x', type: 'button', textContent: 'Close' }); close.setAttribute('aria-label', 'Close the stall'); close.onclick = () => { this.open = false; this.confirmClose = false; this.draw(true); };
    this.panel.append(el('div', { className: 'top' }, el('h3', { textContent: shop ? shop.name : `${st.name} is free` }), close));
    const purse = el('div', { textContent: `Your purse: ${marks(flag.economy.marks)}` }); purse.style.cssText = LINE; this.panel.append(purse);
    if (this.err) this.panel.append(el('div', { className: 'err', role: 'alert', textContent: this.err }));
    if (this.last?.receipt) { const r = this.last.receipt; this.panel.append(el('div', { className: 'rcpt', textContent: `Receipt ${r.n}: ${r.qty} x ${SHOP_GOODS[r.good]?.name || r.good} at ${r.unitPrice} = ${marks(r.total)} from ${r.shop}. It is in your ship.` })); }
    else if (this.last?.msg) this.panel.append(el('div', { className: 'rcpt', textContent: this.last.msg }));
    if (!shop) this.drawVacant(st, flag, me);
    else if (shop.ownerId === me.id) this.drawOwner(st, shop, flag, clock);
    else this.drawCustomer(st, shop, flag, clock);
    this.panel.scrollTop = scroll;
  }

  drawVacant(st, flag, me) {
    const mine = Object.values(this.shops).find((s) => s.ownerId === me.id);
    const name = el('input', { value: `${me.name}'s stall`.slice(0, 24), maxLength: 24 }); name.setAttribute('aria-label', 'Shop name'); name.setAttribute('autocomplete', 'off');
    const can = flag.economy.marks >= RENT_MARKS && !mine;
    const rent = el('button', { className: 'go', type: 'button', textContent: `Rent this stall: ${marks(RENT_MARKS)} for ${RENT_SOLS} sols`, disabled: !can });
    rent.onclick = () => this.act({ type: 'shop-rent', name: name.value });
    this.panel.append(el('p', { textContent: `Nobody rents ${st.name}. Rent it, stock it from your ship's hold, set your prices, and other players buy while you are here. While you are away the port's buyers take what is priced fairly.` }),
      el('h4', { textContent: 'Shop name' }), name, el('div', { className: 'row' }, rent),
      el('small', { textContent: mine ? `You already run ${mine.name}. Close it first to rent another.` : flag.economy.marks < RENT_MARKS ? 'Your ship account cannot cover the rent yet.' : 'Rent is paid from your ship account to the port. Close the stall any time and the goods come back to your hold.' }));
  }

  goodLine(id) { const g = SHOP_GOODS[id]; return `${g.name} (${g.unit})`; }

  drawCustomer(st, shop, flag, clock) {
    const lapsed = isLapsed(shop, clock), ids = goodIds().filter((id) => shop.listings[id]);
    this.panel.append(el('small', { textContent: `Run by ${shop.ownerName}. Goods go straight to your flagship's hold at the port.` }));
    if (lapsed) this.panel.append(el('div', { className: 'err', textContent: 'This stall is closed until its rent is paid.' }));
    else if (!ids.length) this.panel.append(el('p', { textContent: 'Nothing on the stall right now.' }));
    for (const id of ids) {
      const l = shop.listings[id], g = SHOP_GOODS[id], cheap = l.price <= g.fair ? 'good price' : l.price > npcCeiling(id) ? 'above port price' : 'fair';
      const buy = (n) => { const b = el('button', { type: 'button', textContent: `Buy ${n}: ${marks(n * l.price)}`, disabled: lapsed || n > l.qty || flag.economy.marks < n * l.price }); b.onclick = () => this.act({ type: 'shop-buy', good: id, qty: n, price: l.price }); return b; };
      const row = el('div', { className: 'row' }, buy(1));
      if (l.qty >= 5) row.append(buy(5));
      if (l.qty > 1 && l.qty !== 5) row.append(buy(l.qty));
      this.panel.append(el('div', { className: 'card' }, el('b', { textContent: this.goodLine(id) }), el('div', { textContent: `${l.qty} left at ${l.price} marks each` }), el('small', { textContent: `port price about ${g.fair}: ${cheap}` }), row));
    }
  }

  drawOwner(st, shop, flag, clock) {
    const lapsed = isLapsed(shop, clock), left = solsLeft(shop, clock);
    const sim = flag.pose?.landed !== false && flag.frameId === 'mars';
    const renew = el('button', { type: 'button', textContent: `Pay rent: ${marks(RENT_MARKS)} for ${RENT_SOLS} more sols`, disabled: flag.economy.marks < RENT_MARKS || left + RENT_SOLS > MAX_AHEAD_SOLS });
    renew.onclick = () => this.act({ type: 'shop-renew' });
    this.panel.append(el('div', { className: lapsed ? 'err' : 'card', textContent: lapsed ? 'The rent has run out: the stall is shut and sells nothing. Pay to open it.' : `Rent paid for ${left.toFixed(1)} more sols. You have earned ${marks(shop.earned || 0)} here.` }), el('div', { className: 'row' }, renew));
    const nm = el('input', { value: shop.name, maxLength: 24 }); nm.setAttribute('aria-label', 'Shop name'); nm.setAttribute('autocomplete', 'off');
    const sv = el('button', { type: 'button', textContent: 'Save name' }); sv.onclick = () => this.act({ type: 'shop-rename', name: nm.value });
    this.panel.append(el('div', { className: 'row' }, nm, sv));
    // on the stall
    this.panel.append(el('h4', { textContent: 'On your stall' }));
    const on = goodIds().filter((id) => shop.listings[id]);
    if (!on.length) this.panel.append(el('small', { textContent: 'Empty. Stock it from your ship below.' }));
    for (const id of on) {
      const l = shop.listings[id], g = SHOP_GOODS[id];
      const price = el('input', { value: String(l.price), inputMode: 'numeric', pattern: '[0-9]*', maxLength: 6 }); price.setAttribute('aria-label', `Price of ${g.name}`);
      const set = el('button', { type: 'button', textContent: 'Set price' });
      set.onclick = () => this.act({ type: 'shop-price', good: id, price: Number(price.value) });
      const back1 = el('button', { type: 'button', textContent: 'Take back 1', disabled: !sim }); back1.onclick = () => this.act({ type: 'shop-unstock', good: id, qty: 1 });
      const backAll = el('button', { type: 'button', textContent: `Take back all ${l.qty}`, disabled: !sim }); backAll.onclick = () => this.act({ type: 'shop-unstock', good: id, qty: l.qty });
      const hint = l.price > npcCeiling(id) ? `Port buyers need ${npcCeiling(id)} or less (fair ${g.fair}).` : `Port buyers will take this while you are away (fair ${g.fair}).`;
      this.panel.append(el('div', { className: 'card' }, el('b', { textContent: `${this.goodLine(id)}: ${l.qty} at ${l.price}` }), el('div', { className: 'row' }, price, set), el('small', { textContent: hint }), el('div', { className: 'row' }, back1, backAll)));
    }
    // from the ship
    this.panel.append(el('h4', { textContent: 'In your ship' }));
    if (!sim) this.panel.append(el('small', { textContent: 'Land your ship at the port to move goods in or out.' }));
    const have = goodIds().filter((id) => onShip(flag, id) > 0);
    if (!have.length) this.panel.append(el('small', { textContent: 'Nothing aboard that a stall can sell. Haul regolith, clay and salvage from the moons, or buy supplies at the depot and the traders.' }));
    for (const id of have) {
      const n = onShip(flag, id), g = SHOP_GOODS[id], cur = shop.listings[id];
      const price = el('input', { value: String(cur ? cur.price : g.fair), inputMode: 'numeric', pattern: '[0-9]*', maxLength: 6 }); price.setAttribute('aria-label', `Price for ${g.name}`);
      const add = (q, label) => { const b = el('button', { type: 'button', textContent: label, disabled: !sim || lapsed || q < 1 || q > n }); b.onclick = () => this.act({ type: 'shop-stock', good: id, qty: q, price: Math.min(PRICE_MAX, Math.max(1, Math.floor(Number(price.value) || 0))) }); return b; };
      const row = el('div', { className: 'row' }, add(1, 'Put 1 on the stall'));
      if (n > 1) row.append(add(n, `Put all ${n}`));
      this.panel.append(el('div', { className: 'card' }, el('b', { textContent: `${this.goodLine(id)}: ${n} aboard` }), el('div', { className: 'row' }, el('small', { textContent: 'Price each:' }), price), row));
    }
    // the sales
    this.panel.append(el('h4', { textContent: 'Sales' }));
    const rows = [...(shop.ledger || [])].reverse().slice(0, 8);
    if (!rows.length) this.panel.append(el('small', { textContent: 'No sales yet.' }));
    for (const r of rows) this.panel.append(el('div', { textContent: `#${r.n} ${r.buyer}: ${r.qty} x ${SHOP_GOODS[r.good]?.name || r.good} at ${r.unit} = ${r.total}` }));
    // close
    const close = el('button', { type: 'button', textContent: this.confirmClose ? 'Tap again: close the stall and take the goods back' : 'Close the stall' });
    close.onclick = () => { if (!this.confirmClose) { this.confirmClose = true; this.draw(true); return; } this.confirmClose = false; this.act({ type: 'shop-close' }); };
    this.panel.append(el('h4', { textContent: 'Done here?' }), el('div', { className: 'row' }, close));
  }
}
