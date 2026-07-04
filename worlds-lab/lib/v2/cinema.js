// WORLDS LAB · lib v2 · cinema.js — walk-in movie theaters that play REAL film.
// WHY v2 EXISTS (2026-07-04): lib/v1 is FROZEN by the freeze law, but v1's film catalog died
// server-side — the Google sample bucket (all four Blender reels) now returns 403 for everyone,
// and archive.org's download nodes stopped sending CORS headers (VideoTexture needs CORS).
// v2 = v1's exact code with a re-verified catalog: Blender films from Wikimedia Commons 720p
// transcodes (Access-Control-Allow-Origin: * confirmed), archive.org mp4s as fallbacks (they
// stream, and the honest error path skips them when CORS blocks a texture), NASA ~mobile
// (CORS confirmed) with ~medium fallback. Everything re-verified with curl + a live browser
// on 2026-07-04 — see worlds-lab/CREDITS.md for the paper trail.
// Every reel is legally streamable: Blender Foundation open movies (CC BY — credit shown
// in-world, as the license asks), true public-domain features from the Internet Archive, and
// NASA footage (public domain, courtesy NASA).
// HONESTY LAW: if a reel can't load, the screen says so plainly and moves on —
// and if nothing loads, the theater shows an honest empty screen, never a fake.
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.module.js";
import { marqueeTexture, posterTexture, textTexture, curtainTexture, carpetTexture, brickTexture } from "../v1/textures.js";
import { buildRoomShell } from "../v1/buildings.js";

const M = (color, extra) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.85, metalness: 0.05 }, extra));
const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);

// ---- the verified, legally-safe film catalog ----
export const FILMS = {
  blender: [
    { title: "Big Buck Bunny", year: 2008, license: "CC BY 3.0", credit: "(c) 2008 Blender Foundation | bigbuckbunny.org", hue: 95, src: "https://upload.wikimedia.org/wikipedia/commons/transcoded/c/c0/Big_Buck_Bunny_4K.webm/Big_Buck_Bunny_4K.webm.720p.vp9.webm", srcFallback: "https://archive.org/download/BigBuckBunny_328/BigBuckBunny_512kb.mp4" },
    { title: "Sintel", year: 2010, license: "CC BY 3.0", credit: "(c) 2010 Blender Foundation | sintel.org", hue: 18, src: "https://upload.wikimedia.org/wikipedia/commons/transcoded/f/f1/Sintel_movie_4K.webm/Sintel_movie_4K.webm.720p.vp9.webm", srcFallback: "https://archive.org/download/Sintel/sintel-2048-stereo_512kb.mp4" },
    { title: "Tears of Steel", year: 2012, license: "CC BY 3.0", credit: "(c) 2012 Blender Foundation | tearsofsteel.org", hue: 205, src: "https://upload.wikimedia.org/wikipedia/commons/transcoded/c/cb/Tears_of_Steel_1080p.webm/Tears_of_Steel_1080p.webm.720p.vp9.webm", srcFallback: "https://archive.org/download/Tears-of-Steel/tears_of_steel_720p.mp4" },
    { title: "Elephants Dream", year: 2006, license: "CC BY 2.5", credit: "(c) 2006 Blender Foundation / NMAI | orange.blender.org", hue: 268, src: "https://upload.wikimedia.org/wikipedia/commons/transcoded/2/28/Elephants_Dream_%282006%29_1080p24.webm/Elephants_Dream_%282006%29_1080p24.webm.720p.vp9.webm", srcFallback: "https://archive.org/download/ElephantsDream/ed_1024_512kb.mp4" },
  ],
  classics: [
    { title: "His Girl Friday", year: 1940, license: "Public Domain", credit: "Public domain - Internet Archive", hue: 38, src: "https://archive.org/download/his_girl_friday/his_girl_friday_512kb.mp4" },
    { title: "Plan 9 from Outer Space", year: 1959, license: "Public Domain", credit: "Public domain - Internet Archive", hue: 130, src: "https://archive.org/download/plan-9-from-outer-space-1959/Plan%209%20From%20Outer%20Space%20%281959%29.ia.mp4" },
  ],
  nasa: [
    { title: "Artemis - Success and Preparation", year: 2025, license: "Public Domain (NASA)", credit: "Video courtesy of NASA - images.nasa.gov", hue: 230, src: "https://images-assets.nasa.gov/video/KSC-20250128-MH-NAS02-0001-Artemis_Success_and_Preparation_Short_Versions-M11615/KSC-20250128-MH-NAS02-0001-Artemis_Success_and_Preparation_Short_Versions-M11615~mobile.mp4", srcFallback: "https://images-assets.nasa.gov/video/KSC-20250128-MH-NAS02-0001-Artemis_Success_and_Preparation_Short_Versions-M11615/KSC-20250128-MH-NAS02-0001-Artemis_Success_and_Preparation_Short_Versions-M11615~medium.mp4" },
  ],
};

