// Heartbeat Homes - walk a baked, photoreal loft; the wall TV plays every Heartbeat TV channel; friends visit by invite link.
// Lighting was path-traced in Blender (Cycles) and baked into the atlas textures, so the page draws it unlit: phones stay smooth.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { CSS3DRenderer, CSS3DObject } from "three/addons/renderers/CSS3DRenderer.js";
import { getSupabase, getIdentity } from "/hb-supabase.js";

const $ = (id) => document.getElementById(id);
const BASE = "/homes/loft/";
const phone = matchMedia("(pointer: coarse)").matches || Math.min(screen.width, screen.height) < 700;
const TEX = phone ? "2k" : "4k";
const qs = new URLSearchParams(location.search);

// ---------------------------------------------------------------- renderer + scene
const renderer = new THREE.WebGLRenderer({ antialias: !phone, powerPreference: "high-performance", alpha: true });
renderer.setClearColor(0x000000, 0);
renderer.setPixelRatio(Math.min(devicePixelRatio, phone ? 2 : 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;            // the bake already carries the film look
$("view").appendChild(renderer.domElement);
const css = new CSS3DRenderer(); css.setSize(innerWidth, innerHeight); $("css").appendChild(css.domElement);
const scene = new THREE.Scene(), cssScene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(phone ? 72 : 65, innerWidth / innerHeight, 0.05, 3000);
scene.add(new THREE.HemisphereLight(0xcfd8ff, 0x3a2a20, 1.4));   // only lights the avatars; baked surfaces are unlit
let fovK = 0;   // 0 = standing, 1 = sitting facing the TV
function fitFov() {   // standing: ~78 degrees across in portrait, 65 tall in landscape
  camera.aspect = innerWidth / innerHeight;
  const across = (d) => THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(d / 2)) / camera.aspect));
  const stand = camera.aspect < 1 ? Math.min(105, across(78)) : 65;
  // seated at the TV: ~48 degrees across, the way your eyes settle on a screen from the couch. The TV is 115" at ~14 ft
  // (home-theatre big); a phone's wide view is what made it look small (Jaron 9/27).
  const seat = Math.min(stand, across(48));
  camera.fov = stand + (seat - stand) * fovK;
  camera.updateProjectionMatrix();
}
fitFov();
addEventListener("resize", () => {
  fitFov();
  renderer.setSize(innerWidth, innerHeight); css.setSize(innerWidth, innerHeight);
});

const bar = (f, msg) => { $("loadBar").style.width = Math.round(f * 100) + "%"; if (msg) $("loadMsg").textContent = msg; };
const texLoader = new THREE.TextureLoader();
const loadTex = (url) => new Promise((ok, no) => texLoader.load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.anisotropy = 8; ok(t); }, undefined, no));

let colliders = null, screenInfo = null;
// The TV page sits BEHIND the 3D view; while it's on, the screen mesh punches a see-through hole (alpha 0) in the view.
// Anything in front of the screen - the lamp, a friend, the balcony rail - then covers the TV like in real life (Jaron 9/26).
const SCREEN_OFF = new THREE.MeshBasicMaterial({ color: 0x050608 });
const SCREEN_HOLE = new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0, blending: THREE.NoBlending });
async function loadLoft() {
  const parts = ["floor", "shell", "living", "upper"];
  let done = 0; const tick = () => bar(0.1 + 0.8 * (++done / (parts.length + 3)));
  const [gltf, col, pano, ...atlases] = await Promise.all([
    new GLTFLoader().loadAsync(BASE + "loft.glb").then((g) => (tick(), g)),
    fetch(BASE + "colliders.json").then((r) => r.json()).then((j) => (tick(), j)),
    loadTex(BASE + `city_${phone ? "4k" : "8k"}.jpg`).then((t) => (tick(), t)),
    ...parts.map((p) => loadTex(BASE + `atlas_${p}_${TEX}.jpg`).then((t) => (tick(), t))),
  ]);
  colliders = col;
  pano.flipY = true; pano.mapping = THREE.EquirectangularReflectionMapping;
  scene.background = pano;
  const maps = Object.fromEntries(parts.map((p, i) => [p, atlases[i]]));
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    const name = (o.material && o.material.name) || o.name;
    const key = parts.find((p) => name === "BK_" + p || o.name === "BK_" + p);
    if (key) { o.material = new THREE.MeshBasicMaterial({ map: maps[key] }); return; }
    if (/glass/i.test(name) || /glass/i.test(o.name)) {
      o.material = new THREE.MeshBasicMaterial({ color: 0x9fb4c8, transparent: true, opacity: 0.08, depthWrite: false, envMap: pano, reflectivity: 0.25, combine: THREE.AddOperation });
      o.renderOrder = 2; return;
    }
    if (/screen/i.test(name) || /screen/i.test(o.name)) {
      o.material = SCREEN_OFF;
      o.geometry.computeBoundingBox(); const bb = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
      screenInfo = { box: bb, mesh: o };
    }
  });
  scene.add(gltf.scene);
  gltf.scene.updateMatrixWorld(true);
  if (screenInfo) { screenInfo.box = screenInfo.mesh.geometry.boundingBox.clone().applyMatrix4(screenInfo.mesh.matrixWorld); }
}

