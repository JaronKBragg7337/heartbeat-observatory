// WORLD 2 — Heartbeat Observatory. Phase 1: the skeleton.
// Own code, own directory — nothing here imports from /engine/hub/. World 1 is untouchable.
// Laws honored in this file (from WORLD2-PLAN.md / TODO.md):
//   - BUILD const below is bumped together with ?v= in /world2/index.html, same commit, every push.
//   - TDZ / boot-order law: every const/let used by boot-path or frame-loop code is declared
//     ABOVE the buildWorld()/animate() calls — which sit at the very END of this file.
//   - No per-frame allocations in animate(): module-level temps are reused.
//   - Movement feel copied from World 1 (speeds, gravity, jump, look sensitivity) — proven shapes.
//   - groundHeight(x, z) exists from day one: movement already follows the ground, so the
//     Phase 2 terrain only has to raise the amplitude, not rewire movement.

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.module.js";

const BUILD = "2026-06-10-w2a"; // bumped with ?v= in /world2/index.html on every deploy
try { console.log("Heartbeat Observatory — World 2 build", BUILD); } catch (e) {}

// ---- DOM ----
const canvas = document.querySelector("#game");
const overlay = document.querySelector("#overlay");
const enterButton = document.querySelector("#enterButton");
const timeChip = document.querySelector("#timeChip");
const movePad = document.querySelector("#movePad");
const moveKnob = document.querySelector("#moveKnob");
const jumpButton = document.querySelector("#jumpButton");
const crouchButton = document.querySelector("#crouchButton");

const isTouch = matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;

// ---- world constants (movement numbers are World 1's — the proven feel) ----
const worldBounds = 140;          // soft edge; fog melts the far terrain long before this
const playerRadius = 0.35;        // used by resolveCollision once colliders exist (Phase 3)
const standingEyeHeight = 1.65;
const crouchEyeHeight = 1.15;
const gravity = 17.5;
const jumpVelocity = 6.4;
const WORLD_SEED = 7337;

// ---- day/night palette (World 2's own — warmer dusk, deeper night than the town) ----
const W2_DAY = new THREE.Color(0xaecde4);
const W2_DUSK = new THREE.Color(0xe08c52);
const W2_NIGHT = new THREE.Color(0x0a1422);

// ---- player state ----
const state = { x: 0, y: 1.65, z: 10, yaw: 0, pitch: 0, stance: "stand" };
const input = { moveX: 0, moveY: 0, crouchHeld: false, jumpQueued: false, touchLookId: null, touchLookX: 0, touchLookY: 0, moveTouchId: null };
const settings = { sensitivity: 1, invertY: false };
const motion = { airOffset: 0, verticalVelocity: 0, onGround: true, sprinting: false, moving: false };
const keys = new Set();
let hasEntered = false;
let previewAngle = -0.55;

// ---- colliders (empty in Phase 1; Phase 3 fills them — same shape as World 1) ----
const buildingColliders = []; // { x, z, width, depth }

// ---- scene / renderer (the cinematic foundation — this alone is half the look) ----
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xaecde4);
scene.fog = new THREE.FogExp2(0xaecde4, 0.0115); // fog matched to sky = THE atmosphere trick

const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.08, 500);
camera.rotation.order = "YXZ";

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const clock = new THREE.Clock();

// ---- sky / light handles (filled by buildWorld) ----
let sunLight = null, hemiLight = null;
let skyAnchor = null, sunDisc = null, moonDisc = null, stars = null;

// ---- module temps (reused every frame — no per-frame allocations) ----
const _sky = new THREE.Color();
const _sunOff = new THREE.Vector3();

// ---- seeded value noise (tiny, no library) + groundHeight ----
function hash2(ix, iz) {
  let h = (ix * 374761393 + iz * 668265263 + WORLD_SEED * 144665) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function vnoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz), b = hash2(ix + 1, iz), c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}