let cinemaCount = 0;

export function cinema(kit, o) {
  const films = o.films || FILMS.blender;
  const name = o.name || "THEATER";
  const id = "cinema-" + (cinemaCount++);
  const x = o.x, z = o.z;
  const w = o.w || 12, d = o.d || 9, wallH = 6.2;
  const gy = kit.groundHeight(x, z);

  // ---------- exterior ----------
  const g = new THREE.Group();
  const walls = box(w, wallH, d, new THREE.MeshStandardMaterial({ map: brickTexture({ brick: o.brick || "#6b4a52", mortar: "#3a3338", repeat: [3, 2] }) }));
  walls.position.y = wallH / 2; g.add(walls);
  const marqMat = new THREE.MeshStandardMaterial({ map: marqueeTexture(name, { accent: o.accent || "#ffd166" }), emissive: 0xffffff, emissiveMap: marqueeTexture(name, { accent: o.accent || "#ffd166" }), emissiveIntensity: 0.25 });
  kit.bindEmissive(marqMat, 0.85, 0.2);
  const marq = box(w * 0.7, 1.6, 0.5, marqMat);
  marq.position.set(0, wallH - 1.2, d / 2 + 0.3); g.add(marq);
  const entry = box(3.2, 3.0, 0.4, M(0x14181d)); entry.position.set(0, 1.5, d / 2 - 0.05); g.add(entry);
  // typographic posters (drawn in code — titles only, no copied art)
  films.slice(0, 3).forEach((f, i) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.1), new THREE.MeshStandardMaterial({ map: posterTexture(f.title, f.year + " · " + f.license, { hue: f.hue || 200, seed: 9 + i }) }));
    p.position.set(-w / 2 + 2.2 + i * 1.9, 2.4, d / 2 + 0.02);
    g.add(p);
  });
  g.position.set(x, gy, z);
  if (o.rot) g.rotation.y = o.rot;
  kit.scene.add(g);
  kit.addCollider({ x, z, w, d });

  // ---------- the projection system (one <video> per theater) ----------
  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.preload = "none";
  video.volume = 0.85;
  let idx = 0, started = false, videoTex = null, failures = 0, triedFallback = false;
  let screenMat = null, statusBoard = null, nowBoard = null, plaqueBoard = null;
  let houseLights = [], padMats = [];
  // House lights: bright while idle (so people can FIND the stations - Jaron & Lillith
  // couldn't), dim when the show starts, restored on leave. Real-theater behavior.
  function setHouse(bright) {
    houseLights.forEach((l) => { l.intensity = bright ? l.userData.up : l.userData.down; });
    padMats.forEach((m) => { m.emissiveIntensity = bright ? 1.0 : 0.22; });
  }

  function setStatus(text) {
    if (!statusBoard) return;
    statusBoard.material.map = textTexture([text], { w: 1024, h: 110, border: false, bg: "#0a0d12", fg: "#9fb0bd" });
    statusBoard.material.needsUpdate = true;
  }
  function setNowShowing() {
    const f = films[idx];
    if (nowBoard) {
      nowBoard.material.map = textTexture(["NOW SHOWING", f.title + " (" + f.year + ")"], { w: 1024, h: 240, accent: o.accent || "#ffd166" });
      nowBoard.material.needsUpdate = true;
    }
    if (plaqueBoard) {
      plaqueBoard.material.map = textTexture(["About this screening", f.title + " (" + f.year + ") - " + f.license, f.credit, "Played from the original free source - nothing re-hosted."], { w: 1024, h: 360, accent: "#7bd88f", font: "bold 40px system-ui, sans-serif", subFont: "26px system-ui, sans-serif" });
      plaqueBoard.material.needsUpdate = true;
    }
  }
  function attachTexture() {
    if (videoTex || !screenMat) return;
    videoTex = new THREE.VideoTexture(video);
    videoTex.colorSpace = THREE.SRGBColorSpace;
    screenMat.map = videoTex;
    screenMat.emissiveMap = videoTex;
    screenMat.emissive = new THREE.Color(0xffffff);
    screenMat.emissiveIntensity = 0.85;
    screenMat.color = new THREE.Color(0xffffff);
    screenMat.needsUpdate = true;
    setHouse(false); // lights down - the show is on
  }
  video.addEventListener("playing", () => { attachTexture(); failures = 0; setStatus(films[idx].credit); });
  video.addEventListener("error", () => {
    const f = films[idx];
    if (f.srcFallback && !triedFallback) {
      triedFallback = true;
      setStatus("Main reel unreachable - trying the backup print...");
      video.src = f.srcFallback;
      video.play().catch(() => {});
      return;
    }
    failures++;
    if (failures >= films.length) {
      setStatus("No reel reachable right now - honest empty screen, never a fake. Try again later.");
      started = false;
      return;
    }
    setStatus("That reel didn't load - trying the next one...");
    next(true);
  });

  function startShow() {
    const f = films[idx];
    triedFallback = false;
    started = true;
    setNowShowing();
    setStatus("Projecting - " + f.title);
    if (video.src !== f.src) video.src = f.src;
    const p = video.play();
    if (p && p.catch) p.catch(() => {
      // some phones insist on a muted first start — honor it, sound on next tap
      video.muted = true;
      video.play().then(() => setStatus(films[idx].credit + "  (tap the screen station again for sound)")).catch(() => {});
    });
  }
  function next(auto) {
    idx = (idx + 1) % films.length;
    triedFallback = false;
    setNowShowing();
    if (started) startShow();
  }
  function toggleSound() {
    if (video.muted) { video.muted = false; setStatus(films[idx].credit); return true; }
    return false;
  }
  kit.onPause((hidden) => { if (hidden) { try { video.pause(); } catch (e) {} } else if (started) { video.play().catch(() => {}); } });

  // ---------- interior ----------
  kit.registerInterior(id, (api) => {
    const half = api.half;
    const ox = api.origin.x, oz = api.origin.z;
    buildRoomShell(kit, api, { carpet: "#4d1d26", curtains: "#5e1f2b", wallH: 6.4 });

    // HOUSE LIGHTS - two warm points, on while idle, dimmed by setHouse() when playing
    houseLights = [];
    [[ox - half * 0.4, oz - half * 0.1], [ox + half * 0.4, oz + half * 0.3]].forEach((p) => {
      const l = new THREE.PointLight(0xffe9c4, 1.4, half * 3.4, 1.6);
      l.position.set(p[0], 5.6, p[1]);
      l.userData = { up: 1.4, down: 0.2 };
      kit.scene.add(l); houseLights.push(l);
    });

    // GLOWING STATION PADS - the start/next zones announce themselves
    padMats = [];
    [[ox, oz - half + 2.6, "#7bd88f", "START THE SCREENING"], [ox - half + 2.4, oz - half + 3.4, "#ffd166", "NEXT REEL"]].forEach((p) => {
      const pm = new THREE.MeshStandardMaterial({ color: new THREE.Color(p[2]), emissive: new THREE.Color(p[2]), emissiveIntensity: 1.0, roughness: 0.6 });
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.06, 20), pm);
      pad.position.set(p[0], 0.03, p[1]);
      kit.scene.add(pad); padMats.push(pm);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 0.5), new THREE.MeshStandardMaterial({ map: textTexture([p[3]], { w: 512, h: 96, bg: "#0a0d12", accent: p[2] }), emissive: 0xffffff, emissiveIntensity: 0.25, emissiveMap: textTexture([p[3]], { w: 512, h: 96, bg: "#0a0d12", accent: p[2] }) }));
      sign.position.set(p[0], 1.55, p[1]);
      kit.scene.add(sign);
    });

    // the far wall IS the screen (the house flagship-theater spec)
    // The idle screen TELLS you it's idle (honest empty states apply to pixels too).
    const idleMap = textTexture(["The screen is waiting", "Step on the glowing green pad to start the screening", "Amber pad changes the reel"], { w: 1024, h: 576, bg: "#070a10", accent: "#ffd166", font: "bold 52px system-ui, sans-serif", subFont: "30px system-ui, sans-serif" });
    screenMat = new THREE.MeshStandardMaterial({ map: idleMap, color: 0xffffff, roughness: 0.4, emissive: 0x3a4252, emissiveIntensity: 0.55, emissiveMap: idleMap });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(half * 1.6, half * 0.9), screenMat);
    screen.position.set(ox, half * 0.45 + 1.1, oz - half + 0.25);
    kit.scene.add(screen);

    // status + now-showing + attribution (the CC BY credit lives IN the room)
    statusBoard = new THREE.Mesh(new THREE.PlaneGeometry(half * 1.4, 0.42), new THREE.MeshStandardMaterial({ map: textTexture([""], { w: 1024, h: 110, border: false, bg: "#0a0d12" }) }));
    statusBoard.position.set(ox, 0.72, oz - half + 0.24);
    kit.scene.add(statusBoard);
    nowBoard = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.05), new THREE.MeshStandardMaterial({ map: textTexture(["NOW SHOWING", ""], { w: 1024, h: 240 }) }));
    nowBoard.position.set(ox - half + 2.4, 2.6, oz - half + 0.24);
    kit.scene.add(nowBoard);
    plaqueBoard = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.3), new THREE.MeshStandardMaterial({ map: textTexture(["About this screening"], { w: 1024, h: 360 }) }));
    plaqueBoard.position.set(ox + half - 0.15, 2.0, oz + half * 0.3);
    plaqueBoard.rotation.y = -Math.PI / 2;
    kit.scene.add(plaqueBoard);

    // seats: instanced cushion + backrest, facing the screen
    const rows = 4, cols = 7;
    const seatGeo = new THREE.BoxGeometry(0.62, 0.5, 0.55);
    const backGeo = new THREE.BoxGeometry(0.62, 0.62, 0.14);
    const seatMat = M(0x7a2433, { roughness: 0.9 });
    const seats = new THREE.InstancedMesh(seatGeo, seatMat, rows * cols);
    const backs = new THREE.InstancedMesh(backGeo, seatMat, rows * cols);
    const m4 = new THREE.Matrix4();
    let si = 0;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const sx = ox - (cols - 1) * 0.55 + c * 1.1;
      const sz = oz - half + 4.4 + r * 1.5;
      m4.makeTranslation(sx, 0.25, sz);
      seats.setMatrixAt(si, m4);
      m4.makeTranslation(sx, 0.62, sz + 0.32);
      backs.setMatrixAt(si, m4);
      si++;
      if (r === 0 || r === rows - 1 || c === 0 || c === cols - 1) {
        // collide on the outer ring only — walking between rows stays easy
      }
    }
    kit.scene.add(seats); kit.scene.add(backs);
    for (let r = 0; r < rows; r++) {
      api.addCollider({ x: ox, z: oz - half + 4.4 + r * 1.5 + 0.15, w: cols * 1.1 - 0.4, d: 0.5 });
    }

    // stations
    api.addDoor({ label: "Start the screening", x: ox, z: oz - half + 2.6, hw: 2.6, hd: 1.6, act: { type: "fn", fn: () => { if (!toggleSound() || !started) startShow(); } } });
    api.addDoor({ label: "Next reel", x: ox - half + 2.4, z: oz - half + 3.4, hw: 1.5, hd: 1.5, act: { type: "fn", fn: () => next(false) } });
    api.addDoor({ label: "Leave the theater", x: ox, z: oz + half - 1.6, hw: 2.2, hd: 1.8, act: { type: "fn", fn: () => { try { video.pause(); } catch (e) {} started = false; setHouse(true); kit.exitInterior(); } } });

    // projector booth glow at the back
    const boothMat = M(0xfff1cc, { emissive: 0xfff1cc, emissiveIntensity: 0.9 });
    const booth = box(1.2, 0.5, 0.3, boothMat);
    booth.position.set(ox, 4.6, oz + half - 0.3);
    kit.scene.add(booth);
  }, { half: o.roomHalf || 12 });

  // the front door leads into the hall
  kit.addDoor({ label: name + " — walk in", x: x, z: z + d / 2 + 1.4, hw: 2.4, hd: 2.0, act: { type: "interior", id } });

  setNowShowing();
  return { group: g, id, startShow, next };
}