// ---------------------------------------------------------------- walking + collision (AABBs exported from Blender)
const P = { pos: new THREE.Vector3(), vy: 0, yaw: 0, pitch: -0.05, eye: 1.62, r: 0.26 };
const STEP = 0.36;
function blocked(x, z, feet) {
  const lo = feet + STEP * 0.9, hi = feet + 1.75, r = P.r;
  const hit = (b) => x + r > b[0] && x - r < b[3] && z + r > b[2] && z - r < b[5] && b[4] > lo && b[1] < hi;
  for (const b of colliders.solids) if (hit(b)) return true;
  for (const b of colliders.walk) if (hit(b)) return true;
  return false;
}
function groundAt(x, z, feet) {
  let g = -Infinity; const r = 0.12;
  const test = (b) => { if (x + r > b[0] && x - r < b[3] && z + r > b[2] && z - r < b[5] && b[4] <= feet + STEP && b[4] > g) g = b[4]; };
  for (const b of colliders.walk) test(b);
  for (const b of colliders.solids) test(b);
  return g;
}
const keys = {};
addEventListener("keydown", (e) => { keys[e.code] = true; if (e.code === "KeyT") toggleTV(); if (e.code === "BracketRight") tune(1); if (e.code === "BracketLeft") tune(-1); });
addEventListener("keyup", (e) => { keys[e.code] = false; });
const stick = { id: null, x0: 0, y0: 0, x: 0, y: 0 }, look = { id: null, x: 0, y: 0 };
const view = $("view");
view.addEventListener("pointerdown", (e) => {
  hideHint();
  if (e.pointerType !== "mouse" && e.clientX < innerWidth * 0.45 && stick.id === null) {
    Object.assign(stick, { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: 0, y: 0, t0: performance.now() });
    const s = $("stick"); s.style.left = e.clientX + "px"; s.style.top = e.clientY + "px"; s.style.display = "block"; s.firstElementChild.style.transform = "";
  } else if (look.id === null) Object.assign(look, { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now() });
  view.setPointerCapture(e.pointerId);
});
view.addEventListener("pointermove", (e) => {
  if (e.pointerId === stick.id) {
    let dx = e.clientX - stick.x0, dy = e.clientY - stick.y0; const m = Math.hypot(dx, dy), max = 50;
    if (m > max) { dx *= max / m; dy *= max / m; }
    stick.x = dx / max; stick.y = dy / max; $("stick").firstElementChild.style.transform = `translate(${dx}px,${dy}px)`;
  } else if (e.pointerId === look.id) {
    const k = e.pointerType === "mouse" ? 0.0042 : 0.0058;
    P.yaw -= (e.clientX - look.x) * k; P.pitch = Math.max(-1.35, Math.min(1.35, P.pitch - (e.clientY - look.y) * k));
    look.x = e.clientX; look.y = e.clientY;
  }
});
const endPtr = (e) => {
  if (e.pointerId === stick.id) {
    // a quick tap on the walking side still counts as a tap (the TV often fills the left half of a phone screen)
    if (e.type === "pointerup" && Math.hypot(e.clientX - stick.x0, e.clientY - stick.y0) < 10 && performance.now() - stick.t0 < 350) tapAt(e.clientX, e.clientY);
    stick.id = null; stick.x = stick.y = 0; $("stick").style.display = "none";
  }
  if (e.pointerId === look.id) {
    if (e.type === "pointerup" && Math.hypot(e.clientX - look.x0, e.clientY - look.y0) < 8 && performance.now() - look.t0 < 350) tapAt(e.clientX, e.clientY);
    look.id = null;
  }
};
// Tap the TV: turn its sound on, and bring it to the front for a few seconds so its own buttons can be pressed.
const _ray = new THREE.Raycaster(), _ndc = new THREE.Vector2(); let raiseT = 0;
function tapAt(x, y) {
  if (!tvOn) return;
  roomSoundOn();   // any tap in the loft is the touch phones need before sound can play (Jaron 9/27: sound from any press)
  if (!screenInfo) return;
  _ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1); _ray.setFromCamera(_ndc, camera);
  const hit = _ray.intersectObjects(scene.children, true).find((h) => h.object.visible && !(h.object.material && h.object.material.transparent));
  if (!hit || hit.object !== screenInfo.mesh) return;
  // a tap on the screen always means "I want to hear it": un-mute the room too
  if (muted || vol < 0.05) { muted = false; if (vol < 0.05) vol = 0.8; shareTV(); roomSoundOn(); }
  $("css").classList.add("raised"); clearTimeout(raiseT); raiseT = setTimeout(() => $("css").classList.remove("raised"), 8000);
  toast("TV buttons on for a few seconds");
}
view.addEventListener("pointerup", endPtr); view.addEventListener("pointercancel", endPtr);
let hintT = setTimeout(hideHint, 9000);
function hideHint() { clearTimeout(hintT); $("hint").classList.add("gone"); }

