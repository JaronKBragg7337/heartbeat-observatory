// Every feel number in one place. Seconds, meters, meters per second.
export const DT = 1 / 60;

export const PERSON = {
  r: 0.3, walk: 2.6, run: 5.2, accel: 11, turn: 11,
  runTime: 6.0,        // a full stamina bar lasts this long at a run
  regenTime: 4.5,      // empty to full when not running
  regenDelay: 0.5,
  exhaustedUntil: 0.3, // after running dry, you can run again once the bar is back to this
};

export const TURKEY_PLAYER = {   // mode 4: you are the turkey
  r: 0.3, walk: 3.3, run: 5.4, accel: 14, turn: 14,
  runTime: Infinity, regenTime: 1, regenDelay: 0, exhaustedUntil: 0,
  hopTime: 0.38, hopSpeed: 6.8, hopHeight: 0.75, hopCooldown: 0.18,
  invuln: 1.2, stunAfterHit: 0.45,
  waterGrace: 0.2,      // a turkey can skitter this long over water before it falls in
};

export const FIND = {
  foundDist: 2.2, bumpDist: 1.0, faceDot: 0.5, camFaceDot: 0.6, actionDist: 2.8,
  firstGobble: 2.5, gobbleMin: 9, gobbleMax: 14, peekChance: 0.45, peekHold: 2.0, peekMove: 0.5,
  slipNear: 5.5, slipReset: 9, slipChance: 0.65, slipsMin: 1, slipsMax: 2, slipSpeed: 4.8, slipFar: 15,
  bpmMin: 62, bpmMax: 172, bpmFar: 34,
  hideR: 0.15,
};

export const HUNTED = {
  duration: 75, hearts: 3, wake: 1.6, wakeCarry: 2.6,   // in the story it starts right next to you: a moment to run
  chase: 3.05, search: 2.3, turn: 9, r: 0.35,
  sees: 32, eyeH: 1.0, loseAfter: 2.4, searchLook: 3.2,
  chargeRange: 8, chargeMin: 2.4, windup: 0.5, chargeSpeed: 7.2, chargeTime: 0.9, chargeCd: 2.8, chargeCdJitter: 0.8, stun: 0.9,
  peckRange: 1.1, peckHit: 1.35, peckWind: 0.32, recover: 0.75, chargeHit: 0.85,
  knock: 6.5, invuln: 1.5,
  replan: 0.3,
};

export const HUNT = {
  bolt: 90, r: 0.35,
  calm: 2.0, flee: 4.0, tired: 1.8, sprintMax: 3.5, tiredTime: 1.6, boltSpeed: 5.0,
  fleeDist: 9, fleeSneak: 5.5,     // walking up quietly gets you closer before it bolts
  tauntDist: 15, tauntEvery: 6, tauntTime: 1.4, wanderEvery: 4.5, coverExitClear: 11,
  jukeDist: 3.2, jukeTime: 0.35, jukeSpeed: 5.8, jukeCd: 2.0,
  diveTime: 0.36, diveSpeed: 7.6, catchR: 1.3, downTime: 1.0,
  replan: 0.35,
};

export const ESCAPE = {
  farmerChase: 3.5, farmerCone: 0.34, farmerHear: 3.2, farmerLose: 2.5, netWind: 0.35,
  dogWake: 0.8, dogChaseMax: 7, dogHome: 2.2, dogCatch: 0.75,
  speedPerLane: 0.07, speedPerRun: 0.15, speedCap: 1.75,
  logPadZ: 0.3, logPadX: 0.15, stoneR: 0.75,
  nearMissZ: 1.6, nearMissX: 0.6,
  endWalk: 1.7, knockReach: 0.7, knock1: 0.55, knock2: 1.15, cardAt: 2.7,
};

// Lane overrides on top of layout.json (the game's side of the feel). By lane id: rows = new z per sublane (in order),
// speed / gap multipliers per sublane. The highway's rows sat 0.75-1 m apart, so there was nowhere to stand between
// them: spread to the lane edges they leave a ~1.5 m median between each pair, a breath between rows.
export const LANE_TUNING = {
  highway: { rows: [63.3, 67, 70.7], speed: [0.95, 0.92, 1], gapMin: [1.1, 1.1, 1] },
};
// Escape start: if the spawn sits in a doorway under a roof, step it out until the follow camera has a clear view.
export const ESCAPE_START = { roofClear: 0.78, maxPush: 5, step: 0.25 };
// It Hunts You, carried from Find: the turkey first flaps back to at least this far from you.
export const HUNTED_CARRY = { minDist: 8, maxDist: 10 };

export const ENDING_LINES = ['Knock knock.', "Who's there?", 'The turkey.'];
