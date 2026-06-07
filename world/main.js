import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.module.js";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const canvas = document.querySelector("#game");
const overlay = document.querySelector("#overlay");
const enterButton = document.querySelector("#enterButton");
const statusEl = document.querySelector("#status");
const playerCountEl = document.querySelector("#playerCount");
const rttEl = document.querySelector("#rtt");
const identityEl = document.querySelector("#identity");
const placeEl = document.querySelector("#place");
const menuButton = document.querySelector("#menuButton");
const rosterEl = document.querySelector("#roster");
const doorPrompt = document.querySelector("#doorPrompt");
const doorPromptText = document.querySelector("#doorPromptText");
const doorPromptButton = document.querySelector("#doorPromptButton");
const feed = document.querySelector("#feed");
const settingsPanel = document.querySelector("#settingsPanel");
const closeSettingsButton = document.querySelector("#closeSettingsButton");
const leaveTownButton = document.querySelector("#leaveTownButton");
const sensitivitySlider = document.querySelector("#sensitivitySlider");
const fovSlider = document.querySelector("#fovSlider");
const invertYToggle = document.querySelector("#invertYToggle");
const rosterToggle = document.querySelector("#rosterToggle");
const movePad = document.querySelector("#movePad");
const moveKnob = document.querySelector("#moveKnob");
const actionButton = document.querySelector("#actionButton");
const jumpButton = document.querySelector("#jumpButton");
const crouchButton = document.querySelector("#crouchButton");
const welcomeName = document.querySelector("#welcomeName");

const params = new URLSearchParams(location.search);
const displayName = sanitizeDisplayName(params.get("name"));
const isTouch = matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;

// ---- Supabase realtime transport (replaces the old WebSocket server) ----
const SUPA_URL = "https://ygjpnvrwhkrowkrskftk.supabase.co";
const SUPA_KEY = "sb_publishable_Y-duV64ayMMEvVwMs5PWuw_6kvzbOrN";
const peerColors = ["#4fa3ff", "#5fd38d", "#f6b45b", "#e36d7c", "#a67cff", "#47c7b8", "#f0d461", "#d987e8"];
const myId = crypto.randomUUID().slice(0, 8);
const myColor = peerColors[Math.floor(Math.random() * peerColors.length)];
let supa = null;
let channel = null;
let connected = false;

let sendAccumulator = 0;
let hasEntered = false;
let settingsOpen = false;
let wantsConnection = true;
let activeDoor = null;

const keys = new Set();
const remotes = new Map();
const peers = new Map();
let latestPlayers = [];

const state = {
  x: 0,
  y: 1.65,
  z: 8,
  yaw: 0,
  pitch: 0,
  stance: "stand"
};

const input = {
  moveX: 0,
  moveY: 0,
  crouchHeld: false,
  jumpQueued: false,
  touchLookId: null,
  touchLookX: 0,
  touchLookY: 0,
  moveTouchId: null
};

const settings = {
  sensitivity: 1,
  fov: 74,
  invertY: false,
  showRoster: true
};

const motion = {
  verticalOffset: 0,
  verticalVelocity: 0,
  onGround: true,
  sprinting: false,
  moving: false
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xb8d3df);
scene.fog = new THREE.Fog(0xb8d3df, 34, 68);

const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.08, 120);
camera.rotation.order = "YXZ";

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance"
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;

const clock = new THREE.Clock();
const worldBounds = 17.5;
const playerRadius = 0.35;
const standingEyeHeight = 1.65;
const crouchEyeHeight = 1.15;
const gravity = 17.5;
const jumpVelocity = 6.4;

const buildingColliders = [];

const doors = [
  {
    id: "social",
    label: "Social",
    path: "/social",
    x: -9.2,
    z: -7.6,
    width: 4.9,
    depth: 4.1,
    height: 2.75,
    body: 0xc86f65,
    roof: 0x823f47,
    sign: 0xffefe6,
    front: "south"
  },
  {
    id: "projects",
    label: "Projects",
    path: "/projects",
    x: 9.2,
    z: -7.6,
    width: 5.1,
    depth: 4.1,
    height: 2.9,
    body: 0xd8bd73,
    roof: 0x6f7c42,
    sign: 0x173322,
    front: "south"
  },
  {
    id: "games",
    label: "Games",
    path: "/games",
    x: -9.2,
    z: 5.9,
    width: 4.8,
    depth: 4.2,
    height: 2.65,
    body: 0x73a5d8,
    roof: 0x2f5f8f,
    sign: 0xf4fbff,
    front: "north"
  }
];