function move(dt) {
  let f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) - stick.y;
  let s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + stick.x;
  const m = Math.hypot(f, s); if (m > 1) { f /= m; s /= m; }
  if (seated) {   // sitting: look around freely; pushing to walk stands you up
    if (m > 0.6) standUp(); else {
      camera.position.copy(seated.eye); camera.rotation.set(P.pitch, P.yaw, 0, "YXZ"); return false;
    }
  }
  const speed = (keys.ShiftLeft ? 4.2 : 2.6) * dt;
  const sin = Math.sin(P.yaw), cos = Math.cos(P.yaw);
  const dx = (-sin * f + cos * s) * speed, dz = (-cos * f - sin * s) * speed;
  const p = P.pos;
  if (dx && !blocked(p.x + dx, p.z, p.y)) p.x += dx;
  if (dz && !blocked(p.x, p.z + dz, p.y)) p.z += dz;
  const g = groundAt(p.x, p.z, p.y);
  if (p.y > g + 0.001) { P.vy -= 9.8 * dt; p.y = Math.max(g, p.y + P.vy * dt); if (p.y === g) P.vy = 0; }
  else { p.y = g; P.vy = 0; }
  if (!isFinite(p.y) || p.y < -5) spawn();
  camera.position.set(p.x, p.y + P.eye, p.z);
  camera.rotation.set(P.pitch, P.yaw, 0, "YXZ");
  return m > 0.01;
}
// ---------------------------------------------------------------- seats (Jaron 9/27: sit on the couch with friends and watch)
// From loft.py (Blender x, y, z) -> three (x, z, -y). "at" = where the hips rest, "yaw" = the way the seat faces.
const B2T = (x, y, z) => new THREE.Vector3(x, z, -y), H2 = 3.4;
const TV_AT = B2T(0.13, 5.0, 1.88);
const SEATS = [
  ...[3.525, 4.625, 5.725].map((y, k) => ({ id: "sofa" + k, name: "the couch", at: B2T(4.45, y, 0.56), yaw: Math.PI / 2, tv: true })),
  { id: "chaise", name: "the chaise", at: B2T(3.25, 6.75, 0.54), yaw: Math.PI, tv: true },
  { id: "gaming", name: "the gaming chair", at: B2T(10.55, 7.1, H2 + 0.53), yaw: -Math.PI / 2 },
  ...[3.45, 4.85].map((y, k) => ({ id: "lounge" + k, name: "the lounge chair", at: B2T(10.0, y, H2 + 0.4), yaw: Math.PI / 2, tv: true })),
  ...[13.05, 14.65].map((x, k) => ({ id: "balc" + k, name: "the balcony chair", at: B2T(x, 11.85, H2 + 0.36), yaw: Math.PI })),
];
SEATS.forEach((st) => { st.eye = st.at.clone().add(new THREE.Vector3(0, 0.74, 0)); });
let seated = null;
function lookYaw(from, to) { const d = to.clone().sub(from); return Math.atan2(-d.x, -d.z); }
function seatTaken(st) { for (const o of others.values()) if (o.sit === st.id) return true; return false; }
function nearSeat() {
  let best = null, bd = 1.5;
  for (const st of SEATS) {
    if (Math.abs(st.at.y - P.pos.y) > 1.2 || seatTaken(st)) continue;
    const d = Math.hypot(st.at.x - P.pos.x, st.at.z - P.pos.z); if (d < bd) { bd = d; best = st; }
  }
  return best;
}
function sitDown(st) {
  seated = st; hideHint();
  P.yaw = st.tv ? lookYaw(st.eye, TV_AT) : st.yaw;
  P.pitch = st.tv ? Math.atan2(TV_AT.y - st.eye.y, Math.hypot(TV_AT.x - st.eye.x, TV_AT.z - st.eye.z)) : -0.08;
  lastSend = 0; updateSitBtn();
}
function standUp() {
  const st = seated; seated = null; if (!st) return;
  const fx = -Math.sin(st.yaw), fz = -Math.cos(st.yaw);   // step out in front of the seat
  P.pos.set(st.at.x + fx * 0.75, st.at.y - 0.5, st.at.z + fz * 0.75); P.pos.y = groundAt(P.pos.x, P.pos.z, P.pos.y + 0.6); P.vy = 0;
  if (!isFinite(P.pos.y)) spawn();
  lastSend = 0; updateSitBtn();
}
$("sitBtn").onclick = () => { if (seated) standUp(); else { const st = nearSeat(); if (st) sitDown(st); } };
function updateSitBtn() {
  const b = $("sitBtn");
  if (seated) { b.textContent = "Stand up"; b.hidden = false; return; }
  const st = colliders ? nearSeat() : null; b.hidden = !st; if (st) b.textContent = "🛋 Sit on " + st.name;
}
function spawn() { const s = colliders.spawn; P.pos.set(s[0], s[1], s[2]); P.vy = 0; P.yaw = colliders.spawnYaw || 0; }

