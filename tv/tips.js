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

// ---- Save to phone (Jaron 10/13): every on-site video can be saved to the Photos gallery / Files, plus the 9:16 cut when one exists.
// iPhone/Android: fetch the file and open the share sheet ("Save Video" puts it in Photos). Fallback: a normal download link.
const isOwnFile = (it) => it && /^\/[^/].*\.(mp4|webm|mov)$/i.test(it.src || "");
const vertOf = (src) => src.replace(/\.(mp4|webm|mov)$/i, "-vertical.$1");
export function saveBar(item) {
  if (!isOwnFile(item)) return "";
  const name = (item.title || "heartbeat-video").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "heartbeat-video";
  return `<button class="tipbtn savebtn" type="button" data-save="${esc(item.src)}" data-name="${esc(name)}.mp4">Save video</button>`
    + `<button class="tipbtn savebtn" type="button" data-save="${esc(vertOf(item.src))}" data-name="${esc(name)}-vertical.mp4" data-vert hidden>Save vertical (9:16)</button>`;
}
export async function wireSave(root) {
  const v = root.querySelector("[data-vert]");
  if (v) { try { const r = await fetch(v.dataset.save, { method: "HEAD" }); if (r.ok) v.hidden = false; } catch (e) {} }
  // iPhone only opens the share sheet ("Save Video" -> Photos) if share() runs within a few seconds of a tap. Big files take longer
  // to fetch, so the tap that started the fetch has expired by then and Safari falls back to a file download (10/13 bug on the
  // 23-30 MB episodes). Fix: tap 1 fetches, the button turns into "Ready - tap to save"; tap 2 opens the share sheet right away.
  root.querySelectorAll("[data-save]").forEach((b) => {
    const url = b.dataset.save, name = b.dataset.name, label = b.textContent;
    let file = null;
    const fallback = () => { const a = document.createElement("a"); a.href = file ? URL.createObjectURL(file) : url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); };
    const share = async () => {
      try {
        if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file] }); else fallback();
        b.textContent = label;
      } catch (e) { if (!e || e.name !== "AbortError") fallback(); b.textContent = "Ready - tap to save"; }
    };
    b.onclick = async () => {
      if (file) return share();
      b.disabled = true; b.textContent = "Getting the video…";
      try {
        const blob = await (await fetch(url)).blob();
        file = new File([blob], name, { type: "video/mp4" });
        b.disabled = false; b.textContent = "Ready - tap to save";
      } catch (e) { b.disabled = false; b.textContent = label; fallback(); }
    };
  });
}
