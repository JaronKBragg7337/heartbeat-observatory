/* ============================================================================
   npcs.js — visible people and pets: the sim's daily itineraries, drawn
   ---------------------------------------------------------------------------
   Principle: the renderer OWNS nothing about who these people are. Names,
   ages, homes, seats and the day's legs all live in the ASH sim as plain
   data (sim/ambient.js, sim/pets.js); this file only restores that data,
   asks it "where is everyone right now" once per frame, and draws boxy
   toy-people where the answer says. One mesh set per NPC at init, pose
   computed fresh per frame — no per-frame allocation, no geometry churn.

   DELIBERATE: NPCs and pets are GHOSTS. They carry no colliders and never
   block the player — you can walk straight through someone. Physical
   interaction is deliberately absent; the interaction surface is the
   prompt (talk / take seat / work / quit), not the body.

   Leg animation: the engine's setModel is yaw-only, and a true hip-swing
   matrix buys little at this scale. Legs are separate meshes whose origin
   is the hip; while walking they SLIDE fore/aft along the facing direction
   (±0.09 m, alternating, amplitude eased in and out) while the body bobs.
   Chosen over a custom rotation matrix and commented here, as promised.
   ========================================================================== */
(function () {
"use strict";
const T = window.TOWN;
const M = () => T.Mats;

const N = (T.Npcs = {
  on: false,                 // init succeeded; update/draw/interact no-op otherwise
  target: null,              // person id currently in talk range, or null
  prompt: null,              // #prompt innerHTML when an NPC action is offered
  promptAction: null,        // "talk" | "seat" | "work"
  promptBiz: null,           // business id for "seat"/"work"
  townMin: null,             // minutes into the visible town day (for the HUD clock)
});

const HIP = 0.84;            // leg-mesh origin height, unscaled adult metres
const CULL_DIST = 90;        // beyond this nobody is drawn
const TALK_DIST = 2.6, TALK_COS = 0.82;      // ~35° facing cone
const WORK_DIST = 4.5;       // how close to the yard door the job prompt lives
/* Sessions open at 07:45 town time, not midnight. The visible clock counts
   from sessionStart (D11), so an un-offset start puts every NPC indoors
   asleep for the first ~8 real minutes — the "empty town, only pets" bug.
   Offsetting sessionStart keeps townMinutes' formula untouched. */
const DAY_START_MIN = 465;

/* MULTIPLAYER FIX (2026-08-06). sessionStart used to be
   `performance.now() - DAY_START_MIN * 1000`, which anchors the visible town
   day to THIS BROWSER'S page load. Two players who loaded ten real minutes
   apart were ten town-hours apart: they saw the same residents standing in
   different places, and each thought the other's town was wrong. Found by
   Jaron and Lillith walking the world together.

   The visible clock is now anchored to an absolute instant every client
   shares, so the town has ONE time of day. A player joining at any moment
   drops into the day already in progress rather than restarting it. The
   town-day length is unchanged (1 real second = 1 town minute, so a town day
   is 24 real minutes), and townMinutes' formula is still untouched. */
const TOWN_EPOCH_MS = Date.UTC(2026, 7, 6, 0, 0, 0);   // 2026-08-06T00:00Z

/* The town keeps a REAL 24-hour day: one town minute is one real minute, so
   its clock agrees with a wall clock. TOWN_UTC_OFFSET_HOURS is the town's own
   timezone — every client applies the same offset, so the town has one time
   of day worldwide rather than each player's local one. -5 puts Ashgrove's
   noon at US Eastern noon.

   DAY_START_MIN no longer shifts the clock: with a real day there is nothing
   to skip past, and offsetting it would only make the town's clock lie. */
const TOWN_UTC_OFFSET_HOURS = -5;

/* Town minutes elapsed since the shared epoch — the same number on every
   client at the same instant, and the basis for both the clock and the day. */
function sharedTotalMinutes(wallNowMs) {
  const minutes = (wallNowMs - TOWN_EPOCH_MS) / 60000 + TOWN_UTC_OFFSET_HOURS * 60;
  return Math.max(0, minutes);
}

/* module state — restored sim, the day's plans, and the drawn population */
let sim = null, doc = null, store = null, worldView = null;
let sessionStart = 0, curDay = -1, plans = null;
const npcs = [], pets = [];

/* scratch model matrices + cull box (no per-frame allocation) */
const mBody = T.m4.create(), mPart = T.m4.create(), cullBox = new Float32Array(6);

/* ------------------------------------------------------------- palettes -- */
/* deterministic look per person, keyed off the identity hash (D6 replay) */
const SKIN  = [[.87,.68,.54],[.72,.52,.38],[.58,.42,.30],[.93,.76,.62],[.66,.48,.34]];
const HAIR  = [[.22,.16,.12],[.42,.30,.18],[.62,.52,.36],[.75,.72,.68],[.28,.24,.22],[.52,.34,.24]];
const SHIRT = [[.62,.24,.20],[.24,.36,.56],[.30,.50,.34],[.76,.62,.28],[.52,.34,.52],[.32,.44,.44],[.80,.78,.72]];
const PANTS = [[.24,.26,.30],[.34,.30,.26],[.30,.34,.42],[.42,.38,.32]];

const SCALE_BY_STAGE = { child: 0.62, adolescent: 0.85, youngAdult: 1, adult: 1 };

/* friendly one-liners; the pick is keyed to (person, town day) so a bark
   repeats within a day and rotates across days */
const CHATTER = [
  "Fine day for it.",
  "The kerbs here are kind to tired feet.",
  "You can cross the whole town before lunch.",
  "The park loop is the best part of my day.",
  "New faces are rare around here. Welcome.",
  "The school bell carries right across town.",
  "I wave at the lamp posts. Force of habit.",
  "Mind the crossing — cars nap here too.",
];

/* ------------------------------------------------------- matrix helper --- */
/* setModel's column-major yaw+translate convention, extended with a uniform
   scale (children/pets). When the scale is 1 the passed setModel-like is
   used verbatim — same numbers, one code path honoured. */
function setM(m, x, y, z, yaw, s, fallback) {
  if (s === 1) return fallback(m, x, y, z, yaw);
  const c = Math.cos(yaw) * s, sn = Math.sin(yaw) * s;
  m[0] = c;  m[1] = 0; m[2] = -sn; m[3] = 0;
  m[4] = 0;  m[5] = s; m[6] = 0;   m[7] = 0;
  m[8] = sn; m[9] = 0; m[10] = c;  m[11] = 0;
  m[12] = x; m[13] = y; m[14] = z; m[15] = 1;
  return m;
}

/* ------------------------------------------------------------ meshmaking - */
/* One toy person: body (torso+arms+head+hair, 6 boxes) plus a mesh per leg
   (1 box each, origin at the hip). 8 boxes = 96 tris, hard edges — the
   town's boxy style, and comfortably under the 120-tri budget. Built at
   adult size facing +z (the facing convention of ASH.pathPointAt's yaw);
   children/adolescents shrink through the model matrix. */
function buildPersonMeshes(person) {
  const h = ASH.hashSeed(person.id);
  const skin = SKIN[h % SKIN.length];
  const hair = HAIR[(h >>> 3) % HAIR.length];
  const shirt = SHIRT[(h >>> 7) % SHIRT.length];
  const pants = PANTS[(h >>> 11) % PANTS.length];
  const fab = M().fabric, paint = M().paint;

  const body = new T.Builder();
  body.box(-0.20, 0.82, -0.12, 0.40, 0.54, 0.24, fab, { tint: shirt });    // torso
  body.box(-0.30, 0.86, -0.07, 0.10, 0.46, 0.14, fab, { tint: shirt });    // arm L
  body.box( 0.20, 0.86, -0.07, 0.10, 0.46, 0.14, fab, { tint: shirt });    // arm R
  body.box(-0.115, 1.38, -0.105, 0.23, 0.25, 0.21, paint, { tint: skin }); // head
  body.box(-0.125, 1.60, -0.115, 0.25, 0.08, 0.23, paint, { tint: hair }); // hair cap
  body.box(-0.125, 1.44, -0.115, 0.25, 0.18, 0.03, paint, { tint: hair }); // hair back

  const legL = new T.Builder();
  legL.box(-0.19, -HIP, -0.09, 0.16, HIP, 0.18, fab, { tint: pants });
  const legR = new T.Builder();
  legR.box(0.03, -HIP, -0.09, 0.16, HIP, 0.18, fab, { tint: pants });

  return { body: body.build(), legL: legL.build(), legR: legR.build() };
}

/* One pet, facing +z: body+head+snout+ears as one mesh, the tail separate
   so it can wag (a yaw oscillation on its own matrix). Cat: smaller, with
   pointy two-sided tri ears. Tint comes from pet.coat, darkened for detail. */
function buildPetMeshes(pet) {
  const coat = pet.coat, dark = [coat[0] * 0.7, coat[1] * 0.7, coat[2] * 0.7];
  const fab = M().fabric, cat = pet.species === "cat";
  const b = new T.Builder();
  if (cat) {
    b.box(-0.10, 0.14, -0.20, 0.20, 0.18, 0.40, fab, { tint: coat });
    b.box(-0.085, 0.28, 0.18, 0.17, 0.16, 0.14, fab, { tint: coat });
    b.tri([-0.08, 0.44, 0.29], [-0.02, 0.44, 0.29], [-0.05, 0.54, 0.27], fab, { tint: dark, twoSided: true });
    b.tri([0.02, 0.44, 0.29], [0.08, 0.44, 0.29], [0.05, 0.54, 0.27], fab, { tint: dark, twoSided: true });
  } else {
    b.box(-0.13, 0.20, -0.28, 0.26, 0.24, 0.56, fab, { tint: coat });
    b.box(-0.10, 0.38, 0.26, 0.20, 0.20, 0.18, fab, { tint: coat });
    b.box(-0.05, 0.40, 0.42, 0.10, 0.08, 0.12, fab, { tint: dark });       // snout
    b.box(-0.11, 0.56, 0.35, 0.06, 0.10, 0.05, fab, { tint: dark });       // ear L
    b.box( 0.05, 0.56, 0.35, 0.06, 0.10, 0.05, fab, { tint: dark });       // ear R
  }
  const tail = new T.Builder();
  tail.box(cat ? -0.02 : -0.025, 0, cat ? -0.26 : -0.20,
           cat ? 0.04 : 0.05, cat ? 0.04 : 0.05,
           cat ? 0.26 : 0.20, fab, { tint: dark });
  return { body: b.build(), tail: tail.build(), tailH: cat ? 0.26 : 0.40 };
}

/* ------------------------------------------------------------------ init - */
/* Called once from main.js after the world boot block, inside a try/catch:
   any failure here must leave the town standing exactly as before. */
N.init = function ({ storage }) {
  doc = ASH.worldLoad(storage);
  if (!doc || !doc.simSnapshot) return;          // no living world yet — stay off
  sim = ASH.AshgroveSim.restore(doc.simSnapshot);
  store = storage;

  /* the worldView adapter, measured from the REAL built town (the same view
     tools/ambient.js asserts against) */
  measureWorldView();

  /* kept for anything still reading it; the clock itself no longer depends
     on when this page loaded */
  sessionStart = performance.now();
  replan(Math.floor(sharedTotalMinutes(Date.now()) / ASH.TOWN_MINUTES_PER_DAY));

  /* one mesh set per living person. People and pets are only ever ADDED at
     world-day boundaries; live day steps call N.refresh(), which extends
     these sets the same way — nothing here is ever removed mid-session */
  for (const person of Object.values(sim.state.people)) {
    if (!person.alive) continue;
    const stage = ASH.lifeStageFor(person.ageDays);
    npcs.push({ person, s: SCALE_BY_STAGE[stage] || 1, ...buildPersonMeshes(person),
                phase: (h2(person.id) % 6283) / 1000, amp: 0,
                x: 0, z: 0, yaw: 0, gy: 0, vis: false, moving: false, snap: true });
  }
  for (const pet of Object.values(plans.pets)) addPet(pet);
  N.on = true;
  console.log(`%cNPCS`, "color:#7ce38b;font-weight:bold",
    `${npcs.length} people · ${pets.length} pets walking the town day`);
};
function h2(id) { return ASH.hashSeed(id); }

function addPet(pet) {
  pets.push({ id: pet.id, name: pet.name, species: pet.species, s: pet.size, ...buildPetMeshes(pet),
              phase: (h2(pet.id) % 6283) / 1000,
              x: 0, z: 0, yaw: 0, gy: 0, vis: false, moving: false, snap: true });
}

/* door anchors + building kinds for every building standing right now.
   Re-measured by N.refresh() after a live world day, because a growth
   building committed mid-session brings a new door anchor (D15). */
function measureWorldView() {
  const anchors = {}, kinds = {};
  for (const b of T.Town.buildings) {
    anchors[b.id] = ASH.doorAnchor({ def: b.def, lot: b.lot, wx: b.wx, wz: b.wz, yaw: b.yaw });
    kinds[b.id] = { com: !!b.def.com, key: b.key };
  }
  const park = (T.Town.blocks || []).find((bl) => bl.kind === "park");
  if (park) anchors.PARK = { x: park.center[0], z: park.center[1], face: "-z" };
  worldView = { anchors, kinds, graph: ASH.streetGraph() };
}

/* A LIVE world day just stepped (D15 — session.advanceDay in render/main.js)
   and persisted a fresh snapshot. Re-restore from it, re-measure the world
   view, and build meshes for anyone born or moved in since init. */
N.refresh = function () {
  if (!N.on) return;
  const fresh = ASH.worldLoad(store);
  if (!fresh || !fresh.simSnapshot) return;
  doc = fresh;
  sim = ASH.AshgroveSim.restore(fresh.simSnapshot);
  measureWorldView();
  replan(sim.state.day);
  for (const person of Object.values(sim.state.people)) {
    if (!person.alive || npcs.some((n) => n.person.id === person.id)) continue;
    const stage = ASH.lifeStageFor(person.ageDays);
    npcs.push({ person, s: SCALE_BY_STAGE[stage] || 1, ...buildPersonMeshes(person),
                phase: (h2(person.id) % 6283) / 1000, amp: 0,
                x: 0, z: 0, yaw: 0, gy: 0, vis: false, moving: false, snap: true });
  }
  for (const pet of Object.values(plans.pets))
    if (!pets.some((p) => p.id === pet.id)) addPet(pet);
};

/* read-only view for the town status panel (render/main.js): the restored
   sim's state, or null when the layer never initialised ("no living world
   yet" — honestly, never zeros). */
N.simState = function () { return sim ? sim.state : null; };

/* the settings "NPC layer" toggle is DISPLAY-only (render/settings.js):
   the sim, the day plans and the town clock all keep running; poses,
   prompts and drawing simply pause while the layer is hidden. */
const displayOn = () => !(T.Settings && T.Settings.npcs === false);

/* cache ASH.planDay for a town day; replans only when the day rolls over */
function replan(day) {
  plans = ASH.planDay(sim.state, worldView, day);
  curDay = day;
}

/* ---------------------------------------------- indoor ↔ outdoor stitching
   sim/ambient.js marks dwells and home time as indoors, and taking that
   literally made people vanish the town-minute they reached a door and pop
   back into existence already walking. Display-only fix, derived from the
   plan's own leg structure (no sim changes — the ambient digest never sees
   this): an INDOOR INTERVAL runs from a leg's arrival to the next leg's
   departure. At its edges the person stays VISIBLE at the door for a beat —
   ENTER_MIN standing at the destination after arrival (stepping in), and
   EXIT_MIN standing at the next leg's origin before departure (stepping
   out). When legs chain with no real gap the windows shrink to nothing and
   the pose is exactly what ASH.poseAt always returned. Pets keep the raw
   pose — they hold yards and doorsteps and never read as teleporting. */
const ENTER_MIN = 1.6, EXIT_MIN = 1.6;      // town minutes (= real seconds, D11)

function doorPose(path, atEnd) {
  const p = atEnd ? ASH.pathPointAt(path, ASH.pathLength(path))
                  : ASH.pathPointAt(path, 0.001);
  return { x: p.x, z: p.z, yaw: p.yaw, moving: false, indoors: false, atHome: false };
}

function stitchedPose(plan, townMin) {
  const pose = ASH.poseAt(plan, townMin);
  if (!pose || !pose.indoors) return pose;
  const legs = plan.legs;
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i], next = legs[i + 1];
    if (leg.kind === "park") continue;          // park dwells are already outdoors
    const gap = next ? next.departMin - leg.arriveMin : Infinity;
    const enterWin = Math.min(ENTER_MIN, Math.max(0, gap / 2));
    if (townMin > leg.arriveMin && townMin <= leg.arriveMin + enterWin)
      return doorPose(leg.path, true);
    if (next) {
      const exitWin = Math.min(EXIT_MIN, Math.max(0, gap / 2));
      if (exitWin > 0 && townMin >= next.departMin - exitWin && townMin < next.departMin)
        return doorPose(next.path, false);
    }
  }
  /* the overnight interval: out the home door shortly before the day's
     first leg (the loop above only covers intervals BETWEEN legs) */
  const first = legs[0];
  if (first && townMin < first.departMin && townMin >= first.departMin - EXIT_MIN)
    return doorPose(first.path, false);
  return pose;
}