// ---------------------------------------------------------------- the TV: a real /tv/ page on the wall
let channels = [], ch = 1, item = 0, tvOn = false, tvObj = null, iframe = null, vol = 0.8, muted = false;
const TV_W = 1280, TV_H = 720;
async function setupTV() {
  try { const { loadGuide } = await import("/tv/guide.js"); channels = await loadGuide(await getSupabase()); }
  catch (e) { try { channels = (await (await fetch("/tv/channels.json", { cache: "no-cache" })).json()).channels.map((c) => ({ ...c, items: [] })); } catch (e2) { channels = [{ n: 1, name: "Heartbeat News", items: [] }]; } }
  try { const t = (localStorage.getItem("hbhome-tune") || localStorage.getItem("hbhome-ch") || "1").split("."); ch = +t[0] || 1; item = Math.max(0, (+t[1] || 1) - 1); } catch (e) {}
}
// numbered like the TV page: 2.1, 2.2 ... (Jaron 9/27 - pick any show, never forced to sit through the one before it)
function tvSrc() { return `/tv/?embed=1&ch=${ch}.${item + 1}`; }
function saveTune() { try { localStorage.setItem("hbhome-tune", `${ch}.${item + 1}`); } catch (e) {} }
function toggleTV(force, remote) {
  tvOn = typeof force === "boolean" ? force : !tvOn;
  $("tvBtn").classList.toggle("on", tvOn); $("tvbar").classList.toggle("show", tvOn);
  if (tvOn && !tvObj && screenInfo) {
    iframe = document.createElement("iframe");
    iframe.width = TV_W; iframe.height = TV_H; iframe.allow = "autoplay; fullscreen"; iframe.src = tvSrc();
    iframe.addEventListener("load", () => setTimeout(() => (touched ? roomSoundOn() : applySound()), 300));
    iframe.style.width = TV_W + "px"; iframe.style.height = TV_H + "px"; iframe.style.backfaceVisibility = "hidden";
    tvObj = new CSS3DObject(iframe);
    const b = screenInfo.box, c = b.getCenter(new THREE.Vector3()), sz = b.getSize(new THREE.Vector3());
    const w = Math.max(sz.x, sz.z), h = sz.y;
    tvObj.position.set(b.max.x + 0.004, c.y, c.z);
    tvObj.rotation.y = Math.PI / 2;
    tvObj.scale.set(w / TV_W, h / TV_H, 1);
    cssScene.add(tvObj);
  }
  if (tvObj) tvObj.visible = tvOn;
  if (screenInfo) screenInfo.mesh.material = tvOn ? SCREEN_HOLE : SCREEN_OFF;
  if (tvOn && iframe && iframe.src.indexOf(tvSrc()) < 0) iframe.src = tvSrc();
  if (!tvOn && iframe) { iframe.src = "about:blank"; }
  showCh();
  if (!remote) shareTV();
}
function tune(d) {
  if (!channels.length) return;
  pick(((ch - 1 + d + channels.length) % channels.length) + 1, 0);
}
function pick(n, i) {   // put on one numbered item, for everyone in the room
  ch = n; item = i || 0; saveTune();
  if (!tvOn) toggleTV(true, true); else if (iframe) iframe.src = tvSrc();
  showCh(); shareTV();
}
// the TV's own on-screen guide (tapped while the TV is raised) tells us what it switched to; keep the room in step
addEventListener("message", (e) => {
  if (e.origin !== location.origin || !e.data || e.data.type !== "hbtv-tuned" || !iframe || e.source !== iframe.contentWindow) return;
  ch = e.data.ch; item = e.data.i || 0; saveTune(); showCh(); shareTV();
});
// One TV per loft (Jaron 9/26): whoever presses the remote changes it for everyone in the room - on purpose, like a real couch.
let tvStamp = 0;
function shareTV(resendAt) {
  if (!resendAt) tvStamp = Date.now();
  if (chan && me) chan.send({ type: "broadcast", event: "tv", payload: { on: tvOn, ch, item, vol, muted, by: me.name, at: resendAt || tvStamp } });
}
function onRemoteTV(p) {
  if (!p || !(p.at > tvStamp)) return;
  const changed = p.on !== tvOn || p.ch !== ch || (p.item || 0) !== item;
  tvStamp = p.at; ch = p.ch || ch; item = p.item || 0; saveTune();
  const loud = p.vol != null && (p.vol !== vol || !!p.muted !== muted);
  if (p.vol != null) { vol = p.vol; muted = !!p.muted; applySound(); }
  if (loud && !changed && p.by) toast(`${p.by} set the volume to ${muted ? "mute" : Math.round(vol * 100) + "%"}`);
  toggleTV(!!p.on, true);
  if (changed && p.by) toast(p.on ? `${p.by} put on ${nowLabel()}` : `${p.by} turned the TV off`);
}
let toastT = 0;
function toast(msg) {
  let t = $("hbToast");
  if (!t) { t = document.createElement("div"); t.id = "hbToast"; t.style.cssText = "position:fixed;left:50%;top:calc(110px + env(safe-area-inset-top));transform:translateX(-50%);z-index:6;background:rgba(12,16,22,.78);border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:8px 14px;font:600 14px Barlow,sans-serif;color:#fff;transition:opacity .5s;pointer-events:none;white-space:nowrap"; document.body.appendChild(t); }
  t.textContent = msg; t.style.opacity = 1; clearTimeout(toastT); toastT = setTimeout(() => (t.style.opacity = 0), 3500);
}
function nowLabel() {
  const c = channels[ch - 1]; if (!c) return `CH ${ch}`;
  const it = (c.items || [])[item];
  return it && c.type !== "page" ? `CH ${ch}.${item + 1} · ${it.title}` : `CH ${ch} · ${c.name}`;
}
function showCh() { $("chName").textContent = nowLabel(); if (!$("guide").hidden) drawGuide(); }
// the remote's guide: every channel and every numbered show; tap one and the room's TV switches to it
const escH = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function drawGuide() {
  $("guideList").innerHTML = channels.map((c) => `<div class="gcn">CH ${c.n} · ${escH(c.name)}</div>` +
    ((c.items || []).length ? c.items : [{ title: c.empty ? "Coming soon" : c.name }]).map((it, i) =>
      `<button class="gi${tvOn && c.n === ch && i === item ? " on" : ""}" data-n="${c.n}" data-i="${i}"><small>${c.n}.${i + 1}</small><span>${escH(it.title)}</span></button>`).join("")).join("");
}
$("guideBtn").onclick = () => { drawGuide(); $("guide").hidden = false; };
// ---- the remote (the button on the right edge, same remote as the TV page and the phone): sound, volume and channel are
// the room's, like a real couch - whoever holds it changes it for everyone here (Jaron 9/27).
function tvWin() { try { return iframe && iframe.contentWindow; } catch (e) { return null; } }
function applySound() { const w = tvWin(); try { if (w && w.HBTV) w.HBTV.set({ volume: vol, muted }); } catch (e) {} }
// Sound on, from inside a tap. The room's volume/mute goes in FIRST (the TV page may have its own saved mute), then the TV
// page starts its sound. Never click the page's own sound buttons: one of them is "Sound on - tap to mute", and pressing it
// right after the sound came on turned it straight back off (the 9/27 "asks to press for sound, then nothing" bug).
let touched = false;
function roomSoundOn() {
  touched = true; applySound();
  const w = tvWin();
  try { if (w && w.HBTV) return void w.HBTV.soundOn(); } catch (e) {}
  try { const d = iframe && iframe.contentDocument; if (d) d.querySelectorAll("video").forEach((v) => { v.muted = muted; v.play().catch(() => {}); }); } catch (e) {}
}
if (window.HBRemote) {
  $("tvbar").style.visibility = "hidden";
  window.HBRemote.attach({
    state: () => ({ on: tvOn, label: tvOn ? nowLabel() : "OFF", volume: vol, muted }),
    power: () => { toggleTV(); if (tvOn) setTimeout(roomSoundOn, 800); },
    step: (d) => { tune(d); setTimeout(roomSoundOn, 800); },
    tune: (n, i) => { pick(n, i); setTimeout(roomSoundOn, 800); },
    volume: (v) => { vol = v; if (v > 0) muted = false; applySound(); shareTV(); },
    mute: (m) => { muted = m; applySound(); shareTV(); },
    guide: () => { drawGuide(); $("guide").hidden = false; },
    soundOn: () => { if (tvOn) roomSoundOn(); },
  });
  setInterval(() => window.HBRemote.refresh(), 1500);
}
$("guideClose").onclick = () => ($("guide").hidden = true);
$("guideList").addEventListener("click", (e) => { const b = e.target.closest("[data-n]"); if (!b) return; pick(+b.dataset.n, +b.dataset.i); $("guide").hidden = true; });
$("tvBtn").onclick = () => toggleTV(); $("chUp").onclick = () => tune(1); $("chDown").onclick = () => tune(-1);