// Phase 1: gentle, flat-ish swells. Phase 2 raises amplitude + octaves; movement code won't change.
function groundHeight(x, z) {
  let h = (vnoise(x * 0.012, z * 0.012) - 0.5) * 2 * 1.4;
  h += (vnoise(x * 0.05 + 37.7, z * 0.05 + 19.3) - 0.5) * 2 * 0.35;
  const d = Math.hypot(x, z);
  const flat = Math.min(1, Math.max(0, (d - 8) / 18)); // spawn stays level
  return h * flat;
}

// ---- build the world ----
function buildWorld() {
  // ground: heightfield plane, vertex-colored by height (no textures yet — Phase 2 deepens this)
  const size = 600, segs = 196;
  const groundGeo = new THREE.PlaneGeometry(size, size, segs, segs);
  groundGeo.rotateX(-Math.PI / 2);
  const pos = groundGeo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cLow = new THREE.Color(0x46604a), cMid = new THREE.Color(0x55714a), cHigh = new THREE.Color(0x84775a);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = groundHeight(x, z);
    pos.setY(i, h);
    const t = Math.min(1, Math.max(0, (h + 1.6) / 3.2));
    const jitter = (vnoise(x * 0.3 + 91, z * 0.3 + 17) - 0.5) * 0.06;
    _sky.copy(cLow).lerp(cMid, Math.min(1, t * 1.6)).lerp(cHigh, Math.max(0, t - 0.55) * 2.2);
    colors[i * 3] = _sky.r + jitter;
    colors[i * 3 + 1] = _sky.g + jitter;
    colors[i * 3 + 2] = _sky.b + jitter;
  }
  groundGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  groundGeo.computeVertexNormals();
  const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }));
  ground.receiveShadow = true;
  scene.add(ground);

  // spawn marker: a flat stone disc — honest "you arrive here", not a fake plaza
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(2.6, 2.8, 0.18, 28),
    new THREE.MeshStandardMaterial({ color: 0x8e8a80, roughness: 0.85 })
  );
  disc.position.set(0, 0.02, 0);
  disc.receiveShadow = true;
  scene.add(disc);

  // scattered boulders: scale + parallax reference while walking (instanced — one draw call)
  const rockCount = 70;
  const rocks = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(1, 0),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }),
    rockCount
  );
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
  for (let i = 0; i < rockCount; i++) {
    const ang = hash2(i, 11) * Math.PI * 2;
    const dist = 15 + hash2(i, 23) * 115;
    const x = Math.cos(ang) * dist, z = Math.sin(ang) * dist;
    const sc = 0.4 + hash2(i, 41) * 1.3;
    e.set(hash2(i, 5) * Math.PI, hash2(i, 7) * Math.PI, hash2(i, 9) * Math.PI);
    q.setFromEuler(e);
    s.set(sc, sc * (0.7 + hash2(i, 13) * 0.5), sc);
    p.set(x, groundHeight(x, z) + sc * 0.18, z);
    m.compose(p, q, s);
    rocks.setMatrixAt(i, m);
    const g = 0.42 + hash2(i, 57) * 0.2;
    _sky.setRGB(g, g * (0.97 + hash2(i, 61) * 0.06), g * (0.94 + hash2(i, 67) * 0.06));
    rocks.setColorAt(i, _sky);
  }
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  scene.add(rocks);

  // one sun, PCFSoft shadows, tight shadow camera that follows the player
  sunLight = new THREE.DirectionalLight(0xffffff, 2.0);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.camera.left = -48;
  sunLight.shadow.camera.right = 48;
  sunLight.shadow.camera.top = 48;
  sunLight.shadow.camera.bottom = -48;
  sunLight.shadow.camera.near = 2;
  sunLight.shadow.camera.far = 260;
  sunLight.shadow.bias = -0.0005;
  scene.add(sunLight);
  scene.add(sunLight.target);

  hemiLight = new THREE.HemisphereLight(0xbfd6e8, 0x4a4438, 1.0);
  scene.add(hemiLight);

  // sky elements ride an anchor pinned to the player, so they never drift close or fall behind
  skyAnchor = new THREE.Group();
  scene.add(skyAnchor);

  sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(9, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd9a0, fog: false, depthWrite: false })
  );
  skyAnchor.add(sunDisc);

  moonDisc = new THREE.Mesh(
    new THREE.CircleGeometry(5.5, 24),
    new THREE.MeshBasicMaterial({ color: 0xd8e2ef, fog: false, depthWrite: false, transparent: true, opacity: 0.92 })
  );
  skyAnchor.add(moonDisc);

  const starCount = 420;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const az = hash2(i, 101) * Math.PI * 2;
    const el = Math.asin(0.06 + hash2(i, 103) * 0.93);
    const r = 230;
    starPos[i * 3] = Math.cos(el) * Math.cos(az) * r;
    starPos[i * 3 + 1] = Math.sin(el) * r;
    starPos[i * 3 + 2] = Math.cos(el) * Math.sin(az) * r;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xeaf2ff, size: 1.7, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  skyAnchor.add(stars);
}

