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
const removeHomeButton = document.querySelector("#removeHomeButton");
const sensitivitySlider = document.querySelector("#sensitivitySlider");
const fovSlider = document.querySelector("#fovSlider");
const invertYToggle = document.querySelector("#invertYToggle");
const rosterToggle = document.querySelector("#rosterToggle");
const colorSwatches = document.querySelector("#colorSwatches");
const patternButtons = document.querySelector("#patternButtons");
const bodyButtons = document.querySelector("#bodyButtons");
const bodyTypeButtons = document.querySelector("#bodyTypeButtons");
const skinSwatches = document.querySelector("#skinSwatches");
const hairSwatches = document.querySelector("#hairSwatches");
const pantsSwatches = document.querySelector("#pantsSwatches");
const appearanceStatus = document.querySelector("#appearanceStatus");
const movePad = document.querySelector("#movePad");
const moveKnob = document.querySelector("#moveKnob");
const actionButton = document.querySelector("#actionButton");
const jumpButton = document.querySelector("#jumpButton");
const crouchButton = document.querySelector("#crouchButton");
const throwButton = document.querySelector("#throwButton");
const welcomeName = document.querySelector("#welcomeName");

const params = new URLSearchParams(location.search);
let displayName = sanitizeDisplayName(params.get("name"));
const hintedUserId = params.get("uid");
const requestedVisitorKind = /^(ai|ai-visitor)$/i.test(params.get("visitor") || params.get("kind") || "")
  ? "ai-visitor"
  : "guest";
const isTouch = matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;

// ---- Supabase realtime transport (replaces the old WebSocket server) ----
const SUPA_URL = "https://ygjpnvrwhkrowkrskftk.supabase.co";
const SUPA_KEY = "sb_publishable_Y-duV64ayMMEvVwMs5PWuw_6kvzbOrN";
const peerColors = ["#4fa3ff", "#5fd38d", "#f6b45b", "#e36d7c", "#a67cff", "#47c7b8", "#f0d461", "#d987e8"];
const appearancePatterns = new Set(["plain", "stripe", "band", "glow"]);
let myId = null;
let myUserId = null;
let isAdmin = false;
let guestId = null;
let visitorKind = "resident";
let myColor = peerColors[0];
let myAppearance = { color: myColor, pattern: "plain" };
let supa = null;
let channel = null;
let connected = false;
let wantsSelfPresence = true;
let appearanceSaveTimer = null;

let sendAccumulator = 0;
let hasEntered = false;
let settingsOpen = false;
let buildMode = false;
let selectedBuildProp = null;
let placeRot = 0;
let buildPreview = null;
let _pvX = null, _pvZ = null, _pvRot = null, _pvType = null;
let sunLight = null, sunDisc = null, hemiLight = null;
let stars = null, moonDisc = null;
let dayClock = 120;
const HB_DAY = new THREE.Color(0xb8d3df);
const HB_DUSK = new THREE.Color(0xe89b5a);
const HB_NIGHT = new THREE.Color(0x0f1b2e);
let heldItem = null;
let viewmodel = null;
let inArena = false;
let preArenaHeld = null;
let arenaTargets = [];
let arenaScore = 0;
let arenaScoreEl = null;
let arenaLight = null;
let tagScore = 0;
let outScore = 0;
let scoreboardEl = null;
let lastBoardRender = 0;
const PAINT_COLORS = [0xe23b4e, 0x36d07a, 0x4a86e8, 0xf2c94c, 0xb24ae8];
const _vmOff = new THREE.Vector3();
const projectiles = [];
const snowPuffs = [];
const paintSplats = [];
let lastThrow = 0;
let propsLoaded = false;
let wantsConnection = true;
let activeDoor = null;
let surfaceStatus = {};
let activePlot = null;
let activeMind = null;
let pseudoOn = false;
const plotList = [];
let spacesLoaded = false;
let charactersLoaded = false;
let previewAngle = -0.55;

const keys = new Set();
const remotes = new Map();
const peers = new Map();
const mindActors = new Map();
const npcs = new Map();
const characters = new Map();
let mindsLoaded = false;
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
const worldBounds = 56;
const playerRadius = 0.35;
const standingEyeHeight = 1.65;
const crouchEyeHeight = 1.15;
const gravity = 17.5;
const jumpVelocity = 6.4;

const buildingColliders = [];
const solidBlockers = [];
const platforms = [];
const placedProps = [];

const doors = [
  {
    id: "social",
    surface: "social",
    label: "Social",
    path: "/social",
    x: -16,
    z: -13,
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
    surface: "host",
    label: "Projects",
    path: "/projects",
    x: 16,
    z: -13,
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
    surface: "games",
    label: "Games",
    path: "/games",
    x: -16,
    z: 10,
    width: 4.8,
    depth: 4.2,
    height: 2.65,
    body: 0x73a5d8,
    roof: 0x2f5f8f,
    sign: 0xf4fbff,
    front: "north"
  },
  {
    id: "video",
    surface: "video",
    label: "Theater",
    path: "/video",
    x: 9,
    z: -18.6,
    width: 5.0,
    depth: 4.0,
    height: 2.85,
    body: 0x5f8f7a,
    roof: 0x32503f,
    sign: 0xeafff4,
    front: "south"
  }
];

const plots = [
  { x: -8, z: 18, width: 4.2, depth: 3.4 },
  { x: 8, z: 18, width: 4.2, depth: 3.4 },
  { x: -24, z: -10, width: 4.2, depth: 3.4 },
  { x: 24, z: -10, width: 4.2, depth: 3.4 },
  { x: -24, z: 10, width: 4.2, depth: 3.4 },
  { x: 24, z: 10, width: 4.2, depth: 3.4 },
  { x: -20, z: -27.4, width: 4.2, depth: 3.4 },
  { x: -12, z: -27.4, width: 4.2, depth: 3.4 },
  { x: -4, z: -27.4, width: 4.2, depth: 3.4 },
  { x: 4, z: -27.4, width: 4.2, depth: 3.4 },
  { x: 12, z: -27.4, width: 4.2, depth: 3.4 },
  { x: 20, z: -27.4, width: 4.2, depth: 3.4 }
];

const structures = [
  { id: "workshop", label: "Workshop", x: 16, z: 10, width: 5.2, depth: 4.3, height: 3.05, body: 0x6e65a8, roof: 0x3f345f, windows: false, face: "north" },
  { id: "apt-w", label: "Apartments", x: -25, z: 0, width: 3.8, depth: 6.6, height: 5.0, body: 0x7d8a93, roof: 0x495159, windows: true, face: "east", room: true },
  { id: "apt-e", label: "Apartments", x: 25, z: 0, width: 3.8, depth: 6.6, height: 5.0, body: 0x7d8a93, roof: 0x495159, windows: true, face: "west", room: true }
];

const doorStructures = [];

scene.add(camera);
identityEl.textContent = displayName;
welcomeName.textContent = displayName;
actionButton.disabled = true;
renderAppearanceControls();
buildTown();
initWorld();
// ---- room + nudge state (must exist before animate() starts the render loop) ----
const nudgeShown = { ghost: false, plot: false };
try {
  if (localStorage.getItem("hb_nudge_ghost") === "1") nudgeShown.ghost = true;
  if (localStorage.getItem("hb_nudge_plot") === "1") nudgeShown.plot = true;
} catch (e) {}
let nudgeEl = null;
let nudgeTimer = null;
let inRoom = false;
let roomGroup = null;
let savedTownColliders = null;
let hiddenForRoom = [];
let townReturn = { x: 0, z: 0, yaw: 0 };
let myRoomLayout = { wall: "#8a9aa6", floor: "#b8a98f", items: { rug: false, plant: false, lamp: false, table: false } };
let roomSaveTimer = null;
let mySpace = "town";
let roomOwnerId = null;
let roomOwnerName = "";
let activeRoomLayout = null;
let roomPanelCollapsed = false;
let myRoomCode = null;
let hintEl = null;
let explainerEl = null;
let myHomeEligible = false;
let myHasHome = false;
let selectedHomeStyle = "modern";
animate();
try { window.parent?.postMessage({ type: "world_ready" }, "*"); } catch {}

enterButton.addEventListener("click", enterTown);

const fsBtn = document.createElement("button");
fsBtn.id = "fsButton";
fsBtn.className = "icon-button";
fsBtn.type = "button";
fsBtn.setAttribute("aria-label", "Full screen");
fsBtn.textContent = "\u26F6";
fsBtn.style.position = "fixed";
fsBtn.style.top = "max(14px, env(safe-area-inset-top))";
fsBtn.style.right = "calc(max(14px, env(safe-area-inset-right)) + 48px)";
fsBtn.style.zIndex = "35";
document.body.appendChild(fsBtn);
fsBtn.addEventListener("click", () => {
  if (document.fullscreenElement) {
    try { document.exitFullscreen(); } catch (e) {}
  } else if (pseudoOn) {
    pseudoFs(false);
  } else {
    goFullscreen();
  }
});
menuButton.addEventListener("click", () => toggleSettings(true));
closeSettingsButton.addEventListener("click", () => toggleSettings(false));
leaveTownButton.addEventListener("click", leaveTown);
if (removeHomeButton) removeHomeButton.addEventListener("click", async () => {
  if (!myHasHome || !supa) return;
  if (!window.confirm("Remove your home? This clears the lot so you can claim a different one.")) return;
  removeHomeButton.disabled = true;
  try {
    const { data } = await supa.rpc("release_home");
    if (data && data.ok) { myHasHome = false; location.reload(); }
    else { removeHomeButton.disabled = false; }
  } catch (e) { removeHomeButton.disabled = false; }
});

// ---- in-world Build Mode: walk-and-place props, saved for everyone ----
const buildPanel = document.querySelector("#buildPanel");
const buildModeButton = document.querySelector("#buildModeButton");
function setBuildHint(t) { const el = document.querySelector("#buildHint"); if (el) el.textContent = t; }
function toggleBuildMode(on) {
  buildMode = on;
  if (buildPanel) buildPanel.classList.toggle("hidden", !on);
  if (on) {
    toggleSettings(false);
    if (document.pointerLockElement) { try { document.exitPointerLock(); } catch (e) {} }
    placeRot = benchRotationToward(state.x, state.z);
    setBuildHint("Pick a prop, aim with the ghost, tap Place here.");
  } else {
    clearBuildPreview();
  }
}
function spawnByType(type, x, z, rot) {
  if (type === "table") return addTable(x, z);
  if (type === "chair") return addChair(x, z, rot);
  if (type === "streetlight") return addStreetlight(x, z);
  if (type === "planter") return addPlanter(x, z);
  if (type === "tree") return addTree(x, z);
  if (type === "bench") return addBench(x, z, rot);
  if (type === "cafe") return addCafeCounter(x, z, rot);
  if (type === "fence") return addFenceSegment(x, z, rot);
}
function renderProp(type, x, z, rot, id, ownerUid) {
  const before = scene.children.slice();
  const colBefore = buildingColliders.length;
  spawnByType(type, x, z, rot);
  for (let ci = colBefore; ci < buildingColliders.length; ci++) buildingColliders[ci].propId = id;
  const added = scene.children.filter((o) => before.indexOf(o) === -1);
  if (!added.length) return null;
  let root;
  if (added.length === 1) { root = added[0]; }
  else { root = new THREE.Group(); added.forEach((o) => { scene.remove(o); root.add(o); }); scene.add(root); }
  root.userData = root.userData || {};
  root.userData.propId = id; root.userData.ownerUid = ownerUid;
  placedProps.push({ id: id, type: type, x: x, z: z, ownerUid: ownerUid, root: root });
  return root;
}
let propsSubscribed = false;
function removePropById(id) {
  const idx = placedProps.findIndex((x) => x.id === id);
  if (idx === -1) return;
  scene.remove(placedProps[idx].root);
  placedProps.splice(idx, 1);
  for (let ci = buildingColliders.length - 1; ci >= 0; ci--) {
    if (buildingColliders[ci].propId === id) buildingColliders.splice(ci, 1);
  }
}
function subscribeProps() {
  if (propsSubscribed) return; propsSubscribed = true;
  try {
    ensureSupabase().channel("engine-props")
      .on("postgres_changes", { event: "*", schema: "public", table: "world_props" }, (p) => {
        const row = p.new || p.old;
        if (!row || !row.id) return;
        if (p.eventType === "DELETE") {
          removePropById(row.id);
        } else if (p.eventType === "INSERT") {
          if (placedProps.some((x) => x.id === row.id)) return;
          renderProp(row.prop_type, row.x, row.z, row.rot, row.id, row.owner_uid);
        }
      })
      .subscribe();
  } catch (e) {}
}
async function loadProps() {
  if (propsLoaded) return; propsLoaded = true;
  try {
    const { data } = await ensureSupabase().from("world_props").select("id,prop_type,x,z,rot,owner_uid");
    if (Array.isArray(data)) for (const p of data) renderProp(p.prop_type, p.x, p.z, p.rot, p.id, p.owner_uid);
  } catch (e) {}
  subscribeProps();
}
async function placeHere() {
  if (!myUserId) { setBuildHint("Sign in on your account to place things."); return; }
  if (!selectedBuildProp) { setBuildHint("Pick a prop first."); return; }
  const _spot = placementSpot();
  const px = _spot.x;
  const pz = _spot.z;
  setBuildHint("Placing\u2026");
  try {
    const sb = ensureSupabase();
    const { data, error } = await sb.rpc("place_prop", { p_type: selectedBuildProp, p_x: px, p_z: pz, p_rot: placeRot });
    if (error) { setBuildHint("Place error: " + (error.message || error.code || JSON.stringify(error))); return; }
    if (!data || !data.ok) {
      const e = (data && data.error) || "unknown";
      setBuildHint(e === "not_admin" ? "Building is limited to the team right now." : e === "limit_reached" ? "You hit the 60-prop limit \u2014 remove some to add more." : e === "signin" ? "Sign in to build." : e === "bad_type" ? "Can't place that." : ("Rejected: " + e));
      return;
    }
    try {
      renderProp(data.prop_type, data.x, data.z, data.rot, data.id, myUserId);
    } catch (re) {
      setBuildHint("Render error: " + (re && re.message ? re.message : String(re)));
      return;
    }
    try { SFX.place(); } catch (e) {}
    setBuildHint("Placed a " + data.prop_type + " \u2014 there it is.");
  } catch (ex) {
    setBuildHint("Place crashed: " + (ex && ex.message ? ex.message : String(ex)));
  }
}
function removeNearest() {
  if (!myUserId || !supa) return;
  let best = null, bd = Infinity;
  for (const p of placedProps) {
    const d = (p.x - state.x) * (p.x - state.x) + (p.z - state.z) * (p.z - state.z);
    if (d < bd) { bd = d; best = p; }
  }
  if (!best) { setBuildHint("Nothing nearby to remove."); return; }
  supa.rpc("remove_prop", { p_id: best.id }).then(({ data }) => {
    if (data && data.ok) {
      scene.remove(best.root);
      const i = placedProps.indexOf(best); if (i >= 0) placedProps.splice(i, 1);
      setBuildHint("Removed.");
    } else {
      const e = (data && data.error) || "unknown";
      setBuildHint(e === "not_admin" ? "Removing is limited to the team right now." : ("Couldn't remove: " + e));
    }
  });
}
if (buildModeButton) buildModeButton.addEventListener("click", () => toggleBuildMode(true));
document.querySelectorAll(".buildPropBtn").forEach((bb) => bb.addEventListener("click", () => {
  selectedBuildProp = bb.getAttribute("data-prop");
  document.querySelectorAll(".buildPropBtn").forEach((x) => x.classList.toggle("active", x === bb));
  setBuildHint("Selected " + selectedBuildProp + ". Walk where you want it, tap Place here.");
}));
{
  const _pb = document.querySelector("#buildPlace"); if (_pb) _pb.addEventListener("click", placeHere);
  const _rb = document.querySelector("#buildRemove"); if (_rb) _rb.addEventListener("click", removeNearest);
  const _rotb = document.querySelector("#buildRotate"); if (_rotb) _rotb.addEventListener("click", () => { placeRot += Math.PI / 4; setBuildHint("Rotating \u2014 the ghost shows the facing. Place here."); });
  const _db = document.querySelector("#buildDone"); if (_db) _db.addEventListener("click", () => toggleBuildMode(false));
  document.querySelectorAll("[data-hold]").forEach((hb) => hb.addEventListener("click", () => setHeld(hb.getAttribute("data-hold") || null)));
  if (throwButton) throwButton.addEventListener("pointerdown", (e) => { e.preventDefault(); throwSnowball(); });
}
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

colorSwatches?.querySelectorAll("[data-color]").forEach((button) => {
  button.addEventListener("click", () => {
    setMyAppearance({ ...myAppearance, color: button.dataset.color, shirt: button.dataset.color });
  });
});

patternButtons?.querySelectorAll("[data-pattern]").forEach((button) => {
  button.addEventListener("click", () => {
    setMyAppearance({ ...myAppearance, pattern: button.dataset.pattern });
  });
});

bodyButtons?.querySelectorAll("[data-body]").forEach((button) => {
  button.addEventListener("click", () => {
    setMyAppearance({ ...myAppearance, body: button.dataset.body });
  });
});

bodyTypeButtons?.querySelectorAll("[data-build]").forEach((button) => {
  button.addEventListener("click", () => { setMyAppearance({ ...myAppearance, build: button.dataset.build }); });
});
skinSwatches?.querySelectorAll("[data-skin]").forEach((button) => {
  button.addEventListener("click", () => { setMyAppearance({ ...myAppearance, skin: button.dataset.skin }); });
});
hairSwatches?.querySelectorAll("[data-hair]").forEach((button) => {
  button.addEventListener("click", () => { setMyAppearance({ ...myAppearance, hair: button.dataset.hair }); });
});
pantsSwatches?.querySelectorAll("[data-pants]").forEach((button) => {
  button.addEventListener("click", () => { setMyAppearance({ ...myAppearance, pants: button.dataset.pants }); });
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
  const _t = event.target;
  if (_t && (_t.tagName === "INPUT" || _t.tagName === "TEXTAREA" || _t.tagName === "SELECT" || _t.isContentEditable)) return;
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
  if (claimOverlay && claimOverlay.style.display === "flex") return;
  if (askOverlay && askOverlay.style.display === "flex") return;

  if (event.code === "KeyE" || event.code === "Enter") {
    if (activeDoor || activePlot || activeMind) {
      event.preventDefault();
      enterActiveDoor();
      return;
    }
  }

  if (hasEntered && (event.code === "ArrowUp" || event.code === "ArrowDown" || event.code === "ArrowLeft" || event.code === "ArrowRight")) {
    event.preventDefault();
  }
  if (event.code === "KeyH") { event.preventDefault(); cycleHeld(); return; }
  if (event.code === "KeyF") { event.preventDefault(); throwSnowball(); return; }
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
window.addEventListener("pagehide", pageLeavePresence);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) clearMovementInput();
  if (myUserId) {
    setMyWorldPresence(!document.hidden);
  } else if (guestId) {
    wantsSelfPresence = !document.hidden && hasEntered;
    if (wantsSelfPresence) trackSelf();
    else {
      try { channel?.untrack(); } catch {}
    }
  }
});

async function initWorld() {
  ensureSupabase();
  await loadIdentity();
  loadSurfaces();
  if (!mindsLoaded) { mindsLoaded = true; loadMinds(); }
  if (!spacesLoaded) { spacesLoaded = true; loadSpaces(); }
  loadProps();
  await loadCharacters();
  connect();
  if (myUserId) setMyWorldPresence(true);
}

function ensureSupabase() {
  if (!supa) {
    supa = createClient(SUPA_URL, SUPA_KEY, {
      realtime: { params: { eventsPerSecond: 24 } }
    });
  }
  return supa;
}

function selfRealtimeId() {
  return myUserId || guestId;
}

function getSessionVisitorId(kind) {
  const prefix = kind === "ai-visitor" ? "ai-visitor" : "guest";
  const key = `hb_${prefix}_id`;
  try {
    const existing = sessionStorage.getItem(key);
    if (existing && existing.startsWith(`${prefix}:`)) return existing;
    const next = `${prefix}:${randomIdChunk()}`;
    sessionStorage.setItem(key, next);
    return next;
  } catch {
    return `${prefix}:${randomIdChunk()}`;
  }
}

function randomIdChunk() {
  try {
    if (crypto?.randomUUID) return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  } catch {}
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.slice(0, 12);
}

function defaultVisitorName(kind, id) {
  const suffix = String(id || "").split(":").pop().slice(0, 4).toUpperCase() || "0000";
  return kind === "ai-visitor" ? `AI Visitor ${suffix}` : `Guest ${suffix}`;
}

function isTransientId(id) {
  return typeof id === "string" && /^(guest|ai-visitor):/.test(id);
}

function isTransientPeer(player) {
  return !!player && isTransientId(player.id);
}

function transientKindLabel(player) {
  return player?.kind === "ai-visitor" || String(player?.id || "").startsWith("ai-visitor:")
    ? "visiting AI"
    : "guest";
}

