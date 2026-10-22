// ============================================================
// /api/render-anything - Vercel serverless function (copied here by hb-render's
// tools/publish-to-site.mjs; the source of truth is hb-render/site/api-render-anything.js).
// Turns a sentence into an hb-render scene with the Claude API (claude-sonnet-5-5).
// The browser then renders the scene itself with WebGPU; this function never renders.
// Needs env vars ANTHROPIC_API_KEY (+ optional ANTHROPIC_WORKSPACE_ID) in the Vercel project.
// Until they are set it answers 503 "scene writer not enabled on the site yet" - putting a
// paid key behind a public URL is Jaron's call. Hard limits: 6 requests per IP per hour,
// 60 per instance per day, 6000 output tokens, prompt <= 600 chars. Every call is logged
// (console -> Vercel logs) with ip hash, prompt, tokens, ms.
// ============================================================
import crypto from 'node:crypto';
import { writeScene } from './_anything-writer.js';
import { catalog } from './_anything-catalog.js';   // written by publish-to-site.mjs (no fs, no import.meta: Vercel transpiles this file)
function loadCatalog() { return catalog; }
const buckets = new Map();
let dayCount = 0, dayStart = Date.now();
function limited(ip) {
  const now = Date.now();
  if (now - dayStart > 86400_000) { dayStart = now; dayCount = 0; }
  const b = buckets.get(ip) || { t: now, n: 0 };
  if (now - b.t > 3600_000) { b.t = now; b.n = 0; }
  b.n++; buckets.set(ip, b);
  return b.n > 6 || dayCount >= 60;
}

// 10/21 (Jaron): every request is kept (prompt + report) so the smart engine can learn and a daily Sonnet job can find
// what people ask for that we can't make yet. Insert-only RPC; failures never block the answer.
async function logRequest(row) {
  try {
    await fetch('https://ygjpnvrwhkrowkrskftk.supabase.co/rest/v1/rpc/render_anything_log', { method: 'POST',
      headers: { apikey: 'sb_publishable_Y-duV64ayMMEvVwMs5PWuw_6kvzbOrN', authorization: 'Bearer sb_publishable_Y-duV64ayMMEvVwMs5PWuw_6kvzbOrN', 'content-type': 'application/json' },
      body: JSON.stringify(row) });
  } catch (e) {}
}

export default async function handler(req, res) {
  res.setHeader('access-control-allow-origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method === 'GET') return res.status(200).json({ ok: true, enabled: !!process.env.ANTHROPIC_API_KEY, model: 'claude-sonnet-5-5' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const apiKey = process.env.ANTHROPIC_API_KEY || '';
  if (!apiKey) return res.status(503).json({ error: 'scene writer not enabled on the site yet (no key on the server). It runs on the MSI; see /render/anything/ notes.' });
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '?').split(',')[0].trim();
  const ipHash = crypto.createHash('sha256').update(ip).digest('hex').slice(0, 10);
  if (limited(ip)) return res.status(429).json({ error: 'limit: 6 scenes per hour per device, 60 per day for everyone' });
  // 10/21: the real cap for the whole site (every server copy) - Supabase counts the last 24 h; Control Room row render_anything_daily_cap
  let allowed = false;
  try {
    const r = await fetch('https://ygjpnvrwhkrowkrskftk.supabase.co/rest/v1/rpc/render_anything_take', { method: 'POST',
      headers: { apikey: 'sb_publishable_Y-duV64ayMMEvVwMs5PWuw_6kvzbOrN', authorization: 'Bearer sb_publishable_Y-duV64ayMMEvVwMs5PWuw_6kvzbOrN', 'content-type': 'application/json' },
      body: JSON.stringify({ p_ip_hash: ipHash }) });
    allowed = r.ok && (await r.json()) === true;
  } catch (e) { allowed = false; }
  if (!allowed) return res.status(429).json({ error: 'the scene writer has made its scenes for today - try again tomorrow' });
  const prompt = String((req.body && req.body.prompt) || '').trim().slice(0, 600);
  if (prompt.length < 3) return res.status(400).json({ error: 'say what to make' });
  const t0 = Date.now();
  try {
    const r = await writeScene({ prompt, apiKey, workspaceId: process.env.ANTHROPIC_WORKSPACE_ID || '', catalog: loadCatalog() });
    dayCount++;
    console.log(JSON.stringify({ route: 'render-anything', ipHash, prompt, ms: Date.now() - t0, objects: r.scene.objects.length, usage: r.usage }));
    await logRequest({ p_ip_hash: ipHash, p_prompt: prompt, p_report: r.scene.report || null, p_objects: r.scene.objects.length, p_model: r.model || '', p_ms: Date.now() - t0, p_error: null });
    return res.status(200).json({ scene: r.scene, report: r.scene.report, usage: r.usage, model: r.model, seconds: (Date.now() - t0) / 1000 });
  } catch (e) {
    console.log(JSON.stringify({ route: 'render-anything', ipHash, prompt, error: e.message }));
    await logRequest({ p_ip_hash: ipHash, p_prompt: prompt, p_report: null, p_objects: 0, p_model: '', p_ms: Date.now() - t0, p_error: e.message });
    return res.status(502).json({ error: e.message });
  }
}
