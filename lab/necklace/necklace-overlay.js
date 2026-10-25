// hb-render: Necklace view overlay. Draws fading trails (colored by speed), hit marks and soak marks from a History
// onto a 2D canvas context, for the clip's recorded camera. Shared by tools/clip.mjs (burned into the overlay video)
// and web/necklace.html (live on top of the plain video, so drops can be tapped).

export function projector(cam, w, h) {
  const [px, py, pz, tx, ty, tz, fov] = cam;
  let f = [tx - px, ty - py, tz - pz]; const fl = Math.hypot(...f); f = f.map((v) => v / fl);
  let r = [-f[2], 0, f[0]]; const rl = Math.hypot(...r); r = r.map((v) => v / rl);   // right = cross(fwd, worldUp), as in the tracer
  const U = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];   // up = cross(right, fwd)
  const tanH = Math.tan(fov * Math.PI / 360), aspect = w / h;
  return (p) => {
    const d = [p[0] - px, p[1] - py, p[2] - pz];
    const z = d[0] * f[0] + d[1] * f[1] + d[2] * f[2]; if (z < 0.01) return null;
    const x = d[0] * r[0] + d[1] * r[1] + d[2] * r[2], y = d[0] * U[0] + d[1] * U[1] + d[2] * U[2];
    return [(0.5 + 0.5 * x / (z * tanH * aspect)) * w, (0.5 - 0.5 * y / (z * tanH)) * h, z];   // camera fov is VERTICAL (tracer: ndcX = x * tanHalf * aspect)
  };
}

// speed (m/s) -> color: slow blue, mid cyan/green, fast yellow, very fast red
export function speedColor(s, a = 1) {
  const t = Math.min(1, s / 2.5), hue = 220 - t * 220;
  return `hsla(${hue.toFixed(0)}, 95%, ${(58 + 8 * (1 - t)).toFixed(0)}%, ${a.toFixed(3)})`;
}

export function drawOverlay(ctx, w, h, H, t, opts = {}) {
  const M = H.meta, f = H.frameOf(t), cam = M.cameras[f]; if (!cam) return;
  const P = projector(cam, w, h), px = w / 1080 * (opts.scale || 1);
  const tail = opts.tail ?? 0.35;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // trails of the fully traced drops
  for (const tr of H.tracked) {
    const s = tr.s; if (!s.length || s[0][0] > t || s[s.length - 1][0] < t - tail) continue;
    let prev = null;
    for (let i = 0; i < s.length; i++) {
      const r = s[i]; if (r[0] > t + 1e-6) break; if (r[0] < t - tail) { prev = null; continue; }
      const q = P([r[1], r[2], r[3]]); if (!q) { prev = null; continue; }
      const sp = Math.hypot(r[4], r[5], r[6]), age = (t - r[0]) / tail, a = Math.max(0, 1 - age);
      if (prev) { ctx.strokeStyle = speedColor(sp, a * 0.95); ctx.lineWidth = Math.max(1.5, (5.5 * a + 1.5) * px); ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); }
      prev = q;
      if (i === s.length - 1 || s[i + 1][0] > t) { ctx.fillStyle = speedColor(sp, 1); ctx.beginPath(); ctx.arc(q[0], q[1], 3.6 * px, 0, 6.2832); ctx.fill(); }
    }
  }
  // hit marks (rings that grow and fade) and soak marks (small crosses)
  const hitLife = opts.hitLife ?? 0.5;
  for (const e of H.events) {
    if (e.t > t || e.t < t - hitLife) continue;
    if (e.e !== 'collided' && e.e !== 'soaked') continue;
    if (e.target !== 'SAND') continue;
    const ix = parseInt(e.id.slice(2), 10) - 1, tm = M.trackMod || 20;
    if (ix % (e.e === 'soaked' ? tm * 6 : tm) !== 0) continue;   // marks only for the traced drops (soak marks thinned so they do not flood the pool)
    const q = P(e.p); if (!q) continue;
    const age = (t - e.t) / hitLife, a = 1 - age;
    if (e.e === 'collided') { ctx.strokeStyle = `rgba(255,255,255,${(0.9 * a).toFixed(3)})`; ctx.lineWidth = 2 * px; ctx.beginPath(); ctx.arc(q[0], q[1], (4 + 14 * age) * px, 0, 6.2832); ctx.stroke(); }
    else { ctx.strokeStyle = `rgba(255,90,200,${(0.95 * a).toFixed(3)})`; ctx.lineWidth = 2.2 * px; const r = 5 * px; ctx.beginPath(); ctx.moveTo(q[0] - r, q[1] - r); ctx.lineTo(q[0] + r, q[1] + r); ctx.moveTo(q[0] + r, q[1] - r); ctx.lineTo(q[0] - r, q[1] + r); ctx.stroke(); }
  }
  ctx.restore();
}

// every traced particle alive at t, projected: [{id, x, y, speed}] (used for tap picking)
export function pickables(H, t, w, h) {
  const M = H.meta, cam = M.cameras[H.frameOf(t)]; if (!cam) return [];
  const P = projector(cam, w, h), out = [];
  for (const tr of H.traces.values()) {
    const st = H.stateAt(tr.id, t); if (!st) continue;
    const q = P(st.p); if (!q) continue;
    out.push({ id: tr.id, x: q[0], y: q[1], z: q[2], speed: Math.hypot(...st.v) });
  }
  return out;
}