function transientPlayerFromPresence(meta) {
  if (!meta?.id || !isTransientId(meta.id)) return null;
  const kind = meta.kind === "ai-visitor" || String(meta.id).startsWith("ai-visitor:") ? "ai-visitor" : "guest";
  const appearance = normalizeAppearance(meta.appearance || { color: meta.color }, meta.id);
  return {
    id: meta.id,
    name: sanitizeDisplayName(meta.name || defaultVisitorName(kind, meta.id)),
    kind,
    temporary: true,
    color: appearance.color,
    appearance,
    x: Number.isFinite(meta.x) ? meta.x : 0,
    y: Number.isFinite(meta.y) ? meta.y : standingEyeHeight,
    z: Number.isFinite(meta.z) ? meta.z : 8,
    yaw: Number.isFinite(meta.yaw) ? meta.yaw : 0,
    pitch: Number.isFinite(meta.pitch) ? meta.pitch : 0,
    stance: meta.stance === "crouch" ? "crouch" : "stand",
    space: meta.space || "town",
    presence: "present"
  };
}

async function loadIdentity() {
  try {
    isAdmin = false;
    const { data: { session } } = await ensureSupabase().auth.getSession();
    if (session?.user?.id) {
      myUserId = session.user.id;
      myId = myUserId;
      guestId = null;
      visitorKind = "resident";
      wantsSelfPresence = true;
      try {
        const { data: adminRow } = await supa.from("world_admins").select("auth_user_id").eq("auth_user_id", myUserId).maybeSingle();
        isAdmin = !!adminRow;
      } catch (e) { isAdmin = false; }
      if (hintedUserId && hintedUserId !== myUserId) {
        addFeed("Signed-in account verified");
      }
      try {
        const { data: character } = await supa
          .from("world_characters")
          .select("auth_user_id, display_name, presence, appearance, kind, location, last_seen_at, room_layout")
          .eq("auth_user_id", myUserId)
          .maybeSingle();
        if (character) {
          upsertCharacter(character);
          myAppearance = characterAppearance(character);
          if (character.display_name) displayName = sanitizeDisplayName(character.display_name);
        }
      } catch {}
      if (displayName === "Guest") {
        try {
          const { data: person } = await supa
            .from("people")
            .select("display_name, handle")
            .eq("auth_user_id", myUserId)
            .maybeSingle();
          const name = person?.display_name || person?.handle;
          if (name) displayName = sanitizeDisplayName(name);
        } catch {}
      }
    } else {
      myUserId = null;
      visitorKind = requestedVisitorKind;
      guestId = getSessionVisitorId(visitorKind);
      myId = guestId;
      wantsSelfPresence = false;
      if (displayName === "Guest") displayName = defaultVisitorName(visitorKind, guestId);
    }
  } catch {
    myUserId = null;
    visitorKind = requestedVisitorKind;
    guestId = getSessionVisitorId(visitorKind);
    myId = guestId;
    wantsSelfPresence = false;
    if (displayName === "Guest") displayName = defaultVisitorName(visitorKind, guestId);
  }

  myAppearance = normalizeAppearance(myAppearance, myUserId || displayName);
  myColor = myAppearance.color;
  identityEl.textContent = displayName;
  welcomeName.textContent = displayName;
  renderAppearanceControls();
}

async function loadCharacters() {
  if (charactersLoaded) return;
  charactersLoaded = true;
  try {
    const { data, error } = await ensureSupabase()
      .from("world_characters")
      .select("auth_user_id, display_name, presence, appearance, kind, location, last_seen_at, room_layout");
    if (error) throw error;
    for (const row of data || []) upsertCharacter(row);
    renderCharacters();
  } catch {
    renderCharacters();
  }

  try {
    supa.channel("engine-characters")
      .on("postgres_changes", { event: "*", schema: "public", table: "world_characters" }, (p) => {
        const row = p.new || p.old;
        if (!row?.auth_user_id) return;
        if (p.eventType === "DELETE") {
          characters.delete(row.auth_user_id);
          removeRemote(row.auth_user_id);
          removeNpc(row.auth_user_id);
          peers.delete(row.auth_user_id);
        } else {
          upsertCharacter(row);
        }
        renderCharacters();
      })
      .subscribe();
  } catch {}
}

function upsertCharacter(row) {
  if (!row?.auth_user_id) return;
  const character = {
    ...row,
    display_name: sanitizeDisplayName(row.display_name)
  };
  characters.set(row.auth_user_id, character);
  if (row.auth_user_id === myUserId) {
    myAppearance = characterAppearance(character);
    myColor = myAppearance.color;
    myRoomLayout = normalizeRoomLayout(character.room_layout);
    if (inRoom) applyRoomLayout();
    renderAppearanceControls();
    loadRoomCode();
    loadHomeEligibility();
  }
}

function renderCharacters() {
  const ids = new Set(characters.keys());
  for (const id of [...remotes.keys()]) {
    if (!ids.has(id)) removeRemote(id);
  }
  for (const id of [...npcs.keys()]) {
    if (!ids.has(id)) removeNpc(id);
  }

  const rows = [...characters.values()].sort((a, b) =>
    characterName(a).localeCompare(characterName(b))
  );
  for (const row of rows) reconcileCharacter(row);
  const residentPlayers = rows.map((row) => ({
    id: row.auth_user_id,
    name: characterName(row),
    color: characterColor(row),
    presence: characterPresence(row)
  }));
  const transientPlayers = [...peers.values()]
    .filter(isTransientPeer)
    .map(transientSummary)
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  if (guestId && hasEntered && wantsSelfPresence) {
    transientPlayers.unshift({
      id: guestId,
      name: displayName,
      color: myColor,
      presence: "present",
      temporary: true,
      kind: visitorKind
    });
  }
  latestPlayers = residentPlayers.concat(transientPlayers);
  const liveCount = latestPlayers.filter((p) => p.presence === "present").length;
  const guestCount = transientPlayers.length;
  const residentLabel = rows.length === 1 ? "resident" : "residents";
  const guestLabel = guestCount === 1 ? "guest" : "guests";
  playerCountEl.textContent = guestCount
    ? `${liveCount} live / ${rows.length} ${residentLabel} / ${guestCount} ${guestLabel}`
    : `${liveCount} live / ${rows.length} people`;
  renderRoster();
}

function transientSummary(player) {
  const appearance = normalizeAppearance(player.appearance || { color: player.color }, player.id);
  return {
    id: player.id,
    name: sanitizeDisplayName(player.name || defaultVisitorName(player.kind, player.id)),
    color: appearance.color,
    presence: "present",
    temporary: true,
    kind: player.kind === "ai-visitor" ? "ai-visitor" : "guest"
  };
}

function reconcileCharacter(row) {
  const id = row.auth_user_id;
  if (!id) return;

  if (characterPresence(row) !== "present") {
    peers.delete(id);
    removeRemote(id);
    ensureNpcForCharacter(row);
    return;
  }

  removeNpc(id);
  if (id === myUserId && hasEntered) {
    removeRemote(id);
    return;
  }

  const peer = peers.get(id);
  const player = peer || characterPlayer(row);
  const appearanceKey = appearanceSignature(player.appearance || characterAppearance(row));
  let remote = remotes.get(id);
  if (remote && remote.appearanceKey !== appearanceKey) {
    removeRemote(id);
    remote = null;
  }
  if (!remote) {
    remote = createRemote(player);
    remotes.set(id, remote);
    scene.add(remote.group);
  }
  remote.target.set(player.x, remoteGroundY(player), player.z);
  remote.targetYaw = player.yaw;
  remote.targetScaleY = player.stance === "crouch" ? 0.72 : 1;
  if (peer && remote.heldType !== (peer.holding || null)) {
    remote.heldType = peer.holding || null;
    setHeldOnGroup(remote.group, remote.heldType);
  }
}

function characterPlayer(row) {
  const spawn = row.auth_user_id === myUserId ? new THREE.Vector3(state.x, 0, state.z) : characterSpawn(row.auth_user_id);
  const appearance = characterAppearance(row);
  return {
    id: row.auth_user_id,
    name: characterName(row),
    color: appearance.color,
    appearance,
    x: spawn.x,
    y: standingEyeHeight,
    z: spawn.z,
    yaw: spawn.yaw || 0,
    pitch: 0,
    stance: "stand"
  };
}

function ensureNpcForCharacter(row) {
  const id = row.auth_user_id;
  if (!id) return;
  const appearance = characterAppearance(row);
  const appearanceKey = appearanceSignature(appearance);
  let npc = npcs.get(id);
  if (npc) {
    if (npc.name !== characterName(row) || npc.appearanceKey !== appearanceKey) {
      removeNpc(id);
      npc = null;
    } else {
      return;
    }
  }

  const remote = remotes.get(id);
  const known = peers.get(id);
  const spawn = remote
    ? remote.group.position.clone()
    : known
      ? new THREE.Vector3(known.x, remoteGroundY(known), known.z)
      : characterSpawn(id);
  removeRemote(id);

  let seed = 0;
  for (const ch of id) seed += ch.charCodeAt(0);
  const group = buildNpcAvatar(appearance, characterName(row));
  group.position.copy(spawn);
  group.position.y = 0;
  npcs.set(id, { group, name: characterName(row), appearanceKey, seed: (seed % 100) / 100 * Math.PI * 2, base: spawn.clone() });
  scene.add(group);
}

function characterPresence(row) {
  return String(row?.presence || "away").toLowerCase() === "present" ? "present" : "away";
}

function characterName(row) {
  return sanitizeDisplayName(row?.display_name || "Resident");
}

function characterColor(row) {
  return characterAppearance(row).color;
}

function characterAppearance(row) {
  return normalizeAppearance(row?.appearance, row?.auth_user_id || characterName(row));
}

function normalizeAppearance(appearance, seed) {
  const source = appearance && typeof appearance === "object" ? appearance : {};
  const hex = (v, fb) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v)) ? v.toLowerCase() : fb;
  const color = hex(source.color || source.bodyColor || source.tint, colorForId(seed));
  const pattern = String(source.pattern || "plain").toLowerCase();
  const body = (source.body === "classic" || source.body === "person") ? source.body : "person";
  return {
    color,
    pattern: appearancePatterns.has(pattern) ? pattern : "plain",
    body,
    shirt: hex(source.shirt, color),
    skin: hex(source.skin, "#c8a07a"),
    pants: hex(source.pants, "#3a4654"),
    hair: hex(source.hair, "#2c2420"),
    build: ["slim", "regular", "broad"].includes(source.build) ? source.build : "regular"
  };
}

function appearanceSignature(appearance) {
  const clean = normalizeAppearance(appearance, "resident");
  return `${clean.color}:${clean.pattern}:${clean.body}:${clean.shirt}:${clean.skin}:${clean.pants}:${clean.hair}:${clean.build}`;
}

function characterSpawn(id) {
  const hash = hashString(id || "resident");
  const angle = ((hash % 360) / 360) * Math.PI * 2;
  const radius = 4.8 + (hash % 45) / 10;
  return new THREE.Vector3(
    Math.cos(angle) * radius,
    0,
    Math.sin(angle) * radius
  );
}

function colorForId(id) {
  return peerColors[Math.abs(hashString(id || "guest")) % peerColors.length];
}

function hashString(value) {
  let hash = 0;
  const text = String(value || "");
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function setLocalCharacterPresence(present) {
  if (!myUserId) return;
  markCharacterPresence(myUserId, present);
}

function markCharacterPresence(id, present, rerender = true) {
  const row = characters.get(id);
  if (!row) return;
  row.presence = present ? "present" : "away";
  row.last_seen_at = new Date().toISOString();
  characters.set(id, row);
  if (rerender) renderCharacters();
}

async function setMyWorldPresence(present) {
  if (!myUserId) return;
  wantsSelfPresence = present;
  setLocalCharacterPresence(present);
  try {
    await ensureSupabase().rpc("world_presence", { p_present: present });
  } catch {}
}

function pageLeavePresence() {
  if (!selfRealtimeId()) return;
  wantsSelfPresence = false;
  try { channel?.untrack(); } catch {}
  if (myUserId) {
    setLocalCharacterPresence(false);
    try { ensureSupabase().rpc("world_presence", { p_present: false }); } catch {}
  }
}

function trackSelf() {
  const id = selfRealtimeId();
  if (!channel || !id || !wantsSelfPresence) return;
  try {
    channel.track({
      id,
      name: displayName,
      kind: visitorKind,
      temporary: !myUserId,
      color: myColor,
      appearance: myAppearance,
      x: state.x,
      y: state.y,
      z: state.z,
      yaw: state.yaw,
      pitch: state.pitch,
      stance: state.stance,
      holding: heldItem,
      tags: tagScore,
      outs: outScore,
      arena: inArena,
      space: mySpace
    });
  } catch {}
}

function setMyAppearance(next) {
  myAppearance = normalizeAppearance(next, myUserId || displayName);
  myColor = myAppearance.color;
  renderAppearanceControls("Saving...");

  if (!myUserId) {
    renderAppearanceControls("Guest look is temporary. Sign in to keep it.", false, true);
    trackSelf();
    sendState(true);
    renderCharacters();
    return;
  }

  const row = characters.get(myUserId);
  if (row) {
    row.appearance = { ...(row.appearance || {}), ...myAppearance };
    characters.set(myUserId, row);
  }
  renderCharacters();
  trackSelf();
  sendState(true);

  window.clearTimeout(appearanceSaveTimer);
  appearanceSaveTimer = window.setTimeout(saveMyAppearance, 350);
}

async function saveMyAppearance() {
  if (!myUserId) return;
  try {
    const { error } = await ensureSupabase().rpc("set_world_appearance", {
      p_appearance: myAppearance
    });
    if (error) throw error;
    renderAppearanceControls("Saved.", false, true);
  } catch (error) {
    renderAppearanceControls(error?.message || "Could not save character.", true);
  }
}

function renderAppearanceControls(message = "", isError = false, isOk = false) {
  colorSwatches?.querySelectorAll("[data-color]").forEach((button) => {
    button.classList.toggle("selected", button.dataset.color?.toLowerCase() === myAppearance.color);
  });
  patternButtons?.querySelectorAll("[data-pattern]").forEach((button) => {
    button.classList.toggle("selected", button.dataset.pattern === myAppearance.pattern);
  });
  bodyButtons?.querySelectorAll("[data-body]").forEach((button) => {
    button.classList.toggle("selected", button.dataset.body === myAppearance.body);
  });
  bodyTypeButtons?.querySelectorAll("[data-build]").forEach((button) => {
    button.classList.toggle("selected", button.dataset.build === myAppearance.build);
  });
  skinSwatches?.querySelectorAll("[data-skin]").forEach((button) => {
    button.classList.toggle("selected", button.dataset.skin?.toLowerCase() === myAppearance.skin);
  });
  hairSwatches?.querySelectorAll("[data-hair]").forEach((button) => {
    button.classList.toggle("selected", button.dataset.hair?.toLowerCase() === myAppearance.hair);
  });
  pantsSwatches?.querySelectorAll("[data-pants]").forEach((button) => {
    button.classList.toggle("selected", button.dataset.pants?.toLowerCase() === myAppearance.pants);
  });
  if (appearanceStatus) {
    appearanceStatus.textContent = message || (myUserId ? "Changes save to your account." : "Guest look is temporary. Sign in to keep it.");
    appearanceStatus.classList.toggle("error", isError);
    appearanceStatus.classList.toggle("ok", isOk);
  }
}

function enterTown() {
  if (settingsOpen) return;
  hasEntered = true;
  wantsConnection = true;
  wantsSelfPresence = true;
  if (!channel) connect();
  if (myUserId) setMyWorldPresence(true);
  trackSelf();
  renderCharacters();
  overlay.classList.add("hidden");
  goFullscreen();
  if (!isTouch) {
    try {
      const lockAttempt = canvas.requestPointerLock?.();
      lockAttempt?.catch?.(() => {});
    } catch {
      // Headless browsers and some embedded webviews reject pointer lock.
    }
  }
}

function goFullscreen() {
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen;
  if (req && !document.fullscreenElement) {
    try {
      const r = req.call(el);
      if (r && r.catch) r.catch(() => pseudoFs(true));
      return;
    } catch (e) {}
  }
  // iOS Safari has no Fullscreen API for this element — expand the embedded frame instead.
  pseudoFs(true);
}

function pseudoFs(on) {
  try {
    const fe = window.frameElement;
    if (!fe) return;
    if (on) {
      if (!pseudoOn) fe.dataset.fsPrev = fe.style.cssText;
      fe.style.position = "fixed";
      fe.style.inset = "0";
      fe.style.width = "100%";
      fe.style.height = "100%";
      fe.style.zIndex = "99999";
      fe.style.border = "0";
      pseudoOn = true;
    } else {
      fe.style.cssText = fe.dataset.fsPrev || "";
      pseudoOn = false;
    }
    window.dispatchEvent(new Event("resize"));
  } catch (e) {}
}

function toggleSettings(open) {
  settingsOpen = open;
  settingsPanel.classList.toggle("hidden", !settingsOpen);
  if (removeHomeButton) removeHomeButton.style.display = (settingsOpen && myHasHome) ? "block" : "none";
  if (buildModeButton) buildModeButton.style.display = (settingsOpen && myUserId && isAdmin) ? "block" : "none";
  if (settingsOpen) {
    clearMovementInput();
    if (document.pointerLockElement) {
      document.exitPointerLock?.();
    }
  }
}

function leaveTown() {
  wantsSelfPresence = false;
  try { channel?.untrack(); } catch {}
  if (myUserId) { try { setMyWorldPresence(false); } catch {} }
  try { if (document.pointerLockElement) document.exitPointerLock?.(); } catch {}
  if (pseudoOn) { try { pseudoFs(false); } catch {} }
  (window.top || window).location.assign("/engine");
}

let reconnectTimer = null;
function scheduleReconnect() {
  if (!wantsConnection || reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (!wantsConnection) return;
    try { if (channel) supa.removeChannel(channel); } catch (e) {}
    channel = null;
    connect();
  }, 2200);
}

function connect() {
  if (!wantsConnection) return;
  if (channel) return;

  setStatus("connecting", false);
  ensureSupabase();
  if (!mindsLoaded) { mindsLoaded = true; loadMinds(); }
  if (!spacesLoaded) { spacesLoaded = true; loadSpaces(); }
  loadProps();
  if (!charactersLoaded) loadCharacters();

  channel = supa.channel("engine-town", {
    config: {
      presence: { key: selfRealtimeId() || `preview-${randomIdChunk().slice(0, 8)}` },
      broadcast: { self: false }
    }
  });

  channel.on("broadcast", { event: "state" }, ({ payload }) => applyPeerState(payload));
  channel.on("broadcast", { event: "throw" }, ({ payload }) => {
    if (!payload || payload.id === selfRealtimeId()) return;
    spawnProjectile(new THREE.Vector3(payload.ox, payload.oy, payload.oz), new THREE.Vector3(payload.vx, payload.vy, payload.vz), payload.id, payload.c);
  });
  channel.on("broadcast", { event: "note" }, ({ payload }) => {
    if (!payload || payload.id === selfRealtimeId() || typeof payload.i !== "number") return;
    playBar(payload.i, false, volByDist(payload.x, payload.z));
  });
  channel.on("broadcast", { event: "thit" }, ({ payload }) => {
    if (!payload || typeof payload.idx !== "number") return;
    var t = arenaTargets[payload.idx];
    if (t && t.alive) downTarget(t, null, payload.c);
  });
  channel.on("broadcast", { event: "tag" }, ({ payload }) => {
    if (!payload || payload.by !== selfRealtimeId()) return;
    addFeed("You tagged " + (payload.victimName || "someone") + "!");
    if (payload.arena) { tagScore++; refreshArenaScore(); try { sendState(true); } catch (e) {} }
  });

  channel.on("presence", { event: "sync" }, () => syncPresence());

  channel.on("presence", { event: "join" }, ({ newPresences }) => {
    for (const p of newPresences || []) {
      if (!p.id || p.id === selfRealtimeId()) continue;
      if (characters.has(p.id)) {
        markCharacterPresence(p.id, true);
        removeNpc(p.id);
        addFeed(`${p.name || "Guest"} joined`);
      } else if (isTransientId(p.id)) {
        const player = transientPlayerFromPresence(p);
        if (player) applyPeerState(player);
        addFeed(`${p.name || "Guest"} is visiting`);
      }
    }
  });

  channel.on("presence", { event: "leave" }, ({ leftPresences }) => {
    for (const p of leftPresences || []) {
      if (!p.id || p.id === selfRealtimeId()) continue;
      if (characters.has(p.id)) {
        markCharacterPresence(p.id, false);
        peers.delete(p.id);
        removeRemote(p.id);
        renderCharacters();
        addFeed(`${p.name || "Guest"} wandered off`);
      } else if (isTransientId(p.id)) {
        peers.delete(p.id);
        removeRemote(p.id);
        removeNpc(p.id);
        addFeed(`${p.name || "Guest"} left`);
        renderCharacters();
      }
    }
  });

  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      connected = true;
      setStatus("online", true);
      rttEl.textContent = "realtime";
      trackSelf();
      if (myUserId) addFeed(`joined as ${displayName}`);
      else addFeed("watching as a temporary guest");
      sendState(true);
    } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      connected = false;
      setStatus("offline", false);
      scheduleReconnect();
    } else if (status === "CLOSED") {
      connected = false;
      scheduleReconnect();
    }
  });
}

