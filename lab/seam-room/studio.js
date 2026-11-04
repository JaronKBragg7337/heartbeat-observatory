/* ============================================================================
   studio.js - Page I, the music studio behind hallway door 2
   ---------------------------------------------------------------------------
   Jaron picked it (11/4): door 2 (g-2, the barn red door on the hall's west
   wall at z 16.5) opens into a home recording studio. He used to make beats
   with a producer, and his song "First Light" brought that back, so this is
   his room: the session on the screen is called First Light, the neon on the
   back wall says it, and the beat machine on the desk plays a loop.
   Built into the SAME scene (one world, no portal): inside x -8.25..-4.6,
   z 12.0..21.4 (3.65 x 9.4 m), 2.7 m high. The hall wall is x -4.6..-4.45;
   hallway.js openDoor() cuts it and paints the leaf barn red; this file draws
   the studio's own face of that wall with the opening already in it. West of
   x -8.25 is the gym's wall.
   Control room (south, z 12.0..18.3): a walnut desk facing the booth glass
   with a mixing desk, a screen, the pad controller and two monitor speakers
   on stands; an office chair; a leather couch under two wood diffusers and
   the "first light" neon; a guitar on its stand; a credenza with a turntable
   and a crate of records; wedge foam, corner bass traps, a kilim rug, a floor
   lamp and a warm cove strip. A glass partition (z 18.3..18.42) with a big
   window and an open doorway at its east end leads to the vocal booth
   (z 18.42..21.4): foam on every wall, a condenser mic on a stand with a pop
   filter and headphones, a lyric stand, one warm pendant.
   THE BEAT: tap the pad controller (or the screen) and a loop plays, made in
   code with WebAudio (no samples, nothing downloaded): kick, snap, hats and
   a bass line, 88 BPM, swung, in F minor, with a little vinyl crackle. The
   pads light in time, the meters and the speaker cones move, the record on
   the turntable spins and ON AIR lights up. Tap again to stop. It stops by
   itself when you leave the studio (page I), hide the tab or leave the page.
   iPhone: the AudioContext is created and resumed inside the tap itself.
   Phone budget: static parts merged per material; foam tiles, diffuser
   blocks, pads, faders, knobs, speaker cones and record sleeves are
   InstancedMeshes; no shadows, NO new light (lamps glow, their light is
   additive decals). While the camera is in the studio the room's (A/B)
   static pieces go to an undrawn camera layer, like closet.js.
   ========================================================================== */
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export function buildStudio(k) {
  const { THREE, scene, M, canvasTex, rnd, solids, signTex } = k;
  const R = { x0: -8.25, x1: -4.6, z0: 12.0, z1: 21.4, h: 2.7 };
  const RW = R.x1 - R.x0, RD = R.z1 - R.z0, RCX = (R.x0 + R.x1) / 2, RCZ = (R.z0 + R.z1) / 2;
  const DOOR = { z0: 16.04, z1: 16.96, h: 2.05 };   // g-2, in the east wall (the hall's west wall)
  // the glass partition: window wx0..wx1 between wy0 and wy1; an open doorway from gx0 to the east wall
  const P = { z0: 18.3, z1: 18.42, wx0: -7.9, wx1: -5.85, wy0: 0.95, wy1: 2.05, gx0: -5.65, gh: 2.1 };
  const PZ = (P.z0 + P.z1) / 2, PT = P.z1 - P.z0;
  const solid = (a, b, c, d) => solids.push([a, b, c, d]);
  const world = () => k.world || window.__seam || null;
  const log = (t) => { if (typeof k.log === "function") k.log(t); };

  /* ------------------------------------------------- merge per material - */
  const map = new Map();
  const S = {
    add(geo, mat) {
      const g = geo.index ? geo.toNonIndexed() : geo;
      if (g !== geo) geo.dispose();
      for (const n of Object.keys(g.attributes)) if (n !== "position" && n !== "normal" && n !== "uv") g.deleteAttribute(n);
      if (!g.attributes.uv) g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      let b = map.get(mat.uuid); if (!b) map.set(mat.uuid, (b = { mat, geos: [] }));
      b.geos.push(g);
    },
    flush(into) {
      const out = [];
      for (const b of map.values()) {
        const g = mergeGeometries(b.geos, false);
        for (const q of b.geos) q.dispose();
        const m = new THREE.Mesh(g, b.mat); m.castShadow = false; m.receiveShadow = false;
        if (b.mat.transparent) m.renderOrder = 2;
        into.add(m); out.push(m);
      }
      map.clear();
      return out;
    },
  };
  const boxG = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x || 0, y || 0, z || 0);
  const cylG = (r1, r2, h, seg, x, y, z, rx, rz) => { const g = new THREE.CylinderGeometry(r1, r2, h, seg || 16); if (rx) g.rotateX(rx); if (rz) g.rotateZ(rz); return g.translate(x || 0, y || 0, z || 0); };
  function quadG(w, h, tu, tv) {   // a rectangle with UVs in metres / tile
    const g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv;
    if (tu) for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / tu, uv.getY(i) * h / (tv || tu));
    return g;
  }
  const at = (geo, m) => geo.applyMatrix4(m);
  const rb = (w, h, d, r) => (k.RoundedBoxGeometry ? new k.RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001)) : new THREE.BoxGeometry(w, h, d));
  const ry = (a) => new THREE.Matrix4().makeRotationY(a);
  const tr = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);

  /* ---------------------------------------------------------- textures - */
  const boards = canvasTex(256, 512, (g, w, h) => {   // dark walnut boards along z, 125 mm: one repeat = 1 x 2 m
    const r = rnd(1301), n = 8, bw = w / n;
    for (let i = 0; i < n; i++) {
      let y = -r() * 300;
      while (y < h) {
        const len = 160 + r() * 300, t = (r() - 0.5) * 18;
        g.fillStyle = `rgb(${92 + t},${62 + t * 0.8},${42 + t * 0.6})`; g.fillRect(i * bw, y, bw, len);
        for (let q = 0; q < 5; q++) {
          g.strokeStyle = `rgba(30,16,8,${0.08 + r() * 0.1})`; g.lineWidth = 0.6 + r();
          const x = i * bw + r() * bw; g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + (r() - 0.5) * 4, y + len * 0.3, x + (r() - 0.5) * 4, y + len * 0.7, x + (r() - 0.5) * 3, y + len); g.stroke();
        }
        g.fillStyle = "rgba(15,8,4,.6)"; g.fillRect(i * bw, y, bw, 2);
        y += len;
      }
      g.fillStyle = "rgba(15,8,4,.55)"; g.fillRect(i * bw, 0, 1.5, h);
    }
  });
  boards.wrapS = boards.wrapT = THREE.RepeatWrapping;
  const fleck = canvasTex(128, 128, (g, w, h) => {   // carpet, fabric walls: fine flecks, tinted by the material colour
    const r = rnd(1303); g.fillStyle = "#e9e6e2"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { const v = r() < 0.5 ? 0 : 255; g.fillStyle = `rgba(${v},${v},${v},${0.04 + r() * 0.1})`; g.fillRect(r() * w, r() * h, 1 + r() * 1.5, 1); }
  });
  fleck.wrapS = fleck.wrapT = THREE.RepeatWrapping;
  const kilim = canvasTex(256, 256, (g, w, h) => {   // a warm kilim: rust field, cream and indigo diamonds, a striped border
    const r = rnd(1305);
    g.fillStyle = "#8a3a22"; g.fillRect(0, 0, w, h);
    for (const [o, c] of [[0, "#2a1c18"], [10, "#d9b98a"], [16, "#2a1c18"], [24, "#c4692e"]]) { g.strokeStyle = c; g.lineWidth = 6; g.strokeRect(o + 3, o + 3, w - 2 * o - 6, h - 2 * o - 6); }
    for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
      const cx = 64 + col * 64, cy = 64 + row * 64;
      g.fillStyle = (row + col) % 2 ? "#d9b98a" : "#263552";
      g.beginPath(); g.moveTo(cx, cy - 26); g.lineTo(cx + 22, cy); g.lineTo(cx, cy + 26); g.lineTo(cx - 22, cy); g.closePath(); g.fill();
      g.fillStyle = "#8a3a22"; g.beginPath(); g.moveTo(cx, cy - 12); g.lineTo(cx + 10, cy); g.lineTo(cx, cy + 12); g.lineTo(cx - 10, cy); g.closePath(); g.fill();
      g.fillStyle = "#e6a24a"; g.fillRect(cx - 3, cy - 3, 6, 6);
    }
    for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(${r() < 0.5 ? "0,0,0" : "255,230,200"},${0.04 + r() * 0.06})`; g.fillRect(r() * w, r() * h, 2, 1); }
  });
  const glowTex = canvasTex(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.35, "rgba(255,255,255,.45)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  const bandTex = canvasTex(64, 128, (g, w, h) => {   // a wash that fades downward (the cove strip on the walls)
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  // the mixing desk's face: 12 channel strips (scribble strip, 4 knobs, mute/solo, a fader slot) and a master section
  const CH_NAMES = ["KICK", "SNAP", "HATS", "BASS", "KEYS", "PAD", "VOX", "VOX DBL", "GTR", "FX", "VERB", "DLY"];
  const mixerTex = canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = "#2b2c2e"; g.fillRect(0, 0, w, h);
    const sw = 34;
    for (let i = 0; i < 12; i++) {
      const x = 8 + i * sw;
      g.fillStyle = i % 2 ? "#2f3032" : "#323336"; g.fillRect(x, 4, sw - 2, h - 8);
      g.fillStyle = "#c9d6a8"; g.fillRect(x + 2, 8, sw - 6, 14);
      g.fillStyle = "#1d1f1a"; g.font = "700 8px ui-monospace, Menlo, Consolas, monospace"; g.textAlign = "center"; g.fillText(CH_NAMES[i], x + sw / 2 - 1, 18);
      for (let kq = 0; kq < 4; kq++) { g.fillStyle = ["#d0d0d0", "#c84a3a", "#3a7ac8", "#d8a83a"][kq]; g.beginPath(); g.arc(x + sw / 2 - 1, 36 + kq * 20, 6, 0, 7); g.fill(); g.fillStyle = "#111"; g.fillRect(x + sw / 2 - 2, 31 + kq * 20, 2, 5); }
      g.fillStyle = "#6a6a6a"; g.fillRect(x + 5, 116, 10, 8); g.fillStyle = "#a88a2a"; g.fillRect(x + 17, 116, 10, 8);
      g.fillStyle = "#111"; g.fillRect(x + sw / 2 - 2, 134, 3, 110);
      for (let t = 0; t < 10; t++) { g.fillStyle = "#777"; g.fillRect(x + 4, 136 + t * 11, 5, 1); }
    }
    g.fillStyle = "#26272a"; g.fillRect(420, 4, 88, h - 8);
    g.fillStyle = "#e8dcc2"; g.font = "700 11px Georgia, serif"; g.textAlign = "center"; g.fillText("MASTER", 464, 22);
    g.fillStyle = "#111"; g.fillRect(445, 134, 3, 110); g.fillRect(480, 134, 3, 110);
    g.fillStyle = "#3a3b3e"; g.fillRect(432, 34, 64, 84);
  });
  // the screen: the DAW, session "First Light"
  const dawTex = canvasTex(512, 300, (g, w, h) => {
    const r = rnd(1309);
    g.fillStyle = "#1b1d22"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#2a2d35"; g.fillRect(0, 0, w, 26);
    g.fillStyle = "#f0d9a8"; g.font = "700 14px Georgia, serif"; g.textAlign = "left"; g.fillText("First Light", 10, 18);
    g.fillStyle = "#9aa3b2"; g.font = "11px ui-monospace, Menlo, Consolas, monospace"; g.fillText("88 BPM   F minor   4/4", 120, 18);
    g.fillStyle = "#e86a3a"; g.beginPath(); g.arc(w - 18, 13, 6, 0, 7); g.fill();
    const tracks = [["Kick", "#e8813a"], ["Snap", "#e8566e"], ["Hats", "#e8c25a"], ["Bass", "#a77be8"], ["Keys", "#5ab8e8"], ["Vox", "#6ad08a"]];
    tracks.forEach(([name, c], i) => {
      const y = 34 + i * 42;
      g.fillStyle = "#23262d"; g.fillRect(0, y, 78, 38);
      g.fillStyle = c; g.fillRect(0, y, 4, 38);
      g.fillStyle = "#d8dce4"; g.font = "12px system-ui, sans-serif"; g.fillText(name, 10, y + 23);
      for (let bar = 0; bar < 8; bar++) {
        if (name === "Vox" && bar < 2) continue;
        if (name === "Keys" && bar % 4 === 3) continue;
        const x = 82 + bar * 53;
        g.fillStyle = c + "55"; g.fillRect(x, y + 2, 51, 34);
        g.fillStyle = c;
        if (/Kick|Snap|Hats/.test(name)) { for (let s = 0; s < 16; s++) if ((name === "Kick" && [0, 7, 10].includes(s)) || (name === "Snap" && (s === 4 || s === 12)) || (name === "Hats" && s % 2 === 0)) g.fillRect(x + 2 + s * 3, y + 8, 2, 22); }
        else if (name === "Bass" || name === "Keys") { for (let s = 0; s < 4; s++) g.fillRect(x + 3 + s * 12, y + 8 + ((bar + s) % 4) * 5, 9, 4); }
        else { g.beginPath(); g.moveTo(x, y + 19); for (let q = 0; q < 51; q++) g.lineTo(x + q, y + 19 + (r() - 0.5) * 26 * Math.sin(q / 6)); g.strokeStyle = c; g.stroke(); }
      }
    });
    g.fillStyle = "#3a3e48"; for (let bar = 0; bar <= 8; bar++) g.fillRect(82 + bar * 53, 30, 1, h - 30);
    g.fillStyle = "#9aa3b2"; g.font = "10px ui-monospace, Menlo, monospace"; for (let bar = 0; bar < 8; bar++) g.fillText(String(bar + 1), 85 + bar * 53, 30);
  });
  // the pad controller's face: a small screen and labels (the pads themselves are 3D)
  const ctrlTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "#26262a"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#121315"; g.fillRect(14, 14, 132, 40);
    g.fillStyle = "#ffb35c"; g.font = "700 13px ui-monospace, Menlo, Consolas, monospace"; g.textAlign = "left";
    g.fillText("FIRST LIGHT", 20, 31); g.fillStyle = "#c98a46"; g.font = "11px ui-monospace, Menlo, monospace"; g.fillText("88 BPM  TAP PADS", 20, 47);
    for (let i = 0; i < 4; i++) { g.fillStyle = "#3b3b40"; g.beginPath(); g.arc(170 + i * 22, 34, 8, 0, 7); g.fill(); g.fillStyle = "#ddd"; g.fillRect(169 + i * 22, 26, 2, 7); }
    g.fillStyle = "#6f6f76"; g.font = "700 10px system-ui, sans-serif"; g.fillText("HB PAD 16", 186, 245);
  });
  // the neon on the back wall: "first light" in warm script, with its own glow
  const neonTex = canvasTex(512, 168, (g, w, h) => {
    g.textAlign = "center"; g.textBaseline = "middle";
    g.font = "italic 600 78px 'Brush Script MT', 'Segoe Script', 'Snell Roundhand', cursive";
    for (const [blur, a] of [[30, 0.9], [14, 0.9], [4, 1]]) { g.shadowColor = `rgba(255,140,60,${a})`; g.shadowBlur = blur; g.fillStyle = "#ffd9a8"; g.fillText("first light", w / 2, h / 2 + 4); }
    g.shadowBlur = 0; g.fillStyle = "#fff4e2"; g.fillText("first light", w / 2, h / 2 + 4);
  });
  const onAirTex = canvasTex(256, 72, (g, w, h) => {
    g.fillStyle = "#1a0404"; g.fillRect(0, 0, w, h);
    g.shadowColor = "rgba(255,60,40,.9)"; g.shadowBlur = 12;
    g.fillStyle = "#ff4a36"; g.font = "800 44px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("ON AIR", w / 2, h / 2 + 2);
  });
  // the guitar's top: a sunburst with a sound hole, a rosette, a pickguard and a bridge (UVs fit the body outline)
  const burstTex = canvasTex(256, 320, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h * 0.62, 10, w / 2, h * 0.62, w * 0.62);
    gr.addColorStop(0, "#e7a648"); gr.addColorStop(0.5, "#b8641e"); gr.addColorStop(0.82, "#4a2410"); gr.addColorStop(1, "#1e0e06");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const hx = w / 2, hy = h * (1 - 0.33 / 0.51);
    g.strokeStyle = "#2a1a10"; g.lineWidth = 5; g.beginPath(); g.arc(hx, hy, 34, 0, 7); g.stroke();
    g.strokeStyle = "#e8d6b0"; g.lineWidth = 2; g.beginPath(); g.arc(hx, hy, 30, 0, 7); g.stroke();
    g.fillStyle = "#0c0705"; g.beginPath(); g.arc(hx, hy, 26, 0, 7); g.fill();
    g.fillStyle = "rgba(20,10,6,.85)"; g.beginPath(); g.ellipse(hx + 40, hy + 34, 22, 34, -0.4, 0, 7); g.fill();   // pickguard
    g.fillStyle = "#2a1a12"; g.fillRect(hx - 38, h * (1 - 0.12 / 0.51) - 7, 76, 14);                            // bridge
    g.fillStyle = "#e8dcc2"; g.fillRect(hx - 30, h * (1 - 0.12 / 0.51) - 3, 60, 2);
  });
  const recordTex = canvasTex(256, 256, (g, w, h) => {   // a record on the platter: grooves, an orange label
    g.fillStyle = "#0e0e0f"; g.fillRect(0, 0, w, h);
    for (let rr = 40; rr < 126; rr += 2) { g.strokeStyle = `rgba(255,255,255,${rr % 6 ? 0.04 : 0.09})`; g.lineWidth = 1; g.beginPath(); g.arc(w / 2, h / 2, rr, 0, 7); g.stroke(); }
    g.fillStyle = "#e0782f"; g.beginPath(); g.arc(w / 2, h / 2, 38, 0, 7); g.fill();
    g.fillStyle = "#2a1408"; g.font = "700 11px Georgia, serif"; g.textAlign = "center"; g.fillText("FIRST LIGHT", w / 2, h / 2 - 10);
    g.font = "9px Georgia, serif"; g.fillText("side A", w / 2, h / 2 + 18);
    g.fillStyle = "#ddd"; g.beginPath(); g.arc(w / 2, h / 2, 3, 0, 7); g.fill();
  });
  const lyricTex = canvasTex(192, 256, (g, w, h) => {   // a lyric sheet, pencil lines (no words you could read)
    const r = rnd(1311);
    g.fillStyle = "#f4efe2"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#3a3026"; g.font = "italic 700 16px Georgia, serif"; g.textAlign = "left"; g.fillText("First Light", 16, 28);
    for (let l = 0; l < 13; l++) { const y = 52 + l * 15; if (l % 5 === 4) continue; g.strokeStyle = "rgba(60,50,40,.55)"; g.lineWidth = 1.2; g.beginPath(); g.moveTo(16, y); let x = 16; while (x < 60 + r() * 110) { x += 4 + r() * 6; g.lineTo(x, y + (r() - 0.5) * 3); } g.stroke(); }
  });

  /* --------------------------------------------------------- materials - */
  const add = THREE.AdditiveBlending;
  const SM = {
    floor: new THREE.MeshStandardMaterial({ map: boards, color: 0xc8b8a8, roughness: 0.5 }),
    carpet: new THREE.MeshStandardMaterial({ map: fleck, color: 0x3e3a38, roughness: 1 }),
    wall: new THREE.MeshStandardMaterial({ map: fleck, color: 0x5a4e48, roughness: 0.96 }),
    ceil: new THREE.MeshStandardMaterial({ map: fleck, color: 0x34302e, roughness: 1 }),
    trim: new THREE.MeshStandardMaterial({ color: 0x3a2618, roughness: 0.55 }),
    walnut: M.walnut,
    steel: new THREE.MeshStandardMaterial({ color: 0x1e1d1c, roughness: 0.45, metalness: 0.55 }),
    fabric: new THREE.MeshStandardMaterial({ map: fleck, color: 0x2a2726, roughness: 0.98 }),
    leather: new THREE.MeshStandardMaterial({ color: 0x6e3c22, roughness: 0.55 }),
    pillow: new THREE.MeshStandardMaterial({ map: fleck, color: 0xb8622c, roughness: 0.95 }),
    rug: new THREE.MeshStandardMaterial({ map: kilim, roughness: 0.98 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xd2d5d8, roughness: 0.2, metalness: 0.95 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.85 }),
    cab: new THREE.MeshStandardMaterial({ color: 0x18181a, roughness: 0.5 }),
    mixerBody: new THREE.MeshStandardMaterial({ color: 0x3a3b3e, roughness: 0.45, metalness: 0.3 }),
    mixerFace: new THREE.MeshStandardMaterial({ map: mixerTex, roughness: 0.55 }),
    screen: new THREE.MeshBasicMaterial({ map: dawTex, color: 0xd8d8d8 }),
    ctrlFace: new THREE.MeshStandardMaterial({ map: ctrlTex, roughness: 0.6 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x9fb8c0, roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }),
    shade: new THREE.MeshStandardMaterial({ color: 0xf0d8b0, roughness: 0.9, emissive: 0xffb060, emissiveIntensity: 0.9 }),
    glow: new THREE.MeshBasicMaterial({ color: 0xffe2b8 }),
    cove: new THREE.MeshBasicMaterial({ color: 0xffa860 }),
    pool: new THREE.MeshBasicMaterial({ map: glowTex, color: 0xffb070, transparent: true, opacity: 0.16, blending: add, depthWrite: false }),
    wash: new THREE.MeshBasicMaterial({ map: bandTex, color: 0xff9448, transparent: true, opacity: 0.13, blending: add, depthWrite: false }),
    shadow: new THREE.MeshBasicMaterial({ map: glowTex, color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }),
    neon: new THREE.MeshBasicMaterial({ map: neonTex, transparent: true, blending: add, depthWrite: false }),
    onAir: new THREE.MeshBasicMaterial({ map: onAirTex, color: 0x5a4444 }),
    top: new THREE.MeshStandardMaterial({ map: burstTex, roughness: 0.3 }),
    rosewood: new THREE.MeshStandardMaterial({ color: 0x4a2716, roughness: 0.4 }),
    maple: new THREE.MeshStandardMaterial({ color: 0xcf9f66, roughness: 0.4 }),
    ebony: new THREE.MeshStandardMaterial({ color: 0x1f140e, roughness: 0.5 }),
    record: new THREE.MeshStandardMaterial({ map: recordTex, roughness: 0.3 }),
    paper: new THREE.MeshStandardMaterial({ map: lyricTex, roughness: 0.9 }),
    mug: new THREE.MeshStandardMaterial({ color: 0xe9e0cf, roughness: 0.35 }),
    coffee: new THREE.MeshStandardMaterial({ color: 0x2a160b, roughness: 0.2 }),
    popMesh: new THREE.MeshBasicMaterial({ color: 0x0a0a0a, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }),
    micBody: new THREE.MeshStandardMaterial({ color: 0xc9b48a, roughness: 0.3, metalness: 0.8 }),
    sign: new THREE.MeshStandardMaterial({ map: signTex("I", "/lab/seam-room/i/"), roughness: 0.7 }),
  };

  /* ------------------------------------------------------------- shell - */
  S.add(quadG(RW, P.z1 - R.z0, 1, 2).rotateX(-Math.PI / 2).translate(RCX, 0, (R.z0 + P.z1) / 2), SM.floor);
  S.add(quadG(RW, R.z1 - P.z1, 0.5).rotateX(-Math.PI / 2).translate(RCX, 0.002, (P.z1 + R.z1) / 2), SM.carpet);
  S.add(quadG(RW, RD, 0.5).rotateX(Math.PI / 2).translate(RCX, R.h, RCZ), SM.ceil);
  S.add(quadG(RW, R.h, 0.6).translate(RCX, R.h / 2, R.z0), SM.wall);                                   // south
  S.add(quadG(RW, R.h, 0.6).rotateY(Math.PI).translate(RCX, R.h / 2, R.z1), SM.wall);                  // north
  S.add(quadG(RD, R.h, 0.6).rotateY(Math.PI / 2).translate(R.x0, R.h / 2, RCZ), SM.wall);              // west (the gym's wall)
  const eastQuad = (z0, z1, y0, y1) => S.add(quadG(z1 - z0, y1 - y0, 0.6).rotateY(-Math.PI / 2).translate(R.x1, (y0 + y1) / 2, (z0 + z1) / 2), SM.wall);
  eastQuad(R.z0, DOOR.z0, 0, R.h); eastQuad(DOOR.z1, R.z1, 0, R.h); eastQuad(DOOR.z0, DOOR.z1, DOOR.h, R.h);   // east, with the door opening
  for (const z of [DOOR.z0 - 0.035, DOOR.z1 + 0.035]) S.add(boxG(0.02, DOOR.h + 0.07, 0.07, R.x1 - 0.01, (DOOR.h + 0.07) / 2, z), SM.trim);
  S.add(boxG(0.02, 0.07, DOOR.z1 - DOOR.z0 + 0.14, R.x1 - 0.01, DOOR.h + 0.035, (DOOR.z0 + DOOR.z1) / 2), SM.trim);
  S.add(quadG(0.38, 0.24).rotateY(-Math.PI / 2).translate(R.x1 - 0.006, 2.33, (DOOR.z0 + DOOR.z1) / 2), SM.sign);   // PAGE I over the door
  S.add(boxG(0.012, 0.26, 0.4, R.x1 - 0.003, 2.33, (DOOR.z0 + DOOR.z1) / 2), SM.steel);
  // baseboards
  const BB = 0.08;
  S.add(boxG(RW, BB, 0.015, RCX, BB / 2, R.z0 + 0.0075), SM.trim);
  S.add(boxG(RW, BB, 0.015, RCX, BB / 2, R.z1 - 0.0075), SM.trim);
  S.add(boxG(0.015, BB, RD, R.x0 + 0.0075, BB / 2, RCZ), SM.trim);
  for (const [z0, z1] of [[R.z0, DOOR.z0 - 0.07], [DOOR.z1 + 0.07, R.z1]]) S.add(boxG(0.015, BB, z1 - z0, R.x1 - 0.0075, BB / 2, (z0 + z1) / 2), SM.trim);

  /* ------------------------------------------------- the glass partition - */
  const pbox = (x0, x1, y0, y1) => S.add(boxG(x1 - x0, y1 - y0, PT, (x0 + x1) / 2, (y0 + y1) / 2, PZ), SM.wall);
  pbox(R.x0, P.wx0, 0, R.h); pbox(P.wx0, P.wx1, 0, P.wy0); pbox(P.wx0, P.wx1, P.wy1, R.h); pbox(P.wx1, P.gx0, 0, R.h); pbox(P.gx0, R.x1, P.gh, R.h);
  // window: walnut frame on both faces, a sill on the control side, two panes (double glazing)
  const WW = P.wx1 - P.wx0, WH = P.wy1 - P.wy0, WCX = (P.wx0 + P.wx1) / 2, WCY = (P.wy0 + P.wy1) / 2;
  for (const s of [-1, 1]) {
    const z = PZ + s * (PT / 2 + 0.012);
    S.add(boxG(WW + 0.12, 0.06, 0.024, WCX, P.wy1 + 0.03, z), SM.trim);
    S.add(boxG(WW + 0.12, 0.06, 0.024, WCX, P.wy0 - 0.03, z), SM.trim);
    for (const x of [P.wx0 - 0.03, P.wx1 + 0.03]) S.add(boxG(0.06, WH, 0.024, x, WCY, z), SM.trim);
  }
  S.add(boxG(WW + 0.14, 0.03, 0.2, WCX, P.wy0, P.z0 - 0.05), SM.trim);
  for (const z of [P.z0 + 0.03, P.z1 - 0.03]) S.add(quadG(WW, WH).translate(WCX, WCY, z), SM.glass);
  // the booth doorway: casing on the control side, a threshold
  for (const x of [P.gx0 - 0.035]) S.add(boxG(0.07, P.gh + 0.07, 0.02, x, (P.gh + 0.07) / 2, P.z0 - 0.01), SM.trim);
  S.add(boxG(R.x1 - P.gx0 + 0.07, 0.07, 0.02, (P.gx0 + R.x1) / 2 - 0.035, P.gh + 0.035, P.z0 - 0.01), SM.trim);
  S.add(boxG(R.x1 - P.gx0, 0.012, PT + 0.04, (P.gx0 + R.x1) / 2, 0.006, PZ), SM.trim);
  solid(R.x0, P.z0, P.gx0, P.z1);
  // ON AIR over the window (control side): dark until the beat plays
  S.add(boxG(0.5, 0.15, 0.04, WCX, 2.33, P.z0 - 0.02), SM.steel);
  const onAir = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.13).rotateY(Math.PI), SM.onAir);
  onAir.position.set(WCX, 2.33, P.z0 - 0.041); scene.add(onAir);

  /* ------------------------------------------------- foam, traps, diffusers - */
  // wedge foam tile, 0.5 x 0.5, five ridges; front = +z. Alternate tiles turn 90 degrees (the classic checkerboard).
  const foamGeo = (() => {
    const s = new THREE.Shape(), W = 0.5, n = 5, b = 0.018, t = 0.06;
    s.moveTo(0, 0); s.lineTo(0, b);
    for (let i = 0; i < n; i++) { s.lineTo((i + 0.5) * W / n, t); s.lineTo((i + 1) * W / n, b); }
    s.lineTo(W, 0); s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: W, bevelEnabled: false }).rotateX(Math.PI / 2).translate(-W / 2, W / 2, 0);
  })();
  const tiles = [];   // [x, y, z, wall yaw, colour]
  const FOAM = { char: 0x2e2b2c, wine: 0x5e1f27, rust: 0x8c4320 };
  function foamWall(yaw, ox, oz, dx, dz, u0, y0, cols, rows, colourOf) {
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
      const u = u0 + (c + 0.5) * 0.5;
      tiles.push([ox + dx * u, y0 + (r + 0.5) * 0.5, oz + dz * u, yaw, (r + c) & 1, colourOf(c, r)]);
    }
  }
  const ctl = (c, r) => ((c + r) % 3 === 0 ? FOAM.wine : FOAM.char);
  const booth = (c, r) => (r === 1 ? FOAM.rust : FOAM.char);
  foamWall(Math.PI / 2, R.x0 + 0.002, 0, 0, 1, 12.45, 1.1, 8, 2, ctl);       // west wall, control room
  foamWall(-Math.PI / 2, R.x1 - 0.002, 0, 0, 1, 13.25, 1.15, 4, 2, ctl);     // east wall, over the credenza
  foamWall(Math.PI, 0, R.z1 - 0.002, 1, 0, -8.175, 0.85, 7, 3, booth);        // booth, north wall
  foamWall(Math.PI / 2, R.x0 + 0.002, 0, 0, 1, 18.65, 0.85, 5, 3, booth);     // booth, west wall
  foamWall(-Math.PI / 2, R.x1 - 0.002, 0, 0, 1, 18.65, 0.85, 5, 3, booth);    // booth, east wall
  const foamIM = new THREE.InstancedMesh(foamGeo, new THREE.MeshStandardMaterial({ map: fleck, roughness: 1 }), tiles.length);
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), col = new THREE.Color(), sc = new THREE.Vector3();
  tiles.forEach((t, i) => {
    q.setFromEuler(e.set(0, t[3], t[4] ? Math.PI / 2 : 0, "YXZ"));
    foamIM.setMatrixAt(i, mtx.compose(v.set(t[0], t[1], t[2]), q, one));
    foamIM.setColorAt(i, col.setHex(t[5]));
  });
  foamIM.name = "studio-foam";
  // corner bass traps, floor to ceiling (south corners)
  const trap = (sx) => { const s = new THREE.Shape(), L = 0.38; s.moveTo(0, 0); s.lineTo(sx * L, 0); s.lineTo(0, -L); s.closePath(); return new THREE.ExtrudeGeometry(s, { depth: R.h, bevelEnabled: false }).rotateX(-Math.PI / 2); };
  S.add(trap(1).translate(R.x0, 0, R.z0), SM.fabric);
  S.add(trap(-1).translate(R.x1, 0, R.z0), SM.fabric);
  solid(R.x0, R.z0, R.x0 + 0.38, R.z0 + 0.38); solid(R.x1 - 0.38, R.z0, R.x1, R.z0 + 0.38);
  // two skyline diffusers over the couch: 12 x 12 wood blocks each, depths from a quadratic-residue pattern
  const blocks = [];
  for (const cx of [-6.94, -6.26]) {
    S.add(boxG(0.62, 0.62, 0.02, cx, 1.62, R.z0 + 0.01), SM.trim);
    for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) {
      const d = 0.02 + (((i * i + j * j * 3 + (cx < -6.5 ? 5 : 0)) % 13) / 12) * 0.12;
      blocks.push([cx - 0.275 + i * 0.05, 1.345 + j * 0.05, d]);
    }
  }
  const blockIM = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0, 0.5), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }), blocks.length);
  const BR = rnd(1313);
  blocks.forEach((b, i) => {
    blockIM.setMatrixAt(i, mtx.compose(v.set(b[0], b[1], R.z0 + 0.02), q.identity(), sc.set(0.047, 0.047, b[2])));
    const t = 0.8 + BR() * 0.2; blockIM.setColorAt(i, col.setRGB(0.42 * t, 0.27 * t, 0.16 * t));
  });
  blockIM.name = "studio-diffusers";
  // the ceiling cloud over the desk
  S.add(boxG(1.8, 0.06, 1.1, -7.0, R.h - 0.22, 17.25), SM.fabric);
  S.add(boxG(1.82, 0.065, 0.02, -7.0, R.h - 0.22, 16.7), SM.trim); S.add(boxG(1.82, 0.065, 0.02, -7.0, R.h - 0.22, 17.8), SM.trim);
  for (const x of [-7.8, -6.2]) for (const z of [16.8, 17.7]) S.add(cylG(0.003, 0.003, 0.19, 4, x, R.h - 0.095, z), SM.chrome);

  /* ---------------------------------------------- the desk and what is on it - */
  const DK = { x0: -7.95, x1: -6.05, z0: 17.2, z1: 17.9, y: 0.76 }, DKX = (DK.x0 + DK.x1) / 2, DKW = DK.x1 - DK.x0, DKZ = (DK.z0 + DK.z1) / 2;
  S.add(boxG(DKW, 0.04, DK.z1 - DK.z0, DKX, DK.y - 0.02, DKZ), SM.walnut);
  for (const x of [DK.x0 + 0.03, DK.x1 - 0.03]) { S.add(boxG(0.04, DK.y - 0.04, 0.6, x, (DK.y - 0.04) / 2, DKZ), SM.steel); S.add(boxG(0.06, 0.02, 0.66, x, 0.01, DKZ), SM.steel); }
  S.add(boxG(DKW - 0.1, 0.3, 0.02, DKX, 0.5, DK.z1 - 0.06), SM.steel);                              // modesty panel
  S.add(boxG(DKW, 0.025, 0.2, DKX, 0.93, DK.z1 - 0.1), SM.walnut);                                  // the bridge shelf
  for (const x of [DK.x0 + 0.05, DKX, DK.x1 - 0.05]) S.add(boxG(0.04, 0.15, 0.18, x, DK.y + 0.075, DK.z1 - 0.1), SM.walnut);
  S.add(boxG(DKW - 0.1, 0.008, 0.01, DKX, 0.913, DK.z1 - 0.2), SM.cove);                            // LED strip under the bridge
  S.add(quadG(DKW, 0.5).rotateX(-Math.PI / 2).translate(DKX, DK.y + 0.002, DK.z1 - 0.3), SM.pool);
  // the screen on the bridge
  const SCR = { x: -7.05, y: 1.2, z: DK.z1 - 0.08, w: 0.62, h: 0.37 };
  S.add(boxG(SCR.w + 0.03, SCR.h + 0.03, 0.03, SCR.x, SCR.y, SCR.z), SM.cab);
  S.add(boxG(0.05, 0.22, 0.03, SCR.x, 1.01, SCR.z + 0.03), SM.steel); S.add(boxG(0.22, 0.012, 0.16, SCR.x, 0.949, SCR.z), SM.steel);
  S.add(quadG(SCR.w, SCR.h).rotateY(Math.PI).translate(SCR.x, SCR.y, SCR.z - 0.0155), SM.screen);
  const playhead = new THREE.Mesh(new THREE.PlaneGeometry(0.003, SCR.h - 0.04).rotateY(Math.PI), new THREE.MeshBasicMaterial({ color: 0xfff1d0 }));
  playhead.position.set(SCR.x, SCR.y - 0.012, SCR.z - 0.016); playhead.visible = false; scene.add(playhead);
  const screenHit = new THREE.Mesh(new THREE.BoxGeometry(SCR.w, SCR.h, 0.06), new THREE.MeshBasicMaterial());
  screenHit.position.set(SCR.x, SCR.y, SCR.z); screenHit.visible = false; scene.add(screenHit);
  // the mixing desk: a sloped body, the strip face, 3D fader caps and knob caps
  const MX = { x: -7.18, z: 17.44, w: 0.8, d: 0.42 };
  const mixerTilt = 0.15, faceY = DK.y + 0.066;
  S.add(boxG(MX.w, 0.03, MX.d, MX.x, DK.y + 0.015, MX.z), SM.mixerBody);
  S.add(boxG(MX.w, 0.09, 0.06, MX.x, DK.y + 0.045, MX.z + MX.d / 2 - 0.03), SM.mixerBody);
  S.add(quadG(MX.w - 0.01, MX.d - 0.01).rotateX(-Math.PI / 2).rotateY(Math.PI).rotateX(-mixerTilt).translate(MX.x, faceY, MX.z), SM.mixerFace);
  // a point on the face from texture coords (u 0..1 left->right as you sit, v 0..1 top(far)->bottom(near))
  const faceAt = (u, vv, lift) => {
    const lx = (u - 0.5) * (MX.w - 0.01), lz = (vv - 0.5) * (MX.d - 0.01);   // lz > 0 = near you (-z)
    const yOff = lz * Math.sin(mixerTilt), zOff = -lz * Math.cos(mixerTilt);
    return new THREE.Vector3(MX.x - lx, faceY - yOff + (lift || 0) * Math.cos(mixerTilt), MX.z + zOff - (lift || 0) * Math.sin(mixerTilt));
  };
  const FR = rnd(1315), faders = [], knobs = [];
  for (let i = 0; i < 13; i++) {
    const u = i < 12 ? (8 + i * 34 + 16) / 512 : 446 / 512;
    faders.push([u, 0.55 + FR() * 0.35]);
    if (i < 12) for (let kq = 0; kq < 4; kq++) knobs.push([u, (36 + kq * 20) / 256, kq]);
  }
  faders.push([481 / 512, 0.6]);
  const faderIM = new THREE.InstancedMesh(new THREE.BoxGeometry(0.018, 0.014, 0.012), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }), faders.length);
  const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(mixerTilt, 0, 0));
  faders.forEach((f, i) => {
    faderIM.setMatrixAt(i, mtx.compose(faceAt(f[0], f[1], 0.007), tilt, one));
    faderIM.setColorAt(i, col.setHex(i >= 12 ? 0xc84a3a : 0xdedede));
  });
  const knobIM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.0075, 0.009, 0.014, 10), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }), knobs.length);
  knobs.forEach((kb, i) => {
    knobIM.setMatrixAt(i, mtx.compose(faceAt(kb[0], kb[1], 0.007), tilt, one));
    knobIM.setColorAt(i, col.setHex([0x2a2a2a, 0x7a2a22, 0x22427a, 0x7a5a1a][kb[2]]));
  });
  // VU meters on the master section: two columns of 12 LEDs (they move with the beat)
  const meters = [];
  for (let m = 0; m < 2; m++) for (let s = 0; s < 12; s++) meters.push([(440 + m * 24) / 512, (112 - s * 6.4) / 256, s]);
  const meterIM = new THREE.InstancedMesh(new THREE.BoxGeometry(0.012, 0.004, 0.006), new THREE.MeshBasicMaterial({ color: 0xffffff }), meters.length);
  meters.forEach((m, i) => { meterIM.setMatrixAt(i, mtx.compose(faceAt(m[0], m[1], 0.003), tilt, one)); meterIM.setColorAt(i, col.setHex(0x1a1a1a)); });
  const meterCol = (s) => (s >= 10 ? 0xff3a2a : s >= 7 ? 0xffc23a : 0x56e070);
  // the pad controller (the beat machine): body, face, 16 pads; tap it to play
  const PC = { x: -6.38, z: 17.42, w: 0.3, d: 0.3, y: DK.y };
  S.add(boxG(PC.w, 0.035, PC.d, PC.x, PC.y + 0.0175, PC.z), SM.cab);
  S.add(quadG(PC.w - 0.008, PC.d - 0.008).rotateX(-Math.PI / 2).rotateY(Math.PI).translate(PC.x, PC.y + 0.0355, PC.z), SM.ctrlFace);
  const padGeo = (k.RoundedBoxGeometry ? new k.RoundedBoxGeometry(0.052, 0.012, 0.052, 2, 0.006) : new THREE.BoxGeometry(0.052, 0.012, 0.052));
  const pads = new THREE.InstancedMesh(padGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), 16);
  const PAD_IDLE = new THREE.Color(0x3a3230), padLit = new Float32Array(16), padHue = Array(16).fill(0xffffff);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
    const i = r * 4 + c;   // pad 1 at the near left (as you sit: near = -z, left = +x)
    pads.setMatrixAt(i, mtx.compose(v.set(PC.x + 0.09 - c * 0.06, PC.y + 0.04, PC.z - 0.125 + r * 0.06), q.identity(), one));
    pads.setColorAt(i, PAD_IDLE);
  }
  pads.name = "studio-pads";
  const padHit = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.22, 0.44), new THREE.MeshBasicMaterial());
  padHit.position.set(PC.x, PC.y + 0.06, PC.z); padHit.visible = false; scene.add(padHit);
  // a mug of coffee
  S.add(cylG(0.04, 0.036, 0.1, 18, -7.78, DK.y + 0.05, 17.36), SM.mug);
  S.add(new THREE.TorusGeometry(0.026, 0.007, 6, 12, Math.PI).rotateZ(-Math.PI / 2).translate(-7.74, DK.y + 0.055, 17.36), SM.mug);
  S.add(new THREE.CircleGeometry(0.036, 16).rotateX(-Math.PI / 2).translate(-7.78, DK.y + 0.088, 17.36), SM.coffee);
  solid(R.x0, DK.z0 - 0.05, -5.75, P.z0);

  /* ------------------------------------------ the monitors, on their stands - */
  const LISTEN = { x: -7.0, z: 16.72 };   // the chair: both speakers aim at the engineer's head
  const SPK = [{ x: -8.08, z: 17.55 }, { x: -5.88, z: 17.55 }];
  const coneGeo = (() => {
    const pts = [new THREE.Vector2(0.012, -0.03), new THREE.Vector2(0.03, -0.024), new THREE.Vector2(0.066, -0.004), new THREE.Vector2(0.074, 0.002), new THREE.Vector2(0.078, 0)];
    const g = new THREE.LatheGeometry(pts, 24).rotateX(Math.PI / 2);
    return mergeGeometries([g.toNonIndexed(), new THREE.SphereGeometry(0.022, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2).scale(1, 1, 0.5).translate(0, 0, -0.024).toNonIndexed()], false);
  })();
  const cones = new THREE.InstancedMesh(coneGeo, new THREE.MeshStandardMaterial({ color: 0x2c2c2e, roughness: 0.7, side: THREE.DoubleSide }), 2);
  const coneBase = [];
  SPK.forEach((s, i) => {
    const yaw = Math.atan2(LISTEN.x - s.x, LISTEN.z - s.z), F = tr(s.x, 0, s.z).multiply(ry(yaw));
    S.add(at(boxG(0.24, 0.02, 0.28, 0, 0.01, 0), F), SM.steel);
    S.add(at(boxG(0.05, 0.98, 0.06, 0, 0.5, 0), F), SM.steel);
    S.add(at(boxG(0.2, 0.015, 0.22, 0, 1.0, 0), F), SM.steel);
    S.add(at(new THREE.BoxGeometry(0.2, 0.32, 0.24).translate(0, 1.17, 0), F), SM.cab);
    S.add(at(new THREE.TorusGeometry(0.08, 0.008, 6, 24).translate(0, 1.12, 0.121), F), SM.chrome);
    S.add(at(new THREE.SphereGeometry(0.018, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2).translate(0, 1.27, 0.12), F), SM.chrome);
    S.add(at(new THREE.CircleGeometry(0.03, 16).translate(0, 1.27, 0.1205), F), SM.steel);
    S.add(at(boxG(0.06, 0.012, 0.004, 0, 1.03, 0.121), F), SM.rubber);   // the port
    const base = new THREE.Matrix4().copy(F).multiply(tr(0, 1.12, 0.12));
    coneBase.push(base); cones.setMatrixAt(i, base);
  });
  cones.name = "studio-cones";

  /* ------------------------------------------------------------ the chair - */
  {
    const C = LISTEN, F = tr(C.x, 0, C.z);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      S.add(at(boxG(0.05, 0.03, 0.3, 0, 0.07, 0.15).applyMatrix4(ry(a)), F), SM.chrome);
      S.add(at(new THREE.SphereGeometry(0.025, 8, 6).translate(Math.sin(a) * 0.29, 0.026, Math.cos(a) * 0.29), F), SM.rubber);
    }
    S.add(at(cylG(0.026, 0.026, 0.34, 12, 0, 0.25, 0), F), SM.chrome);
    S.add(at(rb(0.5, 0.09, 0.48, 0.035).translate(0, 0.46, 0.02), F), SM.fabric);
    S.add(at(rb(0.46, 0.56, 0.07, 0.03).rotateX(-0.12).translate(0, 0.83, -0.24), F), SM.fabric);
    S.add(at(boxG(0.04, 0.3, 0.03, 0, 0.62, -0.25), F), SM.steel);
    for (const x of [-0.26, 0.26]) { S.add(at(boxG(0.05, 0.03, 0.26, x, 0.66, 0.02), F), SM.rubber); S.add(at(boxG(0.025, 0.18, 0.025, x, 0.56, -0.04), F), SM.steel); }
    solid(C.x - 0.28, C.z - 0.28, C.x + 0.28, C.z + 0.28);
  }

  /* -------------------------------------------------- the couch, the rug - */
  {
    const CO = { x0: -7.6, x1: -5.6, z0: R.z0, z1: R.z0 + 0.9 }, cx = (CO.x0 + CO.x1) / 2, cw = CO.x1 - CO.x0;
    S.add(rb(cw, 0.3, 0.86, 0.03).translate(cx, 0.23, CO.z0 + 0.45), SM.leather);
    S.add(rb(cw, 0.66, 0.22, 0.05).translate(cx, 0.55, CO.z0 + 0.12), SM.leather);
    for (const x of [CO.x0 + 0.09, CO.x1 - 0.09]) S.add(rb(0.18, 0.6, 0.86, 0.07).translate(x, 0.38, CO.z0 + 0.45), SM.leather);
    for (let i = 0; i < 2; i++) {
      const x = CO.x0 + 0.18 + (i + 0.5) * ((cw - 0.36) / 2);
      S.add(rb((cw - 0.36) / 2 - 0.02, 0.15, 0.62, 0.05).translate(x, 0.44, CO.z0 + 0.54), SM.leather);
      S.add(rb((cw - 0.36) / 2 - 0.03, 0.44, 0.18, 0.07).rotateX(-0.16).translate(x, 0.72, CO.z0 + 0.32), SM.leather);
    }
    for (const x of [CO.x0 + 0.04, CO.x1 - 0.04]) for (const z of [CO.z0 + 0.06, CO.z1 - 0.06]) S.add(cylG(0.02, 0.015, 0.08, 8, x, 0.04, z), SM.walnut);
    S.add(rb(0.38, 0.36, 0.13, 0.06).rotateZ(0.12).rotateX(-0.2).translate(CO.x1 - 0.36, 0.69, CO.z0 + 0.42), SM.pillow);
    S.add(rb(0.34, 0.32, 0.12, 0.055).rotateZ(-0.1).rotateX(-0.2).translate(CO.x0 + 0.38, 0.68, CO.z0 + 0.41), SM.fabric);
    S.add(quadG(cw + 0.3, 1.0).rotateX(-Math.PI / 2).translate(cx, 0.003, CO.z0 + 0.5), SM.shadow);
    solid(CO.x0, CO.z0, CO.x1, CO.z1);
    // the neon over the diffusers
    S.add(quadG(1.5, 0.49).translate(cx, 2.24, R.z0 + 0.025), SM.neon);
    S.add(quadG(2.2, 1.4).translate(cx, 2.1, R.z0 + 0.006), SM.pool);
  }
  S.add(quadG(2.3, 2.1).rotateX(-Math.PI / 2).translate(RCX, 0.005, 15.25), SM.rug);

  /* -------------------------------------------------- the guitar on its stand - */
  {
    const GP = { x: -7.86, z: 14.3 }, G = tr(GP.x, 0.08, GP.z).multiply(ry(Math.PI / 2)).multiply(new THREE.Matrix4().makeRotationX(-0.2));
    const body = new THREE.Shape();
    body.moveTo(0, 0);
    body.bezierCurveTo(0.12, 0, 0.205, 0.05, 0.2, 0.16); body.bezierCurveTo(0.196, 0.24, 0.12, 0.26, 0.122, 0.31);
    body.bezierCurveTo(0.124, 0.36, 0.155, 0.4, 0.14, 0.45); body.bezierCurveTo(0.125, 0.5, 0.05, 0.505, 0, 0.505);
    body.bezierCurveTo(-0.05, 0.505, -0.125, 0.5, -0.14, 0.45); body.bezierCurveTo(-0.155, 0.4, -0.124, 0.36, -0.122, 0.31);
    body.bezierCurveTo(-0.12, 0.26, -0.196, 0.24, -0.2, 0.16); body.bezierCurveTo(-0.205, 0.05, -0.12, 0, 0, 0);
    S.add(at(new THREE.ExtrudeGeometry(body, { depth: 0.1, bevelEnabled: false, curveSegments: 10 }), G), SM.rosewood);
    const topG = new THREE.ShapeGeometry(body, 10), tuv = topG.attributes.uv, tp = topG.attributes.position;
    for (let i = 0; i < tuv.count; i++) tuv.setXY(i, (tp.getX(i) + 0.21) / 0.42, tp.getY(i) / 0.51);
    S.add(at(topG.translate(0, 0, 0.1008), G), SM.top);
    S.add(at(boxG(0.046, 0.46, 0.022, 0, 0.71, 0.089), G), SM.maple);                        // neck
    S.add(at(boxG(0.052, 0.45, 0.006, 0, 0.715, 0.103), G), SM.ebony);                       // fretboard
    for (let f = 1; f < 14; f++) S.add(at(boxG(0.052, 0.002, 0.002, 0, 0.94 - 0.45 * (1 - Math.pow(2, -f / 12)) * 1.6, 0.107), G), SM.chrome);   // frets
    S.add(at(boxG(0.078, 0.17, 0.018, 0, 1.02, 0.08).rotateX(-0.0), G), SM.ebony);           // headstock
    for (let t = 0; t < 6; t++) { const side = t < 3 ? -1 : 1; S.add(at(cylG(0.006, 0.006, 0.035, 8, side * 0.055, 0.97 + (t % 3) * 0.045, 0.08, 0, Math.PI / 2), G), SM.chrome); }
    const L = 0.82, a = Math.atan2(0.019, L);
    for (let s = 0; s < 6; s++) S.add(at(boxG(0.0011, L, 0.0011, -0.025 + s * 0.01, 0, 0).rotateX(a).translate(0, 0.53, 0.1185), G), SM.chrome);
    // the stand: two legs back, a padded cradle, a post to a neck yoke
    const ST = tr(GP.x, 0, GP.z).multiply(ry(Math.PI / 2));
    for (const s of [-1, 1]) {
      S.add(at(cylG(0.009, 0.009, 0.42, 8, s * 0.12, 0.17, -0.12, 0.6), ST), SM.steel);
      S.add(at(boxG(0.03, 0.03, 0.12, s * 0.11, 0.085, 0.06), ST), SM.rubber);
    }
    S.add(at(cylG(0.01, 0.01, 0.95, 8, 0, 0.5, -0.09), ST), SM.steel);
    S.add(at(new THREE.TorusGeometry(0.03, 0.008, 6, 12, Math.PI).rotateX(-Math.PI / 2).translate(0, 0.96, -0.08), ST), SM.rubber);
    S.add(at(quadG(0.5, 0.5).rotateX(-Math.PI / 2).translate(0, 0.003, 0), ST), SM.shadow);
    solid(R.x0, GP.z - 0.25, GP.x + 0.15, GP.z + 0.25);
  }

  /* --------------------------------------- the credenza, the turntable, records - */
  const CR = { x0: -5.02, x1: R.x1, z0: 13.2, z1: 15.4, h: 0.62 }, CRX = (CR.x0 + CR.x1) / 2, CRZ = (CR.z0 + CR.z1) / 2;
  S.add(boxG(CR.x1 - CR.x0, CR.h - 0.1, CR.z1 - CR.z0, CRX, 0.1 + (CR.h - 0.1) / 2, CRZ), SM.walnut);
  for (const z of [CR.z0 + 0.55, CRZ, CR.z1 - 0.55]) S.add(boxG(0.004, CR.h - 0.16, 0.003, CR.x0 - 0.001, 0.1 + (CR.h - 0.1) / 2, z), SM.trim);
  for (const z of [CR.z0 + 0.275, CR.z0 + 0.825, CR.z1 - 0.825, CR.z1 - 0.275]) S.add(boxG(0.012, 0.012, 0.1, CR.x0 - 0.006, 0.45, z), SM.chrome);   // pulls
  for (const z of [CR.z0 + 0.05, CR.z1 - 0.05]) for (const x of [CR.x0 + 0.05, CR.x1 - 0.05]) S.add(cylG(0.015, 0.012, 0.1, 8, x, 0.05, z), SM.steel);
  const TT = { x: CRX, z: 14.82, y: CR.h };
  S.add(boxG(0.34, 0.08, 0.44, TT.x, TT.y + 0.04, TT.z), SM.walnut);
  S.add(cylG(0.152, 0.152, 0.02, 32, TT.x, TT.y + 0.09, TT.z), SM.steel);
  const record = new THREE.Mesh(new THREE.CircleGeometry(0.148, 40).rotateX(-Math.PI / 2), SM.record);
  record.position.set(TT.x, TT.y + 0.101, TT.z); scene.add(record);
  S.add(cylG(0.004, 0.004, 0.02, 8, TT.x, TT.y + 0.11, TT.z), SM.chrome);
  S.add(cylG(0.018, 0.02, 0.03, 12, TT.x + 0.12, TT.y + 0.095, TT.z + 0.16), SM.chrome);              // tonearm pivot
  S.add(cylG(0.004, 0.004, 0.22, 8, TT.x + 0.08, TT.y + 0.115, TT.z + 0.06, Math.PI / 2 - 0.35), SM.chrome);
  S.add(boxG(0.022, 0.01, 0.04, TT.x + 0.045, TT.y + 0.112, TT.z - 0.045), SM.steel);
  // a crate of records
  const CT = { z0: 13.32, z1: 13.92, x0: CR.x0 + 0.03, x1: CR.x1 - 0.03 };
  for (const z of [CT.z0, CT.z1]) S.add(boxG(CT.x1 - CT.x0, 0.24, 0.015, (CT.x0 + CT.x1) / 2, CR.h + 0.12, z), SM.trim);
  for (const x of [CT.x0, CT.x1]) S.add(boxG(0.015, 0.2, CT.z1 - CT.z0, x, CR.h + 0.1, (CT.z0 + CT.z1) / 2), SM.trim);
  const sleeveCols = [0xe0782f, 0x2a3a5e, 0xd9c9a8, 0x7a2a28, 0x1f1f1f, 0x5a8a7a, 0xc8a83a, 0x8a5a9a, 0xe8e2d6, 0x3a5a2a, 0xb84a3a, 0x2a2a3a, 0xd88a6a, 0x4a6a8a];
  const sleeves = new THREE.InstancedMesh(new THREE.BoxGeometry(0.31, 0.31, 0.004), new THREE.MeshStandardMaterial({ map: fleck, roughness: 0.75 }), sleeveCols.length);
  sleeveCols.forEach((c, i) => {
    q.setFromEuler(e.set(-0.25 + i * 0.012, Math.PI / 2 * 0 + 0, 0));
    sleeves.setMatrixAt(i, mtx.compose(v.set((CT.x0 + CT.x1) / 2, CR.h + 0.16, CT.z0 + 0.04 + i * 0.037), q, one));
    sleeves.setColorAt(i, col.setHex(c));
  });
  solid(CR.x0 - 0.02, CR.z0 - 0.02, R.x1, CR.z1 + 0.02);

  /* ------------------------------------------------ the floor lamp, the cove - */
  const LP = { x: -5.06, z: 12.62 };
  S.add(cylG(0.14, 0.15, 0.025, 24, LP.x, 0.0125, LP.z), SM.steel);
  S.add(cylG(0.012, 0.012, 1.42, 10, LP.x, 0.72, LP.z), SM.steel);
  S.add(cylG(0.17, 0.2, 0.28, 24, LP.x, 1.56, LP.z), SM.shade);
  S.add(quadG(2.4, 2.4).rotateX(-Math.PI / 2).translate(LP.x, 0.004, LP.z), SM.pool);
  S.add(quadG(2.0, 1.8).rotateY(-Math.PI / 2).translate(R.x1 - 0.004, 1.5, LP.z + 0.4), SM.pool);
  S.add(quadG(2.0, 1.8).translate(LP.x - 0.4, 1.5, R.z0 + 0.004), SM.pool);
  solid(LP.x - 0.16, LP.z - 0.16, LP.x + 0.16, LP.z + 0.16);
  // the cove: a warm LED line round the control room just under the ceiling, and its wash down the walls
  const CY = R.h - 0.05;
  S.add(boxG(RW, 0.012, 0.012, RCX, CY, R.z0 + 0.03), SM.cove);
  S.add(boxG(0.012, 0.012, P.z0 - R.z0, R.x0 + 0.03, CY, (R.z0 + P.z0) / 2), SM.cove);
  S.add(boxG(0.012, 0.012, P.z0 - R.z0, R.x1 - 0.03, CY, (R.z0 + P.z0) / 2), SM.cove);
  S.add(quadG(RW, 0.9).translate(RCX, CY - 0.45, R.z0 + 0.005), SM.wash);
  S.add(quadG(P.z0 - R.z0, 0.9).rotateY(Math.PI / 2).translate(R.x0 + 0.005, CY - 0.45, (R.z0 + P.z0) / 2), SM.wash);
  S.add(quadG(P.z0 - R.z0, 0.9).rotateY(-Math.PI / 2).translate(R.x1 - 0.005, CY - 0.45, (R.z0 + P.z0) / 2), SM.wash);
  S.add(quadG(RW, 6.0).rotateX(-Math.PI / 2).translate(RCX, 0.0045, 15.0), SM.pool);

  /* ---------------------------------------------------------- the booth - */
  {
    const MK = { x: -6.62, z: 19.75 };
    // the mic stand: three feet, a pole, a shock-mounted condenser facing the singer (north), a pop filter, headphones
    for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 + 0.3; S.add(boxG(0.025, 0.02, 0.3, 0, 0.03, 0.14).applyMatrix4(ry(a)).translate(MK.x, 0, MK.z), SM.steel); }
    S.add(cylG(0.012, 0.012, 1.42, 10, MK.x, 0.73, MK.z), SM.steel);
    S.add(new THREE.TorusGeometry(0.05, 0.004, 6, 20).translate(MK.x, 1.5, MK.z + 0.02), SM.steel);
    S.add(new THREE.TorusGeometry(0.05, 0.004, 6, 20).translate(MK.x, 1.56, MK.z + 0.02), SM.steel);
    S.add(cylG(0.03, 0.026, 0.15, 18, MK.x, 1.52, MK.z + 0.02), SM.micBody);
    S.add(cylG(0.032, 0.032, 0.07, 18, MK.x, 1.625, MK.z + 0.02), SM.chrome);
    S.add(new THREE.SphereGeometry(0.032, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(MK.x, 1.66, MK.z + 0.02), SM.chrome);
    const neck = new THREE.CatmullRomCurve3([new THREE.Vector3(MK.x, 1.42, MK.z), new THREE.Vector3(MK.x + 0.08, 1.48, MK.z + 0.06), new THREE.Vector3(MK.x + 0.05, 1.58, MK.z + 0.14), new THREE.Vector3(MK.x, 1.6, MK.z + 0.17)]);
    S.add(new THREE.TubeGeometry(neck, 16, 0.004, 6), SM.steel);
    S.add(new THREE.TorusGeometry(0.075, 0.006, 6, 28).translate(MK.x, 1.6, MK.z + 0.17), SM.steel);
    S.add(new THREE.CircleGeometry(0.074, 28).translate(MK.x, 1.6, MK.z + 0.17), SM.popMesh);
    S.add(new THREE.TorusGeometry(0.09, 0.012, 6, 20, Math.PI).translate(MK.x, 1.18, MK.z - 0.03).rotateX(0), SM.rubber);   // headphones hung on the pole
    for (const s of [-1, 1]) S.add(cylG(0.04, 0.04, 0.03, 16, MK.x + s * 0.09, 1.16, MK.z - 0.03, 0, Math.PI / 2), SM.rubber);
    S.add(quadG(0.7, 0.7).rotateX(-Math.PI / 2).translate(MK.x, 0.004, MK.z), SM.shadow);
    solid(MK.x - 0.16, MK.z - 0.16, MK.x + 0.16, MK.z + 0.16);
    // the lyric stand
    const LY = { x: -7.55, z: 20.3 };
    const LD = tr(LY.x, 1.2, LY.z).multiply(ry(Math.PI / 2)).multiply(new THREE.Matrix4().makeRotationX(-0.5));   // the desk plate, facing the singer
    for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; S.add(boxG(0.02, 0.015, 0.25, 0, 0.02, 0.12).applyMatrix4(ry(a)).translate(LY.x, 0, LY.z), SM.steel); }
    S.add(cylG(0.008, 0.008, 1.12, 8, LY.x, 0.57, LY.z), SM.steel);
    S.add(at(boxG(0.44, 0.32, 0.01), LD), SM.steel);
    S.add(at(boxG(0.44, 0.02, 0.05, 0, -0.16, 0.025), LD), SM.steel);
    S.add(at(quadG(0.21, 0.28).translate(-0.1, 0.01, 0.0065), LD), SM.paper);
    S.add(at(quadG(0.21, 0.28).translate(0.11, 0.01, 0.0065), LD), SM.paper);
    solid(LY.x - 0.2, LY.z - 0.2, LY.x + 0.2, LY.z + 0.2);
    // the pendant over the singer
    const PD = { x: -6.62, z: 20.25 };
    S.add(cylG(0.003, 0.003, 0.7, 4, PD.x, R.h - 0.35, PD.z), SM.rubber);
    S.add(cylG(0.04, 0.15, 0.17, 24, PD.x, R.h - 0.78, PD.z, 0), SM.steel);
    S.add(new THREE.SphereGeometry(0.035, 12, 8).translate(PD.x, R.h - 0.885, PD.z), SM.glow);
    S.add(quadG(2.2, 2.2).rotateX(-Math.PI / 2).translate(PD.x, 0.006, PD.z - 0.2), SM.pool);
    S.add(quadG(2.6, 1.6).rotateY(Math.PI).translate(RCX, 1.2, R.z1 - 0.004), SM.pool);
  }
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffcf98, transparent: true, opacity: 0.7, blending: add, depthWrite: false }));
  halo.scale.set(0.5, 0.5, 1); halo.position.set(-6.62, R.h - 0.88, 20.25); halo.renderOrder = 3; scene.add(halo);

  const meshes = S.flush(scene);
  for (const m of [foamIM, blockIM, faderIM, knobIM, meterIM, pads, cones, sleeves]) {
    m.castShadow = m.receiveShadow = false;
    m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere(); scene.add(m);
  }
  meterIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage); cones.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  /* ============================================================ THE BEAT ==== */
  /* Every sound is made here, in code: no samples, no files, nothing downloaded.
     88 BPM, two bars of 16ths, the off 8ths swung. Kick, snap, hats, bass (F minor), a little vinyl crackle. */
  const BPM = 88, STEP = 60 / BPM / 4, STEPS = 32, SWING = 0.2;
  const KICK = new Set([0, 7, 10, 16, 23, 26, 30]);
  const SNAP = new Set([4, 12, 20, 28]), GHOST = new Set([15]);
  const OPEN_HAT = new Set([14, 30]), HAT16 = new Set([11, 27, 31]);
  const BASS = { 0: [41, 5], 6: [41, 1], 7: [44, 2], 10: [48, 3], 13: [46, 2], 16: [37, 5], 22: [37, 1], 23: [39, 3], 26: [44, 2], 28: [39, 2], 31: [40, 1] };
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const A = { ctx: null, master: null, noise: null, crackle: null, crackleSrc: null, timer: 0, next: 0, step: 0, playing: false, queue: [], kick: 0, level: 0, wantStart: false, stopTO: 0 };
  function ensureCtx() {
    if (A.ctx) return A.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.2;
    const master = ctx.createGain(); master.gain.value = 0;
    comp.connect(master).connect(ctx.destination);
    const len = ctx.sampleRate;
    const nb = ctx.createBuffer(1, len, ctx.sampleRate), nd = nb.getChannelData(0), nr = rnd(1321);
    for (let i = 0; i < len; i++) nd[i] = nr() * 2 - 1;
    const cb = ctx.createBuffer(1, len * 3, ctx.sampleRate), cd = cb.getChannelData(0), cr = rnd(1323);
    for (let i = 0; i < cd.length; i++) {   // vinyl: a faint hiss and sparse little pops
      cd[i] = (cr() * 2 - 1) * 0.012;
      if (cr() < 0.00035) { const amp = 0.25 + cr() * 0.5; for (let j = 0; j < 40 && i + j < cd.length; j++) cd[i + j] += (cr() * 2 - 1) * amp * Math.exp(-j / 6); }
    }
    A.ctx = ctx; A.bus = comp; A.master = master; A.noise = nb; A.crackle = cb;
    return ctx;
  }
  function unlockSilently(ctx) {   // iPhone: a one-sample silent buffer started inside the tap opens the audio path
    try { const b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0); } catch (_) {}
  }
  function noiseSrc(t, dur) { const s = A.ctx.createBufferSource(); s.buffer = A.noise; s.start(t, Math.random() * 0.5, dur + 0.05); return s; }
  function env(g, t, peak, attack, decay) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay); }
  function kick(t, vel) {
    const c = A.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(47, t + 0.13);
    env(g, t, 0.95 * vel, 0.003, 0.42); o.connect(g).connect(A.bus); o.start(t); o.stop(t + 0.5);
    const o2 = c.createOscillator(), g2 = c.createGain();   // the knock that a phone speaker can actually play
    o2.type = "triangle"; o2.frequency.setValueAtTime(220, t); o2.frequency.exponentialRampToValueAtTime(95, t + 0.06);
    env(g2, t, 0.35 * vel, 0.002, 0.08); o2.connect(g2).connect(A.bus); o2.start(t); o2.stop(t + 0.12);
  }
  function snap(t, vel) {
    const c = A.ctx, bp = c.createBiquadFilter(), hp = c.createBiquadFilter(), g = c.createGain();
    bp.type = "bandpass"; bp.frequency.value = 1900; bp.Q.value = 1.1; hp.type = "highpass"; hp.frequency.value = 700;
    g.gain.setValueAtTime(0.0001, t);
    for (const [dt, a] of [[0, 0.7], [0.009, 0.55], [0.019, 0.8]]) { g.gain.setValueAtTime(a * vel, t + dt); g.gain.exponentialRampToValueAtTime(0.05 * vel, t + dt + 0.008); }
    g.gain.setValueAtTime(0.75 * vel, t + 0.028); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    const n = noiseSrc(t, 0.25); n.connect(bp).connect(hp).connect(g).connect(A.bus);
    const o = c.createOscillator(), og = c.createGain(); o.type = "sine"; o.frequency.setValueAtTime(1650, t);
    env(og, t, 0.12 * vel, 0.001, 0.03); o.connect(og).connect(A.bus); o.start(t); o.stop(t + 0.05);
  }
  function hat(t, vel, open) {
    const c = A.ctx, hp = c.createBiquadFilter(), bp = c.createBiquadFilter(), g = c.createGain();
    hp.type = "highpass"; hp.frequency.value = 7000; bp.type = "bandpass"; bp.frequency.value = 10000; bp.Q.value = 0.8;
    env(g, t, 0.32 * vel, 0.001, open ? 0.26 : 0.045);
    const n = noiseSrc(t, open ? 0.3 : 0.08); n.connect(hp).connect(bp).connect(g).connect(A.bus);
  }
  function bass(t, note, steps) {
    const c = A.ctx, dur = Math.max(0.08, steps * STEP - 0.03), f = hz(note);
    const o = c.createOscillator(), sub = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain();
    o.type = "sawtooth"; o.frequency.setValueAtTime(f, t); sub.type = "sine"; sub.frequency.setValueAtTime(f, t);
    lp.type = "lowpass"; lp.Q.value = 4; lp.frequency.setValueAtTime(1300, t); lp.frequency.exponentialRampToValueAtTime(380, t + 0.18);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.42, t + 0.008); g.gain.setValueAtTime(0.42, t + dur - 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
    const sg = c.createGain(); sg.gain.value = 0.7;
    o.connect(lp); sub.connect(sg).connect(lp); lp.connect(g).connect(A.bus);
    o.start(t); sub.start(t); o.stop(t + dur + 0.1); sub.stop(t + dur + 0.1);
  }
  function scheduleStep(s, t) {
    const sw = s % 4 === 2 ? SWING * STEP : 0, at = t + sw;
    if (KICK.has(s)) { kick(at, s % 16 === 0 ? 1 : 0.85); A.queue.push({ t: at, kind: 0 }); }
    if (SNAP.has(s)) { snap(at, 1); A.queue.push({ t: at, kind: 1 }); }
    if (GHOST.has(s)) snap(at, 0.3);
    if (s % 2 === 0 || HAT16.has(s)) { hat(at, s % 4 === 0 ? 1 : 0.6, OPEN_HAT.has(s)); A.queue.push({ t: at, kind: 2 }); }
    const b = BASS[s];
    if (b) { bass(at, b[0], b[1]); A.queue.push({ t: at, kind: 3, note: b[0] }); }
    A.queue.push({ t, kind: -1, step: s });
  }
  function pump() {
    const c = A.ctx; if (!c || !A.playing) return;
    while (A.next < c.currentTime + 0.14) { scheduleStep(A.step, A.next); A.next += STEP; A.step = (A.step + 1) % STEPS; }
  }
  function start() {   // runs inside the tap handler (iPhone needs the AudioContext born and resumed there)
    const c = ensureCtx(); if (!c) { log("this browser has no WebAudio"); return false; }
    try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (_) {}   // play even with the ring switch on silent
    clearTimeout(A.stopTO);
    if (c.state !== "running") c.resume().catch(() => {});
    unlockSilently(c);
    A.playing = true; A.step = 0; A.queue.length = 0;
    A.next = c.currentTime + 0.08;
    A.master.gain.cancelScheduledValues(c.currentTime); A.master.gain.setValueAtTime(0.0001, c.currentTime); A.master.gain.exponentialRampToValueAtTime(0.75, c.currentTime + 0.05);
    try { const cs = c.createBufferSource(), cg = c.createGain(), lp = c.createBiquadFilter(); cs.buffer = A.crackle; cs.loop = true; lp.type = "lowpass"; lp.frequency.value = 6000; cg.gain.value = 0.5; cs.connect(lp).connect(cg).connect(A.master); cs.start(); A.crackleSrc = cs; } catch (_) {}
    clearInterval(A.timer); A.timer = setInterval(pump, 25); pump();
    SM.onAir.color.setHex(0xffffff); playhead.visible = true;
    log("the beat is on (First Light, 88 BPM): tap the pads again to stop");
    return true;
  }
  function stop(why) {
    if (!A.playing) return;
    A.playing = false; clearInterval(A.timer); A.timer = 0; A.queue.length = 0;
    const c = A.ctx;
    if (c) {
      const now = c.currentTime;
      A.master.gain.cancelScheduledValues(now); A.master.gain.setValueAtTime(Math.max(0.0001, A.master.gain.value), now); A.master.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
      if (A.crackleSrc) { try { A.crackleSrc.stop(now + 0.1); } catch (_) {} A.crackleSrc = null; }
      clearTimeout(A.stopTO); A.stopTO = setTimeout(() => { if (!A.playing && A.ctx && A.ctx.state === "running") A.ctx.suspend().catch(() => {}); }, 400);
    }
    SM.onAir.color.setHex(0x5a4444); playhead.visible = false;
    padLit.fill(0); A.kick = 0; A.level = 0;
    log(why ? `the beat stopped (${why})` : "the beat stopped");
  }
  function toggle() { if (A.playing) stop(); else start(); }

  /* ------------------------------------------- input: taps on the pads or the screen - */
  const alive = () => !!scene.parent;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const canvas = document.getElementById("gl");
  let down = null;
  const inStudio = (x, z) => x > R.x0 - 0.05 && x < R.x1 + 0.3 && z > R.z0 - 0.05 && z < R.z1 + 0.05;
  const here = () => { const w = world(); return !!w && (w.zone === "i" || (w.player && inStudio(w.player.x, w.player.z))); };
  const onDown = (ev) => { down = { x: ev.clientX, y: ev.clientY, t: performance.now(), moved: 0 }; };
  const onMove = (ev) => { if (down) down.moved = Math.max(down.moved, Math.hypot(ev.clientX - down.x, ev.clientY - down.y)); };
  const onUp = (ev) => {
    if (!alive()) return cleanup();
    const d = down; down = null;
    if (!d || d.moved > 10 || performance.now() - d.t > 450 || !here()) return;
    const w = world(); if (!w || !w.camera) return;
    ndc.set((ev.clientX / innerWidth) * 2 - 1, -(ev.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, w.camera);
    if (ray.intersectObjects([padHit, screenHit], false).some((h) => h.distance < 8)) toggle();
  };
  // iPhone fallback: if the context is still not running after the pointerup, the touchend (also a user gesture) resumes it
  const onTouchEnd = () => { if (!alive()) return; if (A.playing && A.ctx && A.ctx.state !== "running") { A.ctx.resume().catch(() => {}); unlockSilently(A.ctx); } };
  const onHide = () => { if (document.hidden) stop("the page is hidden"); };
  const onPageHide = () => stop("left the page");
  function cleanup() {
    if (canvas) canvas.removeEventListener("pointerdown", onDown);
    removeEventListener("pointermove", onMove); removeEventListener("pointerup", onUp); removeEventListener("touchend", onTouchEnd);
    document.removeEventListener("visibilitychange", onHide); removeEventListener("pagehide", onPageHide);
    stop();
    if (A.ctx) { try { A.ctx.close(); } catch (_) {} A.ctx = null; }
  }
  if (canvas) canvas.addEventListener("pointerdown", onDown);
  addEventListener("pointermove", onMove); addEventListener("pointerup", onUp); addEventListener("touchend", onTouchEnd, { passive: true });
  document.addEventListener("visibilitychange", onHide); addEventListener("pagehide", onPageHide);

  /* --------------------------------------- the room you cannot see (closet.js's way) - */
  /* room.js always draws the room itself (A and B); from in here it is behind walls. While the camera is in the
     studio and the way to A (g-2, d-back and a-d) is not all open, the room's static pieces and the doors you cannot
     see go to a camera layer that is not drawn. It uses the same userData key as closet.js ("closetMask"), on
     purpose: the camera is only ever in one of these rooms, and a shared key means the two can never undo each other. */
  const root = scene.parent, OFF = 30, cut = { list: null, key: "" };
  function shellList(key, dd) {
    const out = [], bb = new THREE.Box3();
    if (!root) return out;
    for (const c of root.children) {
      if (c === scene || /^zone-/.test(c.name || "")) continue;
      const dm = /^door-(.+)$/.exec(c.name || "");
      if (dm) {
        const btw = (dd[dm[1]] && dd[dm[1]].data && dd[dm[1]].data.between) || [];
        if (!btw.includes("g") && !btw.includes("i") && !(key === "den" && btw.includes("d"))) out.push(c);
        continue;
      }
      let skip = false, n = 0;
      c.traverse((o) => {
        if (o.isLight || o.isSkinnedMesh || o.isBone || o.isSprite || o.isPoints || (o.userData && (o.userData.asset || o.userData.placeholder)) || (o.geometry && o.geometry.type === "RingGeometry")) skip = true;
        if (o.isMesh) n++;
      });
      if (skip || !n) continue;
      bb.setFromObject(c);
      if (bb.isEmpty() || bb.min.x < -6.4 || bb.max.x > 6.4 || bb.min.z < -4.4 || bb.max.z > 4.4) continue;
      out.push(c);
    }
    return out;
  }
  const hideTree = (c, on) => c.traverse((o) => {
    if (on) { if (o.userData.closetMask == null) { o.userData.closetMask = o.layers.mask; o.layers.set(OFF); } }
    else if (o.userData.closetMask != null) { o.layers.mask = o.userData.closetMask; delete o.userData.closetMask; }
  });
  if (root) for (const c of root.children) if (c.userData && c.userData.studioCut) { hideTree(c, false); delete c.userData.studioCut; }   // a hot-swapped studio
  function cullRoom() {
    const w = world(), cam = w && w.camera;
    if (!root || !cam) return;
    const p = cam.position, dd = (w && w.doors) || {}, open = (id) => !!dd[id] && dd[id].amt > 0.001;
    const inS = scene.visible && p.x > R.x0 - 0.02 && p.x < R.x1 - 0.05 && p.z > R.z0 - 0.1 && p.z < R.z1 + 0.1;
    const key = !inS ? "" : !(open("g-2") && open("d-back")) ? "shut" : !open("a-d") ? "den" : "";
    if (key === cut.key) return;
    if (cut.list) for (const c of cut.list) { hideTree(c, false); delete c.userData.studioCut; }
    cut.list = key ? shellList(key, dd) : null; cut.key = key;
    if (cut.list) for (const c of cut.list) { hideTree(c, true); c.userData.studioCut = true; }
  }

  /* --------------------------------------------------------------- tick - */
  const PAD_COL = [0xff7a2f, 0xff4d6d, 0xffc65a, 0xa874ff];   // kick, snap, hats, bass
  const tmpC = new THREE.Color(), padRow = [0, 0, 0, 0];
  let breathe = 0, spin = 0;
  const scl = new THREE.Matrix4(), mv = new THREE.Matrix4();
  function lightPad(kind, note) {
    const r = kind, i = r * 4 + (kind === 3 ? ([41, 44, 46, 48, 37, 39, 40].indexOf(note) % 4 + 4) % 4 : (padRow[r]++ % 4));
    padLit[i] = 1; padHue[i] = PAD_COL[kind];
  }
  function tick(dt) {
    if (!alive()) return cleanup();
    cullRoom();
    if (A.playing && !here()) stop("you left the studio");
    const c = A.ctx, now = c ? c.currentTime : 0;
    if (A.playing && c) {
      while (A.queue.length && A.queue[0].t <= now) {
        const ev = A.queue.shift();
        if (ev.kind === -1) { playhead.position.x = SCR.x + (SCR.w / 2 - 0.035) - (ev.step / STEPS) * (SCR.w - 0.1); continue; }
        lightPad(ev.kind, ev.note);
        if (ev.kind === 0) A.kick = 1;
        A.level = Math.min(1, A.level + (ev.kind === 0 ? 0.75 : ev.kind === 1 ? 0.6 : ev.kind === 3 ? 0.35 : 0.15));
      }
    }
    if (!scene.visible) return;
    breathe += dt;
    // pads: lit ones fade; when the beat is off, pad 1 breathes softly (tap me)
    for (let i = 0; i < 16; i++) {
      padLit[i] = Math.max(0, padLit[i] - dt * 3.2);
      tmpC.copy(PAD_IDLE);
      if (padLit[i] > 0) tmpC.lerp(col.setHex(padHue[i]), Math.min(1, padLit[i] * 1.15));
      else if (!A.playing && (i === 0 || i === 5 || i === 10 || i === 15)) tmpC.lerp(col.setHex(0xff9a4a), 0.18 + 0.16 * Math.sin(breathe * 2.2 + i));
      pads.setColorAt(i, tmpC);
    }
    pads.instanceColor.needsUpdate = true;
    // meters and cones
    A.kick = Math.max(0, A.kick - dt * 7); A.level = Math.max(0, A.level - dt * 2.4);
    const lv = A.playing ? A.level : 0;
    for (let i = 0; i < meters.length; i++) { const s = meters[i][2], on = s < Math.round(lv * 12 * (i < 12 ? 1 : 0.92)); meterIM.setColorAt(i, on ? col.setHex(meterCol(s)) : col.setHex(0x1a1a1a)); }
    meterIM.instanceColor.needsUpdate = true;
    for (let i = 0; i < 2; i++) { mtx.copy(coneBase[i]).multiply(mv.makeTranslation(0, 0, A.kick * 0.006)).multiply(scl.makeScale(1, 1, 1 + A.kick * 0.9)); cones.setMatrixAt(i, mtx); }
    cones.instanceMatrix.needsUpdate = true;
    if (A.playing) { spin += dt * (33.33 / 60) * Math.PI * 2; record.rotation.y = -spin; }
    halo.material.opacity = 0.62 + 0.06 * Math.sin(breathe * 1.3);
  }

  /* camera keep-outs ([minX, minZ, maxX, maxZ, minY, maxY]): never through the partition (only its doorway and window
     are open, and the camera does not go through glass), never into the credenza or the desk */
  const camBlocks = [
    [R.x0, P.z0 - 0.02, P.gx0, P.z1 + 0.02, 0, R.h], [P.gx0, P.z0 - 0.02, R.x1, P.z1 + 0.02, P.gh - 0.02, R.h],
    [CR.x0, CR.z0, R.x1, CR.z1, 0, 0.9], [DK.x0 - 0.2, DK.z0, DK.x1 + 0.2, P.z0, 0, 1.45],
  ];

  return {
    R, DOOR, tick, camBlocks, meshes,
    get playing() { return A.playing; }, get audioState() { return A.ctx ? A.ctx.state : "none"; },
    get roomHidden() { return cut.list ? cut.list.length : 0; },
    get padsLit() { let n = 0; for (const x of padLit) if (x > 0.05) n++; return n; },
    toggle, start, stop, padHit, screenHit, onAir,
    counts: { foam: tiles.length, diffuserBlocks: blocks.length, faders: faders.length, knobs: knobs.length, pads: 16 },
  };
}
