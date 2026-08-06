/* ============================================================================
   sim/ambient.js — daily itineraries and poses: the visible-life brain
   ---------------------------------------------------------------------------
   DECISION (D11): ambient life is NOT sim state and is NOT persisted. A
   day's itineraries are derived fresh from (sim state, world view, day) at
   the start of each session, from derived streams keyed
   (seed, "plan", personId, day) — so plans vary day to day, replay exactly
   within a session, and can never perturb the authoritative state or its
   digest. The world is true whether watched or not (sim/clock.js); whether
   anyone is WATCHING a particular NPC walk to work is a view concern, and
   livi-organism's rule applies: nothing ticks while unobserved.

   The visible clock: 1 real second = 1 town minute; a town day is 1440 town
   minutes = 24 real minutes. It answers "where is everyone right now" and
   nothing else — the day pipeline remains the only thing that changes state.

   Paths come from the street graph (world/streets.js), supplied by the host
   inside worldView: { anchors: {id: {x,z,face}}, kinds: {id: {com, key}},
   graph }. "PARK" is a reserved anchor id for the park block centre.
   ========================================================================== */
(function () {
"use strict";
const ASH = (globalThis.ASH = globalThis.ASH || {});

/* A town day is a REAL day: 1 town minute = 1 real minute, so the town's
   clock reads the same as a wall clock and the residents keep a genuine
   24-hour routine. (It was 1 real second = 1 town minute — a 24-real-minute
   day — which made the whole cycle observable in one sitting but meant the
   town's morning had nothing to do with your morning.) Anything computing a
   duration in town minutes must convert from seconds; see legDepart below. */
ASH.TOWN_MINUTES_PER_DAY = 1440;           // 1 town minute = 1 real minute

const SPEED_ADULT = 1.4, SPEED_CHILD = 1.1;   // m/s

/* Town minutes into the visible day, from the session's own start. */
ASH.townMinutes = function (nowMs, sessionStartMs) {
  if (!Number.isFinite(nowMs) || !Number.isFinite(sessionStartMs)) return 0;
  const elapsed = Math.max(0, (nowMs - sessionStartMs) / 1000);
  return elapsed % ASH.TOWN_MINUTES_PER_DAY;
};

/* ------------------------------------------------------- polyline helpers */
ASH.pathLength = function (path) {
  let L = 0;
  for (let i = 1; i < path.length; i++)
    L += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
  return L;
};

/* The point at arc distance d along a path, with heading yaw = atan2(dx,dz). */
ASH.pathPointAt = function (path, d) {
  if (path.length === 1) return { x: path[0][0], z: path[0][1], yaw: 0 };
  let left = Math.max(0, d);
  for (let i = 1; i < path.length; i++) {
    const dx = path[i][0] - path[i - 1][0], dz = path[i][1] - path[i - 1][1];
    const len = Math.hypot(dx, dz);
    const yaw = len ? Math.atan2(dx, dz) : 0;
    if (left <= len || i === path.length - 1) {
      const t = len ? Math.min(1, left / len) : 0;
      return { x: path[i - 1][0] + dx * t, z: path[i - 1][1] + dz * t, yaw };
    }
    left -= len;
  }
  /* unreachable, kept for clarity */
  return { x: path[path.length - 1][0], z: path[path.length - 1][1], yaw: 0 };
};

/* ------------------------------------------------------------- leg making */
/* Travel time is measured in TOWN minutes, and a town minute is now a REAL
   minute (see TOWN_MINUTES_PER_DAY above). `speed` is metres per real second,
   so a path length in metres divided by speed gives SECONDS — hence `/ 60` to
   land in minutes. A 140 m walk is 100 s, which is 1.67 town minutes.

   History, because this line has been wrong in both directions: the `/ 60`
   was once removed to suit a 24-real-minute day, where a town minute equalled
   a real second and the conversion was genuinely wrong. Under a 24-real-hour
   day it is required again. Remove it and every walk takes sixty times too
   long — people would still be crossing the street at bedtime. */
function legDepart(kind, to, fromA, toA, graph, speed, departMin) {
  const path = ASH.tripPath(graph, fromA, toA);
  const travel = ASH.pathLength(path) / speed / 60;
  return { kind, to, path, departMin, arriveMin: departMin + travel, dwellMin: 0 };
}

/* arrive-anchored: departure is clamped EARLIER so the trip lands on time */
function legArrive(kind, to, fromA, toA, graph, speed, arriveMin) {
  const path = ASH.tripPath(graph, fromA, toA);
  const travel = ASH.pathLength(path) / speed / 60;
  return { kind, to, path, departMin: arriveMin - travel, arriveMin, dwellMin: 0 };
}

/* ------------------------------------------------------------- the plan -- */
/* Plans for every living person for one day. Legs tile the day in order and
   chain door-to-door; outside a leg's span the NPC is indoors at home.
   Day 0 is a Monday by convention; days 0–4 of each week are weekdays. */
ASH.planDay = function (state, worldView, day) {
  const graph = worldView.graph, anchors = worldView.anchors, kinds = worldView.kinds;
  const plans = {}, pets = {};

  const schoolId = Object.keys(kinds).find((id) => kinds[id].key === "school") || null;
  const errandIds = Object.keys(kinds)
    .filter((id) => kinds[id].com && id !== schoolId).sort();
  const parkA = anchors.PARK || null;
  const destPool = errandIds.concat(parkA ? ["PARK", "PARK"] : []);   // park ×2
  const weekday = ((day % 7) + 7) % 7 < 5;

  for (const person of Object.values(state.people)) {
    if (!person.alive) continue;
    const homeA = anchors[person.homeId];
    if (!homeA) continue;
    const rng = ASH.stream(state.seed, "plan", person.id, day);
    const stage = ASH.lifeStageFor(person.ageDays);
    const speed = (stage === "child" || stage === "adolescent") ? SPEED_CHILD : SPEED_ADULT;
    const legs = [];
    const destA = (id) => (id === "PARK" ? parkA : anchors[id]);
    const destKind = (id) => (id === "PARK" ? "park" : "errand");

    const biz = person.employerId ? state.businesses[person.employerId] : null;
    const workA = biz ? anchors[biz.address] : null;

    if (person.seatId && workA) {
      /* employed adult: work by 480±30, a lunch walk near 720, home 990–1080 */
      const arriveWork = 480 + rng.int(-30, 30);
      const lunchDepart = 720 + rng.int(-20, 20);
      const homeDepart = rng.int(990, 1080);
      const lunchId = parkA && rng.float() < 0.5 ? "PARK" : rng.pick(errandIds);
      const leg1 = legArrive("work", biz.address, homeA, workA, graph, speed, arriveWork);
      leg1.dwellMin = lunchDepart - leg1.arriveMin;
      const leg2 = legDepart(destKind(lunchId), lunchId, workA, destA(lunchId),
                             graph, speed, lunchDepart);
      leg2.dwellMin = 45;
      const leg3 = legDepart("work", biz.address, destA(lunchId), workA,
                             graph, speed, leg2.arriveMin + leg2.dwellMin);
      /* real walks take real time now; a long lunch can push the return past
         the nominal homeDeparture — clamp so dwell and departure stay sane */
      leg3.dwellMin = Math.max(0, homeDepart - leg3.arriveMin);
      const leg4 = legDepart("home", person.homeId, workA, homeA, graph, speed,
                             Math.max(homeDepart, leg3.arriveMin + leg3.dwellMin));
      legs.push(leg1, leg2, leg3, leg4);
    } else if ((stage === "child" || stage === "adolescent") && weekday &&
               schoolId && anchors[schoolId]) {
      /* school day: in by ~510, out near 900 */
      const arrive = 510 + rng.int(-15, 15);
      const dismiss = 900 + rng.int(0, 30);
      const leg1 = legArrive("school", schoolId, homeA, anchors[schoolId],
                             graph, speed, arrive);
      leg1.dwellMin = dismiss - leg1.arriveMin;
      legs.push(leg1,
                legDepart("home", person.homeId, anchors[schoolId], homeA,
                          graph, speed, dismiss));
    } else if (destPool.length) {
      /* idle adults, young adults, weekend kids: 1–3 outings, 540–1200 */
      const n = rng.int(1, (stage === "child" || stage === "adolescent") ? 2 : 3);
      for (let k = 0; k < n; k++) {
        const id = rng.pick(destPool);
        const slot = 540 + (k + 0.5) * (660 / n);
        const depart = slot + rng.int(-30, 30);
        const out = legDepart(destKind(id), id, homeA, destA(id), graph, speed, depart);
        out.dwellMin = rng.int(30, 60);
        const back = legDepart("home", person.homeId, destA(id), homeA,
                               graph, speed, out.arriveMin + out.dwellMin);
        legs.push(out, back);
      }
    }
    plans[person.id] = { id: person.id, homeId: person.homeId,
                         home: { x: homeA.x, z: homeA.z, face: homeA.face }, legs };
  }

  /* pets: which household pet follows which person on which legs today */
  for (const hh of Object.values(state.households)) {
    const pet = ASH.petFor(state.seed, hh.id);
    if (!pet) continue;
    const homeA = anchors[hh.homeId];
    if (!homeA) continue;
    let follows = null, won = [];
    for (const pid of hh.memberIds) {
      const plan = plans[pid];
      if (!plan) continue;
      for (let i = 0; i < plan.legs.length; i++) {
        if (plan.legs[i].kind === "home") continue;
        const roll = ASH.stream(state.seed, "petfollow", pet.id, day, i);
        if (roll.float() < ASH.PET_FOLLOW_CHANCE[pet.species]) won.push(i);
      }
      if (won.length) { follows = pid; break; }
      won = [];
    }
    pets[pet.id] = Object.assign({}, pet, {
      follows,
      homeId: hh.homeId,
      home: { x: homeA.x, z: homeA.z, face: homeA.face },
      legs: follows ? won.map((i) => plans[follows].legs[i]) : [],
    });
  }

  return { plans, pets };
};

/* --------------------------------------------------------------- the pose */
/* Where a plan puts its person at a town minute. Walking legs interpolate at
   constant speed; dwells at buildings are indoors; park dwells wander a loop
   (radius ~6 m) so the park stays visibly alive; anything else is home. */
ASH.poseAt = function (plan, townMin) {
  for (const leg of plan.legs) {
    if (townMin >= leg.departMin && townMin <= leg.arriveMin &&
        leg.arriveMin > leg.departMin) {
      const L = ASH.pathLength(leg.path);
      const d = L * (townMin - leg.departMin) / (leg.arriveMin - leg.departMin);
      const p = ASH.pathPointAt(leg.path, d);
      return { x: p.x, z: p.z, yaw: p.yaw, moving: true, indoors: false, atHome: false };
    }
    if (townMin > leg.arriveMin && townMin < leg.arriveMin + leg.dwellMin) {
      const end = leg.path[leg.path.length - 1];
      if (leg.kind === "park") {
        const a = (ASH.hashSeed(plan.id) % 6283) / 1000 + townMin * 0.8;
        return { x: end[0] + Math.cos(a) * 6, z: end[1] + Math.sin(a) * 6,
                 yaw: a + Math.PI / 2, moving: true, indoors: false, atHome: false };
      }
      return { x: end[0], z: end[1], yaw: 0, moving: false,
               indoors: true, atHome: leg.kind === "home" };
    }
  }
  return { x: plan.home.x, z: plan.home.z, yaw: 0, moving: false,
           indoors: true, atHome: true };
};

ASH.ambientDigest = function (plan) { return ASH.canonicalDigest(plan); };
})();