/* ----------------------------------------------------------------- update  */
N.update = function (dt, nowMs) {
  if (!N.on) return;
  /* The in-day clock and the plan day both come from the SHARED epoch, not
     from this page load, so every client agrees on what time it is in town
     and therefore on where everyone is standing. The day ROLLOVER needs the
     un-modded total; nothing in sim/ is touched for it. */
  /* N.wallNowOverride lets a test look at a chosen hour of the town day
     without waiting for it. Unset in normal play. */
  const totalMin = sharedTotalMinutes(N.wallNowOverride || Date.now());
  const townMin = totalMin % ASH.TOWN_MINUTES_PER_DAY;
  const day = Math.floor(totalMin / ASH.TOWN_MINUTES_PER_DAY);
  if (day !== curDay) replan(day);
  N.townMin = townMin;

  /* display-only gate: clock and day rollover above already ran — only the
     visible population and its prompts pause while the layer is off */
  if (!displayOn()) {
    N.target = null; N.prompt = null; N.promptAction = null; N.promptBiz = null;
    return;
  }

  for (const n of npcs) {
    const plan = plans.plans[n.person.id];
    const pose = plan ? stitchedPose(plan, townMin) : null;
    n.vis = !!(pose && !pose.indoors);
    if (!n.vis) continue;
    const moved = Math.hypot(pose.x - n.x, pose.z - n.z);
    const jumped = n.snap || moved > 3;
    if (jumped) n.snap = false;                    // teleport: no stride credit
    else n.phase += moved * 2.6;                   // ~0.75 m per half-cycle
    n.amp += ((pose.moving ? 1 : 0) - n.amp) * Math.min(1, dt * 8);
    n.x = pose.x; n.z = pose.z; n.yaw = pose.yaw; n.moving = pose.moving;
    /* Porches, steps and thresholds live in W.surfaces, not the terrain, so
       groundY alone drops them through anything raised. Same floor the player
       stands on; a jump samples from above so they land on top, not under. */
    n.gy = T.Player.floorAt(pose.x, pose.z, jumped ? 1e5 : n.gy);
  }

  for (const p of pets) {
    const pp = plans.pets[p.id];
    if (!pp) { p.vis = false; continue; }
    const ownerPlan = pp.follows ? plans.plans[pp.follows] : null;
    const ownerPose = ownerPlan ? ASH.poseAt(ownerPlan, townMin) : null;
    const pose = ASH.petPoseAt(pp, ownerPose, townMin);
    p.vis = !pose.indoors;
    if (!p.vis) continue;
    const moved = Math.hypot(pose.x - p.x, pose.z - p.z);
    const jumped = p.snap || moved > 3;
    if (jumped) p.snap = false;
    else p.phase += moved * 6;                     // short legs, quicker beat
    p.x = pose.x; p.z = pose.z; p.yaw = pose.yaw; p.moving = pose.moving;
    p.gy = T.Player.floorAt(pose.x, pose.z, jumped ? 1e5 : p.gy);
  }

  computePrompt();
};

