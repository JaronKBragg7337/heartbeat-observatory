// Shared by every /live-systems/crew/ page. Data: public.crew_snapshot (written every 5 minutes by tools/publish-crew.py on the MSI),
// plus the public trade tables. Everything here is public on purpose - Jaron: "people only believe it when they can see it."
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const supabase = createClient("https://ygjpnvrwhkrowkrskftk.supabase.co", "sb_publishable_Y-duV64ayMMEvVwMs5PWuw_6kvzbOrN");
export const $ = (id) => document.getElementById(id);
export const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export const usd = (n) => (Number(n) < 0 ? "-$" : "$") + Math.abs(Number(n) || 0).toFixed(2);
export const ago = (iso) => {
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};

export async function snapshot() {
  const { data } = await supabase.from("crew_snapshot").select("data,updated_at").eq("id", "current").maybeSingle();
  return data;
}

// Tabs across the top of every crew page.
export function nav(active) {
  const tabs = [["", "Overview"], ["trades/", "Trades"], ["reasoning/", "Reasoning"], ["schedule/", "Schedule"], ["chat/", "Conversations"], ["retired/", "Retired"]];
  const el = document.getElementById("crewnav");
  if (el) el.innerHTML = tabs.map(([href, label]) =>
    `<a href="/live-systems/crew/${href}"${label === active ? ' aria-current="page"' : ""}>${label}</a>`).join("");
}

// Which crew member made a trade (same naming as the Trades page): today's crew from the snapshot, retired ones by handover time.
export function whoName(actor, at, snap) {
  const a = String(actor || ""), when = at || "", d = (snap && snap.data) || {};
  for (const r of d.retired || []) if (r.actor && a === r.actor && r.until && when && when < r.until) return r.name.replace(/ \(v1\)$/, "") + " (retired)";
  for (const b of d.bots || [])
    if ((b.actor && a === b.actor) || (b.actor_prefix && a.startsWith(b.actor_prefix)) || (b.id === "deepseek" && /deepseek/.test(a))) return b.name;
  const m = a.match(/^auto:(?:grok-bot\/)?(.+)$/);
  return m ? m[1] : a || "unknown";
}

const RANGES = [["1D", 1, "Past day"], ["1W", 7, "Past week"], ["1M", 30, "Past month"], ["3M", 91, "Past 3 months"], ["1Y", 365, "Past year"], ["All", 0, "All time"]];
const sgn = (n) => (n >= 0 ? "+" : "-") + "$" + Math.abs(n).toFixed(2);
const axisUsd = (n, step) => (n < 0 ? "-$" : "$") + Math.abs(n).toFixed(step < 1 ? 2 : 0);

