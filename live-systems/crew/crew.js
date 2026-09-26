// Shared by every /live-systems/crew/ page. Data: public.crew_snapshot (written hourly by tools/publish-crew.py on the MSI),
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
  const tabs = [["", "Overview"], ["schedule/", "Schedule"], ["chat/", "Conversations"], ["retired/", "Retired"]];
  const el = document.getElementById("crewnav");
  if (el) el.innerHTML = tabs.map(([href, label]) =>
    `<a href="/live-systems/crew/${href}"${label === active ? ' aria-current="page"' : ""}>${label}</a>`).join("");
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