const plots = [
  { x: 0, z: -9.8, width: 5.2, depth: 3.3 },
  { x: -13.2, z: 0, width: 3.7, depth: 5.1 },
  { x: 13.2, z: 0, width: 3.7, depth: 5.1 },
  { x: 9.2, z: 5.9, width: 4.6, depth: 4.2 }
];

scene.add(camera);
identityEl.textContent = displayName;
welcomeName.textContent = displayName;
actionButton.disabled = true;
buildTown();
connect();
animate();

enterButton.addEventListener("click", enterTown);
menuButton.addEventListener("click", () => toggleSettings(true));
closeSettingsButton.addEventListener("click", () => toggleSettings(false));
leaveTownButton.addEventListener("click", leaveTown);
doorPromptButton.addEventListener("click", enterActiveDoor);
actionButton.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  enterActiveDoor();
});

sensitivitySlider.addEventListener("input", () => {
  settings.sensitivity = Number(sensitivitySlider.value);
});

fovSlider.addEventListener("input", () => {
  settings.fov = Number(fovSlider.value);
  camera.fov = settings.fov;
  camera.updateProjectionMatrix();
});

invertYToggle.addEventListener("change", () => {
  settings.invertY = invertYToggle.checked;
});

rosterToggle.addEventListener("change", () => {
  settings.showRoster = rosterToggle.checked;
  renderRoster();
});

canvas.addEventListener("click", () => {
  if (!isTouch && !settingsOpen && document.pointerLockElement !== canvas) enterTown();
});

document.addEventListener("pointerlockchange", () => {
  overlay.classList.toggle("hidden", hasEntered || document.pointerLockElement === canvas || isTouch);
  if (document.pointerLockElement !== canvas) {
    clearMovementInput();
  }
});

document.addEventListener("mousemove", (event) => {
  if (settingsOpen || document.pointerLockElement !== canvas) return;
  look(event.movementX, event.movementY);
});

