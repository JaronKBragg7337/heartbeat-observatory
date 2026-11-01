/* ============================================================================
   garage.js - Page C, the garage behind B's walnut door
   ---------------------------------------------------------------------------
   Built into the SAME scene as the room (one world, no portal): open the door
   and you look straight through the wall. room.js passes its helpers in (k).
   Interior: x 2.15..8.45, z 4.15..10.35, 2.8 m tall. The shared wall with the
   room is z 4.00..4.15; B's door opening is x 4.14..5.06, 2.05 m high.
   The roll-up door on the far wall (z = 10.35) is the future door outside.
   Few shadow casters on purpose: only the shell (so the room's sun stays out);
   everything inside is lit by two LED strips and the environment.
   ========================================================================== */

export function buildGarage(k) {
  const { THREE, scene, M, box, cyl, plane, canvasTex, rnd, solids, signTex, RoundedBoxGeometry } = k;
  const G = { x0: 2.15, x1: 8.45, z0: 4.15, z1: 10.35, h: 2.8 };
  const GW = G.x1 - G.x0, GD = G.z1 - G.z0, CX = (G.x0 + G.x1) / 2, CZ = (G.z0 + G.z1) / 2;
  const DOOR = { x0: 4.14, x1: 5.06, h: 2.05 };
  const ROLL = { x0: 3.75, x1: 8.25, h: 2.25 };
  const NC = { cast: false };
  const solid = (a, b, c, d) => solids.push([a, b, c, d]);

  /* ---------------------------------------------------------- textures - */
  // poured concrete: mottled grey, trowel swirls, oil stains, tyre marks, saw-cut joints
  const concrete = canvasTex(1024, 1024, (g, w, h) => {
    const r = rnd(301);
    g.fillStyle = "#857f76"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) {               // mottling
      const v = r();
      g.fillStyle = v < 0.5 ? `rgba(70,66,60,${0.03 + r() * 0.05})` : `rgba(190,184,172,${0.03 + r() * 0.05})`;
      g.beginPath(); g.arc(r() * w, r() * h, 6 + r() * 60, 0, 7); g.fill();
    }
    for (let i = 0; i < 70; i++) {                 // trowel arcs
      g.strokeStyle = `rgba(${r() < 0.5 ? "60,56,50" : "200,195,185"},${0.05 + r() * 0.05})`;
      g.lineWidth = 1 + r() * 2;
      g.beginPath(); g.arc(r() * w, r() * h, 40 + r() * 120, r() * 6, r() * 6 + 1.2); g.stroke();
    }
    for (let i = 0; i < 26000; i++) {              // grit
      g.fillStyle = `rgba(${r() < 0.5 ? "40,38,34" : "215,210,200"},${r() * 0.18})`;
      g.fillRect(r() * w, r() * h, 1.5, 1.5);
    }
    // texture u runs along x (2.15 -> 8.45), v along z (4.15 at top -> 10.35 at bottom, PlaneGeometry flip)
    const px = (x) => ((x - G.x0) / GW) * w, pz = (z) => ((z - G.z0) / GD) * h;
    const stain = (x, z, rx, rz, a) => {
      const gr = g.createRadialGradient(px(x), pz(z), 2, px(x), pz(z), rx);
      gr.addColorStop(0, `rgba(28,24,20,${a})`); gr.addColorStop(0.6, `rgba(36,32,26,${a * 0.5})`); gr.addColorStop(1, "rgba(40,36,30,0)");
      g.fillStyle = gr; g.save(); g.translate(px(x), pz(z)); g.scale(1, rz / rx); g.translate(-px(x), -pz(z));
      g.beginPath(); g.arc(px(x), pz(z), rx, 0, 7); g.fill(); g.restore();
    };
    stain(6.0, 6.3, 70, 50, 0.55);    // under the engine
    stain(6.25, 6.5, 30, 22, 0.5);
    stain(5.6, 8.9, 40, 30, 0.25);
    stain(2.9, 7.4, 34, 26, 0.22);    // in front of the bench
    for (const x of [5.25, 6.75]) {                // tyre tracks toward the roll-up door
      const gr = g.createLinearGradient(0, pz(6), 0, pz(G.z1));
      gr.addColorStop(0, "rgba(30,28,25,0)"); gr.addColorStop(1, "rgba(30,28,25,.16)");
      g.fillStyle = gr; g.fillRect(px(x) - 18, pz(6), 36, h);
    }
    g.fillStyle = "rgba(30,28,24,.85)";           // saw-cut expansion joints
    g.fillRect(0, pz(7.25) - 2, w, 4);
    g.fillRect(px(5.3) - 2, 0, 4, h);
    g.fillStyle = "rgba(220,215,205,.25)";
    g.fillRect(0, pz(7.25) + 2, w, 1); g.fillRect(px(5.3) + 2, 0, 1, h);
  });
  const floorMat = new THREE.MeshStandardMaterial({ map: concrete, roughness: 0.8, envMapIntensity: 0.5 });

  // painted concrete block (CMU), running bond, 40 x 20 cm; texture = 1.6 x 1.6 m
  function blockTex(seed) {
    return canvasTex(512, 512, (g, w, h) => {
      const r = rnd(seed);
      g.fillStyle = "#a59b8b"; g.fillRect(0, 0, w, h);   // joints, painted over with the block
      for (let row = 0; row < 8; row++) {
        const off = row % 2 ? 64 : 0;
        for (let c = -1; c < 5; c++) {
          const x = c * 128 + off, y = row * 64, v = (r() - 0.5) * 16;
          g.fillStyle = `rgb(${202 + v},${195 + v},${181 + v})`; g.fillRect(x + 2.5, y + 2.5, 123, 59);
          for (let i = 0; i < 40; i++) {                       // pores in the paint
            g.fillStyle = `rgba(120,110,95,${0.12 + r() * 0.2})`;
            g.beginPath(); g.arc(x + 4 + r() * 120, y + 4 + r() * 56, 0.6 + r() * 1.3, 0, 7); g.fill();
          }
          g.fillStyle = "rgba(255,255,250,.22)"; g.fillRect(x + 2.5, y + 2.5, 123, 2);   // top edge catches light
          g.fillStyle = "rgba(60,50,40,.14)"; g.fillRect(x + 2.5, y + 59.5, 123, 2);      // bottom edge in shade
        }
      }
    }, [1, 1]);   // [1,1] turns on RepeatWrapping; wallMat() sets the real repeat
  }
  function wallMat(seed, w, h) {
    const t = blockTex(seed); t.repeat.set(w / 1.6, h / 1.6);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.92, envMapIntensity: 0.45 });
  }
  const drywall = canvasTex(256, 256, (g, w, h) => {
    const r = rnd(311);
    g.fillStyle = "#e4dfd4"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${r() < 0.5 ? "255,255,250" : "90,80,70"},${r() * 0.05})`; g.beginPath(); g.arc(r() * w, r() * h, 1 + r() * 8, 0, 7); g.fill(); }
  }, [3, 3]);
  const pegTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "#a9875f"; g.fillRect(0, 0, w, h);
    const r = rnd(321);
    for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(80,55,30,${r() * 0.08})`; g.fillRect(r() * w, r() * h, 3 + r() * 20, 1); }
    g.fillStyle = "#3a2a1a";
    for (let y = 8; y < h; y += 16) for (let x = 8; x < w; x += 16) { g.beginPath(); g.arc(x, y, 2.6, 0, 7); g.fill(); }
  }, [3, 2]);
  const shadowBlob = canvasTex(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    gr.addColorStop(0, "rgba(0,0,0,.62)"); gr.addColorStop(0.55, "rgba(0,0,0,.4)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  const blobMat = new THREE.MeshBasicMaterial({ map: shadowBlob, transparent: true, depthWrite: false });
  function contactShadow(w, d, x, z, ry) {
    const m = plane(w, d, blobMat, x, 0.004, z, -Math.PI / 2, 0); m.rotation.z = ry || 0; m.renderOrder = 1; return m;
  }

  const GM = {
    trim: new THREE.MeshStandardMaterial({ color: 0xe9e2d4, roughness: 0.6 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x8a8f93, roughness: 0.4, metalness: 0.85 }),
    galv: new THREE.MeshStandardMaterial({ color: 0xa4a8a8, roughness: 0.5, metalness: 0.7 }),
    darkSteel: new THREE.MeshStandardMaterial({ color: 0x34383b, roughness: 0.55, metalness: 0.6 }),
    rollup: new THREE.MeshStandardMaterial({ color: 0xece8de, roughness: 0.45, metalness: 0.25 }),
    rollupInset: new THREE.MeshStandardMaterial({ color: 0xdedad0, roughness: 0.5, metalness: 0.2 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.9 }),
    red: new THREE.MeshStandardMaterial({ color: 0xa3221c, roughness: 0.35, metalness: 0.4 }),
    led: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4e2, emissiveIntensity: 1.6, roughness: 0.4 }),
    ledOff: new THREE.MeshStandardMaterial({ color: 0xcfcac0, roughness: 0.4 }),
    peg: new THREE.MeshStandardMaterial({ map: pegTex, roughness: 0.85 }),
    butcher: new THREE.MeshStandardMaterial({ color: 0xc49a66, roughness: 0.55 }),
    ply: new THREE.MeshStandardMaterial({ color: 0xb08a5c, roughness: 0.8 }),
    bin: new THREE.MeshStandardMaterial({ color: 0x3c4146, roughness: 0.6 }),
    cardboard: new THREE.MeshStandardMaterial({ color: 0xa8875a, roughness: 0.92 }),
    heater: new THREE.MeshStandardMaterial({ color: 0xe8e6e0, roughness: 0.35, metalness: 0.2 }),
    switchPlate: new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: 0.4 }),
  };

  /* ------------------------------------------------------------ shell - */
  // floor (runs under the doorway too, z 4.0 -> 10.35)
  plane(GW, GD, floorMat, CX, 0, CZ, -Math.PI / 2);
  plane(0.92, 0.15, floorMat, (DOOR.x0 + DOOR.x1) / 2, 0.001, 4.075, -Math.PI / 2);
  box(0.92, 0.014, 0.17, M.oak, (DOOR.x0 + DOOR.x1) / 2, 0.007, 4.075, NC);        // oak threshold

  // ceiling (drywall)
  const ceil = plane(GW, GD, new THREE.MeshStandardMaterial({ map: drywall, roughness: 0.97, envMapIntensity: 0.4 }), CX, G.h, CZ, Math.PI / 2);
  ceil.castShadow = true;                                // keeps the room's sun off the garage floor

  // walls. Planes face inward. The back (shared) and left walls also cast, so the sun stays outside.
  const back = wallMat(401, GW, G.h), left = wallMat(402, GD, G.h), right = wallMat(403, GD, G.h), far = wallMat(404, GW, G.h);
  function piece(mat, fullW, x0, x1, y0, y1, place) {  // a slice of a wall with UVs matching the full wall
    const geo = new THREE.PlaneGeometry(x1 - x0, y1 - y0);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (x0 + uv.getX(i) * (x1 - x0)) / fullW, (y0 + uv.getY(i) * (y1 - y0)) / G.h);
    const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; place(m, (x0 + x1) / 2, (y0 + y1) / 2); scene.add(m); return m;
  }
  // back wall z = 4.15 facing +z; u along +x from x0
  const backAt = (m, u, v) => { m.position.set(G.x0 + u, v, G.z0); m.castShadow = true; };
  piece(back, GW, 0, DOOR.x0 - G.x0, 0, G.h, backAt);
  piece(back, GW, DOOR.x1 - G.x0, GW, 0, G.h, backAt);
  piece(back, GW, DOOR.x0 - G.x0, DOOR.x1 - G.x0, DOOR.h, G.h, backAt);
  // left wall x = 2.15 facing +x; u along -z... use z from far to near so text-free blocks line up
  const l = plane(GD, G.h, left, G.x0, G.h / 2, CZ, 0, Math.PI / 2); l.castShadow = true;
  plane(GD, G.h, right, G.x1, G.h / 2, CZ, 0, -Math.PI / 2);
  // far wall z = 10.35 facing -z (u runs from x1 to x0), with the roll-up opening
  const farAt = (m, u, v) => { m.position.set(G.x1 - u, v, G.z1); m.rotation.y = Math.PI; };
  piece(far, GW, 0, G.x1 - ROLL.x1, 0, G.h, farAt);
  piece(far, GW, G.x1 - ROLL.x0, GW, 0, G.h, farAt);
  piece(far, GW, G.x1 - ROLL.x1, G.x1 - ROLL.x0, ROLL.h, G.h, farAt);

  // the door opening: jamb linings through the 15 cm wall, casing on the garage side
  for (const x of [DOOR.x0 + 0.015, DOOR.x1 - 0.015]) box(0.03, DOOR.h, 0.15, GM.trim, x, DOOR.h / 2, 4.075, NC);
  box(DOOR.x1 - DOOR.x0, 0.03, 0.15, GM.trim, (DOOR.x0 + DOOR.x1) / 2, DOOR.h - 0.015, 4.075, NC);
  box(1.04, 0.07, 0.03, GM.trim, (DOOR.x0 + DOOR.x1) / 2, DOOR.h + 0.035, G.z0 + 0.015, NC);
  for (const x of [DOOR.x0 - 0.035, DOOR.x1 + 0.035]) box(0.07, DOOR.h + 0.07, 0.03, GM.trim, x, (DOOR.h + 0.07) / 2, G.z0 + 0.015, NC);

  // baseboard-ish rubber cove base on the block walls
  box(GW, 0.1, 0.012, GM.rubber, CX, 0.05, G.z1 - 0.006, NC);
  box(0.012, 0.1, GD, GM.rubber, G.x0 + 0.006, 0.05, CZ, NC);
  box(0.012, 0.1, GD, GM.rubber, G.x1 - 0.006, 0.05, CZ, NC);

  /* ------------------------------------------------------- roll-up door - */
  const rw = ROLL.x1 - ROLL.x0, rcx = (ROLL.x0 + ROLL.x1) / 2, rz = G.z1 - 0.06, secH = ROLL.h / 4;
  const sky = M.glass;
  for (let s = 0; s < 4; s++) {
    const y = s * secH + secH / 2;
    box(rw, secH - 0.012, 0.045, GM.rollup, rcx, y, rz, NC);
    for (let i = 0; i < 4; i++) {
      const x = ROLL.x0 + (i + 0.5) * (rw / 4);
      if (s === 3) {      // top section: four windows, daylight beyond
        box(0.8, 0.34, 0.004, GM.darkSteel, x, y, rz - 0.024, NC);
        plane(0.72, 0.26, sky, x, y, rz - 0.0275, 0, Math.PI);
      } else box(rw / 4 - 0.22, secH - 0.2, 0.012, GM.rollupInset, x, y, rz - 0.028, NC);
    }
    if (s > 0) box(rw, 0.008, 0.05, GM.darkSteel, rcx, s * secH, rz - 0.002, NC);       // section joints
    for (const x of [ROLL.x0 + 0.1, rcx, ROLL.x1 - 0.1]) box(0.06, 0.1, 0.02, GM.galv, x, s * secH + 0.02, rz - 0.035, NC);  // hinges
  }
  box(rw, 0.03, 0.06, GM.rubber, rcx, 0.015, rz, NC);                                  // bottom seal
  box(0.16, 0.035, 0.04, GM.darkSteel, rcx, 0.62, rz - 0.06, NC);                      // lift handle
  for (const x of [ROLL.x0 - 0.04, ROLL.x1 + 0.04]) {                                  // tracks: up the sides, along the ceiling
    box(0.05, ROLL.h + 0.15, 0.09, GM.galv, x, (ROLL.h + 0.15) / 2, rz - 0.04, NC);
    box(0.05, 0.09, 2.7, GM.galv, x, ROLL.h + 0.2, rz - 1.38, NC);
  }
  box(rw + 0.2, 0.06, 0.06, GM.galv, rcx, ROLL.h + 0.12, rz - 0.04, NC);              // torsion bar
  cyl(0.06, 0.06, 0.5, GM.darkSteel, rcx, ROLL.h + 0.12, rz - 0.04, { rz: Math.PI / 2, cast: false });  // spring
  // opener: rail from the door to a motor unit on the ceiling
  box(0.06, 0.05, 2.9, GM.galv, rcx, G.h - 0.3, G.z1 - 1.5, NC);
  box(0.42, 0.2, 0.55, new THREE.MeshStandardMaterial({ color: 0xd9d6cf, roughness: 0.5 }), rcx, G.h - 0.36, G.z1 - 3.1, { cast: false, round: 0.03 });
  plane(0.3, 0.12, new THREE.MeshStandardMaterial({ color: 0xfff4e0, emissive: 0xfff0d8, emissiveIntensity: 0.4 }), rcx, G.h - 0.465, G.z1 - 3.1, Math.PI / 2);
  for (const dx of [-0.18, 0.18]) box(0.03, 0.26, 0.03, GM.galv, rcx + dx, G.h - 0.13, G.z1 - 3.1, NC);
  // a small "outside" label on the door; the next page goes beyond it
  plane(0.5, 0.16, new THREE.MeshStandardMaterial({ map: canvasTex(256, 80, (g, w, h) => {
    g.fillStyle = "#2c2118"; g.fillRect(0, 0, w, h); g.fillStyle = "#e8c98a"; g.textAlign = "center";
    g.font = "700 30px Georgia, serif"; g.fillText("OUTSIDE", w / 2, 38); g.font = "18px Georgia, serif"; g.fillText("coming next", w / 2, 64);
  }), roughness: 0.8 }), rcx + 1.3, 1.5, rz - 0.035, 0, Math.PI);

  /* --------------------------------------------------------- the car - */
  buildCar(k, GM, { x: 6.0, z: 7.6 });
  contactShadow(2.3, 5.0, 6.0, 7.6);
  solid(5.0, 5.3, 7.0, 9.9);

  /* ------------------------------------------- workbench + pegboard - */
  const bx = G.x0 + 0.34, bz0 = 6.4, bz1 = 8.6, bzc = (bz0 + bz1) / 2, bl = bz1 - bz0;
  box(0.66, 0.06, bl, GM.butcher, bx, 0.9, bzc, NC);
  for (const dz of [-bl / 2 + 0.06, bl / 2 - 0.06]) for (const dx of [-0.27, 0.27]) box(0.07, 0.87, 0.07, M.oak, bx + dx, 0.435, bzc + dz, NC);
  box(0.6, 0.02, bl - 0.1, GM.ply, bx, 0.2, bzc, NC);                                       // lower shelf
  box(0.04, 0.14, bl, M.oak, bx + 0.31, 0.8, bzc, NC);                                      // apron
  // vise at the front-right end
  box(0.18, 0.1, 0.22, GM.darkSteel, bx + 0.33, 0.98, bz1 - 0.25, NC);
  cyl(0.012, 0.012, 0.3, GM.steel, bx + 0.48, 0.96, bz1 - 0.25, { rz: Math.PI / 2, cast: false });
  // things on the bench: a red toolbox, a coffee can of screws, a drill
  box(0.24, 0.2, 0.5, GM.red, bx - 0.08, 1.03, bz0 + 0.45, { cast: false, round: 0.02 });
  box(0.04, 0.03, 0.3, GM.darkSteel, bx - 0.08, 1.15, bz0 + 0.45, NC);
  cyl(0.065, 0.065, 0.15, GM.steel, bx + 0.12, 1.005, bzc - 0.1, NC);
  const drill = new THREE.Group(); drill.position.set(bx + 0.05, 0.93, bzc + 0.45); drill.rotation.y = 0.6; scene.add(drill);
  box(0.06, 0.07, 0.2, new THREE.MeshStandardMaterial({ color: 0xd2a32a, roughness: 0.5 }), 0, 0.12, 0, { parent: drill, cast: false, round: 0.02 });
  box(0.05, 0.13, 0.06, GM.rubber, 0, 0.05, -0.05, { parent: drill, cast: false });
  box(0.08, 0.05, 0.1, GM.rubber, 0, 0.0, -0.05, { parent: drill, cast: false });
  cyl(0.008, 0.008, 0.09, GM.steel, 0, 0.12, 0.14, { parent: drill, rx: Math.PI / 2, cast: false });
  solid(G.x0, bz0, bx + 0.36, bz1);
  contactShadow(1.0, 2.6, bx, bzc);
  // pegboard and tools
  const px = G.x0 + 0.02;
  box(0.015, 1.0, bl, GM.peg, px, 1.6, bzc, NC);
  const tool = (w, h, mat, z, y, round) => box(0.02, h, w, mat, px + 0.025, y, z, { cast: false, round });
  const handle = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 });
  // wrenches, graduated
  for (let i = 0; i < 7; i++) tool(0.025, 0.14 + i * 0.022, GM.steel, bz0 + 0.2 + i * 0.06, 1.88 - i * 0.011);
  // screwdrivers
  for (let i = 0; i < 5; i++) {
    const z = bz0 + 0.75 + i * 0.07, c = [0xc0302a, 0xe0b52a, 0x2a5fa8, 0xc0302a, 0x2f7a3a][i];
    cyl(0.014, 0.014, 0.1, handle(c), px + 0.04, 1.86, z, { cast: false });
    cyl(0.004, 0.004, 0.14, GM.steel, px + 0.04, 1.74, z, { cast: false });
  }
  // hammer
  tool(0.03, 0.32, M.maple, bz0 + 1.3, 1.62);
  box(0.03, 0.04, 0.13, GM.darkSteel, px + 0.03, 1.8, bz0 + 1.3, NC);
  // hand saw
  box(0.006, 0.12, 0.46, GM.steel, px + 0.025, 1.42, bz0 + 0.55, NC);
  box(0.02, 0.12, 0.12, handle(0x8a4f2a), px + 0.03, 1.44, bz0 + 0.84, { cast: false, round: 0.02 });
  // tape measure, level, extension cord
  box(0.04, 0.07, 0.07, handle(0xe7c22a), px + 0.035, 1.6, bz0 + 1.62, { cast: false, round: 0.015 });
  box(0.025, 0.05, 0.6, handle(0x2f9a4a), px + 0.03, 1.3, bz1 - 0.55, { cast: false, round: 0.01 });
  const cord = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.016, 8, 28), handle(0xe2771f));
  cord.position.set(px + 0.04, 1.6, bz1 - 0.3); cord.rotation.y = Math.PI / 2; scene.add(cord);
  // clamp-on bench light
  cyl(0.06, 0.09, 0.1, GM.darkSteel, bx - 0.15, 2.18, bz1 - 0.2, { cast: false });

  /* ---------------------------------------- tool chest + trash can - */
  const tc = { x: G.x0 + 0.25, z: 9.4 };
  box(0.46, 0.95, 0.9, GM.red, tc.x, 0.55, tc.z, { cast: false, round: 0.02 });
  for (let i = 0; i < 6; i++) {
    const y = 0.2 + i * 0.13 + (i > 3 ? 0.04 : 0);
    box(0.005, 0.006, 0.86, GM.darkSteel, tc.x + 0.233, y + 0.06, tc.z, NC);
    box(0.02, 0.02, 0.5, GM.steel, tc.x + 0.245, y, tc.z, NC);
  }
  for (const dz of [-0.38, 0.38]) cyl(0.04, 0.04, 0.03, GM.rubber, tc.x + 0.12, 0.04, tc.z + dz, { rx: Math.PI / 2, cast: false });
  solid(G.x0, tc.z - 0.48, tc.x + 0.26, tc.z + 0.48);
  contactShadow(0.8, 1.2, tc.x, tc.z);
  cyl(0.24, 0.21, 0.72, new THREE.MeshStandardMaterial({ color: 0x2c4f3a, roughness: 0.6 }), 3.3, 0.36, 10.0, NC);
  cyl(0.25, 0.25, 0.04, new THREE.MeshStandardMaterial({ color: 0x264534, roughness: 0.6 }), 3.3, 0.74, 10.0, NC);
  solid(3.02, 9.72, 3.58, G.z1);
  contactShadow(0.7, 0.7, 3.3, 10.0);

  /* --------------------------------------------- shelves with bins - */
  const sx = G.x1 - 0.24, sz0 = 6.0, sz1 = 8.0, szc = (sz0 + sz1) / 2;
  for (const z of [sz0 + 0.02, sz1 - 0.02]) for (const dx of [-0.2, 0.2]) box(0.035, 1.85, 0.035, GM.galv, sx + dx, 0.925, z, NC);
  const r = rnd(611);
  const binCols = [0x2f6aa8, 0x3c8a52, 0xd8a62a, 0xb03a2e, 0x6d6f72];
  for (let i = 0; i < 4; i++) {
    const y = 0.12 + i * 0.52;
    box(0.44, 0.025, sz1 - sz0, GM.galv, sx, y, szc, NC);
    let z = sz0 + 0.08;
    while (z < sz1 - 0.35) {
      const pick = r();
      if (pick < 0.6) {               // a lidded bin
        const w = 0.38, hgt = 0.26 + r() * 0.06;
        box(0.4, hgt, w, GM.bin, sx, y + 0.013 + hgt / 2, z + w / 2, { cast: false, round: 0.015 });
        box(0.42, 0.03, w + 0.02, new THREE.MeshStandardMaterial({ color: binCols[Math.floor(r() * binCols.length)], roughness: 0.55 }), sx, y + 0.028 + hgt, z + w / 2, NC);
        z += w + 0.05;
      } else if (pick < 0.85) {       // a cardboard box
        const w = 0.3 + r() * 0.1, hgt = 0.2 + r() * 0.1;
        box(0.36, hgt, w, GM.cardboard, sx, y + 0.013 + hgt / 2, z + w / 2, NC);
        z += w + 0.04;
      } else {                        // paint cans
        for (let c = 0; c < 2; c++) cyl(0.085, 0.085, 0.19, GM.galv, sx - 0.08 + c * 0.17, y + 0.11, z + 0.1, NC);
        z += 0.26;
      }
    }
  }
  solid(G.x1 - 0.48, sz0, G.x1, sz1);
  contactShadow(0.7, 2.3, sx, szc);

  /* -------------------------------------------- water heater corner - */
  cyl(0.28, 0.28, 1.5, GM.heater, 8.08, 0.77, 4.55, { cast: false, seg: 28 });
  cyl(0.28, 0.28, 0.04, GM.galv, 8.08, 1.54, 4.55, { cast: false, seg: 28 });
  cyl(0.03, 0.03, 1.25, GM.galv, 8.0, 2.15, 4.5, NC);
  cyl(0.03, 0.03, 1.25, new THREE.MeshStandardMaterial({ color: 0xb87333, roughness: 0.35, metalness: 0.9 }), 8.18, 2.15, 4.5, NC);
  solid(7.76, G.z0, G.x1, 4.87);
  contactShadow(0.8, 0.8, 8.08, 4.55);

  /* ------------------------------------------------- the PAGE C sign - */
  {
    const g = new THREE.Group(); g.position.set(G.x0 + 0.03, 1.65, 5.15); g.rotation.y = Math.PI / 2; scene.add(g);
    box(1.12, 0.74, 0.04, M.walnut, 0, 0, 0, { parent: g, cast: false });
    plane(1.0, 0.625, new THREE.MeshStandardMaterial({ map: signTex("C", "/lab/seam-room/c/"), roughness: 0.8 }), 0, 0, 0.022, 0, 0, g);
    cyl(0.02, 0.03, 0.18, M.brass, 0, 0.47, 0.08, { parent: g, rx: Math.PI / 2, cast: false });
  }

  /* ------------------------------------------------ lights + switch - */
  const strips = [];
  const lights = [];
  for (const [x, z] of [[4.0, 7.0], [6.4, 7.0]]) {
    box(0.16, 0.05, 1.25, GM.galv, x, G.h - 0.03, z, NC);
    strips.push(box(0.12, 0.012, 1.2, GM.led, x, G.h - 0.06, z, NC));
    for (const dz of [-0.6, 0.6]) box(0.14, 0.02, 0.02, GM.darkSteel, x, G.h - 0.06, z + dz, NC);
    const L = new THREE.PointLight(0xffecd2, 3.4, 7.5, 1.7); L.position.set(x, G.h - 0.25, z); scene.add(L); lights.push(L);
  }
  // switch plate next to the door, garage side
  const sw = new THREE.Group(); sw.position.set(DOOR.x0 - 0.3, 1.22, G.z0 + 0.008); scene.add(sw);
  box(0.075, 0.12, 0.008, GM.switchPlate, 0, 0, 0, { parent: sw, cast: false, round: 0.003 });
  const toggle = box(0.016, 0.03, 0.014, GM.switchPlate, 0, 0.008, 0.009, { parent: sw, cast: false });
  // an outlet below it
  box(0.07, 0.115, 0.008, GM.switchPlate, 0, -0.85, 0, { parent: sw, cast: false });
  sw.userData.hit = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.3, 0.08), new THREE.MeshBasicMaterial({ visible: false }));
  sw.add(sw.userData.hit);

  let on = true;
  function setLights(v) {
    on = !!v;
    for (const L of lights) L.visible = true, L.intensity = on ? 3.4 : 0;   // keep the light count fixed (no shader recompile)
    for (const s of strips) s.material = on ? GM.led : GM.ledOff;
    toggle.position.y = on ? 0.008 : -0.008;
  }

  return { G, DOOR, ROLL, lights, switchMesh: sw, setLights, get lightsOn() { return on; } };
}