/* The one interactive offer per frame. The door prompt always wins: when
   the player faces a door we offer nothing here. Otherwise the faced NPC
   outranks the workplace door. */
function computePrompt() {
  N.target = null; N.prompt = null; N.promptAction = null; N.promptBiz = null;
  const P = T.Player;
  if (!P || P.nearDoor) return;
  const use = T.mobile ? "USE" : "E";
  const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);

  let best = TALK_DIST, pick = null;
  for (const n of npcs) {
    if (!n.vis) continue;
    const dx = n.x - P.pos[0], dz = n.z - P.pos[2];
    const d = Math.hypot(dx, dz);
    if (d > best) continue;
    if ((dx * fx + dz * fz) / (d || 1) < TALK_COS) continue;
    best = d; pick = n;
  }
  if (pick) {
    N.target = pick.person.id;
    N.prompt = `<b>${use}</b>  talk to ${pick.person.name}`;
    N.promptAction = "talk";
    return;
  }

  for (const biz of Object.values(sim.state.businesses)) {
    const a = worldView.anchors[biz.address];
    if (!a) continue;
    if (Math.hypot(a.x - P.pos[0], a.z - P.pos[2]) > WORK_DIST) continue;
    const player = sim.state.player;
    if (!player || !player.seatId) {
      N.prompt = `<b>${use}</b>  take the builder seat at ${biz.name}`;
      N.promptAction = "seat"; N.promptBiz = biz.id;
    } else if (player.employerId === biz.id) {
      N.prompt = `<b>${use}</b>  work a shift · <b>Q</b>  quit`;
      N.promptAction = "work"; N.promptBiz = biz.id;
    }
    return;
  }
}