document.addEventListener("keydown", (event) => {
  if (event.code === "KeyP" || event.code === "KeyM") {
    event.preventDefault();
    toggleSettings(!settingsOpen);
    return;
  }

  if (event.code === "Escape") {
    event.preventDefault();
    toggleSettings(!settingsOpen);
    return;
  }

  if (settingsOpen) return;

  if (event.code === "KeyE" || event.code === "Enter") {
    if (activeDoor) {
      event.preventDefault();
      enterActiveDoor();
      return;
    }
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
  if (!isTouch || settingsOpen || event.clientX < window.innerWidth * 0.35) return;
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

canvas.addEventListener("pointerup", endTouchLook);
canvas.addEventListener("pointercancel", endTouchLook);

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

crouchButton.addEventListener("pointerup", () => {
  input.crouchHeld = false;
});

crouchButton.addEventListener("pointercancel", () => {
  input.crouchHeld = false;
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener("blur", clearMovementInput);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) clearMovementInput();
});

function enterTown() {
  if (settingsOpen) return;
  hasEntered = true;
  wantsConnection = true;
  if (!channel) connect();
  overlay.classList.add("hidden");
  if (!isTouch) {
    try {
      const lockAttempt = canvas.requestPointerLock?.();
      lockAttempt?.catch?.(() => {});
    } catch {
      // Headless browsers and some embedded webviews reject pointer lock.
    }
  }
}

function toggleSettings(open) {
  settingsOpen = open;
  settingsPanel.classList.toggle("hidden", !settingsOpen);
  if (settingsOpen) {
    clearMovementInput();
    if (document.pointerLockElement) {
      document.exitPointerLock?.();
    }
  }
}

function leaveTown() {
  wantsConnection = false;
  hasEntered = false;
  toggleSettings(false);
  clearMovementInput();
  overlay.classList.remove("hidden");
  setStatus("left", false);
  latestPlayers = [];
  renderRoster();
  clearWorldActors();

  if (channel) {
    try { channel.untrack(); } catch {}
    try { supa.removeChannel(channel); } catch {}
    channel = null;
    connected = false;
  }
}

function connect() {
  if (!wantsConnection) return;
  if (channel) return;

  setStatus("connecting", false);
  if (!supa) {
    supa = createClient(SUPA_URL, SUPA_KEY, {
      realtime: { params: { eventsPerSecond: 24 } }
    });
  }

  channel = supa.channel("engine-town", {
    config: {
      presence: { key: myId },
      broadcast: { self: false }
    }
  });

  channel.on("broadcast", { event: "state" }, ({ payload }) => applyPeerState(payload));

  channel.on("presence", { event: "sync" }, () => syncPresence());

  channel.on("presence", { event: "join" }, ({ newPresences }) => {
    for (const p of newPresences || []) {
      if (p.id && p.id !== myId) addFeed(`${p.name || "Guest"} joined`);
    }
  });

  channel.on("presence", { event: "leave" }, ({ leftPresences }) => {
    for (const p of leftPresences || []) {
      if (p.id && p.id !== myId) {
        removeRemote(p.id);
        peers.delete(p.id);
        addFeed(`${p.name || "Guest"} left`);
      }
    }
  });

  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      connected = true;
      setStatus("online", true);
      rttEl.textContent = "realtime";
      channel.track({ id: myId, name: displayName, color: myColor });
      addFeed(`joined as ${displayName}`);
      sendState(true);
    } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      connected = false;
      setStatus("offline", false);
    } else if (status === "CLOSED") {
      connected = false;
    }
  });
}

function applyPeerState(player) {
  if (!player || !player.id || player.id === myId) return;
  peers.set(player.id, player);

  let remote = remotes.get(player.id);
  if (!remote) {
    remote = createRemote(player);
    remotes.set(player.id, remote);
    scene.add(remote.group);
  }

  remote.target.set(player.x, remoteGroundY(player), player.z);
  remote.targetYaw = player.yaw;
  remote.targetScaleY = player.stance === "crouch" ? 0.72 : 1;
}

function syncPresence() {
  if (!channel) return;
  const presenceState = channel.presenceState();
  const present = new Map();

  for (const key in presenceState) {
    const metas = presenceState[key];
    if (metas && metas[0]) {
      const meta = metas[0];
      present.set(meta.id || key, meta);
    }
  }

  // Drop characters whose people are no longer present.
  for (const id of [...remotes.keys()]) {
    if (!present.has(id)) {
      removeRemote(id);
      peers.delete(id);
    }
  }

  // Roster + count: self first, then everyone else who is present.
  const list = [{ id: myId, name: displayName, color: myColor }];
  for (const [id, meta] of present) {
    if (id !== myId) list.push({ id, name: meta.name || "Guest", color: meta.color || "#8aa0a8" });
  }
  latestPlayers = list;
  playerCountEl.textContent = `${list.length} player${list.length === 1 ? "" : "s"}`;
  renderRoster();
}

function sendState(force = false) {
  if (!connected || !channel) return;
  if (!force && sendAccumulator < 0.05) return;

  sendAccumulator = 0;
  channel.send({
    type: "broadcast",
    event: "state",
    payload: {
      id: myId,
      name: displayName,
      color: myColor,
      x: state.x,
      y: state.y,
      z: state.z,
      yaw: state.yaw,
      pitch: state.pitch,
      stance: state.stance
    }
  });
}

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  sendAccumulator += dt;

  updateLocal(dt);
  updateCamera();
  updateRemotes(dt);
  updateHud();
  sendState();

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

