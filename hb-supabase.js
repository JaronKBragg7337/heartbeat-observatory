/**
 * The one Supabase client for Heartbeat Observatory.
 *
 * Before this file the project URL and publishable key were pasted into 27
 * separate files, each calling `createClient` itself. That meant a key rotation
 * was a 27-file edit, a page that loaded two modules got two auth clients
 * fighting over the same storage, and every new game arrived with its own copy.
 *
 * Everything now comes from here:
 *
 *     import { getSupabase, getIdentity } from '/hb-supabase.js';
 *     const supabase = await getSupabase();
 *
 * One client per page, created on first ask. The client is stashed on `window`
 * rather than in module scope, so a page that loads this file twice under two
 * different paths still ends up with a single client and a single auth session.
 *
 * Non-module callers get the same thing at `window.HBSupabase`.
 */

export const SUPABASE_URL = "https://ygjpnvrwhkrowkrskftk.supabase.co";

/**
 * Publishable, not secret. It identifies the project to the browser and grants
 * nothing on its own; every table is behind row level security, which is what
 * actually decides who may read and write. Keeping it in source is deliberate.
 */
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Y-duV64ayMMEvVwMs5PWuw_6kvzbOrN";

/**
 * Realtime budget, matching what the worlds already asked for individually:
 * 24 messages a second is above the 10 Hz the shell sends at, with headroom for
 * presence and chat on the same socket.
 */
const REALTIME_EVENTS_PER_SECOND = 24;

/**
 * esm.sh serves most of the site today; jsdelivr serves the engine. Try the
 * common one, fall back to the other, so one CDN having a bad day costs a
 * round trip instead of the multiplayer layer.
 */
const CDN_SOURCES = [
  "https://esm.sh/@supabase/supabase-js@2",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm"
];

/** Survives a second copy of this module loading under a different path. */
const GLOBAL_KEY = "__hbSupabase";

/** The id a player carries before they ever sign in. Already in use — do not rename. */
const DEVICE_ID_KEY = "hb_guest_id";
const SESSION_ID_KEY = "hb_session_id";

function globals() {
  const scope = typeof window !== "undefined" ? window : globalThis;
  if (!scope[GLOBAL_KEY]) scope[GLOBAL_KEY] = { client: null, pending: null, identity: null };
  return scope[GLOBAL_KEY];
}

async function loadCreateClient() {
  let lastError = null;
  for (const source of CDN_SOURCES) {
    try {
      const mod = await import(/* @vite-ignore */ source);
      if (typeof mod.createClient === "function") return mod.createClient;
      lastError = new Error(`${source} exported no createClient`);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error("supabase-js could not be loaded");
}

/**
 * The shared client. Await it; the first caller pays for the CDN fetch and
 * everyone after that gets the same instance without a second network hit.
 */
export async function getSupabase() {
  const g = globals();
  if (g.client) return g.client;
  if (g.pending) return g.pending;

  g.pending = (async () => {
    const createClient = await loadCreateClient();
    g.client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      realtime: { params: { eventsPerSecond: REALTIME_EVENTS_PER_SECOND } }
    });
    return g.client;
  })();

  try {
    return await g.pending;
  } catch (err) {
    // A failed load must not poison later attempts; the network may come back.
    g.pending = null;
    throw err;
  }
}

/** The client if it already exists, else null. For code that must not await. */
export function peekSupabase() {
  return globals().client;
}

function randomId(length) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(length);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = "";
  for (let i = 0; i < length; i++) out += chars[bytes[i] % chars.length];
  return out;
}

function readStore(store, key) {
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}

function writeStore(store, key, value) {
  try {
    store.setItem(key, value);
  } catch {
    // Private browsing refuses storage. The id still works for this page.
  }
}

/**
 * Who this browser is, across visits. Stable until site data is cleared, and
 * shared by every world on the domain so a guest keeps one name everywhere.
 */
export function getDeviceId() {
  if (typeof localStorage === "undefined") return "guest:" + randomId(14);
  let id = readStore(localStorage, DEVICE_ID_KEY);
  if (!id) {
    id = "guest:" + randomId(14);
    writeStore(localStorage, DEVICE_ID_KEY, id);
  }
  return id;
}

/**
 * Who this tab is, for this sitting. Two tabs of the same world are two
 * presences, and closing the tab ends it — that is what presence should mean.
 */
export function getSessionId() {
  if (typeof sessionStorage === "undefined") return "s_" + randomId(12);
  let id = readStore(sessionStorage, SESSION_ID_KEY);
  if (!id) {
    id = "s_" + randomId(12);
    writeStore(sessionStorage, SESSION_ID_KEY, id);
  }
  return id;
}

/** Strips anything that would break out of a label. Returns null if nothing is left. */
export function sanitizeName(raw) {
  const clean = String(raw || "").replace(/[<>&"']/g, "").trim().slice(0, 24);
  return clean || null;
}

function defaultName(id, prefix) {
  const tail = String(id).replace(/[^a-z0-9]/gi, "").slice(-4).toUpperCase() || "0000";
  return `${prefix} ${tail}`;
}

function readAppearance(raw) {
  if (!raw || typeof raw !== "object") return null;
  const color = typeof raw.color === "string" && /^#[0-9a-f]{6}$/i.test(raw.color) ? raw.color : null;
  return color ? { color } : null;
}

/**
 * Who is playing.
 *
 * A signed-in player is their Heartbeat account, with the display name and
 * appearance they set in `world_characters`. Everyone else is their device, and
 * that is a real identity too — it persists, it can own a save, and it upgrades
 * to an account later without changing what the world calls them mid-session.
 *
 * Never throws. A world that cannot reach the network still gets an identity
 * and stays playable; `kind` says which one you got.
 *
 * @param {{ prefix?: string, refresh?: boolean }} [options]
 *   `prefix` names guests for this world ("Pilot", "Survivor", "Manager").
 *   `refresh` re-reads the account instead of using the cached answer.
 */
export async function getIdentity(options = {}) {
  const { prefix = "Guest", refresh = false } = options;
  const g = globals();
  if (g.identity && !refresh) return g.identity;

  const deviceId = getDeviceId();
  const sessionId = getSessionId();
  const identity = {
    id: deviceId,
    kind: "device",
    deviceId,
    sessionId,
    name: defaultName(deviceId, prefix),
    appearance: null
  };

  try {
    const supabase = await getSupabase();
    const { data } = await supabase.auth.getSession();
    const user = data?.session?.user;
    if (user?.id) {
      identity.id = user.id;
      identity.kind = "account";
      const { data: character } = await supabase
        .from("world_characters")
        .select("display_name, appearance")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      identity.name =
        sanitizeName(character?.display_name) ||
        sanitizeName(user.email) ||
        defaultName(user.id, prefix);
      identity.appearance = readAppearance(character?.appearance);
    }
  } catch {
    // Offline, signed out, or the profile row does not exist yet. The device
    // identity above already stands on its own.
  }

  g.identity = identity;
  return identity;
}

/** Forgets the cached identity, so the next `getIdentity` re-reads the account. */
export function clearIdentityCache() {
  globals().identity = null;
}

if (typeof window !== "undefined") {
  window.HBSupabase = {
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    getSupabase,
    peekSupabase,
    getIdentity,
    clearIdentityCache,
    getDeviceId,
    getSessionId,
    sanitizeName
  };
}