// Cumulative settled profit, brokerage style: range buttons, change header, y-axis rescaled to the range, tap a dot for the trade.
// rows: resolution rows [{at, pnl_usd, cost_usd, actor, title, slug}]. Plain SVG, no library.
export function mountPnlChart(el, rows, snap) {
  const all = rows.filter((r) => r.pnl_usd != null).sort((a, b) => a.at.localeCompare(b.at));
  if (all.length < 2) { el.innerHTML = `<p class="muted small">The chart starts once two of its trades have settled.</p>`; return; }
  const T = all.map((r) => new Date(r.at).getTime());
  const cum = []; let run = 0;
  for (const r of all) cum.push((run += Number(r.pnl_usd)));
  let range = "All", sel = null, lastW = 0;
  try { const s = localStorage.getItem("crewPnlRange"); if (RANGES.some((r) => r[0] === s)) range = s; } catch (e) {}

  function draw() {
    const [, days, label] = RANGES.find((r) => r[0] === range);
    const now = Date.now();
    const t0 = days ? now - days * 864e5 : T[0] - 3600e3, t1 = days ? now : T[T.length - 1];
    const idx = []; let before = 0;
    T.forEach((t, i) => { if (t < t0) before = i + 1; else if (t <= t1) idx.push(i); });
    const base = before ? cum[before - 1] : 0;
    const end = idx.length ? cum[idx[idx.length - 1]] : base;
    const change = end - base, staked = idx.reduce((t, i) => t + (Number(all[i].cost_usd) || 0), 0);
    const pct = staked ? (change / staked) * 100 : null;
    const col = change >= 0 ? "#3fb950" : "#e23a45";
    if (sel != null && !idx.includes(sel)) sel = null;

    const W = Math.max(260, Math.round(el.clientWidth || 340)), H = W < 500 ? 250 : 280;
    const padL = 50, padR = 12, padT = 12, padB = 28;
    const vals = [base, ...idx.map((i) => cum[i])];
    let lo = Math.min(...vals), hi = Math.max(...vals);
    if (hi - lo < 1) { hi += 0.5; lo -= 0.5; }
    const room = (hi - lo) * 0.1; lo -= room; hi += room;
    const raw = (hi - lo) / 4, mag = Math.pow(10, Math.floor(Math.log10(raw))), step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw);
    const ticks = []; for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) ticks.push(Math.abs(v) < 1e-9 ? 0 : v);
    const x = (t) => padL + ((t - t0) / (t1 - t0 || 1)) * (W - padL - padR);
    const y = (v) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
    const pts = idx.map((i) => ({ i, x: x(T[i]), y: y(cum[i]) }));
    let d = `M${x(t0).toFixed(1)},${y(base).toFixed(1)}`;
    pts.forEach((p) => (d += `L${p.x.toFixed(1)},${p.y.toFixed(1)}`));
    if (days) d += `L${x(t1).toFixed(1)},${y(end).toFixed(1)}`;
    const fmt = days === 1 ? { hour: "numeric" } : (t1 - t0 < 120 * 864e5) ? { month: "short", day: "numeric" } : { month: "short", year: "2-digit" };
    const xl = [0, 1, 2, 3].map((k) => { const t = t0 + ((t1 - t0) * k) / 3; const anchor = k === 0 ? "start" : k === 3 ? "end" : "middle";
      return `<text x="${(k === 0 ? padL : k === 3 ? W - padR : x(t)).toFixed(1)}" y="${H - 8}" text-anchor="${anchor}" class="ax">${new Date(t).toLocaleString([], fmt)}</text>`; }).join("");
    const grid = ticks.map((v) => `<line x1="${padL}" x2="${W - padR}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="#222c38"/><text x="${padL - 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end" class="ax">${axisUsd(v, step)}</text>`).join("");
    const dots = pts.map((p) => { const c = Number(all[p.i].pnl_usd) >= 0 ? "#3fb950" : "#e23a45";
      return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${p.i === sel ? 7 : pts.length > 60 ? 3.6 : 4.8}" fill="${c}" stroke="${p.i === sel ? "#fff" : "#0d1117"}" stroke-width="${p.i === sel ? 2.5 : 1}"/>`; }).join("");
    const empty = idx.length ? "" : `<text x="${W / 2}" y="${H / 2 - 14}" text-anchor="middle" class="ax">No trades settled in this range</text>`;
    const ri = sel == null ? null : all[sel];
    const detail = ri
      ? `<div class="pc-trade"><b style="color:${Number(ri.pnl_usd) >= 0 ? "#3fb950" : "#e23a45"}">${sgn(Number(ri.pnl_usd))}</b> <span>${esc(ri.title || ri.slug || "a market")}</span>
          <div class="muted">${esc(whoName(ri.actor, ri.at, snap))} · ${esc(new Date(ri.at).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }))} · total then ${usd(cum[sel])}</div>
          <div class="pc-step"><button type="button" data-step="-1" aria-label="Previous trade">&lsaquo; Earlier</button><button type="button" data-step="1" aria-label="Next trade">Later &rsaquo;</button></div></div>`
      : `<div class="pc-trade muted">${idx.length ? "Tap a dot to see that trade." : "Pick a longer range to see trades."}</div>`;
    el.innerHTML = `<div class="pc-head"><div class="pc-big" style="color:${col}">${sgn(change)}</div>
        <div class="pc-sub"><span style="color:${col}">${pct == null ? "" : (pct >= 0 ? "+" : "") + pct.toFixed(1) + "%"}</span>${pct == null ? "" : ` on ${usd(staked)} staked · `}${idx.length} settled · ${label}</div></div>
      <div class="pc-ranges" role="group" aria-label="Chart range">${RANGES.map(([k]) => `<button type="button" data-r="${k}"${k === range ? ' aria-pressed="true"' : ""}>${k}</button>`).join("")}</div>
      <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" class="pc-svg" role="img" aria-label="Settled profit, ${label}: ${sgn(change)} across ${idx.length} trades">
        ${grid}${xl}
        <line x1="${padL}" x2="${W - padR}" y1="${y(base).toFixed(1)}" y2="${y(base).toFixed(1)}" stroke="#7d8896" stroke-dasharray="3 5" opacity=".7"/>
        <path d="${d}" fill="none" stroke="${col}" stroke-width="2.6" stroke-linejoin="round"/>${dots}${empty}
      </svg>${detail}`;
    lastW = W;
    const svg = el.querySelector("svg");
    svg.addEventListener("click", (e) => {
      const r = svg.getBoundingClientRect(), px = (e.clientX - r.left) * (W / r.width), py = (e.clientY - r.top) * (H / r.height);
      let best = null, bd = 30 * 30;
      for (const p of pts) { const dd = (p.x - px) ** 2 + (p.y - py) ** 2; if (dd < bd) { bd = dd; best = p.i; } }
      if (best != null) { sel = best; draw(); }
    });
    el.querySelectorAll("[data-r]").forEach((b) => b.addEventListener("click", () => {
      range = b.dataset.r; sel = null; try { localStorage.setItem("crewPnlRange", range); } catch (e) {} draw(); }));
    el.querySelectorAll("[data-step]").forEach((b) => b.addEventListener("click", () => {
      const k = idx.indexOf(sel) + Number(b.dataset.step); if (k >= 0 && k < idx.length) { sel = idx[k]; draw(); } }));
  }
  draw();
  if (window.ResizeObserver) new ResizeObserver(() => { const w = Math.round(el.clientWidth); if (w && Math.abs(w - lastW) > 1) draw(); }).observe(el);
}