function applyPeerState(player) {
  if (!player || !player.id || player.id === selfRealtimeId()) return;
  const character = characters.get(player.id);
  const transient = !character && isTransientPeer(player);
  if (!character && !transient) return;
  const wasKnownTransient = transient && peers.has(player.id);
  if (character) {
    player.appearance = normalizeAppearance(player.appearance || character.appearance, player.id);
    player.color = player.appearance.color;
    player.kind = "resident";
    player.temporary = false;
  } else {
    player.name = sanitizeDisplayName(player.name || defaultVisitorName(player.kind, player.id));
    player.appearance = normalizeAppearance(player.appearance || { color: player.color }, player.id);
    player.color = player.appearance.color;
    player.kind = player.kind === "ai-visitor" || String(player.id).startsWith("ai-visitor:") ? "ai-visitor" : "guest";
    player.temporary = true;
  }
  if (npcs.has(player.id)) removeNpc(player.id);
  if (character) markCharacterPresence(player.id, true, false);
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
  remote.space = player.space || "town";
  remote.lastUpdate = performance.now();
  if (!remote.buf) remote.buf = [];
  remote.buf.push({ t: remote.lastUpdate, x: player.x, y: remoteGroundY(player), z: player.z, yaw: player.yaw });
  if (remote.buf.length > 10) remote.buf.shift();
  if (remote.heldType !== (player.holding || null)) {
    remote.heldType = player.holding || null;
    setHeldOnGroup(remote.group, remote.heldType);
  }
  if (transient && !wasKnownTransient) renderCharacters();
}

function syncPresence() {
  if (!channel) return;
  const presenceState = channel.presenceState();
  const liveTransientIds = new Set();

  for (const key in presenceState) {
    const metas = presenceState[key];
    if (metas && metas[0]) {
      const meta = metas[0];
      const id = meta.id || key;
      if (!id || id === selfRealtimeId()) continue;
      if (characters.has(id)) {
        markCharacterPresence(id, true, false);
      } else if (isTransientId(id)) {
        liveTransientIds.add(id);
        if (!peers.has(id)) {
          const player = transientPlayerFromPresence({ ...meta, id });
          if (player) applyPeerState(player);
        }
      }
    }
  }
  for (const [id] of peers) {
    if (!isTransientId(id) || liveTransientIds.has(id)) continue;
    peers.delete(id);
    removeRemote(id);
    removeNpc(id);
  }
  renderCharacters();
}

function sendState(force = false) {
  const id = selfRealtimeId();
  if (!connected || !channel || !id || !hasEntered || !wantsSelfPresence) return;
  if (!force && sendAccumulator < 0.05) return;

  sendAccumulator = 0;
  channel.send({
    type: "broadcast",
    event: "state",
    payload: {
      id,
      name: displayName,
      kind: visitorKind,
      temporary: !myUserId,
      color: myColor,
      appearance: myAppearance,
      x: state.x,
      y: state.y,
      z: state.z,
      yaw: state.yaw,
      pitch: state.pitch,
      stance: state.stance,
      holding: heldItem,
      tags: tagScore,
      outs: outScore,
      arena: inArena,
      space: mySpace
    }
  });
}

function makeSnowballMesh(color) {
  return new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), new THREE.MeshStandardMaterial({ color: (color === undefined ? 0xffffff : color), roughness: 0.9 }));
}
function spawnProjectile(origin, vel, owner, color) {
  const mesh = makeSnowballMesh(color);
  mesh.position.copy(origin);
  mesh.castShadow = false;
  scene.add(mesh);
  projectiles.push({ mesh: mesh, vel: vel.clone(), life: 0, owner: owner, color: (color === undefined ? 0xffffff : color) });
}
// ---- sound: synthesized Web Audio engine (no assets, honest code-built sound) ----
let AC = null, masterGain = null, fountainGain = null;
const noteBars = [];
function audioInit() {
  if (AC) return;
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = AC.createGain(); masterGain.gain.value = 0.5; masterGain.connect(AC.destination);
    const dur = 1.6, n = (AC.sampleRate * dur) | 0, buf = AC.createBuffer(1, n, AC.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * 0.6;
    const src = AC.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = AC.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 950;
    fountainGain = AC.createGain(); fountainGain.gain.value = 0;
    src.connect(f); f.connect(fountainGain); fountainGain.connect(masterGain); src.start();
    setInterval(() => {
      try {
        const dx = camera.position.x, dz = camera.position.z;
        const dist = Math.hypot(dx, dz);
        fountainGain.gain.value = 0.16 * Math.max(0, 1 - dist / 13);
      } catch (e) {}
    }, 180);
  } catch (e) {}
}
document.addEventListener("pointerdown", audioInit, { once: true });
document.addEventListener("keydown", audioInit, { once: true });
function sfxEnv(freq, type, dur, vol, slide) {
  if (!AC) return;
  const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(masterGain); o.start(t); o.stop(t + dur + 0.02);
}
function sfxNoise(dur, vol, fc) {
  if (!AC) return;
  const t = AC.currentTime, n = (AC.sampleRate * dur) | 0, buf = AC.createBuffer(1, n, AC.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = AC.createBufferSource(); src.buffer = buf;
  const f = AC.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = fc || 1800;
  const g = AC.createGain(); g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(masterGain); src.start(t);
}
function volByDist(x, z, range) {
  const r = range || 24;
  const d = Math.hypot(x - camera.position.x, z - camera.position.z);
  return Math.max(0, 1 - d / r);
}
const NOTE_FREQS = [262, 294, 330, 392, 440, 523, 587, 659];
const SFX = {
  jump() { sfxEnv(300, "sine", 0.16, 0.14, 2.1); },
  toss() { sfxNoise(0.15, 0.2, 2600); },
  pop(v) { const k = v == null ? 1 : v; if (k <= 0.02) return; sfxNoise(0.12, 0.28 * k, 1400); sfxEnv(190, "triangle", 0.1, 0.1 * k, 0.5); },
  hit() { sfxEnv(160, "sawtooth", 0.22, 0.2, 0.4); },
  place() { sfxEnv(120, "triangle", 0.12, 0.24, 0.7); },
  note(i, v) {
    const k = v == null ? 1 : v; if (k <= 0.02) return;
    const fq = NOTE_FREQS[((i % 8) + 8) % 8];
    sfxEnv(fq, "sine", 0.55, 0.28 * k, 1);
    sfxEnv(fq * 2, "triangle", 0.22, 0.07 * k, 1);
  }
};
function playBar(i, isLocal, vol) {
  try { SFX.note(i, vol); } catch (e) {}
  const bar = noteBars[((i % 8) + 8) % 8];
  if (bar && bar.material) {
    bar.material.emissiveIntensity = 0.95;
    setTimeout(() => { try { bar.material.emissiveIntensity = 0.18; } catch (e) {} }, 240);
  }
  if (isLocal) {
    try {
      if (channel && connected) channel.send({ type: "broadcast", event: "note", payload: { id: selfRealtimeId(), i: i, x: camera.position.x, z: camera.position.z } });
    } catch (e) {}
  }
}
const BANDSTAND = { x: -16, z: 22 };
function tryPlayBarAt(cx, cy) {
  if (!hasEntered || settingsOpen || !noteBars.length) return;
  if (Math.hypot(BANDSTAND.x - camera.position.x, BANDSTAND.z - camera.position.z) > 10) return;
  const ndc = new THREE.Vector2((cx / window.innerWidth) * 2 - 1, -(cy / window.innerHeight) * 2 + 1);
  const rc = new THREE.Raycaster(); rc.setFromCamera(ndc, camera);
  const hits = rc.intersectObjects(noteBars);
  if (hits.length) playBar(hits[0].object.userData.noteIndex, true, 1);
}
let _tapSX = 0, _tapSY = 0;
canvas.addEventListener("pointerdown", (e) => { _tapSX = e.clientX; _tapSY = e.clientY; });
canvas.addEventListener("pointerup", (e) => {
  if (Math.hypot(e.clientX - _tapSX, e.clientY - _tapSY) > 10) return;
  tryPlayBarAt(e.clientX, e.clientY);
});
document.addEventListener("keydown", (e) => {
  if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
  const k = parseInt(e.key, 10);
  if (!(k >= 1 && k <= 8)) return;
  if (!hasEntered || settingsOpen) return;
  if (Math.hypot(BANDSTAND.x - camera.position.x, BANDSTAND.z - camera.position.z) > 10) return;
  playBar(k - 1, true, 1);
});

function throwSnowball() {
  if (!hasEntered || settingsOpen) return;
  const now = performance.now();
  if (now - lastThrow < 320) return;
  lastThrow = now;
  try { SFX.toss(); } catch (e) {}
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
  const origin = camera.position.clone().addScaledVector(dir, 0.5);
  const vel = dir.clone().multiplyScalar(inArena ? 23 : 17);
  vel.y += inArena ? 0.7 : 2.4;
  const pColor = inArena ? PAINT_COLORS[(Math.random() * PAINT_COLORS.length) | 0] : 0xffffff;
  spawnProjectile(origin, vel, selfRealtimeId(), pColor);
  try {
    if (channel && connected) channel.send({ type: "broadcast", event: "throw", payload: { id: selfRealtimeId(), ox: origin.x, oy: origin.y, oz: origin.z, vx: vel.x, vy: vel.y, vz: vel.z, c: pColor } });
  } catch (e) {}
}
function flashHit(color) {
  try { SFX.hit(); } catch (e) {}
  let el = document.getElementById("hitFlash");
  if (!el) {
    el = document.createElement("div");
    el.id = "hitFlash";
    el.style.cssText = "position:fixed;inset:0;z-index:60;pointer-events:none;opacity:0;transition:opacity 0.5s ease;background:radial-gradient(circle, rgba(255,255,255,0) 38%, rgba(150,205,255,0.6) 100%);";
    document.body.appendChild(el);
  }
  var fr = 150, fg = 205, fb = 255;
  if (color !== undefined && color !== null && color !== 0xffffff) { fr = (color >> 16) & 255; fg = (color >> 8) & 255; fb = color & 255; }
  el.style.background = "radial-gradient(circle, rgba(255,255,255,0) 38%, rgba(" + fr + "," + fg + "," + fb + ",0.6) 100%)";
  el.style.transition = "opacity 0.04s ease";
  el.style.opacity = "1";
  setTimeout(function () { el.style.transition = "opacity 0.5s ease"; el.style.opacity = "0"; }, 70);
}
function popSnow(pos, color) {
  try { SFX.pop(volByDist(pos.x, pos.z)); } catch (e) {}
  const col = (color === undefined || color === null) ? 0xffffff : color;
  for (let k = 0; k < 7; k++) {
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.95 }));
    f.position.set(pos.x + (Math.random() - 0.5) * 0.28, Math.max(0.05, pos.y) + Math.random() * 0.28, pos.z + (Math.random() - 0.5) * 0.28);
    scene.add(f);
    snowPuffs.push({ mesh: f, life: 0, vy: 0.4 + Math.random() * 0.6 });
  }
}
function addPaintSplat(pos, color) {
  if (color === undefined || color === null || color === 0xffffff) return;
  const g = new THREE.CircleGeometry(0.22 + Math.random() * 0.18, 14);
  const m = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.85, depthWrite: false });
  const sp = new THREE.Mesh(g, m);
  sp.rotation.x = -Math.PI / 2;
  sp.rotation.z = Math.random() * Math.PI * 2;
  sp.position.set(pos.x, 0.02 + (paintSplats.length % 25) * 0.0006, pos.z);
  scene.add(sp);
  paintSplats.push({ mesh: sp, life: 0 });
  if (paintSplats.length > 40) { const old = paintSplats.shift(); scene.remove(old.mesh); old.mesh.geometry.dispose(); old.mesh.material.dispose(); }
}
function updatePaintSplats(dt) {
  for (let i = paintSplats.length - 1; i >= 0; i--) {
    const sp = paintSplats[i];
    sp.life += dt;
    if (sp.life > 7) {
      sp.mesh.material.opacity = Math.max(0, 0.85 - (sp.life - 7) * 0.57);
      if (sp.life > 8.5) { scene.remove(sp.mesh); sp.mesh.geometry.dispose(); sp.mesh.material.dispose(); paintSplats.splice(i, 1); }
    }
  }
}
function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.vel.y -= 18 * dt;
    const prevX = p.mesh.position.x, prevY = p.mesh.position.y, prevZ = p.mesh.position.z;
    p.mesh.position.addScaledVector(p.vel, dt);
    p.life += dt;
    let dead = false;
    if (solidBlockers.length) {
      const mx = (prevX + p.mesh.position.x) / 2, my = (prevY + p.mesh.position.y) / 2, mz = (prevZ + p.mesh.position.z) / 2;
      for (var sbi = 0; sbi < solidBlockers.length; sbi++) {
        var sb = solidBlockers[sbi];
        var hw = sb.width / 2 + 0.13, hd = sb.depth / 2 + 0.13;
        if ((p.mesh.position.y < sb.top + 0.13 && Math.abs(p.mesh.position.x - sb.x) < hw && Math.abs(p.mesh.position.z - sb.z) < hd) ||
            (my < sb.top + 0.13 && Math.abs(mx - sb.x) < hw && Math.abs(mz - sb.z) < hd)) {
          popSnow(p.mesh.position, p.color);
          dead = true; break;
        }
      }
    }
    if (dead) {}
    else if (p.mesh.position.y <= 0.13) { popSnow(p.mesh.position, p.color); addPaintSplat(p.mesh.position, p.color); dead = true; }
    else if (p.life > 4.5) { dead = true; }
    else if (p.owner !== selfRealtimeId() && hasEntered) {
      const dx = p.mesh.position.x - state.x, dy = p.mesh.position.y - (state.y - 0.2), dz = p.mesh.position.z - state.z;
      if (dx * dx + dy * dy + dz * dz < 0.7 * 0.7) {
        popSnow(p.mesh.position, p.color); flashHit(p.color);
        var byNm = (peers.get(p.owner) && peers.get(p.owner).name) || "Someone";
        addFeed(inArena ? (byNm + " splatted you!") : (byNm + " got you! \u2744"));
        if (inArena) { outScore++; refreshArenaScore(); try { sendState(true); } catch (e) {} }
        try { if (channel && connected) channel.send({ type: "broadcast", event: "tag", payload: { by: p.owner, victimName: displayName, arena: inArena } }); } catch (e) {}
        dead = true;
      }
    }
    if (!dead && arenaTargets.length) {
      for (var ti = 0; ti < arenaTargets.length; ti++) {
        var tg = arenaTargets[ti]; if (!tg.alive) continue;
        var tdx = p.mesh.position.x - tg.x, tdy = p.mesh.position.y - tg.y, tdz = p.mesh.position.z - tg.z;
        var rr = tg.r + 0.25;
        if (tdx * tdx + tdy * tdy + tdz * tdz < rr * rr) { hitArenaTarget(tg, p.mesh.position, p.owner === selfRealtimeId(), ti, p.color); dead = true; break; }
      }
    }
    if (dead) { scene.remove(p.mesh); if (p.mesh.geometry) p.mesh.geometry.dispose(); projectiles.splice(i, 1); }
  }
}
function updateSnowPuffs(dt) {
  for (let i = snowPuffs.length - 1; i >= 0; i--) {
    const f = snowPuffs[i];
    f.life += dt;
    f.mesh.position.y += f.vy * dt;
    f.mesh.material.opacity = Math.max(0, 0.95 - f.life * 2.2);
    if (f.life > 0.45) { scene.remove(f.mesh); f.mesh.geometry.dispose(); f.mesh.material.dispose(); snowPuffs.splice(i, 1); }
  }
}
function makeHeldItem(type) {
  if (!type) return null;
  const g = new THREE.Group();
  if (type === "coffee") {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.062, 0.18, 16), new THREE.MeshStandardMaterial({ color: 0xf4efe6, roughness: 0.5 }));
    cup.position.y = 0.09; g.add(cup);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.078, 0.07, 16), new THREE.MeshStandardMaterial({ color: 0xb9763e, roughness: 0.7 }));
    sleeve.position.y = 0.082; g.add(sleeve);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.094, 0.09, 0.032, 16), new THREE.MeshStandardMaterial({ color: 0x4a3322, roughness: 0.6 }));
    lid.position.y = 0.197; g.add(lid);
  } else if (type === "ball") {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), new THREE.MeshStandardMaterial({ color: 0xe23b4e, roughness: 0.45 }));
    b.position.y = 0.11; g.add(b);
  } else if (type === "balloon") {
    const bal = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), new THREE.MeshStandardMaterial({ color: 0x49b3e8, roughness: 0.3 }));
    bal.position.y = 0.4; bal.scale.y = 1.2; g.add(bal);
    const str = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.42, 6), new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.7 }));
    str.position.y = 0.19; g.add(str);
  } else if (type === "paintgun") {
    const gm = new THREE.MeshStandardMaterial({ color: 0x2c3038, roughness: 0.5 });
    const ac = new THREE.MeshStandardMaterial({ color: 0x36d07a, roughness: 0.4 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.11, 0.26), gm); body.position.set(0, 0, -0.02); g.add(body);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.34, 12), gm); barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.02, -0.22); g.add(barrel);
    const hopper = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), ac); hopper.position.set(0, 0.1, 0.02); g.add(hopper);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.06), gm); grip.position.set(0, -0.1, 0.06); grip.rotation.x = 0.3; g.add(grip);
  } else { return null; }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  return g;
}
function setHeld(type) {
  heldItem = type || null;
  if (viewmodel) { scene.remove(viewmodel); viewmodel = null; }
  const m = makeHeldItem(heldItem);
  if (m) { viewmodel = m; scene.add(viewmodel); updateViewmodel(); }
  try { if (channel && connected) sendState(true); } catch (e) {}
}
function cycleHeld() {
  const order = [null, "coffee", "ball", "balloon"];
  const i = order.indexOf(heldItem);
  setHeld(order[(i + 1) % order.length]);
}
function setHeldOnGroup(group, type) {
  if (!group) return;
  for (let i = group.children.length - 1; i >= 0; i--) {
    const c = group.children[i];
    if (c.userData && c.userData.heldTag) group.remove(c);
  }
  const m = makeHeldItem(type);
  if (m) { m.userData.heldTag = true; m.position.set(0.2, 0.85, -0.3); group.add(m); }
}
function updateViewmodel() {
  if (!viewmodel) return;
  if (!hasEntered || settingsOpen) { viewmodel.visible = false; return; }
  viewmodel.visible = true;
  _vmOff.set(0.2, -0.18, -0.55).applyQuaternion(camera.quaternion);
  viewmodel.position.copy(camera.position).add(_vmOff);
  viewmodel.quaternion.copy(camera.quaternion);
}
function placementSpot() {
  const d = 1.8;
  const x = Math.max(-29, Math.min(29, state.x - Math.sin(state.yaw) * d));
  const z = Math.max(-29, Math.min(29, state.z - Math.cos(state.yaw) * d));
  return { x: x, z: z };
}
function clearBuildPreview() {
  if (buildPreview) { scene.remove(buildPreview); buildPreview = null; }
  _pvType = null;
}
function updateBuildPreview() {
  if (!buildMode || !selectedBuildProp) { if (buildPreview) clearBuildPreview(); return; }
  const spot = placementSpot();
  const moved = (_pvX === null) || Math.abs(spot.x - _pvX) > 0.04 || Math.abs(spot.z - _pvZ) > 0.04;
  const rotated = (_pvRot === null) || Math.abs(placeRot - _pvRot) > 0.0001;
  const typed = (_pvType !== selectedBuildProp);
  if (buildPreview && !moved && !rotated && !typed) return;
  _pvX = spot.x; _pvZ = spot.z; _pvRot = placeRot; _pvType = selectedBuildProp;
  if (buildPreview) { scene.remove(buildPreview); buildPreview = null; }
  const colLen = buildingColliders.length;
  const before = scene.children.slice();
  try { spawnByType(selectedBuildProp, spot.x, spot.z, placeRot); } catch (e) { return; }
  if (buildingColliders.length > colLen) buildingColliders.length = colLen;
  const added = scene.children.filter((o) => before.indexOf(o) === -1);
  if (!added.length) return;
  let root;
  if (added.length === 1) { root = added[0]; }
  else { root = new THREE.Group(); added.forEach((o) => { scene.remove(o); root.add(o); }); scene.add(root); }
  root.traverse((o) => {
    if (o.isMesh && o.material && o.material.clone) {
      o.material = o.material.clone();
      o.material.transparent = true;
      o.material.opacity = 0.42;
      o.material.depthWrite = false;
      o.castShadow = false; o.receiveShadow = false;
    }
  });
  root.userData = root.userData || {}; root.userData.isPreview = true;
  buildPreview = root;
}
function pickSky(e) {
  if (e >= 0.22) return HB_DAY;
  if (e >= 0) return HB_DUSK.clone().lerp(HB_DAY, e / 0.22);
  if (e >= -0.22) return HB_DUSK.clone().lerp(HB_NIGHT, (-e) / 0.22);
  return HB_NIGHT;
}
function updateDayNight(dt) {
  if (!sunLight) return;
  const CYCLE = 300;
  const t = ((Date.now() / 1000) % CYCLE) / CYCLE;
  const a = t * Math.PI * 2;
  const e = Math.sin(a);
  const horiz = Math.cos(a);
  sunLight.position.set(horiz * 34, e * 40, 14 + e * 4);
  const day = Math.max(0, Math.min(1, e * 1.6 + 0.08));
  sunLight.intensity = 0.12 + 2.0 * day;
  if (hemiLight) hemiLight.intensity = 0.4 + 1.0 * Math.max(0, Math.min(1, e + 0.3));
  sunLight.color.setRGB(1, 0.92 - 0.16 * (1 - day), 0.82 - 0.28 * (1 - day));
  if (arenaLight) arenaLight.intensity = (1 - day) * 1.55;
  const nightF = Math.max(0, Math.min(1, -e * 1.5 + 0.1));
  if (stars) stars.material.opacity = nightF * 0.95;
  if (moonDisc) {
    const md = sunLight.position.clone().multiplyScalar(-1);
    const ml = md.length() || 1; md.multiplyScalar(80 / ml);
    moonDisc.position.copy(md);
    moonDisc.visible = e < 0.08;
  }
  const sky = pickSky(e);
  if (scene.background && scene.background.copy) scene.background.copy(sky);
  if (scene.fog && scene.fog.color) scene.fog.color.copy(sky);
  if (sunDisc) {
    const dir = sunLight.position.clone();
    const len = dir.length() || 1; dir.multiplyScalar(78 / len);
    sunDisc.position.copy(dir);
    sunDisc.visible = e > -0.08;
    sunDisc.material.color.setRGB(1, 0.78 + 0.18 * day, 0.55 + 0.40 * day);
  }
}
function flashGear() {
  let el = document.getElementById("gearFlash");
  if (!el) {
    el = document.createElement("div");
    el.id = "gearFlash";
    el.style.cssText = "position:fixed;inset:0;z-index:61;pointer-events:none;opacity:0;transition:opacity 0.4s ease;background:#eaf3ff;";
    document.body.appendChild(el);
  }
  el.style.transition = "opacity 0.05s ease"; el.style.opacity = "0.65";
  setTimeout(function () { el.style.transition = "opacity 0.4s ease"; el.style.opacity = "0"; }, 80);
}
function buildArenaTargets() {
  if (arenaTargets.length) return;
  var spots = [[-13,1.5,40],[13,1.5,40],[0,2.3,47],[-13,1.7,50],[13,1.7,50],[0,1.5,53.5]];
  var postM = new THREE.MeshStandardMaterial({ color: 0x33403a, roughness: 0.8 });
  for (var i = 0; i < spots.length; i++) {
    var sx = spots[i][0], sy = spots[i][1], sz = spots[i][2], r = 0.55;
    var g = new THREE.Group(); g.position.set(sx, 0, sz);
    var post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, sy, 8), postM);
    post.position.y = sy / 2; post.castShadow = true; g.add(post);
    var ring = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.12, 20), new THREE.MeshStandardMaterial({ color: 0xe0a83a, roughness: 0.6 }));
    ring.rotation.x = Math.PI / 2; ring.position.y = sy; ring.castShadow = true; g.add(ring);
    var white = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.62, r * 0.62, 0.14, 20), new THREE.MeshStandardMaterial({ color: 0xf3f6f4, roughness: 0.5 }));
    white.rotation.x = Math.PI / 2; white.position.y = sy; g.add(white);
    var dot = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.26, r * 0.26, 0.16, 16), new THREE.MeshStandardMaterial({ color: 0xd6483b, roughness: 0.5 }));
    dot.rotation.x = Math.PI / 2; dot.position.y = sy; g.add(dot);
    scene.add(g);
    arenaTargets.push({ group: g, x: sx, y: sy, z: sz, r: r, alive: true, respawnAt: 0, spawnT: 1 });
  }
  if (!arenaScoreEl) {
    arenaScoreEl = document.createElement("div");
    arenaScoreEl.id = "arenaScore";
    arenaScoreEl.style.cssText = "position:fixed;left:50%;transform:translateX(-50%);top:calc(env(safe-area-inset-top) + 92px);z-index:18;display:none;padding:7px 15px;border-radius:999px;border:1px solid rgba(120,215,166,.5);background:rgba(10,16,18,.82);color:#cdebd9;font:600 13px/1 system-ui,-apple-system,sans-serif;letter-spacing:.05em;pointer-events:none;white-space:nowrap;";
    document.body.appendChild(arenaScoreEl);
  }
  if (!scoreboardEl) {
    scoreboardEl = document.createElement("div");
    scoreboardEl.id = "arenaBoard";
    scoreboardEl.style.cssText = "position:fixed;left:50%;transform:translateX(-50%);top:calc(env(safe-area-inset-top) + 130px);z-index:18;display:none;flex-direction:column;gap:4px;min-width:200px;max-width:78vw;padding:9px 13px;border-radius:12px;border:1px solid rgba(120,215,166,.35);background:rgba(10,16,18,.78);color:#cdebd9;font:600 12px/1.45 system-ui,-apple-system,sans-serif;letter-spacing:.04em;pointer-events:none;";
    document.body.appendChild(scoreboardEl);
  }
}
function downTarget(t, impactPos, color) {
  try { popSnow(impactPos || new THREE.Vector3(t.x, t.y, t.z), color); } catch (e) {}
  t.alive = false; t.group.visible = false; t.respawnAt = performance.now() + 2200;
}
function refreshArenaScore() {
  if (arenaScoreEl) arenaScoreEl.textContent = "TAGS " + tagScore + "   OUTS " + outScore + "   TARGETS " + arenaScore;
}
function hitArenaTarget(t, impactPos, byMe, idx, color) {
  downTarget(t, impactPos, color);
  if (byMe) {
    arenaScore++; refreshArenaScore(); addFeed("Target hit! +1");
    try { if (channel && connected) channel.send({ type: "broadcast", event: "thit", payload: { idx: idx, c: color } }); } catch (e) {}
  }
}
function updateArenaTargets(dt) {
  if (!arenaTargets.length) return;
  var now = performance.now();
  for (var i = 0; i < arenaTargets.length; i++) {
    var t = arenaTargets[i];
    if (!t.alive) {
      if (now >= t.respawnAt) { t.alive = true; t.group.visible = true; t.spawnT = 0; t.group.scale.setScalar(0.25); }
      continue;
    }
    if (t.spawnT < 0.3) {
      t.spawnT += dt;
      var k = t.spawnT / 0.3; if (k > 1) k = 1;
      var sc = 0.25 + 0.75 * (1 - (1 - k) * (1 - k));
      t.group.scale.setScalar(k >= 1 ? 1 : sc);
    }
  }
}
function renderScoreboard() {
  if (!scoreboardEl) return;
  var rows = [{ name: displayName + " (you)", tags: tagScore, outs: outScore }];
  peers.forEach(function (pl) {
    var t = pl.tags | 0, o = pl.outs | 0;
    if (t > 0 || o > 0 || pl.arena) rows.push({ name: pl.name || "Player", tags: t, outs: o });
  });
  rows.sort(function (a, b) { return (b.tags - a.tags) || (a.outs - b.outs); });
  var html = '<div style="opacity:.72;display:flex;justify-content:space-between;gap:16px;"><span>PLAYER</span><span>TAGS \u00b7 OUTS</span></div>';
  for (var i = 0; i < Math.min(rows.length, 8); i++) {
    var r = rows[i];
    var nm = String(r.name).replace(/[<>&"]/g, "");
    html += '<div style="display:flex;justify-content:space-between;gap:16px;"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:160px;">' + nm + '</span><span>' + (r.tags | 0) + ' \u00b7 ' + (r.outs | 0) + '</span></div>';
  }
  scoreboardEl.innerHTML = html;
}
function updateScoreboard() {
  if (!inArena || !scoreboardEl || scoreboardEl.style.display === "none") return;
  var nw = performance.now();
  if (nw - lastBoardRender < 900) return;
  lastBoardRender = nw;
  renderScoreboard();
}
function updateArenaZone() {
  const now = hasEntered && state.z > 31.5 && state.z < 55 && Math.abs(state.x) < 17;
  if (now === inArena) return;
  inArena = now;
  flashGear();
  if (inArena) { preArenaHeld = heldItem; setHeld("paintgun"); }
  else { setHeld(preArenaHeld); preArenaHeld = null; }
  if (arenaScoreEl) { refreshArenaScore(); arenaScoreEl.style.display = inArena ? "block" : "none"; }
  if (scoreboardEl) { scoreboardEl.style.display = inArena ? "flex" : "none"; if (inArena) { lastBoardRender = performance.now(); renderScoreboard(); } }
}
function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  sendAccumulator += dt;

  updateLocal(dt);
  updateBuildPreview();
  updateDayNight(dt);
  updateCamera(dt);
  updateViewmodel();
  updateProjectiles(dt);
  updateArenaZone();
  updateArenaTargets(dt);
  updateScoreboard();
  updateSnowPuffs(dt);
  updatePaintSplats(dt);
  updateRemotes(dt);
  updateMinds();
  updateNpcs();
  applySpaceVisibility();
  maybeGhostNudge();
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
  const support = supportHeightAt(state.x, state.z, motion.verticalOffset);
  if (input.jumpQueued && motion.onGround && !crouching) {
    motion.verticalVelocity = jumpVelocity;
    motion.onGround = false;
    try { SFX.jump(); } catch (e) {}
  }
  input.jumpQueued = false;

  if (motion.onGround) {
    if (support >= motion.verticalOffset - 0.001 || motion.verticalOffset - support <= 0.6) {
      motion.verticalOffset = support;
    } else {
      motion.onGround = false;
    }
  }
  if (!motion.onGround) {
    motion.verticalVelocity -= gravity * dt;
    motion.verticalOffset += motion.verticalVelocity * dt;
    if (motion.verticalOffset <= support) {
      motion.verticalOffset = support;
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

function updateCamera(dt) {
  if (!hasEntered) {
    previewAngle += dt * 0.085;
    const radius = 24;
    camera.position.set(Math.sin(previewAngle) * radius, 15.5, Math.cos(previewAngle) * radius);
    camera.lookAt(0, 1.2, 0);
    return;
  }
  camera.position.set(state.x, state.y, state.z);
  camera.rotation.y = state.yaw;
  camera.rotation.x = state.pitch;
}

function applySpaceVisibility() {
  const now = performance.now();
  const townVisible = (mySpace === "town");
  for (const remote of remotes.values()) {
    const fresh = !remote.lastUpdate || (now - remote.lastUpdate) < 9000;
    if (remote.group) remote.group.visible = fresh && ((remote.space || "town") === mySpace);
  }
  for (const npc of npcs.values()) { if (npc.group) npc.group.visible = townVisible; }
  for (const actor of mindActors.values()) { if (actor.group) actor.group.visible = townVisible; }
}

function updateRemotes(dt) {
  const blend = Math.min(1, dt * 12);
  const renderT = performance.now() - 120;
  for (const remote of remotes.values()) {
    const buf = remote.buf;
    if (buf && buf.length >= 2 && buf[buf.length - 1].t >= renderT) {
      while (buf.length > 2 && buf[1].t <= renderT) buf.shift();
      const a = buf[0], b = buf[1] || a;
      const span = Math.max(1, b.t - a.t);
      const k = Math.max(0, Math.min(1, (renderT - a.t) / span));
      remote.group.position.set(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, a.z + (b.z - a.z) * k);
      remote.group.rotation.y = lerpAngle(a.yaw, b.yaw, k);
    } else {
      remote.group.position.lerp(remote.target, blend);
      remote.group.rotation.y = lerpAngle(remote.group.rotation.y, remote.targetYaw, blend);
    }
    remote.group.scale.y += (remote.targetScaleY - remote.group.scale.y) * blend;
  }
}

async function loadMinds() {
  try {
    const { data } = await supa.from("agent_state").select("mind, display_name, role, connected").eq("connected", true);
    (data || []).forEach(addMind);
  } catch (e) {}
  try {
    supa.channel("engine-minds")
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_state" }, (p) => {
        const r = p.new; if (!r || !r.mind) return;
        if (r.connected) addMind(r); else removeMind(r.mind);
      })
      .subscribe();
  } catch (e) {}
}

function addMind(m) {
  if (!m || !m.mind || mindActors.has(m.mind)) return;
  let seed = 0;
  for (const c of m.mind) seed += c.charCodeAt(0);
  const actor = createMindActor(m);
  actor.seed = (seed % 100) / 100 * Math.PI * 2;
  actor.mind = m.mind;
  mindActors.set(m.mind, actor);
  scene.add(actor.group);
}

function removeMind(id) {
  const actor = mindActors.get(id);
  if (!actor) return;
  scene.remove(actor.group);
  disposeObject(actor.group);
  mindActors.delete(id);
}

function createMindActor(m) {
  const group = new THREE.Group();
  const tint = new THREE.Color(0x8ad7ff);
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: tint, roughness: 0.3, metalness: 0.1, emissive: 0x2a6f9e, emissiveIntensity: 0.5, transparent: true, opacity: 0.92
  });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, 1.1, 16), bodyMaterial);
  body.position.y = 0.78; group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 18, 14), bodyMaterial);
  head.position.y = 1.5; group.add(head);
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(0.34, 0.04, 8, 24),
    new THREE.MeshStandardMaterial({ color: 0xbfe9ff, emissive: 0x7fd2ff, emissiveIntensity: 0.8 })
  );
  halo.position.y = 1.94; halo.rotation.x = Math.PI / 2; group.add(halo);
  const label = createLabelSprite((m.display_name || m.mind) + (m.role ? " \u00b7 " + m.role : ""), {
    background: "rgba(10, 28, 38, 0.78)", foreground: "#dff4ff", fontSize: 32, scale: 0.0085
  });
  label.position.set(0, 2.3, 0); group.add(label);
  return { group, seed: 0 };
}

