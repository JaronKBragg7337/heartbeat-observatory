/* ============================================================================
   den.js - Page D, the media room behind A's oak door
   ---------------------------------------------------------------------------
   The mirror of the garage (garage.js) on the other side of the front wall,
   built into the SAME scene (one world, no portal): open A's door and you see
   straight in; from inside you see the room. room.js passes its helpers in (k).
   Interior: x -8.25..-2.15, z 4.15..9.55, 2.75 m tall. The shared wall with the
   room is z 4.00..4.15; A's door opening is x -5.06..-4.14, 2.05 m high.
   A desk with a computer that plays the daily Heartbeat News (createNewsTV),
   a reading chair, books, a window, and TWO closed doors that are future
   pages ("d-side" on the x = -8.25 wall, "d-back" on the far wall).
   Few shadow casters on purpose: only the ceiling, back and left walls (so the
   room's sun stays out). One warm ceiling light; lamps are emissive only.
   ========================================================================== */

export function buildDen(k) {
  const { THREE, scene, M, box, cyl, plane, canvasTex, rnd, solids, signTex, RoundedBoxGeometry } = k;
  const D = { x0: -8.25, x1: -2.15, z0: 4.15, z1: 9.55, h: 2.75 };
  const DW = D.x1 - D.x0, DD = D.z1 - D.z0, CX = (D.x0 + D.x1) / 2, CZ = (D.z0 + D.z1) / 2;
  const DOOR = { x0: -5.06, x1: -4.14, h: 2.05 };
  const SIDE = { z0: 6.4, z1: 7.3, h: 2.05 };       // future door "d-side" on the x0 wall
  const BACK = { x0: -3.41, x1: -2.49, h: 2.05 };   // future door "d-back" on the far wall
  const WIN = { z0: 6.85, z1: 8.05, y0: 0.95, y1: 2.2 };   // window on the x1 wall
  const NC = { cast: false };
  const solid = (a, b, c, d) => solids.push([a, b, c, d]);
  const RB = (w, h, d, r) => new RoundedBoxGeometry(w, h, d, 2, r);
  const mesh = (geo, mat, x, y, z, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.receiveShadow = true; (parent || scene).add(m); return m; };

  /* ---------------------------------------------------------- textures - */
  // narrow warm oak boards, offset joints
  const boards = canvasTex(1024, 1024, (g, w, h) => {
    const r = rnd(501), bw = 48;
    for (let i = 0; i < h / bw; i++) {
      let x = -r() * 500;
      while (x < w) {
        const len = 300 + r() * 420, tone = (r() - 0.5) * 24;
        g.fillStyle = `rgb(${132 + tone},${90 + tone * 0.8},${58 + tone * 0.6})`; g.fillRect(x, i * bw, len, bw);
        for (let q = 0; q < 10; q++) {
          g.strokeStyle = `rgba(${45 + r() * 25},${28 + r() * 15},12,${0.06 + r() * 0.08})`; g.lineWidth = 0.6 + r() * 1.2;
          const y = i * bw + r() * bw; g.beginPath(); g.moveTo(x, y);
          g.bezierCurveTo(x + len * 0.3, y + (r() - 0.5) * 6, x + len * 0.7, y + (r() - 0.5) * 6, x + len, y + (r() - 0.5) * 3); g.stroke();
        }
        g.fillStyle = "rgba(25,15,8,.55)"; g.fillRect(x, i * bw, 2, bw);
        x += len;
      }
      g.fillStyle = "rgba(25,15,8,.5)"; g.fillRect(0, i * bw, w, 2);
    }
  }, [DW / 3, DD / 3]);
  const floorMat = new THREE.MeshStandardMaterial({ map: boards, roughness: 0.55 });

  // warm limewash plaster, tiled in metres (UVs are set in metres below)
  const plasterTex = canvasTex(512, 512, (g, w, h) => {
    const r = rnd(511);
    g.fillStyle = "rgb(204,180,142)"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2400; i++) {
      const v = (r() - 0.5) * 18;
      g.fillStyle = `rgba(${v > 0 ? "255,248,232" : "70,48,28"},${Math.abs(v) / 250})`;
      g.beginPath(); g.arc(r() * w, r() * h, 3 + r() * 22, 0, 7); g.fill();
    }
  }, [1, 1]);
  const wallMat = new THREE.MeshStandardMaterial({ map: plasterTex, roughness: 0.94, envMapIntensity: 0.5 });
  // walnut wainscot: one frame-and-panel bay = 0.6 m x 0.9 m
  const wainTex = canvasTex(256, 384, (g, w, h) => {
    const r = rnd(521);
    g.fillStyle = "#5e3d26"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { g.strokeStyle = `rgba(30,16,8,${0.05 + r() * 0.08})`; g.lineWidth = 1; const y = r() * h; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y + (r() - 0.5) * 6); g.stroke(); }
    const ins = 30;
    g.fillStyle = "#4e321f"; g.fillRect(ins, ins + 20, w - ins * 2, h - ins * 2 - 40);                 // recessed panel
    g.fillStyle = "rgba(255,225,180,.16)"; g.fillRect(ins, h - ins - 22, w - ins * 2, 3); g.fillRect(w - ins - 3, ins + 20, 3, h - ins * 2 - 40);
    g.fillStyle = "rgba(0,0,0,.35)"; g.fillRect(ins, ins + 20, w - ins * 2, 3); g.fillRect(ins, ins + 20, 3, h - ins * 2 - 40);
    g.fillStyle = "rgba(0,0,0,.4)"; g.fillRect(0, 0, 2, h);                                             // stile joint
  }, [1, 1]);
  const wainMat = new THREE.MeshStandardMaterial({ map: wainTex, roughness: 0.6 });
  const ceilMat = new THREE.MeshStandardMaterial({ color: 0xece2cf, roughness: 0.97, envMapIntensity: 0.4 });
  const rugTex = canvasTex(1024, 768, (g, w, h) => {
    const r = rnd(531);
    g.fillStyle = "#8a3b24"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#d8b878"; g.fillRect(36, 36, w - 72, h - 72);
    g.fillStyle = "#8a3b24"; g.fillRect(60, 60, w - 120, h - 120);
    g.fillStyle = "#3a2a22";
    for (let i = 0; i < 9; i++) {      // kilim diamonds down the middle
      const x = 150 + i * ((w - 300) / 8), y = h / 2, s = 46 + (i % 2) * 18;
      g.fillStyle = i % 2 ? "#d8b878" : "#2f3d38";
      g.beginPath(); g.moveTo(x, y - s * 1.6); g.lineTo(x + s, y); g.lineTo(x, y + s * 1.6); g.lineTo(x - s, y); g.fill();
    }
    g.strokeStyle = "#d8b878"; g.lineWidth = 5;
    for (const y of [120, h - 120]) { g.beginPath(); for (let x = 70; x < w - 70; x += 40) { g.lineTo(x, y - 14); g.lineTo(x + 20, y + 14); } g.stroke(); }
    for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${r() < 0.5 ? "255,236,210" : "20,10,5"},${r() * 0.08})`; g.fillRect(r() * w, r() * h, 2, 2); }
  });
  const shadowBlob = canvasTex(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    gr.addColorStop(0, "rgba(0,0,0,.55)"); gr.addColorStop(0.55, "rgba(0,0,0,.32)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  const blobMat = new THREE.MeshBasicMaterial({ map: shadowBlob, transparent: true, depthWrite: false });
  const contactShadow = (w, d, x, z) => { const m = plane(w, d, blobMat, x, 0.005, z, -Math.PI / 2, 0); m.renderOrder = 1; return m; };

  const DM = {
    trim: new THREE.MeshStandardMaterial({ color: 0xeee3cf, roughness: 0.55 }),
    darkWood: new THREE.MeshStandardMaterial({ color: 0x3e2617, roughness: 0.5 }),
    deskTop: new THREE.MeshStandardMaterial({ color: 0x6a4428, roughness: 0.42 }),
    blackSteel: new THREE.MeshStandardMaterial({ color: 0x1f1f20, roughness: 0.45, metalness: 0.7 }),
    plastic: new THREE.MeshStandardMaterial({ color: 0x232426, roughness: 0.5, metalness: 0.2 }),
    alu: new THREE.MeshStandardMaterial({ color: 0x9a9da1, roughness: 0.35, metalness: 0.85 }),
    fabric: new THREE.MeshStandardMaterial({ color: 0x3a3f45, roughness: 0.95 }),
    paint: new THREE.MeshStandardMaterial({ color: 0x4a5a52, roughness: 0.5 }),        // the future doors, deep green
    paper: new THREE.MeshStandardMaterial({ color: 0xf1ead8, roughness: 0.9 }),
    led: new THREE.MeshStandardMaterial({ color: 0x9fd3ff, emissive: 0x6fb8ff, emissiveIntensity: 1.2, roughness: 0.4 }),
    lampShade: new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.4, metalness: 0.6, side: THREE.DoubleSide }),
    glow: new THREE.MeshBasicMaterial({ color: 0xffe7c2 }),
    pot: new THREE.MeshStandardMaterial({ color: 0xd8cfc0, roughness: 0.6 }),
  };

  /* ------------------------------------------------------------ shell - */
  plane(DW, DD, floorMat, CX, 0, CZ, -Math.PI / 2);
  plane(0.92, 0.15, floorMat, (DOOR.x0 + DOOR.x1) / 2, 0.001, 4.075, -Math.PI / 2);
  box(0.92, 0.014, 0.17, M.oak, (DOOR.x0 + DOOR.x1) / 2, 0.007, 4.075, NC);        // oak threshold
  const ceil = plane(DW, DD, ceilMat, CX, D.h, CZ, Math.PI / 2);
  ceil.castShadow = true;                                // keeps the room's sun off the den floor

  /* a wall from slices around its openings. u runs along the wall, v up; UVs in metres so nothing stretches.
     place(mesh, uCentre, vCentre) sets position + rotation. */
  const TILE = 2.2;
  function slice(mat, u0, u1, v0, v1, place, tile, tileV) {
    const geo = new THREE.PlaneGeometry(u1 - u0, v1 - v0), uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (u0 + uv.getX(i) * (u1 - u0)) / (tile || TILE), (v0 + uv.getY(i) * (v1 - v0)) / (tileV || tile || TILE));
    const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; place(m, (u0 + u1) / 2, (v0 + v1) / 2); scene.add(m); return m;
  }
  function wall(len, holes, place, cast) {
    const hs = holes.slice().sort((a, b) => a.u0 - b.u0);
    let u = 0;
    const out = [];
    for (const o of hs) {
      if (o.u0 > u) out.push(slice(wallMat, u, o.u0, 0, D.h, place));
      if (o.v0 > 0) out.push(slice(wallMat, o.u0, o.u1, 0, o.v0, place));
      out.push(slice(wallMat, o.u0, o.u1, o.v1, D.h, place));
      u = o.u1;
    }
    if (u < len) out.push(slice(wallMat, u, len, 0, D.h, place));
    if (cast) for (const m of out) m.castShadow = true;
    // wainscot (0..0.9 m), 1 cm proud, skipping the door holes
    let w0 = 0;
    for (const o of hs.filter((q) => q.v0 === 0).concat([{ u0: len, u1: len }])) {
      if (o.u0 - w0 > 0.05) {
        slice(wainMat, w0, o.u0, 0, 0.9, (m, uc, vc) => { place(m, uc, vc); m.translateZ(0.012); }, 0.6, 0.9);
        const rail = new THREE.Mesh(new THREE.BoxGeometry(o.u0 - w0, 0.045, 0.035), DM.darkWood);   // chair rail
        place(rail, (w0 + o.u0) / 2, 0.92); rail.translateZ(0.02); scene.add(rail);
        const base = new THREE.Mesh(new THREE.BoxGeometry(o.u0 - w0, 0.12, 0.025), DM.darkWood);    // baseboard
        place(base, (w0 + o.u0) / 2, 0.06); base.translateZ(0.025); scene.add(base);
      }
      w0 = o.u1;
    }
    // crown
    const crown = new THREE.Mesh(new THREE.BoxGeometry(len, 0.07, 0.04), DM.trim); place(crown, len / 2, D.h - 0.035); crown.translateZ(0.02); scene.add(crown);
  }
  // back wall z = z0 facing +z; u along +x from x0. It is shared with room A, so it casts (sun stays out).
  wall(DW, [{ u0: DOOR.x0 - D.x0, u1: DOOR.x1 - D.x0, v0: 0, v1: DOOR.h }], (m, u, v) => { m.position.set(D.x0 + u, v, D.z0); }, true);
  // far wall z = z1 facing -z; u along -x from x1
  // (the future doors are closed leaves mounted on solid wall: no hole until a page is built behind them)
  wall(DW, [], (m, u, v) => { m.position.set(D.x1 - u, v, D.z1); m.rotation.y = Math.PI; });
  // left wall x = x0 facing +x; u along -z from z1. Casts (the sun comes in from -x a little).
  wall(DD, [], (m, u, v) => { m.position.set(D.x0, v, D.z1 - u); m.rotation.y = Math.PI / 2; }, true);
  // right wall x = x1 facing -x; u along +z from z0, with the window
  wall(DD, [{ u0: WIN.z0 - D.z0, u1: WIN.z1 - D.z0, v0: WIN.y0, v1: WIN.y1 }], (m, u, v) => { m.position.set(D.x1, v, D.z0 + u); m.rotation.y = -Math.PI / 2; });

  // the door opening from room A: jamb linings through the 15 cm wall, casing on the den side
  for (const x of [DOOR.x0 + 0.015, DOOR.x1 - 0.015]) box(0.03, DOOR.h, 0.15, DM.trim, x, DOOR.h / 2, 4.075, NC);
  box(DOOR.x1 - DOOR.x0, 0.03, 0.15, DM.trim, (DOOR.x0 + DOOR.x1) / 2, DOOR.h - 0.015, 4.075, NC);
  box(1.04, 0.07, 0.03, DM.trim, (DOOR.x0 + DOOR.x1) / 2, DOOR.h + 0.035, D.z0 + 0.03, NC);
  for (const x of [DOOR.x0 - 0.035, DOOR.x1 + 0.035]) box(0.07, DOOR.h + 0.07, 0.03, DM.trim, x, (DOOR.h + 0.07) / 2, D.z0 + 0.03, NC);

  /* -------------------------------------------------------- the window - */
  {
    const zc = (WIN.z0 + WIN.z1) / 2, yc = (WIN.y0 + WIN.y1) / 2, ww = WIN.z1 - WIN.z0, wh = WIN.y1 - WIN.y0;
    plane(ww, wh, M.glass, D.x1 + 0.12, yc, zc, 0, -Math.PI / 2);                 // daylight beyond
    for (const z of [WIN.z0 + 0.015, WIN.z1 - 0.015]) box(0.13, wh, 0.03, DM.trim, D.x1 + 0.06, yc, z, NC);   // reveals
    for (const y of [WIN.y0 + 0.015, WIN.y1 - 0.015]) box(0.13, 0.03, ww, DM.trim, D.x1 + 0.06, y, zc, NC);
    box(0.04, wh, 0.04, DM.trim, D.x1 + 0.1, yc, zc, NC);                          // muntins
    box(0.04, 0.04, ww, DM.trim, D.x1 + 0.1, yc + 0.15, zc, NC);
    box(0.2, 0.04, ww + 0.16, DM.trim, D.x1 - 0.06, WIN.y0 - 0.02, zc, NC);        // sill
    for (const z of [WIN.z0 - 0.04, WIN.z1 + 0.04]) box(0.03, wh + 0.1, 0.08, DM.trim, D.x1 - 0.015, yc, z, NC);   // casing
    box(0.03, 0.08, ww + 0.16, DM.trim, D.x1 - 0.015, WIN.y1 + 0.04, zc, NC);
    // a linen roman shade, half down
    box(0.03, 0.42, ww - 0.06, M.linen, D.x1 - 0.04, WIN.y1 - 0.24, zc, NC);
  }

  /* ---------------------------------------------- the two future doors - */
  const plaqueTex = (id) => canvasTex(320, 120, (g, w, h) => {
    g.fillStyle = "#2c2118"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#b8913f"; g.lineWidth = 4; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = "#e8c98a"; g.textAlign = "center";
    g.font = "700 40px Georgia, serif"; g.fillText("COMING SOON", w / 2, 58);
    g.font = "22px ui-monospace, Menlo, Consolas, monospace"; g.fillStyle = "#cdb88f"; g.fillText(`next page · ${id}`, w / 2, 94);
  });
  /* a closed painted panel door on a wall. `at(group)` places a group whose local +x runs along the wall and +z points
     into the den. The leaf is on a hinge so a tap can rattle it ("not built yet"). */
  function futureDoor(id, at) {
    const g = new THREE.Group(); at(g); scene.add(g);
    const w = 0.92, h = 2.05;
    box(w + 0.14, 0.07, 0.03, DM.trim, 0, h + 0.035, 0.015, { parent: g, cast: false });
    for (const dx of [-(w / 2 + 0.035), w / 2 + 0.035]) box(0.07, h + 0.07, 0.03, DM.trim, dx, (h + 0.07) / 2, 0.015, { parent: g, cast: false });
    const leaf = new THREE.Group(); leaf.position.set(-w / 2 + 0.02, 0, 0.025); g.add(leaf);
    const lw = w - 0.04;
    box(lw, h - 0.01, 0.04, DM.paint, lw / 2, h / 2, 0, { parent: leaf, cast: false });
    for (const y of [0.55, 1.5]) box(lw - 0.3, 0.7, 0.012, DM.paint, lw / 2, y, 0.024, { parent: leaf, cast: false });
    cyl(0.03, 0.03, 0.05, M.brass, lw - 0.1, 1.0, 0.045, { rx: Math.PI / 2, parent: leaf, cast: false });
    cyl(0.04, 0.04, 0.008, M.brass, lw - 0.1, 1.0, 0.022, { rx: Math.PI / 2, parent: leaf, cast: false });
    plane(0.32, 0.12, new THREE.MeshStandardMaterial({ map: plaqueTex(id), roughness: 0.6 }), lw / 2, 1.5, 0.031, 0, 0, leaf);
    return { id, group: g, leaf, rattle: 0 };
  }
  const future = [
    futureDoor("d-side", (g) => { g.position.set(D.x0, 0, (SIDE.z0 + SIDE.z1) / 2); g.rotation.y = Math.PI / 2; }),
    futureDoor("d-back", (g) => { g.position.set((BACK.x0 + BACK.x1) / 2, 0, D.z1); g.rotation.y = Math.PI; }),
  ];

  /* ---------------------------------------------------- the desk + PC - */
  const DESK = { x: -4.6, z: 9.17, w: 1.6, d: 0.72, top: 0.75 };
  box(DESK.w, 0.04, DESK.d, DM.deskTop, DESK.x, DESK.top - 0.02, DESK.z, { cast: false, round: 0.008 });
  for (const sx of [-1, 1]) {           // black steel sled legs
    const lx = DESK.x + sx * (DESK.w / 2 - 0.08);
    for (const dz of [-0.28, 0.28]) box(0.04, DESK.top - 0.04, 0.04, DM.blackSteel, lx, (DESK.top - 0.04) / 2, DESK.z + dz, NC);
    box(0.04, 0.03, 0.64, DM.blackSteel, lx, 0.015, DESK.z, NC);
    box(0.04, 0.04, 0.6, DM.blackSteel, lx, DESK.top - 0.06, DESK.z, NC);
  }
  box(DESK.w - 0.2, 0.32, 0.015, DM.blackSteel, DESK.x, DESK.top - 0.2, DESK.z + 0.3, NC);   // modesty panel
  solid(DESK.x - DESK.w / 2 - 0.02, DESK.z - DESK.d / 2 - 0.02, DESK.x + DESK.w / 2 + 0.02, D.z1);
  contactShadow(2.0, 1.1, DESK.x, DESK.z);

  // the monitor: 0.8 x 0.45 m screen (a 36-inch 16:9), thin bezel, aluminium stand, faces -z
  const SCREEN = { x: DESK.x, y: DESK.top + 0.4, z: DESK.z + 0.12, w: 0.8, h: 0.45 };
  const mon = new THREE.Group(); mon.position.set(SCREEN.x, SCREEN.y, SCREEN.z); mon.rotation.y = Math.PI; scene.add(mon);
  mesh(RB(SCREEN.w + 0.03, SCREEN.h + 0.075, 0.03, 0.008), DM.plastic, 0, -0.022, -0.012, mon);              // body
  mesh(RB(SCREEN.w - 0.1, SCREEN.h - 0.08, 0.04, 0.02), DM.plastic, 0, 0, -0.04, mon);                       // back hump
  const screenMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const screen = mesh(new THREE.PlaneGeometry(SCREEN.w, SCREEN.h), screenMat, 0, 0, 0.0045, mon);
  // the chin label under the picture: "Today's news, <date>"
  const labelCanvas = document.createElement("canvas"); labelCanvas.width = 1024; labelCanvas.height = 64;
  const labelTex = new THREE.CanvasTexture(labelCanvas); labelTex.colorSpace = THREE.SRGBColorSpace;
  const labelMat = new THREE.MeshBasicMaterial({ map: labelTex, toneMapped: false });
  mesh(new THREE.PlaneGeometry(SCREEN.w, SCREEN.w * 64 / 1024), labelMat, 0, -SCREEN.h / 2 - 0.028, 0.0045, mon);
  mesh(new THREE.BoxGeometry(0.06, 0.3, 0.02), DM.alu, 0, -0.2, -0.07, mon);                                   // neck
  mesh(RB(0.3, 0.012, 0.2, 0.005), DM.alu, 0, -SCREEN.y + DESK.top + 0.006, -0.06, mon);                     // foot
  mesh(new THREE.BoxGeometry(0.03, 0.005, 0.006), DM.led, SCREEN.w / 2 - 0.04, -SCREEN.h / 2 - 0.05, 0.004, mon);   // power light
  // invisible, slightly bigger tap target
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const screenHit = mesh(new THREE.PlaneGeometry(SCREEN.w + 0.1, SCREEN.h + 0.16), hitMat, 0, -0.02, 0.01, mon);

  /* a 59-inch wall TV above the desk, showing the SAME picture (same material, one video texture). From the desk the
     monitor is behind your own shoulders in this third-person view; the wall TV stays above everyone's head, so the
     news can be watched from anywhere in the room, the reading chair, or through A's door. */
  const TVW = { x: DESK.x, y: 1.98, z: D.z1 - 0.045, w: 1.3, h: 0.731 };
  const wtv = new THREE.Group(); wtv.position.set(TVW.x, TVW.y, TVW.z); wtv.rotation.y = Math.PI; scene.add(wtv);
  mesh(RB(TVW.w + 0.03, TVW.h + 0.03, 0.035, 0.006), DM.plastic, 0, 0, -0.005, wtv);
  mesh(new THREE.BoxGeometry(0.4, 0.3, 0.03), DM.blackSteel, 0, 0, -0.035, wtv);                              // wall bracket
  const wallScreen = mesh(new THREE.PlaneGeometry(TVW.w, TVW.h), screenMat, 0, 0, 0.0131, wtv);
  // "Today's news, <date>" on a slim plaque under the TV (same label as the monitor's chin)
  mesh(new THREE.BoxGeometry(1.04, 0.085, 0.012), DM.plastic, 0, -TVW.h / 2 - 0.085, -0.03, wtv);
  mesh(new THREE.PlaneGeometry(1.0, 1.0 * 64 / 1024), labelMat, 0, -TVW.h / 2 - 0.085, -0.0235, wtv);
  const wallHit = mesh(new THREE.PlaneGeometry(TVW.w + 0.1, TVW.h + 0.2), hitMat, 0, -0.03, 0.02, wtv);

  // keyboard (with a key-grid texture), mouse, pad, speakers
  const keysTex = canvasTex(512, 160, (g, w, h) => {
    g.fillStyle = "#1a1b1d"; g.fillRect(0, 0, w, h);
    const rows = [14, 14, 13, 12, 8];
    rows.forEach((n, ri) => {
      const kw = (w - 16 - ri * 12) / n;
      let x = 8 + ri * 6;
      for (let i = 0; i < n; i++) {
        const wide = ri === 4 && i === 3 ? kw * 4 : kw;      // the space bar
        g.fillStyle = "#2c2e31"; g.fillRect(x + 2, 8 + ri * 30, wide - 4, 25);
        g.fillStyle = "rgba(255,255,255,.08)"; g.fillRect(x + 2, 8 + ri * 30, wide - 4, 2);
        x += wide;
      }
    });
  });
  const kb = new THREE.Group(); kb.position.set(DESK.x, DESK.top, DESK.z - 0.2); kb.rotation.y = Math.PI; scene.add(kb);
  mesh(RB(0.44, 0.018, 0.14, 0.005), DM.plastic, 0, 0.009, 0, kb);
  const kt = mesh(new THREE.PlaneGeometry(0.42, 0.125), new THREE.MeshStandardMaterial({ map: keysTex, roughness: 0.6 }), 0, 0.0185, 0, kb); kt.rotation.x = -Math.PI / 2;
  box(0.34, 0.003, 0.28, new THREE.MeshStandardMaterial({ color: 0x2a2d30, roughness: 0.95 }), DESK.x - 0.45, DESK.top + 0.0015, DESK.z - 0.18, NC);   // mouse pad
  const mouse = new THREE.Mesh(new THREE.SphereGeometry(0.032, 16, 10), DM.plastic);
  mouse.scale.set(1, 0.5, 1.7); mouse.position.set(DESK.x - 0.45, DESK.top + 0.014, DESK.z - 0.2); scene.add(mouse);
  for (const sx of [-1, 1]) {
    const sp = new THREE.Group(); sp.position.set(DESK.x + sx * 0.56, DESK.top, DESK.z + 0.1); sp.rotation.y = Math.PI - sx * 0.25; scene.add(sp);
    mesh(RB(0.11, 0.18, 0.13, 0.012), DM.darkWood, 0, 0.09, 0, sp);
    const cone = mesh(new THREE.CircleGeometry(0.035, 20), DM.plastic, 0, 0.065, 0.066, sp);
    const tw = mesh(new THREE.CircleGeometry(0.014, 16), DM.alu, 0, 0.135, 0.066, sp);
    cone.receiveShadow = tw.receiveShadow = false;
  }
  // desk lamp (emissive, no extra light), a mug, a notebook + pen
  {
    const lx = DESK.x + 0.66, lz = DESK.z + 0.18;
    cyl(0.07, 0.08, 0.02, DM.blackSteel, lx, DESK.top + 0.01, lz, NC);
    const arm = new THREE.Group(); arm.position.set(lx, DESK.top + 0.02, lz); arm.rotation.y = Math.PI * 0.85; scene.add(arm);
    const a1 = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.36, 8), DM.blackSteel, 0, 0.17, 0.05, arm); a1.rotation.x = 0.3;
    const a2 = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 8), DM.blackSteel, 0, 0.36, -0.03, arm); a2.rotation.x = -1.1;
    const head = mesh(new THREE.ConeGeometry(0.06, 0.1, 18, 1, true), DM.lampShade, 0, 0.4, -0.17, arm); head.rotation.x = 0.5;
    mesh(new THREE.SphereGeometry(0.022, 10, 8), DM.glow, 0, 0.375, -0.155, arm);
  }
  cyl(0.042, 0.038, 0.095, M.ceramic, DESK.x - 0.68, DESK.top + 0.048, DESK.z - 0.1, NC);
  box(0.21, 0.014, 0.28, new THREE.MeshStandardMaterial({ color: 0x2f4f6b, roughness: 0.7 }), DESK.x + 0.4, DESK.top + 0.007, DESK.z - 0.16, { cast: false, ry: 0.12 });
  box(0.19, 0.003, 0.26, DM.paper, DESK.x + 0.4, DESK.top + 0.016, DESK.z - 0.16, { cast: false, ry: 0.12 });
  cyl(0.004, 0.004, 0.14, M.brass, DESK.x + 0.46, DESK.top + 0.022, DESK.z - 0.18, { rx: Math.PI / 2, cast: false });
  // the tower under the desk, right side, with a soft blue light strip
  box(0.2, 0.44, 0.44, DM.plastic, DESK.x + 0.56, 0.23, DESK.z + 0.02, { cast: false, round: 0.01 });
  box(0.004, 0.36, 0.01, DM.led, DESK.x + 0.56 - 0.08, 0.25, DESK.z - 0.205, NC);

  // office chair facing the desk (star base, casters, gas lift, seat, mesh back, arms)
  {
    const c = new THREE.Group(); c.position.set(DESK.x, 0, DESK.z - 0.8); c.rotation.y = 0.12; scene.add(c);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const leg = mesh(new THREE.BoxGeometry(0.04, 0.03, 0.3), DM.blackSteel, Math.sin(a) * 0.15, 0.07, Math.cos(a) * 0.15, c); leg.rotation.y = a;
      mesh(new THREE.SphereGeometry(0.025, 10, 8), DM.plastic, Math.sin(a) * 0.29, 0.025, Math.cos(a) * 0.29, c);
    }
    mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.36, 12), DM.alu, 0, 0.26, 0, c);
    mesh(RB(0.5, 0.08, 0.48, 0.03), DM.fabric, 0, 0.48, 0, c);
    const back = mesh(RB(0.46, 0.56, 0.05, 0.03), DM.fabric, 0, 0.86, -0.27, c); back.rotation.x = -0.12;
    mesh(new THREE.BoxGeometry(0.05, 0.36, 0.03), DM.blackSteel, 0, 0.6, -0.25, c);
    for (const sx of [-0.26, 0.26]) {
      mesh(new THREE.BoxGeometry(0.03, 0.2, 0.03), DM.blackSteel, sx, 0.6, -0.02, c);
      mesh(RB(0.06, 0.03, 0.24, 0.012), DM.plastic, sx, 0.71, 0.0, c);
    }
    c.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    solid(DESK.x - 0.32, DESK.z - 1.12, DESK.x + 0.32, DESK.z - 0.48);
    contactShadow(0.8, 0.8, DESK.x, DESK.z - 0.8);
  }

  /* ---------------------------------------------- reading corner + rug - */
  plane(2.8, 2.0, new THREE.MeshStandardMaterial({ map: rugTex, roughness: 0.98 }), -5.0, 0.006, 6.85, -Math.PI / 2);
  {
    // leather armchair in the far corner, angled toward the screen
    const a = new THREE.Group(); a.position.set(-7.35, 0, 8.7); a.rotation.y = 2.35; scene.add(a);
    const leather = M.sofa;
    mesh(RB(0.86, 0.36, 0.82, 0.06), leather, 0, 0.24, 0, a);
    mesh(RB(0.66, 0.14, 0.62, 0.05), M.cushion, 0, 0.47, 0.06, a);
    mesh(RB(0.86, 0.56, 0.2, 0.07), leather, 0, 0.66, -0.33, a);
    for (const sx of [-0.4, 0.4]) mesh(RB(0.16, 0.5, 0.8, 0.06), leather, sx, 0.4, 0, a);
    for (const [sx, sz] of [[-0.36, -0.34], [0.36, -0.34], [-0.36, 0.34], [0.36, 0.34]]) mesh(new THREE.CylinderGeometry(0.02, 0.015, 0.08, 8), DM.darkWood, sx, 0.04, sz, a);
    a.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    solid(-7.95, 8.1, -6.75, 9.3);
    contactShadow(1.2, 1.2, -7.35, 8.7);
    // floor lamp beside it (glowing shade; no extra light)
    cyl(0.14, 0.16, 0.025, DM.blackSteel, -7.95, 0.013, 9.25, NC);
    cyl(0.011, 0.011, 1.5, M.brass, -7.95, 0.77, 9.25, NC);
    cyl(0.15, 0.21, 0.27, M.shadeA, -7.95, 1.6, 9.25, NC);
    // small side table with a book
    cyl(0.22, 0.22, 0.03, DM.darkWood, -6.55, 0.55, 9.2, NC);
    cyl(0.02, 0.02, 0.54, DM.darkWood, -6.55, 0.27, 9.2, NC);
    cyl(0.16, 0.18, 0.02, DM.darkWood, -6.55, 0.01, 9.2, NC);
    box(0.16, 0.035, 0.22, new THREE.MeshStandardMaterial({ color: 0x7a2e2a, roughness: 0.7 }), -6.55, 0.585, 9.2, { ry: 0.5, cast: false });
    solid(-6.8, 8.95, -6.3, 9.45);
  }

  /* ---------------------------------------------- bookshelf, left wall - */
  {
    const bx = D.x0 + 0.17, bz = 5.12, bl = 1.5, bh = 2.0;
    box(0.34, bh, 0.03, DM.darkWood, bx, bh / 2, bz - bl / 2 + 0.015, NC);
    box(0.34, bh, 0.03, DM.darkWood, bx, bh / 2, bz + bl / 2 - 0.015, NC);
    box(0.02, bh, bl, DM.darkWood, D.x0 + 0.01, bh / 2, bz, NC);
    for (let i = 0; i < 5; i++) box(0.34, 0.03, bl - 0.06, DM.darkWood, bx, 0.06 + i * 0.47, bz, NC);
    box(0.34, 0.04, bl, DM.darkWood, bx, bh, bz, NC);
    // one mesh per shelf: a row of spines drawn on the face toward the room
    for (let s = 0; s < 4; s++) {
      const spine = canvasTex(512, 128, (g, w, h) => {
        const r = rnd(541 + s * 7);
        g.fillStyle = "#1c130c"; g.fillRect(0, 0, w, h);
        let x = 0;
        while (x < w) {
          const bw = 10 + r() * 18, bh2 = h * (0.72 + r() * 0.28);
          const col = `hsl(${Math.floor(r() * 360)},${25 + r() * 25}%,${18 + r() * 22}%)`;
          g.fillStyle = col; g.fillRect(x, h - bh2, bw - 1.5, bh2);
          g.fillStyle = "rgba(230,200,140,.55)"; if (r() < 0.6) g.fillRect(x + 2, h - bh2 + 10, bw - 5, 2);
          if (r() < 0.6) g.fillRect(x + 2, h - 18, bw - 5, 2);
          x += bw;
          if (r() < 0.08) x += 20;
        }
      });
      const mats = [new THREE.MeshStandardMaterial({ map: spine, roughness: 0.8 })];
      const plain = new THREE.MeshStandardMaterial({ color: 0x3a2618, roughness: 0.85 });
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.36, bl - 0.1), [mats[0], plain, plain, plain, plain, plain]);
      m.position.set(bx - 0.03, 0.075 + s * 0.47 + 0.18, bz); m.receiveShadow = true; scene.add(m);
    }
    solid(D.x0, bz - bl / 2, D.x0 + 0.36, bz + bl / 2);
  }

  // a fiddle-leaf fig in the corner by the door
  {
    const px = D.x1 - 0.42, pz = D.z0 + 0.45;
    cyl(0.17, 0.13, 0.36, DM.pot, px, 0.18, pz, NC);
    cyl(0.012, 0.016, 1.0, DM.darkWood, px, 0.8, pz, NC);
    const pr = rnd(551);
    const leafGeo = new THREE.SphereGeometry(0.1, 8, 6);
    for (let i = 0; i < 22; i++) {
      const l = new THREE.Mesh(leafGeo, M.leaf);
      const y = 0.75 + pr() * 0.8, a = pr() * 6.28, rr = 0.06 + pr() * 0.22;
      l.scale.set(0.9, 0.22, 1.5); l.position.set(px + Math.cos(a) * rr, y, pz + Math.sin(a) * rr); l.rotation.set(pr() - 0.5, a, pr() * 0.8);
      scene.add(l);
    }
    solid(px - 0.25, pz - 0.25, px + 0.25, pz + 0.25);
  }

  // a framed print on the back wall, right of the door
  {
    const art = canvasTex(400, 300, (g, w, h) => {
      const sky = g.createLinearGradient(0, 0, 0, h * 0.6);
      sky.addColorStop(0, "#e9b47a"); sky.addColorStop(1, "#f3dcae"); g.fillStyle = sky; g.fillRect(0, 0, w, h);
      g.fillStyle = "#f7e9c8"; g.beginPath(); g.arc(w * 0.68, h * 0.38, 26, 0, 7); g.fill();
      for (const [y, c] of [[0.55, "#9a6a48"], [0.66, "#6e4a34"], [0.78, "#4a3426"]]) {
        g.fillStyle = c; g.beginPath(); g.moveTo(0, h);
        for (let x = 0; x <= w; x += 20) g.lineTo(x, h * y + Math.sin(x * 0.02 + y * 9) * 18);
        g.lineTo(w, h); g.fill();
      }
    });
    box(0.78, 0.6, 0.03, DM.darkWood, -3.15, 1.62, D.z0 + 0.02, NC);
    plane(0.66, 0.48, new THREE.MeshStandardMaterial({ color: 0xf2ead8, roughness: 0.9 }), -3.15, 1.62, D.z0 + 0.037);
    plane(0.56, 0.38, new THREE.MeshStandardMaterial({ map: art, roughness: 0.8 }), -3.15, 1.62, D.z0 + 0.039);
  }

  /* ------------------------------------------------- the PAGE D sign - */
  {
    const g = new THREE.Group(); g.position.set(D.x1 - 0.03, 1.65, 5.35); g.rotation.y = -Math.PI / 2; scene.add(g);
    box(1.12, 0.74, 0.04, M.walnut, 0, 0, 0, { parent: g, cast: false });
    plane(1.0, 0.625, new THREE.MeshStandardMaterial({ map: signTex("D", "/lab/seam-room/d/"), roughness: 0.8 }), 0, 0, 0.022, 0, 0, g);
    cyl(0.02, 0.03, 0.18, M.brass, 0, 0.47, 0.08, { parent: g, rx: Math.PI / 2, cast: false });
  }

  /* ---------------------------------------------------------- lights - */
  // one warm ceiling light (a linen drum); no shadows
  cyl(0.004, 0.004, 0.35, M.black, -5.0, D.h - 0.175, 6.85, NC);
  cyl(0.32, 0.32, 0.22, M.shadeA, -5.0, D.h - 0.46, 6.85, { cast: false, seg: 32 });
  const L = new THREE.PointLight(0xffc98f, 7.5, 9, 1.6); L.position.set(-5.0, D.h - 0.62, 6.85); scene.add(L);

  return {
    D, DOOR, SCREEN, TVW, screen, wallScreen, screenHits: [screenHit, wallHit], screenMat, labelCanvas, labelTex, future, lights: [L],
    futureHits: future.map((f) => f.leaf),
    rattle(id) { const f = future.find((q) => q.id === id); if (f) f.rattle = 0.45; },
    tick(dt) {
      for (const f of future) {
        if (f.rattle <= 0) { f.leaf.rotation.y = 0; continue; }
        f.rattle = Math.max(0, f.rattle - dt);
        f.leaf.rotation.y = -Math.sin(f.rattle * 40) * 0.025 * (f.rattle / 0.45);   // a locked door: it gives a little, then stops
      }
    },
  };
}

/* ============================================================================
   Heartbeat News on the den's computer.
   The daily show is published to Supabase Storage (bucket news-video, public)
   by AI-Shared/projects/news-show/pipeline/publish_video.py, with index.json:
   { latest, episodes: [{ date, video, poster, ... }] }.
   The poster shows first. Entering page D starts it muted (iPhone: muted +
   playsinline may autoplay). A tap on the screen (or "Watch" by the screen)
   plays it; the next tap turns the sound on / off. The sound fades with
   distance (WebAudio gain: iPhone ignores video.volume) and the video pauses
   when you leave page D. If the video cannot play, the screen keeps the
   poster and says "Open the news", and the seam panel gets a link.
   ========================================================================== */
export function createNewsTV(k) {
  const { THREE, den, onLog } = k;
  const BUCKET = "https://ygjpnvrwhkrowkrskftk.supabase.co/storage/v1/object/public/news-video/";
  const S = den.SCREEN;
  const st = { ep: null, poster: null, video: null, vtex: null, playing: false, want: false, sound: false, failed: false, why: "", inD: false,
    audio: null, gain: null, lastGain: -1 };

  // the screen's own canvas: standby / poster with a play badge / "open the news"
  const cv = document.createElement("canvas"); cv.width = 1024; cv.height = 576;
  const ctex = new THREE.CanvasTexture(cv); ctex.colorSpace = THREE.SRGBColorSpace;
  den.screenMat.map = ctex; den.screenMat.needsUpdate = true;
  function drawScreen() {
    const g = cv.getContext("2d"), w = cv.width, h = cv.height;
    g.fillStyle = "#0d0b0a"; g.fillRect(0, 0, w, h);
    if (st.poster) {
      g.drawImage(st.poster, 0, 0, w, h);
      g.fillStyle = "rgba(0,0,0,.18)"; g.fillRect(0, 0, w, h);
    } else {
      const gr = g.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, w * 0.6);
      gr.addColorStop(0, "#3a2a1c"); gr.addColorStop(1, "#0d0b0a"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = "#e8c98a"; g.textAlign = "center"; g.font = "700 64px Georgia, serif"; g.fillText("Heartbeat News", w / 2, h / 2 - 10);
      g.font = "28px system-ui, sans-serif"; g.fillStyle = "#cdb88f"; g.fillText(st.failed ? "" : "loading today's show…", w / 2, h / 2 + 44);
    }
    if (st.failed) {
      g.fillStyle = "rgba(20,14,10,.78)"; g.beginPath(); g.roundRect(w / 2 - 300, h - 150, 600, 100, 22); g.fill();
      g.fillStyle = "#f3ead8"; g.textAlign = "center"; g.font = "600 40px system-ui, sans-serif"; g.fillText("Open the news", w / 2, h - 96);
      g.font = "24px system-ui, sans-serif"; g.fillStyle = "#e8c98a"; g.fillText("heartbeatobservatory.com/news/", w / 2, h - 62);
    } else if (st.poster) {        // a round play badge
      g.fillStyle = "rgba(20,14,10,.62)"; g.beginPath(); g.arc(w / 2, h / 2, 74, 0, 7); g.fill();
      g.strokeStyle = "rgba(243,234,216,.9)"; g.lineWidth = 5; g.stroke();
      g.fillStyle = "#f3ead8"; g.beginPath(); g.moveTo(w / 2 - 22, h / 2 - 36); g.lineTo(w / 2 + 40, h / 2); g.lineTo(w / 2 - 22, h / 2 + 36); g.fill();
    }
    ctex.needsUpdate = true;
  }
  function fmtDate(d) {
    const dt = new Date(d + "T12:00:00");
    return isNaN(dt) ? d : dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  function today() { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`; }
  let labelSig = "";
  function drawLabel() {
    const hint = st.failed ? "tap to open the news" : !st.playing ? "tap to watch" : st.sound ? "sound on · tap to mute" : "muted · tap for sound";
    const head = st.ep ? `${st.ep.date === today() ? "Today's news" : "Latest news"}, ${fmtDate(st.ep.date)}` : "Heartbeat News";
    const sig = head + hint;
    if (sig === labelSig) return;
    labelSig = sig;
    const g = den.labelCanvas.getContext("2d"), w = den.labelCanvas.width, h = den.labelCanvas.height;
    g.fillStyle = "#18191b"; g.fillRect(0, 0, w, h);
    g.textBaseline = "middle"; g.font = "600 30px system-ui, sans-serif";
    g.fillStyle = "#e8c98a"; g.textAlign = "left"; g.fillText(head, 22, h / 2 + 1);
    g.fillStyle = "#b9ad97"; g.textAlign = "right"; g.font = "26px system-ui, sans-serif"; g.fillText(hint, w - 22, h / 2 + 1);
    den.labelTex.needsUpdate = true;
  }
  drawScreen(); drawLabel();

  function fail(why) {
    if (st.failed) return;
    st.failed = true; st.why = why; st.playing = false; st.want = false;
    if (st.video) { try { st.video.pause(); st.video.removeAttribute("src"); st.video.load(); } catch (_) {} }
    den.screenMat.map = ctex; den.screenMat.needsUpdate = true;
    drawScreen(); drawLabel();
    const hud = document.getElementById("hudSeam");
    if (hud && !document.getElementById("newsLink")) {
      const a = document.createElement("a"); a.id = "newsLink"; a.href = "/news/"; a.textContent = "Open the news ↗";
      a.target = "_blank"; a.rel = "noopener";
      hud.appendChild(a);
    }
    if (onLog) onLog("news: the video did not play here - poster + link instead");
    console.warn("seam-room news:", why);
  }

  // today's show: index.json (cache-busted every 10 minutes), then the poster
  fetch(BUCKET + "index.json?t=" + Math.floor(Date.now() / 600000))
    .then((r) => { if (!r.ok) throw new Error("index " + r.status); return r.json(); })
    .then((idx) => {
      const eps = idx.episodes || [];
      st.ep = eps.find((e) => e.date === idx.latest) || eps[0] || null;
      if (!st.ep || !st.ep.video) throw new Error("no episode");
      drawLabel();
      if (st.ep.poster) {
        const img = new Image(); img.crossOrigin = "anonymous";
        img.onload = () => { st.poster = img; if (!st.playing) drawScreen(); };
        img.src = st.ep.poster;
      }
      if (st.want) start();
    })
    .catch((e) => fail(String(e && e.message || e)));

  function ensureVideo() {
    if (st.video || !st.ep) return st.video;
    const v = document.createElement("video");
    v.crossOrigin = "anonymous";                 // before src: the texture needs CORS (Supabase sends ACAO *)
    v.muted = true; v.defaultMuted = true; v.setAttribute("muted", "");
    v.playsInline = true; v.setAttribute("playsinline", ""); v.setAttribute("webkit-playsinline", "");
    v.loop = true; v.preload = "auto";
    if (st.ep.poster) v.poster = st.ep.poster;
    // in the page but invisible (iPhone will not decode a display:none video)
    v.style.cssText = "position:fixed;left:0;bottom:0;width:2px;height:2px;opacity:0.01;pointer-events:none;z-index:-1";
    v.addEventListener("playing", () => {
      st.playing = true;
      if (st.failed) return;
      if (!st.vtex) {
        // the browser must treat the video as origin-clean (CORS passed) or WebGL refuses every frame. Check once on a
        // 2D canvas (same rule): draw a frame and read a pixel back; a tainted video throws here instead.
        if (!originClean(v)) { fail("the video plays but this browser will not let it be drawn in 3D (cross-origin)"); return; }
        st.vtex = new THREE.VideoTexture(v); st.vtex.colorSpace = THREE.SRGBColorSpace;
      }
      den.screenMat.map = st.vtex; den.screenMat.needsUpdate = true;
      drawLabel();
    });
    v.addEventListener("pause", () => { st.playing = false; drawLabel(); });
    v.addEventListener("error", () => fail("video error " + (v.error ? v.error.code : "?")));
    v.src = st.ep.video;
    document.body.appendChild(v);
    st.video = v;
    return v;
  }
  function originClean(v) {
    try {
      const c = document.createElement("canvas"); c.width = c.height = 2;
      const g = c.getContext("2d"); g.drawImage(v, 0, 0, 2, 2); g.getImageData(0, 0, 1, 1);
      return true;
    } catch (e) { return !(e && e.name === "SecurityError"); }
  }
  function start() {
    if (st.failed) return;
    st.want = true;
    const v = ensureVideo();
    if (!v || !v.paused) return;
    v.muted = !st.sound;
    const p = v.play();
    if (p && p.catch) p.catch((e) => {
      if (e && e.name === "NotAllowedError") {
        if (!v.muted) { st.sound = false; v.muted = true; v.play().catch(() => {}); }   // sound needs a tap; try muted
        drawLabel();                                                                     // else: wait for a tap
      } else if (e && e.name !== "AbortError") fail(e.name + ": " + e.message);
    });
  }
  function stop() { if (st.video && !st.video.paused) st.video.pause(); }
  /* WebAudio gain so the volume can follow distance on iPhone too. Built inside a tap. */
  function ensureAudio() {
    if (st.audio || !st.video) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      const src = ctx.createMediaElementSource(st.video);
      const gain = ctx.createGain(); gain.gain.value = 0;
      src.connect(gain).connect(ctx.destination);
      st.audio = ctx; st.gain = gain;
    } catch (e) { console.warn("seam-room news: no WebAudio, using video.volume", e); }
  }
  function setSound(on) {
    st.sound = on;
    if (!st.video) return;
    if (on) {
      ensureAudio();
      if (st.audio && st.audio.state !== "running") st.audio.resume().catch(() => {});
      st.video.muted = false;
      if (st.video.paused) start();
    } else st.video.muted = true;
    st.lastGain = -1;
    drawLabel();
    if (onLog) onLog(`news sound ${on ? "on" : "off"}`);
  }
  /* a tap on the screen, or the action button by it */
  function tap() {
    if (st.failed) { window.open("/news/", "_blank", "noopener"); return; }
    if (!st.playing) { start(); if (onLog) onLog("news: playing on the computer"); }
    else setSound(!st.sound);
    drawLabel();
  }
  function dist(x, z) { return Math.hypot(x - S.x, z - (S.z - 0.6)); }   // measured from just in front of the screen
  /* every frame: play while I am on page D, pause when I leave, sound fades with distance */
  function update(x, z, inD) {
    if (inD !== st.inD) {
      st.inD = inD;
      if (inD) start(); else { st.want = false; stop(); }
    }
    if (!st.video || !st.sound || !st.playing) return;
    const d = dist(x, z);
    const gv = Math.max(0, Math.min(1, 1 - (d - 1.0) / 6.5)) ** 1.6;
    if (Math.abs(gv - st.lastGain) < 0.01) return;
    st.lastGain = gv;
    if (st.gain) st.gain.gain.setTargetAtTime(gv, st.audio.currentTime, 0.08);
    else try { st.video.volume = gv; } catch (_) {}
  }
  function near(x, z) { return dist(x, z) < 1.9; }
  function prompt() { return st.failed ? "Open the news" : !st.playing ? "Watch the news" : st.sound ? "Mute the news" : "Sound on"; }
  addEventListener("pagehide", stop);
  return { tap, update, near, prompt, start, stop, setSound, get state() { return { ...st, poster: !!st.poster, video: !!st.video, vtex: !!st.vtex, audio: !!st.audio, time: st.video ? +st.video.currentTime.toFixed(2) : 0, muted: st.video ? st.video.muted : true, gain: st.lastGain }; } };
}
