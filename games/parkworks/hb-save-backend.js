/**
 * Heartbeat Observatory's park store, handed to Parkworks Tycoon.
 *
 * The game holds no key and imports no Supabase. It asks the page for somewhere
 * to keep a park by calling `window.HeartbeatObservatory.createSaveBackend`,
 * and falls back to this browser when nobody answers. This file is the answer,
 * and it exists only on the Heartbeat copy of the game — the standalone build
 * on GitHub Pages runs the same source with no cloud at all.
 *
 * This must be a classic script placed BEFORE the game's module script. Classic
 * scripts run immediately and module scripts are deferred, so the hook is on
 * `window` well before the game looks for it.
 *
 * How a park is kept:
 *
 *   - Every save writes this browser first. That is instant, works offline, and
 *     means a dropped connection never costs a park.
 *   - When the player is signed in to Heartbeat, the same text is pushed to
 *     `public.parkworks_saves`, debounced, and flushed when the page is hidden.
 *   - On load, a cloud park wins if there is one, because the point of an
 *     account is that the park follows you between a phone and a desktop.
 *
 * The local key is the same one the standalone game uses, so someone who played
 * signed out and then signed in keeps the park they already built.
 */
(function () {
  "use strict";

  const LOCAL_KEY = "parkworks-tycoon.save.v1";
  const TABLE = "parkworks_saves";

  /** Autosave runs every 20s; this coalesces bursts without ever losing the last write. */
  const CLOUD_DEBOUNCE_MS = 6000;

  function readLocal() {
    try {
      return window.localStorage.getItem(LOCAL_KEY);
    } catch {
      return null;
    }
  }

  function writeLocal(text) {
    try {
      window.localStorage.setItem(LOCAL_KEY, text);
    } catch {
      // Storage refused (private browsing, quota). The cloud copy still stands.
    }
  }

  function clearLocal() {
    try {
      window.localStorage.removeItem(LOCAL_KEY);
    } catch {
      // Nothing to clear.
    }
  }

  function deviceLabel() {
    const touch = matchMedia("(pointer: coarse)").matches;
    return `${touch ? "phone" : "desktop"} ${screen.width}x${screen.height}`.slice(0, 64);
  }

  class HeartbeatParkStore {
    constructor() {
      this.name = "heartbeat";
      // Corrected during load() once we know whether anyone is signed in. The
      // game reads this only after load() resolves, to caption the resume card.
      this.label = "this device";
      this.supabase = null;
      this.ownerId = null;
      this.pendingText = null;
      this.flushTimer = 0;
      this.flushing = false;

      // A park left mid-flush when the tab is hidden would be a park lost.
      this.flushNow = this.flushNow.bind(this);
      window.addEventListener("pagehide", this.flushNow);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") this.flushNow();
      });
    }

    /**
     * Resolves the signed-in owner once. Returns null when the player is a
     * guest, offline, or the identity layer failed — every one of which means
     * "keep the park in this browser" rather than "fail".
     */
    async connect() {
      if (this.ownerId !== null) return this.ownerId || null;
      try {
        const { getSupabase, getIdentity } = await import("/hb-supabase.js");
        const identity = await getIdentity({ prefix: "Manager" });
        if (identity.kind !== "account") {
          this.ownerId = "";
          return null;
        }
        this.supabase = await getSupabase();
        this.ownerId = identity.id;
        this.label = "your Heartbeat account";
        return this.ownerId;
      } catch {
        this.ownerId = "";
        return null;
      }
    }

    async load() {
      const owner = await this.connect();
      const local = readLocal();
      if (!owner) return local;

      try {
        const { data, error } = await this.supabase
          .from(TABLE)
          .select("save")
          .eq("owner_id", owner)
          .maybeSingle();
        if (error) throw error;
        if (data && typeof data.save === "string" && data.save) {
          // Keep the browser mirror in step so a later offline session opens
          // the same park the account has.
          writeLocal(data.save);
          return data.save;
        }
      } catch (err) {
        console.info("[parkworks] cloud load failed, using this device", err);
      }
      return local;
    }

    async save(text) {
      writeLocal(text);
      const owner = await this.connect();
      if (!owner) return;
      this.pendingText = text;
      if (this.flushTimer) return;
      this.flushTimer = setTimeout(() => {
        this.flushTimer = 0;
        this.flushNow();
      }, CLOUD_DEBOUNCE_MS);
    }

    flushNow() {
      if (this.flushTimer) {
        clearTimeout(this.flushTimer);
        this.flushTimer = 0;
      }
      if (!this.supabase || !this.ownerId || this.pendingText === null || this.flushing) return;
      const text = this.pendingText;
      this.pendingText = null;
      this.flushing = true;
      this.supabase
        .from(TABLE)
        .upsert(
          { owner_id: this.ownerId, save: text, device_label: deviceLabel() },
          { onConflict: "owner_id" },
        )
        .then(({ error }) => {
          // Put the text back so the next flush retries it rather than dropping
          // a park on one bad request.
          if (error) {
            console.info("[parkworks] cloud save failed, will retry", error);
            if (this.pendingText === null) this.pendingText = text;
          }
        })
        .catch((err) => {
          console.info("[parkworks] cloud save failed, will retry", err);
          if (this.pendingText === null) this.pendingText = text;
        })
        .finally(() => {
          this.flushing = false;
        });
    }

    async clear() {
      this.pendingText = null;
      if (this.flushTimer) {
        clearTimeout(this.flushTimer);
        this.flushTimer = 0;
      }
      clearLocal();
      const owner = await this.connect();
      if (!owner) return;
      try {
        await this.supabase.from(TABLE).delete().eq("owner_id", owner);
      } catch (err) {
        console.info("[parkworks] cloud clear failed", err);
      }
    }
  }

  const host = (window.HeartbeatObservatory = window.HeartbeatObservatory || {});
  const previous = host.createSaveBackend;

  host.createSaveBackend = function (gameId) {
    if (gameId === "parkworks-tycoon") return new HeartbeatParkStore();
    return typeof previous === "function" ? previous(gameId) : null;
  };
})();