function updateLocal(dt) {
  if (!hasEntered || settingsOpen) {
    motion.sprinting = false;
    motion.moving = false;
    input.jumpQueued = false;
    state.stance = "stand";
    updateActiveDoor();
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
    motion.verticalOffset += motion.verticalVelocity * dt;
    if (motion.verticalOffset <= 0) {
      motion.verticalOffset = 0;
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
  const forwardX = -sin;
  const forwardZ = -cos;
  const rightX = cos;
  const rightZ = -sin;

  state.x += (rightX * strafe + forwardX * forward) * speed * dt;
  state.z += (rightZ * strafe + forwardZ * forward) * speed * dt;

  resolveCollision();
  updateActiveDoor();

  const eyeTarget = eyeHeightForStance(state.stance) + motion.verticalOffset;
  state.y += (eyeTarget - state.y) * Math.min(1, dt * 14);
}

function updateCamera() {
  camera.position.set(state.x, state.y, state.z);
  camera.rotation.y = state.yaw;
  camera.rotation.x = state.pitch;
}

function updateRemotes(dt) {
  const blend = Math.min(1, dt * 12);
  for (const remote of remotes.values()) {
    remote.group.position.lerp(remote.target, blend);
    remote.group.rotation.y = lerpAngle(remote.group.rotation.y, remote.targetYaw, blend);
    remote.group.scale.y += (remote.targetScaleY - remote.group.scale.y) * blend;
  }
}

function updateHud() {
  placeEl.textContent = activeDoor ? activeDoor.label : "Town Square";
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

function updateActiveDoor() {
  let nextDoor = null;
  let bestDistance = Infinity;

  for (const door of doors) {
    const trigger = door.trigger;
    const dx = state.x - trigger.x;
    const dz = state.z - trigger.z;
    if (Math.abs(dx) > trigger.width / 2 || Math.abs(dz) > trigger.depth / 2) continue;

    const distance = Math.hypot(dx, dz);
    if (distance < bestDistance) {
      bestDistance = distance;
      nextDoor = door;
    }
  }

  if (activeDoor === nextDoor) return;
  activeDoor = nextDoor;

  for (const door of doors) {
    door.pad.material.emissiveIntensity = door === activeDoor ? 0.38 : 0.08;
  }

  if (activeDoor) {
    doorPrompt.classList.remove("hidden");
    doorPromptText.textContent = isTouch
      ? `Enter ${activeDoor.label}`
      : `Press E for ${activeDoor.label}`;
    actionButton.disabled = false;
  } else {
    doorPrompt.classList.add("hidden");
    actionButton.disabled = true;
  }
}

function enterActiveDoor() {
  if (!activeDoor) return;
  const target = window.top || window;
  target.location.assign(activeDoor.path);
}

function buildTown() {
  scene.add(new THREE.HemisphereLight(0xe5f6ff, 0x5b5f4b, 1.35));

  const sun = new THREE.DirectionalLight(0xfff6e8, 2.1);
  sun.position.set(8, 14, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -24;
  sun.shadow.camera.right = 24;
  sun.shadow.camera.top = 24;
  sun.shadow.camera.bottom = -24;
  scene.add(sun);

  const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x6fa46e,
    roughness: 0.92
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(38, 38), groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  addGroundRect(0, 0, 5.2, 35, 0xb9aa88);
  addGroundRect(0, 0, 35, 5.2, 0xb9aa88);
  addGroundRect(0, 0, 8.2, 8.2, 0xc7bc9b);

  const fountainBase = new THREE.Mesh(
    new THREE.CylinderGeometry(1.25, 1.45, 0.32, 28),
    new THREE.MeshStandardMaterial({ color: 0x7f9294, roughness: 0.7 })
  );
  fountainBase.position.set(0, 0.16, 0);
  fountainBase.castShadow = true;
  fountainBase.receiveShadow = true;
  scene.add(fountainBase);

  const fountainWater = new THREE.Mesh(
    new THREE.CylinderGeometry(1.08, 1.08, 0.08, 28),
    new THREE.MeshStandardMaterial({
      color: 0x66bdd1,
      roughness: 0.28,
      metalness: 0.02,
      transparent: true,
      opacity: 0.82
    })
  );
  fountainWater.position.set(0, 0.36, 0);
  scene.add(fountainWater);

  const wallMaterial = new THREE.MeshStandardMaterial({
    color: 0x586a5f,
    roughness: 0.82
  });
  addBox(0, 1, -18, 36, 2, 0.5, wallMaterial);
  addBox(0, 1, 18, 36, 2, 0.5, wallMaterial);
  addBox(-18, 1, 0, 0.5, 2, 36, wallMaterial);
  addBox(18, 1, 0, 0.5, 2, 36, wallMaterial);

  for (const door of doors) {
    buildDoorBuilding(door);
  }

  for (const plot of plots) {
    buildPlot(plot);
  }

  addBench(-3.5, 2.9, Math.PI / 2);
  addBench(3.5, -2.9, -Math.PI / 2);
  addTree(-14, -12);
  addTree(14, -12);
  addTree(-14, 12);
  addTree(14, 12);
}

function buildDoorBuilding(door) {
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: door.body,
    roughness: 0.76
  });
  const roofMaterial = new THREE.MeshStandardMaterial({
    color: door.roof,
    roughness: 0.68
  });
  const doorMaterial = new THREE.MeshStandardMaterial({
    color: 0x2f302a,
    roughness: 0.64
  });
  const padMaterial = new THREE.MeshStandardMaterial({
    color: door.sign,
    roughness: 0.52,
    emissive: door.sign,
    emissiveIntensity: 0.08
  });

  addBox(door.x, door.height / 2, door.z, door.width, door.height, door.depth, bodyMaterial);
  addBox(door.x, door.height + 0.28, door.z, door.width + 0.55, 0.56, door.depth + 0.55, roofMaterial);

  const frontSign = door.front === "south" ? 1 : -1;
  const faceZ = door.z + frontSign * (door.depth / 2 + 0.035);
  const triggerZ = door.z + frontSign * (door.depth / 2 + 0.95);
  const entranceZ = door.z + frontSign * (door.depth / 2 + 0.52);

  addBox(door.x, 0.78, faceZ, 1.08, 1.56, 0.08, doorMaterial);
  door.pad = addBox(door.x, 0.035, entranceZ, 2.05, 0.07, 1.0, padMaterial);
  door.trigger = {
    x: door.x,
    z: triggerZ,
    width: 2.4,
    depth: 1.9
  };

  const label = createLabelSprite(door.label, {
    background: "rgba(13, 18, 20, 0.74)",
    foreground: "#f9fbf6",
    fontSize: 42,
    scale: 0.018
  });
  label.position.set(door.x, door.height + 1.08, door.z);
  scene.add(label);

  buildingColliders.push({
    x: door.x,
    z: door.z,
    width: door.width,
    depth: door.depth
  });
}

function buildPlot(plot) {
  const fillMaterial = new THREE.MeshStandardMaterial({
    color: 0x8bae78,
    roughness: 0.9
  });
  const railMaterial = new THREE.MeshStandardMaterial({
    color: 0xf1d07a,
    roughness: 0.62
  });

  addBox(plot.x, 0.025, plot.z, plot.width, 0.05, plot.depth, fillMaterial);
  addBox(plot.x, 0.09, plot.z - plot.depth / 2, plot.width, 0.18, 0.12, railMaterial);
  addBox(plot.x, 0.09, plot.z + plot.depth / 2, plot.width, 0.18, 0.12, railMaterial);
  addBox(plot.x - plot.width / 2, 0.09, plot.z, 0.12, 0.18, plot.depth, railMaterial);
  addBox(plot.x + plot.width / 2, 0.09, plot.z, 0.12, 0.18, plot.depth, railMaterial);

  const signPost = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 1.15, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x64513a, roughness: 0.8 })
  );
  signPost.position.set(plot.x, 0.58, plot.z);
  signPost.castShadow = true;
  scene.add(signPost);

  const label = createLabelSprite("Your space here", {
    background: "rgba(20, 28, 24, 0.78)",
    foreground: "#fff5d6",
    fontSize: 34,
    scale: 0.015
  });
  label.position.set(plot.x, 1.55, plot.z);
  scene.add(label);
}