/* ------------------------------------------------------------- the car - */
/* A modern hatchback-sedan from extruded side profiles: body, glass
   greenhouse, roof, pillars, lathed tyres and five-spoke rims, light units,
   mirrors, door shut lines. Nose toward the room (driven in forwards). */
function buildCar(k, GM, at) {
  const { THREE, scene } = k;
  const car = new THREE.Group();
  car.position.set(at.x, 0, at.z);
  car.rotation.y = Math.PI / 2;            // local +x (front) -> world -z (toward the room)
  scene.add(car);
  const L = 4.5, W = 1.82;

  const paint = new THREE.MeshPhysicalMaterial({ color: 0x29475e, metalness: 0.55, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.06 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0e1418, metalness: 0.75, roughness: 0.04, envMapIntensity: 1.4 });
  const black = new THREE.MeshStandardMaterial({ color: 0x141618, roughness: 0.55, metalness: 0.2 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xd8dde0, metalness: 1, roughness: 0.12 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xb7bcc0, metalness: 0.9, roughness: 0.22 });
  const tyreMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.88 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xe8eef2, metalness: 0.6, roughness: 0.08, emissive: 0xf4f6ff, emissiveIntensity: 0.12 });
  const drlMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xeaf2ff, emissiveIntensity: 0.9 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x7a0c10, metalness: 0.3, roughness: 0.15, emissive: 0x5a0306, emissiveIntensity: 0.6 });
  const add = (m) => { m.castShadow = false; m.receiveShadow = true; car.add(m); return m; };
  const extrude = (shape, depth, bevel, mat) => {
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.75, bevelSegments: 3, curveSegments: 18 });
    geo.translate(0, 0, -depth / 2);
    return add(new THREE.Mesh(geo, mat));
  };

  // lower body: bumpers, wheel arches, hood, trunk deck (side profile, extruded across the width)
  const ax = 1.36, ar = 0.395, ay = 0.34;
  const s = new THREE.Shape();
  s.moveTo(-2.12, 0.2);
  s.lineTo(-ax - ar, 0.2);
  s.absarc(-ax, ay, ar, Math.PI + 0.25, -0.25, true);
  s.lineTo(ax - ar, 0.2);
  s.absarc(ax, ay, ar, Math.PI + 0.25, -0.25, true);
  s.lineTo(2.1, 0.2);
  s.quadraticCurveTo(2.25, 0.24, 2.25, 0.46);
  s.lineTo(2.21, 0.64);
  s.quadraticCurveTo(2.15, 0.78, 1.92, 0.82);
  s.quadraticCurveTo(1.3, 0.9, 0.78, 0.96);
  s.lineTo(-1.5, 1.0);
  s.quadraticCurveTo(-2.0, 1.0, -2.14, 0.94);
  s.quadraticCurveTo(-2.26, 0.9, -2.26, 0.7);
  s.lineTo(-2.26, 0.42);
  s.quadraticCurveTo(-2.24, 0.22, -2.12, 0.2);
  extrude(s, W - 0.16, 0.08, paint);

  // greenhouse: windscreen, side glass, rear screen (narrower = tumblehome)
  const c = new THREE.Shape();
  c.moveTo(0.82, 0.95);
  c.quadraticCurveTo(0.3, 1.26, -0.12, 1.4);
  c.lineTo(-0.9, 1.42);
  c.quadraticCurveTo(-1.3, 1.37, -1.62, 0.99);
  c.lineTo(0.82, 0.95);
  extrude(c, 1.42, 0.06, glass);

  // roof skin over the glass
  const rf = new THREE.Shape();
  rf.moveTo(0.02, 1.355);
  rf.quadraticCurveTo(-0.08, 1.425, -0.25, 1.435);
  rf.lineTo(-0.88, 1.44);
  rf.quadraticCurveTo(-1.05, 1.425, -1.16, 1.355);
  rf.lineTo(0.02, 1.355);
  extrude(rf, 1.42, 0.06, paint);

  // pillars: A along the windscreen edge, C along the rear screen, B upright and black
  for (const zs of [-1, 1]) {
    const z = zs * 0.765;
    const aCurve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0.84, 0.97, z), new THREE.Vector3(0.3, 1.28, z), new THREE.Vector3(-0.1, 1.41, z * 0.97));
    add(new THREE.Mesh(new THREE.TubeGeometry(aCurve, 14, 0.04, 6, false), paint));
    const cCurve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-0.92, 1.42, z * 0.97), new THREE.Vector3(-1.3, 1.38, z), new THREE.Vector3(-1.6, 1.0, z));
    add(new THREE.Mesh(new THREE.TubeGeometry(cCurve, 14, 0.06, 6, false), paint));
    const bp = add(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.42, 0.02), black)); bp.position.set(-0.42, 1.2, zs * 0.79); bp.rotation.z = -0.12;
    // window trim line at the belt
    const belt = add(new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.02, 0.012), chrome)); belt.position.set(-0.4, 0.985, zs * 0.835);
    // door shut lines + handles
    for (const x of [0.66, -0.42]) {
      const ln = add(new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.6, 0.004), black)); ln.position.set(x, 0.66, zs * 0.913);
    }
    const ln = add(new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.22, 0.004), black)); ln.position.set(-0.98, 0.85, zs * 0.913);   // rear door ends above the arch
    const lnb = add(new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.006, 0.004), black)); lnb.scale.x = 1; lnb.position.set(-0.98, 0.74, zs * 0.913);
    for (const x of [0.12, -0.9]) {
      const h = add(new THREE.Mesh(new RoundedBox(k, 0.16, 0.03, 0.025, 0.01), chrome)); h.position.set(x, 0.86, zs * 0.915);
    }
    // side skirt
    const sk = add(new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.08, 0.03), black)); sk.position.set(0, 0.24, zs * 0.9);
    // mirror on a short arm
    const arm = add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.12), black)); arm.position.set(0.66, 1.0, zs * 0.86);
    const mir = add(new THREE.Mesh(new RoundedBox(k, 0.12, 0.1, 0.2, 0.035), paint)); mir.position.set(0.64, 1.04, zs * 0.98);
    const mg = add(new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.07), glass)); mg.position.set(0.575, 1.04, zs * 0.98); mg.rotation.y = -Math.PI / 2;
  }

  // front: grille, lower intake, headlight units with a DRL strip, plate
  const grille = add(new THREE.Mesh(new RoundedBox(k, 0.06, 0.17, 1.0, 0.03), black)); grille.position.set(2.29, 0.56, 0);
  for (let i = 0; i < 4; i++) { const b = add(new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.008, 0.94), chrome)); b.position.set(2.325, 0.5 + i * 0.04, 0); }
  const intake = add(new THREE.Mesh(new RoundedBox(k, 0.05, 0.1, 1.3, 0.03), black)); intake.position.set(2.3, 0.32, 0);
  for (const zs of [-1, 1]) {
    const hl = add(new THREE.Mesh(new RoundedBox(k, 0.16, 0.1, 0.42, 0.04), headMat)); hl.position.set(2.2, 0.7, zs * 0.6); hl.rotation.z = -0.35; hl.rotation.y = zs * 0.18;
    const drl = add(new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.012, 0.36), drlMat)); drl.position.set(2.27, 0.665, zs * 0.6); drl.rotation.y = zs * 0.18;
    const fog = add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.02, 14), headMat)); fog.position.set(2.31, 0.32, zs * 0.74); fog.rotation.z = Math.PI / 2;
  }
  const plateTex = k.canvasTex(256, 56, (g, w, h) => {
    g.fillStyle = "#f4f2ea"; g.fillRect(0, 0, w, h); g.strokeStyle = "#2c2118"; g.lineWidth = 3; g.strokeRect(2, 2, w - 4, h - 4);
    g.fillStyle = "#2c2118"; g.textAlign = "center"; g.font = "700 34px ui-monospace, Menlo, Consolas, monospace"; g.fillText("SR1 C 001", w / 2, 40);
  });
  const plateMat = new THREE.MeshStandardMaterial({ map: plateTex, roughness: 0.5 });
  const pf = add(new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.11), plateMat)); pf.position.set(2.335, 0.43, 0); pf.rotation.y = Math.PI / 2;

  // rear: full-width light bar, tail units, plate, diffuser
  for (const zs of [-1, 1]) {
    const tl = add(new THREE.Mesh(new RoundedBox(k, 0.06, 0.1, 0.46, 0.03), tailMat)); tl.position.set(-2.31, 0.84, zs * 0.62);
  }
  const bar = add(new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.025, 0.8), tailMat)); bar.position.set(-2.325, 0.86, 0);
  const pr = add(new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.11), plateMat)); pr.position.set(-2.335, 0.6, 0); pr.rotation.y = -Math.PI / 2;
  const diff = add(new THREE.Mesh(new RoundedBox(k, 0.06, 0.1, 1.3, 0.03), black)); diff.position.set(-2.3, 0.3, 0);

  // wheels: lathed tyre profile + five-spoke rim, brake disc, centre cap
  const prof = [];
  const tr = 0.345, ti = 0.215, tw = 0.115;
  prof.push(new THREE.Vector2(ti, -tw));
  for (let i = 0; i <= 6; i++) { const a = -Math.PI / 2 + (i / 6) * (Math.PI / 2); prof.push(new THREE.Vector2(tr - 0.04 + Math.cos(a) * 0.04, -tw + 0.04 + Math.sin(a) * 0.04)); }
  for (let i = 0; i <= 6; i++) { const a = (i / 6) * (Math.PI / 2); prof.push(new THREE.Vector2(tr - 0.04 + Math.cos(a) * 0.04, tw - 0.04 + Math.sin(a) * 0.04)); }
  prof.push(new THREE.Vector2(ti, tw));
  const tyreGeo = new THREE.LatheGeometry(prof, 32);
  const rimGeo = new THREE.CylinderGeometry(0.215, 0.215, 0.2, 28, 1, true);
  const faceGeo = new THREE.CircleGeometry(0.2, 28);
  const spokeGeo = new THREE.BoxGeometry(0.045, 0.18, 0.02);
  const discGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.02, 24);
  const capGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.02, 14);
  const faceMat = new THREE.MeshStandardMaterial({ color: 0x3a3e42, metalness: 0.7, roughness: 0.35 });
  for (const x of [ax, -ax]) for (const zs of [-1, 1]) {
    const w = new THREE.Group(); w.position.set(x, 0.345, zs * 0.77); car.add(w);
    const ty = new THREE.Mesh(tyreGeo, tyreMat); ty.rotation.x = Math.PI / 2; w.add(ty);
    const rim = new THREE.Mesh(rimGeo, rimMat); rim.rotation.x = Math.PI / 2; w.add(rim);
    const face = new THREE.Mesh(faceGeo, faceMat); face.position.z = zs * 0.06; if (zs < 0) face.rotation.y = Math.PI; w.add(face);
    const disc = new THREE.Mesh(discGeo, GM.steel); disc.rotation.x = Math.PI / 2; disc.position.z = zs * 0.03; w.add(disc);
    for (let i = 0; i < 5; i++) {
      const sp = new THREE.Mesh(spokeGeo, rimMat);
      const a = (i / 5) * Math.PI * 2;
      sp.position.set(Math.sin(a) * 0.1, Math.cos(a) * 0.1, zs * 0.085); sp.rotation.z = -a; w.add(sp);
    }
    const cap = new THREE.Mesh(capGeo, chrome); cap.rotation.x = Math.PI / 2; cap.position.z = zs * 0.095; w.add(cap);
  }
  // underbody, so the floor does not show between the wheels
  const under = add(new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.06, 1.6), black)); under.position.set(0, 0.2, 0);
  car.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  return car;
}
function RoundedBox(k, w, h, d, r) { return new k.RoundedBoxGeometry(w, h, d, 2, r); }
