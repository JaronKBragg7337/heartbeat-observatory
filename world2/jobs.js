// WORLD 2 - jobs and the ledger (remake Phase 3, 2026-11-11). See /WORLD2-REMAKE.md and /world2/SHOPS.md.
//
// Jobs are short timed tasks that pay PLAY MONEY ("beats"). The ledger is the visible record: a balance, what you
// earned and spent, and where the work is. It lives on this device (localStorage "w2-ledger"). Nothing here touches
// real money: Heartbeat Observatory never sells food, water or land, and beats cannot be bought or cashed out.
//
// Three kinds of job, all data in world2/shops.json ("jobs"):
//   orders  - customers come to a counter and ask for something; you make it at the stations and hand it over
//             (the barista at Calhoun Coffee, the seller at the newsstand)
//   courier - take the bike from Wells St Bikes, ride to a pickup door, then to the drop-off before the clock runs out
//   usher   - walk each guest to the seat on their ticket in the Grand Palace
// You WALK (stick or keys). Tapping only uses things: a machine, a stack of papers, a seat.

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.module.js";

const CSS = `
#w2jBtn{position:relative;padding:4px 10px;border-radius:999px;background:var(--panel-bg,rgba(10,14,18,.88));border:1px solid var(--panel-border,rgba(120,150,170,.25));font:700 11.5px system-ui,sans-serif;color:#e8eef4;cursor:pointer;touch-action:manipulation;display:flex;align-items:center;gap:6px}
#w2jBtn::after{content:"";position:absolute;inset:-8px -4px}
.w2j-coin{display:inline-block;width:10px;height:10px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#ffe9a8,#e8b84a 60%,#a8782a);box-shadow:0 0 0 1px rgba(0,0,0,.35)}
#w2jBar{position:fixed;left:10px;top:calc(env(safe-area-inset-top) + 48px);z-index:31;max-width:min(330px,calc(100vw - 150px));padding:8px 12px;border-radius:14px;background:rgba(10,16,18,.9);border:1px solid rgba(123,216,143,.5);color:#e8eef4;font:600 13px/1.35 system-ui,sans-serif;display:none}
#w2jBar.on{display:block}
#w2jBar .top{display:flex;align-items:center;gap:8px;white-space:nowrap}
#w2jBar .top b{color:#7bd88f;overflow:hidden;text-overflow:ellipsis}
#w2jBar .clock{font-variant-numeric:tabular-nums;color:#fff}
#w2jBar .clock.low{color:#ffb38a}
#w2jBar .earn{margin-left:auto;color:#ffe9a8;display:flex;align-items:center;gap:4px}
#w2jBar .x{margin-left:4px;width:26px;height:26px;border-radius:50%;border:1px solid rgba(140,170,190,.4);background:transparent;color:#cfd8e0;font:700 13px system-ui;cursor:pointer;touch-action:manipulation}
#w2jBar .ticket{margin-top:3px;color:#cfd8e0;font-weight:600;font-size:12.5px}
#w2jBar .ticket i{font-style:normal;color:#8fa0ad}
#w2jBar .ticket i.done{color:#7bd88f;text-decoration:line-through}
#w2jBar .ticket i.next{color:#fff;font-weight:800}
@media (max-width:520px){body.w2job #tapHint{top:calc(var(--w2jb,128px) + 8px)}}
#w2jCard{position:fixed;inset:0;z-index:52;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(4,7,11,.72)}
#w2jCard.on{display:flex}
#w2jCard .card{display:flex;flex-direction:column;gap:10px;width:min(430px,94vw);max-height:88vh;overflow-y:auto;padding:20px 18px;border:1px solid var(--panel-border,rgba(120,150,170,.25));border-radius:14px;background:var(--panel-bg,rgba(10,14,18,.94));color:#e8eef4;font:14px/1.45 system-ui,sans-serif;-webkit-user-select:none;user-select:none}
#w2jCard h2{margin:0;font-size:19px}
#w2jCard h3{margin:6px 0 0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#9fb0bd}
#w2jCard .bal{display:flex;align-items:baseline;gap:8px;font-size:15px;color:#cfd8e0}
#w2jCard .bal b{font-size:34px;color:#ffe9a8;line-height:1}
#w2jCard .bal .w2j-coin{width:18px;height:18px;align-self:center}
#w2jCard p{margin:0;font-size:12.5px;color:#9fb0bd}
#w2jCard .jobs{display:grid;gap:7px}
#w2jCard .jobs button{display:flex;align-items:center;gap:10px;text-align:left;padding:10px 12px;border-radius:10px;border:1px solid var(--panel-border,rgba(120,150,170,.25));background:rgba(255,255,255,.03);color:#e8eef4;font:inherit;cursor:pointer}
#w2jCard .jobs button span{flex:1;min-width:0}
#w2jCard .jobs button b{display:block;font-size:14px}
#w2jCard .jobs button small{display:block;color:#9fb0bd;font-size:12px}
#w2jCard .jobs button em{font-style:normal;font-weight:700;font-size:12px;color:#7bd88f;white-space:nowrap}
#w2jCard ul{list-style:none;margin:0;padding:0;display:grid;gap:4px;font-size:13px}
#w2jCard li{display:flex;gap:8px;align-items:baseline}
#w2jCard li b{min-width:36px;text-align:right;color:#7bd88f;font-variant-numeric:tabular-nums}
#w2jCard li b.neg{color:#f0b9a0}
#w2jCard li span{flex:1;color:#cfd8e0}
#w2jCard li time{color:#7f8f9b;font-size:11.5px;white-space:nowrap}
#w2jCard .row{display:flex;gap:9px;margin-top:4px}
#w2jCard .row button{flex:1;padding:11px 0;border-radius:9px;border:0;font-weight:700;font-size:14px;cursor:pointer;background:#7bd88f;color:#0d1a12}
#w2jCard .row button.ghost{background:transparent;border:1px solid var(--panel-border,rgba(120,150,170,.25));color:#9fb0bd}
#w2jCard .big{font-size:15px;color:#e8eef4}
body.preview #w2jBtn,body.preview #w2jBar,body.preview #w2jCard{display:none!important}
`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const mmss = (s) => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
const title = (s) => String(s).toLowerCase().replace(/(^|[\s.&-])([a-z])/g, (m, a, b) => a + b.toUpperCase());

