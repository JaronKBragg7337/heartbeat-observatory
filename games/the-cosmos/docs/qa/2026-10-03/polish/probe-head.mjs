import { open } from './lib.mjs';
const h = await open({ w: 800, h: 450, query: '?dev=1&solo=1&opening=off&tier=high', wait: 9000 }, 'probe');
try {
  const r = await h.page.evaluate(async () => {
    const c = window.cosmos, THREE = await import('/lib/three.module.js');
    const p = c.people.spawn('ada'); await p.ready;
    const scene = c.engine.scene; const g = new THREE.Group(); g.add(p.group); scene.add(g); g.updateMatrixWorld(true); p.mixer?.update(0);
    let head = null; p.group.traverse(o => { if (!head && o.isBone && /(^|[:_])head$/i.test(o.name)) head = o; });
    head.updateWorldMatrix(true, false);
    const inv = head.matrixWorld.clone().invert(), hp = new THREE.Vector3().setFromMatrixPosition(head.matrixWorld);
    const out = { headWorld: hp.toArray().map(v => +v.toFixed(3)), meshes: {} };
    p.group.traverse(o => {
      if (!o.isSkinnedMesh) return;
      const pos = o.geometry.attributes.position, v = new THREE.Vector3();
      const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; let cnt = 0;
      for (let i = 0; i < pos.count; i++) {
        o.getVertexPosition ? o.getVertexPosition(i, v) : v.fromBufferAttribute(pos, i);
        if (o.applyBoneTransform && !o.getVertexPosition) o.applyBoneTransform(i, v);
        v.applyMatrix4(o.matrixWorld);
        if (v.distanceTo(hp) > 0.3) continue;
        v.applyMatrix4(inv);                         // metres in bone space (bone scale included): scale to cm by the bone's world scale
        cnt++;
        for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], v.getComponent(k)); mx[k] = Math.max(mx[k], v.getComponent(k)); }
      }
      if (cnt) out.meshes[o.name || o.material.name] = { cnt, min: mn.map(n => +n.toFixed(3)), max: mx.map(n => +n.toFixed(3)), mat: o.material.name };
    });
    const ws = new THREE.Vector3().setFromMatrixScale(head.matrixWorld);
    out.boneScale = ws.toArray();
    return out;
  });
  for (const [k, v] of Object.entries(r.meshes)) console.log(k, v.mat, JSON.stringify(v.min), JSON.stringify(v.max)); console.log(JSON.stringify(r.headWorld), JSON.stringify(r.boneScale));
} finally { await h.browser.close(); }
