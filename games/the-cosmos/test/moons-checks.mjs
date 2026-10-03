// moons-fix checks (2026-10-03): found by the AI playtester and by Jaron's own phone run.
//   - every ship type's ramp and airlock points OUT of the hull, is drawn that way, and can be walked out of
//   - every seat is a real place in its own ship's layout and a seated person's hips sit on the chair that is drawn there
//   - the Meridian's ramp panel can be reached from inside (so the ramp can be lowered on a moon)
//   - the real authority flies Mars -> Phobos -> Deimos -> Phobos and ends each trip landed in the right frame
import '../server/runtime.mjs';

export async function runMoonsChecks({ check, section, THREE }) {
  const { allShipDefs } = await import('../src/ships/registry.js');
  const { ShipWalker, shipIndexFor, defaultState } = await import('../src/ship/shipWalker.js');
  const { SEAT_PAN, seatVariant, seatPan } = await import('../src/ship/shipSpec.js');
  const { poseRamp } = await import('../src/ship/shipSystem.js');
  const { planPath, standPointsFor } = await import('../src/crew/shipPath.js');

  section('29. Ships: ramps and airlocks point out and open to the ground, seats are real, the moons can be reached');
  for (const d of allShipDefs()) {
    const L = d.layout, inRoom = (x, z) => L.rooms.some((r) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1);
    for (const [key, R] of Object.entries(d.ramps)) {
      check(`${d.type} ${key}: the hinge has a room just inside it and open air just outside it (the ramp leads away from the hull)`,
        inRoom(R.hinge.x - R.dir.x * 0.3, R.hinge.z - R.dir.z * 0.3) && !inRoom(R.hinge.x + R.dir.x * 0.7, R.hinge.z + R.dir.z * 0.7), JSON.stringify({ hinge: R.hinge, dir: R.dir }));
      // drawn: lowered, the ramp's far end is along its own direction and below the hinge; raised, it stands up
      const hinge = new THREE.Group(), ctl = { hinge };
      poseRamp(ctl, R, key, 1, 0.5);
      const down = new THREE.Vector3(0, 0, 1).applyQuaternion(hinge.quaternion);
      poseRamp(ctl, R, key, 0, 0.5);
      const up = new THREE.Vector3(0, 0, 1).applyQuaternion(hinge.quaternion);
      check(`${d.type} ${key}: drawn lowered it runs outward along (${R.dir.x}, ${R.dir.z}) and down to the ground; drawn raised it stands up`,
        Math.abs(down.x - R.dir.x * Math.cos(0.5)) < 0.01 && Math.abs(down.z - R.dir.z * Math.cos(0.5)) < 0.01 && down.y < -0.4 && up.y > 0.95, `down ${down.toArray().map((v) => v.toFixed(2))} up ${up.toArray().map((v) => v.toFixed(2))}`);
      // walked: from just inside the hinge, walking along the ramp asks to leave the ship at its end
      const st = defaultState(); st.ramps[key] = { lowered: true, angle: 0.5, progress: 1 }; if (key === 'airlock') { st.airlock.outerOpen = true; st.airlock.innerOpen = false; }
      const sw = new ShipWalker(shipIndexFor(d), st), yaw = Math.atan2(R.dir.x, -R.dir.z);
      sw.place(R.hinge.x - R.dir.x * 1.2, 0, R.hinge.z - R.dir.z * 1.2, yaw); sw.yaw = yaw;
      let out = false; for (let i = 0; i < 900 && !out; i++) { sw.tick(1 / 60, { moveZ: 1 }); out = sw.events.includes('exit:' + key); }
      check(`${d.type} ${key}: walking out along the lowered ${key === 'airlock' ? 'gangway' : 'ramp'} leaves the ship at its end`, out, `at ${sw.x.toFixed(2)}, ${sw.y.toFixed(2)}, ${sw.z.toFixed(2)}`);
    }
    // seats
    const bad = [];
    for (const s of d.seats) {
      const room = L.roomById.get(s.room);
      if (!room) { bad.push(s.id + ': no room ' + s.room); continue; }
      if (!(s.x >= room.x0 - 0.1 && s.x <= room.x1 + 0.1 && s.z >= room.z0 - 0.1 && s.z <= room.z1 + 0.1)) bad.push(s.id + ': outside its room');
      if (!s.id.startsWith('gun_') && Math.abs(s.y - room.y) > 0.35) bad.push(`${s.id}: y ${s.y} is not on the floor of ${s.room} (${room.y})`);
      if (!(seatVariant(s) in SEAT_PAN)) bad.push(s.id + ': unknown chair ' + seatVariant(s));
    }
    check(`${d.type}: every seat is inside its own room, on that room's floor, with a chair that has a seat height (so seated crew sit on the chair that is drawn)`, bad.length === 0, bad.join('; '));
    const posts = d.crewPosts.filter((p) => !d.seats.some((s) => s.id === p.seat));
    check(`${d.type}: every crew post names a seat the ship really has`, posts.length === 0, posts.map((p) => p.id).join());
    const sw = new ShipWalker(shipIndexFor(d), defaultState());
    const unreachable = d.seats.filter((s) => !s.id.startsWith('gun_') && !standPointsFor(sw, s).length).map((s) => s.id);
    check(`${d.type}: there is a place to stand beside every flight and station seat (a crew member can get up and a person can sit down)`, unreachable.length === 0, unreachable.join());
  }
  {
    const cour = allShipDefs().find((d) => d.type === 'courier');
    check('the Wayfarer\'s nav, comms and engineer seats are drawn as the chair their seat height is read from (one table, not one per renderer)',
      cour.seats.every((s) => seatPan(s) === SEAT_PAN[seatVariant(s)]) && seatPan(cour.seats.find((s) => s.id === 'captain')) > seatPan(cour.seats.find((s) => s.id === 'pilot')));
  }
}

export async function runMoonTripChecks({ check, section }) {
  section('30. The real authority flies the moons: each trip ends landed in the right frame');
  const { runMoonTrips } = await import('./moons-trips.mjs');
  await runMoonTrips({ check });
}
