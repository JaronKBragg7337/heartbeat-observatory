// ============================================================================
// ui.js — HUD, prompts, toasts, inventory panel, ship-builder panel.
//
// OWNS: all DOM overlay elements and their refresh logic.
// DOES NOT OWN: any game state — it READS state and CALLS actions
//               (shipBuilder.js, save.js). "Menus observe reality; they do
//               not replace it" (SYL law): every panel displays what is
//               physically true and every button performs a physical action.
//
// Future agents: add panels with makePanel(); keep the HUD terse. Styles
// live in index.html <style>.
// ============================================================================

import { SLOTS, PART_TYPES } from '../ship/shipParts.js';
import { installPart, removePart, repairPart, loadFuel, readinessReport } from '../ship/shipBuilder.js';
import { getItem, ITEMS } from '../items/items.js';
import { RECIPES, craft } from '../crafting/recipes.js';

export class UI {
  constructor(root, game) {
    this.game = game;
    this.root = root;
    root.innerHTML = '';

    this.hud = el('div', 'syl-hud'); root.appendChild(this.hud);
    this.prompt = el('div', 'syl-prompt'); root.appendChild(this.prompt);
    this.toast = el('div', 'syl-toast'); root.appendChild(this.toast);
    this.centerMsg = el('div', 'syl-center-msg'); root.appendChild(this.centerMsg);

    this.help = el('div', 'syl-help');
    this.help.innerHTML =
      'ON FOOT: WASD move · Shift run · Space jump · E enter ship · F gather<br>' +
      'SHIP: W/S throttle · A/D or touch stick turn · mouse/stick pitch/yaw · Q/E roll · Space vertical thrust · X brake · E exit (landed)<br>' +
      'B ship builder · I inventory/crafting · M bodies · F5 save · F9 load · H hide help · click for mouse look';
    root.appendChild(this.help);

    this.invPanel = makePanel(root, 'INVENTORY', 'inv-panel');
    this.shipPanel = makePanel(root, 'SHIP BUILDER — FORTIS PATTERN', 'ship-panel');
    this.mapPanel = makePanel(root, 'KNOWN BODIES', 'map-panel');
    [this.invPanel, this.shipPanel, this.mapPanel].forEach((panel) => {
      panel.querySelector('.panel-close').addEventListener('click', () => this.closePanels());
    });
    this.openPanel = null;

    root.appendChild(el('div', 'syl-vignette'));
    this._toastTimer = null;
  }

  // ------------------------------------------------------------------ HUD
  refreshHUD() {
    const g = this.game;
    const body = g.worldState.bodies.find((b) => b.id === g.worldState.currentBodyId);
    const piloting = g.traversal.mode === 'PILOTING';
    const speed = piloting ? g.ship.speed() : g.player.velocity.length();
    const alt = piloting ? Math.max(0, g.ship.altitude()) : 0;
    const s = g.ship.stats;
    const lines = [
      `<span class="state">${piloting ? g.traversal.phase : 'ON FOOT'}</span>  @ ${body ? body.name : '?'}`,
      `alt ${fmt(alt)} m   spd ${fmt(speed)} m/s`,
      `fuel ${piloting || true ? `${Math.round(g.ship.fuel)}/${s.fuelCap}` : ''}   thr ${(g.ship.throttle * 100) | 0}%`,
      `ship ${s.ready ? '<span class="ok">READY</span>' : '<span class="bad">NOT READY</span>'}   gear ${g.ship.gearDown ? 'DOWN' : 'UP'}`,
    ];
    this.hud.innerHTML = lines.join('\n');
  }

  // ------------------------------------------------------------------ prompt/toast
  showPrompt(text) { this.prompt.textContent = text; this.prompt.style.display = 'block'; }
  hidePrompt() { this.prompt.style.display = 'none'; }

