// Heartbeat TV tips: per-video Tip button + "Most tipped" list. Payments are OFF until system_settings.tips_enabled = 1.
// Raw tip rows are never public; the page reads only the video_tip_totals view. Rows are written by a server-side webhook (not built yet).
//
// >>> PLUG-IN SPOT: when the LLC's Stripe account exists, paste the Payment Link (or Checkout URL) below. <<<
// Stripe: Payment Links -> create "Tip" (customer chooses amount) -> copy the https://buy.stripe.com/... URL here.
// The video id is appended as ?client_reference_id=<tv_items.id> so the webhook knows which video was tipped.
export const TIP_LINK = "";   // e.g. "https://buy.stripe.com/xxxxxxxx"  (empty = nothing can open, even if the switch is on)

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const money = (c) => "$" + (c / 100).toFixed(c % 100 ? 2 : 0);
let enabled = false, totals = {};

export async function loadTips(supabase) {
  try { const r = await supabase.from("system_settings").select("value").eq("key", "tips_enabled").maybeSingle(); enabled = Number(r.data && r.data.value) === 1 && !!TIP_LINK; } catch (e) {}
  try { const r = await supabase.from("video_tip_totals").select("item_id,total_cents,tip_count"); totals = Object.fromEntries((r.data || []).map((t) => [t.item_id, t])); } catch (e) {}
}

// the bar under the picture for the video that is on now
export function tipBar(item) {
  if (!item || !item.id) return "";
  const t = totals[item.id], got = t ? `<span class="tipcount">${money(t.total_cents)} from ${t.tip_count} ${t.tip_count === 1 ? "tip" : "tips"}</span>` : "";
  const btn = enabled
    ? `<a class="tipbtn" href="${esc(TIP_LINK)}?client_reference_id=${encodeURIComponent(item.id)}" target="_blank" rel="noopener">Tip this video</a>`
    : `<button class="tipbtn off" type="button" disabled>Tips open soon</button>`;
  return `${btn}${got}`;
}

// the "Most tipped" list; rows tune the TV when tapped
export function mostTipped(channels, num) {
  const rows = [];
  channels.forEach((c) => c.items.forEach((it, i) => { const t = it.id && totals[it.id]; if (t && t.total_cents > 0) rows.push({ c, it, i, t }); }));
  rows.sort((a, b) => b.t.total_cents - a.t.total_cents);
  if (!rows.length) return `<p class="muted">No tips yet. ${enabled ? "Be the first - tap Tip on a video you love." : "Tips open soon. The most-tipped videos here are the ones we share out to YouTube, X and TikTok."}</p>`;
  return rows.slice(0, 10).map((r, k) => `<button class="gi" data-n="${r.c.n}" data-i="${r.i}"><small>${k + 1}</small><span>${esc(r.it.title)}</span><em>${money(r.t.total_cents)}</em></button>`).join("");
}
