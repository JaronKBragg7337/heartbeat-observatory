// Hired pilot orders live on the authority, and each owned ship has its own Phobos and Deimos pad.
// Run from test/validate.mjs. The two-client part uses a real WebSocket server on a free port.
import '../server/runtime.mjs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Authority, CREW_HALL } from '../server/authority.mjs';
import { startServer } from '../server/index.mjs';
import { FileAdapter } from '../server/storage.mjs';
import { makeMoon } from '../src/space/moonField.js';
import { SpaceSystem } from '../src/space/spaceSystem.js';
import { STANDOFF_M } from '../src/space/spaceSpec.js';
import { TestClient } from './multiplayer-checks.mjs';

const mem = () => { const m = { rec: null, bricks: [], load: async () => (m.rec ? { record: structuredClone(m.rec), bricks: [] } : { record: null, bricks: [] }), save: async (r) => { m.rec = r; } }; return m; };
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

function dirOf(body, eastM, northM) {
  const pi = body.padInfo, p = pi.point, e = pi.east, n = pi.north;
  const x = p.x + e.x * eastM + n.x * northM, y = p.y + e.y * eastM + n.y * northM, z = p.z + e.z * eastM + n.z * northM;
  const l = Math.hypot(x, y, z);
  return { x: x / l, y: y / l, z: z / l };
}

function seatPilot(world, player) {
  const ship = world.state.ships[player.shipId];
  const sim = world.sims.get(ship.id);
  const crew = ship.crew[0];
  const seat = sim.def.seats.find((s) => s.id === 'pilot');
  crew.status = 'aboard';
  crew.displaced = false;
  crew.seatPose = { x: seat.x, y: seat.y, z: seat.z, yaw: (seat.yaw || 0) * Math.PI / 180 };
  player.aboardShipId = ship.id;
  player.currentShipId = ship.id;
  player.pose.aboard = true;
  player.pose.seat = null;
  player.pose.sw = { x: 0, y: 1, z: 4, yaw: 0, pitch: 0 };
  player.frameId = sim.frameId;
  return { ship, sim, crew };
}