function addGroundRect(x, z, width, depth, color) {
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.88
  });
  const rect = new THREE.Mesh(new THREE.BoxGeometry(width, 0.04, depth), material);
  rect.position.set(x, 0.025, z);
  rect.receiveShadow = true;
  scene.add(rect);
}

function addBench(x, z, rotationY) {
  const seatMaterial = new THREE.MeshStandardMaterial({ color: 0x8d6243, roughness: 0.78 });
  const legMaterial = new THREE.MeshStandardMaterial({ color: 0x3d433d, roughness: 0.7 });
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = rotationY;

  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.18, 0.42), seatMaterial);
  seat.position.y = 0.56;
  seat.castShadow = true;
  group.add(seat);

  const back = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.5, 0.16), seatMaterial);
  back.position.set(0, 0.88, 0.25);
  back.castShadow = true;
  group.add(back);

  for (const lx of [-0.7, 0.7]) {
    for (const lz of [-0.14, 0.14]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.12), legMaterial);
      leg.position.set(lx, 0.29, lz);
      leg.castShadow = true;
      group.add(leg);
    }
  }

  scene.add(group);
}

function addTree(x, z) {
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.24, 1.25, 10),
    new THREE.MeshStandardMaterial({ color: 0x745339, roughness: 0.85 })
  );
  trunk.position.set(x, 0.62, z);
  trunk.castShadow = true;
  scene.add(trunk);

  const leaves = new THREE.Mesh(
    new THREE.ConeGeometry(1.0, 2.25, 12),
    new THREE.MeshStandardMaterial({ color: 0x3f7c50, roughness: 0.82 })
  );
  leaves.position.set(x, 2.05, z);
  leaves.castShadow = true;
  scene.add(leaves);
}