function updateMinds() {
  if (mindActors.size === 0) return;
  const t = Date.now();
  for (const actor of mindActors.values()) {
    if (actor.mind === "claude" && askOverlay && askOverlay.style.display === "flex") {
      const fdx = state.x - actor.group.position.x, fdz = state.z - actor.group.position.z;
      if (Math.abs(fdx) + Math.abs(fdz) > 0.0001) actor.group.rotation.y = Math.atan2(fdx, fdz);
      continue;
    }
    const a = t * 0.00010 + actor.seed;
    const x = Math.sin(a) * 9 + Math.sin(a * 0.6 + actor.seed) * 2.5;
    const z = Math.cos(a * 0.8 + actor.seed) * 7 + Math.cos(a * 0.45) * 2.5;
    const cx = Math.max(-worldBounds, Math.min(worldBounds, x));
    const cz = Math.max(-worldBounds, Math.min(worldBounds, z));
    const g = actor.group;
    const dx = cx - g.position.x, dz = cz - g.position.z;
    g.position.x = cx;
    g.position.z = cz;
    g.position.y = Math.sin(t * 0.004 + actor.seed) * 0.05;
    if (Math.abs(dx) + Math.abs(dz) > 0.00001) g.rotation.y = Math.atan2(dx, dz);
  }
}

function buildNpcAvatar(appearance, name) {
  return buildAvatarBody(normalizeAppearance(appearance, name || "Guest"), name || "Guest", true);
}

function convertToNpc(p) {
  if (!p || !p.id || npcs.has(p.id)) return;
  const remote = remotes.get(p.id);
  const known = peers.get(p.id) || {};
  const pos = remote ? remote.group.position.clone() : new THREE.Vector3(0, 0, 8);
  const color = p.color || known.color || "#8aa0a8";
  const name = p.name || known.name || "Guest";
  if (remote) removeRemote(p.id);
  let seed = 0;
  for (const ch of p.id) seed += ch.charCodeAt(0);
  const appearance = normalizeAppearance({ color, pattern: p.appearance?.pattern || known.appearance?.pattern || "plain" }, p.id);
  const group = buildNpcAvatar(appearance, name);
  group.position.copy(pos);
  group.position.y = 0;
  npcs.set(p.id, { group, name, appearanceKey: appearanceSignature(appearance), seed: (seed % 100) / 100 * Math.PI * 2, base: pos.clone() });
  scene.add(group);
  if (npcs.size > 12) removeNpc(npcs.keys().next().value);
}

function removeNpc(id) {
  const npc = npcs.get(id);
  if (!npc) return;
  scene.remove(npc.group);
  disposeObject(npc.group);
  npcs.delete(id);
}