// ---- day/night (wall-clock driven like World 1: every visitor sees the same sky) ----
function pickSky(e) {
  if (e > 0.18) _sky.copy(W2_DAY);
  else if (e > 0) _sky.copy(W2_DUSK).lerp(W2_DAY, e / 0.18);
  else if (e > -0.22) _sky.copy(W2_NIGHT).lerp(W2_DUSK, (e + 0.22) / 0.22);
  else _sky.copy(W2_NIGHT);
  return _sky;
}

function updateDayNight() {
  if (!sunLight) return;
  const CYCLE = 300;
  const t = ((Date.now() / 1000) % CYCLE) / CYCLE;
  const a = t * Math.PI * 2;
  const e = Math.sin(a);
  const horiz = Math.cos(a);
  const day = Math.max(0, Math.min(1, e * 1.6 + 0.08));

  _sunOff.set(horiz * 60, e * 70, 24 + e * 6);
  sunLight.position.set(state.x + _sunOff.x, _sunOff.y, state.z + _sunOff.z);
  sunLight.target.position.set(state.x, 0, state.z);
  sunLight.intensity = 0.1 + 2.2 * day;
  sunLight.color.setRGB(1, 0.92 - 0.16 * (1 - day), 0.82 - 0.28 * (1 - day));
  if (hemiLight) hemiLight.intensity = 0.32 + 0.85 * Math.max(0, Math.min(1, e + 0.3));

  // atmosphere driven by the cycle: sky, fog color AND density, tone exposure
  const sky = pickSky(e);
  scene.background.copy(sky);
  scene.fog.color.copy(sky);
  scene.fog.density = 0.0095 + (1 - day) * 0.0065;
  renderer.toneMappingExposure = 0.92 + 0.24 * day;

  if (skyAnchor) skyAnchor.position.set(state.x, 0, state.z);
  if (sunDisc) {
    const len = _sunOff.length() || 1;
    sunDisc.position.set(_sunOff.x / len * 215, _sunOff.y / len * 215, _sunOff.z / len * 215);
    sunDisc.visible = e > -0.08;
    sunDisc.material.color.setRGB(1, 0.74 + 0.2 * day, 0.5 + 0.42 * day);
    sunDisc.lookAt(camera.position);
  }
  if (moonDisc) {
    const len = _sunOff.length() || 1;
    moonDisc.position.set(-_sunOff.x / len * 205, -_sunOff.y / len * 205, -_sunOff.z / len * 205);
    moonDisc.visible = e < 0.08;
    moonDisc.lookAt(camera.position);
  }
  const nightF = Math.max(0, Math.min(1, -e * 1.5 + 0.1));
  if (stars) stars.material.opacity = nightF * 0.95;

  if (timeChip) {
    const label = e > 0.25 ? "daylight" : e > 0 ? "golden hour" : e > -0.12 ? "dusk" : "night";
    if (timeChip.textContent !== label) timeChip.textContent = label;
  }
}

// ---- movement (World 1's feel, ground-following from day one) ----
function eyeHeightForStance(stance) {
  return stance === "crouch" ? crouchEyeHeight : standingEyeHeight;
}