function addBox(x, y, z, width, height, depth, material) {
  const box = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  box.position.set(x, y, z);
  box.castShadow = true;
  box.receiveShadow = true;
  scene.add(box);
  return box;
}

function createRemote(player) {
  const color = new THREE.Color(player.color || "#8aa0a8");
  const group = new THREE.Group();
  group.position.set(player.x, remoteGroundY(player), player.z);
  group.scale.y = player.stance === "crouch" ? 0.72 : 1;
  group.rotation.y = player.yaw;

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.56,
    metalness: 0.02
  });
  const darkMaterial = new THREE.MeshStandardMaterial({
    color: 0x172024,
    roughness: 0.82
  });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 1.12, 14), bodyMaterial);
  body.position.y = 0.75;
  body.castShadow = true;
  group.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), bodyMaterial);
  head.position.y = 1.46;
  head.castShadow = true;
  group.add(head);

  const face = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.045), darkMaterial);
  face.position.set(0, 1.48, -0.245);
  group.add(face);

  const label = createLabelSprite(player.name || "Guest", {
    background: "rgba(11, 16, 18, 0.72)",
    foreground: "#ffffff",
    fontSize: 34,
    scale: 0.0085
  });
  label.position.set(0, 2.02, 0);
  group.add(label);

  return {
    group,
    target: new THREE.Vector3(player.x, remoteGroundY(player), player.z),
    targetYaw: player.yaw,
    targetScaleY: player.stance === "crouch" ? 0.72 : 1
  };
}

function removeRemote(id) {
  const remote = remotes.get(id);
  if (!remote) return;

  scene.remove(remote.group);
  disposeObject(remote.group);
  remotes.delete(id);
}

function clearWorldActors() {
  for (const id of [...remotes.keys()]) removeRemote(id);
  peers.clear();
  playerCountEl.textContent = "0 players";
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

    if (pushX < pushZ) {
      state.x += dx < 0 ? -pushX : pushX;
    } else {
      state.z += dz < 0 ? -pushZ : pushZ;
    }
  }
}

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

function clearMovementInput() {
  keys.clear();
  input.moveX = 0;
  input.moveY = 0;
  input.crouchHeld = false;
  input.jumpQueued = false;
  input.moveTouchId = null;
  input.touchLookId = null;
  moveKnob.style.transform = "translate(-50%, -50%)";
  motion.sprinting = false;
  motion.moving = false;
}

function endTouchLook(event) {
  if (event.pointerId === input.touchLookId) {
    input.touchLookId = null;
  }
}

