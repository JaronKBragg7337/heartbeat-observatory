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
const colorSwatches = document.querySelector("#colorSwatches");
const patternButtons = document.querySelector("#patternButtons");
const appearanceStatus = document.querySelector("#appearanceStatus");
const movePad = document.querySelector("#movePad");
const moveKnob = document.querySelector("#moveKnob");
const actionButton = document.querySelector("#actionButton");
const jumpButton = document.querySelector("#jumpButton");
const crouchButton = document.querySelector("#crouchButton");
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
let wantsConnection = true;
let activeDoor = null;
let activePlot = null;
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
  },
  {
    id: "video",
    label: "Video",
    path: "/video",
    x: 0,
    z: -13,
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
  { x: -6, z: 12.5, width: 4.2, depth: 3.4 },
  { x: 6, z: 12.5, width: 4.2, depth: 3.4 }
];

const structures = [
  { id: "workshop", label: "Workshop", x: 9.2, z: 5.9, width: 5.2, depth: 4.3, height: 3.05, body: 0x6e65a8, roof: 0x3f345f, windows: false, face: "north" },
  { id: "apt-w", label: "Apartments", x: -14, z: 0, width: 3.8, depth: 6.6, height: 5.0, body: 0x7d8a93, roof: 0x495159, windows: true, face: "east", room: true },
  { id: "apt-e", label: "Apartments", x: 14, z: 0, width: 3.8, depth: 6.6, height: 5.0, body: 0x7d8a93, roof: 0x495159, windows: true, face: "west", room: true }
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
    setMyAppearance({ ...myAppearance, color: button.dataset.color });
  });
});