function updateNpcs() {
  if (npcs.size === 0) return;
  const t = Date.now();
  for (const npc of npcs.values()) {
    const a = t * 0.00008 + npc.seed;
    const x = npc.base.x * 0.3 + Math.sin(a) * 6 + Math.sin(a * 0.5 + npc.seed) * 2;
    const z = npc.base.z * 0.3 + Math.cos(a * 0.7 + npc.seed) * 6 + Math.cos(a * 0.4) * 2;
    const cx = Math.max(-worldBounds, Math.min(worldBounds, x));
    const cz = Math.max(-worldBounds, Math.min(worldBounds, z));
    const g = npc.group;
    const dx = cx - g.position.x, dz = cz - g.position.z;
    g.position.x = cx;
    g.position.z = cz;
    if (Math.abs(dx) + Math.abs(dz) > 0.00001) g.rotation.y = Math.atan2(dx, dz);
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

// ---- One-time onboarding nudges (layer 2) ----  (state declared near top, before animate())
function showNudge(kind, text) {
  if (nudgeShown[kind]) return;
  nudgeShown[kind] = true;
  try { localStorage.setItem("hb_nudge_" + kind, "1"); } catch (e) {}
  if (!nudgeEl) {
    nudgeEl = document.createElement("div");
    nudgeEl.id = "nudgeToast";
    nudgeEl.style.cssText = "position:fixed;left:50%;bottom:104px;transform:translateX(-50%) translateY(8px);max-width:min(86vw,430px);background:rgba(10,15,18,0.93);color:#eef3f6;border:1px solid #2c3940;border-radius:12px;padding:12px 14px;font-size:13.5px;line-height:1.42;z-index:99990;box-shadow:0 10px 34px rgba(0,0,0,0.45);opacity:0;transition:opacity .25s ease, transform .25s ease;cursor:pointer;text-align:center;";
    nudgeEl.addEventListener("click", hideNudge);
    document.body.appendChild(nudgeEl);
  }
  nudgeEl.innerHTML = text + '<div style="margin-top:7px;font-size:11px;color:#8aa0a8;">tap to dismiss</div>';
  requestAnimationFrame(() => {
    if (!nudgeEl) return;
    nudgeEl.style.opacity = "1";
    nudgeEl.style.transform = "translateX(-50%) translateY(0)";
  });
  clearTimeout(nudgeTimer);
  nudgeTimer = setTimeout(hideNudge, 7000);
}
function hideNudge() {
  if (!nudgeEl) return;
  nudgeEl.style.opacity = "0";
  nudgeEl.style.transform = "translateX(-50%) translateY(8px)";
}

// Proximity hint: re-readable, shows whenever you're near, hides when you leave
function showHint(text) {
  if (!hintEl) {
    hintEl = document.createElement("div");
    hintEl.id = "proxHint";
    hintEl.style.cssText = "position:fixed;left:50%;top:max(120px, calc(env(safe-area-inset-top, 0px) + 104px));transform:translateX(-50%);max-width:min(88vw,440px);background:rgba(10,15,18,0.92);color:#eef3f6;border:1px solid #2c3940;border-radius:12px;padding:11px 14px;font-size:13px;line-height:1.42;z-index:99970;box-shadow:0 10px 30px rgba(0,0,0,0.4);text-align:center;pointer-events:none;";
    document.body.appendChild(hintEl);
  }
  hintEl.innerHTML = text;
  hintEl.style.display = "block";
}
function hideHint() { if (hintEl) hintEl.style.display = "none"; }

// Re-readable explainer card (room onboarding + reopen via "?")
function showExplainer(title, bodyHtml) {
  if (!explainerEl) {
    explainerEl = document.createElement("div");
    explainerEl.id = "explainer";
    explainerEl.style.cssText = "position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:min(90vw,420px);background:rgba(10,15,18,0.97);color:#eef3f6;border:1px solid #2c3940;border-radius:16px;padding:18px;font-size:14px;line-height:1.5;z-index:100000;box-shadow:0 16px 48px rgba(0,0,0,0.6);";
    document.body.appendChild(explainerEl);
    explainerEl.addEventListener("click", (e) => { if (e.target && e.target.id === "explainerClose") hideExplainer(); });
  }
  explainerEl.innerHTML = '<div style="font-weight:700;font-size:16px;margin-bottom:8px;">' + title + '</div><div style="color:#cfe0e6;">' + bodyHtml + '</div><button id="explainerClose" type="button" style="margin-top:14px;width:100%;padding:10px 12px;border-radius:10px;border:0;background:#9fd0a0;color:#0a1410;font-weight:700;font-size:14px;cursor:pointer;">Got it</button>';
  explainerEl.style.display = "block";
}
function hideExplainer() { if (explainerEl) explainerEl.style.display = "none"; }
function showRoomHelp() {
  showExplainer("Your room", "Walk into any apartment to get your own private room.<br><br>\u2022 Tap a <b>Walls</b> or <b>Floor</b> swatch to recolor.<br>\u2022 Toggle <b>Items</b> (rug, plant, lamp, table) to furnish it.<br>\u2022 Your <b>room code</b> is at the top \u2014 share it so friends can visit.<br>\u2022 Type someone\u2019s code in the <b>Visit</b> box and tap Go to drop into their room.<br><br>Changes save automatically when you\u2019re signed in.");
}
function maybeGhostNudge() {
  if (nudgeShown.ghost || !hasEntered || npcs.size === 0) return;
  for (const npc of npcs.values()) {
    const p = npc.group && npc.group.position;
    if (!p) continue;
    if (Math.hypot(state.x - p.x, state.z - p.z) < 3.6) {
      showNudge("ghost", "That\u2019s someone who stepped away \u2014 their character keeps roaming as a ghost until they return.");
      return;
    }
  }
}

async function loadSurfaces() {
  try {
    const { data } = await ensureSupabase().from("surfaces").select("key,status");
    if (data) { const m = {}; for (const r of data) m[r.key] = r.status; surfaceStatus = m; activeDoor = null; }
  } catch (e) {}
}
function doorStatus(door) {
  return (door && door.surface && surfaceStatus[door.surface]) || "live";
}
function updateActiveDoor() {
  if (inRoom) { doorPrompt.classList.add("hidden"); actionButton.disabled = true; return; }
  let nextDoor = null;
  let bestDistance = Infinity;

  for (const door of doors.concat(doorStructures)) {
    const trigger = door.trigger;
    if (!trigger) continue;
    const dx = state.x - trigger.x;
    const dz = state.z - trigger.z;
    if (Math.abs(dx) > trigger.width / 2 || Math.abs(dz) > trigger.depth / 2) continue;

    const distance = Math.hypot(dx, dz);
    if (distance < bestDistance) {
      bestDistance = distance;
      nextDoor = door;
    }
  }

  let nextPlot = null;
  if (!nextDoor) {
    let bestPlot = Infinity;
    for (const ps of plotList) {
      if (!ps || ps.claimed) continue;
      const t = ps.trigger;
      const dx = state.x - t.x;
      const dz = state.z - t.z;
      if (Math.abs(dx) > t.width / 2 || Math.abs(dz) > t.depth / 2) continue;
      const d = Math.hypot(dx, dz);
      if (d < bestPlot) {
        bestPlot = d;
        nextPlot = ps;
      }
    }
  }

  let nextMind = null;
  if (!nextDoor && !nextPlot) {
    const _claude = mindActors.get("claude");
    if (_claude && _claude.group) {
      const mdx = state.x - _claude.group.position.x;
      const mdz = state.z - _claude.group.position.z;
      if (Math.hypot(mdx, mdz) < 3.0) nextMind = _claude;
    }
  }
  if (activeDoor === nextDoor && activePlot === nextPlot && activeMind === nextMind) return;
  activeDoor = nextDoor;
  activePlot = nextPlot;
  activeMind = nextMind;
  if (activePlot) {
    showHint(myUserId
      ? "<b>Open plot.</b> Walk up and claim it with a GitHub repo \u2014 it becomes a real building everyone can see."
      : "<b>Open plot.</b> Sign in to claim it with a GitHub repo and turn it into a real building everyone can see.");
  } else if (activeDoor && activeDoor.room) {
    showHint("<b>Apartment.</b> Step inside for your own private room \u2014 recolor it, add furniture, and share your room code so friends can visit.");
  } else {
    hideHint();
  }

  for (const door of doors) {
    if (door.pad) door.pad.material.emissiveIntensity = door === activeDoor ? 0.38 : 0.08;
  }

  if (activeDoor) {
    const _ds = doorStatus(activeDoor);
    doorPrompt.classList.remove("hidden");
    if (_ds === "coming_soon") {
      doorPromptText.textContent = `${activeDoor.label} (coming soon)`;
      actionButton.disabled = true;
    } else if (_ds === "preview") {
      doorPromptText.textContent = isTouch ? `Enter ${activeDoor.label} (preview)` : `Press E for ${activeDoor.label} (preview)`;
      actionButton.disabled = false;
    } else {
      doorPromptText.textContent = isTouch ? `Enter ${activeDoor.label}` : `Press E for ${activeDoor.label}`;
      actionButton.disabled = false;
    }
  } else if (activePlot) {
    doorPrompt.classList.remove("hidden");
    doorPromptText.textContent = myUserId
      ? (isTouch ? "Claim this space" : "Press E to claim this space")
      : "Sign in to claim this space";
    actionButton.disabled = false;
  } else if (activeMind) {
    doorPrompt.classList.remove("hidden");
    doorPromptText.textContent = isTouch ? "Talk to Claude" : "Press E to talk to Claude";
    actionButton.disabled = false;
  } else {
    doorPrompt.classList.add("hidden");
    actionButton.disabled = true;
  }
}

// ---- Apartment rooms (your personal space) ----  (state declared near top, before animate())
function buildRoomGroup() {
  roomGroup = new THREE.Group();
  const FW = 11, FD = 11, WH = 3.4, T = 0.3;
  const floorMat = new THREE.MeshStandardMaterial({ color: 0xb8a98f, roughness: 0.92 });
  const floor = new THREE.Mesh(new THREE.BoxGeometry(FW, 0.2, FD), floorMat);
  floor.position.set(0, -0.1, 0); floor.receiveShadow = true; roomGroup.add(floor);
  const ceilMat = new THREE.MeshStandardMaterial({ color: 0x1b2228, roughness: 0.9 });
  const ceil = new THREE.Mesh(new THREE.BoxGeometry(FW, 0.2, FD), ceilMat);
  ceil.position.set(0, WH + 0.1, 0); roomGroup.add(ceil);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x8a9aa6, roughness: 0.85 });
  const wallDefs = [
    { x: 0, z: -FD / 2, w: FW, d: T },
    { x: 0, z: FD / 2, w: FW, d: T },
    { x: -FW / 2, z: 0, w: T, d: FD },
    { x: FW / 2, z: 0, w: T, d: FD }
  ];
  const colliders = [];
  for (const wd of wallDefs) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(wd.w, WH, wd.d), wallMat);
    m.position.set(wd.x, WH / 2, wd.z); m.castShadow = true; roomGroup.add(m);
    colliders.push({ x: wd.x, z: wd.z, width: wd.w, depth: wd.d });
  }
  const exitMat = new THREE.MeshStandardMaterial({ color: 0x9fd0a0, emissive: 0x4f8f5f, emissiveIntensity: 0.55, roughness: 0.5 });
  const exitPad = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 1.6), exitMat);
  exitPad.position.set(0, 0.05, FD / 2 - 1.4); roomGroup.add(exitPad);
  const exitLabel = createLabelSprite("Exit to town", { background: "rgba(10, 20, 14, 0.82)", foreground: "#dff7e2", fontSize: 26, scale: 0.011 });
  exitLabel.position.set(0, 1.4, FD / 2 - 1.4); roomGroup.add(exitLabel);
  roomGroup.userData = { colliders: colliders, floorMat: floorMat, wallMat: wallMat, items: buildRoomItems(roomGroup) };
  roomGroup.visible = false;
  scene.add(roomGroup);
}

function buildRoomItems(group) {
  const items = {};
  const rug = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.06, 3.4), new THREE.MeshStandardMaterial({ color: 0x7a4a4a, roughness: 0.95 }));
  rug.position.set(0, 0.04, -0.6); rug.receiveShadow = true; items.rug = rug;
  const plant = new THREE.Group();
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.24, 0.42, 16), new THREE.MeshStandardMaterial({ color: 0x9c6b4a, roughness: 0.8 })); pot.position.y = 0.21;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.7, 10), new THREE.MeshStandardMaterial({ color: 0x5a4630 })); stem.position.y = 0.72;
  const leaves = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 14), new THREE.MeshStandardMaterial({ color: 0x4f8a52, roughness: 0.85 })); leaves.position.y = 1.25;
  plant.add(pot, stem, leaves); plant.position.set(-3.7, 0, -3.7); items.plant = plant;
  const lamp = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.8, 10), new THREE.MeshStandardMaterial({ color: 0x33414a })); pole.position.y = 0.9;
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 14), new THREE.MeshStandardMaterial({ color: 0xffe6b0, emissive: 0xffca6b, emissiveIntensity: 0.85, roughness: 0.4 })); bulb.position.y = 1.95;
  lamp.add(pole, bulb); lamp.position.set(3.7, 0, -3.7); items.lamp = lamp;
  const table = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x8a6a44, roughness: 0.7 });
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.95), woodMat); top.position.y = 0.66; table.add(top);
  for (const lp of [[-0.65, -0.38], [0.65, -0.38], [-0.65, 0.38], [0.65, 0.38]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.66, 0.1), woodMat); leg.position.set(lp[0], 0.33, lp[1]); table.add(leg);
  }
  table.position.set(3.0, 0, 2.6); items.table = table;
  for (const k in items) { items[k].visible = false; group.add(items[k]); }
  return items;
}

function normalizeRoomLayout(layout) {
  const hex = (v, d) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v)) ? v.toLowerCase() : d;
  layout = (layout && typeof layout === "object") ? layout : {};
  const it = (layout.items && typeof layout.items === "object") ? layout.items : {};
  return {
    wall: hex(layout.wall, "#8a9aa6"),
    floor: hex(layout.floor, "#b8a98f"),
    items: { rug: !!it.rug, plant: !!it.plant, lamp: !!it.lamp, table: !!it.table }
  };
}

function applyRoomLayout() {
  if (!roomGroup || !roomGroup.userData) return;
  const L = isOwnRoom() ? myRoomLayout : (activeRoomLayout || myRoomLayout);
  try {
    if (roomGroup.userData.wallMat) roomGroup.userData.wallMat.color.set(L.wall);
    if (roomGroup.userData.floorMat) roomGroup.userData.floorMat.color.set(L.floor);
    const objs = roomGroup.userData.items || {};
    const want = L.items || {};
    for (const k in objs) { objs[k].visible = !!want[k]; }
  } catch (e) {}
}

function setRoomColor(target, hex) {
  if (target !== "wall" && target !== "floor") return;
  if (!isOwnRoom()) return;
  myRoomLayout[target] = hex;
  applyRoomLayout();
  document.querySelectorAll('#roomPanel [data-rt="' + target + '"]').forEach((bn) => {
    bn.style.borderColor = (bn.getAttribute("data-rc") === hex) ? "#eef3f6" : "transparent";
  });
  const st = document.getElementById("roomSaveStatus");
  if (!myUserId) { if (st) st.textContent = "Guest \u2014 changes won't save"; return; }
  if (st) st.textContent = "Saving\u2026";
  clearTimeout(roomSaveTimer);
  roomSaveTimer = setTimeout(saveRoomLayout, 350);
}

async function saveRoomLayout() {
  if (!myUserId) return;
  const st = document.getElementById("roomSaveStatus");
  try {
    const { error } = await ensureSupabase().rpc("set_world_room_layout", { p_layout: myRoomLayout });
    if (error) throw error;
    if (st) st.textContent = "Saved.";
  } catch (e) {
    if (st) st.textContent = "Could not save room.";
  }
}

function toggleRoomItem(key) {
  if (!isOwnRoom()) return;
  if (!myRoomLayout.items) myRoomLayout.items = { rug: false, plant: false, lamp: false, table: false };
  myRoomLayout.items[key] = !myRoomLayout.items[key];
  applyRoomLayout();
  const bn = document.querySelector('#roomPanel [data-it="' + key + '"]');
  if (bn) {
    const on = myRoomLayout.items[key];
    bn.style.background = on ? "#9fd0a0" : "transparent";
    bn.style.color = on ? "#0a1410" : "#cfe0e6";
    bn.style.borderColor = on ? "#9fd0a0" : "#3a4750";
  }
  const st = document.getElementById("roomSaveStatus");
  if (!myUserId) { if (st) st.textContent = "Guest \u2014 changes won't save"; return; }
  if (st) st.textContent = "Saving\u2026";
  clearTimeout(roomSaveTimer);
  roomSaveTimer = setTimeout(saveRoomLayout, 350);
}

function roomItemRow() {
  const defs = [["rug", "Rug"], ["plant", "Plant"], ["lamp", "Lamp"], ["table", "Table"]];
  const want = myRoomLayout.items || {};
  return defs.map((d) => {
    const on = !!want[d[0]];
    return '<button type="button" data-it="' + d[0] + '" style="padding:6px 11px;border-radius:8px;border:1px solid ' + (on ? "#9fd0a0" : "#3a4750") + ';background:' + (on ? "#9fd0a0" : "transparent") + ';color:' + (on ? "#0a1410" : "#cfe0e6") + ';font-size:12px;font-weight:600;cursor:pointer;">' + d[1] + '</button>';
  }).join("");
}

function roomSwatchRow(target) {
  const colors = target === "wall"
    ? ["#8a9aa6","#6f7e8c","#42505c","#a8b6a0","#c8a99a","#9a8fb0"]
    : ["#b8a98f","#9c8f72","#caa56f","#8f9c8a","#a98f9c","#5c5448"];
  return colors.map((c) => {
    const sel = (myRoomLayout[target] === c) ? "#eef3f6" : "transparent";
    return '<button type="button" data-rt="' + target + '" data-rc="' + c + '" style="width:26px;height:26px;border-radius:50%;border:2px solid ' + sel + ';background:' + c + ';cursor:pointer;padding:0;flex:none;"></button>';
  }).join("");
}

async function loadHomeEligibility() {
  try {
    const { data, error } = await ensureSupabase().rpc("home_eligibility");
    if (!error && Array.isArray(data) && data[0]) {
      myHomeEligible = !!data[0].eligible;
      myHasHome = !!data[0].has_home;
    }
  } catch (e) {}
}

async function loadRoomCode() {
  if (myRoomCode || !myUserId) return;
  try {
    const { data, error } = await ensureSupabase().rpc("ensure_room_code");
    if (error) throw error;
    if (data) { myRoomCode = String(data); if (inRoom && isOwnRoom()) showRoomPanel(); }
  } catch (e) {}
}

async function visitByCode(code) {
  code = String(code || "").trim();
  const msg = document.getElementById("roomVisitMsg");
  if (!/^[0-9]{6}$/.test(code)) { if (msg) msg.textContent = "Enter a 6-digit room code."; return; }
  const selfId = myUserId || selfRealtimeId();
  if (myRoomCode && code === myRoomCode) { visitRoom(selfId); return; }
  if (msg) msg.textContent = "Finding room\u2026";
  try {
    const { data, error } = await ensureSupabase().rpc("resolve_room_code", { p_code: code });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || !row.auth_user_id) { if (msg) msg.textContent = "No room found for code " + code + "."; return; }
    if (!inRoom) return;
    roomOwnerId = row.auth_user_id;
    roomOwnerName = sanitizeDisplayName(row.display_name || "Resident");
    activeRoomLayout = normalizeRoomLayout(row.room_layout);
    mySpace = "room:" + roomOwnerId;
    applyRoomLayout();
    showRoomPanel();
    try { trackSelf(); sendState(true); } catch (e) {}
  } catch (e) {
    if (msg) msg.textContent = "Couldn't reach the directory. Try again.";
  }
}

function isOwnRoom() {
  return !roomOwnerId || roomOwnerId === (myUserId || selfRealtimeId());
}

function visitRoom(ownerId) {
  if (!inRoom) return;
  const selfId = myUserId || selfRealtimeId();
  if (!ownerId || ownerId === selfId) {
    roomOwnerId = selfId; roomOwnerName = displayName; activeRoomLayout = null;
  } else {
    const ch = characters.get(ownerId);
    roomOwnerId = ownerId; roomOwnerName = ch ? characterName(ch) : "Resident";
    activeRoomLayout = normalizeRoomLayout(ch && ch.room_layout);
  }
  mySpace = "room:" + roomOwnerId;
  applyRoomLayout();
  showRoomPanel();
  try { trackSelf(); sendState(true); } catch (e) {}
}

function roomVisitRow() {
  const selfId = myUserId || selfRealtimeId();
  const back = !isOwnRoom()
    ? '<button type="button" data-visit="' + selfId + '" style="padding:7px 11px;border-radius:8px;border:1px solid #3a4750;background:transparent;color:#cfe0e6;font-size:12px;font-weight:600;cursor:pointer;flex:none;">\u2190 My room</button>'
    : "";
  return '<input id="roomVisitInput" type="text" inputmode="numeric" autocomplete="off" maxlength="6" placeholder="Room code" style="width:90px;padding:7px 9px;border-radius:8px;border:1px solid #3a4750;background:#0e1519;color:#eef3f6;font-size:16px;outline:none;flex:none;">' +
    '<button id="roomVisitGo" type="button" style="padding:7px 14px;border-radius:8px;border:0;background:#9fd0a0;color:#0a1410;font-size:12px;font-weight:700;cursor:pointer;flex:none;">Go</button>' +
    back +
    '<span id="roomVisitMsg" style="font-size:11px;color:#8aa0a8;flex:1 1 100%;"></span>';
}

function showRoomPanel() {
  let p = document.getElementById("roomPanel");
  if (!p) {
    p = document.createElement("div");
    p.id = "roomPanel";
    p.style.cssText = "position:fixed;left:50%;top:max(120px, calc(env(safe-area-inset-top, 0px) + 104px));transform:translateX(-50%);display:flex;flex-direction:column;gap:8px;align-items:stretch;background:rgba(10,15,18,0.94);border:1px solid #2c3940;border-radius:14px;padding:11px 13px;z-index:99980;color:#eef3f6;font-size:13px;box-shadow:0 10px 30px rgba(0,0,0,0.45);width:min(92vw,360px);";
    document.body.appendChild(p);
    try { roomPanelCollapsed = localStorage.getItem("hb_room_collapsed") === "1"; } catch (e) {}
    p.addEventListener("click", (e) => {
      const t = e.target;
      if (!t) return;
      if (t.id === "roomCollapseBtn") { roomPanelCollapsed = !roomPanelCollapsed; try { localStorage.setItem("hb_room_collapsed", roomPanelCollapsed ? "1" : "0"); } catch (er) {} showRoomPanel(); return; }
      if (t.id === "roomHelpBtn") { showRoomHelp(); return; }
      if (t.id === "roomExitBtn") { exitRoom(); return; }
      if (t.id === "roomVisitGo") { const el = document.getElementById("roomVisitInput"); visitByCode(el ? el.value : ""); return; }
      if (t.getAttribute && t.getAttribute("data-visit")) { visitRoom(t.getAttribute("data-visit")); return; }
      if (t.getAttribute && t.getAttribute("data-it")) { toggleRoomItem(t.getAttribute("data-it")); return; }
      if (t.getAttribute && t.getAttribute("data-rt")) setRoomColor(t.getAttribute("data-rt"), t.getAttribute("data-rc"));
    });
  }
  const own = isOwnRoom();
  const collapsed = roomPanelCollapsed;
  const title = own ? "Your room" : ("Visiting " + (roomOwnerName || "a room"));
  const toggleBtn = '<button id="roomCollapseBtn" type="button" aria-label="' + (collapsed ? "Expand room panel" : "Minimize room panel") + '" style="width:30px;height:30px;border-radius:8px;border:1px solid #3a4750;background:transparent;color:#cfe0e6;font-size:18px;line-height:1;font-weight:700;cursor:pointer;padding:0;flex:none;">' + (collapsed ? "+" : "\u2013") + '</button>';
  const helpBtn = collapsed ? "" : '<button id="roomHelpBtn" type="button" aria-label="How rooms work" style="width:30px;height:30px;border-radius:8px;border:1px solid #3a4750;background:transparent;color:#cfe0e6;font-size:15px;line-height:1;font-weight:700;cursor:pointer;padding:0;flex:none;">?</button>';
  const statusSpan = collapsed ? "" : '<span id="roomSaveStatus" style="font-size:11px;color:#8aa0a8;"></span>';
  let html =
    '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;"><span style="font-weight:700;">' + title + '</span><div style="display:flex;align-items:center;gap:8px;">' + statusSpan + helpBtn + toggleBtn + '</div></div>';
  if (!collapsed) {
    if (own) {
      html +=
        '<div style="font-size:11px;color:#9fb0b8;">' + (myRoomCode ? ('Your code <b style="color:#eef3f6;letter-spacing:1px;font-size:13px;">' + myRoomCode + '</b> \u2014 share it to invite') : (myUserId ? 'Your code \u2014 loading\u2026' : 'Sign in to get a shareable code')) + '</div>' +
        '<div style="display:flex;align-items:center;gap:8px;"><span style="width:40px;font-size:11px;color:#9fb0b8;">Walls</span><div style="display:flex;gap:7px;flex-wrap:wrap;">' + roomSwatchRow("wall") + '</div></div>' +
        '<div style="display:flex;align-items:center;gap:8px;"><span style="width:40px;font-size:11px;color:#9fb0b8;">Floor</span><div style="display:flex;gap:7px;flex-wrap:wrap;">' + roomSwatchRow("floor") + '</div></div>' +
        '<div style="display:flex;align-items:center;gap:8px;"><span style="width:40px;font-size:11px;color:#9fb0b8;">Items</span><div style="display:flex;gap:7px;flex-wrap:wrap;">' + roomItemRow() + '</div></div>';
    }
    html +=
      '<div style="display:flex;align-items:flex-start;gap:8px;"><span style="width:40px;font-size:11px;color:#9fb0b8;padding-top:5px;">Visit</span><div style="display:flex;gap:7px;flex-wrap:wrap;">' + roomVisitRow() + '</div></div>' +
      '<button id="roomExitBtn" type="button" style="margin-top:2px;padding:9px 12px;border-radius:9px;border:0;background:#9fd0a0;color:#0a1410;font-weight:700;font-size:13px;cursor:pointer;">Exit to town</button>';
  }
  p.innerHTML = html;
  p.style.display = "flex";
  p.style.width = collapsed ? "auto" : "min(92vw,360px)";
  p.style.padding = collapsed ? "7px 12px" : "11px 13px";
  if (!collapsed) { const vi = document.getElementById("roomVisitInput"); if (vi) vi.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); visitByCode(vi.value); } }); }
  if (!collapsed && own && !myUserId) { const st = document.getElementById("roomSaveStatus"); if (st) st.textContent = "Guest \u2014 won't save"; }
}

