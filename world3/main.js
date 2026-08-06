/* ============================================================================
   world3/main.js — Ashgrove, wearing the Observatory shell
   ---------------------------------------------------------------------------
   The town under town/ is an unmodified copy of the ashgrove-npc-online repo,
   guards and all (run `node tools/layers.js` from town/ and it still passes).
   Nothing in here edits it. This file is the seam:

     - the shell owns input, identity, character, settings, phone, transport
     - the town owns geometry, physics, NPCs and the simulation
     - peers are drawn by borrowing the town's own draw call

   WHAT IS SHARED TODAY, stated exactly:
   The town is derived from a fixed seed ("ashgrove-001" / townSeed 20260804,
   town/render/main.js), so the 49 founding buildings, the 12 residents, their
   homes, jobs and daily routes are byte-identical for every player already.
   Live players see each other move in real time. What is NOT yet shared is
   GROWTH -- buildings raised after founding, and the day counter -- which
   still lives in each browser's localStorage. public.world3_world exists to
   hold it; wiring the storage adapter to it is the next step, and until that
   lands two players who have been away different lengths of time can see a
   different number of houses.
   ========================================================================== */
(function () {
"use strict";

const T = window.TOWN;
if (!T) { console.warn("world3: the town did not load"); return; }

/* ------------------------------------------------------------------------ *
   1. The town's own touch layer must not fight the shell's.
   town/render/player.js binds touchstart/touchmove on window for a FIXED
   stick; the shell uses pointer events for a floating one. Both would write
   Player.move from the same finger. Rather than fork the town copy, swallow
   the touch events before its listeners see them -- capture runs first.
 * ------------------------------------------------------------------------ */
const swallow = (e) => { e.stopImmediatePropagation(); };
for (const type of ["touchstart", "touchmove", "touchend", "touchcancel"]) {
  addEventListener(type, swallow, { capture: true });
}

/* ------------------------------------------------------------------------ *
   2. Peer avatars. town/render/npcs.js receives the renderer's private
   drawMesh and setModel as ARGUMENTS (N.draw(drawMesh, setModelLike, ...)),
   so wrapping that one function gets peers drawn by the same pipeline as the
   NPCs -- same shader, same frustum, same material system. No fork needed.
 * ------------------------------------------------------------------------ */
const peers = new Map();          // id -> { meshes, x, y, z, yaw, name, ... }
let latestPeers = [];

const HIP = 0.74;
function buildAvatar(appearance) {
  const a = appearance || {};
  const fab = T.Mats.fabric, paint = T.Mats.paint;
  const shirt = hex(a.shirt || "#4fa3ff"), skin = hex(a.skin || "#e0b48c");
  const hair = hex(a.hair || "#5a3a22"), pants = hex(a.pants || "#3a4654");
  const w = a.build === "broad" ? 1.12 : a.build === "slim" ? 0.9 : 1;

  /* Same box grammar and the same +Z facing as the town's own people
     (town/render/npcs.js) -- the hair plate sits at negative z so the face
     points along travel. */
  const body = new T.Builder();
  body.box(-0.20 * w, 0.82, -0.12, 0.40 * w, 0.54, 0.24, fab, { tint: shirt });
  body.box(-0.30 * w, 0.86, -0.07, 0.10, 0.46, 0.14, fab, { tint: shirt });
  body.box( 0.20 * w, 0.86, -0.07, 0.10, 0.46, 0.14, fab, { tint: shirt });
  body.box(-0.115, 1.38, -0.105, 0.23, 0.25, 0.21, paint, { tint: skin });
  body.box(-0.125, 1.60, -0.115, 0.25, 0.08, 0.23, paint, { tint: hair });
  body.box(-0.125, 1.44, -0.115, 0.25, 0.18, 0.03, paint, { tint: hair });

  const legL = new T.Builder();
  legL.box(-0.19 * w, -HIP, -0.09, 0.16, HIP, 0.18, fab, { tint: pants });
  const legR = new T.Builder();
  legR.box(0.03 * w, -HIP, -0.09, 0.16, HIP, 0.18, fab, { tint: pants });

  return { body: body.build(), legL: legL.build(), legR: legR.build() };
}

function hex(s) {
  const n = parseInt(String(s).replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function syncPeerMeshes(list) {
  const live = new Set();
  for (const p of list) {
    live.add(p.id);
    let e = peers.get(p.id);
    const look = JSON.stringify(p.appearance || {});
    if (!e || e.look !== look) {
      if (e) freeAvatar(e);
      e = Object.assign({ look, phase: 0, amp: 0, px: p.x, pz: p.z }, buildAvatar(p.appearance));
      peers.set(p.id, e);
    }
    const moved = Math.hypot(p.x - e.px, p.z - e.pz);
    e.phase += moved * 2.6;
    e.amp += ((moved > 0.004 ? 1 : 0) - e.amp) * 0.18;
    e.px = p.x; e.pz = p.z;
    e.x = p.x; e.y = p.y; e.z = p.z; e.yaw = p.yaw; e.name = p.name;
  }
  for (const [id, e] of peers) if (!live.has(id)) { freeAvatar(e); peers.delete(id); }
}

function freeAvatar(e) {
  for (const k of ["body", "legL", "legR"]) if (e[k] && e[k].free) e[k].free();
}

const mBody = new Float32Array(16), mPart = new Float32Array(16);
function setM(m, x, y, z, yaw, fallback) { return fallback(m, x, y, z, yaw); }

const originalDraw = T.Npcs && T.Npcs.draw;
if (T.Npcs) {
  T.Npcs.draw = function (drawMesh, setModelLike, planes, ex, ez) {
    if (originalDraw) originalDraw.call(T.Npcs, drawMesh, setModelLike, planes, ex, ez);
    syncPeerMeshes(latestPeers);
    for (const e of peers.values()) {
      if (e.x === undefined) continue;
      /* the town's floor, so a peer stands on porches and steps like the
         local player does rather than sinking to terrain height */
      const gy = T.Player.floorAt(e.x, e.z, 1e5);
      const bob = Math.sin(e.phase * 2) * 0.02 * e.amp;
      drawMesh(e.body, setM(mBody, e.x, gy + bob, e.z, e.yaw, setModelLike), false);
      const sw = Math.sin(e.phase) * 0.09 * e.amp;
      const fx = Math.sin(e.yaw) * sw, fz = Math.cos(e.yaw) * sw;
      drawMesh(e.legL, setM(mPart, e.x + fx, gy + HIP, e.z + fz, e.yaw, setModelLike), false);
      drawMesh(e.legR, setM(mPart, e.x - fx, gy + HIP, e.z - fz, e.yaw, setModelLike), false);
    }
  };
}

/* ------------------------------------------------------------------------ *
   3. Mount the shell and wire it to the town.
 * ------------------------------------------------------------------------ */
const shell = window.HBShell.mount({
  world: "world3",
  worldLabel: "Ashgrove",
  gateUrl: "/world3/gate/",

  getState() {
    const P = T.Player;
    if (!P || !P.pos) return null;
    return {
      x: P.pos[0], y: P.pos[1], z: P.pos[2],
      yaw: P.yaw, pitch: P.pitch,
      stance: P.sprint ? "run" : "stand",
      place: placeName(),
    };
  },

  onPeers(list) {
    latestPeers = list;
  },

  onMove({ x, y }) {
    const P = T.Player;
    if (!P) return;
    P.move[0] = x;
    P.move[1] = -y;
    P.sprint = Math.hypot(x, y) > 0.92;
  },

  onLook(dx, dy) {
    const P = T.Player, S = T.Settings || {};
    if (!P) return;
    const k = 0.0060 * (shell.settings.sensitivity || S.sens || 1);
    const inv = shell.settings.invertY ? -1 : 1;
    P.yaw -= dx * k;
    P.pitch = T.clamp(P.pitch - dy * k * inv, -1.52, 1.52);
  },

  onAction(name) {
    const P = T.Player;
    if (!P) return;
    if (name === "use") {
      /* One offer at a time, in this order: the door under your hand, then
         whatever the building you are standing in leads to, then the person
         you are facing. */
      if (P.nearDoor) P.useDoor();
      else if (T.Destinations && T.Destinations.use(shell)) { /* handled */ }
      else if (T.Npcs && T.Npcs.promptAction) T.Npcs.interact();
      else P.useDoor();
    } else if (name === "jump") {
      P.keys.Space = true;
      setTimeout(() => { P.keys.Space = false; }, 90);
    } else if (name === "duck-down") {
      P.keys.ShiftLeft = true;
    } else if (name === "duck-up") {
      P.keys.ShiftLeft = false;
    }
  },

  onSettings(s) {
    document.body.classList.toggle("dev", !!s.dev);
    if (T.Settings) {
      T.Settings.sens = s.sensitivity;
      T.Settings.invertY = s.invertY;
    }
  },
});

/* ------------------------------------------------------------------------ *
   3b. Doors are shared.
   Jaron and Lillith found this together: she opened a door and he did not see
   it move. Door state lived entirely in each browser, so two people standing
   in one hallway saw different houses. Every door already carries a stable
   unique id (B01-L0-D02 and friends, 325 of them), so the id is all that has
   to travel.

   Deliberately NOT persisted. A door is the most ephemeral thing in the town
   and writing 325 rows to keep it would buy nothing; a late arrival instead
   asks whoever is already here what is currently open. If nobody is here,
   there is nobody to disagree with.
 * ------------------------------------------------------------------------ */
const W = T.World;

/* The town boots asynchronously, so W.doors is still empty when this file
   runs — an index built here would be permanently blank. It is also rebuilt
   whenever the town regrows. So the index is lazy and re-derived whenever the
   door count changes. */
let doorsById = null, doorIndexSize = -1;
function doorIndex() {
  if (doorIndexSize !== W.doors.length) {
    doorsById = new Map();
    for (const d of W.doors) doorsById.set(d.id, d);
    doorIndexSize = W.doors.length;
  }
  return doorsById;
}

function setDoor(id, open) {
  const d = doorIndex().get(id);
  if (!d) return false;
  d.target = open ? 1 : 0;      // animateDoors eases it and flips the collider
  return true;
}

/* our own toggles go out */
const originalUseDoor = T.Player.useDoor;
T.Player.useDoor = function () {
  const d = T.Player.nearDoor;
  const handled = originalUseDoor.call(T.Player);
  if (handled && d) shell.send("door", { door: d.id, open: d.target > 0.5 });
  return handled;
};

shell.on("door", (msg) => setDoor(msg.door, msg.open));

/* a late arrival asks the room what is already open */
shell.on("door-sync-request", () => {
  const open = [];
  for (const d of W.doors) if (d.target > 0.5) open.push(d.id);
  shell.send("door-sync", { open });
});

let doorSyncApplied = false;
shell.on("door-sync", (msg) => {
  if (doorSyncApplied || !Array.isArray(msg.open)) return;
  /* Only count it as applied once a door actually moved. The answer can beat
     the town: the socket is up in a second or two while Town.build takes two
     to four, so an early reply would otherwise be marked handled and thrown
     away against an empty world — the late arrival would stand in a hallway
     seeing closed doors everyone else sees open. */
  let applied = 0;
  for (const id of msg.open) if (setDoor(id, true)) applied++;
  if (applied > 0 || msg.open.length === 0) doorSyncApplied = true;
});

/* Ask only when we can both send AND receive usefully — socket up and the
   town actually built. */
(function askForDoors(tries) {
  if (tries <= 0 || doorSyncApplied) return;
  const ready = W.doors.length > 0 && shell.send("door-sync-request", {});
  setTimeout(() => askForDoors(tries - 1), ready ? 1500 : 700);
})(20);

/* ------------------------------------------------------------------------ *
   4. The shell's chips and prompt, fed from the town every frame.
 * ------------------------------------------------------------------------ */
function placeName() {
  const P = T.Player;
  if (!P) return "Ashgrove";
  if (P.building && P.building.id) return P.building.id;
  return "Ashgrove";
}

let last = performance.now();
function pump(now) {
  requestAnimationFrame(pump);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;

  shell.frame(dt);
  shell.setPlace(placeName());

  /* one offer at a time, same precedence the action key uses */
  const P = T.Player;
  let text = null;
  if (P && P.nearDoor) text = "Open the door";
  else {
    const dest = T.Destinations && T.Destinations.here();
    if (dest) text = dest.verb;
    else if (T.Npcs && T.Npcs.prompt) text = String(T.Npcs.prompt).replace(/<[^>]*>/g, "");
  }
  shell.setPrompt(text);
}
requestAnimationFrame(pump);

/* ------------------------------------------------------------------------ *
   5. Announce the shared town row, so the seed and the day this browser is
   on are visible to everyone -- the read half of world3_world. Founding is
   idempotent; a second player's call returns the existing row untouched.
 * ------------------------------------------------------------------------ */
async function announceTown() {
  if (!shell.supa || !shell.session) return;
  try {
    const { data } = await shell.supa.from("world3_world").select("day,digest,seed").eq("id", "main").maybeSingle();
    if (!data) {
      await shell.supa.rpc("world3_found", {
        p_seed: "ashgrove-001", p_town_seed: "20260804",
        p_founding: [], p_sim_snapshot: null, p_digest: "",
      });
    }
  } catch (_) {
    /* The write-path functions may not be applied yet (see
       supabase/world3-shared-town-v0.sql). The world is fully playable
       without them; only cross-player growth sync waits on it. */
  }
}
setTimeout(() => void announceTown(), 4000);

/* Diagnostics. Peers live in a closure so nothing can accidentally mutate
   them; this is a read-only window for the console and for tests. */
window.__world3 = {
  get peers() {
    return [...peers.entries()].map(([id, e]) => ({
      id, name: e.name,
      at: e.x === undefined ? null : [+e.x.toFixed(1), +e.z.toFixed(1)],
      floor: e.x === undefined ? null : +T.Player.floorAt(e.x, e.z, 1e5).toFixed(2),
      hasMesh: !!(e.body && e.legL && e.legR),
      striding: +e.amp.toFixed(2),
    }));
  },
  get incoming() { return latestPeers.length; },
};

console.log("%cWORLD3", "color:#8fd0ff;font-weight:bold",
  "Ashgrove mounted on the Observatory shell — town/ is an unmodified copy");
})();
