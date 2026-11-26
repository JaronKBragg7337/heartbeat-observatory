// Mode 1, FIND THE TURKEY. It hides, gobbles every 9 to 14 s, sometimes peeks out, and may slip away once or twice.
import { makeBase, makePath, dist, DT } from './common.js';
import { stepMover, makeMover, followPath, turnToward } from '../mover.js';
import { FIND, HUNTED } from '../tuning.js';

export function createFind(layout, opts = {}) {
  const g = makeBase(layout, opts, 'find');
  const { world, nav, rng, emit, player } = g;
  const hides = layout.hides.map((h) => {
    const p = world.freeSpot(h.x, h.z, FIND.hideR), q = world.freeSpot(h.peek.x, h.peek.z, FIND.hideR);
    return { id: h.id, x: p.x, z: p.z, rotY: h.rotY || 0, peek: { x: q.x, z: q.z }, kind: h.kind, about: h.about };
  });
  g.hides = hides;
  const start = hides[rng.int(hides.length)];
  const turkey = makeMover(start.x, start.z, start.rotY, { r: HUNTED.r });
  Object.assign(turkey, { anim: 'hide', animT: 0, state: 'hidden', hide: start, timer: 0, gobbleIn: FIND.firstGobble, peekT: 0, moveT: 0 });
  g.turkey = turkey;
  let slipsLeft = FIND.slipsMin + rng.int(FIND.slipsMax - FIND.slipsMin + 1);
  let approachRolled = false;
  const path = makePath();
  g.hud.label = 'Find the Turkey';
  g.hud.action = null;

  function setAnim(a) { if (turkey.anim !== a) { turkey.anim = a; turkey.animT = 0; } }

  function startSlip() {
    const far = hides.filter((h) => h !== turkey.hide && dist(h, player) > FIND.slipFar);
    const pool = far.length ? far : hides.filter((h) => h !== turkey.hide);
    pool.sort((a, b) => dist(a, turkey) - dist(b, turkey));
    const next = pool[rng.int(Math.min(3, pool.length))];
    turkey.hide = next; turkey.state = 'slip'; slipsLeft--;
    nav.findPath(turkey.x, turkey.z, next.x, next.z, path); path.i = 0;
    emit('slip', turkey.x, turkey.z); emit('gobble', turkey.x, turkey.z, { loud: 1 });
    setAnim('run');
  }

  g.step = function step(input) {
    if (g.phase !== 'play') { g.steps++; turkey.animT += DT; return; }
    g.t += DT; g.steps++; turkey.animT += DT;
    stepMover(player, input.mx, input.mz, input.run, world, g.clampArena);
    const d = dist(player, turkey);

    // the turkey
    if (turkey.state === 'hidden') {
      turkey.x = turkey.hide.x; turkey.z = turkey.hide.z; turkey.speed = 0;
      turkey.heading = turnToward(turkey.heading, turkey.hide.rotY, 4 * DT);
      if (turkey.anim !== 'gobble' || turkey.animT > 0.9) setAnim('hide');
      turkey.gobbleIn -= DT;
      if (turkey.gobbleIn <= 0) {
        turkey.gobbleIn = rng.range(FIND.gobbleMin, FIND.gobbleMax);
        emit('gobble', turkey.x, turkey.z);
        if (rng.chance(FIND.peekChance)) { turkey.state = 'peek'; turkey.peekT = 0; setAnim('peek'); }
        else setAnim('gobble');
      }
      if (d > FIND.slipReset) approachRolled = false;
      if (!approachRolled && d < FIND.slipNear && d > FIND.foundDist + 0.4) {
        approachRolled = true;
        if (slipsLeft > 0 && rng.chance(FIND.slipChance)) startSlip();
      }
    } else if (turkey.state === 'peek') {
      turkey.peekT += DT;
      const h = turkey.hide, tOut = FIND.peekMove, tHold = tOut + FIND.peekHold, tBack = tHold + FIND.peekMove;
      let k = turkey.peekT < tOut ? turkey.peekT / tOut : turkey.peekT < tHold ? 1 : 1 - (turkey.peekT - tHold) / FIND.peekMove;
      k = Math.max(0, Math.min(1, k)); const s = k * k * (3 - 2 * k);
      turkey.px = turkey.x; turkey.pz = turkey.z;
      turkey.x = h.x + (h.peek.x - h.x) * s; turkey.z = h.z + (h.peek.z - h.z) * s;
      turkey.speed = Math.hypot(turkey.x - turkey.px, turkey.z - turkey.pz) / DT;
      const look = Math.atan2(player.x - turkey.x, player.z - turkey.z);
      turkey.heading = turnToward(turkey.heading, turkey.peekT < tHold ? look : h.rotY, 5 * DT);
      setAnim(turkey.speed > 0.3 ? 'walk' : 'peek');
      if (turkey.peekT >= tBack) { turkey.state = 'hidden'; setAnim('hide'); }
    } else if (turkey.state === 'slip') {
      const done = followPath(turkey, path, FIND.slipSpeed, world, g.clampArena, 12);
      setAnim('run');
      if (done) { turkey.state = 'hidden'; turkey.gobbleIn = rng.range(3.5, 5.5); setAnim('hide'); approachRolled = d < FIND.slipNear; }
    }

    // found?
    const dx = turkey.x - player.x, dz = turkey.z - player.z, dl = Math.max(1e-6, d);
    const faceP = (Math.sin(player.heading) * dx + Math.cos(player.heading) * dz) / dl;
    const faceC = ((input.fx || 0) * dx + (input.fz || 0) * dz) / dl;
    const facing = faceP > FIND.faceDot || faceC > FIND.camFaceDot;
    if (d < FIND.bumpDist || (d < FIND.foundDist && facing) || (input.action && d < FIND.actionDist)) {
      g.phase = 'won';
      g.result = { win: true, time: g.t, title: 'Found it!' };
      turkey.state = 'found'; turkey.heading = Math.atan2(-dx, -dz); setAnim('startled');
      emit('found', turkey.x, turkey.z); emit('feathers', turkey.x, turkey.z, { n: 14 });
    }

    // HUD
    const near = Math.max(0, Math.min(1, 1 - (d - FIND.foundDist) / FIND.bpmFar));
    g.hud.bpm = FIND.bpmMin + (FIND.bpmMax - FIND.bpmMin) * Math.pow(near, 1.4);
    g.hud.time = g.t; g.hud.stamina = player.stamina;
  };

  g.carryOut = () => ({ player: { x: player.x, z: player.z, heading: player.heading }, turkey: { x: turkey.x, z: turkey.z, heading: turkey.heading } });
  return g;
}