function hideRoomPanel() {
  const p = document.getElementById("roomPanel");
  if (p) p.style.display = "none";
}

function enterRoom() {
  if (inRoom) return;
  try {
    if (!roomGroup) buildRoomGroup();
    townReturn = { x: state.x, z: state.z, yaw: state.yaw };
    hiddenForRoom = [];
    for (const o of scene.children) {
      if (o === roomGroup || o === camera || o.isLight) continue;
      if (o.visible) { hiddenForRoom.push(o); o.visible = false; }
    }
    roomOwnerId = myUserId || selfRealtimeId();
    roomOwnerName = displayName;
    activeRoomLayout = null;
    roomGroup.visible = true;
    applyRoomLayout();
    savedTownColliders = buildingColliders.slice();
    buildingColliders.length = 0;
    for (const c of roomGroup.userData.colliders) buildingColliders.push(c);
    state.x = 0; state.z = 2.6; state.yaw = Math.PI;
    inRoom = true;
    mySpace = "room:" + (myUserId || selfRealtimeId());
    showRoomPanel();
    doorPrompt.classList.add("hidden");
    try { trackSelf(); sendState(true); } catch (e) {}
    try { if (localStorage.getItem("hb_seen_room") !== "1") { localStorage.setItem("hb_seen_room", "1"); showRoomHelp(); } } catch (e) {}
  } catch (e) {
    try { forceExitRoom(); } catch (_) {}
  }
}

function exitRoom() {
  if (!inRoom) return;
  try {
    if (roomGroup) roomGroup.visible = false;
    for (const o of hiddenForRoom) o.visible = true;
    hiddenForRoom = [];
    if (savedTownColliders) {
      buildingColliders.length = 0;
      for (const c of savedTownColliders) buildingColliders.push(c);
      savedTownColliders = null;
    }
    state.x = townReturn.x; state.z = townReturn.z; state.yaw = townReturn.yaw;
    inRoom = false;
    mySpace = "town";
    roomOwnerId = null; roomOwnerName = ""; activeRoomLayout = null;
    hideRoomPanel();
    try { trackSelf(); sendState(true); } catch (e) {}
  } catch (e) {
    forceExitRoom();
  }
}

function forceExitRoom() {
  if (roomGroup) roomGroup.visible = false;
  for (const o of scene.children) { if (o === roomGroup) continue; o.visible = true; }
  if (savedTownColliders) {
    buildingColliders.length = 0;
    for (const c of savedTownColliders) buildingColliders.push(c);
    savedTownColliders = null;
  }
  inRoom = false;
  mySpace = "town";
  roomOwnerId = null; roomOwnerName = ""; activeRoomLayout = null;
  hideRoomPanel();
}

function enterActiveDoor() {
  if (activeDoor) {
    if (activeDoor.room) { enterRoom(); return; }
    if (doorStatus(activeDoor) === "coming_soon") { return; }
    const target = window.top || window;
    target.location.assign(activeDoor.path);
    return;
  }
  if (activePlot) { openClaim(activePlot); return; }
  if (activeMind) { openAsk(); }
}

// ---- Claimable spaces ----
let currentClaimPlot = null;
document.body.insertAdjacentHTML("beforeend", `
<div id="claimOverlay" style="position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(6,10,12,.62);z-index:100000;padding:18px;">
  <div style="width:min(430px,92vw);background:#0e1417;border:1px solid #243036;border-radius:14px;padding:18px;color:#dfe6ec;font-family:system-ui,-apple-system,sans-serif;box-shadow:0 18px 50px rgba(0,0,0,.5);">
    <div style="font-size:15px;font-weight:600;margin-bottom:6px;">Claim this space</div>
    <div style="font-size:12.5px;opacity:.78;line-height:1.5;margin-bottom:13px;">Paste a GitHub link to a project. It becomes a building here that everyone in the world can see.</div>
    <input id="claimInput" type="url" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://github.com/you/your-project" style="width:100%;box-sizing:border-box;padding:11px 12px;border-radius:9px;border:1px solid #2c3940;background:#0a0f12;color:#eef3f6;font-size:16px;">
    <div id="claimError" style="font-size:12px;color:#e69191;min-height:16px;margin:6px 0 10px;"></div>
    <div style="display:flex;gap:10px;">
      <button id="claimCancel" style="flex:1;padding:11px;border-radius:9px;border:1px solid #2c3940;background:transparent;color:#cdd6db;font-size:14px;cursor:pointer;">Cancel</button>
      <button id="claimSubmit" style="flex:1;padding:11px;border-radius:9px;border:0;background:#9fd0a0;color:#0a1410;font-weight:600;font-size:14px;cursor:pointer;">Claim</button>
    </div>
    <div id="homeSection" style="display:none;border-top:1px solid #243036;margin-top:15px;padding-top:13px;">
      <div style="font-size:13px;font-weight:600;margin-bottom:3px;">Or make this your home</div>
      <div style="font-size:11.5px;opacity:.72;margin-bottom:9px;">A personal place in the world \u2014 not tied to a repo.</div>
      <div id="homeStyles" style="display:flex;gap:7px;margin-bottom:9px;">
        <button type="button" class="homeStyleBtn" data-style="modern" style="flex:1;padding:8px 4px;border-radius:8px;border:1px solid #2c3940;background:#0a0f12;color:#dfe6ec;font-size:12.5px;cursor:pointer;">Modern</button>
        <button type="button" class="homeStyleBtn" data-style="dome" style="flex:1;padding:8px 4px;border-radius:8px;border:1px solid #2c3940;background:#0a0f12;color:#dfe6ec;font-size:12.5px;cursor:pointer;">Dome</button>
        <button type="button" class="homeStyleBtn" data-style="pod" style="flex:1;padding:8px 4px;border-radius:8px;border:1px solid #2c3940;background:#0a0f12;color:#dfe6ec;font-size:12.5px;cursor:pointer;">Pod</button>
      </div>
      <input id="homeTitleInput" maxlength="28" autocomplete="off" placeholder="Name your home" style="width:100%;box-sizing:border-box;padding:10px 12px;border-radius:9px;border:1px solid #2c3940;background:#0a0f12;color:#eef3f6;font-size:14px;">
      <div id="homeError" style="font-size:12px;color:#e69191;min-height:15px;margin:6px 0 9px;"></div>
      <button id="homeCreate" style="width:100%;padding:11px;border-radius:9px;border:0;background:#cda16a;color:#1a1208;font-weight:600;font-size:14px;cursor:pointer;">Create home</button>
    </div>
    <div id="homeLocked" style="display:none;font-size:11.5px;opacity:.7;border-top:1px solid #243036;margin-top:15px;padding-top:12px;line-height:1.5;">Personal homes unlock after 30 days \u2014 or right away once you've claimed a space or customized a room.</div>
  </div>
</div>`);
const claimOverlay = document.querySelector("#claimOverlay");
const claimInput = document.querySelector("#claimInput");
const claimError = document.querySelector("#claimError");
document.querySelector("#claimCancel").addEventListener("click", closeClaim);
document.querySelector("#claimSubmit").addEventListener("click", submitClaim);
claimOverlay.addEventListener("click", (e) => { if (e.target === claimOverlay) closeClaim(); });
claimInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); submitClaim(); } });
document.querySelectorAll(".homeStyleBtn").forEach((btn) => btn.addEventListener("click", () => { selectedHomeStyle = btn.getAttribute("data-style") || "modern"; updateHomeStyleButtons(); }));
const homeCreateBtn = document.querySelector("#homeCreate");
if (homeCreateBtn) homeCreateBtn.addEventListener("click", submitHome);
const homeTitleEl = document.querySelector("#homeTitleInput");
if (homeTitleEl) homeTitleEl.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); submitHome(); } });

function updateHomeStyleButtons() {
  document.querySelectorAll(".homeStyleBtn").forEach((btn) => {
    const on = btn.getAttribute("data-style") === selectedHomeStyle;
    btn.style.borderColor = on ? "#cda16a" : "#2c3940";
    btn.style.background = on ? "#2a2014" : "#0a0f12";
    btn.style.color = on ? "#ffe9cf" : "#dfe6ec";
  });
}

function openClaim(plotState) {
  currentClaimPlot = plotState;
  claimInput.value = "";
  claimError.textContent = "";
  const homeSection = document.querySelector("#homeSection");
  const homeLocked = document.querySelector("#homeLocked");
  const homeError = document.querySelector("#homeError");
  const homeTitle = document.querySelector("#homeTitleInput");
  if (homeError) homeError.textContent = "";
  if (homeTitle) homeTitle.value = "";
  const canHome = !!myUserId && myHomeEligible && !myHasHome;
  if (homeSection) homeSection.style.display = canHome ? "block" : "none";
  if (homeLocked) homeLocked.style.display = (!!myUserId && !myHomeEligible) ? "block" : "none";
  if (canHome) { selectedHomeStyle = "modern"; updateHomeStyleButtons(); }
  try { document.exitPointerLock && document.exitPointerLock(); } catch (e) {}
  claimOverlay.style.display = "flex";
  setTimeout(() => { try { claimInput.focus(); } catch (e) {} }, 30);
}

async function submitHome() {
  const homeError = document.querySelector("#homeError");
  const homeTitle = document.querySelector("#homeTitleInput");
  if (!currentClaimPlot) return;
  if (!myUserId) { if (homeError) homeError.textContent = "Sign in first."; return; }
  if (!supa) { if (homeError) homeError.textContent = "Still connecting \u2014 try again in a moment."; return; }
  const title = (homeTitle && homeTitle.value || "").trim();
  if (homeError) homeError.textContent = "Creating\u2026";
  try {
    const { data, error } = await supa.rpc("claim_home", { p_plot: currentClaimPlot.index, p_style: selectedHomeStyle, p_title: title });
    const res = data || {};
    if (error || !res.ok) {
      const code = res.error || "";
      if (homeError) homeError.textContent =
        code === "plot_taken" ? "That spot was just taken." :
        code === "already_home" ? "You already have a home \u2014 one per person for now." :
        code === "not_eligible" ? "Not eligible yet \u2014 30 days, or claim a space / customize a room first." :
        "Could not create the home.";
      return;
    }
    applyHome(currentClaimPlot, { home_style: res.home_style, home_title: res.home_title, claimed_by: res.claimed_by || displayName });
    addFeed(displayName + " built a home: " + res.home_title);
    myHasHome = true;
    closeClaim();
  } catch (e) {
    if (homeError) homeError.textContent = "Could not create the home.";
  }
}

function closeClaim() {
  claimOverlay.style.display = "none";
  currentClaimPlot = null;
  resetViewportAfterInput(claimInput);
}

// ---- Ask Claude (in-world guide) ----
document.body.insertAdjacentHTML("beforeend", `
<button id="askLaunch" style="position:fixed;left:10px;top:46%;transform:translateY(-50%);display:none;z-index:70;padding:9px 12px;border-radius:11px;border:1px solid #2c3940;background:rgba(12,16,19,.92);color:#dfe6ec;font-size:13px;font-weight:600;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.4);">Ask Claude</button>
<div id="askOverlay" style="position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(6,10,12,.62);z-index:100000;padding:18px;">
  <div style="width:min(440px,94vw);max-height:80vh;display:flex;flex-direction:column;background:#0e1417;border:1px solid #243036;border-radius:14px;padding:16px;color:#dfe6ec;font-family:system-ui,-apple-system,sans-serif;box-shadow:0 18px 50px rgba(0,0,0,.5);">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
      <div style="font-size:15px;font-weight:600;">Ask Claude</div>
      <button id="askClose" style="background:transparent;border:0;color:#9fb0bb;font-size:22px;line-height:1;cursor:pointer;padding:0 6px;">\u00d7</button>
    </div>
    <div style="font-size:12px;opacity:.7;line-height:1.5;margin-bottom:10px;">Claude is here as a guide to the world \u2014 ask about getting around, claiming a spot, or what this place is.</div>
    <div id="askLog" style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;display:flex;flex-direction:column;gap:9px;margin-bottom:10px;min-height:60px;"></div>
    <div style="display:flex;gap:8px;">
      <input id="askInput" type="text" autocomplete="off" placeholder="Ask Claude\u2026" style="flex:1;box-sizing:border-box;padding:11px 12px;border-radius:9px;border:1px solid #2c3940;background:#0a0f12;color:#eef3f6;font-size:16px;">
      <button id="askSend" style="padding:11px 15px;border-radius:9px;border:0;background:#9fd0a0;color:#0a1410;font-weight:600;font-size:14px;cursor:pointer;">Send</button>
    </div>
  </div>
</div>`);
const askOverlay = document.querySelector("#askOverlay");
const askLog = document.querySelector("#askLog");
const askInput = document.querySelector("#askInput");
const askSend = document.querySelector("#askSend");
const askLaunch = document.querySelector("#askLaunch");
function addAskBubble(role, text) {
  const wrap = document.createElement("div");
  wrap.style.cssText = "display:flex;" + (role === "you" ? "justify-content:flex-end;" : "justify-content:flex-start;");
  const b = document.createElement("div");
  b.textContent = text;
  b.style.cssText = "max-width:82%;padding:9px 12px;border-radius:12px;font-size:13.5px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere;" + (role === "you" ? "background:#274b30;color:#eaf6ec;border-bottom-right-radius:4px;" : "background:#141b20;color:#dfe6ec;border:1px solid #243036;border-bottom-left-radius:4px;");
  wrap.appendChild(b);
  askLog.appendChild(wrap);
  askLog.scrollTop = askLog.scrollHeight;
  return b;
}
function openAsk() {
  try { document.exitPointerLock && document.exitPointerLock(); } catch (e) {}
  askOverlay.style.display = "flex";
  if (!askLog.childElementCount) addAskBubble("claude", "Hey \u2014 I'm Claude, your guide here. Ask me anything about the world.");
  setTimeout(() => { try { askInput.focus(); } catch (e) {} }, 30);
}
function resetViewportAfterInput(inp) {
  try { if (inp) inp.blur(); } catch (e) {}
  try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } catch (e) {}
  var doReset = function () {
    try { window.scrollTo(0, 0); } catch (e) {}
    try { document.body.scrollTop = 0; } catch (e) {}
    try { if (document.documentElement) document.documentElement.scrollTop = 0; } catch (e) {}
    try { if (document.scrollingElement) document.scrollingElement.scrollTop = 0; } catch (e) {}
  };
  doReset();
  setTimeout(doReset, 60);
  setTimeout(doReset, 250);
  setTimeout(doReset, 450);
}
function closeAsk() { askOverlay.style.display = "none"; resetViewportAfterInput(askInput); }
async function sendAsk() {
  const msg = (askInput.value || "").trim();
  if (!msg) return;
  askInput.value = "";
  addAskBubble("you", msg);
  askSend.disabled = true;
  const pending = addAskBubble("claude", "\u2026");
  try {
    const r = await fetch("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: msg }) });
    const data = await r.json();
    const reply = (data && data.reply) ? String(data.reply) : "";
    if (reply) pending.textContent = reply;
    else if (data && data.note === "rate_limited") pending.textContent = "You\u2019ve asked a few times just now, so the guide is taking a short breather. Try again in a bit.";
    else if (data && data.note === "not_configured") pending.textContent = "The guide is offline right now \u2014 check back soon.";
    else pending.textContent = "Couldn't reach the guide just now \u2014 try again in a moment.";
  } catch (e) {
    pending.textContent = "Couldn't reach the guide just now \u2014 try again in a moment.";
  }
  askSend.disabled = false;
  askLog.scrollTop = askLog.scrollHeight;
}
if (askLaunch) askLaunch.addEventListener("click", openAsk);
document.querySelector("#askClose").addEventListener("click", closeAsk);
askSend.addEventListener("click", sendAsk);
askInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); sendAsk(); } });
askOverlay.addEventListener("click", (e) => { if (e.target === askOverlay) closeAsk(); });
const _askEnterBtn = document.querySelector("#enterButton");
if (_askEnterBtn) _askEnterBtn.addEventListener("click", () => { if (askLaunch) askLaunch.style.display = "flex"; });


function parseRepoName(url) {
  try {
    const u = new URL(url.trim());
    if (!/(^|\.)github\.com$/i.test(u.hostname)) return null;
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    return parts[1].replace(/\.git$/i, "");
  } catch (e) { return null; }
}

function parseRepoParts(url) {
  try {
    const u = new URL(url || "");
    if (!/(^|\.)github\.com$/i.test(u.hostname)) return null;
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    return {
      owner: parts[0],
      repo: parts[1].replace(/\.git$/i, "")
    };
  } catch (e) {
    return null;
  }
}

async function submitClaim() {
  if (!currentClaimPlot) return;
  if (!myUserId) {
    claimError.textContent = "Sign in to claim a permanent space. Guests can look around live, then disappear when they leave.";
    return;
  }
  const url = claimInput.value.trim();
  const repo = parseRepoName(url);
  if (!repo) { claimError.textContent = "Enter a full GitHub link (github.com/owner/project)."; return; }
  if (!supa) { claimError.textContent = "Still connecting — try again in a moment."; return; }
  claimError.textContent = "Claiming…";
  try {
    const { error } = await supa.from("world_spaces").insert({
      plot: currentClaimPlot.index,
      github_url: url,
      project_name: repo,
      claimed_by: displayName
    });
    if (error) {
      claimError.textContent = /duplicate|unique/i.test(error.message || "")
        ? "That spot was just claimed by someone else."
        : "Could not save the claim.";
      return;
    }
    applyClaim(currentClaimPlot, { project_name: repo, github_url: url });
    addFeed(`${displayName} claimed a space: ${repo}`);
    closeClaim();
  } catch (e) {
    claimError.textContent = "Could not save the claim.";
  }
}

function applyClaim(plotState, data) {
  if (!plotState) return;
  const meta = normalizeRepoMetadata(data?.repo_metadata);
  const repoParts = parseRepoParts(data?.github_url);
  const projectName = meta.name || data.project_name || repoParts?.repo || "Claimed space";
  const palette = claimedSpacePalette(data, meta);
  const language = meta.language || "";
  const metaBits = [];
  if (language) metaBits.push(language);
  if (Number.isFinite(meta.stars) && meta.stars > 0) metaBits.push("\u2605 " + meta.stars);
  if (meta.topics && meta.topics.length) metaBits.push("#" + meta.topics[0]);
  const metaText = metaBits.join("  \u00b7  ");
  plotState.claimed = true;
  plotState.github_url = data.github_url;
  if (plotState === activePlot) { activePlot = null; }
  if (plotState.sign) { try { scene.remove(plotState.sign); } catch (e) {} }
  if (plotState.metaSign) { try { scene.remove(plotState.metaSign); } catch (e) {} }
  const label = createLabelSprite(projectName, {
    background: palette.labelBackground,
    foreground: palette.labelForeground,
    fontSize: 32,
    scale: 0.014
  });
  label.position.set(plotState.x, metaText ? 2.38 : 2.15, plotState.z);
  scene.add(label);
  plotState.sign = label;
  if (metaText) {
    const metaLabel = createLabelSprite(metaText, {
      background: "rgba(8, 12, 14, 0.78)",
      foreground: "#f6fbff",
      fontSize: 24,
      scale: 0.01,
      paddingX: 15,
      paddingY: 8
    });
    metaLabel.position.set(plotState.x, 1.92, plotState.z);
    scene.add(metaLabel);
    plotState.metaSign = metaLabel;
  }
  if (!plotState.built) {
    plotState.built = true;
    plotState.bodyMaterial = new THREE.MeshStandardMaterial({ color: palette.body, roughness: 0.72 });
    plotState.roofMaterial = new THREE.MeshStandardMaterial({ color: palette.roof, roughness: 0.6 });
    plotState.accentMaterial = new THREE.MeshStandardMaterial({ color: palette.accent, roughness: 0.46, metalness: 0.03 });
    const w = plotState.width * 0.66, d = plotState.depth * 0.66;
    plotState.bodyMesh = addBox(plotState.x, 0.9, plotState.z, w, 1.8, d, plotState.bodyMaterial);
    plotState.roofMesh = addBox(plotState.x, 1.92, plotState.z, w + 0.34, 0.42, d + 0.34, plotState.roofMaterial);
    plotState.accentMesh = addBox(plotState.x, 1.82, plotState.z - d / 2 - 0.035, w * 0.42, 0.12, 0.08, plotState.accentMaterial);
  } else {
    plotState.bodyMaterial?.color.setHex(palette.body);
    plotState.roofMaterial?.color.setHex(palette.roof);
    plotState.accentMaterial?.color.setHex(palette.accent);
  }
}

