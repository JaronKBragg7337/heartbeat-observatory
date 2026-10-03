// Survey rover: the vehicle API, Mars and Phobos contact, and two clients watching one drive off the Meridian.
// Run from test/validate.mjs.

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../server/index.mjs';
import { FileAdapter } from '../server/storage.mjs';
import { TestClient } from './multiplayer-checks.mjs';
import { vehicleDef } from '../src/vehicles/registry.js';
import { createVehicle, board, seat, leave, drive, basis, localToFrame } from '../src/vehicles/api.js';
import { makeShipEnv, makePlanetEnv, SHIP_AXES } from '../src/vehicles/support.js';
import { buildSurveyRover } from '../src/vehicles/survey/mesh.js';
import { makeShipMaterials } from '../src/ship/shipTextures.js';
import { shipDef } from '../src/ships/registry.js';
import { shipIndexFor } from '../src/ship/shipWalker.js';
import { makeMoon } from '../src/space/moonField.js';
import { START_MARKS, MARKS_PER_CREDIT } from '../src/economy/catalog.js';
import { RAIDER_PRICE_CREDITS } from '../src/ships/raider/stats.js';

const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;

function shipEnv(angle = 0.4) {
  const def = shipDef('meridian');
  const ramp = def.ramps.cargo;
  const obstacles = (shipIndexFor(def).obstacles || []).filter((o) => o.z1 > 9 && o.y0 < 2.4);
  return makeShipEnv({
    ramps: def.ramps,
    rampState: { cargo: { lowered: true, progress: 1, angle } },
    landed: () => true,
    deck: { x0: -5.8, x1: 5.8, z0: 9.8, z1: ramp.hinge.z, y: 0 },
    obstacles,
  });
}

function stepDrive(v, input, seconds, env) {
  const n = Math.max(1, Math.round(seconds / (1 / 30)));
  let last = null;
  for (let i = 0; i < n; i++) last = drive(v, input, 1 / 30, env);
  return last;
}

/** Coast from 8 m/s, throttle 0, on a 15° rise along the nose. Returns speed after `seconds`. */
function coastSpeed(g, seconds) {
  const slope = Math.tan(15 * Math.PI / 180);
  const v = createVehicle('survey', { id: 'coast', pose: { x: 0, y: 0, z: 0, yaw: 0, speed: 8 } });
  const env = {
    gravity: () => g,
    axes: () => SHIP_AXES,
    // Yaw 0 faces −Z. Raising y as z falls makes the nose point uphill.
    sample: (x, _y, z) => ({ point: { x, y: -z * slope, z }, normal: { x: 0, y: 1, z: 0 } }),
    blocked: () => false,
  };
  stepDrive(v, { throttle: 0, steer: 0 }, seconds, env);
  return v.pose.speed;
}

