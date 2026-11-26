// Mode 2, IT HUNTS YOU. The turkey path-finds after you, charges in bursts, loses you behind cover and searches.
// A peck costs one of three hearts. Survive 75 s.
import { makeBase, makePath, dist, DT } from './common.js';
import { stepMover, makeMover, followPath, stepToward, turnToward } from '../mover.js';
import { HUNTED } from '../tuning.js';

export function createHunted(layout, opts = {}) {
  const g = makeBase(layout, opts, 'hunted');
  const { world, nav, rng, emit, player } = g;
  const st = (opts.carry && opts.carry.turkey) || layout.spawns.turkeyHunted;
  const tp = world.freeSpot(st.x, st.z, HUNTED.r);
  const turkey = makeMover(tp.x, tp.z, st.heading ?? st.rotY ?? 0, { r: HUNTED.r });
  Object.assign(turkey, { anim: 'startled', animT: 0, state: 'wake', timer: opts.carry ? HUNTED.wakeCarry : HUNTED.wake, chargeCd: 1.5, cdx: 0, cdz: 0, replan: 0, lostT: 0, seen: false, lastX: player.x, lastZ: player.z, lookT: 0 });
  g.turkey = turkey;
  g.hearts = HUNTED.hearts;
  let invuln = 1.0;
  const path = makePath();
  g.hud.label = 'It Hunts You';
  g.hud.hearts = g.hearts;
  emit('gobble', turkey.x, turkey.z, { loud: 1 });

  function setAnim(a) { if (turkey.anim !== a) { turkey.anim = a; turkey.animT = 0; } }
  function hitPlayer() {
    if (invuln > 0 || g.phase !== 'play') return false;
    g.hearts--; g.hud.hearts = g.hearts; invuln = HUNTED.invuln;
    const dx = player.x - turkey.x, dz = player.z - turkey.z, d = Math.max(0.2, Math.hypot(dx, dz));
    player.kx = (dx / d) * HUNTED.knock; player.kz = (dz / d) * HUNTED.knock;
    emit('peck', player.x, player.z, { hearts: g.hearts }); emit('feathers', turkey.x, turkey.z, { n: 6 });
    if (g.hearts <= 0) {
      g.phase = 'lost'; g.result = { win: false, time: g.t, title: 'Pecked!' };
      setAnim('gobble'); emit('lose', player.x, player.z);
    }
    return true;
  }
  function plan(tx, tz) { nav.findPath(turkey.x, turkey.z, tx, tz, path); path.i = 0; turkey.replan = HUNTED.replan; }

  g.step = function step(input) {
    g.steps++; turkey.animT += DT;
    if (g.phase !== 'play') { turkey.speed = 0; return; }
    g.t += DT;
    if (invuln > 0) invuln -= DT;
    stepMover(player, input.mx, input.mz, input.run, world, g.clampArena);

    const d = dist(player, turkey);
    const sees = d < HUNTED.sees && world.losClear(turkey.x, turkey.z, player.x, player.z, HUNTED.eyeH);
    if (sees) { turkey.lastX = player.x; turkey.lastZ = player.z; turkey.lostT = 0; if (!turkey.seen && turkey.state === 'search') { emit('gobble', turkey.x, turkey.z, { loud: 1 }); turkey.state = 'chase'; } turkey.seen = true; }
    else { turkey.lostT += DT; turkey.seen = false; }
    if (turkey.chargeCd > 0) turkey.chargeCd -= DT;
    turkey.replan -= DT;
    const face = Math.atan2(player.x - turkey.x, player.z - turkey.z);

    switch (turkey.state) {
      case 'wake':
        turkey.speed = 0; turkey.heading = turnToward(turkey.heading, face, 6 * DT);
        setAnim(turkey.animT < 0.7 ? 'startled' : 'gobble');
        if ((turkey.timer -= DT) <= 0) { turkey.state = 'chase'; plan(player.x, player.z); }
        break;
      case 'chase': {
        if (turkey.lostT > HUNTED.loseAfter) { turkey.state = 'search'; plan(turkey.lastX, turkey.lastZ); emit('lost', turkey.x, turkey.z); break; }
        if (turkey.replan <= 0) plan(sees ? player.x : turkey.lastX, sees ? player.z : turkey.lastZ);
        followPath(turkey, path, HUNTED.chase, world, g.clampArena, HUNTED.turn);
        setAnim('run');
        if (sees && d < HUNTED.chargeRange && d > HUNTED.chargeMin && turkey.chargeCd <= 0) {
          turkey.state = 'windup'; turkey.timer = HUNTED.windup; setAnim('charge'); emit('charge', turkey.x, turkey.z);
        } else if (d < HUNTED.peckRange) { turkey.state = 'peckWind'; turkey.timer = HUNTED.peckWind; setAnim('peck'); }
        break;
      }
      case 'windup':
        turkey.speed = 0; turkey.heading = turnToward(turkey.heading, face, 8 * DT);
        if ((turkey.timer -= DT) <= 0) {
          // lock the line now: aim a little ahead of where you are going
          const lx = player.x + player.vx * 0.25 - turkey.x, lz = player.z + player.vz * 0.25 - turkey.z, l = Math.max(1e-3, Math.hypot(lx, lz));
          turkey.cdx = lx / l; turkey.cdz = lz / l; turkey.heading = Math.atan2(turkey.cdx, turkey.cdz);
          turkey.state = 'charge'; turkey.timer = HUNTED.chargeTime;
        }
        break;
      case 'charge': {
        const want = HUNTED.chargeSpeed * DT;
        stepToward(turkey, turkey.x + turkey.cdx * 4, turkey.z + turkey.cdz * 4, HUNTED.chargeSpeed, world, g.clampArena, 0.5);
        setAnim('charge');
        if (dist(player, turkey) < HUNTED.chargeHit && hitPlayer()) { turkey.state = 'recover'; turkey.timer = HUNTED.recover; turkey.chargeCd = HUNTED.chargeCd + rng.range(-0.4, HUNTED.chargeCdJitter); break; }
        if (turkey.speed * DT < want * 0.45) { turkey.state = 'stunned'; turkey.timer = HUNTED.stun; turkey.chargeCd = HUNTED.chargeCd + rng.range(-0.4, HUNTED.chargeCdJitter); emit('bonk', turkey.x, turkey.z); emit('feathers', turkey.x, turkey.z, { n: 5 }); setAnim('startled'); break; }
        if ((turkey.timer -= DT) <= 0) { turkey.state = 'chase'; turkey.chargeCd = HUNTED.chargeCd + rng.range(-0.4, HUNTED.chargeCdJitter); plan(player.x, player.z); }
        break;
      }
      case 'stunned':
        turkey.speed = 0;
        if ((turkey.timer -= DT) <= 0) { turkey.state = 'chase'; plan(player.x, player.z); }
        break;
      case 'peckWind':
        turkey.speed = 0; turkey.heading = turnToward(turkey.heading, face, 10 * DT); setAnim('peck');
        if ((turkey.timer -= DT) <= 0) {
          if (dist(player, turkey) < HUNTED.peckHit) hitPlayer(); else emit('peckMiss', turkey.x, turkey.z);
          turkey.state = 'recover'; turkey.timer = HUNTED.recover;
        }
        break;
      case 'recover':
        turkey.speed = 0; setAnim(turkey.animT < 0.4 ? 'peck' : 'idle');
        if ((turkey.timer -= DT) <= 0) { turkey.state = 'chase'; plan(player.x, player.z); }
        break;
      case 'search': {
        if (sees) { turkey.state = 'chase'; plan(player.x, player.z); break; }
        const done = path.i >= path.n || followPath(turkey, path, HUNTED.search, world, g.clampArena, HUNTED.turn);
        setAnim(done ? 'idle' : 'walk');
        if (done) {
          turkey.lookT += DT;
          turkey.heading += Math.sin(turkey.lookT * 2.2) * 1.6 * DT;
          if (turkey.lookT > HUNTED.searchLook) {
            // gives up looking and listens: it heads for where you really are
            turkey.lookT = 0; turkey.state = 'chase'; turkey.lostT = 0; turkey.lastX = player.x; turkey.lastZ = player.z;
            plan(player.x, player.z); emit('gobble', turkey.x, turkey.z, { loud: 1 });
          }
        }
        break;
      }
    }

    if (g.phase === 'play' && g.t >= HUNTED.duration) {
      g.phase = 'won'; g.result = { win: true, time: g.t, title: 'You made it!' };
      turkey.state = 'tired'; setAnim('gobble'); emit('win', player.x, player.z);
    }
    g.hud.time = Math.max(0, HUNTED.duration - g.t); g.hud.stamina = player.stamina; g.hud.hearts = g.hearts;
    g.hud.invuln = invuln > 0;
  };
  g.carryOut = () => ({ player: { x: player.x, z: player.z, heading: player.heading }, turkey: { x: turkey.x, z: turkey.z, heading: turkey.heading } });
  return g;
}
