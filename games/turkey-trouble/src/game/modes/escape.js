// Mode 4, ESCAPE THE FARM. You are the turkey. Past the farmer and the dog, out the south gate, then every lane in order:
// tractors, a creek of drifting logs, roads. Hits send you back to that lane's north edge and only count.
// After the last road the game takes the turkey for a little walk (the ending lives here as rules, the card in the UI).
import { makeBase, makePath, dist, DT } from './common.js';
import { stepMover, makeMover, followPath, stepToward, turnToward } from '../mover.js';
import { TURKEY_PLAYER as TP, ESCAPE as E, PERSON, ENDING_LINES } from '../tuning.js';

export function createEscape(layout, opts = {}) {
  const g = makeBase(layout, opts, 'escape');
  const { world, nav, rng, emit } = g;
  const esc = layout.escape;
  const run = opts.run || 0;
  const start = layout.spawns.escapeStart;
  const me = makeMover(start.x, start.z, start.rotY || 0, TP);
  Object.assign(me, { y: 0, hopT: 0, hopCd: 0, hdx: 0, hdz: 0, invuln: 0, stun: 0, wet: 0, onLog: null, onStone: false, anim: 'idle', animT: 0 });
  g.player = me; g.turkey = me;           // the turkey IS the player here
  g.hits = 0; g.splashes = 0; g.run = run;
  g.hud.label = 'Escape the Farm'; g.hud.action = 'Flap'; g.hud.arrow = true;
  const sizes = layout.sizes;
  const corridor = esc.corridor, spawnX = esc.spawnX;
  const arena = layout.arena, bounds = layout.bounds;
  const gateFence = layout.fences;

  // ---- lanes and their pooled movers (vehicles and logs)
  const lanes = esc.lanes.map((l, i) => ({ ...l, index: i, subs: [] }));
  g.lanes = lanes;
  g.vehicles = [];                         // flat list, for the view's pool
  for (const lane of lanes) {
    if (!lane.sublanes) continue;
    for (const sl of lane.sublanes) {
      const kind = sl.vehicle, sz = sizes[kind] || { w: 2, l: 5 };
      const sub = { ...sl, lane, list: [], rear: null, w: sz.w, isLog: kind === 'log' };
      const L = () => (sub.isLog ? rng.range(sz.lMin, sz.lMax) : sz.l);
      // fill the whole road from one spawn edge to the other, spaced by the gaps
      let l = L();
      let x = sub.dir > 0 ? spawnX - rng.range(0, sl.gapMax) : -spawnX + rng.range(0, sl.gapMax);
      while (Math.abs(x) <= spawnX + l) {
        const v = { kind, x, z: sl.z, l, w: sub.w, dir: sub.dir, sub, id: g.vehicles.length, honked: false, wheel: 0 };
        sub.list.push(v); g.vehicles.push(v); sub.rear = v;
        const nl = L(); x -= sub.dir * (l / 2 + rng.range(sl.gapMin, sl.gapMax) + nl / 2); l = nl;
      }
      lane.subs.push(sub);
    }
  }
  let cleared = 0;                          // lanes cleared, in order
  g.cleared = 0;
  // faster with every lane and every new run, but capped so a run is always crossable
  const speedUp = () => Math.min(E.speedCap, (1 + E.speedPerLane * cleared) * (1 + E.speedPerRun * run));
  g.speedUp = speedUp;

  function laneAt(z) { for (const l of lanes) if (z >= l.z0 - 0.5 && z <= l.z1 + 0.5) return l; return null; }

  // ---- the farmer and the dog
  const F = esc.farmer;
  const farmer = makeMover(F.patrol[0].x, F.patrol[0].z, 0, { r: PERSON.r });
  Object.assign(farmer, { state: 'patrol', wp: 1, lostT: 0, timer: 0, replan: 0, anim: 'walk' });
  g.farmer = farmer;
  const fPath = makePath();
  const D = esc.dog;
  const dog = makeMover(D.home.x, D.home.z, Math.PI, { r: 0.3 });
  Object.assign(dog, { state: 'sleep', timer: 0, replan: 0, chaseT: 0, anim: 'sleep' });
  g.dog = dog;
  const dPath = makePath();
  const farmClamp = (m, r) => world.clampArena(m, r);

  // the turkey stays in the yard (only the south gate opens), then inside the corridor
  function meClamp(m, r) {
    if (m.z < 0.4) {
      if (m.x < arena.minX + r) m.x = arena.minX + r; if (m.x > arena.maxX - r) m.x = arena.maxX - r;
      if (m.z < arena.minZ + r) m.z = arena.minZ + r;
    } else {
      if (m.x < corridor.minX + r) m.x = corridor.minX + r; if (m.x > corridor.maxX - r) m.x = corridor.maxX - r;
    }
    if (m.z > bounds.maxZ - r) m.z = bounds.maxZ - r;
  }

  function setAnim(a) { if (me.anim !== a) { me.anim = a; me.animT = 0; } }
  function sendBack(z, why) {
    g.hits++;
    if (why === 'splash') g.splashes++;
    emit(why === 'splash' ? 'splash' : 'hit', me.x, me.z, { why });
    emit('feathers', me.x, me.z, { n: why === 'splash' ? 6 : 16, y: 0.5 });
    me.z = z; me.vx = me.vz = 0; me.kx = me.kz = 0; me.hopT = 0; me.y = 0; me.wet = 0; me.onLog = null;
    me.invuln = TP.invuln; me.stun = TP.stunAfterHit;
    const p = world.freeSpot(me.x, me.z, TP.r); me.x = p.x; me.z = p.z;
    if (me.z < 0) { me.x = start.x; me.z = start.z; }
    setAnim(why === 'splash' ? 'splash' : 'startled');
  }
  function caughtInYard(who) {
    g.hits++;
    emit('netted', me.x, me.z, { who }); emit('feathers', me.x, me.z, { n: 16, y: 0.5 });
    me.x = start.x; me.z = start.z; me.vx = me.vz = 0; me.hopT = 0; me.y = 0;
    me.invuln = TP.invuln; me.stun = TP.stunAfterHit; setAnim('startled');
    farmer.state = 'return'; farmer.timer = 0; dog.state = 'return';
  }

  // ---- the ending (rules side): the walk to the door and the two knocks
  const ending = { t: 0, stage: 'walk', path: makePath(8), knocks: 0, lines: ENDING_LINES };
  g.ending = ending;
  function startEnding() {
    g.phase = 'ending';
    const fp = esc.finish.path;
    ending.path.n = 0;
    for (const p of fp) { const q = ending.path.pts[ending.path.n++]; q.x = p.x; q.z = p.z; }
    // stop a beak's length short of the door so the knock lands on it, not through it
    const door = esc.finish.door, last = ending.path.pts[ending.path.n - 1], ry = door.rotY || 0;
    last.x = door.x - Math.sin(ry) * E.knockGap; last.z = door.z - Math.cos(ry) * E.knockGap;
    ending.path.i = 0; ending.t = 0; ending.stage = 'walk';
    // already past a point of the path? skip ahead (never walk backward)
    const P = ending.path;
    while (P.i < P.n - 1) {
      const a = P.pts[P.i], b = P.pts[P.i + 1];
      if (Math.hypot(b.x - me.x, b.z - me.z) < Math.hypot(b.x - a.x, b.z - a.z)) P.i++; else break;
    }
    ending.leg0 = Math.hypot(P.pts[P.i].x - me.x, P.pts[P.i].z - me.z);
    me.hopT = 0; me.y = 0; me.onLog = null;
    emit('ending', me.x, me.z);
  }

  g.step = function step(input) {
    g.steps++; me.animT += DT;
    if (g.phase === 'ending') return stepEnding();
    if (g.phase !== 'play') return;
    g.t += DT;
    const su = speedUp();

    moveTraffic(su);

    // ---- you
    if (me.invuln > 0) me.invuln -= DT;
    if (me.hopCd > 0) me.hopCd -= DT;
    let mx = input.mx, mz = input.mz;
    if (me.stun > 0) { me.stun -= DT; mx = mz = 0; }
    if (me.onLog) { me.x += me.onLog.dir * me.onLog.sub.speed * su * DT; }    // the log carries you
    if (me.hopT > 0) {
      me.hopT -= DT;
      const k = 1 - me.hopT / TP.hopTime; me.y = Math.sin(Math.PI * Math.min(1, k)) * TP.hopHeight;
      stepToward(me, me.x + me.hdx * 3, me.z + me.hdz * 3, TP.hopSpeed, world, meClamp, 14);
      if (me.hopT <= 0) { me.y = 0; me.hopCd = TP.hopCooldown; emit('land', me.x, me.z); }
      setAnim('hop');
    } else {
      stepMover(me, mx, mz, input.run, world, meClamp);
      if (input.action && me.hopCd <= 0 && me.stun <= 0) {
        const m = Math.hypot(mx, mz);
        me.hdx = m > 0.2 ? mx / m : Math.sin(me.heading); me.hdz = m > 0.2 ? mz / m : Math.cos(me.heading);
        me.heading = Math.atan2(me.hdx, me.hdz);
        me.hopT = TP.hopTime; me.onLog = null; emit('flap', me.x, me.z);
      }
      if (me.stun <= 0) setAnim(me.onLog ? (me.speed > 0.5 ? 'walk' : 'ride') : me.speed > 3.6 ? 'run' : me.speed > 0.3 ? 'walk' : 'idle');
    }
    const airborne = me.hopT > 0;

    // ---- the lane you are in
    const lane = laneAt(me.z);
    me.onLog = airborne ? null : me.onLog;
    if (lane && lane.kind === 'creek' && !airborne) {
      const rows = lane.subs;
      const wz0 = rows[0].z - rows[0].w / 2 - E.logPadZ, wz1 = rows[rows.length - 1].z + rows[rows.length - 1].w / 2 + E.logPadZ;
      if (me.z > wz0 && me.z < wz1) {
        let support = null;
        for (const sub of rows) {
          if (Math.abs(me.z - sub.z) > sub.w / 2 + E.logPadZ) continue;
          for (const v of sub.list) if (Math.abs(me.x - v.x) < v.l / 2 + E.logPadX) { support = v; break; }
          if (support) break;
        }
        let stone = false;
        if (!support && lane.stones) for (const s of lane.stones) if (Math.hypot(me.x - s.x, me.z - s.z) < E.stoneR) { stone = true; break; }
        me.onLog = support; me.onStone = stone;
        // (a log that drifts past the corridor edge leaves you behind: the clamp holds you, the log goes on, you fall in)
        if (!support && !stone) { me.wet += DT; if (me.wet > TP.waterGrace) sendBack(lane.z0 - 1.0, 'splash'); }
        else me.wet = 0;
      } else { me.onLog = null; me.wet = 0; }
    } else if (!airborne) { me.onLog = null; me.wet = 0; }

    if (lane && lane.subs.length && lane.kind !== 'creek') {
      for (const sub of lane.subs) {
        const dz = Math.abs(me.z - sub.z);
        if (dz > sub.w / 2 + E.nearMissZ + 1) continue;
        for (const v of sub.list) {
          const dx = Math.abs(me.x - v.x);
          if (dz < sub.w / 2 + TP.r && dx < v.l / 2 + TP.r) { if (me.invuln <= 0) { sendBack(lane.z0 - 1.0, 'hit'); emit('horn', v.x, v.z, { kind: v.kind }); } break; }
          if (!v.honked && dz < sub.w / 2 + E.nearMissZ && dx < v.l / 2 + E.nearMissX) { v.honked = true; emit('horn', v.x, v.z, { kind: v.kind, near: 1 }); }
        }
      }
    }

    // ---- lanes cleared in order
    while (cleared < lanes.length && me.z > lanes[cleared].z1 + 0.5) {
      emit('lane', me.x, me.z, { id: lanes[cleared].id, n: cleared + 1 });
      cleared++; g.cleared = cleared;
    }
    if (cleared >= lanes.length && me.z > lanes[lanes.length - 1].z1 + 0.5) { startEnding(); return; }

    stepFarmer(); stepDog();
    g.hud.time = g.t; g.hud.hits = g.hits; g.hud.cleared = cleared;
  };

  function moveTraffic(su) {
    // traffic and logs move first, so riding is exact
    for (const lane of lanes) for (const sub of lane.subs) {
      const vx = sub.dir * sub.speed * su;
      for (let i = 0; i < sub.list.length; i++) {
        const v = sub.list[i];
        v.x += vx * DT; v.wheel += (vx * DT) / 0.42;
        const out = sub.dir > 0 ? v.x - v.l / 2 > spawnX : v.x + v.l / 2 < -spawnX;
        if (out) {           // recycle behind the rearmost one
          const r = sub.rear;
          if (sub.isLog) v.l = rng.range(sizes.log.lMin, sizes.log.lMax);
          v.x = r.x - sub.dir * (r.l / 2 + rng.range(sub.gapMin, sub.gapMax) + v.l / 2);
          if (Math.abs(v.x) < spawnX) v.x = -sub.dir * (spawnX + v.l / 2);
          v.honked = false; sub.rear = v;
        }
      }
    }

  }

  function stepFarmer() {
    farmer.replan -= DT;
    const inYard = me.z < 0.4;
    const d = dist(farmer, me);
    const fx = Math.sin(farmer.heading), fz = Math.cos(farmer.heading);
    const cone = d > 1e-3 ? ((me.x - farmer.x) * fx + (me.z - farmer.z) * fz) / d : 1;
    const sees = inYard && me.invuln <= 0 && d < F.sees && (cone > E.farmerCone || d < E.farmerHear) && world.losClear(farmer.x, farmer.z, me.x, me.z, 1.0);
    switch (farmer.state) {
      case 'patrol': {
        const wp = F.patrol[farmer.wp];
        if (farmer.replan <= 0) { nav.findPath(farmer.x, farmer.z, wp.x, wp.z, fPath); fPath.i = 0; farmer.replan = 2; }
        if (followPath(farmer, fPath, F.speed, world, farmClamp, 5)) { farmer.wp = (farmer.wp + 1) % F.patrol.length; farmer.replan = 0; }
        farmer.anim = 'walk';
        if (sees) { farmer.state = 'chase'; farmer.lostT = 0; emit('spotted', farmer.x, farmer.z); farmer.replan = 0; }
        break;
      }
      case 'chase': {
        if (sees) farmer.lostT = 0; else farmer.lostT += DT;
        if (!inYard || farmer.lostT > E.farmerLose || me.invuln > 0) { farmer.state = 'return'; farmer.replan = 0; emit('farmerGivesUp', farmer.x, farmer.z); break; }
        if (farmer.replan <= 0) { nav.findPath(farmer.x, farmer.z, me.x, me.z, fPath); fPath.i = 0; farmer.replan = 0.3; }
        followPath(farmer, fPath, E.farmerChase, world, farmClamp, 8);
        farmer.anim = 'run';
        if (d < F.netReach + 0.3) { farmer.state = 'swing'; farmer.timer = E.netWind; emit('swing', farmer.x, farmer.z); }
        break;
      }
      case 'swing':
        farmer.speed = 0; farmer.anim = 'swing';
        farmer.heading = turnToward(farmer.heading, Math.atan2(me.x - farmer.x, me.z - farmer.z), 8 * DT);
        if ((farmer.timer -= DT) <= 0) {
          if (dist(farmer, me) < F.netReach + 0.2 && me.invuln <= 0 && me.hopT <= 0) caughtInYard('farmer');
          else { farmer.state = 'chase'; emit('netMiss', farmer.x, farmer.z); }
        }
        break;
      case 'return': {
        let best = 0, bd = 1e9;
        F.patrol.forEach((p, i) => { const dd = Math.hypot(p.x - farmer.x, p.z - farmer.z); if (dd < bd) { bd = dd; best = i; } });
        farmer.wp = best; farmer.state = 'patrol'; farmer.replan = 0;
        break;
      }
    }
  }

  function stepDog() {
    dog.replan -= DT;
    const d = dist(dog, me);
    switch (dog.state) {
      case 'sleep':
        dog.speed = 0; dog.anim = 'sleep';
        if (d < D.wakes && me.z < D.givesUpZ && me.invuln <= 0) { dog.state = 'wake'; dog.timer = E.dogWake; emit('bark', dog.x, dog.z); }
        break;
      case 'wake':
        dog.anim = 'wake'; dog.heading = turnToward(dog.heading, Math.atan2(me.x - dog.x, me.z - dog.z), 8 * DT);
        if ((dog.timer -= DT) <= 0) { dog.state = 'chase'; dog.chaseT = 0; dog.replan = 0; }
        break;
      case 'chase':
        dog.chaseT += DT; dog.anim = 'run';
        if (me.z > D.givesUpZ || dog.chaseT > E.dogChaseMax || me.invuln > 0) { dog.state = 'return'; dog.replan = 0; emit('dogGivesUp', dog.x, dog.z); break; }
        if (dog.replan <= 0) { nav.findPath(dog.x, dog.z, me.x, me.z, dPath); dPath.i = 0; dog.replan = 0.25; }
        followPath(dog, dPath, D.speed, world, farmClamp, 12);
        if (d < E.dogCatch && me.hopT <= 0) caughtInYard('dog');
        else if (dog.chaseT % 1.2 < DT) emit('bark', dog.x, dog.z);
        break;
      case 'return':
        dog.anim = 'walk';
        if (dog.replan <= 0) { nav.findPath(dog.x, dog.z, D.home.x, D.home.z, dPath); dPath.i = 0; dog.replan = 3; }
        if (followPath(dog, dPath, E.dogHome, world, farmClamp, 6)) { dog.state = 'sleep'; dog.heading = Math.PI; }
        break;
    }
  }

  function stepEnding() {
    ending.t += DT;
    moveTraffic(speedUp());
    if (ending.stage === 'walk') {
      const p = ending.path;
      const tgt = p.pts[Math.min(p.i, p.n - 1)];
      const dx = tgt.x - me.x, dz = tgt.z - me.z, d = Math.hypot(dx, dz);
      // a brisk first leg from wherever you crossed, then a proud strut up the path
      const sp = p.i === 0 && p.n > 1 ? Math.max(E.endWalk, ending.leg0 / 3.2) : E.endWalk;
      const s = Math.min(d, sp * DT);
      me.px = me.x; me.pz = me.z;
      if (d > 1e-4) { me.x += (dx / d) * s; me.z += (dz / d) * s; me.heading = turnToward(me.heading, Math.atan2(dx, dz), 6 * DT); }
      me.speed = s / DT; me.y = 0;
      me.anim = 'walk';
      if (d < 0.05) { p.i++; if (p.i >= p.n) { ending.stage = 'knock'; ending.t = 0; me.speed = 0; } }
    } else if (ending.stage === 'knock') {
      const door = esc.finish.door;
      me.heading = turnToward(me.heading, door.rotY != null ? door.rotY : 0, 6 * DT);
      me.anim = 'knock';
      if (ending.knocks === 0 && ending.t >= E.knock1) { ending.knocks = 1; emit('knock', me.x, me.z, { n: 1 }); }
      if (ending.knocks === 1 && ending.t >= E.knock2) { ending.knocks = 2; emit('knock', me.x, me.z, { n: 2 }); }
      if (ending.t >= E.cardAt) {
        ending.stage = 'card'; g.phase = 'done';
        g.result = { win: true, time: g.t, title: '', ending: true, lines: ENDING_LINES, hits: g.hits };
        emit('card', me.x, me.z);
      }
    }
  }

  return g;
}
