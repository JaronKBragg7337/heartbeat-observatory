// Third-person follow camera: look-drag yaw/pitch, slow auto-recentre behind the player, and it pulls in when
// something stands between it and the player. Also the scripted shots (title orbit, ending side view, director).
// Uses only camera.position.set / camera.lookAt, so it needs no three import.
const damp = (a, b, r, dt) => a + (b - a) * (1 - Math.exp(-r * dt));
function angDamp(a, b, r, dt) { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * (1 - Math.exp(-r * dt)); }

export function makeFollowCam(camera, world) {
  const c = {
    yaw: Math.PI, pitch: 0.42, dist: 3.9, distNow: 3.9, height: 1.35, lookIdle: 9,
    mode: 'person', x: 0, y: 0, z: 0, fx: 0, fz: 1, shake: 0,
    shot: null,             // scripted shot: { from: {x,y,z}, at: {x,y,z}, blend }
  };
  let tx = 0, ty = 0, tz = 0, inited = false, blend = 0;

  c.look = (dx, dy) => {
    c.yaw -= dx * 0.0062; c.pitch = Math.max(-0.1, Math.min(0.95, c.pitch + dy * 0.004)); c.lookIdle = 0;
  };
  c.snapBehind = (heading) => { c.yaw = heading; c.lookIdle = 9; inited = false; };
  c.setMode = (m) => {
    c.mode = m;
    if (m === 'turkey') { c.dist = 8.8; c.height = 0.6; c.pitch = 0.66; }
    else { c.dist = 3.9; c.height = 1.35; c.pitch = 0.42; }
  };

  // focus: { x, y, z } (ground point of the actor), heading: the actor's facing, moving: speed m/s
  c.update = (dt, focus, heading, speed) => {
    c.lookIdle += dt;
    if (c.mode === 'turkey') {
      // mostly south, with a little lean toward where you steer; look-drag can peek around
      if (c.lookIdle > 1.6) c.yaw = angDamp(c.yaw, 0, 1.4, dt);
      if (c.lookIdle > 1.6) c.pitch = damp(c.pitch, 0.66, 1.4, dt);
    } else if (c.lookIdle > 1.3 && speed > 0.6) {
      // walking toward the camera must not spin it around: only recentre when heading roughly away from it
      let d = heading - c.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      // (and only when going mostly forward: a sideways push would otherwise walk you in a circle)
      const off = Math.abs(d);
      if (off < 1.1) c.yaw = angDamp(c.yaw, heading, 0.9 * (1 - off / 1.1) * Math.min(1, speed / 2.6), dt);
    }
    const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
    c.fx = fx; c.fz = fz;
    // the actor's point, smoothed
    const ax = focus.x, ay = (focus.y || 0) + c.height, az = focus.z;
    if (!inited) { tx = ax; ty = ay; tz = az; inited = true; c.distNow = c.dist; }
    tx = damp(tx, ax, 14, dt); ty = damp(ty, ay, 10, dt); tz = damp(tz, az, 14, dt);
    const cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
    // pull in when a collider (or a roof) is between the actor and the camera: fast in, slow back out
    const full = c.dist * cp;
    const wx = focus.x - fx * full, wz = focus.z - fz * full;
    const hit = Math.min(world.raycast(focus.x, focus.z, wx, wz, 1.6, 0.3, 0.35), world.raycastRoofs ? world.raycastRoofs(focus.x, focus.z, wx, wz) : 1);
    const want = Math.max(1.1, full * hit - 0.25) / cp;
    c.distNow = want < c.distNow ? damp(c.distNow, want, 18, dt) : damp(c.distNow, want, 2.5, dt);
    const k = c.distNow / c.dist;                       // 1 = normal, smaller = pulled in
    const lead = (c.mode === 'turkey' ? 4 : 1.2) * k;   // look a little ahead (less when pulled in)
    let px = tx - fx * c.distNow * cp, py = ty + c.distNow * sp, pz = tz - fz * c.distNow * cp;
    const lkx = tx + fx * lead, lky = ty + (c.mode === 'turkey' ? 0 : 0.1), lkz = tz + fz * lead;
    if (c.shot) {
      blend = damp(blend, 1, c.shot.rate || 1.6, dt);
      const s = c.shot;
      px += (s.from.x - px) * blend; py += (s.from.y - py) * blend; pz += (s.from.z - pz) * blend;
      const lx = lkx + (s.at.x - lkx) * blend, ly = lky + (s.at.y - lky) * blend, lz = lkz + (s.at.z - lkz) * blend;
      if (c.shake > 0) { c.shake = Math.max(0, c.shake - dt * 2); py += Math.sin(performance.now() * 0.05) * c.shake * 0.05; }
      camera.position.set(px, Math.max(0.35, py), pz); camera.lookAt(lx, ly, lz);
      c.x = px; c.y = py; c.z = pz; return;
    }
    blend = 0;
    if (c.shake > 0) { c.shake = Math.max(0, c.shake - dt * 2.5); px += Math.sin(performance.now() * 0.061) * c.shake * 0.08; py += Math.sin(performance.now() * 0.047) * c.shake * 0.08; }
    camera.position.set(px, Math.max(0.35, py), pz);
    camera.lookAt(lkx, lky, lkz);
    c.x = px; c.y = py; c.z = pz;
  };
  // The end of a round (found it, pecked, caught, got away): one side-on shot that holds the person AND the turkey.
  // It tries 12 directions round the pair, keeps the one with the most open room (walls and roofs block), nearest the
  // camera's own side, and remembers it, so the shot does not hunt about while the turkey moves.
  let endDir = null;
  c.endShot = (a, b, lift = 0) => {
    const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2, far = Math.hypot(a.x - b.x, a.z - b.z), span = Math.min(14, far);
    const want = camera.aspect < 1 ? 4.2 + span * 0.5 : 3.6 + span * 0.75;
    if (far > 9) {
      // far apart (it got away through a gap): stand a few steps back from the turkey on the farm side and watch it go
      const ux = (b.x - a.x) / far, uz = (b.z - a.z) / far;
      const back = 4.6 * Math.max(0.4, world.raycast(b.x, b.z, b.x - ux * 4.6, b.z - uz * 4.6, 1.6, 0.3));
      return { from: { x: b.x - ux * back + uz * 1.2, y: 1.9, z: b.z - uz * back - ux * 1.2 }, at: { x: b.x, y: 0.55 + lift * 0.9, z: b.z }, rate: 2.4 };
    }
    const inside = world.roofs && world.roofs.some((r) => mx > r.minX && mx < r.maxX && mz > r.minZ && mz < r.maxZ);
    if (!endDir) {
      let best = -1e9;
      for (let i = 0; i < 12; i++) {
        const ang = c.yaw + Math.PI + (i * Math.PI) / 6, dx = Math.sin(ang), dz = Math.cos(ang);
        const ex = mx + dx * want, ez = mz + dz * want;
        const room = Math.min(world.raycast(mx, mz, ex, ez, 1.6, 0.3), inside ? 1 : world.raycastRoofs(mx, mz, ex, ez));
        let off = Math.abs(((i * Math.PI) / 6 + Math.PI) % (2 * Math.PI) - Math.PI);   // 0 = straight behind the camera's look
        // a tall phone screen holds the pair one behind the other (looking along them, a little off so neither hides
        // the other); a wide screen holds them side by side
        const along = span > 1.5 ? Math.abs((dx * (b.x - a.x) + dz * (b.z - a.z)) / span) : 0.9;
        const fit = camera.aspect < 1 ? Math.abs(along - 0.9) : along;
        const score = room * 2.2 - off * 0.12 - fit * 1.4;
        if (score > best) { best = score; endDir = { dx, dz, room }; }
      }
    }
    const d = Math.max(1.6, want * endDir.room - 0.35);
    const h = inside ? 2.0 : 2.2 + span * 0.12;
    return { from: { x: mx + endDir.dx * d, y: h, z: mz + endDir.dz * d }, at: { x: mx, y: 0.6 + lift, z: mz }, rate: 2.4 };
  };
  c.setShot = (shot) => { c.shot = shot; if (!shot) { blend = 0; endDir = null; } };
  c.reset = () => { inited = false; c.lookIdle = 9; c.shot = null; blend = 0; endDir = null; c.distNow = c.dist; };
  return c;
}

// A slow cinematic orbit (title screen and director cut-aways).
export function orbitShot(camera, t, cx, cz, r, h, speed = 0.05, lookY = 1) {
  const a = t * speed;
  camera.position.set(cx + Math.cos(a) * r, h, cz + Math.sin(a) * r);
  camera.lookAt(cx, lookY, cz);
}