  showToast(text, ms = 3500) {
    this.toast.innerHTML = text;
    this.toast.style.display = 'block';
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { this.toast.style.display = 'none'; }, ms);
  }

  showCenter(text, ms = 5000) {
    this.centerMsg.innerHTML = text;
    this.centerMsg.style.display = 'block';
    setTimeout(() => { this.centerMsg.style.display = 'none'; }, ms);
  }

  toggleHelp() { this.help.style.display = this.help.style.display === 'none' ? 'block' : 'none'; }
  hideHelp() { this.help.style.display = 'none'; }

  // ------------------------------------------------------------------ panels
  togglePanel(name) {
    const panel = { inv: this.invPanel, ship: this.shipPanel, map: this.mapPanel }[name];
    if (this.openPanel && this.openPanel !== panel) this.openPanel.style.display = 'none';
    const opening = panel.style.display !== 'block';
    panel.style.display = opening ? 'block' : 'none';
    this.openPanel = opening ? panel : null;
    if (opening) {
      if (name === 'inv') this.renderInventory();
      if (name === 'ship') this.renderShipBuilder();
      if (name === 'map') this.renderMap();
      if (document.pointerLockElement) document.exitPointerLock();
    }
    return opening;
  }

  anyPanelOpen() { return !!this.openPanel; }
  closePanels() {
    if (this.openPanel) { this.openPanel.style.display = 'none'; this.openPanel = null; }
  }

  renderInventory() {
    const inv = this.game.inventory;
    const rows = inv.entries().map(({ item, count }) =>
      `<tr><td>${item.name}</td><td>x${count}</td><td class="dim">${item.description}</td></tr>`).join('');
    const recipeRows = RECIPES.map((recipe) => {
      const canCraft = Object.entries(recipe.inputs).every(([itemId, count]) => inv.has(itemId, count));
      const inputText = Object.entries(recipe.inputs)
        .map(([itemId, count]) => `${count}x ${getItem(itemId).name}`)
        .join(', ');
      const output = getItem(recipe.output.itemId);
      return `<tr><td>${recipe.name}</td><td class="dim">${inputText}</td>
        <td>${recipe.output.count}x ${output.name}</td>
        <td><button data-craft="${recipe.id}" ${canCraft ? '' : 'disabled'}>Craft</button></td></tr>`;
    }).join('');
    this.invPanel.querySelector('.body').innerHTML =
      `<table><tr><th>Item</th><th>Qty</th><th></th></tr>${rows ||
      '<tr><td class="dim" colspan="3">Empty. Gather salvage crates with F.</td></tr>'}</table>
       <p class="dim">carried mass: ${inv.totalMass()} kg</p>
       <h3>CRAFTING</h3>
       <table><tr><th>Recipe</th><th>Needs</th><th>Makes</th><th></th></tr>${recipeRows}</table>`;
    this.invPanel.querySelectorAll('button[data-craft]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const res = craft(inv, btn.dataset.craft);
        this.showToast(res.msg, 2600);
        this.renderInventory();
      });
    });
  }

  renderShipBuilder() {
    const g = this.game;
    const ship = g.ship, inv = g.inventory;
    const rep = readinessReport(ship);
    const header = `<p class="${rep.ready ? 'ok' : 'bad'}">${rep.lines[0]}</p>
                    <p class="dim">${rep.lines.slice(1).join('<br>')}</p>`;

    const rows = SLOTS.map((slot) => {
      const mod = ship.modules[slot.slotId];
      const t = mod ? PART_TYPES[mod.typeId] : null;
      const hpFrac = mod ? mod.hp / t.maxHp : 0;
      const hpCls = hpFrac >= 0.8 ? 'ok' : hpFrac >= 0.4 ? 'warn' : 'bad';
      const status = mod
        ? `${t.name} <span class="${hpCls}">${Math.round(hpFrac * 100)}%</span>`
        : `<span class="dim">— empty (${slot.accepts}) —</span>`;
      const btns = [];
      if (mod && hpFrac < 1) btns.push(`<button data-act="repair" data-slot="${slot.slotId}">Repair</button>`);
      if (mod) btns.push(`<button data-act="remove" data-slot="${slot.slotId}">Remove</button>`);
      if (!mod) {
        const itemId = partItemId(slot.accepts);
        const have = itemId && inv.count(itemId) > 0;
        btns.push(`<button data-act="install" data-slot="${slot.slotId}" data-item="${itemId || ''}" ${have ? '' : 'disabled'}>Install${have ? '' : ' (none)'}</button>`);
      }
      return `<tr><td class="dim">${slot.slotId}</td><td>${status}</td><td>${btns.join(' ')}</td></tr>`;
    }).join('');

    const fuelBtn = `<button data-act="fuel" ${inv.count('fuel_hydrazine') > 0 ? '' : 'disabled'}>
      Load Hydrazine (${inv.count('fuel_hydrazine')} carried)</button>
      fuel ${Math.round(ship.fuel)}/${ship.stats.fuelCap}`;

    const bodyEl = this.shipPanel.querySelector('.body');
    bodyEl.innerHTML = `${header}<table>${rows}</table><p>${fuelBtn}</p>
      <p class="dim">repairs: structural parts use Salvaged Alloy, electronics use Wiring Loom (1 unit = +40 hp)</p>`;

    bodyEl.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const act = btn.dataset.act;
        let res;
        if (act === 'repair') res = repairPart(ship, inv, btn.dataset.slot);
        else if (act === 'remove') res = removePart(ship, inv, btn.dataset.slot);
        else if (act === 'install') res = installPart(ship, inv, btn.dataset.slot, btn.dataset.item);
        else if (act === 'fuel') res = loadFuel(ship, inv);
        if (res) this.showToast(res.msg, 2600);
        this.renderShipBuilder();
      });
    });
  }

  renderMap() {
    const g = this.game;
    const rows = g.worldState.bodies.map((b) => {
      const known = g.worldState.discoveredBodies.has(b.id);
      const owner = b.ownerFactionId ? g.factionState.byId[b.ownerFactionId] : null;
      const dist = Math.round(
        Math.hypot(...b.position.map((v, i) => v - g.ship.worldPos.getComponent(i))) / 1000);
      const zones = b.landingZones.map((z) =>
        `${g.worldState.discoveredZones.has(z.id) ? '●' : '○'} ${known ? z.name : '???'}`).join('<br>');
      return `<tr><td>${known ? b.name : '??? (undiscovered)'}</td>
        <td>${known ? `${dist} km` : '—'}</td>
        <td>${owner ? `<span style="color:#${owner.color.toString(16).padStart(6, '0')}">${owner.name}</span>` : '<span class="dim">unclaimed</span>'}</td>
        <td class="dim">${zones}</td></tr>`;
    }).join('');
    this.mapPanel.querySelector('.body').innerHTML =
      `<table><tr><th>Body</th><th>Dist</th><th>Held by</th><th>Zones</th></tr>${rows}</table>
       <p class="dim">● discovered zone · ○ known but unvisited. Fly toward a body and descend to land.</p>`;
  }
}

function partItemId(partTypeId) {
  const it = ITEMS.find((i) => i.kind === 'part' && i.partId === partTypeId);
  return it ? it.id : null;
}

function el(tag, cls) { const e = document.createElement(tag); e.className = cls; return e; }

function makePanel(root, title, cls = '') {
  const p = el('div', `syl-panel ${cls}`.trim());
  p.innerHTML = `<button class="panel-close" type="button" aria-label="Close panel">Close</button>
    <h2>${title}</h2><div class="body"></div>
    <p class="dim" style="margin-bottom:0">Close / Esc / same key closes</p>`;
  root.appendChild(p);
  return p;
}

function fmt(n) { return n >= 100 ? Math.round(n).toLocaleString() : n.toFixed(1); }
