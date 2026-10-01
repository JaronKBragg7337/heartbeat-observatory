export default async ({ launch }) => {
  const h = await launch({ w: 400, h: 300 });
  const { page, browser } = h;
  const out = await page.evaluate(async () => {
    const M = await import('/src/crew/personRig.js');
    const THREE = await import('three');
    const lib = new M.PeopleLibrary({});
    const r = (await lib.roster())[1];
    const p = lib.spawn(r.id, r.file); await p.ready;
    const res = {};
    const bone = (n) => p.body.getObjectByName(n);
    const pos = (n) => { p.group.updateMatrixWorld(true); const v = new THREE.Vector3(); bone(n).getWorldPosition(v); return [v.x, v.y, v.z].map(x => +x.toFixed(3)); };
    for (const name of ['Idle', 'Sit', 'Walk']) {
      const act = p.acts[name]; res[name] = { dur: act.getClip().duration };
      p.play(name, 0);
      const samples = [];
      for (const t of [0, 0.25, 0.5, 0.75].map(x => x * act.getClip().duration)) {
        act.time = t; p.mixer.update(0);
        samples.push({ t: +t.toFixed(2), pelvis: pos('pelvis'), head: pos('head'), footL: bone('foot_l') ? pos('foot_l') : null, footR: bone('foot_r') ? pos('foot_r') : null, root: bone('root') ? pos('root') : null });
      }
      res[name].samples = samples;
    }
    return res;
  });
  console.log(JSON.stringify(out, null, 0));
  await browser.close();
};
