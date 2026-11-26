// Mode 3, YOU HUNT IT. It ducks behind cover, taunts when far, flees toward an exit you are not blocking, jukes.
// Action = a short dive; a miss leaves you on the ground. Catch it before it reaches an exit. At 90 s it bolts.
import { makeBase, makePath, dist, DT } from './common.js';
import { stepMover, makeMover, followPath, stepToward, turnToward } from '../mover.js';
import { HUNT } from '../tuning.js';

export function createHunt(layout, opts = {}) {
  const g = makeBase(layout, opts, 'hunt');
  const { world, nav, rng, emit, player } = g;
  // it starts at a seeded hiding spot well away from you and from the exits (the layout's hunted spawn if none fits)
  const st = layout.spawns.turkeyHunted;
  const starts = layout.hides.filter((h) => Math.hypot(h.x - player.x, h.z - player.z) > 15 && layout.exits.every((e) => Math.hypot(e.x - h.x, e.z - h.z) > HUNT.coverExitClear));
  const s0 = starts.length ? starts[rng.int(starts.length)] : st;
  const tp = world.freeSpot(s0.x, s0.z, HUNT.r);
  const turkey = makeMover(tp.x, tp.z, st.rotY || 0, { r: HUNT.r });
  Object.assign(turkey, { anim: 'idle', animT: 0, state: 'calm', timer: 0, sprint: 0, tiredT: 0, jukeCd: 0, jdx: 0, jdz: 0, replan: 0, tauntIn: 4, wanderIn: 0, exit: null });
  g.turkey = turkey;
  const exits = layout.exits;
  const covers = layout.hides
    .map((h) => world.freeSpot(h.x, h.z, HUNT.r, { x: 0, z: 0 }))
    .filter((p) => exits.every((e) => Math.hypot(e.x - p.x, e.z - p.z) > HUNT.coverExitClear));
  const path = makePath();
  let bolted = false;
  const dive = { t: 0, down: 0, dx: 0, dz: 0 };
  g.dive = dive;
  g.hud.label = 'You Hunt It';
  g.hud.action = 'Dive';

  function setAnim(a) { if (turkey.anim !== a) { turkey.anim = a; turkey.animT = 0; } }
  function plan(tx, tz) { nav.findPath(turkey.x, turkey.z, tx, tz, path); path.i = 0; turkey.replan = HUNT.replan; }

  // An exit is blocked when you are closer to it than the turkey, or standing near the turkey's line to it.
  function pickExit() {
    let best = null, bestD = 1e9, fallback = null, fb = -1e9;
    for (const e of exits) {
      const dt = Math.hypot(e.x - turkey.x, e.z - turkey.z), dp = Math.hypot(e.x - player.x, e.z - player.z);
      const lx = e.x - turkey.x, lz = e.z - turkey.z, L2 = lx * lx + lz * lz || 1;
      const u = ((player.x - turkey.x) * lx + (player.z - turkey.z) * lz) / L2;
      const qx = turkey.x + lx * Math.max(0, Math.min(1, u)), qz = turkey.z + lz * Math.max(0, Math.min(1, u));
      const off = Math.hypot(player.x - qx, player.z - qz);
      const blocked = dp < dt || (u > 0 && u < 1 && off < 4);
      const margin = dp - dt;
      if (margin > fb) { fb = margin; fallback = e; }
      if (!blocked && dt < bestD) { bestD = dt; best = e; }
    }
    return best || fallback;
  }
  function pickCover() {
    let best = null, bs = -1e9;
    for (const c of covers) {
      const s = Math.hypot(c.x - player.x, c.z - player.z) - 0.6 * Math.hypot(c.x - turkey.x, c.z - turkey.z) + rng.range(0, 3);
      if (s > bs) { bs = s; best = c; }
    }
    return best;
  }

  g.step = function step(input) {
    g.steps++; turkey.animT += DT;
    if (g.phase !== 'play') { turkey.speed = 0; return; }
    g.t += DT;

    // you: walk, or dive, or lie in the dirt after a miss
    if (dive.t > 0) {
      dive.t -= DT;
      stepToward(player, player.x + dive.dx * 3, player.z + dive.dz * 3, HUNT.diveSpeed, world, g.clampArena, 0.1);
      if (dist(player, turkey) < HUNT.catchR) {
        g.phase = 'won'; g.result = { win: true, time: g.t, title: 'Got it!' };
        setAnim('startled'); turkey.speed = 0; emit('caught', turkey.x, turkey.z); emit('feathers', turkey.x, turkey.z, { n: 18 });
        return;
      }
      if (dive.t <= 0) { dive.down = HUNT.downTime; emit('miss', player.x, player.z); }
    } else if (dive.down > 0) {
      dive.down -= DT; player.vx = player.vz = 0; player.speed = 0;
    } else {
      stepMover(player, input.mx, input.mz, input.run, world, g.clampArena);
      if (input.action) {
        const m = Math.hypot(input.mx, input.mz);
        dive.dx = m > 0.2 ? input.mx / m : Math.sin(player.heading); dive.dz = m > 0.2 ? input.mz / m : Math.cos(player.heading);
        player.heading = Math.atan2(dive.dx, dive.dz);
        dive.t = HUNT.diveTime; emit('dive', player.x, player.z);
      }
    }

    const d = dist(player, turkey);
    if (turkey.jukeCd > 0) turkey.jukeCd -= DT;
    turkey.replan -= DT;
    if (!bolted && g.t >= HUNT.bolt) { bolted = true; turkey.state = 'bolt'; emit('bolt', turkey.x, turkey.z); emit('gobble', turkey.x, turkey.z, { loud: 1 }); turkey.replan = 0; }

    // a juke beats every other plan for a moment
    if (turkey.state !== 'juke' && d < HUNT.jukeDist && turkey.jukeCd <= 0 && (player.speed > 3 || dive.t > 0)) {
      const ax = turkey.x - player.x, az = turkey.z - player.z, al = Math.max(1e-3, Math.hypot(ax, az));
      const side = rng.chance(0.5) ? 1 : -1;
      turkey.jdx = (-az / al) * side * 0.85 + (ax / al) * 0.5; turkey.jdz = (ax / al) * side * 0.85 + (az / al) * 0.5;
      turkey.state = 'juke'; turkey.timer = HUNT.jukeTime; turkey.jukeCd = HUNT.jukeCd; emit('juke', turkey.x, turkey.z);
    }

    switch (turkey.state) {
      case 'calm': {
        const scare = player.running || dive.t > 0 ? HUNT.fleeDist : HUNT.fleeSneak;
        if (d < scare) { turkey.state = 'flee'; turkey.exit = pickExit(); plan(turkey.exit.x, turkey.exit.z); emit('gobble', turkey.x, turkey.z, { loud: 1 }); break; }
        turkey.tauntIn -= DT; turkey.wanderIn -= DT;
        if (turkey.tauntIn <= 0 && d > HUNT.tauntDist) { turkey.state = 'taunt'; turkey.timer = HUNT.tauntTime; turkey.tauntIn = HUNT.tauntEvery + rng.range(0, 3); emit('gobble', turkey.x, turkey.z, { taunt: 1 }); break; }
        if (turkey.wanderIn <= 0) { const c = pickCover(); if (c) plan(c.x, c.z); turkey.wanderIn = HUNT.wanderEvery + rng.range(0, 2); }
        const arrived = path.i >= path.n || followPath(turkey, path, HUNT.calm, world, g.clampArena, 8);
        setAnim(arrived ? 'idle' : 'walk');
        if (arrived) turkey.heading = turnToward(turkey.heading, Math.atan2(player.x - turkey.x, player.z - turkey.z), 3 * DT);
        break;
      }
      case 'taunt':
        turkey.speed = 0; setAnim('gobble');
        turkey.heading = turnToward(turkey.heading, Math.atan2(player.x - turkey.x, player.z - turkey.z), 5 * DT);
        if ((turkey.timer -= DT) <= 0 || d < HUNT.fleeDist) turkey.state = 'calm';
        break;
      case 'flee': {
        if (d > HUNT.fleeDist * 1.7) { turkey.state = 'calm'; turkey.wanderIn = 0; break; }
        if (turkey.replan <= 0) { const e = pickExit(); if (e !== turkey.exit) { turkey.exit = e; } plan(turkey.exit.x, turkey.exit.z); }
        let speed = HUNT.flee;
        if (turkey.tiredT > 0) { turkey.tiredT -= DT; speed = HUNT.tired; }
        else { turkey.sprint += DT; if (turkey.sprint > HUNT.sprintMax) { turkey.sprint = 0; turkey.tiredT = HUNT.tiredTime; emit('pant', turkey.x, turkey.z); } }
        followPath(turkey, path, speed, world, g.clampArena, 11);
        setAnim(speed > 3 ? 'run' : 'walk');
        break;
      }
      case 'juke':
        stepToward(turkey, turkey.x + turkey.jdx * 3, turkey.z + turkey.jdz * 3, HUNT.jukeSpeed, world, g.clampArena, 20);
        setAnim('run');
        if ((turkey.timer -= DT) <= 0) { turkey.state = bolted ? 'bolt' : 'flee'; turkey.replan = 0; if (!turkey.exit) turkey.exit = pickExit(); }
        break;
      case 'bolt': {
        if (turkey.replan <= 0) { turkey.exit = pickExit(); plan(turkey.exit.x, turkey.exit.z); }
        followPath(turkey, path, HUNT.boltSpeed, world, g.clampArena, 11);
        setAnim('run');
        break;
      }
    }

    // out through a gap?
    for (const e of exits) {
      if (Math.hypot(e.x - turkey.x, e.z - turkey.z) < e.r) {
        g.phase = 'lost'; g.result = { win: false, time: g.t, title: 'It got away!', exit: e.id };
        emit('escaped', turkey.x, turkey.z, { exit: e.id }); emit('lose', player.x, player.z);
        break;
      }
    }
    g.hud.time = g.t; g.hud.stamina = player.stamina; g.hud.bolt = bolted; g.hud.down = dive.down > 0;
  };
  return g;
}