function normalizeRepoMetadata(metadata) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  return {
    name: sanitizeDisplayName(metadata.name || metadata.repo || ""),
    full_name: typeof metadata.full_name === "string" ? metadata.full_name.slice(0, 80) : "",
    description: typeof metadata.description === "string" ? metadata.description.slice(0, 220) : "",
    homepage: typeof metadata.homepage === "string" ? metadata.homepage.slice(0, 180) : "",
    language: typeof metadata.language === "string" ? metadata.language.slice(0, 24) : "",
    topics: Array.isArray(metadata.topics) ? metadata.topics.filter((t) => typeof t === "string").slice(0, 8) : [],
    stars: Number.isFinite(metadata.stars) ? metadata.stars : Number.isFinite(metadata.stargazers_count) ? metadata.stargazers_count : null,
    pushed_at: typeof metadata.pushed_at === "string" ? metadata.pushed_at : ""
  };
}

function claimedSpacePalette(data, meta) {
  const seed = `${data?.github_url || ""}|${meta.language || ""}|${data?.project_name || ""}`;
  const palettes = [
    { body: 0x86b59a, roof: 0x466b57, accent: 0xdff7e2, labelBackground: "rgba(14, 22, 18, 0.86)", labelForeground: "#dff7e2" },
    { body: 0x7fa6c8, roof: 0x345d7c, accent: 0xe3f2ff, labelBackground: "rgba(9, 20, 32, 0.86)", labelForeground: "#e3f2ff" },
    { body: 0xc8a96f, roof: 0x6f5434, accent: 0xfff0c8, labelBackground: "rgba(32, 23, 10, 0.86)", labelForeground: "#fff0c8" },
    { body: 0xb7839b, roof: 0x704358, accent: 0xffe6f0, labelBackground: "rgba(30, 13, 22, 0.86)", labelForeground: "#ffe6f0" },
    { body: 0x8f91c7, roof: 0x4c4e82, accent: 0xeeefff, labelBackground: "rgba(16, 17, 36, 0.86)", labelForeground: "#eeefff" }
  ];
  let hash = 0;
  for (const ch of seed) hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0;
  return palettes[Math.abs(hash) % palettes.length];
}

function applySpaceRow(ps, row) {
  if (row && row.space_type === "home") applyHome(ps, row);
  else applyClaim(ps, row);
}

function applyHome(plotState, data) {
  if (!plotState) return;
  const style = ["modern", "dome", "pod"].includes(data && data.home_style) ? data.home_style : "pod";
  const title = sanitizeDisplayName((data && (data.home_title || data.project_name)) || "Home");
  const owner = data && data.claimed_by ? sanitizeDisplayName(data.claimed_by) : "";
  plotState.claimed = true;
  if (plotState === activePlot) activePlot = null;
  if (plotState.sign) { try { scene.remove(plotState.sign); } catch (e) {} }
  if (plotState.metaSign) { try { scene.remove(plotState.metaSign); } catch (e) {} }
  const label = createLabelSprite(title, { background: "rgba(22, 16, 10, 0.86)", foreground: "#ffe9cf", fontSize: 32, scale: 0.014 });
  label.position.set(plotState.x, 2.62, plotState.z);
  scene.add(label); plotState.sign = label;
  if (owner) {
    const meta = createLabelSprite("home \u00b7 " + owner, { background: "rgba(10, 12, 14, 0.78)", foreground: "#f6fbff", fontSize: 22, scale: 0.0095, paddingX: 15, paddingY: 8 });
    meta.position.set(plotState.x, 2.2, plotState.z);
    scene.add(meta); plotState.metaSign = meta;
  }
  if (plotState.built) return;
  plotState.built = true;
  buildHomeMesh(plotState, style);
}

function buildHomeMesh(plotState, style) {
  const x = plotState.x, z = plotState.z;
  const mat = (c, r, extra) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: r == null ? 0.7 : r }, extra || {}));
  const doorM = mat(0x2f302a, 0.64);
  // orient the home so its front (door/stairs/balcony) faces the plaza/town center
  let fx = 0, fz = 0;
  if (Math.abs(x) >= Math.abs(z)) fx = x > 0 ? -1 : 1; else fz = z > 0 ? -1 : 1;
  if (fx === 0 && fz === 0) fz = -1;
  const swap = fx !== 0;
  const wX = (lx, lz) => x + lx * fz + lz * fx;
  const wZ = (lx, lz) => z - lx * fx + lz * fz;
  const lbox = (lx, ly, lz, w, h, d, m) => addBox(wX(lx, lz), ly, wZ(lx, lz), swap ? d : w, h, swap ? w : d, m);
  const lcol = (lx, lz, w, d) => buildingColliders.push({ x: wX(lx, lz), z: wZ(lx, lz), width: swap ? d : w, depth: swap ? w : d });
  const lplat = (aX, bX, aZ, bZ, top) => {
    const xs = [wX(aX, aZ), wX(bX, aZ), wX(aX, bZ), wX(bX, bZ)];
    const zs = [wZ(aX, aZ), wZ(bX, aZ), wZ(aX, bZ), wZ(bX, bZ)];
    platforms.push({ minX: Math.min.apply(null, xs), maxX: Math.max.apply(null, xs), minZ: Math.min.apply(null, zs), maxZ: Math.max.apply(null, zs), top });
  };
  if (style === "modern") {
    // public mansion: two floors, interior stairs to a 2nd-floor balcony, front faces the plaza
    const W = 7.8, D = 6.6, t = 0.2, hw = W / 2, hd = D / 2;
    const h1 = 3.0, h2 = 2.7, roofY = h1 + h2;
    const body = mat(0xd6dade, 0.72), trim = mat(0x5f676e, 0.6), floorM = mat(0xb7bdc2, 0.78);
    const glass = mat(0x8fd0e6, 0.18, { metalness: 0.05, transparent: true, opacity: 0.74 });
    const doorW = 1.6, segW = (W - doorW) / 2, segOff = doorW / 2 + segW / 2;
    lbox(-segOff, h1 / 2, hd, segW, h1, t, body);
    lbox(segOff, h1 / 2, hd, segW, h1, t, body);
    lbox(0, h1 - 0.35, hd, doorW, 0.7, t, body);
    lbox(-segOff, h1 * 0.55, hd + 0.03, segW * 0.78, h1 * 0.5, 0.04, glass);
    lbox(segOff, h1 * 0.55, hd + 0.03, segW * 0.78, h1 * 0.5, 0.04, glass);
    lbox(0, h1 / 2, -hd, W, h1, t, body);
    lbox(-hw, h1 / 2, 0, t, h1, D, body);
    lbox(hw, h1 / 2, 0, t, h1, D, body);
    lcol(-segOff, hd, segW, t);
    lcol(segOff, hd, segW, t);
    lcol(0, -hd, W, t);
    lcol(-hw, 0, t, D);
    lcol(hw, 0, t, D);
    const stairW = 1.6, stairLX = hw - 0.95;
    const steps = 9, stepH = h1 / steps, stepRun = (D - 1.2) / steps, lz0 = hd - 0.7;
    for (let i = 0; i < steps; i++) {
      const top = stepH * (i + 1);
      const lz = lz0 - stepRun * (i + 0.5);
      lbox(stairLX, top / 2, lz, stairW, top, stepRun + 0.02, trim);
      lplat(stairLX - stairW / 2, stairLX + stairW / 2, lz - stepRun / 2, lz + stepRun / 2, top);
    }
    const loftR = hw - 1.9, slabW = loftR + hw, slabCLX = (loftR - hw) / 2;
    lbox(slabCLX, h1 - 0.1, 0, slabW, 0.2, D, floorM);
    lplat(-hw, loftR, -hd, hd, h1);
    lbox(hw - 0.95, h1 - 0.1, -hd + 0.85, 1.9, 0.2, 1.7, floorM);
    lplat(loftR - 0.1, hw, -hd, -hd + 1.7, h1);
    lbox(0, h1 + h2 / 2, -hd, W, h2, t, body);
    lbox(-hw, h1 + h2 / 2, 0, t, h2, D, body);
    lbox(hw, h1 + h2 / 2, 0, t, h2, D, body);
    lbox(-hw + 0.04, h1 + h2 * 0.5, 0, 0.04, h2 * 0.55, D * 0.66, glass);
    lbox(hw - 0.04, h1 + h2 * 0.5, 0, 0.04, h2 * 0.55, D * 0.66, glass);
    lbox(slabCLX, h1 + 0.5, hd - 0.15, slabW, 1.0, 0.12, trim);
    lbox(0, roofY + 0.09, 0, W + 0.2, 0.18, D + 0.2, trim);
  } else if (style === "dome") {
    const w = plotState.width * 0.66, d = plotState.depth * 0.66;
    const shell = mat(0xdfe7ea, 0.5, { metalness: 0.04, flatShading: true, side: THREE.DoubleSide });
    const base = mat(0x9aa6ad, 0.7);
    const r = Math.min(w, d) * 0.82;
    const baseMesh = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.14, r + 0.2, 0.2, 16), base);
    baseMesh.position.set(x, 0.1, z); baseMesh.receiveShadow = true; scene.add(baseMesh);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 9, 0, Math.PI * 2, 0, Math.PI / 2), shell);
    dome.position.set(x, 0.18, z); dome.castShadow = true; scene.add(dome);
    lbox(0, 0.72, r - 0.02, 0.8, 1.25, 0.07, doorM);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), mat(0xfff2cf, 0.4, { emissive: 0xffe6a8, emissiveIntensity: 0.7 }));
    lamp.position.set(x, r * 0.78, z); scene.add(lamp);
  } else {
    const w = plotState.width * 0.5, d = plotState.depth * 0.5;
    const body = mat(0xcf9a6e, 0.74, { side: THREE.DoubleSide });
    const cap = mat(0x6f5434, 0.6, { flatShading: true, side: THREE.DoubleSide });
    const r = Math.min(w, d) * 0.7, bodyH = 1.15;
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(r, r, bodyH, 18, 1, true), body);
    cyl.position.set(x, bodyH / 2, z); cyl.castShadow = true; scene.add(cyl);
    const cap2 = new THREE.Mesh(new THREE.SphereGeometry(r * 1.03, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), cap);
    cap2.position.set(x, bodyH, z); cap2.castShadow = true; scene.add(cap2);
    lbox(0, 0.55, r - 0.02, 0.55, 0.95, 0.06, doorM);
  }
}
async function loadSpaces() {
  try {
    const { data } = await supa.from("world_spaces").select("plot, github_url, project_name, claimed_by, repo_metadata, repo_error, space_type, home_style, home_title");
    (data || []).forEach((row) => {
      const ps = plotList[row.plot];
      if (ps && !ps.claimed) applySpaceRow(ps, row);
    });
  } catch (e) {}
  try {
    supa.channel("engine-spaces")
      .on("postgres_changes", { event: "*", schema: "public", table: "world_spaces" }, (p) => {
        const r = p.new;
        if (!r) return;
        const ps = plotList[r.plot];
        if (ps) applySpaceRow(ps, r);
      })
      .subscribe();
  } catch (e) {}
}

function buildTown() {
  hemiLight = new THREE.HemisphereLight(0xe5f6ff, 0x5b5f4b, 1.35);
  scene.add(hemiLight);

  const sun = new THREE.DirectionalLight(0xfff6e8, 2.1);
  sun.position.set(8, 14, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -32;
  sun.shadow.camera.right = 32;
  sun.shadow.camera.top = 32;
  sun.shadow.camera.bottom = -32;
  scene.add(sun);
  sunLight = sun;
  sunDisc = new THREE.Mesh(new THREE.SphereGeometry(2.6, 18, 12), new THREE.MeshBasicMaterial({ color: 0xfff1c0, fog: false }));
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(420 * 3);
  for (let si = 0; si < 420; si++) {
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(0.06 + Math.random() * 0.86);
    starPos[si * 3] = 88 * Math.sin(ph) * Math.cos(th);
    starPos[si * 3 + 1] = 88 * Math.cos(ph);
    starPos[si * 3 + 2] = 88 * Math.sin(ph) * Math.sin(th);
  }
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xcfe2ff, size: 0.55, sizeAttenuation: true, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  scene.add(stars);
  moonDisc = new THREE.Mesh(new THREE.SphereGeometry(1.9, 16, 12), new THREE.MeshBasicMaterial({ color: 0xdfe8f4, fog: false }));
  moonDisc.visible = false;
  scene.add(moonDisc);
  sunDisc.castShadow = false;
  scene.add(sunDisc);

  const groundMaterial = makeGroundMaterial();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  addGroundRect(0, 0, 6, 60, 0xb9aa88);
  addGroundRect(0, 0, 60, 6, 0xb9aa88);
  addGroundRect(0, 0, 11, 11, 0xc7bc9b);

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
  addBox(0, 1, -31, 62, 2, 0.5, wallMaterial);
  addBox(-16.75, 1, 31, 28.5, 2, 0.5, wallMaterial);
  addBox(16.75, 1, 31, 28.5, 2, 0.5, wallMaterial);
  addBox(-31, 1, 0, 0.5, 2, 62, wallMaterial);
  addBox(31, 1, 0, 0.5, 2, 62, wallMaterial);
  addSolid(0, -31, 62, 0.5, 2);
  addSolid(-16.75, 31, 28.5, 0.5, 2);
  addSolid(16.75, 31, 28.5, 0.5, 2);
  addSolid(-31, 0, 0.5, 62, 2);
  addSolid(31, 0, 0.5, 62, 2);

  for (const door of doors) {
    buildDoorBuilding(door);
  }

  for (const structure of structures) {
    buildStructure(structure);
  }

  plots.forEach((plot, index) => buildPlot(plot, index));

  addBench(-4, 4, benchRotationToward(-4, 4));
  addBench(4, -4, benchRotationToward(4, -4));
  addBench(-7, -4, benchRotationToward(-7, -4));
  addBench(7, 4, benchRotationToward(7, 4));
  const treeSpots = [
    [-12, 5], [12, 5], [-12, -5], [12, -5],
    [-20, -16], [20, -16], [-20, 16], [20, 16],
    [-29, -6], [29, -6], [-29, 6], [29, 6],
    [-5, 14], [5, 14], [-7, 25],
    [-26, 22], [26, 22], [-26, -22], [26, -22]
  ];
  for (const t of treeSpots) addTree(t[0], t[1]);
  buildNeighborhood();
  buildBandstand();
  buildFountain();
  buildArena();
}

function buildBandstand() {
  const bx = BANDSTAND.x, bz = BANDSTAND.z;
  const woodM = new THREE.MeshStandardMaterial({ color: 0x8a6a4d, roughness: 0.78 });
  const roofM = new THREE.MeshStandardMaterial({ color: 0x4d3b58, roughness: 0.7 });
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.3, 0.14, 16), woodM);
  deck.position.set(bx, 0.07, bz); deck.receiveShadow = true; scene.add(deck);
  for (const a of [0.79, 2.36, 3.93, 5.5]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.6, 0.16), woodM);
    post.position.set(bx + Math.sin(a) * 2.6, 1.35, bz + Math.cos(a) * 2.6);
    post.castShadow = true; scene.add(post);
  }
  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.5, 1.2, 12), roofM);
  roof.position.set(bx, 3.2, bz); roof.castShadow = true; scene.add(roof);
  const sign = createLabelSprite("THE BANDSTAND", { background: "rgba(13, 18, 20, 0.78)", foreground: "#d9b8ff", fontSize: 36, scale: 0.02 });
  sign.position.set(bx, 4.2, bz); scene.add(sign);
  const standTop = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.08, 0.55), woodM);
  standTop.position.set(bx, 0.96, bz - 2.55); standTop.castShadow = true; scene.add(standTop);
  for (const lx of [-1.55, 1.55]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.92, 0.1), woodM);
    leg.position.set(bx + lx, 0.46, bz - 2.55); scene.add(leg);
  }
  const BAR_COLORS = [0xe4572e, 0xf3a712, 0xf7d046, 0x76b041, 0x17bebb, 0x3d8bfd, 0x7768ae, 0xd76fa3];
  for (let i = 0; i < 8; i++) {
    const barM = new THREE.MeshStandardMaterial({ color: BAR_COLORS[i], roughness: 0.5, emissive: BAR_COLORS[i], emissiveIntensity: 0.18 });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.92 - i * 0.055), barM);
    bar.position.set(bx - 1.47 + i * 0.42, 1.06, bz - 2.55);
    bar.castShadow = true; bar.userData.noteIndex = i;
    scene.add(bar); noteBars.push(bar);
  }
}
function buildNeighborhood() {
  addGroundRect(0, -23.4, 46, 3.2, 0xb9aa88);
  const nbSign = createLabelSprite("THE NEIGHBORHOOD", { background: "rgba(13, 18, 20, 0.78)", foreground: "#ffd9a8", fontSize: 38, scale: 0.02 });
  nbSign.position.set(0, 3.6, -23.4);
  scene.add(nbSign);
  addStreetlight(-15, -21.6);
  addStreetlight(15, -21.6);
  addTree(-16.2, -29.6); addTree(-0.2, -29.6); addTree(16.2, -29.6);
  addTree(-25.5, -24); addTree(25.5, -24);
  const hedgeM = new THREE.MeshStandardMaterial({ color: 0x4e7d4a, roughness: 0.95 });
  for (const hx of [-16, -8, 0, 8, 16]) {
    const hedge = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), hedgeM);
    hedge.position.set(hx, 0.42, -25.5);
    hedge.scale.set(1.25, 0.8, 0.9);
    scene.add(hedge);
  }
}
function buildFountain() {
  const stoneM = new THREE.MeshStandardMaterial({ color: 0x9aa3a8, roughness: 0.9 });
  const stoneD = new THREE.MeshStandardMaterial({ color: 0x848d92, roughness: 0.95 });
  const waterM = new THREE.MeshStandardMaterial({ color: 0x4f9dc9, roughness: 0.25, metalness: 0.1, emissive: 0x2a6f9e, emissiveIntensity: 0.25, transparent: true, opacity: 0.92 });
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.45, 0.55, 22), stoneM); basin.position.set(0, 0.275, 0); scene.add(basin);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.09, 8, 22), stoneD); lip.rotation.x = Math.PI / 2; lip.position.set(0, 0.56, 0); scene.add(lip);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(2.12, 2.12, 0.06, 22), waterM); water.position.set(0, 0.54, 0); scene.add(water);
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 1.5, 14), stoneM); column.position.set(0, 1.05, 0); scene.add(column);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.5, 0.3, 16), stoneD); bowl.position.set(0, 1.85, 0); scene.add(bowl);
  const bowlWater = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.68, 0.05, 16), waterM); bowlWater.position.set(0, 1.95, 0); scene.add(bowlWater);
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), waterM); orb.position.set(0, 2.12, 0); scene.add(orb);
  for (let fi = 0; fi < 6; fi++) {
    const fa = fi / 6 * Math.PI * 2;
    const fl = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.5), stoneD);
    fl.position.set(Math.cos(fa) * 3.2, 0.06, Math.sin(fa) * 3.2);
    fl.rotation.y = fa; scene.add(fl);
  }
  addSolid(0, 0, 4.6, 4.6, 1.4);
}
function buildArena() {
  var z1 = 55, ax = 17, cz = 43, depth = 24;
  addGroundRect(0, cz, 38, 28, 0x3a4a3f);
  var aw = new THREE.MeshStandardMaterial({ color: 0x4a5a50, roughness: 0.85 });
  addBox(0, 1.4, z1, ax * 2, 2.8, 0.5, aw);
  addBox(-ax, 1.4, cz, 0.5, 2.8, depth, aw);
  addBox(ax, 1.4, cz, 0.5, 2.8, depth, aw);
  addSolid(0, z1, ax * 2, 0.5, 2.8);
  addSolid(-ax, cz, 0.5, depth, 2.8);
  addSolid(ax, cz, 0.5, depth, 2.8);
  var cover = new THREE.MeshStandardMaterial({ color: 0x6a7b6e, roughness: 0.8 });
  var blocks = [[-8, 38, 3, 1.2, 1.5], [8, 38, 3, 1.2, 1.5], [0, 44, 2.2, 1.6, 2.2], [-10, 49, 2.6, 1.3, 2.6], [10, 49, 2.6, 1.3, 2.6], [0, 52.5, 6, 1.0, 1.2]];
  for (var bi = 0; bi < blocks.length; bi++) { var b = blocks[bi]; addBox(b[0], b[3] / 2, b[1], b[2], b[3], b[4], cover); addSolid(b[0], b[1], b[2], b[4], b[3]); }
  addTree(-4, 28); addTree(4, 28); addTree(-6, 29.5); addTree(6, 29.5);
  var lineM = new THREE.MeshStandardMaterial({ color: 0xf2f5f0, roughness: 0.6, emissive: 0xdfe6df, emissiveIntensity: 0.18 });
  addBox(0, 0.055, 43, 33, 0.02, 0.18, lineM);
  addBox(0, 0.055, 34.5, 33, 0.02, 0.14, lineM);
  addBox(0, 0.055, 51.5, 33, 0.02, 0.14, lineM);
  addBox(-16, 0.055, 43, 0.14, 0.02, 22, lineM);
  addBox(16, 0.055, 43, 0.14, 0.02, 22, lineM);
  var stripeM = new THREE.MeshStandardMaterial({ color: 0x78d7a6, roughness: 0.5, emissive: 0x78d7a6, emissiveIntensity: 0.6 });
  addBox(0, 1.0, 54.7, 33.4, 0.18, 0.06, stripeM);
  addBox(-16.7, 1.0, 43, 0.06, 0.18, 23.4, stripeM);
  addBox(16.7, 1.0, 43, 0.06, 0.18, 23.4, stripeM);
  var poleM = new THREE.MeshStandardMaterial({ color: 0x3c4448, roughness: 0.7 });
  var floodM = new THREE.MeshStandardMaterial({ color: 0xfff2c4, roughness: 0.4, emissive: 0xffe39a, emissiveIntensity: 0.95 });
  var corners = [[-15, 33.5], [15, 33.5], [-15, 53.5], [15, 53.5]];
  for (var ci = 0; ci < corners.length; ci++) {
    var cc = corners[ci];
    var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 4.6, 10), poleM);
    pole.position.set(cc[0], 2.3, cc[1]); scene.add(pole);
    var bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), floodM);
    bulb.position.set(cc[0], 4.7, cc[1]); scene.add(bulb);
  }
  arenaLight = new THREE.PointLight(0xfff1d6, 0, 60, 1.6);
  arenaLight.position.set(0, 9, 43);
  scene.add(arenaLight);
  var arenaSign = createLabelSprite("PAINTBALL ARENA", { background: "rgba(13, 18, 20, 0.78)", foreground: "#9fe8c0", fontSize: 40, scale: 0.02 });
  arenaSign.position.set(0, 3.4, 31);
  scene.add(arenaSign);
  buildArenaTargets();
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
  solidBlockers.push({ x: door.x, z: door.z, width: door.width, depth: door.depth, top: door.height });
}