patternButtons?.querySelectorAll("[data-pattern]").forEach((button) => {
  button.addEventListener("click", () => {
    setMyAppearance({ ...myAppearance, pattern: button.dataset.pattern });
  });
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

  if (event.code === "KeyE" || event.code === "Enter") {
    if (activeDoor || activePlot) {
      event.preventDefault();
      enterActiveDoor();
      return;
    }
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
  if (!mindsLoaded) { mindsLoaded = true; loadMinds(); }
  if (!spacesLoaded) { spacesLoaded = true; loadSpaces(); }
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
    presence: "present"
  };
}

async function loadIdentity() {
  try {
    const { data: { session } } = await ensureSupabase().auth.getSession();
    if (session?.user?.id) {
      myUserId = session.user.id;
      myId = myUserId;
      guestId = null;
      visitorKind = "resident";
      wantsSelfPresence = true;
      if (hintedUserId && hintedUserId !== myUserId) {
        addFeed("Signed-in account verified");
      }
      try {
        const { data: character } = await supa
          .from("world_characters")
          .select("auth_user_id, display_name, presence, appearance, kind, location, last_seen_at")
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
      .select("auth_user_id, display_name, presence, appearance, kind, location, last_seen_at");
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
    renderAppearanceControls();
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
  const color = source.color || source.bodyColor || source.tint;
  const pattern = String(source.pattern || "plain").toLowerCase();
  return {
    color: typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : colorForId(seed),
    pattern: appearancePatterns.has(pattern) ? pattern : "plain"
  };
}

function appearanceSignature(appearance) {
  const clean = normalizeAppearance(appearance, "resident");
  return `${clean.color}:${clean.pattern}`;
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
      stance: state.stance
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
      p_color: myAppearance.color,
      p_pattern: myAppearance.pattern
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
  if (settingsOpen) {
    clearMovementInput();
    if (document.pointerLockElement) {
      document.exitPointerLock?.();
    }
  }
}

function leaveTown() {
  hasEntered = false;
  toggleSettings(false);
  clearMovementInput();
  overlay.classList.remove("hidden");
  if (document.pointerLockElement) document.exitPointerLock?.();
  if (pseudoOn) pseudoFs(false);
  wantsSelfPresence = false;
  try { channel?.untrack(); } catch {}
  if (myUserId) {
    setMyWorldPresence(false);
  }
  setStatus(connected ? "watching" : "offline", connected);
  renderCharacters();
}

function connect() {
  if (!wantsConnection) return;
  if (channel) return;

  setStatus("connecting", false);
  ensureSupabase();
  if (!mindsLoaded) { mindsLoaded = true; loadMinds(); }
  if (!spacesLoaded) { spacesLoaded = true; loadSpaces(); }
  if (!charactersLoaded) loadCharacters();

  channel = supa.channel("engine-town", {
    config: {
      presence: { key: selfRealtimeId() || `preview-${randomIdChunk().slice(0, 8)}` },
      broadcast: { self: false }
    }
  });

  channel.on("broadcast", { event: "state" }, ({ payload }) => applyPeerState(payload));

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
    } else if (status === "CLOSED") {
      connected = false;
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
      stance: state.stance
    }
  });
}

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  sendAccumulator += dt;

  updateLocal(dt);
  updateCamera(dt);
  updateRemotes(dt);
  updateMinds();
  updateNpcs();
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

function updateRemotes(dt) {
  const blend = Math.min(1, dt * 12);
  for (const remote of remotes.values()) {
    remote.group.position.lerp(remote.target, blend);
    remote.group.rotation.y = lerpAngle(remote.group.rotation.y, remote.targetYaw, blend);
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
  const group = new THREE.Group();
  const look = normalizeAppearance(appearance, name || "Guest");
  const c = new THREE.Color(look.color);
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0.02, transparent: true, opacity: 0.78 });
  const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x172024, roughness: 0.82, transparent: true, opacity: 0.78 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 1.12, 14), bodyMaterial);
  body.position.y = 0.75; group.add(body);
  addAvatarPattern(group, look, true);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), bodyMaterial);
  head.position.y = 1.46; group.add(head);
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.045), darkMaterial);
  face.position.set(0, 1.48, -0.245); group.add(face);
  const label = createLabelSprite(name || "Guest", {
    background: "rgba(11, 16, 18, 0.62)", foreground: "#dfe6ec", fontSize: 30, scale: 0.0085
  });
  label.position.set(0, 2.02, 0); group.add(label);
  return group;
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

  if (activeDoor === nextDoor && activePlot === nextPlot) return;
  activeDoor = nextDoor;
  activePlot = nextPlot;
  if (activePlot) showNudge("plot", myUserId
    ? "This is an open plot. Press E (or tap the action button) to claim it with a GitHub repo \u2014 it becomes a real building everyone can see."
    : "This is an open plot. Sign in and you can claim it with a GitHub repo, turning it into a real building everyone can see.");

  for (const door of doors) {
    if (door.pad) door.pad.material.emissiveIntensity = door === activeDoor ? 0.38 : 0.08;
  }

  if (activeDoor) {
    doorPrompt.classList.remove("hidden");
    doorPromptText.textContent = isTouch
      ? `Enter ${activeDoor.label}`
      : `Press E for ${activeDoor.label}`;
    actionButton.disabled = false;
  } else if (activePlot) {
    doorPrompt.classList.remove("hidden");
    doorPromptText.textContent = myUserId
      ? (isTouch ? "Claim this space" : "Press E to claim this space")
      : "Sign in to claim this space";
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
  roomGroup.userData = { colliders: colliders, floorMat: floorMat, wallMat: wallMat };
  roomGroup.visible = false;
  scene.add(roomGroup);
}

function applyRoomLayout() {
  if (!roomGroup || !roomGroup.userData) return;
  // Customization (recolor + items) lands in the next increment; safe no-op for now.
}

function showRoomPanel() {
  let p = document.getElementById("roomPanel");
  if (!p) {
    p = document.createElement("div");
    p.id = "roomPanel";
    p.style.cssText = "position:fixed;left:50%;bottom:18px;transform:translateX(-50%);display:flex;gap:8px;align-items:center;background:rgba(10,15,18,0.92);border:1px solid #2c3940;border-radius:12px;padding:9px 11px;z-index:99980;color:#eef3f6;font-size:13px;box-shadow:0 8px 28px rgba(0,0,0,0.4);";
    p.innerHTML = '<span style="font-weight:600;margin-right:2px;">Your room</span><button id="roomExitBtn" style="padding:8px 12px;border-radius:9px;border:0;background:#9fd0a0;color:#0a1410;font-weight:600;font-size:13px;cursor:pointer;">Exit to town</button>';
    document.body.appendChild(p);
    const xb = document.getElementById("roomExitBtn");
    if (xb) xb.addEventListener("click", exitRoom);
  }
  p.style.display = "flex";
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
    roomGroup.visible = true;
    applyRoomLayout();
    savedTownColliders = buildingColliders.slice();
    buildingColliders.length = 0;
    for (const c of roomGroup.userData.colliders) buildingColliders.push(c);
    state.x = 0; state.z = 2.6; state.yaw = Math.PI;
    inRoom = true;
    showRoomPanel();
    doorPrompt.classList.add("hidden");
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
    hideRoomPanel();
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
  hideRoomPanel();
}

