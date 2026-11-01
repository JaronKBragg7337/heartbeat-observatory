/* ============================================================================
   seam.js - one world, many real URLs
   ---------------------------------------------------------------------------
   A "seam" is a line in a 3D world where the browser's address changes.
   Walk across it and the URL switches with history.pushState: no reload, no
   flash, the world keeps running. Each zone is a real, linkable page; loading
   its URL directly spawns you in that zone. Back / Forward move you between
   zones the way they move you between pages.

   This file knows nothing about rooms, three.js, players or multiplayer. It
   only answers: "which zone is this point in, and has that changed enough to
   change the URL?" Reuse it for a road between three pages, team spawns, a
   hallway of rooms.

   USAGE
     import { Seam } from "/lab/seam-room/seam.js";   // or window.Seam
     const seam = Seam.define({
       zones: [
         { id: "a", url: "/lab/seam-room/a/", title: "Page A", contains: (x, z) => x < 0 },
         { id: "b", url: "/lab/seam-room/b/", title: "Page B", contains: (x, z) => x >= 0 },
       ],
       hysteresis: 0.3,              // metres you must be past the line before it flips
       fallback: "a",                // zone when the URL matches none
       onEnter(zone, from, info) {}, // info.how = "load" | "walk" | "popstate" | "goto"
     });
     const start = seam.start();     // reads the URL, returns the spawn zone
     // every frame:
     seam.update(player.x, player.z);

   HYSTERESIS: a point only leaves the current zone when it AND every point in
   a ring of radius `hysteresis` around it are outside that zone. So standing
   on the line never flickers, and it works for any zone shape (a predicate),
   not just straight lines.
   ========================================================================== */

const RING = 8; // sample points on the hysteresis ring

function pathOf(url) {
  try { return new URL(url, location.href).pathname; } catch (_) { return String(url); }
}
function samePath(a, b) {
  const norm = (p) => p.replace(/index\.html?$/i, "").replace(/\/+$/, "") || "/";
  return norm(a) === norm(b);
}

export const Seam = {
  version: "0.2.0",

  /** Box test for data zones: { minX, maxX, minZ, maxZ }, a missing side is open. min is inside, max is outside. */
  inBounds(b, x, z) {
    b = b || {};
    return (b.minX == null || x >= b.minX) && (b.maxX == null || x < b.maxX) &&
           (b.minZ == null || z >= b.minZ) && (b.maxZ == null || z < b.maxZ);
  },

  /** Build zones from data (zones.json): each { id, url, title, bounds, spawn }. Returns define()'s cfg minus onEnter. */
  fromData(data) {
    const zones = (data.zones || []).map((z) => Object.assign({}, z, { contains: (x, zz) => Seam.inBounds(z.bounds, x, zz) }));
    return { zones, hysteresis: data.hysteresis == null ? 0.3 : data.hysteresis, fallback: data.fallback || (zones[0] && zones[0].id), doors: data.doors || [] };
  },

  /** Which zone does this pathname belong to? (null if none) */
  zoneForPath(zones, pathname) {
    const p = pathname == null ? location.pathname : pathname;
    return zones.find((z) => samePath(pathOf(z.url), p)) || null;
  },

  define(cfg) {
    const zones = cfg.zones || [];
    const h = cfg.hysteresis == null ? 0.3 : cfg.hysteresis;
    const onEnter = cfg.onEnter || function () {};
    const byId = Object.fromEntries(zones.map((z) => [z.id, z]));
    const ctl = { zones, current: null, history: [] };

    function insideWithMargin(zone, x, z) {
      if (zone.contains(x, z)) return true;
      for (let i = 0; i < RING; i++) {
        const a = (i / RING) * Math.PI * 2;
        if (zone.contains(x + Math.cos(a) * h, z + Math.sin(a) * h)) return true;
      }
      return false;
    }

    function enter(zone, how, x, z, push) {
      const from = ctl.current;
      ctl.current = zone;
      const state = { seam: zone.id, x, z };
      if (push === "push") history.pushState(state, "", zone.url);
      else if (push === "replace") history.replaceState(state, "", zone.url);
      if (zone.title) document.title = zone.title;
      ctl.history.push({ zone: zone.id, from: from ? from.id : null, how, at: Date.now() });
      onEnter(zone, from, { how, x, z, url: zone.url });
    }

    /** Read the URL and pick the spawn zone. Call once at startup. */
    ctl.start = function () {
      const zone = Seam.zoneForPath(zones, location.pathname) || byId[cfg.fallback] || zones[0];
      // replace (not push) so the entry page itself carries seam state for Back
      enter(zone, "load", null, null, "replace");
      return zone;
    };

    /** Feed the walker's position every frame. Returns the current zone. */
    ctl.update = function (x, z) {
      const cur = ctl.current;
      if (cur && insideWithMargin(cur, x, z)) return cur;
      const next = zones.find((zn) => zn !== cur && zn.contains(x, z));
      if (next) enter(next, "walk", x, z, "push");
      return ctl.current;
    };

    /** Jump to a zone in code (a door, a teleporter, a team pick). */
    ctl.goTo = function (id, how) {
      const zone = byId[id];
      if (!zone || zone === ctl.current) return ctl.current;
      enter(zone, how || "goto", null, null, "push");
      return zone;
    };

    ctl.zone = (id) => byId[id] || null;

    function onPop() {
      const zone = Seam.zoneForPath(zones, location.pathname);
      if (!zone || zone === ctl.current) return;
      enter(zone, "popstate", null, null, null); // the browser already moved the URL
    }
    addEventListener("popstate", onPop);
    ctl.destroy = () => removeEventListener("popstate", onPop);

    return ctl;
  },
};

if (typeof window !== "undefined") window.Seam = Seam;
export default Seam;
