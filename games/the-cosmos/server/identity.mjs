// ============================================================================
// server/identity.mjs - who a connecting browser is, checked on the server.
//
// OWNS: turning a Supabase Auth access token into { userId, email, admin } (never trusting an id the browser sends), and the rules for
//       which players are throwaway. The authority (authority.mjs) holds the players; this file holds no state except a short token cache.
// DOES NOT OWN: the login itself (the site's hb-supabase.js / admin sign-in) or the world.
//
// A token is checked by asking Supabase Auth who it belongs to (GET /auth/v1/user), and whether that account is a site admin by calling the
// site's own is_admin() RPC with the user's token. Tokens are never logged or stored; the cache holds only the answer for five minutes.
// ============================================================================

export const DEFAULT_NAME = /^(Test )?[Vv]isitor \d{1,4}$/;
export const GUEST_IDLE_MS = 24 * 3600 * 1000;       // a guest's ship leaves its pad after this long idle
export const EPHEMERAL_IDLE_MS = 2 * 60 * 1000;      // a test client's player is removed this long after it disconnects
export const MAX_SLOTS = 12;
export const INITIAL_MARKS = 10000;

export function tokenVerifier({ url, key, fetchFn = fetch, ttl = 5 * 60 * 1000, now = Date.now, timeout = 4000 } = {}) {
  if (!url || !key) return null;
  const base = url.replace(/\/$/, ''), cache = new Map();
  const call = (path, token, init = {}) => fetchFn(base + path, { ...init, headers: { apikey: key, Authorization: 'Bearer ' + token, 'content-type': 'application/json' }, signal: AbortSignal.timeout(timeout) });
  return async function verify(token) {
    if (typeof token !== 'string' || token.length < 20 || token.length > 4096) return null;
    const hit = cache.get(token);
    if (hit && hit.until > now()) return hit.value;
    let value = null;
    try {
      const r = await call('/auth/v1/user', token);
      if (r.ok) {
        const u = await r.json();
        if (typeof u?.id === 'string' && /^[0-9a-f-]{36}$/i.test(u.id)) {
          let admin = false;
          try { const a = await call('/rest/v1/rpc/is_admin', token, { method: 'POST', body: '{}' }); admin = a.ok && (await a.json()) === true; } catch { admin = false; }
          value = { userId: u.id, email: typeof u.email === 'string' ? u.email.slice(0, 120) : '', admin };
        }
      }
    } catch { value = null; }
    // A failed lookup is not cached for long: the network may be back in a moment.
    cache.set(token, { value, until: now() + (value ? ttl : 15000) });
    if (cache.size > 200) for (const k of cache.keys()) { cache.delete(k); if (cache.size <= 100) break; }
    return value;
  };
}

/** Marks that a person, not a script, made this player: a chosen look, a typed name, real progress. When unsure the sweep keeps them. */
export function humanMarkers(player, ship) {
  const why = [];
  if (player.userId) why.push('account');
  if (player.personId && player.personId !== 'isaiah') why.push('chosen look');
  if (player.name && !DEFAULT_NAME.test(player.name)) why.push('typed name');
  if (ship) {
    if ((ship.economy?.marks ?? INITIAL_MARKS) !== INITIAL_MARKS) why.push('spent or earned marks');
    if ((ship.crew || []).length) why.push('hired crew');
    if (Object.keys(ship.hold || {}).some((k) => ship.hold[k] > 0)) why.push('cargo');
    if (ship.jobs?.taken?.length || ship.jobs?.salvaged) why.push('jobs');
    if (ship.trip || (ship.frameId && ship.frameId !== 'mars')) why.push('away from Mars');
  }
  return why;
}
