/* ============================================================================
   sim/pets.js — household pets, deterministic plain data
   ---------------------------------------------------------------------------
   Principle taken from livi-organism (seen in its source): a pet is an
   organism with a BOND to its people — a first-class trait, rolled once and
   kept — not a prop. Here the bond is one axis (0.3–0.88, livi's range),
   drawn from the household's derived stream so every replay agrees (D6).

   Pets are not sim state. Like the daily itineraries in sim/ambient.js they
   are derived fresh from (seed, household) each session — decision D11,
   recorded in that module's header. Nothing here ticks; poses are computed
   on demand from a pet plan, an owner pose, and the visible clock.

   Follow rule: the per-leg stream decides WHICH legs the pet walks beside
   (~40 % of legs for dogs, ~15 % for cats). A pet that won any leg tags
   along with that owner for the whole outing — hovering nearby on the other
   spans — because a dog that followed you to work does not teleport home
   while you are at your desk. With no won legs it holds its yard loop.
   ========================================================================== */
(function () {
"use strict";
const ASH = (globalThis.ASH = globalThis.ASH || {});

const PET_NAMES = ["Biscuit", "Maple", "Pepper", "Willow", "Rusty",
                   "Clover", "Mochi", "Juniper", "Pip", "Hazelnut"];
const PET_CHANCE = 0.55;                 // share of households with a pet
ASH.PET_FOLLOW_CHANCE = { dog: 0.40, cat: 0.15 };

/* The pet a household has, or null. One derived stream per household, so the
   answer replays exactly and no other decision can perturb it. */
ASH.petFor = function (seed, householdId) {
  const rng = ASH.stream(seed, "pet", householdId);
  if (rng.float() >= PET_CHANCE) return null;
  const species = rng.float() < 0.6 ? "dog" : "cat";
  return {
    id: `pet:${householdId}`,
    householdId,
    species,
    name: rng.pick(PET_NAMES),
    coat: [rng.float(), rng.float(), rng.float()],   // tint hint for the view
    size: 0.8 + rng.float() * 0.4,
    bond: 0.3 + rng.float() * 0.58,                  // livi's bond principle
  };
};

/* The yard-wander centre: 2.6 m OUT from the front door along its facing
   (plus a deterministic 1.2 m sideways). An earlier version put the centre
   2 m *beside* the door on the facade line, so the 3 m loop swung straight
   through the house wall — the "pets walk through things" bug. Kept clear of
   the facade by construction; tools/ambient.js proves it against footprints. */
ASH.petYardCentre = function (pet, homeAnchor) {
  const side = ASH.hashSeed(pet.id) % 2 ? 1 : -1;
  const out = { "+z": [0, 1], "-z": [0, -1], "+x": [1, 0], "-x": [-1, 0] }[homeAnchor.face] || [0, 1];
  return {
    x: homeAnchor.x + out[0] * 2.6 - out[1] * side * 1.2,
    z: homeAnchor.z + out[1] * 2.6 + out[0] * side * 1.2,
  };
};

/* The pet's pose. petPlan is the plain-data plan from ASH.planDay:
   { id, species, follows, home, legs: [mirrored owner legs] }.
   ownerPose is ASH.poseAt output for the followed person (may be null). */
ASH.petPoseAt = function (petPlan, ownerPose, townMin) {
  const phase = (ASH.hashSeed(petPlan.id) % 6283) / 1000;

  if (ownerPose && petPlan.legs.length) {
    /* a won leg in progress: walk ~2.5 s of path behind the owner,
       wandering ±0.6 m perpendicular */
    for (const leg of petPlan.legs) {
      if (townMin >= leg.departMin && townMin <= leg.arriveMin &&
          leg.arriveMin > leg.departMin) {
        const L = ASH.pathLength(leg.path);
        const span = leg.arriveMin - leg.departMin;
        const ownerD = L * (townMin - leg.departMin) / span;
        const lag = 2.5 * (L / (span * 60));        // 2.5 s at the owner's pace
        const p = ASH.pathPointAt(leg.path, Math.max(0, ownerD - lag));
        const wob = 0.6 * Math.sin(phase + townMin * 0.35);
        return { x: p.x + Math.cos(p.yaw) * wob, z: p.z - Math.sin(p.yaw) * wob,
                 yaw: p.yaw, moving: true, indoors: false, mode: "follow" };
      }
    }
    if (!ownerPose.indoors) {
      /* owner is outdoors on a span the roll lost — hover close by */
      const r = 1.2 + 0.4 * Math.sin(phase * 2 + townMin * 0.21);
      const a = phase + townMin * 0.3;
      return { x: ownerPose.x + Math.cos(a) * r, z: ownerPose.z + Math.sin(a) * r,
               yaw: a + Math.PI / 2, moving: true, indoors: false, mode: "hover" };
    }
    if (!ownerPose.atHome) {
      /* owner is inside a building away from home — wait by the door */
      const a = phase + townMin * 0.4;
      return { x: ownerPose.x + Math.cos(a) * 1.1, z: ownerPose.z + Math.sin(a) * 1.1,
               yaw: a + Math.PI / 2, moving: true, indoors: false, mode: "wait" };
    }
  }

  /* yard wander: a slow loop in the yard in front of the door. Radius 1.6 m
     around a centre 2.6 m out keeps ≥1.0 m of clearance to the facade. */
  const c = ASH.petYardCentre(petPlan, petPlan.home);
  const a = phase + townMin * 0.25;
  return { x: c.x + Math.cos(a) * 1.6, z: c.z + Math.sin(a) * 1.6,
           yaw: a + Math.PI / 2, moving: true, indoors: false, mode: "yard" };
};
})();