function buildStructure(b) {
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: b.body, roughness: 0.78 });
  const roofMaterial = new THREE.MeshStandardMaterial({ color: b.roof, roughness: 0.66 });
  addBox(b.x, b.height / 2, b.z, b.width, b.height, b.depth, bodyMaterial);
  addBox(b.x, b.height + 0.28, b.z, b.width + 0.55, 0.56, b.depth + 0.55, roofMaterial);

  const doorMaterial = new THREE.MeshStandardMaterial({ color: 0x2f302a, roughness: 0.64 });
  const dw = 1.05, dh = 1.7, dt = 0.08;
  if (b.face === "north") addBox(b.x, dh / 2, b.z - b.depth / 2 - dt / 2, dw, dh, dt, doorMaterial);
  else if (b.face === "south") addBox(b.x, dh / 2, b.z + b.depth / 2 + dt / 2, dw, dh, dt, doorMaterial);
  else if (b.face === "east") addBox(b.x + b.width / 2 + dt / 2, dh / 2, b.z, dt, dh, dw, doorMaterial);
  else if (b.face === "west") addBox(b.x - b.width / 2 - dt / 2, dh / 2, b.z, dt, dh, dw, doorMaterial);

  if (b.path || b.room) {
    const off = 1.1;
    let tx = b.x, tz = b.z, tw = b.width, td = b.depth;
    if (b.face === "north") { tz = b.z - b.depth / 2 - off; td = 2.4; }
    else if (b.face === "south") { tz = b.z + b.depth / 2 + off; td = 2.4; }
    else if (b.face === "east") { tx = b.x + b.width / 2 + off; tw = 2.4; }
    else if (b.face === "west") { tx = b.x - b.width / 2 - off; tw = 2.4; }
    b.trigger = { x: tx, z: tz, width: tw, depth: td };
    doorStructures.push(b);
  }

  if (b.windows) {
    const winMaterial = new THREE.MeshStandardMaterial({
      color: 0xdfeefb, emissive: 0x9fb9d8, emissiveIntensity: 0.22, roughness: 0.4
    });
    const rows = Math.max(2, Math.floor(b.height / 1.5));
    for (let r = 0; r < rows; r++) {
      const wy = 0.95 + r * 1.4;
      if (wy > b.height - 0.4) break;
      for (const wx of [-b.width / 4, b.width / 4]) {
        addBox(b.x + wx, wy, b.z + b.depth / 2 + 0.03, 0.7, 0.6, 0.06, winMaterial);
        addBox(b.x + wx, wy, b.z - b.depth / 2 - 0.03, 0.7, 0.6, 0.06, winMaterial);
      }
    }
  }

  const label = createLabelSprite(b.label, {
    background: "rgba(13, 18, 20, 0.74)",
    foreground: "#f4f8ff",
    fontSize: 38,
    scale: 0.016
  });
  label.position.set(b.x, b.height + 1.05, b.z);
  scene.add(label);

  buildingColliders.push({ x: b.x, z: b.z, width: b.width, depth: b.depth });
}

function buildPlot(plot, index) {
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

  plotList[index] = {
    index,
    x: plot.x,
    z: plot.z,
    width: plot.width,
    depth: plot.depth,
    trigger: { x: plot.x, z: plot.z, width: plot.width + 1.8, depth: plot.depth + 1.8 },
    claimed: false,
    built: false,
    sign: label
  };
}

function addGroundRect(x, z, width, depth, color) {
  const material = makePavingMaterial(color);
  const rect = new THREE.Mesh(new THREE.BoxGeometry(width, 0.04, depth), material);
  rect.position.set(x, 0.025, z);
  rect.receiveShadow = true;
  scene.add(rect);
}

function makeGroundMaterial() {
  const canvasTexture = document.createElement("canvas");
  canvasTexture.width = 128;
  canvasTexture.height = 128;
  const ctx = canvasTexture.getContext("2d");
  ctx.fillStyle = "#6fa46e";
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 360; i++) {
    const x = (i * 37) % 128;
    const y = (i * 61) % 128;
    const shade = i % 3 === 0 ? "#82b57c" : i % 3 === 1 ? "#5f955f" : "#78aa73";
    ctx.fillStyle = shade;
    ctx.globalAlpha = 0.22;
    ctx.fillRect(x, y, 1 + (i % 3), 1 + ((i + 1) % 3));
  }
  ctx.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvasTexture);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(14, 14);
  return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.96 });
}

function makePavingMaterial(color) {
  const canvasTexture = document.createElement("canvas");
  canvasTexture.width = 96;
  canvasTexture.height = 96;
  const ctx = canvasTexture.getContext("2d");
  const base = `#${new THREE.Color(color).getHexString()}`;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 96, 96);
  ctx.strokeStyle = "rgba(74, 61, 47, 0.16)";
  ctx.lineWidth = 2;
  for (let x = 0; x <= 96; x += 24) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 96);
    ctx.stroke();
  }
  for (let y = 0; y <= 96; y += 24) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(96, y);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(255,255,255,0.07)";
  for (let i = 0; i < 36; i++) {
    ctx.fillRect((i * 19) % 96, (i * 31) % 96, 2, 1);
  }
  const texture = new THREE.CanvasTexture(canvasTexture);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9 });
}

function benchRotationToward(x, z, targetX = 0, targetZ = 0) {
  const dx = targetX - x;
  const dz = targetZ - z;
  return Math.atan2(-dx, -dz);
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

// ---- starter prop catalog (code-built; used by Build Mode + zones) ----
function addTable(x, z) {
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a6240, roughness: 0.74 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x3d433d, roughness: 0.6 });
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.08, 16), wood);
  top.position.y = 0.74; top.castShadow = true; g.add(top);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.74, 10), metal);
  post.position.y = 0.37; g.add(post);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.06, 14), metal);
  base.position.y = 0.03; g.add(base);
  scene.add(g);
}
function addChair(x, z, rotationY) {
  const wood = new THREE.MeshStandardMaterial({ color: 0x9a6b45, roughness: 0.76 });
  const leg = new THREE.MeshStandardMaterial({ color: 0x3d433d, roughness: 0.66 });
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotationY || 0;
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.5), wood);
  seat.position.y = 0.46; seat.castShadow = true; g.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.09), wood);
  back.position.set(0, 0.72, -0.205); back.castShadow = true; g.add(back);
  for (const lx of [-0.19, 0.19]) for (const lz of [-0.19, 0.19]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.46, 0.07), leg);
    l.position.set(lx, 0.23, lz); g.add(l);
  }
  scene.add(g);
}
function addStreetlight(x, z) {
  const poleM = new THREE.MeshStandardMaterial({ color: 0x2f343a, roughness: 0.6, metalness: 0.2 });
  const glowM = new THREE.MeshStandardMaterial({ color: 0xfff2c4, roughness: 0.4, emissive: 0xffe39a, emissiveIntensity: 0.9 });
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.2, 12), poleM);
  pole.position.y = 1.6; pole.castShadow = true; g.add(pole);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.5), poleM);
  head.position.y = 3.2; g.add(head);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), glowM);
  lamp.position.y = 3.06; g.add(lamp);
  scene.add(g);
}
function addPlanter(x, z) {
  const boxM = new THREE.MeshStandardMaterial({ color: 0x6f5a44, roughness: 0.82 });
  const greenM = new THREE.MeshStandardMaterial({ color: 0x4c8a55, roughness: 0.8 });
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const tub = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.42, 0.7), boxM);
  tub.position.y = 0.21; tub.castShadow = true; tub.receiveShadow = true; g.add(tub);
  const bush = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 9), greenM);
  bush.position.y = 0.68; bush.castShadow = true; g.add(bush);
  scene.add(g);
}
function addFence(x1, z1, x2, z2) {
  const woodM = new THREE.MeshStandardMaterial({ color: 0x7c6047, roughness: 0.82 });
  const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz);
  if (len < 0.001) return;
  const g = new THREE.Group();
  g.position.set((x1 + x2) / 2, 0, (z1 + z2) / 2);
  g.rotation.y = Math.atan2(dx, dz);
  for (const ry of [0.85, 0.5]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, len), woodM);
    rail.position.set(0, ry, 0); rail.castShadow = true; g.add(rail);
  }
  const posts = Math.max(2, Math.round(len / 1.2));
  for (let i = 0; i <= posts; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.05, 0.12), woodM);
    p.position.set(0, 0.52, -len / 2 + (len * i) / posts); p.castShadow = true; g.add(p);
  }
  scene.add(g);
  if (Math.abs(dz) < 0.001) buildingColliders.push({ x: (x1 + x2) / 2, z: z1, width: Math.abs(dx), depth: 0.25 });
  else if (Math.abs(dx) < 0.001) buildingColliders.push({ x: x1, z: (z1 + z2) / 2, width: 0.25, depth: Math.abs(dz) });
}
function addPath(x1, z1, x2, z2, width) {
  const w = width || 1.6, dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz);
  if (len < 0.001) return;
  const rect = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, len), makePavingMaterial(0xc7bc9b));
  rect.position.set((x1 + x2) / 2, 0.03, (z1 + z2) / 2);
  rect.rotation.y = Math.atan2(dx, dz);
  rect.receiveShadow = true; scene.add(rect);
}
function addFenceSegment(x, z, rotationY) {
  const woodM = new THREE.MeshStandardMaterial({ color: 0x7c6047, roughness: 0.82 });
  const ry = rotationY || 0, len = 3;
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry;
  for (const railY of [0.85, 0.5]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, len), woodM);
    rail.position.set(0, railY, 0); rail.castShadow = true; g.add(rail);
  }
  for (let i = 0; i <= 2; i++) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.05, 0.12), woodM);
    post.position.set(0, 0.52, -len / 2 + (len * i) / 2); post.castShadow = true; g.add(post);
  }
  scene.add(g);
  const sn = Math.abs(Math.sin(ry)), cs = Math.abs(Math.cos(ry));
  if (cs > 0.92) buildingColliders.push({ x: x, z: z, width: 0.25, depth: len });
  else if (sn > 0.92) buildingColliders.push({ x: x, z: z, width: len, depth: 0.25 });
}
function addCafeCounter(x, z, rotationY) {
  const woodM = new THREE.MeshStandardMaterial({ color: 0x6b4a30, roughness: 0.76 });
  const topM = new THREE.MeshStandardMaterial({ color: 0xc9b48c, roughness: 0.6 });
  const signM = new THREE.MeshStandardMaterial({ color: 0xb6483b, roughness: 0.66 });
  const ry = rotationY || 0;
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry;
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.05, 0.8), woodM);
  body.position.y = 0.52; body.castShadow = true; body.receiveShadow = true; g.add(body);
  const top = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.1, 0.95), topM);
  top.position.y = 1.08; top.castShadow = true; g.add(top);
  const sign = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.55, 0.09), signM);
  sign.position.set(0, 1.75, 0); sign.castShadow = true; g.add(sign);
  scene.add(g);
  const wide = Math.abs(Math.cos(ry)) > 0.5;
  buildingColliders.push({ x: x, z: z, width: wide ? 2.8 : 0.95, depth: wide ? 0.95 : 2.8 });
}

function addSolid(x, z, width, depth, top) {
  buildingColliders.push({ x: x, z: z, width: width, depth: depth });
  solidBlockers.push({ x: x, z: z, width: width, depth: depth, top: top });
}
function addBox(x, y, z, width, height, depth, material) {
  const box = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  box.position.set(x, y, z);
  box.castShadow = true;
  box.receiveShadow = true;
  scene.add(box);
  return box;
}

function buildAvatarBody(look, name, ghost) {
  const group = new THREE.Group();
  const op = ghost ? 0.78 : 1;
  const M = (hex, extra) => new THREE.MeshStandardMaterial(Object.assign({ color: new THREE.Color(hex), roughness: 0.62, metalness: 0.02, transparent: !!ghost, opacity: op }, extra || {}));
  const darkM = M("#172024", { roughness: 0.82 });
  if (look.body === "classic") {
    const bodyM = M(look.color, { roughness: 0.56 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 1.12, 14), bodyM);
    body.position.y = 0.75; body.castShadow = !ghost; group.add(body);
    addAvatarPattern(group, look, ghost);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), bodyM);
    head.position.y = 1.46; head.castShadow = !ghost; group.add(head);
    const face = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.045), darkM);
    face.position.set(0, 1.48, -0.245); group.add(face);
  } else {
    const bw = look.build === "slim" ? 0.84 : look.build === "broad" ? 1.22 : 1;
    const skinM = M(look.skin), shirtM = M(look.shirt, { roughness: 0.7 }), pantsM = M(look.pants, { roughness: 0.72 }), hairM = M(look.hair, { roughness: 0.85 });
    const legX = 0.12 * bw, armX = 0.305 * bw;
    const legGeo = new THREE.BoxGeometry(0.16, 0.62, 0.18);
    const lL = new THREE.Mesh(legGeo, pantsM); lL.position.set(-legX, 0.31, 0); lL.castShadow = !ghost; group.add(lL);
    const rL = new THREE.Mesh(legGeo, pantsM); rL.position.set(legX, 0.31, 0); rL.castShadow = !ghost; group.add(rL);
    const footGeo = new THREE.BoxGeometry(0.18, 0.1, 0.3);
    const lF = new THREE.Mesh(footGeo, darkM); lF.position.set(-legX, 0.05, -0.05); group.add(lF);
    const rF = new THREE.Mesh(footGeo, darkM); rF.position.set(legX, 0.05, -0.05); group.add(rF);
    const torsoDepth = 0.27 * (0.92 + 0.08 * bw);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.44 * bw, 0.66, torsoDepth), shirtM);
    torso.position.y = 0.97; torso.castShadow = !ghost; group.add(torso);
    addPersonPattern(group, look, ghost, bw, torsoDepth);
    const armGeo = new THREE.BoxGeometry(0.13, 0.5, 0.15);
    const lA = new THREE.Mesh(armGeo, shirtM); lA.position.set(-armX, 1.0, 0); lA.castShadow = !ghost; group.add(lA);
    const rA = new THREE.Mesh(armGeo, shirtM); rA.position.set(armX, 1.0, 0); rA.castShadow = !ghost; group.add(rA);
    const handGeo = new THREE.BoxGeometry(0.12, 0.13, 0.15);
    const lH = new THREE.Mesh(handGeo, skinM); lH.position.set(-armX, 0.7, 0); group.add(lH);
    const rH = new THREE.Mesh(handGeo, skinM); rH.position.set(armX, 0.7, 0); group.add(rH);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 14), skinM);
    head.position.y = 1.45; head.castShadow = !ghost; group.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.215, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), hairM);
    hair.position.y = 1.47; group.add(hair);
    const eyes = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.04), darkM);
    eyes.position.set(0, 1.46, -0.18); group.add(eyes);
  }
  const label = createLabelSprite(name || "Guest", {
    background: ghost ? "rgba(11, 16, 18, 0.62)" : "rgba(11, 16, 18, 0.72)",
    foreground: ghost ? "#dfe6ec" : "#ffffff",
    fontSize: ghost ? 30 : 34, scale: 0.0085
  });
  label.position.set(0, 2.04, 0); group.add(label);
  return group;
}

function addPersonPattern(group, look, ghost, bw, depth) {
  if (!look || look.pattern === "plain") return;
  const op = ghost ? 0.7 : 1;
  const w = 0.44 * bw, d = depth;
  if (look.pattern === "stripe") {
    const m = new THREE.MeshStandardMaterial({ color: 0xf5fbff, roughness: 0.5, transparent: ghost, opacity: op });
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, 0.15, d + 0.02), m);
    stripe.position.y = 0.93; stripe.castShadow = !ghost; group.add(stripe);
  } else if (look.pattern === "band") {
    const m = new THREE.MeshStandardMaterial({ color: 0xf5fbff, roughness: 0.5, transparent: ghost, opacity: op });
    const sash = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.82, 0.05), m);
    sash.position.set(-0.05, 0.95, -(d / 2 + 0.02)); sash.rotation.z = -0.5; sash.castShadow = !ghost; group.add(sash);
  } else if (look.pattern === "glow") {
    const m = new THREE.MeshStandardMaterial({ color: 0xdffcff, emissive: 0x74e5ff, emissiveIntensity: ghost ? 0.45 : 0.8, transparent: true, opacity: ghost ? 0.45 : 0.7 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(Math.max(w, d) * 0.62 + 0.06, 0.03, 8, 28), m);
    ring.position.y = 1.04; ring.rotation.x = Math.PI / 2; group.add(ring);
  }
}

function addAvatarPattern(group, appearance, ghost) {
  const opacity = ghost ? 0.7 : 1;
  const markMaterial = new THREE.MeshStandardMaterial({
    color: 0xf5fbff,
    roughness: 0.5,
    metalness: 0.02,
    transparent: ghost,
    opacity
  });
  if (appearance.pattern === "stripe") {
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.355, 0.435, 0.12, 14, 1, true), markMaterial);
    stripe.position.y = 0.88;
    stripe.castShadow = !ghost;
    group.add(stripe);
  } else if (appearance.pattern === "band") {
    const sash = new THREE.Mesh(new THREE.BoxGeometry(0.13, 1.0, 0.07), markMaterial);
    sash.position.set(-0.08, 0.86, -0.34);
    sash.rotation.z = -0.52;
    sash.castShadow = !ghost;
    group.add(sash);
  } else if (appearance.pattern === "glow") {
    const glow = new THREE.Mesh(
      new THREE.TorusGeometry(0.48, 0.025, 8, 28),
      new THREE.MeshStandardMaterial({
        color: 0xdffcff,
        emissive: 0x74e5ff,
        emissiveIntensity: ghost ? 0.45 : 0.75,
        transparent: true,
        opacity: ghost ? 0.42 : 0.68
      })
    );
    glow.position.y = 1.12;
    glow.rotation.x = Math.PI / 2;
    group.add(glow);
  }
}

function createRemote(player) {
  const appearance = normalizeAppearance(player.appearance || { color: player.color }, player.id || player.name || "Guest");
  const group = buildAvatarBody(appearance, player.name || "Guest", false);
  group.position.set(player.x, remoteGroundY(player), player.z);
  group.scale.y = player.stance === "crouch" ? 0.72 : 1;
  group.rotation.y = player.yaw;
  if (player.holding) setHeldOnGroup(group, player.holding);
  return {
    group,
    appearanceKey: appearanceSignature(appearance),
    target: new THREE.Vector3(player.x, remoteGroundY(player), player.z),
    targetYaw: player.yaw,
    targetScaleY: player.stance === "crouch" ? 0.72 : 1,
    heldType: player.holding || null,
    buf: []
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
  for (const id of [...npcs.keys()]) removeNpc(id);
  peers.clear();
  playerCountEl.textContent = "0 players";
}

function supportHeightAt(x, z, offset) {
  let best = 0;
  for (const p of platforms) {
    if (x < p.minX || x > p.maxX || z < p.minZ || z > p.maxZ) continue;
    let top = p.top;
    if (p.ramp) {
      let t = p.axis === "x" ? (x - p.minX) / (p.maxX - p.minX) : (z - p.minZ) / (p.maxZ - p.minZ);
      if (p.flip) t = 1 - t;
      t = Math.max(0, Math.min(1, t));
      top = p.low + (p.high - p.low) * t;
    }
    if (top <= offset + 0.55 && top > best) best = top;
  }
  return best;
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
    const isSelf = player.id === myId;
    const isAway = player.presence !== "present";
    row.className = `player-row${isSelf ? " self" : ""}${isAway ? " away" : ""}`;

    const color = document.createElement("span");
    color.className = "player-color";
    color.style.background = player.color;

    const name = document.createElement("span");
    name.className = "player-name";
    const kind = player.temporary ? ` · ${transientKindLabel(player)}` : "";
    const suffix = `${isSelf ? " (you)" : ""}${kind}${isAway ? " · away" : ""}`;
    name.textContent = `${player.name}${suffix}`;

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
  const visible = normalized.replace(/[^\p{L}\p{N} _.'-]/gu, "").slice(0, 16).trim();
  return visible || "Guest";
}