function renderRoster() {
  rosterEl.classList.toggle("hidden", !settings.showRoster);
  rosterEl.classList.toggle("force-show", settings.showRoster);
  if (!settings.showRoster) {
    rosterEl.replaceChildren();
    return;
  }

  const ordered = [...latestPlayers].sort((a, b) => {
    if (a.id === myId) return -1;
    if (b.id === myId) return 1;
    return (a.name || "").localeCompare(b.name || "");
  });
  const fragment = document.createDocumentFragment();

  for (const player of ordered) {
    const row = document.createElement("div");
    row.className = `player-row${player.id === myId ? " self" : ""}`;

    const color = document.createElement("span");
    color.className = "player-color";
    color.style.background = player.color;

    const name = document.createElement("span");
    name.className = "player-name";
    name.textContent = player.id === myId ? `${player.name} (you)` : player.name;

    row.append(color, name);
    fragment.append(row);
  }

  rosterEl.replaceChildren(fragment);
}

function createLabelSprite(text, options = {}) {
  const fontSize = options.fontSize ?? 36;
  const fontWeight = options.fontWeight ?? 800;
  const paddingX = options.paddingX ?? 20;
  const paddingY = options.paddingY ?? 10;
  const foreground = options.foreground ?? "#ffffff";
  const background = options.background ?? "rgba(12, 18, 22, 0.78)";
  const scale = options.scale ?? 0.01;
  const dpr = 2;

  const measure = document.createElement("canvas").getContext("2d");
  measure.font = `${fontWeight} ${fontSize}px Inter, system-ui, sans-serif`;
  const measuredWidth = Math.ceil(measure.measureText(text).width);
  const width = measuredWidth + paddingX * 2;
  const height = fontSize + paddingY * 2;
  const canvasLabel = document.createElement("canvas");
  canvasLabel.width = width * dpr;
  canvasLabel.height = height * dpr;

  const context = canvasLabel.getContext("2d");
  context.scale(dpr, dpr);
  context.font = `${fontWeight} ${fontSize}px Inter, system-ui, sans-serif`;
  context.textBaseline = "middle";
  context.textAlign = "center";

  drawRoundRect(context, 0, 0, width, height, Math.min(14, height / 3), background);
  context.fillStyle = foreground;
  context.fillText(text, width / 2, height / 2 + 1);

  const texture = new THREE.CanvasTexture(canvasLabel);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(width * scale, height * scale, 1);
  sprite.userData.texture = texture;
  return sprite;
}

function drawRoundRect(context, x, y, width, height, radius, fillStyle) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
  context.fillStyle = fillStyle;
  context.fill();
}

function eyeHeightForStance(stance) {
  return stance === "crouch" ? crouchEyeHeight : standingEyeHeight;
}

function remoteGroundY(player) {
  return Math.max(0, player.y - eyeHeightForStance(player.stance));
}

function disposeObject(object) {
  object.traverse((child) => {
    if (child.isSprite) {
      child.userData.texture?.dispose?.();
      child.material?.dispose?.();
      return;
    }

    if (!child.isMesh) return;
    child.geometry?.dispose();
    if (Array.isArray(child.material)) {
      for (const material of child.material) material.dispose?.();
    } else {
      child.material?.dispose?.();
    }
  });
}

function setStatus(text, online) {
  statusEl.textContent = text;
  statusEl.classList.toggle("online", online);
  statusEl.classList.toggle("offline", !online);
}

function addFeed(text) {
  const item = document.createElement("div");
  item.className = "feed-item";
  item.textContent = text;
  feed.prepend(item);
  while (feed.children.length > 5) feed.lastElementChild.remove();
  window.setTimeout(() => item.remove(), 4200);
}

function lerpAngle(from, to, amount) {
  const delta = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + delta * amount;
}

function sanitizeDisplayName(value) {
  const raw = typeof value === "string" ? value : "";
  const normalized = raw.trim().replace(/\s+/g, " ");
  const visible = normalized.replace(/[^\p{L}\p{N} _.'-]/gu, "").slice(0, 24).trim();
  return visible || "Guest";
}