// hide the TV layer when a wall or floor is between you and the screen (CSS3D draws on top of the 3D view)
const _o = new THREE.Vector3(), _d = new THREE.Vector3();
function rayHitsBox(o, d, len, b) {
  let t0 = 0, t1 = len;
  for (let i = 0; i < 3; i++) {
    const oi = o.getComponent(i), di = d.getComponent(i), mn = b[i], mx = b[i + 3];
    if (Math.abs(di) < 1e-9) { if (oi < mn || oi > mx) return false; continue; }
    let a = (mn - oi) / di, c = (mx - oi) / di; if (a > c) [a, c] = [c, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, c); if (t0 > t1) return false;
  }
  return true;
}
function tvVisible() {
  if (!screenInfo) return false;
  const b = screenInfo.box, c = b.getCenter(new THREE.Vector3());
  if (camera.position.x < b.max.x) return false;
  let seen = 0;
  for (const dz of [-0.9, 0, 0.9]) for (const dy of [-0.45, 0.45]) {
    _o.copy(camera.position); _d.set(b.max.x + 0.02, c.y + dy, c.z + dz).sub(_o); const len = _d.length() - 0.05; _d.normalize();
    let hit = false;
    for (const box of colliders.solids.concat(colliders.walk)) { if (box[3] < 0.7) continue; if (rayHitsBox(_o, _d, len, box)) { hit = true; break; } }
    if (!hit) seen++;
  }
  return seen >= 3;
}