function updateLocal(dt) {
  if (!hasEntered) {
    motion.sprinting = false;
    motion.moving = false;
    input.jumpQueued = false;
    state.stance = "stand";
    return;
  }

  let forward = 0;
  let strafe = 0;
  const crouching = keys.has("ControlLeft") || keys.has("ControlRight") || keys.has("KeyC") || input.crouchHeld;

  if (keys.has("KeyW") || keys.has("ArrowUp")) forward += 1;
  if (keys.has("KeyS") || keys.has("ArrowDown")) forward -= 1;
  if (keys.has("KeyA") || keys.has("ArrowLeft")) strafe -= 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) strafe += 1;

  forward += input.moveY;
  strafe += input.moveX;

  const length = Math.hypot(forward, strafe);
  if (length > 1) {
    forward /= length;
    strafe /= length;
  }

  state.stance = crouching ? "crouch" : "stand";

  if (input.jumpQueued && motion.onGround && !crouching) {
    motion.verticalVelocity = jumpVelocity;
    motion.onGround = false;
  }
  input.jumpQueued = false;

  if (!motion.onGround) {
    motion.verticalVelocity -= gravity * dt;
    motion.airOffset += motion.verticalVelocity * dt;
    if (motion.airOffset <= 0) {
      motion.airOffset = 0;
      motion.verticalVelocity = 0;
      motion.onGround = true;
    }
  }

  const wantsSprint = (keys.has("ShiftLeft") || keys.has("ShiftRight")) && forward > 0 && !crouching && motion.onGround;
  motion.sprinting = wantsSprint;
  motion.moving = Math.abs(forward) + Math.abs(strafe) > 0.01;

  const speed = crouching ? 2.45 : wantsSprint ? 7.2 : 4.65;
  const sin = Math.sin(state.yaw);
  const cos = Math.cos(state.yaw);

  state.x += (cos * strafe + -sin * forward) * speed * dt;
  state.z += (-sin * strafe + -cos * forward) * speed * dt;

  resolveCollision();

  const eyeTarget = eyeHeightForStance(state.stance) + groundHeight(state.x, state.z) + motion.airOffset;
  state.y += (eyeTarget - state.y) * Math.min(1, dt * 14);
}

function resolveCollision() {
  state.x = Math.max(-worldBounds, Math.min(worldBounds, state.x));
  state.z = Math.max(-worldBounds, Math.min(worldBounds, state.z));

  for (const collider of buildingColliders) {
    const halfW = collider.width / 2 + playerRadius;
    const halfD = collider.depth / 2 + playerRadius;
    const dx = state.x - collider.x;
    const dz = state.z - collider.z;
    if (Math.abs(dx) >= halfW || Math.abs(dz) >= halfD) continue;
    const pushX = halfW - Math.abs(dx);
    const pushZ = halfD - Math.abs(dz);
    if (pushX < pushZ) state.x += dx < 0 ? -pushX : pushX;
    else state.z += dz < 0 ? -pushZ : pushZ;
  }
}

function look(deltaX, deltaY) {
  const sensitivity = 0.0023 * settings.sensitivity;
  const invert = settings.invertY ? -1 : 1;
  state.yaw -= deltaX * sensitivity;
  state.pitch -= deltaY * sensitivity * invert;
  state.pitch = Math.max(-1.25, Math.min(1.25, state.pitch));
}

function queueJump() {
  input.jumpQueued = true;
}

function updateCamera(dt) {
  if (!hasEntered) {
    previewAngle += dt * 0.085;
    const radius = 26;
    camera.position.set(Math.sin(previewAngle) * radius, 13.5, Math.cos(previewAngle) * radius);
    camera.lookAt(0, 1.2, 0);
    return;
  }
  camera.position.set(state.x, state.y, state.z);
  camera.rotation.y = state.yaw;
  camera.rotation.x = state.pitch;
}

