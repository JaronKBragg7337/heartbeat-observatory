/* ============================================================================
   scene.js - what The Arena looks like (built from zones.json)
   ---------------------------------------------------------------------------
   A speedball paintball field: cut turf with painted lines, inflatable
   bunkers in each team's colour (blocks and cans), low wooden walls, two
   wooden ramps, a netted perimeter on posts, a start pad with a canopy at
   each base, a soft light curtain on the centre line (the seam between page
   A and page B), trees and sky beyond the net.

   arena.js import()s this file and calls buildField(); when zones.json's
   cover or "v" changes (the hot-load), it throws the old group away and
   calls buildField() again with the new data. Nothing here touches players,
   balls or the network. It only draws.
   ========================================================================== */

export function buildField({ THREE, F, data, RoundedBoxGeometry, mergeGeometries, quality }) {
  const group = new THREE.Group();
  group.name = "arena-field";
  const aimables = [];
  const disposables = [];
  const low = quality === "low";
  const TEAM = {
    a: (data.teams && data.teams.a) || { color: "#f07a2b", dark: "#a8481a" },
    b: (data.teams && data.teams.b) || { color: "#1f9bd6", dark: "#14608a" },
  };
  const HX = F.halfX, HZ = F.halfZ;

  function canvas(w, h, draw) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    disposables.push(t);
    return t;
  }
  function mat(o) { const m = new THREE.MeshStandardMaterial(o); disposables.push(m); return m; }
  function add(geo, m, o) {
    const mesh = new THREE.Mesh(geo, m);
    disposables.push(geo);
    if (o && o.cast) mesh.castShadow = true;
    if (!o || o.receive !== false) mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }
  // a small stable random, so every browser draws the same field
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  /* ---------------------------------------------------------- the turf - */
  const PX = 26;  // texture pixels per metre
  const turfTex = canvas(HX * 2 * PX, HZ * 2 * PX, (g, w, h) => {
    // mowing stripes, 2.5 m wide, across the field
    for (let x = 0; x < w; x += 2.5 * PX) {
      g.fillStyle = Math.round(x / (2.5 * PX)) % 2 ? "#3f7a34" : "#467f38";
      g.fillRect(x, 0, 2.5 * PX + 1, h);
    }
    // blades: fine noise
    const img = g.getImageData(0, 0, w, h), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (rnd() - 0.5) * 26;
      d[i] = Math.max(0, d[i] + n * 0.6); d[i + 1] = Math.max(0, d[i + 1] + n); d[i + 2] = Math.max(0, d[i + 2] + n * 0.5);
    }
    g.putImageData(img, 0, 0);
    // worn patches near the bases and the centre
    for (const [cx, cy, r] of [[2.5, HZ, 3], [HX * 2 - 2.5, HZ, 3], [HX, HZ, 2.2]]) {
      const gr = g.createRadialGradient(cx * PX, cy * PX, 0, cx * PX, cy * PX, r * PX);
      gr.addColorStop(0, "rgba(120,104,70,.45)"); gr.addColorStop(1, "rgba(120,104,70,0)");
      g.fillStyle = gr; g.fillRect((cx - r) * PX, (cy - r) * PX, r * 2 * PX, r * 2 * PX);
    }
    // team tint, a band along each half's side lines
    g.globalAlpha = 0.28;
    g.fillStyle = TEAM.a.color; g.fillRect(0, 0, HX * PX, 0.6 * PX); g.fillRect(0, h - 0.6 * PX, HX * PX, 0.6 * PX);
    g.fillStyle = TEAM.b.color; g.fillRect(HX * PX, 0, HX * PX, 0.6 * PX); g.fillRect(HX * PX, h - 0.6 * PX, HX * PX, 0.6 * PX);
    g.globalAlpha = 1;
    // painted lines: border, centre line (the seam), base boxes, a centre circle
    g.strokeStyle = "rgba(244,244,236,.92)"; g.lineWidth = 0.12 * PX;
    g.strokeRect(0.5 * PX, 0.5 * PX, w - PX, h - PX);
    g.lineWidth = 0.22 * PX;
    g.beginPath(); g.moveTo(w / 2, 0.5 * PX); g.lineTo(w / 2, h - 0.5 * PX); g.stroke();
    g.lineWidth = 0.12 * PX;
    g.beginPath(); g.arc(w / 2, h / 2, 2.2 * PX, 0, Math.PI * 2); g.stroke();
    for (const side of [0, 1]) {
      const x0 = side ? w - 5 * PX : 0.5 * PX;
      g.strokeRect(x0, h / 2 - 3.2 * PX, 4.5 * PX, 6.4 * PX);
    }
    // big team letters on each half, near the base
    g.font = `900 ${5.2 * PX}px system-ui, Arial, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
    g.globalAlpha = 0.34;
    g.fillStyle = TEAM.a.color; g.save(); g.translate(7.2 * PX, h / 2); g.rotate(Math.PI / 2); g.fillText("A", 0, 0); g.restore();
    g.fillStyle = TEAM.b.color; g.save(); g.translate(w - 7.2 * PX, h / 2); g.rotate(-Math.PI / 2); g.fillText("B", 0, 0); g.restore();
    g.globalAlpha = 1;
  });
  const turf = add(new THREE.PlaneGeometry(HX * 2, HZ * 2), mat({ map: turfTex, roughness: 0.97, metalness: 0 }));
  turf.rotation.x = -Math.PI / 2;
  turf.name = "turf";
  aimables.push(turf);

  // the land around the field (darker, rougher grass), and a gravel path along the net
  const outerTex = canvas(256, 256, (g, w, h) => {
    g.fillStyle = "#3a6430"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${20 + rnd() * 40},${60 + rnd() * 50},${20 + rnd() * 25},.5)`; g.fillRect(rnd() * w, rnd() * h, 2, 2); }
  });
  outerTex.wrapS = outerTex.wrapT = THREE.RepeatWrapping; outerTex.repeat.set(30, 30);
  const outer = add(new THREE.PlaneGeometry(220, 220), mat({ map: outerTex, roughness: 1 }), { receive: true });
  outer.rotation.x = -Math.PI / 2; outer.position.y = -0.02;
  const path = add(new THREE.PlaneGeometry(HX * 2 + 3, HZ * 2 + 3), mat({ color: 0x8f8574, roughness: 1 }));
  path.rotation.x = -Math.PI / 2; path.position.y = -0.01;

  /* ------------------------------------------- the seam: a light curtain - */
  const curtainTex = canvas(4, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.55, "rgba(255,250,235,.35)"); gr.addColorStop(1, "rgba(255,250,235,.9)");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  const curtainMat = new THREE.MeshBasicMaterial({ map: curtainTex, transparent: true, opacity: 0.26, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  disposables.push(curtainMat);
  const curtain = add(new THREE.PlaneGeometry(HZ * 2, 3.2), curtainMat, { receive: false });
  curtain.rotation.y = Math.PI / 2; curtain.position.set(0, 1.6, 0); curtain.name = "seam-curtain";
  curtain.renderOrder = 2;

  /* ------------------------------------------------- the net and posts - */
  const netTex = canvas(64, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = "rgba(20,24,22,.85)"; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(w, h); g.moveTo(w, 0); g.lineTo(0, h); g.stroke();
  });
  netTex.wrapS = netTex.wrapT = THREE.RepeatWrapping;
  const netH = F.netHeight;
  const netMat = new THREE.MeshStandardMaterial({ map: netTex, transparent: true, alphaTest: 0.08, side: THREE.DoubleSide, roughness: 1, depthWrite: false });
  disposables.push(netMat);
  const mesh = 0.12; // a 12 cm diamond mesh
  for (const [len, x, z, ry] of [[HX * 2, 0, -HZ, 0], [HX * 2, 0, HZ, 0], [HZ * 2, -HX, 0, Math.PI / 2], [HZ * 2, HX, 0, Math.PI / 2]]) {
    const t = netTex.clone(); t.needsUpdate = true; t.repeat.set(len / mesh / 3, netH / mesh / 3); disposables.push(t);
    const m = netMat.clone(); m.map = t; disposables.push(m);
    const n = add(new THREE.PlaneGeometry(len, netH), m, { receive: false });
    n.position.set(x, netH / 2, z); n.rotation.y = ry; n.renderOrder = 1;
  }
  // posts every 4 m (one instanced mesh) and a top cable
  const postSpots = [];
  for (let x = -HX; x <= HX + 0.01; x += 4) postSpots.push([x, -HZ], [x, HZ]);
  for (let z = -HZ + 4; z <= HZ - 3.99; z += 4) postSpots.push([-HX, z], [HX, z]);
  const postGeo = new THREE.CylinderGeometry(0.06, 0.07, netH + 0.3, 8); disposables.push(postGeo);
  const posts = new THREE.InstancedMesh(postGeo, mat({ color: 0x3b3f42, roughness: 0.5, metalness: 0.6 }), postSpots.length);
  const m4 = new THREE.Matrix4();
  postSpots.forEach(([x, z], i) => { m4.makeTranslation(x, (netH + 0.3) / 2, z); posts.setMatrixAt(i, m4); });
  posts.castShadow = true; group.add(posts);
  // padded skirt at the bottom of the net, team colour per half
  for (const side of ["a", "b"]) {
    const sx = side === "a" ? -1 : 1;
    const skirtM = mat({ color: TEAM[side].dark, roughness: 0.8 });
    for (const z of [-HZ, HZ]) { const s = add(new THREE.BoxGeometry(HX, 0.5, 0.06), skirtM); s.position.set(sx * HX / 2, 0.25, z); }
    const e = add(new THREE.BoxGeometry(0.06, 0.5, HZ * 2), skirtM); e.position.set(sx * HX, 0.25, 0);
  }

  /* -------------------------------------------------------- the cover - */
  // one material per team per kind, so the whole field is a handful of draw-call kinds
  const bandTex = (side) => canvas(256, 128, (g, w, h) => {
    g.fillStyle = TEAM[side].color; g.fillRect(0, 0, w, h);
    // the vinyl sheen: a soft vertical shade
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "rgba(255,255,255,.14)"); gr.addColorStop(0.5, "rgba(255,255,255,0)"); gr.addColorStop(1, "rgba(0,0,0,.18)");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    // a white band with the team letter, and stitched seams
    g.fillStyle = "rgba(250,250,245,.92)"; g.fillRect(0, h * 0.38, w, h * 0.2);
    g.fillStyle = TEAM[side].dark; g.font = "900 22px system-ui, Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    for (let x = 32; x < w; x += 96) g.fillText(side.toUpperCase(), x, h * 0.48);
    g.strokeStyle = "rgba(0,0,0,.22)"; g.setLineDash([3, 3]); g.lineWidth = 1.5;
    for (const y of [h * 0.12, h * 0.88]) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  });
  const bunkerMat = { a: mat({ map: bandTex("a"), roughness: 0.45, metalness: 0.02 }), b: mat({ map: bandTex("b"), roughness: 0.45, metalness: 0.02 }) };
  const woodTex = canvas(256, 256, (g, w, h) => {
    for (let y = 0; y < h; y += 32) {
      const base = 120 + rnd() * 30;
      g.fillStyle = `rgb(${base + 30},${base - 5},${base - 50})`; g.fillRect(0, y, w, 31);
      for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(70,45,20,${0.08 + rnd() * 0.12})`; g.fillRect(rnd() * w, y + rnd() * 30, 30 + rnd() * 80, 1); }
      g.fillStyle = "rgba(40,25,10,.55)"; g.fillRect(0, y + 31, w, 1);
      g.fillStyle = "rgba(60,60,60,.7)"; for (const x of [12, w - 14]) { g.beginPath(); g.arc(x, y + 16, 2, 0, 7); g.fill(); }
    }
  });
  woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping;
  const woodMat = mat({ map: woodTex, roughness: 0.85 });

  const canGeoCache = new Map();
  function canGeo(r, h) {
    const k = r + "|" + h;
    if (canGeoCache.has(k)) return canGeoCache.get(k);
    const pts = [], rr = Math.min(0.16, r * 0.3);
    pts.push(new THREE.Vector2(0, 0), new THREE.Vector2(r, 0), new THREE.Vector2(r, h - rr));
    for (let i = 1; i <= 6; i++) { const a = (i / 6) * Math.PI / 2; pts.push(new THREE.Vector2(r - rr + Math.cos(a) * rr, h - rr + Math.sin(a) * rr)); }
    pts.push(new THREE.Vector2(0, h));
    const g = new THREE.LatheGeometry(pts, low ? 16 : 28);
    canGeoCache.set(k, g); disposables.push(g);
    return g;
  }
  const byId = {};
  for (const c of F.cover) {
    const side = c.x < 0 ? "a" : "b";
    let m;
    if (c.kind === "can") {
      m = new THREE.Mesh(canGeo(c.r, c.h), bunkerMat[side]);
      m.position.set(c.x, 0, c.z);
    } else if (c.kind === "block") {
      const geo = RoundedBoxGeometry ? new RoundedBoxGeometry(c.w, c.h, c.d, 3, Math.min(0.16, c.w * 0.12, c.d * 0.12)) : new THREE.BoxGeometry(c.w, c.h, c.d);
      disposables.push(geo);
      m = new THREE.Mesh(geo, bunkerMat[side]);
      m.position.set(c.x, c.h / 2, c.z);
    } else if (c.kind === "wall") {
      const geo = new THREE.BoxGeometry(c.w, c.h, c.d); disposables.push(geo);
      m = new THREE.Mesh(geo, woodMat);
      m.position.set(c.x, c.h / 2, c.z);
      // two braces behind it
      for (const s of [-1, 1]) {
        const bg = new THREE.BoxGeometry(0.08, c.h * 0.9, 0.08); disposables.push(bg);
        const b = new THREE.Mesh(bg, woodMat);
        const along = c.d >= c.w;
        b.position.set(c.x + (along ? 0 : s * (c.w / 2 - 0.15)), c.h * 0.45, c.z + (along ? s * (c.d / 2 - 0.15) : 0));
        b.castShadow = true; group.add(b);
      }
    } else if (c.kind === "ramp") {
      // a wedge: triangle profile along the rise, extruded across it
      const along = c.rise === "+z" || c.rise === "-z" ? c.d : c.w, across = c.rise === "+z" || c.rise === "-z" ? c.w : c.d;
      const sh = new THREE.Shape(); sh.moveTo(-along / 2, 0); sh.lineTo(along / 2, 0); sh.lineTo(along / 2, c.h); sh.lineTo(-along / 2, 0);
      const geo = new THREE.ExtrudeGeometry(sh, { depth: across, bevelEnabled: false }); geo.translate(0, 0, -across / 2); disposables.push(geo);
      const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.5, uv.getY(i) * 0.5);
      m = new THREE.Mesh(geo, woodMat);
      m.position.set(c.x, 0, c.z);
      m.rotation.y = { "+x": 0, "-x": Math.PI, "+z": -Math.PI / 2, "-z": Math.PI / 2 }[c.rise || "+x"];
    }
    if (!m) continue;
    m.castShadow = true; m.receiveShadow = true; m.name = c.id; m.userData.cover = c.id;
    group.add(m); aimables.push(m); byId[c.id] = m;
  }

  /* ----------------------------------------------- the bases (start pads) - */
  for (const side of ["a", "b"]) {
    const sx = side === "a" ? -1 : 1, bx = sx * (HX - 2.6);
    const pad = add(new THREE.BoxGeometry(4.2, 0.04, 6.2), mat({ color: TEAM[side].dark, roughness: 0.9 }));
    pad.position.set(bx, 0.02, 0);
    // a gear canopy in the base's corner (not over the spawn: the camera would look up into its roof)
    const poleM = mat({ color: 0xd9dcdf, metalness: 0.6, roughness: 0.4 });
    const tx = sx * (HX - 1.6), tz = -sx * (HZ - 2.0);
    for (const [px, pz] of [[-1, -1.2], [1, -1.2], [-1, 1.2], [1, 1.2]]) {
      const p = add(new THREE.CylinderGeometry(0.035, 0.035, 2.6, 6), poleM, { cast: true }); p.position.set(tx + px, 1.3, tz + pz);
    }
    const roof = add(new THREE.ConeGeometry(1.75, 0.7, 4, 1), mat({ color: TEAM[side].color, roughness: 0.7, side: THREE.DoubleSide }), { cast: true });
    roof.position.set(tx, 2.95, tz); roof.rotation.y = Math.PI / 4; roof.scale.set(1.15, 1, 1.4);
    // a gear table and a row of hoppers under it
    const table = add(new THREE.BoxGeometry(0.7, 0.05, 1.8), mat({ color: 0xe9e6dc, roughness: 0.7 }), { cast: true }); table.position.set(tx + sx * 0.3, 0.75, tz);
    for (const s of [-0.8, 0.8]) { const l = add(new THREE.BoxGeometry(0.05, 0.75, 0.05), poleM); l.position.set(tx + sx * 0.3, 0.37, tz + s); }
    for (let i = 0; i < 4; i++) { const hp = add(new THREE.SphereGeometry(0.11, 10, 8), mat({ color: TEAM[side].color, roughness: 0.3 })); hp.position.set(tx + sx * 0.3, 0.86, tz - 0.6 + i * 0.4); hp.scale.y = 0.8; }
    // a banner on the net behind the base
    const bannerTex = canvas(512, 128, (g, w, h) => {
      g.fillStyle = TEAM[side].color; g.fillRect(0, 0, w, h);
      g.fillStyle = "#fff"; g.font = "900 64px system-ui, Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(`TEAM ${side.toUpperCase()} · PAGE ${side.toUpperCase()}`, w / 2, h / 2 + 4);
    });
    const banner = add(new THREE.PlaneGeometry(6, 1.5), mat({ map: bannerTex, roughness: 0.8, side: THREE.DoubleSide }), { receive: false });
    banner.position.set(sx * (HX - 0.08), 2.4, 0); banner.rotation.y = -sx * Math.PI / 2;
  }

  /* ------------------------------------------------- beyond the net - */
  // trees in a ring (instanced: two meshes for all of them)
  const trees = [];
  for (let i = 0; i < (low ? 40 : 70); i++) {
    const a = rnd() * Math.PI * 2, r = 34 + rnd() * 30;
    const x = Math.cos(a) * r * 1.25, z = Math.sin(a) * r * 0.9;
    if (Math.abs(x) < HX + 6 && Math.abs(z) < HZ + 6) continue;
    trees.push([x, z, 0.8 + rnd() * 0.7]);
  }
  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 3, 6); trunkGeo.translate(0, 1.5, 0); disposables.push(trunkGeo);
  const crownGeo = new THREE.ConeGeometry(2.3, 6.5, 7); crownGeo.translate(0, 5.6, 0); disposables.push(crownGeo);
  const trunks = new THREE.InstancedMesh(trunkGeo, mat({ color: 0x5a4130, roughness: 1 }), trees.length);
  const crowns = new THREE.InstancedMesh(crownGeo, mat({ color: 0x2d5a2c, roughness: 1 }), trees.length);
  const col = new THREE.Color();
  trees.forEach(([x, z, s], i) => {
    m4.makeScale(s, s * (0.9 + rnd() * 0.3), s); m4.setPosition(x, 0, z);
    trunks.setMatrixAt(i, m4); crowns.setMatrixAt(i, m4);
    col.setHSL(0.27 + rnd() * 0.06, 0.38, 0.22 + rnd() * 0.08); crowns.setColorAt(i, col);
  });
  group.add(trunks, crowns);

  // sky dome: a gradient from haze at the horizon to blue overhead
  const skyGeo = new THREE.SphereGeometry(180, 24, 12); disposables.push(skyGeo);
  const cAttr = [], top = new THREE.Color(0x5d93c9), hor = new THREE.Color(0xdfe7ea), pos = skyGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) { const k = Math.max(0, pos.getY(i) / 180); const c = hor.clone().lerp(top, Math.pow(k, 0.55)); cAttr.push(c.r, c.g, c.b); }
  skyGeo.setAttribute("color", new THREE.Float32BufferAttribute(cAttr, 3));
  const skyMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthWrite: false, fog: false }); disposables.push(skyMat);
  const sky = new THREE.Mesh(skyGeo, skyMat); sky.renderOrder = -1; group.add(sky);

  /* ------------------------------------------- the phone budget: merge - */
  /* Static meshes that share a look (same material settings, same shadow flags) become one mesh: the 18 pieces of
     cover, the braces, the base props. The cover meshes stay in the group, hidden, so aiming, the camera's push-in
     and splat ids still raycast against each piece (a Raycaster does not skip hidden meshes). Without
     mergeGeometries (an older arena.js) nothing is merged. */
  const merged = mergeStatic();
  function mergeStatic() {
    if (!mergeGeometries) return 0;
    group.updateMatrixWorld(true);
    const buckets = new Map();
    for (const m of group.children) {
      if (!m.isMesh || m.isInstancedMesh || m === sky || m === curtain || !m.material || m.material.transparent || Array.isArray(m.material)) continue;
      const t = m.material;
      const key = [t.type, t.color ? t.color.getHex() : "", t.roughness, t.metalness, t.map ? t.map.uuid : "", t.side, t.vertexColors, m.castShadow, m.receiveShadow].join("|");
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(m);
    }
    let n = 0;
    for (const list of buckets.values()) {
      if (list.length < 2) continue;
      const geos = list.map((m) => {
        const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
        g.applyMatrix4(m.matrixWorld);
        for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal" && k !== "uv") g.deleteAttribute(k);
        if (!g.attributes.uv) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
        g.morphAttributes = {};
        return g;
      });
      const geo = mergeGeometries(geos, false);
      for (const g of geos) g.dispose();
      if (!geo) continue;
      disposables.push(geo);
      const one = new THREE.Mesh(geo, list[0].material);
      one.castShadow = list[0].castShadow; one.receiveShadow = list[0].receiveShadow; one.name = "merged";
      group.add(one); n += list.length;
      for (const m of list) { if (aimables.includes(m)) m.visible = false; else group.remove(m); }
    }
    return n;
  }

  return {
    group, aimables, byId, curtain, merged,
    dispose() {
      for (const d of disposables) { try { d.dispose(); } catch (_) {} }
      posts.dispose(); trunks.dispose(); crowns.dispose();
    },
  };
}
export default buildField;