/* ------------------------------------------------------------------- draw  */
N.draw = function (drawMesh, setModelLike, planes, ex, ez) {
  if (!N.on || !displayOn()) return;
  for (const n of npcs) {
    if (!n.vis) continue;
    const dx = n.x - ex, dz = n.z - ez;
    if (dx * dx + dz * dz > CULL_DIST * CULL_DIST) continue;
    const s = n.s;
    cullBox[0] = n.x - 0.5 * s; cullBox[1] = n.gy;         cullBox[2] = n.z - 0.5 * s;
    cullBox[3] = n.x + 0.5 * s; cullBox[4] = n.gy + 2 * s; cullBox[5] = n.z + 0.5 * s;
    if (!T.aabbVisible(planes, cullBox)) continue;

    const bob = n.moving ? Math.abs(Math.sin(n.phase)) * 0.04 * s : 0;
    drawMesh(n.body, setM(mBody, n.x, n.gy + bob, n.z, n.yaw, s, setModelLike), false);
    /* legs slide fore/aft along the facing; eased amplitude kills popping */
    const off = Math.sin(n.phase) * 0.09 * n.amp * s;
    const fx = Math.sin(n.yaw), fz = Math.cos(n.yaw);
    drawMesh(n.legL, setM(mPart, n.x + fx * off, n.gy + HIP * s, n.z + fz * off, n.yaw, s, setModelLike), false);
    drawMesh(n.legR, setM(mPart, n.x - fx * off, n.gy + HIP * s, n.z - fz * off, n.yaw, s, setModelLike), false);
  }

  for (const p of pets) {
    if (!p.vis) continue;
    const dx = p.x - ex, dz = p.z - ez;
    if (dx * dx + dz * dz > CULL_DIST * CULL_DIST) continue;
    const s = p.s;
    cullBox[0] = p.x - 0.6 * s; cullBox[1] = p.gy;           cullBox[2] = p.z - 0.6 * s;
    cullBox[3] = p.x + 0.6 * s; cullBox[4] = p.gy + 0.9 * s; cullBox[5] = p.z + 0.6 * s;
    if (!T.aabbVisible(planes, cullBox)) continue;

    const bob = p.moving ? Math.abs(Math.sin(p.phase)) * 0.03 * s : 0;
    drawMesh(p.body, setM(mBody, p.x, p.gy + bob, p.z, p.yaw, s, setModelLike), false);
    const wag = p.moving ? Math.sin(p.phase * 1.7) * 0.5 : 0;
    drawMesh(p.tail, setM(mPart, p.x, p.gy + bob + p.tailH * s, p.z, p.yaw + wag, s, setModelLike), false);
  }
};