function enterActiveDoor() {
  if (activeDoor) {
    if (activeDoor.room) { enterRoom(); return; }
    const target = window.top || window;
    target.location.assign(activeDoor.path);
    return;
  }
  if (activePlot) openClaim(activePlot);
}

// ---- Claimable spaces ----
let currentClaimPlot = null;
document.body.insertAdjacentHTML("beforeend", `
<div id="claimOverlay" style="position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(6,10,12,.62);z-index:100000;padding:18px;">
  <div style="width:min(430px,92vw);background:#0e1417;border:1px solid #243036;border-radius:14px;padding:18px;color:#dfe6ec;font-family:system-ui,-apple-system,sans-serif;box-shadow:0 18px 50px rgba(0,0,0,.5);">
    <div style="font-size:15px;font-weight:600;margin-bottom:6px;">Claim this space</div>
    <div style="font-size:12.5px;opacity:.78;line-height:1.5;margin-bottom:13px;">Paste a GitHub link to a project. It becomes a building here that everyone in the world can see.</div>
    <input id="claimInput" type="url" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://github.com/you/your-project" style="width:100%;box-sizing:border-box;padding:11px 12px;border-radius:9px;border:1px solid #2c3940;background:#0a0f12;color:#eef3f6;font-size:14px;">
    <div id="claimError" style="font-size:12px;color:#e69191;min-height:16px;margin:6px 0 10px;"></div>
    <div style="display:flex;gap:10px;">
      <button id="claimCancel" style="flex:1;padding:11px;border-radius:9px;border:1px solid #2c3940;background:transparent;color:#cdd6db;font-size:14px;cursor:pointer;">Cancel</button>
      <button id="claimSubmit" style="flex:1;padding:11px;border-radius:9px;border:0;background:#9fd0a0;color:#0a1410;font-weight:600;font-size:14px;cursor:pointer;">Claim</button>
    </div>
  </div>
</div>`);
const claimOverlay = document.querySelector("#claimOverlay");
const claimInput = document.querySelector("#claimInput");
const claimError = document.querySelector("#claimError");
document.querySelector("#claimCancel").addEventListener("click", closeClaim);
document.querySelector("#claimSubmit").addEventListener("click", submitClaim);
claimOverlay.addEventListener("click", (e) => { if (e.target === claimOverlay) closeClaim(); });
claimInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); submitClaim(); } });

function openClaim(plotState) {
  currentClaimPlot = plotState;
  claimInput.value = "";
  claimError.textContent = "";
  try { document.exitPointerLock && document.exitPointerLock(); } catch (e) {}
  claimOverlay.style.display = "flex";
  setTimeout(() => { try { claimInput.focus(); } catch (e) {} }, 30);
}

function closeClaim() {
  claimOverlay.style.display = "none";
  currentClaimPlot = null;
}

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

async function loadSpaces() {
  try {
    const { data } = await supa.from("world_spaces").select("plot, github_url, project_name, claimed_by, repo_metadata, repo_error");
    (data || []).forEach((row) => {
      const ps = plotList[row.plot];
      if (ps && !ps.claimed) applyClaim(ps, row);
    });
  } catch (e) {}
  try {
    supa.channel("engine-spaces")
      .on("postgres_changes", { event: "*", schema: "public", table: "world_spaces" }, (p) => {
        const r = p.new;
        if (!r) return;
        const ps = plotList[r.plot];
        if (ps) applyClaim(ps, r);
      })
      .subscribe();
  } catch (e) {}
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

  const groundMaterial = makeGroundMaterial();
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

  for (const structure of structures) {
    buildStructure(structure);
  }

  plots.forEach((plot, index) => buildPlot(plot, index));

  addBench(-3.5, 2.9, benchRotationToward(-3.5, 2.9));
  addBench(3.5, -2.9, benchRotationToward(3.5, -2.9));
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

function addBox(x, y, z, width, height, depth, material) {
  const box = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  box.position.set(x, y, z);
  box.castShadow = true;
  box.receiveShadow = true;
  scene.add(box);
  return box;
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
  const color = new THREE.Color(appearance.color);
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
  addAvatarPattern(group, appearance, false);

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
    appearanceKey: appearanceSignature(appearance),
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
  for (const id of [...npcs.keys()]) removeNpc(id);
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
  const visible = normalized.replace(/[^\p{L}\p{N} _.'-]/gu, "").slice(0, 24).trim();
  return visible || "Guest";
}