// A cumulative-profit line from resolution rows [{at, pnl_usd}]. Plain SVG, no library.
export function pnlChart(rows, { height = 150 } = {}) {
  const pts = rows.filter((r) => r.pnl_usd != null).sort((a, b) => a.at.localeCompare(b.at));
  if (pts.length < 2) return `<p class="muted small">The chart starts once two of its trades have settled.</p>`;
  let run = 0;
  const series = [{ t: new Date(pts[0].at).getTime() - 3600e3, v: 0 }, ...pts.map((r) => ({ t: new Date(r.at).getTime(), v: (run += Number(r.pnl_usd)) }))];
  const W = 640, H = height, pad = 26;
  const t0 = series[0].t, t1 = series[series.length - 1].t || t0 + 1;
  const vs = series.map((p) => p.v), lo = Math.min(0, ...vs), hi = Math.max(0, ...vs), span = hi - lo || 1;
  const x = (t) => pad + ((t - t0) / (t1 - t0 || 1)) * (W - pad * 2);
  const y = (v) => H - pad - ((v - lo) / span) * (H - pad * 2);
  const d = series.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join("");
  const last = series[series.length - 1].v;
  const col = last >= 0 ? "#3fb950" : "#e23a45";
  const dots = series.slice(1).map((p, i) => {
    const step = Number(pts[i].pnl_usd);
    return `<circle cx="${x(p.t).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="3.2" fill="${step >= 0 ? "#3fb950" : "#e23a45"}"><title>${usd(step)} · ${new Date(pts[i].at).toLocaleString()}</title></circle>`;
  }).join("");
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Profit over time, now ${usd(last)}">
    <line x1="${pad}" x2="${W - pad}" y1="${y(0)}" y2="${y(0)}" stroke="#2a3542" stroke-dasharray="4 4"/>
    <text x="${pad}" y="${y(0) - 6}" fill="#7d8896" font-size="11">$0</text>
    <path d="${d}" fill="none" stroke="${col}" stroke-width="2.4" stroke-linejoin="round"/>
    ${dots}
    <text x="${W - pad}" y="${y(last) - 8}" fill="${col}" font-size="13" text-anchor="end" font-weight="600">${usd(last)}</text>
  </svg>`;
}

export const CREW_CSS = `
  .wrap { max-width: 980px; }
  .crewnav { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; margin: 18px 0 4px; }
  .crewnav a { border: 1px solid var(--line); border-radius: 999px; padding: 6px 14px; font-size: .88rem; color: var(--text); text-decoration: none; }
  .crewnav a[aria-current] { background: var(--text); color: var(--bg); border-color: var(--text); }
  .lede { max-width: 60ch; margin: 10px auto 0; color: var(--muted); line-height: 1.6; }
  .muted { color: var(--muted); } .small { font-size: .85rem; }
  .updated { font-size: 12px; color: var(--muted); margin-top: 10px; }
  h2.sec { font-size: 12px; letter-spacing: .16em; text-transform: uppercase; color: var(--muted); margin: 34px 0 12px; font-weight: 600; }
  .card { border: 1px solid var(--line); border-radius: 14px; background: var(--panel); padding: 16px 18px; }
  .board { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; }
  .stat { border: 1px solid var(--line); border-radius: 12px; padding: 13px 15px; background: var(--panel); }
  .stat b { display: block; font-size: 1.3rem; font-variant-numeric: tabular-nums; }
  .stat span { font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
  .chart { width: 100%; height: auto; display: block; }
  .pc-big { font-size: 2.1rem; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1.1; }
  .pc-sub { font-size: .98rem; color: var(--muted); margin-top: 4px; font-variant-numeric: tabular-nums; }
  .pc-sub span { font-weight: 600; margin-right: 6px; }
  .pc-ranges { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; margin: 14px 0 8px; }
  .pc-ranges button, .pc-step button { min-height: 44px; border: 1px solid var(--line); background: transparent; color: var(--text); border-radius: 10px; font: inherit; font-size: 1rem; font-weight: 600; cursor: pointer; touch-action: manipulation; }
  .pc-ranges button[aria-pressed] { background: var(--text); color: var(--bg); border-color: var(--text); }
  .pc-svg { display: block; max-width: 100%; touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
  .pc-svg .ax { fill: #a9b4c0; font-size: 13px; font-variant-numeric: tabular-nums; }
  .pc-trade { margin-top: 8px; padding: 12px 14px; border: 1px solid var(--line); border-radius: 12px; font-size: 1rem; line-height: 1.45; min-height: 3.2em; }
  .pc-trade b { font-size: 1.2rem; margin-right: 4px; } .pc-trade .muted { font-size: .92rem; margin-top: 3px; }
  .pc-step { display: flex; gap: 8px; margin-top: 10px; } .pc-step button { flex: 1; font-weight: 500; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
  .chip { border: 1px solid var(--line); border-radius: 999px; padding: 4px 10px; font-size: .8rem; font-variant-numeric: tabular-nums; }
  .chip.up { border-color: rgba(63,185,80,.5); color: #7ee08c; } .chip.down { border-color: rgba(226,58,69,.5); color: #ff8a92; }
  .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; vertical-align: 1px; }
  .dot.live { background: #3fb950; box-shadow: 0 0 0 3px rgba(63,185,80,.18); } .dot.quiet { background: #7d8896; }
  pre { white-space: pre-wrap; overflow-wrap: anywhere; font-size: 12.5px; line-height: 1.55; background: #090d13;
        border: 1px solid var(--line); border-radius: 10px; padding: 12px; max-height: 480px; overflow: auto; }
  table { width: 100%; border-collapse: collapse; font-size: .86rem; }
  th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid var(--line); vertical-align: top; }
  th { color: var(--muted); font-weight: 500; font-size: 11px; letter-spacing: .1em; text-transform: uppercase; }
  .scroll { overflow-x: auto; }
`;