// ---------------------------------------------------------------- friends (Supabase Realtime, channel named by the secret invite code)
const others = new Map(); let chan = null, me = null, lastSend = 0;
function nameSprite(text) {
  const c = document.createElement("canvas"); c.width = 256; c.height = 64; const g = c.getContext("2d");
  g.fillStyle = "rgba(10,14,20,.7)"; g.beginPath(); g.roundRect(4, 8, 248, 48, 24); g.fill();
  g.fillStyle = "#fff"; g.font = "600 28px Barlow, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text.slice(0, 16), 128, 33);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false })); s.scale.set(0.8, 0.2, 1); s.renderOrder = 5; return s;
}
function avatar(name) {
  let h = 0; for (const ch_ of name) h = (h * 31 + ch_.charCodeAt(0)) >>> 0;
  const col = new THREE.Color().setHSL((h % 360) / 360, 0.55, 0.55);
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.85, 6, 16), new THREE.MeshLambertMaterial({ color: col })); body.position.y = 0.66;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 14), new THREE.MeshLambertMaterial({ color: 0xe8d2c0 })); head.position.y = 1.45;
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.05), new THREE.MeshBasicMaterial({ color: 0x111111 })); visor.position.set(0, 1.47, -0.14);
  const tag = nameSprite(name); tag.position.y = 1.85;
  g.add(body, head, visor, tag); return g;
}
function upsertOther(k, st) {
  let o = others.get(k);
  if (!o) { o = { g: avatar(st.name || "Guest"), to: new THREE.Vector3(st.x, st.y, st.z), yaw: st.yaw || 0 }; o.g.position.copy(o.to); scene.add(o.g); others.set(k, o); }
  if (st.x !== undefined) { o.to.set(st.x, st.y, st.z); o.yaw = st.yaw; }
  o.sit = st.sit || null;
  const seat = o.sit && SEATS.find((x) => x.id === o.sit);
  if (seat) { o.to.set(seat.at.x, seat.at.y - 0.7, seat.at.z); o.yaw = seat.yaw; }   // seated friends sink into the seat, facing out
  renderWho();
}
function dropOther(k) { const o = others.get(k); if (o) { scene.remove(o.g); others.delete(k); } renderWho(); }
function renderWho() { $("who").textContent = others.size ? `Here now: you + ${others.size} friend${others.size > 1 ? "s" : ""}` : ""; }

