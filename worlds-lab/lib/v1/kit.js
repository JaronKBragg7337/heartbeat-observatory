// WORLDS LAB · lib v1 · kit.js — the world chassis.
// One call builds: renderer (ACES, sRGB, phone-capped pixel ratio), sky + wall-clock
// day/night, terrain hookup, World-1 movement feel (verbatim numbers), touch pad +
// keyboard/mouse parity, AABB colliders, the door/prompt system (Press E / Tap),
// walk-in interiors (teleport + collider swap, the proven World-1 mechanic),
// and a RIDE system (camera rides a moving pose: coasters, trains, helicopters,
// rockets, ferris wheels — anything that can answer "where am I at time t?").
//
// LAWS HONORED (from TODO.md / WORLD2-PLAN.md):
//   - Worlds stay self-contained folders; this lib is FROZEN at v1 once shipped on.
//   - TDZ law: kit.js only defines functions; nothing here runs at import time.
//   - No per-frame allocations: module temps are reused.
//   - Phone + computer parity: every feature works by touch AND keyboard/mouse.
//   - Honesty: lab worlds are solo previews; the HUD chip says so plainly.
// LIB FREEZE LAW: v1 files are frozen once worlds ship on them. Improvements go in lib/v2/.
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.module.js";

export const KIT_BUILD = "worlds-lab-kit-v1";

// ---- module temps (reused every frame — no per-frame allocations) ----
const _color = new THREE.Color();
const _colorB = new THREE.Color();
const _v3 = new THREE.Vector3();
const _v3b = new THREE.Vector3();

// World 1's proven movement feel — copied numbers, not re-derived.
const MOVE = { walk: 4.65, sprint: 7.2, crouch: 2.45, gravity: 17.5, jump: 6.4, look: 0.0023, touchLook: 0.0042 };
const EYE = { stand: 1.65, crouch: 1.15 };
const PLAYER_RADIUS = 0.35;

function lerpStops(stops, t, out) {
  // stops: [[t0,"#hex"],...] sorted; loops at 1.
  let a = stops[0], b = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i][0] && t <= stops[i + 1][0]) { a = stops[i]; b = stops[i + 1]; break; }
  }
  const span = Math.max(1e-6, b[0] - a[0]);
  const k = Math.min(1, Math.max(0, (t - a[0]) / span));
  _colorB.set(a[1]);
  out.set(b[1]).lerp(_colorB, 1 - k);
  return out;
}