// ---- frame loop ----
function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  updateLocal(dt);
  updateDayNight();
  updateCamera(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

// ---- enter flow ----
function enterWorld() {
  hasEntered = true;
  overlay.classList.add("hidden");
  goFullscreen();
  if (!isTouch) {
    try {
      const lockAttempt = canvas.requestPointerLock?.();
      lockAttempt?.catch?.(() => {});
    } catch (e) {
      // headless browsers / embedded webviews reject pointer lock
    }
  }
}

function goFullscreen() {
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen;
  if (req && !document.fullscreenElement) {
    try {
      const r = req.call(el);
      if (r && r.catch) r.catch(() => {});
    } catch (e) {}
  }
}

function clearMovementInput() {
  keys.clear();
  input.moveX = 0;
  input.moveY = 0;
  input.crouchHeld = false;
  input.jumpQueued = false;
  input.moveTouchId = null;
  input.touchLookId = null;
  if (moveKnob) moveKnob.style.transform = "translate(-50%, -50%)";
}

// ---- input wiring ----
enterButton.addEventListener("click", enterWorld);

canvas.addEventListener("click", () => {
  if (!isTouch && hasEntered && document.pointerLockElement !== canvas) {
    try {
      const lockAttempt = canvas.requestPointerLock?.();
      lockAttempt?.catch?.(() => {});
    } catch (e) {}
  }
});

document.addEventListener("pointerlockchange", () => {
  if (document.pointerLockElement !== canvas) clearMovementInput();
});

document.addEventListener("mousemove", (event) => {
  if (document.pointerLockElement !== canvas) return;
  look(event.movementX, event.movementY);
});

document.addEventListener("keydown", (event) => {
  const t = event.target;
  if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
  if (!hasEntered && (event.code === "Enter" || event.code === "Space")) {
    event.preventDefault();
    enterWorld();
    return;
  }
  if (hasEntered && (event.code === "ArrowUp" || event.code === "ArrowDown" || event.code === "ArrowLeft" || event.code === "ArrowRight")) {
    event.preventDefault();
  }
  keys.add(event.code);
  if (event.code === "Space") {
    event.preventDefault();
    queueJump();
  }
});

document.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

canvas.addEventListener("pointerdown", (event) => {
  if (!isTouch || event.clientX < window.innerWidth * 0.35) return;
  input.touchLookId = event.pointerId;
  input.touchLookX = event.clientX;
  input.touchLookY = event.clientY;
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener("pointermove", (event) => {
  if (event.pointerId !== input.touchLookId) return;
  look((event.clientX - input.touchLookX) * 2.4, (event.clientY - input.touchLookY) * 2.4);
  input.touchLookX = event.clientX;
  input.touchLookY = event.clientY;
});

function endTouchLook(event) {
  if (event.pointerId === input.touchLookId) input.touchLookId = null;
}
canvas.addEventListener("pointerup", endTouchLook);
canvas.addEventListener("pointercancel", endTouchLook);

function updateMovePad(event) {
  const rect = movePad.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const maxRadius = rect.width * 0.36;
  const dx = event.clientX - centerX;
  const dy = event.clientY - centerY;
  const length = Math.min(maxRadius, Math.hypot(dx, dy));
  const angle = Math.atan2(dy, dx);
  const knobX = Math.cos(angle) * length;
  const knobY = Math.sin(angle) * length;
  input.moveX = knobX / maxRadius;
  input.moveY = -knobY / maxRadius;
  moveKnob.style.transform = `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`;
}

function resetMovePad(event) {
  if (event.pointerId !== input.moveTouchId) return;
  input.moveTouchId = null;
  input.moveX = 0;
  input.moveY = 0;
  moveKnob.style.transform = "translate(-50%, -50%)";
}

movePad.addEventListener("pointerdown", (event) => {
  input.moveTouchId = event.pointerId;
  movePad.setPointerCapture(event.pointerId);
  updateMovePad(event);
});
movePad.addEventListener("pointermove", (event) => {
  if (event.pointerId === input.moveTouchId) updateMovePad(event);
});
movePad.addEventListener("pointerup", resetMovePad);
movePad.addEventListener("pointercancel", resetMovePad);

jumpButton.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  queueJump();
});
crouchButton.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  input.crouchHeld = true;
});
crouchButton.addEventListener("pointerup", () => { input.crouchHeld = false; });
crouchButton.addEventListener("pointercancel", () => { input.crouchHeld = false; });

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener("blur", clearMovementInput);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) clearMovementInput();
});

// ---- BOOT (end of file by design: every const/let above is initialized before these run — TDZ law) ----
buildWorld();
animate();