export function createJobs(env) {
  const table = env.table || {}, defs = (table.jobs || []).filter((j) => j && j.id), cur = table.currency || { name: "beats", one: "beat" };
  const money = (n) => n + " " + (Math.abs(n) === 1 ? cur.one || "beat" : cur.name || "beats");
  const policy = table.policy || "Play money only. Nothing here costs real money.";

  // ---- the ledger (this device only)
  let L = { v: 1, bal: 0, log: [], shifts: 0 };
  try { const s = JSON.parse(localStorage.getItem("w2-ledger") || "null"); if (s && typeof s.bal === "number" && Array.isArray(s.log)) L = Object.assign(L, s); } catch (e) {}
  const save = () => { try { localStorage.setItem("w2-ledger", JSON.stringify(L)); } catch (e) {} };
  const entry = (amt, text) => { L.bal = Math.max(0, L.bal + amt); L.log.unshift({ t: Date.now(), amt, text }); if (L.log.length > 60) L.log.length = 60; save(); paintBtn(); };

  // ---- DOM (made here so the feature is one file; index.html stays clean)
  if (!document.getElementById("w2j-css")) { const st = document.createElement("style"); st.id = "w2j-css"; st.textContent = CSS; document.head.appendChild(st); }
  const el = (tag, id, html) => { const e = document.createElement(tag); if (id) e.id = id; if (html) e.innerHTML = html; return e; };
  const btn = el("button", "w2jBtn"); btn.type = "button"; btn.setAttribute("aria-label", "Your ledger: play money and jobs");
  (document.getElementById("mapWrap") || document.body).appendChild(btn);
  const bar = el("div", "w2jBar", `<div class="top"><b class="t"></b><span class="clock"></span><span class="earn"><i class="w2j-coin"></i><span class="n">0</span></span><button class="x" type="button" aria-label="Stop this job">&#10005;</button></div><div class="ticket"></div>`);
  bar.setAttribute("role", "status"); document.body.appendChild(bar);
  const card = el("div", "w2jCard", `<div class="card" role="dialog" aria-modal="true"></div>`); document.body.appendChild(card);
  const cardBody = card.firstChild;
  function paintBtn() { btn.innerHTML = `<i class="w2j-coin"></i>${L.bal}`; btn.title = money(L.bal) + " (play money)"; }
  paintBtn();
  let cardOpen = false;
  function showCard(html, wire) { cardBody.innerHTML = html; card.classList.add("on"); cardOpen = true; if (env.onCard) env.onCard(true); if (wire) wire(cardBody); }
  function closeCard() { card.classList.remove("on"); cardOpen = false; if (env.onCard) env.onCard(false); }
  card.addEventListener("click", (e) => { if (e.target === card) closeCard(); });
  const when = (t) => { try { return new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); } catch (e) { return ""; } };
  const siteOf = (d) => (env.site ? env.site(d) : null);
  function openLedger() {
    const jobsHtml = defs.map((d) => { const s = siteOf(d); return `<button type="button" data-job="${esc(d.id)}"><span><b>${esc(d.title)}</b><small>${esc(s ? s.name : title(d.at))} &middot; ${d.kind === "courier" ? d.runs + " runs" : d.seconds + " s"} &middot; ${esc(payLine(d))}</small></span><em>Show me the way</em></button>`; }).join("");
    const log = L.log.slice(0, 14).map((e) => `<li><b class="${e.amt < 0 ? "neg" : ""}">${e.amt > 0 ? "+" : ""}${e.amt}</b><span>${esc(e.text)}</span><time>${when(e.t)}</time></li>`).join("") || `<li><span>Nothing yet. Take a shift and it shows up here.</span></li>`;
    showCard(`<h2>Your ledger</h2><div class="bal"><i class="w2j-coin"></i><b>${L.bal}</b> ${esc(L.bal === 1 ? cur.one : cur.name)}</div><p>${esc(policy)}</p>
      <h3>Work in town</h3><div class="jobs">${jobsHtml}</div><h3>Lately</h3><ul>${log}</ul><div class="row"><button type="button" class="ghost" data-close>Close</button></div>`, (root) => {
      root.querySelector("[data-close]").addEventListener("click", closeCard);
      for (const b of root.querySelectorAll("[data-job]")) b.addEventListener("click", () => { const d = defs.find((x) => x.id === b.dataset.job), s = siteOf(d); closeCard(); if (s && env.guideTo) env.guideTo({ id: "job-" + d.id, icon: s.icon || "store", name: s.name, x: s.x, z: s.z }); });
    });
  }
  const payLine = (d) => (d.kind === "courier" ? `${d.pay} a delivery, +${d.bonus} on time` : d.kind === "usher" ? `${d.pay} a guest` : `${d.pay} each${d.tip ? ", +" + d.tip + " if you're quick" : ""}`);
  btn.addEventListener("click", (e) => { e.stopPropagation(); if (!cardOpen) openLedger(); });

  // ---- in-world helpers: speech bubbles over customers, a green marker over the next thing to use
  const bubbles = [];
  function bubble(k) {
    if (bubbles[k]) return bubbles[k];
    const c = document.createElement("canvas"); c.width = 256; c.height = 96; const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })); sp.scale.set(0.74, 0.28, 1); sp.visible = false; sp.renderOrder = 4; env.scene.add(sp);
    return (bubbles[k] = { sp, c, tex, text: null });
  }
  function say(k, text, x, y, z) {
    const b = bubble(k);
    if (text === null) { b.sp.visible = false; return; }
    if (b.text !== text) { b.text = text; const g = b.c.getContext("2d"); g.clearRect(0, 0, 256, 96);
      g.fillStyle = "rgba(250,246,236,0.96)"; g.beginPath(); g.roundRect(6, 6, 244, 64, 18); g.fill(); g.beginPath(); g.moveTo(112, 68); g.lineTo(128, 92); g.lineTo(144, 68); g.fill();
      g.fillStyle = "#1c2a22"; g.textAlign = "center"; g.textBaseline = "middle"; let s = 34; g.font = `800 ${s}px system-ui, sans-serif`; while (g.measureText(text).width > 224 && s > 14) { s -= 2; g.font = `800 ${s}px system-ui, sans-serif`; }
      g.fillText(text, 128, 39); b.tex.needsUpdate = true; }
    b.sp.position.set(x, y, z); b.sp.visible = true;
  }
  const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.05, 0), new THREE.MeshBasicMaterial({ color: 0x7bd88f, transparent: true, opacity: 0.9, depthTest: false })); marker.visible = false; marker.renderOrder = 5; env.scene.add(marker);
  let markAt = null;
  const mark = (p) => { markAt = p; marker.visible = !!p; };

  // ---- people (the shared figure pool from life.js)
  const F = env.figures;
  function person(seed, x, y, z, yaw, look) { const i = F.alloc(seed, look); const p = { i, x, y, z, yaw, tx: x, tz: z, amp: 0, phase: Math.random() * 6, speed: 1.5, moving: false, sink: 0 }; F.set(i, x, y, z, yaw, 0, p.phase); return p; }
  function walk(p, dt) {   // toward (tx, tz); returns true on arrival
    const dx = p.tx - p.x, dz = p.tz - p.z, d = Math.hypot(dx, dz);
    if (d < 0.06) { if (p.moving) { p.moving = false; } p.amp += (0 - p.amp) * Math.min(1, dt * 8); F.set(p.i, p.x, p.y - p.sink, p.z, p.yaw, p.amp, p.phase); return true; }
    const s = Math.min(d, p.speed * dt); p.x += dx / d * s; p.z += dz / d * s; p.moving = true;
    const want = Math.atan2(dx, dz); let da = want - p.yaw; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; p.yaw += da * Math.min(1, dt * 9);
    p.phase += s * 6.2832 / 1.42; p.amp += (1 - p.amp) * Math.min(1, dt * 6); F.set(p.i, p.x, p.y, p.z, p.yaw, p.amp, p.phase); return false;
  }
  const gone = (p) => { if (p && p.i >= 0) { F.free(p.i); p.i = -1; } };

  // ---- the shop you are standing in (main.js tells us)
  let shop = null, keeper = null;
  const hash = (s) => { let h = 7; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };

  // ---- job state
  let J = null;   // { def, kind, t, earned, n, ... }
  const stationsOutdoor = {}, seatStations = [];
  let seatPlaques = null;
  function paintBar() {
    if (!J) { bar.classList.remove("on"); document.body.classList.remove("w2job"); return; }
    bar.classList.add("on"); document.body.classList.add("w2job");
    bar.querySelector(".t").textContent = J.def.short || J.def.title;
    const ck = bar.querySelector(".clock"); ck.textContent = J.clock === null ? "" : mmss(J.clock); ck.classList.toggle("low", J.clock !== null && J.clock < 10);
    bar.querySelector(".n").textContent = "+" + J.earned;
    const tk = bar.querySelector(".ticket"); if (tk._html !== J.ticket) { tk._html = J.ticket; tk.innerHTML = J.ticket || ""; document.body.style.setProperty("--w2jb", Math.round(bar.getBoundingClientRect().bottom) + "px"); }
  }
  bar.querySelector(".x").addEventListener("click", (e) => { e.stopPropagation(); if (J) finish("stopped"); });

  function start(id) {
    if (J) return false;
    const def = defs.find((d) => d.id === id); if (!def) return false;
    J = { def, kind: def.kind, t: def.seconds || 0, clock: def.seconds || null, earned: 0, n: 0, ticket: "", since: 0 };
    let ok = false;
    try { ok = def.kind === "orders" ? startOrders() : def.kind === "courier" ? startCourier() : def.kind === "usher" ? startUsher() : false; } catch (e) { try { console.warn("[W2] job", e); } catch (e2) {} ok = false; }
    if (!ok) { J = null; paintBar(); return false; }
    env.blip("ok"); paintBar(); return true;
  }
  function finish(why) {
    if (!J) return;
    const j = J; J = null;
    try { if (j.kind === "orders") endOrders(j); else if (j.kind === "courier") endCourier(j); else endUsher(j); } catch (e) {}
    mark(null); for (let k = 0; k < bubbles.length; k++) if (bubbles[k]) say(k, null);
    paintBar();
    const what = j.kind === "courier" ? `${j.n} ${j.n === 1 ? "delivery" : "deliveries"}` : j.kind === "usher" ? `${j.n} ${j.n === 1 ? "guest" : "guests"} seated` : `${j.n} served`;
    if (j.earned > 0) { entry(j.earned, `${j.def.title}: ${what}`); L.shifts++; save(); env.blip("done"); }
    const head = why === "stopped" ? "Shift stopped" : why === "left" ? "You left your post" : j.kind === "courier" ? "Run complete" : "Shift over";
    showCard(`<h2>${esc(head)}</h2><p class="big">${esc(j.def.title)}: ${esc(what)}.</p><div class="bal"><i class="w2j-coin"></i><b>+${j.earned}</b> ${esc(j.earned === 1 ? cur.one : cur.name)}</div>
      <p>Your ledger now holds ${esc(money(L.bal))}. ${esc(policy)}</p><div class="row"><button type="button" data-again>${why === "left" ? "Ledger" : "Work again"}</button><button type="button" class="ghost" data-close>Done</button></div>`, (root) => {
      root.querySelector("[data-close]").addEventListener("click", closeCard);
      root.querySelector("[data-again]").addEventListener("click", () => { closeCard(); if (why === "left") openLedger(); else if (!start(j.def.id)) env.hint("Walk back to where the job starts to work again."); });
    });
  }

  // ================= orders: the barista and the newsstand =================
  function ordersPlace(def) {
    if (def.at === "NEWSSTAND") { const ns = env.newsstand; if (!ns) return null;
      return { where: "street", y: ns.y, queue: ns.customers.map((c) => ({ x: c.x, z: c.z, yaw: Math.atan2(ns.seller.x - c.x, ns.seller.z - c.z) })), from: ns.from, work: stationsOutdoor, serve: stationsOutdoor._serve, head: 2.02 }; }
    if (!shop || !shop.working || shop.working.id !== def.id) return null;
    return { where: "shop", y: 0, queue: shop.spots.queue, from: [shop.spots.door, shop.spots.door], work: shop.spots.work, serve: shop.spots.serve, head: 2.0 };
  }
  function startOrders() {
    const P = ordersPlace(J.def); if (!P) { env.hint("Clock in where the job is: " + title(J.def.at) + "."); return false; }
    J.P = P; J.cust = []; J.spawn = 0.4; J.done = []; J.order = null; J.guided = true; J.seed = (Math.random() * 1e9) | 0;
    for (const id in P.work) if (id[0] !== "_") { P.work[id].off = false; P.work[id].label = J.def.stations[id] || id; }
    if (P.serve) P.serve.off = true;
    if (P.work._clock) P.work._clock.off = true;
    env.hint(J.def.at === "NEWSSTAND" ? "Customers are coming. Tap the stack they ask for, then hand it over." : "Orders are coming. Walk the bar: tap each machine in the order on the ticket.");
    return true;
  }
  function endOrders(j) {
    for (const c of j.cust) gone(c.p);
    for (const id in j.P.work) if (id[0] !== "_") j.P.work[id].off = true;
    if (j.P.serve) j.P.serve.off = true;
    if (j.P.work._clock) j.P.work._clock.off = false;
  }
  function frontCustomer() { let best = null; for (const c of J.cust) if (c.state === "wait" && (!best || c.slot < best.slot)) best = c; return best; }
  function ticketHtml() {
    const o = J.order; if (!o) return "<i>Waiting for a customer&hellip;</i>";
    const steps = o.steps.map((s, k) => `<i class="${k < J.done.length ? "done" : k === J.done.length ? "next" : ""}">${esc(J.def.stations[s] || s)}</i>`).join(" &rsaquo; ");
    return `${esc(o.name)}: ${steps}${J.done.length >= o.steps.length ? ' &rsaquo; <i class="next">hand it over</i>' : ""}`;
  }
  function updateOrders(dt) {
    const P = J.P, max = Math.min(2, P.queue.length);
    J.spawn -= dt;
    if (J.cust.length < max && J.spawn <= 0 && J.t > 4) {
      const used = J.cust.map((c) => c.slot), slot = [0, 1, 2].find((k) => k < P.queue.length && !used.includes(k)), from = P.from[(J.n + J.cust.length) % P.from.length];
      const menu = J.def.menu || [], o = menu[Math.floor(Math.random() * menu.length)];
      const p = person(J.seed + J.n * 7 + J.cust.length * 13 + ((Math.random() * 99) | 0), from.x, P.y, from.z, 0); p.tx = P.queue[slot].x; p.tz = P.queue[slot].z; p.speed = 1.7;
      J.cust.push({ p, slot, order: o, state: "walk", t0: 0, k: J.cust.length }); J.spawn = 2.2 + Math.random() * 2.5;
    }
    let bi = 0;
    for (let k = J.cust.length - 1; k >= 0; k--) {
      const c = J.cust[k], arrived = walk(c.p, dt);
      if (c.state === "walk" && arrived) { c.state = "wait"; c.t0 = J.since; c.p.yaw = P.queue[c.slot].yaw; env.blip(P.where === "shop" ? "door" : "tick"); }
      else if (c.state === "leave" && arrived) { gone(c.p); J.cust.splice(k, 1); continue; }
      if (c.state === "wait") say(bi++, c.order.name, c.p.x, c.p.y + P.head - 0.08, c.p.z);
    }
    for (; bi < 3; bi++) if (bubbles[bi]) say(bi, null);
    const front = frontCustomer(), o = front ? front.order : null;
    if (o !== J.order) { J.order = o; J.done = []; }
    const ready = !!(o && J.done.length >= o.steps.length);
    for (const id in P.work) if (id[0] !== "_") P.work[id].off = ready;
    if (P.serve) { P.serve.off = !ready; if (ready && front && P.where === "street") { P.serve.tx = front.p.x; P.serve.tz = front.p.z; } }
    const next = o ? (ready ? P.serve : P.work[o.steps[J.done.length]]) : null;
    mark(J.guided && next ? { x: next.tx, y: (next.y || 1.1) + 0.36, z: next.tz } : null);
    J.ticket = ticketHtml();
  }
  function useStation(id) {
    if (!J || J.kind !== "orders") return;
    const o = J.order; if (!o) { env.hint("Nobody is waiting yet."); return; }
    const want = o.steps[J.done.length];
    if (id === want) { J.done.push(id); env.blip("tick"); if (J.done.length >= o.steps.length) env.hint(J.P.where === "shop" ? o.name + " is ready. Take it to the counter." : "Hand it over."); }
    else { env.blip("bad"); env.hint(want ? "Not that one. Next: " + (J.def.stations[want] || want) + "." : "It's ready: hand it over."); }
  }
  function serve() {
    if (!J || J.kind !== "orders") return;
    const c = frontCustomer(), o = J.order; if (!c || !o) return;
    if (J.done.length < o.steps.length) { env.blip("bad"); env.hint("Not ready. Next: " + (J.def.stations[o.steps[J.done.length]] || "") + "."); return; }
    const quick = J.since - c.t0 <= (J.def.tipUnder || 12), pay = (J.def.pay || 1) + (quick ? J.def.tip || 0 : 0);
    J.earned += pay; J.n++; J.guided = false; J.done = []; J.order = null; env.blip("coin");
    env.hint(quick && J.def.tip ? `+${pay}: quick, they tipped.` : `+${pay}`);
    c.state = "leave"; const out = J.P.from[(c.k + 1) % J.P.from.length]; c.p.tx = out.x; c.p.tz = out.z; c.p.speed = 1.9;
  }

  // ================= courier =================
  function startCourier() {
    const slots = env.shops ? env.shops() : []; if (slots.length < 4 || env.indoors()) { env.hint("The courier bike is outside Wells St Bikes."); return false; }
    J.run = 0; J.clock = null; J.phase = null; J.slots = slots; env.setBike(true); env.blip("bell"); nextRun(); return true;
  }
  function nextRun() {
    const s = env.state, slots = J.slots, d = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
    const pickFrom = (o, lo, hi, not) => { let c = slots.filter((q) => q !== not && d(q, o) >= lo && d(q, o) <= hi); if (!c.length) c = slots.filter((q) => q !== not); return c[Math.floor(Math.random() * c.length)]; };
    J.a = pickFrom(s, 45, 150, J.b); J.b = pickFrom(J.a, 80, 230, J.a); J.phase = "pickup"; J.clock = null;
    J.ticket = `Run ${J.run + 1} of ${J.def.runs}: pick up at <i class="next">${esc(title(J.a.name))}</i>`;
    env.guideTo({ id: "job-run", icon: "post", name: "Pickup: " + title(J.a.name), x: J.a.x, z: J.a.z });
  }
  function updateCourier(dt) {
    if (env.indoors()) return;
    const s = env.state, tgt = J.phase === "pickup" ? J.a : J.b, near = Math.hypot(s.x - tgt.x, s.z - tgt.z) < 2.4;
    if (J.phase === "drop") { J.clock -= dt; }
    if (!near) return;
    if (J.phase === "pickup") {
      J.phase = "drop"; J.clock = Math.max(22, (Math.abs(J.b.x - J.a.x) + Math.abs(J.b.z - J.a.z)) * (J.def.secondsPerMeter || 0.2) + (J.def.slack || 12)); env.blip("ok");
      J.ticket = `Run ${J.run + 1} of ${J.def.runs}: deliver to <i class="next">${esc(title(J.b.name))}</i>`;
      env.hint("Got the parcel. Deliver it to " + title(J.b.name) + "."); env.guideTo({ id: "job-run", icon: "post", name: "Deliver: " + title(J.b.name), x: J.b.x, z: J.b.z });
    } else {
      const onTime = J.clock > 0, pay = onTime ? (J.def.pay || 1) + (J.def.bonus || 0) : Math.max(1, Math.floor((J.def.pay || 1) / 2));
      J.earned += pay; J.n++; J.run++; env.blip("coin"); env.hint(onTime ? `Delivered on time: +${pay}` : `Delivered late: +${pay}`);
      if (J.run >= (J.def.runs || 3)) finish("done"); else nextRun();
    }
  }
  function endCourier() { env.setBike(false); env.clearGuide(); }

  // ================= usher (the Grand Palace) =================
  const seatName = (s) => "ABCDEFGH"[s.row] + (s.col + 1);
  function theaterSetup() {   // once: a number plate on the back of every seat, and a station per seat
    const T = env.theater; if (!T || seatPlaques) return !!T;
    const cols = 6, rows = Math.ceil(T.seats.length / cols), c = document.createElement("canvas"); c.width = 512; c.height = 64 * rows; const g = c.getContext("2d");
    const pos = [], uv = [], idx = [];
    T.seats.forEach((s, k) => {
      const x = (k % cols) * (512 / cols), y = Math.floor(k / cols) * 64, w = 512 / cols;
      g.fillStyle = "#1a1216"; g.fillRect(x, y, w, 64); g.strokeStyle = "#c9a45a"; g.lineWidth = 3; g.strokeRect(x + 4, y + 4, w - 8, 56); g.fillStyle = "#f2dca0"; g.font = "800 36px Georgia, serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(seatName(s), x + w / 2, y + 34);
      const b = pos.length / 3, u0 = x / 512, u1 = (x + w) / 512, v0 = 1 - (y + 64) / c.height, v1 = 1 - y / c.height;
      pos.push(s.x - 0.2, 1.12, s.z + 0.462, s.x + 0.2, 1.12, s.z + 0.462, s.x + 0.2, 1.36, s.z + 0.462, s.x - 0.2, 1.36, s.z + 0.462); uv.push(u0, v0, u1, v0, u1, v1, u0, v1); idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
      const stn = { job: true, off: true, label: "Seat " + seatName(s), x: s.x, z: s.z + 0.35, hw: 0.85, hd: 0.95, y: 1.0, tx: s.x, tz: s.z + 0.2, r: 0.55, reach: 3.4, act: { type: "fn", fn: () => seatHere(s) } };
      seatStations.push(stn); env.addStation("theater", stn);
    });
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    seatPlaques = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex })); env.scene.add(seatPlaques);
    // the usher's post: a lectern by the doors with the sign-up
    const d = defs.find((x) => x.kind === "usher");
    if (d && T.post) {
      const wood = new THREE.MeshStandardMaterial({ color: 0x5a3626, roughness: 0.7 }), body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 1.05, 10), wood), top = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.05, 0.46), wood);
      body.position.set(T.post.x, 0.52, T.post.z); top.position.set(T.post.x, 1.1, T.post.z); top.rotation.x = 0.35; env.scene.add(body, top);
      if (env.sprite) env.sprite("USHER WANTED", T.post.x, 1.95, T.post.z, 1.15);
      env.addStation("theater", { job: true, startsJob: true, label: `Clock in: ${d.title} (${d.seconds} s)`, x: T.post.x, z: T.post.z, hw: 1.7, hd: 1.7, act: { type: "fn", fn: () => start(d.id) } });
    }
    return true;
  }
  function startUsher() {
    if (!theaterSetup() || env.indoors() !== "theater") { env.hint("The usher's post is inside the Grand Palace."); return false; }
    J.guests = []; J.seated = []; J.taken = new Set(); J.follow = null; J.spawn = 0.2; J.seed = (Math.random() * 1e9) | 0;
    for (const s of seatStations) s.off = false;
    env.hint("Guests are at the doors. Walk up to one, then walk them to the seat on their ticket.");
    return true;
  }
  function endUsher(j) { for (const g of j.guests) gone(g.p); for (const p of j.seated) gone(p); for (const s of seatStations) s.off = true; }
  function updateUsher(dt) {
    const T = env.theater, s = env.state;
    J.spawn -= dt;
    const waiting = J.guests.filter((g) => g.state !== "sitting");
    if (waiting.length < 2 && J.spawn <= 0 && J.t > 5 && F.inUse < 15) {
      const free = T.seats.filter((q) => !J.taken.has(q)); if (free.length) {
        const seat = free[Math.floor(Math.random() * free.length)]; J.taken.add(seat);
        const k = J.guests.filter((g) => g.state === "wait" || g.state === "in").length, ex = T.entry.x + (k % 2 ? 1.6 : -1.6);
        const p = person(J.seed + J.n * 11 + J.guests.length * 5 + ((Math.random() * 99) | 0), T.entry.x + (Math.random() - 0.5), 0, T.entry.z + 1.2, Math.PI); p.tx = ex; p.tz = T.entry.z - 0.4; p.speed = 1.6;
        J.guests.push({ p, seat, state: "in" }); J.spawn = 3;
      }
    }
    let bi = 0;
    for (let k = J.guests.length - 1; k >= 0; k--) {
      const g = J.guests[k];
      if (g.state === "follow") { const fx = -Math.sin(s.yaw), fz = -Math.cos(s.yaw); g.p.tx = s.x - fx * 1.1; g.p.tz = s.z - fz * 1.1; g.p.speed = Math.hypot(g.p.tx - g.p.x, g.p.tz - g.p.z) > 2.5 ? 5 : 2.6; }
      const arrived = walk(g.p, dt);
      if (g.state === "in" && arrived) { g.state = "wait"; g.p.yaw = Math.PI; }
      if (g.state === "wait" && !J.follow && Math.hypot(s.x - g.p.x, s.z - g.p.z) < 1.9) { g.state = "follow"; J.follow = g; env.blip("ok"); env.hint("Seat " + seatName(g.seat) + ". Walk them to it and tap the seat."); }
      if (g.state === "sitting" && arrived) { g.p.yaw = Math.PI; g.p.sink = 0.42; g.p.amp = 0; F.set(g.p.i, g.seat.x, -0.42, g.seat.z + 0.02, Math.PI, 0, g.p.phase); J.seated.push(g.p); J.guests.splice(k, 1); continue; }
      if (g.state === "wait" || g.state === "follow") say(bi++, "Seat " + seatName(g.seat), g.p.x, 2.05, g.p.z);
    }
    for (; bi < 3; bi++) if (bubbles[bi]) say(bi, null);
    J.ticket = J.follow ? `Take your guest to <i class="next">seat ${esc(seatName(J.follow.seat))}</i>` : "<i>Walk up to a guest at the doors</i>";
  }
  function seatHere(seat) {
    if (!J || J.kind !== "usher") return;
    const g = J.follow; if (!g) { env.hint("Fetch a guest from the doors first."); return; }
    if (g.seat !== seat) { env.blip("bad"); env.hint("This is " + seatName(seat) + ". The ticket says " + seatName(g.seat) + "."); return; }
    g.state = "sitting"; g.p.tx = seat.x; g.p.tz = seat.z + 0.02; g.p.speed = 2.4; J.follow = null; J.earned += J.def.pay || 1; J.n++; env.blip("coin"); env.hint("+" + (J.def.pay || 1) + ": enjoy the picture.");
  }

  // ---- outdoor stations for the newsstand (made once; off until the shift starts)
  function newsstandSetup() {
    const ns = env.newsstand, def = defs.find((d) => d.at === "NEWSSTAND"); if (!ns || !def || stationsOutdoor._made) return;
    stationsOutdoor._made = true;
    const ids = Object.keys(ns.stacks), half = ids.length > 1 ? Math.abs(ns.stacks[ids[0]].x - ns.stacks[ids[1]].x) / 2 - 0.01 : 0.4;
    for (const id of ids) { const p = ns.stacks[id];
      stationsOutdoor[id] = { job: true, off: true, label: (def.stations && def.stations[id]) || id, x: p.x, z: ns.seller.z, hw: half, hd: 0.75, y: p.y, tx: p.x, tz: p.z, r: 0.3, reach: 2.4, act: { type: "fn", fn: () => useStation(id) } };
      env.addStation("street", stationsOutdoor[id]); }
    stationsOutdoor._clock = { job: true, startsJob: true, label: `Clock in: ${def.title} (${def.seconds} s)`, x: ns.seller.x, z: ns.seller.z, hw: 1.6, hd: 0.8, act: { type: "fn", fn: () => start(def.id) } };
    env.addStation("street", stationsOutdoor._clock);
    stationsOutdoor._serve = { job: true, off: true, label: "Hand it over", x: ns.seller.x, z: ns.seller.z, hw: 1.6, hd: 0.8, y: 1.45, tx: ns.customers[1].x, tz: ns.customers[1].z, r: 0.6, reach: 3.2, act: { type: "fn", fn: () => serve() } };
    env.addStation("street", stationsOutdoor._serve);
  }
  newsstandSetup();

  paintBar();
  return {
    defs, get active() { return J ? J.def.id : null; }, get kind() { return J ? J.kind : null; }, get cardOpen() { return cardOpen; },
    get carrying() { return !!(J && J.kind === "courier" && J.phase === "drop"); }, get state() { return J; },
    get balance() { return L.bal; }, ledger: () => JSON.parse(JSON.stringify(L)), money, openLedger, closeCard,
    start, stop: () => finish("stopped"), use: useStation, serve,
    // buying something in a shop: play money only, and it only moves the ledger
    buy(shopName, item, price) {
      price = Math.max(0, Math.round(+price || 0));
      if (L.bal < price) { env.blip("bad"); env.hint(`That is ${money(price)}. You have ${L.bal}. There is work in town: tap your ledger.`); return false; }
      entry(-price, `${title(shopName)}: ${item}`); env.blip("coin"); env.hint(`You got ${item}. -${price} (play money)`); return true;
    },
    earn(n, text) { entry(Math.round(n), text); },
    // main.js tells us when a shop opens or closes around you
    shopOpened(s) {
      shop = s;
      if (s.spots.keeper) keeper = person(hash(s.row.name) + 3, s.spots.keeper.x, 0, s.spots.keeper.z, s.spots.keeper.yaw, { top: s.kind.accent });
      for (const st of s.stations) {
        if (st.kind === "work") st.act = { type: "fn", fn: () => useStation(st.id) };
        else if (st.kind === "serve") st.act = { type: "fn", fn: () => serve() };
        else if (st.kind === "clock") { const d = defs.find((x) => x.id === st.job); st.label = d ? `Clock in: ${d.title} (${d.seconds} s)` : "Clock in"; st.act = { type: "fn", fn: () => { if (J) env.hint("You are already on the clock."); else start(st.job); } }; }
        else if (st.kind === "buy") { st.label = `Buy ${st.item} · ${st.price} ${st.price === 1 ? cur.one : cur.name}`; st.act = { type: "fn", fn: () => this.buy(s.row.name, st.item, st.price) }; }
      }
      const who = s.row.keeper ? s.row.keeper + ": " : ""; if (s.row.hello) env.hint(who + "“" + s.row.hello + "”", 4200);
    },
    shopClosing() { if (J && J.kind === "orders" && J.P && J.P.where === "shop") finish("left"); gone(keeper); keeper = null; shop = null; },
    leftInterior(id) { if (J && J.kind === "usher" && id === "theater") finish("left"); },
    theaterReady() { theaterSetup(); },
    // per frame
    update(dt) {
      if (markAt) { marker.position.set(markAt.x, markAt.y + Math.sin(performance.now() / 260) * 0.05, markAt.z); marker.rotation.y += dt * 2; }
      if (!J) return;
      if (cardOpen) return;   // the clock waits while a card is up
      J.since += dt;
      if (J.kind !== "courier") { J.t -= dt; J.clock = J.t; }
      if (J.kind === "orders") { if (J.P.where === "street" && Math.hypot(env.state.x - env.newsstand.seller.x, env.state.z - env.newsstand.seller.z) > 9) { finish("left"); return; } updateOrders(dt); }
      else if (J.kind === "courier") updateCourier(dt);
      else updateUsher(dt);
      if (J && J.kind !== "courier" && J.t <= 0) { finish("time"); return; }
      paintBar();
    },
    people: () => F.inUse,
  };
}
