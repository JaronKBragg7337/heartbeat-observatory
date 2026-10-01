export default async ({ launch }) => {
  const h = await launch({ w: 750, h: 470 });
  const { page, shot, browser } = h;
  const info = await page.evaluate(async () => {
    const c = window.cosmos;
    const M = await import('/src/crew/personRig.js');
    const THREE = await import('three');
    const lib = new M.PeopleLibrary({});
    const roster = await lib.roster();
    const out = { roster: roster.map(r => r.id) };
    window.__lib = lib; window.__M = M; window.__people = [];
    const f = c.ship.flight;
    // stand three of them on the apron beside the player, in port-local coordinates
    const spots = [[-14, 33], [-12, 33], [-10, 33]];
    const poses = ['Idle', 'Walk', 'Sit'];
    for (let i = 0; i < 3; i++) {
      const p = lib.spawn(roster[i].id, roster[i].file); await p.ready;
      const w = c.port.site.toWorld(spots[i][0], 0.02, spots[i][1]);
      const upv = new THREE.Vector3(w.x, w.y, w.z).normalize();
      const tgt = c.port.site.toWorld(-12, 0.02, 40); // face south (+z), toward the camera
      const fw = new THREE.Vector3(tgt.x - w.x, tgt.y - w.y, tgt.z - w.z).projectOnPlane(upv).normalize();
      const xa = new THREE.Vector3().crossVectors(upv, fw).normalize();
      const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xa, upv, fw));
      const e = c.engine.track({ worldPos: w, object3d: p.group, quaternion: q });
      c.engine.scene.add(p.group);
      p.entry = e; p.play(poses[i], 0);
      // face south-east toward camera: rotate about local up: just use basis
      window.__people.push(p);
    }
    out.anims = Object.keys(window.__people[0].acts);
    return out;
  });
  console.log(JSON.stringify(info));
  await page.evaluate(() => { for (let i = 0; i < 30; i++) { window.__people.forEach(p => p.update(1/30, 1.35)); window.cosmos.step(1/30); } });
  await page.evaluate(() => { const c = window.cosmos; const w = c.port.site.toWorld(-12, 0.02, 33); const e = c.port.site.toWorld(-12.5, 1.5, 38.5); const t = c.port.site.toWorld(-12, 1.0, 33); c.freeCam.set(e, t); for (let i = 0; i < 4; i++) c.step(1/60); });
  await shot('t1_start');
  await browser.close();
};