async function joinHome(supabase, code, myName) {
  const key = (await getIdentity()).sessionId || Math.random().toString(36).slice(2);
  chan = supabase.channel("home:" + code, { config: { broadcast: { self: false }, presence: { key } } });
  chan.on("broadcast", { event: "pos" }, ({ payload }) => { if (payload && payload.k !== key) upsertOther(payload.k, payload); });
  chan.on("presence", { event: "leave" }, ({ key: k }) => dropOther(k));
  chan.on("broadcast", { event: "tv" }, ({ payload }) => onRemoteTV(payload));
  // someone new walked in: tell them what's on (a little jitter so a full room doesn't all answer at once)
  chan.on("presence", { event: "join" }, ({ key: k }) => { if (k !== key && tvStamp) setTimeout(() => shareTV(tvStamp), 200 + Math.random() * 700); });
  chan.on("presence", { event: "sync" }, () => {
    const st = chan.presenceState();
    for (const k of Object.keys(st)) if (k !== key && !others.has(k)) { const s0 = st[k][0] || {}; upsertOther(k, { name: s0.name, x: s0.x ?? 7, y: s0.y ?? 0, z: s0.z ?? -2, yaw: 0 }); }
    for (const k of [...others.keys()]) if (!st[k]) dropOther(k);
  });
  await new Promise((ok) => chan.subscribe((s) => { if (s === "SUBSCRIBED") ok(); }));
  await chan.track({ name: myName, x: P.pos.x, y: P.pos.y, z: P.pos.z });
  me = { key, name: myName };
}
function sendPos(moved, now) {
  if (!chan || !me) return;
  if (now - lastSend < (moved ? 110 : 2000)) return;
  lastSend = now;
  chan.send({ type: "broadcast", event: "pos", payload: { k: me.key, name: me.name, x: +P.pos.x.toFixed(2), y: +P.pos.y.toFixed(2), z: +P.pos.z.toFixed(2), yaw: +P.yaw.toFixed(2), sit: seated ? seated.id : null } });
}

