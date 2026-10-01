// Page-side helpers for the QA scripts (injected into the running game).
export const HELPERS = `
(async () => {
  const c = window.cosmos;
  const F = await import('/src/world/field.js');
  const qa = window.qa = {};
  const V = {
    sub: (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }),
    add: (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }),
    mul: (a, k) => ({ x: a.x * k, y: a.y * k, z: a.z * k }),
    dot: (a, b) => a.x * b.x + a.y * b.y + a.z * b.z,
    len: (a) => Math.hypot(a.x, a.y, a.z),
    unit: (a) => { const l = Math.hypot(a.x, a.y, a.z) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; },
  };
  qa.V = V; qa.F = F;
  qa.frameAt = (p) => { const w = c.walker; const save = { ...w.worldPos }; Object.assign(w.worldPos, p); const f = w.updateFrame(); const out = { east: { ...f.east }, north: { ...f.north }, up: { ...f.up } }; Object.assign(w.worldPos, save); w.updateFrame(); return out; };
  qa.portPoint = (x, z) => { const p = c.port.site.toWorld(x, 0.5, z); const g = F.groundBelow(c.body, p.x, p.y, p.z, 40); return g ? g.point : p; };
  // Ground origin and its east/north/up frame. local(e,n,u) -> world point.
  qa.setOrigin = (p) => { qa.O = { ...p }; qa.fr = qa.frameAt(p); };
  qa.local = (e, n, u) => V.add(qa.O, V.add(V.mul(qa.fr.east, e), V.add(V.mul(qa.fr.north, n), V.mul(qa.fr.up, u))));
  qa.surfaceAt = (e, n) => { const p = qa.local(e, n, 3); const hits = F.raycast(c.body, p.x, p.y, p.z, -qa.fr.up.x, -qa.fr.up.y, -qa.fr.up.z, 12, { firstOnly: true, minStep: 0.05 }); const h = hits.find((q) => q.kind === 'enter'); return h ? h.point : null; };
  qa.stand = (e, n) => {
    const g = qa.surfaceAt(e, n); const w = c.walker;
    const l = V.len(g); w.worldPos.x = g.x * (1 + 0.02 / l); w.worldPos.y = g.y * (1 + 0.02 / l); w.worldPos.z = g.z * (1 + 0.02 / l);
    w.velocity = { x: 0, y: 0, z: 0 }; w.grounded = true; w.updateFrame(); c.rebuildNear(true);
    for (let i = 0; i < 6; i++) c.step(1 / 60);
    return { ...w.worldPos };
  };
  qa.aimAt = (p) => {
    const w = c.walker; const eye = w.eyeWorldPos({}); const d = V.unit(V.sub(p, eye)); const f = w.updateFrame();
    w.yaw = Math.atan2(V.dot(d, f.east), V.dot(d, f.north)); w.pitch = Math.asin(Math.max(-1, Math.min(1, V.dot(d, f.up))));
  };
  qa.flush = () => { c.flushTerrain(); for (let i = 0; i < 4; i++) c.step(1 / 60); };
  qa.cam = (eyeLocal, targetLocal) => { c.freeCam.set(qa.local(...eyeLocal), qa.local(...targetLocal)); qa.flush(); for (let i = 0; i < 3; i++) c.step(1 / 60); };
  qa.camOff = () => c.freeCam.off();
  // Dig a block of ground by aiming real bites, from where the player stands.
  qa.digPoints = (pts, toolIdx = 1, dumpWhenFull = true) => {
    c.setTool(toolIdx); let n = 0, refused = 0, dumps = 0;
    for (const p of pts) {
      qa.aimAt(p);
      let r = c.doDig();
      if (!r.ok && /full/i.test(r.msg) && dumpWhenFull) {
        let g = 0; while (c.carried.length && g++ < 80) { const d = c.doDump(); if (!d.ok) break; dumps++; }
        r = c.doDig();
      }
      if (r.ok) n++; else refused++;
    }
    return { bites: n, refused, dumps };
  };
  qa.emptyHands = () => { let k = 0; while (c.carried.length && k++ < 400) { const d = c.doDump(); if (!d.ok) break; } return k; };
  return true;
})()
`;
