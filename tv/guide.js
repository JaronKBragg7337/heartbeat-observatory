// Heartbeat TV program guide - one numbered list for the TV page, the phone's HB TV app and the Loft TV.
// Every show gets its own number like digital TV: CH 2 Shows -> 2.1, 2.2 ... so nobody has to sit through one thing to reach
// another (Jaron 9/27). Numbers follow tv_items.sort, then the date it was approved.
export async function loadGuide(supabase) {
  const { channels } = await (await fetch("/tv/channels.json", { cache: "no-cache" })).json();
  let approved = [];
  try {
    const r = await supabase.from("tv_items").select("id,channel,title,kind,src,note,sort,created_at").eq("status", "approved").order("sort").order("created_at");
    approved = r.data || [];
  } catch (e) {}
  return channels.map((c) => ({ ...c, items: c.type === "page" ? [{ title: c.name, kind: "page", src: c.url }] : approved.filter((i) => i.channel === c.id) }));
}
// "2.2", "2-2" or "2" -> { ch: 2, i: 1 }  (i is 0-based)
export function parseTune(s) {
  const m = String(s ?? "").match(/^(\d+)(?:[.-](\d+))?$/);
  return m ? { ch: +m[1], i: m[2] ? Math.max(0, +m[2] - 1) : 0 } : null;
}
export const num = (c, i) => `${c.n}.${i + 1}`;