async function setupPeople() {
  let supabase; try { supabase = await getSupabase(); } catch (e) { return; }
  const ident = await getIdentity().catch(() => ({ name: "Guest", kind: "device" }));
  const invite = (qs.get("invite") || "").replace(/[^a-f0-9]/gi, "").slice(0, 32);
  if (invite) {
    const { data } = await supabase.rpc("home_by_invite", { p_code: invite });
    const row = data && data[0];
    if (!row) { $("sub").textContent = "That invite link has expired - ask for a new one"; return; }
    $("title").firstChild.textContent = `${row.owner_name || "A friend"}'s Loft`; $("sub").textContent = "You're visiting";
    await joinHome(supabase, invite, ident.name || "Guest");
    return;
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { $("sub").innerHTML = `Model loft · <a href="/admin" style="color:inherit">sign in</a> to get your own + invite friends`; return; }
  const { data: home, error } = await supabase.rpc("my_home", { p_name: ident.name });
  if (error || !home) { $("sub").textContent = "Heartbeat Homes"; return; }
  $("title").firstChild.textContent = `${home.owner_name || "Your"}'s Loft`; $("sub").textContent = "Your home";
  const link = () => `${location.origin}/homes/?invite=${home.invite_code}`;
  $("invBtn").style.display = ""; $("invLink").value = link();
  $("invBtn").onclick = () => $("invSheet").classList.add("show");
  $("invClose").onclick = () => $("invSheet").classList.remove("show");
  $("invCopy").onclick = async () => { try { await navigator.clipboard.writeText(link()); $("invCopy").textContent = "Copied ✓"; } catch (e) { $("invLink").select(); } };
  $("invShare").onclick = () => navigator.share ? navigator.share({ title: "Come hang out in my loft", url: link() }).catch(() => {}) : $("invCopy").onclick();
  $("invRoll").onclick = async () => {
    const { data } = await supabase.rpc("rotate_home_invite");
    if (data) { home.invite_code = data; $("invLink").value = link(); if (chan) { supabase.removeChannel(chan); chan = null; await joinHome(supabase, data, ident.name); } }
  };
  await joinHome(supabase, home.invite_code, ident.name || "Me");
}

// ---------------------------------------------------------------- go
bar(0.05);
try {
  await Promise.all([loadLoft(), setupTV()]);
} catch (e) {
  $("loadMsg").textContent = "The loft didn't load - check your connection and refresh."; console.error(e); throw e;
}
spawn(); showCh(); bar(1, "Welcome home.");
setTimeout(() => $("load").classList.add("done"), 250);
setupPeople().catch((e) => console.warn("homes people", e));
if (qs.get("tv") === "1") toggleTV(true, true);   // local only: a link shouldn't flip the room's TV

const clock = new THREE.Clock(); let visT = 0;
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05), now = performance.now();
  const moved = move(dt);
  sendPos(moved, now);
  const fk = seated && seated.tv ? 1 : 0; if (Math.abs(fovK - fk) > 0.002) { fovK += (fk - fovK) * Math.min(1, dt * 4); fitFov(); }
  if (now - (updateSitBtn.t || 0) > 250) { updateSitBtn.t = now; updateSitBtn(); }
  for (const o of others.values()) { o.g.position.lerp(o.to, Math.min(1, dt * 8)); o.g.rotation.y += ((o.yaw || 0) - o.g.rotation.y) * Math.min(1, dt * 8); }

  renderer.render(scene, camera);
  if (tvObj && tvOn) css.render(cssScene, camera);
});
window.HBHome = { P, camera, toggleTV, tune, others, soundOn: roomSoundOn, SEATS, sitDown, standUp, get seated() { return seated; } };