export async function runRoverChecks({ check, section, THREE }) {
  section('31. Survey rover: one type, the hold, the depot, two clients');
  const def = vehicleDef('survey');
  check('the survey rover has six wheels, four seats, and a price under a raider',
    def.wheels.length === 6 && def.seats.length === 4 && def.priceMarks === 2400
    && def.priceMarks < START_MARKS && def.priceMarks < RAIDER_PRICE_CREDITS * MARKS_PER_CREDIT
    && def.half.x * 2 < 3.6 && def.berth.ships.includes('meridian') && def.berth.pose.yaw === Math.PI);

  const v0 = createVehicle('survey', { id: 'api', owner: 'a' });
  const sat = board(v0, 'a');
  const moved = seat(v0, 'a', 'right');
  const passenger = board(v0, 'b', 'rear-left');
  const stood = leave(v0, 'b');
  check('board, seat and leave are the opening contract',
    sat.ok && sat.seat === 'driver' && moved.ok && moved.seat === 'right' && passenger.ok && stood.ok && !v0.passengers['rear-left'] && v0.passengers.right === 'a');

  const flat = basis(0, SHIP_AXES);
  const aft = basis(Math.PI, SHIP_AXES);
  const nose = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(0, -Math.PI, 0, 'YXZ'));
  check('yaw 0 faces north and a mesh yaw of −π points the nose aft',
    near(flat.forward.z, -1) && near(flat.right.x, 1) && near(flat.forward.x, 0)
    && near(aft.forward.z, 1) && near(aft.right.x, -1)
    && near(nose.z, 1) && near(nose.x, 0) && near(nose.y, 0));

  const door = localToFrame({ x: 0, y: 0, z: 16, yaw: Math.PI }, SHIP_AXES, def.doors[0].x, 0, def.doors[0].z);
  check('the left door at the berth is on the starboard side of the bay', near(door.x, 1.35, 0.02) && near(door.z, 16.2, 0.05));

  const parked = createVehicle('survey', { id: 'deck', pose: { ...def.berth.pose } });
  const env = shipEnv();
  check('the centreline berth is not inside the cargo furniture', !env.blocked({ x: 0, y: 0, z: 16 }));
  const rolled = stepDrive(parked, { throttle: 1, steer: 0 }, 1, env);
  check('throttle on the berth drives aft, toward the ramp',
    rolled.ok && !rolled.blocked && parked.pose.z > 16.4 && Math.abs(parked.pose.x) < 0.2, `z ${parked.pose.z} x ${parked.pose.x}`);

  const marsG = 3.72076;
  const phobosG = makeMoon('phobos').surfaceGravity;
  const marsCoast = coastSpeed(marsG, 2);
  const phobosCoast = coastSpeed(phobosG, 2);
  check('an upslope bleeds more speed on Mars than on Phobos', marsCoast < phobosCoast - 0.4, `mars ${marsCoast.toFixed(2)} phobos ${phobosCoast.toFixed(2)}`);

  const mats = makeShipMaterials({ tier: 'high' });
  const high = buildSurveyRover(mats, { tier: 'high' });
  const low = buildSurveyRover(mats, { tier: 'low' });
  const noseWheel = high.wheels.find((g) => g.name === 'wheel-fl');
  check('the mesh is a cab on six wheels, nose at −Z, under the triangle budget',
    high.wheels.length === 6 && low.wheels.length === 6 && noseWheel && noseWheel.position.z < -1
    && high.lights.length === 1 && high.lights[0].position.z < -1.6
    && low.lights.length === 0
    && high.triangles > 400 && high.triangles < 12000 && low.triangles < 6000 && low.triangles <= high.triangles,
    `high ${high.triangles} low ${low.triangles}`);
  high.group.userData.dispose?.();
  low.group.userData.dispose?.();

  const dir = await mkdtemp(join(tmpdir(), 'cosmos-rover-'));
  let app, a, b, courier;
  let clock = Date.now();
  try {
    app = await startServer({ adapter: new FileAdapter(join(dir, 'world.json')), port: 0, tick: false, now: () => clock });
    const world = app.world;
    a = new TestClient(app.url, 'r'.repeat(48), 'Jaron');
    b = new TestClient(app.url, 's'.repeat(48), 'Lilith');
    await a.connect();
    await b.connect();
    const pa = world.state.players[a.id];
    const shipId = pa.shipId;
    const holdId = `hold-${shipId}`;
    const hold = world.state.vehicles[holdId];
    const pub = world.publicState();
    check('a new Meridian is given one parented survey rover, and the snapshot keeps blockers off the record',
      hold && hold.type === 'survey' && hold.owner === a.id && hold.parentShipId === shipId && hold.homeShipId === shipId
      && !pub.ships[shipId].state.blockers && !Object.prototype.hasOwnProperty.call(pub, 'receipts'));

    courier = new TestClient(app.url, 't'.repeat(48), 'Courier', 1);
    await courier.connect();
    const courierShip = world.state.ships[world.state.players[courier.id].shipId];
    check('an opening client gets a courier and no hold rover',
      courierShip.type === 'courier' && !world.state.vehicles[`hold-${courierShip.id}`]);

    const marsEnv = makePlanetEnv(world.mars);
    const stand = world.state.players[a.id].pose.worldPos;
    const marsHit = marsEnv.sample(stand.x, stand.y, stand.z);
    const apron = world.site.toWorld(-46, 3, 18);
    const apronHit = marsEnv.sample(apron.x, apron.y, apron.z);
    let marsClear = 99, marsMoved = 0, moonMoved = 0, moonHit = null;
    if (marsHit) {
      const marsRover = createVehicle('survey', { id: 'mars', pose: { x: marsHit.point.x, y: marsHit.point.y, z: marsHit.point.z, yaw: 0, speed: 0 } });
      const marsStart = { ...marsRover.pose };
      stepDrive(marsRover, { throttle: 1, steer: 0 }, 2, marsEnv);
      const again = marsEnv.sample(marsRover.pose.x, marsRover.pose.y, marsRover.pose.z);
      marsClear = again ? Math.hypot(marsRover.pose.x - again.point.x, marsRover.pose.y - again.point.y, marsRover.pose.z - again.point.z) : 99;
      marsMoved = Math.hypot(marsRover.pose.x - marsStart.x, marsRover.pose.z - marsStart.z);
    }
    const moon = makeMoon('phobos');
    const pad = moon.playerPad(0, 0);
    const moonEnv = makePlanetEnv(moon);
    moonHit = moonEnv.sample(pad.point.x, pad.point.y, pad.point.z);
    if (moonHit) {
      const moonRover = createVehicle('survey', { id: 'phobos', frameId: 'phobos', pose: { x: moonHit.point.x, y: moonHit.point.y, z: moonHit.point.z, yaw: 0, speed: 0 } });
      const moonStart = { ...moonRover.pose };
      stepDrive(moonRover, { throttle: 1, steer: 0 }, 3, moonEnv);
      moonMoved = Math.hypot(moonRover.pose.x - moonStart.x, moonRover.pose.y - moonStart.y, moonRover.pose.z - moonStart.z);
    }
    check('the rover stays on the Mars port grade and still creeps on Phobos',
      !!(marsHit && apronHit && moonHit) && marsClear < 0.4 && marsMoved > 1 && moonMoved > 0.2,
      `mars ${marsHit ? 'hit' : 'miss'} apron ${apronHit ? 'hit' : 'miss'} moon ${moonHit ? 'hit' : 'miss'} clear ${marsHit ? marsClear.toFixed(3) : '-'} moved ${marsHit ? marsMoved.toFixed(2) : '-'} phobos ${moonHit ? moonMoved.toFixed(2) : '-'}`);

    const sim = world.sims.get(shipId);
    const settle = async () => {
      await new Promise((r) => setTimeout(r, 12));
      await world.enqueue(() => {});
    };
    const move = async (client, worldPoint) => {
      const p = world.state.players[client.id];
      const origin = { ...p.pose.worldPos };
      const dist = Math.hypot(worldPoint.x - origin.x, worldPoint.y - origin.y, worldPoint.z - origin.z);
      const n = Math.max(1, Math.ceil(dist / 8));
      for (let i = 1; i <= n; i++) {
        clock += 1000;
        const pose = structuredClone(p.pose);
        for (const k of ['x', 'y', 'z']) pose.worldPos[k] = origin[k] + (worldPoint[k] - origin[k]) * i / n;
        pose.aboard = false;
        client.send({ type: 'pose', pose });
        await settle();
      }
    };
    const walkIn = async (client, sw) => {
      const p = world.state.players[client.id];
      const origin = { ...p.pose.sw };
      const dist = Math.hypot(sw.x - origin.x, sw.z - origin.z);
      const n = Math.max(1, Math.ceil(dist / 8));
      for (let i = 1; i <= n; i++) {
        clock += 1000;
        const pose = structuredClone(p.pose);
        pose.aboard = true;
        pose.seat = null;
        pose.sw.x = origin.x + (sw.x - origin.x) * i / n;
        pose.sw.y = sw.y;
        pose.sw.z = origin.z + (sw.z - origin.z) * i / n;
        pose.sw.yaw = sw.yaw || 0;
        pose.sw.pitch = 0;
        client.send({ type: 'pose', pose });
        await settle();
      }
    };
    const gas = async (client, throttle) => {
      clock += 200;
      const pose = structuredClone(world.state.players[client.id].pose);
      client.send({ type: 'pose', pose, vehicle: { throttle, steer: 0 } });
      await settle();
    };

    const foot = sim.flight.toWorld(sim.def.dock.rampFoot);
    await move(a, foot);
    const boardedShip = await a.action({ type: 'board', shipId });
    await walkIn(a, { x: door.x, y: 0, z: door.z, yaw: Math.PI });
    const took = await a.action({ type: 'vehicle-board', vehicleId: holdId, seat: 'driver' });
    const permit = await a.action({ type: 'boarding-permission', allowed: true });
    await move(b, foot);
    const bShip = await b.action({ type: 'board', shipId });
    await walkIn(b, { x: door.x + 0.4, y: 0, z: door.z, yaw: Math.PI });
    const rode = await b.action({ type: 'vehicle-board', vehicleId: holdId });
    check('the owner drives and a second player takes a free seat',
      boardedShip.ok && took.ok && permit.ok && bShip.ok && rode.ok && world.state.vehicles[holdId].passengers.driver === a.id
      && world.state.players[b.id].vehicleSeat && world.state.players[b.id].vehicleSeat !== 'driver'
      && world.state.players[a.id].aboardShipId === null,
      `board ${boardedShip.msg || ''} wheel ${took.msg || ''} ride ${rode.msg || ''} bShip ${bShip.msg || ''}`);

    const berthZ = world.state.vehicles[holdId].pose.z;
    let sawRamp = false;
    let leftAt = null;
    if (took.ok) {
      for (let i = 0; i < 48 && !leftAt; i++) {
        await gas(a, 1);
        await world.enqueue(() => { world.advance(0.25); });
        const rv = world.state.vehicles[holdId];
        if (rv.parentShipId && world.vehicles.onRamp(sim, 'cargo')) sawRamp = world.rampOccupied(sim, 'cargo');
        if (!rv.parentShipId) leftAt = { x: rv.world.x, y: rv.world.y, z: rv.world.z };
      }
    }
    let remote = null;
    if (leftAt) {
      a.send({ type: 'checkpoint' });
      const seen = await b.wait((m) => m.type === 'state' && m.state.vehicles?.[holdId] && !m.state.vehicles[holdId].parentShipId);
      remote = seen.state.vehicles[holdId];
    }
    const local = world.state.vehicles[holdId];
    check('both clients see the hold rover drive off the ramp onto the ground',
      sawRamp && leftAt && local.parentShipId === null && Math.abs(local.pose.z - berthZ) > 1
      && remote && remote.parentShipId === null
      && Math.abs(remote.world.x - local.world.x) < 1e-6 && Math.abs(remote.world.z - local.world.z) < 1e-6
      && Math.hypot(remote.world.x - leftAt.x, remote.world.z - leftAt.z) < 1e-4,
      `ramp ${sawRamp} parent ${local.parentShipId} local z ${local.pose.z} berth ${berthZ} world ${JSON.stringify(local.world)}`);

    let back = false;
    for (let i = 0; i < 100 && !back; i++) {
      await gas(a, -1);
      await world.enqueue(() => { world.advance(0.25); });
      if (world.state.vehicles[holdId].parentShipId === shipId) back = true;
    }
    const home = world.state.vehicles[holdId];
    check('reversing back up the ramp parents the rover to the Meridian again',
      !!leftAt && back && home.parentShipId === shipId && home.pose.z < (sim.def.ramps.cargo.hinge.z + sim.def.ramps.cargo.length),
      `left ${!!leftAt} parent ${home.parentShipId} pose ${JSON.stringify(home.pose)}`);

    const leftRover = await a.action({ type: 'vehicle-leave' });
    const leftHull = world.state.players[a.id].aboardShipId ? await a.action({ type: 'leave' }) : { ok: true, msg: 'already outside' };
    const clerk = world.site.toWorld(-65, 0.02, 16.9);
    await move(a, clerk);
    const marksBefore = world.state.ships[shipId].economy.marks;
    const bought = await a.action({ type: 'buy-vehicle' });
    const owned = Object.values(world.state.vehicles).filter((q) => q.owner === a.id && !q.homeShipId);
    const boughtRover = owned[0];
    const gap = boughtRover ? (() => { const hit = marsEnv.sample(boughtRover.pose.x, boughtRover.pose.y, boughtRover.pose.z); return hit ? Math.hypot(boughtRover.pose.x - hit.point.x, boughtRover.pose.y - hit.point.y, boughtRover.pose.z - hit.point.z) : 99; })() : 99;
    check('the depot sells a survey rover for 2400 marks onto the east apron',
      bought.ok && owned.length === 1 && boughtRover.frameId === 'mars' && gap < 0.4
      && world.state.ships[shipId].economy.marks === marksBefore - 2400
      && boughtRover.pose.yaw === -Math.PI / 2,
      `${bought.msg || ''} leave ${leftRover.msg || ''} hull ${leftHull.msg || ''} gap ${gap}`);

    let saved;
    const orig = world.adapter.save.bind(world.adapter);
    world.adapter.save = async (snapshot, changed) => { saved = snapshot; return orig(snapshot, changed); };
    await world.commit();
    world.adapter.save = orig;
    check('a checkpoint saves the rovers and does not save walker blockers',
      saved?.vehicles?.[holdId] && saved.vehicles[boughtRover?.id] && !saved.ships[shipId].state.blockers);

    const bare = structuredClone(world.state);
    delete bare.vehicles;
    for (const s of Object.values(bare.ships)) if (s.state) delete s.state.blockers;
    bare.savedAt = clock;
    const restored = await new world.constructor({ load: async () => ({ record: bare, bricks: [] }), save: async () => {} }, { now: () => clock }).load();
    check('an old save with no vehicles map gains the same hold rover on load',
      restored.state.vehicles[holdId]?.type === 'survey' && restored.state.vehicles[holdId].parentShipId === shipId);
  } catch (e) {
    check('rover scenario completes', false, e.stack || e.message);
  } finally {
    a?.close();
    b?.close();
    courier?.close();
    if (app) await app.close();
    await rm(dir, { recursive: true, force: true });
  }
}