/* -------------------------------------------------------------- interaction */
/* latest engine event message — take/work/quit all emit exactly one */
function lastEventMsg() {
  const evs = sim.state.events;
  return evs.length ? evs[evs.length - 1].msg : "";
}

/* Persist after every role-swap mutation. NOTE: world days only advance on
   the next boot's catch-up (ASH.bootWorld), so the 4-silent-day inactivity
   reclaim fires THEN, never mid-session — that is the engine's design, this
   layer just keeps the snapshot honest. */
function persist() {
  doc.simSnapshot = sim.snapshot();
  ASH.worldSave(store, doc);
}

N.interact = function () {
  if (!N.on || !displayOn() || !N.promptAction) return;
  if (N.promptAction === "talk") { if (N.target) bark(N.target); return; }
  try {
    if (N.promptAction === "seat") sim.playerTakeSeat(N.promptBiz);
    else if (N.promptAction === "work") sim.playerWorkShift();
    else return;
    persist();
    T.flash(lastEventMsg());
  } catch (e) { T.flash(e.message); }
};

N.quitJob = function () {
  if (!N.on || !displayOn() || N.promptAction !== "work") return;   // Q only lives at the yard
  try {
    sim.playerLeaveSeat();
    persist();
    T.flash(lastEventMsg());
  } catch (e) { T.flash(e.message); }
};