export function createWorld(opts) {
  const o = opts || {};
  const BUILD = o.build || "lab-dev";

  // ---- DOM (the lab page scaffold; every lookup is null-safe) ----
  const canvas = document.querySelector("#game");
  const overlay = document.querySelector("#overlay");
  const enterButton = document.querySelector("#enterButton");
  const timeChip = document.querySelector("#timeChip");
  const modeChip = document.querySelector("#modeChip");
  const doorPrompt = document.querySelector("#doorPrompt");
  const doorPromptText = document.querySelector("#doorPromptText");
  const doorEnterBtn = document.querySelector("#doorEnterBtn");
  const movePad = document.querySelector("#movePad");
  const moveKnob = document.querySelector("#moveKnob");
  const jumpButton = document.querySelector("#jumpButton");
  const crouchButton = document.querySelector("#crouchButton");

  const isTouch = matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;

  // ---- world options ----
  const bounds = o.bounds || 120;
  const groundHeight = o.groundHeight || function () { return 0; };
  const spawn = Object.assign({ x: 0, z: 6, yaw: 0 }, o.spawn);
  const fixedTime = (typeof o.timeOfDay === "number") ? o.timeOfDay : null; // 0..1, else wall-clock cycle
  const DAY_SECONDS = o.daySeconds || 300; // same wall-clock cadence as the live worlds

  const palette = Object.assign({
    skyStops: [[0, "#0a1426"], [0.22, "#e08c52"], [0.34, "#87b8e8"], [0.66, "#87b8e8"], [0.79, "#e08c52"], [0.9, "#0a1426"], [1, "#0a1426"]],
    fogTint: 1.0,
    sunWarm: "#fff1d6",
    night: "#0a1426",
  }, o.palette);

  // ---- renderer / scene / camera ----
  const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); // phone GPU guard
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  if (o.shadows) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(palette.night);
  scene.fog = new THREE.FogExp2(palette.night, o.fogDensity || 0.011);

  const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 700);

  const hemi = new THREE.HemisphereLight(0xbcd8f2, 0x4a4036, 0.7);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1.1);
  sun.position.set(40, 70, 20);
  if (o.shadows) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const sc = sun.shadow.camera;
    sc.left = -48; sc.right = 48; sc.top = 48; sc.bottom = -48; sc.far = 220;
  }
  scene.add(sun);

  // stars (visible at night; one Points draw call)
  const starGeo = new THREE.BufferGeometry();
  {
    const n = 420, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 0.95);
      const r = 520;
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.cos(ph) + 20;
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  }
  const starMat = new THREE.PointsMaterial({ color: 0xeef2ff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // ---- player state ----
  const state = {
    x: spawn.x, z: spawn.z,
    fy: groundHeight(spawn.x, spawn.z), // feet height
    vy: 0, onGround: true,
    yaw: spawn.yaw || 0, pitch: -0.04,
    crouch: false, sprint: false,
    entered: false,
  };

  // ---- colliders & doors (outdoor set + per-interior sets) ----
  const worldColliders = [];
  const worldDoors = [];
  const interiors = new Map(); // id -> {colliders, doors, spawn:{x,z}, floorY, bounds:{minX,maxX,minZ,maxZ}}
  let activeInterior = null;   // id or null
  let returnSpot = null;       // {x,z,yaw} saved on interior entry
  let activeDoor = null;

  function addCollider(c) {
    // {x,z,w,d} axis-aligned footprint
    const box = { x: c.x, z: c.z, hw: (c.w || 1) / 2 + PLAYER_RADIUS, hd: (c.d || 1) / 2 + PLAYER_RADIUS };
    (activeBuildTarget ? activeBuildTarget.colliders : worldColliders).push(box);
    return box;
  }
  function addDoor(d) {
    const door = { label: d.label || "Enter", x: d.x, z: d.z, hw: d.hw || 2.2, hd: d.hd || 2.2, act: d.act || { type: "page", path: "/" } };
    (activeBuildTarget ? activeBuildTarget.doors : worldDoors).push(door);
    return door;
  }

  // interiors are built far away on a flat floor; entering = teleport + collider/door
  // swap + flat ground; exit returns you to the exact spot you entered from.
  let interiorSlot = 0;
  let activeBuildTarget = null;
  function registerInterior(id, builder, opt) {
    const slot = interiorSlot++;
    const ox = 1000 + slot * 220, oz = -1000;
    const half = (opt && opt.half) || 14;
    const room = { colliders: [], doors: [], spawn: { x: ox, z: oz + half - 3 }, floorY: 0, ox, oz, bounds: { minX: ox - half + 0.6, maxX: ox + half - 0.6, minZ: oz - half + 0.6, maxZ: oz + half - 0.6 } };
    interiors.set(id, room);
    activeBuildTarget = room;
    builder({
      origin: { x: ox, z: oz },
      half,
      addDoor,
      addCollider,
      makeExit: function (dx, dz, label) {
        addDoor({ label: label || "Back outside", x: ox + (dx || 0), z: oz + (dz || half - 1.4), hw: 1.8, hd: 1.8, act: { type: "exit" } });
      },
    });
    activeBuildTarget = null;
    return room;
  }
  function enterInterior(id) {
    const room = interiors.get(id);
    if (!room) return;
    returnSpot = { x: state.x, z: state.z, yaw: state.yaw };
    activeInterior = id;
    state.x = room.spawn.x; state.z = room.spawn.z;
    state.fy = room.floorY; state.vy = 0; state.yaw = Math.PI;
  }
  function exitInterior() {
    activeInterior = null;
    if (returnSpot) {
      state.x = returnSpot.x; state.z = returnSpot.z; state.yaw = returnSpot.yaw;
      state.fy = groundHeight(state.x, state.z); state.vy = 0;
      returnSpot = null;
    }
  }

  // ---- rides: the camera rides any object that can answer "pose at time t" ----
  // ride = { label, duration?, dismount:{x,z}, pose(t, out:{x,y,z,yaw,pitch}) -> void, onStart?, onEnd? }
  let riding = null, rideTime = 0;
  const ridePose = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
  function startRide(ride) {
    riding = ride; rideTime = 0;
    if (ride.onStart) { try { ride.onStart(); } catch (e) {} }
  }
  function endRide() {
    if (!riding) return;
    const r = riding; riding = null;
    const dm = r.dismount || { x: state.x, z: state.z };
    state.x = dm.x; state.z = dm.z;
    state.fy = activeInterior ? interiors.get(activeInterior).floorY : groundHeight(dm.x, dm.z);
    state.vy = 0;
    if (typeof dm.yaw === "number") state.yaw = dm.yaw;
    if (r.onEnd) { try { r.onEnd(); } catch (e) {} }
  }

  // ---- door scan + prompt (World 2's exact UX: "Press E — " / "Tap — ") ----
  function updateActiveDoor() {
    if (!state.entered) { activeDoor = null; return; }
    if (riding) {
      if (doorPrompt && doorPromptText) {
        doorPromptText.textContent = (isTouch ? "Tap — " : "Press E — ") + "Hop off " + (riding.label || "the ride");
        doorPrompt.classList.remove("hidden");
        if (doorEnterBtn) doorEnterBtn.classList.add("active");
      }
      return;
    }
    const list = activeInterior ? interiors.get(activeInterior).doors : worldDoors;
    let next = null, best = Infinity;
    for (let i = 0; i < list.length; i++) {
      const door = list[i];
      const dx = state.x - door.x, dz = state.z - door.z;
      if (Math.abs(dx) > door.hw || Math.abs(dz) > door.hd) continue;
      const d = Math.hypot(dx, dz);
      if (d < best) { best = d; next = door; }
    }
    activeDoor = next;
    if (doorPrompt && doorPromptText) {
      if (activeDoor) {
        doorPromptText.textContent = (isTouch ? "Tap — " : "Press E — ") + activeDoor.label;
        doorPrompt.classList.remove("hidden");
        if (doorEnterBtn) doorEnterBtn.classList.add("active");
      } else {
        doorPrompt.classList.add("hidden");
        if (doorEnterBtn) doorEnterBtn.classList.remove("active");
      }
    }
  }

  function enterActive() {
    if (riding) { endRide(); return; }
    if (!activeDoor) return;
    const act = activeDoor.act;
    if (act.type === "interior") enterInterior(act.id);
    else if (act.type === "exit") exitInterior();
    else if (act.type === "ride") startRide(act.ride);
    else if (act.type === "fn") { try { act.fn(); } catch (e) {} }
    else if (act.type === "ext") { try { window.open(act.url, "_blank", "noopener"); } catch (e) {} }
    else location.assign(act.path);
    activeDoor = null;
  }

  // ---- input: keyboard + mouse ----
  const keys = Object.create(null);
  window.addEventListener("keydown", (e) => {
    keys[e.code] = true;
    if (e.code === "KeyE") enterActive();
    if (e.code === "Space" && state.onGround && state.entered && !riding) { state.vy = MOVE.jump; state.onGround = false; }
    if (e.code === "KeyC" || e.code === "ControlLeft") state.crouch = true;
    if (e.code === "ShiftLeft" || e.code === "ShiftRight") state.sprint = true;
  });
  window.addEventListener("keyup", (e) => {
    keys[e.code] = false;
    if (e.code === "KeyC" || e.code === "ControlLeft") state.crouch = false;
    if (e.code === "ShiftLeft" || e.code === "ShiftRight") state.sprint = false;
  });
  if (!isTouch && canvas) {
    canvas.addEventListener("click", () => {
      if (state.entered && document.pointerLockElement !== canvas) {
        try { canvas.requestPointerLock(); } catch (e) {}
      }
    });
    window.addEventListener("mousemove", (e) => {
      if (document.pointerLockElement !== canvas) return;
      state.yaw -= e.movementX * MOVE.look;
      state.pitch = Math.max(-1.35, Math.min(1.35, state.pitch - e.movementY * MOVE.look));
    });
  }

  // ---- input: touch (move pad + drag look + buttons) ----
  const moveVec = { x: 0, y: 0 };
  let padPointer = null, lookPointer = null, lookLast = { x: 0, y: 0 };
  function resetMovePad() {
    padPointer = null; moveVec.x = 0; moveVec.y = 0;
    if (moveKnob) moveKnob.style.transform = "translate(-50%,-50%)";
  }
  if (movePad) {
    movePad.addEventListener("pointerdown", (e) => {
      padPointer = e.pointerId;
      movePad.setPointerCapture(e.pointerId);
      padMove(e);
    });
    movePad.addEventListener("pointermove", padMove);
    movePad.addEventListener("pointerup", resetMovePad);
    movePad.addEventListener("pointercancel", resetMovePad);
  }
  function padMove(e) {
    if (e.pointerId !== padPointer) return;
    const rect = movePad.getBoundingClientRect();
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    let dx = (e.clientX - cx) / (rect.width / 2), dy = (e.clientY - cy) / (rect.height / 2);
    const m = Math.hypot(dx, dy);
    if (m > 1) { dx /= m; dy /= m; }
    moveVec.x = dx; moveVec.y = dy;
    if (moveKnob) moveKnob.style.transform = "translate(calc(-50% + " + (dx * 36) + "px), calc(-50% + " + (dy * 36) + "px))";
  }
  if (isTouch && canvas) {
    canvas.addEventListener("pointerdown", (e) => {
      if (lookPointer === null) { lookPointer = e.pointerId; lookLast.x = e.clientX; lookLast.y = e.clientY; }
    });
    canvas.addEventListener("pointermove", (e) => {
      if (e.pointerId !== lookPointer) return;
      state.yaw -= (e.clientX - lookLast.x) * MOVE.touchLook;
      state.pitch = Math.max(-1.35, Math.min(1.35, state.pitch - (e.clientY - lookLast.y) * MOVE.touchLook));
      lookLast.x = e.clientX; lookLast.y = e.clientY;
    });
    const endLook = (e) => { if (e.pointerId === lookPointer) lookPointer = null; };
    canvas.addEventListener("pointerup", endLook);
    canvas.addEventListener("pointercancel", endLook);
  }
  if (jumpButton) jumpButton.addEventListener("click", () => { if (state.onGround && state.entered && !riding) { state.vy = MOVE.jump; state.onGround = false; } });
  if (crouchButton) crouchButton.addEventListener("click", () => { state.crouch = !state.crouch; });
  if (doorPrompt) doorPrompt.addEventListener("click", () => enterActive());
  if (doorEnterBtn) doorEnterBtn.addEventListener("click", (e) => { e.preventDefault(); enterActive(); });

  // ---- collision (World-1 shape: AABB push-out on the smaller overlap axis) ----
  function resolveCollision() {
    const list = activeInterior ? interiors.get(activeInterior).colliders : worldColliders;
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      const dx = state.x - c.x, dz = state.z - c.z;
      if (Math.abs(dx) < c.hw && Math.abs(dz) < c.hd) {
        const ox = c.hw - Math.abs(dx), oz = c.hd - Math.abs(dz);
        if (ox < oz) state.x = c.x + Math.sign(dx || 1) * c.hw;
        else state.z = c.z + Math.sign(dz || 1) * c.hd;
      }
    }
  }

  // ---- sky / day-night ----
  let dayNow = 0.4, nightNow = 0;
  function updateSky(t) {
    dayNow = fixedTime !== null ? fixedTime : ((Date.now() / 1000) % DAY_SECONDS) / DAY_SECONDS;
    lerpStops(palette.skyStops, dayNow, _color);
    scene.background.copy(_color);
    scene.fog.color.copy(_color).multiplyScalar(palette.fogTint);
    const ang = dayNow * Math.PI * 2 - Math.PI / 2;
    const elev = Math.sin(ang);
    sun.position.set(Math.cos(ang) * 90, Math.max(6, elev * 110), 35);
    const dayAmt = Math.max(0, Math.min(1, (elev + 0.12) / 0.5));
    sun.intensity = 0.08 + dayAmt * 1.15;
    _colorB.set(palette.sunWarm);
    sun.color.copy(_colorB).lerp(_color, (1 - dayAmt) * 0.4);
    hemi.intensity = 0.18 + dayAmt * 0.6;
    renderer.toneMappingExposure = 0.78 + dayAmt * 0.32;
    nightNow = 1 - dayAmt;
    starMat.opacity = Math.max(0, nightNow - 0.25) * 1.1;
    if (timeChip) {
      const mins = Math.floor(dayNow * 24 * 60);
      const hh = String(Math.floor(mins / 60)).padStart(2, "0");
      const mm = String(mins % 60).padStart(2, "0");
      timeChip.textContent = hh + ":" + mm;
    }
  }

  // helper: a material's emissive glow rides the night (World 2's window law)
  const emissiveBindings = [];
  function bindEmissive(mat, max, min) {
    emissiveBindings.push({ mat, max: (typeof max === "number") ? max : 1.0, min: (typeof min === "number") ? min : 0.06 });
  }

  // ---- per-frame hooks & pause hooks ----
  const updates = [];
  function addUpdate(fn) { updates.push(fn); }
  const pauseHooks = [];
  function onPause(fn) { pauseHooks.push(fn); }
  document.addEventListener("visibilitychange", () => {
    for (let i = 0; i < pauseHooks.length; i++) { try { pauseHooks[i](document.hidden); } catch (e) {} }
  });

  // ---- name sprite (same trick as the live worlds: canvas sprite) ----
  function makeNameSprite(text, scale) {
    const c = document.createElement("canvas");
    c.width = 512; c.height = 128;
    const g = c.getContext("2d");
    g.fillStyle = "rgba(8,12,16,0.72)";
    g.beginPath();
    if (g.roundRect) g.roundRect(6, 22, 500, 84, 22); else g.rect(6, 22, 500, 84);
    g.fill();
    g.font = "bold 44px system-ui, sans-serif";
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillStyle = "#e8eef4";
    g.fillText(String(text), 256, 66, 470);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    const s = scale || 1;
    sp.scale.set(4.4 * s, 1.1 * s, 1);
    return sp;
  }

  function groundY(x, z) {
    return activeInterior ? interiors.get(activeInterior).floorY : groundHeight(x, z);
  }

  // ---- frame loop ----
  const clock = new THREE.Clock();
  let elapsed = 0;
  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, clock.getDelta());
    elapsed += dt;
    updateSky(elapsed);

    if (state.entered) {
      if (riding) {
        rideTime += dt;
        riding.pose(rideTime, ridePose);
        camera.position.set(ridePose.x, ridePose.y, ridePose.z);
        camera.rotation.set(0, 0, 0);
        camera.rotateY(ridePose.yaw);
        camera.rotateX(ridePose.pitch || 0);
        if (riding && riding.duration && rideTime >= riding.duration) endRide();
      } else {
        // movement (touch pad and keys merge into one intent vector)
        let mx = 0, mz = 0;
        if (keys.KeyW || keys.ArrowUp) mz -= 1;
        if (keys.KeyS || keys.ArrowDown) mz += 1;
        if (keys.KeyA || keys.ArrowLeft) mx -= 1;
        if (keys.KeyD || keys.ArrowRight) mx += 1;
        mx += moveVec.x; mz += moveVec.y;
        const mlen = Math.hypot(mx, mz);
        if (mlen > 1) { mx /= mlen; mz /= mlen; }
        const speed = state.crouch ? MOVE.crouch : (state.sprint ? MOVE.sprint : MOVE.walk);
        const sin = Math.sin(state.yaw), cos = Math.cos(state.yaw);
        // FIXED (Jaron's live report: "cannot move straight, left/up/down all off"): the
        // intent vector was rotated by -yaw instead of +yaw, so walking was only true while
        // facing the spawn direction and strafing mirrored as you turned. Camera forward is
        // (-sin yaw, -cos yaw); correct rotation of input (mx, mz) into world space is:
        state.x += (mx * cos + mz * sin) * speed * dt;
        state.z += (mz * cos - mx * sin) * speed * dt;

        // bounds
        if (activeInterior) {
          const b = interiors.get(activeInterior).bounds;
          state.x = Math.max(b.minX, Math.min(b.maxX, state.x));
          state.z = Math.max(b.minZ, Math.min(b.maxZ, state.z));
        } else {
          state.x = Math.max(-bounds, Math.min(bounds, state.x));
          state.z = Math.max(-bounds, Math.min(bounds, state.z));
        }
        resolveCollision();

        // vertical: feet follow ground; jumps arc under World-1 gravity
        const target = groundY(state.x, state.z);
        if (state.onGround) {
          state.fy = target;
        } else {
          state.vy -= MOVE.gravity * dt;
          state.fy += state.vy * dt;
          if (state.fy <= target) { state.fy = target; state.vy = 0; state.onGround = true; }
        }
        if (state.onGround && state.fy < target - 0.001) state.fy = target;

        const eye = state.crouch ? EYE.crouch : EYE.stand;
        camera.position.set(state.x, state.fy + eye, state.z);
        camera.rotation.set(0, 0, 0);
        camera.rotateY(state.yaw);
        camera.rotateX(state.pitch);
      }
    } else {
      // pre-enter: slow orbit over spawn (same idea as the live start screens)
      const a = elapsed * 0.12;
      const r = 26;
      camera.position.set(spawn.x + Math.cos(a) * r, groundHeight(spawn.x, spawn.z) + 14, spawn.z + Math.sin(a) * r);
      _v3.set(spawn.x, groundHeight(spawn.x, spawn.z) + 2, spawn.z);
      camera.lookAt(_v3);
    }

    updateActiveDoor();
    for (let i = 0; i < emissiveBindings.length; i++) {
      const b = emissiveBindings[i];
      b.mat.emissiveIntensity = b.min + Math.pow(nightNow, 1.6) * (b.max - b.min);
    }
    for (let i = 0; i < updates.length; i++) {
      try { updates[i](dt, elapsed, dayNow); } catch (e) {}
    }
    renderer.render(scene, camera);
  }

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ---- boot (called from the END of each world's main.js — TDZ law) ----
  function start() {
    try { console.log("Heartbeat Observatory — Worlds Lab build", BUILD, "·", KIT_BUILD); } catch (e) {}
    if (modeChip) modeChip.textContent = "lab · solo preview";
    if (enterButton) {
      enterButton.addEventListener("click", () => {
        state.entered = true;
        if (overlay) overlay.classList.add("hidden");
        if (!isTouch && canvas) { try { canvas.requestPointerLock(); } catch (e) {} }
      });
    }
    frame();
  }

  return {
    THREE, scene, camera, renderer, sun, hemi,
    state, isTouch, bounds,
    groundHeight, groundY,
    addCollider, addDoor, registerInterior,
    enterInterior, exitInterior,
    startRide, endRide,
    addUpdate, onPause, bindEmissive,
    makeNameSprite,
    day: function () { return dayNow; },
    night: function () { return nightNow; },
    start,
  };
}

// shared page scaffold helper — worlds call this to stamp their identity into the
// lab HTML template (title, tagline, accent) without each page duplicating logic.
export function labChrome(opts) {
  const o = opts || {};
  try {
    if (o.accent) document.documentElement.style.setProperty("--accent", o.accent);
    const nameChip = document.querySelector("#worldChip");
    if (nameChip && o.name) nameChip.innerHTML = "<b>" + o.name + "</b>";
    const h1 = document.querySelector("#overlayTitle");
    if (h1 && o.name) h1.textContent = o.name;
    const tag = document.querySelector("#overlayTagline");
    if (tag && o.tagline) tag.textContent = o.tagline;
    const note = document.querySelector("#overlayNote");
    if (note && o.note) note.innerHTML = o.note;
  } catch (e) {}
}
