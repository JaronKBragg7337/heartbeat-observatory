// ============================================================================
// gapAudit.js - find places where the ship lets the world show through (dev only).
//
// HOW: render the ship's interior alone against pure magenta (the planet, the sky
// and the exterior hull are hidden), from many viewpoints in a room, and count the
// pixels that are still pure magenta. Any such pixel is a slot in a wall, a floor
// or a door frame. Glass over a gap does not count (it tints the magenta), so
// windows pass; the open boarding ramp and the glass ventral pod legitimately show
// the world and should be left out of the room list.
//
//   cosmos.auditGaps(['corridor_main', 'engineering'])   -> "room: N views with gaps ..."
//
// It found: a door frame filed under a hidden room, a 0.2 m slot in the floor at
// every doorway, a 1 cm slit above and below each door leaf, and an unframed
// airlock hatch. It changes nothing unless it is called.
// ============================================================================

export function auditGaps(engine, ship, roomIds, o = {}) {
  const r = engine.renderer, gl = r.getContext();
  const W = 120, H = 80;
  const buf = new Uint8Array(W * H * 4);
  const bg = engine.scene.background;
  const pr = r.getPixelRatio(), W0 = window.innerWidth, H0 = window.innerHeight;
  engine.scene.background = null; r.setClearColor(0xff00ff, 1); engine.scene.visible = false;
  r.setPixelRatio(1); r.setSize(W, H, false); engine.camera.aspect = W / H; engine.camera.updateProjectionMatrix();
  const out = [];
  const step = o.yawStep || 30;
  const yaws = o.yaws || Array.from({ length: Math.ceil(360 / step) }, (_, i) => i * step);
  try {
    for (const id of roomIds) {
      const rm = ship.layout.roomById.get(id);
      let n = 0, worst = null;
      for (const fx of [0.2, 0.5, 0.8]) for (const fz of [0.2, 0.5, 0.8]) {
        const x = rm.x0 + (rm.x1 - rm.x0) * fx, z = rm.z0 + (rm.z1 - rm.z0) * fz;
        const ok = ship.sw.canStand(x, rm.y, z);
        if (!ok) continue;
        ship.aboard = true; ship.sw.place(x, ok.floor, z, 0);
        for (const yaw of yaws) for (const pitch of [-0.4, 0, 0.4]) {
          ship.sw.yaw = yaw * Math.PI / 180; ship.sw.pitch = pitch;
          for (let i = 0; i < 3; i++) engine.step(1 / 60);
          gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
          let c = 0;
          for (let i = 0; i < buf.length; i += 4) if (buf[i] >= 250 && buf[i + 1] <= 10 && buf[i + 2] >= 250) c++;
          if (c > 0) { n++; if (!worst || c > worst.c) worst = { c, x: +x.toFixed(1), z: +z.toFixed(1), yaw, pitch }; }
        }
      }
      out.push(`${id}: ${n} views with gaps${worst ? ' worst ' + JSON.stringify(worst) : ''}`);
    }
  } finally {
    engine.scene.background = bg; engine.scene.visible = true; r.setClearColor(0x000000, 1);
    r.setPixelRatio(pr); r.setSize(W0, H0, true); engine.camera.aspect = W0 / H0; engine.camera.updateProjectionMatrix();
  }
  return out.join('\n');
}