/* a one-line bark, flavoured by who they are and what happened to them */
function bark(personId) {
  const person = sim.state.people[personId];
  if (!person) return;
  const stage = ASH.lifeStageFor(person.ageDays);
  const biz = person.employerId ? sim.state.businesses[person.employerId] : null;
  const seat = biz ? biz.seats.find((st) => st.id === person.seatId) : null;
  const role = biz ? `${seat ? seat.role : "hand"} at ${biz.name}`
                   : { child: "kid", adolescent: "student", youngAdult: "young adult", adult: "resident" }[stage];

  let line;
  const displaced = Object.values(sim.state.businesses)
    .some((b) => b.seats.some((st) => st.displacedId === person.id));
  if (displaced)
    line = "That was my seat at the yard you're sitting in. No hard feelings — mostly.";
  else if (!person.seatId && (stage === "adult" || stage === "youngAdult"))
    line = "They're short a builder at the yard, you know. The seat's there if you want it.";
  else if (stage === "child" || stage === "adolescent")
    line = "School lets out mid-afternoon, town time. The park's better anyway.";
  else
    line = CHATTER[ASH.hashSeed(person.id + "|" + curDay) % CHATTER.length];

  T.flash(`${person.name} · ${role} · lives at ${person.homeId} — “${line}”`);
}
})();
