// Boarding a captured Shrike in space, and raider crews that do not wear the hall's faces.
// Runs the real authority, the real flight model and real Three materials. People GLBs are not loaded here.
import '../server/runtime.mjs';
import { CREW_POSTS } from '../src/crew/crewSpec.js';
import { raiderCrew } from '../src/ships/raider/crew.js';
import { raiderLook, looksDistinct, stockHireMatch, SKIN, CLOTH, HAIR, VISOR, VISOR_OPACITY, LOFT_PEOPLE } from '../src/ships/raider/looks.js';
import { applyPersonLook } from '../src/crew/personRig.js';
import { shipDef } from '../src/ships/registry.js';
import { DISABLED_HULL, LOOT_CREDITS } from '../src/ships/raider/stats.js';
import { Authority } from '../server/authority.mjs';

const mem = () => { const m = { rec: null, bricks: [], load: async () => (m.rec ? { record: structuredClone(m.rec), bricks: [] } : { record: null, bricks: [] }), save: async (r) => { m.rec = r; } }; return m; };
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

export async function runGrok2Checks({ check, section, THREE }) {
  section('28. Board a captured Shrike, and raider crews that are not the hall');

  const loft = new Set(LOFT_PEOPLE);
  check('every raider look is a Loft body in a helmet, and the cloth, hair and skin palettes are duty colours',
    CLOTH.length === 7 && HAIR.length === 5 && SKIN.length === 5 && VISOR.length === 3 && VISOR_OPACITY > 0.55 && VISOR_OPACITY < 0.85 &&
    SKIN.every((hex) => { const c = new THREE.Color(hex); return c.r + 1e-4 >= c.b && c.r > c.g * 0.55 && c.g > c.b * 0.7; }) &&
    CLOTH.every((hex) => { const c = new THREE.Color(hex); return Math.max(c.r, c.g, c.b) < 0.7; }));

  {
    let distinct = true, hired = true, fours = true;
    for (let seq = 1; seq <= 20; seq++) {
      const crew = raiderCrew(seq);
      if (crew.length !== 4 || new Set(crew.map((c) => c.personId)).size !== 4) fours = false;
      if (!crew.every((c) => loft.has(c.personId) && c.look && c.look.helmet && c.look.visor && c.personId === c.look.personId)) fours = false;
      for (let i = 0; i < crew.length; i++) for (let j = i + 1; j < crew.length; j++) if (!looksDistinct(crew[i].look, crew[j].look)) distinct = false;
      for (const c of crew) for (const post of CREW_POSTS) if (stockHireMatch(c.look, post.personId)) hired = false;
    }
    check('across twenty hulls, each crew is four different Loft bodies and every pair can be told apart', distinct && fours);
    check('a raider look never matches an unmodified hire-pool face (Ada, Zuri, Jorge and the rest have no helmet)',
      hired && CREW_POSTS.every((p) => stockHireMatch({ personId: p.personId, helmet: false }, p.personId)) && !stockHireMatch(raiderLook(1, 0), 'ada'));
  }

  {
    const look = raiderLook(4, 1);
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xffffff, name: 'Skin_Body' });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0xffffff, name: 'HairCard_Hair_S_Coil' });
    const clothMat = new THREE.MeshStandardMaterial({ color: 0xffffff, name: 'Shirt' });
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, name: 'EyeL' });
    const toothMat = new THREE.MeshStandardMaterial({ color: 0xffffff, name: 'Teeth' });
    const skinHex = skinMat.color.getHex(), eyeHex = eyeMat.color.getHex();
    const root = new THREE.Group();
    const head = new THREE.Bone(); head.name = 'head'; root.add(head);
    const add = (mat) => { const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), mat); root.add(mesh); return mesh; };
    const skinMesh = add(skinMat), hairMesh = add(hairMat), clothMesh = add(clothMat), eyeMesh = add(eyeMat), toothMesh = add(toothMat);
    applyPersonLook(root, look);
    applyPersonLook(root, look);
    const shell = head.getObjectByName('helmet-shell');
    const visor = head.getObjectByName('helmet-visor');
    const helmets = [];
    head.traverse((o) => { if (o.name === 'raider-helmet') helmets.push(o); });
    const once = new THREE.Color(0xffffff).multiply(new THREE.Color(look.skin)).getHex();
    check('a look tints skin, hair and cloth once, and leaves the eyes, the teeth and the shared source material alone',
      skinMesh.material !== skinMat && skinMesh.material.color.getHex() === once && skinMat.color.getHex() === skinHex &&
      hairMesh.material.color.getHex() === new THREE.Color(0xffffff).multiply(new THREE.Color(look.hair)).getHex() &&
      clothMesh.material.color.getHex() === new THREE.Color(0xffffff).multiply(new THREE.Color(look.cloth)).getHex() &&
      eyeMesh.material === eyeMat && eyeMat.color.getHex() === eyeHex && toothMesh.material === toothMat);
    check('the helmet is one child of the head bone, sized in centimetres (shell toward the face, visor further that way)',
      helmets.length === 1 && shell && shell.position.y < 0 && shell.position.y > -16 && visor && visor.position.y < shell.position.y &&
      head.getObjectByName('helmet-seal') && shell.parent.name === 'raider-helmet' && shell.parent.parent === head);
  }

  const NOW = 1_800_000_000_000;
  const adapter = mem();
  const world = await new Authority(adapter, { now: () => NOW }).load();
  const key = 'g'.repeat(48);
  const act = (p, id, a) => world.action(p.id, id, a);
  const REC = (id) => world.state.ships[id];
  const SIM = (id) => world.sims.get(id);
  const pl = await world.join(key, 'Jaron');
  const PL = pl.id, PSHIP = pl.shipId;
  const me = () => world.state.players[PL];
  const raiders = () => Object.values(world.state.ships).filter((s) => s.npc);
  const R1 = raiders().find((s) => s.npc.station === 'mars-orbit');
  const R1ID = R1.id;
  const near = (simId, otherId, east) => {
    const o = SIM(otherId), f = SIM(simId).flight, fr = o.flight._frame;
    f.pos = { x: o.flight.pos.x + fr.east.x * east, y: o.flight.pos.y + fr.east.y * east, z: o.flight.pos.z + fr.east.z * east };
    f.vel = { x: 0, y: 0, z: 0 }; f.landed = false; f.airborne = true; f.autoHover = true; f.gearPos = 0; f.refreshOrientation();
  };
  const boardShip = (shipId) => { me().aboardShipId = shipId; me().currentShipId = shipId; me().pose.aboard = true; me().frameId = SIM(shipId).frameId; };

  {
    const bad = await act(me(), 'board-bad-mode1', { type: 'board-prize', shipId: R1ID, ownShip: 'orbit' });
    check('boarding a prize needs hold or follow', bad.ok === false && /hold|follow/.test(bad.msg), bad.msg);
    boardShip(PSHIP); near(PSHIP, R1ID, 40);
    const fight = await act(me(), 'board-fighting01', { type: 'board-prize', shipId: R1ID, ownShip: 'hold' });
    check('a raider that is still fighting cannot be boarded', fight.ok === false && /fighting|disable/i.test(fight.msg), fight.msg);
  }

  const ph = raiders().find((s) => s.npc.station === 'phobos');
  {
    const c0 = ph.crew[0], seq = ph.npc.seq, post = shipDef('raider').crewPosts.findIndex((r) => r.id === c0.role);
    const kept = c0.name;
    delete c0.look; c0.personId = 'jorge';
    world.fleet.attach(SIM(ph.id));
    check('a raider saved without a look is dressed on load, and keeps its name',
      c0.name === kept && c0.look && c0.look.helmet && c0.look.visor && c0.personId === raiderLook(seq, post).personId && c0.look.personId === c0.personId);
    ph.npc.state = 'disabled';
    for (const c of ph.crew) if (c.status === 'aboard') c.status = 'surrendered';
    SIM(ph.id).flight.hull = DISABLED_HULL;
    SIM(PSHIP).setFrame('phobos'); boardShip(PSHIP); near(PSHIP, ph.id, 60);
    const claim = await act(me(), 'prize-crew-ph01', { type: 'claim-ship', shipId: ph.id });
    const got = REC(ph.id);
    check('a prize crew still brings the hull home to a pad, and the crew who sign on keep the raider look',
      claim.ok === true && got.owner === PL && !got.npc && SIM(ph.id).flight.landed && SIM(ph.id).frameId === 'mars' && !SIM(ph.id).brain &&
      got.crew.length === 4 && got.crew.every((c) => c.look && c.look.helmet && world.state.pool[c.id] && world.state.pool[c.id].look && world.state.pool[c.id].look.helmet && world.state.pool[c.id].shipId === ph.id),
      claim.msg);
  }

  SIM(PSHIP).setFrame('mars'); boardShip(PSHIP);
  {
    REC(R1ID).npc.state = 'disabled';
    for (const c of REC(R1ID).crew) if (c.status === 'aboard') c.status = 'surrendered';
    SIM(R1ID).flight.hull = DISABLED_HULL; SIM(R1ID).flight.vel = { x: 0, y: 0, z: 0 };
    near(PSHIP, R1ID, 400);
    const far = await act(me(), 'board-too-far01', { type: 'board-prize', shipId: R1ID, ownShip: 'hold' });
    check('boarding needs the ship within reach, and a refusal leaves the raider a raider', far.ok === false && /within/.test(far.msg) && REC(R1ID).npc && REC(R1ID).npc.state === 'disabled', far.msg);
    // A refusal rebuilds every sim from the last commit, which still has this ship in the Phobos frame.
    SIM(PSHIP).setFrame('mars'); me().frameId = 'mars';

    const M = shipDef('meridian');
    const add = (role, name, personId) => {
      const id = 'hired-' + role, post = CREW_POSTS.find((r) => r.id === role), seat = M.seats.find((s) => s.id === post.seat);
      REC(PSHIP).crew.push({ id, role, name, personId, skill: 0.8, wageCredits: 80, status: 'aboard', unpaid: false, nextPay: 1e15, seatPose: { ...seat } });
      REC(PSHIP).economy.crew[role] = { nextPay: 1e15, unpaid: false };
      world.state.pool[id] = { id, role, name, personId, skill: 0.8, wageCredits: 80, shipId: PSHIP, status: 'hired', position: { x: 0, y: 0, z: 0 }, refillAt: 1e15 };
    };
    add('pilot', 'Nia Okonkwo', 'ada');
    add('captain', 'Helena Voss', 'zuri');
    add('nav', 'Mateo Ruiz', 'jorge');
    near(PSHIP, R1ID, 50);
    const where = { ...SIM(R1ID).flight.pos }, frame = SIM(R1ID).frameId, marks = REC(R1ID).economy.marks;
    const got = await act(me(), 'board-prize-0001', { type: 'board-prize', shipId: R1ID, ownShip: 'hold' });
    check('board-prize is accepted', got.ok === true, got.msg);
    if (!got.ok) return;
    const prize = REC(R1ID), dock = shipDef('raider').dock.boardSw;
    const padAt = world.site.toWorld(prize.pad.x, 0, prize.pad.z);
    const helena = prize.crew.find((c) => c.name === 'Helena Voss'), mateo = prize.crew.find((c) => c.name === 'Mateo Ruiz');
    check('boarding takes the hull in place: yours, still in space, a home pad allocated, no brain and no wing',
      got.ok === true && prize.owner === PL && prize.npc === null && prize.type === 'raider' && !SIM(R1ID).flight.landed && SIM(R1ID).frameId === frame &&
      dist(SIM(R1ID).flight.pos, where) < 5 && dist(SIM(R1ID).flight.pos, padAt) > 500 && world.state.pads.some((p) => p.shipId === R1ID) &&
      !SIM(R1ID).brain && !SIM(R1ID).wing, got.msg);
    check('the hold money came aboard with the hull', LOOT_CREDITS.some((n) => prize.economy.marks === marks + n * 4), String(prize.economy.marks - marks));
    check('you are on the Shrike deck and the Meridian is still the flagship',
      me().aboardShipId === R1ID && me().shipId === PSHIP && me().pose.seat === null && Math.abs(me().pose.sw.z - dock.z) < 1e-9 && Math.abs(me().pose.sw.x - dock.x) < 1e-9);
    check('the pilot stayed to hold the Meridian; the captain and the navigator came aboard, and the raider crew left',
      REC(PSHIP).crew.length === 1 && REC(PSHIP).crew[0].name === 'Nia Okonkwo' && REC(PSHIP).crew[0].role === 'pilot' &&
      REC(PSHIP).escort && REC(PSHIP).escort.mode === 'hold' && REC(PSHIP).escort.targetId === R1ID &&
      helena && (helena.status === 'walking-aboard' || helena.status === 'aboard') && mateo && mateo.displaced === true && mateo.standPose &&
      Math.abs(mateo.standPose.z - dock.z) < 3 && prize.crew.every((c) => !String(c.id).startsWith('raider-')) && prize.crew.length === 2 &&
      /Nia Okonkwo/.test(got.msg) && /Helena Voss/.test(got.msg) && /Mateo Ruiz/.test(got.msg) && /flagship/.test(got.msg) && /hold station/.test(got.msg),
      got.msg);
    const again = await act(me(), 'board-again-0001', { type: 'board-prize', shipId: R1ID, ownShip: 'follow' });
    check('the same hull cannot be boarded twice', again.ok === false && prize.owner === PL && prize.npc === null, again.msg);

    const held = { ...SIM(PSHIP).flight.pos };
    world.advance(4);
    const drift = dist(SIM(PSHIP).flight.pos, held);
    check(`with hold, the Meridian stays put (${drift.toFixed(1)} m over 4 s)`, drift < 20 && REC(PSHIP).escort && REC(PSHIP).escort.mode === 'hold');

    REC(PSHIP).escort.mode = 'follow';
    const seat = shipDef('raider').seats.find((s) => s.id === 'pilot');
    me().poseAt = NOW - 3000;
    const walked = await act(me(), 'walk-to-helm-01', { type: 'player-pose', pose: {
      worldPos: { ...me().pose.worldPos }, velocity: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, grounded: false, aboard: true,
      sw: { x: seat.x, y: seat.y, z: seat.z, yaw: 0, pitch: 0 }, seat: null, look: { yaw: 0, pitch: 0 },
    } });
    const sat = await act(me(), 'sit-prize-helm1', { type: 'seat', seat: 'pilot' });
    check('from the boarding spot you can walk to the helm and take it', walked.ok === true && sat.ok === true && me().pose.seat === 'pilot', (walked.msg || '') + ' / ' + (sat.msg || ''));
    world.sessions.set(PL, { close() {} });
    world.inputs.set(PL, { until: NOW + 1e6, controls: { fwd: 1, lift: 0, yaw: 0 } });
    const fromP = { ...SIM(R1ID).flight.pos }, fromM = { ...SIM(PSHIP).flight.pos };
    world.advance(8);
    const movedP = dist(SIM(R1ID).flight.pos, fromP), movedM = dist(SIM(PSHIP).flight.pos, fromM), apart = dist(SIM(R1ID).flight.pos, SIM(PSHIP).flight.pos);
    check(`the prize flies (${movedP.toFixed(0)} m) and the Meridian follows (${movedM.toFixed(0)} m, ${apart.toFixed(0)} m apart)`,
      movedP > 40 && movedM > 20 && apart < 280 && REC(PSHIP).escort && REC(PSHIP).escort.mode === 'follow');

    world.inputs.set(PL, { until: NOW + 1e6, controls: { fwd: 0, lift: 0, yaw: 0 } });
    const course = await act(me(), 'prize-to-phobos1', { type: 'engage', destination: 'phobos' });
    world.advance(0.5);
    const trip = SIM(PSHIP).trip;
    check('when the prize sets a course, the ship that is following takes the same one',
      course.ok === true && trip && trip.active && trip.dest && trip.dest.id === 'phobos' && SIM(R1ID).trip && SIM(R1ID).trip.dest.id === 'phobos',
      (course.msg || '') + (trip ? ' escort ' + trip.dest?.id : ' escort has no trip') + ' prize ' + (SIM(R1ID).trip && SIM(R1ID).trip.dest && SIM(R1ID).trip.dest.id) + ' ' + JSON.stringify((REC(PSHIP).messages || []).slice(-3)));

    await world.commit();
    const w2 = await new Authority(adapter, { now: () => NOW }).load();
    const savedPrize = w2.state.ships[R1ID], savedMine = w2.state.ships[PSHIP];
    check('a restart keeps the owner, the pose, the escort and the signed-on looks',
      savedPrize.owner === PL && savedPrize.npc == null && savedPrize.pose && savedPrize.pose.pos && savedPrize.frameId === 'mars' &&
      !w2.sims.get(R1ID).brain && savedMine.escort && savedMine.escort.mode === 'follow' && savedMine.escort.targetId === R1ID &&
      w2.state.ships[ph.id].crew.every((c) => c.look && c.look.helmet && w2.state.pool[c.id].look.helmet));

    SIM(PSHIP).step(1 / 30, { fwd: 1, lift: 0, yaw: 0 });
    check('a hand on the Meridian\'s stick ends the escort', REC(PSHIP).escort === null);
  }
}