export async function runGrok4Checks({ check, section }) {
  section('29. Pilot orders on the server, and a pad of your own on each moon');
  const NOW = 1_800_000_000_000;
  let clock = NOW;
  const adapter = mem();
  const world = await new Authority(adapter, { now: () => clock }).load();
  const pl = await world.join('g'.repeat(48), 'Jaron');
  const guest = await world.join('h'.repeat(48), 'Lilith');
  const ship = world.state.ships[pl.shipId];
  const other = world.state.ships[guest.shipId];
  const ph = makeMoon('phobos'), dm = makeMoon('deimos');

  check('two ships get different Phobos pads and different Deimos pads, and neither pad is the survey site',
    ship.moonPads.phobos.id !== other.moonPads.phobos.id && ship.moonPads.deimos.id !== other.moonPads.deimos.id &&
    ship.moonPads.phobos.shipId === ship.id && other.moonPads.phobos.shipId === other.id &&
    Math.hypot(ship.moonPads.phobos.east - other.moonPads.phobos.east, ship.moonPads.phobos.north - other.moonPads.phobos.north) > 50 &&
    Math.hypot(ship.moonPads.deimos.east - other.moonPads.deimos.east, ship.moonPads.deimos.north - other.moonPads.deimos.north) > 50 &&
    ship.moonPads.phobos.north >= 260 && Math.hypot(ship.moonPads.phobos.east, ship.moonPads.phobos.north) > 200);

  const flatWithin = (body, pad) => {
    const pp = body.playerPad(pad.east, pad.north);
    const centre = body.surfaceRadius(pp.up.x, pp.up.y, pp.up.z);
    let worst = 0;
    for (const de of [-15, 0, 15]) for (const dn of [-15, 0, 15]) {
      const x = pp.point.x + pp.east.x * de + pp.north.x * dn;
      const y = pp.point.y + pp.east.y * de + pp.north.y * dn;
      const z = pp.point.z + pp.east.z * de + pp.north.z * dn;
      const l = Math.hypot(x, y, z), dir = { x: x / l, y: y / l, z: z / l };
      const cosp = dir.x * pp.up.x + dir.y * pp.up.y + dir.z * pp.up.z;
      const got = body.surfaceRadius(dir.x, dir.y, dir.z);
      worst = Math.max(worst, Math.abs(got - centre / cosp));
    }
    const rock = body.rockRelief(pp.up.x, pp.up.y, pp.up.z);
    const shade = body.cavityShade(pp.point.x, pp.point.y, pp.point.z);
    return { worst, rock, shade, pp };
  };
  const mine = flatWithin(ph, ship.moonPads.phobos);
  const theirs = flatWithin(ph, other.moonPads.phobos);
  const deimosPad = flatWithin(dm, ship.moonPads.deimos);
  check('a Phobos pad is a plane to 5 cm, with no loose rock, and the neighbouring pad is too',
    mine.worst < 0.05 && mine.rock === 0 && mine.shade === 1 && theirs.worst < 0.05 && theirs.rock === 0 && dist(mine.pp.point, theirs.pp.point) > 50,
    `worst ${mine.worst.toFixed(3)} rock ${mine.rock} apart ${dist(mine.pp.point, theirs.pp.point).toFixed(1)}`);
  check('a Deimos pad is a plane to 5 cm and still has no loose rock',
    deimosPad.worst < 0.05 && deimosPad.rock === 0, `worst ${deimosPad.worst.toFixed(3)} rock ${deimosPad.rock}`);

  // the tallest loose rock between 90 m and 400 m of the pad (the layout of the stones changed with the angular rocks: find one, do not hard-code it)
  let stoneRock = -1;
  for (let e = 90; e <= 400; e += 5) for (let n = -100; n <= 200; n += 5) { const d = dirOf(ph, e, n); stoneRock = Math.max(stoneRock, ph.rockRelief(d.x, d.y, d.z)); }
  const survey = dirOf(ph, 20, -12);
  check('the survey pad and the photographed boulder are not planed off by a player pad',
    ph.rockRelief(survey.x, survey.y, survey.z) === 0 && stoneRock >= 0.25, `boulder ${stoneRock.toFixed(2)}`);

  const sim = world.sims.get(ship.id);
  const solo = SpaceSystem.prototype.resolve.call(sim, 'phobos');
  const soloGoal = solo.goalS();
  const surveyStand = ph.standoffPoint(STANDOFF_M);
  const own = sim.resolve('phobos');
  const ownGoal = own.goalS();
  const ownStand = ph.playerPad(ship.moonPads.phobos.east, ship.moonPads.phobos.north).standoff(STANDOFF_M);
  const c = ph.centre;
  check('solo still aims at the survey pad; the shared ship aims at its own pad',
    dist(soloGoal, { x: c.x + surveyStand.x, y: c.y + surveyStand.y, z: c.z + surveyStand.z }) < 1 &&
    dist(ownGoal, { x: c.x + ownStand.x, y: c.y + ownStand.y, z: c.z + ownStand.z }) < 1 &&
    dist(soloGoal, ownGoal) > 100 && /pad 01/.test(own.name));

  const onPad = mine.pp.point;
  const aside = { x: onPad.x + mine.pp.north.x * 80, y: onPad.y + mine.pp.north.y * 80, z: onPad.z + mine.pp.north.z * 80 };
  check('spoil cannot be poured on your moon pad, and it can be poured off it',
    world.canPlaceSpoil('phobos', onPad.x, onPad.y, onPad.z) === false && world.canPlaceSpoil('phobos', aside.x, aside.y, aside.z) === true);

  // Hire for real, then put the pilot in the chair. The player stays out of that seat.
  pl.pose.worldPos = world.site.toWorld(CREW_HALL.door.x, 0.02, CREW_HALL.door.z);
  const pilot = Object.values(world.state.pool).find((c0) => c0.role === 'pilot' && !c0.shipId);
  const met = await world.action(pl.id, 'meet-pilot01', { type: 'meet', id: pilot.id });
  world.advance(25);
  pl.pose.worldPos = world.site.toWorld(pilot.position.x, 0.02, pilot.position.z + 1);
  const hired = await world.action(pl.id, 'hire-pilot01', { type: 'hire', id: pilot.id });
  check('the pilot can be hired, then seated, without the player taking the chair', met.ok === true && hired.ok === true, met.msg || hired.msg);
  seatPilot(world, pl);

  const orders = [
    ['hunt-order01', { type: 'crew-order', order: 'hunt' }, 'hunt', /Hunting/],
    ['supply-order1', { type: 'crew-order', order: 'supply' }, 'supply', /Supply/],
    ['roam-order001', { type: 'crew-order', order: 'roam' }, 'roam', /wander/i],
    ['return-order1', { type: 'crew-order', order: 'return' }, 'return', /pad/i],
    ['land-order001', { type: 'crew-order', order: 'land' }, 'land', /down/i],
  ];
  let orderOk = true, orderMsg = '';
  for (const [id, action, key, re] of orders) {
    const r = await world.action(pl.id, id, action);
    if (!r.ok || r.same || ship.orderKey !== key || !re.test(r.msg || '')) { orderOk = false; orderMsg = `${key} ${r.msg} key=${ship.orderKey}`; break; }
    world.advance(1.2);
  }
  check('hunt, supplies, roam, return and land are accepted as one order each', orderOk, orderMsg);

  const held = await world.action(pl.id, 'hold-order001', { type: 'crew-order', order: 'hold' });
  check('hold clears the order key', held.ok === true && ship.orderKey == null, `key=${ship.orderKey} ${held.msg}`);

  const away = await world.action(guest.id, 'guest-order01', { type: 'crew-order', order: 'roam' });
  check('a player who is not aboard cannot give the order', away.ok === false && /aboard/i.test(away.msg), away.msg);

  const liveShip = () => world.state.ships[pl.shipId];
  const liveSim = () => world.sims.get(pl.shipId);
  const hunt = await world.action(pl.id, 'hunt-fly-0001', { type: 'crew-order', order: 'hunt' });
  const tBefore = liveSim().crew.ap?.t || 0;
  const again = await world.action(pl.id, 'hunt-fly-0002', { type: 'crew-order', order: 'hunt' });
  check('the same order a second time does not start another one',
    hunt.ok === true && again.ok === true && again.same === true && liveShip().orderKey === 'hunt' && (liveSim().crew.ap?.t || 0) >= tBefore,
    `same=${again.same} key=${liveShip().orderKey} t ${tBefore}->${liveSim().crew.ap?.t} ${again.msg}`);
  const posed = { ...liveSim().flight.pos };
  await world.commit();
  const later = clock + 18000;
  const caught = await new Authority(adapter, { now: () => later }).load();
  const flown = caught.sims.get(ship.id);
  check('a restart keeps the hunt and flies it while the ship was still on the ground',
    hunt.ok === true && caught.state.ships[ship.id].orderKey === 'hunt' &&
    (flown.flight.agl > 8 || !flown.flight.landed) && dist(flown.flight.pos, posed) > 5,
    `agl ${flown.flight.agl?.toFixed?.(1)} landed ${flown.flight.landed} moved ${dist(flown.flight.pos, posed).toFixed(1)}`);

  // Descent onto the pad, then a reload puts the ship back on that same pad.
  clock = later;
  const pad = caught.state.ships[ship.id].moonPads.phobos;
  const body = makeMoon('phobos');
  const pp = body.playerPad(pad.east, pad.north);
  const start = pp.standoff(15);
  flown.setFrame('phobos');
  flown.flight.attitude = null;
  flown.flight.pitch = 0;
  flown.flight.roll = 0;
  flown.flight.pos = { ...start };
  flown.flight.vel = { x: 0, y: 0, z: 0 };
  flown.flight.landed = false;
  flown.flight.airborne = true;
  flown.flight.autoHover = true;
  flown.flight.thrustDown = true;
  flown.flight.gearPos = 1;
  flown.flight.climbCap = 12;
  flown.flight.refreshOrientation();
  let landed = false;
  for (let i = 0; i < 1200; i++) {
    flown.flight.thrustDown = true;
    flown.flight.autoHover = true;
    flown.step(1 / 30, { fwd: 0, lift: -1, yaw: 0 });
    if (flown.flight.landed && i > 20) { landed = true; break; }
  }
  const rel = { x: flown.flight.pos.x - pp.point.x, y: flown.flight.pos.y - pp.point.y, z: flown.flight.pos.z - pp.point.z };
  const horiz = Math.hypot(rel.x * pp.east.x + rel.y * pp.east.y + rel.z * pp.east.z, rel.x * pp.north.x + rel.y * pp.north.y + rel.z * pp.north.z);
  check('a descent from 15 m sets down on that ship\'s pad', landed && horiz < 8, `landed ${landed} horiz ${horiz.toFixed(2)} agl ${flown.flight.agl?.toFixed?.(2)}`);
  await caught.commit();
  const back = await new Authority(adapter, { now: () => clock }).load();
  const home = back.sims.get(ship.id);
  check('a refresh returns the ship to its own pad',
    back.state.ships[ship.id].moonPads.phobos.id === pad.id && home.frameId === 'phobos' && dist(home.flight.pos, flown.flight.pos) < 3,
    `frame ${home.frameId} moved ${dist(home.flight.pos, flown.flight.pos).toFixed(2)}`);

  // Two clients watch one order.
  const dir = await mkdtemp(join(tmpdir(), 'cosmos-grok4-'));
  let app, a, b;
  try {
    app = await startServer({ adapter: new FileAdapter(join(dir, 'world.json')), port: 0, tick: false, now: () => Date.now() });
    a = new TestClient(app.url, 'a'.repeat(48), 'Jaron');
    b = new TestClient(app.url, 'b'.repeat(48), 'Lilith');
    await a.connect();
    await b.connect();
    const w = app.world;
    const pa = w.state.players[a.id], pb = w.state.players[b.id];
    const sa = w.state.ships[pa.shipId], sb = w.state.ships[pb.shipId];
    check('both clients are told the two moon pads, and the pads are not the same',
      a.state.ships[sa.id].moonPads.phobos.id !== b.state.ships[sb.id].moonPads.phobos.id &&
      a.state.ships[sa.id].moonPads.deimos.number === '01' && b.state.ships[sb.id].moonPads.phobos.number === '02');
    await w.enqueue(async () => {
      pa.pose.worldPos = w.site.toWorld(CREW_HALL.door.x, 0.02, CREW_HALL.door.z);
    });
    const poolPilot = Object.values(w.state.pool).find((c0) => c0.role === 'pilot' && !c0.shipId);
    const met2 = await a.action({ type: 'meet', id: poolPilot.id }, 'meet-pilot02');
    await w.enqueue(() => { w.advance(25); });
    const liveA = () => w.state.players[a.id];
    const liveB = () => w.state.players[b.id];
    await w.enqueue(async () => {
      liveA().pose.worldPos = w.site.toWorld(poolPilot.position.x, 0.02, poolPilot.position.z + 1);
    });
    const hired2 = await a.action({ type: 'hire', id: poolPilot.id }, 'hire-pilot02');
    await w.enqueue(async () => { seatPilot(w, liveA()); });
    const refused = await b.action({ type: 'crew-order', order: 'goto', args: { id: 'tower' } }, 'watch-order01');
    const first = await a.action({ type: 'crew-order', order: 'goto', args: { id: 'tower' } }, 'goto-tower01');
    await w.enqueue(() => { w.advance(8); });
    const simA = () => w.sims.get(sa.id);
    const t0 = simA().crew.ap?.t || 0;
    const p0 = { ...simA().flight.pos };
    await w.enqueue(async () => {
      const q = liveB();
      q.aboardShipId = sa.id; q.currentShipId = sa.id; q.pose.aboard = true; q.pose.seat = 'nav'; q.frameId = 'mars';
      q.pose.sw = { x: 1, y: 1, z: 2, yaw: 0, pitch: 0 };
    });
    const second = await b.action({ type: 'crew-order', order: 'goto', args: { id: 'tower' } }, 'goto-tower02');
    const t1 = simA().crew.ap?.t || 0;
    await w.enqueue(() => { w.advance(12); });
    const replay = await a.action({ type: 'crew-order', order: 'goto', args: { id: 'tower' } }, 'goto-tower01');
    const fromA = a.messages.length, fromB = b.messages.length;
    a.send({ type: 'checkpoint' });
    await a.wait((m) => m.type === 'state' && m.state.revision >= w.state.revision, fromA);
    await b.wait((m) => m.type === 'state' && m.state.revision >= w.state.revision, fromB);
    const seenA = a.state.ships[sa.id], seenB = b.state.ships[sa.id];
    const moved = dist(simA().flight.pos, p0);
    check('the owner and a second player aboard see one flight, and a watcher who is not aboard is refused',
      met2.ok === true && hired2.ok === true && refused.ok === false && /aboard/i.test(refused.msg) &&
      first.ok === true && second.ok === true && second.same === true && replay.replay === true && t1 >= t0 && moved > 15 &&
      seenA.orderKey === seenB.orderKey && dist(seenA.pose.pos, seenB.pose.pos) < 0.01 && dist(seenA.pose.pos, p0) > 15,
      `met ${met2.msg} hire ${hired2.msg} refused ${refused.msg} first ${first.msg} second ${second.msg} replay ${replay.replay} t ${t0}->${t1} moved ${moved.toFixed(1)} key ${seenA?.orderKey}`);
  } finally {
    a?.close(); b?.close();
    if (app) await app.close();
    await rm(dir, { recursive: true, force: true });
  }
}
